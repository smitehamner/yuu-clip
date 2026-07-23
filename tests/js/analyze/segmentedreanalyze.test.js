// _reanalyzeSegmentsSequentially (static/analyze/split.js) - bug-hunt 2.4, the
// split-then-reanalyze twin of _analyzeSegmentsSequentially's fix. The runner
// never held AppState.analyzeFilename for the whole chain, so a competing
// action could supersede a mid-chain segment's stream and silently strand the
// remaining segments. The caller (_doSplitAndReanalyze) now sets the marker
// before the chain begins; this test pins that the runner itself only clears
// it after the LAST segment, never in between.
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
import { _reanalyzeSegmentsSequentially } from '../../../yuu_clip/web/static/analyze/split.js';

const SEGMENT_IDS = [11, 12];
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.clearAllMocks();
  // Simulates what _doSplitAndReanalyze does before starting the chain.
  AppState.analyzeFilename = 'session.mkv';
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
});

describe('_reanalyzeSegmentsSequentially', () => {
  it('keeps AppState.analyzeFilename set across segments, clearing only after the last one', async () => {
    await _reanalyzeSegmentsSequentially(SEGMENT_IDS, 0, { model: 'base' });
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
