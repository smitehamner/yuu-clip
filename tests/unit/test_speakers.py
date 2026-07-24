"""Speaker model + migration tests (Phase 1 of speaker naming) - pure logic and
tmp-DB round-trips, no client/project_dir fixture.

Client-bound route tests live in tests/integration/test_speakers.py."""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from yuu_clip.db.models import (
    AudioTrack,
    ProjectVoice,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
    VoiceExemplar,
    make_engine,
    make_session,
)


def _column_names(engine, table: str) -> set[str]:
    with engine.connect() as conn:
        return {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}


class TestSchema:
    def test_speakers_table_and_speaker_id_column_exist(self, tmp_path: Path):
        engine = make_engine(tmp_path / "fresh.db")
        cols = _column_names(engine, "transcript_segments")
        assert "speaker_id" in cols
        assert "speaker_edited" in cols
        with engine.connect() as conn:
            tables = {row[0] for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )}
        assert "speakers" in tables
        assert "voiceprint_backend" in _column_names(engine, "speakers")


class TestSpeakerModel:
    def test_display_name_uses_name_then_fallback(self, tmp_path: Path):
        named = Speaker(video_id=1, name="Yuu", display_index=1, confirmed=True)
        unnamed = Speaker(video_id=1, name=None, display_index=2, confirmed=True)
        assert named.display_name == "Yuu"
        assert unnamed.display_name == "Speaker 2"

    def test_display_name_hides_unconfirmed_suggestion(self, tmp_path: Path):
        # An inferred name the user has not accepted must not surface as the display name.
        suggested = Speaker(video_id=1, name="Yuu", display_index=1,
                            source="inferred", confirmed=False)
        assert suggested.display_name == "Speaker 1"

    def test_display_color_uses_explicit_color(self, tmp_path: Path):
        speaker = Speaker(video_id=1, display_index=1, color="#123456")
        assert speaker.display_color == "#123456"

    def test_display_color_falls_back_to_palette_by_display_index(self, tmp_path: Path):
        from yuu_clip.db.models import SPEAKER_COLOR_PALETTE
        first = Speaker(video_id=1, display_index=1)
        second = Speaker(video_id=1, display_index=2)
        assert first.display_color == SPEAKER_COLOR_PALETTE[0]
        assert second.display_color == SPEAKER_COLOR_PALETTE[1]
        assert first.display_color != second.display_color

    def test_display_color_palette_wraps_around(self, tmp_path: Path):
        from yuu_clip.db.models import SPEAKER_COLOR_PALETTE
        wrapped = Speaker(video_id=1, display_index=len(SPEAKER_COLOR_PALETTE) + 1)
        assert wrapped.display_color == SPEAKER_COLOR_PALETTE[0]

    def test_segment_resolves_to_speaker(self, tmp_path: Path):
        session = make_session(tmp_path / "p.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        speaker = Speaker(video_id=video.id, name="Mara", display_index=1)
        session.add(speaker)
        session.flush()

        track = AudioTrack(video_id=video.id, stream_index=1, label="combined")
        session.add(track)
        session.flush()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()
        seg = TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=1000, text="hi",
            speaker_label="SPEAKER_00", speaker_id=speaker.id,
        )
        session.add(seg)
        session.commit()

        loaded = session.query(TranscriptSegment).one()
        assert loaded.speaker.display_name == "Mara"
        session.close()

