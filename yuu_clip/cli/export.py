"""Export commands: export a single clip, retranscribe a clip window."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer

from yuu_clip.cli._base import (
    BYTES_PER_MB,
    _extract_wav_segment,
    _get_session,
    _load_project,
    _project_dir,
    app,
    console,
    log,
)
from yuu_clip.export_naming import DEFAULT_EXPORT_NAME_TEMPLATE, export_base_stem


def _maybe_diarize_segment(session, config, video_id: int, transcript_id: int, segment_wav: Path,
                           offset_s: float, track_label: str) -> None:
    """Assign speaker labels to a retranscribed clip's segments, if diarization is available.

    The segment WAV is clip-relative (starts at 0), but the stored TranscriptSegments use
    absolute video timestamps, so the diarization turns are shifted by *offset_s* before
    matching. Voiceprints from this clip are matched against the recording's existing
    Speakers via _attach_speakers, so a named voice re-attaches its name here too — the
    per-clip re-diarize is otherwise identical to the full-recording pass. A no-op when
    no diarization backend / HuggingFace token is configured.
    """
    from yuu_clip.transcribe.diarization_client import DiarizationError, make_diarization_client
    from yuu_clip.transcribe.whisper_runner import _assign_speakers, _attach_speakers

    client = make_diarization_client(config)
    ok, reason = client.available()
    if not ok:
        if config.diarization_backend != "null":
            console.print(f"  [yellow]  Speaker labels skipped: {reason}[/yellow]")
        return

    console.print(f"  [dim]  Diarizing [{track_label}]...[/dim]")
    try:
        turns, embeddings = client.diarize_with_embeddings(str(segment_wav))
        shifted = [(start + offset_s, end + offset_s, label) for start, end, label in turns]
        _assign_speakers(session, transcript_id, shifted)
        _attach_speakers(session, video_id, transcript_id, embeddings,
                         threshold=config.speaker_match_threshold)
        console.print(f"  [green]  OK[/green] [{track_label}]  {len(turns)} speaker turn(s)")
    except DiarizationError as exc:
        log.warning("Diarization failed during retranscribe (tx %d): %s", transcript_id, exc)
        console.print("  [yellow]  Speaker labels skipped:[/yellow]")
        console.print(str(exc), markup=False, highlight=False)
    except Exception as exc:
        log.warning("Diarization failed during retranscribe (tx %d): %s", transcript_id, exc, exc_info=True)
        console.print(f"  [yellow]  Speaker labels skipped: {exc}[/yellow]")


def _run_retranscribe(cand, session, config, language: Optional[str] = None,
                      speaker_labels: bool = False) -> None:
    """Retranscribe a clip's time window and store a clip-scoped Transcript row.

    Does not rescore. Caller is responsible for session.commit() afterward.
    """
    import tempfile
    from datetime import datetime, timezone

    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment
    from yuu_clip.transcribe.whisper_runner import _get_model, resolve_transcription_language

    language = resolve_transcription_language(language, config)

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
            segments_raw, info = _get_model(config).transcribe(str(segment_wav), language=language, vad_filter=True)

            tx = Transcript(
                audio_track_id=track.id,
                clip_id=cand.id,
                model_name=config.whisper_model,
                language=getattr(info, "language", None),
            )
            session.add(tx)
            session.flush()
            new_tx_ids.append(tx.id)

            seg_count = 0
            for seg in segments_raw:
                session.add(TranscriptSegment(
                    transcript_id=tx.id,
                    start_ms=effective_start_ms + int(seg.start * 1000),
                    end_ms=effective_start_ms + int(seg.end * 1000),
                    text=seg.text,
                    confidence=getattr(seg, "avg_logprob", None),
                ))
                seg_count += 1

            session.flush()
            console.print(f"  [green]  OK[/green] [{track.label}]  {seg_count} segments")

            if speaker_labels:
                _maybe_diarize_segment(session, config, cand.video_id, tx.id, segment_wav,
                                       effective_start_s, track.label)

    _update_clip_excerpt(cand, session, new_tx_ids)
    if new_tx_ids:
        cand.transcript_edited_at = datetime.now(timezone.utc)


def _update_clip_excerpt(cand, session, tx_ids: list[int]) -> None:
    """Rebuild the transcript_excerpt on a clip from the given transcript IDs."""
    if not tx_ids:
        return
    from yuu_clip.db.models import TranscriptSegment as _TS
    new_segs = (
        session.query(_TS)
        .filter(_TS.transcript_id.in_(tx_ids))
        .order_by(_TS.start_ms)
        .all()
    )
    if new_segs:
        from yuu_clip.segments.windower import _build_excerpt
        cand.transcript_excerpt = _build_excerpt(new_segs)


def _build_export_path(
    cand, video_path: Path, container: Optional[str], exports_dir: Path, output: Optional[Path],
    name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE, preset_name: str = "default",
) -> tuple[str, Path]:
    """Return (base_stem, resolved_output_path) for an export clip.

    base_stem is used by the caller when writing SRT sidecars.
    output is the caller's --output override when provided; otherwise it is derived
    from name_template and placed in exports_dir. preset_name is "default" for a
    plain export, else an Export preset id — see export_naming.export_base_stem
    for how a non-default preset is folded into the filename.
    """
    suffix = f".{container.lstrip('.')}" if container else (video_path.suffix or ".mkv")
    base   = export_base_stem(cand, name_template, preset=preset_name)
    if output is None:
        output = exports_dir / f"{base}{suffix}"
    return base, output


def _record_clip_export(cand, session, preset_name: str, output_path: Path, settings: dict) -> None:
    """Create or update this clip's clip_exports row for *preset_name*.

    One row per (clip, preset_name): re-exporting the same preset updates the
    existing row in place ("regenerate"); a different preset adds a new row.
    Caller is responsible for session.commit() afterward.
    """
    from datetime import datetime, timezone

    from yuu_clip.db.models import ClipExport

    row = session.query(ClipExport).filter_by(clip_id=cand.id, preset_name=preset_name).first()
    if row is None:
        row = ClipExport(clip_id=cand.id, preset_name=preset_name)
        session.add(row)
    row.path = str(output_path.resolve())
    row.container = output_path.suffix.lstrip(".")
    row.created_at = datetime.now(timezone.utc)
    row.settings = settings
    row.size_bytes = output_path.stat().st_size if output_path.exists() else None


def _apply_title_card(clip_path: Path, cand, output: Path, config) -> Path:
    """Prepend a title card to *clip_path*, write the result to *output*, and return *output*.

    Deletes the intermediate *clip_path* after concatenation.
    """
    import tempfile as _tmp

    from yuu_clip.reel import _compile_concat, _make_title_card, title_card_lines

    console.print("  Generating title card...")
    fps    = cand.video.fps    or 30.0
    width  = cand.video.width  or 1920
    height = cand.video.height or 1080
    title_lines = title_card_lines(cand, config, description_size=36, timecode_size=24)
    with _tmp.TemporaryDirectory() as td:
        card_path = Path(td) / "title_card.mkv"
        _make_title_card(
            title_lines, card_path, duration=config.title_card_duration_s, fps=fps, width=width, height=height,
            bg_color=config.title_card_bg_color, font_color=config.title_card_font_color,
        )
        _compile_concat([card_path, clip_path], output)
    clip_path.unlink(missing_ok=True)
    return output


def _write_subtitle_tmp(cand, lines_to_srt_fn, merged_srt_lines_fn, label: str) -> Optional[Path]:
    """Write merged SRT to a temp file; return its path, or None when no transcript data exists."""
    import tempfile
    merged = merged_srt_lines_fn(cand)
    if not merged:
        console.print(f"  [yellow]{label}: no transcript data found, skipping[/yellow]")
        return None
    tmp = tempfile.NamedTemporaryFile(suffix=".srt", delete=False, mode="w", encoding="utf-8")
    tmp.write(lines_to_srt_fn(merged))
    tmp.close()
    return Path(tmp.name)


def _write_export_subs(cand, bake_captions: bool, embed_subs: bool, lines_to_srt, merged_srt_lines):
    """Return (burn_in_path, soft_track_path) temp SRTs based on the caption flags."""
    if bake_captions:
        return _write_subtitle_tmp(cand, lines_to_srt, merged_srt_lines, "--bake-captions"), None
    if embed_subs:
        return None, _write_subtitle_tmp(cand, lines_to_srt, merged_srt_lines, "--embed-subs")
    return None, None


def _finalize_export(cand, session, video_path: Path, output: Path, config, *,
                     precise: bool, title_card: bool, audio_stream_idx: Optional[int],
                     subtitle_path: Optional[Path], subtitle_track_path: Optional[Path],
                     bake_captions: bool, preset_name: str = "default",
                     preset=None) -> None:
    """Cut the clip, optionally prepend a title card, record the export on the clip row.

    preset (export_presets.ExportPreset | None) drives the encode through
    export_clip_with_preset instead of the plain export_clip path when set — a
    preset export always re-encodes and does not support the soft-subtitle
    (embed_subs) track, only burned-in captions (subtitle_path).

    Always deletes the temp subtitle files. Exits the CLI on ffmpeg failure.
    """
    from datetime import datetime, timezone

    from yuu_clip.analyze.extract import export_clip, export_clip_with_preset

    start_ms, end_ms = _compute_export_window(cand)
    try:
        clip_dest = output if not title_card else output.with_suffix(".clip_tmp" + output.suffix)
        if preset is not None:
            result = export_clip_with_preset(
                video_path=video_path,
                start_ms=start_ms,
                end_ms=end_ms,
                output_path=clip_dest,
                preset=preset,
                subtitle_path=subtitle_path,
                audio_stream_index=audio_stream_idx,
            )
        else:
            result = export_clip(
                video_path=video_path,
                start_ms=start_ms,
                end_ms=end_ms,
                output_path=clip_dest,
                reencode=precise or title_card,  # title card concat requires matching codecs
                subtitle_path=subtitle_path,
                subtitle_track_path=subtitle_track_path,
                audio_stream_index=audio_stream_idx,
            )
        if title_card:
            result = _apply_title_card(result, cand, output, config)
        size_mb = result.stat().st_size / BYTES_PER_MB
        console.print(f"  [green]OK[/green] Saved to [cyan]{result}[/cyan]  [dim]({size_mb:.1f} MB)[/dim]")
        cand.exported_at = datetime.now(timezone.utc)
        cand.exported_container = result.suffix.lstrip(".")
        cand.exported_burn_subs = bake_captions
        cand.exported_embed_subs = subtitle_track_path is not None
        cand.exported_title_card = title_card
        settings = {
            "burn_subs": bake_captions,
            "embed_subs": subtitle_track_path is not None,
            "title_card": title_card,
        }
        if preset is not None:
            settings.update(
                height=preset.height, crf=preset.crf,
                target_size_mb=preset.target_size_mb, audio_kbps=preset.audio_kbps,
            )
        _record_clip_export(cand, session, preset_name, result, settings)
        session.commit()
    except (RuntimeError, ValueError) as e:
        console.print(f"  [red]Export failed: {e}[/red]")
        log.error("Export failed: clip_id=%s video=%s: %s", cand.id, video_path, e)
        raise typer.Exit(1)
    finally:
        for tmp_path in (subtitle_path, subtitle_track_path):
            if tmp_path and tmp_path.exists():
                tmp_path.unlink(missing_ok=True)


def _compute_export_window(cand) -> tuple[int, int]:
    """Apply the user's start/end offsets and clamp to the source duration.

    Returns ms relative to the source file passed to export_clip. For a split
    segment, cand.start_ms/end_ms/video.duration_ms are all segment-relative, but
    video.path always points at the untrimmed parent file — so segment_start_s is
    added back in after clamping against the (segment-relative) duration.
    """
    start_ms = max(0, cand.start_ms + int((cand.start_offset or 0.0) * 1000))
    end_ms   = cand.end_ms + int((cand.end_offset or 0.0) * 1000)
    if cand.video.duration_ms:
        end_ms = min(end_ms, cand.video.duration_ms)
    segment_offset_ms = int((cand.video.segment_start_s or 0.0) * 1000)
    return start_ms + segment_offset_ms, end_ms + segment_offset_ms


def _resolve_audio_stream_index(session, cand) -> Optional[int]:
    """Pick the combined track (or first transcribed track) for the exported audio."""
    from yuu_clip.db.models import AudioTrack
    audio_track = (
        session.query(AudioTrack).filter_by(video_id=cand.video_id, label="combined").first()
        or session.query(AudioTrack).filter_by(video_id=cand.video_id, do_transcribe=True).first()
    )
    return audio_track.stream_index if audio_track else None


def _emit_caption_sidecars(cand, output: Path, base: str) -> None:
    from yuu_clip.subtitles import export_srt_sidecars
    srt_files = export_srt_sidecars(cand, output.parent, base)
    if srt_files:
        for srt in srt_files:
            console.print(f"  [green]OK[/green] Captions  [cyan]{srt.name}[/cyan]")
    else:
        console.print("  [dim]No transcript data — captions skipped[/dim]")


def _refresh_caption_sidecars(cand, proj_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE) -> None:
    """CLI-facing wrapper around subtitles.refresh_export_sidecars() that prints progress."""
    from yuu_clip.config import project_exports_dir
    from yuu_clip.subtitles import refresh_export_sidecars

    exports = project_exports_dir(proj_dir)
    for srt in refresh_export_sidecars(cand, exports, name_template):
        console.print(f"  [green]  OK[/green] Captions refreshed  [cyan]{srt.name}[/cyan]")


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
    speaker_labels: bool = typer.Option(True, "--speaker-labels/--no-speaker-labels", help="Add speaker labels during retranscription (no-op without a diarization backend)"),
    title_card: bool = typer.Option(False, "--title-card", help="Prepend a title card with the clip description"),
    preset: Optional[str] = typer.Option(None, "--preset", help="Export preset id (built-in or custom); omit for original quality"),
):
    """Export a clip to a video file."""
    from yuu_clip.config import Config, project_exports_dir, validate_whisper_model
    from yuu_clip.db.models import ClipCandidate
    from yuu_clip.export_presets import resolve_preset
    from yuu_clip.subtitles import lines_to_srt, merged_srt_lines

    if retranscribe:
        try:
            validate_whisper_model(retranscribe_model)
        except ValueError as e:
            console.print(f"[red]{e}[/red]")
            raise typer.Exit(1)

    proj_dir = _project_dir(project)
    session  = _get_session(proj_dir)
    exports  = project_exports_dir(proj_dir)
    config   = Config.load(proj_dir)

    resolved_preset = None
    if preset:
        resolved_preset = resolve_preset(preset, config.export_presets)
        if resolved_preset is None:
            console.print(f"[red]Unknown export preset '{preset}'[/red]")
            raise typer.Exit(1)
        if embed_subs:
            console.print("[red]--embed-subs isn't supported with --preset — use --bake-captions or --no-captions instead[/red]")
            raise typer.Exit(1)
        container = resolved_preset.container

    cand = session.get(ClipCandidate, clip_id)
    if not cand:
        console.print(f"[red]No clip with ID {clip_id}[/red]")
        raise typer.Exit(1)

    if retranscribe:
        retx_config = Config.load(proj_dir)
        retx_config.whisper_model = retranscribe_model
        console.print(
            f"  Retranscribing clip [bold]{clip_id}[/bold] with model [cyan]{retranscribe_model}[/cyan] before export..."
        )
        _run_retranscribe(cand, session, retx_config, speaker_labels=speaker_labels)
        session.commit()

    video_path = Path(cand.video.path)
    if not video_path.exists():
        console.print(f"[red]Source video not found: {video_path}[/red]")
        raise typer.Exit(1)

    preset_name = resolved_preset.name if resolved_preset else "default"
    base, output = _build_export_path(
        cand, video_path, container, exports, output, config.export_name_template, preset_name=preset_name,
    )
    console.print(f"  Exporting clip [bold]{clip_id}[/bold]  {cand.start_hms}  ({cand.duration_hms})  ...")

    subtitle_path, subtitle_track_path = _write_export_subs(
        cand, bake_captions, embed_subs, lines_to_srt, merged_srt_lines
    )
    _finalize_export(
        cand, session, video_path, output, config,
        precise=precise, title_card=title_card,
        audio_stream_idx=_resolve_audio_stream_index(session, cand),
        subtitle_path=subtitle_path, subtitle_track_path=subtitle_track_path,
        bake_captions=bake_captions, preset_name=preset_name, preset=resolved_preset,
    )

    if captions:
        _emit_caption_sidecars(cand, output, base)


@app.command()
def retranscribe(
    clip_id: int = typer.Argument(..., help="Clip candidate ID"),
    project: Optional[Path] = typer.Option(None, "--project", "-p"),
    model: str = typer.Option("large-v3", "--model", "-m"),
    language: Optional[str] = typer.Option(None, "--language"),
    no_rescore: bool = typer.Option(False, "--no-rescore"),
    speaker_labels: bool = typer.Option(True, "--speaker-labels/--no-speaker-labels", help="Add speaker labels (no-op without a diarization backend)"),
    refresh_captions: bool = typer.Option(True, "--refresh-captions/--no-refresh-captions", help="Regenerate this clip's SRT caption sidecar if it was already exported (no-op otherwise)"),
) -> None:
    """Re-transcribe just the time window of a clip, then re-score it."""
    from yuu_clip.config import validate_whisper_model
    from yuu_clip.db.models import ClipCandidate

    try:
        validate_whisper_model(model)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)
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

    _run_retranscribe(cand, session, config, language=language, speaker_labels=speaker_labels)
    session.commit()

    if not no_rescore:
        from yuu_clip.contexts import format_context_block, load_contexts
        from yuu_clip.db.models import HotWord, SensitiveTerm
        from yuu_clip.db.models import Video as _Video
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.llm import LLMScorer
        cand = session.get(ClipCandidate, clip_id)
        vid = session.get(_Video, cand.video_id)
        context_names = json.loads(vid.context_names_json) if vid and vid.context_names_json else []
        context_text = format_context_block(load_contexts(proj_dir), context_names)
        console.print("  Re-scoring clip with LLM...")
        hot_words = session.query(HotWord).all()
        sensitive_terms = session.query(SensitiveTerm).all()
        engine = ScoringEngine(
            config, [LLMScorer(config, context_text=context_text)],
            hot_words=hot_words, sensitive_terms=sensitive_terms,
        )
        engine.score_clip(cand, session)
        session.commit()
        console.print("  [green]  OK[/green]")

    if refresh_captions:
        _refresh_caption_sidecars(cand, proj_dir, config.export_name_template)

    console.print("  [green]Done.[/green]")
