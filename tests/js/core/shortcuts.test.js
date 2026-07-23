// Escape-key layer closing (static/core/shortcuts.js::_closeTopmostLayer).
// Regression guard for the window.X shim-drain: shortcuts.js line 70 calls
// _isNewRecordingPanelOpen()/closeNewRecordingPanel(), which used to resolve off
// the window.* shim. When the shim line for _isNewRecordingPanelOpen was dropped
// without adding the import, the Escape path threw a ReferenceError and the
// new-recording panel could no longer be closed with Escape. Asserting the panel
// actually closes catches the bug regardless of whether the DOM swallows the
// listener exception.
import { initShortcuts } from '../../../yuu_clip/web/static/core/shortcuts.js';

const panel = () => document.getElementById('new-recording-panel');

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
