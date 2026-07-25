// Feature-map - Shared UI primitives (alert / confirm / prompt modals) used app-wide.
//   API: none (client-only) · Tests: covered indirectly by the test_ui_*.py suites
import { AppState } from './state.js';
import { escHtml } from './format.js';

// ── alert modal (single-button, no cancel) ────────────────────────────────────
let _alertOpener = null;
export function showAlert(title, body) {
  _alertOpener = document.activeElement;
  document.getElementById('alert-title').textContent = title;
  document.getElementById('alert-body').innerHTML = body;
  document.getElementById('alert-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#alert-modal .btn').focus(), 50);
}
export function closeAlertModal() {
  document.getElementById('alert-modal').classList.remove('visible');
  const opener = _alertOpener;
  _alertOpener = null;
  if (opener?.focus) opener.focus();
}

// ── confirm modal ─────────────────────────────────────────────────────────────
let _confirmOpener = null;
export function showConfirm(title, body, okLabel, onOk, danger = false, cancelLabel = 'Cancel') {
  _confirmOpener = document.activeElement;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').innerHTML = body;
  const ok = document.getElementById('confirm-ok-btn');
  ok.textContent = okLabel;
  ok.className = danger ? 'btn danger' : 'btn primary';
  // Every call sets it, so the default 'Cancel' is restored for callers that
  // don't pass a custom label - no stale label leaks between confirms.
  document.getElementById('confirm-cancel-btn').textContent = cancelLabel;
  AppState.confirmCallback = onOk;
  document.getElementById('confirm-modal').classList.add('visible');
  setTimeout(() => document.getElementById('confirm-cancel-btn').focus(), 50);
}
export function _confirmOk() {
  document.getElementById('confirm-modal').classList.remove('visible');
  const cb = AppState.confirmCallback;
  AppState.confirmCallback = null;
  const opener = _confirmOpener;
  _confirmOpener = null;
  // Restore focus to the opener BEFORE running the callback (matching showKebab):
  // the callback may open its own modal and move focus, so this only takes effect
  // when it doesn't - the OK path used to skip focus return entirely.
  if (opener?.focus) opener.focus();
  if (cb) cb();
}
export function _confirmCancel() {
  document.getElementById('confirm-modal').classList.remove('visible');
  AppState.confirmCallback = null;
  const opener = _confirmOpener;
  _confirmOpener = null;
  if (opener?.focus) opener.focus();
}

// ── additional actions modal ──────────────────────────────────────────────────
let _actionsModalOpener = null;
export function openActionsModal(title, groups) {
  _actionsModalOpener = document.activeElement;
  document.getElementById('actions-modal-title').textContent = title;
  const body = document.getElementById('actions-modal-body');
  body.innerHTML = '';
  groups.forEach((group, i) => {
    if (i > 0) {
      const divider = document.createElement('div');
      divider.className = 'hamburger-divider';
      body.appendChild(divider);
    }
    if (group.heading) {
      const heading = document.createElement('div');
      heading.className = 'section-title';
      heading.style.cssText = 'margin:8px 0 2px 4px';
      heading.textContent = group.heading;
      body.appendChild(heading);
    }
    for (const row of group.rows) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'action-row' + (row.danger ? ' danger' : '');
      el.disabled = !!row.disabled;
      const label = document.createElement('span');
      label.className = 'action-row-label';
      label.textContent = row.label;
      const desc = document.createElement('span');
      desc.className = 'action-row-desc';
      desc.textContent = row.description;
      el.append(label, desc);
      el.onclick = () => { closeActionsModal(); row.action(); };
      body.appendChild(el);
    }
  });
  document.getElementById('actions-modal').classList.add('visible');
  setTimeout(() => body.querySelector('.action-row:not(:disabled)')?.focus(), 50);
}
export function closeActionsModal() {
  document.getElementById('actions-modal').classList.remove('visible');
  const opener = _actionsModalOpener;
  _actionsModalOpener = null;
  if (opener?.focus) opener.focus();
}

// ── modal layering + focus trap ───────────────────────────────────────────────
// Confirm and alert are the only modals that stack on top of other modals, so
// they take priority; otherwise all .modal-bg share z-index 200 and the last
// visible one in DOM order is the one painted on top.
export function topmostVisibleModal() {
  for (const id of ['confirm-modal', 'alert-modal']) {
    const el = document.getElementById(id);
    if (el.classList.contains('visible')) return el;
  }
  const visible = document.querySelectorAll('.modal-bg.visible');
  return visible.length ? visible[visible.length - 1] : null;
}

