"""
Playwright UI tests — Electron setup wizard (electron/setup.html).

The wizard normally runs inside Electron with `window.setupAPI` injected by
setup-preload.js. Here the page is loaded over file:// with a mocked setupAPI
(installed via add_init_script before the page's scripts run), which lets the
whole renderer side be exercised — section layout, backend panel switching,
inline warnings, install/pull error retry, and the per-mode footer wiring —
without launching Electron or touching a real venv/registry.

Main-process behavior (PATH refresh, pip installs, schema-version re-show) is
not covered here; it lives in electron/main.js and has no test harness.

The shared `page` fixture navigates to the live server first (and these tests
run as part of test-ui.ps1), so the live-server skip still applies.
"""
from __future__ import annotations

from pathlib import Path

from conftest import skip_no_server
from playwright.sync_api import Page, expect

WIZARD_URI = (Path(__file__).resolve().parent.parent / "electron" / "setup.html").as_uri()

_MOCK_API = """
window.__events = { opened: [], installed: [] };
window.setupAPI = {
  getStatus:         async () => window.__mockStatus,
  pullModel:         (m)  => { window.__events.pulled = m; },
  onPullProgress:    (cb) => { window.__pullCb = cb; },
  installPackage:    (s)  => { window.__events.installed.push(s); },
  onInstallProgress: (cb) => { window.__installCb = cb; },
  onGgufDownloadProgress: (cb) => { window.__ggufCb = cb; },
  restartApp:        ()   => { window.__events.restarted = true; },
  openURL:           (u)  => { window.__events.opened.push(u); },
  copyText:          ()   => {},
  pickFolder:        async () => null,
  pickFile:          async () => null,
  complete:          (cfg) => { window.__events.completed = cfg; },
  quit:              ()   => { window.__events.quit = true; },
  close:             ()   => { window.__events.closed = true; },
  skip:              ()   => { window.__events.skipped = true; },
};
window.__mockStatus = {
  ffmpegOk: true,
  gpu: { name: 'NVIDIA GeForce RTX 3080', vramMB: 10240, vendor: 'nvidia' },
  cuda: { available: true, version: '12.4' },
  ollamaRunning: false, ollamaModel: 'qwen2.5:7b', ollamaModelPulled: false,
  llamacppInstalled: false,
  recommendedWhisper: { model: 'large-v3', reason: '10 GB+ VRAM' },
  projectDir: 'C:/Users/test/Videos/yuu-clip',
  llmBackend: 'ollama', llmModelPath: '',
  claudeApiKey: '', claudeModel: 'claude-haiku-4-5-20251001',
  whisperLanguage: '',
  contentPreset: 'generic',
};
"""


def _open_wizard(page: Page, status_overrides: str = "", query: str = "") -> None:
    page.add_init_script(_MOCK_API)
    if status_overrides:
        page.add_init_script(f"Object.assign(window.__mockStatus, {status_overrides});")
    page.goto(WIZARD_URI + query)
    page.wait_for_selector("#sections", state="visible")


@skip_no_server
class TestWizardLayout:
    def test_sections_ordered_required_llm_optional_basics(self, page: Page):
        _open_wizard(page)
        titles = page.eval_on_selector_all(
            ".sec-title", "els => els.map(e => e.textContent.trim())"
        )
        assert titles[0] == "Required"
        assert titles[1].startswith("LLM scoring")
        assert "choose one" in titles[1]
        assert titles[2] == "Content type"
        assert titles[3] == "Optional"
        assert titles[4] == "Basics"

    def test_launch_enabled_when_ffmpeg_ok(self, page: Page):
        _open_wizard(page)
        expect(page.locator("#launch-btn")).to_be_enabled()
        expect(page.locator("#item-ffmpeg")).to_have_class("item ok")

    def test_ffmpeg_missing_blocks_launch_with_hint_and_recheck(self, page: Page):
        _open_wizard(page, "{ ffmpegOk: false }")
        expect(page.locator("#launch-btn")).to_be_disabled()
        expect(page.locator("#launch-hint")).to_contain_text("FFmpeg is required")
        expect(page.locator("#item-ffmpeg")).to_have_class("item err")
        expect(page.locator("#recheck-btn")).to_be_visible()
        expect(page.locator("#restart-btn")).to_be_visible()

    def test_language_select_has_auto_detect_first_and_full_list(self, page: Page):
        _open_wizard(page)
        first = page.locator("#whisper-lang-sel option").first
        expect(first).to_have_text("Auto-detect (recommended)")
        assert first.get_attribute("value") == ""
        assert page.locator("#whisper-lang-sel option").count() > 50

    def test_cuda_missing_shows_optional_acceleration_row(self, page: Page):
        _open_wizard(page, "{ cuda: { available: false, version: null } }")
        expect(page.locator("#item-cuda")).to_be_visible()
        expect(page.locator("#gpu-line")).to_contain_text("CUDA not found")


