"""
yuuclip  —  YuuClip — video session clip extraction CLI
"""
from __future__ import annotations

import io
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Force UTF-8 output on Windows so Rich never falls back to the cp1252 legacy
# console renderer, which crashes on characters outside Latin-1.
if sys.stdout and hasattr(sys.stdout, "buffer") and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer") and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import typer
from dataclasses import dataclass, field
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

app = typer.Typer(
    name="yuuclip",
    help="Video session clip extraction pipeline.",
    add_completion=False,
)
console = Console()

VIDEO_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".flv", ".ts"}
BYTES_PER_MB: int = 1_048_576


@dataclass
class AnalyzeOptions:
    profile: Optional[str] = None
    no_transcribe: bool = False
    no_segment: bool = False
    no_score: bool = False
    force: bool = False
    language: Optional[str] = None
    energy_mode: str = "fast"
    non_interactive: bool = False
    context_names: list[str] = field(default_factory=list)
    context_text: str = ""


def _project_dir(given: Optional[Path]) -> Path:
    return (given or Path.cwd()).resolve()


def _get_session(project_dir: Path):
    from yuu_clip.config import project_db_path
    from yuu_clip.db.models import make_session
    return make_session(project_db_path(project_dir))


def _load_project(project: Optional[Path]):
    """Resolve project dir, open DB session, and load config. Used by every command that needs DB access."""
    from yuu_clip.config import Config
    proj_dir = _project_dir(project)
    session  = _get_session(proj_dir)
    config   = Config.load(proj_dir)
    return proj_dir, session, config


def _require_ffmpeg() -> None:
    """Exit with a friendly error message if ffmpeg is not found on PATH."""
    from yuu_clip.config import find_ffmpeg
    try:
        find_ffmpeg()
    except RuntimeError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)


def _resolve_videos(path: Path) -> list[Path]:
    """Accept a single video file or a directory; return a sorted list of video paths."""
    path = path.resolve()
    if path.is_dir():
        return sorted(p for p in path.iterdir() if p.suffix.lower() in VIDEO_EXTENSIONS)
    if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS:
        return [path]
    console.print(f"[red]Not a video file or directory: {path}[/red]")
    raise typer.Exit(1)


def _extract_wav_segment(src: Path, dst: Path, start_s: float, end_s: float) -> None:
    """Slice a time range out of a WAV file using ffmpeg stream-copy (fast, lossless)."""
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-i", str(src), "-ss", str(start_s), "-to", str(end_s), "-c", "copy", str(dst)],
        check=True,
    )


@app.command()
def probe(
    path: Path = typer.Argument(..., help="Video file to probe"),
):
    """Inspect a recording's audio tracks and metadata without analyzing it."""
    from yuu_clip.analyze.probe import probe_video

    _require_ffmpeg()

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
    t.add_column("#",          width=3)
    t.add_column("Stream idx", width=10)
    t.add_column("Codec",      width=8)
    t.add_column("Rate",       width=9)
    t.add_column("Channels",   width=9)
    t.add_column("Title tag")

    for i, stream in enumerate(info.audio_streams):
        t.add_row(
            str(i + 1),
            str(stream.stream_index),
            stream.codec_name,
            f"{stream.sample_rate // 1000} kHz",
            str(stream.channels),
            stream.title_tag or "[dim]—[/dim]",
        )
    console.print(t)


