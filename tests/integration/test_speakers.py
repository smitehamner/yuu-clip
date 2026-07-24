"""Speaker naming: client-bound route tests.

Pure model/migration logic and tmp-DB round-trips moved to
tests/unit/test_speakers.py."""
from __future__ import annotations

import json
from pathlib import Path

from yuu_clip.db.models import (
    AudioTrack,
    ClipCandidate,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
    VoiceExemplar,
    make_session,
)


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

    def test_rename_sets_transcript_edited_at_on_video_clips(self, client, project_dir):
        _video_id, speaker_id, clip_id = self._seed_speaker(project_dir)
        db = self._db(project_dir)
        assert db.get(ClipCandidate, clip_id).transcript_edited_at is None
        db.close()

        client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"})

        db = self._db(project_dir)
        assert db.get(ClipCandidate, clip_id).transcript_edited_at is not None
        db.close()

    def test_color_only_rename_does_not_set_transcript_edited_at(self, client, project_dir):
        """Color is cosmetic - it doesn't change any transcript text, so no clip
        should be flagged as needing a re-score or export refresh."""
        _video_id, speaker_id, clip_id = self._seed_speaker(project_dir)

        client.put(f"/api/speakers/{speaker_id}", json={"color": "#abcdef"})

        db = self._db(project_dir)
        assert db.get(ClipCandidate, clip_id).transcript_edited_at is None
        db.close()

    def test_rename_sets_video_transcript_edited_at(self, client, project_dir):
        # B16: drives the video-level "SRT sidecar is stale" badge.
        video_id, speaker_id, _clip_id = self._seed_speaker(project_dir)
        db = self._db(project_dir)
        assert db.get(Video, video_id).transcript_edited_at is None
        db.close()

        client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"})

        db = self._db(project_dir)
        assert db.get(Video, video_id).transcript_edited_at is not None
        db.close()

    def test_color_only_rename_does_not_set_video_transcript_edited_at(self, client, project_dir):
        video_id, speaker_id, _clip_id = self._seed_speaker(project_dir)

        client.put(f"/api/speakers/{speaker_id}", json={"color": "#abcdef"})

        db = self._db(project_dir)
        assert db.get(Video, video_id).transcript_edited_at is None
        db.close()

    def test_rename_refreshes_existing_export_sidecar(self, client, project_dir):
        _video_id, speaker_id, clip_id = self._seed_speaker(project_dir)
        clip = client.get(f"/api/clips/{clip_id}").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        stem = f"session_clip{clip_id}_{clip['start_hms'].replace(':', '-')}"
        srt = export_dir / f"{stem}.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nold text\n\n", encoding="utf-8")

        client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"})

        assert "Yuu" in srt.read_text(encoding="utf-8")

    def test_rename_does_not_create_sidecar_when_none_exists(self, client, project_dir):
        _video_id, speaker_id, _clip_id = self._seed_speaker(project_dir)
        export_dir = project_dir / ".yuu-clip" / "exports"

        client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"})

        assert list(export_dir.glob("*.srt")) == []


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

    def test_reassign_refreshes_existing_export_sidecar(self, client, project_dir):
        _, _, sp2, seg_id, clip_id, _ = self._seed(project_dir)
        clip = client.get(f"/api/clips/{clip_id}").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        stem = f"session_clip{clip_id}_{clip['start_hms'].replace(':', '-')}"
        srt = export_dir / f"{stem}.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nold text\n\n", encoding="utf-8")

        client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": sp2})

        assert "Mara" in srt.read_text(encoding="utf-8")

    def test_reassign_sets_video_transcript_edited_at(self, client, project_dir):
        # B16: drives the video-level "SRT sidecar is stale" badge.
        video_id, _, sp2, seg_id, _, _ = self._seed(project_dir)
        db = self._db(project_dir)
        assert db.get(Video, video_id).transcript_edited_at is None
        db.close()

        client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": sp2})

        db = self._db(project_dir)
        assert db.get(Video, video_id).transcript_edited_at is not None
        db.close()


