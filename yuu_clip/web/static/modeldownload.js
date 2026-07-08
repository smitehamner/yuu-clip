// Feature-map — Background local-model download handoff + in-app progress banner
//   (first-run-friction Stage 4). On boot, if the setup wizard queued a local
//   model (config.pending_local_model) and no working text model exists yet, this
//   streams the server-side .gguf download and shows a dismissible top-of-app
//   banner so LLM scoring lights up without a restart. Non-blocking chrome: it
//   coexists with an analyze job, so it uses the low-level _openSSE transport with
//   its own stream handle (NOT _activeES, which the single job header owns).
//   API: routes/llm.py (/api/llm/download-status[/clear], /api/llm/gguf/download)
//   Tests: tests/test_ui_modeldownload.py
(function () {
// A connection/offline failure reads differently to the user than a mid-download
// error, so the banner shows a "will retry when back online" state for the former.
const _CONNECTION_ERROR_RE = /could not connect|connection lost|server disconnected|failed to fetch/i;
// The download subprocess prints these before __DONE__ on failure; __DONE__ only
// means "the subprocess exited", never "succeeded" (see routes/llm.py + sse.py).
const _DOWNLOAD_ERROR_RE = /download failed|\[error:/i;

let _downloadES = null;
let _sawErrorLine = false;

function _banner() { return document.getElementById('model-download-banner'); }

async function initModelDownload() {
  let status;
  try {
    status = await fetch('/api/llm/download-status').then(r => r.json());
  } catch { return; }
  if (!status || !status.pending_model_id) return;
  // Another tab/stream already owns the download — do not start a second one.
  if (status.downloading) return;
  let cap;
  try {
    cap = await fetch('/api/llm/capabilities').then(r => r.json());
  } catch { cap = {text: false}; }
  if (cap && cap.text) {
    // A working model already exists (e.g. the wizard downloaded it, or a manual
    // path was set) — the pending flag is stale, so clear it and show nothing.
    await _clearPending();
    return;
  }
  _startModelDownload(status.pending_model_id);
}

function _startModelDownload(modelId) {
  if (_downloadES) return;
  _sawErrorLine = false;
  _renderProgressBanner(null);
  const handle = _openSSE(
    `/api/llm/gguf/download?model_id=${encodeURIComponent(modelId)}`,
    _onDownloadLine,
    _onDownloadDone,
    _onDownloadError,
  );
  _downloadES = handle;
}

function _onDownloadLine(line) {
  if (_DOWNLOAD_ERROR_RE.test(line)) _sawErrorLine = true;
  const match = line.match(/(\d+)\s*%/);
  if (match) _renderProgressBanner(parseInt(match[1], 10));
}

async function _onDownloadDone() {
  _downloadES = null;
  if (_sawErrorLine) {
    _renderFailureBanner('Model download failed - check your connection; you can retry in Settings.');
    return;
  }
  await _clearPending();
  _hideBanner();
  _refreshCapabilities();
  showToast('Local model ready - LLM scoring is now available.', 'success');
}

function _onDownloadError(message) {
  _downloadES = null;
  if (_CONNECTION_ERROR_RE.test(message || '')) {
    _renderFailureBanner('No internet - the AI model will download when you are back online, or set it up in Settings.');
  } else {
    _renderFailureBanner('Model download failed - check your connection; you can retry in Settings.');
  }
}

async function _cancelModelDownload() {
  if (_downloadES) { _downloadES.close(); _downloadES = null; }
  // Clearing the pending flag drops the app to lightweight mode so the download
  // does not auto-retry on every launch; the user can set it up later in Settings.
  await _clearPending();
  _hideBanner();
  showToast('Local model setup skipped - you can set it up anytime in Settings.', 'info');
}

function _clearPending() {
  return fetch('/api/llm/download-status/clear', {method: 'POST'}).catch(() => {});
}

function _refreshCapabilities() {
  if (window._updateLlmCapabilities) _updateLlmCapabilities();
  if (window._renderCapabilityTiers) _renderCapabilityTiers();
}

function _hideBanner() {
  const el = _banner();
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
}

// pct null => indeterminate (no percentage parsed yet). The progress track is a
// data-* driven width so escHtml is unnecessary on it, but the model line uses
// only static copy, so nothing user-supplied is interpolated here.
function _renderProgressBanner(pct) {
  const el = _banner();
  if (!el) return;
  const known = typeof pct === 'number' && pct >= 0;
  const fillClass = known ? 'mdl-bar-fill' : 'mdl-bar-fill indeterminate';
  const fillStyle = known ? ` style="width:${pct}%"` : '';
  el.innerHTML =
    `<div class="mdl-body">` +
      `<span class="mdl-text">Downloading the AI model so scoring gets smarter - you can keep working.</span>` +
      `<div class="mdl-bar" role="progressbar"${known ? ` aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"` : ''}>` +
        `<div class="${fillClass}"${fillStyle}></div>` +
      `</div>` +
      (known ? `<span class="mdl-pct">${pct}%</span>` : '') +
    `</div>` +
    `<button type="button" class="btn ghost mdl-cancel" data-mdl-action="cancel">Cancel</button>`;
  el.style.display = '';
  _wireBannerActions();
}

function _renderFailureBanner(message) {
  const el = _banner();
  if (!el) return;
  el.innerHTML =
    `<div class="mdl-body"><span class="mdl-text mdl-text-warn">${escHtml(message)}</span></div>` +
    `<button type="button" class="btn ghost mdl-cancel" data-mdl-action="dismiss">Dismiss</button>`;
  el.style.display = '';
  _wireBannerActions();
}

function _wireBannerActions() {
  const el = _banner();
  if (!el) return;
  el.querySelectorAll('[data-mdl-action]').forEach(btn => {
    const action = btn.getAttribute('data-mdl-action');
    btn.onclick = () => { if (action === 'cancel') _cancelModelDownload(); else _hideBanner(); };
  });
}

Object.assign(window, {initModelDownload, _cancelModelDownload});
})();
