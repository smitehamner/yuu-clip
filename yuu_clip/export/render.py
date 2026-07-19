"""The export engine: retranscribe a clip window, stage captions, apply a title
card, compute the export window, and run the final ffmpeg cut.

Driven by the ``export``/``retranscribe`` commands in ``cli/export.py`` (spawned
as a subprocess by the web UI). These functions print progress to the shared
console - that stdout IS the interface the web UI streams over SSE, so the
prints stay here rather than being lifted into the command layer.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Optional

import typer

from yuu_clip.config import run_ffmpeg
from yuu_clip.console import BYTES_PER_MB, console
from yuu_clip.export.naming import DEFAULT_EXPORT_NAME_TEMPLATE, export_base_stem
from yuu_clip.export.window import EMPTY_WINDOW_MESSAGE, export_window_ms
from yuu_clip.log import get_logger

if TYPE_CHECKING:
    from yuu_clip.export.presets import ExportPreset

log = get_logger(__name__)


@dataclass
class ExportOptions:
    """The resolved options for one clip export, assembled by the CLI from its
    flags and handed to :func:`render_export`. *preset* is the already-resolved
    ExportPreset (or None for original-quality); the CLI owns preset lookup and
    user-input validation, this carries only the outcome."""
    output: Optional[Path] = None
    container: Optional[str] = None
    precise: bool = False
    captions: bool = True
    bake_captions: bool = False
    embed_subs: bool = False
    title_card: bool = False
    retranscribe: bool = False
    retranscribe_model: str = "large-v3"
    speaker_labels: bool = True
    preset: Optional["ExportPreset"] = None
    caption_font: Optional[str] = None
    caption_size: Optional[int] = None
    caption_position: Optional[str] = None
    word_highlight: Optional[bool] = None
    word_chunk_size: Optional[int] = None


def render_export(cand, session, config, options: ExportOptions, *, exports_dir: Path) -> None:
    """Run the full single-clip export pipeline: optional retranscribe, resolve the
    output path, stage captions, cut (with an optional title card / preset), and
    write SRT sidecars. The CLI command shrinks to arg-parsing plus one call here,
    so the sequence has a seam callers and tests can reach without CliRunner+ffmpeg."""
    import copy

    from yuu_clip.subtitles import lines_to_ass, lines_to_srt, merged_srt_lines

    if options.retranscribe:
        # Shallow-copy so the whisper-model override for retranscription never
        # mutates the config used for the export itself (only a str field changes).
        retx_config = copy.copy(config)
        retx_config.whisper_model = options.retranscribe_model
        console.print(
            f"  Retranscribing clip [bold]{cand.id}[/bold] with model "
            f"[cyan]{options.retranscribe_model}[/cyan] before export..."
        )
        run_retranscribe(cand, session, retx_config, speaker_labels=options.speaker_labels)
        session.commit()

    video_path = Path(cand.video.path)
    if not video_path.exists():
        console.print(f"[red]Source video not found: {video_path}[/red]")
        raise typer.Exit(1)

    preset_name = options.preset.name if options.preset else "default"
    base, output = _build_export_path(
        cand, video_path, options.container, exports_dir, options.output,
        config.export_name_template, preset_name=preset_name,
    )
    console.print(
        f"  Exporting clip [bold]{cand.id}[/bold]  {cand.start_hms}  ({cand.duration_hms})  ..."
    )

    caption_style = _resolve_caption_style(
        config, options.caption_font, options.caption_size, options.caption_position,
        options.word_highlight, options.word_chunk_size,
    )
    subtitle_path, subtitle_track_path = _write_export_subs(
        cand, options.bake_captions, options.embed_subs, lines_to_srt, merged_srt_lines,
        lines_to_ass=lines_to_ass, word_highlight=caption_style.word_highlight,
        chunk_size=caption_style.word_chunk_size,
    )
    _finalize_export(
        cand, session, video_path, output, config,
        precise=options.precise, title_card=options.title_card,
        audio_stream_idx=_resolve_audio_stream_index(session, cand),
        subtitle_path=subtitle_path, subtitle_track_path=subtitle_track_path,
        bake_captions=options.bake_captions, preset_name=preset_name, preset=options.preset,
        caption_style=caption_style,
    )

    if options.captions:
        _emit_caption_sidecars(cand, output, base)


def _extract_wav_segment(src: Path, dst: Path, start_s: float, end_s: float) -> None:
    """Slice a time range out of a WAV file using ffmpeg stream-copy (fast, lossless).

    Routed through run_ffmpeg so it resolves the bundled binary (packaged builds
    keep ffmpeg off PATH, only at YUU_CLIP_FFMPEG_DIR) and surfaces stderr on
    failure instead of an opaque CalledProcessError.
    """
    run_ffmpeg(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-i", str(src), "-ss", str(start_s), "-to", str(end_s), "-c", "copy", str(dst)],
    )


def _maybe_diarize_segment(session, config, video_id: int, transcript_id: int, segment_wav: Path,
                           offset_s: float, track_label: str) -> None:
    """Assign speaker labels to a retranscribed clip's segments, if diarization is available.

    The segment WAV is clip-relative (starts at 0), but the stored TranscriptSegments use
    absolute video timestamps, so the diarization turns are shifted by *offset_s* before
    matching. Voiceprints from this clip are matched against the recording's existing
    Speakers via _attach_speakers, so a named voice re-attaches its name here too - the
    per-clip re-diarize is otherwise identical to the full-recording pass. A no-op when
    no diarization backend / HuggingFace token is configured.
    """
    from yuu_clip.transcribe.diarization_client import DiarizationError, make_diarization_client
    from yuu_clip.transcribe.speaker_attach import _assign_speakers, _attach_speakers

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
                         threshold=config.speaker_match_threshold,
                         active_backend=config.diarization_backend)
        console.print(f"  [green]  OK[/green] [{track_label}]  {len(turns)} speaker turn(s)")
    except DiarizationError as exc:
        log.warning("Diarization failed during retranscribe (tx %d): %s", transcript_id, exc)
        console.print("  [yellow]  Speaker labels skipped:[/yellow]")
        console.print(str(exc), markup=False, highlight=False)
    except Exception as exc:
        log.warning("Diarization failed during retranscribe (tx %d): %s", transcript_id, exc, exc_info=True)
        console.print(f"  [yellow]  Speaker labels skipped: {exc}[/yellow]")


def run_retranscribe(cand, session, config, language: Optional[str] = None,
                     speaker_labels: bool = False) -> None:
    """Retranscribe a clip's time window and store a clip-scoped Transcript row.

    Does not rescore. Caller is responsible for session.commit() afterward.
    """
    import tempfile
    from datetime import datetime, timezone

    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment
    from yuu_clip.transcribe.transcriber import make_transcriber
    from yuu_clip.transcribe.whisper_runner import resolve_transcription_language

    language = resolve_transcription_language(language, config)
    transcriber = make_transcriber(config)

    tracks = session.query(AudioTrack).filter_by(video_id=cand.video_id, do_transcribe=True).all()
    if not tracks:
        console.print("[yellow]  No tracks marked for transcription - skipping retranscribe[/yellow]")
        return

    effective_start_s  = max(0.0, cand.start_ms / 1000.0 + (cand.start_offset or 0.0))
    effective_end_s    = cand.end_ms / 1000.0 + (cand.end_offset or 0.0)
    effective_start_ms = int(effective_start_s * 1000)

    new_tx_ids: list[int] = []
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        for track in tracks:
            if not track.extracted_path or not Path(track.extracted_path).exists():
                console.print(f"  [yellow]  Track {track.stream_index} - no extracted audio, skipping[/yellow]")
                continue

            segment_wav = tmp_path / f"seg_{track.stream_index}.wav"
            _extract_wav_segment(Path(track.extracted_path), segment_wav, effective_start_s, effective_end_s)

            for old_tx in session.query(Transcript).filter_by(audio_track_id=track.id, clip_id=cand.id).all():
                session.delete(old_tx)
            session.flush()

            console.print(f"  [dim]  Retranscribing track {track.stream_index} [{track.label}]...[/dim]")
            result = transcriber.transcribe(segment_wav, language)

            tx = Transcript(
                audio_track_id=track.id,
                clip_id=cand.id,
                model_name=config.whisper_model,
                language=result.language,
            )
            session.add(tx)
            session.flush()
            new_tx_ids.append(tx.id)

            seg_count = 0
            for seg in result.segments:
                session.add(TranscriptSegment(
                    transcript_id=tx.id,
                    start_ms=effective_start_ms + seg.start_ms,
                    end_ms=effective_start_ms + seg.end_ms,
                    text=seg.text,
                    confidence=seg.confidence,
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
    plain export, else an Export preset id - see export_naming.export_base_stem
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
    title_lines = title_card_lines(cand, config, primary_size=36, secondary_size=24)
    with _tmp.TemporaryDirectory() as td:
        card_path = Path(td) / "title_card.mkv"
        _make_title_card(
            title_lines, card_path, duration=config.title_card_duration_s, fps=fps, width=width, height=height,
            bg_color=config.title_card_bg_color, font_color=config.title_card_font_color,
        )
        try:
            _compile_concat([card_path, clip_path], output)
        finally:
            # clip_path is the .clip_tmp intermediate; a failed concat would otherwise
            # orphan it in the user-visible exports dir (_finalize_export's finally only
            # cleans the subtitle temps, not this one).
            clip_path.unlink(missing_ok=True)
    return output


def _video_play_res(cand) -> Optional[tuple[int, int]]:
    """The clip's source frame size, for the word-highlight ASS PlayRes - so libass
    scales the caption to the same coordinate space the SRT path uses. None when the
    dimensions aren't known (libass then uses its own default)."""
    width, height = cand.video.width, cand.video.height
    return (width, height) if width and height else None


