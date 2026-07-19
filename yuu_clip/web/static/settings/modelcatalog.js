// Feature-map - the recommended-model catalog, model-readiness row, and the
// capabilities overview ("what scoring/vision power is installed and how do I
// get more"). Extracted out of settings.js (which grew into a catch-all) -
// these read backend/model config to decide what to render, but the save/dirty
// engine that persists config stays in settings.js.
//   API: routes/llm.py, routes/config.py (capabilities/tiers) · Tests: tests/ui/test_ui_model_catalog.py, tests/ui/test_ui_settings.py
import { escHtml } from '../core/format.js';
import { showToast } from '../core/utils.js';

// ── model catalog (recommended text + vision models) ────────────────────────
// Loaded once per session. Fills the recommended model lists; the capabilities
// line reflects the *saved* active model.
let _modelCatalog = null;
// models_dir / free disk / saved backend, so cards can show "~X GB, Y GB free"
// up front and the summary line can name the active backend.
let _modelCatalogInfo = { models_dir: '', free_gb: null, backend: 'llamacpp' };

export async function _ensureModelCatalog() {
  if (_modelCatalog) return;
  await _loadModelCatalog();
}

// Force a re-fetch + re-render. Called after Save (config changed which model is
// active) so the "Active" badge and the summary line reflect the saved state.
export async function refreshModelCatalog() {
  _modelCatalog = null;
  await _loadModelCatalog();
}

async function _loadModelCatalog() {
  try {
    const data = await fetch('/api/llm/catalog').then(r => r.json());
    _modelCatalog = data.models || [];
    _modelCatalogInfo = {
      models_dir: data.models_dir || '',
      free_gb: data.free_gb ?? null,
      backend: data.backend || 'llamacpp',
    };
  } catch {
    _modelCatalog = [];
    const failedEl = document.getElementById('s-llamacpp-recommended');
    if (failedEl) failedEl.innerHTML =
      '<div class="settings-note">Could not load the recommended model list - check your internet connection and reopen Settings. You can still set a model file by hand under Advanced AI options below.</div>';
    return;
  }
  _renderRecommendedModels('s-llamacpp-recommended', 'llamacpp');
  _updateCurrentModelSummary();
}

// "Currently using: <model> (<backend>)" - states the saved active model plainly
// so it isn't reverse-engineered from a path string. Hidden when nothing matches.
const _BACKEND_LABELS = { llamacpp: 'Local llama.cpp' };

function _updateCurrentModelSummary() {
  const el = document.getElementById('s-llm-current-summary');
  if (!el) return;
  const active = (_modelCatalog || []).find(m => m.active);
  if (!active) { el.style.display = 'none'; return; }
  const backend = _modelCatalogInfo.backend;
  const label = _BACKEND_LABELS[backend] || backend;
  const missingNote = active.installed
    ? ''
    : ` <span class="rec-model-note warn">- file missing, re-download below</span>`;
  el.innerHTML =
    `Currently using: <strong>${escHtml(active.display_name)}</strong> ` +
    `<span class="settings-note">(${escHtml(label)})</span>${missingNote}`;
  el.style.display = '';
}

// Text and vision models render as two labelled groups per backend, each with
// its own intro, rather than one flat list - so it's obvious which models score
// clips and which describe frames.
function _renderRecommendedModels(containerId, backend) {
  const el = document.getElementById(containerId);
  if (!el || !_modelCatalog) return;
  const models = _modelCatalog.filter(m => m.backends.includes(backend));
  if (!models.length) { el.innerHTML = ''; return; }
  const textModels = models.filter(m => !m.kinds.includes('vision'));
  const visionModels = models.filter(m => m.kinds.includes('vision'));
  el.innerHTML =
    _modelGroupHtml('Text scoring models',
      'Score clips and write descriptions. Pick one to get started.', textModels, backend, 'text') +
    _modelGroupHtml('Image analysis (vision) models',
      'Optional - let YuuClip look at frames and describe what is on screen.', visionModels, backend, 'vision');
  _wireModelCards(el);
  // A re-render (Save, or reopening Settings) rebuilds these cards, so an
  // in-flight download's progress bar/Cancel would vanish while the server keeps
  // downloading. Re-attach a progress view to whichever card now stands for the
  // downloading model so it survives the re-render.
  _reattachGgufProgress();
}

