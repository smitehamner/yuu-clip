"""``yuu-dev test-js`` - the vitest unit-test runner for the web UI's pure logic.

These tests (``tests/js/**/*.test.js``) import the ESM modules directly and assert
pure logic - formatters, escaping, score math, filter/sort, parse helpers - in a
happy-dom environment. No browser, no live server, sub-second. They complement the
Playwright suite (``tests/ui/``), which keeps the genuine end-to-end flows (navigation,
SSE, focus traps, live getComputedStyle).

Needs Node + ``npm install`` (vitest is a dev-only dep). Skips with a clear message when
Node is absent - mirroring the bundle drift guard - so the offline path is not blocked.
Vitest is invoked via ``node <entry>`` rather than the ``.bin`` shim so it works the same
on Windows (no ``.cmd`` resolution) as on macOS/Linux.
"""
from __future__ import annotations

import shutil
from typing import List, Optional

import typer

from yuu_clip.dev._base import REPO_ROOT, app, console, pytest_env, run_and_tee

JS_LOG = REPO_ROOT / "test-js-last.log"
VITEST_ENTRY = REPO_ROOT / "node_modules" / "vitest" / "vitest.mjs"


def _node_available() -> bool:
    return shutil.which("node") is not None


@app.command("test-js", context_settings={"ignore_unknown_options": True})
def test_js(
    watch: bool = typer.Option(False, "--watch", help="Re-run on change (vitest watch)."),
    vitest_args: Optional[List[str]] = typer.Argument(None),
) -> None:
    """Run the vitest JS unit layer over tests/js/ (browser-less, no server)."""
    if not _node_available():
        console.print("[red]Node.js is required for `yuu-dev test-js` but `node` is not on PATH.[/red]")
        console.print("[red]Install Node (https://nodejs.org) and run `npm install`, then retry.[/red]")
        raise typer.Exit(3)
    if not VITEST_ENTRY.exists():
        console.print("[red]vitest is not installed - run `npm install`, then retry `yuu-dev test-js`.[/red]")
        raise typer.Exit(3)
    mode = [] if watch else ["run"]
    cmd = ["node", str(VITEST_ENTRY), *mode, *(vitest_args or [])]
    code, output = run_and_tee(cmd, REPO_ROOT, pytest_env())
    JS_LOG.write_text(output, encoding="utf-8")
    console.print(f"[dim]Full log: {JS_LOG}[/dim]")
    raise typer.Exit(code)
