"""Drift guard for the committed web-UI bundle. Regenerate with `yuu-dev bundle`
when a test here fails.

The UI ships as one committed bundle.esm.js (esbuild ESM graph rooted at
main.esm.js). Reproducing it needs Node + esbuild, so the guard skips when the JS
toolchain is absent - `test-api` must still pass offline (the committed
bundle.esm.js is what ships)."""
from __future__ import annotations

import os
import re
import time
from pathlib import Path

import pytest

from yuu_clip.dev.bundle import (
    ESM_BUNDLE_PATH,
    STATIC_DIR,
    build_esm_bundle,
    esbuild_available,
)


def _best_effort_unlink(path: Path) -> None:
    # esbuild's output handle can linger briefly on Windows (AV scan / delayed
    # flush) after the build subprocess returns, so an immediate unlink can raise
    # WinError 32. This is throwaway scratch, never load-bearing - a short retry
    # then give up, so cleanup can never turn into a spurious test failure.
    for _ in range(10):
        try:
            path.unlink(missing_ok=True)
            return
        except OSError:
            time.sleep(0.1)


def test_committed_esm_bundle_is_current():
    if not esbuild_available():
        pytest.skip("Node/esbuild not installed - run `npm install` to guard bundle.esm.js")
    assert ESM_BUNDLE_PATH.exists(), "static/bundle.esm.js missing - run `yuu-dev bundle`"
    # The comparison copy must be a sibling of bundle.esm.js: the inline sourcemap's
    # `sources` are emitted relative to the outfile's directory, so only a file in
    # STATIC_DIR is byte-identical. A PID-unique name keeps concurrent test runs (the
    # dev routinely has several) off one shared scratch path - a fixed name races,
    # one run's esbuild write colliding with another's read/unlink. The `*.check.js`
    # name is gitignored.
    check_path = STATIC_DIR / f"bundle.esm.check.{os.getpid()}.js"
    try:
        build_esm_bundle(outfile=check_path)
        fresh = check_path.read_bytes()
    finally:
        _best_effort_unlink(check_path)
    assert ESM_BUNDLE_PATH.read_bytes() == fresh, (
        "static/bundle.esm.js is stale - run `yuu-dev bundle` and commit the result"
    )


def test_index_html_loads_only_the_esm_bundle():
    index_html = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    loaded = set(re.findall(r'src="/static/([\w.-]+\.js)"', index_html))
    assert loaded == {"bundle.esm.js"}, (
        "index.html must load only the committed bundle.esm.js, but loads"
        f" {sorted(loaded)} - do not add individual <script> tags; migrate the module"
        " into the esbuild graph (main.esm.js) and re-run `yuu-dev bundle`"
    )


def test_classic_bundle_is_retired():
    # The classic concat bundle.js + bundle.manifest were removed once every module
    # became ESM. Guard against either creeping back (e.g. a reverted migration).
    assert not (STATIC_DIR / "bundle.js").exists(), (
        "static/bundle.js is back - the classic bundle was retired; all UI modules are ESM"
    )
    assert not (STATIC_DIR / "bundle.manifest").exists(), (
        "static/bundle.manifest is back - the classic bundle was retired; all UI modules are ESM"
    )
