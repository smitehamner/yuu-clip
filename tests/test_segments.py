"""yuu_clip/segments/windower.py + yuu_clip/analyze/overlap.py — clip generation and transcript-overlap detection."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Windower (_silence_window) unit tests
# ---------------------------------------------------------------------------

class TestSilenceWindow:
    """_silence_window boundary conditions and split logic."""

    def _seg(self, start_ms, end_ms, text="x"):
        from unittest.mock import MagicMock
        s = MagicMock()
        s.start_ms = start_ms
        s.end_ms = end_ms
        s.text = text
        return s

    def _window(self, segments, silence_ms=3000, min_ms=5000, hard_ms=180_000):
        from yuu_clip.segments.windower import _silence_window
        return _silence_window(segments, silence_ms, min_ms, hard_ms)

    def test_empty_segments_returns_empty(self):
        assert self._window([]) == []

    def test_single_segment_too_short_dropped(self):
        segs = [self._seg(0, 2000)]  # 2 s < min_ms=5000
        assert self._window(segs) == []

    def test_single_segment_long_enough_kept(self):
        segs = [self._seg(0, 10_000)]  # 10 s > min_ms=5000
        result = self._window(segs)
        assert len(result) == 1
        assert result[0][0] == 0
        assert result[0][1] == 10_000

    def test_silence_gap_creates_two_windows(self):
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(15_000, 25_000, "second"),  # 5 s gap >= silence_ms=3000
        ]
        result = self._window(segs)
        assert len(result) == 2
        assert result[0][1] == 10_000
        assert result[1][0] == 15_000

    def test_small_gap_merges_into_one_window(self):
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(11_000, 21_000, "second"),  # 1 s gap < silence_ms=3000
        ]
        result = self._window(segs)
        assert len(result) == 1
        assert result[0][1] == 21_000

    def test_hard_split_breaks_long_window(self):
        # Two segments forming a 200 s window — exceeds hard_split_ms=180_000
        segs = [
            self._seg(0, 100_000, "long first part"),
            self._seg(101_000, 201_000, "long second part"),
        ]
        result = self._window(segs, hard_ms=180_000)
        # hard_split fires during the second segment, creating two candidates
        assert len(result) == 2
        assert "hard_split" in result[0][3]

    def test_long_silence_tag_added(self):
        """A silence >= 10 s adds 'long_silence_before' tag to the new window."""
        segs = [
            self._seg(0, 10_000, "before"),
            self._seg(25_000, 35_000, "after"),  # 15 s gap
        ]
        result = self._window(segs)
        assert len(result) == 2
        assert "long_silence_before" in result[1][3]

    def test_window_texts_collected(self):
        segs = [
            self._seg(0, 5_000, "hello"),
            self._seg(5_500, 10_500, "world"),
        ]
        result = self._window(segs, silence_ms=3000)
        assert len(result) == 1
        seg_texts = [s.text for s in result[0][2]]
        assert "hello" in seg_texts
        assert "world" in seg_texts

    def test_low_speech_density_window_dropped(self):
        # One hallucinated line ("Thanks for watching") stamped across 5 min is
        # ~0.06 chars/s — kept with the floor off, dropped with a 0.2 cps floor.
        from yuu_clip.segments.windower import _silence_window
        segs = [self._seg(0, 300_000, "Thanks for watching")]
        assert len(_silence_window(segs, 3000, 5000, 180_000, 0.0)) == 1
        assert _silence_window(segs, 3000, 5000, 180_000, 0.2) == []

    def test_dense_window_kept_under_speech_floor(self):
        from yuu_clip.segments.windower import _silence_window
        segs = [self._seg(0, 10_000, "this is a normal spoken line with plenty of words")]
        assert len(_silence_window(segs, 3000, 5000, 180_000, 0.2)) == 1

    def test_overlapping_segment_does_not_shrink_win_end(self):
        # Segment B overlaps and ends before segment A — win_end must not go backwards.
        # Without the fix, win_end drops to 4000 and the subsequent gap becomes
        # 6000-4000=2000 ms which is below silence_ms=3000, merging what should split.
        segs = [
            self._seg(0, 10_000, "A"),       # win_end → 10000
            self._seg(3_000, 4_000, "B"),    # overlaps A; must not drop win_end to 4000
            self._seg(14_000, 24_000, "C"),  # 4 s gap from real win_end (10000) → split
        ]
        result = self._window(segs, silence_ms=3000, min_ms=5000)
        assert len(result) == 2, "overlapping inner segment must not suppress a later silence split"
        assert result[0][1] == 10_000
        assert result[1][0] == 14_000

# ---------------------------------------------------------------------------
# windower.generate_candidates — public API with a real DB session
# ---------------------------------------------------------------------------

class TestGenerateCandidates:
    """generate_candidates produces ClipCandidates from Transcript + TranscriptSegments."""

    def _setup_db(self, tmp_path, do_transcribe=True):
        from yuu_clip.db.models import (
            AudioTrack,
            Transcript,
            Video,
            make_session,
        )
        db_path = tmp_path / "test.db"
        session = make_session(db_path)

        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv",
                  status="done", duration_ms=600_000)
        session.add(v)
        session.flush()

        track = AudioTrack(
            video_id=v.id, stream_index=0, label="combined",
            do_transcribe=do_transcribe, do_score=True, relevance_weight=1.0,
        )
        session.add(track)
        session.flush()

        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()

        return session, v, tx

    def _add_seg(self, session, tx_id, start_ms, end_ms, text="x"):
        from yuu_clip.db.models import TranscriptSegment
        session.add(TranscriptSegment(
            transcript_id=tx_id, start_ms=start_ms, end_ms=end_ms, text=text,
        ))

    def test_empty_transcripts_returns_empty_list(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        try:
            result = generate_candidates(v, [], Config(), session)
        finally:
            session.close()
        assert result == []

    def test_non_transcribable_track_ignored(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path, do_transcribe=False)
        # Add segments — they should be ignored because do_transcribe=False
        self._add_seg(session, tx.id, 0, 10_000)
        session.flush()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], Config(), session)
        finally:
            session.close()
        assert result == []

    def test_segments_shorter_than_min_clip_dropped(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        # 2-second segment, default min_clip_ms = 5000
        self._add_seg(session, tx.id, 0, 2_000, "short")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert result == []

    def test_long_segment_produces_one_candidate(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 30_000, "hello world")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) == 1
        assert result[0].start_ms == 0
        assert result[0].end_ms == 30_000
        assert result[0].video_id == v.id
        assert result[0].status == "pending"

    def test_silence_gap_produces_two_candidates(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        # Two clusters each > min_clip_ms (15 s), separated by > silence_threshold_ms (3 s)
        # Cluster A: 0 – 20 000 ms  (4 × 5 s segments)
        for i in range(4):
            self._add_seg(session, tx.id, i * 5_000, (i + 1) * 5_000, f"a{i}")
        # Cluster B: 30 000 – 50 000 ms
        for i in range(4):
            offset = 30_000 + i * 5_000
            self._add_seg(session, tx.id, offset, offset + 5_000, f"b{i}")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) == 2
        assert result[0].end_ms < result[1].start_ms

    def test_runaway_timestamp_segment_dropped_as_silence(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        # A single hallucinated line stamped across 10 min (~0.03 chars/s) must not
        # become a 10-minute clip — the default speech-density floor drops it.
        self._add_seg(session, tx.id, 0, 600_000, "Thanks for watching")
        session.flush()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], Config(), session)
        finally:
            session.close()
        assert result == []

    def test_transcript_excerpt_joins_segment_texts(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 10_000, "hello")
        self._add_seg(session, tx.id, 11_000, 20_000, "world")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
        finally:
            session.close()
        assert len(result) >= 1
        # Both words should appear in at least one excerpt
        all_text = " ".join(c.transcript_excerpt or "" for c in result)
        assert "hello" in all_text
        assert "world" in all_text

    def test_candidates_added_to_session(self, tmp_path):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate
        from yuu_clip.segments.windower import generate_candidates
        session, v, tx = self._setup_db(tmp_path)
        self._add_seg(session, tx.id, 0, 30_000, "this clip has plenty of spoken content in it")
        session.flush()
        config = Config()
        try:
            result = generate_candidates(v, [tx.audio_track.transcripts[0]], config, session)
            session.commit()
            count = session.query(ClipCandidate).count()
        finally:
            session.close()
        assert count == len(result)
        assert count >= 1

# ---------------------------------------------------------------------------
# Clip timing
# ---------------------------------------------------------------------------

class TestClipTiming:
    """PATCH /api/clips/{id}/timing — stores start_offset and end_offset."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_set_timing_offsets_returned_in_response(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/timing", json={
            "start_offset": 2.5, "end_offset": -1.0,
        })
        assert r.status_code == 200
        d = r.json()
        assert abs(d["start_offset"] - 2.5) < 1e-6
        assert abs(d["end_offset"] - (-1.0)) < 1e-6

    def test_timing_offsets_persisted(self, client):
        clip_id = self._first_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/timing", json={"start_offset": 3.0, "end_offset": 0.0})
        d = client.get(f"/api/clips/{clip_id}").json()
        assert abs(d["start_offset"] - 3.0) < 1e-6
        assert d["end_offset"] == 0.0

    def test_clip_detail_includes_offset_fields(self, client):
        clip_id = self._first_clip_id(client)
        d = client.get(f"/api/clips/{clip_id}").json()
        assert "start_offset" in d
        assert "end_offset" in d

    def test_timing_patch_404(self, client):
        r = client.patch("/api/clips/99999/timing", json={"start_offset": 0.0, "end_offset": 0.0})
        assert r.status_code == 404

