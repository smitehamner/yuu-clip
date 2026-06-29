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

    def test_accept_new_title_null_returns_400(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_new", "field": "title", "new_title": None,
        })
        assert r.status_code == 400

    def test_accept_edit_title_null_returns_400(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "title", "new_title": None,
        })
        assert r.status_code == 400

    def test_accept_new_summary_null_returns_400(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_new", "field": "summary", "new_summary": None,
        })
        assert r.status_code == 400

    def test_accept_edit_summary_null_returns_400(self, client, project_dir):
        self._seed_title_summary(project_dir)
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "summary", "new_summary": None,
        })
        assert r.status_code == 400


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

    def test_accept_new_description_null_returns_400(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_new", "field": "description", "new_description": None,
        })
        assert r.status_code == 400

    def test_accept_edit_description_null_returns_400(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "description", "new_description": None,
        })
        assert r.status_code == 400

    def test_accept_new_description_long_null_returns_400(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_new", "field": "description_long", "new_description_long": None,
        })
        assert r.status_code == 400

    def test_accept_edit_description_long_null_returns_400(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "description_long", "new_description_long": None,
        })
        assert r.status_code == 400


class TestAcceptNewTitleOnlyDoesNotStampSummarizedAt:
    """accept_new with field='title' must not touch summarized_at or summary_context_json."""

    def test_summarized_at_not_set_when_only_title_accepted(self, client, project_dir):
        from yuu_clip.db.models import Video, make_session

        # Seed a known summarized_at value
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            v = db.query(Video).first()
            v.title = "LLM Title"
            v.summary = "LLM Summary"
            v.summarized_at = None
            v.summary_context_json = None
            db.commit()
        finally:
            db.close()

        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_new", "field": "title", "new_title": "Accepted Title",
        })
        assert r.status_code == 200

        db2 = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            v = db2.query(Video).first()
            assert v.summarized_at is None, "summarized_at must not be set when only title was accepted"
            assert v.summary_context_json is None
        finally:
            db2.close()

    def test_summarized_at_set_when_summary_accepted(self, client, project_dir):
        from yuu_clip.db.models import Video, make_session

        db = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            v = db.query(Video).first()
            v.title = "LLM Title"
            v.summary = "LLM Summary"
            v.summarized_at = None
            db.commit()
        finally:
            db.close()

        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_new", "field": "summary", "new_summary": "Accepted Summary",
        })
        assert r.status_code == 200

        db2 = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            v = db2.query(Video).first()
            assert v.summarized_at is not None
        finally:
            db2.close()


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
        from pathlib import Path

        from yuu_clip.analyze.probe import AudioStreamInfo, VideoInfo
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
        from datetime import datetime, timedelta, timezone

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
        from datetime import datetime, timedelta, timezone

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

    def test_split_two_points_produces_three_segments(self, client):
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
        seg_ids = client.post(
            f"/api/videos/{vid_id}/split", json={"split_points": [120.0]}
        ).json()["segment_ids"]
        segs = {s["id"]: s for s in client.get("/api/videos").json()}
        s = segs[seg_ids[0]]
        assert s["parent_video_id"] == vid_id
        assert s["segment_start_s"] == pytest.approx(0.0)
        assert s["segment_end_s"] == pytest.approx(120.0)
        assert s["segment_end_s"] > s["segment_start_s"]