const _FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), ' +
  'textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function _trapModalTabKeydown(e) {
  if (e.key !== 'Tab') return;
  const modal = topmostVisibleModal();
  if (!modal) return;
  const focusables = [...modal.querySelectorAll(_FOCUSABLE_SELECTOR)]
    .filter(el => el.getClientRects().length > 0);
  if (!focusables.length) return;
  const first = focusables[0];
  const last  = focusables[focusables.length - 1];
  if (!modal.contains(document.activeElement)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  }
}

// ── menu keyboard pattern (hamburger + kebab) ─────────────────────────────────
function _menuFocusableItems(menu) {
  return [...menu.querySelectorAll('.hamburger-item')]
    .filter(el => !el.disabled && el.getClientRects().length > 0);
}

export function _menuArrowKeydown(menu, e) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = _menuFocusableItems(menu);
  if (!items.length) return;
  e.preventDefault();
  const idx  = items.indexOf(document.activeElement);
  const step = e.key === 'ArrowDown' ? 1 : -1;
  items[(idx + step + items.length) % items.length].focus();
}

// ── hamburger menu ────────────────────────────────────────────────────────────
export function isHamburgerOpen() {
  return document.getElementById('hamburger-menu').classList.contains('open');
}
export function toggleHamburger() {
  const menu = document.getElementById('hamburger-menu');
  menu.classList.toggle('open');
  document.getElementById('btn-hamburger').setAttribute('aria-expanded', menu.classList.contains('open'));
  if (menu.classList.contains('open')) _menuFocusableItems(menu)[0]?.focus();
}
export function closeHamburger(refocusTrigger = false) {
  const menu = document.getElementById('hamburger-menu');
  // Focus sitting on an item about to be display:none'd would silently fall to
  // <body>; hand it to the trigger first so it has somewhere real to go.
  if (refocusTrigger || menu.contains(document.activeElement)) {
    document.getElementById('btn-hamburger').focus();
  }
  menu.classList.remove('open');
  document.getElementById('btn-hamburger').setAttribute('aria-expanded', 'false');
}
function _hamburgerMenuKeydown(e) {
  _menuArrowKeydown(document.getElementById('hamburger-menu'), e);
}
function _dismissHamburgerOnOutsideClick(e) {
  if (!document.getElementById('hamburger-wrap').contains(e.target)) {
    closeHamburger();
  }
}

// ── controls modal ────────────────────────────────────────────────────────────
let _controlsOpener = null;
export function openControlsModal() {
  _controlsOpener = document.activeElement;
  document.getElementById('controls-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#controls-modal .btn')?.focus(), 50);
}
export function closeControlsModal() {
  document.getElementById('controls-modal').classList.remove('visible');
  const opener = _controlsOpener;
  _controlsOpener = null;
  if (opener?.focus) opener.focus();
}

// ── diff modal ────────────────────────────────────────────────────────────────
// _diffState: {title, fields:[{label,current,proposed}], onCommit(action, editedValues)}
let _diffState = null;
let _diffOpener = null;

export function openDiffModal(title, fields, onCommit, opts = {}) {
  _diffOpener = document.activeElement;
  _diffState = {title, fields, onCommit};
  const revert = opts.revertMode || false;
  document.getElementById('diff-modal-title').textContent = title;
  const container = document.getElementById('diff-fields');
  container.innerHTML = fields.map((f, i) => `
    <div class="diff-field-group">
      ${fields.length > 1 ? `<div class="diff-field-title">${escHtml(f.label)}</div>` : ''}
      <div class="diff-panels">
        <div class="diff-panel">
          <div class="diff-panel-label">${revert ? 'Your Edit' : 'Current'}</div>
          <div class="diff-current${f.current ? '' : ' empty'}">${
            f.current ? escHtml(f.current) : '(none yet)'
          }</div>
        </div>
        <div class="diff-panel">
          <div class="diff-panel-label">${revert ? 'Original (LLM)' : 'New - edit here, then choose below'}</div>
          ${revert
            ? `<div class="diff-current${f.proposed ? '' : ' empty'}">${f.proposed ? escHtml(f.proposed) : '(none)'}</div>`
            : `<textarea class="diff-new" id="diff-new-${i}" rows="4">${escHtml(f.proposed || '')}</textarea>`
          }
        </div>
      </div>
    </div>`).join('');
  document.getElementById('diff-discard-btn').textContent   = revert ? 'Keep My Edit' : 'Discard';
  document.getElementById('diff-accept-edit-btn').style.display = revert ? 'none' : '';
  document.getElementById('diff-accept-new-btn').textContent = revert ? 'Revert to Original' : 'Accept as-is';
  document.getElementById('diff-modal').classList.add('visible');
  setTimeout(() => {
    const firstTa = document.getElementById('diff-new-0');
    if (firstTa) firstTa.focus();
    else document.getElementById('diff-discard-btn')?.focus();
  }, 50);
}

