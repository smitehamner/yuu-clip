"""
Playwright UI tests - Settings panel: transcription language select.

The select's options are populated at panel-open time from
GET /api/config/whisper-languages (single-sourced from ALLOWED_WHISPER_LANGUAGES
in config.py) and rendered as English names via Intl.DisplayNames.

Read-only by design: saving whisper_language goes through PATCH /api/config,
which is covered by tests/test_config.py - clicking Save here would write the
live project's real config.json.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page, expect


@skip_no_server
class TestTranscriptionLanguageSelect:
    def _open_settings(self, page: Page) -> None:
        # Re-navigate so each test starts from a fresh page load (the fixture's
        # init script keeps the Getting Started modal from auto-opening).
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.querySelectorAll('#s-whisper-language option').length > 1",
            timeout=3000,
        )
        # The language options are populated (above) *before* openSettings()'s
        # _applySettingsToUI runs - that later call resets #s-whisper-language to
        # the saved value and takes the dirty snapshot. Interacting between those
        # two steps lets the async apply overwrite the test's selection and
        # re-snapshot, leaving Save disabled. #s-paths-display is populated last,
        # after the snapshot, so waiting on it means the panel is fully settled.
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )

    def test_first_option_is_auto_detect_with_empty_value(self, page: Page):
        self._open_settings(page)
        first = page.locator("#s-whisper-language option").first
        expect(first).to_have_text("Auto-detect (recommended)")
        assert first.get_attribute("value") == ""

    def test_options_populated_from_language_endpoint(self, page: Page):
        self._open_settings(page)
        option_count = page.locator("#s-whisper-language option").count()
        endpoint_count = page.evaluate(
            "() => fetch('/api/config/whisper-languages')"
            "  .then(r => r.json()).then(d => d.languages.length)"
        )
        assert option_count == endpoint_count + 1  # + Auto-detect

    def test_options_render_display_names_not_codes(self, page: Page):
        self._open_settings(page)
        values = page.eval_on_selector_all(
            "#s-whisper-language option",
            "els => els.map(e => [e.value, e.textContent])",
        )
        by_code = dict(values)
        assert by_code.get("en") == "English"
        assert by_code.get("de") == "German"

    def test_select_reflects_saved_config_value(self, page: Page):
        self._open_settings(page)
        saved = page.evaluate(
            "() => fetch('/api/config').then(r => r.json())"
            "  .then(d => d.whisper_language || '')"
        )
        assert page.locator("#s-whisper-language").input_value() == saved

    def test_changing_language_marks_settings_dirty(self, page: Page):
        self._open_settings(page)
        expect(page.locator("#btn-settings-save")).to_be_disabled()
        current = page.locator("#s-whisper-language").input_value()
        page.select_option("#s-whisper-language", "de" if current != "de" else "fr")
        expect(page.locator("#btn-settings-save")).to_be_enabled()
        # Restore so the panel isn't left dirty for later tests.
        page.select_option("#s-whisper-language", current)
        expect(page.locator("#btn-settings-save")).to_be_disabled()


@skip_no_server
class TestAiPrivacyMode:
    """The AI privacy radios (plan non-llm-tiers/07). Read-only: these manipulate the
    live DOM (radios, visibility) but never click Save - that would PATCH the real
    config.json. Each test starts from a fresh page.goto so nothing persists."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )
        # The AI-privacy radios and the LLM-engine select now live under the
        # "Advanced AI options" disclosure (UX review) - expand it so tests can
        # interact with those controls.
        page.evaluate("document.getElementById('s-llm-advanced').open = true")

    def test_three_privacy_radios_render(self, page: Page):
        self._open_settings(page)
        values = page.eval_on_selector_all(
            "input[name='s-ai-privacy']", "els => els.map(e => e.value)"
        )
        assert values == ["none", "local_only", "remote_ok"]

    def test_local_only_hides_claude_backend_option(self, page: Page):
        self._open_settings(page)
        page.check("input[name='s-ai-privacy'][value='local_only']")
        hidden = page.eval_on_selector(
            "#s-llm-backend option[value='claude']", "el => el.hidden"
        )
        assert hidden is True

    def test_remote_ok_shows_claude_backend_option(self, page: Page):
        self._open_settings(page)
        page.check("input[name='s-ai-privacy'][value='remote_ok']")
        hidden = page.eval_on_selector(
            "#s-llm-backend option[value='claude']", "el => el.hidden"
        )
        assert hidden is False

    def test_none_collapses_generative_block(self, page: Page):
        self._open_settings(page)
        page.check("input[name='s-ai-privacy'][value='none']")
        expect(page.locator("#s-llm-generative-block")).to_be_hidden()
        expect(page.locator("#s-privacy-none-summary")).to_be_visible()

    def test_local_only_shows_generative_block(self, page: Page):
        self._open_settings(page)
        page.check("input[name='s-ai-privacy'][value='local_only']")
        expect(page.locator("#s-llm-generative-block")).to_be_visible()
        expect(page.locator("#s-privacy-none-summary")).to_be_hidden()


