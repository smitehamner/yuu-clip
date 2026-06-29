"""Read-only review commands: status, clips."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.table import Table

from yuu_clip.cli._base import _get_session, _project_dir, app, console


@app.command()
def status(
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
):
    """Show the status of all analyzed recordings in this project."""
    from yuu_clip.db.models import ClipCandidate, Video

    proj_dir = _project_dir(project)
    session  = _get_session(proj_dir)
    videos   = session.query(Video).order_by(Video.created_at).all()

    if not videos:
        console.print("[dim]No recordings analyzed yet.  Run [cyan]yuuclip analyze <path>[/cyan] to start.[/dim]")
        return

    t = Table(show_header=True, header_style="bold cyan", border_style="dim")
    t.add_column("Filename")
    t.add_column("Duration",   width=12)
    t.add_column("Tracks",     width=7)
    t.add_column("Clips",      width=11)
    t.add_column("Status",     width=12)

    _STATUS_STYLE = {
        "done": "green", "transcribed": "cyan",
        "labeled": "yellow", "probed": "yellow", "pending": "dim",
    }
    for v in videos:
        n_cands = session.query(ClipCandidate).filter_by(video_id=v.id).count()
        style   = _STATUS_STYLE.get(v.status, "white")
        t.add_row(
            v.filename, v.duration_hms,
            str(len(v.audio_tracks)), str(n_cands),
            f"[{style}]{v.status}[/{style}]",
        )
    console.print(t)


@app.command()
def clips(
    video_name: Optional[str] = typer.Argument(None, help="Filter by video filename (partial match)"),
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
    status_filter: Optional[str] = typer.Option(None, "--status", "-s", help="unreviewed|approved|rejected  (unreviewed = not yet reviewed)"),
    limit: int = typer.Option(50, "--limit", "-n"),
):
    """List clips."""
    from yuu_clip.db.models import ClipCandidate, Video

    proj_dir = _project_dir(project)
    session  = _get_session(proj_dir)

    q = session.query(ClipCandidate).join(Video)
    if video_name:
        q = q.filter(Video.filename.contains(video_name))
    if status_filter:
        db_status = "pending" if status_filter == "unreviewed" else status_filter
        q = q.filter(ClipCandidate.status == db_status)
    q = q.order_by(ClipCandidate.video_id, ClipCandidate.start_ms).limit(limit)
    candidates = q.all()

    if not candidates:
        console.print("[dim]No clips found.[/dim]")
        return

    _STATUS_STYLE    = {"approved": "green", "rejected": "red", "pending": "dim"}
    _STATUS_DISPLAY  = {"pending": "Unreviewed", "approved": "Approved", "rejected": "Rejected"}
    t = Table(show_header=True, header_style="bold cyan", border_style="dim")
    t.add_column("ID",     width=5)
    t.add_column("Video",  width=22)
    t.add_column("Start",  width=8)
    t.add_column("Length", width=8)
    t.add_column("Status", width=10)
    t.add_column("Tags",   width=24)
    t.add_column("Excerpt")

    for c in candidates:
        style   = _STATUS_STYLE.get(c.status, "white")
        label   = _STATUS_DISPLAY.get(c.status, c.status)
        excerpt = (c.transcript_excerpt or "")[:60].replace("\n", " ")
        t.add_row(
            str(c.id), c.video.filename[:22], c.start_hms, c.duration_hms,
            f"[{style}]{label}[/{style}]",
            ", ".join(c.tags[:2]),
            excerpt,
        )
    console.print(t)