function _diffGetEdited() {
  return (_diffState?.fields || []).map((_, i) => {
    const ta = document.getElementById(`diff-new-${i}`);
    return ta ? ta.value : '';
  });
}

function _diffCloseDone() {
  const opener = _diffOpener;
  _diffOpener = null;
  if (opener?.focus) opener.focus();
}

function _diffAcceptNew() {
  const edited = _diffGetEdited();
  document.getElementById('diff-modal').classList.remove('visible');
  const cb = _diffState?.onCommit;
  _diffState = null;
  _diffOpener = null;
  if (cb) cb('accept_new', edited);
}

function _diffAcceptEdit() {
  const edited = _diffGetEdited();
  document.getElementById('diff-modal').classList.remove('visible');
  const cb = _diffState?.onCommit;
  _diffState = null;
  _diffOpener = null;
  if (cb) cb('accept_edit', edited);
}

function _diffDirty() {
  return (_diffState?.fields || []).some((f, i) => {
    const ta = document.getElementById(`diff-new-${i}`);
    return ta && ta.value !== (f.proposed || '');
  });
}

export function _diffDiscard() {
  if (!document.getElementById('diff-modal').classList.contains('visible')) return;
  if (_diffDirty()) {
    showConfirm(
      'Discard edit?',
      'You have unsaved changes. Close without saving?',
      'Discard',
      _doDiffDiscard,
      true,
    );
    return;
  }
  _doDiffDiscard();
}

function _doDiffDiscard() {
  document.getElementById('diff-modal').classList.remove('visible');
  _diffState = null;
  _diffCloseDone();
}

// ── field edit modal ──────────────────────────────────────────────────────────
let _fieldEditCallback = null;
let _fieldEditOriginalValue = '';
let _fieldEditOpener = null;

export function openFieldEditModal(title, currentValue, onSave) {
  _fieldEditOpener = document.activeElement;
  _fieldEditOriginalValue = currentValue;
  document.getElementById('field-edit-title').textContent = title;
  document.getElementById('field-edit-text').value = currentValue;
  _fieldEditCallback = onSave;
  document.getElementById('field-edit-modal').classList.add('visible');
  setTimeout(() => document.getElementById('field-edit-text').focus(), 50);
}

export function closeFieldEditModal() {
  if (!document.getElementById('field-edit-modal').classList.contains('visible')) return;
  const currentValue = document.getElementById('field-edit-text').value;
  if (currentValue !== _fieldEditOriginalValue) {
    showConfirm(
      'Discard edit?',
      'You have unsaved changes. Close without saving?',
      'Discard',
      _doCloseFieldEditModal,
      true,
    );
    return;
  }
  _doCloseFieldEditModal();
}

function _doCloseFieldEditModal() {
  document.getElementById('field-edit-modal').classList.remove('visible');
  _fieldEditCallback = null;
  const opener = _fieldEditOpener;
  _fieldEditOpener = null;
  if (opener?.focus) opener.focus();
}

function _fieldEditSave() {
  const val = document.getElementById('field-edit-text').value;
  const cb = _fieldEditCallback;
  _doCloseFieldEditModal();
  if (cb) cb(val);
}

