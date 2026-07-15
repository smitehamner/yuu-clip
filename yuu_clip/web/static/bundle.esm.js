(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // yuu_clip/web/static/format.js
  var format_exports = {};
  __export(format_exports, {
    _fmtAgo: () => _fmtAgo,
    _fmtDate: () => _fmtDate,
    _fmtElapsed: () => _fmtElapsed,
    _fmtOffset: () => _fmtOffset,
    _fmtVideoStatus: () => _fmtVideoStatus,
    _lerpColor: () => _lerpColor,
    _msToHms: () => _msToHms,
    _parseIntervalS: () => _parseIntervalS,
    _parseServerDate: () => _parseServerDate,
    _scoreBorderColor: () => _scoreBorderColor,
    _scoreIcon: () => _scoreIcon,
    _sortScore: () => _sortScore,
    escHtml: () => escHtml,
    finiteOr: () => finiteOr,
    fmtDuration: () => fmtDuration,
    formatApiError: () => formatApiError,
    plural: () => plural,
    stripRichMarkup: () => stripRichMarkup,
    truncate: () => truncate
  });
  function _scoreIcon(score) {
    const color = score >= 0.7 ? "var(--green)" : score >= 0.4 ? "var(--warning)" : "var(--muted)";
    return `<span style="color:${color};font-size:10px" aria-hidden="true">&#11088;</span>`;
  }
  function _lerpColor(c1, c2, t) {
    const h = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const [r1, g1, b1] = h(c1), [r2, g2, b2] = h(c2);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
  }
  function _scoreBorderColor(score, isRejected) {
    if (isRejected) return "var(--muted)";
    const stops = [[0, "#6b6b80"], [0.3, "#4fc3f7"], [0.5, "#4caf7d"], [0.7, "#f0c060"], [1, "#f7a85a"]];
    for (let i = 1; i < stops.length; i++) {
      if (score <= stops[i][0]) {
        const t = (score - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        return _lerpColor(stops[i - 1][1], stops[i][1], t);
      }
    }
    return stops[stops.length - 1][1];
  }
  function _sortScore(clip) {
    const sort = window._clipsSortParam();
    if (sort === "funny") return clip.score_funny;
    if (sort === "dramatic") return clip.score_dramatic;
    if (sort === "action") return clip.score_action;
    if (sort === "visual") return clip.score_visual;
    if (sort === "laugh") return clip.score_laugh;
    return clip.score_overall;
  }
  var _VIDEO_STATUS_DISPLAY = {
    pending: "Not analyzed",
    probed: "Inspected",
    labeled: "Tracks assigned",
    extracting: "Extracting",
    transcribing: "Transcribing",
    transcribed: "Transcribed",
    segmented: "Clips generated",
    done: "Analyzed",
    failed: "Analysis interrupted"
  };
  function _fmtVideoStatus(s) {
    return _VIDEO_STATUS_DISPLAY[s] || s;
  }
  function _msToHms(ms) {
    const s = Math.floor(ms / 1e3);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), sec = s % 60;
    if (m < 60) return `${m}m ${String(sec).padStart(2, "0")}s`;
    const h = Math.floor(m / 60), min = m % 60;
    return `${h}h ${String(min).padStart(2, "0")}m`;
  }
  function plural(count, singular, pluralForm) {
    return `${count} ${count === 1 ? singular : pluralForm || singular + "s"}`;
  }
  function finiteOr(value, fallback = "N/A") {
    return Number.isFinite(value) ? value : fallback;
  }
  function fmtDuration(seconds, fallback = "unknown") {
    if (!Number.isFinite(seconds)) return fallback;
    return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds)} sec`;
  }
  function truncate(text, max) {
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }
  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function formatApiError(err) {
    if (!err) return "Unknown error";
    if (typeof err.detail === "string") return err.detail;
    if (Array.isArray(err.detail)) return err.detail.map((e) => e.msg || JSON.stringify(e)).join("; ");
    if (err.message) return err.message;
    const stringified = JSON.stringify(err);
    return !stringified || stringified === "{}" ? "Unknown error (no details from server)" : stringified;
  }
  function stripRichMarkup(text) {
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").replace(/\[\/?\w+\]/g, "");
  }
  function _parseServerDate(iso) {
    const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
    return new Date(hasZone ? iso : iso + "Z");
  }
  function _fmtDate(iso) {
    if (!iso) return "never";
    const d = _parseServerDate(iso);
    return d.toLocaleDateString(void 0, { month: "short", day: "numeric" }) + " at " + d.toLocaleTimeString(void 0, { hour: "numeric", minute: "2-digit" });
  }
  function _fmtAgo(isoString) {
    const diffS = (Date.now() - _parseServerDate(isoString).getTime()) / 1e3;
    if (diffS < 60) return "just now";
    if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
    if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
    return `${Math.floor(diffS / 86400)}d ago`;
  }
  function _fmtOffset(v) {
    if (!v) return "+0.0";
    return (v >= 0 ? "+" : "") + v.toFixed(1);
  }
  function _fmtElapsed(ms) {
    const s = Math.floor(ms / 1e3);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }
  var _TIMELINE_MIN_INTERVAL_S = 10;
  function _parseIntervalS(value, unit) {
    const n = parseInt(value, 10);
    if (isNaN(n)) return null;
    const seconds = unit === "minutes" ? n * 60 : n;
    return seconds >= _TIMELINE_MIN_INTERVAL_S ? seconds : null;
  }

  // yuu_clip/web/static/colorpicker.js
  var RECENT_KEY = "yuuclip-color-recent";
  var PALETTE_KEY = "yuuclip-color-palette";
  var RECENT_MAX = 8;
  var STARTER_SWATCHES = [
    "#ffffff",
    "#000000",
    "#e05c5c",
    "#f0803c",
    "#f0c060",
    "#4caf7d",
    "#4fc3f7",
    "#0a7a9b",
    "#b06af7",
    "#f77ac0",
    "#9e9e9e",
    "#7a4b2a"
  ];
  function _readList(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function _writeList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
    }
  }
  function _normalizeHex(raw) {
    if (typeof raw !== "string") return null;
    let hex = raw.trim();
    if (hex && !hex.startsWith("#")) hex = "#" + hex;
    const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
    if (short) hex = "#" + short[1].split("").map((c) => c + c).join("");
    return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
  }
  function _recordRecent(hex) {
    const norm = _normalizeHex(hex);
    if (!norm) return;
    const list = _readList(RECENT_KEY).map(_normalizeHex).filter((c) => c && c !== norm);
    list.unshift(norm);
    _writeList(RECENT_KEY, list.slice(0, RECENT_MAX));
  }
  function _swatchButton(color) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "colorpicker-swatch";
    btn.dataset.color = color;
    btn.style.background = color;
    btn.title = color;
    btn.setAttribute("aria-label", color);
    return btn;
  }
  function _swatchRow(colors) {
    const row = document.createElement("div");
    row.className = "colorpicker-row";
    const seen = /* @__PURE__ */ new Set();
    for (const raw of colors) {
      const color = _normalizeHex(raw);
      if (!color || seen.has(color)) continue;
      seen.add(color);
      row.appendChild(_swatchButton(color));
    }
    return row;
  }
  function _sectionLabel(text) {
    const label = document.createElement("div");
    label.className = "colorpicker-section-label";
    label.textContent = text;
    return label;
  }
  function _paletteEntries() {
    return _readList(PALETTE_KEY).filter((e) => e && typeof e.name === "string" && _normalizeHex(e.color)).map((e) => ({ name: e.name, color: _normalizeHex(e.color) }));
  }
  function _paletteItem(name, color) {
    const item = document.createElement("div");
    item.className = "colorpicker-palette-item";
    const label = document.createElement("span");
    label.className = "colorpicker-palette-name";
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "colorpicker-palette-remove";
    remove.dataset.name = name;
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${name}`);
    item.append(_swatchButton(color), label, remove);
    return item;
  }
  function _buildPalette(entries) {
    const wrap = document.createElement("div");
    wrap.className = "colorpicker-palette";
    if (!entries.length) {
      const hint = document.createElement("span");
      hint.className = "colorpicker-hint";
      hint.textContent = "Save a colour below to build your palette.";
      wrap.appendChild(hint);
      return wrap;
    }
    entries.forEach(({ name, color }) => wrap.appendChild(_paletteItem(name, color)));
    return wrap;
  }
  function _buildAddRow() {
    const row = document.createElement("div");
    row.className = "colorpicker-addrow";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "colorpicker-palette-input";
    input.setAttribute("maxlength", "40");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("aria-label", "Name for the current colour");
    input.placeholder = "Name this colour";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "colorpicker-palette-add";
    add.textContent = "Save";
    row.append(input, add);
    return row;
  }
  function _addPaletteEntry(ctx) {
    const color = _normalizeHex(ctx.hexField.value) || _normalizeHex(ctx.input.value);
    if (!color) return;
    const nameInput = ctx.pop.querySelector(".colorpicker-palette-input");
    const name = nameInput && nameInput.value.trim() || color;
    const next = _paletteEntries().filter((e) => e.name !== name);
    next.push({ name, color });
    _writeList(PALETTE_KEY, next);
    _renderStrips(ctx);
  }
  function _removePaletteEntry(ctx, name) {
    _writeList(PALETTE_KEY, _paletteEntries().filter((e) => e.name !== name));
    _renderStrips(ctx);
  }
  function _syncTrigger(trigger, value) {
    const color = _normalizeHex(value);
    trigger.style.background = color || "transparent";
    trigger.classList.toggle("is-empty", !color);
  }
  function _makeContext(input, trigger, pop, hexField) {
    return { input, trigger, pop, hexField };
  }
  function _commit(ctx, rawHex) {
    const norm = _normalizeHex(rawHex);
    if (!norm) return false;
    ctx.input.value = norm;
    ctx.input.dispatchEvent(new Event("input", { bubbles: true }));
    ctx.input.dispatchEvent(new Event("change", { bubbles: true }));
    _recordRecent(norm);
    return true;
  }
  function _renderStrips(ctx) {
    const stale = ctx.pop.querySelector(".colorpicker-dynamic");
    if (stale) stale.remove();
    const container = document.createElement("div");
    container.className = "colorpicker-dynamic";
    const recent = _readList(RECENT_KEY);
    if (recent.length) {
      container.appendChild(_sectionLabel("Recently used"));
      container.appendChild(_swatchRow(recent));
    }
    container.appendChild(_sectionLabel("Your palette"));
    container.appendChild(_buildPalette(_paletteEntries()));
    container.appendChild(_buildAddRow());
    container.appendChild(_sectionLabel("Colours"));
    container.appendChild(_swatchRow(STARTER_SWATCHES));
    ctx.pop.appendChild(container);
  }
  var _openCtx = null;
  function _closePopover(refocus) {
    if (!_openCtx) return;
    const { pop, trigger } = _openCtx;
    pop.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    _openCtx = null;
    if (refocus) trigger.focus();
  }
  function _focusables(pop) {
    return Array.from(pop.querySelectorAll("button, input")).filter(
      (el) => !el.disabled && el.offsetParent !== null
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
    ctx.hexField.value = (_normalizeHex(ctx.input.value) || "").replace("#", "");
    ctx.hexField.classList.remove("invalid");
    _renderStrips(ctx);
    ctx.pop.classList.add("open");
    ctx.trigger.setAttribute("aria-expanded", "true");
    _openCtx = ctx;
    ctx.hexField.focus();
  }
  function _wireHexField(ctx) {
    ctx.hexField.addEventListener("input", () => {
      const norm = _normalizeHex(ctx.hexField.value);
      ctx.hexField.classList.toggle("invalid", !norm && ctx.hexField.value.trim() !== "");
      if (norm) _syncTrigger(ctx.trigger, norm);
    });
    ctx.hexField.addEventListener("change", () => _commit(ctx, ctx.hexField.value));
    ctx.hexField.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (_commit(ctx, ctx.hexField.value)) _closePopover(true);
    });
  }
  function _buildHexRow() {
    const row = document.createElement("div");
    row.className = "colorpicker-hexrow";
    const label = document.createElement("span");
    label.className = "colorpicker-hexhash";
    label.textContent = "#";
    const field = document.createElement("input");
    field.type = "text";
    field.className = "colorpicker-hexfield";
    field.setAttribute("maxlength", "7");
    field.setAttribute("spellcheck", "false");
    field.setAttribute("autocomplete", "off");
    field.setAttribute("aria-label", "Hex colour value");
    field.placeholder = "RRGGBB";
    row.append(label, field);
    return { row, field };
  }
  function attach(input) {
    if (!input || input.dataset.cpAttached) return;
    input.dataset.cpAttached = "1";
    const initial = _normalizeHex(input.value) || "";
    input.type = "hidden";
    input.value = initial;
    const wrap = document.createElement("span");
    wrap.className = "colorpicker";
    input.parentNode.insertBefore(wrap, input);
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "colorpicker-trigger";
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Choose colour");
    const pop = document.createElement("div");
    pop.className = "colorpicker-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Colour picker");
    const { row: hexRow, field: hexField } = _buildHexRow();
    pop.appendChild(hexRow);
    wrap.append(trigger, input, pop);
    const ctx = _makeContext(input, trigger, pop, hexField);
    _syncTrigger(trigger, input.value);
    input.addEventListener("input", () => _syncTrigger(trigger, input.value));
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      if (_openCtx && _openCtx.trigger === trigger) _closePopover();
      else _openPopover(ctx);
    });
    pop.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".colorpicker-palette-remove");
      if (removeBtn) {
        _removePaletteEntry(ctx, removeBtn.dataset.name);
        return;
      }
      if (e.target.closest(".colorpicker-palette-add")) {
        _addPaletteEntry(ctx);
        return;
      }
      const swatch = e.target.closest(".colorpicker-swatch");
      if (!swatch) return;
      _commit(ctx, swatch.dataset.color);
      _closePopover();
    });
    pop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.closest(".colorpicker-palette-input")) {
        e.preventDefault();
        _addPaletteEntry(ctx);
      }
    });
    _wireHexField(ctx);
  }
  document.addEventListener("click", (e) => {
    if (!_openCtx) return;
    if (!document.documentElement.contains(e.target)) return;
    if (!_openCtx.pop.parentNode.contains(e.target)) _closePopover();
  });
  document.addEventListener("keydown", (e) => {
    if (!_openCtx) return;
    if (e.key === "Escape") {
      _closePopover(true);
      return;
    }
    if (e.key === "Tab") _trapFocus(e);
  });
  var ColorPicker = { attach, _normalizeHex, RECENT_KEY, PALETTE_KEY };

  // yuu_clip/web/static/panelnav.js
  var _stack = [];
  function _root() {
    return document.getElementById("panelnav-root");
  }
  function _crumb() {
    return document.getElementById("panelnav-breadcrumb");
  }
  function _mount() {
    return document.getElementById("panelnav-content");
  }
  function _top() {
    return _stack[_stack.length - 1] || null;
  }
  function _renderBreadcrumb() {
    const top = _top();
    const crumb = _crumb();
    crumb.innerHTML = "";
    if (!top) return;
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn ghost";
    back.style.cssText = "padding:4px 10px;font-size:13px";
    back.textContent = "← Back";
    back.onclick = () => panelNavClose();
    const title = document.createElement("span");
    title.style.cssText = "font-size:14px;font-weight:600";
    title.textContent = top.title;
    crumb.append(back, title);
  }
  function _updateVisibility() {
    _stack.forEach((entry, i) => {
      entry.container.style.display = i === _stack.length - 1 ? "flex" : "none";
    });
  }
  function panelNavOpen({ id, title, render, isDirty, onClose }) {
    const container = document.createElement("div");
    container.dataset.panelId = id;
    container.style.cssText = "display:flex;flex-direction:column;gap:16px";
    _mount().appendChild(container);
    _stack.push({
      id,
      title,
      isDirty: isDirty || (() => false),
      onClose: onClose || (() => {
      }),
      container
    });
    _root().style.display = "flex";
    _updateVisibility();
    _renderBreadcrumb();
    render(container);
  }
  function _closeTop() {
    const top = _stack.pop();
    if (!top) return;
    top.onClose();
    top.container.remove();
    if (_stack.length === 0) {
      _root().style.display = "none";
    } else {
      _updateVisibility();
      _renderBreadcrumb();
    }
  }
  function panelNavClose() {
    const top = _top();
    if (!top) return;
    if (top.isDirty()) {
      window.showConfirm(
        "Discard changes?",
        "You have unsaved changes. Close without saving?",
        "Discard",
        _closeTop,
        true
      );
      return;
    }
    _closeTop();
  }
  function panelNavForceClose() {
    _closeTop();
  }
  function panelNavIsOpen(id) {
    if (id === void 0) return _stack.length > 0;
    return _stack.some((entry) => entry.id === id);
  }
  var PanelNav = {
    open: panelNavOpen,
    close: panelNavClose,
    forceClose: panelNavForceClose,
    isOpen: panelNavIsOpen
  };

  // yuu_clip/web/static/main.esm.js
  Object.assign(window, format_exports);
  window.ColorPicker = ColorPicker;
  window.PanelNav = PanelNav;
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgIm1haW4uZXNtLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBGZWF0dXJlLW1hcCAtIFB1cmUgZm9ybWF0dGVycyBhbmQgc2NvcmUgaGVscGVyczogbm8gRE9NLCBubyBmZXRjaC4gSFRNTC1lc2NhcGUsIEFQSS1lcnJvciB0ZXh0LFxyXG4vLyAgIGR1cmF0aW9uL2RhdGUvb2Zmc2V0IGZvcm1hdHRpbmcsIHZpZGVvLXN0YXR1cyBsYWJlbHMsIGFuZCB0aGUgc2NvcmUgY29sb3IvaWNvbiBlbmNvZGluZy5cclxuLy8gICBBUEk6IG5vbmUgKGNsaWVudC1vbmx5KSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV91dGlscy5weVxyXG4vLyDilIDilIAgc2NvcmUgdXRpbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmZ1bmN0aW9uIF9zY29yZUljb24oc2NvcmUpIHtcclxuICBjb25zdCBjb2xvciA9IHNjb3JlID49IDAuNyA/ICd2YXIoLS1ncmVlbiknIDogc2NvcmUgPj0gMC40ID8gJ3ZhcigtLXdhcm5pbmcpJyA6ICd2YXIoLS1tdXRlZCknO1xyXG4gIHJldHVybiBgPHNwYW4gc3R5bGU9XCJjb2xvcjoke2NvbG9yfTtmb250LXNpemU6MTBweFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPiYjMTEwODg7PC9zcGFuPmA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9sZXJwQ29sb3IoYzEsIGMyLCB0KSB7XHJcbiAgY29uc3QgaCA9IGMgPT4gW3BhcnNlSW50KGMuc2xpY2UoMSwzKSwxNiksIHBhcnNlSW50KGMuc2xpY2UoMyw1KSwxNiksIHBhcnNlSW50KGMuc2xpY2UoNSw3KSwxNildO1xyXG4gIGNvbnN0IFtyMSxnMSxiMV0gPSBoKGMxKSwgW3IyLGcyLGIyXSA9IGgoYzIpO1xyXG4gIHJldHVybiBgcmdiKCR7TWF0aC5yb3VuZChyMSsocjItcjEpKnQpfSwke01hdGgucm91bmQoZzErKGcyLWcxKSp0KX0sJHtNYXRoLnJvdW5kKGIxKyhiMi1iMSkqdCl9KWA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zY29yZUJvcmRlckNvbG9yKHNjb3JlLCBpc1JlamVjdGVkKSB7XHJcbiAgaWYgKGlzUmVqZWN0ZWQpIHJldHVybiAndmFyKC0tbXV0ZWQpJztcclxuICBjb25zdCBzdG9wcyA9IFtbMCwnIzZiNmI4MCddLFswLjMsJyM0ZmMzZjcnXSxbMC41LCcjNGNhZjdkJ10sWzAuNywnI2YwYzA2MCddLFsxLjAsJyNmN2E4NWEnXV07XHJcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBzdG9wcy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKHNjb3JlIDw9IHN0b3BzW2ldWzBdKSB7XHJcbiAgICAgIGNvbnN0IHQgPSAoc2NvcmUgLSBzdG9wc1tpLTFdWzBdKSAvIChzdG9wc1tpXVswXSAtIHN0b3BzW2ktMV1bMF0pO1xyXG4gICAgICByZXR1cm4gX2xlcnBDb2xvcihzdG9wc1tpLTFdWzFdLCBzdG9wc1tpXVsxXSwgdCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBzdG9wc1tzdG9wcy5sZW5ndGgtMV1bMV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zb3J0U2NvcmUoY2xpcCkge1xyXG4gIGNvbnN0IHNvcnQgPSB3aW5kb3cuX2NsaXBzU29ydFBhcmFtKCk7XHJcbiAgaWYgKHNvcnQgPT09ICdmdW5ueScpICAgIHJldHVybiBjbGlwLnNjb3JlX2Z1bm55O1xyXG4gIGlmIChzb3J0ID09PSAnZHJhbWF0aWMnKSByZXR1cm4gY2xpcC5zY29yZV9kcmFtYXRpYztcclxuICBpZiAoc29ydCA9PT0gJ2FjdGlvbicpICAgcmV0dXJuIGNsaXAuc2NvcmVfYWN0aW9uO1xyXG4gIGlmIChzb3J0ID09PSAndmlzdWFsJykgICByZXR1cm4gY2xpcC5zY29yZV92aXN1YWw7XHJcbiAgaWYgKHNvcnQgPT09ICdsYXVnaCcpICAgIHJldHVybiBjbGlwLnNjb3JlX2xhdWdoO1xyXG4gIHJldHVybiBjbGlwLnNjb3JlX292ZXJhbGw7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBmb3JtYXQgdXRpbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmNvbnN0IF9WSURFT19TVEFUVVNfRElTUExBWSA9IHtcclxuICBwZW5kaW5nOiAnTm90IGFuYWx5emVkJywgcHJvYmVkOiAnSW5zcGVjdGVkJywgbGFiZWxlZDogJ1RyYWNrcyBhc3NpZ25lZCcsXHJcbiAgZXh0cmFjdGluZzogJ0V4dHJhY3RpbmcnLCB0cmFuc2NyaWJpbmc6ICdUcmFuc2NyaWJpbmcnLCB0cmFuc2NyaWJlZDogJ1RyYW5zY3JpYmVkJyxcclxuICBzZWdtZW50ZWQ6ICdDbGlwcyBnZW5lcmF0ZWQnLCBkb25lOiAnQW5hbHl6ZWQnLCBmYWlsZWQ6ICdBbmFseXNpcyBpbnRlcnJ1cHRlZCcsXHJcbn07XHJcbmZ1bmN0aW9uIF9mbXRWaWRlb1N0YXR1cyhzKSB7IHJldHVybiBfVklERU9fU1RBVFVTX0RJU1BMQVlbc10gfHwgczsgfVxyXG5cclxuZnVuY3Rpb24gX21zVG9IbXMobXMpIHtcclxuICBjb25zdCBzID0gTWF0aC5mbG9vcihtcyAvIDEwMDApO1xyXG4gIGlmIChzIDwgNjApIHJldHVybiBgJHtzfXNgO1xyXG4gIGNvbnN0IG0gPSBNYXRoLmZsb29yKHMgLyA2MCksIHNlYyA9IHMgJSA2MDtcclxuICBpZiAobSA8IDYwKSByZXR1cm4gYCR7bX1tICR7U3RyaW5nKHNlYykucGFkU3RhcnQoMiwgJzAnKX1zYDtcclxuICBjb25zdCBoID0gTWF0aC5mbG9vcihtIC8gNjApLCBtaW4gPSBtICUgNjA7XHJcbiAgcmV0dXJuIGAke2h9aCAke1N0cmluZyhtaW4pLnBhZFN0YXJ0KDIsICcwJyl9bWA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBsdXJhbChjb3VudCwgc2luZ3VsYXIsIHBsdXJhbEZvcm0pIHtcclxuICByZXR1cm4gYCR7Y291bnR9ICR7Y291bnQgPT09IDEgPyBzaW5ndWxhciA6IChwbHVyYWxGb3JtIHx8IHNpbmd1bGFyICsgJ3MnKX1gO1xyXG59XHJcblxyXG4vLyBTdGFuZGFyZCBndWFyZCBmb3IgYW55IGNvbXB1dGVkIG51bWJlciBzaG93biB0byB0aGUgdXNlcjogcmV0dXJucyAqdmFsdWUqXHJcbi8vIG9ubHkgd2hlbiBpdCBpcyBhIGZpbml0ZSBudW1iZXIsIG90aGVyd2lzZSBhIHBsYWluLUVuZ2xpc2ggKmZhbGxiYWNrKi4gTmFOXHJcbi8vIG9yIEluZmluaXR5IC0gdXN1YWxseSBmcm9tIGFyaXRobWV0aWMgb24gbWlzc2luZy9wYXJ0aWFsIGRhdGEgLSBtdXN0IG5ldmVyXHJcbi8vIHJlYWNoIHRoZSBVSSBhcyB0aGUgbGl0ZXJhbCBcIk5hTlwiL1wiSW5maW5pdHlcIi4gVXNlIHRoaXMgKG9yIGZtdER1cmF0aW9uKSBhdFxyXG4vLyBldmVyeSBkaXNwbGF5IHNpdGUgdGhhdCBmb3JtYXRzIGEgZGVyaXZlZCBudW1iZXIuXHJcbmZ1bmN0aW9uIGZpbml0ZU9yKHZhbHVlLCBmYWxsYmFjayA9ICdOL0EnKSB7XHJcbiAgcmV0dXJuIE51bWJlci5pc0Zpbml0ZSh2YWx1ZSkgPyB2YWx1ZSA6IGZhbGxiYWNrO1xyXG59XHJcblxyXG4vLyBIdW1hbi1yZWFkYWJsZSBjbGlwL3NlZ21lbnQgbGVuZ3RoLiBSZXR1cm5zICpmYWxsYmFjayogZm9yIGEgbm9uLWZpbml0ZVxyXG4vLyBpbnB1dCAoZS5nLiBhIGNsaXAgbWlzc2luZyBpdHMgc3RhcnQvZW5kIHRpbWVzKSByYXRoZXIgdGhhbiBcIk5hTiBzZWNcIi5cclxuZnVuY3Rpb24gZm10RHVyYXRpb24oc2Vjb25kcywgZmFsbGJhY2sgPSAndW5rbm93bicpIHtcclxuICBpZiAoIU51bWJlci5pc0Zpbml0ZShzZWNvbmRzKSkgcmV0dXJuIGZhbGxiYWNrO1xyXG4gIHJldHVybiBzZWNvbmRzID49IDYwID8gYCR7TWF0aC5yb3VuZChzZWNvbmRzIC8gNjApfSBtaW5gIDogYCR7TWF0aC5yb3VuZChzZWNvbmRzKX0gc2VjYDtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJ1bmNhdGUodGV4dCwgbWF4KSB7XHJcbiAgcmV0dXJuIHRleHQubGVuZ3RoID4gbWF4ID8gdGV4dC5zbGljZSgwLCBtYXggLSAxKSArICfigKYnIDogdGV4dDtcclxufVxyXG5cclxuZnVuY3Rpb24gZXNjSHRtbChzKSB7XHJcbiAgcmV0dXJuIFN0cmluZyhzKS5yZXBsYWNlKC8mL2csJyZhbXA7JykucmVwbGFjZSgvPC9nLCcmbHQ7JykucmVwbGFjZSgvPi9nLCcmZ3Q7JykucmVwbGFjZSgvXCIvZywnJnF1b3Q7Jyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZvcm1hdEFwaUVycm9yKGVycikge1xyXG4gIGlmICghZXJyKSByZXR1cm4gJ1Vua25vd24gZXJyb3InO1xyXG4gIGlmICh0eXBlb2YgZXJyLmRldGFpbCA9PT0gJ3N0cmluZycpIHJldHVybiBlcnIuZGV0YWlsO1xyXG4gIGlmIChBcnJheS5pc0FycmF5KGVyci5kZXRhaWwpKSByZXR1cm4gZXJyLmRldGFpbC5tYXAoZSA9PiBlLm1zZyB8fCBKU09OLnN0cmluZ2lmeShlKSkuam9pbignOyAnKTtcclxuICBpZiAoZXJyLm1lc3NhZ2UpIHJldHVybiBlcnIubWVzc2FnZTtcclxuICBjb25zdCBzdHJpbmdpZmllZCA9IEpTT04uc3RyaW5naWZ5KGVycik7XHJcbiAgcmV0dXJuICghc3RyaW5naWZpZWQgfHwgc3RyaW5naWZpZWQgPT09ICd7fScpID8gJ1Vua25vd24gZXJyb3IgKG5vIGRldGFpbHMgZnJvbSBzZXJ2ZXIpJyA6IHN0cmluZ2lmaWVkO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdHJpcFJpY2hNYXJrdXAodGV4dCkge1xyXG4gIHJldHVybiB0ZXh0XHJcbiAgICAucmVwbGFjZSgvXFx4MWJcXFtbMC05O10qW2EtekEtWl0vZywgJycpICAvLyBBTlNJIGVzY2FwZSBjb2Rlc1xyXG4gICAgLnJlcGxhY2UoL1xcW1xcLz9cXHcrXFxdL2csICcnKTsgICAgICAgICAgICAgLy8gUmljaCBtYXJrdXAgdGFnc1xyXG59XHJcblxyXG4vLyBTZXJ2ZXIgdGltZXN0YW1wcyBhcmUgbmFpdmUgVVRDIChTUUxpdGUgRGF0ZVRpbWUg4oaSIGlzb2Zvcm1hdCgpIHdpdGggbm8gem9uZSkuXHJcbi8vIFRyZWF0IGEgem9uZS1sZXNzIHN0cmluZyBhcyBVVEMgc28gaXQgaXNuJ3QgcGFyc2VkIGFzIHRoZSB2aWV3ZXIncyBsb2NhbCB0aW1lLlxyXG5mdW5jdGlvbiBfcGFyc2VTZXJ2ZXJEYXRlKGlzbykge1xyXG4gIGNvbnN0IGhhc1pvbmUgPSAvW3paXSR8WystXVxcZHsyfTo/XFxkezJ9JC8udGVzdChpc28pO1xyXG4gIHJldHVybiBuZXcgRGF0ZShoYXNab25lID8gaXNvIDogaXNvICsgJ1onKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdERhdGUoaXNvKSB7XHJcbiAgaWYgKCFpc28pIHJldHVybiAnbmV2ZXInO1xyXG4gIGNvbnN0IGQgPSBfcGFyc2VTZXJ2ZXJEYXRlKGlzbyk7XHJcbiAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKHVuZGVmaW5lZCwge21vbnRoOidzaG9ydCcsIGRheTonbnVtZXJpYyd9KSArICcgYXQgJyArXHJcbiAgICBkLnRvTG9jYWxlVGltZVN0cmluZyh1bmRlZmluZWQsIHtob3VyOidudW1lcmljJywgbWludXRlOicyLWRpZ2l0J30pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10QWdvKGlzb1N0cmluZykge1xyXG4gIGNvbnN0IGRpZmZTID0gKERhdGUubm93KCkgLSBfcGFyc2VTZXJ2ZXJEYXRlKGlzb1N0cmluZykuZ2V0VGltZSgpKSAvIDEwMDA7XHJcbiAgaWYgKGRpZmZTIDwgNjApICAgIHJldHVybiAnanVzdCBub3cnO1xyXG4gIGlmIChkaWZmUyA8IDM2MDApICByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDYwKX1tIGFnb2A7XHJcbiAgaWYgKGRpZmZTIDwgODY0MDApIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gMzYwMCl9aCBhZ29gO1xyXG4gIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gODY0MDApfWQgYWdvYDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdE9mZnNldCh2KSB7XHJcbiAgaWYgKCF2KSByZXR1cm4gJyswLjAnO1xyXG4gIHJldHVybiAodiA+PSAwID8gJysnIDogJycpICsgdi50b0ZpeGVkKDEpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10RWxhcHNlZChtcykge1xyXG4gIGNvbnN0IHMgPSBNYXRoLmZsb29yKG1zIC8gMTAwMCk7XHJcbiAgY29uc3QgbSA9IE1hdGguZmxvb3IocyAvIDYwKTtcclxuICByZXR1cm4gbSA+IDAgPyBgJHttfW0gJHtzICUgNjB9c2AgOiBgJHtzfXNgO1xyXG59XHJcblxyXG4vLyDilIDilIAgdGltZWxpbmUgaW50ZXJ2YWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmNvbnN0IF9USU1FTElORV9NSU5fSU5URVJWQUxfUyA9IDEwO1xyXG5cclxuLy8gQ29udmVydCBhIHRpbWVsaW5lIGludGVydmFsICh2YWx1ZSwgdW5pdCkgaW50byBzZWNvbmRzOyBudWxsIGlmIG5vbi1udW1lcmljIG9yXHJcbi8vIGJlbG93IHRoZSBtaW5pbXVtLiBTaGFyZWQgYnkgdGhlIFNldHRpbmdzIHNhdmUgcGF0aCBhbmQgdGhlIHBlci12aWRlbyB0aW1lbGluZVxyXG4vLyBnZW5lcmF0b3Igc28gdGhlaXIgdmFsaWRhdGlvbiBjYW4ndCBkcmlmdCBhcGFydC5cclxuZnVuY3Rpb24gX3BhcnNlSW50ZXJ2YWxTKHZhbHVlLCB1bml0KSB7XHJcbiAgY29uc3QgbiA9IHBhcnNlSW50KHZhbHVlLCAxMCk7XHJcbiAgaWYgKGlzTmFOKG4pKSByZXR1cm4gbnVsbDtcclxuICBjb25zdCBzZWNvbmRzID0gdW5pdCA9PT0gJ21pbnV0ZXMnID8gbiAqIDYwIDogbjtcclxuICByZXR1cm4gc2Vjb25kcyA+PSBfVElNRUxJTkVfTUlOX0lOVEVSVkFMX1MgPyBzZWNvbmRzIDogbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IHtcclxuICBfc2NvcmVJY29uLCBfbGVycENvbG9yLCBfc2NvcmVCb3JkZXJDb2xvciwgX3NvcnRTY29yZSwgX2ZtdFZpZGVvU3RhdHVzLCBfbXNUb0htcyxcclxuICBwbHVyYWwsIGZpbml0ZU9yLCBmbXREdXJhdGlvbiwgdHJ1bmNhdGUsIGVzY0h0bWwsIGZvcm1hdEFwaUVycm9yLCBzdHJpcFJpY2hNYXJrdXAsXHJcbiAgX3BhcnNlU2VydmVyRGF0ZSwgX2ZtdERhdGUsIF9mbXRBZ28sIF9mbXRPZmZzZXQsIF9mbXRFbGFwc2VkLCBfcGFyc2VJbnRlcnZhbFMsXHJcbn07XHJcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFNoYXJlZCBjb2xvdXIgcGlja2VyLiBQcm9ncmVzc2l2ZS1lbmhhbmNlcyBhbiA8aW5wdXQ+IHRoYXQgaG9sZHNcclxuLy8gICBhIGhleCB2YWx1ZTogdGhlIG9yaWdpbmFsIGlucHV0IGJlY29tZXMgYSBoaWRkZW4gdmFsdWUtc3RvcmUgKGtlZXBpbmcgaXRzIGlkLFxyXG4vLyAgIGNsYXNzZXMsIGRhdGEtKiBhbmQgZXZlbnQgd2lyaW5nKSBhbmQgZ2FpbnMgYSBjb21wYWN0IHN3YXRjaCB0cmlnZ2VyLiBDbGlja2luZ1xyXG4vLyAgIGl0IG9wZW5zIGEgcG9wb3ZlciB3aXRoIGRpcmVjdCBoZXggZW50cnksIGEgcmVjZW50bHktdXNlZCBzdHJpcCwgYW5kIChTdGFnZSAzKVxyXG4vLyAgIGEgdXNlci1jdXJhdGVkIG5hbWVkIHBhbGV0dGUuIFJlcGxhY2VzIG5hdGl2ZSA8aW5wdXQgdHlwZT1cImNvbG9yXCI+IGF0IHRoZVxyXG4vLyAgIHNwZWFrZXItY29sb3VyIGFuZCB0aXRsZS1jYXJkIGNvbG91ciBzaXRlcy5cclxuLy8gICBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9jb2xvcnBpY2tlci5weVxyXG4vLyDilIDilIAgc2hhcmVkIGNvbG91ciBwaWNrZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG5jb25zdCBSRUNFTlRfS0VZID0gJ3l1dWNsaXAtY29sb3ItcmVjZW50JztcclxuY29uc3QgUEFMRVRURV9LRVkgPSAneXV1Y2xpcC1jb2xvci1wYWxldHRlJztcclxuY29uc3QgUkVDRU5UX01BWCA9IDg7XHJcblxyXG4vLyBQaWNrYWJsZSBzdGFydGVyIGNvbG91cnMgLSBkYXRhLCBub3QgVUkgY2hyb21lICh0aGUgY2hyb21lIGFyb3VuZCB0aGVtIGNvbWVzXHJcbi8vIGZyb20gdGhlbWUgdG9rZW5zKS4gQSBzcHJlYWQgb2YgaHVlcyBwbHVzIGJsYWNrL3doaXRlIHNvIGEgZmlyc3QtdGltZSB1c2VyIGhhc1xyXG4vLyB1c2FibGUgY2hvaWNlcyBiZWZvcmUgY3VyYXRpbmcgdGhlaXIgb3duIHBhbGV0dGUuIFRoZXNlIGxpdGVyYWxzIGFyZSB0aGUgb25lXHJcbi8vIGV4Y2VwdGlvbiB0aGUgdGVzdF91aV90aGVtZSBjb2xvdXItbGl0ZXJhbCBhbGxvd2xpc3QgY2FydmVzIG91dCBmb3IgdGhpcyBmaWxlLlxyXG5jb25zdCBTVEFSVEVSX1NXQVRDSEVTID0gW1xyXG4gICcjZmZmZmZmJywgJyMwMDAwMDAnLCAnI2UwNWM1YycsICcjZjA4MDNjJywgJyNmMGMwNjAnLCAnIzRjYWY3ZCcsXHJcbiAgJyM0ZmMzZjcnLCAnIzBhN2E5YicsICcjYjA2YWY3JywgJyNmNzdhYzAnLCAnIzllOWU5ZScsICcjN2E0YjJhJyxcclxuXTtcclxuXHJcbmZ1bmN0aW9uIF9yZWFkTGlzdChrZXkpIHtcclxuICB0cnkge1xyXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8ICdbXScpO1xyXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtdO1xyXG4gIH0gY2F0Y2ggeyByZXR1cm4gW107IH1cclxufVxyXG5cclxuZnVuY3Rpb24gX3dyaXRlTGlzdChrZXksIGxpc3QpIHtcclxuICB0cnkgeyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIEpTT04uc3RyaW5naWZ5KGxpc3QpKTsgfSBjYXRjaCB7IC8qIHN0b3JhZ2UgZGlzYWJsZWQgKi8gfVxyXG59XHJcblxyXG4vLyBBY2NlcHRzICNSR0Igb3IgI1JSR0dCQiAod2l0aCBvciB3aXRob3V0IHRoZSBsZWFkaW5nICMpIGFuZCByZXR1cm5zIGFcclxuLy8gY2Fub25pY2FsIGxvd2VyY2FzZSAjcnJnZ2JiLCBvciBudWxsIHdoZW4gdGhlIHZhbHVlIGlzbid0IGEgdmFsaWQgaGV4IGNvbG91ci5cclxuZnVuY3Rpb24gX25vcm1hbGl6ZUhleChyYXcpIHtcclxuICBpZiAodHlwZW9mIHJhdyAhPT0gJ3N0cmluZycpIHJldHVybiBudWxsO1xyXG4gIGxldCBoZXggPSByYXcudHJpbSgpO1xyXG4gIGlmIChoZXggJiYgIWhleC5zdGFydHNXaXRoKCcjJykpIGhleCA9ICcjJyArIGhleDtcclxuICBjb25zdCBzaG9ydCA9IC9eIyhbMC05YS1mQS1GXXszfSkkLy5leGVjKGhleCk7XHJcbiAgaWYgKHNob3J0KSBoZXggPSAnIycgKyBzaG9ydFsxXS5zcGxpdCgnJykubWFwKGMgPT4gYyArIGMpLmpvaW4oJycpO1xyXG4gIHJldHVybiAvXiNbMC05YS1mQS1GXXs2fSQvLnRlc3QoaGV4KSA/IGhleC50b0xvd2VyQ2FzZSgpIDogbnVsbDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3JlY29yZFJlY2VudChoZXgpIHtcclxuICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChoZXgpO1xyXG4gIGlmICghbm9ybSkgcmV0dXJuO1xyXG4gIGNvbnN0IGxpc3QgPSBfcmVhZExpc3QoUkVDRU5UX0tFWSlcclxuICAgIC5tYXAoX25vcm1hbGl6ZUhleClcclxuICAgIC5maWx0ZXIoYyA9PiBjICYmIGMgIT09IG5vcm0pO1xyXG4gIGxpc3QudW5zaGlmdChub3JtKTtcclxuICBfd3JpdGVMaXN0KFJFQ0VOVF9LRVksIGxpc3Quc2xpY2UoMCwgUkVDRU5UX01BWCkpO1xyXG59XHJcblxyXG4vLyBBIHNpbmdsZSBjbGlja2FibGUgc3dhdGNoIHNob3dpbmcgYW4gYWN0dWFsIGNob3NlbiBjb2xvdXIuIFRoZSBiYWNrZ3JvdW5kIGlzIGFcclxuLy8gZGF0YSB2YWx1ZSAodGhlIHBpY2tlZCBjb2xvdXIpLCBzZXQgYXMgYSBET00gcHJvcGVydHkgc28gaXQgbmV2ZXIgYXBwZWFycyBhcyBhXHJcbi8vIGxpdGVyYWwgaW4gc291cmNlIC0gdGhlIHN3YXRjaCdzIGJvcmRlci9mb2N1cyByaW5nIGFyZSB0aGVtZSB0b2tlbnMgdmlhIENTUy5cclxuZnVuY3Rpb24gX3N3YXRjaEJ1dHRvbihjb2xvcikge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGJ0bi50eXBlID0gJ2J1dHRvbic7XHJcbiAgYnRuLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1zd2F0Y2gnO1xyXG4gIGJ0bi5kYXRhc2V0LmNvbG9yID0gY29sb3I7XHJcbiAgYnRuLnN0eWxlLmJhY2tncm91bmQgPSBjb2xvcjtcclxuICBidG4udGl0bGUgPSBjb2xvcjtcclxuICBidG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgY29sb3IpO1xyXG4gIHJldHVybiBidG47XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zd2F0Y2hSb3coY29sb3JzKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1yb3cnO1xyXG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XHJcbiAgZm9yIChjb25zdCByYXcgb2YgY29sb3JzKSB7XHJcbiAgICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgocmF3KTtcclxuICAgIGlmICghY29sb3IgfHwgc2Vlbi5oYXMoY29sb3IpKSBjb250aW51ZTtcclxuICAgIHNlZW4uYWRkKGNvbG9yKTtcclxuICAgIHJvdy5hcHBlbmRDaGlsZChfc3dhdGNoQnV0dG9uKGNvbG9yKSk7XHJcbiAgfVxyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zZWN0aW9uTGFiZWwodGV4dCkge1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXNlY3Rpb24tbGFiZWwnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gdGV4dDtcclxuICByZXR1cm4gbGFiZWw7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCB1c2VyLWN1cmF0ZWQgbmFtZWQgcGFsZXR0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZnVuY3Rpb24gX3BhbGV0dGVFbnRyaWVzKCkge1xyXG4gIHJldHVybiBfcmVhZExpc3QoUEFMRVRURV9LRVkpXHJcbiAgICAuZmlsdGVyKGUgPT4gZSAmJiB0eXBlb2YgZS5uYW1lID09PSAnc3RyaW5nJyAmJiBfbm9ybWFsaXplSGV4KGUuY29sb3IpKVxyXG4gICAgLm1hcChlID0+ICh7IG5hbWU6IGUubmFtZSwgY29sb3I6IF9ub3JtYWxpemVIZXgoZS5jb2xvcikgfSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcGFsZXR0ZUl0ZW0obmFtZSwgY29sb3IpIHtcclxuICBjb25zdCBpdGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgaXRlbS5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1pdGVtJztcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1uYW1lJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9IG5hbWU7XHJcbiAgY29uc3QgcmVtb3ZlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgcmVtb3ZlLnR5cGUgPSAnYnV0dG9uJztcclxuICByZW1vdmUuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtcmVtb3ZlJztcclxuICByZW1vdmUuZGF0YXNldC5uYW1lID0gbmFtZTtcclxuICByZW1vdmUudGV4dENvbnRlbnQgPSAnw5cnO1xyXG4gIHJlbW92ZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBgUmVtb3ZlICR7bmFtZX1gKTtcclxuICBpdGVtLmFwcGVuZChfc3dhdGNoQnV0dG9uKGNvbG9yKSwgbGFiZWwsIHJlbW92ZSk7XHJcbiAgcmV0dXJuIGl0ZW07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZFBhbGV0dGUoZW50cmllcykge1xyXG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICB3cmFwLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlJztcclxuICBpZiAoIWVudHJpZXMubGVuZ3RoKSB7XHJcbiAgICBjb25zdCBoaW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgaGludC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGludCc7XHJcbiAgICBoaW50LnRleHRDb250ZW50ID0gJ1NhdmUgYSBjb2xvdXIgYmVsb3cgdG8gYnVpbGQgeW91ciBwYWxldHRlLic7XHJcbiAgICB3cmFwLmFwcGVuZENoaWxkKGhpbnQpO1xyXG4gICAgcmV0dXJuIHdyYXA7XHJcbiAgfVxyXG4gIGVudHJpZXMuZm9yRWFjaCgoeyBuYW1lLCBjb2xvciB9KSA9PiB3cmFwLmFwcGVuZENoaWxkKF9wYWxldHRlSXRlbShuYW1lLCBjb2xvcikpKTtcclxuICByZXR1cm4gd3JhcDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkQWRkUm93KCkge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItYWRkcm93JztcclxuICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgaW5wdXQudHlwZSA9ICd0ZXh0JztcclxuICBpbnB1dC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCc7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdtYXhsZW5ndGgnLCAnNDAnKTtcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTmFtZSBmb3IgdGhlIGN1cnJlbnQgY29sb3VyJyk7XHJcbiAgaW5wdXQucGxhY2Vob2xkZXIgPSAnTmFtZSB0aGlzIGNvbG91cic7XHJcbiAgY29uc3QgYWRkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYWRkLnR5cGUgPSAnYnV0dG9uJztcclxuICBhZGQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtYWRkJztcclxuICBhZGQudGV4dENvbnRlbnQgPSAnU2F2ZSc7XHJcbiAgcm93LmFwcGVuZChpbnB1dCwgYWRkKTtcclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG4vLyBTYXZlcyB0aGUgY29sb3VyIGN1cnJlbnRseSBpbiB0aGUgaGV4IGZpZWxkIChmYWxsaW5nIGJhY2sgdG8gdGhlIGNvbW1pdHRlZFxyXG4vLyB2YWx1ZSkgdW5kZXIgdGhlIHR5cGVkIG5hbWUsIGRlZmF1bHRpbmcgdGhlIG5hbWUgdG8gdGhlIGhleCBzdHJpbmcgaXRzZWxmLlxyXG5mdW5jdGlvbiBfYWRkUGFsZXR0ZUVudHJ5KGN0eCkge1xyXG4gIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleChjdHguaGV4RmllbGQudmFsdWUpIHx8IF9ub3JtYWxpemVIZXgoY3R4LmlucHV0LnZhbHVlKTtcclxuICBpZiAoIWNvbG9yKSByZXR1cm47XHJcbiAgY29uc3QgbmFtZUlucHV0ID0gY3R4LnBvcC5xdWVyeVNlbGVjdG9yKCcuY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCcpO1xyXG4gIGNvbnN0IG5hbWUgPSAobmFtZUlucHV0ICYmIG5hbWVJbnB1dC52YWx1ZS50cmltKCkpIHx8IGNvbG9yO1xyXG4gIGNvbnN0IG5leHQgPSBfcGFsZXR0ZUVudHJpZXMoKS5maWx0ZXIoZSA9PiBlLm5hbWUgIT09IG5hbWUpO1xyXG4gIG5leHQucHVzaCh7IG5hbWUsIGNvbG9yIH0pO1xyXG4gIF93cml0ZUxpc3QoUEFMRVRURV9LRVksIG5leHQpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3JlbW92ZVBhbGV0dGVFbnRyeShjdHgsIG5hbWUpIHtcclxuICBfd3JpdGVMaXN0KFBBTEVUVEVfS0VZLCBfcGFsZXR0ZUVudHJpZXMoKS5maWx0ZXIoZSA9PiBlLm5hbWUgIT09IG5hbWUpKTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCB2YWx1ZSkge1xyXG4gIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleCh2YWx1ZSk7XHJcbiAgdHJpZ2dlci5zdHlsZS5iYWNrZ3JvdW5kID0gY29sb3IgfHwgJ3RyYW5zcGFyZW50JztcclxuICB0cmlnZ2VyLmNsYXNzTGlzdC50b2dnbGUoJ2lzLWVtcHR5JywgIWNvbG9yKTtcclxufVxyXG5cclxuLy8gRXZlcnl0aGluZyBpbiBhIHBpY2tlciBpbnN0YW5jZSB0aGUgaGFuZGxlcnMgbmVlZCB0byByZWFjaC5cclxuZnVuY3Rpb24gX21ha2VDb250ZXh0KGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkKSB7XHJcbiAgcmV0dXJuIHsgaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2NvbW1pdChjdHgsIHJhd0hleCkge1xyXG4gIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KHJhd0hleCk7XHJcbiAgaWYgKCFub3JtKSByZXR1cm4gZmFsc2U7XHJcbiAgY3R4LmlucHV0LnZhbHVlID0gbm9ybTtcclxuICAvLyBpbnB1dCBkcml2ZXMgdGhlIGxpdmUtcHJldmlldyBoYW5kbGVycyAodGl0bGUgY2FyZCdzIG9uaW5wdXQpOyBjaGFuZ2UgZHJpdmVzXHJcbiAgLy8gdGhlIHNhdmUgaGFuZGxlcnMgKHNwZWFrZXIgY2hhbmdlLWRlbGVnYXRpb24pLiBUaGUgdHJpZ2dlciByZS1zeW5jcyBvZmYgdGhlXHJcbiAgLy8gJ2lucHV0JyBsaXN0ZW5lciB3aXJlZCBpbiBhdHRhY2goKS5cclxuICBjdHguaW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcclxuICBjdHguaW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgX3JlY29yZFJlY2VudChub3JtKTtcclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuLy8gUmVidWlsdCBlYWNoIHRpbWUgdGhlIHBvcG92ZXIgb3BlbnMgKGFuZCBhZnRlciBhIHBhbGV0dGUgYWRkL3JlbW92ZSkgc28gdGhlXHJcbi8vIHJlY2VudGx5LXVzZWQgc3RyaXAgYW5kIHNhdmVkIHBhbGV0dGUgcmVmbGVjdCB0aGUgbGF0ZXN0IHN0YXRlLiBBbGwgb2YgaXQgZ29lc1xyXG4vLyBpbiBvbmUgY29udGFpbmVyIHRoYXQgaXMgcmVwbGFjZWQgd2hvbGVzYWxlLCBzbyBub3RoaW5nIGFjY3VtdWxhdGVzLlxyXG5mdW5jdGlvbiBfcmVuZGVyU3RyaXBzKGN0eCkge1xyXG4gIGNvbnN0IHN0YWxlID0gY3R4LnBvcC5xdWVyeVNlbGVjdG9yKCcuY29sb3JwaWNrZXItZHluYW1pYycpO1xyXG4gIGlmIChzdGFsZSkgc3RhbGUucmVtb3ZlKCk7XHJcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgY29udGFpbmVyLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1keW5hbWljJztcclxuICBjb25zdCByZWNlbnQgPSBfcmVhZExpc3QoUkVDRU5UX0tFWSk7XHJcbiAgaWYgKHJlY2VudC5sZW5ndGgpIHtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdSZWNlbnRseSB1c2VkJykpO1xyXG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zd2F0Y2hSb3cocmVjZW50KSk7XHJcbiAgfVxyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdZb3VyIHBhbGV0dGUnKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9idWlsZFBhbGV0dGUoX3BhbGV0dGVFbnRyaWVzKCkpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX2J1aWxkQWRkUm93KCkpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdDb2xvdXJzJykpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc3dhdGNoUm93KFNUQVJURVJfU1dBVENIRVMpKTtcclxuICBjdHgucG9wLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcbn1cclxuXHJcbmxldCBfb3BlbkN0eCA9IG51bGw7ICAvLyB0aGUgb25lIG9wZW4gcGlja2VyIGNvbnRleHQsIG9yIG51bGxcclxuXHJcbmZ1bmN0aW9uIF9jbG9zZVBvcG92ZXIocmVmb2N1cykge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBjb25zdCB7IHBvcCwgdHJpZ2dlciB9ID0gX29wZW5DdHg7XHJcbiAgcG9wLmNsYXNzTGlzdC5yZW1vdmUoJ29wZW4nKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xyXG4gIF9vcGVuQ3R4ID0gbnVsbDtcclxuICBpZiAocmVmb2N1cykgdHJpZ2dlci5mb2N1cygpO1xyXG59XHJcblxyXG4vLyBUaGUgcG9wb3ZlciBpcyBhIGRpYWxvZywgc28gVGFiIG11c3Qgbm90IGZhbGwgdGhyb3VnaCB0byB0aGUgcGFnZSBiZWhpbmQgaXRcclxuLy8gKFdDQUcgMi40LjMpLiBDeWNsZSBmb2N1cyBhbW9uZyB0aGUgcG9wb3ZlcidzIG93biBjb250cm9sczsgdGhlIHRyaWdnZXIgc2l0c1xyXG4vLyBvdXRzaWRlIHRoZSBwb3BvdmVyIGFuZCBpcyBpbnRlbnRpb25hbGx5IGV4Y2x1ZGVkIHdoaWxlIGl0IGlzIG9wZW4uXHJcbmZ1bmN0aW9uIF9mb2N1c2FibGVzKHBvcCkge1xyXG4gIHJldHVybiBBcnJheS5mcm9tKHBvcC5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24sIGlucHV0JykpLmZpbHRlcihcclxuICAgIGVsID0+ICFlbC5kaXNhYmxlZCAmJiBlbC5vZmZzZXRQYXJlbnQgIT09IG51bGwsXHJcbiAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3RyYXBGb2N1cyhlKSB7XHJcbiAgY29uc3QgaXRlbXMgPSBfZm9jdXNhYmxlcyhfb3BlbkN0eC5wb3ApO1xyXG4gIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XHJcbiAgY29uc3QgZmlyc3QgPSBpdGVtc1swXTtcclxuICBjb25zdCBsYXN0ID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV07XHJcbiAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcclxuICBpZiAoIV9vcGVuQ3R4LnBvcC5jb250YWlucyhhY3RpdmUpKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBmaXJzdC5mb2N1cygpO1xyXG4gIH0gZWxzZSBpZiAoZS5zaGlmdEtleSAmJiBhY3RpdmUgPT09IGZpcnN0KSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBsYXN0LmZvY3VzKCk7XHJcbiAgfSBlbHNlIGlmICghZS5zaGlmdEtleSAmJiBhY3RpdmUgPT09IGxhc3QpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGZpcnN0LmZvY3VzKCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBfb3BlblBvcG92ZXIoY3R4KSB7XHJcbiAgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gIGN0eC5oZXhGaWVsZC52YWx1ZSA9IChfbm9ybWFsaXplSGV4KGN0eC5pbnB1dC52YWx1ZSkgfHwgJycpLnJlcGxhY2UoJyMnLCAnJyk7XHJcbiAgY3R4LmhleEZpZWxkLmNsYXNzTGlzdC5yZW1vdmUoJ2ludmFsaWQnKTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbiAgY3R4LnBvcC5jbGFzc0xpc3QuYWRkKCdvcGVuJyk7XHJcbiAgY3R4LnRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcclxuICBfb3BlbkN0eCA9IGN0eDtcclxuICBjdHguaGV4RmllbGQuZm9jdXMoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3dpcmVIZXhGaWVsZChjdHgpIHtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7XHJcbiAgICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChjdHguaGV4RmllbGQudmFsdWUpO1xyXG4gICAgY3R4LmhleEZpZWxkLmNsYXNzTGlzdC50b2dnbGUoJ2ludmFsaWQnLCAhbm9ybSAmJiBjdHguaGV4RmllbGQudmFsdWUudHJpbSgpICE9PSAnJyk7XHJcbiAgICBpZiAobm9ybSkgX3N5bmNUcmlnZ2VyKGN0eC50cmlnZ2VyLCBub3JtKTsgIC8vIGxpdmUgcHJldmlldywgbm8gY29tbWl0IHlldFxyXG4gIH0pO1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiBfY29tbWl0KGN0eCwgY3R4LmhleEZpZWxkLnZhbHVlKSk7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICAgIGlmIChlLmtleSAhPT0gJ0VudGVyJykgcmV0dXJuO1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgaWYgKF9jb21taXQoY3R4LCBjdHguaGV4RmllbGQudmFsdWUpKSBfY2xvc2VQb3BvdmVyKHRydWUpO1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRIZXhSb3coKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhyb3cnO1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhoYXNoJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9ICcjJztcclxuICBjb25zdCBmaWVsZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgZmllbGQudHlwZSA9ICd0ZXh0JztcclxuICBmaWVsZC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4ZmllbGQnO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnbWF4bGVuZ3RoJywgJzcnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ2F1dG9jb21wbGV0ZScsICdvZmYnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSGV4IGNvbG91ciB2YWx1ZScpO1xyXG4gIGZpZWxkLnBsYWNlaG9sZGVyID0gJ1JSR0dCQic7XHJcbiAgcm93LmFwcGVuZChsYWJlbCwgZmllbGQpO1xyXG4gIHJldHVybiB7IHJvdywgZmllbGQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gYXR0YWNoKGlucHV0KSB7XHJcbiAgaWYgKCFpbnB1dCB8fCBpbnB1dC5kYXRhc2V0LmNwQXR0YWNoZWQpIHJldHVybjtcclxuICBpbnB1dC5kYXRhc2V0LmNwQXR0YWNoZWQgPSAnMSc7XHJcbiAgY29uc3QgaW5pdGlhbCA9IF9ub3JtYWxpemVIZXgoaW5wdXQudmFsdWUpIHx8ICcnO1xyXG4gIGlucHV0LnR5cGUgPSAnaGlkZGVuJztcclxuICBpbnB1dC52YWx1ZSA9IGluaXRpYWw7XHJcblxyXG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgd3JhcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXInO1xyXG4gIGlucHV0LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHdyYXAsIGlucHV0KTtcclxuXHJcbiAgY29uc3QgdHJpZ2dlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIHRyaWdnZXIudHlwZSA9ICdidXR0b24nO1xyXG4gIHRyaWdnZXIuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXRyaWdnZXInO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWhhc3BvcHVwJywgJ3RydWUnKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0Nob29zZSBjb2xvdXInKTtcclxuXHJcbiAgY29uc3QgcG9wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcG9wLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wb3AnO1xyXG4gIHBvcC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZGlhbG9nJyk7XHJcbiAgcG9wLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDb2xvdXIgcGlja2VyJyk7XHJcbiAgY29uc3QgeyByb3c6IGhleFJvdywgZmllbGQ6IGhleEZpZWxkIH0gPSBfYnVpbGRIZXhSb3coKTtcclxuICBwb3AuYXBwZW5kQ2hpbGQoaGV4Um93KTtcclxuXHJcbiAgd3JhcC5hcHBlbmQodHJpZ2dlciwgaW5wdXQsIHBvcCk7XHJcbiAgY29uc3QgY3R4ID0gX21ha2VDb250ZXh0KGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkKTtcclxuXHJcbiAgX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIGlucHV0LnZhbHVlKTtcclxuICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCBpbnB1dC52YWx1ZSkpO1xyXG4gIHRyaWdnZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChfb3BlbkN0eCAmJiBfb3BlbkN0eC50cmlnZ2VyID09PSB0cmlnZ2VyKSBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgICBlbHNlIF9vcGVuUG9wb3ZlcihjdHgpO1xyXG4gIH0pO1xyXG4gIHBvcC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtcmVtb3ZlJyk7XHJcbiAgICBpZiAocmVtb3ZlQnRuKSB7IF9yZW1vdmVQYWxldHRlRW50cnkoY3R4LCByZW1vdmVCdG4uZGF0YXNldC5uYW1lKTsgcmV0dXJuOyB9XHJcbiAgICBpZiAoZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtYWRkJykpIHsgX2FkZFBhbGV0dGVFbnRyeShjdHgpOyByZXR1cm47IH1cclxuICAgIGNvbnN0IHN3YXRjaCA9IGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1zd2F0Y2gnKTtcclxuICAgIGlmICghc3dhdGNoKSByZXR1cm47XHJcbiAgICBfY29tbWl0KGN0eCwgc3dhdGNoLmRhdGFzZXQuY29sb3IpO1xyXG4gICAgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gIH0pO1xyXG4gIHBvcC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicgJiYgZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnKSkge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIF9hZGRQYWxldHRlRW50cnkoY3R4KTtcclxuICAgIH1cclxuICB9KTtcclxuICBfd2lyZUhleEZpZWxkKGN0eCk7XHJcbn1cclxuXHJcbi8vIENsb3NlIHRoZSBvcGVuIHBvcG92ZXIgb24gYW4gb3V0c2lkZSBjbGljayBvciBFc2NhcGUuIFJlZ2lzdGVyZWQgb25jZS5cclxuLy8gQSBjbGljayB0aGF0IHJlLXJlbmRlcnMgdGhlIHBvcG92ZXIgKFNhdmUgLyByZW1vdmUgYSBwYWxldHRlIGVudHJ5KSBkZXRhY2hlc1xyXG4vLyBpdHMgb3duIHRhcmdldCBiZWZvcmUgdGhpcyBidWJibGluZyBoYW5kbGVyIHJ1bnM7IHN1Y2ggYSB0YXJnZXQgaXMgbm8gbG9uZ2VyIGluXHJcbi8vIHRoZSBkb2N1bWVudCwgc28gc2tpcCBpdCByYXRoZXIgdGhhbiBtaXN0YWtpbmcgaXQgZm9yIGFuIG91dHNpZGUgY2xpY2suXHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGlmICghZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKGUudGFyZ2V0KSkgcmV0dXJuO1xyXG4gIGlmICghX29wZW5DdHgucG9wLnBhcmVudE5vZGUuY29udGFpbnMoZS50YXJnZXQpKSBfY2xvc2VQb3BvdmVyKCk7XHJcbn0pO1xyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHsgX2Nsb3NlUG9wb3Zlcih0cnVlKTsgcmV0dXJuOyB9XHJcbiAgaWYgKGUua2V5ID09PSAnVGFiJykgX3RyYXBGb2N1cyhlKTtcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgQ29sb3JQaWNrZXIgPSB7IGF0dGFjaCwgX25vcm1hbGl6ZUhleCwgUkVDRU5UX0tFWSwgUEFMRVRURV9LRVkgfTtcclxuIiwgIi8vIEluZnJhc3RydWN0dXJlIC0gUGFuZWxOYXYgdGFrZW92ZXIgZnJhbWV3b3JrIChub3QgYSBmZWF0dXJlIG1vZHVsZSkuXHJcbi8vICAgVXNlZCBieTogc3BsaXQuanMsIGNsaXBjcmVhdGUuanMsIGV4cG9ydGVkaXRvci5qcywgbmFtZWNvcnJlY3Rpb25zLmpzIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3BhbmVsbmF2LnB5XHJcbi8vIOKUgOKUgCBwYW5lbCBuYXZpZ2F0aW9uIGZyYW1ld29yayDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gTXVsdGktc3RlcCBmbG93cyAoU3BsaXQgRWRpdG9yLCBhbmQgZnV0dXJlIHBpY2tlcnMpIHRha2Ugb3ZlciB0aGUgbWFpblxyXG4vLyBkZXRhaWwgcGFuZWwgaW5zdGVhZCBvZiB1c2luZyBhIG1vZGFsOiBzaGFyZWQgYnJlYWRjcnVtYiwgc2hhcmVkIGRpcnR5LXN0YXRlXHJcbi8vIGRpc2NhcmQgcHJvbXB0LiBFYWNoIG9wZW4gcGFuZWwgZ2V0cyBpdHMgb3duIGNvbnRlbnQgY29udGFpbmVyIHNvIGEgZnV0dXJlXHJcbi8vIG5lc3RlZCBwYW5lbCAoZS5nLiBtYW51YWwtY2xpcCdzIHBpY2tlciBvbiB0b3Agb2YgYSByZWNvcmRpbmcgdmlldykgY2FuIGJlXHJcbi8vIHVud291bmQgb25lIGxldmVsIGF0IGEgdGltZSB3aXRob3V0IHJlLXJ1bm5pbmcgdGhlIHBhcmVudCdzIHJlbmRlcigpLlxyXG4vL1xyXG4vLyBUaGUgY29udGFpbmVyIGlzIGRlc3Ryb3llZCBvbiBjbG9zZSByaWdodCBhZnRlciBvbkNsb3NlKCkgcnVucy4gSWYgcmVuZGVyKClcclxuLy8gcmVwYXJlbnRlZCBhbiBleGlzdGluZyBzdGF0aWMgZWxlbWVudCAocmF0aGVyIHRoYW4gYnVpbGRpbmcgZnJlc2ggRE9NKSxcclxuLy8gb25DbG9zZSgpIG11c3QgbW92ZSBpdCBiYWNrIG91dCB0byBhIHN0YWJsZSwgYWx3YXlzLWluLWRvY3VtZW50IGxvY2F0aW9uIC1cclxuLy8gb3RoZXJ3aXNlIGl0IGdvZXMgd2l0aCB0aGUgY29udGFpbmVyIGFuZCBnZXRFbGVtZW50QnlJZCBjYW4ndCBmaW5kIGl0IG9uXHJcbi8vIHRoZSBuZXh0IG9wZW4uIFNlZSBzcGxpdC5qcydzIF90ZWFyZG93blNwbGl0RWRpdG9yIGZvciB0aGUgcGF0dGVybi5cclxuXHJcbmNvbnN0IF9zdGFjayA9IFtdOyAgLy8gW3tpZCwgdGl0bGUsIGlzRGlydHksIG9uQ2xvc2UsIGNvbnRhaW5lcn1dXHJcblxyXG5mdW5jdGlvbiBfcm9vdCgpICAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1yb290Jyk7IH1cclxuZnVuY3Rpb24gX2NydW1iKCkgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtYnJlYWRjcnVtYicpOyB9XHJcbmZ1bmN0aW9uIF9tb3VudCgpICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LWNvbnRlbnQnKTsgfVxyXG5mdW5jdGlvbiBfdG9wKCkgICAgIHsgcmV0dXJuIF9zdGFja1tfc3RhY2subGVuZ3RoIC0gMV0gfHwgbnVsbDsgfVxyXG5cclxuZnVuY3Rpb24gX3JlbmRlckJyZWFkY3J1bWIoKSB7XHJcbiAgY29uc3QgdG9wID0gX3RvcCgpO1xyXG4gIGNvbnN0IGNydW1iID0gX2NydW1iKCk7XHJcbiAgY3J1bWIuaW5uZXJIVE1MID0gJyc7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICBjb25zdCBiYWNrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYmFjay50eXBlID0gJ2J1dHRvbic7XHJcbiAgYmFjay5jbGFzc05hbWUgPSAnYnRuIGdob3N0JztcclxuICBiYWNrLnN0eWxlLmNzc1RleHQgPSAncGFkZGluZzo0cHggMTBweDtmb250LXNpemU6MTNweCc7XHJcbiAgYmFjay50ZXh0Q29udGVudCA9ICfihpAgQmFjayc7XHJcbiAgYmFjay5vbmNsaWNrID0gKCkgPT4gcGFuZWxOYXZDbG9zZSgpO1xyXG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIHRpdGxlLnN0eWxlLmNzc1RleHQgPSAnZm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NjAwJztcclxuICB0aXRsZS50ZXh0Q29udGVudCA9IHRvcC50aXRsZTtcclxuICBjcnVtYi5hcHBlbmQoYmFjaywgdGl0bGUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfdXBkYXRlVmlzaWJpbGl0eSgpIHtcclxuICBfc3RhY2suZm9yRWFjaCgoZW50cnksIGkpID0+IHtcclxuICAgIGVudHJ5LmNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gaSA9PT0gX3N0YWNrLmxlbmd0aCAtIDEgPyAnZmxleCcgOiAnbm9uZSc7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2T3Blbih7IGlkLCB0aXRsZSwgcmVuZGVyLCBpc0RpcnR5LCBvbkNsb3NlIH0pIHtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBjb250YWluZXIuZGF0YXNldC5wYW5lbElkID0gaWQ7XHJcbiAgY29udGFpbmVyLnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6MTZweCc7XHJcbiAgX21vdW50KCkuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxuICBfc3RhY2sucHVzaCh7XHJcbiAgICBpZCxcclxuICAgIHRpdGxlLFxyXG4gICAgaXNEaXJ0eTogaXNEaXJ0eSB8fCAoKCkgPT4gZmFsc2UpLFxyXG4gICAgb25DbG9zZTogb25DbG9zZSB8fCAoKCkgPT4ge30pLFxyXG4gICAgY29udGFpbmVyLFxyXG4gIH0pO1xyXG4gIF9yb290KCkuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcclxuICBfdXBkYXRlVmlzaWJpbGl0eSgpO1xyXG4gIF9yZW5kZXJCcmVhZGNydW1iKCk7XHJcbiAgcmVuZGVyKGNvbnRhaW5lcik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9jbG9zZVRvcCgpIHtcclxuICBjb25zdCB0b3AgPSBfc3RhY2sucG9wKCk7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICB0b3Aub25DbG9zZSgpO1xyXG4gIHRvcC5jb250YWluZXIucmVtb3ZlKCk7XHJcbiAgaWYgKF9zdGFjay5sZW5ndGggPT09IDApIHtcclxuICAgIF9yb290KCkuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICB9IGVsc2Uge1xyXG4gICAgX3VwZGF0ZVZpc2liaWxpdHkoKTtcclxuICAgIF9yZW5kZXJCcmVhZGNydW1iKCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdkNsb3NlKCkge1xyXG4gIGNvbnN0IHRvcCA9IF90b3AoKTtcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIGlmICh0b3AuaXNEaXJ0eSgpKSB7XHJcbiAgICB3aW5kb3cuc2hvd0NvbmZpcm0oXHJcbiAgICAgICdEaXNjYXJkIGNoYW5nZXM/JyxcclxuICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgY2hhbmdlcy4gQ2xvc2Ugd2l0aG91dCBzYXZpbmc/JyxcclxuICAgICAgJ0Rpc2NhcmQnLFxyXG4gICAgICBfY2xvc2VUb3AsXHJcbiAgICAgIHRydWUsXHJcbiAgICApO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBfY2xvc2VUb3AoKTtcclxufVxyXG5cclxuLy8gRm9yY2UtY2xvc2UgdGhlIHRvcG1vc3QgcGFuZWwsIGJ5cGFzc2luZyB0aGUgZGlydHkgZ2F0ZSAtIGZvciBjYWxsZXJzIHRoYXRcclxuLy8gaGF2ZSBhbHJlYWR5IGNvbmZpcm1lZCB0aGUgZGlzY2FyZCB0aHJvdWdoIHRoZWlyIG93biAoZGlmZmVyZW50bHkgd29yZGVkKVxyXG4vLyBwcm9tcHQsIGUuZy4gc3dpdGNoaW5nIHJlY29yZGluZ3Mgd2hpbGUgdGhlIFNwbGl0IEVkaXRvciBpcyBkaXJ0eS5cclxuZnVuY3Rpb24gcGFuZWxOYXZGb3JjZUNsb3NlKCkge1xyXG4gIF9jbG9zZVRvcCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdklzT3BlbihpZCkge1xyXG4gIGlmIChpZCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gX3N0YWNrLmxlbmd0aCA+IDA7XHJcbiAgcmV0dXJuIF9zdGFjay5zb21lKGVudHJ5ID0+IGVudHJ5LmlkID09PSBpZCk7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBQYW5lbE5hdiA9IHtcclxuICBvcGVuOiBwYW5lbE5hdk9wZW4sIGNsb3NlOiBwYW5lbE5hdkNsb3NlLCBmb3JjZUNsb3NlOiBwYW5lbE5hdkZvcmNlQ2xvc2UsIGlzT3BlbjogcGFuZWxOYXZJc09wZW4sXHJcbn07XHJcbiIsICIvLyBFU00gZW50cnkgcG9pbnQgLSB0aGUgc3RyYW5nbGVyLWZpZyBzZWFtIChXUzUgc3RlcCAyKS4gZXNidWlsZCBidW5kbGVzIHRoaXNcbi8vIG1vZHVsZSBncmFwaCBpbnRvIHN0YXRpYy9idW5kbGUuZXNtLmpzIChzZWUgc2NyaXB0cy9idWlsZC1lc20ubWpzLCBydW4gYnlcbi8vIGB5dXUtZGV2IGJ1bmRsZWApLiBFdmVyeXRoaW5nIHJlYWNoYWJsZSBmcm9tIGhlcmUgaXMgcmVhbCBFU00gKGltcG9ydC9leHBvcnQpO1xuLy8gdGhlIGNsYXNzaWMgZ2xvYmFsLXNjb3BlIHNjcmlwdHMgc3RpbGwgaW4gYnVuZGxlLmpzIGNhbGwgdGhlc2UgbW9kdWxlcyBhc1xuLy8gd2luZG93IGdsb2JhbHMsIHNvIHRoaXMgZW50cnkgcmUtZXhwb3NlcyBlYWNoIG1pZ3JhdGVkIG1vZHVsZSdzIHB1YmxpYyBzdXJmYWNlXG4vLyBvbiB3aW5kb3cgYXMgYSBjb21wYXRpYmlsaXR5IHNoaW0uXG4vL1xuLy8gTWlncmF0aW5nIGEgY2xhc3NpYyBjb25zdW1lciB0byBgaW1wb3J0YCBzaHJpbmtzIHRoZSBzaGltOiBvbmNlIG5vdGhpbmcgcmVhZHMgYVxuLy8gbmFtZSBvZmYgd2luZG93LCBkZWxldGUgaXRzIGxpbmUgYmVsb3cuIFdoZW4gYnVuZGxlLmpzIGlzIGVtcHR5LCB0aGlzIGZpbGUgaXNcbi8vIHRoZSB3aG9sZSBhcHAgYW5kIHRoZSBzaGltIGlzIGdvbmUuXG5pbXBvcnQgKiBhcyBmb3JtYXQgZnJvbSAnLi9mb3JtYXQuanMnO1xuaW1wb3J0IHsgQ29sb3JQaWNrZXIgfSBmcm9tICcuL2NvbG9ycGlja2VyLmpzJztcbmltcG9ydCB7IFBhbmVsTmF2IH0gZnJvbSAnLi9wYW5lbG5hdi5qcyc7XG5cbk9iamVjdC5hc3NpZ24od2luZG93LCBmb3JtYXQpO1xud2luZG93LkNvbG9yUGlja2VyID0gQ29sb3JQaWNrZXI7XG53aW5kb3cuUGFuZWxOYXYgPSBQYW5lbE5hdjtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFJQSxXQUFTLFdBQVcsT0FBTztBQUN6QixVQUFNLFFBQVEsU0FBUyxNQUFNLGlCQUFpQixTQUFTLE1BQU0sbUJBQW1CO0FBQ2hGLFdBQU8sc0JBQXNCLEtBQUs7QUFBQSxFQUNwQztBQUVBLFdBQVMsV0FBVyxJQUFJLElBQUksR0FBRztBQUM3QixVQUFNLElBQUksT0FBSyxDQUFDLFNBQVMsRUFBRSxNQUFNLEdBQUUsQ0FBQyxHQUFFLEVBQUUsR0FBRyxTQUFTLEVBQUUsTUFBTSxHQUFFLENBQUMsR0FBRSxFQUFFLEdBQUcsU0FBUyxFQUFFLE1BQU0sR0FBRSxDQUFDLEdBQUUsRUFBRSxDQUFDO0FBQy9GLFVBQU0sQ0FBQyxJQUFHLElBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxHQUFHLENBQUMsSUFBRyxJQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUU7QUFDM0MsV0FBTyxPQUFPLEtBQUssTUFBTSxNQUFJLEtBQUcsTUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLE1BQU0sTUFBSSxLQUFHLE1BQUksQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLE1BQUksS0FBRyxNQUFJLENBQUMsQ0FBQztBQUFBLEVBQ2hHO0FBRUEsV0FBUyxrQkFBa0IsT0FBTyxZQUFZO0FBQzVDLFFBQUksV0FBWSxRQUFP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
