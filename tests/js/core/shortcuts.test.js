// Escape-key layer closing (static/core/shortcuts.js::_closeTopmostLayer).
// Regression guard for the window.X shim-drain: shortcuts.js line 70 calls
// _isNewRecordingPanelOpen()/closeNewRecordingPanel(), which used to resolve off
// the window.* shim. When the shim line for _isNewRecordingPanelOpen was dropped
// without adding the import, the Escape path threw a ReferenceError and the
// new-recording panel could no longer be closed with Escape. Asserting the panel
// actually closes catches the bug regardless of whether the DOM swallows the
// listener exception.
import { initShortcuts, _isTextEntry } from '../../../yuu_clip/web/static/core/shortcuts.js';

const panel = () => document.getElementById('new-recording-panel');

// H5 (UX-REVIEW-2026-07-23): Escape was dead in ~8 modals because the guard
// treated EVERY <input> as text entry and returned early. Only genuine free-text
// entry should keep Escape to itself; a range/checkbox/number/button input has
// nothing to abandon, so Escape must fall through to close the modal it lives in.
describe('_isTextEntry', () => {
  const inputOfType = (type) => { const el = document.createElement('input'); el.type = type; return el; };

  it('treats text-like inputs, textareas, and contenteditable as text entry', () => {
    expect(_isTextEntry(inputOfType('text'))).toBe(true);
    expect(_isTextEntry(inputOfType('search'))).toBe(true);
    expect(_isTextEntry(document.createElement('textarea'))).toBe(true);
    const ce = document.createElement('div');
    ce.setAttribute('contenteditable', 'true');
    expect(_isTextEntry(ce)).toBe(true);
  });

  it('does NOT treat range/checkbox/radio/number/button inputs as text entry', () => {
    for (const type of ['range', 'checkbox', 'radio', 'number', 'button', 'file', 'color']) {
      expect(_isTextEntry(inputOfType(type))).toBe(false);
    }
  });

  it('is false for non-form elements (buttons, selects, links)', () => {
    expect(_isTextEntry(document.createElement('button'))).toBe(false);
    expect(_isTextEntry(document.createElement('select'))).toBe(false);
    expect(_isTextEntry(document.createElement('a'))).toBe(false);
    expect(_isTextEntry(null)).toBe(false);
  });
});

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('Escape closes the new-recording panel', () => {
  it('closes an open panel without throwing on the shim-drained call', () => {
    initShortcuts();
    panel().style.display = ''; // open it (default markup is display:none)

    pressEscape();

    expect(panel().style.display).toBe('none');
  });
});
