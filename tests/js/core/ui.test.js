// _applyPrereqWarnings (static/core/ui.js) - the FFmpeg/LLM prerequisite banner.
// Ported from tests/ui/test_ui_modeldownload.py::TestPrereqRefreshAfterServerChange:
// it only reads/writes the static #prereq-banner, so happy-dom drives it directly.
// The download-resync fetch flow stays in Playwright.
import { _applyPrereqWarnings } from '../../../yuu_clip/web/static/core/ui.js';

const banner = () => document.getElementById('prereq-banner');

describe('_applyPrereqWarnings', () => {
  it('shows the banner when FFmpeg is missing', () => {
    _applyPrereqWarnings({ ffmpeg_ok: false, llm_ok: true, llm_reason: '' });
    expect(banner().style.display).not.toBe('none');
    expect(banner().textContent).toContain('FFmpeg not found');
  });

  it('clears a previously shown banner once prerequisites are satisfied', () => {
    _applyPrereqWarnings({ ffmpeg_ok: false, llm_ok: true, llm_reason: '' });
    expect(banner().style.display).not.toBe('none');
    // A satisfied re-check (refreshServerState after setup) must hide the stale
    // banner - previously it could only ever show one.
    _applyPrereqWarnings({ ffmpeg_ok: true, llm_ok: true, llm_reason: '' });
    expect(banner().style.display).toBe('none');
    expect(banner().innerHTML).toBe('');
  });
});
