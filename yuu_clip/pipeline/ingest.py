"""Per-video analysis pipeline: orchestration and each stage helper.

Used by the ``analyze`` command (full run via ``_analyze_one``) and the
``score`` command (``_run_scoring`` only).
"""
from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from yuu_clip.console import BYTES_PER_MB, console
from yuu_clip.log import get_logger
from yuu_clip.pipeline.run_meta import StageRecorder, build_run_json

log = get_logger(__name__)


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
    # Path to an .srt file, or "stream:<index>" for an embedded subtitle stream.
    # When set, transcription is skipped and the subtitles are imported directly.
    subtitle_source: Optional[str] = None
    # When set, the video row is looked up by ID rather than by path; path arg is ignored.
    video_id: Optional[int] = None
    # Time window for pre-analysis splits: trim audio extraction to this range.
    segment_start_s: Optional[float] = None
    segment_end_s: Optional[float] = None
    # Opt-in LLM scene generation (Clips-vs-Scenes Stage 3). When True and the LLM
    # backend is reachable, generate + score kind='scene' candidates after clips.
    generate_scenes: bool = False


def _parse_srt(text: str) -> list[tuple[int, int, str]]:
    """Parse SRT subtitle text into (start_ms, end_ms, text) triples."""
    import re as _re
    segments = []
    for block in _re.split(r"\n\n+", text.strip()):
        lines = block.strip().splitlines()
        if len(lines) < 3:
            continue
        m = _re.match(
            r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)",
            lines[1].strip(),
        )
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        start_ms = (g[0] * 3600 + g[1] * 60 + g[2]) * 1000 + g[3]
        end_ms   = (g[4] * 3600 + g[5] * 60 + g[6]) * 1000 + g[7]
        text_body = " ".join(lines[2:]).strip()
        if text_body:
            segments.append((start_ms, end_ms, text_body))
    return segments


def _ffmpeg_stderr_tail(stderr, max_lines: int = 8) -> str:
    """Last few non-empty lines of a captured ffmpeg stderr, for a diagnosable log.

    ``CalledProcessError.stderr`` is bytes (capture_output) or None; ffmpeg's real
    reason (e.g. "Stream map '0:5' matches no streams") lives here, not in ``str(exc)``.
    """
    if not stderr:
        return ""
    text = stderr.decode("utf-8", errors="replace") if isinstance(stderr, bytes) else str(stderr)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines[-max_lines:])


def _llm_unavailable_message(reason: str) -> str:
    """One-line plain-English summary recorded in run metadata and shown after a run,
    so a creator who scrolled past the live log still learns why clips got only a
    basic description. Backend-neutral: the *reason* carries the specific fix."""
    return (
        f"AI clip ranking and descriptions were skipped - {reason}. Clips were still "
        "created and ranked from the other signals, with a basic one-line description. "
        "Fix this in Settings, then use Rescore to add the AI score and descriptions."
    )


def _llm_unavailable_notice(reason: str) -> None:
    console.print(f"  [yellow]AI clip ranking and descriptions unavailable - {reason}.[/yellow]")
    console.print(
        "  [yellow]Clips will still be created and ranked from the other signals, with a "
        "basic one-line description. Fix this in Settings, then use Rescore to add the AI "
        "score and descriptions - do it now and it applies to this run.[/yellow]"
    )


def _preflight_llm_check(config, opts: AnalyzeOptions) -> None:
    """Warn up front - before the slow transcription - if LLM scoring is wanted but the
    backend isn't reachable, so the user can start it now instead of discovering
    unranked clips at the end. Silent when scoring is off or the LLM is intentionally
    disabled in Settings."""
    if opts.no_score or not config.llm_enabled:
        return
    from yuu_clip.scoring.llm import check_llm_available

    ok, reason = check_llm_available(config)
    if not ok:
        _llm_unavailable_notice(reason)


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
        console.print(f"[dim]Skipping {video_path.name} (already done - use --force to redo)[/dim]")
        return None

    return video_path, existing


def _obtain_transcripts(opts: AnalyzeOptions, video_path: Path, track_objs, session, video, config) -> list:
    """Import subtitles, transcribe, or skip - depending on the run options."""
    if opts.subtitle_source:
        return _import_subtitles(opts.subtitle_source, video_path, track_objs, session, video)
    if not opts.no_transcribe:
        return _transcribe_and_check_overlap(track_objs, config, session, video, opts.language, opts.force)
    return []


