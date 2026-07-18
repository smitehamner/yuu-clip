"""Fixtures for integration tests (``tests/integration/``).

These tests need a seeded project DB and/or an in-process ``TestClient`` - they
exercise route handlers, DB models, and the analyze/scoring pipeline against
real data. They do not need a live server (that is ``tests/ui/``). The root
``isolate_global_config`` fixture is inherited.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from yuu_clip.dev.fixture import seed_project_db
from yuu_clip.web.app import create_app


@pytest.fixture()
def project_dir(tmp_path: Path) -> Path:
    """A temporary project directory with a pre-seeded SQLite DB (three clips).

    Uses the shared ``seed_project_db`` helper (also used by
    ``yuu-dev fixture-project``); ``with_scenes`` stays off here so the seed is
    exactly the three clips the integration assertions expect.
    """
    seed_project_db(tmp_path, str(tmp_path / "session.mkv"))
    return tmp_path


@pytest.fixture()
def client(project_dir: Path) -> TestClient:
    """A TestClient backed by the FastAPI app pointed at the temp project."""
    app = create_app(project_dir)
    return TestClient(app)
