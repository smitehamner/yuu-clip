// Reveal-in-folder + copy-export-paths (static/clips/clipexport.js). Ported from
// the request/clipboard-assertion cases in tests/ui/test_ui_clips2.py
// (TestClipShowInFolder / TestCopyToClipboard::test_copy_export_file_paths). These
// drive the real _revealClipExport -> revealInFolder -> POST /api/reveal and
// _copyClipExportPaths -> copyText -> navigator.clipboard chains, mocking only
// fetch + the clipboard, so the exported path assembly is what's under test. The
// modal-row DOM wiring (openClipActionsModal, data-copy delegation, the canReveal
// gate) stays in Playwright.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

// _deleteExportFormat re-renders the detail/list through clips.js and confirms via
// ui.js - stub those seams so only the DELETE request is under test.
vi.mock('../../../yuu_clip/web/static/clips/clips.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    renderDetail: vi.fn(), renderPlayer: vi.fn(), selectClip: vi.fn(),
    _reloadClipList: vi.fn(), _releasePlayerBeforeDelete: vi.fn(),
  };
});
vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showConfirm: vi.fn((t, b, l, onConfirm) => onConfirm()) };
});

// confirmExport reports a bad trim through showToast - spy on it without
// disturbing the reveal/copy helpers the other cases in this file drive for real.
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});

// _exportTightCapWarning reads a preset's cap through exportpresets.js's cache; stub
// the lookup so the tight-cap heuristic math is what's under test, not the cache.
let presetCapMb = null;
vi.mock('../../../yuu_clip/web/static/library/exportpresets.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, exportPresetTargetSizeMb: vi.fn(() => presetCapMb) };
});

import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import { showToast } from '../../../yuu_clip/web/static/core/utils.js';
import {
  _revealClipExport, _copyClipExportPaths, _handleExportFormatAction,
  trimInputError, confirmExport, _exportModeSummary, _exportTightCapWarning,
} from '../../../yuu_clip/web/static/clips/clipexport.js';

const exportFilesResponse = (files) => ({ ok: true, json: async () => ({ files }) });

let clipboardWrites;

beforeEach(() => {
  clipboardWrites = [];
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn((t) => { clipboardWrites.push(t); return Promise.resolve(); }) },
    configurable: true,
  });
  AppState.exportDir = 'D:\\exports';
  AppState.activeMediaFilename = null;
});

describe('_revealClipExport', () => {
  it('reveals the first export file under the exports dir (windows separator)', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/export-files')) return Promise.resolve(exportFilesResponse(['clip_export.mkv', 'clip_export.srt']));
      return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await _revealClipExport(7);

    const revealCall = fetchMock.mock.calls.find(([url]) => url === '/api/reveal');
    expect(revealCall).toBeTruthy();
    expect(JSON.parse(revealCall[1].body)).toEqual({ path: 'D:\\exports\\clip_export.mkv' });
  });

  it('falls back to the known media filename when no export files are listed', async () => {
    AppState.activeMediaFilename = 'clip_preview.mp4';
    const fetchMock = vi.fn((url) => {
      if (url.includes('/export-files')) return Promise.resolve(exportFilesResponse([]));
      return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    await _revealClipExport(7);

    const revealCall = fetchMock.mock.calls.find(([url]) => url === '/api/reveal');
    expect(JSON.parse(revealCall[1].body)).toEqual({ path: 'D:\\exports\\clip_preview.mp4' });
  });

  it('does not POST reveal when there is nothing to reveal', async () => {
    AppState.exportDir = '';
    const fetchMock = vi.fn(() => Promise.resolve(exportFilesResponse([])));
    vi.stubGlobal('fetch', fetchMock);

    await _revealClipExport(7);

    expect(fetchMock.mock.calls.some(([url]) => url === '/api/reveal')).toBe(false);
  });
});

describe('_copyClipExportPaths', () => {
  it('copies every export path joined by newlines', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(exportFilesResponse(['clip_export.mkv', 'clip_export.srt'])));
    vi.stubGlobal('fetch', fetchMock);

    await _copyClipExportPaths(7);

    expect(clipboardWrites).toEqual([
      'D:\\exports\\clip_export.mkv\nD:\\exports\\clip_export.srt',
    ]);
  });
});