# ---------------------------------------------------------------------------
# _silence_window — tag content
# ---------------------------------------------------------------------------

class TestSilenceWindowTags:
    def _seg(self, start_ms, end_ms, text="x"):
        from unittest.mock import MagicMock
        s = MagicMock()
        s.start_ms = start_ms
        s.end_ms = end_ms
        s.text = text
        return s

    def _window(self, segments, silence_ms=3000, min_ms=5000, hard_ms=180_000):
        from yuu_clip.segments.windower import _silence_window
        return _silence_window(segments, silence_ms, min_ms, hard_ms)

    def test_flushed_window_carries_silence_gap_tag(self):
        """The first window closed by a silence gap should carry a silence_Xs tag."""
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(18_000, 28_000, "second"),  # 8 s gap
        ]
        result = self._window(segs)
        assert len(result) == 2
        # First window flushed with e.g. "silence_8s"
        assert any("silence_" in t for t in result[0][3])

    def test_new_window_after_silence_carries_after_silence_tag(self):
        """The second window opened after a silence gap should carry an after_silence_Xs tag."""
        segs = [
            self._seg(0, 10_000, "first"),
            self._seg(18_000, 28_000, "second"),  # 8 s gap
        ]
        result = self._window(segs)
        assert len(result) == 2
        assert any("after_silence_" in t for t in result[1][3])

    def test_second_window_after_hard_split_carries_after_hard_split_tag(self):
        """The window opened after a hard split must carry the after_hard_split tag."""
        segs = [
            self._seg(0, 100_000, "part A"),
            self._seg(101_000, 201_000, "part B"),
        ]
        result = self._window(segs, hard_ms=180_000)
        assert len(result) == 2
        assert "after_hard_split" in result[1][3]

