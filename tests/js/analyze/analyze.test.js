// _showAnalysisToast (static/analyze/analyze.js) - the "Analysis complete" toast,
// which offers a Review jump only when the finished recording isn't already open.
// Ported from tests/ui/test_ui_toasts.py. It calls the real showToast, so a real
// toast lands in #toast-container; fake timers keep its auto-dismiss deterministic.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import { _showAnalysisToast } from '../../../yuu_clip/web/static/analyze/analyze.js';

describe('_showAnalysisToast', () => {
  const toast = () => document.getElementById('toast-container').querySelector('.toast.success');
  const hasReview = () => [...toast().querySelectorAll('button')].some((b) => b.textContent === 'Review');
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); AppState.activeVideoId = null; });

  it('offers a Review jump when the finished recording is not already open', () => {
    AppState.activeVideoId = null;
    _showAnalysisToast({ id: -1, clip_count: 3 });
    expect(toast().textContent).toContain('Analysis complete - 3 clips found');
    expect(hasReview()).toBe(true);
  });
  it('omits Review when that recording is already open', () => {
    AppState.activeVideoId = -1;
    _showAnalysisToast({ id: -1, clip_count: 1 });
    expect(toast().textContent).toContain('Analysis complete - 1 clip found');
    expect(hasReview()).toBe(false);
  });
});
