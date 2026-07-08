"""
Playwright UI tests - Split Editor pass (H6-1, H6-2, M6-1/2/3/4, L6-1/2/3/4).

Covers the marker × remove affordance, the overlay legend, the re-analyze
consequence confirm + danger styling, the Back dirty guard, disabled Confirm
with no split points, invalid boundary-time feedback, shared instruction copy,
and the re-analyze parameter builder that reuses the original run's settings.

All tests are non-destructive: no split is ever confirmed against the live
server - confirms are cancelled and editors closed via the discard path.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

import re

import pytest
from conftest import select_video_with_clips, skip_no_server
from playwright.sync_api import Page, expect


def _open_split_editor(page: Page) -> None:
    select_video_with_clips(page)
    page.click(".vid-actions button:has-text('Additional Actions')")
    page.wait_for_selector("#actions-modal.visible", timeout=2000)
    page.click("#actions-modal .action-row:has-text('Split Recording')")
    expect(page.locator("#split-editor-panel")).to_be_visible(timeout=3000)


def _place_split_point(page: Page) -> None:
    bar = page.locator("#split-timeline-bar")
    box = bar.bounding_box()
    bar.click(position={"x": box["width"] / 2, "y": box["height"] / 2})
    expect(page.locator("#split-markers-layer .split-marker")).to_have_count(1)


@pytest.fixture
def split_editor(page: Page):
    _open_split_editor(page)
    yield page
    # closeSplitEditor (not requestClose...) bypasses the dirty guard so
    # teardown never hangs on a confirm modal left open by a failing test.
    page.evaluate("_confirmCancel(); closeSplitEditor()")


@skip_no_server
class TestSplitMarkers:
    def test_confirm_disabled_until_a_point_is_placed(self, split_editor: Page):
        # L6-2 - "Split only" with zero points is a no-op; Confirm must be
        # disabled until at least one split point exists.
        confirm = split_editor.locator("#btn-split-confirm")
        expect(confirm).to_be_disabled()
        _place_split_point(split_editor)
        expect(confirm).to_be_enabled()

    def test_marker_x_button_removes_the_point(self, split_editor: Page):
        # H6-1 - each marker carries an explicit × remove button (hover-visible).
        _place_split_point(split_editor)
        marker = split_editor.locator("#split-markers-layer .split-marker")
        marker.hover()
        marker.locator(".split-marker-x").click()
        expect(split_editor.locator("#split-markers-layer .split-marker")).to_have_count(0)
        expect(split_editor.locator("#btn-split-confirm")).to_be_disabled()

    def test_clicking_a_marker_body_keeps_it(self, split_editor: Page):
        # H6-1 - click-on-marker seeks the preview; it must NOT remove the
        # marker (removal is only via the × button).
        _place_split_point(split_editor)
        marker = split_editor.locator("#split-markers-layer .split-marker")
        marker.click(position={"x": 5, "y": 30})
        expect(split_editor.locator("#split-markers-layer .split-marker")).to_have_count(1)

    def test_back_button_guards_placed_points(self, split_editor: Page):
        # M6-3 - Back gets the same dirty guard as sidebar navigation.
        _place_split_point(split_editor)
        split_editor.click("#panelnav-breadcrumb button:has-text('Back')")
        expect(split_editor.locator("#confirm-modal")).to_be_visible()
        split_editor.click("#confirm-cancel-btn")
        expect(split_editor.locator("#split-editor-panel")).to_be_visible()
        expect(split_editor.locator("#split-markers-layer .split-marker")).to_have_count(1)


@skip_no_server
class TestSplitActions:
    def test_radio_group_has_accessible_name(self, split_editor: Page):
        # L6-4
        options = split_editor.locator("#split-action-options")
        expect(options).to_have_attribute("role", "radiogroup")
        assert options.get_attribute("aria-label")

    def test_reanalyze_selection_styles_confirm_as_danger(self, split_editor: Page):
        # M6-2 - destructive choice gets destructive treatment.
        confirm = split_editor.locator("#btn-split-confirm")
        expect(confirm).not_to_have_class(re.compile(r"\bdanger\b"))
        split_editor.check("input[name='split-action'][value='reanalyze-all']")
        expect(confirm).to_have_class(re.compile(r"\bdanger\b"))
        split_editor.check("input[name='split-action'][value='partition']")
        expect(confirm).not_to_have_class(re.compile(r"\bdanger\b"))

    def test_reanalyze_confirm_states_consequence_and_cancel_is_safe(self, split_editor: Page):
        # M6-2 - confirming a re-analyze option first shows the concrete
        # consequence; cancelling fires no split/clear/analyze request.
        _place_split_point(split_editor)
        split_editor.check("input[name='split-action'][value='reanalyze-all']")
        requests: list = []
        split_editor.on("request", lambda r: requests.append(r.url))
        split_editor.click("#btn-split-confirm")
        expect(split_editor.locator("#confirm-modal")).to_be_visible()
        expect(split_editor.locator("#confirm-body")).to_contain_text("clip")
        expect(split_editor.locator("#confirm-body")).to_contain_text("segment")
        split_editor.click("#confirm-cancel-btn")
        expect(split_editor.locator("#confirm-modal")).not_to_be_visible()
        assert not any(
            "/split" in u or "/clips/clear" in u or "/analyze/start" in u for u in requests
        )

    def test_action_resets_to_partition_on_reopen(self, split_editor: Page):
        # M6-2 - a previously chosen destructive option must not silently
        # persist into the next editing session.
        split_editor.check("input[name='split-action'][value='reanalyze-all']")
        split_editor.evaluate("closeSplitEditor()")
        _open_split_editor(split_editor)
        expect(
            split_editor.locator("input[name='split-action'][value='partition']")
        ).to_be_checked()
        expect(split_editor.locator("#btn-split-confirm")).not_to_have_class(
            re.compile(r"\bdanger\b")
        )


@skip_no_server
class TestSplitLegendAndLayout:
    def test_overlay_legend_is_visible(self, split_editor: Page):
        # M6-1 - the five overlay vocabularies are named without hovering.
        legend = split_editor.locator("#split-legend")
        expect(legend).to_be_visible()
        for term in ("Split point", "Suggested split", "Scene cut", "Existing clip", "Segment"):
            expect(legend).to_contain_text(term)

    def test_timeline_bars_do_not_flex_shrink(self, page: Page):
        # M6-4 - the timeline must keep its height as the segment list grows.
        # For the main editor the flex child is now the zoom scroll wrapper
        # (the bar lives inside it); the pre-split bar is still a direct child.
        for element_id in ("split-timeline-scroll", "pre-split-timeline-bar"):
            shrink = page.evaluate(
                f"getComputedStyle(document.getElementById('{element_id}')).flexShrink"
            )
            assert shrink == "0", f"#{element_id} flex-shrink is {shrink}, expected 0"

    def test_instruction_copy_shared_between_editors(self, page: Page):
        # L6-3 + H6-1 - one base string in both editors, teaching the × remove
        # affordance instead of the wrong "click a marker to remove it".
        pre_text = page.locator("#pre-split-instructions").text_content()
        main_text = page.locator("#split-instructions").text_content()
        assert pre_text and main_text.startswith(pre_text)
        assert "×" in pre_text
        assert "Click a marker to remove" not in main_text


@skip_no_server
class TestSplitTimelineZoom:
    def test_zoom_in_widens_timeline_and_makes_it_scrollable(self, split_editor: Page):
        bar = split_editor.locator("#split-timeline-bar")
        base_width = bar.bounding_box()["width"]
        expect(split_editor.locator("#split-zoom-out")).to_be_disabled()  # at Fit

        split_editor.click("#split-zoom-in")
        split_editor.click("#split-zoom-in")

        assert bar.bounding_box()["width"] > base_width + 1
        scroll_w = split_editor.evaluate(
            "document.getElementById('split-timeline-scroll').scrollWidth"
        )
        client_w = split_editor.evaluate(
            "document.getElementById('split-timeline-scroll').clientWidth"
        )
        assert scroll_w > client_w
        expect(split_editor.locator("#split-zoom-label")).not_to_have_text("1×")

    def test_fit_resets_zoom(self, split_editor: Page):
        bar = split_editor.locator("#split-timeline-bar")
        base_width = bar.bounding_box()["width"]
        split_editor.click("#split-zoom-in")
        split_editor.click("#split-zoom-fit")
        expect(split_editor.locator("#split-zoom-label")).to_have_text("1×")
        assert abs(bar.bounding_box()["width"] - base_width) < 2

    def test_zoom_resets_when_reopening_editor(self, split_editor: Page):
        split_editor.click("#split-zoom-in")
        split_editor.evaluate("closeSplitEditor()")
        _open_split_editor(split_editor)
        expect(split_editor.locator("#split-zoom-label")).to_have_text("1×")


@skip_no_server
class TestSplitTimeEdits:
    def test_invalid_time_entry_shows_error_and_reverts(self, split_editor: Page):
        # L6-1 - a bad h:mm:ss entry explains itself instead of silently
        # snapping back.
        _place_split_point(split_editor)
        end_input = split_editor.locator(
            "#split-segment-list input[aria-label='Segment 1 end time']"
        )
        original = end_input.input_value()
        end_input.fill("garbage")
        end_input.blur()
        expect(split_editor.locator(".toast.error").last).to_contain_text("h:mm:ss")
        expect(
            split_editor.locator("#split-segment-list input[aria-label='Segment 1 end time']")
        ).to_have_value(original)

    def test_out_of_range_time_shows_error(self, split_editor: Page):
        _place_split_point(split_editor)
        end_input = split_editor.locator(
            "#split-segment-list input[aria-label='Segment 1 end time']"
        )
        end_input.fill("99:59:59")
        end_input.blur()
        expect(split_editor.locator(".toast.error").last).to_contain_text("between")


@skip_no_server
class TestReanalyzeParams:
    """H6-2 - split re-analysis reuses the original run's recorded parameters
    (Video.analyze_run.settings) and falls back to config defaults."""

    _RECORDED = {
        "analyze_run": {
            "settings": {
                "model": "large-v3",
                "track_layout": "game-2track",
                "energy_mode": "full",
                "scene_mode": "full",
                "speaker_labels": True,
                "contexts": ["ctx-old"],
            }
        },
        "context_names": [],
    }

    def test_uses_original_run_settings(self, page: Page):
        params = page.evaluate("(v) => _reanalyzeParams(v)", self._RECORDED)
        assert params["model"] == "large-v3"
        assert params["profile"] == "game-2track"
        assert params["energy_mode"] == "full"
        assert params["scene_mode"] == "full"
        assert params["diarize"] is True
        assert params["context_names"] == ["ctx-old"]

    def test_current_context_assignment_wins_over_recorded(self, page: Page):
        video = dict(self._RECORDED, context_names=["ctx-current"])
        params = page.evaluate("(v) => _reanalyzeParams(v)", video)
        assert params["context_names"] == ["ctx-current"]

    def test_default_track_layout_maps_to_null_profile(self, page: Page):
        video = {
            "analyze_run": {"settings": {"model": "medium", "track_layout": "default"}},
            "context_names": [],
        }
        params = page.evaluate("(v) => _reanalyzeParams(v)", video)
        assert params["profile"] is None

    def test_falls_back_to_config_defaults_without_a_recorded_run(self, page: Page):
        cfg = page.evaluate("() => fetch('/api/config').then(r => r.json())")
        params = page.evaluate("(v) => _reanalyzeParams(v)", None)
        assert params["model"] == (cfg.get("whisper_model") or "medium")
        assert params["energy_mode"] == (cfg.get("energy_mode") or "fast")
        assert params["scene_mode"] == (cfg.get("scene_detection_mode") or "fast")
        assert params["diarize"] is None
        assert params["profile"] is None
