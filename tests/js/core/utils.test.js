// Pure / DOM-shell helpers in static/core/utils.js. Ported from test_ui_utils.py.
// The setup file (tests/js/setup.js) seeds index.html's body so utils.js's
// load-time listener wiring and the #log-lines element resolve.
import {
  _diarizationReason, _diarizationNoteHtml, _wireDiarizationSettingsLink,
  appendLog, clearLog, showToast,
  _exportRetranscribeDefault,
} from '../../../yuu_clip/web/static/core/utils.js';

// _exportRetranscribeDefault (B20) - the smart on/off default behind
// "Retranscribe before export" in both export modals. Pure fetch-and-shape
// logic with no DOM, so it belongs here rather than in Playwright.
describe('_exportRetranscribeDefault', () => {
  it('passes through the model and needs_retranscribe from the API', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      expect(url).toBe('/api/videos/42/retranscribe-status');
      return Promise.resolve({
        ok: true,
        json: async () => ({ export_retranscribe_model: 'small', needs_retranscribe: true }),
      });
    }));
    expect(await _exportRetranscribeDefault(42)).toEqual({ model: 'small', needsRetranscribe: true });
  });

  it('unchecked when the video already matches the configured model', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({ export_retranscribe_model: 'large-v3', needs_retranscribe: false }),
    })));
    expect(await _exportRetranscribeDefault(42)).toEqual({ model: 'large-v3', needsRetranscribe: false });
  });

  it('falls back to unchecked / large-v3 on a network error, never a surprise retranscribe', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    expect(await _exportRetranscribeDefault(42)).toEqual({ model: 'large-v3', needsRetranscribe: false });
  });
});

describe('_diarizationReason', () => {
  it('unavailable install reads "reinstall", not "Install" (SpeechBrain is bundled)', () => {
    expect(_diarizationReason(false)).toBe('SpeechBrain is unavailable - try reinstalling YuuClip');
  });
  it('installed alone is fully ready (no token needed)', () => {
    expect(_diarizationReason(true)).toBe('');
  });
});

describe('_diarizationNoteHtml', () => {
  it('escapes the reason and includes a Settings button', () => {
    const out = _diarizationNoteHtml('Requires a <script> HuggingFace token');
    expect(out).toContain('Requires a &lt;script&gt; HuggingFace token');
    expect(out).toContain('class="btn ghost diar-settings-link"');
    expect(out).toContain('>Settings</button>');
    expect(out).not.toContain('onclick=');
  });
});

describe('_wireDiarizationSettingsLink', () => {
  it('wires the rendered Settings button to the given callback', () => {
    document.body.innerHTML = '<div id="note"></div>';
    const note = document.getElementById('note');
    note.innerHTML = _diarizationNoteHtml('some reason');
    const onGoToSettings = vi.fn();
    _wireDiarizationSettingsLink(note, onGoToSettings);
    note.querySelector('.diar-settings-link').click();
    expect(onGoToSettings).toHaveBeenCalledTimes(1);
  });
});

// Toast standards (CC-5). Ported from tests/ui/test_ui_toasts.py - the DOM-only
// cases; nothing here needs a real browser. Fake timers keep the auto-dismiss
// deterministic and prevent dangling timers between tests.
describe('showToast', () => {
  const container = () => document.getElementById('toast-container');
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a warning toast gets the warning class', () => {
    showToast('Careful now', 'warning');
    expect(container().querySelectorAll('.toast.warning')).toHaveLength(1);
  });
  it('an error toast persists until dismissed', () => {
    showToast('It broke', 'error', { durationMs: 100 });
    vi.advanceTimersByTime(1200);
    const errorToast = container().querySelector('.toast.error');
    expect(errorToast).not.toBe(null);
    errorToast.querySelector('button[aria-label="Dismiss"]').click();
    expect(container().querySelectorAll('.toast.error')).toHaveLength(0);
  });
  it('a non-error toast auto-dismisses', () => {
    showToast('Saved', 'success', { durationMs: 100 });
    vi.advanceTimersByTime(500);
    expect(container().querySelectorAll('.toast.success')).toHaveLength(0);
  });
  it('the stack is capped at four, keeping the newest', () => {
    for (let i = 0; i < 6; i++) showToast(`toast ${i}`, 'info', { durationMs: 60000 });
    expect(container().querySelectorAll('.toast')).toHaveLength(4);
    expect(container().textContent).toContain('toast 5');
    expect(container().textContent).not.toContain('toast 0');
  });
  it('the action button runs its callback and dismisses the toast', () => {
    let fired = false;
    showToast('Analysis complete', 'success', {
      action: { label: 'Review', onClick: () => { fired = true; } },
    });
    const btn = [...container().querySelectorAll('button')].find((b) => b.textContent === 'Review');
    btn.click();
    expect(fired).toBe(true);
    expect(container().querySelectorAll('.toast')).toHaveLength(0);
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