describe('_handleExportFormatAction delete', () => {
  // Ported from tests/ui/test_ui_clips2.py::TestMultiFormatExportRows -
  // per-format-row delete confirms, then DELETEs that one export by id.
  it('confirms, then DELETEs the export by id', async () => {
    AppState.activeVideoId = 100;
    const fetchMock = vi.fn((url) => {
      if (url === '/api/clip-exports/42') return Promise.resolve({ ok: true, json: async () => ({ export_id: 42 }) });
      return Promise.resolve({ ok: true, json: async () => ({ id: 9302, has_export: false, exports: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    _handleExportFormatAction('delete', { clipId: '9302', exportId: 42 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/clip-exports/42', { method: 'DELETE' }));

    expect(showConfirm).toHaveBeenCalledTimes(1);
    expect(showConfirm.mock.calls[0][0]).toBe('Delete this format?');
  });
});

describe('trimInputError', () => {
  // The trim fields are free text. An unparseable value used to skip the timing
  // save silently, so the clip exported with its previously-saved trim and the
  // user was never told their typed value had been discarded.
  beforeEach(() => { AppState.activeClipData = { start_ms: 60_000 }; });

  it('accepts a blank field as "no trim"', () => {
    expect(trimInputError('', '')).toBe('');
  });

  it('accepts signed-seconds offsets', () => {
    expect(trimInputError('+2.5', '-1')).toBe('');
  });

  it('accepts an absolute M:SS timestamp', () => {
    expect(trimInputError('1:05', '1:30')).toBe('');
  });

  it('names the Start field and echoes what was typed', () => {
    expect(trimInputError('abc', '+0.0')).toBe(
      'Start trim "abc" isn\'t a time - use +2.5, -1, or 1:23.',
    );
  });

  it('names the End field when only that one is bad', () => {
    expect(trimInputError('+0.0', 'two seconds')).toBe(
      'End trim "two seconds" isn\'t a time - use +2.5, -1, or 1:23.',
    );
  });
});

describe('confirmExport with an unparseable trim', () => {
  function seedExportModal(startValue, endValue) {
    document.body.innerHTML = `
      <select id="export-captions"><option value="softsub" selected>softsub</option></select>
      <select id="export-container"><option value="" selected></option></select>
      <select id="export-preset"><option value="" selected></option></select>
      <input id="export-trim-start" value="${startValue}">
      <input id="export-trim-end" value="${endValue}">
      <input type="checkbox" id="export-retranscribe">
      <select id="export-retranscribe-model"><option value="large-v3" selected>large-v3</option></select>
      <input type="checkbox" id="export-speaker-labels" checked>
      <input type="checkbox" id="export-title-card">
      <div id="export-settings-modal" class="visible"></div>`;
  }

  it('tells the user instead of silently exporting the saved trim', async () => {
    seedExportModal('abc', '+0.0');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await confirmExport();

    expect(showToast).toHaveBeenCalledWith(
      'Start trim "abc" isn\'t a time - use +2.5, -1, or 1:23.', 'error',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves the dialog open so the bad field can be corrected', async () => {
    seedExportModal('abc', '+0.0');
    vi.stubGlobal('fetch', vi.fn());

    await confirmExport();

    expect(document.getElementById('export-settings-modal').classList.contains('visible')).toBe(true);
  });
});

describe('_exportModeSummary', () => {
  it('is a Quick (stream-copy) export when nothing forces a re-encode', () => {
    const s = _exportModeSummary(false, false, false);
    expect(s.precise).toBe(false);
    expect(s.text).toContain('Quick export');
    expect(s.text).toContain('~1 s off');
  });

  it('is Precise and names burned-in captions as the re-encode reason', () => {
    const s = _exportModeSummary(true, false, false);
    expect(s.precise).toBe(true);
    expect(s.text).toBe('Precise export - re-encodes for burned-in captions (slower).');
  });

  it('joins both re-encode reasons when captions and a title card are on', () => {
    const s = _exportModeSummary(true, true, false);
    expect(s.text).toContain('burned-in captions and the title card');
  });

  it('appends the retranscribe note to either mode', () => {
    expect(_exportModeSummary(false, false, true).text).toContain('Retranscribing runs first and adds time.');
    expect(_exportModeSummary(true, false, true).text).toContain('Retranscribing runs first and adds time.');
  });
});

describe('_exportTightCapWarning', () => {
  const clip = (over = {}) => ({ start_ms: 0, end_ms: 240_000, kind: 'clip', ...over });

  afterEach(() => { presetCapMb = null; });

  it('warns when a long clip is squeezed under a small size cap', () => {
    presetCapMb = 10;  // 10 MB over 4 min = ~341 kbps, under the 900 floor
    expect(_exportTightCapWarning('discord-10mb', clip())).toBe(
      'This 4-minute clip squeezed under a 10 MB cap will look rough (blocky). Consider a larger preset or a shorter selection.',
    );
  });

  it('says "scene" for a scene-kind selection', () => {
    presetCapMb = 10;
    expect(_exportTightCapWarning('discord-10mb', clip({ kind: 'scene' }))).toContain('4-minute scene');
  });

  it('is silent when the per-second budget clears the floor', () => {
    presetCapMb = 10;  // 10 MB over 30 s = ~2730 kbps, above the floor
    expect(_exportTightCapWarning('discord-10mb', clip({ end_ms: 30_000 }))).toBe('');
  });

  it('is silent for a preset with no size cap', () => {
    presetCapMb = null;
    expect(_exportTightCapWarning('', clip())).toBe('');
  });

  it('is silent when the clip is missing or has no timing', () => {
    presetCapMb = 10;
    expect(_exportTightCapWarning('discord-10mb', null)).toBe('');
    expect(_exportTightCapWarning('discord-10mb', { start_ms: null, end_ms: null })).toBe('');
  });
});
