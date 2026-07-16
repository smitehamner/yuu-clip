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
import { _buildMediaUrl, setupRecordingPreview } from './core/preview.js';
import {
  _syncSortDirBtn, _diarizationReason, _diarizationReadiness, _diarizationNoteHtml,
  openLog, clearLog, appendLog, showToast, netErrMsg, revealInFolder, copyText,
  collapsibleCard,
} from './core/utils.js';
import {
  showAlert, closeAlertModal, showConfirm, _confirmCancel,
  openActionsModal, closeActionsModal, topmostVisibleModal, _menuArrowKeydown,
  isHamburgerOpen, toggleHamburger, closeHamburger,
  openControlsModal, closeControlsModal,
  openDiffModal, _diffDiscard,
  openFieldEditModal, closeFieldEditModal,
  closeKebab, showKebab, initResize, _applyPrereqWarnings, showUndoToast,
  playbackRatePref, applyPlaybackRate, initPlaybackRate,
} from './core/ui.js';
import {
  openGettingStartedModal, closeGettingStartedModal,
  openAboutModal, closeAboutModal,
  openHelpModal, closeHelpModal,
  openGlossaryModal, closeGlossaryModal, _filterGlossary,
} from './core/helpmodals.js';
// shortcuts.js has no public surface (its only export is the keydown listener
// registration) - a bare side-effect import registers the global handler
// without adding anything to the window shim.
import './core/shortcuts.js';
import {
  _ensureModelCatalog, refreshModelCatalog,
  _updateLlmCapabilities, _renderCapabilityTiers,
  gateOnCapability,
} from './settings/modelcatalog.js';
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
} from './videos/videos.js';
import {
  generateTimeline, closeTimelineIntervalModal, _renderTimelineHTML, _timelineEmptyNoteHTML,
} from './videos/videos-timeline.js';
import { summarizeVideo, regenSummaryAuto } from './videos/videos-summary.js';
import { _renderRunMetaCard, _runTimingLine } from './videos/videos-runmeta.js';
import {
  SessionUI, isSessionCollapsed, sessionGroupHeaderLi, toggleGroupSelect,
} from './videos/sessions.js';
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
} from './clips/clips.js';
import {
  _pruneClipSelection, _updateBulkToolbar, _toggleClipSelection, undoLastBulkStatus,
} from './clips/clipbulk.js';
import {
  exportClip, closeExportModal, confirmExport,
  _onExportPresetChange, _updateExportTightCapWarning, _setExportFraming,
  _handleExportFormatAction, _downloadClipExport, _revealClipExport, _copyClipExportPaths,
} from './clips/clipexport.js';
import { openClipCreatePicker } from './clips/clipcreate.js';
import {
  _isNewRecordingPanelOpen, openNewRecordingPanel, openReanalyzePanel, closeNewRecordingPanel,
  _doCloseNewRecordingPanel,
  _renderSubtitleSourcePicker,
  renderEstimate, startAnalyze, reattachAnalysis,
  _showAnalysisToast,
  closeProfileManager,
} from './analyze/analyze.js';
import {
  openHighlightReelsModal, openReelForSession, closeHighlightReelsModal, switchReelTab,
  _reelMove, _reelToggle, closeReelPreview, openBatchExportModal, closeBatchExportModal,
} from './analyze/reel.js';
import {
  _loadContexts, ensureContexts, _parseWeight,
  _termContextOptions, _renderTermGroups,
  openContextManager, closeContextManager, openNewContext,
  cancelContextEdit, duplicateContext, _deriveContextId,
  openCharacterForm, cancelCharacterEdit, _updateCharBoostLabel,
  addVideoContext,
  openAutoApproveModal, closeAutoApproveModal,
  openRetranscribeModal, closeRetranscribeModal, startRetranscribe,
  rescoreClip, rescoreClipChoose, rescoreClips, rescoreFailedClips,
  rescoreAllClips, redescribeAllClips, resetApprovals,
} from './library/contexts.js';
import {
  openSettings, closeSettings, applyTheme, applyAccent,
  _onDiarizationBackendChange, _updateDiarizationStatus,
  _scrollToSettingsSection, _checkSettingsDirty,
} from './settings/settings.js';
import {
  _updateExportNameTemplatePreview, _updateTitleCardPreview,
} from './settings/settings-previews.js';
import { _refreshInstallStatus } from './settings/settings-installs.js';
import {
  initProjectSwitcher, isProjectMenuOpen, closeProjectMenu, closeOpenProjectModal,
} from './settings/projects.js';
// settings-backup.js has no external window consumer left (its two names,
// backupProject and startRestore, were only read by index.html inline handlers,
// now addEventListener inside settings-backup.js itself) - a bare side-effect
// import keeps esbuild pulling it into the bundle and runs its static wiring.
import './settings/settings-backup.js';
import {
  initModelDownload, initModelPrefetch, getWhisperDownloadPct, _resetModelDownloads,
} from './settings/modeldownload.js';
import {
  SoundFx, initSoundSettings, _soundSettingsDirty, commitSoundSettings,
} from './library/sounds.js';
import {
  initHotwordSettings, ensureHotwordsCache, hasEnabledSemanticHotwords,
  confirmScanHotwordsForVideo,
} from './library/hotwords.js';
import { initSensitiveTermSettings } from './library/sensitive.js';
import {
  ensureExportPresetsCache, exportPresetLabel, exportPresetIsVertical,
  exportPresetTargetSizeMb, populateExportPresetSelect, initExportPresetSettings,
} from './library/exportpresets.js';
import { loadSpeakers } from './people/speakers.js';
import { openPeopleView } from './people/voices.js';
import {
  loadClipTranscript, reloadVideoTranscriptIfOpen, renderTranscriptLines,
} from './analyze/transcript.js';
import { openNameCorrections } from './people/namecorrections.js';
import { openExportEditor } from './library/exporteditor.js';
import {
  isSplitEditorOpen, openSplitEditor, closeSplitEditor,
  initPreSplitDuration, hidePreSplitSection,
  _fmtSplitTime, _parseSplitTime, _computeSuggestionPins, splitTimelineClick,
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
// clipexport.js - exportClip is read as a bare global by shortcuts.js's
// _actOnSubject and by clips.js as window.exportClip; closeExportModal is read
// as a bare global by shortcuts.js's Escape-key modal-closer map and by the
// module's own dynamically-built onclick strings (the _diarizationNoteHtml
// "Settings" link and the MediaPipe-missing "install it in Settings" link, both
// evaluated in global scope); confirmExport, _onExportPresetChange,
// _updateExportTightCapWarning and _setExportFraming have no outside JS caller
// left (their only external use was the now-removed index.html inline
// handlers) but tests/ui/test_ui_clips.py and test_ui_clips2.py call all of
// them directly via page.evaluate. _renderExportModeSummary dropped from the
// window shim: reel.js (now ESM) imports it directly instead of reading it as
// a bare global.
// _handleExportFormatAction, _downloadClipExport, _revealClipExport and
// _copyClipExportPaths are read as window.* by clips.js (already-ESM, but
// clips.js's own migration predates this one and never switched these to an
// import - out of scope to touch clips.js here). _onExportCaptionsChange,
// _onExportRetranscribeChange, _onExportWordHighlightChange,
// _exportTightCapWarning, _autoFrameExport and _updateExportModeSummary
// dropped: their only callers were this module's own inline handlers (now
// addEventListener inside clipexport.js itself) or its own internal logic, so
// nothing outside the module needs them off window anymore.
window.exportClip = exportClip;
window.closeExportModal = closeExportModal;
window.confirmExport = confirmExport;
window._onExportPresetChange = _onExportPresetChange;
window._updateExportTightCapWarning = _updateExportTightCapWarning;
window._setExportFraming = _setExportFraming;
window._handleExportFormatAction = _handleExportFormatAction;
window._downloadClipExport = _downloadClipExport;
window._revealClipExport = _revealClipExport;
window._copyClipExportPaths = _copyClipExportPaths;
// clipcreate.js - openClipCreatePicker is read as window.* by clips.js and
// videos.js (already-ESM, but their own migrations predate this one and never
// switched to an import - out of scope to touch those modules here) and is
// invoked directly by tests/ui/test_ui_clipcreate.py via page.evaluate.
// isClipCreateOpen dropped: it has no callers anywhere (not even internally in
// clipcreate.js) - dead code left as a named export in case a future caller
// needs a PanelNav('clip-create')-open check.
window.openClipCreatePicker = openClipCreatePicker;
// analyze.js - _isNewRecordingPanelOpen, closeNewRecordingPanel and
// _doCloseNewRecordingPanel are called as bare globals by shortcuts.js and
// settings.js (still classic); openNewRecordingPanel and openReanalyzePanel are
// read as window.* by clips.js/videos.js (already-ESM, but their own migrations
// predate this one and never switched to an import - out of scope to touch those
// modules here) and openReanalyzePanel is also invoked directly by
// tests/ui/test_ui_analyze.py via page.evaluate. closeProfileManager is called
// as a bare global by shortcuts.js's Escape-key modal-closer map.
// renderEstimate, startAnalyze, _showAnalysisToast and
// _renderSubtitleSourcePicker have no outside JS caller left (their only
// external use was now-removed index.html inline handlers) but
// tests/ui/test_ui_analyze.py, test_ui_whisper_prefetch.py and
// test_ui_toasts.py call them directly via page.evaluate. reattachAnalysis is
// called as a bare global by boot.js. _probedInfo/_panelDirty are NOT here -
// videos.js imports them directly from analyze.js as live ESM bindings instead
// of reading them off window. scheduleProbe, pickFile, showImportUrlSection,
// hideImportUrlSection, checkImportUrl, startImportUrlDownload,
// openProfileManager, openNewProfile, renderTrackRows, onLabelChange,
// _clearPeNameError, saveProfile, deleteProfile, cancelProfileEdit,
// _toggleCtxPill, _onSubtitleSourceChange, _doStartAnalyze, _streamAnalyzeEvents,
// _surfaceAnalyzeWarnings and _warmPreviewProxy dropped: their only callers were
// this module's own inline handlers (now addEventListener/delegation inside
// analyze.js itself) or its own internal logic, so nothing outside the module
// needs them off window anymore.
window._isNewRecordingPanelOpen = _isNewRecordingPanelOpen;
window.openNewRecordingPanel = openNewRecordingPanel;
window.openReanalyzePanel = openReanalyzePanel;
window.closeNewRecordingPanel = closeNewRecordingPanel;
window._doCloseNewRecordingPanel = _doCloseNewRecordingPanel;
window._renderSubtitleSourcePicker = _renderSubtitleSourcePicker;
window.renderEstimate = renderEstimate;
window.startAnalyze = startAnalyze;
window.reattachAnalysis = reattachAnalysis;
window._showAnalysisToast = _showAnalysisToast;
window.closeProfileManager = closeProfileManager;
// reel.js - openHighlightReelsModal and switchReelTab are invoked directly by
// tests/ui/*.py via page.evaluate; openReelForSession is called as a bare
// global by sessions.js (already-ESM, but sessions.js's own migration predates
// this one and never switched it to an import - out of scope to touch
// sessions.js here); closeHighlightReelsModal and closeReelPreview are called
// as bare globals by shortcuts.js's Escape-key modal-closer map (same reason);
// _reelMove and _reelToggle have no outside JS caller left (their only
// external use was now-removed reel.js-owned onclick/onchange attributes) but
// tests/ui/test_ui_reel.py calls both directly via page.evaluate;
// openBatchExportModal is read as window.* by videos.js (already-ESM, out of
// scope to touch here) and invoked directly by tests/ui/test_ui_clips.py;
// closeBatchExportModal is called as a bare global by shortcuts.js's
// Escape-key modal-closer map and invoked directly by
// tests/ui/test_ui_clips.py. loadReelClips, _toggleReelPoolStatus, startDemo,
// closeDemoModal, updateReelEstimate, exportUnexportedReelClips,
// _onReelCaptionsChange, _onReelWordHighlightChange, previewReelPlaylist,
// _reelPreviewStep, confirmBatchExport, updateBatchEstimate,
// _onBatchCaptionsChange and _onBatchRetranscribeChange dropped: their only
// callers were reel.js's own now-removed index.html inline handlers, now
// addEventListener inside reel.js itself, so nothing outside the module needs
// them off window anymore.
window.openHighlightReelsModal = openHighlightReelsModal;
window.openReelForSession = openReelForSession;
window.closeHighlightReelsModal = closeHighlightReelsModal;
window.switchReelTab = switchReelTab;
window._reelMove = _reelMove;
window._reelToggle = _reelToggle;
window.closeReelPreview = closeReelPreview;
window.openBatchExportModal = openBatchExportModal;
window.closeBatchExportModal = closeBatchExportModal;
// contexts.js - _loadContexts is called as a bare global by boot.js; ensureContexts
// by hotwords.js/sensitive.js (bare) and videos.js (already-ESM, window.*);
// _parseWeight, openNewContext, cancelContextEdit, duplicateContext,
// _deriveContextId, openCharacterForm and _updateCharBoostLabel are invoked
// directly by tests/ui/test_ui_contexts.py / test_ui_utils.py via page.evaluate;
// _termContextOptions and _renderTermGroups are called as bare globals by
// hotwords.js/sensitive.js; openContextManager is read as window.* by
// analyze.js/videos.js (already-ESM) and invoked directly by
// tests/ui/test_ui_contexts.py; closeContextManager is called as a bare global
// by shortcuts.js's Escape-key modal-closer map; addVideoContext is read as
// window.* by videos.js; openAutoApproveModal is read as window.* by videos.js;
// closeAutoApproveModal is called as a bare global by shortcuts.js;
// openRetranscribeModal is read as window.* by clips.js and invoked directly by
// tests/ui/test_ui_clips2.py; closeRetranscribeModal is called as a bare global
// by shortcuts.js and by this module's own dynamically-built onclick string (the
// _diarizationNoteHtml "Settings" link, evaluated in global scope);
// startRetranscribe is invoked directly by tests/ui/test_ui_clips2.py; rescoreClip,
// rescoreClipChoose, rescoreClips, rescoreFailedClips, rescoreAllClips,
// redescribeAllClips and resetApprovals are read as window.* by already-ESM
// modules (clips.js, clipcreate.js, videos.js). saveContext, deleteContext,
// resetContextToTemplate, saveCharacter, deleteCharacter,
// _updateCharacterSectionVisibility, _loadCharacters, doAutoApprove and
// updateAutoApprovePreview dropped: their only callers were contexts.js's own
// now-removed index.html inline handlers or its own internal logic, so nothing
// outside the module needs them off window anymore.
window._loadContexts = _loadContexts;
window.ensureContexts = ensureContexts;
window._parseWeight = _parseWeight;
window._termContextOptions = _termContextOptions;
window._renderTermGroups = _renderTermGroups;
window.openContextManager = openContextManager;
window.closeContextManager = closeContextManager;
window.openNewContext = openNewContext;
window.cancelContextEdit = cancelContextEdit;
window.duplicateContext = duplicateContext;
window._deriveContextId = _deriveContextId;
window.openCharacterForm = openCharacterForm;
window.cancelCharacterEdit = cancelCharacterEdit;
window._updateCharBoostLabel = _updateCharBoostLabel;
window.addVideoContext = addVideoContext;
window.openAutoApproveModal = openAutoApproveModal;
window.closeAutoApproveModal = closeAutoApproveModal;
window.openRetranscribeModal = openRetranscribeModal;
window.closeRetranscribeModal = closeRetranscribeModal;
window.startRetranscribe = startRetranscribe;
window.rescoreClip = rescoreClip;
window.rescoreClipChoose = rescoreClipChoose;
window.rescoreClips = rescoreClips;
window.rescoreFailedClips = rescoreFailedClips;
window.rescoreAllClips = rescoreAllClips;
window.redescribeAllClips = redescribeAllClips;
window.resetApprovals = resetApprovals;
// settings.js - openSettings is called as a bare global from dynamically-built
// onclick strings owned by other modules (analyze.js/clipexport.js/contexts.js's
// _diarizationNoteHtml links, modelcatalog.js's "Open Settings" link) and by
// tests/ui/*.py via page.evaluate; closeSettings is called as a bare global by
// shortcuts.js's Escape-key modal-closer map and as window.closeSettings by
// analyze.js; applyTheme/applyAccent are invoked directly by
// tests/ui/test_ui_theme.py via page.evaluate; _onDiarizationBackendChange is
// invoked directly by tests/ui/test_ui_settings.py via page.evaluate;
// _updateDiarizationStatus has no current external caller but
// settings-installs.js documents an intent to resolve it through window at call
// time - kept to honor that sibling contract until that module migrates;
// _scrollToSettingsSection is read as window.* by clips.js/videos.js
// (already-ESM, but their own migrations predate this one and never switched to
// an import - out of scope to touch those modules here) and modelcatalog.js;
// _checkSettingsDirty is read as window.* by modelcatalog.js. saveSettings,
// _onLlmEnabledChange, _onLaughModeChange, _onSimilarityBackendChange,
// _onPrivacyModeChange, _setPrivacyMode, _currentPrivacyMode, _onPlayNextChange,
// _onLoopClipChange, _onSettingsWordHighlightChange, revertSection,
// revertAllSettings, applyContentPreset and _onContentPresetChange dropped:
// their only callers were settings.js's own now-removed index.html inline
// handlers (now addEventListener inside settings.js itself) or its own internal
// logic, so nothing outside the module needs them off window anymore.
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.applyTheme = applyTheme;
window.applyAccent = applyAccent;
window._onDiarizationBackendChange = _onDiarizationBackendChange;
window._updateDiarizationStatus = _updateDiarizationStatus;
window._scrollToSettingsSection = _scrollToSettingsSection;
window._checkSettingsDirty = _checkSettingsDirty;
// settings-previews.js - _updateExportNameTemplatePreview and
// _updateTitleCardPreview are read as window.* by settings.js's
// _applyExportFields (already-ESM, but its own migration predates this one and
// never switched to an import - out of scope to touch settings.js here). Both of
// this module's field oninput handlers are now addEventListener inside
// settings-previews.js itself, so no inline handler reads either name.
window._updateExportNameTemplatePreview = _updateExportNameTemplatePreview;
window._updateTitleCardPreview = _updateTitleCardPreview;
// settings-installs.js - _refreshInstallStatus is read as window.* by settings.js's
// _applySettingsToUI (already-ESM, but its own migration predates this one and never
// switched to an import - out of scope to touch settings.js here). installPackage
// dropped: its only consumer was index.html's inline install-button onclick, now an
// addEventListener inside settings-installs.js itself.
window._refreshInstallStatus = _refreshInstallStatus;
// projects.js - initProjectSwitcher is called as a bare global by boot.js (still
// classic); isProjectMenuOpen and closeProjectMenu are called as bare globals by
// shortcuts.js's Escape-key handler (already-ESM, but out of scope to switch it to
// an import here); closeOpenProjectModal is invoked directly by
// tests/ui/test_ui_projects.py via page.evaluate. toggleProjectMenu,
// browseForProjectFolder and _openProjectConfirm dropped: their only callers were
// this module's own now-removed index.html inline handlers (now addEventListener
// inside projects.js itself), so nothing outside the module needs them off window.
window.initProjectSwitcher = initProjectSwitcher;
window.isProjectMenuOpen = isProjectMenuOpen;
window.closeProjectMenu = closeProjectMenu;
window.closeOpenProjectModal = closeOpenProjectModal;
// modeldownload.js - initModelDownload and initModelPrefetch are called as bare
// globals by boot.js (still classic); getWhisperDownloadPct is read as window.* by
// analyze.js (already-ESM, but out of scope to switch it to an import here);
// _resetModelDownloads is invoked directly by tests/ui/test_ui_modeldownload.py and
// test_ui_whisper_prefetch.py via page.evaluate. _cancelDownload dropped: its only
// caller is this module's own row-action onclick (property assignment inside
// _wireRowActions), so nothing outside the module needs it off window.
window.initModelDownload = initModelDownload;
window.initModelPrefetch = initModelPrefetch;
window.getWhisperDownloadPct = getWhisperDownloadPct;
window._resetModelDownloads = _resetModelDownloads;
// sounds.js - SoundFx is read as window.SoundFx by already-ESM callers
// (analyze.js, clipbulk.js, clipexport.js, contexts.js, reel.js, videos.js,
// jobs.js) and as a bare global by the still-classic exporteditor.js;
// initSoundSettings, _soundSettingsDirty and commitSoundSettings are read as
// window.* by settings.js (already-ESM, but its own migration predates this one
// and never switched to an import - out of scope to touch settings.js here).
// _onSoundUpload dropped: its only consumer was index.html's inline upload
// onchange, now an addEventListener inside sounds.js itself.
window.SoundFx = SoundFx;
window.initSoundSettings = initSoundSettings;
window._soundSettingsDirty = _soundSettingsDirty;
window.commitSoundSettings = commitSoundSettings;
// hotwords.js - initHotwordSettings, hasEnabledSemanticHotwords and
// confirmScanHotwordsForVideo are read as window.* by already-ESM callers
// (settings.js reads initHotwordSettings; videos.js reads
// hasEnabledSemanticHotwords/confirmScanHotwordsForVideo - both predate this
// migration and never switched to an import, out of scope to touch here);
// ensureHotwordsCache is called as a bare global by boot.js (still classic) and
// invoked directly by tests/ui/test_ui_hotwords.py via page.evaluate.
// addHotwordRow and scanHotwordsForVideo dropped: addHotwordRow's only caller
// was index.html's inline onclick (now an addEventListener inside hotwords.js
// itself) and scanHotwordsForVideo is only called by this module's own
// confirmScanHotwordsForVideo, so nothing outside the module reads either.
window.initHotwordSettings = initHotwordSettings;
window.ensureHotwordsCache = ensureHotwordsCache;
window.hasEnabledSemanticHotwords = hasEnabledSemanticHotwords;
window.confirmScanHotwordsForVideo = confirmScanHotwordsForVideo;

// sensitive.js - initSensitiveTermSettings is read as window.* by settings.js
// (already-ESM, still calls via window; predates this migration). Nothing else
// outside the module reads it. ensureSensitiveTermsCache has no external caller
// (unlike hotwords, the sensitive cache is primed only at Settings-open), and
// addSensitiveTermRow's only caller was index.html's inline onclick (now an
// addEventListener inside sensitive.js) - so neither needs a window shim.
window.initSensitiveTermSettings = initSensitiveTermSettings;
// exportpresets.js - ensureExportPresetsCache is called as a bare global by
// boot.js and exporteditor.js (still classic); exportPresetIsVertical also by
// exporteditor.js (classic). exportPresetLabel is read as window.* by clips.js
// and clipexport.js (already-ESM, but their own migrations predate this one and
// never switched to an import - out of scope to touch them here);
// exportPresetIsVertical/exportPresetTargetSizeMb/populateExportPresetSelect are
// read as window.* by clipexport.js (same reason); initExportPresetSettings is
// read as window.* by settings.js (same reason). addExportPresetRow dropped: its
// only caller was index.html's inline onclick (now an addEventListener inside
// exportpresets.js itself), so nothing outside the module needs it off window.
window.ensureExportPresetsCache = ensureExportPresetsCache;
window.exportPresetLabel = exportPresetLabel;
window.exportPresetIsVertical = exportPresetIsVertical;
window.exportPresetTargetSizeMb = exportPresetTargetSizeMb;
window.populateExportPresetSelect = populateExportPresetSelect;
window.initExportPresetSettings = initExportPresetSettings;
// speakers.js - loadSpeakers is read as window.loadSpeakers by videos.js
// (already-ESM, but its own migration predates this one and never switched to an
// import - out of scope to touch videos.js here) and as a bare global by the
// still-classic transcript.js and voices.js. Everything else in the module stays
// module-private (delegated event listeners on #detail, no external caller).
window.loadSpeakers = loadSpeakers;
// voices.js - openPeopleView is read as window.openPeopleView by speakers.js
// (already-ESM, but its own migration never switched it to an import - out of
// scope to touch speakers.js here) and invoked directly by tests/ui/test_ui_voices.py
// via page.evaluate. isPeopleOpen dropped from the shim: it has no caller anywhere
// (kept as a named export in case a future caller needs a PanelNav('people') check).
// The People nav button's inline onclick is now an addEventListener inside voices.js.
window.openPeopleView = openPeopleView;
// transcript.js - reloadVideoTranscriptIfOpen is read as a bare global by the
// still-classic namecorrections.js and as window.* by speakers.js/videos.js/voices.js
// (already-ESM, but their own migrations predate this one and never switched to an
// import - out of scope to touch them here); renderTranscriptLines is read as window.*
// by clipcreate.js (already-ESM, same reason); loadClipTranscript is read as window.*
// by clips.js (already-ESM, same reason). loadVideoTranscript, seekPlayerTo and
// startEditCaption dropped: their only callers were this module's own internal logic
// and its delegated #detail listeners, so nothing outside the module reads them.
window.loadClipTranscript = loadClipTranscript;
window.reloadVideoTranscriptIfOpen = reloadVideoTranscriptIfOpen;
window.renderTranscriptLines = renderTranscriptLines;
// namecorrections.js - openNameCorrections is read as window.* by videos.js
// (already-ESM, but its own migration predates this one and never switched to an
// import - out of scope to touch videos.js here) and invoked directly by
// tests/ui/test_ui_namecorrections.py via page.evaluate. isNameCorrectionsOpen
// dropped from the shim: it has no caller anywhere (kept as a named export in
// case a future caller needs a PanelNav('name-corrections')-open check).
window.openNameCorrections = openNameCorrections;
// exporteditor.js - openExportEditor is read as window.* by clips.js (already-ESM,
// but its own migration predates this one and never switched to an import - out of
// scope to touch clips.js here) and invoked directly by
// tests/ui/test_ui_exporteditor.py via page.evaluate. isExportEditorOpen dropped
// from the shim: it has no caller anywhere (kept as a named export in case a future
// caller needs a PanelNav('export-editor')-open check).
window.openExportEditor = openExportEditor;
// split.js - isSplitEditorOpen/openSplitEditor/closeSplitEditor are read as
// window.* by videos.js (already-ESM, but its own migration predates this one
// and never switched to an import - out of scope to touch videos.js here) and
// openSplitEditor/closeSplitEditor are also invoked directly by
// tests/ui/test_ui_keyboard.py, test_ui_panelnav.py and test_ui_split.py via
// page.evaluate; initPreSplitDuration/hidePreSplitSection/_fmtSplitTime are read
// as window.* by analyze.js (already-ESM, same reason), and _fmtSplitTime/
// _parseSplitTime/_computeSuggestionPins/splitTimelineClick are invoked directly
// by tests/ui/test_ui_utils.py and test_ui_split.py via page.evaluate. The four
// test-poked STATE names (_splitPoints, _splitNames, _splitDurationS,
// _splitEnergyFlat) plus _suggestionPins are NOT here - split.js wires those onto
// window itself via live get/set accessors, since a plain snapshot would go stale
// on reassignment (mirrors the jobs.js accessor-bridge). videos.js/analyze.js read
// _splitPoints/_splitDurationS/_splitIgnored via a direct import instead of window.
window.isSplitEditorOpen = isSplitEditorOpen;
window.openSplitEditor = openSplitEditor;
window.closeSplitEditor = closeSplitEditor;
window.initPreSplitDuration = initPreSplitDuration;
window.hidePreSplitSection = hidePreSplitSection;
window._fmtSplitTime = _fmtSplitTime;
window._parseSplitTime = _parseSplitTime;
window._computeSuggestionPins = _computeSuggestionPins;
window.splitTimelineClick = splitTimelineClick;
