"""Speaker model + migration tests (Phase 1 of speaker naming)."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import text

from yuu_clip.db.models import (
    AudioTrack,
    ClipCandidate,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
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
        from yuu_clip.transcribe.whisper_runner import _attach_speakers

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
        from yuu_clip.transcribe.whisper_runner import _attach_speakers

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
        from yuu_clip.transcribe.whisper_runner import _attach_speakers

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
        from yuu_clip.transcribe.whisper_runner import _attach_speakers, _deserialize_voiceprint

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
        from yuu_clip.transcribe.whisper_runner import _attach_speakers

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

    def test_distinct_voice_mints_new_speaker(self, tmp_path: Path):
        from yuu_clip.transcribe.whisper_runner import _attach_speakers

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

    def test_two_clusters_do_not_collapse_onto_one_prior(self, tmp_path: Path):
        from yuu_clip.transcribe.whisper_runner import _attach_speakers

        session = make_session(tmp_path / "v.db")
        video = Video(path="x.mkv", filename="x.mkv", status="done")
        session.add(video)
        session.flush()

        # Prior run: one named speaker with a voiceprint.
        tx1 = self._seed_transcript(session, video.id, "SPEAKER_00")
        _attach_speakers(session, video.id, tx1.id, {"SPEAKER_00": [1.0, 0.0, 0.0]})
        session.query(Speaker).one().name = "Yuu"
        session.flush()

        # New run with two clusters both similar to Yuu — only one may re-attach.
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


class TestSpeakerRoutes:
    def _db(self, project_dir: Path):
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def _seed_speaker(self, project_dir: Path) -> tuple[int, int, int]:
        """Attach a transcript + one segment + a Speaker to the seeded video.

        Returns (video_id, speaker_id, clip_id) where clip_id's window overlaps
        the segment so excerpt rebuild can be asserted.
        """
        db = self._db(project_dir)
        video = db.query(Video).first()
        track = db.query(AudioTrack).filter_by(video_id=video.id).first()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        db.add(tx)
        db.flush()
        speaker = Speaker(video_id=video.id, display_index=1)
        db.add(speaker)
        db.flush()
        db.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=3000,
            text="let's go go go", speaker_label="SPEAKER_00", speaker_id=speaker.id,
        ))
        clip = db.query(ClipCandidate).filter_by(video_id=video.id).order_by(ClipCandidate.start_ms).first()
        db.commit()
        ids = (video.id, speaker.id, clip.id)
        db.close()
        return ids

    def test_list_empty_when_no_speakers(self, client):
        resp = client.get("/api/videos/1/speakers")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_404_for_missing_video(self, client):
        assert client.get("/api/videos/9999/speakers").status_code == 404

    def test_list_returns_display_name_and_sample(self, client, project_dir):
        video_id, _, _ = self._seed_speaker(project_dir)
        data = client.get(f"/api/videos/{video_id}/speakers").json()
        assert len(data) == 1
        assert data[0]["display_name"] == "Speaker 1"
        assert data[0]["is_named"] is False
        assert data[0]["sample_text"] == "let's go go go"
        assert data[0]["sample_start_ms"] == 0
        assert data[0]["sample_end_ms"] == 3000

    def test_rename_sets_and_clears_name(self, client, project_dir):
        _, speaker_id, _ = self._seed_speaker(project_dir)

        named = client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"}).json()
        assert named["display_name"] == "Yuu"
        assert named["is_named"] is True

        cleared = client.put(f"/api/speakers/{speaker_id}", json={"name": "  "}).json()
        assert cleared["display_name"] == "Speaker 1"
        assert cleared["is_named"] is False

    def test_rename_404_for_missing_speaker(self, client):
        assert client.put("/api/speakers/9999", json={"name": "X"}).status_code == 404

    def test_list_returns_default_palette_color(self, client, project_dir):
        video_id, _, _ = self._seed_speaker(project_dir)
        data = client.get(f"/api/videos/{video_id}/speakers").json()
        from yuu_clip.db.models import SPEAKER_COLOR_PALETTE
        assert data[0]["color"] == SPEAKER_COLOR_PALETTE[0]  # display_index 1

    def test_set_color_persists(self, client, project_dir):
        _, speaker_id, _ = self._seed_speaker(project_dir)
        updated = client.put(f"/api/speakers/{speaker_id}", json={"color": "#abcdef"}).json()
        assert updated["color"] == "#abcdef"

    def test_clear_color_reverts_to_palette_default(self, client, project_dir):
        _, speaker_id, _ = self._seed_speaker(project_dir)
        client.put(f"/api/speakers/{speaker_id}", json={"color": "#abcdef"})
        cleared = client.put(f"/api/speakers/{speaker_id}", json={"color": ""}).json()
        from yuu_clip.db.models import SPEAKER_COLOR_PALETTE
        assert cleared["color"] == SPEAKER_COLOR_PALETTE[0]

    def test_invalid_color_rejected(self, client, project_dir):
        _, speaker_id, _ = self._seed_speaker(project_dir)
        resp = client.put(f"/api/speakers/{speaker_id}", json={"color": "not-a-color"})
        assert resp.status_code == 400

    def test_color_only_update_does_not_clear_name(self, client, project_dir):
        _, speaker_id, _ = self._seed_speaker(project_dir)
        client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"})
        updated = client.put(f"/api/speakers/{speaker_id}", json={"color": "#abcdef"}).json()
        assert updated["name"] == "Yuu"
        assert updated["color"] == "#abcdef"

    def test_name_only_update_does_not_touch_color(self, client, project_dir):
        _, speaker_id, _ = self._seed_speaker(project_dir)
        client.put(f"/api/speakers/{speaker_id}", json={"color": "#abcdef"})
        updated = client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"}).json()
        assert updated["color"] == "#abcdef"

    def test_rename_rebuilds_clip_excerpt(self, client, project_dir):
        video_id, speaker_id, clip_id = self._seed_speaker(project_dir)
        client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"})

        db = self._db(project_dir)
        excerpt = db.get(ClipCandidate, clip_id).transcript_excerpt
        db.close()
        assert excerpt == "Yuu: let's go go go"

    def test_clip_transcript_lines_resolve_name_and_relative_time(self, client, project_dir):
        _, speaker_id, clip_id = self._seed_speaker(project_dir)
        client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"})

        lines = client.get(f"/api/clips/{clip_id}/transcript").json()["lines"]
        assert len(lines) == 1
        assert lines[0]["speaker"] == "Yuu"
        assert lines[0]["text"] == "let's go go go"
        assert lines[0]["start_ms"] == 0  # clip-relative (clip starts at 0)

    def test_clip_transcript_lines_expose_speaker_id_unedited_by_default(self, client, project_dir):
        _, speaker_id, clip_id = self._seed_speaker(project_dir)
        lines = client.get(f"/api/clips/{clip_id}/transcript").json()["lines"]
        assert lines[0]["speaker_id"] == speaker_id
        assert lines[0]["speaker_edited"] is False

    def test_video_transcript_lines_fallback_name_and_absolute_time(self, client, project_dir):
        video_id, _, _ = self._seed_speaker(project_dir)
        lines = client.get(f"/api/videos/{video_id}/transcript").json()["lines"]
        assert len(lines) == 1
        assert lines[0]["speaker"] == "Speaker 1"  # unnamed → display fallback
        assert lines[0]["text"] == "let's go go go"
        assert lines[0]["start_ms"] == 0

    def test_video_transcript_404_for_missing_video(self, client):
        assert client.get("/api/videos/9999/transcript").status_code == 404

    def test_clip_transcript_lines_include_speaker_color(self, client, project_dir):
        _, speaker_id, clip_id = self._seed_speaker(project_dir)
        client.put(f"/api/speakers/{speaker_id}", json={"color": "#abcdef"})

        lines = client.get(f"/api/clips/{clip_id}/transcript").json()["lines"]
        assert lines[0]["color"] == "#abcdef"

    def test_video_transcript_lines_default_color_when_unset(self, client, project_dir):
        video_id, _, _ = self._seed_speaker(project_dir)
        lines = client.get(f"/api/videos/{video_id}/transcript").json()["lines"]
        from yuu_clip.db.models import SPEAKER_COLOR_PALETTE
        assert lines[0]["color"] == SPEAKER_COLOR_PALETTE[0]


class TestReassignSegmentSpeaker:
    def _db(self, project_dir: Path):
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def _seed(self, project_dir: Path) -> tuple[int, int, int, int, int, int]:
        """Seed a segment attributed to sp1, a second speaker (sp2), a clip that
        overlaps the segment, and a speaker on a *different* video.

        Returns (video_id, sp1_id, sp2_id, seg_id, clip_id, other_video_speaker_id).
        """
        db = self._db(project_dir)
        video = db.query(Video).first()
        track = db.query(AudioTrack).filter_by(video_id=video.id).first()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        db.add(tx)
        db.flush()
        sp1 = Speaker(video_id=video.id, display_index=1)
        sp2 = Speaker(video_id=video.id, name="Mara", display_index=2, confirmed=True)
        db.add_all([sp1, sp2])
        db.flush()
        seg = TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=3000,
            text="let's go go go", speaker_label="SPEAKER_00", speaker_id=sp1.id,
        )
        db.add(seg)
        db.flush()
        other_video = Video(path="o.mkv", filename="o.mkv", status="done")
        db.add(other_video)
        db.flush()
        other_sp = Speaker(video_id=other_video.id, display_index=1)
        db.add(other_sp)
        db.flush()
        clip = db.query(ClipCandidate).filter_by(video_id=video.id).order_by(ClipCandidate.start_ms).first()
        db.commit()
        ids = (video.id, sp1.id, sp2.id, seg.id, clip.id, other_sp.id)
        db.close()
        return ids

    def test_reassign_sets_speaker_and_marks_edited(self, client, project_dir):
        _, _, sp2, seg_id, clip_id, _ = self._seed(project_dir)
        resp = client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": sp2})
        assert resp.status_code == 200
        data = resp.json()
        assert data["speaker_id"] == sp2
        assert data["speaker"] == "Mara"
        assert data["speaker_edited"] is True
        assert clip_id in data["affected_clip_ids"]

    def test_reassign_rebuilds_excerpt_with_new_speaker(self, client, project_dir):
        _, _, sp2, seg_id, clip_id, _ = self._seed(project_dir)
        client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": sp2})
        db = self._db(project_dir)
        excerpt = db.get(ClipCandidate, clip_id).transcript_excerpt
        db.close()
        assert excerpt == "Mara: let's go go go"

    def test_detach_clears_speaker(self, client, project_dir):
        _, _, _, seg_id, _, _ = self._seed(project_dir)
        data = client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": None}).json()
        assert data["speaker_id"] is None
        assert data["speaker"] is None
        assert data["speaker_edited"] is True

    def test_404_for_missing_segment(self, client):
        resp = client.put("/api/transcript-segments/9999/speaker", json={"speaker_id": None})
        assert resp.status_code == 404

    def test_400_for_speaker_from_other_video(self, client, project_dir):
        _, _, _, seg_id, _, other_sp = self._seed(project_dir)
        resp = client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": other_sp})
        assert resp.status_code == 400

    def test_transcript_lines_expose_speaker_id_and_edited(self, client, project_dir):
        _, _, sp2, seg_id, clip_id, _ = self._seed(project_dir)
        client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": sp2})
        lines = client.get(f"/api/clips/{clip_id}/transcript").json()["lines"]
        assert lines[0]["speaker_id"] == sp2
        assert lines[0]["speaker_edited"] is True


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


class TestInferNamesRoute:
    def _db(self, project_dir: Path):
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def _seed(self, project_dir: Path) -> int:
        db = self._db(project_dir)
        video = db.query(Video).first()
        track = db.query(AudioTrack).filter_by(video_id=video.id).first()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        db.add(tx)
        db.flush()
        speaker = Speaker(video_id=video.id, display_index=1)
        db.add(speaker)
        db.flush()
        db.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=3000,
            text="hey yuu nice one", speaker_id=speaker.id,
        ))
        db.commit()
        video_id = video.id
        db.close()
        return video_id

    def _patch_llm(self, monkeypatch, suggestions):
        import yuu_clip.scoring.llm as llm
        monkeypatch.setattr(llm, "check_llm_available", lambda config: (True, ""))
        monkeypatch.setattr(llm, "infer_speaker_names",
                            lambda labeled, config, context_text="": suggestions)

    def _drain(self, client, video_id):
        """Consume the SSE stream, returning the list of decoded data messages."""
        messages = []
        with client.stream("GET", f"/api/videos/{video_id}/infer-speaker-names") as resp:
            assert resp.status_code == 200
            assert resp.headers["content-type"].startswith("text/event-stream")
            for raw in resp.iter_lines():
                if raw.startswith("data: "):
                    messages.append(json.loads(raw[len("data: "):]))
        return messages

    def test_404_for_missing_video(self, client):
        assert client.get("/api/videos/9999/infer-speaker-names").status_code == 404

    def test_400_when_no_speakers(self, client):
        assert client.get("/api/videos/1/infer-speaker-names").status_code == 400

    def test_400_when_llm_unavailable(self, client, project_dir, monkeypatch):
        video_id = self._seed(project_dir)
        import yuu_clip.scoring.llm as llm
        monkeypatch.setattr(llm, "check_llm_available", lambda config: (False, "LLM off"))
        resp = client.get(f"/api/videos/{video_id}/infer-speaker-names")
        assert resp.status_code == 400
        assert resp.json()["detail"] == "LLM off"

    def test_streams_done_with_applied_count(self, client, project_dir, monkeypatch):
        video_id = self._seed(project_dir)
        self._patch_llm(monkeypatch, {"1": "Yuu"})
        messages = self._drain(client, video_id)
        assert messages[-1] == {"type": "__DONE__", "suggested": 1}

    def test_applies_suggestion_as_unconfirmed(self, client, project_dir, monkeypatch):
        video_id = self._seed(project_dir)
        self._patch_llm(monkeypatch, {"1": "Yuu"})
        self._drain(client, video_id)

        speaker = client.get(f"/api/videos/{video_id}/speakers").json()[0]
        assert speaker["name"] == "Yuu"
        assert speaker["source"] == "inferred"
        assert speaker["confirmed"] is False
        # Unconfirmed suggestion must not become the display name until accepted.
        assert speaker["display_name"] == "Speaker 1"

    def test_accepting_suggestion_confirms_name(self, client, project_dir, monkeypatch):
        video_id = self._seed(project_dir)
        self._patch_llm(monkeypatch, {"1": "Yuu"})
        self._drain(client, video_id)
        speaker_id = client.get(f"/api/videos/{video_id}/speakers").json()[0]["id"]

        accepted = client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"}).json()
        assert accepted["display_name"] == "Yuu"
        assert accepted["confirmed"] is True


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
