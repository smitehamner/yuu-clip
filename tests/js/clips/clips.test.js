// Pure clip filtering / timing-offset logic in static/clips/clips.js. Ported from
// the page.evaluate cases in tests/ui/test_ui_utils.py - imported directly here,
// driving AppState (a shared singleton) instead of a live browser.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import {
  _applyFilters, _parseTimingOffset,
  _duplicatePartners, _mergeNeighbors, _generatedTagPillsHTML,
  computeClipFilterCounts, computeClipStats, _descNeedsModel, _fmtSizeMb, _exportFormatsHtml,
} from '../../../yuu_clip/web/static/clips/clips.js';

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

// The merged Clips+Scenes list: both kinds live in AppState.clips together, and
// the All / Clips / Scenes chip is a client-side filter applied by _applyFilters
// (no re-fetch). Verify the kind filter composes with the other filters.
describe('_applyFilters - kind filter', () => {
  const seed = () => {
    AppState.clips = [
      { id: 1, kind: 'clip',  status: 'pending',  score_overall: 0.5, description: 'a', tags: [] },
      { id: 2, kind: 'scene', status: 'approved', score_overall: 0.6, description: 'b', tags: [] },
      { id: 3, kind: 'clip',  status: 'pending',  score_overall: 0.4, description: 'c', tags: [] },
      { id: 4, kind: 'scene', status: 'pending',  score_overall: 0.7, description: 'd', tags: [] },
    ];
    AppState.clipFilters = new Set();
    AppState.clipScoreMin = 0;
    AppState.clipSearch = '';
    AppState.clipSortDir = 'desc';
    AppState.clipKindFilter = 'all';
  };
  const ids = () => _applyFilters().map((c) => c.id);
  beforeEach(seed);
  afterEach(() => { AppState.clipKindFilter = 'all'; });

  it("'all' keeps both kinds", () => {
    expect(ids()).toEqual([1, 2, 3, 4]);
  });
  it("'clip' keeps only clips", () => {
    AppState.clipKindFilter = 'clip';
    expect(ids()).toEqual([1, 3]);
  });
  it("'scene' keeps only scenes", () => {
    AppState.clipKindFilter = 'scene';
    expect(ids()).toEqual([2, 4]);
  });
  it('composes with a status filter', () => {
    AppState.clipKindFilter = 'scene';
    AppState.clipFilters = new Set(['pending']);
    expect(ids()).toEqual([4]);
  });
  it('composes with the sort-direction reversal', () => {
    AppState.clipKindFilter = 'clip';
    AppState.clipSortDir = 'asc';
    expect(ids()).toEqual([3, 1]);
  });
  it('a missing kindFilter behaves like all', () => {
    delete AppState.clipKindFilter;
    expect(ids()).toEqual([1, 2, 3, 4]);
  });
});

// Client-side recomputation of a possible-duplicate's overlapping partner, so the
// detail panel can name it and offer a one-click merge. Overlap ratio = shared span
// / the SHORTER clip's duration; threshold mirrors DEFAULT_OVERLAP_THRESHOLD (0.7).
describe('_duplicatePartners', () => {
  // clip #1 spans 0-10s; others are seeded per-test relative to it.
  const target = { id: 1, start_ms: 0, end_ms: 10_000, status: 'pending' };
  const partnerIds = () => _duplicatePartners(target).map((p) => p.clip.id);

  it('flags a clip overlapping >= 70% of the shorter duration', () => {
    // #2 spans 2-10s (8s long); overlap 2-10 = 8s; 8/8 = 1.0 >= 0.7.
    AppState.clips = [target, { id: 2, start_ms: 2_000, end_ms: 10_000, status: 'pending' }];
    expect(partnerIds()).toEqual([2]);
  });
  it('ignores a clip whose overlap is below the threshold', () => {
    // #2 spans 8-18s (10s long); overlap 8-10 = 2s; 2/10 = 0.2 < 0.7.
    AppState.clips = [target, { id: 2, start_ms: 8_000, end_ms: 18_000, status: 'pending' }];
    expect(partnerIds()).toEqual([]);
  });
  it('never counts the clip itself', () => {
    AppState.clips = [target];
    expect(partnerIds()).toEqual([]);
  });
  it('excludes rejected clips (they are not merge candidates)', () => {
    AppState.clips = [target, { id: 2, start_ms: 0, end_ms: 10_000, status: 'rejected' }];
    expect(partnerIds()).toEqual([]);
  });
  it('orders partners by descending overlap ratio', () => {
    AppState.clips = [
      target,
      { id: 2, start_ms: 3_000, end_ms: 10_000, status: 'pending' }, // 7/7 = 1.0
      { id: 3, start_ms: 0, end_ms: 13_000, status: 'pending' }, // overlap 10/10 = 1.0 too...
      { id: 4, start_ms: 2_000, end_ms: 12_000, status: 'pending' }, // overlap 8s / 10s = 0.8
    ];
    // #2 and #3 both ratio 1.0 (stable order), #4 at 0.8 comes last.
    expect(partnerIds()).toEqual([2, 3, 4]);
  });
});

