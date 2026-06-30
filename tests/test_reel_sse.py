"""
Integration tests for the reel SSE endpoint (reel.py demo_events, the
"reel_events" path flagged in ROADMAP "Known issues").

demo_events forwards ctx to subprocess_sse so the running process is tracked on
ctx.analyze_proc (for /api/status and graceful shutdown) and the queued
demo_cmd is cleared when the stream finishes. That ctx-passing path had no
coverage and was silently broken before the Phase 3 bug-hunt pass.

The command is stubbed with a trivial cross-platform process rather than the
real reel CLI: the path under test is the route + SSE wiring + ctx lifecycle,
which is identical regardless of what the subprocess does, and a stub keeps the
test deterministic and ffmpeg-free.
"""
from __future__ import annotations

import json
import sys

from fastapi.testclient import TestClient


def _drain_sse(client: TestClient) -> list:
    messages = []
    with client.stream("GET", "/api/demo/events") as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        for raw in resp.iter_lines():
            if raw.startswith("data: "):
                messages.append(json.loads(raw[len("data: "):]))
    return messages


class TestDemoEventsSSE:
    def test_events_without_queued_demo_returns_400(self, client):
        r = client.get("/api/demo/events")
        assert r.status_code == 400
        assert "start" in r.json()["detail"].lower()

    def test_events_streams_subprocess_output_then_done(self, client):
        ctx = client.app.state.ctx
        ctx.demo_cmd = [
            sys.executable, "-c",
            "print('reel progress 1'); print('reel progress 2')",
        ]
        messages = _drain_sse(client)
        assert "reel progress 1" in messages
        assert "reel progress 2" in messages
        assert messages[-1] == "__DONE__"

    def test_events_clears_queued_cmd_and_proc_on_success(self, client):
        ctx = client.app.state.ctx
        ctx.demo_cmd = [sys.executable, "-c", "print('ok')"]
        _drain_sse(client)
        # clear_cmd_attr="demo_cmd" — the queued command is consumed exactly once
        assert ctx.demo_cmd is None
        # subprocess_sse resets analyze_proc in its finally block
        assert ctx.analyze_proc is None

    def test_events_reports_nonzero_exit_before_done(self, client):
        ctx = client.app.state.ctx
        ctx.demo_cmd = [sys.executable, "-c", "import sys; sys.exit(3)"]
        messages = _drain_sse(client)
        assert any("exited with code 3" in m for m in messages)
        assert messages[-1] == "__DONE__"
        assert ctx.demo_cmd is None
