"""API tests - caption segment editing (PUT /api/caption-segments/{id}).

Covers text update, speaker preservation, excerpt rebuild of overlapping clips,
re-score staleness flagging, and the seek-offset field for split recordings.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from yuu_clip.db.models import (
    AudioTrack,
    ClipCandidate,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
    make_session,
)


def _db(project_dir: Path):
    return make_session(project_dir / ".yuu-clip" / "project.db")


def _seed_transcript(session, with_speaker: bool = False):
    """Add a transcript with two segments to the fixture's combined track.

    seg A [1000,3000] overlaps clip 1 (0-60000ms); seg B [65000,67000] overlaps
    clip 2 (60000-120000ms). Returns (seg_a_id, seg_b_id, clip_ids).
    """
    video = session.query(Video).filter_by(parent_video_id=None).first()
    track = session.query(AudioTrack).filter_by(video_id=video.id).first()
    tx = Transcript(audio_track_id=track.id, model_name="base")
    session.add(tx)
    session.flush()

    speaker_id = None
    if with_speaker:
        speaker = Speaker(video_id=video.id, name="Yuu", display_index=1)
        session.add(speaker)
        session.flush()
        speaker_id = speaker.id

    seg_a = TranscriptSegment(
        transcript_id=tx.id, start_ms=1000, end_ms=3000, text="helo wrld",
        speaker_id=speaker_id,
    )
    seg_b = TranscriptSegment(
        transcript_id=tx.id, start_ms=65000, end_ms=67000, text="later line",
    )
    session.add_all([seg_a, seg_b])
    session.flush()
    clip_ids = [c.id for c in session.query(ClipCandidate).order_by(ClipCandidate.start_ms).all()]
    session.commit()
    return seg_a.id, seg_b.id, clip_ids, video.id


class TestUpdateCaptionSegment:
    def test_updates_text_and_returns_affected_clip(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _seg_b_id, clip_ids, _vid = _seed_transcript(session)
        session.close()

        res = client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "hello world"})
        assert res.status_code == 200
        data = res.json()
        assert data["text"] == "hello world"
        # seg A only overlaps the first clip (0-60000ms).
        assert data["affected_clip_ids"] == [clip_ids[0]]

        check = _db(project_dir)
        seg = check.get(TranscriptSegment, seg_a_id)
        assert seg.text == "hello world"
        check.close()

    def test_rebuilds_overlapping_clip_excerpt(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, clip_ids, _vid = _seed_transcript(session)
        session.close()

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "corrected name Yuu"})

        clip = client.get(f"/api/clips/{clip_ids[0]}").json()
        assert clip["transcript_excerpt"] == "corrected name Yuu"

    def test_preserves_speaker(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, _clips, _vid = _seed_transcript(session, with_speaker=True)
        session.close()

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "kept speaker"})

        check = _db(project_dir)
        seg = check.get(TranscriptSegment, seg_a_id)
        assert seg.speaker.display_name == "Yuu"
        assert seg.text == "kept speaker"
        check.close()

    def test_marks_clip_stale_when_edited_after_scoring(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, clip_ids, vid = _seed_transcript(session)
        video = session.get(Video, vid)
        video.clips_scored_at = datetime.now(timezone.utc) - timedelta(hours=1)
        session.commit()
        session.close()

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "edited after scoring"})

        clip = client.get(f"/api/clips/{clip_ids[0]}").json()
        assert clip["transcript_stale"] is True
        # The untouched clip 3 (120000-180000ms) is not flagged.
        other = client.get(f"/api/clips/{clip_ids[2]}").json()
        assert other["transcript_stale"] is False

    def test_not_stale_when_never_scored(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, clip_ids, _vid = _seed_transcript(session)
        session.close()

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "edit"})

        clip = client.get(f"/api/clips/{clip_ids[0]}").json()
        assert clip["transcript_stale"] is False

    def test_sets_video_transcript_edited_at(self, client, project_dir):
        # B16: drives the video-level "SRT sidecar is stale" badge.
        session = _db(project_dir)
        seg_a_id, _b, _clips, vid = _seed_transcript(session)
        assert session.get(Video, vid).transcript_edited_at is None
        session.close()

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "edit"})

        check = _db(project_dir)
        assert check.get(Video, vid).transcript_edited_at is not None
        check.close()

    def test_empty_text_rejected(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, _clips, _vid = _seed_transcript(session)
        session.close()

        res = client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "   "})
        assert res.status_code == 400

    def test_missing_segment_404(self, client):
        res = client.put("/api/caption-segments/999999", json={"text": "x"})
        assert res.status_code == 404

    def test_refreshes_existing_export_sidecar(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, clip_ids, _vid = _seed_transcript(session)
        session.close()
        clip = client.get(f"/api/clips/{clip_ids[0]}").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        stem = f"session_clip{clip_ids[0]}_{clip['start_hms'].replace(':', '-')}"
        srt = export_dir / f"{stem}.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nstale text\n\n", encoding="utf-8")

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "fresh text"})

        content = srt.read_text(encoding="utf-8")
        assert "fresh text" in content
        assert "stale text" not in content

    def test_does_not_create_sidecar_when_none_exists(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, _clip_ids, _vid = _seed_transcript(session)
        session.close()
        export_dir = project_dir / ".yuu-clip" / "exports"

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "no sidecar yet"})

        assert list(export_dir.glob("*.srt")) == []

    def test_english_edit_realigns_word_timings(self, client, project_dir, monkeypatch):
        session = _db(project_dir)
        seg_a_id, _b, _clips, _vid = _seed_transcript(session)
        seg = session.get(TranscriptSegment, seg_a_id)
        seg.transcript.language = "en"
        session.commit()
        session.close()

        aligned = [{"text": "hello", "start_ms": 1000, "end_ms": 1500},
                   {"text": "world", "start_ms": 1500, "end_ms": 2000}]
        monkeypatch.setattr(
            "yuu_clip.transcribe.align.realign_segment_words", lambda seg: aligned
        )

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "hello world"})

        check = _db(project_dir)
        seg = check.get(TranscriptSegment, seg_a_id)
        assert seg.words == aligned
        check.close()

    def test_non_english_edit_clears_word_timings(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, _clips, _vid = _seed_transcript(session)
        seg = session.get(TranscriptSegment, seg_a_id)
        seg.transcript.language = "es"
        seg.words = [{"text": "hola", "start_ms": 1000, "end_ms": 2000}]
        session.commit()
        session.close()

        client.put(f"/api/caption-segments/{seg_a_id}", json={"text": "hola mundo"})

        check = _db(project_dir)
        seg = check.get(TranscriptSegment, seg_a_id)
        assert seg.words_json is None
        check.close()


class TestTranscriptSeekOffset:
    def test_clip_transcript_lines_carry_seg_id(self, client, project_dir):
        session = _db(project_dir)
        seg_a_id, _b, clip_ids, _vid = _seed_transcript(session)
        session.close()

        data = client.get(f"/api/clips/{clip_ids[0]}/transcript").json()
        assert data["lines"]
        assert data["lines"][0]["seg_id"] == seg_a_id

    def test_video_transcript_offset_zero_for_normal_recording(self, client, project_dir):
        session = _db(project_dir)
        _a, _b, _clips, vid = _seed_transcript(session)
        session.close()

        data = client.get(f"/api/videos/{vid}/transcript").json()
        assert data["seek_offset_s"] == 0.0

    def test_video_transcript_offset_matches_split_segment_start(self, client, project_dir):
        session = _db(project_dir)
        parent = session.query(Video).filter_by(parent_video_id=None).first()
        segment = Video(
            path=parent.path, filename=parent.filename, status="done",
            duration_ms=60_000, parent_video_id=parent.id,
            segment_start_s=120.0, segment_end_s=180.0,
        )
        session.add(segment)
        session.flush()
        track = AudioTrack(video_id=segment.id, stream_index=1, label="combined", do_transcribe=True)
        session.add(track)
        session.flush()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=2000, text="seg start"))
        session.commit()
        seg_video_id = segment.id
        session.close()

        data = client.get(f"/api/videos/{seg_video_id}/transcript").json()
        assert data["seek_offset_s"] == 120.0