class TestVoiceMatchRoutes:
    def _db(self, project_dir: Path):
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def _seed(self, project_dir: Path) -> tuple[int, int, int, int]:
        """Seed a named prior speaker with a voiceprint and a freshly-minted speaker
        that carries a borderline suggestion pointing at the prior, with one segment
        attributed to the new speaker and a clip overlapping it.

        Returns (video_id, prior_id, new_id, clip_id).
        """
        from yuu_clip.transcribe.speaker_attach import _serialize_voiceprint

        db = self._db(project_dir)
        video = db.query(Video).first()
        track = db.query(AudioTrack).filter_by(video_id=video.id).first()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        db.add(tx)
        db.flush()
        prior = Speaker(video_id=video.id, name="Yuu", display_index=1, confirmed=True,
                        voiceprint=_serialize_voiceprint([1.0, 0.0, 0.0]))
        db.add(prior)
        db.flush()
        new = Speaker(video_id=video.id, display_index=2,
                      voiceprint=_serialize_voiceprint([0.0, 1.0, 0.0]),
                      suggested_match_id=prior.id, suggested_match_score=0.7)
        db.add(new)
        db.flush()
        db.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=3000,
            text="let's go go go", speaker_label="SPEAKER_01", speaker_id=new.id,
        ))
        clip = db.query(ClipCandidate).filter_by(video_id=video.id).order_by(ClipCandidate.start_ms).first()
        db.commit()
        ids = (video.id, prior.id, new.id, clip.id)
        db.close()
        return ids

    def test_confirm_moves_segments_and_deletes_new_speaker(self, client, project_dir):
        _video_id, prior_id, new_id, _clip_id = self._seed(project_dir)
        resp = client.post(f"/api/speakers/{new_id}/confirm-match")
        assert resp.status_code == 200
        assert resp.json()["id"] == prior_id
        assert resp.json()["display_name"] == "Yuu"

        db = self._db(project_dir)
        assert db.get(Speaker, new_id) is None
        seg = db.query(TranscriptSegment).filter_by(speaker_label="SPEAKER_01").one()
        assert seg.speaker_id == prior_id
        db.close()

    def test_confirm_averages_voiceprints(self, client, project_dir):
        from yuu_clip.transcribe.speaker_attach import _deserialize_voiceprint
        _video_id, prior_id, new_id, _clip_id = self._seed(project_dir)
        client.post(f"/api/speakers/{new_id}/confirm-match")

        db = self._db(project_dir)
        merged = _deserialize_voiceprint(db.get(Speaker, prior_id).voiceprint)
        db.close()
        assert merged == [0.5, 0.5, 0.0]  # mean of [1,0,0] and [0,1,0]

    def test_confirm_rebuilds_overlapping_clip_excerpt(self, client, project_dir):
        _video_id, _prior_id, new_id, clip_id = self._seed(project_dir)
        client.post(f"/api/speakers/{new_id}/confirm-match")

        db = self._db(project_dir)
        excerpt = db.get(ClipCandidate, clip_id).transcript_excerpt
        db.close()
        assert excerpt == "Yuu: let's go go go"

    def test_reject_clears_suggestion_and_keeps_both(self, client, project_dir):
        _video_id, prior_id, new_id, _clip_id = self._seed(project_dir)
        resp = client.post(f"/api/speakers/{new_id}/reject-match")
        assert resp.status_code == 200
        assert resp.json()["suggested_match_id"] is None

        db = self._db(project_dir)
        assert db.get(Speaker, prior_id) is not None
        new = db.get(Speaker, new_id)
        assert new is not None
        assert new.suggested_match_score is None
        seg = db.query(TranscriptSegment).filter_by(speaker_label="SPEAKER_01").one()
        assert seg.speaker_id == new_id  # still separate
        db.close()

    def test_confirm_404_when_no_suggestion(self, client, project_dir):
        _video_id, prior_id, _new_id, _clip_id = self._seed(project_dir)
        assert client.post(f"/api/speakers/{prior_id}/confirm-match").status_code == 404

    def test_reject_404_when_no_suggestion(self, client, project_dir):
        _video_id, prior_id, _new_id, _clip_id = self._seed(project_dir)
        assert client.post(f"/api/speakers/{prior_id}/reject-match").status_code == 404

    def test_confirm_404_for_missing_speaker(self, client):
        assert client.post("/api/speakers/9999/confirm-match").status_code == 404

    def test_reject_404_for_missing_speaker(self, client):
        assert client.post("/api/speakers/9999/reject-match").status_code == 404

    def test_list_exposes_suggestion_with_prior_name(self, client, project_dir):
        video_id, prior_id, new_id, _clip_id = self._seed(project_dir)
        data = client.get(f"/api/videos/{video_id}/speakers").json()
        new_row = next(s for s in data if s["id"] == new_id)
        assert new_row["suggested_match_id"] == prior_id
        assert new_row["suggested_match_name"] == "Yuu"
        assert new_row["suggested_match_score"] == 0.7


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


