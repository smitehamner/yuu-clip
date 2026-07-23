// ESM entry point - the app's whole module graph. esbuild bundles it into
// static/bundle.esm.js (see scripts/build-esm.mjs, run by `yuu-dev bundle`), the
// single script index.html loads. Every UI module is now real ESM; the classic
// bundle.js/bundle.manifest are retired.
//
// The `window.*` assignments at the bottom are a RESIDUAL compatibility shim,
// consolidated (2026-07-23) into two clearly labeled groups - see the big banner
// above the assignments. GROUP 1 is genuine runtime coupling (a JS module or an
// inline on*-handler reads the name off `window`); GROUP 2 is test-only hooks
// (reachable only via a tests/ui `page.evaluate` poke). The split makes the KIND
// of coupling legible; it is not a classic-script bridge. Full per-name drop
// history lives in git and the MODULE-TESTABILITY plan doc.
import { AppState } from './core/state.js';
import * as format from './core/format.js';
import { ColorPicker } from './library/colorpicker.js';
import { PanelNav } from './core/panelnav.js';
import * as jobs from './core/jobs.js';
import {
  showAlert, showConfirm, _confirmCancel,
  toggleHamburger, closeHamburger,
  openControlsModal,
  openDiffModal,
  showKebab, showUndoToast,
} from './core/ui.js';
import {
  openHelpModal, closeHelpModal,
  openGlossaryModal,
} from './core/helpmodals.js';
// shortcuts.js's only export is initShortcuts(), the keydown listener
// registration - imported and called once from boot.js (see
// MODULE-TESTABILITY-PLAN), which main.esm.js already pulls in below.
import {
  refreshModelCatalog,
  gateOnCapability,
} from './settings/modelcatalog.js';
import {
  loadVideos, renderVideoDetail,
  onClipsSortChange, _clipsSortParam, fetchClipsList,
  _updateDemoButton,
  _syncAnalysisLivePanel,
  _renderVideoList,
  setVideoSearch, setVideoSort, toggleVideoSortDir, toggleVideoFilter,
} from './videos/videos.js';
import { regenSummaryAuto } from './videos/videos-summary.js';
import { toggleGroupSelect } from './videos/sessions.js';
import {
  renderDetail,
  toggleClipFilter,
  _applyFilters, _renderClips,
  _renderClipFilterCounts,
  openClipActionsModal,
} from './clips/clips.js';
import { undoLastBulkStatus } from './clips/clipbulk.js';
import {
  closeExportModal,
} from './clips/clipexport.js';
import { openClipCreatePicker } from './clips/clipcreate.js';
import {
  openReanalyzePanel, closeNewRecordingPanel,
  startAnalyze, openNewRecordingPanel,
} from './analyze/analyze.js';
import {
  openHighlightReelsModal,
} from './analyze/reel.js';
import {
  _deriveContextId,
  closeRetranscribeModal,
} from './library/contexts.js';
import {
  openSettings,
} from './settings/settings.js';
// settings-backup.js has no external window consumer left (its two names,
// backupProject and startRestore, were only read by index.html inline handlers,
// now addEventListener inside settings-backup.js itself) - a bare side-effect
// import keeps esbuild pulling it into the bundle and runs its static wiring.
import './settings/settings-backup.js';
import {
  SoundFx, commitSoundSettings,
} from './library/sounds.js';
import { openPeopleView } from './people/voices.js';
import { openExportEditor } from './library/exporteditor.js';
import {
  openSplitEditor, closeSplitEditor,
} from './analyze/split.js';
// boot.js is the first-paint entry point: it must be imported LAST so its
// top-level init (initResize/loadVideos/refreshServerState/...) runs only after
// every other module in the graph has been evaluated. Side-effect import - it
// exports nothing.
import './core/boot.js';

// ============================================================================
// RESIDUAL window.* SHIM - consolidated into two labeled groups
// (Phase 3 of the module-testability plan, 2026-07-23).
//
// This is a readability move, not a testability one: it makes the KIND of
// coupling legible by separating names the APP needs at runtime from names only
// a TEST reaches. Both groups keep every name as a bare `window.X` global, so
// inline on*-handlers, page.evaluate("name()") pokes, and test_ui_globals.py's
// window-function check all keep working unchanged.
//
// Retiring an entry: a GROUP 1 line drops only when its runtime reader is
// converted to a direct import (or the inline handler to addEventListener); a
// GROUP 2 line drops when the poking test is migrated to a tests/js vitest
// import or its page.evaluate is swapped for a real click. Most GROUP 2 entries
// have no such path (the per-cluster note below records why). Full per-name
// drop history is in git and the MODULE-TESTABILITY plan doc.
// ============================================================================

// ---- GROUP 1: genuine production coupling (read off window at runtime) ----
Object.assign(window, format);  // format.js reads window._clipsSortParam
Object.assign(window, jobs);    // jobs.js is cross-cutting; its exports still
                                // have window.* consumers / inline handlers
