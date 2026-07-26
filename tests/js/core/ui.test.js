// _applyPrereqWarnings (static/core/ui.js) - the FFmpeg/LLM prerequisite banner.
// Ported from tests/ui/test_ui_modeldownload.py::TestPrereqRefreshAfterServerChange:
// it only reads/writes the static #prereq-banner, so happy-dom drives it directly.
// The download-resync fetch flow stays in Playwright.
import {
  _applyPrereqWarnings, playbackRatePref, applyPlaybackRate,
  showConfirm, _confirmOk,
} from '../../../yuu_clip/web/static/core/ui.js';

const banner = () => document.getElementById('prereq-banner');

// M14 (UX-REVIEW-2026-07-23): the confirm modal's OK path never restored focus to
// the opener (only the no-callback and Cancel paths did). Focus must return to the
// opener BEFORE the callback runs, so a callback that opens no modal leaves focus
// on the control the user came from, not on <body>.
describe('showConfirm OK-path focus return', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="opener">Delete</button>
      <div id="confirm-modal"><div id="confirm-title"></div><div id="confirm-body"></div>
        <button id="confirm-cancel-btn"></button><button id="confirm-ok-btn"></button></div>`;
  });

  it('restores focus to the opener when the callback opens nothing', () => {
    const opener = document.getElementById('opener');
    opener.focus();
    showConfirm('Delete?', 'Sure?', 'Delete', () => {});
    _confirmOk();
    expect(document.activeElement).toBe(opener);
  });

  it('focuses the opener before invoking the callback', () => {
    const opener = document.getElementById('opener');
    opener.focus();
    let focusAtCallback = null;
    showConfirm('Delete?', 'Sure?', 'Delete', () => { focusAtCallback = document.activeElement; });
    _confirmOk();
    expect(focusAtCallback).toBe(opener);
  });
});

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

  it('wires the Electron Setup Wizard link to runSetupWizard on click', () => {
    let wizardRuns = 0;
    window.electronAPI = { runSetupWizard: () => { wizardRuns += 1; } };
    try {
      _applyPrereqWarnings({ ffmpeg_ok: false, llm_ok: true, llm_reason: '' });
      const link = banner().querySelector('.prereq-wizard-link');
      expect(link).not.toBeNull();
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(wizardRuns).toBe(1);
    } finally {
      delete window.electronAPI;
    }
  });
});

// playbackRatePref/applyPlaybackRate - the global playback-speed preference.
// Ported from tests/ui/test_ui_settings.py::TestPlaybackSpeed (2026-07-22): both
// are pure - localStorage plus a detached <video>'s .playbackRate property, no
// real navigation/geometry - so happy-dom drives them directly. The Settings
// panel's #s-playback-rate select (real fetch + real navigation) stays in
// Playwright.
describe('playbackRatePref', () => {
  afterEach(() => localStorage.removeItem('yuuclip-playback-rate'));

  it('defaults to 1 when nothing is stored', () => {
    expect(playbackRatePref()).toBe(1);
  });

  it('reads a stored value', () => {
    localStorage.setItem('yuuclip-playback-rate', '1.5');
    expect(playbackRatePref()).toBe(1.5);
  });
});

describe('applyPlaybackRate', () => {
  it('sets the rate on every live <video>', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);
    applyPlaybackRate(1.25);
    expect(video.playbackRate).toBe(1.25);
    video.remove();
  });
});
