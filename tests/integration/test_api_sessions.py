"""API tests for session grouping routes (yuu_clip/web/routes/sessions.py)."""
from __future__ import annotations

import pytest

from yuu_clip.db.models import ClipCandidate, RecordingSession, Video, make_session


def _db(project_dir):
    return make_session(project_dir / ".yuu-clip" / "project.db")


def _add_video(session, filename: str, duration_ms: int = 1_200_000, **kwargs) -> int:
    video = Video(
        path=str(filename),
        filename=filename,
        status="done",
        duration_ms=duration_ms,
        **kwargs,
    )
    session.add(video)
    session.flush()
    return video.id


@pytest.fixture()
def two_recordings(project_dir):
    """Two OBS-named top-level recordings 5 minutes apart (one session), plus ids."""
    session = _db(project_dir)
    try:
        a = _add_video(session, "2026-07-04 20-00-00.mkv", 1_200_000, title="Part A")
        b = _add_video(session, "2026-07-04 20-25-00.mkv", 1_200_000, title="Part B")
        session.commit()
    finally:
        session.close()
    return a, b


class TestSessionCrud:
    def test_create_sets_membership(self, client, two_recordings):
        a, b = two_recordings
        r = client.post("/api/sessions", json={"name": "Raid night", "video_ids": [a, b]})
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "Raid night"
        assert sorted(body["member_ids"]) == sorted([a, b])
        assert body["member_count"] == 2

        videos = {v["id"]: v for v in client.get("/api/videos").json()}
        assert videos[a]["session_id"] == body["id"]
        assert videos[b]["session_id"] == body["id"]

    def test_create_rejects_unknown_id(self, client, two_recordings):
        a, _ = two_recordings
        r = client.post("/api/sessions", json={"video_ids": [a, 99999]})
        assert r.status_code == 400
        assert "99999" in r.json()["detail"]

    def test_create_rejects_segment(self, client, two_recordings, project_dir):
        a, _ = two_recordings
        session = _db(project_dir)
        try:
            seg = _add_video(session, "2026-07-04 20-00-00.mkv", 600_000, parent_video_id=a)
            session.commit()
        finally:
            session.close()
        r = client.post("/api/sessions", json={"video_ids": [a, seg]})
        assert r.status_code == 400
        assert "segment" in r.json()["detail"].lower()

    def test_create_empty_is_400(self, client):
        r = client.post("/api/sessions", json={"video_ids": []})
        assert r.status_code == 400

    def test_rename(self, client, two_recordings):
        a, b = two_recordings
        sid = client.post("/api/sessions", json={"video_ids": [a, b]}).json()["id"]
        r = client.patch(f"/api/sessions/{sid}", json={"name": "New name"})
        assert r.status_code == 200
        assert r.json()["name"] == "New name"

    def test_add_and_remove_member(self, client, two_recordings, project_dir):
        a, b = two_recordings
        sid = client.post("/api/sessions", json={"video_ids": [a]}).json()["id"]
        r = client.post(f"/api/sessions/{sid}/members", json={"video_ids": [b]})
        assert r.status_code == 200
        assert sorted(r.json()["member_ids"]) == sorted([a, b])

        r = client.delete(f"/api/sessions/{sid}/members/{b}")
        assert r.status_code == 200
        assert r.json()["member_ids"] == [a]

    def test_remove_non_member_404(self, client, two_recordings):
        a, b = two_recordings
        sid = client.post("/api/sessions", json={"video_ids": [a]}).json()["id"]
        r = client.delete(f"/api/sessions/{sid}/members/{b}")
        assert r.status_code == 404

    def test_dissolve_nulls_fk_and_keeps_videos(self, client, two_recordings, project_dir):
        a, b = two_recordings
        sid = client.post("/api/sessions", json={"video_ids": [a, b]}).json()["id"]
        r = client.delete(f"/api/sessions/{sid}")
        assert r.status_code == 200
        assert r.json()["detached"] == 2

        assert client.get(f"/api/sessions/{sid}").status_code == 404
        session = _db(project_dir)
        try:
            assert session.get(RecordingSession, sid) is None
            for vid in (a, b):
                video = session.get(Video, vid)
                assert video is not None
                assert video.session_id is None
        finally:
            session.close()


class TestSessionSuggestions:
    def test_suggests_close_recordings(self, client, two_recordings):
        a, b = two_recordings
        groups = client.get("/api/sessions/suggestions").json()
        assert any(sorted(g["video_ids"]) == sorted([a, b]) for g in groups)

    def test_grouped_recordings_not_resuggested(self, client, two_recordings):
        a, b = two_recordings
        client.post("/api/sessions", json={"video_ids": [a, b]})
        groups = client.get("/api/sessions/suggestions").json()
        assert all(a not in g["video_ids"] and b not in g["video_ids"] for g in groups)