class TestAttachSpeakers:
    def _seed_transcript(self, session, video_id, labels: list[str]):
        track = AudioTrack(video_id=video_id, stream_index=1, label="combined")
        session.add(track)
        session.flush()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()
        for i, label in enumerate(labels):
            session.add(TranscriptSegment(
                transcript_id=tx.id, start_ms=i * 1000, end_ms=(i + 1) * 1000,
                text=f"seg{i}", speaker_label=label,
            ))
        session.flush()
        return tx

    def test_creates_one_speaker_per_distinct_label(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "a.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        tx = self._seed_transcript(
            session, video.id, ["SPEAKER_00", "SPEAKER_00", "SPEAKER_01"]
        )

        _attach_speakers(session, video.id, tx.id)

        speakers = session.query(Speaker).order_by(Speaker.display_index).all()
        assert [s.display_index for s in speakers] == [1, 2]
        segs = session.query(TranscriptSegment).order_by(TranscriptSegment.start_ms).all()
        assert segs[0].speaker_id == segs[1].speaker_id  # both SPEAKER_00
        assert segs[2].speaker_id != segs[0].speaker_id  # SPEAKER_01 distinct
        session.close()

    def test_display_index_continues_from_existing(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "b.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        session.add(Speaker(video_id=video.id, name="Yuu", display_index=3))
        session.flush()
        tx = self._seed_transcript(session, video.id, ["SPEAKER_00"])

        _attach_speakers(session, video.id, tx.id)

        new_speaker = session.query(Speaker).filter_by(name=None).one()
        assert new_speaker.display_index == 4  # continues past the existing max
        session.close()

    def test_no_labels_creates_no_speakers(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "c.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        tx = self._seed_transcript(session, video.id, [None, None])

        _attach_speakers(session, video.id, tx.id)

        assert session.query(Speaker).count() == 0
        session.close()


class TestVoiceprintMatch:
    def _seed_transcript(self, session, video_id, label: str):
        track = AudioTrack(video_id=video_id, stream_index=1, label="combined")
        session.add(track)
        session.flush()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()
        session.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=1000, text="hi", speaker_label=label,
        ))
        session.flush()
        return tx

    def test_new_cluster_stores_voiceprint(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers, _deserialize_voiceprint

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        tx = self._seed_transcript(session, video.id, "SPEAKER_00")

        _attach_speakers(session, video.id, tx.id, {"SPEAKER_00": [1.0, 0.0, 0.0]})

        speaker = session.query(Speaker).one()
        assert _deserialize_voiceprint(speaker.voiceprint) == [1.0, 0.0, 0.0]
        session.close()

    def test_rediarize_reattaches_named_speaker_by_voiceprint(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0, 0.0]})
        speaker = session.query(Speaker).one()
        speaker.name = "Yuu"
        session.flush()

        # Re-diarize: same voice (near-identical embedding), unrelated raw label.
        tx2 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx2.id, {"SPEAKER_00": [0.99, 0.02, 0.0]})

        speakers = session.query(Speaker).all()
        assert len(speakers) == 1  # no new speaker minted
        assert speakers[0].name == "Yuu"
        seg2 = session.query(TranscriptSegment).filter_by(transcript_id=tx2.id).one()
        assert seg2.speaker_id == speakers[0].id  # name survived re-diarization
        session.close()

    def test_force_replaced_transcript_reattaches_without_double_minting(self, tmp_path: Path):
        # A `--force` re-run DELETES the prior track-level transcript (Stage 1 of
        # the idempotency fix) before re-transcribing, unlike the re-diarize path
        # which keeps it. Deleting the transcript cascade-deletes its segments but
        # leaves the video-scoped Speaker rows intact, so re-attach by voiceprint
        # must still land on the existing named Speaker - not mint a duplicate.
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0, 0.0]})
        session.query(Speaker).one().name = "Yuu"
        session.flush()

        session.delete(tx1)  # what _transcribe_and_check_overlap does under --force
        session.flush()
        tx2 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx2.id, {"SPEAKER_00": [0.99, 0.02, 0.0]})

        speakers = session.query(Speaker).all()
        assert len(speakers) == 1  # no duplicate minted after the delete
        assert speakers[0].name == "Yuu"
        # tx1's segment was cascade-deleted; only tx2's remains (no orphans). A
        # transcript_id filter can't distinguish them here because SQLite recycles
        # tx1's rowid onto tx2, so assert on the total and where it points.
        remaining = session.query(TranscriptSegment).all()
        assert len(remaining) == 1
        assert remaining[0].speaker_id == speakers[0].id
        session.close()

    def test_cross_backend_voiceprint_is_not_matched(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0, 0.0]},
                         active_backend="pyannote")
        session.query(Speaker).one().name = "Yuu"
        session.flush()

        # A SpeechBrain run with an identical-looking vector must NOT re-attach:
        # pyannote and SpeechBrain embeddings live in incompatible spaces, so a
        # cross-backend cosine would be a garbage match.
        tx2 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx2.id, {"SPEAKER_00": [1.0, 0.0, 0.0]},
                         active_backend="speechbrain")

        speakers = session.query(Speaker).order_by(Speaker.display_index).all()
        assert len(speakers) == 2  # minted fresh, not merged onto "Yuu"
        assert speakers[0].name == "Yuu"
        assert speakers[0].voiceprint_backend == "pyannote"
        assert speakers[1].voiceprint_backend == "speechbrain"
        session.close()

    def test_same_backend_voiceprint_reattaches(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0, 0.0]},
                         active_backend="speechbrain")
        session.query(Speaker).one().name = "Yuu"
        session.flush()

        tx2 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx2.id, {"SPEAKER_00": [0.99, 0.02, 0.0]},
                         active_backend="speechbrain")

        speakers = session.query(Speaker).all()
        assert len(speakers) == 1  # same backend + same voice → re-attached
        assert speakers[0].name == "Yuu"
        session.close()

    def test_distinct_voice_mints_new_speaker(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0, 0.0]})
        session.query(Speaker).one().name = "Yuu"
        session.flush()

        # Re-diarize: a clearly different voice (orthogonal embedding).
        tx2 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx2.id, {"SPEAKER_00": [0.0, 1.0, 0.0]})

        speakers = session.query(Speaker).order_by(Speaker.display_index).all()
        assert len(speakers) == 2  # not merged onto "Yuu"
        assert speakers[1].name is None and speakers[1].display_index == 2
        session.close()

    def test_in_band_mints_new_speaker_and_records_suggestion(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers, _cosine_similarity

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0]})
        prior = session.query(Speaker).one()
        prior.name = "Yuu"
        session.flush()

        # Cosine ≈ 0.697 - inside the [0.65, 0.75) band below the 0.75 default.
        near_vector = [0.7, 0.72]
        expected = _cosine_similarity(near_vector, [1.0, 0.0])
        assert 0.65 <= expected < 0.75  # guards the test's own premise
        tx2 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx2.id, {"SPEAKER_00": near_vector})

        speakers = session.query(Speaker).order_by(Speaker.display_index).all()
        assert len(speakers) == 2  # minted, not re-attached onto Yuu
        minted = speakers[1]
        assert minted.name is None
        assert minted.suggested_match_id == prior.id
        assert minted.suggested_match_score == expected
        session.close()

    def test_below_band_mints_clean_with_no_suggestion(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0]})
        session.query(Speaker).one().name = "Yuu"
        session.flush()

        # Cosine ≈ 0.5 - below the band, so a clean mint with no suggestion.
        tx2 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx2.id, {"SPEAKER_00": [0.5, 0.87]})

        minted = session.query(Speaker).order_by(Speaker.display_index).all()[1]
        assert minted.suggested_match_id is None
        assert minted.suggested_match_score is None
        session.close()

    def test_above_threshold_reattach_records_no_suggestion(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0]})
        speaker = session.query(Speaker).one()
        speaker.name = "Yuu"
        session.flush()

        tx2 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx2.id, {"SPEAKER_00": [0.99, 0.02]})

        speaker = session.query(Speaker).one()  # single row → re-attached
        assert speaker.suggested_match_id is None
        assert speaker.suggested_match_score is None
        session.close()

    def test_two_clusters_do_not_collapse_onto_one_prior(self, tmp_path: Path):
        from yuu_clip.transcribe.speaker_attach import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        # Prior run: one named speaker with a voiceprint.
        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0, 0.0]})
        session.query(Speaker).one().name = "Yuu"
        session.flush()

        # New run with two clusters both similar to Yuu - only one may re-attach.
        track = AudioTrack(video_id=video.id, stream_index=2, label="combined")
        session.add(track)
        session.flush()
        tx2 = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx2)
        session.flush()
        session.add(TranscriptSegment(transcript_id=tx2.id, start_ms=0, end_ms=1000, text="a", speaker_label="SPEAKER_00"))
        session.add(TranscriptSegment(transcript_id=tx2.id, start_ms=1000, end_ms=2000, text="b", speaker_label="SPEAKER_01"))
        session.flush()
        _attach_speakers(session, video.id, tx2.id, {
            "SPEAKER_00": [1.0, 0.0, 0.0],
            "SPEAKER_01": [0.98, 0.01, 0.0],
        })

        speakers = session.query(Speaker).all()
        assert len(speakers) == 2  # one re-attached to Yuu, the other minted fresh
        session.close()