function _modelGroupHtml(title, intro, models, backend, kind) {
  if (!models.length) return '';
  return (
    `<div class="rec-model-group">` +
      `<div class="rec-model-group-title">${escHtml(title)}</div>` +
      `<div class="settings-note">${escHtml(intro)}</div>` +
      models.map(m => _recModelHtml(m, backend, kind)).join('') +
    `</div>`
  );
}

function _wireModelCards(el) {
  el.querySelectorAll('.rec-model').forEach(card => {
    const modelId = card.getAttribute('data-model-id');
    card.querySelector('[data-act="download-gguf"]')?.addEventListener('click', () => downloadGgufModel(modelId));
    card.querySelector('[data-act="use-gguf"]')?.addEventListener('click', () => _useGgufModel(modelId));
  });
}

function _modelMetaLine(m) {
  const free = _modelCatalogInfo.free_gb;
  return [
    m.size_gb ? `~${m.size_gb} GB` : null,
    (m.size_gb != null && free != null) ? `${free} GB free` : null,
    m.licence,
  ].filter(Boolean).join(' · ');
}

function _modelBadge(m) {
  // Active but the file is gone: config still points here, so surface it as a
  // recoverable "file missing" state rather than a plain "Active".
  if (m.active && !m.installed) return `<span class="rec-model-badge missing">File missing</span>`;
  if (m.active) return `<span class="rec-model-badge active">Active</span>`;
  if (m.installed) return `<span class="rec-model-badge">Downloaded</span>`;
  return '';
}

function _recModelHtml(m, backend, kind) {
  const actions = _llamacppActions(m);
  return (
    `<div class="rec-model${m.active ? ' active' : ''}" data-model-id="${escHtml(m.id)}" data-kind="${escHtml(kind || 'text')}">` +
      `<div class="rec-model-head"><span class="rec-model-name">${escHtml(m.display_name)}</span>` +
      _modelBadge(m) +
      `<span class="rec-model-meta">${escHtml(_modelMetaLine(m))}</span></div>` +
      `<div class="rec-model-why">${escHtml(m.why)}</div>` +
      `<div class="rec-model-actions">${actions}</div>` +
      `<div class="mdl-progress" data-gguf-progress style="display:none">` +
        `<div class="mdl-bar"><div class="mdl-bar-fill" data-gguf-fill></div></div>` +
        `<span class="mdl-pct" data-gguf-pct></span></div>` +
      `<div class="settings-install-log" data-gguf-log></div>` +
    `</div>`
  );
}

// One-click surface for local .gguf models: download when missing, "Use this
// model" when the file is already on disk, a plain "in use" note when active, and a
// re-download when active but the backing file has gone missing.
// The raw path boxes (Advanced disclosure) stay as the manual fallback.
function _llamacppActions(m) {
  if (!m.gguf_url) return '';
  if (!m.gguf_filename) {
    return `<a href="${escHtml(m.gguf_url)}" target="_blank" rel="noopener">Download page</a>`;
  }
  const parts = [];
  if (m.active && !m.installed) {
    // Config points here but the file is gone - offer a re-download so this
    // active-but-broken state is recoverable without hand-editing the path.
    parts.push(`<span class="rec-model-note warn">File missing - re-download to restore it.</span>`);
    parts.push(`<button type="button" class="btn-secondary" data-act="download-gguf">Re-download</button>`);
  } else if (m.active) {
    parts.push(`<span class="rec-model-note">In use for local scoring.</span>`);
  } else if (m.installed) {
    parts.push(`<button type="button" class="btn-secondary" data-act="use-gguf">Use this model</button>`);
  } else {
    parts.push(`<button type="button" class="btn-secondary" data-act="download-gguf">Download now</button>`);
  }
  parts.push(`<a href="${escHtml(m.gguf_url)}" target="_blank" rel="noopener">Choose a different file</a>`);
  return parts.join('');
}

