"""yuu_clip/segments/windower.py - the relax-mode hook on _silence_window (Stage 2).

relax mode keeps an otherwise-dropped low-speech window when its overlapping motion
peak is high (via a keep_if_visual callable). Every other mode passes no callable and
must leave the existing silence-drop behavior byte-identical - these tests lock that.
"""
from __future__ import annotations

from unittest.mock import MagicMock

from yuu_clip.segments.windower import _silence_window


def _seg(start_ms, end_ms, text="x"):
    s = MagicMock()
    s.start_ms = start_ms
    s.end_ms = end_ms
    s.text = text
    return s


# One hallucinated line stamped across 5 min (~0.06 cps) - dropped by the 0.2 floor.
def _low_speech_segs():
    return [_seg(0, 300_000, "Thanks for watching")]


def test_low_speech_window_dropped_without_keep_callable():
    # Byte-identical to the pre-Stage-2 drop behavior.
    assert _silence_window(_low_speech_segs(), 3000, 5000, 180_000, 0.2) == []


def _always(start_ms, end_ms):
    return True


def _never(start_ms, end_ms):
    return False


def test_relax_keeps_low_speech_window_with_high_motion():
    result = _silence_window(_low_speech_segs(), 3000, 5000, 180_000, 0.2, keep_if_visual=_always)
    assert len(result) == 1
    assert result[0][0] == 0 and result[0][1] == 300_000


def test_relax_adds_visual_tag_only_to_rescued_window():
    result = _silence_window(_low_speech_segs(), 3000, 5000, 180_000, 0.2, keep_if_visual=_always)
    assert "visual" in result[0][3]


def test_keep_callable_returning_false_still_drops():
    assert _silence_window(_low_speech_segs(), 3000, 5000, 180_000, 0.2, keep_if_visual=_never) == []


def test_dense_window_unaffected_by_keep_callable():
    # A window that passes the speech floor is never a "rescue" - no visual tag,
    # kept exactly as it would be without the callable.
    segs = [_seg(0, 10_000, "this is a normal spoken line with plenty of words in it")]
    without = _silence_window(segs, 3000, 5000, 180_000, 0.2)
    with_keep = _silence_window(segs, 3000, 5000, 180_000, 0.2, keep_if_visual=_always)
    assert len(without) == 1 and len(with_keep) == 1
    assert "visual" not in with_keep[0][3]
    # Same bounds and tags - the callable changed nothing for a dense window.
    assert without[0][0] == with_keep[0][0]
    assert without[0][1] == with_keep[0][1]
    assert without[0][3] == with_keep[0][3]


def test_keep_callable_receives_window_bounds():
    seen = []
    def keep(start_ms, end_ms):
        seen.append((start_ms, end_ms))
        return False
    _silence_window(_low_speech_segs(), 3000, 5000, 180_000, 0.2, keep_if_visual=keep)
    assert seen == [(0, 300_000)]