@skip_no_server
class TestLlamaCppTextVisionGroups:
    """Settings -> LLM scoring restructured the llamacpp path fields into a
    Text model group and a Vision model group (per-function-llm-models plan) -
    the vision model path is independent from the text model path. Read-only:
    never clicks Save, so nothing persists to the live project's config.json."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )
        page.evaluate("document.getElementById('s-llm-advanced').open = true")

    def test_both_groups_render_with_expected_fields(self, page: Page):
        self._open_settings(page)
        expect(page.locator("#s-llm-model-path")).to_be_visible()
        expect(page.locator("#s-llm-vision-model-path")).to_be_visible()
        expect(page.locator("#s-llm-mmproj-path")).to_be_visible()

    def test_vision_model_field_loads_saved_config_value(self, page: Page):
        self._open_settings(page)
        saved = page.evaluate(
            "() => fetch('/api/config').then(r => r.json())"
            "  .then(d => d.llm_vision_model_path || '')"
        )
        assert page.locator("#s-llm-vision-model-path").input_value() == saved

    def test_editing_vision_model_path_does_not_change_text_model_path(self, page: Page):
        self._open_settings(page)
        text_before = page.locator("#s-llm-model-path").input_value()
        page.fill("#s-llm-vision-model-path", "C:\\models\\vision-only.gguf")
        assert page.locator("#s-llm-model-path").input_value() == text_before

    def test_text_only_config_shows_empty_vision_field(self, page: Page):
        self._open_settings(page)
        vision_configured = page.evaluate(
            "() => fetch('/api/config').then(r => r.json())"
            "  .then(d => Boolean(d.llm_vision_model_path))"
        )
        if not vision_configured:
            assert page.locator("#s-llm-vision-model-path").input_value() == ""

    def test_custom_model_licence_note_warns_about_monetization(self, page: Page):
        # Non-developer users load custom models without thinking about licensing;
        # the note steers them to check commercial-use terms before monetizing clips.
        self._open_settings(page)
        note = page.locator("#s-custom-model-licence-note")
        expect(note).to_be_visible()
        expect(note).to_contain_text("licence")
        expect(note).to_contain_text("commercial use")


@skip_no_server
class TestSettingsPanelLayout:
    """Settings takes over the detail area as a fixed overlay but leaves the
    sidebar visible, and opening the Analyze panel closes settings (no overlap)."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)

    def test_sidebar_stays_visible_when_settings_open(self, page: Page):
        self._open_settings(page)
        expect(page.locator(".sidebar")).to_be_visible()
        # The main layout is no longer hidden - settings is an overlay, not fullscreen.
        display = page.evaluate(
            "getComputedStyle(document.getElementById('main-layout')).display"
        )
        assert display != "none"

    def test_opening_analyze_closes_settings(self, page: Page):
        self._open_settings(page)
        page.click("#btn-analyze")
        expect(page.locator("#settings-panel.visible")).to_have_count(0)
        expect(page.locator("#new-recording-panel")).to_be_visible()


