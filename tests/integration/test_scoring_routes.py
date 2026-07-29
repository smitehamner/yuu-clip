"""yuu_clip/web/routes/scoring.py - route guards and pure helpers.

(_ms_to_hms is covered in test_utils.py.)
"""
from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# _collect_transcript_segments
# ---------------------------------------------------------------------------

class TestCollectTranscriptSegments:
    def _make_db(self, tmp_path, do_transcribe=True):
        from yuu_clip.db.models import AudioTrack, Transcript, Video, make_session
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
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

    def test_no_tracks_returns_empty(self, tmp_path):
        from yuu_clip.db.models import Video, make_session
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session = make_session(tmp_path / "empty.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert result == []

    def test_non_transcribed_track_excluded(self, tmp_path):
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session, v, tx = self._make_db(tmp_path, do_transcribe=False)
        from yuu_clip.db.models import TranscriptSegment
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=5_000, text="hello"))
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert result == []

    def test_segments_returned_sorted_by_start_ms(self, tmp_path):
        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session, v, tx = self._make_db(tmp_path)
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=10_000, end_ms=15_000, text="second"))
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=5_000, text="first"))
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert len(result) == 2
        assert result[0].start_ms == 0
        assert result[1].start_ms == 10_000


# ---------------------------------------------------------------------------
# _redescribable_clip_ids - Regenerate descriptions selection
# ---------------------------------------------------------------------------

class TestRedescribableClipIds:
    def test_scene_rows_and_excerptless_clips_excluded(self, tmp_path):
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        from yuu_clip.web.routes.scoring import _redescribable_clip_ids
        session = make_session(tmp_path / "t.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        clip = ClipCandidate(video_id=v.id, start_ms=0, end_ms=5_000, kind="clip",
                             transcript_excerpt="hello")
        scene = ClipCandidate(video_id=v.id, start_ms=0, end_ms=30_000, kind="scene",
                              transcript_excerpt="scene text")
        silent = ClipCandidate(video_id=v.id, start_ms=6_000, end_ms=9_000, kind="clip")
        session.add_all([clip, scene, silent])
        session.flush()
        try:
            ids = _redescribable_clip_ids(session, v.id)
        finally:
            session.close()
        assert ids == [clip.id]


# ---------------------------------------------------------------------------
# regenerate_summary guards
# ---------------------------------------------------------------------------

class TestRegenerateSummaryGuards:
    def test_regenerate_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/regenerate-summary")
        assert r.status_code == 404

    def test_regenerate_400_when_no_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/regenerate-summary")
        assert r.status_code == 400
        assert "transcript" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# redescribe_clips LLM-unavailable guard
# ---------------------------------------------------------------------------

class TestRedescribeClipsGuard:
    def test_redescribe_503_when_llm_disabled(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/redescribe-clips")
        # Default config has llm_enabled=True but no real backend - check_llm_available
        # returns False → 503
        assert r.status_code == 503

    def test_redescribe_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/redescribe-clips")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# needs_model empty state (Stage 02) - summary/timeline without a language model
# ---------------------------------------------------------------------------

def _seed_transcript(project_dir):
    """Attach a transcript segment to the seeded video's track so summary/timeline
    get past their 'no transcript' guard and reach the LLM-availability check."""
    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment, make_session
    session = make_session(project_dir / ".yuu-clip" / "project.db")
    try:
        track = session.query(AudioTrack).first()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()
        session.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=5_000, text="we pulled off the heist",
        ))
        session.commit()
    finally:
        session.close()


class TestNeedsModelEmptyState:
    def test_summarize_returns_needs_model_when_llm_unavailable(self, project_dir, client):
        _seed_transcript(project_dir)
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/summarize")
        assert r.status_code == 200
        assert '"needs_model": true' in r.text

    def test_timeline_streams_needs_model_when_llm_unavailable(self, project_dir, client):
        _seed_transcript(project_dir)
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/timeline")
        assert r.status_code == 200
        assert '"needs_model": true' in r.text
        assert '"type": "done"' in r.text
        assert '"outcome": "ok"' in r.text

    def test_regenerate_summary_streams_needs_model_when_llm_unavailable(self, project_dir, client):
        _seed_transcript(project_dir)
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/regenerate-summary")
        assert r.status_code == 200
        assert '"needs_model": true' in r.text


