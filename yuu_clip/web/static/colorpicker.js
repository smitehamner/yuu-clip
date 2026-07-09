(function () {
// Feature-map - Shared colour picker. Progressive-enhances an <input> that holds
//   a hex value: the original input becomes a hidden value-store (keeping its id,
//   classes, data-* and event wiring) and gains a compact swatch trigger. Clicking
//   it opens a popover with direct hex entry, a recently-used strip, and (Stage 3)
//   a user-curated named palette. Replaces native <input type="color"> at the
//   speaker-colour and title-card colour sites.
//   Tests: tests/test_ui_colorpicker.py
// ── shared colour picker ──────────────────────────────────────────────────────

const RECENT_KEY = 'yuuclip-color-recent';
const PALETTE_KEY = 'yuuclip-color-palette';
const RECENT_MAX = 8;

// Pickable starter colours - data, not UI chrome (the chrome around them comes
// from theme tokens). A spread of hues plus black/white so a first-time user has
// usable choices before curating their own palette. These literals are the one
// exception the test_ui_theme colour-literal allowlist carves out for this file.
const STARTER_SWATCHES = [
  '#ffffff', '#000000', '#e05c5c', '#f0803c', '#f0c060', '#4caf7d',
  '#4fc3f7', '#6f5df5', '#b06af7', '#f77ac0', '#9e9e9e', '#7a4b2a',
];

function _readList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _writeList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* storage disabled */ }
}

// Accepts #RGB or #RRGGBB (with or without the leading #) and returns a
// canonical lowercase #rrggbb, or null when the value isn't a valid hex colour.
function _normalizeHex(raw) {
  if (typeof raw !== 'string') return null;
  let hex = raw.trim();
  if (hex && !hex.startsWith('#')) hex = '#' + hex;
  const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
  if (short) hex = '#' + short[1].split('').map(c => c + c).join('');
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

function _recordRecent(hex) {
  const norm = _normalizeHex(hex);
  if (!norm) return;
  const list = _readList(RECENT_KEY)
    .map(_normalizeHex)
    .filter(c => c && c !== norm);
  list.unshift(norm);
  _writeList(RECENT_KEY, list.slice(0, RECENT_MAX));
}

// A single clickable swatch showing an actual chosen colour. The background is a
// data value (the picked colour), set as a DOM property so it never appears as a
// literal in source - the swatch's border/focus ring are theme tokens via CSS.
function _swatchButton(color) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'colorpicker-swatch';
  btn.dataset.color = color;
  btn.style.background = color;
  btn.title = color;
  btn.setAttribute('aria-label', color);
  return btn;
}

function _swatchRow(colors) {
  const row = document.createElement('div');
  row.className = 'colorpicker-row';
  const seen = new Set();
  for (const raw of colors) {
    const color = _normalizeHex(raw);
    if (!color || seen.has(color)) continue;
    seen.add(color);
    row.appendChild(_swatchButton(color));
  }
  return row;
}

function _sectionLabel(text) {
  const label = document.createElement('div');
  label.className = 'colorpicker-section-label';
  label.textContent = text;
  return label;
}

function _syncTrigger(trigger, value) {
  const color = _normalizeHex(value);
  trigger.style.background = color || 'transparent';
  trigger.classList.toggle('is-empty', !color);
}

// Everything in a picker instance the handlers need to reach.
function _makeContext(input, trigger, pop, hexField) {
  return { input, trigger, pop, hexField };
}

function _commit(ctx, rawHex) {
  const norm = _normalizeHex(rawHex);
  if (!norm) return false;
  ctx.input.value = norm;
  // input drives the live-preview handlers (title card's oninput); change drives
  // the save handlers (speaker change-delegation). The trigger re-syncs off the
  // 'input' listener wired in attach().
  ctx.input.dispatchEvent(new Event('input', { bubbles: true }));
  ctx.input.dispatchEvent(new Event('change', { bubbles: true }));
  _recordRecent(norm);
  return true;
}

