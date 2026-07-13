"""People-view (ProjectVoice) route tests - promote / rename / merge / split / confirm.

Cross-recording identity: a Person ties one name across recordings via
Speaker.global_voice_id, resolved through the ORM so captions/excerpts/UI agree.
Matching only SUGGESTS; these routes are the only place global_voice_id is set.
"""
from __future__ import annotations

from pathlib import Path

from yuu_clip.db.models import (
    AudioTrack,
    ClipCandidate,
    ProjectVoice,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
    VoiceExemplar,
    make_session,
)
from yuu_clip.transcribe.project_voice import serialize_voiceprint


class _Fixtures:
    def _db(self, project_dir: Path):
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def _add_video(self, db, filename: str) -> Video:
        video = Video(path=f"/x/{filename}", filename=filename, status="done", duration_ms=60_000)
        db.add(video)
        db.flush()
        db.add(AudioTrack(video_id=video.id, stream_index=1, label="combined", do_transcribe=True))
        db.flush()
        return video

    def _add_speaker(self, db, video_id: int, vector, *, name=None, confirmed=True,
                     display_index=1, suggested_voice_id=None) -> Speaker:
        speaker = Speaker(
            video_id=video_id, display_index=display_index, name=name, confirmed=confirmed,
            voiceprint=serialize_voiceprint(vector) if vector else None,
            voiceprint_backend="speechbrain" if vector else None,
            suggested_voice_id=suggested_voice_id,
            suggested_voice_score=0.9 if suggested_voice_id else None,
        )
        db.add(speaker)
        db.flush()
        return speaker

    def _add_clip_with_segment(self, db, video_id: int, speaker_id: int) -> int:
        """A clip whose window overlaps a transcript segment attributed to *speaker_id*,
        so an excerpt rebuild driven by a display-name change is observable."""
        track = db.query(AudioTrack).filter_by(video_id=video_id).first()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        db.add(tx)
        db.flush()
        db.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=3000,
            text="clutch play", speaker_label="SPEAKER_00", speaker_id=speaker_id,
        ))
        clip = ClipCandidate(video_id=video_id, start_ms=0, end_ms=3000, score_overall=0.5)
        db.add(clip)
        db.flush()
        return clip.id

    def _mint_person(self, db, vector, *, name="Alex", display_index=1) -> ProjectVoice:
        voice = ProjectVoice(name=name, display_index=display_index, confirmed=True)
        db.add(voice)
        db.flush()
        db.add(VoiceExemplar(
            project_voice_id=voice.id,
            voiceprint=serialize_voiceprint(vector), voiceprint_backend="speechbrain",
        ))
        db.flush()
        return voice


