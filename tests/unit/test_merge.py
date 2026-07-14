"""yuu_clip/segments/merge.py - merge_candidates dedup + cap (Stage 2).

The "don't drown the talk-heavy core" guard: a visual candidate overlapping a
transcript candidate by more than visual_dedup_overlap is dropped (transcript
wins), and visual-only candidates are hard-capped per recording keeping the
highest motion peak first, with deterministic output ordering. Returns
(transcript_cands, kept_visual) so the caller appends the two without recovering
the visual set from a tag.
"""
from __future__ import annotations

from types import SimpleNamespace

from yuu_clip.config import Config
from yuu_clip.segments.merge import merge_candidates


def _cand(start_ms, end_ms, peak=0.0):
    return SimpleNamespace(start_ms=start_ms, end_ms=end_ms, visual_peak=peak)


def test_visual_fully_inside_transcript_is_dropped():
    transcript = [_cand(0, 60_000)]
    visual = [_cand(10_000, 25_000, peak=40.0)]
    transcript_out, kept = merge_candidates(transcript, visual, Config())
    assert transcript_out == transcript
    assert kept == []  # visual deduped out, transcript wins


def test_overlap_above_threshold_dropped():
    cfg = Config()
    cfg.visual_dedup_overlap = 0.5
    transcript = [_cand(0, 20_000)]
    # visual 10_000-30_000 (20 s); 10 s overlaps transcript -> 0.5 covered. Need > 0.5
    # to drop, so push overlap to 12 s / 20 s = 0.6.
    visual = [_cand(8_000, 28_000, peak=40.0)]  # overlap 8_000-20_000 = 12 s of 20 s
    _transcript_out, kept = merge_candidates(transcript, visual, cfg)
    assert visual[0] not in kept


def test_overlap_below_threshold_keeps_both():
    cfg = Config()
    cfg.visual_dedup_overlap = 0.5
    transcript = [_cand(0, 20_000)]
    # visual 15_000-45_000 (30 s); overlap 15_000-20_000 = 5 s / 30 s = 0.17 <= 0.5
    visual = [_cand(15_000, 45_000, peak=40.0)]
    transcript_out, kept = merge_candidates(transcript, visual, cfg)
    assert transcript[0] in transcript_out
    assert visual[0] in kept


def test_no_transcript_overlap_keeps_visual():
    transcript = [_cand(0, 20_000)]
    visual = [_cand(100_000, 130_000, peak=40.0)]
    _transcript_out, kept = merge_candidates(transcript, visual, Config())
    assert visual[0] in kept


def test_cap_keeps_highest_peak_visual_only():
    cfg = Config()
    cfg.visual_candidate_cap = 3
    transcript = []
    # 5 non-overlapping visual candidates with distinct peaks; cap keeps top 3 peaks.
    visual = [_cand(i * 40_000, i * 40_000 + 20_000, peak=float(i)) for i in range(5)]
    _transcript_out, kept = merge_candidates(transcript, visual, cfg)
    kept_peaks = sorted(c.visual_peak for c in kept)
    assert kept_peaks == [2.0, 3.0, 4.0]  # the three highest peaks survive


def test_deterministic_ordering_by_start_ms():
    cfg = Config()
    cfg.visual_candidate_cap = 30
    transcript = [_cand(0, 20_000)]
    visual = [
        _cand(200_000, 220_000, peak=5.0),
        _cand(100_000, 120_000, peak=9.0),
        _cand(300_000, 320_000, peak=1.0),
    ]
    _transcript_out, kept = merge_candidates(transcript, visual, cfg)
    assert [c.start_ms for c in kept] == [100_000, 200_000, 300_000]


def test_empty_visual_returns_transcript_unchanged():
    transcript = [_cand(0, 20_000), _cand(30_000, 50_000)]
    transcript_out, kept = merge_candidates(transcript, [], Config())
    assert transcript_out == transcript
    assert kept == []
