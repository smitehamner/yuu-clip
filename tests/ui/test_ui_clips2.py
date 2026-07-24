"""
Playwright UI tests - clip review workflow (continued from test_ui_clips.py):
export staleness, preset/format pickers, retranscribe refresh, keyboard nav,
tags, per-clip detail cards, playback options, and description chips.

Split out of test_ui_clips.py purely so pytest-xdist's --dist loadfile can
spread the ~108 clip tests across two workers instead of pinning them all to
one. Run against the live fixture server yuu-dev test-ui spawns. See tests/conftest.py for
shared helpers.
"""
from __future__ import annotations

import re

import pytest
from conftest import (
    LIVE_URL,
    _first_row,
    select_first_video_and_clip,
    select_video_with_clips,
    skip_no_server,
)
from playwright.sync_api import Page, expect

# ---------------------------------------------------------------------------
# Plan 02 (staleness) - "Stale - re-export to update" badge on an exported
# clip's file (export_stale), distinct from transcript_stale above (which is
# about scores/descriptions vs. the transcript, not the exported file).
# ---------------------------------------------------------------------------

@skip_no_server
class TestExportStaleBadge:
    def test_sidebar_shows_stale_badge_when_export_stale(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("""() => {
            AppState.clips[0].has_export = true;
            AppState.clips[0].export_stale = true;
            AppState.clips[0].export_stale_reasons = ['captions changed'];
            _renderClips();
        }""")
        pill = _first_row(page).locator(".export-pill")
        expect(pill).to_have_class("export-pill is-stale")
        expect(pill).to_contain_text("Stale")

    def test_sidebar_shows_exported_badge_when_not_stale(self, page: Page):
        select_video_with_clips(page)
        page.evaluate("""() => {
            AppState.clips[0].has_export = true;
            AppState.clips[0].export_stale = false;
            AppState.clips[0].export_stale_reasons = [];
            _renderClips();
        }""")
        pill = _first_row(page).locator(".export-pill")
        expect(pill).to_have_class("export-pill is-exported")
        expect(pill).not_to_contain_text("Stale")

    def test_detail_panel_shows_stale_note_with_reasons(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate("""() => {
            AppState.activeClipData.has_export = true;
            AppState.activeClipData.exported_at = new Date().toISOString();
            AppState.activeClipData.export_stale = true;
            AppState.activeClipData.export_stale_reasons = ['clip window changed'];
            renderDetail(AppState.activeClipData);
        }""")
        detail = page.locator("#detail")
        expect(detail).to_contain_text("Stale - re-export to update")
        expect(detail).to_contain_text("clip window changed")

    def test_detail_panel_no_stale_note_when_not_stale(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate("""() => {
            AppState.activeClipData.has_export = true;
            AppState.activeClipData.exported_at = new Date().toISOString();
            AppState.activeClipData.export_stale = false;
            AppState.activeClipData.export_stale_reasons = [];
            renderDetail(AppState.activeClipData);
        }""")
        expect(page.locator("#detail")).not_to_contain_text("re-export to update")


# ---------------------------------------------------------------------------
# Export presets - Plan 07 Stage 3 (preset picker + per-format export rows)
# ---------------------------------------------------------------------------

@skip_no_server
class TestExportPresetPicker:
    def _open_export_modal(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#detail .clip-badge", timeout=3000)
        page.click(".op-actions [data-act='export-clip']")
        page.wait_for_selector("#export-settings-modal.visible", timeout=3000)

    def test_picker_lists_original_quality_and_builtin_presets(self, page: Page):
        self._open_export_modal(page)
        page.wait_for_function(
            "document.querySelectorAll('#export-preset option').length > 1", timeout=3000,
        )
        values = page.eval_on_selector_all("#export-preset option", "els => els.map(e => e.value)")
        assert values[0] == ""
        assert "youtube-1080p" in values
        assert "discord-10mb" in values
        page.evaluate("closeExportModal()")

    def test_selecting_a_preset_disables_container_and_softsub(self, page: Page):
        self._open_export_modal(page)
        page.wait_for_function(
            "document.querySelectorAll('#export-preset option').length > 1", timeout=3000,
        )
        page.select_option("#export-preset", "youtube-1080p")
        expect(page.locator("#export-container")).to_be_disabled()
        expect(page.locator("#export-captions option[value='softsub']")).to_be_disabled()
        page.evaluate("closeExportModal()")

    def test_choosing_original_quality_re_enables_container(self, page: Page):
        self._open_export_modal(page)
        page.wait_for_function(
            "document.querySelectorAll('#export-preset option').length > 1", timeout=3000,
        )
        page.select_option("#export-preset", "youtube-1080p")
        page.select_option("#export-preset", "")
        expect(page.locator("#export-container")).to_be_enabled()
        expect(page.locator("#export-captions option[value='softsub']")).to_be_enabled()
        page.evaluate("closeExportModal()")


@skip_no_server
class TestExportWordHighlight:
    def _open_export_modal(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#detail .clip-badge", timeout=3000)
        page.click(".op-actions [data-act='export-clip']")
        page.wait_for_selector("#export-settings-modal.visible", timeout=3000)
        # The Caption style controls live in a collapsed <details>; open it so the
        # word-highlight checkbox and chunk-size input are interactable.
        page.evaluate("() => { document.getElementById('export-caption-style').open = true; }")

    def test_word_highlight_controls_prefill_from_config(self, page: Page):
        self._open_export_modal(page)
        cfg = page.evaluate("() => fetch('/api/config').then(r => r.json())")
        assert page.locator("#export-caption-word-highlight").is_checked() == bool(cfg["caption_word_highlight"])
        assert page.locator("#export-caption-chunk-size").input_value() == str(cfg["caption_word_chunk_size"])
        page.evaluate("closeExportModal()")

    def test_chunk_size_enabled_only_when_word_highlight_on(self, page: Page):
        self._open_export_modal(page)
        page.locator("#export-caption-word-highlight").uncheck()
        expect(page.locator("#export-caption-chunk-size")).to_be_disabled()
        page.locator("#export-caption-word-highlight").check()
        expect(page.locator("#export-caption-chunk-size")).to_be_enabled()
        page.evaluate("closeExportModal()")

    def test_word_highlight_params_sent_on_hardsub_export(self, page: Page):
        self._open_export_modal(page)
        page.select_option("#export-captions", "hardsub")
        page.locator("#export-caption-word-highlight").check()
        page.fill("#export-caption-chunk-size", "6")
        clip_id = page.evaluate("() => AppState.activeClipId")
        # Stub timing (confirmExport PATCHes it first) and the export SSE so nothing
        # mutates the live project or spawns a real ffmpeg run.
        page.route(f"**/api/clips/{clip_id}/timing",
                   lambda route: route.fulfill(status=200, content_type="application/json", body="{}"))
        page.route(f"**/api/clips/{clip_id}/export**",
                   lambda route: route.fulfill(status=200, content_type="text/event-stream", body="data: done\n\n"))
        with page.expect_request(f"**/api/clips/{clip_id}/export**") as req_info:
            page.click("#export-confirm-btn")
        url = req_info.value.url
        assert "word_highlight=true" in url
        assert "word_chunk_size=6" in url


@skip_no_server
class TestMultiFormatExportRows:
    """One row per clip_exports entry in the detail panel's Export section
    (synthetic AppState.activeClipData - the established renderDetail pattern
    above; no real exported files needed)."""

    def _clip_with_formats(self, clip_id, exports):
        return {
            "id": clip_id, "start_hms": "0:00", "duration_hms": "0:30",
            "status": "pending", "tags": [], "user_tags": [],
            "start_offset": 0, "end_offset": 0, "has_export": True,
            "exports": exports,
        }

    def _format_row(self, export_id, preset_name="default", size_bytes=1_048_576):
        return {
            "id": export_id, "preset_name": preset_name, "container": "mp4",
            "filename": f"clip_{preset_name}.mp4", "created_at": "2026-07-03T00:00:00+00:00",
            "size_bytes": size_bytes, "exists": True,
            "export_stale": False, "export_stale_reasons": [],
            "burn_subs": False, "embed_subs": False, "title_card": False,
        }

    def test_renders_one_row_per_format(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        clip = self._clip_with_formats(9301, [
            self._format_row(1, "default"),
            self._format_row(2, "youtube-1080p"),
        ])
        page.evaluate("(clip) => renderDetail(clip)", clip)
        rows = page.locator(".export-format-row")
        expect(rows).to_have_count(2)
        expect(rows.nth(0)).to_contain_text("Original quality")
        expect(rows.nth(1)).to_contain_text("YouTube 1080p")

    # test_per_row_delete_calls_the_row_delete_endpoint moved to
    # tests/js/clips/clipexport.test.js - _handleExportFormatAction('delete', ...)
    # confirms then DELETEs /api/clip-exports/<id> browserless. The row-render + the
    # regenerate-confirmation flow below stay in Playwright.

    def test_regenerate_asks_for_confirmation_before_re_exporting(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        clip = self._clip_with_formats(9303, [self._format_row(43, "discord-10mb")])
        page.evaluate("(clip) => { AppState.activeClipData = clip; renderDetail(clip); }", clip)
        export_requests: list = []
        page.on("request", lambda r: export_requests.append(r) if "/api/clips/9303/export" in r.url else None)
        page.click(".export-format-row[data-export-id='43'] [data-export-action='regenerate']")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-title")).to_contain_text("Regenerate")
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
        assert not export_requests


@skip_no_server
class TestRetranscribeRefresh:
    """Retranscribe refreshes the clip's excerpt
    shown in the detail panel. The subprocess is stubbed at the network layer, same
    pattern as test_ui_sse.py, so no real Whisper model runs. Caption-sidecar refresh
    itself is covered at the API layer in test_export.py::TestRefreshCaptionSidecars."""

    def test_retranscribe_refreshes_excerpt_in_detail_panel(self, page: Page):
        import json
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        clip_id = page.evaluate("() => AppState.activeClipId")
        original_clip = page.evaluate("() => AppState.activeClipData")
        refreshed_clip = {**original_clip, "transcript_excerpt": "freshly retranscribed text"}

        # startRetranscribe preflights whether the selected model is already
        # downloaded before starting - stub it cached so the job starts on the
        # first click instead of stopping at the download-confirm dialog.
        page.route(
            "**/api/whisper/model-cached**",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps({"cached": True}),
            ),
        )
        page.route(
            f"**/api/clips/{clip_id}/retranscribe**",
            lambda route: route.fulfill(
                status=200, content_type="text/event-stream",
                body='data: "Retranscribing"\n\ndata: "OK"\n\ndata: "__DONE__"\n\n',
            ),
        )
        page.route(
            f"**/api/clips/{clip_id}",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(refreshed_clip),
            ),
        )
        # selectClip() renders the detail only after Promise.all of the clip and
        # media_url fetches resolve; stub media_url too so the re-render can't be
        # gated on a slow real-server response under full-suite parallel load.
        page.route(
            f"**/api/clips/{clip_id}/media_url",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body=json.dumps({"url": None, "filename": None, "has_captions": False}),
            ),
        )

        # Real clicks: the clip's Additional Actions "Retranscribe" row opens the
        # modal, and its own #retranscribe-start-btn calls startRetranscribe().
        page.click(".clip-actions button:has-text('Additional Actions')")
        page.click("#actions-modal-body button:has-text('Retranscribe')")
        page.wait_for_selector("#retranscribe-modal.visible", timeout=2000)
        page.click("#retranscribe-start-btn")

        expect(page.locator("#detail")).to_contain_text("freshly retranscribed text", timeout=5000)

    def test_retranscribe_confirms_before_downloading_an_uncached_model(self, page: Page):
        """UX-M6: an uncached model must not start downloading as a side effect of
        clicking Retranscribe - it stops at a confirm first, matching the analyze
        flow's existing "still downloading" preflight."""
        import json
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        clip_id = page.evaluate("() => AppState.activeClipId")

        page.route(
            "**/api/whisper/model-cached**",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body=json.dumps({"cached": False}),
            ),
        )
        retranscribe_requests: list = []
        page.on(
            "request",
            lambda r: retranscribe_requests.append(r) if f"/api/clips/{clip_id}/retranscribe" in r.url else None,
        )

        page.click(".clip-actions button:has-text('Additional Actions')")
        page.click("#actions-modal-body button:has-text('Retranscribe')")
        page.wait_for_selector("#retranscribe-modal.visible", timeout=2000)
        page.click("#retranscribe-start-btn")

        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-title")).to_contain_text("Download speech model")
        assert not retranscribe_requests
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
        assert not retranscribe_requests


# ---------------------------------------------------------------------------
# Global keyboard shortcut guard (settings.js keydown handler)
# ---------------------------------------------------------------------------

@skip_no_server
class TestGlobalKeyboardGuard:
    """The global keydown handler must: close a modal on Escape even when focus
    sits on a button inside it (where every modal places focus on open), leave
    typing surfaces alone, and skip events a list item already handled."""

    def test_escape_closes_confirm_modal_when_cancel_button_focused(self, page: Page):
        select_video_with_clips(page)
        _first_row(page).locator(".clip-select-checkbox").check()
        delete_requests: list = []
        page.on("request", lambda r: delete_requests.append(r) if "bulk-delete" in r.url else None)
        page.click(".clip-bulk-actions button:has-text('Delete')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        # showConfirm moves focus onto the Cancel <button> ~50ms after opening -
        # exactly where a keyboard user is when they press Escape.
        page.wait_for_function(
            "document.activeElement === document.getElementById('confirm-cancel-btn')",
            timeout=2000,
        )
        page.keyboard.press("Escape")
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
        assert not delete_requests

    def test_handled_keydown_does_not_also_fire_global_shortcut(self, page: Page):
        # A clip/video <li> handles Enter/Space itself and calls preventDefault;
        # the global handler must not ALSO act on the same event (regression:
        # Space both activated the list item and toggled video play/pause).
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        if page.evaluate("() => AppState.clips.length") < 2:
            pytest.skip("needs at least 2 clips to observe arrow-key navigation")
        unchanged = page.evaluate("""() => {
            const before = AppState.activeClipId;
            const ev = new KeyboardEvent('keydown', {key: 'ArrowRight', cancelable: true, bubbles: true});
            ev.preventDefault();  // simulate a focused list item having handled the key
            document.body.dispatchEvent(ev);
            return AppState.activeClipId === before;
        }""")
        assert unchanged

    def test_shortcut_acts_on_focused_clip_row_not_active_clip(self, page: Page):
        # 'A' pressed while keyboard focus sits on a different clip row must
        # act on the focused row - not silently mutate the active clip.
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        if page.evaluate("() => AppState.clips.length") < 2:
            pytest.skip("needs at least 2 clips to observe the focused-vs-active split")
        active_id, focused_id = page.evaluate("""() => {
            const rows = document.querySelectorAll('#clip-list li[data-clip-id]');
            const other = [...rows].find(r => Number(r.dataset.clipId) !== AppState.activeClipId);
            other.focus();
            return [AppState.activeClipId, Number(other.dataset.clipId)];
        }""")
        assert focused_id != active_id
        page.route("**/api/clips/*/status", lambda route: route.abort())
        with page.expect_request(
            lambda r: r.method == "POST" and r.url.endswith("/status")
        ) as req_info:
            page.keyboard.press("a")
        assert f"/api/clips/{focused_id}/status" in req_info.value.url

    def test_arrow_navigation_moves_focus_with_active_clip(self, page: Page):
        # Focus ring and active highlight must stay on the same row after
        # arrow-key navigation, so A/R/E can never target a stale row.
        select_first_video_and_clip(page)
        page.wait_for_selector(".clip-actions", timeout=5000)
        if page.evaluate("() => AppState.clips.length") < 2:
            pytest.skip("needs at least 2 clips to observe arrow-key navigation")
        # Real click on the first row (rather than calling selectClip directly)
        # to make sure it - not just clips[0] in state - is the active clip.
        page.locator("#clip-list li[data-clip-id]").first.click()
        page.locator("#clip-list li[data-clip-id]").first.focus()
        page.keyboard.press("ArrowDown")
        page.wait_for_function("""() => {
            const focused = document.activeElement;
            return focused?.dataset?.clipId
                && Number(focused.dataset.clipId) === AppState.activeClipId
                && focused.classList.contains('active')
                && AppState.activeClipId === AppState.clips[1].id;
        }""", timeout=2000)

    def test_escape_closes_clean_field_edit_modal(self, page: Page):
        # UX-REVIEW H5: the field-edit modal previously swallowed Escape entirely
        # (while Controls promises "Esc closes the topmost window"). Escape now runs
        # its dirty-guarded closer; an unchanged field closes immediately.
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail-card .kebab-btn", timeout=3000)
        page.click(".detail-card .kebab-btn")
        page.click(".hamburger-menu.open button:has-text('Edit')")
        page.wait_for_selector("#field-edit-modal.visible", timeout=2000)
        page.wait_for_function(
            "document.activeElement === document.getElementById('field-edit-text')",
            timeout=2000,
        )
        page.keyboard.press("Escape")
        page.wait_for_selector("#field-edit-modal.visible", state="hidden", timeout=2000)

    def test_escape_in_dirty_field_edit_prompts_discard(self, page: Page):
        # A changed field must not be lost silently: Escape routes through the
        # dirty-guard, which shows the "Discard edit?" confirm and keeps the editor
        # open behind it.
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail-card .kebab-btn", timeout=3000)
        page.click(".detail-card .kebab-btn")
        page.click(".hamburger-menu.open button:has-text('Edit')")
        page.wait_for_selector("#field-edit-modal.visible", timeout=2000)
        page.fill("#field-edit-text", "a changed value the user does not want lost")
        page.keyboard.press("Escape")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#field-edit-modal")).to_be_visible()


@skip_no_server
class TestClipTags:
    """User-tag card in clip detail: add via Enter, remove via ×, autocomplete
    datalist populated from GET /api/tags."""

    def _route_tags(self, page: Page, suggestions=("existing-tag",)):
        import json
        page.route(
            "**/api/tags",
            lambda route: route.fulfill(
                status=200, content_type="application/json",
                body=json.dumps({"tags": list(suggestions)}),
            ),
        )

        def _put(route):
            body = route.request.post_data_json or {}
            tags = [t.strip() for t in body.get("tags", []) if t.strip()]
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"id": 1, "user_tags": tags}))

        page.route("**/api/clips/*/tags", _put)

    def test_tags_card_and_datalist_render(self, page: Page):
        self._route_tags(page, suggestions=("clutch", "funny"))
        select_first_video_and_clip(page)
        expect(page.locator("#clip-tag-input")).to_be_visible()
        # Datalist is populated from GET /api/tags.
        page.wait_for_function(
            "document.querySelectorAll('#clip-tags-datalist option').length === 2",
            timeout=3000,
        )

    def test_add_tag_via_enter_renders_pill(self, page: Page):
        self._route_tags(page)
        select_first_video_and_clip(page)
        page.fill("#clip-tag-input", "clutch")
        page.press("#clip-tag-input", "Enter")
        expect(page.locator("#clip-user-tags .user-tag")).to_have_count(1)
        expect(page.locator("#clip-user-tags .user-tag").first).to_contain_text("clutch")

    def test_remove_tag_sends_filtered_put(self, page: Page):
        self._route_tags(page)
        select_first_video_and_clip(page)
        page.fill("#clip-tag-input", "keep")
        page.press("#clip-tag-input", "Enter")
        # The PUT response re-renders the tags card; typing the second tag
        # before that re-render lands loses it (flaked under xdist load).
        expect(page.locator("#clip-user-tags .user-tag")).to_have_count(1)
        page.fill("#clip-tag-input", "drop")
        page.press("#clip-tag-input", "Enter")
        expect(page.locator("#clip-user-tags .user-tag")).to_have_count(2)
        # Remove "drop" → only "keep" remains.
        page.click("#clip-user-tags .user-tag:has-text('drop') .user-tag-x")
        expect(page.locator("#clip-user-tags .user-tag")).to_have_count(1)
        expect(page.locator("#clip-user-tags .user-tag").first).to_contain_text("keep")


@skip_no_server
class TestGeneratedTags:
    """M4-1: generated (pipeline) tags render inside the Tags card as read-only
    pills with display names - internal tokens never leak, and bookkeeping
    tags (scorer-ran markers) are hidden entirely."""

    def _render_with_tags(self, page: Page, tags: list):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            "(tags) => { AppState.activeClipData.tags = tags; renderDetail(AppState.activeClipData); }",
            tags,
        )

    def test_llm_error_renders_as_score_error_pill(self, page: Page):
        self._render_with_tags(page, ["llm_error"])
        card = page.locator(".detail-card:has(#clip-user-tags)")
        pill = card.locator(".tag", has_text="Score error")
        expect(pill).to_be_visible()
        expect(pill).to_have_attribute("title", re.compile(r"LLM scoring failed"))
        expect(page.locator("#detail")).not_to_contain_text("llm_error")

    def test_silence_tag_renders_readable_duration(self, page: Page):
        self._render_with_tags(page, ["after_silence_12s"])
        card = page.locator(".detail-card:has(#clip-user-tags)")
        expect(card.locator(".tag", has_text="After 12 s silence")).to_be_visible()

    def test_bookkeeping_tags_are_hidden(self, page: Page):
        self._render_with_tags(page, ["llm_scored", "energy_scored", "scenes_scored"])
        expect(page.locator(".detail-card:has(#clip-user-tags) .tag")).to_have_count(0)
        expect(page.locator("#detail")).not_to_contain_text("llm_scored")

    def test_no_bare_tags_row_outside_the_card(self, page: Page):
        self._render_with_tags(page, ["llm_error"])
        expect(page.locator("#detail > .tags")).to_have_count(0)


