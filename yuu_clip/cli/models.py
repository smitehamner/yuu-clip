"""Tier-B model prefetch command - downloads one auto-fetched model on demand.

Invoked as a subprocess by POST /api/models/prefetch (routes/models.py), which
streams this command's output as SSE - one "download <model> so <feature>
works" pattern across the Tier-B models (packaging-strategy overhaul, Wave 4).
The local .gguf LLM model keeps its own existing path and isn't handled here.
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
    "face_detector": "the face-detector model (~230 KB) so Auto-frame on faces can run",
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
    elif slug == "face_detector":
        from yuu_clip.analyze.framing import prefetch_face_model
        prefetch_face_model()


@app.command("prefetch-model")
def prefetch_model_cmd(
    slug: str = typer.Argument(..., help="Which model to download: speaker, audio_event, embeddings, or face_detector"),
    project: Optional[Path] = typer.Option(None, "-p", "--project", help="Project directory (default: cwd)"),
) -> None:
    """Download one Tier-B model now, instead of waiting for its feature's first use."""
    if slug not in _PREFETCH_DESCRIPTIONS:
        console.print(f"[red]Unknown model slug '{slug}' - allowed: {sorted(_PREFETCH_DESCRIPTIONS)}[/red]")
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

    console.print("[green]Done - ready.[/green]")


@app.command("prefetch-whisper")
def prefetch_whisper_cmd(
    project: Optional[Path] = typer.Option(None, "-p", "--project", help="Project directory (default: cwd)"),
) -> None:
    """Download the configured speech-to-text model now, so the first analysis
    doesn't stall on a first-use download (first-run-friction Stage 6)."""
    from yuu_clip.config import Config
    from yuu_clip.log import configure_logging
    from yuu_clip.transcribe.transcriber import make_transcriber

    proj_dir = _project_dir(project)
    configure_logging(proj_dir)
    config = Config.load(proj_dir)

    console.print(f"Downloading the speech model ({config.whisper_model})...")
    try:
        make_transcriber(config).prefetch()
    except Exception as exc:
        console.print(f"[red]Download failed: {exc}[/red]")
        raise typer.Exit(1)

    console.print("[green]Done - the speech model is ready.[/green]")


# ── One-click local (.gguf) model download ──────────────────────────────────
# Server-owned download so the web UI (and, later, the post-launch background
# handoff) can fetch a recommended local LLM natively, instead of only linking
# to a HuggingFace download page. Spawned by POST /api/llm/gguf/download, which
# streams this command's stdout as SSE (routes/llm.py). Progress lines are plain
# text, one per line, so modelcatalog.js can append them as they arrive.

_DOWNLOAD_CHUNK_BYTES = 1 << 20  # 1 MiB reads
_PROGRESS_STEP_PCT = 2  # print progress at most every 2 percentage points


def _resolve_gguf_entry(model_id: str):
    """Return (entry, "") for a downloadable local .gguf model (text or vision),
    else (None, reason). Mirrors the route's allowlist so a manual CLI run is
    guarded the same way as the endpoint. Vision entries additionally carry an
    mmproj projector filename, fetched alongside the main weights."""
    from yuu_clip import model_catalog

    entry = model_catalog.model_by_id(model_id)
    if entry is None or not entry.recommended:
        return None, f"Unknown model id '{model_id}'."
    if model_catalog.BACKEND_LLAMACPP not in entry.backends or not entry.gguf_filename:
        return None, f"Model '{model_id}' has no downloadable .gguf file."
    return entry, ""


def _file_url(entry, filename: str) -> str:
    return f"{entry.gguf_url}/resolve/main/{filename}"


def _gguf_url(entry) -> str:
    return _file_url(entry, entry.gguf_filename)


def _download_targets(entry) -> list[tuple[str, str]]:
    """[(filename, config_field)] to fetch for *entry* - the main weights, then
    the vision projector for a vision entry. A vision projector that lives in the
    same file as the weights (mmproj_filename == gguf_filename) is not repeated,
    so the caller downloads it once and points both paths at the one file."""
    if "vision" in entry.kinds:
        targets = [(entry.gguf_filename, "llm_vision_model_path")]
        if entry.mmproj_filename:
            targets.append((entry.mmproj_filename, "llm_mmproj_path"))
        return targets
    return [(entry.gguf_filename, "llm_model_path")]


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


def _set_llm_paths(project_dir: Path, paths: dict[str, Path]) -> None:
    from yuu_clip.config import Config

    config = Config.load(project_dir)
    for field, value in paths.items():
        setattr(config, field, str(value))
    config.save_project(project_dir)


def _set_llm_model_path(project_dir: Path, model_path: Path) -> None:
    _set_llm_paths(project_dir, {"llm_model_path": model_path})


def _download_entry(entry, project_dir: Path) -> None:
    """Fetch every file *entry* needs (weights, plus the vision projector for a
    vision entry) into the models dir, then point config at them. Each distinct
    filename is fetched at most once, so a shared projector isn't downloaded
    twice."""
    from yuu_clip.config import models_dir

    fetched: dict[str, Path] = {}
    paths: dict[str, Path] = {}
    for filename, field in _download_targets(entry):
        dest = models_dir() / filename
        if filename not in fetched:
            if dest.exists():
                console.print(f"{filename} is already downloaded.")
            else:
                console.print(f"Downloading {entry.display_name} - {filename}...")
                _download_gguf(_file_url(entry, filename), dest, entry.display_name)
            fetched[filename] = dest
        paths[field] = fetched[filename]
    _set_llm_paths(project_dir, paths)


@app.command("download-gguf")
def download_gguf_cmd(
    model_id: str = typer.Option(..., "--model-id", help="Catalog id of the local model to download (e.g. qwen2.5-7b-instruct)"),
    project: Optional[Path] = typer.Option(None, "-p", "--project", help="Project directory (default: cwd)"),
) -> None:
    """Download a recommended local .gguf model and set it as the LLM model. For
    a vision model, both the weights and the mmproj projector are fetched and
    both the model and vision-projector paths are set."""
    entry, reason = _resolve_gguf_entry(model_id)
    if entry is None:
        console.print(f"[red]{reason}[/red]")
        raise typer.Exit(1)

    from yuu_clip.log import configure_logging

    proj_dir = _project_dir(project)
    configure_logging(proj_dir)

    try:
        _download_entry(entry, proj_dir)
    except Exception as exc:
        console.print(f"[red]Download failed: {exc}[/red]")
        raise typer.Exit(1)

    console.print("[green]Done - the local model is ready for LLM scoring.[/green]")