class TestSplitVideoFields:
    """Verify the arithmetic and field values produced by split_video."""

    def _video_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_split_404_for_unknown_video(self, client):
        r = client.post("/api/videos/99999/split", json={"split_points": [60.0]})
        assert r.status_code == 404

    def test_segment_duration_ms_correct(self, client):
        vid_id = self._video_id(client)
        # Seed duration_ms is 600_000 ms (600 s). Split at 120 s → [0–120, 120–600].
        r = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0]})
        assert r.status_code == 200
        seg_ids = r.json()["segment_ids"]
        segs = {s["id"]: s for s in client.get("/api/videos").json()}
        assert segs[seg_ids[0]]["duration_ms"] == 120_000
        assert segs[seg_ids[1]]["duration_ms"] == 480_000

    def test_segment_start_end_seconds_exact(self, client):
        vid_id = self._video_id(client)
        r = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0, 300.0]})
        seg_ids = r.json()["segment_ids"]
        segs = {s["id"]: s for s in client.get("/api/videos").json()}
        assert segs[seg_ids[0]]["segment_start_s"] == pytest.approx(0.0)
        assert segs[seg_ids[0]]["segment_end_s"] == pytest.approx(120.0)
        assert segs[seg_ids[1]]["segment_start_s"] == pytest.approx(120.0)
        assert segs[seg_ids[1]]["segment_end_s"] == pytest.approx(300.0)
        assert segs[seg_ids[2]]["segment_start_s"] == pytest.approx(300.0)
        assert segs[seg_ids[2]]["segment_end_s"] == pytest.approx(600.0)

    def test_segment_default_title_format(self, client):
        vid_id = self._video_id(client)
        r = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0]})
        seg_ids = r.json()["segment_ids"]
        segs = {s["id"]: s for s in client.get("/api/videos").json()}
        # filename is "session.mkv", stem is "session"
        assert segs[seg_ids[0]]["title"] == "session — Part 1"
        assert segs[seg_ids[1]]["title"] == "session — Part 2"

    def test_segment_named_title_from_request(self, client):
        vid_id = self._video_id(client)
        r = client.post(f"/api/videos/{vid_id}/split", json={
            "split_points": [120.0],
            "segment_names": ["Intro", "Main"],
        })
        seg_ids = r.json()["segment_ids"]
        segs = {s["id"]: s for s in client.get("/api/videos").json()}
        assert segs[seg_ids[0]]["title"] == "Intro"
        assert segs[seg_ids[1]]["title"] == "Main"

    def test_segment_partial_names_falls_back_to_default(self, client):
        vid_id = self._video_id(client)
        # Provide only one name for a two-segment split; second gets default
        r = client.post(f"/api/videos/{vid_id}/split", json={
            "split_points": [120.0],
            "segment_names": ["Intro"],
        })
        seg_ids = r.json()["segment_ids"]
        segs = {s["id"]: s for s in client.get("/api/videos").json()}
        assert segs[seg_ids[0]]["title"] == "Intro"
        assert segs[seg_ids[1]]["title"] == "session — Part 2"

    def test_duplicate_split_points_deduplicated(self, client):
        vid_id = self._video_id(client)
        # Two identical points should collapse to one split → two segments
        r = client.post(f"/api/videos/{vid_id}/split", json={"split_points": [120.0, 120.0]})
        assert r.status_code == 200
        assert len(r.json()["segment_ids"]) == 2

    def test_get_video_returns_segment_fields_for_segment(self, client):
        vid_id = self._video_id(client)
        seg_id = client.post(
            f"/api/videos/{vid_id}/split", json={"split_points": [120.0]}
        ).json()["segment_ids"][0]
        d = client.get(f"/api/videos/{seg_id}").json()
        assert d["parent_video_id"] == vid_id
        assert d["segment_start_s"] == pytest.approx(0.0)
        assert d["segment_end_s"] == pytest.approx(120.0)


class TestSplitVideoOrphanCleanup:
    """Re-splitting an analyzed segment must not orphan or FK-violate clips."""

    def test_resplit_after_clips_exist_on_segment(self, client, project_dir):
        from yuu_clip.db.models import ClipCandidate, make_session

        vid_id = client.get("/api/videos").json()[0]["id"]
        # First split
        seg_ids = client.post(
            f"/api/videos/{vid_id}/split", json={"split_points": [120.0]}
        ).json()["segment_ids"]

        # Simulate a clip having been generated for the first segment
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            db.add(ClipCandidate(
                video_id=seg_ids[0],
                start_ms=0, end_ms=30_000,
                score_overall=0.5, score_funny=0.0,
                score_dramatic=0.0, score_action=0.0,
                status="pending",
            ))
            db.commit()
        finally:
            db.close()

        # Re-split — should not raise FK violation or leave orphan clips
        r = client.post(
            f"/api/videos/{vid_id}/split", json={"split_points": [180.0, 360.0]}
        )
        assert r.status_code == 200
        assert len(r.json()["segment_ids"]) == 3

        # The clip on the now-deleted segment must be gone
        db2 = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            orphan = db2.query(ClipCandidate).filter_by(video_id=seg_ids[0]).first()
            assert orphan is None
        finally:
            db2.close()


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

        # Mark one clip as exported the way the real export flow does — by
        # stamping exported_at, not by inventing a status the pipeline never sets.
        from datetime import datetime, timezone
        db = make_session(project_db_path(project_dir))
        try:
            clip = db.get(ClipCandidate, clip_id)
            clip.exported_at = datetime.now(timezone.utc)
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

    def test_media_url_404_for_unknown_clip(self, client):
        r = client.get("/api/clips/99999/media_url")
        assert r.status_code == 404

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


