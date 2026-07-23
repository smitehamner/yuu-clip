"""Forced alignment of edited caption text to audio (word-highlight captions).

When a user edits a caption segment's text, a fresh Whisper pass would transcribe
whatever it hears - not the exact words the user typed. Forced alignment instead
takes the *given* text as ground truth and finds each word's timing against the
segment's audio, so word-highlight captions track the edited wording precisely.

Model: torchaudio's WAV2VEC2_ASR_BASE_960H bundle - MIT-licensed (re-verified
2026-07-09 against the torchaudio model card), lazily fetched from torch hub on
first use, no new Python dependency (torch/torchaudio are already base deps).
Trained on LibriSpeech, so it is English-only; realignment is skipped (returns
None -> caller clears words_json -> static caption fallback) for any non-English
segment or any failure, never raising into the caption-edit route.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

_SAMPLE_RATE = 16_000

# Lazily loaded torchaudio pipeline model + label tuple, cached for the process so
# a batch of edits doesn't reload the ~360 MB model each time.
_model = None
_labels: Optional[tuple[str, ...]] = None


def _is_english(language: Optional[str]) -> bool:
    """Whether *language* is English. None/unknown is treated as non-English so an
    English acoustic model is never run against audio of an unconfirmed language."""
    return bool(language) and language.strip().lower().split("-")[0] == "en"


def _get_model():
    global _model, _labels
    if _model is None:
        import torchaudio

        bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        _model = bundle.get_model()
        _labels = bundle.get_labels()
    return _model, _labels


def _normalize_word(word: str, valid_chars: set[str]) -> str:
    """Uppercase and strip every character the acoustic model has no label for
    (punctuation, digits, whitespace); leaves letters and apostrophe."""
    return "".join(ch for ch in word.upper() if ch in valid_chars)


def _build_tokens(norm_words: list[str], char_to_index: dict[str, int], sep_index: int) -> list[int]:
    """Flatten normalized words into a CTC target token sequence, separating each
    word from the next with the model's word-boundary token."""
    tokens: list[int] = []
    for word_index, norm_word in enumerate(norm_words):
        if word_index > 0:
            tokens.append(sep_index)
        tokens.extend(char_to_index[ch] for ch in norm_word)
    return tokens


def _spans_to_words(
    words: list[str],
    norm_words: list[str],
    spans,
    samples_per_frame: float,
    start_ms: int,
    end_ms: Optional[int],
) -> list[dict]:
    """Map monotonic per-token alignment spans back onto the original display words.

    The token spans are in target order (one per character, plus one separator
    between words), so each word consumes len(norm_word) spans after skipping the
    separator that precedes it. Frame indices convert to track-absolute ms via the
    segment's start_ms offset, matching the words_json contract.
    """
    def frame_to_ms(frame: int) -> int:
        return start_ms + int(frame * samples_per_frame / _SAMPLE_RATE * 1000)

    result: list[dict] = []
    span_index = 0
    for word_index, norm_word in enumerate(norm_words):
        if word_index > 0:
            span_index += 1  # skip the separator span between words
        word_spans = spans[span_index: span_index + len(norm_word)]
        span_index += len(norm_word)
        word_start = frame_to_ms(word_spans[0].start)
        word_end = frame_to_ms(word_spans[-1].end)
        if end_ms is not None:
            word_end = min(word_end, end_ms)
        result.append({"text": words[word_index], "start_ms": word_start, "end_ms": word_end})
    return result


