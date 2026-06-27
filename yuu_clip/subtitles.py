"""
SRT subtitle generation from TranscriptSegment rows.

Supports per-track files (player_voice, ingame_voicechat) and a merged file
with [Speaker] prefixes for multi-track clips.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, NamedTuple


class SubLine(NamedTuple):
    start_ms: int
    end_ms: int
    text: str
    speaker: str = ""


_LABEL_DISPLAY = {
    "player_voice":     "Player",
    "ingame_voicechat": "Voice Chat",
    "combined":         "Combined",
    "unlabeled":        "Unknown",
}


def _ms_to_srt_time(ms: int) -> str:
    ms = max(0, ms)
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, frac = divmod(rem, 1_000)
    return f"{h:02d}:{m:02d}:{s:02d},{frac:03d}"


def _label_display(label: str) -> str:
    return _LABEL_DISPLAY.get(label, label.replace("_", " ").title())


def lines_to_srt(lines: Iterable[SubLine]) -> str:
    """Render SubLine objects as an SRT-format string."""
    sorted_lines = sorted(lines, key=lambda l: l.start_ms)
    blocks = []
    for i, line in enumerate(sorted_lines, start=1):
        prefix = f"[{line.speaker}] " if line.speaker else ""
        blocks.append(
            f"{i}\n"
            f"{_ms_to_srt_time(line.start_ms)} --> {_ms_to_srt_time(line.end_ms)}\n"
            f"{prefix}{line.text.strip()}"
        )
    return "\n\n".join(blocks) + "\n" if blocks else ""


def collect_clip_subtitles(clip) -> dict[str, list[SubLine]]:
    """
    Return subtitle lines per track label for a ClipCandidate.

    Timestamps are clip-relative (0 = start of the clip).
    Skips game_sounds tracks and any track with do_transcribe=False.
    Uses the most recent Transcript when a track has been re-transcribed.
    """
    clip_start = max(0, clip.start_ms + int((clip.start_offset or 0.0) * 1000))
    clip_end   = clip.end_ms + int((clip.end_offset or 0.0) * 1000)
    result: dict[str, list[SubLine]] = {}

    clip_tx_by_track: dict = {}
    for tx in getattr(clip, "clip_transcripts", []):
        existing = clip_tx_by_track.get(tx.audio_track_id)
        if existing is None or tx.created_at > existing.created_at:
            clip_tx_by_track[tx.audio_track_id] = tx

    for track in clip.video.audio_tracks:
        if not track.do_transcribe or track.label == "game_sounds":
            continue

        if track.id in clip_tx_by_track:
            transcript = clip_tx_by_track[track.id]
        elif track.transcripts:
            transcript = max(track.transcripts, key=lambda t: t.created_at)
        else:
            continue
        lines: list[SubLine] = []
        for seg in transcript.segments:
            if seg.end_ms <= clip_start or seg.start_ms >= clip_end:
                continue
            start = max(seg.start_ms, clip_start) - clip_start
            end   = min(seg.end_ms,   clip_end)   - clip_start
            if end > start:
                lines.append(SubLine(start_ms=start, end_ms=end, text=seg.text))

        if lines:
            result[track.label] = lines

    return result


def export_srt_sidecars(clip, output_dir: Path, base_stem: str) -> list[Path]:
    """
    Write SRT sidecar file(s) for *clip* into *output_dir*.

    Single transcribed track  → one ``{base_stem}.srt``
    Multiple tracks           → one ``{base_stem}.{label}.srt`` per track
                                + a merged ``{base_stem}.srt`` with speaker prefixes

    Returns a list of written file paths (empty if no transcript data).
    """
    groups = collect_clip_subtitles(clip)
    if not groups:
        return []

    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    if len(groups) == 1:
        label, lines = next(iter(groups.items()))
        path = output_dir / f"{base_stem}.srt"
        path.write_text(lines_to_srt(lines), encoding="utf-8")
        written.append(path)
    else:
        for label, lines in groups.items():
            speaker = _label_display(label)
            labeled = [SubLine(l.start_ms, l.end_ms, l.text, speaker) for l in lines]
            path = output_dir / f"{base_stem}.{label}.srt"
            path.write_text(lines_to_srt(labeled), encoding="utf-8")
            written.append(path)

        all_lines: list[SubLine] = []
        for label, lines in groups.items():
            speaker = _label_display(label)
            all_lines.extend(SubLine(l.start_ms, l.end_ms, l.text, speaker) for l in lines)
        merged = output_dir / f"{base_stem}.srt"
        merged.write_text(lines_to_srt(all_lines), encoding="utf-8")
        written.append(merged)

    return written


def merged_srt_lines(clip) -> list[SubLine]:
    """Return all subtitle lines for *clip* merged and sorted, with speaker prefixes."""
    all_lines: list[SubLine] = []
    for label, lines in collect_clip_subtitles(clip).items():
        speaker = _label_display(label)
        all_lines.extend(SubLine(l.start_ms, l.end_ms, l.text, speaker) for l in lines)
    return sorted(all_lines, key=lambda l: l.start_ms)