def _write_subtitle_tmp(cand, merged_srt_lines_fn, render_fn, suffix: str, label: str) -> Optional[Path]:
    """Write the merged caption lines to a temp file via *render_fn*; return its path,
    or None when no transcript data exists."""
    import tempfile
    merged = merged_srt_lines_fn(cand)
    if not merged:
        console.print(f"  [yellow]{label}: no transcript data found, skipping[/yellow]")
        return None
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False, mode="w", encoding="utf-8")
    tmp.write(render_fn(merged))
    tmp.close()
    return Path(tmp.name)


def _write_export_subs(cand, bake_captions: bool, embed_subs: bool, lines_to_srt, merged_srt_lines,
                       lines_to_ass=None, word_highlight: bool = False, chunk_size: int = 4):
    """Return (burn_in_path, soft_track_path) temp caption files based on the flags.

    Word-highlight applies only to the burned-in path (an embedded soft-subtitle
    track can't carry the per-word ASS overrides), and writes .ass instead of .srt.
    """
    if bake_captions:
        if word_highlight and lines_to_ass is not None:
            play_res = _video_play_res(cand)
            render = lambda merged: lines_to_ass(merged, chunk_size, play_res)  # noqa: E731
            return _write_subtitle_tmp(cand, merged_srt_lines, render, ".ass", "--bake-captions"), None
        return _write_subtitle_tmp(cand, merged_srt_lines, lines_to_srt, ".srt", "--bake-captions"), None
    if embed_subs:
        return None, _write_subtitle_tmp(cand, merged_srt_lines, lines_to_srt, ".srt", "--embed-subs")
    return None, None


