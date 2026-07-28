"""Import from URL command - download a public Twitch VOD or YouTube video."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

from yuu_clip.cli._base import _project_dir, app, console


@app.command("import-url")
def import_url_cmd(
    url: str = typer.Argument(..., help="Twitch VOD or YouTube video URL"),
    project: Optional[Path] = typer.Option(None, "-p", "--project", help="Project directory (default: cwd)"),
) -> None:
    """Download a public Twitch VOD or YouTube video so it can be analyzed."""
    from yuu_clip.config import project_downloads_dir
    from yuu_clip.log import configure_logging
    from yuu_clip.url_import import ImportUrlError, download_video

    proj_dir = _project_dir(project)
    configure_logging(proj_dir)
    downloads_dir = project_downloads_dir(proj_dir)

    console.print(f"\n[bold]yuuclip  ·  import-url[/bold]\n  {url}\n")
    # Flush every progress line: stdout is a pipe here (the web UI reads it as SSE),
    # so it is block-buffered by default and yt-dlp's frequent progress lines would
    # batch up instead of streaming live - the download percentage would appear stuck.
    # (The analyze/score CLIs avoid this by printing progress through Rich, which
    # flushes per write; this command prints yt-dlp's hook output plainly.)
    try:
        path = download_video(url, downloads_dir, progress_line_cb=lambda line: print(line, flush=True))
    except (ImportUrlError, RuntimeError) as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    # Machine-readable marker the web UI's SSE stream looks for to grab the
    # downloaded path - printed plain (not via console.print) so the literal
    # brackets aren't misread as Rich markup. Leading \n guarantees this starts
    # a fresh line even if yt-dlp's last progress-bar write ended mid-line with
    # a bare \r (no \n) - otherwise this marker can get silently appended to that
    # unterminated line, and the web UI's anchored ^[Imported] regex then fails
    # to match, intermittently losing the downloaded path (found 2026-07-27).
    print(f"\n[Imported] {path}", flush=True)
    console.print("\n[bold green]Download complete.[/bold green] Open New Recording to analyze it.\n")
