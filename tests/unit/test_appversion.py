"""yuu_clip/appversion.py - the shared installed-version lookup."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError
from unittest import mock

from yuu_clip import appversion
from yuu_clip.appversion import app_version


class TestAppVersion:
    def test_returns_installed_version(self):
        with mock.patch.object(appversion, "_pkg_version", return_value="1.2.3"):
            assert app_version() == "1.2.3"

    def test_default_when_metadata_missing(self):
        with mock.patch.object(appversion, "_pkg_version", side_effect=PackageNotFoundError):
            assert app_version() == "unknown"

    def test_custom_default_when_metadata_missing(self):
        # The update check needs a parseable semver fallback, not "unknown".
        with mock.patch.object(appversion, "_pkg_version", side_effect=PackageNotFoundError):
            assert app_version("0.0.0") == "0.0.0"