def _finalize_export(cand, session, video_path: Path, output: Path, config, *,
                     precise: bool, title_card: bool, audio_stream_idx: Optional[int],
                     subtitle_path: Optional[Path], subtitle_track_path: Optional[Path],
                     bake_captions: bool, preset_name: str = "default",
                     preset=None, caption_style=None) -> None:
    """Cut the clip, optionally prepend a title card, record the export on the clip row.

    preset (export_presets.ExportPreset | None) drives the encode through
    export_clip_with_preset instead of the plain export_clip path when set - a
    preset export always re-encodes and does not support the soft-subtitle
    (embed_subs) track, only burned-in captions (subtitle_path).

    Always deletes the temp subtitle files. Exits the CLI on ffmpeg failure.
    """
    from datetime import datetime, timezone

    from yuu_clip.analyze.extract import export_clip, export_clip_with_preset

    start_ms, end_ms = export_window_ms(cand)
    # A row saved before the timing route validated its offsets (or edited via the
    # CLI) can still carry a crossed-over trim. ffmpeg answers a zero-length request
    # with a keyframe-sized fragment and exit 0, so this would otherwise be recorded
    # as a successful export of a fraction-of-a-second file.
    if end_ms <= start_ms:
        console.print(f"  [red]Export failed: {EMPTY_WINDOW_MESSAGE}[/red]")
        log.error("Export refused: clip_id=%s has an empty trim window (%d-%d ms)", cand.id, start_ms, end_ms)
        raise typer.Exit(1)
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
                caption_style=caption_style,
                crop_x=cand.crop_x,
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
                caption_style=caption_style,
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
        if bake_captions and caption_style is not None and not caption_style.is_default():
            settings.update(
                caption_font=caption_style.font_name,
                caption_size=caption_style.font_size,
                caption_position=caption_style.position,
            )
            if caption_style.word_highlight:
                settings.update(
                    caption_word_highlight=True,
                    caption_word_chunk_size=caption_style.word_chunk_size,
                )
        if preset is not None:
            settings.update(
                height=preset.height, crf=preset.crf,
                target_size_mb=preset.target_size_mb, audio_kbps=preset.audio_kbps,
            )
            if preset.vertical:
                settings.update(vertical=True, crop_x=cand.crop_x)
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


