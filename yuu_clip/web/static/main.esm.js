// ESM entry point - the app's whole module graph. esbuild bundles it into
// static/bundle.esm.js (see scripts/build-esm.mjs, run by `yuu-dev bundle`), the
// single script index.html loads. Every UI module is now real ESM; the classic
// bundle.js/bundle.manifest are retired.
//
// The `window.X = X` block below is a RESIDUAL compatibility shim, not a classic-
// script bridge anymore. Each remaining line exists for one of two reasons:
//   1. an already-ESM module still reads the name off `window` (a `window.foo`
//      call site that was never converted to an `import`), or
//   2. a Playwright ui test pokes it via `page.evaluate` (a page global).
// The per-section "(bundle.js) consumer" notes further down are HISTORICAL - no
// classic consumer exists now. Retiring this shim is the vitest follow-on: convert
// the window.* read sites to imports and delete the page.evaluate pokes, then the
// matching lines here drop and the window surface trends to empty.
import { AppState } from './core/state.js';
import * as format from './core/format.js';
import { ColorPicker } from './library/colorpicker.js';
import { PanelNav } from './core/panelnav.js';
import * as jobs from './core/jobs.js';
import {
  showToast, copyText,
} from './core/utils.js';
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
  onClipsSortChange, _clipsSortParam, _clipsListUrl,
  _updateDemoButton,
  _syncAnalysisLivePanel,
  _renderVideoList,
  setVideoSearch, setVideoSort, toggleVideoSortDir, toggleVideoFilter,
} from './videos/videos.js';
import { regenSummaryAuto } from './videos/videos-summary.js';
import { toggleGroupSelect } from './videos/sessions.js';
import {
  renderDetail, renderPlayer, refreshClipDetail,
  toggleClipFilter,
  _applyFilters, _renderClips, _reloadClipList,
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
  startAnalyze,
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

window.AppState = AppState;
Object.assign(window, format);
window.ColorPicker = ColorPicker;
window.PanelNav = PanelNav;
// utils.js - showToast/copyText are invoked directly by tests/ui/*.py
// via page.evaluate; no JS module reads either of them off window anymore.
// revealInFolder dropped (2026-07-22): its only "reader" left was a comment in
// test_ui_clips2.py naming it in prose (the actual poke moved to
// tests/js/clips/clipexport.test.js already) - every real caller
// (videos.js/clipexport.js/reel.js) already imports it directly.
// clearLog/appendLog dropped: tests/js/core/utils.test.js already
// imports both directly. _syncSortDirBtn, _diarizationReadiness, netErrMsg and
// collapsibleCard dropped: every remaining reader (clips.js/videos.js/boot.js
// etc.) now imports them directly. toggleLog, isCardCollapsed,
// _diarizationReason and _diarizationNoteHtml were dropped earlier as their
// only external consumers migrated to ESM imports or (the diarization
// helpers) to the tests/js vitest unit layer. openLog dropped 2026-07-22:
// every real caller already imports it directly and its only "reader" in
// test_ui_analyze.py was a comment, not a real poke.
window.showToast = showToast;
window.copyText = copyText;
// jobs.js is cross-cutting - every export here still has at least one classic
// window.* consumer or a still-present inline handler, so none can be dropped yet.
// Its mutable shared-state (_jobStepDefs/_activeStepIdx/_jobStartTime) is now read
// cross-module via live ESM imports (videos.js), not off window; _abortActiveStream
// is the one function conftest teardown calls to close a dangling stream. The old
// window get/set accessor-bridge for that state is gone.
Object.assign(window, jobs);
// preview.js - no window shim left. setupRecordingPreview's classic
// consumers (clipcreate.js, videos.js, split.js, exporteditor.js) all import
// it directly now; _buildMediaUrl's only test dependency
// (tests/ui/test_ui_video.py::TestNativeMediaProtocolUrlBuilder) moved to
// tests/js/core/preview.test.js (2026-07-22) since it is a pure function.
// ui.js - showAlert/openDiffModal/showKebab/showUndoToast have no JS reader
// left and are kept only for tests/ui/*.py or tests/js/*.test.js page.evaluate
// pokes. playbackRatePref/applyPlaybackRate dropped 2026-07-22: their only
// pokes (test_ui_settings.py::TestPlaybackSpeed) were pure logic (localStorage
// read + a detached <video>'s .playbackRate property, no real
// navigation/geometry) and ported verbatim to tests/js/core/ui.test.js.
// _applyPrereqWarnings dropped 2026-07-23: boot.js already imports it
// directly, and its only "reader" in test_ui_modeldownload.py was a prose
// comment about a test already moved to tests/js/core/ui.test.js, not a real
// poke.
// _confirmCancel/toggleHamburger/openControlsModal are ALSO invoked directly
// by tests/ui/*.py, even though shortcuts.js's own read of each already
// imports it directly. toggleHamburger's two test_ui_clips2.py pokes became
// real #btn-hamburger clicks (2026-07-22), but test_ui_keyboard.py's
// test_hamburger_menu_peels_before_modal still needs the poke:
// #controls-modal's overlay covers the real button there by design (the
// test verifies Escape-layering works even though the real UI would never let
// a user reach the hamburger while a modal sits on top) - a real click
// reliably fails to register there, so the shim line stays. closeHamburger
// and showConfirm stay for a
// real reason: helpmodals.js and panelnav.js still read them off `window.*`
// explicitly. closeAlertModal, openActionsModal, topmostVisibleModal,
// _menuArrowKeydown, isHamburgerOpen, closeControlsModal, _diffDiscard,
// openFieldEditModal, closeFieldEditModal, closeKebab, initResize and
// initPlaybackRate dropped: shortcuts.js/boot.js already import all of them
// directly and no test pokes any of them. _confirmOk, _diffAcceptNew,
// _diffAcceptEdit and _fieldEditSave dropped earlier: their only consumers
// were ui.js's own inline handlers, now addEventListener inside ui.js itself.
// closeActionsModal dropped 2026-07-22: shortcuts.js already imports it
// directly and its only remaining "reader" was a comment naming it in
// test_ui_video.py, not a real poke.
window.showAlert = showAlert;
window.showConfirm = showConfirm;
window._confirmCancel = _confirmCancel;
window.toggleHamburger = toggleHamburger;
window.closeHamburger = closeHamburger;
window.openControlsModal = openControlsModal;
window.openDiffModal = openDiffModal;
window.showKebab = showKebab;
window.showUndoToast = showUndoToast;
// helpmodals.js - openHelpModal/closeHelpModal are invoked directly by
// tests/ui/*.py via page.evaluate. _filterGlossary dropped: settings.js (its
// only reader) already imports it directly.
// openGettingStartedModal/closeGettingStartedModal dropped 2026-07-22:
// test_ui_whisper_prefetch.py::TestGettingStartedModal now drives the real
// first-run flow (a fresh, un-seeded browser context so boot.js's own
// `if (!localStorage.getItem('yuu-getting-started-seen')) openGettingStartedModal()`
// opens it for real) and closes it via the real #getting-started-close-btn.
// closeGlossaryModal dropped 2026-07-22: test_ui_settings.py::TestGlossaryFilter
// now closes it via the real #glossary-modal-close-btn. openGlossaryModal
// STAYS: test_ui_settings.py opens it via the real #btn-hamburger ->
// #hamburger-item-glossary path now, but test_ui_keyboard.py still pokes it
// directly to stack the glossary modal on top of an already-open Settings
// panel / controls modal for Escape-layering tests - the real hamburger
// button is unreachable there by design (same class as toggleHamburger).
// openAboutModal/closeAboutModal dropped 2026-07-22: test_ui_page.py now opens
// it via the real #btn-hamburger -> #hamburger-item-about path and closes it
// via the real #about-modal-close-btn - no other reader anywhere in tests/.
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.openGlossaryModal = openGlossaryModal;
// modelcatalog.js - refreshModelCatalog and gateOnCapability are invoked
// directly by tests/ui/test_ui_model_catalog.py via page.evaluate.
// _renderCapabilityTiers dropped 2026-07-22: settings.js and modeldownload.js
// already import it directly, and its only "reader" in test_ui_settings.py was
// a prose comment naming it, not a real poke - tests/js/settings/
// modelcatalog.test.js already imports it directly too.
// _ensureModelCatalog and _updateLlmCapabilities dropped: settings.js/
// modeldownload.js already import both directly and no test pokes either.
// prefetchModel and downloadGgufModel dropped earlier: both are wired
// internally via addEventListener/data-* delegation and have no outside caller.
window.refreshModelCatalog = refreshModelCatalog;
window.gateOnCapability = gateOnCapability;
// videos.js is cross-cutting - every remaining name here still has at least one
// classic (bundle.js) consumer or a tests/ui/*.py page.evaluate. _clipsSortParam is
// CRITICAL: format.js (already ESM) reads it as window._clipsSortParam, so it
// can never be dropped even if every classic consumer goes away. loadVideos,
// _clipsListUrl, _updateDemoButton and _syncAnalysisLivePanel are read as window.*
// by jobs.js - NOT converted to a direct import: jobs.js is heavily vi.mock'd
// with importActual() across tests/js, and jobs.js<->videos.js is a genuine cycle
// (videos.js already imports jobs.js) that broke Vitest's mock resolution (real
// streamSSE ran instead of the mocked one, corrupting clipbulk.test.js,
// vision.test.js and videos-summary.test.js) even though esbuild bundles it fine -
// reverted, kept on the window shim deliberately. onClipsSortChange/
// setVideoSearch/setVideoSort/toggleVideoSortDir/toggleVideoFilter are read by
// index.html's inline onclick/onchange attributes (sidebar.html), not any JS
// module. openVideoActionsModal dropped 2026-07-23: its only poke
// (test_ui_hotwords.py) real-swapped to a click on the video detail's own
// ".vid-actions button:has-text('Additional Actions')" - the same real path
// open_split_editor (conftest.py) already uses.
// _needsModelCtaHTML and _updateStartIngestButton dropped: their only readers
// (videos-summary.js/videos-timeline.js and analyze.js) already import both
// directly. Eleven names (reanalyzeVideo,
// rediarizeVideo, reextractVideoRun, retranscribeVideoRun, regenerateClipsRun,
// unsplitVideo, _doUnsplitVideo, openVideoSummaryKebab, openVideoTitleKebab,
// _syncVideoFilterChips, _clearVideoFilters) dropped earlier: their only callers
// were videos.js's own inline handlers (now data-act delegation) or its own
// internal logic, so nothing outside the module needs them off window.
// selectVideo/deleteVideo dropped 2026-07-22: both had exactly one remaining
// tests/ui/test_ui_video.py poke, swapped for a real click (the video-list
// item, and the Additional Actions modal's Remove Recording row) - the same
// request-shape behavior each poke was standing in for is already covered
// browserless in tests/js/videos/videosdelete.test.js.
window.loadVideos = loadVideos;
window.renderVideoDetail = renderVideoDetail;
window.onClipsSortChange = onClipsSortChange;
window._clipsSortParam = _clipsSortParam;
window._clipsListUrl = _clipsListUrl;
window._updateDemoButton = _updateDemoButton;
window._syncAnalysisLivePanel = _syncAnalysisLivePanel;
window._renderVideoList = _renderVideoList;
window.setVideoSearch = setVideoSearch;
window.setVideoSort = setVideoSort;
window.toggleVideoSortDir = toggleVideoSortDir;
window.toggleVideoFilter = toggleVideoFilter;
// videos-timeline.js - no window shim left. generateTimeline,
// _renderTimelineHTML and _timelineEmptyNoteHTML were only read by videos.js,
// which imports all three directly; closeTimelineIntervalModal was only read
// by shortcuts.js, which now imports it directly too - the module stays in the
// bundle graph via those imports. confirmGenerateTimeline and
// updateTimelineIntervalHint dropped earlier: their only callers were this
// module's own inline handlers, now addEventListener inside
// videos-timeline.js itself.
// videos-summary.js - regenSummaryAuto is invoked directly by
// tests/ui/test_ui_video.py via page.evaluate. summarizeVideo dropped: its only
// reader (videos.js) now imports it directly (the window-cycle-avoidance
// conversion). _doRegenSummaryAuto
// dropped: its only caller was this module's own regenSummaryAuto, so nothing
// outside the module needs it off window.
window.regenSummaryAuto = regenSummaryAuto;
// videos-runmeta.js - _renderRunMetaCard and _runTimingLine dropped: their only
// reader was videos.js, which now imports both directly (videos/ bucket conversion).
// sessions.js - SessionUI, isSessionCollapsed and sessionGroupHeaderLi dropped:
// their only reader (videos.js) now imports all three directly (the
// window-cycle-avoidance conversion). toggleGroupSelect is invoked directly by
// tests/ui/test_ui_sessions.py via page.evaluate - a real click on the video
// item was tried as a replacement but re-renders the list between the two
// selections, which shifts layout under Playwright's actionability retry and
// intermittently intercepts the click on an unrelated element (the resize
// handle or the grouping bar); page.evaluate stays the deliberate choice here.
// Everything else stays module-private: loadSessions, enterGroupingMode,
// suggestSessions and selectSession are only called by this module's own
// internal logic, and exitGroupingMode, confirmGroupSelection and
// openRecordingsActionsMenu are now wired to their static index.html buttons
// via addEventListener inside sessions.js itself (no inline onclick left).
window.toggleGroupSelect = toggleGroupSelect;
// clips.js - _renderClips and _renderClipFilterCounts are read as window.* by
// jobs.js - NOT converted to a direct import: see the videos.js block above,
// same jobs.js<->clips.js cycle broke Vitest's vi.mock(importActual)
// resolution for jobs.js, reverted deliberately. Every other remaining name
// (including _applyFilters - shortcuts.js's own read already imports it
// directly) is invoked directly by tests/ui/*.py or
// tests/js/*.test.js via page.evaluate / direct import. undoLastStatus,
// closeScoreOverrideModal and closeSimilarClipsModal dropped: shortcuts.js
// already imports all three directly and no test pokes any of them.
// clearDetail and _releasePlayerBeforeDelete dropped earlier: their only
// reader (videos.js) now imports both directly. setClipSearch,
// setClipScoreMin, _clearClipFilters, setClipKindFilter, _syncKindChips,
// toggleClipSortDir, deleteClip, deleteExport, mergeClips, scanDuplicates,
// openClipsActionsMenu, _scoreOverrideSave, clearScoreOverride, openDescKebab,
// openDescLongKebab, startFindSimilar and openSimilarClipsModal dropped
// earlier: their only callers were clips.js's own inline handlers (now
// data-act delegation or static index.html wiring inside clips.js itself) or
// its own internal logic, so nothing outside the module needs them off window.
// _syncFilterChips dropped 2026-07-22: test_ui_page.py's regression test now
// clicks the real `button[data-filter='approved']` chip (always present in
// the sidebar, no video selection needed), which reaches the real
// toggleClipFilter -> _syncFilterChips path - no other reader anywhere.
// setStatus dropped 2026-07-23: shortcuts.js already imports it directly, and
// its only "reader" in test_ui_clips.py was a prose comment naming it, not a
// real poke. openScoreOverride dropped in the same pass: test_ui_clips.py now
// clicks the detail view's own "Override Score" button
// (`[data-act='open-score-override']`), rendered for any already-scored clip.
// selectClip dropped 2026-07-23: test_ui_clips2.py's one poke
// (TestGlobalKeyboardGuard) was redundant with the real click
// select_first_video_and_clip already made - swapped to re-clicking the same
// first row instead of calling the function directly. toggleClipFilter/
// _applyFilters stay: one poke each activates a filter chip that's inside the
// (initially collapsed) "More filters" expander - unclickable while hidden, so
// there's no real trigger for "arrive with that filter already active" - and
// the other computes an expected value for comparison, not a trigger.
// openClipActionsModal stays: two of its three pokes in test_ui_clips2.py
// (TestClipActionsModalGroups's merge tests) build a fabricated
// AppState.clips pair with specific ids never actually selected/rendered in
// the real DOM, so there's no real click path to open the modal for them -
// the other poke there and test_ui_clips.py's own were real-click-swapped.
// renderDetail/AppState stay - see the per-file notes on the 5 test files that
// still poke them with synthetic clip data (test_ui_clips.py, test_ui_clips2.py,
// test_ui_hotwords.py, test_ui_sensitive.py, test_ui_vision.py).
// test_ui_transcript.py's own "reader" was a prose comment naming renderDetail
// (it only actually calls the unrelated videos.js renderVideoDetail), not a
// real poke - same false-positive class flagged repeatedly. analyzeFrames
// dropped 2026-07-23: clips.js's own data-act delegation already calls it
// internally, and its only "reader" in test_ui_vision.py was a prose comment
// about a prior migration, not a real poke - tests/js/clips/vision.test.js
// already imports it directly.
window.renderDetail = renderDetail;
window.renderPlayer = renderPlayer;
window.refreshClipDetail = refreshClipDetail;
window.toggleClipFilter = toggleClipFilter;
window._applyFilters = _applyFilters;
window._renderClips = _renderClips;
window._reloadClipList = _reloadClipList;
window._renderClipFilterCounts = _renderClipFilterCounts;
window.openClipActionsModal = openClipActionsModal;
// clipbulk.js - undoLastBulkStatus is read as a bare global by clips.js's
// undoLastStatus (not yet converted to a direct import - out of scope for
// this pass). _pruneClipSelection, _updateBulkToolbar and
// _toggleClipSelection dropped: their only reader (clips.js) now imports all
// three directly (the window-cycle-avoidance conversion). bulkSetClipStatus,
// bulkDeleteClips, bulkExportClips and _clearClipSelection dropped: their only
// callers were this module's own inline handlers, now data-act delegation
// inside clipbulk.js itself, so nothing outside the module needs them off
// window anymore.
window.undoLastBulkStatus = undoLastBulkStatus;
// clipexport.js - closeExportModal is a genuine bare-global consumer of its
// own shim: the module's own dynamically-built onclick strings (the
// _diarizationNoteHtml "Settings" link and the MediaPipe-missing "install it
// in Settings" link) are set as innerHTML and evaluated in global scope when
// clicked. exportClip and confirmExport dropped (2026-07-22):
// tests/ui/test_ui_clips.py / test_ui_clips2.py / test_ui_smoke.py now click
// the real Export button (.op-actions [data-act='export-clip']) and the real
// #export-confirm-btn, same as a user would, instead of calling the export
// flow's functions by name. _onExportPresetChange/_updateExportTightCapWarning/
// _setExportFraming dropped 2026-07-23: test_ui_clips.py now drives all three
// through their real triggers - selecting `#export-preset` (whose own `change`
// listener calls _onExportPresetChange, which itself calls
// _updateExportTightCapWarning) and clicking the framing position buttons
// (`#export-framing [data-frame-pos]`, including the exact 0-0.5-1 values
// _setExportFraming needs) - no other reader anywhere. _renderExportModeSummary
// dropped from the window shim: reel.js (now ESM) imports it directly instead
// of reading it as a bare global.
// _handleExportFormatAction, _downloadClipExport, _revealClipExport and
// _copyClipExportPaths dropped: their only reader (clips.js) now imports all
// four directly (the window-cycle-avoidance conversion). _onExportCaptionsChange,
// _onExportRetranscribeChange, _onExportWordHighlightChange,
// _exportTightCapWarning, _autoFrameExport and _updateExportModeSummary
// dropped earlier: their only callers were this module's own inline handlers
// (now addEventListener inside clipexport.js itself) or its own internal logic,
// so nothing outside the module needs them off window anymore.
window.closeExportModal = closeExportModal;
// clipcreate.js - openClipCreatePicker is invoked directly by
// tests/ui/test_ui_clipcreate.py via page.evaluate (its readers in clips.js and
// videos.js now both import it directly, the window-cycle-avoidance conversion).
// isClipCreateOpen dropped: it has no callers anywhere (not even internally in
// clipcreate.js) - dead code left as a named export in case a future caller
// needs a PanelNav('clip-create')-open check.
window.openClipCreatePicker = openClipCreatePicker;
// analyze.js - closeNewRecordingPanel is read as a bare global by shortcuts.js
// (not yet converted to a direct import) and by this module's own
// dynamically-built onclick string (the _diarizationNoteHtml "Settings" link);
// openReanalyzePanel is invoked directly by tests/ui/test_ui_analyze.py via
// page.evaluate with a hand-built video object (its readers in clips.js and
// videos.js now import it directly) - the fabricated analyze_run.settings/
// exported-clip-count combinations it exercises have no fixture-data
// equivalent to reach via a real click. startAnalyze has no outside JS caller
// left (its only external use was a now-removed index.html inline handler)
// but tests/ui/test_ui_whisper_prefetch.py calls it directly via
// page.evaluate. renderEstimate, reattachAnalysis and
// _renderSubtitleSourcePicker dropped 2026-07-22: renderEstimate and
// reattachAnalysis had no real poke left anywhere (test_ui_analyze.py's
// mentions were comments, not calls) and boot.js/tests/js/analyze/
// estimate.test.js already import each directly;
// _renderSubtitleSourcePicker's two test_ui_analyze.py pokes were swapped for
// the real trigger (filling #analyze-path, which schedules a real
// /api/probe-driven render) since the file already stubs that endpoint for
// other tests in the same class.
// _showAnalysisToast dropped: its only page.evaluate poke (test_ui_toasts.py)
// was already migrated to tests/js/analyze/analyze.test.js, which imports it
// directly. closeProfileManager dropped: shortcuts.js already imports it
// directly and no test pokes it.
// _probedInfo/_panelDirty are NOT here -
// videos.js imports them directly from analyze.js as live ESM bindings instead
// of reading them off window. _isNewRecordingPanelOpen and
// _doCloseNewRecordingPanel dropped: shortcuts.js/settings.js already imported
// both directly, and videos.js's own read (the last remaining one) now imports
// them too (the window-cycle-avoidance conversion). openNewRecordingPanel
// dropped: its only reader (videos.js) now imports it directly, and it has no
// remaining page.evaluate poke.
// scheduleProbe, pickFile, showImportUrlSection, hideImportUrlSection,
// checkImportUrl, startImportUrlDownload, openProfileManager, openNewProfile,
// renderTrackRows, onLabelChange, _clearPeNameError, saveProfile, deleteProfile,
// cancelProfileEdit, _toggleCtxPill, _onSubtitleSourceChange, _doStartAnalyze,
// _streamAnalyzeEvents, _surfaceAnalyzeWarnings and _warmPreviewProxy dropped
// earlier: their only callers were this module's own inline handlers (now
// addEventListener/delegation inside analyze.js itself) or its own internal
// logic, so nothing outside the module needs them off window anymore.
window.openReanalyzePanel = openReanalyzePanel;
window.closeNewRecordingPanel = closeNewRecordingPanel;
window.startAnalyze = startAnalyze;
// reel.js - openHighlightReelsModal is invoked directly by
// tests/ui/test_ui_reel.py and tests/ui/test_ui_sessions.py via page.evaluate
// (test_ui_sessions.py's own poke real-swapped onto #btn-highlight-reels
// 2026-07-23, but test_ui_reel.py still needs it for a 'view'-mode open the
// button can't reach). openBatchExportModal/closeBatchExportModal dropped
// 2026-07-23: the claim that videos.js read the former off `window.*` was
// stale - it already imports it directly - and test_ui_clips.py's pokes of
// both real-swapped onto the recording detail's own "Export Approved" button
// (`[data-act='open-batch-export']`) and the modal's `#batch-cancel-btn`.
// closeReelPreview dropped: shortcuts.js already imports it directly and no
// test pokes it.
// closeHighlightReelsModal/switchReelTab/_reelMove/_reelToggle dropped
// 2026-07-22: test_ui_reel.py's pokes were real-click-swapped onto the modal's
// own close button (#reel-close-btn), its tab buttons
// (#reel-tab-btn-build/view), and each row's Move up/down button + include
// checkbox - all of which already wired these functions as real onclick/
// onchange handlers. loadReelClips, _toggleReelPoolStatus, startDemo,
// closeDemoModal, updateReelEstimate, exportUnexportedReelClips,
// _onReelCaptionsChange, _onReelWordHighlightChange, previewReelPlaylist,
// _reelPreviewStep, confirmBatchExport, updateBatchEstimate,
// _onBatchCaptionsChange and _onBatchRetranscribeChange dropped: their only
// callers were reel.js's own now-removed index.html inline handlers, now
// addEventListener inside reel.js itself, so nothing outside the module needs
// them off window anymore. openReelForSession dropped: sessions.js now imports
// it directly (videos/ bucket conversion).
window.openHighlightReelsModal = openHighlightReelsModal;
// contexts.js - _deriveContextId is invoked directly by
// tests/ui/test_ui_contexts.py via page.evaluate to compute an expected value
// for comparison (the ID-derivation behavior itself is already exercised
// end-to-end by real page.fill() typing in the same file); openContextManager,
// closeContextManager, openNewContext, cancelContextEdit, duplicateContext,
// openCharacterForm, cancelCharacterEdit and _updateCharBoostLabel dropped
// (2026-07-22): test_ui_contexts.py now drives them via real clicks on
// #btn-world-contexts/#context-close-btn/#context-cancel-btn/#context-new-btn/
// #btn-duplicate-context/#ce-add-character-btn/#ce-cancel-character-btn and a
// real 'input' event on #ce-char-boost, same as a user would, so no
// page.evaluate poke needs any of them off window anymore.
// openRetranscribeModal/startRetranscribe dropped 2026-07-23:
// test_ui_clips2.py now drives the real flow - the clip's Additional Actions
// "Retranscribe" row opens the modal, and its own #retranscribe-start-btn
// calls startRetranscribe(). closeRetranscribeModal stays: a genuine
// bare-global consumer of its own shim (this module's own dynamically-built
// onclick string - the _diarizationNoteHtml "Settings" link - is set as
// innerHTML and evaluated in global scope when clicked; shortcuts.js's own
// read is already a direct import). _loadContexts, _termContextOptions,
// _renderTermGroups and closeAutoApproveModal dropped: boot.js
// (_loadContexts), hotwords.js/sensitive.js (_termContextOptions/
// _renderTermGroups) and shortcuts.js (closeAutoApproveModal) already import
// all four directly and no test pokes any of them. ensureContexts,
// addVideoContext, openAutoApproveModal, rescoreClip, rescoreClipChoose,
// rescoreClips, rescoreFailedClips, rescoreAllClips, redescribeAllClips and
// resetApprovals dropped earlier: their only readers (clips.js, clipcreate.js,
// videos.js) now import all ten directly (the window-cycle-avoidance
// conversion). saveContext, deleteContext, resetContextToTemplate,
// saveCharacter, deleteCharacter, _updateCharacterSectionVisibility,
// _loadCharacters, doAutoApprove and updateAutoApprovePreview dropped earlier:
// their only callers were contexts.js's own now-removed index.html inline
// handlers or its own internal logic, so nothing outside the module needs
// them off window anymore.
window._deriveContextId = _deriveContextId;
window.closeRetranscribeModal = closeRetranscribeModal;
// settings.js - openSettings is read as a bare global from dynamically-built
// onclick strings owned by other modules (analyze.js/clipexport.js/contexts.js's
// _diarizationNoteHtml links, modelcatalog.js's "Open Settings" link).
// _onDiarizationBackendChange dropped 2026-07-22:
// test_ui_settings.py::TestSpeakerClusterThreshold now drives the real
// #s-diarization-backend select instead of poking the handler directly.
// applyTheme/applyAccent dropped: their page.evaluate pokes
// in test_ui_theme.py were already migrated to tests/js/settings/settings.test.js,
// which imports both directly. _updateDiarizationStatus dropped: it has no
// external caller anywhere (settings.js calls it only from its own internal
// logic) - the earlier note about a "settings-installs.js sibling contract"
// was stale; settings-installs.js does not reference it.
// closeSettings, _scrollToSettingsSection, _checkSettingsDirty and
// markModelPathsApplied dropped: their only readers (analyze.js/shortcuts.js,
// clips.js/videos.js/modelcatalog.js, modelcatalog.js, modelcatalog.js
// respectively) now import all four directly (the window-cycle-avoidance
// conversion). saveSettings, _onLlmEnabledChange, _onLaughModeChange,
// _onSimilarityBackendChange, _onPrivacyModeChange, _setPrivacyMode,
// _currentPrivacyMode, _onPlayNextChange, _onLoopClipChange,
// _onSettingsWordHighlightChange, revertSection, revertAllSettings,
// applyContentPreset and _onContentPresetChange dropped earlier: their only
// callers were settings.js's own now-removed index.html inline handlers (now
// addEventListener inside settings.js itself) or its own internal logic, so
// nothing outside the module needs them off window anymore.
window.openSettings = openSettings;
// settings-previews.js and settings-installs.js: no window shim left. Their
// preview/install-status helpers were only read as window.* by settings.js,
// which now imports both directly (settings/ bucket conversion) - both modules
// stay in the bundle graph via that import, so no side-effect import is needed
// here either.
// projects.js - no window shim left. closeOpenProjectModal dropped:
// test_ui_projects.py's page.evaluate poke is retired in favor of a real
// click on #btn-open-project-cancel (the same close path a user takes), and
// no JS module reads it off window. initProjectSwitcher, isProjectMenuOpen
// and closeProjectMenu dropped earlier: boot.js (initProjectSwitcher) and
// shortcuts.js (isProjectMenuOpen/closeProjectMenu) already import all three
// directly and no test pokes any of them. toggleProjectMenu,
// browseForProjectFolder and _openProjectConfirm dropped earlier: their only
// callers were this module's own now-removed index.html inline handlers (now
// addEventListener inside projects.js itself), so nothing outside the
// module needs them off window. The module stays in the bundle graph via
// boot.js's direct import of initProjectSwitcher.
// modeldownload.js - no window shim left. initModelDownload dropped 2026-07-23:
// test_ui_modeldownload.py now re-navigates once its routes are registered (the
// same _reboot_against_stubs pattern test_ui_whisper_prefetch.py already used),
// so boot.js's own real call runs fresh against the stubs - no in-place
// re-invoke needed. _resetModelDownloads dropped in the same pass: it was
// test-only scaffolding ("Test support" per its own code comment) whose sole
// purpose was resetting state the real boot flow had already touched before a
// test's stubs existed - the re-navigation above makes that unnecessary too, so
// the function itself was deleted from modeldownload.js, not just unshimmed.
// initModelPrefetch dropped 2026-07-22: boot.js already imports it directly,
// and its only "readers" in test_ui_whisper_prefetch.py/test_ui_model_catalog.py
// were prose comments naming it, not real pokes. getWhisperDownloadPct
// dropped: its only reader was analyze.js (analyze/ bucket conversion), which
// now imports it directly, and no other reader remains. _cancelDownload
// dropped: its only caller is this module's own row-action onclick (property
// assignment inside _wireRowActions), so nothing outside the module needs it
// off window.
// sounds.js - SoundFx and commitSoundSettings are invoked directly by
// tests/ui/test_ui_sounds.py / tests/js/library/sounds.test.js via
// page.evaluate / direct import; every JS reader (clipbulk.js, clipexport.js,
// contexts.js, videos.js, jobs.js, exporteditor.js) already imports SoundFx
// directly. initSoundSettings and _soundSettingsDirty dropped: settings.js
// (settings/ bucket conversion) now imports both directly, and no other reader
// remains. _onSoundUpload dropped: its only consumer was index.html's inline
// upload onchange, now an addEventListener inside sounds.js itself.
window.SoundFx = SoundFx;
window.commitSoundSettings = commitSoundSettings;
// hotwords.js - no window shim left. ensureHotwordsCache dropped 2026-07-23:
// test_ui_hotwords.py's two pokes were unnecessary - boot.js's own
// unconditional ensureHotwordsCache() call on every real page load already
// fetches fresh (the hot-word was created via the API before that navigation),
// so the tests just wait on the real boot-time fetch instead of forcing a
// second one. hasEnabledSemanticHotwords and confirmScanHotwordsForVideo
// dropped: their only reader (videos.js) now imports both directly (the
// window-cycle-avoidance conversion). initHotwordSettings dropped earlier:
// settings.js (settings/ bucket conversion) now imports it directly, and no
// other reader remains. addHotwordRow and scanHotwordsForVideo dropped:
// addHotwordRow's only caller was index.html's inline onclick (now an
// addEventListener inside hotwords.js itself) and scanHotwordsForVideo is only
// called by this module's own confirmScanHotwordsForVideo, so nothing outside
// the module reads either.

// sensitive.js - no window shim left. initSensitiveTermSettings was only read
// as window.* by settings.js, which now imports it directly (settings/ bucket
// conversion) - sensitive.js stays in the bundle graph via boot.js's
// initSensitiveListeners import. ensureSensitiveTermsCache has no external
// caller (unlike hotwords, the sensitive cache is primed only at
// Settings-open), and addSensitiveTermRow's only caller was index.html's
// inline onclick (now an addEventListener inside sensitive.js) - so neither
// needs a window shim.
// exportpresets.js - no window shim left. ensureExportPresetsCache dropped:
// boot.js and exporteditor.js already import it directly and no test pokes it.
// initExportPresetSettings dropped earlier: settings.js (settings/ bucket
// conversion) now imports it directly, and no other reader remains.
// addExportPresetRow dropped: its only caller was index.html's inline onclick
// (now an addEventListener inside exportpresets.js itself), so nothing
// outside the module needs it off window. exportPresetLabel,
// exportPresetIsVertical, exportPresetTargetSizeMb and populateExportPresetSelect
// dropped: their only readers were clips.js and clipexport.js, which now import
// them directly (clips/ bucket conversion).
// speakers.js - loadSpeakers dropped: its only reader (videos.js) now imports it
// directly (the window-cycle-avoidance conversion; the module's own
// transcript.js/voices.js reads were already direct imports). Everything else in
// the module stays module-private (delegated event listeners on #detail, no
// external caller).
// voices.js - openPeopleView is invoked directly by tests/ui/test_ui_voices.py
// via page.evaluate (its speakers.js read now imports it directly too, the
// window-cycle-avoidance conversion). isPeopleOpen dropped from the shim: it has
// no caller anywhere (kept as a named export in case a future caller needs a
// PanelNav('people') check). The People nav button's inline onclick is now an
// addEventListener inside voices.js.
window.openPeopleView = openPeopleView;
// transcript.js - reloadVideoTranscriptIfOpen and loadClipTranscript dropped:
// their only readers (namecorrections.js/speakers.js/videos.js and clips.js
// respectively) now import both directly (the window-cycle-avoidance
// conversion). loadVideoTranscript, seekPlayerTo and startEditCaption dropped
// earlier: their only callers were this module's own internal logic and its
// delegated #detail listeners, so nothing outside the module reads them.
// renderTranscriptLines dropped: its only reader was clipcreate.js, which now
// imports it directly (clips/ bucket conversion).
// namecorrections.js - no window shim left. openNameCorrections's page.evaluate
// poke (tests/ui/test_ui_namecorrections.py) is retired - migrated to
// tests/js/people/namecorrections.test.js, which imports it directly; videos.js
// already imports it directly too (the window-cycle-avoidance conversion), so
// the module stays in the bundle graph via that import. isNameCorrectionsOpen
// dropped from the shim earlier: it has no caller anywhere (kept as a named
// export in case a future caller needs a PanelNav('name-corrections')-open
// check).
// exporteditor.js - openExportEditor is invoked directly by
// tests/ui/test_ui_exporteditor.py via page.evaluate (its clips.js read now
// imports it directly too, the window-cycle-avoidance conversion).
// isExportEditorOpen dropped from the shim: it has no caller anywhere (kept as a
// named export in case a future caller needs a PanelNav('export-editor')-open
// check).
window.openExportEditor = openExportEditor;
// split.js - openSplitEditor/closeSplitEditor are invoked directly by
// tests/ui/test_ui_keyboard.py, test_ui_panelnav.py and test_ui_split.py via
// page.evaluate (their videos.js reads now import both directly too, the
// window-cycle-avoidance conversion). isSplitEditorOpen dropped: its only
// reader (videos.js) now imports it directly. _parseSplitTime dropped:
// tests/js/analyze/split.test.js already imports it directly, and its old
// test_ui_split.py page.evaluate poke is gone (only stale comment mentions
// remain there). splitTimelineClick dropped for the same reason: no test
// pokes it any more (test_ui_split.py's remaining mentions are comments, not
// code) and it has no JS reader. initPreSplitDuration/hidePreSplitSection/
// _fmtSplitTime dropped earlier: their only reader was analyze.js (analyze/
// bucket conversion), which now imports all three directly, and no other
// reader or page.evaluate poke remains. The two test-poked STATE names
// (_splitPoints, _splitNames) are NOT here - split.js wires those onto window
// itself via live get/set accessors, since a plain snapshot would go stale on
// reassignment. videos.js/analyze.js read _splitPoints/_splitDurationS/
// _splitIgnored via a direct import instead of window. (The jobs.js
// equivalent bridge has since been removed; split.js's remains only for
// test_ui_keyboard's page.evaluate pokes.)
window.openSplitEditor = openSplitEditor;
window.closeSplitEditor = closeSplitEditor;