class TestSessionDetail:
    def test_detail_orders_members_and_offsets(self, client, two_recordings):
        a, b = two_recordings
        sid = client.post("/api/sessions", json={"video_ids": [b, a]}).json()["id"]
        detail = client.get(f"/api/sessions/{sid}").json()
        member_ids = [m["id"] for m in detail["members"]]
        assert member_ids == [a, b]  # ordered by real start time, not input order
        assert detail["members"][0]["offset_ms"] == 0
        assert detail["members"][1]["offset_ms"] == 1_200_000
        # 25 min start delta − 20 min duration = 5 min real-world gap
        assert detail["members"][1]["gap_before_ms"] == 5 * 60_000
        assert detail["total_ms"] == 2_400_000

    def test_detail_includes_clip_markers_reoffset(self, client, two_recordings, project_dir):
        a, b = two_recordings
        session = _db(project_dir)
        try:
            session.add(ClipCandidate(
                video_id=b, start_ms=30_000, end_ms=45_000,
                score_overall=0.5, description="B clip", status="approved",
            ))
            session.commit()
        finally:
            session.close()
        sid = client.post("/api/sessions", json={"video_ids": [a, b]}).json()["id"]
        detail = client.get(f"/api/sessions/{sid}").json()
        b_member = next(m for m in detail["members"] if m["id"] == b)
        assert b_member["clips"][0]["abs_ms"] == 1_200_000 + 30_000

    def test_detail_404(self, client):
        assert client.get("/api/sessions/99999").status_code == 404


class TestSessionRollup:
    def test_summarize_commits(self, client, two_recordings, monkeypatch):
        import yuu_clip.scoring.llm as llm
        a, b = two_recordings
        # Members need at least one non-empty summary to be summarizable.
        client.patch(f"/api/videos/{a}/fields", json={
            "action": "accept_edit", "field": "summary", "new_summary": "A happened",
        })
        sid = client.post("/api/sessions", json={"video_ids": [a, b]}).json()["id"]

        monkeypatch.setattr(
            llm, "summarize_session",
            lambda members, config, context_text="": ("Epic Session", "A big night."),
        )
        r = client.get(f"/api/sessions/{sid}/summarize")
        assert r.status_code == 200
        assert '"type": "done"' in r.text
        assert '"outcome": "ok"' in r.text

        detail = client.get(f"/api/sessions/{sid}").json()
        assert detail["title"] == "Epic Session"
        assert detail["summary"] == "A big night."

    def test_summarize_400_without_member_content(self, client, project_dir):
        session = _db(project_dir)
        try:
            a = _add_video(session, "2026-07-04 20-00-00.mkv")  # no title, no summary
            b = _add_video(session, "2026-07-04 20-25-00.mkv")
            session.commit()
        finally:
            session.close()
        sid = client.post("/api/sessions", json={"video_ids": [a, b]}).json()["id"]
        r = client.get(f"/api/sessions/{sid}/summarize")
        assert r.status_code == 400

    def test_fields_edit_and_revert(self, client, two_recordings):
        a, b = two_recordings
        sid = client.post("/api/sessions", json={"video_ids": [a, b]}).json()["id"]
        r = client.patch(f"/api/sessions/{sid}/fields", json={
            "action": "accept_edit", "field": "title", "new_title": "My title",
        })
        assert r.json()["title"] == "My title"
        assert r.json()["title_is_edited"] is True

        r = client.patch(f"/api/sessions/{sid}/fields", json={
            "action": "revert", "field": "title",
        })
        assert r.json()["title_is_edited"] is False


class TestReelPoolVideoIds:
    def test_video_ids_filter_supersedes(self, client, two_recordings, project_dir):
        a, b = two_recordings
        session = _db(project_dir)
        try:
            for vid in (a, b):
                session.add(ClipCandidate(
                    video_id=vid, start_ms=0, end_ms=10_000,
                    score_overall=0.7, description="c", status="approved",
                ))
            session.commit()
        finally:
            session.close()
        clips = client.get(f"/api/demo/approved-clips?video_ids={a},{b}").json()
        returned_video_ids = {c["video_id"] for c in clips}
        assert returned_video_ids == {a, b}

    def test_video_ids_non_integer_400(self, client):
        r = client.get("/api/demo/approved-clips?video_ids=abc")
        assert r.status_code == 400
