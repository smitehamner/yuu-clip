from __future__ import annotations

from pathlib import Path

from yuu_clip.db.models import Video, make_session


def _seed_project(root: Path, filename: str) -> Path:
    """Create a project dir with its own DB holding a single, distinctly-named video."""
    data = root / ".yuu-clip"
    data.mkdir(parents=True, exist_ok=True)
    session = make_session(data / "project.db")
    session.add(Video(path=str(root / filename), filename=filename, status="done", duration_ms=1000))
    session.commit()
    session.close()
    return root


class TestKnownProjectsRegistry:
    def test_record_dedups_and_orders_recent_first(self, tmp_path):
        from yuu_clip.config import load_known_projects, record_known_project
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
        from yuu_clip.config import _known_projects_path, load_known_projects
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
        gone = _seed_project(tmp_path / "gone", "gone.mkv")
        client.post("/api/projects/switch", json={"path": str(gone)})
        # Remove the folder after it is on the known list, then list again.
        for child in sorted(gone.rglob("*"), reverse=True):
            child.unlink() if child.is_file() else child.rmdir()
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

    def test_idempotent_reswitch(self, client, tmp_path):
        other = _seed_project(tmp_path / "again", "again.mkv")
        assert client.post("/api/projects/switch", json={"path": str(other)}).status_code == 200
        assert client.post("/api/projects/switch", json={"path": str(other)}).status_code == 200
        assert [v["filename"] for v in client.get("/api/videos").json()] == ["again.mkv"]

    def test_nonexistent_path_400(self, client, tmp_path):
        res = client.post("/api/projects/switch", json={"path": str(tmp_path / "nope")})
        assert res.status_code == 400

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