// Point the (advanced) path fields at an already-present model so a plain Save
// activates it - no re-download. A vision entry fills the vision model + mmproj
// projector fields; a text entry fills the text model field. The two buckets
// are independent config keys, so one must never overwrite the other.
// The (advanced) path field id(s) a catalog entry maps to, and the paths to fill
// them with. A vision entry fills the vision model + mmproj projector fields; a
// text entry fills the text model field. The two buckets are independent config
// keys, so one must never overwrite the other.
function _modelPathFields(m) {
  const isVision = Array.isArray(m.kinds) && m.kinds.includes('vision');
  const fields = {};
  if (isVision) {
    if (m.gguf_path) fields['s-llm-vision-model-path'] = m.gguf_path;
    if (m.mmproj_path) fields['s-llm-mmproj-path'] = m.mmproj_path;
  } else if (m.gguf_path) {
    fields['s-llm-model-path'] = m.gguf_path;
  }
  return fields;
}

function _applyModelPaths(m) {
  const fields = _modelPathFields(m);
  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  window._checkSettingsDirty();
}

function _useGgufModel(modelId) {
  const m = (_modelCatalog || []).find(x => x.id === modelId);
  if (!m) return;
  _applyModelPaths(m);
  showToast('Model selected - click Save to apply', 'info');
}

// ── one-click local (.gguf) download ────────────────────────────────────────
// Server-owned download (POST /api/llm/gguf/download) for a recommended local
// model (text, or vision + its mmproj projector), so llama.cpp gets a one-click
// flow instead of only a "Download page" link. The download subprocess writes
// the model (and projector) path(s) into config.json itself, so on completion we
// only need to reload the running server's config - no Save.
//
// Progress is tracked in module state, NOT bound to the card DOM node: a Save (or
// any catalog re-render) rebuilds the cards, so we repaint the progress view onto
// whichever card currently stands for the downloading model (see
// _reattachGgufProgress). /api/llm/download-status is the reconnect signal for a
// download this page isn't streaming (started before a full re-render lost the
// handle, or in another window).
let _ggufDownload = null; // { modelId, abort, pct, poll } while a download runs

function _ggufCard(modelId) {
  const container = document.getElementById('s-llamacpp-recommended');
  return container ? container.querySelector(`.rec-model[data-model-id="${CSS.escape(modelId)}"]`) : null;
}

// The CLI prints "Downloading <name> - <file>: NN% (x/y GB)" lines; pull the
// percentage out to drive a determinate bar. Vision entries stream two files in
// turn, so the bar resets per file - expected, not a bug.
function _parseGgufPct(line) {
  const match = /(\d+)%/.exec(line);
  if (!match) return null;
  const pct = parseInt(match[1], 10);
  return pct >= 0 && pct <= 100 ? pct : null;
}

function _setGgufProgress(card, value) {
  const fill = card.querySelector('[data-gguf-fill]');
  const pct = card.querySelector('[data-gguf-pct]');
  if (!fill || !pct) return;
  if (value == null) {
    fill.classList.add('indeterminate');
    fill.style.width = '';
    pct.textContent = '';
  } else {
    fill.classList.remove('indeterminate');
    fill.style.width = value + '%';
    pct.textContent = value + '%';
  }
}

