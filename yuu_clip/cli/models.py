"""Tier-B model prefetch command — downloads one auto-fetched model on demand.

Invoked as a subprocess by POST /api/models/prefetch (routes/models.py), which
streams this command's output as SSE — the same "download <model> so <feature>
works" pattern as /api/llm/ollama/pull, generalized to the other Tier-B models
(packaging-strategy overhaul, Wave 4). The GGUF/Ollama LLM model keeps its own
existing path and isn't handled here.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

from yuu_clip.cli._base import _project_dir, app, console

# slug -> friendly description, shown before the download starts.
_PREFETCH_DESCRIPTIONS: dict[str, str] = {
    "speaker": "the speaker model (~80 MB) so speaker labels can run",
    "audio_event": "the audio-event model (~350 MB) so laughter/action-sound detection can run",
    "embeddings": "the embeddings model (~130 MB) so smart similarity matching can run",
}


def _fetch(slug: str, config) -> None:
    if slug == "speaker":
        from yuu_clip.transcribe.diarization_client import prefetch_speechbrain_model
        prefetch_speechbrain_model(config)
    elif slug == "audio_event":
        from yuu_clip.scoring.audio_event import prefetch_audio_event_model
        prefetch_audio_event_model(config)
    elif slug == "embeddings":
        from yuu_clip.scoring.similarity import prefetch_embeddings_model
        prefetch_embeddings_model()


@app.command("prefetch-model")
def prefetch_model_cmd(
    slug: str = typer.Argument(..., help="Which Tier-B model to download: speaker, audio_event, or embeddings"),
    project: Optional[Path] = typer.Option(None, "-p", "--project", help="Project directory (default: cwd)"),
) -> None:
    """Download one Tier-B model now, instead of waiting for its feature's first use."""
    if slug not in _PREFETCH_DESCRIPTIONS:
        console.print(f"[red]Unknown model slug '{slug}' — allowed: {sorted(_PREFETCH_DESCRIPTIONS)}[/red]")
        raise typer.Exit(1)

    from yuu_clip.config import Config
    from yuu_clip.log import configure_logging

    proj_dir = _project_dir(project)
    configure_logging(proj_dir)
    config = Config.load(proj_dir)

    console.print(f"Downloading {_PREFETCH_DESCRIPTIONS[slug]}...")
    try:
        _fetch(slug, config)
    except Exception as exc:
        console.print(f"[red]Download failed: {exc}[/red]")
        raise typer.Exit(1)

    console.print("[green]Done — ready.[/green]")
