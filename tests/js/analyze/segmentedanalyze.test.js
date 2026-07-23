// _analyzeSegmentsSequentially (static/analyze/analyze.js) - bug-hunt 2.4: the
// runner never held AppState.analyzeFilename for the whole chain, so
// _blockedByAnalyze never protected a mid-chain segment from being superseded
// by a competing action (streamSSE's _supersedeActiveStream aborts the segment
// stream and suppresses its onDone, so the remaining segments silently never
// start). The caller (_doStartAnalyze) now sets the marker before the chain
// begins; this test pins that the runner itself only clears it after the LAST
// segment, never in between.
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

import { streamSSE } from '../../../yuu_clip/web/static/core/jobs.js';
import { _analyzeSegmentsSequentially } from '../../../yuu_clip/web/static/analyze/analyze.js';

const SEGMENTS = [{ start_s: 0, end_s: 60 }, { start_s: 60, end_s: 120 }];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.clearAllMocks();
  // Simulates what _doStartAnalyze does before starting the chain.
  AppState.analyzeFilename = 'session.mkv';
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
});

describe('_analyzeSegmentsSequentially', () => {
  it('keeps AppState.analyzeFilename set across segments, clearing only after the last one', async () => {
    await _analyzeSegmentsSequentially(
      '/path/session.mkv', 'base', null, 'fast', 'fast', [], null, null, SEGMENTS, 0,
    );
    await flush();

    expect(streamSSE).toHaveBeenCalledTimes(1);
    expect(AppState.analyzeFilename).toBe('session.mkv'); // segment 1/2 still in flight

    // Simulate segment 1 completing: streamSSE's onDone recurses into segment 2.
    const onDoneSegment1 = streamSSE.mock.calls[0][1];
    onDoneSegment1();
    await flush();

    expect(streamSSE).toHaveBeenCalledTimes(2);
    expect(AppState.analyzeFilename).toBe('session.mkv'); // segment 2/2 still in flight - not cleared early

    // Simulate segment 2 (the last one) completing.
    const onDoneSegment2 = streamSSE.mock.calls[1][1];
    onDoneSegment2();
    await flush();

    expect(AppState.analyzeFilename).toBeNull(); // chain finished - guard released
  });
});