@app.command()
def analyze(
    path: Path = typer.Argument(..., help="Video file or directory of videos to analyze"),
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project directory (default: cwd)"),
    model: str = typer.Option("base", "--model", "-m", help="Speech-to-text model: tiny|base|small|medium|large-v3"),
    device: str = typer.Option("auto", "--device", help="Compute device: auto|cpu|cuda"),
    track_layout: Optional[str] = typer.Option(None, "--track-layout", help="Apply a saved track layout"),
    no_transcribe: bool = typer.Option(False, "--no-transcribe", help="Skip transcription step"),
    no_segment: bool = typer.Option(False, "--no-segment", help="Skip clip generation"),
    no_score: bool = typer.Option(False, "--no-score", help="Skip scoring step"),
    force: bool = typer.Option(False, "--force", help="Re-process even if already analyzed"),
    language: Optional[str] = typer.Option(None, "--language", "-l", help="Force speech-to-text language (e.g. en)"),
    energy_mode: str = typer.Option("fast", "--energy-mode", help="Audio energy analysis: none|fast|full"),
    scene_mode: str = typer.Option("fast", "--scene-mode", help="Scene detection: transcript|fast|full"),
    no_interact: bool = typer.Option(False, "--no-interact", help="Never prompt interactively — use defaults or fail cleanly (set automatically by the web UI)"),
    context: list[str] = typer.Option([], "--context", help="World context IDs to apply (can repeat)"),
):
    """Full pipeline: inspect, assign tracks, extract audio, transcribe, generate clips, score."""
    from yuu_clip.config import project_audio_dir
    from yuu_clip.contexts import format_context_block, load_contexts

    _require_ffmpeg()

    proj_dir, session, config = _load_project(project)
    audio_dir = project_audio_dir(proj_dir)

    config.whisper_model        = model
    config.whisper_device       = device
    config.scene_detection_mode = scene_mode

    context_text = format_context_block(load_contexts(proj_dir), context) if context else ""

    video_paths = _resolve_videos(path)
    console.print(f"\n[bold]yuuclip  ·  analyze[/bold]  ({len(video_paths)} video(s))\n")

    opts = AnalyzeOptions(
        profile=track_layout,
        no_transcribe=no_transcribe,
        no_segment=no_segment,
        no_score=no_score,
        force=force,
        language=language,
        energy_mode=energy_mode,
        non_interactive=no_interact,
        context_names=list(context),
        context_text=context_text,
    )
    for video_path in video_paths:
        _analyze_one(video_path, session, config, audio_dir, opts)

    console.print("\n[bold green]Done![/bold green]  Run [cyan]yuuclip status[/cyan] to review your clips.\n")


def _analyze_one(
    video_path: Path,
    session,
    config,
    audio_dir: Path,
    opts: AnalyzeOptions,
) -> None:
    """Orchestrate all pipeline stages for a single video file."""
    from yuu_clip.db.models import Video

    abs_path = str(video_path.resolve())
    existing = session.query(Video).filter_by(path=abs_path).first()
    if existing and existing.status == "done" and not opts.force:
        console.print(f"[dim]Skipping {video_path.name} (already done — use --force to redo)[/dim]")
        return

    console.print(f"Analyzing: {video_path.name}")
    console.rule(f"[bold]{video_path.name}[/bold]")

    info = _probe_video(video_path)
    if info is None:
        return

    video, track_objs = _upsert_video_and_tracks(
        session, video_path, info, existing, opts.profile, opts.force,
        non_interactive=opts.non_interactive,
    )
    if opts.context_names:
        video.context_names_json = json.dumps(opts.context_names)
    session.commit()

    _extract_audio_and_check_rms_overlap(video_path, video, track_objs, config, audio_dir, session, opts.force)
    session.commit()

    transcripts = (
        _transcribe_and_check_overlap(track_objs, config, session, video, opts.language)
        if not opts.no_transcribe else []
    )
    session.commit()

    candidates = _generate_candidates(video, transcripts, config, session, opts.no_segment, opts.no_transcribe, opts.force)
    session.commit()

    if not opts.no_score and candidates:
        _run_scoring(video, track_objs, config, session, energy_mode=opts.energy_mode, context_text=opts.context_text)

    video.processed_at = datetime.now(timezone.utc)
    session.commit()


def _probe_video(video_path: Path):
    """Run ffprobe on the video and return a ProbeResult, or None on failure."""
    from yuu_clip.analyze.probe import probe_video
    console.print("  [bold]Inspecting...[/bold]")
    try:
        info = probe_video(video_path)
    except Exception as e:
        console.print(f"  [red]Inspect failed: {e}[/red]")
        return None
    console.print(
        f"  [dim]Duration: [cyan]{info.duration_hms}[/cyan]  ·  "
        f"{info.width}×{info.height}  ·  {info.fps:.2f} fps  ·  "
        f"{len(info.audio_streams)} audio track(s)[/dim]"
    )
    return info


