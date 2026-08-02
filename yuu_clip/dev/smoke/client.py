"""Stdlib-only HTTP/SSE client for ``yuu-dev release-smoke``.

Uses ``urllib`` rather than httpx/requests so this module runs under the packaged
app's bundled interpreter too, which carries only the runtime dependencies (httpx
is a dev-only dependency of the rest of the ``yuu-dev`` CLI).
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any, Iterator, Optional

from yuu_clip.web.jobevents import parse_event

DEFAULT_TIMEOUT_S = 30.0
SSE_READ_TIMEOUT_S = 30.0


class SmokeHttpError(RuntimeError):
    """An HTTP call a step made failed, naming the endpoint and the response body."""

    def __init__(self, method: str, url: str, status: int, body: str):
        super().__init__(f"{method} {url} -> {status}: {body[:500]}")
        self.method = method
        self.url = url
        self.status = status
        self.body = body


class SmokeClient:
    def __init__(self, base_url: str, timeout_s: float = DEFAULT_TIMEOUT_S):
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _open(self, request: urllib.request.Request, timeout: Optional[float]) -> bytes:
        try:
            with urllib.request.urlopen(request, timeout=timeout or self.timeout_s) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise SmokeHttpError(request.get_method(), request.full_url, exc.code, body) from exc

    def get_json(self, path: str, timeout: Optional[float] = None) -> Any:
        request = urllib.request.Request(self._url(path), method="GET")
        return json.loads(self._open(request, timeout).decode("utf-8"))

    def _write_json(self, method: str, path: str, payload: Any, timeout: Optional[float]) -> Any:
        """Send *payload* as a JSON body via *method*, or an empty body when
        *payload* is None - the empty-body form is for routes that take their
        arguments as query params (e.g. ``/api/restore/inspect?archive_path=...``)."""
        if payload is None:
            data, headers = b"", {}
        else:
            data, headers = json.dumps(payload).encode("utf-8"), {"Content-Type": "application/json"}
        request = urllib.request.Request(self._url(path), data=data, method=method, headers=headers)
        body = self._open(request, timeout)
        return json.loads(body.decode("utf-8")) if body else None

    def post_json(self, path: str, payload: Any = None, timeout: Optional[float] = None) -> Any:
        return self._write_json("POST", path, payload, timeout)

    def patch_json(self, path: str, payload: Any, timeout: Optional[float] = None) -> Any:
        return self._write_json("PATCH", path, payload, timeout)

    def put_json(self, path: str, payload: Any, timeout: Optional[float] = None) -> Any:
        return self._write_json("PUT", path, payload, timeout)

    def delete_json(self, path: str, timeout: Optional[float] = None) -> Any:
        return self._write_json("DELETE", path, None, timeout)

    def get_bytes(
        self, path: str, range_header: Optional[str] = None, timeout: Optional[float] = None
    ) -> tuple[int, bytes]:
        headers = {"Range": range_header} if range_header else {}
        request = urllib.request.Request(self._url(path), method="GET", headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout or self.timeout_s) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()

    def get_status(self, path: str, headers: Optional[dict] = None, timeout: Optional[float] = None) -> int:
        """GET *path* with arbitrary extra headers, returning just the status code -
        used for the loopback/cross-site guard check, where the body doesn't matter."""
        request = urllib.request.Request(self._url(path), method="GET", headers=headers or {})
        try:
            with urllib.request.urlopen(request, timeout=timeout or self.timeout_s) as response:
                return response.status
        except urllib.error.HTTPError as exc:
            return exc.code

    def stream_sse(
        self, path: str, deadline_s: float, method: str = "GET", payload: Any = None
    ) -> Iterator[dict]:
        """Drain a ``text/event-stream`` endpoint, yielding one decoded frame per SSE
        event in order (``parse_event``'s shape, plus the raw payload under ``_raw``).
        Most job routes are a bare GET that starts and streams; a few (suggest-framing,
        analyze-frames, import-url/inspect) are POST-based SSE instead, some with a
        JSON body - *method*/*payload* select between them. *deadline_s* is a
        wall-clock budget for the whole stream, on top of a generous per-read socket
        timeout - a stalled stream fails loudly with a clear message rather than
        hanging forever."""
        url = self._url(path)
        if payload is None:
            data, headers = None, {}
        else:
            data, headers = json.dumps(payload).encode("utf-8"), {"Content-Type": "application/json"}
        request = urllib.request.Request(url, data=data, method=method, headers=headers)
        deadline = time.monotonic() + deadline_s
        try:
            response = urllib.request.urlopen(request, timeout=SSE_READ_TIMEOUT_S)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise SmokeHttpError("GET", url, exc.code, body) from exc
        try:
            yield from _read_frames(response, url, deadline, deadline_s)
        finally:
            response.close()


def _read_frames(response: Any, url: str, deadline: float, deadline_s: float) -> Iterator[dict]:
    buffer: list[str] = []
    while True:
        if time.monotonic() > deadline:
            raise TimeoutError(f"GET {url} exceeded its {deadline_s:.0f}s wall-clock deadline")
        try:
            raw_line = response.readline()
        except TimeoutError as exc:
            raise TimeoutError(f"GET {url} stalled - no data for {SSE_READ_TIMEOUT_S:.0f}s") from exc
        except OSError as exc:
            raise ConnectionError(f"GET {url} lost its connection mid-stream: {exc}") from exc
        if not raw_line:
            break
        line = raw_line.decode("utf-8", errors="replace").rstrip("\r\n")
        if line == "":
            if buffer:
                yield from _decode_buffer(buffer)
                buffer = []
            continue
        if line.startswith("data:"):
            buffer.append(line[len("data:"):].strip())
    if buffer:
        yield from _decode_buffer(buffer)


def _decode_buffer(buffer: list[str]) -> Iterator[dict]:
    try:
        payload = json.loads("\n".join(buffer))
    except ValueError:
        return
    decoded = parse_event(payload)
    decoded["_raw"] = payload
    yield decoded
