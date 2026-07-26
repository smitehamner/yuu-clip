// Feature-map - Refresh-hook registry: the dependency-inversion seam that lets the
//   cross-cutting job machinery (core/jobs.js) and the pure formatters (core/format.js)
//   trigger a videos/clips re-render WITHOUT importing those modules.
//   API: none (client-only)
//   Tests: tests/js/core/refreshhooks.test.js, tests/js/core/jobs.test.js, tests/js/core/format.test.js
//
// WHY this exists instead of a direct import: a jobs.js -> videos/clips (or
// format.js -> videos) import adds an edge that esbuild bundles fine but that breaks
// vitest's vi.mock/importActual resolution - the real streamSSE runs instead of the
// mock (the one documented exception in CLAUDE.md). So boot.js registers the concrete
// render fns here once at startup, and jobs.js/format.js read them back through this
// leaf. This module imports nothing from the app graph, so it adds no edge vi.mock
// cares about - it replaces the old implicit `window.loadVideos`/`window._renderClips`
// contract with an explicit one (the same make_*-factory dependency inversion the
// Python backend uses).

const _hooks = {};

// Registered once from boot.js after videos.js/clips.js are imported. Idempotent and
// additive - a later call overrides a name (used by vitest to install per-case fakes).
function registerRefreshHooks(hooks) {
  Object.assign(_hooks, hooks);
}

// Test-only reset so a vitest case starts from a known-empty registry.
function _resetRefreshHooks() {
  for (const key of Object.keys(_hooks)) delete _hooks[key];
}

// Stand-in for a hook read before boot.js registered it (or in a test with no fake
// installed): the call is skipped and returns undefined, preserving the old
// `if (window.X) X()` guard semantics - never a ReferenceError.
function _noop() {}

// Typed accessors: each dispatches to the registered fn or no-ops. Reading `_hooks[k]`
// lazily (not capturing at module-eval time) is what lets boot.js register after import.
const refreshHooks = {
  loadVideos:             (...args) => (_hooks.loadVideos             || _noop)(...args),
  fetchClipsList:         (...args) => (_hooks.fetchClipsList         || _noop)(...args),
  renderClips:            (...args) => (_hooks.renderClips            || _noop)(...args),
  renderClipFilterCounts: (...args) => (_hooks.renderClipFilterCounts || _noop)(...args),
  updateDemoButton:       (...args) => (_hooks.updateDemoButton       || _noop)(...args),
  syncAnalysisLivePanel:  (...args) => (_hooks.syncAnalysisLivePanel  || _noop)(...args),
  clipsSortParam:         (...args) => (_hooks.clipsSortParam         || _noop)(...args),
};

export { refreshHooks, registerRefreshHooks, _resetRefreshHooks };