@skip_no_server
class TestClipDetailCards:
    """CC-9: Related Clips and Transcript are .detail-cards like every other
    major section of the clip detail view."""

    def test_related_clips_is_a_card(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                AppState.activeClipData.related_clips = [{id: 2, reason: 'same fight'}];
                renderDetail(AppState.activeClipData);
            }"""
        )
        section = page.locator("#related-clips-section")
        expect(section).to_have_class(re.compile(r"\bdetail-card\b"))
        expect(section.locator(".detail-card-title")).to_have_text("Related Clips")

    def test_transcript_is_a_card(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                AppState.activeClipData.transcript_excerpt = 'hello there';
                renderDetail(AppState.activeClipData);
            }"""
        )
        card = page.locator(".detail-card:has(#clip-transcript-view)")
        expect(card).to_have_count(1)
        expect(card.locator(".detail-card-title")).to_have_text("Transcript")

    def test_scoring_actions_render_above_description(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        titles = page.eval_on_selector_all(
            "#detail .detail-card-title",
            "els => els.map(e => e.textContent.trim())")
        assert "Scoring" in titles and "Actions" in titles
        first_desc = next(i for i, t in enumerate(titles) if t.startswith("Description"))
        assert titles.index("Scoring") < first_desc
        assert titles.index("Actions") < first_desc


@skip_no_server
class TestClipActionsModalGroups:
    """L4-1: the clip Additional Actions modal groups actions by what they do -
    Scoring / Transcript / Discover - not under a catch-all "Regenerate"."""

    def test_groups_are_scoring_transcript_discover(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate("() => { AppState.activeClipData.description = 'a described clip'; }")
        # Real click: the clip's own Additional Actions button.
        page.click(".clip-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        # text_content, not inner_text - .section-title is CSS-uppercased
        headings = page.locator("#actions-modal-body .section-title").all_text_contents()
        assert "Regenerate" not in headings
        assert {"Scoring", "Transcript", "Discover"} <= set(headings)
        page.keyboard.press("Escape")

    def test_merge_row_description_is_truncated(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                const long = 'x'.repeat(200);
                AppState.clips = [
                    {id: 9001, start_ms: 0, start_hms: '0:00', description: long},
                    {id: 9002, start_ms: 60000, start_hms: '1:00', description: 'short'},
                ];
                AppState.activeClipData = null;
                openClipActionsModal(9002);
            }"""
        )
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        merge_desc = page.locator(
            "#actions-modal-body .action-row:has-text('Merge previous') .action-row-desc"
        ).inner_text()
        assert "x" * 59 + "…" in merge_desc
        assert "x" * 60 not in merge_desc
        page.keyboard.press("Escape")

    def test_merge_confirm_can_be_cancelled_without_merging(self, page: Page):
        """Smoke test: the merge action prompts
        for confirmation and Cancel does not call the (destructive) merge route.
        Uses fake clip IDs, matching test_merge_row_description_is_truncated above -
        merge permanently deletes a clip, so the round trip that actually executes
        it is exercised only against a disposable fixture DB, in
        tests/test_videos.py::TestMergeClips."""
        select_first_video_and_clip(page)
        page.wait_for_selector("#clip-tag-input", timeout=3000)
        page.evaluate(
            """() => {
                AppState.clips = [
                    {id: 9001, start_ms: 0, start_hms: '0:00', description: 'first'},
                    {id: 9002, start_ms: 60000, start_hms: '1:00', description: 'second'},
                ];
                AppState.activeClipData = null;
                openClipActionsModal(9002);
            }"""
        )
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        merge_requests: list = []
        page.on("request", lambda r: merge_requests.append(r) if "/merge" in r.url else None)
        page.click("#actions-modal-body button:has-text('Merge previous')")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        expect(page.locator("#confirm-title")).to_contain_text("Merge")
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_selector("#confirm-modal.visible", state="hidden", timeout=2000)
        assert not merge_requests


@skip_no_server
class TestClipFilterChips:
    """The multi-select filter chip row: toggle on/off, All resets, and the
    Exported/Not-exported pair is mutually exclusive."""

    def test_chip_toggles_and_all_resets(self, page: Page):
        select_video_with_clips(page)
        approved = page.locator("button.clip-chip[data-filter='approved']")
        all_chip = page.locator("button.clip-chip[data-filter='all']")
        approved.click()
        expect(approved).to_have_attribute("aria-pressed", "true")
        expect(all_chip).to_have_attribute("aria-pressed", "false")
        approved.click()  # toggle off → back to "All" active
        expect(approved).to_have_attribute("aria-pressed", "false")
        expect(all_chip).to_have_attribute("aria-pressed", "true")

    def test_export_chips_mutually_exclusive(self, page: Page):
        select_video_with_clips(page)
        # Export chips now live inside the collapsed "More filters" expander.
        page.click("#clip-more-filters > summary")
        exported = page.locator("button.clip-chip[data-filter='exported']")
        not_exported = page.locator("button.clip-chip[data-filter='not-exported']")
        exported.click()
        expect(exported).to_have_attribute("aria-pressed", "true")
        not_exported.click()
        expect(not_exported).to_have_attribute("aria-pressed", "true")
        expect(exported).to_have_attribute("aria-pressed", "false")

    def test_status_chips_visible_warning_chips_hidden_when_collapsed(self, page: Page):
        select_video_with_clips(page)
        # The "More filters" expander starts collapsed.
        assert page.evaluate(
            "() => document.getElementById('clip-more-filters').open"
        ) is False
        for token in ("all", "pending", "approved", "rejected"):
            expect(
                page.locator(f"button.clip-chip[data-filter='{token}']")
            ).to_be_visible()
        for token in ("exported", "not-exported", "error", "flagged", "duplicate", "no_speech"):
            expect(
                page.locator(f"button.clip-chip[data-filter='{token}']")
            ).not_to_be_visible()

    def test_activating_hidden_filter_autoopens_expander(self, page: Page):
        select_video_with_clips(page)
        assert page.evaluate(
            "() => document.getElementById('clip-more-filters').open"
        ) is False
        page.evaluate("() => toggleClipFilter('flagged')")
        assert page.evaluate(
            "() => document.getElementById('clip-more-filters').open"
        ) is True
        expect(page.locator("#clip-more-filters .clip-more-flag")).to_be_visible()
        expect(
            page.locator("button.clip-chip[data-filter='flagged']")
        ).to_be_visible()


# ---------------------------------------------------------------------------
# Quick-wins Stage 1 - J/K navigation, clip stats line, shortcut hint,
# Electron-only Refresh hamburger item
# ---------------------------------------------------------------------------

@skip_no_server
class TestJKNavigation:
    """J/K are aliases for the existing arrow-key prev/next navigation."""

    def test_j_moves_to_next_clip(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        first_id = page.evaluate("() => AppState.activeClipId")
        second_id = page.evaluate("() => AppState.clips[1]?.id")
        assert second_id is not None, "Need at least 2 clips for this test"
        page.keyboard.press("j")
        expect(page.locator("#clip-list li.active")).to_have_attribute(
            "data-clip-id", str(second_id)
        )
        assert page.evaluate("() => AppState.activeClipId") != first_id

    def test_k_moves_to_previous_clip(self, page: Page):
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        second_id = page.evaluate("() => AppState.clips[1]?.id")
        assert second_id is not None, "Need at least 2 clips for this test"
        page.keyboard.press("j")
        page.wait_for_function(
            f"() => AppState.activeClipId === {second_id}"
        )
        first_id = page.evaluate("() => AppState.clips[0].id")
        page.keyboard.press("k")
        expect(page.locator("#clip-list li.active")).to_have_attribute(
            "data-clip-id", str(first_id)
        )


@skip_no_server
class TestClipStatsLine:
    def test_stats_line_matches_clip_counts(self, page: Page):
        select_video_with_clips(page)
        page.wait_for_selector("#clip-stats-line", state="visible", timeout=3000)
        counts = page.evaluate(
            """() => {
                const c = {pending: 0, approved: 0, rejected: 0};
                for (const clip of AppState.clips) c[clip.status]++;
                return c;
            }"""
        )
        stats = page.locator("#clip-stats-line")
        expect(stats).to_contain_text(f"{counts['pending']} unreviewed")
        expect(stats).to_contain_text(f"{counts['approved']} approved")
        expect(stats).to_contain_text(f"{counts['rejected']} rejected")

    def test_stats_line_total_duration_is_nonzero(self, page: Page):
        # Regression: the total summed c.end_s - c.start_s, but clips carry
        # start_ms/end_ms - every term was NaN, so a list of real clips still
        # read "0 sec total". Compare against the ms-based duration.
        select_video_with_clips(page)
        page.wait_for_selector("#clip-stats-line", state="visible", timeout=3000)
        expected = page.evaluate(
            """() => {
                const secs = _applyFilters().reduce(
                    (s, c) => s + (c.end_ms - c.start_ms) / 1000, 0);
                return fmtDuration(secs);
            }"""
        )
        assert not expected.startswith("0 sec"), "fixture clips have no duration"
        expect(page.locator("#clip-stats-line")).to_contain_text(f"{expected} total")

    def test_stats_line_updates_with_filter(self, page: Page):
        select_video_with_clips(page)
        page.wait_for_selector("#clip-stats-line", state="visible", timeout=3000)
        total_shown = page.locator("#clip-list li[data-clip-id]").count()
        page.locator("button.clip-chip[data-filter='approved']").click()
        approved_count = page.evaluate(
            "() => AppState.clips.filter(c => c.status === 'approved').length"
        )
        expect(page.locator("#clip-stats-line")).to_contain_text(f"{approved_count} shown")
        assert approved_count <= total_shown

    def test_stats_line_hidden_when_no_recording_selected(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("() => { AppState.activeVideoId = null; AppState.clips = []; _renderClips(); }")
        expect(page.locator("#clip-stats-line")).to_be_hidden()


@skip_no_server
class TestShortcutHint:
    def test_hint_present_near_clip_list(self, page: Page):
        page.goto(LIVE_URL)
        expect(page.locator(".clip-shortcut-hint")).to_contain_text("J/K navigate")
        expect(page.locator(".clip-shortcut-hint")).to_contain_text("? all shortcuts")


@skip_no_server
class TestRefreshHamburgerItem:
    def test_hidden_in_plain_browser(self, page: Page):
        page.goto(LIVE_URL)
        assert page.evaluate("() => window.electronAPI") is None
        page.click("#btn-hamburger")
        page.wait_for_selector("#hamburger-menu.open")
        expect(page.locator("#btn-refresh")).to_be_hidden()

    def test_shown_when_electron_api_present(self, page: Page):
        page.add_init_script("window.electronAPI = { runSetupWizard: () => {} };")
        page.goto(LIVE_URL)
        page.click("#btn-hamburger")
        page.wait_for_selector("#hamburger-menu.open")
        expect(page.locator("#btn-refresh")).to_be_visible()


# ---------------------------------------------------------------------------
# Quick-wins Stage 2 - playback options (play-next, loop clip)
# ---------------------------------------------------------------------------

@skip_no_server
class TestPlaybackOptions:
    def test_play_next_seeded_advances_on_ended(self, page: Page):
        page.add_init_script(
            "try { localStorage.setItem('yuuclip-play-next', 'true'); } catch (e) {}"
        )
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        second_id = page.evaluate("() => AppState.clips[1]?.id")
        assert second_id is not None, "Need at least 2 clips for this test"
        page.eval_on_selector("#player-area video", "v => v.dispatchEvent(new Event('ended'))")
        page.wait_for_function(f"() => AppState.activeClipId === {second_id}")

    def test_loop_seeded_sets_loop_attribute(self, page: Page):
        page.add_init_script(
            "try { localStorage.setItem('yuuclip-loop-clip', 'true'); } catch (e) {}"
        )
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector("#player-area video", timeout=3000)
        # Wait for the attribute, not just the element: under parallel load the
        # <video> can appear a tick before the loop pref is applied, so reading
        # v.loop immediately raced and flaked.
        page.wait_for_function(
            "() => document.querySelector('#player-area video')?.loop === true",
            timeout=3000,
        )

    def test_play_next_and_loop_are_mutually_exclusive(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("openSettings()")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.check("#s-play-next")
        expect(page.locator("#s-loop-clip")).not_to_be_checked()
        page.check("#s-loop-clip")
        expect(page.locator("#s-play-next")).not_to_be_checked()


# ---------------------------------------------------------------------------
# Quick-wins Stage 3 - copy-to-clipboard
# ---------------------------------------------------------------------------

@skip_no_server
class TestCopyToClipboard:
    """navigator.clipboard.writeText is stubbed for deterministic assertions
    across xdist workers - a real clipboard read races with OS clipboard state
    shared by other workers."""

    def _stub_clipboard(self, page: Page) -> None:
        page.add_init_script(
            "navigator.clipboard.writeText = (t) => { window.__copiedText = t; return Promise.resolve(); };"
        )

    def test_copy_description(self, page: Page):
        self._stub_clipboard(page)
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        description = page.evaluate("() => AppState.activeClipData?.description")
        if not description:
            pytest.skip("Active clip has no description")
        page.click("[data-copy='description']")
        assert page.evaluate("() => window.__copiedText") == description
        expect(page.locator("#toast-container .toast.success")).to_contain_text("Description copied")

    def test_copy_transcript(self, page: Page):
        self._stub_clipboard(page)
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        excerpt = page.evaluate("() => AppState.activeClipData?.transcript_excerpt")
        if not excerpt:
            pytest.skip("Active clip has no transcript excerpt")
        page.click("[data-copy='transcript']")
        assert page.evaluate("() => window.__copiedText") == excerpt
        expect(page.locator("#toast-container .toast.success")).to_contain_text("Transcript copied")

    # test_copy_export_file_paths moved to tests/js/clips/clipexport.test.js - the
    # _copyClipExportPaths path-assembly + clipboard write runs browserless there.
    # The data-copy description/transcript delegation above stays (DOM wiring).


# ---------------------------------------------------------------------------
# Quick-wins Stage 4 - show in folder (Explorer reveal)
# ---------------------------------------------------------------------------

@skip_no_server
class TestClipShowInFolder:
    # test_show_in_folder_posts_reveal_with_first_export_file moved to
    # tests/js/clips/clipexport.test.js - the _revealClipExport -> revealInFolder ->
    # POST /api/reveal path-assembly chain runs browserless there. The canReveal gate
    # (the action row is absent when reveal is unavailable) stays here.

    def test_hidden_when_reveal_unavailable(self, page: Page):
        page.goto(LIVE_URL)
        select_first_video_and_clip(page)
        page.wait_for_selector(".detail", timeout=3000)
        page.evaluate(
            """() => {
                AppState.canReveal = false;
                AppState.activeClipData.has_export = true;
            }"""
        )
        # Real click: the clip's own Additional Actions button.
        page.click(".clip-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        expect(page.locator("#actions-modal-body .action-row:has-text('Show in Folder')")).to_have_count(0)


# ---------------------------------------------------------------------------
# Quick-wins Stage 6 - batch processing status panel
# ---------------------------------------------------------------------------

@skip_no_server
class TestClipFilterCounts:
    def test_counts_render_on_filter_chips(self, page: Page):
        select_video_with_clips(page)
        page.wait_for_selector(".clip-chip-count[data-count='all']", timeout=3000)
        counts = page.evaluate(
            """() => {
                const c = {pending: 0, approved: 0, rejected: 0};
                for (const clip of AppState.clips) c[clip.status]++;
                return {total: AppState.clips.length, ...c};
            }"""
        )
        def badge(key):
            return page.locator(f".clip-chip-count[data-count='{key}']")

        expect(badge("all")).to_have_text(str(counts["total"]))
        expect(badge("pending")).to_have_text(str(counts["pending"]))
        expect(badge("approved")).to_have_text(str(counts["approved"]))
        expect(badge("rejected")).to_have_text(str(counts["rejected"]))

    def test_counts_blank_when_no_recording_selected(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("() => { AppState.activeVideoId = null; AppState.clips = []; _renderClips(); }")
        for key in ("all", "pending", "approved", "rejected", "error"):
            expect(page.locator(f".clip-chip-count[data-count='{key}']")).to_have_text("")


@skip_no_server
class TestBasicDescriptionChip:
    """The 'Basic description' nudge under a clip whose one-liner is the non-LLM
    template fallback (tagged desc_basic). Synthetic clip via renderDetail, the same
    pattern as TestMultiFormatExportRows above - no analyze run needed."""

    def _clip(self, clip_id, tags):
        return {
            "id": clip_id, "start_hms": "0:00", "duration_hms": "0:30",
            "description": "Yuu & Alex - heist, getaway", "description_is_edited": False,
            "description_long": "", "description_long_is_edited": False,
            "status": "pending", "tags": tags, "user_tags": [],
            "start_offset": 0, "end_offset": 0, "has_export": False, "exports": [],
        }

    def _render_with_state(self, page: Page, clip, *, ai_mode="local_only", prereqs=None):
        # Set the window state and render synchronously in one call so a late boot
        # /api/config or /api/prereqs fetch can't clobber it mid-test (see the
        # stub-then-render flake pattern in the flake register).
        page.evaluate(
            """([clip, aiMode, prereqs]) => {
                window._aiPrivacyMode = aiMode;
                window._prereqs = prereqs;
                renderDetail(clip);
            }""",
            [clip, ai_mode, prereqs or {"ffmpeg_ok": True, "llm_ok": False, "llm_reason": ""}],
        )

    def test_placeholder_shown_when_no_model_available(self, page: Page):
        # No usable model: the transcript-derived template reads as broken, so the
        # description area shows a "set up a model" placeholder instead of quoting it,
        # and never leaks the reason string (which could carry a raw path).
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        clip = self._clip(9401, ["desc_basic"])
        self._render_with_state(
            page, clip,
            prereqs={"ffmpeg_ok": True, "llm_ok": False,
                     "llm_reason": r"Model file not found: C:\Users\someone\model.gguf"},
        )
        cta = page.locator("#detail .needs-model-cta")
        expect(cta).to_be_visible()
        expect(cta).to_contain_text("AI descriptions need a local model")
        expect(cta.locator("button")).to_contain_text("Set up a local model")
        # The template one-liner must not be quoted as a real description here.
        expect(page.locator("#detail .description")).to_have_count(0)
        expect(page.locator(".basic-desc-chip")).to_have_count(0)
        # No raw path leak anywhere in the rendered detail pane.
        expect(page.locator("#detail")).not_to_contain_text(r"C:\Users")

    def test_chip_offers_reanalyze_when_model_available(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        self._render_with_state(
            page, self._clip(9403, ["desc_basic"]),
            prereqs={"ffmpeg_ok": True, "llm_ok": True, "llm_reason": ""},
        )
        chip = page.locator(".basic-desc-chip")
        expect(chip).to_contain_text("re-analyze")
        expect(chip.locator("a")).to_have_count(0)

    def test_chip_neutral_when_generative_ai_off(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        self._render_with_state(page, self._clip(9404, ["desc_basic"]), ai_mode="none")
        chip = page.locator(".basic-desc-chip")
        expect(chip).to_contain_text("generative AI is turned off")
        expect(chip.locator("a")).to_have_count(0)

    def test_no_chip_for_llm_description(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        self._render_with_state(page, self._clip(9402, []))
        expect(page.locator(".basic-desc-chip")).to_have_count(0)


# ---------------------------------------------------------------------------
# Sidebar declutter Stage 2 - Clips header "..." actions menu
# ---------------------------------------------------------------------------

@skip_no_server
class TestClipsActionsMenu:
    def test_menu_opens_and_toggles_aria(self, page: Page):
        select_video_with_clips(page)
        trigger = page.locator("#btn-clips-actions")
        expect(trigger).to_have_attribute("aria-expanded", "false")
        trigger.click()
        expect(page.locator(".hamburger-menu.open")).to_be_visible()
        expect(trigger).to_have_attribute("aria-expanded", "true")
        # Default "All" kind filter offers both create entries (New clip, New scene)
        # plus Check duplicates - see openClipsActionsMenu.
        expect(page.locator(".hamburger-menu.open .hamburger-item")).to_have_count(3)

    def test_escape_closes_and_returns_focus(self, page: Page):
        select_video_with_clips(page)
        page.click("#btn-clips-actions")
        expect(page.locator(".hamburger-menu.open")).to_be_visible()
        page.keyboard.press("Escape")
        expect(page.locator(".hamburger-menu.open")).to_have_count(0)
        expect(page.locator("#btn-clips-actions")).to_have_attribute(
            "aria-expanded", "false")
        assert page.evaluate(
            "() => document.activeElement.id") == "btn-clips-actions"

    def test_check_duplicates_shows_busy_state_on_trigger(self, page: Page):
        select_video_with_clips(page)
        # Freeze the scan request so the in-flight "Checking..." state persists
        # long enough to assert it lands on the kebab trigger button.
        page.evaluate(
            """() => {
                const orig = window.fetch;
                window.fetch = (url, opts) =>
                    String(url).includes('scan-duplicates')
                        ? new Promise(() => {})
                        : orig(url, opts);
            }"""
        )
        page.click("#btn-clips-actions")
        page.click(".hamburger-menu.open .hamburger-item:has-text('Check duplicates')")
        trigger = page.locator("#btn-clips-actions")
        expect(trigger).to_be_disabled()
        expect(trigger).to_have_text("Checking...")


# ---------------------------------------------------------------------------
# Collapsible detail cards (utils.js document listeners + clips.js markup).
# The clip Description card is a *compound* collapsible card: only its own first
# header toggles it, nested headers (Tags / Full Description) do not, and the
# collapsed state persists per card *type* across a detail re-render.
# ---------------------------------------------------------------------------

_DESC_CARD = "[data-collapse-key='clip-description']"
# The toggle is a real <button.card-toggle> inside the card's first header - it
# carries aria-expanded, is focusable, and is the click/keyboard target. Header
# action buttons (Copy, kebab) are its siblings, never nested inside it.
_DESC_TOGGLE = (
    "[data-collapse-key='clip-description'] > .detail-card-header:first-child"
    " > .card-toggle"
)
_DESC_BODY = "[data-collapse-key='clip-description'] .description"


@skip_no_server
class TestCollapsibleCards:
    def _open_expanded_description_card(self, page: Page):
        # A fresh Playwright context starts with clean localStorage, so the
        # Description card (which defaults to expanded) opens expanded.
        select_first_video_and_clip(page)
        toggle = page.locator(_DESC_TOGGLE)
        expect(toggle).to_have_attribute("aria-expanded", "true")
        expect(page.locator(_DESC_BODY)).to_be_visible()
        return toggle

    def test_clicking_first_header_collapses_then_expands(self, page: Page):
        toggle = self._open_expanded_description_card(page)
        body = page.locator(_DESC_BODY)

        toggle.click()
        expect(toggle).to_have_attribute("aria-expanded", "false")
        expect(body).to_be_hidden()

        toggle.click()
        expect(toggle).to_have_attribute("aria-expanded", "true")
        expect(body).to_be_visible()

    def test_enter_key_on_header_toggles_collapse(self, page: Page):
        toggle = self._open_expanded_description_card(page)
        toggle.focus()

        page.keyboard.press("Enter")
        expect(toggle).to_have_attribute("aria-expanded", "false")
        expect(page.locator(_DESC_BODY)).to_be_hidden()

        page.keyboard.press("Enter")
        expect(toggle).to_have_attribute("aria-expanded", "true")
        expect(page.locator(_DESC_BODY)).to_be_visible()

    def test_space_key_on_header_toggles_collapse(self, page: Page):
        toggle = self._open_expanded_description_card(page)
        toggle.focus()

        page.keyboard.press("Space")
        expect(toggle).to_have_attribute("aria-expanded", "false")
        expect(page.locator(_DESC_BODY)).to_be_hidden()

    def test_toggle_has_no_nested_interactive_controls(self, page: Page):
        # The toggle is a <button>; a button nested inside it would be a WCAG
        # 4.1.2 nested-interactive violation. The Copy/kebab actions must be
        # siblings of the toggle, not descendants.
        self._open_expanded_description_card(page)
        nested = page.locator(
            _DESC_TOGGLE + " button, " + _DESC_TOGGLE + " a[href], "
            + _DESC_TOGGLE + " input, " + _DESC_TOGGLE + " select"
        )
        expect(nested).to_have_count(0)

    def test_nested_header_click_does_not_toggle_outer_card(self, page: Page):
        # The Tags sub-header lives inside the same card body and carries no
        # .card-toggle, so clicking it must not collapse the outer card.
        toggle = self._open_expanded_description_card(page)
        nested = page.locator(_DESC_CARD + " .detail-card-header").filter(has_text="Tags")
        nested.locator(".detail-card-title").click()

        expect(toggle).to_have_attribute("aria-expanded", "true")
        expect(page.locator(_DESC_BODY)).to_be_visible()

    def test_collapse_persists_across_rerender_and_scopes_to_its_own_key(self, page: Page):
        self._open_expanded_description_card(page)
        page.click(_DESC_TOGGLE)

        # Only the toggled card type's key is written - collapse state is shared
        # per card *type*, never bled onto sibling card types.
        state = page.evaluate(
            "() => JSON.parse(localStorage.getItem('yuuclip-card-collapsed') || '{}')"
        )
        assert state == {"clip-description": True}

        # A detail re-render (as after a re-score) rebuilds the markup; the card
        # must come back collapsed rather than reset to its expanded default.
        page.evaluate("renderDetail(AppState.activeClipData)")
        expect(page.locator(_DESC_TOGGLE)).to_have_attribute("aria-expanded", "false")
        expect(page.locator(_DESC_BODY)).to_be_hidden()
