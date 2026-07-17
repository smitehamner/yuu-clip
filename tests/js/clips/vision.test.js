// analyzeFrames' cancel wiring + in-flight-flag leak fix in static/clips/clips.js.
// The vitest port of the strict-xfailed Playwright poke in
// tests/ui/test_ui_vision.py::TestVisionCancelWiring - after the ESM migration
// analyzeFrames imports streamSSE/setJobCancel as module bindings, so a
// window.streamSSE monkeypatch no longer intercepts them. Mocking the jobs.js seam
// directly is the correct lock-in: it asserts the real imported wiring.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

// Replace only the transport + cancel-config seam; keep the rest of jobs.js real
// (FRAMES_STEPS, _blockedByAnalyze, etc.) so the module still loads normally.
vi.mock('../../../yuu_clip/web/static/core/jobs.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, streamSSE: vi.fn(), setJobCancel: vi.fn() };
});

import { streamSSE, setJobCancel } from '../../../yuu_clip/web/static/core/jobs.js';
import { analyzeFrames } from '../../../yuu_clip/web/static/clips/clips.js';

describe('analyzeFrames cancel wiring + leak fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No analysis running, so the real _blockedByAnalyze guard lets the job start.
    AppState.analyzeFilename = null;
    AppState.clipJobs = {};
    AppState.activeClipId = 999;
    // Null so the terminal repaint (renderDetail) short-circuits - only the wiring
    // contract is under test here, not the panel re-render.
    AppState.activeClipData = null;
  });

  it('starts a cancellable POST job carrying an onError terminal handler', () => {
    analyzeFrames(999);
    expect(streamSSE).toHaveBeenCalledTimes(1);
    const [url, , , , cancellable, , , opts, onError] = streamSSE.mock.calls[0];
    expect(url).toBe('/api/clips/999/analyze-frames');
    expect(cancellable).toBe(true);
    expect(opts.method).toBe('POST');
    expect(typeof onError).toBe('function');
  });

  it('clears the in-flight flag on the error terminal path (no stranded spinner)', () => {
    // Drive the onError terminal path the way a transport failure would.
    streamSSE.mockImplementation((...args) => { args[8]('boom'); });
    AppState.clipJobs[999] = undefined; // starts unset
    analyzeFrames(999);
    expect(AppState.clipJobs[999]).toBeUndefined();
  });

  it('overrides the header Cancel to target the per-clip frames endpoint', () => {
    analyzeFrames(999);
    expect(setJobCancel).toHaveBeenCalledTimes(1);
    const cfg = setJobCancel.mock.calls[0][0];
    expect(cfg.url).toBe('/api/clips/999/analyze-frames/cancel');
    expect(cfg.confirm).toBe('Stop analysis');
    expect(typeof cfg.onCancel).toBe('function');
  });
});