// prev/next by TIME order (not list order) for the merge-neighbour actions.
describe('_mergeNeighbors', () => {
  const seed = () => {
    AppState.clips = [
      { id: 3, start_ms: 30_000 },
      { id: 1, start_ms: 10_000 },
      { id: 2, start_ms: 20_000 },
    ];
  };
  beforeEach(seed);

  it('a middle clip has both neighbours, chosen by start time', () => {
    const { prev, next } = _mergeNeighbors({ id: 2, start_ms: 20_000 });
    expect(prev.id).toBe(1);
    expect(next.id).toBe(3);
  });
  it('the earliest clip has no previous', () => {
    const { prev, next } = _mergeNeighbors({ id: 1, start_ms: 10_000 });
    expect(prev).toBe(null);
    expect(next.id).toBe(2);
  });
  it('the latest clip has no next', () => {
    const { prev, next } = _mergeNeighbors({ id: 3, start_ms: 30_000 });
    expect(prev.id).toBe(2);
    expect(next).toBe(null);
  });
  it('a clip not in the list has no neighbours', () => {
    const { prev, next } = _mergeNeighbors({ id: 99, start_ms: 5_000 });
    expect(prev).toBe(null);
    expect(next).toBe(null);
  });
});

// Pipeline tags -> display pills: bookkeeping tokens are hidden, known tokens map
// to friendly names, after_silence_<N>s is parsed dynamically, and an unrecognised
// token falls back to an underscore-stripped label rather than vanishing.
describe('_generatedTagPillsHTML', () => {
  const labels = (tags) => {
    const host = document.createElement('div');
    host.innerHTML = _generatedTagPillsHTML(tags);
    return [...host.querySelectorAll('.tag')].map((el) => el.textContent);
  };

  it('empty or missing tags render nothing', () => {
    expect(_generatedTagPillsHTML([])).toBe('');
    expect(_generatedTagPillsHTML(null)).toBe('');
  });
  it('hides bookkeeping-only tokens', () => {
    expect(_generatedTagPillsHTML(['llm_scored', 'energy_scored', 'scenes_scored'])).toBe('');
  });
  it('maps a known token to its friendly name', () => {
    expect(labels(['no_speech'])).toEqual(['No dialogue']);
    expect(labels(['manual'])).toEqual(['Manually created']);
  });
  it('parses the dynamic after_silence_<N>s token', () => {
    expect(labels(['after_silence_5s'])).toEqual(['After 5 s silence']);
  });
  it('falls back to an underscore-stripped label for an unknown token', () => {
    expect(labels(['some_new_token'])).toEqual(['some new token']);
  });
  it('drops hidden tokens but keeps visible ones in the same list', () => {
    expect(labels(['llm_scored', 'no_speech', 'energy_scored'])).toEqual(['No dialogue']);
  });
});

