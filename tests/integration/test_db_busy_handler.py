"""The app maps a SQLite "database is locked" OperationalError to an actionable 503.

While an analyze/score subprocess holds the single SQLite write lock past
busy_timeout, a normal user write (approve/reject, speaker merge, caption edit)
raises OperationalError. Without the handler that surfaced as an opaque 500
("Unknown error (no details from server)" in the UI); the handler turns just the
locked/busy case into a clear 503 and leaves other DB errors a logged 500.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from yuu_clip.web.routes.common import with_write_retry


def _locked() -> OperationalError:
    return OperationalError("UPDATE clips", {}, Exception("database is locked"))


class TestWithWriteRetry:
    def test_succeeds_after_transient_lock(self):
        calls = {"n": 0}

        def op():
            calls["n"] += 1
            if calls["n"] < 3:
                raise _locked()
            return "ok"

        assert with_write_retry(op, attempts=5, delay=0) == "ok"
        assert calls["n"] == 3

    def test_reraises_locked_after_exhausting_attempts(self):
        calls = {"n": 0}

        def op():
            calls["n"] += 1
            raise _locked()

        with pytest.raises(OperationalError):
            with_write_retry(op, attempts=3, delay=0)
        assert calls["n"] == 3

    def test_non_locked_operational_error_is_not_retried(self):
        calls = {"n": 0}

        def op():
            calls["n"] += 1
            raise OperationalError("UPDATE", {}, Exception("no such table: widgets"))

        with pytest.raises(OperationalError):
            with_write_retry(op, attempts=5, delay=0)
        assert calls["n"] == 1

    def test_httpexception_guard_propagates_without_retry(self):
        calls = {"n": 0}

        def op():
            calls["n"] += 1
            raise HTTPException(400, "bad request")

        with pytest.raises(HTTPException):
            with_write_retry(op, attempts=5, delay=0)
        assert calls["n"] == 1


def _add_raising_route(app, path: str, exc: Exception) -> None:
    @app.get(path)
    def _boom():
        raise exc


def test_database_locked_returns_503_with_actionable_detail(client):
    _add_raising_route(
        client.app, "/api/_test_db_locked",
        OperationalError("SELECT 1", {}, Exception("database is locked")),
    )
    r = client.get("/api/_test_db_locked")
    assert r.status_code == 503
    assert "busy" in r.json()["detail"].lower()


def test_other_operational_error_returns_500(client):
    _add_raising_route(
        client.app, "/api/_test_db_other",
        OperationalError("SELECT 1", {}, Exception("no such table: widgets")),
    )
    r = client.get("/api/_test_db_other")
    assert r.status_code == 500
    assert "busy" not in r.json()["detail"].lower()


def test_clip_status_route_survives_a_transient_lock(client, monkeypatch):
    # End-to-end wiring proof: the first commit in the request raises "database is
    # locked"; the route's with_write_retry re-runs on a fresh session and succeeds,
    # so the user sees 200 instead of the 503 an un-retried write would produce.
    from sqlalchemy.orm import Session

    original_commit = Session.commit
    state = {"failed_once": False}

    def flaky_commit(self):
        if not state["failed_once"]:
            state["failed_once"] = True
            raise OperationalError("UPDATE clips", {}, Exception("database is locked"))
        return original_commit(self)

    monkeypatch.setattr(Session, "commit", flaky_commit)

    vid = client.get("/api/videos").json()[0]["id"]
    clip_id = client.get(f"/api/videos/{vid}/clips").json()[0]["id"]
    r = client.post(f"/api/clips/{clip_id}/status", json={"status": "approved"})

    assert r.status_code == 200
    assert state["failed_once"] is True  # the first commit did fail and was retried
