// Pure recording-list filter/sort and split re-analysis params in static/videos/videos.js.
// Ported from tests/ui/test_ui_utils.py (TestVideoFilters) and test_ui_split.py
// (TestReanalyzeParams). The config-fallback path fetches /api/config; here that fetch
// is stubbed so the assertion is deterministic instead of coupled to the dev's real config.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import {
  _applyVideoFilters, _reanalyzeParams, _analysisLivePanelHTML, _syncAnalysisLivePanel,
  _autoSelectAnalyzingId, fetchClipsList,
  computeVideoFilterCounts, _isVideoBeingAnalyzed, _needsModelCtaHTML, _contextsAreStale,
} from '../../../yuu_clip/web/static/videos/videos.js';
import { startJobUI, updateJobUI, endJobUI } from '../../../yuu_clip/web/static/core/jobs.js';

describe('_applyVideoFilters', () => {
  const seed = () => {
    AppState.videos = [
      { id: 1, title: 'Alpha', filename: 'a.mkv', clip_count: 3, clips_scored_at: 'x', clips_llm_error: 0, duration_ms: 100 },
      { id: 2, title: '', filename: 'beta.mkv', clip_count: 0, clips_scored_at: null, clips_llm_error: 0, duration_ms: 300 },
      { id: 3, title: 'Gamma', filename: 'g.mkv', clip_count: 5, clips_scored_at: null, clips_llm_error: 2, duration_ms: 200 },
    ];
    AppState.videoSearch = '';
    AppState.videoSort = 'recent';
    AppState.videoFilters = new Set();
    AppState.videoSortDir = 'desc';
  };
  const ids = () => _applyVideoFilters(AppState.videos).map((v) => v.id);
  beforeEach(seed);

  it("'recent' keeps the server order", () => {
    expect(ids()).toEqual([1, 2, 3]);
  });
  it('search matches title or filename', () => {
    AppState.videoSearch = 'beta';
    expect(ids()).toEqual([2]);
    AppState.videoSearch = 'alpha';
    expect(ids()).toEqual([1]);
  });
  it('has-clips filter', () => {
    AppState.videoFilters = new Set(['has-clips']);
    expect(ids()).toEqual([1, 3]);
  });
  it('unscored filter', () => {
    AppState.videoFilters = new Set(['unscored']);
    expect(ids()).toEqual([2, 3]);
  });
  it('errors filter', () => {
    AppState.videoFilters = new Set(['errors']);
    expect(ids()).toEqual([3]);
  });
  it('sort by length desc', () => {
    AppState.videoSort = 'length';
    expect(ids()).toEqual([2, 3, 1]);
  });
  it('sort by clips desc', () => {
    AppState.videoSort = 'clips';
    expect(ids()).toEqual([3, 1, 2]);
  });
  it('sort by title', () => {
    AppState.videoSort = 'title';
    expect(ids()).toEqual([1, 2, 3]);
  });
});

// The in-detail live panel mirrors the header bar. Ported from
// tests/ui/test_ui_video.py (TestAnalysisLivePanel). _syncAnalysisLivePanel reads
// the job-step state from jobs.js as live imports, so driving the public
// startJobUI/updateJobUI API sets it - no window seeding needed. Both assertions are
// on the rendered DOM string (Cancel wiring, progress-fill style), not geometry.
describe('analysis live panel', () => {
  it('has a Cancel button wired via #detail data-act delegation (not inline onclick)', () => {
    document.getElementById('detail').innerHTML = _analysisLivePanelHTML();
    const btn = [...document.querySelectorAll('#analysis-live-panel button')]
      .find((b) => b.textContent.includes('Cancel'));
    expect(btn).toBeTruthy();
    expect(btn.dataset.act).toBe('cancel-job');
  });

  it('mirrors the header progress fill onto the active step', () => {
    vi.useFakeTimers();
    document.getElementById('detail').innerHTML = _analysisLivePanelHTML();
    startJobUI(
      [
        { label: 'Score', patterns: ['Scoring'], progressPattern: /Scoring (\d+)\/(\d+)/ },
        { label: 'Done', patterns: ['Finalizing'] },
      ],
      'Analyzing',
    );
    updateJobUI('Scoring clips');
    updateJobUI('Scoring 5/10');
    _syncAnalysisLivePanel();
    const active = document.querySelectorAll('#analysis-live-steps .step.active');
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('style') || '').toContain('linear-gradient');
    endJobUI();
    vi.useRealTimers();
  });
});

describe('_autoSelectAnalyzingId', () => {
  const videos = [
    { id: 1, filename: 'a.mkv' },
    { id: 2, filename: 'busy.mkv' },
  ];

  it('returns the analyzing recording once its row exists and nothing is selected', () => {
    expect(_autoSelectAnalyzingId(videos, 'busy.mkv', null)).toBe(2);
  });
  it('returns null while its row has not appeared yet', () => {
    expect(_autoSelectAnalyzingId(videos, 'pending.mkv', null)).toBe(null);
  });
  it('returns null when a recording is already selected (never steals focus)', () => {
    expect(_autoSelectAnalyzingId(videos, 'busy.mkv', 1)).toBe(null);
  });
  it('returns null when nothing is analyzing', () => {
    expect(_autoSelectAnalyzingId(videos, null, null)).toBe(null);
  });
});

