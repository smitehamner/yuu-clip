"""Per-video analysis pipeline: orchestration and each stage helper.

Used by the ``analyze`` command (full run via ``_analyze_one``) and the
``score`` command (``_run_scoring`` only).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from yuu_clip.cli._base import (
    BYTES_PER_MB,
    AnalyzeOptions,
    _parse_srt,
    console,
    log,
)
from yuu_clip.cli._run_meta import StageRecorder, build_run_json


def _resolve_existing_video(session, video_path: Path, opts: AnalyzeOptions):
    """Find the Video row this run targets, rewriting video_path when targeting by ID.

    Returns (video_path, existing) or None when the caller should skip this video
    (ID not found, or already done without --force).
    """
    from yuu_clip.db.models import Video

    abs_path = str(video_path.resolve())

    if opts.video_id is not None:
        existing = session.query(Video).filter_by(id=opts.video_id).first()
        if not existing:
            console.print(f"[red]Video ID {opts.video_id} not found in DB[/red]")
            return None
        video_path = Path(existing.path)
    elif opts.segment_start_s is not None:
        # Pre-analysis split: each segment is a distinct video keyed by (path, segment_start_s).
        existing = session.query(Video).filter_by(
            path=abs_path, segment_start_s=opts.segment_start_s
        ).first()
    else:
        existing = session.query(Video).filter_by(path=abs_path, segment_start_s=None).first()

    if existing and existing.status == "done" and not opts.force:
        console.print(f"[dim]Skipping {video_path.name} (already done — use --force to redo)[/dim]")
        return None

    return video_path, existing


def _obtain_transcripts(opts: AnalyzeOptions, video_path: Path, track_objs, session, video, config) -> list:
    """Import subtitles, transcribe, or skip — depending on the run options."""
    if opts.subtitle_source:
        return _import_subtitles(opts.subtitle_source, video_path, track_objs, session, video)
    if not opts.no_transcribe:
        return _transcribe_and_check_overlap(track_objs, config, session, video, opts.language)
    return []


def _analyze_one(
    video_path: Path,
    session,
    config,
    audio_dir: Path,
    opts: AnalyzeOptions,
) -> None:
    """Orchestrate all pipeline stages for a single video file."""
    resolved = _resolve_existing_video(session, video_path, opts)
    if resolved is None:
        return
    video_path, existing = resolved

    console.print(f"Analyzing: {video_path.name}")
    console.rule(f"[bold]{video_path.name}[/bold]")

    started_at = datetime.now(timezone.utc)
    recorder = StageRecorder()

    with recorder.stage("Inspect"):
        info = _probe_video(video_path)
    if info is None:
        return

    # For pre-analysis segments, pass the bounds so they get stored on the new Video row.
    seg_start_for_upsert = opts.segment_start_s if opts.video_id is None else None
    seg_end_for_upsert   = opts.segment_end_s   if opts.video_id is None else None

    video, track_objs = _upsert_video_and_tracks(
        session, video_path, info, existing, opts.profile, opts.force,
        non_interactive=opts.non_interactive,
        segment_start_s=seg_start_for_upsert,
        segment_end_s=seg_end_for_upsert,
    )
    video.analyze_started_at = started_at
    if opts.context_names:
        video.context_names_json = json.dumps(opts.context_names)

    # When this is a segment, use the segment window for duration and FFmpeg extraction.
    seg_start = video.segment_start_s
    seg_end   = video.segment_end_s
    if seg_start is not None and seg_end is not None:
        video.duration_ms = int((seg_end - seg_start) * 1000)

    session.commit()

    with recorder.stage("Extract"):
        _extract_audio_and_check_rms_overlap(
            video_path, video, track_objs, config, audio_dir, session, opts.force,
            segment_start_s=seg_start, segment_end_s=seg_end,
        )
    session.commit()

    with recorder.stage("Import captions" if opts.subtitle_source else "Transcribe"):
        transcripts = _obtain_transcripts(opts, video_path, track_objs, session, video, config)
    session.commit()

    transcribed = not opts.subtitle_source and not opts.no_transcribe
    diarized = bool(transcripts) and config.diarization_backend != "null"
    if diarized:
        with recorder.stage("Speakers"):
            _run_speaker_diarization(config, session, transcripts)
        session.commit()

    with recorder.stage("Generate Clips"):
        candidates = _generate_candidates(video, transcripts, config, session, opts.no_segment, opts.no_transcribe, opts.force)
    session.commit()

    if not opts.no_score and transcripts:
        with recorder.stage("Summarize"):
            _summarize_video(video, transcripts, config, session, context_text=opts.context_text)
        session.commit()

    if not opts.no_score and candidates:
        try:
            with recorder.stage("Score"):
                _run_scoring(video, track_objs, config, session, energy_mode=opts.energy_mode, context_text=opts.context_text)
        except Exception as exc:
            # ScoringEngine.score_video commits after every clip (so the web server can
            # see scores as they land — see scoring/engine.py), so clips scored before
            # the failure keep their committed scores; rollback only discards the
            # in-flight clip's uncommitted work. video.clips_scored_at is set only after
            # the whole batch succeeds, so it stays null here — that flag, not per-clip
            # score presence, is the "fully scored" signal the UI's Rescore prompt uses.
            # Don't let one video's scoring failure abort the rest of the batch.
            session.rollback()
            console.print(f"  [yellow]Scoring failed — clips kept, unscored. Use Rescore to retry: {exc}[/yellow]")
            log.exception("Scoring failed: video_id=%s", video.id)

    # Opportunistically build the 720p preview proxy so scrubbing is fast later.
    # Best-effort: a proxy failure must never fail the analysis.
    _maybe_generate_proxy(video, audio_dir, session)

    video.processed_at = datetime.now(timezone.utc)
    # Run metadata is informational only — never let recording it abort the run.
    try:
        video.analyze_run_json = build_run_json(
            recorder, config, opts, started_at,
            transcribed=transcribed, diarized=diarized,
        )
    except Exception:
        log.exception("Failed to record analyze run metadata (non-fatal): video_id=%s", video.id)
    session.commit()


def _import_subtitles(subtitle_source: str, video_path: Path, track_objs, session, video):
    """Import subtitles from an SRT file or embedded stream as TranscriptSegments.

    subtitle_source is either a file path ending in .srt, or "stream:<index>" for an
    embedded subtitle stream (extracted via ffmpeg to a temp SRT first).
    Returns a list of Transcript ORM objects (one per do_transcribe track).
    """
    import tempfile

    from yuu_clip.config import find_ffmpeg
    from yuu_clip.db.models import Transcript, TranscriptSegment

    console.print("  [bold]Importing subtitles...[/bold]")

    srt_path: Optional[Path] = None
    tmp_file = None
    try:
        if subtitle_source.startswith("stream:"):
            stream_idx = subtitle_source.split(":", 1)[1]
            ffmpeg, _ = find_ffmpeg()
            tmp_file = tempfile.NamedTemporaryFile(suffix=".srt", delete=False, mode="w")
            tmp_file.close()
            import subprocess as _sp
            _sp.run(
                [ffmpeg, "-y", "-i", str(video_path),
                 "-map", f"0:{stream_idx}", str(tmp_file.name)],
                check=True, capture_output=True,
            )
            srt_path = Path(tmp_file.name)
        else:
            srt_path = Path(subtitle_source)

        srt_text = srt_path.read_text(encoding="utf-8", errors="replace")
        parsed = _parse_srt(srt_text)
    except Exception as exc:
        console.print(f"  [red]Subtitle import failed: {exc}[/red]")
        log.exception("Subtitle import failed: source=%s video=%s", subtitle_source, video_path)
        return []
    finally:
        if tmp_file:
            Path(tmp_file.name).unlink(missing_ok=True)

    console.print(f"  Imported {len(parsed)} subtitle segment(s)")

    transcripts = []
    # Attach to the first do_transcribe track (or track 0 as fallback).
    target_track = next((t for t in track_objs if t.do_transcribe), track_objs[0] if track_objs else None)
    if target_track is None:
        return []

    tr = Transcript(audio_track_id=target_track.id, model_name="srt-import")
    session.add(tr)
    session.flush()
    for start_ms, end_ms, text in parsed:
        seg = TranscriptSegment(
            transcript_id=tr.id, start_ms=start_ms, end_ms=end_ms, text=text,
        )
        session.add(seg)
    video.status = "transcribing"
    session.flush()
    video.status = "segmented"
    transcripts.append(tr)
    return transcripts


def _maybe_generate_proxy(video, audio_dir: Path, session) -> None:
    """Build the 720p preview proxy for a recording during analysis, if missing.

    Keyed by source path, so a split recording's segments share one proxy — the
    first segment to reach here builds it and the rest see it fresh and skip.
    Non-fatal: proxy generation is a convenience, never a pipeline requirement.
    """
    from yuu_clip.analyze.proxy import (
        generate_proxy,
        proxy_file_for,
        proxy_is_fresh,
        record_proxy_metadata,
    )

    proxy_dir = audio_dir.parent / "proxies"
    source = Path(video.path)
    proxy_file = proxy_file_for(source, proxy_dir)
    if proxy_is_fresh(video, proxy_file):
        return
    try:
        console.print("  [bold]Building 720p preview…[/bold]")
        generate_proxy(
            source, proxy_file, duration_ms=video.duration_ms,
            progress_cb=lambda frac: None,
        )
        record_proxy_metadata(session, video, proxy_file)
        session.flush()
        console.print("  [green]  OK[/green] 720p preview ready")
    except Exception as exc:
        console.print(f"  [yellow]  Preview proxy skipped: {exc}[/yellow]")
        log.exception("Preview proxy generation failed: video_id=%s", video.id)


def _probe_video(video_path: Path):
    """Run ffprobe on the video and return a ProbeResult, or None on failure."""
    from yuu_clip.analyze.probe import probe_video
    console.print("  [bold]Inspecting...[/bold]")
    try:
        info = probe_video(video_path)
    except Exception as e:
        console.print(f"  [red]Inspect failed: {e}[/red]")
        log.exception("Probe failed: path=%s", video_path)
        return None
    console.print(
        f"  [dim]Duration: [cyan]{info.duration_hms}[/cyan]  ·  "
        f"{info.width}×{info.height}  ·  {info.fps:.2f} fps  ·  "
        f"{len(info.audio_streams)} audio track(s)[/dim]"
    )
    return info


def _upsert_video_and_tracks(session, video_path: Path, info, existing, profile, force,
                             non_interactive: bool = False,
                             segment_start_s: Optional[float] = None,
                             segment_end_s: Optional[float] = None):
    """Create or update the Video row and its AudioTrack rows.

    Returns (video, track_objs) — the ORM objects for use by later stages.
    """
    from yuu_clip.analyze.labeler import label_tracks
    from yuu_clip.db.models import AudioTrack, Video

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
        if segment_start_s is not None:
            video.segment_start_s = segment_start_s
            video.segment_end_s   = segment_end_s
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
    segment_start_s: Optional[float] = None, segment_end_s: Optional[float] = None,
) -> None:
    """Extract each track to WAV, then suppress specialized tracks if they duplicate combined audio.

    OBS can be misconfigured to record the same audio on both the combined and
    individual tracks. The RMS Pearson-correlation check (overlap.py) detects this
    and marks duplicates so they are not scored separately.
    """
    from yuu_clip.analyze.extract import extract_audio_track
    from yuu_clip.analyze.overlap import detect_and_apply_overlap_fallback

    console.print("  [bold]Extracting audio...[/bold]")
    total_tracks = len(track_objs)
    for idx, track in enumerate(track_objs, 1):
        if not track.do_transcribe and not track.do_score:
            console.print(f"  [dim]  Track {idx}/{total_tracks} [{track.label}] — skipped (not transcribed or scored)[/dim]")
            continue
        if track.extracted_path and Path(track.extracted_path).exists() and not force:
            console.print(f"  [dim]  Track {idx}/{total_tracks} already extracted[/dim]")
            continue
        seg_suffix = f"_seg{int(segment_start_s * 1000)}" if segment_start_s is not None else ""
        out_path = audio_dir / f"{Path(video.filename).stem}_stream{track.stream_index}{seg_suffix}.wav"
        try:
            extract_audio_track(
                video_path, track.stream_index, out_path,
                config.audio_sample_rate, config.audio_channels,
                start_s=segment_start_s, end_s=segment_end_s,
            )
            track.extracted_path = str(out_path)
            size_mb = out_path.stat().st_size / BYTES_PER_MB
            console.print(
                f"  [green]  OK[/green] [{track.label}] -> {out_path.name}  [dim]({size_mb:.1f} MB)[/dim]"
            )
        except RuntimeError as e:
            console.print(f"  [red]  FAIL extraction: {e}[/red]")
            log.exception("Audio extraction failed: video=%s stream=%s", video.filename, track.stream_index)

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
    total_tracks = len(track_objs)
    for idx, track in enumerate(track_objs, 1):
        if not track.do_transcribe:
            console.print(
                f"  [dim]  Track {idx}/{total_tracks} [{track.label}] — skipped (not marked for transcription)[/dim]"
            )
            continue
        if not track.extracted_path:
            console.print(f"  [yellow]  Track {idx}/{total_tracks} — no extracted audio, skipping[/yellow]")
            continue
        console.print(f"  [dim]  Track {idx}/{total_tracks} [{track.label}]...[/dim]")
        try:
            transcript = transcribe_track(track, config, session, language=language)
            console.print(
                f"  [green]  OK[/green] [{track.label}]  {len(transcript.segments)} segments  "
                f"[dim](language: {transcript.language or 'auto'})[/dim]"
            )
            transcripts.append(transcript)
        except Exception as e:
            console.print(f"  [red]  FAIL transcription: {e}[/red]")
            log.exception("Transcription failed: video=%s stream=%s", video.filename, track.stream_index)

    session.flush()
    video.status = "transcribed"

    if detect_transcript_overlap(track_objs, session):
        console.print(
            "  [yellow]Transcript overlap detected[/yellow] — specialized tracks share "
            "content with combined. Scoring combined track only."
        )
        session.flush()

    return transcripts


def _run_speaker_diarization(config, session, transcripts) -> None:
    """Detect speakers on each transcribed track — a distinct pipeline stage.

    Split out of transcription so the slow diarization pass (pipeline load +
    inference, often minutes) shows as its own "Detecting speakers" step instead
    of masquerading as a hung "Transcribing" step. Silent no-op when the feature
    is off (``diarization_backend == "null"``).
    """
    if not transcripts or config.diarization_backend == "null":
        return
    from yuu_clip.transcribe.whisper_runner import diarize_track

    console.print("  [bold]Detecting speakers...[/bold]")
    for transcript in transcripts:
        track = transcript.audio_track
        if not track.extracted_path or not Path(track.extracted_path).exists():
            console.print(f"  [dim]  Track {track.stream_index} [{track.label}] — no audio, skipping[/dim]")
            continue
        console.print(f"  [dim]  Track {track.stream_index} [{track.label}]...[/dim]")
        diarize_track(config, session, transcript, Path(track.extracted_path), track)
    session.flush()


def _rediarize_video(session, config, video) -> int:
    """Re-run only the diarization stage on a video's existing transcripts.

    Non-destructive: reuses each transcribed track's latest track-level transcript
    and re-runs the speaker stage (_assign_speakers + _attach_speakers via
    diarize_track). Clips, scores, and transcript text are left untouched. Named
    Speakers re-attach to matching voices by voiceprint. Returns the track count.
    """
    transcripts = []
    for track in video.audio_tracks:
        if not track.do_transcribe or not track.transcripts:
            continue
        transcripts.append(max(track.transcripts, key=lambda t: t.id))

    if not transcripts:
        console.print("[yellow]No transcripts found — analyze the recording first.[/yellow]")
        return 0

    _run_speaker_diarization(config, session, transcripts)
    session.commit()
    return len(transcripts)


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


def _summarize_video(video, transcripts, config, session, context_text: str = "") -> None:
    from yuu_clip.scoring.llm import summarize_transcript

    seg_start_ms = int(video.segment_start_s * 1000) if video.segment_start_s is not None else None
    seg_end_ms = int(video.segment_end_s * 1000) if video.segment_end_s is not None else None

    parts = []
    for transcript in transcripts:
        for seg in transcript.segments:
            if seg_start_ms is not None and seg.start_ms < seg_start_ms:
                continue
            if seg_end_ms is not None and seg.end_ms > seg_end_ms:
                continue
            parts.append(seg.text.strip())

    text = " ".join(parts)
    if not text:
        return

    console.print("  [bold]Generating video summary...[/bold]")
    try:
        title, summary = summarize_transcript(text, config, context_text=context_text)
        video.title = title or video.title
        video.summary = summary
        video.summarized_at = datetime.now(timezone.utc)
        video.summary_context_json = video.context_names_json or "[]"
        console.print("  [green]  OK[/green] summary generated")
    except Exception as exc:
        console.print(f"  [yellow]  Summary skipped: {exc}[/yellow]")
        log.exception("Video summary failed: video_id=%s", video.id)


def _run_scoring(video, track_objs, config, session, energy_mode: str = "fast", context_text: str = "") -> None:
    """Run Phase 2 scoring (energy, scenes, LLM) for all candidates belonging to *video*."""
    from yuu_clip.scoring.energy import AudioEnergyScorer, compute_energy
    from yuu_clip.scoring.engine import ScoringEngine
    from yuu_clip.scoring.laugh import LaughScorer
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
            log.exception("Scene detection failed: video_id=%s", video.id)

    console.print("  [bold]Scoring clips...[/bold]")
    engine = ScoringEngine(config, [
        AudioEnergyScorer(config),
        SceneCutScorer(config),
        LaughScorer(config),
        LLMScorer(config, context_text=context_text),
    ])
    n = engine.score_video(
        video, session,
        progress_cb=lambda i, total: console.print(f"  Scoring {i}/{total}..."),
    )
    console.print(f"  [green]  OK[/green] {n} clips scored")
    video.clips_scored_at = datetime.now(timezone.utc)
    video.clips_scored_context_json = video.context_names_json or "[]"
    session.flush()