# ---------------------------------------------------------------------------
# overlap.detect_transcript_overlap
# ---------------------------------------------------------------------------

class TestDetectTranscriptOverlapIntegration:
    def _setup(self, tmp_path):
        from yuu_clip.db.models import (
            Video,
            make_session,
        )
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
        session.add(v)
        session.flush()
        return session, v

    def _add_track(self, session, video_id, label, do_score=True):
        from yuu_clip.db.models import AudioTrack
        t = AudioTrack(
            video_id=video_id, stream_index=len(label), label=label,
            do_transcribe=True, do_score=do_score, relevance_weight=1.0,
        )
        session.add(t)
        session.flush()
        return t

    def _add_transcript(self, session, track_id, words):
        from yuu_clip.db.models import Transcript, TranscriptSegment
        tx = Transcript(audio_track_id=track_id, model_name="base")
        session.add(tx)
        session.flush()
        # One segment per word group — space out timestamps
        for i, word in enumerate(words):
            session.add(TranscriptSegment(
                transcript_id=tx.id,
                start_ms=i * 1000, end_ms=(i + 1) * 1000,
                text=word,
            ))
        session.flush()
        return tx

    def test_no_combined_track_returns_false(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        spec = self._add_track(session, v.id, "player_voice")
        self._add_transcript(session, spec.id, ["hello"] * 25)
        try:
            result = detect_transcript_overlap([spec], session)
        finally:
            session.close()
        assert result is False

    def test_not_enough_combined_words_returns_false(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        comb = self._add_track(session, v.id, "combined")
        spec = self._add_track(session, v.id, "player_voice")
        # Only 5 unique words in combined — below the 20-word threshold
        self._add_transcript(session, comb.id, ["one", "two", "three", "four", "five"])
        self._add_transcript(session, spec.id, ["one", "two", "three"] * 10)
        try:
            result = detect_transcript_overlap([comb, spec], session)
        finally:
            session.close()
        assert result is False

    def test_high_overlap_disables_specialized_track(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        comb = self._add_track(session, v.id, "combined")
        spec = self._add_track(session, v.id, "player_voice")
        # 25 purely alphabetic unique words — _word_set only keeps [a-z'] tokens
        combined_words = [chr(ord('a') + i) * 4 for i in range(25)]  # aaaa, bbbb, ...
        self._add_transcript(session, comb.id, combined_words)
        # Specialized transcript is 100% contained in combined
        self._add_transcript(session, spec.id, combined_words[:10])
        try:
            result = detect_transcript_overlap([comb, spec], session)
            assert result is True
            assert spec.do_score is False
            assert comb.do_transcribe is True
            assert comb.do_score is True
        finally:
            session.close()

    def test_no_overlap_leaves_specialized_track_enabled(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        comb = self._add_track(session, v.id, "combined")
        spec = self._add_track(session, v.id, "player_voice")
        # Disjoint vocabularies: "ca" prefix vs "sb" prefix — zero word overlap
        combined_words = ["ca" + chr(ord('a') + i) for i in range(25)]
        spec_words     = ["sb" + chr(ord('a') + i) for i in range(25)]
        self._add_transcript(session, comb.id, combined_words)
        self._add_transcript(session, spec.id, spec_words)
        try:
            result = detect_transcript_overlap([comb, spec], session)
        finally:
            session.close()
        assert result is False
        assert spec.do_score is True

    def test_no_specialized_tracks_returns_false(self, tmp_path):
        from yuu_clip.analyze.overlap import detect_transcript_overlap
        session, v = self._setup(tmp_path)
        comb = self._add_track(session, v.id, "combined")
        self._add_transcript(session, comb.id, [f"w{i}" for i in range(25)])
        try:
            result = detect_transcript_overlap([comb], session)
        finally:
            session.close()
        assert result is False

# ---------------------------------------------------------------------------
# Pearson correlation
# ---------------------------------------------------------------------------

class TestPearsonCorrelation:
    """_pearson correlation helper covers edge cases used in overlap detection."""

    def _pearson(self, a, b):
        from yuu_clip.analyze.overlap import _pearson
        return _pearson(a, b)

    def test_identical_sequences_returns_one(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0]
        assert abs(self._pearson(a, a) - 1.0) < 1e-9

    def test_perfectly_anticorrelated_returns_minus_one(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0]
        b = [5.0, 4.0, 3.0, 2.0, 1.0]
        assert abs(self._pearson(a, b) - (-1.0)) < 1e-9

    def test_short_sequence_returns_zero(self):
        assert self._pearson([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) == 0.0

    def test_constant_sequences_returns_zero(self):
        # Both all-same (e.g. two tracks silent over the sampled window): no
        # variance to correlate against, so this is undetermined, not "identical" —
        # returning 1.0 here would wrongly suppress a track that's only silent
        # during the sample.
        a = [0.5, 0.5, 0.5, 0.5, 0.5]
        assert self._pearson(a, a) == 0.0

    def test_one_constant_other_varying_returns_zero(self):
        a = [0.5, 0.5, 0.5, 0.5, 0.5]
        b = [1.0, 2.0, 3.0, 4.0, 5.0]
        assert self._pearson(a, b) == 0.0

    def test_unequal_lengths_uses_shorter(self):
        a = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
        b = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = self._pearson(a, b)
        assert abs(result - 1.0) < 1e-9