class TestApplyNameSuggestions:
    def _speaker(self, display_index, name=None, confirmed=True, source="manual"):
        return Speaker(video_id=1, display_index=display_index, name=name,
                       confirmed=confirmed, source=source)

    def test_applies_suggestion_to_unnamed_speaker_unconfirmed(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions

        speakers = [self._speaker(1)]
        applied = _apply_name_suggestions(speakers, {"1": "Yuu"})
        assert applied == 1
        assert speakers[0].name == "Yuu"
        assert speakers[0].source == "inferred"
        assert speakers[0].confirmed is False
        # Not confirmed → must not surface as a real name yet.
        assert speakers[0].display_name == "Speaker 1"

    def test_never_overwrites_confirmed_manual_name(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions

        speakers = [self._speaker(1, name="Alex", confirmed=True)]
        applied = _apply_name_suggestions(speakers, {"1": "Yuu"})
        assert applied == 0
        assert speakers[0].name == "Alex"

    def test_drops_name_suggested_for_two_speakers(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions

        speakers = [self._speaker(1), self._speaker(2)]
        applied = _apply_name_suggestions(speakers, {"1": "Yuu", "2": "yuu"})
        assert applied == 0
        assert all(s.name is None for s in speakers)

    def test_skips_name_colliding_with_confirmed_speaker(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions

        speakers = [self._speaker(1, name="Yuu", confirmed=True), self._speaker(2)]
        applied = _apply_name_suggestions(speakers, {"2": "yuu"})
        assert applied == 0
        assert speakers[1].name is None

    def test_reapplies_over_prior_unconfirmed_suggestion(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions

        speakers = [self._speaker(1, name="Old", confirmed=False, source="inferred")]
        applied = _apply_name_suggestions(speakers, {"1": "New"})
        assert applied == 1
        assert speakers[0].name == "New"

    def test_drops_placeholder_speaker_name_suggestion(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions

        # The LLM sometimes echoes the "Speaker N" prompt label - never a real name.
        speakers = [self._speaker(1), self._speaker(2)]
        applied = _apply_name_suggestions(speakers, {"1": "Speaker 55", "2": "  speaker 2 "})
        assert applied == 0
        assert all(s.name is None for s in speakers)

    def test_skips_suggestion_equal_to_current_name(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions

        # Re-suggesting the name a speaker already carries (here an unconfirmed one) is a
        # no-op that would just re-open the accept/dismiss prompt - so it must not count.
        speakers = [self._speaker(1, name="Yuu", confirmed=False, source="inferred")]
        applied = _apply_name_suggestions(speakers, {"1": "yuu"})
        assert applied == 0
        assert speakers[0].name == "Yuu"


class TestLabeledTranscript:
    def test_groups_consecutive_segments_and_drops_unattributed(self, tmp_path: Path):
        from yuu_clip.web.routes.speakers import _labeled_transcript

        session = make_session(tmp_path / "lt.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        track = AudioTrack(video_id=video.id, stream_index=1, label="combined", do_transcribe=True)
        session.add(track)
        session.flush()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()
        sp1 = Speaker(video_id=video.id, display_index=1)
        sp2 = Speaker(video_id=video.id, display_index=2)
        session.add_all([sp1, sp2])
        session.flush()
        session.add_all([
            TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=1000, text="hey", speaker_id=sp1.id),
            TranscriptSegment(transcript_id=tx.id, start_ms=1000, end_ms=2000, text="yuu", speaker_id=sp1.id),
            TranscriptSegment(transcript_id=tx.id, start_ms=2000, end_ms=3000, text="what", speaker_id=sp2.id),
            TranscriptSegment(transcript_id=tx.id, start_ms=3000, end_ms=4000, text="ignored", speaker_id=None),
        ])
        session.commit()

        labeled = _labeled_transcript(session, video.id, {sp1.id: sp1, sp2.id: sp2})
        session.close()
        assert labeled == "Speaker 1: hey yuu\nSpeaker 2: what"


class TestVoiceprintNameSuggestions:
    """Feature B part 4: propagate a named voice's name to the unnamed voice it matches."""

    def _speaker(self, sid, index, vector, *, name=None, confirmed=True,
                 backend="speechbrain", suggested_match_id=None):
        from yuu_clip.transcribe.project_voice import serialize_voiceprint
        return Speaker(
            id=sid, video_id=1, display_index=index, name=name, confirmed=confirmed,
            voiceprint=serialize_voiceprint(vector) if vector else None,
            voiceprint_backend=backend if vector else None,
            suggested_match_id=suggested_match_id,
        )

    def test_propagates_nearest_named_voice(self):
        from yuu_clip.web.routes.speakers import _voiceprint_name_suggestions
        named = self._speaker(1, 1, [1.0, 0.0], name="Alex")
        unnamed = self._speaker(2, 2, [0.99, 0.01])
        assert _voiceprint_name_suggestions([named, unnamed]) == {"2": "Alex"}

    def test_seeds_from_existing_suggested_match(self):
        from yuu_clip.web.routes.speakers import _voiceprint_name_suggestions
        named = self._speaker(1, 1, [1.0, 0.0], name="Alex")
        # Orthogonal voice, but an already-recorded same-recording near-miss points at Alex.
        unnamed = self._speaker(2, 2, [0.0, 1.0], suggested_match_id=1)
        assert _voiceprint_name_suggestions([named, unnamed]) == {"2": "Alex"}

    def test_skips_below_floor(self):
        from yuu_clip.web.routes.speakers import _voiceprint_name_suggestions
        named = self._speaker(1, 1, [1.0, 0.0], name="Alex")
        unnamed = self._speaker(2, 2, [0.0, 1.0])  # cosine 0, no seed
        assert _voiceprint_name_suggestions([named, unnamed]) == {}

    def test_skips_cross_backend(self):
        from yuu_clip.web.routes.speakers import _voiceprint_name_suggestions
        named = self._speaker(1, 1, [1.0, 0.0], name="Alex", backend="pyannote")
        unnamed = self._speaker(2, 2, [0.99, 0.01], backend="speechbrain")
        assert _voiceprint_name_suggestions([named, unnamed]) == {}

    def test_named_speakers_are_not_targeted(self):
        from yuu_clip.web.routes.speakers import _voiceprint_name_suggestions
        a = self._speaker(1, 1, [1.0, 0.0], name="Alex")
        b = self._speaker(2, 2, [0.99, 0.01], name="Sam")
        assert _voiceprint_name_suggestions([a, b]) == {}


class TestApplyNameSuggestionsTwoPass:
    """The LLM pass is strict (no confirmed-name collision); the voiceprint pass
    (allow_confirmed_name) reuses a confirmed name for the same voice and fills only
    still-unnamed speakers - so the propagation actually applies instead of being a no-op."""

    def _speaker(self, index, **kw):
        return Speaker(video_id=1, display_index=index, **kw)

    def test_strict_pass_drops_confirmed_name_collision(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions
        a = self._speaker(1, name="Alex", confirmed=True)
        b = self._speaker(2)
        # LLM strict pass: "Alex" collides with a confirmed name -> dropped (no-op).
        assert _apply_name_suggestions([a, b], {"2": "Alex"}) == 0
        assert b.name is None

    def test_voiceprint_pass_applies_confirmed_name(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions
        a = self._speaker(1, name="Alex", confirmed=True)
        b = self._speaker(2)
        assert _apply_name_suggestions([a, b], {"2": "Alex"}, allow_confirmed_name=True) == 1
        assert b.name == "Alex"
        assert b.confirmed is False  # a suggestion, not auto-confirmed

    def test_voiceprint_pass_does_not_clobber_an_llm_name(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions
        a = self._speaker(1, name="Bob", confirmed=True)
        b = self._speaker(2, name="Guess", source="inferred", confirmed=False)  # LLM already named
        assert _apply_name_suggestions([a, b], {"2": "Bob"}, allow_confirmed_name=True) == 0
        assert b.name == "Guess"

    def test_separate_passes_do_not_cross_cancel(self):
        from yuu_clip.web.routes.speakers import _apply_name_suggestions
        # LLM proposes Casey for speaker 3; a separate voiceprint call for speaker 2 must
        # not pool into the same name-count and cancel it.
        a = self._speaker(1, name="Alex", confirmed=True)
        b = self._speaker(2)
        c = self._speaker(3)
        assert _apply_name_suggestions([a, b, c], {"3": "Casey"}) == 1
        assert c.name == "Casey"
        assert _apply_name_suggestions([a, b, c], {"2": "Alex"}, allow_confirmed_name=True) == 1
        assert b.name == "Alex"


class TestCascade:
    def test_deleting_video_cascades_speakers(self, tmp_path: Path):
        session = make_session(tmp_path / "c.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        session.add(Speaker(video_id=video.id, name="Yuu", display_index=1))
        session.commit()

        session.delete(video)
        session.commit()
        assert session.query(Speaker).count() == 0
        session.close()

    def test_deleting_video_with_person_exemplar_is_not_fk_blocked(self, tmp_path: Path):
        # Regression: a speaker that seeded a VoiceExemplar (promoted to a Person) must
        # not make its recording undeletable via the source_speaker_id FK.
        from yuu_clip.transcribe.project_voice import serialize_voiceprint
        session = make_session(tmp_path / "c.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()
        speaker = Speaker(video_id=video.id, name="Yuu", display_index=1,
                          voiceprint=serialize_voiceprint([1.0, 0.0]),
                          voiceprint_backend="speechbrain")
        session.add(speaker)
        session.flush()
        voice = ProjectVoice(name="Yuu", display_index=1)
        session.add(voice)
        session.flush()
        session.add(VoiceExemplar(project_voice_id=voice.id, voiceprint=speaker.voiceprint,
                                  voiceprint_backend="speechbrain", source_speaker_id=speaker.id))
        speaker.global_voice_id = voice.id
        session.commit()

        session.delete(video)
        session.commit()  # must not raise a FOREIGN KEY constraint error
        assert session.query(Speaker).count() == 0
        surviving = session.query(VoiceExemplar).one()
        assert surviving.source_speaker_id is None  # provenance nulled, exemplar kept
        session.close()
