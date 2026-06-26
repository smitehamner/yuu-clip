"""
Track overlap detection.

OBS can be misconfigured so that every track receives the full audio mix,
making player_voice / ingame_voicechat identical to the combined track.
Transcribing duplicates wastes time and produces confusing subtitles.

Detection: compare per-second RMS energy curves between specialized tracks
and combined tracks over the first SAMPLE_SECONDS seconds.  A Pearson
correlation above OVERLAP_THRESHOLD signals a duplicate.

Fallback: disable do_transcribe / do_score on all duplicated specialized
tracks and enable transcription on the first combined track instead.
"""
from __future__ import annotations

import logging
import math
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yuu_clip.db.models import AudioTrack

log = logging.getLogger(__name__)

SAMPLE_SECONDS = 30
OVERLAP_THRESHOLD = 0.97
TRANSCRIPT_OVERLAP_THRESHOLD = 0.75  # fraction of specialized words found in combined

_SPECIALIZED = frozenset({"player_voice", "ingame_voicechat", "voice_chat"})
_COMBINED    = frozenset({"combined"})


def _rms_curve(wav_path: str, max_seconds: int = SAMPLE_SECONDS) -> list[float]:
    """Per-second linear RMS energy for the first *max_seconds* of a WAV file."""
    import av  # transitive dep via faster-whisper; also used in scoring/energy.py

    values: list[float] = []
    buf: list[float] = []
    samples_per_sec: int | None = None

    with av.open(wav_path) as container:
        stream = container.streams.audio[0]
        samples_per_sec = stream.sample_rate

        for frame in container.decode(audio=0):
            plane = frame.planes[0]
            # faster-whisper extracts as fltp (float32 planar); fall back for pcm_s16le
            try:
                import array as _array
                raw = bytes(plane)
                if frame.format.name in ("fltp", "flt"):
                    n = len(raw) // 4
                    samples = _array.array("f", raw)
                    buf.extend(samples)
                else:
                    # assume s16le
                    n = len(raw) // 2
                    arr = _array.array("h", raw)
                    buf.extend(x / 32768.0 for x in arr)
            except Exception as exc:
                log.debug("RMS frame decode failed (skipping frame): %s", exc)
                continue

            while samples_per_sec and len(buf) >= samples_per_sec:
                window = buf[:samples_per_sec]
                buf = buf[samples_per_sec:]
                rms = math.sqrt(sum(x * x for x in window) / len(window))
                values.append(rms)
                if len(values) >= max_seconds:
                    return values

    return values


def _pearson(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    if n < 5:
        return 0.0
    a, b = a[:n], b[:n]
    ma = sum(a) / n
    mb = sum(b) / n
    num = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    da = math.sqrt(sum((x - ma) ** 2 for x in a))
    db = math.sqrt(sum((x - mb) ** 2 for x in b))
    if da == 0 or db == 0:
        return 1.0 if da == db else 0.0
    return num / (da * db)


def detect_and_apply_overlap_fallback(
    tracks: list[AudioTrack],
    threshold: float = OVERLAP_THRESHOLD,
) -> bool:
    """
    Inspect extracted WAVs.  If specialized tracks appear to duplicate a
    combined track, disable them and enable the first combined track for
    transcription instead.

    Returns True if overlap was detected and the fallback was applied.
    """
    combined    = [t for t in tracks if t.label in _COMBINED    and t.extracted_path and Path(t.extracted_path).exists()]
    specialized = [t for t in tracks if t.label in _SPECIALIZED and t.extracted_path and Path(t.extracted_path).exists()]

    if not combined or not specialized:
        return False

    combined_curves = {t.id: _rms_curve(t.extracted_path) for t in combined}

    overlapping: list[AudioTrack] = []
    for spec in specialized:
        spec_curve = _rms_curve(spec.extracted_path)
        for comb_curve in combined_curves.values():
            if _pearson(spec_curve, comb_curve) >= threshold:
                overlapping.append(spec)
                break

    if not overlapping:
        return False

    for t in overlapping:
        log.warning(
            "Track overlap: track %d [%s] duplicates combined audio — disabling transcription/scoring",
            t.id, t.label,
        )
        t.do_transcribe = False
        t.do_score = False

    first_combined = combined[0]
    first_combined.do_transcribe = True
    first_combined.do_score = True
    first_combined.relevance_weight = max(first_combined.relevance_weight, 1.5)
    log.info("Track overlap fallback: using combined track %d for transcription/scoring", first_combined.id)

    return True


def _word_set(text: str) -> set[str]:
    """Lowercase word tokens, punctuation stripped."""
    import re
    return set(re.findall(r"[a-z']+", text.lower()))


def detect_transcript_overlap(
    tracks: "list[AudioTrack]",
    session,
    threshold: float = TRANSCRIPT_OVERLAP_THRESHOLD,
) -> bool:
    """
    After transcription: if a specialized track's transcript content is largely
    contained in the combined track's transcript, disable it for scoring.

    Returns True if any tracks were suppressed.
    """
    from yuu_clip.db.models import Transcript

    def _latest_text(track) -> str:
        tx = (
            session.query(Transcript)
            .filter_by(audio_track_id=track.id)
            .order_by(Transcript.id.desc())
            .first()
        )
        return tx.full_text() if tx else ""

    combined    = [t for t in tracks if t.label in _COMBINED]
    specialized = [t for t in tracks if t.label in _SPECIALIZED and t.do_score]

    if not combined or not specialized:
        return False

    combined_words = _word_set(" ".join(_latest_text(t) for t in combined))
    if len(combined_words) < 20:
        return False  # not enough data

    changed = False
    for spec in specialized:
        spec_words = _word_set(_latest_text(spec))
        if not spec_words:
            continue
        overlap = len(spec_words & combined_words) / len(spec_words)
        if overlap >= threshold:
            log.warning(
                "Transcript overlap: track %d [%s] %.0f%% overlap with combined — disabling scoring",
                spec.id, spec.label, overlap * 100,
            )
            spec.do_score = False
            changed = True

    if changed:
        first_combined = combined[0]
        first_combined.do_transcribe = True
        first_combined.do_score = True
        first_combined.relevance_weight = max(first_combined.relevance_weight, 1.5)
        log.info("Transcript overlap fallback: using combined track %d for scoring", first_combined.id)

    return changed
