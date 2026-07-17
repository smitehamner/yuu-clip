"""Fixtures for integration tests (``tests/integration/``).

These tests need a seeded project DB and/or an in-process ``TestClient`` - they
exercise route handlers, DB models, and the analyze/scoring pipeline against
real data. They do not need a live server (that is ``tests/ui/``). The root
``isolate_global_config`` fixture is inherited.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from yuu_clip.db.models import (
    AudioTrack,
    ClipCandidate,
    Video,
    make_session,
)
from yuu_clip.web.app import create_app


@pytest.fixture()
def project_dir(tmp_path: Path) -> Path:
    """A temporary project directory with a pre-seeded SQLite DB."""
    data = tmp_path / ".yuu-clip"
    data.mkdir()
    (data / "exports").mkdir()
    (data / "audio").mkdir()

    db_path = data / "project.db"
    session = make_session(db_path)

    # Seed one video and a few clips
    v = Video(
        path=str(tmp_path / "session.mkv"),
        filename="session.mkv",
        status="done",
        duration_ms=600_000,
    )
    session.add(v)
    session.flush()

    track = AudioTrack(
        video_id=v.id,
        stream_index=1,
        label="combined",
        do_transcribe=True,
        do_score=True,
        relevance_weight=1.5,
    )
    session.add(track)
    session.flush()

    scored_at = datetime.now(timezone.utc)
    for i, (score, status) in enumerate([
        (0.85, "pending"),
        (0.60, "approved"),
        (0.20, "rejected"),
    ]):
        session.add(ClipCandidate(
            video_id=v.id,
            start_ms=i * 60_000,
            end_ms=(i + 1) * 60_000,
            score_overall=score,
            score_funny=score * 0.9,
            score_dramatic=score * 0.5,
            score_action=score * 0.3,
            score_visual=score * 0.7,
            score_laugh=score * 0.4,
            description=f"Test clip {i + 1}",
            status=status,
            scored_at=scored_at,
        ))

    session.commit()
    session.close()
    return tmp_path


@pytest.fixture()
def client(project_dir: Path) -> TestClient:
    """A TestClient backed by the FastAPI app pointed at the temp project."""
    app = create_app(project_dir)
    return TestClient(app)
