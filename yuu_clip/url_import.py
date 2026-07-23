"""Import from URL (roadmap plan 08) - Twitch VOD / YouTube download support.

Public YouTube and Twitch links only in v1: no cookies/browser-profile auth for
sub-only or otherwise gated content (a plain "requires a login" error instead).
Quality is capped at 1080p. yt-dlp (Unlicense) does the actual extraction and
downloading; this module wraps it with validation, plain-English error mapping,
filename sanitization, disk-space checks, and the metadata sidecar that hands
source information off to the analyze pipeline (see pipeline/ingest.py::
_apply_source_metadata).
"""
from __future__ import annotations

import glob
import json
import re
import shutil
import unicodedata
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from yuu_clip.log import get_logger

_log = get_logger(__name__)

ALLOWED_HOSTS = frozenset({
    "youtube.com", "www.youtube.com", "youtu.be",
    "twitch.tv", "www.twitch.tv",
})

_YOUTUBE_WATCH_HOSTS = frozenset({"youtube.com", "www.youtube.com"})
_YOUTUBE_SHORT_HOST = "youtu.be"
_TWITCH_HOSTS = frozenset({"twitch.tv", "www.twitch.tv"})

# What survives query-param stripping: a video id (watch pages only) and a
# timestamp. Everything else - list/index/pp/si on YouTube, tt_medium/tt_content
# and the rest on Twitch - is playlist/tracking cruft that yt-dlp doesn't need
# and that can trip a 403 on download (see UX-BUG-HUNT-2026-07-19 B5).
_YOUTUBE_WATCH_KEEP_PARAMS = frozenset({"v", "t", "start"})
_YOUTUBE_SHORT_KEEP_PARAMS = frozenset({"t", "start"})
_TWITCH_KEEP_PARAMS = frozenset({"t"})

# Videos over 1080p are skipped - smaller files, faster downloads, and no need
# for a quality picker in v1 (see roadmap plan 08's locked decisions).
FORMAT_SELECTOR = "bestvideo[height<=1080]+bestaudio/best[height<=1080]"

_MAX_FILENAME_STEM_LEN = 150
_DISK_SPACE_SAFETY_FACTOR = 1.2

_SIDECAR_SUFFIX = ".yuuclip-source.json"


class ImportUrlError(ValueError):
    """A user-facing error - the message is safe to show as-is (no stack trace)."""


def _filter_query_params(query: str, keep: frozenset) -> str:
    if not query:
        return ""
    params = parse_qs(query, keep_blank_values=True)
    filtered = {key: values for key, values in params.items() if key in keep}
    return urlencode(filtered, doseq=True)


def normalize_import_url(url: str) -> str:
    """Clean up a pasted YouTube/Twitch link before validation.

    Self-heals the two common paste shapes that would otherwise be rejected or
    fail downstream (see UX-BUG-HUNT-2026-07-19 B5): a missing/`http://` scheme
    is upgraded to `https://`, and playlist/tracking query params
    (`list`/`index`/`pp`/`si` on YouTube, `tt_medium`/etc. on Twitch) are
    stripped while a video id and/or timestamp are kept. A URL whose host
    still doesn't resolve to a supported site is returned with only the
    scheme fixed, so validate_import_url can reject it with its normal
    "unsupported" message.
    """
    candidate = (url or "").strip()
    if not candidate:
        return candidate

    if candidate.startswith("http://"):
        candidate = "https://" + candidate[len("http://"):]
    elif "://" not in candidate:
        candidate = f"https://{candidate}"

    parsed = urlparse(candidate)
    host = parsed.netloc.lower()

    if host in _YOUTUBE_WATCH_HOSTS:
        keep_params = _YOUTUBE_WATCH_KEEP_PARAMS
    elif host == _YOUTUBE_SHORT_HOST:
        keep_params = _YOUTUBE_SHORT_KEEP_PARAMS
    elif host in _TWITCH_HOSTS:
        keep_params = _TWITCH_KEEP_PARAMS
    else:
        return urlunparse(parsed._replace(scheme="https"))

    cleaned_query = _filter_query_params(parsed.query, keep_params)
    return urlunparse(parsed._replace(scheme="https", netloc=host, query=cleaned_query))


def validate_import_url(url: str) -> None:
    """Raise ImportUrlError unless *url* is a plain https YouTube or Twitch link."""
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc.lower() not in ALLOWED_HOSTS:
        raise ImportUrlError("Only YouTube and Twitch links are supported")


_AUTH_ERROR_MARKERS = (
    "sign in", "log in", "login required", "private video", "members-only",
    "member-only", "age-restricted", "age restricted", "subscriber", "sub-only",
    "premieres in",
)


def _is_auth_error(message: str) -> bool:
    lowered = message.lower()
    return any(marker in lowered for marker in _AUTH_ERROR_MARKERS)


