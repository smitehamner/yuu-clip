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
