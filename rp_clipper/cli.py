"""
rp-clip  —  RP gaming session clip extraction CLI
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

app = typer.Typer(
    name="rp-clip",
    help="RP gaming clip extraction pipeline.",
    add_completion=False,
)
console = Console()

# Supported video extensions (case-insensitive)
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".flv", ".ts"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _project_dir(given: Optional[Path]) -> Path:
    return (given or Path.cwd()).resolve()


def _get_session(project_dir: Path):
    from rp_clipper.config import project_db_path
    from rp_clipper.db.models import make_session
    return make_session(project_db_path(project_dir))


def _resolve_videos(path: Path) -> list[Path]:
    """Accept a single video file or a directory of video files."""
    path = path.resolve()
    if path.is_dir():
        return sorted(
            p for p in path.iterdir()
            if p.suffix.lower() in VIDEO_EXTENSIONS
        )
    if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS:
        return [path]
    console.print(f"[red]Not a video file or directory: {path}[/red]")
    raise typer.Exit(1)


# ---------------------------------------------------------------------------
# probe
# ---------------------------------------------------------------------------

@app.command()
def probe(
    path: Path = typer.Argument(..., help="Video file to probe"),
):
    """Show audio tracks and metadata without ingesting."""
    from rp_clipper.config import find_ffmpeg
    from rp_clipper.ingest.probe import probe_video

    try:
        find_ffmpeg()
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    try:
        info = probe_video(path.resolve())
    except (FileNotFoundError, RuntimeError) as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    console.print(Panel(
        f"[bold]{info.path.name}[/bold]\n"
        f"Duration: [cyan]{info.duration_hms}[/cyan]  ·  "
        f"{info.width}×{info.height}  ·  {info.fps:.2f} fps",
        title="[bold]Video info[/bold]",
        border_style="dim",
    ))

    t = Table(show_header=True, header_style="bold cyan", border_style="dim")
    t.add_column("#", width=3)
    t.add_column("Stream idx", width=10)
    t.add_column("Codec", width=8)
    t.add_column("Rate", width=9)
    t.add_column("Channels", width=9)
    t.add_column("Title tag")

    for i, s in enumerate(info.audio_streams):
        t.add_row(
            str(i + 1),
            str(s.stream_index),
            s.codec_name,
            f"{s.sample_rate // 1000} kHz",
            str(s.channels),
            s.title_tag or "[dim]—[/dim]",
        )

    console.print(t)


# ---------------------------------------------------------------------------
# ingest
# ---------------------------------------------------------------------------

@app.command()
def ingest(
    path: Path = typer.Argument(..., help="Video file or directory of videos to ingest"),
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project directory (default: cwd)"),
    model: str = typer.Option("base", "--model", "-m", help="Whisper model: tiny|base|small|medium|large-v3"),
    device: str = typer.Option("auto", "--device", help="Compute device: auto|cpu|cuda"),
    profile: Optional[str] = typer.Option(None, "--profile", help="Apply a saved track-label profile"),
    no_transcribe: bool = typer.Option(False, "--no-transcribe", help="Skip transcription step"),
    no_segment: bool = typer.Option(False, "--no-segment", help="Skip clip candidate generation"),
    force: bool = typer.Option(False, "--force", help="Re-process even if already ingested"),
    language: Optional[str] = typer.Option(None, "--language", "-l", help="Force Whisper language (e.g. en)"),
):
    """
    Full Phase 1 pipeline: probe → label tracks → extract audio → transcribe → generate candidates.
    """
    from rp_clipper.config import Config, find_ffmpeg, project_audio_dir
    from rp_clipper.db.models import AudioTrack, Video
    from rp_clipper.ingest.extract import extract_audio_track
    from rp_clipper.ingest.labeler import label_tracks
    from rp_clipper.ingest.probe import probe_video
    from rp_clipper.segments.windower import generate_candidates
    from rp_clipper.transcribe.whisper_runner import transcribe_track

    try:
        find_ffmpeg()
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    proj_dir  = _project_dir(project)
    session   = _get_session(proj_dir)
    config    = Config.load(proj_dir)
    audio_dir = project_audio_dir(proj_dir)

    # Override config with CLI options
    config.whisper_model   = model
    config.whisper_device  = device

    videos = _resolve_videos(path)
    console.print(f"\n[bold]rp-clip  ·  Phase 1[/bold]  ({len(videos)} video(s))\n")

    for video_path in videos:
        _ingest_one(
            video_path=video_path,
            proj_dir=proj_dir,
            session=session,
            config=config,
            audio_dir=audio_dir,
            profile=profile,
            no_transcribe=no_transcribe,
            no_segment=no_segment,
            force=force,
            language=language,
        )

    session.commit()
    console.print("\n[bold green]Done![/bold green]  Run [cyan]rp-clip status[/cyan] to see your project.\n")


def _ingest_one(
    video_path, proj_dir, session, config, audio_dir,
    profile, no_transcribe, no_segment, force, language
):
    from datetime import datetime

    from rp_clipper.config import LABEL_WEIGHTS
    from rp_clipper.db.models import AudioTrack, Transcript, Video
    from rp_clipper.ingest.extract import extract_audio_track
    from rp_clipper.ingest.labeler import label_tracks
    from rp_clipper.ingest.probe import probe_video
    from rp_clipper.segments.windower import generate_candidates
    from rp_clipper.transcribe.whisper_runner import transcribe_track

    abs_path = str(video_path.resolve())

    # --- Check if already processed ---
    existing = session.query(Video).filter_by(path=abs_path).first()
    if existing and existing.status == "done" and not force:
        console.print(f"[dim]Skipping {video_path.name} (already done — use --force to redo)[/dim]")
        return

    console.rule(f"[bold]{video_path.name}[/bold]")

    # --- 1. Probe ---
    console.print("  📹 [bold]Probing…[/bold]")
    try:
        info = probe_video(video_path)
    except Exception as e:
        console.print(f"  [red]Probe failed: {e}[/red]")
        return

    console.print(
        f"  [dim]Duration: [cyan]{info.duration_hms}[/cyan]  ·  "
        f"{info.width}×{info.height}  ·  {info.fps:.2f} fps  ·  "
        f"{len(info.audio_streams)} audio track(s)[/dim]"
    )

    # --- Upsert video row ---
    if existing:
        video = existing
    else:
        video = Video(
            path=abs_path,
            filename=video_path.name,
            duration_ms=info.duration_ms,
            fps=info.fps,
            width=info.width,
            height=info.height,
            status="probed",
        )
        session.add(video)
        session.flush()

    # --- 2. Label tracks ---
    console.print("  🏷  [bold]Labeling audio tracks…[/bold]")
    assignments = label_tracks(info, profile_name=profile)

    # Upsert AudioTrack rows
    track_objs: list[AudioTrack] = []
    for i, s_info in enumerate(info.audio_streams):
        assign = assignments[i]
        existing_track = (
            session.query(AudioTrack)
            .filter_by(video_id=video.id, stream_index=s_info.stream_index)
            .first()
        )
        if existing_track and not force:
            track_objs.append(existing_track)
            continue

        track = existing_track or AudioTrack(video_id=video.id)
        track.stream_index    = s_info.stream_index
        track.label           = assign["label"]
        track.relevance_weight = assign["weight"]
        track.do_transcribe   = assign["do_transcribe"]
        track.codec           = s_info.codec_name
        track.sample_rate     = s_info.sample_rate
        track.channels        = s_info.channels
        track.channel_layout  = s_info.channel_layout
        track.stream_title_tag = s_info.title_tag
        if not existing_track:
            session.add(track)
        track_objs.append(track)

    session.flush()
    video.status = "labeled"

    # --- 3. Extract audio ---
    console.print("  ✂  [bold]Extracting audio…[/bold]")
    for track in track_objs:
        if track.extracted_path and Path(track.extracted_path).exists() and not force:
            console.print(f"  [dim]  Track {track.stream_index} already extracted[/dim]")
            continue

        stem = Path(video.filename).stem
        out_name = f"{stem}_stream{track.stream_index}.wav"
        out_path = audio_dir / out_name

        try:
            extract_audio_track(
                video_path=video_path,
                stream_index=track.stream_index,
                output_path=out_path,
                sample_rate=config.audio_sample_rate,
                channels=config.audio_channels,
            )
            track.extracted_path = str(out_path)
            size_mb = out_path.stat().st_size / 1_048_576
            console.print(
                f"  [green]  ✓[/green] [{track.label}] → {out_name}  "
                f"[dim]({size_mb:.1f} MB)[/dim]"
            )
        except RuntimeError as e:
            console.print(f"  [red]  ✗ Extraction failed: {e}[/red]")

    session.flush()
    video.status = "extracting"

    # --- 4. Transcribe ---
    if not no_transcribe:
        console.print(f"  🎙  [bold]Transcribing  (model: {config.whisper_model})…[/bold]")
        transcripts: list[Transcript] = []

        for track in track_objs:
            if not track.do_transcribe:
                console.print(f"  [dim]  Track {track.stream_index} [{track.label}] — skipping (not marked for transcription)[/dim]")
                continue
            if not track.extracted_path:
                console.print(f"  [yellow]  Track {track.stream_index} has no extracted audio — skip[/yellow]")
                continue

            console.print(f"  [dim]  Track {track.stream_index} [{track.label}]…[/dim]")
            try:
                t = transcribe_track(track, config, session, language=language)
                seg_count = len(t.segments)
                console.print(
                    f"  [green]  ✓[/green] [{track.label}]  {seg_count} segments  "
                    f"[dim](language: {t.language or 'auto'})[/dim]"
                )
                transcripts.append(t)
            except Exception as e:
                console.print(f"  [red]  ✗ Transcription failed: {e}[/red]")

        session.flush()
        video.status = "transcribed"
    else:
        transcripts = []

    # --- 5. Generate clip candidates ---
    if not no_segment and transcripts:
        console.print("  📎 [bold]Generating clip candidates…[/bold]")
        # Load transcripts with their track relationships for the windower
        candidates = generate_candidates(video, transcripts, config, session)
        console.print(f"  [green]  ✓[/green] {len(candidates)} candidates created")
        video.status = "done"
    elif not transcripts and not no_transcribe:
        console.print("  [yellow]  No transcripts available — skipping segmentation[/yellow]")
    else:
        video.status = "transcribed"

    from datetime import datetime
    video.processed_at = datetime.utcnow()
    session.flush()


# ---------------------------------------------------------------------------
# status
# ---------------------------------------------------------------------------

@app.command()
def status(
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
):
    """Show the status of all ingested videos in this project."""
    proj_dir = _project_dir(project)
    session  = _get_session(proj_dir)

    from rp_clipper.db.models import ClipCandidate, Video
    videos = session.query(Video).order_by(Video.created_at).all()

    if not videos:
        console.print("[dim]No videos ingested yet.  Run [cyan]rp-clip ingest <path>[/cyan] to start.[/dim]")
        return

    t = Table(show_header=True, header_style="bold cyan", border_style="dim")
    t.add_column("Filename")
    t.add_column("Duration", width=12)
    t.add_column("Tracks", width=7)
    t.add_column("Candidates", width=11)
    t.add_column("Status", width=12)

    for v in videos:
        n_tracks = len(v.audio_tracks)
        n_cands  = session.query(ClipCandidate).filter_by(video_id=v.id).count()
        status_style = {
            "done":        "green",
            "transcribed": "cyan",
            "labeled":     "yellow",
            "probed":      "yellow",
            "pending":     "dim",
        }.get(v.status, "white")

        t.add_row(
            v.filename,
            v.duration_hms,
            str(n_tracks),
            str(n_cands),
            f"[{status_style}]{v.status}[/{status_style}]",
        )

    console.print(t)


# ---------------------------------------------------------------------------
# clips
# ---------------------------------------------------------------------------

@app.command()
def clips(
    video_name: Optional[str] = typer.Argument(None, help="Filter by video filename (partial match)"),
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
    status_filter: Optional[str] = typer.Option(None, "--status", "-s", help="pending|approved|rejected"),
    limit: int = typer.Option(50, "--limit", "-n"),
):
    """List clip candidates."""
    proj_dir = _project_dir(project)
    session  = _get_session(proj_dir)

    from rp_clipper.db.models import ClipCandidate, Video

    q = session.query(ClipCandidate).join(Video)
    if video_name:
        q = q.filter(Video.filename.contains(video_name))
    if status_filter:
        q = q.filter(ClipCandidate.status == status_filter)
    q = q.order_by(ClipCandidate.video_id, ClipCandidate.start_ms).limit(limit)

    candidates = q.all()

    if not candidates:
        console.print("[dim]No clip candidates found.[/dim]")
        return

    t = Table(show_header=True, header_style="bold cyan", border_style="dim")
    t.add_column("ID",     width=5)
    t.add_column("Video",  width=22)
    t.add_column("Start",  width=8)
    t.add_column("Length", width=8)
    t.add_column("Status", width=10)
    t.add_column("Tags",   width=24)
    t.add_column("Excerpt")

    for c in candidates:
        status_style = {"approved": "green", "rejected": "red", "pending": "dim"}.get(c.status, "white")
        excerpt = (c.transcript_excerpt or "")[:60].replace("\n", " ")
        t.add_row(
            str(c.id),
            c.video.filename[:22],
            c.start_hms,
            c.duration_hms,
            f"[{status_style}]{c.status}[/{status_style}]",
            ", ".join(c.tags[:2]),
            excerpt,
        )

    console.print(t)


# ---------------------------------------------------------------------------
# export
# ---------------------------------------------------------------------------

@app.command()
def export(
    clip_id: int = typer.Argument(..., help="Clip candidate ID to export"),
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Output file path"),
    reencode: bool = typer.Option(False, "--reencode", help="Re-encode for frame-accurate cut (slower)"),
):
    """Export a clip candidate to a video file."""
    from rp_clipper.config import project_exports_dir
    from rp_clipper.db.models import ClipCandidate
    from rp_clipper.ingest.extract import export_clip

    proj_dir  = _project_dir(project)
    session   = _get_session(proj_dir)
    exports   = project_exports_dir(proj_dir)

    cand = session.get(ClipCandidate, clip_id)
    if not cand:
        console.print(f"[red]No clip with ID {clip_id}[/red]")
        raise typer.Exit(1)

    video_path = Path(cand.video.path)
    if not video_path.exists():
        console.print(f"[red]Source video not found: {video_path}[/red]")
        raise typer.Exit(1)

    if output is None:
        stem   = Path(cand.video.filename).stem
        suffix = video_path.suffix or ".mp4"
        output = exports / f"{stem}_clip{cand.id}_{cand.start_hms.replace(':', '-')}{suffix}"

    console.print(f"  Exporting clip [bold]{clip_id}[/bold]  {cand.start_hms} → {cand.duration_hms}  …")

    try:
        result = export_clip(
            video_path=video_path,
            start_ms=cand.start_ms,
            end_ms=cand.end_ms,
            output_path=output,
            reencode=reencode,
        )
        size_mb = result.stat().st_size / 1_048_576
        console.print(f"  [green]✓[/green] Saved to [cyan]{result}[/cyan]  [dim]({size_mb:.1f} MB)[/dim]")
    except RuntimeError as e:
        console.print(f"  [red]Export failed: {e}[/red]")
        raise typer.Exit(1)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    app()


if __name__ == "__main__":
    main()