def _should_prewarm_transformers(config, opts: "AnalyzeOptions") -> bool:
    """Whether to resolve transformers.pipeline before diarization imports
    speechbrain. Only speechbrain triggers the k2 poisoning, and only a
    transformers-backed scorer (audio-event, or laugh in "model" mode) needs
    pipeline - so pre-warm exactly when both are in play this run."""
    if config.diarization_backend != "speechbrain":
        return False
    if opts.no_score:
        return False
    return bool(config.scorer_audio_event_enabled) or config.scorer_laugh_mode == "model"


def _analyze_one(
    video_path: Path,
    session,
    config,
    audio_dir: Path,
    opts: AnalyzeOptions,
    proxy_dir: Optional[Path] = None,
) -> None:
    """Orchestrate all pipeline stages for a single video file.

    *proxy_dir* feeds the opt-in auto vision-describe pass in _run_scoring (Stage 4
    of video-heavy analysis); omit it to skip that pass regardless of config."""
    resolved = _resolve_existing_video(session, video_path, opts)
    if resolved is None:
        return
    video_path, existing = resolved

    console.print(f"Analyzing: {video_path.name}")
    console.rule(f"[bold]{video_path.name}[/bold]")

    _preflight_llm_check(config, opts)

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
    # SpeechBrain poisons a not-yet-resolved transformers.pipeline (see
    # prewarm_transformers_pipeline). Resolve pipeline before diarization imports
    # speechbrain, or audio-event/laugh scoring dies silently this run.
    if diarized and _should_prewarm_transformers(config, opts):
        from yuu_clip.scoring.audio_event import prewarm_transformers_pipeline
        prewarm_transformers_pipeline()
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
                recorder.warnings.extend(
                    _run_scoring(
                        video, track_objs, config, session, energy_mode=opts.energy_mode,
                        context_text=opts.context_text, proxy_dir=proxy_dir,
                    ) or []
                )
        except Exception as exc:
            # ScoringEngine.score_video commits after every clip (so the web server can
            # see scores as they land - see scoring/engine.py), so clips scored before
            # the failure keep their committed scores; rollback only discards the
            # in-flight clip's uncommitted work. video.clips_scored_at is set only after
            # the whole batch succeeds, so it stays null here - that flag, not per-clip
            # score presence, is the "fully scored" signal the UI's Rescore prompt uses.
            # Don't let one video's scoring failure abort the rest of the batch.
            session.rollback()
            console.print(f"  [yellow]Scoring failed - clips kept, unscored. Use Rescore to retry: {exc}[/yellow]")
            log.exception("Scoring failed: video_id=%s", video.id)

    if opts.generate_scenes and transcripts:
        try:
            with recorder.stage("Generate Scenes"):
                _generate_and_score_scenes(video, transcripts, config, session, context_text=opts.context_text)
        except Exception as exc:
            # A scene-generation failure must never abort a completed clip run - clips
            # are already committed. Roll back only the in-flight scene work.
            session.rollback()
            console.print(f"  [yellow]Scene generation failed - clips are unaffected: {exc}[/yellow]")
            log.exception("Scene generation failed: video_id=%s", video.id)
        session.commit()

    # The 720p preview proxy is NOT built here - it used to run inline and blocked
    # "Analysis complete" while the whole recording re-encoded. It's now warmed in
    # the background after completion (web UI, _warmPreviewProxy) and built lazily on
    # first preview otherwise (see routes/videos.py proxy/generate).
    video.processed_at = datetime.now(timezone.utc)
    # Run metadata is informational only - never let recording it abort the run.
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
            subprocess.run(
                [ffmpeg, "-y", "-i", str(video_path),
                 "-map", f"0:{stream_idx}", str(tmp_file.name)],
                check=True, capture_output=True,
            )
            srt_path = Path(tmp_file.name)
        else:
            srt_path = Path(subtitle_source)

        srt_text = srt_path.read_text(encoding="utf-8", errors="replace")
        parsed = _parse_srt(srt_text)
    except subprocess.CalledProcessError as exc:
        detail = _ffmpeg_stderr_tail(exc.stderr)
        console.print(f"  [red]Subtitle import failed: ffmpeg exited with code {exc.returncode}[/red]")
        if detail:
            console.print(f"  [red]{detail}[/red]")
        log.error(
            "Subtitle import failed (ffmpeg exit %s): source=%s video=%s\n%s",
            exc.returncode, subtitle_source, video_path, detail,
        )
        return []
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


