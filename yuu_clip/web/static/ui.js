// ── confirm modal ─────────────────────────────────────────────────────────────
function showConfirm(title, body, okLabel, onOk, danger = false) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').innerHTML = body;
  const ok = document.getElementById('confirm-ok-btn');
  ok.textContent = okLabel;
  ok.className = danger ? 'btn reject' : 'btn primary';
  _confirmCallback = onOk;
  document.getElementById('confirm-modal').classList.add('visible');
}
function _confirmOk() {
  document.getElementById('confirm-modal').classList.remove('visible');
  const cb = _confirmCallback;
  _confirmCallback = null;
  if (cb) cb();
}
function _confirmCancel() {
  document.getElementById('confirm-modal').classList.remove('visible');
  _confirmCallback = null;
}

// ── hamburger menu ────────────────────────────────────────────────────────────
function toggleHamburger() {
  const menu = document.getElementById('hamburger-menu');
  menu.classList.toggle('open');
  document.getElementById('btn-hamburger').setAttribute('aria-expanded', menu.classList.contains('open'));
}
function closeHamburger() {
  document.getElementById('hamburger-menu').classList.remove('open');
  document.getElementById('btn-hamburger').setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e => {
  if (!document.getElementById('hamburger-wrap').contains(e.target)) {
    closeHamburger();
  }
});

// ── controls modal ────────────────────────────────────────────────────────────
function openControlsModal()  { document.getElementById('controls-modal').classList.add('visible'); }
function closeControlsModal() { document.getElementById('controls-modal').classList.remove('visible'); }

// ── diff modal ────────────────────────────────────────────────────────────────
// _diffState: {title, fields:[{label,current,proposed}], onCommit(action, editedValues)}
let _diffState = null;

function openDiffModal(title, fields, onCommit, opts = {}) {
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
          <div class="diff-panel-label">${revert ? 'Original (LLM)' : 'New — editable'}</div>
          ${revert
            ? `<div class="diff-current${f.proposed ? '' : ' empty'}">${f.proposed ? escHtml(f.proposed) : '(none)'}</div>`
            : `<textarea class="diff-new" id="diff-new-${i}" rows="4">${escHtml(f.proposed || '')}</textarea>`
          }
        </div>
      </div>
    </div>`).join('');
  document.getElementById('diff-discard-btn').textContent   = revert ? 'Keep My Edit' : 'Discard';
  document.getElementById('diff-accept-edit-btn').style.display = revert ? 'none' : '';
  document.getElementById('diff-accept-new-btn').textContent = revert ? 'Revert to Original' : 'Accept New';
  document.getElementById('diff-modal').classList.add('visible');
}

function _diffGetEdited() {
  return (_diffState?.fields || []).map((_, i) => {
    const ta = document.getElementById(`diff-new-${i}`);
    return ta ? ta.value : '';
  });
}

function _diffAcceptNew() {
  const edited = _diffGetEdited();
  document.getElementById('diff-modal').classList.remove('visible');
  const cb = _diffState?.onCommit;
  _diffState = null;
  if (cb) cb('accept_new', edited);
}

function _diffAcceptEdit() {
  const edited = _diffGetEdited();
  document.getElementById('diff-modal').classList.remove('visible');
  const cb = _diffState?.onCommit;
  _diffState = null;
  if (cb) cb('accept_edit', edited);
}

function _diffDiscard() {
  document.getElementById('diff-modal').classList.remove('visible');
  _diffState = null;
}

// ── field edit modal ──────────────────────────────────────────────────────────
let _fieldEditCallback = null;

function openFieldEditModal(title, currentValue, onSave) {
  document.getElementById('field-edit-title').textContent = title;
  document.getElementById('field-edit-text').value = currentValue;
  _fieldEditCallback = onSave;
  document.getElementById('field-edit-modal').classList.add('visible');
  setTimeout(() => document.getElementById('field-edit-text').focus(), 50);
}

function closeFieldEditModal() {
  document.getElementById('field-edit-modal').classList.remove('visible');
  _fieldEditCallback = null;
}

function _fieldEditSave() {
  const val = document.getElementById('field-edit-text').value;
  const cb = _fieldEditCallback;
  closeFieldEditModal();
  if (cb) cb(val);
}

// ── kebab menus ───────────────────────────────────────────────────────────────
let _activeKebab = null;

function showKebab(anchorEl, items) {
  if (_activeKebab) { _activeKebab.remove(); _activeKebab = null; }
  const menu = document.createElement('div');
  menu.className = 'hamburger-menu open';
  menu.style.cssText = 'position:fixed;z-index:500;min-width:160px';
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
    btn.onclick = () => { menu.remove(); _activeKebab = null; item.action(); };
    menu.appendChild(btn);
  }
  document.body.appendChild(menu);
  _activeKebab = menu;

  const rect = anchorEl.getBoundingClientRect();
  let top  = rect.bottom + 4;
  let left = rect.right - menu.offsetWidth;
  if (left < 4) left = rect.left;
  if (top + 200 > window.innerHeight) top = rect.top - 200;
  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';

  setTimeout(() => {
    const dismiss = e => {
      if (!menu.contains(e.target)) { menu.remove(); _activeKebab = null; document.removeEventListener('click', dismiss); }
    };
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

function initResize() {
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
