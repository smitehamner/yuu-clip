"""Tier-B model prefetch command — downloads one auto-fetched model on demand.

Invoked as a subprocess by POST /api/models/prefetch (routes/models.py), which
streams this command's output as SSE — the same "download <model> so <feature>
works" pattern as /api/llm/ollama/pull, generalized to the other Tier-B models
(packaging-strategy overhaul, Wave 4). The GGUF/Ollama LLM model keeps its own
existing path and isn't handled here.
"""
from __future__ import annotations

import urllib.request
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


@app.command("prefetch-whisper")
def prefetch_whisper_cmd(
    project: Optional[Path] = typer.Option(None, "-p", "--project", help="Project directory (default: cwd)"),
) -> None:
    """Download the configured speech-to-text model now, so the first analysis
    doesn't stall on a first-use download (first-run-friction Stage 6)."""
    from yuu_clip.config import Config
    from yuu_clip.log import configure_logging
    from yuu_clip.transcribe.whisper_runner import prefetch_whisper_model

    proj_dir = _project_dir(project)
    configure_logging(proj_dir)
    config = Config.load(proj_dir)

    console.print(f"Downloading the speech model ({config.whisper_model})...")
    try:
        prefetch_whisper_model(config)
    except Exception as exc:
        console.print(f"[red]Download failed: {exc}[/red]")
        raise typer.Exit(1)

    console.print("[green]Done — the speech model is ready.[/green]")


# ── One-click local (.gguf) model download ──────────────────────────────────
# Server-owned download so the web UI (and, later, the post-launch background
# handoff) can fetch a recommended local LLM natively, instead of only linking
# to a HuggingFace download page. Spawned by POST /api/llm/gguf/download, which
# streams this command's stdout as SSE (routes/llm.py). Progress lines are plain
# text, one per line, so modelcatalog.js can append them the same way it appends
# the Ollama pull's output.

_DOWNLOAD_CHUNK_BYTES = 1 << 20  # 1 MiB reads
_PROGRESS_STEP_PCT = 2  # print progress at most every 2 percentage points


def _resolve_gguf_entry(model_id: str):
    """Return (entry, "") for a downloadable local text .gguf model, else
    (None, reason). Mirrors the route's allowlist so a manual CLI run is guarded
    the same way as the endpoint."""
    from yuu_clip import model_catalog

    entry = model_catalog.model_by_id(model_id)
    if entry is None or not entry.recommended:
        return None, f"Unknown model id '{model_id}'."
    if "text" not in entry.kinds:
        return None, f"Model '{model_id}' is not a text model."
    if model_catalog.BACKEND_LLAMACPP not in entry.backends or not entry.gguf_filename:
        return None, f"Model '{model_id}' has no downloadable .gguf file."
    return entry, ""


def _gguf_url(entry) -> str:
    return f"{entry.gguf_url}/resolve/main/{entry.gguf_filename}"


def _report_progress(downloaded: int, total: int, last_pct: int, display_name: str) -> int:
    if total <= 0:
        return last_pct
    pct = int(downloaded * 100 / total)
    if pct < last_pct + _PROGRESS_STEP_PCT:
        return last_pct
    console.print(
        f"Downloading {display_name}: {pct}% "
        f"({downloaded / 1e9:.1f}/{total / 1e9:.1f} GB)"
    )
    return pct


def _stream_to_file(response, part: Path, total: int, display_name: str) -> None:
    downloaded = 0
    last_pct = -_PROGRESS_STEP_PCT
    with part.open("wb") as handle:
        while True:
            chunk = response.read(_DOWNLOAD_CHUNK_BYTES)
            if not chunk:
                break
            handle.write(chunk)
            downloaded += len(chunk)
            last_pct = _report_progress(downloaded, total, last_pct, display_name)


def _verify_complete(part: Path, total: int) -> None:
    if total > 0 and part.stat().st_size != total:
        actual = part.stat().st_size
        part.unlink(missing_ok=True)
        raise ValueError(f"incomplete download ({actual} of {total} bytes)")


def _download_gguf(url: str, dest: Path, display_name: str) -> None:
    """Download *url* to *dest* via a .part temp file + atomic rename, so a
    failed or cancelled run never leaves a truncated file at the final path.
    An existing .part is a clean restart (never resumed into a stale file)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    if part.exists():
        part.unlink()
    request = urllib.request.Request(url, headers={"User-Agent": "yuu-clip"})
    with urllib.request.urlopen(request) as response:
        total = int(response.headers.get("Content-Length") or 0)
        _stream_to_file(response, part, total, display_name)
    _verify_complete(part, total)
    part.replace(dest)


def _set_llm_model_path(project_dir: Path, model_path: Path) -> None:
    from yuu_clip.config import Config

    config = Config.load(project_dir)
    config.llm_model_path = str(model_path)
    config.save_project(project_dir)


@app.command("download-gguf")
def download_gguf_cmd(
    model_id: str = typer.Option(..., "--model-id", help="Catalog id of the local model to download (e.g. qwen2.5-7b-instruct)"),
    project: Optional[Path] = typer.Option(None, "-p", "--project", help="Project directory (default: cwd)"),
) -> None:
    """Download a recommended local .gguf model and set it as the LLM model."""
    entry, reason = _resolve_gguf_entry(model_id)
    if entry is None:
        console.print(f"[red]{reason}[/red]")
        raise typer.Exit(1)

    from yuu_clip.config import models_dir
    from yuu_clip.log import configure_logging

    proj_dir = _project_dir(project)
    configure_logging(proj_dir)
    dest = models_dir() / entry.gguf_filename

    if dest.exists():
        _set_llm_model_path(proj_dir, dest)
        console.print("[green]Already downloaded — set as the LLM model.[/green]")
        return

    console.print(f"Downloading {entry.display_name} (~{entry.size_gb} GB)...")
    try:
        _download_gguf(_gguf_url(entry), dest, entry.display_name)
    except Exception as exc:
        console.print(f"[red]Download failed: {exc}[/red]")
        raise typer.Exit(1)

    _set_llm_model_path(proj_dir, dest)
    console.print("[green]Done — the local model is ready for LLM scoring.[/green]")
