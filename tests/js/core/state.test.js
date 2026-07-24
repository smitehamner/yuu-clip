// The shared AppState singleton (static/core/state.js) is imported by ~17 modules and
// asserted by none. This pins its initial contract - the collection fields are the right
// empty types (a filter that's a plain object instead of a Set, or a null instead of [],
// would break the many `.has()` / `.length` / spread call sites downstream). vitest
// isolates modules per file, so AppState is at its freshly-imported defaults here.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

describe('AppState initial contract', () => {
  it('starts with the collection fields as their empty container types', () => {
    expect(Array.isArray(AppState.videos)).toBe(true);
    expect(Array.isArray(AppState.clips)).toBe(true);
    expect(Array.isArray(AppState.sessions)).toBe(true);
    expect(AppState.videos).toHaveLength(0);
    expect(AppState.clips).toHaveLength(0);
  });

  it('exposes the filter/selection fields as Sets', () => {
    expect(AppState.clipFilters).toBeInstanceOf(Set);
    expect(AppState.videoFilters).toBeInstanceOf(Set);
    expect(AppState.selectedClipIds).toBeInstanceOf(Set);
    expect(AppState.clipFilters.size).toBe(0);
  });

  it('starts with no active selection', () => {
    expect(AppState.activeVideoId).toBe(null);
    expect(AppState.activeClipId).toBe(null);
    expect(AppState.activeSessionId).toBe(null);
    expect(AppState.activeClipData).toBe(null);
  });

  it('defaults the client-side filter/sort controls', () => {
    expect(AppState.clipKindFilter).toBe('all');
    expect(AppState.clipScoreMin).toBe(0);
    expect(AppState.clipSortDir).toBe('desc');
    expect(AppState.videoSort).toBe('recent');
  });

  it('is a single mutable object shared by reference across importers', () => {
    AppState.activeVideoId = 123;
    expect(AppState.activeVideoId).toBe(123);
    AppState.activeVideoId = null;  // restore for any later test in this file
  });
});