function _setGgufCancel(card, show, onCancel) {
  const log = card.querySelector('[data-gguf-log]');
  if (!log) return;
  let btn = card.querySelector('[data-gguf-cancel]');
  if (show) {
    if (!btn) {
      btn = document.createElement('button');
      btn.setAttribute('data-gguf-cancel', '');
      btn.type = 'button';
      btn.className = 'btn-secondary';
      btn.textContent = 'Cancel download';
      btn.style.marginTop = '4px';
      log.parentNode.insertBefore(btn, log);
    }
    btn.disabled = false;
    btn.onclick = onCancel;
    btn.style.display = '';
  } else if (btn) {
    btn.style.display = 'none';
  }
}

// Paint the current _ggufDownload state onto its card. Safe to call repeatedly and
// after a re-render (it re-derives the card each time), which is what lets progress
// survive a Save. Cancel shows only when we hold the stream (a reconnect poll has
// no abort handle, so it can't cancel a download owned by another window).
function _renderGgufProgress() {
  if (!_ggufDownload) return;
  const card = _ggufCard(_ggufDownload.modelId);
  if (!card) return;
  const progress = card.querySelector('[data-gguf-progress]');
  const log = card.querySelector('[data-gguf-log]');
  const button = card.querySelector('[data-act="download-gguf"]');
  if (progress) progress.style.display = '';
  _setGgufProgress(card, _ggufDownload.pct);
  if (button) { button.disabled = true; button.textContent = 'Downloading...'; }
  if (log && !log.textContent) {
    log.style.display = 'block';
    log.textContent = 'Downloading - this can take several minutes...\n';
  }
  _setGgufCancel(card, !!_ggufDownload.abort, () => _cancelGgufDownload());
}

function _appendGgufLog(msg) {
  if (!_ggufDownload) return;
  const card = _ggufCard(_ggufDownload.modelId);
  const log = card && card.querySelector('[data-gguf-log]');
  if (!log) return;
  log.style.display = 'block';
  log.textContent += msg + '\n';
  log.scrollTop = log.scrollHeight;
}

// Reset a card to its idle state after a cancel (the model was not installed, so
// it returns to a plain Download action).
function _restoreGgufCard(modelId) {
  const card = _ggufCard(modelId);
  if (!card) return;
  _setGgufCancel(card, false);
  const progress = card.querySelector('[data-gguf-progress]');
  if (progress) progress.style.display = 'none';
  const log = card.querySelector('[data-gguf-log]');
  if (log) { log.textContent = ''; log.style.display = 'none'; }
  const button = card.querySelector('[data-act="download-gguf"]');
  if (button) {
    const model = (_modelCatalog || []).find(x => x.id === modelId);
    button.disabled = false;
    button.textContent = (model && model.active && !model.installed) ? 'Re-download' : 'Download now';
  }
}

async function downloadGgufModel(modelId) {
  if (_ggufDownload) return; // one .gguf download at a time (the server 409s a second)
  const controller = new AbortController();
  _ggufDownload = { modelId, abort: controller, pct: null, poll: null };
  _renderGgufProgress();
  try {
    const resp = await fetch(`/api/llm/gguf/download?model_id=${encodeURIComponent(modelId)}`,
                             { method: 'POST', signal: controller.signal });
    if (!resp.ok) {
      let detail = '';
      try { detail = (await resp.json()).detail || ''; } catch { detail = await resp.text(); }
      _failGgufDownload(modelId, detail || 'Download could not start.');
      return;
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const msg = JSON.parse(line.slice(6));
        // The subprocess exiting non-zero (a failed download) arrives as the
        // object form of the done sentinel; the bare string is success only.
        if (msg && typeof msg === 'object' && msg.type === '__DONE__') {
          if (msg.ok === false) _failGgufDownload(modelId, 'Download failed - check your connection and try again.');
          else await _finishGgufDownload(modelId);
          return;
        }
        if (msg === '__DONE__') { await _finishGgufDownload(modelId); return; }
        const pct = _parseGgufPct(msg);
        if (pct != null && _ggufDownload && _ggufDownload.modelId === modelId) {
          _ggufDownload.pct = pct;
          _renderGgufProgress();
        }
        _appendGgufLog(msg);
      }
    }
  } catch (err) {
    // A user cancel aborts the fetch; _cancelGgufDownload already tore down the UI.
    if (!(err && err.name === 'AbortError')) {
      _failGgufDownload(modelId, 'Download failed - check your connection and try again.');
    }
  }
}