def _upsert_video_and_tracks(session, video_path: Path, info, existing, profile, force,
                             non_interactive: bool = False):
    """Create or update the Video row and its AudioTrack rows.

    Returns (video, track_objs) — the ORM objects for use by later stages.
    """
    from yuu_clip.db.models import AudioTrack, Video
    from yuu_clip.analyze.labeler import label_tracks

    if existing:
        video = existing
    else:
        video = Video(
            path=str(video_path.resolve()),
            filename=video_path.name,
            duration_ms=info.duration_ms,
            fps=info.fps,
            width=info.width,
            height=info.height,
            status="probed",
        )
        session.add(video)
        session.flush()

    console.print("  [bold]Assigning tracks...[/bold]")
    assignments = label_tracks(info, profile_name=profile, non_interactive=non_interactive)

    track_objs = []
    for i, stream_info in enumerate(info.audio_streams):
        assign = assignments[i]
        existing_track = (
            session.query(AudioTrack)
            .filter_by(video_id=video.id, stream_index=stream_info.stream_index)
            .first()
        )
        if existing_track and not force:
            track_objs.append(existing_track)
            continue

        track = existing_track or AudioTrack(video_id=video.id)
        track.stream_index     = stream_info.stream_index
        track.label            = assign["label"]
        track.relevance_weight = assign["weight"]
        track.do_transcribe    = assign["do_transcribe"]
        track.do_score         = assign.get("do_score", True)
        track.codec            = stream_info.codec_name
        track.sample_rate      = stream_info.sample_rate
        track.channels         = stream_info.channels
        track.channel_layout   = stream_info.channel_layout
        track.stream_title_tag = stream_info.title_tag
        if not existing_track:
            session.add(track)
        track_objs.append(track)

    session.flush()
    video.status = "labeled"
    return video, track_objs


def _extract_audio_and_check_rms_overlap(
    video_path: Path, video, track_objs, config, audio_dir: Path, session, force: bool,
) -> None:
    """Extract each track to WAV, then suppress specialized tracks if they duplicate combined audio.

    OBS can be misconfigured to record the same audio on both the combined and
    individual tracks. The RMS Pearson-correlation check (overlap.py) detects this
    and marks duplicates so they are not scored separately.
    """
    from yuu_clip.analyze.extract import extract_audio_track
    from yuu_clip.analyze.overlap import detect_and_apply_overlap_fallback

    console.print("  [bold]Extracting audio...[/bold]")
    for track in track_objs:
        if not track.do_transcribe and not track.do_score:
            console.print(f"  [dim]  Track {track.stream_index} [{track.label}] — skipped (not transcribed or scored)[/dim]")
            continue
        if track.extracted_path and Path(track.extracted_path).exists() and not force:
            console.print(f"  [dim]  Track {track.stream_index} already extracted[/dim]")
            continue
        out_path = audio_dir / f"{Path(video.filename).stem}_stream{track.stream_index}.wav"
        try:
            extract_audio_track(
                video_path, track.stream_index, out_path,
                config.audio_sample_rate, config.audio_channels,
            )
            track.extracted_path = str(out_path)
            size_mb = out_path.stat().st_size / BYTES_PER_MB
            console.print(
                f"  [green]  OK[/green] [{track.label}] -> {out_path.name}  [dim]({size_mb:.1f} MB)[/dim]"
            )
        except RuntimeError as e:
            console.print(f"  [red]  FAIL extraction: {e}[/red]")

    session.flush()
    video.status = "extracting"

    if detect_and_apply_overlap_fallback(track_objs):
        console.print(
            "  [yellow]Track overlap detected[/yellow] — specialized tracks appear to "
            "duplicate combined audio. Falling back to combined track only."
        )
        for t in track_objs:
            flag = "[green]transcribe[/green]" if t.do_transcribe else "[dim]skip[/dim]"
            console.print(f"  [dim]  stream {t.stream_index} [{t.label}] -> {flag}[/dim]")
        session.flush()


