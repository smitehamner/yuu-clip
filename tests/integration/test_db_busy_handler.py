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


def test_unhandled_exception_returns_json_detail_not_opaque_500(project_dir):
    """B3/W1: a route that raises a plain exception must return JSON with a `detail`,
    not FastAPI's bare plaintext "Internal Server Error" - which the UI can't parse,
    surfacing as "Unknown error (no details from server)" (the opaque delete toast)."""
    from fastapi.testclient import TestClient

    from yuu_clip.web.app import create_app

    app = create_app(project_dir)
    _add_raising_route(app, "/api/_test_boom", RuntimeError("disk exploded"))
    # raise_server_exceptions=False so the ServerErrorMiddleware re-raise (for server
    # logging) doesn't propagate into the test - we want the client-facing response.
    with TestClient(app, raise_server_exceptions=False) as tc:
        r = tc.get("/api/_test_boom")
    assert r.status_code == 500
    detail = r.json()["detail"]
    assert "RuntimeError" in detail and "disk exploded" in detail


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


# ---------------------------------------------------------------------------
# B6: the caption edit / speaker rename / segment reassignment / name-corrections
# apply routes were previously a plain db.commit() with no retry - each now wraps
# its write in with_write_retry like clip status above. One end-to-end wiring
# proof per route, same technique: fail the first commit, confirm a 200 (not the
# 503 an un-retried write would produce) and that a retry actually happened.
# ---------------------------------------------------------------------------

def _fail_first_commit(monkeypatch) -> dict:
    """Patch Session.commit to raise "database is locked" once, then behave normally.

    Returns the shared state dict - state["failed_once"] confirms a retry occurred.
    """
    from sqlalchemy.orm import Session

    original_commit = Session.commit
    state = {"failed_once": False}

    def flaky_commit(self):
        if not state["failed_once"]:
            state["failed_once"] = True
            raise OperationalError("UPDATE", {}, Exception("database is locked"))
        return original_commit(self)

    monkeypatch.setattr(Session, "commit", flaky_commit)
    return state


def test_caption_edit_route_survives_a_transient_lock(client, project_dir, monkeypatch):
    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment, Video, make_session

    session = make_session(project_dir / ".yuu-clip" / "project.db")
    video = session.query(Video).first()
    track = session.query(AudioTrack).filter_by(video_id=video.id).first()
    tx = Transcript(audio_track_id=track.id, model_name="base")
    session.add(tx)
    session.flush()
    seg = TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=1000, text="helo")
    session.add(seg)
    session.commit()
    seg_id = seg.id
    session.close()

    state = _fail_first_commit(monkeypatch)
    r = client.put(f"/api/caption-segments/{seg_id}", json={"text": "hello"})

    assert r.status_code == 200
    assert state["failed_once"] is True


def test_speaker_rename_route_survives_a_transient_lock(client, project_dir, monkeypatch):
    from yuu_clip.db.models import Speaker, Video, make_session

    session = make_session(project_dir / ".yuu-clip" / "project.db")
    video = session.query(Video).first()
    speaker = Speaker(video_id=video.id, display_index=1)
    session.add(speaker)
    session.commit()
    speaker_id = speaker.id
    session.close()

    state = _fail_first_commit(monkeypatch)
    r = client.put(f"/api/speakers/{speaker_id}", json={"name": "Yuu"})

    assert r.status_code == 200
    assert state["failed_once"] is True


def test_segment_speaker_reassign_route_survives_a_transient_lock(client, project_dir, monkeypatch):
    from yuu_clip.db.models import (
        AudioTrack,
        Speaker,
        Transcript,
        TranscriptSegment,
        Video,
        make_session,
    )

    session = make_session(project_dir / ".yuu-clip" / "project.db")
    video = session.query(Video).first()
    track = session.query(AudioTrack).filter_by(video_id=video.id).first()
    tx = Transcript(audio_track_id=track.id, model_name="base")
    session.add(tx)
    session.flush()
    speaker = Speaker(video_id=video.id, display_index=1, name="Mara", confirmed=True)
    session.add(speaker)
    session.flush()
    seg = TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=1000, text="hello")
    session.add(seg)
    session.commit()
    seg_id, speaker_id = seg.id, speaker.id
    session.close()

    state = _fail_first_commit(monkeypatch)
    r = client.put(f"/api/transcript-segments/{seg_id}/speaker", json={"speaker_id": speaker_id})

    assert r.status_code == 200
    assert state["failed_once"] is True


def test_name_corrections_apply_route_survives_a_transient_lock(client, project_dir, monkeypatch):
    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment, Video, make_session

    session = make_session(project_dir / ".yuu-clip" / "project.db")
    video = session.query(Video).first()
    video_id = video.id
    track = session.query(AudioTrack).filter_by(video_id=video.id).first()
    tx = Transcript(audio_track_id=track.id, model_name="base")
    session.add(tx)
    session.flush()
    seg = TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=1000, text="You were amazing")
    session.add(seg)
    session.commit()
    seg_id = seg.id
    session.close()

    state = _fail_first_commit(monkeypatch)
    r = client.post(f"/api/videos/{video_id}/name-corrections/apply", json={"corrections": [{
        "segment_id": seg_id, "token_start": 0, "token_end": 3, "token": "You", "replacement": "Yuu",
    }]})

    assert r.status_code == 200
    assert r.json()["applied"] == 1
    assert state["failed_once"] is True
