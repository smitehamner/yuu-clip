"""
Shared fixtures for yuu-clip tests.
"""
from __future__ import annotations

import os
import socket
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

# ---------------------------------------------------------------------------
# Minimal project dir fixture — isolated temp dir with a seeded DB
# ---------------------------------------------------------------------------

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
            description=f"Test clip {i + 1}",
            status=status,
        ))

    session.commit()
    session.close()
    return tmp_path


@pytest.fixture()
def client(project_dir: Path) -> TestClient:
    """A TestClient backed by the FastAPI app pointed at the temp project."""
    app = create_app(project_dir)
    return TestClient(app)


# ---------------------------------------------------------------------------
# Playwright — connect to the already-running dev server
# ---------------------------------------------------------------------------

LIVE_URL = "http://127.0.0.1:8080"


def _server_up() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 8080), timeout=1):
            return True
    except OSError:
        return False


skip_no_server = pytest.mark.skipif(
    not _server_up(),
    reason="Live server not running on port 8080",
)


_had_failure = False
_is_ui_session = False


def pytest_collection_finish(session) -> None:
    global _is_ui_session
    _is_ui_session = any("test_ui" in str(item.fspath) for item in session.items)


def pytest_runtest_logreport(report: pytest.TestReport) -> None:
    global _had_failure
    if report.when == "call" and report.failed:
        _had_failure = True


def pytest_runtest_teardown(item, nextitem) -> None:
    # Watchdog for Playwright session teardown hang on Windows (IOCP / ProactorEventLoop).
    # Only active for UI test sessions — API tests let pytest print its summary normally.
    if not _is_ui_session or nextitem is not None:
        return
    import threading
    import time

    def _watchdog() -> None:
        time.sleep(8)
        os._exit(1 if _had_failure else 0)

    threading.Thread(target=_watchdog, daemon=True).start()


def pytest_sessionfinish(session, exitstatus) -> None:
    # Only force-exit for UI sessions where teardown may hang.
    # API test sessions return normally so pytest can print its summary line.
    if not _is_ui_session:
        return
    os._exit(int(exitstatus))


@pytest.fixture
def page(page):
    """Override pytest-playwright's page fixture to set tighter default timeouts.

    Playwright defaults to 30s for actions and assertions, which means a
    selector miss silently hangs for half a minute before the test fails.
    10s is more than enough for a local dev server and gives faster feedback.

    Also seeds localStorage so the Getting Started modal doesn't auto-open
    and block UI interactions during tests.
    """
    page.set_default_timeout(10_000)
    page.set_default_navigation_timeout(10_000)
    page.goto(LIVE_URL)
    page.evaluate("localStorage.setItem('yuu-getting-started-seen', '1')")
    yield page
    try:
        page.evaluate("if (window._activeES) { window._activeES.close(); window._activeES = null; }")
    except Exception:
        pass
    try:
        page.unroute("**")
    except Exception:
        pass
    try:
        page.goto("about:blank", timeout=2000)
    except Exception:
        pass
