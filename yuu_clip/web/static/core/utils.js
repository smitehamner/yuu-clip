// Feature-map - Cross-cutting UI feedback helpers with no home in a single feature: toasts, the
//   bottom log panel, sort-direction buttons, speaker-labels (diarization) readiness, "reveal in
//   folder", and clipboard copy. State/format/job-SSE/preview machinery split out in stage 02.
//   API: routes/config.py, routes/logs.py (indirectly) · Tests: tests/ui/test_ui_utils.py
import { escHtml, stripRichMarkup } from './format.js';

// ── sort-direction toggle ─────────────────────────────────────────────────────
// Reflects a sort-direction toggle's current state onto its button: arrow glyph,
// aria-pressed, and a self-describing aria-label. 'desc' is the sort option's
// natural order (highest/newest first); 'asc' reverses it.
export function _syncSortDirBtn(btnId, dir) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const asc = dir === 'asc';
  btn.innerHTML = asc ? '&#8593;' : '&#8595;';
  btn.setAttribute('aria-pressed', asc ? 'true' : 'false');
  btn.setAttribute('aria-label', asc
    ? 'Sorted ascending - click to sort descending'
    : 'Sorted descending - click to sort ascending');
  btn.title = asc ? 'Ascending order' : 'Descending order';
}

// ── speaker labels (diarization) readiness ────────────────────────────────────
// SpeechBrain (the default backend) is bundled - its package should always be
// present, so an unready result there means a broken install, not a missing
// optional download. Pyannote is the advanced, token-gated alternative and still
// needs a real install + a HuggingFace token. The per-run checkboxes in the
// analyze and export panels both gate on this single check. Centralized here so
// the three surfaces (Settings, analyze, export) can't drift to different rules.
export function _diarizationReason(installed) {
  return installed ? '' : 'SpeechBrain is unavailable - try reinstalling YuuClip';
}

export async function _diarizationReadiness() {
  const cfg = await fetch('/api/config').then(r => r.json()).catch(() => ({}));
  const backend = cfg.diarization_backend || 'speechbrain';
  const install = await fetch('/api/install/speechbrain').then(r => r.json()).catch(() => ({installed: false}));
  const installed = !!install.installed;
  return {
    installed,
    backend,
    ready:   installed,
    reason:  _diarizationReason(installed),
  };
}

// Note shown on a disabled speaker-labels control: the blocking reason plus a
// button that jumps to Settings. settingsOnclick closes the host surface first
// (the analyze panel or export modal) so Settings isn't opened behind it.
export function _diarizationNoteHtml(reason, settingsOnclick) {
  return escHtml(reason) + ' - set up in ' +
    '<button class="btn ghost" style="font-size:11px;padding:0 4px;color:var(--accent);' +
    `display:inline-flex" onclick="${escHtml(settingsOnclick)}">Settings</button>`;
}

// ── log panel ─────────────────────────────────────────────────────────────────
export function openLog() {
  const panel = document.getElementById('log-panel');
  panel.classList.add('visible');
  panel.classList.remove('minimized');
  document.getElementById('log-toggle').textContent = '▲';
}

export function toggleLog() {
  const panel = document.getElementById('log-panel');
  const minimized = panel.classList.toggle('minimized');
  document.getElementById('log-toggle').textContent = minimized ? '▼' : '▲';
  document.getElementById('btn-log-toggle').setAttribute('aria-expanded', minimized ? 'false' : 'true');
}

export function clearLog() {
  document.getElementById('log-lines').innerHTML = '';
}

// The log header's toggle/clear buttons are static markup in index.html (never
// re-rendered), so this one-time wiring at module load can't double-fire.
document.getElementById('btn-log-toggle').addEventListener('click', toggleLog);
document.getElementById('btn-clear-log').addEventListener('click', clearLog);

// Cap the log DOM. An unbounded log froze the browser on long runs and, worse,
// when a reattached analyze stream replayed a large buffer all at once (each line
// triggers a scroll-to-bottom reflow) - the tab locked up, the elapsed timer
// appeared frozen, and Cancel wouldn't respond. Keeping only the most recent lines
// bounds the reflow cost; the full log always remains in .yuu-clip/yuu-clip.log.
const _MAX_LOG_LINES = 500;

export function appendLog(raw) {
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
  const lines = document.getElementById('log-lines');
  lines.appendChild(div);
  while (lines.childElementCount > _MAX_LOG_LINES) lines.removeChild(lines.firstElementChild);
  const body = document.getElementById('log-body');
  body.scrollTop = body.scrollHeight;
}

// ── toast notifications ───────────────────────────────────────────────────────
// Types: success | info | warning (guard/guidance) | error (actual failures).
// Error toasts persist until dismissed - durationMs is ignored for them.
// opts: { durationMs, action: {label, onClick} }
const TOAST_STACK_MAX = 4;

