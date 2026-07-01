"""Speaker model + migration tests (Phase 1 of speaker naming)."""
from __future__ import annotations

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
        assert "speaker_id" in _column_names(engine, "transcript_segments")
        with engine.connect() as conn:
            tables = {row[0] for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )}
        assert "speakers" in tables


class TestSpeakerModel:
    def test_display_name_uses_name_then_fallback(self, tmp_path: Path):
        named = Speaker(video_id=1, name="Yuu", display_index=1)
        unnamed = Speaker(video_id=1, name=None, display_index=2)
        assert named.display_name == "Yuu"
        assert unnamed.display_name == "Speaker 2"

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

    def test_video_transcript_lines_fallback_name_and_absolute_time(self, client, project_dir):
        video_id, _, _ = self._seed_speaker(project_dir)
        lines = client.get(f"/api/videos/{video_id}/transcript").json()["lines"]
        assert len(lines) == 1
        assert lines[0]["speaker"] == "Speaker 1"  # unnamed → display fallback
        assert lines[0]["text"] == "let's go go go"
        assert lines[0]["start_ms"] == 0

    def test_video_transcript_404_for_missing_video(self, client):
        assert client.get("/api/videos/9999/transcript").status_code == 404


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
