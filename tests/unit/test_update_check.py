"""Unit tests for the GitHub update check (yuu_clip/update_check.py).

The HTTP call is mocked (urllib.request.urlopen) - see test_framing.py for the
same pattern used elsewhere in this repo. No real network access.
"""
from __future__ import annotations

import contextlib
import io
import json
import urllib.error

from yuu_clip import update_check


def _fake_response(payload: dict):
    body = json.dumps(payload).encode("utf-8")

    @contextlib.contextmanager
    def _urlopen(request, timeout=None):
        yield io.BytesIO(body)

    return _urlopen


class TestParseVersion:
    def test_strips_leading_v(self):
        assert update_check._parse_version("v0.1.28") == (0, 1, 28)

    def test_bare_number_string(self):
        assert update_check._parse_version("0.1.28") == (0, 1, 28)

    def test_ignores_non_numeric_prerelease_suffix(self):
        assert update_check._parse_version("0.1.28-dev") == (0, 1, 28)

    def test_empty_string_is_lowest(self):
        assert update_check._parse_version("") == (0,)


class TestCheckForUpdate:
    def test_reports_update_available_when_latest_is_newer(self, monkeypatch):
        monkeypatch.setattr(
            update_check.urllib.request, "urlopen",
            _fake_response({"tag_name": "v0.2.0", "html_url": "https://example.test/releases/v0.2.0"}),
        )
        result = update_check.check_for_update("0.1.28")
        assert result.update_available is True
        assert result.latest_version == "0.2.0"
        assert result.release_url == "https://example.test/releases/v0.2.0"
        assert result.error is None

    def test_reports_up_to_date_when_versions_match(self, monkeypatch):
        monkeypatch.setattr(
            update_check.urllib.request, "urlopen",
            _fake_response({"tag_name": "v0.1.28", "html_url": "https://example.test/releases/v0.1.28"}),
        )
        result = update_check.check_for_update("0.1.28")
        assert result.update_available is False
        assert result.error is None

    def test_reports_up_to_date_when_current_is_newer_than_latest_release(self, monkeypatch):
        # e.g. a dev build ahead of the last tagged release.
        monkeypatch.setattr(
            update_check.urllib.request, "urlopen",
            _fake_response({"tag_name": "v0.1.0", "html_url": "https://example.test/releases/v0.1.0"}),
        )
        result = update_check.check_for_update("0.2.0")
        assert result.update_available is False

    def test_network_failure_returns_error_not_exception(self, monkeypatch):
        def _boom(request, timeout=None):
            raise urllib.error.URLError("no internet")

        monkeypatch.setattr(update_check.urllib.request, "urlopen", _boom)
        result = update_check.check_for_update("0.1.28")
        assert result.error is not None
        assert result.update_available is False
        assert result.latest_version is None

    def test_http_error_returns_error_not_exception(self, monkeypatch):
        # Mirrors what an unauthenticated request to a private repo returns (404)
        # until the repo is flipped public.
        def _boom(request, timeout=None):
            raise urllib.error.HTTPError("url", 404, "Not Found", {}, None)

        monkeypatch.setattr(update_check.urllib.request, "urlopen", _boom)
        result = update_check.check_for_update("0.1.28")
        assert result.error is not None

    def test_malformed_json_returns_error_not_exception(self, monkeypatch):
        @contextlib.contextmanager
        def _urlopen(request, timeout=None):
            yield io.BytesIO(b"not json")

        monkeypatch.setattr(update_check.urllib.request, "urlopen", _urlopen)
        result = update_check.check_for_update("0.1.28")
        assert result.error is not None

    def test_missing_tag_name_returns_error_not_exception(self, monkeypatch):
        monkeypatch.setattr(
            update_check.urllib.request, "urlopen",
            _fake_response({"html_url": "https://example.test"}),
        )
        result = update_check.check_for_update("0.1.28")
        assert result.error is not None

    def test_current_version_is_always_echoed_back(self, monkeypatch):
        monkeypatch.setattr(
            update_check.urllib.request, "urlopen",
            _fake_response({"tag_name": "v0.1.28", "html_url": "https://example.test"}),
        )
        result = update_check.check_for_update("0.1.28")
        assert result.current_version == "0.1.28"