// The download subprocess already persisted the model path(s) to config.json, so
// completion just reloads the running server's config (no Save) and refreshes the
// catalog so the model shows Active at once. We also mirror the applied path into
// the advanced field(s) and re-baseline them, so a later Save can't clobber the
// freshly-downloaded path with a stale (empty) field.
async function _finishGgufDownload(modelId) {
  if (!_ggufDownload || _ggufDownload.modelId !== modelId) return;
  const model = (_modelCatalog || []).find(x => x.id === modelId);
  _appendGgufLog('Done - the model is ready.');
  _teardownGgufDownload();
  if (model && window.markModelPathsApplied) window.markModelPathsApplied(_modelPathFields(model));
  // Reuse the boot flow's config-reload endpoint: it calls ctx.reload_config() so
  // the just-written llm_model_path takes effect in the running server.
  await fetch('/api/llm/download-status/clear', { method: 'POST' }).catch(() => {});
  _updateLlmCapabilities();
  _renderCapabilityTiers();
  await refreshModelCatalog();
  if (window.refreshServerState) window.refreshServerState();
  showToast('Local model ready - now active for LLM scoring.', 'success');
}

function _failGgufDownload(modelId, message) {
  if (_ggufDownload && _ggufDownload.modelId !== modelId) return;
  _teardownGgufDownload();
  _restoreGgufCard(modelId);
  showToast(message, 'error');
}

function _cancelGgufDownload() {
  const dl = _ggufDownload;
  if (!dl) return;
  const { modelId, abort } = dl;
  if (abort) abort.abort(); // disconnect -> server terminates the download subprocess
  _teardownGgufDownload();
  _restoreGgufCard(modelId);
  showToast('Download cancelled.', 'info');
}

function _teardownGgufDownload() {
  if (_ggufDownload && _ggufDownload.poll) clearInterval(_ggufDownload.poll);
  _ggufDownload = null;
}

// Re-attach a progress view after a re-render. A live in-page download repaints
// straight from module state (its stream is still updating _ggufDownload). Failing
// that, consult /api/llm/download-status: if the server is still downloading a
// model this page isn't streaming, show an indeterminate reconnect view and poll
// until it finishes, then refresh so the model activates.
function _reattachGgufProgress() {
  if (_ggufDownload) { _renderGgufProgress(); return; }
  fetch('/api/llm/download-status')
    .then(r => r.json())
    .then(status => {
      if (_ggufDownload || !status || !status.downloading || !status.downloading_model_id) return;
      _reconnectGgufDownload(status.downloading_model_id);
    })
    .catch(() => {});
}

function _reconnectGgufDownload(modelId) {
  if (_ggufDownload) return;
  const poll = setInterval(() => _pollGgufDownload(modelId), 1000);
  _ggufDownload = { modelId, abort: null, pct: null, poll };
  _renderGgufProgress();
}

async function _pollGgufDownload(modelId) {
  if (!_ggufDownload || _ggufDownload.modelId !== modelId) return;
  let status;
  try { status = await fetch('/api/llm/download-status').then(r => r.json()); }
  catch { return; }
  if (status && status.downloading) return; // still running
  await _finishGgufDownload(modelId);
}

