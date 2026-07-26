// H1/M1 (UX-REVIEW-2026-07-23): a failed segment in a sequential analyze chain
// must release the "analyzing" lock and tell the user which segments never ran -
// otherwise the sidebar spinner and the _blockedByAnalyze gate stay stuck until a
// page reload. The chain passes streamSSE an onError (9th arg) that does this.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/videos/videos.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, loadVideos: vi.fn().mockResolvedValue(undefined) };
});
vi.mock('../../../yuu_clip/web/static/core/jobs.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    streamSSE: vi.fn(),
    _waitWhileAnalyzePaused: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn(), appendLog: vi.fn() };
});

import { streamSSE } from '../../../yuu_clip/web/static/core/jobs.js';
import { showToast } from '../../../yuu_clip/web/static/core/utils.js';
import { _analyzeSegmentsSequentially } from '../../../yuu_clip/web/static/analyze/analyze.js';

const SEGMENTS = [{ start_s: 0, end_s: 60 }, { start_s: 60, end_s: 120 }, { start_s: 120, end_s: 180 }];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.clearAllMocks();
  AppState.analyzeFilename = 'session.mkv';
  AppState.activeVideoId = null;
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
});

describe('_analyzeSegmentsSequentially failure handling', () => {
  it('passes an onError that clears the analyzing lock and reports skipped segments', async () => {
    await _analyzeSegmentsSequentially(
      '/path/session.mkv', 'base', null, 'fast', 'fast', [], null, null, SEGMENTS, 1,
    );
    await flush();

    // streamSSE(url, onDone, stepDefs, label, cancellable, onLine, pausable, opts, onError)
    const call = streamSSE.mock.calls[0];
    expect(call[4]).toBe(true);            // cancellable now true (M1)
    const onError = call[8];
    expect(typeof onError).toBe('function');

    onError('boom');
    await flush();

    expect(AppState.analyzeFilename).toBeNull();
    expect(showToast).toHaveBeenCalledTimes(1);
    const [msg, level] = showToast.mock.calls[0];
    expect(level).toBe('warning');
    // Started at index 1 of 3 -> segments 2-3 were not analyzed.
    expect(msg).toContain('segments 2-3 of 3');
  });
});