def _apply_source_metadata(video, video_path: Path) -> None:
    """Populate a freshly-created Video's source_* columns from an Import from
    URL metadata sidecar next to *video_path*, if one exists (see url_import.py).

    Also pre-seeds title_user from the scraped title so the creator doesn't have
    to retype one yt-dlp already found - they can still edit or clear it in the
    recording detail view afterward. A no-op (all source_* stay NULL) for a
    recording added from a local file, which never has a sidecar.
    """
    from yuu_clip.url_import import read_source_sidecar

    metadata = read_source_sidecar(video_path)
    if not metadata:
        return
    video.source_url = metadata.get("source_url") or None
    video.source_title = metadata.get("source_title") or None
    video.source_uploader = metadata.get("source_uploader") or None
    video.source_category = metadata.get("source_category") or None
    upload_date = metadata.get("source_upload_date")
    if upload_date:
        try:
            video.source_upload_date = datetime.strptime(upload_date, "%Y-%m-%d")
        except ValueError:
            log.warning("Ignoring unparseable source_upload_date %r in sidecar for %s", upload_date, video_path)
    if video.source_title and video.title_user is None:
        video.title_user = video.source_title


def _upsert_video_and_tracks(session, video_path: Path, info, existing, profile, force,
                             non_interactive: bool = False,
                             segment_start_s: Optional[float] = None,
                             segment_end_s: Optional[float] = None):
    """Create or update the Video row and its AudioTrack rows.

    Returns (video, track_objs) - the ORM objects for use by later stages.
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
        _apply_source_metadata(video, video_path)
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
    video.status = "extracting"
    session.flush()
    total_tracks = len(track_objs)
    for idx, track in enumerate(track_objs, 1):
        if not track.do_transcribe and not track.do_score:
            console.print(f"  [dim]  Track {idx}/{total_tracks} [{track.label}] - skipped (not transcribed or scored)[/dim]")
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

    if detect_and_apply_overlap_fallback(track_objs):
        console.print(
            "  [yellow]Track overlap detected[/yellow] - specialized tracks appear to "
            "duplicate combined audio. Falling back to combined track only."
        )
        for t in track_objs:
            flag = "[green]transcribe[/green]" if t.do_transcribe else "[dim]skip[/dim]"
            console.print(f"  [dim]  stream {t.stream_index} [{t.label}] -> {flag}[/dim]")
        session.flush()


def _transcribe_and_check_overlap(track_objs, config, session, video, language, force=False) -> list:
    """Transcribe all eligible tracks and suppress duplicates found in combined-track content.

    Idempotent per track: an existing track-level transcript is reused on a normal
    re-run and deleted-then-replaced under ``--force`` (mirrors the ClipCandidate
    force-delete in ``_generate_candidates``). Without this, ``--force`` and resumed
    partial runs mint a second Transcript per track (no unique constraint guards it).
    """
    from yuu_clip.analyze.overlap import detect_transcript_overlap
    from yuu_clip.db.models import Transcript
    from yuu_clip.transcribe.whisper_runner import transcribe_track, whisper_model_cached

    console.print(f"  [bold]Transcribing (model: {config.whisper_model})...[/bold]")
    if not whisper_model_cached(config):
        # The model isn't in the cache yet, so the first transcribe_track below
        # will block while it downloads. Surface that as a legible status line the
        # web UI promotes into the Transcribe step, rather than a silent stall.
        # huggingface_hub holds a per-repo .lock in the shared cache, so if the
        # background prefetch (Stage 6) is mid-download this load waits on that
        # same lock instead of starting a second, cache-corrupting download.
        console.print("Waiting for the speech-to-text model to finish downloading...")
    transcripts = []
    total_tracks = len(track_objs)
    for idx, track in enumerate(track_objs, 1):
        if not track.do_transcribe:
            console.print(
                f"  [dim]  Track {idx}/{total_tracks} [{track.label}] - skipped (not marked for transcription)[/dim]"
            )
            continue
        if not track.extracted_path:
            console.print(f"  [yellow]  Track {idx}/{total_tracks} - no extracted audio, skipping[/yellow]")
            continue

        existing = (
            session.query(Transcript)
            .filter_by(audio_track_id=track.id, clip_id=None)
            .order_by(Transcript.id)
            .all()
        )
        if existing and not force:
            console.print(f"  [dim]  Track {idx}/{total_tracks} already transcribed[/dim]")
            transcripts.append(existing[-1])
            continue
        if existing and force:
            for stale in existing:
                session.delete(stale)
            session.flush()
            console.print(f"  [dim]  Cleared existing transcript for track {track.label} (--force)[/dim]")

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
            "  [yellow]Transcript overlap detected[/yellow] - specialized tracks share "
            "content with combined. Scoring combined track only."
        )
        session.flush()

    return transcripts


def _run_speaker_diarization(config, session, transcripts) -> None:
    """Detect speakers on each transcribed track - a distinct pipeline stage.

    Split out of transcription so the slow diarization pass (pipeline load +
    inference, often minutes) shows as its own "Detecting speakers" step instead
    of masquerading as a hung "Transcribing" step. Silent no-op when the feature
    is off (``diarization_backend == "null"``).
    """
    if not transcripts or config.diarization_backend == "null":
        return
    from yuu_clip.transcribe.whisper_runner import diarize_track, suggest_project_voices

    console.print("  [bold]Detecting speakers...[/bold]")
    for transcript in transcripts:
        track = transcript.audio_track
        if not track.extracted_path or not Path(track.extracted_path).exists():
            console.print(f"  [dim]  Track {track.stream_index} [{track.label}] - no audio, skipping[/dim]")
            continue
        console.print(f"  [dim]  Track {track.stream_index} [{track.label}]...[/dim]")
        diarize_track(config, session, transcript, Path(track.extracted_path), track)
    # Cross-recording Person suggestions run ONCE per recording, after every track's
    # Speakers exist - not per track (all a video's tracks share its Speaker set).
    suggest_project_voices(session, transcripts[0].audio_track.video_id,
                           config.project_voice_match_threshold)
    session.flush()


def _rediarize_video(session, config, video) -> int:
    """Re-run only the diarization stage on a video's existing transcripts.

    Non-destructive: reuses each transcribed track's latest track-level transcript
    and re-runs the speaker stage (_assign_speakers + _attach_speakers via
    diarize_track). Clips, scores, and transcript text are left untouched. Named
    Speakers re-attach to matching voices by voiceprint. Returns the track count.
    """
    from yuu_clip.db.models import latest_track_transcript

    transcripts = []
    for track in video.audio_tracks:
        if not track.do_transcribe or not track.transcripts:
            continue
        transcripts.append(latest_track_transcript(track))

    if not transcripts:
        console.print("[yellow]No transcripts found - analyze the recording first.[/yellow]")
        return 0

    _run_speaker_diarization(config, session, transcripts)
    session.commit()
    return len(transcripts)


def _reextract_video(session, config, video, audio_dir: Path) -> int:
    """Re-run only the audio-extraction stage on a recording's tracks (force re-extract).

    For when the source file or track layout changed. Downstream transcripts are left
    untouched - they still describe the previous audio, so re-transcribe afterward to
    pick up the new tracks. The recording's status is preserved (the extract stage
    normally flips it to a transient "extracting" that would otherwise strand the UI
    spinner on an already-analyzed recording). Returns the number of tracks with
    extracted audio.
    """
    prior_status = video.status
    _extract_audio_and_check_rms_overlap(
        Path(video.path), video, video.audio_tracks, config, audio_dir, session,
        force=True, segment_start_s=video.segment_start_s, segment_end_s=video.segment_end_s,
    )
    video.status = prior_status
    session.commit()
    return sum(1 for track in video.audio_tracks if track.extracted_path)


def _retranscribe_video(session, config, video, audio_dir: Path, language=None) -> list:
    """Re-run the transcription stage for a whole recording (force re-transcribe).

    Re-extracts any missing audio first, then re-transcribes every do_transcribe track,
    replacing its existing transcript. Existing clips keep their windows but are stamped
    ``transcript_edited_at`` so the existing "captions changed since last scoring"
    staleness badge fires - the mark-stale, don't-cascade convention. Regenerate clips
    to rebuild windows/excerpts from the new transcript. Returns the new transcripts.
    """
    prior_status = video.status
    _extract_audio_and_check_rms_overlap(
        Path(video.path), video, video.audio_tracks, config, audio_dir, session,
        force=False, segment_start_s=video.segment_start_s, segment_end_s=video.segment_end_s,
    )
    transcripts = _transcribe_and_check_overlap(
        video.audio_tracks, config, session, video, language, force=True,
    )
    now = datetime.now(timezone.utc)
    for clip in video.clip_candidates:
        clip.transcript_edited_at = now
    if video.clip_candidates:
        video.status = prior_status
    session.commit()
    return transcripts


def _regenerate_clips(session, config, video) -> list:
    """Re-run only the clip-generation stage from the recording's existing transcripts.

    Destructive to clips: replaces every existing clip (and its approvals, edits, tags,
    and scores) with freshly windowed, unscored candidates. Scenes (kind='scene') are
    left intact - clearing is scoped to kind='clip'. The transcript is untouched.
    Clears the video-level "fully scored" marker since the new clips are unscored until a
    re-score runs. Returns the new candidates.
    """
    from yuu_clip.db.models import latest_track_transcript

    transcripts = [
        latest_track_transcript(track)
        for track in video.audio_tracks
        if track.do_transcribe and track.transcripts
    ]
    if not transcripts:
        console.print("[yellow]No transcripts found - analyze the recording first.[/yellow]")
        return []
    candidates = _generate_candidates(
        video, transcripts, config, session,
        no_segment=False, no_transcribe=False, force=True,
    )
    video.clips_scored_at = None
    session.commit()
    return candidates


def _clear_existing_clips(session, video_id: int, kind: str = "clip") -> int:
    """Delete a video's existing candidates of one *kind* (for a --force regeneration),
    cascading to each clip's children via the ORM. Scoped to a single ``kind`` so a
    clip re-window never nukes the recording's scenes (and vice versa) - they share
    the ``clip_candidates`` table. A bulk ``query(...).delete()`` bypasses the ORM
    relationship cascade and would trip SQLite's ``foreign_keys=ON`` constraint on
    ``clip_exports.clip_id`` / ``transcripts.clip_id`` (no ON DELETE CASCADE at the
    DB level) whenever a clip had a tracked export or a clip-level retranscript.
    """
    from yuu_clip.db.models import ClipCandidate

    clips = session.query(ClipCandidate).filter_by(video_id=video_id, kind=kind).all()
    for clip in clips:
        session.delete(clip)
    return len(clips)


def _generate_candidates(video, transcripts, config, session, no_segment, no_transcribe, force) -> list:
    """Generate sliding-window clip candidates from the transcripts, if conditions are met."""
    from yuu_clip.segments.windower import generate_candidates

    if no_segment or not transcripts:
        if not transcripts and not no_transcribe:
            console.print("  [yellow]  No transcripts available - skipping clip generation[/yellow]")
        else:
            video.status = "transcribed"
        session.flush()
        return []

    if force:
        deleted = _clear_existing_clips(session, video.id)
        if deleted:
            console.print(f"  [dim]  Cleared {deleted} existing clips (--force)[/dim]")

    console.print("  [bold]Generating clips...[/bold]")
    candidates = generate_candidates(video, transcripts, config, session)
    candidates = candidates + _generate_visual_candidates(video, candidates, config, session)
    console.print(f"  [green]  OK[/green] {len(candidates)} clips created")
    video.status = "done"
    session.flush()
    return candidates


def _generate_visual_candidates(video, transcript_cands, config, session) -> list:
    """Add a visual candidate source (video-heavy analysis Stage 2), dispatched on
    config.visual_candidate_mode. off/relax add no separate source (off = transcript
    only; relax rescues low-speech windows inside generate_candidates). gaps/parallel
    propose visual clips, dedup them against the transcript clips, cap them, and persist
    the survivors. Returns the visual candidates actually kept."""
    mode = config.visual_candidate_mode
    if mode not in ("gaps", "parallel"):
        return []

    from yuu_clip.segments.merge import merge_candidates
    from yuu_clip.segments.visual_windower import generate_visual_candidates, silent_gaps

    allowed = silent_gaps(transcript_cands, video) if mode == "gaps" else None
    visual = generate_visual_candidates(video, config, session, allowed_regions=allowed)
    if not visual:
        return []

    _transcript, kept = merge_candidates(transcript_cands, visual, config)
    session.add_all(kept)
    if kept:
        console.print(f"  [dim]  + {len(kept)} visual clip(s) ({mode})[/dim]")
    return kept


def _clear_existing_scenes(session, video_id: int) -> int:
    """Delete a recording's existing kind='scene' rows so a re-run replaces scenes
    without touching clips. Thin wrapper over the kind-scoped _clear_existing_clips
    (Stage 0) - the two kinds share the clip_candidates table."""
    return _clear_existing_clips(session, video_id, kind="scene")


def _generate_and_score_scenes(video, transcripts, config, session, context_text: str = "") -> None:
    """Generate + score opt-in LLM scenes for *video* (Clips-vs-Scenes Stage 3).

    Pre-flights the LLM backend and skips with a user-visible reason when it is off or
    unreachable - scene generation is entirely LLM-driven, so this avoids failing after
    a long run. Clears existing scenes first (kind-scoped) so a re-run replaces them.
    """
    from yuu_clip.scoring.llm import check_llm_available

    if not config.llm_enabled:
        console.print("  [yellow]Scene generation skipped - LLM scoring is turned off in Settings.[/yellow]")
        log.info("Scene generation skipped: LLM disabled. video_id=%s", video.id)
        return
    llm_ok, llm_reason = check_llm_available(config)
    if not llm_ok:
        console.print(
            f"  [yellow]Scene generation skipped - {llm_reason}. Turn on the LLM backend "
            f"and re-analyze to generate scenes.[/yellow]"
        )
        log.info("Scene generation skipped: %s. video_id=%s", llm_reason, video.id)
        return

    from yuu_clip.segments.scene_segmenter import generate_scenes

    cleared = _clear_existing_scenes(session, video.id)
    if cleared:
        console.print(f"  [dim]  Cleared {cleared} existing scene(s)[/dim]")

    console.print("  [bold]Generating scenes (LLM)...[/bold]")
    scenes = generate_scenes(video, transcripts, config, session)
    session.flush()
    console.print(f"  [green]  OK[/green] {len(scenes)} scene(s) created")
    if scenes:
        _score_scenes(video, config, session, context_text)


def _score_scenes(video, config, session, context_text: str = "") -> None:
    """Score the recording's kind='scene' rows via the Stage 2 scene rubric.

    Builds a ScoringEngine whose scene scorer set is the scene-mode LLMScorer; the
    engine routes kind='scene' rows there and never runs the clip Funny/Dramatic/Action
    scorers over them (score_video(kind='scene'))."""
    from yuu_clip.db.models import HotWord, SensitiveTerm
    from yuu_clip.scoring.engine import ScoringEngine
    from yuu_clip.scoring.scorer_set import build_scene_scorers

    hot_words = session.query(HotWord).all()
    sensitive_terms = session.query(SensitiveTerm).all()
    engine = ScoringEngine(
        config, scorers=[],
        hot_words=hot_words, sensitive_terms=sensitive_terms,
        scene_scorers=build_scene_scorers(config, context_text=context_text),
    )
    console.print("  [bold]Scoring scenes...[/bold]")
    n = engine.score_video(
        video, session, kind="scene",
        progress_cb=lambda i, total: console.print(f"  Scoring scene {i}/{total}..."),
    )
    console.print(f"  [green]  OK[/green] {n} scene(s) scored")


def _summarize_video(video, transcripts, config, session, context_text: str = "") -> None:
    from yuu_clip.scoring.llm import summarize_transcript

    # A segment video's audio is extracted trimmed to [segment_start_s, segment_end_s]
    # (see _extract_audio_and_check_rms_overlap), so its transcript times are already
    # 0-based within the segment - the whole transcript belongs to the segment. Do NOT
    # filter by video.segment_start_s here: that is an absolute offset, and comparing it
    # against 0-based segment times drops every line for any segment starting > 0s.
    parts = [
        seg.text.strip()
        for transcript in transcripts
        for seg in transcript.segments
    ]

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


def _run_scoring(
    video, track_objs, config, session, energy_mode: str = "fast", context_text: str = "",
    proxy_dir: Optional[Path] = None,
) -> list[str]:
    """Run Phase 2 scoring (energy, scenes, LLM) for all candidates belonging to *video*.

    Returns plain-English warnings worth surfacing after the run (e.g. the LLM was
    unavailable, so clips got only a basic description). *proxy_dir* feeds the
    opt-in auto vision-describe pass (video-heavy analysis Stage 4) that runs after
    scoring; omit it (None) to skip that pass regardless of the config toggle."""
    from yuu_clip.scoring.audio_event import AudioEventScorer, audio_event_model_cached
    from yuu_clip.scoring.energy import compute_energy
    from yuu_clip.scoring.engine import ScoringEngine
    from yuu_clip.scoring.laugh import LaughScorer
    from yuu_clip.scoring.scenes import compute_scenes

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

    if config.scorer_visual_enabled:
        from yuu_clip.analyze.motion import compute_activity
        console.print("  [bold]Measuring on-screen activity...[/bold]")
        try:
            n = compute_activity(video, session, config)
            msg = f"  [green]  OK[/green] {n} activity samples measured" if n else "  [dim]  Activity already measured or no video stream[/dim]"
            console.print(msg)
            session.flush()
        except Exception as e:
            console.print(f"  [yellow]  Activity measurement skipped: {e}[/yellow]")
            log.exception("Visual-activity measurement failed: video_id=%s", video.id)

    warnings: list[str] = []
    console.print("  [bold]Scoring clips...[/bold]")
    if config.llm_enabled:
        from yuu_clip.scoring.llm import check_llm_available
        llm_ok, llm_reason = check_llm_available(config)
        if not llm_ok:
            _llm_unavailable_notice(llm_reason)
            warnings.append(_llm_unavailable_message(llm_reason))

    laugh_scorer = LaughScorer(config)
    laugh_ok = True
    if config.scorer_laugh_mode in ("audio", "model"):
        laugh_ok, laugh_reason = laugh_scorer.availability()
        if not laugh_ok:
            console.print(
                f"  [yellow]Laughter detection unavailable - {laugh_reason}. "
                f"Clips are still scored using the other signals.[/yellow]"
            )

    audio_event_scorer = AudioEventScorer(config)
    audio_ok = True
    if config.scorer_audio_event_enabled:
        audio_ok, audio_reason = audio_event_scorer.availability()
        if not audio_ok:
            console.print(
                f"  [yellow]Audio-event detection unavailable - {audio_reason}. "
                f"Clips are still scored using the other signals.[/yellow]"
            )

    # The audio-event scorer and LaughScorer's "model" mode share the same AST
    # checkpoint - one visible notice covers both instead of printing it twice.
    uses_ast_model = (
        (config.scorer_audio_event_enabled and audio_ok) or
        (config.scorer_laugh_mode == "model" and laugh_ok)
    )
    if (
        uses_ast_model and config.scorer_laugh_model_id
        and not audio_event_model_cached(config.scorer_laugh_model_id)
    ):
        console.print(
            "  [dim]Downloading the audio-event model (~350 MB) so laughter/action-sound "
            "detection can run - this happens once...[/dim]"
        )

    from yuu_clip.db.models import HotWord, SensitiveTerm
    from yuu_clip.scoring.scorer_set import build_clip_scorers
    hot_words = session.query(HotWord).all()
    sensitive_terms = session.query(SensitiveTerm).all()
    engine = ScoringEngine(
        config,
        build_clip_scorers(
            config, context_text=context_text,
            laugh_scorer=laugh_scorer, audio_event_scorer=audio_event_scorer,
        ),
        hot_words=hot_words, sensitive_terms=sensitive_terms,
    )
    if not engine.has_scorers:
        console.print(
            "  [yellow]No scoring signals are available - clips were created but left "
            "unscored. Check Settings (LLM / laughter), then use Rescore.[/yellow]"
        )
    n = engine.score_video(
        video, session,
        progress_cb=lambda i, total: console.print(f"  Scoring {i}/{total}..."),
    )
    if audio_event_scorer.load_failed or laugh_scorer.load_failed:
        console.print(
            "  [yellow]The audio-event model couldn't be downloaded - clips were scored "
            "without it. Check your connection, then use Rescore once you're back "
            "online.[/yellow]"
        )
    console.print(f"  [green]  OK[/green] {n} clips scored")
    video.clips_scored_at = datetime.now(timezone.utc)
    video.clips_scored_context_json = video.context_names_json or "[]"
    session.flush()

    try:
        from yuu_clip.pipeline.vision_describe import auto_describe_visual_clips
        auto_describe_visual_clips(video, config, session, proxy_dir, context_text)
    except Exception as exc:
        console.print(f"  [yellow]Auto-describe silent clips failed: {exc}[/yellow]")
        log.exception("Auto vision-describe failed: video_id=%s", video.id)

    return warnings