def _friendly_extractor_error(message: str) -> str:
    if _is_auth_error(message):
        return "This video requires a login - only public videos can be imported"
    return (
        "Could not read this link - it may be unavailable, or yt-dlp needs "
        "updating for a recent site change."
    )


def inspect_url(url: str, timeout_s: float = 30.0) -> dict:
    """Fetch metadata for *url* without downloading it.

    Raises ImportUrlError with a plain-English message for every failure mode:
    unsupported link, a still-live stream, an auth wall, a playlist/channel link,
    or a yt-dlp extractor error.
    """
    validate_import_url(url)
    import yt_dlp

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "socket_timeout": timeout_s,
        "noplaylist": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        # The friendly message collapses network / unavailable / site-change into
        # one line; keep the raw extractor error in the log so the real cause is
        # diagnosable (auth wall vs 404 vs yt-dlp needing an update).
        _log.warning("Inspect failed for %s: %s", url, e)
        raise ImportUrlError(_friendly_extractor_error(str(e))) from e

    if not info:
        raise ImportUrlError("Could not read this link.")
    if info.get("entries") is not None:
        raise ImportUrlError("Link a single video, not a playlist or channel")
    if info.get("is_live"):
        raise ImportUrlError("This stream is still live - import it after the VOD is available.")

    return {
        "title":                 info.get("title") or "(untitled)",
        "uploader":              info.get("uploader") or info.get("channel") or "",
        "duration_s":            info.get("duration") or 0,
        "upload_date":           _format_upload_date(info.get("upload_date")),
        "category":              _extract_category(info),
        "estimated_size_bytes":  info.get("filesize_approx") or info.get("filesize"),
        "video_id":              info.get("id") or "",
    }


def _extract_category(info: dict) -> str:
    categories = info.get("categories")
    if categories:
        return categories[0]
    return info.get("genre") or ""


def _format_upload_date(raw: Optional[str]) -> Optional[str]:
    """yt-dlp reports upload_date as YYYYMMDD; return ISO YYYY-MM-DD, or None."""
    if not raw or len(raw) != 8 or not raw.isdigit():
        return None
    return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"


_UNSAFE_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def sanitize_import_filename(title: str, video_id: str, existing_stems: Optional[set] = None) -> str:
    """Return a filesystem-safe filename stem (no extension) derived from *title*.

    Falls back to the video id when the title sanitizes to nothing (e.g. an
    all-emoji title). When *existing_stems* is given and the sanitized stem
    collides with one already present, the video id is appended for uniqueness.
    """
    normalized = unicodedata.normalize("NFKD", title or "")
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = _UNSAFE_FILENAME_CHARS.sub("", ascii_only).strip().strip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    stem = cleaned[:_MAX_FILENAME_STEM_LEN].strip() or f"video_{video_id}"
    if existing_stems and stem in existing_stems:
        stem = f"{stem}_{video_id}"
    return stem


def check_disk_space(target_dir: Path, estimated_size_bytes: Optional[int]) -> None:
    """Raise ImportUrlError if free space is under the download's estimated size
    plus a safety margin. A no-op when the size is unknown."""
    if not estimated_size_bytes:
        return
    free = shutil.disk_usage(target_dir).free
    required = estimated_size_bytes * _DISK_SPACE_SAFETY_FACTOR
    if free < required:
        raise ImportUrlError(
            f"Not enough free disk space - need about {_human_bytes(required)}, "
            f"only {_human_bytes(free)} free."
        )


def _human_bytes(n: Optional[float]) -> Optional[str]:
    if not n or n <= 0:
        return None
    size = float(n)
    for unit in ("B", "KiB", "MiB", "GiB"):
        if size < 1024 or unit == "GiB":
            return f"{int(size)}{unit}" if unit == "B" else f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TiB"  # pragma: no cover - effectively unreachable for real files


def _human_eta(seconds: Optional[float]) -> Optional[str]:
    if seconds is None or seconds < 0:
        return None
    seconds = int(seconds)
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def format_progress_line(hook_data: dict) -> str:
    """Build a stable, parseable progress line from a yt-dlp progress_hook dict.

    Printed to stdout by the CLI subprocess and streamed to the browser as SSE.
    parse_progress_line (below, for tests) and the JS regex in analyze.js both
    parse this exact format - keep all three in sync if it ever changes.
    """
    downloaded = hook_data.get("downloaded_bytes") or 0
    total = hook_data.get("total_bytes") or hook_data.get("total_bytes_estimate")
    speed = hook_data.get("speed")
    eta = hook_data.get("eta")

    if total:
        percent = downloaded / total * 100
        line = f"[Download] {percent:.1f}% of {_human_bytes(total)}"
    else:
        line = f"[Download] {_human_bytes(downloaded) or '0B'} downloaded (size unknown)"

    speed_human = _human_bytes(speed)
    if speed_human:
        line += f" at {speed_human}/s"

    eta_human = _human_eta(eta)
    if eta_human:
        line += f", ETA {eta_human}"

    return line


