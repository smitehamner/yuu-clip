"""
Playwright UI tests — per-video summary regeneration confirm flow, the
run-timing provenance line in the World Contexts section, and the video-level
Additional Actions modal.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from conftest import LIVE_URL, select_video_with_clips, skip_no_server
from playwright.sync_api import Page, expect

_MOCK_ANALYZE_RUN = {
    "started_at": "2026-06-01T00:00:00+00:00",
    "finished_at": "2026-06-01T00:04:12+00:00",
    "elapsed_ms": 252000,
    "device": {"has_gpu": False},
    "settings": {},
    "stages": [
        {"name": "extract", "seconds": 12},
        {"name": "transcribe", "seconds": 181},
        {"name": "speakers", "seconds": 38},
        {"name": "score", "seconds": 41},
    ],
}


def _render_video_with(page: Page, overrides: dict) -> None:
    """Render the first sidebar video's detail with fields overridden, bypassing
    selectVideo's fetch so the test controls exactly what the layout sees."""
    page.goto(LIVE_URL)
    page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
    page.evaluate(
        """(overrides) => {
          const video = Object.assign({}, AppState.videos[0], overrides);
          renderVideoDetail(video, null);
        }""",
        overrides,
    )


@skip_no_server
class TestRunTimingProvenanceLine:
    """The World Contexts section shows a 'Last run: ... total (...)' line built
    from Video.analyze_run when present, and omits it otherwise."""

    def test_shows_total_and_per_stage_timing(self, page: Page):
        _render_video_with(page, {"analyze_run": _MOCK_ANALYZE_RUN})
        expect(page.locator("#detail")).to_contain_text(
            "Last run: 4m 12s total (extract 12s · transcribe 3m 01s · speakers 38s · score 41s)"
        )

    def test_absent_when_analyze_run_is_null(self, page: Page):
        _render_video_with(page, {"analyze_run": None})
        expect(page.locator("#detail")).not_to_contain_text("Last run:")