// ── model readiness ──────────────────────────────────────────────────────────
// Readiness of the *saved* active model. Reflects config on disk, not unsaved
// edits - refreshed on open and after Save.
export async function _updateLlmCapabilities() {
  const el = document.getElementById('s-llm-capabilities');
  if (!el) return;
  let cap;
  try {
    cap = await fetch('/api/llm/capabilities').then(r => r.json());
  } catch { el.textContent = 'Could not check model readiness.'; return; }
  const mark = ok => ok
    ? '<span aria-hidden="true">✓</span> Ready'
    : '<span aria-hidden="true">○</span> Not set up';
  el.innerHTML =
    `<span style="margin-right:14px">Text scoring: ${mark(cap.text)}</span>` +
    `<span>Image analysis: ${mark(cap.vision)}</span>` +
    `<div class="settings-note" style="margin-top:4px">${escHtml(cap.detail || '')}</div>`;
  el.style.color = cap.text ? 'var(--green)' : 'var(--muted)';
}

// ── capabilities overview (Stage 06) ────────────────────────────────────────
// A read-only, at-a-glance map of the non-LLM upgrade tiers. Sources each tier's
// active state + install guidance from the backend's availability() reasons via
// /api/capabilities/tiers - it never installs anything itself; each row links to
// the section where the real install/enable control lives.
export async function _renderCapabilityTiers() {
  const list = document.getElementById('s-capabilities-list');
  const intro = document.getElementById('s-capabilities-intro');
  if (!list) return;
  let data;
  try {
    data = await fetch('/api/capabilities/tiers').then(r => r.json());
  } catch {
    if (intro) intro.textContent = '';
    list.innerHTML = '<div class="settings-note">Could not check capabilities.</div>';
    return;
  }
  if (intro) {
    intro.textContent = data.lightweight
      ? "No local model is set up yet - transcription and the core scoring are working, and clips get a short template description. Setting up a local model is the normal next step: it adds written descriptions, session summaries, and a smarter read on scoring."
      : "Here's what each part of YuuClip is using right now, and what you can upgrade.";
  }
  list.innerHTML = (data.tiers || []).map(_capabilityTierHtml).join('');
  list.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => window._scrollToSettingsSection(btn.getAttribute('data-section')));
  });
  list.querySelectorAll('[data-prefetch]').forEach(btn => {
    btn.addEventListener('click', () => prefetchModel(btn.getAttribute('data-prefetch'), btn.getAttribute('data-tier-id')));
  });
}

// Four visual states, not two: a tier can be fully Ready (green check), waiting
// on a Tier-B model it can fetch right now (prefetch_slug set - "Download now"),
// waiting on a Tier-B model too small to bother with a progress UI (neutral, no
// CTA), or genuinely need a real setup step (install_slug set - e.g. Pyannote
// needs a pip install + HuggingFace token, shown as "Set up →").
function _capabilityTierHtml(tier) {
  const needsSetup = !tier.ready && !!tier.install_slug;
  const needsPrefetch = !tier.ready && !needsSetup && !!tier.prefetch_slug;
  const mark = tier.ready ? '✓' : (needsSetup || needsPrefetch ? '○' : '&#8943;');
  const markClass = tier.ready ? ' ready' : '';
  let action = '';
  if (needsSetup) {
    action = `<button type="button" class="settings-jump-link" data-section="${escHtml(tier.section)}" style="margin-top:2px">Set up &rarr;</button>`;
  } else if (needsPrefetch) {
    action =
      `<button type="button" class="btn-secondary" data-prefetch="${escHtml(tier.prefetch_slug)}" data-tier-id="${escHtml(tier.id)}" style="margin-top:4px">Download now</button>` +
      `<div id="cap-prefetch-log-${escHtml(tier.id)}" class="settings-install-log"></div>`;
  }
  return (
    `<div class="capability-tier">` +
      `<div class="capability-tier-head">` +
        `<span class="capability-mark${markClass}" aria-hidden="true">${mark}</span>` +
        `<span class="capability-tier-name">${escHtml(tier.name)}</span>` +
        `<span class="capability-tier-active">${escHtml(tier.active)}</span>` +
      `</div>` +
      `<div class="settings-note">${escHtml(tier.purpose)}</div>` +
      `<div class="settings-note">${escHtml(tier.upgrade)}</div>` +
      (tier.detail ? `<div class="settings-note">${escHtml(tier.detail)}</div>` : '') +
      action +
    `</div>`
  );
}

