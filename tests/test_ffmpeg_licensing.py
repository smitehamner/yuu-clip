from __future__ import annotations

import re
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
_FETCH_SCRIPT = _REPO_ROOT / "scripts" / "fetch-ffmpeg-runtime.ps1"
_NOTICES_DOC = _REPO_ROOT / "docs" / "dev" / "THIRD-PARTY-NOTICES-FFMPEG.md"


def _fetch_script_text() -> str:
    return _FETCH_SCRIPT.read_text(encoding="utf-8-sig")


def _notices_text() -> str:
    return _NOTICES_DOC.read_text(encoding="utf-8")


def _pinned_ffmpeg_version() -> str:
    match = re.search(r"\$FFMPEG_VERSION\s*=\s*'([^']+)'", _fetch_script_text())
    assert match, "FFMPEG_VERSION constant not found in fetch-ffmpeg-runtime.ps1"
    return match.group(1)


def _pinned_binary_sha256() -> str:
    match = re.search(r"\$SHA256\s*=\s*'([0-9a-f]{64})'", _fetch_script_text())
    assert match, "SHA256 constant not found in fetch-ffmpeg-runtime.ps1"
    return match.group(1)


def _pinned_asset_identifiers() -> list[str]:
    text = _fetch_script_text()
    names = re.findall(r"\$(?:ASSET_NAME|DOWNLOAD_URL)\s*=\s*\"([^\"]+)\"", text)
    assert names, "ASSET_NAME/DOWNLOAD_URL constants not found in fetch-ffmpeg-runtime.ps1"
    return names


class TestFetchScriptAndNoticesAgree:
    def test_notices_doc_records_the_pinned_version(self):
        version = _pinned_ffmpeg_version()
        assert version in _notices_text(), (
            f"fetch-ffmpeg-runtime.ps1 pins FFmpeg {version} but "
            f"THIRD-PARTY-NOTICES-FFMPEG.md doesn't mention it - update the notices doc"
        )

    def test_notices_doc_records_the_pinned_binary_hash(self):
        sha256 = _pinned_binary_sha256()
        assert sha256 in _notices_text(), (
            "fetch-ffmpeg-runtime.ps1's pinned binary SHA256 isn't recorded in "
            "THIRD-PARTY-NOTICES-FFMPEG.md - update the notices doc"
        )


class TestNoNonfreeComponents:
    """Guards against ever pinning a --enable-nonfree build (e.g. one bundling
    libfdk_aac or DeckLink support), which would change yuu-clip's distribution
    terms. See the CRITICAL warning in fetch-ffmpeg-runtime.ps1."""

    def test_pinned_asset_is_not_named_as_a_nonfree_build(self):
        # gyan.dev/BtbN both name nonfree-enabled assets with "nonfree" in the
        # filename/tag - the one mechanical signal available without actually
        # downloading and inspecting the binary's build config.
        for identifier in _pinned_asset_identifiers():
            assert "nonfree" not in identifier.lower(), (
                f"Pinned FFmpeg asset identifier looks like a nonfree build: {identifier!r}"
            )

    def test_notices_doc_records_no_nonfree_components(self):
        assert re.search(r"Nonfree components\s*\|\s*\*\*None\*\*", _notices_text()), (
            "THIRD-PARTY-NOTICES-FFMPEG.md's 'Nonfree components' row must read "
            "'**None**' - update it (and re-verify the pinned build) if this changed"
        )
