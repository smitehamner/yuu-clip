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
and its manifest were retired - see the ui-esm-migration branch.)
"""
from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path

import typer

from yuu_clip.dev._base import REPO_ROOT, app, console

STATIC_DIR = REPO_ROOT / "yuu_clip" / "web" / "static"
ESM_BUILD_SCRIPT = REPO_ROOT / "scripts" / "build-esm.mjs"
ESM_ENTRY = STATIC_DIR / "main.esm.js"
ESM_BUNDLE_PATH = STATIC_DIR / "bundle.esm.js"


def node_available() -> bool:
    return shutil.which("node") is not None


def esbuild_available() -> bool:
    """True when the ESM bundle can be (re)built here: Node on PATH and esbuild
    installed. The drift guard skips when this is False so `test-api` still passes
    offline / on a machine without the JS toolchain (bundle.esm.js is committed)."""
    return node_available() and (REPO_ROOT / "node_modules" / "esbuild").exists()


def build_esm_bundle(outfile: Path | None = None) -> None:
    """Run esbuild (via scripts/build-esm.mjs) to produce the ESM bundle.

    ``outfile`` overrides the default static/bundle.esm.js target - the drift guard
    passes a temp path in the same directory so its comparison copy is byte-identical.
    Raises RuntimeError if Node is missing or esbuild fails, so a stale ESM bundle
    can never pass silently as an up-to-date one.
    """
    if not node_available():
        raise RuntimeError(
            "Node.js is required to build bundle.esm.js but `node` is not on PATH. "
            "Install Node (https://nodejs.org) and run `npm install`, then retry "
            "`yuu-dev bundle`. The committed bundle.esm.js still ships without Node."
        )
    cmd = ["node", str(ESM_BUILD_SCRIPT)]
    if outfile is not None:
        cmd += ["--outfile", str(outfile)]
    proc = subprocess.run(cmd, cwd=str(REPO_ROOT), capture_output=True, text=True)
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout).strip()
        raise RuntimeError(
            f"esbuild failed (exit {proc.returncode}). Did you run `npm install`?\n{detail}"
        )


def _write_bundle() -> None:
    build_esm_bundle()
    console.print(f"Wrote {ESM_BUNDLE_PATH} (esbuild, ESM graph from {ESM_ENTRY.name})")


def _watched_paths() -> list[Path]:
    """Every ESM source the bundle is built from. The graph is not enumerable without
    parsing imports, so watch every static .js except the generated bundle - any edit
    triggers a rebuild."""
    return [p for p in STATIC_DIR.rglob("*.js") if p != ESM_BUNDLE_PATH]


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
        help="Rebuild whenever any static/*.js in the ESM graph changes (Ctrl+C to stop).",
    ),
) -> None:
    """Build the web UI's committed static/bundle.esm.js from the esbuild ESM graph."""
    if not ESM_ENTRY.exists():
        console.print(f"[red]{ESM_ENTRY} not found.[/red]")
        raise typer.Exit(1)
    _write_bundle()
    if watch:
        _watch()