class TestAutoApprove:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_auto_approve_approves_clips_above_threshold(self, client):
        vid_id = self._vid_id(client)
        # Seed: scores 0.85 pending, 0.60 approved, 0.20 rejected
        # Only the 0.85 pending clip should be approved
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.80})
        assert r.status_code == 200
        assert r.json()["approved"] == 1
        clips = client.get(f"/api/videos/{vid_id}/clips?status=approved").json()
        assert len(clips) == 2  # 1 originally approved + 1 newly approved

    def test_auto_approve_only_touches_pending_clips(self, client):
        vid_id = self._vid_id(client)
        # Low threshold: would nominally match all scores, but auto_approve only
        # touches pending clips — the 0.60 approved and 0.20 rejected are skipped.
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.0})
        assert r.status_code == 200
        assert r.json()["approved"] == 1  # only the 0.85 pending clip qualifies

    def test_auto_approve_zero_when_threshold_above_all_scores(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.99})
        assert r.status_code == 200
        assert r.json()["approved"] == 0

    def test_auto_approve_sub_score_field(self, client):
        vid_id = self._vid_id(client)
        # score_funny = score * 0.9; clip 1 funny ≈ 0.765, clip 3 funny ≈ 0.18
        r = client.post(
            f"/api/videos/{vid_id}/auto-approve",
            json={"threshold": 0.70, "score_field": "funny"},
        )
        assert r.status_code == 200
        assert r.json()["approved"] == 1

    def test_auto_approve_invalid_threshold(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 1.5})
        assert r.status_code == 400

    def test_auto_approve_invalid_score_field(self, client):
        vid_id = self._vid_id(client)
        r = client.post(
            f"/api/videos/{vid_id}/auto-approve",
            json={"threshold": 0.5, "score_field": "vibes"},
        )
        assert r.status_code == 400

    def test_auto_approve_404(self, client):
        r = client.post("/api/videos/99999/auto-approve", json={"threshold": 0.5})
        assert r.status_code == 404


