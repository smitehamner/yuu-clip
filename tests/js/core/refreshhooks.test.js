// The dependency-inversion seam that lets jobs.js/format.js trigger a
// videos/clips re-render without importing those modules (see the WHY comment
// in the source). Its registration/dispatch/no-op-fallback contract is
// exercised for individual hooks as test fixtures in jobs.test.js and
// format.test.js, but never for the module's own guarantees in isolation -
// covering those here.
import { refreshHooks, registerRefreshHooks, _resetRefreshHooks } from '../../../yuu_clip/web/static/core/refreshhooks.js';

afterEach(() => { _resetRefreshHooks(); });

describe('registerRefreshHooks + refreshHooks dispatch', () => {
  it('dispatches a call to the registered function with its arguments', () => {
    const loadVideos = vi.fn();
    registerRefreshHooks({ loadVideos });
    refreshHooks.loadVideos('a', 'b');
    expect(loadVideos).toHaveBeenCalledWith('a', 'b');
  });

  it('returns the registered function\'s return value', () => {
    registerRefreshHooks({ clipsSortParam: () => 'score_desc' });
    expect(refreshHooks.clipsSortParam()).toBe('score_desc');
  });

  it('is additive across separate calls - registering one hook does not clear another', () => {
    const loadVideos = vi.fn();
    const fetchClipsList = vi.fn();
    registerRefreshHooks({ loadVideos });
    registerRefreshHooks({ fetchClipsList });
    refreshHooks.loadVideos();
    refreshHooks.fetchClipsList();
    expect(loadVideos).toHaveBeenCalledTimes(1);
    expect(fetchClipsList).toHaveBeenCalledTimes(1);
  });

  it('a later registration overrides an earlier one for the same key', () => {
    const first = vi.fn();
    const second = vi.fn();
    registerRefreshHooks({ loadVideos: first });
    registerRefreshHooks({ loadVideos: second });
    refreshHooks.loadVideos();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('calling an unregistered hook is a safe no-op, not a throw', () => {
    expect(() => refreshHooks.renderClips()).not.toThrow();
    expect(refreshHooks.renderClips()).toBeUndefined();
  });

  it('_resetRefreshHooks clears a previously registered hook back to a no-op', () => {
    const loadVideos = vi.fn();
    registerRefreshHooks({ loadVideos });
    _resetRefreshHooks();
    expect(() => refreshHooks.loadVideos()).not.toThrow();
    expect(loadVideos).not.toHaveBeenCalled();
  });

  it('every documented hook key dispatches independently', () => {
    const spies = {
      loadVideos: vi.fn(), fetchClipsList: vi.fn(), renderClips: vi.fn(),
      renderClipFilterCounts: vi.fn(), updateDemoButton: vi.fn(),
      syncAnalysisLivePanel: vi.fn(), clipsSortParam: vi.fn(),
    };
    registerRefreshHooks(spies);
    for (const key of Object.keys(spies)) refreshHooks[key]();
    for (const key of Object.keys(spies)) expect(spies[key]).toHaveBeenCalledTimes(1);
  });
});