// ── Tier-B model prefetch ("Download now") ──────────────────────────────────
// One flow for every non-LLM Tier-B model (speaker/audio-event/embeddings) -
// the same SSE + Cancel + log pattern as the .gguf download above. The local
// .gguf LLM model keeps its own separate download flow.
const _PREFETCH_LABELS = {
  speaker: 'the speaker model (~80 MB)',
  audio_event: 'the audio-event model (~350 MB)',
  embeddings: 'the embeddings model (~130 MB)',
};

let _prefetchAbort = null;

function _setPrefetchCancel(tierId, show, onCancel) {
  const log = document.getElementById(`cap-prefetch-log-${tierId}`);
  if (!log) return;
  let btn = document.getElementById(`cap-prefetch-cancel-${tierId}`);
  if (show) {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = `cap-prefetch-cancel-${tierId}`;
      btn.type = 'button';
      btn.className = 'btn-secondary';
      btn.textContent = 'Cancel download';
      btn.style.marginTop = '4px';
      log.parentNode.insertBefore(btn, log);
    }
    btn.disabled = false;
    btn.onclick = onCancel;
    btn.style.display = '';
  } else if (btn) {
    btn.style.display = 'none';
  }
}

async function prefetchModel(slug, tierId) {
  const log = document.getElementById(`cap-prefetch-log-${tierId}`);
  const button = document.querySelector(`[data-prefetch="${CSS.escape(slug)}"]`);
  if (!log) return;
  log.style.display = 'block';
  log.textContent = `Downloading ${_PREFETCH_LABELS[slug] || slug}…\n`;
  if (button) { button.disabled = true; button.textContent = 'Downloading…'; }
  const controller = new AbortController();
  _prefetchAbort = controller;
  _setPrefetchCancel(tierId, true, () => { controller.abort(); });
  try {
    const resp = await fetch(`/api/models/prefetch?slug=${encodeURIComponent(slug)}`,
                             { method: 'POST', signal: controller.signal });
    if (!resp.ok) {
      let detail = '';
      try { detail = (await resp.json()).detail || ''; } catch { detail = await resp.text(); }
      log.textContent += `✗ ${detail || 'Download could not start.'}\n`;
      return;
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const msg = JSON.parse(line.slice(6));
        if (msg === '__DONE__') {
          log.textContent += '✓ Ready.\n';
          _renderCapabilityTiers();
          return;
        }
        log.textContent += msg + '\n';
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch (err) {
    if (err && err.name === 'AbortError') log.textContent += '■ Download cancelled.\n';
    else log.textContent += '✗ Download failed - check your connection and try again.\n';
  } finally {
    _prefetchAbort = null;
    _setPrefetchCancel(tierId, false);
    if (button) { button.disabled = false; button.textContent = 'Download now'; }
  }
}

// Gate a control on a model capability ("text" | "vision") from
// /api/llm/capabilities. Disables the element and appends a linked explanation
// when the capability is unavailable; used by image-analysis controls (plan 11).
// Returns the resolved capabilities object.
export async function gateOnCapability(el, capability, message) {
  let cap;
  try {
    cap = await fetch('/api/llm/capabilities').then(r => r.json());
  } catch { cap = { text: false, vision: false, detail: '' }; }
  const ok = !!cap[capability];
  el.disabled = !ok;
  let note = el.parentElement?.querySelector('.gate-note');
  if (!ok) {
    if (!note) {
      note = document.createElement('div');
      note.className = 'gate-note';
      el.parentElement?.appendChild(note);
    }
    note.innerHTML = `${escHtml(message)} <a href="#" onclick="openSettings();return false">Open Settings</a>`;
  } else if (note) {
    note.remove();
  }
  return cap;
}
