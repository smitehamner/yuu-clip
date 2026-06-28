from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# Videos
# ---------------------------------------------------------------------------

class TestVideos:
    def test_list_videos_returns_seeded_video(self, client):
        r = client.get("/api/videos")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["filename"] == "session.mkv"
        assert data[0]["clip_count"] == 3
        assert data[0]["approved"] == 1

    def test_list_clips_for_video(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/clips")
        assert r.status_code == 200
        clips = r.json()
        assert len(clips) == 3
        # Should be sorted by score descending
        scores = [c["score_overall"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_filter_by_status(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/clips?status=approved")
        assert r.status_code == 200
        clips = r.json()
        assert len(clips) == 1
        assert clips[0]["status"] == "approved"


# ---------------------------------------------------------------------------
# Clips
# ---------------------------------------------------------------------------

class TestClips:
    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_get_clip_detail(self, client):
        clip_id = self._first_clip_id(client)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        d = r.json()
        assert "score_overall" in d
        assert "description" in d
        assert "transcript_excerpt" in d

    def test_get_clip_404(self, client):
        r = client.get("/api/clips/99999")
        assert r.status_code == 404

    def test_set_clip_status_approve(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/status", json={"status": "approved"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"
        r2 = client.get(f"/api/clips/{clip_id}")
        assert r2.json()["status"] == "approved"

    def test_set_clip_status_invalid(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/status", json={"status": "maybe"})
        assert r.status_code == 400

    def test_clip_media_url_no_export(self, client):
        clip_id = self._first_clip_id(client)
        r = client.get(f"/api/clips/{clip_id}/media_url")
        assert r.status_code == 200
        assert r.json()["url"] is None  # not exported yet


# ---------------------------------------------------------------------------
# Clips — sort and has_export
# ---------------------------------------------------------------------------

class TestClipsExtended:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_list_clips_sort_timeline(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/videos/{vid_id}/clips?sort=timeline")
        assert r.status_code == 200
        clips = r.json()
        start_ms_list = [c["start_ms"] for c in clips]
        assert start_ms_list == sorted(start_ms_list)

    def test_list_clips_sort_score_is_default(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        scores = [c["score_overall"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_has_export_field(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        for c in clips:
            assert "has_export" in c
            assert c["has_export"] is False  # no export files in temp dir

    def test_has_export_true_when_file_exists(self, client, project_dir):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        export_file = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mkv"
        export_file.write_bytes(b"fake video content")
        # Re-fetch — file now exists on disk
        clips2 = client.get(f"/api/videos/{vid_id}/clips").json()
        match = next(x for x in clips2 if x["id"] == c["id"])
        assert match["has_export"] is True

    def test_clip_detail_has_has_export(self, client):
        vid_id = self._vid_id(client)
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        assert "has_export" in r.json()


# ---------------------------------------------------------------------------
# Additional API route gap coverage
# ---------------------------------------------------------------------------

class TestListClipsAdditional:
    """Cover gaps in list_clips: 404 for unknown video, sub-score sorts."""

    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_list_clips_404_for_unknown_video(self, client):
        r = client.get("/api/videos/99999/clips")
        assert r.status_code == 404

    def test_list_clips_sort_funny(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=funny").json()
        scores = [c["score_funny"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_sort_dramatic(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=dramatic").json()
        scores = [c["score_dramatic"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_sort_action(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=action").json()
        scores = [c["score_action"] for c in clips]
        assert scores == sorted(scores, reverse=True)

    def test_list_clips_unknown_sort_falls_back_to_score(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=bogus").json()
        scores = [c["score_overall"] for c in clips]
        assert scores == sorted(scores, reverse=True)


# ---------------------------------------------------------------------------
# Single video detail
# ---------------------------------------------------------------------------

class TestVideoDetail:
    def test_get_video_returns_detail(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == vid_id
        assert d["filename"] == "session.mkv"
        assert "timeline" in d

    def test_get_video_404(self, client):
        r = client.get("/api/videos/99999")
        assert r.status_code == 404

    def test_patch_video_contexts(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.patch(f"/api/videos/{vid_id}/contexts", json={"context_names": ["ctx-a", "ctx-b"]})
        assert r.status_code == 200
        assert r.json()["context_names"] == ["ctx-a", "ctx-b"]
        d = client.get(f"/api/videos/{vid_id}").json()
        assert d["context_names"] == ["ctx-a", "ctx-b"]

    def test_patch_video_contexts_404(self, client):
        r = client.patch("/api/videos/99999/contexts", json={"context_names": []})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Delete video and clips
# ---------------------------------------------------------------------------

class TestDelete:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_delete_clip_removes_record(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        clip_id = clips[0]["id"]
        r = client.delete(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        assert r.json()["deleted"] == clip_id
        remaining = client.get(f"/api/videos/{vid_id}/clips").json()
        assert not any(c["id"] == clip_id for c in remaining)

    def test_delete_clip_404(self, client):
        r = client.delete("/api/clips/99999")
        assert r.status_code == 404

    def test_delete_video_removes_video_and_clips(self, client):
        vid_id = self._vid_id(client)
        r = client.delete(f"/api/videos/{vid_id}")
        assert r.status_code == 200
        assert r.json()["deleted"] == vid_id
        videos = client.get("/api/videos").json()
        assert not any(v["id"] == vid_id for v in videos)

    def test_delete_video_404(self, client):
        r = client.delete("/api/videos/99999")
        assert r.status_code == 404


class TestDeleteSrtCleanup:
    """Deleting a clip or video also removes SRT sidecars."""

    def test_delete_clip_removes_srt_file(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        base = f"session_clip{c['id']}_{start_hms_dashes}"
        srt_file = export_dir / f"{base}.srt"
        srt_file.write_text("1\n00:00:01,000 --> 00:00:02,000\nHi\n\n", encoding="utf-8")
        assert srt_file.exists()
        client.delete(f"/api/clips/{c['id']}")
        assert not srt_file.exists()

    def test_delete_video_removes_srt_files(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        srt_files = []
        for c in clips:
            start_hms_dashes = c["start_hms"].replace(":", "-")
            base = f"session_clip{c['id']}_{start_hms_dashes}"
            f = export_dir / f"{base}.srt"
            f.write_text("1\n00:00:01,000 --> 00:00:02,000\nHi\n\n", encoding="utf-8")
            srt_files.append(f)
        client.delete(f"/api/videos/{vid_id}")
        for f in srt_files:
            assert not f.exists(), f"{f.name} should have been deleted"


class TestDeleteExportCleanup:
    def test_delete_clip_removes_export_file(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        export_file = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mkv"
        export_file.write_bytes(b"fake video")
        assert export_file.exists()
        client.delete(f"/api/clips/{c['id']}")
        assert not export_file.exists()

    def test_delete_video_removes_export_files(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        files = []
        for c in clips:
            start_hms_dashes = c["start_hms"].replace(":", "-")
            f = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mkv"
            f.write_bytes(b"fake video")
            files.append(f)
        client.delete(f"/api/videos/{vid_id}")
        for f in files:
            assert not f.exists(), f"{f.name} should have been deleted"


class TestVideoDetailFields:
    """Confirm _video_dict serializes all expected fields."""

    def test_video_detail_includes_duration_and_status_fields(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        d = client.get(f"/api/videos/{vid_id}").json()
        for field in (
            "id", "filename", "status", "duration_hms", "duration_ms",
            "clip_count", "approved", "total_clip_ms",
            "title", "summary", "has_timeline", "context_names",
            "clips_scored_at", "summarized_at", "timeline_generated_at",
        ):
            assert field in d, f"missing field: {field}"

    def test_video_list_includes_total_clip_ms(self, client):
        videos = client.get("/api/videos").json()
        assert len(videos) == 1
        v = videos[0]
        assert "total_clip_ms" in v
        assert v["total_clip_ms"] > 0

    def test_video_list_has_timeline_false_initially(self, client):
        videos = client.get("/api/videos").json()
        assert videos[0]["has_timeline"] is False


class TestSetClipStatusAllValues:
    """Confirm all three valid statuses are accepted."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_set_status_pending(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/status", json={"status": "pending"})
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_set_status_rejected(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/status", json={"status": "rejected"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_set_status_404_for_missing_clip(self, client):
        r = client.post("/api/clips/99999/status", json={"status": "pending"})
        assert r.status_code == 404


class TestVideoListEditableFields:
    def test_video_list_includes_editable_field_keys(self, client):
        v = client.get("/api/videos").json()[0]
        for key in ("title_is_edited", "title_original", "summary_is_edited", "summary_original"):
            assert key in v, f"missing key: {key}"

    def test_title_is_edited_false_when_no_user_override(self, client):
        v = client.get("/api/videos").json()[0]
        assert v["title_is_edited"] is False
        assert v["summary_is_edited"] is False


class TestEditableVideoFields:
    """PATCH /api/videos/{id}/fields — accept_new, accept_edit, revert."""

    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def _seed_title_summary(self, project_dir, title="LLM Title", summary="LLM Summary"):
        from yuu_clip.db.models import Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            v = session.query(Video).first()
            v.title   = title
            v.summary = summary
            session.commit()
        finally:
            session.close()

    def test_accept_new_overwrites_title_clears_user(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_new", "field": "title", "new_title": "Brand New Title",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "Brand New Title"
        assert d["title_is_edited"] is False
        assert d["title_original"] == "Brand New Title"

    def test_accept_edit_sets_user_title_preserves_original(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "title", "new_title": "My Edit",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "My Edit"
        assert d["title_is_edited"] is True
        assert d["title_original"] == "LLM Title"

    def test_revert_title_clears_user_edit(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "title", "new_title": "My Edit",
        })
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "revert", "field": "title",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "LLM Title"
        assert d["title_is_edited"] is False

    def test_accept_edit_summary_preserves_original(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "summary", "new_summary": "Edited summary",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["summary"] == "Edited summary"
        assert d["summary_is_edited"] is True
        assert d["summary_original"] == "LLM Summary"

    def test_invalid_action_returns_400(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "bad_action", "field": "title",
        })
        assert r.status_code == 400

    def test_invalid_field_returns_400(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "revert", "field": "unknown_field",
        })
        assert r.status_code == 400

    def test_patch_video_fields_404(self, client):
        r = client.patch("/api/videos/99999/fields", json={"action": "revert", "field": "title"})
        assert r.status_code == 404


class TestEditableClipFields:
    """PATCH /api/clips/{id}/fields — accept_new, accept_edit, revert."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_accept_edit_sets_description_user(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "description",
            "new_description": "My custom description",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["description"] == "My custom description"
        assert d["description_is_edited"] is True

    def test_accept_new_overwrites_description_clears_user(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_new", "field": "description",
            "new_description": "New LLM description",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["description"] == "New LLM description"
        assert d["description_is_edited"] is False
        assert d["description_original"] == "New LLM description"

    def test_revert_description_clears_user_edit(self, client):
        clip_id = self._first_clip_id(client)
        orig = client.get(f"/api/clips/{clip_id}").json()["description"]
        client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "description", "new_description": "My edit",
        })
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "revert", "field": "description",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["description"] == orig
        assert d["description_is_edited"] is False

    def test_user_override_shown_as_description_in_get(self, client):
        """GET /api/clips/{id} must surface the user override as 'description'."""
        clip_id = self._first_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "description",
            "new_description": "Override value",
        })
        d = client.get(f"/api/clips/{clip_id}").json()
        assert d["description"] == "Override value"
        assert d["description_original"] != "Override value"
        assert d["description_is_edited"] is True

    def test_patch_clip_fields_404(self, client):
        r = client.patch("/api/clips/99999/fields", json={"action": "revert", "field": "description"})
        assert r.status_code == 404

    def test_invalid_action_returns_400(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "zap", "field": "description",
        })
        assert r.status_code == 400


class TestVideoContextsEmpty:
    def test_patch_video_contexts_empty_list_clears(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        # First assign some contexts
        client.patch(f"/api/videos/{vid_id}/contexts", json={"context_names": ["ctx-a"]})
        # Then clear them
        r = client.patch(f"/api/videos/{vid_id}/contexts", json={"context_names": []})
        assert r.status_code == 200
        assert r.json()["context_names"] == []
        # Persisted
        d = client.get(f"/api/videos/{vid_id}").json()
        assert d["context_names"] == []


class TestResetApprovals:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_reset_approvals_sets_all_clips_to_pending(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/reset-approvals")
        assert r.status_code == 200
        d = r.json()
        assert "reset" in d
        assert d["reset"] >= 1  # seeded with 1 approved + 1 rejected
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        assert all(c["status"] == "pending" for c in clips)

    def test_reset_approvals_count_excludes_already_pending(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/reset-approvals")
        assert r.json()["reset"] == 2  # exactly the approved + rejected seeds

    def test_reset_approvals_404(self, client):
        r = client.post("/api/videos/99999/reset-approvals")
        assert r.status_code == 404


class TestVideoInfoProperties:
    def _make_info(self, duration_ms, n_audio=1):
        from yuu_clip.analyze.probe import VideoInfo, AudioStreamInfo
        from pathlib import Path
        streams = [
            AudioStreamInfo(
                stream_index=i, codec_name="aac", sample_rate=48000,
                channels=2, channel_layout="stereo", duration_ms=None, title_tag=None,
            )
            for i in range(n_audio)
        ]
        return VideoInfo(
            path=Path("fake.mkv"), duration_ms=duration_ms,
            fps=60.0, width=1920, height=1080, audio_streams=streams,
        )

    def test_has_multiple_audio_tracks_false_for_one(self):
        assert self._make_info(1000, n_audio=1).has_multiple_audio_tracks is False

    def test_has_multiple_audio_tracks_true_for_two(self):
        assert self._make_info(1000, n_audio=2).has_multiple_audio_tracks is True

    def test_duration_hms_minutes_only(self):
        # 5m 30s = 330 000 ms
        info = self._make_info(330_000)
        assert info.duration_hms == "5m 30s"

    def test_duration_hms_with_hours(self):
        # 1h 2m 3s = 3723000 ms
        info = self._make_info(3_723_000)
        assert info.duration_hms == "1h 02m 03s"

    def test_duration_hms_zero(self):
        info = self._make_info(0)
        assert info.duration_hms == "0m 00s"


class TestRelatedClips:
    """Tests for the related-clips endpoint and related_clips fields in clip dict."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_clip_dict_includes_related_clips_fields(self, client):
        clip_id = self._first_clip_id(client)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        d = r.json()
        assert "related_clips" in d
        assert "related_clips_at" in d
        assert "related_clips_stale" in d
        assert d["related_clips"] is None
        assert d["related_clips_at"] is None
        assert d["related_clips_stale"] is False

    def test_related_clips_404_for_unknown_clip(self, client):
        r = client.get("/api/clips/99999/related-clips")
        assert r.status_code == 404

    def test_related_clips_400_when_no_description(self, client, project_dir):
        from yuu_clip.db.models import ClipCandidate, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[-1]["id"]
        clip = session.get(ClipCandidate, clip_id)
        clip.description = None
        clip.description_long = None
        clip.description_user = None
        clip.description_long_user = None
        session.commit()
        session.close()

        r = client.get(f"/api/clips/{clip_id}/related-clips")
        assert r.status_code == 400
        assert "description" in r.json()["detail"].lower()

    def test_related_clips_503_when_llm_disabled(self, client):
        clip_id = self._first_clip_id(client)
        r = client.get(f"/api/clips/{clip_id}/related-clips")
        assert r.status_code == 503

    def test_related_clips_400_for_invalid_video_ids(self, client, project_dir):
        from yuu_clip.db.models import ClipCandidate, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]
        clip = session.get(ClipCandidate, clip_id)
        clip.description_long = "A test description for similarity search."
        session.commit()
        session.close()

        r = client.get(f"/api/clips/{clip_id}/related-clips?video_ids=not-a-number")
        assert r.status_code == 400

    def test_related_clips_stale_when_scored_after(self, client, project_dir):
        """related_clips_stale is True when related_clips_at < video.clips_scored_at."""
        from datetime import datetime, timezone, timedelta
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

        now = datetime.now(timezone.utc)
        clip = session.get(ClipCandidate, clip_id)
        clip.related_clips_json = "[]"
        clip.related_clips_at = now - timedelta(hours=1)
        video = session.get(Video, vid_id)
        video.clips_scored_at = now
        session.commit()
        session.close()

        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["related_clips_stale"] is True

    def test_related_clips_not_stale_when_scored_before(self, client, project_dir):
        from datetime import datetime, timezone, timedelta
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

        now = datetime.now(timezone.utc)
        clip = session.get(ClipCandidate, clip_id)
        clip.related_clips_json = "[]"
        clip.related_clips_at = now
        video = session.get(Video, vid_id)
        video.clips_scored_at = now - timedelta(hours=1)
        session.commit()
        session.close()

        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["related_clips_stale"] is False


class TestSplitVideo:
    def _video_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_split_happy_path(self, client):
        vid_id = self._video_id(client)
        r = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0, 300.0]})
        assert r.status_code == 200
        data = r.json()
        assert len(data["segment_ids"]) == 3

    def test_split_idempotent_resplit(self, client):
        vid_id = self._video_id(client)
        # Split once into 2 segments
        r1 = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0]})
        assert r1.status_code == 200
        assert len(r1.json()["segment_ids"]) == 2
        # Re-split with different points — should succeed and produce new segment count
        r2 = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [180.0, 360.0]})
        assert r2.status_code == 200
        assert len(r2.json()["segment_ids"]) == 3
        # Sidebar should show 3 segments, not the parent
        visible = client.get("/api/videos").json()
        assert not any(v["id"] == vid_id for v in visible)
        assert len([v for v in visible if v.get("parent_video_id") == vid_id]) == 3

    def test_split_bad_points_rejected(self, client):
        vid_id = self._video_id(client)
        # Point at 0 or beyond duration should 400
        r = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [0.0]})
        assert r.status_code == 400
        r2 = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [99999.0]})
        assert r2.status_code == 400

    def test_split_cannot_split_a_segment(self, client):
        vid_id = self._video_id(client)
        r = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0]})
        seg_id = r.json()["segment_ids"][0]
        r2 = client.post(f"/api/videos/{seg_id}/split", json={"split_points": [60.0]})
        assert r2.status_code == 400

    def test_sidebar_hides_parent_after_split(self, client):
        vid_id = self._video_id(client)
        # Before split: parent is visible
        before = client.get("/api/videos").json()
        assert any(v["id"] == vid_id for v in before)

        # After split: parent is hidden, segments are shown
        client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0]})
        after = client.get("/api/videos").json()
        assert not any(v["id"] == vid_id for v in after)
        # Both segments are visible
        assert len([v for v in after if v.get("parent_video_id") == vid_id]) == 2

    def test_segment_has_expected_fields(self, client):
        vid_id = self._video_id(client)
        client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0]})
        segs = client.get("/api/videos").json()
        s = segs[0]
        assert s["parent_video_id"] == vid_id
        assert s["segment_start_s"] is not None
        assert s["segment_end_s"] is not None
        assert s["segment_end_s"] > s["segment_start_s"]


class TestClearClips:
    def _setup(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return vid_id

    def test_clear_all_clips(self, client):
        vid_id = self._setup(client)
        r = client.post(f"/api/videos/{vid_id}/clips/clear", json={"keep_exported": False})
        assert r.status_code == 200
        assert r.json()["deleted"] == 3
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        assert clips == []

    def test_clear_keeps_exported_clips(self, client, project_dir):
        from yuu_clip.config import project_db_path
        from yuu_clip.db.models import ClipCandidate, make_session

        vid_id = self._setup(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        clip_id = clips[0]["id"]

        # Set one clip to "exported" directly in the DB
        db = make_session(project_db_path(project_dir))
        try:
            clip = db.get(ClipCandidate, clip_id)
            clip.status = "exported"
            db.commit()
        finally:
            db.close()

        r = client.post(f"/api/videos/{vid_id}/clips/clear", json={"keep_exported": True})
        assert r.status_code == 200
        assert r.json()["deleted"] == 2  # 3 total, 1 exported kept
        remaining = client.get(f"/api/videos/{vid_id}/clips").json()
        assert len(remaining) == 1
        assert remaining[0]["id"] == clip_id

    def test_clear_404_on_missing_video(self, client):
        r = client.post("/api/videos/99999/clips/clear", json={"keep_exported": False})
        assert r.status_code == 404


class TestMediaUrl:
    """Cover the exported-file path through clip_media_url."""

    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_media_url_returns_url_when_file_exists(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        export_file = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.mkv"
        export_file.write_bytes(b"fake video")
        r = client.get(f"/api/clips/{clip['id']}/media_url")
        assert r.status_code == 200
        d = r.json()
        assert d["url"] is not None
        assert d["url"].endswith(".mkv")
        assert d["has_captions"] is False

    def test_media_url_has_captions_true_when_srt_exists(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        base = f"session_clip{clip['id']}_{start_hms_dashes}"
        (export_dir / f"{base}.mkv").write_bytes(b"fake video")
        (export_dir / f"{base}.srt").write_text(
            "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n", encoding="utf-8"
        )
        r = client.get(f"/api/clips/{clip['id']}/media_url")
        assert r.status_code == 200
        assert r.json()["has_captions"] is True
