(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // yuu_clip/web/static/state.js
  var AppState = {
    activeVideoId: null,
    activeClipId: null,
    videos: [],
    sessions: [],
    // grouped play sessions (RecordingSession rows)
    activeSessionId: null,
    // session whose detail view is open, or null
    clips: [],
    analyzeProfiles: [],
    contexts: [],
    hotWords: [],
    _hotWordsLoaded: false,
    sensitiveTerms: [],
    _sensitiveTermsLoaded: false,
    analyzeFilename: null,
    editingContextId: null,
    clipFilters: /* @__PURE__ */ new Set(),
    // active filter tokens; empty = show all
    clipKind: "clip",
    // candidate type shown: 'clip' | 'scene' (server-side filter)
    clipSearch: "",
    clipScoreMin: 0,
    videoSearch: "",
    videoSort: "recent",
    videoSortDir: "desc",
    // 'desc' = the sort option's natural order; 'asc' reverses it
    clipSortDir: "desc",
    videoFilters: /* @__PURE__ */ new Set(),
    // active video filter tokens; empty = show all
    selectedClipIds: /* @__PURE__ */ new Set(),
    lastStatusChange: null,
    // {clipId, fromStatus, timer}
    lastBulkStatusChange: null,
    // {previous: {clipId: fromStatus}, timer}
    confirmCallback: null,
    activeClipData: null,
    clipJobs: {},
    // clipId -> {op} for a per-clip async job in flight (analyze-frames), so its
    // indicator survives a renderDetail rebuild / clip switch (state, not a DOM node)
    activeMediaFilename: null,
    activeVideoData: null,
    bootRestoreDone: false,
    exportDir: null,
    reelsDir: null,
    canReveal: false
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
  window.AppState = AppState;
  Object.assign(window, format_exports);
  window.ColorPicker = ColorPicker;
  window.PanelNav = PanelNav;
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3RhdGUuanMiLCAiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgIm1haW4uZXNtLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBGZWF0dXJlLW1hcCAtIFNoYXJlZCBhcHBsaWNhdGlvbiBzdGF0ZTogdGhlIHNpbmdsZSBBcHBTdGF0ZSBvYmplY3QgZXZlcnkgZmVhdHVyZSBtb2R1bGUgcmVhZHMvd3JpdGVzLlxuLy8gICBBUEk6IG5vbmUgKGNsaWVudC1vbmx5KSDCtyBUZXN0czogY292ZXJlZCBpbmRpcmVjdGx5IGJ5IHRoZSB0ZXN0X3VpXyoucHkgc3VpdGVzXG4vLyDilIDilIAgc2hhcmVkIGFwcGxpY2F0aW9uIHN0YXRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTXV0YWJsZSBzdGF0ZSBzaGFyZWQgYWNyb3NzIGZlYXR1cmUgbW9kdWxlcy4gQ2VudHJhbGl6ZWQgaW4gb25lIGV4cGxpY2l0IG9iamVjdFxuLy8gc28gY3Jvc3MtbW9kdWxlIHJlYWRzL3dyaXRlcyBhcmUgZ3JlcHBhYmxlIGFuZCBvYnZpb3VzbHkgc2hhcmVkLCByYXRoZXIgdGhhblxuLy8gc2NhdHRlcmVkIGJhcmUgZ2xvYmFscyB0aGF0IGxvb2sgbGlrZSBtb2R1bGUgbG9jYWxzIGF0IHRoZSBjYWxsIHNpdGUuXG5leHBvcnQgY29uc3QgQXBwU3RhdGUgPSB7XG4gIGFjdGl2ZVZpZGVvSWQ6ICAgICAgIG51bGwsXG4gIGFjdGl2ZUNsaXBJZDogICAgICAgIG51bGwsXG4gIHZpZGVvczogICAgICAgICAgICAgIFtdLFxuICBzZXNzaW9uczogICAgICAgICAgICBbXSwgICAgICAgLy8gZ3JvdXBlZCBwbGF5IHNlc3Npb25zIChSZWNvcmRpbmdTZXNzaW9uIHJvd3MpXG4gIGFjdGl2ZVNlc3Npb25JZDogICAgIG51bGwsICAgICAvLyBzZXNzaW9uIHdob3NlIGRldGFpbCB2aWV3IGlzIG9wZW4sIG9yIG51bGxcbiAgY2xpcHM6ICAgICAgICAgICAgICAgW10sXG4gIGFuYWx5emVQcm9maWxlczogICAgIFtdLFxuICBjb250ZXh0czogICAgICAgICAgICBbXSxcbiAgaG90V29yZHM6ICAgICAgICAgICAgW10sXG4gIF9ob3RXb3Jkc0xvYWRlZDogICAgIGZhbHNlLFxuICBzZW5zaXRpdmVUZXJtczogICAgICBbXSxcbiAgX3NlbnNpdGl2ZVRlcm1zTG9hZGVkOiBmYWxzZSxcbiAgYW5hbHl6ZUZpbGVuYW1lOiAgICAgbnVsbCxcbiAgZWRpdGluZ0NvbnRleHRJZDogICAgbnVsbCxcbiAgY2xpcEZpbHRlcnM6ICAgICAgICAgbmV3IFNldCgpLCAgLy8gYWN0aXZlIGZpbHRlciB0b2tlbnM7IGVtcHR5ID0gc2hvdyBhbGxcbiAgY2xpcEtpbmQ6ICAgICAgICAgICAgJ2NsaXAnLCAgICAgIC8vIGNhbmRpZGF0ZSB0eXBlIHNob3duOiAnY2xpcCcgfCAnc2NlbmUnIChzZXJ2ZXItc2lkZSBmaWx0ZXIpXG4gIGNsaXBTZWFyY2g6ICAgICAgICAgICcnLFxuICBjbGlwU2NvcmVNaW46ICAgICAgICAwLFxuICB2aWRlb1NlYXJjaDogICAgICAgICAnJyxcbiAgdmlkZW9Tb3J0OiAgICAgICAgICAgJ3JlY2VudCcsXG4gIHZpZGVvU29ydERpcjogICAgICAgICdkZXNjJywgIC8vICdkZXNjJyA9IHRoZSBzb3J0IG9wdGlvbidzIG5hdHVyYWwgb3JkZXI7ICdhc2MnIHJldmVyc2VzIGl0XG4gIGNsaXBTb3J0RGlyOiAgICAgICAgICdkZXNjJyxcbiAgdmlkZW9GaWx0ZXJzOiAgICAgICAgbmV3IFNldCgpLCAgLy8gYWN0aXZlIHZpZGVvIGZpbHRlciB0b2tlbnM7IGVtcHR5ID0gc2hvdyBhbGxcbiAgc2VsZWN0ZWRDbGlwSWRzOiAgICAgbmV3IFNldCgpLFxuICBsYXN0U3RhdHVzQ2hhbmdlOiAgICBudWxsLCAvLyB7Y2xpcElkLCBmcm9tU3RhdHVzLCB0aW1lcn1cbiAgbGFzdEJ1bGtTdGF0dXNDaGFuZ2U6IG51bGwsIC8vIHtwcmV2aW91czoge2NsaXBJZDogZnJvbVN0YXR1c30sIHRpbWVyfVxuICBjb25maXJtQ2FsbGJhY2s6ICAgICBudWxsLFxuICBhY3RpdmVDbGlwRGF0YTogICAgICBudWxsLFxuICBjbGlwSm9iczogICAgICAgICAgICB7fSwgICAvLyBjbGlwSWQgLT4ge29wfSBmb3IgYSBwZXItY2xpcCBhc3luYyBqb2IgaW4gZmxpZ2h0IChhbmFseXplLWZyYW1lcyksIHNvIGl0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpbmRpY2F0b3Igc3Vydml2ZXMgYSByZW5kZXJEZXRhaWwgcmVidWlsZCAvIGNsaXAgc3dpdGNoIChzdGF0ZSwgbm90IGEgRE9NIG5vZGUpXG4gIGFjdGl2ZU1lZGlhRmlsZW5hbWU6IG51bGwsXG4gIGFjdGl2ZVZpZGVvRGF0YTogICAgIG51bGwsXG4gIGJvb3RSZXN0b3JlRG9uZTogICAgIGZhbHNlLFxuICBleHBvcnREaXI6ICAgICAgICAgICBudWxsLFxuICByZWVsc0RpcjogICAgICAgICAgICBudWxsLFxuICBjYW5SZXZlYWw6ICAgICAgICAgICBmYWxzZSxcbn07XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBQdXJlIGZvcm1hdHRlcnMgYW5kIHNjb3JlIGhlbHBlcnM6IG5vIERPTSwgbm8gZmV0Y2guIEhUTUwtZXNjYXBlLCBBUEktZXJyb3IgdGV4dCxcclxuLy8gICBkdXJhdGlvbi9kYXRlL29mZnNldCBmb3JtYXR0aW5nLCB2aWRlby1zdGF0dXMgbGFiZWxzLCBhbmQgdGhlIHNjb3JlIGNvbG9yL2ljb24gZW5jb2RpbmcuXHJcbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHlcclxuLy8g4pSA4pSAIHNjb3JlIHV0aWxzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5mdW5jdGlvbiBfc2NvcmVJY29uKHNjb3JlKSB7XHJcbiAgY29uc3QgY29sb3IgPSBzY29yZSA+PSAwLjcgPyAndmFyKC0tZ3JlZW4pJyA6IHNjb3JlID49IDAuNCA/ICd2YXIoLS13YXJuaW5nKScgOiAndmFyKC0tbXV0ZWQpJztcclxuICByZXR1cm4gYDxzcGFuIHN0eWxlPVwiY29sb3I6JHtjb2xvcn07Zm9udC1zaXplOjEwcHhcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4mIzExMDg4Ozwvc3Bhbj5gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfbGVycENvbG9yKGMxLCBjMiwgdCkge1xyXG4gIGNvbnN0IGggPSBjID0+IFtwYXJzZUludChjLnNsaWNlKDEsMyksMTYpLCBwYXJzZUludChjLnNsaWNlKDMsNSksMTYpLCBwYXJzZUludChjLnNsaWNlKDUsNyksMTYpXTtcclxuICBjb25zdCBbcjEsZzEsYjFdID0gaChjMSksIFtyMixnMixiMl0gPSBoKGMyKTtcclxuICByZXR1cm4gYHJnYigke01hdGgucm91bmQocjErKHIyLXIxKSp0KX0sJHtNYXRoLnJvdW5kKGcxKyhnMi1nMSkqdCl9LCR7TWF0aC5yb3VuZChiMSsoYjItYjEpKnQpfSlgO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc2NvcmVCb3JkZXJDb2xvcihzY29yZSwgaXNSZWplY3RlZCkge1xyXG4gIGlmIChpc1JlamVjdGVkKSByZXR1cm4gJ3ZhcigtLW11dGVkKSc7XHJcbiAgY29uc3Qgc3RvcHMgPSBbWzAsJyM2YjZiODAnXSxbMC4zLCcjNGZjM2Y3J10sWzAuNSwnIzRjYWY3ZCddLFswLjcsJyNmMGMwNjAnXSxbMS4wLCcjZjdhODVhJ11dO1xyXG4gIGZvciAobGV0IGkgPSAxOyBpIDwgc3RvcHMubGVuZ3RoOyBpKyspIHtcclxuICAgIGlmIChzY29yZSA8PSBzdG9wc1tpXVswXSkge1xyXG4gICAgICBjb25zdCB0ID0gKHNjb3JlIC0gc3RvcHNbaS0xXVswXSkgLyAoc3RvcHNbaV1bMF0gLSBzdG9wc1tpLTFdWzBdKTtcclxuICAgICAgcmV0dXJuIF9sZXJwQ29sb3Ioc3RvcHNbaS0xXVsxXSwgc3RvcHNbaV1bMV0sIHQpO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gc3RvcHNbc3RvcHMubGVuZ3RoLTFdWzFdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc29ydFNjb3JlKGNsaXApIHtcclxuICBjb25zdCBzb3J0ID0gd2luZG93Ll9jbGlwc1NvcnRQYXJhbSgpO1xyXG4gIGlmIChzb3J0ID09PSAnZnVubnknKSAgICByZXR1cm4gY2xpcC5zY29yZV9mdW5ueTtcclxuICBpZiAoc29ydCA9PT0gJ2RyYW1hdGljJykgcmV0dXJuIGNsaXAuc2NvcmVfZHJhbWF0aWM7XHJcbiAgaWYgKHNvcnQgPT09ICdhY3Rpb24nKSAgIHJldHVybiBjbGlwLnNjb3JlX2FjdGlvbjtcclxuICBpZiAoc29ydCA9PT0gJ3Zpc3VhbCcpICAgcmV0dXJuIGNsaXAuc2NvcmVfdmlzdWFsO1xyXG4gIGlmIChzb3J0ID09PSAnbGF1Z2gnKSAgICByZXR1cm4gY2xpcC5zY29yZV9sYXVnaDtcclxuICByZXR1cm4gY2xpcC5zY29yZV9vdmVyYWxsO1xyXG59XHJcblxyXG4vLyDilIDilIAgZm9ybWF0IHV0aWxzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5jb25zdCBfVklERU9fU1RBVFVTX0RJU1BMQVkgPSB7XHJcbiAgcGVuZGluZzogJ05vdCBhbmFseXplZCcsIHByb2JlZDogJ0luc3BlY3RlZCcsIGxhYmVsZWQ6ICdUcmFja3MgYXNzaWduZWQnLFxyXG4gIGV4dHJhY3Rpbmc6ICdFeHRyYWN0aW5nJywgdHJhbnNjcmliaW5nOiAnVHJhbnNjcmliaW5nJywgdHJhbnNjcmliZWQ6ICdUcmFuc2NyaWJlZCcsXHJcbiAgc2VnbWVudGVkOiAnQ2xpcHMgZ2VuZXJhdGVkJywgZG9uZTogJ0FuYWx5emVkJywgZmFpbGVkOiAnQW5hbHlzaXMgaW50ZXJydXB0ZWQnLFxyXG59O1xyXG5mdW5jdGlvbiBfZm10VmlkZW9TdGF0dXMocykgeyByZXR1cm4gX1ZJREVPX1NUQVRVU19ESVNQTEFZW3NdIHx8IHM7IH1cclxuXHJcbmZ1bmN0aW9uIF9tc1RvSG1zKG1zKSB7XHJcbiAgY29uc3QgcyA9IE1hdGguZmxvb3IobXMgLyAxMDAwKTtcclxuICBpZiAocyA8IDYwKSByZXR1cm4gYCR7c31zYDtcclxuICBjb25zdCBtID0gTWF0aC5mbG9vcihzIC8gNjApLCBzZWMgPSBzICUgNjA7XHJcbiAgaWYgKG0gPCA2MCkgcmV0dXJuIGAke219bSAke1N0cmluZyhzZWMpLnBhZFN0YXJ0KDIsICcwJyl9c2A7XHJcbiAgY29uc3QgaCA9IE1hdGguZmxvb3IobSAvIDYwKSwgbWluID0gbSAlIDYwO1xyXG4gIHJldHVybiBgJHtofWggJHtTdHJpbmcobWluKS5wYWRTdGFydCgyLCAnMCcpfW1gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwbHVyYWwoY291bnQsIHNpbmd1bGFyLCBwbHVyYWxGb3JtKSB7XHJcbiAgcmV0dXJuIGAke2NvdW50fSAke2NvdW50ID09PSAxID8gc2luZ3VsYXIgOiAocGx1cmFsRm9ybSB8fCBzaW5ndWxhciArICdzJyl9YDtcclxufVxyXG5cclxuLy8gU3RhbmRhcmQgZ3VhcmQgZm9yIGFueSBjb21wdXRlZCBudW1iZXIgc2hvd24gdG8gdGhlIHVzZXI6IHJldHVybnMgKnZhbHVlKlxyXG4vLyBvbmx5IHdoZW4gaXQgaXMgYSBmaW5pdGUgbnVtYmVyLCBvdGhlcndpc2UgYSBwbGFpbi1FbmdsaXNoICpmYWxsYmFjayouIE5hTlxyXG4vLyBvciBJbmZpbml0eSAtIHVzdWFsbHkgZnJvbSBhcml0aG1ldGljIG9uIG1pc3NpbmcvcGFydGlhbCBkYXRhIC0gbXVzdCBuZXZlclxyXG4vLyByZWFjaCB0aGUgVUkgYXMgdGhlIGxpdGVyYWwgXCJOYU5cIi9cIkluZmluaXR5XCIuIFVzZSB0aGlzIChvciBmbXREdXJhdGlvbikgYXRcclxuLy8gZXZlcnkgZGlzcGxheSBzaXRlIHRoYXQgZm9ybWF0cyBhIGRlcml2ZWQgbnVtYmVyLlxyXG5mdW5jdGlvbiBmaW5pdGVPcih2YWx1ZSwgZmFsbGJhY2sgPSAnTi9BJykge1xyXG4gIHJldHVybiBOdW1iZXIuaXNGaW5pdGUodmFsdWUpID8gdmFsdWUgOiBmYWxsYmFjaztcclxufVxyXG5cclxuLy8gSHVtYW4tcmVhZGFibGUgY2xpcC9zZWdtZW50IGxlbmd0aC4gUmV0dXJucyAqZmFsbGJhY2sqIGZvciBhIG5vbi1maW5pdGVcclxuLy8gaW5wdXQgKGUuZy4gYSBjbGlwIG1pc3NpbmcgaXRzIHN0YXJ0L2VuZCB0aW1lcykgcmF0aGVyIHRoYW4gXCJOYU4gc2VjXCIuXHJcbmZ1bmN0aW9uIGZtdER1cmF0aW9uKHNlY29uZHMsIGZhbGxiYWNrID0gJ3Vua25vd24nKSB7XHJcbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoc2Vjb25kcykpIHJldHVybiBmYWxsYmFjaztcclxuICByZXR1cm4gc2Vjb25kcyA+PSA2MCA/IGAke01hdGgucm91bmQoc2Vjb25kcyAvIDYwKX0gbWluYCA6IGAke01hdGgucm91bmQoc2Vjb25kcyl9IHNlY2A7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRydW5jYXRlKHRleHQsIG1heCkge1xyXG4gIHJldHVybiB0ZXh0Lmxlbmd0aCA+IG1heCA/IHRleHQuc2xpY2UoMCwgbWF4IC0gMSkgKyAn4oCmJyA6IHRleHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVzY0h0bWwocykge1xyXG4gIHJldHVybiBTdHJpbmcocykucmVwbGFjZSgvJi9nLCcmYW1wOycpLnJlcGxhY2UoLzwvZywnJmx0OycpLnJlcGxhY2UoLz4vZywnJmd0OycpLnJlcGxhY2UoL1wiL2csJyZxdW90OycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb3JtYXRBcGlFcnJvcihlcnIpIHtcclxuICBpZiAoIWVycikgcmV0dXJuICdVbmtub3duIGVycm9yJztcclxuICBpZiAodHlwZW9mIGVyci5kZXRhaWwgPT09ICdzdHJpbmcnKSByZXR1cm4gZXJyLmRldGFpbDtcclxuICBpZiAoQXJyYXkuaXNBcnJheShlcnIuZGV0YWlsKSkgcmV0dXJuIGVyci5kZXRhaWwubWFwKGUgPT4gZS5tc2cgfHwgSlNPTi5zdHJpbmdpZnkoZSkpLmpvaW4oJzsgJyk7XHJcbiAgaWYgKGVyci5tZXNzYWdlKSByZXR1cm4gZXJyLm1lc3NhZ2U7XHJcbiAgY29uc3Qgc3RyaW5naWZpZWQgPSBKU09OLnN0cmluZ2lmeShlcnIpO1xyXG4gIHJldHVybiAoIXN0cmluZ2lmaWVkIHx8IHN0cmluZ2lmaWVkID09PSAne30nKSA/ICdVbmtub3duIGVycm9yIChubyBkZXRhaWxzIGZyb20gc2VydmVyKScgOiBzdHJpbmdpZmllZDtcclxufVxyXG5cclxuZnVuY3Rpb24gc3RyaXBSaWNoTWFya3VwKHRleHQpIHtcclxuICByZXR1cm4gdGV4dFxyXG4gICAgLnJlcGxhY2UoL1xceDFiXFxbWzAtOTtdKlthLXpBLVpdL2csICcnKSAgLy8gQU5TSSBlc2NhcGUgY29kZXNcclxuICAgIC5yZXBsYWNlKC9cXFtcXC8/XFx3K1xcXS9nLCAnJyk7ICAgICAgICAgICAgIC8vIFJpY2ggbWFya3VwIHRhZ3NcclxufVxyXG5cclxuLy8gU2VydmVyIHRpbWVzdGFtcHMgYXJlIG5haXZlIFVUQyAoU1FMaXRlIERhdGVUaW1lIOKGkiBpc29mb3JtYXQoKSB3aXRoIG5vIHpvbmUpLlxyXG4vLyBUcmVhdCBhIHpvbmUtbGVzcyBzdHJpbmcgYXMgVVRDIHNvIGl0IGlzbid0IHBhcnNlZCBhcyB0aGUgdmlld2VyJ3MgbG9jYWwgdGltZS5cclxuZnVuY3Rpb24gX3BhcnNlU2VydmVyRGF0ZShpc28pIHtcclxuICBjb25zdCBoYXNab25lID0gL1t6Wl0kfFsrLV1cXGR7Mn06P1xcZHsyfSQvLnRlc3QoaXNvKTtcclxuICByZXR1cm4gbmV3IERhdGUoaGFzWm9uZSA/IGlzbyA6IGlzbyArICdaJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXREYXRlKGlzbykge1xyXG4gIGlmICghaXNvKSByZXR1cm4gJ25ldmVyJztcclxuICBjb25zdCBkID0gX3BhcnNlU2VydmVyRGF0ZShpc28pO1xyXG4gIHJldHVybiBkLnRvTG9jYWxlRGF0ZVN0cmluZyh1bmRlZmluZWQsIHttb250aDonc2hvcnQnLCBkYXk6J251bWVyaWMnfSkgKyAnIGF0ICcgK1xyXG4gICAgZC50b0xvY2FsZVRpbWVTdHJpbmcodW5kZWZpbmVkLCB7aG91cjonbnVtZXJpYycsIG1pbnV0ZTonMi1kaWdpdCd9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdEFnbyhpc29TdHJpbmcpIHtcclxuICBjb25zdCBkaWZmUyA9IChEYXRlLm5vdygpIC0gX3BhcnNlU2VydmVyRGF0ZShpc29TdHJpbmcpLmdldFRpbWUoKSkgLyAxMDAwO1xyXG4gIGlmIChkaWZmUyA8IDYwKSAgICByZXR1cm4gJ2p1c3Qgbm93JztcclxuICBpZiAoZGlmZlMgPCAzNjAwKSAgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyA2MCl9bSBhZ29gO1xyXG4gIGlmIChkaWZmUyA8IDg2NDAwKSByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDM2MDApfWggYWdvYDtcclxuICByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDg2NDAwKX1kIGFnb2A7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRPZmZzZXQodikge1xyXG4gIGlmICghdikgcmV0dXJuICcrMC4wJztcclxuICByZXR1cm4gKHYgPj0gMCA/ICcrJyA6ICcnKSArIHYudG9GaXhlZCgxKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdEVsYXBzZWQobXMpIHtcclxuICBjb25zdCBzID0gTWF0aC5mbG9vcihtcyAvIDEwMDApO1xyXG4gIGNvbnN0IG0gPSBNYXRoLmZsb29yKHMgLyA2MCk7XHJcbiAgcmV0dXJuIG0gPiAwID8gYCR7bX1tICR7cyAlIDYwfXNgIDogYCR7c31zYDtcclxufVxyXG5cclxuLy8g4pSA4pSAIHRpbWVsaW5lIGludGVydmFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5jb25zdCBfVElNRUxJTkVfTUlOX0lOVEVSVkFMX1MgPSAxMDtcclxuXHJcbi8vIENvbnZlcnQgYSB0aW1lbGluZSBpbnRlcnZhbCAodmFsdWUsIHVuaXQpIGludG8gc2Vjb25kczsgbnVsbCBpZiBub24tbnVtZXJpYyBvclxyXG4vLyBiZWxvdyB0aGUgbWluaW11bS4gU2hhcmVkIGJ5IHRoZSBTZXR0aW5ncyBzYXZlIHBhdGggYW5kIHRoZSBwZXItdmlkZW8gdGltZWxpbmVcclxuLy8gZ2VuZXJhdG9yIHNvIHRoZWlyIHZhbGlkYXRpb24gY2FuJ3QgZHJpZnQgYXBhcnQuXHJcbmZ1bmN0aW9uIF9wYXJzZUludGVydmFsUyh2YWx1ZSwgdW5pdCkge1xyXG4gIGNvbnN0IG4gPSBwYXJzZUludCh2YWx1ZSwgMTApO1xyXG4gIGlmIChpc05hTihuKSkgcmV0dXJuIG51bGw7XHJcbiAgY29uc3Qgc2Vjb25kcyA9IHVuaXQgPT09ICdtaW51dGVzJyA/IG4gKiA2MCA6IG47XHJcbiAgcmV0dXJuIHNlY29uZHMgPj0gX1RJTUVMSU5FX01JTl9JTlRFUlZBTF9TID8gc2Vjb25kcyA6IG51bGw7XHJcbn1cclxuXHJcbmV4cG9ydCB7XHJcbiAgX3Njb3JlSWNvbiwgX2xlcnBDb2xvciwgX3Njb3JlQm9yZGVyQ29sb3IsIF9zb3J0U2NvcmUsIF9mbXRWaWRlb1N0YXR1cywgX21zVG9IbXMsXHJcbiAgcGx1cmFsLCBmaW5pdGVPciwgZm10RHVyYXRpb24sIHRydW5jYXRlLCBlc2NIdG1sLCBmb3JtYXRBcGlFcnJvciwgc3RyaXBSaWNoTWFya3VwLFxyXG4gIF9wYXJzZVNlcnZlckRhdGUsIF9mbXREYXRlLCBfZm10QWdvLCBfZm10T2Zmc2V0LCBfZm10RWxhcHNlZCwgX3BhcnNlSW50ZXJ2YWxTLFxyXG59O1xyXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgY29sb3VyIHBpY2tlci4gUHJvZ3Jlc3NpdmUtZW5oYW5jZXMgYW4gPGlucHV0PiB0aGF0IGhvbGRzXHJcbi8vICAgYSBoZXggdmFsdWU6IHRoZSBvcmlnaW5hbCBpbnB1dCBiZWNvbWVzIGEgaGlkZGVuIHZhbHVlLXN0b3JlIChrZWVwaW5nIGl0cyBpZCxcclxuLy8gICBjbGFzc2VzLCBkYXRhLSogYW5kIGV2ZW50IHdpcmluZykgYW5kIGdhaW5zIGEgY29tcGFjdCBzd2F0Y2ggdHJpZ2dlci4gQ2xpY2tpbmdcclxuLy8gICBpdCBvcGVucyBhIHBvcG92ZXIgd2l0aCBkaXJlY3QgaGV4IGVudHJ5LCBhIHJlY2VudGx5LXVzZWQgc3RyaXAsIGFuZCAoU3RhZ2UgMylcclxuLy8gICBhIHVzZXItY3VyYXRlZCBuYW1lZCBwYWxldHRlLiBSZXBsYWNlcyBuYXRpdmUgPGlucHV0IHR5cGU9XCJjb2xvclwiPiBhdCB0aGVcclxuLy8gICBzcGVha2VyLWNvbG91ciBhbmQgdGl0bGUtY2FyZCBjb2xvdXIgc2l0ZXMuXHJcbi8vICAgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfY29sb3JwaWNrZXIucHlcclxuLy8g4pSA4pSAIHNoYXJlZCBjb2xvdXIgcGlja2VyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuY29uc3QgUkVDRU5UX0tFWSA9ICd5dXVjbGlwLWNvbG9yLXJlY2VudCc7XHJcbmNvbnN0IFBBTEVUVEVfS0VZID0gJ3l1dWNsaXAtY29sb3ItcGFsZXR0ZSc7XHJcbmNvbnN0IFJFQ0VOVF9NQVggPSA4O1xyXG5cclxuLy8gUGlja2FibGUgc3RhcnRlciBjb2xvdXJzIC0gZGF0YSwgbm90IFVJIGNocm9tZSAodGhlIGNocm9tZSBhcm91bmQgdGhlbSBjb21lc1xyXG4vLyBmcm9tIHRoZW1lIHRva2VucykuIEEgc3ByZWFkIG9mIGh1ZXMgcGx1cyBibGFjay93aGl0ZSBzbyBhIGZpcnN0LXRpbWUgdXNlciBoYXNcclxuLy8gdXNhYmxlIGNob2ljZXMgYmVmb3JlIGN1cmF0aW5nIHRoZWlyIG93biBwYWxldHRlLiBUaGVzZSBsaXRlcmFscyBhcmUgdGhlIG9uZVxyXG4vLyBleGNlcHRpb24gdGhlIHRlc3RfdWlfdGhlbWUgY29sb3VyLWxpdGVyYWwgYWxsb3dsaXN0IGNhcnZlcyBvdXQgZm9yIHRoaXMgZmlsZS5cclxuY29uc3QgU1RBUlRFUl9TV0FUQ0hFUyA9IFtcclxuICAnI2ZmZmZmZicsICcjMDAwMDAwJywgJyNlMDVjNWMnLCAnI2YwODAzYycsICcjZjBjMDYwJywgJyM0Y2FmN2QnLFxyXG4gICcjNGZjM2Y3JywgJyMwYTdhOWInLCAnI2IwNmFmNycsICcjZjc3YWMwJywgJyM5ZTllOWUnLCAnIzdhNGIyYScsXHJcbl07XHJcblxyXG5mdW5jdGlvbiBfcmVhZExpc3Qoa2V5KSB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KSB8fCAnW10nKTtcclxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbXTtcclxuICB9IGNhdGNoIHsgcmV0dXJuIFtdOyB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF93cml0ZUxpc3Qoa2V5LCBsaXN0KSB7XHJcbiAgdHJ5IHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShsaXN0KSk7IH0gY2F0Y2ggeyAvKiBzdG9yYWdlIGRpc2FibGVkICovIH1cclxufVxyXG5cclxuLy8gQWNjZXB0cyAjUkdCIG9yICNSUkdHQkIgKHdpdGggb3Igd2l0aG91dCB0aGUgbGVhZGluZyAjKSBhbmQgcmV0dXJucyBhXHJcbi8vIGNhbm9uaWNhbCBsb3dlcmNhc2UgI3JyZ2diYiwgb3IgbnVsbCB3aGVuIHRoZSB2YWx1ZSBpc24ndCBhIHZhbGlkIGhleCBjb2xvdXIuXHJcbmZ1bmN0aW9uIF9ub3JtYWxpemVIZXgocmF3KSB7XHJcbiAgaWYgKHR5cGVvZiByYXcgIT09ICdzdHJpbmcnKSByZXR1cm4gbnVsbDtcclxuICBsZXQgaGV4ID0gcmF3LnRyaW0oKTtcclxuICBpZiAoaGV4ICYmICFoZXguc3RhcnRzV2l0aCgnIycpKSBoZXggPSAnIycgKyBoZXg7XHJcbiAgY29uc3Qgc2hvcnQgPSAvXiMoWzAtOWEtZkEtRl17M30pJC8uZXhlYyhoZXgpO1xyXG4gIGlmIChzaG9ydCkgaGV4ID0gJyMnICsgc2hvcnRbMV0uc3BsaXQoJycpLm1hcChjID0+IGMgKyBjKS5qb2luKCcnKTtcclxuICByZXR1cm4gL14jWzAtOWEtZkEtRl17Nn0kLy50ZXN0KGhleCkgPyBoZXgudG9Mb3dlckNhc2UoKSA6IG51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9yZWNvcmRSZWNlbnQoaGV4KSB7XHJcbiAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgoaGV4KTtcclxuICBpZiAoIW5vcm0pIHJldHVybjtcclxuICBjb25zdCBsaXN0ID0gX3JlYWRMaXN0KFJFQ0VOVF9LRVkpXHJcbiAgICAubWFwKF9ub3JtYWxpemVIZXgpXHJcbiAgICAuZmlsdGVyKGMgPT4gYyAmJiBjICE9PSBub3JtKTtcclxuICBsaXN0LnVuc2hpZnQobm9ybSk7XHJcbiAgX3dyaXRlTGlzdChSRUNFTlRfS0VZLCBsaXN0LnNsaWNlKDAsIFJFQ0VOVF9NQVgpKTtcclxufVxyXG5cclxuLy8gQSBzaW5nbGUgY2xpY2thYmxlIHN3YXRjaCBzaG93aW5nIGFuIGFjdHVhbCBjaG9zZW4gY29sb3VyLiBUaGUgYmFja2dyb3VuZCBpcyBhXHJcbi8vIGRhdGEgdmFsdWUgKHRoZSBwaWNrZWQgY29sb3VyKSwgc2V0IGFzIGEgRE9NIHByb3BlcnR5IHNvIGl0IG5ldmVyIGFwcGVhcnMgYXMgYVxyXG4vLyBsaXRlcmFsIGluIHNvdXJjZSAtIHRoZSBzd2F0Y2gncyBib3JkZXIvZm9jdXMgcmluZyBhcmUgdGhlbWUgdG9rZW5zIHZpYSBDU1MuXHJcbmZ1bmN0aW9uIF9zd2F0Y2hCdXR0b24oY29sb3IpIHtcclxuICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBidG4udHlwZSA9ICdidXR0b24nO1xyXG4gIGJ0bi5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItc3dhdGNoJztcclxuICBidG4uZGF0YXNldC5jb2xvciA9IGNvbG9yO1xyXG4gIGJ0bi5zdHlsZS5iYWNrZ3JvdW5kID0gY29sb3I7XHJcbiAgYnRuLnRpdGxlID0gY29sb3I7XHJcbiAgYnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGNvbG9yKTtcclxuICByZXR1cm4gYnRuO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc3dhdGNoUm93KGNvbG9ycykge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcm93JztcclxuICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xyXG4gIGZvciAoY29uc3QgcmF3IG9mIGNvbG9ycykge1xyXG4gICAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KHJhdyk7XHJcbiAgICBpZiAoIWNvbG9yIHx8IHNlZW4uaGFzKGNvbG9yKSkgY29udGludWU7XHJcbiAgICBzZWVuLmFkZChjb2xvcik7XHJcbiAgICByb3cuYXBwZW5kQ2hpbGQoX3N3YXRjaEJ1dHRvbihjb2xvcikpO1xyXG4gIH1cclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc2VjdGlvbkxhYmVsKHRleHQpIHtcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1zZWN0aW9uLWxhYmVsJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9IHRleHQ7XHJcbiAgcmV0dXJuIGxhYmVsO1xyXG59XHJcblxyXG4vLyDilIDilIAgdXNlci1jdXJhdGVkIG5hbWVkIHBhbGV0dGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmZ1bmN0aW9uIF9wYWxldHRlRW50cmllcygpIHtcclxuICByZXR1cm4gX3JlYWRMaXN0KFBBTEVUVEVfS0VZKVxyXG4gICAgLmZpbHRlcihlID0+IGUgJiYgdHlwZW9mIGUubmFtZSA9PT0gJ3N0cmluZycgJiYgX25vcm1hbGl6ZUhleChlLmNvbG9yKSlcclxuICAgIC5tYXAoZSA9PiAoeyBuYW1lOiBlLm5hbWUsIGNvbG9yOiBfbm9ybWFsaXplSGV4KGUuY29sb3IpIH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3BhbGV0dGVJdGVtKG5hbWUsIGNvbG9yKSB7XHJcbiAgY29uc3QgaXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGl0ZW0uY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtaXRlbSc7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtbmFtZSc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSBuYW1lO1xyXG4gIGNvbnN0IHJlbW92ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIHJlbW92ZS50eXBlID0gJ2J1dHRvbic7XHJcbiAgcmVtb3ZlLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLXJlbW92ZSc7XHJcbiAgcmVtb3ZlLmRhdGFzZXQubmFtZSA9IG5hbWU7XHJcbiAgcmVtb3ZlLnRleHRDb250ZW50ID0gJ8OXJztcclxuICByZW1vdmUuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYFJlbW92ZSAke25hbWV9YCk7XHJcbiAgaXRlbS5hcHBlbmQoX3N3YXRjaEJ1dHRvbihjb2xvciksIGxhYmVsLCByZW1vdmUpO1xyXG4gIHJldHVybiBpdGVtO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRQYWxldHRlKGVudHJpZXMpIHtcclxuICBjb25zdCB3cmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgd3JhcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZSc7XHJcbiAgaWYgKCFlbnRyaWVzLmxlbmd0aCkge1xyXG4gICAgY29uc3QgaGludCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIGhpbnQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhpbnQnO1xyXG4gICAgaGludC50ZXh0Q29udGVudCA9ICdTYXZlIGEgY29sb3VyIGJlbG93IHRvIGJ1aWxkIHlvdXIgcGFsZXR0ZS4nO1xyXG4gICAgd3JhcC5hcHBlbmRDaGlsZChoaW50KTtcclxuICAgIHJldHVybiB3cmFwO1xyXG4gIH1cclxuICBlbnRyaWVzLmZvckVhY2goKHsgbmFtZSwgY29sb3IgfSkgPT4gd3JhcC5hcHBlbmRDaGlsZChfcGFsZXR0ZUl0ZW0obmFtZSwgY29sb3IpKSk7XHJcbiAgcmV0dXJuIHdyYXA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZEFkZFJvdygpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWFkZHJvdyc7XHJcbiAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gIGlucHV0LnR5cGUgPSAndGV4dCc7XHJcbiAgaW5wdXQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnbWF4bGVuZ3RoJywgJzQwJyk7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ05hbWUgZm9yIHRoZSBjdXJyZW50IGNvbG91cicpO1xyXG4gIGlucHV0LnBsYWNlaG9sZGVyID0gJ05hbWUgdGhpcyBjb2xvdXInO1xyXG4gIGNvbnN0IGFkZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGFkZC50eXBlID0gJ2J1dHRvbic7XHJcbiAgYWRkLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWFkZCc7XHJcbiAgYWRkLnRleHRDb250ZW50ID0gJ1NhdmUnO1xyXG4gIHJvdy5hcHBlbmQoaW5wdXQsIGFkZCk7XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuLy8gU2F2ZXMgdGhlIGNvbG91ciBjdXJyZW50bHkgaW4gdGhlIGhleCBmaWVsZCAoZmFsbGluZyBiYWNrIHRvIHRoZSBjb21taXR0ZWRcclxuLy8gdmFsdWUpIHVuZGVyIHRoZSB0eXBlZCBuYW1lLCBkZWZhdWx0aW5nIHRoZSBuYW1lIHRvIHRoZSBoZXggc3RyaW5nIGl0c2VsZi5cclxuZnVuY3Rpb24gX2FkZFBhbGV0dGVFbnRyeShjdHgpIHtcclxuICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgoY3R4LmhleEZpZWxkLnZhbHVlKSB8fCBfbm9ybWFsaXplSGV4KGN0eC5pbnB1dC52YWx1ZSk7XHJcbiAgaWYgKCFjb2xvcikgcmV0dXJuO1xyXG4gIGNvbnN0IG5hbWVJbnB1dCA9IGN0eC5wb3AucXVlcnlTZWxlY3RvcignLmNvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnKTtcclxuICBjb25zdCBuYW1lID0gKG5hbWVJbnB1dCAmJiBuYW1lSW5wdXQudmFsdWUudHJpbSgpKSB8fCBjb2xvcjtcclxuICBjb25zdCBuZXh0ID0gX3BhbGV0dGVFbnRyaWVzKCkuZmlsdGVyKGUgPT4gZS5uYW1lICE9PSBuYW1lKTtcclxuICBuZXh0LnB1c2goeyBuYW1lLCBjb2xvciB9KTtcclxuICBfd3JpdGVMaXN0KFBBTEVUVEVfS0VZLCBuZXh0KTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9yZW1vdmVQYWxldHRlRW50cnkoY3R4LCBuYW1lKSB7XHJcbiAgX3dyaXRlTGlzdChQQUxFVFRFX0tFWSwgX3BhbGV0dGVFbnRyaWVzKCkuZmlsdGVyKGUgPT4gZS5uYW1lICE9PSBuYW1lKSk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc3luY1RyaWdnZXIodHJpZ2dlciwgdmFsdWUpIHtcclxuICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgodmFsdWUpO1xyXG4gIHRyaWdnZXIuc3R5bGUuYmFja2dyb3VuZCA9IGNvbG9yIHx8ICd0cmFuc3BhcmVudCc7XHJcbiAgdHJpZ2dlci5jbGFzc0xpc3QudG9nZ2xlKCdpcy1lbXB0eScsICFjb2xvcik7XHJcbn1cclxuXHJcbi8vIEV2ZXJ5dGhpbmcgaW4gYSBwaWNrZXIgaW5zdGFuY2UgdGhlIGhhbmRsZXJzIG5lZWQgdG8gcmVhY2guXHJcbmZ1bmN0aW9uIF9tYWtlQ29udGV4dChpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCkge1xyXG4gIHJldHVybiB7IGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9jb21taXQoY3R4LCByYXdIZXgpIHtcclxuICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChyYXdIZXgpO1xyXG4gIGlmICghbm9ybSkgcmV0dXJuIGZhbHNlO1xyXG4gIGN0eC5pbnB1dC52YWx1ZSA9IG5vcm07XHJcbiAgLy8gaW5wdXQgZHJpdmVzIHRoZSBsaXZlLXByZXZpZXcgaGFuZGxlcnMgKHRpdGxlIGNhcmQncyBvbmlucHV0KTsgY2hhbmdlIGRyaXZlc1xyXG4gIC8vIHRoZSBzYXZlIGhhbmRsZXJzIChzcGVha2VyIGNoYW5nZS1kZWxlZ2F0aW9uKS4gVGhlIHRyaWdnZXIgcmUtc3luY3Mgb2ZmIHRoZVxyXG4gIC8vICdpbnB1dCcgbGlzdGVuZXIgd2lyZWQgaW4gYXR0YWNoKCkuXHJcbiAgY3R4LmlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgY3R4LmlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG4gIF9yZWNvcmRSZWNlbnQobm9ybSk7XHJcbiAgcmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbi8vIFJlYnVpbHQgZWFjaCB0aW1lIHRoZSBwb3BvdmVyIG9wZW5zIChhbmQgYWZ0ZXIgYSBwYWxldHRlIGFkZC9yZW1vdmUpIHNvIHRoZVxyXG4vLyByZWNlbnRseS11c2VkIHN0cmlwIGFuZCBzYXZlZCBwYWxldHRlIHJlZmxlY3QgdGhlIGxhdGVzdCBzdGF0ZS4gQWxsIG9mIGl0IGdvZXNcclxuLy8gaW4gb25lIGNvbnRhaW5lciB0aGF0IGlzIHJlcGxhY2VkIHdob2xlc2FsZSwgc28gbm90aGluZyBhY2N1bXVsYXRlcy5cclxuZnVuY3Rpb24gX3JlbmRlclN0cmlwcyhjdHgpIHtcclxuICBjb25zdCBzdGFsZSA9IGN0eC5wb3AucXVlcnlTZWxlY3RvcignLmNvbG9ycGlja2VyLWR5bmFtaWMnKTtcclxuICBpZiAoc3RhbGUpIHN0YWxlLnJlbW92ZSgpO1xyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnRhaW5lci5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItZHluYW1pYyc7XHJcbiAgY29uc3QgcmVjZW50ID0gX3JlYWRMaXN0KFJFQ0VOVF9LRVkpO1xyXG4gIGlmIChyZWNlbnQubGVuZ3RoKSB7XHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnUmVjZW50bHkgdXNlZCcpKTtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc3dhdGNoUm93KHJlY2VudCkpO1xyXG4gIH1cclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnWW91ciBwYWxldHRlJykpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfYnVpbGRQYWxldHRlKF9wYWxldHRlRW50cmllcygpKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9idWlsZEFkZFJvdygpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnQ29sb3VycycpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3N3YXRjaFJvdyhTVEFSVEVSX1NXQVRDSEVTKSk7XHJcbiAgY3R4LnBvcC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xyXG59XHJcblxyXG5sZXQgX29wZW5DdHggPSBudWxsOyAgLy8gdGhlIG9uZSBvcGVuIHBpY2tlciBjb250ZXh0LCBvciBudWxsXHJcblxyXG5mdW5jdGlvbiBfY2xvc2VQb3BvdmVyKHJlZm9jdXMpIHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgY29uc3QgeyBwb3AsIHRyaWdnZXIgfSA9IF9vcGVuQ3R4O1xyXG4gIHBvcC5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcclxuICBfb3BlbkN0eCA9IG51bGw7XHJcbiAgaWYgKHJlZm9jdXMpIHRyaWdnZXIuZm9jdXMoKTtcclxufVxyXG5cclxuLy8gVGhlIHBvcG92ZXIgaXMgYSBkaWFsb2csIHNvIFRhYiBtdXN0IG5vdCBmYWxsIHRocm91Z2ggdG8gdGhlIHBhZ2UgYmVoaW5kIGl0XHJcbi8vIChXQ0FHIDIuNC4zKS4gQ3ljbGUgZm9jdXMgYW1vbmcgdGhlIHBvcG92ZXIncyBvd24gY29udHJvbHM7IHRoZSB0cmlnZ2VyIHNpdHNcclxuLy8gb3V0c2lkZSB0aGUgcG9wb3ZlciBhbmQgaXMgaW50ZW50aW9uYWxseSBleGNsdWRlZCB3aGlsZSBpdCBpcyBvcGVuLlxyXG5mdW5jdGlvbiBfZm9jdXNhYmxlcyhwb3ApIHtcclxuICByZXR1cm4gQXJyYXkuZnJvbShwb3AucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uLCBpbnB1dCcpKS5maWx0ZXIoXHJcbiAgICBlbCA9PiAhZWwuZGlzYWJsZWQgJiYgZWwub2Zmc2V0UGFyZW50ICE9PSBudWxsLFxyXG4gICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF90cmFwRm9jdXMoZSkge1xyXG4gIGNvbnN0IGl0ZW1zID0gX2ZvY3VzYWJsZXMoX29wZW5DdHgucG9wKTtcclxuICBpZiAoIWl0ZW1zLmxlbmd0aCkgcmV0dXJuO1xyXG4gIGNvbnN0IGZpcnN0ID0gaXRlbXNbMF07XHJcbiAgY29uc3QgbGFzdCA9IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdO1xyXG4gIGNvbnN0IGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XHJcbiAgaWYgKCFfb3BlbkN0eC5wb3AuY29udGFpbnMoYWN0aXZlKSkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZmlyc3QuZm9jdXMoKTtcclxuICB9IGVsc2UgaWYgKGUuc2hpZnRLZXkgJiYgYWN0aXZlID09PSBmaXJzdCkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgbGFzdC5mb2N1cygpO1xyXG4gIH0gZWxzZSBpZiAoIWUuc2hpZnRLZXkgJiYgYWN0aXZlID09PSBsYXN0KSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBmaXJzdC5mb2N1cygpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gX29wZW5Qb3BvdmVyKGN0eCkge1xyXG4gIF9jbG9zZVBvcG92ZXIoKTtcclxuICBjdHguaGV4RmllbGQudmFsdWUgPSAoX25vcm1hbGl6ZUhleChjdHguaW5wdXQudmFsdWUpIHx8ICcnKS5yZXBsYWNlKCcjJywgJycpO1xyXG4gIGN0eC5oZXhGaWVsZC5jbGFzc0xpc3QucmVtb3ZlKCdpbnZhbGlkJyk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG4gIGN0eC5wb3AuY2xhc3NMaXN0LmFkZCgnb3BlbicpO1xyXG4gIGN0eC50cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XHJcbiAgX29wZW5DdHggPSBjdHg7XHJcbiAgY3R4LmhleEZpZWxkLmZvY3VzKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF93aXJlSGV4RmllbGQoY3R4KSB7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4ge1xyXG4gICAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgoY3R4LmhleEZpZWxkLnZhbHVlKTtcclxuICAgIGN0eC5oZXhGaWVsZC5jbGFzc0xpc3QudG9nZ2xlKCdpbnZhbGlkJywgIW5vcm0gJiYgY3R4LmhleEZpZWxkLnZhbHVlLnRyaW0oKSAhPT0gJycpO1xyXG4gICAgaWYgKG5vcm0pIF9zeW5jVHJpZ2dlcihjdHgudHJpZ2dlciwgbm9ybSk7ICAvLyBsaXZlIHByZXZpZXcsIG5vIGNvbW1pdCB5ZXRcclxuICB9KTtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4gX2NvbW1pdChjdHgsIGN0eC5oZXhGaWVsZC52YWx1ZSkpO1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgICBpZiAoZS5rZXkgIT09ICdFbnRlcicpIHJldHVybjtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChfY29tbWl0KGN0eCwgY3R4LmhleEZpZWxkLnZhbHVlKSkgX2Nsb3NlUG9wb3Zlcih0cnVlKTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkSGV4Um93KCkge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4cm93JztcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4aGFzaCc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSAnIyc7XHJcbiAgY29uc3QgZmllbGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gIGZpZWxkLnR5cGUgPSAndGV4dCc7XHJcbiAgZmllbGQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleGZpZWxkJztcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ21heGxlbmd0aCcsICc3Jyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdhdXRvY29tcGxldGUnLCAnb2ZmJyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hleCBjb2xvdXIgdmFsdWUnKTtcclxuICBmaWVsZC5wbGFjZWhvbGRlciA9ICdSUkdHQkInO1xyXG4gIHJvdy5hcHBlbmQobGFiZWwsIGZpZWxkKTtcclxuICByZXR1cm4geyByb3csIGZpZWxkIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGF0dGFjaChpbnB1dCkge1xyXG4gIGlmICghaW5wdXQgfHwgaW5wdXQuZGF0YXNldC5jcEF0dGFjaGVkKSByZXR1cm47XHJcbiAgaW5wdXQuZGF0YXNldC5jcEF0dGFjaGVkID0gJzEnO1xyXG4gIGNvbnN0IGluaXRpYWwgPSBfbm9ybWFsaXplSGV4KGlucHV0LnZhbHVlKSB8fCAnJztcclxuICBpbnB1dC50eXBlID0gJ2hpZGRlbic7XHJcbiAgaW5wdXQudmFsdWUgPSBpbml0aWFsO1xyXG5cclxuICBjb25zdCB3cmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIHdyYXAuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyJztcclxuICBpbnB1dC5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh3cmFwLCBpbnB1dCk7XHJcblxyXG4gIGNvbnN0IHRyaWdnZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICB0cmlnZ2VyLnR5cGUgPSAnYnV0dG9uJztcclxuICB0cmlnZ2VyLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci10cmlnZ2VyJztcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcsICd0cnVlJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDaG9vc2UgY29sb3VyJyk7XHJcblxyXG4gIGNvbnN0IHBvcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHBvcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcG9wJztcclxuICBwb3Auc2V0QXR0cmlidXRlKCdyb2xlJywgJ2RpYWxvZycpO1xyXG4gIHBvcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ29sb3VyIHBpY2tlcicpO1xyXG4gIGNvbnN0IHsgcm93OiBoZXhSb3csIGZpZWxkOiBoZXhGaWVsZCB9ID0gX2J1aWxkSGV4Um93KCk7XHJcbiAgcG9wLmFwcGVuZENoaWxkKGhleFJvdyk7XHJcblxyXG4gIHdyYXAuYXBwZW5kKHRyaWdnZXIsIGlucHV0LCBwb3ApO1xyXG4gIGNvbnN0IGN0eCA9IF9tYWtlQ29udGV4dChpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCk7XHJcblxyXG4gIF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCBpbnB1dC52YWx1ZSk7XHJcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiBfc3luY1RyaWdnZXIodHJpZ2dlciwgaW5wdXQudmFsdWUpKTtcclxuICB0cmlnZ2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoX29wZW5DdHggJiYgX29wZW5DdHgudHJpZ2dlciA9PT0gdHJpZ2dlcikgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gICAgZWxzZSBfb3BlblBvcG92ZXIoY3R4KTtcclxuICB9KTtcclxuICBwb3AuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICAgIGNvbnN0IHJlbW92ZUJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLXJlbW92ZScpO1xyXG4gICAgaWYgKHJlbW92ZUJ0bikgeyBfcmVtb3ZlUGFsZXR0ZUVudHJ5KGN0eCwgcmVtb3ZlQnRuLmRhdGFzZXQubmFtZSk7IHJldHVybjsgfVxyXG4gICAgaWYgKGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLWFkZCcpKSB7IF9hZGRQYWxldHRlRW50cnkoY3R4KTsgcmV0dXJuOyB9XHJcbiAgICBjb25zdCBzd2F0Y2ggPSBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItc3dhdGNoJyk7XHJcbiAgICBpZiAoIXN3YXRjaCkgcmV0dXJuO1xyXG4gICAgX2NvbW1pdChjdHgsIHN3YXRjaC5kYXRhc2V0LmNvbG9yKTtcclxuICAgIF9jbG9zZVBvcG92ZXIoKTtcclxuICB9KTtcclxuICBwb3AuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gICAgaWYgKGUua2V5ID09PSAnRW50ZXInICYmIGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLWlucHV0JykpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBfYWRkUGFsZXR0ZUVudHJ5KGN0eCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbiAgX3dpcmVIZXhGaWVsZChjdHgpO1xyXG59XHJcblxyXG4vLyBDbG9zZSB0aGUgb3BlbiBwb3BvdmVyIG9uIGFuIG91dHNpZGUgY2xpY2sgb3IgRXNjYXBlLiBSZWdpc3RlcmVkIG9uY2UuXHJcbi8vIEEgY2xpY2sgdGhhdCByZS1yZW5kZXJzIHRoZSBwb3BvdmVyIChTYXZlIC8gcmVtb3ZlIGEgcGFsZXR0ZSBlbnRyeSkgZGV0YWNoZXNcclxuLy8gaXRzIG93biB0YXJnZXQgYmVmb3JlIHRoaXMgYnViYmxpbmcgaGFuZGxlciBydW5zOyBzdWNoIGEgdGFyZ2V0IGlzIG5vIGxvbmdlciBpblxyXG4vLyB0aGUgZG9jdW1lbnQsIHNvIHNraXAgaXQgcmF0aGVyIHRoYW4gbWlzdGFraW5nIGl0IGZvciBhbiBvdXRzaWRlIGNsaWNrLlxyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBpZiAoIWRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyhlLnRhcmdldCkpIHJldHVybjtcclxuICBpZiAoIV9vcGVuQ3R4LnBvcC5wYXJlbnROb2RlLmNvbnRhaW5zKGUudGFyZ2V0KSkgX2Nsb3NlUG9wb3ZlcigpO1xyXG59KTtcclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7IF9jbG9zZVBvcG92ZXIodHJ1ZSk7IHJldHVybjsgfVxyXG4gIGlmIChlLmtleSA9PT0gJ1RhYicpIF90cmFwRm9jdXMoZSk7XHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IENvbG9yUGlja2VyID0geyBhdHRhY2gsIF9ub3JtYWxpemVIZXgsIFJFQ0VOVF9LRVksIFBBTEVUVEVfS0VZIH07XHJcbiIsICIvLyBJbmZyYXN0cnVjdHVyZSAtIFBhbmVsTmF2IHRha2VvdmVyIGZyYW1ld29yayAobm90IGEgZmVhdHVyZSBtb2R1bGUpLlxyXG4vLyAgIFVzZWQgYnk6IHNwbGl0LmpzLCBjbGlwY3JlYXRlLmpzLCBleHBvcnRlZGl0b3IuanMsIG5hbWVjb3JyZWN0aW9ucy5qcyDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9wYW5lbG5hdi5weVxyXG4vLyDilIDilIAgcGFuZWwgbmF2aWdhdGlvbiBmcmFtZXdvcmsg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIE11bHRpLXN0ZXAgZmxvd3MgKFNwbGl0IEVkaXRvciwgYW5kIGZ1dHVyZSBwaWNrZXJzKSB0YWtlIG92ZXIgdGhlIG1haW5cclxuLy8gZGV0YWlsIHBhbmVsIGluc3RlYWQgb2YgdXNpbmcgYSBtb2RhbDogc2hhcmVkIGJyZWFkY3J1bWIsIHNoYXJlZCBkaXJ0eS1zdGF0ZVxyXG4vLyBkaXNjYXJkIHByb21wdC4gRWFjaCBvcGVuIHBhbmVsIGdldHMgaXRzIG93biBjb250ZW50IGNvbnRhaW5lciBzbyBhIGZ1dHVyZVxyXG4vLyBuZXN0ZWQgcGFuZWwgKGUuZy4gbWFudWFsLWNsaXAncyBwaWNrZXIgb24gdG9wIG9mIGEgcmVjb3JkaW5nIHZpZXcpIGNhbiBiZVxyXG4vLyB1bndvdW5kIG9uZSBsZXZlbCBhdCBhIHRpbWUgd2l0aG91dCByZS1ydW5uaW5nIHRoZSBwYXJlbnQncyByZW5kZXIoKS5cclxuLy9cclxuLy8gVGhlIGNvbnRhaW5lciBpcyBkZXN0cm95ZWQgb24gY2xvc2UgcmlnaHQgYWZ0ZXIgb25DbG9zZSgpIHJ1bnMuIElmIHJlbmRlcigpXHJcbi8vIHJlcGFyZW50ZWQgYW4gZXhpc3Rpbmcgc3RhdGljIGVsZW1lbnQgKHJhdGhlciB0aGFuIGJ1aWxkaW5nIGZyZXNoIERPTSksXHJcbi8vIG9uQ2xvc2UoKSBtdXN0IG1vdmUgaXQgYmFjayBvdXQgdG8gYSBzdGFibGUsIGFsd2F5cy1pbi1kb2N1bWVudCBsb2NhdGlvbiAtXHJcbi8vIG90aGVyd2lzZSBpdCBnb2VzIHdpdGggdGhlIGNvbnRhaW5lciBhbmQgZ2V0RWxlbWVudEJ5SWQgY2FuJ3QgZmluZCBpdCBvblxyXG4vLyB0aGUgbmV4dCBvcGVuLiBTZWUgc3BsaXQuanMncyBfdGVhcmRvd25TcGxpdEVkaXRvciBmb3IgdGhlIHBhdHRlcm4uXHJcblxyXG5jb25zdCBfc3RhY2sgPSBbXTsgIC8vIFt7aWQsIHRpdGxlLCBpc0RpcnR5LCBvbkNsb3NlLCBjb250YWluZXJ9XVxyXG5cclxuZnVuY3Rpb24gX3Jvb3QoKSAgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtcm9vdCcpOyB9XHJcbmZ1bmN0aW9uIF9jcnVtYigpICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LWJyZWFkY3J1bWInKTsgfVxyXG5mdW5jdGlvbiBfbW91bnQoKSAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1jb250ZW50Jyk7IH1cclxuZnVuY3Rpb24gX3RvcCgpICAgICB7IHJldHVybiBfc3RhY2tbX3N0YWNrLmxlbmd0aCAtIDFdIHx8IG51bGw7IH1cclxuXHJcbmZ1bmN0aW9uIF9yZW5kZXJCcmVhZGNydW1iKCkge1xyXG4gIGNvbnN0IHRvcCA9IF90b3AoKTtcclxuICBjb25zdCBjcnVtYiA9IF9jcnVtYigpO1xyXG4gIGNydW1iLmlubmVySFRNTCA9ICcnO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgY29uc3QgYmFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGJhY2sudHlwZSA9ICdidXR0b24nO1xyXG4gIGJhY2suY2xhc3NOYW1lID0gJ2J0biBnaG9zdCc7XHJcbiAgYmFjay5zdHlsZS5jc3NUZXh0ID0gJ3BhZGRpbmc6NHB4IDEwcHg7Zm9udC1zaXplOjEzcHgnO1xyXG4gIGJhY2sudGV4dENvbnRlbnQgPSAn4oaQIEJhY2snO1xyXG4gIGJhY2sub25jbGljayA9ICgpID0+IHBhbmVsTmF2Q2xvc2UoKTtcclxuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB0aXRsZS5zdHlsZS5jc3NUZXh0ID0gJ2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjYwMCc7XHJcbiAgdGl0bGUudGV4dENvbnRlbnQgPSB0b3AudGl0bGU7XHJcbiAgY3J1bWIuYXBwZW5kKGJhY2ssIHRpdGxlKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3VwZGF0ZVZpc2liaWxpdHkoKSB7XHJcbiAgX3N0YWNrLmZvckVhY2goKGVudHJ5LCBpKSA9PiB7XHJcbiAgICBlbnRyeS5jb250YWluZXIuc3R5bGUuZGlzcGxheSA9IGkgPT09IF9zdGFjay5sZW5ndGggLSAxID8gJ2ZsZXgnIDogJ25vbmUnO1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdk9wZW4oeyBpZCwgdGl0bGUsIHJlbmRlciwgaXNEaXJ0eSwgb25DbG9zZSB9KSB7XHJcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgY29udGFpbmVyLmRhdGFzZXQucGFuZWxJZCA9IGlkO1xyXG4gIGNvbnRhaW5lci5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjE2cHgnO1xyXG4gIF9tb3VudCgpLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcbiAgX3N0YWNrLnB1c2goe1xyXG4gICAgaWQsXHJcbiAgICB0aXRsZSxcclxuICAgIGlzRGlydHk6IGlzRGlydHkgfHwgKCgpID0+IGZhbHNlKSxcclxuICAgIG9uQ2xvc2U6IG9uQ2xvc2UgfHwgKCgpID0+IHt9KSxcclxuICAgIGNvbnRhaW5lcixcclxuICB9KTtcclxuICBfcm9vdCgpLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XHJcbiAgX3VwZGF0ZVZpc2liaWxpdHkoKTtcclxuICBfcmVuZGVyQnJlYWRjcnVtYigpO1xyXG4gIHJlbmRlcihjb250YWluZXIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfY2xvc2VUb3AoKSB7XHJcbiAgY29uc3QgdG9wID0gX3N0YWNrLnBvcCgpO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgdG9wLm9uQ2xvc2UoKTtcclxuICB0b3AuY29udGFpbmVyLnJlbW92ZSgpO1xyXG4gIGlmIChfc3RhY2subGVuZ3RoID09PSAwKSB7XHJcbiAgICBfcm9vdCgpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgfSBlbHNlIHtcclxuICAgIF91cGRhdGVWaXNpYmlsaXR5KCk7XHJcbiAgICBfcmVuZGVyQnJlYWRjcnVtYigpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZDbG9zZSgpIHtcclxuICBjb25zdCB0b3AgPSBfdG9wKCk7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICBpZiAodG9wLmlzRGlydHkoKSkge1xyXG4gICAgd2luZG93LnNob3dDb25maXJtKFxyXG4gICAgICAnRGlzY2FyZCBjaGFuZ2VzPycsXHJcbiAgICAgICdZb3UgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuIENsb3NlIHdpdGhvdXQgc2F2aW5nPycsXHJcbiAgICAgICdEaXNjYXJkJyxcclxuICAgICAgX2Nsb3NlVG9wLFxyXG4gICAgICB0cnVlLFxyXG4gICAgKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgX2Nsb3NlVG9wKCk7XHJcbn1cclxuXHJcbi8vIEZvcmNlLWNsb3NlIHRoZSB0b3Btb3N0IHBhbmVsLCBieXBhc3NpbmcgdGhlIGRpcnR5IGdhdGUgLSBmb3IgY2FsbGVycyB0aGF0XHJcbi8vIGhhdmUgYWxyZWFkeSBjb25maXJtZWQgdGhlIGRpc2NhcmQgdGhyb3VnaCB0aGVpciBvd24gKGRpZmZlcmVudGx5IHdvcmRlZClcclxuLy8gcHJvbXB0LCBlLmcuIHN3aXRjaGluZyByZWNvcmRpbmdzIHdoaWxlIHRoZSBTcGxpdCBFZGl0b3IgaXMgZGlydHkuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2Rm9yY2VDbG9zZSgpIHtcclxuICBfY2xvc2VUb3AoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZJc09wZW4oaWQpIHtcclxuICBpZiAoaWQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIF9zdGFjay5sZW5ndGggPiAwO1xyXG4gIHJldHVybiBfc3RhY2suc29tZShlbnRyeSA9PiBlbnRyeS5pZCA9PT0gaWQpO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgUGFuZWxOYXYgPSB7XHJcbiAgb3BlbjogcGFuZWxOYXZPcGVuLCBjbG9zZTogcGFuZWxOYXZDbG9zZSwgZm9yY2VDbG9zZTogcGFuZWxOYXZGb3JjZUNsb3NlLCBpc09wZW46IHBhbmVsTmF2SXNPcGVuLFxyXG59O1xyXG4iLCAiLy8gRVNNIGVudHJ5IHBvaW50IC0gdGhlIHN0cmFuZ2xlci1maWcgc2VhbSAoV1M1IHN0ZXAgMikuIGVzYnVpbGQgYnVuZGxlcyB0aGlzXG4vLyBtb2R1bGUgZ3JhcGggaW50byBzdGF0aWMvYnVuZGxlLmVzbS5qcyAoc2VlIHNjcmlwdHMvYnVpbGQtZXNtLm1qcywgcnVuIGJ5XG4vLyBgeXV1LWRldiBidW5kbGVgKS4gRXZlcnl0aGluZyByZWFjaGFibGUgZnJvbSBoZXJlIGlzIHJlYWwgRVNNIChpbXBvcnQvZXhwb3J0KTtcbi8vIHRoZSBjbGFzc2ljIGdsb2JhbC1zY29wZSBzY3JpcHRzIHN0aWxsIGluIGJ1bmRsZS5qcyBjYWxsIHRoZXNlIG1vZHVsZXMgYXNcbi8vIHdpbmRvdyBnbG9iYWxzLCBzbyB0aGlzIGVudHJ5IHJlLWV4cG9zZXMgZWFjaCBtaWdyYXRlZCBtb2R1bGUncyBwdWJsaWMgc3VyZmFjZVxuLy8gb24gd2luZG93IGFzIGEgY29tcGF0aWJpbGl0eSBzaGltLlxuLy9cbi8vIE1pZ3JhdGluZyBhIGNsYXNzaWMgY29uc3VtZXIgdG8gYGltcG9ydGAgc2hyaW5rcyB0aGUgc2hpbTogb25jZSBub3RoaW5nIHJlYWRzIGFcbi8vIG5hbWUgb2ZmIHdpbmRvdywgZGVsZXRlIGl0cyBsaW5lIGJlbG93LiBXaGVuIGJ1bmRsZS5qcyBpcyBlbXB0eSwgdGhpcyBmaWxlIGlzXG4vLyB0aGUgd2hvbGUgYXBwIGFuZCB0aGUgc2hpbSBpcyBnb25lLlxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCAqIGFzIGZvcm1hdCBmcm9tICcuL2Zvcm1hdC5qcyc7XG5pbXBvcnQgeyBDb2xvclBpY2tlciB9IGZyb20gJy4vY29sb3JwaWNrZXIuanMnO1xuaW1wb3J0IHsgUGFuZWxOYXYgfSBmcm9tICcuL3BhbmVsbmF2LmpzJztcblxud2luZG93LkFwcFN0YXRlID0gQXBwU3RhdGU7XG5PYmplY3QuYXNzaWduKHdpbmRvdywgZm9ybWF0KTtcbndpbmRvdy5Db2xvclBpY2tlciA9IENvbG9yUGlja2VyO1xud2luZG93LlBhbmVsTmF2ID0gUGFuZWxOYXY7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7OztBQU1PLE1BQU0sV0FBVztBQUFBLElBQ3RCLGVBQXFCO0FBQUEsSUFDckIsY0FBcUI7QUFBQSxJQUNyQixRQUFxQixDQUFDO0FBQUEs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