_PROGRESS_KNOWN_SIZE_RE = re.compile(
    r"^\[Download\] ([\d.]+)% of (\S+)(?: at (\S+)/s)?(?:, ETA (\S+))?$"
)
_PROGRESS_UNKNOWN_SIZE_RE = re.compile(
    r"^\[Download\] (\S+) downloaded \(size unknown\)(?: at (\S+)/s)?(?:, ETA (\S+))?$"
)


def parse_progress_line(line: str) -> Optional[dict]:
    """Parse a line produced by format_progress_line back into its fields.

    Returns None for a line that doesn't match (e.g. plain log output). This is
    the reference implementation the JS-side regex in analyze.js mirrors.
    """
    m = _PROGRESS_KNOWN_SIZE_RE.match(line.strip())
    if m:
        return {
            "percent":    float(m.group(1)),
            "total_size": m.group(2),
            "speed":      m.group(3),
            "eta":        m.group(4),
        }
    m = _PROGRESS_UNKNOWN_SIZE_RE.match(line.strip())
    if m:
        return {
            "percent":    None,
            "downloaded": m.group(1),
            "speed":      m.group(2),
            "eta":        m.group(3),
        }
    return None


def source_sidecar_path(video_path: Path) -> Path:
    return video_path.with_name(video_path.name + _SIDECAR_SUFFIX)


def read_source_sidecar(video_path: Path) -> Optional[dict]:
    """Read the metadata sidecar next to *video_path*, or None if absent/invalid."""
    sidecar = source_sidecar_path(video_path)
    if not sidecar.exists():
        return None
    try:
        return json.loads(sidecar.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _write_source_sidecar(video_path: Path, url: str, info: dict) -> None:
    sidecar = source_sidecar_path(video_path)
    sidecar.write_text(json.dumps({
        "source_url":         url,
        "source_title":       info.get("title") or "",
        "source_uploader":    info.get("uploader") or "",
        "source_upload_date": info.get("upload_date"),
        "source_category":    info.get("category") or "",
    }, indent=2), encoding="utf-8")


def _find_downloaded_file(output_dir: Path, stem: str) -> Optional[Path]:
    """The media file yt-dlp wrote for *stem*. merge_output_format forces .mkv only
    when merging separate streams; the /best progressive fallback keeps the source
    container (e.g. .mp4), so the extension can't be assumed. Ignore the metadata
    sidecar and any leftover yt-dlp fragment."""
    candidates = [
        p for p in output_dir.glob(f"{glob.escape(stem)}.*")
        if p.is_file()
        and not p.name.endswith(_SIDECAR_SUFFIX)
        and p.suffix.lower() not in {".part", ".ytdl"}
    ]
    return candidates[0] if candidates else None


def download_video(url: str, output_dir: Path, *, progress_line_cb=print) -> Path:
    """Download *url* into *output_dir* via yt-dlp, printing parseable progress
    lines through *progress_line_cb*.

    Returns the downloaded file's path and writes a metadata sidecar alongside it
    (picked up by the analyze pipeline - see cli/_pipeline.py::_apply_source_metadata).

    Raises ImportUrlError for validation/live/auth/playlist failures (checked
    again right before downloading, in case something changed since Inspect) and
    RuntimeError for disk-space and yt-dlp download failures.
    """
    info = inspect_url(url)

    existing_stems = {p.stem for p in output_dir.glob("*") if p.is_file()}
    stem = sanitize_import_filename(info["title"], info["video_id"], existing_stems)

    check_disk_space(output_dir, info.get("estimated_size_bytes"))
    _log.info("Download starting: %s (video_id=%s) -> stem %s", url, info.get("video_id") or "?", stem)

    def _hook(d: dict) -> None:
        if d.get("status") == "downloading":
            progress_line_cb(format_progress_line(d))
        elif d.get("status") == "finished":
            progress_line_cb("[Download] Merging audio and video...")

    import yt_dlp
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": FORMAT_SELECTOR,
        "merge_output_format": "mkv",
        "outtmpl": str(output_dir / f"{stem}.%(ext)s"),
        "progress_hooks": [_hook],
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except yt_dlp.utils.DownloadError as e:
        _log.warning("Download failed for %s: %s", url, e)
        raise RuntimeError(_friendly_extractor_error(str(e))) from e

    downloaded_path = _find_downloaded_file(output_dir, stem)
    if downloaded_path is None:
        _log.error("Download for %s reported success but no %s.* media file was found", url, stem)
        raise RuntimeError("Download finished but the output file was not found")

    _write_source_sidecar(downloaded_path, url, info)
    _log.info("Download complete: %s (%.1f MB)", downloaded_path.name,
              downloaded_path.stat().st_size / (1024 * 1024))
    return downloaded_path
