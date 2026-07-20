"""
SRT subtitle generation from TranscriptSegment rows.

Supports per-track files (player_voice, ingame_voicechat) and a merged file
with [Speaker] prefixes for multi-track clips.
"""
from __future__ import annotations

import glob
from pathlib import Path
from typing import Iterable, NamedTuple

from yuu_clip.db.models import latest_track_transcript


class SubLine(NamedTuple):
    start_ms: int
    end_ms: int
    text: str
    speaker: str = ""
    # Source TranscriptSegment id - carried only for the editable on-screen view;
    # ignored by the SRT/caption path.
    seg_id: int | None = None
    # Diarized speaker's subtitle colour ("#RRGGBB"), or "" for track-label-only
    # lines (no durable Speaker attached). Renders as a <font> tag in SRT output.
    color: str = ""
    # Durable Speaker id this line is attributed to (None when unattributed) and
    # whether a user hand-reassigned it - carried only for the editable view.
    speaker_id: int | None = None
    speaker_edited: bool = False
    # Per-word timings for word-highlight captions, in the SAME clip-relative ms
    # frame as start_ms/end_ms: a tuple of {"text", "start_ms", "end_ms"}. Empty
    # when the source segment has no word data (lines_to_ass falls back to a static
    # event for the line). Populated by collect_clip_subtitles; ignored by SRT.
    words: tuple = ()


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


def _segment_speaker(seg) -> str:
    """Display name for a segment's diarization speaker, or "" when unlabeled.

    Prefers the durable Speaker's name (user name or "Speaker N"); falls back to
    the prettified raw label for segments diarized before a Speaker was attached.
    """
    speaker = getattr(seg, "speaker", None)
    if getattr(seg, "speaker_id", None) is not None and speaker is not None:
        return speaker.display_name
    label = getattr(seg, "speaker_label", None)
    return _label_display(label) if label else ""


def _segment_speaker_color(seg) -> str:
    """Subtitle colour for a segment's durable Speaker, or "" when none is attached.

    Unlike _segment_speaker, there is no raw-label fallback - colour is a Speaker
    attribute, not something a diarization cluster label alone can carry.
    """
    speaker = getattr(seg, "speaker", None)
    if getattr(seg, "speaker_id", None) is not None and speaker is not None:
        return speaker.display_color
    return ""


def _labeled_lines(lines: list[SubLine], track_label: str) -> list[SubLine]:
    """Fill each line's speaker: the per-segment diarization speaker wins, else the
    track-label display. Rendered as a ``[Speaker]`` prefix by ``lines_to_srt``.

    Uses _replace so every other field (colour, per-word timings) survives - the
    word-highlight ASS path relies on ``words`` reaching the merged output.
    """
    track_speaker = _label_display(track_label)
    return [sub._replace(speaker=sub.speaker or track_speaker) for sub in lines]


def _merge_with_speakers(groups: dict[str, list[SubLine]]) -> list[SubLine]:
    """Flatten *groups* into a single list, tagging each line with its speaker label."""
    all_lines: list[SubLine] = []
    for label, lines in groups.items():
        all_lines.extend(_labeled_lines(lines, label))
    return all_lines


def lines_to_srt(lines: Iterable[SubLine]) -> str:
    """Render SubLine objects as an SRT-format string.

    A line with a speaker colour is wrapped in a <font color="#RRGGBB"> tag -
    libass (ffmpeg's `subtitles=` burn-in filter) and most SRT players support
    this basic HTML subset.
    """
    sorted_lines = sorted(lines, key=lambda sub: sub.start_ms)
    blocks = []
    for i, line in enumerate(sorted_lines, start=1):
        prefix = f"[{line.speaker}] " if line.speaker else ""
        body = f"{prefix}{line.text.strip()}"
        if line.color:
            body = f'<font color="{line.color}">{body}</font>'
        blocks.append(
            f"{i}\n"
            f"{_ms_to_srt_time(line.start_ms)} --> {_ms_to_srt_time(line.end_ms)}\n"
            f"{body}"
        )
    return "\n\n".join(blocks) + "\n" if blocks else ""


# --- Word-highlight (TikTok/CapCut-style) ASS rendering ----------------------
#
# Rendered as one ASS Dialogue event per word (not a \k karaoke fill): each event
# shows the whole on-screen chunk with only the active word recoloured, and stays
# up until the next word begins, so the chunk reads as one continuously-updating
# line whose highlight advances word by word. A line with no per-word data falls
# back to a single static event (today's whole-line caption, re-emitted as ASS).

_FALLBACK_HIGHLIGHT = "#ffd54f"  # gold, used when the base colour is already near-white


