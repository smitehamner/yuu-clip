from __future__ import annotations

import logging
from pathlib import Path

from yuu_clip.db.models import Video, make_session
from yuu_clip.log import _LOG_FILENAME, configure_logging, get_logger, redirect_logging


def _seed_project(root: Path, filename: str) -> Path:
    """Create a project dir with its own DB holding a single, distinctly-named video."""
    data = root / ".yuu-clip"
    data.mkdir(parents=True, exist_ok=True)
    session = make_session(data / "project.db")
    session.add(Video(path=str(root / filename), filename=filename, status="done", duration_ms=1000))
    session.commit()
    session.close()
    return root


class TestLogRedirect:
    def test_redirect_points_file_at_new_project(self, tmp_path):
        """redirect_logging sends subsequent output to the new project's log and
        leaves the old project's log untouched, without duplicating handlers."""
        root = logging.getLogger("yuu_clip")
        saved = root.handlers[:]
        for handler in saved:
            root.removeHandler(handler)
        try:
            proj_a = tmp_path / "a"
            proj_b = tmp_path / "b"
            configure_logging(proj_a)
            file_handlers_before = [h for h in root.handlers
                                    if isinstance(h, logging.handlers.RotatingFileHandler)]
            get_logger("test").warning("before-redirect")

            redirect_logging(proj_b)
            # Exactly one file handler survives the swap.
            file_handlers_after = [h for h in root.handlers
                                   if isinstance(h, logging.handlers.RotatingFileHandler)]
            assert len(file_handlers_before) == 1
            assert len(file_handlers_after) == 1
            get_logger("test").warning("after-redirect")
            for handler in root.handlers:
                handler.flush()

            log_a = (proj_a / ".yuu-clip" / _LOG_FILENAME).read_text(encoding="utf-8")
            log_b = (proj_b / ".yuu-clip" / _LOG_FILENAME).read_text(encoding="utf-8")
            assert "before-redirect" in log_a and "after-redirect" not in log_a
            assert "after-redirect" in log_b and "before-redirect" not in log_b
        finally:
            for handler in root.handlers[:]:
                root.removeHandler(handler)
                handler.close()
            for handler in saved:
                root.addHandler(handler)


class TestKnownProjectsRegistry:
    def test_record_dedups_and_orders_recent_first(self, tmp_path):
        from yuu_clip.recent_projects import load_known_projects, record_known_project
        first = tmp_path / "a"
        first.mkdir()
        second = tmp_path / "b"
        second.mkdir()
        record_known_project(first)
        record_known_project(second)
        record_known_project(first)  # re-open moves it to the front, no duplicate
        paths = [e["path"] for e in load_known_projects()]
        assert paths == [str(first.resolve()), str(second.resolve())]

    def test_corrupt_file_ignored(self, tmp_path):
        from yuu_clip.recent_projects import _known_projects_path, load_known_projects
        registry = _known_projects_path()
        registry.parent.mkdir(parents=True, exist_ok=True)
        registry.write_text("{ not json", encoding="utf-8")
        assert load_known_projects() == []


class TestProjectList:
    def test_list_reports_current_and_boot_project(self, client, project_dir):
        body = client.get("/api/projects").json()
        assert body["current"] == str(project_dir)
        # create_app records the startup project in the recent list.
        assert any(p["path"] == str(project_dir.resolve()) for p in body["known"])

    def test_missing_folder_marked_not_existing(self, client, tmp_path):
        # A project can be in the recent list but its folder later deleted. Use a
        # registry entry we never switch to, so no open log handle blocks removal.
        from yuu_clip.recent_projects import record_known_project
        gone = tmp_path / "gone"
        gone.mkdir()
        record_known_project(gone)
        gone.rmdir()
        known = client.get("/api/projects").json()["known"]
        entry = next(p for p in known if p["path"] == str(gone.resolve()))
        assert entry["exists"] is False


