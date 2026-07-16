// ESM entry point - the strangler-fig seam (WS5 step 2). esbuild bundles this
// module graph into static/bundle.esm.js (see scripts/build-esm.mjs, run by
// `yuu-dev bundle`). Everything reachable from here is real ESM (import/export);
// the classic global-scope scripts still in bundle.js call these modules as
// window globals, so this entry re-exposes each migrated module's public surface
// on window as a compatibility shim.
//
// Migrating a classic consumer to `import` shrinks the shim: once nothing reads a
// name off window, delete its line below. When bundle.js is empty, this file is
// the whole app and the shim is gone.
import { AppState } from './state.js';
import * as format from './format.js';
import { ColorPicker } from './colorpicker.js';
import { PanelNav } from './panelnav.js';
import * as jobs from './jobs.js';
import { _buildMediaUrl, setupRecordingPreview } from './preview.js';
import {
  _syncSortDirBtn, _diarizationReason, _diarizationReadiness, _diarizationNoteHtml,
  openLog, clearLog, appendLog, showToast, netErrMsg, revealInFolder, copyText,
  collapsibleCard,
} from './utils.js';
import {
  showAlert, closeAlertModal, showConfirm, _confirmCancel,
  openActionsModal, closeActionsModal, topmostVisibleModal, _menuArrowKeydown,
  isHamburgerOpen, toggleHamburger, closeHamburger,
  openControlsModal, closeControlsModal,
  openDiffModal, _diffDiscard,
  openFieldEditModal, closeFieldEditModal,
  closeKebab, showKebab, initResize, _applyPrereqWarnings, showUndoToast,
  playbackRatePref, applyPlaybackRate, initPlaybackRate,
} from './ui.js';
import {
  openGettingStartedModal, closeGettingStartedModal,
  openAboutModal, closeAboutModal,
  openHelpModal, closeHelpModal,
  openGlossaryModal, closeGlossaryModal, _filterGlossary,
} from './helpmodals.js';
// shortcuts.js has no public surface (its only export is the keydown listener
// registration) - a bare side-effect import registers the global handler
// without adding anything to the window shim.
import './shortcuts.js';
import {
  _ensureModelCatalog, refreshModelCatalog,
  _updateLlmCapabilities, _renderCapabilityTiers,
  gateOnCapability,
} from './modelcatalog.js';
import {
  loadVideos, selectVideo, renderVideoDetail, deleteVideo,
  onClipsSortChange, _clipsSortParam, _clipsListUrl,
  _reanalyzeParams,
  _needsModelCtaHTML,
  _updateDemoButton, _updateStartIngestButton,
  _analysisLivePanelHTML, _syncAnalysisLivePanel,
  _applyVideoFilters, _renderVideoList,
  setVideoSearch, setVideoSort, toggleVideoSortDir, toggleVideoFilter,
  openVideoActionsModal,
} from './videos.js';
import {
  generateTimeline, closeTimelineIntervalModal, _renderTimelineHTML, _timelineEmptyNoteHTML,
} from './videos-timeline.js';
import { summarizeVideo, regenSummaryAuto } from './videos-summary.js';
import { _renderRunMetaCard, _runTimingLine } from './videos-runmeta.js';
import {
  SessionUI, isSessionCollapsed, sessionGroupHeaderLi, toggleGroupSelect,
} from './sessions.js';
import {
  selectClip, setStatus, undoLastStatus, renderDetail, renderPlayer, clearDetail, refreshClipDetail,
  _releasePlayerBeforeDelete,
  analyzeFrames,
  toggleClipFilter, _syncFilterChips,
  _applyFilters, _renderClips, _parseTimingOffset, _reloadClipList,
  _renderClipFilterCounts,
  openScoreOverride, closeScoreOverrideModal,
  closeSimilarClipsModal,
  openClipActionsModal,
} from './clips.js';
import {
  _pruneClipSelection, _updateBulkToolbar, _toggleClipSelection, undoLastBulkStatus,
} from './clipbulk.js';

