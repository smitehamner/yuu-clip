// Bulk clip actions (static/clips/clipbulk.js) - the request-building + the
// selection-intersect-filter logic. Ported from the request-assertion halves of
// tests/ui/test_ui_clips.py (TestBulkApproveReject / TestBulkDelete /
// TestBulkExportStaleWarning); the checkbox->click->request DOM wiring and the
// real confirm-modal flow stay in Playwright.
//
// Mocks only the downstream seams (list reload, detail render, videos refresh,
// toasts, confirm, SSE) so the real _visibleSelectedClips / _applyFilters logic
// and the fetch payloads are what's under test.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/videos/videos.js', () => ({ loadVideos: vi.fn() }));
vi.mock('../../../yuu_clip/web/static/clips/clips.js', async (importActual) => {
  const actual = await importActual(); // keep _applyFilters real - it decides the ids
  return {
    ...actual,
    _reloadClipList: vi.fn(), renderDetail: vi.fn(), clearDetail: vi.fn(),
    _renderClips: vi.fn(), _releasePlayerBeforeDelete: vi.fn(),
  };
});
vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  // Auto-confirm so the delete/export "confirm then act" paths run their action.
  return { ...actual, showConfirm: vi.fn((t, b, l, onConfirm) => onConfirm()), showUndoToast: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/core/jobs.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, streamSSE: vi.fn() };
});

import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import { streamSSE } from '../../../yuu_clip/web/static/core/jobs.js';
import {
  bulkSetClipStatus, bulkDeleteClips, bulkExportClips,
} from '../../../yuu_clip/web/static/clips/clipbulk.js';

const okJson = (obj) => ({ ok: true, json: async () => obj });

function seedClips() {
  // Two visible clips (pass the default empty filter) + one that a status filter
  // will hide, to prove hidden-but-checked clips are excluded from a bulk action.
  AppState.clips = [
    { id: 1, status: 'pending', score_overall: 0.5, description: 'a', tags: [] },
    { id: 2, status: 'pending', score_overall: 0.5, description: 'b', tags: [] },
    { id: 3, status: 'approved', score_overall: 0.5, description: 'c', tags: [] },
  ];
  AppState.clipFilters = new Set();
  AppState.clipScoreMin = 0;
  AppState.clipSearch = '';
  AppState.clipSortDir = 'desc';
  AppState.clipKindFilter = 'all';
  AppState.selectedClipIds = new Set();
  AppState.activeClipId = null;
  AppState.activeVideoId = 42;
  AppState.lastBulkStatusChange = null;
  AppState.lastStatusChange = null;
}

beforeEach(() => {
  vi.clearAllMocks();
  seedClips();
});

describe('bulkSetClipStatus', () => {
  it('POSTs the selected ids and the target status', async () => {
    AppState.selectedClipIds = new Set([1, 2]);
    const fetchMock = vi.fn().mockResolvedValue(okJson({ previous: { 1: 'pending', 2: 'pending' } }));
    vi.stubGlobal('fetch', fetchMock);

    await bulkSetClipStatus('approved');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/clips/bulk-status');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ clip_ids: [1, 2], status: 'approved' });
  });

  it('carries the rejected status through unchanged', async () => {
    AppState.selectedClipIds = new Set([2]);
    const fetchMock = vi.fn().mockResolvedValue(okJson({ previous: { 2: 'pending' } }));
    vi.stubGlobal('fetch', fetchMock);

    await bulkSetClipStatus('rejected');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ clip_ids: [2], status: 'rejected' });
  });

  it('excludes a checked clip that the active filter now hides', async () => {
    // Clip 3 is checked but a "pending" filter hides it - it must not be sent.
    AppState.selectedClipIds = new Set([1, 3]);
    AppState.clipFilters = new Set(['pending']);
    const fetchMock = vi.fn().mockResolvedValue(okJson({ previous: { 1: 'pending' } }));
    vi.stubGlobal('fetch', fetchMock);

    await bulkSetClipStatus('approved');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).clip_ids).toEqual([1]);
  });

  it('is a no-op when nothing is selected', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await bulkSetClipStatus('approved');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // M5: bulk approve/reject gave no in-flight feedback. The toolbar buttons must
  // be disabled while the (possibly slow, DB-lock-retrying) request is in flight
  // and re-enabled when it resolves.
  it('disables the bulk toolbar buttons while the request is in flight', async () => {
    document.body.innerHTML =
      '<div class="clip-bulk-actions"><button data-act="bulk-approve">Approve</button>'
      + '<button data-act="bulk-reject">Reject</button></div>';
    AppState.selectedClipIds = new Set([1, 2]);

    let resolveFetch;
    const fetchMock = vi.fn(() => new Promise(r => { resolveFetch = r; }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = bulkSetClipStatus('approved');
    await Promise.resolve();
    const buttons = [...document.querySelectorAll('.clip-bulk-actions button')];
    expect(buttons.every(b => b.disabled)).toBe(true);

    resolveFetch(okJson({ previous: { 1: 'pending', 2: 'pending' } }));
    await promise;
    expect(buttons.every(b => b.disabled)).toBe(false);
  });
});

describe('bulkDeleteClips', () => {
  it('confirms, then POSTs the selected ids to bulk-delete', async () => {
    AppState.selectedClipIds = new Set([1, 2]);
    const fetchMock = vi.fn().mockResolvedValue(okJson({ deleted: [1, 2], locked: [] }));
    vi.stubGlobal('fetch', fetchMock);

    bulkDeleteClips();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(showConfirm).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/clips/bulk-delete');
    expect(JSON.parse(opts.body)).toEqual({ clip_ids: [1, 2] });
  });

  it('is a no-op (no confirm, no fetch) when nothing is selected', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    bulkDeleteClips();
    expect(showConfirm).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('bulkExportClips', () => {
  it('streams the export with the selected ids and no stale confirm', () => {
    AppState.selectedClipIds = new Set([1, 2]);
    bulkExportClips();
    expect(showConfirm).not.toHaveBeenCalled();
    expect(streamSSE).toHaveBeenCalledTimes(1);
    expect(streamSSE.mock.calls[0][0]).toBe('/api/clips/bulk-export?clip_ids=1%2C2');
  });

  it('warns before exporting clips whose captions went stale', () => {
    AppState.clips[0].transcript_stale = true;
    AppState.selectedClipIds = new Set([1, 2]);
    bulkExportClips();
    // showConfirm auto-confirms in the mock, so the export still streams - but the
    // warning must have been raised first.
    expect(showConfirm).toHaveBeenCalledTimes(1);
    const [title, body] = showConfirm.mock.calls[0];
    expect(title).toBe('Export clips with outdated captions?');
    expect(body).toContain('captions edited since');
    expect(streamSSE).toHaveBeenCalledTimes(1);
  });
});