def _transcribe_and_check_overlap(track_objs, config, session, video, language) -> list:
    """Transcribe all eligible tracks and suppress duplicates found in combined-track content."""
    from yuu_clip.analyze.overlap import detect_transcript_overlap
    from yuu_clip.transcribe.whisper_runner import transcribe_track

    console.print(f"  [bold]Transcribing (model: {config.whisper_model})...[/bold]")
    transcripts = []
    for track in track_objs:
        if not track.do_transcribe:
            console.print(
                f"  [dim]  Track {track.stream_index} [{track.label}] — skipped (not marked for transcription)[/dim]"
            )
            continue
        if not track.extracted_path:
            console.print(f"  [yellow]  Track {track.stream_index} — no extracted audio, skipping[/yellow]")
            continue
        console.print(f"  [dim]  Track {track.stream_index} [{track.label}]...[/dim]")
        try:
            transcript = transcribe_track(track, config, session, language=language)
            console.print(
                f"  [green]  OK[/green] [{track.label}]  {len(transcript.segments)} segments  "
                f"[dim](language: {transcript.language or 'auto'})[/dim]"
            )
            transcripts.append(transcript)
        except Exception as e:
            console.print(f"  [red]  FAIL transcription: {e}[/red]")

    session.flush()
    video.status = "transcribed"

    if detect_transcript_overlap(track_objs, session):
        console.print(
            "  [yellow]Transcript overlap detected[/yellow] — specialized tracks share "
            "content with combined. Scoring combined track only."
        )
        session.flush()

    return transcripts


def _generate_candidates(video, transcripts, config, session, no_segment, no_transcribe, force) -> list:
    """Generate sliding-window clip candidates from the transcripts, if conditions are met."""
    from yuu_clip.segments.windower import generate_candidates

    if no_segment or not transcripts:
        if not transcripts and not no_transcribe:
            console.print("  [yellow]  No transcripts available — skipping clip generation[/yellow]")
        else:
            video.status = "transcribed"
        session.flush()
        return []

    if force:
        from yuu_clip.db.models import ClipCandidate
        deleted = session.query(ClipCandidate).filter_by(video_id=video.id).delete()
        if deleted:
            console.print(f"  [dim]  Cleared {deleted} existing clips (--force)[/dim]")

    console.print("  [bold]Generating clips...[/bold]")
    candidates = generate_candidates(video, transcripts, config, session)
    console.print(f"  [green]  OK[/green] {len(candidates)} clips created")
    video.status = "done"
    session.flush()
    return candidates


def _run_scoring(video, track_objs, config, session, energy_mode: str = "fast", context_text: str = "") -> None:
    """Run Phase 2 scoring (energy, scenes, LLM) for all candidates belonging to *video*."""
    from yuu_clip.scoring.energy import AudioEnergyScorer, compute_energy
    from yuu_clip.scoring.engine import ScoringEngine
    from yuu_clip.scoring.llm import LLMScorer
    from yuu_clip.scoring.scenes import SceneCutScorer, compute_scenes

    if config.scorer_energy_enabled and energy_mode != "none":
        console.print(f"  [bold]Computing audio energy ({energy_mode})...[/bold]")
        total_seconds = sum(
            compute_energy(track, session, energy_mode=energy_mode)
            for track in track_objs
            if track.do_score and track.extracted_path
        )
        if total_seconds:
            console.print(f"  [green]  OK[/green] {total_seconds} seconds indexed")
        else:
            console.print("  [dim]  Energy already computed or no scorable tracks[/dim]")
        session.flush()

    if config.scorer_scenes_enabled:
        console.print("  [bold]Detecting scene cuts...[/bold]")
        try:
            n = compute_scenes(
                video, session,
                mode=config.scene_detection_mode,
                transcript_gap_s=config.scene_transcript_gap_s,
            )
            msg = f"  [green]  OK[/green] {n} scene cuts detected" if n else "  [dim]  Scene detection already done or unavailable[/dim]"
            console.print(msg)
            session.flush()
        except Exception as e:
            console.print(f"  [yellow]  Scene detection skipped: {e}[/yellow]")

    console.print("  [bold]Scoring clips...[/bold]")
    engine = ScoringEngine(config, [AudioEnergyScorer(config), SceneCutScorer(config), LLMScorer(config, context_text=context_text)])
    n = engine.score_video(
        video, session,
        progress_cb=lambda i, total: console.print(f"  Scoring {i}/{total}..."),
    )
    console.print(f"  [green]  OK[/green] {n} clips scored")
    video.clips_scored_at = datetime.now(timezone.utc)
    video.clips_scored_context_json = video.context_names_json or "[]"
    session.flush()