describe('_reanalyzeParams', () => {
  const recorded = () => ({
    analyze_run: {
      settings: {
        model: 'large-v3', track_layout: 'game-2track', energy_mode: 'full',
        scene_mode: 'full', speaker_labels: true, contexts: ['ctx-old'],
      },
    },
    context_names: [],
  });

  afterEach(() => { delete globalThis.fetch; });

  it('reuses the original run settings', async () => {
    const params = await _reanalyzeParams(recorded());
    expect(params.model).toBe('large-v3');
    expect(params.profile).toBe('game-2track');
    expect(params.energy_mode).toBe('full');
    expect(params.scene_mode).toBe('full');
    expect(params.diarize).toBe(true);
    expect(params.context_names).toEqual(['ctx-old']);
  });
  it('the current context assignment wins over the recorded one', async () => {
    const params = await _reanalyzeParams({ ...recorded(), context_names: ['ctx-current'] });
    expect(params.context_names).toEqual(['ctx-current']);
  });
  it("the 'default' track layout maps to a null profile", async () => {
    const params = await _reanalyzeParams({
      analyze_run: { settings: { model: 'medium', track_layout: 'default' } },
      context_names: [],
    });
    expect(params.profile).toBe(null);
  });
  it('without a recorded run, falls back to the fetched config', async () => {
    globalThis.fetch = () => Promise.resolve({ json: () => Promise.resolve({ whisper_model: 'small', energy_mode: 'balanced' }) });
    const params = await _reanalyzeParams(null);
    expect(params.model).toBe('small');
    expect(params.energy_mode).toBe('balanced');
    expect(params.profile).toBe(null);
  });
  it('without a recorded run and no config, uses the static defaults', async () => {
    globalThis.fetch = () => Promise.reject(new Error('offline'));
    const params = await _reanalyzeParams(null);
    expect(params.model).toBe('base');
    expect(params.energy_mode).toBe('fast');
  });
});

// bug-hunt 3.4: a non-200 FastAPI response is still valid JSON ({"detail": ...}),
// so an unchecked fetch(...).then(r => r.json()) parses it fine and lands the
// error body straight into AppState.clips - the next render then throws
// ("filter is not a function") and the clip list stops rendering until a full
// page reload. fetchClipsList is the single fetch every AppState.clips reload
// now goes through so that class of bug can't recur at any of its call sites.
describe('fetchClipsList', () => {
  afterEach(() => { delete globalThis.fetch; });

  it('returns the array on a normal 200 response', async () => {
    globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1 }]) });
    expect(await fetchClipsList(7)).toEqual([{ id: 1 }]);
  });

  it('returns null (not the error body) on a non-200 response with a JSON detail', async () => {
    globalThis.fetch = () => Promise.resolve({
      ok: false, status: 503, json: () => Promise.resolve({ detail: 'database is locked' }),
    });
    expect(await fetchClipsList(7)).toBeNull();
  });

  it('returns null when the parsed body is not an array', async () => {
    globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ not: 'a list' }) });
    expect(await fetchClipsList(7)).toBeNull();
  });

  it('returns null on a network failure', async () => {
    globalThis.fetch = () => Promise.reject(new Error('offline'));
    expect(await fetchClipsList(7)).toBeNull();
  });
});

describe('computeVideoFilterCounts', () => {
  const video = (over) => ({ clip_count: 0, clips_scored_at: null, clips_llm_error: 0, ...over });

  it('tallies has-clips, unscored, and error counts', () => {
    const counts = computeVideoFilterCounts([
      video({ clip_count: 3, clips_scored_at: 'x' }),
      video({ clip_count: 0 }),
      video({ clip_count: 5, clips_llm_error: 2 }),
    ]);
    expect(counts).toEqual({ total: 3, hasClips: 2, unscored: 2, errors: 1 });
  });

  it('is all-zero for an empty list', () => {
    expect(computeVideoFilterCounts([])).toEqual({ total: 0, hasClips: 0, unscored: 0, errors: 0 });
  });
});

describe('_isVideoBeingAnalyzed', () => {
  afterEach(() => { AppState.analyzeFilename = null; });

  it('is true when this video matches the in-flight filename and is not done', () => {
    AppState.analyzeFilename = 'a.mkv';
    expect(_isVideoBeingAnalyzed({ filename: 'a.mkv', status: 'transcribing' })).toBe(true);
  });

  it('is false once the recording reaches done, even with a matching filename', () => {
    AppState.analyzeFilename = 'a.mkv';
    expect(_isVideoBeingAnalyzed({ filename: 'a.mkv', status: 'done' })).toBe(false);
  });

  it('is false for a different recording', () => {
    AppState.analyzeFilename = 'a.mkv';
    expect(_isVideoBeingAnalyzed({ filename: 'b.mkv', status: 'transcribing' })).toBe(false);
  });

  it('is false when nothing is analyzing', () => {
    expect(_isVideoBeingAnalyzed({ filename: 'a.mkv', status: 'transcribing' })).toBe(false);
  });
});

describe('_needsModelCtaHTML', () => {
  it('shows the heading, detail, and install CTA by default', () => {
    const html = _needsModelCtaHTML({ heading: 'No model set up', detail: 'Install one to continue.' });
    expect(html).toContain('No model set up');
    expect(html).toContain('Install one to continue.');
    expect(html).toContain('Install a local model');
  });

  it('hides the install CTA when show_cta is false', () => {
    const html = _needsModelCtaHTML({ heading: 'AI is off', detail: 'Generative AI is turned off.', show_cta: false });
    expect(html).not.toContain('Install a local model');
  });
});

describe('_contextsAreStale', () => {
  it('is false for the same set, regardless of order', () => {
    expect(_contextsAreStale(['b', 'a'], ['a', 'b'])).toBe(false);
  });

  it('is true when the assigned set differs from what clips were scored with', () => {
    expect(_contextsAreStale(['a', 'c'], ['a', 'b'])).toBe(true);
  });

  it('is true when contexts were added since scoring', () => {
    expect(_contextsAreStale(['a', 'b'], ['a'])).toBe(true);
  });

  it('is false for two empty sets', () => {
    expect(_contextsAreStale([], [])).toBe(false);
  });
});
