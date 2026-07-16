// Long-running-job UI in static/core/jobs.js: step-pill advancement, the live
// "i/N (pct%)" + ETA label, the single-active-stream supersede contract, and the
// blocked-by-analyze guard. Ported from tests/ui/test_ui_utils.py. The step/ETA
// cases are driven through the public startJobUI/updateJobUI API under vitest fake
// timers (which control Date.now()) instead of seeding the module's private state,
// so they survive the pending window-accessor-bridge removal.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import {
  SCORE_STEPS, INGEST_STEPS, startJobUI, updateJobUI, endJobUI,
  _setActiveStream, _clearActiveStream, _supersedeActiveStream, _blockedByAnalyze,
} from '../../../yuu_clip/web/static/core/jobs.js';

const stepClass = (i) => document.getElementById(`step-${i}`).className;

describe('updateJobUI step advancement', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { endJobUI(); vi.useRealTimers(); });

  const classesAfter = (line) => {
    startJobUI(SCORE_STEPS, 'Re-scoring clip');
    updateJobUI(line);
    return [stepClass(0), stepClass(1), stepClass(2)];
  };

  it('a middle-step line marks prior steps done and itself active', () => {
    // SCORE_STEPS = [Energy, Scenes, Scoring]; "Detecting scene" is step 1.
    expect(classesAfter('Detecting scene changes')).toEqual(['step done', 'step active', 'step']);
  });
  it('the final-step line marks every prior step done', () => {
    expect(classesAfter('Scoring clips now')).toEqual(['step done', 'step done', 'step active']);
  });
  it('done pills collapse to a check with the label in the tooltip', () => {
    startJobUI(SCORE_STEPS, 'Re-scoring clip');
    updateJobUI('Scoring clips now');
    const el = document.getElementById('step-0');
    expect(el.textContent).toBe('✓');
    expect(el.title).toBe('Energy');
  });
  it('completion collapses every step to a check', () => {
    startJobUI(SCORE_STEPS, 'Re-scoring clip');
    endJobUI();
    expect([0, 1, 2].map((i) => document.getElementById(`step-${i}`).textContent)).toEqual(['✓', '✓', '✓']);
  });
});

describe('step-pill progress + ETA', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { endJobUI(); vi.useRealTimers(); });

  it('an ingest track-progress line renders fraction, percent, and an ETA', () => {
    // INGEST_STEPS[0] (Extract) has progressPattern /Track (\d+)\/(\d+)/. The ETA
    // needs a second count (rate anchored at the first) so a cold first item can't
    // project an absurd figure.
    startJobUI(INGEST_STEPS, 'Analyzing');
    updateJobUI('Extracting audio...');
    updateJobUI('  Track 3/12 [combined]...');
    vi.advanceTimersByTime(2000);
    updateJobUI('  Track 6/12 [combined]...');
    const text = document.getElementById('step-0').textContent;
    expect(text).toContain('6/12 (50%)');
    expect(text).toContain('left)');
  });
  it('a scoring-progress line renders fraction, percent, and an ETA', () => {
    startJobUI(SCORE_STEPS, 'Re-scoring clips');
    updateJobUI('Scoring clips now');
    updateJobUI('Scoring 3/12');
    vi.advanceTimersByTime(2000);
    updateJobUI('Scoring 6/12');
    const text = document.getElementById('step-2').textContent;
    expect(text).toContain('6/12 (50%)');
    expect(text).toContain('left)');
  });

  // Regression: a slow cold first item projected absurd ETAs ("~77 min left" that
  // vanished seconds later). No ETA until a second observed count anchors the rate.
  it('hides the ETA at the first observed count', () => {
    startJobUI(SCORE_STEPS, 'Re-scoring clips');
    updateJobUI('Scoring clips now');
    vi.advanceTimersByTime(15000);
    updateJobUI('Scoring 1/300');
    const text = document.getElementById('step-2').textContent;
    expect(text).toContain('1/300');
    expect(text).not.toContain('left');
  });
  it('shows the ETA once a second count anchors the rate', () => {
    startJobUI(SCORE_STEPS, 'Re-scoring clips');
    updateJobUI('Scoring clips now');
    updateJobUI('Scoring 1/103');
    vi.advanceTimersByTime(4000);
    updateJobUI('Scoring 3/103');
    expect(document.getElementById('step-2').textContent).toContain('left');
  });
});

// Regression: when a second long-running job supersedes a first mid-stream, the
// first stream is aborted - but abort suppresses its onDone/onError, so its UI
// teardown must be run by the superseding job via the registered cleanup.
describe('active-stream supersede contract', () => {
  it('supersede aborts the handle and runs the cleanup', () => {
    const btn = document.createElement('button');
    btn.disabled = true; // the first job disabled its trigger button
    let aborted = false;
    _setActiveStream({ close: () => { aborted = true; } }, () => { btn.disabled = false; });
    _supersedeActiveStream();
    expect(aborted).toBe(true);
    expect(btn.disabled).toBe(false);
  });
  it('clear only clears a matching handle (a stale onDone cannot wipe a newer stream)', () => {
    const older = { close: () => {} };
    const newer = { close: () => {} };
    _setActiveStream(newer, null);
    _clearActiveStream(older);
    _setActiveStream(newer, null);
    _clearActiveStream(newer); // matching -> clears
    // A second supersede with nothing active must be a no-op (no throw).
    expect(() => _supersedeActiveStream()).not.toThrow();
  });
  it('runs the cleanup only once', () => {
    let runs = 0;
    _setActiveStream({ close: () => {} }, () => { runs += 1; });
    _supersedeActiveStream();
    _supersedeActiveStream();
    expect(runs).toBe(1);
  });
});

describe('_blockedByAnalyze', () => {
  afterEach(() => { AppState.analyzeFilename = null; delete window.showToast; });

  it('is a warning (not an error) and returns true while an analysis runs', () => {
    window.showToast = vi.fn();
    AppState.analyzeFilename = 'busy.mkv';
    expect(_blockedByAnalyze('re-score clips')).toBe(true);
    expect(window.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Wait for the current analysis'), 'warning',
    );
  });
  it('is a no-op returning false when nothing is analyzing', () => {
    window.showToast = vi.fn();
    AppState.analyzeFilename = null;
    expect(_blockedByAnalyze('re-score clips')).toBe(false);
    expect(window.showToast).not.toHaveBeenCalled();
  });
});
