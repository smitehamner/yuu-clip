// Pure recording-list filter/sort and split re-analysis params in static/videos/videos.js.
// Ported from tests/ui/test_ui_utils.py (TestVideoFilters) and test_ui_split.py
// (TestReanalyzeParams). The config-fallback path fetches /api/config; here that fetch
// is stubbed so the assertion is deterministic instead of coupled to the dev's real config.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import {
  _applyVideoFilters, _reanalyzeParams, _analysisLivePanelHTML, _syncAnalysisLivePanel,
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
    expect(params.model).toBe('medium');
    expect(params.energy_mode).toBe('fast');
  });
});
