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

// A couple of per-format actions surface an empty-state through showToast - spy on it
// without disturbing the reveal/copy helpers the other cases here drive for real.
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});

import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import {
  _revealClipExport, _copyClipExportPaths, _handleExportFormatAction,
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