class TestProjectSwitch:
    def test_switch_reflects_new_db(self, client, tmp_path):
        other = _seed_project(tmp_path / "other", "other.mkv")
        before = client.get("/api/videos").json()
        assert any(v["filename"] == "session.mkv" for v in before)

        res = client.post("/api/projects/switch", json={"path": str(other)})
        assert res.status_code == 200
        assert res.json()["current"] == str(other.resolve())

        after = client.get("/api/videos").json()
        assert [v["filename"] for v in after] == ["other.mkv"]

    def test_switch_increments_generation_and_records(self, client, tmp_path):
        gen_before = client.get("/api/status").json()["project_generation"]
        other = _seed_project(tmp_path / "p2", "p2.mkv")

        res = client.post("/api/projects/switch", json={"path": str(other)})
        assert res.json()["project_generation"] == gen_before + 1

        status = client.get("/api/status").json()
        assert status["project_generation"] == gen_before + 1
        assert status["project_dir"] == str(other.resolve())

        known = client.get("/api/projects").json()["known"]
        assert known[0]["path"] == str(other.resolve())

    def test_switch_to_fresh_dir_initializes(self, client, tmp_path):
        fresh = tmp_path / "fresh"
        fresh.mkdir()
        res = client.post("/api/projects/switch", json={"path": str(fresh)})
        assert res.status_code == 200
        assert (fresh / ".yuu-clip" / "project.db").exists()
        assert client.get("/api/videos").json() == []
        assert res.json()["created"] is False

    def test_switch_to_nonexistent_dir_reports_created(self, client, tmp_path):
        # A path that doesn't exist yet - e.g. a moved/deleted project folder
        # someone meant to reopen - silently starts a brand-new empty project
        # there. `created` lets the frontend tell the two apart instead of
        # reading the same as reopening real existing data (found 2026-07-25).
        missing = tmp_path / "does-not-exist-yet"
        res = client.post("/api/projects/switch", json={"path": str(missing)})
        assert res.status_code == 200
        assert res.json()["created"] is True
        assert missing.is_dir()

    def test_switch_to_existing_project_reports_not_created(self, client, tmp_path):
        other = _seed_project(tmp_path / "reopened", "reopened.mkv")
        res = client.post("/api/projects/switch", json={"path": str(other)})
        assert res.status_code == 200
        assert res.json()["created"] is False

    def test_switch_creates_new_project_log(self, client, tmp_path):
        other = _seed_project(tmp_path / "logged", "logged.mkv")
        assert client.post("/api/projects/switch", json={"path": str(other)}).status_code == 200
        assert (other / ".yuu-clip" / _LOG_FILENAME).exists()

    def test_idempotent_reswitch(self, client, tmp_path):
        other = _seed_project(tmp_path / "again", "again.mkv")
        assert client.post("/api/projects/switch", json={"path": str(other)}).status_code == 200
        assert client.post("/api/projects/switch", json={"path": str(other)}).status_code == 200
        assert [v["filename"] for v in client.get("/api/videos").json()] == ["again.mkv"]

    def test_nonexistent_leaf_with_existing_parent_creates_folder(self, client, tmp_path):
        # open-project.html promises "a new folder becomes a fresh, empty project" -
        # a not-yet-existing leaf under an existing parent should be created, not 400.
        target = tmp_path / "brand-new-project"
        assert not target.exists()
        res = client.post("/api/projects/switch", json={"path": str(target)})
        assert res.status_code == 200
        assert target.is_dir()
        assert res.json()["current"] == str(target.resolve())

    def test_nonexistent_parent_still_400(self, client, tmp_path):
        # A missing parent is a real typo, not "make me a new project" - still rejected.
        res = client.post(
            "/api/projects/switch",
            json={"path": str(tmp_path / "nope" / "still-nope")},
        )
        assert res.status_code == 400

    def test_existing_folder_switch_unchanged(self, client, tmp_path):
        other = _seed_project(tmp_path / "existing", "existing.mkv")
        res = client.post("/api/projects/switch", json={"path": str(other)})
        assert res.status_code == 200
        assert res.json()["current"] == str(other.resolve())

    def test_rejected_while_job_running(self, client, tmp_path):
        other = _seed_project(tmp_path / "busy", "busy.mkv")
        client.app.state.ctx.active_jobs = 1
        try:
            res = client.post("/api/projects/switch", json={"path": str(other)})
        finally:
            client.app.state.ctx.active_jobs = 0
        assert res.status_code == 409
        # The switch was refused, so the current project is unchanged.
        assert client.get("/api/projects").json()["current"] != str(other.resolve())

    def test_rejected_while_proxy_generating(self, client, tmp_path):
        other = _seed_project(tmp_path / "busy2", "busy2.mkv")
        client.app.state.ctx.proxy_generating = {"src"}
        try:
            res = client.post("/api/projects/switch", json={"path": str(other)})
        finally:
            client.app.state.ctx.proxy_generating = set()
        assert res.status_code == 409
