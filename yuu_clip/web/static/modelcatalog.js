(function () {
// Feature-map - the recommended-model catalog, model-readiness row, and the
// capabilities overview ("what scoring/vision power is installed and how do I
// get more"). Extracted out of settings.js (which grew into a catch-all) -
// these read backend/model config to decide what to render, but the save/dirty
// engine that persists config stays in settings.js.
//   API: routes/llm.py, routes/config.py (capabilities/tiers) · Tests: tests/test_ui_model_catalog.py, tests/test_ui_settings.py
// ── model catalog (recommended text + vision models) ────────────────────────
// Loaded once per session. Fills the Claude model dropdown and the per-backend
// recommended lists; the capabilities line reflects the *saved* active model.
let _modelCatalog = null;
// models_dir / free disk / saved backend, so cards can show "~X GB, Y GB free"
// up front and the summary line can name the active backend.
let _modelCatalogInfo = { models_dir: '', free_gb: null, backend: 'llamacpp' };

async function _ensureModelCatalog() {
  if (_modelCatalog) return;
  await _loadModelCatalog();
}

// Force a re-fetch + re-render. Called after Save (config changed which model is
// active) so the "Active" badge and the summary line reflect the saved state.
async function refreshModelCatalog() {
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
  } catch { _modelCatalog = []; return; }
  _populateClaudeModelSelect();
  _renderRecommendedModels('s-llamacpp-recommended', 'llamacpp');
  _renderRecommendedModels('s-ollama-recommended', 'ollama');
  _updateCurrentModelSummary();
}

// "Currently using: <model> (<backend>)" - states the saved active model plainly
// so it isn't reverse-engineered from a path string. Hidden when nothing matches.
const _BACKEND_LABELS = { llamacpp: 'Local llama.cpp', ollama: 'Ollama', claude: 'Claude API' };

function _updateCurrentModelSummary() {
  const el = document.getElementById('s-llm-current-summary');
  if (!el) return;
  const active = (_modelCatalog || []).find(m => m.active);
  if (!active) { el.style.display = 'none'; return; }
  const backend = _modelCatalogInfo.backend;
  const label = _BACKEND_LABELS[backend] || backend;
  el.innerHTML =
    `Currently using: <strong>${escHtml(active.display_name)}</strong> ` +
    `<span class="settings-note">(${escHtml(label)})</span>`;
  el.style.display = '';
}

function _populateClaudeModelSelect() {
  const sel = document.getElementById('s-claude-model');
  if (!sel || !_modelCatalog) return;
  const claude = _modelCatalog.filter(m => m.backends.includes('claude') && m.api_model_id);
  if (!claude.length) return;  // keep the HTML fallback options on empty catalog
  sel.innerHTML = claude.map(m =>
    `<option value="${escHtml(m.api_model_id)}">${escHtml(m.display_name)}</option>`
  ).join('');
}

// Show *value* even when it isn't a catalog option (a legacy or manually-typed
// model id) so opening Settings never silently rewrites the saved model.
function _setClaudeModelValue(value) {
  const sel = document.getElementById('s-claude-model');
  if (!sel) return;
  if (!Array.from(sel.options).some(o => o.value === value)) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value + ' (configured)';
    sel.insertBefore(opt, sel.firstChild);
  }
  sel.value = value;
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
      'Score clips and write descriptions. Pick one to get started.', textModels, backend) +
    _modelGroupHtml('Image analysis (vision) models',
      'Optional - let yuu-clip look at frames and describe what is on screen.', visionModels, backend);
  _wireModelCards(el);
}

function _modelGroupHtml(title, intro, models, backend) {
  if (!models.length) return '';
  return (
    `<div class="rec-model-group">` +
      `<div class="rec-model-group-title">${escHtml(title)}</div>` +
      `<div class="settings-note">${escHtml(intro)}</div>` +
      models.map(m => _recModelHtml(m, backend)).join('') +
    `</div>`
  );
}

