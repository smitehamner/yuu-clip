// Feature-map — Cross-cutting UI feedback helpers with no home in a single feature: toasts, the
//   bottom log panel, sort-direction buttons, speaker-labels (diarization) readiness, "reveal in
//   folder", and clipboard copy. State/format/job-SSE/preview machinery split out in stage 02.
//   API: routes/config.py, routes/logs.py (indirectly) · Tests: tests/test_ui_utils.py
// ── sort-direction toggle ─────────────────────────────────────────────────────
// Reflects a sort-direction toggle's current state onto its button: arrow glyph,
// aria-pressed, and a self-describing aria-label. 'desc' is the sort option's
// natural order (highest/newest first); 'asc' reverses it.
(function () {
function _syncSortDirBtn(btnId, dir) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const asc = dir === 'asc';
  btn.innerHTML = asc ? '&#8593;' : '&#8595;';
  btn.setAttribute('aria-pressed', asc ? 'true' : 'false');
  btn.setAttribute('aria-label', asc
    ? 'Sorted ascending — click to sort descending'
    : 'Sorted descending — click to sort ascending');
  btn.title = asc ? 'Ascending order' : 'Descending order';
}

// ── speaker labels (diarization) readiness ────────────────────────────────────
// SpeechBrain (the default backend) is bundled — its package should always be
// present, so an unready result there means a broken install, not a missing
// optional download. Pyannote is the advanced, token-gated alternative and still
// needs a real install + a HuggingFace token. The per-run checkboxes in the
// analyze and export panels both gate on this single check. Centralized here so
// the three surfaces (Settings, analyze, export) can't drift to different rules.
function _diarizationReason(backend, installed, hasToken) {
  if (backend === 'speechbrain') return installed ? '' : 'SpeechBrain is unavailable — try reinstalling yuu-clip';
  if (!installed) return 'Install pyannote.audio';
  if (!hasToken)  return 'Requires a HuggingFace token';
  return '';
}

async function _diarizationReadiness() {
  const cfg = await fetch('/api/config').then(r => r.json()).catch(() => ({}));
  const backend = cfg.diarization_backend || 'speechbrain';
  const slug = backend === 'speechbrain' ? 'speechbrain' : 'pyannote';
  const install = await fetch(`/api/install/${slug}`).then(r => r.json()).catch(() => ({installed: false}));
  const installed = !!install.installed;
  const hasToken  = !!(cfg.huggingface_token && cfg.huggingface_token.trim());
  return {
    installed,
    hasToken,
    backend,
    ready:   backend === 'speechbrain' ? installed : (installed && hasToken),
    reason:  _diarizationReason(backend, installed, hasToken),
  };
}

// Note shown on a disabled speaker-labels control: the blocking reason plus a
// button that jumps to Settings. settingsOnclick closes the host surface first
// (the analyze panel or export modal) so Settings isn't opened behind it.
function _diarizationNoteHtml(reason, settingsOnclick) {
  return escHtml(reason) + ' — set up in ' +
    '<button class="btn ghost" style="font-size:11px;padding:0 4px;color:var(--accent);' +
    `display:inline-flex" onclick="${escHtml(settingsOnclick)}">Settings</button>`;
}

// ── log panel ─────────────────────────────────────────────────────────────────
function openLog() {
  const panel = document.getElementById('log-panel');
  panel.classList.add('visible');
  panel.classList.remove('minimized');
  document.getElementById('log-toggle').textContent = '▲';
}

function toggleLog() {
  const panel = document.getElementById('log-panel');
  const minimized = panel.classList.toggle('minimized');
  document.getElementById('log-toggle').textContent = minimized ? '▼' : '▲';
  document.getElementById('btn-log-toggle').setAttribute('aria-expanded', minimized ? 'false' : 'true');
}

function clearLog() {
  document.getElementById('log-lines').innerHTML = '';
}

function appendLog(raw) {
  const text = stripRichMarkup(raw);
  if (!text.trim()) return;
  const div = document.createElement('div');
  const isOk   = raw.includes(' OK') || raw.includes('[green]') || raw.includes('Done');
  const isErr   = raw.includes('FAIL') || raw.includes('Error') || raw.includes('[red]') || raw.includes('error');
  const isWarn  = raw.includes('[yellow]') || raw.includes('WARNING') || raw.includes('overlap');
  div.className = 'log-line' + (isOk ? ' ok' : isErr ? ' err' : isWarn ? ' warn' : '');
  div.style.display = 'flex';
  div.style.gap = '6px';
  const ts = document.createElement('span');
  ts.style.cssText = 'color:var(--muted);font-size:10px;flex-shrink:0;opacity:.7';
  ts.textContent = new Date().toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  div.appendChild(ts);
  div.appendChild(document.createTextNode(text));
  document.getElementById('log-lines').appendChild(div);
  const body = document.getElementById('log-body');
  body.scrollTop = body.scrollHeight;
}

// ── toast notifications ───────────────────────────────────────────────────────
// Types: success | info | warning (guard/guidance) | error (actual failures).
// Error toasts persist until dismissed — durationMs is ignored for them.
// opts: { durationMs, action: {label, onClick} }
const TOAST_STACK_MAX = 4;

function showToast(message, type = 'success', opts = {}) {
  const container = document.getElementById('toast-container');
  const liveRegion = document.getElementById(type === 'error' ? 'sr-live-assertive' : 'sr-live-polite');
  if (liveRegion) { liveRegion.textContent = ''; setTimeout(() => { liveRegion.textContent = message; }, 10); }
  while (container.children.length >= TOAST_STACK_MAX) container.firstElementChild.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px';
  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(msg);
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:6px;align-items:center;flex-shrink:0';
  if (opts.action) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn ghost';
    actionBtn.style.cssText = 'font-size:11px;padding:2px 8px';
    actionBtn.textContent = opts.action.label;
    actionBtn.onclick = () => { toast.remove(); opts.action.onClick(); };
    buttons.appendChild(actionBtn);
  }
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.style.cssText = `background:none;border:none;color:inherit;cursor:pointer;font-size:18px;line-height:1;padding:0;flex-shrink:0;opacity:${type === 'error' ? '.8' : '.5'}`;
  close.onclick = () => toast.remove();
  buttons.appendChild(close);
  toast.appendChild(buttons);
  container.appendChild(toast);
  if (type === 'error') return;
  const ms = opts.durationMs ?? (type === 'warning' ? 6000 : 4000);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, ms);
}

// ── reveal in file explorer ──────────────────────────────────────────────────
async function revealInFolder(path) {
  try {
    const res = await fetch('/api/reveal', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({path}),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      showToast(`Could not show in folder: ${e.detail || 'failed'}`, 'error');
    }
  } catch (err) {
    showToast(`Could not show in folder: ${err.message}`, 'error');
  }
}

// ── clipboard ─────────────────────────────────────────────────────────────────
// The app only ever runs on localhost or inside Electron, so navigator.clipboard
// is always available — a failure toast is enough, no execCommand fallback.
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied`, 'success');
  } catch (err) {
    showToast(`Could not copy ${label.toLowerCase()}: ${err.message}`, 'error');
  }
}

Object.assign(window, {
  _syncSortDirBtn, _diarizationReason, _diarizationReadiness, _diarizationNoteHtml,
  openLog, toggleLog, clearLog, appendLog, showToast, revealInFolder, copyText,
});
})();