// Refresh/close with a dirty editor open would silently lose the edit - the
// same protection closeFieldEditModal/_diffDiscard give Escape and Discard.
function _warnOnUnloadWithDirtyEditor(e) {
  const fieldEditDirty =
    document.getElementById('field-edit-modal').classList.contains('visible') &&
    document.getElementById('field-edit-text').value !== _fieldEditOriginalValue;
  const diffDirty =
    document.getElementById('diff-modal').classList.contains('visible') && _diffDirty();
  if (fieldEditDirty || diffDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
}

// ── kebab menus ───────────────────────────────────────────────────────────────
let _activeKebab = null;
let _activeKebabAnchor = null;
let _kebabDismiss = null;

export function closeKebab(refocusAnchor = false) {
  if (!_activeKebab) return false;
  _activeKebab.remove();
  _activeKebab = null;
  if (_kebabDismiss) { document.removeEventListener('click', _kebabDismiss); _kebabDismiss = null; }
  const anchor = _activeKebabAnchor;
  _activeKebabAnchor = null;
  if (anchor?.hasAttribute?.('aria-haspopup')) anchor.setAttribute('aria-expanded', 'false');
  if (refocusAnchor && anchor?.focus) anchor.focus();
  return true;
}

export function showKebab(anchorEl, items) {
  closeKebab();
  const menu = document.createElement('div');
  menu.className = 'hamburger-menu open';
  // right:auto clears the .hamburger-menu base rule's right:0 - otherwise the
  // fixed menu, with both left and right set, stretches to the viewport edge.
  menu.style.cssText = 'position:fixed;z-index:500;min-width:160px;right:auto';
  for (const item of items) {
    if (item === null) {
      const sep = document.createElement('div');
      sep.className = 'hamburger-divider';
      menu.appendChild(sep);
      continue;
    }
    const btn = document.createElement('button');
    btn.className = 'hamburger-item';
    btn.textContent = item.label;
    if (item.disabled) btn.disabled = true;
    // Refocus the anchor before the action runs so anything the action opens
    // records the anchor - not a removed menu item - as its return-focus target.
    btn.onclick = () => { closeKebab(true); item.action(); };
    menu.appendChild(btn);
  }
  menu.addEventListener('keydown', e => _menuArrowKeydown(menu, e));
  document.body.appendChild(menu);
  _activeKebab = menu;
  _activeKebabAnchor = anchorEl;
  if (anchorEl?.hasAttribute?.('aria-haspopup')) anchorEl.setAttribute('aria-expanded', 'true');

  const rect = anchorEl.getBoundingClientRect();
  let top  = rect.bottom + 4;
  let left = rect.right - menu.offsetWidth;
  if (left < 4) left = rect.left;
  const menuH = menu.offsetHeight;
  if (top + menuH > window.innerHeight) top = rect.top - menuH;
  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';

  _menuFocusableItems(menu)[0]?.focus();

  setTimeout(() => {
    if (_activeKebab !== menu) return;  // already closed (e.g. immediate Escape)
    const dismiss = e => {
      if (menu.contains(e.target)) return;
      closeKebab();
    };
    _kebabDismiss = dismiss;
    document.addEventListener('click', dismiss);
  }, 0);
}

// ── pane resize ───────────────────────────────────────────────────────────────
const _PANE_KEY = 'yuuclip-pane-sizes';

function _loadPaneSizes() {
  try { return JSON.parse(localStorage.getItem(_PANE_KEY) || '{}'); } catch { return {}; }
}

function _savePaneSize(key, val) {
  const s = _loadPaneSizes();
  s[key] = val;
  localStorage.setItem(_PANE_KEY, JSON.stringify(s));
}

function _makeDragHandle(id, onStart) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.classList.add('dragging');
    const onMove = onStart(e);
    const onUp = () => {
      el.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export function initResize() {
  const root    = document.documentElement;
  const sizes   = _loadPaneSizes();

  if (sizes.sidebarWidth)   root.style.setProperty('--sidebar-width',       sizes.sidebarWidth + 'px');
  if (sizes.videosHeight)   root.style.setProperty('--videos-group-height', sizes.videosHeight + 'px');
  if (sizes.playerMaxH)     root.style.setProperty('--player-max-height',   sizes.playerMaxH + 'px');
  if (sizes.logMaxH)        root.style.setProperty('--log-max-height',       sizes.logMaxH + 'px');

  _makeDragHandle('sidebar-resize-handle', startE => {
    const startX  = startE.clientX;
    const sidebar = document.querySelector('.sidebar');
    const startW  = sidebar.getBoundingClientRect().width;
    return moveE => {
      const w = Math.max(160, Math.min(480, startW + moveE.clientX - startX));
      root.style.setProperty('--sidebar-width', w + 'px');
      _savePaneSize('sidebarWidth', w);
    };
  });

  _makeDragHandle('videos-clips-resize-handle', startE => {
    const startY  = startE.clientY;
    const vg      = document.querySelector('.sidebar-group.videos-group');
    const sidebar = document.querySelector('.sidebar');
    const startH  = vg.getBoundingClientRect().height;
    return moveE => {
      const maxH = sidebar.getBoundingClientRect().height - 120;
      const h = Math.max(40, Math.min(maxH, startH + moveE.clientY - startY));
      root.style.setProperty('--videos-group-height', h + 'px');
      _savePaneSize('videosHeight', h);
    };
  });

  _makeDragHandle('player-resize-handle', startE => {
    const startY = startE.clientY;
    const pa     = document.getElementById('player-area');
    const main   = document.querySelector('.main');
    const startH = pa.getBoundingClientRect().height;
    return moveE => {
      const maxH = main.getBoundingClientRect().height - 100;
      const h = Math.max(80, Math.min(maxH, startH + moveE.clientY - startY));
      root.style.setProperty('--player-max-height', h + 'px');
      _savePaneSize('playerMaxH', h);
    };
  });

  _makeDragHandle('log-resize-handle', startE => {
    const startY = startE.clientY;
    const lb     = document.getElementById('log-body');
    const startH = lb.getBoundingClientRect().height || 0;
    return moveE => {
      const h = Math.max(40, Math.min(600, startH - (moveE.clientY - startY)));
      root.style.setProperty('--log-max-height', h + 'px');
      _savePaneSize('logMaxH', h);
    };
  });
}

// ── prereq warnings ───────────────────────────────────────────────────────────
export function _applyPrereqWarnings(prereqs) {
  const inElectron = !!window.electronAPI;
  const wizardLink = inElectron
    ? ' <a href="#" onclick="window.electronAPI.runSetupWizard();return false" style="color:var(--warning)">Re-run Setup Wizard</a>'
    : '';

  const banner = document.getElementById('prereq-banner');
  if (!banner) return;

  if (!prereqs.ffmpeg_ok) {
    banner.innerHTML = `<span>⚠ FFmpeg not found - analysis and export will fail.${wizardLink}</span>`;
    banner.style.display = '';
    const btn = document.getElementById('btn-start-analyze');
    if (btn) {
      btn.disabled = true;
      btn.title = 'FFmpeg not found - Re-run Setup Wizard to install it';
    }
    return;
  }
  if (!prereqs.llm_ok && inElectron) {
    banner.innerHTML = `<span>ℹ LLM scoring is not configured - clips will be scored by energy and scenes only.${wizardLink}</span>`;
    banner.style.display = '';
    return;
  }
  // Prerequisites satisfied - clear any banner shown by an earlier state. Without
  // this, a re-check after the model is set up (refreshServerState) could never
  // hide a stale warning.
  banner.style.display = 'none';
  banner.innerHTML = '';
}

// ── undo toast (auto-dismiss, single Undo button) ─────────────────────────────
// A transient toast carrying an Undo action, used by reversible clip operations
// (single/bulk status changes). The shrinking bar makes the ~5s window visible
// so the undo affordance does not expire silently. Generic UI, so it lives here
// rather than in a feature module.
const UNDO_TOAST_MS = 5000;

export function showUndoToast(message, undoFn) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast info undo-toast';
  const row = document.createElement('div');
  row.className = 'undo-toast-row';
  const btn = document.createElement('button');
  btn.className = 'undo-toast-btn';
  btn.textContent = 'Undo';
  btn.onclick = () => { toast.remove(); undoFn(); };
  row.appendChild(document.createTextNode(message));
  row.appendChild(btn);
  const bar = document.createElement('div');
  bar.className = 'undo-toast-bar';
  bar.style.animationDuration = UNDO_TOAST_MS + 'ms';
  toast.appendChild(row);
  toast.appendChild(bar);
  container.appendChild(toast);
  setTimeout(() => toast.remove(), UNDO_TOAST_MS);
}

// Global playback-speed preference - one capture-phase listener applies the saved
// rate to every <video> as it loads, so all players (clip preview, recording,
// split/export editors, reels) honor it without per-player wiring. Client-only,
// stored in localStorage like the other playback prefs.
export function playbackRatePref() {
  const rate = parseFloat(localStorage.getItem('yuuclip-playback-rate'));
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

export function applyPlaybackRate(rate) {
  document.querySelectorAll('video').forEach(video => { video.playbackRate = rate; });
}

export function initPlaybackRate() {
  document.addEventListener('loadedmetadata', e => {
    if (e.target && e.target.tagName === 'VIDEO') e.target.playbackRate = playbackRatePref();
  }, true);
}

// ── static modal/hamburger wiring (replaces the inline onclick= this module used
// to own in index.html) ────────────────────────────────────────────────────────
// These are fixed, never-recreated elements in index.html, so wiring them once at
// module load (below) can't double-fire on a re-render the way a dynamically
// rendered list could.
const _BG_DISMISS_MODALS = [
  ['alert-modal', closeAlertModal],
  ['confirm-modal', _confirmCancel],
  ['actions-modal', closeActionsModal],
  ['controls-modal', closeControlsModal],
  ['diff-modal', _diffDiscard],
  ['field-edit-modal', closeFieldEditModal],
];

function _wireModalBgDismissals() {
  for (const [modalId, closeFn] of _BG_DISMISS_MODALS) {
    const modal = document.getElementById(modalId);
    modal.addEventListener('click', e => { if (e.target === modal) closeFn(); });
  }
}

function _wireModalButtons() {
  document.getElementById('alert-ok-btn').addEventListener('click', () => closeAlertModal());
  document.getElementById('confirm-cancel-btn').addEventListener('click', () => _confirmCancel());
  document.getElementById('confirm-ok-btn').addEventListener('click', () => _confirmOk());
  document.getElementById('actions-modal-close-btn').addEventListener('click', () => closeActionsModal());
  document.getElementById('controls-modal-close-btn').addEventListener('click', () => closeControlsModal());
  document.getElementById('diff-discard-btn').addEventListener('click', () => _diffDiscard());
  document.getElementById('diff-accept-edit-btn').addEventListener('click', () => _diffAcceptEdit());
  document.getElementById('diff-accept-new-btn').addEventListener('click', () => _diffAcceptNew());
  document.getElementById('field-edit-cancel-btn').addEventListener('click', () => closeFieldEditModal());
  document.getElementById('field-edit-save-btn').addEventListener('click', () => _fieldEditSave());
  // The global Escape handler leaves genuine text-entry alone (a textarea's own
  // Escape belongs to it), so these editors close via their own dirty-guarded
  // closers - matching _modalEscapeClosers for when focus is elsewhere in the modal.
  document.getElementById('field-edit-text').addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeFieldEditModal(); }
  });
  document.getElementById('diff-modal').addEventListener('keydown', e => {
    if (e.key === 'Escape' && e.target.tagName === 'TEXTAREA') { e.preventDefault(); _diffDiscard(); }
  });
}

