// Feature-map - Shared colour picker. Progressive-enhances an <input> that holds
//   a hex value: the original input becomes a hidden value-store (keeping its id,
//   classes, data-* and event wiring) and gains a compact swatch trigger. Clicking
//   it opens a popover with direct hex entry, a recently-used strip, and (Stage 3)
//   a user-curated named palette. Replaces native <input type="color"> at the
//   speaker-colour and title-card colour sites.
//   Tests: tests/ui/test_ui_colorpicker.py
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
  '#4fc3f7', '#0a7a9b', '#b06af7', '#f77ac0', '#9e9e9e', '#7a4b2a',
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

// ── user-curated named palette ────────────────────────────────────────────────
function _paletteEntries() {
  return _readList(PALETTE_KEY)
    .filter(e => e && typeof e.name === 'string' && _normalizeHex(e.color))
    .map(e => ({ name: e.name, color: _normalizeHex(e.color) }));
}

function _paletteItem(name, color) {
  const item = document.createElement('div');
  item.className = 'colorpicker-palette-item';
  const label = document.createElement('span');
  label.className = 'colorpicker-palette-name';
  label.textContent = name;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'colorpicker-palette-remove';
  remove.dataset.name = name;
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Remove ${name}`);
  item.append(_swatchButton(color), label, remove);
  return item;
}

function _buildPalette(entries) {
  const wrap = document.createElement('div');
  wrap.className = 'colorpicker-palette';
  if (!entries.length) {
    const hint = document.createElement('span');
    hint.className = 'colorpicker-hint';
    hint.textContent = 'Save a colour below to build your palette.';
    wrap.appendChild(hint);
    return wrap;
  }
  entries.forEach(({ name, color }) => wrap.appendChild(_paletteItem(name, color)));
  return wrap;
}

function _buildAddRow() {
  const row = document.createElement('div');
  row.className = 'colorpicker-addrow';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'colorpicker-palette-input';
  input.setAttribute('maxlength', '40');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('aria-label', 'Name for the current colour');
  input.placeholder = 'Name this colour';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'colorpicker-palette-add';
  add.textContent = 'Save';
  row.append(input, add);
  return row;
}

// Saves the colour currently in the hex field (falling back to the committed
// value) under the typed name, defaulting the name to the hex string itself.
function _addPaletteEntry(ctx) {
  const color = _normalizeHex(ctx.hexField.value) || _normalizeHex(ctx.input.value);
  if (!color) return;
  const nameInput = ctx.pop.querySelector('.colorpicker-palette-input');
  const name = (nameInput && nameInput.value.trim()) || color;
  const next = _paletteEntries().filter(e => e.name !== name);
  next.push({ name, color });
  _writeList(PALETTE_KEY, next);
  _renderStrips(ctx);
}

function _removePaletteEntry(ctx, name) {
  _writeList(PALETTE_KEY, _paletteEntries().filter(e => e.name !== name));
  _renderStrips(ctx);
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

// Rebuilt each time the popover opens (and after a palette add/remove) so the
// recently-used strip and saved palette reflect the latest state. All of it goes
// in one container that is replaced wholesale, so nothing accumulates.
function _renderStrips(ctx) {
  const stale = ctx.pop.querySelector('.colorpicker-dynamic');
  if (stale) stale.remove();
  const container = document.createElement('div');
  container.className = 'colorpicker-dynamic';
  const recent = _readList(RECENT_KEY);
  if (recent.length) {
    container.appendChild(_sectionLabel('Recently used'));
    container.appendChild(_swatchRow(recent));
  }
  container.appendChild(_sectionLabel('Your palette'));
  container.appendChild(_buildPalette(_paletteEntries()));
  container.appendChild(_buildAddRow());
  container.appendChild(_sectionLabel('Colours'));
  container.appendChild(_swatchRow(STARTER_SWATCHES));
  ctx.pop.appendChild(container);
}

let _openCtx = null;  // the one open picker context, or null

function _closePopover(refocus) {
  if (!_openCtx) return;
  const { pop, trigger } = _openCtx;
  pop.classList.remove('open');
  trigger.setAttribute('aria-expanded', 'false');
  _openCtx = null;
  if (refocus) trigger.focus();
}

// The popover is a dialog, so Tab must not fall through to the page behind it
// (WCAG 2.4.3). Cycle focus among the popover's own controls; the trigger sits
// outside the popover and is intentionally excluded while it is open.
function _focusables(pop) {
  return Array.from(pop.querySelectorAll('button, input')).filter(
    el => !el.disabled && el.offsetParent !== null,
  );
}

function _trapFocus(e) {
  const items = _focusables(_openCtx.pop);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!_openCtx.pop.contains(active)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
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
    if (_commit(ctx, ctx.hexField.value)) _closePopover(true);
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
  pop.setAttribute('aria-label', 'Colour picker');
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
    const removeBtn = e.target.closest('.colorpicker-palette-remove');
    if (removeBtn) { _removePaletteEntry(ctx, removeBtn.dataset.name); return; }
    if (e.target.closest('.colorpicker-palette-add')) { _addPaletteEntry(ctx); return; }
    const swatch = e.target.closest('.colorpicker-swatch');
    if (!swatch) return;
    _commit(ctx, swatch.dataset.color);
    _closePopover();
  });
  pop.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.closest('.colorpicker-palette-input')) {
      e.preventDefault();
      _addPaletteEntry(ctx);
    }
  });
  _wireHexField(ctx);
}

// Close the open popover on an outside click or Escape. Called once from boot.js
// at first paint (see initHotwordListeners in hotwords.js for the reference
// pattern) so importing this module has no DOM side effect.
// A click that re-renders the popover (Save / remove a palette entry) detaches
// its own target before this bubbling handler runs; such a target is no longer in
// the document, so skip it rather than mistaking it for an outside click.
function initColorPickerListeners() {
  document.addEventListener('click', e => {
    if (!_openCtx) return;
    if (!document.documentElement.contains(e.target)) return;
    if (!_openCtx.pop.parentNode.contains(e.target)) _closePopover();
  });
  document.addEventListener('keydown', e => {
    if (!_openCtx) return;
    if (e.key === 'Escape') { _closePopover(true); return; }
    if (e.key === 'Tab') _trapFocus(e);
  });
}

export const ColorPicker = { attach, _normalizeHex, RECENT_KEY, PALETTE_KEY };
export { initColorPickerListeners };
