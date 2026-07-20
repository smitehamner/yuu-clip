"""Analysis commands: probe, analyze, score. The per-video pipeline lives in yuu_clip.pipeline."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer
from rich.panel import Panel
from rich.table import Table

from yuu_clip.analyze.pause import wait_while_paused
from yuu_clip.cli._base import (
    _load_project,
    _require_ffmpeg,
    _resolve_videos,
    app,
    console,
)
from yuu_clip.pipeline import (
    AnalyzeOptions,
    analyze_one,
    rediarize_video,
    reextract_video,
    regenerate_clips,
    retranscribe_video,
    run_scoring,
)

_PAUSE_POLL_INTERVAL_S = 3.0


def _wait_while_paused(project_dir: Path, poll_interval_s: float = _PAUSE_POLL_INTERVAL_S) -> None:
    """Block before starting the next video while the pause flag is present."""
    wait_while_paused(
        project_dir,
        poll_interval_s,
        on_pause=lambda: console.print("[yellow][Paused - waiting to start next video][/yellow]"),
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
            stream.title_tag or "[dim] - [/dim]",
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
    scenes: bool = typer.Option(False, "--scenes", help="Also generate longer 'scene' candidates via the LLM (opt-in; off by default)"),
    diarize: Optional[bool] = typer.Option(None, "--diarize/--no-diarize", help="Override speaker diarization for this run (default: use config)"),
    no_interact: bool = typer.Option(False, "--no-interact", help="Never prompt interactively - use defaults or fail cleanly (set automatically by the web UI)"),
    context: list[str] = typer.Option([], "--context", help="World context IDs to apply (can repeat)"),
    subtitle_source: Optional[str] = typer.Option(None, "--subtitle-source", help="Use existing subtitles instead of Whisper: path/to/file.srt or stream:<index>"),
    video_id: Optional[int] = typer.Option(None, "--video-id", help="Target an existing Video DB record by ID (reanalyze after split)"),
    segment_start: Optional[float] = typer.Option(None, "--segment-start", help="Trim audio extraction start (seconds) for pre-analysis splits"),
    segment_end: Optional[float] = typer.Option(None, "--segment-end", help="Trim audio extraction end (seconds) for pre-analysis splits"),
):
    """Full pipeline: inspect, assign tracks, extract audio, transcribe, generate clips, score."""
    from yuu_clip.config import project_audio_dir, project_proxies_dir
    from yuu_clip.contexts import format_context_block, load_contexts

    _require_ffmpeg()

    proj_dir, session, config = _load_project(project)
    audio_dir = project_audio_dir(proj_dir)
    proxy_dir = project_proxies_dir(proj_dir)

    config.whisper_model        = model
    config.whisper_device       = device
    config.scene_detection_mode = scene_mode
    if diarize is True:
        # Turn speaker labels on for this run, falling back to the default
        # speechbrain backend when the project has diarization disabled.
        if config.diarization_backend == "null":
            config.diarization_backend = "speechbrain"
    elif diarize is False:
        config.diarization_backend = "null"

    context_text = format_context_block(load_contexts(proj_dir), context) if context else ""

    opts = AnalyzeOptions(
        profile=track_layout,
        no_transcribe=no_transcribe or bool(subtitle_source),
        no_segment=no_segment,
        no_score=no_score,
        force=force,
        language=language,
        energy_mode=energy_mode,
        non_interactive=no_interact,
        context_names=list(context),
        context_text=context_text,
        subtitle_source=subtitle_source,
        video_id=video_id,
        segment_start_s=segment_start,
        segment_end_s=segment_end,
        # The --scenes flag can only turn generation on; a project that enabled the
        # Settings toggle still gets scenes on a plain CLI run.
        generate_scenes=scenes or config.scene_generation_enabled,
    )

    video_paths = _resolve_videos(path)
    console.print(f"\n[bold]yuuclip  ·  analyze[/bold]  ({len(video_paths)} video(s))\n")

    for video_path in video_paths:
        _wait_while_paused(proj_dir)
        analyze_one(
            video_path, session, config, audio_dir, opts,
            proxy_dir=proxy_dir, project_dir=proj_dir,
        )

    # Print a generic completion line unconditionally. The "run yuuclip status" hint
    # is CLI-only guidance; the web UI drives its own completion (SSE __DONE__ + job
    # pills), so suppress just that hint on --no-interact runs where it would leak a
    # stray CLI line into the in-app log.
    console.print("\n[bold green]Done![/bold green]\n")
    if not no_interact:
        console.print("Run [cyan]yuuclip status[/cyan] to review your clips.\n")


@app.command()
def rediarize(
    video_id: int = typer.Argument(..., help="Video ID to re-run speaker diarization on"),
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project directory (default: cwd)"),
):
    """Re-detect speakers only: re-run diarization on an existing recording's transcripts.

    Non-destructive - clips, scores, and transcript text are untouched. Named speakers
    re-attach to matching voices by voiceprint, so this is how voiceprint re-attach is
    validated after naming speakers.
    """
    from yuu_clip.db.models import Video

    proj_dir, session, config = _load_project(project)
    # The whole point of this command is to diarize, so force the default backend
    # on even when the project config has diarization disabled.
    if config.diarization_backend == "null":
        config.diarization_backend = "speechbrain"

    video = session.get(Video, video_id)
    if not video:
        console.print(f"[red]No video with ID {video_id}[/red]")
        raise typer.Exit(1)

    console.rule(f"[bold]{video.filename}[/bold]")
    n = rediarize_video(session, config, video)
    console.print(f"\n[bold green]Re-detection complete[/bold green] - {n} track(s) re-diarized.\n")


def _load_video_or_exit(project, video_id):
    """Shared prelude for the single-stage re-run commands: load the project and the
    target recording, exiting cleanly when the ID is unknown."""
    from yuu_clip.db.models import Video

    proj_dir, session, config = _load_project(project)
    video = session.get(Video, video_id)
    if not video:
        console.print(f"[red]No video with ID {video_id}[/red]")
        raise typer.Exit(1)
    return proj_dir, session, config, video


@app.command()
def reextract(
    video_id: int = typer.Argument(..., help="Video ID to re-extract audio for"),
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project directory (default: cwd)"),
):
    """Re-extract audio only: rebuild the WAV tracks from the source file.

    For after the source file or track layout changed. Transcripts are kept - re-transcribe
    afterward to pick up the new audio.
    """
    from yuu_clip.config import project_audio_dir

    _require_ffmpeg()
    proj_dir, session, config, video = _load_video_or_exit(project, video_id)
    console.rule(f"[bold]{video.filename}[/bold]")
    n = reextract_video(session, config, video, project_audio_dir(proj_dir))
    console.print(f"\n[bold green]Re-extraction complete[/bold green] - {n} track(s).\n")


@app.command("retranscribe-video")
def retranscribe_video_cmd(
    video_id: int = typer.Argument(..., help="Video ID to re-transcribe"),
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project directory (default: cwd)"),
    model: str = typer.Option("base", "--model", "-m", help="Speech-to-text model: tiny|base|small|medium|large-v3"),
    language: Optional[str] = typer.Option(None, "--language", "-l", help="Force speech-to-text language (e.g. en)"),
):
    """Re-transcribe only: re-run speech-to-text for the whole recording.

    Re-extracts any missing audio first. Existing clips are kept but flagged as needing a
    re-score (their captions changed); regenerate clips to rebuild them from the new
    transcript.
    """
    from yuu_clip.config import project_audio_dir

    _require_ffmpeg()
    proj_dir, session, config, video = _load_video_or_exit(project, video_id)
    config.whisper_model = model
    console.rule(f"[bold]{video.filename}[/bold]")
    transcripts = retranscribe_video(session, config, video, project_audio_dir(proj_dir), language)
    console.print(f"\n[bold green]Re-transcription complete[/bold green] - {len(transcripts)} track(s).\n")


@app.command("regenerate-clips")
def regenerate_clips_cmd(
    video_id: int = typer.Argument(..., help="Video ID to regenerate clips for"),
    project: Optional[Path] = typer.Option(None, "--project", "-p", help="Project directory (default: cwd)"),
):
    """Regenerate clips only: rebuild sliding-window clips from the existing transcript.

    Destructive - replaces every existing clip (and its approvals, edits, tags, and scores)
    with fresh, unscored candidates. Re-score afterward to populate their scores.
    """
    _, session, config, video = _load_video_or_exit(project, video_id)
    console.rule(f"[bold]{video.filename}[/bold]")
    candidates = regenerate_clips(session, config, video)
    console.print(f"\n[bold green]Clip regeneration complete[/bold green] - {len(candidates)} clip(s).\n")


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
    from yuu_clip.config import project_proxies_dir
    from yuu_clip.contexts import format_context_block, load_contexts
    from yuu_clip.db.models import Video

    if video_id is None and not all_videos:
        console.print("[red]Provide a video ID or --all[/red]")
        raise typer.Exit(1)

    proj_dir, session, config = _load_project(project)
    proxy_dir = project_proxies_dir(proj_dir)

    if no_energy:
        config.scorer_energy_enabled = False
    if no_scenes:
        config.scorer_scenes_enabled = False
    if no_llm:
        config.llm_enabled = False

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
        _cn = json.loads(v.context_names_json) if v.context_names_json else []
        _ctx = format_context_block(load_contexts(proj_dir), _cn)
        # No project_dir: the standalone score command is the web UI's Rescore job,
        # which has no Pause control and no thermal monitor, so a stale pause flag
        # must not be able to stall it with nothing to clear it.
        run_scoring(v, v.audio_tracks, config, session, context_text=_ctx, proxy_dir=proxy_dir)
        session.commit()

    console.print("\n[bold green]Scoring complete.[/bold green]\n")