class TestClipScoreOverride:
    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_set_score_override(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/score-override", json={"score_overall_user": 0.75})
        assert r.status_code == 200
        assert r.json()["score_overall_user"] == pytest.approx(0.75, abs=1e-3)

    def test_score_override_clamped_to_0_1(self, client):
        clip_id = self._first_clip_id(client)
        r = client.post(f"/api/clips/{clip_id}/score-override", json={"score_overall_user": 1.5})
        assert r.status_code == 200
        assert r.json()["score_overall_user"] == pytest.approx(1.0, abs=1e-3)

        r2 = client.post(f"/api/clips/{clip_id}/score-override", json={"score_overall_user": -0.1})
        assert r2.status_code == 200
        assert r2.json()["score_overall_user"] == pytest.approx(0.0, abs=1e-3)

    def test_score_override_persisted_on_get(self, client):
        clip_id = self._first_clip_id(client)
        client.post(f"/api/clips/{clip_id}/score-override", json={"score_overall_user": 0.42})
        d = client.get(f"/api/clips/{clip_id}").json()
        assert d["score_overall_user"] == pytest.approx(0.42, abs=1e-3)

    def test_clear_score_override(self, client):
        clip_id = self._first_clip_id(client)
        client.post(f"/api/clips/{clip_id}/score-override", json={"score_overall_user": 0.5})
        r = client.post(f"/api/clips/{clip_id}/score-override", json={"score_overall_user": None})
        assert r.status_code == 200
        assert r.json()["score_overall_user"] is None
        assert client.get(f"/api/clips/{clip_id}").json()["score_overall_user"] is None

    def test_score_override_404(self, client):
        r = client.post("/api/clips/99999/score-override", json={"score_overall_user": 0.5})
        assert r.status_code == 404


class TestMergeClips:
    def _clips_by_timeline(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips?sort=timeline").json()

    def test_merge_extends_range_and_deletes_clip_b(self, client):
        clips = self._clips_by_timeline(client)
        a, b = clips[0], clips[1]
        r = client.post(f"/api/clips/{a['id']}/merge", json={"clip_b_id": b["id"]})
        assert r.status_code == 200
        merged = r.json()
        assert merged["start_ms"] == min(a["start_ms"], b["start_ms"])
        assert merged["end_ms"] == max(a["end_ms"], b["end_ms"])
        # clip_b should be gone
        assert client.get(f"/api/clips/{b['id']}").status_code == 404

    def test_merge_clip_b_not_found_returns_404(self, client):
        clips = self._clips_by_timeline(client)
        clip_a_id = clips[0]["id"]
        r = client.post(f"/api/clips/{clip_a_id}/merge", json={"clip_b_id": 99999})
        assert r.status_code == 404

    def test_merge_clips_from_different_videos_rejected(self, client, project_dir):
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            v2 = Video(path="/other/video.mkv", filename="other.mkv", status="done", duration_ms=60_000)
            db.add(v2)
            db.flush()
            clip_b = ClipCandidate(
                video_id=v2.id, start_ms=0, end_ms=10_000,
                score_overall=0.5, score_funny=0.0, score_dramatic=0.0, score_action=0.0,
                status="pending",
            )
            db.add(clip_b)
            db.commit()
            clip_b_id = clip_b.id
        finally:
            db.close()

        clip_a_id = self._clips_by_timeline(client)[0]["id"]
        r = client.post(f"/api/clips/{clip_a_id}/merge", json={"clip_b_id": clip_b_id})
        assert r.status_code == 400

    def test_merge_self_rejected(self, client):
        clips = self._clips_by_timeline(client)
        clip_id = clips[0]["id"]
        r = client.post(f"/api/clips/{clip_id}/merge", json={"clip_b_id": clip_id})
        assert r.status_code == 400

    def test_merge_clip_a_404(self, client):
        r = client.post("/api/clips/99999/merge", json={"clip_b_id": 1})
        assert r.status_code == 404

    def test_merge_resets_export_metadata(self, client):
        clips = self._clips_by_timeline(client)
        a, b = clips[0], clips[1]
        r = client.post(f"/api/clips/{a['id']}/merge", json={"clip_b_id": b["id"]})
        assert r.status_code == 200
        merged = r.json()
        assert merged["exported_at"] is None
        assert merged["exported_container"] is None


class TestClipTiming:
    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_update_timing_persisted(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/timing", json={"start_offset": -1.5, "end_offset": 2.0})
        assert r.status_code == 200
        d = r.json()
        assert d["start_offset"] == pytest.approx(-1.5)
        assert d["end_offset"] == pytest.approx(2.0)
        detail = client.get(f"/api/clips/{clip_id}").json()
        assert detail["start_offset"] == pytest.approx(-1.5)
        assert detail["end_offset"] == pytest.approx(2.0)

    def test_update_timing_zero_offsets(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/timing", json={"start_offset": 0.0, "end_offset": 0.0})
        assert r.status_code == 200
        d = r.json()
        assert d["start_offset"] == pytest.approx(0.0)
        assert d["end_offset"] == pytest.approx(0.0)

    def test_update_timing_404(self, client):
        r = client.patch("/api/clips/99999/timing", json={"start_offset": 0.0, "end_offset": 0.0})
        assert r.status_code == 404


class TestConfig:
    def test_get_config_returns_expected_fields(self, client):
        r = client.get("/api/config")
        assert r.status_code == 200
        d = r.json()
        for field in (
            "whisper_model", "whisper_device", "whisper_compute_type",
            "llm_backend", "scorer_energy_weight", "scorer_scene_weight", "scorer_llm_weight",
            "ui_timeline_interval_seconds",
        ):
            assert field in d, f"missing config field: {field}"

    def test_patch_config_updates_field(self, client):
        r = client.patch("/api/config", json={"whisper_device": "cpu"})
        assert r.status_code == 200
        assert r.json()["whisper_device"] == "cpu"

    def test_patch_config_invalid_enum(self, client):
        r = client.patch("/api/config", json={"whisper_device": "tpu"})
        assert r.status_code == 400

    def test_patch_config_min_validator(self, client):
        r = client.patch("/api/config", json={"min_clip_ms": 100})
        assert r.status_code == 400

    def test_patch_config_weight_clamped_to_zero(self, client):
        r = client.patch("/api/config", json={"scorer_energy_weight": -5.0})
        assert r.status_code == 200
        assert r.json()["scorer_energy_weight"] == pytest.approx(0.0)


class TestCaptionsVtt:
    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_captions_vtt_404_when_no_srt(self, client):
        clip = self._first_clip(client)
        r = client.get(f"/api/clips/{clip['id']}/captions.vtt")
        assert r.status_code == 404

    def test_captions_vtt_returns_webvtt_when_srt_exists(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        srt_path = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.srt"
        srt_path.write_text(
            "1\n00:00:01,500 --> 00:00:03,000\nHello world\n\n",
            encoding="utf-8",
        )
        r = client.get(f"/api/clips/{clip['id']}/captions.vtt")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/vtt")
        body = r.text
        assert body.startswith("WEBVTT")
        assert "00:00:01.500 --> 00:00:03.000" in body

    def test_captions_vtt_404_for_unknown_clip(self, client):
        r = client.get("/api/clips/99999/captions.vtt")
        assert r.status_code == 404


class TestDeleteClipExport:
    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_delete_export_removes_file_keeps_record(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        export_file = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.mkv"
        export_file.write_bytes(b"fake export")
        assert export_file.exists()

        r = client.delete(f"/api/clips/{clip['id']}/export")
        assert r.status_code == 200
        assert r.json()["files_deleted"] == 1
        assert not export_file.exists()
        # Clip record must still exist
        assert client.get(f"/api/clips/{clip['id']}").status_code == 200

    def test_delete_export_when_no_files_returns_zero(self, client):
        clip = self._first_clip(client)
        r = client.delete(f"/api/clips/{clip['id']}/export")
        assert r.status_code == 200
        assert r.json()["files_deleted"] == 0

    def test_delete_export_404(self, client):
        r = client.delete("/api/clips/99999/export")
        assert r.status_code == 404


class TestSceneBoundaries:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_scene_boundaries_empty_when_none(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/videos/{vid_id}/scene-boundaries")
        assert r.status_code == 200
        assert r.json()["boundaries_ms"] == []

    def test_scene_boundaries_returned_in_order(self, client, project_dir):
        from yuu_clip.db.models import SceneBoundary, make_session
        vid_id = self._vid_id(client)
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            db.add(SceneBoundary(video_id=vid_id, timecode_ms=30_000))
            db.add(SceneBoundary(video_id=vid_id, timecode_ms=10_000))
            db.commit()
        finally:
            db.close()
        r = client.get(f"/api/videos/{vid_id}/scene-boundaries")
        assert r.status_code == 200
        bounds = r.json()["boundaries_ms"]
        assert bounds == [10_000, 30_000]

    def test_scene_boundaries_404(self, client):
        r = client.get("/api/videos/99999/scene-boundaries")
        assert r.status_code == 404


class TestVideoEnergy:
    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def test_energy_empty_when_no_data(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/videos/{vid_id}/energy")
        assert r.status_code == 200
        tracks = r.json()["tracks"]
        # One audio track was seeded, but with no energy rows
        assert len(tracks) == 1
        assert tracks[0]["samples"] == []
        assert tracks[0]["label"] == "combined"

    def test_energy_returns_samples(self, client, project_dir):
        from yuu_clip.db.models import AudioEnergy, AudioTrack, make_session
        vid_id = self._vid_id(client)
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            track = db.query(AudioTrack).filter_by(video_id=vid_id).first()
            db.add(AudioEnergy(audio_track_id=track.id, second_offset=0, rms_db=-20.5))
            db.add(AudioEnergy(audio_track_id=track.id, second_offset=1, rms_db=-18.0))
            db.commit()
        finally:
            db.close()
        r = client.get(f"/api/videos/{vid_id}/energy")
        assert r.status_code == 200
        samples = r.json()["tracks"][0]["samples"]
        assert len(samples) == 2
        assert samples[0] == {"second": 0, "rms_db": pytest.approx(-20.5)}

    def test_energy_404(self, client):
        r = client.get("/api/videos/99999/energy")
        assert r.status_code == 404


class TestEditableFieldsBothBranch:
    """field='both' touches title+summary (video) or description+description_long (clip)."""

    def _vid_id(self, client) -> int:
        return client.get("/api/videos").json()[0]["id"]

    def _first_clip_id(self, client) -> int:
        vid_id = self._vid_id(client)
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_accept_edit_both_video_fields(self, client, project_dir):
        from yuu_clip.db.models import Video, make_session
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            v = db.query(Video).first()
            v.title = "LLM Title"
            v.summary = "LLM Summary"
            db.commit()
        finally:
            db.close()
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={
            "action": "accept_edit", "field": "both",
            "new_title": "My Title", "new_summary": "My Summary",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "My Title"
        assert d["title_is_edited"] is True
        assert d["summary"] == "My Summary"
        assert d["summary_is_edited"] is True

    def test_revert_both_video_fields(self, client, project_dir):
        from yuu_clip.db.models import Video, make_session
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        try:
            v = db.query(Video).first()
            v.title = "LLM Title"
            v.title_user = "My Title"
            v.summary = "LLM Summary"
            v.summary_user = "My Summary"
            db.commit()
        finally:
            db.close()
        vid_id = self._vid_id(client)
        r = client.patch(f"/api/videos/{vid_id}/fields", json={"action": "revert", "field": "both"})
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "LLM Title"
        assert d["title_is_edited"] is False
        assert d["summary"] == "LLM Summary"
        assert d["summary_is_edited"] is False

    def test_accept_edit_both_clip_fields(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "both",
            "new_description": "Short edit",
            "new_description_long": "Long edit",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["description"] == "Short edit"
        assert d["description_is_edited"] is True
        assert d["description_long"] == "Long edit"
        assert d["description_long_is_edited"] is True

    def test_revert_both_clip_fields(self, client):
        clip_id = self._first_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "accept_edit", "field": "both",
            "new_description": "Short edit", "new_description_long": "Long edit",
        })
        r = client.patch(f"/api/clips/{clip_id}/fields", json={"action": "revert", "field": "both"})
        assert r.status_code == 200
        d = r.json()
        assert d["description_is_edited"] is False
        assert d["description_long_is_edited"] is False

    def test_invalid_clip_field_returns_400(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/fields", json={
            "action": "revert", "field": "notes",
        })
        assert r.status_code == 400


class TestMergeClipsPreviewCleanup:
    """merge_clips must unlink the cached preview files for both clips."""

    def test_merge_removes_clip_b_preview_file(self, client, project_dir):
        from yuu_clip.web.routes import clips as _clips_module

        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips?sort=timeline").json()
        clip_a_id = clips[0]["id"]
        clip_b_id = clips[1]["id"]

        # Plant fake preview files in the cache and on disk
        preview_dir = project_dir / ".yuu-clip" / "preview_cache"
        preview_dir.mkdir(exist_ok=True)
        file_a = preview_dir / f"clip_{clip_a_id}_preview.mp4"
        file_b = preview_dir / f"clip_{clip_b_id}_preview.mp4"
        file_a.write_bytes(b"fake a")
        file_b.write_bytes(b"fake b")
        _clips_module._preview_cache[clip_a_id] = file_a
        _clips_module._preview_cache[clip_b_id] = file_b

        r = client.post(f"/api/clips/{clip_a_id}/merge", json={"clip_b_id": clip_b_id})
        assert r.status_code == 200

        # Both preview files must be removed from disk
        assert not file_a.exists(), "clip_a preview should be deleted after merge"
        assert not file_b.exists(), "clip_b preview should be deleted after merge"
        assert clip_a_id not in _clips_module._preview_cache
        assert clip_b_id not in _clips_module._preview_cache