describe('computeClipFilterCounts', () => {
  const clip = (over) => ({ status: 'pending', tags: [], kind: 'clip', ...over });

  it('tallies statuses, error/duplicate tags, and clip vs scene kind', () => {
    const counts = computeClipFilterCounts([
      clip({ status: 'pending' }),
      clip({ status: 'approved', tags: ['llm_error'] }),
      clip({ status: 'rejected', tags: ['possible_duplicate'], kind: 'scene' }),
      clip({ status: 'approved', tags: ['llm_error', 'possible_duplicate'] }),
    ]);
    expect(counts).toEqual({
      total: 4, pending: 1, approved: 2, rejected: 1,
      error: 2, duplicate: 2, clipKind: 3, sceneKind: 1,
    });
  });

  it('is all-zero for an empty list', () => {
    expect(computeClipFilterCounts([])).toEqual({
      total: 0, pending: 0, approved: 0, rejected: 0,
      error: 0, duplicate: 0, clipKind: 0, sceneKind: 0,
    });
  });

  it('treats a missing tags array as no tags', () => {
    const counts = computeClipFilterCounts([{ status: 'approved', kind: 'clip' }]);
    expect([counts.error, counts.duplicate]).toEqual([0, 0]);
  });
});

describe('computeClipStats', () => {
  const clip = (over) => ({ status: 'pending', start_ms: 0, end_ms: 10_000, ...over });

  it('counts statuses over all clips and sums only the shown durations', () => {
    const all = [
      clip({ status: 'pending' }),
      clip({ status: 'approved' }),
      clip({ status: 'rejected' }),
    ];
    const shown = [clip({ start_ms: 0, end_ms: 30_000 })];
    const stats = computeClipStats(shown, all);
    expect(stats).toEqual({
      shownCount: 1, pending: 1, approved: 1, rejected: 1, totalSeconds: 30,
    });
  });

  it('guards a non-finite clip length to 0 seconds', () => {
    const shown = [clip({ start_ms: null, end_ms: null }), clip({ start_ms: 0, end_ms: 5_000 })];
    expect(computeClipStats(shown, []).totalSeconds).toBe(5);
  });
});

describe('_fmtSizeMb', () => {
  it('formats bytes as MB to one decimal', () => {
    expect(_fmtSizeMb(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('is blank for a null size', () => {
    expect(_fmtSizeMb(null)).toBe('');
  });
});

describe('_descNeedsModel', () => {
  afterEach(() => { delete window._prereqs; delete window._aiPrivacyMode; });

  const basicClip = (over) => ({ tags: ['desc_basic'], description_is_edited: false, ...over });

  it('is true for a desc_basic clip when no model is ready and AI is not off', () => {
    window._prereqs = { llm_ok: false };
    window._aiPrivacyMode = 'local_only';
    expect(_descNeedsModel(basicClip())).toBe(true);
  });

  it('is false once a language model is ready', () => {
    window._prereqs = { llm_ok: true };
    expect(_descNeedsModel(basicClip())).toBe(false);
  });

  it('is false when generative AI was deliberately turned off', () => {
    window._prereqs = { llm_ok: false };
    window._aiPrivacyMode = 'none';
    expect(_descNeedsModel(basicClip())).toBe(false);
  });

  it('never hides a user-edited description', () => {
    window._prereqs = { llm_ok: false };
    expect(_descNeedsModel(basicClip({ description_is_edited: true }))).toBe(false);
  });

  it('is false for a clip that is not desc_basic', () => {
    window._prereqs = { llm_ok: false };
    expect(_descNeedsModel({ tags: ['llm_scored'], description_is_edited: false })).toBe(false);
  });
});

describe('_exportFormatsHtml', () => {
  it('is blank for a clip with no export', () => {
    expect(_exportFormatsHtml({ has_export: false })).toBe('');
  });

  it('renders one row per existing export format with its preset id', () => {
    const html = _exportFormatsHtml({
      id: 5, has_export: true,
      exports: [
        { id: 1, exists: true, preset_name: 'tiktok', filename: 'a.mp4', container: 'mp4', size_bytes: 1048576, created_at: '2026-07-23T00:00:00' },
        { id: 2, exists: false, preset_name: 'gone', filename: 'b.mp4', container: 'mp4' },
      ],
    });
    expect(html).toContain('data-export-id="1"');
    expect(html).not.toContain('data-export-id="2"');  // exists:false is filtered out
    expect(html).toContain('Exports');
  });

  it('falls back to the legacy single-block display when has_export but no rows', () => {
    const html = _exportFormatsHtml({ id: 5, has_export: true, exports: [], exported_container: 'mkv', subtitle_status: 'baked-in' });
    expect(html).toContain('Exported');
    expect(html).toContain('MKV');
    expect(html).toContain('Baked in');
  });
});