class TestSpeakerEditingEndpoints:
    """Feature B: create-inline, whole-speaker merge, and bulk line reassignment."""

    def _db(self, project_dir: Path):
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def _seed_two_speakers(self, project_dir: Path):
        """Two speakers on the seeded video, each with one segment, plus an overlapping
        clip. Returns (video_id, speaker_a_id, speaker_b_id, seg_a_id, seg_b_id, clip_id)."""
        db = self._db(project_dir)
        video = db.query(Video).first()
        track = db.query(AudioTrack).filter_by(video_id=video.id).first()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        db.add(tx)
        db.flush()
        a = Speaker(video_id=video.id, display_index=1, name="Alex", confirmed=True)
        b = Speaker(video_id=video.id, display_index=2)
        db.add_all([a, b])
        db.flush()
        seg_a = TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=1500,
                                  text="first", speaker_label="SPEAKER_00", speaker_id=a.id)
        seg_b = TranscriptSegment(transcript_id=tx.id, start_ms=1500, end_ms=3000,
                                  text="second", speaker_label="SPEAKER_01", speaker_id=b.id)
        db.add_all([seg_a, seg_b])
        clip = db.query(ClipCandidate).filter_by(video_id=video.id).order_by(ClipCandidate.start_ms).first()
        db.commit()
        ids = (video.id, a.id, b.id, seg_a.id, seg_b.id, clip.id)
        db.close()
        return ids

    def test_create_speaker_mints_next_index(self, client, project_dir):
        video_id, _, _, _, _, _ = self._seed_two_speakers(project_dir)
        created = client.post(f"/api/videos/{video_id}/speakers", json={"name": "Casey"})
        assert created.status_code == 200
        body = created.json()
        assert body["display_name"] == "Casey"
        assert body["display_index"] == 3  # after the two seeded
        assert body["source"] == "manual"

    def test_create_speaker_rejects_bad_color(self, client, project_dir):
        video_id, *_ = self._seed_two_speakers(project_dir)
        resp = client.post(f"/api/videos/{video_id}/speakers", json={"color": "red"})
        assert resp.status_code == 400

    def test_create_speaker_404_missing_video(self, client):
        assert client.post("/api/videos/9999/speakers", json={"name": "X"}).status_code == 404

    def test_merge_into_moves_segments_and_deletes_source(self, client, project_dir):
        video_id, a_id, b_id, seg_a_id, seg_b_id, clip_id = self._seed_two_speakers(project_dir)
        # Merge b (unnamed) into a (Alex): both lines end up on Alex.
        resp = client.post(f"/api/speakers/{b_id}/merge-into/{a_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == a_id

        db = self._db(project_dir)
        try:
            assert db.get(Speaker, b_id) is None
            assert db.get(TranscriptSegment, seg_b_id).speaker_id == a_id
            assert "Alex: first second" in db.get(ClipCandidate, clip_id).transcript_excerpt
        finally:
            db.close()

    def test_merge_into_self_rejected(self, client, project_dir):
        _, a_id, _, _, _, _ = self._seed_two_speakers(project_dir)
        assert client.post(f"/api/speakers/{a_id}/merge-into/{a_id}").status_code == 400

    def test_merge_into_survives_when_source_seeded_a_person_exemplar(self, client, project_dir):
        # Regression: a VoiceExemplar.source_speaker_id FK must NOT block deleting the
        # merged-away speaker (ON DELETE SET NULL). Promote A to a Person (seeds an
        # exemplar referencing A), then whole-speaker-merge A into B.
        from yuu_clip.transcribe.project_voice import serialize_voiceprint
        _, a_id, b_id, _, _, _ = self._seed_two_speakers(project_dir)
        db = self._db(project_dir)
        a = db.get(Speaker, a_id)  # promote only seeds an exemplar for a voiceprinted speaker
        a.voiceprint = serialize_voiceprint([1.0, 0.0])
        a.voiceprint_backend = "speechbrain"
        db.commit()
        db.close()

        assert client.post("/api/voices", json={"speaker_id": a_id}).status_code == 200
        resp = client.post(f"/api/speakers/{a_id}/merge-into/{b_id}")
        assert resp.status_code == 200

        db = self._db(project_dir)
        try:
            assert db.get(Speaker, a_id) is None
            exemplars = db.query(VoiceExemplar).all()
            assert len(exemplars) == 1  # the exemplar survives the source deletion
            assert exemplars[0].source_speaker_id is None  # provenance nulled, not blocked
        finally:
            db.close()

    def test_merge_into_cross_video_rejected(self, client, project_dir):
        _, a_id, _, _, _, _ = self._seed_two_speakers(project_dir)
        db = self._db(project_dir)
        other_video = Video(path="o.mkv", filename="o.mkv", status="done")
        db.add(other_video)
        db.flush()
        other = Speaker(video_id=other_video.id, display_index=1)
        db.add(other)
        db.commit()
        other_id = other.id
        db.close()
        assert client.post(f"/api/speakers/{a_id}/merge-into/{other_id}").status_code == 400

    def test_reassign_segments_moves_selected_only(self, client, project_dir):
        video_id, a_id, b_id, seg_a_id, seg_b_id, clip_id = self._seed_two_speakers(project_dir)
        # Move Alex's one line onto b; b's line stays put.
        resp = client.put(f"/api/speakers/{a_id}/reassign-segments",
                          json={"seg_ids": [seg_a_id], "target_speaker_id": b_id})
        assert resp.status_code == 200
        assert resp.json()["reassigned"] == 1

        db = self._db(project_dir)
        try:
            assert db.get(TranscriptSegment, seg_a_id).speaker_id == b_id
            assert db.get(TranscriptSegment, seg_a_id).speaker_edited is True
            assert db.get(TranscriptSegment, seg_b_id).speaker_id == b_id  # unchanged (was b)
        finally:
            db.close()

    def test_reassign_segments_to_unassigned(self, client, project_dir):
        _, a_id, _, seg_a_id, _, _ = self._seed_two_speakers(project_dir)
        resp = client.put(f"/api/speakers/{a_id}/reassign-segments",
                          json={"seg_ids": [seg_a_id], "target_speaker_id": None})
        assert resp.status_code == 200
        db = self._db(project_dir)
        try:
            assert db.get(TranscriptSegment, seg_a_id).speaker_id is None
        finally:
            db.close()

    def test_reassign_segments_empty_rejected(self, client, project_dir):
        _, a_id, _, _, _, _ = self._seed_two_speakers(project_dir)
        assert client.put(f"/api/speakers/{a_id}/reassign-segments",
                          json={"seg_ids": []}).status_code == 400

    def test_reassign_segments_not_owned_rejected(self, client, project_dir):
        _, a_id, _, _, seg_b_id, _ = self._seed_two_speakers(project_dir)
        # seg_b belongs to b, not a - so nothing to move via a's endpoint.
        resp = client.put(f"/api/speakers/{a_id}/reassign-segments",
                          json={"seg_ids": [seg_b_id], "target_speaker_id": None})
        assert resp.status_code == 400