window.AppState = AppState;
Object.assign(window, format);
window.ColorPicker = ColorPicker;
window.PanelNav = PanelNav;
// utils.js is cross-cutting - every name here still has at least one classic
// (bundle.js) consumer, or (clearLog, _diarizationReason, _diarizationNoteHtml) a
// tests/ui/test_ui_utils.py page.evaluate. toggleLog and isCardCollapsed dropped:
// their only consumers were utils.js's own inline handler (now addEventListener)
// and its own collapsibleCard, respectively.
window._syncSortDirBtn = _syncSortDirBtn;
window._diarizationReason = _diarizationReason;
window._diarizationReadiness = _diarizationReadiness;
window._diarizationNoteHtml = _diarizationNoteHtml;
window.openLog = openLog;
window.clearLog = clearLog;
window.appendLog = appendLog;
window.showToast = showToast;
window.netErrMsg = netErrMsg;
window.revealInFolder = revealInFolder;
window.copyText = copyText;
window.collapsibleCard = collapsibleCard;
// jobs.js is cross-cutting - every export here still has at least one classic
// (bundle.js) consumer or a still-present inline handler, so none of these can
// be dropped yet. Its handful of mutable shared-state globals (_jobStepDefs,
// _activeES, etc.) are NOT here - jobs.js wires those onto window itself via
// live get/set accessors, since a plain snapshot would go stale on reassignment.
Object.assign(window, jobs);
// preview.js is cross-cutting - setupRecordingPreview has classic consumers
// (clipcreate.js, videos.js, split.js, exporteditor.js); _buildMediaUrl has no
// JS consumer left but tests/ui/test_ui_video.py evaluates it as a page global.
window._buildMediaUrl = _buildMediaUrl;
window.setupRecordingPreview = setupRecordingPreview;
// ui.js is cross-cutting - every name here still has at least one classic
// (bundle.js) consumer, an already-ESM caller (jobs.js/panelnav.js's
// window.showConfirm), or a tests/ui/*.py page.evaluate. _confirmOk,
// _diffAcceptNew, _diffAcceptEdit and _fieldEditSave dropped: their only
// consumers were ui.js's own inline handlers, now addEventListener inside
// ui.js itself, so nothing outside the module needs them off window anymore.
window.showAlert = showAlert;
window.closeAlertModal = closeAlertModal;
window.showConfirm = showConfirm;
window._confirmCancel = _confirmCancel;
window.openActionsModal = openActionsModal;
window.closeActionsModal = closeActionsModal;
window.topmostVisibleModal = topmostVisibleModal;
window._menuArrowKeydown = _menuArrowKeydown;
window.isHamburgerOpen = isHamburgerOpen;
window.toggleHamburger = toggleHamburger;
window.closeHamburger = closeHamburger;
window.openControlsModal = openControlsModal;
window.closeControlsModal = closeControlsModal;
window.openDiffModal = openDiffModal;
window._diffDiscard = _diffDiscard;
window.openFieldEditModal = openFieldEditModal;
window.closeFieldEditModal = closeFieldEditModal;
window.closeKebab = closeKebab;
window.showKebab = showKebab;
window.initResize = initResize;
window._applyPrereqWarnings = _applyPrereqWarnings;
window.showUndoToast = showUndoToast;
window.playbackRatePref = playbackRatePref;
window.applyPlaybackRate = applyPlaybackRate;
window.initPlaybackRate = initPlaybackRate;
// helpmodals.js - every name here still has at least one classic (bundle.js)
// consumer (boot.js, videos.js, shortcuts.js, settings.js call these as bare
// globals) or a tests/ui/*.py page.evaluate, so none can be dropped yet.
window.openGettingStartedModal = openGettingStartedModal;
window.closeGettingStartedModal = closeGettingStartedModal;
window.openAboutModal = openAboutModal;
window.closeAboutModal = closeAboutModal;
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.openGlossaryModal = openGlossaryModal;
window.closeGlossaryModal = closeGlossaryModal;
window._filterGlossary = _filterGlossary;
// modelcatalog.js - every name here still has at least one classic (bundle.js)
// consumer: settings.js calls _ensureModelCatalog/refreshModelCatalog/
// _updateLlmCapabilities/_renderCapabilityTiers as bare globals, modeldownload.js
// checks/calls _updateLlmCapabilities/_renderCapabilityTiers, and clips.js calls
// gateOnCapability (also read directly by tests/ui/test_ui_model_catalog.py via
// page.evaluate). prefetchModel and downloadGgufModel dropped: both are wired
// internally via addEventListener/data-* delegation and have no outside caller.
window._ensureModelCatalog = _ensureModelCatalog;
window.refreshModelCatalog = refreshModelCatalog;
window._updateLlmCapabilities = _updateLlmCapabilities;
window._renderCapabilityTiers = _renderCapabilityTiers;
window.gateOnCapability = gateOnCapability;
// videos.js is cross-cutting - every name here still has at least one classic
// (bundle.js) consumer or a tests/ui/*.py page.evaluate. _clipsSortParam is
// CRITICAL: format.js (already ESM) reads it as window._clipsSortParam, so it
// can never be dropped even if every classic consumer goes away. Eleven names
// (reanalyzeVideo, rediarizeVideo, reextractVideoRun, retranscribeVideoRun,
// regenerateClipsRun, unsplitVideo, _doUnsplitVideo, openVideoSummaryKebab,
// openVideoTitleKebab, _syncVideoFilterChips, _clearVideoFilters) dropped: their
// only callers were videos.js's own inline handlers (now data-act delegation) or
// its own internal logic, so nothing outside the module needs them off window.
window.loadVideos = loadVideos;
window.selectVideo = selectVideo;
window.renderVideoDetail = renderVideoDetail;
window.deleteVideo = deleteVideo;
window.onClipsSortChange = onClipsSortChange;
window._clipsSortParam = _clipsSortParam;
window._clipsListUrl = _clipsListUrl;
window._reanalyzeParams = _reanalyzeParams;
window._needsModelCtaHTML = _needsModelCtaHTML;
window._updateDemoButton = _updateDemoButton;
window._updateStartIngestButton = _updateStartIngestButton;
window._analysisLivePanelHTML = _analysisLivePanelHTML;
window._syncAnalysisLivePanel = _syncAnalysisLivePanel;
window._applyVideoFilters = _applyVideoFilters;
window._renderVideoList = _renderVideoList;
window.setVideoSearch = setVideoSearch;
window.setVideoSort = setVideoSort;
window.toggleVideoSortDir = toggleVideoSortDir;
window.toggleVideoFilter = toggleVideoFilter;
window.openVideoActionsModal = openVideoActionsModal;
// videos-timeline.js - generateTimeline, _renderTimelineHTML and
// _timelineEmptyNoteHTML are read as window.* by videos.js (already-ESM, but
// videos.js's own migration predates this one and never switched these three
// to an import - out of scope here to touch videos.js). closeTimelineIntervalModal
// is called as a bare global by shortcuts.js's Escape-key modal-closer map
// (shortcuts.js hasn't been updated to import it directly - also out of scope).
// confirmGenerateTimeline and updateTimelineIntervalHint dropped: their only
// callers were this module's own inline handlers, now addEventListener inside
// videos-timeline.js itself.
window.generateTimeline = generateTimeline;
window.closeTimelineIntervalModal = closeTimelineIntervalModal;
window._renderTimelineHTML = _renderTimelineHTML;
window._timelineEmptyNoteHTML = _timelineEmptyNoteHTML;
// videos-summary.js - summarizeVideo and regenSummaryAuto are read as window.*
// by videos.js (already-ESM, but out of scope to switch to an import here) and
// regenSummaryAuto is also invoked directly by tests/ui/test_ui_video.py via
// page.evaluate. _doRegenSummaryAuto dropped: its only caller was this module's
// own regenSummaryAuto, so nothing outside the module needs it off window.
window.summarizeVideo = summarizeVideo;
window.regenSummaryAuto = regenSummaryAuto;
// videos-runmeta.js - _renderRunMetaCard and _runTimingLine are read as
// window.* by videos.js (already-ESM, but out of scope to switch to an import
// here).
window._renderRunMetaCard = _renderRunMetaCard;
window._runTimingLine = _runTimingLine;
// sessions.js - SessionUI, isSessionCollapsed and sessionGroupHeaderLi are read
// as window.* by videos.js (already-ESM, but out of scope to switch to an import
// here); toggleGroupSelect is invoked directly by tests/ui/test_ui_sessions.py
// via page.evaluate. Everything else stays module-private: loadSessions,
// enterGroupingMode, suggestSessions and selectSession are only called by this
// module's own internal logic, and exitGroupingMode, confirmGroupSelection and
// openRecordingsActionsMenu are now wired to their static index.html buttons via
// addEventListener inside sessions.js itself (no inline onclick left).
window.SessionUI = SessionUI;
window.isSessionCollapsed = isSessionCollapsed;
window.sessionGroupHeaderLi = sessionGroupHeaderLi;
window.toggleGroupSelect = toggleGroupSelect;
// clips.js - every name here still has at least one classic (bundle.js)
// consumer, a still-classic module reading it as window.* (shortcuts.js reads
// setStatus/undoLastStatus/closeScoreOverrideModal/closeSimilarClipsModal;
// jobs.js reads _renderClipFilterCounts; videos.js reads _syncFilterChips), or a
// tests/ui/*.py page.evaluate. setClipSearch, setClipScoreMin, _clearClipFilters,
// setClipKind, _syncKindChips, toggleClipSortDir, deleteClip, deleteExport,
// mergeClips, scanDuplicates, openClipsActionsMenu, _scoreOverrideSave,
// clearScoreOverride, openDescKebab, openDescLongKebab, startFindSimilar and
// openSimilarClipsModal dropped: their only callers were clips.js's own inline
// handlers (now data-act delegation or static index.html wiring inside
// clips.js itself) or its own internal logic, so nothing outside the module
// needs them off window anymore.
window.selectClip = selectClip;
window.setStatus = setStatus;
window.undoLastStatus = undoLastStatus;
window.renderDetail = renderDetail;
window.renderPlayer = renderPlayer;
window.clearDetail = clearDetail;
window.refreshClipDetail = refreshClipDetail;
window._releasePlayerBeforeDelete = _releasePlayerBeforeDelete;
window.analyzeFrames = analyzeFrames;
window.toggleClipFilter = toggleClipFilter;
window._syncFilterChips = _syncFilterChips;
window._applyFilters = _applyFilters;
window._renderClips = _renderClips;
window._parseTimingOffset = _parseTimingOffset;
window._reloadClipList = _reloadClipList;
window._renderClipFilterCounts = _renderClipFilterCounts;
window.openScoreOverride = openScoreOverride;
window.closeScoreOverrideModal = closeScoreOverrideModal;
window.closeSimilarClipsModal = closeSimilarClipsModal;
window.openClipActionsModal = openClipActionsModal;
// clipbulk.js - _pruneClipSelection, _updateBulkToolbar and _toggleClipSelection
// are read as window.* by clips.js (already-ESM, but clips.js's own migration
// predates this one and never switched these to an import - out of scope to
// touch clips.js here); undoLastBulkStatus is called as a bare global by
// clips.js's undoLastStatus (same reason). bulkSetClipStatus, bulkDeleteClips,
// bulkExportClips and _clearClipSelection dropped: their only callers were this
// module's own inline handlers, now data-act delegation inside clipbulk.js
// itself, so nothing outside the module needs them off window anymore.
window._pruneClipSelection = _pruneClipSelection;
window._updateBulkToolbar = _updateBulkToolbar;
window._toggleClipSelection = _toggleClipSelection;
window.undoLastBulkStatus = undoLastBulkStatus;
