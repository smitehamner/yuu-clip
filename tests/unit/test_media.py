"""Unit tests - web/media.py's share-delete streaming response.

media_file_response's body generator runs after HTTP headers are already sent
(StreamingResponse sends http.response.start before touching the body
iterator), so a failure inside it can't become an HTTP error response and
bypasses app.py's global exception handler. Logging inside the generator
itself is the only way such a failure reaches the app's own log file.
"""
from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

import pytest

from yuu_clip.web import media


def _fake_request() -> SimpleNamespace:
    return SimpleNamespace(headers=SimpleNamespace(get=lambda name: None))


async def _drain(body_iterator) -> bytes:
    chunks = [chunk async for chunk in body_iterator]
    return b"".join(chunks)


def test_stream_failure_is_logged_and_reraised(tmp_path, monkeypatch, caplog):
    path = tmp_path / "clip.mp4"
    path.write_bytes(b"hello world")

    def _raise_open(*_args, **_kwargs):
        raise OSError("file locked")

    monkeypatch.setattr(media, "_open_shared", _raise_open)

    response = media.media_file_response(path, _fake_request())

    with caplog.at_level(logging.ERROR, logger="yuu_clip.web.media"):
        with pytest.raises(OSError, match="file locked"):
            asyncio.run(_drain(response.body_iterator))

    assert any("Media streaming failed" in record.message for record in caplog.records)
    assert any(str(path) in record.message for record in caplog.records)


def test_stream_happy_path_yields_full_content(tmp_path):
    path = tmp_path / "clip.mp4"
    path.write_bytes(b"hello world")

    response = media.media_file_response(path, _fake_request())

    assert asyncio.run(_drain(response.body_iterator)) == b"hello world"