@skip_no_server
class TestSettingsPanelChrome:
    """Sticky header with Save + section jump links, weight reset, secret-field
    toggles, and the LLM master-toggle dim (UX review iteration 7).

    None of these tests click Save - that would PATCH the live project's real
    config.json. Pending UI changes are discarded by the fresh page.goto each
    test starts with.
    """

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        # openSettings() fetches and applies config async after the panel is
        # already visible - interacting earlier gets overwritten by
        # _applySettingsToUI. The paths display is rendered last, so its
        # content signals the panel is fully initialized.
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )
        # The Capabilities tiers render from a *separate* async fetch
        # (/api/capabilities/tiers) into a section above Paths. If that lands
        # after we've asserted scrollTop, its reflow trips Chrome scroll
        # anchoring and shifts the panel - wait for it to settle too.
        page.wait_for_function(
            "document.getElementById('s-capabilities-list').children.length > 0",
            timeout=3000,
        )

    def test_header_is_sticky_and_holds_save(self, page: Page):
        self._open_settings(page)
        position = page.evaluate(
            "getComputedStyle(document.querySelector('#settings-panel .settings-header')).position"
        )
        assert position == "sticky"
        expect(
            page.locator("#settings-panel .settings-header #btn-settings-save")
        ).to_be_visible()

    def test_jump_link_scrolls_its_section_into_view(self, page: Page):
        self._open_settings(page)
        assert page.evaluate("document.getElementById('settings-panel').scrollTop") == 0
        page.click(".settings-jump-link:has-text('Paths')")
        page.wait_for_function(
            "document.getElementById('settings-panel').scrollTop > 0", timeout=3000
        )
        expect(page.locator("#settings-sec-paths")).to_be_in_viewport()

    def test_speech_to_text_section_leads_with_plain_term(self, page: Page):
        self._open_settings(page)
        # The title holds a "Reset to defaults" action button alongside the
        # label span; assert on the label span, not the whole title node.
        expect(
            page.locator("#settings-sec-stt .settings-section-title > span").first
        ).to_have_text("Speech-to-text (Whisper)")

    def test_reset_restores_default_weights(self, page: Page):
        self._open_settings(page)
        page.locator("#s-energy-weight").fill("4.2")
        page.locator("#s-energy-weight").dispatch_event("input")
        page.click("#btn-reset-weights")
        defaults = {
            "s-energy-weight": "1.0", "s-scene-weight": "0.5",
            "s-llm-weight": "2.0", "s-laugh-weight": "1.5",
            "s-lexicon-weight": "1.0",
            "s-speech-rate-weight": "0.5", "s-churn-weight": "0.5",
            "s-prosody-weight": "0.5",
            "s-funny-weight": "1.0", "s-dramatic-weight": "1.0",
            "s-action-weight": "1.0",
        }
        for field_id, default in defaults.items():
            # Range inputs normalize "1.0" to "1" - compare numerically.
            assert float(page.locator(f"#{field_id}").input_value()) == float(default)
            expect(page.locator(f"#{field_id}-val")).to_have_text(default)

    def test_llm_section_body_dims_when_master_toggle_off(self, page: Page):
        self._open_settings(page)
        page.uncheck("#s-llm-enabled")
        expect(page.locator("#s-llm-body")).to_have_class("settings-dimmed")
        assert page.evaluate("document.getElementById('s-llm-body').inert") is True
        page.check("#s-llm-enabled")
        assert page.evaluate("document.getElementById('s-llm-body').inert") is False
        assert page.evaluate(
            "document.getElementById('s-llm-body').classList.contains('settings-dimmed')"
        ) is False

    def test_similarity_selector_visible_with_llm_disabled(self, page: Page):
        # The keyword/embeddings tiers work with LLM scoring off, so the selector
        # lives outside #s-llm-body and must stay interactive when the master
        # toggle is off.
        self._open_settings(page)
        page.uncheck("#s-llm-enabled")
        selector = page.locator("#s-similarity-backend")
        expect(selector).to_be_visible()
        assert page.evaluate("document.getElementById('s-similarity-backend').disabled") is False

    def test_similarity_embeddings_fields_toggle_on_smart_tier(self, page: Page):
        # fastembed is bundled by default (packaging-strategy overhaul) - no install
        # button anymore, just an info note about the model download.
        self._open_settings(page)
        page.select_option("#s-similarity-backend", "tfidf")
        expect(page.locator("#s-similarity-embeddings-fields")).to_be_hidden()
        page.select_option("#s-similarity-backend", "embeddings")
        expect(page.locator("#s-similarity-embeddings-fields")).to_be_visible()

    def test_claude_api_key_has_show_hide_toggle(self, page: Page):
        self._open_settings(page)
        # The engine select lives under "Advanced AI options" (UX review) - expand it.
        page.evaluate("document.getElementById('s-llm-advanced').open = true")
        page.evaluate("() => _setPrivacyMode('remote_ok')")
        page.select_option("#s-llm-backend", "claude")
        key_input = page.locator("#s-claude-api-key")
        expect(key_input).to_be_visible()
        assert key_input.get_attribute("type") == "password"
        page.click("#btn-toggle-claude-key")
        assert key_input.get_attribute("type") == "text"
        expect(page.locator("#btn-toggle-claude-key")).to_have_text("Hide")
        page.click("#btn-toggle-claude-key")
        assert key_input.get_attribute("type") == "password"


# ---------------------------------------------------------------------------
# Capabilities overview - the tiered "lightweight mode" story (Stage 06)
# ---------------------------------------------------------------------------

