"""``yuu-dev release-smoke`` - drive a live server through the release-gate flows.

Plan of record: the release-smoke-harness plan set in the maintainer's planning repo.

This module owns option parsing and the try/finally shell (preflight, run the
selected steps serially, always switch the server back to its original project).
client.py / media.py / steps/ / report.py hold the parts that don't need Typer.
"""
from __future__ import annotations

import shutil
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import NoReturn, Optional

import typer

from yuu_clip.dev._base import REPO_ROOT, app, console
from yuu_clip.dev.smoke import media
from yuu_clip.dev.smoke.client import SmokeClient
from yuu_clip.dev.smoke.report import STATUS_FAIL, STATUS_PASS, STATUS_SKIP, StepResult, render_console, write_report
from yuu_clip.dev.smoke.steps import (
    SECTION_ORDER,
    SECTIONS,
    STEP_SPECS,
    SmokeContext,
    StepSkip,
    StepSpec,
    bootstrap_state,
)

SCRATCH_MARKER = ".yuu-clip-smoke-scratch"
SCRATCH_PREFIX = "yuu-clip-smoke-"


def _abort(message: str) -> NoReturn:
    console.print(f"[red]{message}[/red]")
    raise typer.Exit(1)


def _packaged_safe_report_dir(explicit: Optional[Path], scratch_root: Path) -> Path:
    """`.test-logs/` only when REPO_ROOT looks like an actual checkout (finding 5) -
    a packaged install's REPO_ROOT resolves somewhere inside/next to site-packages,
    where writing a report would be surprising clutter."""
    if explicit is not None:
        return explicit
    if (REPO_ROOT / "pyproject.toml").is_file():
        return REPO_ROOT / ".test-logs"
    return scratch_root


def _validate_explicit_project(path: Path) -> None:
    db_path = path / ".yuu-clip" / "project.db"
    if not db_path.is_file():
        return
    if path.name.endswith("_autotest") or (path / SCRATCH_MARKER).is_file():
        return
    _abort(
        f"{path} looks like a real project ({db_path} present) - refusing to run "
        "release-smoke's destructive flow against it. Pass a folder ending in "
        "_autotest, or one release-smoke created itself (carries " + SCRATCH_MARKER + ")."
    )


def _write_scratch_marker(path: Path) -> None:
    if path.is_dir():
        (path / SCRATCH_MARKER).write_text("created by yuu-dev release-smoke\n", encoding="utf-8")


def _preflight(client: SmokeClient, no_llm: bool) -> str:
    try:
        status = client.get_json("/api/status")
    except Exception as exc:
        _abort(f"Server not reachable at {client.base_url}: {exc}")
    if status.get("any_running"):
        _abort("Another job is running on the server - wait or cancel it before running release-smoke.")

    prereqs = client.get_json("/api/prereqs")
    if not prereqs.get("ffmpeg_ok"):
        _abort("ffmpeg is not available to the server - fix prereqs before running release-smoke.")

    if not no_llm:
        capabilities = client.get_json("/api/llm/capabilities")
        if not capabilities.get("text"):
            _abort(
                f"LLM scoring is unavailable ({capabilities.get('detail')}) - "
                "pass --no-llm to downgrade score/description assertions to SKIPPED, or fix LLM setup."
            )

    return client.get_json("/api/projects")["current"]


def _resolve_media(
    media_dir: Optional[Path], cache_dir: Path, scratch_root: Path, max_minutes: int
) -> media.ResolvedSource:
    staging_dir = scratch_root / "yuu-clip-smoke-staging"
    source = media.resolve_source(
        media_dir=media_dir.resolve() if media_dir else None,
        cache_dir=cache_dir, raw_dir=staging_dir, max_source_minutes=max_minutes,
    )
    if source.fallback_reason:
        console.print(f"[yellow]{source.fallback_reason}[/yellow]")
    return source


def _select_specs(only: Optional[str], from_step: Optional[int]) -> tuple[StepSpec, ...]:
    if only is not None and only not in SECTIONS:
        _abort(f"--only {only!r} is not a known section: {', '.join(SECTION_ORDER)}")
    specs = SECTIONS[only] if only is not None else STEP_SPECS
    if from_step is not None:
        specs = tuple(s for s in specs if s.step_no >= from_step)
    if not specs:
        _abort("No steps selected - check --only/--from.")
    return specs


def _run_steps(ctx: SmokeContext, specs: tuple[StepSpec, ...]) -> list[StepResult]:
    results: list[StepResult] = []
    failed = False
    for spec in specs:
        if failed:
            results.append(StepResult(spec.step_no, spec.name, spec.uc_ids, STATUS_SKIP,
                                       detail="skipped after an earlier step failed"))
            console.print(render_console([results[-1]])[0], markup=False)
            continue
        ctx.state.pop("_last_frames", None)
        started = time.monotonic()
        try:
            detail, frames = spec.run(ctx)
            result = StepResult(spec.step_no, spec.name, spec.uc_ids, STATUS_PASS,
                                 detail=detail, duration_s=time.monotonic() - started, frames=frames)
        except StepSkip as exc:
            result = StepResult(spec.step_no, spec.name, spec.uc_ids, STATUS_SKIP,
                                 detail=str(exc), duration_s=time.monotonic() - started)
        except Exception as exc:
            # A step that drained an SSE stream before failing (an unexpected
            # outcome, a missing frame) left its frames on ctx.state - surface them
            # in the report so a failure is diagnosable without re-running.
            result = StepResult(spec.step_no, spec.name, spec.uc_ids, STATUS_FAIL,
                                 detail=str(exc), duration_s=time.monotonic() - started,
                                 frames=ctx.state.get("_last_frames", []))
            failed = True
        results.append(result)
        console.print(render_console([result])[0], markup=False)
    return results


