"""Drift guards for the two committed web-UI bundles. Regenerate both with
`yuu-dev bundle` when a test here fails.

- bundle.js (classic concat) is reproduced in pure Python, so its guard always runs.
- bundle.esm.js (esbuild) needs Node + esbuild to reproduce, so its guard skips when
  the JS toolchain is absent - `test-api` must still pass offline (the committed
  bundle.esm.js is what ships)."""
from __future__ import annotations

import re

import pytest

from yuu_clip.dev.bundle import (
    BUNDLE_PATH,
    ESM_BUNDLE_PATH,
    MANIFEST_PATH,
    STATIC_DIR,
    build_bundle,
    build_esm_bundle,
    esbuild_available,
    manifest_files,
    parse_manifest,
)

# Modules that have been migrated to real ESM - they live in the esbuild graph
# (main.esm.js -> bundle.esm.js), never in the classic manifest. Add to this list as
# more modules migrate off bundle.js.
_ESM_MODULES = (
    "main.esm.js", "state.js", "format.js", "colorpicker.js", "panelnav.js", "jobs.js", "preview.js", "utils.js",
    "ui.js", "helpmodals.js", "shortcuts.js", "modelcatalog.js", "videos.js", "videos-timeline.js",
    "videos-summary.js", "videos-runmeta.js", "sessions.js", "clips.js", "clipbulk.js", "clipexport.js",
    "clipcreate.js", "analyze.js", "reel.js", "contexts.js", "settings.js",
    "settings-previews.js", "settings-installs.js", "settings-backup.js", "projects.js",
    "modeldownload.js", "sounds.js", "hotwords.js", "exportpresets.js",
)


def test_committed_classic_bundle_matches_manifest():
    assert BUNDLE_PATH.exists(), "static/bundle.js missing - run `yuu-dev bundle`"
    assert BUNDLE_PATH.read_text(encoding="utf-8") == build_bundle(), (
        "static/bundle.js is stale - run `yuu-dev bundle` and commit the result"
    )


def test_committed_esm_bundle_is_current():
    if not esbuild_available():
        pytest.skip("Node/esbuild not installed - run `npm install` to guard bundle.esm.js")
    assert ESM_BUNDLE_PATH.exists(), "static/bundle.esm.js missing - run `yuu-dev bundle`"
    check_path = STATIC_DIR / "bundle.esm.check.js"
    try:
        build_esm_bundle(outfile=check_path)
        fresh = check_path.read_bytes()
    finally:
        check_path.unlink(missing_ok=True)
    assert ESM_BUNDLE_PATH.read_bytes() == fresh, (
        "static/bundle.esm.js is stale - run `yuu-dev bundle` and commit the result"
    )


def test_every_manifest_file_exists():
    for name in manifest_files():
        assert (STATIC_DIR / name).exists(), f"manifest lists a missing file: {name}"


def test_manifest_has_no_duplicates():
    names = manifest_files()
    assert len(names) == len(set(names)), "bundle.manifest lists a file twice"


def test_esm_modules_not_in_classic_manifest():
    names = set(manifest_files())
    for esm in _ESM_MODULES:
        assert esm not in names, (
            f"{esm} is an ESM module now - it belongs in the esbuild graph, not bundle.manifest"
        )


def test_index_html_loads_only_the_bundles():
    index_html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    loaded = set(re.findall(r'src="/static/([\w.-]+\.js)"', index_html))
    assert loaded == {"bundle.js", "bundle.esm.js"}, (
        "index.html must load only the two committed bundles (bundle.esm.js then"
        f" bundle.js), but loads {sorted(loaded)} - do not add individual <script> tags"
    )


class TestParseManifest:
    def test_skips_comments_and_blank_lines(self):
        text = "# a comment\n\nstate.js\n   \njobs.js\n"
        assert parse_manifest(text) == ["state.js", "jobs.js"]

    def test_strips_surrounding_whitespace(self):
        assert parse_manifest("  utils.js  \n") == ["utils.js"]

    def test_manifest_path_is_under_static(self):
        assert MANIFEST_PATH.parent == STATIC_DIR