class TestPromote(_Fixtures):
    def test_promote_creates_person_and_links_speaker(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        speaker = self._add_speaker(db, video.id, [1.0, 0.0], name="Alex")
        db.commit()
        speaker_id = speaker.id
        db.close()

        resp = client.post("/api/voices", json={"speaker_id": speaker_id})
        assert resp.status_code == 200
        body = resp.json()
        assert body["display_name"] == "Alex"
        assert body["member_count"] == 1

        db = self._db(project_dir)
        try:
            reloaded = db.get(Speaker, speaker_id)
            assert reloaded.global_voice_id == body["id"]
            exemplars = db.query(VoiceExemplar).filter_by(project_voice_id=body["id"]).count()
            assert exemplars == 1
        finally:
            db.close()

    def test_promote_rejects_already_linked_speaker(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        voice = self._mint_person(db, [1.0, 0.0])
        speaker = self._add_speaker(db, video.id, [1.0, 0.0])
        speaker.global_voice_id = voice.id
        db.commit()
        speaker_id = speaker.id
        db.close()

        resp = client.post("/api/voices", json={"speaker_id": speaker_id})
        assert resp.status_code == 400

    def test_promote_404_for_missing_speaker(self, client):
        assert client.post("/api/voices", json={"speaker_id": 9999}).status_code == 404


class TestRenamePropagates(_Fixtures):
    def test_rename_person_updates_member_display_and_excerpt(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        speaker = self._add_speaker(db, video.id, [1.0, 0.0], name="Alex")
        clip_id = self._add_clip_with_segment(db, video.id, speaker.id)
        db.commit()
        video_id, speaker_id = video.id, speaker.id
        db.close()

        voice = client.post("/api/voices", json={"speaker_id": speaker_id}).json()
        renamed = client.put(f"/api/voices/{voice['id']}", json={"name": "Alexandra"})
        assert renamed.status_code == 200
        assert renamed.json()["display_name"] == "Alexandra"

        # The member Speaker's effective display name now resolves through the Person.
        speakers = client.get(f"/api/videos/{video_id}/speakers").json()
        assert speakers[0]["display_name"] == "Alexandra"
        assert speakers[0]["person_name"] == "Alexandra"

        # And the overlapping clip's excerpt was rebuilt with the new name.
        db = self._db(project_dir)
        try:
            assert "Alexandra" in db.get(ClipCandidate, clip_id).transcript_excerpt
        finally:
            db.close()

    def test_rename_rejects_bad_color(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        speaker = self._add_speaker(db, video.id, [1.0, 0.0], name="Alex")
        db.commit()
        speaker_id = speaker.id
        db.close()
        voice = client.post("/api/voices", json={"speaker_id": speaker_id}).json()
        assert client.put(f"/api/voices/{voice['id']}", json={"color": "red"}).status_code == 400


class TestMerge(_Fixtures):
    def test_merge_repoints_members_and_moves_exemplars(self, client, project_dir):
        db = self._db(project_dir)
        va = self._add_video(db, "a.mkv")
        vb = self._add_video(db, "b.mkv")
        sa = self._add_speaker(db, va.id, [1.0, 0.0], name="Alex")
        sb = self._add_speaker(db, vb.id, [0.0, 1.0], name="Alex")
        db.commit()
        sa_id, sb_id = sa.id, sb.id
        db.close()

        target = client.post("/api/voices", json={"speaker_id": sa_id}).json()
        source = client.post("/api/voices", json={"speaker_id": sb_id}).json()

        resp = client.post(f"/api/voices/{target['id']}/merge", json={"other_id": source["id"]})
        assert resp.status_code == 200
        assert resp.json()["member_count"] == 2

        listed = client.get("/api/voices").json()
        assert [v["id"] for v in listed] == [target["id"]]  # source gone

        db = self._db(project_dir)
        try:
            assert db.query(VoiceExemplar).filter_by(project_voice_id=target["id"]).count() == 2
            assert db.get(ProjectVoice, source["id"]) is None
            assert db.get(Speaker, sb_id).global_voice_id == target["id"]
        finally:
            db.close()

    def test_self_merge_rejected(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        speaker = self._add_speaker(db, video.id, [1.0, 0.0], name="Alex")
        db.commit()
        speaker_id = speaker.id
        db.close()
        voice = client.post("/api/voices", json={"speaker_id": speaker_id}).json()
        resp = client.post(f"/api/voices/{voice['id']}/merge", json={"other_id": voice["id"]})
        assert resp.status_code == 400


class TestSplit(_Fixtures):
    def test_split_detaches_member_and_removes_its_exemplar(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        speaker = self._add_speaker(db, video.id, [1.0, 0.0], name="Alex")
        db.commit()
        speaker_id = speaker.id
        db.close()

        voice = client.post("/api/voices", json={"speaker_id": speaker_id}).json()
        resp = client.post(f"/api/voices/{voice['id']}/split", json={"speaker_id": speaker_id})
        assert resp.status_code == 200
        assert resp.json()["new_voice"] is None

        db = self._db(project_dir)
        try:
            assert db.get(Speaker, speaker_id).global_voice_id is None
            assert db.query(VoiceExemplar).filter_by(
                project_voice_id=voice["id"], source_speaker_id=speaker_id).count() == 0
        finally:
            db.close()

    def test_split_with_mint_new_creates_person(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        speaker = self._add_speaker(db, video.id, [1.0, 0.0], name="Alex")
        db.commit()
        speaker_id = speaker.id
        db.close()

        voice = client.post("/api/voices", json={"speaker_id": speaker_id}).json()
        resp = client.post(f"/api/voices/{voice['id']}/split",
                           json={"speaker_id": speaker_id, "mint_new": True})
        body = resp.json()
        assert body["new_voice"] is not None

        db = self._db(project_dir)
        try:
            assert db.get(Speaker, speaker_id).global_voice_id == body["new_voice"]["id"]
        finally:
            db.close()

    def test_split_non_member_rejected(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        member = self._add_speaker(db, video.id, [1.0, 0.0], name="Alex", display_index=1)
        stranger = self._add_speaker(db, video.id, [0.0, 1.0], display_index=2)
        db.commit()
        member_id, stranger_id = member.id, stranger.id
        db.close()
        voice = client.post("/api/voices", json={"speaker_id": member_id}).json()
        resp = client.post(f"/api/voices/{voice['id']}/split", json={"speaker_id": stranger_id})
        assert resp.status_code == 400


class TestConfirmRejectVoice(_Fixtures):
    def test_confirm_links_speaker_and_adds_exemplar(self, client, project_dir):
        db = self._db(project_dir)
        vb = self._add_video(db, "b.mkv")
        voice = self._mint_person(db, [1.0, 0.0])
        # A second-recording speaker carrying an unconfirmed suggestion for that Person.
        speaker = self._add_speaker(db, vb.id, [0.99, 0.01], suggested_voice_id=voice.id)
        db.commit()
        voice_id, speaker_id = voice.id, speaker.id
        db.close()

        resp = client.post(f"/api/speakers/{speaker_id}/confirm-voice")
        assert resp.status_code == 200

        db = self._db(project_dir)
        try:
            reloaded = db.get(Speaker, speaker_id)
            assert reloaded.global_voice_id == voice_id
            assert reloaded.suggested_voice_id is None
            # Drift accumulation: the confirmed speaker's print becomes a new exemplar.
            assert db.query(VoiceExemplar).filter_by(project_voice_id=voice_id).count() == 2
        finally:
            db.close()

    def test_confirm_404_without_suggestion(self, client, project_dir):
        db = self._db(project_dir)
        video = self._add_video(db, "a.mkv")
        speaker = self._add_speaker(db, video.id, [1.0, 0.0])
        db.commit()
        speaker_id = speaker.id
        db.close()
        assert client.post(f"/api/speakers/{speaker_id}/confirm-voice").status_code == 404

    def test_reject_clears_suggestion_without_linking(self, client, project_dir):
        db = self._db(project_dir)
        vb = self._add_video(db, "b.mkv")
        voice = self._mint_person(db, [1.0, 0.0])
        speaker = self._add_speaker(db, vb.id, [0.99, 0.01], suggested_voice_id=voice.id)
        db.commit()
        speaker_id = speaker.id
        db.close()

        assert client.post(f"/api/speakers/{speaker_id}/reject-voice").status_code == 200

        db = self._db(project_dir)
        try:
            reloaded = db.get(Speaker, speaker_id)
            assert reloaded.suggested_voice_id is None
            assert reloaded.global_voice_id is None
        finally:
            db.close()


class TestBackfill(_Fixtures):
    def test_clusters_same_voice_and_keeps_others_separate(self, client, project_dir):
        db = self._db(project_dir)
        v1 = self._add_video(db, "1.mkv")
        v2 = self._add_video(db, "2.mkv")
        v3 = self._add_video(db, "3.mkv")
        v4 = self._add_video(db, "4.mkv")
        # Three near-identical "Alex" voices + one different, all named the same "Alex"
        # except the odd one out, which is a different voice.
        self._add_speaker(db, v1.id, [1.0, 0.0], name="Alex")
        self._add_speaker(db, v2.id, [0.99, 0.01], name="Alex")
        self._add_speaker(db, v3.id, [0.98, 0.02], name="Alex")
        self._add_speaker(db, v4.id, [0.0, 1.0], name="Sam")
        db.commit()
        db.close()

        resp = client.post("/api/voices/backfill")
        assert resp.status_code == 200
        assert resp.json() == {"created": 2, "speakers_clustered": 4}

        listed = client.get("/api/voices").json()
        alex = next(v for v in listed if v["display_name"] == "Alex")
        assert alex["member_count"] == 3
        assert alex["confirmed"] is False  # backfill lands unconfirmed for review

        db = self._db(project_dir)
        try:
            assert db.query(VoiceExemplar).filter_by(project_voice_id=alex["id"]).count() == 3
        finally:
            db.close()

    def test_name_conflict_within_cluster_leaves_name_unset(self, client, project_dir):
        db = self._db(project_dir)
        v1 = self._add_video(db, "1.mkv")
        v2 = self._add_video(db, "2.mkv")
        # Same voice, but named differently in each recording -> a conflict.
        self._add_speaker(db, v1.id, [1.0, 0.0], name="Alex")
        self._add_speaker(db, v2.id, [0.99, 0.01], name="Alexander")
        db.commit()
        db.close()

        client.post("/api/voices/backfill")
        listed = client.get("/api/voices").json()
        assert len(listed) == 1
        assert listed[0]["is_named"] is False  # never guesses on a conflict
        assert listed[0]["member_count"] == 2

    def test_rerun_is_idempotent(self, client, project_dir):
        db = self._db(project_dir)
        v1 = self._add_video(db, "1.mkv")
        self._add_speaker(db, v1.id, [1.0, 0.0], name="Alex")
        db.commit()
        db.close()

        first = client.post("/api/voices/backfill").json()
        assert first["created"] == 1
        second = client.post("/api/voices/backfill").json()
        assert second == {"created": 0, "speakers_clustered": 0}
        assert len(client.get("/api/voices").json()) == 1


class TestListVoices(_Fixtures):
    def test_list_reports_members_and_suggestions(self, client, project_dir):
        db = self._db(project_dir)
        va = self._add_video(db, "a.mkv")
        vb = self._add_video(db, "b.mkv")
        voice = self._mint_person(db, [1.0, 0.0], name="Alex")
        member = self._add_speaker(db, va.id, [1.0, 0.0], name="Alex")
        member.global_voice_id = voice.id
        self._add_speaker(db, vb.id, [0.99, 0.01], suggested_voice_id=voice.id)
        db.commit()
        voice_id = voice.id
        db.close()

        listed = client.get("/api/voices").json()
        entry = next(v for v in listed if v["id"] == voice_id)
        assert entry["member_count"] == 1
        assert entry["suggestion_count"] == 1
        assert entry["members"][0]["video_filename"] == "a.mkv"