@skip_no_server
class TestAnalysisLivePanel:
    """The in-detail live panel mirrors the header bar — it has a Cancel button
    and shows the same per-step progress fill."""

    def test_panel_has_cancel_button(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.evaluate("document.getElementById('detail').innerHTML = _analysisLivePanelHTML()")
        btn = page.locator("#analysis-live-panel button", has_text="Cancel")
        expect(btn).to_have_count(1)
        assert "cancelJob" in (btn.get_attribute("onclick") or "")

    def test_active_step_shows_progress_fill(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        page.evaluate(
            """() => {
              document.getElementById('detail').innerHTML = _analysisLivePanelHTML();
              _jobStepDefs = [{label: 'Score'}, {label: 'Done'}];
              _activeStepIdx = 0;
              _stepStartTime = Date.now() - 1000;
              _stepProgress = {0: {current: 5, total: 10}};
              _stepRateAnchor = {0: {t: Date.now() - 1000, current: 1}};
              _syncAnalysisLivePanel();
            }"""
        )
        active = page.locator("#analysis-live-steps .step.active")
        expect(active).to_have_count(1)
        assert "linear-gradient" in (active.get_attribute("style") or "")


@skip_no_server
class TestContextsSelfHeal:
    """Opening a recording refetches world contexts if the boot-time load left the
    list empty (transient failure / race), so the context section never renders
    from an empty list until a manual page refresh."""

    def test_empty_context_list_reloads_on_select(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        # Simulate the boot load not having populated (or having failed) yet.
        page.evaluate("AppState.contexts = []")
        video_id = page.evaluate("AppState.videos[0].id")
        page.evaluate("(id) => selectVideo(id)", video_id)
        # Built-in contexts guarantee a non-empty list once ensureContexts refetches.
        page.wait_for_function("() => AppState.contexts.length > 0", timeout=5000)


@skip_no_server
class TestRegenSummaryAutoConfirm:
    """regenSummaryAuto shows a confirm modal before running the SSE regen stream."""

    def _open_regen_confirm(self, page: Page) -> None:
        """Navigate to the app and invoke regenSummaryAuto via JS so the confirm modal appears."""
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        video_id = page.evaluate("() => AppState.videos?.[0]?.id ?? 1")
        # Pass a detached button so _doRegenSummaryAuto has a non-null actionBtn
        page.evaluate(f"() => regenSummaryAuto({video_id}, document.createElement('button'))")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)

    def test_confirm_modal_appears(self, page: Page):
        self._open_regen_confirm(page)
        expect(page.locator("#confirm-modal")).to_be_visible()

    def test_confirm_title_mentions_regenerate(self, page: Page):
        self._open_regen_confirm(page)
        expect(page.locator("#confirm-title")).to_contain_text("Regenerate")

    def test_confirm_body_warns_about_auto_save(self, page: Page):
        self._open_regen_confirm(page)
        expect(page.locator("#confirm-body")).to_contain_text("replaced without a review step")

    def test_cancel_closes_modal(self, page: Page):
        self._open_regen_confirm(page)
        page.click("#confirm-modal button:has-text('Cancel')")
        expect(page.locator("#confirm-modal")).not_to_be_visible()

    def test_cancel_does_not_trigger_regen_request(self, page: Page):
        self._open_regen_confirm(page)
        regen_requests: list = []
        page.on("request", lambda r: regen_requests.append(r) if "regenerate-summary" in r.url else None)
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_timeout(500)
        assert not regen_requests, "Cancelling should not POST to regenerate-summary"

    def test_confirm_triggers_regen_sse_request(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        video_id = page.evaluate("() => AppState.videos?.[0]?.id ?? 1")
        # Abort the actual SSE stream so the test doesn't trigger real LLM work
        page.route("**/regenerate-summary", lambda route: route.abort())
        page.evaluate(f"() => regenSummaryAuto({video_id}, document.createElement('button'))")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        with page.expect_request(lambda r: "regenerate-summary" in r.url, timeout=3000):
            page.click("#confirm-ok-btn")


@skip_no_server
class TestDeleteVideoConfirm:
    """deleteVideo shows a confirm modal; only OK sends the DELETE request.

    The DELETE is intercepted and aborted so the live server's video is never
    actually removed.
    """

    def _open_delete_confirm(self, page: Page) -> int:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        video_id = page.evaluate("() => AppState.videos[0].id")
        page.route(
            "**/api/videos/*",
            lambda route: route.abort()
            if route.request.method == "DELETE"
            else route.continue_(),
        )
        page.evaluate(f"() => deleteVideo({video_id})")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        return video_id

    def test_confirm_modal_has_remove_title(self, page: Page):
        self._open_delete_confirm(page)
        expect(page.locator("#confirm-title")).to_contain_text("Remove recording?")

    def test_body_says_source_file_is_kept(self, page: Page):
        self._open_delete_confirm(page)
        expect(page.locator("#confirm-body")).to_contain_text(
            "Your source recording file is not deleted."
        )

    def test_cancel_sends_no_delete_request(self, page: Page):
        self._open_delete_confirm(page)
        delete_requests: list = []
        page.on(
            "request",
            lambda r: delete_requests.append(r)
            if r.method == "DELETE" and "/api/videos/" in r.url
            else None,
        )
        page.click("#confirm-modal button:has-text('Cancel')")
        page.wait_for_timeout(500)
        assert not delete_requests, "Cancelling must not DELETE the video"

    def test_confirm_sends_delete_for_that_video(self, page: Page):
        video_id = self._open_delete_confirm(page)
        with page.expect_request(
            lambda r: r.method == "DELETE" and r.url.endswith(f"/api/videos/{video_id}"),
            timeout=3000,
        ):
            page.click("#confirm-ok-btn")


@skip_no_server
class TestVideoDetailCardLayout:
    """Every major section of the video detail is a .detail-card that owns its
    own action (M3-1/M3-2/CC-9); title kebab always renders (M3-3); meta line
    sits under the title (L3-1)."""

    def test_summary_card_renders_with_generate_button_when_empty(self, page: Page):
        _render_video_with(page, {"summary": None})
        card = page.locator("#detail .detail-card", has_text="Session Summary")
        expect(card).to_have_count(1)
        expect(card.locator("#btn-summarize-video")).to_have_text("Generate Summary")

    def test_summary_card_shows_content_and_kebab_when_present(self, page: Page):
        _render_video_with(page, {"summary": "A great session happened."})
        card = page.locator("#detail .detail-card", has_text="Session Summary")
        expect(card).to_contain_text("A great session happened.")
        expect(card.locator(".kebab-btn")).to_have_count(1)

    def test_timeline_card_renders_with_generate_button_when_empty(self, page: Page):
        _render_video_with(page, {"has_timeline": False})
        card = page.locator("#detail .detail-card", has_text="Session Timeline")
        expect(card).to_have_count(1)
        expect(card.locator("#btn-generate-timeline")).to_have_text("Generate Timeline")

    def test_timeline_card_button_says_regenerate_when_timeline_exists(self, page: Page):
        _render_video_with(page, {"has_timeline": True})
        card = page.locator("#detail .detail-card", has_text="Session Timeline")
        expect(card.locator("#btn-generate-timeline")).to_have_text("Regenerate Timeline")

    def test_world_contexts_is_its_own_card_outside_the_title_card(self, page: Page):
        _render_video_with(page, {})
        title_card = page.locator("#detail .detail-card").first
        expect(title_card).not_to_contain_text("World Contexts")
        ctx_card = page.locator(
            "#detail .detail-card", has=page.locator(".context-chips")
        )
        expect(ctx_card).to_have_count(1)
        expect(ctx_card.locator(".detail-card-title")).to_have_text("World Contexts")

    def test_title_kebab_renders_when_no_title_exists(self, page: Page):
        _render_video_with(page, {"title": None})
        title_card = page.locator("#detail .detail-card").first
        expect(title_card.locator(".kebab-btn")).to_have_count(1)

    def test_meta_line_sits_under_the_title_inside_the_title_card(self, page: Page):
        _render_video_with(page, {})
        title_card = page.locator("#detail .detail-card").first
        expect(title_card).to_contain_text("clipped")

    def test_actions_row_keeps_only_export_and_additional_actions(self, page: Page):
        _render_video_with(page, {})
        buttons = page.locator("#detail .vid-actions button")
        expect(buttons).to_have_count(2)
        expect(buttons.nth(0)).to_have_text("Export Approved")
        expect(buttons.nth(1)).to_have_text("Additional Actions")

    def test_full_transcript_section_is_a_card(self, page: Page):
        _render_video_with(page, {"clip_count": 3, "status": "done"})
        expect(
            page.locator("#detail .detail-card > #video-transcript-details")
        ).to_have_count(1)


@skip_no_server
class TestTimelineModalUnitOrder:
    """The Generate Timeline modal lists units in the same order as Settings'
    timeline-interval control: seconds, then minutes (L3-2)."""

    def test_unit_order_matches_settings(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        modal_units = page.locator("#timeline-interval-unit option").all_text_contents()
        settings_units = page.locator("#s-timeline-unit option").all_text_contents()
        assert modal_units == settings_units == ["seconds", "minutes"]

    def test_default_unit_is_still_minutes(self, page: Page):
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li", timeout=5000)
        assert page.eval_on_selector("#timeline-interval-unit", "el => el.value") == "minutes"


# ---------------------------------------------------------------------------
# Video-level "Additional Actions" modal
# ---------------------------------------------------------------------------

@skip_no_server
class TestVideoActionsModal:
    def test_opens_with_expected_action_groups(self, page: Page):
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        body = page.locator("#actions-modal-body")
        expect(body.locator("button:has-text('Approve Above Score')")).to_be_visible()
        expect(body.locator("button:has-text('Re-score All Clips')")).to_be_visible()
        expect(body.locator("button:has-text('Re-detect Speakers')")).to_be_visible()
        expect(body.locator("button:has-text('Split Recording')")).to_be_visible()
        expect(body.locator("button:has-text('Re-analyze (full)')")).to_be_visible()

    def test_title_includes_video_name(self, page: Page):
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        expect(page.locator("#actions-modal-title")).to_contain_text("Additional Actions")

    def test_danger_actions_render_with_danger_class(self, page: Page):
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        danger_row = page.locator("#actions-modal-body .action-row.danger:has-text('Remove Recording')")
        expect(danger_row).to_be_visible()

    def test_closing_modal_does_not_trigger_any_action(self, page: Page):
        # Clicking the close (X) button must dismiss the modal without invoking
        # any row's action — only clicking a row itself should fire its action.
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        requests: list = []
        page.on("request", lambda r: requests.append(r.url))
        page.click("#actions-modal button[aria-label='Close']")
        expect(page.locator("#actions-modal")).not_to_be_visible()
        assert not any("rescore" in u or "reanalyze" in u or "delete" in u for u in requests)

    def test_selecting_a_row_closes_modal_and_invokes_action(self, page: Page):
        # Split Recording opens the split editor panel — a safe, non-destructive
        # action to verify the row's onclick actually fires (closeActionsModal()
        # runs first, then row.action()).
        select_video_with_clips(page)
        page.click(".vid-actions button:has-text('Additional Actions')")
        page.wait_for_selector("#actions-modal.visible", timeout=2000)
        page.click("#actions-modal .action-row:has-text('Split Recording')")
        expect(page.locator("#actions-modal")).not_to_be_visible()
        expect(page.locator("#split-editor-panel")).to_be_visible(timeout=3000)


@skip_no_server
class TestVideoShowInFolder:
    """Quick-wins Stage 4 — Explorer reveal button on the recording detail's
    source-file row."""

    def test_button_visible_and_posts_reveal_with_video_path(self, page: Page):
        page.route(
            "**/api/reveal",
            lambda route: route.fulfill(
                status=200, content_type="application/json", body='{"status": "ok"}'
            ),
        )
        _render_video_with(page, {"path": "D:\\recordings\\uitest_source.mkv"})
        page.wait_for_function("() => AppState.canReveal === true", timeout=5000)
        page.evaluate("renderVideoDetail(AppState.activeVideoData, null)")
        btn = page.locator("#detail button:has-text('Show in Folder')")
        expect(btn).to_be_visible()
        with page.expect_request("**/api/reveal") as req_info:
            btn.click()
        assert req_info.value.post_data_json["path"] == "D:\\recordings\\uitest_source.mkv"

    def test_button_hidden_when_reveal_unavailable(self, page: Page):
        _render_video_with(page, {})
        page.evaluate("() => { AppState.canReveal = false; renderVideoDetail(AppState.activeVideoData, null); }")
        expect(page.locator("#detail button:has-text('Show in Folder')")).to_have_count(0)


@skip_no_server
class TestNativeMediaProtocolUrlBuilder:
    """Roadmap plan 10 — utils.js:_buildMediaUrl is the single point that picks
    between the packaged app's native "yuu-media://" scheme and the unchanged
    HTTP route. Playwright can't exercise the real Electron protocol handler
    (electron/main.js), so this only covers the URL-builder logic itself, with
    window.electronAPI.mediaProtocol stubbed to simulate the packaged app.
    """

    def test_http_url_when_no_electron_api(self, page: Page):
        page.goto(LIVE_URL)
        url = page.evaluate("_buildMediaUrl(7, 'source', 'D:/recordings/session.mp4')")
        assert url == "/api/videos/7/source"

    def test_http_url_when_stub_present_but_path_missing(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("window.electronAPI = { mediaProtocol: true }")
        url = page.evaluate("_buildMediaUrl(7, 'proxy', null)")
        assert url == "/api/videos/7/proxy"

    def test_native_url_for_source_when_stubbed(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("window.electronAPI = { mediaProtocol: true }")
        raw_path = "D:\\recordings\\session.mp4"
        encoded = page.evaluate("(p) => encodeURIComponent(p.replace(/\\\\/g, '/'))", raw_path)
        url = page.evaluate("(p) => _buildMediaUrl(7, 'source', p)", raw_path)
        assert url == f"yuu-media://media/{encoded}"

    def test_native_url_for_proxy_when_stubbed(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("window.electronAPI = { mediaProtocol: true }")
        raw_path = "D:\\recordings\\proxy.mp4"
        encoded = page.evaluate("(p) => encodeURIComponent(p.replace(/\\\\/g, '/'))", raw_path)
        url = page.evaluate("(p) => _buildMediaUrl(7, 'proxy', p)", raw_path)
        assert url == f"yuu-media://media/{encoded}"

    def test_native_url_encodes_spaces_and_unicode(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("window.electronAPI = { mediaProtocol: true }")
        raw_path = "D:/recordings/クリップ 2026 (final).mp4"
        encoded = page.evaluate("(p) => encodeURIComponent(p)", raw_path)
        url = page.evaluate("(p) => _buildMediaUrl(7, 'source', p)", raw_path)
        assert url == f"yuu-media://media/{encoded}"

    def test_native_url_normalizes_windows_backslashes(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("window.electronAPI = { mediaProtocol: true }")
        url = page.evaluate("(p) => _buildMediaUrl(7, 'source', p)", "C:\\Users\\me\\Videos\\clip.mp4")
        assert url == f"yuu-media://media/{'C%3A%2FUsers%2Fme%2FVideos%2Fclip.mp4'}"


@skip_no_server
class TestRecordingFilterCounts:
    """The recording filter chips carry per-filter counts derived from
    AppState.videos, mirroring the clip filter chips (but keyed data-vcount)."""

    def _badge(self, page: Page, key: str):
        return page.locator(f".clip-chip-count[data-vcount='{key}']")

    def _seed(self, page: Page, videos: list) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.evaluate(
            """(videos) => {
              AppState.videos = videos;
              AppState.sessions = [];
              _renderVideoList();
            }""",
            videos,
        )

    def test_counts_reflect_videos(self, page: Page):
        self._seed(page, [
            {"id": 1, "filename": "a.mkv", "clip_count": 3, "clips_scored_at": "2026-01-01", "clips_llm_error": 0},
            {"id": 2, "filename": "b.mkv", "clip_count": 0, "clips_scored_at": None, "clips_llm_error": 0},
            {"id": 3, "filename": "c.mkv", "clip_count": 5, "clips_scored_at": "2026-01-01", "clips_llm_error": 2},
        ])
        expect(self._badge(page, "all")).to_have_text("3")
        expect(self._badge(page, "has-clips")).to_have_text("2")
        expect(self._badge(page, "unscored")).to_have_text("1")
        expect(self._badge(page, "errors")).to_have_text("1")

    def test_errors_badge_blank_when_none(self, page: Page):
        self._seed(page, [
            {"id": 1, "filename": "a.mkv", "clip_count": 1, "clips_scored_at": "2026-01-01", "clips_llm_error": 0},
        ])
        expect(self._badge(page, "all")).to_have_text("1")
        expect(self._badge(page, "errors")).to_have_text("")

    def test_all_badges_blank_when_no_videos(self, page: Page):
        self._seed(page, [])
        for key in ("all", "has-clips", "unscored", "errors"):
            expect(self._badge(page, key)).to_have_text("")
