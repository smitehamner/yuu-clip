"""The app maps a SQLite "database is locked" OperationalError to an actionable 503.

While an analyze/score subprocess holds the single SQLite write lock past
busy_timeout, a normal user write (approve/reject, speaker merge, caption edit)
raises OperationalError. Without the handler that surfaced as an opaque 500
("Unknown error (no details from server)" in the UI); the handler turns just the
locked/busy case into a clear 503 and leaves other DB errors a logged 500.
"""
from __future__ import annotations

from sqlalchemy.exc import OperationalError


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