@app.command()
def score(
    video_id: Optional[int] = typer.Argument(None, help="Video ID to score (omit for --all)"),
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
    all_videos: bool = typer.Option(False, "--all", help="Re-score all videos"),
    no_energy: bool = typer.Option(False, "--no-energy", help="Skip audio energy step"),
    no_scenes: bool = typer.Option(False, "--no-scenes", help="Skip scene detection step"),
    no_llm: bool = typer.Option(False, "--no-llm", help="Skip LLM scoring step"),
):
    """Re-run scoring for one recording or all recordings."""
    from yuu_clip.db.models import Video

    if video_id is None and not all_videos:
        console.print("[red]Provide a video ID or --all[/red]")
        raise typer.Exit(1)

    proj_dir, session, config = _load_project(project)

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
        from yuu_clip.contexts import format_context_block, load_contexts
        _cn = json.loads(v.context_names_json) if v.context_names_json else []
        _ctx = format_context_block(load_contexts(proj_dir), _cn)
        _run_scoring(v, v.audio_tracks, config, session, context_text=_ctx)
        session.commit()

    console.print("\n[bold green]Scoring complete.[/bold green]\n")


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


def _run_retranscribe(cand, session, config, language: Optional[str] = None) -> None:
    """Retranscribe a clip's time window and store a clip-scoped Transcript row.

    Does not rescore. Caller is responsible for session.commit() afterward.
    """
    import tempfile

    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment
    from yuu_clip.transcribe.whisper_runner import _get_model

    tracks = session.query(AudioTrack).filter_by(video_id=cand.video_id, do_transcribe=True).all()
    if not tracks:
        console.print("[yellow]  No tracks marked for transcription — skipping retranscribe[/yellow]")
        return

    effective_start_s  = max(0.0, cand.start_ms / 1000.0 + (cand.start_offset or 0.0))
    effective_end_s    = cand.end_ms / 1000.0 + (cand.end_offset or 0.0)
    effective_start_ms = int(effective_start_s * 1000)

    new_tx_ids: list[int] = []
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        for track in tracks:
            if not track.extracted_path or not Path(track.extracted_path).exists():
                console.print(f"  [yellow]  Track {track.stream_index} — no extracted audio, skipping[/yellow]")
                continue

            segment_wav = tmp_path / f"seg_{track.stream_index}.wav"
            _extract_wav_segment(Path(track.extracted_path), segment_wav, effective_start_s, effective_end_s)

            for old_tx in session.query(Transcript).filter_by(audio_track_id=track.id, clip_id=cand.id).all():
                session.delete(old_tx)
            session.flush()

            console.print(f"  [dim]  Retranscribing track {track.stream_index} [{track.label}]...[/dim]")
            whisper_model = _get_model(config)
            segments_raw, info = whisper_model.transcribe(str(segment_wav), language=language, vad_filter=True)

            tx = Transcript(
                audio_track_id=track.id,
                clip_id=cand.id,
                model_name=config.whisper_model,
                language=getattr(info, "language", None),
            )
            session.add(tx)
            session.flush()
            new_tx_ids.append(tx.id)

            offset_ms = effective_start_ms
            seg_count = 0
            for seg in segments_raw:
                session.add(TranscriptSegment(
                    transcript_id=tx.id,
                    start_ms=offset_ms + int(seg.start * 1000),
                    end_ms=offset_ms + int(seg.end * 1000),
                    text=seg.text,
                    confidence=getattr(seg, "avg_logprob", None),
                ))
                seg_count += 1

            session.flush()
            console.print(f"  [green]  OK[/green] [{track.label}]  {seg_count} segments")

    if new_tx_ids:
        from yuu_clip.db.models import TranscriptSegment as _TS
        new_segs = (
            session.query(_TS)
            .filter(_TS.transcript_id.in_(new_tx_ids))
            .order_by(_TS.start_ms)
            .all()
        )
        if new_segs:
            cand.transcript_excerpt = " ".join(s.text.strip() for s in new_segs)


