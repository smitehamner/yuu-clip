"""
rp-clip  —  RP gaming session clip extraction CLI
"""
from __future__ import annotations

import io
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Force UTF-8 output on Windows so Rich never falls back to the cp1252 legacy
# console renderer, which crashes on any character outside Latin-1.
if sys.stdout and hasattr(sys.stdout, "buffer") and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer") and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

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
    no_score: bool = typer.Option(False, "--no-score", help="Skip scoring step"),
    force: bool = typer.Option(False, "--force", help="Re-process even if already ingested"),
    language: Optional[str] = typer.Option(None, "--language", "-l", help="Force Whisper language (e.g. en)"),
):
    """
    Full pipeline: probe, label tracks, extract audio, transcribe, generate candidates, score.
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
    console.print(f"\n[bold]rp-clip  ·  ingest[/bold]  ({len(videos)} video(s))\n")

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
            no_score=no_score,
            force=force,
            language=language,
        )

    session.commit()
    console.print("\n[bold green]Done![/bold green]  Run [cyan]rp-clip status[/cyan] to see your project.\n")


def _ingest_one(
    video_path, proj_dir, session, config, audio_dir,
    profile, no_transcribe, no_segment, no_score, force, language
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
    console.print("  [bold]Probing...[/bold]")
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
    console.print("  [bold]Labeling audio tracks...[/bold]")
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
        track.do_score        = assign.get("do_score", True)
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
    console.print("  [bold]Extracting audio...[/bold]")
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
                f"  [green]  OK[/green] [{track.label}] -> {out_name}  "
                f"[dim]({size_mb:.1f} MB)[/dim]"
            )
        except RuntimeError as e:
            console.print(f"  [red]  FAIL Extraction failed: {e}[/red]")

    session.flush()
    video.status = "extracting"

    # --- 3b. Detect track overlap (OBS misconfiguration guard) ---
    from rp_clipper.ingest.overlap import detect_and_apply_overlap_fallback
    if detect_and_apply_overlap_fallback(track_objs):
        console.print(
            "  [yellow]Track overlap detected[/yellow] — specialized tracks appear to "
            "duplicate combined audio.  Falling back to combined track only."
        )
        for t in track_objs:
            flag = "[dim]skip[/dim]" if not t.do_transcribe else "[green]transcribe[/green]"
            console.print(f"  [dim]  stream {t.stream_index} [{t.label}] -> {flag}[/dim]")
        session.flush()

    # --- 4. Transcribe ---
    if not no_transcribe:
        console.print(f"  [bold]Transcribing (model: {config.whisper_model})...[/bold]")
        transcripts: list[Transcript] = []

        for track in track_objs:
            if not track.do_transcribe:
                console.print(f"  [dim]  Track {track.stream_index} [{track.label}] - skipping (not marked for transcription)[/dim]")
                continue
            if not track.extracted_path:
                console.print(f"  [yellow]  Track {track.stream_index} has no extracted audio — skip[/yellow]")
                continue

            console.print(f"  [dim]  Track {track.stream_index} [{track.label}]...[/dim]")
            try:
                t = transcribe_track(track, config, session, language=language)
                seg_count = len(t.segments)
                console.print(
                    f"  [green]  OK[/green] [{track.label}]  {seg_count} segments  "
                    f"[dim](language: {t.language or 'auto'})[/dim]"
                )
                transcripts.append(t)
            except Exception as e:
                console.print(f"  [red]  FAIL Transcription failed: {e}[/red]")

        session.flush()
        video.status = "transcribed"

        # 4b. Post-transcription overlap check: if specialized track content is
        # largely contained in the combined transcript, suppress it for scoring.
        from rp_clipper.ingest.overlap import detect_transcript_overlap
        if detect_transcript_overlap(track_objs, session):
            console.print(
                "  [yellow]Transcript overlap detected[/yellow] — specialized tracks "
                "share content with combined.  Scoring combined track only."
            )
            session.flush()
    else:
        transcripts = []

    # --- 5. Generate clip candidates ---
    candidates = []
    if not no_segment and transcripts:
        if force:
            from rp_clipper.db.models import ClipCandidate
            deleted = session.query(ClipCandidate).filter_by(video_id=video.id).delete()
            if deleted:
                console.print(f"  [dim]  Cleared {deleted} existing candidates (--force)[/dim]")
        console.print("  [bold]Generating clip candidates...[/bold]")
        candidates = generate_candidates(video, transcripts, config, session)
        console.print(f"  [green]  OK[/green] {len(candidates)} candidates created")
        video.status = "done"
    elif not transcripts and not no_transcribe:
        console.print("  [yellow]  No transcripts available — skipping segmentation[/yellow]")
    else:
        video.status = "transcribed"

    session.flush()

    # --- 6–8. Score candidates (Phase 2) ---
    if not no_score and candidates:
        _run_scoring(video, track_objs, config, session)

    from datetime import datetime
    video.processed_at = datetime.utcnow()
    session.flush()


# ---------------------------------------------------------------------------
# Scoring helper (shared by ingest and the standalone score command)
# ---------------------------------------------------------------------------

def _run_scoring(video, track_objs, config, session) -> None:
    """Run Phase 2 scoring steps 6–8 for *video* and commit energy/scene rows."""
    from rp_clipper.scoring.energy import AudioEnergyScorer, compute_energy
    from rp_clipper.scoring.scenes import SceneCutScorer, compute_scenes
    from rp_clipper.scoring.llm import LLMScorer
    from rp_clipper.scoring.engine import ScoringEngine

    # --- 6. Compute audio energy ---
    if config.scorer_energy_enabled:
        console.print("  [bold]Computing audio energy...[/bold]")
        total_seconds = 0
        for track in track_objs:
            if track.do_score and track.extracted_path:
                n = compute_energy(track, session)
                if n:
                    console.print(f"  [green]  OK[/green] [{track.label}]  {n} seconds indexed")
                    total_seconds += n
        if total_seconds == 0:
            console.print("  [dim]  Energy already computed or no scorable tracks[/dim]")
        session.flush()

    # --- 7. Detect scene cuts ---
    if config.scorer_scenes_enabled:
        console.print("  [bold]Detecting scene cuts...[/bold]")
        try:
            n = compute_scenes(
                video, session,
                mode=config.scene_detection_mode,
                transcript_gap_s=config.scene_transcript_gap_s,
            )
            if n:
                console.print(f"  [green]  OK[/green] {n} scene cuts detected")
            else:
                console.print("  [dim]  Scene detection already done or unavailable[/dim]")
            session.flush()
        except Exception as e:
            console.print(f"  [yellow]  Scene detection skipped: {e}[/yellow]")

    # --- 8. Score candidates ---
    console.print("  [bold]Scoring candidates...[/bold]")
    scorers = [
        AudioEnergyScorer(config),
        SceneCutScorer(config),
        LLMScorer(config),
    ]
    engine = ScoringEngine(config, scorers)
    n = engine.score_video(video, session)
    console.print(f"  [green]  OK[/green] {n} candidates scored")
    session.flush()


# ---------------------------------------------------------------------------
# score  (standalone re-score command)
# ---------------------------------------------------------------------------

@app.command()
def score(
    video_id: Optional[int] = typer.Argument(None, help="Video ID to score (omit for --all)"),
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
    all_videos: bool = typer.Option(False, "--all", help="Re-score all videos"),
    no_energy: bool = typer.Option(False, "--no-energy", help="Skip audio energy step"),
    no_scenes: bool = typer.Option(False, "--no-scenes", help="Skip scene detection step"),
    no_llm: bool = typer.Option(False, "--no-llm", help="Skip LLM scoring step"),
):
    """Re-run Phase 2 scoring for one video or all videos."""
    from rp_clipper.config import Config
    from rp_clipper.db.models import Video

    if video_id is None and not all_videos:
        console.print("[red]Provide a video ID or --all[/red]")
        raise typer.Exit(1)

    proj_dir = _project_dir(project)
    session  = _get_session(proj_dir)
    config   = Config.load(proj_dir)

    # Per-run overrides
    if no_energy: config.scorer_energy_enabled = False
    if no_scenes: config.scorer_scenes_enabled = False
    if no_llm:    config.ollama_enabled = False

    if all_videos:
        videos = session.query(Video).all()
    else:
        v = session.get(Video, video_id)
        if not v:
            console.print(f"[red]No video with ID {video_id}[/red]")
            raise typer.Exit(1)
        videos = [v]

    for v in videos:
        console.rule(f"[bold]{v.filename}[/bold]")
        track_objs = v.audio_tracks
        _run_scoring(v, track_objs, config, session)

    session.commit()
    console.print("\n[bold green]Scoring complete.[/bold green]\n")


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
    subtitles: bool = typer.Option(True, "--subtitles/--no-subtitles", help="Write SRT subtitle sidecar file(s)"),
    burn_subs: bool = typer.Option(False, "--burn-subs", help="Burn subtitles into video (forces re-encode)"),
):
    """Export a clip candidate to a video file."""
    import tempfile

    from rp_clipper.config import project_exports_dir
    from rp_clipper.db.models import ClipCandidate
    from rp_clipper.ingest.extract import export_clip
    from rp_clipper.subtitles import export_srt_sidecars, lines_to_srt, merged_srt_lines

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

    stem   = Path(cand.video.filename).stem
    suffix = video_path.suffix or ".mp4"
    base   = f"{stem}_clip{cand.id}_{cand.start_hms.replace(':', '-')}"

    if output is None:
        output = exports / f"{base}{suffix}"

    console.print(f"  Exporting clip [bold]{clip_id}[/bold]  {cand.start_hms}  ({cand.duration_hms})  ...")

    # Optionally burn merged subtitles into the video
    subtitle_path: Optional[Path] = None
    if burn_subs:
        merged = merged_srt_lines(cand)
        if merged:
            tmp = tempfile.NamedTemporaryFile(
                suffix=".srt", delete=False, mode="w", encoding="utf-8"
            )
            tmp.write(lines_to_srt(merged))
            tmp.close()
            subtitle_path = Path(tmp.name)
        else:
            console.print("  [yellow]--burn-subs: no transcript data found, skipping burn-in[/yellow]")

    try:
        result = export_clip(
            video_path=video_path,
            start_ms=cand.start_ms,
            end_ms=cand.end_ms,
            output_path=output,
            reencode=reencode,
            subtitle_path=subtitle_path,
        )
        size_mb = result.stat().st_size / 1_048_576
        console.print(f"  [green]OK[/green] Saved to [cyan]{result}[/cyan]  [dim]({size_mb:.1f} MB)[/dim]")
    except RuntimeError as e:
        console.print(f"  [red]Export failed: {e}[/red]")
        raise typer.Exit(1)
    finally:
        if subtitle_path and subtitle_path.exists():
            subtitle_path.unlink(missing_ok=True)

    if subtitles:
        srt_files = export_srt_sidecars(cand, output.parent, base)
        if srt_files:
            for srt in srt_files:
                console.print(f"  [green]OK[/green] Subtitle  [cyan]{srt.name}[/cyan]")
        else:
            console.print("  [dim]No transcript data — subtitles skipped[/dim]")


# ---------------------------------------------------------------------------
# demo — highlight reel compilation
# ---------------------------------------------------------------------------

@app.command()
def demo(
    project:    Optional[Path] = typer.Option(None, "-p", "--project"),
    video_ids:  list[int]      = typer.Option([], "--video", "-v",
                                    help="Video ID(s) to include (default: all)"),
    top:        Optional[int]  = typer.Option(None, "--top",
                                    help="Top N clips per video by overall score"),
    min_score:  float          = typer.Option(0.0, "--min-score",
                                    help="Minimum overall score to include"),
    transition: str            = typer.Option("fade", "--transition", "-t",
                                    help="Transition type: fade|dissolve|wipeleft|wiperight|slideleft|slideright|none"),
    trans_dur:  float          = typer.Option(0.5,  "--trans-dur",
                                    help="Transition overlap duration in seconds"),
    title_dur:  float          = typer.Option(3.0,  "--title-dur",
                                    help="Title card display duration in seconds"),
    output:     Optional[Path] = typer.Option(None, "-o", "--output",
                                    help="Output file path (default: .rp-clipper/exports/demo_<timestamp>.mkv)"),
) -> None:
    """Compile a highlight reel from exported clips with title cards and transitions."""
    from datetime import datetime
    from rp_clipper.db.models import ClipCandidate, Video
    from rp_clipper.demo import compile_demo, TRANSITIONS

    if transition not in TRANSITIONS:
        console.print(f"[red]Unknown transition '{transition}'. Choose from: {', '.join(TRANSITIONS)}[/red]")
        raise typer.Exit(1)

    proj_dir  = _project_dir(project)
    session   = _get_session(proj_dir)
    export_dir = proj_dir / "exports"

    # --- gather clips ---
    q = session.query(ClipCandidate).join(Video)
    if video_ids:
        q = q.filter(ClipCandidate.video_id.in_(video_ids))
    if min_score > 0:
        q = q.filter(ClipCandidate.score_overall >= min_score)

    all_clips = q.order_by(ClipCandidate.video_id, ClipCandidate.score_overall.desc()).all()

    if top:
        # Keep top N per video
        by_video: dict[int, list] = {}
        for c in all_clips:
            by_video.setdefault(c.video_id, []).append(c)
        all_clips = []
        for vid_clips in by_video.values():
            all_clips.extend(vid_clips[:top])
        # Re-sort by video then start time for chronological order
        all_clips.sort(key=lambda c: (c.video_id, c.start_ms))

    if not all_clips:
        console.print("[yellow]No clips found matching the filters.[/yellow]")
        raise typer.Exit(0)

    # --- resolve video map ---
    vid_ids = {c.video_id for c in all_clips}
    videos = {v.id: v for v in session.query(Video).filter(Video.id.in_(vid_ids)).all()}

    # --- output path ---
    if not output:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = export_dir / f"demo_{ts}.mkv"
    output.parent.mkdir(parents=True, exist_ok=True)

    console.print(f"\n[bold]Building demo reel[/bold] — {len(all_clips)} clip(s), transition=[cyan]{transition}[/cyan]")
    for c in all_clips:
        vid = videos[c.video_id]
        desc = f"  {c.description}" if c.description else ""
        console.print(
            f"  Clip {c.id}  [{vid.filename[:30]}  {c.start_hms}  {c.duration_hms}]"
            f"  score={c.score_overall:.3f}{desc}"
        )

    console.print(f"\n  Output: [cyan]{output}[/cyan]")
    console.print("  [dim]Generating title cards and encoding...[/dim]")

    try:
        compile_demo(
            clips=all_clips,
            video_map=videos,
            export_dir=export_dir,
            output=output,
            transition=transition,
            trans_dur=trans_dur,
            title_dur=title_dur,
        )
        size_mb = output.stat().st_size / 1_048_576
        console.print(f"  [green]OK[/green] {output.name}  [dim]({size_mb:.1f} MB)[/dim]")
    except FileNotFoundError as e:
        console.print(f"  [red]{e}[/red]")
        raise typer.Exit(1)
    except subprocess.CalledProcessError as e:
        console.print(f"  [red]ffmpeg error: {e}[/red]")
        raise typer.Exit(1)


# ---------------------------------------------------------------------------
# serve — web UI
# ---------------------------------------------------------------------------

@app.command()
def serve(
    project: Optional[Path] = typer.Option(None, "-p", "--project"),
    host:    str            = typer.Option("127.0.0.1", "--host"),
    port:    int            = typer.Option(8080,        "--port"),
    open_browser: bool      = typer.Option(True,        "--open/--no-open"),
) -> None:
    """Start the web UI server."""
    import uvicorn
    from rp_clipper.web.app import create_app

    proj_dir = _project_dir(project)
    web_app  = create_app(proj_dir)

    if open_browser:
        import threading, webbrowser
        def _open():
            import time; time.sleep(1.2)
            webbrowser.open(f"http://{host}:{port}")
        threading.Thread(target=_open, daemon=True).start()

    console.print(f"  Serving at [cyan]http://{host}:{port}[/cyan]  (Ctrl+C to stop)")
    uvicorn.run(web_app, host=host, port=port, log_level="warning")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    app()


if __name__ == "__main__":
    main()
