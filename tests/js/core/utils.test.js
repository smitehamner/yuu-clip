// Pure / DOM-shell helpers in static/core/utils.js. Ported from test_ui_utils.py.
// The setup file (tests/js/setup.js) seeds index.html's body so utils.js's
// load-time listener wiring and the #log-lines element resolve.
import { _diarizationReason, _diarizationNoteHtml, appendLog, clearLog } from '../../../yuu_clip/web/static/core/utils.js';

describe('_diarizationReason', () => {
  it('unavailable install reads "reinstall", not "Install" (SpeechBrain is bundled)', () => {
    expect(_diarizationReason(false)).toBe('SpeechBrain is unavailable - try reinstalling YuuClip');
  });
  it('installed alone is fully ready (no token needed)', () => {
    expect(_diarizationReason(true)).toBe('');
  });
});

describe('_diarizationNoteHtml', () => {
  it('escapes the onclick and includes a Settings button', () => {
    const out = _diarizationNoteHtml('Requires a HuggingFace token', 'foo();bar()');
    expect(out).toContain('>Settings</button>');
    expect(out).toContain('onclick="foo();bar()"');
  });
});

describe('appendLog', () => {
  it('caps the log DOM at 500 lines', () => {
    clearLog();
    for (let i = 0; i < 600; i++) appendLog('line ' + i);
    expect(document.getElementById('log-lines').childElementCount).toBe(500);
  });
  it('keeps the most recent lines (drops the oldest)', () => {
    clearLog();
    for (let i = 0; i < 600; i++) appendLog('line ' + i);
    const lines = document.getElementById('log-lines');
    expect(lines.firstElementChild.textContent).toMatch(/line 100$/);
    expect(lines.lastElementChild.textContent).toMatch(/line 599$/);
  });
});