@skip_no_server
class TestCapabilitiesSection:
    """The Capabilities section renders one row per non-LLM upgrade tier from
    /api/capabilities/tiers. Read-only - never clicks Save."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        # The tier rows are rendered async by _renderCapabilityTiers during
        # _applySettingsToUI; wait for them rather than racing the fetch.
        page.wait_for_function(
            "document.querySelectorAll('#s-capabilities-list .capability-tier').length === 5",
            timeout=3000,
        )

    def test_renders_five_tier_rows_with_intro(self, page: Page):
        # packaging-strategy overhaul (Wave 3): Speaker labels and Vertical
        # auto-framing joined the overview once their install buttons were
        # replaced by Ready / "fetches on first use" status here.
        self._open_settings(page)
        expect(page.locator("#s-capabilities-list .capability-tier")).to_have_count(5)
        names = page.eval_on_selector_all(
            "#s-capabilities-list .capability-tier-name",
            "els => els.map(e => e.textContent)",
        )
        assert names == [
            "Similarity engine", "Descriptions & summaries", "Speaker labels",
            "Audio-event detection", "Auto-frame on faces",
        ]
        assert page.locator("#s-capabilities-intro").inner_text().strip() != ""

    def test_jump_link_scrolls_to_capabilities(self, page: Page):
        self._open_settings(page)
        page.click(".settings-jump-link:has-text('Capabilities')")
        expect(page.locator("#settings-sec-capabilities")).to_be_in_viewport()


# ---------------------------------------------------------------------------
# Export filename template - live preview (quick-wins Stage 8)
# ---------------------------------------------------------------------------

@skip_no_server
class TestExportNameTemplatePreview:
    """Preview line is pure client-side (utils.js's _updateExportNameTemplatePreview) -
    never clicks Save, which would write the live project's real config.json."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_selector("#s-export-name-template", timeout=3000)
        # openSettings() applies the fetched config (which resets the template
        # field and re-renders the preview) asynchronously after the panel is
        # visible, and populates #s-paths-display last. Wait for that to finish,
        # or the async apply races the test's fill and overwrites it.
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )

    def test_preview_shows_rendered_default_template(self, page: Page):
        self._open_settings(page)
        expect(page.locator("#export-name-template-preview")).to_contain_text(
            "Preview: MyRecording_clip42_15-30.mkv"
        )

    def test_preview_updates_on_input(self, page: Page):
        self._open_settings(page)
        page.fill("#s-export-name-template", "{date}_{video}_{clip_id}")
        page.locator("#s-export-name-template").dispatch_event("input")
        expect(page.locator("#export-name-template-preview")).to_contain_text("_MyRecording_42.mkv")

    def test_preview_flags_unknown_placeholder(self, page: Page):
        self._open_settings(page)
        page.fill("#s-export-name-template", "{bogus}")
        page.locator("#s-export-name-template").dispatch_event("input")
        expect(page.locator("#export-name-template-preview")).to_contain_text("unknown placeholder")


# ---------------------------------------------------------------------------
# Title card customization - colors, size, layout, duration, preview, contrast
# warning (roadmap plan 09)
# ---------------------------------------------------------------------------

