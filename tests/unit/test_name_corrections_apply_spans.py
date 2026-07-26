"""web/routes/name_corrections.py::_apply_spans - pure span-replacement logic.

tests/integration/test_name_corrections.py exercises the scan/apply routes end to end,
but every one of its apply requests sends a single correction per segment. The
multi-correction-per-segment path (rightmost-first replacement so earlier offsets stay
valid, then reversing the results back to the caller's original order) has no direct
test - this file closes that gap with span math only, no DB/TestClient needed.
"""
from __future__ import annotations

from yuu_clip.web.routes.name_corrections import ApplyItem, _apply_spans


def _item(segment_id: int, token_start: int, token_end: int, token: str, replacement: str) -> ApplyItem:
    return ApplyItem(
        segment_id=segment_id, token_start=token_start, token_end=token_end,
        token=token, replacement=replacement,
    )


class TestApplySpansSingleItem:
    def test_applies_a_matching_span(self):
        new_text, results = _apply_spans("You were amazing", [_item(1, 0, 3, "You", "Yuu")])
        assert new_text == "Yuu were amazing"
        assert results == [{"segment_id": 1, "token_start": 0, "applied": True, "error": None}]

    def test_reports_drift_without_touching_text(self):
        new_text, results = _apply_spans("You were amazing", [_item(1, 0, 3, "Xxx", "Yuu")])
        assert new_text == "You were amazing"
        assert results == [{"segment_id": 1, "token_start": 0, "applied": False, "error": "text_changed"}]


class TestApplySpansMultipleItemsPerSegment:
    def test_two_replacements_of_equal_length_both_apply(self):
        # "You saw You" -> both "You" spans replaced with "Yuu"; the rightmost one is
        # applied first so the leftmost span's offsets are untouched by the shift.
        text = "You saw You"
        items = [_item(1, 0, 3, "You", "Yuu"), _item(1, 8, 11, "You", "Yuu")]
        new_text, results = _apply_spans(text, items)
        assert new_text == "Yuu saw Yuu"
        assert [r["applied"] for r in results] == [True, True]

    def test_replacement_of_different_length_does_not_corrupt_the_earlier_span(self):
        # A longer replacement earlier in the string would shift every later offset if
        # applied left-to-right; rightmost-first avoids that entirely.
        text = "You saw You there"
        items = [_item(1, 0, 3, "You", "Yuunosuke"), _item(1, 8, 11, "You", "Yuu")]
        new_text, results = _apply_spans(text, items)
        assert new_text == "Yuunosuke saw Yuu there"
        assert [r["applied"] for r in results] == [True, True]

    def test_results_are_returned_in_ascending_span_order_regardless_of_request_order(self):
        # Internally processed rightmost-first (descending token_start) so earlier
        # offsets stay valid; the public result list is reversed back to ascending
        # (left-to-right) order, independent of the order items arrived in the request.
        text = "Aaa bbb Ccc"
        items = [_item(1, 8, 11, "Ccc", "Zzz"), _item(1, 0, 3, "Aaa", "Www")]
        _, results = _apply_spans(text, items)
        assert [r["token_start"] for r in results] == [0, 8]

    def test_one_drifted_item_does_not_block_the_others_in_the_same_segment(self):
        text = "You saw You"
        items = [
            _item(1, 0, 3, "You", "Yuu"),           # valid
            _item(1, 8, 11, "Xxx", "Yuu"),           # stale span - text there is "You", not "Xxx"
        ]
        new_text, results = _apply_spans(text, items)
        assert new_text == "Yuu saw You"
        by_start = {r["token_start"]: r for r in results}
        assert by_start[0] == {"segment_id": 1, "token_start": 0, "applied": True, "error": None}
        assert by_start[8] == {"segment_id": 1, "token_start": 8, "applied": False, "error": "text_changed"}

    def test_a_later_replacement_drifting_a_span_it_does_not_touch_still_applies_both(self):
        # Applying the rightmost span first means an earlier span's [start:end] text is
        # never touched by a later (leftmost) replacement - both succeed even though the
        # rightmost replacement text is a different length than what it replaced.
        text = "Shaun met Shaun"
        items = [_item(1, 0, 5, "Shaun", "Shawn"), _item(1, 10, 15, "Shaun", "Sean")]
        new_text, results = _apply_spans(text, items)
        assert new_text == "Shawn met Sean"
        assert [r["applied"] for r in results] == [True, True]

    def test_three_items_in_one_segment_all_apply_in_rightmost_first_order(self):
        text = "A B A B A"
        items = [_item(1, 0, 1, "A", "X"), _item(1, 4, 5, "A", "X"), _item(1, 8, 9, "A", "X")]
        new_text, results = _apply_spans(text, items)
        assert new_text == "X B X B X"
        assert [r["applied"] for r in results] == [True, True, True]