def _clip_relative_words(seg, clip_start: int, line_start: int, line_end: int) -> tuple:
    """Per-word timings for *seg* shifted into the clip-relative frame and clamped to
    the line's [line_start, line_end] window. Words fully outside the window are
    dropped; a boundary word is clamped. Empty tuple when the segment has no word data."""
    words: list[dict] = []
    for word in getattr(seg, "words", []):
        start = max(word["start_ms"] - clip_start, line_start)
        end = min(word["end_ms"] - clip_start, line_end)
        if end > start:
            words.append({"text": word["text"], "start_ms": start, "end_ms": end})
    return tuple(words)


def _parse_hex(hex_color: str) -> tuple[int, int, int]:
    digits = hex_color.lstrip("#")
    return int(digits[0:2], 16), int(digits[2:4], 16), int(digits[4:6], 16)


def _highlight_shade(base_hex: str) -> str:
    """A visibly distinct highlight colour derived from a speaker's base colour.

    Brightens the base halfway toward white so multi-speaker clips get distinct
    highlight tones for free. A base that is already near-white (the no-speaker
    default) would brighten to an invisible near-white, so it falls back to a fixed
    gold accent instead, keeping the highlight visible on every line."""
    red, green, blue = _parse_hex(base_hex)
    if min(red, green, blue) > 200:
        return _FALLBACK_HIGHLIGHT
    return f"#{(red + 255) // 2:02x}{(green + 255) // 2:02x}{(blue + 255) // 2:02x}"


def _ass_color(hex_color: str) -> str:
    """Convert #RRGGBB to an opaque ASS colour override (&HAABBGGRR, BGR order)."""
    red, green, blue = _parse_hex(hex_color)
    return f"&H00{blue:02X}{green:02X}{red:02X}"


def _ms_to_ass_time(ms: int) -> str:
    ms = max(0, ms)
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, frac = divmod(rem, 1_000)
    return f"{h:d}:{m:02d}:{s:02d}.{frac // 10:02d}"


def _ass_escape(text: str) -> str:
    """Neutralise the ASS override characters so caption text can't break the format."""
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", "\\N")