function _wireModelCards(el) {
  el.querySelectorAll('.rec-model').forEach(card => {
    const tag = card.getAttribute('data-tag');
    const modelId = card.getAttribute('data-model-id');
    card.querySelector('[data-act="use"]')?.addEventListener('click', () => _useOllamaModel(tag));
    card.querySelector('[data-act="pull"]')?.addEventListener('click', () => pullOllamaModel(tag));
    card.querySelector('[data-act="download-gguf"]')?.addEventListener('click', () => downloadGgufModel(modelId, card));
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
  if (m.active) return `<span class="rec-model-badge active">Active</span>`;
  if (m.installed) return `<span class="rec-model-badge">Downloaded</span>`;
  return '';
}

function _recModelHtml(m, backend) {
  const actions = backend === 'ollama' ? _ollamaActions(m) : _llamacppActions(m);
  return (
    `<div class="rec-model${m.active ? ' active' : ''}" data-tag="${escHtml(m.ollama_tag || '')}" data-model-id="${escHtml(m.id)}">` +
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

// The "Active" badge signals the in-use model; the Use/Pull buttons stay present
// regardless (re-selecting the active tag is a harmless no-op) so the row's
// affordances don't shift based on which model happens to be configured.
function _ollamaActions(m) {
  if (!m.ollama_tag) return '';
  return `<button type="button" class="btn-secondary" data-act="use">Use this model</button>` +
    `<button type="button" class="btn-secondary" data-act="pull">Pull with Ollama</button>` +
    `<code class="rec-model-meta">${escHtml(m.ollama_tag)}</code>`;
}

// One-click surface for local .gguf models: download when missing, "Use this
// model" when the file is already on disk, and a plain "in use" note when active.
// The raw path boxes (Advanced disclosure) stay as the manual fallback.
function _llamacppActions(m) {
  if (!m.gguf_url) return '';
  if (!m.gguf_filename) {
    return `<a href="${escHtml(m.gguf_url)}" target="_blank" rel="noopener">Download page</a>`;
  }
  const parts = [];
  if (m.active) {
    parts.push(`<span class="rec-model-note">In use for local scoring.</span>`);
  } else if (m.installed) {
    parts.push(`<button type="button" class="btn-secondary" data-act="use-gguf">Use this model</button>`);
  } else {
    parts.push(`<button type="button" class="btn-secondary" data-act="download-gguf">Download now</button>`);
  }
  parts.push(`<a href="${escHtml(m.gguf_url)}" target="_blank" rel="noopener">Choose a different file</a>`);
  return parts.join('');
}

function _useOllamaModel(tag) {
  const el = document.getElementById('s-ollama-model');
  if (!el) return;
  el.value = tag;
  _checkSettingsDirty();
}

// Point the (advanced) path fields at an already-present model so a plain Save
// activates it - no re-download. For a vision entry this also fills the mmproj
// projector path; text entries leave any existing projector untouched.
function _applyModelPaths(m) {
  const pathEl = document.getElementById('s-llm-model-path');
  if (pathEl && m.gguf_path) pathEl.value = m.gguf_path;
  const projEl = document.getElementById('s-llm-mmproj-path');
  if (projEl && m.mmproj_path) projEl.value = m.mmproj_path;
  _checkSettingsDirty();
}

function _useGgufModel(modelId) {
  const m = (_modelCatalog || []).find(x => x.id === modelId);
  if (!m) return;
  _applyModelPaths(m);
  showToast('Model selected - click Save to apply', 'info');
}

// Abort controller for the active pull, so a Cancel button can close the SSE
// stream. Closing it disconnects the request, which makes the server terminate
// the `ollama pull` subprocess (subprocess_sse's finally block).
let _pullAbort = null;

function _setPullCancel(show, onCancel) {
  const log = document.getElementById('ollama-pull-log');
  if (!log) return;
  let btn = document.getElementById('ollama-pull-cancel');
  if (show) {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'ollama-pull-cancel';
      btn.type = 'button';
      btn.className = 'btn-secondary';
      btn.textContent = 'Cancel download';
      log.parentNode.insertBefore(btn, log);
    }
    btn.disabled = false;
    btn.onclick = onCancel;
    btn.style.display = '';
  } else if (btn) {
    btn.style.display = 'none';
  }
}

async function pullOllamaModel(tag) {
  const log = document.getElementById('ollama-pull-log');
  if (!log) return;
  log.style.display = 'block';
  log.textContent = `Pulling ${tag} - this can take several minutes…\n`;
  const controller = new AbortController();
  _pullAbort = controller;
  _setPullCancel(true, () => { controller.abort(); });
  try {
    const resp = await fetch(`/api/llm/ollama/pull?tag=${encodeURIComponent(tag)}`,
                             { method: 'POST', signal: controller.signal });
    if (!resp.ok) {
      let detail = '';
      try { detail = (await resp.json()).detail || ''; } catch { detail = await resp.text(); }
      log.textContent += `✗ ${detail || 'Pull could not start.'}\n`;
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
        if (msg === '__DONE__') { log.textContent += '✓ Done - set it as the model above and Save.\n'; return; }
        log.textContent += msg + '\n';
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch (err) {
    if (err && err.name === 'AbortError') log.textContent += '■ Download cancelled.\n';
    else log.textContent += '✗ Pull failed - is Ollama installed and running?\n';
  } finally {
    _pullAbort = null;
    _setPullCancel(false);
  }
}

// ── one-click local (.gguf) download ────────────────────────────────────────
// Server-owned download (POST /api/llm/gguf/download) for a recommended local
// model (text, or vision + its mmproj projector), so llama.cpp gets the same
// one-click flow the Ollama/Tier-B models already have instead of only a
// "Download page" link. Same SSE + Cancel-via-abort shape as pullOllamaModel;
// on success the server has written the model (and projector) path(s), so we
// point the path fields at them, refresh the readiness line, and prompt a Save.
let _ggufAbort = null;

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

async function downloadGgufModel(modelId, card) {
  const log = card.querySelector('[data-gguf-log]');
  const button = card.querySelector('[data-act="download-gguf"]');
  const progress = card.querySelector('[data-gguf-progress]');
  if (!log) return;
  const model = (_modelCatalog || []).find(x => x.id === modelId);
  log.style.display = 'block';
  log.textContent = 'Starting download - this can take several minutes...\n';
  if (progress) progress.style.display = '';
  _setGgufProgress(card, null);
  if (button) { button.disabled = true; button.textContent = 'Downloading...'; }
  const controller = new AbortController();
  _ggufAbort = controller;
  _setGgufCancel(card, true, () => { controller.abort(); });
  try {
    const resp = await fetch(`/api/llm/gguf/download?model_id=${encodeURIComponent(modelId)}`,
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
          _setGgufProgress(card, 100);
          log.textContent += '✓ Done - model selected. Save to apply.\n';
          if (model) _applyModelPaths(model);
          _updateLlmCapabilities();
          return;
        }
        const pct = _parseGgufPct(msg);
        if (pct != null) _setGgufProgress(card, pct);
        log.textContent += msg + '\n';
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch (err) {
    if (err && err.name === 'AbortError') log.textContent += '■ Download cancelled.\n';
    else log.textContent += '✗ Download failed - check your connection and try again.\n';
  } finally {
    _ggufAbort = null;
    _setGgufCancel(card, false);
    if (progress) progress.style.display = 'none';
    if (button) { button.disabled = false; button.textContent = 'Download now'; }
  }
}

// ── model readiness ──────────────────────────────────────────────────────────
// Readiness of the *saved* active model. Reflects config on disk, not unsaved
// edits - refreshed on open and after Save.
async function _updateLlmCapabilities() {
  const el = document.getElementById('s-llm-capabilities');
  if (!el) return;
  let cap;
  try {
    cap = await fetch('/api/llm/capabilities').then(r => r.json());
  } catch { el.textContent = 'Could not check model readiness.'; return; }
  const mark = ok => ok ? '✓' : '○';
  el.innerHTML =
    `<span style="margin-right:14px">${mark(cap.text)} Text scoring</span>` +
    `<span>${mark(cap.vision)} Image analysis</span>` +
    `<div class="settings-note" style="margin-top:4px">${escHtml(cap.detail || '')}</div>`;
  el.style.color = cap.text ? 'var(--green)' : 'var(--muted)';
}

// ── capabilities overview (Stage 06) ────────────────────────────────────────
// A read-only, at-a-glance map of the non-LLM upgrade tiers. Sources each tier's
// active state + install guidance from the backend's availability() reasons via
// /api/capabilities/tiers - it never installs anything itself; each row links to
// the section where the real install/enable control lives.
async function _renderCapabilityTiers() {
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
      ? "You're running in lightweight mode - transcription, scoring, and clip descriptions all work right now. Install a local model anytime for richer AI descriptions and smarter scoring."
      : "Here's what each part of yuu-clip is using right now, and what you can upgrade.";
  }
  list.innerHTML = (data.tiers || []).map(_capabilityTierHtml).join('');
  list.querySelectorAll('[data-section]').forEach(btn => {
    btn.addEventListener('click', () => _scrollToSettingsSection(btn.getAttribute('data-section')));
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
// mirrors pullOllamaModel's SSE + Cancel + log pattern above. The GGUF/Ollama
// model keeps its own separate "Pull with Ollama" / download-page flow.
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
async function gateOnCapability(el, capability, message) {
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

// Public API - symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  _ensureModelCatalog, refreshModelCatalog, _setClaudeModelValue,
  _updateLlmCapabilities, _renderCapabilityTiers,
  gateOnCapability, pullOllamaModel, prefetchModel, downloadGgufModel,
});
})();