@app.command()
def export(
    clip_id: int = typer.Argument(..., help="Clip candidate ID to export"),
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Output file path"),
    precise: bool = typer.Option(False, "--precise", help="Precise export: re-encode for frame-accurate cut (slower)"),
    captions: bool = typer.Option(True, "--captions/--no-captions", help="Write SRT caption sidecar file(s)"),
    bake_captions: bool = typer.Option(False, "--bake-captions", help="Bake captions into video (forces precise export)"),
    embed_subs: bool = typer.Option(False, "--embed-subs", help="Embed captions as a subtitle track (softsub, stream copy, fast)"),
    container: Optional[str] = typer.Option(None, "--container", help="Output container override: mkv or mp4. Defaults to source format."),
    retranscribe: bool = typer.Option(False, "--retranscribe", help="Re-transcribe the clip window before exporting"),
    retranscribe_model: str = typer.Option("large-v3", "--retranscribe-model", help="Whisper model for retranscription: tiny|base|small|medium|large-v3"),
):
    """Export a clip to a video file."""
    import tempfile

    from yuu_clip.config import project_exports_dir, validate_whisper_model
    from yuu_clip.db.models import AudioTrack, ClipCandidate
    from yuu_clip.analyze.extract import export_clip
    from yuu_clip.subtitles import export_srt_sidecars, lines_to_srt, merged_srt_lines

    if retranscribe:
        try:
            validate_whisper_model(retranscribe_model)
        except ValueError as e:
            console.print(f"[red]{e}[/red]")
            raise typer.Exit(1)

    proj_dir = _project_dir(project)
    session  = _get_session(proj_dir)
    exports  = project_exports_dir(proj_dir)

    cand = session.get(ClipCandidate, clip_id)
    if not cand:
        console.print(f"[red]No clip with ID {clip_id}[/red]")
        raise typer.Exit(1)

    if retranscribe:
        from yuu_clip.config import Config
        retx_config = Config.load(proj_dir)
        retx_config.whisper_model = retranscribe_model
        console.print(
            f"  Retranscribing clip [bold]{clip_id}[/bold] with model [cyan]{retranscribe_model}[/cyan] before export..."
        )
        _run_retranscribe(cand, session, retx_config)
        session.commit()

    video_path = Path(cand.video.path)
    if not video_path.exists():
        console.print(f"[red]Source video not found: {video_path}[/red]")
        raise typer.Exit(1)

    audio_track = (
        session.query(AudioTrack).filter_by(video_id=cand.video_id, label="combined").first()
        or session.query(AudioTrack).filter_by(video_id=cand.video_id, do_transcribe=True).first()
    )
    audio_stream_idx = audio_track.stream_index if audio_track else None

    stem   = Path(cand.video.filename).stem
    if container:
        suffix = f".{container.lstrip('.')}"
    else:
        suffix = video_path.suffix or ".mkv"
    base   = f"{stem}_clip{cand.id}_{cand.start_hms.replace(':', '-')}"
    if output is None:
        output = exports / f"{base}{suffix}"

    effective_start_ms = cand.start_ms + int((cand.start_offset or 0.0) * 1000)
    effective_end_ms   = cand.end_ms   + int((cand.end_offset   or 0.0) * 1000)
    effective_start_ms = max(0, effective_start_ms)
    if cand.video.duration_ms:
        effective_end_ms = min(effective_end_ms, cand.video.duration_ms)

    console.print(f"  Exporting clip [bold]{clip_id}[/bold]  {cand.start_hms}  ({cand.duration_hms})  ...")

    subtitle_path: Optional[Path] = None
    subtitle_track_path: Optional[Path] = None
    if bake_captions:
        merged = merged_srt_lines(cand)
        if merged:
            tmp = tempfile.NamedTemporaryFile(suffix=".srt", delete=False, mode="w", encoding="utf-8")
            tmp.write(lines_to_srt(merged))
            tmp.close()
            subtitle_path = Path(tmp.name)
        else:
            console.print("  [yellow]--bake-captions: no transcript data found, skipping burn-in[/yellow]")
    elif embed_subs:
        merged = merged_srt_lines(cand)
        if merged:
            tmp = tempfile.NamedTemporaryFile(suffix=".srt", delete=False, mode="w", encoding="utf-8")
            tmp.write(lines_to_srt(merged))
            tmp.close()
            subtitle_track_path = Path(tmp.name)
        else:
            console.print("  [yellow]--embed-subs: no transcript data found, skipping subtitle track[/yellow]")

    try:
        result = export_clip(
            video_path=video_path,
            start_ms=effective_start_ms,
            end_ms=effective_end_ms,
            output_path=output,
            reencode=precise,
            subtitle_path=subtitle_path,
            subtitle_track_path=subtitle_track_path,
            audio_stream_index=audio_stream_idx,
        )
        size_mb = result.stat().st_size / BYTES_PER_MB
        console.print(f"  [green]OK[/green] Saved to [cyan]{result}[/cyan]  [dim]({size_mb:.1f} MB)[/dim]")
        from datetime import datetime, timezone as _tz
        cand.exported_at = datetime.now(_tz.utc)
        cand.exported_container = result.suffix.lstrip(".")
        cand.exported_burn_subs = bake_captions
        session.commit()
    except RuntimeError as e:
        console.print(f"  [red]Export failed: {e}[/red]")
        raise typer.Exit(1)
    finally:
        for tmp_path in (subtitle_path, subtitle_track_path):
            if tmp_path and tmp_path.exists():
                tmp_path.unlink(missing_ok=True)

    if captions:
        srt_files = export_srt_sidecars(cand, output.parent, base)
        if srt_files:
            for srt in srt_files:
                console.print(f"  [green]OK[/green] Captions  [cyan]{srt.name}[/cyan]")
        else:
            console.print("  [dim]No transcript data — captions skipped[/dim]")


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
    title_dur:  float           = typer.Option(3.0,  "--title-dur",  help="Title card display duration in seconds"),
    output:     Optional[Path]  = typer.Option(None, "-o", "--output",
                                     help="Output file path (default: .yuu-clip/reels/reel_<timestamp>.mkv)"),
) -> None:
    """Compile a highlight reel from approved clips with title cards and transitions."""
    from yuu_clip.db.models import ClipCandidate, Video
    from yuu_clip.reel import TRANSITIONS, compile_demo

    if transition not in TRANSITIONS:
        console.print(f"[red]Unknown transition '{transition}'. Choose from: {', '.join(TRANSITIONS)}[/red]")
        raise typer.Exit(1)

    proj_dir, session, _ = _load_project(project)
    export_dir = proj_dir / ".yuu-clip" / "exports"
    reels_dir  = proj_dir / ".yuu-clip" / "reels"

    if clip_ids:
        from yuu_clip.db.models import ClipCandidate as _CC
        id_map = {c.id: c for c in session.query(_CC).filter(_CC.id.in_(clip_ids)).all()}
        all_clips = [id_map[cid] for cid in clip_ids if cid in id_map]
    else:
        effective_video_ids = list(video_ids)
        if video_id is not None and video_id not in effective_video_ids:
            effective_video_ids.append(video_id)
        all_clips = _gather_demo_clips(session, effective_video_ids, status_filter, min_score, top)
    if not all_clips:
        console.print("[yellow]No clips found matching the filters.[/yellow]")
        raise typer.Exit(0)

    vid_ids   = {c.video_id for c in all_clips}
    video_map = {v.id: v for v in session.query(Video).filter(Video.id.in_(vid_ids)).all()}

    if not output:
        ts     = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = reels_dir / f"reel_{ts}.mkv"
    output.parent.mkdir(parents=True, exist_ok=True)

    console.print(f"\n[bold]Building highlight reel[/bold] — {len(all_clips)} clip(s), transition=[cyan]{transition}[/cyan]")
    for c in all_clips:
        vid  = video_map[c.video_id]
        desc = f"  {c.description}" if c.description else ""
        console.print(
            f"  Clip {c.id}  [{vid.filename[:30]}  {c.start_hms}  {c.duration_hms}]"
            f"  score={c.score_overall:.3f}{desc}"
        )
    console.print(f"\n  Output: [cyan]{output}[/cyan]\n  [dim]Generating title cards and encoding...[/dim]")

    try:
        compile_demo(
            clips=all_clips, video_map=video_map, export_dir=export_dir,
            output=output, transition=transition, trans_dur=trans_dur, title_dur=title_dur,
        )
        size_mb = output.stat().st_size / BYTES_PER_MB
        console.print(f"  [green]OK[/green] {output.name}  [dim]({size_mb:.1f} MB)[/dim]")
    except FileNotFoundError as e:
        console.print(f"  [red]{e}[/red]")
        raise typer.Exit(1)
    except subprocess.CalledProcessError as e:
        console.print(f"  [red]ffmpeg error: {e}[/red]")
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