// Rebuilt each time the popover opens so the recently-used strip reflects the
// latest picks. Stage 3 inserts the named-palette section here.
function _renderStrips(ctx) {
  ctx.pop.querySelectorAll('.colorpicker-dynamic').forEach(el => el.remove());
  const frag = document.createDocumentFragment();
  const recent = _readList(RECENT_KEY);
  if (recent.length) {
    frag.appendChild(_sectionLabel('Recently used'));
    frag.appendChild(_swatchRow(recent));
  }
  frag.appendChild(_sectionLabel('Colours'));
  frag.appendChild(_swatchRow(STARTER_SWATCHES));
  frag.querySelectorAll(':scope > *').forEach(el => el.classList.add('colorpicker-dynamic'));
  ctx.pop.appendChild(frag);
}

let _openCtx = null;  // the one open picker context, or null

function _closePopover() {
  if (!_openCtx) return;
  _openCtx.pop.classList.remove('open');
  _openCtx.trigger.setAttribute('aria-expanded', 'false');
  _openCtx = null;
}

function _openPopover(ctx) {
  _closePopover();
  ctx.hexField.value = (_normalizeHex(ctx.input.value) || '').replace('#', '');
  ctx.hexField.classList.remove('invalid');
  _renderStrips(ctx);
  ctx.pop.classList.add('open');
  ctx.trigger.setAttribute('aria-expanded', 'true');
  _openCtx = ctx;
  ctx.hexField.focus();
}

function _wireHexField(ctx) {
  ctx.hexField.addEventListener('input', () => {
    const norm = _normalizeHex(ctx.hexField.value);
    ctx.hexField.classList.toggle('invalid', !norm && ctx.hexField.value.trim() !== '');
    if (norm) _syncTrigger(ctx.trigger, norm);  // live preview, no commit yet
  });
  ctx.hexField.addEventListener('change', () => _commit(ctx, ctx.hexField.value));
  ctx.hexField.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (_commit(ctx, ctx.hexField.value)) _closePopover();
  });
}

function _buildHexRow() {
  const row = document.createElement('div');
  row.className = 'colorpicker-hexrow';
  const label = document.createElement('span');
  label.className = 'colorpicker-hexhash';
  label.textContent = '#';
  const field = document.createElement('input');
  field.type = 'text';
  field.className = 'colorpicker-hexfield';
  field.setAttribute('maxlength', '7');
  field.setAttribute('spellcheck', 'false');
  field.setAttribute('autocomplete', 'off');
  field.setAttribute('aria-label', 'Hex colour value');
  field.placeholder = 'RRGGBB';
  row.append(label, field);
  return { row, field };
}

function attach(input) {
  if (!input || input.dataset.cpAttached) return;
  input.dataset.cpAttached = '1';
  const initial = _normalizeHex(input.value) || '';
  input.type = 'hidden';
  input.value = initial;

  const wrap = document.createElement('span');
  wrap.className = 'colorpicker';
  input.parentNode.insertBefore(wrap, input);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'colorpicker-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'Choose colour');

  const pop = document.createElement('div');
  pop.className = 'colorpicker-pop';
  pop.setAttribute('role', 'dialog');
  const { row: hexRow, field: hexField } = _buildHexRow();
  pop.appendChild(hexRow);

  wrap.append(trigger, input, pop);
  const ctx = _makeContext(input, trigger, pop, hexField);

  _syncTrigger(trigger, input.value);
  input.addEventListener('input', () => _syncTrigger(trigger, input.value));
  trigger.addEventListener('click', e => {
    e.preventDefault();
    if (_openCtx && _openCtx.trigger === trigger) _closePopover();
    else _openPopover(ctx);
  });
  pop.addEventListener('click', e => {
    const swatch = e.target.closest('.colorpicker-swatch');
    if (!swatch) return;
    _commit(ctx, swatch.dataset.color);
    _closePopover();
  });
  _wireHexField(ctx);
}

// Close the open popover on an outside click or Escape. Registered once.
document.addEventListener('click', e => {
  if (_openCtx && !_openCtx.pop.parentNode.contains(e.target)) _closePopover();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _openCtx) {
    const { trigger } = _openCtx;
    _closePopover();
    trigger.focus();
  }
});

window.ColorPicker = { attach, _normalizeHex, RECENT_KEY, PALETTE_KEY };
})();
