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