@app.command()
def retranscribe(
    clip_id: int = typer.Argument(..., help="Clip candidate ID"),
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
    model: str = typer.Option("large-v3", "--model", "-m"),
    language: Optional[str] = typer.Option(None, "--language"),
    no_rescore: bool = typer.Option(False, "--no-rescore"),
) -> None:
    """Re-transcribe just the time window of a clip, then re-score it."""
    from yuu_clip.config import validate_whisper_model
    from yuu_clip.db.models import ClipCandidate

    validate_whisper_model(model)
    proj_dir, session, config = _load_project(project)
    config.whisper_model = model

    cand = session.get(ClipCandidate, clip_id)
    if not cand:
        console.print(f"[red]No clip with ID {clip_id}[/red]")
        raise typer.Exit(1)

    console.print(
        f"  Retranscribing clip [bold]{clip_id}[/bold]  "
        f"{cand.start_hms}  ({cand.duration_hms})  (model: {model})"
    )

    _run_retranscribe(cand, session, config, language=language)
    session.commit()

    if not no_rescore:
        from yuu_clip.contexts import format_context_block, load_contexts
        from yuu_clip.db.models import Video as _Video
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.llm import LLMScorer
        cand = session.get(ClipCandidate, clip_id)
        vid = session.get(_Video, cand.video_id)
        context_names = json.loads(vid.context_names_json) if vid and vid.context_names_json else []
        context_text = format_context_block(load_contexts(proj_dir), context_names)
        console.print("  Re-scoring clip with LLM...")
        engine = ScoringEngine(config, [LLMScorer(config, context_text=context_text)])
        engine.score_clip(cand, session)
        session.commit()
        console.print("  [green]  OK[/green]")

    console.print("  [green]Done.[/green]")