@skip_no_server
class TestTitleCardSettings:
    """Never clicks Save - that would PATCH the live project's real config.json."""

    def _open_settings(self, page: Page) -> None:
        # openSettings() fetches and applies config async after the panel is
        # already visible (see TestSettingsPanelChrome) - the paths display is
        # rendered last, so waiting on it means _applySettingsToUI (which would
        # otherwise overwrite an early fill with the fetched config value) has
        # already run.
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )

    def test_fields_render_with_saved_config_values(self, page: Page):
        self._open_settings(page)
        cfg = page.evaluate("() => fetch('/api/config').then(r => r.json())")
        assert page.locator("#s-title-card-bg-color").input_value() == cfg["title_card_bg_color"]
        assert page.locator("#s-title-card-font-color").input_value() == cfg["title_card_font_color"]
        assert float(page.locator("#s-title-card-scale").input_value()) == cfg["title_card_scale"]
        assert page.locator("#s-title-card-template").input_value() == cfg["title_card_template"]
        assert float(page.locator("#s-title-card-duration").input_value()) == cfg["title_card_duration_s"]

    def test_changing_bg_color_marks_settings_dirty(self, page: Page):
        self._open_settings(page)
        expect(page.locator("#btn-settings-save")).to_be_disabled()
        current = page.locator("#s-title-card-bg-color").input_value()
        other = "#123456" if current != "#123456" else "#654321"
        page.locator("#s-title-card-bg-color").fill(other)
        page.locator("#s-title-card-bg-color").dispatch_event("input")
        expect(page.locator("#btn-settings-save")).to_be_enabled()
        # Restore so the panel isn't left dirty for later tests.
        page.locator("#s-title-card-bg-color").fill(current)
        page.locator("#s-title-card-bg-color").dispatch_event("input")
        expect(page.locator("#btn-settings-save")).to_be_disabled()

    def test_preview_reflects_chosen_background_color(self, page: Page):
        self._open_settings(page)
        page.locator("#s-title-card-bg-color").fill("#336699")
        page.locator("#s-title-card-bg-color").dispatch_event("input")
        bg = page.evaluate(
            "getComputedStyle(document.getElementById('s-title-card-preview')).backgroundColor"
        )
        assert bg == "rgb(51, 102, 153)"  # #336699

    def test_preview_reflects_chosen_text_color(self, page: Page):
        self._open_settings(page)
        page.locator("#s-title-card-font-color").fill("#ff8800")
        page.locator("#s-title-card-font-color").dispatch_event("input")
        color = page.evaluate(
            "getComputedStyle(document.querySelector('#s-title-card-preview > div')).color"
        )
        assert color == "rgb(255, 136, 0)"  # #ff8800

    def test_template_renders_one_line_per_nonempty_line(self, page: Page):
        self._open_settings(page)
        page.fill("#s-title-card-template", "{start} · {duration}")
        page.locator("#s-title-card-template").dispatch_event("input")
        count = page.evaluate("document.querySelectorAll('#s-title-card-preview > div').length")
        assert count == 1
        assert "2:15" in page.locator("#s-title-card-preview").inner_text()

    def test_default_template_renders_description_and_timecode(self, page: Page):
        self._open_settings(page)
        page.fill("#s-title-card-template", "{description}\n{start} · {duration}")
        page.locator("#s-title-card-template").dispatch_event("input")
        count = page.evaluate("document.querySelectorAll('#s-title-card-preview > div').length")
        assert count == 2

    def test_unknown_placeholder_shows_warning(self, page: Page):
        self._open_settings(page)
        expect(page.locator("#s-title-card-template-warning")).to_be_hidden()
        page.fill("#s-title-card-template", "{description} {bogus}")
        page.locator("#s-title-card-template").dispatch_event("input")
        expect(page.locator("#s-title-card-template-warning")).to_be_visible()

    def test_contrast_warning_appears_for_white_on_white(self, page: Page):
        self._open_settings(page)
        page.locator("#s-title-card-bg-color").fill("#ffffff")
        page.locator("#s-title-card-bg-color").dispatch_event("input")
        page.locator("#s-title-card-font-color").fill("#ffffff")
        page.locator("#s-title-card-font-color").dispatch_event("input")
        expect(page.locator("#s-title-card-contrast-warning")).to_be_visible()

    def test_contrast_warning_hidden_for_default_black_on_white(self, page: Page):
        self._open_settings(page)
        page.locator("#s-title-card-bg-color").fill("#000000")
        page.locator("#s-title-card-bg-color").dispatch_event("input")
        page.locator("#s-title-card-font-color").fill("#ffffff")
        page.locator("#s-title-card-font-color").dispatch_event("input")
        expect(page.locator("#s-title-card-contrast-warning")).to_be_hidden()


