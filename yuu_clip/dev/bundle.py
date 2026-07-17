"""``yuu-dev bundle`` - build the web UI's committed JS bundle.

The frontend ships as one committed ``bundle.esm.js`` - real ESM modules
(import/export) bundled by **esbuild** from the graph rooted at ``main.esm.js``
(see ``scripts/build-esm.mjs``). index.html loads that single file.

The committed bundle is the artifact the server, packaging, and CI ship - Node is
only needed to *rebuild* it, never to run the app.
``tests/unit/test_bundle_drift.py`` guards that the committed file is current;
regenerate with ``yuu-dev bundle`` when it drifts.

(History: the UI used to also ship a classic ``bundle.js`` concatenated from
``bundle.manifest``. Every module has since migrated to ESM, so that second bundle
and its manifest were retired.)
"""
from __future__ import annotations

import subprocess
import time
from pathlib import Path

import typer

from yuu_clip.dev import htmlstitch
from yuu_clip.dev._base import REPO_ROOT, app, console, node_available

STATIC_DIR = REPO_ROOT / "yuu_clip" / "web" / "static"
ELECTRON_DIR = REPO_ROOT / "electron"
ESM_BUILD_SCRIPT = REPO_ROOT / "scripts" / "build-esm.mjs"
ESM_ENTRY = STATIC_DIR / "main.esm.js"
ESM_BUNDLE_PATH = STATIC_DIR / "bundle.esm.js"
WIZARD_ENTRY = ELECTRON_DIR / "setup-renderer.js"
WIZARD_BUNDLE_PATH = ELECTRON_DIR / "setup.bundle.js"


def esbuild_available() -> bool:
    """True when the ESM bundle can be (re)built here: Node on PATH and esbuild
    installed. The drift guard skips when this is False so `test-api` still passes
    offline / on a machine without the JS toolchain (bundle.esm.js is committed)."""
    return node_available() and (REPO_ROOT / "node_modules" / "esbuild").exists()


def build_esm_bundle(outfile: Path | None = None, target: str | None = None) -> None:
    """Run esbuild (via scripts/build-esm.mjs) to produce the committed bundles.

    With no args, builds both entries (web + wizard) to their default outfiles.
    ``target`` ("web" | "wizard") + ``outfile`` builds a single entry to a chosen path -
    the drift guards pass a temp path beside the real artifact so their comparison copy
    is byte-identical (the inline sourcemap's ``sources`` are relative to the outfile
    dir). Raises RuntimeError if Node is missing or esbuild fails, so a stale bundle can
    never pass silently as an up-to-date one.
    """
    if not node_available():
        raise RuntimeError(
            "Node.js is required to build the committed bundles but `node` is not on PATH. "
            "Install Node (https://nodejs.org) and run `npm install`, then retry "
            "`yuu-dev bundle`. The committed bundles still ship without Node."
        )
    cmd = ["node", str(ESM_BUILD_SCRIPT)]
    if target is not None:
        cmd += ["--target", target]
    if outfile is not None:
        cmd += ["--outfile", str(outfile)]
    proc = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True)
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout).strip()
        raise RuntimeError(
            f"esbuild failed (exit {proc.returncode}). Did you run `npm install`?\n{detail}"
        )


def _write_index() -> None:
    """Stitch index.src.html + partials/ -> index.html. Pure Python (no Node), so it
    runs even when the JS toolchain is absent."""
    htmlstitch.write_index()
    console.print(
        f"Wrote {htmlstitch.INDEX_HTML} (stitched from {htmlstitch.INDEX_SRC.name} + partials/)"
    )


def _write_bundle() -> None:
    _write_index()
    build_esm_bundle()
    console.print(f"Wrote {ESM_BUNDLE_PATH} (esbuild, ESM graph from {ESM_ENTRY.name})")
    console.print(f"Wrote {WIZARD_BUNDLE_PATH} (esbuild, wizard graph from {WIZARD_ENTRY.name})")


def _watched_paths() -> list[Path]:
    """Every source the committed artifacts are built from: the web ESM graph (every
    static .js except the generated bundle - the graph is not enumerable without parsing
    imports), the wizard ESM graph (electron/setup-renderer.js + the shared modules it
    pulls from static/shared, already covered by the static sweep), and the index.html
    stitch inputs (index.src.html + partials/*.html). Any edit triggers a rebuild."""
    js = [p for p in STATIC_DIR.rglob("*.js") if p != ESM_BUNDLE_PATH]
    js.append(WIZARD_ENTRY)
    html = [htmlstitch.INDEX_SRC, *htmlstitch.PARTIALS_DIR.rglob("*.html")]
    return js + [p for p in html if p.exists()]


def _snapshot() -> dict[Path, float]:
    snapshot: dict[Path, float] = {}
    for path in _watched_paths():
        try:
            snapshot[path] = path.stat().st_mtime
        except OSError:
            snapshot[path] = 0.0
    return snapshot


def _watch() -> None:
    console.print("[cyan](watching for changes - Ctrl+C to stop)[/cyan]")
    last = _snapshot()
    try:
        while True:
            time.sleep(0.5)
            current = _snapshot()
            if current != last:
                last = current
                _write_bundle()
    except KeyboardInterrupt:
        pass


@app.command("bundle")
def bundle(
    watch: bool = typer.Option(
        False, "--watch",
        help="Rebuild whenever any static/*.js in the ESM graph, index.src.html, or a "
             "partial changes (Ctrl+C to stop).",
    ),
) -> None:
    """Build the committed web-UI artifacts: stitch index.html from index.src.html +
    partials/, then build static/bundle.esm.js from the esbuild ESM graph."""
    if not ESM_ENTRY.exists():
        console.print(f"[red]{ESM_ENTRY} not found.[/red]")
        raise typer.Exit(1)
    _write_bundle()
    if watch:
        _watch()