# ---------------------------------------------------------------------------
# summarize / regenerate-summary - the LLM call itself raising must surface as
# a typed SSE error, not a crash (BUG #9 converted /summarize from a plain
# POST to this SSE shape specifically so a failure/cancel has a stream to
# unwind - a regression here would silently drop back to an unhandled 500).
# ---------------------------------------------------------------------------

def _last_done_event(response) -> dict:
    import json
    lines = [line for line in response.text.splitlines() if line.startswith("data: ")]
    return json.loads(lines[-1][len("data: "):])


class TestSummaryGenerationErrorPath:
    def _mock_llm_failure(self, monkeypatch):
        monkeypatch.setattr("yuu_clip.scoring.llm.check_llm_available", lambda _cfg: (True, ""))

        def _boom(*args, **kwargs):
            raise RuntimeError("model exploded")

        monkeypatch.setattr("yuu_clip.scoring.llm.summarize_transcript", _boom)

    def test_summarize_streams_error_when_llm_call_raises(self, project_dir, client, monkeypatch):
        _seed_transcript(project_dir)
        self._mock_llm_failure(monkeypatch)
        vid_id = client.get("/api/videos").json()[0]["id"]

        r = client.get(f"/api/videos/{vid_id}/summarize")

        assert r.status_code == 200
        assert _last_done_event(r) == {
            "v": 1, "type": "done", "outcome": "error",
            "error": "LLM error: model exploded",
        }

    def test_regenerate_summary_streams_error_and_leaves_video_untouched(self, project_dir, client, monkeypatch):
        _seed_transcript(project_dir)
        self._mock_llm_failure(monkeypatch)
        vid_id = client.get("/api/videos").json()[0]["id"]

        r = client.get(f"/api/videos/{vid_id}/regenerate-summary")

        assert r.status_code == 200
        assert _last_done_event(r) == {
            "v": 1, "type": "done", "outcome": "error",
            "error": "Summary generation failed: model exploded",
        }
        from yuu_clip.db.models import Video, make_session
        session = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            video = session.get(Video, vid_id)
            assert video.summarized_at is None
            assert video.summary is None
        finally:
            session.close()

    def test_timeline_chunk_failure_degrades_that_entry_without_aborting_the_stream(
        self, project_dir, client, monkeypatch,
    ):
        """One window's LLM call raising must not drop the other windows or fail
        the whole timeline - the per-chunk try/except degrades just that entry's
        text, an untested behavior path since the only prior timeline coverage
        was the guards, the needs-model empty state, and (at the system tier) the
        all-success path."""
        from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment, make_session
        session = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            track = session.query(AudioTrack).first()
            tx = Transcript(audio_track_id=track.id, model_name="base")
            session.add(tx)
            session.flush()
            # Two 10s windows (interval_s=10 below): [0,5000) and [15000,20000).
            session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=5_000, text="the heist begins"))
            session.add(TranscriptSegment(transcript_id=tx.id, start_ms=15_000, end_ms=20_000, text="the getaway"))
            session.commit()
        finally:
            session.close()

        monkeypatch.setattr("yuu_clip.scoring.llm.check_llm_available", lambda _cfg: (True, ""))

        def _fail_second_chunk(chunk_text, start_hms, end_hms, window_clips, config, context_text):
            if "getaway" in chunk_text:
                raise RuntimeError("model exploded")
            return "The heist begins."

        monkeypatch.setattr("yuu_clip.scoring.llm.generate_timeline_chunk", _fail_second_chunk)
        vid_id = client.get("/api/videos").json()[0]["id"]

        r = client.get(f"/api/videos/{vid_id}/timeline?interval_s=10")

        assert r.status_code == 200
        assert _last_done_event(r) == {"v": 1, "type": "done", "outcome": "ok"}
        timeline = client.get(f"/api/videos/{vid_id}").json()["timeline"]
        assert [entry["text"] for entry in timeline] == [
            "The heist begins.",
            "[Error generating entry: model exploded]",
        ]


# ---------------------------------------------------------------------------
# rescore_clip 404 guard
# ---------------------------------------------------------------------------

class TestRescoreClipGuard:
    def test_rescore_clip_404_for_missing_clip(self, client):
        r = client.get("/api/clips/99999/rescore")
        assert r.status_code == 404