// "Controls" and "Download Log" are wired here because their onclick= called
// only ui.js functions. The Getting Started / Glossary / Help / About items call
// closeHamburger() (ui.js) plus a helpmodals.js modal-open, so helpmodals.js owns
// their delegation. "Re-run Setup Wizard" and "Refresh" close the menu then hand
// off to electronAPI / location - neither a ui.js concern - so they're wired here too.
function _wireHamburgerHandlers() {
  document.getElementById('btn-hamburger').addEventListener('click', () => toggleHamburger());
  document.getElementById('hamburger-item-controls').addEventListener('click', () => {
    closeHamburger();
    openControlsModal();
  });
  document.getElementById('hamburger-item-download-log').addEventListener('click', () => closeHamburger());
  document.getElementById('btn-setup-wizard').addEventListener('click', () => {
    closeHamburger();
    window.electronAPI.runSetupWizard();
  });
  document.getElementById('btn-refresh').addEventListener('click', () => {
    closeHamburger();
    location.reload();
  });
}

// Wires every fixed, never-recreated ui.js listener once - the Tab focus trap,
// the hamburger menu's arrow-key nav and outside-click dismiss, the dirty-editor
// beforeunload guard, and the static modal/hamburger click wiring above. Called
// from boot.js at first paint (see initHotwordListeners in hotwords.js for the
// reference pattern) so importing this module has no DOM side effect.
export function initUiListeners() {
  document.addEventListener('keydown', _trapModalTabKeydown);
  document.getElementById('hamburger-menu').addEventListener('keydown', _hamburgerMenuKeydown);
  document.addEventListener('click', _dismissHamburgerOnOutsideClick);
  window.addEventListener('beforeunload', _warnOnUnloadWithDirtyEditor);
  _wireModalBgDismissals();
  _wireModalButtons();
  _wireHamburgerHandlers();
}
