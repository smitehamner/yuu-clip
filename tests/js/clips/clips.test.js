// Pure clip filtering / timing-offset logic in static/clips/clips.js. Ported from
// the page.evaluate cases in tests/ui/test_ui_utils.py - imported directly here,
// driving AppState (a shared singleton) instead of a live browser.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import { _applyFilters, _parseTimingOffset } from '../../../yuu_clip/web/static/clips/clips.js';

describe('_parseTimingOffset', () => {
  const setClipStart = (startMs) => { AppState.activeClipData = { start_ms: startMs }; };

  it('empty string is zero', () => {
    expect(_parseTimingOffset('')).toBe(0.0);
  });
  it('a signed value is a clip-relative nudge, independent of clip start', () => {
    setClipStart(60_000);
    expect(_parseTimingOffset('+2.5')).toBe(2.5);
    expect(_parseTimingOffset('-1.5')).toBe(-1.5);
  });
  it('absolute m:ss is converted to clip-relative (after clip start)', () => {
    setClipStart(60_000); // clip starts at 60s; "1:10" = 70s -> +10s
    expect(_parseTimingOffset('1:10')).toBe(10.0);
  });
  it('absolute m:ss before clip start is negative', () => {
    setClipStart(90_000); // clip starts at 90s; "1:00" = 60s -> -30s
    expect(_parseTimingOffset('1:00')).toBe(-30.0);
  });
  it('a bare number is parsed directly', () => {
    setClipStart(60_000);
    expect(_parseTimingOffset('4.25')).toBe(4.25);
  });
});

describe('_applyFilters', () => {
  const seed = () => {
    AppState.clips = [
      { id: 1, status: 'pending', score_overall: 0, description: 'alpha funny', has_export: true, tags: [] },
      { id: 2, status: 'approved', score_overall: 0.8, description: 'beta', description_long: 'longer beta text', has_export: false, tags: ['llm_error'] },
      { id: 3, status: 'rejected', score_overall: 0.3, description: 'gamma', transcript_excerpt: 'spoken keyword here', has_export: false, tags: [] },
    ];
    AppState.clipFilters = new Set();
    AppState.clipScoreMin = 0;
    AppState.clipSearch = '';
    AppState.clipSortDir = 'desc';
  };
  const ids = () => _applyFilters().map((c) => c.id);
  beforeEach(seed);

  it('no filters keeps all, including the score-0 clip', () => {
    expect(ids()).toEqual([1, 2, 3]);
  });
  it('a status filter selects one', () => {
    AppState.clipFilters = new Set(['approved']);
    expect(ids()).toEqual([2]);
  });
  it('multiple statuses are OR-ed', () => {
    AppState.clipFilters = new Set(['pending', 'rejected']);
    expect(ids()).toEqual([1, 3]);
  });
  it('exported filter', () => {
    AppState.clipFilters = new Set(['exported']);
    expect(ids()).toEqual([1]);
  });
  it('not-exported filter', () => {
    AppState.clipFilters = new Set(['not-exported']);
    expect(ids()).toEqual([2, 3]);
  });
  it('score-error filter', () => {
    AppState.clipFilters = new Set(['error']);
    expect(ids()).toEqual([2]);
  });
  it('status AND export combine', () => {
    AppState.clipFilters = new Set(['approved', 'not-exported']);
    expect(ids()).toEqual([2]);
  });
  it('score min excludes zero and below-threshold clips', () => {
    AppState.clipScoreMin = 0.5;
    expect(ids()).toEqual([2]);
  });
  it('a score min of 0 does not filter (keeps the score-0 clip)', () => {
    AppState.clipScoreMin = 0;
    expect(ids()).toEqual([1, 2, 3]);
  });
  it('search matches the description', () => {
    AppState.clipSearch = 'alpha';
    expect(ids()).toEqual([1]);
  });
  it('search matches the long description and the transcript excerpt', () => {
    AppState.clipSearch = 'longer';
    expect(ids()).toEqual([2]);
    seed();
    AppState.clipSearch = 'spoken';
    expect(ids()).toEqual([3]);
  });
  it('search is case-insensitive', () => {
    AppState.clipSearch = 'GAMMA';
    expect(ids()).toEqual([3]);
  });
  it('search matches user tags', () => {
    AppState.clips = [
      { id: 1, status: 'pending', score_overall: 0, description: 'a', user_tags: ['clutch'] },
      { id: 2, status: 'pending', score_overall: 0, description: 'b', user_tags: [] },
    ];
    AppState.clipSearch = 'clutch';
    expect(ids()).toEqual([1]);
  });
});