def _run_alignment(model, audio_path: Path, tokens: list[int]):
    """Run CTC forced alignment; returns (token_spans, samples_per_frame).

    token_spans has one span per target token in *tokens* (CTC guarantees a blank
    between adjacent identical labels, so merge_tokens yields exactly that count for
    a valid alignment); samples_per_frame converts a frame index back to audio time.
    """
    import torch
    import torchaudio
    import torchaudio.functional as F

    waveform, sample_rate = torchaudio.load(str(audio_path))
    if sample_rate != _SAMPLE_RATE:
        waveform = F.resample(waveform, sample_rate, _SAMPLE_RATE)
    if waveform.size(0) > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    with torch.inference_mode():
        emissions, _ = model(waveform)
        emissions = torch.log_softmax(emissions, dim=-1)

    targets = torch.tensor([tokens], dtype=torch.int32)
    aligned, scores = F.forced_align(emissions, targets, blank=0)
    token_spans = F.merge_tokens(aligned[0], scores[0].exp())
    samples_per_frame = waveform.size(1) / emissions.size(1)
    return token_spans, samples_per_frame


def realign_words(
    audio_path: Path,
    start_ms: int,
    end_ms: Optional[int],
    text: str,
    language: Optional[str],
) -> Optional[list[dict]]:
    """Forced-align *text* against the audio at *audio_path* (the segment's own span).

    Returns a list of {"text", "start_ms", "end_ms"} in track-absolute ms (offset by
    *start_ms*), or None when alignment can't be trusted - non-English audio, a word
    that has no model-alignable characters (digits/symbols only), or any failure.
    None tells the caller to clear words_json and fall back to a static caption line.
    """
    if not _is_english(language):
        return None
    words = text.split()
    if not words:
        return None
    try:
        model, labels = _get_model()
        char_to_index = {char: index for index, char in enumerate(labels)}
        separator = "|"
        valid_chars = set(labels) - {labels[0], separator}
        norm_words = [_normalize_word(word, valid_chars) for word in words]
        if any(norm_word == "" for norm_word in norm_words):
            log.debug("Word-highlight realign skipped for %r: a word has no alignable characters", text[:40])
            return None

        tokens = _build_tokens(norm_words, char_to_index, char_to_index[separator])
        spans, samples_per_frame = _run_alignment(model, audio_path, tokens)
        if len(spans) != len(tokens):
            log.warning(
                "Word-highlight realign failed for %r: got %d spans for %d tokens - falling back to static captions",
                text[:40], len(spans), len(tokens),
            )
            return None
        return _spans_to_words(words, norm_words, spans, samples_per_frame, start_ms, end_ms)
    except Exception as exc:
        log.warning("Forced alignment failed for %r: %s", text[:40], exc)
        return None


def realign_segment_words(seg) -> Optional[list[dict]]:
    """Re-align a transcript segment's (edited) text against its own audio span.

    Resolves the segment's source recording + audio stream, extracts just the
    segment's span to a temp WAV, and forced-aligns the current ``seg.text``.
    Returns per-word timings in track-absolute ms, or None (caller clears
    words_json) for a non-English segment, a missing source, or any failure. Never
    raises - a caption edit must still succeed even when realignment can't run.
    """
    import tempfile

    transcript = seg.transcript
    track = transcript.audio_track
    video = track.video if track is not None else None
    # Gate on language before the ffmpeg extract so non-English edits cost nothing.
    if video is None or not video.path or not _is_english(transcript.language):
        return None
    source = Path(video.path)
    if not source.exists():
        log.warning("Cannot realign segment %s: source recording missing (%s)", seg.id, source)
        return None

    from yuu_clip.analyze.extract import extract_audio_track

    # Transcript times are segment-relative, but video.path is the shared parent
    # media for a split segment - rebase the extraction window by the segment's
    # start offset. Returned word timings stay segment-relative (realign_words
    # anchors them to seg.start_ms).
    offset_s = video.segment_start_s or 0.0
    with tempfile.TemporaryDirectory() as tmp_dir:
        span_wav = Path(tmp_dir) / "segment.wav"
        try:
            extract_audio_track(
                source, track.stream_index, span_wav,
                start_s=offset_s + seg.start_ms / 1000.0,
                end_s=offset_s + seg.end_ms / 1000.0,
            )
        except Exception as exc:
            log.warning("Segment audio extraction failed for realign (seg %s): %s", seg.id, exc)
            return None
        return realign_words(span_wav, seg.start_ms, seg.end_ms, seg.text, transcript.language)
