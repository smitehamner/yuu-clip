// Infrastructure - first-paint boot wiring (a11y init, event hookup, initial load).
//   Not a feature module; imported LAST from main.esm.js so its top-level init runs
//   after every other module in the ESM graph has been evaluated. Exports nothing.
import { AppState } from './state.js';
import { initResize, initPlaybackRate, _applyPrereqWarnings } from './ui.js';
import { _syncSortDirBtn } from './utils.js';
import { initProjectSwitcher } from '../settings/projects.js';
import { _loadContexts, initContextsListeners } from '../library/contexts.js';
import { loadVideos } from '../videos/videos.js';
import { ensureHotwordsCache, initHotwordListeners } from '../library/hotwords.js';
import { ensureExportPresetsCache, initExportPresetListeners } from '../library/exportpresets.js';
import { initSensitiveListeners } from '../library/sensitive.js';
import { initColorPickerListeners } from '../library/colorpicker.js';
import { reattachAnalysis } from '../analyze/analyze.js';
import { openGettingStartedModal } from './helpmodals.js';
import { initModelDownload, initModelPrefetch } from '../settings/modeldownload.js';
import { _renderClips, _syncKindChips } from '../clips/clips.js';
import { renderGpuWarningChip } from './gpustatus.js';
import { initUpdateCheckOnLaunch, wireUpdateBanner } from './updatecheck.js';
import { initSpeakerListeners } from '../people/speakers.js';
import { initVoicesListeners } from '../people/voices.js';

// ── accessibility init ────────────────────────────────────────────────────────
document.querySelectorAll('.modal-bg').forEach((bg, i) => {
  const inner = bg.querySelector('.modal, [class*="modal"]');
  if (!inner) return;
  inner.setAttribute('role', 'dialog');
  inner.setAttribute('aria-modal', 'true');
  const heading = inner.querySelector('h3');
  if (heading) {
    const labelId = `modal-title-${i}`;
    heading.id = heading.id || labelId;
    inner.setAttribute('aria-labelledby', heading.id || labelId);
  }
});

// ── boot ──────────────────────────────────────────────────────────────────────
initResize();
initPlaybackRate();
initProjectSwitcher();
_loadContexts();
loadVideos();
ensureHotwordsCache();
initHotwordListeners();
initSpeakerListeners();
initVoicesListeners();
initContextsListeners();
initSensitiveListeners();
initColorPickerListeners();
ensureExportPresetsCache();
initExportPresetListeners();
fetch('/api/status').then(r => r.json()).then(d => {
  if (d.version) {
    const versionLabel = (/^\d/.test(d.version) ? 'v' : '') + d.version;
    document.getElementById('version-tag').textContent = versionLabel;
    document.getElementById('about-version').textContent = `Version ${versionLabel}`;
  }
  AppState.exportDir = d.export_dir || null;
  AppState.reelsDir = d.reels_dir || null;
  AppState.canReveal = !!d.can_reveal;
  renderGpuWarningChip(d);
  // Reconnect to an analysis that was already running when this page loaded
  // (e.g. after a refresh) - the subprocess survives independently of the stream.
  if (d.analyze_filename) reattachAnalysis(d.analyze_filename, d.analyze_paused);
}).catch(() => {});

if (window.electronAPI) {
  document.getElementById('btn-setup-wizard').style.display = '';
  document.getElementById('btn-refresh').style.display = '';
}

// Single place that (re)loads the boot-cached server state and re-renders every
// surface that reads it, so a server-side change (model download, settings save)
// shows up WITHOUT an app restart. These stay on `window` because their readers
// (ui.js, clips.js, videos.js, contexts.js) are ESM but still read them as
// window.* - a shared-mutable-state bridge to retire when those reads move to
// imports (the vitest follow-on cleanup). Cached globals and their readers:
//   window._prereqs      -> analyze prereq banner (ui.js), "Basic description"
//                           chip (clips.js), ffmpeg gate (videos.js)
//   window._aiPrivacyMode -> "Basic description" chip (clips.js)
//   window._visionEnabled -> vision frames (clips.js, contexts.js)
// Call refreshServerState() from any action that mutates these on the server.
window._prereqs = {ffmpeg_ok: true, llm_ok: true, llm_reason: ''};
async function refreshServerState() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    window._aiPrivacyMode = cfg.ai_privacy_mode || 'local_only';
    window._visionEnabled = cfg.vision_enabled === true;
    initUpdateCheckOnLaunch(cfg.update_check_enabled);
  } catch { /* keep the last known config on a transient fetch failure */ }
  try {
    const prereqs = await fetch('/api/prereqs').then(r => r.json());
    window._prereqs = prereqs;
    _applyPrereqWarnings(prereqs);
  } catch { /* keep the last known prereqs */ }
  try {
    const status = await fetch('/api/status').then(r => r.json());
    renderGpuWarningChip(status);
  } catch { /* keep the last known chip state */ }
  _renderClips();  // basic-description chip + vision frames
}
window.refreshServerState = refreshServerState;
refreshServerState();
const _savedSort = localStorage.getItem('clips-sort');
if (_savedSort) document.getElementById('clips-sort').value = _savedSort;
const _savedVideoSort = localStorage.getItem('videos-sort');
if (_savedVideoSort) {
  AppState.videoSort = _savedVideoSort;
  document.getElementById('videos-sort').value = _savedVideoSort;
}
AppState.clipSortDir = localStorage.getItem('clips-sort-dir') || 'desc';
AppState.videoSortDir = localStorage.getItem('videos-sort-dir') || 'desc';
_syncSortDirBtn('clips-sort-dir', AppState.clipSortDir);
_syncSortDirBtn('videos-sort-dir', AppState.videoSortDir);
AppState.clipKindFilter = localStorage.getItem('clips-kind-filter') || 'all';
_syncKindChips();
document.getElementById('log-panel').classList.add('visible', 'minimized');
document.getElementById('log-toggle').textContent = '▼';

if (!localStorage.getItem('yuu-getting-started-seen')) openGettingStartedModal();

// Background model-download handoffs (first-run-friction Stages 4 + 6): if the
// wizard queued a local model and none is ready yet, and/or the always-needed
// analysis models (speech + speaker) are not cached and prefetch is enabled, fetch
// them in the background with in-app progress banners that stack. Non-blocking -
// the app stays fully usable.
initModelDownload();
initModelPrefetch();
wireUpdateBanner();
