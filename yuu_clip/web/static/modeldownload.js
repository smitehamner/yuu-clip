// Feature-map - Background model-download handoffs + in-app progress banners
//   (first-run-friction Stages 4 + 6). On boot two independent background
//   downloads can start: the local LLM the wizard queued (config.pending_local_model)
//   and the analysis-model prefetch - speech + speaker (unless model_prefetch_disabled). Each
//   renders its own dismissible row inside #model-download-banner, so when both run
//   the banners STACK rather than fight for one slot. Non-blocking chrome: it uses
//   the low-level _openSSE transport with its own per-kind stream handle (NOT
//   _activeES, which the single job header owns).
//   API: routes/llm.py (/api/llm/download-status[/clear], /api/llm/gguf/download,
//        /api/whisper/prefetch), /api/config
//   Tests: tests/ui/test_ui_modeldownload.py, tests/ui/test_ui_whisper_prefetch.py
(function () {
// A connection/offline failure reads differently to the user than a mid-download
// error, so the banner shows a "will retry when back online" state for the former.
const _CONNECTION_ERROR_RE = /could not connect|connection lost|server disconnected|failed to fetch/i;
// The download subprocess prints these before __DONE__ on failure; __DONE__ only
// means "the subprocess exited", never "succeeded" (see routes/llm.py + sse.py).
const _DOWNLOAD_ERROR_RE = /download failed|\[error:/i;

// Per-kind copy + endpoints + completion hooks. Keeps the transport generic so
// the LLM handoff and the whisper prefetch share one stacking-banner implementation.
const _KINDS = {
  llm: {
    downloadUrl: id => `/api/llm/gguf/download?model_id=${encodeURIComponent(id)}`,
    progressText: 'Downloading the AI model so scoring gets smarter - you can keep working.',
    failureText: 'Model download failed - check your connection; you can retry in Settings.',
    offlineText: 'No internet - the AI model will download when you are back online, or set it up in Settings.',
    successToast: 'Local model ready - LLM scoring is now available.',
    cancelToast: 'Local model setup skipped - you can set it up anytime in Settings.',
    onSuccess: async () => { await _clearPending(); _refreshCapabilities(); },
    onCancel: async () => { await _clearPending(); },
  },
  whisper: {
    downloadUrl: () => `/api/whisper/prefetch`,
    progressText: 'Downloading the speech model so your first analysis is instant - you can keep working.',
    failureText: 'Speech model download failed - it will download automatically on your first analysis.',
    offlineText: 'No internet - the speech model will download on your first analysis when you are back online.',
    successToast: 'Speech model ready - your first analysis will be instant.',
    cancelToast: 'Speech model download stopped - it will download on your first analysis.',
    onSuccess: async () => {},
    onCancel: async () => {},
  },
  speaker: {
    downloadUrl: () => `/api/models/prefetch?slug=speaker`,
    progressText: 'Downloading the speaker-labeling model in the background - you can keep working.',
    failureText: 'Speaker model download failed - it will download the first time you detect speakers.',
    offlineText: 'No internet - the speaker model will download the first time you detect speakers.',
    successToast: 'Speaker-labeling model ready.',
    cancelToast: 'Speaker model download stopped - it will download the first time you detect speakers.',
    onSuccess: async () => {},
    onCancel: async () => {},
  },
};

// kind -> {es, sawError, lastPct}. lastPct feeds the analyze-start heads-up.
const _streams = {};

function _container() { return document.getElementById('model-download-banner'); }

// ── boot triggers ─────────────────────────────────────────────────────────────
async function initModelDownload() {
  let status;
  try {
    status = await fetch('/api/llm/download-status').then(r => r.json());
  } catch { return; }
  if (!status || !status.pending_model_id) return;
  // Another tab/stream already owns the download - do not start a second one.
  if (status.downloading) return;
  let cap;
  try {
    cap = await fetch('/api/llm/capabilities').then(r => r.json());
  } catch { cap = {text: false}; }
  if (cap && cap.text) {
    // A working model already exists (e.g. the wizard downloaded it, or a manual
    // path was set) - the pending flag is stale, so clear it and show nothing.
    await _clearPending();
    return;
  }
  _startDownload('llm', _KINDS.llm.downloadUrl(status.pending_model_id));
}

// Default-ON background prefetch of the always-needed analysis models (the speech
// model and the speaker-labeling model), unless the wizard opted out. Each starts
// only when it is missing and not already downloading; banners stack.
async function initModelPrefetch() {
  let cfg;
  try {
    cfg = await fetch('/api/config').then(r => r.json());
  } catch { return; }
  if (!cfg || cfg.model_prefetch_disabled) return;
  let status;
  try {
    status = await fetch('/api/llm/download-status').then(r => r.json());
  } catch { return; }
  if (!status) return;
  if (!status.whisper_cached && !status.whisper_downloading) {
    _startDownload('whisper', _KINDS.whisper.downloadUrl());
  }
  // speaker_available guards against prefetching a model whose backend can't run
  // (package not installed, or speaker labels turned off).
  if (status.speaker_available && !status.speaker_cached && !status.speaker_downloading) {
    _startDownload('speaker', _KINDS.speaker.downloadUrl());
  }
}

// ── stream lifecycle ──────────────────────────────────────────────────────────
function _startDownload(kind, url) {
  if (_streams[kind]) return;
  const state = {es: null, sawError: false, lastPct: null};
  _streams[kind] = state;
  _renderProgressRow(kind, null);
  // The model-download endpoints are POST-only (a GET 405s), so the transport
  // must POST rather than the default GET the analyze/score SSE streams use.
  state.es = _openSSE(
    url,
    line => _onDownloadLine(kind, line),
    () => _onDownloadDone(kind),
    message => _onDownloadError(kind, message),
    {method: 'POST'},
  );
}

function _onDownloadLine(kind, line) {
  const state = _streams[kind];
  if (!state) return;
  if (_DOWNLOAD_ERROR_RE.test(line)) state.sawError = true;
  const match = line.match(/(\d+)\s*%/);
  if (match) {
    state.lastPct = parseInt(match[1], 10);
    _renderProgressRow(kind, state.lastPct);
  }
}

async function _onDownloadDone(kind) {
  const state = _streams[kind];
  _streams[kind] = undefined;
  if (state && state.sawError) {
    _renderFailureRow(kind, _KINDS[kind].failureText);
    return;
  }
  await _KINDS[kind].onSuccess();
  // Any completed download can change prerequisites/config (e.g. a local model now
  // exists), so re-sync the boot-cached state and its dependent surfaces - the
  // analyze prereq banner and per-clip description chips - without a restart.
  if (window.refreshServerState) refreshServerState();
  _removeRow(kind);
  showToast(_KINDS[kind].successToast, 'success');
}

function _onDownloadError(kind, message) {
  _streams[kind] = undefined;
  const copy = _CONNECTION_ERROR_RE.test(message || '')
    ? _KINDS[kind].offlineText
    : _KINDS[kind].failureText;
  _renderFailureRow(kind, copy);
}

async function _cancelDownload(kind) {
  const state = _streams[kind];
  if (state && state.es) state.es.close();
  _streams[kind] = undefined;
  await _KINDS[kind].onCancel();
  _removeRow(kind);
  showToast(_KINDS[kind].cancelToast, 'info');
}

function _clearPending() {
  return fetch('/api/llm/download-status/clear', {method: 'POST'}).catch(() => {});
}

function _refreshCapabilities() {
  if (window._updateLlmCapabilities) _updateLlmCapabilities();
  if (window._renderCapabilityTiers) _renderCapabilityTiers();
}

// ── row rendering (each kind owns one [data-mdl-kind] row) ──────────────────────
function _row(kind) {
  const container = _container();
  if (!container) return null;
  let row = container.querySelector(`.mdl-row[data-mdl-kind="${kind}"]`);
  if (!row) {
    row = document.createElement('div');
    row.className = 'mdl-row';
    row.setAttribute('data-mdl-kind', kind);
    container.appendChild(row);
  }
  container.style.display = '';
  return row;
}

// pct null => indeterminate (no percentage parsed yet). Only static per-kind copy
// is interpolated, so nothing user-supplied needs escaping here.
function _renderProgressRow(kind, pct) {
  const row = _row(kind);
  if (!row) return;
  const known = typeof pct === 'number' && pct >= 0;
  const fillClass = known ? 'mdl-bar-fill' : 'mdl-bar-fill indeterminate';
  const fillStyle = known ? ` style="width:${pct}%"` : '';
  row.innerHTML =
    `<div class="mdl-body">` +
      `<span class="mdl-text">${_KINDS[kind].progressText}</span>` +
      `<div class="mdl-bar" role="progressbar"${known ? ` aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"` : ''}>` +
        `<div class="${fillClass}"${fillStyle}></div>` +
      `</div>` +
      (known ? `<span class="mdl-pct">${pct}%</span>` : '') +
    `</div>` +
    `<button type="button" class="btn ghost mdl-cancel" data-mdl-action="cancel">Cancel</button>`;
  _wireRowActions(row, kind);
}

function _renderFailureRow(kind, message) {
  const row = _row(kind);
  if (!row) return;
  row.innerHTML =
    `<div class="mdl-body"><span class="mdl-text mdl-text-warn">${escHtml(message)}</span></div>` +
    `<button type="button" class="btn ghost mdl-cancel" data-mdl-action="dismiss">Dismiss</button>`;
  _wireRowActions(row, kind);
}

function _wireRowActions(row, kind) {
  row.querySelectorAll('[data-mdl-action]').forEach(btn => {
    const action = btn.getAttribute('data-mdl-action');
    btn.onclick = () => { if (action === 'cancel') _cancelDownload(kind); else _removeRow(kind); };
  });
}

function _removeRow(kind) {
  const container = _container();
  if (!container) return;
  const row = container.querySelector(`.mdl-row[data-mdl-kind="${kind}"]`);
  if (row) row.remove();
  if (!container.querySelector('.mdl-row')) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}

// Read by analyze.js so the pre-analysis heads-up can show the current percentage.
function getWhisperDownloadPct() {
  const state = _streams.whisper;
  return state && typeof state.lastPct === 'number' ? state.lastPct : null;
}

// Test support: close any in-flight streams and clear the banner so a test can
// drive the boot flow deterministically against stubbed routes, independent of
// what the real boot (against the live dev server) already started.
function _resetModelDownloads() {
  for (const kind of Object.keys(_streams)) {
    const state = _streams[kind];
    if (state && state.es) state.es.close();
    _streams[kind] = undefined;
  }
  const container = _container();
  if (container) { container.innerHTML = ''; container.style.display = 'none'; }
}

Object.assign(window, {
  initModelDownload, initModelPrefetch, getWhisperDownloadPct, _cancelDownload,
  _resetModelDownloads,
});
})();