@skip_no_server
class TestWizardLlmBackends:
    def test_default_backend_panel_matches_status(self, page: Page):
        _open_wizard(page)
        expect(page.locator("#llm-ollama-fields")).to_be_visible()
        expect(page.locator("#llm-llamacpp-fields")).to_be_hidden()
        expect(page.locator("#llm-claude-fields")).to_be_hidden()

    def test_llamacpp_panel_guides_install_and_gguf_download(self, page: Page):
        _open_wizard(page)
        page.select_option("#llm-backend-sel", "llamacpp")
        expect(page.locator("#llm-llamacpp-fields")).to_be_visible()
        expect(page.locator("#install-btn-llamacpp")).to_be_visible()
        # Recommends an Apache-2.0 model (Qwen2.5) — Llama is licence-excluded
        # from recommendations (see model_catalog.py).
        expect(page.locator("#llm-llamacpp-fields")).to_contain_text("Qwen2.5 7B Instruct")
        expect(page.locator("#llm-warn")).to_be_visible()  # no .gguf chosen yet
        page.fill("#llm-model-path", "C:/models/model.gguf")
        expect(page.locator("#llm-warn")).to_be_hidden()

    def test_claude_panel_warns_until_key_entered(self, page: Page):
        _open_wizard(page)
        page.select_option("#ai-privacy-sel", "remote_ok")  # claude backend is hidden in local-only mode
        page.select_option("#llm-backend-sel", "claude")
        expect(page.locator("#claude-warn")).to_be_visible()
        page.fill("#claude-api-key", "sk-ant-test")
        expect(page.locator("#claude-warn")).to_be_hidden()

    def test_install_error_reenables_button_for_retry(self, page: Page):
        _open_wizard(page)
        page.select_option("#llm-backend-sel", "llamacpp")
        page.click("#install-btn-llamacpp")
        expect(page.locator("#install-btn-llamacpp")).to_be_disabled()
        page.evaluate("window.__installCb({ slug: 'llamacpp', error: 'boom' })")
        expect(page.locator("#install-btn-llamacpp")).to_be_enabled()
        expect(page.locator("#install-msg-llamacpp")).to_contain_text("Install failed")

    def test_pull_error_reenables_button_for_retry(self, page: Page):
        _open_wizard(page, "{ ollamaRunning: true, ollamaModelPulled: false }")
        page.click("#pull-btn")
        expect(page.locator("#pull-btn")).to_be_disabled()
        page.evaluate("window.__pullCb({ error: 'connection lost' })")
        expect(page.locator("#pull-btn")).to_be_enabled()
        expect(page.locator("#pull-msg")).to_contain_text("Download failed")


@skip_no_server
class TestWizardModes:
    def test_launch_collects_full_config(self, page: Page):
        _open_wizard(page)
        page.select_option("#whisper-lang-sel", "de")
        page.select_option("#content-preset-sel", "podcast")
        page.click("#launch-btn")
        completed = page.evaluate("window.__events.completed")
        assert completed["whisperModel"] == "large-v3"
        assert completed["whisperLanguage"] == "de"
        assert completed["llmBackend"] == "ollama"
        assert completed["contentPreset"] == "podcast"
        assert completed["projectDir"] == "C:/Users/test/Videos/yuu-clip"

    def test_rerun_mode_close_discards_without_saving(self, page: Page):
        _open_wizard(page, query="?mode=rerun")
        expect(page.locator("#quit-btn")).to_have_text("Close")
        expect(page.locator("#launch-btn")).to_have_text("Apply & Close")
        page.click("#quit-btn")
        events = page.evaluate("window.__events")
        assert events.get("closed") is True
        assert "completed" not in events

    def test_update_mode_offers_skip_and_explains_why(self, page: Page):
        _open_wizard(page, query="?mode=update")
        expect(page.locator("#subtitle")).to_contain_text("new setup options")
        expect(page.locator("#quit-btn")).to_have_text("Skip for now")
        page.click("#quit-btn")
        assert page.evaluate("window.__events.skipped") is True
