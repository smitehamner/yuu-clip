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
import { fmtDuration } from './core/format.js';
import { ColorPicker } from './library/colorpicker.js';
import * as jobs from './core/jobs.js';
import {
  showAlert, showConfirm, _confirmCancel,
  toggleHamburger,
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
  renderVideoDetail,
  _renderVideoList,
  toggleVideoFilter,
} from './videos/videos.js';
import { regenSummaryAuto } from './videos/videos-summary.js';
import { toggleGroupSelect } from './videos/sessions.js';
import {
  renderDetail,
  toggleClipFilter,
  _applyFilters, _renderClips,
  openClipActionsModal,
} from './clips/clips.js';
import {
  closeExportModal,
} from './clips/clipexport.js';
import { openClipCreatePicker } from './clips/clipcreate.js';
import {
  openReanalyzePanel,
  startAnalyze, openNewRecordingPanel,
} from './analyze/analyze.js';
import {
  openHighlightReelsModal,
} from './analyze/reel.js';
import {
  _deriveContextId,
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
// (Phase 3 of the module-testability plan, 2026-07-23; GROUP 1 drained to the
// jobs.js/format.js cluster in the ui-shim-retirement plan's Phase 1, 2026-07-24,
// then that cluster itself moved behind core/refreshhooks.js in Phase 2, 2026-07-25 -
// every name that moved to a real addEventListener/import/registration seam lost its
// production reader and either dropped entirely or, if a tests/ui page.evaluate still
// pokes it, moved down to GROUP 2. GROUP 1 is now the single Object.assign(window, jobs)
// spread that inline onclick markup built by videos.js still depends on).
//
// This is a readability move, not a testability one: it makes the KIND of
// coupling legible by separating names the APP needs at runtime from names only
// a TEST reaches. Both groups keep every name as a bare `window.X` global, so
// page.evaluate("name()") pokes and test_ui_globals.py's window-function check
// all keep working unchanged.
//
// Retiring an entry: a GROUP 1 line drops only when its runtime reader is
// converted to a direct import (or the inline handler to addEventListener); a
// GROUP 2 line drops when the poking test is migrated to a tests/js vitest
// import or its page.evaluate is swapped for a real click. Most GROUP 2 entries
// have no such path (the per-cluster note below records why). Full per-name
// drop history is in git and the MODULE-TESTABILITY plan doc.
// ============================================================================

// ---- GROUP 1: genuine production coupling (read off window at runtime) ----
// Phase 2 (2026-07-25) moved jobs.js's own refresh reads and format.js's
// _clipsSortParam behind the core/refreshhooks.js registration seam, so no individual
// window.* assignment remains. The lone survivor, Object.assign(window, jobs), turns
// out to have NO production reader: videos.js imports cancelJob/togglePauseJob and
// invokes them via data-act event delegation (videos.js's action dispatch), not an
// inline onclick string. Its only consumers are tests/ui page.evaluate pokes
// (startJobUI/updateJobUI/endJobUI/streamSSE/_blockedByAnalyze/...), so it is really a
// GROUP 2 test-only bridge kept - for now - as a blanket spread. Narrowing it to just
// the poked names and moving it into the GROUP 2 block below (which empties GROUP 1)
// is the scoped follow-on.
Object.assign(window, jobs);

// ---- GROUP 2: test-only hooks (reachable ONLY via a tests/ui page.evaluate
//      poke; no production JS/HTML reader) ----
// Kept as bare window globals purely so page.evaluate("name()") resolves. Why
// each cluster can't currently be dropped (verified per-file across prior
// sessions - regenerate the shim inventory and re-read the file before
// attempting any drop):
//  * Synthetic-state seeds - the test hand-builds an AppState / clip / video
//    combination no fixture project or real click sequence produces:
//    AppState, renderDetail, renderVideoDetail, _renderVideoList, _renderClips
//    (many tests seed AppState.clips then re-paint the list directly),
//    regenSummaryAuto, openReanalyzePanel, openClipActionsModal (its merge
//    tests), _deriveContextId + _applyFilters + fmtDuration (compute an expected
//    value for comparison, not a trigger; fmtDuration was the sole live poke left
//    in format.js's names, so its blanket Object.assign(window, format) dropped in
//    Phase 2 and just this one name moved here).
//  * Modal/panel overlay blocks the real trigger by design - the test stacks a
//    modal/panel to verify Escape/focus layering and the real button is covered:
//    showAlert, showKebab, toggleHamburger, openControlsModal, openGlossaryModal,
//    openSplitEditor, closeSplitEditor, _confirmCancel (teardown dirty-guard
//    bypass), toggleClipFilter (chip hidden inside a collapsed expander),
//    openNewRecordingPanel (its header button sits under the PanelNav overlay
//    when a flow like the Split Editor is open - the real click can't reach it,
//    but a drag-and-drop file onto the window calls it directly; bug-hunt 3.2),
//    showConfirm (test_ui_keyboard.py stacks it to verify focus-trap layering).
//  * No reachable precondition - startAnalyze's button is disabled until a real
//    probe against a real file succeeds (the fixture has none);
//    openHighlightReelsModal is poked with a 'view' arg the single real
//    (build-only) button can't reach; toggleGroupSelect's real-click swap was
//    tried and reverted (list re-render races Playwright's actionability retry -
//    see test_ui_sessions.py); toggleVideoFilter's 'unscored'/'errors' tokens
//    live inside the collapsed "More filters" expander (test_ui_video.py).
//  * Setup shortcut with no cheaper real path yet, or a real-browser-only
//    sibling behavior (audio, geometry, string-indirection mount): ColorPicker,
//    SoundFx, commitSoundSettings, openHelpModal, closeHelpModal,
//    refreshModelCatalog, gateOnCapability, openPeopleView, openExportEditor,
//    openClipCreatePicker, showUndoToast, openDiffModal (tests the modal's own
//    generic dirty-check, decoupled from any one real caller on purpose);
//    closeExportModal / openSettings (many tests jump straight to a modal state
//    via page.evaluate rather than driving the real open->close click sequence).
Object.assign(window, {
  AppState, ColorPicker, fmtDuration,
  showAlert, showConfirm, _confirmCancel, toggleHamburger, openControlsModal, openDiffModal,
  showKebab, showUndoToast,
  openHelpModal, closeHelpModal, openGlossaryModal,
  refreshModelCatalog, gateOnCapability,
  renderVideoDetail, _renderVideoList, regenSummaryAuto, toggleGroupSelect,
  toggleVideoFilter,
  renderDetail, toggleClipFilter, _applyFilters, _renderClips, openClipActionsModal,
  openClipCreatePicker,
  openReanalyzePanel, startAnalyze, openNewRecordingPanel,
  openHighlightReelsModal,
  _deriveContextId,
  SoundFx, commitSoundSettings,
  openPeopleView, openExportEditor,
  openSplitEditor, closeSplitEditor,
  closeExportModal, openSettings,
});
