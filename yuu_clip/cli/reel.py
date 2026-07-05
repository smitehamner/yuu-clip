"""Highlight reel command."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

import typer

from yuu_clip.cli._base import BYTES_PER_MB, _load_project, app, console


@app.command()
def reel(
    project:    Optional[Path]  = typer.Option(None, "-p", "--project"),
    video_ids:  list[int]       = typer.Option([], "--video", "-v", help="Video ID(s) to include (default: all)"),
    video_id:   Optional[int]   = typer.Option(None, "--video-id", help="Single video ID (alias for --video)"),
    clip_ids:   list[int]       = typer.Option([], "--clip-id", help="Specific clip IDs to include (in order); overrides video/status/score filters"),
    top:        Optional[int]   = typer.Option(None, "--top", help="Top N clips per video by overall score"),
    min_score:  float           = typer.Option(0.0,  "--min-score", help="Minimum overall score to include"),
    status_filter: Optional[str] = typer.Option(None, "--status", help="Filter by clip status (e.g. approved)"),
    transition: str             = typer.Option("fade", "--transition", "-t",
                                     help="Transition type: fade|dissolve|wipeleft|wiperight|slideleft|slideright|none"),
    trans_dur:  float           = typer.Option(0.5,  "--trans-dur",  help="Transition overlap duration in seconds"),
    title_dur:  Optional[float] = typer.Option(None, "--title-dur",  help="Title card display duration in seconds (default: the configured Title card duration)"),
    output:     Optional[Path]  = typer.Option(None, "-o", "--output",
                                     help="Output file path (default: .yuu-clip/reels/reel_<timestamp>.mkv)"),
    captions:   bool            = typer.Option(False, "--captions", help="Also write a stitched <reel>.srt caption sidecar"),
    bake_captions: bool         = typer.Option(False, "--bake-captions", help="Burn captions into the reel video (also writes the SRT sidecar); uses the configured Caption style"),
) -> None:
    """Compile a highlight reel from approved clips with title cards and transitions."""
    from yuu_clip.db.models import Video
    from yuu_clip.reel import TRANSITIONS

    if transition not in TRANSITIONS:
        console.print(f"[red]Unknown transition '{transition}'. Choose from: {', '.join(TRANSITIONS)}[/red]")
        raise typer.Exit(1)

    proj_dir, session, config = _load_project(project)
    export_dir = proj_dir / ".yuu-clip" / "exports"
    reels_dir  = proj_dir / ".yuu-clip" / "reels"
    title_dur  = title_dur if title_dur is not None else config.title_card_duration_s

    all_clips = _select_reel_clips(session, clip_ids, video_ids, video_id, status_filter, min_score, top)
    if not all_clips:
        console.print("[yellow]No clips found matching the filters.[/yellow]")
        raise typer.Exit(0)

    vid_ids   = {c.video_id for c in all_clips}
    video_map = {v.id: v for v in session.query(Video).filter(Video.id.in_(vid_ids)).all()}

    if not output:
        ts     = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = reels_dir / f"reel_{ts}.mkv"
    output.parent.mkdir(parents=True, exist_ok=True)

    _print_reel_plan(all_clips, video_map, output, transition)
    _compile_reel(all_clips, video_map, export_dir, output, transition, trans_dur, title_dur, config)

    if captions or bake_captions:
        from yuu_clip.reel import build_reel_caption_srt
        srt_path = build_reel_caption_srt(session, output)
        if srt_path:
            console.print(f"  [green]OK[/green] captions {srt_path.name}")
        if bake_captions:
            _burn_reel_captions(output, srt_path, config)


def _select_reel_clips(session, clip_ids, video_ids, video_id, status_filter, min_score, top) -> list:
    """Return the ordered clip list: explicit clip IDs when given, else a filtered gather."""
    if clip_ids:
        from yuu_clip.db.models import ClipCandidate as _CC
        id_map = {c.id: c for c in session.query(_CC).filter(_CC.id.in_(clip_ids)).all()}
        return [id_map[cid] for cid in clip_ids if cid in id_map]

    effective_video_ids = list(video_ids)
    if video_id is not None and video_id not in effective_video_ids:
        effective_video_ids.append(video_id)
    return _gather_demo_clips(session, effective_video_ids, status_filter, min_score, top)


def _print_reel_plan(all_clips, video_map, output: Path, transition: str) -> None:
    console.print(f"\n[bold]Building highlight reel[/bold] — {len(all_clips)} clip(s), transition=[cyan]{transition}[/cyan]")
    for c in all_clips:
        vid  = video_map[c.video_id]
        desc = f"  {c.description}" if c.description else ""
        console.print(
            f"  Clip {c.id}  [{vid.filename[:30]}  {c.start_hms}  {c.duration_hms}]"
            f"  score={c.score_overall:.3f}{desc}"
        )
    console.print(f"\n  Output: [cyan]{output}[/cyan]\n  [dim]Generating title cards and encoding...[/dim]")


def _compile_reel(all_clips, video_map, export_dir: Path, output: Path,
                  transition: str, trans_dur: float, title_dur: float, config) -> None:
    from yuu_clip.reel import compile_demo
    try:
        compile_demo(
            clips=all_clips, video_map=video_map, export_dir=export_dir,
            output=output, config=config, transition=transition, trans_dur=trans_dur, title_dur=title_dur,
            name_template=config.export_name_template,
        )
        size_mb = output.stat().st_size / BYTES_PER_MB
        console.print(f"  [green]OK[/green] {output.name}  [dim]({size_mb:.1f} MB)[/dim]")
    except FileNotFoundError as e:
        console.print(f"  [red]{e}[/red]")
        raise typer.Exit(1)
    except RuntimeError as e:
        # run_ffmpeg raises this for a missing FFmpeg (with install instructions) or a
        # non-zero ffmpeg exit (with the captured stderr).
        console.print(f"  [red]{e}[/red]")
        raise typer.Exit(1)


def _burn_reel_captions(output: Path, srt_path: Optional[Path], config) -> None:
    """Burn the stitched reel SRT into the reel video using the configured Caption style.

    Skips (with a note) when there was no transcript data to stitch — an empty SRT
    would be a wasteful no-op re-encode.
    """
    if srt_path is None or not srt_path.exists() or srt_path.stat().st_size == 0:
        console.print("  [yellow]No transcript data — burn-in skipped[/yellow]")
        return
    from yuu_clip.analyze.extract import CaptionStyle
    from yuu_clip.reel import burn_reel_captions
    style = CaptionStyle(
        font_name=config.caption_font_name,
        font_size=config.caption_font_size,
        position=config.caption_position,
    )
    console.print("  Burning captions into the reel...")
    try:
        burn_reel_captions(output, srt_path, style)
        console.print("  [green]OK[/green] captions burned in")
    except RuntimeError as e:
        console.print(f"  [red]Caption burn-in failed: {e}[/red]")
        raise typer.Exit(1)


def _gather_demo_clips(session, video_ids: list[int], status_filter, min_score: float, top) -> list:
    """Query clip candidates for the demo command, apply filters, and optionally keep top-N per video."""
    from yuu_clip.db.models import ClipCandidate, Video

    q = session.query(ClipCandidate).join(Video)
    if video_ids:
        q = q.filter(ClipCandidate.video_id.in_(video_ids))
    if status_filter:
        q = q.filter(ClipCandidate.status == status_filter)
    if min_score > 0:
        q = q.filter(ClipCandidate.score_overall >= min_score)
    clips = q.order_by(ClipCandidate.video_id, ClipCandidate.score_overall.desc()).all()

    if top:
        by_video: dict[int, list] = {}
        for c in clips:
            by_video.setdefault(c.video_id, []).append(c)
        clips = []
        for vid_clips in by_video.values():
            clips.extend(vid_clips[:top])
        clips.sort(key=lambda c: (c.video_id, c.start_ms))

    return clips
