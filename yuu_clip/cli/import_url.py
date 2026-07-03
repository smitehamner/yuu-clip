"""Import from URL command — download a public Twitch VOD or YouTube video."""
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
    from yuu_clip.url_import import ImportUrlError, download_video

    proj_dir = _project_dir(project)
    downloads_dir = project_downloads_dir(proj_dir)

    console.print(f"\n[bold]yuuclip  ·  import-url[/bold]\n  {url}\n")
    try:
        path = download_video(url, downloads_dir, progress_line_cb=print)
    except (ImportUrlError, RuntimeError) as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    # Machine-readable marker the web UI's SSE stream looks for to grab the
    # downloaded path — printed plain (not via console.print) so the literal
    # brackets aren't misread as Rich markup.
    print(f"[Imported] {path}")
    console.print("\n[bold green]Download complete.[/bold green] Open New Recording to analyze it.\n")
