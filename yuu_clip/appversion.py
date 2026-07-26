"""The installed package version, resolved once from importlib metadata.

Shared by the surfaces that stamp or report the app version (backup manifests,
/api/status, the update check) so the "read metadata, fall back on
PackageNotFoundError" block lives in exactly one place.
"""
from __future__ import annotations

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version


def app_version(default: str = "unknown") -> str:
    """The installed yuu-clip version, or *default* when the package metadata
    isn't available (running from an unpackaged checkout). Callers that compare
    the value as a semver (the update check) pass a parseable *default* like
    "0.0.0"; display-only callers take the "unknown" default."""
    try:
        return _pkg_version("yuu-clip")
    except PackageNotFoundError:
        return default
