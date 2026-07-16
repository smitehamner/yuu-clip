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

  // yuu_clip/web/static/jobs.js
  var jobs_exports = {};
  __export(jobs_exports, {
    FRAMES_STEPS: () => FRAMES_STEPS,
    INGEST_STEPS: () => INGEST_STEPS,
    JOB_STAGES: () => JOB_STAGES,
    SCORE_STEPS: () => SCORE_STEPS,
    _blockedByAnalyze: () => _blockedByAnalyze,
    _clearActiveStream: () => _clearActiveStream,
    _driveStepFromMarker: () => _driveStepFromMarker,
    _openSSE: () => _openSSE,
    _pollThermalStatus: () => _pollThermalStatus,
    _renderStepPill: () => _renderStepPill,
    _setActiveStream: () => _setActiveStream,
    _setPausedUIFromStatus: () => _setPausedUIFromStatus,
    _stepPillLabel: () => _stepPillLabel,
    _supersedeActiveStream: () => _supersedeActiveStream,
    _tickJobTimer: () => _tickJobTimer,
    _waitWhileAnalyzePaused: () => _waitWhileAnalyzePaused,
    applyJobBlockedState: () => applyJobBlockedState,
    cancelJob: () => cancelJob,
    endJobUI: () => endJobUI,
    parseProgress: () => parseProgress,
    setJobCancel: () => setJobCancel,
    startJobUI: () => startJobUI,
    streamSSE: () => streamSSE,
    togglePauseJob: () => togglePauseJob,
    updateJobUI: () => updateJobUI
  });
  var _jobStepDefs = [];
  var _activeES = null;
  var _jobStartTime = 0;
  var _activeStepIdx = -1;
  var _stepStartTime = 0;
  var _stepProgress = {};
  var _stepRateAnchor = {};
  for (const [name, get, set] of [
    ["_jobStepDefs", () => _jobStepDefs, (v) => {
      _jobStepDefs = v;
    }],
    ["_activeES", () => _activeES, (v) => {
      _activeES = v;
    }],
    ["_jobStartTime", () => _jobStartTime, (v) => {
      _jobStartTime = v;
    }],
    ["_activeStepIdx", () => _activeStepIdx, (v) => {
      _activeStepIdx = v;
    }],
    ["_stepStartTime", () => _stepStartTime, (v) => {
      _stepStartTime = v;
    }],
    ["_stepProgress", () => _stepProgress, (v) => {
      _stepProgress = v;
    }],
    ["_stepRateAnchor", () => _stepRateAnchor, (v) => {
      _stepRateAnchor = v;
    }]
  ]) {
    Object.defineProperty(window, name, { get, set, configurable: true });
  }
  var INGEST_STEPS = [
    { label: "Extract", stage: "extract", patterns: ["Extracting audio"], estMatch: ["extract audio"], progressPattern: /Track (\d+)\/(\d+)/ },
    { label: "Transcribe", stage: "transcribe", patterns: ["Transcribing"], estMatch: ["transcribe", "load captions"], progressPattern: /Track (\d+)\/(\d+)/, waitPattern: /Waiting for the speech-to-text model/ },
    { label: "Speakers", stage: "speakers", patterns: ["Detecting speakers"], estMatch: ["speaker labels"] },
    { label: "Generate Clips", stage: "generate_clips", patterns: ["Generating clip"] },
    { label: "Energy", stage: "energy", patterns: ["Computing audio energy"], estMatch: ["audio energy"] },
    { label: "Scenes", stage: "scenes", patterns: ["Detecting scene"], estMatch: ["scene detection"] },
    { label: "Score", stage: "score", patterns: ["Scoring clips"], estMatch: ["llm scoring"], progressPattern: /Scoring (\d+)\/(\d+)/ }
  ];
  var SCORE_STEPS = [
    { label: "Energy", stage: "energy", patterns: ["Computing audio energy"] },
    { label: "Scenes", stage: "scenes", patterns: ["Detecting scene"] },
    { label: "Scoring", stage: "score", patterns: ["Scoring clips"], progressPattern: /Scoring (\d+)\/(\d+)/ }
  ];
  var FRAMES_STEPS = [
    { label: "Sample", stage: "frames_sample", patterns: [] },
    { label: "Describe", stage: "frames_describe", patterns: [] }
  ];
  var _PROGRESS_PREFIX = "@@PROGRESS ";
  var JOB_STAGES = /* @__PURE__ */ new Set([
    "extract",
    "transcribe",
    "speakers",
    "generate_clips",
    "energy",
    "scenes",
    "score",
    "frames_sample",
    "frames_describe"
  ]);
  function parseProgress(line) {
    if (!line || !line.startsWith(_PROGRESS_PREFIX)) return null;
    let payload;
    try {
      payload = JSON.parse(line.slice(_PROGRESS_PREFIX.length));
    } catch (e) {
      return null;
    }
    if (!payload || typeof payload !== "object" || !JOB_STAGES.has(payload.stage)) return null;
    return payload;
  }
  var _stepWaitingMsg = {};
  var _jobActive = false;
  var _activeJobCleanup = null;
  var _jobTimer = null;
  var _jobHideTimer = null;
  var _jobPausable = false;
  var _jobPaused = false;
  var _jobThermalPollTimer = null;
  var _lastGpuState = "unavailable";
  function _estimateHmsFor(stepDef) {
    const steps = AppState.lastEstimateSteps;
    if (!steps || !stepDef.estMatch) return null;
    const match = steps.find(
      (es) => stepDef.estMatch.some((key) => (es.name || "").toLowerCase().includes(key))
    );
    return match ? match.hms : null;
  }
  function _setJobBlockedButtons(disabled) {
    document.querySelectorAll("[data-job-blocked]").forEach((b) => {
      b.disabled = disabled;
      b.title = disabled ? "Another job is running - wait for it to finish or cancel it" : "";
    });
  }
  function applyJobBlockedState() {
    _setJobBlockedButtons(_jobActive);
  }
  function startJobUI(stepDefs, jobLabel, cancellable = false, pausable = false) {
    _jobActive = true;
    _jobStepDefs = stepDefs;
    _activeStepIdx = -1;
    _jobStartTime = Date.now();
    _stepStartTime = Date.now();
    _stepProgress = {};
    _stepRateAnchor = {};
    _stepWaitingMsg = {};
    _jobPausable = pausable;
    _jobPaused = false;
    _activeCancel = _ANALYZE_CANCEL;
    if (_jobTimer) clearInterval(_jobTimer);
    _jobTimer = setInterval(_tickJobTimer, 1e3);
    if (_jobHideTimer) {
      clearTimeout(_jobHideTimer);
      _jobHideTimer = null;
    }
    document.getElementById("job-steps").innerHTML = `<span style="color:var(--muted);margin-right:4px">${escHtml(jobLabel)}</span>` + stepDefs.map((s, i) => {
      const est = _estimateHmsFor(s);
      const title = est ? ` title="Estimated: ${escHtml(est)}"` : "";
      return `<span class="step" id="step-${i}"${title}>${s.label}</span>`;
    }).join("");
    document.getElementById("job-status").classList.add("visible");
    document.getElementById("header-spacer").style.display = "none";
    document.querySelectorAll("#btn-analyze,#btn-score").forEach((b) => b.disabled = true);
    const analyzeBtn = document.getElementById("btn-analyze");
    if (analyzeBtn) analyzeBtn.title = "A job is already running";
    _setJobBlockedButtons(true);
    document.getElementById("btn-cancel-job").style.display = cancellable ? "" : "none";
    _renderPauseUI();
    if (_jobThermalPollTimer) clearInterval(_jobThermalPollTimer);
    if (pausable) {
      _lastGpuState = "unavailable";
      document.getElementById("job-gpu-temp").style.display = "none";
      _pollThermalStatus();
      _jobThermalPollTimer = setInterval(_pollThermalStatus, 5e3);
    }
    if (window._renderClipFilterCounts) _renderClipFilterCounts();
  }
  async function _pollThermalStatus() {
    const status = await fetch("/api/status").then((r) => r.json()).catch(() => null);
    if (!status) return;
    const readout = document.getElementById("job-gpu-temp");
    if (readout) {
      if (status.gpu_temp_c == null) {
        readout.style.display = "none";
      } else {
        readout.style.display = "";
        readout.className = "gpu-temp-readout" + (status.gpu_state === "ok" ? "" : ` ${status.gpu_state}`);
        readout.textContent = `GPU ${Math.round(status.gpu_temp_c)}°C`;
      }
    }
    if (status.gpu_state === "warn" && _lastGpuState !== "warn" && _lastGpuState !== "pause") {
      const next = status.thermal_autopause_enabled ? `Analysis will auto-pause if it reaches ${Math.round(status.thermal_pause_c)}°C.` : `Auto-pause is off - pause the job manually if it keeps climbing.`;
      window.showToast(`GPU running hot - ${Math.round(status.gpu_temp_c)}°C. ${next}`, "warning");
    }
    if (status.gpu_state === "pause" && _lastGpuState !== "pause") {
      _jobPaused = true;
      _renderPauseUI();
      window.showToast(`Auto-paused: GPU reached ${Math.round(status.gpu_temp_c)}°C - will hold before the next video`, "warning", {
        durationMs: 2e4,
        action: { label: "Resume now", onClick: togglePauseJob }
      });
    }
    _lastGpuState = status.gpu_state;
  }
  function _renderPauseUI() {
    const btn = document.getElementById("btn-pause-job");
    const badge = document.getElementById("job-paused-badge");
    if (!btn || !badge) return;
    btn.style.display = _jobPausable ? "" : "none";
    btn.textContent = _jobPaused ? "Resume" : "Pause after current video";
    badge.style.display = _jobPaused ? "" : "none";
  }
  function _setPausedUIFromStatus(paused) {
    _jobPaused = !!paused;
    _renderPauseUI();
  }
  async function togglePauseJob() {
    const btn = document.getElementById("btn-pause-job");
    const wantPause = !_jobPaused;
    btn.disabled = true;
    try {
      const res = await fetch(`/api/analyze/${wantPause ? "pause" : "resume"}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.showToast(formatApiError(data) || `Could not ${wantPause ? "pause" : "resume"}`, "error");
        return;
      }
      if (data.status === "no-op") {
        window.showToast(data.message || "No analysis is running.", "info");
        return;
      }
      _jobPaused = wantPause;
      _renderPauseUI();
      window.showToast(wantPause ? "Will pause before the next video" : "Resumed", "info");
    } catch (err) {
      window.showToast(window.netErrMsg(err), "error");
    } finally {
      btn.disabled = false;
    }
  }
  function _activateStep(idx) {
    const prevStepIdx = _activeStepIdx;
    for (let j = 0; j < idx; j++) {
      const el2 = document.getElementById(`step-${j}`);
      if (el2) {
        el2.className = "step done";
        el2.style.backgroundImage = "";
        el2.textContent = "✓";
        el2.title = _jobStepDefs[j].label;
      }
    }
    const el = document.getElementById(`step-${idx}`);
    if (el) {
      el.className = "step active";
      _activeStepIdx = idx;
    }
    if (_activeStepIdx !== prevStepIdx) {
      _stepStartTime = Date.now();
      _debouncedSidebarRefresh();
      _debouncedClipListRefresh();
    }
  }
  function _setStepProgress(idx, current, total) {
    delete _stepWaitingMsg[idx];
    _stepProgress[idx] = { current, total };
    if (!_stepRateAnchor[idx]) _stepRateAnchor[idx] = { t: Date.now(), current };
    _renderStepPill(idx);
    _debouncedClipListRefresh();
  }
  function updateJobUI(line) {
    _jobStepDefs.forEach((s, i) => {
      if (s.patterns.some((p) => line.includes(p))) _activateStep(i);
    });
    const activeDef = _jobStepDefs[_activeStepIdx];
    if (activeDef && activeDef.waitPattern && activeDef.waitPattern.test(line)) {
      _stepWaitingMsg[_activeStepIdx] = "waiting for the speech model to finish downloading";
      _renderStepPill(_activeStepIdx);
    }
    if (activeDef && activeDef.progressPattern) {
      const m = line.match(activeDef.progressPattern);
      if (m) _setStepProgress(_activeStepIdx, parseInt(m[1], 10), parseInt(m[2], 10));
    }
    if (window._syncAnalysisLivePanel) _syncAnalysisLivePanel();
  }
  function _driveStepFromMarker(marker) {
    const idx = _jobStepDefs.findIndex((s) => s.stage === marker.stage);
    if (idx < 0) return;
    _activateStep(idx);
    if (typeof marker.done === "number" && typeof marker.total === "number" && marker.total > 0) {
      _setStepProgress(idx, marker.done, marker.total);
    }
    if (window._syncAnalysisLivePanel) _syncAnalysisLivePanel();
  }
  var _sidebarRefreshTimer = null;
  function _debouncedSidebarRefresh() {
    if (_sidebarRefreshTimer) return;
    _sidebarRefreshTimer = setTimeout(() => {
      _sidebarRefreshTimer = null;
      window.loadVideos();
    }, 1200);
  }
  var _clipListRefreshTimer = null;
  function _debouncedClipListRefresh() {
    if (_clipListRefreshTimer) return;
    _clipListRefreshTimer = setTimeout(async () => {
      _clipListRefreshTimer = null;
      if (!AppState.activeVideoId || !AppState.analyzeFilename) return;
      const analyzing = AppState.videos.find((v) => v.filename === AppState.analyzeFilename);
      if (!analyzing || analyzing.id !== AppState.activeVideoId) return;
      AppState.clips = await fetch(window._clipsListUrl(AppState.activeVideoId)).then((r) => r.json());
      window._renderClips();
    }, 1200);
  }
  function _stepPillLabel(idx) {
    const def = _jobStepDefs[idx];
    if (!def) return { text: "", pct: null };
    const waiting = _stepWaitingMsg[idx];
    if (waiting) return { text: `${def.label} · ${waiting}`, pct: null };
    const elapsedMs = Date.now() - _stepStartTime;
    const progress = _stepProgress[idx];
    if (!progress || !progress.current) {
      const est = _estimateHmsFor(def);
      return {
        text: est ? `${def.label} · ${_fmtElapsed(elapsedMs)} (~${est})` : `${def.label} · ${_fmtElapsed(elapsedMs)}`,
        pct: null
      };
    }
    const { current, total } = progress;
    const pct = Math.round(current / total * 100);
    const anchor = _stepRateAnchor[idx];
    let eta = "";
    if (anchor && current > anchor.current) {
      const msPerItem = (Date.now() - anchor.t) / (current - anchor.current);
      const remainingMs = msPerItem * (total - current);
      if (isFinite(remainingMs) && remainingMs >= 0) eta = ` (~${_fmtElapsed(remainingMs)} left)`;
    }
    return {
      text: `${def.label} · ${current}/${total} (${pct}%) · ${_fmtElapsed(elapsedMs)}${eta}`,
      pct
    };
  }
  function _renderStepPill(idx) {
    const el = document.getElementById(`step-${idx}`);
    if (!el || !el.classList.contains("active")) return;
    const { text, pct } = _stepPillLabel(idx);
    el.textContent = text;
    el.style.backgroundImage = pct != null ? `linear-gradient(to right, var(--green) ${pct}%, var(--accent) ${pct}%)` : "";
  }
  function _tickJobTimer() {
    if (window._syncAnalysisLivePanel) _syncAnalysisLivePanel();
    if (_activeStepIdx < 0) return;
    _renderStepPill(_activeStepIdx);
  }
  function endJobUI() {
    if (_jobTimer) {
      clearInterval(_jobTimer);
      _jobTimer = null;
    }
    _jobStepDefs.forEach((s, i) => {
      const el = document.getElementById(`step-${i}`);
      if (el) {
        el.className = "step done";
        el.style.backgroundImage = "";
        el.textContent = "✓";
        el.title = s.label;
      }
    });
    document.getElementById("btn-cancel-job").style.display = "none";
    _jobPausable = false;
    _jobPaused = false;
    _renderPauseUI();
    if (_jobThermalPollTimer) {
      clearInterval(_jobThermalPollTimer);
      _jobThermalPollTimer = null;
    }
    const gpuTemp = document.getElementById("job-gpu-temp");
    if (gpuTemp) gpuTemp.style.display = "none";
    _jobActive = false;
    _jobHideTimer = setTimeout(() => {
      _jobHideTimer = null;
      document.getElementById("job-status").classList.remove("visible");
      document.getElementById("header-spacer").style.display = "";
      document.querySelectorAll("#btn-analyze,#btn-score").forEach((b) => b.disabled = false);
      const analyzeBtn = document.getElementById("btn-analyze");
      if (analyzeBtn) analyzeBtn.title = "";
      _setJobBlockedButtons(false);
      const totalApproved = (AppState.videos || []).reduce((n, v) => n + v.approved, 0);
      window._updateDemoButton(totalApproved);
      if (window._renderClipFilterCounts) _renderClipFilterCounts();
    }, 2e3);
  }
  function _openSSE(url, onLine, onDone, onError, opts = {}) {
    const ctrl = new AbortController();
    const handle = { close: () => ctrl.abort() };
    fetch(url, { signal: ctrl.signal, ...opts }).then(async (res) => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        onError(formatApiError(errData) || `Server error ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (!ctrl.signal.aborted) onError("Stream ended without a completion signal");
            return;
          }
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const msg = JSON.parse(line.slice(6));
            const isDone = msg === "__DONE__" || msg && typeof msg === "object" && msg.type === "__DONE__";
            if (isDone) {
              onDone(msg);
              return;
            }
            onLine(msg);
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) onError("Connection lost - server disconnected");
      }
    }).catch((err) => {
      if (!ctrl.signal.aborted) onError(window.netErrMsg(err));
    });
    return handle;
  }
  function _setActiveStream(handle, cleanup = null) {
    _activeES = handle;
    _activeJobCleanup = cleanup;
  }
  function _clearActiveStream(handle) {
    if (_activeES === handle) {
      _activeES = null;
      _activeJobCleanup = null;
    }
  }
  function _supersedeActiveStream() {
    if (_activeES) {
      _activeES.close();
      _activeES = null;
    }
    if (_activeJobCleanup) {
      const cleanup = _activeJobCleanup;
      _activeJobCleanup = null;
      cleanup();
    }
  }
  function _blockedByAnalyze(actionLabel) {
    if (!AppState.analyzeFilename) return false;
    window.showToast(`Wait for the current analysis to finish before you ${actionLabel}.`, "warning");
    return true;
  }
  function streamSSE(url, onDone, stepDefs, jobLabel, cancellable = false, onLine = null, pausable = false, opts = {}, onError = null) {
    _supersedeActiveStream();
    if (stepDefs) startJobUI(stepDefs, jobLabel, cancellable, pausable);
    const handle = _openSSE(
      url,
      (text) => {
        const marker = stepDefs ? parseProgress(text) : null;
        if (marker) {
          _driveStepFromMarker(marker);
          return;
        }
        window.appendLog(text);
        if (onLine) onLine(text);
        if (stepDefs) updateJobUI(text);
      },
      () => {
        _clearActiveStream(handle);
        if (stepDefs) endJobUI();
        if (onDone) onDone();
      },
      (errMsg) => {
        _clearActiveStream(handle);
        window.appendLog(`[${errMsg}]`);
        window.showToast(errMsg, "error");
        window.SoundFx.play("error");
        if (stepDefs) endJobUI();
        if (onError) onError(errMsg);
        window.loadVideos();
      },
      opts
    );
    _setActiveStream(handle, stepDefs ? endJobUI : null);
  }
  async function _waitWhileAnalyzePaused() {
    let toasted = false;
    while (true) {
      const status = await fetch("/api/status").then((r) => r.json()).catch(() => null);
      if (!status || !status.pause_flag_set) return;
      if (!toasted) {
        window.showToast("Paused - will hold before the next segment", "info");
        toasted = true;
      }
      await new Promise((resolve) => setTimeout(resolve, 3e3));
    }
  }
  var _ANALYZE_CANCEL = {
    url: "/api/analyze/cancel",
    title: "Cancel analysis?",
    body: "All progress for this recording will be lost and you will need to analyze it again.",
    confirm: "Cancel Analysis",
    logMsg: "[Analysis cancelled]"
  };
  var _activeCancel = _ANALYZE_CANCEL;
  function setJobCancel(cfg) {
    _activeCancel = cfg || _ANALYZE_CANCEL;
  }
  function cancelJob() {
    window.showConfirm(
      _activeCancel.title,
      _activeCancel.body,
      _activeCancel.confirm,
      _doCancelJob,
      true
    );
  }
  async function _doCancelJob() {
    const cancel = _activeCancel;
    try {
      const res = await fetch(cancel.url, { method: "POST" });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
    } catch (err) {
      window.showToast(`Could not cancel - ${err.message}`, "error");
      return;
    }
    _supersedeActiveStream();
    window.appendLog(cancel.logMsg);
    endJobUI();
    if (cancel.onCancel) cancel.onCancel();
    AppState.analyzeFilename = null;
    window.loadVideos();
  }
  document.getElementById("btn-pause-job").addEventListener("click", togglePauseJob);
  document.getElementById("btn-cancel-job").addEventListener("click", cancelJob);

  // yuu_clip/web/static/preview.js
  function _buildMediaUrl(videoId, kind, absPath) {
    if (window.electronAPI?.mediaProtocol && absPath) {
      const normalized = absPath.replace(/\\/g, "/");
      return `yuu-media://media/${encodeURIComponent(normalized)}`;
    }
    return `/api/videos/${videoId}/${kind}`;
  }
  function setupRecordingPreview(videoEl, badgeEl, videoId, { autoBuild = false, isCurrent = () => true, startS = null, endS = null, sourcePath = null } = {}) {
    videoEl.src = _buildMediaUrl(videoId, "source", sourcePath);
    if (startS != null) {
      videoEl.addEventListener("loadedmetadata", () => {
        try {
          videoEl.currentTime = startS;
        } catch (_) {
        }
      }, { once: true });
    }
    if (endS != null) {
      videoEl.addEventListener("timeupdate", () => {
        if (videoEl.currentTime >= endS) videoEl.pause();
      });
    }
    const buildFn = () => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS);
    _setPreviewBadge(badgeEl, "original", null, autoBuild ? null : buildFn);
    fetch(`/api/videos/${videoId}/proxy-status`).then((r) => r.ok ? r.json() : null).then((status) => {
      if (!isCurrent() || !status) return;
      if (status.available) _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS, status.proxy_path);
      else if (autoBuild || status.generating) buildFn();
    }).catch(() => {
    });
  }
  function _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS = null, proxyPath = null) {
    if (!isCurrent()) return;
    const resumeAt = videoEl.currentTime || startS || 0;
    const wasPlaying = !videoEl.paused && !videoEl.ended;
    videoEl.src = _buildMediaUrl(videoId, "proxy", proxyPath);
    videoEl.addEventListener("loadedmetadata", () => {
      try {
        videoEl.currentTime = resumeAt;
      } catch (_) {
      }
      if (wasPlaying) videoEl.play().catch(() => {
      });
    }, { once: true });
    _setPreviewBadge(badgeEl, "proxy");
  }
  function _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS = null) {
    if (!isCurrent()) return;
    _setPreviewBadge(badgeEl, "building");
    streamSSE(
      `/api/videos/${videoId}/proxy/generate`,
      async () => {
        if (!isCurrent()) return;
        const status = await fetch(`/api/videos/${videoId}/proxy-status`).then((r) => r.ok ? r.json() : null).catch(() => null);
        if (!isCurrent()) return;
        if (status?.available) _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS, status.proxy_path);
        else if (status?.generating) setTimeout(() => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS), 5e3);
        else _setPreviewBadge(badgeEl, "original", null, () => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS));
      },
      null,
      // no global job pill - this is a background convenience
      "Preview",
      false,
      (line) => {
        const m = /(\d+)%/.exec(line);
        if (m && isCurrent()) _setPreviewBadge(badgeEl, "building", m[1]);
      }
    );
  }
  function _setPreviewBadge(badgeEl, mode, pct, onBuild) {
    if (!badgeEl) return;
    badgeEl.style.display = "inline-block";
    badgeEl.onclick = null;
    badgeEl.onkeydown = null;
    badgeEl.style.cursor = "";
    badgeEl.style.pointerEvents = "none";
    badgeEl.removeAttribute("tabindex");
    badgeEl.setAttribute("role", "status");
    badgeEl.classList.toggle("preview-badge-proxy", mode === "proxy");
    badgeEl.classList.remove("preview-badge-build");
    if (mode === "proxy") {
      badgeEl.textContent = "Preview quality (720p)";
      badgeEl.title = "Playing a downscaled 720p preview for fast seeking - not full quality. Exports use the original.";
    } else if (mode === "building") {
      badgeEl.textContent = pct ? `Building 720p preview… ${pct}%` : "Building 720p preview…";
      badgeEl.title = "Encoding a fast-seeking 720p preview from the source recording.";
    } else if (onBuild) {
      badgeEl.classList.add("preview-badge-build");
      badgeEl.innerHTML = 'Original quality · <span class="preview-badge-action">&#9889; Build 720p preview</span>';
      badgeEl.title = "Playing the full-quality original. Build a 720p preview so seeking is fast.";
      badgeEl.style.cursor = "pointer";
      badgeEl.style.pointerEvents = "auto";
      badgeEl.setAttribute("role", "button");
      badgeEl.tabIndex = 0;
      badgeEl.onclick = onBuild;
      badgeEl.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onBuild();
        }
      };
    } else {
      badgeEl.textContent = "Original quality · slower seeking";
      badgeEl.title = "Playing the original recording - seeking a long file can be slow.";
    }
  }

  // yuu_clip/web/static/utils.js
  function _syncSortDirBtn(btnId, dir) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const asc = dir === "asc";
    btn.innerHTML = asc ? "&#8593;" : "&#8595;";
    btn.setAttribute("aria-pressed", asc ? "true" : "false");
    btn.setAttribute("aria-label", asc ? "Sorted ascending - click to sort descending" : "Sorted descending - click to sort ascending");
    btn.title = asc ? "Ascending order" : "Descending order";
  }
  function _diarizationReason(installed) {
    return installed ? "" : "SpeechBrain is unavailable - try reinstalling YuuClip";
  }
  async function _diarizationReadiness() {
    const cfg = await fetch("/api/config").then((r) => r.json()).catch(() => ({}));
    const backend = cfg.diarization_backend || "speechbrain";
    const install = await fetch("/api/install/speechbrain").then((r) => r.json()).catch(() => ({ installed: false }));
    const installed = !!install.installed;
    return {
      installed,
      backend,
      ready: installed,
      reason: _diarizationReason(installed)
    };
  }
  function _diarizationNoteHtml(reason, settingsOnclick) {
    return escHtml(reason) + ` - set up in <button class="btn ghost" style="font-size:11px;padding:0 4px;color:var(--accent);display:inline-flex" onclick="${escHtml(settingsOnclick)}">Settings</button>`;
  }
  function openLog() {
    const panel = document.getElementById("log-panel");
    panel.classList.add("visible");
    panel.classList.remove("minimized");
    document.getElementById("log-toggle").textContent = "▲";
  }
  function toggleLog() {
    const panel = document.getElementById("log-panel");
    const minimized = panel.classList.toggle("minimized");
    document.getElementById("log-toggle").textContent = minimized ? "▼" : "▲";
    document.getElementById("btn-log-toggle").setAttribute("aria-expanded", minimized ? "false" : "true");
  }
  function clearLog() {
    document.getElementById("log-lines").innerHTML = "";
  }
  document.getElementById("btn-log-toggle").addEventListener("click", toggleLog);
  document.getElementById("btn-clear-log").addEventListener("click", clearLog);
  var _MAX_LOG_LINES = 500;
  function appendLog(raw) {
    const text = stripRichMarkup(raw);
    if (!text.trim()) return;
    const div = document.createElement("div");
    const isOk = raw.includes(" OK") || raw.includes("[green]") || raw.includes("Done");
    const isErr = raw.includes("FAIL") || raw.includes("Error") || raw.includes("[red]") || raw.includes("error");
    const isWarn = raw.includes("[yellow]") || raw.includes("WARNING") || raw.includes("overlap");
    div.className = "log-line" + (isOk ? " ok" : isErr ? " err" : isWarn ? " warn" : "");
    div.style.display = "flex";
    div.style.gap = "6px";
    const ts = document.createElement("span");
    ts.style.cssText = "color:var(--muted);font-size:10px;flex-shrink:0;opacity:.7";
    ts.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString(void 0, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    div.appendChild(ts);
    div.appendChild(document.createTextNode(text));
    const lines = document.getElementById("log-lines");
    lines.appendChild(div);
    while (lines.childElementCount > _MAX_LOG_LINES) lines.removeChild(lines.firstElementChild);
    const body = document.getElementById("log-body");
    body.scrollTop = body.scrollHeight;
  }
  var TOAST_STACK_MAX = 4;
  function showToast(message, type = "success", opts = {}) {
    const container = document.getElementById("toast-container");
    const liveRegion = document.getElementById(type === "error" ? "sr-live-assertive" : "sr-live-polite");
    if (liveRegion) {
      liveRegion.textContent = "";
      setTimeout(() => {
        liveRegion.textContent = message;
      }, 10);
    }
    while (container.children.length >= TOAST_STACK_MAX) container.firstElementChild.remove();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px";
    const msg = document.createElement("span");
    msg.textContent = message;
    toast.appendChild(msg);
    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:6px;align-items:center;flex-shrink:0";
    if (opts.action) {
      const actionBtn = document.createElement("button");
      actionBtn.className = "btn ghost";
      actionBtn.style.cssText = "font-size:11px;padding:2px 8px";
      actionBtn.textContent = opts.action.label;
      actionBtn.onclick = () => {
        toast.remove();
        opts.action.onClick();
      };
      buttons.appendChild(actionBtn);
    }
    const close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "Dismiss");
    close.style.cssText = `background:none;border:none;color:inherit;cursor:pointer;font-size:18px;line-height:1;padding:0;flex-shrink:0;opacity:${type === "error" ? ".8" : ".5"}`;
    close.onclick = () => toast.remove();
    buttons.appendChild(close);
    toast.appendChild(buttons);
    container.appendChild(toast);
    if (type === "error") return;
    const ms = opts.durationMs ?? (type === "warning" ? 6e3 : 4e3);
    setTimeout(() => {
      toast.style.transition = "opacity .3s";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, ms);
  }
  function netErrMsg(err) {
    if (err instanceof TypeError) return "Couldn't reach YuuClip - it may have stopped. Try again, or restart the app.";
    return err && err.message || "Unknown error";
  }
  async function revealInFolder(path) {
    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path })
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        showToast(`Could not show in folder: ${e.detail || "failed"}`, "error");
      }
    } catch (err) {
      showToast(`Could not show in folder: ${err.message}`, "error");
    }
  }
  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`, "success");
    } catch (err) {
      showToast(`Could not copy ${label.toLowerCase()}: ${err.message}`, "error");
    }
  }
  var _CARD_COLLAPSE_KEY = "yuuclip-card-collapsed";
  function _cardCollapseState() {
    try {
      return JSON.parse(localStorage.getItem(_CARD_COLLAPSE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function isCardCollapsed(key, defaultCollapsed = false) {
    const state = _cardCollapseState();
    return key in state ? !!state[key] : defaultCollapsed;
  }
  function collapsibleCard(key, title, body, opts = {}) {
    const { defaultCollapsed = false, attrs = "", headerStyle = "", actions = "" } = opts;
    const collapsed = isCardCollapsed(key, defaultCollapsed);
    const styleAttr = headerStyle ? ` style="${headerStyle}"` : "";
    const extraAttrs = attrs ? ` ${attrs}` : "";
    return `
    <div class="detail-card collapsible${collapsed ? " collapsed" : ""}" data-collapse-key="${key}"${extraAttrs}>
      <div class="detail-card-header"${styleAttr}>
        <button type="button" class="card-toggle" aria-expanded="${collapsed ? "false" : "true"}">${title}</button>
        ${actions}
      </div>
      ${body}
    </div>`;
  }
  function _toggleCollapsibleCard(card, toggle) {
    const collapsed = card.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const key = card.dataset.collapseKey;
    if (!key) return;
    try {
      const state = _cardCollapseState();
      state[key] = collapsed;
      localStorage.setItem(_CARD_COLLAPSE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Could not persist card collapse state:", err);
    }
    card.dispatchEvent(new CustomEvent("cardtoggle", { bubbles: true, detail: { key, collapsed } }));
  }
  document.addEventListener("click", (e) => {
    const toggle = e.target.closest(".card-toggle");
    if (!toggle) return;
    const card = toggle.closest(".detail-card.collapsible");
    if (card) _toggleCollapsibleCard(card, toggle);
  });

  // yuu_clip/web/static/ui.js
  var _alertOpener = null;
  function showAlert(title, body) {
    _alertOpener = document.activeElement;
    document.getElementById("alert-title").textContent = title;
    document.getElementById("alert-body").innerHTML = body;
    document.getElementById("alert-modal").classList.add("visible");
    setTimeout(() => document.querySelector("#alert-modal .btn").focus(), 50);
  }
  function closeAlertModal() {
    document.getElementById("alert-modal").classList.remove("visible");
    const opener = _alertOpener;
    _alertOpener = null;
    if (opener?.focus) opener.focus();
  }
  var _confirmOpener = null;
  function showConfirm(title, body, okLabel, onOk, danger = false, cancelLabel = "Cancel") {
    _confirmOpener = document.activeElement;
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-body").innerHTML = body;
    const ok = document.getElementById("confirm-ok-btn");
    ok.textContent = okLabel;
    ok.className = danger ? "btn danger" : "btn primary";
    document.getElementById("confirm-cancel-btn").textContent = cancelLabel;
    AppState.confirmCallback = onOk;
    document.getElementById("confirm-modal").classList.add("visible");
    setTimeout(() => document.getElementById("confirm-cancel-btn").focus(), 50);
  }
  function _confirmOk() {
    document.getElementById("confirm-modal").classList.remove("visible");
    const cb = AppState.confirmCallback;
    AppState.confirmCallback = null;
    const opener = _confirmOpener;
    _confirmOpener = null;
    if (cb) cb();
    else if (opener?.focus) opener.focus();
  }
  function _confirmCancel() {
    document.getElementById("confirm-modal").classList.remove("visible");
    AppState.confirmCallback = null;
    const opener = _confirmOpener;
    _confirmOpener = null;
    if (opener?.focus) opener.focus();
  }
  var _actionsModalOpener = null;
  function openActionsModal(title, groups) {
    _actionsModalOpener = document.activeElement;
    document.getElementById("actions-modal-title").textContent = title;
    const body = document.getElementById("actions-modal-body");
    body.innerHTML = "";
    groups.forEach((group, i) => {
      if (i > 0) {
        const divider = document.createElement("div");
        divider.className = "hamburger-divider";
        body.appendChild(divider);
      }
      if (group.heading) {
        const heading = document.createElement("div");
        heading.className = "section-title";
        heading.style.cssText = "margin:8px 0 2px 4px";
        heading.textContent = group.heading;
        body.appendChild(heading);
      }
      for (const row of group.rows) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "action-row" + (row.danger ? " danger" : "");
        el.disabled = !!row.disabled;
        const label = document.createElement("span");
        label.className = "action-row-label";
        label.textContent = row.label;
        const desc = document.createElement("span");
        desc.className = "action-row-desc";
        desc.textContent = row.description;
        el.append(label, desc);
        el.onclick = () => {
          closeActionsModal();
          row.action();
        };
        body.appendChild(el);
      }
    });
    document.getElementById("actions-modal").classList.add("visible");
    setTimeout(() => body.querySelector(".action-row:not(:disabled)")?.focus(), 50);
  }
  function closeActionsModal() {
    document.getElementById("actions-modal").classList.remove("visible");
    const opener = _actionsModalOpener;
    _actionsModalOpener = null;
    if (opener?.focus) opener.focus();
  }
  function topmostVisibleModal() {
    for (const id of ["confirm-modal", "alert-modal"]) {
      const el = document.getElementById(id);
      if (el.classList.contains("visible")) return el;
    }
    const visible = document.querySelectorAll(".modal-bg.visible");
    return visible.length ? visible[visible.length - 1] : null;
  }
  var _FOCUSABLE_SELECTOR = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const modal = topmostVisibleModal();
    if (!modal) return;
    const focusables = [...modal.querySelectorAll(_FOCUSABLE_SELECTOR)].filter((el) => el.getClientRects().length > 0);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
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
  });
  function _menuFocusableItems(menu) {
    return [...menu.querySelectorAll(".hamburger-item")].filter((el) => !el.disabled && el.getClientRects().length > 0);
  }
  function _menuArrowKeydown(menu, e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = _menuFocusableItems(menu);
    if (!items.length) return;
    e.preventDefault();
    const idx = items.indexOf(document.activeElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    items[(idx + step + items.length) % items.length].focus();
  }
  function isHamburgerOpen() {
    return document.getElementById("hamburger-menu").classList.contains("open");
  }
  function toggleHamburger() {
    const menu = document.getElementById("hamburger-menu");
    menu.classList.toggle("open");
    document.getElementById("btn-hamburger").setAttribute("aria-expanded", menu.classList.contains("open"));
    if (menu.classList.contains("open")) _menuFocusableItems(menu)[0]?.focus();
  }
  function closeHamburger(refocusTrigger = false) {
    const menu = document.getElementById("hamburger-menu");
    if (refocusTrigger || menu.contains(document.activeElement)) {
      document.getElementById("btn-hamburger").focus();
    }
    menu.classList.remove("open");
    document.getElementById("btn-hamburger").setAttribute("aria-expanded", "false");
  }
  document.getElementById("hamburger-menu").addEventListener("keydown", (e) => {
    _menuArrowKeydown(document.getElementById("hamburger-menu"), e);
  });
  document.addEventListener("click", (e) => {
    if (!document.getElementById("hamburger-wrap").contains(e.target)) {
      closeHamburger();
    }
  });
  var _controlsOpener = null;
  function openControlsModal() {
    _controlsOpener = document.activeElement;
    document.getElementById("controls-modal").classList.add("visible");
    setTimeout(() => document.querySelector("#controls-modal .btn")?.focus(), 50);
  }
  function closeControlsModal() {
    document.getElementById("controls-modal").classList.remove("visible");
    const opener = _controlsOpener;
    _controlsOpener = null;
    if (opener?.focus) opener.focus();
  }
  var _diffState = null;
  var _diffOpener = null;
  function openDiffModal(title, fields, onCommit, opts = {}) {
    _diffOpener = document.activeElement;
    _diffState = { title, fields, onCommit };
    const revert = opts.revertMode || false;
    document.getElementById("diff-modal-title").textContent = title;
    const container = document.getElementById("diff-fields");
    container.innerHTML = fields.map((f, i) => `
    <div class="diff-field-group">
      ${fields.length > 1 ? `<div class="diff-field-title">${escHtml(f.label)}</div>` : ""}
      <div class="diff-panels">
        <div class="diff-panel">
          <div class="diff-panel-label">${revert ? "Your Edit" : "Current"}</div>
          <div class="diff-current${f.current ? "" : " empty"}">${f.current ? escHtml(f.current) : "(none yet)"}</div>
        </div>
        <div class="diff-panel">
          <div class="diff-panel-label">${revert ? "Original (LLM)" : "New - edit here, then choose below"}</div>
          ${revert ? `<div class="diff-current${f.proposed ? "" : " empty"}">${f.proposed ? escHtml(f.proposed) : "(none)"}</div>` : `<textarea class="diff-new" id="diff-new-${i}" rows="4">${escHtml(f.proposed || "")}</textarea>`}
        </div>
      </div>
    </div>`).join("");
    document.getElementById("diff-discard-btn").textContent = revert ? "Keep My Edit" : "Discard";
    document.getElementById("diff-accept-edit-btn").style.display = revert ? "none" : "";
    document.getElementById("diff-accept-new-btn").textContent = revert ? "Revert to Original" : "Accept as-is";
    document.getElementById("diff-modal").classList.add("visible");
    setTimeout(() => {
      const firstTa = document.getElementById("diff-new-0");
      if (firstTa) firstTa.focus();
      else document.getElementById("diff-discard-btn")?.focus();
    }, 50);
  }
  function _diffGetEdited() {
    return (_diffState?.fields || []).map((_, i) => {
      const ta = document.getElementById(`diff-new-${i}`);
      return ta ? ta.value : "";
    });
  }
  function _diffCloseDone() {
    const opener = _diffOpener;
    _diffOpener = null;
    if (opener?.focus) opener.focus();
  }
  function _diffAcceptNew() {
    const edited = _diffGetEdited();
    document.getElementById("diff-modal").classList.remove("visible");
    const cb = _diffState?.onCommit;
    _diffState = null;
    _diffOpener = null;
    if (cb) cb("accept_new", edited);
  }
  function _diffAcceptEdit() {
    const edited = _diffGetEdited();
    document.getElementById("diff-modal").classList.remove("visible");
    const cb = _diffState?.onCommit;
    _diffState = null;
    _diffOpener = null;
    if (cb) cb("accept_edit", edited);
  }
  function _diffDirty() {
    return (_diffState?.fields || []).some((f, i) => {
      const ta = document.getElementById(`diff-new-${i}`);
      return ta && ta.value !== (f.proposed || "");
    });
  }
  function _diffDiscard() {
    if (!document.getElementById("diff-modal").classList.contains("visible")) return;
    if (_diffDirty()) {
      showConfirm(
        "Discard edit?",
        "You have unsaved changes. Close without saving?",
        "Discard",
        _doDiffDiscard,
        true
      );
      return;
    }
    _doDiffDiscard();
  }
  function _doDiffDiscard() {
    document.getElementById("diff-modal").classList.remove("visible");
    _diffState = null;
    _diffCloseDone();
  }
  var _fieldEditCallback = null;
  var _fieldEditOriginalValue = "";
  var _fieldEditOpener = null;
  function openFieldEditModal(title, currentValue, onSave) {
    _fieldEditOpener = document.activeElement;
    _fieldEditOriginalValue = currentValue;
    document.getElementById("field-edit-title").textContent = title;
    document.getElementById("field-edit-text").value = currentValue;
    _fieldEditCallback = onSave;
    document.getElementById("field-edit-modal").classList.add("visible");
    setTimeout(() => document.getElementById("field-edit-text").focus(), 50);
  }
  function closeFieldEditModal() {
    if (!document.getElementById("field-edit-modal").classList.contains("visible")) return;
    const currentValue = document.getElementById("field-edit-text").value;
    if (currentValue !== _fieldEditOriginalValue) {
      showConfirm(
        "Discard edit?",
        "You have unsaved changes. Close without saving?",
        "Discard",
        _doCloseFieldEditModal,
        true
      );
      return;
    }
    _doCloseFieldEditModal();
  }
  function _doCloseFieldEditModal() {
    document.getElementById("field-edit-modal").classList.remove("visible");
    _fieldEditCallback = null;
    const opener = _fieldEditOpener;
    _fieldEditOpener = null;
    if (opener?.focus) opener.focus();
  }
  function _fieldEditSave() {
    const val = document.getElementById("field-edit-text").value;
    const cb = _fieldEditCallback;
    _doCloseFieldEditModal();
    if (cb) cb(val);
  }
  window.addEventListener("beforeunload", (e) => {
    const fieldEditDirty = document.getElementById("field-edit-modal").classList.contains("visible") && document.getElementById("field-edit-text").value !== _fieldEditOriginalValue;
    const diffDirty = document.getElementById("diff-modal").classList.contains("visible") && _diffDirty();
    if (fieldEditDirty || diffDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  var _activeKebab = null;
  var _activeKebabAnchor = null;
  var _kebabDismiss = null;
  function closeKebab(refocusAnchor = false) {
    if (!_activeKebab) return false;
    _activeKebab.remove();
    _activeKebab = null;
    if (_kebabDismiss) {
      document.removeEventListener("click", _kebabDismiss);
      _kebabDismiss = null;
    }
    const anchor = _activeKebabAnchor;
    _activeKebabAnchor = null;
    if (anchor?.hasAttribute?.("aria-haspopup")) anchor.setAttribute("aria-expanded", "false");
    if (refocusAnchor && anchor?.focus) anchor.focus();
    return true;
  }
  function showKebab(anchorEl, items) {
    closeKebab();
    const menu = document.createElement("div");
    menu.className = "hamburger-menu open";
    menu.style.cssText = "position:fixed;z-index:500;min-width:160px;right:auto";
    for (const item of items) {
      if (item === null) {
        const sep = document.createElement("div");
        sep.className = "hamburger-divider";
        menu.appendChild(sep);
        continue;
      }
      const btn = document.createElement("button");
      btn.className = "hamburger-item";
      btn.textContent = item.label;
      if (item.disabled) btn.disabled = true;
      btn.onclick = () => {
        closeKebab(true);
        item.action();
      };
      menu.appendChild(btn);
    }
    menu.addEventListener("keydown", (e) => _menuArrowKeydown(menu, e));
    document.body.appendChild(menu);
    _activeKebab = menu;
    _activeKebabAnchor = anchorEl;
    if (anchorEl?.hasAttribute?.("aria-haspopup")) anchorEl.setAttribute("aria-expanded", "true");
    const rect = anchorEl.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.right - menu.offsetWidth;
    if (left < 4) left = rect.left;
    const menuH = menu.offsetHeight;
    if (top + menuH > window.innerHeight) top = rect.top - menuH;
    menu.style.top = top + "px";
    menu.style.left = left + "px";
    _menuFocusableItems(menu)[0]?.focus();
    setTimeout(() => {
      if (_activeKebab !== menu) return;
      const dismiss = (e) => {
        if (menu.contains(e.target)) return;
        closeKebab();
      };
      _kebabDismiss = dismiss;
      document.addEventListener("click", dismiss);
    }, 0);
  }
  var _PANE_KEY = "yuuclip-pane-sizes";
  function _loadPaneSizes() {
    try {
      return JSON.parse(localStorage.getItem(_PANE_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function _savePaneSize(key, val) {
    const s = _loadPaneSizes();
    s[key] = val;
    localStorage.setItem(_PANE_KEY, JSON.stringify(s));
  }
  function _makeDragHandle(id, onStart) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.classList.add("dragging");
      const onMove = onStart(e);
      const onUp = () => {
        el.classList.remove("dragging");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }
  function initResize() {
    const root = document.documentElement;
    const sizes = _loadPaneSizes();
    if (sizes.sidebarWidth) root.style.setProperty("--sidebar-width", sizes.sidebarWidth + "px");
    if (sizes.videosHeight) root.style.setProperty("--videos-group-height", sizes.videosHeight + "px");
    if (sizes.playerMaxH) root.style.setProperty("--player-max-height", sizes.playerMaxH + "px");
    if (sizes.logMaxH) root.style.setProperty("--log-max-height", sizes.logMaxH + "px");
    _makeDragHandle("sidebar-resize-handle", (startE) => {
      const startX = startE.clientX;
      const sidebar = document.querySelector(".sidebar");
      const startW = sidebar.getBoundingClientRect().width;
      return (moveE) => {
        const w = Math.max(160, Math.min(480, startW + moveE.clientX - startX));
        root.style.setProperty("--sidebar-width", w + "px");
        _savePaneSize("sidebarWidth", w);
      };
    });
    _makeDragHandle("videos-clips-resize-handle", (startE) => {
      const startY = startE.clientY;
      const vg = document.querySelector(".sidebar-group.videos-group");
      const sidebar = document.querySelector(".sidebar");
      const startH = vg.getBoundingClientRect().height;
      return (moveE) => {
        const maxH = sidebar.getBoundingClientRect().height - 120;
        const h = Math.max(40, Math.min(maxH, startH + moveE.clientY - startY));
        root.style.setProperty("--videos-group-height", h + "px");
        _savePaneSize("videosHeight", h);
      };
    });
    _makeDragHandle("player-resize-handle", (startE) => {
      const startY = startE.clientY;
      const pa = document.getElementById("player-area");
      const main = document.querySelector(".main");
      const startH = pa.getBoundingClientRect().height;
      return (moveE) => {
        const maxH = main.getBoundingClientRect().height - 100;
        const h = Math.max(80, Math.min(maxH, startH + moveE.clientY - startY));
        root.style.setProperty("--player-max-height", h + "px");
        _savePaneSize("playerMaxH", h);
      };
    });
    _makeDragHandle("log-resize-handle", (startE) => {
      const startY = startE.clientY;
      const lb = document.getElementById("log-body");
      const startH = lb.getBoundingClientRect().height || 0;
      return (moveE) => {
        const h = Math.max(40, Math.min(600, startH - (moveE.clientY - startY)));
        root.style.setProperty("--log-max-height", h + "px");
        _savePaneSize("logMaxH", h);
      };
    });
  }
  function _applyPrereqWarnings(prereqs) {
    const inElectron = !!window.electronAPI;
    const wizardLink = inElectron ? ' <a href="#" onclick="window.electronAPI.runSetupWizard();return false" style="color:var(--warning)">Re-run Setup Wizard</a>' : "";
    const banner = document.getElementById("prereq-banner");
    if (!banner) return;
    if (!prereqs.ffmpeg_ok) {
      banner.innerHTML = `<span>⚠ FFmpeg not found - analysis and export will fail.${wizardLink}</span>`;
      banner.style.display = "";
      const btn = document.getElementById("btn-start-analyze");
      if (btn) {
        btn.disabled = true;
        btn.title = "FFmpeg not found - Re-run Setup Wizard to install it";
      }
      return;
    }
    if (!prereqs.llm_ok && inElectron) {
      banner.innerHTML = `<span>ℹ LLM scoring is not configured - clips will be scored by energy and scenes only.${wizardLink}</span>`;
      banner.style.display = "";
      return;
    }
    banner.style.display = "none";
    banner.innerHTML = "";
  }
  var UNDO_TOAST_MS = 5e3;
  function showUndoToast(message, undoFn) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast info undo-toast";
    const row = document.createElement("div");
    row.className = "undo-toast-row";
    const btn = document.createElement("button");
    btn.className = "undo-toast-btn";
    btn.textContent = "Undo";
    btn.onclick = () => {
      toast.remove();
      undoFn();
    };
    row.appendChild(document.createTextNode(message));
    row.appendChild(btn);
    const bar = document.createElement("div");
    bar.className = "undo-toast-bar";
    bar.style.animationDuration = UNDO_TOAST_MS + "ms";
    toast.appendChild(row);
    toast.appendChild(bar);
    container.appendChild(toast);
    setTimeout(() => toast.remove(), UNDO_TOAST_MS);
  }
  function playbackRatePref() {
    const rate = parseFloat(localStorage.getItem("yuuclip-playback-rate"));
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  }
  function applyPlaybackRate(rate) {
    document.querySelectorAll("video").forEach((video) => {
      video.playbackRate = rate;
    });
  }
  function initPlaybackRate() {
    document.addEventListener("loadedmetadata", (e) => {
      if (e.target && e.target.tagName === "VIDEO") e.target.playbackRate = playbackRatePref();
    }, true);
  }
  var _BG_DISMISS_MODALS = [
    ["alert-modal", closeAlertModal],
    ["confirm-modal", _confirmCancel],
    ["actions-modal", closeActionsModal],
    ["controls-modal", closeControlsModal],
    ["diff-modal", _diffDiscard],
    ["field-edit-modal", closeFieldEditModal]
  ];
  function _wireModalBgDismissals() {
    for (const [modalId, closeFn] of _BG_DISMISS_MODALS) {
      const modal = document.getElementById(modalId);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeFn();
      });
    }
  }
  function _wireModalButtons() {
    document.getElementById("alert-ok-btn").addEventListener("click", () => closeAlertModal());
    document.getElementById("confirm-cancel-btn").addEventListener("click", () => _confirmCancel());
    document.getElementById("confirm-ok-btn").addEventListener("click", () => _confirmOk());
    document.getElementById("actions-modal-close-btn").addEventListener("click", () => closeActionsModal());
    document.getElementById("controls-modal-close-btn").addEventListener("click", () => closeControlsModal());
    document.getElementById("diff-discard-btn").addEventListener("click", () => _diffDiscard());
    document.getElementById("diff-accept-edit-btn").addEventListener("click", () => _diffAcceptEdit());
    document.getElementById("diff-accept-new-btn").addEventListener("click", () => _diffAcceptNew());
    document.getElementById("field-edit-cancel-btn").addEventListener("click", () => closeFieldEditModal());
    document.getElementById("field-edit-save-btn").addEventListener("click", () => _fieldEditSave());
  }
  function _wireHamburgerHandlers() {
    document.getElementById("btn-hamburger").addEventListener("click", () => toggleHamburger());
    document.getElementById("hamburger-item-controls").addEventListener("click", () => {
      closeHamburger();
      openControlsModal();
    });
    document.getElementById("hamburger-item-download-log").addEventListener("click", () => closeHamburger());
  }
  _wireModalBgDismissals();
  _wireModalButtons();
  _wireHamburgerHandlers();

  // yuu_clip/web/static/helpmodals.js
  var _gettingStartedOpener = null;
  function openGettingStartedModal() {
    _gettingStartedOpener = document.activeElement;
    document.getElementById("getting-started-modal").classList.add("visible");
    setTimeout(() => document.querySelector("#getting-started-modal .btn")?.focus(), 50);
  }
  function closeGettingStartedModal() {
    document.getElementById("getting-started-modal").classList.remove("visible");
    localStorage.setItem("yuu-getting-started-seen", "1");
    const opener = _gettingStartedOpener;
    _gettingStartedOpener = null;
    if (opener?.focus) opener.focus();
  }
  var _aboutOpener = null;
  function openAboutModal() {
    _aboutOpener = document.activeElement;
    document.getElementById("about-modal").classList.add("visible");
    setTimeout(() => document.querySelector("#about-modal .btn")?.focus(), 50);
  }
  function closeAboutModal() {
    document.getElementById("about-modal").classList.remove("visible");
    const opener = _aboutOpener;
    _aboutOpener = null;
    if (opener?.focus) opener.focus();
  }
  var _helpOpener = null;
  function openHelpModal() {
    _helpOpener = document.activeElement;
    document.getElementById("help-modal").classList.add("visible");
    setTimeout(() => document.querySelector("#help-modal .btn")?.focus(), 50);
  }
  function closeHelpModal() {
    document.getElementById("help-modal").classList.remove("visible");
    const opener = _helpOpener;
    _helpOpener = null;
    if (opener?.focus) opener.focus();
  }
  var _glossaryOpener = null;
  async function openGlossaryModal() {
    _glossaryOpener = document.activeElement;
    document.getElementById("glossary-modal").classList.add("visible");
    const filter = document.getElementById("glossary-filter");
    filter.value = "";
    setTimeout(() => filter.focus(), 50);
    const el = document.getElementById("glossary-content");
    if (el.dataset.loaded) {
      _filterGlossary("");
      return;
    }
    try {
      const md = await fetch("/api/glossary").then((r) => r.text());
      el.innerHTML = _renderGlossaryMd(md);
      el.dataset.loaded = "1";
    } catch (e) {
      el.innerHTML = '<div style="color:var(--red)">Failed to load glossary.</div>';
    }
  }
  function _filterGlossary(query) {
    const q = query.trim().toLowerCase();
    const content = document.getElementById("glossary-content");
    let anyVisible = false;
    content.querySelectorAll(".glossary-term").forEach((term) => {
      const show = !q || term.textContent.toLowerCase().includes(q);
      term.style.display = show ? "" : "none";
      if (show) anyVisible = true;
    });
    content.querySelectorAll(".glossary-section").forEach((section) => {
      const terms = Array.from(section.querySelectorAll(".glossary-term"));
      const show = !q || terms.some((t) => t.style.display !== "none");
      section.style.display = show ? "" : "none";
    });
    document.getElementById("glossary-no-matches").style.display = q && !anyVisible ? "" : "none";
  }
  function closeGlossaryModal() {
    document.getElementById("glossary-modal").classList.remove("visible");
    const opener = _glossaryOpener;
    _glossaryOpener = null;
    if (opener?.focus) opener.focus();
  }
  function _renderGlossaryMd(md) {
    const lines = md.split("\n");
    let html = "";
    let inList = false;
    let inTable = false;
    let tableHead = false;
    let inSection = false;
    let inTerm = false;
    const inline = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
    const closeList = () => {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
    };
    const closeTable = () => {
      if (inTable) {
        html += "</tbody></table>";
        inTable = false;
        tableHead = false;
      }
    };
    const closeTerm = () => {
      if (inTerm) {
        html += "</div>";
        inTerm = false;
      }
    };
    const closeSection = () => {
      closeTerm();
      if (inSection) {
        html += "</div>";
        inSection = false;
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trimEnd();
      if (line.startsWith("## ")) {
        closeList();
        closeTable();
        closeSection();
        html += `<div class="glossary-section"><h2 style="margin:20px 0 4px;font-size:15px;border-bottom:1px solid var(--border);padding-bottom:4px">${inline(line.slice(3))}</h2>`;
        inSection = true;
      } else if (line.startsWith("### ")) {
        closeList();
        closeTable();
        closeTerm();
        html += `<div class="glossary-term"><h3 style="margin:14px 0 2px;font-size:13px;color:var(--accent)">${inline(line.slice(4))}</h3>`;
        inTerm = true;
      } else if (line.startsWith("---")) {
        closeList();
        closeTable();
        closeTerm();
        html += '<hr style="border:none;border-top:1px solid var(--border);margin:14px 0">';
      } else if (/^\|/.test(line)) {
        closeList();
        const cells = line.split("|").slice(1, -1).map((c) => c.trim());
        if (/^[-\s|:]+$/.test(line)) {
          tableHead = false;
        } else if (!inTable) {
          inTable = true;
          tableHead = true;
          html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:6px 0"><thead><tr>';
          cells.forEach((c) => {
            html += `<th style="text-align:left;padding:4px 8px 4px 0;border-bottom:1px solid var(--border);color:var(--text)">${inline(c)}</th>`;
          });
          html += "</tr></thead><tbody>";
        } else {
          html += "<tr>";
          cells.forEach((c) => {
            html += `<td style="padding:3px 8px 3px 0;border-bottom:1px solid var(--border);color:var(--muted);vertical-align:top">${inline(c)}</td>`;
          });
          html += "</tr>";
        }
      } else if (/^- /.test(line)) {
        closeTable();
        if (!inList) {
          html += '<ul style="margin:4px 0 4px 16px;padding:0">';
          inList = true;
        }
        html += `<li style="margin:1px 0">${inline(line.slice(2))}</li>`;
      } else if (line === "") {
        closeList();
        closeTable();
        html += '<div style="margin:4px 0"></div>';
      } else {
        closeList();
        closeTable();
        html += `<p style="margin:3px 0">${inline(line)}</p>`;
      }
    }
    closeList();
    closeTable();
    closeSection();
    return html;
  }
  var _BG_DISMISS_MODALS2 = [
    ["getting-started-modal", closeGettingStartedModal],
    ["help-modal", closeHelpModal],
    ["about-modal", closeAboutModal],
    ["glossary-modal", closeGlossaryModal]
  ];
  function _wireModalBgDismissals2() {
    for (const [modalId, closeFn] of _BG_DISMISS_MODALS2) {
      const modal = document.getElementById(modalId);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeFn();
      });
    }
  }
  function _wireModalButtons2() {
    document.getElementById("getting-started-close-btn").addEventListener("click", () => closeGettingStartedModal());
    document.getElementById("help-modal-close-btn").addEventListener("click", () => closeHelpModal());
    document.getElementById("about-modal-close-btn").addEventListener("click", () => closeAboutModal());
    document.getElementById("glossary-modal-close-btn").addEventListener("click", () => closeGlossaryModal());
    document.getElementById("glossary-filter").addEventListener("input", (e) => _filterGlossary(e.target.value));
  }
  function _wireHamburgerHandlers2() {
    document.getElementById("hamburger-item-getting-started").addEventListener("click", () => {
      window.closeHamburger();
      openGettingStartedModal();
    });
    document.getElementById("hamburger-item-glossary").addEventListener("click", () => {
      window.closeHamburger();
      openGlossaryModal();
    });
    document.getElementById("hamburger-item-help").addEventListener("click", () => {
      window.closeHamburger();
      openHelpModal();
    });
    document.getElementById("hamburger-item-about").addEventListener("click", () => {
      window.closeHamburger();
      openAboutModal();
    });
  }
  _wireModalBgDismissals2();
  _wireModalButtons2();
  _wireHamburgerHandlers2();

  // yuu_clip/web/static/shortcuts.js
  var _modalEscapeClosers = {
    "confirm-modal": () => _confirmCancel(),
    "alert-modal": () => closeAlertModal(),
    "getting-started-modal": () => closeGettingStartedModal(),
    "about-modal": () => closeAboutModal(),
    "controls-modal": () => closeControlsModal(),
    "glossary-modal": () => closeGlossaryModal(),
    "help-modal": () => closeHelpModal(),
    "field-edit-modal": () => closeFieldEditModal(),
    "diff-modal": () => _diffDiscard(),
    "score-override-modal": () => closeScoreOverrideModal(),
    "profile-modal": () => closeProfileManager(),
    "highlight-reels-modal": () => closeHighlightReelsModal(),
    "reel-preview-modal": () => closeReelPreview(),
    "retranscribe-modal": () => closeRetranscribeModal(),
    "context-modal": () => closeContextManager(),
    "batch-export-modal": () => closeBatchExportModal(),
    "export-settings-modal": () => closeExportModal(),
    "timeline-interval-modal": () => closeTimelineIntervalModal(),
    "auto-approve-modal": () => closeAutoApproveModal(),
    "similar-clips-modal": () => closeSimilarClipsModal(),
    "actions-modal": () => closeActionsModal()
  };
  function _closeTopmostLayer() {
    if (closeKebab(true)) return;
    if (isHamburgerOpen()) {
      closeHamburger(true);
      return;
    }
    if (isProjectMenuOpen()) {
      closeProjectMenu(true);
      return;
    }
    const topModal = topmostVisibleModal();
    if (topModal) {
      (_modalEscapeClosers[topModal.id] || (() => topModal.classList.remove("visible")))();
      return;
    }
    if (document.getElementById("settings-panel").classList.contains("visible")) {
      closeSettings();
      return;
    }
    if (PanelNav.isOpen()) {
      PanelNav.close();
      return;
    }
    if (_isNewRecordingPanelOpen()) closeNewRecordingPanel();
  }
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) return;
    const isTyping = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable;
    if (e.key === "Escape" && isTyping) return;
    if (e.key !== "Escape" && (isTyping || e.target.tagName === "BUTTON" || e.target.tagName === "SELECT" || e.target.tagName === "A")) return;
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undoLastStatus();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const _anyModalOpen = () => document.querySelector(".modal-bg.visible") !== null;
    if (e.key === "?" || e.key === "/") {
      if (_anyModalOpen()) return;
      e.preventDefault();
      openControlsModal();
      return;
    }
    if (e.key === "Escape") {
      _closeTopmostLayer();
      return;
    }
    if (_anyModalOpen() || PanelNav.isOpen()) return;
    const focusedRow = e.target instanceof Element ? e.target.closest("#clip-list li[data-clip-id]") : null;
    const subjectClipId = focusedRow ? Number(focusedRow.dataset.clipId) : AppState.activeClipId;
    if (!subjectClipId) return;
    const _actOnSubject = (action) => {
      if (subjectClipId !== AppState.activeClipId) selectClip(subjectClipId).then(() => action(subjectClipId));
      else action(subjectClipId);
    };
    const _navigateTo = (id) => {
      selectClip(id);
      document.querySelector(`#clip-list li[data-clip-id="${id}"]`)?.focus();
    };
    const idx = AppState.clips.findIndex((c) => c.id === subjectClipId);
    switch (e.key) {
      case "a":
      case "A":
        e.preventDefault();
        _actOnSubject((id) => setStatus(id, "approved"));
        break;
      case "r":
      case "R":
        e.preventDefault();
        _actOnSubject((id) => setStatus(id, "rejected"));
        break;
      case "u":
      case "U":
        e.preventDefault();
        _actOnSubject((id) => setStatus(id, "pending"));
        break;
      case " ":
        e.preventDefault();
        {
          const v = document.querySelector("#player-area video");
          if (v) {
            v.paused ? v.play() : v.pause();
          }
        }
        break;
      case "e":
      case "E":
        e.preventDefault();
        _actOnSubject(exportClip);
        break;
      case "ArrowLeft":
      case "ArrowUp":
      case "k":
      case "K":
        e.preventDefault();
        if (idx > 0) _navigateTo(AppState.clips[idx - 1].id);
        break;
      case "ArrowRight":
      case "ArrowDown":
      case "j":
      case "J":
        e.preventDefault();
        if (idx !== -1 && idx < AppState.clips.length - 1) _navigateTo(AppState.clips[idx + 1].id);
        break;
    }
  });

  // yuu_clip/web/static/modelcatalog.js
  var _modelCatalog = null;
  var _modelCatalogInfo = { models_dir: "", free_gb: null, backend: "llamacpp" };
  async function _ensureModelCatalog() {
    if (_modelCatalog) return;
    await _loadModelCatalog();
  }
  async function refreshModelCatalog() {
    _modelCatalog = null;
    await _loadModelCatalog();
  }
  async function _loadModelCatalog() {
    try {
      const data = await fetch("/api/llm/catalog").then((r) => r.json());
      _modelCatalog = data.models || [];
      _modelCatalogInfo = {
        models_dir: data.models_dir || "",
        free_gb: data.free_gb ?? null,
        backend: data.backend || "llamacpp"
      };
    } catch {
      _modelCatalog = [];
      const failedEl = document.getElementById("s-llamacpp-recommended");
      if (failedEl) failedEl.innerHTML = '<div class="settings-note">Could not load the recommended model list - check your internet connection and reopen Settings. You can still set a model file by hand under Advanced AI options below.</div>';
      return;
    }
    _renderRecommendedModels("s-llamacpp-recommended", "llamacpp");
    _updateCurrentModelSummary();
  }
  var _BACKEND_LABELS = { llamacpp: "Local llama.cpp" };
  function _updateCurrentModelSummary() {
    const el = document.getElementById("s-llm-current-summary");
    if (!el) return;
    const active = (_modelCatalog || []).find((m) => m.active);
    if (!active) {
      el.style.display = "none";
      return;
    }
    const backend = _modelCatalogInfo.backend;
    const label = _BACKEND_LABELS[backend] || backend;
    el.innerHTML = `Currently using: <strong>${escHtml(active.display_name)}</strong> <span class="settings-note">(${escHtml(label)})</span>`;
    el.style.display = "";
  }
  function _renderRecommendedModels(containerId, backend) {
    const el = document.getElementById(containerId);
    if (!el || !_modelCatalog) return;
    const models = _modelCatalog.filter((m) => m.backends.includes(backend));
    if (!models.length) {
      el.innerHTML = "";
      return;
    }
    const textModels = models.filter((m) => !m.kinds.includes("vision"));
    const visionModels = models.filter((m) => m.kinds.includes("vision"));
    el.innerHTML = _modelGroupHtml(
      "Text scoring models",
      "Score clips and write descriptions. Pick one to get started.",
      textModels,
      backend,
      "text"
    ) + _modelGroupHtml(
      "Image analysis (vision) models",
      "Optional - let YuuClip look at frames and describe what is on screen.",
      visionModels,
      backend,
      "vision"
    );
    _wireModelCards(el);
  }
  function _modelGroupHtml(title, intro, models, backend, kind) {
    if (!models.length) return "";
    return `<div class="rec-model-group"><div class="rec-model-group-title">${escHtml(title)}</div><div class="settings-note">${escHtml(intro)}</div>` + models.map((m) => _recModelHtml(m, backend, kind)).join("") + `</div>`;
  }
  function _wireModelCards(el) {
    el.querySelectorAll(".rec-model").forEach((card) => {
      const modelId = card.getAttribute("data-model-id");
      card.querySelector('[data-act="download-gguf"]')?.addEventListener("click", () => downloadGgufModel(modelId, card));
      card.querySelector('[data-act="use-gguf"]')?.addEventListener("click", () => _useGgufModel(modelId));
    });
  }
  function _modelMetaLine(m) {
    const free = _modelCatalogInfo.free_gb;
    return [
      m.size_gb ? `~${m.size_gb} GB` : null,
      m.size_gb != null && free != null ? `${free} GB free` : null,
      m.licence
    ].filter(Boolean).join(" · ");
  }
  function _modelBadge(m) {
    if (m.active) return `<span class="rec-model-badge active">Active</span>`;
    if (m.installed) return `<span class="rec-model-badge">Downloaded</span>`;
    return "";
  }
  function _recModelHtml(m, backend, kind) {
    const actions = _llamacppActions(m);
    return `<div class="rec-model${m.active ? " active" : ""}" data-model-id="${escHtml(m.id)}" data-kind="${escHtml(kind || "text")}"><div class="rec-model-head"><span class="rec-model-name">${escHtml(m.display_name)}</span>` + _modelBadge(m) + `<span class="rec-model-meta">${escHtml(_modelMetaLine(m))}</span></div><div class="rec-model-why">${escHtml(m.why)}</div><div class="rec-model-actions">${actions}</div><div class="mdl-progress" data-gguf-progress style="display:none"><div class="mdl-bar"><div class="mdl-bar-fill" data-gguf-fill></div></div><span class="mdl-pct" data-gguf-pct></span></div><div class="settings-install-log" data-gguf-log></div></div>`;
  }
  function _llamacppActions(m) {
    if (!m.gguf_url) return "";
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
    return parts.join("");
  }
  function _applyModelPaths(m) {
    const isVision = Array.isArray(m.kinds) && m.kinds.includes("vision");
    if (isVision) {
      const visionEl = document.getElementById("s-llm-vision-model-path");
      if (visionEl && m.gguf_path) visionEl.value = m.gguf_path;
      const projEl = document.getElementById("s-llm-mmproj-path");
      if (projEl && m.mmproj_path) projEl.value = m.mmproj_path;
    } else {
      const pathEl = document.getElementById("s-llm-model-path");
      if (pathEl && m.gguf_path) pathEl.value = m.gguf_path;
    }
    window._checkSettingsDirty();
  }
  function _useGgufModel(modelId) {
    const m = (_modelCatalog || []).find((x) => x.id === modelId);
    if (!m) return;
    _applyModelPaths(m);
    showToast("Model selected - click Save to apply", "info");
  }
  var _ggufAbort = null;
  function _parseGgufPct(line) {
    const match = /(\d+)%/.exec(line);
    if (!match) return null;
    const pct = parseInt(match[1], 10);
    return pct >= 0 && pct <= 100 ? pct : null;
  }
  function _setGgufProgress(card, value) {
    const fill = card.querySelector("[data-gguf-fill]");
    const pct = card.querySelector("[data-gguf-pct]");
    if (!fill || !pct) return;
    if (value == null) {
      fill.classList.add("indeterminate");
      fill.style.width = "";
      pct.textContent = "";
    } else {
      fill.classList.remove("indeterminate");
      fill.style.width = value + "%";
      pct.textContent = value + "%";
    }
  }
  function _setGgufCancel(card, show, onCancel) {
    const log = card.querySelector("[data-gguf-log]");
    if (!log) return;
    let btn = card.querySelector("[data-gguf-cancel]");
    if (show) {
      if (!btn) {
        btn = document.createElement("button");
        btn.setAttribute("data-gguf-cancel", "");
        btn.type = "button";
        btn.className = "btn-secondary";
        btn.textContent = "Cancel download";
        btn.style.marginTop = "4px";
        log.parentNode.insertBefore(btn, log);
      }
      btn.disabled = false;
      btn.onclick = onCancel;
      btn.style.display = "";
    } else if (btn) {
      btn.style.display = "none";
    }
  }
  async function downloadGgufModel(modelId, card) {
    const log = card.querySelector("[data-gguf-log]");
    const button = card.querySelector('[data-act="download-gguf"]');
    const progress = card.querySelector("[data-gguf-progress]");
    if (!log) return;
    const model = (_modelCatalog || []).find((x) => x.id === modelId);
    log.style.display = "block";
    log.textContent = "Starting download - this can take several minutes...\n";
    if (progress) progress.style.display = "";
    _setGgufProgress(card, null);
    if (button) {
      button.disabled = true;
      button.textContent = "Downloading...";
    }
    const controller = new AbortController();
    _ggufAbort = controller;
    _setGgufCancel(card, true, () => {
      controller.abort();
    });
    try {
      const resp = await fetch(
        `/api/llm/gguf/download?model_id=${encodeURIComponent(modelId)}`,
        { method: "POST", signal: controller.signal }
      );
      if (!resp.ok) {
        let detail = "";
        try {
          detail = (await resp.json()).detail || "";
        } catch {
          detail = await resp.text();
        }
        log.textContent += `✗ ${detail || "Download could not start."}
`;
        return;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const msg = JSON.parse(line.slice(6));
          if (msg === "__DONE__") {
            _setGgufProgress(card, 100);
            log.textContent += "✓ Done - model selected. Save to apply.\n";
            if (model) _applyModelPaths(model);
            _updateLlmCapabilities();
            return;
          }
          const pct = _parseGgufPct(msg);
          if (pct != null) _setGgufProgress(card, pct);
          log.textContent += msg + "\n";
          log.scrollTop = log.scrollHeight;
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") log.textContent += "■ Download cancelled.\n";
      else log.textContent += "✗ Download failed - check your connection and try again.\n";
    } finally {
      _ggufAbort = null;
      _setGgufCancel(card, false);
      if (progress) progress.style.display = "none";
      if (button) {
        button.disabled = false;
        button.textContent = "Download now";
      }
    }
  }
  async function _updateLlmCapabilities() {
    const el = document.getElementById("s-llm-capabilities");
    if (!el) return;
    let cap;
    try {
      cap = await fetch("/api/llm/capabilities").then((r) => r.json());
    } catch {
      el.textContent = "Could not check model readiness.";
      return;
    }
    const mark = (ok) => ok ? '<span aria-hidden="true">✓</span> Ready' : '<span aria-hidden="true">○</span> Not set up';
    el.innerHTML = `<span style="margin-right:14px">Text scoring: ${mark(cap.text)}</span><span>Image analysis: ${mark(cap.vision)}</span><div class="settings-note" style="margin-top:4px">${escHtml(cap.detail || "")}</div>`;
    el.style.color = cap.text ? "var(--green)" : "var(--muted)";
  }
  async function _renderCapabilityTiers() {
    const list = document.getElementById("s-capabilities-list");
    const intro = document.getElementById("s-capabilities-intro");
    if (!list) return;
    let data;
    try {
      data = await fetch("/api/capabilities/tiers").then((r) => r.json());
    } catch {
      if (intro) intro.textContent = "";
      list.innerHTML = '<div class="settings-note">Could not check capabilities.</div>';
      return;
    }
    if (intro) {
      intro.textContent = data.lightweight ? "No local model is set up yet - transcription and the core scoring are working, and clips get a short template description. Setting up a local model is the normal next step: it adds written descriptions, session summaries, and a smarter read on scoring." : "Here's what each part of YuuClip is using right now, and what you can upgrade.";
    }
    list.innerHTML = (data.tiers || []).map(_capabilityTierHtml).join("");
    list.querySelectorAll("[data-section]").forEach((btn) => {
      btn.addEventListener("click", () => window._scrollToSettingsSection(btn.getAttribute("data-section")));
    });
    list.querySelectorAll("[data-prefetch]").forEach((btn) => {
      btn.addEventListener("click", () => prefetchModel(btn.getAttribute("data-prefetch"), btn.getAttribute("data-tier-id")));
    });
  }
  function _capabilityTierHtml(tier) {
    const needsSetup = !tier.ready && !!tier.install_slug;
    const needsPrefetch = !tier.ready && !needsSetup && !!tier.prefetch_slug;
    const mark = tier.ready ? "✓" : needsSetup || needsPrefetch ? "○" : "&#8943;";
    const markClass = tier.ready ? " ready" : "";
    let action = "";
    if (needsSetup) {
      action = `<button type="button" class="settings-jump-link" data-section="${escHtml(tier.section)}" style="margin-top:2px">Set up &rarr;</button>`;
    } else if (needsPrefetch) {
      action = `<button type="button" class="btn-secondary" data-prefetch="${escHtml(tier.prefetch_slug)}" data-tier-id="${escHtml(tier.id)}" style="margin-top:4px">Download now</button><div id="cap-prefetch-log-${escHtml(tier.id)}" class="settings-install-log"></div>`;
    }
    return `<div class="capability-tier"><div class="capability-tier-head"><span class="capability-mark${markClass}" aria-hidden="true">${mark}</span><span class="capability-tier-name">${escHtml(tier.name)}</span><span class="capability-tier-active">${escHtml(tier.active)}</span></div><div class="settings-note">${escHtml(tier.purpose)}</div><div class="settings-note">${escHtml(tier.upgrade)}</div>` + (tier.detail ? `<div class="settings-note">${escHtml(tier.detail)}</div>` : "") + action + `</div>`;
  }
  var _PREFETCH_LABELS = {
    speaker: "the speaker model (~80 MB)",
    audio_event: "the audio-event model (~350 MB)",
    embeddings: "the embeddings model (~130 MB)"
  };
  var _prefetchAbort = null;
  function _setPrefetchCancel(tierId, show, onCancel) {
    const log = document.getElementById(`cap-prefetch-log-${tierId}`);
    if (!log) return;
    let btn = document.getElementById(`cap-prefetch-cancel-${tierId}`);
    if (show) {
      if (!btn) {
        btn = document.createElement("button");
        btn.id = `cap-prefetch-cancel-${tierId}`;
        btn.type = "button";
        btn.className = "btn-secondary";
        btn.textContent = "Cancel download";
        btn.style.marginTop = "4px";
        log.parentNode.insertBefore(btn, log);
      }
      btn.disabled = false;
      btn.onclick = onCancel;
      btn.style.display = "";
    } else if (btn) {
      btn.style.display = "none";
    }
  }
  async function prefetchModel(slug, tierId) {
    const log = document.getElementById(`cap-prefetch-log-${tierId}`);
    const button = document.querySelector(`[data-prefetch="${CSS.escape(slug)}"]`);
    if (!log) return;
    log.style.display = "block";
    log.textContent = `Downloading ${_PREFETCH_LABELS[slug] || slug}…
`;
    if (button) {
      button.disabled = true;
      button.textContent = "Downloading…";
    }
    const controller = new AbortController();
    _prefetchAbort = controller;
    _setPrefetchCancel(tierId, true, () => {
      controller.abort();
    });
    try {
      const resp = await fetch(
        `/api/models/prefetch?slug=${encodeURIComponent(slug)}`,
        { method: "POST", signal: controller.signal }
      );
      if (!resp.ok) {
        let detail = "";
        try {
          detail = (await resp.json()).detail || "";
        } catch {
          detail = await resp.text();
        }
        log.textContent += `✗ ${detail || "Download could not start."}
`;
        return;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const msg = JSON.parse(line.slice(6));
          if (msg === "__DONE__") {
            log.textContent += "✓ Ready.\n";
            _renderCapabilityTiers();
            return;
          }
          log.textContent += msg + "\n";
          log.scrollTop = log.scrollHeight;
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") log.textContent += "■ Download cancelled.\n";
      else log.textContent += "✗ Download failed - check your connection and try again.\n";
    } finally {
      _prefetchAbort = null;
      _setPrefetchCancel(tierId, false);
      if (button) {
        button.disabled = false;
        button.textContent = "Download now";
      }
    }
  }
  async function gateOnCapability(el, capability, message) {
    let cap;
    try {
      cap = await fetch("/api/llm/capabilities").then((r) => r.json());
    } catch {
      cap = { text: false, vision: false, detail: "" };
    }
    const ok = !!cap[capability];
    el.disabled = !ok;
    let note = el.parentElement?.querySelector(".gate-note");
    if (!ok) {
      if (!note) {
        note = document.createElement("div");
        note.className = "gate-note";
        el.parentElement?.appendChild(note);
      }
      note.innerHTML = `${escHtml(message)} <a href="#" onclick="openSettings();return false">Open Settings</a>`;
    } else if (note) {
      note.remove();
    }
    return cap;
  }

  // yuu_clip/web/static/main.esm.js
  window.AppState = AppState;
  Object.assign(window, format_exports);
  window.ColorPicker = ColorPicker;
  window.PanelNav = PanelNav;
  window._syncSortDirBtn = _syncSortDirBtn;
  window._diarizationReason = _diarizationReason;
  window._diarizationReadiness = _diarizationReadiness;
  window._diarizationNoteHtml = _diarizationNoteHtml;
  window.openLog = openLog;
  window.clearLog = clearLog;
  window.appendLog = appendLog;
  window.showToast = showToast;
  window.netErrMsg = netErrMsg;
  window.revealInFolder = revealInFolder;
  window.copyText = copyText;
  window.collapsibleCard = collapsibleCard;
  Object.assign(window, jobs_exports);
  window._buildMediaUrl = _buildMediaUrl;
  window.setupRecordingPreview = setupRecordingPreview;
  window.showAlert = showAlert;
  window.closeAlertModal = closeAlertModal;
  window.showConfirm = showConfirm;
  window._confirmCancel = _confirmCancel;
  window.openActionsModal = openActionsModal;
  window.closeActionsModal = closeActionsModal;
  window.topmostVisibleModal = topmostVisibleModal;
  window._menuArrowKeydown = _menuArrowKeydown;
  window.isHamburgerOpen = isHamburgerOpen;
  window.toggleHamburger = toggleHamburger;
  window.closeHamburger = closeHamburger;
  window.openControlsModal = openControlsModal;
  window.closeControlsModal = closeControlsModal;
  window.openDiffModal = openDiffModal;
  window._diffDiscard = _diffDiscard;
  window.openFieldEditModal = openFieldEditModal;
  window.closeFieldEditModal = closeFieldEditModal;
  window.closeKebab = closeKebab;
  window.showKebab = showKebab;
  window.initResize = initResize;
  window._applyPrereqWarnings = _applyPrereqWarnings;
  window.showUndoToast = showUndoToast;
  window.playbackRatePref = playbackRatePref;
  window.applyPlaybackRate = applyPlaybackRate;
  window.initPlaybackRate = initPlaybackRate;
  window.openGettingStartedModal = openGettingStartedModal;
  window.closeGettingStartedModal = closeGettingStartedModal;
  window.openAboutModal = openAboutModal;
  window.closeAboutModal = closeAboutModal;
  window.openHelpModal = openHelpModal;
  window.closeHelpModal = closeHelpModal;
  window.openGlossaryModal = openGlossaryModal;
  window.closeGlossaryModal = closeGlossaryModal;
  window._filterGlossary = _filterGlossary;
  window._ensureModelCatalog = _ensureModelCatalog;
  window.refreshModelCatalog = refreshModelCatalog;
  window._updateLlmCapabilities = _updateLlmCapabilities;
  window._renderCapabilityTiers = _renderCapabilityTiers;
  window.gateOnCapability = gateOnCapability;
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3RhdGUuanMiLCAiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgImpvYnMuanMiLCAicHJldmlldy5qcyIsICJ1dGlscy5qcyIsICJ1aS5qcyIsICJoZWxwbW9kYWxzLmpzIiwgInNob3J0Y3V0cy5qcyIsICJtb2RlbGNhdGFsb2cuanMiLCAibWFpbi5lc20uanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIEZlYXR1cmUtbWFwIC0gU2hhcmVkIGFwcGxpY2F0aW9uIHN0YXRlOiB0aGUgc2luZ2xlIEFwcFN0YXRlIG9iamVjdCBldmVyeSBmZWF0dXJlIG1vZHVsZSByZWFkcy93cml0ZXMuXG4vLyAgIEFQSTogbm9uZSAoY2xpZW50LW9ubHkpIMK3IFRlc3RzOiBjb3ZlcmVkIGluZGlyZWN0bHkgYnkgdGhlIHRlc3RfdWlfKi5weSBzdWl0ZXNcbi8vIOKUgOKUgCBzaGFyZWQgYXBwbGljYXRpb24gc3RhdGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBNdXRhYmxlIHN0YXRlIHNoYXJlZCBhY3Jvc3MgZmVhdHVyZSBtb2R1bGVzLiBDZW50cmFsaXplZCBpbiBvbmUgZXhwbGljaXQgb2JqZWN0XG4vLyBzbyBjcm9zcy1tb2R1bGUgcmVhZHMvd3JpdGVzIGFyZSBncmVwcGFibGUgYW5kIG9idmlvdXNseSBzaGFyZWQsIHJhdGhlciB0aGFuXG4vLyBzY2F0dGVyZWQgYmFyZSBnbG9iYWxzIHRoYXQgbG9vayBsaWtlIG1vZHVsZSBsb2NhbHMgYXQgdGhlIGNhbGwgc2l0ZS5cbmV4cG9ydCBjb25zdCBBcHBTdGF0ZSA9IHtcbiAgYWN0aXZlVmlkZW9JZDogICAgICAgbnVsbCxcbiAgYWN0aXZlQ2xpcElkOiAgICAgICAgbnVsbCxcbiAgdmlkZW9zOiAgICAgICAgICAgICAgW10sXG4gIHNlc3Npb25zOiAgICAgICAgICAgIFtdLCAgICAgICAvLyBncm91cGVkIHBsYXkgc2Vzc2lvbnMgKFJlY29yZGluZ1Nlc3Npb24gcm93cylcbiAgYWN0aXZlU2Vzc2lvbklkOiAgICAgbnVsbCwgICAgIC8vIHNlc3Npb24gd2hvc2UgZGV0YWlsIHZpZXcgaXMgb3Blbiwgb3IgbnVsbFxuICBjbGlwczogICAgICAgICAgICAgICBbXSxcbiAgYW5hbHl6ZVByb2ZpbGVzOiAgICAgW10sXG4gIGNvbnRleHRzOiAgICAgICAgICAgIFtdLFxuICBob3RXb3JkczogICAgICAgICAgICBbXSxcbiAgX2hvdFdvcmRzTG9hZGVkOiAgICAgZmFsc2UsXG4gIHNlbnNpdGl2ZVRlcm1zOiAgICAgIFtdLFxuICBfc2Vuc2l0aXZlVGVybXNMb2FkZWQ6IGZhbHNlLFxuICBhbmFseXplRmlsZW5hbWU6ICAgICBudWxsLFxuICBlZGl0aW5nQ29udGV4dElkOiAgICBudWxsLFxuICBjbGlwRmlsdGVyczogICAgICAgICBuZXcgU2V0KCksICAvLyBhY3RpdmUgZmlsdGVyIHRva2VuczsgZW1wdHkgPSBzaG93IGFsbFxuICBjbGlwS2luZDogICAgICAgICAgICAnY2xpcCcsICAgICAgLy8gY2FuZGlkYXRlIHR5cGUgc2hvd246ICdjbGlwJyB8ICdzY2VuZScgKHNlcnZlci1zaWRlIGZpbHRlcilcbiAgY2xpcFNlYXJjaDogICAgICAgICAgJycsXG4gIGNsaXBTY29yZU1pbjogICAgICAgIDAsXG4gIHZpZGVvU2VhcmNoOiAgICAgICAgICcnLFxuICB2aWRlb1NvcnQ6ICAgICAgICAgICAncmVjZW50JyxcbiAgdmlkZW9Tb3J0RGlyOiAgICAgICAgJ2Rlc2MnLCAgLy8gJ2Rlc2MnID0gdGhlIHNvcnQgb3B0aW9uJ3MgbmF0dXJhbCBvcmRlcjsgJ2FzYycgcmV2ZXJzZXMgaXRcbiAgY2xpcFNvcnREaXI6ICAgICAgICAgJ2Rlc2MnLFxuICB2aWRlb0ZpbHRlcnM6ICAgICAgICBuZXcgU2V0KCksICAvLyBhY3RpdmUgdmlkZW8gZmlsdGVyIHRva2VuczsgZW1wdHkgPSBzaG93IGFsbFxuICBzZWxlY3RlZENsaXBJZHM6ICAgICBuZXcgU2V0KCksXG4gIGxhc3RTdGF0dXNDaGFuZ2U6ICAgIG51bGwsIC8vIHtjbGlwSWQsIGZyb21TdGF0dXMsIHRpbWVyfVxuICBsYXN0QnVsa1N0YXR1c0NoYW5nZTogbnVsbCwgLy8ge3ByZXZpb3VzOiB7Y2xpcElkOiBmcm9tU3RhdHVzfSwgdGltZXJ9XG4gIGNvbmZpcm1DYWxsYmFjazogICAgIG51bGwsXG4gIGFjdGl2ZUNsaXBEYXRhOiAgICAgIG51bGwsXG4gIGNsaXBKb2JzOiAgICAgICAgICAgIHt9LCAgIC8vIGNsaXBJZCAtPiB7b3B9IGZvciBhIHBlci1jbGlwIGFzeW5jIGpvYiBpbiBmbGlnaHQgKGFuYWx5emUtZnJhbWVzKSwgc28gaXRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluZGljYXRvciBzdXJ2aXZlcyBhIHJlbmRlckRldGFpbCByZWJ1aWxkIC8gY2xpcCBzd2l0Y2ggKHN0YXRlLCBub3QgYSBET00gbm9kZSlcbiAgYWN0aXZlTWVkaWFGaWxlbmFtZTogbnVsbCxcbiAgYWN0aXZlVmlkZW9EYXRhOiAgICAgbnVsbCxcbiAgYm9vdFJlc3RvcmVEb25lOiAgICAgZmFsc2UsXG4gIGV4cG9ydERpcjogICAgICAgICAgIG51bGwsXG4gIHJlZWxzRGlyOiAgICAgICAgICAgIG51bGwsXG4gIGNhblJldmVhbDogICAgICAgICAgIGZhbHNlLFxufTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFB1cmUgZm9ybWF0dGVycyBhbmQgc2NvcmUgaGVscGVyczogbm8gRE9NLCBubyBmZXRjaC4gSFRNTC1lc2NhcGUsIEFQSS1lcnJvciB0ZXh0LFxyXG4vLyAgIGR1cmF0aW9uL2RhdGUvb2Zmc2V0IGZvcm1hdHRpbmcsIHZpZGVvLXN0YXR1cyBsYWJlbHMsIGFuZCB0aGUgc2NvcmUgY29sb3IvaWNvbiBlbmNvZGluZy5cclxuLy8gICBBUEk6IG5vbmUgKGNsaWVudC1vbmx5KSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV91dGlscy5weVxyXG4vLyDilIDilIAgc2NvcmUgdXRpbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmZ1bmN0aW9uIF9zY29yZUljb24oc2NvcmUpIHtcclxuICBjb25zdCBjb2xvciA9IHNjb3JlID49IDAuNyA/ICd2YXIoLS1ncmVlbiknIDogc2NvcmUgPj0gMC40ID8gJ3ZhcigtLXdhcm5pbmcpJyA6ICd2YXIoLS1tdXRlZCknO1xyXG4gIHJldHVybiBgPHNwYW4gc3R5bGU9XCJjb2xvcjoke2NvbG9yfTtmb250LXNpemU6MTBweFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPiYjMTEwODg7PC9zcGFuPmA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9sZXJwQ29sb3IoYzEsIGMyLCB0KSB7XHJcbiAgY29uc3QgaCA9IGMgPT4gW3BhcnNlSW50KGMuc2xpY2UoMSwzKSwxNiksIHBhcnNlSW50KGMuc2xpY2UoMyw1KSwxNiksIHBhcnNlSW50KGMuc2xpY2UoNSw3KSwxNildO1xyXG4gIGNvbnN0IFtyMSxnMSxiMV0gPSBoKGMxKSwgW3IyLGcyLGIyXSA9IGgoYzIpO1xyXG4gIHJldHVybiBgcmdiKCR7TWF0aC5yb3VuZChyMSsocjItcjEpKnQpfSwke01hdGgucm91bmQoZzErKGcyLWcxKSp0KX0sJHtNYXRoLnJvdW5kKGIxKyhiMi1iMSkqdCl9KWA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zY29yZUJvcmRlckNvbG9yKHNjb3JlLCBpc1JlamVjdGVkKSB7XHJcbiAgaWYgKGlzUmVqZWN0ZWQpIHJldHVybiAndmFyKC0tbXV0ZWQpJztcclxuICBjb25zdCBzdG9wcyA9IFtbMCwnIzZiNmI4MCddLFswLjMsJyM0ZmMzZjcnXSxbMC41LCcjNGNhZjdkJ10sWzAuNywnI2YwYzA2MCddLFsxLjAsJyNmN2E4NWEnXV07XHJcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBzdG9wcy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKHNjb3JlIDw9IHN0b3BzW2ldWzBdKSB7XHJcbiAgICAgIGNvbnN0IHQgPSAoc2NvcmUgLSBzdG9wc1tpLTFdWzBdKSAvIChzdG9wc1tpXVswXSAtIHN0b3BzW2ktMV1bMF0pO1xyXG4gICAgICByZXR1cm4gX2xlcnBDb2xvcihzdG9wc1tpLTFdWzFdLCBzdG9wc1tpXVsxXSwgdCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBzdG9wc1tzdG9wcy5sZW5ndGgtMV1bMV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zb3J0U2NvcmUoY2xpcCkge1xyXG4gIGNvbnN0IHNvcnQgPSB3aW5kb3cuX2NsaXBzU29ydFBhcmFtKCk7XHJcbiAgaWYgKHNvcnQgPT09ICdmdW5ueScpICAgIHJldHVybiBjbGlwLnNjb3JlX2Z1bm55O1xyXG4gIGlmIChzb3J0ID09PSAnZHJhbWF0aWMnKSByZXR1cm4gY2xpcC5zY29yZV9kcmFtYXRpYztcclxuICBpZiAoc29ydCA9PT0gJ2FjdGlvbicpICAgcmV0dXJuIGNsaXAuc2NvcmVfYWN0aW9uO1xyXG4gIGlmIChzb3J0ID09PSAndmlzdWFsJykgICByZXR1cm4gY2xpcC5zY29yZV92aXN1YWw7XHJcbiAgaWYgKHNvcnQgPT09ICdsYXVnaCcpICAgIHJldHVybiBjbGlwLnNjb3JlX2xhdWdoO1xyXG4gIHJldHVybiBjbGlwLnNjb3JlX292ZXJhbGw7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBmb3JtYXQgdXRpbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmNvbnN0IF9WSURFT19TVEFUVVNfRElTUExBWSA9IHtcclxuICBwZW5kaW5nOiAnTm90IGFuYWx5emVkJywgcHJvYmVkOiAnSW5zcGVjdGVkJywgbGFiZWxlZDogJ1RyYWNrcyBhc3NpZ25lZCcsXHJcbiAgZXh0cmFjdGluZzogJ0V4dHJhY3RpbmcnLCB0cmFuc2NyaWJpbmc6ICdUcmFuc2NyaWJpbmcnLCB0cmFuc2NyaWJlZDogJ1RyYW5zY3JpYmVkJyxcclxuICBzZWdtZW50ZWQ6ICdDbGlwcyBnZW5lcmF0ZWQnLCBkb25lOiAnQW5hbHl6ZWQnLCBmYWlsZWQ6ICdBbmFseXNpcyBpbnRlcnJ1cHRlZCcsXHJcbn07XHJcbmZ1bmN0aW9uIF9mbXRWaWRlb1N0YXR1cyhzKSB7IHJldHVybiBfVklERU9fU1RBVFVTX0RJU1BMQVlbc10gfHwgczsgfVxyXG5cclxuZnVuY3Rpb24gX21zVG9IbXMobXMpIHtcclxuICBjb25zdCBzID0gTWF0aC5mbG9vcihtcyAvIDEwMDApO1xyXG4gIGlmIChzIDwgNjApIHJldHVybiBgJHtzfXNgO1xyXG4gIGNvbnN0IG0gPSBNYXRoLmZsb29yKHMgLyA2MCksIHNlYyA9IHMgJSA2MDtcclxuICBpZiAobSA8IDYwKSByZXR1cm4gYCR7bX1tICR7U3RyaW5nKHNlYykucGFkU3RhcnQoMiwgJzAnKX1zYDtcclxuICBjb25zdCBoID0gTWF0aC5mbG9vcihtIC8gNjApLCBtaW4gPSBtICUgNjA7XHJcbiAgcmV0dXJuIGAke2h9aCAke1N0cmluZyhtaW4pLnBhZFN0YXJ0KDIsICcwJyl9bWA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBsdXJhbChjb3VudCwgc2luZ3VsYXIsIHBsdXJhbEZvcm0pIHtcclxuICByZXR1cm4gYCR7Y291bnR9ICR7Y291bnQgPT09IDEgPyBzaW5ndWxhciA6IChwbHVyYWxGb3JtIHx8IHNpbmd1bGFyICsgJ3MnKX1gO1xyXG59XHJcblxyXG4vLyBTdGFuZGFyZCBndWFyZCBmb3IgYW55IGNvbXB1dGVkIG51bWJlciBzaG93biB0byB0aGUgdXNlcjogcmV0dXJucyAqdmFsdWUqXHJcbi8vIG9ubHkgd2hlbiBpdCBpcyBhIGZpbml0ZSBudW1iZXIsIG90aGVyd2lzZSBhIHBsYWluLUVuZ2xpc2ggKmZhbGxiYWNrKi4gTmFOXHJcbi8vIG9yIEluZmluaXR5IC0gdXN1YWxseSBmcm9tIGFyaXRobWV0aWMgb24gbWlzc2luZy9wYXJ0aWFsIGRhdGEgLSBtdXN0IG5ldmVyXHJcbi8vIHJlYWNoIHRoZSBVSSBhcyB0aGUgbGl0ZXJhbCBcIk5hTlwiL1wiSW5maW5pdHlcIi4gVXNlIHRoaXMgKG9yIGZtdER1cmF0aW9uKSBhdFxyXG4vLyBldmVyeSBkaXNwbGF5IHNpdGUgdGhhdCBmb3JtYXRzIGEgZGVyaXZlZCBudW1iZXIuXHJcbmZ1bmN0aW9uIGZpbml0ZU9yKHZhbHVlLCBmYWxsYmFjayA9ICdOL0EnKSB7XHJcbiAgcmV0dXJuIE51bWJlci5pc0Zpbml0ZSh2YWx1ZSkgPyB2YWx1ZSA6IGZhbGxiYWNrO1xyXG59XHJcblxyXG4vLyBIdW1hbi1yZWFkYWJsZSBjbGlwL3NlZ21lbnQgbGVuZ3RoLiBSZXR1cm5zICpmYWxsYmFjayogZm9yIGEgbm9uLWZpbml0ZVxyXG4vLyBpbnB1dCAoZS5nLiBhIGNsaXAgbWlzc2luZyBpdHMgc3RhcnQvZW5kIHRpbWVzKSByYXRoZXIgdGhhbiBcIk5hTiBzZWNcIi5cclxuZnVuY3Rpb24gZm10RHVyYXRpb24oc2Vjb25kcywgZmFsbGJhY2sgPSAndW5rbm93bicpIHtcclxuICBpZiAoIU51bWJlci5pc0Zpbml0ZShzZWNvbmRzKSkgcmV0dXJuIGZhbGxiYWNrO1xyXG4gIHJldHVybiBzZWNvbmRzID49IDYwID8gYCR7TWF0aC5yb3VuZChzZWNvbmRzIC8gNjApfSBtaW5gIDogYCR7TWF0aC5yb3VuZChzZWNvbmRzKX0gc2VjYDtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJ1bmNhdGUodGV4dCwgbWF4KSB7XHJcbiAgcmV0dXJuIHRleHQubGVuZ3RoID4gbWF4ID8gdGV4dC5zbGljZSgwLCBtYXggLSAxKSArICfigKYnIDogdGV4dDtcclxufVxyXG5cclxuZnVuY3Rpb24gZXNjSHRtbChzKSB7XHJcbiAgcmV0dXJuIFN0cmluZyhzKS5yZXBsYWNlKC8mL2csJyZhbXA7JykucmVwbGFjZSgvPC9nLCcmbHQ7JykucmVwbGFjZSgvPi9nLCcmZ3Q7JykucmVwbGFjZSgvXCIvZywnJnF1b3Q7Jyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZvcm1hdEFwaUVycm9yKGVycikge1xyXG4gIGlmICghZXJyKSByZXR1cm4gJ1Vua25vd24gZXJyb3InO1xyXG4gIGlmICh0eXBlb2YgZXJyLmRldGFpbCA9PT0gJ3N0cmluZycpIHJldHVybiBlcnIuZGV0YWlsO1xyXG4gIGlmIChBcnJheS5pc0FycmF5KGVyci5kZXRhaWwpKSByZXR1cm4gZXJyLmRldGFpbC5tYXAoZSA9PiBlLm1zZyB8fCBKU09OLnN0cmluZ2lmeShlKSkuam9pbignOyAnKTtcclxuICBpZiAoZXJyLm1lc3NhZ2UpIHJldHVybiBlcnIubWVzc2FnZTtcclxuICBjb25zdCBzdHJpbmdpZmllZCA9IEpTT04uc3RyaW5naWZ5KGVycik7XHJcbiAgcmV0dXJuICghc3RyaW5naWZpZWQgfHwgc3RyaW5naWZpZWQgPT09ICd7fScpID8gJ1Vua25vd24gZXJyb3IgKG5vIGRldGFpbHMgZnJvbSBzZXJ2ZXIpJyA6IHN0cmluZ2lmaWVkO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdHJpcFJpY2hNYXJrdXAodGV4dCkge1xyXG4gIHJldHVybiB0ZXh0XHJcbiAgICAucmVwbGFjZSgvXFx4MWJcXFtbMC05O10qW2EtekEtWl0vZywgJycpICAvLyBBTlNJIGVzY2FwZSBjb2Rlc1xyXG4gICAgLnJlcGxhY2UoL1xcW1xcLz9cXHcrXFxdL2csICcnKTsgICAgICAgICAgICAgLy8gUmljaCBtYXJrdXAgdGFnc1xyXG59XHJcblxyXG4vLyBTZXJ2ZXIgdGltZXN0YW1wcyBhcmUgbmFpdmUgVVRDIChTUUxpdGUgRGF0ZVRpbWUg4oaSIGlzb2Zvcm1hdCgpIHdpdGggbm8gem9uZSkuXHJcbi8vIFRyZWF0IGEgem9uZS1sZXNzIHN0cmluZyBhcyBVVEMgc28gaXQgaXNuJ3QgcGFyc2VkIGFzIHRoZSB2aWV3ZXIncyBsb2NhbCB0aW1lLlxyXG5mdW5jdGlvbiBfcGFyc2VTZXJ2ZXJEYXRlKGlzbykge1xyXG4gIGNvbnN0IGhhc1pvbmUgPSAvW3paXSR8WystXVxcZHsyfTo/XFxkezJ9JC8udGVzdChpc28pO1xyXG4gIHJldHVybiBuZXcgRGF0ZShoYXNab25lID8gaXNvIDogaXNvICsgJ1onKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdERhdGUoaXNvKSB7XHJcbiAgaWYgKCFpc28pIHJldHVybiAnbmV2ZXInO1xyXG4gIGNvbnN0IGQgPSBfcGFyc2VTZXJ2ZXJEYXRlKGlzbyk7XHJcbiAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKHVuZGVmaW5lZCwge21vbnRoOidzaG9ydCcsIGRheTonbnVtZXJpYyd9KSArICcgYXQgJyArXHJcbiAgICBkLnRvTG9jYWxlVGltZVN0cmluZyh1bmRlZmluZWQsIHtob3VyOidudW1lcmljJywgbWludXRlOicyLWRpZ2l0J30pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10QWdvKGlzb1N0cmluZykge1xyXG4gIGNvbnN0IGRpZmZTID0gKERhdGUubm93KCkgLSBfcGFyc2VTZXJ2ZXJEYXRlKGlzb1N0cmluZykuZ2V0VGltZSgpKSAvIDEwMDA7XHJcbiAgaWYgKGRpZmZTIDwgNjApICAgIHJldHVybiAnanVzdCBub3cnO1xyXG4gIGlmIChkaWZmUyA8IDM2MDApICByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDYwKX1tIGFnb2A7XHJcbiAgaWYgKGRpZmZTIDwgODY0MDApIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gMzYwMCl9aCBhZ29gO1xyXG4gIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gODY0MDApfWQgYWdvYDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdE9mZnNldCh2KSB7XHJcbiAgaWYgKCF2KSByZXR1cm4gJyswLjAnO1xyXG4gIHJldHVybiAodiA+PSAwID8gJysnIDogJycpICsgdi50b0ZpeGVkKDEpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10RWxhcHNlZChtcykge1xyXG4gIGNvbnN0IHMgPSBNYXRoLmZsb29yKG1zIC8gMTAwMCk7XHJcbiAgY29uc3QgbSA9IE1hdGguZmxvb3IocyAvIDYwKTtcclxuICByZXR1cm4gbSA+IDAgPyBgJHttfW0gJHtzICUgNjB9c2AgOiBgJHtzfXNgO1xyXG59XHJcblxyXG4vLyDilIDilIAgdGltZWxpbmUgaW50ZXJ2YWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmNvbnN0IF9USU1FTElORV9NSU5fSU5URVJWQUxfUyA9IDEwO1xyXG5cclxuLy8gQ29udmVydCBhIHRpbWVsaW5lIGludGVydmFsICh2YWx1ZSwgdW5pdCkgaW50byBzZWNvbmRzOyBudWxsIGlmIG5vbi1udW1lcmljIG9yXHJcbi8vIGJlbG93IHRoZSBtaW5pbXVtLiBTaGFyZWQgYnkgdGhlIFNldHRpbmdzIHNhdmUgcGF0aCBhbmQgdGhlIHBlci12aWRlbyB0aW1lbGluZVxyXG4vLyBnZW5lcmF0b3Igc28gdGhlaXIgdmFsaWRhdGlvbiBjYW4ndCBkcmlmdCBhcGFydC5cclxuZnVuY3Rpb24gX3BhcnNlSW50ZXJ2YWxTKHZhbHVlLCB1bml0KSB7XHJcbiAgY29uc3QgbiA9IHBhcnNlSW50KHZhbHVlLCAxMCk7XHJcbiAgaWYgKGlzTmFOKG4pKSByZXR1cm4gbnVsbDtcclxuICBjb25zdCBzZWNvbmRzID0gdW5pdCA9PT0gJ21pbnV0ZXMnID8gbiAqIDYwIDogbjtcclxuICByZXR1cm4gc2Vjb25kcyA+PSBfVElNRUxJTkVfTUlOX0lOVEVSVkFMX1MgPyBzZWNvbmRzIDogbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IHtcclxuICBfc2NvcmVJY29uLCBfbGVycENvbG9yLCBfc2NvcmVCb3JkZXJDb2xvciwgX3NvcnRTY29yZSwgX2ZtdFZpZGVvU3RhdHVzLCBfbXNUb0htcyxcclxuICBwbHVyYWwsIGZpbml0ZU9yLCBmbXREdXJhdGlvbiwgdHJ1bmNhdGUsIGVzY0h0bWwsIGZvcm1hdEFwaUVycm9yLCBzdHJpcFJpY2hNYXJrdXAsXHJcbiAgX3BhcnNlU2VydmVyRGF0ZSwgX2ZtdERhdGUsIF9mbXRBZ28sIF9mbXRPZmZzZXQsIF9mbXRFbGFwc2VkLCBfcGFyc2VJbnRlcnZhbFMsXHJcbn07XHJcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFNoYXJlZCBjb2xvdXIgcGlja2VyLiBQcm9ncmVzc2l2ZS1lbmhhbmNlcyBhbiA8aW5wdXQ+IHRoYXQgaG9sZHNcclxuLy8gICBhIGhleCB2YWx1ZTogdGhlIG9yaWdpbmFsIGlucHV0IGJlY29tZXMgYSBoaWRkZW4gdmFsdWUtc3RvcmUgKGtlZXBpbmcgaXRzIGlkLFxyXG4vLyAgIGNsYXNzZXMsIGRhdGEtKiBhbmQgZXZlbnQgd2lyaW5nKSBhbmQgZ2FpbnMgYSBjb21wYWN0IHN3YXRjaCB0cmlnZ2VyLiBDbGlja2luZ1xyXG4vLyAgIGl0IG9wZW5zIGEgcG9wb3ZlciB3aXRoIGRpcmVjdCBoZXggZW50cnksIGEgcmVjZW50bHktdXNlZCBzdHJpcCwgYW5kIChTdGFnZSAzKVxyXG4vLyAgIGEgdXNlci1jdXJhdGVkIG5hbWVkIHBhbGV0dGUuIFJlcGxhY2VzIG5hdGl2ZSA8aW5wdXQgdHlwZT1cImNvbG9yXCI+IGF0IHRoZVxyXG4vLyAgIHNwZWFrZXItY29sb3VyIGFuZCB0aXRsZS1jYXJkIGNvbG91ciBzaXRlcy5cclxuLy8gICBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9jb2xvcnBpY2tlci5weVxyXG4vLyDilIDilIAgc2hhcmVkIGNvbG91ciBwaWNrZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG5jb25zdCBSRUNFTlRfS0VZID0gJ3l1dWNsaXAtY29sb3ItcmVjZW50JztcclxuY29uc3QgUEFMRVRURV9LRVkgPSAneXV1Y2xpcC1jb2xvci1wYWxldHRlJztcclxuY29uc3QgUkVDRU5UX01BWCA9IDg7XHJcblxyXG4vLyBQaWNrYWJsZSBzdGFydGVyIGNvbG91cnMgLSBkYXRhLCBub3QgVUkgY2hyb21lICh0aGUgY2hyb21lIGFyb3VuZCB0aGVtIGNvbWVzXHJcbi8vIGZyb20gdGhlbWUgdG9rZW5zKS4gQSBzcHJlYWQgb2YgaHVlcyBwbHVzIGJsYWNrL3doaXRlIHNvIGEgZmlyc3QtdGltZSB1c2VyIGhhc1xyXG4vLyB1c2FibGUgY2hvaWNlcyBiZWZvcmUgY3VyYXRpbmcgdGhlaXIgb3duIHBhbGV0dGUuIFRoZXNlIGxpdGVyYWxzIGFyZSB0aGUgb25lXHJcbi8vIGV4Y2VwdGlvbiB0aGUgdGVzdF91aV90aGVtZSBjb2xvdXItbGl0ZXJhbCBhbGxvd2xpc3QgY2FydmVzIG91dCBmb3IgdGhpcyBmaWxlLlxyXG5jb25zdCBTVEFSVEVSX1NXQVRDSEVTID0gW1xyXG4gICcjZmZmZmZmJywgJyMwMDAwMDAnLCAnI2UwNWM1YycsICcjZjA4MDNjJywgJyNmMGMwNjAnLCAnIzRjYWY3ZCcsXHJcbiAgJyM0ZmMzZjcnLCAnIzBhN2E5YicsICcjYjA2YWY3JywgJyNmNzdhYzAnLCAnIzllOWU5ZScsICcjN2E0YjJhJyxcclxuXTtcclxuXHJcbmZ1bmN0aW9uIF9yZWFkTGlzdChrZXkpIHtcclxuICB0cnkge1xyXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8ICdbXScpO1xyXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtdO1xyXG4gIH0gY2F0Y2ggeyByZXR1cm4gW107IH1cclxufVxyXG5cclxuZnVuY3Rpb24gX3dyaXRlTGlzdChrZXksIGxpc3QpIHtcclxuICB0cnkgeyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIEpTT04uc3RyaW5naWZ5KGxpc3QpKTsgfSBjYXRjaCB7IC8qIHN0b3JhZ2UgZGlzYWJsZWQgKi8gfVxyXG59XHJcblxyXG4vLyBBY2NlcHRzICNSR0Igb3IgI1JSR0dCQiAod2l0aCBvciB3aXRob3V0IHRoZSBsZWFkaW5nICMpIGFuZCByZXR1cm5zIGFcclxuLy8gY2Fub25pY2FsIGxvd2VyY2FzZSAjcnJnZ2JiLCBvciBudWxsIHdoZW4gdGhlIHZhbHVlIGlzbid0IGEgdmFsaWQgaGV4IGNvbG91ci5cclxuZnVuY3Rpb24gX25vcm1hbGl6ZUhleChyYXcpIHtcclxuICBpZiAodHlwZW9mIHJhdyAhPT0gJ3N0cmluZycpIHJldHVybiBudWxsO1xyXG4gIGxldCBoZXggPSByYXcudHJpbSgpO1xyXG4gIGlmIChoZXggJiYgIWhleC5zdGFydHNXaXRoKCcjJykpIGhleCA9ICcjJyArIGhleDtcclxuICBjb25zdCBzaG9ydCA9IC9eIyhbMC05YS1mQS1GXXszfSkkLy5leGVjKGhleCk7XHJcbiAgaWYgKHNob3J0KSBoZXggPSAnIycgKyBzaG9ydFsxXS5zcGxpdCgnJykubWFwKGMgPT4gYyArIGMpLmpvaW4oJycpO1xyXG4gIHJldHVybiAvXiNbMC05YS1mQS1GXXs2fSQvLnRlc3QoaGV4KSA/IGhleC50b0xvd2VyQ2FzZSgpIDogbnVsbDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3JlY29yZFJlY2VudChoZXgpIHtcclxuICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChoZXgpO1xyXG4gIGlmICghbm9ybSkgcmV0dXJuO1xyXG4gIGNvbnN0IGxpc3QgPSBfcmVhZExpc3QoUkVDRU5UX0tFWSlcclxuICAgIC5tYXAoX25vcm1hbGl6ZUhleClcclxuICAgIC5maWx0ZXIoYyA9PiBjICYmIGMgIT09IG5vcm0pO1xyXG4gIGxpc3QudW5zaGlmdChub3JtKTtcclxuICBfd3JpdGVMaXN0KFJFQ0VOVF9LRVksIGxpc3Quc2xpY2UoMCwgUkVDRU5UX01BWCkpO1xyXG59XHJcblxyXG4vLyBBIHNpbmdsZSBjbGlja2FibGUgc3dhdGNoIHNob3dpbmcgYW4gYWN0dWFsIGNob3NlbiBjb2xvdXIuIFRoZSBiYWNrZ3JvdW5kIGlzIGFcclxuLy8gZGF0YSB2YWx1ZSAodGhlIHBpY2tlZCBjb2xvdXIpLCBzZXQgYXMgYSBET00gcHJvcGVydHkgc28gaXQgbmV2ZXIgYXBwZWFycyBhcyBhXHJcbi8vIGxpdGVyYWwgaW4gc291cmNlIC0gdGhlIHN3YXRjaCdzIGJvcmRlci9mb2N1cyByaW5nIGFyZSB0aGVtZSB0b2tlbnMgdmlhIENTUy5cclxuZnVuY3Rpb24gX3N3YXRjaEJ1dHRvbihjb2xvcikge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGJ0bi50eXBlID0gJ2J1dHRvbic7XHJcbiAgYnRuLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1zd2F0Y2gnO1xyXG4gIGJ0bi5kYXRhc2V0LmNvbG9yID0gY29sb3I7XHJcbiAgYnRuLnN0eWxlLmJhY2tncm91bmQgPSBjb2xvcjtcclxuICBidG4udGl0bGUgPSBjb2xvcjtcclxuICBidG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgY29sb3IpO1xyXG4gIHJldHVybiBidG47XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zd2F0Y2hSb3coY29sb3JzKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1yb3cnO1xyXG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XHJcbiAgZm9yIChjb25zdCByYXcgb2YgY29sb3JzKSB7XHJcbiAgICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgocmF3KTtcclxuICAgIGlmICghY29sb3IgfHwgc2Vlbi5oYXMoY29sb3IpKSBjb250aW51ZTtcclxuICAgIHNlZW4uYWRkKGNvbG9yKTtcclxuICAgIHJvdy5hcHBlbmRDaGlsZChfc3dhdGNoQnV0dG9uKGNvbG9yKSk7XHJcbiAgfVxyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zZWN0aW9uTGFiZWwodGV4dCkge1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXNlY3Rpb24tbGFiZWwnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gdGV4dDtcclxuICByZXR1cm4gbGFiZWw7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCB1c2VyLWN1cmF0ZWQgbmFtZWQgcGFsZXR0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZnVuY3Rpb24gX3BhbGV0dGVFbnRyaWVzKCkge1xyXG4gIHJldHVybiBfcmVhZExpc3QoUEFMRVRURV9LRVkpXHJcbiAgICAuZmlsdGVyKGUgPT4gZSAmJiB0eXBlb2YgZS5uYW1lID09PSAnc3RyaW5nJyAmJiBfbm9ybWFsaXplSGV4KGUuY29sb3IpKVxyXG4gICAgLm1hcChlID0+ICh7IG5hbWU6IGUubmFtZSwgY29sb3I6IF9ub3JtYWxpemVIZXgoZS5jb2xvcikgfSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcGFsZXR0ZUl0ZW0obmFtZSwgY29sb3IpIHtcclxuICBjb25zdCBpdGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgaXRlbS5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1pdGVtJztcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1uYW1lJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9IG5hbWU7XHJcbiAgY29uc3QgcmVtb3ZlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgcmVtb3ZlLnR5cGUgPSAnYnV0dG9uJztcclxuICByZW1vdmUuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtcmVtb3ZlJztcclxuICByZW1vdmUuZGF0YXNldC5uYW1lID0gbmFtZTtcclxuICByZW1vdmUudGV4dENvbnRlbnQgPSAnw5cnO1xyXG4gIHJlbW92ZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBgUmVtb3ZlICR7bmFtZX1gKTtcclxuICBpdGVtLmFwcGVuZChfc3dhdGNoQnV0dG9uKGNvbG9yKSwgbGFiZWwsIHJlbW92ZSk7XHJcbiAgcmV0dXJuIGl0ZW07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZFBhbGV0dGUoZW50cmllcykge1xyXG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICB3cmFwLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlJztcclxuICBpZiAoIWVudHJpZXMubGVuZ3RoKSB7XHJcbiAgICBjb25zdCBoaW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgaGludC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGludCc7XHJcbiAgICBoaW50LnRleHRDb250ZW50ID0gJ1NhdmUgYSBjb2xvdXIgYmVsb3cgdG8gYnVpbGQgeW91ciBwYWxldHRlLic7XHJcbiAgICB3cmFwLmFwcGVuZENoaWxkKGhpbnQpO1xyXG4gICAgcmV0dXJuIHdyYXA7XHJcbiAgfVxyXG4gIGVudHJpZXMuZm9yRWFjaCgoeyBuYW1lLCBjb2xvciB9KSA9PiB3cmFwLmFwcGVuZENoaWxkKF9wYWxldHRlSXRlbShuYW1lLCBjb2xvcikpKTtcclxuICByZXR1cm4gd3JhcDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkQWRkUm93KCkge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItYWRkcm93JztcclxuICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgaW5wdXQudHlwZSA9ICd0ZXh0JztcclxuICBpbnB1dC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCc7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdtYXhsZW5ndGgnLCAnNDAnKTtcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTmFtZSBmb3IgdGhlIGN1cnJlbnQgY29sb3VyJyk7XHJcbiAgaW5wdXQucGxhY2Vob2xkZXIgPSAnTmFtZSB0aGlzIGNvbG91cic7XHJcbiAgY29uc3QgYWRkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYWRkLnR5cGUgPSAnYnV0dG9uJztcclxuICBhZGQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtYWRkJztcclxuICBhZGQudGV4dENvbnRlbnQgPSAnU2F2ZSc7XHJcbiAgcm93LmFwcGVuZChpbnB1dCwgYWRkKTtcclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG4vLyBTYXZlcyB0aGUgY29sb3VyIGN1cnJlbnRseSBpbiB0aGUgaGV4IGZpZWxkIChmYWxsaW5nIGJhY2sgdG8gdGhlIGNvbW1pdHRlZFxyXG4vLyB2YWx1ZSkgdW5kZXIgdGhlIHR5cGVkIG5hbWUsIGRlZmF1bHRpbmcgdGhlIG5hbWUgdG8gdGhlIGhleCBzdHJpbmcgaXRzZWxmLlxyXG5mdW5jdGlvbiBfYWRkUGFsZXR0ZUVudHJ5KGN0eCkge1xyXG4gIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleChjdHguaGV4RmllbGQudmFsdWUpIHx8IF9ub3JtYWxpemVIZXgoY3R4LmlucHV0LnZhbHVlKTtcclxuICBpZiAoIWNvbG9yKSByZXR1cm47XHJcbiAgY29uc3QgbmFtZUlucHV0ID0gY3R4LnBvcC5xdWVyeVNlbGVjdG9yKCcuY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCcpO1xyXG4gIGNvbnN0IG5hbWUgPSAobmFtZUlucHV0ICYmIG5hbWVJbnB1dC52YWx1ZS50cmltKCkpIHx8IGNvbG9yO1xyXG4gIGNvbnN0IG5leHQgPSBfcGFsZXR0ZUVudHJpZXMoKS5maWx0ZXIoZSA9PiBlLm5hbWUgIT09IG5hbWUpO1xyXG4gIG5leHQucHVzaCh7IG5hbWUsIGNvbG9yIH0pO1xyXG4gIF93cml0ZUxpc3QoUEFMRVRURV9LRVksIG5leHQpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3JlbW92ZVBhbGV0dGVFbnRyeShjdHgsIG5hbWUpIHtcclxuICBfd3JpdGVMaXN0KFBBTEVUVEVfS0VZLCBfcGFsZXR0ZUVudHJpZXMoKS5maWx0ZXIoZSA9PiBlLm5hbWUgIT09IG5hbWUpKTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCB2YWx1ZSkge1xyXG4gIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleCh2YWx1ZSk7XHJcbiAgdHJpZ2dlci5zdHlsZS5iYWNrZ3JvdW5kID0gY29sb3IgfHwgJ3RyYW5zcGFyZW50JztcclxuICB0cmlnZ2VyLmNsYXNzTGlzdC50b2dnbGUoJ2lzLWVtcHR5JywgIWNvbG9yKTtcclxufVxyXG5cclxuLy8gRXZlcnl0aGluZyBpbiBhIHBpY2tlciBpbnN0YW5jZSB0aGUgaGFuZGxlcnMgbmVlZCB0byByZWFjaC5cclxuZnVuY3Rpb24gX21ha2VDb250ZXh0KGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkKSB7XHJcbiAgcmV0dXJuIHsgaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2NvbW1pdChjdHgsIHJhd0hleCkge1xyXG4gIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KHJhd0hleCk7XHJcbiAgaWYgKCFub3JtKSByZXR1cm4gZmFsc2U7XHJcbiAgY3R4LmlucHV0LnZhbHVlID0gbm9ybTtcclxuICAvLyBpbnB1dCBkcml2ZXMgdGhlIGxpdmUtcHJldmlldyBoYW5kbGVycyAodGl0bGUgY2FyZCdzIG9uaW5wdXQpOyBjaGFuZ2UgZHJpdmVzXHJcbiAgLy8gdGhlIHNhdmUgaGFuZGxlcnMgKHNwZWFrZXIgY2hhbmdlLWRlbGVnYXRpb24pLiBUaGUgdHJpZ2dlciByZS1zeW5jcyBvZmYgdGhlXHJcbiAgLy8gJ2lucHV0JyBsaXN0ZW5lciB3aXJlZCBpbiBhdHRhY2goKS5cclxuICBjdHguaW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcclxuICBjdHguaW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgX3JlY29yZFJlY2VudChub3JtKTtcclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuLy8gUmVidWlsdCBlYWNoIHRpbWUgdGhlIHBvcG92ZXIgb3BlbnMgKGFuZCBhZnRlciBhIHBhbGV0dGUgYWRkL3JlbW92ZSkgc28gdGhlXHJcbi8vIHJlY2VudGx5LXVzZWQgc3RyaXAgYW5kIHNhdmVkIHBhbGV0dGUgcmVmbGVjdCB0aGUgbGF0ZXN0IHN0YXRlLiBBbGwgb2YgaXQgZ29lc1xyXG4vLyBpbiBvbmUgY29udGFpbmVyIHRoYXQgaXMgcmVwbGFjZWQgd2hvbGVzYWxlLCBzbyBub3RoaW5nIGFjY3VtdWxhdGVzLlxyXG5mdW5jdGlvbiBfcmVuZGVyU3RyaXBzKGN0eCkge1xyXG4gIGNvbnN0IHN0YWxlID0gY3R4LnBvcC5xdWVyeVNlbGVjdG9yKCcuY29sb3JwaWNrZXItZHluYW1pYycpO1xyXG4gIGlmIChzdGFsZSkgc3RhbGUucmVtb3ZlKCk7XHJcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgY29udGFpbmVyLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1keW5hbWljJztcclxuICBjb25zdCByZWNlbnQgPSBfcmVhZExpc3QoUkVDRU5UX0tFWSk7XHJcbiAgaWYgKHJlY2VudC5sZW5ndGgpIHtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdSZWNlbnRseSB1c2VkJykpO1xyXG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zd2F0Y2hSb3cocmVjZW50KSk7XHJcbiAgfVxyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdZb3VyIHBhbGV0dGUnKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9idWlsZFBhbGV0dGUoX3BhbGV0dGVFbnRyaWVzKCkpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX2J1aWxkQWRkUm93KCkpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdDb2xvdXJzJykpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc3dhdGNoUm93KFNUQVJURVJfU1dBVENIRVMpKTtcclxuICBjdHgucG9wLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcbn1cclxuXHJcbmxldCBfb3BlbkN0eCA9IG51bGw7ICAvLyB0aGUgb25lIG9wZW4gcGlja2VyIGNvbnRleHQsIG9yIG51bGxcclxuXHJcbmZ1bmN0aW9uIF9jbG9zZVBvcG92ZXIocmVmb2N1cykge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBjb25zdCB7IHBvcCwgdHJpZ2dlciB9ID0gX29wZW5DdHg7XHJcbiAgcG9wLmNsYXNzTGlzdC5yZW1vdmUoJ29wZW4nKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xyXG4gIF9vcGVuQ3R4ID0gbnVsbDtcclxuICBpZiAocmVmb2N1cykgdHJpZ2dlci5mb2N1cygpO1xyXG59XHJcblxyXG4vLyBUaGUgcG9wb3ZlciBpcyBhIGRpYWxvZywgc28gVGFiIG11c3Qgbm90IGZhbGwgdGhyb3VnaCB0byB0aGUgcGFnZSBiZWhpbmQgaXRcclxuLy8gKFdDQUcgMi40LjMpLiBDeWNsZSBmb2N1cyBhbW9uZyB0aGUgcG9wb3ZlcidzIG93biBjb250cm9sczsgdGhlIHRyaWdnZXIgc2l0c1xyXG4vLyBvdXRzaWRlIHRoZSBwb3BvdmVyIGFuZCBpcyBpbnRlbnRpb25hbGx5IGV4Y2x1ZGVkIHdoaWxlIGl0IGlzIG9wZW4uXHJcbmZ1bmN0aW9uIF9mb2N1c2FibGVzKHBvcCkge1xyXG4gIHJldHVybiBBcnJheS5mcm9tKHBvcC5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24sIGlucHV0JykpLmZpbHRlcihcclxuICAgIGVsID0+ICFlbC5kaXNhYmxlZCAmJiBlbC5vZmZzZXRQYXJlbnQgIT09IG51bGwsXHJcbiAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3RyYXBGb2N1cyhlKSB7XHJcbiAgY29uc3QgaXRlbXMgPSBfZm9jdXNhYmxlcyhfb3BlbkN0eC5wb3ApO1xyXG4gIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XHJcbiAgY29uc3QgZmlyc3QgPSBpdGVtc1swXTtcclxuICBjb25zdCBsYXN0ID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV07XHJcbiAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcclxuICBpZiAoIV9vcGVuQ3R4LnBvcC5jb250YWlucyhhY3RpdmUpKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBmaXJzdC5mb2N1cygpO1xyXG4gIH0gZWxzZSBpZiAoZS5zaGlmdEtleSAmJiBhY3RpdmUgPT09IGZpcnN0KSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBsYXN0LmZvY3VzKCk7XHJcbiAgfSBlbHNlIGlmICghZS5zaGlmdEtleSAmJiBhY3RpdmUgPT09IGxhc3QpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGZpcnN0LmZvY3VzKCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBfb3BlblBvcG92ZXIoY3R4KSB7XHJcbiAgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gIGN0eC5oZXhGaWVsZC52YWx1ZSA9IChfbm9ybWFsaXplSGV4KGN0eC5pbnB1dC52YWx1ZSkgfHwgJycpLnJlcGxhY2UoJyMnLCAnJyk7XHJcbiAgY3R4LmhleEZpZWxkLmNsYXNzTGlzdC5yZW1vdmUoJ2ludmFsaWQnKTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbiAgY3R4LnBvcC5jbGFzc0xpc3QuYWRkKCdvcGVuJyk7XHJcbiAgY3R4LnRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcclxuICBfb3BlbkN0eCA9IGN0eDtcclxuICBjdHguaGV4RmllbGQuZm9jdXMoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3dpcmVIZXhGaWVsZChjdHgpIHtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7XHJcbiAgICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChjdHguaGV4RmllbGQudmFsdWUpO1xyXG4gICAgY3R4LmhleEZpZWxkLmNsYXNzTGlzdC50b2dnbGUoJ2ludmFsaWQnLCAhbm9ybSAmJiBjdHguaGV4RmllbGQudmFsdWUudHJpbSgpICE9PSAnJyk7XHJcbiAgICBpZiAobm9ybSkgX3N5bmNUcmlnZ2VyKGN0eC50cmlnZ2VyLCBub3JtKTsgIC8vIGxpdmUgcHJldmlldywgbm8gY29tbWl0IHlldFxyXG4gIH0pO1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiBfY29tbWl0KGN0eCwgY3R4LmhleEZpZWxkLnZhbHVlKSk7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICAgIGlmIChlLmtleSAhPT0gJ0VudGVyJykgcmV0dXJuO1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgaWYgKF9jb21taXQoY3R4LCBjdHguaGV4RmllbGQudmFsdWUpKSBfY2xvc2VQb3BvdmVyKHRydWUpO1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRIZXhSb3coKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhyb3cnO1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhoYXNoJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9ICcjJztcclxuICBjb25zdCBmaWVsZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgZmllbGQudHlwZSA9ICd0ZXh0JztcclxuICBmaWVsZC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4ZmllbGQnO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnbWF4bGVuZ3RoJywgJzcnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ2F1dG9jb21wbGV0ZScsICdvZmYnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSGV4IGNvbG91ciB2YWx1ZScpO1xyXG4gIGZpZWxkLnBsYWNlaG9sZGVyID0gJ1JSR0dCQic7XHJcbiAgcm93LmFwcGVuZChsYWJlbCwgZmllbGQpO1xyXG4gIHJldHVybiB7IHJvdywgZmllbGQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gYXR0YWNoKGlucHV0KSB7XHJcbiAgaWYgKCFpbnB1dCB8fCBpbnB1dC5kYXRhc2V0LmNwQXR0YWNoZWQpIHJldHVybjtcclxuICBpbnB1dC5kYXRhc2V0LmNwQXR0YWNoZWQgPSAnMSc7XHJcbiAgY29uc3QgaW5pdGlhbCA9IF9ub3JtYWxpemVIZXgoaW5wdXQudmFsdWUpIHx8ICcnO1xyXG4gIGlucHV0LnR5cGUgPSAnaGlkZGVuJztcclxuICBpbnB1dC52YWx1ZSA9IGluaXRpYWw7XHJcblxyXG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgd3JhcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXInO1xyXG4gIGlucHV0LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHdyYXAsIGlucHV0KTtcclxuXHJcbiAgY29uc3QgdHJpZ2dlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIHRyaWdnZXIudHlwZSA9ICdidXR0b24nO1xyXG4gIHRyaWdnZXIuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXRyaWdnZXInO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWhhc3BvcHVwJywgJ3RydWUnKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0Nob29zZSBjb2xvdXInKTtcclxuXHJcbiAgY29uc3QgcG9wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcG9wLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wb3AnO1xyXG4gIHBvcC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZGlhbG9nJyk7XHJcbiAgcG9wLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDb2xvdXIgcGlja2VyJyk7XHJcbiAgY29uc3QgeyByb3c6IGhleFJvdywgZmllbGQ6IGhleEZpZWxkIH0gPSBfYnVpbGRIZXhSb3coKTtcclxuICBwb3AuYXBwZW5kQ2hpbGQoaGV4Um93KTtcclxuXHJcbiAgd3JhcC5hcHBlbmQodHJpZ2dlciwgaW5wdXQsIHBvcCk7XHJcbiAgY29uc3QgY3R4ID0gX21ha2VDb250ZXh0KGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkKTtcclxuXHJcbiAgX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIGlucHV0LnZhbHVlKTtcclxuICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCBpbnB1dC52YWx1ZSkpO1xyXG4gIHRyaWdnZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChfb3BlbkN0eCAmJiBfb3BlbkN0eC50cmlnZ2VyID09PSB0cmlnZ2VyKSBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgICBlbHNlIF9vcGVuUG9wb3ZlcihjdHgpO1xyXG4gIH0pO1xyXG4gIHBvcC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtcmVtb3ZlJyk7XHJcbiAgICBpZiAocmVtb3ZlQnRuKSB7IF9yZW1vdmVQYWxldHRlRW50cnkoY3R4LCByZW1vdmVCdG4uZGF0YXNldC5uYW1lKTsgcmV0dXJuOyB9XHJcbiAgICBpZiAoZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtYWRkJykpIHsgX2FkZFBhbGV0dGVFbnRyeShjdHgpOyByZXR1cm47IH1cclxuICAgIGNvbnN0IHN3YXRjaCA9IGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1zd2F0Y2gnKTtcclxuICAgIGlmICghc3dhdGNoKSByZXR1cm47XHJcbiAgICBfY29tbWl0KGN0eCwgc3dhdGNoLmRhdGFzZXQuY29sb3IpO1xyXG4gICAgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gIH0pO1xyXG4gIHBvcC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicgJiYgZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnKSkge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIF9hZGRQYWxldHRlRW50cnkoY3R4KTtcclxuICAgIH1cclxuICB9KTtcclxuICBfd2lyZUhleEZpZWxkKGN0eCk7XHJcbn1cclxuXHJcbi8vIENsb3NlIHRoZSBvcGVuIHBvcG92ZXIgb24gYW4gb3V0c2lkZSBjbGljayBvciBFc2NhcGUuIFJlZ2lzdGVyZWQgb25jZS5cclxuLy8gQSBjbGljayB0aGF0IHJlLXJlbmRlcnMgdGhlIHBvcG92ZXIgKFNhdmUgLyByZW1vdmUgYSBwYWxldHRlIGVudHJ5KSBkZXRhY2hlc1xyXG4vLyBpdHMgb3duIHRhcmdldCBiZWZvcmUgdGhpcyBidWJibGluZyBoYW5kbGVyIHJ1bnM7IHN1Y2ggYSB0YXJnZXQgaXMgbm8gbG9uZ2VyIGluXHJcbi8vIHRoZSBkb2N1bWVudCwgc28gc2tpcCBpdCByYXRoZXIgdGhhbiBtaXN0YWtpbmcgaXQgZm9yIGFuIG91dHNpZGUgY2xpY2suXHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGlmICghZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKGUudGFyZ2V0KSkgcmV0dXJuO1xyXG4gIGlmICghX29wZW5DdHgucG9wLnBhcmVudE5vZGUuY29udGFpbnMoZS50YXJnZXQpKSBfY2xvc2VQb3BvdmVyKCk7XHJcbn0pO1xyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHsgX2Nsb3NlUG9wb3Zlcih0cnVlKTsgcmV0dXJuOyB9XHJcbiAgaWYgKGUua2V5ID09PSAnVGFiJykgX3RyYXBGb2N1cyhlKTtcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgQ29sb3JQaWNrZXIgPSB7IGF0dGFjaCwgX25vcm1hbGl6ZUhleCwgUkVDRU5UX0tFWSwgUEFMRVRURV9LRVkgfTtcclxuIiwgIi8vIEluZnJhc3RydWN0dXJlIC0gUGFuZWxOYXYgdGFrZW92ZXIgZnJhbWV3b3JrIChub3QgYSBmZWF0dXJlIG1vZHVsZSkuXHJcbi8vICAgVXNlZCBieTogc3BsaXQuanMsIGNsaXBjcmVhdGUuanMsIGV4cG9ydGVkaXRvci5qcywgbmFtZWNvcnJlY3Rpb25zLmpzIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3BhbmVsbmF2LnB5XHJcbi8vIOKUgOKUgCBwYW5lbCBuYXZpZ2F0aW9uIGZyYW1ld29yayDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gTXVsdGktc3RlcCBmbG93cyAoU3BsaXQgRWRpdG9yLCBhbmQgZnV0dXJlIHBpY2tlcnMpIHRha2Ugb3ZlciB0aGUgbWFpblxyXG4vLyBkZXRhaWwgcGFuZWwgaW5zdGVhZCBvZiB1c2luZyBhIG1vZGFsOiBzaGFyZWQgYnJlYWRjcnVtYiwgc2hhcmVkIGRpcnR5LXN0YXRlXHJcbi8vIGRpc2NhcmQgcHJvbXB0LiBFYWNoIG9wZW4gcGFuZWwgZ2V0cyBpdHMgb3duIGNvbnRlbnQgY29udGFpbmVyIHNvIGEgZnV0dXJlXHJcbi8vIG5lc3RlZCBwYW5lbCAoZS5nLiBtYW51YWwtY2xpcCdzIHBpY2tlciBvbiB0b3Agb2YgYSByZWNvcmRpbmcgdmlldykgY2FuIGJlXHJcbi8vIHVud291bmQgb25lIGxldmVsIGF0IGEgdGltZSB3aXRob3V0IHJlLXJ1bm5pbmcgdGhlIHBhcmVudCdzIHJlbmRlcigpLlxyXG4vL1xyXG4vLyBUaGUgY29udGFpbmVyIGlzIGRlc3Ryb3llZCBvbiBjbG9zZSByaWdodCBhZnRlciBvbkNsb3NlKCkgcnVucy4gSWYgcmVuZGVyKClcclxuLy8gcmVwYXJlbnRlZCBhbiBleGlzdGluZyBzdGF0aWMgZWxlbWVudCAocmF0aGVyIHRoYW4gYnVpbGRpbmcgZnJlc2ggRE9NKSxcclxuLy8gb25DbG9zZSgpIG11c3QgbW92ZSBpdCBiYWNrIG91dCB0byBhIHN0YWJsZSwgYWx3YXlzLWluLWRvY3VtZW50IGxvY2F0aW9uIC1cclxuLy8gb3RoZXJ3aXNlIGl0IGdvZXMgd2l0aCB0aGUgY29udGFpbmVyIGFuZCBnZXRFbGVtZW50QnlJZCBjYW4ndCBmaW5kIGl0IG9uXHJcbi8vIHRoZSBuZXh0IG9wZW4uIFNlZSBzcGxpdC5qcydzIF90ZWFyZG93blNwbGl0RWRpdG9yIGZvciB0aGUgcGF0dGVybi5cclxuXHJcbmNvbnN0IF9zdGFjayA9IFtdOyAgLy8gW3tpZCwgdGl0bGUsIGlzRGlydHksIG9uQ2xvc2UsIGNvbnRhaW5lcn1dXHJcblxyXG5mdW5jdGlvbiBfcm9vdCgpICAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1yb290Jyk7IH1cclxuZnVuY3Rpb24gX2NydW1iKCkgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtYnJlYWRjcnVtYicpOyB9XHJcbmZ1bmN0aW9uIF9tb3VudCgpICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LWNvbnRlbnQnKTsgfVxyXG5mdW5jdGlvbiBfdG9wKCkgICAgIHsgcmV0dXJuIF9zdGFja1tfc3RhY2subGVuZ3RoIC0gMV0gfHwgbnVsbDsgfVxyXG5cclxuZnVuY3Rpb24gX3JlbmRlckJyZWFkY3J1bWIoKSB7XHJcbiAgY29uc3QgdG9wID0gX3RvcCgpO1xyXG4gIGNvbnN0IGNydW1iID0gX2NydW1iKCk7XHJcbiAgY3J1bWIuaW5uZXJIVE1MID0gJyc7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICBjb25zdCBiYWNrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYmFjay50eXBlID0gJ2J1dHRvbic7XHJcbiAgYmFjay5jbGFzc05hbWUgPSAnYnRuIGdob3N0JztcclxuICBiYWNrLnN0eWxlLmNzc1RleHQgPSAncGFkZGluZzo0cHggMTBweDtmb250LXNpemU6MTNweCc7XHJcbiAgYmFjay50ZXh0Q29udGVudCA9ICfihpAgQmFjayc7XHJcbiAgYmFjay5vbmNsaWNrID0gKCkgPT4gcGFuZWxOYXZDbG9zZSgpO1xyXG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIHRpdGxlLnN0eWxlLmNzc1RleHQgPSAnZm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NjAwJztcclxuICB0aXRsZS50ZXh0Q29udGVudCA9IHRvcC50aXRsZTtcclxuICBjcnVtYi5hcHBlbmQoYmFjaywgdGl0bGUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfdXBkYXRlVmlzaWJpbGl0eSgpIHtcclxuICBfc3RhY2suZm9yRWFjaCgoZW50cnksIGkpID0+IHtcclxuICAgIGVudHJ5LmNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gaSA9PT0gX3N0YWNrLmxlbmd0aCAtIDEgPyAnZmxleCcgOiAnbm9uZSc7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2T3Blbih7IGlkLCB0aXRsZSwgcmVuZGVyLCBpc0RpcnR5LCBvbkNsb3NlIH0pIHtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBjb250YWluZXIuZGF0YXNldC5wYW5lbElkID0gaWQ7XHJcbiAgY29udGFpbmVyLnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6MTZweCc7XHJcbiAgX21vdW50KCkuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxuICBfc3RhY2sucHVzaCh7XHJcbiAgICBpZCxcclxuICAgIHRpdGxlLFxyXG4gICAgaXNEaXJ0eTogaXNEaXJ0eSB8fCAoKCkgPT4gZmFsc2UpLFxyXG4gICAgb25DbG9zZTogb25DbG9zZSB8fCAoKCkgPT4ge30pLFxyXG4gICAgY29udGFpbmVyLFxyXG4gIH0pO1xyXG4gIF9yb290KCkuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcclxuICBfdXBkYXRlVmlzaWJpbGl0eSgpO1xyXG4gIF9yZW5kZXJCcmVhZGNydW1iKCk7XHJcbiAgcmVuZGVyKGNvbnRhaW5lcik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9jbG9zZVRvcCgpIHtcclxuICBjb25zdCB0b3AgPSBfc3RhY2sucG9wKCk7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICB0b3Aub25DbG9zZSgpO1xyXG4gIHRvcC5jb250YWluZXIucmVtb3ZlKCk7XHJcbiAgaWYgKF9zdGFjay5sZW5ndGggPT09IDApIHtcclxuICAgIF9yb290KCkuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICB9IGVsc2Uge1xyXG4gICAgX3VwZGF0ZVZpc2liaWxpdHkoKTtcclxuICAgIF9yZW5kZXJCcmVhZGNydW1iKCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdkNsb3NlKCkge1xyXG4gIGNvbnN0IHRvcCA9IF90b3AoKTtcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIGlmICh0b3AuaXNEaXJ0eSgpKSB7XHJcbiAgICB3aW5kb3cuc2hvd0NvbmZpcm0oXHJcbiAgICAgICdEaXNjYXJkIGNoYW5nZXM/JyxcclxuICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgY2hhbmdlcy4gQ2xvc2Ugd2l0aG91dCBzYXZpbmc/JyxcclxuICAgICAgJ0Rpc2NhcmQnLFxyXG4gICAgICBfY2xvc2VUb3AsXHJcbiAgICAgIHRydWUsXHJcbiAgICApO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBfY2xvc2VUb3AoKTtcclxufVxyXG5cclxuLy8gRm9yY2UtY2xvc2UgdGhlIHRvcG1vc3QgcGFuZWwsIGJ5cGFzc2luZyB0aGUgZGlydHkgZ2F0ZSAtIGZvciBjYWxsZXJzIHRoYXRcclxuLy8gaGF2ZSBhbHJlYWR5IGNvbmZpcm1lZCB0aGUgZGlzY2FyZCB0aHJvdWdoIHRoZWlyIG93biAoZGlmZmVyZW50bHkgd29yZGVkKVxyXG4vLyBwcm9tcHQsIGUuZy4gc3dpdGNoaW5nIHJlY29yZGluZ3Mgd2hpbGUgdGhlIFNwbGl0IEVkaXRvciBpcyBkaXJ0eS5cclxuZnVuY3Rpb24gcGFuZWxOYXZGb3JjZUNsb3NlKCkge1xyXG4gIF9jbG9zZVRvcCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdklzT3BlbihpZCkge1xyXG4gIGlmIChpZCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gX3N0YWNrLmxlbmd0aCA+IDA7XHJcbiAgcmV0dXJuIF9zdGFjay5zb21lKGVudHJ5ID0+IGVudHJ5LmlkID09PSBpZCk7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBQYW5lbE5hdiA9IHtcclxuICBvcGVuOiBwYW5lbE5hdk9wZW4sIGNsb3NlOiBwYW5lbE5hdkNsb3NlLCBmb3JjZUNsb3NlOiBwYW5lbE5hdkZvcmNlQ2xvc2UsIGlzT3BlbjogcGFuZWxOYXZJc09wZW4sXHJcbn07XHJcbiIsICIvLyBGZWF0dXJlLW1hcCAtIExvbmctcnVubmluZy1qb2IgbWFjaGluZXJ5OiB0aGUgam9iLXN0YXR1cyBoZWFkZXIgKHN0ZXAgcGlsbHMsIHRpbWVyLCBFVEEpLCB0aGVcbi8vICAgcGF1c2UvcmVzdW1lICsgdGhlcm1hbCBhdXRvLXBhdXNlIFVJLCB0aGUgZmV0Y2gtYmFzZWQgU1NFIHRyYW5zcG9ydCAoX29wZW5TU0Uvc3RyZWFtU1NFKSwgdGhlXG4vLyAgIHNpbmdsZS1hY3RpdmUtc3RyZWFtIHN1cGVyc2VkZSBjb250cmFjdCwgYW5kIHRoZSBzaGFyZWQgQ2FuY2VsIGJ1dHRvbi5cbi8vICAgQVBJOiByb3V0ZXMvYW5hbHl6ZS5weSwgcm91dGVzL3Njb3JpbmcucHkgKFNTRSBlbmRwb2ludHMpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5LCB0ZXN0cy91aS90ZXN0X3VpX3NzZS5weVxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IGVzY0h0bWwsIGZvcm1hdEFwaUVycm9yLCBfZm10RWxhcHNlZCB9IGZyb20gJy4vZm9ybWF0LmpzJztcblxuLy8g4pSA4pSAIHNoYXJlZCBsaXZlIGpvYi1yZW5kZXIgc3RhdGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBSZWFkIGNyb3NzLWZpbGUgYnkgdmlkZW9zLmpzJ3MgY29tcGFjdCBzdGVwIHN0cmlwIChiYXJlIGlkZW50aWZpZXJzIF9qb2JTdGVwRGVmcyxcbi8vIF9hY3RpdmVTdGVwSWR4LCBfam9iU3RhcnRUaW1lKSBhbmQgYnkgdGhlIFBsYXl3cmlnaHQgVUktdGVzdCBzdWl0ZSwgd2hpY2ggc2VlZHNcbi8vIHNldmVyYWwgb2YgdGhlc2UgZGlyZWN0bHkgdmlhIHBhZ2UuZXZhbHVhdGUuIEJvdGggc2lkZXMgYXJlIGNsYXNzaWMsIG5vbi1tb2R1bGVcbi8vIGNvZGUsIHNvIHRoZXkgY2FuIG9ubHkgZXZlciByZWFjaCB0aGVzZSBhcyBgd2luZG93YCBwcm9wZXJ0aWVzIC0gbmV2ZXIgdmlhIGFuIEVTTVxuLy8gaW1wb3J0LiBBIG9uZS1zaG90IGB3aW5kb3cuWCA9IFhgIHNuYXBzaG90IHdvdWxkIGdvIHN0YWxlIHRoZSBpbnN0YW50IGpvYnMuanNcbi8vIHJlYXNzaWducyBYLCBzbyBlYWNoIG5hbWUgZ2V0cyBhIGxpdmUgZ2V0L3NldCBicmlkZ2Ugb250byBgd2luZG93YCBiZWxvdyBpbnN0ZWFkXG4vLyBvZiBhIHBsYWluIE9iamVjdC5hc3NpZ24gZXhwb3J0LlxubGV0IF9qb2JTdGVwRGVmcyAgID0gW107XG5sZXQgX2FjdGl2ZUVTICAgICAgPSBudWxsO1xubGV0IF9qb2JTdGFydFRpbWUgID0gMDtcbmxldCBfYWN0aXZlU3RlcElkeCA9IC0xO1xuXG4vLyBQZXItc3RlcCBwcm9ncmVzcyBhY2NvdW50aW5nIGZvciB0aGUgc3RlcC1waWxsIEVUQSBoZXVyaXN0aWMuIE5vdCByZWFkIGJ5IG90aGVyXG4vLyBwcm9kdWN0aW9uIG1vZHVsZXMsIGJ1dCB0aGUgc3RlcC1waWxsIC8gRVRBIC8gbGl2ZS1wYW5lbCB0ZXN0cyBzZWVkIHRoZW0gZGlyZWN0bHlcbi8vIHZpYSBwYWdlLmV2YWx1YXRlLCBzbyB0aGV5IG5lZWQgdGhlIHNhbWUgd2luZG93IGJyaWRnZSBhcyB0aGUgYmxvY2sgYWJvdmUuXG5sZXQgX3N0ZXBTdGFydFRpbWUgPSAwO1xubGV0IF9zdGVwUHJvZ3Jlc3MgID0ge307IC8vIHN0ZXBJZHggLT4ge2N1cnJlbnQsIHRvdGFsfSwgY2xlYXJlZCBwZXIgam9iXG5sZXQgX3N0ZXBSYXRlQW5jaG9yID0ge307IC8vIHN0ZXBJZHggLT4ge3QsIGN1cnJlbnR9IGF0IGZpcnN0IG9ic2VydmVkIGNvdW50LCBjbGVhcmVkIHBlciBqb2JcblxuZm9yIChjb25zdCBbbmFtZSwgZ2V0LCBzZXRdIG9mIFtcbiAgWydfam9iU3RlcERlZnMnLCAgICAoKSA9PiBfam9iU3RlcERlZnMsICAgIHYgPT4geyBfam9iU3RlcERlZnMgPSB2OyB9XSxcbiAgWydfYWN0aXZlRVMnLCAgICAgICAoKSA9PiBfYWN0aXZlRVMsICAgICAgIHYgPT4geyBfYWN0aXZlRVMgPSB2OyB9XSxcbiAgWydfam9iU3RhcnRUaW1lJywgICAoKSA9PiBfam9iU3RhcnRUaW1lLCAgIHYgPT4geyBfam9iU3RhcnRUaW1lID0gdjsgfV0sXG4gIFsnX2FjdGl2ZVN0ZXBJZHgnLCAgKCkgPT4gX2FjdGl2ZVN0ZXBJZHgsICB2ID0+IHsgX2FjdGl2ZVN0ZXBJZHggPSB2OyB9XSxcbiAgWydfc3RlcFN0YXJ0VGltZScsICAoKSA9PiBfc3RlcFN0YXJ0VGltZSwgIHYgPT4geyBfc3RlcFN0YXJ0VGltZSA9IHY7IH1dLFxuICBbJ19zdGVwUHJvZ3Jlc3MnLCAgICgpID0+IF9zdGVwUHJvZ3Jlc3MsICAgdiA9PiB7IF9zdGVwUHJvZ3Jlc3MgPSB2OyB9XSxcbiAgWydfc3RlcFJhdGVBbmNob3InLCAoKSA9PiBfc3RlcFJhdGVBbmNob3IsIHYgPT4geyBfc3RlcFJhdGVBbmNob3IgPSB2OyB9XSxcbl0pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHdpbmRvdywgbmFtZSwge2dldCwgc2V0LCBjb25maWd1cmFibGU6IHRydWV9KTtcbn1cblxuLy8g4pSA4pSAIHByb2dyZXNzIGluZGljYXRvciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIGVzdE1hdGNoOiBzdWJzdHJpbmdzIHRoYXQgbWFwIHRoaXMgcGlsbCB0byBhIHN0ZXAgbmFtZSBmcm9tIC9hcGkvZXN0aW1hdGUsIHNvXG4vLyB0aGUgcHJvZ3Jlc3MgcGlsbCBjYW4gc2hvdyBpdHMgcHJlLXJ1biB0aW1lIGVzdGltYXRlIGFzIGEgaG92ZXIgdG9vbHRpcC5cbi8vIHByb2dyZXNzUGF0dGVybjogcmVnZXggd2l0aCB0d28gY2FwdHVyZSBncm91cHMgKGN1cnJlbnQsIHRvdGFsKSBtYXRjaGVkXG4vLyBhZ2FpbnN0IGluY29taW5nIGxvZyBsaW5lcyB3aGlsZSB0aGlzIHN0ZXAgaXMgYWN0aXZlLCBzbyB0aGUgcGlsbCBjYW4gc2hvd1xuLy8gXCIzLzEyICgyNSUpXCIgYW5kIGEgbGl2ZSBFVEEgaW5zdGVhZCBvZiBqdXN0IGVsYXBzZWQgdGltZS5cbi8vIHN0YWdlOiB0aGUgbWFjaGluZS1yZWFkYWJsZSBpZCBmcm9tIHRoZSBAQFBST0dSRVNTIG1hcmtlciAoeXV1X2NsaXAvcGlwZWxpbmUvXG4vLyBwcm9ncmVzcy5weSBTdGFnZSkuIFRoZSBtYXJrZXIgZHJpdmVzIHRoZSBwaWxsIGRldGVybWluaXN0aWNhbGx5OyB0aGUgcGF0dGVybnMvXG4vLyBwcm9ncmVzc1BhdHRlcm4gcmVnZXhlcyBiZWxvdyBzdGF5IGFzIGEgb25lLXJlbGVhc2UgZmFsbGJhY2sgZm9yIHRoZSBodW1hbiBsb2dcbi8vIGxpbmVzLiBUaGUgc3RhZ2Ugc2V0IGhlcmUgaXMgY291cGxpbmctZ3VhcmRlZCBhZ2FpbnN0IHByb2dyZXNzLnB5IGJ5XG4vLyB0ZXN0cy91bml0L3Rlc3RfcHJvZ3Jlc3Nfc3RhZ2VfY291cGxpbmcucHkuXG5jb25zdCBJTkdFU1RfU1RFUFMgPSBbXG4gIHtsYWJlbDogJ0V4dHJhY3QnLCAgICAgICAgc3RhZ2U6ICdleHRyYWN0JywgICAgICAgIHBhdHRlcm5zOiBbJ0V4dHJhY3RpbmcgYXVkaW8nXSwgICAgICBlc3RNYXRjaDogWydleHRyYWN0IGF1ZGlvJ10sICBwcm9ncmVzc1BhdHRlcm46IC9UcmFjayAoXFxkKylcXC8oXFxkKykvfSxcbiAge2xhYmVsOiAnVHJhbnNjcmliZScsICAgICBzdGFnZTogJ3RyYW5zY3JpYmUnLCAgICAgcGF0dGVybnM6IFsnVHJhbnNjcmliaW5nJ10sICAgICAgICAgIGVzdE1hdGNoOiBbJ3RyYW5zY3JpYmUnLCAnbG9hZCBjYXB0aW9ucyddLCBwcm9ncmVzc1BhdHRlcm46IC9UcmFjayAoXFxkKylcXC8oXFxkKykvLCB3YWl0UGF0dGVybjogL1dhaXRpbmcgZm9yIHRoZSBzcGVlY2gtdG8tdGV4dCBtb2RlbC99LFxuICB7bGFiZWw6ICdTcGVha2VycycsICAgICAgIHN0YWdlOiAnc3BlYWtlcnMnLCAgICAgICBwYXR0ZXJuczogWydEZXRlY3Rpbmcgc3BlYWtlcnMnXSwgICAgZXN0TWF0Y2g6IFsnc3BlYWtlciBsYWJlbHMnXX0sXG4gIHtsYWJlbDogJ0dlbmVyYXRlIENsaXBzJywgc3RhZ2U6ICdnZW5lcmF0ZV9jbGlwcycsIHBhdHRlcm5zOiBbJ0dlbmVyYXRpbmcgY2xpcCddfSxcbiAge2xhYmVsOiAnRW5lcmd5JywgICAgICAgICBzdGFnZTogJ2VuZXJneScsICAgICAgICAgcGF0dGVybnM6IFsnQ29tcHV0aW5nIGF1ZGlvIGVuZXJneSddLCBlc3RNYXRjaDogWydhdWRpbyBlbmVyZ3knXX0sXG4gIHtsYWJlbDogJ1NjZW5lcycsICAgICAgICAgc3RhZ2U6ICdzY2VuZXMnLCAgICAgICAgIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzY2VuZSddLCAgICAgICBlc3RNYXRjaDogWydzY2VuZSBkZXRlY3Rpb24nXX0sXG4gIHtsYWJlbDogJ1Njb3JlJywgICAgICAgICAgc3RhZ2U6ICdzY29yZScsICAgICAgICAgIHBhdHRlcm5zOiBbJ1Njb3JpbmcgY2xpcHMnXSwgICAgICAgICBlc3RNYXRjaDogWydsbG0gc2NvcmluZyddLCBwcm9ncmVzc1BhdHRlcm46IC9TY29yaW5nIChcXGQrKVxcLyhcXGQrKS99LFxuXTtcbmNvbnN0IFNDT1JFX1NURVBTID0gW1xuICB7bGFiZWw6ICdFbmVyZ3knLCAgc3RhZ2U6ICdlbmVyZ3knLCBwYXR0ZXJuczogWydDb21wdXRpbmcgYXVkaW8gZW5lcmd5J119LFxuICB7bGFiZWw6ICdTY2VuZXMnLCAgc3RhZ2U6ICdzY2VuZXMnLCBwYXR0ZXJuczogWydEZXRlY3Rpbmcgc2NlbmUnXX0sXG4gIHtsYWJlbDogJ1Njb3JpbmcnLCBzdGFnZTogJ3Njb3JlJywgIHBhdHRlcm5zOiBbJ1Njb3JpbmcgY2xpcHMnXSwgcHJvZ3Jlc3NQYXR0ZXJuOiAvU2NvcmluZyAoXFxkKylcXC8oXFxkKykvfSxcbl07XG4vLyBNYXJrZXItZHJpdmVuIG9ubHkgKHRoZSBhbmFseXplLWZyYW1lcyBTU0UgZW1pdHMgbm8gcHJvc2Ugc3RhZ2UgbGluZXMpLCBzbyB0aGVzZVxuLy8gY2Fycnkgbm8gcGF0dGVybnMgLSBqdXN0IHRoZSB0d28gQEBQUk9HUkVTUyBzdGFnZXMgdGhlIHZpc2lvbiByb3V0ZSBlbWl0cy5cbmNvbnN0IEZSQU1FU19TVEVQUyA9IFtcbiAge2xhYmVsOiAnU2FtcGxlJywgICBzdGFnZTogJ2ZyYW1lc19zYW1wbGUnLCAgIHBhdHRlcm5zOiBbXX0sXG4gIHtsYWJlbDogJ0Rlc2NyaWJlJywgc3RhZ2U6ICdmcmFtZXNfZGVzY3JpYmUnLCBwYXR0ZXJuczogW119LFxuXTtcblxuLy8gVGhlIGZ1bGwgc2V0IG9mIGtub3duIEBAUFJPR1JFU1Mgc3RhZ2UgaWRzIC0gdGhlIEpTIG1pcnJvciBvZiBwcm9ncmVzcy5weSdzXG4vLyBTdGFnZSBlbnVtLiBmcmFtZXNfc2FtcGxlL2ZyYW1lc19kZXNjcmliZSBkcml2ZSB0aGUgYW5hbHl6ZS1mcmFtZXMgam9iLiBLZXB0XG4vLyBhcyBpdHMgb3duIHNldCAobm90IGRlcml2ZWQgZnJvbSB0aGUgc3RlcCBkZWZzKSBzbyBpdCBzdGF5cyB0aGUgY291cGxpbmdcbi8vIGFuY2hvciBldmVuIGZvciBzdGFnZXMgd2hvc2Ugc3RlcCBkZWYgbGl2ZXMgZWxzZXdoZXJlLlxuY29uc3QgX1BST0dSRVNTX1BSRUZJWCA9ICdAQFBST0dSRVNTICc7XG5jb25zdCBKT0JfU1RBR0VTID0gbmV3IFNldChbXG4gICdleHRyYWN0JywgJ3RyYW5zY3JpYmUnLCAnc3BlYWtlcnMnLCAnZ2VuZXJhdGVfY2xpcHMnLFxuICAnZW5lcmd5JywgJ3NjZW5lcycsICdzY29yZScsICdmcmFtZXNfc2FtcGxlJywgJ2ZyYW1lc19kZXNjcmliZScsXG5dKTtcblxuLy8gTWlycm9yIG9mIHByb2dyZXNzLnB5IHBhcnNlX3Byb2dyZXNzOiByZXR1cm5zIHRoZSBtYXJrZXIgcGF5bG9hZCwgb3IgbnVsbCBmb3Jcbi8vIGFueSBub24tbWFya2VyIC8gbWFsZm9ybWVkIC8gdW5rbm93bi1zdGFnZSBsaW5lIChzbyBvcmRpbmFyeSBsb2cgb3V0cHV0IGZhbGxzXG4vLyB0aHJvdWdoIHRvIHRoZSBwcm9zZSBmYWxsYmFjayByYXRoZXIgdGhhbiBiZWluZyBtaXNyZWFkIGFzIHByb2dyZXNzKS5cbmZ1bmN0aW9uIHBhcnNlUHJvZ3Jlc3MobGluZSkge1xuICBpZiAoIWxpbmUgfHwgIWxpbmUuc3RhcnRzV2l0aChfUFJPR1JFU1NfUFJFRklYKSkgcmV0dXJuIG51bGw7XG4gIGxldCBwYXlsb2FkO1xuICB0cnkgeyBwYXlsb2FkID0gSlNPTi5wYXJzZShsaW5lLnNsaWNlKF9QUk9HUkVTU19QUkVGSVgubGVuZ3RoKSk7IH1cbiAgY2F0Y2ggKGUpIHsgcmV0dXJuIG51bGw7IH1cbiAgaWYgKCFwYXlsb2FkIHx8IHR5cGVvZiBwYXlsb2FkICE9PSAnb2JqZWN0JyB8fCAhSk9CX1NUQUdFUy5oYXMocGF5bG9hZC5zdGFnZSkpIHJldHVybiBudWxsO1xuICByZXR1cm4gcGF5bG9hZDtcbn1cblxuLy8gc3RlcElkeCAtPiBhIHRyYW5zaWVudCBzdGF0dXMgbWVzc2FnZSBzaG93biBpbiBwbGFjZSBvZiB0aGUgc3RlcCdzIHRpbWluZ1xuLy8gbGFiZWwgKGUuZy4gXCJ3YWl0aW5nIGZvciB0aGUgc3BlZWNoIG1vZGVsIHRvIGZpbmlzaCBkb3dubG9hZGluZ1wiKS4gU2V0IHdoZW4gYVxuLy8gc3RlcCdzIHdhaXRQYXR0ZXJuIG1hdGNoZXMsIGNsZWFyZWQgd2hlbiB0aGF0IHN0ZXAgcmVwb3J0cyByZWFsIHByb2dyZXNzLlxubGV0IF9zdGVwV2FpdGluZ01zZyA9IHt9O1xubGV0IF9qb2JBY3RpdmUgICAgID0gZmFsc2U7XG5sZXQgX2FjdGl2ZUpvYkNsZWFudXAgPSBudWxsO1xubGV0IF9qb2JUaW1lciAgICAgID0gbnVsbDtcbmxldCBfam9iSGlkZVRpbWVyICA9IG51bGw7XG5sZXQgX2pvYlBhdXNhYmxlICAgPSBmYWxzZTtcbmxldCBfam9iUGF1c2VkICAgICA9IGZhbHNlO1xubGV0IF9qb2JUaGVybWFsUG9sbFRpbWVyID0gbnVsbDtcbmxldCBfbGFzdEdwdVN0YXRlICA9ICd1bmF2YWlsYWJsZSc7XG5cbi8vIEJlc3QtZWZmb3J0IGxvb2t1cCBvZiBhIHBpbGwncyBwcmUtcnVuIHRpbWUgZXN0aW1hdGUgKGZyb20gdGhlIGxhc3Rcbi8vIC9hcGkvZXN0aW1hdGUgY2FsbCwgc2F2ZWQgYnkgcmVuZGVyRXN0aW1hdGUpIGZvciB1c2UgYXMgYSBob3ZlciB0b29sdGlwLlxuZnVuY3Rpb24gX2VzdGltYXRlSG1zRm9yKHN0ZXBEZWYpIHtcbiAgY29uc3Qgc3RlcHMgPSBBcHBTdGF0ZS5sYXN0RXN0aW1hdGVTdGVwcztcbiAgaWYgKCFzdGVwcyB8fCAhc3RlcERlZi5lc3RNYXRjaCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IG1hdGNoID0gc3RlcHMuZmluZChlcyA9PlxuICAgIHN0ZXBEZWYuZXN0TWF0Y2guc29tZShrZXkgPT4gKGVzLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoa2V5KSlcbiAgKTtcbiAgcmV0dXJuIG1hdGNoID8gbWF0Y2guaG1zIDogbnVsbDtcbn1cblxuLy8gUGVyLWl0ZW0gYnV0dG9ucyB0aGF0IHRyaWdnZXIgYSBoZWF2eSBvcCBhcmUgdGFnZ2VkIGRhdGEtam9iLWJsb2NrZWQuIERpc2FibGVcbi8vIHRoZW0gKHdpdGggYSB3aHktdG9vbHRpcCkgd2hpbGUgYW55IGpvYiBydW5zIHNvIGEgdXNlciBjYW4ndCBzdGFydCBhIHNlY29uZCBqb2Jcbi8vIHRoZSBiYWNrZW5kIHdvdWxkIGp1c3QgNDA5LiBUaGUgaGVhZGVyICNidG4tYW5hbHl6ZSBpcyBoYW5kbGVkIGlubGluZSBiZWxvdy5cbi8vIHJlbmRlckRldGFpbCBjYWxscyBhcHBseUpvYkJsb2NrZWRTdGF0ZSgpIHNvIGEgcGFuZWwgcmVidWlsdCBtaWQtam9iIGNvbWVzIHVwXG4vLyBhbHJlYWR5IGRpc2FibGVkIC0gdGhlIHRhZyBsaXZlcyBpbiBmcmVzaGx5LWJ1aWx0IGlubmVySFRNTCwgbm90IGEgbGl2ZSBub2RlLlxuZnVuY3Rpb24gX3NldEpvYkJsb2NrZWRCdXR0b25zKGRpc2FibGVkKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWpvYi1ibG9ja2VkXScpLmZvckVhY2goYiA9PiB7XG4gICAgYi5kaXNhYmxlZCA9IGRpc2FibGVkO1xuICAgIGIudGl0bGUgPSBkaXNhYmxlZCA/ICdBbm90aGVyIGpvYiBpcyBydW5uaW5nIC0gd2FpdCBmb3IgaXQgdG8gZmluaXNoIG9yIGNhbmNlbCBpdCcgOiAnJztcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5Sm9iQmxvY2tlZFN0YXRlKCkgeyBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnMoX2pvYkFjdGl2ZSk7IH1cblxuZnVuY3Rpb24gc3RhcnRKb2JVSShzdGVwRGVmcywgam9iTGFiZWwsIGNhbmNlbGxhYmxlID0gZmFsc2UsIHBhdXNhYmxlID0gZmFsc2UpIHtcbiAgX2pvYkFjdGl2ZSAgICAgPSB0cnVlO1xuICBfam9iU3RlcERlZnMgICA9IHN0ZXBEZWZzO1xuICBfYWN0aXZlU3RlcElkeCA9IC0xO1xuICBfam9iU3RhcnRUaW1lICA9IERhdGUubm93KCk7XG4gIF9zdGVwU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgX3N0ZXBQcm9ncmVzcyAgPSB7fTtcbiAgX3N0ZXBSYXRlQW5jaG9yID0ge307XG4gIF9zdGVwV2FpdGluZ01zZyA9IHt9O1xuICBfam9iUGF1c2FibGUgICA9IHBhdXNhYmxlO1xuICBfam9iUGF1c2VkICAgICA9IGZhbHNlO1xuICBfYWN0aXZlQ2FuY2VsICA9IF9BTkFMWVpFX0NBTkNFTDtcbiAgaWYgKF9qb2JUaW1lcikgY2xlYXJJbnRlcnZhbChfam9iVGltZXIpO1xuICBfam9iVGltZXIgPSBzZXRJbnRlcnZhbChfdGlja0pvYlRpbWVyLCAxMDAwKTtcbiAgaWYgKF9qb2JIaWRlVGltZXIpIHsgY2xlYXJUaW1lb3V0KF9qb2JIaWRlVGltZXIpOyBfam9iSGlkZVRpbWVyID0gbnVsbDsgfVxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXN0ZXBzJykuaW5uZXJIVE1MID1cbiAgICBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7bWFyZ2luLXJpZ2h0OjRweFwiPiR7ZXNjSHRtbChqb2JMYWJlbCl9PC9zcGFuPmAgK1xuICAgIHN0ZXBEZWZzLm1hcCgocywgaSkgPT4ge1xuICAgICAgY29uc3QgZXN0ID0gX2VzdGltYXRlSG1zRm9yKHMpO1xuICAgICAgY29uc3QgdGl0bGUgPSBlc3QgPyBgIHRpdGxlPVwiRXN0aW1hdGVkOiAke2VzY0h0bWwoZXN0KX1cImAgOiAnJztcbiAgICAgIHJldHVybiBgPHNwYW4gY2xhc3M9XCJzdGVwXCIgaWQ9XCJzdGVwLSR7aX1cIiR7dGl0bGV9PiR7cy5sYWJlbH08L3NwYW4+YDtcbiAgICB9KS5qb2luKCcnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1zdGF0dXMnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWFkZXItc3BhY2VyJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI2J0bi1hbmFseXplLCNidG4tc2NvcmUnKS5mb3JFYWNoKGIgPT4gYi5kaXNhYmxlZCA9IHRydWUpO1xuICBjb25zdCBhbmFseXplQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1hbmFseXplJyk7XG4gIGlmIChhbmFseXplQnRuKSBhbmFseXplQnRuLnRpdGxlID0gJ0Egam9iIGlzIGFscmVhZHkgcnVubmluZyc7XG4gIF9zZXRKb2JCbG9ja2VkQnV0dG9ucyh0cnVlKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jYW5jZWwtam9iJykuc3R5bGUuZGlzcGxheSA9IGNhbmNlbGxhYmxlID8gJycgOiAnbm9uZSc7XG4gIF9yZW5kZXJQYXVzZVVJKCk7XG4gIGlmIChfam9iVGhlcm1hbFBvbGxUaW1lcikgY2xlYXJJbnRlcnZhbChfam9iVGhlcm1hbFBvbGxUaW1lcik7XG4gIGlmIChwYXVzYWJsZSkge1xuICAgIF9sYXN0R3B1U3RhdGUgPSAndW5hdmFpbGFibGUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItZ3B1LXRlbXAnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIF9wb2xsVGhlcm1hbFN0YXR1cygpO1xuICAgIF9qb2JUaGVybWFsUG9sbFRpbWVyID0gc2V0SW50ZXJ2YWwoX3BvbGxUaGVybWFsU3RhdHVzLCA1MDAwKTtcbiAgfVxuICBpZiAod2luZG93Ll9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKSBfcmVuZGVyQ2xpcEZpbHRlckNvdW50cygpO1xufVxuXG4vLyBQb2xsZWQgZXZlcnkgNXMgKG9ubHkgd2hpbGUgYSBwYXVzYWJsZSAtIGkuZS4gYW5hbHl6ZS10eXBlIC0gam9iIGlzIGFjdGl2ZSkgdG9cbi8vIGRyaXZlIHRoZSBqb2ItaGVhZGVyIEdQVSB0ZW1wZXJhdHVyZSByZWFkb3V0IGFuZCB0aGUgd2Fybi9hdXRvLXBhdXNlIG5vdGljZXMuXG4vLyBVc2VzIC9hcGkvc3RhdHVzIHJhdGhlciB0aGFuIFNTRSBsb2ctbGluZSBtYXRjaGluZyBzbyBpdCBhbHNvIHdvcmtzIGNvcnJlY3RseVxuLy8gYWNyb3NzIHRoZSBKUyBzZXF1ZW50aWFsLXNlZ21lbnQgcnVubmVycycgZ2FwcyBiZXR3ZWVuIHBlci1zZWdtZW50IGpvYnMuXG5hc3luYyBmdW5jdGlvbiBfcG9sbFRoZXJtYWxTdGF0dXMoKSB7XG4gIGNvbnN0IHN0YXR1cyA9IGF3YWl0IGZldGNoKCcvYXBpL3N0YXR1cycpLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gIGlmICghc3RhdHVzKSByZXR1cm47XG4gIGNvbnN0IHJlYWRvdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWdwdS10ZW1wJyk7XG4gIGlmIChyZWFkb3V0KSB7XG4gICAgaWYgKHN0YXR1cy5ncHVfdGVtcF9jID09IG51bGwpIHtcbiAgICAgIHJlYWRvdXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmVhZG91dC5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgICByZWFkb3V0LmNsYXNzTmFtZSA9ICdncHUtdGVtcC1yZWFkb3V0JyArIChzdGF0dXMuZ3B1X3N0YXRlID09PSAnb2snID8gJycgOiBgICR7c3RhdHVzLmdwdV9zdGF0ZX1gKTtcbiAgICAgIHJlYWRvdXQudGV4dENvbnRlbnQgPSBgR1BVICR7TWF0aC5yb3VuZChzdGF0dXMuZ3B1X3RlbXBfYyl9wrBDYDtcbiAgICB9XG4gIH1cbiAgaWYgKHN0YXR1cy5ncHVfc3RhdGUgPT09ICd3YXJuJyAmJiBfbGFzdEdwdVN0YXRlICE9PSAnd2FybicgJiYgX2xhc3RHcHVTdGF0ZSAhPT0gJ3BhdXNlJykge1xuICAgIGNvbnN0IG5leHQgPSBzdGF0dXMudGhlcm1hbF9hdXRvcGF1c2VfZW5hYmxlZFxuICAgICAgPyBgQW5hbHlzaXMgd2lsbCBhdXRvLXBhdXNlIGlmIGl0IHJlYWNoZXMgJHtNYXRoLnJvdW5kKHN0YXR1cy50aGVybWFsX3BhdXNlX2MpfcKwQy5gXG4gICAgICA6IGBBdXRvLXBhdXNlIGlzIG9mZiAtIHBhdXNlIHRoZSBqb2IgbWFudWFsbHkgaWYgaXQga2VlcHMgY2xpbWJpbmcuYDtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KGBHUFUgcnVubmluZyBob3QgLSAke01hdGgucm91bmQoc3RhdHVzLmdwdV90ZW1wX2MpfcKwQy4gJHtuZXh0fWAsICd3YXJuaW5nJyk7XG4gIH1cbiAgaWYgKHN0YXR1cy5ncHVfc3RhdGUgPT09ICdwYXVzZScgJiYgX2xhc3RHcHVTdGF0ZSAhPT0gJ3BhdXNlJykge1xuICAgIF9qb2JQYXVzZWQgPSB0cnVlO1xuICAgIF9yZW5kZXJQYXVzZVVJKCk7XG4gICAgd2luZG93LnNob3dUb2FzdChgQXV0by1wYXVzZWQ6IEdQVSByZWFjaGVkICR7TWF0aC5yb3VuZChzdGF0dXMuZ3B1X3RlbXBfYyl9wrBDIC0gd2lsbCBob2xkIGJlZm9yZSB0aGUgbmV4dCB2aWRlb2AsICd3YXJuaW5nJywge1xuICAgICAgZHVyYXRpb25NczogMjAwMDAsXG4gICAgICBhY3Rpb246IHtsYWJlbDogJ1Jlc3VtZSBub3cnLCBvbkNsaWNrOiB0b2dnbGVQYXVzZUpvYn0sXG4gICAgfSk7XG4gIH1cbiAgX2xhc3RHcHVTdGF0ZSA9IHN0YXR1cy5ncHVfc3RhdGU7XG59XG5cbi8vIFwiUGF1c2UgYWZ0ZXIgY3VycmVudCB2aWRlb1wiIHRvZ2dsZSBpbiB0aGUgam9iIGhlYWRlciAtIG9ubHkgc2hvd24gZm9yIGpvYnNcbi8vIGJhY2tlZCBieSB0aGUgcGF1c2UgZmxhZyBmaWxlICh0aGUgc2luZ2xlIGFuYWx5emUgc3RyZWFtIGFuZCB0aGUgSlNcbi8vIHNlcXVlbnRpYWwtc2VnbWVudCBydW5uZXJzOyBzZWUgdG9nZ2xlUGF1c2VKb2IpLlxuZnVuY3Rpb24gX3JlbmRlclBhdXNlVUkoKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tcGF1c2Utam9iJyk7XG4gIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1wYXVzZWQtYmFkZ2UnKTtcbiAgaWYgKCFidG4gfHwgIWJhZGdlKSByZXR1cm47XG4gIGJ0bi5zdHlsZS5kaXNwbGF5ID0gX2pvYlBhdXNhYmxlID8gJycgOiAnbm9uZSc7XG4gIGJ0bi50ZXh0Q29udGVudCA9IF9qb2JQYXVzZWQgPyAnUmVzdW1lJyA6ICdQYXVzZSBhZnRlciBjdXJyZW50IHZpZGVvJztcbiAgYmFkZ2Uuc3R5bGUuZGlzcGxheSA9IF9qb2JQYXVzZWQgPyAnJyA6ICdub25lJztcbn1cblxuLy8gUmVmbGVjdHMgYW4gYWxyZWFkeS1wYXVzZWQgam9iIGRpc2NvdmVyZWQgdmlhIC9hcGkvc3RhdHVzIChwYWdlIHJlY29ubmVjdCkgLVxuLy8gZG9lcyBub3QgaXRzZWxmIGNhbGwgdGhlIHBhdXNlL3Jlc3VtZSBBUEkuXG5mdW5jdGlvbiBfc2V0UGF1c2VkVUlGcm9tU3RhdHVzKHBhdXNlZCkge1xuICBfam9iUGF1c2VkID0gISFwYXVzZWQ7XG4gIF9yZW5kZXJQYXVzZVVJKCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVBhdXNlSm9iKCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXBhdXNlLWpvYicpO1xuICBjb25zdCB3YW50UGF1c2UgPSAhX2pvYlBhdXNlZDtcbiAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS9hbmFseXplLyR7d2FudFBhdXNlID8gJ3BhdXNlJyA6ICdyZXN1bWUnfWAsIHttZXRob2Q6ICdQT1NUJ30pO1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIGlmICghcmVzLm9rKSB7XG4gICAgICB3aW5kb3cuc2hvd1RvYXN0KGZvcm1hdEFwaUVycm9yKGRhdGEpIHx8IGBDb3VsZCBub3QgJHt3YW50UGF1c2UgPyAncGF1c2UnIDogJ3Jlc3VtZSd9YCwgJ2Vycm9yJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChkYXRhLnN0YXR1cyA9PT0gJ25vLW9wJykge1xuICAgICAgd2luZG93LnNob3dUb2FzdChkYXRhLm1lc3NhZ2UgfHwgJ05vIGFuYWx5c2lzIGlzIHJ1bm5pbmcuJywgJ2luZm8nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgX2pvYlBhdXNlZCA9IHdhbnRQYXVzZTtcbiAgICBfcmVuZGVyUGF1c2VVSSgpO1xuICAgIHdpbmRvdy5zaG93VG9hc3Qod2FudFBhdXNlID8gJ1dpbGwgcGF1c2UgYmVmb3JlIHRoZSBuZXh0IHZpZGVvJyA6ICdSZXN1bWVkJywgJ2luZm8nKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgd2luZG93LnNob3dUb2FzdCh3aW5kb3cubmV0RXJyTXNnKGVyciksICdlcnJvcicpO1xuICB9IGZpbmFsbHkge1xuICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICB9XG59XG5cbi8vIE1hcmsgc3RlcCAqaWR4KiBhY3RpdmUgYW5kIGV2ZXJ5IGVhcmxpZXIgc3RlcCBkb25lLiBTaGFyZWQgYnkgdGhlIHByb3NlXG4vLyBtYXRjaGVyICh1cGRhdGVKb2JVSSkgYW5kIHRoZSBtYXJrZXIgcGF0aCAoX2RyaXZlU3RlcEZyb21NYXJrZXIpIHNvIGEgc3RhZ2Vcbi8vIGFkdmFuY2UgYmVoYXZlcyBpZGVudGljYWxseSBob3dldmVyIGl0IHdhcyBkZXRlY3RlZC5cbmZ1bmN0aW9uIF9hY3RpdmF0ZVN0ZXAoaWR4KSB7XG4gIGNvbnN0IHByZXZTdGVwSWR4ID0gX2FjdGl2ZVN0ZXBJZHg7XG4gIGZvciAobGV0IGogPSAwOyBqIDwgaWR4OyBqKyspIHtcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7an1gKTtcbiAgICBpZiAoZWwpIHsgZWwuY2xhc3NOYW1lID0gJ3N0ZXAgZG9uZSc7IGVsLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnOyBlbC50ZXh0Q29udGVudCA9ICfinJMnOyBlbC50aXRsZSA9IF9qb2JTdGVwRGVmc1tqXS5sYWJlbDsgfVxuICB9XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtpZHh9YCk7XG4gIGlmIChlbCkgeyBlbC5jbGFzc05hbWUgPSAnc3RlcCBhY3RpdmUnOyBfYWN0aXZlU3RlcElkeCA9IGlkeDsgfVxuICBpZiAoX2FjdGl2ZVN0ZXBJZHggIT09IHByZXZTdGVwSWR4KSB7XG4gICAgX3N0ZXBTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIC8vIFdoZW4gdGhlIHBpcGVsaW5lIGFkdmFuY2VzIGEgc3RhZ2UsIHJlZnJlc2ggdGhlIHNpZGViYXIgc28gYSBuZXdseS1hbmFseXppbmdcbiAgICAvLyByZWNvcmRpbmcgYXBwZWFycyAocmVwbGFjaW5nIGl0cyBwbGFjZWhvbGRlcikgYW5kIGl0cyBzdGF0dXMgc3RheXMgY3VycmVudCxcbiAgICAvLyBhbmQgcmVmcmVzaCB0aGUgb3BlbiBjbGlwIGxpc3QgdG8gcGljayB1cCBmcmVzaGx5LWNvbW1pdHRlZCBjbGlwcy9zY29yZXMuXG4gICAgX2RlYm91bmNlZFNpZGViYXJSZWZyZXNoKCk7XG4gICAgX2RlYm91bmNlZENsaXBMaXN0UmVmcmVzaCgpO1xuICB9XG59XG5cbi8vIFJlY29yZCBhIHN0ZXAncyBjdXJyZW50L3RvdGFsLCBhbmNob3JpbmcgdGhlIHRocm91Z2hwdXQgcmF0ZSBhdCB0aGUgZmlyc3Rcbi8vIG9ic2VydmVkIGNvdW50IHNvIGEgY29sZCBmaXJzdCBpdGVtIGlzIGV4Y2x1ZGVkIGZyb20gdGhlIEVUQSBleHRyYXBvbGF0aW9uLlxuZnVuY3Rpb24gX3NldFN0ZXBQcm9ncmVzcyhpZHgsIGN1cnJlbnQsIHRvdGFsKSB7XG4gIC8vIFJlYWwgcHJvZ3Jlc3MgbWVhbnMgYW55IHdhaXQgKGUuZy4gbW9kZWwgZG93bmxvYWQpIGlzIG92ZXIgLSBkcm9wIGl0IHNvIHRoZVxuICAvLyBwaWxsIHN3aXRjaGVzIGJhY2sgdG8gbGl2ZSBjb3VudHMuXG4gIGRlbGV0ZSBfc3RlcFdhaXRpbmdNc2dbaWR4XTtcbiAgX3N0ZXBQcm9ncmVzc1tpZHhdID0ge2N1cnJlbnQsIHRvdGFsfTtcbiAgaWYgKCFfc3RlcFJhdGVBbmNob3JbaWR4XSkgX3N0ZXBSYXRlQW5jaG9yW2lkeF0gPSB7dDogRGF0ZS5ub3coKSwgY3VycmVudH07XG4gIF9yZW5kZXJTdGVwUGlsbChpZHgpO1xuICBfZGVib3VuY2VkQ2xpcExpc3RSZWZyZXNoKCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUpvYlVJKGxpbmUpIHtcbiAgX2pvYlN0ZXBEZWZzLmZvckVhY2goKHMsIGkpID0+IHtcbiAgICBpZiAocy5wYXR0ZXJucy5zb21lKHAgPT4gbGluZS5pbmNsdWRlcyhwKSkpIF9hY3RpdmF0ZVN0ZXAoaSk7XG4gIH0pO1xuICBjb25zdCBhY3RpdmVEZWYgPSBfam9iU3RlcERlZnNbX2FjdGl2ZVN0ZXBJZHhdO1xuICBpZiAoYWN0aXZlRGVmICYmIGFjdGl2ZURlZi53YWl0UGF0dGVybiAmJiBhY3RpdmVEZWYud2FpdFBhdHRlcm4udGVzdChsaW5lKSkge1xuICAgIF9zdGVwV2FpdGluZ01zZ1tfYWN0aXZlU3RlcElkeF0gPSAnd2FpdGluZyBmb3IgdGhlIHNwZWVjaCBtb2RlbCB0byBmaW5pc2ggZG93bmxvYWRpbmcnO1xuICAgIF9yZW5kZXJTdGVwUGlsbChfYWN0aXZlU3RlcElkeCk7XG4gIH1cbiAgaWYgKGFjdGl2ZURlZiAmJiBhY3RpdmVEZWYucHJvZ3Jlc3NQYXR0ZXJuKSB7XG4gICAgY29uc3QgbSA9IGxpbmUubWF0Y2goYWN0aXZlRGVmLnByb2dyZXNzUGF0dGVybik7XG4gICAgaWYgKG0pIF9zZXRTdGVwUHJvZ3Jlc3MoX2FjdGl2ZVN0ZXBJZHgsIHBhcnNlSW50KG1bMV0sIDEwKSwgcGFyc2VJbnQobVsyXSwgMTApKTtcbiAgfVxuICBpZiAod2luZG93Ll9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwoKTtcbn1cblxuLy8gRHJpdmUgdGhlIHBpbGwgcm93IGZyb20gYSBwYXJzZWQgQEBQUk9HUkVTUyBtYXJrZXI6IGRldGVybWluaXN0aWMgc3RhZ2Vcbi8vIGFkdmFuY2UgcGx1cyBvcHRpb25hbCBjdXJyZW50L3RvdGFsLCBrZXllZCBvbiB0aGUgc3RlcCBkZWYncyBzdGFnZSBpZC5cbmZ1bmN0aW9uIF9kcml2ZVN0ZXBGcm9tTWFya2VyKG1hcmtlcikge1xuICBjb25zdCBpZHggPSBfam9iU3RlcERlZnMuZmluZEluZGV4KHMgPT4gcy5zdGFnZSA9PT0gbWFya2VyLnN0YWdlKTtcbiAgaWYgKGlkeCA8IDApIHJldHVybjtcbiAgX2FjdGl2YXRlU3RlcChpZHgpO1xuICBpZiAodHlwZW9mIG1hcmtlci5kb25lID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgbWFya2VyLnRvdGFsID09PSAnbnVtYmVyJyAmJiBtYXJrZXIudG90YWwgPiAwKSB7XG4gICAgX3NldFN0ZXBQcm9ncmVzcyhpZHgsIG1hcmtlci5kb25lLCBtYXJrZXIudG90YWwpO1xuICB9XG4gIGlmICh3aW5kb3cuX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpO1xufVxuXG5sZXQgX3NpZGViYXJSZWZyZXNoVGltZXIgPSBudWxsO1xuZnVuY3Rpb24gX2RlYm91bmNlZFNpZGViYXJSZWZyZXNoKCkge1xuICBpZiAoX3NpZGViYXJSZWZyZXNoVGltZXIpIHJldHVybjtcbiAgX3NpZGViYXJSZWZyZXNoVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHsgX3NpZGViYXJSZWZyZXNoVGltZXIgPSBudWxsOyB3aW5kb3cubG9hZFZpZGVvcygpOyB9LCAxMjAwKTtcbn1cblxubGV0IF9jbGlwTGlzdFJlZnJlc2hUaW1lciA9IG51bGw7XG4vLyBTYW1lIHB1c2gtZHJpdmVuLWJ1dC1kZWJvdW5jZWQgcGF0dGVybiBhcyBfZGVib3VuY2VkU2lkZWJhclJlZnJlc2ggYWJvdmUsXG4vLyB0cmlnZ2VyZWQgb2ZmIHRoZSBTU0UgbGluZSBzdHJlYW0gcmF0aGVyIHRoYW4gYSBwb2xsaW5nIHRpbWVyLiBPbmx5IHJlZnJlc2hlc1xuLy8gd2hlbiB0aGUgdmlkZW8gYmVpbmcgYW5hbHl6ZWQgaXMgdGhlIG9uZSBjdXJyZW50bHkgb3Blbiwgc28gbmV3bHktY29tbWl0dGVkXG4vLyBjbGlwIHNjb3JlcyAoeXV1X2NsaXAvc2NvcmluZy9lbmdpbmUucHkgbm93IGNvbW1pdHMgcGVyIGNsaXApIGZpbGwgaW50byB0aGVcbi8vIHZpc2libGUgbGlzdCBsaXZlIGluc3RlYWQgb2YgcmVxdWlyaW5nIGEgbWFudWFsIHBhZ2UgcmVmcmVzaC5cbmZ1bmN0aW9uIF9kZWJvdW5jZWRDbGlwTGlzdFJlZnJlc2goKSB7XG4gIGlmIChfY2xpcExpc3RSZWZyZXNoVGltZXIpIHJldHVybjtcbiAgX2NsaXBMaXN0UmVmcmVzaFRpbWVyID0gc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgX2NsaXBMaXN0UmVmcmVzaFRpbWVyID0gbnVsbDtcbiAgICBpZiAoIUFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgfHwgIUFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSkgcmV0dXJuO1xuICAgIGNvbnN0IGFuYWx5emluZyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5maWxlbmFtZSA9PT0gQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lKTtcbiAgICBpZiAoIWFuYWx5emluZyB8fCBhbmFseXppbmcuaWQgIT09IEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpIHJldHVybjtcbiAgICBBcHBTdGF0ZS5jbGlwcyA9IGF3YWl0IGZldGNoKHdpbmRvdy5fY2xpcHNMaXN0VXJsKEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICAgIHdpbmRvdy5fcmVuZGVyQ2xpcHMoKTtcbiAgfSwgMTIwMCk7XG59XG5cbi8vIEJ1aWxkcyB0aGUgbGl2ZSBsYWJlbCBmb3IgYSBzdGVwIHBpbGw6IFwiU2NvcmUgwrcgMy8xMiAoMjUlKSDCtyAwOjQyICh+MjowNlxuLy8gbGVmdClcIiBvbmNlIHBlci1pdGVtIGNvdW50cyBhcnJpdmUgZnJvbSB0aGUgc3VicHJvY2VzcyBsb2c7IGVsYXBzZWQtb25seVxuLy8gKGZhbGxpbmcgYmFjayB0byB0aGUgcHJlLXJ1biAvYXBpL2VzdGltYXRlIGZpZ3VyZSkgYmVmb3JlIHRoZSBmaXJzdCBjb3VudC5cbmZ1bmN0aW9uIF9zdGVwUGlsbExhYmVsKGlkeCkge1xuICBjb25zdCBkZWYgPSBfam9iU3RlcERlZnNbaWR4XTtcbiAgaWYgKCFkZWYpIHJldHVybiB7dGV4dDogJycsIHBjdDogbnVsbH07XG4gIGNvbnN0IHdhaXRpbmcgPSBfc3RlcFdhaXRpbmdNc2dbaWR4XTtcbiAgaWYgKHdhaXRpbmcpIHJldHVybiB7dGV4dDogYCR7ZGVmLmxhYmVsfSDCtyAke3dhaXRpbmd9YCwgcGN0OiBudWxsfTtcbiAgY29uc3QgZWxhcHNlZE1zID0gRGF0ZS5ub3coKSAtIF9zdGVwU3RhcnRUaW1lO1xuICBjb25zdCBwcm9ncmVzcyAgPSBfc3RlcFByb2dyZXNzW2lkeF07XG4gIGlmICghcHJvZ3Jlc3MgfHwgIXByb2dyZXNzLmN1cnJlbnQpIHtcbiAgICBjb25zdCBlc3QgPSBfZXN0aW1hdGVIbXNGb3IoZGVmKTtcbiAgICByZXR1cm4ge1xuICAgICAgdGV4dDogZXN0ID8gYCR7ZGVmLmxhYmVsfSDCtyAke19mbXRFbGFwc2VkKGVsYXBzZWRNcyl9ICh+JHtlc3R9KWAgOiBgJHtkZWYubGFiZWx9IMK3ICR7X2ZtdEVsYXBzZWQoZWxhcHNlZE1zKX1gLFxuICAgICAgcGN0OiBudWxsLFxuICAgIH07XG4gIH1cbiAgY29uc3Qge2N1cnJlbnQsIHRvdGFsfSA9IHByb2dyZXNzO1xuICBjb25zdCBwY3QgICAgPSBNYXRoLnJvdW5kKGN1cnJlbnQgLyB0b3RhbCAqIDEwMCk7XG4gIC8vIEVUQSBmcm9tIHRocm91Z2hwdXQgc2luY2UgdGhlIHJhdGUgYW5jaG9yIChmaXJzdCBvYnNlcnZlZCBjb3VudCksIG5vdCBmcm9tXG4gIC8vIGVsYXBzZWQvY3VycmVudCAtIHRoZSBsYXR0ZXIgbGV0IGEgc2xvdyBjb2xkIGZpcnN0IGl0ZW0gcHJvamVjdCBhYnN1cmRcbiAgLy8gZmlndXJlcyAoZS5nLiBcIjc3IG1pbiBsZWZ0XCIgdGhhdCB2YW5pc2hlZCB3aGVuIHRoZSBzdGVwIGZpbmlzaGVkIHNlY29uZHMgbGF0ZXIpLlxuICBjb25zdCBhbmNob3IgPSBfc3RlcFJhdGVBbmNob3JbaWR4XTtcbiAgbGV0IGV0YSA9ICcnO1xuICBpZiAoYW5jaG9yICYmIGN1cnJlbnQgPiBhbmNob3IuY3VycmVudCkge1xuICAgIGNvbnN0IG1zUGVySXRlbSA9IChEYXRlLm5vdygpIC0gYW5jaG9yLnQpIC8gKGN1cnJlbnQgLSBhbmNob3IuY3VycmVudCk7XG4gICAgY29uc3QgcmVtYWluaW5nTXMgPSBtc1Blckl0ZW0gKiAodG90YWwgLSBjdXJyZW50KTtcbiAgICBpZiAoaXNGaW5pdGUocmVtYWluaW5nTXMpICYmIHJlbWFpbmluZ01zID49IDApIGV0YSA9IGAgKH4ke19mbXRFbGFwc2VkKHJlbWFpbmluZ01zKX0gbGVmdClgO1xuICB9XG4gIHJldHVybiB7XG4gICAgdGV4dDogYCR7ZGVmLmxhYmVsfSDCtyAke2N1cnJlbnR9LyR7dG90YWx9ICgke3BjdH0lKSDCtyAke19mbXRFbGFwc2VkKGVsYXBzZWRNcyl9JHtldGF9YCxcbiAgICBwY3QsXG4gIH07XG59XG5cbi8vIFBhaW50cyBvbmUgc3RlcCBwaWxsJ3MgdGV4dCBhbmQsIGZvciBhbiBpbi1wcm9ncmVzcyBzdGVwIHdpdGgga25vd24gY291bnRzLFxuLy8gYSB0d28tdG9uZSBncmFkaWVudCBmaWxsIHN0YW5kaW5nIGluIGZvciBhIHByb2dyZXNzIGJhciAoZG9uZS9wZW5kaW5nIHBpbGxzXG4vLyBrZWVwIHRoZWlyIGZsYXQgQ1NTIGNsYXNzIGNvbG9yIC0gbm8gZmlsbCkuIFNoYXJlZCBieSB0aGUgaGVhZGVyIHBpbGwgcm93XG4vLyBhbmQgKHZpYSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSB0aGUgaW4tZGV0YWlsIG1pcnJvciBwYW5lbC5cbmZ1bmN0aW9uIF9yZW5kZXJTdGVwUGlsbChpZHgpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2lkeH1gKTtcbiAgaWYgKCFlbCB8fCAhZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdhY3RpdmUnKSkgcmV0dXJuO1xuICBjb25zdCB7dGV4dCwgcGN0fSA9IF9zdGVwUGlsbExhYmVsKGlkeCk7XG4gIGVsLnRleHRDb250ZW50ID0gdGV4dDtcbiAgZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gcGN0ICE9IG51bGxcbiAgICA/IGBsaW5lYXItZ3JhZGllbnQodG8gcmlnaHQsIHZhcigtLWdyZWVuKSAke3BjdH0lLCB2YXIoLS1hY2NlbnQpICR7cGN0fSUpYFxuICAgIDogJyc7XG59XG5cbmZ1bmN0aW9uIF90aWNrSm9iVGltZXIoKSB7XG4gIGlmICh3aW5kb3cuX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpO1xuICBpZiAoX2FjdGl2ZVN0ZXBJZHggPCAwKSByZXR1cm47XG4gIF9yZW5kZXJTdGVwUGlsbChfYWN0aXZlU3RlcElkeCk7XG59XG5cbmZ1bmN0aW9uIGVuZEpvYlVJKCkge1xuICBpZiAoX2pvYlRpbWVyKSB7IGNsZWFySW50ZXJ2YWwoX2pvYlRpbWVyKTsgX2pvYlRpbWVyID0gbnVsbDsgfVxuICBfam9iU3RlcERlZnMuZm9yRWFjaCgocywgaSkgPT4ge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtpfWApO1xuICAgIGlmIChlbCkgeyBlbC5jbGFzc05hbWUgPSAnc3RlcCBkb25lJzsgZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7IGVsLnRleHRDb250ZW50ID0gJ+Kckyc7IGVsLnRpdGxlID0gcy5sYWJlbDsgfVxuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jYW5jZWwtam9iJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgX2pvYlBhdXNhYmxlID0gZmFsc2U7XG4gIF9qb2JQYXVzZWQgICA9IGZhbHNlO1xuICBfcmVuZGVyUGF1c2VVSSgpO1xuICBpZiAoX2pvYlRoZXJtYWxQb2xsVGltZXIpIHsgY2xlYXJJbnRlcnZhbChfam9iVGhlcm1hbFBvbGxUaW1lcik7IF9qb2JUaGVybWFsUG9sbFRpbWVyID0gbnVsbDsgfVxuICBjb25zdCBncHVUZW1wID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1ncHUtdGVtcCcpO1xuICBpZiAoZ3B1VGVtcCkgZ3B1VGVtcC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBfam9iQWN0aXZlID0gZmFsc2U7XG4gIF9qb2JIaWRlVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBfam9iSGlkZVRpbWVyID0gbnVsbDtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXN0YXR1cycpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVhZGVyLXNwYWNlcicpLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjYnRuLWFuYWx5emUsI2J0bi1zY29yZScpLmZvckVhY2goYiA9PiBiLmRpc2FibGVkID0gZmFsc2UpO1xuICAgIGNvbnN0IGFuYWx5emVCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWFuYWx5emUnKTtcbiAgICBpZiAoYW5hbHl6ZUJ0bikgYW5hbHl6ZUJ0bi50aXRsZSA9ICcnO1xuICAgIF9zZXRKb2JCbG9ja2VkQnV0dG9ucyhmYWxzZSk7XG4gICAgY29uc3QgdG90YWxBcHByb3ZlZCA9IChBcHBTdGF0ZS52aWRlb3MgfHwgW10pLnJlZHVjZSgobiwgdikgPT4gbiArIHYuYXBwcm92ZWQsIDApO1xuICAgIHdpbmRvdy5fdXBkYXRlRGVtb0J1dHRvbih0b3RhbEFwcHJvdmVkKTtcbiAgICBpZiAod2luZG93Ll9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKSBfcmVuZGVyQ2xpcEZpbHRlckNvdW50cygpO1xuICB9LCAyMDAwKTtcbn1cblxuLy8g4pSA4pSAIFNTRSB0cmFuc3BvcnQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBMb3ctbGV2ZWwgU1NFIHJlYWRlciB1c2luZyBmZXRjaCArIFJlYWRhYmxlU3RyZWFtIHNvIG5vbi0yMDAgSFRUUCByZXNwb25zZXNcbi8vIGNhbiBiZSByZWFkIGZvciB0aGVpciBlcnJvciBkZXRhaWwgKEV2ZW50U291cmNlLm9uZXJyb3IgY2Fubm90IGRvIHRoaXMpLlxuLy9cbi8vIG9uTGluZShtc2cpICAtIGNhbGxlZCBmb3IgZWFjaCBwYXJzZWQgU1NFIHBheWxvYWQgYmVmb3JlIF9fRE9ORV9fXG4vLyBvbkRvbmUobXNnKSAgLSBjYWxsZWQgd2l0aCB0aGUgZnVsbCBfX0RPTkVfXyBwYXlsb2FkIChzdHJpbmcgb3Igb2JqZWN0KVxuLy8gb25FcnJvcihzdHIpIC0gY2FsbGVkIHdpdGggYSBwbGFpbi1sYW5ndWFnZSBtZXNzYWdlIG9uIEhUVFAgZXJyb3Igb3IgbmV0d29yayBsb3NzXG4vL1xuLy8gb3B0cyAob3B0aW9uYWwpOiBleHRyYSBmZXRjaCBpbml0LCBlLmcuIHttZXRob2Q6ICdQT1NUJ30gZm9yIHRoZSBtb2RlbC1kb3dubG9hZFxuLy8gZW5kcG9pbnRzLCB3aGljaCBhcmUgUE9TVC1vbmx5IChhIEdFVCA0MDVzKS4gRGVmYXVsdHMgdG8gYSBHRVQsIGFzIHRoZSBhbmFseXplXG4vLyBhbmQgc2NvcmUgU1NFIHN0cmVhbXMgdXNlLlxuLy8gUmV0dXJucyBhIGhhbmRsZSB3aXRoIC5jbG9zZSgpIHRoYXQgYWJvcnRzIHRoZSBpbi1mbGlnaHQgcmVxdWVzdC5cbmZ1bmN0aW9uIF9vcGVuU1NFKHVybCwgb25MaW5lLCBvbkRvbmUsIG9uRXJyb3IsIG9wdHMgPSB7fSkge1xuICBjb25zdCBjdHJsID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCBoYW5kbGUgPSB7Y2xvc2U6ICgpID0+IGN0cmwuYWJvcnQoKX07XG4gIGZldGNoKHVybCwge3NpZ25hbDogY3RybC5zaWduYWwsIC4uLm9wdHN9KS50aGVuKGFzeW5jIHJlcyA9PiB7XG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIGNvbnN0IGVyckRhdGEgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgICAgb25FcnJvcihmb3JtYXRBcGlFcnJvcihlcnJEYXRhKSB8fCBgU2VydmVyIGVycm9yICR7cmVzLnN0YXR1c31gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcmVhZGVyID0gcmVzLmJvZHkuZ2V0UmVhZGVyKCk7XG4gICAgY29uc3QgZGVjID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgbGV0IGJ1ZiA9ICcnO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBjb25zdCB7ZG9uZSwgdmFsdWV9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgICBpZiAoIWN0cmwuc2lnbmFsLmFib3J0ZWQpIG9uRXJyb3IoJ1N0cmVhbSBlbmRlZCB3aXRob3V0IGEgY29tcGxldGlvbiBzaWduYWwnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgYnVmICs9IGRlYy5kZWNvZGUodmFsdWUsIHtzdHJlYW06IHRydWV9KTtcbiAgICAgICAgY29uc3QgbGluZXMgPSBidWYuc3BsaXQoJ1xcbicpO1xuICAgICAgICBidWYgPSBsaW5lcy5wb3AoKTtcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJ2RhdGE6ICcpKSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCBtc2cgPSBKU09OLnBhcnNlKGxpbmUuc2xpY2UoNikpO1xuICAgICAgICAgIGNvbnN0IGlzRG9uZSA9IG1zZyA9PT0gJ19fRE9ORV9fJyB8fCAobXNnICYmIHR5cGVvZiBtc2cgPT09ICdvYmplY3QnICYmIG1zZy50eXBlID09PSAnX19ET05FX18nKTtcbiAgICAgICAgICBpZiAoaXNEb25lKSB7IG9uRG9uZShtc2cpOyByZXR1cm47IH1cbiAgICAgICAgICBvbkxpbmUobXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKCFjdHJsLnNpZ25hbC5hYm9ydGVkKSBvbkVycm9yKCdDb25uZWN0aW9uIGxvc3QgLSBzZXJ2ZXIgZGlzY29ubmVjdGVkJyk7XG4gICAgfVxuICB9KS5jYXRjaChlcnIgPT4ge1xuICAgIGlmICghY3RybC5zaWduYWwuYWJvcnRlZCkgb25FcnJvcih3aW5kb3cubmV0RXJyTXNnKGVycikpO1xuICB9KTtcbiAgcmV0dXJuIGhhbmRsZTtcbn1cblxuLy8gT25seSBvbmUgam9iIHN0cmVhbSBpcyBsaXZlIGF0IGEgdGltZS4gU3RhcnRpbmcgYSBuZXcgam9iIGFib3J0cyB0aGUgcHJldmlvdXNcbi8vIG9uZSAtIGJ1dCBhYm9ydGluZyBzdXBwcmVzc2VzIGl0cyBvbkRvbmUvb25FcnJvciwgc28gaXRzIFVJIHRlYXJkb3duIChidXR0b25cbi8vIHJlLWVuYWJsZSwgcHJvZ3Jlc3MgcGlsbCkgd291bGQgbmV2ZXIgcnVuLiBFYWNoIGpvYiByZWdpc3RlcnMgdGhhdCB0ZWFyZG93biBhc1xuLy8gYSBjbGVhbnVwIHNvIGEgc3VwZXJzZWRpbmcgam9iIGNhbiBydW4gaXQuIFNlZSBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtLlxuZnVuY3Rpb24gX3NldEFjdGl2ZVN0cmVhbShoYW5kbGUsIGNsZWFudXAgPSBudWxsKSB7XG4gIF9hY3RpdmVFUyA9IGhhbmRsZTtcbiAgX2FjdGl2ZUpvYkNsZWFudXAgPSBjbGVhbnVwO1xufVxuXG5mdW5jdGlvbiBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKSB7XG4gIGlmIChfYWN0aXZlRVMgPT09IGhhbmRsZSkgeyBfYWN0aXZlRVMgPSBudWxsOyBfYWN0aXZlSm9iQ2xlYW51cCA9IG51bGw7IH1cbn1cblxuZnVuY3Rpb24gX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpIHtcbiAgaWYgKF9hY3RpdmVFUykgeyBfYWN0aXZlRVMuY2xvc2UoKTsgX2FjdGl2ZUVTID0gbnVsbDsgfVxuICBpZiAoX2FjdGl2ZUpvYkNsZWFudXApIHsgY29uc3QgY2xlYW51cCA9IF9hY3RpdmVKb2JDbGVhbnVwOyBfYWN0aXZlSm9iQ2xlYW51cCA9IG51bGw7IGNsZWFudXAoKTsgfVxufVxuXG4vLyBHdWFyZCBmb3IgY29tcGV0aW5nIFNTRSBqb2JzIChyZS1zY29yZSwgdGltZWxpbmUsIHN1bW1hcnksIGRpYXJpemUsIOKApikuIFdoaWxlXG4vLyBhbiBhbmFseXNpcyBpcyBydW5uaW5nIHRoZSBiYWNrZW5kIDQwOXMgdGhlc2UgYW55d2F5LCBidXQgdGhleSBjYWxsXG4vLyBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCkgZmlyc3QsIHdoaWNoIHdvdWxkIHRlYXIgZG93biB0aGUgbGl2ZSBhbmFseXplIHByb2dyZXNzXG4vLyBVSSBiZWZvcmUgdGhlIHJlamVjdGlvbiBsYW5kcy4gUmV0dXJucyB0cnVlIChhbmQgdG9hc3RzKSBzbyB0aGUgY2FsbGVyIGNhbiBiYWlsXG4vLyBiZWZvcmUgYW55IHNpZGUgZWZmZWN0cy5cbmZ1bmN0aW9uIF9ibG9ja2VkQnlBbmFseXplKGFjdGlvbkxhYmVsKSB7XG4gIGlmICghQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lKSByZXR1cm4gZmFsc2U7XG4gIHdpbmRvdy5zaG93VG9hc3QoYFdhaXQgZm9yIHRoZSBjdXJyZW50IGFuYWx5c2lzIHRvIGZpbmlzaCBiZWZvcmUgeW91ICR7YWN0aW9uTGFiZWx9LmAsICd3YXJuaW5nJyk7XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyBvbkxpbmUgKG9wdGlvbmFsKTogY2FsbGVkIHdpdGggZWFjaCByYXcgU1NFIHBheWxvYWQgbGluZSBiZWZvcmUgX19ET05FX18sIGZvclxuLy8gY2FsbGVycyB0aGF0IG5lZWQgbGl2ZSBwcm9ncmVzcyB0ZXh0IChlLmcuIHRoZSBwcm94eS1idWlsZCBwZXJjZW50YWdlKS5cbi8vIG9wdHMgKG9wdGlvbmFsKTogZmV0Y2ggaW5pdCBwYXNzZWQgdGhyb3VnaCB0byBfb3BlblNTRSwgZS5nLiB7bWV0aG9kOiAnUE9TVCd9XG4vLyBmb3IgYSBQT1NULW9ubHkgU1NFIGVuZHBvaW50IChhbmFseXplLWZyYW1lcykuXG4vLyBvbkVycm9yIChvcHRpb25hbCk6IGNhbGxlZCBhZnRlciB0aGUgYnVpbHQtaW4gZXJyb3IgaGFuZGxpbmcgKHRvYXN0ICsgZW5kSm9iVUkpXG4vLyBzbyBhIGNhbGxlciBjYW4gcnVuIGl0cyBvd24gdGVybWluYWwgY2xlYW51cCBvbiBhbiBIVFRQL3RyYW5zcG9ydCBmYWlsdXJlIC0gZS5nLlxuLy8gY2xlYXJpbmcgYSBwZXItaXRlbSBpbi1mbGlnaHQgZmxhZyB0aGF0IG9ubHkgaXRzIG9uRG9uZSB3b3VsZCBvdGhlcndpc2UgY2xlYXIuXG5mdW5jdGlvbiBzdHJlYW1TU0UodXJsLCBvbkRvbmUsIHN0ZXBEZWZzLCBqb2JMYWJlbCwgY2FuY2VsbGFibGUgPSBmYWxzZSwgb25MaW5lID0gbnVsbCwgcGF1c2FibGUgPSBmYWxzZSwgb3B0cyA9IHt9LCBvbkVycm9yID0gbnVsbCkge1xuICBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCk7XG4gIGlmIChzdGVwRGVmcykgc3RhcnRKb2JVSShzdGVwRGVmcywgam9iTGFiZWwsIGNhbmNlbGxhYmxlLCBwYXVzYWJsZSk7XG4gIGNvbnN0IGhhbmRsZSA9IF9vcGVuU1NFKFxuICAgIHVybCxcbiAgICB0ZXh0ID0+IHtcbiAgICAgIC8vIEEgQEBQUk9HUkVTUyBtYXJrZXIgZHJpdmVzIHRoZSBwaWxscyBkZXRlcm1pbmlzdGljYWxseSBhbmQgaXMgTk9UIHNob3duIGFzXG4gICAgICAvLyBhIGxvZyBsaW5lOyBldmVyeXRoaW5nIGVsc2UgZmFsbHMgdGhyb3VnaCB0byB0aGUgbG9nICsgcHJvc2UgZmFsbGJhY2suXG4gICAgICBjb25zdCBtYXJrZXIgPSBzdGVwRGVmcyA/IHBhcnNlUHJvZ3Jlc3ModGV4dCkgOiBudWxsO1xuICAgICAgaWYgKG1hcmtlcikgeyBfZHJpdmVTdGVwRnJvbU1hcmtlcihtYXJrZXIpOyByZXR1cm47IH1cbiAgICAgIHdpbmRvdy5hcHBlbmRMb2codGV4dCk7IGlmIChvbkxpbmUpIG9uTGluZSh0ZXh0KTsgaWYgKHN0ZXBEZWZzKSB1cGRhdGVKb2JVSSh0ZXh0KTtcbiAgICB9LFxuICAgICgpID0+IHtcbiAgICAgIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpO1xuICAgICAgaWYgKHN0ZXBEZWZzKSBlbmRKb2JVSSgpO1xuICAgICAgaWYgKG9uRG9uZSkgb25Eb25lKCk7XG4gICAgfSxcbiAgICBlcnJNc2cgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICB3aW5kb3cuYXBwZW5kTG9nKGBbJHtlcnJNc2d9XWApO1xuICAgICAgd2luZG93LnNob3dUb2FzdChlcnJNc2csICdlcnJvcicpO1xuICAgICAgd2luZG93LlNvdW5kRngucGxheSgnZXJyb3InKTtcbiAgICAgIGlmIChzdGVwRGVmcykgZW5kSm9iVUkoKTtcbiAgICAgIGlmIChvbkVycm9yKSBvbkVycm9yKGVyck1zZyk7XG4gICAgICB3aW5kb3cubG9hZFZpZGVvcygpO1xuICAgIH0sXG4gICAgb3B0cyxcbiAgKTtcbiAgX3NldEFjdGl2ZVN0cmVhbShoYW5kbGUsIHN0ZXBEZWZzID8gZW5kSm9iVUkgOiBudWxsKTtcbn1cblxuLy8gUG9sbGVkIGJ5IHRoZSBKUyBzZXF1ZW50aWFsLXNlZ21lbnQgcnVubmVycyAoYW5hbHl6ZS5qcydzIHByZS1zcGxpdCBsb29wLFxuLy8gc3BsaXQuanMncyByZS1zcGxpdCBsb29wKSBiZWZvcmUgZmlyaW5nIG9mZiBlYWNoIHNlZ21lbnQncyBvd24gYW5hbHl6ZSBqb2IuXG4vLyBFYWNoIHNlZ21lbnQgaXMgYSBzZXBhcmF0ZSBBbmFseXplSm9iLCBzbyB0aGVyZSBpcyBhIGdhcCBiZXR3ZWVuIHNlZ21lbnRzXG4vLyB3aXRoIG5vIFwicnVubmluZ1wiIGpvYiBmb3IgL2FwaS9zdGF0dXMncyBhbmFseXplX3BhdXNlZCB0byBrZXkgb2ZmIC0gdGhpc1xuLy8gY2hlY2tzIHRoZSByYXcgcGF1c2UgZmxhZyBmaWxlIGluc3RlYWQgKHBhdXNlX2ZsYWdfc2V0KS5cbmFzeW5jIGZ1bmN0aW9uIF93YWl0V2hpbGVBbmFseXplUGF1c2VkKCkge1xuICBsZXQgdG9hc3RlZCA9IGZhbHNlO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IGZldGNoKCcvYXBpL3N0YXR1cycpLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgaWYgKCFzdGF0dXMgfHwgIXN0YXR1cy5wYXVzZV9mbGFnX3NldCkgcmV0dXJuO1xuICAgIGlmICghdG9hc3RlZCkgeyB3aW5kb3cuc2hvd1RvYXN0KCdQYXVzZWQgLSB3aWxsIGhvbGQgYmVmb3JlIHRoZSBuZXh0IHNlZ21lbnQnLCAnaW5mbycpOyB0b2FzdGVkID0gdHJ1ZTsgfVxuICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAzMDAwKSk7XG4gIH1cbn1cblxuLy8g4pSA4pSAIGpvYiBjYW5jZWxsYXRpb24g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUaGUgam9iLWhlYWRlciBDYW5jZWwgYnV0dG9uIHNlcnZlcyB3aGljaGV2ZXIgY2FuY2VsbGFibGUgam9iIGlzIHJ1bm5pbmcuIEVhY2hcbi8vIGNhbmNlbGxhYmxlIGZsb3cgc2V0cyBfYWN0aXZlQ2FuY2VsICh2aWEgc2V0Sm9iQ2FuY2VsKSBzbyB0aGUgY29uZmlybSBjb3B5IGFuZFxuLy8gdGhlIGNhbmNlbCBlbmRwb2ludCBtYXRjaCB0aGUgam9iOyBzdGFydEpvYlVJIHJlc2V0cyBpdCB0byB0aGUgYW5hbHl6ZSBkZWZhdWx0LlxuY29uc3QgX0FOQUxZWkVfQ0FOQ0VMID0ge1xuICB1cmw6ICAgICAgJy9hcGkvYW5hbHl6ZS9jYW5jZWwnLFxuICB0aXRsZTogICAgJ0NhbmNlbCBhbmFseXNpcz8nLFxuICBib2R5OiAgICAgJ0FsbCBwcm9ncmVzcyBmb3IgdGhpcyByZWNvcmRpbmcgd2lsbCBiZSBsb3N0IGFuZCB5b3Ugd2lsbCBuZWVkIHRvIGFuYWx5emUgaXQgYWdhaW4uJyxcbiAgY29uZmlybTogICdDYW5jZWwgQW5hbHlzaXMnLFxuICBsb2dNc2c6ICAgJ1tBbmFseXNpcyBjYW5jZWxsZWRdJyxcbn07XG5sZXQgX2FjdGl2ZUNhbmNlbCA9IF9BTkFMWVpFX0NBTkNFTDtcblxuZnVuY3Rpb24gc2V0Sm9iQ2FuY2VsKGNmZykgeyBfYWN0aXZlQ2FuY2VsID0gY2ZnIHx8IF9BTkFMWVpFX0NBTkNFTDsgfVxuXG5mdW5jdGlvbiBjYW5jZWxKb2IoKSB7XG4gIHdpbmRvdy5zaG93Q29uZmlybShcbiAgICBfYWN0aXZlQ2FuY2VsLnRpdGxlLFxuICAgIF9hY3RpdmVDYW5jZWwuYm9keSxcbiAgICBfYWN0aXZlQ2FuY2VsLmNvbmZpcm0sXG4gICAgX2RvQ2FuY2VsSm9iLFxuICAgIHRydWUsXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9kb0NhbmNlbEpvYigpIHtcbiAgY29uc3QgY2FuY2VsID0gX2FjdGl2ZUNhbmNlbDtcbiAgLy8gQ2FuY2VsIG9uIHRoZSBzZXJ2ZXIgRklSU1QgLSBpZiBpdCBmYWlscywgdGhlIGpvYiBpcyBzdGlsbCBydW5uaW5nLCBzb1xuICAvLyBrZWVwIHRoZSBzdHJlYW0gYXR0YWNoZWQgYW5kIHRoZSBqb2IgVUkgdXAgaW5zdGVhZCBvZiBwcmV0ZW5kaW5nIGl0IHN0b3BwZWQuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goY2FuY2VsLnVybCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBFcnJvcihgU2VydmVyIGVycm9yICR7cmVzLnN0YXR1c31gKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgd2luZG93LnNob3dUb2FzdChgQ291bGQgbm90IGNhbmNlbCAtICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKTtcbiAgd2luZG93LmFwcGVuZExvZyhjYW5jZWwubG9nTXNnKTtcbiAgZW5kSm9iVUkoKTtcbiAgLy8gQSBqb2Itc3BlY2lmaWMgdGVybWluYWwgY2xlYW51cCAoZS5nLiBjbGVhcmluZyBhIHBlci1jbGlwIGluLWZsaWdodCBmbGFnIHNvXG4gIC8vIGl0cyBidXR0b24gbGVhdmVzIHRoZSBzcGlubmVyKSAtIHRoZSBnZW5lcmljIGFuYWx5emUgY2FuY2VsIHNldHMgbm9uZS5cbiAgaWYgKGNhbmNlbC5vbkNhbmNlbCkgY2FuY2VsLm9uQ2FuY2VsKCk7XG4gIC8vIENsZWFyIHRoZSBhbmFseXppbmcgbWFya2VyIHNvIGxvYWRWaWRlb3MoKSBkcm9wcyB0aGUgc2lkZWJhciBwbGFjZWhvbGRlciAvXG4gIC8vIHNwaW5uZXIuIExlZnQgc2V0LCBhIGNhbmNlbGxlZCBydW4gd2hvc2UgREIgcm93IG5ldmVyIG1hdGVyaWFsaXNlZCB3b3VsZFxuICAvLyBrZWVwIGFuIHVuY2xpY2thYmxlIFwiQW5hbHl6aW5n4oCmXCIgcGxhY2Vob2xkZXIgdW50aWwgYSBtYW51YWwgcGFnZSByZWZyZXNoLlxuICBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUgPSBudWxsO1xuICB3aW5kb3cubG9hZFZpZGVvcygpO1xufVxuXG5leHBvcnQge1xuICBJTkdFU1RfU1RFUFMsIFNDT1JFX1NURVBTLCBGUkFNRVNfU1RFUFMsIEpPQl9TVEFHRVMsIHBhcnNlUHJvZ3Jlc3MsIF9kcml2ZVN0ZXBGcm9tTWFya2VyLFxuICBzdGFydEpvYlVJLCB1cGRhdGVKb2JVSSwgZW5kSm9iVUksIGFwcGx5Sm9iQmxvY2tlZFN0YXRlLCBfc3RlcFBpbGxMYWJlbCwgX3JlbmRlclN0ZXBQaWxsLCBfdGlja0pvYlRpbWVyLFxuICBfc2V0UGF1c2VkVUlGcm9tU3RhdHVzLCB0b2dnbGVQYXVzZUpvYiwgX3BvbGxUaGVybWFsU3RhdHVzLFxuICBfb3BlblNTRSwgc3RyZWFtU1NFLCBfc2V0QWN0aXZlU3RyZWFtLCBfY2xlYXJBY3RpdmVTdHJlYW0sIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0sXG4gIF9ibG9ja2VkQnlBbmFseXplLCBfd2FpdFdoaWxlQW5hbHl6ZVBhdXNlZCxcbiAgc2V0Sm9iQ2FuY2VsLCBjYW5jZWxKb2IsXG59O1xuXG4vLyBUaGUgam9iIGhlYWRlcidzIFBhdXNlL0NhbmNlbCBidXR0b25zIGFyZSBzdGF0aWMgbWFya3VwIGluIGluZGV4Lmh0bWwgKG5ldmVyXG4vLyByZS1yZW5kZXJlZCksIHNvIGEgc2luZ2xlIGxpc3RlbmVyIHdpcmVkIG9uY2UgYXQgbW9kdWxlIGxvYWQgLSByZXBsYWNpbmcgdGhlXG4vLyBvbmNsaWNrPVwidG9nZ2xlUGF1c2VKb2IoKVwiL1wiY2FuY2VsSm9iKClcIiBhdHRyaWJ1dGVzIHRoYXQgdXNlZCB0byBsaXZlIHRoZXJlIC1cbi8vIGNhbiBuZXZlciBkb3VibGUtd2lyZS4gKHZpZGVvcy5qcydzIGluLWRldGFpbCBDYW5jZWwgYnV0dG9uIHN0aWxsIHVzZXMgaXRzIG93blxuLy8gaW5saW5lIG9uY2xpY2s9XCJjYW5jZWxKb2IoKVwiOyB0aGF0IG1hcmt1cCBsaXZlcyBpbiB2aWRlb3MuanMsIG91dCBvZiBzY29wZSBoZXJlLilcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tcGF1c2Utam9iJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0b2dnbGVQYXVzZUpvYik7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNhbmNlbC1qb2InKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGNhbmNlbEpvYik7XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBSZWNvcmRpbmcgcHJldmlldyBwbGF5ZXI6IHBpY2tzIHRoZSBtZWRpYSB0cmFuc3BvcnQgKEVsZWN0cm9uIG5hdGl2ZSBzY2hlbWUgdnMgSFRUUCksXG4vLyAgIHByZWZlcnMgdGhlIGZhc3QgNzIwcCBwcm94eSBvdmVyIHRoZSBzb3VyY2UsIGFuZCBkcml2ZXMgdGhlIGNsaWNrLXRvLWJ1aWxkIHByb3h5IGJhZGdlLlxuLy8gICBBUEk6IHJvdXRlcy92aWRlb3MucHkgKHNvdXJjZS9wcm94eS9wcm94eS1zdGF0dXMvcHJveHktZ2VuZXJhdGUpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3ZpZGVvLnB5XG4vLyBTaW5nbGUgcG9pbnQgdGhhdCBwaWNrcyB0aGUgdHJhbnNwb3J0IGZvciBhIHJlY29yZGluZydzIHNvdXJjZS9wcm94eSBzdHJlYW1cbi8vIChyb2FkbWFwIHBsYW4gMTApLiBJbnNpZGUgdGhlIHBhY2thZ2VkIEVsZWN0cm9uIGFwcCwgd2luZG93LmVsZWN0cm9uQVBJLm1lZGlhUHJvdG9jb2xcbi8vIGlzIHNldCBhbmQgcGxheWJhY2sgZ29lcyBzdHJhaWdodCB0aHJvdWdoIHRoZSBuYXRpdmUgXCJ5dXUtbWVkaWE6Ly9cIiBzY2hlbWUgLVxuLy8gYnlwYXNzaW5nIHRoZSBQeXRob24gYnl0ZS1wdW1wIC0gaW5zdGVhZCBvZiB0aGUgSFRUUCByb3V0ZS4gUGxhaW4gYnJvd3Nlci1kZXZcbi8vIG1vZGUgbmV2ZXIgaGFzIGVsZWN0cm9uQVBJLCBzbyBpdCBhbHdheXMgZ2V0cyB0aGUgdW5jaGFuZ2VkIEhUVFAgVVJMLiBhYnNQYXRoXG4vLyBtYXkgYmUgbnVsbCAoZS5nLiBhIHByb3h5IHRoYXQgaGFzbid0IGJlZW4gZ2VuZXJhdGVkL2xvb2tlZCB1cCB5ZXQpLCB3aGljaFxuLy8gc2ltcGx5IGZhbGxzIGJhY2sgdG8gSFRUUCBmb3IgdGhhdCBvbmUgcmVxdWVzdC5cbmltcG9ydCB7IHN0cmVhbVNTRSB9IGZyb20gJy4vam9icy5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBfYnVpbGRNZWRpYVVybCh2aWRlb0lkLCBraW5kLCBhYnNQYXRoKSB7XG4gIGlmICh3aW5kb3cuZWxlY3Ryb25BUEk/Lm1lZGlhUHJvdG9jb2wgJiYgYWJzUGF0aCkge1xuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBhYnNQYXRoLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICByZXR1cm4gYHl1dS1tZWRpYTovL21lZGlhLyR7ZW5jb2RlVVJJQ29tcG9uZW50KG5vcm1hbGl6ZWQpfWA7XG4gIH1cbiAgcmV0dXJuIGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9LyR7a2luZH1gO1xufVxuXG4vLyDilIDilIAgcmVjb3JkaW5nIHByZXZpZXcgcXVhbGl0eSAoNzIwcCBwcm94eSArIGJhZGdlKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFNoYXJlZCBieSBldmVyeSBmdWxsLXJlY29yZGluZyA8dmlkZW8+IChyZWNvcmRpbmcgZGV0YWlsIHBsYXllciwgc3BsaXQgZWRpdG9yKVxuLy8gc28gdGhlIGNyZWF0b3IgYWx3YXlzIGtub3dzIHdoZXRoZXIgdGhleSdyZSBzZWVpbmcgdGhlIGZhc3QgNzIwcCBwcm94eSBvciB0aGVcbi8vIGZ1bGwtcXVhbGl0eSBvcmlnaW5hbC4gUHJlZmVycyB0aGUgcHJveHkgd2hlbiBvbmUgZXhpc3RzOyBvdGhlcndpc2UgcGxheXMgdGhlXG4vLyBzb3VyY2UgYW5kIGVpdGhlciBidWlsZHMgYSBwcm94eSBvbiBkZW1hbmQgKGF1dG9CdWlsZCkgb3IgaW52aXRlcyB0aGUgdXNlciB0by5cbi8vXG4vLyAgIHZpZGVvRWwgLyBiYWRnZUVsIDogdGhlIDx2aWRlbz4gYW5kIGl0cyBvdmVybGF5IGJhZGdlIChjYWxsZXIgb3ducyBsYXlvdXQpXG4vLyAgIGF1dG9CdWlsZCAgICAgICAgIDogYnVpbGQgaW1tZWRpYXRlbHkgd2hlbiBubyBwcm94eSBleGlzdHMgKGRlbGliZXJhdGVcbi8vICAgICAgICAgICAgICAgICAgICAgICBzY3J1YmJpbmcgc3VyZmFjZXMpLCBlbHNlIHRoZSBiYWRnZSBvZmZlcnMgYSBjbGljay10by1idWlsZFxuLy8gICBpc0N1cnJlbnQgICAgICAgICA6IGd1YXJkIHNvIGEgbGF0ZSBzd2FwIG5ldmVyIGxhbmRzIG9uIGEgc2luY2UtY2hhbmdlZCB2aWV3XG4vLyAgIHN0YXJ0UyAvIGVuZFMgICAgIDogYSBzcGxpdCBzZWdtZW50J3MgcGxheWVyIHN0cmVhbXMgdGhlIGZ1bGwgdW50cmltbWVkIHBhcmVudFxuLy8gICAgICAgICAgICAgICAgICAgICAgIGZpbGUgKHNvdXJjZSBhbmQgcHJveHkgYXJlIGJvdGgga2V5ZWQgYnkgdGhlIHBhcmVudCBwYXRoKSAtXG4vLyAgICAgICAgICAgICAgICAgICAgICAgdGhlc2UgYm91bmQgcGxheWJhY2sgdG8gdGhlIHNlZ21lbnQncyBvd24gc2xpY2Ugb2YgaXRcbi8vICAgc291cmNlUGF0aCAgICAgICAgOiB0aGUgcmVjb3JkaW5nJ3MgYWJzb2x1dGUgcGF0aCAodmlkZW8uc291cmNlX3BhdGggZnJvbSB0aGVcbi8vICAgICAgICAgICAgICAgICAgICAgICBhbHJlYWR5LWZldGNoZWQgdmlkZW8gcmVjb3JkKSAtIG9ubHkgdXNlZCB0byBidWlsZCB0aGVcbi8vICAgICAgICAgICAgICAgICAgICAgICBFbGVjdHJvbiBuYXRpdmUtcHJvdG9jb2wgVVJMOyBpZ25vcmVkIGluIGJyb3dzZXItZGV2IG1vZGVcbmV4cG9ydCBmdW5jdGlvbiBzZXR1cFJlY29yZGluZ1ByZXZpZXcodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgeyBhdXRvQnVpbGQgPSBmYWxzZSwgaXNDdXJyZW50ID0gKCkgPT4gdHJ1ZSwgc3RhcnRTID0gbnVsbCwgZW5kUyA9IG51bGwsIHNvdXJjZVBhdGggPSBudWxsIH0gPSB7fSkge1xuICB2aWRlb0VsLnNyYyA9IF9idWlsZE1lZGlhVXJsKHZpZGVvSWQsICdzb3VyY2UnLCBzb3VyY2VQYXRoKTtcbiAgaWYgKHN0YXJ0UyAhPSBudWxsKSB7XG4gICAgdmlkZW9FbC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsICgpID0+IHsgdHJ5IHsgdmlkZW9FbC5jdXJyZW50VGltZSA9IHN0YXJ0UzsgfSBjYXRjaCAoXykge30gfSwgeyBvbmNlOiB0cnVlIH0pO1xuICB9XG4gIGlmIChlbmRTICE9IG51bGwpIHtcbiAgICB2aWRlb0VsLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCAoKSA9PiB7IGlmICh2aWRlb0VsLmN1cnJlbnRUaW1lID49IGVuZFMpIHZpZGVvRWwucGF1c2UoKTsgfSk7XG4gIH1cbiAgY29uc3QgYnVpbGRGbiA9ICgpID0+IF9idWlsZFJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTKTtcbiAgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAnb3JpZ2luYWwnLCBudWxsLCBhdXRvQnVpbGQgPyBudWxsIDogYnVpbGRGbik7XG4gIGZldGNoKGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L3Byb3h5LXN0YXR1c2ApXG4gICAgLnRoZW4ociA9PiByLm9rID8gci5qc29uKCkgOiBudWxsKVxuICAgIC50aGVuKHN0YXR1cyA9PiB7XG4gICAgICBpZiAoIWlzQ3VycmVudCgpIHx8ICFzdGF0dXMpIHJldHVybjtcbiAgICAgIGlmIChzdGF0dXMuYXZhaWxhYmxlKSBfdXNlUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMsIHN0YXR1cy5wcm94eV9wYXRoKTtcbiAgICAgIGVsc2UgaWYgKGF1dG9CdWlsZCB8fCBzdGF0dXMuZ2VuZXJhdGluZykgYnVpbGRGbigpO1xuICAgIH0pXG4gICAgLmNhdGNoKCgpID0+IHsgLyogbGVhdmUgdGhlIHNvdXJjZSBwbGF5aW5nIHdpdGggdGhlIG9yaWdpbmFsLXF1YWxpdHkgYmFkZ2UgKi8gfSk7XG59XG5cbi8vIHN0YXJ0UzogZmFsbHMgYmFjayB0byBpdCB3aGVuIGN1cnJlbnRUaW1lIGlzIHN0aWxsIDAgLSB0aGUgcHJveHktc3RhdHVzIGZldGNoXG4vLyBjYW4gcmVzb2x2ZSBiZWZvcmUgdGhlIHNvdXJjZSdzIGxvYWRlZG1ldGFkYXRhIHNlZWsgKHNldHVwUmVjb3JkaW5nUHJldmlldykgcnVucyxcbi8vIHdoaWNoIHdvdWxkIG90aGVyd2lzZSByZXN1bWUgYSBzZWdtZW50J3MgcHJveHkgYXQgdGhlIHBhcmVudCdzIHQ9MC5cbmZ1bmN0aW9uIF91c2VSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0UyA9IG51bGwsIHByb3h5UGF0aCA9IG51bGwpIHtcbiAgaWYgKCFpc0N1cnJlbnQoKSkgcmV0dXJuO1xuICBjb25zdCByZXN1bWVBdCAgID0gdmlkZW9FbC5jdXJyZW50VGltZSB8fCBzdGFydFMgfHwgMDtcbiAgY29uc3Qgd2FzUGxheWluZyA9ICF2aWRlb0VsLnBhdXNlZCAmJiAhdmlkZW9FbC5lbmRlZDtcbiAgdmlkZW9FbC5zcmMgPSBfYnVpbGRNZWRpYVVybCh2aWRlb0lkLCAncHJveHknLCBwcm94eVBhdGgpO1xuICB2aWRlb0VsLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4ge1xuICAgIHRyeSB7IHZpZGVvRWwuY3VycmVudFRpbWUgPSByZXN1bWVBdDsgfSBjYXRjaCAoXykge31cbiAgICBpZiAod2FzUGxheWluZykgdmlkZW9FbC5wbGF5KCkuY2F0Y2goKCkgPT4ge30pO1xuICB9LCB7IG9uY2U6IHRydWUgfSk7XG4gIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ3Byb3h5Jyk7XG59XG5cbmZ1bmN0aW9uIF9idWlsZFJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTID0gbnVsbCkge1xuICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ2J1aWxkaW5nJyk7XG4gIHN0cmVhbVNTRShcbiAgICBgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9wcm94eS9nZW5lcmF0ZWAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCFpc0N1cnJlbnQoKSkgcmV0dXJuO1xuICAgICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vcHJveHktc3RhdHVzYClcbiAgICAgICAgLnRoZW4ociA9PiByLm9rID8gci5qc29uKCkgOiBudWxsKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgIGlmICghaXNDdXJyZW50KCkpIHJldHVybjtcbiAgICAgIGlmIChzdGF0dXM/LmF2YWlsYWJsZSkgX3VzZVJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTLCBzdGF0dXMucHJveHlfcGF0aCk7XG4gICAgICAvLyBBbm90aGVyIG9wZW4gaXMgc3RpbGwgZW5jb2RpbmcgLSBwb2xsIHVudGlsIGl0cyBwcm94eSBsYW5kcy5cbiAgICAgIGVsc2UgaWYgKHN0YXR1cz8uZ2VuZXJhdGluZykgc2V0VGltZW91dCgoKSA9PiBfYnVpbGRSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0UyksIDUwMDApO1xuICAgICAgZWxzZSBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdvcmlnaW5hbCcsIG51bGwsICgpID0+IF9idWlsZFJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTKSk7XG4gICAgfSxcbiAgICBudWxsLCAgICAgICAgLy8gbm8gZ2xvYmFsIGpvYiBwaWxsIC0gdGhpcyBpcyBhIGJhY2tncm91bmQgY29udmVuaWVuY2VcbiAgICAnUHJldmlldycsXG4gICAgZmFsc2UsXG4gICAgbGluZSA9PiB7ICAgIC8vIG9uTGluZTogc3VyZmFjZSB0aGUgZW5jb2RlIHBlcmNlbnRhZ2Ugb24gdGhlIGJhZGdlXG4gICAgICBjb25zdCBtID0gLyhcXGQrKSUvLmV4ZWMobGluZSk7XG4gICAgICBpZiAobSAmJiBpc0N1cnJlbnQoKSkgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAnYnVpbGRpbmcnLCBtWzFdKTtcbiAgICB9LFxuICApO1xufVxuXG5mdW5jdGlvbiBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsIG1vZGUsIHBjdCwgb25CdWlsZCkge1xuICBpZiAoIWJhZGdlRWwpIHJldHVybjtcbiAgLy8gUmVzZXQgdG8gYSBub24taW50ZXJhY3RpdmUgc3RhdHVzIGluZGljYXRvcjsgdGhlIGJ1aWxkIGFmZm9yZGFuY2UgYmVsb3dcbiAgLy8gcmUtYXJtcyBpdCBhcyBhIGJ1dHRvbiBzbyByb2xlL3RhYmluZGV4IG5ldmVyIGdvIHN0YWxlIGJldHdlZW4gc3RhdGVzLlxuICBiYWRnZUVsLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgYmFkZ2VFbC5vbmNsaWNrID0gbnVsbDtcbiAgYmFkZ2VFbC5vbmtleWRvd24gPSBudWxsO1xuICBiYWRnZUVsLnN0eWxlLmN1cnNvciA9ICcnO1xuICBiYWRnZUVsLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gIGJhZGdlRWwucmVtb3ZlQXR0cmlidXRlKCd0YWJpbmRleCcpO1xuICBiYWRnZUVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdzdGF0dXMnKTtcbiAgYmFkZ2VFbC5jbGFzc0xpc3QudG9nZ2xlKCdwcmV2aWV3LWJhZGdlLXByb3h5JywgbW9kZSA9PT0gJ3Byb3h5Jyk7XG4gIGJhZGdlRWwuY2xhc3NMaXN0LnJlbW92ZSgncHJldmlldy1iYWRnZS1idWlsZCcpO1xuICBpZiAobW9kZSA9PT0gJ3Byb3h5Jykge1xuICAgIGJhZGdlRWwudGV4dENvbnRlbnQgPSAnUHJldmlldyBxdWFsaXR5ICg3MjBwKSc7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdQbGF5aW5nIGEgZG93bnNjYWxlZCA3MjBwIHByZXZpZXcgZm9yIGZhc3Qgc2Vla2luZyAtIG5vdCBmdWxsIHF1YWxpdHkuIEV4cG9ydHMgdXNlIHRoZSBvcmlnaW5hbC4nO1xuICB9IGVsc2UgaWYgKG1vZGUgPT09ICdidWlsZGluZycpIHtcbiAgICBiYWRnZUVsLnRleHRDb250ZW50ID0gcGN0ID8gYEJ1aWxkaW5nIDcyMHAgcHJldmlld+KApiAke3BjdH0lYCA6ICdCdWlsZGluZyA3MjBwIHByZXZpZXfigKYnO1xuICAgIGJhZGdlRWwudGl0bGUgPSAnRW5jb2RpbmcgYSBmYXN0LXNlZWtpbmcgNzIwcCBwcmV2aWV3IGZyb20gdGhlIHNvdXJjZSByZWNvcmRpbmcuJztcbiAgfSBlbHNlIGlmIChvbkJ1aWxkKSB7XG4gICAgLy8gUmVuZGVyIHRoZSBhY3Rpb24gYXMgYSBidXR0b24tc3R5bGVkIHBpbGwgc28gaXQgb2J2aW91c2x5IGludml0ZXMgYSBjbGljay5cbiAgICBiYWRnZUVsLmNsYXNzTGlzdC5hZGQoJ3ByZXZpZXctYmFkZ2UtYnVpbGQnKTtcbiAgICBiYWRnZUVsLmlubmVySFRNTCA9ICdPcmlnaW5hbCBxdWFsaXR5IMK3IDxzcGFuIGNsYXNzPVwicHJldmlldy1iYWRnZS1hY3Rpb25cIj4mIzk4ODk7IEJ1aWxkIDcyMHAgcHJldmlldzwvc3Bhbj4nO1xuICAgIGJhZGdlRWwudGl0bGUgPSAnUGxheWluZyB0aGUgZnVsbC1xdWFsaXR5IG9yaWdpbmFsLiBCdWlsZCBhIDcyMHAgcHJldmlldyBzbyBzZWVraW5nIGlzIGZhc3QuJztcbiAgICBiYWRnZUVsLnN0eWxlLmN1cnNvciA9ICdwb2ludGVyJztcbiAgICBiYWRnZUVsLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnYXV0byc7XG4gICAgYmFkZ2VFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnYnV0dG9uJyk7XG4gICAgYmFkZ2VFbC50YWJJbmRleCA9IDA7XG4gICAgYmFkZ2VFbC5vbmNsaWNrID0gb25CdWlsZDtcbiAgICBiYWRnZUVsLm9ua2V5ZG93biA9IChlKSA9PiB7IGlmIChlLmtleSA9PT0gJ0VudGVyJyB8fCBlLmtleSA9PT0gJyAnKSB7IGUucHJldmVudERlZmF1bHQoKTsgb25CdWlsZCgpOyB9IH07XG4gIH0gZWxzZSB7XG4gICAgYmFkZ2VFbC50ZXh0Q29udGVudCA9ICdPcmlnaW5hbCBxdWFsaXR5IMK3IHNsb3dlciBzZWVraW5nJztcbiAgICBiYWRnZUVsLnRpdGxlID0gJ1BsYXlpbmcgdGhlIG9yaWdpbmFsIHJlY29yZGluZyAtIHNlZWtpbmcgYSBsb25nIGZpbGUgY2FuIGJlIHNsb3cuJztcbiAgfVxufVxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gQ3Jvc3MtY3V0dGluZyBVSSBmZWVkYmFjayBoZWxwZXJzIHdpdGggbm8gaG9tZSBpbiBhIHNpbmdsZSBmZWF0dXJlOiB0b2FzdHMsIHRoZVxyXG4vLyAgIGJvdHRvbSBsb2cgcGFuZWwsIHNvcnQtZGlyZWN0aW9uIGJ1dHRvbnMsIHNwZWFrZXItbGFiZWxzIChkaWFyaXphdGlvbikgcmVhZGluZXNzLCBcInJldmVhbCBpblxyXG4vLyAgIGZvbGRlclwiLCBhbmQgY2xpcGJvYXJkIGNvcHkuIFN0YXRlL2Zvcm1hdC9qb2ItU1NFL3ByZXZpZXcgbWFjaGluZXJ5IHNwbGl0IG91dCBpbiBzdGFnZSAwMi5cclxuLy8gICBBUEk6IHJvdXRlcy9jb25maWcucHksIHJvdXRlcy9sb2dzLnB5IChpbmRpcmVjdGx5KSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV91dGlscy5weVxyXG5pbXBvcnQgeyBlc2NIdG1sLCBzdHJpcFJpY2hNYXJrdXAgfSBmcm9tICcuL2Zvcm1hdC5qcyc7XHJcblxyXG4vLyDilIDilIAgc29ydC1kaXJlY3Rpb24gdG9nZ2xlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBSZWZsZWN0cyBhIHNvcnQtZGlyZWN0aW9uIHRvZ2dsZSdzIGN1cnJlbnQgc3RhdGUgb250byBpdHMgYnV0dG9uOiBhcnJvdyBnbHlwaCxcclxuLy8gYXJpYS1wcmVzc2VkLCBhbmQgYSBzZWxmLWRlc2NyaWJpbmcgYXJpYS1sYWJlbC4gJ2Rlc2MnIGlzIHRoZSBzb3J0IG9wdGlvbidzXHJcbi8vIG5hdHVyYWwgb3JkZXIgKGhpZ2hlc3QvbmV3ZXN0IGZpcnN0KTsgJ2FzYycgcmV2ZXJzZXMgaXQuXHJcbmV4cG9ydCBmdW5jdGlvbiBfc3luY1NvcnREaXJCdG4oYnRuSWQsIGRpcikge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGJ0bklkKTtcclxuICBpZiAoIWJ0bikgcmV0dXJuO1xyXG4gIGNvbnN0IGFzYyA9IGRpciA9PT0gJ2FzYyc7XHJcbiAgYnRuLmlubmVySFRNTCA9IGFzYyA/ICcmIzg1OTM7JyA6ICcmIzg1OTU7JztcclxuICBidG4uc2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnLCBhc2MgPyAndHJ1ZScgOiAnZmFsc2UnKTtcclxuICBidG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYXNjXHJcbiAgICA/ICdTb3J0ZWQgYXNjZW5kaW5nIC0gY2xpY2sgdG8gc29ydCBkZXNjZW5kaW5nJ1xyXG4gICAgOiAnU29ydGVkIGRlc2NlbmRpbmcgLSBjbGljayB0byBzb3J0IGFzY2VuZGluZycpO1xyXG4gIGJ0bi50aXRsZSA9IGFzYyA/ICdBc2NlbmRpbmcgb3JkZXInIDogJ0Rlc2NlbmRpbmcgb3JkZXInO1xyXG59XHJcblxyXG4vLyDilIDilIAgc3BlYWtlciBsYWJlbHMgKGRpYXJpemF0aW9uKSByZWFkaW5lc3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIFNwZWVjaEJyYWluICh0aGUgZGVmYXVsdCBiYWNrZW5kKSBpcyBidW5kbGVkIC0gaXRzIHBhY2thZ2Ugc2hvdWxkIGFsd2F5cyBiZVxyXG4vLyBwcmVzZW50LCBzbyBhbiB1bnJlYWR5IHJlc3VsdCB0aGVyZSBtZWFucyBhIGJyb2tlbiBpbnN0YWxsLCBub3QgYSBtaXNzaW5nXHJcbi8vIG9wdGlvbmFsIGRvd25sb2FkLiBQeWFubm90ZSBpcyB0aGUgYWR2YW5jZWQsIHRva2VuLWdhdGVkIGFsdGVybmF0aXZlIGFuZCBzdGlsbFxyXG4vLyBuZWVkcyBhIHJlYWwgaW5zdGFsbCArIGEgSHVnZ2luZ0ZhY2UgdG9rZW4uIFRoZSBwZXItcnVuIGNoZWNrYm94ZXMgaW4gdGhlXHJcbi8vIGFuYWx5emUgYW5kIGV4cG9ydCBwYW5lbHMgYm90aCBnYXRlIG9uIHRoaXMgc2luZ2xlIGNoZWNrLiBDZW50cmFsaXplZCBoZXJlIHNvXHJcbi8vIHRoZSB0aHJlZSBzdXJmYWNlcyAoU2V0dGluZ3MsIGFuYWx5emUsIGV4cG9ydCkgY2FuJ3QgZHJpZnQgdG8gZGlmZmVyZW50IHJ1bGVzLlxyXG5leHBvcnQgZnVuY3Rpb24gX2RpYXJpemF0aW9uUmVhc29uKGluc3RhbGxlZCkge1xyXG4gIHJldHVybiBpbnN0YWxsZWQgPyAnJyA6ICdTcGVlY2hCcmFpbiBpcyB1bmF2YWlsYWJsZSAtIHRyeSByZWluc3RhbGxpbmcgWXV1Q2xpcCc7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBfZGlhcml6YXRpb25SZWFkaW5lc3MoKSB7XHJcbiAgY29uc3QgY2ZnID0gYXdhaXQgZmV0Y2goJy9hcGkvY29uZmlnJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiAoe30pKTtcclxuICBjb25zdCBiYWNrZW5kID0gY2ZnLmRpYXJpemF0aW9uX2JhY2tlbmQgfHwgJ3NwZWVjaGJyYWluJztcclxuICBjb25zdCBpbnN0YWxsID0gYXdhaXQgZmV0Y2goJy9hcGkvaW5zdGFsbC9zcGVlY2hicmFpbicpLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gKHtpbnN0YWxsZWQ6IGZhbHNlfSkpO1xyXG4gIGNvbnN0IGluc3RhbGxlZCA9ICEhaW5zdGFsbC5pbnN0YWxsZWQ7XHJcbiAgcmV0dXJuIHtcclxuICAgIGluc3RhbGxlZCxcclxuICAgIGJhY2tlbmQsXHJcbiAgICByZWFkeTogICBpbnN0YWxsZWQsXHJcbiAgICByZWFzb246ICBfZGlhcml6YXRpb25SZWFzb24oaW5zdGFsbGVkKSxcclxuICB9O1xyXG59XHJcblxyXG4vLyBOb3RlIHNob3duIG9uIGEgZGlzYWJsZWQgc3BlYWtlci1sYWJlbHMgY29udHJvbDogdGhlIGJsb2NraW5nIHJlYXNvbiBwbHVzIGFcclxuLy8gYnV0dG9uIHRoYXQganVtcHMgdG8gU2V0dGluZ3MuIHNldHRpbmdzT25jbGljayBjbG9zZXMgdGhlIGhvc3Qgc3VyZmFjZSBmaXJzdFxyXG4vLyAodGhlIGFuYWx5emUgcGFuZWwgb3IgZXhwb3J0IG1vZGFsKSBzbyBTZXR0aW5ncyBpc24ndCBvcGVuZWQgYmVoaW5kIGl0LlxyXG5leHBvcnQgZnVuY3Rpb24gX2RpYXJpemF0aW9uTm90ZUh0bWwocmVhc29uLCBzZXR0aW5nc09uY2xpY2spIHtcclxuICByZXR1cm4gZXNjSHRtbChyZWFzb24pICsgJyAtIHNldCB1cCBpbiAnICtcclxuICAgICc8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjAgNHB4O2NvbG9yOnZhcigtLWFjY2VudCk7JyArXHJcbiAgICBgZGlzcGxheTppbmxpbmUtZmxleFwiIG9uY2xpY2s9XCIke2VzY0h0bWwoc2V0dGluZ3NPbmNsaWNrKX1cIj5TZXR0aW5nczwvYnV0dG9uPmA7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBsb2cgcGFuZWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmV4cG9ydCBmdW5jdGlvbiBvcGVuTG9nKCkge1xyXG4gIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1wYW5lbCcpO1xyXG4gIHBhbmVsLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcclxuICBwYW5lbC5jbGFzc0xpc3QucmVtb3ZlKCdtaW5pbWl6ZWQnKTtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLXRvZ2dsZScpLnRleHRDb250ZW50ID0gJ+KWsic7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiB0b2dnbGVMb2coKSB7XHJcbiAgY29uc3QgcGFuZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLXBhbmVsJyk7XHJcbiAgY29uc3QgbWluaW1pemVkID0gcGFuZWwuY2xhc3NMaXN0LnRvZ2dsZSgnbWluaW1pemVkJyk7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy10b2dnbGUnKS50ZXh0Q29udGVudCA9IG1pbmltaXplZCA/ICfilrwnIDogJ+KWsic7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1sb2ctdG9nZ2xlJykuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgbWluaW1pemVkID8gJ2ZhbHNlJyA6ICd0cnVlJyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjbGVhckxvZygpIHtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWxpbmVzJykuaW5uZXJIVE1MID0gJyc7XHJcbn1cclxuXHJcbi8vIFRoZSBsb2cgaGVhZGVyJ3MgdG9nZ2xlL2NsZWFyIGJ1dHRvbnMgYXJlIHN0YXRpYyBtYXJrdXAgaW4gaW5kZXguaHRtbCAobmV2ZXJcclxuLy8gcmUtcmVuZGVyZWQpLCBzbyB0aGlzIG9uZS10aW1lIHdpcmluZyBhdCBtb2R1bGUgbG9hZCBjYW4ndCBkb3VibGUtZmlyZS5cclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1sb2ctdG9nZ2xlJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0b2dnbGVMb2cpO1xyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNsZWFyLWxvZycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgY2xlYXJMb2cpO1xyXG5cclxuLy8gQ2FwIHRoZSBsb2cgRE9NLiBBbiB1bmJvdW5kZWQgbG9nIGZyb3plIHRoZSBicm93c2VyIG9uIGxvbmcgcnVucyBhbmQsIHdvcnNlLFxyXG4vLyB3aGVuIGEgcmVhdHRhY2hlZCBhbmFseXplIHN0cmVhbSByZXBsYXllZCBhIGxhcmdlIGJ1ZmZlciBhbGwgYXQgb25jZSAoZWFjaCBsaW5lXHJcbi8vIHRyaWdnZXJzIGEgc2Nyb2xsLXRvLWJvdHRvbSByZWZsb3cpIC0gdGhlIHRhYiBsb2NrZWQgdXAsIHRoZSBlbGFwc2VkIHRpbWVyXHJcbi8vIGFwcGVhcmVkIGZyb3plbiwgYW5kIENhbmNlbCB3b3VsZG4ndCByZXNwb25kLiBLZWVwaW5nIG9ubHkgdGhlIG1vc3QgcmVjZW50IGxpbmVzXHJcbi8vIGJvdW5kcyB0aGUgcmVmbG93IGNvc3Q7IHRoZSBmdWxsIGxvZyBhbHdheXMgcmVtYWlucyBpbiAueXV1LWNsaXAveXV1LWNsaXAubG9nLlxyXG5jb25zdCBfTUFYX0xPR19MSU5FUyA9IDUwMDtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBhcHBlbmRMb2cocmF3KSB7XHJcbiAgY29uc3QgdGV4dCA9IHN0cmlwUmljaE1hcmt1cChyYXcpO1xyXG4gIGlmICghdGV4dC50cmltKCkpIHJldHVybjtcclxuICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBjb25zdCBpc09rICAgPSByYXcuaW5jbHVkZXMoJyBPSycpIHx8IHJhdy5pbmNsdWRlcygnW2dyZWVuXScpIHx8IHJhdy5pbmNsdWRlcygnRG9uZScpO1xyXG4gIGNvbnN0IGlzRXJyICAgPSByYXcuaW5jbHVkZXMoJ0ZBSUwnKSB8fCByYXcuaW5jbHVkZXMoJ0Vycm9yJykgfHwgcmF3LmluY2x1ZGVzKCdbcmVkXScpIHx8IHJhdy5pbmNsdWRlcygnZXJyb3InKTtcclxuICBjb25zdCBpc1dhcm4gID0gcmF3LmluY2x1ZGVzKCdbeWVsbG93XScpIHx8IHJhdy5pbmNsdWRlcygnV0FSTklORycpIHx8IHJhdy5pbmNsdWRlcygnb3ZlcmxhcCcpO1xyXG4gIGRpdi5jbGFzc05hbWUgPSAnbG9nLWxpbmUnICsgKGlzT2sgPyAnIG9rJyA6IGlzRXJyID8gJyBlcnInIDogaXNXYXJuID8gJyB3YXJuJyA6ICcnKTtcclxuICBkaXYuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcclxuICBkaXYuc3R5bGUuZ2FwID0gJzZweCc7XHJcbiAgY29uc3QgdHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgdHMuc3R5bGUuY3NzVGV4dCA9ICdjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEwcHg7ZmxleC1zaHJpbms6MDtvcGFjaXR5Oi43JztcclxuICB0cy50ZXh0Q29udGVudCA9IG5ldyBEYXRlKCkudG9Mb2NhbGVUaW1lU3RyaW5nKHVuZGVmaW5lZCwge2hvdXI6JzItZGlnaXQnLCBtaW51dGU6JzItZGlnaXQnLCBzZWNvbmQ6JzItZGlnaXQnfSk7XHJcbiAgZGl2LmFwcGVuZENoaWxkKHRzKTtcclxuICBkaXYuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCkpO1xyXG4gIGNvbnN0IGxpbmVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1saW5lcycpO1xyXG4gIGxpbmVzLmFwcGVuZENoaWxkKGRpdik7XHJcbiAgd2hpbGUgKGxpbmVzLmNoaWxkRWxlbWVudENvdW50ID4gX01BWF9MT0dfTElORVMpIGxpbmVzLnJlbW92ZUNoaWxkKGxpbmVzLmZpcnN0RWxlbWVudENoaWxkKTtcclxuICBjb25zdCBib2R5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1ib2R5Jyk7XHJcbiAgYm9keS5zY3JvbGxUb3AgPSBib2R5LnNjcm9sbEhlaWdodDtcclxufVxyXG5cclxuLy8g4pSA4pSAIHRvYXN0IG5vdGlmaWNhdGlvbnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIFR5cGVzOiBzdWNjZXNzIHwgaW5mbyB8IHdhcm5pbmcgKGd1YXJkL2d1aWRhbmNlKSB8IGVycm9yIChhY3R1YWwgZmFpbHVyZXMpLlxyXG4vLyBFcnJvciB0b2FzdHMgcGVyc2lzdCB1bnRpbCBkaXNtaXNzZWQgLSBkdXJhdGlvbk1zIGlzIGlnbm9yZWQgZm9yIHRoZW0uXHJcbi8vIG9wdHM6IHsgZHVyYXRpb25NcywgYWN0aW9uOiB7bGFiZWwsIG9uQ2xpY2t9IH1cclxuY29uc3QgVE9BU1RfU1RBQ0tfTUFYID0gNDtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzaG93VG9hc3QobWVzc2FnZSwgdHlwZSA9ICdzdWNjZXNzJywgb3B0cyA9IHt9KSB7XHJcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RvYXN0LWNvbnRhaW5lcicpO1xyXG4gIGNvbnN0IGxpdmVSZWdpb24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0eXBlID09PSAnZXJyb3InID8gJ3NyLWxpdmUtYXNzZXJ0aXZlJyA6ICdzci1saXZlLXBvbGl0ZScpO1xyXG4gIGlmIChsaXZlUmVnaW9uKSB7IGxpdmVSZWdpb24udGV4dENvbnRlbnQgPSAnJzsgc2V0VGltZW91dCgoKSA9PiB7IGxpdmVSZWdpb24udGV4dENvbnRlbnQgPSBtZXNzYWdlOyB9LCAxMCk7IH1cclxuICB3aGlsZSAoY29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aCA+PSBUT0FTVF9TVEFDS19NQVgpIGNvbnRhaW5lci5maXJzdEVsZW1lbnRDaGlsZC5yZW1vdmUoKTtcclxuICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHRvYXN0LmNsYXNzTmFtZSA9IGB0b2FzdCAke3R5cGV9YDtcclxuICB0b2FzdC5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjEwcHgnO1xyXG4gIGNvbnN0IG1zZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICBtc2cudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xyXG4gIHRvYXN0LmFwcGVuZENoaWxkKG1zZyk7XHJcbiAgY29uc3QgYnV0dG9ucyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGJ1dHRvbnMuc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmZsZXg7Z2FwOjZweDthbGlnbi1pdGVtczpjZW50ZXI7ZmxleC1zaHJpbms6MCc7XHJcbiAgaWYgKG9wdHMuYWN0aW9uKSB7XHJcbiAgICBjb25zdCBhY3Rpb25CdG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgIGFjdGlvbkJ0bi5jbGFzc05hbWUgPSAnYnRuIGdob3N0JztcclxuICAgIGFjdGlvbkJ0bi5zdHlsZS5jc3NUZXh0ID0gJ2ZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6MnB4IDhweCc7XHJcbiAgICBhY3Rpb25CdG4udGV4dENvbnRlbnQgPSBvcHRzLmFjdGlvbi5sYWJlbDtcclxuICAgIGFjdGlvbkJ0bi5vbmNsaWNrID0gKCkgPT4geyB0b2FzdC5yZW1vdmUoKTsgb3B0cy5hY3Rpb24ub25DbGljaygpOyB9O1xyXG4gICAgYnV0dG9ucy5hcHBlbmRDaGlsZChhY3Rpb25CdG4pO1xyXG4gIH1cclxuICBjb25zdCBjbG9zZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGNsb3NlLnRleHRDb250ZW50ID0gJ8OXJztcclxuICBjbG9zZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnRGlzbWlzcycpO1xyXG4gIGNsb3NlLnN0eWxlLmNzc1RleHQgPSBgYmFja2dyb3VuZDpub25lO2JvcmRlcjpub25lO2NvbG9yOmluaGVyaXQ7Y3Vyc29yOnBvaW50ZXI7Zm9udC1zaXplOjE4cHg7bGluZS1oZWlnaHQ6MTtwYWRkaW5nOjA7ZmxleC1zaHJpbms6MDtvcGFjaXR5OiR7dHlwZSA9PT0gJ2Vycm9yJyA/ICcuOCcgOiAnLjUnfWA7XHJcbiAgY2xvc2Uub25jbGljayA9ICgpID0+IHRvYXN0LnJlbW92ZSgpO1xyXG4gIGJ1dHRvbnMuYXBwZW5kQ2hpbGQoY2xvc2UpO1xyXG4gIHRvYXN0LmFwcGVuZENoaWxkKGJ1dHRvbnMpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0b2FzdCk7XHJcbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHJldHVybjtcclxuICBjb25zdCBtcyA9IG9wdHMuZHVyYXRpb25NcyA/PyAodHlwZSA9PT0gJ3dhcm5pbmcnID8gNjAwMCA6IDQwMDApO1xyXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgdG9hc3Quc3R5bGUudHJhbnNpdGlvbiA9ICdvcGFjaXR5IC4zcyc7XHJcbiAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xyXG4gICAgc2V0VGltZW91dCgoKSA9PiB0b2FzdC5yZW1vdmUoKSwgMzAwKTtcclxuICB9LCBtcyk7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBuZXR3b3JrIGVycm9yIGNvcHkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIEEgZmV0Y2goKSByZWplY3Rpb24gbWVhbnMgdGhlIHJlcXVlc3QgbmV2ZXIgZ290IGEgcmVzcG9uc2UgLSBvbiB0aGlzIGxvY2FsaG9zdC9cclxuLy8gRWxlY3Ryb24gYXBwIHRoYXQgYWxtb3N0IGFsd2F5cyBtZWFucyB0aGUgYmFja2VuZCBzdG9wcGVkLCBub3QgYSByZWFsIG5ldHdvcmsuXHJcbi8vIFRoZSBicm93c2VyIHJlcG9ydHMgaXQgYXMgYSBUeXBlRXJyb3Igd2hvc2UgbWVzc2FnZSBpcyB0aGUgb3BhcXVlIFwiRmFpbGVkIHRvXHJcbi8vIGZldGNoXCIsIHVzZWxlc3MgdG8gYSBub24tZGV2ZWxvcGVyLiBBbiBFcnJvciB0aHJvd24gYWZ0ZXIgYSBub24tb2sgcmVzcG9uc2VcclxuLy8gYWxyZWFkeSBjYXJyaWVzIGEgcmVhbCwgc3BlY2lmaWMgbWVzc2FnZSwgc28gcGFzcyB0aG9zZSB0aHJvdWdoIHVuY2hhbmdlZC4gVXNlXHJcbi8vIHRoaXMgb25seSBhdCBjYXRjaCBzaXRlcyB0aGF0IHdyYXAgYSBiYXJlIGZldGNoIChub3Qgb25lcyBkb2luZyBET00gd29yayB0aGF0XHJcbi8vIGNvdWxkIHRocm93IGl0cyBvd24gVHlwZUVycm9yKS5cclxuZXhwb3J0IGZ1bmN0aW9uIG5ldEVyck1zZyhlcnIpIHtcclxuICBpZiAoZXJyIGluc3RhbmNlb2YgVHlwZUVycm9yKSByZXR1cm4gXCJDb3VsZG4ndCByZWFjaCBZdXVDbGlwIC0gaXQgbWF5IGhhdmUgc3RvcHBlZC4gVHJ5IGFnYWluLCBvciByZXN0YXJ0IHRoZSBhcHAuXCI7XHJcbiAgcmV0dXJuIChlcnIgJiYgZXJyLm1lc3NhZ2UpIHx8ICdVbmtub3duIGVycm9yJztcclxufVxyXG5cclxuLy8g4pSA4pSAIHJldmVhbCBpbiBmaWxlIGV4cGxvcmVyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmV2ZWFsSW5Gb2xkZXIocGF0aCkge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2FwaS9yZXZlYWwnLCB7XHJcbiAgICAgIG1ldGhvZDogJ1BPU1QnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtwYXRofSksXHJcbiAgICB9KTtcclxuICAgIGlmICghcmVzLm9rKSB7XHJcbiAgICAgIGNvbnN0IGUgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xyXG4gICAgICBzaG93VG9hc3QoYENvdWxkIG5vdCBzaG93IGluIGZvbGRlcjogJHtlLmRldGFpbCB8fCAnZmFpbGVkJ31gLCAnZXJyb3InKTtcclxuICAgIH1cclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHNob3dUb2FzdChgQ291bGQgbm90IHNob3cgaW4gZm9sZGVyOiAke2Vyci5tZXNzYWdlfWAsICdlcnJvcicpO1xyXG4gIH1cclxufVxyXG5cclxuLy8g4pSA4pSAIGNsaXBib2FyZCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gVGhlIGFwcCBvbmx5IGV2ZXIgcnVucyBvbiBsb2NhbGhvc3Qgb3IgaW5zaWRlIEVsZWN0cm9uLCBzbyBuYXZpZ2F0b3IuY2xpcGJvYXJkXHJcbi8vIGlzIGFsd2F5cyBhdmFpbGFibGUgLSBhIGZhaWx1cmUgdG9hc3QgaXMgZW5vdWdoLCBubyBleGVjQ29tbWFuZCBmYWxsYmFjay5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvcHlUZXh0KHRleHQsIGxhYmVsKSB7XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpO1xyXG4gICAgc2hvd1RvYXN0KGAke2xhYmVsfSBjb3BpZWRgLCAnc3VjY2VzcycpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgc2hvd1RvYXN0KGBDb3VsZCBub3QgY29weSAke2xhYmVsLnRvTG93ZXJDYXNlKCl9OiAke2Vyci5tZXNzYWdlfWAsICdlcnJvcicpO1xyXG4gIH1cclxufVxyXG5cclxuLy8g4pSA4pSAIGNvbGxhcHNpYmxlIGRldGFpbCBjYXJkcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gT3B0LWluOiBidWlsZCBhIGNhcmQgd2l0aCBjb2xsYXBzaWJsZUNhcmQoa2V5LCB0aXRsZSwgYm9keSwge2FjdGlvbnN9KS4gVGhlXHJcbi8vIHRpdGxlIGlzIHJlbmRlcmVkIGluc2lkZSBhIHJlYWwgPGJ1dHRvbiBjbGFzcz1cImNhcmQtdG9nZ2xlXCI+LCBzbyB0aGUgdG9nZ2xlXHJcbi8vIGhhcyBuYXRpdmUga2V5Ym9hcmQvZm9jdXMgYmVoYXZpb3VyIGFuZCAtIGJlY2F1c2Ugc2hvcnRjdXRzLmpzJ3MgZ2xvYmFsXHJcbi8vIGtleWRvd24gYmFpbHMgb24gdGFnTmFtZSA9PT0gJ0JVVFRPTicgLSBTcGFjZSBvbiBhIGZvY3VzZWQgdG9nZ2xlIG5ldmVyIGFsc29cclxuLy8gZmlyZXMgcGxheS9wYXVzZS4gSGVhZGVyIGFjdGlvbiBjb250cm9scyBhcmUgcGFzc2VkIHZpYSBvcHRzLmFjdGlvbnMgYW5kIHNpdFxyXG4vLyBhcyBTSUJMSU5HUyBvZiB0aGUgdG9nZ2xlIGJ1dHRvbiwgbmV2ZXIgZGVzY2VuZGFudHMsIHNvIGEgYnV0dG9uIG5ldmVyIG5lc3RzXHJcbi8vIGluc2lkZSB0aGUgdG9nZ2xlIChXQ0FHIDQuMS4yIG5lc3RlZC1pbnRlcmFjdGl2ZSkuIFNlZWRlZCBmcm9tIGlzQ2FyZENvbGxhcHNlZChrZXkpLlxyXG5jb25zdCBfQ0FSRF9DT0xMQVBTRV9LRVkgPSAneXV1Y2xpcC1jYXJkLWNvbGxhcHNlZCc7XHJcblxyXG5mdW5jdGlvbiBfY2FyZENvbGxhcHNlU3RhdGUoKSB7XHJcbiAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oX0NBUkRfQ09MTEFQU0VfS0VZKSB8fCAne30nKSB8fCB7fTsgfVxyXG4gIGNhdGNoIHsgcmV0dXJuIHt9OyB9XHJcbn1cclxuXHJcbi8vIFBlcnNpc3RlZCBjb2xsYXBzZSBzdGF0ZSBwZXIgY2FyZCBrZXkuIGRlZmF1bHRDb2xsYXBzZWQgbGV0cyBhIGNhcmQgKGUuZy4gdGhlXHJcbi8vIGhlYXZ5IGZ1bGwtdmlkZW8gdHJhbnNjcmlwdCkgc3RhcnQgY29sbGFwc2VkIHVudGlsIHRoZSB1c2VyIG9wZW5zIGl0LlxyXG5mdW5jdGlvbiBpc0NhcmRDb2xsYXBzZWQoa2V5LCBkZWZhdWx0Q29sbGFwc2VkID0gZmFsc2UpIHtcclxuICBjb25zdCBzdGF0ZSA9IF9jYXJkQ29sbGFwc2VTdGF0ZSgpO1xyXG4gIHJldHVybiBrZXkgaW4gc3RhdGUgPyAhIXN0YXRlW2tleV0gOiBkZWZhdWx0Q29sbGFwc2VkO1xyXG59XHJcblxyXG4vLyBTaW5nbGUgc291cmNlIG9mIHRoZSBjb2xsYXBzaWJsZS1jYXJkIG1hcmt1cCBjb250cmFjdDogdGhlIH4xMSBkZXRhaWwgY2FyZHNcclxuLy8gdGhhdCBvcHQgaW4gYWxsIHJlbmRlciB0aHJvdWdoIGhlcmUgc28gbm9uZSBjYW4gZHJpZnQgZnJvbSB0aGUgY2xhc3MgL1xyXG4vLyBkYXRhLWNvbGxhcHNlLWtleSAvIHRvZ2dsZS1hMTF5IGF0dHJpYnV0ZXMgdGhlIHRvZ2dsZSBsb2dpYyBiZWxvdyByZWFkcy5cclxuLy8gdGl0bGUgPSB0aGUgaGVhZGVyJ3MgdGl0bGUgY29udGVudCAoZ29lcyBpbnNpZGUgdGhlIHRvZ2dsZSBidXR0b24pOyBib2R5ID1cclxuLy8gZXZlcnl0aGluZyBzaG93biBiZWxvdyB0aGUgaGVhZGVyLiBvcHRzLmFjdGlvbnMgPSBoZWFkZXIgY29udHJvbHMgcmVuZGVyZWRcclxuLy8gYmVzaWRlIHRoZSB0b2dnbGU7IG9wdHMuZGVmYXVsdENvbGxhcHNlZCBzdGFydHMgYSBjYXJkIGNvbGxhcHNlZCB1bnRpbCBmaXJzdFxyXG4vLyBvcGVuZWQ7IG9wdHMuYXR0cnMgYWRkcyBjYXJkIGF0dHJpYnV0ZXMgKGlkLCBkYXRhLSopOyBvcHRzLmhlYWRlclN0eWxlIHNldHNcclxuLy8gYW4gaW5saW5lIHN0eWxlIG9uIHRoZSBoZWFkZXIgcm93LlxyXG5leHBvcnQgZnVuY3Rpb24gY29sbGFwc2libGVDYXJkKGtleSwgdGl0bGUsIGJvZHksIG9wdHMgPSB7fSkge1xyXG4gIGNvbnN0IHsgZGVmYXVsdENvbGxhcHNlZCA9IGZhbHNlLCBhdHRycyA9ICcnLCBoZWFkZXJTdHlsZSA9ICcnLCBhY3Rpb25zID0gJycgfSA9IG9wdHM7XHJcbiAgY29uc3QgY29sbGFwc2VkID0gaXNDYXJkQ29sbGFwc2VkKGtleSwgZGVmYXVsdENvbGxhcHNlZCk7XHJcbiAgY29uc3Qgc3R5bGVBdHRyID0gaGVhZGVyU3R5bGUgPyBgIHN0eWxlPVwiJHtoZWFkZXJTdHlsZX1cImAgOiAnJztcclxuICBjb25zdCBleHRyYUF0dHJzID0gYXR0cnMgPyBgICR7YXR0cnN9YCA6ICcnO1xyXG4gIHJldHVybiBgXHJcbiAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQgY29sbGFwc2libGUke2NvbGxhcHNlZCA/ICcgY29sbGFwc2VkJyA6ICcnfVwiIGRhdGEtY29sbGFwc2Uta2V5PVwiJHtrZXl9XCIke2V4dHJhQXR0cnN9PlxyXG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCIke3N0eWxlQXR0cn0+XHJcbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjYXJkLXRvZ2dsZVwiIGFyaWEtZXhwYW5kZWQ9XCIke2NvbGxhcHNlZCA/ICdmYWxzZScgOiAndHJ1ZSd9XCI+JHt0aXRsZX08L2J1dHRvbj5cclxuICAgICAgICAke2FjdGlvbnN9XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgICAke2JvZHl9XHJcbiAgICA8L2Rpdj5gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfdG9nZ2xlQ29sbGFwc2libGVDYXJkKGNhcmQsIHRvZ2dsZSkge1xyXG4gIGNvbnN0IGNvbGxhcHNlZCA9IGNhcmQuY2xhc3NMaXN0LnRvZ2dsZSgnY29sbGFwc2VkJyk7XHJcbiAgdG9nZ2xlLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIGNvbGxhcHNlZCA/ICdmYWxzZScgOiAndHJ1ZScpO1xyXG4gIGNvbnN0IGtleSA9IGNhcmQuZGF0YXNldC5jb2xsYXBzZUtleTtcclxuICBpZiAoIWtleSkgcmV0dXJuO1xyXG4gIC8vIFBlcnNpc3QgYmVzdC1lZmZvcnQ6IGEgd3JpdGUgZmFpbHVyZSAocHJpdmF0ZSBtb2RlLCBxdW90YSkgbXVzdCBub3Qgc3dhbGxvd1xyXG4gIC8vIHRoZSB0b2dnbGUgb3IgYmxvY2sgdGhlIGxhenktbG9hZCBkaXNwYXRjaCBiZWxvdy4gVGhlIHJlYWQgcGF0aFxyXG4gIC8vIChfY2FyZENvbGxhcHNlU3RhdGUpIGlzIGxpa2V3aXNlIHRvbGVyYW50LlxyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBzdGF0ZSA9IF9jYXJkQ29sbGFwc2VTdGF0ZSgpO1xyXG4gICAgc3RhdGVba2V5XSA9IGNvbGxhcHNlZDtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKF9DQVJEX0NPTExBUFNFX0tFWSwgSlNPTi5zdHJpbmdpZnkoc3RhdGUpKTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIGNvbnNvbGUud2FybignQ291bGQgbm90IHBlcnNpc3QgY2FyZCBjb2xsYXBzZSBzdGF0ZTonLCBlcnIpO1xyXG4gIH1cclxuICAvLyBMZXRzIGEgY2FyZCBsYXp5LWxvYWQgaXRzIGJvZHkgdGhlIGZpcnN0IHRpbWUgaXQgaXMgZXhwYW5kZWQuXHJcbiAgY2FyZC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgnY2FyZHRvZ2dsZScsIHsgYnViYmxlczogdHJ1ZSwgZGV0YWlsOiB7IGtleSwgY29sbGFwc2VkIH0gfSkpO1xyXG59XHJcblxyXG4vLyBPbmx5IHRoZSBjYXJkJ3Mgb3duIHRvZ2dsZSBidXR0b24gY29sbGFwc2VzIGl0IChuYXRpdmUgRW50ZXIvU3BhY2UgYWN0aXZhdGUgaXRcclxuLy8gdG9vKS4gTmVzdGVkIGhlYWRlcnMgaW5zaWRlIGEgY29tcG91bmQgY2FyZCdzIGJvZHkgY2Fycnkgbm8gLmNhcmQtdG9nZ2xlLCBzb1xyXG4vLyB0aGV5IG5laXRoZXIgdG9nZ2xlIG5vciBzaG93IGEgY2hldnJvbi5cclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xyXG4gIGNvbnN0IHRvZ2dsZSA9IGUudGFyZ2V0LmNsb3Nlc3QoJy5jYXJkLXRvZ2dsZScpO1xyXG4gIGlmICghdG9nZ2xlKSByZXR1cm47XHJcbiAgY29uc3QgY2FyZCA9IHRvZ2dsZS5jbG9zZXN0KCcuZGV0YWlsLWNhcmQuY29sbGFwc2libGUnKTtcclxuICBpZiAoY2FyZCkgX3RvZ2dsZUNvbGxhcHNpYmxlQ2FyZChjYXJkLCB0b2dnbGUpO1xyXG59KTtcclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gU2hhcmVkIFVJIHByaW1pdGl2ZXMgKGFsZXJ0IC8gY29uZmlybSAvIHByb21wdCBtb2RhbHMpIHVzZWQgYXBwLXdpZGUuXG4vLyAgIEFQSTogbm9uZSAoY2xpZW50LW9ubHkpIMK3IFRlc3RzOiBjb3ZlcmVkIGluZGlyZWN0bHkgYnkgdGhlIHRlc3RfdWlfKi5weSBzdWl0ZXNcbmltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBlc2NIdG1sIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xuXG4vLyDilIDilIAgYWxlcnQgbW9kYWwgKHNpbmdsZS1idXR0b24sIG5vIGNhbmNlbCkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2FsZXJ0T3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBzaG93QWxlcnQodGl0bGUsIGJvZHkpIHtcbiAgX2FsZXJ0T3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LWJvZHknKS5pbm5lckhUTUwgPSBib2R5O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2FsZXJ0LW1vZGFsIC5idG4nKS5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VBbGVydE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9hbGVydE9wZW5lcjtcbiAgX2FsZXJ0T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgY29uZmlybSBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfY29uZmlybU9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gc2hvd0NvbmZpcm0odGl0bGUsIGJvZHksIG9rTGFiZWwsIG9uT2ssIGRhbmdlciA9IGZhbHNlLCBjYW5jZWxMYWJlbCA9ICdDYW5jZWwnKSB7XG4gIF9jb25maXJtT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tdGl0bGUnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1ib2R5JykuaW5uZXJIVE1MID0gYm9keTtcbiAgY29uc3Qgb2sgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1vay1idG4nKTtcbiAgb2sudGV4dENvbnRlbnQgPSBva0xhYmVsO1xuICBvay5jbGFzc05hbWUgPSBkYW5nZXIgPyAnYnRuIGRhbmdlcicgOiAnYnRuIHByaW1hcnknO1xuICAvLyBFdmVyeSBjYWxsIHNldHMgaXQsIHNvIHRoZSBkZWZhdWx0ICdDYW5jZWwnIGlzIHJlc3RvcmVkIGZvciBjYWxsZXJzIHRoYXRcbiAgLy8gZG9uJ3QgcGFzcyBhIGN1c3RvbSBsYWJlbCAtIG5vIHN0YWxlIGxhYmVsIGxlYWtzIGJldHdlZW4gY29uZmlybXMuXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWNhbmNlbC1idG4nKS50ZXh0Q29udGVudCA9IGNhbmNlbExhYmVsO1xuICBBcHBTdGF0ZS5jb25maXJtQ2FsbGJhY2sgPSBvbk9rO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1jYW5jZWwtYnRuJykuZm9jdXMoKSwgNTApO1xufVxuZnVuY3Rpb24gX2NvbmZpcm1PaygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IGNiID0gQXBwU3RhdGUuY29uZmlybUNhbGxiYWNrO1xuICBBcHBTdGF0ZS5jb25maXJtQ2FsbGJhY2sgPSBudWxsO1xuICBjb25zdCBvcGVuZXIgPSBfY29uZmlybU9wZW5lcjtcbiAgX2NvbmZpcm1PcGVuZXIgPSBudWxsO1xuICBpZiAoY2IpIGNiKCk7XG4gIGVsc2UgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIF9jb25maXJtQ2FuY2VsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgQXBwU3RhdGUuY29uZmlybUNhbGxiYWNrID0gbnVsbDtcbiAgY29uc3Qgb3BlbmVyID0gX2NvbmZpcm1PcGVuZXI7XG4gIF9jb25maXJtT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgYWRkaXRpb25hbCBhY3Rpb25zIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9hY3Rpb25zTW9kYWxPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5BY3Rpb25zTW9kYWwodGl0bGUsIGdyb3Vwcykge1xuICBfYWN0aW9uc01vZGFsT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGlvbnMtbW9kYWwtdGl0bGUnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBjb25zdCBib2R5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGlvbnMtbW9kYWwtYm9keScpO1xuICBib2R5LmlubmVySFRNTCA9ICcnO1xuICBncm91cHMuZm9yRWFjaCgoZ3JvdXAsIGkpID0+IHtcbiAgICBpZiAoaSA+IDApIHtcbiAgICAgIGNvbnN0IGRpdmlkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGRpdmlkZXIuY2xhc3NOYW1lID0gJ2hhbWJ1cmdlci1kaXZpZGVyJztcbiAgICAgIGJvZHkuYXBwZW5kQ2hpbGQoZGl2aWRlcik7XG4gICAgfVxuICAgIGlmIChncm91cC5oZWFkaW5nKSB7XG4gICAgICBjb25zdCBoZWFkaW5nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBoZWFkaW5nLmNsYXNzTmFtZSA9ICdzZWN0aW9uLXRpdGxlJztcbiAgICAgIGhlYWRpbmcuc3R5bGUuY3NzVGV4dCA9ICdtYXJnaW46OHB4IDAgMnB4IDRweCc7XG4gICAgICBoZWFkaW5nLnRleHRDb250ZW50ID0gZ3JvdXAuaGVhZGluZztcbiAgICAgIGJvZHkuYXBwZW5kQ2hpbGQoaGVhZGluZyk7XG4gICAgfVxuICAgIGZvciAoY29uc3Qgcm93IG9mIGdyb3VwLnJvd3MpIHtcbiAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICBlbC50eXBlID0gJ2J1dHRvbic7XG4gICAgICBlbC5jbGFzc05hbWUgPSAnYWN0aW9uLXJvdycgKyAocm93LmRhbmdlciA/ICcgZGFuZ2VyJyA6ICcnKTtcbiAgICAgIGVsLmRpc2FibGVkID0gISFyb3cuZGlzYWJsZWQ7XG4gICAgICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgIGxhYmVsLmNsYXNzTmFtZSA9ICdhY3Rpb24tcm93LWxhYmVsJztcbiAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gcm93LmxhYmVsO1xuICAgICAgY29uc3QgZGVzYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgIGRlc2MuY2xhc3NOYW1lID0gJ2FjdGlvbi1yb3ctZGVzYyc7XG4gICAgICBkZXNjLnRleHRDb250ZW50ID0gcm93LmRlc2NyaXB0aW9uO1xuICAgICAgZWwuYXBwZW5kKGxhYmVsLCBkZXNjKTtcbiAgICAgIGVsLm9uY2xpY2sgPSAoKSA9PiB7IGNsb3NlQWN0aW9uc01vZGFsKCk7IHJvdy5hY3Rpb24oKTsgfTtcbiAgICAgIGJvZHkuYXBwZW5kQ2hpbGQoZWwpO1xuICAgIH1cbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGJvZHkucXVlcnlTZWxlY3RvcignLmFjdGlvbi1yb3c6bm90KDpkaXNhYmxlZCknKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQWN0aW9uc01vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2FjdGlvbnNNb2RhbE9wZW5lcjtcbiAgX2FjdGlvbnNNb2RhbE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIG1vZGFsIGxheWVyaW5nICsgZm9jdXMgdHJhcCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIENvbmZpcm0gYW5kIGFsZXJ0IGFyZSB0aGUgb25seSBtb2RhbHMgdGhhdCBzdGFjayBvbiB0b3Agb2Ygb3RoZXIgbW9kYWxzLCBzb1xuLy8gdGhleSB0YWtlIHByaW9yaXR5OyBvdGhlcndpc2UgYWxsIC5tb2RhbC1iZyBzaGFyZSB6LWluZGV4IDIwMCBhbmQgdGhlIGxhc3Rcbi8vIHZpc2libGUgb25lIGluIERPTSBvcmRlciBpcyB0aGUgb25lIHBhaW50ZWQgb24gdG9wLlxuZXhwb3J0IGZ1bmN0aW9uIHRvcG1vc3RWaXNpYmxlTW9kYWwoKSB7XG4gIGZvciAoY29uc3QgaWQgb2YgWydjb25maXJtLW1vZGFsJywgJ2FsZXJ0LW1vZGFsJ10pIHtcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtcbiAgICBpZiAoZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykpIHJldHVybiBlbDtcbiAgfVxuICBjb25zdCB2aXNpYmxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLm1vZGFsLWJnLnZpc2libGUnKTtcbiAgcmV0dXJuIHZpc2libGUubGVuZ3RoID8gdmlzaWJsZVt2aXNpYmxlLmxlbmd0aCAtIDFdIDogbnVsbDtcbn1cblxuY29uc3QgX0ZPQ1VTQUJMRV9TRUxFQ1RPUiA9XG4gICdhW2hyZWZdLCBidXR0b246bm90KDpkaXNhYmxlZCksIGlucHV0Om5vdCg6ZGlzYWJsZWQpLCBzZWxlY3Q6bm90KDpkaXNhYmxlZCksICcgK1xuICAndGV4dGFyZWE6bm90KDpkaXNhYmxlZCksIFt0YWJpbmRleF06bm90KFt0YWJpbmRleD1cIi0xXCJdKSc7XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcbiAgaWYgKGUua2V5ICE9PSAnVGFiJykgcmV0dXJuO1xuICBjb25zdCBtb2RhbCA9IHRvcG1vc3RWaXNpYmxlTW9kYWwoKTtcbiAgaWYgKCFtb2RhbCkgcmV0dXJuO1xuICBjb25zdCBmb2N1c2FibGVzID0gWy4uLm1vZGFsLnF1ZXJ5U2VsZWN0b3JBbGwoX0ZPQ1VTQUJMRV9TRUxFQ1RPUildXG4gICAgLmZpbHRlcihlbCA9PiBlbC5nZXRDbGllbnRSZWN0cygpLmxlbmd0aCA+IDApO1xuICBpZiAoIWZvY3VzYWJsZXMubGVuZ3RoKSByZXR1cm47XG4gIGNvbnN0IGZpcnN0ID0gZm9jdXNhYmxlc1swXTtcbiAgY29uc3QgbGFzdCAgPSBmb2N1c2FibGVzW2ZvY3VzYWJsZXMubGVuZ3RoIC0gMV07XG4gIGlmICghbW9kYWwuY29udGFpbnMoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgKGUuc2hpZnRLZXkgPyBsYXN0IDogZmlyc3QpLmZvY3VzKCk7XG4gIH0gZWxzZSBpZiAoIWUuc2hpZnRLZXkgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gbGFzdCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBmaXJzdC5mb2N1cygpO1xuICB9IGVsc2UgaWYgKGUuc2hpZnRLZXkgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gZmlyc3QpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgbGFzdC5mb2N1cygpO1xuICB9XG59KTtcblxuLy8g4pSA4pSAIG1lbnUga2V5Ym9hcmQgcGF0dGVybiAoaGFtYnVyZ2VyICsga2ViYWIpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gX21lbnVGb2N1c2FibGVJdGVtcyhtZW51KSB7XG4gIHJldHVybiBbLi4ubWVudS5xdWVyeVNlbGVjdG9yQWxsKCcuaGFtYnVyZ2VyLWl0ZW0nKV1cbiAgICAuZmlsdGVyKGVsID0+ICFlbC5kaXNhYmxlZCAmJiBlbC5nZXRDbGllbnRSZWN0cygpLmxlbmd0aCA+IDApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gX21lbnVBcnJvd0tleWRvd24obWVudSwgZSkge1xuICBpZiAoZS5rZXkgIT09ICdBcnJvd0Rvd24nICYmIGUua2V5ICE9PSAnQXJyb3dVcCcpIHJldHVybjtcbiAgY29uc3QgaXRlbXMgPSBfbWVudUZvY3VzYWJsZUl0ZW1zKG1lbnUpO1xuICBpZiAoIWl0ZW1zLmxlbmd0aCkgcmV0dXJuO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIGNvbnN0IGlkeCAgPSBpdGVtcy5pbmRleE9mKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpO1xuICBjb25zdCBzdGVwID0gZS5rZXkgPT09ICdBcnJvd0Rvd24nID8gMSA6IC0xO1xuICBpdGVtc1soaWR4ICsgc3RlcCArIGl0ZW1zLmxlbmd0aCkgJSBpdGVtcy5sZW5ndGhdLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBoYW1idXJnZXIgbWVudSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmV4cG9ydCBmdW5jdGlvbiBpc0hhbWJ1cmdlck9wZW4oKSB7XG4gIHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKS5jbGFzc0xpc3QuY29udGFpbnMoJ29wZW4nKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiB0b2dnbGVIYW1idXJnZXIoKSB7XG4gIGNvbnN0IG1lbnUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKTtcbiAgbWVudS5jbGFzc0xpc3QudG9nZ2xlKCdvcGVuJyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4taGFtYnVyZ2VyJykuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgbWVudS5jbGFzc0xpc3QuY29udGFpbnMoJ29wZW4nKSk7XG4gIGlmIChtZW51LmNsYXNzTGlzdC5jb250YWlucygnb3BlbicpKSBfbWVudUZvY3VzYWJsZUl0ZW1zKG1lbnUpWzBdPy5mb2N1cygpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlSGFtYnVyZ2VyKHJlZm9jdXNUcmlnZ2VyID0gZmFsc2UpIHtcbiAgY29uc3QgbWVudSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpO1xuICAvLyBGb2N1cyBzaXR0aW5nIG9uIGFuIGl0ZW0gYWJvdXQgdG8gYmUgZGlzcGxheTpub25lJ2Qgd291bGQgc2lsZW50bHkgZmFsbCB0b1xuICAvLyA8Ym9keT47IGhhbmQgaXQgdG8gdGhlIHRyaWdnZXIgZmlyc3Qgc28gaXQgaGFzIHNvbWV3aGVyZSByZWFsIHRvIGdvLlxuICBpZiAocmVmb2N1c1RyaWdnZXIgfHwgbWVudS5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSkge1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4taGFtYnVyZ2VyJykuZm9jdXMoKTtcbiAgfVxuICBtZW51LmNsYXNzTGlzdC5yZW1vdmUoJ29wZW4nKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1oYW1idXJnZXInKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcbn1cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcbiAgX21lbnVBcnJvd0tleWRvd24oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51JyksIGUpO1xufSk7XG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xuICBpZiAoIWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItd3JhcCcpLmNvbnRhaW5zKGUudGFyZ2V0KSkge1xuICAgIGNsb3NlSGFtYnVyZ2VyKCk7XG4gIH1cbn0pO1xuXG4vLyDilIDilIAgY29udHJvbHMgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2NvbnRyb2xzT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBvcGVuQ29udHJvbHNNb2RhbCgpIHtcbiAgX2NvbnRyb2xzT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRyb2xzLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjb250cm9scy1tb2RhbCAuYnRuJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUNvbnRyb2xzTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250cm9scy1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2NvbnRyb2xzT3BlbmVyO1xuICBfY29udHJvbHNPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBkaWZmIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gX2RpZmZTdGF0ZToge3RpdGxlLCBmaWVsZHM6W3tsYWJlbCxjdXJyZW50LHByb3Bvc2VkfV0sIG9uQ29tbWl0KGFjdGlvbiwgZWRpdGVkVmFsdWVzKX1cbmxldCBfZGlmZlN0YXRlID0gbnVsbDtcbmxldCBfZGlmZk9wZW5lciA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBvcGVuRGlmZk1vZGFsKHRpdGxlLCBmaWVsZHMsIG9uQ29tbWl0LCBvcHRzID0ge30pIHtcbiAgX2RpZmZPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBfZGlmZlN0YXRlID0ge3RpdGxlLCBmaWVsZHMsIG9uQ29tbWl0fTtcbiAgY29uc3QgcmV2ZXJ0ID0gb3B0cy5yZXZlcnRNb2RlIHx8IGZhbHNlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWZpZWxkcycpO1xuICBjb250YWluZXIuaW5uZXJIVE1MID0gZmllbGRzLm1hcCgoZiwgaSkgPT4gYFxuICAgIDxkaXYgY2xhc3M9XCJkaWZmLWZpZWxkLWdyb3VwXCI+XG4gICAgICAke2ZpZWxkcy5sZW5ndGggPiAxID8gYDxkaXYgY2xhc3M9XCJkaWZmLWZpZWxkLXRpdGxlXCI+JHtlc2NIdG1sKGYubGFiZWwpfTwvZGl2PmAgOiAnJ31cbiAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsc1wiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1wYW5lbFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsLWxhYmVsXCI+JHtyZXZlcnQgPyAnWW91ciBFZGl0JyA6ICdDdXJyZW50J308L2Rpdj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1jdXJyZW50JHtmLmN1cnJlbnQgPyAnJyA6ICcgZW1wdHknfVwiPiR7XG4gICAgICAgICAgICBmLmN1cnJlbnQgPyBlc2NIdG1sKGYuY3VycmVudCkgOiAnKG5vbmUgeWV0KSdcbiAgICAgICAgICB9PC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1wYW5lbFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsLWxhYmVsXCI+JHtyZXZlcnQgPyAnT3JpZ2luYWwgKExMTSknIDogJ05ldyAtIGVkaXQgaGVyZSwgdGhlbiBjaG9vc2UgYmVsb3cnfTwvZGl2PlxuICAgICAgICAgICR7cmV2ZXJ0XG4gICAgICAgICAgICA/IGA8ZGl2IGNsYXNzPVwiZGlmZi1jdXJyZW50JHtmLnByb3Bvc2VkID8gJycgOiAnIGVtcHR5J31cIj4ke2YucHJvcG9zZWQgPyBlc2NIdG1sKGYucHJvcG9zZWQpIDogJyhub25lKSd9PC9kaXY+YFxuICAgICAgICAgICAgOiBgPHRleHRhcmVhIGNsYXNzPVwiZGlmZi1uZXdcIiBpZD1cImRpZmYtbmV3LSR7aX1cIiByb3dzPVwiNFwiPiR7ZXNjSHRtbChmLnByb3Bvc2VkIHx8ICcnKX08L3RleHRhcmVhPmBcbiAgICAgICAgICB9XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YCkuam9pbignJyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWRpc2NhcmQtYnRuJykudGV4dENvbnRlbnQgICA9IHJldmVydCA/ICdLZWVwIE15IEVkaXQnIDogJ0Rpc2NhcmQnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1hY2NlcHQtZWRpdC1idG4nKS5zdHlsZS5kaXNwbGF5ID0gcmV2ZXJ0ID8gJ25vbmUnIDogJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1uZXctYnRuJykudGV4dENvbnRlbnQgPSByZXZlcnQgPyAnUmV2ZXJ0IHRvIE9yaWdpbmFsJyA6ICdBY2NlcHQgYXMtaXMnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgY29uc3QgZmlyc3RUYSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW5ldy0wJyk7XG4gICAgaWYgKGZpcnN0VGEpIGZpcnN0VGEuZm9jdXMoKTtcbiAgICBlbHNlIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWRpc2NhcmQtYnRuJyk/LmZvY3VzKCk7XG4gIH0sIDUwKTtcbn1cblxuZnVuY3Rpb24gX2RpZmZHZXRFZGl0ZWQoKSB7XG4gIHJldHVybiAoX2RpZmZTdGF0ZT8uZmllbGRzIHx8IFtdKS5tYXAoKF8sIGkpID0+IHtcbiAgICBjb25zdCB0YSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBkaWZmLW5ldy0ke2l9YCk7XG4gICAgcmV0dXJuIHRhID8gdGEudmFsdWUgOiAnJztcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIF9kaWZmQ2xvc2VEb25lKCkge1xuICBjb25zdCBvcGVuZXIgPSBfZGlmZk9wZW5lcjtcbiAgX2RpZmZPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbmZ1bmN0aW9uIF9kaWZmQWNjZXB0TmV3KCkge1xuICBjb25zdCBlZGl0ZWQgPSBfZGlmZkdldEVkaXRlZCgpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3QgY2IgPSBfZGlmZlN0YXRlPy5vbkNvbW1pdDtcbiAgX2RpZmZTdGF0ZSA9IG51bGw7XG4gIF9kaWZmT3BlbmVyID0gbnVsbDtcbiAgaWYgKGNiKSBjYignYWNjZXB0X25ldycsIGVkaXRlZCk7XG59XG5cbmZ1bmN0aW9uIF9kaWZmQWNjZXB0RWRpdCgpIHtcbiAgY29uc3QgZWRpdGVkID0gX2RpZmZHZXRFZGl0ZWQoKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IGNiID0gX2RpZmZTdGF0ZT8ub25Db21taXQ7XG4gIF9kaWZmU3RhdGUgPSBudWxsO1xuICBfZGlmZk9wZW5lciA9IG51bGw7XG4gIGlmIChjYikgY2IoJ2FjY2VwdF9lZGl0JywgZWRpdGVkKTtcbn1cblxuZnVuY3Rpb24gX2RpZmZEaXJ0eSgpIHtcbiAgcmV0dXJuIChfZGlmZlN0YXRlPy5maWVsZHMgfHwgW10pLnNvbWUoKGYsIGkpID0+IHtcbiAgICBjb25zdCB0YSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBkaWZmLW5ldy0ke2l9YCk7XG4gICAgcmV0dXJuIHRhICYmIHRhLnZhbHVlICE9PSAoZi5wcm9wb3NlZCB8fCAnJyk7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gX2RpZmZEaXNjYXJkKCkge1xuICBpZiAoIWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykpIHJldHVybjtcbiAgaWYgKF9kaWZmRGlydHkoKSkge1xuICAgIHNob3dDb25maXJtKFxuICAgICAgJ0Rpc2NhcmQgZWRpdD8nLFxuICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgY2hhbmdlcy4gQ2xvc2Ugd2l0aG91dCBzYXZpbmc/JyxcbiAgICAgICdEaXNjYXJkJyxcbiAgICAgIF9kb0RpZmZEaXNjYXJkLFxuICAgICAgdHJ1ZSxcbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuICBfZG9EaWZmRGlzY2FyZCgpO1xufVxuXG5mdW5jdGlvbiBfZG9EaWZmRGlzY2FyZCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIF9kaWZmU3RhdGUgPSBudWxsO1xuICBfZGlmZkNsb3NlRG9uZSgpO1xufVxuXG4vLyDilIDilIAgZmllbGQgZWRpdCBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfZmllbGRFZGl0Q2FsbGJhY2sgPSBudWxsO1xubGV0IF9maWVsZEVkaXRPcmlnaW5hbFZhbHVlID0gJyc7XG5sZXQgX2ZpZWxkRWRpdE9wZW5lciA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBvcGVuRmllbGRFZGl0TW9kYWwodGl0bGUsIGN1cnJlbnRWYWx1ZSwgb25TYXZlKSB7XG4gIF9maWVsZEVkaXRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBfZmllbGRFZGl0T3JpZ2luYWxWYWx1ZSA9IGN1cnJlbnRWYWx1ZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGl0bGUnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykudmFsdWUgPSBjdXJyZW50VmFsdWU7XG4gIF9maWVsZEVkaXRDYWxsYmFjayA9IG9uU2F2ZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLmZvY3VzKCksIDUwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlRmllbGRFZGl0TW9kYWwoKSB7XG4gIGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtbW9kYWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgcmV0dXJuO1xuICBjb25zdCBjdXJyZW50VmFsdWUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykudmFsdWU7XG4gIGlmIChjdXJyZW50VmFsdWUgIT09IF9maWVsZEVkaXRPcmlnaW5hbFZhbHVlKSB7XG4gICAgc2hvd0NvbmZpcm0oXG4gICAgICAnRGlzY2FyZCBlZGl0PycsXG4gICAgICAnWW91IGhhdmUgdW5zYXZlZCBjaGFuZ2VzLiBDbG9zZSB3aXRob3V0IHNhdmluZz8nLFxuICAgICAgJ0Rpc2NhcmQnLFxuICAgICAgX2RvQ2xvc2VGaWVsZEVkaXRNb2RhbCxcbiAgICAgIHRydWUsXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgX2RvQ2xvc2VGaWVsZEVkaXRNb2RhbCgpO1xufVxuXG5mdW5jdGlvbiBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgX2ZpZWxkRWRpdENhbGxiYWNrID0gbnVsbDtcbiAgY29uc3Qgb3BlbmVyID0gX2ZpZWxkRWRpdE9wZW5lcjtcbiAgX2ZpZWxkRWRpdE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuZnVuY3Rpb24gX2ZpZWxkRWRpdFNhdmUoKSB7XG4gIGNvbnN0IHZhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZTtcbiAgY29uc3QgY2IgPSBfZmllbGRFZGl0Q2FsbGJhY2s7XG4gIF9kb0Nsb3NlRmllbGRFZGl0TW9kYWwoKTtcbiAgaWYgKGNiKSBjYih2YWwpO1xufVxuXG4vLyBSZWZyZXNoL2Nsb3NlIHdpdGggYSBkaXJ0eSBlZGl0b3Igb3BlbiB3b3VsZCBzaWxlbnRseSBsb3NlIHRoZSBlZGl0IC0gdGhlXG4vLyBzYW1lIHByb3RlY3Rpb24gY2xvc2VGaWVsZEVkaXRNb2RhbC9fZGlmZkRpc2NhcmQgZ2l2ZSBFc2NhcGUgYW5kIERpc2NhcmQuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgZSA9PiB7XG4gIGNvbnN0IGZpZWxkRWRpdERpcnR5ID1cbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1tb2RhbCcpLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpICYmXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLnZhbHVlICE9PSBfZmllbGRFZGl0T3JpZ2luYWxWYWx1ZTtcbiAgY29uc3QgZGlmZkRpcnR5ID1cbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpICYmIF9kaWZmRGlydHkoKTtcbiAgaWYgKGZpZWxkRWRpdERpcnR5IHx8IGRpZmZEaXJ0eSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnJldHVyblZhbHVlID0gJyc7XG4gIH1cbn0pO1xuXG4vLyDilIDilIAga2ViYWIgbWVudXMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2FjdGl2ZUtlYmFiID0gbnVsbDtcbmxldCBfYWN0aXZlS2ViYWJBbmNob3IgPSBudWxsO1xubGV0IF9rZWJhYkRpc21pc3MgPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gY2xvc2VLZWJhYihyZWZvY3VzQW5jaG9yID0gZmFsc2UpIHtcbiAgaWYgKCFfYWN0aXZlS2ViYWIpIHJldHVybiBmYWxzZTtcbiAgX2FjdGl2ZUtlYmFiLnJlbW92ZSgpO1xuICBfYWN0aXZlS2ViYWIgPSBudWxsO1xuICBpZiAoX2tlYmFiRGlzbWlzcykgeyBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycsIF9rZWJhYkRpc21pc3MpOyBfa2ViYWJEaXNtaXNzID0gbnVsbDsgfVxuICBjb25zdCBhbmNob3IgPSBfYWN0aXZlS2ViYWJBbmNob3I7XG4gIF9hY3RpdmVLZWJhYkFuY2hvciA9IG51bGw7XG4gIGlmIChhbmNob3I/Lmhhc0F0dHJpYnV0ZT8uKCdhcmlhLWhhc3BvcHVwJykpIGFuY2hvci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcbiAgaWYgKHJlZm9jdXNBbmNob3IgJiYgYW5jaG9yPy5mb2N1cykgYW5jaG9yLmZvY3VzKCk7XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvd0tlYmFiKGFuY2hvckVsLCBpdGVtcykge1xuICBjbG9zZUtlYmFiKCk7XG4gIGNvbnN0IG1lbnUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgbWVudS5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLW1lbnUgb3Blbic7XG4gIC8vIHJpZ2h0OmF1dG8gY2xlYXJzIHRoZSAuaGFtYnVyZ2VyLW1lbnUgYmFzZSBydWxlJ3MgcmlnaHQ6MCAtIG90aGVyd2lzZSB0aGVcbiAgLy8gZml4ZWQgbWVudSwgd2l0aCBib3RoIGxlZnQgYW5kIHJpZ2h0IHNldCwgc3RyZXRjaGVzIHRvIHRoZSB2aWV3cG9ydCBlZGdlLlxuICBtZW51LnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246Zml4ZWQ7ei1pbmRleDo1MDA7bWluLXdpZHRoOjE2MHB4O3JpZ2h0OmF1dG8nO1xuICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICBpZiAoaXRlbSA9PT0gbnVsbCkge1xuICAgICAgY29uc3Qgc2VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBzZXAuY2xhc3NOYW1lID0gJ2hhbWJ1cmdlci1kaXZpZGVyJztcbiAgICAgIG1lbnUuYXBwZW5kQ2hpbGQoc2VwKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBidG4uY2xhc3NOYW1lID0gJ2hhbWJ1cmdlci1pdGVtJztcbiAgICBidG4udGV4dENvbnRlbnQgPSBpdGVtLmxhYmVsO1xuICAgIGlmIChpdGVtLmRpc2FibGVkKSBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgIC8vIFJlZm9jdXMgdGhlIGFuY2hvciBiZWZvcmUgdGhlIGFjdGlvbiBydW5zIHNvIGFueXRoaW5nIHRoZSBhY3Rpb24gb3BlbnNcbiAgICAvLyByZWNvcmRzIHRoZSBhbmNob3IgLSBub3QgYSByZW1vdmVkIG1lbnUgaXRlbSAtIGFzIGl0cyByZXR1cm4tZm9jdXMgdGFyZ2V0LlxuICAgIGJ0bi5vbmNsaWNrID0gKCkgPT4geyBjbG9zZUtlYmFiKHRydWUpOyBpdGVtLmFjdGlvbigpOyB9O1xuICAgIG1lbnUuYXBwZW5kQ2hpbGQoYnRuKTtcbiAgfVxuICBtZW51LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IF9tZW51QXJyb3dLZXlkb3duKG1lbnUsIGUpKTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChtZW51KTtcbiAgX2FjdGl2ZUtlYmFiID0gbWVudTtcbiAgX2FjdGl2ZUtlYmFiQW5jaG9yID0gYW5jaG9yRWw7XG4gIGlmIChhbmNob3JFbD8uaGFzQXR0cmlidXRlPy4oJ2FyaWEtaGFzcG9wdXAnKSkgYW5jaG9yRWwuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcblxuICBjb25zdCByZWN0ID0gYW5jaG9yRWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gIGxldCB0b3AgID0gcmVjdC5ib3R0b20gKyA0O1xuICBsZXQgbGVmdCA9IHJlY3QucmlnaHQgLSBtZW51Lm9mZnNldFdpZHRoO1xuICBpZiAobGVmdCA8IDQpIGxlZnQgPSByZWN0LmxlZnQ7XG4gIGNvbnN0IG1lbnVIID0gbWVudS5vZmZzZXRIZWlnaHQ7XG4gIGlmICh0b3AgKyBtZW51SCA+IHdpbmRvdy5pbm5lckhlaWdodCkgdG9wID0gcmVjdC50b3AgLSBtZW51SDtcbiAgbWVudS5zdHlsZS50b3AgID0gdG9wICArICdweCc7XG4gIG1lbnUuc3R5bGUubGVmdCA9IGxlZnQgKyAncHgnO1xuXG4gIF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSlbMF0/LmZvY3VzKCk7XG5cbiAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKF9hY3RpdmVLZWJhYiAhPT0gbWVudSkgcmV0dXJuOyAgLy8gYWxyZWFkeSBjbG9zZWQgKGUuZy4gaW1tZWRpYXRlIEVzY2FwZSlcbiAgICBjb25zdCBkaXNtaXNzID0gZSA9PiB7XG4gICAgICBpZiAobWVudS5jb250YWlucyhlLnRhcmdldCkpIHJldHVybjtcbiAgICAgIGNsb3NlS2ViYWIoKTtcbiAgICB9O1xuICAgIF9rZWJhYkRpc21pc3MgPSBkaXNtaXNzO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZGlzbWlzcyk7XG4gIH0sIDApO1xufVxuXG4vLyDilIDilIAgcGFuZSByZXNpemUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5jb25zdCBfUEFORV9LRVkgPSAneXV1Y2xpcC1wYW5lLXNpemVzJztcblxuZnVuY3Rpb24gX2xvYWRQYW5lU2l6ZXMoKSB7XG4gIHRyeSB7IHJldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKF9QQU5FX0tFWSkgfHwgJ3t9Jyk7IH0gY2F0Y2ggeyByZXR1cm4ge307IH1cbn1cblxuZnVuY3Rpb24gX3NhdmVQYW5lU2l6ZShrZXksIHZhbCkge1xuICBjb25zdCBzID0gX2xvYWRQYW5lU2l6ZXMoKTtcbiAgc1trZXldID0gdmFsO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShfUEFORV9LRVksIEpTT04uc3RyaW5naWZ5KHMpKTtcbn1cblxuZnVuY3Rpb24gX21ha2VEcmFnSGFuZGxlKGlkLCBvblN0YXJ0KSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGUgPT4ge1xuICAgIGlmIChlLmJ1dHRvbiAhPT0gMCkgcmV0dXJuO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlbC5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xuICAgIGNvbnN0IG9uTW92ZSA9IG9uU3RhcnQoZSk7XG4gICAgY29uc3Qgb25VcCA9ICgpID0+IHtcbiAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnaW5nJyk7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdmUpO1xuICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uVXApO1xuICAgIH07XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlKTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25VcCk7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdFJlc2l6ZSgpIHtcbiAgY29uc3Qgcm9vdCAgICA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcbiAgY29uc3Qgc2l6ZXMgICA9IF9sb2FkUGFuZVNpemVzKCk7XG5cbiAgaWYgKHNpemVzLnNpZGViYXJXaWR0aCkgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLXNpZGViYXItd2lkdGgnLCAgICAgICBzaXplcy5zaWRlYmFyV2lkdGggKyAncHgnKTtcbiAgaWYgKHNpemVzLnZpZGVvc0hlaWdodCkgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLXZpZGVvcy1ncm91cC1oZWlnaHQnLCBzaXplcy52aWRlb3NIZWlnaHQgKyAncHgnKTtcbiAgaWYgKHNpemVzLnBsYXllck1heEgpICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLXBsYXllci1tYXgtaGVpZ2h0JywgICBzaXplcy5wbGF5ZXJNYXhIICsgJ3B4Jyk7XG4gIGlmIChzaXplcy5sb2dNYXhIKSAgICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1sb2ctbWF4LWhlaWdodCcsICAgICAgIHNpemVzLmxvZ01heEggKyAncHgnKTtcblxuICBfbWFrZURyYWdIYW5kbGUoJ3NpZGViYXItcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRYICA9IHN0YXJ0RS5jbGllbnRYO1xuICAgIGNvbnN0IHNpZGViYXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2lkZWJhcicpO1xuICAgIGNvbnN0IHN0YXJ0VyAgPSBzaWRlYmFyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLndpZHRoO1xuICAgIHJldHVybiBtb3ZlRSA9PiB7XG4gICAgICBjb25zdCB3ID0gTWF0aC5tYXgoMTYwLCBNYXRoLm1pbig0ODAsIHN0YXJ0VyArIG1vdmVFLmNsaWVudFggLSBzdGFydFgpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tc2lkZWJhci13aWR0aCcsIHcgKyAncHgnKTtcbiAgICAgIF9zYXZlUGFuZVNpemUoJ3NpZGViYXJXaWR0aCcsIHcpO1xuICAgIH07XG4gIH0pO1xuXG4gIF9tYWtlRHJhZ0hhbmRsZSgndmlkZW9zLWNsaXBzLXJlc2l6ZS1oYW5kbGUnLCBzdGFydEUgPT4ge1xuICAgIGNvbnN0IHN0YXJ0WSAgPSBzdGFydEUuY2xpZW50WTtcbiAgICBjb25zdCB2ZyAgICAgID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNpZGViYXItZ3JvdXAudmlkZW9zLWdyb3VwJyk7XG4gICAgY29uc3Qgc2lkZWJhciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaWRlYmFyJyk7XG4gICAgY29uc3Qgc3RhcnRIICA9IHZnLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcbiAgICByZXR1cm4gbW92ZUUgPT4ge1xuICAgICAgY29uc3QgbWF4SCA9IHNpZGViYXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0IC0gMTIwO1xuICAgICAgY29uc3QgaCA9IE1hdGgubWF4KDQwLCBNYXRoLm1pbihtYXhILCBzdGFydEggKyBtb3ZlRS5jbGllbnRZIC0gc3RhcnRZKSk7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLXZpZGVvcy1ncm91cC1oZWlnaHQnLCBoICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCd2aWRlb3NIZWlnaHQnLCBoKTtcbiAgICB9O1xuICB9KTtcblxuICBfbWFrZURyYWdIYW5kbGUoJ3BsYXllci1yZXNpemUtaGFuZGxlJywgc3RhcnRFID0+IHtcbiAgICBjb25zdCBzdGFydFkgPSBzdGFydEUuY2xpZW50WTtcbiAgICBjb25zdCBwYSAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyLWFyZWEnKTtcbiAgICBjb25zdCBtYWluICAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubWFpbicpO1xuICAgIGNvbnN0IHN0YXJ0SCA9IHBhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcbiAgICByZXR1cm4gbW92ZUUgPT4ge1xuICAgICAgY29uc3QgbWF4SCA9IG1haW4uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0IC0gMTAwO1xuICAgICAgY29uc3QgaCA9IE1hdGgubWF4KDgwLCBNYXRoLm1pbihtYXhILCBzdGFydEggKyBtb3ZlRS5jbGllbnRZIC0gc3RhcnRZKSk7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLXBsYXllci1tYXgtaGVpZ2h0JywgaCArICdweCcpO1xuICAgICAgX3NhdmVQYW5lU2l6ZSgncGxheWVyTWF4SCcsIGgpO1xuICAgIH07XG4gIH0pO1xuXG4gIF9tYWtlRHJhZ0hhbmRsZSgnbG9nLXJlc2l6ZS1oYW5kbGUnLCBzdGFydEUgPT4ge1xuICAgIGNvbnN0IHN0YXJ0WSA9IHN0YXJ0RS5jbGllbnRZO1xuICAgIGNvbnN0IGxiICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctYm9keScpO1xuICAgIGNvbnN0IHN0YXJ0SCA9IGxiLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCB8fCAwO1xuICAgIHJldHVybiBtb3ZlRSA9PiB7XG4gICAgICBjb25zdCBoID0gTWF0aC5tYXgoNDAsIE1hdGgubWluKDYwMCwgc3RhcnRIIC0gKG1vdmVFLmNsaWVudFkgLSBzdGFydFkpKSk7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWxvZy1tYXgtaGVpZ2h0JywgaCArICdweCcpO1xuICAgICAgX3NhdmVQYW5lU2l6ZSgnbG9nTWF4SCcsIGgpO1xuICAgIH07XG4gIH0pO1xufVxuXG4vLyDilIDilIAgcHJlcmVxIHdhcm5pbmdzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZXhwb3J0IGZ1bmN0aW9uIF9hcHBseVByZXJlcVdhcm5pbmdzKHByZXJlcXMpIHtcbiAgY29uc3QgaW5FbGVjdHJvbiA9ICEhd2luZG93LmVsZWN0cm9uQVBJO1xuICBjb25zdCB3aXphcmRMaW5rID0gaW5FbGVjdHJvblxuICAgID8gJyA8YSBocmVmPVwiI1wiIG9uY2xpY2s9XCJ3aW5kb3cuZWxlY3Ryb25BUEkucnVuU2V0dXBXaXphcmQoKTtyZXR1cm4gZmFsc2VcIiBzdHlsZT1cImNvbG9yOnZhcigtLXdhcm5pbmcpXCI+UmUtcnVuIFNldHVwIFdpemFyZDwvYT4nXG4gICAgOiAnJztcblxuICBjb25zdCBiYW5uZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJlcmVxLWJhbm5lcicpO1xuICBpZiAoIWJhbm5lcikgcmV0dXJuO1xuXG4gIGlmICghcHJlcmVxcy5mZm1wZWdfb2spIHtcbiAgICBiYW5uZXIuaW5uZXJIVE1MID0gYDxzcGFuPuKaoCBGRm1wZWcgbm90IGZvdW5kIC0gYW5hbHlzaXMgYW5kIGV4cG9ydCB3aWxsIGZhaWwuJHt3aXphcmRMaW5rfTwvc3Bhbj5gO1xuICAgIGJhbm5lci5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1zdGFydC1hbmFseXplJyk7XG4gICAgaWYgKGJ0bikge1xuICAgICAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAgIGJ0bi50aXRsZSA9ICdGRm1wZWcgbm90IGZvdW5kIC0gUmUtcnVuIFNldHVwIFdpemFyZCB0byBpbnN0YWxsIGl0JztcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghcHJlcmVxcy5sbG1fb2sgJiYgaW5FbGVjdHJvbikge1xuICAgIGJhbm5lci5pbm5lckhUTUwgPSBgPHNwYW4+4oS5IExMTSBzY29yaW5nIGlzIG5vdCBjb25maWd1cmVkIC0gY2xpcHMgd2lsbCBiZSBzY29yZWQgYnkgZW5lcmd5IGFuZCBzY2VuZXMgb25seS4ke3dpemFyZExpbmt9PC9zcGFuPmA7XG4gICAgYmFubmVyLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gUHJlcmVxdWlzaXRlcyBzYXRpc2ZpZWQgLSBjbGVhciBhbnkgYmFubmVyIHNob3duIGJ5IGFuIGVhcmxpZXIgc3RhdGUuIFdpdGhvdXRcbiAgLy8gdGhpcywgYSByZS1jaGVjayBhZnRlciB0aGUgbW9kZWwgaXMgc2V0IHVwIChyZWZyZXNoU2VydmVyU3RhdGUpIGNvdWxkIG5ldmVyXG4gIC8vIGhpZGUgYSBzdGFsZSB3YXJuaW5nLlxuICBiYW5uZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgYmFubmVyLmlubmVySFRNTCA9ICcnO1xufVxuXG4vLyDilIDilIAgdW5kbyB0b2FzdCAoYXV0by1kaXNtaXNzLCBzaW5nbGUgVW5kbyBidXR0b24pIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQSB0cmFuc2llbnQgdG9hc3QgY2FycnlpbmcgYW4gVW5kbyBhY3Rpb24sIHVzZWQgYnkgcmV2ZXJzaWJsZSBjbGlwIG9wZXJhdGlvbnNcbi8vIChzaW5nbGUvYnVsayBzdGF0dXMgY2hhbmdlcykuIFRoZSBzaHJpbmtpbmcgYmFyIG1ha2VzIHRoZSB+NXMgd2luZG93IHZpc2libGVcbi8vIHNvIHRoZSB1bmRvIGFmZm9yZGFuY2UgZG9lcyBub3QgZXhwaXJlIHNpbGVudGx5LiBHZW5lcmljIFVJLCBzbyBpdCBsaXZlcyBoZXJlXG4vLyByYXRoZXIgdGhhbiBpbiBhIGZlYXR1cmUgbW9kdWxlLlxuY29uc3QgVU5ET19UT0FTVF9NUyA9IDUwMDA7XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93VW5kb1RvYXN0KG1lc3NhZ2UsIHVuZG9Gbikge1xuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9hc3QtY29udGFpbmVyJyk7XG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvYXN0LmNsYXNzTmFtZSA9ICd0b2FzdCBpbmZvIHVuZG8tdG9hc3QnO1xuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgcm93LmNsYXNzTmFtZSA9ICd1bmRvLXRvYXN0LXJvdyc7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICBidG4uY2xhc3NOYW1lID0gJ3VuZG8tdG9hc3QtYnRuJztcbiAgYnRuLnRleHRDb250ZW50ID0gJ1VuZG8nO1xuICBidG4ub25jbGljayA9ICgpID0+IHsgdG9hc3QucmVtb3ZlKCk7IHVuZG9GbigpOyB9O1xuICByb3cuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobWVzc2FnZSkpO1xuICByb3cuYXBwZW5kQ2hpbGQoYnRuKTtcbiAgY29uc3QgYmFyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGJhci5jbGFzc05hbWUgPSAndW5kby10b2FzdC1iYXInO1xuICBiYXIuc3R5bGUuYW5pbWF0aW9uRHVyYXRpb24gPSBVTkRPX1RPQVNUX01TICsgJ21zJztcbiAgdG9hc3QuYXBwZW5kQ2hpbGQocm93KTtcbiAgdG9hc3QuYXBwZW5kQ2hpbGQoYmFyKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgc2V0VGltZW91dCgoKSA9PiB0b2FzdC5yZW1vdmUoKSwgVU5ET19UT0FTVF9NUyk7XG59XG5cbi8vIEdsb2JhbCBwbGF5YmFjay1zcGVlZCBwcmVmZXJlbmNlIC0gb25lIGNhcHR1cmUtcGhhc2UgbGlzdGVuZXIgYXBwbGllcyB0aGUgc2F2ZWRcbi8vIHJhdGUgdG8gZXZlcnkgPHZpZGVvPiBhcyBpdCBsb2Fkcywgc28gYWxsIHBsYXllcnMgKGNsaXAgcHJldmlldywgcmVjb3JkaW5nLFxuLy8gc3BsaXQvZXhwb3J0IGVkaXRvcnMsIHJlZWxzKSBob25vciBpdCB3aXRob3V0IHBlci1wbGF5ZXIgd2lyaW5nLiBDbGllbnQtb25seSxcbi8vIHN0b3JlZCBpbiBsb2NhbFN0b3JhZ2UgbGlrZSB0aGUgb3RoZXIgcGxheWJhY2sgcHJlZnMuXG5leHBvcnQgZnVuY3Rpb24gcGxheWJhY2tSYXRlUHJlZigpIHtcbiAgY29uc3QgcmF0ZSA9IHBhcnNlRmxvYXQobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3l1dWNsaXAtcGxheWJhY2stcmF0ZScpKTtcbiAgcmV0dXJuIE51bWJlci5pc0Zpbml0ZShyYXRlKSAmJiByYXRlID4gMCA/IHJhdGUgOiAxO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwbHlQbGF5YmFja1JhdGUocmF0ZSkge1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd2aWRlbycpLmZvckVhY2godmlkZW8gPT4geyB2aWRlby5wbGF5YmFja1JhdGUgPSByYXRlOyB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRQbGF5YmFja1JhdGUoKSB7XG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgZSA9PiB7XG4gICAgaWYgKGUudGFyZ2V0ICYmIGUudGFyZ2V0LnRhZ05hbWUgPT09ICdWSURFTycpIGUudGFyZ2V0LnBsYXliYWNrUmF0ZSA9IHBsYXliYWNrUmF0ZVByZWYoKTtcbiAgfSwgdHJ1ZSk7XG59XG5cbi8vIOKUgOKUgCBzdGF0aWMgbW9kYWwvaGFtYnVyZ2VyIHdpcmluZyAocmVwbGFjZXMgdGhlIGlubGluZSBvbmNsaWNrPSB0aGlzIG1vZHVsZSB1c2VkXG4vLyB0byBvd24gaW4gaW5kZXguaHRtbCkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUaGVzZSBhcmUgZml4ZWQsIG5ldmVyLXJlY3JlYXRlZCBlbGVtZW50cyBpbiBpbmRleC5odG1sLCBzbyB3aXJpbmcgdGhlbSBvbmNlIGF0XG4vLyBtb2R1bGUgbG9hZCAoYmVsb3cpIGNhbid0IGRvdWJsZS1maXJlIG9uIGEgcmUtcmVuZGVyIHRoZSB3YXkgYSBkeW5hbWljYWxseVxuLy8gcmVuZGVyZWQgbGlzdCBjb3VsZC5cbmNvbnN0IF9CR19ESVNNSVNTX01PREFMUyA9IFtcbiAgWydhbGVydC1tb2RhbCcsIGNsb3NlQWxlcnRNb2RhbF0sXG4gIFsnY29uZmlybS1tb2RhbCcsIF9jb25maXJtQ2FuY2VsXSxcbiAgWydhY3Rpb25zLW1vZGFsJywgY2xvc2VBY3Rpb25zTW9kYWxdLFxuICBbJ2NvbnRyb2xzLW1vZGFsJywgY2xvc2VDb250cm9sc01vZGFsXSxcbiAgWydkaWZmLW1vZGFsJywgX2RpZmZEaXNjYXJkXSxcbiAgWydmaWVsZC1lZGl0LW1vZGFsJywgY2xvc2VGaWVsZEVkaXRNb2RhbF0sXG5dO1xuXG5mdW5jdGlvbiBfd2lyZU1vZGFsQmdEaXNtaXNzYWxzKCkge1xuICBmb3IgKGNvbnN0IFttb2RhbElkLCBjbG9zZUZuXSBvZiBfQkdfRElTTUlTU19NT0RBTFMpIHtcbiAgICBjb25zdCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1vZGFsSWQpO1xuICAgIG1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7IGlmIChlLnRhcmdldCA9PT0gbW9kYWwpIGNsb3NlRm4oKTsgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gX3dpcmVNb2RhbEJ1dHRvbnMoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1vay1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlQWxlcnRNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tY2FuY2VsLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2NvbmZpcm1DYW5jZWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW9rLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2NvbmZpcm1PaygpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGlvbnMtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUFjdGlvbnNNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRyb2xzLW1vZGFsLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VDb250cm9sc01vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1kaXNjYXJkLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2RpZmZEaXNjYXJkKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1hY2NlcHQtZWRpdC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9kaWZmQWNjZXB0RWRpdCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtYWNjZXB0LW5ldy1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9kaWZmQWNjZXB0TmV3KCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1jYW5jZWwtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUZpZWxkRWRpdE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1zYXZlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2ZpZWxkRWRpdFNhdmUoKSk7XG59XG5cbi8vIFwiQ29udHJvbHNcIiBhbmQgXCJEb3dubG9hZCBMb2dcIiBhcmUgd2lyZWQgaGVyZSBiZWNhdXNlIHRoZWlyIG9uY2xpY2s9IGNhbGxlZFxuLy8gb25seSB1aS5qcyBmdW5jdGlvbnMuIFRoZSBHZXR0aW5nIFN0YXJ0ZWQgLyBHbG9zc2FyeSAvIEhlbHAgLyBBYm91dCBpdGVtcyBjYWxsXG4vLyBjbG9zZUhhbWJ1cmdlcigpICh1aS5qcykgcGx1cyBhIGhlbHBtb2RhbHMuanMgbW9kYWwtb3Blbiwgc28gaGVscG1vZGFscy5qcyBvd25zXG4vLyB0aGVpciBkZWxlZ2F0aW9uLiBcIlJlLXJ1biBTZXR1cCBXaXphcmRcIiBhbmQgXCJSZWZyZXNoXCIgKGVsZWN0cm9uQVBJIC8gbG9jYXRpb24pXG4vLyByZW1haW4gaW5saW5lIHVudGlsIHRoZWlyIG93bmluZyBjb2RlIG1pZ3JhdGVzLlxuZnVuY3Rpb24gX3dpcmVIYW1idXJnZXJIYW5kbGVycygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1oYW1idXJnZXInKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRvZ2dsZUhhbWJ1cmdlcigpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWNvbnRyb2xzJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuQ29udHJvbHNNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWRvd25sb2FkLWxvZycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VIYW1idXJnZXIoKSk7XG59XG5cbl93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKTtcbl93aXJlTW9kYWxCdXR0b25zKCk7XG5fd2lyZUhhbWJ1cmdlckhhbmRsZXJzKCk7XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSB0aGUgdGhyZWUgYXBwLWdsb2JhbCBoZWxwL2luZm8gbW9kYWxzIChHZXR0aW5nIFN0YXJ0ZWQsIEFib3V0LFxuLy8gR2xvc3NhcnkpLiBFeHRyYWN0ZWQgb3V0IG9mIHNldHRpbmdzLmpzICh3aGljaCBncmV3IGludG8gYSBjYXRjaC1hbGwpIC0gdGhlc2Vcbi8vIGhhdmUgbm8gY291cGxpbmcgdG8gdGhlIHNldHRpbmdzIHNhdmUvZGlydHkgbWFjaGluZXJ5LlxuLy8gICBBUEk6IHJvdXRlcy9jb25maWcucHkgKGdsb3NzYXJ5KSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9zZXR0aW5ncy5weSwgdGVzdHMvdWkvdGVzdF91aV9wYWdlLnB5LCB0ZXN0cy91aS90ZXN0X3VpX2tleWJvYXJkLnB5XG5cbi8vIOKUgOKUgCBnZXR0aW5nIHN0YXJ0ZWQgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2dldHRpbmdTdGFydGVkT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBvcGVuR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpIHtcbiAgX2dldHRpbmdTdGFydGVkT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dldHRpbmctc3RhcnRlZC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZ2V0dGluZy1zdGFydGVkLW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dldHRpbmctc3RhcnRlZC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3l1dS1nZXR0aW5nLXN0YXJ0ZWQtc2VlbicsICcxJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9nZXR0aW5nU3RhcnRlZE9wZW5lcjtcbiAgX2dldHRpbmdTdGFydGVkT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgYWJvdXQgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2Fib3V0T3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBvcGVuQWJvdXRNb2RhbCgpIHtcbiAgX2Fib3V0T3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fib3V0LW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNhYm91dC1tb2RhbCAuYnRuJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUFib3V0TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhYm91dC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2Fib3V0T3BlbmVyO1xuICBfYWJvdXRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBoZWxwICYgZ3VpZGVzIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTGlua3Mgb3V0IHRvIHRoZSBHaXRIdWIgZG9jcy91c2VyLyBwYWdlcyByYXRoZXIgdGhhbiBidW5kbGluZyBjb3BpZXM6IHRoZSBhcHBcbi8vIHNoaXBzIHRoZSB3aGVlbCAod2hpY2ggY2FycmllcyBzdGF0aWMvZ2xvc3NhcnkubWQpIGJ1dCBub3QgZG9jcy91c2VyLywgYW5kIGFcbi8vIGJ1bmRsZWQgNjUwLWxpbmUgZmVhdHVyZSBndWlkZSB3b3VsZCBkcmlmdCBmcm9tIHRoZSBVSS4gSW4gdGhlIHBhY2thZ2VkIGFwcFxuLy8gdGhlc2UgdGFyZ2V0PV9ibGFuayBsaW5rcyBvcGVuIGluIHRoZSBzeXN0ZW0gYnJvd3NlciB2aWEgc2V0V2luZG93T3BlbkhhbmRsZXIuXG5sZXQgX2hlbHBPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5IZWxwTW9kYWwoKSB7XG4gIF9oZWxwT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlbHAtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2hlbHAtbW9kYWwgLmJ0bicpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VIZWxwTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWxwLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfaGVscE9wZW5lcjtcbiAgX2hlbHBPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBnbG9zc2FyeSBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfZ2xvc3NhcnlPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5HbG9zc2FyeU1vZGFsKCkge1xuICBfZ2xvc3NhcnlPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIGNvbnN0IGZpbHRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1maWx0ZXInKTtcbiAgZmlsdGVyLnZhbHVlID0gJyc7XG4gIHNldFRpbWVvdXQoKCkgPT4gZmlsdGVyLmZvY3VzKCksIDUwKTtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktY29udGVudCcpO1xuICBpZiAoZWwuZGF0YXNldC5sb2FkZWQpIHsgX2ZpbHRlckdsb3NzYXJ5KCcnKTsgcmV0dXJuOyB9XG4gIHRyeSB7XG4gICAgY29uc3QgbWQgPSBhd2FpdCBmZXRjaCgnL2FwaS9nbG9zc2FyeScpLnRoZW4ociA9PiByLnRleHQoKSk7XG4gICAgZWwuaW5uZXJIVE1MID0gX3JlbmRlckdsb3NzYXJ5TWQobWQpO1xuICAgIGVsLmRhdGFzZXQubG9hZGVkID0gJzEnO1xuICB9IGNhdGNoIChlKSB7XG4gICAgZWwuaW5uZXJIVE1MID0gJzxkaXYgc3R5bGU9XCJjb2xvcjp2YXIoLS1yZWQpXCI+RmFpbGVkIHRvIGxvYWQgZ2xvc3NhcnkuPC9kaXY+JztcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gX2ZpbHRlckdsb3NzYXJ5KHF1ZXJ5KSB7XG4gIGNvbnN0IHEgPSBxdWVyeS50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1jb250ZW50Jyk7XG4gIGxldCBhbnlWaXNpYmxlID0gZmFsc2U7XG4gIGNvbnRlbnQucXVlcnlTZWxlY3RvckFsbCgnLmdsb3NzYXJ5LXRlcm0nKS5mb3JFYWNoKHRlcm0gPT4ge1xuICAgIGNvbnN0IHNob3cgPSAhcSB8fCB0ZXJtLnRleHRDb250ZW50LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSk7XG4gICAgdGVybS5zdHlsZS5kaXNwbGF5ID0gc2hvdyA/ICcnIDogJ25vbmUnO1xuICAgIGlmIChzaG93KSBhbnlWaXNpYmxlID0gdHJ1ZTtcbiAgfSk7XG4gIGNvbnRlbnQucXVlcnlTZWxlY3RvckFsbCgnLmdsb3NzYXJ5LXNlY3Rpb24nKS5mb3JFYWNoKHNlY3Rpb24gPT4ge1xuICAgIGNvbnN0IHRlcm1zID0gQXJyYXkuZnJvbShzZWN0aW9uLnF1ZXJ5U2VsZWN0b3JBbGwoJy5nbG9zc2FyeS10ZXJtJykpO1xuICAgIGNvbnN0IHNob3cgPSAhcSB8fCB0ZXJtcy5zb21lKHQgPT4gdC5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZScpO1xuICAgIHNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IHNob3cgPyAnJyA6ICdub25lJztcbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1uby1tYXRjaGVzJykuc3R5bGUuZGlzcGxheSA9IChxICYmICFhbnlWaXNpYmxlKSA/ICcnIDogJ25vbmUnO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlR2xvc3NhcnlNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfZ2xvc3NhcnlPcGVuZXI7XG4gIF9nbG9zc2FyeU9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuZnVuY3Rpb24gX3JlbmRlckdsb3NzYXJ5TWQobWQpIHtcbiAgY29uc3QgbGluZXMgPSBtZC5zcGxpdCgnXFxuJyk7XG4gIGxldCBodG1sID0gJyc7XG4gIGxldCBpbkxpc3QgPSBmYWxzZTtcbiAgbGV0IGluVGFibGUgPSBmYWxzZTtcbiAgbGV0IHRhYmxlSGVhZCA9IGZhbHNlO1xuICBsZXQgaW5TZWN0aW9uID0gZmFsc2U7XG4gIGxldCBpblRlcm0gPSBmYWxzZTtcblxuICBjb25zdCBpbmxpbmUgPSBzID0+IHNcbiAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpXG4gICAgLnJlcGxhY2UoL2AoW15gXSspYC9nLCAnPGNvZGU+JDE8L2NvZGU+JylcbiAgICAucmVwbGFjZSgvXFwqXFwqKFteKl0rKVxcKlxcKi9nLCAnPHN0cm9uZz4kMTwvc3Ryb25nPicpXG4gICAgLnJlcGxhY2UoL1xcKihbXipdKylcXCovZywgJzxlbT4kMTwvZW0+Jyk7XG5cbiAgY29uc3QgY2xvc2VMaXN0ICA9ICgpID0+IHsgaWYgKGluTGlzdCkgIHsgaHRtbCArPSAnPC91bD4nOyAgIGluTGlzdCAgPSBmYWxzZTsgfSB9O1xuICBjb25zdCBjbG9zZVRhYmxlID0gKCkgPT4geyBpZiAoaW5UYWJsZSkgeyBodG1sICs9ICc8L3Rib2R5PjwvdGFibGU+JzsgaW5UYWJsZSA9IGZhbHNlOyB0YWJsZUhlYWQgPSBmYWxzZTsgfSB9O1xuICAvLyBTZWN0aW9uICgjIykgYW5kIHRlcm0gKCMjIykgd3JhcHBlciBkaXZzIGFyZSB0aGUgdW5pdHMgdGhlIGdsb3NzYXJ5IGZpbHRlclxuICAvLyBzaG93cy9oaWRlcyAtIGV2ZXJ5ICMjIyBibG9jayBtdXN0IGxhbmQgaW5zaWRlIGV4YWN0bHkgb25lIC5nbG9zc2FyeS10ZXJtLlxuICBjb25zdCBjbG9zZVRlcm0gICAgPSAoKSA9PiB7IGlmIChpblRlcm0pICAgIHsgaHRtbCArPSAnPC9kaXY+JzsgaW5UZXJtICAgID0gZmFsc2U7IH0gfTtcbiAgY29uc3QgY2xvc2VTZWN0aW9uID0gKCkgPT4geyBjbG9zZVRlcm0oKTsgaWYgKGluU2VjdGlvbikgeyBodG1sICs9ICc8L2Rpdj4nOyBpblNlY3Rpb24gPSBmYWxzZTsgfSB9O1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCByYXcgPSBsaW5lc1tpXTtcbiAgICBjb25zdCBsaW5lID0gcmF3LnRyaW1FbmQoKTtcblxuICAgIGlmIChsaW5lLnN0YXJ0c1dpdGgoJyMjICcpKSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpOyBjbG9zZVNlY3Rpb24oKTtcbiAgICAgIGh0bWwgKz0gYDxkaXYgY2xhc3M9XCJnbG9zc2FyeS1zZWN0aW9uXCI+PGgyIHN0eWxlPVwibWFyZ2luOjIwcHggMCA0cHg7Zm9udC1zaXplOjE1cHg7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTtwYWRkaW5nLWJvdHRvbTo0cHhcIj4ke2lubGluZShsaW5lLnNsaWNlKDMpKX08L2gyPmA7XG4gICAgICBpblNlY3Rpb24gPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCcjIyMgJykpIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7IGNsb3NlVGVybSgpO1xuICAgICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cImdsb3NzYXJ5LXRlcm1cIj48aDMgc3R5bGU9XCJtYXJnaW46MTRweCAwIDJweDtmb250LXNpemU6MTNweDtjb2xvcjp2YXIoLS1hY2NlbnQpXCI+JHtpbmxpbmUobGluZS5zbGljZSg0KSl9PC9oMz5gO1xuICAgICAgaW5UZXJtID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnLS0tJykpIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7IGNsb3NlVGVybSgpO1xuICAgICAgaHRtbCArPSAnPGhyIHN0eWxlPVwiYm9yZGVyOm5vbmU7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tYm9yZGVyKTttYXJnaW46MTRweCAwXCI+JztcbiAgICB9IGVsc2UgaWYgKC9eXFx8Ly50ZXN0KGxpbmUpKSB7XG4gICAgICBjbG9zZUxpc3QoKTtcbiAgICAgIGNvbnN0IGNlbGxzID0gbGluZS5zcGxpdCgnfCcpLnNsaWNlKDEsIC0xKS5tYXAoYyA9PiBjLnRyaW0oKSk7XG4gICAgICBpZiAoL15bLVxcc3w6XSskLy50ZXN0KGxpbmUpKSB7XG4gICAgICAgIHRhYmxlSGVhZCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIGlmICghaW5UYWJsZSkge1xuICAgICAgICBpblRhYmxlID0gdHJ1ZTsgdGFibGVIZWFkID0gdHJ1ZTtcbiAgICAgICAgaHRtbCArPSAnPHRhYmxlIHN0eWxlPVwid2lkdGg6MTAwJTtib3JkZXItY29sbGFwc2U6Y29sbGFwc2U7Zm9udC1zaXplOjEycHg7bWFyZ2luOjZweCAwXCI+PHRoZWFkPjx0cj4nO1xuICAgICAgICBjZWxscy5mb3JFYWNoKGMgPT4geyBodG1sICs9IGA8dGggc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnQ7cGFkZGluZzo0cHggOHB4IDRweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Y29sb3I6dmFyKC0tdGV4dClcIj4ke2lubGluZShjKX08L3RoPmA7IH0pO1xuICAgICAgICBodG1sICs9ICc8L3RyPjwvdGhlYWQ+PHRib2R5Pic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBodG1sICs9ICc8dHI+JztcbiAgICAgICAgY2VsbHMuZm9yRWFjaChjID0+IHsgaHRtbCArPSBgPHRkIHN0eWxlPVwicGFkZGluZzozcHggOHB4IDNweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Y29sb3I6dmFyKC0tbXV0ZWQpO3ZlcnRpY2FsLWFsaWduOnRvcFwiPiR7aW5saW5lKGMpfTwvdGQ+YDsgfSk7XG4gICAgICAgIGh0bWwgKz0gJzwvdHI+JztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKC9eLSAvLnRlc3QobGluZSkpIHtcbiAgICAgIGNsb3NlVGFibGUoKTtcbiAgICAgIGlmICghaW5MaXN0KSB7IGh0bWwgKz0gJzx1bCBzdHlsZT1cIm1hcmdpbjo0cHggMCA0cHggMTZweDtwYWRkaW5nOjBcIj4nOyBpbkxpc3QgPSB0cnVlOyB9XG4gICAgICBodG1sICs9IGA8bGkgc3R5bGU9XCJtYXJnaW46MXB4IDBcIj4ke2lubGluZShsaW5lLnNsaWNlKDIpKX08L2xpPmA7XG4gICAgfSBlbHNlIGlmIChsaW5lID09PSAnJykge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTtcbiAgICAgIGh0bWwgKz0gJzxkaXYgc3R5bGU9XCJtYXJnaW46NHB4IDBcIj48L2Rpdj4nO1xuICAgIH0gZWxzZSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpO1xuICAgICAgaHRtbCArPSBgPHAgc3R5bGU9XCJtYXJnaW46M3B4IDBcIj4ke2lubGluZShsaW5lKX08L3A+YDtcbiAgICB9XG4gIH1cbiAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VTZWN0aW9uKCk7XG4gIHJldHVybiBodG1sO1xufVxuXG4vLyDilIDilIAgc3RhdGljIG1vZGFsL2hhbWJ1cmdlciB3aXJpbmcgKHJlcGxhY2VzIHRoZSBpbmxpbmUgb25jbGljaz0vb25pbnB1dD0gdGhpc1xuLy8gbW9kdWxlIHVzZWQgdG8gb3duIGluIGluZGV4Lmh0bWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVGhlc2UgYXJlIGZpeGVkLCBuZXZlci1yZWNyZWF0ZWQgZWxlbWVudHMgaW4gaW5kZXguaHRtbCwgc28gd2lyaW5nIHRoZW0gb25jZSBhdFxuLy8gbW9kdWxlIGxvYWQgKGJlbG93KSBjYW4ndCBkb3VibGUtZmlyZSBvbiBhIHJlLXJlbmRlciB0aGUgd2F5IGEgZHluYW1pY2FsbHlcbi8vIHJlbmRlcmVkIGxpc3QgY291bGQuXG5jb25zdCBfQkdfRElTTUlTU19NT0RBTFMgPSBbXG4gIFsnZ2V0dGluZy1zdGFydGVkLW1vZGFsJywgY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsXSxcbiAgWydoZWxwLW1vZGFsJywgY2xvc2VIZWxwTW9kYWxdLFxuICBbJ2Fib3V0LW1vZGFsJywgY2xvc2VBYm91dE1vZGFsXSxcbiAgWydnbG9zc2FyeS1tb2RhbCcsIGNsb3NlR2xvc3NhcnlNb2RhbF0sXG5dO1xuXG5mdW5jdGlvbiBfd2lyZU1vZGFsQmdEaXNtaXNzYWxzKCkge1xuICBmb3IgKGNvbnN0IFttb2RhbElkLCBjbG9zZUZuXSBvZiBfQkdfRElTTUlTU19NT0RBTFMpIHtcbiAgICBjb25zdCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG1vZGFsSWQpO1xuICAgIG1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7IGlmIChlLnRhcmdldCA9PT0gbW9kYWwpIGNsb3NlRm4oKTsgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gX3dpcmVNb2RhbEJ1dHRvbnMoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZXR0aW5nLXN0YXJ0ZWQtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWxwLW1vZGFsLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VIZWxwTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhYm91dC1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlQWJvdXRNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LW1vZGFsLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VHbG9zc2FyeU1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktZmlsdGVyJykuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBlID0+IF9maWx0ZXJHbG9zc2FyeShlLnRhcmdldC52YWx1ZSkpO1xufVxuXG4vLyBUaGUgNCBoYW1idXJnZXIgaXRlbXMgdWkuanMncyBvd24gbWlncmF0aW9uIGRlZmVycmVkICh0aGVpciBpbmxpbmUgb25jbGljaz1cbi8vIG1peGVkIHVpLmpzJ3MgY2xvc2VIYW1idXJnZXIoKSB3aXRoIGEgaGVscG1vZGFscy5qcyBtb2RhbC1vcGVuIGNhbGwpIC0gdGhpc1xuLy8gbW9kdWxlIG5vdyBvd25zIHRoZSBtb2RhbC1vcGVuIGhhbGYsIHNvIGl0IG93bnMgcmV0aXJpbmcgdGhlbSB0b28uXG5mdW5jdGlvbiBfd2lyZUhhbWJ1cmdlckhhbmRsZXJzKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tZ2V0dGluZy1zdGFydGVkJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkdldHRpbmdTdGFydGVkTW9kYWwoKTtcbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1nbG9zc2FyeScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIHdpbmRvdy5jbG9zZUhhbWJ1cmdlcigpO1xuICAgIG9wZW5HbG9zc2FyeU1vZGFsKCk7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0taGVscCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIHdpbmRvdy5jbG9zZUhhbWJ1cmdlcigpO1xuICAgIG9wZW5IZWxwTW9kYWwoKTtcbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1hYm91dCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIHdpbmRvdy5jbG9zZUhhbWJ1cmdlcigpO1xuICAgIG9wZW5BYm91dE1vZGFsKCk7XG4gIH0pO1xufVxuXG5fd2lyZU1vZGFsQmdEaXNtaXNzYWxzKCk7XG5fd2lyZU1vZGFsQnV0dG9ucygpO1xuX3dpcmVIYW1idXJnZXJIYW5kbGVycygpO1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gYXBwLWdsb2JhbCBrZXlib2FyZCBzaG9ydGN1dHMgYW5kIHRoZSBFc2NhcGUta2V5IGxheWVyIGNhc2NhZGUuXG4vLyBFeHRyYWN0ZWQgb3V0IG9mIHNldHRpbmdzLmpzICh3aGljaCBncmV3IGludG8gYSBjYXRjaC1hbGwpIC0gc2hvcnRjdXRzIGFyZVxuLy8gYXBwLXdpZGUsIG5vdCBzZXR0aW5ncy1zcGVjaWZpYy5cbi8vICAgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfa2V5Ym9hcmQucHlcblxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IFBhbmVsTmF2IH0gZnJvbSAnLi9wYW5lbG5hdi5qcyc7XG5pbXBvcnQge1xuICBfY29uZmlybUNhbmNlbCwgY2xvc2VBbGVydE1vZGFsLCBjbG9zZUNvbnRyb2xzTW9kYWwsIGNsb3NlRmllbGRFZGl0TW9kYWwsXG4gIF9kaWZmRGlzY2FyZCwgY2xvc2VBY3Rpb25zTW9kYWwsIGNsb3NlS2ViYWIsIGlzSGFtYnVyZ2VyT3BlbiwgY2xvc2VIYW1idXJnZXIsXG4gIHRvcG1vc3RWaXNpYmxlTW9kYWwsIG9wZW5Db250cm9sc01vZGFsLFxufSBmcm9tICcuL3VpLmpzJztcbmltcG9ydCB7XG4gIGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCwgY2xvc2VBYm91dE1vZGFsLCBjbG9zZUdsb3NzYXJ5TW9kYWwsIGNsb3NlSGVscE1vZGFsLFxufSBmcm9tICcuL2hlbHBtb2RhbHMuanMnO1xuXG4vLyDilIDilIAga2V5Ym9hcmQgc2hvcnRjdXRzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4vLyBFc2NhcGUgcGVlbHMgb25lIGxheWVyIHBlciBwcmVzcywgdG9wbW9zdCBmaXJzdDogZmxvYXRpbmcgbWVudXMgKGtlYmFiIHo6NTAwLFxuLy8gaGFtYnVyZ2VyIHo6MzAwKSBzaXQgYWJvdmUgbW9kYWxzICh6OjIwMCksIHdoaWNoIHNpdCBhYm92ZSB0aGUgc2V0dGluZ3MgcGFuZWxcbi8vIGFuZCB0aGUgZnVsbC1wYW5lbCBlZGl0b3JzLiB0b3Btb3N0VmlzaWJsZU1vZGFsICh1aS5qcykgcmVzb2x2ZXMgbW9kYWxcbi8vIHN0YWNraW5nIC0gY29uZmlybS9hbGVydCB0YWtlIHByaW9yaXR5LCBzbyBhIFwiRGlzY2FyZD9cIiBjb25maXJtIGNhbmNlbHNcbi8vIHdpdGhvdXQgYWxzbyBjbG9zaW5nIHRoZSBzdGlsbC1kaXJ0eSBlZGl0b3IgdW5kZXJuZWF0aCBpdC5cbi8vXG4vLyBTdGlsbC1jbGFzc2ljIG1vZGFsIGNsb3NlcnMgKHdpbmRvdy5jbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCBldGMuKSBhcmUgY2FsbGVkXG4vLyBhcyBiYXJlIGdsb2JhbHMgLSB0aGVpciBvd25pbmcgbW9kdWxlcyBoYXZlbid0IG1pZ3JhdGVkIHRvIEVTTSB5ZXQuXG5jb25zdCBfbW9kYWxFc2NhcGVDbG9zZXJzID0ge1xuICAnY29uZmlybS1tb2RhbCc6ICAgICAgICAgICAoKSA9PiBfY29uZmlybUNhbmNlbCgpLFxuICAnYWxlcnQtbW9kYWwnOiAgICAgICAgICAgICAoKSA9PiBjbG9zZUFsZXJ0TW9kYWwoKSxcbiAgJ2dldHRpbmctc3RhcnRlZC1tb2RhbCc6ICAgKCkgPT4gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsKCksXG4gICdhYm91dC1tb2RhbCc6ICAgICAgICAgICAgICgpID0+IGNsb3NlQWJvdXRNb2RhbCgpLFxuICAnY29udHJvbHMtbW9kYWwnOiAgICAgICAgICAoKSA9PiBjbG9zZUNvbnRyb2xzTW9kYWwoKSxcbiAgJ2dsb3NzYXJ5LW1vZGFsJzogICAgICAgICAgKCkgPT4gY2xvc2VHbG9zc2FyeU1vZGFsKCksXG4gICdoZWxwLW1vZGFsJzogICAgICAgICAgICAgICgpID0+IGNsb3NlSGVscE1vZGFsKCksXG4gICdmaWVsZC1lZGl0LW1vZGFsJzogICAgICAgICgpID0+IGNsb3NlRmllbGRFZGl0TW9kYWwoKSxcbiAgJ2RpZmYtbW9kYWwnOiAgICAgICAgICAgICAgKCkgPT4gX2RpZmZEaXNjYXJkKCksXG4gICdzY29yZS1vdmVycmlkZS1tb2RhbCc6ICAgICgpID0+IGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCksXG4gICdwcm9maWxlLW1vZGFsJzogICAgICAgICAgICgpID0+IGNsb3NlUHJvZmlsZU1hbmFnZXIoKSxcbiAgJ2hpZ2hsaWdodC1yZWVscy1tb2RhbCc6ICAgKCkgPT4gY2xvc2VIaWdobGlnaHRSZWVsc01vZGFsKCksXG4gICdyZWVsLXByZXZpZXctbW9kYWwnOiAgICAgICgpID0+IGNsb3NlUmVlbFByZXZpZXcoKSxcbiAgJ3JldHJhbnNjcmliZS1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VSZXRyYW5zY3JpYmVNb2RhbCgpLFxuICAnY29udGV4dC1tb2RhbCc6ICAgICAgICAgICAoKSA9PiBjbG9zZUNvbnRleHRNYW5hZ2VyKCksXG4gICdiYXRjaC1leHBvcnQtbW9kYWwnOiAgICAgICgpID0+IGNsb3NlQmF0Y2hFeHBvcnRNb2RhbCgpLFxuICAnZXhwb3J0LXNldHRpbmdzLW1vZGFsJzogICAoKSA9PiBjbG9zZUV4cG9ydE1vZGFsKCksXG4gICd0aW1lbGluZS1pbnRlcnZhbC1tb2RhbCc6ICgpID0+IGNsb3NlVGltZWxpbmVJbnRlcnZhbE1vZGFsKCksXG4gICdhdXRvLWFwcHJvdmUtbW9kYWwnOiAgICAgICgpID0+IGNsb3NlQXV0b0FwcHJvdmVNb2RhbCgpLFxuICAnc2ltaWxhci1jbGlwcy1tb2RhbCc6ICAgICAoKSA9PiBjbG9zZVNpbWlsYXJDbGlwc01vZGFsKCksXG4gICdhY3Rpb25zLW1vZGFsJzogICAgICAgICAgICgpID0+IGNsb3NlQWN0aW9uc01vZGFsKCksXG59O1xuXG5mdW5jdGlvbiBfY2xvc2VUb3Btb3N0TGF5ZXIoKSB7XG4gIGlmIChjbG9zZUtlYmFiKHRydWUpKSByZXR1cm47XG4gIGlmIChpc0hhbWJ1cmdlck9wZW4oKSkgeyBjbG9zZUhhbWJ1cmdlcih0cnVlKTsgcmV0dXJuOyB9XG4gIGlmIChpc1Byb2plY3RNZW51T3BlbigpKSB7IGNsb3NlUHJvamVjdE1lbnUodHJ1ZSk7IHJldHVybjsgfVxuICBjb25zdCB0b3BNb2RhbCA9IHRvcG1vc3RWaXNpYmxlTW9kYWwoKTtcbiAgaWYgKHRvcE1vZGFsKSB7XG4gICAgKF9tb2RhbEVzY2FwZUNsb3NlcnNbdG9wTW9kYWwuaWRdIHx8ICgoKSA9PiB0b3BNb2RhbC5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJykpKSgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NldHRpbmdzLXBhbmVsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykpIHsgY2xvc2VTZXR0aW5ncygpOyByZXR1cm47IH1cbiAgaWYgKFBhbmVsTmF2LmlzT3BlbigpKSB7IFBhbmVsTmF2LmNsb3NlKCk7IHJldHVybjsgfVxuICBpZiAoX2lzTmV3UmVjb3JkaW5nUGFuZWxPcGVuKCkpIGNsb3NlTmV3UmVjb3JkaW5nUGFuZWwoKTtcbn1cblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xuICAvLyBBIGZvY3VzZWQgbGlzdCBpdGVtIChjbGlwL3ZpZGVvIDxsaT4pIGhhbmRsZXMgRW50ZXIvU3BhY2UgaXRzZWxmIGFuZCBjYWxsc1xuICAvLyBwcmV2ZW50RGVmYXVsdCAtIGRvbid0IEFMU08gcnVuIHRoZSBnbG9iYWwgc2hvcnRjdXQgKGUuZy4gU3BhY2UgdG9nZ2xpbmdcbiAgLy8gcGxheS9wYXVzZSB3aGlsZSB0aGUgbGkgYWN0aXZhdGlvbiBpcyBzZWxlY3RpbmcgYSBjbGlwKS5cbiAgaWYgKGUuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuO1xuXG4gIGNvbnN0IGlzVHlwaW5nID0gZS50YXJnZXQudGFnTmFtZSA9PT0gJ0lOUFVUJyB8fCBlLnRhcmdldC50YWdOYW1lID09PSAnVEVYVEFSRUEnIHx8IGUudGFyZ2V0LmlzQ29udGVudEVkaXRhYmxlO1xuXG4gIC8vIEVzY2FwZSBtdXN0IHdvcmsgd2l0aCBmb2N1cyBvbiBhIGJ1dHRvbi9zZWxlY3QvbGluayAtIHRoYXQncyB3aGVyZSBldmVyeVxuICAvLyBtb2RhbCBwbGFjZXMgZm9jdXMgb24gb3Blbi4gT25seSB0eXBpbmcgc3VyZmFjZXMga2VlcCBFc2NhcGUgdG8gdGhlbXNlbHZlc1xuICAvLyAodGhlaXIgb3duIGhhbmRsZXJzLCBlLmcuIHRoZSBpbmxpbmUgY2FwdGlvbiBlZGl0b3IsIHVzZSBpdCB0byBjYW5jZWwpLlxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnICYmIGlzVHlwaW5nKSByZXR1cm47XG5cbiAgaWYgKGUua2V5ICE9PSAnRXNjYXBlJyAmJlxuICAgICAgKGlzVHlwaW5nIHx8IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdCVVRUT04nIHx8IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdTRUxFQ1QnIHx8IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdBJykpIHJldHVybjtcblxuICAvLyBDdHJsL0NtZCtaICh1bmRvKSBpcyB0aGUgb25seSBiaW5kaW5nIHRoYXQgaW50ZW50aW9uYWxseSB1c2VzIGEgbW9kaWZpZXIuXG4gIC8vIEV2ZXJ5IG90aGVyIHNob3J0Y3V0IGlzIGEgYmFyZSBrZXksIHNvIGxldCBtb2RpZmllciBjaG9yZHMgZmFsbCB0aHJvdWdoIHRvXG4gIC8vIHRoZSBicm93c2VyL09TIChDdHJsK1IgcmVmcmVzaCwgQ21kK0Egc2VsZWN0LWFsbCwgZXRjLikgaW5zdGVhZCBvZiBoaWphY2tpbmdcbiAgLy8gdGhlbSAtIHJ1bm5pbmcgYSBiYXJlLWtleSBoYW5kbGVyIGhlcmUgd291bGQgYWxzbyBwcmV2ZW50RGVmYXVsdCB0aGUgY2hvcmQuXG4gIGlmIChlLmtleSA9PT0gJ3onICYmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5KSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB1bmRvTGFzdFN0YXR1cygpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLmFsdEtleSkgcmV0dXJuO1xuXG4gIGNvbnN0IF9hbnlNb2RhbE9wZW4gPSAoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubW9kYWwtYmcudmlzaWJsZScpICE9PSBudWxsO1xuXG4gIGlmIChlLmtleSA9PT0gJz8nIHx8IGUua2V5ID09PSAnLycpIHtcbiAgICBpZiAoX2FueU1vZGFsT3BlbigpKSByZXR1cm47XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIG9wZW5Db250cm9sc01vZGFsKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICBfY2xvc2VUb3Btb3N0TGF5ZXIoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBBIHRha2VvdmVyIHBhbmVsIChlLmcuIFNwbGl0IEVkaXRvcikgY292ZXJzIHRoZSBkZXRhaWwgcGFuZSBidXQgbm90IHRoZVxuICAvLyBjbGlwIGxpc3QgYmVzaWRlIGl0IC0gd2l0aG91dCB0aGlzIGd1YXJkIEovSy9BL1Igd291bGQgc2lsZW50bHkgYWN0IG9uIGFcbiAgLy8gY2xpcCB0aGUgdXNlciBjYW4gbm8gbG9uZ2VyIHNlZS5cbiAgaWYgKF9hbnlNb2RhbE9wZW4oKSB8fCBQYW5lbE5hdi5pc09wZW4oKSkgcmV0dXJuO1xuXG4gIC8vIEEvUi9FIG11c3QgYWN0IG9uIHRoZSBjbGlwIHRoZSB1c2VyIGlzIHBvaW50aW5nIGF0OiB3aGVuIGtleWJvYXJkIGZvY3VzXG4gIC8vIHNpdHMgb24gYSBjbGlwIGxpc3Qgcm93IChUYWIpLCB0aGF0IHJvdyBpcyB0aGUgc3ViamVjdCAtIG5vdCB0aGUgYWN0aXZlXG4gIC8vIGNsaXAsIHdoaWNoIGNhbiBiZSBhIGRpZmZlcmVudCByb3cgKGZvY3VzZWQtdnMtYWN0aXZlIG1pc21hdGNoKS5cbiAgY29uc3QgZm9jdXNlZFJvdyA9IGUudGFyZ2V0IGluc3RhbmNlb2YgRWxlbWVudCA/IGUudGFyZ2V0LmNsb3Nlc3QoJyNjbGlwLWxpc3QgbGlbZGF0YS1jbGlwLWlkXScpIDogbnVsbDtcbiAgY29uc3Qgc3ViamVjdENsaXBJZCA9IGZvY3VzZWRSb3cgPyBOdW1iZXIoZm9jdXNlZFJvdy5kYXRhc2V0LmNsaXBJZCkgOiBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQ7XG4gIGlmICghc3ViamVjdENsaXBJZCkgcmV0dXJuO1xuXG4gIC8vIEFjdGl2YXRlIHRoZSBzdWJqZWN0IGZpcnN0IHNvIHRoZSBkZXRhaWwgcGFuZSBhbmQgcGxheWVyIHNob3cgdGhlIGNsaXBcbiAgLy8gdGhlIHNob3J0Y3V0IGlzIGFjdGluZyBvbiBiZWZvcmUgdGhlIGFjdGlvbiBsYW5kcy5cbiAgY29uc3QgX2FjdE9uU3ViamVjdCA9IGFjdGlvbiA9PiB7XG4gICAgaWYgKHN1YmplY3RDbGlwSWQgIT09IEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCkgc2VsZWN0Q2xpcChzdWJqZWN0Q2xpcElkKS50aGVuKCgpID0+IGFjdGlvbihzdWJqZWN0Q2xpcElkKSk7XG4gICAgZWxzZSBhY3Rpb24oc3ViamVjdENsaXBJZCk7XG4gIH07XG4gIC8vIEFycm93IG5hdmlnYXRpb24gbW92ZXMga2V5Ym9hcmQgZm9jdXMgYWxvbmcgd2l0aCB0aGUgYWN0aXZlIGNsaXAgc28gdGhlXG4gIC8vIGZvY3VzIHJpbmcgYW5kIHRoZSBhY3RpdmUgaGlnaGxpZ2h0IGNhbiBuZXZlciBwb2ludCBhdCBkaWZmZXJlbnQgcm93cy5cbiAgY29uc3QgX25hdmlnYXRlVG8gPSBpZCA9PiB7XG4gICAgc2VsZWN0Q2xpcChpZCk7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgI2NsaXAtbGlzdCBsaVtkYXRhLWNsaXAtaWQ9XCIke2lkfVwiXWApPy5mb2N1cygpO1xuICB9O1xuXG4gIGNvbnN0IGlkeCA9IEFwcFN0YXRlLmNsaXBzLmZpbmRJbmRleChjID0+IGMuaWQgPT09IHN1YmplY3RDbGlwSWQpO1xuXG4gIHN3aXRjaCAoZS5rZXkpIHtcbiAgICBjYXNlICdhJzogY2FzZSAnQSc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBfYWN0T25TdWJqZWN0KGlkID0+IHNldFN0YXR1cyhpZCwgJ2FwcHJvdmVkJykpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncic6IGNhc2UgJ1InOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgX2FjdE9uU3ViamVjdChpZCA9PiBzZXRTdGF0dXMoaWQsICdyZWplY3RlZCcpKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3UnOiBjYXNlICdVJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIF9hY3RPblN1YmplY3QoaWQgPT4gc2V0U3RhdHVzKGlkLCAncGVuZGluZycpKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJyAnOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgeyBjb25zdCB2ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BsYXllci1hcmVhIHZpZGVvJyk7IGlmICh2KSB7IHYucGF1c2VkID8gdi5wbGF5KCkgOiB2LnBhdXNlKCk7IH0gfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnZSc6IGNhc2UgJ0UnOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgX2FjdE9uU3ViamVjdChleHBvcnRDbGlwKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0Fycm93TGVmdCc6XG4gICAgY2FzZSAnQXJyb3dVcCc6XG4gICAgY2FzZSAnayc6IGNhc2UgJ0snOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgaWYgKGlkeCA+IDApIF9uYXZpZ2F0ZVRvKEFwcFN0YXRlLmNsaXBzW2lkeCAtIDFdLmlkKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0Fycm93UmlnaHQnOlxuICAgIGNhc2UgJ0Fycm93RG93bic6XG4gICAgY2FzZSAnaic6IGNhc2UgJ0onOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgaWYgKGlkeCAhPT0gLTEgJiYgaWR4IDwgQXBwU3RhdGUuY2xpcHMubGVuZ3RoIC0gMSkgX25hdmlnYXRlVG8oQXBwU3RhdGUuY2xpcHNbaWR4ICsgMV0uaWQpO1xuICAgICAgYnJlYWs7XG4gIH1cbn0pO1xuXG4vLyBObyBleHBvcnRzIC0gdGhpcyBtb2R1bGUncyBvbmx5IHB1YmxpYyBzdXJmYWNlIGlzIHRoZSBrZXlkb3duIGxpc3RlbmVyXG4vLyByZWdpc3RyYXRpb24gaXRzZWxmOyBfbW9kYWxFc2NhcGVDbG9zZXJzL19jbG9zZVRvcG1vc3RMYXllciBhcmUgcmVmZXJlbmNlZFxuLy8gb25seSBmcm9tIHdpdGhpbiB0aGlzIG1vZHVsZS4gU3RpbGwtY2xhc3NpYyBnbG9iYWxzIGl0IGNhbGxzXG4vLyAoY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwsIHNlbGVjdENsaXAsIHNldFN0YXR1cywgZXhwb3J0Q2xpcCwgZXRjLikgcmVzb2x2ZVxuLy8gb2ZmIHdpbmRvdyBzaW5jZSB0aGVpciBvd25pbmcgbW9kdWxlcyBoYXZlbid0IG1pZ3JhdGVkIHRvIEVTTSB5ZXQuXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSB0aGUgcmVjb21tZW5kZWQtbW9kZWwgY2F0YWxvZywgbW9kZWwtcmVhZGluZXNzIHJvdywgYW5kIHRoZVxuLy8gY2FwYWJpbGl0aWVzIG92ZXJ2aWV3IChcIndoYXQgc2NvcmluZy92aXNpb24gcG93ZXIgaXMgaW5zdGFsbGVkIGFuZCBob3cgZG8gSVxuLy8gZ2V0IG1vcmVcIikuIEV4dHJhY3RlZCBvdXQgb2Ygc2V0dGluZ3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLVxuLy8gdGhlc2UgcmVhZCBiYWNrZW5kL21vZGVsIGNvbmZpZyB0byBkZWNpZGUgd2hhdCB0byByZW5kZXIsIGJ1dCB0aGUgc2F2ZS9kaXJ0eVxuLy8gZW5naW5lIHRoYXQgcGVyc2lzdHMgY29uZmlnIHN0YXlzIGluIHNldHRpbmdzLmpzLlxuLy8gICBBUEk6IHJvdXRlcy9sbG0ucHksIHJvdXRlcy9jb25maWcucHkgKGNhcGFiaWxpdGllcy90aWVycykgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfbW9kZWxfY2F0YWxvZy5weSwgdGVzdHMvdWkvdGVzdF91aV9zZXR0aW5ncy5weVxuaW1wb3J0IHsgZXNjSHRtbCB9IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IHNob3dUb2FzdCB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG4vLyDilIDilIAgbW9kZWwgY2F0YWxvZyAocmVjb21tZW5kZWQgdGV4dCArIHZpc2lvbiBtb2RlbHMpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTG9hZGVkIG9uY2UgcGVyIHNlc3Npb24uIEZpbGxzIHRoZSByZWNvbW1lbmRlZCBtb2RlbCBsaXN0czsgdGhlIGNhcGFiaWxpdGllc1xuLy8gbGluZSByZWZsZWN0cyB0aGUgKnNhdmVkKiBhY3RpdmUgbW9kZWwuXG5sZXQgX21vZGVsQ2F0YWxvZyA9IG51bGw7XG4vLyBtb2RlbHNfZGlyIC8gZnJlZSBkaXNrIC8gc2F2ZWQgYmFja2VuZCwgc28gY2FyZHMgY2FuIHNob3cgXCJ+WCBHQiwgWSBHQiBmcmVlXCJcbi8vIHVwIGZyb250IGFuZCB0aGUgc3VtbWFyeSBsaW5lIGNhbiBuYW1lIHRoZSBhY3RpdmUgYmFja2VuZC5cbmxldCBfbW9kZWxDYXRhbG9nSW5mbyA9IHsgbW9kZWxzX2RpcjogJycsIGZyZWVfZ2I6IG51bGwsIGJhY2tlbmQ6ICdsbGFtYWNwcCcgfTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIF9lbnN1cmVNb2RlbENhdGFsb2coKSB7XG4gIGlmIChfbW9kZWxDYXRhbG9nKSByZXR1cm47XG4gIGF3YWl0IF9sb2FkTW9kZWxDYXRhbG9nKCk7XG59XG5cbi8vIEZvcmNlIGEgcmUtZmV0Y2ggKyByZS1yZW5kZXIuIENhbGxlZCBhZnRlciBTYXZlIChjb25maWcgY2hhbmdlZCB3aGljaCBtb2RlbCBpc1xuLy8gYWN0aXZlKSBzbyB0aGUgXCJBY3RpdmVcIiBiYWRnZSBhbmQgdGhlIHN1bW1hcnkgbGluZSByZWZsZWN0IHRoZSBzYXZlZCBzdGF0ZS5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZWZyZXNoTW9kZWxDYXRhbG9nKCkge1xuICBfbW9kZWxDYXRhbG9nID0gbnVsbDtcbiAgYXdhaXQgX2xvYWRNb2RlbENhdGFsb2coKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2xvYWRNb2RlbENhdGFsb2coKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGZldGNoKCcvYXBpL2xsbS9jYXRhbG9nJykudGhlbihyID0+IHIuanNvbigpKTtcbiAgICBfbW9kZWxDYXRhbG9nID0gZGF0YS5tb2RlbHMgfHwgW107XG4gICAgX21vZGVsQ2F0YWxvZ0luZm8gPSB7XG4gICAgICBtb2RlbHNfZGlyOiBkYXRhLm1vZGVsc19kaXIgfHwgJycsXG4gICAgICBmcmVlX2diOiBkYXRhLmZyZWVfZ2IgPz8gbnVsbCxcbiAgICAgIGJhY2tlbmQ6IGRhdGEuYmFja2VuZCB8fCAnbGxhbWFjcHAnLFxuICAgIH07XG4gIH0gY2F0Y2gge1xuICAgIF9tb2RlbENhdGFsb2cgPSBbXTtcbiAgICBjb25zdCBmYWlsZWRFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWxsYW1hY3BwLXJlY29tbWVuZGVkJyk7XG4gICAgaWYgKGZhaWxlZEVsKSBmYWlsZWRFbC5pbm5lckhUTUwgPVxuICAgICAgJzxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+Q291bGQgbm90IGxvYWQgdGhlIHJlY29tbWVuZGVkIG1vZGVsIGxpc3QgLSBjaGVjayB5b3VyIGludGVybmV0IGNvbm5lY3Rpb24gYW5kIHJlb3BlbiBTZXR0aW5ncy4gWW91IGNhbiBzdGlsbCBzZXQgYSBtb2RlbCBmaWxlIGJ5IGhhbmQgdW5kZXIgQWR2YW5jZWQgQUkgb3B0aW9ucyBiZWxvdy48L2Rpdj4nO1xuICAgIHJldHVybjtcbiAgfVxuICBfcmVuZGVyUmVjb21tZW5kZWRNb2RlbHMoJ3MtbGxhbWFjcHAtcmVjb21tZW5kZWQnLCAnbGxhbWFjcHAnKTtcbiAgX3VwZGF0ZUN1cnJlbnRNb2RlbFN1bW1hcnkoKTtcbn1cblxuLy8gXCJDdXJyZW50bHkgdXNpbmc6IDxtb2RlbD4gKDxiYWNrZW5kPilcIiAtIHN0YXRlcyB0aGUgc2F2ZWQgYWN0aXZlIG1vZGVsIHBsYWlubHlcbi8vIHNvIGl0IGlzbid0IHJldmVyc2UtZW5naW5lZXJlZCBmcm9tIGEgcGF0aCBzdHJpbmcuIEhpZGRlbiB3aGVuIG5vdGhpbmcgbWF0Y2hlcy5cbmNvbnN0IF9CQUNLRU5EX0xBQkVMUyA9IHsgbGxhbWFjcHA6ICdMb2NhbCBsbGFtYS5jcHAnIH07XG5cbmZ1bmN0aW9uIF91cGRhdGVDdXJyZW50TW9kZWxTdW1tYXJ5KCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWxsbS1jdXJyZW50LXN1bW1hcnknKTtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBjb25zdCBhY3RpdmUgPSAoX21vZGVsQ2F0YWxvZyB8fCBbXSkuZmluZChtID0+IG0uYWN0aXZlKTtcbiAgaWYgKCFhY3RpdmUpIHsgZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJzsgcmV0dXJuOyB9XG4gIGNvbnN0IGJhY2tlbmQgPSBfbW9kZWxDYXRhbG9nSW5mby5iYWNrZW5kO1xuICBjb25zdCBsYWJlbCA9IF9CQUNLRU5EX0xBQkVMU1tiYWNrZW5kXSB8fCBiYWNrZW5kO1xuICBlbC5pbm5lckhUTUwgPVxuICAgIGBDdXJyZW50bHkgdXNpbmc6IDxzdHJvbmc+JHtlc2NIdG1sKGFjdGl2ZS5kaXNwbGF5X25hbWUpfTwvc3Ryb25nPiBgICtcbiAgICBgPHNwYW4gY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+KCR7ZXNjSHRtbChsYWJlbCl9KTwvc3Bhbj5gO1xuICBlbC5zdHlsZS5kaXNwbGF5ID0gJyc7XG59XG5cbi8vIFRleHQgYW5kIHZpc2lvbiBtb2RlbHMgcmVuZGVyIGFzIHR3byBsYWJlbGxlZCBncm91cHMgcGVyIGJhY2tlbmQsIGVhY2ggd2l0aFxuLy8gaXRzIG93biBpbnRybywgcmF0aGVyIHRoYW4gb25lIGZsYXQgbGlzdCAtIHNvIGl0J3Mgb2J2aW91cyB3aGljaCBtb2RlbHMgc2NvcmVcbi8vIGNsaXBzIGFuZCB3aGljaCBkZXNjcmliZSBmcmFtZXMuXG5mdW5jdGlvbiBfcmVuZGVyUmVjb21tZW5kZWRNb2RlbHMoY29udGFpbmVySWQsIGJhY2tlbmQpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChjb250YWluZXJJZCk7XG4gIGlmICghZWwgfHwgIV9tb2RlbENhdGFsb2cpIHJldHVybjtcbiAgY29uc3QgbW9kZWxzID0gX21vZGVsQ2F0YWxvZy5maWx0ZXIobSA9PiBtLmJhY2tlbmRzLmluY2x1ZGVzKGJhY2tlbmQpKTtcbiAgaWYgKCFtb2RlbHMubGVuZ3RoKSB7IGVsLmlubmVySFRNTCA9ICcnOyByZXR1cm47IH1cbiAgY29uc3QgdGV4dE1vZGVscyA9IG1vZGVscy5maWx0ZXIobSA9PiAhbS5raW5kcy5pbmNsdWRlcygndmlzaW9uJykpO1xuICBjb25zdCB2aXNpb25Nb2RlbHMgPSBtb2RlbHMuZmlsdGVyKG0gPT4gbS5raW5kcy5pbmNsdWRlcygndmlzaW9uJykpO1xuICBlbC5pbm5lckhUTUwgPVxuICAgIF9tb2RlbEdyb3VwSHRtbCgnVGV4dCBzY29yaW5nIG1vZGVscycsXG4gICAgICAnU2NvcmUgY2xpcHMgYW5kIHdyaXRlIGRlc2NyaXB0aW9ucy4gUGljayBvbmUgdG8gZ2V0IHN0YXJ0ZWQuJywgdGV4dE1vZGVscywgYmFja2VuZCwgJ3RleHQnKSArXG4gICAgX21vZGVsR3JvdXBIdG1sKCdJbWFnZSBhbmFseXNpcyAodmlzaW9uKSBtb2RlbHMnLFxuICAgICAgJ09wdGlvbmFsIC0gbGV0IFl1dUNsaXAgbG9vayBhdCBmcmFtZXMgYW5kIGRlc2NyaWJlIHdoYXQgaXMgb24gc2NyZWVuLicsIHZpc2lvbk1vZGVscywgYmFja2VuZCwgJ3Zpc2lvbicpO1xuICBfd2lyZU1vZGVsQ2FyZHMoZWwpO1xufVxuXG5mdW5jdGlvbiBfbW9kZWxHcm91cEh0bWwodGl0bGUsIGludHJvLCBtb2RlbHMsIGJhY2tlbmQsIGtpbmQpIHtcbiAgaWYgKCFtb2RlbHMubGVuZ3RoKSByZXR1cm4gJyc7XG4gIHJldHVybiAoXG4gICAgYDxkaXYgY2xhc3M9XCJyZWMtbW9kZWwtZ3JvdXBcIj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsLWdyb3VwLXRpdGxlXCI+JHtlc2NIdG1sKHRpdGxlKX08L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiPiR7ZXNjSHRtbChpbnRybyl9PC9kaXY+YCArXG4gICAgICBtb2RlbHMubWFwKG0gPT4gX3JlY01vZGVsSHRtbChtLCBiYWNrZW5kLCBraW5kKSkuam9pbignJykgK1xuICAgIGA8L2Rpdj5gXG4gICk7XG59XG5cbmZ1bmN0aW9uIF93aXJlTW9kZWxDYXJkcyhlbCkge1xuICBlbC5xdWVyeVNlbGVjdG9yQWxsKCcucmVjLW1vZGVsJykuZm9yRWFjaChjYXJkID0+IHtcbiAgICBjb25zdCBtb2RlbElkID0gY2FyZC5nZXRBdHRyaWJ1dGUoJ2RhdGEtbW9kZWwtaWQnKTtcbiAgICBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWFjdD1cImRvd25sb2FkLWdndWZcIl0nKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBkb3dubG9hZEdndWZNb2RlbChtb2RlbElkLCBjYXJkKSk7XG4gICAgY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1hY3Q9XCJ1c2UtZ2d1ZlwiXScpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF91c2VHZ3VmTW9kZWwobW9kZWxJZCkpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gX21vZGVsTWV0YUxpbmUobSkge1xuICBjb25zdCBmcmVlID0gX21vZGVsQ2F0YWxvZ0luZm8uZnJlZV9nYjtcbiAgcmV0dXJuIFtcbiAgICBtLnNpemVfZ2IgPyBgfiR7bS5zaXplX2difSBHQmAgOiBudWxsLFxuICAgIChtLnNpemVfZ2IgIT0gbnVsbCAmJiBmcmVlICE9IG51bGwpID8gYCR7ZnJlZX0gR0IgZnJlZWAgOiBudWxsLFxuICAgIG0ubGljZW5jZSxcbiAgXS5maWx0ZXIoQm9vbGVhbikuam9pbignIMK3ICcpO1xufVxuXG5mdW5jdGlvbiBfbW9kZWxCYWRnZShtKSB7XG4gIGlmIChtLmFjdGl2ZSkgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInJlYy1tb2RlbC1iYWRnZSBhY3RpdmVcIj5BY3RpdmU8L3NwYW4+YDtcbiAgaWYgKG0uaW5zdGFsbGVkKSByZXR1cm4gYDxzcGFuIGNsYXNzPVwicmVjLW1vZGVsLWJhZGdlXCI+RG93bmxvYWRlZDwvc3Bhbj5gO1xuICByZXR1cm4gJyc7XG59XG5cbmZ1bmN0aW9uIF9yZWNNb2RlbEh0bWwobSwgYmFja2VuZCwga2luZCkge1xuICBjb25zdCBhY3Rpb25zID0gX2xsYW1hY3BwQWN0aW9ucyhtKTtcbiAgcmV0dXJuIChcbiAgICBgPGRpdiBjbGFzcz1cInJlYy1tb2RlbCR7bS5hY3RpdmUgPyAnIGFjdGl2ZScgOiAnJ31cIiBkYXRhLW1vZGVsLWlkPVwiJHtlc2NIdG1sKG0uaWQpfVwiIGRhdGEta2luZD1cIiR7ZXNjSHRtbChraW5kIHx8ICd0ZXh0Jyl9XCI+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cInJlYy1tb2RlbC1oZWFkXCI+PHNwYW4gY2xhc3M9XCJyZWMtbW9kZWwtbmFtZVwiPiR7ZXNjSHRtbChtLmRpc3BsYXlfbmFtZSl9PC9zcGFuPmAgK1xuICAgICAgX21vZGVsQmFkZ2UobSkgK1xuICAgICAgYDxzcGFuIGNsYXNzPVwicmVjLW1vZGVsLW1ldGFcIj4ke2VzY0h0bWwoX21vZGVsTWV0YUxpbmUobSkpfTwvc3Bhbj48L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsLXdoeVwiPiR7ZXNjSHRtbChtLndoeSl9PC9kaXY+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cInJlYy1tb2RlbC1hY3Rpb25zXCI+JHthY3Rpb25zfTwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJtZGwtcHJvZ3Jlc3NcIiBkYXRhLWdndWYtcHJvZ3Jlc3Mgc3R5bGU9XCJkaXNwbGF5Om5vbmVcIj5gICtcbiAgICAgICAgYDxkaXYgY2xhc3M9XCJtZGwtYmFyXCI+PGRpdiBjbGFzcz1cIm1kbC1iYXItZmlsbFwiIGRhdGEtZ2d1Zi1maWxsPjwvZGl2PjwvZGl2PmAgK1xuICAgICAgICBgPHNwYW4gY2xhc3M9XCJtZGwtcGN0XCIgZGF0YS1nZ3VmLXBjdD48L3NwYW4+PC9kaXY+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cInNldHRpbmdzLWluc3RhbGwtbG9nXCIgZGF0YS1nZ3VmLWxvZz48L2Rpdj5gICtcbiAgICBgPC9kaXY+YFxuICApO1xufVxuXG4vLyBPbmUtY2xpY2sgc3VyZmFjZSBmb3IgbG9jYWwgLmdndWYgbW9kZWxzOiBkb3dubG9hZCB3aGVuIG1pc3NpbmcsIFwiVXNlIHRoaXNcbi8vIG1vZGVsXCIgd2hlbiB0aGUgZmlsZSBpcyBhbHJlYWR5IG9uIGRpc2ssIGFuZCBhIHBsYWluIFwiaW4gdXNlXCIgbm90ZSB3aGVuIGFjdGl2ZS5cbi8vIFRoZSByYXcgcGF0aCBib3hlcyAoQWR2YW5jZWQgZGlzY2xvc3VyZSkgc3RheSBhcyB0aGUgbWFudWFsIGZhbGxiYWNrLlxuZnVuY3Rpb24gX2xsYW1hY3BwQWN0aW9ucyhtKSB7XG4gIGlmICghbS5nZ3VmX3VybCkgcmV0dXJuICcnO1xuICBpZiAoIW0uZ2d1Zl9maWxlbmFtZSkge1xuICAgIHJldHVybiBgPGEgaHJlZj1cIiR7ZXNjSHRtbChtLmdndWZfdXJsKX1cIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lclwiPkRvd25sb2FkIHBhZ2U8L2E+YDtcbiAgfVxuICBjb25zdCBwYXJ0cyA9IFtdO1xuICBpZiAobS5hY3RpdmUpIHtcbiAgICBwYXJ0cy5wdXNoKGA8c3BhbiBjbGFzcz1cInJlYy1tb2RlbC1ub3RlXCI+SW4gdXNlIGZvciBsb2NhbCBzY29yaW5nLjwvc3Bhbj5gKTtcbiAgfSBlbHNlIGlmIChtLmluc3RhbGxlZCkge1xuICAgIHBhcnRzLnB1c2goYDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYnRuLXNlY29uZGFyeVwiIGRhdGEtYWN0PVwidXNlLWdndWZcIj5Vc2UgdGhpcyBtb2RlbDwvYnV0dG9uPmApO1xuICB9IGVsc2Uge1xuICAgIHBhcnRzLnB1c2goYDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYnRuLXNlY29uZGFyeVwiIGRhdGEtYWN0PVwiZG93bmxvYWQtZ2d1ZlwiPkRvd25sb2FkIG5vdzwvYnV0dG9uPmApO1xuICB9XG4gIHBhcnRzLnB1c2goYDxhIGhyZWY9XCIke2VzY0h0bWwobS5nZ3VmX3VybCl9XCIgdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9vcGVuZXJcIj5DaG9vc2UgYSBkaWZmZXJlbnQgZmlsZTwvYT5gKTtcbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpO1xufVxuXG4vLyBQb2ludCB0aGUgKGFkdmFuY2VkKSBwYXRoIGZpZWxkcyBhdCBhbiBhbHJlYWR5LXByZXNlbnQgbW9kZWwgc28gYSBwbGFpbiBTYXZlXG4vLyBhY3RpdmF0ZXMgaXQgLSBubyByZS1kb3dubG9hZC4gQSB2aXNpb24gZW50cnkgZmlsbHMgdGhlIHZpc2lvbiBtb2RlbCArIG1tcHJvalxuLy8gcHJvamVjdG9yIGZpZWxkczsgYSB0ZXh0IGVudHJ5IGZpbGxzIHRoZSB0ZXh0IG1vZGVsIGZpZWxkLiBUaGUgdHdvIGJ1Y2tldHNcbi8vIGFyZSBpbmRlcGVuZGVudCBjb25maWcga2V5cywgc28gb25lIG11c3QgbmV2ZXIgb3ZlcndyaXRlIHRoZSBvdGhlci5cbmZ1bmN0aW9uIF9hcHBseU1vZGVsUGF0aHMobSkge1xuICBjb25zdCBpc1Zpc2lvbiA9IEFycmF5LmlzQXJyYXkobS5raW5kcykgJiYgbS5raW5kcy5pbmNsdWRlcygndmlzaW9uJyk7XG4gIGlmIChpc1Zpc2lvbikge1xuICAgIGNvbnN0IHZpc2lvbkVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxtLXZpc2lvbi1tb2RlbC1wYXRoJyk7XG4gICAgaWYgKHZpc2lvbkVsICYmIG0uZ2d1Zl9wYXRoKSB2aXNpb25FbC52YWx1ZSA9IG0uZ2d1Zl9wYXRoO1xuICAgIGNvbnN0IHByb2pFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWxsbS1tbXByb2otcGF0aCcpO1xuICAgIGlmIChwcm9qRWwgJiYgbS5tbXByb2pfcGF0aCkgcHJvakVsLnZhbHVlID0gbS5tbXByb2pfcGF0aDtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBwYXRoRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1sbG0tbW9kZWwtcGF0aCcpO1xuICAgIGlmIChwYXRoRWwgJiYgbS5nZ3VmX3BhdGgpIHBhdGhFbC52YWx1ZSA9IG0uZ2d1Zl9wYXRoO1xuICB9XG4gIHdpbmRvdy5fY2hlY2tTZXR0aW5nc0RpcnR5KCk7XG59XG5cbmZ1bmN0aW9uIF91c2VHZ3VmTW9kZWwobW9kZWxJZCkge1xuICBjb25zdCBtID0gKF9tb2RlbENhdGFsb2cgfHwgW10pLmZpbmQoeCA9PiB4LmlkID09PSBtb2RlbElkKTtcbiAgaWYgKCFtKSByZXR1cm47XG4gIF9hcHBseU1vZGVsUGF0aHMobSk7XG4gIHNob3dUb2FzdCgnTW9kZWwgc2VsZWN0ZWQgLSBjbGljayBTYXZlIHRvIGFwcGx5JywgJ2luZm8nKTtcbn1cblxuLy8g4pSA4pSAIG9uZS1jbGljayBsb2NhbCAoLmdndWYpIGRvd25sb2FkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gU2VydmVyLW93bmVkIGRvd25sb2FkIChQT1NUIC9hcGkvbGxtL2dndWYvZG93bmxvYWQpIGZvciBhIHJlY29tbWVuZGVkIGxvY2FsXG4vLyBtb2RlbCAodGV4dCwgb3IgdmlzaW9uICsgaXRzIG1tcHJvaiBwcm9qZWN0b3IpLCBzbyBsbGFtYS5jcHAgZ2V0cyBhIG9uZS1jbGlja1xuLy8gZmxvdyBpbnN0ZWFkIG9mIG9ubHkgYSBcIkRvd25sb2FkIHBhZ2VcIiBsaW5rLiBTU0UgKyBDYW5jZWwtdmlhLWFib3J0IHN0cmVhbTtcbi8vIG9uIHN1Y2Nlc3MgdGhlIHNlcnZlciBoYXMgd3JpdHRlbiB0aGUgbW9kZWwgKGFuZCBwcm9qZWN0b3IpIHBhdGgocyksIHNvIHdlXG4vLyBwb2ludCB0aGUgcGF0aCBmaWVsZHMgYXQgdGhlbSwgcmVmcmVzaCB0aGUgcmVhZGluZXNzIGxpbmUsIGFuZCBwcm9tcHQgYSBTYXZlLlxubGV0IF9nZ3VmQWJvcnQgPSBudWxsO1xuXG4vLyBUaGUgQ0xJIHByaW50cyBcIkRvd25sb2FkaW5nIDxuYW1lPiAtIDxmaWxlPjogTk4lICh4L3kgR0IpXCIgbGluZXM7IHB1bGwgdGhlXG4vLyBwZXJjZW50YWdlIG91dCB0byBkcml2ZSBhIGRldGVybWluYXRlIGJhci4gVmlzaW9uIGVudHJpZXMgc3RyZWFtIHR3byBmaWxlcyBpblxuLy8gdHVybiwgc28gdGhlIGJhciByZXNldHMgcGVyIGZpbGUgLSBleHBlY3RlZCwgbm90IGEgYnVnLlxuZnVuY3Rpb24gX3BhcnNlR2d1ZlBjdChsaW5lKSB7XG4gIGNvbnN0IG1hdGNoID0gLyhcXGQrKSUvLmV4ZWMobGluZSk7XG4gIGlmICghbWF0Y2gpIHJldHVybiBudWxsO1xuICBjb25zdCBwY3QgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICByZXR1cm4gcGN0ID49IDAgJiYgcGN0IDw9IDEwMCA/IHBjdCA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIF9zZXRHZ3VmUHJvZ3Jlc3MoY2FyZCwgdmFsdWUpIHtcbiAgY29uc3QgZmlsbCA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1maWxsXScpO1xuICBjb25zdCBwY3QgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWdndWYtcGN0XScpO1xuICBpZiAoIWZpbGwgfHwgIXBjdCkgcmV0dXJuO1xuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIGZpbGwuY2xhc3NMaXN0LmFkZCgnaW5kZXRlcm1pbmF0ZScpO1xuICAgIGZpbGwuc3R5bGUud2lkdGggPSAnJztcbiAgICBwY3QudGV4dENvbnRlbnQgPSAnJztcbiAgfSBlbHNlIHtcbiAgICBmaWxsLmNsYXNzTGlzdC5yZW1vdmUoJ2luZGV0ZXJtaW5hdGUnKTtcbiAgICBmaWxsLnN0eWxlLndpZHRoID0gdmFsdWUgKyAnJSc7XG4gICAgcGN0LnRleHRDb250ZW50ID0gdmFsdWUgKyAnJSc7XG4gIH1cbn1cblxuZnVuY3Rpb24gX3NldEdndWZDYW5jZWwoY2FyZCwgc2hvdywgb25DYW5jZWwpIHtcbiAgY29uc3QgbG9nID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1nZ3VmLWxvZ10nKTtcbiAgaWYgKCFsb2cpIHJldHVybjtcbiAgbGV0IGJ0biA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1jYW5jZWxdJyk7XG4gIGlmIChzaG93KSB7XG4gICAgaWYgKCFidG4pIHtcbiAgICAgIGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgYnRuLnNldEF0dHJpYnV0ZSgnZGF0YS1nZ3VmLWNhbmNlbCcsICcnKTtcbiAgICAgIGJ0bi50eXBlID0gJ2J1dHRvbic7XG4gICAgICBidG4uY2xhc3NOYW1lID0gJ2J0bi1zZWNvbmRhcnknO1xuICAgICAgYnRuLnRleHRDb250ZW50ID0gJ0NhbmNlbCBkb3dubG9hZCc7XG4gICAgICBidG4uc3R5bGUubWFyZ2luVG9wID0gJzRweCc7XG4gICAgICBsb2cucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYnRuLCBsb2cpO1xuICAgIH1cbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBidG4ub25jbGljayA9IG9uQ2FuY2VsO1xuICAgIGJ0bi5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gIH0gZWxzZSBpZiAoYnRuKSB7XG4gICAgYnRuLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZG93bmxvYWRHZ3VmTW9kZWwobW9kZWxJZCwgY2FyZCkge1xuICBjb25zdCBsb2cgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWdndWYtbG9nXScpO1xuICBjb25zdCBidXR0b24gPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWFjdD1cImRvd25sb2FkLWdndWZcIl0nKTtcbiAgY29uc3QgcHJvZ3Jlc3MgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWdndWYtcHJvZ3Jlc3NdJyk7XG4gIGlmICghbG9nKSByZXR1cm47XG4gIGNvbnN0IG1vZGVsID0gKF9tb2RlbENhdGFsb2cgfHwgW10pLmZpbmQoeCA9PiB4LmlkID09PSBtb2RlbElkKTtcbiAgbG9nLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICBsb2cudGV4dENvbnRlbnQgPSAnU3RhcnRpbmcgZG93bmxvYWQgLSB0aGlzIGNhbiB0YWtlIHNldmVyYWwgbWludXRlcy4uLlxcbic7XG4gIGlmIChwcm9ncmVzcykgcHJvZ3Jlc3Muc3R5bGUuZGlzcGxheSA9ICcnO1xuICBfc2V0R2d1ZlByb2dyZXNzKGNhcmQsIG51bGwpO1xuICBpZiAoYnV0dG9uKSB7IGJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7IGJ1dHRvbi50ZXh0Q29udGVudCA9ICdEb3dubG9hZGluZy4uLic7IH1cbiAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgX2dndWZBYm9ydCA9IGNvbnRyb2xsZXI7XG4gIF9zZXRHZ3VmQ2FuY2VsKGNhcmQsIHRydWUsICgpID0+IHsgY29udHJvbGxlci5hYm9ydCgpOyB9KTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goYC9hcGkvbGxtL2dndWYvZG93bmxvYWQ/bW9kZWxfaWQ9JHtlbmNvZGVVUklDb21wb25lbnQobW9kZWxJZCl9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBtZXRob2Q6ICdQT1NUJywgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgIGxldCBkZXRhaWwgPSAnJztcbiAgICAgIHRyeSB7IGRldGFpbCA9IChhd2FpdCByZXNwLmpzb24oKSkuZGV0YWlsIHx8ICcnOyB9IGNhdGNoIHsgZGV0YWlsID0gYXdhaXQgcmVzcC50ZXh0KCk7IH1cbiAgICAgIGxvZy50ZXh0Q29udGVudCArPSBg4pyXICR7ZGV0YWlsIHx8ICdEb3dubG9hZCBjb3VsZCBub3Qgc3RhcnQuJ31cXG5gO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZWFkZXIgPSByZXNwLmJvZHkuZ2V0UmVhZGVyKCk7XG4gICAgY29uc3QgZGVjID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgbGV0IGJ1ZiA9ICcnO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCB7IGRvbmUsIHZhbHVlIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgaWYgKGRvbmUpIGJyZWFrO1xuICAgICAgYnVmICs9IGRlYy5kZWNvZGUodmFsdWUsIHsgc3RyZWFtOiB0cnVlIH0pO1xuICAgICAgY29uc3QgbGluZXMgPSBidWYuc3BsaXQoJ1xcbicpO1xuICAgICAgYnVmID0gbGluZXMucG9wKCk7XG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJ2RhdGE6ICcpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbXNnID0gSlNPTi5wYXJzZShsaW5lLnNsaWNlKDYpKTtcbiAgICAgICAgaWYgKG1zZyA9PT0gJ19fRE9ORV9fJykge1xuICAgICAgICAgIF9zZXRHZ3VmUHJvZ3Jlc3MoY2FyZCwgMTAwKTtcbiAgICAgICAgICBsb2cudGV4dENvbnRlbnQgKz0gJ+KckyBEb25lIC0gbW9kZWwgc2VsZWN0ZWQuIFNhdmUgdG8gYXBwbHkuXFxuJztcbiAgICAgICAgICBpZiAobW9kZWwpIF9hcHBseU1vZGVsUGF0aHMobW9kZWwpO1xuICAgICAgICAgIF91cGRhdGVMbG1DYXBhYmlsaXRpZXMoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGN0ID0gX3BhcnNlR2d1ZlBjdChtc2cpO1xuICAgICAgICBpZiAocGN0ICE9IG51bGwpIF9zZXRHZ3VmUHJvZ3Jlc3MoY2FyZCwgcGN0KTtcbiAgICAgICAgbG9nLnRleHRDb250ZW50ICs9IG1zZyArICdcXG4nO1xuICAgICAgICBsb2cuc2Nyb2xsVG9wID0gbG9nLnNjcm9sbEhlaWdodDtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChlcnIgJiYgZXJyLm5hbWUgPT09ICdBYm9ydEVycm9yJykgbG9nLnRleHRDb250ZW50ICs9ICfilqAgRG93bmxvYWQgY2FuY2VsbGVkLlxcbic7XG4gICAgZWxzZSBsb2cudGV4dENvbnRlbnQgKz0gJ+KclyBEb3dubG9hZCBmYWlsZWQgLSBjaGVjayB5b3VyIGNvbm5lY3Rpb24gYW5kIHRyeSBhZ2Fpbi5cXG4nO1xuICB9IGZpbmFsbHkge1xuICAgIF9nZ3VmQWJvcnQgPSBudWxsO1xuICAgIF9zZXRHZ3VmQ2FuY2VsKGNhcmQsIGZhbHNlKTtcbiAgICBpZiAocHJvZ3Jlc3MpIHByb2dyZXNzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgaWYgKGJ1dHRvbikgeyBidXR0b24uZGlzYWJsZWQgPSBmYWxzZTsgYnV0dG9uLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkIG5vdyc7IH1cbiAgfVxufVxuXG4vLyDilIDilIAgbW9kZWwgcmVhZGluZXNzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUmVhZGluZXNzIG9mIHRoZSAqc2F2ZWQqIGFjdGl2ZSBtb2RlbC4gUmVmbGVjdHMgY29uZmlnIG9uIGRpc2ssIG5vdCB1bnNhdmVkXG4vLyBlZGl0cyAtIHJlZnJlc2hlZCBvbiBvcGVuIGFuZCBhZnRlciBTYXZlLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIF91cGRhdGVMbG1DYXBhYmlsaXRpZXMoKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxtLWNhcGFiaWxpdGllcycpO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGxldCBjYXA7XG4gIHRyeSB7XG4gICAgY2FwID0gYXdhaXQgZmV0Y2goJy9hcGkvbGxtL2NhcGFiaWxpdGllcycpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gIH0gY2F0Y2ggeyBlbC50ZXh0Q29udGVudCA9ICdDb3VsZCBub3QgY2hlY2sgbW9kZWwgcmVhZGluZXNzLic7IHJldHVybjsgfVxuICBjb25zdCBtYXJrID0gb2sgPT4gb2tcbiAgICA/ICc8c3BhbiBhcmlhLWhpZGRlbj1cInRydWVcIj7inJM8L3NwYW4+IFJlYWR5J1xuICAgIDogJzxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPuKXizwvc3Bhbj4gTm90IHNldCB1cCc7XG4gIGVsLmlubmVySFRNTCA9XG4gICAgYDxzcGFuIHN0eWxlPVwibWFyZ2luLXJpZ2h0OjE0cHhcIj5UZXh0IHNjb3Jpbmc6ICR7bWFyayhjYXAudGV4dCl9PC9zcGFuPmAgK1xuICAgIGA8c3Bhbj5JbWFnZSBhbmFseXNpczogJHttYXJrKGNhcC52aXNpb24pfTwvc3Bhbj5gICtcbiAgICBgPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+JHtlc2NIdG1sKGNhcC5kZXRhaWwgfHwgJycpfTwvZGl2PmA7XG4gIGVsLnN0eWxlLmNvbG9yID0gY2FwLnRleHQgPyAndmFyKC0tZ3JlZW4pJyA6ICd2YXIoLS1tdXRlZCknO1xufVxuXG4vLyDilIDilIAgY2FwYWJpbGl0aWVzIG92ZXJ2aWV3IChTdGFnZSAwNikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBBIHJlYWQtb25seSwgYXQtYS1nbGFuY2UgbWFwIG9mIHRoZSBub24tTExNIHVwZ3JhZGUgdGllcnMuIFNvdXJjZXMgZWFjaCB0aWVyJ3Ncbi8vIGFjdGl2ZSBzdGF0ZSArIGluc3RhbGwgZ3VpZGFuY2UgZnJvbSB0aGUgYmFja2VuZCdzIGF2YWlsYWJpbGl0eSgpIHJlYXNvbnMgdmlhXG4vLyAvYXBpL2NhcGFiaWxpdGllcy90aWVycyAtIGl0IG5ldmVyIGluc3RhbGxzIGFueXRoaW5nIGl0c2VsZjsgZWFjaCByb3cgbGlua3MgdG9cbi8vIHRoZSBzZWN0aW9uIHdoZXJlIHRoZSByZWFsIGluc3RhbGwvZW5hYmxlIGNvbnRyb2wgbGl2ZXMuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX3JlbmRlckNhcGFiaWxpdHlUaWVycygpIHtcbiAgY29uc3QgbGlzdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWNhcGFiaWxpdGllcy1saXN0Jyk7XG4gIGNvbnN0IGludHJvID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtY2FwYWJpbGl0aWVzLWludHJvJyk7XG4gIGlmICghbGlzdCkgcmV0dXJuO1xuICBsZXQgZGF0YTtcbiAgdHJ5IHtcbiAgICBkYXRhID0gYXdhaXQgZmV0Y2goJy9hcGkvY2FwYWJpbGl0aWVzL3RpZXJzJykudGhlbihyID0+IHIuanNvbigpKTtcbiAgfSBjYXRjaCB7XG4gICAgaWYgKGludHJvKSBpbnRyby50ZXh0Q29udGVudCA9ICcnO1xuICAgIGxpc3QuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+Q291bGQgbm90IGNoZWNrIGNhcGFiaWxpdGllcy48L2Rpdj4nO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoaW50cm8pIHtcbiAgICBpbnRyby50ZXh0Q29udGVudCA9IGRhdGEubGlnaHR3ZWlnaHRcbiAgICAgID8gXCJObyBsb2NhbCBtb2RlbCBpcyBzZXQgdXAgeWV0IC0gdHJhbnNjcmlwdGlvbiBhbmQgdGhlIGNvcmUgc2NvcmluZyBhcmUgd29ya2luZywgYW5kIGNsaXBzIGdldCBhIHNob3J0IHRlbXBsYXRlIGRlc2NyaXB0aW9uLiBTZXR0aW5nIHVwIGEgbG9jYWwgbW9kZWwgaXMgdGhlIG5vcm1hbCBuZXh0IHN0ZXA6IGl0IGFkZHMgd3JpdHRlbiBkZXNjcmlwdGlvbnMsIHNlc3Npb24gc3VtbWFyaWVzLCBhbmQgYSBzbWFydGVyIHJlYWQgb24gc2NvcmluZy5cIlxuICAgICAgOiBcIkhlcmUncyB3aGF0IGVhY2ggcGFydCBvZiBZdXVDbGlwIGlzIHVzaW5nIHJpZ2h0IG5vdywgYW5kIHdoYXQgeW91IGNhbiB1cGdyYWRlLlwiO1xuICB9XG4gIGxpc3QuaW5uZXJIVE1MID0gKGRhdGEudGllcnMgfHwgW10pLm1hcChfY2FwYWJpbGl0eVRpZXJIdG1sKS5qb2luKCcnKTtcbiAgbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1zZWN0aW9uXScpLmZvckVhY2goYnRuID0+IHtcbiAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB3aW5kb3cuX3Njcm9sbFRvU2V0dGluZ3NTZWN0aW9uKGJ0bi5nZXRBdHRyaWJ1dGUoJ2RhdGEtc2VjdGlvbicpKSk7XG4gIH0pO1xuICBsaXN0LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXByZWZldGNoXScpLmZvckVhY2goYnRuID0+IHtcbiAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBwcmVmZXRjaE1vZGVsKGJ0bi5nZXRBdHRyaWJ1dGUoJ2RhdGEtcHJlZmV0Y2gnKSwgYnRuLmdldEF0dHJpYnV0ZSgnZGF0YS10aWVyLWlkJykpKTtcbiAgfSk7XG59XG5cbi8vIEZvdXIgdmlzdWFsIHN0YXRlcywgbm90IHR3bzogYSB0aWVyIGNhbiBiZSBmdWxseSBSZWFkeSAoZ3JlZW4gY2hlY2spLCB3YWl0aW5nXG4vLyBvbiBhIFRpZXItQiBtb2RlbCBpdCBjYW4gZmV0Y2ggcmlnaHQgbm93IChwcmVmZXRjaF9zbHVnIHNldCAtIFwiRG93bmxvYWQgbm93XCIpLFxuLy8gd2FpdGluZyBvbiBhIFRpZXItQiBtb2RlbCB0b28gc21hbGwgdG8gYm90aGVyIHdpdGggYSBwcm9ncmVzcyBVSSAobmV1dHJhbCwgbm9cbi8vIENUQSksIG9yIGdlbnVpbmVseSBuZWVkIGEgcmVhbCBzZXR1cCBzdGVwIChpbnN0YWxsX3NsdWcgc2V0IC0gZS5nLiBQeWFubm90ZVxuLy8gbmVlZHMgYSBwaXAgaW5zdGFsbCArIEh1Z2dpbmdGYWNlIHRva2VuLCBzaG93biBhcyBcIlNldCB1cCDihpJcIikuXG5mdW5jdGlvbiBfY2FwYWJpbGl0eVRpZXJIdG1sKHRpZXIpIHtcbiAgY29uc3QgbmVlZHNTZXR1cCA9ICF0aWVyLnJlYWR5ICYmICEhdGllci5pbnN0YWxsX3NsdWc7XG4gIGNvbnN0IG5lZWRzUHJlZmV0Y2ggPSAhdGllci5yZWFkeSAmJiAhbmVlZHNTZXR1cCAmJiAhIXRpZXIucHJlZmV0Y2hfc2x1ZztcbiAgY29uc3QgbWFyayA9IHRpZXIucmVhZHkgPyAn4pyTJyA6IChuZWVkc1NldHVwIHx8IG5lZWRzUHJlZmV0Y2ggPyAn4peLJyA6ICcmIzg5NDM7Jyk7XG4gIGNvbnN0IG1hcmtDbGFzcyA9IHRpZXIucmVhZHkgPyAnIHJlYWR5JyA6ICcnO1xuICBsZXQgYWN0aW9uID0gJyc7XG4gIGlmIChuZWVkc1NldHVwKSB7XG4gICAgYWN0aW9uID0gYDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwic2V0dGluZ3MtanVtcC1saW5rXCIgZGF0YS1zZWN0aW9uPVwiJHtlc2NIdG1sKHRpZXIuc2VjdGlvbil9XCIgc3R5bGU9XCJtYXJnaW4tdG9wOjJweFwiPlNldCB1cCAmcmFycjs8L2J1dHRvbj5gO1xuICB9IGVsc2UgaWYgKG5lZWRzUHJlZmV0Y2gpIHtcbiAgICBhY3Rpb24gPVxuICAgICAgYDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiYnRuLXNlY29uZGFyeVwiIGRhdGEtcHJlZmV0Y2g9XCIke2VzY0h0bWwodGllci5wcmVmZXRjaF9zbHVnKX1cIiBkYXRhLXRpZXItaWQ9XCIke2VzY0h0bWwodGllci5pZCl9XCIgc3R5bGU9XCJtYXJnaW4tdG9wOjRweFwiPkRvd25sb2FkIG5vdzwvYnV0dG9uPmAgK1xuICAgICAgYDxkaXYgaWQ9XCJjYXAtcHJlZmV0Y2gtbG9nLSR7ZXNjSHRtbCh0aWVyLmlkKX1cIiBjbGFzcz1cInNldHRpbmdzLWluc3RhbGwtbG9nXCI+PC9kaXY+YDtcbiAgfVxuICByZXR1cm4gKFxuICAgIGA8ZGl2IGNsYXNzPVwiY2FwYWJpbGl0eS10aWVyXCI+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cImNhcGFiaWxpdHktdGllci1oZWFkXCI+YCArXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImNhcGFiaWxpdHktbWFyayR7bWFya0NsYXNzfVwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPiR7bWFya308L3NwYW4+YCArXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImNhcGFiaWxpdHktdGllci1uYW1lXCI+JHtlc2NIdG1sKHRpZXIubmFtZSl9PC9zcGFuPmAgK1xuICAgICAgICBgPHNwYW4gY2xhc3M9XCJjYXBhYmlsaXR5LXRpZXItYWN0aXZlXCI+JHtlc2NIdG1sKHRpZXIuYWN0aXZlKX08L3NwYW4+YCArXG4gICAgICBgPC9kaXY+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj4ke2VzY0h0bWwodGllci5wdXJwb3NlKX08L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiPiR7ZXNjSHRtbCh0aWVyLnVwZ3JhZGUpfTwvZGl2PmAgK1xuICAgICAgKHRpZXIuZGV0YWlsID8gYDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+JHtlc2NIdG1sKHRpZXIuZGV0YWlsKX08L2Rpdj5gIDogJycpICtcbiAgICAgIGFjdGlvbiArXG4gICAgYDwvZGl2PmBcbiAgKTtcbn1cblxuLy8g4pSA4pSAIFRpZXItQiBtb2RlbCBwcmVmZXRjaCAoXCJEb3dubG9hZCBub3dcIikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBPbmUgZmxvdyBmb3IgZXZlcnkgbm9uLUxMTSBUaWVyLUIgbW9kZWwgKHNwZWFrZXIvYXVkaW8tZXZlbnQvZW1iZWRkaW5ncykgLVxuLy8gdGhlIHNhbWUgU1NFICsgQ2FuY2VsICsgbG9nIHBhdHRlcm4gYXMgdGhlIC5nZ3VmIGRvd25sb2FkIGFib3ZlLiBUaGUgbG9jYWxcbi8vIC5nZ3VmIExMTSBtb2RlbCBrZWVwcyBpdHMgb3duIHNlcGFyYXRlIGRvd25sb2FkIGZsb3cuXG5jb25zdCBfUFJFRkVUQ0hfTEFCRUxTID0ge1xuICBzcGVha2VyOiAndGhlIHNwZWFrZXIgbW9kZWwgKH44MCBNQiknLFxuICBhdWRpb19ldmVudDogJ3RoZSBhdWRpby1ldmVudCBtb2RlbCAofjM1MCBNQiknLFxuICBlbWJlZGRpbmdzOiAndGhlIGVtYmVkZGluZ3MgbW9kZWwgKH4xMzAgTUIpJyxcbn07XG5cbmxldCBfcHJlZmV0Y2hBYm9ydCA9IG51bGw7XG5cbmZ1bmN0aW9uIF9zZXRQcmVmZXRjaENhbmNlbCh0aWVySWQsIHNob3csIG9uQ2FuY2VsKSB7XG4gIGNvbnN0IGxvZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBjYXAtcHJlZmV0Y2gtbG9nLSR7dGllcklkfWApO1xuICBpZiAoIWxvZykgcmV0dXJuO1xuICBsZXQgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGNhcC1wcmVmZXRjaC1jYW5jZWwtJHt0aWVySWR9YCk7XG4gIGlmIChzaG93KSB7XG4gICAgaWYgKCFidG4pIHtcbiAgICAgIGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgYnRuLmlkID0gYGNhcC1wcmVmZXRjaC1jYW5jZWwtJHt0aWVySWR9YDtcbiAgICAgIGJ0bi50eXBlID0gJ2J1dHRvbic7XG4gICAgICBidG4uY2xhc3NOYW1lID0gJ2J0bi1zZWNvbmRhcnknO1xuICAgICAgYnRuLnRleHRDb250ZW50ID0gJ0NhbmNlbCBkb3dubG9hZCc7XG4gICAgICBidG4uc3R5bGUubWFyZ2luVG9wID0gJzRweCc7XG4gICAgICBsb2cucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoYnRuLCBsb2cpO1xuICAgIH1cbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBidG4ub25jbGljayA9IG9uQ2FuY2VsO1xuICAgIGJ0bi5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gIH0gZWxzZSBpZiAoYnRuKSB7XG4gICAgYnRuLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gcHJlZmV0Y2hNb2RlbChzbHVnLCB0aWVySWQpIHtcbiAgY29uc3QgbG9nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGNhcC1wcmVmZXRjaC1sb2ctJHt0aWVySWR9YCk7XG4gIGNvbnN0IGJ1dHRvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLXByZWZldGNoPVwiJHtDU1MuZXNjYXBlKHNsdWcpfVwiXWApO1xuICBpZiAoIWxvZykgcmV0dXJuO1xuICBsb2cuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gIGxvZy50ZXh0Q29udGVudCA9IGBEb3dubG9hZGluZyAke19QUkVGRVRDSF9MQUJFTFNbc2x1Z10gfHwgc2x1Z33igKZcXG5gO1xuICBpZiAoYnV0dG9uKSB7IGJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7IGJ1dHRvbi50ZXh0Q29udGVudCA9ICdEb3dubG9hZGluZ+KApic7IH1cbiAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgX3ByZWZldGNoQWJvcnQgPSBjb250cm9sbGVyO1xuICBfc2V0UHJlZmV0Y2hDYW5jZWwodGllcklkLCB0cnVlLCAoKSA9PiB7IGNvbnRyb2xsZXIuYWJvcnQoKTsgfSk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKGAvYXBpL21vZGVscy9wcmVmZXRjaD9zbHVnPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHNsdWcpfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbWV0aG9kOiAnUE9TVCcsIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgaWYgKCFyZXNwLm9rKSB7XG4gICAgICBsZXQgZGV0YWlsID0gJyc7XG4gICAgICB0cnkgeyBkZXRhaWwgPSAoYXdhaXQgcmVzcC5qc29uKCkpLmRldGFpbCB8fCAnJzsgfSBjYXRjaCB7IGRldGFpbCA9IGF3YWl0IHJlc3AudGV4dCgpOyB9XG4gICAgICBsb2cudGV4dENvbnRlbnQgKz0gYOKclyAke2RldGFpbCB8fCAnRG93bmxvYWQgY291bGQgbm90IHN0YXJ0Lid9XFxuYDtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcmVhZGVyID0gcmVzcC5ib2R5LmdldFJlYWRlcigpO1xuICAgIGNvbnN0IGRlYyA9IG5ldyBUZXh0RGVjb2RlcigpO1xuICAgIGxldCBidWYgPSAnJztcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgeyBkb25lLCB2YWx1ZSB9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICAgIGlmIChkb25lKSBicmVhaztcbiAgICAgIGJ1ZiArPSBkZWMuZGVjb2RlKHZhbHVlLCB7IHN0cmVhbTogdHJ1ZSB9KTtcbiAgICAgIGNvbnN0IGxpbmVzID0gYnVmLnNwbGl0KCdcXG4nKTtcbiAgICAgIGJ1ZiA9IGxpbmVzLnBvcCgpO1xuICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKCdkYXRhOiAnKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IG1zZyA9IEpTT04ucGFyc2UobGluZS5zbGljZSg2KSk7XG4gICAgICAgIGlmIChtc2cgPT09ICdfX0RPTkVfXycpIHtcbiAgICAgICAgICBsb2cudGV4dENvbnRlbnQgKz0gJ+KckyBSZWFkeS5cXG4nO1xuICAgICAgICAgIF9yZW5kZXJDYXBhYmlsaXR5VGllcnMoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgbG9nLnRleHRDb250ZW50ICs9IG1zZyArICdcXG4nO1xuICAgICAgICBsb2cuc2Nyb2xsVG9wID0gbG9nLnNjcm9sbEhlaWdodDtcbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChlcnIgJiYgZXJyLm5hbWUgPT09ICdBYm9ydEVycm9yJykgbG9nLnRleHRDb250ZW50ICs9ICfilqAgRG93bmxvYWQgY2FuY2VsbGVkLlxcbic7XG4gICAgZWxzZSBsb2cudGV4dENvbnRlbnQgKz0gJ+KclyBEb3dubG9hZCBmYWlsZWQgLSBjaGVjayB5b3VyIGNvbm5lY3Rpb24gYW5kIHRyeSBhZ2Fpbi5cXG4nO1xuICB9IGZpbmFsbHkge1xuICAgIF9wcmVmZXRjaEFib3J0ID0gbnVsbDtcbiAgICBfc2V0UHJlZmV0Y2hDYW5jZWwodGllcklkLCBmYWxzZSk7XG4gICAgaWYgKGJ1dHRvbikgeyBidXR0b24uZGlzYWJsZWQgPSBmYWxzZTsgYnV0dG9uLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkIG5vdyc7IH1cbiAgfVxufVxuXG4vLyBHYXRlIGEgY29udHJvbCBvbiBhIG1vZGVsIGNhcGFiaWxpdHkgKFwidGV4dFwiIHwgXCJ2aXNpb25cIikgZnJvbVxuLy8gL2FwaS9sbG0vY2FwYWJpbGl0aWVzLiBEaXNhYmxlcyB0aGUgZWxlbWVudCBhbmQgYXBwZW5kcyBhIGxpbmtlZCBleHBsYW5hdGlvblxuLy8gd2hlbiB0aGUgY2FwYWJpbGl0eSBpcyB1bmF2YWlsYWJsZTsgdXNlZCBieSBpbWFnZS1hbmFseXNpcyBjb250cm9scyAocGxhbiAxMSkuXG4vLyBSZXR1cm5zIHRoZSByZXNvbHZlZCBjYXBhYmlsaXRpZXMgb2JqZWN0LlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdhdGVPbkNhcGFiaWxpdHkoZWwsIGNhcGFiaWxpdHksIG1lc3NhZ2UpIHtcbiAgbGV0IGNhcDtcbiAgdHJ5IHtcbiAgICBjYXAgPSBhd2FpdCBmZXRjaCgnL2FwaS9sbG0vY2FwYWJpbGl0aWVzJykudGhlbihyID0+IHIuanNvbigpKTtcbiAgfSBjYXRjaCB7IGNhcCA9IHsgdGV4dDogZmFsc2UsIHZpc2lvbjogZmFsc2UsIGRldGFpbDogJycgfTsgfVxuICBjb25zdCBvayA9ICEhY2FwW2NhcGFiaWxpdHldO1xuICBlbC5kaXNhYmxlZCA9ICFvaztcbiAgbGV0IG5vdGUgPSBlbC5wYXJlbnRFbGVtZW50Py5xdWVyeVNlbGVjdG9yKCcuZ2F0ZS1ub3RlJyk7XG4gIGlmICghb2spIHtcbiAgICBpZiAoIW5vdGUpIHtcbiAgICAgIG5vdGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIG5vdGUuY2xhc3NOYW1lID0gJ2dhdGUtbm90ZSc7XG4gICAgICBlbC5wYXJlbnRFbGVtZW50Py5hcHBlbmRDaGlsZChub3RlKTtcbiAgICB9XG4gICAgbm90ZS5pbm5lckhUTUwgPSBgJHtlc2NIdG1sKG1lc3NhZ2UpfSA8YSBocmVmPVwiI1wiIG9uY2xpY2s9XCJvcGVuU2V0dGluZ3MoKTtyZXR1cm4gZmFsc2VcIj5PcGVuIFNldHRpbmdzPC9hPmA7XG4gIH0gZWxzZSBpZiAobm90ZSkge1xuICAgIG5vdGUucmVtb3ZlKCk7XG4gIH1cbiAgcmV0dXJuIGNhcDtcbn1cbiIsICIvLyBFU00gZW50cnkgcG9pbnQgLSB0aGUgc3RyYW5nbGVyLWZpZyBzZWFtIChXUzUgc3RlcCAyKS4gZXNidWlsZCBidW5kbGVzIHRoaXNcbi8vIG1vZHVsZSBncmFwaCBpbnRvIHN0YXRpYy9idW5kbGUuZXNtLmpzIChzZWUgc2NyaXB0cy9idWlsZC1lc20ubWpzLCBydW4gYnlcbi8vIGB5dXUtZGV2IGJ1bmRsZWApLiBFdmVyeXRoaW5nIHJlYWNoYWJsZSBmcm9tIGhlcmUgaXMgcmVhbCBFU00gKGltcG9ydC9leHBvcnQpO1xuLy8gdGhlIGNsYXNzaWMgZ2xvYmFsLXNjb3BlIHNjcmlwdHMgc3RpbGwgaW4gYnVuZGxlLmpzIGNhbGwgdGhlc2UgbW9kdWxlcyBhc1xuLy8gd2luZG93IGdsb2JhbHMsIHNvIHRoaXMgZW50cnkgcmUtZXhwb3NlcyBlYWNoIG1pZ3JhdGVkIG1vZHVsZSdzIHB1YmxpYyBzdXJmYWNlXG4vLyBvbiB3aW5kb3cgYXMgYSBjb21wYXRpYmlsaXR5IHNoaW0uXG4vL1xuLy8gTWlncmF0aW5nIGEgY2xhc3NpYyBjb25zdW1lciB0byBgaW1wb3J0YCBzaHJpbmtzIHRoZSBzaGltOiBvbmNlIG5vdGhpbmcgcmVhZHMgYVxuLy8gbmFtZSBvZmYgd2luZG93LCBkZWxldGUgaXRzIGxpbmUgYmVsb3cuIFdoZW4gYnVuZGxlLmpzIGlzIGVtcHR5LCB0aGlzIGZpbGUgaXNcbi8vIHRoZSB3aG9sZSBhcHAgYW5kIHRoZSBzaGltIGlzIGdvbmUuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0ICogYXMgZm9ybWF0IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IENvbG9yUGlja2VyIH0gZnJvbSAnLi9jb2xvcnBpY2tlci5qcyc7XG5pbXBvcnQgeyBQYW5lbE5hdiB9IGZyb20gJy4vcGFuZWxuYXYuanMnO1xuaW1wb3J0ICogYXMgam9icyBmcm9tICcuL2pvYnMuanMnO1xuaW1wb3J0IHsgX2J1aWxkTWVkaWFVcmwsIHNldHVwUmVjb3JkaW5nUHJldmlldyB9IGZyb20gJy4vcHJldmlldy5qcyc7XG5pbXBvcnQge1xuICBfc3luY1NvcnREaXJCdG4sIF9kaWFyaXphdGlvblJlYXNvbiwgX2RpYXJpemF0aW9uUmVhZGluZXNzLCBfZGlhcml6YXRpb25Ob3RlSHRtbCxcbiAgb3BlbkxvZywgY2xlYXJMb2csIGFwcGVuZExvZywgc2hvd1RvYXN0LCBuZXRFcnJNc2csIHJldmVhbEluRm9sZGVyLCBjb3B5VGV4dCxcbiAgY29sbGFwc2libGVDYXJkLFxufSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7XG4gIHNob3dBbGVydCwgY2xvc2VBbGVydE1vZGFsLCBzaG93Q29uZmlybSwgX2NvbmZpcm1DYW5jZWwsXG4gIG9wZW5BY3Rpb25zTW9kYWwsIGNsb3NlQWN0aW9uc01vZGFsLCB0b3Btb3N0VmlzaWJsZU1vZGFsLCBfbWVudUFycm93S2V5ZG93bixcbiAgaXNIYW1idXJnZXJPcGVuLCB0b2dnbGVIYW1idXJnZXIsIGNsb3NlSGFtYnVyZ2VyLFxuICBvcGVuQ29udHJvbHNNb2RhbCwgY2xvc2VDb250cm9sc01vZGFsLFxuICBvcGVuRGlmZk1vZGFsLCBfZGlmZkRpc2NhcmQsXG4gIG9wZW5GaWVsZEVkaXRNb2RhbCwgY2xvc2VGaWVsZEVkaXRNb2RhbCxcbiAgY2xvc2VLZWJhYiwgc2hvd0tlYmFiLCBpbml0UmVzaXplLCBfYXBwbHlQcmVyZXFXYXJuaW5ncywgc2hvd1VuZG9Ub2FzdCxcbiAgcGxheWJhY2tSYXRlUHJlZiwgYXBwbHlQbGF5YmFja1JhdGUsIGluaXRQbGF5YmFja1JhdGUsXG59IGZyb20gJy4vdWkuanMnO1xuaW1wb3J0IHtcbiAgb3BlbkdldHRpbmdTdGFydGVkTW9kYWwsIGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCxcbiAgb3BlbkFib3V0TW9kYWwsIGNsb3NlQWJvdXRNb2RhbCxcbiAgb3BlbkhlbHBNb2RhbCwgY2xvc2VIZWxwTW9kYWwsXG4gIG9wZW5HbG9zc2FyeU1vZGFsLCBjbG9zZUdsb3NzYXJ5TW9kYWwsIF9maWx0ZXJHbG9zc2FyeSxcbn0gZnJvbSAnLi9oZWxwbW9kYWxzLmpzJztcbi8vIHNob3J0Y3V0cy5qcyBoYXMgbm8gcHVibGljIHN1cmZhY2UgKGl0cyBvbmx5IGV4cG9ydCBpcyB0aGUga2V5ZG93biBsaXN0ZW5lclxuLy8gcmVnaXN0cmF0aW9uKSAtIGEgYmFyZSBzaWRlLWVmZmVjdCBpbXBvcnQgcmVnaXN0ZXJzIHRoZSBnbG9iYWwgaGFuZGxlclxuLy8gd2l0aG91dCBhZGRpbmcgYW55dGhpbmcgdG8gdGhlIHdpbmRvdyBzaGltLlxuaW1wb3J0ICcuL3Nob3J0Y3V0cy5qcyc7XG5pbXBvcnQge1xuICBfZW5zdXJlTW9kZWxDYXRhbG9nLCByZWZyZXNoTW9kZWxDYXRhbG9nLFxuICBfdXBkYXRlTGxtQ2FwYWJpbGl0aWVzLCBfcmVuZGVyQ2FwYWJpbGl0eVRpZXJzLFxuICBnYXRlT25DYXBhYmlsaXR5LFxufSBmcm9tICcuL21vZGVsY2F0YWxvZy5qcyc7XG5cbndpbmRvdy5BcHBTdGF0ZSA9IEFwcFN0YXRlO1xuT2JqZWN0LmFzc2lnbih3aW5kb3csIGZvcm1hdCk7XG53aW5kb3cuQ29sb3JQaWNrZXIgPSBDb2xvclBpY2tlcjtcbndpbmRvdy5QYW5lbE5hdiA9IFBhbmVsTmF2O1xuLy8gdXRpbHMuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyLCBvciAoY2xlYXJMb2csIF9kaWFyaXphdGlvblJlYXNvbiwgX2RpYXJpemF0aW9uTm90ZUh0bWwpIGFcbi8vIHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHkgcGFnZS5ldmFsdWF0ZS4gdG9nZ2xlTG9nIGFuZCBpc0NhcmRDb2xsYXBzZWQgZHJvcHBlZDpcbi8vIHRoZWlyIG9ubHkgY29uc3VtZXJzIHdlcmUgdXRpbHMuanMncyBvd24gaW5saW5lIGhhbmRsZXIgKG5vdyBhZGRFdmVudExpc3RlbmVyKVxuLy8gYW5kIGl0cyBvd24gY29sbGFwc2libGVDYXJkLCByZXNwZWN0aXZlbHkuXG53aW5kb3cuX3N5bmNTb3J0RGlyQnRuID0gX3N5bmNTb3J0RGlyQnRuO1xud2luZG93Ll9kaWFyaXphdGlvblJlYXNvbiA9IF9kaWFyaXphdGlvblJlYXNvbjtcbndpbmRvdy5fZGlhcml6YXRpb25SZWFkaW5lc3MgPSBfZGlhcml6YXRpb25SZWFkaW5lc3M7XG53aW5kb3cuX2RpYXJpemF0aW9uTm90ZUh0bWwgPSBfZGlhcml6YXRpb25Ob3RlSHRtbDtcbndpbmRvdy5vcGVuTG9nID0gb3BlbkxvZztcbndpbmRvdy5jbGVhckxvZyA9IGNsZWFyTG9nO1xud2luZG93LmFwcGVuZExvZyA9IGFwcGVuZExvZztcbndpbmRvdy5zaG93VG9hc3QgPSBzaG93VG9hc3Q7XG53aW5kb3cubmV0RXJyTXNnID0gbmV0RXJyTXNnO1xud2luZG93LnJldmVhbEluRm9sZGVyID0gcmV2ZWFsSW5Gb2xkZXI7XG53aW5kb3cuY29weVRleHQgPSBjb3B5VGV4dDtcbndpbmRvdy5jb2xsYXBzaWJsZUNhcmQgPSBjb2xsYXBzaWJsZUNhcmQ7XG4vLyBqb2JzLmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBldmVyeSBleHBvcnQgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyIG9yIGEgc3RpbGwtcHJlc2VudCBpbmxpbmUgaGFuZGxlciwgc28gbm9uZSBvZiB0aGVzZSBjYW5cbi8vIGJlIGRyb3BwZWQgeWV0LiBJdHMgaGFuZGZ1bCBvZiBtdXRhYmxlIHNoYXJlZC1zdGF0ZSBnbG9iYWxzIChfam9iU3RlcERlZnMsXG4vLyBfYWN0aXZlRVMsIGV0Yy4pIGFyZSBOT1QgaGVyZSAtIGpvYnMuanMgd2lyZXMgdGhvc2Ugb250byB3aW5kb3cgaXRzZWxmIHZpYVxuLy8gbGl2ZSBnZXQvc2V0IGFjY2Vzc29ycywgc2luY2UgYSBwbGFpbiBzbmFwc2hvdCB3b3VsZCBnbyBzdGFsZSBvbiByZWFzc2lnbm1lbnQuXG5PYmplY3QuYXNzaWduKHdpbmRvdywgam9icyk7XG4vLyBwcmV2aWV3LmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBzZXR1cFJlY29yZGluZ1ByZXZpZXcgaGFzIGNsYXNzaWMgY29uc3VtZXJzXG4vLyAoY2xpcGNyZWF0ZS5qcywgdmlkZW9zLmpzLCBzcGxpdC5qcywgZXhwb3J0ZWRpdG9yLmpzKTsgX2J1aWxkTWVkaWFVcmwgaGFzIG5vXG4vLyBKUyBjb25zdW1lciBsZWZ0IGJ1dCB0ZXN0cy91aS90ZXN0X3VpX3ZpZGVvLnB5IGV2YWx1YXRlcyBpdCBhcyBhIHBhZ2UgZ2xvYmFsLlxud2luZG93Ll9idWlsZE1lZGlhVXJsID0gX2J1aWxkTWVkaWFVcmw7XG53aW5kb3cuc2V0dXBSZWNvcmRpbmdQcmV2aWV3ID0gc2V0dXBSZWNvcmRpbmdQcmV2aWV3O1xuLy8gdWkuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyLCBhbiBhbHJlYWR5LUVTTSBjYWxsZXIgKGpvYnMuanMvcGFuZWxuYXYuanMnc1xuLy8gd2luZG93LnNob3dDb25maXJtKSwgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUuIF9jb25maXJtT2ssXG4vLyBfZGlmZkFjY2VwdE5ldywgX2RpZmZBY2NlcHRFZGl0IGFuZCBfZmllbGRFZGl0U2F2ZSBkcm9wcGVkOiB0aGVpciBvbmx5XG4vLyBjb25zdW1lcnMgd2VyZSB1aS5qcydzIG93biBpbmxpbmUgaGFuZGxlcnMsIG5vdyBhZGRFdmVudExpc3RlbmVyIGluc2lkZVxuLy8gdWkuanMgaXRzZWxmLCBzbyBub3RoaW5nIG91dHNpZGUgdGhlIG1vZHVsZSBuZWVkcyB0aGVtIG9mZiB3aW5kb3cgYW55bW9yZS5cbndpbmRvdy5zaG93QWxlcnQgPSBzaG93QWxlcnQ7XG53aW5kb3cuY2xvc2VBbGVydE1vZGFsID0gY2xvc2VBbGVydE1vZGFsO1xud2luZG93LnNob3dDb25maXJtID0gc2hvd0NvbmZpcm07XG53aW5kb3cuX2NvbmZpcm1DYW5jZWwgPSBfY29uZmlybUNhbmNlbDtcbndpbmRvdy5vcGVuQWN0aW9uc01vZGFsID0gb3BlbkFjdGlvbnNNb2RhbDtcbndpbmRvdy5jbG9zZUFjdGlvbnNNb2RhbCA9IGNsb3NlQWN0aW9uc01vZGFsO1xud2luZG93LnRvcG1vc3RWaXNpYmxlTW9kYWwgPSB0b3Btb3N0VmlzaWJsZU1vZGFsO1xud2luZG93Ll9tZW51QXJyb3dLZXlkb3duID0gX21lbnVBcnJvd0tleWRvd247XG53aW5kb3cuaXNIYW1idXJnZXJPcGVuID0gaXNIYW1idXJnZXJPcGVuO1xud2luZG93LnRvZ2dsZUhhbWJ1cmdlciA9IHRvZ2dsZUhhbWJ1cmdlcjtcbndpbmRvdy5jbG9zZUhhbWJ1cmdlciA9IGNsb3NlSGFtYnVyZ2VyO1xud2luZG93Lm9wZW5Db250cm9sc01vZGFsID0gb3BlbkNvbnRyb2xzTW9kYWw7XG53aW5kb3cuY2xvc2VDb250cm9sc01vZGFsID0gY2xvc2VDb250cm9sc01vZGFsO1xud2luZG93Lm9wZW5EaWZmTW9kYWwgPSBvcGVuRGlmZk1vZGFsO1xud2luZG93Ll9kaWZmRGlzY2FyZCA9IF9kaWZmRGlzY2FyZDtcbndpbmRvdy5vcGVuRmllbGRFZGl0TW9kYWwgPSBvcGVuRmllbGRFZGl0TW9kYWw7XG53aW5kb3cuY2xvc2VGaWVsZEVkaXRNb2RhbCA9IGNsb3NlRmllbGRFZGl0TW9kYWw7XG53aW5kb3cuY2xvc2VLZWJhYiA9IGNsb3NlS2ViYWI7XG53aW5kb3cuc2hvd0tlYmFiID0gc2hvd0tlYmFiO1xud2luZG93LmluaXRSZXNpemUgPSBpbml0UmVzaXplO1xud2luZG93Ll9hcHBseVByZXJlcVdhcm5pbmdzID0gX2FwcGx5UHJlcmVxV2FybmluZ3M7XG53aW5kb3cuc2hvd1VuZG9Ub2FzdCA9IHNob3dVbmRvVG9hc3Q7XG53aW5kb3cucGxheWJhY2tSYXRlUHJlZiA9IHBsYXliYWNrUmF0ZVByZWY7XG53aW5kb3cuYXBwbHlQbGF5YmFja1JhdGUgPSBhcHBseVBsYXliYWNrUmF0ZTtcbndpbmRvdy5pbml0UGxheWJhY2tSYXRlID0gaW5pdFBsYXliYWNrUmF0ZTtcbi8vIGhlbHBtb2RhbHMuanMgLSBldmVyeSBuYW1lIGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljIChidW5kbGUuanMpXG4vLyBjb25zdW1lciAoYm9vdC5qcywgdmlkZW9zLmpzLCBzaG9ydGN1dHMuanMsIHNldHRpbmdzLmpzIGNhbGwgdGhlc2UgYXMgYmFyZVxuLy8gZ2xvYmFscykgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUsIHNvIG5vbmUgY2FuIGJlIGRyb3BwZWQgeWV0Llxud2luZG93Lm9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsID0gb3BlbkdldHRpbmdTdGFydGVkTW9kYWw7XG53aW5kb3cuY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsID0gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsO1xud2luZG93Lm9wZW5BYm91dE1vZGFsID0gb3BlbkFib3V0TW9kYWw7XG53aW5kb3cuY2xvc2VBYm91dE1vZGFsID0gY2xvc2VBYm91dE1vZGFsO1xud2luZG93Lm9wZW5IZWxwTW9kYWwgPSBvcGVuSGVscE1vZGFsO1xud2luZG93LmNsb3NlSGVscE1vZGFsID0gY2xvc2VIZWxwTW9kYWw7XG53aW5kb3cub3Blbkdsb3NzYXJ5TW9kYWwgPSBvcGVuR2xvc3NhcnlNb2RhbDtcbndpbmRvdy5jbG9zZUdsb3NzYXJ5TW9kYWwgPSBjbG9zZUdsb3NzYXJ5TW9kYWw7XG53aW5kb3cuX2ZpbHRlckdsb3NzYXJ5ID0gX2ZpbHRlckdsb3NzYXJ5O1xuLy8gbW9kZWxjYXRhbG9nLmpzIC0gZXZlcnkgbmFtZSBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpYyAoYnVuZGxlLmpzKVxuLy8gY29uc3VtZXI6IHNldHRpbmdzLmpzIGNhbGxzIF9lbnN1cmVNb2RlbENhdGFsb2cvcmVmcmVzaE1vZGVsQ2F0YWxvZy9cbi8vIF91cGRhdGVMbG1DYXBhYmlsaXRpZXMvX3JlbmRlckNhcGFiaWxpdHlUaWVycyBhcyBiYXJlIGdsb2JhbHMsIG1vZGVsZG93bmxvYWQuanNcbi8vIGNoZWNrcy9jYWxscyBfdXBkYXRlTGxtQ2FwYWJpbGl0aWVzL19yZW5kZXJDYXBhYmlsaXR5VGllcnMsIGFuZCBjbGlwcy5qcyBjYWxsc1xuLy8gZ2F0ZU9uQ2FwYWJpbGl0eSAoYWxzbyByZWFkIGRpcmVjdGx5IGJ5IHRlc3RzL3VpL3Rlc3RfdWlfbW9kZWxfY2F0YWxvZy5weSB2aWFcbi8vIHBhZ2UuZXZhbHVhdGUpLiBwcmVmZXRjaE1vZGVsIGFuZCBkb3dubG9hZEdndWZNb2RlbCBkcm9wcGVkOiBib3RoIGFyZSB3aXJlZFxuLy8gaW50ZXJuYWxseSB2aWEgYWRkRXZlbnRMaXN0ZW5lci9kYXRhLSogZGVsZWdhdGlvbiBhbmQgaGF2ZSBubyBvdXRzaWRlIGNhbGxlci5cbndpbmRvdy5fZW5zdXJlTW9kZWxDYXRhbG9nID0gX2Vuc3VyZU1vZGVsQ2F0YWxvZztcbndpbmRvdy5yZWZyZXNoTW9kZWxDYXRhbG9nID0gcmVmcmVzaE1vZGVsQ2F0YWxvZztcbndpbmRvdy5fdXBkYXRlTGxtQ2FwYWJpbGl0aWVzID0gX3VwZGF0ZUxsbUNhcGFiaWxpdGllcztcbndpbmRvdy5fcmVuZGVyQ2FwYWJpbGl0eVRpZXJzID0gX3JlbmRlckNhcGFiaWxpdHlUaWVycztcbndpbmRvdy5nYXRlT25DYXBhYmlsaXR5ID0gZ2F0ZU9uQ2FwYWJpbGl0eTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7O0FBTU8sTUFBTSxXQUFXO0FBQUEsSUFDdEIsZUFBcUI7QUFBQSxJQUNyQixjQUFxQjtBQUFBLElBQ3JCLFFBQXFCLENBQUM7QUFBQSxJQUN0QixVQUFxQixDQUFDO0FBQUE7QUFBQSxJQUN0QixpQkFBcUI7QUFBQTtBQUFBLElBQ3JCLE9BQXFCLENBQUM7QUFBQSxJQUN0QixpQkFBcUIsQ0FBQztBQUFBLElBQ3RCLFVBQXFCLENBQUM7QUFBQSxJQUN0QixVQUFxQixDQUFDO0FBQUEsSUFDdEIsaUJBQXFCO0FBQUEsSUFDckIsZ0JBQXFCLENBQUM7QUFBQSxJQUN0Qix1QkFBdUI7QUFBQSxJQUN2QixpQkFBcUI7QUFBQSxJQUNyQixrQkFBcUI7QUFBQSxJQUNyQixhQUFxQixvQkFBSSxJQUFJO0FBQUE7QUFBQSxJQUM3QixVQUFxQjtBQUFBO0FBQUEsSUFDckIsWUFBcUI7QUFBQSxJQUNyQixjQUFxQjtBQUFBLElBQ3JCLGFBQXFCO0FBQUEsSUFDckIsV0FBcUI7QUFBQSxJQUNyQixjQUFxQjtBQUFBO0FBQUEsSUFDckIsYUFBcUI7QUFBQSxJQUNyQixjQUFxQixvQkFBSSxJQUFJO0FBQUE7QUFBQSxJQUM3QixpQkFBcUIsb0JBQUksSUFBSTtBQUFBLElBQzdCLGtCQUFxQjtBQUFBO0FBQUEsSUFDckIsc0JBQXNCO0FBQUE7QUFBQSxJQUN0QixpQkFBcUI7QUFBQSxJQUNyQixnQkFBcUI7QUFBQSxJQUNyQixVQUFxQixDQUFDO0FBQUE7QUFBQTtBQUFBLElBRXRCLHFCQUFxQjtBQUFBLElBQ3JCLGlCQUFxQjtBQUFBLElBQ3JC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YTtBQUNwQixTQUFPLFlBQVk7QUFDbkIsU0FBTyxhQUFhO0FBQ3BCLFNBQU8sdUJBQXVCO0FBQzlCLFNBQU8sZ0JBQWdCO0FBQ3ZCLFNBQU8sbUJBQW1CO0FBQzFCLFNBQU8sb0JBQW9CO0FBQzNCLFNBQU8sbUJBQW1CO0FBSTFCLFNBQU8sMEJBQTBCO0FBQ2pDLFNBQU8sMkJBQTJCO0FBQ2xDLFNBQU8saUJBQWlCO0FBQ3hCLFNBQU8sa0JBQWtCO0FBQ3pCLFNBQU8sZ0JBQWdCO0FBQ3ZCLFNBQU8saUJBQWlCO0FBQ3hCLFNBQU8sb0JBQW9CO0FBQzNCLFNBQU8scUJBQXFCO0FBQzVCLFNBQU8sa0JBQWtCO0FBUXpCLFNBQU8sc0JBQXNCO0FBQzdCLFNBQU8sc0JBQXNCO0FBQzdCLFNBQU8seUJBQXlCO0FBQ2hDLFNBQU8seUJBQXlCO0FBQ2hDLFNBQU8sbUJBQW1COyIsCiAgIm5hbWVzIjogWyJlbCIsICJfQkdfRElTTUlTU19NT0RBTFMiLCAiX3dpcmVNb2RhbEJnRGlzbWlzc2FscyIsICJfd2lyZU1vZGFsQnV0dG9ucyIsICJfd2lyZUhhbWJ1cmdlckhhbmRsZXJzIl0KfQo=