def _ass_header(play_res: tuple[int, int] | None) -> list[str]:
    lines = ["[Script Info]", "ScriptType: v4.00+", "WrapStyle: 2", "ScaledBorderAndShadow: yes"]
    if play_res:
        width, height = play_res
        lines += [f"PlayResX: {width}", f"PlayResY: {height}"]
        font_size = max(20, round(height * 0.05))
    else:
        font_size = 48
    lines += [
        "",
        "[V4+ Styles]",
        ("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
         "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
         "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"),
        (f"Style: Default,Arial,{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"
         "0,0,0,0,100,100,0,0,1,2,1,2,20,20,40,1"),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    return lines


def _dialogue(start_ms: int, end_ms: int, text: str) -> str:
    end_ms = max(end_ms, start_ms + 10)
    return f"Dialogue: 0,{_ms_to_ass_time(start_ms)},{_ms_to_ass_time(end_ms)},Default,,0,0,0,,{text}"


def _chunk_events(chunk: list[dict], prefix: str, base_ass: str, hl_ass: str) -> list[str]:
    """One Dialogue per word in *chunk*: the whole chunk is shown, the active word is
    recoloured, and the event runs until the next word begins (the last word runs to
    its own end) so the chunk stays on screen as the highlight advances."""
    events: list[str] = []
    for active_index, word in enumerate(chunk):
        rendered = []
        for index, chunk_word in enumerate(chunk):
            token = _ass_escape(chunk_word["text"].strip())
            if index == active_index:
                rendered.append(f"{{\\1c{hl_ass}}}{token}{{\\1c{base_ass}}}")
            else:
                rendered.append(token)
        text = f"{{\\1c{base_ass}}}{prefix}" + " ".join(rendered)
        start = word["start_ms"]
        end = chunk[active_index + 1]["start_ms"] if active_index + 1 < len(chunk) else word["end_ms"]
        events.append(_dialogue(start, end, text))
    return events


def _line_events(line: SubLine, chunk_size: int) -> list[str]:
    base_ass = _ass_color(line.color or "#FFFFFF")
    prefix = f"[{line.speaker}] " if line.speaker else ""
    words = list(line.words)
    if not words:
        text = f"{{\\1c{base_ass}}}{prefix}{_ass_escape(line.text.strip())}"
        return [_dialogue(line.start_ms, line.end_ms, text)]
    hl_ass = _ass_color(_highlight_shade(line.color or "#FFFFFF"))
    events: list[str] = []
    for start in range(0, len(words), chunk_size):
        events.extend(_chunk_events(words[start:start + chunk_size], prefix, base_ass, hl_ass))
    return events


def lines_to_ass(lines: Iterable[SubLine], chunk_size: int, play_res: tuple[int, int] | None = None) -> str:
    """Render SubLines as an ASS-format string with word-highlight captions.

    Font, size, and position are left to the ffmpeg force_style filter (which applies
    to ASS just as it does to SRT); this owns only the per-word timing and the
    per-speaker base/highlight colours. *chunk_size* words are shown at once.
    """
    chunk_size = max(1, chunk_size)
    body: list[str] = []
    for line in sorted(lines, key=lambda sub: sub.start_ms):
        body.extend(_line_events(line, chunk_size))
    return "\n".join(_ass_header(play_res) + body) + "\n"


def collect_clip_subtitles(clip) -> dict[str, list[SubLine]]:
    """
    Return subtitle lines per track label for a ClipCandidate.

    Timestamps are clip-relative (0 = start of the clip).
    Skips game_sounds tracks and any track with do_transcribe=False.
    Clip-level transcripts (``clip.clip_transcripts``) take priority over
    track-level transcripts; among duplicates the most recent wins.
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
            transcript = latest_track_transcript(track)
        else:
            continue
        lines: list[SubLine] = []
        for seg in transcript.segments:
            if seg.end_ms <= clip_start or seg.start_ms >= clip_end:
                continue
            start = max(seg.start_ms, clip_start) - clip_start
            end   = min(seg.end_ms,   clip_end)   - clip_start
            if end > start:
                lines.append(SubLine(
                    start, end, seg.text, _segment_speaker(seg), getattr(seg, "id", None),
                    _segment_speaker_color(seg),
                    speaker_id=getattr(seg, "speaker_id", None),
                    speaker_edited=bool(getattr(seg, "speaker_edited", False)),
                    words=_clip_relative_words(seg, clip_start, start, end),
                ))

        if lines:
            result[track.label] = lines

    return result


def export_srt_sidecars(clip, output_dir: Path, base_stem: str) -> list[Path]:
    """
    Write SRT sidecar file(s) for *clip* into *output_dir*.

    Single transcribed track  -> one ``{base_stem}.srt``
    Multiple tracks           -> one ``{base_stem}.{label}.srt`` per track
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
            labeled = _labeled_lines(lines, label)
            path = output_dir / f"{base_stem}.{label}.srt"
            path.write_text(lines_to_srt(labeled), encoding="utf-8")
            written.append(path)

        merged = output_dir / f"{base_stem}.srt"
        merged.write_text(lines_to_srt(_merge_with_speakers(groups)), encoding="utf-8")
        written.append(merged)

    return written


def refresh_export_sidecars(clip, exports_dir: Path, name_template: str) -> list[Path]:
    """Regenerate an already-exported clip's SRT caption sidecars from its current transcript.

    No-op when the clip has no existing sidecar in *exports_dir*: an upstream transcript
    edit should refresh captions the user already has, not create new export artifacts for
    a clip that was never exported. If the export filename template changed since this clip
    was exported, its sidecars were written under the old stem and won't be found. Shared by
    the CLI retranscribe command and the caption-edit/speaker-rename/reassign web routes.
    """
    from yuu_clip.export.naming import export_base_stem

    base = export_base_stem(clip, name_template)
    # Escape glob metacharacters in the stem (a user title/context name can survive
    # sanitization with [ ] * ?), so the "already exported?" probe matches literally
    # instead of interpreting the pattern and silently skipping a real refresh.
    if not any(exports_dir.glob(f"{glob.escape(base)}*.srt")):
        return []
    return export_srt_sidecars(clip, exports_dir, base)


def _video_transcript_groups(video) -> dict[str, list[SubLine]]:
    """Per-track SubLine groups for a whole recording's transcript, in the
    transcript's own native timing: absolute from the start of the video for a
    plain recording, or segment-relative (0 = segment start) for a split segment -
    same origin as TranscriptSegment.start_ms / end_ms in either case.

    Raises ValueError if there is no transcript data.
    """
    transcribed_tracks = [t for t in video.audio_tracks if t.do_transcribe and t.label != "game_sounds"]
    if not transcribed_tracks:
        raise ValueError("No transcribed tracks found for this recording")

    groups: dict[str, list[SubLine]] = {}
    for track in transcribed_tracks:
        if not track.transcripts:
            continue
        transcript = latest_track_transcript(track)
        lines = [
            SubLine(seg.start_ms, seg.end_ms, seg.text, _segment_speaker(seg))
            for seg in transcript.segments
        ]
        if lines:
            groups[track.label] = lines

    if not groups:
        raise ValueError("No transcript segments found for this recording")
    return groups


def _groups_to_srt(groups: dict[str, list[SubLine]]) -> str:
    """Single transcribed track -> plain SRT (no speaker prefix).
    Multiple tracks -> merged SRT with [Speaker] prefixes."""
    if len(groups) == 1:
        _, lines = next(iter(groups.items()))
        return lines_to_srt(lines)
    return lines_to_srt(_merge_with_speakers(groups))


def export_video_transcript_srt(video, output_path: Path) -> Path:
    """
    Write a full-video SRT file to *output_path* using all transcribed tracks.

    Timestamps are absolute from the start of the video (same origin as
    TranscriptSegment.start_ms / end_ms), so the file can be fed back in as
    --subtitle-source when re-importing the same recording.

    Returns *output_path*.  Raises ValueError if there is no transcript data.
    """
    output_path.write_text(_groups_to_srt(_video_transcript_groups(video)), encoding="utf-8")
    return output_path


def video_captions_srt(video) -> str:
    """SRT text for a whole recording's <track> captions element.

    Built from the same transcribed-track data as ``video_transcript_lines``
    (the "Full transcript" card's data source). A split segment's transcript is
    stored segment-relative (0 = segment start), but its player streams the full
    parent source file positioned via ``segment_start_s`` rather than a
    separately-trimmed stream (see ``setupRecordingPreview``) - so cue times are
    shifted by that same offset here to land on the right point in the player's
    actual timeline. A plain recording has no ``segment_start_s`` (offset 0), so
    this is a no-op for the common case.

    Raises ValueError if there is no transcript data.
    """
    offset_ms = int((video.segment_start_s or 0.0) * 1000)
    groups = _video_transcript_groups(video)
    if offset_ms:
        groups = {
            label: [line._replace(start_ms=line.start_ms + offset_ms, end_ms=line.end_ms + offset_ms) for line in lines]
            for label, lines in groups.items()
        }
    return _groups_to_srt(groups)


def merged_srt_lines(clip) -> list[SubLine]:
    """Return all subtitle lines for *clip* merged and sorted, with speaker prefixes."""
    return sorted(_merge_with_speakers(collect_clip_subtitles(clip)), key=lambda sub: sub.start_ms)


def _lines_to_view(sublines: Iterable[SubLine]) -> list[dict]:
    """JSON-friendly transcript lines for the on-screen transcript view.

    Unlike the SRT/caption path, this keeps ``speaker`` as the diarized display
    name only (or None) - no track-label fallback, since the view is not a
    caption file and a lone "Combined:" on every line would be noise.
    """
    return [
        {
            "start_ms": sub.start_ms,
            "end_ms": sub.end_ms,
            "speaker": sub.speaker or None,
            "speaker_id": sub.speaker_id,
            "speaker_edited": sub.speaker_edited,
            "color": sub.color or None,
            "text": sub.text.strip(),
            "seg_id": sub.seg_id,
        }
        for sub in sublines
    ]


def clip_transcript_lines(clip) -> list[dict]:
    """Per-segment transcript lines for a clip, clip-relative timing (0 = clip start)."""
    merged = sorted(
        (sub for subs in collect_clip_subtitles(clip).values() for sub in subs),
        key=lambda sub: sub.start_ms,
    )
    return _lines_to_view(merged)


def clip_context_transcript_lines(clip, video, pad_ms: int) -> list[dict]:
    """Transcript lines around *clip* for the export editor's boundary extension.

    Draws from the parent recording's transcript, clipped to the clip's current
    (offset-adjusted) window padded by *pad_ms* on each side, and flags each line
    ``in_clip`` when it overlaps that window. Times are recording-relative - for a
    split segment they are segment-relative (0 = segment start), matching
    ``clip.start_ms``; the caller adds ``segment_start_s`` to seek the parent player.
    """
    clip_start_ms = clip.start_ms + int((clip.start_offset or 0.0) * 1000)
    clip_end_ms   = clip.end_ms   + int((clip.end_offset   or 0.0) * 1000)
    window_start  = max(0, clip_start_ms - pad_ms)
    window_end    = clip_end_ms + pad_ms
    out: list[dict] = []
    for line in video_transcript_lines(video):
        if line["end_ms"] <= window_start or line["start_ms"] >= window_end:
            continue
        line["in_clip"] = line["start_ms"] < clip_end_ms and line["end_ms"] > clip_start_ms
        out.append(line)
    return out


def video_transcript_lines(video) -> list[dict]:
    """Per-segment transcript lines for a whole recording, absolute timing."""
    lines: list[SubLine] = []
    for track in video.audio_tracks:
        if not track.do_transcribe or track.label == "game_sounds" or not track.transcripts:
            continue
        transcript = latest_track_transcript(track)
        lines.extend(
            SubLine(
                seg.start_ms, seg.end_ms, seg.text, _segment_speaker(seg), getattr(seg, "id", None),
                _segment_speaker_color(seg),
                speaker_id=getattr(seg, "speaker_id", None),
                speaker_edited=bool(getattr(seg, "speaker_edited", False)),
            )
            for seg in transcript.segments
        )
    lines.sort(key=lambda sub: sub.start_ms)
    return _lines_to_view(lines)
