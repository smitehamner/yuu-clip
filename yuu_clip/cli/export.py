"""Export commands: export a single clip, retranscribe a clip window.

Thin Typer adapters - the engine they call lives in :mod:`yuu_clip.export.render`.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer

from yuu_clip.cli._base import _load_project, app, console
from yuu_clip.export.render import (
    ExportOptions,
    refresh_caption_sidecars,
    render_export,
    run_retranscribe,
)


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
    caption_font: Optional[str] = typer.Option(None, "--caption-font", help="Burned-in caption font name (must be installed); omit to use the configured default"),
    caption_size: Optional[int] = typer.Option(None, "--caption-size", help="Burned-in caption font size (12-96, or 0 for renderer default); omit to use the configured default"),
    caption_position: Optional[str] = typer.Option(None, "--caption-position", help="Burned-in caption position: bottom or top; omit to use the configured default"),
    word_highlight: Optional[bool] = typer.Option(None, "--word-highlight/--no-word-highlight", help="Highlight each word as it's spoken (burned-in captions only); omit to use the configured default"),
    word_chunk_size: Optional[int] = typer.Option(None, "--word-chunk-size", help="Words shown at once for word-highlight captions (1-12); omit to use the configured default"),
):
    """Export a clip to a video file."""
    from yuu_clip.config import project_exports_dir, validate_whisper_model
    from yuu_clip.db.models import ClipCandidate
    from yuu_clip.export.presets import resolve_preset

    if retranscribe:
        try:
            validate_whisper_model(retranscribe_model)
        except ValueError as e:
            console.print(f"[red]{e}[/red]")
            raise typer.Exit(1)

    # _load_project (not a bare _get_session) so configure_logging fires: export is
    # the most frequently web-invoked subprocess, and a failure deep in the export
    # engine must reach .yuu-clip/yuu-clip.log, not vanish with the transient SSE line.
    proj_dir, session, config = _load_project(project)

    resolved_preset = None
    if preset:
        resolved_preset = resolve_preset(preset, config.export_presets)
        if resolved_preset is None:
            console.print(f"[red]Unknown export preset '{preset}'[/red]")
            raise typer.Exit(1)
        if embed_subs:
            console.print("[red]--embed-subs isn't supported with --preset - use --bake-captions or --no-captions instead[/red]")
            raise typer.Exit(1)
        container = resolved_preset.container

    cand = session.get(ClipCandidate, clip_id)
    if not cand:
        console.print(f"[red]No clip with ID {clip_id}[/red]")
        raise typer.Exit(1)

    render_export(
        cand, session, config,
        ExportOptions(
            output=output, container=container, precise=precise, captions=captions,
            bake_captions=bake_captions, embed_subs=embed_subs, title_card=title_card,
            retranscribe=retranscribe, retranscribe_model=retranscribe_model,
            speaker_labels=speaker_labels, preset=resolved_preset,
            caption_font=caption_font, caption_size=caption_size,
            caption_position=caption_position, word_highlight=word_highlight,
            word_chunk_size=word_chunk_size,
        ),
        exports_dir=project_exports_dir(proj_dir),
    )


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

    run_retranscribe(cand, session, config, language=language, speaker_labels=speaker_labels)
    session.commit()

    if not no_rescore:
        from yuu_clip.contexts import format_context_block, load_contexts
        from yuu_clip.db.models import HotWord, SensitiveTerm
        from yuu_clip.db.models import Video as _Video
        from yuu_clip.scoring.engine import ScoringEngine
        from yuu_clip.scoring.scorer_set import build_llm_scorers
        cand = session.get(ClipCandidate, clip_id)
        vid = session.get(_Video, cand.video_id)
        context_names = json.loads(vid.context_names_json) if vid and vid.context_names_json else []
        context_text = format_context_block(load_contexts(proj_dir), context_names)
        console.print("  Re-scoring clip with LLM...")
        hot_words = session.query(HotWord).all()
        sensitive_terms = session.query(SensitiveTerm).all()
        engine = ScoringEngine(
            config, build_llm_scorers(config, context_text=context_text),
            hot_words=hot_words, sensitive_terms=sensitive_terms,
        )
        # LLM-only rescore: preserve the Visual/laugh axes it does not recompute.
        engine.score_clip(cand, session, preserve_unscored_dims=True)
        session.commit()
        console.print("  [green]  OK[/green]")

    if refresh_captions:
        refresh_caption_sidecars(cand, proj_dir, config.export_name_template)

    console.print("  [green]Done.[/green]")
