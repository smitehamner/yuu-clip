// Infrastructure - first-paint boot wiring (a11y init, event hookup, initial load).
//   Not a feature module; loaded last in index.html. Entry point: exports nothing,
//   so it is a bare IIFE with no Object.assign(window, ...) list.
// ── accessibility init ────────────────────────────────────────────────────────
(function () {
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
ensureExportPresetsCache();
fetch('/api/status').then(r => r.json()).then(d => {
  if (d.version) {
    const versionLabel = (/^\d/.test(d.version) ? 'v' : '') + d.version;
    document.getElementById('version-tag').textContent = versionLabel;
    document.getElementById('about-version').textContent = `Version ${versionLabel}`;
  }
  AppState.exportDir = d.export_dir || null;
  AppState.reelsDir = d.reels_dir || null;
  AppState.canReveal = !!d.can_reveal;
  // Reconnect to an analysis that was already running when this page loaded
  // (e.g. after a refresh) - the subprocess survives independently of the stream.
  if (d.analyze_filename) reattachAnalysis(d.analyze_filename, d.analyze_paused);
}).catch(() => {});

if (window.electronAPI) {
  document.getElementById('btn-setup-wizard').style.display = '';
  document.getElementById('btn-refresh').style.display = '';
}

fetch('/api/config').then(r => r.json()).then(cfg => {
  window._aiPrivacyMode = cfg.ai_privacy_mode || 'local_only';
  _updateLlmRemoteIndicator(cfg.llm_backend || 'llamacpp', cfg.ollama_enabled !== false);
  window._visionEnabled = cfg.vision_enabled === true;
}).catch(() => {});

window._prereqs = {ffmpeg_ok: true, llm_ok: true};
fetch('/api/prereqs').then(r => r.json()).then(p => {
  window._prereqs = p;
  _applyPrereqWarnings(p);
}).catch(() => {});
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
})();
