"""The startup auto-migrate is wired into the real server boot path.

Unit tests cover run_startup_migrations directly; this proves ProjectContext (via
create_app) actually invokes it, so a seeded pre-Alembic project DB is brought to head
on boot with its rows intact - the behavior a packaged app relies on when a user opens
an older library after an update.
"""
from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from yuu_clip.config import project_db_path
from yuu_clip.db.migrate import database_revision, make_alembic_config, script_head
from yuu_clip.web.app import create_app


def test_create_app_migrates_seeded_project_to_head(project_dir: Path) -> None:
    db_path = project_db_path(project_dir)
    assert database_revision(db_path) is None  # seed_project_db leaves a pre-Alembic DB

    app = create_app(project_dir)

    assert database_revision(db_path) == script_head(make_alembic_config(db_path))
    with TestClient(app) as client:
        assert len(client.get("/api/videos").json()) >= 1