def _restore_original_project(client: SmokeClient, original_project: Optional[str]) -> None:
    if not original_project:
        return
    try:
        client.post_json("/api/projects/switch", {"path": original_project})
        console.print(f"[cyan]Restored server to its original project: {original_project}[/cyan]")
    except Exception as exc:
        console.print(f"[red]Failed to switch the server back to {original_project}: {exc}[/red]")
        console.print("[red]Manually switch projects in the app before continuing.[/red]")


@app.command("release-smoke")
def release_smoke(
    base_url: str = typer.Option("http://127.0.0.1:8080", "--base-url"),
    media_dir: Optional[Path] = typer.Option(None, "--media-dir", help="Use every video in this folder instead of the cached/downloaded default."),
    scratch_root: Optional[Path] = typer.Option(None, "--scratch-root", help="Default: the system temp dir."),
    report_dir: Optional[Path] = typer.Option(None, "--report-dir"),
    keep: bool = typer.Option(False, "--keep", help="Keep scratch dirs even on success."),
    no_llm: bool = typer.Option(False, "--no-llm", help="Analyze with no_score; downgrade score/description assertions to SKIPPED."),
    online: bool = typer.Option(False, "--online", help="Also run the live URL import row (needs network access)."),
    project: Optional[Path] = typer.Option(None, "--project", help="Reuse a specific scratch dir instead of a fresh timestamped one. Required by --only/--from past step 1, pointed at a dir a prior run already analyzed."),
    only: Optional[str] = typer.Option(None, "--only", help=f"Run only one section: {', '.join(SECTION_ORDER)}."),
    from_step: Optional[int] = typer.Option(None, "--from", help="Resume from this step number (needs --project)."),
    max_source_minutes: int = typer.Option(10, "--max-source-minutes"),
) -> None:
    """Drive a live yuu-dev server through the release-gate flow over HTTP/SSE.

    Needs a running server (``yuu-dev serve``) - this does not start one.
    """
    selected_specs = _select_specs(only, from_step)
    needs_bootstrap = selected_specs[0].step_no != 1
    if needs_bootstrap and project is None:
        _abort(
            "--only/--from skipping step 1 needs --project pointing at a scratch dir "
            "a prior full run already analyzed (pass --keep on that run to retain it)."
        )

    root = (scratch_root or Path(tempfile.gettempdir())).resolve()
    root.mkdir(parents=True, exist_ok=True)
    cache_dir = root / media.CACHE_DIRNAME

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    scratch_dir = (project or root / f"{SCRATCH_PREFIX}{timestamp}").resolve()
    restore_dir = (root / f"{SCRATCH_PREFIX}{timestamp}-restore").resolve()
    if project is not None:
        _validate_explicit_project(scratch_dir)
        # Step 1 asserts `created is True` unconditionally - a validated reuse
        # target is safe to destroy, so clear it rather than special-casing the
        # assertion for --project. Skipped when resuming (needs_bootstrap): that
        # reuse is explicitly about keeping the directory's prior analyzed state.
        if scratch_dir.exists() and not needs_bootstrap:
            shutil.rmtree(scratch_dir)

    client = SmokeClient(base_url)
    results: list[StepResult] = []
    original_project: Optional[str] = None
    source = None
    success = False
    try:
        original_project = _preflight(client, no_llm)
        console.print(f"[cyan]Preflight OK. Original project: {original_project}[/cyan]")

        source = _resolve_media(media_dir, cache_dir, root, max_source_minutes)
        ctx = SmokeContext(client=client, scratch_dir=scratch_dir, restore_dir=restore_dir,
                            source=source, no_llm=no_llm, online=online)
        if needs_bootstrap:
            client.post_json("/api/projects/switch", {"path": str(scratch_dir)})
            bootstrap_state(ctx)
        results = _run_steps(ctx, selected_specs)
        success = all(r.status != STATUS_FAIL for r in results)
    finally:
        _restore_original_project(client, original_project)
        _write_scratch_marker(scratch_dir)
        _write_scratch_marker(restore_dir)

        report_directory = _packaged_safe_report_dir(report_dir, root)
        report_path = report_directory / f"release-smoke-{timestamp}.md"
        meta = {
            "started_at": timestamp, "base_url": base_url,
            "media_mode": "synthetic" if (source and source.is_synthetic) else "real",
            "source": str(source.video_path) if source else "(not resolved)",
            "only": only or "(all)", "from_step": from_step or 1,
        }
        write_report(report_path, results, meta)

        if success and not keep:
            shutil.rmtree(restore_dir, ignore_errors=True)
            if project is None:
                shutil.rmtree(scratch_dir, ignore_errors=True)

    console.print("")
    for line in render_console(results):
        console.print(line, markup=False)
    console.print(f"[dim]Report: {report_path}[/dim]")
    raise typer.Exit(0 if success else 1)
