"""Drift guard for the committed static/index.html.

index.html is a build artifact stitched from index.src.html + partials/ by
`yuu-dev bundle`. The stitch is pure Python (no Node), so unlike the esbuild bundle
guard this one always runs in the unit tier - offline included. Regenerate with
`yuu-dev bundle` when a test here fails, and commit the result.
"""
from __future__ import annotations

import re

from yuu_clip.dev.htmlstitch import (
    INDEX_HTML,
    INDEX_SRC,
    PARTIALS_DIR,
    render_index,
)

_INCLUDE_RE = re.compile(rb"<!-- @@include (\S+) -->")


def test_index_src_and_partials_exist():
    assert INDEX_SRC.exists(), "index.src.html missing - it is the source for index.html"
    assert PARTIALS_DIR.is_dir(), "static/partials/ missing"


def test_committed_index_html_is_current():
    assert INDEX_HTML.exists(), "static/index.html missing - run `yuu-dev bundle`"
    assert INDEX_HTML.read_bytes() == render_index(), (
        "static/index.html is stale - edit index.src.html / partials/ then run "
        "`yuu-dev bundle` and commit the result (never hand-edit index.html)"
    )


def test_every_include_marker_resolves():
    referenced = set(_INCLUDE_RE.findall(INDEX_SRC.read_bytes()))
    missing = [r.decode() for r in referenced if not (PARTIALS_DIR / r.decode()).exists()]
    assert not missing, f"index.src.html includes missing partials: {missing}"


def test_partials_are_single_level():
    # The stitch expands one level only; a partial that itself contains an include
    # marker would silently not expand. Guard against it.
    offenders = [
        p.relative_to(PARTIALS_DIR).as_posix()
        for p in PARTIALS_DIR.rglob("*.html")
        if _INCLUDE_RE.search(p.read_bytes())
    ]
    assert not offenders, f"partials must not contain @@include markers: {offenders}"