// jobs.js reads these videos.js/clips.js exports off window - NOT converted to a
// direct import: a jobs.js<->videos/clips edge breaks vitest's
// vi.mock(importActual) resolution (the plan's one documented exception).
window.loadVideos = loadVideos;
window._fetchClipsList = fetchClipsList;
window._updateDemoButton = _updateDemoButton;
window._syncAnalysisLivePanel = _syncAnalysisLivePanel;
window._renderClips = _renderClips;
window._renderClipFilterCounts = _renderClipFilterCounts;
window._clipsSortParam = _clipsSortParam;  // read by format.js as window._clipsSortParam
// panelnav.js / helpmodals.js read these off window explicitly:
window.showConfirm = showConfirm;
window.closeHamburger = closeHamburger;  // + index.html/header.html inline handler
window.PanelNav = PanelNav;              // index.html + split-editor.html inline handlers
// index.html/sidebar.html inline on*-handlers call these:
window.onClipsSortChange = onClipsSortChange;
window.setVideoSearch = setVideoSearch;
window.setVideoSort = setVideoSort;
window.toggleVideoSortDir = toggleVideoSortDir;
window.toggleVideoFilter = toggleVideoFilter;
// bare-global reads (shortcuts.js/clips.js) or the module's own onclick-string
// self-reference (a _diarizationNoteHtml "Settings" link built as an innerHTML
// onclick attribute, evaluated in global scope when clicked):
window.undoLastBulkStatus = undoLastBulkStatus;          // clips.js bare-global
window.closeExportModal = closeExportModal;              // clipexport.js onclick-string
window.closeNewRecordingPanel = closeNewRecordingPanel;  // analyze.js onclick-string
window.closeRetranscribeModal = closeRetranscribeModal;  // contexts.js onclick-string
window.openSettings = openSettings;                      // analyze/contexts/clipexport/modelcatalog onclick-string

// ---- GROUP 2: test-only hooks (reachable ONLY via a tests/ui page.evaluate
//      poke; no production JS/HTML reader) ----
// Kept as bare window globals purely so page.evaluate("name()") resolves. Why
// each cluster can't currently be dropped (verified per-file across prior
// sessions - regenerate the shim inventory and re-read the file before
// attempting any drop):
//  * Synthetic-state seeds - the test hand-builds an AppState / clip / video
//    combination no fixture project or real click sequence produces:
//    AppState, renderDetail, renderVideoDetail, _renderVideoList,
//    regenSummaryAuto, openReanalyzePanel, openClipActionsModal (its merge
//    tests), _deriveContextId + _applyFilters (compute an expected value for
//    comparison, not a trigger).
//  * Modal/panel overlay blocks the real trigger by design - the test stacks a
//    modal/panel to verify Escape/focus layering and the real button is covered:
//    showAlert, showKebab, toggleHamburger, openControlsModal, openGlossaryModal,
//    openSplitEditor, closeSplitEditor, _confirmCancel (teardown dirty-guard
//    bypass), toggleClipFilter (chip hidden inside a collapsed expander),
//    openNewRecordingPanel (its header button sits under the PanelNav overlay
//    when a flow like the Split Editor is open - the real click can't reach it,
//    but a drag-and-drop file onto the window calls it directly; bug-hunt 3.2).
//  * No reachable precondition - startAnalyze's button is disabled until a real
//    probe against a real file succeeds (the fixture has none);
//    openHighlightReelsModal is poked with a 'view' arg the single real
//    (build-only) button can't reach; toggleGroupSelect's real-click swap was
//    tried and reverted (list re-render races Playwright's actionability retry -
//    see test_ui_sessions.py).
//  * Setup shortcut with no cheaper real path yet, or a real-browser-only
//    sibling behavior (audio, geometry, string-indirection mount): ColorPicker,
//    SoundFx, commitSoundSettings, openHelpModal, closeHelpModal,
//    refreshModelCatalog, gateOnCapability, openPeopleView, openExportEditor,
//    openClipCreatePicker, showUndoToast, openDiffModal (tests the modal's own
//    generic dirty-check, decoupled from any one real caller on purpose).
Object.assign(window, {
  AppState, ColorPicker,
  showAlert, _confirmCancel, toggleHamburger, openControlsModal, openDiffModal,
  showKebab, showUndoToast,
  openHelpModal, closeHelpModal, openGlossaryModal,
  refreshModelCatalog, gateOnCapability,
  renderVideoDetail, _renderVideoList, regenSummaryAuto, toggleGroupSelect,
  renderDetail, toggleClipFilter, _applyFilters, openClipActionsModal,
  openClipCreatePicker,
  openReanalyzePanel, startAnalyze, openNewRecordingPanel,
  openHighlightReelsModal,
  _deriveContextId,
  SoundFx, commitSoundSettings,
  openPeopleView, openExportEditor,
  openSplitEditor, closeSplitEditor,
});