@skip_no_server
class TestCaptionStyleSettings:
    """Never clicks Save - that would PATCH the live project's real config.json."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )

    def test_fields_render_with_saved_config_values(self, page: Page):
        self._open_settings(page)
        cfg = page.evaluate("() => fetch('/api/config').then(r => r.json())")
        expected_font = cfg["caption_font_name"] or ""
        expected_size = "" if not cfg["caption_font_size"] else str(cfg["caption_font_size"])
        assert page.locator("#s-caption-font-name").input_value() == expected_font
        assert page.locator("#s-caption-font-size").input_value() == expected_size
        assert page.locator("#s-caption-position").input_value() == cfg["caption_position"]

    def test_changing_position_marks_settings_dirty(self, page: Page):
        self._open_settings(page)
        expect(page.locator("#btn-settings-save")).to_be_disabled()
        current = page.locator("#s-caption-position").input_value()
        other = "top" if current != "top" else "bottom"
        page.locator("#s-caption-position").select_option(other)
        expect(page.locator("#btn-settings-save")).to_be_enabled()
        page.locator("#s-caption-position").select_option(current)
        expect(page.locator("#btn-settings-save")).to_be_disabled()


# ---------------------------------------------------------------------------
# Glossary modal - filter input (L9-3)
# ---------------------------------------------------------------------------

@skip_no_server
class TestGlossaryFilter:
    def _open_glossary(self, page: Page) -> None:
        page.evaluate("openGlossaryModal()")
        page.wait_for_selector("#glossary-modal.visible")
        page.wait_for_selector("#glossary-content .glossary-term", timeout=3000)

    def test_filter_narrows_to_matching_terms(self, page: Page):
        self._open_glossary(page)
        page.fill("#glossary-filter", "highlight reel")
        visible = page.eval_on_selector_all(
            "#glossary-content .glossary-term",
            "els => els.filter(e => e.style.display !== 'none').map(e => e.textContent)",
        )
        assert visible, "expected at least one matching term"
        assert all("highlight reel" in t.lower() for t in visible)
        hidden_sections = page.eval_on_selector_all(
            "#glossary-content .glossary-section",
            "els => els.filter(e => e.style.display === 'none').length",
        )
        assert hidden_sections > 0, "sections without matches should be hidden"
        page.evaluate("closeGlossaryModal()")

    def test_no_matches_message(self, page: Page):
        self._open_glossary(page)
        page.fill("#glossary-filter", "zzzz-no-such-term")
        expect(page.locator("#glossary-no-matches")).to_be_visible()
        page.fill("#glossary-filter", "")
        expect(page.locator("#glossary-no-matches")).not_to_be_visible()
        page.evaluate("closeGlossaryModal()")

    def test_escape_clears_filter_then_closes(self, page: Page):
        self._open_glossary(page)
        filter_input = page.locator("#glossary-filter")
        filter_input.focus()
        filter_input.fill("clip")
        page.keyboard.press("Escape")
        assert filter_input.input_value() == ""
        expect(page.locator("#glossary-modal")).to_be_visible()
        page.keyboard.press("Escape")
        page.wait_for_selector("#glossary-modal.visible", state="hidden")

    def test_reopen_resets_filter(self, page: Page):
        self._open_glossary(page)
        page.fill("#glossary-filter", "clip")
        page.evaluate("closeGlossaryModal()")
        self._open_glossary(page)
        assert page.locator("#glossary-filter").input_value() == ""
        visible_terms = page.eval_on_selector_all(
            "#glossary-content .glossary-term",
            "els => els.filter(e => e.style.display !== 'none').length",
        )
        all_terms = page.eval_on_selector_all("#glossary-content .glossary-term", "els => els.length")
        assert visible_terms == all_terms
        page.evaluate("closeGlossaryModal()")


# ---------------------------------------------------------------------------
# Hardware section - GPU thermal thresholds (roadmap-2026-07 plan 01, Stage 3)
#
# Only the rejected-patch test clicks Save - a failed cross-field validation
# is guaranteed by tests/test_config.py to leave the live config untouched, so
# it can't write bad values into the project's real config.json. Every other
# test here only inspects/dirties fields, same convention as
# TestSettingsPanelChrome above.
# ---------------------------------------------------------------------------

@skip_no_server
class TestHardwareSettingsSection:
    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )

    def test_jump_link_scrolls_hardware_section_into_view(self, page: Page):
        self._open_settings(page)
        page.click(".settings-jump-link:has-text('Hardware')")
        page.wait_for_function(
            "document.getElementById('settings-panel').scrollTop > 0", timeout=3000
        )
        expect(page.locator("#settings-sec-hardware")).to_be_in_viewport()

    def test_fields_prefilled_with_a_valid_warn_below_pause_pair(self, page: Page):
        self._open_settings(page)
        warn = float(page.eval_on_selector("#s-thermal-warn-c", "el => el.value"))
        pause = float(page.eval_on_selector("#s-thermal-pause-c", "el => el.value"))
        assert 40 <= warn < pause <= 110
        assert page.eval_on_selector("#s-thermal-autopause", "el => el.checked") in (True, False)

    def test_changing_warn_temp_marks_settings_dirty(self, page: Page):
        self._open_settings(page)
        page.fill("#s-thermal-warn-c", "70")
        expect(page.locator("#btn-settings-save")).to_be_enabled()

    def test_toggling_autopause_marks_settings_dirty(self, page: Page):
        self._open_settings(page)
        page.click("#s-thermal-autopause")
        expect(page.locator("#btn-settings-save")).to_be_enabled()

    def test_warn_at_or_above_pause_rejected_on_save(self, page: Page):
        self._open_settings(page)
        page.fill("#s-thermal-warn-c", "95")
        page.fill("#s-thermal-pause-c", "90")
        page.click("#btn-settings-save")
        expect(page.locator("#toast-container .toast.error")).to_contain_text("thermal_warn_c")


# ---------------------------------------------------------------------------
# Export presets - Plan 07 Stage 3. Custom presets live in *global* config (a
# user preference, not project data - see export_presets.py), so every test
# that creates one cleans it up via a direct DELETE in a ``finally`` block,
# mirroring the hot-word CRUD cleanup pattern in test_ui_hotwords.py.
# ---------------------------------------------------------------------------

def _delete_export_preset(page: Page, name) -> None:
    if not name:
        return
    page.evaluate("(name) => fetch(`/api/export-presets/${name}`, {method: 'DELETE'})", name)


def _create_export_preset(page: Page, label, container="mp4", crf=20, target_size_mb=None):
    return page.evaluate(
        """(args) => fetch('/api/export-presets', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(args),
        }).then(r => r.json())""",
        {"label": label, "container": container, "crf": crf, "target_size_mb": target_size_mb, "audio_kbps": 128},
    )


@skip_no_server
class TestExportPresetSettingsSection:
    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_selector("#s-export-preset-rows", timeout=3000)

    def test_builtin_presets_are_read_only(self, page: Page):
        self._open_settings(page)
        rows = page.locator("#s-export-preset-rows > div")
        labels = rows.all_inner_texts()
        assert any("YouTube 1080p" in t for t in labels)
        assert any("Discord" in t for t in labels)

    def test_seeded_custom_preset_row_renders_with_saved_values(self, page: Page):
        preset = _create_export_preset(page, "UI Test Preset", crf=22)
        try:
            self._open_settings(page)
            row = page.locator(f'[data-preset-row="{preset["name"]}"]')
            expect(row).to_be_visible()
            expect(row.locator(".ep-label")).to_have_value("UI Test Preset")
            expect(row.locator(".ep-crf")).to_have_value("22")
        finally:
            _delete_export_preset(page, preset.get("name"))

    def test_add_preset_button_appends_draft_row_without_persisting_it(self, page: Page):
        self._open_settings(page)
        before_rows = page.locator("[data-preset-row]").count()
        before_count = page.evaluate(
            "() => fetch('/api/export-presets').then(r => r.json()).then(d => d.custom.length)"
        )
        page.get_by_role("button", name="+ Add custom preset").click()
        expect(page.locator("[data-preset-row]")).to_have_count(before_rows + 1)
        # An empty draft (no label typed) must never reach the server.
        after_count = page.evaluate(
            "() => fetch('/api/export-presets').then(r => r.json()).then(d => d.custom.length)"
        )
        assert after_count == before_count

    def test_delete_button_removes_row(self, page: Page):
        preset = _create_export_preset(page, "UI Test Delete Me")
        deleted_via_ui = False
        try:
            self._open_settings(page)
            row = page.locator(f'[data-preset-row="{preset["name"]}"]')
            expect(row).to_be_visible()
            row.locator(".ep-delete").click()
            expect(row).to_have_count(0)
            deleted_via_ui = True
        finally:
            if not deleted_via_ui:
                _delete_export_preset(page, preset.get("name"))

    def test_switching_to_target_size_mode_disables_crf_input(self, page: Page):
        preset = _create_export_preset(page, "UI Test Mode Switch")
        try:
            self._open_settings(page)
            row = page.locator(f'[data-preset-row="{preset["name"]}"]')
            expect(row.locator(".ep-crf")).to_be_enabled()
            expect(row.locator(".ep-size")).to_be_disabled()
            row.locator(".ep-mode-size").check()
            expect(row.locator(".ep-crf")).to_be_disabled()
            expect(row.locator(".ep-size")).to_be_enabled()
        finally:
            _delete_export_preset(page, preset.get("name"))


@skip_no_server
class TestPlaybackSpeed:
    """A single global preference (yuuclip-playback-rate) drives playbackRate on
    every <video>: read via playbackRatePref, pushed to loaded videos by a
    capture-phase loadedmetadata listener and to live videos by applyPlaybackRate."""

    def test_pref_defaults_to_one(self, page: Page):
        page.goto(LIVE_URL)
        rate = page.evaluate(
            "() => { localStorage.removeItem('yuuclip-playback-rate'); return playbackRatePref(); }"
        )
        assert rate == 1

    def test_pref_reads_stored_value(self, page: Page):
        page.goto(LIVE_URL)
        rate = page.evaluate(
            """() => {
              localStorage.setItem('yuuclip-playback-rate', '1.5');
              const r = playbackRatePref();
              localStorage.removeItem('yuuclip-playback-rate');
              return r;
            }"""
        )
        assert rate == 1.5

    def test_apply_sets_rate_on_live_videos(self, page: Page):
        page.goto(LIVE_URL)
        rate = page.evaluate(
            """() => {
              const v = document.createElement('video');
              document.body.appendChild(v);
              applyPlaybackRate(1.25);
              const r = v.playbackRate;
              v.remove();
              return r;
            }"""
        )
        assert rate == 1.25

    def test_loaded_video_gets_saved_rate(self, page: Page):
        page.goto(LIVE_URL)
        rate = page.evaluate(
            """() => {
              localStorage.setItem('yuuclip-playback-rate', '2');
              const v = document.createElement('video');
              document.body.appendChild(v);
              v.dispatchEvent(new Event('loadedmetadata'));
              const r = v.playbackRate;
              v.remove();
              localStorage.removeItem('yuuclip-playback-rate');
              return r;
            }"""
        )
        assert rate == 2

    def test_settings_select_populates_from_storage(self, page: Page):
        page.goto(LIVE_URL)
        page.evaluate("() => localStorage.setItem('yuuclip-playback-rate', '1.75')")
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        expect(page.locator("#s-playback-rate")).to_have_value("1.75")
        page.evaluate("() => localStorage.removeItem('yuuclip-playback-rate')")


@skip_no_server
class TestResetToDefaults:
    """Per-section and whole-panel "Reset to defaults" stage factory defaults
    (GET /api/config/defaults) into the form and flag it dirty; nothing is saved
    until Save. Tests never click Save - that would overwrite the live config."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )

    def _set(self, page: Page, field_id: str, value: str) -> None:
        page.fill(f"#{field_id}", value)
        page.dispatch_event(f"#{field_id}", "input")

    def test_section_reset_restores_default_values(self, page: Page):
        self._open_settings(page)
        self._set(page, "s-silence-ms", "7500")
        self._set(page, "s-min-clip-ms", "40000")
        page.click("#settings-sec-analysis .settings-reset-btn")
        expect(page.locator("#s-silence-ms")).to_have_value("3000")
        expect(page.locator("#s-min-clip-ms")).to_have_value("15000")

    def test_section_reset_leaves_other_sections_untouched(self, page: Page):
        self._open_settings(page)
        self._set(page, "s-silence-ms", "7500")     # analysis
        self._set(page, "s-thermal-warn-c", "70")   # hardware
        page.click("#settings-sec-analysis .settings-reset-btn")
        expect(page.locator("#s-silence-ms")).to_have_value("3000")   # reverted
        expect(page.locator("#s-thermal-warn-c")).to_have_value("70")  # preserved

    def test_reset_all_restores_every_section(self, page: Page):
        self._open_settings(page)
        self._set(page, "s-silence-ms", "7500")     # analysis
        self._set(page, "s-thermal-warn-c", "70")   # hardware
        page.click("#btn-reset-all-settings")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        page.click("#confirm-ok-btn")
        expect(page.locator("#s-silence-ms")).to_have_value("3000")
        expect(page.locator("#s-thermal-warn-c")).to_have_value("85")

    def test_reset_all_cancel_keeps_current_values(self, page: Page):
        self._open_settings(page)
        self._set(page, "s-silence-ms", "7500")
        page.click("#btn-reset-all-settings")
        page.wait_for_selector("#confirm-modal.visible", timeout=2000)
        page.click("#confirm-cancel-btn")
        expect(page.locator("#s-silence-ms")).to_have_value("7500")


@skip_no_server
class TestSpeakerClusterThreshold:
    """The SpeechBrain-only 'Voice grouping' control (speaker_cluster_threshold),
    exposed so a user whose voice fragments into many speakers can tune it."""

    def _open_settings(self, page: Page) -> None:
        page.goto(LIVE_URL)
        page.wait_for_selector("#video-list li[data-video-id]", timeout=5000)
        page.click("#btn-settings-header")
        page.wait_for_selector("#settings-panel.visible", timeout=3000)
        page.wait_for_function(
            "document.getElementById('s-paths-display').textContent.trim().length > 0",
            timeout=3000,
        )

    def test_cluster_threshold_shown_for_speechbrain(self, page: Page):
        self._open_settings(page)
        page.evaluate("_onDiarizationBackendChange('speechbrain')")
        expect(page.locator("#s-speaker-cluster-threshold")).to_be_visible()
        expect(page.locator("#s-speaker-cluster-threshold")).to_have_value("0.55")

    def test_cluster_threshold_hidden_for_pyannote(self, page: Page):
        self._open_settings(page)
        page.evaluate("_onDiarizationBackendChange('pyannote')")
        expect(page.locator("#s-speaker-cluster-threshold")).to_be_hidden()
