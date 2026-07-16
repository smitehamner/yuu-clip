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
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3RhdGUuanMiLCAiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgImpvYnMuanMiLCAicHJldmlldy5qcyIsICJ1dGlscy5qcyIsICJ1aS5qcyIsICJoZWxwbW9kYWxzLmpzIiwgInNob3J0Y3V0cy5qcyIsICJtYWluLmVzbS5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgYXBwbGljYXRpb24gc3RhdGU6IHRoZSBzaW5nbGUgQXBwU3RhdGUgb2JqZWN0IGV2ZXJ5IGZlYXR1cmUgbW9kdWxlIHJlYWRzL3dyaXRlcy5cbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IGNvdmVyZWQgaW5kaXJlY3RseSBieSB0aGUgdGVzdF91aV8qLnB5IHN1aXRlc1xuLy8g4pSA4pSAIHNoYXJlZCBhcHBsaWNhdGlvbiBzdGF0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIE11dGFibGUgc3RhdGUgc2hhcmVkIGFjcm9zcyBmZWF0dXJlIG1vZHVsZXMuIENlbnRyYWxpemVkIGluIG9uZSBleHBsaWNpdCBvYmplY3Rcbi8vIHNvIGNyb3NzLW1vZHVsZSByZWFkcy93cml0ZXMgYXJlIGdyZXBwYWJsZSBhbmQgb2J2aW91c2x5IHNoYXJlZCwgcmF0aGVyIHRoYW5cbi8vIHNjYXR0ZXJlZCBiYXJlIGdsb2JhbHMgdGhhdCBsb29rIGxpa2UgbW9kdWxlIGxvY2FscyBhdCB0aGUgY2FsbCBzaXRlLlxuZXhwb3J0IGNvbnN0IEFwcFN0YXRlID0ge1xuICBhY3RpdmVWaWRlb0lkOiAgICAgICBudWxsLFxuICBhY3RpdmVDbGlwSWQ6ICAgICAgICBudWxsLFxuICB2aWRlb3M6ICAgICAgICAgICAgICBbXSxcbiAgc2Vzc2lvbnM6ICAgICAgICAgICAgW10sICAgICAgIC8vIGdyb3VwZWQgcGxheSBzZXNzaW9ucyAoUmVjb3JkaW5nU2Vzc2lvbiByb3dzKVxuICBhY3RpdmVTZXNzaW9uSWQ6ICAgICBudWxsLCAgICAgLy8gc2Vzc2lvbiB3aG9zZSBkZXRhaWwgdmlldyBpcyBvcGVuLCBvciBudWxsXG4gIGNsaXBzOiAgICAgICAgICAgICAgIFtdLFxuICBhbmFseXplUHJvZmlsZXM6ICAgICBbXSxcbiAgY29udGV4dHM6ICAgICAgICAgICAgW10sXG4gIGhvdFdvcmRzOiAgICAgICAgICAgIFtdLFxuICBfaG90V29yZHNMb2FkZWQ6ICAgICBmYWxzZSxcbiAgc2Vuc2l0aXZlVGVybXM6ICAgICAgW10sXG4gIF9zZW5zaXRpdmVUZXJtc0xvYWRlZDogZmFsc2UsXG4gIGFuYWx5emVGaWxlbmFtZTogICAgIG51bGwsXG4gIGVkaXRpbmdDb250ZXh0SWQ6ICAgIG51bGwsXG4gIGNsaXBGaWx0ZXJzOiAgICAgICAgIG5ldyBTZXQoKSwgIC8vIGFjdGl2ZSBmaWx0ZXIgdG9rZW5zOyBlbXB0eSA9IHNob3cgYWxsXG4gIGNsaXBLaW5kOiAgICAgICAgICAgICdjbGlwJywgICAgICAvLyBjYW5kaWRhdGUgdHlwZSBzaG93bjogJ2NsaXAnIHwgJ3NjZW5lJyAoc2VydmVyLXNpZGUgZmlsdGVyKVxuICBjbGlwU2VhcmNoOiAgICAgICAgICAnJyxcbiAgY2xpcFNjb3JlTWluOiAgICAgICAgMCxcbiAgdmlkZW9TZWFyY2g6ICAgICAgICAgJycsXG4gIHZpZGVvU29ydDogICAgICAgICAgICdyZWNlbnQnLFxuICB2aWRlb1NvcnREaXI6ICAgICAgICAnZGVzYycsICAvLyAnZGVzYycgPSB0aGUgc29ydCBvcHRpb24ncyBuYXR1cmFsIG9yZGVyOyAnYXNjJyByZXZlcnNlcyBpdFxuICBjbGlwU29ydERpcjogICAgICAgICAnZGVzYycsXG4gIHZpZGVvRmlsdGVyczogICAgICAgIG5ldyBTZXQoKSwgIC8vIGFjdGl2ZSB2aWRlbyBmaWx0ZXIgdG9rZW5zOyBlbXB0eSA9IHNob3cgYWxsXG4gIHNlbGVjdGVkQ2xpcElkczogICAgIG5ldyBTZXQoKSxcbiAgbGFzdFN0YXR1c0NoYW5nZTogICAgbnVsbCwgLy8ge2NsaXBJZCwgZnJvbVN0YXR1cywgdGltZXJ9XG4gIGxhc3RCdWxrU3RhdHVzQ2hhbmdlOiBudWxsLCAvLyB7cHJldmlvdXM6IHtjbGlwSWQ6IGZyb21TdGF0dXN9LCB0aW1lcn1cbiAgY29uZmlybUNhbGxiYWNrOiAgICAgbnVsbCxcbiAgYWN0aXZlQ2xpcERhdGE6ICAgICAgbnVsbCxcbiAgY2xpcEpvYnM6ICAgICAgICAgICAge30sICAgLy8gY2xpcElkIC0+IHtvcH0gZm9yIGEgcGVyLWNsaXAgYXN5bmMgam9iIGluIGZsaWdodCAoYW5hbHl6ZS1mcmFtZXMpLCBzbyBpdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW5kaWNhdG9yIHN1cnZpdmVzIGEgcmVuZGVyRGV0YWlsIHJlYnVpbGQgLyBjbGlwIHN3aXRjaCAoc3RhdGUsIG5vdCBhIERPTSBub2RlKVxuICBhY3RpdmVNZWRpYUZpbGVuYW1lOiBudWxsLFxuICBhY3RpdmVWaWRlb0RhdGE6ICAgICBudWxsLFxuICBib290UmVzdG9yZURvbmU6ICAgICBmYWxzZSxcbiAgZXhwb3J0RGlyOiAgICAgICAgICAgbnVsbCxcbiAgcmVlbHNEaXI6ICAgICAgICAgICAgbnVsbCxcbiAgY2FuUmV2ZWFsOiAgICAgICAgICAgZmFsc2UsXG59O1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUHVyZSBmb3JtYXR0ZXJzIGFuZCBzY29yZSBoZWxwZXJzOiBubyBET00sIG5vIGZldGNoLiBIVE1MLWVzY2FwZSwgQVBJLWVycm9yIHRleHQsXHJcbi8vICAgZHVyYXRpb24vZGF0ZS9vZmZzZXQgZm9ybWF0dGluZywgdmlkZW8tc3RhdHVzIGxhYmVscywgYW5kIHRoZSBzY29yZSBjb2xvci9pY29uIGVuY29kaW5nLlxyXG4vLyAgIEFQSTogbm9uZSAoY2xpZW50LW9ubHkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5XHJcbi8vIOKUgOKUgCBzY29yZSB1dGlscyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZnVuY3Rpb24gX3Njb3JlSWNvbihzY29yZSkge1xyXG4gIGNvbnN0IGNvbG9yID0gc2NvcmUgPj0gMC43ID8gJ3ZhcigtLWdyZWVuKScgOiBzY29yZSA+PSAwLjQgPyAndmFyKC0td2FybmluZyknIDogJ3ZhcigtLW11dGVkKSc7XHJcbiAgcmV0dXJuIGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Y29sb3J9O2ZvbnQtc2l6ZToxMHB4XCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+JiMxMTA4ODs8L3NwYW4+YDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2xlcnBDb2xvcihjMSwgYzIsIHQpIHtcclxuICBjb25zdCBoID0gYyA9PiBbcGFyc2VJbnQoYy5zbGljZSgxLDMpLDE2KSwgcGFyc2VJbnQoYy5zbGljZSgzLDUpLDE2KSwgcGFyc2VJbnQoYy5zbGljZSg1LDcpLDE2KV07XHJcbiAgY29uc3QgW3IxLGcxLGIxXSA9IGgoYzEpLCBbcjIsZzIsYjJdID0gaChjMik7XHJcbiAgcmV0dXJuIGByZ2IoJHtNYXRoLnJvdW5kKHIxKyhyMi1yMSkqdCl9LCR7TWF0aC5yb3VuZChnMSsoZzItZzEpKnQpfSwke01hdGgucm91bmQoYjErKGIyLWIxKSp0KX0pYDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3Njb3JlQm9yZGVyQ29sb3Ioc2NvcmUsIGlzUmVqZWN0ZWQpIHtcclxuICBpZiAoaXNSZWplY3RlZCkgcmV0dXJuICd2YXIoLS1tdXRlZCknO1xyXG4gIGNvbnN0IHN0b3BzID0gW1swLCcjNmI2YjgwJ10sWzAuMywnIzRmYzNmNyddLFswLjUsJyM0Y2FmN2QnXSxbMC43LCcjZjBjMDYwJ10sWzEuMCwnI2Y3YTg1YSddXTtcclxuICBmb3IgKGxldCBpID0gMTsgaSA8IHN0b3BzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBpZiAoc2NvcmUgPD0gc3RvcHNbaV1bMF0pIHtcclxuICAgICAgY29uc3QgdCA9IChzY29yZSAtIHN0b3BzW2ktMV1bMF0pIC8gKHN0b3BzW2ldWzBdIC0gc3RvcHNbaS0xXVswXSk7XHJcbiAgICAgIHJldHVybiBfbGVycENvbG9yKHN0b3BzW2ktMV1bMV0sIHN0b3BzW2ldWzFdLCB0KTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHN0b3BzW3N0b3BzLmxlbmd0aC0xXVsxXTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3NvcnRTY29yZShjbGlwKSB7XHJcbiAgY29uc3Qgc29ydCA9IHdpbmRvdy5fY2xpcHNTb3J0UGFyYW0oKTtcclxuICBpZiAoc29ydCA9PT0gJ2Z1bm55JykgICAgcmV0dXJuIGNsaXAuc2NvcmVfZnVubnk7XHJcbiAgaWYgKHNvcnQgPT09ICdkcmFtYXRpYycpIHJldHVybiBjbGlwLnNjb3JlX2RyYW1hdGljO1xyXG4gIGlmIChzb3J0ID09PSAnYWN0aW9uJykgICByZXR1cm4gY2xpcC5zY29yZV9hY3Rpb247XHJcbiAgaWYgKHNvcnQgPT09ICd2aXN1YWwnKSAgIHJldHVybiBjbGlwLnNjb3JlX3Zpc3VhbDtcclxuICBpZiAoc29ydCA9PT0gJ2xhdWdoJykgICAgcmV0dXJuIGNsaXAuc2NvcmVfbGF1Z2g7XHJcbiAgcmV0dXJuIGNsaXAuc2NvcmVfb3ZlcmFsbDtcclxufVxyXG5cclxuLy8g4pSA4pSAIGZvcm1hdCB1dGlscyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuY29uc3QgX1ZJREVPX1NUQVRVU19ESVNQTEFZID0ge1xyXG4gIHBlbmRpbmc6ICdOb3QgYW5hbHl6ZWQnLCBwcm9iZWQ6ICdJbnNwZWN0ZWQnLCBsYWJlbGVkOiAnVHJhY2tzIGFzc2lnbmVkJyxcclxuICBleHRyYWN0aW5nOiAnRXh0cmFjdGluZycsIHRyYW5zY3JpYmluZzogJ1RyYW5zY3JpYmluZycsIHRyYW5zY3JpYmVkOiAnVHJhbnNjcmliZWQnLFxyXG4gIHNlZ21lbnRlZDogJ0NsaXBzIGdlbmVyYXRlZCcsIGRvbmU6ICdBbmFseXplZCcsIGZhaWxlZDogJ0FuYWx5c2lzIGludGVycnVwdGVkJyxcclxufTtcclxuZnVuY3Rpb24gX2ZtdFZpZGVvU3RhdHVzKHMpIHsgcmV0dXJuIF9WSURFT19TVEFUVVNfRElTUExBWVtzXSB8fCBzOyB9XHJcblxyXG5mdW5jdGlvbiBfbXNUb0htcyhtcykge1xyXG4gIGNvbnN0IHMgPSBNYXRoLmZsb29yKG1zIC8gMTAwMCk7XHJcbiAgaWYgKHMgPCA2MCkgcmV0dXJuIGAke3N9c2A7XHJcbiAgY29uc3QgbSA9IE1hdGguZmxvb3IocyAvIDYwKSwgc2VjID0gcyAlIDYwO1xyXG4gIGlmIChtIDwgNjApIHJldHVybiBgJHttfW0gJHtTdHJpbmcoc2VjKS5wYWRTdGFydCgyLCAnMCcpfXNgO1xyXG4gIGNvbnN0IGggPSBNYXRoLmZsb29yKG0gLyA2MCksIG1pbiA9IG0gJSA2MDtcclxuICByZXR1cm4gYCR7aH1oICR7U3RyaW5nKG1pbikucGFkU3RhcnQoMiwgJzAnKX1tYDtcclxufVxyXG5cclxuZnVuY3Rpb24gcGx1cmFsKGNvdW50LCBzaW5ndWxhciwgcGx1cmFsRm9ybSkge1xyXG4gIHJldHVybiBgJHtjb3VudH0gJHtjb3VudCA9PT0gMSA/IHNpbmd1bGFyIDogKHBsdXJhbEZvcm0gfHwgc2luZ3VsYXIgKyAncycpfWA7XHJcbn1cclxuXHJcbi8vIFN0YW5kYXJkIGd1YXJkIGZvciBhbnkgY29tcHV0ZWQgbnVtYmVyIHNob3duIHRvIHRoZSB1c2VyOiByZXR1cm5zICp2YWx1ZSpcclxuLy8gb25seSB3aGVuIGl0IGlzIGEgZmluaXRlIG51bWJlciwgb3RoZXJ3aXNlIGEgcGxhaW4tRW5nbGlzaCAqZmFsbGJhY2sqLiBOYU5cclxuLy8gb3IgSW5maW5pdHkgLSB1c3VhbGx5IGZyb20gYXJpdGhtZXRpYyBvbiBtaXNzaW5nL3BhcnRpYWwgZGF0YSAtIG11c3QgbmV2ZXJcclxuLy8gcmVhY2ggdGhlIFVJIGFzIHRoZSBsaXRlcmFsIFwiTmFOXCIvXCJJbmZpbml0eVwiLiBVc2UgdGhpcyAob3IgZm10RHVyYXRpb24pIGF0XHJcbi8vIGV2ZXJ5IGRpc3BsYXkgc2l0ZSB0aGF0IGZvcm1hdHMgYSBkZXJpdmVkIG51bWJlci5cclxuZnVuY3Rpb24gZmluaXRlT3IodmFsdWUsIGZhbGxiYWNrID0gJ04vQScpIHtcclxuICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKHZhbHVlKSA/IHZhbHVlIDogZmFsbGJhY2s7XHJcbn1cclxuXHJcbi8vIEh1bWFuLXJlYWRhYmxlIGNsaXAvc2VnbWVudCBsZW5ndGguIFJldHVybnMgKmZhbGxiYWNrKiBmb3IgYSBub24tZmluaXRlXHJcbi8vIGlucHV0IChlLmcuIGEgY2xpcCBtaXNzaW5nIGl0cyBzdGFydC9lbmQgdGltZXMpIHJhdGhlciB0aGFuIFwiTmFOIHNlY1wiLlxyXG5mdW5jdGlvbiBmbXREdXJhdGlvbihzZWNvbmRzLCBmYWxsYmFjayA9ICd1bmtub3duJykge1xyXG4gIGlmICghTnVtYmVyLmlzRmluaXRlKHNlY29uZHMpKSByZXR1cm4gZmFsbGJhY2s7XHJcbiAgcmV0dXJuIHNlY29uZHMgPj0gNjAgPyBgJHtNYXRoLnJvdW5kKHNlY29uZHMgLyA2MCl9IG1pbmAgOiBgJHtNYXRoLnJvdW5kKHNlY29uZHMpfSBzZWNgO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0cnVuY2F0ZSh0ZXh0LCBtYXgpIHtcclxuICByZXR1cm4gdGV4dC5sZW5ndGggPiBtYXggPyB0ZXh0LnNsaWNlKDAsIG1heCAtIDEpICsgJ+KApicgOiB0ZXh0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBlc2NIdG1sKHMpIHtcclxuICByZXR1cm4gU3RyaW5nKHMpLnJlcGxhY2UoLyYvZywnJmFtcDsnKS5yZXBsYWNlKC88L2csJyZsdDsnKS5yZXBsYWNlKC8+L2csJyZndDsnKS5yZXBsYWNlKC9cIi9nLCcmcXVvdDsnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZm9ybWF0QXBpRXJyb3IoZXJyKSB7XHJcbiAgaWYgKCFlcnIpIHJldHVybiAnVW5rbm93biBlcnJvcic7XHJcbiAgaWYgKHR5cGVvZiBlcnIuZGV0YWlsID09PSAnc3RyaW5nJykgcmV0dXJuIGVyci5kZXRhaWw7XHJcbiAgaWYgKEFycmF5LmlzQXJyYXkoZXJyLmRldGFpbCkpIHJldHVybiBlcnIuZGV0YWlsLm1hcChlID0+IGUubXNnIHx8IEpTT04uc3RyaW5naWZ5KGUpKS5qb2luKCc7ICcpO1xyXG4gIGlmIChlcnIubWVzc2FnZSkgcmV0dXJuIGVyci5tZXNzYWdlO1xyXG4gIGNvbnN0IHN0cmluZ2lmaWVkID0gSlNPTi5zdHJpbmdpZnkoZXJyKTtcclxuICByZXR1cm4gKCFzdHJpbmdpZmllZCB8fCBzdHJpbmdpZmllZCA9PT0gJ3t9JykgPyAnVW5rbm93biBlcnJvciAobm8gZGV0YWlscyBmcm9tIHNlcnZlciknIDogc3RyaW5naWZpZWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0cmlwUmljaE1hcmt1cCh0ZXh0KSB7XHJcbiAgcmV0dXJuIHRleHRcclxuICAgIC5yZXBsYWNlKC9cXHgxYlxcW1swLTk7XSpbYS16QS1aXS9nLCAnJykgIC8vIEFOU0kgZXNjYXBlIGNvZGVzXHJcbiAgICAucmVwbGFjZSgvXFxbXFwvP1xcdytcXF0vZywgJycpOyAgICAgICAgICAgICAvLyBSaWNoIG1hcmt1cCB0YWdzXHJcbn1cclxuXHJcbi8vIFNlcnZlciB0aW1lc3RhbXBzIGFyZSBuYWl2ZSBVVEMgKFNRTGl0ZSBEYXRlVGltZSDihpIgaXNvZm9ybWF0KCkgd2l0aCBubyB6b25lKS5cclxuLy8gVHJlYXQgYSB6b25lLWxlc3Mgc3RyaW5nIGFzIFVUQyBzbyBpdCBpc24ndCBwYXJzZWQgYXMgdGhlIHZpZXdlcidzIGxvY2FsIHRpbWUuXHJcbmZ1bmN0aW9uIF9wYXJzZVNlcnZlckRhdGUoaXNvKSB7XHJcbiAgY29uc3QgaGFzWm9uZSA9IC9belpdJHxbKy1dXFxkezJ9Oj9cXGR7Mn0kLy50ZXN0KGlzbyk7XHJcbiAgcmV0dXJuIG5ldyBEYXRlKGhhc1pvbmUgPyBpc28gOiBpc28gKyAnWicpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10RGF0ZShpc28pIHtcclxuICBpZiAoIWlzbykgcmV0dXJuICduZXZlcic7XHJcbiAgY29uc3QgZCA9IF9wYXJzZVNlcnZlckRhdGUoaXNvKTtcclxuICByZXR1cm4gZC50b0xvY2FsZURhdGVTdHJpbmcodW5kZWZpbmVkLCB7bW9udGg6J3Nob3J0JywgZGF5OidudW1lcmljJ30pICsgJyBhdCAnICtcclxuICAgIGQudG9Mb2NhbGVUaW1lU3RyaW5nKHVuZGVmaW5lZCwge2hvdXI6J251bWVyaWMnLCBtaW51dGU6JzItZGlnaXQnfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRBZ28oaXNvU3RyaW5nKSB7XHJcbiAgY29uc3QgZGlmZlMgPSAoRGF0ZS5ub3coKSAtIF9wYXJzZVNlcnZlckRhdGUoaXNvU3RyaW5nKS5nZXRUaW1lKCkpIC8gMTAwMDtcclxuICBpZiAoZGlmZlMgPCA2MCkgICAgcmV0dXJuICdqdXN0IG5vdyc7XHJcbiAgaWYgKGRpZmZTIDwgMzYwMCkgIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gNjApfW0gYWdvYDtcclxuICBpZiAoZGlmZlMgPCA4NjQwMCkgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyAzNjAwKX1oIGFnb2A7XHJcbiAgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyA4NjQwMCl9ZCBhZ29gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10T2Zmc2V0KHYpIHtcclxuICBpZiAoIXYpIHJldHVybiAnKzAuMCc7XHJcbiAgcmV0dXJuICh2ID49IDAgPyAnKycgOiAnJykgKyB2LnRvRml4ZWQoMSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRFbGFwc2VkKG1zKSB7XHJcbiAgY29uc3QgcyA9IE1hdGguZmxvb3IobXMgLyAxMDAwKTtcclxuICBjb25zdCBtID0gTWF0aC5mbG9vcihzIC8gNjApO1xyXG4gIHJldHVybiBtID4gMCA/IGAke219bSAke3MgJSA2MH1zYCA6IGAke3N9c2A7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCB0aW1lbGluZSBpbnRlcnZhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuY29uc3QgX1RJTUVMSU5FX01JTl9JTlRFUlZBTF9TID0gMTA7XHJcblxyXG4vLyBDb252ZXJ0IGEgdGltZWxpbmUgaW50ZXJ2YWwgKHZhbHVlLCB1bml0KSBpbnRvIHNlY29uZHM7IG51bGwgaWYgbm9uLW51bWVyaWMgb3JcclxuLy8gYmVsb3cgdGhlIG1pbmltdW0uIFNoYXJlZCBieSB0aGUgU2V0dGluZ3Mgc2F2ZSBwYXRoIGFuZCB0aGUgcGVyLXZpZGVvIHRpbWVsaW5lXHJcbi8vIGdlbmVyYXRvciBzbyB0aGVpciB2YWxpZGF0aW9uIGNhbid0IGRyaWZ0IGFwYXJ0LlxyXG5mdW5jdGlvbiBfcGFyc2VJbnRlcnZhbFModmFsdWUsIHVuaXQpIHtcclxuICBjb25zdCBuID0gcGFyc2VJbnQodmFsdWUsIDEwKTtcclxuICBpZiAoaXNOYU4obikpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IHNlY29uZHMgPSB1bml0ID09PSAnbWludXRlcycgPyBuICogNjAgOiBuO1xyXG4gIHJldHVybiBzZWNvbmRzID49IF9USU1FTElORV9NSU5fSU5URVJWQUxfUyA/IHNlY29uZHMgOiBudWxsO1xyXG59XHJcblxyXG5leHBvcnQge1xyXG4gIF9zY29yZUljb24sIF9sZXJwQ29sb3IsIF9zY29yZUJvcmRlckNvbG9yLCBfc29ydFNjb3JlLCBfZm10VmlkZW9TdGF0dXMsIF9tc1RvSG1zLFxyXG4gIHBsdXJhbCwgZmluaXRlT3IsIGZtdER1cmF0aW9uLCB0cnVuY2F0ZSwgZXNjSHRtbCwgZm9ybWF0QXBpRXJyb3IsIHN0cmlwUmljaE1hcmt1cCxcclxuICBfcGFyc2VTZXJ2ZXJEYXRlLCBfZm10RGF0ZSwgX2ZtdEFnbywgX2ZtdE9mZnNldCwgX2ZtdEVsYXBzZWQsIF9wYXJzZUludGVydmFsUyxcclxufTtcclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gU2hhcmVkIGNvbG91ciBwaWNrZXIuIFByb2dyZXNzaXZlLWVuaGFuY2VzIGFuIDxpbnB1dD4gdGhhdCBob2xkc1xyXG4vLyAgIGEgaGV4IHZhbHVlOiB0aGUgb3JpZ2luYWwgaW5wdXQgYmVjb21lcyBhIGhpZGRlbiB2YWx1ZS1zdG9yZSAoa2VlcGluZyBpdHMgaWQsXHJcbi8vICAgY2xhc3NlcywgZGF0YS0qIGFuZCBldmVudCB3aXJpbmcpIGFuZCBnYWlucyBhIGNvbXBhY3Qgc3dhdGNoIHRyaWdnZXIuIENsaWNraW5nXHJcbi8vICAgaXQgb3BlbnMgYSBwb3BvdmVyIHdpdGggZGlyZWN0IGhleCBlbnRyeSwgYSByZWNlbnRseS11c2VkIHN0cmlwLCBhbmQgKFN0YWdlIDMpXHJcbi8vICAgYSB1c2VyLWN1cmF0ZWQgbmFtZWQgcGFsZXR0ZS4gUmVwbGFjZXMgbmF0aXZlIDxpbnB1dCB0eXBlPVwiY29sb3JcIj4gYXQgdGhlXHJcbi8vICAgc3BlYWtlci1jb2xvdXIgYW5kIHRpdGxlLWNhcmQgY29sb3VyIHNpdGVzLlxyXG4vLyAgIFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX2NvbG9ycGlja2VyLnB5XHJcbi8vIOKUgOKUgCBzaGFyZWQgY29sb3VyIHBpY2tlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbmNvbnN0IFJFQ0VOVF9LRVkgPSAneXV1Y2xpcC1jb2xvci1yZWNlbnQnO1xyXG5jb25zdCBQQUxFVFRFX0tFWSA9ICd5dXVjbGlwLWNvbG9yLXBhbGV0dGUnO1xyXG5jb25zdCBSRUNFTlRfTUFYID0gODtcclxuXHJcbi8vIFBpY2thYmxlIHN0YXJ0ZXIgY29sb3VycyAtIGRhdGEsIG5vdCBVSSBjaHJvbWUgKHRoZSBjaHJvbWUgYXJvdW5kIHRoZW0gY29tZXNcclxuLy8gZnJvbSB0aGVtZSB0b2tlbnMpLiBBIHNwcmVhZCBvZiBodWVzIHBsdXMgYmxhY2svd2hpdGUgc28gYSBmaXJzdC10aW1lIHVzZXIgaGFzXHJcbi8vIHVzYWJsZSBjaG9pY2VzIGJlZm9yZSBjdXJhdGluZyB0aGVpciBvd24gcGFsZXR0ZS4gVGhlc2UgbGl0ZXJhbHMgYXJlIHRoZSBvbmVcclxuLy8gZXhjZXB0aW9uIHRoZSB0ZXN0X3VpX3RoZW1lIGNvbG91ci1saXRlcmFsIGFsbG93bGlzdCBjYXJ2ZXMgb3V0IGZvciB0aGlzIGZpbGUuXHJcbmNvbnN0IFNUQVJURVJfU1dBVENIRVMgPSBbXHJcbiAgJyNmZmZmZmYnLCAnIzAwMDAwMCcsICcjZTA1YzVjJywgJyNmMDgwM2MnLCAnI2YwYzA2MCcsICcjNGNhZjdkJyxcclxuICAnIzRmYzNmNycsICcjMGE3YTliJywgJyNiMDZhZjcnLCAnI2Y3N2FjMCcsICcjOWU5ZTllJywgJyM3YTRiMmEnLFxyXG5dO1xyXG5cclxuZnVuY3Rpb24gX3JlYWRMaXN0KGtleSkge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgfHwgJ1tdJyk7XHJcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogW107XHJcbiAgfSBjYXRjaCB7IHJldHVybiBbXTsgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBfd3JpdGVMaXN0KGtleSwgbGlzdCkge1xyXG4gIHRyeSB7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkobGlzdCkpOyB9IGNhdGNoIHsgLyogc3RvcmFnZSBkaXNhYmxlZCAqLyB9XHJcbn1cclxuXHJcbi8vIEFjY2VwdHMgI1JHQiBvciAjUlJHR0JCICh3aXRoIG9yIHdpdGhvdXQgdGhlIGxlYWRpbmcgIykgYW5kIHJldHVybnMgYVxyXG4vLyBjYW5vbmljYWwgbG93ZXJjYXNlICNycmdnYmIsIG9yIG51bGwgd2hlbiB0aGUgdmFsdWUgaXNuJ3QgYSB2YWxpZCBoZXggY29sb3VyLlxyXG5mdW5jdGlvbiBfbm9ybWFsaXplSGV4KHJhdykge1xyXG4gIGlmICh0eXBlb2YgcmF3ICE9PSAnc3RyaW5nJykgcmV0dXJuIG51bGw7XHJcbiAgbGV0IGhleCA9IHJhdy50cmltKCk7XHJcbiAgaWYgKGhleCAmJiAhaGV4LnN0YXJ0c1dpdGgoJyMnKSkgaGV4ID0gJyMnICsgaGV4O1xyXG4gIGNvbnN0IHNob3J0ID0gL14jKFswLTlhLWZBLUZdezN9KSQvLmV4ZWMoaGV4KTtcclxuICBpZiAoc2hvcnQpIGhleCA9ICcjJyArIHNob3J0WzFdLnNwbGl0KCcnKS5tYXAoYyA9PiBjICsgYykuam9pbignJyk7XHJcbiAgcmV0dXJuIC9eI1swLTlhLWZBLUZdezZ9JC8udGVzdChoZXgpID8gaGV4LnRvTG93ZXJDYXNlKCkgOiBudWxsO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcmVjb3JkUmVjZW50KGhleCkge1xyXG4gIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KGhleCk7XHJcbiAgaWYgKCFub3JtKSByZXR1cm47XHJcbiAgY29uc3QgbGlzdCA9IF9yZWFkTGlzdChSRUNFTlRfS0VZKVxyXG4gICAgLm1hcChfbm9ybWFsaXplSGV4KVxyXG4gICAgLmZpbHRlcihjID0+IGMgJiYgYyAhPT0gbm9ybSk7XHJcbiAgbGlzdC51bnNoaWZ0KG5vcm0pO1xyXG4gIF93cml0ZUxpc3QoUkVDRU5UX0tFWSwgbGlzdC5zbGljZSgwLCBSRUNFTlRfTUFYKSk7XHJcbn1cclxuXHJcbi8vIEEgc2luZ2xlIGNsaWNrYWJsZSBzd2F0Y2ggc2hvd2luZyBhbiBhY3R1YWwgY2hvc2VuIGNvbG91ci4gVGhlIGJhY2tncm91bmQgaXMgYVxyXG4vLyBkYXRhIHZhbHVlICh0aGUgcGlja2VkIGNvbG91ciksIHNldCBhcyBhIERPTSBwcm9wZXJ0eSBzbyBpdCBuZXZlciBhcHBlYXJzIGFzIGFcclxuLy8gbGl0ZXJhbCBpbiBzb3VyY2UgLSB0aGUgc3dhdGNoJ3MgYm9yZGVyL2ZvY3VzIHJpbmcgYXJlIHRoZW1lIHRva2VucyB2aWEgQ1NTLlxyXG5mdW5jdGlvbiBfc3dhdGNoQnV0dG9uKGNvbG9yKSB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYnRuLnR5cGUgPSAnYnV0dG9uJztcclxuICBidG4uY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXN3YXRjaCc7XHJcbiAgYnRuLmRhdGFzZXQuY29sb3IgPSBjb2xvcjtcclxuICBidG4uc3R5bGUuYmFja2dyb3VuZCA9IGNvbG9yO1xyXG4gIGJ0bi50aXRsZSA9IGNvbG9yO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBjb2xvcik7XHJcbiAgcmV0dXJuIGJ0bjtcclxufVxyXG5cclxuZnVuY3Rpb24gX3N3YXRjaFJvdyhjb2xvcnMpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXJvdyc7XHJcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcclxuICBmb3IgKGNvbnN0IHJhdyBvZiBjb2xvcnMpIHtcclxuICAgIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleChyYXcpO1xyXG4gICAgaWYgKCFjb2xvciB8fCBzZWVuLmhhcyhjb2xvcikpIGNvbnRpbnVlO1xyXG4gICAgc2Vlbi5hZGQoY29sb3IpO1xyXG4gICAgcm93LmFwcGVuZENoaWxkKF9zd2F0Y2hCdXR0b24oY29sb3IpKTtcclxuICB9XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuZnVuY3Rpb24gX3NlY3Rpb25MYWJlbCh0ZXh0KSB7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItc2VjdGlvbi1sYWJlbCc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSB0ZXh0O1xyXG4gIHJldHVybiBsYWJlbDtcclxufVxyXG5cclxuLy8g4pSA4pSAIHVzZXItY3VyYXRlZCBuYW1lZCBwYWxldHRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5mdW5jdGlvbiBfcGFsZXR0ZUVudHJpZXMoKSB7XHJcbiAgcmV0dXJuIF9yZWFkTGlzdChQQUxFVFRFX0tFWSlcclxuICAgIC5maWx0ZXIoZSA9PiBlICYmIHR5cGVvZiBlLm5hbWUgPT09ICdzdHJpbmcnICYmIF9ub3JtYWxpemVIZXgoZS5jb2xvcikpXHJcbiAgICAubWFwKGUgPT4gKHsgbmFtZTogZS5uYW1lLCBjb2xvcjogX25vcm1hbGl6ZUhleChlLmNvbG9yKSB9KSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9wYWxldHRlSXRlbShuYW1lLCBjb2xvcikge1xyXG4gIGNvbnN0IGl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBpdGVtLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWl0ZW0nO1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLW5hbWUnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gbmFtZTtcclxuICBjb25zdCByZW1vdmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICByZW1vdmUudHlwZSA9ICdidXR0b24nO1xyXG4gIHJlbW92ZS5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1yZW1vdmUnO1xyXG4gIHJlbW92ZS5kYXRhc2V0Lm5hbWUgPSBuYW1lO1xyXG4gIHJlbW92ZS50ZXh0Q29udGVudCA9ICfDlyc7XHJcbiAgcmVtb3ZlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGBSZW1vdmUgJHtuYW1lfWApO1xyXG4gIGl0ZW0uYXBwZW5kKF9zd2F0Y2hCdXR0b24oY29sb3IpLCBsYWJlbCwgcmVtb3ZlKTtcclxuICByZXR1cm4gaXRlbTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkUGFsZXR0ZShlbnRyaWVzKSB7XHJcbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHdyYXAuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUnO1xyXG4gIGlmICghZW50cmllcy5sZW5ndGgpIHtcclxuICAgIGNvbnN0IGhpbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICBoaW50LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oaW50JztcclxuICAgIGhpbnQudGV4dENvbnRlbnQgPSAnU2F2ZSBhIGNvbG91ciBiZWxvdyB0byBidWlsZCB5b3VyIHBhbGV0dGUuJztcclxuICAgIHdyYXAuYXBwZW5kQ2hpbGQoaGludCk7XHJcbiAgICByZXR1cm4gd3JhcDtcclxuICB9XHJcbiAgZW50cmllcy5mb3JFYWNoKCh7IG5hbWUsIGNvbG9yIH0pID0+IHdyYXAuYXBwZW5kQ2hpbGQoX3BhbGV0dGVJdGVtKG5hbWUsIGNvbG9yKSkpO1xyXG4gIHJldHVybiB3cmFwO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRBZGRSb3coKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1hZGRyb3cnO1xyXG4gIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICBpbnB1dC50eXBlID0gJ3RleHQnO1xyXG4gIGlucHV0LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWlucHV0JztcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ21heGxlbmd0aCcsICc0MCcpO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdOYW1lIGZvciB0aGUgY3VycmVudCBjb2xvdXInKTtcclxuICBpbnB1dC5wbGFjZWhvbGRlciA9ICdOYW1lIHRoaXMgY29sb3VyJztcclxuICBjb25zdCBhZGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBhZGQudHlwZSA9ICdidXR0b24nO1xyXG4gIGFkZC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1hZGQnO1xyXG4gIGFkZC50ZXh0Q29udGVudCA9ICdTYXZlJztcclxuICByb3cuYXBwZW5kKGlucHV0LCBhZGQpO1xyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbi8vIFNhdmVzIHRoZSBjb2xvdXIgY3VycmVudGx5IGluIHRoZSBoZXggZmllbGQgKGZhbGxpbmcgYmFjayB0byB0aGUgY29tbWl0dGVkXHJcbi8vIHZhbHVlKSB1bmRlciB0aGUgdHlwZWQgbmFtZSwgZGVmYXVsdGluZyB0aGUgbmFtZSB0byB0aGUgaGV4IHN0cmluZyBpdHNlbGYuXHJcbmZ1bmN0aW9uIF9hZGRQYWxldHRlRW50cnkoY3R4KSB7XHJcbiAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KGN0eC5oZXhGaWVsZC52YWx1ZSkgfHwgX25vcm1hbGl6ZUhleChjdHguaW5wdXQudmFsdWUpO1xyXG4gIGlmICghY29sb3IpIHJldHVybjtcclxuICBjb25zdCBuYW1lSW5wdXQgPSBjdHgucG9wLnF1ZXJ5U2VsZWN0b3IoJy5jb2xvcnBpY2tlci1wYWxldHRlLWlucHV0Jyk7XHJcbiAgY29uc3QgbmFtZSA9IChuYW1lSW5wdXQgJiYgbmFtZUlucHV0LnZhbHVlLnRyaW0oKSkgfHwgY29sb3I7XHJcbiAgY29uc3QgbmV4dCA9IF9wYWxldHRlRW50cmllcygpLmZpbHRlcihlID0+IGUubmFtZSAhPT0gbmFtZSk7XHJcbiAgbmV4dC5wdXNoKHsgbmFtZSwgY29sb3IgfSk7XHJcbiAgX3dyaXRlTGlzdChQQUxFVFRFX0tFWSwgbmV4dCk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcmVtb3ZlUGFsZXR0ZUVudHJ5KGN0eCwgbmFtZSkge1xyXG4gIF93cml0ZUxpc3QoUEFMRVRURV9LRVksIF9wYWxldHRlRW50cmllcygpLmZpbHRlcihlID0+IGUubmFtZSAhPT0gbmFtZSkpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIHZhbHVlKSB7XHJcbiAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KHZhbHVlKTtcclxuICB0cmlnZ2VyLnN0eWxlLmJhY2tncm91bmQgPSBjb2xvciB8fCAndHJhbnNwYXJlbnQnO1xyXG4gIHRyaWdnZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtZW1wdHknLCAhY29sb3IpO1xyXG59XHJcblxyXG4vLyBFdmVyeXRoaW5nIGluIGEgcGlja2VyIGluc3RhbmNlIHRoZSBoYW5kbGVycyBuZWVkIHRvIHJlYWNoLlxyXG5mdW5jdGlvbiBfbWFrZUNvbnRleHQoaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQpIHtcclxuICByZXR1cm4geyBpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBfY29tbWl0KGN0eCwgcmF3SGV4KSB7XHJcbiAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgocmF3SGV4KTtcclxuICBpZiAoIW5vcm0pIHJldHVybiBmYWxzZTtcclxuICBjdHguaW5wdXQudmFsdWUgPSBub3JtO1xyXG4gIC8vIGlucHV0IGRyaXZlcyB0aGUgbGl2ZS1wcmV2aWV3IGhhbmRsZXJzICh0aXRsZSBjYXJkJ3Mgb25pbnB1dCk7IGNoYW5nZSBkcml2ZXNcclxuICAvLyB0aGUgc2F2ZSBoYW5kbGVycyAoc3BlYWtlciBjaGFuZ2UtZGVsZWdhdGlvbikuIFRoZSB0cmlnZ2VyIHJlLXN5bmNzIG9mZiB0aGVcclxuICAvLyAnaW5wdXQnIGxpc3RlbmVyIHdpcmVkIGluIGF0dGFjaCgpLlxyXG4gIGN0eC5pbnB1dC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG4gIGN0eC5pbnB1dC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnY2hhbmdlJywgeyBidWJibGVzOiB0cnVlIH0pKTtcclxuICBfcmVjb3JkUmVjZW50KG5vcm0pO1xyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG4vLyBSZWJ1aWx0IGVhY2ggdGltZSB0aGUgcG9wb3ZlciBvcGVucyAoYW5kIGFmdGVyIGEgcGFsZXR0ZSBhZGQvcmVtb3ZlKSBzbyB0aGVcclxuLy8gcmVjZW50bHktdXNlZCBzdHJpcCBhbmQgc2F2ZWQgcGFsZXR0ZSByZWZsZWN0IHRoZSBsYXRlc3Qgc3RhdGUuIEFsbCBvZiBpdCBnb2VzXHJcbi8vIGluIG9uZSBjb250YWluZXIgdGhhdCBpcyByZXBsYWNlZCB3aG9sZXNhbGUsIHNvIG5vdGhpbmcgYWNjdW11bGF0ZXMuXHJcbmZ1bmN0aW9uIF9yZW5kZXJTdHJpcHMoY3R4KSB7XHJcbiAgY29uc3Qgc3RhbGUgPSBjdHgucG9wLnF1ZXJ5U2VsZWN0b3IoJy5jb2xvcnBpY2tlci1keW5hbWljJyk7XHJcbiAgaWYgKHN0YWxlKSBzdGFsZS5yZW1vdmUoKTtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBjb250YWluZXIuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWR5bmFtaWMnO1xyXG4gIGNvbnN0IHJlY2VudCA9IF9yZWFkTGlzdChSRUNFTlRfS0VZKTtcclxuICBpZiAocmVjZW50Lmxlbmd0aCkge1xyXG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ1JlY2VudGx5IHVzZWQnKSk7XHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3N3YXRjaFJvdyhyZWNlbnQpKTtcclxuICB9XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ1lvdXIgcGFsZXR0ZScpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX2J1aWxkUGFsZXR0ZShfcGFsZXR0ZUVudHJpZXMoKSkpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfYnVpbGRBZGRSb3coKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ0NvbG91cnMnKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zd2F0Y2hSb3coU1RBUlRFUl9TV0FUQ0hFUykpO1xyXG4gIGN0eC5wb3AuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxufVxyXG5cclxubGV0IF9vcGVuQ3R4ID0gbnVsbDsgIC8vIHRoZSBvbmUgb3BlbiBwaWNrZXIgY29udGV4dCwgb3IgbnVsbFxyXG5cclxuZnVuY3Rpb24gX2Nsb3NlUG9wb3ZlcihyZWZvY3VzKSB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGNvbnN0IHsgcG9wLCB0cmlnZ2VyIH0gPSBfb3BlbkN0eDtcclxuICBwb3AuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XHJcbiAgX29wZW5DdHggPSBudWxsO1xyXG4gIGlmIChyZWZvY3VzKSB0cmlnZ2VyLmZvY3VzKCk7XHJcbn1cclxuXHJcbi8vIFRoZSBwb3BvdmVyIGlzIGEgZGlhbG9nLCBzbyBUYWIgbXVzdCBub3QgZmFsbCB0aHJvdWdoIHRvIHRoZSBwYWdlIGJlaGluZCBpdFxyXG4vLyAoV0NBRyAyLjQuMykuIEN5Y2xlIGZvY3VzIGFtb25nIHRoZSBwb3BvdmVyJ3Mgb3duIGNvbnRyb2xzOyB0aGUgdHJpZ2dlciBzaXRzXHJcbi8vIG91dHNpZGUgdGhlIHBvcG92ZXIgYW5kIGlzIGludGVudGlvbmFsbHkgZXhjbHVkZWQgd2hpbGUgaXQgaXMgb3Blbi5cclxuZnVuY3Rpb24gX2ZvY3VzYWJsZXMocG9wKSB7XHJcbiAgcmV0dXJuIEFycmF5LmZyb20ocG9wLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbiwgaW5wdXQnKSkuZmlsdGVyKFxyXG4gICAgZWwgPT4gIWVsLmRpc2FibGVkICYmIGVsLm9mZnNldFBhcmVudCAhPT0gbnVsbCxcclxuICApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfdHJhcEZvY3VzKGUpIHtcclxuICBjb25zdCBpdGVtcyA9IF9mb2N1c2FibGVzKF9vcGVuQ3R4LnBvcCk7XHJcbiAgaWYgKCFpdGVtcy5sZW5ndGgpIHJldHVybjtcclxuICBjb25zdCBmaXJzdCA9IGl0ZW1zWzBdO1xyXG4gIGNvbnN0IGxhc3QgPSBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXTtcclxuICBjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xyXG4gIGlmICghX29wZW5DdHgucG9wLmNvbnRhaW5zKGFjdGl2ZSkpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGZpcnN0LmZvY3VzKCk7XHJcbiAgfSBlbHNlIGlmIChlLnNoaWZ0S2V5ICYmIGFjdGl2ZSA9PT0gZmlyc3QpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGxhc3QuZm9jdXMoKTtcclxuICB9IGVsc2UgaWYgKCFlLnNoaWZ0S2V5ICYmIGFjdGl2ZSA9PT0gbGFzdCkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZmlyc3QuZm9jdXMoKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9vcGVuUG9wb3ZlcihjdHgpIHtcclxuICBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgY3R4LmhleEZpZWxkLnZhbHVlID0gKF9ub3JtYWxpemVIZXgoY3R4LmlucHV0LnZhbHVlKSB8fCAnJykucmVwbGFjZSgnIycsICcnKTtcclxuICBjdHguaGV4RmllbGQuY2xhc3NMaXN0LnJlbW92ZSgnaW52YWxpZCcpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxuICBjdHgucG9wLmNsYXNzTGlzdC5hZGQoJ29wZW4nKTtcclxuICBjdHgudHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xyXG4gIF9vcGVuQ3R4ID0gY3R4O1xyXG4gIGN0eC5oZXhGaWVsZC5mb2N1cygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfd2lyZUhleEZpZWxkKGN0eCkge1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcclxuICAgIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KGN0eC5oZXhGaWVsZC52YWx1ZSk7XHJcbiAgICBjdHguaGV4RmllbGQuY2xhc3NMaXN0LnRvZ2dsZSgnaW52YWxpZCcsICFub3JtICYmIGN0eC5oZXhGaWVsZC52YWx1ZS50cmltKCkgIT09ICcnKTtcclxuICAgIGlmIChub3JtKSBfc3luY1RyaWdnZXIoY3R4LnRyaWdnZXIsIG5vcm0pOyAgLy8gbGl2ZSBwcmV2aWV3LCBubyBjb21taXQgeWV0XHJcbiAgfSk7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IF9jb21taXQoY3R4LCBjdHguaGV4RmllbGQudmFsdWUpKTtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gICAgaWYgKGUua2V5ICE9PSAnRW50ZXInKSByZXR1cm47XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoX2NvbW1pdChjdHgsIGN0eC5oZXhGaWVsZC52YWx1ZSkpIF9jbG9zZVBvcG92ZXIodHJ1ZSk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZEhleFJvdygpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleHJvdyc7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleGhhc2gnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gJyMnO1xyXG4gIGNvbnN0IGZpZWxkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICBmaWVsZC50eXBlID0gJ3RleHQnO1xyXG4gIGZpZWxkLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhmaWVsZCc7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdtYXhsZW5ndGgnLCAnNycpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnYXV0b2NvbXBsZXRlJywgJ29mZicpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIZXggY29sb3VyIHZhbHVlJyk7XHJcbiAgZmllbGQucGxhY2Vob2xkZXIgPSAnUlJHR0JCJztcclxuICByb3cuYXBwZW5kKGxhYmVsLCBmaWVsZCk7XHJcbiAgcmV0dXJuIHsgcm93LCBmaWVsZCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBhdHRhY2goaW5wdXQpIHtcclxuICBpZiAoIWlucHV0IHx8IGlucHV0LmRhdGFzZXQuY3BBdHRhY2hlZCkgcmV0dXJuO1xyXG4gIGlucHV0LmRhdGFzZXQuY3BBdHRhY2hlZCA9ICcxJztcclxuICBjb25zdCBpbml0aWFsID0gX25vcm1hbGl6ZUhleChpbnB1dC52YWx1ZSkgfHwgJyc7XHJcbiAgaW5wdXQudHlwZSA9ICdoaWRkZW4nO1xyXG4gIGlucHV0LnZhbHVlID0gaW5pdGlhbDtcclxuXHJcbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB3cmFwLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlcic7XHJcbiAgaW5wdXQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUod3JhcCwgaW5wdXQpO1xyXG5cclxuICBjb25zdCB0cmlnZ2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgdHJpZ2dlci50eXBlID0gJ2J1dHRvbic7XHJcbiAgdHJpZ2dlci5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItdHJpZ2dlcic7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGFzcG9wdXAnLCAndHJ1ZScpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2hvb3NlIGNvbG91cicpO1xyXG5cclxuICBjb25zdCBwb3AgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBwb3AuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBvcCc7XHJcbiAgcG9wLnNldEF0dHJpYnV0ZSgncm9sZScsICdkaWFsb2cnKTtcclxuICBwb3Auc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0NvbG91ciBwaWNrZXInKTtcclxuICBjb25zdCB7IHJvdzogaGV4Um93LCBmaWVsZDogaGV4RmllbGQgfSA9IF9idWlsZEhleFJvdygpO1xyXG4gIHBvcC5hcHBlbmRDaGlsZChoZXhSb3cpO1xyXG5cclxuICB3cmFwLmFwcGVuZCh0cmlnZ2VyLCBpbnB1dCwgcG9wKTtcclxuICBjb25zdCBjdHggPSBfbWFrZUNvbnRleHQoaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQpO1xyXG5cclxuICBfc3luY1RyaWdnZXIodHJpZ2dlciwgaW5wdXQudmFsdWUpO1xyXG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4gX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIGlucHV0LnZhbHVlKSk7XHJcbiAgdHJpZ2dlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgaWYgKF9vcGVuQ3R4ICYmIF9vcGVuQ3R4LnRyaWdnZXIgPT09IHRyaWdnZXIpIF9jbG9zZVBvcG92ZXIoKTtcclxuICAgIGVsc2UgX29wZW5Qb3BvdmVyKGN0eCk7XHJcbiAgfSk7XHJcbiAgcG9wLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgICBjb25zdCByZW1vdmVCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1yZW1vdmUnKTtcclxuICAgIGlmIChyZW1vdmVCdG4pIHsgX3JlbW92ZVBhbGV0dGVFbnRyeShjdHgsIHJlbW92ZUJ0bi5kYXRhc2V0Lm5hbWUpOyByZXR1cm47IH1cclxuICAgIGlmIChlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1hZGQnKSkgeyBfYWRkUGFsZXR0ZUVudHJ5KGN0eCk7IHJldHVybjsgfVxyXG4gICAgY29uc3Qgc3dhdGNoID0gZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXN3YXRjaCcpO1xyXG4gICAgaWYgKCFzd2F0Y2gpIHJldHVybjtcclxuICAgIF9jb21taXQoY3R4LCBzd2F0Y2guZGF0YXNldC5jb2xvcik7XHJcbiAgICBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgfSk7XHJcbiAgcG9wLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJyAmJiBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCcpKSB7XHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgX2FkZFBhbGV0dGVFbnRyeShjdHgpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG4gIF93aXJlSGV4RmllbGQoY3R4KTtcclxufVxyXG5cclxuLy8gQ2xvc2UgdGhlIG9wZW4gcG9wb3ZlciBvbiBhbiBvdXRzaWRlIGNsaWNrIG9yIEVzY2FwZS4gUmVnaXN0ZXJlZCBvbmNlLlxyXG4vLyBBIGNsaWNrIHRoYXQgcmUtcmVuZGVycyB0aGUgcG9wb3ZlciAoU2F2ZSAvIHJlbW92ZSBhIHBhbGV0dGUgZW50cnkpIGRldGFjaGVzXHJcbi8vIGl0cyBvd24gdGFyZ2V0IGJlZm9yZSB0aGlzIGJ1YmJsaW5nIGhhbmRsZXIgcnVuczsgc3VjaCBhIHRhcmdldCBpcyBubyBsb25nZXIgaW5cclxuLy8gdGhlIGRvY3VtZW50LCBzbyBza2lwIGl0IHJhdGhlciB0aGFuIG1pc3Rha2luZyBpdCBmb3IgYW4gb3V0c2lkZSBjbGljay5cclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgaWYgKCFkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoZS50YXJnZXQpKSByZXR1cm47XHJcbiAgaWYgKCFfb3BlbkN0eC5wb3AucGFyZW50Tm9kZS5jb250YWlucyhlLnRhcmdldCkpIF9jbG9zZVBvcG92ZXIoKTtcclxufSk7XHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykgeyBfY2xvc2VQb3BvdmVyKHRydWUpOyByZXR1cm47IH1cclxuICBpZiAoZS5rZXkgPT09ICdUYWInKSBfdHJhcEZvY3VzKGUpO1xyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBDb2xvclBpY2tlciA9IHsgYXR0YWNoLCBfbm9ybWFsaXplSGV4LCBSRUNFTlRfS0VZLCBQQUxFVFRFX0tFWSB9O1xyXG4iLCAiLy8gSW5mcmFzdHJ1Y3R1cmUgLSBQYW5lbE5hdiB0YWtlb3ZlciBmcmFtZXdvcmsgKG5vdCBhIGZlYXR1cmUgbW9kdWxlKS5cclxuLy8gICBVc2VkIGJ5OiBzcGxpdC5qcywgY2xpcGNyZWF0ZS5qcywgZXhwb3J0ZWRpdG9yLmpzLCBuYW1lY29ycmVjdGlvbnMuanMgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfcGFuZWxuYXYucHlcclxuLy8g4pSA4pSAIHBhbmVsIG5hdmlnYXRpb24gZnJhbWV3b3JrIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBNdWx0aS1zdGVwIGZsb3dzIChTcGxpdCBFZGl0b3IsIGFuZCBmdXR1cmUgcGlja2VycykgdGFrZSBvdmVyIHRoZSBtYWluXHJcbi8vIGRldGFpbCBwYW5lbCBpbnN0ZWFkIG9mIHVzaW5nIGEgbW9kYWw6IHNoYXJlZCBicmVhZGNydW1iLCBzaGFyZWQgZGlydHktc3RhdGVcclxuLy8gZGlzY2FyZCBwcm9tcHQuIEVhY2ggb3BlbiBwYW5lbCBnZXRzIGl0cyBvd24gY29udGVudCBjb250YWluZXIgc28gYSBmdXR1cmVcclxuLy8gbmVzdGVkIHBhbmVsIChlLmcuIG1hbnVhbC1jbGlwJ3MgcGlja2VyIG9uIHRvcCBvZiBhIHJlY29yZGluZyB2aWV3KSBjYW4gYmVcclxuLy8gdW53b3VuZCBvbmUgbGV2ZWwgYXQgYSB0aW1lIHdpdGhvdXQgcmUtcnVubmluZyB0aGUgcGFyZW50J3MgcmVuZGVyKCkuXHJcbi8vXHJcbi8vIFRoZSBjb250YWluZXIgaXMgZGVzdHJveWVkIG9uIGNsb3NlIHJpZ2h0IGFmdGVyIG9uQ2xvc2UoKSBydW5zLiBJZiByZW5kZXIoKVxyXG4vLyByZXBhcmVudGVkIGFuIGV4aXN0aW5nIHN0YXRpYyBlbGVtZW50IChyYXRoZXIgdGhhbiBidWlsZGluZyBmcmVzaCBET00pLFxyXG4vLyBvbkNsb3NlKCkgbXVzdCBtb3ZlIGl0IGJhY2sgb3V0IHRvIGEgc3RhYmxlLCBhbHdheXMtaW4tZG9jdW1lbnQgbG9jYXRpb24gLVxyXG4vLyBvdGhlcndpc2UgaXQgZ29lcyB3aXRoIHRoZSBjb250YWluZXIgYW5kIGdldEVsZW1lbnRCeUlkIGNhbid0IGZpbmQgaXQgb25cclxuLy8gdGhlIG5leHQgb3Blbi4gU2VlIHNwbGl0LmpzJ3MgX3RlYXJkb3duU3BsaXRFZGl0b3IgZm9yIHRoZSBwYXR0ZXJuLlxyXG5cclxuY29uc3QgX3N0YWNrID0gW107ICAvLyBbe2lkLCB0aXRsZSwgaXNEaXJ0eSwgb25DbG9zZSwgY29udGFpbmVyfV1cclxuXHJcbmZ1bmN0aW9uIF9yb290KCkgICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LXJvb3QnKTsgfVxyXG5mdW5jdGlvbiBfY3J1bWIoKSAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1icmVhZGNydW1iJyk7IH1cclxuZnVuY3Rpb24gX21vdW50KCkgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtY29udGVudCcpOyB9XHJcbmZ1bmN0aW9uIF90b3AoKSAgICAgeyByZXR1cm4gX3N0YWNrW19zdGFjay5sZW5ndGggLSAxXSB8fCBudWxsOyB9XHJcblxyXG5mdW5jdGlvbiBfcmVuZGVyQnJlYWRjcnVtYigpIHtcclxuICBjb25zdCB0b3AgPSBfdG9wKCk7XHJcbiAgY29uc3QgY3J1bWIgPSBfY3J1bWIoKTtcclxuICBjcnVtYi5pbm5lckhUTUwgPSAnJztcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIGNvbnN0IGJhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBiYWNrLnR5cGUgPSAnYnV0dG9uJztcclxuICBiYWNrLmNsYXNzTmFtZSA9ICdidG4gZ2hvc3QnO1xyXG4gIGJhY2suc3R5bGUuY3NzVGV4dCA9ICdwYWRkaW5nOjRweCAxMHB4O2ZvbnQtc2l6ZToxM3B4JztcclxuICBiYWNrLnRleHRDb250ZW50ID0gJ+KGkCBCYWNrJztcclxuICBiYWNrLm9uY2xpY2sgPSAoKSA9PiBwYW5lbE5hdkNsb3NlKCk7XHJcbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgdGl0bGUuc3R5bGUuY3NzVGV4dCA9ICdmb250LXNpemU6MTRweDtmb250LXdlaWdodDo2MDAnO1xyXG4gIHRpdGxlLnRleHRDb250ZW50ID0gdG9wLnRpdGxlO1xyXG4gIGNydW1iLmFwcGVuZChiYWNrLCB0aXRsZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF91cGRhdGVWaXNpYmlsaXR5KCkge1xyXG4gIF9zdGFjay5mb3JFYWNoKChlbnRyeSwgaSkgPT4ge1xyXG4gICAgZW50cnkuY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSBpID09PSBfc3RhY2subGVuZ3RoIC0gMSA/ICdmbGV4JyA6ICdub25lJztcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZPcGVuKHsgaWQsIHRpdGxlLCByZW5kZXIsIGlzRGlydHksIG9uQ2xvc2UgfSkge1xyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnRhaW5lci5kYXRhc2V0LnBhbmVsSWQgPSBpZDtcclxuICBjb250YWluZXIuc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDoxNnB4JztcclxuICBfbW91bnQoKS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xyXG4gIF9zdGFjay5wdXNoKHtcclxuICAgIGlkLFxyXG4gICAgdGl0bGUsXHJcbiAgICBpc0RpcnR5OiBpc0RpcnR5IHx8ICgoKSA9PiBmYWxzZSksXHJcbiAgICBvbkNsb3NlOiBvbkNsb3NlIHx8ICgoKSA9PiB7fSksXHJcbiAgICBjb250YWluZXIsXHJcbiAgfSk7XHJcbiAgX3Jvb3QoKS5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gIF91cGRhdGVWaXNpYmlsaXR5KCk7XHJcbiAgX3JlbmRlckJyZWFkY3J1bWIoKTtcclxuICByZW5kZXIoY29udGFpbmVyKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2Nsb3NlVG9wKCkge1xyXG4gIGNvbnN0IHRvcCA9IF9zdGFjay5wb3AoKTtcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIHRvcC5vbkNsb3NlKCk7XHJcbiAgdG9wLmNvbnRhaW5lci5yZW1vdmUoKTtcclxuICBpZiAoX3N0YWNrLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgX3Jvb3QoKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBfdXBkYXRlVmlzaWJpbGl0eSgpO1xyXG4gICAgX3JlbmRlckJyZWFkY3J1bWIoKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2Q2xvc2UoKSB7XHJcbiAgY29uc3QgdG9wID0gX3RvcCgpO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgaWYgKHRvcC5pc0RpcnR5KCkpIHtcclxuICAgIHdpbmRvdy5zaG93Q29uZmlybShcclxuICAgICAgJ0Rpc2NhcmQgY2hhbmdlcz8nLFxyXG4gICAgICAnWW91IGhhdmUgdW5zYXZlZCBjaGFuZ2VzLiBDbG9zZSB3aXRob3V0IHNhdmluZz8nLFxyXG4gICAgICAnRGlzY2FyZCcsXHJcbiAgICAgIF9jbG9zZVRvcCxcclxuICAgICAgdHJ1ZSxcclxuICAgICk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIF9jbG9zZVRvcCgpO1xyXG59XHJcblxyXG4vLyBGb3JjZS1jbG9zZSB0aGUgdG9wbW9zdCBwYW5lbCwgYnlwYXNzaW5nIHRoZSBkaXJ0eSBnYXRlIC0gZm9yIGNhbGxlcnMgdGhhdFxyXG4vLyBoYXZlIGFscmVhZHkgY29uZmlybWVkIHRoZSBkaXNjYXJkIHRocm91Z2ggdGhlaXIgb3duIChkaWZmZXJlbnRseSB3b3JkZWQpXHJcbi8vIHByb21wdCwgZS5nLiBzd2l0Y2hpbmcgcmVjb3JkaW5ncyB3aGlsZSB0aGUgU3BsaXQgRWRpdG9yIGlzIGRpcnR5LlxyXG5mdW5jdGlvbiBwYW5lbE5hdkZvcmNlQ2xvc2UoKSB7XHJcbiAgX2Nsb3NlVG9wKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2SXNPcGVuKGlkKSB7XHJcbiAgaWYgKGlkID09PSB1bmRlZmluZWQpIHJldHVybiBfc3RhY2subGVuZ3RoID4gMDtcclxuICByZXR1cm4gX3N0YWNrLnNvbWUoZW50cnkgPT4gZW50cnkuaWQgPT09IGlkKTtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IFBhbmVsTmF2ID0ge1xyXG4gIG9wZW46IHBhbmVsTmF2T3BlbiwgY2xvc2U6IHBhbmVsTmF2Q2xvc2UsIGZvcmNlQ2xvc2U6IHBhbmVsTmF2Rm9yY2VDbG9zZSwgaXNPcGVuOiBwYW5lbE5hdklzT3BlbixcclxufTtcclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gTG9uZy1ydW5uaW5nLWpvYiBtYWNoaW5lcnk6IHRoZSBqb2Itc3RhdHVzIGhlYWRlciAoc3RlcCBwaWxscywgdGltZXIsIEVUQSksIHRoZVxuLy8gICBwYXVzZS9yZXN1bWUgKyB0aGVybWFsIGF1dG8tcGF1c2UgVUksIHRoZSBmZXRjaC1iYXNlZCBTU0UgdHJhbnNwb3J0IChfb3BlblNTRS9zdHJlYW1TU0UpLCB0aGVcbi8vICAgc2luZ2xlLWFjdGl2ZS1zdHJlYW0gc3VwZXJzZWRlIGNvbnRyYWN0LCBhbmQgdGhlIHNoYXJlZCBDYW5jZWwgYnV0dG9uLlxuLy8gICBBUEk6IHJvdXRlcy9hbmFseXplLnB5LCByb3V0ZXMvc2NvcmluZy5weSAoU1NFIGVuZHBvaW50cykgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHksIHRlc3RzL3VpL3Rlc3RfdWlfc3NlLnB5XG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgZXNjSHRtbCwgZm9ybWF0QXBpRXJyb3IsIF9mbXRFbGFwc2VkIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xuXG4vLyDilIDilIAgc2hhcmVkIGxpdmUgam9iLXJlbmRlciBzdGF0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFJlYWQgY3Jvc3MtZmlsZSBieSB2aWRlb3MuanMncyBjb21wYWN0IHN0ZXAgc3RyaXAgKGJhcmUgaWRlbnRpZmllcnMgX2pvYlN0ZXBEZWZzLFxuLy8gX2FjdGl2ZVN0ZXBJZHgsIF9qb2JTdGFydFRpbWUpIGFuZCBieSB0aGUgUGxheXdyaWdodCBVSS10ZXN0IHN1aXRlLCB3aGljaCBzZWVkc1xuLy8gc2V2ZXJhbCBvZiB0aGVzZSBkaXJlY3RseSB2aWEgcGFnZS5ldmFsdWF0ZS4gQm90aCBzaWRlcyBhcmUgY2xhc3NpYywgbm9uLW1vZHVsZVxuLy8gY29kZSwgc28gdGhleSBjYW4gb25seSBldmVyIHJlYWNoIHRoZXNlIGFzIGB3aW5kb3dgIHByb3BlcnRpZXMgLSBuZXZlciB2aWEgYW4gRVNNXG4vLyBpbXBvcnQuIEEgb25lLXNob3QgYHdpbmRvdy5YID0gWGAgc25hcHNob3Qgd291bGQgZ28gc3RhbGUgdGhlIGluc3RhbnQgam9icy5qc1xuLy8gcmVhc3NpZ25zIFgsIHNvIGVhY2ggbmFtZSBnZXRzIGEgbGl2ZSBnZXQvc2V0IGJyaWRnZSBvbnRvIGB3aW5kb3dgIGJlbG93IGluc3RlYWRcbi8vIG9mIGEgcGxhaW4gT2JqZWN0LmFzc2lnbiBleHBvcnQuXG5sZXQgX2pvYlN0ZXBEZWZzICAgPSBbXTtcbmxldCBfYWN0aXZlRVMgICAgICA9IG51bGw7XG5sZXQgX2pvYlN0YXJ0VGltZSAgPSAwO1xubGV0IF9hY3RpdmVTdGVwSWR4ID0gLTE7XG5cbi8vIFBlci1zdGVwIHByb2dyZXNzIGFjY291bnRpbmcgZm9yIHRoZSBzdGVwLXBpbGwgRVRBIGhldXJpc3RpYy4gTm90IHJlYWQgYnkgb3RoZXJcbi8vIHByb2R1Y3Rpb24gbW9kdWxlcywgYnV0IHRoZSBzdGVwLXBpbGwgLyBFVEEgLyBsaXZlLXBhbmVsIHRlc3RzIHNlZWQgdGhlbSBkaXJlY3RseVxuLy8gdmlhIHBhZ2UuZXZhbHVhdGUsIHNvIHRoZXkgbmVlZCB0aGUgc2FtZSB3aW5kb3cgYnJpZGdlIGFzIHRoZSBibG9jayBhYm92ZS5cbmxldCBfc3RlcFN0YXJ0VGltZSA9IDA7XG5sZXQgX3N0ZXBQcm9ncmVzcyAgPSB7fTsgLy8gc3RlcElkeCAtPiB7Y3VycmVudCwgdG90YWx9LCBjbGVhcmVkIHBlciBqb2JcbmxldCBfc3RlcFJhdGVBbmNob3IgPSB7fTsgLy8gc3RlcElkeCAtPiB7dCwgY3VycmVudH0gYXQgZmlyc3Qgb2JzZXJ2ZWQgY291bnQsIGNsZWFyZWQgcGVyIGpvYlxuXG5mb3IgKGNvbnN0IFtuYW1lLCBnZXQsIHNldF0gb2YgW1xuICBbJ19qb2JTdGVwRGVmcycsICAgICgpID0+IF9qb2JTdGVwRGVmcywgICAgdiA9PiB7IF9qb2JTdGVwRGVmcyA9IHY7IH1dLFxuICBbJ19hY3RpdmVFUycsICAgICAgICgpID0+IF9hY3RpdmVFUywgICAgICAgdiA9PiB7IF9hY3RpdmVFUyA9IHY7IH1dLFxuICBbJ19qb2JTdGFydFRpbWUnLCAgICgpID0+IF9qb2JTdGFydFRpbWUsICAgdiA9PiB7IF9qb2JTdGFydFRpbWUgPSB2OyB9XSxcbiAgWydfYWN0aXZlU3RlcElkeCcsICAoKSA9PiBfYWN0aXZlU3RlcElkeCwgIHYgPT4geyBfYWN0aXZlU3RlcElkeCA9IHY7IH1dLFxuICBbJ19zdGVwU3RhcnRUaW1lJywgICgpID0+IF9zdGVwU3RhcnRUaW1lLCAgdiA9PiB7IF9zdGVwU3RhcnRUaW1lID0gdjsgfV0sXG4gIFsnX3N0ZXBQcm9ncmVzcycsICAgKCkgPT4gX3N0ZXBQcm9ncmVzcywgICB2ID0+IHsgX3N0ZXBQcm9ncmVzcyA9IHY7IH1dLFxuICBbJ19zdGVwUmF0ZUFuY2hvcicsICgpID0+IF9zdGVwUmF0ZUFuY2hvciwgdiA9PiB7IF9zdGVwUmF0ZUFuY2hvciA9IHY7IH1dLFxuXSkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCBuYW1lLCB7Z2V0LCBzZXQsIGNvbmZpZ3VyYWJsZTogdHJ1ZX0pO1xufVxuXG4vLyDilIDilIAgcHJvZ3Jlc3MgaW5kaWNhdG9yIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gZXN0TWF0Y2g6IHN1YnN0cmluZ3MgdGhhdCBtYXAgdGhpcyBwaWxsIHRvIGEgc3RlcCBuYW1lIGZyb20gL2FwaS9lc3RpbWF0ZSwgc29cbi8vIHRoZSBwcm9ncmVzcyBwaWxsIGNhbiBzaG93IGl0cyBwcmUtcnVuIHRpbWUgZXN0aW1hdGUgYXMgYSBob3ZlciB0b29sdGlwLlxuLy8gcHJvZ3Jlc3NQYXR0ZXJuOiByZWdleCB3aXRoIHR3byBjYXB0dXJlIGdyb3VwcyAoY3VycmVudCwgdG90YWwpIG1hdGNoZWRcbi8vIGFnYWluc3QgaW5jb21pbmcgbG9nIGxpbmVzIHdoaWxlIHRoaXMgc3RlcCBpcyBhY3RpdmUsIHNvIHRoZSBwaWxsIGNhbiBzaG93XG4vLyBcIjMvMTIgKDI1JSlcIiBhbmQgYSBsaXZlIEVUQSBpbnN0ZWFkIG9mIGp1c3QgZWxhcHNlZCB0aW1lLlxuLy8gc3RhZ2U6IHRoZSBtYWNoaW5lLXJlYWRhYmxlIGlkIGZyb20gdGhlIEBAUFJPR1JFU1MgbWFya2VyICh5dXVfY2xpcC9waXBlbGluZS9cbi8vIHByb2dyZXNzLnB5IFN0YWdlKS4gVGhlIG1hcmtlciBkcml2ZXMgdGhlIHBpbGwgZGV0ZXJtaW5pc3RpY2FsbHk7IHRoZSBwYXR0ZXJucy9cbi8vIHByb2dyZXNzUGF0dGVybiByZWdleGVzIGJlbG93IHN0YXkgYXMgYSBvbmUtcmVsZWFzZSBmYWxsYmFjayBmb3IgdGhlIGh1bWFuIGxvZ1xuLy8gbGluZXMuIFRoZSBzdGFnZSBzZXQgaGVyZSBpcyBjb3VwbGluZy1ndWFyZGVkIGFnYWluc3QgcHJvZ3Jlc3MucHkgYnlcbi8vIHRlc3RzL3VuaXQvdGVzdF9wcm9ncmVzc19zdGFnZV9jb3VwbGluZy5weS5cbmNvbnN0IElOR0VTVF9TVEVQUyA9IFtcbiAge2xhYmVsOiAnRXh0cmFjdCcsICAgICAgICBzdGFnZTogJ2V4dHJhY3QnLCAgICAgICAgcGF0dGVybnM6IFsnRXh0cmFjdGluZyBhdWRpbyddLCAgICAgIGVzdE1hdGNoOiBbJ2V4dHJhY3QgYXVkaW8nXSwgIHByb2dyZXNzUGF0dGVybjogL1RyYWNrIChcXGQrKVxcLyhcXGQrKS99LFxuICB7bGFiZWw6ICdUcmFuc2NyaWJlJywgICAgIHN0YWdlOiAndHJhbnNjcmliZScsICAgICBwYXR0ZXJuczogWydUcmFuc2NyaWJpbmcnXSwgICAgICAgICAgZXN0TWF0Y2g6IFsndHJhbnNjcmliZScsICdsb2FkIGNhcHRpb25zJ10sIHByb2dyZXNzUGF0dGVybjogL1RyYWNrIChcXGQrKVxcLyhcXGQrKS8sIHdhaXRQYXR0ZXJuOiAvV2FpdGluZyBmb3IgdGhlIHNwZWVjaC10by10ZXh0IG1vZGVsL30sXG4gIHtsYWJlbDogJ1NwZWFrZXJzJywgICAgICAgc3RhZ2U6ICdzcGVha2VycycsICAgICAgIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzcGVha2VycyddLCAgICBlc3RNYXRjaDogWydzcGVha2VyIGxhYmVscyddfSxcbiAge2xhYmVsOiAnR2VuZXJhdGUgQ2xpcHMnLCBzdGFnZTogJ2dlbmVyYXRlX2NsaXBzJywgcGF0dGVybnM6IFsnR2VuZXJhdGluZyBjbGlwJ119LFxuICB7bGFiZWw6ICdFbmVyZ3knLCAgICAgICAgIHN0YWdlOiAnZW5lcmd5JywgICAgICAgICBwYXR0ZXJuczogWydDb21wdXRpbmcgYXVkaW8gZW5lcmd5J10sIGVzdE1hdGNoOiBbJ2F1ZGlvIGVuZXJneSddfSxcbiAge2xhYmVsOiAnU2NlbmVzJywgICAgICAgICBzdGFnZTogJ3NjZW5lcycsICAgICAgICAgcGF0dGVybnM6IFsnRGV0ZWN0aW5nIHNjZW5lJ10sICAgICAgIGVzdE1hdGNoOiBbJ3NjZW5lIGRldGVjdGlvbiddfSxcbiAge2xhYmVsOiAnU2NvcmUnLCAgICAgICAgICBzdGFnZTogJ3Njb3JlJywgICAgICAgICAgcGF0dGVybnM6IFsnU2NvcmluZyBjbGlwcyddLCAgICAgICAgIGVzdE1hdGNoOiBbJ2xsbSBzY29yaW5nJ10sIHByb2dyZXNzUGF0dGVybjogL1Njb3JpbmcgKFxcZCspXFwvKFxcZCspL30sXG5dO1xuY29uc3QgU0NPUkVfU1RFUFMgPSBbXG4gIHtsYWJlbDogJ0VuZXJneScsICBzdGFnZTogJ2VuZXJneScsIHBhdHRlcm5zOiBbJ0NvbXB1dGluZyBhdWRpbyBlbmVyZ3knXX0sXG4gIHtsYWJlbDogJ1NjZW5lcycsICBzdGFnZTogJ3NjZW5lcycsIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzY2VuZSddfSxcbiAge2xhYmVsOiAnU2NvcmluZycsIHN0YWdlOiAnc2NvcmUnLCAgcGF0dGVybnM6IFsnU2NvcmluZyBjbGlwcyddLCBwcm9ncmVzc1BhdHRlcm46IC9TY29yaW5nIChcXGQrKVxcLyhcXGQrKS99LFxuXTtcbi8vIE1hcmtlci1kcml2ZW4gb25seSAodGhlIGFuYWx5emUtZnJhbWVzIFNTRSBlbWl0cyBubyBwcm9zZSBzdGFnZSBsaW5lcyksIHNvIHRoZXNlXG4vLyBjYXJyeSBubyBwYXR0ZXJucyAtIGp1c3QgdGhlIHR3byBAQFBST0dSRVNTIHN0YWdlcyB0aGUgdmlzaW9uIHJvdXRlIGVtaXRzLlxuY29uc3QgRlJBTUVTX1NURVBTID0gW1xuICB7bGFiZWw6ICdTYW1wbGUnLCAgIHN0YWdlOiAnZnJhbWVzX3NhbXBsZScsICAgcGF0dGVybnM6IFtdfSxcbiAge2xhYmVsOiAnRGVzY3JpYmUnLCBzdGFnZTogJ2ZyYW1lc19kZXNjcmliZScsIHBhdHRlcm5zOiBbXX0sXG5dO1xuXG4vLyBUaGUgZnVsbCBzZXQgb2Yga25vd24gQEBQUk9HUkVTUyBzdGFnZSBpZHMgLSB0aGUgSlMgbWlycm9yIG9mIHByb2dyZXNzLnB5J3Ncbi8vIFN0YWdlIGVudW0uIGZyYW1lc19zYW1wbGUvZnJhbWVzX2Rlc2NyaWJlIGRyaXZlIHRoZSBhbmFseXplLWZyYW1lcyBqb2IuIEtlcHRcbi8vIGFzIGl0cyBvd24gc2V0IChub3QgZGVyaXZlZCBmcm9tIHRoZSBzdGVwIGRlZnMpIHNvIGl0IHN0YXlzIHRoZSBjb3VwbGluZ1xuLy8gYW5jaG9yIGV2ZW4gZm9yIHN0YWdlcyB3aG9zZSBzdGVwIGRlZiBsaXZlcyBlbHNld2hlcmUuXG5jb25zdCBfUFJPR1JFU1NfUFJFRklYID0gJ0BAUFJPR1JFU1MgJztcbmNvbnN0IEpPQl9TVEFHRVMgPSBuZXcgU2V0KFtcbiAgJ2V4dHJhY3QnLCAndHJhbnNjcmliZScsICdzcGVha2VycycsICdnZW5lcmF0ZV9jbGlwcycsXG4gICdlbmVyZ3knLCAnc2NlbmVzJywgJ3Njb3JlJywgJ2ZyYW1lc19zYW1wbGUnLCAnZnJhbWVzX2Rlc2NyaWJlJyxcbl0pO1xuXG4vLyBNaXJyb3Igb2YgcHJvZ3Jlc3MucHkgcGFyc2VfcHJvZ3Jlc3M6IHJldHVybnMgdGhlIG1hcmtlciBwYXlsb2FkLCBvciBudWxsIGZvclxuLy8gYW55IG5vbi1tYXJrZXIgLyBtYWxmb3JtZWQgLyB1bmtub3duLXN0YWdlIGxpbmUgKHNvIG9yZGluYXJ5IGxvZyBvdXRwdXQgZmFsbHNcbi8vIHRocm91Z2ggdG8gdGhlIHByb3NlIGZhbGxiYWNrIHJhdGhlciB0aGFuIGJlaW5nIG1pc3JlYWQgYXMgcHJvZ3Jlc3MpLlxuZnVuY3Rpb24gcGFyc2VQcm9ncmVzcyhsaW5lKSB7XG4gIGlmICghbGluZSB8fCAhbGluZS5zdGFydHNXaXRoKF9QUk9HUkVTU19QUkVGSVgpKSByZXR1cm4gbnVsbDtcbiAgbGV0IHBheWxvYWQ7XG4gIHRyeSB7IHBheWxvYWQgPSBKU09OLnBhcnNlKGxpbmUuc2xpY2UoX1BST0dSRVNTX1BSRUZJWC5sZW5ndGgpKTsgfVxuICBjYXRjaCAoZSkgeyByZXR1cm4gbnVsbDsgfVxuICBpZiAoIXBheWxvYWQgfHwgdHlwZW9mIHBheWxvYWQgIT09ICdvYmplY3QnIHx8ICFKT0JfU1RBR0VTLmhhcyhwYXlsb2FkLnN0YWdlKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBwYXlsb2FkO1xufVxuXG4vLyBzdGVwSWR4IC0+IGEgdHJhbnNpZW50IHN0YXR1cyBtZXNzYWdlIHNob3duIGluIHBsYWNlIG9mIHRoZSBzdGVwJ3MgdGltaW5nXG4vLyBsYWJlbCAoZS5nLiBcIndhaXRpbmcgZm9yIHRoZSBzcGVlY2ggbW9kZWwgdG8gZmluaXNoIGRvd25sb2FkaW5nXCIpLiBTZXQgd2hlbiBhXG4vLyBzdGVwJ3Mgd2FpdFBhdHRlcm4gbWF0Y2hlcywgY2xlYXJlZCB3aGVuIHRoYXQgc3RlcCByZXBvcnRzIHJlYWwgcHJvZ3Jlc3MuXG5sZXQgX3N0ZXBXYWl0aW5nTXNnID0ge307XG5sZXQgX2pvYkFjdGl2ZSAgICAgPSBmYWxzZTtcbmxldCBfYWN0aXZlSm9iQ2xlYW51cCA9IG51bGw7XG5sZXQgX2pvYlRpbWVyICAgICAgPSBudWxsO1xubGV0IF9qb2JIaWRlVGltZXIgID0gbnVsbDtcbmxldCBfam9iUGF1c2FibGUgICA9IGZhbHNlO1xubGV0IF9qb2JQYXVzZWQgICAgID0gZmFsc2U7XG5sZXQgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBudWxsO1xubGV0IF9sYXN0R3B1U3RhdGUgID0gJ3VuYXZhaWxhYmxlJztcblxuLy8gQmVzdC1lZmZvcnQgbG9va3VwIG9mIGEgcGlsbCdzIHByZS1ydW4gdGltZSBlc3RpbWF0ZSAoZnJvbSB0aGUgbGFzdFxuLy8gL2FwaS9lc3RpbWF0ZSBjYWxsLCBzYXZlZCBieSByZW5kZXJFc3RpbWF0ZSkgZm9yIHVzZSBhcyBhIGhvdmVyIHRvb2x0aXAuXG5mdW5jdGlvbiBfZXN0aW1hdGVIbXNGb3Ioc3RlcERlZikge1xuICBjb25zdCBzdGVwcyA9IEFwcFN0YXRlLmxhc3RFc3RpbWF0ZVN0ZXBzO1xuICBpZiAoIXN0ZXBzIHx8ICFzdGVwRGVmLmVzdE1hdGNoKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbWF0Y2ggPSBzdGVwcy5maW5kKGVzID0+XG4gICAgc3RlcERlZi5lc3RNYXRjaC5zb21lKGtleSA9PiAoZXMubmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrZXkpKVxuICApO1xuICByZXR1cm4gbWF0Y2ggPyBtYXRjaC5obXMgOiBudWxsO1xufVxuXG4vLyBQZXItaXRlbSBidXR0b25zIHRoYXQgdHJpZ2dlciBhIGhlYXZ5IG9wIGFyZSB0YWdnZWQgZGF0YS1qb2ItYmxvY2tlZC4gRGlzYWJsZVxuLy8gdGhlbSAod2l0aCBhIHdoeS10b29sdGlwKSB3aGlsZSBhbnkgam9iIHJ1bnMgc28gYSB1c2VyIGNhbid0IHN0YXJ0IGEgc2Vjb25kIGpvYlxuLy8gdGhlIGJhY2tlbmQgd291bGQganVzdCA0MDkuIFRoZSBoZWFkZXIgI2J0bi1hbmFseXplIGlzIGhhbmRsZWQgaW5saW5lIGJlbG93LlxuLy8gcmVuZGVyRGV0YWlsIGNhbGxzIGFwcGx5Sm9iQmxvY2tlZFN0YXRlKCkgc28gYSBwYW5lbCByZWJ1aWx0IG1pZC1qb2IgY29tZXMgdXBcbi8vIGFscmVhZHkgZGlzYWJsZWQgLSB0aGUgdGFnIGxpdmVzIGluIGZyZXNobHktYnVpbHQgaW5uZXJIVE1MLCBub3QgYSBsaXZlIG5vZGUuXG5mdW5jdGlvbiBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnMoZGlzYWJsZWQpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtam9iLWJsb2NrZWRdJykuZm9yRWFjaChiID0+IHtcbiAgICBiLmRpc2FibGVkID0gZGlzYWJsZWQ7XG4gICAgYi50aXRsZSA9IGRpc2FibGVkID8gJ0Fub3RoZXIgam9iIGlzIHJ1bm5pbmcgLSB3YWl0IGZvciBpdCB0byBmaW5pc2ggb3IgY2FuY2VsIGl0JyA6ICcnO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gYXBwbHlKb2JCbG9ja2VkU3RhdGUoKSB7IF9zZXRKb2JCbG9ja2VkQnV0dG9ucyhfam9iQWN0aXZlKTsgfVxuXG5mdW5jdGlvbiBzdGFydEpvYlVJKHN0ZXBEZWZzLCBqb2JMYWJlbCwgY2FuY2VsbGFibGUgPSBmYWxzZSwgcGF1c2FibGUgPSBmYWxzZSkge1xuICBfam9iQWN0aXZlICAgICA9IHRydWU7XG4gIF9qb2JTdGVwRGVmcyAgID0gc3RlcERlZnM7XG4gIF9hY3RpdmVTdGVwSWR4ID0gLTE7XG4gIF9qb2JTdGFydFRpbWUgID0gRGF0ZS5ub3coKTtcbiAgX3N0ZXBTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICBfc3RlcFByb2dyZXNzICA9IHt9O1xuICBfc3RlcFJhdGVBbmNob3IgPSB7fTtcbiAgX3N0ZXBXYWl0aW5nTXNnID0ge307XG4gIF9qb2JQYXVzYWJsZSAgID0gcGF1c2FibGU7XG4gIF9qb2JQYXVzZWQgICAgID0gZmFsc2U7XG4gIF9hY3RpdmVDYW5jZWwgID0gX0FOQUxZWkVfQ0FOQ0VMO1xuICBpZiAoX2pvYlRpbWVyKSBjbGVhckludGVydmFsKF9qb2JUaW1lcik7XG4gIF9qb2JUaW1lciA9IHNldEludGVydmFsKF90aWNrSm9iVGltZXIsIDEwMDApO1xuICBpZiAoX2pvYkhpZGVUaW1lcikgeyBjbGVhclRpbWVvdXQoX2pvYkhpZGVUaW1lcik7IF9qb2JIaWRlVGltZXIgPSBudWxsOyB9XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2Itc3RlcHMnKS5pbm5lckhUTUwgPVxuICAgIGA8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tcmlnaHQ6NHB4XCI+JHtlc2NIdG1sKGpvYkxhYmVsKX08L3NwYW4+YCArXG4gICAgc3RlcERlZnMubWFwKChzLCBpKSA9PiB7XG4gICAgICBjb25zdCBlc3QgPSBfZXN0aW1hdGVIbXNGb3Iocyk7XG4gICAgICBjb25zdCB0aXRsZSA9IGVzdCA/IGAgdGl0bGU9XCJFc3RpbWF0ZWQ6ICR7ZXNjSHRtbChlc3QpfVwiYCA6ICcnO1xuICAgICAgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInN0ZXBcIiBpZD1cInN0ZXAtJHtpfVwiJHt0aXRsZX0+JHtzLmxhYmVsfTwvc3Bhbj5gO1xuICAgIH0pLmpvaW4oJycpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXN0YXR1cycpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlYWRlci1zcGFjZXInKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjYnRuLWFuYWx5emUsI2J0bi1zY29yZScpLmZvckVhY2goYiA9PiBiLmRpc2FibGVkID0gdHJ1ZSk7XG4gIGNvbnN0IGFuYWx5emVCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWFuYWx5emUnKTtcbiAgaWYgKGFuYWx5emVCdG4pIGFuYWx5emVCdG4udGl0bGUgPSAnQSBqb2IgaXMgYWxyZWFkeSBydW5uaW5nJztcbiAgX3NldEpvYkJsb2NrZWRCdXR0b25zKHRydWUpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNhbmNlbC1qb2InKS5zdHlsZS5kaXNwbGF5ID0gY2FuY2VsbGFibGUgPyAnJyA6ICdub25lJztcbiAgX3JlbmRlclBhdXNlVUkoKTtcbiAgaWYgKF9qb2JUaGVybWFsUG9sbFRpbWVyKSBjbGVhckludGVydmFsKF9qb2JUaGVybWFsUG9sbFRpbWVyKTtcbiAgaWYgKHBhdXNhYmxlKSB7XG4gICAgX2xhc3RHcHVTdGF0ZSA9ICd1bmF2YWlsYWJsZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1ncHUtdGVtcCcpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgX3BvbGxUaGVybWFsU3RhdHVzKCk7XG4gICAgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBzZXRJbnRlcnZhbChfcG9sbFRoZXJtYWxTdGF0dXMsIDUwMDApO1xuICB9XG4gIGlmICh3aW5kb3cuX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMpIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCk7XG59XG5cbi8vIFBvbGxlZCBldmVyeSA1cyAob25seSB3aGlsZSBhIHBhdXNhYmxlIC0gaS5lLiBhbmFseXplLXR5cGUgLSBqb2IgaXMgYWN0aXZlKSB0b1xuLy8gZHJpdmUgdGhlIGpvYi1oZWFkZXIgR1BVIHRlbXBlcmF0dXJlIHJlYWRvdXQgYW5kIHRoZSB3YXJuL2F1dG8tcGF1c2Ugbm90aWNlcy5cbi8vIFVzZXMgL2FwaS9zdGF0dXMgcmF0aGVyIHRoYW4gU1NFIGxvZy1saW5lIG1hdGNoaW5nIHNvIGl0IGFsc28gd29ya3MgY29ycmVjdGx5XG4vLyBhY3Jvc3MgdGhlIEpTIHNlcXVlbnRpYWwtc2VnbWVudCBydW5uZXJzJyBnYXBzIGJldHdlZW4gcGVyLXNlZ21lbnQgam9icy5cbmFzeW5jIGZ1bmN0aW9uIF9wb2xsVGhlcm1hbFN0YXR1cygpIHtcbiAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZmV0Y2goJy9hcGkvc3RhdHVzJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgaWYgKCFzdGF0dXMpIHJldHVybjtcbiAgY29uc3QgcmVhZG91dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItZ3B1LXRlbXAnKTtcbiAgaWYgKHJlYWRvdXQpIHtcbiAgICBpZiAoc3RhdHVzLmdwdV90ZW1wX2MgPT0gbnVsbCkge1xuICAgICAgcmVhZG91dC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWFkb3V0LnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICAgIHJlYWRvdXQuY2xhc3NOYW1lID0gJ2dwdS10ZW1wLXJlYWRvdXQnICsgKHN0YXR1cy5ncHVfc3RhdGUgPT09ICdvaycgPyAnJyA6IGAgJHtzdGF0dXMuZ3B1X3N0YXRlfWApO1xuICAgICAgcmVhZG91dC50ZXh0Q29udGVudCA9IGBHUFUgJHtNYXRoLnJvdW5kKHN0YXR1cy5ncHVfdGVtcF9jKX3CsENgO1xuICAgIH1cbiAgfVxuICBpZiAoc3RhdHVzLmdwdV9zdGF0ZSA9PT0gJ3dhcm4nICYmIF9sYXN0R3B1U3RhdGUgIT09ICd3YXJuJyAmJiBfbGFzdEdwdVN0YXRlICE9PSAncGF1c2UnKSB7XG4gICAgY29uc3QgbmV4dCA9IHN0YXR1cy50aGVybWFsX2F1dG9wYXVzZV9lbmFibGVkXG4gICAgICA/IGBBbmFseXNpcyB3aWxsIGF1dG8tcGF1c2UgaWYgaXQgcmVhY2hlcyAke01hdGgucm91bmQoc3RhdHVzLnRoZXJtYWxfcGF1c2VfYyl9wrBDLmBcbiAgICAgIDogYEF1dG8tcGF1c2UgaXMgb2ZmIC0gcGF1c2UgdGhlIGpvYiBtYW51YWxseSBpZiBpdCBrZWVwcyBjbGltYmluZy5gO1xuICAgIHdpbmRvdy5zaG93VG9hc3QoYEdQVSBydW5uaW5nIGhvdCAtICR7TWF0aC5yb3VuZChzdGF0dXMuZ3B1X3RlbXBfYyl9wrBDLiAke25leHR9YCwgJ3dhcm5pbmcnKTtcbiAgfVxuICBpZiAoc3RhdHVzLmdwdV9zdGF0ZSA9PT0gJ3BhdXNlJyAmJiBfbGFzdEdwdVN0YXRlICE9PSAncGF1c2UnKSB7XG4gICAgX2pvYlBhdXNlZCA9IHRydWU7XG4gICAgX3JlbmRlclBhdXNlVUkoKTtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KGBBdXRvLXBhdXNlZDogR1BVIHJlYWNoZWQgJHtNYXRoLnJvdW5kKHN0YXR1cy5ncHVfdGVtcF9jKX3CsEMgLSB3aWxsIGhvbGQgYmVmb3JlIHRoZSBuZXh0IHZpZGVvYCwgJ3dhcm5pbmcnLCB7XG4gICAgICBkdXJhdGlvbk1zOiAyMDAwMCxcbiAgICAgIGFjdGlvbjoge2xhYmVsOiAnUmVzdW1lIG5vdycsIG9uQ2xpY2s6IHRvZ2dsZVBhdXNlSm9ifSxcbiAgICB9KTtcbiAgfVxuICBfbGFzdEdwdVN0YXRlID0gc3RhdHVzLmdwdV9zdGF0ZTtcbn1cblxuLy8gXCJQYXVzZSBhZnRlciBjdXJyZW50IHZpZGVvXCIgdG9nZ2xlIGluIHRoZSBqb2IgaGVhZGVyIC0gb25seSBzaG93biBmb3Igam9ic1xuLy8gYmFja2VkIGJ5IHRoZSBwYXVzZSBmbGFnIGZpbGUgKHRoZSBzaW5nbGUgYW5hbHl6ZSBzdHJlYW0gYW5kIHRoZSBKU1xuLy8gc2VxdWVudGlhbC1zZWdtZW50IHJ1bm5lcnM7IHNlZSB0b2dnbGVQYXVzZUpvYikuXG5mdW5jdGlvbiBfcmVuZGVyUGF1c2VVSSgpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1wYXVzZS1qb2InKTtcbiAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXBhdXNlZC1iYWRnZScpO1xuICBpZiAoIWJ0biB8fCAhYmFkZ2UpIHJldHVybjtcbiAgYnRuLnN0eWxlLmRpc3BsYXkgPSBfam9iUGF1c2FibGUgPyAnJyA6ICdub25lJztcbiAgYnRuLnRleHRDb250ZW50ID0gX2pvYlBhdXNlZCA/ICdSZXN1bWUnIDogJ1BhdXNlIGFmdGVyIGN1cnJlbnQgdmlkZW8nO1xuICBiYWRnZS5zdHlsZS5kaXNwbGF5ID0gX2pvYlBhdXNlZCA/ICcnIDogJ25vbmUnO1xufVxuXG4vLyBSZWZsZWN0cyBhbiBhbHJlYWR5LXBhdXNlZCBqb2IgZGlzY292ZXJlZCB2aWEgL2FwaS9zdGF0dXMgKHBhZ2UgcmVjb25uZWN0KSAtXG4vLyBkb2VzIG5vdCBpdHNlbGYgY2FsbCB0aGUgcGF1c2UvcmVzdW1lIEFQSS5cbmZ1bmN0aW9uIF9zZXRQYXVzZWRVSUZyb21TdGF0dXMocGF1c2VkKSB7XG4gIF9qb2JQYXVzZWQgPSAhIXBhdXNlZDtcbiAgX3JlbmRlclBhdXNlVUkoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdG9nZ2xlUGF1c2VKb2IoKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tcGF1c2Utam9iJyk7XG4gIGNvbnN0IHdhbnRQYXVzZSA9ICFfam9iUGF1c2VkO1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2FuYWx5emUvJHt3YW50UGF1c2UgPyAncGF1c2UnIDogJ3Jlc3VtZSd9YCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIHdpbmRvdy5zaG93VG9hc3QoZm9ybWF0QXBpRXJyb3IoZGF0YSkgfHwgYENvdWxkIG5vdCAke3dhbnRQYXVzZSA/ICdwYXVzZScgOiAncmVzdW1lJ31gLCAnZXJyb3InKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGRhdGEuc3RhdHVzID09PSAnbm8tb3AnKSB7XG4gICAgICB3aW5kb3cuc2hvd1RvYXN0KGRhdGEubWVzc2FnZSB8fCAnTm8gYW5hbHlzaXMgaXMgcnVubmluZy4nLCAnaW5mbycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBfam9iUGF1c2VkID0gd2FudFBhdXNlO1xuICAgIF9yZW5kZXJQYXVzZVVJKCk7XG4gICAgd2luZG93LnNob3dUb2FzdCh3YW50UGF1c2UgPyAnV2lsbCBwYXVzZSBiZWZvcmUgdGhlIG5leHQgdmlkZW8nIDogJ1Jlc3VtZWQnLCAnaW5mbycpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KHdpbmRvdy5uZXRFcnJNc2coZXJyKSwgJ2Vycm9yJyk7XG4gIH0gZmluYWxseSB7XG4gICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIH1cbn1cblxuLy8gTWFyayBzdGVwICppZHgqIGFjdGl2ZSBhbmQgZXZlcnkgZWFybGllciBzdGVwIGRvbmUuIFNoYXJlZCBieSB0aGUgcHJvc2Vcbi8vIG1hdGNoZXIgKHVwZGF0ZUpvYlVJKSBhbmQgdGhlIG1hcmtlciBwYXRoIChfZHJpdmVTdGVwRnJvbU1hcmtlcikgc28gYSBzdGFnZVxuLy8gYWR2YW5jZSBiZWhhdmVzIGlkZW50aWNhbGx5IGhvd2V2ZXIgaXQgd2FzIGRldGVjdGVkLlxuZnVuY3Rpb24gX2FjdGl2YXRlU3RlcChpZHgpIHtcbiAgY29uc3QgcHJldlN0ZXBJZHggPSBfYWN0aXZlU3RlcElkeDtcbiAgZm9yIChsZXQgaiA9IDA7IGogPCBpZHg7IGorKykge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtqfWApO1xuICAgIGlmIChlbCkgeyBlbC5jbGFzc05hbWUgPSAnc3RlcCBkb25lJzsgZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7IGVsLnRleHRDb250ZW50ID0gJ+Kckyc7IGVsLnRpdGxlID0gX2pvYlN0ZXBEZWZzW2pdLmxhYmVsOyB9XG4gIH1cbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2lkeH1gKTtcbiAgaWYgKGVsKSB7IGVsLmNsYXNzTmFtZSA9ICdzdGVwIGFjdGl2ZSc7IF9hY3RpdmVTdGVwSWR4ID0gaWR4OyB9XG4gIGlmIChfYWN0aXZlU3RlcElkeCAhPT0gcHJldlN0ZXBJZHgpIHtcbiAgICBfc3RlcFN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgLy8gV2hlbiB0aGUgcGlwZWxpbmUgYWR2YW5jZXMgYSBzdGFnZSwgcmVmcmVzaCB0aGUgc2lkZWJhciBzbyBhIG5ld2x5LWFuYWx5emluZ1xuICAgIC8vIHJlY29yZGluZyBhcHBlYXJzIChyZXBsYWNpbmcgaXRzIHBsYWNlaG9sZGVyKSBhbmQgaXRzIHN0YXR1cyBzdGF5cyBjdXJyZW50LFxuICAgIC8vIGFuZCByZWZyZXNoIHRoZSBvcGVuIGNsaXAgbGlzdCB0byBwaWNrIHVwIGZyZXNobHktY29tbWl0dGVkIGNsaXBzL3Njb3Jlcy5cbiAgICBfZGVib3VuY2VkU2lkZWJhclJlZnJlc2goKTtcbiAgICBfZGVib3VuY2VkQ2xpcExpc3RSZWZyZXNoKCk7XG4gIH1cbn1cblxuLy8gUmVjb3JkIGEgc3RlcCdzIGN1cnJlbnQvdG90YWwsIGFuY2hvcmluZyB0aGUgdGhyb3VnaHB1dCByYXRlIGF0IHRoZSBmaXJzdFxuLy8gb2JzZXJ2ZWQgY291bnQgc28gYSBjb2xkIGZpcnN0IGl0ZW0gaXMgZXhjbHVkZWQgZnJvbSB0aGUgRVRBIGV4dHJhcG9sYXRpb24uXG5mdW5jdGlvbiBfc2V0U3RlcFByb2dyZXNzKGlkeCwgY3VycmVudCwgdG90YWwpIHtcbiAgLy8gUmVhbCBwcm9ncmVzcyBtZWFucyBhbnkgd2FpdCAoZS5nLiBtb2RlbCBkb3dubG9hZCkgaXMgb3ZlciAtIGRyb3AgaXQgc28gdGhlXG4gIC8vIHBpbGwgc3dpdGNoZXMgYmFjayB0byBsaXZlIGNvdW50cy5cbiAgZGVsZXRlIF9zdGVwV2FpdGluZ01zZ1tpZHhdO1xuICBfc3RlcFByb2dyZXNzW2lkeF0gPSB7Y3VycmVudCwgdG90YWx9O1xuICBpZiAoIV9zdGVwUmF0ZUFuY2hvcltpZHhdKSBfc3RlcFJhdGVBbmNob3JbaWR4XSA9IHt0OiBEYXRlLm5vdygpLCBjdXJyZW50fTtcbiAgX3JlbmRlclN0ZXBQaWxsKGlkeCk7XG4gIF9kZWJvdW5jZWRDbGlwTGlzdFJlZnJlc2goKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlSm9iVUkobGluZSkge1xuICBfam9iU3RlcERlZnMuZm9yRWFjaCgocywgaSkgPT4ge1xuICAgIGlmIChzLnBhdHRlcm5zLnNvbWUocCA9PiBsaW5lLmluY2x1ZGVzKHApKSkgX2FjdGl2YXRlU3RlcChpKTtcbiAgfSk7XG4gIGNvbnN0IGFjdGl2ZURlZiA9IF9qb2JTdGVwRGVmc1tfYWN0aXZlU3RlcElkeF07XG4gIGlmIChhY3RpdmVEZWYgJiYgYWN0aXZlRGVmLndhaXRQYXR0ZXJuICYmIGFjdGl2ZURlZi53YWl0UGF0dGVybi50ZXN0KGxpbmUpKSB7XG4gICAgX3N0ZXBXYWl0aW5nTXNnW19hY3RpdmVTdGVwSWR4XSA9ICd3YWl0aW5nIGZvciB0aGUgc3BlZWNoIG1vZGVsIHRvIGZpbmlzaCBkb3dubG9hZGluZyc7XG4gICAgX3JlbmRlclN0ZXBQaWxsKF9hY3RpdmVTdGVwSWR4KTtcbiAgfVxuICBpZiAoYWN0aXZlRGVmICYmIGFjdGl2ZURlZi5wcm9ncmVzc1BhdHRlcm4pIHtcbiAgICBjb25zdCBtID0gbGluZS5tYXRjaChhY3RpdmVEZWYucHJvZ3Jlc3NQYXR0ZXJuKTtcbiAgICBpZiAobSkgX3NldFN0ZXBQcm9ncmVzcyhfYWN0aXZlU3RlcElkeCwgcGFyc2VJbnQobVsxXSwgMTApLCBwYXJzZUludChtWzJdLCAxMCkpO1xuICB9XG4gIGlmICh3aW5kb3cuX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpO1xufVxuXG4vLyBEcml2ZSB0aGUgcGlsbCByb3cgZnJvbSBhIHBhcnNlZCBAQFBST0dSRVNTIG1hcmtlcjogZGV0ZXJtaW5pc3RpYyBzdGFnZVxuLy8gYWR2YW5jZSBwbHVzIG9wdGlvbmFsIGN1cnJlbnQvdG90YWwsIGtleWVkIG9uIHRoZSBzdGVwIGRlZidzIHN0YWdlIGlkLlxuZnVuY3Rpb24gX2RyaXZlU3RlcEZyb21NYXJrZXIobWFya2VyKSB7XG4gIGNvbnN0IGlkeCA9IF9qb2JTdGVwRGVmcy5maW5kSW5kZXgocyA9PiBzLnN0YWdlID09PSBtYXJrZXIuc3RhZ2UpO1xuICBpZiAoaWR4IDwgMCkgcmV0dXJuO1xuICBfYWN0aXZhdGVTdGVwKGlkeCk7XG4gIGlmICh0eXBlb2YgbWFya2VyLmRvbmUgPT09ICdudW1iZXInICYmIHR5cGVvZiBtYXJrZXIudG90YWwgPT09ICdudW1iZXInICYmIG1hcmtlci50b3RhbCA+IDApIHtcbiAgICBfc2V0U3RlcFByb2dyZXNzKGlkeCwgbWFya2VyLmRvbmUsIG1hcmtlci50b3RhbCk7XG4gIH1cbiAgaWYgKHdpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCk7XG59XG5cbmxldCBfc2lkZWJhclJlZnJlc2hUaW1lciA9IG51bGw7XG5mdW5jdGlvbiBfZGVib3VuY2VkU2lkZWJhclJlZnJlc2goKSB7XG4gIGlmIChfc2lkZWJhclJlZnJlc2hUaW1lcikgcmV0dXJuO1xuICBfc2lkZWJhclJlZnJlc2hUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4geyBfc2lkZWJhclJlZnJlc2hUaW1lciA9IG51bGw7IHdpbmRvdy5sb2FkVmlkZW9zKCk7IH0sIDEyMDApO1xufVxuXG5sZXQgX2NsaXBMaXN0UmVmcmVzaFRpbWVyID0gbnVsbDtcbi8vIFNhbWUgcHVzaC1kcml2ZW4tYnV0LWRlYm91bmNlZCBwYXR0ZXJuIGFzIF9kZWJvdW5jZWRTaWRlYmFyUmVmcmVzaCBhYm92ZSxcbi8vIHRyaWdnZXJlZCBvZmYgdGhlIFNTRSBsaW5lIHN0cmVhbSByYXRoZXIgdGhhbiBhIHBvbGxpbmcgdGltZXIuIE9ubHkgcmVmcmVzaGVzXG4vLyB3aGVuIHRoZSB2aWRlbyBiZWluZyBhbmFseXplZCBpcyB0aGUgb25lIGN1cnJlbnRseSBvcGVuLCBzbyBuZXdseS1jb21taXR0ZWRcbi8vIGNsaXAgc2NvcmVzICh5dXVfY2xpcC9zY29yaW5nL2VuZ2luZS5weSBub3cgY29tbWl0cyBwZXIgY2xpcCkgZmlsbCBpbnRvIHRoZVxuLy8gdmlzaWJsZSBsaXN0IGxpdmUgaW5zdGVhZCBvZiByZXF1aXJpbmcgYSBtYW51YWwgcGFnZSByZWZyZXNoLlxuZnVuY3Rpb24gX2RlYm91bmNlZENsaXBMaXN0UmVmcmVzaCgpIHtcbiAgaWYgKF9jbGlwTGlzdFJlZnJlc2hUaW1lcikgcmV0dXJuO1xuICBfY2xpcExpc3RSZWZyZXNoVGltZXIgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICBfY2xpcExpc3RSZWZyZXNoVGltZXIgPSBudWxsO1xuICAgIGlmICghQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCB8fCAhQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lKSByZXR1cm47XG4gICAgY29uc3QgYW5hbHl6aW5nID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmZpbGVuYW1lID09PSBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUpO1xuICAgIGlmICghYW5hbHl6aW5nIHx8IGFuYWx5emluZy5pZCAhPT0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkgcmV0dXJuO1xuICAgIEFwcFN0YXRlLmNsaXBzID0gYXdhaXQgZmV0Y2god2luZG93Ll9jbGlwc0xpc3RVcmwoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gICAgd2luZG93Ll9yZW5kZXJDbGlwcygpO1xuICB9LCAxMjAwKTtcbn1cblxuLy8gQnVpbGRzIHRoZSBsaXZlIGxhYmVsIGZvciBhIHN0ZXAgcGlsbDogXCJTY29yZSDCtyAzLzEyICgyNSUpIMK3IDA6NDIgKH4yOjA2XG4vLyBsZWZ0KVwiIG9uY2UgcGVyLWl0ZW0gY291bnRzIGFycml2ZSBmcm9tIHRoZSBzdWJwcm9jZXNzIGxvZzsgZWxhcHNlZC1vbmx5XG4vLyAoZmFsbGluZyBiYWNrIHRvIHRoZSBwcmUtcnVuIC9hcGkvZXN0aW1hdGUgZmlndXJlKSBiZWZvcmUgdGhlIGZpcnN0IGNvdW50LlxuZnVuY3Rpb24gX3N0ZXBQaWxsTGFiZWwoaWR4KSB7XG4gIGNvbnN0IGRlZiA9IF9qb2JTdGVwRGVmc1tpZHhdO1xuICBpZiAoIWRlZikgcmV0dXJuIHt0ZXh0OiAnJywgcGN0OiBudWxsfTtcbiAgY29uc3Qgd2FpdGluZyA9IF9zdGVwV2FpdGluZ01zZ1tpZHhdO1xuICBpZiAod2FpdGluZykgcmV0dXJuIHt0ZXh0OiBgJHtkZWYubGFiZWx9IMK3ICR7d2FpdGluZ31gLCBwY3Q6IG51bGx9O1xuICBjb25zdCBlbGFwc2VkTXMgPSBEYXRlLm5vdygpIC0gX3N0ZXBTdGFydFRpbWU7XG4gIGNvbnN0IHByb2dyZXNzICA9IF9zdGVwUHJvZ3Jlc3NbaWR4XTtcbiAgaWYgKCFwcm9ncmVzcyB8fCAhcHJvZ3Jlc3MuY3VycmVudCkge1xuICAgIGNvbnN0IGVzdCA9IF9lc3RpbWF0ZUhtc0ZvcihkZWYpO1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0OiBlc3QgPyBgJHtkZWYubGFiZWx9IMK3ICR7X2ZtdEVsYXBzZWQoZWxhcHNlZE1zKX0gKH4ke2VzdH0pYCA6IGAke2RlZi5sYWJlbH0gwrcgJHtfZm10RWxhcHNlZChlbGFwc2VkTXMpfWAsXG4gICAgICBwY3Q6IG51bGwsXG4gICAgfTtcbiAgfVxuICBjb25zdCB7Y3VycmVudCwgdG90YWx9ID0gcHJvZ3Jlc3M7XG4gIGNvbnN0IHBjdCAgICA9IE1hdGgucm91bmQoY3VycmVudCAvIHRvdGFsICogMTAwKTtcbiAgLy8gRVRBIGZyb20gdGhyb3VnaHB1dCBzaW5jZSB0aGUgcmF0ZSBhbmNob3IgKGZpcnN0IG9ic2VydmVkIGNvdW50KSwgbm90IGZyb21cbiAgLy8gZWxhcHNlZC9jdXJyZW50IC0gdGhlIGxhdHRlciBsZXQgYSBzbG93IGNvbGQgZmlyc3QgaXRlbSBwcm9qZWN0IGFic3VyZFxuICAvLyBmaWd1cmVzIChlLmcuIFwiNzcgbWluIGxlZnRcIiB0aGF0IHZhbmlzaGVkIHdoZW4gdGhlIHN0ZXAgZmluaXNoZWQgc2Vjb25kcyBsYXRlcikuXG4gIGNvbnN0IGFuY2hvciA9IF9zdGVwUmF0ZUFuY2hvcltpZHhdO1xuICBsZXQgZXRhID0gJyc7XG4gIGlmIChhbmNob3IgJiYgY3VycmVudCA+IGFuY2hvci5jdXJyZW50KSB7XG4gICAgY29uc3QgbXNQZXJJdGVtID0gKERhdGUubm93KCkgLSBhbmNob3IudCkgLyAoY3VycmVudCAtIGFuY2hvci5jdXJyZW50KTtcbiAgICBjb25zdCByZW1haW5pbmdNcyA9IG1zUGVySXRlbSAqICh0b3RhbCAtIGN1cnJlbnQpO1xuICAgIGlmIChpc0Zpbml0ZShyZW1haW5pbmdNcykgJiYgcmVtYWluaW5nTXMgPj0gMCkgZXRhID0gYCAofiR7X2ZtdEVsYXBzZWQocmVtYWluaW5nTXMpfSBsZWZ0KWA7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB0ZXh0OiBgJHtkZWYubGFiZWx9IMK3ICR7Y3VycmVudH0vJHt0b3RhbH0gKCR7cGN0fSUpIMK3ICR7X2ZtdEVsYXBzZWQoZWxhcHNlZE1zKX0ke2V0YX1gLFxuICAgIHBjdCxcbiAgfTtcbn1cblxuLy8gUGFpbnRzIG9uZSBzdGVwIHBpbGwncyB0ZXh0IGFuZCwgZm9yIGFuIGluLXByb2dyZXNzIHN0ZXAgd2l0aCBrbm93biBjb3VudHMsXG4vLyBhIHR3by10b25lIGdyYWRpZW50IGZpbGwgc3RhbmRpbmcgaW4gZm9yIGEgcHJvZ3Jlc3MgYmFyIChkb25lL3BlbmRpbmcgcGlsbHNcbi8vIGtlZXAgdGhlaXIgZmxhdCBDU1MgY2xhc3MgY29sb3IgLSBubyBmaWxsKS4gU2hhcmVkIGJ5IHRoZSBoZWFkZXIgcGlsbCByb3dcbi8vIGFuZCAodmlhIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIHRoZSBpbi1kZXRhaWwgbWlycm9yIHBhbmVsLlxuZnVuY3Rpb24gX3JlbmRlclN0ZXBQaWxsKGlkeCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7aWR4fWApO1xuICBpZiAoIWVsIHx8ICFlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGl2ZScpKSByZXR1cm47XG4gIGNvbnN0IHt0ZXh0LCBwY3R9ID0gX3N0ZXBQaWxsTGFiZWwoaWR4KTtcbiAgZWwudGV4dENvbnRlbnQgPSB0ZXh0O1xuICBlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBwY3QgIT0gbnVsbFxuICAgID8gYGxpbmVhci1ncmFkaWVudCh0byByaWdodCwgdmFyKC0tZ3JlZW4pICR7cGN0fSUsIHZhcigtLWFjY2VudCkgJHtwY3R9JSlgXG4gICAgOiAnJztcbn1cblxuZnVuY3Rpb24gX3RpY2tKb2JUaW1lcigpIHtcbiAgaWYgKHdpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCk7XG4gIGlmIChfYWN0aXZlU3RlcElkeCA8IDApIHJldHVybjtcbiAgX3JlbmRlclN0ZXBQaWxsKF9hY3RpdmVTdGVwSWR4KTtcbn1cblxuZnVuY3Rpb24gZW5kSm9iVUkoKSB7XG4gIGlmIChfam9iVGltZXIpIHsgY2xlYXJJbnRlcnZhbChfam9iVGltZXIpOyBfam9iVGltZXIgPSBudWxsOyB9XG4gIF9qb2JTdGVwRGVmcy5mb3JFYWNoKChzLCBpKSA9PiB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2l9YCk7XG4gICAgaWYgKGVsKSB7IGVsLmNsYXNzTmFtZSA9ICdzdGVwIGRvbmUnOyBlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnJzsgZWwudGV4dENvbnRlbnQgPSAn4pyTJzsgZWwudGl0bGUgPSBzLmxhYmVsOyB9XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNhbmNlbC1qb2InKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBfam9iUGF1c2FibGUgPSBmYWxzZTtcbiAgX2pvYlBhdXNlZCAgID0gZmFsc2U7XG4gIF9yZW5kZXJQYXVzZVVJKCk7XG4gIGlmIChfam9iVGhlcm1hbFBvbGxUaW1lcikgeyBjbGVhckludGVydmFsKF9qb2JUaGVybWFsUG9sbFRpbWVyKTsgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBudWxsOyB9XG4gIGNvbnN0IGdwdVRlbXAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWdwdS10ZW1wJyk7XG4gIGlmIChncHVUZW1wKSBncHVUZW1wLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIF9qb2JBY3RpdmUgPSBmYWxzZTtcbiAgX2pvYkhpZGVUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIF9qb2JIaWRlVGltZXIgPSBudWxsO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2Itc3RhdHVzJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWFkZXItc3BhY2VyJykuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyNidG4tYW5hbHl6ZSwjYnRuLXNjb3JlJykuZm9yRWFjaChiID0+IGIuZGlzYWJsZWQgPSBmYWxzZSk7XG4gICAgY29uc3QgYW5hbHl6ZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tYW5hbHl6ZScpO1xuICAgIGlmIChhbmFseXplQnRuKSBhbmFseXplQnRuLnRpdGxlID0gJyc7XG4gICAgX3NldEpvYkJsb2NrZWRCdXR0b25zKGZhbHNlKTtcbiAgICBjb25zdCB0b3RhbEFwcHJvdmVkID0gKEFwcFN0YXRlLnZpZGVvcyB8fCBbXSkucmVkdWNlKChuLCB2KSA9PiBuICsgdi5hcHByb3ZlZCwgMCk7XG4gICAgd2luZG93Ll91cGRhdGVEZW1vQnV0dG9uKHRvdGFsQXBwcm92ZWQpO1xuICAgIGlmICh3aW5kb3cuX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMpIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCk7XG4gIH0sIDIwMDApO1xufVxuXG4vLyDilIDilIAgU1NFIHRyYW5zcG9ydCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIExvdy1sZXZlbCBTU0UgcmVhZGVyIHVzaW5nIGZldGNoICsgUmVhZGFibGVTdHJlYW0gc28gbm9uLTIwMCBIVFRQIHJlc3BvbnNlc1xuLy8gY2FuIGJlIHJlYWQgZm9yIHRoZWlyIGVycm9yIGRldGFpbCAoRXZlbnRTb3VyY2Uub25lcnJvciBjYW5ub3QgZG8gdGhpcykuXG4vL1xuLy8gb25MaW5lKG1zZykgIC0gY2FsbGVkIGZvciBlYWNoIHBhcnNlZCBTU0UgcGF5bG9hZCBiZWZvcmUgX19ET05FX19cbi8vIG9uRG9uZShtc2cpICAtIGNhbGxlZCB3aXRoIHRoZSBmdWxsIF9fRE9ORV9fIHBheWxvYWQgKHN0cmluZyBvciBvYmplY3QpXG4vLyBvbkVycm9yKHN0cikgLSBjYWxsZWQgd2l0aCBhIHBsYWluLWxhbmd1YWdlIG1lc3NhZ2Ugb24gSFRUUCBlcnJvciBvciBuZXR3b3JrIGxvc3Ncbi8vXG4vLyBvcHRzIChvcHRpb25hbCk6IGV4dHJhIGZldGNoIGluaXQsIGUuZy4ge21ldGhvZDogJ1BPU1QnfSBmb3IgdGhlIG1vZGVsLWRvd25sb2FkXG4vLyBlbmRwb2ludHMsIHdoaWNoIGFyZSBQT1NULW9ubHkgKGEgR0VUIDQwNXMpLiBEZWZhdWx0cyB0byBhIEdFVCwgYXMgdGhlIGFuYWx5emVcbi8vIGFuZCBzY29yZSBTU0Ugc3RyZWFtcyB1c2UuXG4vLyBSZXR1cm5zIGEgaGFuZGxlIHdpdGggLmNsb3NlKCkgdGhhdCBhYm9ydHMgdGhlIGluLWZsaWdodCByZXF1ZXN0LlxuZnVuY3Rpb24gX29wZW5TU0UodXJsLCBvbkxpbmUsIG9uRG9uZSwgb25FcnJvciwgb3B0cyA9IHt9KSB7XG4gIGNvbnN0IGN0cmwgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIGNvbnN0IGhhbmRsZSA9IHtjbG9zZTogKCkgPT4gY3RybC5hYm9ydCgpfTtcbiAgZmV0Y2godXJsLCB7c2lnbmFsOiBjdHJsLnNpZ25hbCwgLi4ub3B0c30pLnRoZW4oYXN5bmMgcmVzID0+IHtcbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgY29uc3QgZXJyRGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgICBvbkVycm9yKGZvcm1hdEFwaUVycm9yKGVyckRhdGEpIHx8IGBTZXJ2ZXIgZXJyb3IgJHtyZXMuc3RhdHVzfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZWFkZXIgPSByZXMuYm9keS5nZXRSZWFkZXIoKTtcbiAgICBjb25zdCBkZWMgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICBsZXQgYnVmID0gJyc7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IHtkb25lLCB2YWx1ZX0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgIGlmICghY3RybC5zaWduYWwuYWJvcnRlZCkgb25FcnJvcignU3RyZWFtIGVuZGVkIHdpdGhvdXQgYSBjb21wbGV0aW9uIHNpZ25hbCcpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBidWYgKz0gZGVjLmRlY29kZSh2YWx1ZSwge3N0cmVhbTogdHJ1ZX0pO1xuICAgICAgICBjb25zdCBsaW5lcyA9IGJ1Zi5zcGxpdCgnXFxuJyk7XG4gICAgICAgIGJ1ZiA9IGxpbmVzLnBvcCgpO1xuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnZGF0YTogJykpIGNvbnRpbnVlO1xuICAgICAgICAgIGNvbnN0IG1zZyA9IEpTT04ucGFyc2UobGluZS5zbGljZSg2KSk7XG4gICAgICAgICAgY29uc3QgaXNEb25lID0gbXNnID09PSAnX19ET05FX18nIHx8IChtc2cgJiYgdHlwZW9mIG1zZyA9PT0gJ29iamVjdCcgJiYgbXNnLnR5cGUgPT09ICdfX0RPTkVfXycpO1xuICAgICAgICAgIGlmIChpc0RvbmUpIHsgb25Eb25lKG1zZyk7IHJldHVybjsgfVxuICAgICAgICAgIG9uTGluZShtc2cpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoIWN0cmwuc2lnbmFsLmFib3J0ZWQpIG9uRXJyb3IoJ0Nvbm5lY3Rpb24gbG9zdCAtIHNlcnZlciBkaXNjb25uZWN0ZWQnKTtcbiAgICB9XG4gIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgaWYgKCFjdHJsLnNpZ25hbC5hYm9ydGVkKSBvbkVycm9yKHdpbmRvdy5uZXRFcnJNc2coZXJyKSk7XG4gIH0pO1xuICByZXR1cm4gaGFuZGxlO1xufVxuXG4vLyBPbmx5IG9uZSBqb2Igc3RyZWFtIGlzIGxpdmUgYXQgYSB0aW1lLiBTdGFydGluZyBhIG5ldyBqb2IgYWJvcnRzIHRoZSBwcmV2aW91c1xuLy8gb25lIC0gYnV0IGFib3J0aW5nIHN1cHByZXNzZXMgaXRzIG9uRG9uZS9vbkVycm9yLCBzbyBpdHMgVUkgdGVhcmRvd24gKGJ1dHRvblxuLy8gcmUtZW5hYmxlLCBwcm9ncmVzcyBwaWxsKSB3b3VsZCBuZXZlciBydW4uIEVhY2ggam9iIHJlZ2lzdGVycyB0aGF0IHRlYXJkb3duIGFzXG4vLyBhIGNsZWFudXAgc28gYSBzdXBlcnNlZGluZyBqb2IgY2FuIHJ1biBpdC4gU2VlIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0uXG5mdW5jdGlvbiBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgY2xlYW51cCA9IG51bGwpIHtcbiAgX2FjdGl2ZUVTID0gaGFuZGxlO1xuICBfYWN0aXZlSm9iQ2xlYW51cCA9IGNsZWFudXA7XG59XG5cbmZ1bmN0aW9uIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpIHtcbiAgaWYgKF9hY3RpdmVFUyA9PT0gaGFuZGxlKSB7IF9hY3RpdmVFUyA9IG51bGw7IF9hY3RpdmVKb2JDbGVhbnVwID0gbnVsbDsgfVxufVxuXG5mdW5jdGlvbiBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCkge1xuICBpZiAoX2FjdGl2ZUVTKSB7IF9hY3RpdmVFUy5jbG9zZSgpOyBfYWN0aXZlRVMgPSBudWxsOyB9XG4gIGlmIChfYWN0aXZlSm9iQ2xlYW51cCkgeyBjb25zdCBjbGVhbnVwID0gX2FjdGl2ZUpvYkNsZWFudXA7IF9hY3RpdmVKb2JDbGVhbnVwID0gbnVsbDsgY2xlYW51cCgpOyB9XG59XG5cbi8vIEd1YXJkIGZvciBjb21wZXRpbmcgU1NFIGpvYnMgKHJlLXNjb3JlLCB0aW1lbGluZSwgc3VtbWFyeSwgZGlhcml6ZSwg4oCmKS4gV2hpbGVcbi8vIGFuIGFuYWx5c2lzIGlzIHJ1bm5pbmcgdGhlIGJhY2tlbmQgNDA5cyB0aGVzZSBhbnl3YXksIGJ1dCB0aGV5IGNhbGxcbi8vIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKSBmaXJzdCwgd2hpY2ggd291bGQgdGVhciBkb3duIHRoZSBsaXZlIGFuYWx5emUgcHJvZ3Jlc3Ncbi8vIFVJIGJlZm9yZSB0aGUgcmVqZWN0aW9uIGxhbmRzLiBSZXR1cm5zIHRydWUgKGFuZCB0b2FzdHMpIHNvIHRoZSBjYWxsZXIgY2FuIGJhaWxcbi8vIGJlZm9yZSBhbnkgc2lkZSBlZmZlY3RzLlxuZnVuY3Rpb24gX2Jsb2NrZWRCeUFuYWx5emUoYWN0aW9uTGFiZWwpIHtcbiAgaWYgKCFBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUpIHJldHVybiBmYWxzZTtcbiAgd2luZG93LnNob3dUb2FzdChgV2FpdCBmb3IgdGhlIGN1cnJlbnQgYW5hbHlzaXMgdG8gZmluaXNoIGJlZm9yZSB5b3UgJHthY3Rpb25MYWJlbH0uYCwgJ3dhcm5pbmcnKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIG9uTGluZSAob3B0aW9uYWwpOiBjYWxsZWQgd2l0aCBlYWNoIHJhdyBTU0UgcGF5bG9hZCBsaW5lIGJlZm9yZSBfX0RPTkVfXywgZm9yXG4vLyBjYWxsZXJzIHRoYXQgbmVlZCBsaXZlIHByb2dyZXNzIHRleHQgKGUuZy4gdGhlIHByb3h5LWJ1aWxkIHBlcmNlbnRhZ2UpLlxuLy8gb3B0cyAob3B0aW9uYWwpOiBmZXRjaCBpbml0IHBhc3NlZCB0aHJvdWdoIHRvIF9vcGVuU1NFLCBlLmcuIHttZXRob2Q6ICdQT1NUJ31cbi8vIGZvciBhIFBPU1Qtb25seSBTU0UgZW5kcG9pbnQgKGFuYWx5emUtZnJhbWVzKS5cbi8vIG9uRXJyb3IgKG9wdGlvbmFsKTogY2FsbGVkIGFmdGVyIHRoZSBidWlsdC1pbiBlcnJvciBoYW5kbGluZyAodG9hc3QgKyBlbmRKb2JVSSlcbi8vIHNvIGEgY2FsbGVyIGNhbiBydW4gaXRzIG93biB0ZXJtaW5hbCBjbGVhbnVwIG9uIGFuIEhUVFAvdHJhbnNwb3J0IGZhaWx1cmUgLSBlLmcuXG4vLyBjbGVhcmluZyBhIHBlci1pdGVtIGluLWZsaWdodCBmbGFnIHRoYXQgb25seSBpdHMgb25Eb25lIHdvdWxkIG90aGVyd2lzZSBjbGVhci5cbmZ1bmN0aW9uIHN0cmVhbVNTRSh1cmwsIG9uRG9uZSwgc3RlcERlZnMsIGpvYkxhYmVsLCBjYW5jZWxsYWJsZSA9IGZhbHNlLCBvbkxpbmUgPSBudWxsLCBwYXVzYWJsZSA9IGZhbHNlLCBvcHRzID0ge30sIG9uRXJyb3IgPSBudWxsKSB7XG4gIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKTtcbiAgaWYgKHN0ZXBEZWZzKSBzdGFydEpvYlVJKHN0ZXBEZWZzLCBqb2JMYWJlbCwgY2FuY2VsbGFibGUsIHBhdXNhYmxlKTtcbiAgY29uc3QgaGFuZGxlID0gX29wZW5TU0UoXG4gICAgdXJsLFxuICAgIHRleHQgPT4ge1xuICAgICAgLy8gQSBAQFBST0dSRVNTIG1hcmtlciBkcml2ZXMgdGhlIHBpbGxzIGRldGVybWluaXN0aWNhbGx5IGFuZCBpcyBOT1Qgc2hvd24gYXNcbiAgICAgIC8vIGEgbG9nIGxpbmU7IGV2ZXJ5dGhpbmcgZWxzZSBmYWxscyB0aHJvdWdoIHRvIHRoZSBsb2cgKyBwcm9zZSBmYWxsYmFjay5cbiAgICAgIGNvbnN0IG1hcmtlciA9IHN0ZXBEZWZzID8gcGFyc2VQcm9ncmVzcyh0ZXh0KSA6IG51bGw7XG4gICAgICBpZiAobWFya2VyKSB7IF9kcml2ZVN0ZXBGcm9tTWFya2VyKG1hcmtlcik7IHJldHVybjsgfVxuICAgICAgd2luZG93LmFwcGVuZExvZyh0ZXh0KTsgaWYgKG9uTGluZSkgb25MaW5lKHRleHQpOyBpZiAoc3RlcERlZnMpIHVwZGF0ZUpvYlVJKHRleHQpO1xuICAgIH0sXG4gICAgKCkgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICBpZiAoc3RlcERlZnMpIGVuZEpvYlVJKCk7XG4gICAgICBpZiAob25Eb25lKSBvbkRvbmUoKTtcbiAgICB9LFxuICAgIGVyck1zZyA9PiB7XG4gICAgICBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKTtcbiAgICAgIHdpbmRvdy5hcHBlbmRMb2coYFske2Vyck1zZ31dYCk7XG4gICAgICB3aW5kb3cuc2hvd1RvYXN0KGVyck1zZywgJ2Vycm9yJyk7XG4gICAgICB3aW5kb3cuU291bmRGeC5wbGF5KCdlcnJvcicpO1xuICAgICAgaWYgKHN0ZXBEZWZzKSBlbmRKb2JVSSgpO1xuICAgICAgaWYgKG9uRXJyb3IpIG9uRXJyb3IoZXJyTXNnKTtcbiAgICAgIHdpbmRvdy5sb2FkVmlkZW9zKCk7XG4gICAgfSxcbiAgICBvcHRzLFxuICApO1xuICBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgc3RlcERlZnMgPyBlbmRKb2JVSSA6IG51bGwpO1xufVxuXG4vLyBQb2xsZWQgYnkgdGhlIEpTIHNlcXVlbnRpYWwtc2VnbWVudCBydW5uZXJzIChhbmFseXplLmpzJ3MgcHJlLXNwbGl0IGxvb3AsXG4vLyBzcGxpdC5qcydzIHJlLXNwbGl0IGxvb3ApIGJlZm9yZSBmaXJpbmcgb2ZmIGVhY2ggc2VnbWVudCdzIG93biBhbmFseXplIGpvYi5cbi8vIEVhY2ggc2VnbWVudCBpcyBhIHNlcGFyYXRlIEFuYWx5emVKb2IsIHNvIHRoZXJlIGlzIGEgZ2FwIGJldHdlZW4gc2VnbWVudHNcbi8vIHdpdGggbm8gXCJydW5uaW5nXCIgam9iIGZvciAvYXBpL3N0YXR1cydzIGFuYWx5emVfcGF1c2VkIHRvIGtleSBvZmYgLSB0aGlzXG4vLyBjaGVja3MgdGhlIHJhdyBwYXVzZSBmbGFnIGZpbGUgaW5zdGVhZCAocGF1c2VfZmxhZ19zZXQpLlxuYXN5bmMgZnVuY3Rpb24gX3dhaXRXaGlsZUFuYWx5emVQYXVzZWQoKSB7XG4gIGxldCB0b2FzdGVkID0gZmFsc2U7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZmV0Y2goJy9hcGkvc3RhdHVzJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICBpZiAoIXN0YXR1cyB8fCAhc3RhdHVzLnBhdXNlX2ZsYWdfc2V0KSByZXR1cm47XG4gICAgaWYgKCF0b2FzdGVkKSB7IHdpbmRvdy5zaG93VG9hc3QoJ1BhdXNlZCAtIHdpbGwgaG9sZCBiZWZvcmUgdGhlIG5leHQgc2VnbWVudCcsICdpbmZvJyk7IHRvYXN0ZWQgPSB0cnVlOyB9XG4gICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDMwMDApKTtcbiAgfVxufVxuXG4vLyDilIDilIAgam9iIGNhbmNlbGxhdGlvbiDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZSBqb2ItaGVhZGVyIENhbmNlbCBidXR0b24gc2VydmVzIHdoaWNoZXZlciBjYW5jZWxsYWJsZSBqb2IgaXMgcnVubmluZy4gRWFjaFxuLy8gY2FuY2VsbGFibGUgZmxvdyBzZXRzIF9hY3RpdmVDYW5jZWwgKHZpYSBzZXRKb2JDYW5jZWwpIHNvIHRoZSBjb25maXJtIGNvcHkgYW5kXG4vLyB0aGUgY2FuY2VsIGVuZHBvaW50IG1hdGNoIHRoZSBqb2I7IHN0YXJ0Sm9iVUkgcmVzZXRzIGl0IHRvIHRoZSBhbmFseXplIGRlZmF1bHQuXG5jb25zdCBfQU5BTFlaRV9DQU5DRUwgPSB7XG4gIHVybDogICAgICAnL2FwaS9hbmFseXplL2NhbmNlbCcsXG4gIHRpdGxlOiAgICAnQ2FuY2VsIGFuYWx5c2lzPycsXG4gIGJvZHk6ICAgICAnQWxsIHByb2dyZXNzIGZvciB0aGlzIHJlY29yZGluZyB3aWxsIGJlIGxvc3QgYW5kIHlvdSB3aWxsIG5lZWQgdG8gYW5hbHl6ZSBpdCBhZ2Fpbi4nLFxuICBjb25maXJtOiAgJ0NhbmNlbCBBbmFseXNpcycsXG4gIGxvZ01zZzogICAnW0FuYWx5c2lzIGNhbmNlbGxlZF0nLFxufTtcbmxldCBfYWN0aXZlQ2FuY2VsID0gX0FOQUxZWkVfQ0FOQ0VMO1xuXG5mdW5jdGlvbiBzZXRKb2JDYW5jZWwoY2ZnKSB7IF9hY3RpdmVDYW5jZWwgPSBjZmcgfHwgX0FOQUxZWkVfQ0FOQ0VMOyB9XG5cbmZ1bmN0aW9uIGNhbmNlbEpvYigpIHtcbiAgd2luZG93LnNob3dDb25maXJtKFxuICAgIF9hY3RpdmVDYW5jZWwudGl0bGUsXG4gICAgX2FjdGl2ZUNhbmNlbC5ib2R5LFxuICAgIF9hY3RpdmVDYW5jZWwuY29uZmlybSxcbiAgICBfZG9DYW5jZWxKb2IsXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvQ2FuY2VsSm9iKCkge1xuICBjb25zdCBjYW5jZWwgPSBfYWN0aXZlQ2FuY2VsO1xuICAvLyBDYW5jZWwgb24gdGhlIHNlcnZlciBGSVJTVCAtIGlmIGl0IGZhaWxzLCB0aGUgam9iIGlzIHN0aWxsIHJ1bm5pbmcsIHNvXG4gIC8vIGtlZXAgdGhlIHN0cmVhbSBhdHRhY2hlZCBhbmQgdGhlIGpvYiBVSSB1cCBpbnN0ZWFkIG9mIHByZXRlbmRpbmcgaXQgc3RvcHBlZC5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjYW5jZWwudXJsLCB7bWV0aG9kOiAnUE9TVCd9KTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3IgJHtyZXMuc3RhdHVzfWApO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KGBDb3VsZCBub3QgY2FuY2VsIC0gJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cbiAgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpO1xuICB3aW5kb3cuYXBwZW5kTG9nKGNhbmNlbC5sb2dNc2cpO1xuICBlbmRKb2JVSSgpO1xuICAvLyBBIGpvYi1zcGVjaWZpYyB0ZXJtaW5hbCBjbGVhbnVwIChlLmcuIGNsZWFyaW5nIGEgcGVyLWNsaXAgaW4tZmxpZ2h0IGZsYWcgc29cbiAgLy8gaXRzIGJ1dHRvbiBsZWF2ZXMgdGhlIHNwaW5uZXIpIC0gdGhlIGdlbmVyaWMgYW5hbHl6ZSBjYW5jZWwgc2V0cyBub25lLlxuICBpZiAoY2FuY2VsLm9uQ2FuY2VsKSBjYW5jZWwub25DYW5jZWwoKTtcbiAgLy8gQ2xlYXIgdGhlIGFuYWx5emluZyBtYXJrZXIgc28gbG9hZFZpZGVvcygpIGRyb3BzIHRoZSBzaWRlYmFyIHBsYWNlaG9sZGVyIC9cbiAgLy8gc3Bpbm5lci4gTGVmdCBzZXQsIGEgY2FuY2VsbGVkIHJ1biB3aG9zZSBEQiByb3cgbmV2ZXIgbWF0ZXJpYWxpc2VkIHdvdWxkXG4gIC8vIGtlZXAgYW4gdW5jbGlja2FibGUgXCJBbmFseXppbmfigKZcIiBwbGFjZWhvbGRlciB1bnRpbCBhIG1hbnVhbCBwYWdlIHJlZnJlc2guXG4gIEFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSA9IG51bGw7XG4gIHdpbmRvdy5sb2FkVmlkZW9zKCk7XG59XG5cbmV4cG9ydCB7XG4gIElOR0VTVF9TVEVQUywgU0NPUkVfU1RFUFMsIEZSQU1FU19TVEVQUywgSk9CX1NUQUdFUywgcGFyc2VQcm9ncmVzcywgX2RyaXZlU3RlcEZyb21NYXJrZXIsXG4gIHN0YXJ0Sm9iVUksIHVwZGF0ZUpvYlVJLCBlbmRKb2JVSSwgYXBwbHlKb2JCbG9ja2VkU3RhdGUsIF9zdGVwUGlsbExhYmVsLCBfcmVuZGVyU3RlcFBpbGwsIF90aWNrSm9iVGltZXIsXG4gIF9zZXRQYXVzZWRVSUZyb21TdGF0dXMsIHRvZ2dsZVBhdXNlSm9iLCBfcG9sbFRoZXJtYWxTdGF0dXMsXG4gIF9vcGVuU1NFLCBzdHJlYW1TU0UsIF9zZXRBY3RpdmVTdHJlYW0sIF9jbGVhckFjdGl2ZVN0cmVhbSwgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSxcbiAgX2Jsb2NrZWRCeUFuYWx5emUsIF93YWl0V2hpbGVBbmFseXplUGF1c2VkLFxuICBzZXRKb2JDYW5jZWwsIGNhbmNlbEpvYixcbn07XG5cbi8vIFRoZSBqb2IgaGVhZGVyJ3MgUGF1c2UvQ2FuY2VsIGJ1dHRvbnMgYXJlIHN0YXRpYyBtYXJrdXAgaW4gaW5kZXguaHRtbCAobmV2ZXJcbi8vIHJlLXJlbmRlcmVkKSwgc28gYSBzaW5nbGUgbGlzdGVuZXIgd2lyZWQgb25jZSBhdCBtb2R1bGUgbG9hZCAtIHJlcGxhY2luZyB0aGVcbi8vIG9uY2xpY2s9XCJ0b2dnbGVQYXVzZUpvYigpXCIvXCJjYW5jZWxKb2IoKVwiIGF0dHJpYnV0ZXMgdGhhdCB1c2VkIHRvIGxpdmUgdGhlcmUgLVxuLy8gY2FuIG5ldmVyIGRvdWJsZS13aXJlLiAodmlkZW9zLmpzJ3MgaW4tZGV0YWlsIENhbmNlbCBidXR0b24gc3RpbGwgdXNlcyBpdHMgb3duXG4vLyBpbmxpbmUgb25jbGljaz1cImNhbmNlbEpvYigpXCI7IHRoYXQgbWFya3VwIGxpdmVzIGluIHZpZGVvcy5qcywgb3V0IG9mIHNjb3BlIGhlcmUuKVxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1wYXVzZS1qb2InKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZVBhdXNlSm9iKTtcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2FuY2VsLWpvYicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgY2FuY2VsSm9iKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFJlY29yZGluZyBwcmV2aWV3IHBsYXllcjogcGlja3MgdGhlIG1lZGlhIHRyYW5zcG9ydCAoRWxlY3Ryb24gbmF0aXZlIHNjaGVtZSB2cyBIVFRQKSxcbi8vICAgcHJlZmVycyB0aGUgZmFzdCA3MjBwIHByb3h5IG92ZXIgdGhlIHNvdXJjZSwgYW5kIGRyaXZlcyB0aGUgY2xpY2stdG8tYnVpbGQgcHJveHkgYmFkZ2UuXG4vLyAgIEFQSTogcm91dGVzL3ZpZGVvcy5weSAoc291cmNlL3Byb3h5L3Byb3h5LXN0YXR1cy9wcm94eS1nZW5lcmF0ZSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdmlkZW8ucHlcbi8vIFNpbmdsZSBwb2ludCB0aGF0IHBpY2tzIHRoZSB0cmFuc3BvcnQgZm9yIGEgcmVjb3JkaW5nJ3Mgc291cmNlL3Byb3h5IHN0cmVhbVxuLy8gKHJvYWRtYXAgcGxhbiAxMCkuIEluc2lkZSB0aGUgcGFja2FnZWQgRWxlY3Ryb24gYXBwLCB3aW5kb3cuZWxlY3Ryb25BUEkubWVkaWFQcm90b2NvbFxuLy8gaXMgc2V0IGFuZCBwbGF5YmFjayBnb2VzIHN0cmFpZ2h0IHRocm91Z2ggdGhlIG5hdGl2ZSBcInl1dS1tZWRpYTovL1wiIHNjaGVtZSAtXG4vLyBieXBhc3NpbmcgdGhlIFB5dGhvbiBieXRlLXB1bXAgLSBpbnN0ZWFkIG9mIHRoZSBIVFRQIHJvdXRlLiBQbGFpbiBicm93c2VyLWRldlxuLy8gbW9kZSBuZXZlciBoYXMgZWxlY3Ryb25BUEksIHNvIGl0IGFsd2F5cyBnZXRzIHRoZSB1bmNoYW5nZWQgSFRUUCBVUkwuIGFic1BhdGhcbi8vIG1heSBiZSBudWxsIChlLmcuIGEgcHJveHkgdGhhdCBoYXNuJ3QgYmVlbiBnZW5lcmF0ZWQvbG9va2VkIHVwIHlldCksIHdoaWNoXG4vLyBzaW1wbHkgZmFsbHMgYmFjayB0byBIVFRQIGZvciB0aGF0IG9uZSByZXF1ZXN0LlxuaW1wb3J0IHsgc3RyZWFtU1NFIH0gZnJvbSAnLi9qb2JzLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIF9idWlsZE1lZGlhVXJsKHZpZGVvSWQsIGtpbmQsIGFic1BhdGgpIHtcbiAgaWYgKHdpbmRvdy5lbGVjdHJvbkFQST8ubWVkaWFQcm90b2NvbCAmJiBhYnNQYXRoKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IGFic1BhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIHJldHVybiBgeXV1LW1lZGlhOi8vbWVkaWEvJHtlbmNvZGVVUklDb21wb25lbnQobm9ybWFsaXplZCl9YDtcbiAgfVxuICByZXR1cm4gYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vJHtraW5kfWA7XG59XG5cbi8vIOKUgOKUgCByZWNvcmRpbmcgcHJldmlldyBxdWFsaXR5ICg3MjBwIHByb3h5ICsgYmFkZ2UpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gU2hhcmVkIGJ5IGV2ZXJ5IGZ1bGwtcmVjb3JkaW5nIDx2aWRlbz4gKHJlY29yZGluZyBkZXRhaWwgcGxheWVyLCBzcGxpdCBlZGl0b3IpXG4vLyBzbyB0aGUgY3JlYXRvciBhbHdheXMga25vd3Mgd2hldGhlciB0aGV5J3JlIHNlZWluZyB0aGUgZmFzdCA3MjBwIHByb3h5IG9yIHRoZVxuLy8gZnVsbC1xdWFsaXR5IG9yaWdpbmFsLiBQcmVmZXJzIHRoZSBwcm94eSB3aGVuIG9uZSBleGlzdHM7IG90aGVyd2lzZSBwbGF5cyB0aGVcbi8vIHNvdXJjZSBhbmQgZWl0aGVyIGJ1aWxkcyBhIHByb3h5IG9uIGRlbWFuZCAoYXV0b0J1aWxkKSBvciBpbnZpdGVzIHRoZSB1c2VyIHRvLlxuLy9cbi8vICAgdmlkZW9FbCAvIGJhZGdlRWwgOiB0aGUgPHZpZGVvPiBhbmQgaXRzIG92ZXJsYXkgYmFkZ2UgKGNhbGxlciBvd25zIGxheW91dClcbi8vICAgYXV0b0J1aWxkICAgICAgICAgOiBidWlsZCBpbW1lZGlhdGVseSB3aGVuIG5vIHByb3h5IGV4aXN0cyAoZGVsaWJlcmF0ZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIHNjcnViYmluZyBzdXJmYWNlcyksIGVsc2UgdGhlIGJhZGdlIG9mZmVycyBhIGNsaWNrLXRvLWJ1aWxkXG4vLyAgIGlzQ3VycmVudCAgICAgICAgIDogZ3VhcmQgc28gYSBsYXRlIHN3YXAgbmV2ZXIgbGFuZHMgb24gYSBzaW5jZS1jaGFuZ2VkIHZpZXdcbi8vICAgc3RhcnRTIC8gZW5kUyAgICAgOiBhIHNwbGl0IHNlZ21lbnQncyBwbGF5ZXIgc3RyZWFtcyB0aGUgZnVsbCB1bnRyaW1tZWQgcGFyZW50XG4vLyAgICAgICAgICAgICAgICAgICAgICAgZmlsZSAoc291cmNlIGFuZCBwcm94eSBhcmUgYm90aCBrZXllZCBieSB0aGUgcGFyZW50IHBhdGgpIC1cbi8vICAgICAgICAgICAgICAgICAgICAgICB0aGVzZSBib3VuZCBwbGF5YmFjayB0byB0aGUgc2VnbWVudCdzIG93biBzbGljZSBvZiBpdFxuLy8gICBzb3VyY2VQYXRoICAgICAgICA6IHRoZSByZWNvcmRpbmcncyBhYnNvbHV0ZSBwYXRoICh2aWRlby5zb3VyY2VfcGF0aCBmcm9tIHRoZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIGFscmVhZHktZmV0Y2hlZCB2aWRlbyByZWNvcmQpIC0gb25seSB1c2VkIHRvIGJ1aWxkIHRoZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIEVsZWN0cm9uIG5hdGl2ZS1wcm90b2NvbCBVUkw7IGlnbm9yZWQgaW4gYnJvd3Nlci1kZXYgbW9kZVxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwUmVjb3JkaW5nUHJldmlldyh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCB7IGF1dG9CdWlsZCA9IGZhbHNlLCBpc0N1cnJlbnQgPSAoKSA9PiB0cnVlLCBzdGFydFMgPSBudWxsLCBlbmRTID0gbnVsbCwgc291cmNlUGF0aCA9IG51bGwgfSA9IHt9KSB7XG4gIHZpZGVvRWwuc3JjID0gX2J1aWxkTWVkaWFVcmwodmlkZW9JZCwgJ3NvdXJjZScsIHNvdXJjZVBhdGgpO1xuICBpZiAoc3RhcnRTICE9IG51bGwpIHtcbiAgICB2aWRlb0VsLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4geyB0cnkgeyB2aWRlb0VsLmN1cnJlbnRUaW1lID0gc3RhcnRTOyB9IGNhdGNoIChfKSB7fSB9LCB7IG9uY2U6IHRydWUgfSk7XG4gIH1cbiAgaWYgKGVuZFMgIT0gbnVsbCkge1xuICAgIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsICgpID0+IHsgaWYgKHZpZGVvRWwuY3VycmVudFRpbWUgPj0gZW5kUykgdmlkZW9FbC5wYXVzZSgpOyB9KTtcbiAgfVxuICBjb25zdCBidWlsZEZuID0gKCkgPT4gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMpO1xuICBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdvcmlnaW5hbCcsIG51bGwsIGF1dG9CdWlsZCA/IG51bGwgOiBidWlsZEZuKTtcbiAgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vcHJveHktc3RhdHVzYClcbiAgICAudGhlbihyID0+IHIub2sgPyByLmpzb24oKSA6IG51bGwpXG4gICAgLnRoZW4oc3RhdHVzID0+IHtcbiAgICAgIGlmICghaXNDdXJyZW50KCkgfHwgIXN0YXR1cykgcmV0dXJuO1xuICAgICAgaWYgKHN0YXR1cy5hdmFpbGFibGUpIF91c2VSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0Uywgc3RhdHVzLnByb3h5X3BhdGgpO1xuICAgICAgZWxzZSBpZiAoYXV0b0J1aWxkIHx8IHN0YXR1cy5nZW5lcmF0aW5nKSBidWlsZEZuKCk7XG4gICAgfSlcbiAgICAuY2F0Y2goKCkgPT4geyAvKiBsZWF2ZSB0aGUgc291cmNlIHBsYXlpbmcgd2l0aCB0aGUgb3JpZ2luYWwtcXVhbGl0eSBiYWRnZSAqLyB9KTtcbn1cblxuLy8gc3RhcnRTOiBmYWxscyBiYWNrIHRvIGl0IHdoZW4gY3VycmVudFRpbWUgaXMgc3RpbGwgMCAtIHRoZSBwcm94eS1zdGF0dXMgZmV0Y2hcbi8vIGNhbiByZXNvbHZlIGJlZm9yZSB0aGUgc291cmNlJ3MgbG9hZGVkbWV0YWRhdGEgc2VlayAoc2V0dXBSZWNvcmRpbmdQcmV2aWV3KSBydW5zLFxuLy8gd2hpY2ggd291bGQgb3RoZXJ3aXNlIHJlc3VtZSBhIHNlZ21lbnQncyBwcm94eSBhdCB0aGUgcGFyZW50J3MgdD0wLlxuZnVuY3Rpb24gX3VzZVJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTID0gbnVsbCwgcHJveHlQYXRoID0gbnVsbCkge1xuICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gIGNvbnN0IHJlc3VtZUF0ICAgPSB2aWRlb0VsLmN1cnJlbnRUaW1lIHx8IHN0YXJ0UyB8fCAwO1xuICBjb25zdCB3YXNQbGF5aW5nID0gIXZpZGVvRWwucGF1c2VkICYmICF2aWRlb0VsLmVuZGVkO1xuICB2aWRlb0VsLnNyYyA9IF9idWlsZE1lZGlhVXJsKHZpZGVvSWQsICdwcm94eScsIHByb3h5UGF0aCk7XG4gIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiB7XG4gICAgdHJ5IHsgdmlkZW9FbC5jdXJyZW50VGltZSA9IHJlc3VtZUF0OyB9IGNhdGNoIChfKSB7fVxuICAgIGlmICh3YXNQbGF5aW5nKSB2aWRlb0VsLnBsYXkoKS5jYXRjaCgoKSA9PiB7fSk7XG4gIH0sIHsgb25jZTogdHJ1ZSB9KTtcbiAgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAncHJveHknKTtcbn1cblxuZnVuY3Rpb24gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMgPSBudWxsKSB7XG4gIGlmICghaXNDdXJyZW50KCkpIHJldHVybjtcbiAgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAnYnVpbGRpbmcnKTtcbiAgc3RyZWFtU1NFKFxuICAgIGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L3Byb3h5L2dlbmVyYXRlYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9wcm94eS1zdGF0dXNgKVxuICAgICAgICAudGhlbihyID0+IHIub2sgPyByLmpzb24oKSA6IG51bGwpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgaWYgKCFpc0N1cnJlbnQoKSkgcmV0dXJuO1xuICAgICAgaWYgKHN0YXR1cz8uYXZhaWxhYmxlKSBfdXNlUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMsIHN0YXR1cy5wcm94eV9wYXRoKTtcbiAgICAgIC8vIEFub3RoZXIgb3BlbiBpcyBzdGlsbCBlbmNvZGluZyAtIHBvbGwgdW50aWwgaXRzIHByb3h5IGxhbmRzLlxuICAgICAgZWxzZSBpZiAoc3RhdHVzPy5nZW5lcmF0aW5nKSBzZXRUaW1lb3V0KCgpID0+IF9idWlsZFJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTKSwgNTAwMCk7XG4gICAgICBlbHNlIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ29yaWdpbmFsJywgbnVsbCwgKCkgPT4gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMpKTtcbiAgICB9LFxuICAgIG51bGwsICAgICAgICAvLyBubyBnbG9iYWwgam9iIHBpbGwgLSB0aGlzIGlzIGEgYmFja2dyb3VuZCBjb252ZW5pZW5jZVxuICAgICdQcmV2aWV3JyxcbiAgICBmYWxzZSxcbiAgICBsaW5lID0+IHsgICAgLy8gb25MaW5lOiBzdXJmYWNlIHRoZSBlbmNvZGUgcGVyY2VudGFnZSBvbiB0aGUgYmFkZ2VcbiAgICAgIGNvbnN0IG0gPSAvKFxcZCspJS8uZXhlYyhsaW5lKTtcbiAgICAgIGlmIChtICYmIGlzQ3VycmVudCgpKSBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdidWlsZGluZycsIG1bMV0pO1xuICAgIH0sXG4gICk7XG59XG5cbmZ1bmN0aW9uIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgbW9kZSwgcGN0LCBvbkJ1aWxkKSB7XG4gIGlmICghYmFkZ2VFbCkgcmV0dXJuO1xuICAvLyBSZXNldCB0byBhIG5vbi1pbnRlcmFjdGl2ZSBzdGF0dXMgaW5kaWNhdG9yOyB0aGUgYnVpbGQgYWZmb3JkYW5jZSBiZWxvd1xuICAvLyByZS1hcm1zIGl0IGFzIGEgYnV0dG9uIHNvIHJvbGUvdGFiaW5kZXggbmV2ZXIgZ28gc3RhbGUgYmV0d2VlbiBzdGF0ZXMuXG4gIGJhZGdlRWwuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICBiYWRnZUVsLm9uY2xpY2sgPSBudWxsO1xuICBiYWRnZUVsLm9ua2V5ZG93biA9IG51bGw7XG4gIGJhZGdlRWwuc3R5bGUuY3Vyc29yID0gJyc7XG4gIGJhZGdlRWwuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgYmFkZ2VFbC5yZW1vdmVBdHRyaWJ1dGUoJ3RhYmluZGV4Jyk7XG4gIGJhZGdlRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3N0YXR1cycpO1xuICBiYWRnZUVsLmNsYXNzTGlzdC50b2dnbGUoJ3ByZXZpZXctYmFkZ2UtcHJveHknLCBtb2RlID09PSAncHJveHknKTtcbiAgYmFkZ2VFbC5jbGFzc0xpc3QucmVtb3ZlKCdwcmV2aWV3LWJhZGdlLWJ1aWxkJyk7XG4gIGlmIChtb2RlID09PSAncHJveHknKSB7XG4gICAgYmFkZ2VFbC50ZXh0Q29udGVudCA9ICdQcmV2aWV3IHF1YWxpdHkgKDcyMHApJztcbiAgICBiYWRnZUVsLnRpdGxlID0gJ1BsYXlpbmcgYSBkb3duc2NhbGVkIDcyMHAgcHJldmlldyBmb3IgZmFzdCBzZWVraW5nIC0gbm90IGZ1bGwgcXVhbGl0eS4gRXhwb3J0cyB1c2UgdGhlIG9yaWdpbmFsLic7XG4gIH0gZWxzZSBpZiAobW9kZSA9PT0gJ2J1aWxkaW5nJykge1xuICAgIGJhZGdlRWwudGV4dENvbnRlbnQgPSBwY3QgPyBgQnVpbGRpbmcgNzIwcCBwcmV2aWV34oCmICR7cGN0fSVgIDogJ0J1aWxkaW5nIDcyMHAgcHJldmlld+KApic7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdFbmNvZGluZyBhIGZhc3Qtc2Vla2luZyA3MjBwIHByZXZpZXcgZnJvbSB0aGUgc291cmNlIHJlY29yZGluZy4nO1xuICB9IGVsc2UgaWYgKG9uQnVpbGQpIHtcbiAgICAvLyBSZW5kZXIgdGhlIGFjdGlvbiBhcyBhIGJ1dHRvbi1zdHlsZWQgcGlsbCBzbyBpdCBvYnZpb3VzbHkgaW52aXRlcyBhIGNsaWNrLlxuICAgIGJhZGdlRWwuY2xhc3NMaXN0LmFkZCgncHJldmlldy1iYWRnZS1idWlsZCcpO1xuICAgIGJhZGdlRWwuaW5uZXJIVE1MID0gJ09yaWdpbmFsIHF1YWxpdHkgwrcgPHNwYW4gY2xhc3M9XCJwcmV2aWV3LWJhZGdlLWFjdGlvblwiPiYjOTg4OTsgQnVpbGQgNzIwcCBwcmV2aWV3PC9zcGFuPic7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdQbGF5aW5nIHRoZSBmdWxsLXF1YWxpdHkgb3JpZ2luYWwuIEJ1aWxkIGEgNzIwcCBwcmV2aWV3IHNvIHNlZWtpbmcgaXMgZmFzdC4nO1xuICAgIGJhZGdlRWwuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgIGJhZGdlRWwuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdhdXRvJztcbiAgICBiYWRnZUVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdidXR0b24nKTtcbiAgICBiYWRnZUVsLnRhYkluZGV4ID0gMDtcbiAgICBiYWRnZUVsLm9uY2xpY2sgPSBvbkJ1aWxkO1xuICAgIGJhZGdlRWwub25rZXlkb3duID0gKGUpID0+IHsgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBvbkJ1aWxkKCk7IH0gfTtcbiAgfSBlbHNlIHtcbiAgICBiYWRnZUVsLnRleHRDb250ZW50ID0gJ09yaWdpbmFsIHF1YWxpdHkgwrcgc2xvd2VyIHNlZWtpbmcnO1xuICAgIGJhZGdlRWwudGl0bGUgPSAnUGxheWluZyB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nIC0gc2Vla2luZyBhIGxvbmcgZmlsZSBjYW4gYmUgc2xvdy4nO1xuICB9XG59XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBDcm9zcy1jdXR0aW5nIFVJIGZlZWRiYWNrIGhlbHBlcnMgd2l0aCBubyBob21lIGluIGEgc2luZ2xlIGZlYXR1cmU6IHRvYXN0cywgdGhlXHJcbi8vICAgYm90dG9tIGxvZyBwYW5lbCwgc29ydC1kaXJlY3Rpb24gYnV0dG9ucywgc3BlYWtlci1sYWJlbHMgKGRpYXJpemF0aW9uKSByZWFkaW5lc3MsIFwicmV2ZWFsIGluXHJcbi8vICAgZm9sZGVyXCIsIGFuZCBjbGlwYm9hcmQgY29weS4gU3RhdGUvZm9ybWF0L2pvYi1TU0UvcHJldmlldyBtYWNoaW5lcnkgc3BsaXQgb3V0IGluIHN0YWdlIDAyLlxyXG4vLyAgIEFQSTogcm91dGVzL2NvbmZpZy5weSwgcm91dGVzL2xvZ3MucHkgKGluZGlyZWN0bHkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5XHJcbmltcG9ydCB7IGVzY0h0bWwsIHN0cmlwUmljaE1hcmt1cCB9IGZyb20gJy4vZm9ybWF0LmpzJztcclxuXHJcbi8vIOKUgOKUgCBzb3J0LWRpcmVjdGlvbiB0b2dnbGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIFJlZmxlY3RzIGEgc29ydC1kaXJlY3Rpb24gdG9nZ2xlJ3MgY3VycmVudCBzdGF0ZSBvbnRvIGl0cyBidXR0b246IGFycm93IGdseXBoLFxyXG4vLyBhcmlhLXByZXNzZWQsIGFuZCBhIHNlbGYtZGVzY3JpYmluZyBhcmlhLWxhYmVsLiAnZGVzYycgaXMgdGhlIHNvcnQgb3B0aW9uJ3NcclxuLy8gbmF0dXJhbCBvcmRlciAoaGlnaGVzdC9uZXdlc3QgZmlyc3QpOyAnYXNjJyByZXZlcnNlcyBpdC5cclxuZXhwb3J0IGZ1bmN0aW9uIF9zeW5jU29ydERpckJ0bihidG5JZCwgZGlyKSB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYnRuSWQpO1xyXG4gIGlmICghYnRuKSByZXR1cm47XHJcbiAgY29uc3QgYXNjID0gZGlyID09PSAnYXNjJztcclxuICBidG4uaW5uZXJIVE1MID0gYXNjID8gJyYjODU5MzsnIDogJyYjODU5NTsnO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFzYyA/ICd0cnVlJyA6ICdmYWxzZScpO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhc2NcclxuICAgID8gJ1NvcnRlZCBhc2NlbmRpbmcgLSBjbGljayB0byBzb3J0IGRlc2NlbmRpbmcnXHJcbiAgICA6ICdTb3J0ZWQgZGVzY2VuZGluZyAtIGNsaWNrIHRvIHNvcnQgYXNjZW5kaW5nJyk7XHJcbiAgYnRuLnRpdGxlID0gYXNjID8gJ0FzY2VuZGluZyBvcmRlcicgOiAnRGVzY2VuZGluZyBvcmRlcic7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBzcGVha2VyIGxhYmVscyAoZGlhcml6YXRpb24pIHJlYWRpbmVzcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gU3BlZWNoQnJhaW4gKHRoZSBkZWZhdWx0IGJhY2tlbmQpIGlzIGJ1bmRsZWQgLSBpdHMgcGFja2FnZSBzaG91bGQgYWx3YXlzIGJlXHJcbi8vIHByZXNlbnQsIHNvIGFuIHVucmVhZHkgcmVzdWx0IHRoZXJlIG1lYW5zIGEgYnJva2VuIGluc3RhbGwsIG5vdCBhIG1pc3NpbmdcclxuLy8gb3B0aW9uYWwgZG93bmxvYWQuIFB5YW5ub3RlIGlzIHRoZSBhZHZhbmNlZCwgdG9rZW4tZ2F0ZWQgYWx0ZXJuYXRpdmUgYW5kIHN0aWxsXHJcbi8vIG5lZWRzIGEgcmVhbCBpbnN0YWxsICsgYSBIdWdnaW5nRmFjZSB0b2tlbi4gVGhlIHBlci1ydW4gY2hlY2tib3hlcyBpbiB0aGVcclxuLy8gYW5hbHl6ZSBhbmQgZXhwb3J0IHBhbmVscyBib3RoIGdhdGUgb24gdGhpcyBzaW5nbGUgY2hlY2suIENlbnRyYWxpemVkIGhlcmUgc29cclxuLy8gdGhlIHRocmVlIHN1cmZhY2VzIChTZXR0aW5ncywgYW5hbHl6ZSwgZXhwb3J0KSBjYW4ndCBkcmlmdCB0byBkaWZmZXJlbnQgcnVsZXMuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZGlhcml6YXRpb25SZWFzb24oaW5zdGFsbGVkKSB7XHJcbiAgcmV0dXJuIGluc3RhbGxlZCA/ICcnIDogJ1NwZWVjaEJyYWluIGlzIHVuYXZhaWxhYmxlIC0gdHJ5IHJlaW5zdGFsbGluZyBZdXVDbGlwJztcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIF9kaWFyaXphdGlvblJlYWRpbmVzcygpIHtcclxuICBjb25zdCBjZmcgPSBhd2FpdCBmZXRjaCgnL2FwaS9jb25maWcnKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+ICh7fSkpO1xyXG4gIGNvbnN0IGJhY2tlbmQgPSBjZmcuZGlhcml6YXRpb25fYmFja2VuZCB8fCAnc3BlZWNoYnJhaW4nO1xyXG4gIGNvbnN0IGluc3RhbGwgPSBhd2FpdCBmZXRjaCgnL2FwaS9pbnN0YWxsL3NwZWVjaGJyYWluJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiAoe2luc3RhbGxlZDogZmFsc2V9KSk7XHJcbiAgY29uc3QgaW5zdGFsbGVkID0gISFpbnN0YWxsLmluc3RhbGxlZDtcclxuICByZXR1cm4ge1xyXG4gICAgaW5zdGFsbGVkLFxyXG4gICAgYmFja2VuZCxcclxuICAgIHJlYWR5OiAgIGluc3RhbGxlZCxcclxuICAgIHJlYXNvbjogIF9kaWFyaXphdGlvblJlYXNvbihpbnN0YWxsZWQpLFxyXG4gIH07XHJcbn1cclxuXHJcbi8vIE5vdGUgc2hvd24gb24gYSBkaXNhYmxlZCBzcGVha2VyLWxhYmVscyBjb250cm9sOiB0aGUgYmxvY2tpbmcgcmVhc29uIHBsdXMgYVxyXG4vLyBidXR0b24gdGhhdCBqdW1wcyB0byBTZXR0aW5ncy4gc2V0dGluZ3NPbmNsaWNrIGNsb3NlcyB0aGUgaG9zdCBzdXJmYWNlIGZpcnN0XHJcbi8vICh0aGUgYW5hbHl6ZSBwYW5lbCBvciBleHBvcnQgbW9kYWwpIHNvIFNldHRpbmdzIGlzbid0IG9wZW5lZCBiZWhpbmQgaXQuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZGlhcml6YXRpb25Ob3RlSHRtbChyZWFzb24sIHNldHRpbmdzT25jbGljaykge1xyXG4gIHJldHVybiBlc2NIdG1sKHJlYXNvbikgKyAnIC0gc2V0IHVwIGluICcgK1xyXG4gICAgJzxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6MCA0cHg7Y29sb3I6dmFyKC0tYWNjZW50KTsnICtcclxuICAgIGBkaXNwbGF5OmlubGluZS1mbGV4XCIgb25jbGljaz1cIiR7ZXNjSHRtbChzZXR0aW5nc09uY2xpY2spfVwiPlNldHRpbmdzPC9idXR0b24+YDtcclxufVxyXG5cclxuLy8g4pSA4pSAIGxvZyBwYW5lbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5Mb2coKSB7XHJcbiAgY29uc3QgcGFuZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLXBhbmVsJyk7XHJcbiAgcGFuZWwuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xyXG4gIHBhbmVsLmNsYXNzTGlzdC5yZW1vdmUoJ21pbmltaXplZCcpO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctdG9nZ2xlJykudGV4dENvbnRlbnQgPSAn4payJztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUxvZygpIHtcclxuICBjb25zdCBwYW5lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctcGFuZWwnKTtcclxuICBjb25zdCBtaW5pbWl6ZWQgPSBwYW5lbC5jbGFzc0xpc3QudG9nZ2xlKCdtaW5pbWl6ZWQnKTtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLXRvZ2dsZScpLnRleHRDb250ZW50ID0gbWluaW1pemVkID8gJ+KWvCcgOiAn4payJztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWxvZy10b2dnbGUnKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBtaW5pbWl6ZWQgPyAnZmFsc2UnIDogJ3RydWUnKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNsZWFyTG9nKCkge1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctbGluZXMnKS5pbm5lckhUTUwgPSAnJztcclxufVxyXG5cclxuLy8gVGhlIGxvZyBoZWFkZXIncyB0b2dnbGUvY2xlYXIgYnV0dG9ucyBhcmUgc3RhdGljIG1hcmt1cCBpbiBpbmRleC5odG1sIChuZXZlclxyXG4vLyByZS1yZW5kZXJlZCksIHNvIHRoaXMgb25lLXRpbWUgd2lyaW5nIGF0IG1vZHVsZSBsb2FkIGNhbid0IGRvdWJsZS1maXJlLlxyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWxvZy10b2dnbGUnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUxvZyk7XHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2xlYXItbG9nJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjbGVhckxvZyk7XHJcblxyXG4vLyBDYXAgdGhlIGxvZyBET00uIEFuIHVuYm91bmRlZCBsb2cgZnJvemUgdGhlIGJyb3dzZXIgb24gbG9uZyBydW5zIGFuZCwgd29yc2UsXHJcbi8vIHdoZW4gYSByZWF0dGFjaGVkIGFuYWx5emUgc3RyZWFtIHJlcGxheWVkIGEgbGFyZ2UgYnVmZmVyIGFsbCBhdCBvbmNlIChlYWNoIGxpbmVcclxuLy8gdHJpZ2dlcnMgYSBzY3JvbGwtdG8tYm90dG9tIHJlZmxvdykgLSB0aGUgdGFiIGxvY2tlZCB1cCwgdGhlIGVsYXBzZWQgdGltZXJcclxuLy8gYXBwZWFyZWQgZnJvemVuLCBhbmQgQ2FuY2VsIHdvdWxkbid0IHJlc3BvbmQuIEtlZXBpbmcgb25seSB0aGUgbW9zdCByZWNlbnQgbGluZXNcclxuLy8gYm91bmRzIHRoZSByZWZsb3cgY29zdDsgdGhlIGZ1bGwgbG9nIGFsd2F5cyByZW1haW5zIGluIC55dXUtY2xpcC95dXUtY2xpcC5sb2cuXHJcbmNvbnN0IF9NQVhfTE9HX0xJTkVTID0gNTAwO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZExvZyhyYXcpIHtcclxuICBjb25zdCB0ZXh0ID0gc3RyaXBSaWNoTWFya3VwKHJhdyk7XHJcbiAgaWYgKCF0ZXh0LnRyaW0oKSkgcmV0dXJuO1xyXG4gIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnN0IGlzT2sgICA9IHJhdy5pbmNsdWRlcygnIE9LJykgfHwgcmF3LmluY2x1ZGVzKCdbZ3JlZW5dJykgfHwgcmF3LmluY2x1ZGVzKCdEb25lJyk7XHJcbiAgY29uc3QgaXNFcnIgICA9IHJhdy5pbmNsdWRlcygnRkFJTCcpIHx8IHJhdy5pbmNsdWRlcygnRXJyb3InKSB8fCByYXcuaW5jbHVkZXMoJ1tyZWRdJykgfHwgcmF3LmluY2x1ZGVzKCdlcnJvcicpO1xyXG4gIGNvbnN0IGlzV2FybiAgPSByYXcuaW5jbHVkZXMoJ1t5ZWxsb3ddJykgfHwgcmF3LmluY2x1ZGVzKCdXQVJOSU5HJykgfHwgcmF3LmluY2x1ZGVzKCdvdmVybGFwJyk7XHJcbiAgZGl2LmNsYXNzTmFtZSA9ICdsb2ctbGluZScgKyAoaXNPayA/ICcgb2snIDogaXNFcnIgPyAnIGVycicgOiBpc1dhcm4gPyAnIHdhcm4nIDogJycpO1xyXG4gIGRpdi5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gIGRpdi5zdHlsZS5nYXAgPSAnNnB4JztcclxuICBjb25zdCB0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB0cy5zdHlsZS5jc3NUZXh0ID0gJ2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTBweDtmbGV4LXNocmluazowO29wYWNpdHk6LjcnO1xyXG4gIHRzLnRleHRDb250ZW50ID0gbmV3IERhdGUoKS50b0xvY2FsZVRpbWVTdHJpbmcodW5kZWZpbmVkLCB7aG91cjonMi1kaWdpdCcsIG1pbnV0ZTonMi1kaWdpdCcsIHNlY29uZDonMi1kaWdpdCd9KTtcclxuICBkaXYuYXBwZW5kQ2hpbGQodHMpO1xyXG4gIGRpdi5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0KSk7XHJcbiAgY29uc3QgbGluZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWxpbmVzJyk7XHJcbiAgbGluZXMuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICB3aGlsZSAobGluZXMuY2hpbGRFbGVtZW50Q291bnQgPiBfTUFYX0xPR19MSU5FUykgbGluZXMucmVtb3ZlQ2hpbGQobGluZXMuZmlyc3RFbGVtZW50Q2hpbGQpO1xyXG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWJvZHknKTtcclxuICBib2R5LnNjcm9sbFRvcCA9IGJvZHkuc2Nyb2xsSGVpZ2h0O1xyXG59XHJcblxyXG4vLyDilIDilIAgdG9hc3Qgbm90aWZpY2F0aW9ucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gVHlwZXM6IHN1Y2Nlc3MgfCBpbmZvIHwgd2FybmluZyAoZ3VhcmQvZ3VpZGFuY2UpIHwgZXJyb3IgKGFjdHVhbCBmYWlsdXJlcykuXHJcbi8vIEVycm9yIHRvYXN0cyBwZXJzaXN0IHVudGlsIGRpc21pc3NlZCAtIGR1cmF0aW9uTXMgaXMgaWdub3JlZCBmb3IgdGhlbS5cclxuLy8gb3B0czogeyBkdXJhdGlvbk1zLCBhY3Rpb246IHtsYWJlbCwgb25DbGlja30gfVxyXG5jb25zdCBUT0FTVF9TVEFDS19NQVggPSA0O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlLCB0eXBlID0gJ3N1Y2Nlc3MnLCBvcHRzID0ge30pIHtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9hc3QtY29udGFpbmVyJyk7XHJcbiAgY29uc3QgbGl2ZVJlZ2lvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHR5cGUgPT09ICdlcnJvcicgPyAnc3ItbGl2ZS1hc3NlcnRpdmUnIDogJ3NyLWxpdmUtcG9saXRlJyk7XHJcbiAgaWYgKGxpdmVSZWdpb24pIHsgbGl2ZVJlZ2lvbi50ZXh0Q29udGVudCA9ICcnOyBzZXRUaW1lb3V0KCgpID0+IHsgbGl2ZVJlZ2lvbi50ZXh0Q29udGVudCA9IG1lc3NhZ2U7IH0sIDEwKTsgfVxyXG4gIHdoaWxlIChjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID49IFRPQVNUX1NUQUNLX01BWCkgY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkLnJlbW92ZSgpO1xyXG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHRvYXN0ICR7dHlwZX1gO1xyXG4gIHRvYXN0LnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MTBweCc7XHJcbiAgY29uc3QgbXNnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIG1zZy50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XHJcbiAgdG9hc3QuYXBwZW5kQ2hpbGQobXNnKTtcclxuICBjb25zdCBidXR0b25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgYnV0dG9ucy5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDtnYXA6NnB4O2FsaWduLWl0ZW1zOmNlbnRlcjtmbGV4LXNocmluazowJztcclxuICBpZiAob3B0cy5hY3Rpb24pIHtcclxuICAgIGNvbnN0IGFjdGlvbkJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgYWN0aW9uQnRuLmNsYXNzTmFtZSA9ICdidG4gZ2hvc3QnO1xyXG4gICAgYWN0aW9uQnRuLnN0eWxlLmNzc1RleHQgPSAnZm9udC1zaXplOjExcHg7cGFkZGluZzoycHggOHB4JztcclxuICAgIGFjdGlvbkJ0bi50ZXh0Q29udGVudCA9IG9wdHMuYWN0aW9uLmxhYmVsO1xyXG4gICAgYWN0aW9uQnRuLm9uY2xpY2sgPSAoKSA9PiB7IHRvYXN0LnJlbW92ZSgpOyBvcHRzLmFjdGlvbi5vbkNsaWNrKCk7IH07XHJcbiAgICBidXR0b25zLmFwcGVuZENoaWxkKGFjdGlvbkJ0bik7XHJcbiAgfVxyXG4gIGNvbnN0IGNsb3NlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgY2xvc2UudGV4dENvbnRlbnQgPSAnw5cnO1xyXG4gIGNsb3NlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEaXNtaXNzJyk7XHJcbiAgY2xvc2Uuc3R5bGUuY3NzVGV4dCA9IGBiYWNrZ3JvdW5kOm5vbmU7Ym9yZGVyOm5vbmU7Y29sb3I6aW5oZXJpdDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MThweDtsaW5lLWhlaWdodDoxO3BhZGRpbmc6MDtmbGV4LXNocmluazowO29wYWNpdHk6JHt0eXBlID09PSAnZXJyb3InID8gJy44JyA6ICcuNSd9YDtcclxuICBjbG9zZS5vbmNsaWNrID0gKCkgPT4gdG9hc3QucmVtb3ZlKCk7XHJcbiAgYnV0dG9ucy5hcHBlbmRDaGlsZChjbG9zZSk7XHJcbiAgdG9hc3QuYXBwZW5kQ2hpbGQoYnV0dG9ucyk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcclxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykgcmV0dXJuO1xyXG4gIGNvbnN0IG1zID0gb3B0cy5kdXJhdGlvbk1zID8/ICh0eXBlID09PSAnd2FybmluZycgPyA2MDAwIDogNDAwMCk7XHJcbiAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICB0b2FzdC5zdHlsZS50cmFuc2l0aW9uID0gJ29wYWNpdHkgLjNzJztcclxuICAgIHRvYXN0LnN0eWxlLm9wYWNpdHkgPSAnMCc7XHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHRvYXN0LnJlbW92ZSgpLCAzMDApO1xyXG4gIH0sIG1zKTtcclxufVxyXG5cclxuLy8g4pSA4pSAIG5ldHdvcmsgZXJyb3IgY29weSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gQSBmZXRjaCgpIHJlamVjdGlvbiBtZWFucyB0aGUgcmVxdWVzdCBuZXZlciBnb3QgYSByZXNwb25zZSAtIG9uIHRoaXMgbG9jYWxob3N0L1xyXG4vLyBFbGVjdHJvbiBhcHAgdGhhdCBhbG1vc3QgYWx3YXlzIG1lYW5zIHRoZSBiYWNrZW5kIHN0b3BwZWQsIG5vdCBhIHJlYWwgbmV0d29yay5cclxuLy8gVGhlIGJyb3dzZXIgcmVwb3J0cyBpdCBhcyBhIFR5cGVFcnJvciB3aG9zZSBtZXNzYWdlIGlzIHRoZSBvcGFxdWUgXCJGYWlsZWQgdG9cclxuLy8gZmV0Y2hcIiwgdXNlbGVzcyB0byBhIG5vbi1kZXZlbG9wZXIuIEFuIEVycm9yIHRocm93biBhZnRlciBhIG5vbi1vayByZXNwb25zZVxyXG4vLyBhbHJlYWR5IGNhcnJpZXMgYSByZWFsLCBzcGVjaWZpYyBtZXNzYWdlLCBzbyBwYXNzIHRob3NlIHRocm91Z2ggdW5jaGFuZ2VkLiBVc2VcclxuLy8gdGhpcyBvbmx5IGF0IGNhdGNoIHNpdGVzIHRoYXQgd3JhcCBhIGJhcmUgZmV0Y2ggKG5vdCBvbmVzIGRvaW5nIERPTSB3b3JrIHRoYXRcclxuLy8gY291bGQgdGhyb3cgaXRzIG93biBUeXBlRXJyb3IpLlxyXG5leHBvcnQgZnVuY3Rpb24gbmV0RXJyTXNnKGVycikge1xyXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBUeXBlRXJyb3IpIHJldHVybiBcIkNvdWxkbid0IHJlYWNoIFl1dUNsaXAgLSBpdCBtYXkgaGF2ZSBzdG9wcGVkLiBUcnkgYWdhaW4sIG9yIHJlc3RhcnQgdGhlIGFwcC5cIjtcclxuICByZXR1cm4gKGVyciAmJiBlcnIubWVzc2FnZSkgfHwgJ1Vua25vd24gZXJyb3InO1xyXG59XHJcblxyXG4vLyDilIDilIAgcmV2ZWFsIGluIGZpbGUgZXhwbG9yZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXZlYWxJbkZvbGRlcihwYXRoKSB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL3JldmVhbCcsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3BhdGh9KSxcclxuICAgIH0pO1xyXG4gICAgaWYgKCFyZXMub2spIHtcclxuICAgICAgY29uc3QgZSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XHJcbiAgICAgIHNob3dUb2FzdChgQ291bGQgbm90IHNob3cgaW4gZm9sZGVyOiAke2UuZGV0YWlsIHx8ICdmYWlsZWQnfWAsICdlcnJvcicpO1xyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgc2hvd1RvYXN0KGBDb3VsZCBub3Qgc2hvdyBpbiBmb2xkZXI6ICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyDilIDilIAgY2xpcGJvYXJkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBUaGUgYXBwIG9ubHkgZXZlciBydW5zIG9uIGxvY2FsaG9zdCBvciBpbnNpZGUgRWxlY3Ryb24sIHNvIG5hdmlnYXRvci5jbGlwYm9hcmRcclxuLy8gaXMgYWx3YXlzIGF2YWlsYWJsZSAtIGEgZmFpbHVyZSB0b2FzdCBpcyBlbm91Z2gsIG5vIGV4ZWNDb21tYW5kIGZhbGxiYWNrLlxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29weVRleHQodGV4dCwgbGFiZWwpIHtcclxuICB0cnkge1xyXG4gICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dCk7XHJcbiAgICBzaG93VG9hc3QoYCR7bGFiZWx9IGNvcGllZGAsICdzdWNjZXNzJyk7XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBzaG93VG9hc3QoYENvdWxkIG5vdCBjb3B5ICR7bGFiZWwudG9Mb3dlckNhc2UoKX06ICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyDilIDilIAgY29sbGFwc2libGUgZGV0YWlsIGNhcmRzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBPcHQtaW46IGJ1aWxkIGEgY2FyZCB3aXRoIGNvbGxhcHNpYmxlQ2FyZChrZXksIHRpdGxlLCBib2R5LCB7YWN0aW9uc30pLiBUaGVcclxuLy8gdGl0bGUgaXMgcmVuZGVyZWQgaW5zaWRlIGEgcmVhbCA8YnV0dG9uIGNsYXNzPVwiY2FyZC10b2dnbGVcIj4sIHNvIHRoZSB0b2dnbGVcclxuLy8gaGFzIG5hdGl2ZSBrZXlib2FyZC9mb2N1cyBiZWhhdmlvdXIgYW5kIC0gYmVjYXVzZSBzaG9ydGN1dHMuanMncyBnbG9iYWxcclxuLy8ga2V5ZG93biBiYWlscyBvbiB0YWdOYW1lID09PSAnQlVUVE9OJyAtIFNwYWNlIG9uIGEgZm9jdXNlZCB0b2dnbGUgbmV2ZXIgYWxzb1xyXG4vLyBmaXJlcyBwbGF5L3BhdXNlLiBIZWFkZXIgYWN0aW9uIGNvbnRyb2xzIGFyZSBwYXNzZWQgdmlhIG9wdHMuYWN0aW9ucyBhbmQgc2l0XHJcbi8vIGFzIFNJQkxJTkdTIG9mIHRoZSB0b2dnbGUgYnV0dG9uLCBuZXZlciBkZXNjZW5kYW50cywgc28gYSBidXR0b24gbmV2ZXIgbmVzdHNcclxuLy8gaW5zaWRlIHRoZSB0b2dnbGUgKFdDQUcgNC4xLjIgbmVzdGVkLWludGVyYWN0aXZlKS4gU2VlZGVkIGZyb20gaXNDYXJkQ29sbGFwc2VkKGtleSkuXHJcbmNvbnN0IF9DQVJEX0NPTExBUFNFX0tFWSA9ICd5dXVjbGlwLWNhcmQtY29sbGFwc2VkJztcclxuXHJcbmZ1bmN0aW9uIF9jYXJkQ29sbGFwc2VTdGF0ZSgpIHtcclxuICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShfQ0FSRF9DT0xMQVBTRV9LRVkpIHx8ICd7fScpIHx8IHt9OyB9XHJcbiAgY2F0Y2ggeyByZXR1cm4ge307IH1cclxufVxyXG5cclxuLy8gUGVyc2lzdGVkIGNvbGxhcHNlIHN0YXRlIHBlciBjYXJkIGtleS4gZGVmYXVsdENvbGxhcHNlZCBsZXRzIGEgY2FyZCAoZS5nLiB0aGVcclxuLy8gaGVhdnkgZnVsbC12aWRlbyB0cmFuc2NyaXB0KSBzdGFydCBjb2xsYXBzZWQgdW50aWwgdGhlIHVzZXIgb3BlbnMgaXQuXHJcbmZ1bmN0aW9uIGlzQ2FyZENvbGxhcHNlZChrZXksIGRlZmF1bHRDb2xsYXBzZWQgPSBmYWxzZSkge1xyXG4gIGNvbnN0IHN0YXRlID0gX2NhcmRDb2xsYXBzZVN0YXRlKCk7XHJcbiAgcmV0dXJuIGtleSBpbiBzdGF0ZSA/ICEhc3RhdGVba2V5XSA6IGRlZmF1bHRDb2xsYXBzZWQ7XHJcbn1cclxuXHJcbi8vIFNpbmdsZSBzb3VyY2Ugb2YgdGhlIGNvbGxhcHNpYmxlLWNhcmQgbWFya3VwIGNvbnRyYWN0OiB0aGUgfjExIGRldGFpbCBjYXJkc1xyXG4vLyB0aGF0IG9wdCBpbiBhbGwgcmVuZGVyIHRocm91Z2ggaGVyZSBzbyBub25lIGNhbiBkcmlmdCBmcm9tIHRoZSBjbGFzcyAvXHJcbi8vIGRhdGEtY29sbGFwc2Uta2V5IC8gdG9nZ2xlLWExMXkgYXR0cmlidXRlcyB0aGUgdG9nZ2xlIGxvZ2ljIGJlbG93IHJlYWRzLlxyXG4vLyB0aXRsZSA9IHRoZSBoZWFkZXIncyB0aXRsZSBjb250ZW50IChnb2VzIGluc2lkZSB0aGUgdG9nZ2xlIGJ1dHRvbik7IGJvZHkgPVxyXG4vLyBldmVyeXRoaW5nIHNob3duIGJlbG93IHRoZSBoZWFkZXIuIG9wdHMuYWN0aW9ucyA9IGhlYWRlciBjb250cm9scyByZW5kZXJlZFxyXG4vLyBiZXNpZGUgdGhlIHRvZ2dsZTsgb3B0cy5kZWZhdWx0Q29sbGFwc2VkIHN0YXJ0cyBhIGNhcmQgY29sbGFwc2VkIHVudGlsIGZpcnN0XHJcbi8vIG9wZW5lZDsgb3B0cy5hdHRycyBhZGRzIGNhcmQgYXR0cmlidXRlcyAoaWQsIGRhdGEtKik7IG9wdHMuaGVhZGVyU3R5bGUgc2V0c1xyXG4vLyBhbiBpbmxpbmUgc3R5bGUgb24gdGhlIGhlYWRlciByb3cuXHJcbmV4cG9ydCBmdW5jdGlvbiBjb2xsYXBzaWJsZUNhcmQoa2V5LCB0aXRsZSwgYm9keSwgb3B0cyA9IHt9KSB7XHJcbiAgY29uc3QgeyBkZWZhdWx0Q29sbGFwc2VkID0gZmFsc2UsIGF0dHJzID0gJycsIGhlYWRlclN0eWxlID0gJycsIGFjdGlvbnMgPSAnJyB9ID0gb3B0cztcclxuICBjb25zdCBjb2xsYXBzZWQgPSBpc0NhcmRDb2xsYXBzZWQoa2V5LCBkZWZhdWx0Q29sbGFwc2VkKTtcclxuICBjb25zdCBzdHlsZUF0dHIgPSBoZWFkZXJTdHlsZSA/IGAgc3R5bGU9XCIke2hlYWRlclN0eWxlfVwiYCA6ICcnO1xyXG4gIGNvbnN0IGV4dHJhQXR0cnMgPSBhdHRycyA/IGAgJHthdHRyc31gIDogJyc7XHJcbiAgcmV0dXJuIGBcclxuICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZCBjb2xsYXBzaWJsZSR7Y29sbGFwc2VkID8gJyBjb2xsYXBzZWQnIDogJyd9XCIgZGF0YS1jb2xsYXBzZS1rZXk9XCIke2tleX1cIiR7ZXh0cmFBdHRyc30+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZC1oZWFkZXJcIiR7c3R5bGVBdHRyfT5cclxuICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNhcmQtdG9nZ2xlXCIgYXJpYS1leHBhbmRlZD1cIiR7Y29sbGFwc2VkID8gJ2ZhbHNlJyA6ICd0cnVlJ31cIj4ke3RpdGxlfTwvYnV0dG9uPlxyXG4gICAgICAgICR7YWN0aW9uc31cclxuICAgICAgPC9kaXY+XHJcbiAgICAgICR7Ym9keX1cclxuICAgIDwvZGl2PmA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF90b2dnbGVDb2xsYXBzaWJsZUNhcmQoY2FyZCwgdG9nZ2xlKSB7XHJcbiAgY29uc3QgY29sbGFwc2VkID0gY2FyZC5jbGFzc0xpc3QudG9nZ2xlKCdjb2xsYXBzZWQnKTtcclxuICB0b2dnbGUuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgY29sbGFwc2VkID8gJ2ZhbHNlJyA6ICd0cnVlJyk7XHJcbiAgY29uc3Qga2V5ID0gY2FyZC5kYXRhc2V0LmNvbGxhcHNlS2V5O1xyXG4gIGlmICgha2V5KSByZXR1cm47XHJcbiAgLy8gUGVyc2lzdCBiZXN0LWVmZm9ydDogYSB3cml0ZSBmYWlsdXJlIChwcml2YXRlIG1vZGUsIHF1b3RhKSBtdXN0IG5vdCBzd2FsbG93XHJcbiAgLy8gdGhlIHRvZ2dsZSBvciBibG9jayB0aGUgbGF6eS1sb2FkIGRpc3BhdGNoIGJlbG93LiBUaGUgcmVhZCBwYXRoXHJcbiAgLy8gKF9jYXJkQ29sbGFwc2VTdGF0ZSkgaXMgbGlrZXdpc2UgdG9sZXJhbnQuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHN0YXRlID0gX2NhcmRDb2xsYXBzZVN0YXRlKCk7XHJcbiAgICBzdGF0ZVtrZXldID0gY29sbGFwc2VkO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oX0NBUkRfQ09MTEFQU0VfS0VZLCBKU09OLnN0cmluZ2lmeShzdGF0ZSkpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgY29uc29sZS53YXJuKCdDb3VsZCBub3QgcGVyc2lzdCBjYXJkIGNvbGxhcHNlIHN0YXRlOicsIGVycik7XHJcbiAgfVxyXG4gIC8vIExldHMgYSBjYXJkIGxhenktbG9hZCBpdHMgYm9keSB0aGUgZmlyc3QgdGltZSBpdCBpcyBleHBhbmRlZC5cclxuICBjYXJkLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdjYXJkdG9nZ2xlJywgeyBidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsga2V5LCBjb2xsYXBzZWQgfSB9KSk7XHJcbn1cclxuXHJcbi8vIE9ubHkgdGhlIGNhcmQncyBvd24gdG9nZ2xlIGJ1dHRvbiBjb2xsYXBzZXMgaXQgKG5hdGl2ZSBFbnRlci9TcGFjZSBhY3RpdmF0ZSBpdFxyXG4vLyB0b28pLiBOZXN0ZWQgaGVhZGVycyBpbnNpZGUgYSBjb21wb3VuZCBjYXJkJ3MgYm9keSBjYXJyeSBubyAuY2FyZC10b2dnbGUsIHNvXHJcbi8vIHRoZXkgbmVpdGhlciB0b2dnbGUgbm9yIHNob3cgYSBjaGV2cm9uLlxyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgY29uc3QgdG9nZ2xlID0gZS50YXJnZXQuY2xvc2VzdCgnLmNhcmQtdG9nZ2xlJyk7XHJcbiAgaWYgKCF0b2dnbGUpIHJldHVybjtcclxuICBjb25zdCBjYXJkID0gdG9nZ2xlLmNsb3Nlc3QoJy5kZXRhaWwtY2FyZC5jb2xsYXBzaWJsZScpO1xyXG4gIGlmIChjYXJkKSBfdG9nZ2xlQ29sbGFwc2libGVDYXJkKGNhcmQsIHRvZ2dsZSk7XHJcbn0pO1xyXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgVUkgcHJpbWl0aXZlcyAoYWxlcnQgLyBjb25maXJtIC8gcHJvbXB0IG1vZGFscykgdXNlZCBhcHAtd2lkZS5cbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IGNvdmVyZWQgaW5kaXJlY3RseSBieSB0aGUgdGVzdF91aV8qLnB5IHN1aXRlc1xuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IGVzY0h0bWwgfSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5cbi8vIOKUgOKUgCBhbGVydCBtb2RhbCAoc2luZ2xlLWJ1dHRvbiwgbm8gY2FuY2VsKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWxlcnRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIHNob3dBbGVydCh0aXRsZSwgYm9keSkge1xuICBfYWxlcnRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtdGl0bGUnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtYm9keScpLmlubmVySFRNTCA9IGJvZHk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYWxlcnQtbW9kYWwgLmJ0bicpLmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUFsZXJ0TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2FsZXJ0T3BlbmVyO1xuICBfYWxlcnRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBjb25maXJtIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9jb25maXJtT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBzaG93Q29uZmlybSh0aXRsZSwgYm9keSwgb2tMYWJlbCwgb25PaywgZGFuZ2VyID0gZmFsc2UsIGNhbmNlbExhYmVsID0gJ0NhbmNlbCcpIHtcbiAgX2NvbmZpcm1PcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWJvZHknKS5pbm5lckhUTUwgPSBib2R5O1xuICBjb25zdCBvayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW9rLWJ0bicpO1xuICBvay50ZXh0Q29udGVudCA9IG9rTGFiZWw7XG4gIG9rLmNsYXNzTmFtZSA9IGRhbmdlciA/ICdidG4gZGFuZ2VyJyA6ICdidG4gcHJpbWFyeSc7XG4gIC8vIEV2ZXJ5IGNhbGwgc2V0cyBpdCwgc28gdGhlIGRlZmF1bHQgJ0NhbmNlbCcgaXMgcmVzdG9yZWQgZm9yIGNhbGxlcnMgdGhhdFxuICAvLyBkb24ndCBwYXNzIGEgY3VzdG9tIGxhYmVsIC0gbm8gc3RhbGUgbGFiZWwgbGVha3MgYmV0d2VlbiBjb25maXJtcy5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tY2FuY2VsLWJ0bicpLnRleHRDb250ZW50ID0gY2FuY2VsTGFiZWw7XG4gIEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjayA9IG9uT2s7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWNhbmNlbC1idG4nKS5mb2N1cygpLCA1MCk7XG59XG5mdW5jdGlvbiBfY29uZmlybU9rKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3QgY2IgPSBBcHBTdGF0ZS5jb25maXJtQ2FsbGJhY2s7XG4gIEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjayA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9jb25maXJtT3BlbmVyO1xuICBfY29uZmlybU9wZW5lciA9IG51bGw7XG4gIGlmIChjYikgY2IoKTtcbiAgZWxzZSBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5leHBvcnQgZnVuY3Rpb24gX2NvbmZpcm1DYW5jZWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBBcHBTdGF0ZS5jb25maXJtQ2FsbGJhY2sgPSBudWxsO1xuICBjb25zdCBvcGVuZXIgPSBfY29uZmlybU9wZW5lcjtcbiAgX2NvbmZpcm1PcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBhZGRpdGlvbmFsIGFjdGlvbnMgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2FjdGlvbnNNb2RhbE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkFjdGlvbnNNb2RhbCh0aXRsZSwgZ3JvdXBzKSB7XG4gIF9hY3Rpb25zTW9kYWxPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC1ib2R5Jyk7XG4gIGJvZHkuaW5uZXJIVE1MID0gJyc7XG4gIGdyb3Vwcy5mb3JFYWNoKChncm91cCwgaSkgPT4ge1xuICAgIGlmIChpID4gMCkge1xuICAgICAgY29uc3QgZGl2aWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgZGl2aWRlci5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWRpdmlkZXInO1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChkaXZpZGVyKTtcbiAgICB9XG4gICAgaWYgKGdyb3VwLmhlYWRpbmcpIHtcbiAgICAgIGNvbnN0IGhlYWRpbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGhlYWRpbmcuY2xhc3NOYW1lID0gJ3NlY3Rpb24tdGl0bGUnO1xuICAgICAgaGVhZGluZy5zdHlsZS5jc3NUZXh0ID0gJ21hcmdpbjo4cHggMCAycHggNHB4JztcbiAgICAgIGhlYWRpbmcudGV4dENvbnRlbnQgPSBncm91cC5oZWFkaW5nO1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChoZWFkaW5nKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCByb3cgb2YgZ3JvdXAucm93cykge1xuICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgIGVsLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGVsLmNsYXNzTmFtZSA9ICdhY3Rpb24tcm93JyArIChyb3cuZGFuZ2VyID8gJyBkYW5nZXInIDogJycpO1xuICAgICAgZWwuZGlzYWJsZWQgPSAhIXJvdy5kaXNhYmxlZDtcbiAgICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgbGFiZWwuY2xhc3NOYW1lID0gJ2FjdGlvbi1yb3ctbGFiZWwnO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSByb3cubGFiZWw7XG4gICAgICBjb25zdCBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgZGVzYy5jbGFzc05hbWUgPSAnYWN0aW9uLXJvdy1kZXNjJztcbiAgICAgIGRlc2MudGV4dENvbnRlbnQgPSByb3cuZGVzY3JpcHRpb247XG4gICAgICBlbC5hcHBlbmQobGFiZWwsIGRlc2MpO1xuICAgICAgZWwub25jbGljayA9ICgpID0+IHsgY2xvc2VBY3Rpb25zTW9kYWwoKTsgcm93LmFjdGlvbigpOyB9O1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChlbCk7XG4gICAgfVxuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGlvbnMtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gYm9keS5xdWVyeVNlbGVjdG9yKCcuYWN0aW9uLXJvdzpub3QoOmRpc2FibGVkKScpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VBY3Rpb25zTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfYWN0aW9uc01vZGFsT3BlbmVyO1xuICBfYWN0aW9uc01vZGFsT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgbW9kYWwgbGF5ZXJpbmcgKyBmb2N1cyB0cmFwIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29uZmlybSBhbmQgYWxlcnQgYXJlIHRoZSBvbmx5IG1vZGFscyB0aGF0IHN0YWNrIG9uIHRvcCBvZiBvdGhlciBtb2RhbHMsIHNvXG4vLyB0aGV5IHRha2UgcHJpb3JpdHk7IG90aGVyd2lzZSBhbGwgLm1vZGFsLWJnIHNoYXJlIHotaW5kZXggMjAwIGFuZCB0aGUgbGFzdFxuLy8gdmlzaWJsZSBvbmUgaW4gRE9NIG9yZGVyIGlzIHRoZSBvbmUgcGFpbnRlZCBvbiB0b3AuXG5leHBvcnQgZnVuY3Rpb24gdG9wbW9zdFZpc2libGVNb2RhbCgpIHtcbiAgZm9yIChjb25zdCBpZCBvZiBbJ2NvbmZpcm0tbW9kYWwnLCAnYWxlcnQtbW9kYWwnXSkge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuICAgIGlmIChlbC5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgcmV0dXJuIGVsO1xuICB9XG4gIGNvbnN0IHZpc2libGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubW9kYWwtYmcudmlzaWJsZScpO1xuICByZXR1cm4gdmlzaWJsZS5sZW5ndGggPyB2aXNpYmxlW3Zpc2libGUubGVuZ3RoIC0gMV0gOiBudWxsO1xufVxuXG5jb25zdCBfRk9DVVNBQkxFX1NFTEVDVE9SID1cbiAgJ2FbaHJlZl0sIGJ1dHRvbjpub3QoOmRpc2FibGVkKSwgaW5wdXQ6bm90KDpkaXNhYmxlZCksIHNlbGVjdDpub3QoOmRpc2FibGVkKSwgJyArXG4gICd0ZXh0YXJlYTpub3QoOmRpc2FibGVkKSwgW3RhYmluZGV4XTpub3QoW3RhYmluZGV4PVwiLTFcIl0pJztcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xuICBpZiAoZS5rZXkgIT09ICdUYWInKSByZXR1cm47XG4gIGNvbnN0IG1vZGFsID0gdG9wbW9zdFZpc2libGVNb2RhbCgpO1xuICBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGZvY3VzYWJsZXMgPSBbLi4ubW9kYWwucXVlcnlTZWxlY3RvckFsbChfRk9DVVNBQkxFX1NFTEVDVE9SKV1cbiAgICAuZmlsdGVyKGVsID0+IGVsLmdldENsaWVudFJlY3RzKCkubGVuZ3RoID4gMCk7XG4gIGlmICghZm9jdXNhYmxlcy5sZW5ndGgpIHJldHVybjtcbiAgY29uc3QgZmlyc3QgPSBmb2N1c2FibGVzWzBdO1xuICBjb25zdCBsYXN0ICA9IGZvY3VzYWJsZXNbZm9jdXNhYmxlcy5sZW5ndGggLSAxXTtcbiAgaWYgKCFtb2RhbC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAoZS5zaGlmdEtleSA/IGxhc3QgOiBmaXJzdCkuZm9jdXMoKTtcbiAgfSBlbHNlIGlmICghZS5zaGlmdEtleSAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBsYXN0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGZpcnN0LmZvY3VzKCk7XG4gIH0gZWxzZSBpZiAoZS5zaGlmdEtleSAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBmaXJzdCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBsYXN0LmZvY3VzKCk7XG4gIH1cbn0pO1xuXG4vLyDilIDilIAgbWVudSBrZXlib2FyZCBwYXR0ZXJuIChoYW1idXJnZXIgKyBrZWJhYikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBfbWVudUZvY3VzYWJsZUl0ZW1zKG1lbnUpIHtcbiAgcmV0dXJuIFsuLi5tZW51LnF1ZXJ5U2VsZWN0b3JBbGwoJy5oYW1idXJnZXItaXRlbScpXVxuICAgIC5maWx0ZXIoZWwgPT4gIWVsLmRpc2FibGVkICYmIGVsLmdldENsaWVudFJlY3RzKCkubGVuZ3RoID4gMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfbWVudUFycm93S2V5ZG93bihtZW51LCBlKSB7XG4gIGlmIChlLmtleSAhPT0gJ0Fycm93RG93bicgJiYgZS5rZXkgIT09ICdBcnJvd1VwJykgcmV0dXJuO1xuICBjb25zdCBpdGVtcyA9IF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSk7XG4gIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgY29uc3QgaWR4ICA9IGl0ZW1zLmluZGV4T2YoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7XG4gIGNvbnN0IHN0ZXAgPSBlLmtleSA9PT0gJ0Fycm93RG93bicgPyAxIDogLTE7XG4gIGl0ZW1zWyhpZHggKyBzdGVwICsgaXRlbXMubGVuZ3RoKSAlIGl0ZW1zLmxlbmd0aF0uZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGhhbWJ1cmdlciBtZW51IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZXhwb3J0IGZ1bmN0aW9uIGlzSGFtYnVyZ2VyT3BlbigpIHtcbiAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpLmNsYXNzTGlzdC5jb250YWlucygnb3BlbicpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUhhbWJ1cmdlcigpIHtcbiAgY29uc3QgbWVudSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpO1xuICBtZW51LmNsYXNzTGlzdC50b2dnbGUoJ29wZW4nKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1oYW1idXJnZXInKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBtZW51LmNsYXNzTGlzdC5jb250YWlucygnb3BlbicpKTtcbiAgaWYgKG1lbnUuY2xhc3NMaXN0LmNvbnRhaW5zKCdvcGVuJykpIF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSlbMF0/LmZvY3VzKCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VIYW1idXJnZXIocmVmb2N1c1RyaWdnZXIgPSBmYWxzZSkge1xuICBjb25zdCBtZW51ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51Jyk7XG4gIC8vIEZvY3VzIHNpdHRpbmcgb24gYW4gaXRlbSBhYm91dCB0byBiZSBkaXNwbGF5Om5vbmUnZCB3b3VsZCBzaWxlbnRseSBmYWxsIHRvXG4gIC8vIDxib2R5PjsgaGFuZCBpdCB0byB0aGUgdHJpZ2dlciBmaXJzdCBzbyBpdCBoYXMgc29tZXdoZXJlIHJlYWwgdG8gZ28uXG4gIGlmIChyZWZvY3VzVHJpZ2dlciB8fCBtZW51LmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1oYW1idXJnZXInKS5mb2N1cygpO1xuICB9XG4gIG1lbnUuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xufVxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51JykuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xuICBfbWVudUFycm93S2V5ZG93bihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKSwgZSk7XG59KTtcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XG4gIGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci13cmFwJykuY29udGFpbnMoZS50YXJnZXQpKSB7XG4gICAgY2xvc2VIYW1idXJnZXIoKTtcbiAgfVxufSk7XG5cbi8vIOKUgOKUgCBjb250cm9scyBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfY29udHJvbHNPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5Db250cm9sc01vZGFsKCkge1xuICBfY29udHJvbHNPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbHMtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NvbnRyb2xzLW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQ29udHJvbHNNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRyb2xzLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfY29udHJvbHNPcGVuZXI7XG4gIF9jb250cm9sc09wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGRpZmYgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBfZGlmZlN0YXRlOiB7dGl0bGUsIGZpZWxkczpbe2xhYmVsLGN1cnJlbnQscHJvcG9zZWR9XSwgb25Db21taXQoYWN0aW9uLCBlZGl0ZWRWYWx1ZXMpfVxubGV0IF9kaWZmU3RhdGUgPSBudWxsO1xubGV0IF9kaWZmT3BlbmVyID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5EaWZmTW9kYWwodGl0bGUsIGZpZWxkcywgb25Db21taXQsIG9wdHMgPSB7fSkge1xuICBfZGlmZk9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIF9kaWZmU3RhdGUgPSB7dGl0bGUsIGZpZWxkcywgb25Db21taXR9O1xuICBjb25zdCByZXZlcnQgPSBvcHRzLnJldmVydE1vZGUgfHwgZmFsc2U7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZmllbGRzJyk7XG4gIGNvbnRhaW5lci5pbm5lckhUTUwgPSBmaWVsZHMubWFwKChmLCBpKSA9PiBgXG4gICAgPGRpdiBjbGFzcz1cImRpZmYtZmllbGQtZ3JvdXBcIj5cbiAgICAgICR7ZmllbGRzLmxlbmd0aCA+IDEgPyBgPGRpdiBjbGFzcz1cImRpZmYtZmllbGQtdGl0bGVcIj4ke2VzY0h0bWwoZi5sYWJlbCl9PC9kaXY+YCA6ICcnfVxuICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWxzXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWwtbGFiZWxcIj4ke3JldmVydCA/ICdZb3VyIEVkaXQnIDogJ0N1cnJlbnQnfTwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLWN1cnJlbnQke2YuY3VycmVudCA/ICcnIDogJyBlbXB0eSd9XCI+JHtcbiAgICAgICAgICAgIGYuY3VycmVudCA/IGVzY0h0bWwoZi5jdXJyZW50KSA6ICcobm9uZSB5ZXQpJ1xuICAgICAgICAgIH08L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWwtbGFiZWxcIj4ke3JldmVydCA/ICdPcmlnaW5hbCAoTExNKScgOiAnTmV3IC0gZWRpdCBoZXJlLCB0aGVuIGNob29zZSBiZWxvdyd9PC9kaXY+XG4gICAgICAgICAgJHtyZXZlcnRcbiAgICAgICAgICAgID8gYDxkaXYgY2xhc3M9XCJkaWZmLWN1cnJlbnQke2YucHJvcG9zZWQgPyAnJyA6ICcgZW1wdHknfVwiPiR7Zi5wcm9wb3NlZCA/IGVzY0h0bWwoZi5wcm9wb3NlZCkgOiAnKG5vbmUpJ308L2Rpdj5gXG4gICAgICAgICAgICA6IGA8dGV4dGFyZWEgY2xhc3M9XCJkaWZmLW5ld1wiIGlkPVwiZGlmZi1uZXctJHtpfVwiIHJvd3M9XCI0XCI+JHtlc2NIdG1sKGYucHJvcG9zZWQgfHwgJycpfTwvdGV4dGFyZWE+YFxuICAgICAgICAgIH1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gKS5qb2luKCcnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZGlzY2FyZC1idG4nKS50ZXh0Q29udGVudCAgID0gcmV2ZXJ0ID8gJ0tlZXAgTXkgRWRpdCcgOiAnRGlzY2FyZCc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1lZGl0LWJ0bicpLnN0eWxlLmRpc3BsYXkgPSByZXZlcnQgPyAnbm9uZScgOiAnJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtYWNjZXB0LW5ldy1idG4nKS50ZXh0Q29udGVudCA9IHJldmVydCA/ICdSZXZlcnQgdG8gT3JpZ2luYWwnIDogJ0FjY2VwdCBhcy1pcyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBjb25zdCBmaXJzdFRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbmV3LTAnKTtcbiAgICBpZiAoZmlyc3RUYSkgZmlyc3RUYS5mb2N1cygpO1xuICAgIGVsc2UgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZGlzY2FyZC1idG4nKT8uZm9jdXMoKTtcbiAgfSwgNTApO1xufVxuXG5mdW5jdGlvbiBfZGlmZkdldEVkaXRlZCgpIHtcbiAgcmV0dXJuIChfZGlmZlN0YXRlPy5maWVsZHMgfHwgW10pLm1hcCgoXywgaSkgPT4ge1xuICAgIGNvbnN0IHRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGRpZmYtbmV3LSR7aX1gKTtcbiAgICByZXR1cm4gdGEgPyB0YS52YWx1ZSA6ICcnO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gX2RpZmZDbG9zZURvbmUoKSB7XG4gIGNvbnN0IG9wZW5lciA9IF9kaWZmT3BlbmVyO1xuICBfZGlmZk9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuZnVuY3Rpb24gX2RpZmZBY2NlcHROZXcoKSB7XG4gIGNvbnN0IGVkaXRlZCA9IF9kaWZmR2V0RWRpdGVkKCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBjYiA9IF9kaWZmU3RhdGU/Lm9uQ29tbWl0O1xuICBfZGlmZlN0YXRlID0gbnVsbDtcbiAgX2RpZmZPcGVuZXIgPSBudWxsO1xuICBpZiAoY2IpIGNiKCdhY2NlcHRfbmV3JywgZWRpdGVkKTtcbn1cblxuZnVuY3Rpb24gX2RpZmZBY2NlcHRFZGl0KCkge1xuICBjb25zdCBlZGl0ZWQgPSBfZGlmZkdldEVkaXRlZCgpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3QgY2IgPSBfZGlmZlN0YXRlPy5vbkNvbW1pdDtcbiAgX2RpZmZTdGF0ZSA9IG51bGw7XG4gIF9kaWZmT3BlbmVyID0gbnVsbDtcbiAgaWYgKGNiKSBjYignYWNjZXB0X2VkaXQnLCBlZGl0ZWQpO1xufVxuXG5mdW5jdGlvbiBfZGlmZkRpcnR5KCkge1xuICByZXR1cm4gKF9kaWZmU3RhdGU/LmZpZWxkcyB8fCBbXSkuc29tZSgoZiwgaSkgPT4ge1xuICAgIGNvbnN0IHRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGRpZmYtbmV3LSR7aX1gKTtcbiAgICByZXR1cm4gdGEgJiYgdGEudmFsdWUgIT09IChmLnByb3Bvc2VkIHx8ICcnKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZGlmZkRpc2NhcmQoKSB7XG4gIGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgcmV0dXJuO1xuICBpZiAoX2RpZmZEaXJ0eSgpKSB7XG4gICAgc2hvd0NvbmZpcm0oXG4gICAgICAnRGlzY2FyZCBlZGl0PycsXG4gICAgICAnWW91IGhhdmUgdW5zYXZlZCBjaGFuZ2VzLiBDbG9zZSB3aXRob3V0IHNhdmluZz8nLFxuICAgICAgJ0Rpc2NhcmQnLFxuICAgICAgX2RvRGlmZkRpc2NhcmQsXG4gICAgICB0cnVlLFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9kb0RpZmZEaXNjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIF9kb0RpZmZEaXNjYXJkKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgX2RpZmZTdGF0ZSA9IG51bGw7XG4gIF9kaWZmQ2xvc2VEb25lKCk7XG59XG5cbi8vIOKUgOKUgCBmaWVsZCBlZGl0IG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9maWVsZEVkaXRDYWxsYmFjayA9IG51bGw7XG5sZXQgX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWUgPSAnJztcbmxldCBfZmllbGRFZGl0T3BlbmVyID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5GaWVsZEVkaXRNb2RhbCh0aXRsZSwgY3VycmVudFZhbHVlLCBvblNhdmUpIHtcbiAgX2ZpZWxkRWRpdE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIF9maWVsZEVkaXRPcmlnaW5hbFZhbHVlID0gY3VycmVudFZhbHVlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZSA9IGN1cnJlbnRWYWx1ZTtcbiAgX2ZpZWxkRWRpdENhbGxiYWNrID0gb25TYXZlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykuZm9jdXMoKSwgNTApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xvc2VGaWVsZEVkaXRNb2RhbCgpIHtcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1tb2RhbCcpLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpKSByZXR1cm47XG4gIGNvbnN0IGN1cnJlbnRWYWx1ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZTtcbiAgaWYgKGN1cnJlbnRWYWx1ZSAhPT0gX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWUpIHtcbiAgICBzaG93Q29uZmlybShcbiAgICAgICdEaXNjYXJkIGVkaXQ/JyxcbiAgICAgICdZb3UgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuIENsb3NlIHdpdGhvdXQgc2F2aW5nPycsXG4gICAgICAnRGlzY2FyZCcsXG4gICAgICBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsLFxuICAgICAgdHJ1ZSxcbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuICBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsKCk7XG59XG5cbmZ1bmN0aW9uIF9kb0Nsb3NlRmllbGRFZGl0TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBfZmllbGRFZGl0Q2FsbGJhY2sgPSBudWxsO1xuICBjb25zdCBvcGVuZXIgPSBfZmllbGRFZGl0T3BlbmVyO1xuICBfZmllbGRFZGl0T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBfZmllbGRFZGl0U2F2ZSgpIHtcbiAgY29uc3QgdmFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLnZhbHVlO1xuICBjb25zdCBjYiA9IF9maWVsZEVkaXRDYWxsYmFjaztcbiAgX2RvQ2xvc2VGaWVsZEVkaXRNb2RhbCgpO1xuICBpZiAoY2IpIGNiKHZhbCk7XG59XG5cbi8vIFJlZnJlc2gvY2xvc2Ugd2l0aCBhIGRpcnR5IGVkaXRvciBvcGVuIHdvdWxkIHNpbGVudGx5IGxvc2UgdGhlIGVkaXQgLSB0aGVcbi8vIHNhbWUgcHJvdGVjdGlvbiBjbG9zZUZpZWxkRWRpdE1vZGFsL19kaWZmRGlzY2FyZCBnaXZlIEVzY2FwZSBhbmQgRGlzY2FyZC5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBlID0+IHtcbiAgY29uc3QgZmllbGRFZGl0RGlydHkgPVxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykgJiZcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykudmFsdWUgIT09IF9maWVsZEVkaXRPcmlnaW5hbFZhbHVlO1xuICBjb25zdCBkaWZmRGlydHkgPVxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykgJiYgX2RpZmZEaXJ0eSgpO1xuICBpZiAoZmllbGRFZGl0RGlydHkgfHwgZGlmZkRpcnR5KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUucmV0dXJuVmFsdWUgPSAnJztcbiAgfVxufSk7XG5cbi8vIOKUgOKUgCBrZWJhYiBtZW51cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWN0aXZlS2ViYWIgPSBudWxsO1xubGV0IF9hY3RpdmVLZWJhYkFuY2hvciA9IG51bGw7XG5sZXQgX2tlYmFiRGlzbWlzcyA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUtlYmFiKHJlZm9jdXNBbmNob3IgPSBmYWxzZSkge1xuICBpZiAoIV9hY3RpdmVLZWJhYikgcmV0dXJuIGZhbHNlO1xuICBfYWN0aXZlS2ViYWIucmVtb3ZlKCk7XG4gIF9hY3RpdmVLZWJhYiA9IG51bGw7XG4gIGlmIChfa2ViYWJEaXNtaXNzKSB7IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgX2tlYmFiRGlzbWlzcyk7IF9rZWJhYkRpc21pc3MgPSBudWxsOyB9XG4gIGNvbnN0IGFuY2hvciA9IF9hY3RpdmVLZWJhYkFuY2hvcjtcbiAgX2FjdGl2ZUtlYmFiQW5jaG9yID0gbnVsbDtcbiAgaWYgKGFuY2hvcj8uaGFzQXR0cmlidXRlPy4oJ2FyaWEtaGFzcG9wdXAnKSkgYW5jaG9yLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xuICBpZiAocmVmb2N1c0FuY2hvciAmJiBhbmNob3I/LmZvY3VzKSBhbmNob3IuZm9jdXMoKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93S2ViYWIoYW5jaG9yRWwsIGl0ZW1zKSB7XG4gIGNsb3NlS2ViYWIoKTtcbiAgY29uc3QgbWVudSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBtZW51LmNsYXNzTmFtZSA9ICdoYW1idXJnZXItbWVudSBvcGVuJztcbiAgLy8gcmlnaHQ6YXV0byBjbGVhcnMgdGhlIC5oYW1idXJnZXItbWVudSBiYXNlIHJ1bGUncyByaWdodDowIC0gb3RoZXJ3aXNlIHRoZVxuICAvLyBmaXhlZCBtZW51LCB3aXRoIGJvdGggbGVmdCBhbmQgcmlnaHQgc2V0LCBzdHJldGNoZXMgdG8gdGhlIHZpZXdwb3J0IGVkZ2UuXG4gIG1lbnUuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjpmaXhlZDt6LWluZGV4OjUwMDttaW4td2lkdGg6MTYwcHg7cmlnaHQ6YXV0byc7XG4gIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgIGlmIChpdGVtID09PSBudWxsKSB7XG4gICAgICBjb25zdCBzZXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHNlcC5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWRpdmlkZXInO1xuICAgICAgbWVudS5hcHBlbmRDaGlsZChzZXApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIGJ0bi5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWl0ZW0nO1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IGl0ZW0ubGFiZWw7XG4gICAgaWYgKGl0ZW0uZGlzYWJsZWQpIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gICAgLy8gUmVmb2N1cyB0aGUgYW5jaG9yIGJlZm9yZSB0aGUgYWN0aW9uIHJ1bnMgc28gYW55dGhpbmcgdGhlIGFjdGlvbiBvcGVuc1xuICAgIC8vIHJlY29yZHMgdGhlIGFuY2hvciAtIG5vdCBhIHJlbW92ZWQgbWVudSBpdGVtIC0gYXMgaXRzIHJldHVybi1mb2N1cyB0YXJnZXQuXG4gICAgYnRuLm9uY2xpY2sgPSAoKSA9PiB7IGNsb3NlS2ViYWIodHJ1ZSk7IGl0ZW0uYWN0aW9uKCk7IH07XG4gICAgbWVudS5hcHBlbmRDaGlsZChidG4pO1xuICB9XG4gIG1lbnUuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4gX21lbnVBcnJvd0tleWRvd24obWVudSwgZSkpO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICBfYWN0aXZlS2ViYWIgPSBtZW51O1xuICBfYWN0aXZlS2ViYWJBbmNob3IgPSBhbmNob3JFbDtcbiAgaWYgKGFuY2hvckVsPy5oYXNBdHRyaWJ1dGU/LignYXJpYS1oYXNwb3B1cCcpKSBhbmNob3JFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xuXG4gIGNvbnN0IHJlY3QgPSBhbmNob3JFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgbGV0IHRvcCAgPSByZWN0LmJvdHRvbSArIDQ7XG4gIGxldCBsZWZ0ID0gcmVjdC5yaWdodCAtIG1lbnUub2Zmc2V0V2lkdGg7XG4gIGlmIChsZWZ0IDwgNCkgbGVmdCA9IHJlY3QubGVmdDtcbiAgY29uc3QgbWVudUggPSBtZW51Lm9mZnNldEhlaWdodDtcbiAgaWYgKHRvcCArIG1lbnVIID4gd2luZG93LmlubmVySGVpZ2h0KSB0b3AgPSByZWN0LnRvcCAtIG1lbnVIO1xuICBtZW51LnN0eWxlLnRvcCAgPSB0b3AgICsgJ3B4JztcbiAgbWVudS5zdHlsZS5sZWZ0ID0gbGVmdCArICdweCc7XG5cbiAgX21lbnVGb2N1c2FibGVJdGVtcyhtZW51KVswXT8uZm9jdXMoKTtcblxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoX2FjdGl2ZUtlYmFiICE9PSBtZW51KSByZXR1cm47ICAvLyBhbHJlYWR5IGNsb3NlZCAoZS5nLiBpbW1lZGlhdGUgRXNjYXBlKVxuICAgIGNvbnN0IGRpc21pc3MgPSBlID0+IHtcbiAgICAgIGlmIChtZW51LmNvbnRhaW5zKGUudGFyZ2V0KSkgcmV0dXJuO1xuICAgICAgY2xvc2VLZWJhYigpO1xuICAgIH07XG4gICAgX2tlYmFiRGlzbWlzcyA9IGRpc21pc3M7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBkaXNtaXNzKTtcbiAgfSwgMCk7XG59XG5cbi8vIOKUgOKUgCBwYW5lIHJlc2l6ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmNvbnN0IF9QQU5FX0tFWSA9ICd5dXVjbGlwLXBhbmUtc2l6ZXMnO1xuXG5mdW5jdGlvbiBfbG9hZFBhbmVTaXplcygpIHtcbiAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oX1BBTkVfS0VZKSB8fCAne30nKTsgfSBjYXRjaCB7IHJldHVybiB7fTsgfVxufVxuXG5mdW5jdGlvbiBfc2F2ZVBhbmVTaXplKGtleSwgdmFsKSB7XG4gIGNvbnN0IHMgPSBfbG9hZFBhbmVTaXplcygpO1xuICBzW2tleV0gPSB2YWw7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKF9QQU5FX0tFWSwgSlNPTi5zdHJpbmdpZnkocykpO1xufVxuXG5mdW5jdGlvbiBfbWFrZURyYWdIYW5kbGUoaWQsIG9uU3RhcnQpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZSA9PiB7XG4gICAgaWYgKGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2RyYWdnaW5nJyk7XG4gICAgY29uc3Qgb25Nb3ZlID0gb25TdGFydChlKTtcbiAgICBjb25zdCBvblVwID0gKCkgPT4ge1xuICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dpbmcnKTtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW92ZSk7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25VcCk7XG4gICAgfTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvblVwKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0UmVzaXplKCkge1xuICBjb25zdCByb290ICAgID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuICBjb25zdCBzaXplcyAgID0gX2xvYWRQYW5lU2l6ZXMoKTtcblxuICBpZiAoc2l6ZXMuc2lkZWJhcldpZHRoKSAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tc2lkZWJhci13aWR0aCcsICAgICAgIHNpemVzLnNpZGViYXJXaWR0aCArICdweCcpO1xuICBpZiAoc2l6ZXMudmlkZW9zSGVpZ2h0KSAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tdmlkZW9zLWdyb3VwLWhlaWdodCcsIHNpemVzLnZpZGVvc0hlaWdodCArICdweCcpO1xuICBpZiAoc2l6ZXMucGxheWVyTWF4SCkgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tcGxheWVyLW1heC1oZWlnaHQnLCAgIHNpemVzLnBsYXllck1heEggKyAncHgnKTtcbiAgaWYgKHNpemVzLmxvZ01heEgpICAgICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWxvZy1tYXgtaGVpZ2h0JywgICAgICAgc2l6ZXMubG9nTWF4SCArICdweCcpO1xuXG4gIF9tYWtlRHJhZ0hhbmRsZSgnc2lkZWJhci1yZXNpemUtaGFuZGxlJywgc3RhcnRFID0+IHtcbiAgICBjb25zdCBzdGFydFggID0gc3RhcnRFLmNsaWVudFg7XG4gICAgY29uc3Qgc2lkZWJhciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaWRlYmFyJyk7XG4gICAgY29uc3Qgc3RhcnRXICA9IHNpZGViYXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IHcgPSBNYXRoLm1heCgxNjAsIE1hdGgubWluKDQ4MCwgc3RhcnRXICsgbW92ZUUuY2xpZW50WCAtIHN0YXJ0WCkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1zaWRlYmFyLXdpZHRoJywgdyArICdweCcpO1xuICAgICAgX3NhdmVQYW5lU2l6ZSgnc2lkZWJhcldpZHRoJywgdyk7XG4gICAgfTtcbiAgfSk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCd2aWRlb3MtY2xpcHMtcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRZICA9IHN0YXJ0RS5jbGllbnRZO1xuICAgIGNvbnN0IHZnICAgICAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2lkZWJhci1ncm91cC52aWRlb3MtZ3JvdXAnKTtcbiAgICBjb25zdCBzaWRlYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNpZGViYXInKTtcbiAgICBjb25zdCBzdGFydEggID0gdmcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgIHJldHVybiBtb3ZlRSA9PiB7XG4gICAgICBjb25zdCBtYXhIID0gc2lkZWJhci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgLSAxMjA7XG4gICAgICBjb25zdCBoID0gTWF0aC5tYXgoNDAsIE1hdGgubWluKG1heEgsIHN0YXJ0SCArIG1vdmVFLmNsaWVudFkgLSBzdGFydFkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tdmlkZW9zLWdyb3VwLWhlaWdodCcsIGggKyAncHgnKTtcbiAgICAgIF9zYXZlUGFuZVNpemUoJ3ZpZGVvc0hlaWdodCcsIGgpO1xuICAgIH07XG4gIH0pO1xuXG4gIF9tYWtlRHJhZ0hhbmRsZSgncGxheWVyLXJlc2l6ZS1oYW5kbGUnLCBzdGFydEUgPT4ge1xuICAgIGNvbnN0IHN0YXJ0WSA9IHN0YXJ0RS5jbGllbnRZO1xuICAgIGNvbnN0IHBhICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXItYXJlYScpO1xuICAgIGNvbnN0IG1haW4gICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tYWluJyk7XG4gICAgY29uc3Qgc3RhcnRIID0gcGEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgIHJldHVybiBtb3ZlRSA9PiB7XG4gICAgICBjb25zdCBtYXhIID0gbWFpbi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgLSAxMDA7XG4gICAgICBjb25zdCBoID0gTWF0aC5tYXgoODAsIE1hdGgubWluKG1heEgsIHN0YXJ0SCArIG1vdmVFLmNsaWVudFkgLSBzdGFydFkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tcGxheWVyLW1heC1oZWlnaHQnLCBoICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCdwbGF5ZXJNYXhIJywgaCk7XG4gICAgfTtcbiAgfSk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCdsb2ctcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRZID0gc3RhcnRFLmNsaWVudFk7XG4gICAgY29uc3QgbGIgICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1ib2R5Jyk7XG4gICAgY29uc3Qgc3RhcnRIID0gbGIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0IHx8IDA7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IGggPSBNYXRoLm1heCg0MCwgTWF0aC5taW4oNjAwLCBzdGFydEggLSAobW92ZUUuY2xpZW50WSAtIHN0YXJ0WSkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tbG9nLW1heC1oZWlnaHQnLCBoICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCdsb2dNYXhIJywgaCk7XG4gICAgfTtcbiAgfSk7XG59XG5cbi8vIOKUgOKUgCBwcmVyZXEgd2FybmluZ3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5leHBvcnQgZnVuY3Rpb24gX2FwcGx5UHJlcmVxV2FybmluZ3MocHJlcmVxcykge1xuICBjb25zdCBpbkVsZWN0cm9uID0gISF3aW5kb3cuZWxlY3Ryb25BUEk7XG4gIGNvbnN0IHdpemFyZExpbmsgPSBpbkVsZWN0cm9uXG4gICAgPyAnIDxhIGhyZWY9XCIjXCIgb25jbGljaz1cIndpbmRvdy5lbGVjdHJvbkFQSS5ydW5TZXR1cFdpemFyZCgpO3JldHVybiBmYWxzZVwiIHN0eWxlPVwiY29sb3I6dmFyKC0td2FybmluZylcIj5SZS1ydW4gU2V0dXAgV2l6YXJkPC9hPidcbiAgICA6ICcnO1xuXG4gIGNvbnN0IGJhbm5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcmVyZXEtYmFubmVyJyk7XG4gIGlmICghYmFubmVyKSByZXR1cm47XG5cbiAgaWYgKCFwcmVyZXFzLmZmbXBlZ19vaykge1xuICAgIGJhbm5lci5pbm5lckhUTUwgPSBgPHNwYW4+4pqgIEZGbXBlZyBub3QgZm91bmQgLSBhbmFseXNpcyBhbmQgZXhwb3J0IHdpbGwgZmFpbC4ke3dpemFyZExpbmt9PC9zcGFuPmA7XG4gICAgYmFubmVyLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXN0YXJ0LWFuYWx5emUnKTtcbiAgICBpZiAoYnRuKSB7XG4gICAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgYnRuLnRpdGxlID0gJ0ZGbXBlZyBub3QgZm91bmQgLSBSZS1ydW4gU2V0dXAgV2l6YXJkIHRvIGluc3RhbGwgaXQnO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFwcmVyZXFzLmxsbV9vayAmJiBpbkVsZWN0cm9uKSB7XG4gICAgYmFubmVyLmlubmVySFRNTCA9IGA8c3Bhbj7ihLkgTExNIHNjb3JpbmcgaXMgbm90IGNvbmZpZ3VyZWQgLSBjbGlwcyB3aWxsIGJlIHNjb3JlZCBieSBlbmVyZ3kgYW5kIHNjZW5lcyBvbmx5LiR7d2l6YXJkTGlua308L3NwYW4+YDtcbiAgICBiYW5uZXIuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBQcmVyZXF1aXNpdGVzIHNhdGlzZmllZCAtIGNsZWFyIGFueSBiYW5uZXIgc2hvd24gYnkgYW4gZWFybGllciBzdGF0ZS4gV2l0aG91dFxuICAvLyB0aGlzLCBhIHJlLWNoZWNrIGFmdGVyIHRoZSBtb2RlbCBpcyBzZXQgdXAgKHJlZnJlc2hTZXJ2ZXJTdGF0ZSkgY291bGQgbmV2ZXJcbiAgLy8gaGlkZSBhIHN0YWxlIHdhcm5pbmcuXG4gIGJhbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBiYW5uZXIuaW5uZXJIVE1MID0gJyc7XG59XG5cbi8vIOKUgOKUgCB1bmRvIHRvYXN0IChhdXRvLWRpc21pc3MsIHNpbmdsZSBVbmRvIGJ1dHRvbikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBBIHRyYW5zaWVudCB0b2FzdCBjYXJyeWluZyBhbiBVbmRvIGFjdGlvbiwgdXNlZCBieSByZXZlcnNpYmxlIGNsaXAgb3BlcmF0aW9uc1xuLy8gKHNpbmdsZS9idWxrIHN0YXR1cyBjaGFuZ2VzKS4gVGhlIHNocmlua2luZyBiYXIgbWFrZXMgdGhlIH41cyB3aW5kb3cgdmlzaWJsZVxuLy8gc28gdGhlIHVuZG8gYWZmb3JkYW5jZSBkb2VzIG5vdCBleHBpcmUgc2lsZW50bHkuIEdlbmVyaWMgVUksIHNvIGl0IGxpdmVzIGhlcmVcbi8vIHJhdGhlciB0aGFuIGluIGEgZmVhdHVyZSBtb2R1bGUuXG5jb25zdCBVTkRPX1RPQVNUX01TID0gNTAwMDtcblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dVbmRvVG9hc3QobWVzc2FnZSwgdW5kb0ZuKSB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b2FzdC1jb250YWluZXInKTtcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gJ3RvYXN0IGluZm8gdW5kby10b2FzdCc7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICByb3cuY2xhc3NOYW1lID0gJ3VuZG8tdG9hc3Qtcm93JztcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gIGJ0bi5jbGFzc05hbWUgPSAndW5kby10b2FzdC1idG4nO1xuICBidG4udGV4dENvbnRlbnQgPSAnVW5kbyc7XG4gIGJ0bi5vbmNsaWNrID0gKCkgPT4geyB0b2FzdC5yZW1vdmUoKTsgdW5kb0ZuKCk7IH07XG4gIHJvdy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShtZXNzYWdlKSk7XG4gIHJvdy5hcHBlbmRDaGlsZChidG4pO1xuICBjb25zdCBiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgYmFyLmNsYXNzTmFtZSA9ICd1bmRvLXRvYXN0LWJhcic7XG4gIGJhci5zdHlsZS5hbmltYXRpb25EdXJhdGlvbiA9IFVORE9fVE9BU1RfTVMgKyAnbXMnO1xuICB0b2FzdC5hcHBlbmRDaGlsZChyb3cpO1xuICB0b2FzdC5hcHBlbmRDaGlsZChiYXIpO1xuICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QpO1xuICBzZXRUaW1lb3V0KCgpID0+IHRvYXN0LnJlbW92ZSgpLCBVTkRPX1RPQVNUX01TKTtcbn1cblxuLy8gR2xvYmFsIHBsYXliYWNrLXNwZWVkIHByZWZlcmVuY2UgLSBvbmUgY2FwdHVyZS1waGFzZSBsaXN0ZW5lciBhcHBsaWVzIHRoZSBzYXZlZFxuLy8gcmF0ZSB0byBldmVyeSA8dmlkZW8+IGFzIGl0IGxvYWRzLCBzbyBhbGwgcGxheWVycyAoY2xpcCBwcmV2aWV3LCByZWNvcmRpbmcsXG4vLyBzcGxpdC9leHBvcnQgZWRpdG9ycywgcmVlbHMpIGhvbm9yIGl0IHdpdGhvdXQgcGVyLXBsYXllciB3aXJpbmcuIENsaWVudC1vbmx5LFxuLy8gc3RvcmVkIGluIGxvY2FsU3RvcmFnZSBsaWtlIHRoZSBvdGhlciBwbGF5YmFjayBwcmVmcy5cbmV4cG9ydCBmdW5jdGlvbiBwbGF5YmFja1JhdGVQcmVmKCkge1xuICBjb25zdCByYXRlID0gcGFyc2VGbG9hdChsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgneXV1Y2xpcC1wbGF5YmFjay1yYXRlJykpO1xuICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKHJhdGUpICYmIHJhdGUgPiAwID8gcmF0ZSA6IDE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBsYXliYWNrUmF0ZShyYXRlKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ZpZGVvJykuZm9yRWFjaCh2aWRlbyA9PiB7IHZpZGVvLnBsYXliYWNrUmF0ZSA9IHJhdGU7IH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdFBsYXliYWNrUmF0ZSgpIHtcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBlID0+IHtcbiAgICBpZiAoZS50YXJnZXQgJiYgZS50YXJnZXQudGFnTmFtZSA9PT0gJ1ZJREVPJykgZS50YXJnZXQucGxheWJhY2tSYXRlID0gcGxheWJhY2tSYXRlUHJlZigpO1xuICB9LCB0cnVlKTtcbn1cblxuLy8g4pSA4pSAIHN0YXRpYyBtb2RhbC9oYW1idXJnZXIgd2lyaW5nIChyZXBsYWNlcyB0aGUgaW5saW5lIG9uY2xpY2s9IHRoaXMgbW9kdWxlIHVzZWRcbi8vIHRvIG93biBpbiBpbmRleC5odG1sKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZXNlIGFyZSBmaXhlZCwgbmV2ZXItcmVjcmVhdGVkIGVsZW1lbnRzIGluIGluZGV4Lmh0bWwsIHNvIHdpcmluZyB0aGVtIG9uY2UgYXRcbi8vIG1vZHVsZSBsb2FkIChiZWxvdykgY2FuJ3QgZG91YmxlLWZpcmUgb24gYSByZS1yZW5kZXIgdGhlIHdheSBhIGR5bmFtaWNhbGx5XG4vLyByZW5kZXJlZCBsaXN0IGNvdWxkLlxuY29uc3QgX0JHX0RJU01JU1NfTU9EQUxTID0gW1xuICBbJ2FsZXJ0LW1vZGFsJywgY2xvc2VBbGVydE1vZGFsXSxcbiAgWydjb25maXJtLW1vZGFsJywgX2NvbmZpcm1DYW5jZWxdLFxuICBbJ2FjdGlvbnMtbW9kYWwnLCBjbG9zZUFjdGlvbnNNb2RhbF0sXG4gIFsnY29udHJvbHMtbW9kYWwnLCBjbG9zZUNvbnRyb2xzTW9kYWxdLFxuICBbJ2RpZmYtbW9kYWwnLCBfZGlmZkRpc2NhcmRdLFxuICBbJ2ZpZWxkLWVkaXQtbW9kYWwnLCBjbG9zZUZpZWxkRWRpdE1vZGFsXSxcbl07XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKSB7XG4gIGZvciAoY29uc3QgW21vZGFsSWQsIGNsb3NlRm5dIG9mIF9CR19ESVNNSVNTX01PREFMUykge1xuICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobW9kYWxJZCk7XG4gICAgbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBtb2RhbCkgY2xvc2VGbigpOyB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfd2lyZU1vZGFsQnV0dG9ucygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LW9rLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VBbGVydE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1jYW5jZWwtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfY29uZmlybUNhbmNlbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tb2stYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfY29uZmlybU9rKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlQWN0aW9uc01vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbHMtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUNvbnRyb2xzTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWRpc2NhcmQtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZGlmZkRpc2NhcmQoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1lZGl0LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2RpZmZBY2NlcHRFZGl0KCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1hY2NlcHQtbmV3LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2RpZmZBY2NlcHROZXcoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlRmllbGRFZGl0TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXNhdmUtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZmllbGRFZGl0U2F2ZSgpKTtcbn1cblxuLy8gXCJDb250cm9sc1wiIGFuZCBcIkRvd25sb2FkIExvZ1wiIGFyZSB3aXJlZCBoZXJlIGJlY2F1c2UgdGhlaXIgb25jbGljaz0gY2FsbGVkXG4vLyBvbmx5IHVpLmpzIGZ1bmN0aW9ucy4gVGhlIEdldHRpbmcgU3RhcnRlZCAvIEdsb3NzYXJ5IC8gSGVscCAvIEFib3V0IGl0ZW1zIGNhbGxcbi8vIGNsb3NlSGFtYnVyZ2VyKCkgKHVpLmpzKSBwbHVzIGEgaGVscG1vZGFscy5qcyBtb2RhbC1vcGVuLCBzbyBoZWxwbW9kYWxzLmpzIG93bnNcbi8vIHRoZWlyIGRlbGVnYXRpb24uIFwiUmUtcnVuIFNldHVwIFdpemFyZFwiIGFuZCBcIlJlZnJlc2hcIiAoZWxlY3Ryb25BUEkgLyBsb2NhdGlvbilcbi8vIHJlbWFpbiBpbmxpbmUgdW50aWwgdGhlaXIgb3duaW5nIGNvZGUgbWlncmF0ZXMuXG5mdW5jdGlvbiBfd2lyZUhhbWJ1cmdlckhhbmRsZXJzKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdG9nZ2xlSGFtYnVyZ2VyKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tY29udHJvbHMnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICBjbG9zZUhhbWJ1cmdlcigpO1xuICAgIG9wZW5Db250cm9sc01vZGFsKCk7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tZG93bmxvYWQtbG9nJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUhhbWJ1cmdlcigpKTtcbn1cblxuX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpO1xuX3dpcmVNb2RhbEJ1dHRvbnMoKTtcbl93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIHRoZSB0aHJlZSBhcHAtZ2xvYmFsIGhlbHAvaW5mbyBtb2RhbHMgKEdldHRpbmcgU3RhcnRlZCwgQWJvdXQsXG4vLyBHbG9zc2FyeSkuIEV4dHJhY3RlZCBvdXQgb2Ygc2V0dGluZ3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLSB0aGVzZVxuLy8gaGF2ZSBubyBjb3VwbGluZyB0byB0aGUgc2V0dGluZ3Mgc2F2ZS9kaXJ0eSBtYWNoaW5lcnkuXG4vLyAgIEFQSTogcm91dGVzL2NvbmZpZy5weSAoZ2xvc3NhcnkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3NldHRpbmdzLnB5LCB0ZXN0cy91aS90ZXN0X3VpX3BhZ2UucHksIHRlc3RzL3VpL3Rlc3RfdWlfa2V5Ym9hcmQucHlcblxuLy8g4pSA4pSAIGdldHRpbmcgc3RhcnRlZCBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsKCkge1xuICBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2V0dGluZy1zdGFydGVkLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwgLmJ0bicpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2V0dGluZy1zdGFydGVkLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgneXV1LWdldHRpbmctc3RhcnRlZC1zZWVuJywgJzEnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2dldHRpbmdTdGFydGVkT3BlbmVyO1xuICBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBhYm91dCBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWJvdXRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5BYm91dE1vZGFsKCkge1xuICBfYWJvdXRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWJvdXQtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Fib3V0LW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQWJvdXRNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fib3V0LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfYWJvdXRPcGVuZXI7XG4gIF9hYm91dE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGhlbHAgJiBndWlkZXMgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBMaW5rcyBvdXQgdG8gdGhlIEdpdEh1YiBkb2NzL3VzZXIvIHBhZ2VzIHJhdGhlciB0aGFuIGJ1bmRsaW5nIGNvcGllczogdGhlIGFwcFxuLy8gc2hpcHMgdGhlIHdoZWVsICh3aGljaCBjYXJyaWVzIHN0YXRpYy9nbG9zc2FyeS5tZCkgYnV0IG5vdCBkb2NzL3VzZXIvLCBhbmQgYVxuLy8gYnVuZGxlZCA2NTAtbGluZSBmZWF0dXJlIGd1aWRlIHdvdWxkIGRyaWZ0IGZyb20gdGhlIFVJLiBJbiB0aGUgcGFja2FnZWQgYXBwXG4vLyB0aGVzZSB0YXJnZXQ9X2JsYW5rIGxpbmtzIG9wZW4gaW4gdGhlIHN5c3RlbSBicm93c2VyIHZpYSBzZXRXaW5kb3dPcGVuSGFuZGxlci5cbmxldCBfaGVscE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkhlbHBNb2RhbCgpIHtcbiAgX2hlbHBPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVscC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjaGVscC1tb2RhbCAuYnRuJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUhlbHBNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlbHAtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9oZWxwT3BlbmVyO1xuICBfaGVscE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGdsb3NzYXJ5IG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9nbG9zc2FyeU9wZW5lciA9IG51bGw7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3Blbkdsb3NzYXJ5TW9kYWwoKSB7XG4gIF9nbG9zc2FyeU9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgY29uc3QgZmlsdGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWZpbHRlcicpO1xuICBmaWx0ZXIudmFsdWUgPSAnJztcbiAgc2V0VGltZW91dCgoKSA9PiBmaWx0ZXIuZm9jdXMoKSwgNTApO1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1jb250ZW50Jyk7XG4gIGlmIChlbC5kYXRhc2V0LmxvYWRlZCkgeyBfZmlsdGVyR2xvc3NhcnkoJycpOyByZXR1cm47IH1cbiAgdHJ5IHtcbiAgICBjb25zdCBtZCA9IGF3YWl0IGZldGNoKCcvYXBpL2dsb3NzYXJ5JykudGhlbihyID0+IHIudGV4dCgpKTtcbiAgICBlbC5pbm5lckhUTUwgPSBfcmVuZGVyR2xvc3NhcnlNZChtZCk7XG4gICAgZWwuZGF0YXNldC5sb2FkZWQgPSAnMSc7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBlbC5pbm5lckhUTUwgPSAnPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLXJlZClcIj5GYWlsZWQgdG8gbG9hZCBnbG9zc2FyeS48L2Rpdj4nO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZmlsdGVyR2xvc3NhcnkocXVlcnkpIHtcbiAgY29uc3QgcSA9IHF1ZXJ5LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBjb250ZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWNvbnRlbnQnKTtcbiAgbGV0IGFueVZpc2libGUgPSBmYWxzZTtcbiAgY29udGVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZ2xvc3NhcnktdGVybScpLmZvckVhY2godGVybSA9PiB7XG4gICAgY29uc3Qgc2hvdyA9ICFxIHx8IHRlcm0udGV4dENvbnRlbnQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKTtcbiAgICB0ZXJtLnN0eWxlLmRpc3BsYXkgPSBzaG93ID8gJycgOiAnbm9uZSc7XG4gICAgaWYgKHNob3cpIGFueVZpc2libGUgPSB0cnVlO1xuICB9KTtcbiAgY29udGVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZ2xvc3Nhcnktc2VjdGlvbicpLmZvckVhY2goc2VjdGlvbiA9PiB7XG4gICAgY29uc3QgdGVybXMgPSBBcnJheS5mcm9tKHNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbCgnLmdsb3NzYXJ5LXRlcm0nKSk7XG4gICAgY29uc3Qgc2hvdyA9ICFxIHx8IHRlcm1zLnNvbWUodCA9PiB0LnN0eWxlLmRpc3BsYXkgIT09ICdub25lJyk7XG4gICAgc2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gc2hvdyA/ICcnIDogJ25vbmUnO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LW5vLW1hdGNoZXMnKS5zdHlsZS5kaXNwbGF5ID0gKHEgJiYgIWFueVZpc2libGUpID8gJycgOiAnbm9uZSc7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VHbG9zc2FyeU1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9nbG9zc2FyeU9wZW5lcjtcbiAgX2dsb3NzYXJ5T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBfcmVuZGVyR2xvc3NhcnlNZChtZCkge1xuICBjb25zdCBsaW5lcyA9IG1kLnNwbGl0KCdcXG4nKTtcbiAgbGV0IGh0bWwgPSAnJztcbiAgbGV0IGluTGlzdCA9IGZhbHNlO1xuICBsZXQgaW5UYWJsZSA9IGZhbHNlO1xuICBsZXQgdGFibGVIZWFkID0gZmFsc2U7XG4gIGxldCBpblNlY3Rpb24gPSBmYWxzZTtcbiAgbGV0IGluVGVybSA9IGZhbHNlO1xuXG4gIGNvbnN0IGlubGluZSA9IHMgPT4gc1xuICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC8+L2csICcmZ3Q7JylcbiAgICAucmVwbGFjZSgvYChbXmBdKylgL2csICc8Y29kZT4kMTwvY29kZT4nKVxuICAgIC5yZXBsYWNlKC9cXCpcXCooW14qXSspXFwqXFwqL2csICc8c3Ryb25nPiQxPC9zdHJvbmc+JylcbiAgICAucmVwbGFjZSgvXFwqKFteKl0rKVxcKi9nLCAnPGVtPiQxPC9lbT4nKTtcblxuICBjb25zdCBjbG9zZUxpc3QgID0gKCkgPT4geyBpZiAoaW5MaXN0KSAgeyBodG1sICs9ICc8L3VsPic7ICAgaW5MaXN0ICA9IGZhbHNlOyB9IH07XG4gIGNvbnN0IGNsb3NlVGFibGUgPSAoKSA9PiB7IGlmIChpblRhYmxlKSB7IGh0bWwgKz0gJzwvdGJvZHk+PC90YWJsZT4nOyBpblRhYmxlID0gZmFsc2U7IHRhYmxlSGVhZCA9IGZhbHNlOyB9IH07XG4gIC8vIFNlY3Rpb24gKCMjKSBhbmQgdGVybSAoIyMjKSB3cmFwcGVyIGRpdnMgYXJlIHRoZSB1bml0cyB0aGUgZ2xvc3NhcnkgZmlsdGVyXG4gIC8vIHNob3dzL2hpZGVzIC0gZXZlcnkgIyMjIGJsb2NrIG11c3QgbGFuZCBpbnNpZGUgZXhhY3RseSBvbmUgLmdsb3NzYXJ5LXRlcm0uXG4gIGNvbnN0IGNsb3NlVGVybSAgICA9ICgpID0+IHsgaWYgKGluVGVybSkgICAgeyBodG1sICs9ICc8L2Rpdj4nOyBpblRlcm0gICAgPSBmYWxzZTsgfSB9O1xuICBjb25zdCBjbG9zZVNlY3Rpb24gPSAoKSA9PiB7IGNsb3NlVGVybSgpOyBpZiAoaW5TZWN0aW9uKSB7IGh0bWwgKz0gJzwvZGl2Pic7IGluU2VjdGlvbiA9IGZhbHNlOyB9IH07XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHJhdyA9IGxpbmVzW2ldO1xuICAgIGNvbnN0IGxpbmUgPSByYXcudHJpbUVuZCgpO1xuXG4gICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnIyMgJykpIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7IGNsb3NlU2VjdGlvbigpO1xuICAgICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cImdsb3NzYXJ5LXNlY3Rpb25cIj48aDIgc3R5bGU9XCJtYXJnaW46MjBweCAwIDRweDtmb250LXNpemU6MTVweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO3BhZGRpbmctYm90dG9tOjRweFwiPiR7aW5saW5lKGxpbmUuc2xpY2UoMykpfTwvaDI+YDtcbiAgICAgIGluU2VjdGlvbiA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJyMjIyAnKSkge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VUZXJtKCk7XG4gICAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiZ2xvc3NhcnktdGVybVwiPjxoMyBzdHlsZT1cIm1hcmdpbjoxNHB4IDAgMnB4O2ZvbnQtc2l6ZToxM3B4O2NvbG9yOnZhcigtLWFjY2VudClcIj4ke2lubGluZShsaW5lLnNsaWNlKDQpKX08L2gzPmA7XG4gICAgICBpblRlcm0gPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCctLS0nKSkge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VUZXJtKCk7XG4gICAgICBodG1sICs9ICc8aHIgc3R5bGU9XCJib3JkZXI6bm9uZTtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO21hcmdpbjoxNHB4IDBcIj4nO1xuICAgIH0gZWxzZSBpZiAoL15cXHwvLnRlc3QobGluZSkpIHtcbiAgICAgIGNsb3NlTGlzdCgpO1xuICAgICAgY29uc3QgY2VsbHMgPSBsaW5lLnNwbGl0KCd8Jykuc2xpY2UoMSwgLTEpLm1hcChjID0+IGMudHJpbSgpKTtcbiAgICAgIGlmICgvXlstXFxzfDpdKyQvLnRlc3QobGluZSkpIHtcbiAgICAgICAgdGFibGVIZWFkID0gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKCFpblRhYmxlKSB7XG4gICAgICAgIGluVGFibGUgPSB0cnVlOyB0YWJsZUhlYWQgPSB0cnVlO1xuICAgICAgICBodG1sICs9ICc8dGFibGUgc3R5bGU9XCJ3aWR0aDoxMDAlO2JvcmRlci1jb2xsYXBzZTpjb2xsYXBzZTtmb250LXNpemU6MTJweDttYXJnaW46NnB4IDBcIj48dGhlYWQ+PHRyPic7XG4gICAgICAgIGNlbGxzLmZvckVhY2goYyA9PiB7IGh0bWwgKz0gYDx0aCBzdHlsZT1cInRleHQtYWxpZ246bGVmdDtwYWRkaW5nOjRweCA4cHggNHB4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTtjb2xvcjp2YXIoLS10ZXh0KVwiPiR7aW5saW5lKGMpfTwvdGg+YDsgfSk7XG4gICAgICAgIGh0bWwgKz0gJzwvdHI+PC90aGVhZD48dGJvZHk+JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGh0bWwgKz0gJzx0cj4nO1xuICAgICAgICBjZWxscy5mb3JFYWNoKGMgPT4geyBodG1sICs9IGA8dGQgc3R5bGU9XCJwYWRkaW5nOjNweCA4cHggM3B4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTtjb2xvcjp2YXIoLS1tdXRlZCk7dmVydGljYWwtYWxpZ246dG9wXCI+JHtpbmxpbmUoYyl9PC90ZD5gOyB9KTtcbiAgICAgICAgaHRtbCArPSAnPC90cj4nO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoL14tIC8udGVzdChsaW5lKSkge1xuICAgICAgY2xvc2VUYWJsZSgpO1xuICAgICAgaWYgKCFpbkxpc3QpIHsgaHRtbCArPSAnPHVsIHN0eWxlPVwibWFyZ2luOjRweCAwIDRweCAxNnB4O3BhZGRpbmc6MFwiPic7IGluTGlzdCA9IHRydWU7IH1cbiAgICAgIGh0bWwgKz0gYDxsaSBzdHlsZT1cIm1hcmdpbjoxcHggMFwiPiR7aW5saW5lKGxpbmUuc2xpY2UoMikpfTwvbGk+YDtcbiAgICB9IGVsc2UgaWYgKGxpbmUgPT09ICcnKSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpO1xuICAgICAgaHRtbCArPSAnPGRpdiBzdHlsZT1cIm1hcmdpbjo0cHggMFwiPjwvZGl2Pic7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7XG4gICAgICBodG1sICs9IGA8cCBzdHlsZT1cIm1hcmdpbjozcHggMFwiPiR7aW5saW5lKGxpbmUpfTwvcD5gO1xuICAgIH1cbiAgfVxuICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpOyBjbG9zZVNlY3Rpb24oKTtcbiAgcmV0dXJuIGh0bWw7XG59XG5cbi8vIOKUgOKUgCBzdGF0aWMgbW9kYWwvaGFtYnVyZ2VyIHdpcmluZyAocmVwbGFjZXMgdGhlIGlubGluZSBvbmNsaWNrPS9vbmlucHV0PSB0aGlzXG4vLyBtb2R1bGUgdXNlZCB0byBvd24gaW4gaW5kZXguaHRtbCkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUaGVzZSBhcmUgZml4ZWQsIG5ldmVyLXJlY3JlYXRlZCBlbGVtZW50cyBpbiBpbmRleC5odG1sLCBzbyB3aXJpbmcgdGhlbSBvbmNlIGF0XG4vLyBtb2R1bGUgbG9hZCAoYmVsb3cpIGNhbid0IGRvdWJsZS1maXJlIG9uIGEgcmUtcmVuZGVyIHRoZSB3YXkgYSBkeW5hbWljYWxseVxuLy8gcmVuZGVyZWQgbGlzdCBjb3VsZC5cbmNvbnN0IF9CR19ESVNNSVNTX01PREFMUyA9IFtcbiAgWydnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwnLCBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWxdLFxuICBbJ2hlbHAtbW9kYWwnLCBjbG9zZUhlbHBNb2RhbF0sXG4gIFsnYWJvdXQtbW9kYWwnLCBjbG9zZUFib3V0TW9kYWxdLFxuICBbJ2dsb3NzYXJ5LW1vZGFsJywgY2xvc2VHbG9zc2FyeU1vZGFsXSxcbl07XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKSB7XG4gIGZvciAoY29uc3QgW21vZGFsSWQsIGNsb3NlRm5dIG9mIF9CR19ESVNNSVNTX01PREFMUykge1xuICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobW9kYWxJZCk7XG4gICAgbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBtb2RhbCkgY2xvc2VGbigpOyB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfd2lyZU1vZGFsQnV0dG9ucygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dldHRpbmctc3RhcnRlZC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlbHAtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUhlbHBNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fib3V0LW1vZGFsLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VBYm91dE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUdsb3NzYXJ5TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1maWx0ZXInKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGUgPT4gX2ZpbHRlckdsb3NzYXJ5KGUudGFyZ2V0LnZhbHVlKSk7XG59XG5cbi8vIFRoZSA0IGhhbWJ1cmdlciBpdGVtcyB1aS5qcydzIG93biBtaWdyYXRpb24gZGVmZXJyZWQgKHRoZWlyIGlubGluZSBvbmNsaWNrPVxuLy8gbWl4ZWQgdWkuanMncyBjbG9zZUhhbWJ1cmdlcigpIHdpdGggYSBoZWxwbW9kYWxzLmpzIG1vZGFsLW9wZW4gY2FsbCkgLSB0aGlzXG4vLyBtb2R1bGUgbm93IG93bnMgdGhlIG1vZGFsLW9wZW4gaGFsZiwgc28gaXQgb3ducyByZXRpcmluZyB0aGVtIHRvby5cbmZ1bmN0aW9uIF93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1nZXR0aW5nLXN0YXJ0ZWQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWdsb3NzYXJ5JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3Blbkdsb3NzYXJ5TW9kYWwoKTtcbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1oZWxwJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkhlbHBNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWFib3V0JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkFib3V0TW9kYWwoKTtcbiAgfSk7XG59XG5cbl93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKTtcbl93aXJlTW9kYWxCdXR0b25zKCk7XG5fd2lyZUhhbWJ1cmdlckhhbmRsZXJzKCk7XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBhcHAtZ2xvYmFsIGtleWJvYXJkIHNob3J0Y3V0cyBhbmQgdGhlIEVzY2FwZS1rZXkgbGF5ZXIgY2FzY2FkZS5cbi8vIEV4dHJhY3RlZCBvdXQgb2Ygc2V0dGluZ3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLSBzaG9ydGN1dHMgYXJlXG4vLyBhcHAtd2lkZSwgbm90IHNldHRpbmdzLXNwZWNpZmljLlxuLy8gICBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9rZXlib2FyZC5weVxuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgUGFuZWxOYXYgfSBmcm9tICcuL3BhbmVsbmF2LmpzJztcbmltcG9ydCB7XG4gIF9jb25maXJtQ2FuY2VsLCBjbG9zZUFsZXJ0TW9kYWwsIGNsb3NlQ29udHJvbHNNb2RhbCwgY2xvc2VGaWVsZEVkaXRNb2RhbCxcbiAgX2RpZmZEaXNjYXJkLCBjbG9zZUFjdGlvbnNNb2RhbCwgY2xvc2VLZWJhYiwgaXNIYW1idXJnZXJPcGVuLCBjbG9zZUhhbWJ1cmdlcixcbiAgdG9wbW9zdFZpc2libGVNb2RhbCwgb3BlbkNvbnRyb2xzTW9kYWwsXG59IGZyb20gJy4vdWkuanMnO1xuaW1wb3J0IHtcbiAgY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsLCBjbG9zZUFib3V0TW9kYWwsIGNsb3NlR2xvc3NhcnlNb2RhbCwgY2xvc2VIZWxwTW9kYWwsXG59IGZyb20gJy4vaGVscG1vZGFscy5qcyc7XG5cbi8vIOKUgOKUgCBrZXlib2FyZCBzaG9ydGN1dHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbi8vIEVzY2FwZSBwZWVscyBvbmUgbGF5ZXIgcGVyIHByZXNzLCB0b3Btb3N0IGZpcnN0OiBmbG9hdGluZyBtZW51cyAoa2ViYWIgejo1MDAsXG4vLyBoYW1idXJnZXIgejozMDApIHNpdCBhYm92ZSBtb2RhbHMgKHo6MjAwKSwgd2hpY2ggc2l0IGFib3ZlIHRoZSBzZXR0aW5ncyBwYW5lbFxuLy8gYW5kIHRoZSBmdWxsLXBhbmVsIGVkaXRvcnMuIHRvcG1vc3RWaXNpYmxlTW9kYWwgKHVpLmpzKSByZXNvbHZlcyBtb2RhbFxuLy8gc3RhY2tpbmcgLSBjb25maXJtL2FsZXJ0IHRha2UgcHJpb3JpdHksIHNvIGEgXCJEaXNjYXJkP1wiIGNvbmZpcm0gY2FuY2Vsc1xuLy8gd2l0aG91dCBhbHNvIGNsb3NpbmcgdGhlIHN0aWxsLWRpcnR5IGVkaXRvciB1bmRlcm5lYXRoIGl0LlxuLy9cbi8vIFN0aWxsLWNsYXNzaWMgbW9kYWwgY2xvc2VycyAod2luZG93LmNsb3NlU2NvcmVPdmVycmlkZU1vZGFsIGV0Yy4pIGFyZSBjYWxsZWRcbi8vIGFzIGJhcmUgZ2xvYmFscyAtIHRoZWlyIG93bmluZyBtb2R1bGVzIGhhdmVuJ3QgbWlncmF0ZWQgdG8gRVNNIHlldC5cbmNvbnN0IF9tb2RhbEVzY2FwZUNsb3NlcnMgPSB7XG4gICdjb25maXJtLW1vZGFsJzogICAgICAgICAgICgpID0+IF9jb25maXJtQ2FuY2VsKCksXG4gICdhbGVydC1tb2RhbCc6ICAgICAgICAgICAgICgpID0+IGNsb3NlQWxlcnRNb2RhbCgpLFxuICAnZ2V0dGluZy1zdGFydGVkLW1vZGFsJzogICAoKSA9PiBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWwoKSxcbiAgJ2Fib3V0LW1vZGFsJzogICAgICAgICAgICAgKCkgPT4gY2xvc2VBYm91dE1vZGFsKCksXG4gICdjb250cm9scy1tb2RhbCc6ICAgICAgICAgICgpID0+IGNsb3NlQ29udHJvbHNNb2RhbCgpLFxuICAnZ2xvc3NhcnktbW9kYWwnOiAgICAgICAgICAoKSA9PiBjbG9zZUdsb3NzYXJ5TW9kYWwoKSxcbiAgJ2hlbHAtbW9kYWwnOiAgICAgICAgICAgICAgKCkgPT4gY2xvc2VIZWxwTW9kYWwoKSxcbiAgJ2ZpZWxkLWVkaXQtbW9kYWwnOiAgICAgICAgKCkgPT4gY2xvc2VGaWVsZEVkaXRNb2RhbCgpLFxuICAnZGlmZi1tb2RhbCc6ICAgICAgICAgICAgICAoKSA9PiBfZGlmZkRpc2NhcmQoKSxcbiAgJ3Njb3JlLW92ZXJyaWRlLW1vZGFsJzogICAgKCkgPT4gY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwoKSxcbiAgJ3Byb2ZpbGUtbW9kYWwnOiAgICAgICAgICAgKCkgPT4gY2xvc2VQcm9maWxlTWFuYWdlcigpLFxuICAnaGlnaGxpZ2h0LXJlZWxzLW1vZGFsJzogICAoKSA9PiBjbG9zZUhpZ2hsaWdodFJlZWxzTW9kYWwoKSxcbiAgJ3JlZWwtcHJldmlldy1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VSZWVsUHJldmlldygpLFxuICAncmV0cmFuc2NyaWJlLW1vZGFsJzogICAgICAoKSA9PiBjbG9zZVJldHJhbnNjcmliZU1vZGFsKCksXG4gICdjb250ZXh0LW1vZGFsJzogICAgICAgICAgICgpID0+IGNsb3NlQ29udGV4dE1hbmFnZXIoKSxcbiAgJ2JhdGNoLWV4cG9ydC1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VCYXRjaEV4cG9ydE1vZGFsKCksXG4gICdleHBvcnQtc2V0dGluZ3MtbW9kYWwnOiAgICgpID0+IGNsb3NlRXhwb3J0TW9kYWwoKSxcbiAgJ3RpbWVsaW5lLWludGVydmFsLW1vZGFsJzogKCkgPT4gY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKSxcbiAgJ2F1dG8tYXBwcm92ZS1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VBdXRvQXBwcm92ZU1vZGFsKCksXG4gICdzaW1pbGFyLWNsaXBzLW1vZGFsJzogICAgICgpID0+IGNsb3NlU2ltaWxhckNsaXBzTW9kYWwoKSxcbiAgJ2FjdGlvbnMtbW9kYWwnOiAgICAgICAgICAgKCkgPT4gY2xvc2VBY3Rpb25zTW9kYWwoKSxcbn07XG5cbmZ1bmN0aW9uIF9jbG9zZVRvcG1vc3RMYXllcigpIHtcbiAgaWYgKGNsb3NlS2ViYWIodHJ1ZSkpIHJldHVybjtcbiAgaWYgKGlzSGFtYnVyZ2VyT3BlbigpKSB7IGNsb3NlSGFtYnVyZ2VyKHRydWUpOyByZXR1cm47IH1cbiAgaWYgKGlzUHJvamVjdE1lbnVPcGVuKCkpIHsgY2xvc2VQcm9qZWN0TWVudSh0cnVlKTsgcmV0dXJuOyB9XG4gIGNvbnN0IHRvcE1vZGFsID0gdG9wbW9zdFZpc2libGVNb2RhbCgpO1xuICBpZiAodG9wTW9kYWwpIHtcbiAgICAoX21vZGFsRXNjYXBlQ2xvc2Vyc1t0b3BNb2RhbC5pZF0gfHwgKCgpID0+IHRvcE1vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKSkpKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2V0dGluZ3MtcGFuZWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgeyBjbG9zZVNldHRpbmdzKCk7IHJldHVybjsgfVxuICBpZiAoUGFuZWxOYXYuaXNPcGVuKCkpIHsgUGFuZWxOYXYuY2xvc2UoKTsgcmV0dXJuOyB9XG4gIGlmIChfaXNOZXdSZWNvcmRpbmdQYW5lbE9wZW4oKSkgY2xvc2VOZXdSZWNvcmRpbmdQYW5lbCgpO1xufVxuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XG4gIC8vIEEgZm9jdXNlZCBsaXN0IGl0ZW0gKGNsaXAvdmlkZW8gPGxpPikgaGFuZGxlcyBFbnRlci9TcGFjZSBpdHNlbGYgYW5kIGNhbGxzXG4gIC8vIHByZXZlbnREZWZhdWx0IC0gZG9uJ3QgQUxTTyBydW4gdGhlIGdsb2JhbCBzaG9ydGN1dCAoZS5nLiBTcGFjZSB0b2dnbGluZ1xuICAvLyBwbGF5L3BhdXNlIHdoaWxlIHRoZSBsaSBhY3RpdmF0aW9uIGlzIHNlbGVjdGluZyBhIGNsaXApLlxuICBpZiAoZS5kZWZhdWx0UHJldmVudGVkKSByZXR1cm47XG5cbiAgY29uc3QgaXNUeXBpbmcgPSBlLnRhcmdldC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdURVhUQVJFQScgfHwgZS50YXJnZXQuaXNDb250ZW50RWRpdGFibGU7XG5cbiAgLy8gRXNjYXBlIG11c3Qgd29yayB3aXRoIGZvY3VzIG9uIGEgYnV0dG9uL3NlbGVjdC9saW5rIC0gdGhhdCdzIHdoZXJlIGV2ZXJ5XG4gIC8vIG1vZGFsIHBsYWNlcyBmb2N1cyBvbiBvcGVuLiBPbmx5IHR5cGluZyBzdXJmYWNlcyBrZWVwIEVzY2FwZSB0byB0aGVtc2VsdmVzXG4gIC8vICh0aGVpciBvd24gaGFuZGxlcnMsIGUuZy4gdGhlIGlubGluZSBjYXB0aW9uIGVkaXRvciwgdXNlIGl0IHRvIGNhbmNlbCkuXG4gIGlmIChlLmtleSA9PT0gJ0VzY2FwZScgJiYgaXNUeXBpbmcpIHJldHVybjtcblxuICBpZiAoZS5rZXkgIT09ICdFc2NhcGUnICYmXG4gICAgICAoaXNUeXBpbmcgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ1NFTEVDVCcgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ0EnKSkgcmV0dXJuO1xuXG4gIC8vIEN0cmwvQ21kK1ogKHVuZG8pIGlzIHRoZSBvbmx5IGJpbmRpbmcgdGhhdCBpbnRlbnRpb25hbGx5IHVzZXMgYSBtb2RpZmllci5cbiAgLy8gRXZlcnkgb3RoZXIgc2hvcnRjdXQgaXMgYSBiYXJlIGtleSwgc28gbGV0IG1vZGlmaWVyIGNob3JkcyBmYWxsIHRocm91Z2ggdG9cbiAgLy8gdGhlIGJyb3dzZXIvT1MgKEN0cmwrUiByZWZyZXNoLCBDbWQrQSBzZWxlY3QtYWxsLCBldGMuKSBpbnN0ZWFkIG9mIGhpamFja2luZ1xuICAvLyB0aGVtIC0gcnVubmluZyBhIGJhcmUta2V5IGhhbmRsZXIgaGVyZSB3b3VsZCBhbHNvIHByZXZlbnREZWZhdWx0IHRoZSBjaG9yZC5cbiAgaWYgKGUua2V5ID09PSAneicgJiYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkpKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHVuZG9MYXN0U3RhdHVzKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYWx0S2V5KSByZXR1cm47XG5cbiAgY29uc3QgX2FueU1vZGFsT3BlbiA9ICgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1iZy52aXNpYmxlJykgIT09IG51bGw7XG5cbiAgaWYgKGUua2V5ID09PSAnPycgfHwgZS5rZXkgPT09ICcvJykge1xuICAgIGlmIChfYW55TW9kYWxPcGVuKCkpIHJldHVybjtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgb3BlbkNvbnRyb2xzTW9kYWwoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuICAgIF9jbG9zZVRvcG1vc3RMYXllcigpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEEgdGFrZW92ZXIgcGFuZWwgKGUuZy4gU3BsaXQgRWRpdG9yKSBjb3ZlcnMgdGhlIGRldGFpbCBwYW5lIGJ1dCBub3QgdGhlXG4gIC8vIGNsaXAgbGlzdCBiZXNpZGUgaXQgLSB3aXRob3V0IHRoaXMgZ3VhcmQgSi9LL0EvUiB3b3VsZCBzaWxlbnRseSBhY3Qgb24gYVxuICAvLyBjbGlwIHRoZSB1c2VyIGNhbiBubyBsb25nZXIgc2VlLlxuICBpZiAoX2FueU1vZGFsT3BlbigpIHx8IFBhbmVsTmF2LmlzT3BlbigpKSByZXR1cm47XG5cbiAgLy8gQS9SL0UgbXVzdCBhY3Qgb24gdGhlIGNsaXAgdGhlIHVzZXIgaXMgcG9pbnRpbmcgYXQ6IHdoZW4ga2V5Ym9hcmQgZm9jdXNcbiAgLy8gc2l0cyBvbiBhIGNsaXAgbGlzdCByb3cgKFRhYiksIHRoYXQgcm93IGlzIHRoZSBzdWJqZWN0IC0gbm90IHRoZSBhY3RpdmVcbiAgLy8gY2xpcCwgd2hpY2ggY2FuIGJlIGEgZGlmZmVyZW50IHJvdyAoZm9jdXNlZC12cy1hY3RpdmUgbWlzbWF0Y2gpLlxuICBjb25zdCBmb2N1c2VkUm93ID0gZS50YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50ID8gZS50YXJnZXQuY2xvc2VzdCgnI2NsaXAtbGlzdCBsaVtkYXRhLWNsaXAtaWRdJykgOiBudWxsO1xuICBjb25zdCBzdWJqZWN0Q2xpcElkID0gZm9jdXNlZFJvdyA/IE51bWJlcihmb2N1c2VkUm93LmRhdGFzZXQuY2xpcElkKSA6IEFwcFN0YXRlLmFjdGl2ZUNsaXBJZDtcbiAgaWYgKCFzdWJqZWN0Q2xpcElkKSByZXR1cm47XG5cbiAgLy8gQWN0aXZhdGUgdGhlIHN1YmplY3QgZmlyc3Qgc28gdGhlIGRldGFpbCBwYW5lIGFuZCBwbGF5ZXIgc2hvdyB0aGUgY2xpcFxuICAvLyB0aGUgc2hvcnRjdXQgaXMgYWN0aW5nIG9uIGJlZm9yZSB0aGUgYWN0aW9uIGxhbmRzLlxuICBjb25zdCBfYWN0T25TdWJqZWN0ID0gYWN0aW9uID0+IHtcbiAgICBpZiAoc3ViamVjdENsaXBJZCAhPT0gQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSBzZWxlY3RDbGlwKHN1YmplY3RDbGlwSWQpLnRoZW4oKCkgPT4gYWN0aW9uKHN1YmplY3RDbGlwSWQpKTtcbiAgICBlbHNlIGFjdGlvbihzdWJqZWN0Q2xpcElkKTtcbiAgfTtcbiAgLy8gQXJyb3cgbmF2aWdhdGlvbiBtb3ZlcyBrZXlib2FyZCBmb2N1cyBhbG9uZyB3aXRoIHRoZSBhY3RpdmUgY2xpcCBzbyB0aGVcbiAgLy8gZm9jdXMgcmluZyBhbmQgdGhlIGFjdGl2ZSBoaWdobGlnaHQgY2FuIG5ldmVyIHBvaW50IGF0IGRpZmZlcmVudCByb3dzLlxuICBjb25zdCBfbmF2aWdhdGVUbyA9IGlkID0+IHtcbiAgICBzZWxlY3RDbGlwKGlkKTtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAjY2xpcC1saXN0IGxpW2RhdGEtY2xpcC1pZD1cIiR7aWR9XCJdYCk/LmZvY3VzKCk7XG4gIH07XG5cbiAgY29uc3QgaWR4ID0gQXBwU3RhdGUuY2xpcHMuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gc3ViamVjdENsaXBJZCk7XG5cbiAgc3dpdGNoIChlLmtleSkge1xuICAgIGNhc2UgJ2EnOiBjYXNlICdBJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIF9hY3RPblN1YmplY3QoaWQgPT4gc2V0U3RhdHVzKGlkLCAnYXBwcm92ZWQnKSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdyJzogY2FzZSAnUic6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBfYWN0T25TdWJqZWN0KGlkID0+IHNldFN0YXR1cyhpZCwgJ3JlamVjdGVkJykpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAndSc6IGNhc2UgJ1UnOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgX2FjdE9uU3ViamVjdChpZCA9PiBzZXRTdGF0dXMoaWQsICdwZW5kaW5nJykpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnICc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB7IGNvbnN0IHYgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGxheWVyLWFyZWEgdmlkZW8nKTsgaWYgKHYpIHsgdi5wYXVzZWQgPyB2LnBsYXkoKSA6IHYucGF1c2UoKTsgfSB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdlJzogY2FzZSAnRSc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBfYWN0T25TdWJqZWN0KGV4cG9ydENsaXApO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQXJyb3dMZWZ0JzpcbiAgICBjYXNlICdBcnJvd1VwJzpcbiAgICBjYXNlICdrJzogY2FzZSAnSyc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBpZiAoaWR4ID4gMCkgX25hdmlnYXRlVG8oQXBwU3RhdGUuY2xpcHNbaWR4IC0gMV0uaWQpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQXJyb3dSaWdodCc6XG4gICAgY2FzZSAnQXJyb3dEb3duJzpcbiAgICBjYXNlICdqJzogY2FzZSAnSic6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBpZiAoaWR4ICE9PSAtMSAmJiBpZHggPCBBcHBTdGF0ZS5jbGlwcy5sZW5ndGggLSAxKSBfbmF2aWdhdGVUbyhBcHBTdGF0ZS5jbGlwc1tpZHggKyAxXS5pZCk7XG4gICAgICBicmVhaztcbiAgfVxufSk7XG5cbi8vIE5vIGV4cG9ydHMgLSB0aGlzIG1vZHVsZSdzIG9ubHkgcHVibGljIHN1cmZhY2UgaXMgdGhlIGtleWRvd24gbGlzdGVuZXJcbi8vIHJlZ2lzdHJhdGlvbiBpdHNlbGY7IF9tb2RhbEVzY2FwZUNsb3NlcnMvX2Nsb3NlVG9wbW9zdExheWVyIGFyZSByZWZlcmVuY2VkXG4vLyBvbmx5IGZyb20gd2l0aGluIHRoaXMgbW9kdWxlLiBTdGlsbC1jbGFzc2ljIGdsb2JhbHMgaXQgY2FsbHNcbi8vIChjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCwgc2VsZWN0Q2xpcCwgc2V0U3RhdHVzLCBleHBvcnRDbGlwLCBldGMuKSByZXNvbHZlXG4vLyBvZmYgd2luZG93IHNpbmNlIHRoZWlyIG93bmluZyBtb2R1bGVzIGhhdmVuJ3QgbWlncmF0ZWQgdG8gRVNNIHlldC5cbiIsICIvLyBFU00gZW50cnkgcG9pbnQgLSB0aGUgc3RyYW5nbGVyLWZpZyBzZWFtIChXUzUgc3RlcCAyKS4gZXNidWlsZCBidW5kbGVzIHRoaXNcbi8vIG1vZHVsZSBncmFwaCBpbnRvIHN0YXRpYy9idW5kbGUuZXNtLmpzIChzZWUgc2NyaXB0cy9idWlsZC1lc20ubWpzLCBydW4gYnlcbi8vIGB5dXUtZGV2IGJ1bmRsZWApLiBFdmVyeXRoaW5nIHJlYWNoYWJsZSBmcm9tIGhlcmUgaXMgcmVhbCBFU00gKGltcG9ydC9leHBvcnQpO1xuLy8gdGhlIGNsYXNzaWMgZ2xvYmFsLXNjb3BlIHNjcmlwdHMgc3RpbGwgaW4gYnVuZGxlLmpzIGNhbGwgdGhlc2UgbW9kdWxlcyBhc1xuLy8gd2luZG93IGdsb2JhbHMsIHNvIHRoaXMgZW50cnkgcmUtZXhwb3NlcyBlYWNoIG1pZ3JhdGVkIG1vZHVsZSdzIHB1YmxpYyBzdXJmYWNlXG4vLyBvbiB3aW5kb3cgYXMgYSBjb21wYXRpYmlsaXR5IHNoaW0uXG4vL1xuLy8gTWlncmF0aW5nIGEgY2xhc3NpYyBjb25zdW1lciB0byBgaW1wb3J0YCBzaHJpbmtzIHRoZSBzaGltOiBvbmNlIG5vdGhpbmcgcmVhZHMgYVxuLy8gbmFtZSBvZmYgd2luZG93LCBkZWxldGUgaXRzIGxpbmUgYmVsb3cuIFdoZW4gYnVuZGxlLmpzIGlzIGVtcHR5LCB0aGlzIGZpbGUgaXNcbi8vIHRoZSB3aG9sZSBhcHAgYW5kIHRoZSBzaGltIGlzIGdvbmUuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0ICogYXMgZm9ybWF0IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IENvbG9yUGlja2VyIH0gZnJvbSAnLi9jb2xvcnBpY2tlci5qcyc7XG5pbXBvcnQgeyBQYW5lbE5hdiB9IGZyb20gJy4vcGFuZWxuYXYuanMnO1xuaW1wb3J0ICogYXMgam9icyBmcm9tICcuL2pvYnMuanMnO1xuaW1wb3J0IHsgX2J1aWxkTWVkaWFVcmwsIHNldHVwUmVjb3JkaW5nUHJldmlldyB9IGZyb20gJy4vcHJldmlldy5qcyc7XG5pbXBvcnQge1xuICBfc3luY1NvcnREaXJCdG4sIF9kaWFyaXphdGlvblJlYXNvbiwgX2RpYXJpemF0aW9uUmVhZGluZXNzLCBfZGlhcml6YXRpb25Ob3RlSHRtbCxcbiAgb3BlbkxvZywgY2xlYXJMb2csIGFwcGVuZExvZywgc2hvd1RvYXN0LCBuZXRFcnJNc2csIHJldmVhbEluRm9sZGVyLCBjb3B5VGV4dCxcbiAgY29sbGFwc2libGVDYXJkLFxufSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7XG4gIHNob3dBbGVydCwgY2xvc2VBbGVydE1vZGFsLCBzaG93Q29uZmlybSwgX2NvbmZpcm1DYW5jZWwsXG4gIG9wZW5BY3Rpb25zTW9kYWwsIGNsb3NlQWN0aW9uc01vZGFsLCB0b3Btb3N0VmlzaWJsZU1vZGFsLCBfbWVudUFycm93S2V5ZG93bixcbiAgaXNIYW1idXJnZXJPcGVuLCB0b2dnbGVIYW1idXJnZXIsIGNsb3NlSGFtYnVyZ2VyLFxuICBvcGVuQ29udHJvbHNNb2RhbCwgY2xvc2VDb250cm9sc01vZGFsLFxuICBvcGVuRGlmZk1vZGFsLCBfZGlmZkRpc2NhcmQsXG4gIG9wZW5GaWVsZEVkaXRNb2RhbCwgY2xvc2VGaWVsZEVkaXRNb2RhbCxcbiAgY2xvc2VLZWJhYiwgc2hvd0tlYmFiLCBpbml0UmVzaXplLCBfYXBwbHlQcmVyZXFXYXJuaW5ncywgc2hvd1VuZG9Ub2FzdCxcbiAgcGxheWJhY2tSYXRlUHJlZiwgYXBwbHlQbGF5YmFja1JhdGUsIGluaXRQbGF5YmFja1JhdGUsXG59IGZyb20gJy4vdWkuanMnO1xuaW1wb3J0IHtcbiAgb3BlbkdldHRpbmdTdGFydGVkTW9kYWwsIGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCxcbiAgb3BlbkFib3V0TW9kYWwsIGNsb3NlQWJvdXRNb2RhbCxcbiAgb3BlbkhlbHBNb2RhbCwgY2xvc2VIZWxwTW9kYWwsXG4gIG9wZW5HbG9zc2FyeU1vZGFsLCBjbG9zZUdsb3NzYXJ5TW9kYWwsIF9maWx0ZXJHbG9zc2FyeSxcbn0gZnJvbSAnLi9oZWxwbW9kYWxzLmpzJztcbi8vIHNob3J0Y3V0cy5qcyBoYXMgbm8gcHVibGljIHN1cmZhY2UgKGl0cyBvbmx5IGV4cG9ydCBpcyB0aGUga2V5ZG93biBsaXN0ZW5lclxuLy8gcmVnaXN0cmF0aW9uKSAtIGEgYmFyZSBzaWRlLWVmZmVjdCBpbXBvcnQgcmVnaXN0ZXJzIHRoZSBnbG9iYWwgaGFuZGxlclxuLy8gd2l0aG91dCBhZGRpbmcgYW55dGhpbmcgdG8gdGhlIHdpbmRvdyBzaGltLlxuaW1wb3J0ICcuL3Nob3J0Y3V0cy5qcyc7XG5cbndpbmRvdy5BcHBTdGF0ZSA9IEFwcFN0YXRlO1xuT2JqZWN0LmFzc2lnbih3aW5kb3csIGZvcm1hdCk7XG53aW5kb3cuQ29sb3JQaWNrZXIgPSBDb2xvclBpY2tlcjtcbndpbmRvdy5QYW5lbE5hdiA9IFBhbmVsTmF2O1xuLy8gdXRpbHMuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyLCBvciAoY2xlYXJMb2csIF9kaWFyaXphdGlvblJlYXNvbiwgX2RpYXJpemF0aW9uTm90ZUh0bWwpIGFcbi8vIHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHkgcGFnZS5ldmFsdWF0ZS4gdG9nZ2xlTG9nIGFuZCBpc0NhcmRDb2xsYXBzZWQgZHJvcHBlZDpcbi8vIHRoZWlyIG9ubHkgY29uc3VtZXJzIHdlcmUgdXRpbHMuanMncyBvd24gaW5saW5lIGhhbmRsZXIgKG5vdyBhZGRFdmVudExpc3RlbmVyKVxuLy8gYW5kIGl0cyBvd24gY29sbGFwc2libGVDYXJkLCByZXNwZWN0aXZlbHkuXG53aW5kb3cuX3N5bmNTb3J0RGlyQnRuID0gX3N5bmNTb3J0RGlyQnRuO1xud2luZG93Ll9kaWFyaXphdGlvblJlYXNvbiA9IF9kaWFyaXphdGlvblJlYXNvbjtcbndpbmRvdy5fZGlhcml6YXRpb25SZWFkaW5lc3MgPSBfZGlhcml6YXRpb25SZWFkaW5lc3M7XG53aW5kb3cuX2RpYXJpemF0aW9uTm90ZUh0bWwgPSBfZGlhcml6YXRpb25Ob3RlSHRtbDtcbndpbmRvdy5vcGVuTG9nID0gb3BlbkxvZztcbndpbmRvdy5jbGVhckxvZyA9IGNsZWFyTG9nO1xud2luZG93LmFwcGVuZExvZyA9IGFwcGVuZExvZztcbndpbmRvdy5zaG93VG9hc3QgPSBzaG93VG9hc3Q7XG53aW5kb3cubmV0RXJyTXNnID0gbmV0RXJyTXNnO1xud2luZG93LnJldmVhbEluRm9sZGVyID0gcmV2ZWFsSW5Gb2xkZXI7XG53aW5kb3cuY29weVRleHQgPSBjb3B5VGV4dDtcbndpbmRvdy5jb2xsYXBzaWJsZUNhcmQgPSBjb2xsYXBzaWJsZUNhcmQ7XG4vLyBqb2JzLmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBldmVyeSBleHBvcnQgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyIG9yIGEgc3RpbGwtcHJlc2VudCBpbmxpbmUgaGFuZGxlciwgc28gbm9uZSBvZiB0aGVzZSBjYW5cbi8vIGJlIGRyb3BwZWQgeWV0LiBJdHMgaGFuZGZ1bCBvZiBtdXRhYmxlIHNoYXJlZC1zdGF0ZSBnbG9iYWxzIChfam9iU3RlcERlZnMsXG4vLyBfYWN0aXZlRVMsIGV0Yy4pIGFyZSBOT1QgaGVyZSAtIGpvYnMuanMgd2lyZXMgdGhvc2Ugb250byB3aW5kb3cgaXRzZWxmIHZpYVxuLy8gbGl2ZSBnZXQvc2V0IGFjY2Vzc29ycywgc2luY2UgYSBwbGFpbiBzbmFwc2hvdCB3b3VsZCBnbyBzdGFsZSBvbiByZWFzc2lnbm1lbnQuXG5PYmplY3QuYXNzaWduKHdpbmRvdywgam9icyk7XG4vLyBwcmV2aWV3LmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBzZXR1cFJlY29yZGluZ1ByZXZpZXcgaGFzIGNsYXNzaWMgY29uc3VtZXJzXG4vLyAoY2xpcGNyZWF0ZS5qcywgdmlkZW9zLmpzLCBzcGxpdC5qcywgZXhwb3J0ZWRpdG9yLmpzKTsgX2J1aWxkTWVkaWFVcmwgaGFzIG5vXG4vLyBKUyBjb25zdW1lciBsZWZ0IGJ1dCB0ZXN0cy91aS90ZXN0X3VpX3ZpZGVvLnB5IGV2YWx1YXRlcyBpdCBhcyBhIHBhZ2UgZ2xvYmFsLlxud2luZG93Ll9idWlsZE1lZGlhVXJsID0gX2J1aWxkTWVkaWFVcmw7XG53aW5kb3cuc2V0dXBSZWNvcmRpbmdQcmV2aWV3ID0gc2V0dXBSZWNvcmRpbmdQcmV2aWV3O1xuLy8gdWkuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyLCBhbiBhbHJlYWR5LUVTTSBjYWxsZXIgKGpvYnMuanMvcGFuZWxuYXYuanMnc1xuLy8gd2luZG93LnNob3dDb25maXJtKSwgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUuIF9jb25maXJtT2ssXG4vLyBfZGlmZkFjY2VwdE5ldywgX2RpZmZBY2NlcHRFZGl0IGFuZCBfZmllbGRFZGl0U2F2ZSBkcm9wcGVkOiB0aGVpciBvbmx5XG4vLyBjb25zdW1lcnMgd2VyZSB1aS5qcydzIG93biBpbmxpbmUgaGFuZGxlcnMsIG5vdyBhZGRFdmVudExpc3RlbmVyIGluc2lkZVxuLy8gdWkuanMgaXRzZWxmLCBzbyBub3RoaW5nIG91dHNpZGUgdGhlIG1vZHVsZSBuZWVkcyB0aGVtIG9mZiB3aW5kb3cgYW55bW9yZS5cbndpbmRvdy5zaG93QWxlcnQgPSBzaG93QWxlcnQ7XG53aW5kb3cuY2xvc2VBbGVydE1vZGFsID0gY2xvc2VBbGVydE1vZGFsO1xud2luZG93LnNob3dDb25maXJtID0gc2hvd0NvbmZpcm07XG53aW5kb3cuX2NvbmZpcm1DYW5jZWwgPSBfY29uZmlybUNhbmNlbDtcbndpbmRvdy5vcGVuQWN0aW9uc01vZGFsID0gb3BlbkFjdGlvbnNNb2RhbDtcbndpbmRvdy5jbG9zZUFjdGlvbnNNb2RhbCA9IGNsb3NlQWN0aW9uc01vZGFsO1xud2luZG93LnRvcG1vc3RWaXNpYmxlTW9kYWwgPSB0b3Btb3N0VmlzaWJsZU1vZGFsO1xud2luZG93Ll9tZW51QXJyb3dLZXlkb3duID0gX21lbnVBcnJvd0tleWRvd247XG53aW5kb3cuaXNIYW1idXJnZXJPcGVuID0gaXNIYW1idXJnZXJPcGVuO1xud2luZG93LnRvZ2dsZUhhbWJ1cmdlciA9IHRvZ2dsZUhhbWJ1cmdlcjtcbndpbmRvdy5jbG9zZUhhbWJ1cmdlciA9IGNsb3NlSGFtYnVyZ2VyO1xud2luZG93Lm9wZW5Db250cm9sc01vZGFsID0gb3BlbkNvbnRyb2xzTW9kYWw7XG53aW5kb3cuY2xvc2VDb250cm9sc01vZGFsID0gY2xvc2VDb250cm9sc01vZGFsO1xud2luZG93Lm9wZW5EaWZmTW9kYWwgPSBvcGVuRGlmZk1vZGFsO1xud2luZG93Ll9kaWZmRGlzY2FyZCA9IF9kaWZmRGlzY2FyZDtcbndpbmRvdy5vcGVuRmllbGRFZGl0TW9kYWwgPSBvcGVuRmllbGRFZGl0TW9kYWw7XG53aW5kb3cuY2xvc2VGaWVsZEVkaXRNb2RhbCA9IGNsb3NlRmllbGRFZGl0TW9kYWw7XG53aW5kb3cuY2xvc2VLZWJhYiA9IGNsb3NlS2ViYWI7XG53aW5kb3cuc2hvd0tlYmFiID0gc2hvd0tlYmFiO1xud2luZG93LmluaXRSZXNpemUgPSBpbml0UmVzaXplO1xud2luZG93Ll9hcHBseVByZXJlcVdhcm5pbmdzID0gX2FwcGx5UHJlcmVxV2FybmluZ3M7XG53aW5kb3cuc2hvd1VuZG9Ub2FzdCA9IHNob3dVbmRvVG9hc3Q7XG53aW5kb3cucGxheWJhY2tSYXRlUHJlZiA9IHBsYXliYWNrUmF0ZVByZWY7XG53aW5kb3cuYXBwbHlQbGF5YmFja1JhdGUgPSBhcHBseVBsYXliYWNrUmF0ZTtcbndpbmRvdy5pbml0UGxheWJhY2tSYXRlID0gaW5pdFBsYXliYWNrUmF0ZTtcbi8vIGhlbHBtb2RhbHMuanMgLSBldmVyeSBuYW1lIGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljIChidW5kbGUuanMpXG4vLyBjb25zdW1lciAoYm9vdC5qcywgdmlkZW9zLmpzLCBzaG9ydGN1dHMuanMsIHNldHRpbmdzLmpzIGNhbGwgdGhlc2UgYXMgYmFyZVxuLy8gZ2xvYmFscykgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUsIHNvIG5vbmUgY2FuIGJlIGRyb3BwZWQgeWV0Llxud2luZG93Lm9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsID0gb3BlbkdldHRpbmdTdGFydGVkTW9kYWw7XG53aW5kb3cuY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsID0gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsO1xud2luZG93Lm9wZW5BYm91dE1vZGFsID0gb3BlbkFib3V0TW9kYWw7XG53aW5kb3cuY2xvc2VBYm91dE1vZGFsID0gY2xvc2VBYm91dE1vZGFsO1xud2luZG93Lm9wZW5IZWxwTW9kYWwgPSBvcGVuSGVscE1vZGFsO1xud2luZG93LmNsb3NlSGVscE1vZGFsID0gY2xvc2VIZWxwTW9kYWw7XG53aW5kb3cub3Blbkdsb3NzYXJ5TW9kYWwgPSBvcGVuR2xvc3NhcnlNb2RhbDtcbndpbmRvdy5jbG9zZUdsb3NzYXJ5TW9kYWwgPSBjbG9zZUdsb3NzYXJ5TW9kYWw7XG53aW5kb3cuX2ZpbHRlckdsb3NzYXJ5ID0gX2ZpbHRlckdsb3NzYXJ5O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7QUFNTyxNQUFNLFdBQVc7QUFBQSxJQUN0QixlQUFxQjtBQUFBLElBQ3JCLGNBQXFCO0FBQUEsSUFDckIsUUFBcUIsQ0FBQztBQUFBLElBQ3RCLFVBQXFCLENBQUM7QUFBQTtBQUFBLElBQ3RCLGlCQUFxQjtBQUFBO0FBQUEsSUFDckIsT0FBcUIsQ0FBQztBQUFBLElBQ3RCLGlCQUFxQixDQUFDO0FBQUEsSUFDdEIsVUFBcUIsQ0FBQztBQUFBLElBQ3RCLFVBQXFCLENBQUM7QUFBQSxJ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QUFZO0FBQ25CLFNBQU8sWUFBWTtBQUNuQixTQUFPLFlBQVk7QUFDbkIsU0FBTyxpQkFBaUI7QUFDeEIsU0FBTyxXQUFXO0FBQ2xCLFNBQU8sa0JBQWtCO0FBTXpCLFNBQU8sT0FBTyxRQUFRLFlBQUk7QUFJMUIsU0FBTyxpQkFBaUI7QUFDeEIsU0FBTyx3QkFBd0I7QUFPL0IsU0FBTyxZQUFZO0FBQ25CLFNBQU8sa0JBQWtCO0FBQ3pCLFNBQU8sY0FBYztBQUNyQixTQUFPLGlCQUFpQjtBQUN4QixTQUFPLG1CQUFtQjtBQUMxQixTQUFPLG9CQUFvQjtBQUMzQixTQUFPLHNCQUFzQjtBQUM3QixTQUFPLG9CQUFvQjtBQUMzQixTQUFPLGtCQUFrQjtBQUN6QixTQUFPLGtCQUFrQjtBQUN6QixTQUFPLGlCQUFpQjtBQUN4QixTQUFPLG9CQUFvQjtBQUMzQixTQUFPLHFCQUFxQjtBQUM1QixTQUFPLGdCQUFnQjtBQUN2QixTQUFPLGVBQWU7QUFDdEIsU0FBTyxxQkFBcUI7QUFDNUIsU0FBTyxzQkFBc0I7QUFDN0IsU0FBTyxhQUFhO0FBQ3BCLFNBQU8sWUFBWTtBQUNuQixTQUFPLGFBQWE7QUFDcEIsU0FBTyx1QkFBdUI7QUFDOUIsU0FBTyxnQkFBZ0I7QUFDdkIsU0FBTyxtQkFBbUI7QUFDMUIsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyxtQkFBbUI7QUFJMUIsU0FBTywwQkFBMEI7QUFDakMsU0FBTywyQkFBMkI7QUFDbEMsU0FBTyxpQkFBaUI7QUFDeEIsU0FBTyxrQkFBa0I7QUFDekIsU0FBTyxnQkFBZ0I7QUFDdkIsU0FBTyxpQkFBaUI7QUFDeEIsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyxxQkFBcUI7QUFDNUIsU0FBTyxrQkFBa0I7IiwKICAibmFtZXMiOiBbImVsIiwgIl9CR19ESVNNSVNTX01PREFMUyIsICJfd2lyZU1vZGFsQmdEaXNtaXNzYWxzIiwgIl93aXJlTW9kYWxCdXR0b25zIiwgIl93aXJlSGFtYnVyZ2VySGFuZGxlcnMiXQp9Cg==
