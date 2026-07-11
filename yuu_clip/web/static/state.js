// Feature-map - Shared application state: the single AppState object every feature module reads/writes.
//   API: none (client-only) · Tests: covered indirectly by the test_ui_*.py suites
// ── shared application state ──────────────────────────────────────────────────
// Mutable state shared across feature modules. Centralized in one explicit object
// so cross-module reads/writes are greppable and obviously shared, rather than
// scattered bare globals that look like module locals at the call site.
(function () {
const AppState = {
  activeVideoId:       null,
  activeClipId:        null,
  videos:              [],
  sessions:            [],       // grouped play sessions (RecordingSession rows)
  activeSessionId:     null,     // session whose detail view is open, or null
  clips:               [],
  analyzeProfiles:     [],
  contexts:            [],
  hotWords:            [],
  _hotWordsLoaded:     false,
  sensitiveTerms:      [],
  _sensitiveTermsLoaded: false,
  analyzeFilename:     null,
  editingContextId:    null,
  clipFilters:         new Set(),  // active filter tokens; empty = show all
  clipKind:            'clip',      // candidate type shown: 'clip' | 'scene' (server-side filter)
  clipSearch:          '',
  clipScoreMin:        0,
  videoSearch:         '',
  videoSort:           'recent',
  videoSortDir:        'desc',  // 'desc' = the sort option's natural order; 'asc' reverses it
  clipSortDir:         'desc',
  videoFilters:        new Set(),  // active video filter tokens; empty = show all
  selectedClipIds:     new Set(),
  lastStatusChange:    null, // {clipId, fromStatus, timer}
  lastBulkStatusChange: null, // {previous: {clipId: fromStatus}, timer}
  confirmCallback:     null,
  activeClipData:      null,
  activeMediaFilename: null,
  activeVideoData:     null,
  bootRestoreDone:     false,
  exportDir:           null,
  reelsDir:            null,
  canReveal:           false,
};

Object.assign(window, { AppState });
})();