export function showToast(message, type = 'success', opts = {}) {
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

// ── network error copy ────────────────────────────────────────────────────────
// A fetch() rejection means the request never got a response - on this localhost/
// Electron app that almost always means the backend stopped, not a real network.
// The browser reports it as a TypeError whose message is the opaque "Failed to
// fetch", useless to a non-developer. An Error thrown after a non-ok response
// already carries a real, specific message, so pass those through unchanged. Use
// this only at catch sites that wrap a bare fetch (not ones doing DOM work that
// could throw its own TypeError).
export function netErrMsg(err) {
  if (err instanceof TypeError) return "Couldn't reach YuuClip - it may have stopped. Try again, or restart the app.";
  return (err && err.message) || 'Unknown error';
}

// ── reveal in file explorer ──────────────────────────────────────────────────
export async function revealInFolder(path) {
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
// is always available - a failure toast is enough, no execCommand fallback.
export async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied`, 'success');
  } catch (err) {
    showToast(`Could not copy ${label.toLowerCase()}: ${err.message}`, 'error');
  }
}

// ── collapsible detail cards ───────────────────────────────────────────────
// Opt-in: build a card with collapsibleCard(key, title, body, {actions}). The
// title is rendered inside a real <button class="card-toggle">, so the toggle
// has native keyboard/focus behaviour and - because shortcuts.js's global
// keydown bails on tagName === 'BUTTON' - Space on a focused toggle never also
// fires play/pause. Header action controls are passed via opts.actions and sit
// as SIBLINGS of the toggle button, never descendants, so a button never nests
// inside the toggle (WCAG 4.1.2 nested-interactive). Seeded from isCardCollapsed(key).
const _CARD_COLLAPSE_KEY = 'yuuclip-card-collapsed';

function _cardCollapseState() {
  try { return JSON.parse(localStorage.getItem(_CARD_COLLAPSE_KEY) || '{}') || {}; }
  catch { return {}; }
}

// Persisted collapse state per card key. defaultCollapsed lets a card (e.g. the
// heavy full-video transcript) start collapsed until the user opens it.
function isCardCollapsed(key, defaultCollapsed = false) {
  const state = _cardCollapseState();
  return key in state ? !!state[key] : defaultCollapsed;
}

// Single source of the collapsible-card markup contract: the ~11 detail cards
// that opt in all render through here so none can drift from the class /
// data-collapse-key / toggle-a11y attributes the toggle logic below reads.
// title = the header's title content (goes inside the toggle button); body =
// everything shown below the header. opts.actions = header controls rendered
// beside the toggle; opts.defaultCollapsed starts a card collapsed until first
// opened; opts.attrs adds card attributes (id, data-*); opts.headerStyle sets
// an inline style on the header row.
export function collapsibleCard(key, title, body, opts = {}) {
  const { defaultCollapsed = false, attrs = '', headerStyle = '', actions = '' } = opts;
  const collapsed = isCardCollapsed(key, defaultCollapsed);
  const styleAttr = headerStyle ? ` style="${headerStyle}"` : '';
  const extraAttrs = attrs ? ` ${attrs}` : '';
  return `
    <div class="detail-card collapsible${collapsed ? ' collapsed' : ''}" data-collapse-key="${key}"${extraAttrs}>
      <div class="detail-card-header"${styleAttr}>
        <button type="button" class="card-toggle" aria-expanded="${collapsed ? 'false' : 'true'}">${title}</button>
        ${actions}
      </div>
      ${body}
    </div>`;
}

function _toggleCollapsibleCard(card, toggle) {
  const collapsed = card.classList.toggle('collapsed');
  toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  const key = card.dataset.collapseKey;
  if (!key) return;
  // Persist best-effort: a write failure (private mode, quota) must not swallow
  // the toggle or block the lazy-load dispatch below. The read path
  // (_cardCollapseState) is likewise tolerant.
  try {
    const state = _cardCollapseState();
    state[key] = collapsed;
    localStorage.setItem(_CARD_COLLAPSE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not persist card collapse state:', err);
  }
  // Lets a card lazy-load its body the first time it is expanded.
  card.dispatchEvent(new CustomEvent('cardtoggle', { bubbles: true, detail: { key, collapsed } }));
}

// Only the card's own toggle button collapses it (native Enter/Space activate it
// too). Nested headers inside a compound card's body carry no .card-toggle, so
// they neither toggle nor show a chevron.
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.card-toggle');
  if (!toggle) return;
  const card = toggle.closest('.detail-card.collapsible');
  if (card) _toggleCollapsibleCard(card, toggle);
});
