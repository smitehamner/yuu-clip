"""Drift guard: the committed static/bundle.js must match a fresh concatenation of the
files listed in static/bundle.manifest. Regenerate with `yuu-dev bundle` when this fails
(mirrors the third-party-notices drift guard)."""
from __future__ import annotations

from yuu_clip.dev.bundle import (
    BUNDLE_PATH,
    MANIFEST_PATH,
    STATIC_DIR,
    build_bundle,
    manifest_files,
    parse_manifest,
)


def test_committed_bundle_matches_manifest():
    assert BUNDLE_PATH.exists(), "static/bundle.js missing - run `yuu-dev bundle`"
    assert BUNDLE_PATH.read_text(encoding="utf-8") == build_bundle(), (
        "static/bundle.js is stale - run `yuu-dev bundle` and commit the result"
    )


def test_every_manifest_file_exists():
    for name in manifest_files():
        assert (STATIC_DIR / name).exists(), f"manifest lists a missing file: {name}"


def test_manifest_has_no_duplicates():
    names = manifest_files()
    assert len(names) == len(set(names)), "bundle.manifest lists a file twice"


def test_index_html_loads_only_the_bundle():
    index_html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    assert '<script src="/static/bundle.js"></script>' in index_html
    for name in manifest_files():
        assert f'src="/static/{name}"' not in index_html, (
            f"index.html still has an individual <script> tag for {name} - it should load"
            " only bundle.js"
        )


class TestParseManifest:
    def test_skips_comments_and_blank_lines(self):
        text = "# a comment\n\nstate.js\n   \nformat.js\n"
        assert parse_manifest(text) == ["state.js", "format.js"]

    def test_strips_surrounding_whitespace(self):
        assert parse_manifest("  utils.js  \n") == ["utils.js"]

    def test_manifest_path_is_under_static(self):
        assert MANIFEST_PATH.parent == STATIC_DIR