@app.command()
def serve(
    project: Optional[Path] = typer.Option(None, "-p", "--project"),
    host:    str            = typer.Option("127.0.0.1", "--host"),
    port:    int            = typer.Option(8080,        "--port"),
    open_browser: bool      = typer.Option(True,        "--open/--no-open"),
    reload:  bool           = typer.Option(False,       "--reload/--no-reload",
                                           help="Auto-restart when source files change (development)"),
) -> None:
    """Start the web UI server."""
    import os
    import threading
    import webbrowser

    import uvicorn

    proj_dir = _project_dir(project)
    console.print(f"  Project:  [dim]{proj_dir}[/dim]")
    console.print(f"  Serving at [cyan]http://{host}:{port}[/cyan]  (Ctrl+C to stop)")
    if reload:
        console.print("  [yellow]Reload mode on — server restarts when source files change[/yellow]")

    if open_browser:
        def _open_after_delay() -> None:
            import time
            time.sleep(1.2)
            webbrowser.open(f"http://{host}:{port}")
        threading.Thread(target=_open_after_delay, daemon=True).start()

    if reload:
        os.environ["YUU_CLIP_PROJECT"] = str(proj_dir)
        uvicorn.run(
            "yuu_clip.web.app:_reload_factory",
            host=host, port=port, log_level="info",
            reload=True, factory=True,
        )
    else:
        from yuu_clip.web.app import create_app
        uvicorn.run(create_app(proj_dir), host=host, port=port, log_level="warning")


def main():
    app()


if __name__ == "__main__":
    main()