def _resolve_audio_stream_index(session, cand) -> Optional[int]:
    """Pick the combined track (or first transcribed track) for the exported audio."""
    from yuu_clip.db.models import AudioTrack
    audio_track = (
        session.query(AudioTrack).filter_by(video_id=cand.video_id, label="combined").first()
        or session.query(AudioTrack).filter_by(video_id=cand.video_id, do_transcribe=True).first()
    )
    return audio_track.stream_index if audio_track else None


def _resolve_caption_style(config, font: Optional[str], size: Optional[int], position: Optional[str],
                           word_highlight: Optional[bool] = None, word_chunk_size: Optional[int] = None):
    """Merge per-export caption-style overrides over the configured defaults.

    A None override falls back to config. Values are validated (raising typer.Exit
    on bad input) so a hand-typed CLI flag can't slip an unescaped font name into
    the filtergraph - the same rules the PATCH route enforces.
    """
    from yuu_clip.analyze.extract import CaptionStyle
    from yuu_clip.config import (
        CAPTION_POSITIONS,
        validate_caption_font_name,
        validate_caption_font_size,
        validate_caption_word_chunk_size,
    )

    resolved_font = config.caption_font_name if font is None else font
    resolved_size = config.caption_font_size if size is None else size
    resolved_position = config.caption_position if position is None else position
    resolved_highlight = config.caption_word_highlight if word_highlight is None else word_highlight
    resolved_chunk = config.caption_word_chunk_size if word_chunk_size is None else word_chunk_size
    try:
        validate_caption_font_name(resolved_font)
        validate_caption_font_size(resolved_size)
        validate_caption_word_chunk_size(resolved_chunk)
        if resolved_position not in CAPTION_POSITIONS:
            raise ValueError(f"caption_position must be one of: {sorted(CAPTION_POSITIONS)}")
    except (ValueError, TypeError) as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)
    return CaptionStyle(
        font_name=resolved_font, font_size=resolved_size, position=resolved_position,
        word_highlight=bool(resolved_highlight), word_chunk_size=resolved_chunk,
    )


def _emit_caption_sidecars(cand, output: Path, base: str) -> None:
    from yuu_clip.subtitles import export_srt_sidecars
    srt_files = export_srt_sidecars(cand, output.parent, base)
    if srt_files:
        for srt in srt_files:
            console.print(f"  [green]OK[/green] Captions  [cyan]{srt.name}[/cyan]")
    else:
        console.print("  [dim]No transcript data - captions skipped[/dim]")


def refresh_caption_sidecars(cand, proj_dir: Path, name_template: str = DEFAULT_EXPORT_NAME_TEMPLATE) -> None:
    """CLI-facing wrapper around subtitles.refresh_export_sidecars() that prints progress."""
    from yuu_clip.config import project_exports_dir
    from yuu_clip.subtitles import refresh_export_sidecars

    exports = project_exports_dir(proj_dir)
    for srt in refresh_export_sidecars(cand, exports, name_template):
        console.print(f"  [green]  OK[/green] Captions refreshed  [cyan]{srt.name}[/cyan]")