class TestRescoreFullFlag:
    """The user-facing full-vs-LLM-only choice reaches the scorer-set factory: the
    routes must thread ?full through to build_rescore_scorers, which pairs the set
    with its preserve flag."""

    def _spy(self, monkeypatch):
        from unittest.mock import MagicMock

        import yuu_clip.scoring.scorer_set as scorer_set
        from yuu_clip.scoring.protocol import ScoreResult

        captured = {}

        def spy(config, *, context_text="", full=False):
            captured["full"] = full
            fake = MagicMock()
            fake.name = "llm"
            fake.weight = 1.0
            fake.is_available.return_value = True
            fake.score.return_value = ScoreResult()
            fake.last_error = None
            return [fake], (not full)

        monkeypatch.setattr(scorer_set, "build_rescore_scorers", spy)
        return captured

    def test_video_rescore_defaults_to_llm_only(self, client, monkeypatch):
        captured = self._spy(monkeypatch)
        assert client.get("/api/videos/1/rescore-clips").status_code == 200
        assert captured["full"] is False

    def test_video_rescore_full_flag_threads_through(self, client, monkeypatch):
        captured = self._spy(monkeypatch)
        assert client.get("/api/videos/1/rescore-clips?full=1").status_code == 200
        assert captured["full"] is True

    def test_clip_rescore_full_flag_threads_through(self, client, monkeypatch):
        captured = self._spy(monkeypatch)
        clip_id = client.get("/api/videos/1/clips").json()[0]["id"]
        assert client.get(f"/api/clips/{clip_id}/rescore?full=1").status_code == 200
        assert captured["full"] is True


# ---------------------------------------------------------------------------
# _rescore_video_clips - "Last scored with" provenance stamp
# ---------------------------------------------------------------------------

class TestRescoreProvenanceStamp:
    """A fully-failed batch must not claim to be current with a context it never
    successfully scored against; a partial or full success still stamps."""

    def _spy(self, monkeypatch, *, fail: bool):
        from unittest.mock import MagicMock

        import yuu_clip.scoring.scorer_set as scorer_set
        from yuu_clip.scoring.protocol import ScoreResult

        def spy(config, *, context_text="", full=False):
            fake = MagicMock()
            fake.name = "llm"
            fake.weight = 1.0
            fake.is_available.return_value = True
            if fail:
                fake.score.return_value = ScoreResult(tags=["llm_error"])
                fake.last_error = "LLM scoring failed"
            else:
                fake.score.return_value = ScoreResult()
                fake.last_error = None
            return [fake], (not full)

        monkeypatch.setattr(scorer_set, "build_rescore_scorers", spy)

    def _clips_scored_at(self, project_dir):
        from yuu_clip.db.models import Video, make_session
        session = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            return session.get(Video, 1).clips_scored_at
        finally:
            session.close()

    def test_fully_failed_batch_does_not_stamp_provenance(self, client, project_dir, monkeypatch):
        self._spy(monkeypatch, fail=True)
        assert client.get("/api/videos/1/rescore-clips").status_code == 200
        assert self._clips_scored_at(project_dir) is None

    def test_successful_batch_stamps_provenance(self, client, project_dir, monkeypatch):
        self._spy(monkeypatch, fail=False)
        assert client.get("/api/videos/1/rescore-clips").status_code == 200
        assert self._clips_scored_at(project_dir) is not None


# ---------------------------------------------------------------------------
# _config_with_context_weights
# ---------------------------------------------------------------------------

class TestConfigWithContextWeights:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_no_overrides_returns_same_config(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        result = _config_with_context_weights(cfg, {}, [])
        assert result is cfg

    def test_weight_override_applied(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        contexts = {"ctx-a": {"score_funny_weight": 3.0}}
        result = _config_with_context_weights(cfg, contexts, ["ctx-a"])
        assert result.score_funny_weight == pytest.approx(3.0)

    def test_none_weight_not_applied(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        original_funny = cfg.score_funny_weight
        contexts = {"ctx-a": {"score_funny_weight": None}}
        result = _config_with_context_weights(cfg, contexts, ["ctx-a"])
        assert result.score_funny_weight == pytest.approx(original_funny)
