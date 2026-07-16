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

  // yuu_clip/web/static/videos.js
  async function loadVideos() {
    let videos;
    try {
      const [videosRes, sessions] = await Promise.all([
        fetch("/api/videos"),
        fetch("/api/sessions").then((r) => r.ok ? r.json() : []).catch(() => [])
      ]);
      if (!videosRes.ok) throw new Error(`Server error ${videosRes.status}`);
      videos = await videosRes.json();
      AppState.sessions = sessions;
    } catch (err) {
      document.getElementById("video-list").innerHTML = `<li style="padding:10px 14px;color:var(--red)">Failed to load recordings: ${escHtml(String(err.message || err))}</li>`;
      return;
    }
    AppState.videos = videos;
    const analyzingName = AppState.analyzeFilename;
    const showPlaceholder = analyzingName && !videos.some((v) => v.filename === analyzingName);
    if (!videos.length && !showPlaceholder) {
      document.getElementById("video-list").innerHTML = '<li style="padding:10px 14px;color:var(--muted)">No recordings yet</li>';
      _showEmptyState();
      _updateDemoButton(0);
      return;
    }
    _renderVideoList();
    _updateDemoButton(videos.reduce((n, v) => n + v.approved, 0));
    if (!AppState.bootRestoreDone) {
      AppState.bootRestoreDone = true;
      _restoreView();
    }
  }
  function _applyVideoFilters(videos) {
    let result = videos.slice();
    const q = (AppState.videoSearch || "").toLowerCase();
    if (q) result = result.filter((v) => (v.title || "").toLowerCase().includes(q) || (v.filename || "").toLowerCase().includes(q));
    const f = AppState.videoFilters;
    if (f && f.size) {
      if (f.has("has-clips")) result = result.filter((v) => v.clip_count > 0);
      if (f.has("unscored")) result = result.filter((v) => !v.clips_scored_at);
      if (f.has("errors")) result = result.filter((v) => (v.clips_llm_error || 0) > 0);
    }
    const sort = AppState.videoSort || "recent";
    if (sort === "title") result.sort((a, b) => (a.title || a.filename || "").localeCompare(b.title || b.filename || ""));
    else if (sort === "filename") result.sort((a, b) => (a.filename || "").localeCompare(b.filename || "", void 0, { numeric: true }));
    else if (sort === "length") result.sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0));
    else if (sort === "clips") result.sort((a, b) => (b.clip_count || 0) - (a.clip_count || 0));
    if ((AppState.videoSortDir || "desc") === "asc") result.reverse();
    return result;
  }
  function _renderVideoFilterCounts() {
    const setCount = (key, value) => {
      const badge = document.querySelector(`.clip-chip-count[data-vcount="${key}"]`);
      if (badge) badge.textContent = value == null ? "" : String(value);
    };
    const videos = AppState.videos || [];
    if (!videos.length) {
      for (const key of ["all", "has-clips", "unscored", "errors"]) setCount(key, null);
      return;
    }
    setCount("all", videos.length);
    setCount("has-clips", videos.filter((v) => v.clip_count > 0).length);
    setCount("unscored", videos.filter((v) => !v.clips_scored_at).length);
    setCount("errors", videos.filter((v) => (v.clips_llm_error || 0) > 0).length || null);
  }
  function _renderVideoList() {
    _renderVideoFilterCounts();
    const list = document.getElementById("video-list");
    list.innerHTML = "";
    const analyzingName = AppState.analyzeFilename;
    const showPlaceholder = analyzingName && !AppState.videos.some((v) => v.filename === analyzingName);
    if (showPlaceholder) list.appendChild(_analyzingPlaceholderLi(analyzingName));
    const shown = _applyVideoFilters(AppState.videos);
    if (!shown.length && !showPlaceholder) {
      const hasFilter = AppState.videoSearch || AppState.videoFilters && AppState.videoFilters.size;
      list.innerHTML = hasFilter ? `<li style="padding:10px 14px;color:var(--muted)">No recordings match - <a href="#" style="color:var(--accent);text-decoration:underline" data-act="clear-video-filters">Clear filters</a></li>` : '<li style="padding:10px 14px;color:var(--muted)">No recordings yet</li>';
      return;
    }
    _renderGroupedVideoItems(list, shown, analyzingName);
    const _handleVideoListActivate = (e) => {
      const clearLink = e.target.closest('[data-act="clear-video-filters"]');
      if (clearLink) {
        e.preventDefault();
        _clearVideoFilters();
        return;
      }
      const li = e.target.closest("li[data-video-id]");
      if (!li) return;
      const videoId = parseInt(li.dataset.videoId);
      if (window.SessionUI && window.SessionUI.selectionMode) {
        window.toggleGroupSelect(videoId);
        return;
      }
      document.querySelectorAll("#video-list li").forEach((l) => l.classList.remove("active"));
      li.classList.add("active");
      selectVideo(videoId);
    };
    list.onclick = _handleVideoListActivate;
    list.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        _handleVideoListActivate(e);
      }
    };
  }
  function _renderGroupedVideoItems(list, shown, analyzingName) {
    const sessionById = new Map((AppState.sessions || []).map((s) => [s.id, s]));
    const renderedSessions = /* @__PURE__ */ new Set();
    for (const v of shown) {
      const session = v.session_id != null ? sessionById.get(v.session_id) : null;
      if (session && !renderedSessions.has(session.id)) {
        renderedSessions.add(session.id);
        const members = shown.filter((x) => x.session_id === session.id);
        list.appendChild(window.sessionGroupHeaderLi(session, members.length));
        if (!window.isSessionCollapsed(session.id)) {
          for (const m of members) list.appendChild(_videoItemLi(m, analyzingName, true));
        }
      } else if (!session) {
        list.appendChild(_videoItemLi(v, analyzingName, false));
      }
    }
  }
  function _videoItemLi(v, analyzingName, inSession) {
    const isAnalyzing = v.filename === analyzingName && v.status !== "done";
    const selecting = !!(window.SessionUI && window.SessionUI.selectionMode);
    const selectable = selecting && v.parent_video_id == null;
    const li = document.createElement("li");
    li.className = "video-item" + (v.id === AppState.activeVideoId ? " active" : "") + (isAnalyzing ? " analyzing" : "") + (inSession ? " in-session" : "") + (selectable && window.SessionUI.selected.has(v.id) ? " selected" : "");
    li.dataset.videoId = v.id;
    li.tabIndex = 0;
    const clipsPct = v.duration_ms > 0 ? ` (${Math.round(v.total_clip_ms / v.duration_ms * 100)}%)` : "";
    const scoreBar = v.score_min !== null && v.score_max !== null && v.clip_count > 0 ? `<div class="meta">Scores: ${Math.round(v.score_min * 100)}% – ${Math.round(v.score_max * 100)}%</div>` : "";
    const segmentMeta = v.segment_start_s != null && v.segment_end_s != null ? `<div class="meta" style="color:var(--accent2)" title="Where this part sits inside the original recording">from ${_msToHms(v.segment_start_s * 1e3)} to ${_msToHms(v.segment_end_s * 1e3)}</div>` : "";
    const errCount = v.clips_llm_error || 0;
    const llmUsable = !!(window._prereqs || {}).llm_ok;
    const errBadge = errCount === 0 ? "" : llmUsable ? `<div class="meta" style="margin-top:2px;color:var(--warning)" title="LLM scoring failed for ${plural(errCount, "clip")} - re-score to retry">&#9888; ${plural(errCount, "scoring error")}</div>` : `<div class="meta" style="margin-top:2px;color:var(--muted)" title="These clips were scored before a language model was set up - set one up, then re-score for AI scoring and descriptions">Scored without a language model</div>`;
    const checkbox = selectable ? `<input type="checkbox" class="session-select-box" aria-label="Select for grouping" ${window.SessionUI.selected.has(v.id) ? "checked" : ""}>` : "";
    li.innerHTML = `
    <div class="video-item-body">
      ${checkbox}
      <div style="flex:1;min-width:0">
        <div class="name" title="${v.title ? escHtml(v.filename) : ""}">${escHtml(v.title || v.filename)}</div>
        ${v.title ? `<div class="video-title">${escHtml(v.filename)}</div>` : ""}
        ${segmentMeta}
        <div class="meta">${v.duration_hms} &middot; ${v.clip_count} clips &middot; ${_msToHms(v.total_clip_ms)} clipped${clipsPct}</div>
        <div class="meta">${isAnalyzing ? `<span class="spinner" style="display:inline-block;vertical-align:middle"></span> <span style="color:var(--accent)">${escHtml(_fmtVideoStatus(v.status))}…</span>` : `${v.approved} approved &middot; ${v.exported} exported &middot; ${_fmtVideoStatus(v.status)}`}</div>
        ${errBadge}
        ${scoreBar}
      </div>
    </div>`;
    return li;
  }
  function setVideoSearch(q) {
    AppState.videoSearch = q.trim();
    _renderVideoList();
  }
  function setVideoSort(sort) {
    AppState.videoSort = sort;
    localStorage.setItem("videos-sort", sort);
    _renderVideoList();
  }
  function toggleVideoSortDir() {
    AppState.videoSortDir = AppState.videoSortDir === "asc" ? "desc" : "asc";
    localStorage.setItem("videos-sort-dir", AppState.videoSortDir);
    _syncSortDirBtn("videos-sort-dir", AppState.videoSortDir);
    _renderVideoList();
  }
  function toggleVideoFilter(token) {
    const f = AppState.videoFilters;
    if (token === "all") f.clear();
    else if (f.has(token)) f.delete(token);
    else f.add(token);
    _syncVideoFilterChips();
    _renderVideoList();
  }
  function _syncVideoFilterChips() {
    const f = AppState.videoFilters;
    document.querySelectorAll("[data-vfilter]").forEach((chip) => {
      const token = chip.dataset.vfilter;
      const active = token === "all" ? f.size === 0 : f.has(token);
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
    _syncVideoMoreFilters();
  }
  var _HIDDEN_VFILTER_TOKENS = ["unscored", "errors"];
  function _syncVideoMoreFilters() {
    const details = document.getElementById("video-more-filters");
    if (!details) return;
    const active = _HIDDEN_VFILTER_TOKENS.some((t) => AppState.videoFilters.has(t));
    if (active) details.open = true;
    const flag = details.querySelector("[data-more-flag]");
    if (flag) flag.hidden = !active;
  }
  function _clearVideoFilters() {
    AppState.videoFilters.clear();
    AppState.videoSearch = "";
    const searchEl = document.getElementById("video-search-input");
    if (searchEl) searchEl.value = "";
    _syncVideoFilterChips();
    _renderVideoList();
  }
  async function _restoreView() {
    try {
      const saved = JSON.parse(localStorage.getItem("yuuclip-view") || "null");
      if (!saved?.videoId) return;
      if (!AppState.videos.find((v) => v.id === saved.videoId)) return;
      await selectVideo(saved.videoId);
      if (saved.clipId && AppState.clips.find((c) => c.id === saved.clipId)) {
        await window.selectClip(saved.clipId);
      }
    } catch {
    }
  }
  function _analyzingPlaceholderLi(filename) {
    const li = document.createElement("li");
    li.className = "video-item analyzing-placeholder";
    li.innerHTML = `
    <div class="name" style="display:flex;align-items:center;gap:8px"><span class="spinner"></span>${escHtml(filename)}</div>
    <div class="meta" style="color:var(--accent)">Analyzing…</div>`;
    return li;
  }
  function _showEmptyState() {
    document.getElementById("player-area").innerHTML = "";
    document.getElementById("detail").innerHTML = `
    <div class="empty-state">
      <img class="empty-state-mascot" src="/static/gamercat.png" alt="">
      <h2>Welcome to YuuClip</h2>
      <p>Analyze a recording to start reviewing and exporting your best moments. YuuClip shines on talk-heavy sessions - RP, voice chat, streaming, podcasts, and commentary.</p>
      <button class="btn highlight" data-act="open-new-recording-panel">+ Analyze your first recording</button>
      <button class="btn ghost" data-act="open-getting-started" style="margin-top:8px">Getting Started Guide</button>
    </div>`;
  }
  function _updateDemoButton(approvedCount) {
    const btn = document.getElementById("btn-highlight-reels");
    btn.title = approvedCount === 0 ? "View existing reels or build one after approving some clips" : `View or build a highlight reel from ${plural(approvedCount, "approved clip")}`;
  }
  function _updateStartIngestButton() {
    const btn = document.getElementById("btn-start-analyze");
    if (!btn) return;
    if (window._prereqs && !window._prereqs.ffmpeg_ok) return;
    btn.disabled = !_probedInfo;
    btn.title = _probedInfo ? "" : "Select a valid recording file first";
  }
  function _clipsSortParam() {
    return document.getElementById("clips-sort").value;
  }
  function _clipsListUrl(videoId) {
    return `/api/videos/${videoId}/clips?sort=${_clipsSortParam()}&kind=${AppState.clipKind}`;
  }
  async function selectVideo(id) {
    if (window.isSplitEditorOpen()) {
      const hasSplits = typeof _splitPoints !== "undefined" && _splitPoints.length > 0;
      if (hasSplits) {
        showConfirm(
          "Leave Split editor?",
          "You have unsaved split points. Switch to this recording and discard them?",
          "Discard",
          () => {
            window.closeSplitEditor();
            selectVideo(id);
          },
          true
        );
        return;
      }
      window.closeSplitEditor();
    }
    if (window._isNewRecordingPanelOpen() && _panelDirty) {
      showConfirm(
        "Discard new recording?",
        "You have unsaved configuration. Switch to this recording anyway?",
        "Discard",
        () => {
          window._doCloseNewRecordingPanel();
          selectVideo(id);
        },
        true
      );
      return;
    }
    if (window._isNewRecordingPanelOpen()) window._doCloseNewRecordingPanel();
    AppState.activeVideoId = id;
    AppState.activeSessionId = null;
    document.querySelectorAll("#video-list li.session-header.active").forEach((l) => l.classList.remove("active"));
    AppState.activeClipId = null;
    localStorage.setItem("yuuclip-view", JSON.stringify({ videoId: id, clipId: null }));
    AppState.clipFilters.clear();
    AppState.clipSearch = "";
    AppState.clipScoreMin = 0;
    window._syncFilterChips();
    const _searchEl = document.getElementById("clip-search-input");
    if (_searchEl) _searchEl.value = "";
    const _scoreEl = document.getElementById("clip-score-min");
    if (_scoreEl) _scoreEl.value = "0";
    const clipsPromise = fetch(_clipsListUrl(id)).then((r) => r.json());
    await window.ensureContexts();
    const clips = await clipsPromise;
    if (AppState.activeVideoId !== id) return;
    AppState.clips = clips;
    window._renderClips();
    const video = AppState.videos.find((v) => v.id === id);
    if (video) renderVideoDetail(video, null);
    else window.clearDetail();
  }
  function _renderImportedFromLine(video) {
    if (!video.source_url) return "";
    const parts = [escHtml(video.source_uploader || "Unknown channel")];
    if (video.source_upload_date) parts.push(escHtml(video.source_upload_date));
    return `
      <div style="color:var(--muted);font-size:12px;margin-top:4px">
        Imported from ${parts.join(" &middot; ")} &middot;
        <a href="${escHtml(video.source_url)}" target="_blank" rel="noopener noreferrer">View original</a>
      </div>`;
  }
  function renderVideoDetail(video, savedTimeline) {
    AppState.activeVideoData = video;
    const eb = (isEdited) => isEdited ? `<span class="edited-badge">edited</span>` : "";
    document.getElementById("player-area").innerHTML = `<div style="position:relative">
       <video id="recording-preview-video" controls preload="metadata" aria-label="Recording preview" style="display:block;width:100%;max-height:var(--player-max-height, 42vh);object-fit:contain;background:#000"></video>
       <span id="recording-preview-badge" role="status" style="display:none;position:absolute;top:8px;left:8px;background:rgba(0,0,0,.7);color:#e6e6e6;font-size:11px;padding:3px 8px;border-radius:4px"></span>
     </div>`;
    setupRecordingPreview(
      document.getElementById("recording-preview-video"),
      document.getElementById("recording-preview-badge"),
      video.id,
      {
        autoBuild: false,
        isCurrent: () => AppState.activeVideoId === video.id,
        startS: video.segment_start_s,
        endS: video.segment_end_s,
        sourcePath: video.source_path
      }
    );
    document.getElementById("detail").innerHTML = `
    <div><div class="detail-type-badge video-badge">&#127916; Recording</div></div>

    <div class="detail-card">
      <div class="detail-card-header">
        <h2 style="margin:0;font-size:17px;font-weight:700" title="${escHtml(video.title || video.filename)}">${escHtml(video.title || video.filename)}${eb(video.title_is_edited)}</h2>
        <button class="kebab-btn" title="Edit or regenerate title" aria-label="Edit or regenerate title" data-act="video-title-kebab" data-video-id="${video.id}">&#8942;</button>
      </div>
      <div style="color:var(--muted);font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span>${video.duration_hms} &middot; ${video.clip_count} clips &middot; ${_msToHms(video.total_clip_ms)} clipped</span>
        ${AppState.canReveal ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" data-act="reveal-in-folder">Show in Folder</button>` : ""}
      </div>
      ${_renderImportedFromLine(video)}
    </div>

    ${_renderContextSection(video)}

    ${collapsibleCard(
      "video-summary",
      `<span class="detail-card-title">Session Summary${eb(video.summary_is_edited)}</span>`,
      `
      <div id="summary-body">${video.summary ? `<div class="description-long">${escHtml(video.summary)}</div>` : `<div style="color:var(--muted);font-size:12px">No summary yet - generate a title and summary from the transcript.</div>`}</div>`,
      { actions: `${video.summary ? `<button class="kebab-btn" title="Edit or regenerate summary" aria-label="Edit or regenerate summary" data-act="video-summary-kebab" data-video-id="${video.id}">&#8942;</button>` : `<button class="btn ghost" id="btn-summarize-video" data-act="summarize-video" data-video-id="${video.id}">Generate Summary</button>`}` }
    )}

    ${_isVideoBeingAnalyzed(video) ? _analysisLivePanelHTML() : ""}
    ${window._renderRunMetaCard(video)}

    <div class="vid-actions">
      <div class="vid-actions-row">
        <button class="btn" data-act="open-batch-export" data-video-id="${video.id}">Export Approved</button>
        <button class="btn ghost" data-act="open-video-actions" data-video-id="${video.id}">Additional Actions</button>
      </div>
    </div>

    <div id="speakers-section"></div>

    ${video.clip_count > 0 || video.status === "done" ? collapsibleCard(
      "video-transcript",
      `<span class="detail-card-title">Full transcript</span>`,
      `<div id="video-transcript-view" class="transcript"></div>`,
      {
        defaultCollapsed: true,
        attrs: `id="video-transcript-details" data-video-id="${video.id}"`,
        actions: `<span style="display:flex;gap:6px">
          <button class="btn ghost" style="font-size:11px;padding:3px 9px" title="Scan the transcript for mis-heard names (e.g. &quot;You&quot; for &quot;Yuu&quot;) and fix them"
                  data-act="open-name-corrections" data-video-id="${video.id}">Fix names</button>
          <button class="btn ghost" style="font-size:11px;padding:3px 9px" title="Pick a time range to create a clip by hand"
                  data-act="open-clip-create-picker" data-video-id="${video.id}">Create clip</button>
        </span>`
      }
    ) : ""}

    ${collapsibleCard(
      "video-timeline",
      `<span class="detail-card-title">Session Timeline</span>`,
      `
      <div id="timeline-section">
        ${savedTimeline ? window._renderTimelineHTML(savedTimeline) : video.has_timeline ? "" : window._timelineEmptyNoteHTML()}
      </div>`,
      { actions: `<button class="btn ghost" id="btn-generate-timeline" data-act="generate-timeline" data-video-id="${video.id}">${video.has_timeline ? "Regenerate Timeline" : "Generate Timeline"}</button>` }
    )}`;
    if (window.loadSpeakers) window.loadSpeakers(video.id);
    if (window.reloadVideoTranscriptIfOpen) window.reloadVideoTranscriptIfOpen(video.id);
    _syncAnalysisLivePanel2();
    if (!savedTimeline && video.has_timeline) {
      fetch(`/api/videos/${video.id}`).then((r) => r.json()).then((v) => {
        if (v.timeline && v.timeline.length) {
          document.getElementById("timeline-section").innerHTML = window._renderTimelineHTML(v.timeline);
        }
      }).catch(() => {
      });
    }
  }
  function openVideoActionsModal(videoId) {
    const video = AppState.activeVideoData?.id === videoId ? AppState.activeVideoData : AppState.videos.find((v) => v.id === videoId);
    if (!video) return;
    const isSegment = video.parent_video_id != null;
    const groups = [
      { heading: "Review", rows: [
        { label: "Approve Above Score", description: "Automatically approve every clip in this recording above a score threshold you choose.", action: () => window.openAutoApproveModal(videoId) }
      ] },
      { heading: "Regenerate", rows: [
        { label: "Re-score All Clips", description: "Regenerate scores and descriptions for every clip in this recording.", action: () => window.rescoreAllClips(videoId, document.createElement("button")) },
        { label: "Re-describe All Clips", description: "Regenerate descriptions only - scores are kept as-is.", action: () => window.redescribeAllClips(videoId, document.createElement("button")) },
        { label: "Re-detect Speakers", description: "Re-run speaker detection on the existing transcript. Clips and scores are kept; named speakers re-attach to matching voices.", action: () => rediarizeVideo(videoId) },
        { label: "Re-transcribe Recording", description: "Re-run speech-to-text for the whole recording. Clips are kept but flagged for a re-score; regenerate clips to rebuild them from the new transcript.", action: () => retranscribeVideoRun(videoId) },
        { label: "Re-extract Audio", description: "Rebuild the audio tracks from the source file, e.g. after changing the track layout. Re-transcribe afterward to update the transcript.", action: () => reextractVideoRun(videoId) },
        ...window.hasEnabledSemanticHotwords() ? [
          { label: "Scan for Hot-words", description: 'Check every clip against your "Meaning" hot-words using the Similarity engine.', action: () => window.confirmScanHotwordsForVideo(videoId, document.createElement("button")) }
        ] : []
      ] },
      { heading: "Recording tools", rows: [
        ...isSegment ? [] : [
          { label: "Split Recording", description: "Break this recording into segments that can be analyzed independently.", action: () => window.openSplitEditor(videoId) }
        ],
        ...isSegment ? [
          { label: "Undo Split", description: "Merge this segment and its siblings back into the original recording, keeping all of their clips.", action: () => unsplitVideo(videoId) }
        ] : [],
        { label: "Save Captions to SRT", description: "Write the transcript as an SRT caption file next to the source recording.", action: () => exportVideoTranscript(videoId) }
      ] },
      { heading: "Danger Zone", rows: [
        { label: "Regenerate Clips", description: "Rebuild clips from the existing transcript. Replaces every clip - discarding approvals, edits, tags, and scores - with fresh, unscored candidates. Skips re-transcription.", danger: true, action: () => regenerateClipsRun(videoId) },
        { label: "Re-analyze (full)", description: "Re-run the entire pipeline from scratch. Replaces all clips, scores, and speakers for this recording.", danger: true, action: () => reanalyzeVideo(videoId) },
        { label: "Reset Approvals", description: "Clear the approve/reject status on every clip in this recording.", danger: true, action: () => window.resetApprovals(videoId) },
        { label: "Remove Recording", description: "Remove this recording from YuuClip. The source file on disk is not deleted.", danger: true, action: () => deleteVideo(videoId) }
      ] }
    ];
    openActionsModal(`${video.title || video.filename} - Additional Actions`, groups);
  }
  async function exportVideoTranscript(id, btn) {
    await _doExportVideoTranscript(id, btn, false);
  }
  async function _doExportVideoTranscript(id, btn, overwrite) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Exporting…";
    }
    try {
      const res = await fetch(`/api/videos/${id}/export-transcript?overwrite=${overwrite}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.exists) {
        showConfirm(
          "Overwrite existing captions?",
          `An SRT file already exists at:<br><code>${escHtml(data.path)}</code><br><br>Overwrite it with the current transcript?`,
          "Overwrite",
          () => _doExportVideoTranscript(id, btn, true),
          true
        );
        return;
      }
      if (!res.ok) throw new Error(formatApiError(data));
      showToast(`Captions exported → ${data.path}`);
    } catch (err) {
      showToast(`Export failed: ${err.message}`, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save Captions to SRT";
      }
    }
  }
  function deleteVideo(id) {
    const video = AppState.videos.find((v) => v.id === id);
    const name = video ? video.filename : `recording ${id}`;
    showConfirm(
      "Remove recording?",
      `Remove <strong>${escHtml(name)}</strong> from YuuClip?<br><br>All clips, transcripts, and extracted audio are removed from the database. Your source recording file is <strong>not</strong> deleted.`,
      "Remove",
      () => _doDeleteVideo(id, name),
      true
    );
  }
  async function _doDeleteVideo(id, name) {
    if (AppState.activeVideoId === id) await window._releasePlayerBeforeDelete();
    const delRes = await fetch(`/api/videos/${id}`, { method: "DELETE" });
    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      showToast(`Failed to remove recording: ${formatApiError(err)}`, "error");
      if (AppState.activeClipId) window.selectClip(AppState.activeClipId);
      return;
    }
    if (AppState.activeVideoId === id) {
      AppState.activeVideoId = null;
      AppState.activeClipId = null;
      document.getElementById("clip-list").innerHTML = "";
      window.clearDetail();
    }
    await loadVideos();
    showToast(`"${name}" removed from YuuClip`);
  }
  function _isVideoBeingAnalyzed(video) {
    return !!AppState.analyzeFilename && video.filename === AppState.analyzeFilename && video.status !== "done";
  }
  function _analysisLivePanelHTML() {
    return `
    <div class="detail-card analysis-live" id="analysis-live-panel">
      <div class="detail-card-header">
        <span class="detail-card-title"><span class="spinner"></span> Analysis in progress</span>
        <span style="display:flex;align-items:center;gap:10px">
          <span class="muted" id="analysis-live-elapsed" style="font-size:12px"></span>
          <button class="btn ghost" data-act="cancel-job" style="font-size:12px;padding:2px 10px">Cancel</button>
        </span>
      </div>
      <div id="analysis-live-steps" class="job-steps-detail"></div>
      <div class="muted" style="font-size:11px;margin-top:8px">Runs in the background - you can leave or refresh this page without interrupting it.</div>
    </div>`;
  }
  function _syncAnalysisLivePanel2() {
    const stepsEl = document.getElementById("analysis-live-steps");
    if (!stepsEl) return;
    stepsEl.innerHTML = window._jobStepDefs.map((step, i) => {
      const cls = i < window._activeStepIdx ? "done" : i === window._activeStepIdx ? "active" : "";
      if (i !== window._activeStepIdx) return `<span class="step ${cls}">${escHtml(step.label)}</span>`;
      const { text, pct } = _stepPillLabel(i);
      const fill = pct != null ? ` style="background-image:linear-gradient(to right, var(--green) ${pct}%, var(--accent) ${pct}%)"` : "";
      return `<span class="step ${cls}"${fill}>${escHtml(text)}</span>`;
    }).join("");
    const elapsedEl = document.getElementById("analysis-live-elapsed");
    if (elapsedEl) {
      const startIso = AppState.activeVideoData && AppState.activeVideoData.analyze_started_at;
      const startMs = startIso ? _parseServerDate(startIso).getTime() : window._jobStartTime;
      elapsedEl.textContent = _fmtElapsed(Date.now() - startMs);
    }
  }
  function _renderContextSection(video) {
    const assigned = video.context_names || [];
    const chips = assigned.map((context_id) => {
      const ctx = AppState.contexts.find((c) => c.context_id === context_id);
      const name = ctx ? ctx.display_name : context_id;
      return `<span class="context-chip">${escHtml(name)}<button class="chip-x" data-rmctx="${escHtml(context_id)}" title="Remove" aria-label="Remove ${escHtml(name)}">×</button></span>`;
    });
    const available = AppState.contexts.filter((c) => !assigned.includes(c.context_id));
    const addSelect = available.length ? `<select style="font-size:11px;padding:3px 7px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--muted);cursor:pointer"
              data-act="add-video-context" data-video-id="${video.id}">
        <option value="">+ Add</option>
        ${available.map((c) => `<option value="${escHtml(c.context_id)}">${escHtml(c.display_name || c.context_id)}</option>`).join("")}
       </select>` : "";
    const provLines = [];
    if (video.clips_scored_at) {
      const scoredCtx = video.clips_scored_context || [];
      const stale = JSON.stringify([...assigned].sort()) !== JSON.stringify([...scoredCtx].sort());
      const when = _fmtDate(video.clips_scored_at);
      const ctxNames = scoredCtx.map((s) => {
        const c = AppState.contexts.find((x) => x.context_id === s);
        return c ? c.display_name : s;
      });
      const ctxStr = ctxNames.length ? " · " + ctxNames.map(escHtml).join(", ") : " · no context";
      provLines.push(`<span class="${stale ? "provenance-stale" : ""}">Clips scored ${escHtml(when)}${ctxStr}${stale ? " - ⚠ contexts changed since last score" : ""}</span>`);
    }
    if (video.analyze_run) provLines.push(`<span>${escHtml(window._runTimingLine(video.analyze_run))}</span>`);
    const noContextsDefined = AppState.contexts.length === 0;
    const emptyMsg = noContextsDefined ? `<span style="color:var(--muted);font-size:12px">No contexts defined - <button class="btn ghost" style="padding:0;display:inline;font-size:12px" data-act="open-context-manager">create one</button></span>` : !assigned.length ? `<span style="color:var(--muted);font-size:12px">None assigned</span>` : "";
    const rescoreBtn = assigned.length && video.clips_scored_at ? `<button class="btn" style="font-size:12px;padding:4px 12px" data-act="rescore-clips" data-video-id="${video.id}">Re-score clips with context</button>` : assigned.length ? `<button class="btn" style="font-size:12px;padding:4px 12px" data-act="rescore-clips" data-video-id="${video.id}">Score clips with context</button>` : "";
    const errCount = video.clips_llm_error || 0;
    const failedBtn = errCount > 0 && !!(window._prereqs || {}).llm_ok ? `<button class="btn" style="font-size:12px;padding:4px 12px;border-color:var(--warning);color:var(--warning)" data-act="rescore-failed-clips" data-video-id="${video.id}" title="Re-run LLM scoring only for the ${plural(errCount, "clip")} that failed last time">&#9888; Re-score ${plural(errCount, "failed clip")}</button>` : "";
    return collapsibleCard(
      "video-contexts",
      `<span class="detail-card-title">World Contexts</span>`,
      `
      <div class="context-chips">
        ${chips.join("")}${emptyMsg}${addSelect ? "&nbsp;" + addSelect : ""}
      </div>
      ${provLines.length ? `<div class="provenance-note">${provLines.join("<br>")}</div>` : ""}
      ${rescoreBtn || failedBtn ? `<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">${rescoreBtn}${failedBtn}</div>` : ""}`
    );
  }
  function _needsModelCtaHTML(payload) {
    const cta = payload.show_cta === false ? "" : `<button class="btn ghost" style="font-size:11px;padding:3px 9px"
       data-act="install-local-model">Install a local model</button>`;
    return `<div class="needs-model-cta">
    <div class="needs-model-heading">${escHtml(payload.heading)}</div>
    <div class="needs-model-detail">${escHtml(payload.detail)}</div>
    ${cta}
  </div>`;
  }
  async function _refreshVideoDetail(videoId) {
    await loadVideos();
    const updated = AppState.videos.find((x) => x.id === videoId);
    if (updated) renderVideoDetail(updated, null);
  }
  function reanalyzeVideo(id) {
    if (_blockedByAnalyze("re-analyze this recording")) return;
    const video = AppState.videos.find((v) => v.id === id);
    if (!video) return;
    window.openReanalyzePanel(video);
  }
  async function _reanalyzeParams(video) {
    const currentContexts = video && video.context_names || [];
    const recorded = video && video.analyze_run && video.analyze_run.settings;
    if (recorded && recorded.model) {
      return {
        model: recorded.model,
        profile: recorded.track_layout && recorded.track_layout !== "default" ? recorded.track_layout : null,
        energy_mode: recorded.energy_mode || "fast",
        scene_mode: recorded.scene_mode || "fast",
        diarize: typeof recorded.speaker_labels === "boolean" ? recorded.speaker_labels : null,
        context_names: currentContexts.length ? currentContexts : recorded.contexts || []
      };
    }
    let cfg = {};
    try {
      cfg = await fetch("/api/config").then((r) => r.json());
    } catch {
    }
    return {
      model: cfg.whisper_model || "medium",
      profile: null,
      energy_mode: cfg.energy_mode || "fast",
      scene_mode: cfg.scene_detection_mode || "fast",
      diarize: null,
      context_names: currentContexts
    };
  }
  function rediarizeVideo(id) {
    if (_blockedByAnalyze("re-detect speakers")) return;
    const video = AppState.videos.find((v) => v.id === id);
    const name = video ? video.filename : id;
    openLog();
    appendLog(`Re-detecting speakers: ${name}`);
    streamSSE(
      `/api/videos/${id}/rediarize`,
      async () => {
        await loadVideos();
        const v = AppState.videos.find((x) => x.id === id);
        if (v && AppState.activeVideoId === id) renderVideoDetail(v, null);
        if (window.loadSpeakers) window.loadSpeakers(id);
        showToast("Speaker detection complete");
        window.SoundFx.play("analysis");
      },
      [{ label: "Speakers", patterns: ["Detecting speakers"] }],
      "Re-detecting speakers",
      false
    );
  }
  function reextractVideoRun(id) {
    if (_blockedByAnalyze("re-extract audio")) return;
    const video = AppState.videos.find((v) => v.id === id);
    const name = video ? video.filename : id;
    openLog();
    appendLog(`Re-extracting audio: ${name}`);
    streamSSE(
      `/api/videos/${id}/reextract`,
      async () => {
        await loadVideos();
        const v = AppState.videos.find((x) => x.id === id);
        if (v && AppState.activeVideoId === id) renderVideoDetail(v, null);
        showToast("Audio re-extracted - re-transcribe to update the transcript");
        window.SoundFx.play("analysis");
      },
      [{ label: "Extract", patterns: ["Extracting audio"] }],
      "Re-extracting audio",
      false
    );
  }
  function retranscribeVideoRun(id) {
    if (_blockedByAnalyze("re-transcribe this recording")) return;
    const video = AppState.videos.find((v) => v.id === id);
    const name = video ? video.filename : id;
    openLog();
    appendLog(`Re-transcribing: ${name}`);
    streamSSE(
      `/api/videos/${id}/retranscribe`,
      async () => {
        await loadVideos();
        if (AppState.activeVideoId === id) await selectVideo(id);
        showToast("Re-transcription complete - re-score to refresh clip scores");
        window.SoundFx.play("analysis");
      },
      [{ label: "Extract", patterns: ["Extracting audio"] }, { label: "Transcribe", patterns: ["Transcribing"] }],
      "Re-transcribing",
      false
    );
  }
  function regenerateClipsRun(id) {
    if (_blockedByAnalyze("regenerate clips")) return;
    const video = AppState.videos.find((v) => v.id === id);
    const name = video ? video.filename : id;
    showConfirm(
      "Regenerate clips?",
      "This rebuilds every clip from the current transcript, discarding all approvals, edits, tags, and scores on this recording's existing clips. The transcript itself is kept. Re-score afterward to populate the new clips.",
      "Regenerate Clips",
      () => {
        openLog();
        appendLog(`Regenerating clips: ${name}`);
        streamSSE(
          `/api/videos/${id}/regenerate-clips`,
          async () => {
            await loadVideos();
            if (AppState.activeVideoId === id) await selectVideo(id);
            showToast("Clips regenerated - re-score to populate scores");
            window.SoundFx.play("analysis");
          },
          [{ label: "Generate Clips", patterns: ["Generating clips"] }],
          "Regenerating clips",
          false
        );
      },
      true
    );
  }
  function unsplitVideo(videoId) {
    const video = AppState.videos.find((v) => v.id === videoId);
    if (!video || video.parent_video_id == null) return;
    const siblings = AppState.videos.filter((v) => v.parent_video_id === video.parent_video_id);
    const clipTotal = siblings.reduce((sum, v) => sum + (v.clip_count || 0), 0);
    showConfirm(
      "Undo split?",
      `This merges ${plural(siblings.length, "segment")} - and ${plural(clipTotal, "clip")} on them - back into the original recording, restoring each clip's original timing. The segments are removed and the original recording becomes visible again.`,
      "Undo Split",
      () => _doUnsplitVideo(videoId),
      true
    );
  }
  async function _doUnsplitVideo(videoId) {
    let res;
    try {
      res = await fetch(`/api/videos/${videoId}/unsplit`, { method: "POST" });
    } catch (err) {
      showToast(netErrMsg(err), "error");
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(`Undo split failed: ${formatApiError(err)}`, "error");
      return;
    }
    const data = await res.json();
    showToast(`Split undone - ${plural(data.merged_clips, "clip")} restored to the original recording`);
    await loadVideos();
    selectVideo(data.parent_id);
  }
  function _openVideoFieldKebab(videoId, btn, field) {
    const video = AppState.activeVideoData;
    const isTitle = field === "title";
    const editTitle = isTitle ? "Edit Title" : "Edit Summary";
    const revertTitle = isTitle ? "Revert Title" : "Revert Summary";
    const diffLabel = isTitle ? "Title" : "Summary";
    const current = isTitle ? video?.title : video?.summary;
    const isEdited = isTitle ? video?.title_is_edited : video?.summary_is_edited;
    const original = isTitle ? video?.title_original : video?.summary_original;
    const items = [
      {
        label: "Edit",
        action: () => openFieldEditModal(editTitle, current || "", async (v) => {
          await _patchVideoField(
            videoId,
            "accept_edit",
            field,
            isTitle ? v : null,
            isTitle ? null : v
          );
          await _refreshVideoDetail(videoId);
        })
      }
    ];
    if (isEdited) {
      items.push({
        label: "Revert to Original",
        action: () => openDiffModal(revertTitle, [
          { label: diffLabel, current, proposed: original }
        ], async () => {
          await _patchVideoField(videoId, "revert", field, null, null);
          await _refreshVideoDetail(videoId);
        }, { revertMode: true })
      });
    }
    items.push(null, { label: "Regenerate", action: () => window.summarizeVideo(videoId, null) });
    if (!isTitle) items.push({ label: "Regenerate (auto-save)", action: () => window.regenSummaryAuto(videoId, null) });
    showKebab(btn, items);
  }
  function openVideoTitleKebab(videoId, btn) {
    _openVideoFieldKebab(videoId, btn, "title");
  }
  function openVideoSummaryKebab(videoId, btn) {
    _openVideoFieldKebab(videoId, btn, "summary");
  }
  async function _patchVideoField(videoId, action, field, newTitle, newSummary) {
    const res = await fetch(`/api/videos/${videoId}/fields`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, field, new_title: newTitle, new_summary: newSummary })
    });
    if (!res.ok) showToast("Save failed", "error");
  }
  async function onClipsSortChange() {
    if (!AppState.activeVideoId) return;
    localStorage.setItem("clips-sort", _clipsSortParam());
    try {
      AppState.clips = await fetch(_clipsListUrl(AppState.activeVideoId)).then((r) => r.json());
    } catch {
      return;
    }
    window._renderClips();
  }
  function _handleDetailClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    const videoId = el.dataset.videoId != null ? parseInt(el.dataset.videoId) : null;
    switch (act) {
      case "open-new-recording-panel":
        window.openNewRecordingPanel();
        break;
      case "open-getting-started":
        openGettingStartedModal();
        break;
      case "video-title-kebab":
        openVideoTitleKebab(videoId, el);
        break;
      case "video-summary-kebab":
        openVideoSummaryKebab(videoId, el);
        break;
      case "summarize-video":
        window.summarizeVideo(videoId, el);
        break;
      case "reveal-in-folder":
        revealInFolder(AppState.activeVideoData.path);
        break;
      case "open-batch-export":
        window.openBatchExportModal(videoId);
        break;
      case "open-video-actions":
        openVideoActionsModal(videoId);
        break;
      case "open-name-corrections":
        window.openNameCorrections(videoId);
        break;
      case "open-clip-create-picker":
        window.openClipCreatePicker(videoId);
        break;
      case "generate-timeline":
        window.generateTimeline(videoId);
        break;
      case "cancel-job":
        cancelJob();
        break;
      case "open-context-manager":
        window.openContextManager();
        break;
      case "rescore-clips":
        window.rescoreClips(videoId, el);
        break;
      case "rescore-failed-clips":
        window.rescoreFailedClips(videoId, el);
        break;
      case "install-local-model":
        window.openSettings();
        setTimeout(() => window._scrollToSettingsSection("settings-sec-llm"), 120);
        break;
    }
  }
  function _handleDetailChange(e) {
    const el = e.target.closest('[data-act="add-video-context"]');
    if (!el) return;
    const videoId = parseInt(el.dataset.videoId);
    window.addVideoContext(videoId, el.value);
    el.value = "";
  }
  document.getElementById("detail").addEventListener("click", _handleDetailClick);
  document.getElementById("detail").addEventListener("change", _handleDetailChange);

  // yuu_clip/web/static/videos-timeline.js
  function _renderTimelineHTML(entries) {
    if (!entries || !entries.length) return "";
    const rows = entries.map(
      (e) => `<div class="timeline-entry">
      <div class="timeline-stamp">${escHtml(e.start_hms)}</div>
      <div class="timeline-text">${escHtml(e.text)}</div>
    </div>`
    ).join("");
    return `<div class="timeline">${rows}</div>`;
  }
  function _timelineEmptyNoteHTML() {
    return `<div style="color:var(--muted);font-size:12px">No timeline yet - generate a time-stamped outline of the session.</div>`;
  }
  var _timelineVideoId = null;
  var _timelineIntervalOpener = null;
  function generateTimeline(id) {
    _timelineIntervalOpener = document.activeElement;
    _timelineVideoId = id;
    const video = AppState.videos.find((v) => v.id === id);
    _loadTimelineIntervalConfig().then(() => {
      updateTimelineIntervalHint(video);
      document.getElementById("timeline-interval-modal").classList.add("visible");
      setTimeout(() => document.getElementById("timeline-interval-value")?.focus(), 50);
    });
  }
  function closeTimelineIntervalModal2() {
    document.getElementById("timeline-interval-modal").classList.remove("visible");
    const opener = _timelineIntervalOpener;
    _timelineIntervalOpener = null;
    if (opener?.focus) opener.focus();
  }
  async function _loadTimelineIntervalConfig() {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) return;
      const cfg = await res.json();
      const val = cfg.ui_timeline_interval_seconds || 900;
      const unit = cfg.ui_timeline_interval_unit || "minutes";
      if (unit === "minutes") {
        document.getElementById("timeline-interval-value").value = Math.round(val / 60);
        document.getElementById("timeline-interval-unit").value = "minutes";
      } else {
        document.getElementById("timeline-interval-value").value = val;
        document.getElementById("timeline-interval-unit").value = "seconds";
      }
    } catch (_) {
    }
  }
  function updateTimelineIntervalHint(video) {
    video = video || AppState.videos.find((v) => v.id === _timelineVideoId);
    const val = parseInt(document.getElementById("timeline-interval-value").value, 10) || 1;
    const unit = document.getElementById("timeline-interval-unit").value;
    const intervalS = unit === "minutes" ? val * 60 : val;
    const hint = document.getElementById("timeline-interval-hint");
    const genBtn = document.querySelector("#timeline-interval-modal .btn.primary");
    if (intervalS < 10) {
      hint.textContent = "Minimum interval is 10 seconds.";
      hint.style.color = "var(--red)";
      if (genBtn) genBtn.disabled = true;
      return;
    }
    if (genBtn) genBtn.disabled = false;
    hint.style.color = "var(--muted)";
    if (video && video.duration_ms) {
      const dur = video.duration_ms / 1e3;
      const durMin = Math.round(dur / 60);
      const entries = Math.max(1, Math.ceil(dur / intervalS));
      if (intervalS >= dur) {
        hint.textContent = `Recording is ${durMin} min - this produces 1 entry covering the whole session.`;
      } else {
        hint.textContent = `Recording is ${durMin} min - produces ~${plural(entries, "entry", "entries")}.`;
      }
    } else {
      hint.textContent = "";
    }
  }
  async function confirmGenerateTimeline() {
    const unit = document.getElementById("timeline-interval-unit").value;
    const n = parseInt(document.getElementById("timeline-interval-value").value, 10);
    const intervalS = _parseIntervalS(n || 15, unit);
    if (intervalS === null) return;
    fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ui_timeline_interval_seconds: intervalS, ui_timeline_interval_unit: unit })
    }).catch(() => {
    });
    closeTimelineIntervalModal2();
    _startGenerateTimeline(_timelineVideoId, intervalS);
  }
  function _startGenerateTimeline(id, intervalS) {
    if (_blockedByAnalyze("generate a timeline")) return;
    const section = document.getElementById("timeline-section");
    const intervalLabel = intervalS >= 60 ? `${Math.round(intervalS / 60)}-minute` : `${intervalS}-second`;
    section.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:4px 0">Generating timeline - entries will appear as each ${intervalLabel} window completes…</div>`;
    const btn = document.getElementById("btn-generate-timeline");
    btn.disabled = true;
    btn.textContent = "Generating Timeline…";
    _supersedeActiveStream();
    const resetBtn = () => {
      const video = AppState.videos.find((v) => v.id === id);
      btn.disabled = false;
      btn.textContent = video?.has_timeline ? "Regenerate Timeline" : "Generate Timeline";
    };
    let firstEntry = true;
    let needsModel = false;
    const handle = _openSSE(
      `/api/videos/${id}/timeline?interval_s=${intervalS}`,
      (data) => {
        if (data && data.needs_model) {
          needsModel = true;
          section.innerHTML = _needsModelCtaHTML(data);
          return;
        }
        if (firstEntry) {
          section.innerHTML = `<div class="timeline" id="timeline-list"></div>`;
          firstEntry = false;
        }
        const row = document.createElement("div");
        row.className = "timeline-entry";
        row.innerHTML = `
        <div class="timeline-stamp">${escHtml(data.start_hms)}</div>
        <div class="timeline-text">${escHtml(data.text)}</div>`;
        document.getElementById("timeline-list").appendChild(row);
      },
      () => {
        _clearActiveStream(handle);
        resetBtn();
        if (needsModel) return;
        const video = AppState.videos.find((v) => v.id === id);
        if (video) video.has_timeline = true;
        showToast("Timeline generated");
      },
      (errMsg) => {
        _clearActiveStream(handle);
        resetBtn();
        if (firstEntry) {
          const video = AppState.videos.find((v) => v.id === id);
          section.innerHTML = video?.has_timeline ? "" : _timelineEmptyNoteHTML();
        }
        showToast(`Timeline generation failed - ${errMsg}`, "error");
      }
    );
    _setActiveStream(handle, resetBtn);
  }
  function _wireTimelineModal() {
    const modal = document.getElementById("timeline-interval-modal");
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeTimelineIntervalModal2();
    });
    document.getElementById("timeline-interval-cancel-btn").addEventListener("click", () => closeTimelineIntervalModal2());
    document.getElementById("timeline-interval-generate-btn").addEventListener("click", () => confirmGenerateTimeline());
    document.getElementById("timeline-interval-value").addEventListener("input", () => updateTimelineIntervalHint());
    document.getElementById("timeline-interval-unit").addEventListener("change", () => updateTimelineIntervalHint());
  }
  _wireTimelineModal();

  // yuu_clip/web/static/videos-summary.js
  async function summarizeVideo(id, btn) {
    const actionBtn = document.getElementById("btn-summarize-video") || btn;
    if (actionBtn && actionBtn.disabled) return;
    const orig = actionBtn ? actionBtn.textContent : "";
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = "Generating Summary…";
    }
    try {
      const res = await fetch(`/api/videos/${id}/summarize`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatApiError(err));
      }
      const data = await res.json();
      if (data.needs_model) {
        const body = document.getElementById("summary-body");
        if (body) body.innerHTML = _needsModelCtaHTML(data);
        return;
      }
      openDiffModal("Review Generated Summary", [
        { label: "Title", current: data.title_current, proposed: data.title_new },
        { label: "Summary", current: data.summary_current, proposed: data.summary_new }
      ], async (action, edited) => {
        const patch = await fetch(`/api/videos/${id}/fields`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, field: "both", new_title: edited[0], new_summary: edited[1] })
        });
        if (!patch.ok) {
          showToast("Save failed", "error");
          return;
        }
        await loadVideos();
        const video = AppState.videos.find((v) => v.id === id);
        if (video) renderVideoDetail(video, null);
        showToast(action === "accept_new" ? "Summary accepted" : "Summary saved as edit");
      });
    } catch (err) {
      showToast(`Summary failed: ${err.message}`, "error");
    } finally {
      if (actionBtn) {
        actionBtn.disabled = false;
        actionBtn.textContent = orig;
      }
    }
  }
  function regenSummaryAuto(id, btn) {
    showConfirm(
      "Regenerate and auto-save?",
      "The current title and summary will be replaced without a review step. This cannot be undone.",
      "Regenerate",
      () => _doRegenSummaryAuto(id, btn),
      true
    );
  }
  function _doRegenSummaryAuto(id, btn) {
    if (_blockedByAnalyze("regenerate the summary")) return;
    const actionBtn = document.getElementById("btn-regen-summary") || btn;
    if (actionBtn && actionBtn.disabled) return;
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = "Regenerating…";
    }
    openLog();
    _supersedeActiveStream();
    const resetBtn = () => {
      if (actionBtn) {
        actionBtn.disabled = false;
        actionBtn.textContent = "Regenerate (auto-save)";
      }
    };
    let hadError = false;
    let needsModel = false;
    const handle = _openSSE(
      `/api/videos/${id}/regenerate-summary`,
      (data) => {
        if (data && data.needs_model) {
          needsModel = true;
          const body = document.getElementById("summary-body");
          if (body) body.innerHTML = _needsModelCtaHTML(data);
          appendLog(data.detail);
          return;
        }
        if (typeof data === "string" && data.startsWith("[Error")) hadError = true;
        appendLog(String(data));
      },
      () => {
        _clearActiveStream(handle);
        resetBtn();
        if (needsModel) {
          showToast("Install a local model to generate summaries", "warning");
          return;
        }
        if (hadError) {
          showToast("Summary generation failed - check log for details", "error");
          return;
        }
        loadVideos().then(() => {
          const video = AppState.videos.find((v) => v.id === id);
          if (video && AppState.activeVideoId === id) renderVideoDetail(video, null);
        });
        showToast("Summary regenerated");
      },
      (errMsg) => {
        _clearActiveStream(handle);
        resetBtn();
        showToast(`Summary generation failed - ${errMsg}`, "error");
      }
    );
    _setActiveStream(handle, resetBtn);
  }

  // yuu_clip/web/static/videos-runmeta.js
  var _STAGE_LABEL = {
    "Extract audio": "Extract",
    "Generate clips": "Generate Clips",
    "Import captions": "Transcribe"
  };
  function _stageLabel(name) {
    return _STAGE_LABEL[name] || name;
  }
  function _runTimingLine(run) {
    const totalHms = _msToHms(run.elapsed_ms || 0);
    const stages = run.stages || [];
    const stageStr = stages.map((st) => `${_stageLabel(st.name)} ${_msToHms((st.seconds || 0) * 1e3)}`).join(" · ");
    return `Last run: ${totalHms} total${stageStr ? ` (${stageStr})` : ""}`;
  }
  function _renderRunMetaCard(video) {
    const run = video.analyze_run;
    if (!run) return "";
    const totalHms = _msToHms(run.elapsed_ms || 0);
    const dev = run.device || {};
    const deviceBadge = dev.has_gpu ? '<span class="run-meta-badge gpu" title="Used the GPU">GPU</span>' : '<span class="run-meta-badge cpu" title="Ran on CPU">CPU</span>';
    const when = run.finished_at ? ` &middot; ${escHtml(_fmtAgo(run.finished_at))}` : "";
    return `
    <details class="detail-card run-meta-card">
      <summary class="run-meta-summary">Last analysis &middot; <strong>${totalHms}</strong> ${deviceBadge}${when}</summary>
      <div class="run-meta-body">
        ${_runSettingsRows(run.settings || {}, dev)}
        ${_runStageBars(run.stages || [])}
      </div>
    </details>`;
  }
  function _runSettingsRows(s, dev) {
    const yesNo = (v) => v ? "On" : "Off";
    const rows = [
      ["Whisper model", s.model],
      ["Track layout", s.track_layout],
      ["Captions", s.captions_source],
      ["Speaker labels", s.speaker_labels === void 0 ? null : yesNo(s.speaker_labels)],
      ["Energy mode", s.energy_mode],
      ["Scene mode", s.scene_mode],
      ["LLM scoring", s.scoring === void 0 ? null : yesNo(s.scoring)],
      ["World contexts", s.contexts && s.contexts.length ? s.contexts.join(", ") : "none"],
      ["Transcribe device", dev.transcribe],
      ["Diarization device", dev.diarization]
    ].filter(([, v]) => v !== null && v !== void 0 && v !== "");
    return `<div class="run-meta-grid">${rows.map(
      ([k, v]) => `<div class="run-meta-key">${escHtml(k)}</div><div class="run-meta-val">${escHtml(String(v))}</div>`
    ).join("")}</div>`;
  }
  function _runStageBars(stages) {
    if (!stages.length) return "";
    const maxS = Math.max(...stages.map((st) => st.seconds || 0), 1e-3);
    const bars = stages.map((st) => {
      const secs = st.seconds || 0;
      const pct = Math.max(2, Math.round(secs / maxS * 100));
      return `
      <div class="run-stage-row">
        <span class="run-stage-name">${escHtml(_stageLabel(st.name))}</span>
        <span class="run-stage-track"><span class="run-stage-fill" style="width:${pct}%"></span></span>
        <span class="run-stage-time">${_msToHms(secs * 1e3)}</span>
      </div>`;
    }).join("");
    return `<div class="run-stage-bars"><div class="run-meta-subtitle">Stage timing</div>${bars}</div>`;
  }

  // yuu_clip/web/static/sessions.js
  var COLLAPSE_KEY = "yuuclip-session-collapsed";
  var DISMISS_KEY = "yuuclip-session-dismissed";
  function _loadIdSet(key) {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  function _saveIdSet(key, set) {
    localStorage.setItem(key, JSON.stringify([...set]));
  }
  var SessionUI = {
    selectionMode: false,
    selected: /* @__PURE__ */ new Set(),
    // video ids picked while grouping
    collapsed: _loadIdSet(COLLAPSE_KEY),
    // session ids collapsed in the sidebar
    dismissed: _loadIdSet(DISMISS_KEY)
    // dismissed suggestion group keys
  };
  function _sessionById(id) {
    return (AppState.sessions || []).find((s) => s.id === id);
  }
  async function loadSessions() {
    try {
      AppState.sessions = await fetch("/api/sessions").then((r) => r.json());
    } catch {
      AppState.sessions = [];
    }
    _renderVideoList();
  }
  function isSessionCollapsed(id) {
    return SessionUI.collapsed.has(id);
  }
  function toggleSessionCollapse(id) {
    if (SessionUI.collapsed.has(id)) SessionUI.collapsed.delete(id);
    else SessionUI.collapsed.add(id);
    _saveIdSet(COLLAPSE_KEY, SessionUI.collapsed);
    _renderVideoList();
  }
  function sessionGroupHeaderLi(session, shownCount) {
    const collapsed = isSessionCollapsed(session.id);
    const label = session.name || session.title || "Session";
    const li = document.createElement("li");
    li.className = "session-header" + (AppState.activeSessionId === session.id ? " active" : "");
    li.dataset.sessionId = session.id;
    li.innerHTML = `
    <button class="session-caret" aria-label="${collapsed ? "Expand" : "Collapse"} session" aria-expanded="${collapsed ? "false" : "true"}">${collapsed ? "&#9656;" : "&#9662;"}</button>
    <div class="session-header-label" role="button" tabindex="0">
      <div class="session-name">&#127902; ${escHtml(label)}</div>
      <div class="meta">${plural(shownCount, "recording")}</div>
    </div>
    <button class="kebab-btn session-kebab" aria-label="Session actions" title="Session actions">&#8942;</button>`;
    li.querySelector(".session-caret").onclick = (e) => {
      e.stopPropagation();
      toggleSessionCollapse(session.id);
    };
    const labelEl = li.querySelector(".session-header-label");
    labelEl.onclick = (e) => {
      e.stopPropagation();
      selectSession(session.id);
    };
    labelEl.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectSession(session.id);
      }
    };
    li.querySelector(".session-kebab").onclick = (e) => {
      e.stopPropagation();
      _openSessionMenu(session.id, e.currentTarget);
    };
    return li;
  }
  function _openSessionMenu(sessionId, anchor) {
    const session = _sessionById(sessionId);
    if (!session) return;
    showKebab(anchor, [
      { label: "Open session", action: () => selectSession(sessionId) },
      { label: "Rename…", action: () => _renameSession(sessionId) },
      { label: "Add recordings…", action: () => {
        enterGroupingMode(sessionId);
      } },
      null,
      { label: "Ungroup (dissolve)", action: () => _dissolveSession(sessionId) }
    ]);
  }
  async function _renameSession(sessionId) {
    const session = _sessionById(sessionId);
    if (!session) return;
    const name = await _promptText("Rename session", "Session name", session.name || "");
    if (name === null) return;
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      showToast("Could not rename session", "error");
      return;
    }
    await loadSessions();
    if (AppState.activeSessionId === sessionId) selectSession(sessionId);
    showToast("Session renamed");
  }
  function _dissolveSession(sessionId) {
    const session = _sessionById(sessionId);
    if (!session) return;
    showConfirm(
      "Ungroup this session?",
      `The ${plural(session.member_count, "recording")} stay - they are just no longer grouped as a session. This cannot group them back automatically.`,
      "Ungroup",
      async () => {
        const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
        if (!res.ok) {
          showToast("Could not ungroup session", "error");
          return;
        }
        if (AppState.activeSessionId === sessionId) {
          AppState.activeSessionId = null;
          _showEmptySessionDetail();
        }
        await loadSessions();
        showToast("Session ungrouped");
      },
      true
    );
  }
  var _addToSessionId = null;
  function enterGroupingMode(addToSessionId = null) {
    _addToSessionId = typeof addToSessionId === "number" ? addToSessionId : null;
    SessionUI.selectionMode = true;
    SessionUI.selected = /* @__PURE__ */ new Set();
    _renderVideoList();
    _syncGroupingBar();
  }
  function exitGroupingMode() {
    SessionUI.selectionMode = false;
    SessionUI.selected = /* @__PURE__ */ new Set();
    _addToSessionId = null;
    _renderVideoList();
    _syncGroupingBar();
  }
  function toggleGroupSelect(videoId) {
    if (SessionUI.selected.has(videoId)) SessionUI.selected.delete(videoId);
    else SessionUI.selected.add(videoId);
    _renderVideoList();
    _syncGroupingBar();
  }
  function _syncGroupingBar() {
    const bar = document.getElementById("session-grouping-bar");
    if (!bar) return;
    bar.style.display = SessionUI.selectionMode ? "" : "none";
    const count = SessionUI.selected.size;
    const countEl = document.getElementById("session-grouping-count");
    if (countEl) countEl.textContent = plural(count, "selected recording");
    const btn = document.getElementById("btn-confirm-group");
    if (btn) {
      const min = _addToSessionId != null ? 1 : 2;
      btn.disabled = count < min;
      btn.textContent = _addToSessionId != null ? "Add to session" : "Group as session";
    }
    const label = document.getElementById("session-grouping-label");
    if (label) {
      label.textContent = _addToSessionId != null ? "Pick recordings to add to this session" : "Pick 2+ recordings to group as a session";
    }
  }
  async function confirmGroupSelection() {
    const ids = [...SessionUI.selected];
    if (_addToSessionId != null) {
      if (!ids.length) return;
      const res2 = await fetch(`/api/sessions/${_addToSessionId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_ids: ids })
      });
      if (!res2.ok) {
        showToast("Could not add recordings", "error");
        return;
      }
      const sid = _addToSessionId;
      exitGroupingMode();
      await loadVideos();
      showToast(`Added ${plural(ids.length, "recording")}`);
      if (AppState.activeSessionId === sid) selectSession(sid);
      return;
    }
    if (ids.length < 2) return;
    const name = await _promptText("Name this session", "Session name (optional)", "");
    if (name === null) return;
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, video_ids: ids })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.detail || "Could not create session", "error");
      return;
    }
    const session = await res.json();
    exitGroupingMode();
    await loadVideos();
    showToast(`Grouped ${plural(ids.length, "recording")} into a session`);
    selectSession(session.id);
  }
  function _groupKey(ids) {
    return [...ids].sort((a, b) => a - b).join(",");
  }
  async function suggestSessions() {
    let groups;
    try {
      groups = await fetch("/api/sessions/suggestions").then((r) => r.json());
    } catch {
      showToast("Could not load suggestions", "error");
      return;
    }
    const fresh = groups.filter((g) => !SessionUI.dismissed.has(_groupKey(g.video_ids)));
    if (!fresh.length) {
      showToast("No new session suggestions - recordings look separate.", "info");
      return;
    }
    _showSuggestionModal(fresh);
  }
  function openRecordingsActionsMenu(btn) {
    showKebab(btn, [
      { label: "Group", action: () => enterGroupingMode() },
      { label: "Suggest sessions", action: () => suggestSessions() }
    ]);
  }
  function _showSuggestionModal(groups) {
    const bg = document.createElement("div");
    bg.className = "modal-bg visible";
    const items = groups.map((g, i) => `
    <div class="session-suggestion" data-idx="${i}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;margin-bottom:2px">${plural(g.video_ids.length, "recording")} look like one session</div>
        <div class="meta" style="white-space:normal">${g.titles.map((t) => escHtml(t)).join(" · ")}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn ghost" data-act="dismiss" data-idx="${i}">Dismiss</button>
        <button class="btn primary" data-act="group" data-idx="${i}">Group</button>
      </div>
    </div>`).join("");
    bg.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="session-suggest-title" style="width:520px;max-width:95vw">
      <h3 id="session-suggest-title">Suggested sessions</h3>
      <p class="meta" style="margin:0 0 12px">Recordings recorded back-to-back may belong to one play session. Group the ones that do.</p>
      <div class="session-suggestion-list">${items}</div>
      <div class="modal-actions" style="margin-top:14px"><button class="btn" data-act="close">Done</button></div>
    </div>`;
    const close = () => {
      bg.remove();
      loadVideos();
    };
    bg.onclick = (e) => {
      if (e.target === bg) {
        close();
        return;
      }
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "close") {
        close();
        return;
      }
      const idx = parseInt(btn.dataset.idx, 10);
      const group = groups[idx];
      if (act === "dismiss") {
        SessionUI.dismissed.add(_groupKey(group.video_ids));
        _saveIdSet(DISMISS_KEY, SessionUI.dismissed);
        bg.querySelector(`.session-suggestion[data-idx="${idx}"]`)?.remove();
        if (!bg.querySelector(".session-suggestion")) close();
      } else if (act === "group") {
        _acceptSuggestion(group, () => {
          bg.querySelector(`.session-suggestion[data-idx="${idx}"]`)?.remove();
          if (!bg.querySelector(".session-suggestion")) close();
        });
      }
    };
    document.body.appendChild(bg);
  }
  async function _acceptSuggestion(group, onDone) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_ids: group.video_ids })
    });
    if (!res.ok) {
      showToast("Could not create session", "error");
      return;
    }
    showToast(`Grouped ${plural(group.video_ids.length, "recording")} into a session`);
    await loadSessions();
    onDone();
  }
  function _promptText(title, labelText, initial) {
    return new Promise((resolve) => {
      const bg = document.createElement("div");
      bg.className = "modal-bg visible";
      bg.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="session-prompt-title" style="width:400px;max-width:95vw">
        <h3 id="session-prompt-title">${escHtml(title)}</h3>
        <div class="field">
          <label for="session-prompt-input">${escHtml(labelText)}</label>
          <input type="text" id="session-prompt-input" autocomplete="off">
        </div>
        <div class="modal-actions" style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
          <button class="btn ghost" data-act="cancel">Cancel</button>
          <button class="btn primary" data-act="ok">Save</button>
        </div>
      </div>`;
      const input = bg.querySelector("#session-prompt-input");
      input.value = initial || "";
      const done = (value) => {
        bg.remove();
        resolve(value);
      };
      bg.onclick = (e) => {
        if (e.target === bg || e.target.dataset.act === "cancel") return done(null);
        if (e.target.dataset.act === "ok") return done(input.value.trim());
      };
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          done(input.value.trim());
        } else if (e.key === "Escape") {
          e.preventDefault();
          done(null);
        }
      };
      document.body.appendChild(bg);
      setTimeout(() => {
        input.focus();
        input.select();
      }, 30);
    });
  }
  async function selectSession(sessionId) {
    AppState.activeSessionId = sessionId;
    AppState.activeVideoId = null;
    document.querySelectorAll("#video-list li").forEach((l) => l.classList.remove("active"));
    document.querySelector(`#video-list li[data-session-id="${sessionId}"]`)?.classList.add("active");
    document.getElementById("player-area").innerHTML = "";
    document.getElementById("detail").innerHTML = '<div style="padding:24px;color:var(--muted)">Loading session…</div>';
    let session;
    try {
      session = await fetch(`/api/sessions/${sessionId}`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });
    } catch {
      document.getElementById("detail").innerHTML = '<div style="padding:24px;color:var(--red)">Could not load this session.</div>';
      return;
    }
    if (AppState.activeSessionId !== sessionId) return;
    _renderSessionDetail(session);
  }
  function _showEmptySessionDetail() {
    document.getElementById("player-area").innerHTML = "";
    document.getElementById("detail").innerHTML = "";
  }
  function _renderSessionDetail(session) {
    const memberIds = session.members.map((m) => m.id);
    const eb = (isEdited) => isEdited ? '<span class="edited-badge">edited</span>' : "";
    const titleText = session.title || session.name || "Session";
    document.getElementById("detail").innerHTML = `
    <div><div class="detail-type-badge video-badge">&#127902; Session</div></div>

    <div class="detail-card">
      <div class="detail-card-header">
        <h2 style="margin:0;font-size:17px;font-weight:700">${escHtml(titleText)}${eb(session.title_is_edited)}</h2>
        <button class="kebab-btn" title="Session actions" aria-label="Session actions" id="session-detail-kebab">&#8942;</button>
      </div>
      <div style="color:var(--muted);font-size:13px">
        ${plural(session.members.length, "recording")} &middot; ${_msToHms(session.total_ms)} total
      </div>
    </div>

    ${collapsibleCard(
      "session-summary",
      `<span class="detail-card-title">Session Summary${eb(session.summary_is_edited)}</span>`,
      `
      ${session.summary ? `<div class="description-long">${escHtml(session.summary)}</div>` : `<div style="color:var(--muted);font-size:12px">No summary yet - roll one up from the recordings' summaries.</div>`}`,
      { actions: `<button class="btn ghost" id="session-summarize-btn">${session.summary ? "Regenerate" : "Generate Summary"}</button>` }
    )}

    <div class="vid-actions">
      <div class="vid-actions-row">
        <button class="btn" id="session-reel-btn">Build Highlight Reel from Session</button>
      </div>
    </div>

    ${collapsibleCard(
      "session-timeline",
      `<span class="detail-card-title">Unified Timeline</span>`,
      `
      <div id="session-timeline">${_renderUnifiedTimeline(session)}</div>`
    )}`;
    document.getElementById("session-detail-kebab").onclick = (e) => _openSessionMenu(session.id, e.currentTarget);
    document.getElementById("session-summarize-btn").onclick = () => _summarizeSession(session.id);
    document.getElementById("session-reel-btn").onclick = () => window.openReelForSession(session.id, memberIds);
    _wireTimelineNavigation();
  }
  function _renderUnifiedTimeline(session) {
    if (!session.members.length) return '<div class="meta">No recordings in this session.</div>';
    const blocks = session.members.map((m) => {
      const gap = m.gap_before_ms > 0 ? `<div class="session-gap">&mdash; ${_fmtGap(m.gap_before_ms)} break &mdash;</div>` : "";
      const head = `
      <div class="session-member-head">
        <span class="session-member-offset">${_msToHms(m.offset_ms)}</span>
        <span class="session-member-title">${escHtml(m.title)}</span>
        <button class="btn ghost" style="font-size:10px;padding:1px 7px" data-open-video="${m.id}">Open</button>
      </div>`;
      let body;
      if (!m.has_timeline && !m.clips.length) {
        body = `<div class="meta" style="padding:4px 0 8px">No timeline yet - <a href="#" data-open-video="${m.id}">open to generate one</a>.</div>`;
      } else {
        const rows = _mergeTimelineRows(m).map((r) => r.html).join("");
        body = `<div class="session-timeline-rows">${rows}</div>`;
      }
      return `<div class="session-member-block">${gap}${head}${body}</div>`;
    });
    return blocks.join("");
  }
  function _mergeTimelineRows(member) {
    const rows = [];
    for (const e of member.timeline) {
      rows.push({ abs: e.abs_ms, html: `
      <div class="session-tl-row" data-goto-video="${member.id}" data-goto-ms="${e.local_ms}">
        <span class="session-tl-stamp">${escHtml(_msToHms(e.abs_ms))}</span>
        <span class="session-tl-text">${escHtml(e.text)}</span>
      </div>` });
    }
    for (const c of member.clips) {
      rows.push({ abs: c.abs_ms, html: `
      <div class="session-tl-row session-tl-clip" data-open-clip="${c.id}" data-clip-video="${member.id}">
        <span class="session-tl-stamp">${escHtml(_msToHms(c.abs_ms))}</span>
        <span class="session-tl-text">&#127916; ${escHtml(c.description || `Clip ${c.id}`)}
          <span class="meta">&#11088; ${Math.round((c.score_overall || 0) * 100)}%</span></span>
      </div>` });
    }
    rows.sort((a, b) => a.abs - b.abs);
    return rows;
  }
  function _wireTimelineNavigation() {
    const container = document.getElementById("session-timeline");
    if (!container) return;
    container.onclick = async (e) => {
      const openVideo = e.target.closest("[data-open-video]");
      if (openVideo) {
        e.preventDefault();
        selectVideo(parseInt(openVideo.dataset.openVideo, 10));
        return;
      }
      const clipRow = e.target.closest("[data-open-clip]");
      if (clipRow) {
        await selectVideo(parseInt(clipRow.dataset.clipVideo, 10));
        if (window.selectClip) window.selectClip(parseInt(clipRow.dataset.openClip, 10));
        return;
      }
      const gotoRow = e.target.closest("[data-goto-video]");
      if (gotoRow) {
        _gotoRecordingTime(parseInt(gotoRow.dataset.gotoVideo, 10), parseInt(gotoRow.dataset.gotoMs, 10));
      }
    };
  }
  async function _gotoRecordingTime(videoId, localMs) {
    await selectVideo(videoId);
    const videoEl = document.getElementById("recording-preview-video");
    if (!videoEl) return;
    const offsetS = AppState.activeVideoData?.segment_start_s || 0;
    const seekTo = localMs / 1e3 + offsetS;
    const doSeek = () => {
      try {
        videoEl.currentTime = seekTo;
      } catch {
      }
    };
    if (videoEl.readyState >= 1) doSeek();
    else videoEl.addEventListener("loadedmetadata", doSeek, { once: true });
  }
  function _summarizeSession(sessionId) {
    const btn = document.getElementById("session-summarize-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Summarizing…";
    }
    openLog();
    streamSSE(
      `/api/sessions/${sessionId}/summarize`,
      () => {
        showToast("Session summary generated");
        if (AppState.activeSessionId === sessionId) selectSession(sessionId);
        loadSessions();
      },
      [{ label: "Summarize", patterns: ["Generating"] }],
      "Session summary",
      false
    );
  }
  function _fmtGap(ms) {
    const mins = Math.round(ms / 6e4);
    if (mins < 60) return plural(mins, "min");
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}m` : plural(h, "hr");
  }
  function _wireStaticHandlers() {
    document.getElementById("btn-recordings-actions").addEventListener("click", (e) => openRecordingsActionsMenu(e.currentTarget));
    document.getElementById("btn-cancel-group").addEventListener("click", () => exitGroupingMode());
    document.getElementById("btn-confirm-group").addEventListener("click", () => confirmGroupSelection());
  }
  _wireStaticHandlers();

  // yuu_clip/web/static/clips.js
  function _applyFilters() {
    const f = AppState.clipFilters;
    let result = AppState.clips;
    if (f && f.size) {
      const statuses = ["pending", "approved", "rejected"].filter((s) => f.has(s));
      if (statuses.length) result = result.filter((c) => statuses.includes(c.status));
      if (f.has("exported") && !f.has("not-exported")) result = result.filter((c) => c.has_export);
      else if (f.has("not-exported") && !f.has("exported")) result = result.filter((c) => !c.has_export);
      if (f.has("error")) result = result.filter((c) => (c.tags || []).includes("llm_error"));
      if (f.has("flagged")) result = result.filter((c) => (c.sensitive_matches || []).length > 0);
      if (f.has("duplicate")) result = result.filter((c) => (c.tags || []).includes("possible_duplicate"));
      if (f.has("no_speech")) result = result.filter((c) => (c.tags || []).includes("no_speech"));
    }
    if (AppState.clipScoreMin > 0) result = result.filter((c) => c.score_overall >= AppState.clipScoreMin);
    if (AppState.clipSearch) {
      const q = AppState.clipSearch.toLowerCase();
      result = result.filter(
        (c) => (c.description || "").toLowerCase().includes(q) || (c.description_long || "").toLowerCase().includes(q) || (c.transcript_excerpt || "").toLowerCase().includes(q) || (c.user_tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if ((AppState.clipSortDir || "desc") === "asc") result = [...result].reverse();
    return result;
  }
  function toggleClipSortDir() {
    AppState.clipSortDir = AppState.clipSortDir === "asc" ? "desc" : "asc";
    localStorage.setItem("clips-sort-dir", AppState.clipSortDir);
    _syncSortDirBtn("clips-sort-dir", AppState.clipSortDir);
    _renderClips();
  }
  function _renderClips() {
    window._pruneClipSelection();
    const shown = _applyFilters();
    _renderClipItems(shown);
    _renderClipStatsLine(shown);
    _renderClipFilterCounts2();
  }
  function _renderClipFilterCounts2() {
    const setCount = (key, value) => {
      const badge = document.querySelector(`.clip-chip-count[data-count="${key}"]`);
      if (badge) badge.textContent = value == null ? "" : String(value);
    };
    if (!AppState.activeVideoId || !AppState.clips.length) {
      for (const key of ["all", "pending", "approved", "rejected", "error", "duplicate"]) setCount(key, null);
      return;
    }
    const counts = { pending: 0, approved: 0, rejected: 0 };
    let errorCount = 0;
    let duplicateCount = 0;
    for (const c of AppState.clips) {
      counts[c.status] = (counts[c.status] || 0) + 1;
      if ((c.tags || []).includes("llm_error")) errorCount++;
      if ((c.tags || []).includes("possible_duplicate")) duplicateCount++;
    }
    setCount("all", AppState.clips.length);
    setCount("pending", counts.pending);
    setCount("approved", counts.approved);
    setCount("rejected", counts.rejected);
    setCount("error", errorCount || null);
    setCount("duplicate", duplicateCount || null);
  }
  function _renderClipStatsLine(shown) {
    const el = document.getElementById("clip-stats-line");
    if (!el) return;
    if (!AppState.activeVideoId || !AppState.clips.length) {
      el.style.display = "none";
      return;
    }
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const c of AppState.clips) counts[c.status] = (counts[c.status] || 0) + 1;
    const totalSeconds = shown.reduce((sum, c) => {
      const len = (c.end_ms - c.start_ms) / 1e3;
      return sum + (Number.isFinite(len) ? len : 0);
    }, 0);
    el.textContent = `${shown.length} shown · ${counts.pending} unreviewed · ${counts.approved} approved · ${counts.rejected} rejected · ${fmtDuration(totalSeconds)} total`;
    el.style.display = "";
  }
  function _clearClipFilters() {
    AppState.clipFilters.clear();
    AppState.clipSearch = "";
    AppState.clipScoreMin = 0;
    _syncFilterChips();
    const searchEl = document.getElementById("clip-search-input");
    if (searchEl) searchEl.value = "";
    const scoreEl = document.getElementById("clip-score-min");
    if (scoreEl) scoreEl.value = "0";
    _renderClips();
  }
  function _syncFilterChips() {
    const f = AppState.clipFilters;
    document.querySelectorAll("[data-filter]").forEach((chip) => {
      const token = chip.dataset.filter;
      const active = token === "all" ? f.size === 0 : f.has(token);
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
    _syncMoreFilters();
  }
  var _HIDDEN_FILTER_TOKENS = ["exported", "not-exported", "error", "flagged", "duplicate", "no_speech"];
  function _syncMoreFilters() {
    const details = document.getElementById("clip-more-filters");
    if (!details) return;
    const active = _HIDDEN_FILTER_TOKENS.some((t) => AppState.clipFilters.has(t)) || AppState.clipScoreMin > 0;
    if (active) details.open = true;
    const flag = details.querySelector("[data-more-flag]");
    if (flag) flag.hidden = !active;
  }
  var _EXPORT_FILTER_TOKENS = ["exported", "not-exported"];
  function toggleClipFilter(token) {
    const f = AppState.clipFilters;
    if (token === "all") {
      f.clear();
    } else if (f.has(token)) {
      f.delete(token);
    } else {
      if (_EXPORT_FILTER_TOKENS.includes(token)) _EXPORT_FILTER_TOKENS.forEach((t) => f.delete(t));
      f.add(token);
    }
    _syncFilterChips();
    _renderClips();
  }
  function setClipKind(kind) {
    if (kind !== "clip" && kind !== "scene") return;
    if (AppState.clipKind === kind) return;
    AppState.clipKind = kind;
    AppState.activeClipId = null;
    _syncKindChips();
    if (AppState.activeVideoId) _reloadClipList(AppState.activeVideoId);
  }
  function _syncKindChips() {
    document.querySelectorAll("[data-kind]").forEach((chip) => {
      const active = chip.dataset.kind === AppState.clipKind;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }
  function setClipSearch(q) {
    AppState.clipSearch = q.trim();
    _renderClips();
  }
  function setClipScoreMin(val) {
    AppState.clipScoreMin = parseFloat(val) || 0;
    _syncMoreFilters();
    _renderClips();
  }
  function _hotwordPillsHTML(matches) {
    if (!matches || !matches.length) return "";
    if (matches.length <= 3) {
      return `<div class="tags" style="margin-top:4px">${matches.map(
        (m) => `<span class="tag" title="${escHtml(m.phrase)}${m.count > 1 ? ` (${m.count}×)` : ""}">🔥 ${escHtml(m.phrase)}</span>`
      ).join("")}</div>`;
    }
    return `<div class="tags" style="margin-top:4px"><span class="tag" title="${matches.length} hot-words matched">🔥 ${matches.length}</span></div>`;
  }
  function _handleClipListClick(e) {
    const act = e.target.closest("[data-act]");
    if (act) {
      e.preventDefault();
      if (act.dataset.act === "open-settings") window.openSettings();
      else if (act.dataset.act === "clear-clip-filters") _clearClipFilters();
      else if (act.dataset.act === "open-new-recording-panel") window.openNewRecordingPanel();
      return;
    }
    const li = e.target.closest("li[data-clip-id]");
    if (li) selectClip2(Number(li.dataset.clipId));
  }
  function _handleClipListKeydown(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const li = e.target.closest("li[data-clip-id]");
    if (!li || e.target !== li) return;
    e.preventDefault();
    selectClip2(Number(li.dataset.clipId));
  }
  function _renderClipItems(clips) {
    const list = document.getElementById("clip-list");
    list.innerHTML = "";
    list.onclick = _handleClipListClick;
    list.onkeydown = _handleClipListKeydown;
    if (!clips.length) {
      const _statusLabel = { pending: "Unreviewed", approved: "Approved", rejected: "Rejected" };
      const hasActiveFilter = AppState.clipFilters.size > 0 || AppState.clipSearch || AppState.clipScoreMin > 0;
      const isFlaggedOnly = AppState.clipFilters.size === 1 && AppState.clipFilters.has("flagged") && !AppState.clipSearch && AppState.clipScoreMin === 0;
      const filterMsg = isFlaggedOnly ? `No flagged clips - add Sensitive Terms in <a href="#" style="color:var(--accent);text-decoration:underline" data-act="open-settings">Settings</a>` : hasActiveFilter ? `No clips match the current filters - <a href="#" style="color:var(--accent);text-decoration:underline" data-act="clear-clip-filters">Clear filters</a>` : `No clips found - <a href="#" style="color:var(--accent);text-decoration:underline" data-act="open-new-recording-panel">Analyze another recording</a>`;
      list.innerHTML = `<li style="padding:10px 14px;color:var(--muted)">${filterMsg}</li>`;
      window._updateBulkToolbar();
      return;
    }
    for (const c of clips) {
      const li = document.createElement("li");
      li.className = c.id === AppState.activeClipId ? "active" : "";
      li.style.borderLeftColor = _scoreBorderColor(_sortScore(c), c.status === "rejected" || !c.scored_at);
      li.tabIndex = 0;
      li.dataset.clipId = c.id;
      li.innerHTML = `
      <div class="clip-item-row1">
        <input type="checkbox" class="clip-select-checkbox" aria-label="Select clip #${c.id}">
        <span class="clip-num" title="Clip #${c.id}">#${c.id}</span>
        <span class="clip-time">${c.start_hms} &middot; ${c.duration_hms}</span>
        ${c.has_export ? c.export_stale ? `<span class="export-pill is-stale" title="Stale - re-export to update (${escHtml((c.export_stale_reasons || []).join(", "))})">Stale</span>` : `<span class="export-pill is-exported" title="Clip has been exported">${(() => {
        const n = (c.exports || []).filter((e) => e.exists).length;
        return n > 1 ? `Exported &times;${n}` : "Exported";
      })()}</span>` : '<span class="export-pill not-exported" title="Not yet exported">Not exported</span>'}
        <span class="status-dot dot-${c.status}" title="${c.status === "approved" ? "Approved" : c.status === "rejected" ? "Rejected" : "Unreviewed"}">${c.status === "approved" ? "✓" : c.status === "rejected" ? "✕" : ""}</span>
        ${(c.tags || []).includes("llm_error") && !!(window._prereqs || {}).llm_ok ? '<span class="clip-error-badge" title="LLM scoring failed - Re-score to retry">&#9888;</span>' : ""}
        ${(c.sensitive_matches || []).length ? '<span class="clip-flag-badge" title="Contains flagged terms">&#9888;</span>' : ""}
        ${(c.tags || []).includes("possible_duplicate") ? '<span class="clip-dup-badge" title="Overlaps another clip - possible duplicate">&#8646;</span>' : ""}
      </div>
      <div class="clip-scores" aria-label="${c.scored_at ? `Scores: overall ${Math.round(c.score_overall * 100)}%, funny ${Math.round(c.score_funny * 100)}%, dramatic ${Math.round(c.score_dramatic * 100)}%, action ${Math.round(c.score_action * 100)}%, visual ${Math.round((c.score_visual || 0) * 100)}%${c.score_laugh != null ? `, laughs ${Math.round(c.score_laugh * 100)}%` : ""}` : "Not yet scored"}">
        ${c.scored_at ? `
        <span aria-hidden="true" title="Overall">${_scoreIcon(c.score_overall)} ${Math.round(c.score_overall * 100)}%</span>
        <span aria-hidden="true" title="Funny"><span>😂</span> ${Math.round(c.score_funny * 100)}%</span>
        <span aria-hidden="true" title="Dramatic"><span>🎭</span> ${Math.round(c.score_dramatic * 100)}%</span>
        <span aria-hidden="true" title="Action"><span>⚔️</span> ${Math.round(c.score_action * 100)}%</span>
        <span aria-hidden="true" title="Visual"><span>🎬</span> ${Math.round((c.score_visual || 0) * 100)}%</span>
        ${c.score_laugh != null ? `<span aria-hidden="true" title="Laughs"><span>🤣</span> ${Math.round(c.score_laugh * 100)}%</span>` : ""}
        ` : `<span style="color:var(--muted);font-size:12px" title="This clip has not been scored yet">Not yet scored</span>`}
      </div>
      ${c.description ? `<div class="clip-desc-preview" title="${escHtml(c.description)}">${escHtml(c.description)}</div>` : ""}
      ${_hotwordPillsHTML(c.hotword_matches)}`;
      const checkbox = li.querySelector(".clip-select-checkbox");
      checkbox.checked = AppState.selectedClipIds.has(c.id);
      checkbox.onclick = (e) => e.stopPropagation();
      checkbox.onchange = () => window._toggleClipSelection(c.id, checkbox.checked);
      list.appendChild(li);
    }
    window._updateBulkToolbar();
  }
  async function selectClip2(id) {
    AppState.activeClipId = id;
    document.querySelectorAll("#clip-list li[data-clip-id]").forEach((l) => l.classList.toggle("active", Number(l.dataset.clipId) === id));
    document.querySelector("#clip-list li.active")?.scrollIntoView({ block: "nearest" });
    localStorage.setItem("yuuclip-view", JSON.stringify({ videoId: AppState.activeVideoId, clipId: id }));
    document.getElementById("detail").innerHTML = '<div class="detail-empty" style="color:var(--muted)">Loading…</div>';
    try {
      const [clipRes, mediaRes] = await Promise.all([
        fetch(`/api/clips/${id}`),
        fetch(`/api/clips/${id}/media_url`)
      ]);
      if (!clipRes.ok || !mediaRes.ok) throw new Error("Failed to load clip");
      const clip = await clipRes.json();
      const media = await mediaRes.json();
      const captionsUrl = media.has_captions ? `/api/clips/${id}/captions.vtt` : null;
      AppState.activeClipData = clip;
      AppState.activeMediaFilename = media.filename;
      renderPlayer(media.url, captionsUrl, id);
      renderDetail(clip);
    } catch (err) {
      showToast(`Could not load clip: ${err.message}`, "error");
    }
  }
  async function refreshClipDetail(id) {
    if (AppState.activeClipId !== id) return;
    try {
      const clip = await fetch(`/api/clips/${id}`).then((r) => r.json());
      AppState.activeClipData = clip;
      renderDetail(clip);
    } catch (_) {
    }
  }
  function renderPlayer(url, captionsUrl, clipId) {
    const area = document.getElementById("player-area");
    const autoplay = localStorage.getItem("yuuclip-autoplay") === "true";
    const loopClip = localStorage.getItem("yuuclip-loop-clip") === "true";
    const playNext = localStorage.getItem("yuuclip-play-next") === "true";
    if (url) {
      const track = captionsUrl ? `<track kind="captions" src="${escHtml(captionsUrl)}" label="Captions" default>` : "";
      area.innerHTML = `<video controls ${autoplay ? "autoplay" : ""} ${loopClip ? "loop" : ""} src="${escHtml(url)}" aria-label="Clip preview">${track}</video>`;
    } else {
      const wrap = document.createElement("div");
      wrap.style.position = "relative";
      const vid = document.createElement("video");
      vid.controls = true;
      vid.autoplay = autoplay;
      vid.loop = loopClip;
      vid.src = `/api/clips/${clipId}/preview`;
      vid.setAttribute("aria-label", "Clip source preview");
      vid.style.cssText = "display:block;width:100%;max-height:var(--player-max-height, 42vh);object-fit:contain;background:#000";
      vid.onerror = async () => {
        const detail = await fetch(`/api/clips/${clipId}/preview`).then((r) => r.json()).then((j) => j.detail || "unavailable").catch(() => "unavailable");
        wrap.innerHTML = `<div style="padding:24px;color:var(--muted);font-size:13px">Source video unavailable: ${escHtml(detail)}</div>`;
      };
      const badge = document.createElement("span");
      badge.style.cssText = "position:absolute;top:8px;left:8px;background:rgba(0,0,0,.65);color:var(--muted);font-size:11px;padding:3px 8px;border-radius:4px;pointer-events:none";
      badge.textContent = "Source preview · not exported";
      _markPreviewQuality(badge, clipId);
      wrap.appendChild(vid);
      wrap.appendChild(badge);
      area.innerHTML = "";
      area.appendChild(wrap);
    }
    if (playNext) area.querySelector("video")?.addEventListener("ended", _playNextClip);
  }
  function _playNextClip() {
    const idx = AppState.clips.findIndex((c) => c.id === AppState.activeClipId);
    if (idx === -1 || idx >= AppState.clips.length - 1) return;
    const nextId = AppState.clips[idx + 1].id;
    selectClip2(nextId);
    document.querySelector(`#clip-list li[data-clip-id="${nextId}"]`)?.focus();
  }
  async function _markPreviewQuality(badge, clipId) {
    const videoId = AppState.activeClipData?.video_id;
    if (!videoId) return;
    try {
      const status = await fetch(`/api/videos/${videoId}/proxy-status`).then((r) => r.ok ? r.json() : null);
      if (status?.available && AppState.activeClipId === clipId) {
        badge.textContent = "Source preview · 720p · not exported";
        badge.title = "Previewed from a downscaled 720p proxy for fast, reliable playback.";
      }
    } catch (_) {
    }
  }
  function _releasePlayerMedia() {
    const area = document.getElementById("player-area");
    area.querySelectorAll("video").forEach((vid) => {
      try {
        vid.pause();
      } catch (_) {
      }
      vid.removeAttribute("src");
      vid.load();
    });
    area.innerHTML = "";
  }
  async function _releasePlayerBeforeDelete() {
    _releasePlayerMedia();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  function _fmtSizeMb(bytes) {
    if (bytes == null) return "";
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  function _exportFormatsHtml(clip) {
    if (!clip.has_export) return "";
    const rows = (clip.exports || []).filter((r) => r.exists);
    if (!rows.length) {
      return `
      <div style="margin-top:8px;margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">Exported</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${clip.exported_container ? `<span>Container: <strong style="color:var(--text)">${escHtml(clip.exported_container.toUpperCase())}</strong></span>` : ""}
        <span>Captions: <strong style="color:var(--text)">${clip.subtitle_status === "baked-in" ? "Baked in" : clip.subtitle_status === "srt-sidecar" ? "SRT sidecar" : "None"}</strong></span>
        ${clip.exported_at ? `<span>When: <strong style="color:var(--text)">${_fmtAgo(clip.exported_at)}</strong></span>` : ""}
      </div>
      ${clip.export_stale ? `<div class="transcript-stale-note" style="margin-top:8px">&#9888; Stale - re-export to update (${escHtml((clip.export_stale_reasons || []).join(", "))})</div>` : ""}`;
    }
    return `
    <div style="margin-top:8px;margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">Exported formats</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${rows.map((row) => `
        <div class="export-format-row" data-clip-id="${clip.id}" data-export-id="${row.id}" data-preset-name="${escHtml(row.preset_name)}"
             data-filename="${escHtml(row.filename)}" data-burn-subs="${row.burn_subs ? "1" : ""}"
             data-embed-subs="${row.embed_subs ? "1" : ""}" data-title-card="${row.title_card ? "1" : ""}"
             style="border:1px solid var(--border);border-radius:6px;padding:8px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline">
            <strong style="color:var(--text)">${escHtml(window.exportPresetLabel(row.preset_name))}</strong>
            <span>${escHtml(row.container.toUpperCase())}</span>
            <span>${_fmtSizeMb(row.size_bytes)}</span>
            <span>${_fmtAgo(row.created_at)}</span>
          </div>
          ${row.export_stale ? `<div class="transcript-stale-note" style="margin-top:4px">&#9888; Stale - re-export to update (${escHtml((row.export_stale_reasons || []).join(", "))})</div>` : ""}
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
            <button class="btn ghost" data-export-action="download">Download</button>
            ${AppState.canReveal ? `<button class="btn ghost" data-export-action="reveal">Show in folder</button>` : ""}
            <button class="btn ghost" data-export-action="copy-path">Copy path</button>
            <button class="btn ghost" data-export-action="regenerate">Regenerate</button>
            <button class="btn danger" data-export-action="delete">Delete</button>
          </div>
        </div>`).join("")}
    </div>
    <button class="btn-secondary" style="margin-top:8px" data-act="export-clip" data-clip-id="${clip.id}">+ Export another format</button>`;
  }
  function _descNeedsModel(clip) {
    return !!clip.tags && clip.tags.includes("desc_basic") && !clip.description_is_edited && !(window._prereqs || {}).llm_ok && (window._aiPrivacyMode || "local_only") !== "none";
  }
  function _clipDescriptionHTML(clip) {
    if (_descNeedsModel(clip)) {
      return `<div class="needs-model-cta">
      <div class="needs-model-heading">AI descriptions need a local model</div>
      <div class="needs-model-detail">Baseline scoring already ran. Set up a local language model to add a written description for each clip.</div>
      <button class="btn ghost" style="font-size:11px;padding:3px 9px" data-act="open-llm-settings">Set up a local model</button>
    </div>`;
    }
    const body = clip.description ? `"${escHtml(clip.description)}"` : `<span style="color:var(--muted);font-size:13px">No description yet - Re-score to generate</span>`;
    return `<div class="description">${body}</div>${_basicDescChipHTML(clip)}`;
  }
  function _basicDescChipHTML(clip) {
    if (!clip.tags || !clip.tags.includes("desc_basic")) return "";
    const tip = "This one-liner was built from the transcript without a language model";
    if ((window._aiPrivacyMode || "local_only") === "none") {
      return `<div class="basic-desc-chip" title="${tip}">Basic description - generative AI is turned off</div>`;
    }
    return `<div class="basic-desc-chip" title="${tip}">Basic description - a language model is set up now; re-analyze this recording to add an AI description</div>`;
  }
  function renderDetail(clip) {
    const eb = (isEdited) => isEdited ? `<span class="edited-badge">edited</span>` : "";
    const trimExportHtml = `
    <div style="font-size:12px;color:var(--muted)">
      <div style="margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">Trim</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <span>Start <strong style="color:var(--text);font-family:monospace">${_fmtOffset(clip.start_offset)}</strong></span>
        <span>End <strong style="color:var(--text);font-family:monospace">${_fmtOffset(clip.end_offset)}</strong></span>
        <span style="font-size:11px">(edit in Export)</span>
      </div>
      ${_exportFormatsHtml(clip)}
    </div>`;
    const scoringActionsHtml = `
    <div class="detail-cards-row">
      <div class="detail-card">
        <div class="detail-card-header">
          <span class="detail-card-title">Scoring</span>
          ${clip.scored_at && clip.score_overall_user != null ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" data-act="clear-score-override" data-clip-id="${clip.id}" title="Remove manual score override">Remove Override</button>` : clip.scored_at ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" data-act="open-score-override" data-clip-id="${clip.id}">Override Score</button>` : ""}
        </div>
        <div class="scores">
          ${!clip.scored_at ? `<span style="color:var(--muted);font-size:13px">Not yet scored - Re-score to generate</span>` : clip.score_overall_user != null ? scoreRowOverride("Overall", clip.score_overall, clip.score_overall_user, "overall") : scoreRow("Overall", clip.score_overall, "overall")}
          ${clip.scored_at ? scoreRow("Funny", clip.score_funny, "funny") : ""}
          ${clip.scored_at ? scoreRow("Dramatic", clip.score_dramatic, "dramatic") : ""}
          ${clip.scored_at ? scoreRow("Action", clip.score_action, "action") : ""}
          ${clip.scored_at ? scoreRow("Visual", clip.score_visual || 0, "visual") : ""}
          ${clip.scored_at && clip.score_laugh != null ? scoreRow("Laughs", clip.score_laugh, "laugh") : ""}
        </div>
      </div>
      <div class="detail-card">
        <div class="detail-card-header"><span class="detail-card-title">Actions</span></div>
        <div class="clip-actions">
          <div class="review-actions">
            <button class="btn approve ${clip.status === "approved" ? "active" : ""}" data-act="set-status" data-clip-id="${clip.id}" data-status="${clip.status === "approved" ? "pending" : "approved"}" title="Approve (press A)">Approve</button>
            <button class="btn reject  ${clip.status === "rejected" ? "active" : ""}" data-act="set-status" data-clip-id="${clip.id}" data-status="${clip.status === "rejected" ? "pending" : "rejected"}" title="Reject (press R)">Reject</button>
            <button class="btn ${clip.status === "pending" ? "active" : ""}" data-act="set-status" data-clip-id="${clip.id}" data-status="pending" title="Mark as Unreviewed (press U)">Unreviewed</button>
          </div>
          <div class="op-actions">
            <button class="btn highlight" data-act="export-clip" data-clip-id="${clip.id}">${clip.has_export ? "Re-export" : "Export"}</button>
            <button class="btn ghost" data-act="open-clip-actions-modal" data-clip-id="${clip.id}">Additional Actions</button>
          </div>
        </div>
      </div>
    </div>`;
    document.getElementById("detail").innerHTML = `
    <div>
      <div class="detail-type-badge clip-badge" style="margin-bottom:8px">&#127902; Clip #${clip.id}</div>
      <div class="clip-header">
        <span class="time">${clip.start_hms} &middot; ${clip.duration_hms}</span>
      </div>
    </div>

    ${_duplicateNoticeHTML(clip)}

    ${scoringActionsHtml}

    ${collapsibleCard(
      "clip-description",
      `<span class="detail-card-title">Description${eb(clip.description_is_edited)}</span>`,
      `
      ${_clipDescriptionHTML(clip)}

      ${clip.description_long ? `
        <hr class="detail-card-divider">
        <div class="detail-card-header">
          <span class="detail-card-title">Full Description${eb(clip.description_long_is_edited)}</span>
          <button class="kebab-btn" title="Edit or regenerate long description" aria-label="Edit or regenerate long description" data-act="open-desc-long-kebab" data-clip-id="${clip.id}">&#8942;</button>
        </div>
        <div class="description-long">${escHtml(clip.description_long)}</div>` : ""}

      <hr class="detail-card-divider">
      <div class="detail-card-header"><span class="detail-card-title">Tags</span></div>
      <div class="clip-tags" id="clip-user-tags">${_clipTagPillsHTML(clip.user_tags)}</div>
      <input list="clip-tags-datalist" id="clip-tag-input" class="tag-input"
             placeholder="Add a tag…" maxlength="40" autocomplete="off" aria-label="Add a tag">
      <datalist id="clip-tags-datalist"></datalist>
      ${_generatedTagPillsHTML(clip.tags)}`,
      {
        actions: `<div style="display:flex;gap:4px">
          ${clip.description && !_descNeedsModel(clip) ? `<button class="btn ghost" style="font-size:11px;padding:3px 9px" title="Copy description" aria-label="Copy description" data-copy="description">Copy</button>` : ""}
          <button class="kebab-btn" title="Edit or regenerate description" aria-label="Edit or regenerate description" data-act="open-desc-kebab" data-clip-id="${clip.id}">&#8942;</button>
        </div>`
      }
    )}

    ${_visionDetailHTML(clip)}
    ${_hotwordDetailHTML(clip)}
    ${_sensitiveDetailHTML(clip)}

    <div class="detail-card">
      <div class="detail-card-header">
        <span class="detail-card-title">Export</span>
        <button class="btn ghost" style="font-size:12px;padding:2px 10px" data-act="open-export-editor" data-clip-id="${clip.id}" title="Trim, frame vertical, preview captions, then export">Edit &amp; export</button>
      </div>
      ${trimExportHtml}
    </div>

    ${clip.related_clips ? collapsibleCard(
      "clip-related",
      `<span class="detail-card-title">Related Clips</span>`,
      `
        ${clip.related_clips.length ? clip.related_clips.map((r) => `
          <div style="display:flex;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--border)">
            <a href="#" style="color:var(--accent);text-decoration:none;font-size:13px;white-space:nowrap" data-act="select-related-clip" data-clip-id="${r.id}">#${r.id}</a>
            <span style="font-size:12px;color:var(--muted)">${escHtml(r.reason)}</span>
          </div>`).join("") : `<div style="font-size:12px;color:var(--muted)">No similar clips found</div>`}`,
      {
        attrs: 'id="related-clips-section"',
        headerStyle: "justify-content:flex-start;gap:8px",
        actions: `${clip.related_clips_stale ? `<span style="font-size:11px;color:var(--warning);font-style:italic">stale - re-score updated</span>` : ""}
          <span style="font-size:11px;color:var(--muted);margin-left:auto">${clip.related_clips_at ? _fmtAgo(clip.related_clips_at) : ""}</span>`
      }
    ) : ""}

    ${_transcriptCardHTML(clip)}
  `;
    if (clip.transcript_excerpt && window.loadClipTranscript) window.loadClipTranscript(clip.id);
    _renderTagDatalist();
    _loadTagSuggestions().then(_renderTagDatalist);
    const visionBtn = document.getElementById("analyze-frames-btn");
    if (visionBtn) {
      gateOnCapability(
        visionBtn,
        "vision",
        "Frame analysis needs a vision-capable model."
      );
    }
    applyJobBlockedState();
  }
  function _transcriptCardHTML(clip) {
    if (clip.transcript_excerpt) {
      return collapsibleCard(
        "clip-transcript",
        `<span class="detail-card-title">Transcript</span>`,
        `
      ${clip.transcript_stale ? `<div class="transcript-stale-note">&#9888; Captions edited since last scoring - <button class="btn ghost" style="font-size:11px;padding:2px 8px" data-act="rescore-clip" data-clip-id="${clip.id}">Re-score</button> to refresh.</div>` : ""}
      <div id="clip-transcript-view" class="transcript">${escHtml(clip.transcript_excerpt)}</div>`,
        { actions: `<button class="btn ghost" style="font-size:11px;padding:3px 9px" title="Copy transcript" aria-label="Copy transcript" data-copy="transcript">Copy</button>` }
      );
    }
    const isNoSpeech = (clip.tags || []).includes("no_speech");
    const visualPct = Math.round((clip.score_visual || 0) * 100);
    return collapsibleCard(
      "clip-transcript",
      `<span class="detail-card-title">Transcript</span>`,
      `
    <div style="color:var(--muted);font-size:13px">No dialogue in this clip</div>
    <div class="tags" style="margin-top:8px">
      ${clip.scored_at ? `<span class="tag" title="How visually active this clip is">&#127909; Visual ${visualPct}%</span>` : ""}
      ${isNoSpeech ? `<span class="tag" title="No spoken dialogue was detected in this clip">No dialogue</span>` : ""}
    </div>
    ${clip.vision_summary ? `<div class="description-long" style="margin-top:8px">${escHtml(clip.vision_summary)}</div>` : ""}`
    );
  }
  function _visionSpinnerButton() {
    return `<button class="btn ghost" id="analyze-frames-btn" style="font-size:12px;padding:3px 10px" disabled><span class="spinner" style="display:inline-block;vertical-align:middle;width:11px;height:11px"></span> Analyzing frames...</button>`;
  }
  function _visionDetailHTML(clip) {
    if (!window._visionEnabled) return "";
    const summary = clip.vision_summary;
    const btnLabel = summary ? "Re-analyze frames" : "Analyze frames";
    const body = summary ? `<div class="description-long">${escHtml(summary)}</div>
       <div style="font-size:11px;color:var(--muted);margin-top:4px">Analyzed ${_fmtAgo(clip.vision_analyzed_at)}</div>` : `<div style="color:var(--muted);font-size:13px">Sample frames from this clip and describe what's on screen - it enriches the description and gives scoring visual context.</div>`;
    const inFlight = AppState.clipJobs[clip.id] && AppState.clipJobs[clip.id].op === "analyze-frames";
    const buttonHtml = inFlight ? _visionSpinnerButton() : `<button class="btn ghost" id="analyze-frames-btn" data-job-blocked style="font-size:12px;padding:3px 10px"
                data-act="analyze-frames" data-clip-id="${clip.id}">${btnLabel}</button>`;
    return collapsibleCard(
      "clip-vision",
      `<span class="detail-card-title">What's on screen</span>`,
      `
      ${body}
      <div style="margin-top:8px">${buttonHtml}</div>`
    );
  }
  function _paintVisionInFlight(clipId) {
    if (AppState.activeClipId !== clipId || PanelNav.isOpen()) return;
    const btn = document.getElementById("analyze-frames-btn");
    if (btn) btn.outerHTML = _visionSpinnerButton();
  }
  function _finishVisionJob(clipId) {
    delete AppState.clipJobs[clipId];
    const data = AppState.activeClipData;
    if (data && AppState.activeClipId === clipId && !PanelNav.isOpen()) renderDetail(data);
  }
  function analyzeFrames(clipId) {
    if (_blockedByAnalyze("analyze frames")) return;
    AppState.clipJobs[clipId] = { op: "analyze-frames" };
    _paintVisionInFlight(clipId);
    streamSSE(
      `/api/clips/${clipId}/analyze-frames`,
      async () => {
        delete AppState.clipJobs[clipId];
        let clip = null;
        try {
          clip = await fetch(`/api/clips/${clipId}`).then((r) => r.ok ? r.json() : null);
        } catch (_) {
        }
        if (clip && AppState.activeClipId === clipId) AppState.activeClipData = clip;
        const data = clip || AppState.activeClipData;
        if (data && AppState.activeClipId === clipId && !PanelNav.isOpen()) renderDetail(data);
      },
      FRAMES_STEPS,
      "Analyzing frames...",
      // Cancellable: the job runs as a subprocess (pipeline/frame_analysis.py), so
      // killing it via the cancel endpoint drops the llama-server connection and
      // generation actually stops - the point of it, for a big model on many frames.
      true,
      // The subprocess reports its own handled failures as bracketed status lines and
      // then exits cleanly (no transport error, so streamSSE's error toast never fires).
      // Surface them as a toast, otherwise a failed analysis is only visible in the log.
      (line) => {
        if (typeof line === "string" && line.startsWith("[")) showToast(line.replace(/^\[|\]$/g, ""), "error");
      },
      false,
      { method: "POST" },
      () => _finishVisionJob(clipId)
      // onError: clear the in-flight flag so the button recovers
    );
    setJobCancel({
      url: `/api/clips/${clipId}/analyze-frames/cancel`,
      title: "Stop image analysis?",
      body: "The work so far is discarded. You can run image analysis again anytime.",
      confirm: "Stop analysis",
      logMsg: "[Image analysis cancelled]",
      onCancel: () => _finishVisionJob(clipId)
    });
  }
  var _HOTWORD_MODE_LABELS = { exact: "Exact", case_insensitive: "Ignore case", semantic: "Meaning" };
  function _hotwordDetailHTML(clip) {
    const matches = clip.hotword_matches;
    if (!matches || !matches.length) return "";
    const boost = clip.hotword_boost || {};
    const boostLine = Object.entries(boost).filter(([, v]) => v).map(([target, v]) => `${target}: ${v > 0 ? "+" : ""}${Math.round(v * 100)}%`).join(", ");
    return `
    <div class="detail-card">
      <div class="detail-card-header"><span class="detail-card-title">Hot-words</span></div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:12px">
        ${matches.map((m) => `
          <div>
            <strong>${escHtml(m.phrase)}</strong>
            <span style="color:var(--muted)"> - ${escHtml(_HOTWORD_MODE_LABELS[m.mode] || m.mode)}${m.count > 1 ? `, ${m.count}×` : ""}</span>
          </div>`).join("")}
        ${boostLine ? `<div style="color:var(--muted);font-size:11px;margin-top:2px">Boost applied: ${escHtml(boostLine)}</div>` : ""}
      </div>
    </div>`;
  }
  var _SENSITIVE_CATEGORY_LABELS = { privacy: "Privacy Term", censor: "Censor Word" };
  var _SENSITIVE_MODE_LABELS = { exact: "Exact", case_insensitive: "Ignore case", fuzzy: "Close spelling" };
  function _sensitiveDetailHTML(clip) {
    const matches = clip.sensitive_matches;
    if (!matches || !matches.length) return "";
    return `
    <div class="detail-card">
      <div class="detail-card-header"><span class="detail-card-title">Flagged terms</span></div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:12px">
        ${matches.map((m) => `
          <div>
            <span class="sensitive-category sensitive-category-${m.category}">${escHtml(_SENSITIVE_CATEGORY_LABELS[m.category] || m.category)}</span>
            <strong>${escHtml(m.matched_text)}</strong>
            <span style="color:var(--muted)"> - ${escHtml(_SENSITIVE_MODE_LABELS[m.mode] || m.mode)}${m.count > 1 ? `, ${m.count}×` : ""}</span>
          </div>`).join("")}
      </div>
    </div>`;
  }
  var _GENERATED_TAG_INFO = {
    manual: { name: "Manually created", tip: "You created this clip by hand, not automatic clip generation" },
    llm_error: { name: "Score error", tip: "LLM scoring failed for this clip - Re-score to retry" },
    llm_no_transcript: { name: "No speech to score", tip: "No transcript text in this clip's time range, so LLM scoring was skipped" },
    energy_no_tracks: { name: "No audio data", tip: "No audio track was available for energy scoring" },
    energy_no_data: { name: "No audio data", tip: "The audio track had no data in this clip's time range" },
    after_hard_split: { name: "After split", tip: "This clip starts right after a split point" },
    long_silence_before: { name: "Long pause before", tip: "A long quiet stretch comes right before this clip" },
    no_speech: { name: "No dialogue", tip: "No spoken dialogue was detected in this clip" },
    visual: { name: "Visual highlight", tip: "A silent, visually active moment found without any dialogue" },
    llm_scored: null,
    energy_scored: null,
    scenes_scored: null,
    laugh_transcript: null,
    laugh_audio: null,
    laugh_model: null,
    laugh_no_transcript: null,
    laugh_no_wav: null
  };
  function _generatedTagPillsHTML(tags) {
    const pills = (tags || []).map((token) => {
      if (_GENERATED_TAG_INFO[token] === null) return "";
      let info = _GENERATED_TAG_INFO[token];
      const silence = /^after_silence_(\d+)s$/.exec(token);
      if (silence) info = { name: `After ${silence[1]} s silence`, tip: `This clip starts after about ${silence[1]} seconds of silence` };
      if (!info) info = { name: token.replace(/_/g, " "), tip: "Detected during analysis" };
      return `<span class="tag" title="${escHtml(info.tip)}">${escHtml(info.name)}</span>`;
    }).filter(Boolean);
    return pills.length ? `<div class="tags" style="margin-top:8px">${pills.join("")}</div>` : "";
  }
  function _clipTagPillsHTML(tags) {
    if (!tags || !tags.length) return '<span class="tags-empty">No tags yet</span>';
    return tags.map(
      (t) => `<span class="user-tag">${escHtml(t)}<button class="user-tag-x" data-remove-tag="${escHtml(t)}"
       title="Remove tag" aria-label="Remove tag ${escHtml(t)}">&times;</button></span>`
    ).join("");
  }
  async function _loadTagSuggestions() {
    try {
      const data = await fetch("/api/tags").then((r) => r.json());
      AppState.allTags = Array.isArray(data.tags) ? data.tags : [];
    } catch (_) {
      AppState.allTags = AppState.allTags || [];
    }
  }
  function _renderTagDatalist() {
    const dl = document.getElementById("clip-tags-datalist");
    if (!dl) return;
    dl.innerHTML = (AppState.allTags || []).map((t) => `<option value="${escHtml(t)}">`).join("");
  }
  async function _saveClipTags(clipId, tags) {
    const res = await fetch(`/api/clips/${clipId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags })
    });
    if (!res.ok) {
      showToast("Could not save tags", "error");
      return null;
    }
    const data = await res.json();
    if (AppState.activeClipData && AppState.activeClipData.id === clipId) {
      AppState.activeClipData.user_tags = data.user_tags;
    }
    await _loadTagSuggestions();
    _renderTagDatalist();
    return data.user_tags;
  }
  function _currentClipTags() {
    return AppState.activeClipData && AppState.activeClipData.user_tags || [];
  }
  async function _addClipTag(clipId, raw) {
    const tag = (raw || "").trim();
    if (!tag) return;
    const cur = _currentClipTags();
    if (cur.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    const updated = await _saveClipTags(clipId, [...cur, tag]);
    if (updated) _rerenderClipTags(updated);
  }
  async function _removeClipTag(clipId, tag) {
    const updated = await _saveClipTags(clipId, _currentClipTags().filter((t) => t !== tag));
    if (updated) _rerenderClipTags(updated);
  }
  function _rerenderClipTags(tags) {
    const el = document.getElementById("clip-user-tags");
    if (el) el.innerHTML = _clipTagPillsHTML(tags);
  }
  function _handleDetailClick2(e) {
    const merge = e.target.closest("[data-merge-b]");
    if (merge) {
      mergeClips(Number(merge.dataset.mergeA), Number(merge.dataset.mergeB), merge.dataset.mergeDir);
      return;
    }
    const rm = e.target.closest("[data-remove-tag]");
    if (rm && AppState.activeClipId) {
      _removeClipTag(AppState.activeClipId, rm.dataset.removeTag);
      return;
    }
    const copy = e.target.closest("[data-copy]");
    if (copy && AppState.activeClipData) {
      if (copy.dataset.copy === "description") copyText(AppState.activeClipData.description, "Description");
      else if (copy.dataset.copy === "transcript") copyText(AppState.activeClipData.transcript_excerpt, "Transcript");
      return;
    }
    const formatBtn = e.target.closest("[data-export-action]");
    if (formatBtn) {
      const row = formatBtn.closest(".export-format-row");
      if (row) window._handleExportFormatAction(formatBtn.dataset.exportAction, row.dataset);
      return;
    }
    const act = e.target.closest("[data-act]");
    if (!act) return;
    const clipId = Number(act.dataset.clipId);
    switch (act.dataset.act) {
      case "export-clip":
        window.exportClip(clipId);
        break;
      case "open-llm-settings":
        window.openSettings();
        setTimeout(() => window._scrollToSettingsSection("settings-sec-llm"), 120);
        break;
      case "clear-score-override":
        clearScoreOverride(clipId);
        break;
      case "open-score-override":
        openScoreOverride(clipId);
        break;
      case "set-status":
        setStatus2(clipId, act.dataset.status);
        break;
      case "open-clip-actions-modal":
        openClipActionsModal(clipId);
        break;
      case "open-desc-long-kebab":
        openDescLongKebab(clipId, act);
        break;
      case "open-desc-kebab":
        openDescKebab(clipId, act);
        break;
      case "open-export-editor":
        window.openExportEditor(clipId);
        break;
      case "select-related-clip":
        e.preventDefault();
        selectClip2(clipId);
        break;
      case "rescore-clip":
        window.rescoreClip(clipId);
        break;
      case "analyze-frames":
        analyzeFrames(clipId);
        break;
    }
  }
  function _handleDetailKeydown(e) {
    const input = e.target.closest("#clip-tag-input");
    if (!input) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = input.value;
      input.value = "";
      if (AppState.activeClipId) _addClipTag(AppState.activeClipId, value);
    }
  }
  document.getElementById("detail").addEventListener("click", _handleDetailClick2);
  document.getElementById("detail").addEventListener("keydown", _handleDetailKeydown);
  function scoreRow(label, val, cls) {
    return `
    <span class="score-label">${label}</span>
    <div class="score-bar-wrap"><div class="score-bar bar-${cls}" style="width:${(val * 100).toFixed(1)}%"></div></div>
    <span class="score-val" style="color:var(--${cls})">${Math.round(val * 100)}%</span>`;
  }
  function scoreRowOverride(label, llmVal, userVal, cls) {
    return `
    <span class="score-label">${label} <span class="score-override-badge">override</span></span>
    <div class="score-bar-wrap">
      <div class="score-bar bar-${cls}" style="width:${(userVal * 100).toFixed(1)}%;opacity:.5"></div>
    </div>
    <span class="score-val" style="color:var(--${cls})">${Math.round(userVal * 100)}% <span style="color:var(--muted);font-size:10px">(LLM: ${Math.round(llmVal * 100)}%)</span></span>`;
  }
  function _mergeNeighbors(clip) {
    const byTime = [...AppState.clips].sort((a, b) => a.start_ms - b.start_ms);
    const idx = byTime.findIndex((c) => c.id === clip.id);
    return {
      prev: idx > 0 ? byTime[idx - 1] : null,
      next: idx >= 0 && idx < byTime.length - 1 ? byTime[idx + 1] : null
    };
  }
  function openClipActionsModal(clipId) {
    const clip = AppState.activeClipData?.id === clipId ? AppState.activeClipData : AppState.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const { prev, next } = _mergeNeighbors(clip);
    const groups = [];
    const scoringRows = [
      { label: "Re-score", description: "Re-run scoring and description generation for this clip.", action: () => window.rescoreClipChoose(clipId) }
    ];
    if (clip.score_overall_user != null) {
      scoringRows.push({ label: "Remove Override", description: "Discard the manual score and go back to the generated score.", action: () => clearScoreOverride(clipId) });
    } else {
      scoringRows.push({ label: "Override Score", description: "Manually set the overall score instead of using the generated score.", action: () => openScoreOverride(clipId) });
    }
    groups.push({ heading: "Scoring", rows: scoringRows });
    groups.push({ heading: "Transcript", rows: [
      { label: "Retranscribe", description: "Re-run transcription for just this clip's time range.", action: () => window.openRetranscribeModal(clipId) }
    ] });
    if (clip.description_long || clip.description) {
      groups.push({ heading: "Discover", rows: [
        { label: "Find Similar", description: "Search other recordings for clips with a similar description.", action: () => openSimilarClipsModal(clipId) }
      ] });
    }
    if (clip.has_export) {
      const multiFormat = (clip.exports || []).filter((e) => e.exists).length > 1;
      const fileRows = [];
      if (AppState.activeMediaFilename) {
        fileRows.push({ label: "Download Export", description: `Save ${multiFormat ? "every exported format" : "the exported file"} (and any caption sidecars) to your downloads.`, action: () => window._downloadClipExport(clipId) });
      }
      fileRows.push({ label: "Copy File Path(s)", description: `Copy the full path of ${multiFormat ? "every exported format" : "the exported file"} (and any caption sidecars) to your clipboard.`, action: () => window._copyClipExportPaths(clipId) });
      if (AppState.canReveal) {
        fileRows.push({ label: "Show in Folder", description: "Open the exports folder with this file selected.", action: () => window._revealClipExport(clipId) });
      }
      fileRows.push({ label: "Delete All Exports", description: `Delete ${multiFormat ? "every exported format" : "the exported video file"} but keep the clip record. Use the Export section to delete one format at a time.`, danger: true, action: () => deleteExport(clipId) });
      groups.push({ heading: "Files", rows: fileRows });
    }
    if (prev || next) {
      const mergeRows = [];
      const mergeDesc = (neighbor) => truncate(neighbor.description || "no description yet", 60);
      if (prev) mergeRows.push({ label: "← Merge previous", description: `Combine with clip #${prev.id} ("${mergeDesc(prev)}"), which starts at ${prev.start_hms}.`, action: () => mergeClips(clipId, prev.id, "prev") });
      if (next) mergeRows.push({ label: "Merge next →", description: `Combine with clip #${next.id} ("${mergeDesc(next)}"), which starts at ${next.start_hms}.`, action: () => mergeClips(clipId, next.id, "next") });
      groups.push({ heading: "Merge", rows: mergeRows });
    }
    groups.push({ heading: "Danger Zone", rows: [
      { label: "Delete Clip", description: "Permanently remove this clip record and its exported file.", danger: true, action: () => deleteClip(clipId) }
    ] });
    openActionsModal(`Clip #${clip.id} - Additional Actions`, groups);
  }
  async function _reloadClipList(videoId) {
    if (!videoId) return;
    AppState.clips = await fetch(_clipsListUrl(videoId)).then((r) => r.json());
    _renderClips();
  }
  function _replaceClipInList(updated) {
    const idx = AppState.clips.findIndex((c) => c.id === updated.id);
    if (idx !== -1) AppState.clips[idx] = updated;
  }
  var _scoreOverrideClipId = null;
  var _scoreOverrideOpener = null;
  function openScoreOverride(clipId) {
    _scoreOverrideOpener = document.activeElement;
    const clip = AppState.clips.find((c) => c.id === clipId);
    const current = clip?.score_overall ?? 0.5;
    _scoreOverrideClipId = clipId;
    const slider = document.getElementById("score-override-slider");
    slider.value = current;
    document.getElementById("score-override-display").textContent = Math.round(current * 100) + "%";
    document.getElementById("score-override-llm-note").textContent = `Current auto score: ${Math.round(current * 100)}%`;
    document.getElementById("score-override-modal").classList.add("visible");
    setTimeout(() => document.getElementById("score-override-slider")?.focus(), 50);
  }
  function closeScoreOverrideModal2() {
    document.getElementById("score-override-modal").classList.remove("visible");
    _scoreOverrideClipId = null;
    const opener = _scoreOverrideOpener;
    _scoreOverrideOpener = null;
    if (opener?.focus) opener.focus();
  }
  async function _scoreOverrideSave() {
    const clipId = _scoreOverrideClipId;
    const num = parseFloat(document.getElementById("score-override-slider").value);
    closeScoreOverrideModal2();
    const res = await fetch(`/api/clips/${clipId}/score-override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score_overall_user: num })
    });
    if (!res.ok) {
      showToast("Failed to set score override", "error");
      return;
    }
    const updated = await res.json();
    _replaceClipInList(updated);
    renderDetail(updated);
  }
  async function clearScoreOverride(clipId) {
    const res = await fetch(`/api/clips/${clipId}/score-override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score_overall_user: null })
    });
    if (!res.ok) {
      showToast("Failed to clear override", "error");
      return;
    }
    const updated = await res.json();
    _replaceClipInList(updated);
    renderDetail(updated);
  }
  async function mergeClips(clipAId, clipBId, direction) {
    const label = direction === "prev" ? "previous" : "next";
    showConfirm(
      "Merge clips?",
      `Merge this clip with the ${label} clip? The merged clip will span both time ranges. This cannot be undone.`,
      "Merge",
      () => _doMergeClips(clipAId, clipBId),
      true
    );
  }
  async function _doMergeClips(clipAId, clipBId) {
    const res = await fetch(`/api/clips/${clipAId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clip_b_id: clipBId })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      showToast(e.detail || "Merge failed", "error");
      return;
    }
    const updated = await res.json();
    AppState.clips = AppState.clips.filter((c) => c.id !== clipBId);
    _replaceClipInList(updated);
    AppState.activeClipId = clipAId;
    _renderClips();
    renderDetail(updated);
    showToast("Clips merged");
  }
  var _DUP_OVERLAP_THRESHOLD = 0.7;
  function _duplicatePartners(clip) {
    return AppState.clips.filter((other) => other.id !== clip.id && other.status !== "rejected").map((other) => {
      const overlapMs = Math.max(0, Math.min(clip.end_ms, other.end_ms) - Math.max(clip.start_ms, other.start_ms));
      const shorterMs = Math.min(clip.end_ms - clip.start_ms, other.end_ms - other.start_ms);
      return { clip: other, ratio: shorterMs > 0 ? overlapMs / shorterMs : 0 };
    }).filter((partner) => partner.ratio >= _DUP_OVERLAP_THRESHOLD).sort((a, b) => b.ratio - a.ratio);
  }
  function _duplicateNoticeHTML(clip) {
    if (!(clip.tags || []).includes("possible_duplicate")) return "";
    const partners = _duplicatePartners(clip);
    if (!partners.length) return "";
    const buttons = partners.map((partner) => {
      const direction = partner.clip.start_ms < clip.start_ms ? "prev" : "next";
      return `<button class="btn" style="font-size:11px;padding:3px 9px" data-merge-a="${clip.id}" data-merge-b="${partner.clip.id}" data-merge-dir="${direction}">Merge #${partner.clip.id} &middot; ${partner.clip.start_hms}</button>`;
    }).join("");
    const ids = partners.map((partner) => "#" + partner.clip.id).join(", ");
    return `<div class="clip-dup-notice" role="note">
    <div>&#8646; Possible duplicate - overlaps ${partners.length === 1 ? "clip" : "clips"} ${ids}. Merge to combine into this clip.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${buttons}</div>
  </div>`;
  }
  async function scanDuplicates(busyBtn) {
    const videoId = AppState.activeVideoId;
    if (!videoId) return;
    const btn = busyBtn || document.getElementById("btn-scan-duplicates");
    const origLabel = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking...";
    }
    try {
      const res = await fetch(`/api/videos/${videoId}/scan-duplicates`, { method: "POST" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        showToast(e.detail || "Duplicate scan failed", "error");
        return;
      }
      const body = await res.json();
      await _reloadClipList(videoId);
      if (AppState.activeClipId) refreshClipDetail(AppState.activeClipId);
      showToast(body.clips_flagged ? `Found ${body.clips_flagged} possible duplicate ${body.clips_flagged === 1 ? "clip" : "clips"}` : "No duplicate clips found");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = origLabel;
      }
    }
  }
  function openClipsActionsMenu(btn) {
    const newLabel = AppState.clipKind === "scene" ? "New scene" : "New clip";
    showKebab(btn, [
      { label: newLabel, action: () => window.openClipCreatePicker(AppState.activeVideoId, AppState.clipKind) },
      { label: "Check duplicates", action: () => scanDuplicates(btn) }
    ]);
  }
  function _parseTimingOffset(str) {
    if (!str) return 0;
    const s = str.trim();
    if (/^[+-]/.test(s)) return parseFloat(s);
    if (/^\d+:\d+(\.\d+)?$/.test(s)) {
      const [m, sec] = s.split(":");
      const absSec = parseInt(m) * 60 + parseFloat(sec);
      const clipStartSec = AppState.activeClipData?.start_ms ? AppState.activeClipData.start_ms / 1e3 : 0;
      return absSec - clipStartSec;
    }
    return parseFloat(s);
  }
  function _openClipDescKebab(clipId, btn, field) {
    const clip = AppState.activeClipData;
    const isLong = field === "description_long";
    const editTitle = isLong ? "Edit Long Description" : "Edit Description";
    const revertTitle = isLong ? "Revert Long Description" : "Revert Description";
    const current = isLong ? clip?.description_long : clip?.description;
    const isEdited = isLong ? clip?.description_long_is_edited : clip?.description_is_edited;
    const original = isLong ? clip?.description_long_original : clip?.description_original;
    const items = [
      {
        label: "Edit",
        action: () => openFieldEditModal(editTitle, current || "", async (v) => {
          await _patchClipField(
            clipId,
            "accept_edit",
            field,
            isLong ? null : v,
            isLong ? v : null
          );
          selectClip2(clipId);
        })
      }
    ];
    if (isEdited) {
      items.push({
        label: "Revert to Original",
        action: () => openDiffModal(revertTitle, [
          { label: "Description", current, proposed: original }
        ], async () => {
          await _patchClipField(clipId, "revert", field, null, null);
          selectClip2(clipId);
        }, { revertMode: true })
      });
    }
    items.push(null, { label: "Regenerate via Re-score", action: () => window.rescoreClip(clipId) });
    showKebab(btn, items);
  }
  function openDescKebab(clipId, btn) {
    _openClipDescKebab(clipId, btn, "description");
  }
  function openDescLongKebab(clipId, btn) {
    _openClipDescKebab(clipId, btn, "description_long");
  }
  async function _patchClipField(clipId, action, field, newDesc, newDescLong) {
    const res = await fetch(`/api/clips/${clipId}/fields`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, field, new_description: newDesc, new_description_long: newDescLong })
    });
    if (!res.ok) showToast("Save failed", "error");
  }
  function clearDetail() {
    const hasRecording = !!AppState.activeVideoId;
    document.getElementById("player-area").innerHTML = `
    <div class="no-export-msg"><div style="color:var(--muted)">${hasRecording ? "Select a clip to review" : "Select a recording to get started"}</div></div>`;
    document.getElementById("detail").innerHTML = hasRecording ? '<div class="detail-empty">Select a clip from the sidebar<div style="color:var(--muted);font-size:12px;margin-top:6px">Use ← → to navigate between clips</div></div>' : '<div class="detail-empty">Select a recording on the left</div>';
  }
  async function setStatus2(id, status) {
    const clip = AppState.clips.find((c) => c.id === id);
    const fromStatus = clip?.status;
    const res = await fetch(`/api/clips/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(`Failed to update status: ${formatApiError(err)}`, "error");
      return;
    }
    AppState.activeClipId = id;
    const [clipsData, clipDetail] = await Promise.all([
      fetch(_clipsListUrl(AppState.activeVideoId)).then((r) => r.json()),
      fetch(`/api/clips/${id}`).then((r) => r.json())
    ]);
    AppState.clips = clipsData;
    _renderClips();
    renderDetail(clipDetail);
    loadVideos();
    if (fromStatus && fromStatus !== status) {
      if (AppState.lastStatusChange?.timer) clearTimeout(AppState.lastStatusChange.timer);
      if (AppState.lastBulkStatusChange?.timer) clearTimeout(AppState.lastBulkStatusChange.timer);
      AppState.lastBulkStatusChange = null;
      const label = { approved: "Approved", rejected: "Rejected", pending: "Marked as Unreviewed" }[status] || status;
      AppState.lastStatusChange = { clipId: id, fromStatus };
      AppState.lastStatusChange.timer = setTimeout(() => {
        AppState.lastStatusChange = null;
      }, 5e3);
      showUndoToast(`Clip ${label}`, undoLastStatus2);
    }
  }
  function undoLastStatus2() {
    if (AppState.lastBulkStatusChange) {
      undoLastBulkStatus();
      return;
    }
    if (!AppState.lastStatusChange) return;
    const { clipId, fromStatus } = AppState.lastStatusChange;
    clearTimeout(AppState.lastStatusChange.timer);
    AppState.lastStatusChange = null;
    setStatus2(clipId, fromStatus);
  }
  function deleteExport(id) {
    showConfirm(
      "Delete exported file?",
      "The exported video file will be removed from disk. The clip record stays - you can re-export any time.",
      "Delete Export",
      async () => {
        await _releasePlayerBeforeDelete();
        const res = await fetch(`/api/clips/${id}/export`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(`Failed to delete export: ${formatApiError(err)}`, "error");
          selectClip2(id);
          return;
        }
        AppState.activeClipData.has_export = false;
        AppState.activeMediaFilename = null;
        renderPlayer(null, null, id);
        renderDetail(AppState.activeClipData);
        await _reloadClipList(AppState.activeVideoId);
        showToast("Exported file deleted");
      },
      true
    );
  }
  function deleteClip(id) {
    showConfirm(
      "Delete clip?",
      `The clip record will be removed from the database. Its exported video file (if any) will also be deleted from the exports folder.`,
      "Delete",
      () => _doDeleteClip(id),
      true
    );
  }
  async function _doDeleteClip(id) {
    const videoId = AppState.activeVideoId;
    if (AppState.activeClipId === id) await _releasePlayerBeforeDelete();
    const delRes = await fetch(`/api/clips/${id}`, { method: "DELETE" });
    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      showToast(`Failed to delete clip: ${formatApiError(err)}`, "error");
      if (AppState.activeClipId === id) selectClip2(id);
      return;
    }
    AppState.activeClipId = null;
    clearDetail();
    await _reloadClipList(videoId);
    await loadVideos();
    showToast("Clip deleted");
  }
  var _similarClipsClipId = null;
  var _similarClipsOpener = null;
  function openSimilarClipsModal(clipId) {
    _similarClipsOpener = document.activeElement;
    _similarClipsClipId = clipId;
    const currentVideo = AppState.videos.find((v) => v.id === AppState.activeVideoId);
    const otherVideos = AppState.videos.filter((v) => v.id !== AppState.activeVideoId && v.status === "done");
    const scope = document.getElementById("similar-clips-scope");
    scope.innerHTML = "";
    const addCheck = (id, label, checked) => {
      const row = document.createElement("label");
      row.style.cssText = "display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer";
      row.innerHTML = `<input type="checkbox" data-video-id="${id}" ${checked ? "checked" : ""}> ${escHtml(label)}`;
      scope.appendChild(row);
    };
    if (currentVideo) addCheck(currentVideo.id, `${currentVideo.title || currentVideo.filename} (this recording)`, true);
    for (const v of otherVideos) addCheck(v.id, v.title || v.filename, false);
    if (!currentVideo && !otherVideos.length) {
      scope.innerHTML = '<div style="font-size:12px;color:var(--muted)">No processed recordings available</div>';
    }
    document.getElementById("similar-clips-modal").classList.add("visible");
    setTimeout(() => {
      const first = document.querySelector("#similar-clips-scope input[type=checkbox]");
      (first || document.querySelector("#similar-clips-modal .btn"))?.focus();
    }, 50);
  }
  function closeSimilarClipsModal2() {
    document.getElementById("similar-clips-modal").classList.remove("visible");
    _similarClipsClipId = null;
    const opener = _similarClipsOpener;
    _similarClipsOpener = null;
    if (opener?.focus) opener.focus();
  }
  function startFindSimilar() {
    const clipId = _similarClipsClipId;
    if (!clipId) return;
    if (_blockedByAnalyze("find similar clips")) return;
    const checked = Array.from(document.querySelectorAll("#similar-clips-scope input[type=checkbox]:checked"));
    const videoIds = checked.map((el) => el.dataset.videoId).join(",");
    closeSimilarClipsModal2();
    const btn = document.getElementById("btn-find-similar");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Searching…";
    }
    _supersedeActiveStream();
    openLog();
    const resetBtn = () => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Find Similar";
      }
    };
    const qs = videoIds ? `?video_ids=${encodeURIComponent(videoIds)}` : "";
    const handle = _openSSE(
      `/api/clips/${clipId}/related-clips${qs}`,
      (msg) => {
        appendLog(String(msg));
      },
      async (msg) => {
        _clearActiveStream(handle);
        resetBtn();
        const clip = await fetch(`/api/clips/${clipId}`).then((r) => r.json()).catch(() => null);
        if (clip) {
          AppState.activeClipData = clip;
          if (!PanelNav.isOpen()) renderDetail(clip);
        }
        const count = msg.results?.length ?? 0;
        showToast(count ? `Found ${plural(count, "similar clip")}` : "No similar clips found");
      },
      (errMsg) => {
        _clearActiveStream(handle);
        resetBtn();
        showToast(`Find Similar failed - ${errMsg}`, "error");
      }
    );
    _setActiveStream(handle, resetBtn);
  }
  function _handleClipSidebarClick(e) {
    const kindBtn = e.target.closest("[data-kind]");
    if (kindBtn) {
      setClipKind(kindBtn.dataset.kind);
      return;
    }
    const filterChip = e.target.closest("[data-filter]");
    if (filterChip) {
      toggleClipFilter(filterChip.dataset.filter);
      return;
    }
    if (e.target.closest("#clips-sort-dir")) {
      toggleClipSortDir();
      return;
    }
    const kebabBtn = e.target.closest("#btn-clips-actions");
    if (kebabBtn) {
      openClipsActionsMenu(kebabBtn);
      return;
    }
  }
  document.getElementById("clips-sidebar-group").addEventListener("click", _handleClipSidebarClick);
  document.getElementById("clip-search-input").addEventListener("input", (e) => setClipSearch(e.target.value));
  document.getElementById("clip-score-min").addEventListener("change", (e) => setClipScoreMin(e.target.value));
  var _similarClipsModal = document.getElementById("similar-clips-modal");
  _similarClipsModal.addEventListener("click", (e) => {
    if (e.target === _similarClipsModal) closeSimilarClipsModal2();
  });
  document.getElementById("similar-clips-cancel-btn").addEventListener("click", () => closeSimilarClipsModal2());
  document.getElementById("btn-find-similar-go").addEventListener("click", () => startFindSimilar());
  var _scoreOverrideModal = document.getElementById("score-override-modal");
  _scoreOverrideModal.addEventListener("click", (e) => {
    if (e.target === _scoreOverrideModal) closeScoreOverrideModal2();
  });
  document.getElementById("score-override-cancel-btn").addEventListener("click", () => closeScoreOverrideModal2());
  document.getElementById("score-override-save-btn").addEventListener("click", () => _scoreOverrideSave());

  // yuu_clip/web/static/clipbulk.js
  function _pruneClipSelection() {
    const existingIds = new Set(AppState.clips.map((c) => c.id));
    for (const id of AppState.selectedClipIds) {
      if (!existingIds.has(id)) AppState.selectedClipIds.delete(id);
    }
  }
  function _visibleSelectedClips() {
    return _applyFilters().filter((c) => AppState.selectedClipIds.has(c.id));
  }
  function _toggleClipSelection(id, checked) {
    if (checked) AppState.selectedClipIds.add(id);
    else AppState.selectedClipIds.delete(id);
    _updateBulkToolbar();
  }
  function _clearClipSelection() {
    AppState.selectedClipIds.clear();
    _renderClips();
  }
  function _updateBulkToolbar() {
    const toolbar = document.getElementById("clip-bulk-toolbar");
    const count = _visibleSelectedClips().length;
    toolbar.style.display = count ? "flex" : "none";
    document.getElementById("clip-bulk-count").textContent = `${count} selected`;
  }
  async function bulkSetClipStatus(status) {
    const ids = _visibleSelectedClips().map((c) => c.id);
    if (!ids.length) return;
    const res = await fetch("/api/clips/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clip_ids: ids, status })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(`Bulk update failed: ${formatApiError(err)}`, "error");
      return;
    }
    const label = { approved: "Approved", rejected: "Rejected", pending: "Marked as Unreviewed" }[status] || status;
    const data = await res.json();
    AppState.selectedClipIds.clear();
    await _reloadClipList(AppState.activeVideoId);
    if (AppState.activeClipId && ids.includes(AppState.activeClipId)) {
      const clip = await fetch(`/api/clips/${AppState.activeClipId}`).then((r) => r.json());
      AppState.activeClipData = clip;
      renderDetail(clip);
    }
    loadVideos();
    if (AppState.lastBulkStatusChange?.timer) clearTimeout(AppState.lastBulkStatusChange.timer);
    if (AppState.lastStatusChange?.timer) clearTimeout(AppState.lastStatusChange.timer);
    AppState.lastStatusChange = null;
    AppState.lastBulkStatusChange = { previous: data.previous };
    AppState.lastBulkStatusChange.timer = setTimeout(() => {
      AppState.lastBulkStatusChange = null;
    }, 5e3);
    showUndoToast(`${label}: ${plural(ids.length, "clip")}`, undoLastBulkStatus2);
  }
  async function undoLastBulkStatus2() {
    if (!AppState.lastBulkStatusChange) return;
    const { previous } = AppState.lastBulkStatusChange;
    clearTimeout(AppState.lastBulkStatusChange.timer);
    AppState.lastBulkStatusChange = null;
    const updates = Object.entries(previous).map(([id, status]) => ({ id: Number(id), status }));
    const res = await fetch("/api/clips/bulk-status-restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(`Undo failed: ${formatApiError(err)}`, "error");
      return;
    }
    await _reloadClipList(AppState.activeVideoId);
    if (AppState.activeClipId && updates.some((u) => u.id === AppState.activeClipId)) {
      const clip = await fetch(`/api/clips/${AppState.activeClipId}`).then((r) => r.json());
      AppState.activeClipData = clip;
      renderDetail(clip);
    }
    loadVideos();
    showToast(`Undone: ${plural(updates.length, "clip")} restored`);
  }
  function bulkDeleteClips() {
    const ids = _visibleSelectedClips().map((c) => c.id);
    if (!ids.length) return;
    showConfirm(
      "Delete selected clips?",
      `${plural(ids.length, "clip record")} will be removed from the database. Any exported video files will also be deleted from the exports folder.`,
      "Delete",
      () => _doBulkDeleteClips(ids),
      true
    );
  }
  async function _doBulkDeleteClips(ids) {
    if (AppState.activeClipId && ids.includes(AppState.activeClipId)) {
      await _releasePlayerBeforeDelete();
    }
    const res = await fetch("/api/clips/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clip_ids: ids })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(`Bulk delete failed: ${formatApiError(err)}`, "error");
      if (AppState.activeClipId && ids.includes(AppState.activeClipId)) selectClip2(AppState.activeClipId);
      return;
    }
    const data = await res.json();
    AppState.selectedClipIds.clear();
    if (AppState.activeClipId && ids.includes(AppState.activeClipId)) {
      AppState.activeClipId = null;
      clearDetail();
    }
    await _reloadClipList(AppState.activeVideoId);
    await loadVideos();
    const n = data.deleted.length;
    if (data.locked.length) {
      showToast(`Deleted ${plural(n, "clip")} - ${data.locked.length} could not be deleted (file in use)`, "error");
    } else {
      showToast(`Deleted ${plural(n, "clip")}`);
    }
  }
  function bulkExportClips() {
    const clips = _visibleSelectedClips();
    if (!clips.length) return;
    const staleCount = clips.filter((c) => c.transcript_stale).length;
    if (staleCount) {
      showConfirm(
        "Export clips with outdated captions?",
        `${staleCount} of the ${clips.length} selected clips have captions edited since they were last scored, so their description/score won't reflect the latest transcript. Re-score them first, or export anyway?`,
        "Export Anyway",
        () => _doBulkExportClips(clips.map((c) => c.id)),
        true
      );
      return;
    }
    _doBulkExportClips(clips.map((c) => c.id));
  }
  function _doBulkExportClips(ids) {
    const qs = new URLSearchParams({ clip_ids: ids.join(",") });
    AppState.selectedClipIds.clear();
    openLog();
    streamSSE(
      `/api/clips/bulk-export?${qs}`,
      async () => {
        await _reloadClipList(AppState.activeVideoId);
        loadVideos();
        showToast(`Exported ${plural(ids.length, "clip")}`);
        window.SoundFx.play("export");
      },
      [{ label: "Export", patterns: ["Exporting", "OK", "Skipping"] }],
      "Bulk Exporting"
    );
  }
  function _handleBulkToolbarClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    switch (el.dataset.act) {
      case "bulk-approve":
        bulkSetClipStatus("approved");
        break;
      case "bulk-reject":
        bulkSetClipStatus("rejected");
        break;
      case "bulk-export":
        bulkExportClips();
        break;
      case "bulk-delete":
        bulkDeleteClips();
        break;
      case "bulk-clear-selection":
        _clearClipSelection();
        break;
    }
  }
  document.getElementById("clip-bulk-toolbar").addEventListener("click", _handleBulkToolbarClick);

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
  window.loadVideos = loadVideos;
  window.selectVideo = selectVideo;
  window.renderVideoDetail = renderVideoDetail;
  window.deleteVideo = deleteVideo;
  window.onClipsSortChange = onClipsSortChange;
  window._clipsSortParam = _clipsSortParam;
  window._clipsListUrl = _clipsListUrl;
  window._reanalyzeParams = _reanalyzeParams;
  window._needsModelCtaHTML = _needsModelCtaHTML;
  window._updateDemoButton = _updateDemoButton;
  window._updateStartIngestButton = _updateStartIngestButton;
  window._analysisLivePanelHTML = _analysisLivePanelHTML;
  window._syncAnalysisLivePanel = _syncAnalysisLivePanel2;
  window._applyVideoFilters = _applyVideoFilters;
  window._renderVideoList = _renderVideoList;
  window.setVideoSearch = setVideoSearch;
  window.setVideoSort = setVideoSort;
  window.toggleVideoSortDir = toggleVideoSortDir;
  window.toggleVideoFilter = toggleVideoFilter;
  window.openVideoActionsModal = openVideoActionsModal;
  window.generateTimeline = generateTimeline;
  window.closeTimelineIntervalModal = closeTimelineIntervalModal2;
  window._renderTimelineHTML = _renderTimelineHTML;
  window._timelineEmptyNoteHTML = _timelineEmptyNoteHTML;
  window.summarizeVideo = summarizeVideo;
  window.regenSummaryAuto = regenSummaryAuto;
  window._renderRunMetaCard = _renderRunMetaCard;
  window._runTimingLine = _runTimingLine;
  window.SessionUI = SessionUI;
  window.isSessionCollapsed = isSessionCollapsed;
  window.sessionGroupHeaderLi = sessionGroupHeaderLi;
  window.toggleGroupSelect = toggleGroupSelect;
  window.selectClip = selectClip2;
  window.setStatus = setStatus2;
  window.undoLastStatus = undoLastStatus2;
  window.renderDetail = renderDetail;
  window.renderPlayer = renderPlayer;
  window.clearDetail = clearDetail;
  window.refreshClipDetail = refreshClipDetail;
  window._releasePlayerBeforeDelete = _releasePlayerBeforeDelete;
  window.analyzeFrames = analyzeFrames;
  window.toggleClipFilter = toggleClipFilter;
  window._syncFilterChips = _syncFilterChips;
  window._applyFilters = _applyFilters;
  window._renderClips = _renderClips;
  window._parseTimingOffset = _parseTimingOffset;
  window._reloadClipList = _reloadClipList;
  window._renderClipFilterCounts = _renderClipFilterCounts2;
  window.openScoreOverride = openScoreOverride;
  window.closeScoreOverrideModal = closeScoreOverrideModal2;
  window.closeSimilarClipsModal = closeSimilarClipsModal2;
  window.openClipActionsModal = openClipActionsModal;
  window._pruneClipSelection = _pruneClipSelection;
  window._updateBulkToolbar = _updateBulkToolbar;
  window._toggleClipSelection = _toggleClipSelection;
  window.undoLastBulkStatus = undoLastBulkStatus2;
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3RhdGUuanMiLCAiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgImpvYnMuanMiLCAicHJldmlldy5qcyIsICJ1dGlscy5qcyIsICJ1aS5qcyIsICJoZWxwbW9kYWxzLmpzIiwgInNob3J0Y3V0cy5qcyIsICJtb2RlbGNhdGFsb2cuanMiLCAidmlkZW9zLmpzIiwgInZpZGVvcy10aW1lbGluZS5qcyIsICJ2aWRlb3Mtc3VtbWFyeS5qcyIsICJ2aWRlb3MtcnVubWV0YS5qcyIsICJzZXNzaW9ucy5qcyIsICJjbGlwcy5qcyIsICJjbGlwYnVsay5qcyIsICJtYWluLmVzbS5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgYXBwbGljYXRpb24gc3RhdGU6IHRoZSBzaW5nbGUgQXBwU3RhdGUgb2JqZWN0IGV2ZXJ5IGZlYXR1cmUgbW9kdWxlIHJlYWRzL3dyaXRlcy5cbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IGNvdmVyZWQgaW5kaXJlY3RseSBieSB0aGUgdGVzdF91aV8qLnB5IHN1aXRlc1xuLy8g4pSA4pSAIHNoYXJlZCBhcHBsaWNhdGlvbiBzdGF0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIE11dGFibGUgc3RhdGUgc2hhcmVkIGFjcm9zcyBmZWF0dXJlIG1vZHVsZXMuIENlbnRyYWxpemVkIGluIG9uZSBleHBsaWNpdCBvYmplY3Rcbi8vIHNvIGNyb3NzLW1vZHVsZSByZWFkcy93cml0ZXMgYXJlIGdyZXBwYWJsZSBhbmQgb2J2aW91c2x5IHNoYXJlZCwgcmF0aGVyIHRoYW5cbi8vIHNjYXR0ZXJlZCBiYXJlIGdsb2JhbHMgdGhhdCBsb29rIGxpa2UgbW9kdWxlIGxvY2FscyBhdCB0aGUgY2FsbCBzaXRlLlxuZXhwb3J0IGNvbnN0IEFwcFN0YXRlID0ge1xuICBhY3RpdmVWaWRlb0lkOiAgICAgICBudWxsLFxuICBhY3RpdmVDbGlwSWQ6ICAgICAgICBudWxsLFxuICB2aWRlb3M6ICAgICAgICAgICAgICBbXSxcbiAgc2Vzc2lvbnM6ICAgICAgICAgICAgW10sICAgICAgIC8vIGdyb3VwZWQgcGxheSBzZXNzaW9ucyAoUmVjb3JkaW5nU2Vzc2lvbiByb3dzKVxuICBhY3RpdmVTZXNzaW9uSWQ6ICAgICBudWxsLCAgICAgLy8gc2Vzc2lvbiB3aG9zZSBkZXRhaWwgdmlldyBpcyBvcGVuLCBvciBudWxsXG4gIGNsaXBzOiAgICAgICAgICAgICAgIFtdLFxuICBhbmFseXplUHJvZmlsZXM6ICAgICBbXSxcbiAgY29udGV4dHM6ICAgICAgICAgICAgW10sXG4gIGhvdFdvcmRzOiAgICAgICAgICAgIFtdLFxuICBfaG90V29yZHNMb2FkZWQ6ICAgICBmYWxzZSxcbiAgc2Vuc2l0aXZlVGVybXM6ICAgICAgW10sXG4gIF9zZW5zaXRpdmVUZXJtc0xvYWRlZDogZmFsc2UsXG4gIGFuYWx5emVGaWxlbmFtZTogICAgIG51bGwsXG4gIGVkaXRpbmdDb250ZXh0SWQ6ICAgIG51bGwsXG4gIGNsaXBGaWx0ZXJzOiAgICAgICAgIG5ldyBTZXQoKSwgIC8vIGFjdGl2ZSBmaWx0ZXIgdG9rZW5zOyBlbXB0eSA9IHNob3cgYWxsXG4gIGNsaXBLaW5kOiAgICAgICAgICAgICdjbGlwJywgICAgICAvLyBjYW5kaWRhdGUgdHlwZSBzaG93bjogJ2NsaXAnIHwgJ3NjZW5lJyAoc2VydmVyLXNpZGUgZmlsdGVyKVxuICBjbGlwU2VhcmNoOiAgICAgICAgICAnJyxcbiAgY2xpcFNjb3JlTWluOiAgICAgICAgMCxcbiAgdmlkZW9TZWFyY2g6ICAgICAgICAgJycsXG4gIHZpZGVvU29ydDogICAgICAgICAgICdyZWNlbnQnLFxuICB2aWRlb1NvcnREaXI6ICAgICAgICAnZGVzYycsICAvLyAnZGVzYycgPSB0aGUgc29ydCBvcHRpb24ncyBuYXR1cmFsIG9yZGVyOyAnYXNjJyByZXZlcnNlcyBpdFxuICBjbGlwU29ydERpcjogICAgICAgICAnZGVzYycsXG4gIHZpZGVvRmlsdGVyczogICAgICAgIG5ldyBTZXQoKSwgIC8vIGFjdGl2ZSB2aWRlbyBmaWx0ZXIgdG9rZW5zOyBlbXB0eSA9IHNob3cgYWxsXG4gIHNlbGVjdGVkQ2xpcElkczogICAgIG5ldyBTZXQoKSxcbiAgbGFzdFN0YXR1c0NoYW5nZTogICAgbnVsbCwgLy8ge2NsaXBJZCwgZnJvbVN0YXR1cywgdGltZXJ9XG4gIGxhc3RCdWxrU3RhdHVzQ2hhbmdlOiBudWxsLCAvLyB7cHJldmlvdXM6IHtjbGlwSWQ6IGZyb21TdGF0dXN9LCB0aW1lcn1cbiAgY29uZmlybUNhbGxiYWNrOiAgICAgbnVsbCxcbiAgYWN0aXZlQ2xpcERhdGE6ICAgICAgbnVsbCxcbiAgY2xpcEpvYnM6ICAgICAgICAgICAge30sICAgLy8gY2xpcElkIC0+IHtvcH0gZm9yIGEgcGVyLWNsaXAgYXN5bmMgam9iIGluIGZsaWdodCAoYW5hbHl6ZS1mcmFtZXMpLCBzbyBpdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW5kaWNhdG9yIHN1cnZpdmVzIGEgcmVuZGVyRGV0YWlsIHJlYnVpbGQgLyBjbGlwIHN3aXRjaCAoc3RhdGUsIG5vdCBhIERPTSBub2RlKVxuICBhY3RpdmVNZWRpYUZpbGVuYW1lOiBudWxsLFxuICBhY3RpdmVWaWRlb0RhdGE6ICAgICBudWxsLFxuICBib290UmVzdG9yZURvbmU6ICAgICBmYWxzZSxcbiAgZXhwb3J0RGlyOiAgICAgICAgICAgbnVsbCxcbiAgcmVlbHNEaXI6ICAgICAgICAgICAgbnVsbCxcbiAgY2FuUmV2ZWFsOiAgICAgICAgICAgZmFsc2UsXG59O1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUHVyZSBmb3JtYXR0ZXJzIGFuZCBzY29yZSBoZWxwZXJzOiBubyBET00sIG5vIGZldGNoLiBIVE1MLWVzY2FwZSwgQVBJLWVycm9yIHRleHQsXHJcbi8vICAgZHVyYXRpb24vZGF0ZS9vZmZzZXQgZm9ybWF0dGluZywgdmlkZW8tc3RhdHVzIGxhYmVscywgYW5kIHRoZSBzY29yZSBjb2xvci9pY29uIGVuY29kaW5nLlxyXG4vLyAgIEFQSTogbm9uZSAoY2xpZW50LW9ubHkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5XHJcbi8vIOKUgOKUgCBzY29yZSB1dGlscyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZnVuY3Rpb24gX3Njb3JlSWNvbihzY29yZSkge1xyXG4gIGNvbnN0IGNvbG9yID0gc2NvcmUgPj0gMC43ID8gJ3ZhcigtLWdyZWVuKScgOiBzY29yZSA+PSAwLjQgPyAndmFyKC0td2FybmluZyknIDogJ3ZhcigtLW11dGVkKSc7XHJcbiAgcmV0dXJuIGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Y29sb3J9O2ZvbnQtc2l6ZToxMHB4XCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+JiMxMTA4ODs8L3NwYW4+YDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2xlcnBDb2xvcihjMSwgYzIsIHQpIHtcclxuICBjb25zdCBoID0gYyA9PiBbcGFyc2VJbnQoYy5zbGljZSgxLDMpLDE2KSwgcGFyc2VJbnQoYy5zbGljZSgzLDUpLDE2KSwgcGFyc2VJbnQoYy5zbGljZSg1LDcpLDE2KV07XHJcbiAgY29uc3QgW3IxLGcxLGIxXSA9IGgoYzEpLCBbcjIsZzIsYjJdID0gaChjMik7XHJcbiAgcmV0dXJuIGByZ2IoJHtNYXRoLnJvdW5kKHIxKyhyMi1yMSkqdCl9LCR7TWF0aC5yb3VuZChnMSsoZzItZzEpKnQpfSwke01hdGgucm91bmQoYjErKGIyLWIxKSp0KX0pYDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3Njb3JlQm9yZGVyQ29sb3Ioc2NvcmUsIGlzUmVqZWN0ZWQpIHtcclxuICBpZiAoaXNSZWplY3RlZCkgcmV0dXJuICd2YXIoLS1tdXRlZCknO1xyXG4gIGNvbnN0IHN0b3BzID0gW1swLCcjNmI2YjgwJ10sWzAuMywnIzRmYzNmNyddLFswLjUsJyM0Y2FmN2QnXSxbMC43LCcjZjBjMDYwJ10sWzEuMCwnI2Y3YTg1YSddXTtcclxuICBmb3IgKGxldCBpID0gMTsgaSA8IHN0b3BzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBpZiAoc2NvcmUgPD0gc3RvcHNbaV1bMF0pIHtcclxuICAgICAgY29uc3QgdCA9IChzY29yZSAtIHN0b3BzW2ktMV1bMF0pIC8gKHN0b3BzW2ldWzBdIC0gc3RvcHNbaS0xXVswXSk7XHJcbiAgICAgIHJldHVybiBfbGVycENvbG9yKHN0b3BzW2ktMV1bMV0sIHN0b3BzW2ldWzFdLCB0KTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHN0b3BzW3N0b3BzLmxlbmd0aC0xXVsxXTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3NvcnRTY29yZShjbGlwKSB7XHJcbiAgY29uc3Qgc29ydCA9IHdpbmRvdy5fY2xpcHNTb3J0UGFyYW0oKTtcclxuICBpZiAoc29ydCA9PT0gJ2Z1bm55JykgICAgcmV0dXJuIGNsaXAuc2NvcmVfZnVubnk7XHJcbiAgaWYgKHNvcnQgPT09ICdkcmFtYXRpYycpIHJldHVybiBjbGlwLnNjb3JlX2RyYW1hdGljO1xyXG4gIGlmIChzb3J0ID09PSAnYWN0aW9uJykgICByZXR1cm4gY2xpcC5zY29yZV9hY3Rpb247XHJcbiAgaWYgKHNvcnQgPT09ICd2aXN1YWwnKSAgIHJldHVybiBjbGlwLnNjb3JlX3Zpc3VhbDtcclxuICBpZiAoc29ydCA9PT0gJ2xhdWdoJykgICAgcmV0dXJuIGNsaXAuc2NvcmVfbGF1Z2g7XHJcbiAgcmV0dXJuIGNsaXAuc2NvcmVfb3ZlcmFsbDtcclxufVxyXG5cclxuLy8g4pSA4pSAIGZvcm1hdCB1dGlscyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuY29uc3QgX1ZJREVPX1NUQVRVU19ESVNQTEFZID0ge1xyXG4gIHBlbmRpbmc6ICdOb3QgYW5hbHl6ZWQnLCBwcm9iZWQ6ICdJbnNwZWN0ZWQnLCBsYWJlbGVkOiAnVHJhY2tzIGFzc2lnbmVkJyxcclxuICBleHRyYWN0aW5nOiAnRXh0cmFjdGluZycsIHRyYW5zY3JpYmluZzogJ1RyYW5zY3JpYmluZycsIHRyYW5zY3JpYmVkOiAnVHJhbnNjcmliZWQnLFxyXG4gIHNlZ21lbnRlZDogJ0NsaXBzIGdlbmVyYXRlZCcsIGRvbmU6ICdBbmFseXplZCcsIGZhaWxlZDogJ0FuYWx5c2lzIGludGVycnVwdGVkJyxcclxufTtcclxuZnVuY3Rpb24gX2ZtdFZpZGVvU3RhdHVzKHMpIHsgcmV0dXJuIF9WSURFT19TVEFUVVNfRElTUExBWVtzXSB8fCBzOyB9XHJcblxyXG5mdW5jdGlvbiBfbXNUb0htcyhtcykge1xyXG4gIGNvbnN0IHMgPSBNYXRoLmZsb29yKG1zIC8gMTAwMCk7XHJcbiAgaWYgKHMgPCA2MCkgcmV0dXJuIGAke3N9c2A7XHJcbiAgY29uc3QgbSA9IE1hdGguZmxvb3IocyAvIDYwKSwgc2VjID0gcyAlIDYwO1xyXG4gIGlmIChtIDwgNjApIHJldHVybiBgJHttfW0gJHtTdHJpbmcoc2VjKS5wYWRTdGFydCgyLCAnMCcpfXNgO1xyXG4gIGNvbnN0IGggPSBNYXRoLmZsb29yKG0gLyA2MCksIG1pbiA9IG0gJSA2MDtcclxuICByZXR1cm4gYCR7aH1oICR7U3RyaW5nKG1pbikucGFkU3RhcnQoMiwgJzAnKX1tYDtcclxufVxyXG5cclxuZnVuY3Rpb24gcGx1cmFsKGNvdW50LCBzaW5ndWxhciwgcGx1cmFsRm9ybSkge1xyXG4gIHJldHVybiBgJHtjb3VudH0gJHtjb3VudCA9PT0gMSA/IHNpbmd1bGFyIDogKHBsdXJhbEZvcm0gfHwgc2luZ3VsYXIgKyAncycpfWA7XHJcbn1cclxuXHJcbi8vIFN0YW5kYXJkIGd1YXJkIGZvciBhbnkgY29tcHV0ZWQgbnVtYmVyIHNob3duIHRvIHRoZSB1c2VyOiByZXR1cm5zICp2YWx1ZSpcclxuLy8gb25seSB3aGVuIGl0IGlzIGEgZmluaXRlIG51bWJlciwgb3RoZXJ3aXNlIGEgcGxhaW4tRW5nbGlzaCAqZmFsbGJhY2sqLiBOYU5cclxuLy8gb3IgSW5maW5pdHkgLSB1c3VhbGx5IGZyb20gYXJpdGhtZXRpYyBvbiBtaXNzaW5nL3BhcnRpYWwgZGF0YSAtIG11c3QgbmV2ZXJcclxuLy8gcmVhY2ggdGhlIFVJIGFzIHRoZSBsaXRlcmFsIFwiTmFOXCIvXCJJbmZpbml0eVwiLiBVc2UgdGhpcyAob3IgZm10RHVyYXRpb24pIGF0XHJcbi8vIGV2ZXJ5IGRpc3BsYXkgc2l0ZSB0aGF0IGZvcm1hdHMgYSBkZXJpdmVkIG51bWJlci5cclxuZnVuY3Rpb24gZmluaXRlT3IodmFsdWUsIGZhbGxiYWNrID0gJ04vQScpIHtcclxuICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKHZhbHVlKSA/IHZhbHVlIDogZmFsbGJhY2s7XHJcbn1cclxuXHJcbi8vIEh1bWFuLXJlYWRhYmxlIGNsaXAvc2VnbWVudCBsZW5ndGguIFJldHVybnMgKmZhbGxiYWNrKiBmb3IgYSBub24tZmluaXRlXHJcbi8vIGlucHV0IChlLmcuIGEgY2xpcCBtaXNzaW5nIGl0cyBzdGFydC9lbmQgdGltZXMpIHJhdGhlciB0aGFuIFwiTmFOIHNlY1wiLlxyXG5mdW5jdGlvbiBmbXREdXJhdGlvbihzZWNvbmRzLCBmYWxsYmFjayA9ICd1bmtub3duJykge1xyXG4gIGlmICghTnVtYmVyLmlzRmluaXRlKHNlY29uZHMpKSByZXR1cm4gZmFsbGJhY2s7XHJcbiAgcmV0dXJuIHNlY29uZHMgPj0gNjAgPyBgJHtNYXRoLnJvdW5kKHNlY29uZHMgLyA2MCl9IG1pbmAgOiBgJHtNYXRoLnJvdW5kKHNlY29uZHMpfSBzZWNgO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0cnVuY2F0ZSh0ZXh0LCBtYXgpIHtcclxuICByZXR1cm4gdGV4dC5sZW5ndGggPiBtYXggPyB0ZXh0LnNsaWNlKDAsIG1heCAtIDEpICsgJ+KApicgOiB0ZXh0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBlc2NIdG1sKHMpIHtcclxuICByZXR1cm4gU3RyaW5nKHMpLnJlcGxhY2UoLyYvZywnJmFtcDsnKS5yZXBsYWNlKC88L2csJyZsdDsnKS5yZXBsYWNlKC8+L2csJyZndDsnKS5yZXBsYWNlKC9cIi9nLCcmcXVvdDsnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZm9ybWF0QXBpRXJyb3IoZXJyKSB7XHJcbiAgaWYgKCFlcnIpIHJldHVybiAnVW5rbm93biBlcnJvcic7XHJcbiAgaWYgKHR5cGVvZiBlcnIuZGV0YWlsID09PSAnc3RyaW5nJykgcmV0dXJuIGVyci5kZXRhaWw7XHJcbiAgaWYgKEFycmF5LmlzQXJyYXkoZXJyLmRldGFpbCkpIHJldHVybiBlcnIuZGV0YWlsLm1hcChlID0+IGUubXNnIHx8IEpTT04uc3RyaW5naWZ5KGUpKS5qb2luKCc7ICcpO1xyXG4gIGlmIChlcnIubWVzc2FnZSkgcmV0dXJuIGVyci5tZXNzYWdlO1xyXG4gIGNvbnN0IHN0cmluZ2lmaWVkID0gSlNPTi5zdHJpbmdpZnkoZXJyKTtcclxuICByZXR1cm4gKCFzdHJpbmdpZmllZCB8fCBzdHJpbmdpZmllZCA9PT0gJ3t9JykgPyAnVW5rbm93biBlcnJvciAobm8gZGV0YWlscyBmcm9tIHNlcnZlciknIDogc3RyaW5naWZpZWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0cmlwUmljaE1hcmt1cCh0ZXh0KSB7XHJcbiAgcmV0dXJuIHRleHRcclxuICAgIC5yZXBsYWNlKC9cXHgxYlxcW1swLTk7XSpbYS16QS1aXS9nLCAnJykgIC8vIEFOU0kgZXNjYXBlIGNvZGVzXHJcbiAgICAucmVwbGFjZSgvXFxbXFwvP1xcdytcXF0vZywgJycpOyAgICAgICAgICAgICAvLyBSaWNoIG1hcmt1cCB0YWdzXHJcbn1cclxuXHJcbi8vIFNlcnZlciB0aW1lc3RhbXBzIGFyZSBuYWl2ZSBVVEMgKFNRTGl0ZSBEYXRlVGltZSDihpIgaXNvZm9ybWF0KCkgd2l0aCBubyB6b25lKS5cclxuLy8gVHJlYXQgYSB6b25lLWxlc3Mgc3RyaW5nIGFzIFVUQyBzbyBpdCBpc24ndCBwYXJzZWQgYXMgdGhlIHZpZXdlcidzIGxvY2FsIHRpbWUuXHJcbmZ1bmN0aW9uIF9wYXJzZVNlcnZlckRhdGUoaXNvKSB7XHJcbiAgY29uc3QgaGFzWm9uZSA9IC9belpdJHxbKy1dXFxkezJ9Oj9cXGR7Mn0kLy50ZXN0KGlzbyk7XHJcbiAgcmV0dXJuIG5ldyBEYXRlKGhhc1pvbmUgPyBpc28gOiBpc28gKyAnWicpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10RGF0ZShpc28pIHtcclxuICBpZiAoIWlzbykgcmV0dXJuICduZXZlcic7XHJcbiAgY29uc3QgZCA9IF9wYXJzZVNlcnZlckRhdGUoaXNvKTtcclxuICByZXR1cm4gZC50b0xvY2FsZURhdGVTdHJpbmcodW5kZWZpbmVkLCB7bW9udGg6J3Nob3J0JywgZGF5OidudW1lcmljJ30pICsgJyBhdCAnICtcclxuICAgIGQudG9Mb2NhbGVUaW1lU3RyaW5nKHVuZGVmaW5lZCwge2hvdXI6J251bWVyaWMnLCBtaW51dGU6JzItZGlnaXQnfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRBZ28oaXNvU3RyaW5nKSB7XHJcbiAgY29uc3QgZGlmZlMgPSAoRGF0ZS5ub3coKSAtIF9wYXJzZVNlcnZlckRhdGUoaXNvU3RyaW5nKS5nZXRUaW1lKCkpIC8gMTAwMDtcclxuICBpZiAoZGlmZlMgPCA2MCkgICAgcmV0dXJuICdqdXN0IG5vdyc7XHJcbiAgaWYgKGRpZmZTIDwgMzYwMCkgIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gNjApfW0gYWdvYDtcclxuICBpZiAoZGlmZlMgPCA4NjQwMCkgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyAzNjAwKX1oIGFnb2A7XHJcbiAgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyA4NjQwMCl9ZCBhZ29gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10T2Zmc2V0KHYpIHtcclxuICBpZiAoIXYpIHJldHVybiAnKzAuMCc7XHJcbiAgcmV0dXJuICh2ID49IDAgPyAnKycgOiAnJykgKyB2LnRvRml4ZWQoMSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRFbGFwc2VkKG1zKSB7XHJcbiAgY29uc3QgcyA9IE1hdGguZmxvb3IobXMgLyAxMDAwKTtcclxuICBjb25zdCBtID0gTWF0aC5mbG9vcihzIC8gNjApO1xyXG4gIHJldHVybiBtID4gMCA/IGAke219bSAke3MgJSA2MH1zYCA6IGAke3N9c2A7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCB0aW1lbGluZSBpbnRlcnZhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuY29uc3QgX1RJTUVMSU5FX01JTl9JTlRFUlZBTF9TID0gMTA7XHJcblxyXG4vLyBDb252ZXJ0IGEgdGltZWxpbmUgaW50ZXJ2YWwgKHZhbHVlLCB1bml0KSBpbnRvIHNlY29uZHM7IG51bGwgaWYgbm9uLW51bWVyaWMgb3JcclxuLy8gYmVsb3cgdGhlIG1pbmltdW0uIFNoYXJlZCBieSB0aGUgU2V0dGluZ3Mgc2F2ZSBwYXRoIGFuZCB0aGUgcGVyLXZpZGVvIHRpbWVsaW5lXHJcbi8vIGdlbmVyYXRvciBzbyB0aGVpciB2YWxpZGF0aW9uIGNhbid0IGRyaWZ0IGFwYXJ0LlxyXG5mdW5jdGlvbiBfcGFyc2VJbnRlcnZhbFModmFsdWUsIHVuaXQpIHtcclxuICBjb25zdCBuID0gcGFyc2VJbnQodmFsdWUsIDEwKTtcclxuICBpZiAoaXNOYU4obikpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IHNlY29uZHMgPSB1bml0ID09PSAnbWludXRlcycgPyBuICogNjAgOiBuO1xyXG4gIHJldHVybiBzZWNvbmRzID49IF9USU1FTElORV9NSU5fSU5URVJWQUxfUyA/IHNlY29uZHMgOiBudWxsO1xyXG59XHJcblxyXG5leHBvcnQge1xyXG4gIF9zY29yZUljb24sIF9sZXJwQ29sb3IsIF9zY29yZUJvcmRlckNvbG9yLCBfc29ydFNjb3JlLCBfZm10VmlkZW9TdGF0dXMsIF9tc1RvSG1zLFxyXG4gIHBsdXJhbCwgZmluaXRlT3IsIGZtdER1cmF0aW9uLCB0cnVuY2F0ZSwgZXNjSHRtbCwgZm9ybWF0QXBpRXJyb3IsIHN0cmlwUmljaE1hcmt1cCxcclxuICBfcGFyc2VTZXJ2ZXJEYXRlLCBfZm10RGF0ZSwgX2ZtdEFnbywgX2ZtdE9mZnNldCwgX2ZtdEVsYXBzZWQsIF9wYXJzZUludGVydmFsUyxcclxufTtcclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gU2hhcmVkIGNvbG91ciBwaWNrZXIuIFByb2dyZXNzaXZlLWVuaGFuY2VzIGFuIDxpbnB1dD4gdGhhdCBob2xkc1xyXG4vLyAgIGEgaGV4IHZhbHVlOiB0aGUgb3JpZ2luYWwgaW5wdXQgYmVjb21lcyBhIGhpZGRlbiB2YWx1ZS1zdG9yZSAoa2VlcGluZyBpdHMgaWQsXHJcbi8vICAgY2xhc3NlcywgZGF0YS0qIGFuZCBldmVudCB3aXJpbmcpIGFuZCBnYWlucyBhIGNvbXBhY3Qgc3dhdGNoIHRyaWdnZXIuIENsaWNraW5nXHJcbi8vICAgaXQgb3BlbnMgYSBwb3BvdmVyIHdpdGggZGlyZWN0IGhleCBlbnRyeSwgYSByZWNlbnRseS11c2VkIHN0cmlwLCBhbmQgKFN0YWdlIDMpXHJcbi8vICAgYSB1c2VyLWN1cmF0ZWQgbmFtZWQgcGFsZXR0ZS4gUmVwbGFjZXMgbmF0aXZlIDxpbnB1dCB0eXBlPVwiY29sb3JcIj4gYXQgdGhlXHJcbi8vICAgc3BlYWtlci1jb2xvdXIgYW5kIHRpdGxlLWNhcmQgY29sb3VyIHNpdGVzLlxyXG4vLyAgIFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX2NvbG9ycGlja2VyLnB5XHJcbi8vIOKUgOKUgCBzaGFyZWQgY29sb3VyIHBpY2tlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbmNvbnN0IFJFQ0VOVF9LRVkgPSAneXV1Y2xpcC1jb2xvci1yZWNlbnQnO1xyXG5jb25zdCBQQUxFVFRFX0tFWSA9ICd5dXVjbGlwLWNvbG9yLXBhbGV0dGUnO1xyXG5jb25zdCBSRUNFTlRfTUFYID0gODtcclxuXHJcbi8vIFBpY2thYmxlIHN0YXJ0ZXIgY29sb3VycyAtIGRhdGEsIG5vdCBVSSBjaHJvbWUgKHRoZSBjaHJvbWUgYXJvdW5kIHRoZW0gY29tZXNcclxuLy8gZnJvbSB0aGVtZSB0b2tlbnMpLiBBIHNwcmVhZCBvZiBodWVzIHBsdXMgYmxhY2svd2hpdGUgc28gYSBmaXJzdC10aW1lIHVzZXIgaGFzXHJcbi8vIHVzYWJsZSBjaG9pY2VzIGJlZm9yZSBjdXJhdGluZyB0aGVpciBvd24gcGFsZXR0ZS4gVGhlc2UgbGl0ZXJhbHMgYXJlIHRoZSBvbmVcclxuLy8gZXhjZXB0aW9uIHRoZSB0ZXN0X3VpX3RoZW1lIGNvbG91ci1saXRlcmFsIGFsbG93bGlzdCBjYXJ2ZXMgb3V0IGZvciB0aGlzIGZpbGUuXHJcbmNvbnN0IFNUQVJURVJfU1dBVENIRVMgPSBbXHJcbiAgJyNmZmZmZmYnLCAnIzAwMDAwMCcsICcjZTA1YzVjJywgJyNmMDgwM2MnLCAnI2YwYzA2MCcsICcjNGNhZjdkJyxcclxuICAnIzRmYzNmNycsICcjMGE3YTliJywgJyNiMDZhZjcnLCAnI2Y3N2FjMCcsICcjOWU5ZTllJywgJyM3YTRiMmEnLFxyXG5dO1xyXG5cclxuZnVuY3Rpb24gX3JlYWRMaXN0KGtleSkge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgfHwgJ1tdJyk7XHJcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogW107XHJcbiAgfSBjYXRjaCB7IHJldHVybiBbXTsgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBfd3JpdGVMaXN0KGtleSwgbGlzdCkge1xyXG4gIHRyeSB7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkobGlzdCkpOyB9IGNhdGNoIHsgLyogc3RvcmFnZSBkaXNhYmxlZCAqLyB9XHJcbn1cclxuXHJcbi8vIEFjY2VwdHMgI1JHQiBvciAjUlJHR0JCICh3aXRoIG9yIHdpdGhvdXQgdGhlIGxlYWRpbmcgIykgYW5kIHJldHVybnMgYVxyXG4vLyBjYW5vbmljYWwgbG93ZXJjYXNlICNycmdnYmIsIG9yIG51bGwgd2hlbiB0aGUgdmFsdWUgaXNuJ3QgYSB2YWxpZCBoZXggY29sb3VyLlxyXG5mdW5jdGlvbiBfbm9ybWFsaXplSGV4KHJhdykge1xyXG4gIGlmICh0eXBlb2YgcmF3ICE9PSAnc3RyaW5nJykgcmV0dXJuIG51bGw7XHJcbiAgbGV0IGhleCA9IHJhdy50cmltKCk7XHJcbiAgaWYgKGhleCAmJiAhaGV4LnN0YXJ0c1dpdGgoJyMnKSkgaGV4ID0gJyMnICsgaGV4O1xyXG4gIGNvbnN0IHNob3J0ID0gL14jKFswLTlhLWZBLUZdezN9KSQvLmV4ZWMoaGV4KTtcclxuICBpZiAoc2hvcnQpIGhleCA9ICcjJyArIHNob3J0WzFdLnNwbGl0KCcnKS5tYXAoYyA9PiBjICsgYykuam9pbignJyk7XHJcbiAgcmV0dXJuIC9eI1swLTlhLWZBLUZdezZ9JC8udGVzdChoZXgpID8gaGV4LnRvTG93ZXJDYXNlKCkgOiBudWxsO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcmVjb3JkUmVjZW50KGhleCkge1xyXG4gIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KGhleCk7XHJcbiAgaWYgKCFub3JtKSByZXR1cm47XHJcbiAgY29uc3QgbGlzdCA9IF9yZWFkTGlzdChSRUNFTlRfS0VZKVxyXG4gICAgLm1hcChfbm9ybWFsaXplSGV4KVxyXG4gICAgLmZpbHRlcihjID0+IGMgJiYgYyAhPT0gbm9ybSk7XHJcbiAgbGlzdC51bnNoaWZ0KG5vcm0pO1xyXG4gIF93cml0ZUxpc3QoUkVDRU5UX0tFWSwgbGlzdC5zbGljZSgwLCBSRUNFTlRfTUFYKSk7XHJcbn1cclxuXHJcbi8vIEEgc2luZ2xlIGNsaWNrYWJsZSBzd2F0Y2ggc2hvd2luZyBhbiBhY3R1YWwgY2hvc2VuIGNvbG91ci4gVGhlIGJhY2tncm91bmQgaXMgYVxyXG4vLyBkYXRhIHZhbHVlICh0aGUgcGlja2VkIGNvbG91ciksIHNldCBhcyBhIERPTSBwcm9wZXJ0eSBzbyBpdCBuZXZlciBhcHBlYXJzIGFzIGFcclxuLy8gbGl0ZXJhbCBpbiBzb3VyY2UgLSB0aGUgc3dhdGNoJ3MgYm9yZGVyL2ZvY3VzIHJpbmcgYXJlIHRoZW1lIHRva2VucyB2aWEgQ1NTLlxyXG5mdW5jdGlvbiBfc3dhdGNoQnV0dG9uKGNvbG9yKSB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYnRuLnR5cGUgPSAnYnV0dG9uJztcclxuICBidG4uY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXN3YXRjaCc7XHJcbiAgYnRuLmRhdGFzZXQuY29sb3IgPSBjb2xvcjtcclxuICBidG4uc3R5bGUuYmFja2dyb3VuZCA9IGNvbG9yO1xyXG4gIGJ0bi50aXRsZSA9IGNvbG9yO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBjb2xvcik7XHJcbiAgcmV0dXJuIGJ0bjtcclxufVxyXG5cclxuZnVuY3Rpb24gX3N3YXRjaFJvdyhjb2xvcnMpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXJvdyc7XHJcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcclxuICBmb3IgKGNvbnN0IHJhdyBvZiBjb2xvcnMpIHtcclxuICAgIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleChyYXcpO1xyXG4gICAgaWYgKCFjb2xvciB8fCBzZWVuLmhhcyhjb2xvcikpIGNvbnRpbnVlO1xyXG4gICAgc2Vlbi5hZGQoY29sb3IpO1xyXG4gICAgcm93LmFwcGVuZENoaWxkKF9zd2F0Y2hCdXR0b24oY29sb3IpKTtcclxuICB9XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuZnVuY3Rpb24gX3NlY3Rpb25MYWJlbCh0ZXh0KSB7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItc2VjdGlvbi1sYWJlbCc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSB0ZXh0O1xyXG4gIHJldHVybiBsYWJlbDtcclxufVxyXG5cclxuLy8g4pSA4pSAIHVzZXItY3VyYXRlZCBuYW1lZCBwYWxldHRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5mdW5jdGlvbiBfcGFsZXR0ZUVudHJpZXMoKSB7XHJcbiAgcmV0dXJuIF9yZWFkTGlzdChQQUxFVFRFX0tFWSlcclxuICAgIC5maWx0ZXIoZSA9PiBlICYmIHR5cGVvZiBlLm5hbWUgPT09ICdzdHJpbmcnICYmIF9ub3JtYWxpemVIZXgoZS5jb2xvcikpXHJcbiAgICAubWFwKGUgPT4gKHsgbmFtZTogZS5uYW1lLCBjb2xvcjogX25vcm1hbGl6ZUhleChlLmNvbG9yKSB9KSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9wYWxldHRlSXRlbShuYW1lLCBjb2xvcikge1xyXG4gIGNvbnN0IGl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBpdGVtLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWl0ZW0nO1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLW5hbWUnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gbmFtZTtcclxuICBjb25zdCByZW1vdmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICByZW1vdmUudHlwZSA9ICdidXR0b24nO1xyXG4gIHJlbW92ZS5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1yZW1vdmUnO1xyXG4gIHJlbW92ZS5kYXRhc2V0Lm5hbWUgPSBuYW1lO1xyXG4gIHJlbW92ZS50ZXh0Q29udGVudCA9ICfDlyc7XHJcbiAgcmVtb3ZlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGBSZW1vdmUgJHtuYW1lfWApO1xyXG4gIGl0ZW0uYXBwZW5kKF9zd2F0Y2hCdXR0b24oY29sb3IpLCBsYWJlbCwgcmVtb3ZlKTtcclxuICByZXR1cm4gaXRlbTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkUGFsZXR0ZShlbnRyaWVzKSB7XHJcbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHdyYXAuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUnO1xyXG4gIGlmICghZW50cmllcy5sZW5ndGgpIHtcclxuICAgIGNvbnN0IGhpbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICBoaW50LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oaW50JztcclxuICAgIGhpbnQudGV4dENvbnRlbnQgPSAnU2F2ZSBhIGNvbG91ciBiZWxvdyB0byBidWlsZCB5b3VyIHBhbGV0dGUuJztcclxuICAgIHdyYXAuYXBwZW5kQ2hpbGQoaGludCk7XHJcbiAgICByZXR1cm4gd3JhcDtcclxuICB9XHJcbiAgZW50cmllcy5mb3JFYWNoKCh7IG5hbWUsIGNvbG9yIH0pID0+IHdyYXAuYXBwZW5kQ2hpbGQoX3BhbGV0dGVJdGVtKG5hbWUsIGNvbG9yKSkpO1xyXG4gIHJldHVybiB3cmFwO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRBZGRSb3coKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1hZGRyb3cnO1xyXG4gIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICBpbnB1dC50eXBlID0gJ3RleHQnO1xyXG4gIGlucHV0LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWlucHV0JztcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ21heGxlbmd0aCcsICc0MCcpO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdOYW1lIGZvciB0aGUgY3VycmVudCBjb2xvdXInKTtcclxuICBpbnB1dC5wbGFjZWhvbGRlciA9ICdOYW1lIHRoaXMgY29sb3VyJztcclxuICBjb25zdCBhZGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBhZGQudHlwZSA9ICdidXR0b24nO1xyXG4gIGFkZC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1hZGQnO1xyXG4gIGFkZC50ZXh0Q29udGVudCA9ICdTYXZlJztcclxuICByb3cuYXBwZW5kKGlucHV0LCBhZGQpO1xyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbi8vIFNhdmVzIHRoZSBjb2xvdXIgY3VycmVudGx5IGluIHRoZSBoZXggZmllbGQgKGZhbGxpbmcgYmFjayB0byB0aGUgY29tbWl0dGVkXHJcbi8vIHZhbHVlKSB1bmRlciB0aGUgdHlwZWQgbmFtZSwgZGVmYXVsdGluZyB0aGUgbmFtZSB0byB0aGUgaGV4IHN0cmluZyBpdHNlbGYuXHJcbmZ1bmN0aW9uIF9hZGRQYWxldHRlRW50cnkoY3R4KSB7XHJcbiAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KGN0eC5oZXhGaWVsZC52YWx1ZSkgfHwgX25vcm1hbGl6ZUhleChjdHguaW5wdXQudmFsdWUpO1xyXG4gIGlmICghY29sb3IpIHJldHVybjtcclxuICBjb25zdCBuYW1lSW5wdXQgPSBjdHgucG9wLnF1ZXJ5U2VsZWN0b3IoJy5jb2xvcnBpY2tlci1wYWxldHRlLWlucHV0Jyk7XHJcbiAgY29uc3QgbmFtZSA9IChuYW1lSW5wdXQgJiYgbmFtZUlucHV0LnZhbHVlLnRyaW0oKSkgfHwgY29sb3I7XHJcbiAgY29uc3QgbmV4dCA9IF9wYWxldHRlRW50cmllcygpLmZpbHRlcihlID0+IGUubmFtZSAhPT0gbmFtZSk7XHJcbiAgbmV4dC5wdXNoKHsgbmFtZSwgY29sb3IgfSk7XHJcbiAgX3dyaXRlTGlzdChQQUxFVFRFX0tFWSwgbmV4dCk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcmVtb3ZlUGFsZXR0ZUVudHJ5KGN0eCwgbmFtZSkge1xyXG4gIF93cml0ZUxpc3QoUEFMRVRURV9LRVksIF9wYWxldHRlRW50cmllcygpLmZpbHRlcihlID0+IGUubmFtZSAhPT0gbmFtZSkpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIHZhbHVlKSB7XHJcbiAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KHZhbHVlKTtcclxuICB0cmlnZ2VyLnN0eWxlLmJhY2tncm91bmQgPSBjb2xvciB8fCAndHJhbnNwYXJlbnQnO1xyXG4gIHRyaWdnZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtZW1wdHknLCAhY29sb3IpO1xyXG59XHJcblxyXG4vLyBFdmVyeXRoaW5nIGluIGEgcGlja2VyIGluc3RhbmNlIHRoZSBoYW5kbGVycyBuZWVkIHRvIHJlYWNoLlxyXG5mdW5jdGlvbiBfbWFrZUNvbnRleHQoaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQpIHtcclxuICByZXR1cm4geyBpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBfY29tbWl0KGN0eCwgcmF3SGV4KSB7XHJcbiAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgocmF3SGV4KTtcclxuICBpZiAoIW5vcm0pIHJldHVybiBmYWxzZTtcclxuICBjdHguaW5wdXQudmFsdWUgPSBub3JtO1xyXG4gIC8vIGlucHV0IGRyaXZlcyB0aGUgbGl2ZS1wcmV2aWV3IGhhbmRsZXJzICh0aXRsZSBjYXJkJ3Mgb25pbnB1dCk7IGNoYW5nZSBkcml2ZXNcclxuICAvLyB0aGUgc2F2ZSBoYW5kbGVycyAoc3BlYWtlciBjaGFuZ2UtZGVsZWdhdGlvbikuIFRoZSB0cmlnZ2VyIHJlLXN5bmNzIG9mZiB0aGVcclxuICAvLyAnaW5wdXQnIGxpc3RlbmVyIHdpcmVkIGluIGF0dGFjaCgpLlxyXG4gIGN0eC5pbnB1dC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG4gIGN0eC5pbnB1dC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnY2hhbmdlJywgeyBidWJibGVzOiB0cnVlIH0pKTtcclxuICBfcmVjb3JkUmVjZW50KG5vcm0pO1xyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG4vLyBSZWJ1aWx0IGVhY2ggdGltZSB0aGUgcG9wb3ZlciBvcGVucyAoYW5kIGFmdGVyIGEgcGFsZXR0ZSBhZGQvcmVtb3ZlKSBzbyB0aGVcclxuLy8gcmVjZW50bHktdXNlZCBzdHJpcCBhbmQgc2F2ZWQgcGFsZXR0ZSByZWZsZWN0IHRoZSBsYXRlc3Qgc3RhdGUuIEFsbCBvZiBpdCBnb2VzXHJcbi8vIGluIG9uZSBjb250YWluZXIgdGhhdCBpcyByZXBsYWNlZCB3aG9sZXNhbGUsIHNvIG5vdGhpbmcgYWNjdW11bGF0ZXMuXHJcbmZ1bmN0aW9uIF9yZW5kZXJTdHJpcHMoY3R4KSB7XHJcbiAgY29uc3Qgc3RhbGUgPSBjdHgucG9wLnF1ZXJ5U2VsZWN0b3IoJy5jb2xvcnBpY2tlci1keW5hbWljJyk7XHJcbiAgaWYgKHN0YWxlKSBzdGFsZS5yZW1vdmUoKTtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBjb250YWluZXIuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWR5bmFtaWMnO1xyXG4gIGNvbnN0IHJlY2VudCA9IF9yZWFkTGlzdChSRUNFTlRfS0VZKTtcclxuICBpZiAocmVjZW50Lmxlbmd0aCkge1xyXG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ1JlY2VudGx5IHVzZWQnKSk7XHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3N3YXRjaFJvdyhyZWNlbnQpKTtcclxuICB9XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ1lvdXIgcGFsZXR0ZScpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX2J1aWxkUGFsZXR0ZShfcGFsZXR0ZUVudHJpZXMoKSkpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfYnVpbGRBZGRSb3coKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ0NvbG91cnMnKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zd2F0Y2hSb3coU1RBUlRFUl9TV0FUQ0hFUykpO1xyXG4gIGN0eC5wb3AuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxufVxyXG5cclxubGV0IF9vcGVuQ3R4ID0gbnVsbDsgIC8vIHRoZSBvbmUgb3BlbiBwaWNrZXIgY29udGV4dCwgb3IgbnVsbFxyXG5cclxuZnVuY3Rpb24gX2Nsb3NlUG9wb3ZlcihyZWZvY3VzKSB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGNvbnN0IHsgcG9wLCB0cmlnZ2VyIH0gPSBfb3BlbkN0eDtcclxuICBwb3AuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XHJcbiAgX29wZW5DdHggPSBudWxsO1xyXG4gIGlmIChyZWZvY3VzKSB0cmlnZ2VyLmZvY3VzKCk7XHJcbn1cclxuXHJcbi8vIFRoZSBwb3BvdmVyIGlzIGEgZGlhbG9nLCBzbyBUYWIgbXVzdCBub3QgZmFsbCB0aHJvdWdoIHRvIHRoZSBwYWdlIGJlaGluZCBpdFxyXG4vLyAoV0NBRyAyLjQuMykuIEN5Y2xlIGZvY3VzIGFtb25nIHRoZSBwb3BvdmVyJ3Mgb3duIGNvbnRyb2xzOyB0aGUgdHJpZ2dlciBzaXRzXHJcbi8vIG91dHNpZGUgdGhlIHBvcG92ZXIgYW5kIGlzIGludGVudGlvbmFsbHkgZXhjbHVkZWQgd2hpbGUgaXQgaXMgb3Blbi5cclxuZnVuY3Rpb24gX2ZvY3VzYWJsZXMocG9wKSB7XHJcbiAgcmV0dXJuIEFycmF5LmZyb20ocG9wLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbiwgaW5wdXQnKSkuZmlsdGVyKFxyXG4gICAgZWwgPT4gIWVsLmRpc2FibGVkICYmIGVsLm9mZnNldFBhcmVudCAhPT0gbnVsbCxcclxuICApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfdHJhcEZvY3VzKGUpIHtcclxuICBjb25zdCBpdGVtcyA9IF9mb2N1c2FibGVzKF9vcGVuQ3R4LnBvcCk7XHJcbiAgaWYgKCFpdGVtcy5sZW5ndGgpIHJldHVybjtcclxuICBjb25zdCBmaXJzdCA9IGl0ZW1zWzBdO1xyXG4gIGNvbnN0IGxhc3QgPSBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXTtcclxuICBjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xyXG4gIGlmICghX29wZW5DdHgucG9wLmNvbnRhaW5zKGFjdGl2ZSkpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGZpcnN0LmZvY3VzKCk7XHJcbiAgfSBlbHNlIGlmIChlLnNoaWZ0S2V5ICYmIGFjdGl2ZSA9PT0gZmlyc3QpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGxhc3QuZm9jdXMoKTtcclxuICB9IGVsc2UgaWYgKCFlLnNoaWZ0S2V5ICYmIGFjdGl2ZSA9PT0gbGFzdCkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZmlyc3QuZm9jdXMoKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9vcGVuUG9wb3ZlcihjdHgpIHtcclxuICBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgY3R4LmhleEZpZWxkLnZhbHVlID0gKF9ub3JtYWxpemVIZXgoY3R4LmlucHV0LnZhbHVlKSB8fCAnJykucmVwbGFjZSgnIycsICcnKTtcclxuICBjdHguaGV4RmllbGQuY2xhc3NMaXN0LnJlbW92ZSgnaW52YWxpZCcpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxuICBjdHgucG9wLmNsYXNzTGlzdC5hZGQoJ29wZW4nKTtcclxuICBjdHgudHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xyXG4gIF9vcGVuQ3R4ID0gY3R4O1xyXG4gIGN0eC5oZXhGaWVsZC5mb2N1cygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfd2lyZUhleEZpZWxkKGN0eCkge1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcclxuICAgIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KGN0eC5oZXhGaWVsZC52YWx1ZSk7XHJcbiAgICBjdHguaGV4RmllbGQuY2xhc3NMaXN0LnRvZ2dsZSgnaW52YWxpZCcsICFub3JtICYmIGN0eC5oZXhGaWVsZC52YWx1ZS50cmltKCkgIT09ICcnKTtcclxuICAgIGlmIChub3JtKSBfc3luY1RyaWdnZXIoY3R4LnRyaWdnZXIsIG5vcm0pOyAgLy8gbGl2ZSBwcmV2aWV3LCBubyBjb21taXQgeWV0XHJcbiAgfSk7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IF9jb21taXQoY3R4LCBjdHguaGV4RmllbGQudmFsdWUpKTtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gICAgaWYgKGUua2V5ICE9PSAnRW50ZXInKSByZXR1cm47XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoX2NvbW1pdChjdHgsIGN0eC5oZXhGaWVsZC52YWx1ZSkpIF9jbG9zZVBvcG92ZXIodHJ1ZSk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZEhleFJvdygpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleHJvdyc7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleGhhc2gnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gJyMnO1xyXG4gIGNvbnN0IGZpZWxkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICBmaWVsZC50eXBlID0gJ3RleHQnO1xyXG4gIGZpZWxkLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhmaWVsZCc7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdtYXhsZW5ndGgnLCAnNycpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnYXV0b2NvbXBsZXRlJywgJ29mZicpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIZXggY29sb3VyIHZhbHVlJyk7XHJcbiAgZmllbGQucGxhY2Vob2xkZXIgPSAnUlJHR0JCJztcclxuICByb3cuYXBwZW5kKGxhYmVsLCBmaWVsZCk7XHJcbiAgcmV0dXJuIHsgcm93LCBmaWVsZCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBhdHRhY2goaW5wdXQpIHtcclxuICBpZiAoIWlucHV0IHx8IGlucHV0LmRhdGFzZXQuY3BBdHRhY2hlZCkgcmV0dXJuO1xyXG4gIGlucHV0LmRhdGFzZXQuY3BBdHRhY2hlZCA9ICcxJztcclxuICBjb25zdCBpbml0aWFsID0gX25vcm1hbGl6ZUhleChpbnB1dC52YWx1ZSkgfHwgJyc7XHJcbiAgaW5wdXQudHlwZSA9ICdoaWRkZW4nO1xyXG4gIGlucHV0LnZhbHVlID0gaW5pdGlhbDtcclxuXHJcbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB3cmFwLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlcic7XHJcbiAgaW5wdXQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUod3JhcCwgaW5wdXQpO1xyXG5cclxuICBjb25zdCB0cmlnZ2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgdHJpZ2dlci50eXBlID0gJ2J1dHRvbic7XHJcbiAgdHJpZ2dlci5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItdHJpZ2dlcic7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGFzcG9wdXAnLCAndHJ1ZScpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2hvb3NlIGNvbG91cicpO1xyXG5cclxuICBjb25zdCBwb3AgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBwb3AuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBvcCc7XHJcbiAgcG9wLnNldEF0dHJpYnV0ZSgncm9sZScsICdkaWFsb2cnKTtcclxuICBwb3Auc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0NvbG91ciBwaWNrZXInKTtcclxuICBjb25zdCB7IHJvdzogaGV4Um93LCBmaWVsZDogaGV4RmllbGQgfSA9IF9idWlsZEhleFJvdygpO1xyXG4gIHBvcC5hcHBlbmRDaGlsZChoZXhSb3cpO1xyXG5cclxuICB3cmFwLmFwcGVuZCh0cmlnZ2VyLCBpbnB1dCwgcG9wKTtcclxuICBjb25zdCBjdHggPSBfbWFrZUNvbnRleHQoaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQpO1xyXG5cclxuICBfc3luY1RyaWdnZXIodHJpZ2dlciwgaW5wdXQudmFsdWUpO1xyXG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4gX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIGlucHV0LnZhbHVlKSk7XHJcbiAgdHJpZ2dlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgaWYgKF9vcGVuQ3R4ICYmIF9vcGVuQ3R4LnRyaWdnZXIgPT09IHRyaWdnZXIpIF9jbG9zZVBvcG92ZXIoKTtcclxuICAgIGVsc2UgX29wZW5Qb3BvdmVyKGN0eCk7XHJcbiAgfSk7XHJcbiAgcG9wLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgICBjb25zdCByZW1vdmVCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1yZW1vdmUnKTtcclxuICAgIGlmIChyZW1vdmVCdG4pIHsgX3JlbW92ZVBhbGV0dGVFbnRyeShjdHgsIHJlbW92ZUJ0bi5kYXRhc2V0Lm5hbWUpOyByZXR1cm47IH1cclxuICAgIGlmIChlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1hZGQnKSkgeyBfYWRkUGFsZXR0ZUVudHJ5KGN0eCk7IHJldHVybjsgfVxyXG4gICAgY29uc3Qgc3dhdGNoID0gZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXN3YXRjaCcpO1xyXG4gICAgaWYgKCFzd2F0Y2gpIHJldHVybjtcclxuICAgIF9jb21taXQoY3R4LCBzd2F0Y2guZGF0YXNldC5jb2xvcik7XHJcbiAgICBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgfSk7XHJcbiAgcG9wLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJyAmJiBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCcpKSB7XHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgX2FkZFBhbGV0dGVFbnRyeShjdHgpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG4gIF93aXJlSGV4RmllbGQoY3R4KTtcclxufVxyXG5cclxuLy8gQ2xvc2UgdGhlIG9wZW4gcG9wb3ZlciBvbiBhbiBvdXRzaWRlIGNsaWNrIG9yIEVzY2FwZS4gUmVnaXN0ZXJlZCBvbmNlLlxyXG4vLyBBIGNsaWNrIHRoYXQgcmUtcmVuZGVycyB0aGUgcG9wb3ZlciAoU2F2ZSAvIHJlbW92ZSBhIHBhbGV0dGUgZW50cnkpIGRldGFjaGVzXHJcbi8vIGl0cyBvd24gdGFyZ2V0IGJlZm9yZSB0aGlzIGJ1YmJsaW5nIGhhbmRsZXIgcnVuczsgc3VjaCBhIHRhcmdldCBpcyBubyBsb25nZXIgaW5cclxuLy8gdGhlIGRvY3VtZW50LCBzbyBza2lwIGl0IHJhdGhlciB0aGFuIG1pc3Rha2luZyBpdCBmb3IgYW4gb3V0c2lkZSBjbGljay5cclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgaWYgKCFkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoZS50YXJnZXQpKSByZXR1cm47XHJcbiAgaWYgKCFfb3BlbkN0eC5wb3AucGFyZW50Tm9kZS5jb250YWlucyhlLnRhcmdldCkpIF9jbG9zZVBvcG92ZXIoKTtcclxufSk7XHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykgeyBfY2xvc2VQb3BvdmVyKHRydWUpOyByZXR1cm47IH1cclxuICBpZiAoZS5rZXkgPT09ICdUYWInKSBfdHJhcEZvY3VzKGUpO1xyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBDb2xvclBpY2tlciA9IHsgYXR0YWNoLCBfbm9ybWFsaXplSGV4LCBSRUNFTlRfS0VZLCBQQUxFVFRFX0tFWSB9O1xyXG4iLCAiLy8gSW5mcmFzdHJ1Y3R1cmUgLSBQYW5lbE5hdiB0YWtlb3ZlciBmcmFtZXdvcmsgKG5vdCBhIGZlYXR1cmUgbW9kdWxlKS5cclxuLy8gICBVc2VkIGJ5OiBzcGxpdC5qcywgY2xpcGNyZWF0ZS5qcywgZXhwb3J0ZWRpdG9yLmpzLCBuYW1lY29ycmVjdGlvbnMuanMgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfcGFuZWxuYXYucHlcclxuLy8g4pSA4pSAIHBhbmVsIG5hdmlnYXRpb24gZnJhbWV3b3JrIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBNdWx0aS1zdGVwIGZsb3dzIChTcGxpdCBFZGl0b3IsIGFuZCBmdXR1cmUgcGlja2VycykgdGFrZSBvdmVyIHRoZSBtYWluXHJcbi8vIGRldGFpbCBwYW5lbCBpbnN0ZWFkIG9mIHVzaW5nIGEgbW9kYWw6IHNoYXJlZCBicmVhZGNydW1iLCBzaGFyZWQgZGlydHktc3RhdGVcclxuLy8gZGlzY2FyZCBwcm9tcHQuIEVhY2ggb3BlbiBwYW5lbCBnZXRzIGl0cyBvd24gY29udGVudCBjb250YWluZXIgc28gYSBmdXR1cmVcclxuLy8gbmVzdGVkIHBhbmVsIChlLmcuIG1hbnVhbC1jbGlwJ3MgcGlja2VyIG9uIHRvcCBvZiBhIHJlY29yZGluZyB2aWV3KSBjYW4gYmVcclxuLy8gdW53b3VuZCBvbmUgbGV2ZWwgYXQgYSB0aW1lIHdpdGhvdXQgcmUtcnVubmluZyB0aGUgcGFyZW50J3MgcmVuZGVyKCkuXHJcbi8vXHJcbi8vIFRoZSBjb250YWluZXIgaXMgZGVzdHJveWVkIG9uIGNsb3NlIHJpZ2h0IGFmdGVyIG9uQ2xvc2UoKSBydW5zLiBJZiByZW5kZXIoKVxyXG4vLyByZXBhcmVudGVkIGFuIGV4aXN0aW5nIHN0YXRpYyBlbGVtZW50IChyYXRoZXIgdGhhbiBidWlsZGluZyBmcmVzaCBET00pLFxyXG4vLyBvbkNsb3NlKCkgbXVzdCBtb3ZlIGl0IGJhY2sgb3V0IHRvIGEgc3RhYmxlLCBhbHdheXMtaW4tZG9jdW1lbnQgbG9jYXRpb24gLVxyXG4vLyBvdGhlcndpc2UgaXQgZ29lcyB3aXRoIHRoZSBjb250YWluZXIgYW5kIGdldEVsZW1lbnRCeUlkIGNhbid0IGZpbmQgaXQgb25cclxuLy8gdGhlIG5leHQgb3Blbi4gU2VlIHNwbGl0LmpzJ3MgX3RlYXJkb3duU3BsaXRFZGl0b3IgZm9yIHRoZSBwYXR0ZXJuLlxyXG5cclxuY29uc3QgX3N0YWNrID0gW107ICAvLyBbe2lkLCB0aXRsZSwgaXNEaXJ0eSwgb25DbG9zZSwgY29udGFpbmVyfV1cclxuXHJcbmZ1bmN0aW9uIF9yb290KCkgICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LXJvb3QnKTsgfVxyXG5mdW5jdGlvbiBfY3J1bWIoKSAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1icmVhZGNydW1iJyk7IH1cclxuZnVuY3Rpb24gX21vdW50KCkgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtY29udGVudCcpOyB9XHJcbmZ1bmN0aW9uIF90b3AoKSAgICAgeyByZXR1cm4gX3N0YWNrW19zdGFjay5sZW5ndGggLSAxXSB8fCBudWxsOyB9XHJcblxyXG5mdW5jdGlvbiBfcmVuZGVyQnJlYWRjcnVtYigpIHtcclxuICBjb25zdCB0b3AgPSBfdG9wKCk7XHJcbiAgY29uc3QgY3J1bWIgPSBfY3J1bWIoKTtcclxuICBjcnVtYi5pbm5lckhUTUwgPSAnJztcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIGNvbnN0IGJhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBiYWNrLnR5cGUgPSAnYnV0dG9uJztcclxuICBiYWNrLmNsYXNzTmFtZSA9ICdidG4gZ2hvc3QnO1xyXG4gIGJhY2suc3R5bGUuY3NzVGV4dCA9ICdwYWRkaW5nOjRweCAxMHB4O2ZvbnQtc2l6ZToxM3B4JztcclxuICBiYWNrLnRleHRDb250ZW50ID0gJ+KGkCBCYWNrJztcclxuICBiYWNrLm9uY2xpY2sgPSAoKSA9PiBwYW5lbE5hdkNsb3NlKCk7XHJcbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgdGl0bGUuc3R5bGUuY3NzVGV4dCA9ICdmb250LXNpemU6MTRweDtmb250LXdlaWdodDo2MDAnO1xyXG4gIHRpdGxlLnRleHRDb250ZW50ID0gdG9wLnRpdGxlO1xyXG4gIGNydW1iLmFwcGVuZChiYWNrLCB0aXRsZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF91cGRhdGVWaXNpYmlsaXR5KCkge1xyXG4gIF9zdGFjay5mb3JFYWNoKChlbnRyeSwgaSkgPT4ge1xyXG4gICAgZW50cnkuY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSBpID09PSBfc3RhY2subGVuZ3RoIC0gMSA/ICdmbGV4JyA6ICdub25lJztcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZPcGVuKHsgaWQsIHRpdGxlLCByZW5kZXIsIGlzRGlydHksIG9uQ2xvc2UgfSkge1xyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnRhaW5lci5kYXRhc2V0LnBhbmVsSWQgPSBpZDtcclxuICBjb250YWluZXIuc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDoxNnB4JztcclxuICBfbW91bnQoKS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xyXG4gIF9zdGFjay5wdXNoKHtcclxuICAgIGlkLFxyXG4gICAgdGl0bGUsXHJcbiAgICBpc0RpcnR5OiBpc0RpcnR5IHx8ICgoKSA9PiBmYWxzZSksXHJcbiAgICBvbkNsb3NlOiBvbkNsb3NlIHx8ICgoKSA9PiB7fSksXHJcbiAgICBjb250YWluZXIsXHJcbiAgfSk7XHJcbiAgX3Jvb3QoKS5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gIF91cGRhdGVWaXNpYmlsaXR5KCk7XHJcbiAgX3JlbmRlckJyZWFkY3J1bWIoKTtcclxuICByZW5kZXIoY29udGFpbmVyKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2Nsb3NlVG9wKCkge1xyXG4gIGNvbnN0IHRvcCA9IF9zdGFjay5wb3AoKTtcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIHRvcC5vbkNsb3NlKCk7XHJcbiAgdG9wLmNvbnRhaW5lci5yZW1vdmUoKTtcclxuICBpZiAoX3N0YWNrLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgX3Jvb3QoKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBfdXBkYXRlVmlzaWJpbGl0eSgpO1xyXG4gICAgX3JlbmRlckJyZWFkY3J1bWIoKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2Q2xvc2UoKSB7XHJcbiAgY29uc3QgdG9wID0gX3RvcCgpO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgaWYgKHRvcC5pc0RpcnR5KCkpIHtcclxuICAgIHdpbmRvdy5zaG93Q29uZmlybShcclxuICAgICAgJ0Rpc2NhcmQgY2hhbmdlcz8nLFxyXG4gICAgICAnWW91IGhhdmUgdW5zYXZlZCBjaGFuZ2VzLiBDbG9zZSB3aXRob3V0IHNhdmluZz8nLFxyXG4gICAgICAnRGlzY2FyZCcsXHJcbiAgICAgIF9jbG9zZVRvcCxcclxuICAgICAgdHJ1ZSxcclxuICAgICk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIF9jbG9zZVRvcCgpO1xyXG59XHJcblxyXG4vLyBGb3JjZS1jbG9zZSB0aGUgdG9wbW9zdCBwYW5lbCwgYnlwYXNzaW5nIHRoZSBkaXJ0eSBnYXRlIC0gZm9yIGNhbGxlcnMgdGhhdFxyXG4vLyBoYXZlIGFscmVhZHkgY29uZmlybWVkIHRoZSBkaXNjYXJkIHRocm91Z2ggdGhlaXIgb3duIChkaWZmZXJlbnRseSB3b3JkZWQpXHJcbi8vIHByb21wdCwgZS5nLiBzd2l0Y2hpbmcgcmVjb3JkaW5ncyB3aGlsZSB0aGUgU3BsaXQgRWRpdG9yIGlzIGRpcnR5LlxyXG5mdW5jdGlvbiBwYW5lbE5hdkZvcmNlQ2xvc2UoKSB7XHJcbiAgX2Nsb3NlVG9wKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2SXNPcGVuKGlkKSB7XHJcbiAgaWYgKGlkID09PSB1bmRlZmluZWQpIHJldHVybiBfc3RhY2subGVuZ3RoID4gMDtcclxuICByZXR1cm4gX3N0YWNrLnNvbWUoZW50cnkgPT4gZW50cnkuaWQgPT09IGlkKTtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IFBhbmVsTmF2ID0ge1xyXG4gIG9wZW46IHBhbmVsTmF2T3BlbiwgY2xvc2U6IHBhbmVsTmF2Q2xvc2UsIGZvcmNlQ2xvc2U6IHBhbmVsTmF2Rm9yY2VDbG9zZSwgaXNPcGVuOiBwYW5lbE5hdklzT3BlbixcclxufTtcclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gTG9uZy1ydW5uaW5nLWpvYiBtYWNoaW5lcnk6IHRoZSBqb2Itc3RhdHVzIGhlYWRlciAoc3RlcCBwaWxscywgdGltZXIsIEVUQSksIHRoZVxuLy8gICBwYXVzZS9yZXN1bWUgKyB0aGVybWFsIGF1dG8tcGF1c2UgVUksIHRoZSBmZXRjaC1iYXNlZCBTU0UgdHJhbnNwb3J0IChfb3BlblNTRS9zdHJlYW1TU0UpLCB0aGVcbi8vICAgc2luZ2xlLWFjdGl2ZS1zdHJlYW0gc3VwZXJzZWRlIGNvbnRyYWN0LCBhbmQgdGhlIHNoYXJlZCBDYW5jZWwgYnV0dG9uLlxuLy8gICBBUEk6IHJvdXRlcy9hbmFseXplLnB5LCByb3V0ZXMvc2NvcmluZy5weSAoU1NFIGVuZHBvaW50cykgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHksIHRlc3RzL3VpL3Rlc3RfdWlfc3NlLnB5XG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgZXNjSHRtbCwgZm9ybWF0QXBpRXJyb3IsIF9mbXRFbGFwc2VkIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xuXG4vLyDilIDilIAgc2hhcmVkIGxpdmUgam9iLXJlbmRlciBzdGF0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFJlYWQgY3Jvc3MtZmlsZSBieSB2aWRlb3MuanMncyBjb21wYWN0IHN0ZXAgc3RyaXAgKGJhcmUgaWRlbnRpZmllcnMgX2pvYlN0ZXBEZWZzLFxuLy8gX2FjdGl2ZVN0ZXBJZHgsIF9qb2JTdGFydFRpbWUpIGFuZCBieSB0aGUgUGxheXdyaWdodCBVSS10ZXN0IHN1aXRlLCB3aGljaCBzZWVkc1xuLy8gc2V2ZXJhbCBvZiB0aGVzZSBkaXJlY3RseSB2aWEgcGFnZS5ldmFsdWF0ZS4gQm90aCBzaWRlcyBhcmUgY2xhc3NpYywgbm9uLW1vZHVsZVxuLy8gY29kZSwgc28gdGhleSBjYW4gb25seSBldmVyIHJlYWNoIHRoZXNlIGFzIGB3aW5kb3dgIHByb3BlcnRpZXMgLSBuZXZlciB2aWEgYW4gRVNNXG4vLyBpbXBvcnQuIEEgb25lLXNob3QgYHdpbmRvdy5YID0gWGAgc25hcHNob3Qgd291bGQgZ28gc3RhbGUgdGhlIGluc3RhbnQgam9icy5qc1xuLy8gcmVhc3NpZ25zIFgsIHNvIGVhY2ggbmFtZSBnZXRzIGEgbGl2ZSBnZXQvc2V0IGJyaWRnZSBvbnRvIGB3aW5kb3dgIGJlbG93IGluc3RlYWRcbi8vIG9mIGEgcGxhaW4gT2JqZWN0LmFzc2lnbiBleHBvcnQuXG5sZXQgX2pvYlN0ZXBEZWZzICAgPSBbXTtcbmxldCBfYWN0aXZlRVMgICAgICA9IG51bGw7XG5sZXQgX2pvYlN0YXJ0VGltZSAgPSAwO1xubGV0IF9hY3RpdmVTdGVwSWR4ID0gLTE7XG5cbi8vIFBlci1zdGVwIHByb2dyZXNzIGFjY291bnRpbmcgZm9yIHRoZSBzdGVwLXBpbGwgRVRBIGhldXJpc3RpYy4gTm90IHJlYWQgYnkgb3RoZXJcbi8vIHByb2R1Y3Rpb24gbW9kdWxlcywgYnV0IHRoZSBzdGVwLXBpbGwgLyBFVEEgLyBsaXZlLXBhbmVsIHRlc3RzIHNlZWQgdGhlbSBkaXJlY3RseVxuLy8gdmlhIHBhZ2UuZXZhbHVhdGUsIHNvIHRoZXkgbmVlZCB0aGUgc2FtZSB3aW5kb3cgYnJpZGdlIGFzIHRoZSBibG9jayBhYm92ZS5cbmxldCBfc3RlcFN0YXJ0VGltZSA9IDA7XG5sZXQgX3N0ZXBQcm9ncmVzcyAgPSB7fTsgLy8gc3RlcElkeCAtPiB7Y3VycmVudCwgdG90YWx9LCBjbGVhcmVkIHBlciBqb2JcbmxldCBfc3RlcFJhdGVBbmNob3IgPSB7fTsgLy8gc3RlcElkeCAtPiB7dCwgY3VycmVudH0gYXQgZmlyc3Qgb2JzZXJ2ZWQgY291bnQsIGNsZWFyZWQgcGVyIGpvYlxuXG5mb3IgKGNvbnN0IFtuYW1lLCBnZXQsIHNldF0gb2YgW1xuICBbJ19qb2JTdGVwRGVmcycsICAgICgpID0+IF9qb2JTdGVwRGVmcywgICAgdiA9PiB7IF9qb2JTdGVwRGVmcyA9IHY7IH1dLFxuICBbJ19hY3RpdmVFUycsICAgICAgICgpID0+IF9hY3RpdmVFUywgICAgICAgdiA9PiB7IF9hY3RpdmVFUyA9IHY7IH1dLFxuICBbJ19qb2JTdGFydFRpbWUnLCAgICgpID0+IF9qb2JTdGFydFRpbWUsICAgdiA9PiB7IF9qb2JTdGFydFRpbWUgPSB2OyB9XSxcbiAgWydfYWN0aXZlU3RlcElkeCcsICAoKSA9PiBfYWN0aXZlU3RlcElkeCwgIHYgPT4geyBfYWN0aXZlU3RlcElkeCA9IHY7IH1dLFxuICBbJ19zdGVwU3RhcnRUaW1lJywgICgpID0+IF9zdGVwU3RhcnRUaW1lLCAgdiA9PiB7IF9zdGVwU3RhcnRUaW1lID0gdjsgfV0sXG4gIFsnX3N0ZXBQcm9ncmVzcycsICAgKCkgPT4gX3N0ZXBQcm9ncmVzcywgICB2ID0+IHsgX3N0ZXBQcm9ncmVzcyA9IHY7IH1dLFxuICBbJ19zdGVwUmF0ZUFuY2hvcicsICgpID0+IF9zdGVwUmF0ZUFuY2hvciwgdiA9PiB7IF9zdGVwUmF0ZUFuY2hvciA9IHY7IH1dLFxuXSkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCBuYW1lLCB7Z2V0LCBzZXQsIGNvbmZpZ3VyYWJsZTogdHJ1ZX0pO1xufVxuXG4vLyDilIDilIAgcHJvZ3Jlc3MgaW5kaWNhdG9yIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gZXN0TWF0Y2g6IHN1YnN0cmluZ3MgdGhhdCBtYXAgdGhpcyBwaWxsIHRvIGEgc3RlcCBuYW1lIGZyb20gL2FwaS9lc3RpbWF0ZSwgc29cbi8vIHRoZSBwcm9ncmVzcyBwaWxsIGNhbiBzaG93IGl0cyBwcmUtcnVuIHRpbWUgZXN0aW1hdGUgYXMgYSBob3ZlciB0b29sdGlwLlxuLy8gcHJvZ3Jlc3NQYXR0ZXJuOiByZWdleCB3aXRoIHR3byBjYXB0dXJlIGdyb3VwcyAoY3VycmVudCwgdG90YWwpIG1hdGNoZWRcbi8vIGFnYWluc3QgaW5jb21pbmcgbG9nIGxpbmVzIHdoaWxlIHRoaXMgc3RlcCBpcyBhY3RpdmUsIHNvIHRoZSBwaWxsIGNhbiBzaG93XG4vLyBcIjMvMTIgKDI1JSlcIiBhbmQgYSBsaXZlIEVUQSBpbnN0ZWFkIG9mIGp1c3QgZWxhcHNlZCB0aW1lLlxuLy8gc3RhZ2U6IHRoZSBtYWNoaW5lLXJlYWRhYmxlIGlkIGZyb20gdGhlIEBAUFJPR1JFU1MgbWFya2VyICh5dXVfY2xpcC9waXBlbGluZS9cbi8vIHByb2dyZXNzLnB5IFN0YWdlKS4gVGhlIG1hcmtlciBkcml2ZXMgdGhlIHBpbGwgZGV0ZXJtaW5pc3RpY2FsbHk7IHRoZSBwYXR0ZXJucy9cbi8vIHByb2dyZXNzUGF0dGVybiByZWdleGVzIGJlbG93IHN0YXkgYXMgYSBvbmUtcmVsZWFzZSBmYWxsYmFjayBmb3IgdGhlIGh1bWFuIGxvZ1xuLy8gbGluZXMuIFRoZSBzdGFnZSBzZXQgaGVyZSBpcyBjb3VwbGluZy1ndWFyZGVkIGFnYWluc3QgcHJvZ3Jlc3MucHkgYnlcbi8vIHRlc3RzL3VuaXQvdGVzdF9wcm9ncmVzc19zdGFnZV9jb3VwbGluZy5weS5cbmNvbnN0IElOR0VTVF9TVEVQUyA9IFtcbiAge2xhYmVsOiAnRXh0cmFjdCcsICAgICAgICBzdGFnZTogJ2V4dHJhY3QnLCAgICAgICAgcGF0dGVybnM6IFsnRXh0cmFjdGluZyBhdWRpbyddLCAgICAgIGVzdE1hdGNoOiBbJ2V4dHJhY3QgYXVkaW8nXSwgIHByb2dyZXNzUGF0dGVybjogL1RyYWNrIChcXGQrKVxcLyhcXGQrKS99LFxuICB7bGFiZWw6ICdUcmFuc2NyaWJlJywgICAgIHN0YWdlOiAndHJhbnNjcmliZScsICAgICBwYXR0ZXJuczogWydUcmFuc2NyaWJpbmcnXSwgICAgICAgICAgZXN0TWF0Y2g6IFsndHJhbnNjcmliZScsICdsb2FkIGNhcHRpb25zJ10sIHByb2dyZXNzUGF0dGVybjogL1RyYWNrIChcXGQrKVxcLyhcXGQrKS8sIHdhaXRQYXR0ZXJuOiAvV2FpdGluZyBmb3IgdGhlIHNwZWVjaC10by10ZXh0IG1vZGVsL30sXG4gIHtsYWJlbDogJ1NwZWFrZXJzJywgICAgICAgc3RhZ2U6ICdzcGVha2VycycsICAgICAgIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzcGVha2VycyddLCAgICBlc3RNYXRjaDogWydzcGVha2VyIGxhYmVscyddfSxcbiAge2xhYmVsOiAnR2VuZXJhdGUgQ2xpcHMnLCBzdGFnZTogJ2dlbmVyYXRlX2NsaXBzJywgcGF0dGVybnM6IFsnR2VuZXJhdGluZyBjbGlwJ119LFxuICB7bGFiZWw6ICdFbmVyZ3knLCAgICAgICAgIHN0YWdlOiAnZW5lcmd5JywgICAgICAgICBwYXR0ZXJuczogWydDb21wdXRpbmcgYXVkaW8gZW5lcmd5J10sIGVzdE1hdGNoOiBbJ2F1ZGlvIGVuZXJneSddfSxcbiAge2xhYmVsOiAnU2NlbmVzJywgICAgICAgICBzdGFnZTogJ3NjZW5lcycsICAgICAgICAgcGF0dGVybnM6IFsnRGV0ZWN0aW5nIHNjZW5lJ10sICAgICAgIGVzdE1hdGNoOiBbJ3NjZW5lIGRldGVjdGlvbiddfSxcbiAge2xhYmVsOiAnU2NvcmUnLCAgICAgICAgICBzdGFnZTogJ3Njb3JlJywgICAgICAgICAgcGF0dGVybnM6IFsnU2NvcmluZyBjbGlwcyddLCAgICAgICAgIGVzdE1hdGNoOiBbJ2xsbSBzY29yaW5nJ10sIHByb2dyZXNzUGF0dGVybjogL1Njb3JpbmcgKFxcZCspXFwvKFxcZCspL30sXG5dO1xuY29uc3QgU0NPUkVfU1RFUFMgPSBbXG4gIHtsYWJlbDogJ0VuZXJneScsICBzdGFnZTogJ2VuZXJneScsIHBhdHRlcm5zOiBbJ0NvbXB1dGluZyBhdWRpbyBlbmVyZ3knXX0sXG4gIHtsYWJlbDogJ1NjZW5lcycsICBzdGFnZTogJ3NjZW5lcycsIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzY2VuZSddfSxcbiAge2xhYmVsOiAnU2NvcmluZycsIHN0YWdlOiAnc2NvcmUnLCAgcGF0dGVybnM6IFsnU2NvcmluZyBjbGlwcyddLCBwcm9ncmVzc1BhdHRlcm46IC9TY29yaW5nIChcXGQrKVxcLyhcXGQrKS99LFxuXTtcbi8vIE1hcmtlci1kcml2ZW4gb25seSAodGhlIGFuYWx5emUtZnJhbWVzIFNTRSBlbWl0cyBubyBwcm9zZSBzdGFnZSBsaW5lcyksIHNvIHRoZXNlXG4vLyBjYXJyeSBubyBwYXR0ZXJucyAtIGp1c3QgdGhlIHR3byBAQFBST0dSRVNTIHN0YWdlcyB0aGUgdmlzaW9uIHJvdXRlIGVtaXRzLlxuY29uc3QgRlJBTUVTX1NURVBTID0gW1xuICB7bGFiZWw6ICdTYW1wbGUnLCAgIHN0YWdlOiAnZnJhbWVzX3NhbXBsZScsICAgcGF0dGVybnM6IFtdfSxcbiAge2xhYmVsOiAnRGVzY3JpYmUnLCBzdGFnZTogJ2ZyYW1lc19kZXNjcmliZScsIHBhdHRlcm5zOiBbXX0sXG5dO1xuXG4vLyBUaGUgZnVsbCBzZXQgb2Yga25vd24gQEBQUk9HUkVTUyBzdGFnZSBpZHMgLSB0aGUgSlMgbWlycm9yIG9mIHByb2dyZXNzLnB5J3Ncbi8vIFN0YWdlIGVudW0uIGZyYW1lc19zYW1wbGUvZnJhbWVzX2Rlc2NyaWJlIGRyaXZlIHRoZSBhbmFseXplLWZyYW1lcyBqb2IuIEtlcHRcbi8vIGFzIGl0cyBvd24gc2V0IChub3QgZGVyaXZlZCBmcm9tIHRoZSBzdGVwIGRlZnMpIHNvIGl0IHN0YXlzIHRoZSBjb3VwbGluZ1xuLy8gYW5jaG9yIGV2ZW4gZm9yIHN0YWdlcyB3aG9zZSBzdGVwIGRlZiBsaXZlcyBlbHNld2hlcmUuXG5jb25zdCBfUFJPR1JFU1NfUFJFRklYID0gJ0BAUFJPR1JFU1MgJztcbmNvbnN0IEpPQl9TVEFHRVMgPSBuZXcgU2V0KFtcbiAgJ2V4dHJhY3QnLCAndHJhbnNjcmliZScsICdzcGVha2VycycsICdnZW5lcmF0ZV9jbGlwcycsXG4gICdlbmVyZ3knLCAnc2NlbmVzJywgJ3Njb3JlJywgJ2ZyYW1lc19zYW1wbGUnLCAnZnJhbWVzX2Rlc2NyaWJlJyxcbl0pO1xuXG4vLyBNaXJyb3Igb2YgcHJvZ3Jlc3MucHkgcGFyc2VfcHJvZ3Jlc3M6IHJldHVybnMgdGhlIG1hcmtlciBwYXlsb2FkLCBvciBudWxsIGZvclxuLy8gYW55IG5vbi1tYXJrZXIgLyBtYWxmb3JtZWQgLyB1bmtub3duLXN0YWdlIGxpbmUgKHNvIG9yZGluYXJ5IGxvZyBvdXRwdXQgZmFsbHNcbi8vIHRocm91Z2ggdG8gdGhlIHByb3NlIGZhbGxiYWNrIHJhdGhlciB0aGFuIGJlaW5nIG1pc3JlYWQgYXMgcHJvZ3Jlc3MpLlxuZnVuY3Rpb24gcGFyc2VQcm9ncmVzcyhsaW5lKSB7XG4gIGlmICghbGluZSB8fCAhbGluZS5zdGFydHNXaXRoKF9QUk9HUkVTU19QUkVGSVgpKSByZXR1cm4gbnVsbDtcbiAgbGV0IHBheWxvYWQ7XG4gIHRyeSB7IHBheWxvYWQgPSBKU09OLnBhcnNlKGxpbmUuc2xpY2UoX1BST0dSRVNTX1BSRUZJWC5sZW5ndGgpKTsgfVxuICBjYXRjaCAoZSkgeyByZXR1cm4gbnVsbDsgfVxuICBpZiAoIXBheWxvYWQgfHwgdHlwZW9mIHBheWxvYWQgIT09ICdvYmplY3QnIHx8ICFKT0JfU1RBR0VTLmhhcyhwYXlsb2FkLnN0YWdlKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBwYXlsb2FkO1xufVxuXG4vLyBzdGVwSWR4IC0+IGEgdHJhbnNpZW50IHN0YXR1cyBtZXNzYWdlIHNob3duIGluIHBsYWNlIG9mIHRoZSBzdGVwJ3MgdGltaW5nXG4vLyBsYWJlbCAoZS5nLiBcIndhaXRpbmcgZm9yIHRoZSBzcGVlY2ggbW9kZWwgdG8gZmluaXNoIGRvd25sb2FkaW5nXCIpLiBTZXQgd2hlbiBhXG4vLyBzdGVwJ3Mgd2FpdFBhdHRlcm4gbWF0Y2hlcywgY2xlYXJlZCB3aGVuIHRoYXQgc3RlcCByZXBvcnRzIHJlYWwgcHJvZ3Jlc3MuXG5sZXQgX3N0ZXBXYWl0aW5nTXNnID0ge307XG5sZXQgX2pvYkFjdGl2ZSAgICAgPSBmYWxzZTtcbmxldCBfYWN0aXZlSm9iQ2xlYW51cCA9IG51bGw7XG5sZXQgX2pvYlRpbWVyICAgICAgPSBudWxsO1xubGV0IF9qb2JIaWRlVGltZXIgID0gbnVsbDtcbmxldCBfam9iUGF1c2FibGUgICA9IGZhbHNlO1xubGV0IF9qb2JQYXVzZWQgICAgID0gZmFsc2U7XG5sZXQgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBudWxsO1xubGV0IF9sYXN0R3B1U3RhdGUgID0gJ3VuYXZhaWxhYmxlJztcblxuLy8gQmVzdC1lZmZvcnQgbG9va3VwIG9mIGEgcGlsbCdzIHByZS1ydW4gdGltZSBlc3RpbWF0ZSAoZnJvbSB0aGUgbGFzdFxuLy8gL2FwaS9lc3RpbWF0ZSBjYWxsLCBzYXZlZCBieSByZW5kZXJFc3RpbWF0ZSkgZm9yIHVzZSBhcyBhIGhvdmVyIHRvb2x0aXAuXG5mdW5jdGlvbiBfZXN0aW1hdGVIbXNGb3Ioc3RlcERlZikge1xuICBjb25zdCBzdGVwcyA9IEFwcFN0YXRlLmxhc3RFc3RpbWF0ZVN0ZXBzO1xuICBpZiAoIXN0ZXBzIHx8ICFzdGVwRGVmLmVzdE1hdGNoKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbWF0Y2ggPSBzdGVwcy5maW5kKGVzID0+XG4gICAgc3RlcERlZi5lc3RNYXRjaC5zb21lKGtleSA9PiAoZXMubmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrZXkpKVxuICApO1xuICByZXR1cm4gbWF0Y2ggPyBtYXRjaC5obXMgOiBudWxsO1xufVxuXG4vLyBQZXItaXRlbSBidXR0b25zIHRoYXQgdHJpZ2dlciBhIGhlYXZ5IG9wIGFyZSB0YWdnZWQgZGF0YS1qb2ItYmxvY2tlZC4gRGlzYWJsZVxuLy8gdGhlbSAod2l0aCBhIHdoeS10b29sdGlwKSB3aGlsZSBhbnkgam9iIHJ1bnMgc28gYSB1c2VyIGNhbid0IHN0YXJ0IGEgc2Vjb25kIGpvYlxuLy8gdGhlIGJhY2tlbmQgd291bGQganVzdCA0MDkuIFRoZSBoZWFkZXIgI2J0bi1hbmFseXplIGlzIGhhbmRsZWQgaW5saW5lIGJlbG93LlxuLy8gcmVuZGVyRGV0YWlsIGNhbGxzIGFwcGx5Sm9iQmxvY2tlZFN0YXRlKCkgc28gYSBwYW5lbCByZWJ1aWx0IG1pZC1qb2IgY29tZXMgdXBcbi8vIGFscmVhZHkgZGlzYWJsZWQgLSB0aGUgdGFnIGxpdmVzIGluIGZyZXNobHktYnVpbHQgaW5uZXJIVE1MLCBub3QgYSBsaXZlIG5vZGUuXG5mdW5jdGlvbiBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnMoZGlzYWJsZWQpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtam9iLWJsb2NrZWRdJykuZm9yRWFjaChiID0+IHtcbiAgICBiLmRpc2FibGVkID0gZGlzYWJsZWQ7XG4gICAgYi50aXRsZSA9IGRpc2FibGVkID8gJ0Fub3RoZXIgam9iIGlzIHJ1bm5pbmcgLSB3YWl0IGZvciBpdCB0byBmaW5pc2ggb3IgY2FuY2VsIGl0JyA6ICcnO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gYXBwbHlKb2JCbG9ja2VkU3RhdGUoKSB7IF9zZXRKb2JCbG9ja2VkQnV0dG9ucyhfam9iQWN0aXZlKTsgfVxuXG5mdW5jdGlvbiBzdGFydEpvYlVJKHN0ZXBEZWZzLCBqb2JMYWJlbCwgY2FuY2VsbGFibGUgPSBmYWxzZSwgcGF1c2FibGUgPSBmYWxzZSkge1xuICBfam9iQWN0aXZlICAgICA9IHRydWU7XG4gIF9qb2JTdGVwRGVmcyAgID0gc3RlcERlZnM7XG4gIF9hY3RpdmVTdGVwSWR4ID0gLTE7XG4gIF9qb2JTdGFydFRpbWUgID0gRGF0ZS5ub3coKTtcbiAgX3N0ZXBTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICBfc3RlcFByb2dyZXNzICA9IHt9O1xuICBfc3RlcFJhdGVBbmNob3IgPSB7fTtcbiAgX3N0ZXBXYWl0aW5nTXNnID0ge307XG4gIF9qb2JQYXVzYWJsZSAgID0gcGF1c2FibGU7XG4gIF9qb2JQYXVzZWQgICAgID0gZmFsc2U7XG4gIF9hY3RpdmVDYW5jZWwgID0gX0FOQUxZWkVfQ0FOQ0VMO1xuICBpZiAoX2pvYlRpbWVyKSBjbGVhckludGVydmFsKF9qb2JUaW1lcik7XG4gIF9qb2JUaW1lciA9IHNldEludGVydmFsKF90aWNrSm9iVGltZXIsIDEwMDApO1xuICBpZiAoX2pvYkhpZGVUaW1lcikgeyBjbGVhclRpbWVvdXQoX2pvYkhpZGVUaW1lcik7IF9qb2JIaWRlVGltZXIgPSBudWxsOyB9XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2Itc3RlcHMnKS5pbm5lckhUTUwgPVxuICAgIGA8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tcmlnaHQ6NHB4XCI+JHtlc2NIdG1sKGpvYkxhYmVsKX08L3NwYW4+YCArXG4gICAgc3RlcERlZnMubWFwKChzLCBpKSA9PiB7XG4gICAgICBjb25zdCBlc3QgPSBfZXN0aW1hdGVIbXNGb3Iocyk7XG4gICAgICBjb25zdCB0aXRsZSA9IGVzdCA/IGAgdGl0bGU9XCJFc3RpbWF0ZWQ6ICR7ZXNjSHRtbChlc3QpfVwiYCA6ICcnO1xuICAgICAgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInN0ZXBcIiBpZD1cInN0ZXAtJHtpfVwiJHt0aXRsZX0+JHtzLmxhYmVsfTwvc3Bhbj5gO1xuICAgIH0pLmpvaW4oJycpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXN0YXR1cycpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlYWRlci1zcGFjZXInKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjYnRuLWFuYWx5emUsI2J0bi1zY29yZScpLmZvckVhY2goYiA9PiBiLmRpc2FibGVkID0gdHJ1ZSk7XG4gIGNvbnN0IGFuYWx5emVCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWFuYWx5emUnKTtcbiAgaWYgKGFuYWx5emVCdG4pIGFuYWx5emVCdG4udGl0bGUgPSAnQSBqb2IgaXMgYWxyZWFkeSBydW5uaW5nJztcbiAgX3NldEpvYkJsb2NrZWRCdXR0b25zKHRydWUpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNhbmNlbC1qb2InKS5zdHlsZS5kaXNwbGF5ID0gY2FuY2VsbGFibGUgPyAnJyA6ICdub25lJztcbiAgX3JlbmRlclBhdXNlVUkoKTtcbiAgaWYgKF9qb2JUaGVybWFsUG9sbFRpbWVyKSBjbGVhckludGVydmFsKF9qb2JUaGVybWFsUG9sbFRpbWVyKTtcbiAgaWYgKHBhdXNhYmxlKSB7XG4gICAgX2xhc3RHcHVTdGF0ZSA9ICd1bmF2YWlsYWJsZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1ncHUtdGVtcCcpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgX3BvbGxUaGVybWFsU3RhdHVzKCk7XG4gICAgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBzZXRJbnRlcnZhbChfcG9sbFRoZXJtYWxTdGF0dXMsIDUwMDApO1xuICB9XG4gIGlmICh3aW5kb3cuX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMpIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCk7XG59XG5cbi8vIFBvbGxlZCBldmVyeSA1cyAob25seSB3aGlsZSBhIHBhdXNhYmxlIC0gaS5lLiBhbmFseXplLXR5cGUgLSBqb2IgaXMgYWN0aXZlKSB0b1xuLy8gZHJpdmUgdGhlIGpvYi1oZWFkZXIgR1BVIHRlbXBlcmF0dXJlIHJlYWRvdXQgYW5kIHRoZSB3YXJuL2F1dG8tcGF1c2Ugbm90aWNlcy5cbi8vIFVzZXMgL2FwaS9zdGF0dXMgcmF0aGVyIHRoYW4gU1NFIGxvZy1saW5lIG1hdGNoaW5nIHNvIGl0IGFsc28gd29ya3MgY29ycmVjdGx5XG4vLyBhY3Jvc3MgdGhlIEpTIHNlcXVlbnRpYWwtc2VnbWVudCBydW5uZXJzJyBnYXBzIGJldHdlZW4gcGVyLXNlZ21lbnQgam9icy5cbmFzeW5jIGZ1bmN0aW9uIF9wb2xsVGhlcm1hbFN0YXR1cygpIHtcbiAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZmV0Y2goJy9hcGkvc3RhdHVzJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgaWYgKCFzdGF0dXMpIHJldHVybjtcbiAgY29uc3QgcmVhZG91dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItZ3B1LXRlbXAnKTtcbiAgaWYgKHJlYWRvdXQpIHtcbiAgICBpZiAoc3RhdHVzLmdwdV90ZW1wX2MgPT0gbnVsbCkge1xuICAgICAgcmVhZG91dC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWFkb3V0LnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICAgIHJlYWRvdXQuY2xhc3NOYW1lID0gJ2dwdS10ZW1wLXJlYWRvdXQnICsgKHN0YXR1cy5ncHVfc3RhdGUgPT09ICdvaycgPyAnJyA6IGAgJHtzdGF0dXMuZ3B1X3N0YXRlfWApO1xuICAgICAgcmVhZG91dC50ZXh0Q29udGVudCA9IGBHUFUgJHtNYXRoLnJvdW5kKHN0YXR1cy5ncHVfdGVtcF9jKX3CsENgO1xuICAgIH1cbiAgfVxuICBpZiAoc3RhdHVzLmdwdV9zdGF0ZSA9PT0gJ3dhcm4nICYmIF9sYXN0R3B1U3RhdGUgIT09ICd3YXJuJyAmJiBfbGFzdEdwdVN0YXRlICE9PSAncGF1c2UnKSB7XG4gICAgY29uc3QgbmV4dCA9IHN0YXR1cy50aGVybWFsX2F1dG9wYXVzZV9lbmFibGVkXG4gICAgICA/IGBBbmFseXNpcyB3aWxsIGF1dG8tcGF1c2UgaWYgaXQgcmVhY2hlcyAke01hdGgucm91bmQoc3RhdHVzLnRoZXJtYWxfcGF1c2VfYyl9wrBDLmBcbiAgICAgIDogYEF1dG8tcGF1c2UgaXMgb2ZmIC0gcGF1c2UgdGhlIGpvYiBtYW51YWxseSBpZiBpdCBrZWVwcyBjbGltYmluZy5gO1xuICAgIHdpbmRvdy5zaG93VG9hc3QoYEdQVSBydW5uaW5nIGhvdCAtICR7TWF0aC5yb3VuZChzdGF0dXMuZ3B1X3RlbXBfYyl9wrBDLiAke25leHR9YCwgJ3dhcm5pbmcnKTtcbiAgfVxuICBpZiAoc3RhdHVzLmdwdV9zdGF0ZSA9PT0gJ3BhdXNlJyAmJiBfbGFzdEdwdVN0YXRlICE9PSAncGF1c2UnKSB7XG4gICAgX2pvYlBhdXNlZCA9IHRydWU7XG4gICAgX3JlbmRlclBhdXNlVUkoKTtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KGBBdXRvLXBhdXNlZDogR1BVIHJlYWNoZWQgJHtNYXRoLnJvdW5kKHN0YXR1cy5ncHVfdGVtcF9jKX3CsEMgLSB3aWxsIGhvbGQgYmVmb3JlIHRoZSBuZXh0IHZpZGVvYCwgJ3dhcm5pbmcnLCB7XG4gICAgICBkdXJhdGlvbk1zOiAyMDAwMCxcbiAgICAgIGFjdGlvbjoge2xhYmVsOiAnUmVzdW1lIG5vdycsIG9uQ2xpY2s6IHRvZ2dsZVBhdXNlSm9ifSxcbiAgICB9KTtcbiAgfVxuICBfbGFzdEdwdVN0YXRlID0gc3RhdHVzLmdwdV9zdGF0ZTtcbn1cblxuLy8gXCJQYXVzZSBhZnRlciBjdXJyZW50IHZpZGVvXCIgdG9nZ2xlIGluIHRoZSBqb2IgaGVhZGVyIC0gb25seSBzaG93biBmb3Igam9ic1xuLy8gYmFja2VkIGJ5IHRoZSBwYXVzZSBmbGFnIGZpbGUgKHRoZSBzaW5nbGUgYW5hbHl6ZSBzdHJlYW0gYW5kIHRoZSBKU1xuLy8gc2VxdWVudGlhbC1zZWdtZW50IHJ1bm5lcnM7IHNlZSB0b2dnbGVQYXVzZUpvYikuXG5mdW5jdGlvbiBfcmVuZGVyUGF1c2VVSSgpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1wYXVzZS1qb2InKTtcbiAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXBhdXNlZC1iYWRnZScpO1xuICBpZiAoIWJ0biB8fCAhYmFkZ2UpIHJldHVybjtcbiAgYnRuLnN0eWxlLmRpc3BsYXkgPSBfam9iUGF1c2FibGUgPyAnJyA6ICdub25lJztcbiAgYnRuLnRleHRDb250ZW50ID0gX2pvYlBhdXNlZCA/ICdSZXN1bWUnIDogJ1BhdXNlIGFmdGVyIGN1cnJlbnQgdmlkZW8nO1xuICBiYWRnZS5zdHlsZS5kaXNwbGF5ID0gX2pvYlBhdXNlZCA/ICcnIDogJ25vbmUnO1xufVxuXG4vLyBSZWZsZWN0cyBhbiBhbHJlYWR5LXBhdXNlZCBqb2IgZGlzY292ZXJlZCB2aWEgL2FwaS9zdGF0dXMgKHBhZ2UgcmVjb25uZWN0KSAtXG4vLyBkb2VzIG5vdCBpdHNlbGYgY2FsbCB0aGUgcGF1c2UvcmVzdW1lIEFQSS5cbmZ1bmN0aW9uIF9zZXRQYXVzZWRVSUZyb21TdGF0dXMocGF1c2VkKSB7XG4gIF9qb2JQYXVzZWQgPSAhIXBhdXNlZDtcbiAgX3JlbmRlclBhdXNlVUkoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdG9nZ2xlUGF1c2VKb2IoKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tcGF1c2Utam9iJyk7XG4gIGNvbnN0IHdhbnRQYXVzZSA9ICFfam9iUGF1c2VkO1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2FuYWx5emUvJHt3YW50UGF1c2UgPyAncGF1c2UnIDogJ3Jlc3VtZSd9YCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIHdpbmRvdy5zaG93VG9hc3QoZm9ybWF0QXBpRXJyb3IoZGF0YSkgfHwgYENvdWxkIG5vdCAke3dhbnRQYXVzZSA/ICdwYXVzZScgOiAncmVzdW1lJ31gLCAnZXJyb3InKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGRhdGEuc3RhdHVzID09PSAnbm8tb3AnKSB7XG4gICAgICB3aW5kb3cuc2hvd1RvYXN0KGRhdGEubWVzc2FnZSB8fCAnTm8gYW5hbHlzaXMgaXMgcnVubmluZy4nLCAnaW5mbycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBfam9iUGF1c2VkID0gd2FudFBhdXNlO1xuICAgIF9yZW5kZXJQYXVzZVVJKCk7XG4gICAgd2luZG93LnNob3dUb2FzdCh3YW50UGF1c2UgPyAnV2lsbCBwYXVzZSBiZWZvcmUgdGhlIG5leHQgdmlkZW8nIDogJ1Jlc3VtZWQnLCAnaW5mbycpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KHdpbmRvdy5uZXRFcnJNc2coZXJyKSwgJ2Vycm9yJyk7XG4gIH0gZmluYWxseSB7XG4gICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIH1cbn1cblxuLy8gTWFyayBzdGVwICppZHgqIGFjdGl2ZSBhbmQgZXZlcnkgZWFybGllciBzdGVwIGRvbmUuIFNoYXJlZCBieSB0aGUgcHJvc2Vcbi8vIG1hdGNoZXIgKHVwZGF0ZUpvYlVJKSBhbmQgdGhlIG1hcmtlciBwYXRoIChfZHJpdmVTdGVwRnJvbU1hcmtlcikgc28gYSBzdGFnZVxuLy8gYWR2YW5jZSBiZWhhdmVzIGlkZW50aWNhbGx5IGhvd2V2ZXIgaXQgd2FzIGRldGVjdGVkLlxuZnVuY3Rpb24gX2FjdGl2YXRlU3RlcChpZHgpIHtcbiAgY29uc3QgcHJldlN0ZXBJZHggPSBfYWN0aXZlU3RlcElkeDtcbiAgZm9yIChsZXQgaiA9IDA7IGogPCBpZHg7IGorKykge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtqfWApO1xuICAgIGlmIChlbCkgeyBlbC5jbGFzc05hbWUgPSAnc3RlcCBkb25lJzsgZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7IGVsLnRleHRDb250ZW50ID0gJ+Kckyc7IGVsLnRpdGxlID0gX2pvYlN0ZXBEZWZzW2pdLmxhYmVsOyB9XG4gIH1cbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2lkeH1gKTtcbiAgaWYgKGVsKSB7IGVsLmNsYXNzTmFtZSA9ICdzdGVwIGFjdGl2ZSc7IF9hY3RpdmVTdGVwSWR4ID0gaWR4OyB9XG4gIGlmIChfYWN0aXZlU3RlcElkeCAhPT0gcHJldlN0ZXBJZHgpIHtcbiAgICBfc3RlcFN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgLy8gV2hlbiB0aGUgcGlwZWxpbmUgYWR2YW5jZXMgYSBzdGFnZSwgcmVmcmVzaCB0aGUgc2lkZWJhciBzbyBhIG5ld2x5LWFuYWx5emluZ1xuICAgIC8vIHJlY29yZGluZyBhcHBlYXJzIChyZXBsYWNpbmcgaXRzIHBsYWNlaG9sZGVyKSBhbmQgaXRzIHN0YXR1cyBzdGF5cyBjdXJyZW50LFxuICAgIC8vIGFuZCByZWZyZXNoIHRoZSBvcGVuIGNsaXAgbGlzdCB0byBwaWNrIHVwIGZyZXNobHktY29tbWl0dGVkIGNsaXBzL3Njb3Jlcy5cbiAgICBfZGVib3VuY2VkU2lkZWJhclJlZnJlc2goKTtcbiAgICBfZGVib3VuY2VkQ2xpcExpc3RSZWZyZXNoKCk7XG4gIH1cbn1cblxuLy8gUmVjb3JkIGEgc3RlcCdzIGN1cnJlbnQvdG90YWwsIGFuY2hvcmluZyB0aGUgdGhyb3VnaHB1dCByYXRlIGF0IHRoZSBmaXJzdFxuLy8gb2JzZXJ2ZWQgY291bnQgc28gYSBjb2xkIGZpcnN0IGl0ZW0gaXMgZXhjbHVkZWQgZnJvbSB0aGUgRVRBIGV4dHJhcG9sYXRpb24uXG5mdW5jdGlvbiBfc2V0U3RlcFByb2dyZXNzKGlkeCwgY3VycmVudCwgdG90YWwpIHtcbiAgLy8gUmVhbCBwcm9ncmVzcyBtZWFucyBhbnkgd2FpdCAoZS5nLiBtb2RlbCBkb3dubG9hZCkgaXMgb3ZlciAtIGRyb3AgaXQgc28gdGhlXG4gIC8vIHBpbGwgc3dpdGNoZXMgYmFjayB0byBsaXZlIGNvdW50cy5cbiAgZGVsZXRlIF9zdGVwV2FpdGluZ01zZ1tpZHhdO1xuICBfc3RlcFByb2dyZXNzW2lkeF0gPSB7Y3VycmVudCwgdG90YWx9O1xuICBpZiAoIV9zdGVwUmF0ZUFuY2hvcltpZHhdKSBfc3RlcFJhdGVBbmNob3JbaWR4XSA9IHt0OiBEYXRlLm5vdygpLCBjdXJyZW50fTtcbiAgX3JlbmRlclN0ZXBQaWxsKGlkeCk7XG4gIF9kZWJvdW5jZWRDbGlwTGlzdFJlZnJlc2goKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlSm9iVUkobGluZSkge1xuICBfam9iU3RlcERlZnMuZm9yRWFjaCgocywgaSkgPT4ge1xuICAgIGlmIChzLnBhdHRlcm5zLnNvbWUocCA9PiBsaW5lLmluY2x1ZGVzKHApKSkgX2FjdGl2YXRlU3RlcChpKTtcbiAgfSk7XG4gIGNvbnN0IGFjdGl2ZURlZiA9IF9qb2JTdGVwRGVmc1tfYWN0aXZlU3RlcElkeF07XG4gIGlmIChhY3RpdmVEZWYgJiYgYWN0aXZlRGVmLndhaXRQYXR0ZXJuICYmIGFjdGl2ZURlZi53YWl0UGF0dGVybi50ZXN0KGxpbmUpKSB7XG4gICAgX3N0ZXBXYWl0aW5nTXNnW19hY3RpdmVTdGVwSWR4XSA9ICd3YWl0aW5nIGZvciB0aGUgc3BlZWNoIG1vZGVsIHRvIGZpbmlzaCBkb3dubG9hZGluZyc7XG4gICAgX3JlbmRlclN0ZXBQaWxsKF9hY3RpdmVTdGVwSWR4KTtcbiAgfVxuICBpZiAoYWN0aXZlRGVmICYmIGFjdGl2ZURlZi5wcm9ncmVzc1BhdHRlcm4pIHtcbiAgICBjb25zdCBtID0gbGluZS5tYXRjaChhY3RpdmVEZWYucHJvZ3Jlc3NQYXR0ZXJuKTtcbiAgICBpZiAobSkgX3NldFN0ZXBQcm9ncmVzcyhfYWN0aXZlU3RlcElkeCwgcGFyc2VJbnQobVsxXSwgMTApLCBwYXJzZUludChtWzJdLCAxMCkpO1xuICB9XG4gIGlmICh3aW5kb3cuX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpO1xufVxuXG4vLyBEcml2ZSB0aGUgcGlsbCByb3cgZnJvbSBhIHBhcnNlZCBAQFBST0dSRVNTIG1hcmtlcjogZGV0ZXJtaW5pc3RpYyBzdGFnZVxuLy8gYWR2YW5jZSBwbHVzIG9wdGlvbmFsIGN1cnJlbnQvdG90YWwsIGtleWVkIG9uIHRoZSBzdGVwIGRlZidzIHN0YWdlIGlkLlxuZnVuY3Rpb24gX2RyaXZlU3RlcEZyb21NYXJrZXIobWFya2VyKSB7XG4gIGNvbnN0IGlkeCA9IF9qb2JTdGVwRGVmcy5maW5kSW5kZXgocyA9PiBzLnN0YWdlID09PSBtYXJrZXIuc3RhZ2UpO1xuICBpZiAoaWR4IDwgMCkgcmV0dXJuO1xuICBfYWN0aXZhdGVTdGVwKGlkeCk7XG4gIGlmICh0eXBlb2YgbWFya2VyLmRvbmUgPT09ICdudW1iZXInICYmIHR5cGVvZiBtYXJrZXIudG90YWwgPT09ICdudW1iZXInICYmIG1hcmtlci50b3RhbCA+IDApIHtcbiAgICBfc2V0U3RlcFByb2dyZXNzKGlkeCwgbWFya2VyLmRvbmUsIG1hcmtlci50b3RhbCk7XG4gIH1cbiAgaWYgKHdpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCk7XG59XG5cbmxldCBfc2lkZWJhclJlZnJlc2hUaW1lciA9IG51bGw7XG5mdW5jdGlvbiBfZGVib3VuY2VkU2lkZWJhclJlZnJlc2goKSB7XG4gIGlmIChfc2lkZWJhclJlZnJlc2hUaW1lcikgcmV0dXJuO1xuICBfc2lkZWJhclJlZnJlc2hUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4geyBfc2lkZWJhclJlZnJlc2hUaW1lciA9IG51bGw7IHdpbmRvdy5sb2FkVmlkZW9zKCk7IH0sIDEyMDApO1xufVxuXG5sZXQgX2NsaXBMaXN0UmVmcmVzaFRpbWVyID0gbnVsbDtcbi8vIFNhbWUgcHVzaC1kcml2ZW4tYnV0LWRlYm91bmNlZCBwYXR0ZXJuIGFzIF9kZWJvdW5jZWRTaWRlYmFyUmVmcmVzaCBhYm92ZSxcbi8vIHRyaWdnZXJlZCBvZmYgdGhlIFNTRSBsaW5lIHN0cmVhbSByYXRoZXIgdGhhbiBhIHBvbGxpbmcgdGltZXIuIE9ubHkgcmVmcmVzaGVzXG4vLyB3aGVuIHRoZSB2aWRlbyBiZWluZyBhbmFseXplZCBpcyB0aGUgb25lIGN1cnJlbnRseSBvcGVuLCBzbyBuZXdseS1jb21taXR0ZWRcbi8vIGNsaXAgc2NvcmVzICh5dXVfY2xpcC9zY29yaW5nL2VuZ2luZS5weSBub3cgY29tbWl0cyBwZXIgY2xpcCkgZmlsbCBpbnRvIHRoZVxuLy8gdmlzaWJsZSBsaXN0IGxpdmUgaW5zdGVhZCBvZiByZXF1aXJpbmcgYSBtYW51YWwgcGFnZSByZWZyZXNoLlxuZnVuY3Rpb24gX2RlYm91bmNlZENsaXBMaXN0UmVmcmVzaCgpIHtcbiAgaWYgKF9jbGlwTGlzdFJlZnJlc2hUaW1lcikgcmV0dXJuO1xuICBfY2xpcExpc3RSZWZyZXNoVGltZXIgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICBfY2xpcExpc3RSZWZyZXNoVGltZXIgPSBudWxsO1xuICAgIGlmICghQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCB8fCAhQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lKSByZXR1cm47XG4gICAgY29uc3QgYW5hbHl6aW5nID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmZpbGVuYW1lID09PSBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUpO1xuICAgIGlmICghYW5hbHl6aW5nIHx8IGFuYWx5emluZy5pZCAhPT0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkgcmV0dXJuO1xuICAgIEFwcFN0YXRlLmNsaXBzID0gYXdhaXQgZmV0Y2god2luZG93Ll9jbGlwc0xpc3RVcmwoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gICAgd2luZG93Ll9yZW5kZXJDbGlwcygpO1xuICB9LCAxMjAwKTtcbn1cblxuLy8gQnVpbGRzIHRoZSBsaXZlIGxhYmVsIGZvciBhIHN0ZXAgcGlsbDogXCJTY29yZSDCtyAzLzEyICgyNSUpIMK3IDA6NDIgKH4yOjA2XG4vLyBsZWZ0KVwiIG9uY2UgcGVyLWl0ZW0gY291bnRzIGFycml2ZSBmcm9tIHRoZSBzdWJwcm9jZXNzIGxvZzsgZWxhcHNlZC1vbmx5XG4vLyAoZmFsbGluZyBiYWNrIHRvIHRoZSBwcmUtcnVuIC9hcGkvZXN0aW1hdGUgZmlndXJlKSBiZWZvcmUgdGhlIGZpcnN0IGNvdW50LlxuZnVuY3Rpb24gX3N0ZXBQaWxsTGFiZWwoaWR4KSB7XG4gIGNvbnN0IGRlZiA9IF9qb2JTdGVwRGVmc1tpZHhdO1xuICBpZiAoIWRlZikgcmV0dXJuIHt0ZXh0OiAnJywgcGN0OiBudWxsfTtcbiAgY29uc3Qgd2FpdGluZyA9IF9zdGVwV2FpdGluZ01zZ1tpZHhdO1xuICBpZiAod2FpdGluZykgcmV0dXJuIHt0ZXh0OiBgJHtkZWYubGFiZWx9IMK3ICR7d2FpdGluZ31gLCBwY3Q6IG51bGx9O1xuICBjb25zdCBlbGFwc2VkTXMgPSBEYXRlLm5vdygpIC0gX3N0ZXBTdGFydFRpbWU7XG4gIGNvbnN0IHByb2dyZXNzICA9IF9zdGVwUHJvZ3Jlc3NbaWR4XTtcbiAgaWYgKCFwcm9ncmVzcyB8fCAhcHJvZ3Jlc3MuY3VycmVudCkge1xuICAgIGNvbnN0IGVzdCA9IF9lc3RpbWF0ZUhtc0ZvcihkZWYpO1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0OiBlc3QgPyBgJHtkZWYubGFiZWx9IMK3ICR7X2ZtdEVsYXBzZWQoZWxhcHNlZE1zKX0gKH4ke2VzdH0pYCA6IGAke2RlZi5sYWJlbH0gwrcgJHtfZm10RWxhcHNlZChlbGFwc2VkTXMpfWAsXG4gICAgICBwY3Q6IG51bGwsXG4gICAgfTtcbiAgfVxuICBjb25zdCB7Y3VycmVudCwgdG90YWx9ID0gcHJvZ3Jlc3M7XG4gIGNvbnN0IHBjdCAgICA9IE1hdGgucm91bmQoY3VycmVudCAvIHRvdGFsICogMTAwKTtcbiAgLy8gRVRBIGZyb20gdGhyb3VnaHB1dCBzaW5jZSB0aGUgcmF0ZSBhbmNob3IgKGZpcnN0IG9ic2VydmVkIGNvdW50KSwgbm90IGZyb21cbiAgLy8gZWxhcHNlZC9jdXJyZW50IC0gdGhlIGxhdHRlciBsZXQgYSBzbG93IGNvbGQgZmlyc3QgaXRlbSBwcm9qZWN0IGFic3VyZFxuICAvLyBmaWd1cmVzIChlLmcuIFwiNzcgbWluIGxlZnRcIiB0aGF0IHZhbmlzaGVkIHdoZW4gdGhlIHN0ZXAgZmluaXNoZWQgc2Vjb25kcyBsYXRlcikuXG4gIGNvbnN0IGFuY2hvciA9IF9zdGVwUmF0ZUFuY2hvcltpZHhdO1xuICBsZXQgZXRhID0gJyc7XG4gIGlmIChhbmNob3IgJiYgY3VycmVudCA+IGFuY2hvci5jdXJyZW50KSB7XG4gICAgY29uc3QgbXNQZXJJdGVtID0gKERhdGUubm93KCkgLSBhbmNob3IudCkgLyAoY3VycmVudCAtIGFuY2hvci5jdXJyZW50KTtcbiAgICBjb25zdCByZW1haW5pbmdNcyA9IG1zUGVySXRlbSAqICh0b3RhbCAtIGN1cnJlbnQpO1xuICAgIGlmIChpc0Zpbml0ZShyZW1haW5pbmdNcykgJiYgcmVtYWluaW5nTXMgPj0gMCkgZXRhID0gYCAofiR7X2ZtdEVsYXBzZWQocmVtYWluaW5nTXMpfSBsZWZ0KWA7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB0ZXh0OiBgJHtkZWYubGFiZWx9IMK3ICR7Y3VycmVudH0vJHt0b3RhbH0gKCR7cGN0fSUpIMK3ICR7X2ZtdEVsYXBzZWQoZWxhcHNlZE1zKX0ke2V0YX1gLFxuICAgIHBjdCxcbiAgfTtcbn1cblxuLy8gUGFpbnRzIG9uZSBzdGVwIHBpbGwncyB0ZXh0IGFuZCwgZm9yIGFuIGluLXByb2dyZXNzIHN0ZXAgd2l0aCBrbm93biBjb3VudHMsXG4vLyBhIHR3by10b25lIGdyYWRpZW50IGZpbGwgc3RhbmRpbmcgaW4gZm9yIGEgcHJvZ3Jlc3MgYmFyIChkb25lL3BlbmRpbmcgcGlsbHNcbi8vIGtlZXAgdGhlaXIgZmxhdCBDU1MgY2xhc3MgY29sb3IgLSBubyBmaWxsKS4gU2hhcmVkIGJ5IHRoZSBoZWFkZXIgcGlsbCByb3dcbi8vIGFuZCAodmlhIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIHRoZSBpbi1kZXRhaWwgbWlycm9yIHBhbmVsLlxuZnVuY3Rpb24gX3JlbmRlclN0ZXBQaWxsKGlkeCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7aWR4fWApO1xuICBpZiAoIWVsIHx8ICFlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGl2ZScpKSByZXR1cm47XG4gIGNvbnN0IHt0ZXh0LCBwY3R9ID0gX3N0ZXBQaWxsTGFiZWwoaWR4KTtcbiAgZWwudGV4dENvbnRlbnQgPSB0ZXh0O1xuICBlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBwY3QgIT0gbnVsbFxuICAgID8gYGxpbmVhci1ncmFkaWVudCh0byByaWdodCwgdmFyKC0tZ3JlZW4pICR7cGN0fSUsIHZhcigtLWFjY2VudCkgJHtwY3R9JSlgXG4gICAgOiAnJztcbn1cblxuZnVuY3Rpb24gX3RpY2tKb2JUaW1lcigpIHtcbiAgaWYgKHdpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCk7XG4gIGlmIChfYWN0aXZlU3RlcElkeCA8IDApIHJldHVybjtcbiAgX3JlbmRlclN0ZXBQaWxsKF9hY3RpdmVTdGVwSWR4KTtcbn1cblxuZnVuY3Rpb24gZW5kSm9iVUkoKSB7XG4gIGlmIChfam9iVGltZXIpIHsgY2xlYXJJbnRlcnZhbChfam9iVGltZXIpOyBfam9iVGltZXIgPSBudWxsOyB9XG4gIF9qb2JTdGVwRGVmcy5mb3JFYWNoKChzLCBpKSA9PiB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2l9YCk7XG4gICAgaWYgKGVsKSB7IGVsLmNsYXNzTmFtZSA9ICdzdGVwIGRvbmUnOyBlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnJzsgZWwudGV4dENvbnRlbnQgPSAn4pyTJzsgZWwudGl0bGUgPSBzLmxhYmVsOyB9XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNhbmNlbC1qb2InKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBfam9iUGF1c2FibGUgPSBmYWxzZTtcbiAgX2pvYlBhdXNlZCAgID0gZmFsc2U7XG4gIF9yZW5kZXJQYXVzZVVJKCk7XG4gIGlmIChfam9iVGhlcm1hbFBvbGxUaW1lcikgeyBjbGVhckludGVydmFsKF9qb2JUaGVybWFsUG9sbFRpbWVyKTsgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBudWxsOyB9XG4gIGNvbnN0IGdwdVRlbXAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWdwdS10ZW1wJyk7XG4gIGlmIChncHVUZW1wKSBncHVUZW1wLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIF9qb2JBY3RpdmUgPSBmYWxzZTtcbiAgX2pvYkhpZGVUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIF9qb2JIaWRlVGltZXIgPSBudWxsO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2Itc3RhdHVzJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWFkZXItc3BhY2VyJykuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyNidG4tYW5hbHl6ZSwjYnRuLXNjb3JlJykuZm9yRWFjaChiID0+IGIuZGlzYWJsZWQgPSBmYWxzZSk7XG4gICAgY29uc3QgYW5hbHl6ZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tYW5hbHl6ZScpO1xuICAgIGlmIChhbmFseXplQnRuKSBhbmFseXplQnRuLnRpdGxlID0gJyc7XG4gICAgX3NldEpvYkJsb2NrZWRCdXR0b25zKGZhbHNlKTtcbiAgICBjb25zdCB0b3RhbEFwcHJvdmVkID0gKEFwcFN0YXRlLnZpZGVvcyB8fCBbXSkucmVkdWNlKChuLCB2KSA9PiBuICsgdi5hcHByb3ZlZCwgMCk7XG4gICAgd2luZG93Ll91cGRhdGVEZW1vQnV0dG9uKHRvdGFsQXBwcm92ZWQpO1xuICAgIGlmICh3aW5kb3cuX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMpIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCk7XG4gIH0sIDIwMDApO1xufVxuXG4vLyDilIDilIAgU1NFIHRyYW5zcG9ydCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIExvdy1sZXZlbCBTU0UgcmVhZGVyIHVzaW5nIGZldGNoICsgUmVhZGFibGVTdHJlYW0gc28gbm9uLTIwMCBIVFRQIHJlc3BvbnNlc1xuLy8gY2FuIGJlIHJlYWQgZm9yIHRoZWlyIGVycm9yIGRldGFpbCAoRXZlbnRTb3VyY2Uub25lcnJvciBjYW5ub3QgZG8gdGhpcykuXG4vL1xuLy8gb25MaW5lKG1zZykgIC0gY2FsbGVkIGZvciBlYWNoIHBhcnNlZCBTU0UgcGF5bG9hZCBiZWZvcmUgX19ET05FX19cbi8vIG9uRG9uZShtc2cpICAtIGNhbGxlZCB3aXRoIHRoZSBmdWxsIF9fRE9ORV9fIHBheWxvYWQgKHN0cmluZyBvciBvYmplY3QpXG4vLyBvbkVycm9yKHN0cikgLSBjYWxsZWQgd2l0aCBhIHBsYWluLWxhbmd1YWdlIG1lc3NhZ2Ugb24gSFRUUCBlcnJvciBvciBuZXR3b3JrIGxvc3Ncbi8vXG4vLyBvcHRzIChvcHRpb25hbCk6IGV4dHJhIGZldGNoIGluaXQsIGUuZy4ge21ldGhvZDogJ1BPU1QnfSBmb3IgdGhlIG1vZGVsLWRvd25sb2FkXG4vLyBlbmRwb2ludHMsIHdoaWNoIGFyZSBQT1NULW9ubHkgKGEgR0VUIDQwNXMpLiBEZWZhdWx0cyB0byBhIEdFVCwgYXMgdGhlIGFuYWx5emVcbi8vIGFuZCBzY29yZSBTU0Ugc3RyZWFtcyB1c2UuXG4vLyBSZXR1cm5zIGEgaGFuZGxlIHdpdGggLmNsb3NlKCkgdGhhdCBhYm9ydHMgdGhlIGluLWZsaWdodCByZXF1ZXN0LlxuZnVuY3Rpb24gX29wZW5TU0UodXJsLCBvbkxpbmUsIG9uRG9uZSwgb25FcnJvciwgb3B0cyA9IHt9KSB7XG4gIGNvbnN0IGN0cmwgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIGNvbnN0IGhhbmRsZSA9IHtjbG9zZTogKCkgPT4gY3RybC5hYm9ydCgpfTtcbiAgZmV0Y2godXJsLCB7c2lnbmFsOiBjdHJsLnNpZ25hbCwgLi4ub3B0c30pLnRoZW4oYXN5bmMgcmVzID0+IHtcbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgY29uc3QgZXJyRGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgICBvbkVycm9yKGZvcm1hdEFwaUVycm9yKGVyckRhdGEpIHx8IGBTZXJ2ZXIgZXJyb3IgJHtyZXMuc3RhdHVzfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZWFkZXIgPSByZXMuYm9keS5nZXRSZWFkZXIoKTtcbiAgICBjb25zdCBkZWMgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICBsZXQgYnVmID0gJyc7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IHtkb25lLCB2YWx1ZX0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgIGlmICghY3RybC5zaWduYWwuYWJvcnRlZCkgb25FcnJvcignU3RyZWFtIGVuZGVkIHdpdGhvdXQgYSBjb21wbGV0aW9uIHNpZ25hbCcpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBidWYgKz0gZGVjLmRlY29kZSh2YWx1ZSwge3N0cmVhbTogdHJ1ZX0pO1xuICAgICAgICBjb25zdCBsaW5lcyA9IGJ1Zi5zcGxpdCgnXFxuJyk7XG4gICAgICAgIGJ1ZiA9IGxpbmVzLnBvcCgpO1xuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnZGF0YTogJykpIGNvbnRpbnVlO1xuICAgICAgICAgIGNvbnN0IG1zZyA9IEpTT04ucGFyc2UobGluZS5zbGljZSg2KSk7XG4gICAgICAgICAgY29uc3QgaXNEb25lID0gbXNnID09PSAnX19ET05FX18nIHx8IChtc2cgJiYgdHlwZW9mIG1zZyA9PT0gJ29iamVjdCcgJiYgbXNnLnR5cGUgPT09ICdfX0RPTkVfXycpO1xuICAgICAgICAgIGlmIChpc0RvbmUpIHsgb25Eb25lKG1zZyk7IHJldHVybjsgfVxuICAgICAgICAgIG9uTGluZShtc2cpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoIWN0cmwuc2lnbmFsLmFib3J0ZWQpIG9uRXJyb3IoJ0Nvbm5lY3Rpb24gbG9zdCAtIHNlcnZlciBkaXNjb25uZWN0ZWQnKTtcbiAgICB9XG4gIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgaWYgKCFjdHJsLnNpZ25hbC5hYm9ydGVkKSBvbkVycm9yKHdpbmRvdy5uZXRFcnJNc2coZXJyKSk7XG4gIH0pO1xuICByZXR1cm4gaGFuZGxlO1xufVxuXG4vLyBPbmx5IG9uZSBqb2Igc3RyZWFtIGlzIGxpdmUgYXQgYSB0aW1lLiBTdGFydGluZyBhIG5ldyBqb2IgYWJvcnRzIHRoZSBwcmV2aW91c1xuLy8gb25lIC0gYnV0IGFib3J0aW5nIHN1cHByZXNzZXMgaXRzIG9uRG9uZS9vbkVycm9yLCBzbyBpdHMgVUkgdGVhcmRvd24gKGJ1dHRvblxuLy8gcmUtZW5hYmxlLCBwcm9ncmVzcyBwaWxsKSB3b3VsZCBuZXZlciBydW4uIEVhY2ggam9iIHJlZ2lzdGVycyB0aGF0IHRlYXJkb3duIGFzXG4vLyBhIGNsZWFudXAgc28gYSBzdXBlcnNlZGluZyBqb2IgY2FuIHJ1biBpdC4gU2VlIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0uXG5mdW5jdGlvbiBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgY2xlYW51cCA9IG51bGwpIHtcbiAgX2FjdGl2ZUVTID0gaGFuZGxlO1xuICBfYWN0aXZlSm9iQ2xlYW51cCA9IGNsZWFudXA7XG59XG5cbmZ1bmN0aW9uIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpIHtcbiAgaWYgKF9hY3RpdmVFUyA9PT0gaGFuZGxlKSB7IF9hY3RpdmVFUyA9IG51bGw7IF9hY3RpdmVKb2JDbGVhbnVwID0gbnVsbDsgfVxufVxuXG5mdW5jdGlvbiBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCkge1xuICBpZiAoX2FjdGl2ZUVTKSB7IF9hY3RpdmVFUy5jbG9zZSgpOyBfYWN0aXZlRVMgPSBudWxsOyB9XG4gIGlmIChfYWN0aXZlSm9iQ2xlYW51cCkgeyBjb25zdCBjbGVhbnVwID0gX2FjdGl2ZUpvYkNsZWFudXA7IF9hY3RpdmVKb2JDbGVhbnVwID0gbnVsbDsgY2xlYW51cCgpOyB9XG59XG5cbi8vIEd1YXJkIGZvciBjb21wZXRpbmcgU1NFIGpvYnMgKHJlLXNjb3JlLCB0aW1lbGluZSwgc3VtbWFyeSwgZGlhcml6ZSwg4oCmKS4gV2hpbGVcbi8vIGFuIGFuYWx5c2lzIGlzIHJ1bm5pbmcgdGhlIGJhY2tlbmQgNDA5cyB0aGVzZSBhbnl3YXksIGJ1dCB0aGV5IGNhbGxcbi8vIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKSBmaXJzdCwgd2hpY2ggd291bGQgdGVhciBkb3duIHRoZSBsaXZlIGFuYWx5emUgcHJvZ3Jlc3Ncbi8vIFVJIGJlZm9yZSB0aGUgcmVqZWN0aW9uIGxhbmRzLiBSZXR1cm5zIHRydWUgKGFuZCB0b2FzdHMpIHNvIHRoZSBjYWxsZXIgY2FuIGJhaWxcbi8vIGJlZm9yZSBhbnkgc2lkZSBlZmZlY3RzLlxuZnVuY3Rpb24gX2Jsb2NrZWRCeUFuYWx5emUoYWN0aW9uTGFiZWwpIHtcbiAgaWYgKCFBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUpIHJldHVybiBmYWxzZTtcbiAgd2luZG93LnNob3dUb2FzdChgV2FpdCBmb3IgdGhlIGN1cnJlbnQgYW5hbHlzaXMgdG8gZmluaXNoIGJlZm9yZSB5b3UgJHthY3Rpb25MYWJlbH0uYCwgJ3dhcm5pbmcnKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIG9uTGluZSAob3B0aW9uYWwpOiBjYWxsZWQgd2l0aCBlYWNoIHJhdyBTU0UgcGF5bG9hZCBsaW5lIGJlZm9yZSBfX0RPTkVfXywgZm9yXG4vLyBjYWxsZXJzIHRoYXQgbmVlZCBsaXZlIHByb2dyZXNzIHRleHQgKGUuZy4gdGhlIHByb3h5LWJ1aWxkIHBlcmNlbnRhZ2UpLlxuLy8gb3B0cyAob3B0aW9uYWwpOiBmZXRjaCBpbml0IHBhc3NlZCB0aHJvdWdoIHRvIF9vcGVuU1NFLCBlLmcuIHttZXRob2Q6ICdQT1NUJ31cbi8vIGZvciBhIFBPU1Qtb25seSBTU0UgZW5kcG9pbnQgKGFuYWx5emUtZnJhbWVzKS5cbi8vIG9uRXJyb3IgKG9wdGlvbmFsKTogY2FsbGVkIGFmdGVyIHRoZSBidWlsdC1pbiBlcnJvciBoYW5kbGluZyAodG9hc3QgKyBlbmRKb2JVSSlcbi8vIHNvIGEgY2FsbGVyIGNhbiBydW4gaXRzIG93biB0ZXJtaW5hbCBjbGVhbnVwIG9uIGFuIEhUVFAvdHJhbnNwb3J0IGZhaWx1cmUgLSBlLmcuXG4vLyBjbGVhcmluZyBhIHBlci1pdGVtIGluLWZsaWdodCBmbGFnIHRoYXQgb25seSBpdHMgb25Eb25lIHdvdWxkIG90aGVyd2lzZSBjbGVhci5cbmZ1bmN0aW9uIHN0cmVhbVNTRSh1cmwsIG9uRG9uZSwgc3RlcERlZnMsIGpvYkxhYmVsLCBjYW5jZWxsYWJsZSA9IGZhbHNlLCBvbkxpbmUgPSBudWxsLCBwYXVzYWJsZSA9IGZhbHNlLCBvcHRzID0ge30sIG9uRXJyb3IgPSBudWxsKSB7XG4gIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKTtcbiAgaWYgKHN0ZXBEZWZzKSBzdGFydEpvYlVJKHN0ZXBEZWZzLCBqb2JMYWJlbCwgY2FuY2VsbGFibGUsIHBhdXNhYmxlKTtcbiAgY29uc3QgaGFuZGxlID0gX29wZW5TU0UoXG4gICAgdXJsLFxuICAgIHRleHQgPT4ge1xuICAgICAgLy8gQSBAQFBST0dSRVNTIG1hcmtlciBkcml2ZXMgdGhlIHBpbGxzIGRldGVybWluaXN0aWNhbGx5IGFuZCBpcyBOT1Qgc2hvd24gYXNcbiAgICAgIC8vIGEgbG9nIGxpbmU7IGV2ZXJ5dGhpbmcgZWxzZSBmYWxscyB0aHJvdWdoIHRvIHRoZSBsb2cgKyBwcm9zZSBmYWxsYmFjay5cbiAgICAgIGNvbnN0IG1hcmtlciA9IHN0ZXBEZWZzID8gcGFyc2VQcm9ncmVzcyh0ZXh0KSA6IG51bGw7XG4gICAgICBpZiAobWFya2VyKSB7IF9kcml2ZVN0ZXBGcm9tTWFya2VyKG1hcmtlcik7IHJldHVybjsgfVxuICAgICAgd2luZG93LmFwcGVuZExvZyh0ZXh0KTsgaWYgKG9uTGluZSkgb25MaW5lKHRleHQpOyBpZiAoc3RlcERlZnMpIHVwZGF0ZUpvYlVJKHRleHQpO1xuICAgIH0sXG4gICAgKCkgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICBpZiAoc3RlcERlZnMpIGVuZEpvYlVJKCk7XG4gICAgICBpZiAob25Eb25lKSBvbkRvbmUoKTtcbiAgICB9LFxuICAgIGVyck1zZyA9PiB7XG4gICAgICBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKTtcbiAgICAgIHdpbmRvdy5hcHBlbmRMb2coYFske2Vyck1zZ31dYCk7XG4gICAgICB3aW5kb3cuc2hvd1RvYXN0KGVyck1zZywgJ2Vycm9yJyk7XG4gICAgICB3aW5kb3cuU291bmRGeC5wbGF5KCdlcnJvcicpO1xuICAgICAgaWYgKHN0ZXBEZWZzKSBlbmRKb2JVSSgpO1xuICAgICAgaWYgKG9uRXJyb3IpIG9uRXJyb3IoZXJyTXNnKTtcbiAgICAgIHdpbmRvdy5sb2FkVmlkZW9zKCk7XG4gICAgfSxcbiAgICBvcHRzLFxuICApO1xuICBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgc3RlcERlZnMgPyBlbmRKb2JVSSA6IG51bGwpO1xufVxuXG4vLyBQb2xsZWQgYnkgdGhlIEpTIHNlcXVlbnRpYWwtc2VnbWVudCBydW5uZXJzIChhbmFseXplLmpzJ3MgcHJlLXNwbGl0IGxvb3AsXG4vLyBzcGxpdC5qcydzIHJlLXNwbGl0IGxvb3ApIGJlZm9yZSBmaXJpbmcgb2ZmIGVhY2ggc2VnbWVudCdzIG93biBhbmFseXplIGpvYi5cbi8vIEVhY2ggc2VnbWVudCBpcyBhIHNlcGFyYXRlIEFuYWx5emVKb2IsIHNvIHRoZXJlIGlzIGEgZ2FwIGJldHdlZW4gc2VnbWVudHNcbi8vIHdpdGggbm8gXCJydW5uaW5nXCIgam9iIGZvciAvYXBpL3N0YXR1cydzIGFuYWx5emVfcGF1c2VkIHRvIGtleSBvZmYgLSB0aGlzXG4vLyBjaGVja3MgdGhlIHJhdyBwYXVzZSBmbGFnIGZpbGUgaW5zdGVhZCAocGF1c2VfZmxhZ19zZXQpLlxuYXN5bmMgZnVuY3Rpb24gX3dhaXRXaGlsZUFuYWx5emVQYXVzZWQoKSB7XG4gIGxldCB0b2FzdGVkID0gZmFsc2U7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZmV0Y2goJy9hcGkvc3RhdHVzJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICBpZiAoIXN0YXR1cyB8fCAhc3RhdHVzLnBhdXNlX2ZsYWdfc2V0KSByZXR1cm47XG4gICAgaWYgKCF0b2FzdGVkKSB7IHdpbmRvdy5zaG93VG9hc3QoJ1BhdXNlZCAtIHdpbGwgaG9sZCBiZWZvcmUgdGhlIG5leHQgc2VnbWVudCcsICdpbmZvJyk7IHRvYXN0ZWQgPSB0cnVlOyB9XG4gICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDMwMDApKTtcbiAgfVxufVxuXG4vLyDilIDilIAgam9iIGNhbmNlbGxhdGlvbiDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZSBqb2ItaGVhZGVyIENhbmNlbCBidXR0b24gc2VydmVzIHdoaWNoZXZlciBjYW5jZWxsYWJsZSBqb2IgaXMgcnVubmluZy4gRWFjaFxuLy8gY2FuY2VsbGFibGUgZmxvdyBzZXRzIF9hY3RpdmVDYW5jZWwgKHZpYSBzZXRKb2JDYW5jZWwpIHNvIHRoZSBjb25maXJtIGNvcHkgYW5kXG4vLyB0aGUgY2FuY2VsIGVuZHBvaW50IG1hdGNoIHRoZSBqb2I7IHN0YXJ0Sm9iVUkgcmVzZXRzIGl0IHRvIHRoZSBhbmFseXplIGRlZmF1bHQuXG5jb25zdCBfQU5BTFlaRV9DQU5DRUwgPSB7XG4gIHVybDogICAgICAnL2FwaS9hbmFseXplL2NhbmNlbCcsXG4gIHRpdGxlOiAgICAnQ2FuY2VsIGFuYWx5c2lzPycsXG4gIGJvZHk6ICAgICAnQWxsIHByb2dyZXNzIGZvciB0aGlzIHJlY29yZGluZyB3aWxsIGJlIGxvc3QgYW5kIHlvdSB3aWxsIG5lZWQgdG8gYW5hbHl6ZSBpdCBhZ2Fpbi4nLFxuICBjb25maXJtOiAgJ0NhbmNlbCBBbmFseXNpcycsXG4gIGxvZ01zZzogICAnW0FuYWx5c2lzIGNhbmNlbGxlZF0nLFxufTtcbmxldCBfYWN0aXZlQ2FuY2VsID0gX0FOQUxZWkVfQ0FOQ0VMO1xuXG5mdW5jdGlvbiBzZXRKb2JDYW5jZWwoY2ZnKSB7IF9hY3RpdmVDYW5jZWwgPSBjZmcgfHwgX0FOQUxZWkVfQ0FOQ0VMOyB9XG5cbmZ1bmN0aW9uIGNhbmNlbEpvYigpIHtcbiAgd2luZG93LnNob3dDb25maXJtKFxuICAgIF9hY3RpdmVDYW5jZWwudGl0bGUsXG4gICAgX2FjdGl2ZUNhbmNlbC5ib2R5LFxuICAgIF9hY3RpdmVDYW5jZWwuY29uZmlybSxcbiAgICBfZG9DYW5jZWxKb2IsXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvQ2FuY2VsSm9iKCkge1xuICBjb25zdCBjYW5jZWwgPSBfYWN0aXZlQ2FuY2VsO1xuICAvLyBDYW5jZWwgb24gdGhlIHNlcnZlciBGSVJTVCAtIGlmIGl0IGZhaWxzLCB0aGUgam9iIGlzIHN0aWxsIHJ1bm5pbmcsIHNvXG4gIC8vIGtlZXAgdGhlIHN0cmVhbSBhdHRhY2hlZCBhbmQgdGhlIGpvYiBVSSB1cCBpbnN0ZWFkIG9mIHByZXRlbmRpbmcgaXQgc3RvcHBlZC5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjYW5jZWwudXJsLCB7bWV0aG9kOiAnUE9TVCd9KTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3IgJHtyZXMuc3RhdHVzfWApO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KGBDb3VsZCBub3QgY2FuY2VsIC0gJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cbiAgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpO1xuICB3aW5kb3cuYXBwZW5kTG9nKGNhbmNlbC5sb2dNc2cpO1xuICBlbmRKb2JVSSgpO1xuICAvLyBBIGpvYi1zcGVjaWZpYyB0ZXJtaW5hbCBjbGVhbnVwIChlLmcuIGNsZWFyaW5nIGEgcGVyLWNsaXAgaW4tZmxpZ2h0IGZsYWcgc29cbiAgLy8gaXRzIGJ1dHRvbiBsZWF2ZXMgdGhlIHNwaW5uZXIpIC0gdGhlIGdlbmVyaWMgYW5hbHl6ZSBjYW5jZWwgc2V0cyBub25lLlxuICBpZiAoY2FuY2VsLm9uQ2FuY2VsKSBjYW5jZWwub25DYW5jZWwoKTtcbiAgLy8gQ2xlYXIgdGhlIGFuYWx5emluZyBtYXJrZXIgc28gbG9hZFZpZGVvcygpIGRyb3BzIHRoZSBzaWRlYmFyIHBsYWNlaG9sZGVyIC9cbiAgLy8gc3Bpbm5lci4gTGVmdCBzZXQsIGEgY2FuY2VsbGVkIHJ1biB3aG9zZSBEQiByb3cgbmV2ZXIgbWF0ZXJpYWxpc2VkIHdvdWxkXG4gIC8vIGtlZXAgYW4gdW5jbGlja2FibGUgXCJBbmFseXppbmfigKZcIiBwbGFjZWhvbGRlciB1bnRpbCBhIG1hbnVhbCBwYWdlIHJlZnJlc2guXG4gIEFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSA9IG51bGw7XG4gIHdpbmRvdy5sb2FkVmlkZW9zKCk7XG59XG5cbmV4cG9ydCB7XG4gIElOR0VTVF9TVEVQUywgU0NPUkVfU1RFUFMsIEZSQU1FU19TVEVQUywgSk9CX1NUQUdFUywgcGFyc2VQcm9ncmVzcywgX2RyaXZlU3RlcEZyb21NYXJrZXIsXG4gIHN0YXJ0Sm9iVUksIHVwZGF0ZUpvYlVJLCBlbmRKb2JVSSwgYXBwbHlKb2JCbG9ja2VkU3RhdGUsIF9zdGVwUGlsbExhYmVsLCBfcmVuZGVyU3RlcFBpbGwsIF90aWNrSm9iVGltZXIsXG4gIF9zZXRQYXVzZWRVSUZyb21TdGF0dXMsIHRvZ2dsZVBhdXNlSm9iLCBfcG9sbFRoZXJtYWxTdGF0dXMsXG4gIF9vcGVuU1NFLCBzdHJlYW1TU0UsIF9zZXRBY3RpdmVTdHJlYW0sIF9jbGVhckFjdGl2ZVN0cmVhbSwgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSxcbiAgX2Jsb2NrZWRCeUFuYWx5emUsIF93YWl0V2hpbGVBbmFseXplUGF1c2VkLFxuICBzZXRKb2JDYW5jZWwsIGNhbmNlbEpvYixcbn07XG5cbi8vIFRoZSBqb2IgaGVhZGVyJ3MgUGF1c2UvQ2FuY2VsIGJ1dHRvbnMgYXJlIHN0YXRpYyBtYXJrdXAgaW4gaW5kZXguaHRtbCAobmV2ZXJcbi8vIHJlLXJlbmRlcmVkKSwgc28gYSBzaW5nbGUgbGlzdGVuZXIgd2lyZWQgb25jZSBhdCBtb2R1bGUgbG9hZCAtIHJlcGxhY2luZyB0aGVcbi8vIG9uY2xpY2s9XCJ0b2dnbGVQYXVzZUpvYigpXCIvXCJjYW5jZWxKb2IoKVwiIGF0dHJpYnV0ZXMgdGhhdCB1c2VkIHRvIGxpdmUgdGhlcmUgLVxuLy8gY2FuIG5ldmVyIGRvdWJsZS13aXJlLiAodmlkZW9zLmpzJ3MgaW4tZGV0YWlsIENhbmNlbCBidXR0b24gc3RpbGwgdXNlcyBpdHMgb3duXG4vLyBpbmxpbmUgb25jbGljaz1cImNhbmNlbEpvYigpXCI7IHRoYXQgbWFya3VwIGxpdmVzIGluIHZpZGVvcy5qcywgb3V0IG9mIHNjb3BlIGhlcmUuKVxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1wYXVzZS1qb2InKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZVBhdXNlSm9iKTtcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2FuY2VsLWpvYicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgY2FuY2VsSm9iKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFJlY29yZGluZyBwcmV2aWV3IHBsYXllcjogcGlja3MgdGhlIG1lZGlhIHRyYW5zcG9ydCAoRWxlY3Ryb24gbmF0aXZlIHNjaGVtZSB2cyBIVFRQKSxcbi8vICAgcHJlZmVycyB0aGUgZmFzdCA3MjBwIHByb3h5IG92ZXIgdGhlIHNvdXJjZSwgYW5kIGRyaXZlcyB0aGUgY2xpY2stdG8tYnVpbGQgcHJveHkgYmFkZ2UuXG4vLyAgIEFQSTogcm91dGVzL3ZpZGVvcy5weSAoc291cmNlL3Byb3h5L3Byb3h5LXN0YXR1cy9wcm94eS1nZW5lcmF0ZSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdmlkZW8ucHlcbi8vIFNpbmdsZSBwb2ludCB0aGF0IHBpY2tzIHRoZSB0cmFuc3BvcnQgZm9yIGEgcmVjb3JkaW5nJ3Mgc291cmNlL3Byb3h5IHN0cmVhbVxuLy8gKHJvYWRtYXAgcGxhbiAxMCkuIEluc2lkZSB0aGUgcGFja2FnZWQgRWxlY3Ryb24gYXBwLCB3aW5kb3cuZWxlY3Ryb25BUEkubWVkaWFQcm90b2NvbFxuLy8gaXMgc2V0IGFuZCBwbGF5YmFjayBnb2VzIHN0cmFpZ2h0IHRocm91Z2ggdGhlIG5hdGl2ZSBcInl1dS1tZWRpYTovL1wiIHNjaGVtZSAtXG4vLyBieXBhc3NpbmcgdGhlIFB5dGhvbiBieXRlLXB1bXAgLSBpbnN0ZWFkIG9mIHRoZSBIVFRQIHJvdXRlLiBQbGFpbiBicm93c2VyLWRldlxuLy8gbW9kZSBuZXZlciBoYXMgZWxlY3Ryb25BUEksIHNvIGl0IGFsd2F5cyBnZXRzIHRoZSB1bmNoYW5nZWQgSFRUUCBVUkwuIGFic1BhdGhcbi8vIG1heSBiZSBudWxsIChlLmcuIGEgcHJveHkgdGhhdCBoYXNuJ3QgYmVlbiBnZW5lcmF0ZWQvbG9va2VkIHVwIHlldCksIHdoaWNoXG4vLyBzaW1wbHkgZmFsbHMgYmFjayB0byBIVFRQIGZvciB0aGF0IG9uZSByZXF1ZXN0LlxuaW1wb3J0IHsgc3RyZWFtU1NFIH0gZnJvbSAnLi9qb2JzLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIF9idWlsZE1lZGlhVXJsKHZpZGVvSWQsIGtpbmQsIGFic1BhdGgpIHtcbiAgaWYgKHdpbmRvdy5lbGVjdHJvbkFQST8ubWVkaWFQcm90b2NvbCAmJiBhYnNQYXRoKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IGFic1BhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIHJldHVybiBgeXV1LW1lZGlhOi8vbWVkaWEvJHtlbmNvZGVVUklDb21wb25lbnQobm9ybWFsaXplZCl9YDtcbiAgfVxuICByZXR1cm4gYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vJHtraW5kfWA7XG59XG5cbi8vIOKUgOKUgCByZWNvcmRpbmcgcHJldmlldyBxdWFsaXR5ICg3MjBwIHByb3h5ICsgYmFkZ2UpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gU2hhcmVkIGJ5IGV2ZXJ5IGZ1bGwtcmVjb3JkaW5nIDx2aWRlbz4gKHJlY29yZGluZyBkZXRhaWwgcGxheWVyLCBzcGxpdCBlZGl0b3IpXG4vLyBzbyB0aGUgY3JlYXRvciBhbHdheXMga25vd3Mgd2hldGhlciB0aGV5J3JlIHNlZWluZyB0aGUgZmFzdCA3MjBwIHByb3h5IG9yIHRoZVxuLy8gZnVsbC1xdWFsaXR5IG9yaWdpbmFsLiBQcmVmZXJzIHRoZSBwcm94eSB3aGVuIG9uZSBleGlzdHM7IG90aGVyd2lzZSBwbGF5cyB0aGVcbi8vIHNvdXJjZSBhbmQgZWl0aGVyIGJ1aWxkcyBhIHByb3h5IG9uIGRlbWFuZCAoYXV0b0J1aWxkKSBvciBpbnZpdGVzIHRoZSB1c2VyIHRvLlxuLy9cbi8vICAgdmlkZW9FbCAvIGJhZGdlRWwgOiB0aGUgPHZpZGVvPiBhbmQgaXRzIG92ZXJsYXkgYmFkZ2UgKGNhbGxlciBvd25zIGxheW91dClcbi8vICAgYXV0b0J1aWxkICAgICAgICAgOiBidWlsZCBpbW1lZGlhdGVseSB3aGVuIG5vIHByb3h5IGV4aXN0cyAoZGVsaWJlcmF0ZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIHNjcnViYmluZyBzdXJmYWNlcyksIGVsc2UgdGhlIGJhZGdlIG9mZmVycyBhIGNsaWNrLXRvLWJ1aWxkXG4vLyAgIGlzQ3VycmVudCAgICAgICAgIDogZ3VhcmQgc28gYSBsYXRlIHN3YXAgbmV2ZXIgbGFuZHMgb24gYSBzaW5jZS1jaGFuZ2VkIHZpZXdcbi8vICAgc3RhcnRTIC8gZW5kUyAgICAgOiBhIHNwbGl0IHNlZ21lbnQncyBwbGF5ZXIgc3RyZWFtcyB0aGUgZnVsbCB1bnRyaW1tZWQgcGFyZW50XG4vLyAgICAgICAgICAgICAgICAgICAgICAgZmlsZSAoc291cmNlIGFuZCBwcm94eSBhcmUgYm90aCBrZXllZCBieSB0aGUgcGFyZW50IHBhdGgpIC1cbi8vICAgICAgICAgICAgICAgICAgICAgICB0aGVzZSBib3VuZCBwbGF5YmFjayB0byB0aGUgc2VnbWVudCdzIG93biBzbGljZSBvZiBpdFxuLy8gICBzb3VyY2VQYXRoICAgICAgICA6IHRoZSByZWNvcmRpbmcncyBhYnNvbHV0ZSBwYXRoICh2aWRlby5zb3VyY2VfcGF0aCBmcm9tIHRoZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIGFscmVhZHktZmV0Y2hlZCB2aWRlbyByZWNvcmQpIC0gb25seSB1c2VkIHRvIGJ1aWxkIHRoZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIEVsZWN0cm9uIG5hdGl2ZS1wcm90b2NvbCBVUkw7IGlnbm9yZWQgaW4gYnJvd3Nlci1kZXYgbW9kZVxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwUmVjb3JkaW5nUHJldmlldyh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCB7IGF1dG9CdWlsZCA9IGZhbHNlLCBpc0N1cnJlbnQgPSAoKSA9PiB0cnVlLCBzdGFydFMgPSBudWxsLCBlbmRTID0gbnVsbCwgc291cmNlUGF0aCA9IG51bGwgfSA9IHt9KSB7XG4gIHZpZGVvRWwuc3JjID0gX2J1aWxkTWVkaWFVcmwodmlkZW9JZCwgJ3NvdXJjZScsIHNvdXJjZVBhdGgpO1xuICBpZiAoc3RhcnRTICE9IG51bGwpIHtcbiAgICB2aWRlb0VsLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4geyB0cnkgeyB2aWRlb0VsLmN1cnJlbnRUaW1lID0gc3RhcnRTOyB9IGNhdGNoIChfKSB7fSB9LCB7IG9uY2U6IHRydWUgfSk7XG4gIH1cbiAgaWYgKGVuZFMgIT0gbnVsbCkge1xuICAgIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsICgpID0+IHsgaWYgKHZpZGVvRWwuY3VycmVudFRpbWUgPj0gZW5kUykgdmlkZW9FbC5wYXVzZSgpOyB9KTtcbiAgfVxuICBjb25zdCBidWlsZEZuID0gKCkgPT4gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMpO1xuICBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdvcmlnaW5hbCcsIG51bGwsIGF1dG9CdWlsZCA/IG51bGwgOiBidWlsZEZuKTtcbiAgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vcHJveHktc3RhdHVzYClcbiAgICAudGhlbihyID0+IHIub2sgPyByLmpzb24oKSA6IG51bGwpXG4gICAgLnRoZW4oc3RhdHVzID0+IHtcbiAgICAgIGlmICghaXNDdXJyZW50KCkgfHwgIXN0YXR1cykgcmV0dXJuO1xuICAgICAgaWYgKHN0YXR1cy5hdmFpbGFibGUpIF91c2VSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0Uywgc3RhdHVzLnByb3h5X3BhdGgpO1xuICAgICAgZWxzZSBpZiAoYXV0b0J1aWxkIHx8IHN0YXR1cy5nZW5lcmF0aW5nKSBidWlsZEZuKCk7XG4gICAgfSlcbiAgICAuY2F0Y2goKCkgPT4geyAvKiBsZWF2ZSB0aGUgc291cmNlIHBsYXlpbmcgd2l0aCB0aGUgb3JpZ2luYWwtcXVhbGl0eSBiYWRnZSAqLyB9KTtcbn1cblxuLy8gc3RhcnRTOiBmYWxscyBiYWNrIHRvIGl0IHdoZW4gY3VycmVudFRpbWUgaXMgc3RpbGwgMCAtIHRoZSBwcm94eS1zdGF0dXMgZmV0Y2hcbi8vIGNhbiByZXNvbHZlIGJlZm9yZSB0aGUgc291cmNlJ3MgbG9hZGVkbWV0YWRhdGEgc2VlayAoc2V0dXBSZWNvcmRpbmdQcmV2aWV3KSBydW5zLFxuLy8gd2hpY2ggd291bGQgb3RoZXJ3aXNlIHJlc3VtZSBhIHNlZ21lbnQncyBwcm94eSBhdCB0aGUgcGFyZW50J3MgdD0wLlxuZnVuY3Rpb24gX3VzZVJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTID0gbnVsbCwgcHJveHlQYXRoID0gbnVsbCkge1xuICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gIGNvbnN0IHJlc3VtZUF0ICAgPSB2aWRlb0VsLmN1cnJlbnRUaW1lIHx8IHN0YXJ0UyB8fCAwO1xuICBjb25zdCB3YXNQbGF5aW5nID0gIXZpZGVvRWwucGF1c2VkICYmICF2aWRlb0VsLmVuZGVkO1xuICB2aWRlb0VsLnNyYyA9IF9idWlsZE1lZGlhVXJsKHZpZGVvSWQsICdwcm94eScsIHByb3h5UGF0aCk7XG4gIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiB7XG4gICAgdHJ5IHsgdmlkZW9FbC5jdXJyZW50VGltZSA9IHJlc3VtZUF0OyB9IGNhdGNoIChfKSB7fVxuICAgIGlmICh3YXNQbGF5aW5nKSB2aWRlb0VsLnBsYXkoKS5jYXRjaCgoKSA9PiB7fSk7XG4gIH0sIHsgb25jZTogdHJ1ZSB9KTtcbiAgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAncHJveHknKTtcbn1cblxuZnVuY3Rpb24gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMgPSBudWxsKSB7XG4gIGlmICghaXNDdXJyZW50KCkpIHJldHVybjtcbiAgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAnYnVpbGRpbmcnKTtcbiAgc3RyZWFtU1NFKFxuICAgIGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L3Byb3h5L2dlbmVyYXRlYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9wcm94eS1zdGF0dXNgKVxuICAgICAgICAudGhlbihyID0+IHIub2sgPyByLmpzb24oKSA6IG51bGwpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgaWYgKCFpc0N1cnJlbnQoKSkgcmV0dXJuO1xuICAgICAgaWYgKHN0YXR1cz8uYXZhaWxhYmxlKSBfdXNlUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMsIHN0YXR1cy5wcm94eV9wYXRoKTtcbiAgICAgIC8vIEFub3RoZXIgb3BlbiBpcyBzdGlsbCBlbmNvZGluZyAtIHBvbGwgdW50aWwgaXRzIHByb3h5IGxhbmRzLlxuICAgICAgZWxzZSBpZiAoc3RhdHVzPy5nZW5lcmF0aW5nKSBzZXRUaW1lb3V0KCgpID0+IF9idWlsZFJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTKSwgNTAwMCk7XG4gICAgICBlbHNlIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ29yaWdpbmFsJywgbnVsbCwgKCkgPT4gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMpKTtcbiAgICB9LFxuICAgIG51bGwsICAgICAgICAvLyBubyBnbG9iYWwgam9iIHBpbGwgLSB0aGlzIGlzIGEgYmFja2dyb3VuZCBjb252ZW5pZW5jZVxuICAgICdQcmV2aWV3JyxcbiAgICBmYWxzZSxcbiAgICBsaW5lID0+IHsgICAgLy8gb25MaW5lOiBzdXJmYWNlIHRoZSBlbmNvZGUgcGVyY2VudGFnZSBvbiB0aGUgYmFkZ2VcbiAgICAgIGNvbnN0IG0gPSAvKFxcZCspJS8uZXhlYyhsaW5lKTtcbiAgICAgIGlmIChtICYmIGlzQ3VycmVudCgpKSBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdidWlsZGluZycsIG1bMV0pO1xuICAgIH0sXG4gICk7XG59XG5cbmZ1bmN0aW9uIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgbW9kZSwgcGN0LCBvbkJ1aWxkKSB7XG4gIGlmICghYmFkZ2VFbCkgcmV0dXJuO1xuICAvLyBSZXNldCB0byBhIG5vbi1pbnRlcmFjdGl2ZSBzdGF0dXMgaW5kaWNhdG9yOyB0aGUgYnVpbGQgYWZmb3JkYW5jZSBiZWxvd1xuICAvLyByZS1hcm1zIGl0IGFzIGEgYnV0dG9uIHNvIHJvbGUvdGFiaW5kZXggbmV2ZXIgZ28gc3RhbGUgYmV0d2VlbiBzdGF0ZXMuXG4gIGJhZGdlRWwuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICBiYWRnZUVsLm9uY2xpY2sgPSBudWxsO1xuICBiYWRnZUVsLm9ua2V5ZG93biA9IG51bGw7XG4gIGJhZGdlRWwuc3R5bGUuY3Vyc29yID0gJyc7XG4gIGJhZGdlRWwuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgYmFkZ2VFbC5yZW1vdmVBdHRyaWJ1dGUoJ3RhYmluZGV4Jyk7XG4gIGJhZGdlRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3N0YXR1cycpO1xuICBiYWRnZUVsLmNsYXNzTGlzdC50b2dnbGUoJ3ByZXZpZXctYmFkZ2UtcHJveHknLCBtb2RlID09PSAncHJveHknKTtcbiAgYmFkZ2VFbC5jbGFzc0xpc3QucmVtb3ZlKCdwcmV2aWV3LWJhZGdlLWJ1aWxkJyk7XG4gIGlmIChtb2RlID09PSAncHJveHknKSB7XG4gICAgYmFkZ2VFbC50ZXh0Q29udGVudCA9ICdQcmV2aWV3IHF1YWxpdHkgKDcyMHApJztcbiAgICBiYWRnZUVsLnRpdGxlID0gJ1BsYXlpbmcgYSBkb3duc2NhbGVkIDcyMHAgcHJldmlldyBmb3IgZmFzdCBzZWVraW5nIC0gbm90IGZ1bGwgcXVhbGl0eS4gRXhwb3J0cyB1c2UgdGhlIG9yaWdpbmFsLic7XG4gIH0gZWxzZSBpZiAobW9kZSA9PT0gJ2J1aWxkaW5nJykge1xuICAgIGJhZGdlRWwudGV4dENvbnRlbnQgPSBwY3QgPyBgQnVpbGRpbmcgNzIwcCBwcmV2aWV34oCmICR7cGN0fSVgIDogJ0J1aWxkaW5nIDcyMHAgcHJldmlld+KApic7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdFbmNvZGluZyBhIGZhc3Qtc2Vla2luZyA3MjBwIHByZXZpZXcgZnJvbSB0aGUgc291cmNlIHJlY29yZGluZy4nO1xuICB9IGVsc2UgaWYgKG9uQnVpbGQpIHtcbiAgICAvLyBSZW5kZXIgdGhlIGFjdGlvbiBhcyBhIGJ1dHRvbi1zdHlsZWQgcGlsbCBzbyBpdCBvYnZpb3VzbHkgaW52aXRlcyBhIGNsaWNrLlxuICAgIGJhZGdlRWwuY2xhc3NMaXN0LmFkZCgncHJldmlldy1iYWRnZS1idWlsZCcpO1xuICAgIGJhZGdlRWwuaW5uZXJIVE1MID0gJ09yaWdpbmFsIHF1YWxpdHkgwrcgPHNwYW4gY2xhc3M9XCJwcmV2aWV3LWJhZGdlLWFjdGlvblwiPiYjOTg4OTsgQnVpbGQgNzIwcCBwcmV2aWV3PC9zcGFuPic7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdQbGF5aW5nIHRoZSBmdWxsLXF1YWxpdHkgb3JpZ2luYWwuIEJ1aWxkIGEgNzIwcCBwcmV2aWV3IHNvIHNlZWtpbmcgaXMgZmFzdC4nO1xuICAgIGJhZGdlRWwuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgIGJhZGdlRWwuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdhdXRvJztcbiAgICBiYWRnZUVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdidXR0b24nKTtcbiAgICBiYWRnZUVsLnRhYkluZGV4ID0gMDtcbiAgICBiYWRnZUVsLm9uY2xpY2sgPSBvbkJ1aWxkO1xuICAgIGJhZGdlRWwub25rZXlkb3duID0gKGUpID0+IHsgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBvbkJ1aWxkKCk7IH0gfTtcbiAgfSBlbHNlIHtcbiAgICBiYWRnZUVsLnRleHRDb250ZW50ID0gJ09yaWdpbmFsIHF1YWxpdHkgwrcgc2xvd2VyIHNlZWtpbmcnO1xuICAgIGJhZGdlRWwudGl0bGUgPSAnUGxheWluZyB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nIC0gc2Vla2luZyBhIGxvbmcgZmlsZSBjYW4gYmUgc2xvdy4nO1xuICB9XG59XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBDcm9zcy1jdXR0aW5nIFVJIGZlZWRiYWNrIGhlbHBlcnMgd2l0aCBubyBob21lIGluIGEgc2luZ2xlIGZlYXR1cmU6IHRvYXN0cywgdGhlXHJcbi8vICAgYm90dG9tIGxvZyBwYW5lbCwgc29ydC1kaXJlY3Rpb24gYnV0dG9ucywgc3BlYWtlci1sYWJlbHMgKGRpYXJpemF0aW9uKSByZWFkaW5lc3MsIFwicmV2ZWFsIGluXHJcbi8vICAgZm9sZGVyXCIsIGFuZCBjbGlwYm9hcmQgY29weS4gU3RhdGUvZm9ybWF0L2pvYi1TU0UvcHJldmlldyBtYWNoaW5lcnkgc3BsaXQgb3V0IGluIHN0YWdlIDAyLlxyXG4vLyAgIEFQSTogcm91dGVzL2NvbmZpZy5weSwgcm91dGVzL2xvZ3MucHkgKGluZGlyZWN0bHkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5XHJcbmltcG9ydCB7IGVzY0h0bWwsIHN0cmlwUmljaE1hcmt1cCB9IGZyb20gJy4vZm9ybWF0LmpzJztcclxuXHJcbi8vIOKUgOKUgCBzb3J0LWRpcmVjdGlvbiB0b2dnbGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIFJlZmxlY3RzIGEgc29ydC1kaXJlY3Rpb24gdG9nZ2xlJ3MgY3VycmVudCBzdGF0ZSBvbnRvIGl0cyBidXR0b246IGFycm93IGdseXBoLFxyXG4vLyBhcmlhLXByZXNzZWQsIGFuZCBhIHNlbGYtZGVzY3JpYmluZyBhcmlhLWxhYmVsLiAnZGVzYycgaXMgdGhlIHNvcnQgb3B0aW9uJ3NcclxuLy8gbmF0dXJhbCBvcmRlciAoaGlnaGVzdC9uZXdlc3QgZmlyc3QpOyAnYXNjJyByZXZlcnNlcyBpdC5cclxuZXhwb3J0IGZ1bmN0aW9uIF9zeW5jU29ydERpckJ0bihidG5JZCwgZGlyKSB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYnRuSWQpO1xyXG4gIGlmICghYnRuKSByZXR1cm47XHJcbiAgY29uc3QgYXNjID0gZGlyID09PSAnYXNjJztcclxuICBidG4uaW5uZXJIVE1MID0gYXNjID8gJyYjODU5MzsnIDogJyYjODU5NTsnO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFzYyA/ICd0cnVlJyA6ICdmYWxzZScpO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhc2NcclxuICAgID8gJ1NvcnRlZCBhc2NlbmRpbmcgLSBjbGljayB0byBzb3J0IGRlc2NlbmRpbmcnXHJcbiAgICA6ICdTb3J0ZWQgZGVzY2VuZGluZyAtIGNsaWNrIHRvIHNvcnQgYXNjZW5kaW5nJyk7XHJcbiAgYnRuLnRpdGxlID0gYXNjID8gJ0FzY2VuZGluZyBvcmRlcicgOiAnRGVzY2VuZGluZyBvcmRlcic7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBzcGVha2VyIGxhYmVscyAoZGlhcml6YXRpb24pIHJlYWRpbmVzcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gU3BlZWNoQnJhaW4gKHRoZSBkZWZhdWx0IGJhY2tlbmQpIGlzIGJ1bmRsZWQgLSBpdHMgcGFja2FnZSBzaG91bGQgYWx3YXlzIGJlXHJcbi8vIHByZXNlbnQsIHNvIGFuIHVucmVhZHkgcmVzdWx0IHRoZXJlIG1lYW5zIGEgYnJva2VuIGluc3RhbGwsIG5vdCBhIG1pc3NpbmdcclxuLy8gb3B0aW9uYWwgZG93bmxvYWQuIFB5YW5ub3RlIGlzIHRoZSBhZHZhbmNlZCwgdG9rZW4tZ2F0ZWQgYWx0ZXJuYXRpdmUgYW5kIHN0aWxsXHJcbi8vIG5lZWRzIGEgcmVhbCBpbnN0YWxsICsgYSBIdWdnaW5nRmFjZSB0b2tlbi4gVGhlIHBlci1ydW4gY2hlY2tib3hlcyBpbiB0aGVcclxuLy8gYW5hbHl6ZSBhbmQgZXhwb3J0IHBhbmVscyBib3RoIGdhdGUgb24gdGhpcyBzaW5nbGUgY2hlY2suIENlbnRyYWxpemVkIGhlcmUgc29cclxuLy8gdGhlIHRocmVlIHN1cmZhY2VzIChTZXR0aW5ncywgYW5hbHl6ZSwgZXhwb3J0KSBjYW4ndCBkcmlmdCB0byBkaWZmZXJlbnQgcnVsZXMuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZGlhcml6YXRpb25SZWFzb24oaW5zdGFsbGVkKSB7XHJcbiAgcmV0dXJuIGluc3RhbGxlZCA/ICcnIDogJ1NwZWVjaEJyYWluIGlzIHVuYXZhaWxhYmxlIC0gdHJ5IHJlaW5zdGFsbGluZyBZdXVDbGlwJztcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIF9kaWFyaXphdGlvblJlYWRpbmVzcygpIHtcclxuICBjb25zdCBjZmcgPSBhd2FpdCBmZXRjaCgnL2FwaS9jb25maWcnKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+ICh7fSkpO1xyXG4gIGNvbnN0IGJhY2tlbmQgPSBjZmcuZGlhcml6YXRpb25fYmFja2VuZCB8fCAnc3BlZWNoYnJhaW4nO1xyXG4gIGNvbnN0IGluc3RhbGwgPSBhd2FpdCBmZXRjaCgnL2FwaS9pbnN0YWxsL3NwZWVjaGJyYWluJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiAoe2luc3RhbGxlZDogZmFsc2V9KSk7XHJcbiAgY29uc3QgaW5zdGFsbGVkID0gISFpbnN0YWxsLmluc3RhbGxlZDtcclxuICByZXR1cm4ge1xyXG4gICAgaW5zdGFsbGVkLFxyXG4gICAgYmFja2VuZCxcclxuICAgIHJlYWR5OiAgIGluc3RhbGxlZCxcclxuICAgIHJlYXNvbjogIF9kaWFyaXphdGlvblJlYXNvbihpbnN0YWxsZWQpLFxyXG4gIH07XHJcbn1cclxuXHJcbi8vIE5vdGUgc2hvd24gb24gYSBkaXNhYmxlZCBzcGVha2VyLWxhYmVscyBjb250cm9sOiB0aGUgYmxvY2tpbmcgcmVhc29uIHBsdXMgYVxyXG4vLyBidXR0b24gdGhhdCBqdW1wcyB0byBTZXR0aW5ncy4gc2V0dGluZ3NPbmNsaWNrIGNsb3NlcyB0aGUgaG9zdCBzdXJmYWNlIGZpcnN0XHJcbi8vICh0aGUgYW5hbHl6ZSBwYW5lbCBvciBleHBvcnQgbW9kYWwpIHNvIFNldHRpbmdzIGlzbid0IG9wZW5lZCBiZWhpbmQgaXQuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZGlhcml6YXRpb25Ob3RlSHRtbChyZWFzb24sIHNldHRpbmdzT25jbGljaykge1xyXG4gIHJldHVybiBlc2NIdG1sKHJlYXNvbikgKyAnIC0gc2V0IHVwIGluICcgK1xyXG4gICAgJzxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6MCA0cHg7Y29sb3I6dmFyKC0tYWNjZW50KTsnICtcclxuICAgIGBkaXNwbGF5OmlubGluZS1mbGV4XCIgb25jbGljaz1cIiR7ZXNjSHRtbChzZXR0aW5nc09uY2xpY2spfVwiPlNldHRpbmdzPC9idXR0b24+YDtcclxufVxyXG5cclxuLy8g4pSA4pSAIGxvZyBwYW5lbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5Mb2coKSB7XHJcbiAgY29uc3QgcGFuZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLXBhbmVsJyk7XHJcbiAgcGFuZWwuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xyXG4gIHBhbmVsLmNsYXNzTGlzdC5yZW1vdmUoJ21pbmltaXplZCcpO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctdG9nZ2xlJykudGV4dENvbnRlbnQgPSAn4payJztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUxvZygpIHtcclxuICBjb25zdCBwYW5lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctcGFuZWwnKTtcclxuICBjb25zdCBtaW5pbWl6ZWQgPSBwYW5lbC5jbGFzc0xpc3QudG9nZ2xlKCdtaW5pbWl6ZWQnKTtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLXRvZ2dsZScpLnRleHRDb250ZW50ID0gbWluaW1pemVkID8gJ+KWvCcgOiAn4payJztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWxvZy10b2dnbGUnKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBtaW5pbWl6ZWQgPyAnZmFsc2UnIDogJ3RydWUnKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNsZWFyTG9nKCkge1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctbGluZXMnKS5pbm5lckhUTUwgPSAnJztcclxufVxyXG5cclxuLy8gVGhlIGxvZyBoZWFkZXIncyB0b2dnbGUvY2xlYXIgYnV0dG9ucyBhcmUgc3RhdGljIG1hcmt1cCBpbiBpbmRleC5odG1sIChuZXZlclxyXG4vLyByZS1yZW5kZXJlZCksIHNvIHRoaXMgb25lLXRpbWUgd2lyaW5nIGF0IG1vZHVsZSBsb2FkIGNhbid0IGRvdWJsZS1maXJlLlxyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWxvZy10b2dnbGUnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUxvZyk7XHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2xlYXItbG9nJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjbGVhckxvZyk7XHJcblxyXG4vLyBDYXAgdGhlIGxvZyBET00uIEFuIHVuYm91bmRlZCBsb2cgZnJvemUgdGhlIGJyb3dzZXIgb24gbG9uZyBydW5zIGFuZCwgd29yc2UsXHJcbi8vIHdoZW4gYSByZWF0dGFjaGVkIGFuYWx5emUgc3RyZWFtIHJlcGxheWVkIGEgbGFyZ2UgYnVmZmVyIGFsbCBhdCBvbmNlIChlYWNoIGxpbmVcclxuLy8gdHJpZ2dlcnMgYSBzY3JvbGwtdG8tYm90dG9tIHJlZmxvdykgLSB0aGUgdGFiIGxvY2tlZCB1cCwgdGhlIGVsYXBzZWQgdGltZXJcclxuLy8gYXBwZWFyZWQgZnJvemVuLCBhbmQgQ2FuY2VsIHdvdWxkbid0IHJlc3BvbmQuIEtlZXBpbmcgb25seSB0aGUgbW9zdCByZWNlbnQgbGluZXNcclxuLy8gYm91bmRzIHRoZSByZWZsb3cgY29zdDsgdGhlIGZ1bGwgbG9nIGFsd2F5cyByZW1haW5zIGluIC55dXUtY2xpcC95dXUtY2xpcC5sb2cuXHJcbmNvbnN0IF9NQVhfTE9HX0xJTkVTID0gNTAwO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZExvZyhyYXcpIHtcclxuICBjb25zdCB0ZXh0ID0gc3RyaXBSaWNoTWFya3VwKHJhdyk7XHJcbiAgaWYgKCF0ZXh0LnRyaW0oKSkgcmV0dXJuO1xyXG4gIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnN0IGlzT2sgICA9IHJhdy5pbmNsdWRlcygnIE9LJykgfHwgcmF3LmluY2x1ZGVzKCdbZ3JlZW5dJykgfHwgcmF3LmluY2x1ZGVzKCdEb25lJyk7XHJcbiAgY29uc3QgaXNFcnIgICA9IHJhdy5pbmNsdWRlcygnRkFJTCcpIHx8IHJhdy5pbmNsdWRlcygnRXJyb3InKSB8fCByYXcuaW5jbHVkZXMoJ1tyZWRdJykgfHwgcmF3LmluY2x1ZGVzKCdlcnJvcicpO1xyXG4gIGNvbnN0IGlzV2FybiAgPSByYXcuaW5jbHVkZXMoJ1t5ZWxsb3ddJykgfHwgcmF3LmluY2x1ZGVzKCdXQVJOSU5HJykgfHwgcmF3LmluY2x1ZGVzKCdvdmVybGFwJyk7XHJcbiAgZGl2LmNsYXNzTmFtZSA9ICdsb2ctbGluZScgKyAoaXNPayA/ICcgb2snIDogaXNFcnIgPyAnIGVycicgOiBpc1dhcm4gPyAnIHdhcm4nIDogJycpO1xyXG4gIGRpdi5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gIGRpdi5zdHlsZS5nYXAgPSAnNnB4JztcclxuICBjb25zdCB0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB0cy5zdHlsZS5jc3NUZXh0ID0gJ2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTBweDtmbGV4LXNocmluazowO29wYWNpdHk6LjcnO1xyXG4gIHRzLnRleHRDb250ZW50ID0gbmV3IERhdGUoKS50b0xvY2FsZVRpbWVTdHJpbmcodW5kZWZpbmVkLCB7aG91cjonMi1kaWdpdCcsIG1pbnV0ZTonMi1kaWdpdCcsIHNlY29uZDonMi1kaWdpdCd9KTtcclxuICBkaXYuYXBwZW5kQ2hpbGQodHMpO1xyXG4gIGRpdi5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0KSk7XHJcbiAgY29uc3QgbGluZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWxpbmVzJyk7XHJcbiAgbGluZXMuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICB3aGlsZSAobGluZXMuY2hpbGRFbGVtZW50Q291bnQgPiBfTUFYX0xPR19MSU5FUykgbGluZXMucmVtb3ZlQ2hpbGQobGluZXMuZmlyc3RFbGVtZW50Q2hpbGQpO1xyXG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWJvZHknKTtcclxuICBib2R5LnNjcm9sbFRvcCA9IGJvZHkuc2Nyb2xsSGVpZ2h0O1xyXG59XHJcblxyXG4vLyDilIDilIAgdG9hc3Qgbm90aWZpY2F0aW9ucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gVHlwZXM6IHN1Y2Nlc3MgfCBpbmZvIHwgd2FybmluZyAoZ3VhcmQvZ3VpZGFuY2UpIHwgZXJyb3IgKGFjdHVhbCBmYWlsdXJlcykuXHJcbi8vIEVycm9yIHRvYXN0cyBwZXJzaXN0IHVudGlsIGRpc21pc3NlZCAtIGR1cmF0aW9uTXMgaXMgaWdub3JlZCBmb3IgdGhlbS5cclxuLy8gb3B0czogeyBkdXJhdGlvbk1zLCBhY3Rpb246IHtsYWJlbCwgb25DbGlja30gfVxyXG5jb25zdCBUT0FTVF9TVEFDS19NQVggPSA0O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlLCB0eXBlID0gJ3N1Y2Nlc3MnLCBvcHRzID0ge30pIHtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9hc3QtY29udGFpbmVyJyk7XHJcbiAgY29uc3QgbGl2ZVJlZ2lvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHR5cGUgPT09ICdlcnJvcicgPyAnc3ItbGl2ZS1hc3NlcnRpdmUnIDogJ3NyLWxpdmUtcG9saXRlJyk7XHJcbiAgaWYgKGxpdmVSZWdpb24pIHsgbGl2ZVJlZ2lvbi50ZXh0Q29udGVudCA9ICcnOyBzZXRUaW1lb3V0KCgpID0+IHsgbGl2ZVJlZ2lvbi50ZXh0Q29udGVudCA9IG1lc3NhZ2U7IH0sIDEwKTsgfVxyXG4gIHdoaWxlIChjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID49IFRPQVNUX1NUQUNLX01BWCkgY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkLnJlbW92ZSgpO1xyXG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHRvYXN0ICR7dHlwZX1gO1xyXG4gIHRvYXN0LnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MTBweCc7XHJcbiAgY29uc3QgbXNnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIG1zZy50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XHJcbiAgdG9hc3QuYXBwZW5kQ2hpbGQobXNnKTtcclxuICBjb25zdCBidXR0b25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgYnV0dG9ucy5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDtnYXA6NnB4O2FsaWduLWl0ZW1zOmNlbnRlcjtmbGV4LXNocmluazowJztcclxuICBpZiAob3B0cy5hY3Rpb24pIHtcclxuICAgIGNvbnN0IGFjdGlvbkJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgYWN0aW9uQnRuLmNsYXNzTmFtZSA9ICdidG4gZ2hvc3QnO1xyXG4gICAgYWN0aW9uQnRuLnN0eWxlLmNzc1RleHQgPSAnZm9udC1zaXplOjExcHg7cGFkZGluZzoycHggOHB4JztcclxuICAgIGFjdGlvbkJ0bi50ZXh0Q29udGVudCA9IG9wdHMuYWN0aW9uLmxhYmVsO1xyXG4gICAgYWN0aW9uQnRuLm9uY2xpY2sgPSAoKSA9PiB7IHRvYXN0LnJlbW92ZSgpOyBvcHRzLmFjdGlvbi5vbkNsaWNrKCk7IH07XHJcbiAgICBidXR0b25zLmFwcGVuZENoaWxkKGFjdGlvbkJ0bik7XHJcbiAgfVxyXG4gIGNvbnN0IGNsb3NlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgY2xvc2UudGV4dENvbnRlbnQgPSAnw5cnO1xyXG4gIGNsb3NlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEaXNtaXNzJyk7XHJcbiAgY2xvc2Uuc3R5bGUuY3NzVGV4dCA9IGBiYWNrZ3JvdW5kOm5vbmU7Ym9yZGVyOm5vbmU7Y29sb3I6aW5oZXJpdDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MThweDtsaW5lLWhlaWdodDoxO3BhZGRpbmc6MDtmbGV4LXNocmluazowO29wYWNpdHk6JHt0eXBlID09PSAnZXJyb3InID8gJy44JyA6ICcuNSd9YDtcclxuICBjbG9zZS5vbmNsaWNrID0gKCkgPT4gdG9hc3QucmVtb3ZlKCk7XHJcbiAgYnV0dG9ucy5hcHBlbmRDaGlsZChjbG9zZSk7XHJcbiAgdG9hc3QuYXBwZW5kQ2hpbGQoYnV0dG9ucyk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcclxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykgcmV0dXJuO1xyXG4gIGNvbnN0IG1zID0gb3B0cy5kdXJhdGlvbk1zID8/ICh0eXBlID09PSAnd2FybmluZycgPyA2MDAwIDogNDAwMCk7XHJcbiAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICB0b2FzdC5zdHlsZS50cmFuc2l0aW9uID0gJ29wYWNpdHkgLjNzJztcclxuICAgIHRvYXN0LnN0eWxlLm9wYWNpdHkgPSAnMCc7XHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHRvYXN0LnJlbW92ZSgpLCAzMDApO1xyXG4gIH0sIG1zKTtcclxufVxyXG5cclxuLy8g4pSA4pSAIG5ldHdvcmsgZXJyb3IgY29weSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gQSBmZXRjaCgpIHJlamVjdGlvbiBtZWFucyB0aGUgcmVxdWVzdCBuZXZlciBnb3QgYSByZXNwb25zZSAtIG9uIHRoaXMgbG9jYWxob3N0L1xyXG4vLyBFbGVjdHJvbiBhcHAgdGhhdCBhbG1vc3QgYWx3YXlzIG1lYW5zIHRoZSBiYWNrZW5kIHN0b3BwZWQsIG5vdCBhIHJlYWwgbmV0d29yay5cclxuLy8gVGhlIGJyb3dzZXIgcmVwb3J0cyBpdCBhcyBhIFR5cGVFcnJvciB3aG9zZSBtZXNzYWdlIGlzIHRoZSBvcGFxdWUgXCJGYWlsZWQgdG9cclxuLy8gZmV0Y2hcIiwgdXNlbGVzcyB0byBhIG5vbi1kZXZlbG9wZXIuIEFuIEVycm9yIHRocm93biBhZnRlciBhIG5vbi1vayByZXNwb25zZVxyXG4vLyBhbHJlYWR5IGNhcnJpZXMgYSByZWFsLCBzcGVjaWZpYyBtZXNzYWdlLCBzbyBwYXNzIHRob3NlIHRocm91Z2ggdW5jaGFuZ2VkLiBVc2VcclxuLy8gdGhpcyBvbmx5IGF0IGNhdGNoIHNpdGVzIHRoYXQgd3JhcCBhIGJhcmUgZmV0Y2ggKG5vdCBvbmVzIGRvaW5nIERPTSB3b3JrIHRoYXRcclxuLy8gY291bGQgdGhyb3cgaXRzIG93biBUeXBlRXJyb3IpLlxyXG5leHBvcnQgZnVuY3Rpb24gbmV0RXJyTXNnKGVycikge1xyXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBUeXBlRXJyb3IpIHJldHVybiBcIkNvdWxkbid0IHJlYWNoIFl1dUNsaXAgLSBpdCBtYXkgaGF2ZSBzdG9wcGVkLiBUcnkgYWdhaW4sIG9yIHJlc3RhcnQgdGhlIGFwcC5cIjtcclxuICByZXR1cm4gKGVyciAmJiBlcnIubWVzc2FnZSkgfHwgJ1Vua25vd24gZXJyb3InO1xyXG59XHJcblxyXG4vLyDilIDilIAgcmV2ZWFsIGluIGZpbGUgZXhwbG9yZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXZlYWxJbkZvbGRlcihwYXRoKSB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL3JldmVhbCcsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3BhdGh9KSxcclxuICAgIH0pO1xyXG4gICAgaWYgKCFyZXMub2spIHtcclxuICAgICAgY29uc3QgZSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XHJcbiAgICAgIHNob3dUb2FzdChgQ291bGQgbm90IHNob3cgaW4gZm9sZGVyOiAke2UuZGV0YWlsIHx8ICdmYWlsZWQnfWAsICdlcnJvcicpO1xyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgc2hvd1RvYXN0KGBDb3VsZCBub3Qgc2hvdyBpbiBmb2xkZXI6ICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyDilIDilIAgY2xpcGJvYXJkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBUaGUgYXBwIG9ubHkgZXZlciBydW5zIG9uIGxvY2FsaG9zdCBvciBpbnNpZGUgRWxlY3Ryb24sIHNvIG5hdmlnYXRvci5jbGlwYm9hcmRcclxuLy8gaXMgYWx3YXlzIGF2YWlsYWJsZSAtIGEgZmFpbHVyZSB0b2FzdCBpcyBlbm91Z2gsIG5vIGV4ZWNDb21tYW5kIGZhbGxiYWNrLlxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29weVRleHQodGV4dCwgbGFiZWwpIHtcclxuICB0cnkge1xyXG4gICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dCk7XHJcbiAgICBzaG93VG9hc3QoYCR7bGFiZWx9IGNvcGllZGAsICdzdWNjZXNzJyk7XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBzaG93VG9hc3QoYENvdWxkIG5vdCBjb3B5ICR7bGFiZWwudG9Mb3dlckNhc2UoKX06ICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyDilIDilIAgY29sbGFwc2libGUgZGV0YWlsIGNhcmRzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBPcHQtaW46IGJ1aWxkIGEgY2FyZCB3aXRoIGNvbGxhcHNpYmxlQ2FyZChrZXksIHRpdGxlLCBib2R5LCB7YWN0aW9uc30pLiBUaGVcclxuLy8gdGl0bGUgaXMgcmVuZGVyZWQgaW5zaWRlIGEgcmVhbCA8YnV0dG9uIGNsYXNzPVwiY2FyZC10b2dnbGVcIj4sIHNvIHRoZSB0b2dnbGVcclxuLy8gaGFzIG5hdGl2ZSBrZXlib2FyZC9mb2N1cyBiZWhhdmlvdXIgYW5kIC0gYmVjYXVzZSBzaG9ydGN1dHMuanMncyBnbG9iYWxcclxuLy8ga2V5ZG93biBiYWlscyBvbiB0YWdOYW1lID09PSAnQlVUVE9OJyAtIFNwYWNlIG9uIGEgZm9jdXNlZCB0b2dnbGUgbmV2ZXIgYWxzb1xyXG4vLyBmaXJlcyBwbGF5L3BhdXNlLiBIZWFkZXIgYWN0aW9uIGNvbnRyb2xzIGFyZSBwYXNzZWQgdmlhIG9wdHMuYWN0aW9ucyBhbmQgc2l0XHJcbi8vIGFzIFNJQkxJTkdTIG9mIHRoZSB0b2dnbGUgYnV0dG9uLCBuZXZlciBkZXNjZW5kYW50cywgc28gYSBidXR0b24gbmV2ZXIgbmVzdHNcclxuLy8gaW5zaWRlIHRoZSB0b2dnbGUgKFdDQUcgNC4xLjIgbmVzdGVkLWludGVyYWN0aXZlKS4gU2VlZGVkIGZyb20gaXNDYXJkQ29sbGFwc2VkKGtleSkuXHJcbmNvbnN0IF9DQVJEX0NPTExBUFNFX0tFWSA9ICd5dXVjbGlwLWNhcmQtY29sbGFwc2VkJztcclxuXHJcbmZ1bmN0aW9uIF9jYXJkQ29sbGFwc2VTdGF0ZSgpIHtcclxuICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShfQ0FSRF9DT0xMQVBTRV9LRVkpIHx8ICd7fScpIHx8IHt9OyB9XHJcbiAgY2F0Y2ggeyByZXR1cm4ge307IH1cclxufVxyXG5cclxuLy8gUGVyc2lzdGVkIGNvbGxhcHNlIHN0YXRlIHBlciBjYXJkIGtleS4gZGVmYXVsdENvbGxhcHNlZCBsZXRzIGEgY2FyZCAoZS5nLiB0aGVcclxuLy8gaGVhdnkgZnVsbC12aWRlbyB0cmFuc2NyaXB0KSBzdGFydCBjb2xsYXBzZWQgdW50aWwgdGhlIHVzZXIgb3BlbnMgaXQuXHJcbmZ1bmN0aW9uIGlzQ2FyZENvbGxhcHNlZChrZXksIGRlZmF1bHRDb2xsYXBzZWQgPSBmYWxzZSkge1xyXG4gIGNvbnN0IHN0YXRlID0gX2NhcmRDb2xsYXBzZVN0YXRlKCk7XHJcbiAgcmV0dXJuIGtleSBpbiBzdGF0ZSA/ICEhc3RhdGVba2V5XSA6IGRlZmF1bHRDb2xsYXBzZWQ7XHJcbn1cclxuXHJcbi8vIFNpbmdsZSBzb3VyY2Ugb2YgdGhlIGNvbGxhcHNpYmxlLWNhcmQgbWFya3VwIGNvbnRyYWN0OiB0aGUgfjExIGRldGFpbCBjYXJkc1xyXG4vLyB0aGF0IG9wdCBpbiBhbGwgcmVuZGVyIHRocm91Z2ggaGVyZSBzbyBub25lIGNhbiBkcmlmdCBmcm9tIHRoZSBjbGFzcyAvXHJcbi8vIGRhdGEtY29sbGFwc2Uta2V5IC8gdG9nZ2xlLWExMXkgYXR0cmlidXRlcyB0aGUgdG9nZ2xlIGxvZ2ljIGJlbG93IHJlYWRzLlxyXG4vLyB0aXRsZSA9IHRoZSBoZWFkZXIncyB0aXRsZSBjb250ZW50IChnb2VzIGluc2lkZSB0aGUgdG9nZ2xlIGJ1dHRvbik7IGJvZHkgPVxyXG4vLyBldmVyeXRoaW5nIHNob3duIGJlbG93IHRoZSBoZWFkZXIuIG9wdHMuYWN0aW9ucyA9IGhlYWRlciBjb250cm9scyByZW5kZXJlZFxyXG4vLyBiZXNpZGUgdGhlIHRvZ2dsZTsgb3B0cy5kZWZhdWx0Q29sbGFwc2VkIHN0YXJ0cyBhIGNhcmQgY29sbGFwc2VkIHVudGlsIGZpcnN0XHJcbi8vIG9wZW5lZDsgb3B0cy5hdHRycyBhZGRzIGNhcmQgYXR0cmlidXRlcyAoaWQsIGRhdGEtKik7IG9wdHMuaGVhZGVyU3R5bGUgc2V0c1xyXG4vLyBhbiBpbmxpbmUgc3R5bGUgb24gdGhlIGhlYWRlciByb3cuXHJcbmV4cG9ydCBmdW5jdGlvbiBjb2xsYXBzaWJsZUNhcmQoa2V5LCB0aXRsZSwgYm9keSwgb3B0cyA9IHt9KSB7XHJcbiAgY29uc3QgeyBkZWZhdWx0Q29sbGFwc2VkID0gZmFsc2UsIGF0dHJzID0gJycsIGhlYWRlclN0eWxlID0gJycsIGFjdGlvbnMgPSAnJyB9ID0gb3B0cztcclxuICBjb25zdCBjb2xsYXBzZWQgPSBpc0NhcmRDb2xsYXBzZWQoa2V5LCBkZWZhdWx0Q29sbGFwc2VkKTtcclxuICBjb25zdCBzdHlsZUF0dHIgPSBoZWFkZXJTdHlsZSA/IGAgc3R5bGU9XCIke2hlYWRlclN0eWxlfVwiYCA6ICcnO1xyXG4gIGNvbnN0IGV4dHJhQXR0cnMgPSBhdHRycyA/IGAgJHthdHRyc31gIDogJyc7XHJcbiAgcmV0dXJuIGBcclxuICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZCBjb2xsYXBzaWJsZSR7Y29sbGFwc2VkID8gJyBjb2xsYXBzZWQnIDogJyd9XCIgZGF0YS1jb2xsYXBzZS1rZXk9XCIke2tleX1cIiR7ZXh0cmFBdHRyc30+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZC1oZWFkZXJcIiR7c3R5bGVBdHRyfT5cclxuICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNhcmQtdG9nZ2xlXCIgYXJpYS1leHBhbmRlZD1cIiR7Y29sbGFwc2VkID8gJ2ZhbHNlJyA6ICd0cnVlJ31cIj4ke3RpdGxlfTwvYnV0dG9uPlxyXG4gICAgICAgICR7YWN0aW9uc31cclxuICAgICAgPC9kaXY+XHJcbiAgICAgICR7Ym9keX1cclxuICAgIDwvZGl2PmA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF90b2dnbGVDb2xsYXBzaWJsZUNhcmQoY2FyZCwgdG9nZ2xlKSB7XHJcbiAgY29uc3QgY29sbGFwc2VkID0gY2FyZC5jbGFzc0xpc3QudG9nZ2xlKCdjb2xsYXBzZWQnKTtcclxuICB0b2dnbGUuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgY29sbGFwc2VkID8gJ2ZhbHNlJyA6ICd0cnVlJyk7XHJcbiAgY29uc3Qga2V5ID0gY2FyZC5kYXRhc2V0LmNvbGxhcHNlS2V5O1xyXG4gIGlmICgha2V5KSByZXR1cm47XHJcbiAgLy8gUGVyc2lzdCBiZXN0LWVmZm9ydDogYSB3cml0ZSBmYWlsdXJlIChwcml2YXRlIG1vZGUsIHF1b3RhKSBtdXN0IG5vdCBzd2FsbG93XHJcbiAgLy8gdGhlIHRvZ2dsZSBvciBibG9jayB0aGUgbGF6eS1sb2FkIGRpc3BhdGNoIGJlbG93LiBUaGUgcmVhZCBwYXRoXHJcbiAgLy8gKF9jYXJkQ29sbGFwc2VTdGF0ZSkgaXMgbGlrZXdpc2UgdG9sZXJhbnQuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHN0YXRlID0gX2NhcmRDb2xsYXBzZVN0YXRlKCk7XHJcbiAgICBzdGF0ZVtrZXldID0gY29sbGFwc2VkO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oX0NBUkRfQ09MTEFQU0VfS0VZLCBKU09OLnN0cmluZ2lmeShzdGF0ZSkpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgY29uc29sZS53YXJuKCdDb3VsZCBub3QgcGVyc2lzdCBjYXJkIGNvbGxhcHNlIHN0YXRlOicsIGVycik7XHJcbiAgfVxyXG4gIC8vIExldHMgYSBjYXJkIGxhenktbG9hZCBpdHMgYm9keSB0aGUgZmlyc3QgdGltZSBpdCBpcyBleHBhbmRlZC5cclxuICBjYXJkLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdjYXJkdG9nZ2xlJywgeyBidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsga2V5LCBjb2xsYXBzZWQgfSB9KSk7XHJcbn1cclxuXHJcbi8vIE9ubHkgdGhlIGNhcmQncyBvd24gdG9nZ2xlIGJ1dHRvbiBjb2xsYXBzZXMgaXQgKG5hdGl2ZSBFbnRlci9TcGFjZSBhY3RpdmF0ZSBpdFxyXG4vLyB0b28pLiBOZXN0ZWQgaGVhZGVycyBpbnNpZGUgYSBjb21wb3VuZCBjYXJkJ3MgYm9keSBjYXJyeSBubyAuY2FyZC10b2dnbGUsIHNvXHJcbi8vIHRoZXkgbmVpdGhlciB0b2dnbGUgbm9yIHNob3cgYSBjaGV2cm9uLlxyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgY29uc3QgdG9nZ2xlID0gZS50YXJnZXQuY2xvc2VzdCgnLmNhcmQtdG9nZ2xlJyk7XHJcbiAgaWYgKCF0b2dnbGUpIHJldHVybjtcclxuICBjb25zdCBjYXJkID0gdG9nZ2xlLmNsb3Nlc3QoJy5kZXRhaWwtY2FyZC5jb2xsYXBzaWJsZScpO1xyXG4gIGlmIChjYXJkKSBfdG9nZ2xlQ29sbGFwc2libGVDYXJkKGNhcmQsIHRvZ2dsZSk7XHJcbn0pO1xyXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgVUkgcHJpbWl0aXZlcyAoYWxlcnQgLyBjb25maXJtIC8gcHJvbXB0IG1vZGFscykgdXNlZCBhcHAtd2lkZS5cbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IGNvdmVyZWQgaW5kaXJlY3RseSBieSB0aGUgdGVzdF91aV8qLnB5IHN1aXRlc1xuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IGVzY0h0bWwgfSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5cbi8vIOKUgOKUgCBhbGVydCBtb2RhbCAoc2luZ2xlLWJ1dHRvbiwgbm8gY2FuY2VsKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWxlcnRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIHNob3dBbGVydCh0aXRsZSwgYm9keSkge1xuICBfYWxlcnRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtdGl0bGUnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtYm9keScpLmlubmVySFRNTCA9IGJvZHk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYWxlcnQtbW9kYWwgLmJ0bicpLmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUFsZXJ0TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2FsZXJ0T3BlbmVyO1xuICBfYWxlcnRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBjb25maXJtIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9jb25maXJtT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBzaG93Q29uZmlybSh0aXRsZSwgYm9keSwgb2tMYWJlbCwgb25PaywgZGFuZ2VyID0gZmFsc2UsIGNhbmNlbExhYmVsID0gJ0NhbmNlbCcpIHtcbiAgX2NvbmZpcm1PcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWJvZHknKS5pbm5lckhUTUwgPSBib2R5O1xuICBjb25zdCBvayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW9rLWJ0bicpO1xuICBvay50ZXh0Q29udGVudCA9IG9rTGFiZWw7XG4gIG9rLmNsYXNzTmFtZSA9IGRhbmdlciA/ICdidG4gZGFuZ2VyJyA6ICdidG4gcHJpbWFyeSc7XG4gIC8vIEV2ZXJ5IGNhbGwgc2V0cyBpdCwgc28gdGhlIGRlZmF1bHQgJ0NhbmNlbCcgaXMgcmVzdG9yZWQgZm9yIGNhbGxlcnMgdGhhdFxuICAvLyBkb24ndCBwYXNzIGEgY3VzdG9tIGxhYmVsIC0gbm8gc3RhbGUgbGFiZWwgbGVha3MgYmV0d2VlbiBjb25maXJtcy5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tY2FuY2VsLWJ0bicpLnRleHRDb250ZW50ID0gY2FuY2VsTGFiZWw7XG4gIEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjayA9IG9uT2s7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWNhbmNlbC1idG4nKS5mb2N1cygpLCA1MCk7XG59XG5mdW5jdGlvbiBfY29uZmlybU9rKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3QgY2IgPSBBcHBTdGF0ZS5jb25maXJtQ2FsbGJhY2s7XG4gIEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjayA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9jb25maXJtT3BlbmVyO1xuICBfY29uZmlybU9wZW5lciA9IG51bGw7XG4gIGlmIChjYikgY2IoKTtcbiAgZWxzZSBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5leHBvcnQgZnVuY3Rpb24gX2NvbmZpcm1DYW5jZWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBBcHBTdGF0ZS5jb25maXJtQ2FsbGJhY2sgPSBudWxsO1xuICBjb25zdCBvcGVuZXIgPSBfY29uZmlybU9wZW5lcjtcbiAgX2NvbmZpcm1PcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBhZGRpdGlvbmFsIGFjdGlvbnMgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2FjdGlvbnNNb2RhbE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkFjdGlvbnNNb2RhbCh0aXRsZSwgZ3JvdXBzKSB7XG4gIF9hY3Rpb25zTW9kYWxPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC1ib2R5Jyk7XG4gIGJvZHkuaW5uZXJIVE1MID0gJyc7XG4gIGdyb3Vwcy5mb3JFYWNoKChncm91cCwgaSkgPT4ge1xuICAgIGlmIChpID4gMCkge1xuICAgICAgY29uc3QgZGl2aWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgZGl2aWRlci5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWRpdmlkZXInO1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChkaXZpZGVyKTtcbiAgICB9XG4gICAgaWYgKGdyb3VwLmhlYWRpbmcpIHtcbiAgICAgIGNvbnN0IGhlYWRpbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGhlYWRpbmcuY2xhc3NOYW1lID0gJ3NlY3Rpb24tdGl0bGUnO1xuICAgICAgaGVhZGluZy5zdHlsZS5jc3NUZXh0ID0gJ21hcmdpbjo4cHggMCAycHggNHB4JztcbiAgICAgIGhlYWRpbmcudGV4dENvbnRlbnQgPSBncm91cC5oZWFkaW5nO1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChoZWFkaW5nKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCByb3cgb2YgZ3JvdXAucm93cykge1xuICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgIGVsLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGVsLmNsYXNzTmFtZSA9ICdhY3Rpb24tcm93JyArIChyb3cuZGFuZ2VyID8gJyBkYW5nZXInIDogJycpO1xuICAgICAgZWwuZGlzYWJsZWQgPSAhIXJvdy5kaXNhYmxlZDtcbiAgICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgbGFiZWwuY2xhc3NOYW1lID0gJ2FjdGlvbi1yb3ctbGFiZWwnO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSByb3cubGFiZWw7XG4gICAgICBjb25zdCBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgZGVzYy5jbGFzc05hbWUgPSAnYWN0aW9uLXJvdy1kZXNjJztcbiAgICAgIGRlc2MudGV4dENvbnRlbnQgPSByb3cuZGVzY3JpcHRpb247XG4gICAgICBlbC5hcHBlbmQobGFiZWwsIGRlc2MpO1xuICAgICAgZWwub25jbGljayA9ICgpID0+IHsgY2xvc2VBY3Rpb25zTW9kYWwoKTsgcm93LmFjdGlvbigpOyB9O1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChlbCk7XG4gICAgfVxuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGlvbnMtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gYm9keS5xdWVyeVNlbGVjdG9yKCcuYWN0aW9uLXJvdzpub3QoOmRpc2FibGVkKScpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VBY3Rpb25zTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfYWN0aW9uc01vZGFsT3BlbmVyO1xuICBfYWN0aW9uc01vZGFsT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgbW9kYWwgbGF5ZXJpbmcgKyBmb2N1cyB0cmFwIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29uZmlybSBhbmQgYWxlcnQgYXJlIHRoZSBvbmx5IG1vZGFscyB0aGF0IHN0YWNrIG9uIHRvcCBvZiBvdGhlciBtb2RhbHMsIHNvXG4vLyB0aGV5IHRha2UgcHJpb3JpdHk7IG90aGVyd2lzZSBhbGwgLm1vZGFsLWJnIHNoYXJlIHotaW5kZXggMjAwIGFuZCB0aGUgbGFzdFxuLy8gdmlzaWJsZSBvbmUgaW4gRE9NIG9yZGVyIGlzIHRoZSBvbmUgcGFpbnRlZCBvbiB0b3AuXG5leHBvcnQgZnVuY3Rpb24gdG9wbW9zdFZpc2libGVNb2RhbCgpIHtcbiAgZm9yIChjb25zdCBpZCBvZiBbJ2NvbmZpcm0tbW9kYWwnLCAnYWxlcnQtbW9kYWwnXSkge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuICAgIGlmIChlbC5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgcmV0dXJuIGVsO1xuICB9XG4gIGNvbnN0IHZpc2libGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubW9kYWwtYmcudmlzaWJsZScpO1xuICByZXR1cm4gdmlzaWJsZS5sZW5ndGggPyB2aXNpYmxlW3Zpc2libGUubGVuZ3RoIC0gMV0gOiBudWxsO1xufVxuXG5jb25zdCBfRk9DVVNBQkxFX1NFTEVDVE9SID1cbiAgJ2FbaHJlZl0sIGJ1dHRvbjpub3QoOmRpc2FibGVkKSwgaW5wdXQ6bm90KDpkaXNhYmxlZCksIHNlbGVjdDpub3QoOmRpc2FibGVkKSwgJyArXG4gICd0ZXh0YXJlYTpub3QoOmRpc2FibGVkKSwgW3RhYmluZGV4XTpub3QoW3RhYmluZGV4PVwiLTFcIl0pJztcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xuICBpZiAoZS5rZXkgIT09ICdUYWInKSByZXR1cm47XG4gIGNvbnN0IG1vZGFsID0gdG9wbW9zdFZpc2libGVNb2RhbCgpO1xuICBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGZvY3VzYWJsZXMgPSBbLi4ubW9kYWwucXVlcnlTZWxlY3RvckFsbChfRk9DVVNBQkxFX1NFTEVDVE9SKV1cbiAgICAuZmlsdGVyKGVsID0+IGVsLmdldENsaWVudFJlY3RzKCkubGVuZ3RoID4gMCk7XG4gIGlmICghZm9jdXNhYmxlcy5sZW5ndGgpIHJldHVybjtcbiAgY29uc3QgZmlyc3QgPSBmb2N1c2FibGVzWzBdO1xuICBjb25zdCBsYXN0ICA9IGZvY3VzYWJsZXNbZm9jdXNhYmxlcy5sZW5ndGggLSAxXTtcbiAgaWYgKCFtb2RhbC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAoZS5zaGlmdEtleSA/IGxhc3QgOiBmaXJzdCkuZm9jdXMoKTtcbiAgfSBlbHNlIGlmICghZS5zaGlmdEtleSAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBsYXN0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGZpcnN0LmZvY3VzKCk7XG4gIH0gZWxzZSBpZiAoZS5zaGlmdEtleSAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBmaXJzdCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBsYXN0LmZvY3VzKCk7XG4gIH1cbn0pO1xuXG4vLyDilIDilIAgbWVudSBrZXlib2FyZCBwYXR0ZXJuIChoYW1idXJnZXIgKyBrZWJhYikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBfbWVudUZvY3VzYWJsZUl0ZW1zKG1lbnUpIHtcbiAgcmV0dXJuIFsuLi5tZW51LnF1ZXJ5U2VsZWN0b3JBbGwoJy5oYW1idXJnZXItaXRlbScpXVxuICAgIC5maWx0ZXIoZWwgPT4gIWVsLmRpc2FibGVkICYmIGVsLmdldENsaWVudFJlY3RzKCkubGVuZ3RoID4gMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfbWVudUFycm93S2V5ZG93bihtZW51LCBlKSB7XG4gIGlmIChlLmtleSAhPT0gJ0Fycm93RG93bicgJiYgZS5rZXkgIT09ICdBcnJvd1VwJykgcmV0dXJuO1xuICBjb25zdCBpdGVtcyA9IF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSk7XG4gIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgY29uc3QgaWR4ICA9IGl0ZW1zLmluZGV4T2YoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7XG4gIGNvbnN0IHN0ZXAgPSBlLmtleSA9PT0gJ0Fycm93RG93bicgPyAxIDogLTE7XG4gIGl0ZW1zWyhpZHggKyBzdGVwICsgaXRlbXMubGVuZ3RoKSAlIGl0ZW1zLmxlbmd0aF0uZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGhhbWJ1cmdlciBtZW51IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZXhwb3J0IGZ1bmN0aW9uIGlzSGFtYnVyZ2VyT3BlbigpIHtcbiAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpLmNsYXNzTGlzdC5jb250YWlucygnb3BlbicpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUhhbWJ1cmdlcigpIHtcbiAgY29uc3QgbWVudSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpO1xuICBtZW51LmNsYXNzTGlzdC50b2dnbGUoJ29wZW4nKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1oYW1idXJnZXInKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBtZW51LmNsYXNzTGlzdC5jb250YWlucygnb3BlbicpKTtcbiAgaWYgKG1lbnUuY2xhc3NMaXN0LmNvbnRhaW5zKCdvcGVuJykpIF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSlbMF0/LmZvY3VzKCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VIYW1idXJnZXIocmVmb2N1c1RyaWdnZXIgPSBmYWxzZSkge1xuICBjb25zdCBtZW51ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51Jyk7XG4gIC8vIEZvY3VzIHNpdHRpbmcgb24gYW4gaXRlbSBhYm91dCB0byBiZSBkaXNwbGF5Om5vbmUnZCB3b3VsZCBzaWxlbnRseSBmYWxsIHRvXG4gIC8vIDxib2R5PjsgaGFuZCBpdCB0byB0aGUgdHJpZ2dlciBmaXJzdCBzbyBpdCBoYXMgc29tZXdoZXJlIHJlYWwgdG8gZ28uXG4gIGlmIChyZWZvY3VzVHJpZ2dlciB8fCBtZW51LmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1oYW1idXJnZXInKS5mb2N1cygpO1xuICB9XG4gIG1lbnUuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xufVxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51JykuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xuICBfbWVudUFycm93S2V5ZG93bihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKSwgZSk7XG59KTtcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XG4gIGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci13cmFwJykuY29udGFpbnMoZS50YXJnZXQpKSB7XG4gICAgY2xvc2VIYW1idXJnZXIoKTtcbiAgfVxufSk7XG5cbi8vIOKUgOKUgCBjb250cm9scyBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfY29udHJvbHNPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5Db250cm9sc01vZGFsKCkge1xuICBfY29udHJvbHNPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbHMtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NvbnRyb2xzLW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQ29udHJvbHNNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRyb2xzLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfY29udHJvbHNPcGVuZXI7XG4gIF9jb250cm9sc09wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGRpZmYgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBfZGlmZlN0YXRlOiB7dGl0bGUsIGZpZWxkczpbe2xhYmVsLGN1cnJlbnQscHJvcG9zZWR9XSwgb25Db21taXQoYWN0aW9uLCBlZGl0ZWRWYWx1ZXMpfVxubGV0IF9kaWZmU3RhdGUgPSBudWxsO1xubGV0IF9kaWZmT3BlbmVyID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5EaWZmTW9kYWwodGl0bGUsIGZpZWxkcywgb25Db21taXQsIG9wdHMgPSB7fSkge1xuICBfZGlmZk9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIF9kaWZmU3RhdGUgPSB7dGl0bGUsIGZpZWxkcywgb25Db21taXR9O1xuICBjb25zdCByZXZlcnQgPSBvcHRzLnJldmVydE1vZGUgfHwgZmFsc2U7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZmllbGRzJyk7XG4gIGNvbnRhaW5lci5pbm5lckhUTUwgPSBmaWVsZHMubWFwKChmLCBpKSA9PiBgXG4gICAgPGRpdiBjbGFzcz1cImRpZmYtZmllbGQtZ3JvdXBcIj5cbiAgICAgICR7ZmllbGRzLmxlbmd0aCA+IDEgPyBgPGRpdiBjbGFzcz1cImRpZmYtZmllbGQtdGl0bGVcIj4ke2VzY0h0bWwoZi5sYWJlbCl9PC9kaXY+YCA6ICcnfVxuICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWxzXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWwtbGFiZWxcIj4ke3JldmVydCA/ICdZb3VyIEVkaXQnIDogJ0N1cnJlbnQnfTwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLWN1cnJlbnQke2YuY3VycmVudCA/ICcnIDogJyBlbXB0eSd9XCI+JHtcbiAgICAgICAgICAgIGYuY3VycmVudCA/IGVzY0h0bWwoZi5jdXJyZW50KSA6ICcobm9uZSB5ZXQpJ1xuICAgICAgICAgIH08L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWwtbGFiZWxcIj4ke3JldmVydCA/ICdPcmlnaW5hbCAoTExNKScgOiAnTmV3IC0gZWRpdCBoZXJlLCB0aGVuIGNob29zZSBiZWxvdyd9PC9kaXY+XG4gICAgICAgICAgJHtyZXZlcnRcbiAgICAgICAgICAgID8gYDxkaXYgY2xhc3M9XCJkaWZmLWN1cnJlbnQke2YucHJvcG9zZWQgPyAnJyA6ICcgZW1wdHknfVwiPiR7Zi5wcm9wb3NlZCA/IGVzY0h0bWwoZi5wcm9wb3NlZCkgOiAnKG5vbmUpJ308L2Rpdj5gXG4gICAgICAgICAgICA6IGA8dGV4dGFyZWEgY2xhc3M9XCJkaWZmLW5ld1wiIGlkPVwiZGlmZi1uZXctJHtpfVwiIHJvd3M9XCI0XCI+JHtlc2NIdG1sKGYucHJvcG9zZWQgfHwgJycpfTwvdGV4dGFyZWE+YFxuICAgICAgICAgIH1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gKS5qb2luKCcnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZGlzY2FyZC1idG4nKS50ZXh0Q29udGVudCAgID0gcmV2ZXJ0ID8gJ0tlZXAgTXkgRWRpdCcgOiAnRGlzY2FyZCc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1lZGl0LWJ0bicpLnN0eWxlLmRpc3BsYXkgPSByZXZlcnQgPyAnbm9uZScgOiAnJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtYWNjZXB0LW5ldy1idG4nKS50ZXh0Q29udGVudCA9IHJldmVydCA/ICdSZXZlcnQgdG8gT3JpZ2luYWwnIDogJ0FjY2VwdCBhcy1pcyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBjb25zdCBmaXJzdFRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbmV3LTAnKTtcbiAgICBpZiAoZmlyc3RUYSkgZmlyc3RUYS5mb2N1cygpO1xuICAgIGVsc2UgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZGlzY2FyZC1idG4nKT8uZm9jdXMoKTtcbiAgfSwgNTApO1xufVxuXG5mdW5jdGlvbiBfZGlmZkdldEVkaXRlZCgpIHtcbiAgcmV0dXJuIChfZGlmZlN0YXRlPy5maWVsZHMgfHwgW10pLm1hcCgoXywgaSkgPT4ge1xuICAgIGNvbnN0IHRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGRpZmYtbmV3LSR7aX1gKTtcbiAgICByZXR1cm4gdGEgPyB0YS52YWx1ZSA6ICcnO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gX2RpZmZDbG9zZURvbmUoKSB7XG4gIGNvbnN0IG9wZW5lciA9IF9kaWZmT3BlbmVyO1xuICBfZGlmZk9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuZnVuY3Rpb24gX2RpZmZBY2NlcHROZXcoKSB7XG4gIGNvbnN0IGVkaXRlZCA9IF9kaWZmR2V0RWRpdGVkKCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBjYiA9IF9kaWZmU3RhdGU/Lm9uQ29tbWl0O1xuICBfZGlmZlN0YXRlID0gbnVsbDtcbiAgX2RpZmZPcGVuZXIgPSBudWxsO1xuICBpZiAoY2IpIGNiKCdhY2NlcHRfbmV3JywgZWRpdGVkKTtcbn1cblxuZnVuY3Rpb24gX2RpZmZBY2NlcHRFZGl0KCkge1xuICBjb25zdCBlZGl0ZWQgPSBfZGlmZkdldEVkaXRlZCgpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3QgY2IgPSBfZGlmZlN0YXRlPy5vbkNvbW1pdDtcbiAgX2RpZmZTdGF0ZSA9IG51bGw7XG4gIF9kaWZmT3BlbmVyID0gbnVsbDtcbiAgaWYgKGNiKSBjYignYWNjZXB0X2VkaXQnLCBlZGl0ZWQpO1xufVxuXG5mdW5jdGlvbiBfZGlmZkRpcnR5KCkge1xuICByZXR1cm4gKF9kaWZmU3RhdGU/LmZpZWxkcyB8fCBbXSkuc29tZSgoZiwgaSkgPT4ge1xuICAgIGNvbnN0IHRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGRpZmYtbmV3LSR7aX1gKTtcbiAgICByZXR1cm4gdGEgJiYgdGEudmFsdWUgIT09IChmLnByb3Bvc2VkIHx8ICcnKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZGlmZkRpc2NhcmQoKSB7XG4gIGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgcmV0dXJuO1xuICBpZiAoX2RpZmZEaXJ0eSgpKSB7XG4gICAgc2hvd0NvbmZpcm0oXG4gICAgICAnRGlzY2FyZCBlZGl0PycsXG4gICAgICAnWW91IGhhdmUgdW5zYXZlZCBjaGFuZ2VzLiBDbG9zZSB3aXRob3V0IHNhdmluZz8nLFxuICAgICAgJ0Rpc2NhcmQnLFxuICAgICAgX2RvRGlmZkRpc2NhcmQsXG4gICAgICB0cnVlLFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9kb0RpZmZEaXNjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIF9kb0RpZmZEaXNjYXJkKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgX2RpZmZTdGF0ZSA9IG51bGw7XG4gIF9kaWZmQ2xvc2VEb25lKCk7XG59XG5cbi8vIOKUgOKUgCBmaWVsZCBlZGl0IG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9maWVsZEVkaXRDYWxsYmFjayA9IG51bGw7XG5sZXQgX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWUgPSAnJztcbmxldCBfZmllbGRFZGl0T3BlbmVyID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5GaWVsZEVkaXRNb2RhbCh0aXRsZSwgY3VycmVudFZhbHVlLCBvblNhdmUpIHtcbiAgX2ZpZWxkRWRpdE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIF9maWVsZEVkaXRPcmlnaW5hbFZhbHVlID0gY3VycmVudFZhbHVlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZSA9IGN1cnJlbnRWYWx1ZTtcbiAgX2ZpZWxkRWRpdENhbGxiYWNrID0gb25TYXZlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykuZm9jdXMoKSwgNTApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xvc2VGaWVsZEVkaXRNb2RhbCgpIHtcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1tb2RhbCcpLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpKSByZXR1cm47XG4gIGNvbnN0IGN1cnJlbnRWYWx1ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZTtcbiAgaWYgKGN1cnJlbnRWYWx1ZSAhPT0gX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWUpIHtcbiAgICBzaG93Q29uZmlybShcbiAgICAgICdEaXNjYXJkIGVkaXQ/JyxcbiAgICAgICdZb3UgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuIENsb3NlIHdpdGhvdXQgc2F2aW5nPycsXG4gICAgICAnRGlzY2FyZCcsXG4gICAgICBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsLFxuICAgICAgdHJ1ZSxcbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuICBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsKCk7XG59XG5cbmZ1bmN0aW9uIF9kb0Nsb3NlRmllbGRFZGl0TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBfZmllbGRFZGl0Q2FsbGJhY2sgPSBudWxsO1xuICBjb25zdCBvcGVuZXIgPSBfZmllbGRFZGl0T3BlbmVyO1xuICBfZmllbGRFZGl0T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBfZmllbGRFZGl0U2F2ZSgpIHtcbiAgY29uc3QgdmFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLnZhbHVlO1xuICBjb25zdCBjYiA9IF9maWVsZEVkaXRDYWxsYmFjaztcbiAgX2RvQ2xvc2VGaWVsZEVkaXRNb2RhbCgpO1xuICBpZiAoY2IpIGNiKHZhbCk7XG59XG5cbi8vIFJlZnJlc2gvY2xvc2Ugd2l0aCBhIGRpcnR5IGVkaXRvciBvcGVuIHdvdWxkIHNpbGVudGx5IGxvc2UgdGhlIGVkaXQgLSB0aGVcbi8vIHNhbWUgcHJvdGVjdGlvbiBjbG9zZUZpZWxkRWRpdE1vZGFsL19kaWZmRGlzY2FyZCBnaXZlIEVzY2FwZSBhbmQgRGlzY2FyZC5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBlID0+IHtcbiAgY29uc3QgZmllbGRFZGl0RGlydHkgPVxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykgJiZcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykudmFsdWUgIT09IF9maWVsZEVkaXRPcmlnaW5hbFZhbHVlO1xuICBjb25zdCBkaWZmRGlydHkgPVxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykgJiYgX2RpZmZEaXJ0eSgpO1xuICBpZiAoZmllbGRFZGl0RGlydHkgfHwgZGlmZkRpcnR5KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUucmV0dXJuVmFsdWUgPSAnJztcbiAgfVxufSk7XG5cbi8vIOKUgOKUgCBrZWJhYiBtZW51cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWN0aXZlS2ViYWIgPSBudWxsO1xubGV0IF9hY3RpdmVLZWJhYkFuY2hvciA9IG51bGw7XG5sZXQgX2tlYmFiRGlzbWlzcyA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUtlYmFiKHJlZm9jdXNBbmNob3IgPSBmYWxzZSkge1xuICBpZiAoIV9hY3RpdmVLZWJhYikgcmV0dXJuIGZhbHNlO1xuICBfYWN0aXZlS2ViYWIucmVtb3ZlKCk7XG4gIF9hY3RpdmVLZWJhYiA9IG51bGw7XG4gIGlmIChfa2ViYWJEaXNtaXNzKSB7IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgX2tlYmFiRGlzbWlzcyk7IF9rZWJhYkRpc21pc3MgPSBudWxsOyB9XG4gIGNvbnN0IGFuY2hvciA9IF9hY3RpdmVLZWJhYkFuY2hvcjtcbiAgX2FjdGl2ZUtlYmFiQW5jaG9yID0gbnVsbDtcbiAgaWYgKGFuY2hvcj8uaGFzQXR0cmlidXRlPy4oJ2FyaWEtaGFzcG9wdXAnKSkgYW5jaG9yLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xuICBpZiAocmVmb2N1c0FuY2hvciAmJiBhbmNob3I/LmZvY3VzKSBhbmNob3IuZm9jdXMoKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93S2ViYWIoYW5jaG9yRWwsIGl0ZW1zKSB7XG4gIGNsb3NlS2ViYWIoKTtcbiAgY29uc3QgbWVudSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBtZW51LmNsYXNzTmFtZSA9ICdoYW1idXJnZXItbWVudSBvcGVuJztcbiAgLy8gcmlnaHQ6YXV0byBjbGVhcnMgdGhlIC5oYW1idXJnZXItbWVudSBiYXNlIHJ1bGUncyByaWdodDowIC0gb3RoZXJ3aXNlIHRoZVxuICAvLyBmaXhlZCBtZW51LCB3aXRoIGJvdGggbGVmdCBhbmQgcmlnaHQgc2V0LCBzdHJldGNoZXMgdG8gdGhlIHZpZXdwb3J0IGVkZ2UuXG4gIG1lbnUuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjpmaXhlZDt6LWluZGV4OjUwMDttaW4td2lkdGg6MTYwcHg7cmlnaHQ6YXV0byc7XG4gIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgIGlmIChpdGVtID09PSBudWxsKSB7XG4gICAgICBjb25zdCBzZXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHNlcC5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWRpdmlkZXInO1xuICAgICAgbWVudS5hcHBlbmRDaGlsZChzZXApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIGJ0bi5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWl0ZW0nO1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IGl0ZW0ubGFiZWw7XG4gICAgaWYgKGl0ZW0uZGlzYWJsZWQpIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gICAgLy8gUmVmb2N1cyB0aGUgYW5jaG9yIGJlZm9yZSB0aGUgYWN0aW9uIHJ1bnMgc28gYW55dGhpbmcgdGhlIGFjdGlvbiBvcGVuc1xuICAgIC8vIHJlY29yZHMgdGhlIGFuY2hvciAtIG5vdCBhIHJlbW92ZWQgbWVudSBpdGVtIC0gYXMgaXRzIHJldHVybi1mb2N1cyB0YXJnZXQuXG4gICAgYnRuLm9uY2xpY2sgPSAoKSA9PiB7IGNsb3NlS2ViYWIodHJ1ZSk7IGl0ZW0uYWN0aW9uKCk7IH07XG4gICAgbWVudS5hcHBlbmRDaGlsZChidG4pO1xuICB9XG4gIG1lbnUuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4gX21lbnVBcnJvd0tleWRvd24obWVudSwgZSkpO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICBfYWN0aXZlS2ViYWIgPSBtZW51O1xuICBfYWN0aXZlS2ViYWJBbmNob3IgPSBhbmNob3JFbDtcbiAgaWYgKGFuY2hvckVsPy5oYXNBdHRyaWJ1dGU/LignYXJpYS1oYXNwb3B1cCcpKSBhbmNob3JFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xuXG4gIGNvbnN0IHJlY3QgPSBhbmNob3JFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgbGV0IHRvcCAgPSByZWN0LmJvdHRvbSArIDQ7XG4gIGxldCBsZWZ0ID0gcmVjdC5yaWdodCAtIG1lbnUub2Zmc2V0V2lkdGg7XG4gIGlmIChsZWZ0IDwgNCkgbGVmdCA9IHJlY3QubGVmdDtcbiAgY29uc3QgbWVudUggPSBtZW51Lm9mZnNldEhlaWdodDtcbiAgaWYgKHRvcCArIG1lbnVIID4gd2luZG93LmlubmVySGVpZ2h0KSB0b3AgPSByZWN0LnRvcCAtIG1lbnVIO1xuICBtZW51LnN0eWxlLnRvcCAgPSB0b3AgICsgJ3B4JztcbiAgbWVudS5zdHlsZS5sZWZ0ID0gbGVmdCArICdweCc7XG5cbiAgX21lbnVGb2N1c2FibGVJdGVtcyhtZW51KVswXT8uZm9jdXMoKTtcblxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoX2FjdGl2ZUtlYmFiICE9PSBtZW51KSByZXR1cm47ICAvLyBhbHJlYWR5IGNsb3NlZCAoZS5nLiBpbW1lZGlhdGUgRXNjYXBlKVxuICAgIGNvbnN0IGRpc21pc3MgPSBlID0+IHtcbiAgICAgIGlmIChtZW51LmNvbnRhaW5zKGUudGFyZ2V0KSkgcmV0dXJuO1xuICAgICAgY2xvc2VLZWJhYigpO1xuICAgIH07XG4gICAgX2tlYmFiRGlzbWlzcyA9IGRpc21pc3M7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBkaXNtaXNzKTtcbiAgfSwgMCk7XG59XG5cbi8vIOKUgOKUgCBwYW5lIHJlc2l6ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmNvbnN0IF9QQU5FX0tFWSA9ICd5dXVjbGlwLXBhbmUtc2l6ZXMnO1xuXG5mdW5jdGlvbiBfbG9hZFBhbmVTaXplcygpIHtcbiAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oX1BBTkVfS0VZKSB8fCAne30nKTsgfSBjYXRjaCB7IHJldHVybiB7fTsgfVxufVxuXG5mdW5jdGlvbiBfc2F2ZVBhbmVTaXplKGtleSwgdmFsKSB7XG4gIGNvbnN0IHMgPSBfbG9hZFBhbmVTaXplcygpO1xuICBzW2tleV0gPSB2YWw7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKF9QQU5FX0tFWSwgSlNPTi5zdHJpbmdpZnkocykpO1xufVxuXG5mdW5jdGlvbiBfbWFrZURyYWdIYW5kbGUoaWQsIG9uU3RhcnQpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZSA9PiB7XG4gICAgaWYgKGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2RyYWdnaW5nJyk7XG4gICAgY29uc3Qgb25Nb3ZlID0gb25TdGFydChlKTtcbiAgICBjb25zdCBvblVwID0gKCkgPT4ge1xuICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dpbmcnKTtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW92ZSk7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25VcCk7XG4gICAgfTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvblVwKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0UmVzaXplKCkge1xuICBjb25zdCByb290ICAgID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuICBjb25zdCBzaXplcyAgID0gX2xvYWRQYW5lU2l6ZXMoKTtcblxuICBpZiAoc2l6ZXMuc2lkZWJhcldpZHRoKSAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tc2lkZWJhci13aWR0aCcsICAgICAgIHNpemVzLnNpZGViYXJXaWR0aCArICdweCcpO1xuICBpZiAoc2l6ZXMudmlkZW9zSGVpZ2h0KSAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tdmlkZW9zLWdyb3VwLWhlaWdodCcsIHNpemVzLnZpZGVvc0hlaWdodCArICdweCcpO1xuICBpZiAoc2l6ZXMucGxheWVyTWF4SCkgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tcGxheWVyLW1heC1oZWlnaHQnLCAgIHNpemVzLnBsYXllck1heEggKyAncHgnKTtcbiAgaWYgKHNpemVzLmxvZ01heEgpICAgICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWxvZy1tYXgtaGVpZ2h0JywgICAgICAgc2l6ZXMubG9nTWF4SCArICdweCcpO1xuXG4gIF9tYWtlRHJhZ0hhbmRsZSgnc2lkZWJhci1yZXNpemUtaGFuZGxlJywgc3RhcnRFID0+IHtcbiAgICBjb25zdCBzdGFydFggID0gc3RhcnRFLmNsaWVudFg7XG4gICAgY29uc3Qgc2lkZWJhciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaWRlYmFyJyk7XG4gICAgY29uc3Qgc3RhcnRXICA9IHNpZGViYXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IHcgPSBNYXRoLm1heCgxNjAsIE1hdGgubWluKDQ4MCwgc3RhcnRXICsgbW92ZUUuY2xpZW50WCAtIHN0YXJ0WCkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1zaWRlYmFyLXdpZHRoJywgdyArICdweCcpO1xuICAgICAgX3NhdmVQYW5lU2l6ZSgnc2lkZWJhcldpZHRoJywgdyk7XG4gICAgfTtcbiAgfSk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCd2aWRlb3MtY2xpcHMtcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRZICA9IHN0YXJ0RS5jbGllbnRZO1xuICAgIGNvbnN0IHZnICAgICAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2lkZWJhci1ncm91cC52aWRlb3MtZ3JvdXAnKTtcbiAgICBjb25zdCBzaWRlYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNpZGViYXInKTtcbiAgICBjb25zdCBzdGFydEggID0gdmcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgIHJldHVybiBtb3ZlRSA9PiB7XG4gICAgICBjb25zdCBtYXhIID0gc2lkZWJhci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgLSAxMjA7XG4gICAgICBjb25zdCBoID0gTWF0aC5tYXgoNDAsIE1hdGgubWluKG1heEgsIHN0YXJ0SCArIG1vdmVFLmNsaWVudFkgLSBzdGFydFkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tdmlkZW9zLWdyb3VwLWhlaWdodCcsIGggKyAncHgnKTtcbiAgICAgIF9zYXZlUGFuZVNpemUoJ3ZpZGVvc0hlaWdodCcsIGgpO1xuICAgIH07XG4gIH0pO1xuXG4gIF9tYWtlRHJhZ0hhbmRsZSgncGxheWVyLXJlc2l6ZS1oYW5kbGUnLCBzdGFydEUgPT4ge1xuICAgIGNvbnN0IHN0YXJ0WSA9IHN0YXJ0RS5jbGllbnRZO1xuICAgIGNvbnN0IHBhICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXItYXJlYScpO1xuICAgIGNvbnN0IG1haW4gICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tYWluJyk7XG4gICAgY29uc3Qgc3RhcnRIID0gcGEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgIHJldHVybiBtb3ZlRSA9PiB7XG4gICAgICBjb25zdCBtYXhIID0gbWFpbi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgLSAxMDA7XG4gICAgICBjb25zdCBoID0gTWF0aC5tYXgoODAsIE1hdGgubWluKG1heEgsIHN0YXJ0SCArIG1vdmVFLmNsaWVudFkgLSBzdGFydFkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tcGxheWVyLW1heC1oZWlnaHQnLCBoICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCdwbGF5ZXJNYXhIJywgaCk7XG4gICAgfTtcbiAgfSk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCdsb2ctcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRZID0gc3RhcnRFLmNsaWVudFk7XG4gICAgY29uc3QgbGIgICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1ib2R5Jyk7XG4gICAgY29uc3Qgc3RhcnRIID0gbGIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0IHx8IDA7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IGggPSBNYXRoLm1heCg0MCwgTWF0aC5taW4oNjAwLCBzdGFydEggLSAobW92ZUUuY2xpZW50WSAtIHN0YXJ0WSkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tbG9nLW1heC1oZWlnaHQnLCBoICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCdsb2dNYXhIJywgaCk7XG4gICAgfTtcbiAgfSk7XG59XG5cbi8vIOKUgOKUgCBwcmVyZXEgd2FybmluZ3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5leHBvcnQgZnVuY3Rpb24gX2FwcGx5UHJlcmVxV2FybmluZ3MocHJlcmVxcykge1xuICBjb25zdCBpbkVsZWN0cm9uID0gISF3aW5kb3cuZWxlY3Ryb25BUEk7XG4gIGNvbnN0IHdpemFyZExpbmsgPSBpbkVsZWN0cm9uXG4gICAgPyAnIDxhIGhyZWY9XCIjXCIgb25jbGljaz1cIndpbmRvdy5lbGVjdHJvbkFQSS5ydW5TZXR1cFdpemFyZCgpO3JldHVybiBmYWxzZVwiIHN0eWxlPVwiY29sb3I6dmFyKC0td2FybmluZylcIj5SZS1ydW4gU2V0dXAgV2l6YXJkPC9hPidcbiAgICA6ICcnO1xuXG4gIGNvbnN0IGJhbm5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcmVyZXEtYmFubmVyJyk7XG4gIGlmICghYmFubmVyKSByZXR1cm47XG5cbiAgaWYgKCFwcmVyZXFzLmZmbXBlZ19vaykge1xuICAgIGJhbm5lci5pbm5lckhUTUwgPSBgPHNwYW4+4pqgIEZGbXBlZyBub3QgZm91bmQgLSBhbmFseXNpcyBhbmQgZXhwb3J0IHdpbGwgZmFpbC4ke3dpemFyZExpbmt9PC9zcGFuPmA7XG4gICAgYmFubmVyLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXN0YXJ0LWFuYWx5emUnKTtcbiAgICBpZiAoYnRuKSB7XG4gICAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgYnRuLnRpdGxlID0gJ0ZGbXBlZyBub3QgZm91bmQgLSBSZS1ydW4gU2V0dXAgV2l6YXJkIHRvIGluc3RhbGwgaXQnO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFwcmVyZXFzLmxsbV9vayAmJiBpbkVsZWN0cm9uKSB7XG4gICAgYmFubmVyLmlubmVySFRNTCA9IGA8c3Bhbj7ihLkgTExNIHNjb3JpbmcgaXMgbm90IGNvbmZpZ3VyZWQgLSBjbGlwcyB3aWxsIGJlIHNjb3JlZCBieSBlbmVyZ3kgYW5kIHNjZW5lcyBvbmx5LiR7d2l6YXJkTGlua308L3NwYW4+YDtcbiAgICBiYW5uZXIuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBQcmVyZXF1aXNpdGVzIHNhdGlzZmllZCAtIGNsZWFyIGFueSBiYW5uZXIgc2hvd24gYnkgYW4gZWFybGllciBzdGF0ZS4gV2l0aG91dFxuICAvLyB0aGlzLCBhIHJlLWNoZWNrIGFmdGVyIHRoZSBtb2RlbCBpcyBzZXQgdXAgKHJlZnJlc2hTZXJ2ZXJTdGF0ZSkgY291bGQgbmV2ZXJcbiAgLy8gaGlkZSBhIHN0YWxlIHdhcm5pbmcuXG4gIGJhbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBiYW5uZXIuaW5uZXJIVE1MID0gJyc7XG59XG5cbi8vIOKUgOKUgCB1bmRvIHRvYXN0IChhdXRvLWRpc21pc3MsIHNpbmdsZSBVbmRvIGJ1dHRvbikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBBIHRyYW5zaWVudCB0b2FzdCBjYXJyeWluZyBhbiBVbmRvIGFjdGlvbiwgdXNlZCBieSByZXZlcnNpYmxlIGNsaXAgb3BlcmF0aW9uc1xuLy8gKHNpbmdsZS9idWxrIHN0YXR1cyBjaGFuZ2VzKS4gVGhlIHNocmlua2luZyBiYXIgbWFrZXMgdGhlIH41cyB3aW5kb3cgdmlzaWJsZVxuLy8gc28gdGhlIHVuZG8gYWZmb3JkYW5jZSBkb2VzIG5vdCBleHBpcmUgc2lsZW50bHkuIEdlbmVyaWMgVUksIHNvIGl0IGxpdmVzIGhlcmVcbi8vIHJhdGhlciB0aGFuIGluIGEgZmVhdHVyZSBtb2R1bGUuXG5jb25zdCBVTkRPX1RPQVNUX01TID0gNTAwMDtcblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dVbmRvVG9hc3QobWVzc2FnZSwgdW5kb0ZuKSB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b2FzdC1jb250YWluZXInKTtcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gJ3RvYXN0IGluZm8gdW5kby10b2FzdCc7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICByb3cuY2xhc3NOYW1lID0gJ3VuZG8tdG9hc3Qtcm93JztcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gIGJ0bi5jbGFzc05hbWUgPSAndW5kby10b2FzdC1idG4nO1xuICBidG4udGV4dENvbnRlbnQgPSAnVW5kbyc7XG4gIGJ0bi5vbmNsaWNrID0gKCkgPT4geyB0b2FzdC5yZW1vdmUoKTsgdW5kb0ZuKCk7IH07XG4gIHJvdy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShtZXNzYWdlKSk7XG4gIHJvdy5hcHBlbmRDaGlsZChidG4pO1xuICBjb25zdCBiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgYmFyLmNsYXNzTmFtZSA9ICd1bmRvLXRvYXN0LWJhcic7XG4gIGJhci5zdHlsZS5hbmltYXRpb25EdXJhdGlvbiA9IFVORE9fVE9BU1RfTVMgKyAnbXMnO1xuICB0b2FzdC5hcHBlbmRDaGlsZChyb3cpO1xuICB0b2FzdC5hcHBlbmRDaGlsZChiYXIpO1xuICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QpO1xuICBzZXRUaW1lb3V0KCgpID0+IHRvYXN0LnJlbW92ZSgpLCBVTkRPX1RPQVNUX01TKTtcbn1cblxuLy8gR2xvYmFsIHBsYXliYWNrLXNwZWVkIHByZWZlcmVuY2UgLSBvbmUgY2FwdHVyZS1waGFzZSBsaXN0ZW5lciBhcHBsaWVzIHRoZSBzYXZlZFxuLy8gcmF0ZSB0byBldmVyeSA8dmlkZW8+IGFzIGl0IGxvYWRzLCBzbyBhbGwgcGxheWVycyAoY2xpcCBwcmV2aWV3LCByZWNvcmRpbmcsXG4vLyBzcGxpdC9leHBvcnQgZWRpdG9ycywgcmVlbHMpIGhvbm9yIGl0IHdpdGhvdXQgcGVyLXBsYXllciB3aXJpbmcuIENsaWVudC1vbmx5LFxuLy8gc3RvcmVkIGluIGxvY2FsU3RvcmFnZSBsaWtlIHRoZSBvdGhlciBwbGF5YmFjayBwcmVmcy5cbmV4cG9ydCBmdW5jdGlvbiBwbGF5YmFja1JhdGVQcmVmKCkge1xuICBjb25zdCByYXRlID0gcGFyc2VGbG9hdChsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgneXV1Y2xpcC1wbGF5YmFjay1yYXRlJykpO1xuICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKHJhdGUpICYmIHJhdGUgPiAwID8gcmF0ZSA6IDE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBsYXliYWNrUmF0ZShyYXRlKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ZpZGVvJykuZm9yRWFjaCh2aWRlbyA9PiB7IHZpZGVvLnBsYXliYWNrUmF0ZSA9IHJhdGU7IH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdFBsYXliYWNrUmF0ZSgpIHtcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBlID0+IHtcbiAgICBpZiAoZS50YXJnZXQgJiYgZS50YXJnZXQudGFnTmFtZSA9PT0gJ1ZJREVPJykgZS50YXJnZXQucGxheWJhY2tSYXRlID0gcGxheWJhY2tSYXRlUHJlZigpO1xuICB9LCB0cnVlKTtcbn1cblxuLy8g4pSA4pSAIHN0YXRpYyBtb2RhbC9oYW1idXJnZXIgd2lyaW5nIChyZXBsYWNlcyB0aGUgaW5saW5lIG9uY2xpY2s9IHRoaXMgbW9kdWxlIHVzZWRcbi8vIHRvIG93biBpbiBpbmRleC5odG1sKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZXNlIGFyZSBmaXhlZCwgbmV2ZXItcmVjcmVhdGVkIGVsZW1lbnRzIGluIGluZGV4Lmh0bWwsIHNvIHdpcmluZyB0aGVtIG9uY2UgYXRcbi8vIG1vZHVsZSBsb2FkIChiZWxvdykgY2FuJ3QgZG91YmxlLWZpcmUgb24gYSByZS1yZW5kZXIgdGhlIHdheSBhIGR5bmFtaWNhbGx5XG4vLyByZW5kZXJlZCBsaXN0IGNvdWxkLlxuY29uc3QgX0JHX0RJU01JU1NfTU9EQUxTID0gW1xuICBbJ2FsZXJ0LW1vZGFsJywgY2xvc2VBbGVydE1vZGFsXSxcbiAgWydjb25maXJtLW1vZGFsJywgX2NvbmZpcm1DYW5jZWxdLFxuICBbJ2FjdGlvbnMtbW9kYWwnLCBjbG9zZUFjdGlvbnNNb2RhbF0sXG4gIFsnY29udHJvbHMtbW9kYWwnLCBjbG9zZUNvbnRyb2xzTW9kYWxdLFxuICBbJ2RpZmYtbW9kYWwnLCBfZGlmZkRpc2NhcmRdLFxuICBbJ2ZpZWxkLWVkaXQtbW9kYWwnLCBjbG9zZUZpZWxkRWRpdE1vZGFsXSxcbl07XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKSB7XG4gIGZvciAoY29uc3QgW21vZGFsSWQsIGNsb3NlRm5dIG9mIF9CR19ESVNNSVNTX01PREFMUykge1xuICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobW9kYWxJZCk7XG4gICAgbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBtb2RhbCkgY2xvc2VGbigpOyB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfd2lyZU1vZGFsQnV0dG9ucygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LW9rLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VBbGVydE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1jYW5jZWwtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfY29uZmlybUNhbmNlbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tb2stYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfY29uZmlybU9rKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlQWN0aW9uc01vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbHMtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUNvbnRyb2xzTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWRpc2NhcmQtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZGlmZkRpc2NhcmQoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1lZGl0LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2RpZmZBY2NlcHRFZGl0KCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1hY2NlcHQtbmV3LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2RpZmZBY2NlcHROZXcoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlRmllbGRFZGl0TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXNhdmUtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZmllbGRFZGl0U2F2ZSgpKTtcbn1cblxuLy8gXCJDb250cm9sc1wiIGFuZCBcIkRvd25sb2FkIExvZ1wiIGFyZSB3aXJlZCBoZXJlIGJlY2F1c2UgdGhlaXIgb25jbGljaz0gY2FsbGVkXG4vLyBvbmx5IHVpLmpzIGZ1bmN0aW9ucy4gVGhlIEdldHRpbmcgU3RhcnRlZCAvIEdsb3NzYXJ5IC8gSGVscCAvIEFib3V0IGl0ZW1zIGNhbGxcbi8vIGNsb3NlSGFtYnVyZ2VyKCkgKHVpLmpzKSBwbHVzIGEgaGVscG1vZGFscy5qcyBtb2RhbC1vcGVuLCBzbyBoZWxwbW9kYWxzLmpzIG93bnNcbi8vIHRoZWlyIGRlbGVnYXRpb24uIFwiUmUtcnVuIFNldHVwIFdpemFyZFwiIGFuZCBcIlJlZnJlc2hcIiAoZWxlY3Ryb25BUEkgLyBsb2NhdGlvbilcbi8vIHJlbWFpbiBpbmxpbmUgdW50aWwgdGhlaXIgb3duaW5nIGNvZGUgbWlncmF0ZXMuXG5mdW5jdGlvbiBfd2lyZUhhbWJ1cmdlckhhbmRsZXJzKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdG9nZ2xlSGFtYnVyZ2VyKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tY29udHJvbHMnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICBjbG9zZUhhbWJ1cmdlcigpO1xuICAgIG9wZW5Db250cm9sc01vZGFsKCk7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tZG93bmxvYWQtbG9nJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUhhbWJ1cmdlcigpKTtcbn1cblxuX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpO1xuX3dpcmVNb2RhbEJ1dHRvbnMoKTtcbl93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIHRoZSB0aHJlZSBhcHAtZ2xvYmFsIGhlbHAvaW5mbyBtb2RhbHMgKEdldHRpbmcgU3RhcnRlZCwgQWJvdXQsXG4vLyBHbG9zc2FyeSkuIEV4dHJhY3RlZCBvdXQgb2Ygc2V0dGluZ3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLSB0aGVzZVxuLy8gaGF2ZSBubyBjb3VwbGluZyB0byB0aGUgc2V0dGluZ3Mgc2F2ZS9kaXJ0eSBtYWNoaW5lcnkuXG4vLyAgIEFQSTogcm91dGVzL2NvbmZpZy5weSAoZ2xvc3NhcnkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3NldHRpbmdzLnB5LCB0ZXN0cy91aS90ZXN0X3VpX3BhZ2UucHksIHRlc3RzL3VpL3Rlc3RfdWlfa2V5Ym9hcmQucHlcblxuLy8g4pSA4pSAIGdldHRpbmcgc3RhcnRlZCBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsKCkge1xuICBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2V0dGluZy1zdGFydGVkLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwgLmJ0bicpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2V0dGluZy1zdGFydGVkLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgneXV1LWdldHRpbmctc3RhcnRlZC1zZWVuJywgJzEnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2dldHRpbmdTdGFydGVkT3BlbmVyO1xuICBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBhYm91dCBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWJvdXRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5BYm91dE1vZGFsKCkge1xuICBfYWJvdXRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWJvdXQtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Fib3V0LW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQWJvdXRNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fib3V0LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfYWJvdXRPcGVuZXI7XG4gIF9hYm91dE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGhlbHAgJiBndWlkZXMgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBMaW5rcyBvdXQgdG8gdGhlIEdpdEh1YiBkb2NzL3VzZXIvIHBhZ2VzIHJhdGhlciB0aGFuIGJ1bmRsaW5nIGNvcGllczogdGhlIGFwcFxuLy8gc2hpcHMgdGhlIHdoZWVsICh3aGljaCBjYXJyaWVzIHN0YXRpYy9nbG9zc2FyeS5tZCkgYnV0IG5vdCBkb2NzL3VzZXIvLCBhbmQgYVxuLy8gYnVuZGxlZCA2NTAtbGluZSBmZWF0dXJlIGd1aWRlIHdvdWxkIGRyaWZ0IGZyb20gdGhlIFVJLiBJbiB0aGUgcGFja2FnZWQgYXBwXG4vLyB0aGVzZSB0YXJnZXQ9X2JsYW5rIGxpbmtzIG9wZW4gaW4gdGhlIHN5c3RlbSBicm93c2VyIHZpYSBzZXRXaW5kb3dPcGVuSGFuZGxlci5cbmxldCBfaGVscE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkhlbHBNb2RhbCgpIHtcbiAgX2hlbHBPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVscC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjaGVscC1tb2RhbCAuYnRuJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUhlbHBNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlbHAtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9oZWxwT3BlbmVyO1xuICBfaGVscE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGdsb3NzYXJ5IG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9nbG9zc2FyeU9wZW5lciA9IG51bGw7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3Blbkdsb3NzYXJ5TW9kYWwoKSB7XG4gIF9nbG9zc2FyeU9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgY29uc3QgZmlsdGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWZpbHRlcicpO1xuICBmaWx0ZXIudmFsdWUgPSAnJztcbiAgc2V0VGltZW91dCgoKSA9PiBmaWx0ZXIuZm9jdXMoKSwgNTApO1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1jb250ZW50Jyk7XG4gIGlmIChlbC5kYXRhc2V0LmxvYWRlZCkgeyBfZmlsdGVyR2xvc3NhcnkoJycpOyByZXR1cm47IH1cbiAgdHJ5IHtcbiAgICBjb25zdCBtZCA9IGF3YWl0IGZldGNoKCcvYXBpL2dsb3NzYXJ5JykudGhlbihyID0+IHIudGV4dCgpKTtcbiAgICBlbC5pbm5lckhUTUwgPSBfcmVuZGVyR2xvc3NhcnlNZChtZCk7XG4gICAgZWwuZGF0YXNldC5sb2FkZWQgPSAnMSc7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBlbC5pbm5lckhUTUwgPSAnPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLXJlZClcIj5GYWlsZWQgdG8gbG9hZCBnbG9zc2FyeS48L2Rpdj4nO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZmlsdGVyR2xvc3NhcnkocXVlcnkpIHtcbiAgY29uc3QgcSA9IHF1ZXJ5LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBjb250ZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWNvbnRlbnQnKTtcbiAgbGV0IGFueVZpc2libGUgPSBmYWxzZTtcbiAgY29udGVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZ2xvc3NhcnktdGVybScpLmZvckVhY2godGVybSA9PiB7XG4gICAgY29uc3Qgc2hvdyA9ICFxIHx8IHRlcm0udGV4dENvbnRlbnQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKTtcbiAgICB0ZXJtLnN0eWxlLmRpc3BsYXkgPSBzaG93ID8gJycgOiAnbm9uZSc7XG4gICAgaWYgKHNob3cpIGFueVZpc2libGUgPSB0cnVlO1xuICB9KTtcbiAgY29udGVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZ2xvc3Nhcnktc2VjdGlvbicpLmZvckVhY2goc2VjdGlvbiA9PiB7XG4gICAgY29uc3QgdGVybXMgPSBBcnJheS5mcm9tKHNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbCgnLmdsb3NzYXJ5LXRlcm0nKSk7XG4gICAgY29uc3Qgc2hvdyA9ICFxIHx8IHRlcm1zLnNvbWUodCA9PiB0LnN0eWxlLmRpc3BsYXkgIT09ICdub25lJyk7XG4gICAgc2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gc2hvdyA/ICcnIDogJ25vbmUnO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LW5vLW1hdGNoZXMnKS5zdHlsZS5kaXNwbGF5ID0gKHEgJiYgIWFueVZpc2libGUpID8gJycgOiAnbm9uZSc7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VHbG9zc2FyeU1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9nbG9zc2FyeU9wZW5lcjtcbiAgX2dsb3NzYXJ5T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBfcmVuZGVyR2xvc3NhcnlNZChtZCkge1xuICBjb25zdCBsaW5lcyA9IG1kLnNwbGl0KCdcXG4nKTtcbiAgbGV0IGh0bWwgPSAnJztcbiAgbGV0IGluTGlzdCA9IGZhbHNlO1xuICBsZXQgaW5UYWJsZSA9IGZhbHNlO1xuICBsZXQgdGFibGVIZWFkID0gZmFsc2U7XG4gIGxldCBpblNlY3Rpb24gPSBmYWxzZTtcbiAgbGV0IGluVGVybSA9IGZhbHNlO1xuXG4gIGNvbnN0IGlubGluZSA9IHMgPT4gc1xuICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC8+L2csICcmZ3Q7JylcbiAgICAucmVwbGFjZSgvYChbXmBdKylgL2csICc8Y29kZT4kMTwvY29kZT4nKVxuICAgIC5yZXBsYWNlKC9cXCpcXCooW14qXSspXFwqXFwqL2csICc8c3Ryb25nPiQxPC9zdHJvbmc+JylcbiAgICAucmVwbGFjZSgvXFwqKFteKl0rKVxcKi9nLCAnPGVtPiQxPC9lbT4nKTtcblxuICBjb25zdCBjbG9zZUxpc3QgID0gKCkgPT4geyBpZiAoaW5MaXN0KSAgeyBodG1sICs9ICc8L3VsPic7ICAgaW5MaXN0ICA9IGZhbHNlOyB9IH07XG4gIGNvbnN0IGNsb3NlVGFibGUgPSAoKSA9PiB7IGlmIChpblRhYmxlKSB7IGh0bWwgKz0gJzwvdGJvZHk+PC90YWJsZT4nOyBpblRhYmxlID0gZmFsc2U7IHRhYmxlSGVhZCA9IGZhbHNlOyB9IH07XG4gIC8vIFNlY3Rpb24gKCMjKSBhbmQgdGVybSAoIyMjKSB3cmFwcGVyIGRpdnMgYXJlIHRoZSB1bml0cyB0aGUgZ2xvc3NhcnkgZmlsdGVyXG4gIC8vIHNob3dzL2hpZGVzIC0gZXZlcnkgIyMjIGJsb2NrIG11c3QgbGFuZCBpbnNpZGUgZXhhY3RseSBvbmUgLmdsb3NzYXJ5LXRlcm0uXG4gIGNvbnN0IGNsb3NlVGVybSAgICA9ICgpID0+IHsgaWYgKGluVGVybSkgICAgeyBodG1sICs9ICc8L2Rpdj4nOyBpblRlcm0gICAgPSBmYWxzZTsgfSB9O1xuICBjb25zdCBjbG9zZVNlY3Rpb24gPSAoKSA9PiB7IGNsb3NlVGVybSgpOyBpZiAoaW5TZWN0aW9uKSB7IGh0bWwgKz0gJzwvZGl2Pic7IGluU2VjdGlvbiA9IGZhbHNlOyB9IH07XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHJhdyA9IGxpbmVzW2ldO1xuICAgIGNvbnN0IGxpbmUgPSByYXcudHJpbUVuZCgpO1xuXG4gICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnIyMgJykpIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7IGNsb3NlU2VjdGlvbigpO1xuICAgICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cImdsb3NzYXJ5LXNlY3Rpb25cIj48aDIgc3R5bGU9XCJtYXJnaW46MjBweCAwIDRweDtmb250LXNpemU6MTVweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO3BhZGRpbmctYm90dG9tOjRweFwiPiR7aW5saW5lKGxpbmUuc2xpY2UoMykpfTwvaDI+YDtcbiAgICAgIGluU2VjdGlvbiA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJyMjIyAnKSkge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VUZXJtKCk7XG4gICAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiZ2xvc3NhcnktdGVybVwiPjxoMyBzdHlsZT1cIm1hcmdpbjoxNHB4IDAgMnB4O2ZvbnQtc2l6ZToxM3B4O2NvbG9yOnZhcigtLWFjY2VudClcIj4ke2lubGluZShsaW5lLnNsaWNlKDQpKX08L2gzPmA7XG4gICAgICBpblRlcm0gPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCctLS0nKSkge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VUZXJtKCk7XG4gICAgICBodG1sICs9ICc8aHIgc3R5bGU9XCJib3JkZXI6bm9uZTtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO21hcmdpbjoxNHB4IDBcIj4nO1xuICAgIH0gZWxzZSBpZiAoL15cXHwvLnRlc3QobGluZSkpIHtcbiAgICAgIGNsb3NlTGlzdCgpO1xuICAgICAgY29uc3QgY2VsbHMgPSBsaW5lLnNwbGl0KCd8Jykuc2xpY2UoMSwgLTEpLm1hcChjID0+IGMudHJpbSgpKTtcbiAgICAgIGlmICgvXlstXFxzfDpdKyQvLnRlc3QobGluZSkpIHtcbiAgICAgICAgdGFibGVIZWFkID0gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKCFpblRhYmxlKSB7XG4gICAgICAgIGluVGFibGUgPSB0cnVlOyB0YWJsZUhlYWQgPSB0cnVlO1xuICAgICAgICBodG1sICs9ICc8dGFibGUgc3R5bGU9XCJ3aWR0aDoxMDAlO2JvcmRlci1jb2xsYXBzZTpjb2xsYXBzZTtmb250LXNpemU6MTJweDttYXJnaW46NnB4IDBcIj48dGhlYWQ+PHRyPic7XG4gICAgICAgIGNlbGxzLmZvckVhY2goYyA9PiB7IGh0bWwgKz0gYDx0aCBzdHlsZT1cInRleHQtYWxpZ246bGVmdDtwYWRkaW5nOjRweCA4cHggNHB4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTtjb2xvcjp2YXIoLS10ZXh0KVwiPiR7aW5saW5lKGMpfTwvdGg+YDsgfSk7XG4gICAgICAgIGh0bWwgKz0gJzwvdHI+PC90aGVhZD48dGJvZHk+JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGh0bWwgKz0gJzx0cj4nO1xuICAgICAgICBjZWxscy5mb3JFYWNoKGMgPT4geyBodG1sICs9IGA8dGQgc3R5bGU9XCJwYWRkaW5nOjNweCA4cHggM3B4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTtjb2xvcjp2YXIoLS1tdXRlZCk7dmVydGljYWwtYWxpZ246dG9wXCI+JHtpbmxpbmUoYyl9PC90ZD5gOyB9KTtcbiAgICAgICAgaHRtbCArPSAnPC90cj4nO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoL14tIC8udGVzdChsaW5lKSkge1xuICAgICAgY2xvc2VUYWJsZSgpO1xuICAgICAgaWYgKCFpbkxpc3QpIHsgaHRtbCArPSAnPHVsIHN0eWxlPVwibWFyZ2luOjRweCAwIDRweCAxNnB4O3BhZGRpbmc6MFwiPic7IGluTGlzdCA9IHRydWU7IH1cbiAgICAgIGh0bWwgKz0gYDxsaSBzdHlsZT1cIm1hcmdpbjoxcHggMFwiPiR7aW5saW5lKGxpbmUuc2xpY2UoMikpfTwvbGk+YDtcbiAgICB9IGVsc2UgaWYgKGxpbmUgPT09ICcnKSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpO1xuICAgICAgaHRtbCArPSAnPGRpdiBzdHlsZT1cIm1hcmdpbjo0cHggMFwiPjwvZGl2Pic7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7XG4gICAgICBodG1sICs9IGA8cCBzdHlsZT1cIm1hcmdpbjozcHggMFwiPiR7aW5saW5lKGxpbmUpfTwvcD5gO1xuICAgIH1cbiAgfVxuICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpOyBjbG9zZVNlY3Rpb24oKTtcbiAgcmV0dXJuIGh0bWw7XG59XG5cbi8vIOKUgOKUgCBzdGF0aWMgbW9kYWwvaGFtYnVyZ2VyIHdpcmluZyAocmVwbGFjZXMgdGhlIGlubGluZSBvbmNsaWNrPS9vbmlucHV0PSB0aGlzXG4vLyBtb2R1bGUgdXNlZCB0byBvd24gaW4gaW5kZXguaHRtbCkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUaGVzZSBhcmUgZml4ZWQsIG5ldmVyLXJlY3JlYXRlZCBlbGVtZW50cyBpbiBpbmRleC5odG1sLCBzbyB3aXJpbmcgdGhlbSBvbmNlIGF0XG4vLyBtb2R1bGUgbG9hZCAoYmVsb3cpIGNhbid0IGRvdWJsZS1maXJlIG9uIGEgcmUtcmVuZGVyIHRoZSB3YXkgYSBkeW5hbWljYWxseVxuLy8gcmVuZGVyZWQgbGlzdCBjb3VsZC5cbmNvbnN0IF9CR19ESVNNSVNTX01PREFMUyA9IFtcbiAgWydnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwnLCBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWxdLFxuICBbJ2hlbHAtbW9kYWwnLCBjbG9zZUhlbHBNb2RhbF0sXG4gIFsnYWJvdXQtbW9kYWwnLCBjbG9zZUFib3V0TW9kYWxdLFxuICBbJ2dsb3NzYXJ5LW1vZGFsJywgY2xvc2VHbG9zc2FyeU1vZGFsXSxcbl07XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKSB7XG4gIGZvciAoY29uc3QgW21vZGFsSWQsIGNsb3NlRm5dIG9mIF9CR19ESVNNSVNTX01PREFMUykge1xuICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobW9kYWxJZCk7XG4gICAgbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBtb2RhbCkgY2xvc2VGbigpOyB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfd2lyZU1vZGFsQnV0dG9ucygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dldHRpbmctc3RhcnRlZC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlbHAtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUhlbHBNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fib3V0LW1vZGFsLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VBYm91dE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUdsb3NzYXJ5TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1maWx0ZXInKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGUgPT4gX2ZpbHRlckdsb3NzYXJ5KGUudGFyZ2V0LnZhbHVlKSk7XG59XG5cbi8vIFRoZSA0IGhhbWJ1cmdlciBpdGVtcyB1aS5qcydzIG93biBtaWdyYXRpb24gZGVmZXJyZWQgKHRoZWlyIGlubGluZSBvbmNsaWNrPVxuLy8gbWl4ZWQgdWkuanMncyBjbG9zZUhhbWJ1cmdlcigpIHdpdGggYSBoZWxwbW9kYWxzLmpzIG1vZGFsLW9wZW4gY2FsbCkgLSB0aGlzXG4vLyBtb2R1bGUgbm93IG93bnMgdGhlIG1vZGFsLW9wZW4gaGFsZiwgc28gaXQgb3ducyByZXRpcmluZyB0aGVtIHRvby5cbmZ1bmN0aW9uIF93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1nZXR0aW5nLXN0YXJ0ZWQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWdsb3NzYXJ5JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3Blbkdsb3NzYXJ5TW9kYWwoKTtcbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1oZWxwJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkhlbHBNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWFib3V0JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkFib3V0TW9kYWwoKTtcbiAgfSk7XG59XG5cbl93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKTtcbl93aXJlTW9kYWxCdXR0b25zKCk7XG5fd2lyZUhhbWJ1cmdlckhhbmRsZXJzKCk7XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBhcHAtZ2xvYmFsIGtleWJvYXJkIHNob3J0Y3V0cyBhbmQgdGhlIEVzY2FwZS1rZXkgbGF5ZXIgY2FzY2FkZS5cbi8vIEV4dHJhY3RlZCBvdXQgb2Ygc2V0dGluZ3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLSBzaG9ydGN1dHMgYXJlXG4vLyBhcHAtd2lkZSwgbm90IHNldHRpbmdzLXNwZWNpZmljLlxuLy8gICBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9rZXlib2FyZC5weVxuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgUGFuZWxOYXYgfSBmcm9tICcuL3BhbmVsbmF2LmpzJztcbmltcG9ydCB7XG4gIF9jb25maXJtQ2FuY2VsLCBjbG9zZUFsZXJ0TW9kYWwsIGNsb3NlQ29udHJvbHNNb2RhbCwgY2xvc2VGaWVsZEVkaXRNb2RhbCxcbiAgX2RpZmZEaXNjYXJkLCBjbG9zZUFjdGlvbnNNb2RhbCwgY2xvc2VLZWJhYiwgaXNIYW1idXJnZXJPcGVuLCBjbG9zZUhhbWJ1cmdlcixcbiAgdG9wbW9zdFZpc2libGVNb2RhbCwgb3BlbkNvbnRyb2xzTW9kYWwsXG59IGZyb20gJy4vdWkuanMnO1xuaW1wb3J0IHtcbiAgY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsLCBjbG9zZUFib3V0TW9kYWwsIGNsb3NlR2xvc3NhcnlNb2RhbCwgY2xvc2VIZWxwTW9kYWwsXG59IGZyb20gJy4vaGVscG1vZGFscy5qcyc7XG5cbi8vIOKUgOKUgCBrZXlib2FyZCBzaG9ydGN1dHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbi8vIEVzY2FwZSBwZWVscyBvbmUgbGF5ZXIgcGVyIHByZXNzLCB0b3Btb3N0IGZpcnN0OiBmbG9hdGluZyBtZW51cyAoa2ViYWIgejo1MDAsXG4vLyBoYW1idXJnZXIgejozMDApIHNpdCBhYm92ZSBtb2RhbHMgKHo6MjAwKSwgd2hpY2ggc2l0IGFib3ZlIHRoZSBzZXR0aW5ncyBwYW5lbFxuLy8gYW5kIHRoZSBmdWxsLXBhbmVsIGVkaXRvcnMuIHRvcG1vc3RWaXNpYmxlTW9kYWwgKHVpLmpzKSByZXNvbHZlcyBtb2RhbFxuLy8gc3RhY2tpbmcgLSBjb25maXJtL2FsZXJ0IHRha2UgcHJpb3JpdHksIHNvIGEgXCJEaXNjYXJkP1wiIGNvbmZpcm0gY2FuY2Vsc1xuLy8gd2l0aG91dCBhbHNvIGNsb3NpbmcgdGhlIHN0aWxsLWRpcnR5IGVkaXRvciB1bmRlcm5lYXRoIGl0LlxuLy9cbi8vIFN0aWxsLWNsYXNzaWMgbW9kYWwgY2xvc2VycyAod2luZG93LmNsb3NlU2NvcmVPdmVycmlkZU1vZGFsIGV0Yy4pIGFyZSBjYWxsZWRcbi8vIGFzIGJhcmUgZ2xvYmFscyAtIHRoZWlyIG93bmluZyBtb2R1bGVzIGhhdmVuJ3QgbWlncmF0ZWQgdG8gRVNNIHlldC5cbmNvbnN0IF9tb2RhbEVzY2FwZUNsb3NlcnMgPSB7XG4gICdjb25maXJtLW1vZGFsJzogICAgICAgICAgICgpID0+IF9jb25maXJtQ2FuY2VsKCksXG4gICdhbGVydC1tb2RhbCc6ICAgICAgICAgICAgICgpID0+IGNsb3NlQWxlcnRNb2RhbCgpLFxuICAnZ2V0dGluZy1zdGFydGVkLW1vZGFsJzogICAoKSA9PiBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWwoKSxcbiAgJ2Fib3V0LW1vZGFsJzogICAgICAgICAgICAgKCkgPT4gY2xvc2VBYm91dE1vZGFsKCksXG4gICdjb250cm9scy1tb2RhbCc6ICAgICAgICAgICgpID0+IGNsb3NlQ29udHJvbHNNb2RhbCgpLFxuICAnZ2xvc3NhcnktbW9kYWwnOiAgICAgICAgICAoKSA9PiBjbG9zZUdsb3NzYXJ5TW9kYWwoKSxcbiAgJ2hlbHAtbW9kYWwnOiAgICAgICAgICAgICAgKCkgPT4gY2xvc2VIZWxwTW9kYWwoKSxcbiAgJ2ZpZWxkLWVkaXQtbW9kYWwnOiAgICAgICAgKCkgPT4gY2xvc2VGaWVsZEVkaXRNb2RhbCgpLFxuICAnZGlmZi1tb2RhbCc6ICAgICAgICAgICAgICAoKSA9PiBfZGlmZkRpc2NhcmQoKSxcbiAgJ3Njb3JlLW92ZXJyaWRlLW1vZGFsJzogICAgKCkgPT4gY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwoKSxcbiAgJ3Byb2ZpbGUtbW9kYWwnOiAgICAgICAgICAgKCkgPT4gY2xvc2VQcm9maWxlTWFuYWdlcigpLFxuICAnaGlnaGxpZ2h0LXJlZWxzLW1vZGFsJzogICAoKSA9PiBjbG9zZUhpZ2hsaWdodFJlZWxzTW9kYWwoKSxcbiAgJ3JlZWwtcHJldmlldy1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VSZWVsUHJldmlldygpLFxuICAncmV0cmFuc2NyaWJlLW1vZGFsJzogICAgICAoKSA9PiBjbG9zZVJldHJhbnNjcmliZU1vZGFsKCksXG4gICdjb250ZXh0LW1vZGFsJzogICAgICAgICAgICgpID0+IGNsb3NlQ29udGV4dE1hbmFnZXIoKSxcbiAgJ2JhdGNoLWV4cG9ydC1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VCYXRjaEV4cG9ydE1vZGFsKCksXG4gICdleHBvcnQtc2V0dGluZ3MtbW9kYWwnOiAgICgpID0+IGNsb3NlRXhwb3J0TW9kYWwoKSxcbiAgJ3RpbWVsaW5lLWludGVydmFsLW1vZGFsJzogKCkgPT4gY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKSxcbiAgJ2F1dG8tYXBwcm92ZS1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VBdXRvQXBwcm92ZU1vZGFsKCksXG4gICdzaW1pbGFyLWNsaXBzLW1vZGFsJzogICAgICgpID0+IGNsb3NlU2ltaWxhckNsaXBzTW9kYWwoKSxcbiAgJ2FjdGlvbnMtbW9kYWwnOiAgICAgICAgICAgKCkgPT4gY2xvc2VBY3Rpb25zTW9kYWwoKSxcbn07XG5cbmZ1bmN0aW9uIF9jbG9zZVRvcG1vc3RMYXllcigpIHtcbiAgaWYgKGNsb3NlS2ViYWIodHJ1ZSkpIHJldHVybjtcbiAgaWYgKGlzSGFtYnVyZ2VyT3BlbigpKSB7IGNsb3NlSGFtYnVyZ2VyKHRydWUpOyByZXR1cm47IH1cbiAgaWYgKGlzUHJvamVjdE1lbnVPcGVuKCkpIHsgY2xvc2VQcm9qZWN0TWVudSh0cnVlKTsgcmV0dXJuOyB9XG4gIGNvbnN0IHRvcE1vZGFsID0gdG9wbW9zdFZpc2libGVNb2RhbCgpO1xuICBpZiAodG9wTW9kYWwpIHtcbiAgICAoX21vZGFsRXNjYXBlQ2xvc2Vyc1t0b3BNb2RhbC5pZF0gfHwgKCgpID0+IHRvcE1vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKSkpKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2V0dGluZ3MtcGFuZWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgeyBjbG9zZVNldHRpbmdzKCk7IHJldHVybjsgfVxuICBpZiAoUGFuZWxOYXYuaXNPcGVuKCkpIHsgUGFuZWxOYXYuY2xvc2UoKTsgcmV0dXJuOyB9XG4gIGlmIChfaXNOZXdSZWNvcmRpbmdQYW5lbE9wZW4oKSkgY2xvc2VOZXdSZWNvcmRpbmdQYW5lbCgpO1xufVxuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XG4gIC8vIEEgZm9jdXNlZCBsaXN0IGl0ZW0gKGNsaXAvdmlkZW8gPGxpPikgaGFuZGxlcyBFbnRlci9TcGFjZSBpdHNlbGYgYW5kIGNhbGxzXG4gIC8vIHByZXZlbnREZWZhdWx0IC0gZG9uJ3QgQUxTTyBydW4gdGhlIGdsb2JhbCBzaG9ydGN1dCAoZS5nLiBTcGFjZSB0b2dnbGluZ1xuICAvLyBwbGF5L3BhdXNlIHdoaWxlIHRoZSBsaSBhY3RpdmF0aW9uIGlzIHNlbGVjdGluZyBhIGNsaXApLlxuICBpZiAoZS5kZWZhdWx0UHJldmVudGVkKSByZXR1cm47XG5cbiAgY29uc3QgaXNUeXBpbmcgPSBlLnRhcmdldC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdURVhUQVJFQScgfHwgZS50YXJnZXQuaXNDb250ZW50RWRpdGFibGU7XG5cbiAgLy8gRXNjYXBlIG11c3Qgd29yayB3aXRoIGZvY3VzIG9uIGEgYnV0dG9uL3NlbGVjdC9saW5rIC0gdGhhdCdzIHdoZXJlIGV2ZXJ5XG4gIC8vIG1vZGFsIHBsYWNlcyBmb2N1cyBvbiBvcGVuLiBPbmx5IHR5cGluZyBzdXJmYWNlcyBrZWVwIEVzY2FwZSB0byB0aGVtc2VsdmVzXG4gIC8vICh0aGVpciBvd24gaGFuZGxlcnMsIGUuZy4gdGhlIGlubGluZSBjYXB0aW9uIGVkaXRvciwgdXNlIGl0IHRvIGNhbmNlbCkuXG4gIGlmIChlLmtleSA9PT0gJ0VzY2FwZScgJiYgaXNUeXBpbmcpIHJldHVybjtcblxuICBpZiAoZS5rZXkgIT09ICdFc2NhcGUnICYmXG4gICAgICAoaXNUeXBpbmcgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ1NFTEVDVCcgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ0EnKSkgcmV0dXJuO1xuXG4gIC8vIEN0cmwvQ21kK1ogKHVuZG8pIGlzIHRoZSBvbmx5IGJpbmRpbmcgdGhhdCBpbnRlbnRpb25hbGx5IHVzZXMgYSBtb2RpZmllci5cbiAgLy8gRXZlcnkgb3RoZXIgc2hvcnRjdXQgaXMgYSBiYXJlIGtleSwgc28gbGV0IG1vZGlmaWVyIGNob3JkcyBmYWxsIHRocm91Z2ggdG9cbiAgLy8gdGhlIGJyb3dzZXIvT1MgKEN0cmwrUiByZWZyZXNoLCBDbWQrQSBzZWxlY3QtYWxsLCBldGMuKSBpbnN0ZWFkIG9mIGhpamFja2luZ1xuICAvLyB0aGVtIC0gcnVubmluZyBhIGJhcmUta2V5IGhhbmRsZXIgaGVyZSB3b3VsZCBhbHNvIHByZXZlbnREZWZhdWx0IHRoZSBjaG9yZC5cbiAgaWYgKGUua2V5ID09PSAneicgJiYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkpKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHVuZG9MYXN0U3RhdHVzKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYWx0S2V5KSByZXR1cm47XG5cbiAgY29uc3QgX2FueU1vZGFsT3BlbiA9ICgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1iZy52aXNpYmxlJykgIT09IG51bGw7XG5cbiAgaWYgKGUua2V5ID09PSAnPycgfHwgZS5rZXkgPT09ICcvJykge1xuICAgIGlmIChfYW55TW9kYWxPcGVuKCkpIHJldHVybjtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgb3BlbkNvbnRyb2xzTW9kYWwoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuICAgIF9jbG9zZVRvcG1vc3RMYXllcigpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEEgdGFrZW92ZXIgcGFuZWwgKGUuZy4gU3BsaXQgRWRpdG9yKSBjb3ZlcnMgdGhlIGRldGFpbCBwYW5lIGJ1dCBub3QgdGhlXG4gIC8vIGNsaXAgbGlzdCBiZXNpZGUgaXQgLSB3aXRob3V0IHRoaXMgZ3VhcmQgSi9LL0EvUiB3b3VsZCBzaWxlbnRseSBhY3Qgb24gYVxuICAvLyBjbGlwIHRoZSB1c2VyIGNhbiBubyBsb25nZXIgc2VlLlxuICBpZiAoX2FueU1vZGFsT3BlbigpIHx8IFBhbmVsTmF2LmlzT3BlbigpKSByZXR1cm47XG5cbiAgLy8gQS9SL0UgbXVzdCBhY3Qgb24gdGhlIGNsaXAgdGhlIHVzZXIgaXMgcG9pbnRpbmcgYXQ6IHdoZW4ga2V5Ym9hcmQgZm9jdXNcbiAgLy8gc2l0cyBvbiBhIGNsaXAgbGlzdCByb3cgKFRhYiksIHRoYXQgcm93IGlzIHRoZSBzdWJqZWN0IC0gbm90IHRoZSBhY3RpdmVcbiAgLy8gY2xpcCwgd2hpY2ggY2FuIGJlIGEgZGlmZmVyZW50IHJvdyAoZm9jdXNlZC12cy1hY3RpdmUgbWlzbWF0Y2gpLlxuICBjb25zdCBmb2N1c2VkUm93ID0gZS50YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50ID8gZS50YXJnZXQuY2xvc2VzdCgnI2NsaXAtbGlzdCBsaVtkYXRhLWNsaXAtaWRdJykgOiBudWxsO1xuICBjb25zdCBzdWJqZWN0Q2xpcElkID0gZm9jdXNlZFJvdyA/IE51bWJlcihmb2N1c2VkUm93LmRhdGFzZXQuY2xpcElkKSA6IEFwcFN0YXRlLmFjdGl2ZUNsaXBJZDtcbiAgaWYgKCFzdWJqZWN0Q2xpcElkKSByZXR1cm47XG5cbiAgLy8gQWN0aXZhdGUgdGhlIHN1YmplY3QgZmlyc3Qgc28gdGhlIGRldGFpbCBwYW5lIGFuZCBwbGF5ZXIgc2hvdyB0aGUgY2xpcFxuICAvLyB0aGUgc2hvcnRjdXQgaXMgYWN0aW5nIG9uIGJlZm9yZSB0aGUgYWN0aW9uIGxhbmRzLlxuICBjb25zdCBfYWN0T25TdWJqZWN0ID0gYWN0aW9uID0+IHtcbiAgICBpZiAoc3ViamVjdENsaXBJZCAhPT0gQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSBzZWxlY3RDbGlwKHN1YmplY3RDbGlwSWQpLnRoZW4oKCkgPT4gYWN0aW9uKHN1YmplY3RDbGlwSWQpKTtcbiAgICBlbHNlIGFjdGlvbihzdWJqZWN0Q2xpcElkKTtcbiAgfTtcbiAgLy8gQXJyb3cgbmF2aWdhdGlvbiBtb3ZlcyBrZXlib2FyZCBmb2N1cyBhbG9uZyB3aXRoIHRoZSBhY3RpdmUgY2xpcCBzbyB0aGVcbiAgLy8gZm9jdXMgcmluZyBhbmQgdGhlIGFjdGl2ZSBoaWdobGlnaHQgY2FuIG5ldmVyIHBvaW50IGF0IGRpZmZlcmVudCByb3dzLlxuICBjb25zdCBfbmF2aWdhdGVUbyA9IGlkID0+IHtcbiAgICBzZWxlY3RDbGlwKGlkKTtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAjY2xpcC1saXN0IGxpW2RhdGEtY2xpcC1pZD1cIiR7aWR9XCJdYCk/LmZvY3VzKCk7XG4gIH07XG5cbiAgY29uc3QgaWR4ID0gQXBwU3RhdGUuY2xpcHMuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gc3ViamVjdENsaXBJZCk7XG5cbiAgc3dpdGNoIChlLmtleSkge1xuICAgIGNhc2UgJ2EnOiBjYXNlICdBJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIF9hY3RPblN1YmplY3QoaWQgPT4gc2V0U3RhdHVzKGlkLCAnYXBwcm92ZWQnKSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdyJzogY2FzZSAnUic6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBfYWN0T25TdWJqZWN0KGlkID0+IHNldFN0YXR1cyhpZCwgJ3JlamVjdGVkJykpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAndSc6IGNhc2UgJ1UnOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgX2FjdE9uU3ViamVjdChpZCA9PiBzZXRTdGF0dXMoaWQsICdwZW5kaW5nJykpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnICc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB7IGNvbnN0IHYgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGxheWVyLWFyZWEgdmlkZW8nKTsgaWYgKHYpIHsgdi5wYXVzZWQgPyB2LnBsYXkoKSA6IHYucGF1c2UoKTsgfSB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdlJzogY2FzZSAnRSc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBfYWN0T25TdWJqZWN0KGV4cG9ydENsaXApO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQXJyb3dMZWZ0JzpcbiAgICBjYXNlICdBcnJvd1VwJzpcbiAgICBjYXNlICdrJzogY2FzZSAnSyc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBpZiAoaWR4ID4gMCkgX25hdmlnYXRlVG8oQXBwU3RhdGUuY2xpcHNbaWR4IC0gMV0uaWQpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQXJyb3dSaWdodCc6XG4gICAgY2FzZSAnQXJyb3dEb3duJzpcbiAgICBjYXNlICdqJzogY2FzZSAnSic6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBpZiAoaWR4ICE9PSAtMSAmJiBpZHggPCBBcHBTdGF0ZS5jbGlwcy5sZW5ndGggLSAxKSBfbmF2aWdhdGVUbyhBcHBTdGF0ZS5jbGlwc1tpZHggKyAxXS5pZCk7XG4gICAgICBicmVhaztcbiAgfVxufSk7XG5cbi8vIE5vIGV4cG9ydHMgLSB0aGlzIG1vZHVsZSdzIG9ubHkgcHVibGljIHN1cmZhY2UgaXMgdGhlIGtleWRvd24gbGlzdGVuZXJcbi8vIHJlZ2lzdHJhdGlvbiBpdHNlbGY7IF9tb2RhbEVzY2FwZUNsb3NlcnMvX2Nsb3NlVG9wbW9zdExheWVyIGFyZSByZWZlcmVuY2VkXG4vLyBvbmx5IGZyb20gd2l0aGluIHRoaXMgbW9kdWxlLiBTdGlsbC1jbGFzc2ljIGdsb2JhbHMgaXQgY2FsbHNcbi8vIChjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCwgc2VsZWN0Q2xpcCwgc2V0U3RhdHVzLCBleHBvcnRDbGlwLCBldGMuKSByZXNvbHZlXG4vLyBvZmYgd2luZG93IHNpbmNlIHRoZWlyIG93bmluZyBtb2R1bGVzIGhhdmVuJ3QgbWlncmF0ZWQgdG8gRVNNIHlldC5cbiIsICIvLyBGZWF0dXJlLW1hcCAtIHRoZSByZWNvbW1lbmRlZC1tb2RlbCBjYXRhbG9nLCBtb2RlbC1yZWFkaW5lc3Mgcm93LCBhbmQgdGhlXG4vLyBjYXBhYmlsaXRpZXMgb3ZlcnZpZXcgKFwid2hhdCBzY29yaW5nL3Zpc2lvbiBwb3dlciBpcyBpbnN0YWxsZWQgYW5kIGhvdyBkbyBJXG4vLyBnZXQgbW9yZVwiKS4gRXh0cmFjdGVkIG91dCBvZiBzZXR0aW5ncy5qcyAod2hpY2ggZ3JldyBpbnRvIGEgY2F0Y2gtYWxsKSAtXG4vLyB0aGVzZSByZWFkIGJhY2tlbmQvbW9kZWwgY29uZmlnIHRvIGRlY2lkZSB3aGF0IHRvIHJlbmRlciwgYnV0IHRoZSBzYXZlL2RpcnR5XG4vLyBlbmdpbmUgdGhhdCBwZXJzaXN0cyBjb25maWcgc3RheXMgaW4gc2V0dGluZ3MuanMuXG4vLyAgIEFQSTogcm91dGVzL2xsbS5weSwgcm91dGVzL2NvbmZpZy5weSAoY2FwYWJpbGl0aWVzL3RpZXJzKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9tb2RlbF9jYXRhbG9nLnB5LCB0ZXN0cy91aS90ZXN0X3VpX3NldHRpbmdzLnB5XG5pbXBvcnQgeyBlc2NIdG1sIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xuaW1wb3J0IHsgc2hvd1RvYXN0IH0gZnJvbSAnLi91dGlscy5qcyc7XG5cbi8vIOKUgOKUgCBtb2RlbCBjYXRhbG9nIChyZWNvbW1lbmRlZCB0ZXh0ICsgdmlzaW9uIG1vZGVscykg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBMb2FkZWQgb25jZSBwZXIgc2Vzc2lvbi4gRmlsbHMgdGhlIHJlY29tbWVuZGVkIG1vZGVsIGxpc3RzOyB0aGUgY2FwYWJpbGl0aWVzXG4vLyBsaW5lIHJlZmxlY3RzIHRoZSAqc2F2ZWQqIGFjdGl2ZSBtb2RlbC5cbmxldCBfbW9kZWxDYXRhbG9nID0gbnVsbDtcbi8vIG1vZGVsc19kaXIgLyBmcmVlIGRpc2sgLyBzYXZlZCBiYWNrZW5kLCBzbyBjYXJkcyBjYW4gc2hvdyBcIn5YIEdCLCBZIEdCIGZyZWVcIlxuLy8gdXAgZnJvbnQgYW5kIHRoZSBzdW1tYXJ5IGxpbmUgY2FuIG5hbWUgdGhlIGFjdGl2ZSBiYWNrZW5kLlxubGV0IF9tb2RlbENhdGFsb2dJbmZvID0geyBtb2RlbHNfZGlyOiAnJywgZnJlZV9nYjogbnVsbCwgYmFja2VuZDogJ2xsYW1hY3BwJyB9O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX2Vuc3VyZU1vZGVsQ2F0YWxvZygpIHtcbiAgaWYgKF9tb2RlbENhdGFsb2cpIHJldHVybjtcbiAgYXdhaXQgX2xvYWRNb2RlbENhdGFsb2coKTtcbn1cblxuLy8gRm9yY2UgYSByZS1mZXRjaCArIHJlLXJlbmRlci4gQ2FsbGVkIGFmdGVyIFNhdmUgKGNvbmZpZyBjaGFuZ2VkIHdoaWNoIG1vZGVsIGlzXG4vLyBhY3RpdmUpIHNvIHRoZSBcIkFjdGl2ZVwiIGJhZGdlIGFuZCB0aGUgc3VtbWFyeSBsaW5lIHJlZmxlY3QgdGhlIHNhdmVkIHN0YXRlLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hNb2RlbENhdGFsb2coKSB7XG4gIF9tb2RlbENhdGFsb2cgPSBudWxsO1xuICBhd2FpdCBfbG9hZE1vZGVsQ2F0YWxvZygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfbG9hZE1vZGVsQ2F0YWxvZygpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2goJy9hcGkvbGxtL2NhdGFsb2cnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICAgIF9tb2RlbENhdGFsb2cgPSBkYXRhLm1vZGVscyB8fCBbXTtcbiAgICBfbW9kZWxDYXRhbG9nSW5mbyA9IHtcbiAgICAgIG1vZGVsc19kaXI6IGRhdGEubW9kZWxzX2RpciB8fCAnJyxcbiAgICAgIGZyZWVfZ2I6IGRhdGEuZnJlZV9nYiA/PyBudWxsLFxuICAgICAgYmFja2VuZDogZGF0YS5iYWNrZW5kIHx8ICdsbGFtYWNwcCcsXG4gICAgfTtcbiAgfSBjYXRjaCB7XG4gICAgX21vZGVsQ2F0YWxvZyA9IFtdO1xuICAgIGNvbnN0IGZhaWxlZEVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxhbWFjcHAtcmVjb21tZW5kZWQnKTtcbiAgICBpZiAoZmFpbGVkRWwpIGZhaWxlZEVsLmlubmVySFRNTCA9XG4gICAgICAnPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj5Db3VsZCBub3QgbG9hZCB0aGUgcmVjb21tZW5kZWQgbW9kZWwgbGlzdCAtIGNoZWNrIHlvdXIgaW50ZXJuZXQgY29ubmVjdGlvbiBhbmQgcmVvcGVuIFNldHRpbmdzLiBZb3UgY2FuIHN0aWxsIHNldCBhIG1vZGVsIGZpbGUgYnkgaGFuZCB1bmRlciBBZHZhbmNlZCBBSSBvcHRpb25zIGJlbG93LjwvZGl2Pic7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9yZW5kZXJSZWNvbW1lbmRlZE1vZGVscygncy1sbGFtYWNwcC1yZWNvbW1lbmRlZCcsICdsbGFtYWNwcCcpO1xuICBfdXBkYXRlQ3VycmVudE1vZGVsU3VtbWFyeSgpO1xufVxuXG4vLyBcIkN1cnJlbnRseSB1c2luZzogPG1vZGVsPiAoPGJhY2tlbmQ+KVwiIC0gc3RhdGVzIHRoZSBzYXZlZCBhY3RpdmUgbW9kZWwgcGxhaW5seVxuLy8gc28gaXQgaXNuJ3QgcmV2ZXJzZS1lbmdpbmVlcmVkIGZyb20gYSBwYXRoIHN0cmluZy4gSGlkZGVuIHdoZW4gbm90aGluZyBtYXRjaGVzLlxuY29uc3QgX0JBQ0tFTkRfTEFCRUxTID0geyBsbGFtYWNwcDogJ0xvY2FsIGxsYW1hLmNwcCcgfTtcblxuZnVuY3Rpb24gX3VwZGF0ZUN1cnJlbnRNb2RlbFN1bW1hcnkoKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxtLWN1cnJlbnQtc3VtbWFyeScpO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGNvbnN0IGFjdGl2ZSA9IChfbW9kZWxDYXRhbG9nIHx8IFtdKS5maW5kKG0gPT4gbS5hY3RpdmUpO1xuICBpZiAoIWFjdGl2ZSkgeyBlbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyByZXR1cm47IH1cbiAgY29uc3QgYmFja2VuZCA9IF9tb2RlbENhdGFsb2dJbmZvLmJhY2tlbmQ7XG4gIGNvbnN0IGxhYmVsID0gX0JBQ0tFTkRfTEFCRUxTW2JhY2tlbmRdIHx8IGJhY2tlbmQ7XG4gIGVsLmlubmVySFRNTCA9XG4gICAgYEN1cnJlbnRseSB1c2luZzogPHN0cm9uZz4ke2VzY0h0bWwoYWN0aXZlLmRpc3BsYXlfbmFtZSl9PC9zdHJvbmc+IGAgK1xuICAgIGA8c3BhbiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj4oJHtlc2NIdG1sKGxhYmVsKX0pPC9zcGFuPmA7XG4gIGVsLnN0eWxlLmRpc3BsYXkgPSAnJztcbn1cblxuLy8gVGV4dCBhbmQgdmlzaW9uIG1vZGVscyByZW5kZXIgYXMgdHdvIGxhYmVsbGVkIGdyb3VwcyBwZXIgYmFja2VuZCwgZWFjaCB3aXRoXG4vLyBpdHMgb3duIGludHJvLCByYXRoZXIgdGhhbiBvbmUgZmxhdCBsaXN0IC0gc28gaXQncyBvYnZpb3VzIHdoaWNoIG1vZGVscyBzY29yZVxuLy8gY2xpcHMgYW5kIHdoaWNoIGRlc2NyaWJlIGZyYW1lcy5cbmZ1bmN0aW9uIF9yZW5kZXJSZWNvbW1lbmRlZE1vZGVscyhjb250YWluZXJJZCwgYmFja2VuZCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbnRhaW5lcklkKTtcbiAgaWYgKCFlbCB8fCAhX21vZGVsQ2F0YWxvZykgcmV0dXJuO1xuICBjb25zdCBtb2RlbHMgPSBfbW9kZWxDYXRhbG9nLmZpbHRlcihtID0+IG0uYmFja2VuZHMuaW5jbHVkZXMoYmFja2VuZCkpO1xuICBpZiAoIW1vZGVscy5sZW5ndGgpIHsgZWwuaW5uZXJIVE1MID0gJyc7IHJldHVybjsgfVxuICBjb25zdCB0ZXh0TW9kZWxzID0gbW9kZWxzLmZpbHRlcihtID0+ICFtLmtpbmRzLmluY2x1ZGVzKCd2aXNpb24nKSk7XG4gIGNvbnN0IHZpc2lvbk1vZGVscyA9IG1vZGVscy5maWx0ZXIobSA9PiBtLmtpbmRzLmluY2x1ZGVzKCd2aXNpb24nKSk7XG4gIGVsLmlubmVySFRNTCA9XG4gICAgX21vZGVsR3JvdXBIdG1sKCdUZXh0IHNjb3JpbmcgbW9kZWxzJyxcbiAgICAgICdTY29yZSBjbGlwcyBhbmQgd3JpdGUgZGVzY3JpcHRpb25zLiBQaWNrIG9uZSB0byBnZXQgc3RhcnRlZC4nLCB0ZXh0TW9kZWxzLCBiYWNrZW5kLCAndGV4dCcpICtcbiAgICBfbW9kZWxHcm91cEh0bWwoJ0ltYWdlIGFuYWx5c2lzICh2aXNpb24pIG1vZGVscycsXG4gICAgICAnT3B0aW9uYWwgLSBsZXQgWXV1Q2xpcCBsb29rIGF0IGZyYW1lcyBhbmQgZGVzY3JpYmUgd2hhdCBpcyBvbiBzY3JlZW4uJywgdmlzaW9uTW9kZWxzLCBiYWNrZW5kLCAndmlzaW9uJyk7XG4gIF93aXJlTW9kZWxDYXJkcyhlbCk7XG59XG5cbmZ1bmN0aW9uIF9tb2RlbEdyb3VwSHRtbCh0aXRsZSwgaW50cm8sIG1vZGVscywgYmFja2VuZCwga2luZCkge1xuICBpZiAoIW1vZGVscy5sZW5ndGgpIHJldHVybiAnJztcbiAgcmV0dXJuIChcbiAgICBgPGRpdiBjbGFzcz1cInJlYy1tb2RlbC1ncm91cFwiPmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJyZWMtbW9kZWwtZ3JvdXAtdGl0bGVcIj4ke2VzY0h0bWwodGl0bGUpfTwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+JHtlc2NIdG1sKGludHJvKX08L2Rpdj5gICtcbiAgICAgIG1vZGVscy5tYXAobSA9PiBfcmVjTW9kZWxIdG1sKG0sIGJhY2tlbmQsIGtpbmQpKS5qb2luKCcnKSArXG4gICAgYDwvZGl2PmBcbiAgKTtcbn1cblxuZnVuY3Rpb24gX3dpcmVNb2RlbENhcmRzKGVsKSB7XG4gIGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5yZWMtbW9kZWwnKS5mb3JFYWNoKGNhcmQgPT4ge1xuICAgIGNvbnN0IG1vZGVsSWQgPSBjYXJkLmdldEF0dHJpYnV0ZSgnZGF0YS1tb2RlbC1pZCcpO1xuICAgIGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtYWN0PVwiZG93bmxvYWQtZ2d1ZlwiXScpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGRvd25sb2FkR2d1Zk1vZGVsKG1vZGVsSWQsIGNhcmQpKTtcbiAgICBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWFjdD1cInVzZS1nZ3VmXCJdJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX3VzZUdndWZNb2RlbChtb2RlbElkKSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBfbW9kZWxNZXRhTGluZShtKSB7XG4gIGNvbnN0IGZyZWUgPSBfbW9kZWxDYXRhbG9nSW5mby5mcmVlX2diO1xuICByZXR1cm4gW1xuICAgIG0uc2l6ZV9nYiA/IGB+JHttLnNpemVfZ2J9IEdCYCA6IG51bGwsXG4gICAgKG0uc2l6ZV9nYiAhPSBudWxsICYmIGZyZWUgIT0gbnVsbCkgPyBgJHtmcmVlfSBHQiBmcmVlYCA6IG51bGwsXG4gICAgbS5saWNlbmNlLFxuICBdLmZpbHRlcihCb29sZWFuKS5qb2luKCcgwrcgJyk7XG59XG5cbmZ1bmN0aW9uIF9tb2RlbEJhZGdlKG0pIHtcbiAgaWYgKG0uYWN0aXZlKSByZXR1cm4gYDxzcGFuIGNsYXNzPVwicmVjLW1vZGVsLWJhZGdlIGFjdGl2ZVwiPkFjdGl2ZTwvc3Bhbj5gO1xuICBpZiAobS5pbnN0YWxsZWQpIHJldHVybiBgPHNwYW4gY2xhc3M9XCJyZWMtbW9kZWwtYmFkZ2VcIj5Eb3dubG9hZGVkPC9zcGFuPmA7XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gX3JlY01vZGVsSHRtbChtLCBiYWNrZW5kLCBraW5kKSB7XG4gIGNvbnN0IGFjdGlvbnMgPSBfbGxhbWFjcHBBY3Rpb25zKG0pO1xuICByZXR1cm4gKFxuICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsJHttLmFjdGl2ZSA/ICcgYWN0aXZlJyA6ICcnfVwiIGRhdGEtbW9kZWwtaWQ9XCIke2VzY0h0bWwobS5pZCl9XCIgZGF0YS1raW5kPVwiJHtlc2NIdG1sKGtpbmQgfHwgJ3RleHQnKX1cIj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsLWhlYWRcIj48c3BhbiBjbGFzcz1cInJlYy1tb2RlbC1uYW1lXCI+JHtlc2NIdG1sKG0uZGlzcGxheV9uYW1lKX08L3NwYW4+YCArXG4gICAgICBfbW9kZWxCYWRnZShtKSArXG4gICAgICBgPHNwYW4gY2xhc3M9XCJyZWMtbW9kZWwtbWV0YVwiPiR7ZXNjSHRtbChfbW9kZWxNZXRhTGluZShtKSl9PC9zcGFuPjwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJyZWMtbW9kZWwtd2h5XCI+JHtlc2NIdG1sKG0ud2h5KX08L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsLWFjdGlvbnNcIj4ke2FjdGlvbnN9PC9kaXY+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cIm1kbC1wcm9ncmVzc1wiIGRhdGEtZ2d1Zi1wcm9ncmVzcyBzdHlsZT1cImRpc3BsYXk6bm9uZVwiPmAgK1xuICAgICAgICBgPGRpdiBjbGFzcz1cIm1kbC1iYXJcIj48ZGl2IGNsYXNzPVwibWRsLWJhci1maWxsXCIgZGF0YS1nZ3VmLWZpbGw+PC9kaXY+PC9kaXY+YCArXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cIm1kbC1wY3RcIiBkYXRhLWdndWYtcGN0Pjwvc3Bhbj48L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaW5zdGFsbC1sb2dcIiBkYXRhLWdndWYtbG9nPjwvZGl2PmAgK1xuICAgIGA8L2Rpdj5gXG4gICk7XG59XG5cbi8vIE9uZS1jbGljayBzdXJmYWNlIGZvciBsb2NhbCAuZ2d1ZiBtb2RlbHM6IGRvd25sb2FkIHdoZW4gbWlzc2luZywgXCJVc2UgdGhpc1xuLy8gbW9kZWxcIiB3aGVuIHRoZSBmaWxlIGlzIGFscmVhZHkgb24gZGlzaywgYW5kIGEgcGxhaW4gXCJpbiB1c2VcIiBub3RlIHdoZW4gYWN0aXZlLlxuLy8gVGhlIHJhdyBwYXRoIGJveGVzIChBZHZhbmNlZCBkaXNjbG9zdXJlKSBzdGF5IGFzIHRoZSBtYW51YWwgZmFsbGJhY2suXG5mdW5jdGlvbiBfbGxhbWFjcHBBY3Rpb25zKG0pIHtcbiAgaWYgKCFtLmdndWZfdXJsKSByZXR1cm4gJyc7XG4gIGlmICghbS5nZ3VmX2ZpbGVuYW1lKSB7XG4gICAgcmV0dXJuIGA8YSBocmVmPVwiJHtlc2NIdG1sKG0uZ2d1Zl91cmwpfVwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyXCI+RG93bmxvYWQgcGFnZTwvYT5gO1xuICB9XG4gIGNvbnN0IHBhcnRzID0gW107XG4gIGlmIChtLmFjdGl2ZSkge1xuICAgIHBhcnRzLnB1c2goYDxzcGFuIGNsYXNzPVwicmVjLW1vZGVsLW5vdGVcIj5JbiB1c2UgZm9yIGxvY2FsIHNjb3JpbmcuPC9zcGFuPmApO1xuICB9IGVsc2UgaWYgKG0uaW5zdGFsbGVkKSB7XG4gICAgcGFydHMucHVzaChgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidG4tc2Vjb25kYXJ5XCIgZGF0YS1hY3Q9XCJ1c2UtZ2d1ZlwiPlVzZSB0aGlzIG1vZGVsPC9idXR0b24+YCk7XG4gIH0gZWxzZSB7XG4gICAgcGFydHMucHVzaChgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidG4tc2Vjb25kYXJ5XCIgZGF0YS1hY3Q9XCJkb3dubG9hZC1nZ3VmXCI+RG93bmxvYWQgbm93PC9idXR0b24+YCk7XG4gIH1cbiAgcGFydHMucHVzaChgPGEgaHJlZj1cIiR7ZXNjSHRtbChtLmdndWZfdXJsKX1cIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lclwiPkNob29zZSBhIGRpZmZlcmVudCBmaWxlPC9hPmApO1xuICByZXR1cm4gcGFydHMuam9pbignJyk7XG59XG5cbi8vIFBvaW50IHRoZSAoYWR2YW5jZWQpIHBhdGggZmllbGRzIGF0IGFuIGFscmVhZHktcHJlc2VudCBtb2RlbCBzbyBhIHBsYWluIFNhdmVcbi8vIGFjdGl2YXRlcyBpdCAtIG5vIHJlLWRvd25sb2FkLiBBIHZpc2lvbiBlbnRyeSBmaWxscyB0aGUgdmlzaW9uIG1vZGVsICsgbW1wcm9qXG4vLyBwcm9qZWN0b3IgZmllbGRzOyBhIHRleHQgZW50cnkgZmlsbHMgdGhlIHRleHQgbW9kZWwgZmllbGQuIFRoZSB0d28gYnVja2V0c1xuLy8gYXJlIGluZGVwZW5kZW50IGNvbmZpZyBrZXlzLCBzbyBvbmUgbXVzdCBuZXZlciBvdmVyd3JpdGUgdGhlIG90aGVyLlxuZnVuY3Rpb24gX2FwcGx5TW9kZWxQYXRocyhtKSB7XG4gIGNvbnN0IGlzVmlzaW9uID0gQXJyYXkuaXNBcnJheShtLmtpbmRzKSAmJiBtLmtpbmRzLmluY2x1ZGVzKCd2aXNpb24nKTtcbiAgaWYgKGlzVmlzaW9uKSB7XG4gICAgY29uc3QgdmlzaW9uRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1sbG0tdmlzaW9uLW1vZGVsLXBhdGgnKTtcbiAgICBpZiAodmlzaW9uRWwgJiYgbS5nZ3VmX3BhdGgpIHZpc2lvbkVsLnZhbHVlID0gbS5nZ3VmX3BhdGg7XG4gICAgY29uc3QgcHJvakVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxtLW1tcHJvai1wYXRoJyk7XG4gICAgaWYgKHByb2pFbCAmJiBtLm1tcHJval9wYXRoKSBwcm9qRWwudmFsdWUgPSBtLm1tcHJval9wYXRoO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHBhdGhFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWxsbS1tb2RlbC1wYXRoJyk7XG4gICAgaWYgKHBhdGhFbCAmJiBtLmdndWZfcGF0aCkgcGF0aEVsLnZhbHVlID0gbS5nZ3VmX3BhdGg7XG4gIH1cbiAgd2luZG93Ll9jaGVja1NldHRpbmdzRGlydHkoKTtcbn1cblxuZnVuY3Rpb24gX3VzZUdndWZNb2RlbChtb2RlbElkKSB7XG4gIGNvbnN0IG0gPSAoX21vZGVsQ2F0YWxvZyB8fCBbXSkuZmluZCh4ID0+IHguaWQgPT09IG1vZGVsSWQpO1xuICBpZiAoIW0pIHJldHVybjtcbiAgX2FwcGx5TW9kZWxQYXRocyhtKTtcbiAgc2hvd1RvYXN0KCdNb2RlbCBzZWxlY3RlZCAtIGNsaWNrIFNhdmUgdG8gYXBwbHknLCAnaW5mbycpO1xufVxuXG4vLyDilIDilIAgb25lLWNsaWNrIGxvY2FsICguZ2d1ZikgZG93bmxvYWQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBTZXJ2ZXItb3duZWQgZG93bmxvYWQgKFBPU1QgL2FwaS9sbG0vZ2d1Zi9kb3dubG9hZCkgZm9yIGEgcmVjb21tZW5kZWQgbG9jYWxcbi8vIG1vZGVsICh0ZXh0LCBvciB2aXNpb24gKyBpdHMgbW1wcm9qIHByb2plY3RvciksIHNvIGxsYW1hLmNwcCBnZXRzIGEgb25lLWNsaWNrXG4vLyBmbG93IGluc3RlYWQgb2Ygb25seSBhIFwiRG93bmxvYWQgcGFnZVwiIGxpbmsuIFNTRSArIENhbmNlbC12aWEtYWJvcnQgc3RyZWFtO1xuLy8gb24gc3VjY2VzcyB0aGUgc2VydmVyIGhhcyB3cml0dGVuIHRoZSBtb2RlbCAoYW5kIHByb2plY3RvcikgcGF0aChzKSwgc28gd2Vcbi8vIHBvaW50IHRoZSBwYXRoIGZpZWxkcyBhdCB0aGVtLCByZWZyZXNoIHRoZSByZWFkaW5lc3MgbGluZSwgYW5kIHByb21wdCBhIFNhdmUuXG5sZXQgX2dndWZBYm9ydCA9IG51bGw7XG5cbi8vIFRoZSBDTEkgcHJpbnRzIFwiRG93bmxvYWRpbmcgPG5hbWU+IC0gPGZpbGU+OiBOTiUgKHgveSBHQilcIiBsaW5lczsgcHVsbCB0aGVcbi8vIHBlcmNlbnRhZ2Ugb3V0IHRvIGRyaXZlIGEgZGV0ZXJtaW5hdGUgYmFyLiBWaXNpb24gZW50cmllcyBzdHJlYW0gdHdvIGZpbGVzIGluXG4vLyB0dXJuLCBzbyB0aGUgYmFyIHJlc2V0cyBwZXIgZmlsZSAtIGV4cGVjdGVkLCBub3QgYSBidWcuXG5mdW5jdGlvbiBfcGFyc2VHZ3VmUGN0KGxpbmUpIHtcbiAgY29uc3QgbWF0Y2ggPSAvKFxcZCspJS8uZXhlYyhsaW5lKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHBjdCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gIHJldHVybiBwY3QgPj0gMCAmJiBwY3QgPD0gMTAwID8gcGN0IDogbnVsbDtcbn1cblxuZnVuY3Rpb24gX3NldEdndWZQcm9ncmVzcyhjYXJkLCB2YWx1ZSkge1xuICBjb25zdCBmaWxsID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1nZ3VmLWZpbGxdJyk7XG4gIGNvbnN0IHBjdCA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1wY3RdJyk7XG4gIGlmICghZmlsbCB8fCAhcGN0KSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgZmlsbC5jbGFzc0xpc3QuYWRkKCdpbmRldGVybWluYXRlJyk7XG4gICAgZmlsbC5zdHlsZS53aWR0aCA9ICcnO1xuICAgIHBjdC50ZXh0Q29udGVudCA9ICcnO1xuICB9IGVsc2Uge1xuICAgIGZpbGwuY2xhc3NMaXN0LnJlbW92ZSgnaW5kZXRlcm1pbmF0ZScpO1xuICAgIGZpbGwuc3R5bGUud2lkdGggPSB2YWx1ZSArICclJztcbiAgICBwY3QudGV4dENvbnRlbnQgPSB2YWx1ZSArICclJztcbiAgfVxufVxuXG5mdW5jdGlvbiBfc2V0R2d1ZkNhbmNlbChjYXJkLCBzaG93LCBvbkNhbmNlbCkge1xuICBjb25zdCBsb2cgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWdndWYtbG9nXScpO1xuICBpZiAoIWxvZykgcmV0dXJuO1xuICBsZXQgYnRuID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1nZ3VmLWNhbmNlbF0nKTtcbiAgaWYgKHNob3cpIHtcbiAgICBpZiAoIWJ0bikge1xuICAgICAgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICBidG4uc2V0QXR0cmlidXRlKCdkYXRhLWdndWYtY2FuY2VsJywgJycpO1xuICAgICAgYnRuLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGJ0bi5jbGFzc05hbWUgPSAnYnRuLXNlY29uZGFyeSc7XG4gICAgICBidG4udGV4dENvbnRlbnQgPSAnQ2FuY2VsIGRvd25sb2FkJztcbiAgICAgIGJ0bi5zdHlsZS5tYXJnaW5Ub3AgPSAnNHB4JztcbiAgICAgIGxvZy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShidG4sIGxvZyk7XG4gICAgfVxuICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGJ0bi5vbmNsaWNrID0gb25DYW5jZWw7XG4gICAgYnRuLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgfSBlbHNlIGlmIChidG4pIHtcbiAgICBidG4uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBkb3dubG9hZEdndWZNb2RlbChtb2RlbElkLCBjYXJkKSB7XG4gIGNvbnN0IGxvZyA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1sb2ddJyk7XG4gIGNvbnN0IGJ1dHRvbiA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtYWN0PVwiZG93bmxvYWQtZ2d1ZlwiXScpO1xuICBjb25zdCBwcm9ncmVzcyA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1wcm9ncmVzc10nKTtcbiAgaWYgKCFsb2cpIHJldHVybjtcbiAgY29uc3QgbW9kZWwgPSAoX21vZGVsQ2F0YWxvZyB8fCBbXSkuZmluZCh4ID0+IHguaWQgPT09IG1vZGVsSWQpO1xuICBsb2cuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gIGxvZy50ZXh0Q29udGVudCA9ICdTdGFydGluZyBkb3dubG9hZCAtIHRoaXMgY2FuIHRha2Ugc2V2ZXJhbCBtaW51dGVzLi4uXFxuJztcbiAgaWYgKHByb2dyZXNzKSBwcm9ncmVzcy5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gIF9zZXRHZ3VmUHJvZ3Jlc3MoY2FyZCwgbnVsbCk7XG4gIGlmIChidXR0b24pIHsgYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTsgYnV0dG9uLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkaW5nLi4uJzsgfVxuICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBfZ2d1ZkFib3J0ID0gY29udHJvbGxlcjtcbiAgX3NldEdndWZDYW5jZWwoY2FyZCwgdHJ1ZSwgKCkgPT4geyBjb250cm9sbGVyLmFib3J0KCk7IH0pO1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChgL2FwaS9sbG0vZ2d1Zi9kb3dubG9hZD9tb2RlbF9pZD0ke2VuY29kZVVSSUNvbXBvbmVudChtb2RlbElkKX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IG1ldGhvZDogJ1BPU1QnLCBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIH0pO1xuICAgIGlmICghcmVzcC5vaykge1xuICAgICAgbGV0IGRldGFpbCA9ICcnO1xuICAgICAgdHJ5IHsgZGV0YWlsID0gKGF3YWl0IHJlc3AuanNvbigpKS5kZXRhaWwgfHwgJyc7IH0gY2F0Y2ggeyBkZXRhaWwgPSBhd2FpdCByZXNwLnRleHQoKTsgfVxuICAgICAgbG9nLnRleHRDb250ZW50ICs9IGDinJcgJHtkZXRhaWwgfHwgJ0Rvd25sb2FkIGNvdWxkIG5vdCBzdGFydC4nfVxcbmA7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJlYWRlciA9IHJlc3AuYm9keS5nZXRSZWFkZXIoKTtcbiAgICBjb25zdCBkZWMgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICBsZXQgYnVmID0gJyc7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHsgZG9uZSwgdmFsdWUgfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG4gICAgICBpZiAoZG9uZSkgYnJlYWs7XG4gICAgICBidWYgKz0gZGVjLmRlY29kZSh2YWx1ZSwgeyBzdHJlYW06IHRydWUgfSk7XG4gICAgICBjb25zdCBsaW5lcyA9IGJ1Zi5zcGxpdCgnXFxuJyk7XG4gICAgICBidWYgPSBsaW5lcy5wb3AoKTtcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnZGF0YTogJykpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBtc2cgPSBKU09OLnBhcnNlKGxpbmUuc2xpY2UoNikpO1xuICAgICAgICBpZiAobXNnID09PSAnX19ET05FX18nKSB7XG4gICAgICAgICAgX3NldEdndWZQcm9ncmVzcyhjYXJkLCAxMDApO1xuICAgICAgICAgIGxvZy50ZXh0Q29udGVudCArPSAn4pyTIERvbmUgLSBtb2RlbCBzZWxlY3RlZC4gU2F2ZSB0byBhcHBseS5cXG4nO1xuICAgICAgICAgIGlmIChtb2RlbCkgX2FwcGx5TW9kZWxQYXRocyhtb2RlbCk7XG4gICAgICAgICAgX3VwZGF0ZUxsbUNhcGFiaWxpdGllcygpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwY3QgPSBfcGFyc2VHZ3VmUGN0KG1zZyk7XG4gICAgICAgIGlmIChwY3QgIT0gbnVsbCkgX3NldEdndWZQcm9ncmVzcyhjYXJkLCBwY3QpO1xuICAgICAgICBsb2cudGV4dENvbnRlbnQgKz0gbXNnICsgJ1xcbic7XG4gICAgICAgIGxvZy5zY3JvbGxUb3AgPSBsb2cuc2Nyb2xsSGVpZ2h0O1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciAmJiBlcnIubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSBsb2cudGV4dENvbnRlbnQgKz0gJ+KWoCBEb3dubG9hZCBjYW5jZWxsZWQuXFxuJztcbiAgICBlbHNlIGxvZy50ZXh0Q29udGVudCArPSAn4pyXIERvd25sb2FkIGZhaWxlZCAtIGNoZWNrIHlvdXIgY29ubmVjdGlvbiBhbmQgdHJ5IGFnYWluLlxcbic7XG4gIH0gZmluYWxseSB7XG4gICAgX2dndWZBYm9ydCA9IG51bGw7XG4gICAgX3NldEdndWZDYW5jZWwoY2FyZCwgZmFsc2UpO1xuICAgIGlmIChwcm9ncmVzcykgcHJvZ3Jlc3Muc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBpZiAoYnV0dG9uKSB7IGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlOyBidXR0b24udGV4dENvbnRlbnQgPSAnRG93bmxvYWQgbm93JzsgfVxuICB9XG59XG5cbi8vIOKUgOKUgCBtb2RlbCByZWFkaW5lc3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBSZWFkaW5lc3Mgb2YgdGhlICpzYXZlZCogYWN0aXZlIG1vZGVsLiBSZWZsZWN0cyBjb25maWcgb24gZGlzaywgbm90IHVuc2F2ZWRcbi8vIGVkaXRzIC0gcmVmcmVzaGVkIG9uIG9wZW4gYW5kIGFmdGVyIFNhdmUuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX3VwZGF0ZUxsbUNhcGFiaWxpdGllcygpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1sbG0tY2FwYWJpbGl0aWVzJyk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgbGV0IGNhcDtcbiAgdHJ5IHtcbiAgICBjYXAgPSBhd2FpdCBmZXRjaCgnL2FwaS9sbG0vY2FwYWJpbGl0aWVzJykudGhlbihyID0+IHIuanNvbigpKTtcbiAgfSBjYXRjaCB7IGVsLnRleHRDb250ZW50ID0gJ0NvdWxkIG5vdCBjaGVjayBtb2RlbCByZWFkaW5lc3MuJzsgcmV0dXJuOyB9XG4gIGNvbnN0IG1hcmsgPSBvayA9PiBva1xuICAgID8gJzxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPuKckzwvc3Bhbj4gUmVhZHknXG4gICAgOiAnPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+4peLPC9zcGFuPiBOb3Qgc2V0IHVwJztcbiAgZWwuaW5uZXJIVE1MID1cbiAgICBgPHNwYW4gc3R5bGU9XCJtYXJnaW4tcmlnaHQ6MTRweFwiPlRleHQgc2NvcmluZzogJHttYXJrKGNhcC50ZXh0KX08L3NwYW4+YCArXG4gICAgYDxzcGFuPkltYWdlIGFuYWx5c2lzOiAke21hcmsoY2FwLnZpc2lvbil9PC9zcGFuPmAgK1xuICAgIGA8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiIHN0eWxlPVwibWFyZ2luLXRvcDo0cHhcIj4ke2VzY0h0bWwoY2FwLmRldGFpbCB8fCAnJyl9PC9kaXY+YDtcbiAgZWwuc3R5bGUuY29sb3IgPSBjYXAudGV4dCA/ICd2YXIoLS1ncmVlbiknIDogJ3ZhcigtLW11dGVkKSc7XG59XG5cbi8vIOKUgOKUgCBjYXBhYmlsaXRpZXMgb3ZlcnZpZXcgKFN0YWdlIDA2KSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEEgcmVhZC1vbmx5LCBhdC1hLWdsYW5jZSBtYXAgb2YgdGhlIG5vbi1MTE0gdXBncmFkZSB0aWVycy4gU291cmNlcyBlYWNoIHRpZXInc1xuLy8gYWN0aXZlIHN0YXRlICsgaW5zdGFsbCBndWlkYW5jZSBmcm9tIHRoZSBiYWNrZW5kJ3MgYXZhaWxhYmlsaXR5KCkgcmVhc29ucyB2aWFcbi8vIC9hcGkvY2FwYWJpbGl0aWVzL3RpZXJzIC0gaXQgbmV2ZXIgaW5zdGFsbHMgYW55dGhpbmcgaXRzZWxmOyBlYWNoIHJvdyBsaW5rcyB0b1xuLy8gdGhlIHNlY3Rpb24gd2hlcmUgdGhlIHJlYWwgaW5zdGFsbC9lbmFibGUgY29udHJvbCBsaXZlcy5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBfcmVuZGVyQ2FwYWJpbGl0eVRpZXJzKCkge1xuICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtY2FwYWJpbGl0aWVzLWxpc3QnKTtcbiAgY29uc3QgaW50cm8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1jYXBhYmlsaXRpZXMtaW50cm8nKTtcbiAgaWYgKCFsaXN0KSByZXR1cm47XG4gIGxldCBkYXRhO1xuICB0cnkge1xuICAgIGRhdGEgPSBhd2FpdCBmZXRjaCgnL2FwaS9jYXBhYmlsaXRpZXMvdGllcnMnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICB9IGNhdGNoIHtcbiAgICBpZiAoaW50cm8pIGludHJvLnRleHRDb250ZW50ID0gJyc7XG4gICAgbGlzdC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj5Db3VsZCBub3QgY2hlY2sgY2FwYWJpbGl0aWVzLjwvZGl2Pic7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChpbnRybykge1xuICAgIGludHJvLnRleHRDb250ZW50ID0gZGF0YS5saWdodHdlaWdodFxuICAgICAgPyBcIk5vIGxvY2FsIG1vZGVsIGlzIHNldCB1cCB5ZXQgLSB0cmFuc2NyaXB0aW9uIGFuZCB0aGUgY29yZSBzY29yaW5nIGFyZSB3b3JraW5nLCBhbmQgY2xpcHMgZ2V0IGEgc2hvcnQgdGVtcGxhdGUgZGVzY3JpcHRpb24uIFNldHRpbmcgdXAgYSBsb2NhbCBtb2RlbCBpcyB0aGUgbm9ybWFsIG5leHQgc3RlcDogaXQgYWRkcyB3cml0dGVuIGRlc2NyaXB0aW9ucywgc2Vzc2lvbiBzdW1tYXJpZXMsIGFuZCBhIHNtYXJ0ZXIgcmVhZCBvbiBzY29yaW5nLlwiXG4gICAgICA6IFwiSGVyZSdzIHdoYXQgZWFjaCBwYXJ0IG9mIFl1dUNsaXAgaXMgdXNpbmcgcmlnaHQgbm93LCBhbmQgd2hhdCB5b3UgY2FuIHVwZ3JhZGUuXCI7XG4gIH1cbiAgbGlzdC5pbm5lckhUTUwgPSAoZGF0YS50aWVycyB8fCBbXSkubWFwKF9jYXBhYmlsaXR5VGllckh0bWwpLmpvaW4oJycpO1xuICBsaXN0LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXNlY3Rpb25dJykuZm9yRWFjaChidG4gPT4ge1xuICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHdpbmRvdy5fc2Nyb2xsVG9TZXR0aW5nc1NlY3Rpb24oYnRuLmdldEF0dHJpYnV0ZSgnZGF0YS1zZWN0aW9uJykpKTtcbiAgfSk7XG4gIGxpc3QucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtcHJlZmV0Y2hdJykuZm9yRWFjaChidG4gPT4ge1xuICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHByZWZldGNoTW9kZWwoYnRuLmdldEF0dHJpYnV0ZSgnZGF0YS1wcmVmZXRjaCcpLCBidG4uZ2V0QXR0cmlidXRlKCdkYXRhLXRpZXItaWQnKSkpO1xuICB9KTtcbn1cblxuLy8gRm91ciB2aXN1YWwgc3RhdGVzLCBub3QgdHdvOiBhIHRpZXIgY2FuIGJlIGZ1bGx5IFJlYWR5IChncmVlbiBjaGVjayksIHdhaXRpbmdcbi8vIG9uIGEgVGllci1CIG1vZGVsIGl0IGNhbiBmZXRjaCByaWdodCBub3cgKHByZWZldGNoX3NsdWcgc2V0IC0gXCJEb3dubG9hZCBub3dcIiksXG4vLyB3YWl0aW5nIG9uIGEgVGllci1CIG1vZGVsIHRvbyBzbWFsbCB0byBib3RoZXIgd2l0aCBhIHByb2dyZXNzIFVJIChuZXV0cmFsLCBub1xuLy8gQ1RBKSwgb3IgZ2VudWluZWx5IG5lZWQgYSByZWFsIHNldHVwIHN0ZXAgKGluc3RhbGxfc2x1ZyBzZXQgLSBlLmcuIFB5YW5ub3RlXG4vLyBuZWVkcyBhIHBpcCBpbnN0YWxsICsgSHVnZ2luZ0ZhY2UgdG9rZW4sIHNob3duIGFzIFwiU2V0IHVwIOKGklwiKS5cbmZ1bmN0aW9uIF9jYXBhYmlsaXR5VGllckh0bWwodGllcikge1xuICBjb25zdCBuZWVkc1NldHVwID0gIXRpZXIucmVhZHkgJiYgISF0aWVyLmluc3RhbGxfc2x1ZztcbiAgY29uc3QgbmVlZHNQcmVmZXRjaCA9ICF0aWVyLnJlYWR5ICYmICFuZWVkc1NldHVwICYmICEhdGllci5wcmVmZXRjaF9zbHVnO1xuICBjb25zdCBtYXJrID0gdGllci5yZWFkeSA/ICfinJMnIDogKG5lZWRzU2V0dXAgfHwgbmVlZHNQcmVmZXRjaCA/ICfil4snIDogJyYjODk0MzsnKTtcbiAgY29uc3QgbWFya0NsYXNzID0gdGllci5yZWFkeSA/ICcgcmVhZHknIDogJyc7XG4gIGxldCBhY3Rpb24gPSAnJztcbiAgaWYgKG5lZWRzU2V0dXApIHtcbiAgICBhY3Rpb24gPSBgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJzZXR0aW5ncy1qdW1wLWxpbmtcIiBkYXRhLXNlY3Rpb249XCIke2VzY0h0bWwodGllci5zZWN0aW9uKX1cIiBzdHlsZT1cIm1hcmdpbi10b3A6MnB4XCI+U2V0IHVwICZyYXJyOzwvYnV0dG9uPmA7XG4gIH0gZWxzZSBpZiAobmVlZHNQcmVmZXRjaCkge1xuICAgIGFjdGlvbiA9XG4gICAgICBgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidG4tc2Vjb25kYXJ5XCIgZGF0YS1wcmVmZXRjaD1cIiR7ZXNjSHRtbCh0aWVyLnByZWZldGNoX3NsdWcpfVwiIGRhdGEtdGllci1pZD1cIiR7ZXNjSHRtbCh0aWVyLmlkKX1cIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+RG93bmxvYWQgbm93PC9idXR0b24+YCArXG4gICAgICBgPGRpdiBpZD1cImNhcC1wcmVmZXRjaC1sb2ctJHtlc2NIdG1sKHRpZXIuaWQpfVwiIGNsYXNzPVwic2V0dGluZ3MtaW5zdGFsbC1sb2dcIj48L2Rpdj5gO1xuICB9XG4gIHJldHVybiAoXG4gICAgYDxkaXYgY2xhc3M9XCJjYXBhYmlsaXR5LXRpZXJcIj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwiY2FwYWJpbGl0eS10aWVyLWhlYWRcIj5gICtcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiY2FwYWJpbGl0eS1tYXJrJHttYXJrQ2xhc3N9XCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+JHttYXJrfTwvc3Bhbj5gICtcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiY2FwYWJpbGl0eS10aWVyLW5hbWVcIj4ke2VzY0h0bWwodGllci5uYW1lKX08L3NwYW4+YCArXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImNhcGFiaWxpdHktdGllci1hY3RpdmVcIj4ke2VzY0h0bWwodGllci5hY3RpdmUpfTwvc3Bhbj5gICtcbiAgICAgIGA8L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiPiR7ZXNjSHRtbCh0aWVyLnB1cnBvc2UpfTwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+JHtlc2NIdG1sKHRpZXIudXBncmFkZSl9PC9kaXY+YCArXG4gICAgICAodGllci5kZXRhaWwgPyBgPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj4ke2VzY0h0bWwodGllci5kZXRhaWwpfTwvZGl2PmAgOiAnJykgK1xuICAgICAgYWN0aW9uICtcbiAgICBgPC9kaXY+YFxuICApO1xufVxuXG4vLyDilIDilIAgVGllci1CIG1vZGVsIHByZWZldGNoIChcIkRvd25sb2FkIG5vd1wiKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIE9uZSBmbG93IGZvciBldmVyeSBub24tTExNIFRpZXItQiBtb2RlbCAoc3BlYWtlci9hdWRpby1ldmVudC9lbWJlZGRpbmdzKSAtXG4vLyB0aGUgc2FtZSBTU0UgKyBDYW5jZWwgKyBsb2cgcGF0dGVybiBhcyB0aGUgLmdndWYgZG93bmxvYWQgYWJvdmUuIFRoZSBsb2NhbFxuLy8gLmdndWYgTExNIG1vZGVsIGtlZXBzIGl0cyBvd24gc2VwYXJhdGUgZG93bmxvYWQgZmxvdy5cbmNvbnN0IF9QUkVGRVRDSF9MQUJFTFMgPSB7XG4gIHNwZWFrZXI6ICd0aGUgc3BlYWtlciBtb2RlbCAofjgwIE1CKScsXG4gIGF1ZGlvX2V2ZW50OiAndGhlIGF1ZGlvLWV2ZW50IG1vZGVsICh+MzUwIE1CKScsXG4gIGVtYmVkZGluZ3M6ICd0aGUgZW1iZWRkaW5ncyBtb2RlbCAofjEzMCBNQiknLFxufTtcblxubGV0IF9wcmVmZXRjaEFib3J0ID0gbnVsbDtcblxuZnVuY3Rpb24gX3NldFByZWZldGNoQ2FuY2VsKHRpZXJJZCwgc2hvdywgb25DYW5jZWwpIHtcbiAgY29uc3QgbG9nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGNhcC1wcmVmZXRjaC1sb2ctJHt0aWVySWR9YCk7XG4gIGlmICghbG9nKSByZXR1cm47XG4gIGxldCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgY2FwLXByZWZldGNoLWNhbmNlbC0ke3RpZXJJZH1gKTtcbiAgaWYgKHNob3cpIHtcbiAgICBpZiAoIWJ0bikge1xuICAgICAgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICBidG4uaWQgPSBgY2FwLXByZWZldGNoLWNhbmNlbC0ke3RpZXJJZH1gO1xuICAgICAgYnRuLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGJ0bi5jbGFzc05hbWUgPSAnYnRuLXNlY29uZGFyeSc7XG4gICAgICBidG4udGV4dENvbnRlbnQgPSAnQ2FuY2VsIGRvd25sb2FkJztcbiAgICAgIGJ0bi5zdHlsZS5tYXJnaW5Ub3AgPSAnNHB4JztcbiAgICAgIGxvZy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShidG4sIGxvZyk7XG4gICAgfVxuICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGJ0bi5vbmNsaWNrID0gb25DYW5jZWw7XG4gICAgYnRuLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgfSBlbHNlIGlmIChidG4pIHtcbiAgICBidG4uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBwcmVmZXRjaE1vZGVsKHNsdWcsIHRpZXJJZCkge1xuICBjb25zdCBsb2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgY2FwLXByZWZldGNoLWxvZy0ke3RpZXJJZH1gKTtcbiAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgW2RhdGEtcHJlZmV0Y2g9XCIke0NTUy5lc2NhcGUoc2x1Zyl9XCJdYCk7XG4gIGlmICghbG9nKSByZXR1cm47XG4gIGxvZy5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgbG9nLnRleHRDb250ZW50ID0gYERvd25sb2FkaW5nICR7X1BSRUZFVENIX0xBQkVMU1tzbHVnXSB8fCBzbHVnfeKAplxcbmA7XG4gIGlmIChidXR0b24pIHsgYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTsgYnV0dG9uLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkaW5n4oCmJzsgfVxuICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBfcHJlZmV0Y2hBYm9ydCA9IGNvbnRyb2xsZXI7XG4gIF9zZXRQcmVmZXRjaENhbmNlbCh0aWVySWQsIHRydWUsICgpID0+IHsgY29udHJvbGxlci5hYm9ydCgpOyB9KTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goYC9hcGkvbW9kZWxzL3ByZWZldGNoP3NsdWc9JHtlbmNvZGVVUklDb21wb25lbnQoc2x1Zyl9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBtZXRob2Q6ICdQT1NUJywgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgIGxldCBkZXRhaWwgPSAnJztcbiAgICAgIHRyeSB7IGRldGFpbCA9IChhd2FpdCByZXNwLmpzb24oKSkuZGV0YWlsIHx8ICcnOyB9IGNhdGNoIHsgZGV0YWlsID0gYXdhaXQgcmVzcC50ZXh0KCk7IH1cbiAgICAgIGxvZy50ZXh0Q29udGVudCArPSBg4pyXICR7ZGV0YWlsIHx8ICdEb3dubG9hZCBjb3VsZCBub3Qgc3RhcnQuJ31cXG5gO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZWFkZXIgPSByZXNwLmJvZHkuZ2V0UmVhZGVyKCk7XG4gICAgY29uc3QgZGVjID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgbGV0IGJ1ZiA9ICcnO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCB7IGRvbmUsIHZhbHVlIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgaWYgKGRvbmUpIGJyZWFrO1xuICAgICAgYnVmICs9IGRlYy5kZWNvZGUodmFsdWUsIHsgc3RyZWFtOiB0cnVlIH0pO1xuICAgICAgY29uc3QgbGluZXMgPSBidWYuc3BsaXQoJ1xcbicpO1xuICAgICAgYnVmID0gbGluZXMucG9wKCk7XG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJ2RhdGE6ICcpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbXNnID0gSlNPTi5wYXJzZShsaW5lLnNsaWNlKDYpKTtcbiAgICAgICAgaWYgKG1zZyA9PT0gJ19fRE9ORV9fJykge1xuICAgICAgICAgIGxvZy50ZXh0Q29udGVudCArPSAn4pyTIFJlYWR5Llxcbic7XG4gICAgICAgICAgX3JlbmRlckNhcGFiaWxpdHlUaWVycygpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsb2cudGV4dENvbnRlbnQgKz0gbXNnICsgJ1xcbic7XG4gICAgICAgIGxvZy5zY3JvbGxUb3AgPSBsb2cuc2Nyb2xsSGVpZ2h0O1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciAmJiBlcnIubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSBsb2cudGV4dENvbnRlbnQgKz0gJ+KWoCBEb3dubG9hZCBjYW5jZWxsZWQuXFxuJztcbiAgICBlbHNlIGxvZy50ZXh0Q29udGVudCArPSAn4pyXIERvd25sb2FkIGZhaWxlZCAtIGNoZWNrIHlvdXIgY29ubmVjdGlvbiBhbmQgdHJ5IGFnYWluLlxcbic7XG4gIH0gZmluYWxseSB7XG4gICAgX3ByZWZldGNoQWJvcnQgPSBudWxsO1xuICAgIF9zZXRQcmVmZXRjaENhbmNlbCh0aWVySWQsIGZhbHNlKTtcbiAgICBpZiAoYnV0dG9uKSB7IGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlOyBidXR0b24udGV4dENvbnRlbnQgPSAnRG93bmxvYWQgbm93JzsgfVxuICB9XG59XG5cbi8vIEdhdGUgYSBjb250cm9sIG9uIGEgbW9kZWwgY2FwYWJpbGl0eSAoXCJ0ZXh0XCIgfCBcInZpc2lvblwiKSBmcm9tXG4vLyAvYXBpL2xsbS9jYXBhYmlsaXRpZXMuIERpc2FibGVzIHRoZSBlbGVtZW50IGFuZCBhcHBlbmRzIGEgbGlua2VkIGV4cGxhbmF0aW9uXG4vLyB3aGVuIHRoZSBjYXBhYmlsaXR5IGlzIHVuYXZhaWxhYmxlOyB1c2VkIGJ5IGltYWdlLWFuYWx5c2lzIGNvbnRyb2xzIChwbGFuIDExKS5cbi8vIFJldHVybnMgdGhlIHJlc29sdmVkIGNhcGFiaWxpdGllcyBvYmplY3QuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2F0ZU9uQ2FwYWJpbGl0eShlbCwgY2FwYWJpbGl0eSwgbWVzc2FnZSkge1xuICBsZXQgY2FwO1xuICB0cnkge1xuICAgIGNhcCA9IGF3YWl0IGZldGNoKCcvYXBpL2xsbS9jYXBhYmlsaXRpZXMnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICB9IGNhdGNoIHsgY2FwID0geyB0ZXh0OiBmYWxzZSwgdmlzaW9uOiBmYWxzZSwgZGV0YWlsOiAnJyB9OyB9XG4gIGNvbnN0IG9rID0gISFjYXBbY2FwYWJpbGl0eV07XG4gIGVsLmRpc2FibGVkID0gIW9rO1xuICBsZXQgbm90ZSA9IGVsLnBhcmVudEVsZW1lbnQ/LnF1ZXJ5U2VsZWN0b3IoJy5nYXRlLW5vdGUnKTtcbiAgaWYgKCFvaykge1xuICAgIGlmICghbm90ZSkge1xuICAgICAgbm90ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgbm90ZS5jbGFzc05hbWUgPSAnZ2F0ZS1ub3RlJztcbiAgICAgIGVsLnBhcmVudEVsZW1lbnQ/LmFwcGVuZENoaWxkKG5vdGUpO1xuICAgIH1cbiAgICBub3RlLmlubmVySFRNTCA9IGAke2VzY0h0bWwobWVzc2FnZSl9IDxhIGhyZWY9XCIjXCIgb25jbGljaz1cIm9wZW5TZXR0aW5ncygpO3JldHVybiBmYWxzZVwiPk9wZW4gU2V0dGluZ3M8L2E+YDtcbiAgfSBlbHNlIGlmIChub3RlKSB7XG4gICAgbm90ZS5yZW1vdmUoKTtcbiAgfVxuICByZXR1cm4gY2FwO1xufVxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUmVjb3JkaW5ncyBsaXN0ICsgZGV0YWlsIChjb2RlOiB2aWRlbyAvIFZpZGVvKS5cbi8vICAgQVBJOiByb3V0ZXMvdmlkZW9zLnB5IMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3ZpZGVvLnB5LCB0ZXN0cy9pbnRlZ3JhdGlvbi90ZXN0X3ZpZGVvcy5weVxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7XG4gIGVzY0h0bWwsIHBsdXJhbCwgX2ZtdFZpZGVvU3RhdHVzLCBfbXNUb0htcywgX2ZtdERhdGUsIF9wYXJzZVNlcnZlckRhdGUsIF9mbXRFbGFwc2VkLCBmb3JtYXRBcGlFcnJvcixcbn0gZnJvbSAnLi9mb3JtYXQuanMnO1xuaW1wb3J0IHsgY29sbGFwc2libGVDYXJkLCBzaG93VG9hc3QsIG5ldEVyck1zZywgcmV2ZWFsSW5Gb2xkZXIsIF9zeW5jU29ydERpckJ0biwgb3BlbkxvZywgYXBwZW5kTG9nIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBzaG93Q29uZmlybSwgb3BlbkZpZWxkRWRpdE1vZGFsLCBvcGVuRGlmZk1vZGFsLCBzaG93S2ViYWIsIG9wZW5BY3Rpb25zTW9kYWwgfSBmcm9tICcuL3VpLmpzJztcbmltcG9ydCB7IHNldHVwUmVjb3JkaW5nUHJldmlldyB9IGZyb20gJy4vcHJldmlldy5qcyc7XG5pbXBvcnQgeyBzdHJlYW1TU0UsIGNhbmNlbEpvYiwgX2Jsb2NrZWRCeUFuYWx5emUsIF9zdGVwUGlsbExhYmVsIH0gZnJvbSAnLi9qb2JzLmpzJztcbmltcG9ydCB7IG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsIH0gZnJvbSAnLi9oZWxwbW9kYWxzLmpzJztcbi8vIOKUgOKUgCB2aWRlb3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5hc3luYyBmdW5jdGlvbiBsb2FkVmlkZW9zKCkge1xuICBsZXQgdmlkZW9zO1xuICB0cnkge1xuICAgIGNvbnN0IFt2aWRlb3NSZXMsIHNlc3Npb25zXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGZldGNoKCcvYXBpL3ZpZGVvcycpLFxuICAgICAgZmV0Y2goJy9hcGkvc2Vzc2lvbnMnKS50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogW10pLmNhdGNoKCgpID0+IFtdKSxcbiAgICBdKTtcbiAgICBpZiAoIXZpZGVvc1Jlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3IgJHt2aWRlb3NSZXMuc3RhdHVzfWApO1xuICAgIHZpZGVvcyA9IGF3YWl0IHZpZGVvc1Jlcy5qc29uKCk7XG4gICAgQXBwU3RhdGUuc2Vzc2lvbnMgPSBzZXNzaW9ucztcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZGVvLWxpc3QnKS5pbm5lckhUTUwgPVxuICAgICAgYDxsaSBzdHlsZT1cInBhZGRpbmc6MTBweCAxNHB4O2NvbG9yOnZhcigtLXJlZClcIj5GYWlsZWQgdG8gbG9hZCByZWNvcmRpbmdzOiAke2VzY0h0bWwoU3RyaW5nKGVyci5tZXNzYWdlIHx8IGVycikpfTwvbGk+YDtcbiAgICByZXR1cm47XG4gIH1cbiAgQXBwU3RhdGUudmlkZW9zID0gdmlkZW9zO1xuXG4gIC8vIFdoaWxlIGEgYnJhbmQtbmV3IHJlY29yZGluZyBpcyBhbmFseXppbmcsIHNob3cgaXQgaW4gdGhlIHNpZGViYXIgcmlnaHQgYXdheSAtXG4gIC8vIGJlZm9yZSBpdHMgREIgcm93IGV4aXN0cyAtIHNvIHRoZSB1c2VyIGdldHMgaW1tZWRpYXRlIGZlZWRiYWNrLiBTdXBwcmVzc2VkXG4gIC8vIG9uY2UgdGhlIHJlYWwgcm93IGFwcGVhcnMgKG1hdGNoZWQgYnkgZmlsZW5hbWUpLlxuICBjb25zdCBhbmFseXppbmdOYW1lID0gQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lO1xuICBjb25zdCBzaG93UGxhY2Vob2xkZXIgPSBhbmFseXppbmdOYW1lICYmICF2aWRlb3Muc29tZSh2ID0+IHYuZmlsZW5hbWUgPT09IGFuYWx5emluZ05hbWUpO1xuXG4gIGlmICghdmlkZW9zLmxlbmd0aCAmJiAhc2hvd1BsYWNlaG9sZGVyKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZGVvLWxpc3QnKS5pbm5lckhUTUwgPVxuICAgICAgJzxsaSBzdHlsZT1cInBhZGRpbmc6MTBweCAxNHB4O2NvbG9yOnZhcigtLW11dGVkKVwiPk5vIHJlY29yZGluZ3MgeWV0PC9saT4nO1xuICAgIF9zaG93RW1wdHlTdGF0ZSgpO1xuICAgIF91cGRhdGVEZW1vQnV0dG9uKDApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbiAgX3VwZGF0ZURlbW9CdXR0b24odmlkZW9zLnJlZHVjZSgobiwgdikgPT4gbiArIHYuYXBwcm92ZWQsIDApKTtcblxuICBpZiAoIUFwcFN0YXRlLmJvb3RSZXN0b3JlRG9uZSkge1xuICAgIEFwcFN0YXRlLmJvb3RSZXN0b3JlRG9uZSA9IHRydWU7XG4gICAgX3Jlc3RvcmVWaWV3KCk7XG4gIH1cbn1cblxuLy8gQ2xpZW50LXNpZGUgc2VhcmNoICsgZmlsdGVyICsgc29ydCBvdmVyIEFwcFN0YXRlLnZpZGVvcyBmb3IgdGhlIHNpZGViYXIgbGlzdC5cbmZ1bmN0aW9uIF9hcHBseVZpZGVvRmlsdGVycyh2aWRlb3MpIHtcbiAgbGV0IHJlc3VsdCA9IHZpZGVvcy5zbGljZSgpO1xuICBjb25zdCBxID0gKEFwcFN0YXRlLnZpZGVvU2VhcmNoIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAocSkgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcih2ID0+XG4gICAgKHYudGl0bGUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHwgKHYuZmlsZW5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpO1xuICBjb25zdCBmID0gQXBwU3RhdGUudmlkZW9GaWx0ZXJzO1xuICBpZiAoZiAmJiBmLnNpemUpIHtcbiAgICBpZiAoZi5oYXMoJ2hhcy1jbGlwcycpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKHYgPT4gdi5jbGlwX2NvdW50ID4gMCk7XG4gICAgaWYgKGYuaGFzKCd1bnNjb3JlZCcpKSAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcih2ID0+ICF2LmNsaXBzX3Njb3JlZF9hdCk7XG4gICAgaWYgKGYuaGFzKCdlcnJvcnMnKSkgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcih2ID0+ICh2LmNsaXBzX2xsbV9lcnJvciB8fCAwKSA+IDApO1xuICB9XG4gIGNvbnN0IHNvcnQgPSBBcHBTdGF0ZS52aWRlb1NvcnQgfHwgJ3JlY2VudCc7XG4gIGlmIChzb3J0ID09PSAndGl0bGUnKSAgICAgICByZXN1bHQuc29ydCgoYSwgYikgPT4gKGEudGl0bGUgfHwgYS5maWxlbmFtZSB8fCAnJykubG9jYWxlQ29tcGFyZShiLnRpdGxlIHx8IGIuZmlsZW5hbWUgfHwgJycpKTtcbiAgZWxzZSBpZiAoc29ydCA9PT0gJ2ZpbGVuYW1lJykgcmVzdWx0LnNvcnQoKGEsIGIpID0+IChhLmZpbGVuYW1lIHx8ICcnKS5sb2NhbGVDb21wYXJlKGIuZmlsZW5hbWUgfHwgJycsIHVuZGVmaW5lZCwgeyBudW1lcmljOiB0cnVlIH0pKTtcbiAgZWxzZSBpZiAoc29ydCA9PT0gJ2xlbmd0aCcpIHJlc3VsdC5zb3J0KChhLCBiKSA9PiAoYi5kdXJhdGlvbl9tcyB8fCAwKSAtIChhLmR1cmF0aW9uX21zIHx8IDApKTtcbiAgZWxzZSBpZiAoc29ydCA9PT0gJ2NsaXBzJykgIHJlc3VsdC5zb3J0KChhLCBiKSA9PiAoYi5jbGlwX2NvdW50IHx8IDApIC0gKGEuY2xpcF9jb3VudCB8fCAwKSk7XG4gIC8vICdyZWNlbnQnIGtlZXBzIHRoZSBzZXJ2ZXIgb3JkZXIgKGNyZWF0ZWRfYXQgZGVzYykuXG4gIGlmICgoQXBwU3RhdGUudmlkZW9Tb3J0RGlyIHx8ICdkZXNjJykgPT09ICdhc2MnKSByZXN1bHQucmV2ZXJzZSgpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBQZXItZmlsdGVyIGNvdW50cyBzaG93biBpbmxpbmUgb24gdGhlIHJlY29yZGluZyBmaWx0ZXIgY2hpcHMgKFwiVW5zY29yZWQgNFwiKS5cbi8vIENvdW50cyByZWZsZWN0IGV2ZXJ5IGxvYWRlZCByZWNvcmRpbmcsIG5vdCB0aGUgc2VhcmNoLW5hcnJvd2VkIHN1YnNldCwgYW5kIHVzZVxuLy8gdGhlIHNhbWUgcHJlZGljYXRlcyBhcyBfYXBwbHlWaWRlb0ZpbHRlcnMuIEJsYW5rIHdoZW4gdGhlcmUgYXJlIG5vIHJlY29yZGluZ3MuXG5mdW5jdGlvbiBfcmVuZGVyVmlkZW9GaWx0ZXJDb3VudHMoKSB7XG4gIGNvbnN0IHNldENvdW50ID0gKGtleSwgdmFsdWUpID0+IHtcbiAgICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYC5jbGlwLWNoaXAtY291bnRbZGF0YS12Y291bnQ9XCIke2tleX1cIl1gKTtcbiAgICBpZiAoYmFkZ2UpIGJhZGdlLnRleHRDb250ZW50ID0gdmFsdWUgPT0gbnVsbCA/ICcnIDogU3RyaW5nKHZhbHVlKTtcbiAgfTtcbiAgY29uc3QgdmlkZW9zID0gQXBwU3RhdGUudmlkZW9zIHx8IFtdO1xuICBpZiAoIXZpZGVvcy5sZW5ndGgpIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBbJ2FsbCcsICdoYXMtY2xpcHMnLCAndW5zY29yZWQnLCAnZXJyb3JzJ10pIHNldENvdW50KGtleSwgbnVsbCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHNldENvdW50KCdhbGwnLCB2aWRlb3MubGVuZ3RoKTtcbiAgc2V0Q291bnQoJ2hhcy1jbGlwcycsIHZpZGVvcy5maWx0ZXIodiA9PiB2LmNsaXBfY291bnQgPiAwKS5sZW5ndGgpO1xuICBzZXRDb3VudCgndW5zY29yZWQnLCB2aWRlb3MuZmlsdGVyKHYgPT4gIXYuY2xpcHNfc2NvcmVkX2F0KS5sZW5ndGgpO1xuICBzZXRDb3VudCgnZXJyb3JzJywgdmlkZW9zLmZpbHRlcih2ID0+ICh2LmNsaXBzX2xsbV9lcnJvciB8fCAwKSA+IDApLmxlbmd0aCB8fCBudWxsKTtcbn1cblxuLy8gUmVidWlsZHMgdGhlIHNpZGViYXIgdmlkZW8gbGlzdCBmcm9tIEFwcFN0YXRlLnZpZGVvcywgYXBwbHlpbmcgdGhlIGFjdGl2ZVxuLy8gc2VhcmNoL2ZpbHRlci9zb3J0LiBDYWxsZWQgYnkgbG9hZFZpZGVvcyAoYWZ0ZXIgZmV0Y2gpIGFuZCBieSB0aGUgY29udHJvbHMuXG5mdW5jdGlvbiBfcmVuZGVyVmlkZW9MaXN0KCkge1xuICBfcmVuZGVyVmlkZW9GaWx0ZXJDb3VudHMoKTtcbiAgY29uc3QgbGlzdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2aWRlby1saXN0Jyk7XG4gIGxpc3QuaW5uZXJIVE1MID0gJyc7XG4gIGNvbnN0IGFuYWx5emluZ05hbWUgPSBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWU7XG4gIGNvbnN0IHNob3dQbGFjZWhvbGRlciA9IGFuYWx5emluZ05hbWUgJiYgIUFwcFN0YXRlLnZpZGVvcy5zb21lKHYgPT4gdi5maWxlbmFtZSA9PT0gYW5hbHl6aW5nTmFtZSk7XG4gIGlmIChzaG93UGxhY2Vob2xkZXIpIGxpc3QuYXBwZW5kQ2hpbGQoX2FuYWx5emluZ1BsYWNlaG9sZGVyTGkoYW5hbHl6aW5nTmFtZSkpO1xuXG4gIGNvbnN0IHNob3duID0gX2FwcGx5VmlkZW9GaWx0ZXJzKEFwcFN0YXRlLnZpZGVvcyk7XG4gIGlmICghc2hvd24ubGVuZ3RoICYmICFzaG93UGxhY2Vob2xkZXIpIHtcbiAgICBjb25zdCBoYXNGaWx0ZXIgPSBBcHBTdGF0ZS52aWRlb1NlYXJjaCB8fCAoQXBwU3RhdGUudmlkZW9GaWx0ZXJzICYmIEFwcFN0YXRlLnZpZGVvRmlsdGVycy5zaXplKTtcbiAgICBsaXN0LmlubmVySFRNTCA9IGhhc0ZpbHRlclxuICAgICAgPyBgPGxpIHN0eWxlPVwicGFkZGluZzoxMHB4IDE0cHg7Y29sb3I6dmFyKC0tbXV0ZWQpXCI+Tm8gcmVjb3JkaW5ncyBtYXRjaCAtIDxhIGhyZWY9XCIjXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS1hY2NlbnQpO3RleHQtZGVjb3JhdGlvbjp1bmRlcmxpbmVcIiBkYXRhLWFjdD1cImNsZWFyLXZpZGVvLWZpbHRlcnNcIj5DbGVhciBmaWx0ZXJzPC9hPjwvbGk+YFxuICAgICAgOiAnPGxpIHN0eWxlPVwicGFkZGluZzoxMHB4IDE0cHg7Y29sb3I6dmFyKC0tbXV0ZWQpXCI+Tm8gcmVjb3JkaW5ncyB5ZXQ8L2xpPic7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgX3JlbmRlckdyb3VwZWRWaWRlb0l0ZW1zKGxpc3QsIHNob3duLCBhbmFseXppbmdOYW1lKTtcblxuICBjb25zdCBfaGFuZGxlVmlkZW9MaXN0QWN0aXZhdGUgPSBlID0+IHtcbiAgICBjb25zdCBjbGVhckxpbmsgPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1hY3Q9XCJjbGVhci12aWRlby1maWx0ZXJzXCJdJyk7XG4gICAgaWYgKGNsZWFyTGluaykgeyBlLnByZXZlbnREZWZhdWx0KCk7IF9jbGVhclZpZGVvRmlsdGVycygpOyByZXR1cm47IH1cbiAgICBjb25zdCBsaSA9IGUudGFyZ2V0LmNsb3Nlc3QoJ2xpW2RhdGEtdmlkZW8taWRdJyk7XG4gICAgaWYgKCFsaSkgcmV0dXJuO1xuICAgIGNvbnN0IHZpZGVvSWQgPSBwYXJzZUludChsaS5kYXRhc2V0LnZpZGVvSWQpO1xuICAgIGlmICh3aW5kb3cuU2Vzc2lvblVJICYmIHdpbmRvdy5TZXNzaW9uVUkuc2VsZWN0aW9uTW9kZSkgeyB3aW5kb3cudG9nZ2xlR3JvdXBTZWxlY3QodmlkZW9JZCk7IHJldHVybjsgfVxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyN2aWRlby1saXN0IGxpJykuZm9yRWFjaChsID0+IGwuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJykpO1xuICAgIGxpLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xuICAgIHNlbGVjdFZpZGVvKHZpZGVvSWQpO1xuICB9O1xuICBsaXN0Lm9uY2xpY2sgPSBfaGFuZGxlVmlkZW9MaXN0QWN0aXZhdGU7XG4gIGxpc3Qub25rZXlkb3duID0gZSA9PiB7IGlmIChlLmtleSA9PT0gJ0VudGVyJyB8fCBlLmtleSA9PT0gJyAnKSB7IGUucHJldmVudERlZmF1bHQoKTsgX2hhbmRsZVZpZGVvTGlzdEFjdGl2YXRlKGUpOyB9IH07XG59XG5cbi8vIFJlbmRlcnMgdGhlIHNpZGViYXIgbGlzdCBncm91cGVkIGJ5IHNlc3Npb246IGEgc2Vzc2lvbidzIHNob3duIG1lbWJlcnMgYXBwZWFyXG4vLyB0b2dldGhlciB1bmRlciBhIGNvbGxhcHNpYmxlIGhlYWRlciwgYW5jaG9yZWQgYXQgdGhlIHNvcnQgcG9zaXRpb24gb2YgdGhlaXJcbi8vIGZpcnN0LWFwcGVhcmluZyBtZW1iZXI7IHVuZ3JvdXBlZCByZWNvcmRpbmdzIHJlbmRlciBpbmxpbmUuXG5mdW5jdGlvbiBfcmVuZGVyR3JvdXBlZFZpZGVvSXRlbXMobGlzdCwgc2hvd24sIGFuYWx5emluZ05hbWUpIHtcbiAgY29uc3Qgc2Vzc2lvbkJ5SWQgPSBuZXcgTWFwKChBcHBTdGF0ZS5zZXNzaW9ucyB8fCBbXSkubWFwKHMgPT4gW3MuaWQsIHNdKSk7XG4gIGNvbnN0IHJlbmRlcmVkU2Vzc2lvbnMgPSBuZXcgU2V0KCk7XG4gIGZvciAoY29uc3QgdiBvZiBzaG93bikge1xuICAgIGNvbnN0IHNlc3Npb24gPSB2LnNlc3Npb25faWQgIT0gbnVsbCA/IHNlc3Npb25CeUlkLmdldCh2LnNlc3Npb25faWQpIDogbnVsbDtcbiAgICBpZiAoc2Vzc2lvbiAmJiAhcmVuZGVyZWRTZXNzaW9ucy5oYXMoc2Vzc2lvbi5pZCkpIHtcbiAgICAgIHJlbmRlcmVkU2Vzc2lvbnMuYWRkKHNlc3Npb24uaWQpO1xuICAgICAgY29uc3QgbWVtYmVycyA9IHNob3duLmZpbHRlcih4ID0+IHguc2Vzc2lvbl9pZCA9PT0gc2Vzc2lvbi5pZCk7XG4gICAgICBsaXN0LmFwcGVuZENoaWxkKHdpbmRvdy5zZXNzaW9uR3JvdXBIZWFkZXJMaShzZXNzaW9uLCBtZW1iZXJzLmxlbmd0aCkpO1xuICAgICAgaWYgKCF3aW5kb3cuaXNTZXNzaW9uQ29sbGFwc2VkKHNlc3Npb24uaWQpKSB7XG4gICAgICAgIGZvciAoY29uc3QgbSBvZiBtZW1iZXJzKSBsaXN0LmFwcGVuZENoaWxkKF92aWRlb0l0ZW1MaShtLCBhbmFseXppbmdOYW1lLCB0cnVlKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghc2Vzc2lvbikge1xuICAgICAgbGlzdC5hcHBlbmRDaGlsZChfdmlkZW9JdGVtTGkodiwgYW5hbHl6aW5nTmFtZSwgZmFsc2UpKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gQnVpbGRzIG9uZSByZWNvcmRpbmcgPGxpPi4gaW5TZXNzaW9uIGluZGVudHMgaXQgdW5kZXIgaXRzIHNlc3Npb24gaGVhZGVyO1xuLy8gZ3JvdXBpbmcgc2VsZWN0aW9uIG1vZGUgYWRkcyBhIGNoZWNrYm94IGFuZCBzdXBwcmVzc2VzIG5vcm1hbCBuYXZpZ2F0aW9uLlxuZnVuY3Rpb24gX3ZpZGVvSXRlbUxpKHYsIGFuYWx5emluZ05hbWUsIGluU2Vzc2lvbikge1xuICBjb25zdCBpc0FuYWx5emluZyA9IHYuZmlsZW5hbWUgPT09IGFuYWx5emluZ05hbWUgJiYgdi5zdGF0dXMgIT09ICdkb25lJztcbiAgY29uc3Qgc2VsZWN0aW5nID0gISEod2luZG93LlNlc3Npb25VSSAmJiB3aW5kb3cuU2Vzc2lvblVJLnNlbGVjdGlvbk1vZGUpO1xuICBjb25zdCBzZWxlY3RhYmxlID0gc2VsZWN0aW5nICYmIHYucGFyZW50X3ZpZGVvX2lkID09IG51bGw7XG4gIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgbGkuY2xhc3NOYW1lID0gJ3ZpZGVvLWl0ZW0nXG4gICAgKyAodi5pZCA9PT0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA/ICcgYWN0aXZlJyA6ICcnKVxuICAgICsgKGlzQW5hbHl6aW5nID8gJyBhbmFseXppbmcnIDogJycpXG4gICAgKyAoaW5TZXNzaW9uID8gJyBpbi1zZXNzaW9uJyA6ICcnKVxuICAgICsgKHNlbGVjdGFibGUgJiYgd2luZG93LlNlc3Npb25VSS5zZWxlY3RlZC5oYXModi5pZCkgPyAnIHNlbGVjdGVkJyA6ICcnKTtcbiAgbGkuZGF0YXNldC52aWRlb0lkID0gdi5pZDtcbiAgbGkudGFiSW5kZXggPSAwO1xuICBjb25zdCBjbGlwc1BjdCA9IHYuZHVyYXRpb25fbXMgPiAwXG4gICAgPyBgICgke01hdGgucm91bmQodi50b3RhbF9jbGlwX21zIC8gdi5kdXJhdGlvbl9tcyAqIDEwMCl9JSlgXG4gICAgOiAnJztcbiAgY29uc3Qgc2NvcmVCYXIgPSAodi5zY29yZV9taW4gIT09IG51bGwgJiYgdi5zY29yZV9tYXggIT09IG51bGwgJiYgdi5jbGlwX2NvdW50ID4gMClcbiAgICA/IGA8ZGl2IGNsYXNzPVwibWV0YVwiPlNjb3JlczogJHtNYXRoLnJvdW5kKHYuc2NvcmVfbWluICogMTAwKX0lIOKAkyAke01hdGgucm91bmQodi5zY29yZV9tYXggKiAxMDApfSU8L2Rpdj5gXG4gICAgOiAnJztcbiAgY29uc3Qgc2VnbWVudE1ldGEgPSAodi5zZWdtZW50X3N0YXJ0X3MgIT0gbnVsbCAmJiB2LnNlZ21lbnRfZW5kX3MgIT0gbnVsbClcbiAgICA/IGA8ZGl2IGNsYXNzPVwibWV0YVwiIHN0eWxlPVwiY29sb3I6dmFyKC0tYWNjZW50MilcIiB0aXRsZT1cIldoZXJlIHRoaXMgcGFydCBzaXRzIGluc2lkZSB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nXCI+ZnJvbSAke19tc1RvSG1zKHYuc2VnbWVudF9zdGFydF9zICogMTAwMCl9IHRvICR7X21zVG9IbXModi5zZWdtZW50X2VuZF9zICogMTAwMCl9PC9kaXY+YFxuICAgIDogJyc7XG4gIGNvbnN0IGVyckNvdW50ID0gdi5jbGlwc19sbG1fZXJyb3IgfHwgMDtcbiAgLy8gQSBtaXNzaW5nIG1vZGVsIGlzIGEgc2V0dXAgc3RhdGUsIG5vdCBhIGZhaWx1cmU6IHdoZW4gbm8gbGFuZ3VhZ2UgbW9kZWwgaXNcbiAgLy8gdXNhYmxlIHJpZ2h0IG5vdywgdGhlc2UgY2xpcHMgd2VyZSBzaW1wbHkgc2NvcmVkIGJlZm9yZSBvbmUgd2FzIHNldCB1cCwgc29cbiAgLy8gc2hvdyBhIGNhbG0gbm90ZSByYXRoZXIgdGhhbiBhbiBhbGFybWluZyByZWQgXCJOIHNjb3JpbmcgZXJyb3JzXCIgYmFkZ2UuXG4gIGNvbnN0IGxsbVVzYWJsZSA9ICEhKHdpbmRvdy5fcHJlcmVxcyB8fCB7fSkubGxtX29rO1xuICBjb25zdCBlcnJCYWRnZSA9IGVyckNvdW50ID09PSAwID8gJydcbiAgICA6IGxsbVVzYWJsZVxuICAgID8gYDxkaXYgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjJweDtjb2xvcjp2YXIoLS13YXJuaW5nKVwiIHRpdGxlPVwiTExNIHNjb3JpbmcgZmFpbGVkIGZvciAke3BsdXJhbChlcnJDb3VudCwgJ2NsaXAnKX0gLSByZS1zY29yZSB0byByZXRyeVwiPiYjOTg4ODsgJHtwbHVyYWwoZXJyQ291bnQsICdzY29yaW5nIGVycm9yJyl9PC9kaXY+YFxuICAgIDogYDxkaXYgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjJweDtjb2xvcjp2YXIoLS1tdXRlZClcIiB0aXRsZT1cIlRoZXNlIGNsaXBzIHdlcmUgc2NvcmVkIGJlZm9yZSBhIGxhbmd1YWdlIG1vZGVsIHdhcyBzZXQgdXAgLSBzZXQgb25lIHVwLCB0aGVuIHJlLXNjb3JlIGZvciBBSSBzY29yaW5nIGFuZCBkZXNjcmlwdGlvbnNcIj5TY29yZWQgd2l0aG91dCBhIGxhbmd1YWdlIG1vZGVsPC9kaXY+YDtcbiAgY29uc3QgY2hlY2tib3ggPSBzZWxlY3RhYmxlXG4gICAgPyBgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwic2Vzc2lvbi1zZWxlY3QtYm94XCIgYXJpYS1sYWJlbD1cIlNlbGVjdCBmb3IgZ3JvdXBpbmdcIiAke3dpbmRvdy5TZXNzaW9uVUkuc2VsZWN0ZWQuaGFzKHYuaWQpID8gJ2NoZWNrZWQnIDogJyd9PmBcbiAgICA6ICcnO1xuICBsaS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBjbGFzcz1cInZpZGVvLWl0ZW0tYm9keVwiPlxuICAgICAgJHtjaGVja2JveH1cbiAgICAgIDxkaXYgc3R5bGU9XCJmbGV4OjE7bWluLXdpZHRoOjBcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm5hbWVcIiB0aXRsZT1cIiR7di50aXRsZSA/IGVzY0h0bWwodi5maWxlbmFtZSkgOiAnJ31cIj4ke2VzY0h0bWwodi50aXRsZSB8fCB2LmZpbGVuYW1lKX08L2Rpdj5cbiAgICAgICAgJHt2LnRpdGxlID8gYDxkaXYgY2xhc3M9XCJ2aWRlby10aXRsZVwiPiR7ZXNjSHRtbCh2LmZpbGVuYW1lKX08L2Rpdj5gIDogJyd9XG4gICAgICAgICR7c2VnbWVudE1ldGF9XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhXCI+JHt2LmR1cmF0aW9uX2htc30gJm1pZGRvdDsgJHt2LmNsaXBfY291bnR9IGNsaXBzICZtaWRkb3Q7ICR7X21zVG9IbXModi50b3RhbF9jbGlwX21zKX0gY2xpcHBlZCR7Y2xpcHNQY3R9PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhXCI+JHtpc0FuYWx5emluZ1xuICAgICAgICAgID8gYDxzcGFuIGNsYXNzPVwic3Bpbm5lclwiIHN0eWxlPVwiZGlzcGxheTppbmxpbmUtYmxvY2s7dmVydGljYWwtYWxpZ246bWlkZGxlXCI+PC9zcGFuPiA8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLWFjY2VudClcIj4ke2VzY0h0bWwoX2ZtdFZpZGVvU3RhdHVzKHYuc3RhdHVzKSl94oCmPC9zcGFuPmBcbiAgICAgICAgICA6IGAke3YuYXBwcm92ZWR9IGFwcHJvdmVkICZtaWRkb3Q7ICR7di5leHBvcnRlZH0gZXhwb3J0ZWQgJm1pZGRvdDsgJHtfZm10VmlkZW9TdGF0dXModi5zdGF0dXMpfWB9PC9kaXY+XG4gICAgICAgICR7ZXJyQmFkZ2V9XG4gICAgICAgICR7c2NvcmVCYXJ9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xuICByZXR1cm4gbGk7XG59XG5cbi8vIOKUgOKUgCB2aWRlbyBzZWFyY2ggLyBmaWx0ZXIgLyBzb3J0IGNvbnRyb2xzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gc2V0VmlkZW9TZWFyY2gocSkgeyBBcHBTdGF0ZS52aWRlb1NlYXJjaCA9IHEudHJpbSgpOyBfcmVuZGVyVmlkZW9MaXN0KCk7IH1cbmZ1bmN0aW9uIHNldFZpZGVvU29ydChzb3J0KSB7XG4gIEFwcFN0YXRlLnZpZGVvU29ydCA9IHNvcnQ7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd2aWRlb3Mtc29ydCcsIHNvcnQpO1xuICBfcmVuZGVyVmlkZW9MaXN0KCk7XG59XG5mdW5jdGlvbiB0b2dnbGVWaWRlb1NvcnREaXIoKSB7XG4gIEFwcFN0YXRlLnZpZGVvU29ydERpciA9IChBcHBTdGF0ZS52aWRlb1NvcnREaXIgPT09ICdhc2MnKSA/ICdkZXNjJyA6ICdhc2MnO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndmlkZW9zLXNvcnQtZGlyJywgQXBwU3RhdGUudmlkZW9Tb3J0RGlyKTtcbiAgX3N5bmNTb3J0RGlyQnRuKCd2aWRlb3Mtc29ydC1kaXInLCBBcHBTdGF0ZS52aWRlb1NvcnREaXIpO1xuICBfcmVuZGVyVmlkZW9MaXN0KCk7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZVZpZGVvRmlsdGVyKHRva2VuKSB7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS52aWRlb0ZpbHRlcnM7XG4gIGlmICh0b2tlbiA9PT0gJ2FsbCcpIGYuY2xlYXIoKTtcbiAgZWxzZSBpZiAoZi5oYXModG9rZW4pKSBmLmRlbGV0ZSh0b2tlbik7XG4gIGVsc2UgZi5hZGQodG9rZW4pO1xuICBfc3luY1ZpZGVvRmlsdGVyQ2hpcHMoKTtcbiAgX3JlbmRlclZpZGVvTGlzdCgpO1xufVxuXG5mdW5jdGlvbiBfc3luY1ZpZGVvRmlsdGVyQ2hpcHMoKSB7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS52aWRlb0ZpbHRlcnM7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXZmaWx0ZXJdJykuZm9yRWFjaChjaGlwID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IGNoaXAuZGF0YXNldC52ZmlsdGVyO1xuICAgIGNvbnN0IGFjdGl2ZSA9IHRva2VuID09PSAnYWxsJyA/IGYuc2l6ZSA9PT0gMCA6IGYuaGFzKHRva2VuKTtcbiAgICBjaGlwLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIGFjdGl2ZSk7XG4gICAgY2hpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFjdGl2ZSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuICB9KTtcbiAgX3N5bmNWaWRlb01vcmVGaWx0ZXJzKCk7XG59XG5cbi8vIFJlY29yZGluZyBmaWx0ZXJzIHRoYXQgbGl2ZSBpbnNpZGUgdGhlIFwiTW9yZSBmaWx0ZXJzXCIgZXhwYW5kZXIuIE1pcnJvcnNcbi8vIGNsaXBzLmpzIF9ISURERU5fRklMVEVSX1RPS0VOUyAvIF9zeW5jTW9yZUZpbHRlcnM6IGZvcmNlIHRoZSBleHBhbmRlciBvcGVuXG4vLyB3aGVuZXZlciBvbmUgb2YgdGhlIGZpbHRlcnMgaXQgaGlkZXMgaXMgYWN0aXZlIChhbmQgc2hvdyB0aGUgXCJmaWx0ZXJlZFwiIGRvdCksXG4vLyBzbyB0aGUgbGlzdCBpcyBuZXZlciBteXN0ZXJpb3VzbHkgZmlsdGVyZWQuIE9ubHkgZXZlciBmb3JjZWQgT1BFTiAtIG9uIHJldHVyblxuLy8gdG8gQWxsIC8gSGFzIGNsaXBzIHRoZSB1c2VyIGNhbiBjb2xsYXBzZSBpdCBhZ2Fpbi5cbmNvbnN0IF9ISURERU5fVkZJTFRFUl9UT0tFTlMgPSBbJ3Vuc2NvcmVkJywgJ2Vycm9ycyddO1xuZnVuY3Rpb24gX3N5bmNWaWRlb01vcmVGaWx0ZXJzKCkge1xuICBjb25zdCBkZXRhaWxzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZGVvLW1vcmUtZmlsdGVycycpO1xuICBpZiAoIWRldGFpbHMpIHJldHVybjtcbiAgY29uc3QgYWN0aXZlID0gX0hJRERFTl9WRklMVEVSX1RPS0VOUy5zb21lKHQgPT4gQXBwU3RhdGUudmlkZW9GaWx0ZXJzLmhhcyh0KSk7XG4gIGlmIChhY3RpdmUpIGRldGFpbHMub3BlbiA9IHRydWU7XG4gIGNvbnN0IGZsYWcgPSBkZXRhaWxzLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLW1vcmUtZmxhZ10nKTtcbiAgaWYgKGZsYWcpIGZsYWcuaGlkZGVuID0gIWFjdGl2ZTtcbn1cblxuZnVuY3Rpb24gX2NsZWFyVmlkZW9GaWx0ZXJzKCkge1xuICBBcHBTdGF0ZS52aWRlb0ZpbHRlcnMuY2xlYXIoKTtcbiAgQXBwU3RhdGUudmlkZW9TZWFyY2ggPSAnJztcbiAgY29uc3Qgc2VhcmNoRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlkZW8tc2VhcmNoLWlucHV0Jyk7XG4gIGlmIChzZWFyY2hFbCkgc2VhcmNoRWwudmFsdWUgPSAnJztcbiAgX3N5bmNWaWRlb0ZpbHRlckNoaXBzKCk7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX3Jlc3RvcmVWaWV3KCkge1xuICB0cnkge1xuICAgIGNvbnN0IHNhdmVkID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgneXV1Y2xpcC12aWV3JykgfHwgJ251bGwnKTtcbiAgICBpZiAoIXNhdmVkPy52aWRlb0lkKSByZXR1cm47XG4gICAgaWYgKCFBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IHNhdmVkLnZpZGVvSWQpKSByZXR1cm47XG4gICAgYXdhaXQgc2VsZWN0VmlkZW8oc2F2ZWQudmlkZW9JZCk7XG4gICAgaWYgKHNhdmVkLmNsaXBJZCAmJiBBcHBTdGF0ZS5jbGlwcy5maW5kKGMgPT4gYy5pZCA9PT0gc2F2ZWQuY2xpcElkKSkge1xuICAgICAgYXdhaXQgd2luZG93LnNlbGVjdENsaXAoc2F2ZWQuY2xpcElkKTtcbiAgICB9XG4gIH0gY2F0Y2gge31cbn1cblxuZnVuY3Rpb24gX2FuYWx5emluZ1BsYWNlaG9sZGVyTGkoZmlsZW5hbWUpIHtcbiAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICBsaS5jbGFzc05hbWUgPSAndmlkZW8taXRlbSBhbmFseXppbmctcGxhY2Vob2xkZXInO1xuICBsaS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBjbGFzcz1cIm5hbWVcIiBzdHlsZT1cImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweFwiPjxzcGFuIGNsYXNzPVwic3Bpbm5lclwiPjwvc3Bhbj4ke2VzY0h0bWwoZmlsZW5hbWUpfTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS1hY2NlbnQpXCI+QW5hbHl6aW5n4oCmPC9kaXY+YDtcbiAgcmV0dXJuIGxpO1xufVxuXG5mdW5jdGlvbiBfc2hvd0VtcHR5U3RhdGUoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXItYXJlYScpLmlubmVySFRNTCA9ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuaW5uZXJIVE1MID0gYFxuICAgIDxkaXYgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPlxuICAgICAgPGltZyBjbGFzcz1cImVtcHR5LXN0YXRlLW1hc2NvdFwiIHNyYz1cIi9zdGF0aWMvZ2FtZXJjYXQucG5nXCIgYWx0PVwiXCI+XG4gICAgICA8aDI+V2VsY29tZSB0byBZdXVDbGlwPC9oMj5cbiAgICAgIDxwPkFuYWx5emUgYSByZWNvcmRpbmcgdG8gc3RhcnQgcmV2aWV3aW5nIGFuZCBleHBvcnRpbmcgeW91ciBiZXN0IG1vbWVudHMuIFl1dUNsaXAgc2hpbmVzIG9uIHRhbGstaGVhdnkgc2Vzc2lvbnMgLSBSUCwgdm9pY2UgY2hhdCwgc3RyZWFtaW5nLCBwb2RjYXN0cywgYW5kIGNvbW1lbnRhcnkuPC9wPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBoaWdobGlnaHRcIiBkYXRhLWFjdD1cIm9wZW4tbmV3LXJlY29yZGluZy1wYW5lbFwiPisgQW5hbHl6ZSB5b3VyIGZpcnN0IHJlY29yZGluZzwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIGRhdGEtYWN0PVwib3Blbi1nZXR0aW5nLXN0YXJ0ZWRcIiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+R2V0dGluZyBTdGFydGVkIEd1aWRlPC9idXR0b24+XG4gICAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gX3VwZGF0ZURlbW9CdXR0b24oYXBwcm92ZWRDb3VudCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhpZ2hsaWdodC1yZWVscycpO1xuICBidG4udGl0bGUgPSBhcHByb3ZlZENvdW50ID09PSAwXG4gICAgPyAnVmlldyBleGlzdGluZyByZWVscyBvciBidWlsZCBvbmUgYWZ0ZXIgYXBwcm92aW5nIHNvbWUgY2xpcHMnXG4gICAgOiBgVmlldyBvciBidWlsZCBhIGhpZ2hsaWdodCByZWVsIGZyb20gJHtwbHVyYWwoYXBwcm92ZWRDb3VudCwgJ2FwcHJvdmVkIGNsaXAnKX1gO1xufVxuXG5mdW5jdGlvbiBfdXBkYXRlU3RhcnRJbmdlc3RCdXR0b24oKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tc3RhcnQtYW5hbHl6ZScpO1xuICBpZiAoIWJ0bikgcmV0dXJuO1xuICBpZiAod2luZG93Ll9wcmVyZXFzICYmICF3aW5kb3cuX3ByZXJlcXMuZmZtcGVnX29rKSByZXR1cm47XG4gIGJ0bi5kaXNhYmxlZCA9ICFfcHJvYmVkSW5mbztcbiAgYnRuLnRpdGxlID0gX3Byb2JlZEluZm8gPyAnJyA6ICdTZWxlY3QgYSB2YWxpZCByZWNvcmRpbmcgZmlsZSBmaXJzdCc7XG59XG5cbmZ1bmN0aW9uIF9jbGlwc1NvcnRQYXJhbSgpIHtcbiAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwcy1zb3J0JykudmFsdWU7XG59XG5cbi8vIENhbm9uaWNhbCBjbGlwLWxpc3QgVVJMOiBldmVyeSByZWxvYWQgb2YgQXBwU3RhdGUuY2xpcHMgZ29lcyB0aHJvdWdoIHRoaXMgc28gdGhlXG4vLyBhY3RpdmUgc29ydCBBTkQgdGhlIGFjdGl2ZSBjYW5kaWRhdGUgdHlwZSAoQ2xpcHMgdnMgU2NlbmVzKSBhcmUgYWx3YXlzIGFwcGxpZWRcbi8vIHRvZ2V0aGVyLiBBZGRpbmcgYSBuZXcgZmV0Y2ggc2l0ZT8gVXNlIHRoaXMsIG5ldmVyIGEgaGFuZC1idWlsdCBxdWVyeSBzdHJpbmcuXG5mdW5jdGlvbiBfY2xpcHNMaXN0VXJsKHZpZGVvSWQpIHtcbiAgcmV0dXJuIGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L2NsaXBzP3NvcnQ9JHtfY2xpcHNTb3J0UGFyYW0oKX0ma2luZD0ke0FwcFN0YXRlLmNsaXBLaW5kfWA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbGVjdFZpZGVvKGlkKSB7XG4gIGlmICh3aW5kb3cuaXNTcGxpdEVkaXRvck9wZW4oKSkge1xuICAgIC8vIF9zcGxpdFBvaW50cyBpcyBzcGxpdC5qcydzIHNoYXJlZCBsaXZlLWVkaXQgc3RhdGU6IGEgdG9wLWxldmVsIGBsZXRgIGtlcHRcbiAgICAvLyBvdXRzaWRlIGl0cyBJSUZFIHNwZWNpZmljYWxseSBzbyBvdGhlciBjbGFzc2ljIHNjcmlwdHMgY2FuIHJlYWQgaXQgYmFyZVxuICAgIC8vIChzZWUgdGhlIGNvbW1lbnQgaW4gc3BsaXQuanMpLiBJdCBpcyBuZXZlciBhIHdpbmRvdyBwcm9wZXJ0eSwgc28gdGhpc1xuICAgIC8vIG11c3Qgc3RheSBhIGJhcmUgcmVmZXJlbmNlIHJhdGhlciB0aGFuIHdpbmRvdy5fc3BsaXRQb2ludHMuXG4gICAgY29uc3QgaGFzU3BsaXRzID0gdHlwZW9mIF9zcGxpdFBvaW50cyAhPT0gJ3VuZGVmaW5lZCcgJiYgX3NwbGl0UG9pbnRzLmxlbmd0aCA+IDA7XG4gICAgaWYgKGhhc1NwbGl0cykge1xuICAgICAgc2hvd0NvbmZpcm0oXG4gICAgICAgICdMZWF2ZSBTcGxpdCBlZGl0b3I/JyxcbiAgICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgc3BsaXQgcG9pbnRzLiBTd2l0Y2ggdG8gdGhpcyByZWNvcmRpbmcgYW5kIGRpc2NhcmQgdGhlbT8nLFxuICAgICAgICAnRGlzY2FyZCcsXG4gICAgICAgICgpID0+IHsgd2luZG93LmNsb3NlU3BsaXRFZGl0b3IoKTsgc2VsZWN0VmlkZW8oaWQpOyB9LFxuICAgICAgICB0cnVlLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgd2luZG93LmNsb3NlU3BsaXRFZGl0b3IoKTtcbiAgfVxuICAvLyBfcGFuZWxEaXJ0eSBpcyBhbmFseXplLmpzJ3Mgc2hhcmVkIGxpdmUtZWRpdCBzdGF0ZSAtIHNhbWUgYmFyZS1nbG9iYWxcbiAgLy8gY29udHJhY3QgYXMgX3NwbGl0UG9pbnRzIGFib3ZlIChzZWUgdGhlIGNvbW1lbnQgYXQgdGhlIHRvcCBvZiBhbmFseXplLmpzKS5cbiAgaWYgKHdpbmRvdy5faXNOZXdSZWNvcmRpbmdQYW5lbE9wZW4oKSAmJiBfcGFuZWxEaXJ0eSkge1xuICAgIHNob3dDb25maXJtKFxuICAgICAgJ0Rpc2NhcmQgbmV3IHJlY29yZGluZz8nLFxuICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgY29uZmlndXJhdGlvbi4gU3dpdGNoIHRvIHRoaXMgcmVjb3JkaW5nIGFueXdheT8nLFxuICAgICAgJ0Rpc2NhcmQnLFxuICAgICAgKCkgPT4geyB3aW5kb3cuX2RvQ2xvc2VOZXdSZWNvcmRpbmdQYW5lbCgpOyBzZWxlY3RWaWRlbyhpZCk7IH0sXG4gICAgICB0cnVlLFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh3aW5kb3cuX2lzTmV3UmVjb3JkaW5nUGFuZWxPcGVuKCkpIHdpbmRvdy5fZG9DbG9zZU5ld1JlY29yZGluZ1BhbmVsKCk7XG4gIEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPSBpZDtcbiAgQXBwU3RhdGUuYWN0aXZlU2Vzc2lvbklkID0gbnVsbDtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI3ZpZGVvLWxpc3QgbGkuc2Vzc2lvbi1oZWFkZXIuYWN0aXZlJykuZm9yRWFjaChsID0+IGwuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJykpO1xuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgID0gbnVsbDtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3l1dWNsaXAtdmlldycsIEpTT04uc3RyaW5naWZ5KHt2aWRlb0lkOiBpZCwgY2xpcElkOiBudWxsfSkpO1xuICBBcHBTdGF0ZS5jbGlwRmlsdGVycy5jbGVhcigpO1xuICBBcHBTdGF0ZS5jbGlwU2VhcmNoICA9ICcnO1xuICBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4gPSAwO1xuICB3aW5kb3cuX3N5bmNGaWx0ZXJDaGlwcygpO1xuICBjb25zdCBfc2VhcmNoRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1zZWFyY2gtaW5wdXQnKTtcbiAgaWYgKF9zZWFyY2hFbCkgX3NlYXJjaEVsLnZhbHVlID0gJyc7XG4gIGNvbnN0IF9zY29yZUVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtc2NvcmUtbWluJyk7XG4gIGlmIChfc2NvcmVFbCkgX3Njb3JlRWwudmFsdWUgPSAnMCc7XG4gIC8vIExvYWQgY2xpcHMgYW5kIChpZiB0aGUgYm9vdCBmZXRjaCBoYXNuJ3QgcG9wdWxhdGVkIHRoZW0geWV0KSBjb250ZXh0cyBpblxuICAvLyBwYXJhbGxlbCwgc28gdGhlIGRldGFpbCdzIGNvbnRleHQgY2hpcHMvZHJvcGRvd24gbmV2ZXIgcmVuZGVyIGZyb20gYW4gZW1wdHlcbiAgLy8gbGlzdCBvbiB0aGUgZmlyc3QgdmlkZW8gb3BlbmVkIGFmdGVyIGxvYWQuXG4gIGNvbnN0IGNsaXBzUHJvbWlzZSA9IGZldGNoKF9jbGlwc0xpc3RVcmwoaWQpKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICBhd2FpdCB3aW5kb3cuZW5zdXJlQ29udGV4dHMoKTtcbiAgY29uc3QgY2xpcHMgPSBhd2FpdCBjbGlwc1Byb21pc2U7XG4gIC8vIEd1YXJkIGFnYWluc3QgYSBzbG93ZXIgZWFybGllciBmZXRjaCByZXNvbHZpbmcgYWZ0ZXIgYSBuZXdlciBzZWxlY3Rpb24gLVxuICAvLyBvdGhlcndpc2UgY2xpY2tpbmcgQiB3aGlsZSBBJ3MgY2xpcHMgYXJlIGluIGZsaWdodCByZW5kZXJzIEEgaW50byBCJ3MgZGV0YWlsLlxuICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCAhPT0gaWQpIHJldHVybjtcbiAgQXBwU3RhdGUuY2xpcHMgPSBjbGlwcztcbiAgd2luZG93Ll9yZW5kZXJDbGlwcygpO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBpZiAodmlkZW8pIHJlbmRlclZpZGVvRGV0YWlsKHZpZGVvLCBudWxsKTtcbiAgZWxzZSB3aW5kb3cuY2xlYXJEZXRhaWwoKTtcbn1cblxuLy8gXCJJbXBvcnRlZCBmcm9tXCIgbGluZSAocm9hZG1hcCBwbGFuIDA4KSAtIHNob3duIG9ubHkgZm9yIGEgcmVjb3JkaW5nIGJyb3VnaHRcbi8vIGluIHZpYSBJbXBvcnQgZnJvbSBVUkw7IGEgcmVjb3JkaW5nIGFkZGVkIGZyb20gYSBsb2NhbCBmaWxlIGhhcyBubyBzb3VyY2VfdXJsLlxuZnVuY3Rpb24gX3JlbmRlckltcG9ydGVkRnJvbUxpbmUodmlkZW8pIHtcbiAgaWYgKCF2aWRlby5zb3VyY2VfdXJsKSByZXR1cm4gJyc7XG4gIGNvbnN0IHBhcnRzID0gW2VzY0h0bWwodmlkZW8uc291cmNlX3VwbG9hZGVyIHx8ICdVbmtub3duIGNoYW5uZWwnKV07XG4gIGlmICh2aWRlby5zb3VyY2VfdXBsb2FkX2RhdGUpIHBhcnRzLnB1c2goZXNjSHRtbCh2aWRlby5zb3VyY2VfdXBsb2FkX2RhdGUpKTtcbiAgcmV0dXJuIGBcbiAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHg7bWFyZ2luLXRvcDo0cHhcIj5cbiAgICAgICAgSW1wb3J0ZWQgZnJvbSAke3BhcnRzLmpvaW4oJyAmbWlkZG90OyAnKX0gJm1pZGRvdDtcbiAgICAgICAgPGEgaHJlZj1cIiR7ZXNjSHRtbCh2aWRlby5zb3VyY2VfdXJsKX1cIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCI+VmlldyBvcmlnaW5hbDwvYT5cbiAgICAgIDwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclZpZGVvRGV0YWlsKHZpZGVvLCBzYXZlZFRpbWVsaW5lKSB7XG4gIEFwcFN0YXRlLmFjdGl2ZVZpZGVvRGF0YSA9IHZpZGVvO1xuICBjb25zdCBlYiA9IChpc0VkaXRlZCkgPT4gaXNFZGl0ZWQgPyBgPHNwYW4gY2xhc3M9XCJlZGl0ZWQtYmFkZ2VcIj5lZGl0ZWQ8L3NwYW4+YCA6ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyLWFyZWEnKS5pbm5lckhUTUwgPVxuICAgIGA8ZGl2IHN0eWxlPVwicG9zaXRpb246cmVsYXRpdmVcIj5cbiAgICAgICA8dmlkZW8gaWQ9XCJyZWNvcmRpbmctcHJldmlldy12aWRlb1wiIGNvbnRyb2xzIHByZWxvYWQ9XCJtZXRhZGF0YVwiIGFyaWEtbGFiZWw9XCJSZWNvcmRpbmcgcHJldmlld1wiIHN0eWxlPVwiZGlzcGxheTpibG9jazt3aWR0aDoxMDAlO21heC1oZWlnaHQ6dmFyKC0tcGxheWVyLW1heC1oZWlnaHQsIDQydmgpO29iamVjdC1maXQ6Y29udGFpbjtiYWNrZ3JvdW5kOiMwMDBcIj48L3ZpZGVvPlxuICAgICAgIDxzcGFuIGlkPVwicmVjb3JkaW5nLXByZXZpZXctYmFkZ2VcIiByb2xlPVwic3RhdHVzXCIgc3R5bGU9XCJkaXNwbGF5Om5vbmU7cG9zaXRpb246YWJzb2x1dGU7dG9wOjhweDtsZWZ0OjhweDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjcpO2NvbG9yOiNlNmU2ZTY7Zm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOHB4O2JvcmRlci1yYWRpdXM6NHB4XCI+PC9zcGFuPlxuICAgICA8L2Rpdj5gO1xuICBzZXR1cFJlY29yZGluZ1ByZXZpZXcoXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY29yZGluZy1wcmV2aWV3LXZpZGVvJyksXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY29yZGluZy1wcmV2aWV3LWJhZGdlJyksXG4gICAgdmlkZW8uaWQsXG4gICAge1xuICAgICAgYXV0b0J1aWxkOiBmYWxzZSxcbiAgICAgIGlzQ3VycmVudDogKCkgPT4gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gdmlkZW8uaWQsXG4gICAgICBzdGFydFM6IHZpZGVvLnNlZ21lbnRfc3RhcnRfcyxcbiAgICAgIGVuZFM6IHZpZGVvLnNlZ21lbnRfZW5kX3MsXG4gICAgICBzb3VyY2VQYXRoOiB2aWRlby5zb3VyY2VfcGF0aCxcbiAgICB9LFxuICApO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuaW5uZXJIVE1MID0gYFxuICAgIDxkaXY+PGRpdiBjbGFzcz1cImRldGFpbC10eXBlLWJhZGdlIHZpZGVvLWJhZGdlXCI+JiMxMjc5MTY7IFJlY29yZGluZzwvZGl2PjwvZGl2PlxuXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+XG4gICAgICAgIDxoMiBzdHlsZT1cIm1hcmdpbjowO2ZvbnQtc2l6ZToxN3B4O2ZvbnQtd2VpZ2h0OjcwMFwiIHRpdGxlPVwiJHtlc2NIdG1sKHZpZGVvLnRpdGxlIHx8IHZpZGVvLmZpbGVuYW1lKX1cIj4ke2VzY0h0bWwodmlkZW8udGl0bGUgfHwgdmlkZW8uZmlsZW5hbWUpfSR7ZWIodmlkZW8udGl0bGVfaXNfZWRpdGVkKX08L2gyPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwia2ViYWItYnRuXCIgdGl0bGU9XCJFZGl0IG9yIHJlZ2VuZXJhdGUgdGl0bGVcIiBhcmlhLWxhYmVsPVwiRWRpdCBvciByZWdlbmVyYXRlIHRpdGxlXCIgZGF0YS1hY3Q9XCJ2aWRlby10aXRsZS1rZWJhYlwiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPiYjODk0Mjs8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTNweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7ZmxleC13cmFwOndyYXBcIj5cbiAgICAgICAgPHNwYW4+JHt2aWRlby5kdXJhdGlvbl9obXN9ICZtaWRkb3Q7ICR7dmlkZW8uY2xpcF9jb3VudH0gY2xpcHMgJm1pZGRvdDsgJHtfbXNUb0htcyh2aWRlby50b3RhbF9jbGlwX21zKX0gY2xpcHBlZDwvc3Bhbj5cbiAgICAgICAgJHtBcHBTdGF0ZS5jYW5SZXZlYWwgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzoycHggOHB4XCIgZGF0YS1hY3Q9XCJyZXZlYWwtaW4tZm9sZGVyXCI+U2hvdyBpbiBGb2xkZXI8L2J1dHRvbj5gIDogJyd9XG4gICAgICA8L2Rpdj5cbiAgICAgICR7X3JlbmRlckltcG9ydGVkRnJvbUxpbmUodmlkZW8pfVxuICAgIDwvZGl2PlxuXG4gICAgJHtfcmVuZGVyQ29udGV4dFNlY3Rpb24odmlkZW8pfVxuXG4gICAgJHtjb2xsYXBzaWJsZUNhcmQoJ3ZpZGVvLXN1bW1hcnknLFxuICAgICAgICBgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPlNlc3Npb24gU3VtbWFyeSR7ZWIodmlkZW8uc3VtbWFyeV9pc19lZGl0ZWQpfTwvc3Bhbj5gLCBgXG4gICAgICA8ZGl2IGlkPVwic3VtbWFyeS1ib2R5XCI+JHt2aWRlby5zdW1tYXJ5XG4gICAgICAgID8gYDxkaXYgY2xhc3M9XCJkZXNjcmlwdGlvbi1sb25nXCI+JHtlc2NIdG1sKHZpZGVvLnN1bW1hcnkpfTwvZGl2PmBcbiAgICAgICAgOiBgPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTJweFwiPk5vIHN1bW1hcnkgeWV0IC0gZ2VuZXJhdGUgYSB0aXRsZSBhbmQgc3VtbWFyeSBmcm9tIHRoZSB0cmFuc2NyaXB0LjwvZGl2PmB9PC9kaXY+YCxcbiAgICAgIHsgYWN0aW9uczogYCR7dmlkZW8uc3VtbWFyeVxuICAgICAgICAgID8gYDxidXR0b24gY2xhc3M9XCJrZWJhYi1idG5cIiB0aXRsZT1cIkVkaXQgb3IgcmVnZW5lcmF0ZSBzdW1tYXJ5XCIgYXJpYS1sYWJlbD1cIkVkaXQgb3IgcmVnZW5lcmF0ZSBzdW1tYXJ5XCIgZGF0YS1hY3Q9XCJ2aWRlby1zdW1tYXJ5LWtlYmFiXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+JiM4OTQyOzwvYnV0dG9uPmBcbiAgICAgICAgICA6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJidG4tc3VtbWFyaXplLXZpZGVvXCIgZGF0YS1hY3Q9XCJzdW1tYXJpemUtdmlkZW9cIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj5HZW5lcmF0ZSBTdW1tYXJ5PC9idXR0b24+YH1gIH0pfVxuXG4gICAgJHtfaXNWaWRlb0JlaW5nQW5hbHl6ZWQodmlkZW8pID8gX2FuYWx5c2lzTGl2ZVBhbmVsSFRNTCgpIDogJyd9XG4gICAgJHt3aW5kb3cuX3JlbmRlclJ1bk1ldGFDYXJkKHZpZGVvKX1cblxuICAgIDxkaXYgY2xhc3M9XCJ2aWQtYWN0aW9uc1wiPlxuICAgICAgPGRpdiBjbGFzcz1cInZpZC1hY3Rpb25zLXJvd1wiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuXCIgZGF0YS1hY3Q9XCJvcGVuLWJhdGNoLWV4cG9ydFwiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPkV4cG9ydCBBcHByb3ZlZDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgZGF0YS1hY3Q9XCJvcGVuLXZpZGVvLWFjdGlvbnNcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj5BZGRpdGlvbmFsIEFjdGlvbnM8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgPGRpdiBpZD1cInNwZWFrZXJzLXNlY3Rpb25cIj48L2Rpdj5cblxuICAgICR7KHZpZGVvLmNsaXBfY291bnQgPiAwIHx8IHZpZGVvLnN0YXR1cyA9PT0gJ2RvbmUnKSA/IGNvbGxhcHNpYmxlQ2FyZCgndmlkZW8tdHJhbnNjcmlwdCcsXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+RnVsbCB0cmFuc2NyaXB0PC9zcGFuPmAsXG4gICAgICBgPGRpdiBpZD1cInZpZGVvLXRyYW5zY3JpcHQtdmlld1wiIGNsYXNzPVwidHJhbnNjcmlwdFwiPjwvZGl2PmAsXG4gICAgICB7IGRlZmF1bHRDb2xsYXBzZWQ6IHRydWUsIGF0dHJzOiBgaWQ9XCJ2aWRlby10cmFuc2NyaXB0LWRldGFpbHNcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cImAsXG4gICAgICAgIGFjdGlvbnM6IGA8c3BhbiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6NnB4XCI+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOXB4XCIgdGl0bGU9XCJTY2FuIHRoZSB0cmFuc2NyaXB0IGZvciBtaXMtaGVhcmQgbmFtZXMgKGUuZy4gJnF1b3Q7WW91JnF1b3Q7IGZvciAmcXVvdDtZdXUmcXVvdDspIGFuZCBmaXggdGhlbVwiXG4gICAgICAgICAgICAgICAgICBkYXRhLWFjdD1cIm9wZW4tbmFtZS1jb3JyZWN0aW9uc1wiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPkZpeCBuYW1lczwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDlweFwiIHRpdGxlPVwiUGljayBhIHRpbWUgcmFuZ2UgdG8gY3JlYXRlIGEgY2xpcCBieSBoYW5kXCJcbiAgICAgICAgICAgICAgICAgIGRhdGEtYWN0PVwib3Blbi1jbGlwLWNyZWF0ZS1waWNrZXJcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj5DcmVhdGUgY2xpcDwvYnV0dG9uPlxuICAgICAgICA8L3NwYW4+YCB9KSA6ICcnfVxuXG4gICAgJHtjb2xsYXBzaWJsZUNhcmQoJ3ZpZGVvLXRpbWVsaW5lJyxcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5TZXNzaW9uIFRpbWVsaW5lPC9zcGFuPmAsIGBcbiAgICAgIDxkaXYgaWQ9XCJ0aW1lbGluZS1zZWN0aW9uXCI+XG4gICAgICAgICR7c2F2ZWRUaW1lbGluZSA/IHdpbmRvdy5fcmVuZGVyVGltZWxpbmVIVE1MKHNhdmVkVGltZWxpbmUpIDogKHZpZGVvLmhhc190aW1lbGluZSA/ICcnIDogd2luZG93Ll90aW1lbGluZUVtcHR5Tm90ZUhUTUwoKSl9XG4gICAgICA8L2Rpdj5gLFxuICAgICAgeyBhY3Rpb25zOiBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIGlkPVwiYnRuLWdlbmVyYXRlLXRpbWVsaW5lXCIgZGF0YS1hY3Q9XCJnZW5lcmF0ZS10aW1lbGluZVwiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPiR7dmlkZW8uaGFzX3RpbWVsaW5lID8gJ1JlZ2VuZXJhdGUgVGltZWxpbmUnIDogJ0dlbmVyYXRlIFRpbWVsaW5lJ308L2J1dHRvbj5gIH0pfWA7XG5cbiAgaWYgKHdpbmRvdy5sb2FkU3BlYWtlcnMpIHdpbmRvdy5sb2FkU3BlYWtlcnModmlkZW8uaWQpO1xuICBpZiAod2luZG93LnJlbG9hZFZpZGVvVHJhbnNjcmlwdElmT3Blbikgd2luZG93LnJlbG9hZFZpZGVvVHJhbnNjcmlwdElmT3Blbih2aWRlby5pZCk7XG4gIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwoKTtcblxuICBpZiAoIXNhdmVkVGltZWxpbmUgJiYgdmlkZW8uaGFzX3RpbWVsaW5lKSB7XG4gICAgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW8uaWR9YClcbiAgICAgIC50aGVuKHIgPT4gci5qc29uKCkpXG4gICAgICAudGhlbih2ID0+IHtcbiAgICAgICAgaWYgKHYudGltZWxpbmUgJiYgdi50aW1lbGluZS5sZW5ndGgpIHtcbiAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtc2VjdGlvbicpLmlubmVySFRNTCA9IHdpbmRvdy5fcmVuZGVyVGltZWxpbmVIVE1MKHYudGltZWxpbmUpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmNhdGNoKCgpID0+IHt9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvcGVuVmlkZW9BY3Rpb25zTW9kYWwodmlkZW9JZCkge1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLmFjdGl2ZVZpZGVvRGF0YT8uaWQgPT09IHZpZGVvSWQgPyBBcHBTdGF0ZS5hY3RpdmVWaWRlb0RhdGEgOiBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IHZpZGVvSWQpO1xuICBpZiAoIXZpZGVvKSByZXR1cm47XG4gIGNvbnN0IGlzU2VnbWVudCA9IHZpZGVvLnBhcmVudF92aWRlb19pZCAhPSBudWxsO1xuXG4gIGNvbnN0IGdyb3VwcyA9IFtcbiAgICB7IGhlYWRpbmc6ICdSZXZpZXcnLCByb3dzOiBbXG4gICAgICB7IGxhYmVsOiAnQXBwcm92ZSBBYm92ZSBTY29yZScsIGRlc2NyaXB0aW9uOiAnQXV0b21hdGljYWxseSBhcHByb3ZlIGV2ZXJ5IGNsaXAgaW4gdGhpcyByZWNvcmRpbmcgYWJvdmUgYSBzY29yZSB0aHJlc2hvbGQgeW91IGNob29zZS4nLCBhY3Rpb246ICgpID0+IHdpbmRvdy5vcGVuQXV0b0FwcHJvdmVNb2RhbCh2aWRlb0lkKSB9LFxuICAgIF19LFxuICAgIHsgaGVhZGluZzogJ1JlZ2VuZXJhdGUnLCByb3dzOiBbXG4gICAgICB7IGxhYmVsOiAnUmUtc2NvcmUgQWxsIENsaXBzJywgZGVzY3JpcHRpb246ICdSZWdlbmVyYXRlIHNjb3JlcyBhbmQgZGVzY3JpcHRpb25zIGZvciBldmVyeSBjbGlwIGluIHRoaXMgcmVjb3JkaW5nLicsIGFjdGlvbjogKCkgPT4gd2luZG93LnJlc2NvcmVBbGxDbGlwcyh2aWRlb0lkLCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKSkgfSxcbiAgICAgIHsgbGFiZWw6ICdSZS1kZXNjcmliZSBBbGwgQ2xpcHMnLCBkZXNjcmlwdGlvbjogJ1JlZ2VuZXJhdGUgZGVzY3JpcHRpb25zIG9ubHkgLSBzY29yZXMgYXJlIGtlcHQgYXMtaXMuJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cucmVkZXNjcmliZUFsbENsaXBzKHZpZGVvSWQsIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlLWRldGVjdCBTcGVha2VycycsIGRlc2NyaXB0aW9uOiAnUmUtcnVuIHNwZWFrZXIgZGV0ZWN0aW9uIG9uIHRoZSBleGlzdGluZyB0cmFuc2NyaXB0LiBDbGlwcyBhbmQgc2NvcmVzIGFyZSBrZXB0OyBuYW1lZCBzcGVha2VycyByZS1hdHRhY2ggdG8gbWF0Y2hpbmcgdm9pY2VzLicsIGFjdGlvbjogKCkgPT4gcmVkaWFyaXplVmlkZW8odmlkZW9JZCkgfSxcbiAgICAgIHsgbGFiZWw6ICdSZS10cmFuc2NyaWJlIFJlY29yZGluZycsIGRlc2NyaXB0aW9uOiAnUmUtcnVuIHNwZWVjaC10by10ZXh0IGZvciB0aGUgd2hvbGUgcmVjb3JkaW5nLiBDbGlwcyBhcmUga2VwdCBidXQgZmxhZ2dlZCBmb3IgYSByZS1zY29yZTsgcmVnZW5lcmF0ZSBjbGlwcyB0byByZWJ1aWxkIHRoZW0gZnJvbSB0aGUgbmV3IHRyYW5zY3JpcHQuJywgYWN0aW9uOiAoKSA9PiByZXRyYW5zY3JpYmVWaWRlb1J1bih2aWRlb0lkKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlLWV4dHJhY3QgQXVkaW8nLCBkZXNjcmlwdGlvbjogJ1JlYnVpbGQgdGhlIGF1ZGlvIHRyYWNrcyBmcm9tIHRoZSBzb3VyY2UgZmlsZSwgZS5nLiBhZnRlciBjaGFuZ2luZyB0aGUgdHJhY2sgbGF5b3V0LiBSZS10cmFuc2NyaWJlIGFmdGVyd2FyZCB0byB1cGRhdGUgdGhlIHRyYW5zY3JpcHQuJywgYWN0aW9uOiAoKSA9PiByZWV4dHJhY3RWaWRlb1J1bih2aWRlb0lkKSB9LFxuICAgICAgLi4uKHdpbmRvdy5oYXNFbmFibGVkU2VtYW50aWNIb3R3b3JkcygpID8gW1xuICAgICAgICB7IGxhYmVsOiAnU2NhbiBmb3IgSG90LXdvcmRzJywgZGVzY3JpcHRpb246ICdDaGVjayBldmVyeSBjbGlwIGFnYWluc3QgeW91ciBcIk1lYW5pbmdcIiBob3Qtd29yZHMgdXNpbmcgdGhlIFNpbWlsYXJpdHkgZW5naW5lLicsIGFjdGlvbjogKCkgPT4gd2luZG93LmNvbmZpcm1TY2FuSG90d29yZHNGb3JWaWRlbyh2aWRlb0lkLCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKSkgfSxcbiAgICAgIF0gOiBbXSksXG4gICAgXX0sXG4gICAgeyBoZWFkaW5nOiAnUmVjb3JkaW5nIHRvb2xzJywgcm93czogW1xuICAgICAgLi4uKGlzU2VnbWVudCA/IFtdIDogW1xuICAgICAgICB7IGxhYmVsOiAnU3BsaXQgUmVjb3JkaW5nJywgZGVzY3JpcHRpb246ICdCcmVhayB0aGlzIHJlY29yZGluZyBpbnRvIHNlZ21lbnRzIHRoYXQgY2FuIGJlIGFuYWx5emVkIGluZGVwZW5kZW50bHkuJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cub3BlblNwbGl0RWRpdG9yKHZpZGVvSWQpIH0sXG4gICAgICBdKSxcbiAgICAgIC4uLihpc1NlZ21lbnQgPyBbXG4gICAgICAgIHsgbGFiZWw6ICdVbmRvIFNwbGl0JywgZGVzY3JpcHRpb246ICdNZXJnZSB0aGlzIHNlZ21lbnQgYW5kIGl0cyBzaWJsaW5ncyBiYWNrIGludG8gdGhlIG9yaWdpbmFsIHJlY29yZGluZywga2VlcGluZyBhbGwgb2YgdGhlaXIgY2xpcHMuJywgYWN0aW9uOiAoKSA9PiB1bnNwbGl0VmlkZW8odmlkZW9JZCkgfSxcbiAgICAgIF0gOiBbXSksXG4gICAgICB7IGxhYmVsOiAnU2F2ZSBDYXB0aW9ucyB0byBTUlQnLCBkZXNjcmlwdGlvbjogJ1dyaXRlIHRoZSB0cmFuc2NyaXB0IGFzIGFuIFNSVCBjYXB0aW9uIGZpbGUgbmV4dCB0byB0aGUgc291cmNlIHJlY29yZGluZy4nLCBhY3Rpb246ICgpID0+IGV4cG9ydFZpZGVvVHJhbnNjcmlwdCh2aWRlb0lkKSB9LFxuICAgIF19LFxuICAgIHsgaGVhZGluZzogJ0RhbmdlciBab25lJywgcm93czogW1xuICAgICAgeyBsYWJlbDogJ1JlZ2VuZXJhdGUgQ2xpcHMnLCBkZXNjcmlwdGlvbjogJ1JlYnVpbGQgY2xpcHMgZnJvbSB0aGUgZXhpc3RpbmcgdHJhbnNjcmlwdC4gUmVwbGFjZXMgZXZlcnkgY2xpcCAtIGRpc2NhcmRpbmcgYXBwcm92YWxzLCBlZGl0cywgdGFncywgYW5kIHNjb3JlcyAtIHdpdGggZnJlc2gsIHVuc2NvcmVkIGNhbmRpZGF0ZXMuIFNraXBzIHJlLXRyYW5zY3JpcHRpb24uJywgZGFuZ2VyOiB0cnVlLCBhY3Rpb246ICgpID0+IHJlZ2VuZXJhdGVDbGlwc1J1bih2aWRlb0lkKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlLWFuYWx5emUgKGZ1bGwpJywgZGVzY3JpcHRpb246ICdSZS1ydW4gdGhlIGVudGlyZSBwaXBlbGluZSBmcm9tIHNjcmF0Y2guIFJlcGxhY2VzIGFsbCBjbGlwcywgc2NvcmVzLCBhbmQgc3BlYWtlcnMgZm9yIHRoaXMgcmVjb3JkaW5nLicsIGRhbmdlcjogdHJ1ZSwgYWN0aW9uOiAoKSA9PiByZWFuYWx5emVWaWRlbyh2aWRlb0lkKSB9LFxuICAgICAgeyBsYWJlbDogJ1Jlc2V0IEFwcHJvdmFscycsIGRlc2NyaXB0aW9uOiAnQ2xlYXIgdGhlIGFwcHJvdmUvcmVqZWN0IHN0YXR1cyBvbiBldmVyeSBjbGlwIGluIHRoaXMgcmVjb3JkaW5nLicsIGRhbmdlcjogdHJ1ZSwgYWN0aW9uOiAoKSA9PiB3aW5kb3cucmVzZXRBcHByb3ZhbHModmlkZW9JZCkgfSxcbiAgICAgIHsgbGFiZWw6ICdSZW1vdmUgUmVjb3JkaW5nJywgZGVzY3JpcHRpb246ICdSZW1vdmUgdGhpcyByZWNvcmRpbmcgZnJvbSBZdXVDbGlwLiBUaGUgc291cmNlIGZpbGUgb24gZGlzayBpcyBub3QgZGVsZXRlZC4nLCBkYW5nZXI6IHRydWUsIGFjdGlvbjogKCkgPT4gZGVsZXRlVmlkZW8odmlkZW9JZCkgfSxcbiAgICBdfSxcbiAgXTtcblxuICBvcGVuQWN0aW9uc01vZGFsKGAke3ZpZGVvLnRpdGxlIHx8IHZpZGVvLmZpbGVuYW1lfSAtIEFkZGl0aW9uYWwgQWN0aW9uc2AsIGdyb3Vwcyk7XG59XG5cbi8vIOKUgOKUgCByZWNvcmRpbmcgcmVtb3ZhbCArIHRyYW5zY3JpcHQgZXhwb3J0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuYXN5bmMgZnVuY3Rpb24gZXhwb3J0VmlkZW9UcmFuc2NyaXB0KGlkLCBidG4pIHtcbiAgYXdhaXQgX2RvRXhwb3J0VmlkZW9UcmFuc2NyaXB0KGlkLCBidG4sIGZhbHNlKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvRXhwb3J0VmlkZW9UcmFuc2NyaXB0KGlkLCBidG4sIG92ZXJ3cml0ZSkge1xuICBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IHRydWU7IGJ0bi50ZXh0Q29udGVudCA9ICdFeHBvcnRpbmfigKYnOyB9XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7aWR9L2V4cG9ydC10cmFuc2NyaXB0P292ZXJ3cml0ZT0ke292ZXJ3cml0ZX1gLCB7bWV0aG9kOiAnUE9TVCd9KTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICBpZiAocmVzLnN0YXR1cyA9PT0gNDA5ICYmIGRhdGEuZXhpc3RzKSB7XG4gICAgICBzaG93Q29uZmlybShcbiAgICAgICAgJ092ZXJ3cml0ZSBleGlzdGluZyBjYXB0aW9ucz8nLFxuICAgICAgICBgQW4gU1JUIGZpbGUgYWxyZWFkeSBleGlzdHMgYXQ6PGJyPjxjb2RlPiR7ZXNjSHRtbChkYXRhLnBhdGgpfTwvY29kZT48YnI+PGJyPk92ZXJ3cml0ZSBpdCB3aXRoIHRoZSBjdXJyZW50IHRyYW5zY3JpcHQ/YCxcbiAgICAgICAgJ092ZXJ3cml0ZScsXG4gICAgICAgICgpID0+IF9kb0V4cG9ydFZpZGVvVHJhbnNjcmlwdChpZCwgYnRuLCB0cnVlKSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0QXBpRXJyb3IoZGF0YSkpO1xuICAgIHNob3dUb2FzdChgQ2FwdGlvbnMgZXhwb3J0ZWQg4oaSICR7ZGF0YS5wYXRofWApO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBzaG93VG9hc3QoYEV4cG9ydCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XG4gIH0gZmluYWxseSB7XG4gICAgaWYgKGJ0bikgeyBidG4uZGlzYWJsZWQgPSBmYWxzZTsgYnRuLnRleHRDb250ZW50ID0gJ1NhdmUgQ2FwdGlvbnMgdG8gU1JUJzsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlbGV0ZVZpZGVvKGlkKSB7XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gIGNvbnN0IG5hbWUgID0gdmlkZW8gPyB2aWRlby5maWxlbmFtZSA6IGByZWNvcmRpbmcgJHtpZH1gO1xuICBzaG93Q29uZmlybShcbiAgICAnUmVtb3ZlIHJlY29yZGluZz8nLFxuICAgIGBSZW1vdmUgPHN0cm9uZz4ke2VzY0h0bWwobmFtZSl9PC9zdHJvbmc+IGZyb20gWXV1Q2xpcD88YnI+PGJyPmAgK1xuICAgIGBBbGwgY2xpcHMsIHRyYW5zY3JpcHRzLCBhbmQgZXh0cmFjdGVkIGF1ZGlvIGFyZSByZW1vdmVkIGZyb20gdGhlIGRhdGFiYXNlLiBgICtcbiAgICBgWW91ciBzb3VyY2UgcmVjb3JkaW5nIGZpbGUgaXMgPHN0cm9uZz5ub3Q8L3N0cm9uZz4gZGVsZXRlZC5gLFxuICAgICdSZW1vdmUnLFxuICAgICgpID0+IF9kb0RlbGV0ZVZpZGVvKGlkLCBuYW1lKSxcbiAgICB0cnVlLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZG9EZWxldGVWaWRlbyhpZCwgbmFtZSkge1xuICAvLyBSZWxlYXNlIHRoZSBwbGF5ZXIgc28gaXRzIGJhY2tpbmcgZXhwb3J0L3ByZXZpZXcgZmlsZSBpc24ndCBsb2NrZWQgZHVyaW5nIGRlbGV0ZS5cbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPT09IGlkKSBhd2FpdCB3aW5kb3cuX3JlbGVhc2VQbGF5ZXJCZWZvcmVEZWxldGUoKTtcbiAgY29uc3QgZGVsUmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7aWR9YCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgaWYgKCFkZWxSZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCBkZWxSZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChgRmFpbGVkIHRvIHJlbW92ZSByZWNvcmRpbmc6ICR7Zm9ybWF0QXBpRXJyb3IoZXJyKX1gLCAnZXJyb3InKTtcbiAgICBpZiAoQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSB3aW5kb3cuc2VsZWN0Q2xpcChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIHtcbiAgICBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID0gbnVsbDtcbiAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgID0gbnVsbDtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1saXN0JykuaW5uZXJIVE1MID0gJyc7XG4gICAgd2luZG93LmNsZWFyRGV0YWlsKCk7XG4gIH1cbiAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICBzaG93VG9hc3QoYFwiJHtuYW1lfVwiIHJlbW92ZWQgZnJvbSBZdXVDbGlwYCk7XG59XG5cbi8vIOKUgOKUgCBsaXZlIGFuYWx5c2lzIHByb2dyZXNzIChpbi1kZXRhaWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQSByZWNvcmRpbmcgaXMgXCJiZWluZyBhbmFseXplZFwiIHdoZW4gaXQgbWF0Y2hlcyB0aGUgZmlsZW5hbWUgb2YgdGhlIGFjdGl2ZVxuLy8gYW5hbHl6ZSBqb2IgKEFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSwgc2V0IG9uIHN0YXJ0L3JlYXR0YWNoKSBhbmQgaGFzbid0IHlldFxuLy8gcmVhY2hlZCAnZG9uZScuIFNhbWUgcnVsZSB0aGUgc2lkZWJhciB1c2VzIGZvciBpdHMgc3Bpbm5lci5cbmZ1bmN0aW9uIF9pc1ZpZGVvQmVpbmdBbmFseXplZCh2aWRlbykge1xuICByZXR1cm4gISFBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWVcbiAgICAmJiB2aWRlby5maWxlbmFtZSA9PT0gQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lXG4gICAgJiYgdmlkZW8uc3RhdHVzICE9PSAnZG9uZSc7XG59XG5cbmZ1bmN0aW9uIF9hbmFseXNpc0xpdmVQYW5lbEhUTUwoKSB7XG4gIHJldHVybiBgXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkIGFuYWx5c2lzLWxpdmVcIiBpZD1cImFuYWx5c2lzLWxpdmUtcGFuZWxcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZC1oZWFkZXJcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPjxzcGFuIGNsYXNzPVwic3Bpbm5lclwiPjwvc3Bhbj4gQW5hbHlzaXMgaW4gcHJvZ3Jlc3M8L3NwYW4+XG4gICAgICAgIDxzcGFuIHN0eWxlPVwiZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTBweFwiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwibXV0ZWRcIiBpZD1cImFuYWx5c2lzLWxpdmUtZWxhcHNlZFwiIHN0eWxlPVwiZm9udC1zaXplOjEycHhcIj48L3NwYW4+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIGRhdGEtYWN0PVwiY2FuY2VsLWpvYlwiIHN0eWxlPVwiZm9udC1zaXplOjEycHg7cGFkZGluZzoycHggMTBweFwiPkNhbmNlbDwvYnV0dG9uPlxuICAgICAgICA8L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgaWQ9XCJhbmFseXNpcy1saXZlLXN0ZXBzXCIgY2xhc3M9XCJqb2Itc3RlcHMtZGV0YWlsXCI+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibXV0ZWRcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O21hcmdpbi10b3A6OHB4XCI+UnVucyBpbiB0aGUgYmFja2dyb3VuZCAtIHlvdSBjYW4gbGVhdmUgb3IgcmVmcmVzaCB0aGlzIHBhZ2Ugd2l0aG91dCBpbnRlcnJ1cHRpbmcgaXQuPC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuLy8gTWlycm9yIHRoZSBoZWFkZXIgcHJvZ3Jlc3MgYmFyJ3Mgc3RlcCBzdGF0ZSBpbnRvIHRoZSBpbi1kZXRhaWwgcGFuZWwuIERyaXZlbiBieVxuLy8gdGhlIGFuYWx5emUgU1NFIHN0cmVhbSAodXBkYXRlSm9iVUkgLyBfdGlja0pvYlRpbWVyIGluIGpvYnMuanMpLiBSZWFkcyBqb2JzLmpzJ3Ncbi8vIHNoYXJlZCBqb2Itc3RlcCBzdGF0ZSBvZmYgd2luZG93IChqb2JzLmpzIGJyaWRnZXMgdGhlc2UgdmlhIGxpdmUgZ2V0L3NldFxuLy8gYWNjZXNzb3JzLCBzaW5jZSBhIHBsYWluIGltcG9ydCBzbmFwc2hvdCB3b3VsZCBnbyBzdGFsZSBvbiByZWFzc2lnbm1lbnQpOyBlbGFwc2VkXG4vLyB1c2VzIHRoZSBzZXJ2ZXItc2lkZSBhbmFseXplX3N0YXJ0ZWRfYXQgc28gaXQgc3RheXMgYWNjdXJhdGUgYWNyb3NzIGEgcmVmcmVzaFxuLy8gKHVubGlrZSB0aGUgaGVhZGVyIHBpbGwsIHdoaWNoIHJlc3RhcnRzIGF0IDApLlxuZnVuY3Rpb24gX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpIHtcbiAgY29uc3Qgc3RlcHNFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbmFseXNpcy1saXZlLXN0ZXBzJyk7XG4gIGlmICghc3RlcHNFbCkgcmV0dXJuO1xuICBzdGVwc0VsLmlubmVySFRNTCA9IHdpbmRvdy5fam9iU3RlcERlZnMubWFwKChzdGVwLCBpKSA9PiB7XG4gICAgY29uc3QgY2xzID0gaSA8IHdpbmRvdy5fYWN0aXZlU3RlcElkeCA/ICdkb25lJyA6IGkgPT09IHdpbmRvdy5fYWN0aXZlU3RlcElkeCA/ICdhY3RpdmUnIDogJyc7XG4gICAgaWYgKGkgIT09IHdpbmRvdy5fYWN0aXZlU3RlcElkeCkgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInN0ZXAgJHtjbHN9XCI+JHtlc2NIdG1sKHN0ZXAubGFiZWwpfTwvc3Bhbj5gO1xuICAgIC8vIEFjdGl2ZSBzdGVwIG1pcnJvcnMgdGhlIGhlYWRlciBwaWxsOiBsaXZlIGxhYmVsICsgdGhlIHNhbWUgdHdvLXRvbmUgZmlsbC5cbiAgICBjb25zdCB7dGV4dCwgcGN0fSA9IF9zdGVwUGlsbExhYmVsKGkpO1xuICAgIGNvbnN0IGZpbGwgPSBwY3QgIT0gbnVsbFxuICAgICAgPyBgIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTpsaW5lYXItZ3JhZGllbnQodG8gcmlnaHQsIHZhcigtLWdyZWVuKSAke3BjdH0lLCB2YXIoLS1hY2NlbnQpICR7cGN0fSUpXCJgXG4gICAgICA6ICcnO1xuICAgIHJldHVybiBgPHNwYW4gY2xhc3M9XCJzdGVwICR7Y2xzfVwiJHtmaWxsfT4ke2VzY0h0bWwodGV4dCl9PC9zcGFuPmA7XG4gIH0pLmpvaW4oJycpO1xuXG4gIGNvbnN0IGVsYXBzZWRFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbmFseXNpcy1saXZlLWVsYXBzZWQnKTtcbiAgaWYgKGVsYXBzZWRFbCkge1xuICAgIGNvbnN0IHN0YXJ0SXNvID0gQXBwU3RhdGUuYWN0aXZlVmlkZW9EYXRhICYmIEFwcFN0YXRlLmFjdGl2ZVZpZGVvRGF0YS5hbmFseXplX3N0YXJ0ZWRfYXQ7XG4gICAgY29uc3Qgc3RhcnRNcyAgPSBzdGFydElzbyA/IF9wYXJzZVNlcnZlckRhdGUoc3RhcnRJc28pLmdldFRpbWUoKSA6IHdpbmRvdy5fam9iU3RhcnRUaW1lO1xuICAgIGVsYXBzZWRFbC50ZXh0Q29udGVudCA9IF9mbXRFbGFwc2VkKERhdGUubm93KCkgLSBzdGFydE1zKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfcmVuZGVyQ29udGV4dFNlY3Rpb24odmlkZW8pIHtcbiAgY29uc3QgYXNzaWduZWQgPSB2aWRlby5jb250ZXh0X25hbWVzIHx8IFtdO1xuICBjb25zdCBjaGlwcyA9IGFzc2lnbmVkLm1hcChjb250ZXh0X2lkID0+IHtcbiAgICBjb25zdCBjdHggPSBBcHBTdGF0ZS5jb250ZXh0cy5maW5kKGMgPT4gYy5jb250ZXh0X2lkID09PSBjb250ZXh0X2lkKTtcbiAgICBjb25zdCBuYW1lID0gY3R4ID8gY3R4LmRpc3BsYXlfbmFtZSA6IGNvbnRleHRfaWQ7XG4gICAgcmV0dXJuIGA8c3BhbiBjbGFzcz1cImNvbnRleHQtY2hpcFwiPiR7ZXNjSHRtbChuYW1lKX08YnV0dG9uIGNsYXNzPVwiY2hpcC14XCIgZGF0YS1ybWN0eD1cIiR7ZXNjSHRtbChjb250ZXh0X2lkKX1cIiB0aXRsZT1cIlJlbW92ZVwiIGFyaWEtbGFiZWw9XCJSZW1vdmUgJHtlc2NIdG1sKG5hbWUpfVwiPsOXPC9idXR0b24+PC9zcGFuPmA7XG4gIH0pO1xuXG4gIGNvbnN0IGF2YWlsYWJsZSA9IEFwcFN0YXRlLmNvbnRleHRzLmZpbHRlcihjID0+ICFhc3NpZ25lZC5pbmNsdWRlcyhjLmNvbnRleHRfaWQpKTtcbiAgY29uc3QgYWRkU2VsZWN0ID0gYXZhaWxhYmxlLmxlbmd0aFxuICAgID8gYDxzZWxlY3Qgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA3cHg7YmFja2dyb3VuZDp2YXIoLS1iZyk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2JvcmRlci1yYWRpdXM6MTBweDtjb2xvcjp2YXIoLS1tdXRlZCk7Y3Vyc29yOnBvaW50ZXJcIlxuICAgICAgICAgICAgICBkYXRhLWFjdD1cImFkZC12aWRlby1jb250ZXh0XCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJcIj4rIEFkZDwvb3B0aW9uPlxuICAgICAgICAke2F2YWlsYWJsZS5tYXAoYyA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjSHRtbChjLmNvbnRleHRfaWQpfVwiPiR7ZXNjSHRtbChjLmRpc3BsYXlfbmFtZSB8fCBjLmNvbnRleHRfaWQpfTwvb3B0aW9uPmApLmpvaW4oJycpfVxuICAgICAgIDwvc2VsZWN0PmAgOiAnJztcblxuICBjb25zdCBwcm92TGluZXMgPSBbXTtcbiAgaWYgKHZpZGVvLmNsaXBzX3Njb3JlZF9hdCkge1xuICAgIGNvbnN0IHNjb3JlZEN0eCA9IHZpZGVvLmNsaXBzX3Njb3JlZF9jb250ZXh0IHx8IFtdO1xuICAgIGNvbnN0IHN0YWxlID0gSlNPTi5zdHJpbmdpZnkoWy4uLmFzc2lnbmVkXS5zb3J0KCkpICE9PSBKU09OLnN0cmluZ2lmeShbLi4uc2NvcmVkQ3R4XS5zb3J0KCkpO1xuICAgIGNvbnN0IHdoZW4gPSBfZm10RGF0ZSh2aWRlby5jbGlwc19zY29yZWRfYXQpO1xuICAgIGNvbnN0IGN0eE5hbWVzID0gc2NvcmVkQ3R4Lm1hcChzID0+IHsgY29uc3QgYyA9IEFwcFN0YXRlLmNvbnRleHRzLmZpbmQoeCA9PiB4LmNvbnRleHRfaWQgPT09IHMpOyByZXR1cm4gYyA/IGMuZGlzcGxheV9uYW1lIDogczsgfSk7XG4gICAgY29uc3QgY3R4U3RyID0gY3R4TmFtZXMubGVuZ3RoID8gJyDCtyAnICsgY3R4TmFtZXMubWFwKGVzY0h0bWwpLmpvaW4oJywgJykgOiAnIMK3IG5vIGNvbnRleHQnO1xuICAgIHByb3ZMaW5lcy5wdXNoKGA8c3BhbiBjbGFzcz1cIiR7c3RhbGUgPyAncHJvdmVuYW5jZS1zdGFsZScgOiAnJ31cIj5DbGlwcyBzY29yZWQgJHtlc2NIdG1sKHdoZW4pfSR7Y3R4U3RyfSR7c3RhbGUgPyAnIC0g4pqgIGNvbnRleHRzIGNoYW5nZWQgc2luY2UgbGFzdCBzY29yZScgOiAnJ308L3NwYW4+YCk7XG4gIH1cbiAgaWYgKHZpZGVvLmFuYWx5emVfcnVuKSBwcm92TGluZXMucHVzaChgPHNwYW4+JHtlc2NIdG1sKHdpbmRvdy5fcnVuVGltaW5nTGluZSh2aWRlby5hbmFseXplX3J1bikpfTwvc3Bhbj5gKTtcblxuICBjb25zdCBub0NvbnRleHRzRGVmaW5lZCA9IEFwcFN0YXRlLmNvbnRleHRzLmxlbmd0aCA9PT0gMDtcbiAgY29uc3QgZW1wdHlNc2cgPSBub0NvbnRleHRzRGVmaW5lZFxuICAgID8gYDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4XCI+Tm8gY29udGV4dHMgZGVmaW5lZCAtIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cInBhZGRpbmc6MDtkaXNwbGF5OmlubGluZTtmb250LXNpemU6MTJweFwiIGRhdGEtYWN0PVwib3Blbi1jb250ZXh0LW1hbmFnZXJcIj5jcmVhdGUgb25lPC9idXR0b24+PC9zcGFuPmBcbiAgICA6ICghYXNzaWduZWQubGVuZ3RoID8gYDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4XCI+Tm9uZSBhc3NpZ25lZDwvc3Bhbj5gIDogJycpO1xuXG4gIGNvbnN0IHJlc2NvcmVCdG4gPSAoYXNzaWduZWQubGVuZ3RoICYmIHZpZGVvLmNsaXBzX3Njb3JlZF9hdClcbiAgICA/IGA8YnV0dG9uIGNsYXNzPVwiYnRuXCIgc3R5bGU9XCJmb250LXNpemU6MTJweDtwYWRkaW5nOjRweCAxMnB4XCIgZGF0YS1hY3Q9XCJyZXNjb3JlLWNsaXBzXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+UmUtc2NvcmUgY2xpcHMgd2l0aCBjb250ZXh0PC9idXR0b24+YFxuICAgIDogYXNzaWduZWQubGVuZ3RoXG4gICAgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0blwiIHN0eWxlPVwiZm9udC1zaXplOjEycHg7cGFkZGluZzo0cHggMTJweFwiIGRhdGEtYWN0PVwicmVzY29yZS1jbGlwc1wiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPlNjb3JlIGNsaXBzIHdpdGggY29udGV4dDwvYnV0dG9uPmBcbiAgICA6ICcnO1xuXG4gIGNvbnN0IGVyckNvdW50ID0gdmlkZW8uY2xpcHNfbGxtX2Vycm9yIHx8IDA7XG4gIC8vIE9ubHkgb2ZmZXIgdGhlIHJldHJ5IHdoZW4gYSBtb2RlbCBjYW4gYWN0dWFsbHkgcnVuIC0gb3RoZXJ3aXNlIHJlLXNjb3JpbmcgdGhlXG4gIC8vIFwiZmFpbGVkXCIgY2xpcHMganVzdCBmYWlscyBhZ2Fpbi4gV2l0aCBubyBtb2RlbCB0aGVzZSBhcmVuJ3QgZmFpbHVyZXMsIHRoZXkncmVcbiAgLy8gY2xpcHMgYXdhaXRpbmcgYSBmaXJzdC1ydW4gbW9kZWwgKHN1cmZhY2VkIGJ5IHRoZSBkZXNjcmlwdGlvbiBwcm9tcHQgaW5zdGVhZCkuXG4gIGNvbnN0IGZhaWxlZEJ0biA9IChlcnJDb3VudCA+IDAgJiYgISEod2luZG93Ll9wcmVyZXFzIHx8IHt9KS5sbG1fb2spXG4gICAgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0blwiIHN0eWxlPVwiZm9udC1zaXplOjEycHg7cGFkZGluZzo0cHggMTJweDtib3JkZXItY29sb3I6dmFyKC0td2FybmluZyk7Y29sb3I6dmFyKC0td2FybmluZylcIiBkYXRhLWFjdD1cInJlc2NvcmUtZmFpbGVkLWNsaXBzXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCIgdGl0bGU9XCJSZS1ydW4gTExNIHNjb3Jpbmcgb25seSBmb3IgdGhlICR7cGx1cmFsKGVyckNvdW50LCAnY2xpcCcpfSB0aGF0IGZhaWxlZCBsYXN0IHRpbWVcIj4mIzk4ODg7IFJlLXNjb3JlICR7cGx1cmFsKGVyckNvdW50LCAnZmFpbGVkIGNsaXAnKX08L2J1dHRvbj5gXG4gICAgOiAnJztcblxuICByZXR1cm4gY29sbGFwc2libGVDYXJkKCd2aWRlby1jb250ZXh0cycsXG4gICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5Xb3JsZCBDb250ZXh0czwvc3Bhbj5gLCBgXG4gICAgICA8ZGl2IGNsYXNzPVwiY29udGV4dC1jaGlwc1wiPlxuICAgICAgICAke2NoaXBzLmpvaW4oJycpfSR7ZW1wdHlNc2d9JHthZGRTZWxlY3QgPyAnJm5ic3A7JyArIGFkZFNlbGVjdCA6ICcnfVxuICAgICAgPC9kaXY+XG4gICAgICAke3Byb3ZMaW5lcy5sZW5ndGggPyBgPGRpdiBjbGFzcz1cInByb3ZlbmFuY2Utbm90ZVwiPiR7cHJvdkxpbmVzLmpvaW4oJzxicj4nKX08L2Rpdj5gIDogJyd9XG4gICAgICAkeyhyZXNjb3JlQnRuIHx8IGZhaWxlZEJ0bikgPyBgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6NnB4O2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwXCI+JHtyZXNjb3JlQnRufSR7ZmFpbGVkQnRufTwvZGl2PmAgOiAnJ31gKTtcbn1cblxuLy8gRnJpZW5kbHkgZW1wdHkgc3RhdGUgZm9yIHRoZSBBSSBzdW1tYXJ5L3RpbWVsaW5lIGZlYXR1cmVzIHdoZW4gbm8gbGFuZ3VhZ2UgbW9kZWwgaXNcbi8vIGluc3RhbGxlZCAtIHRoZSBiYWNrZW5kIHJldHVybnMgYSBuZWVkc19tb2RlbCBwYXlsb2FkIGluc3RlYWQgb2YgYSBoYXJkIGVycm9yLCBhbmRcbi8vIHRoaXMgcmVuZGVycyBpdCBhcyBhbiBpbnZpdGluZyBcImluc3RhbGwgYSBsb2NhbCBtb2RlbFwiIGNhbGwgdG8gYWN0aW9uLiBUaGUgaW5zdGFsbFxuLy8gbnVkZ2UgaXMgaGlkZGVuIHdoZW4gdGhlIHBheWxvYWQgYXNrcyBmb3IgaXQgKFN0YWdlIDA3IHByaXZhY3kgbW9kZSkuXG5mdW5jdGlvbiBfbmVlZHNNb2RlbEN0YUhUTUwocGF5bG9hZCkge1xuICBjb25zdCBjdGEgPSBwYXlsb2FkLnNob3dfY3RhID09PSBmYWxzZSA/ICcnIDpcbiAgICBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOXB4XCJcbiAgICAgICBkYXRhLWFjdD1cImluc3RhbGwtbG9jYWwtbW9kZWxcIj5JbnN0YWxsIGEgbG9jYWwgbW9kZWw8L2J1dHRvbj5gO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJuZWVkcy1tb2RlbC1jdGFcIj5cbiAgICA8ZGl2IGNsYXNzPVwibmVlZHMtbW9kZWwtaGVhZGluZ1wiPiR7ZXNjSHRtbChwYXlsb2FkLmhlYWRpbmcpfTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJuZWVkcy1tb2RlbC1kZXRhaWxcIj4ke2VzY0h0bWwocGF5bG9hZC5kZXRhaWwpfTwvZGl2PlxuICAgICR7Y3RhfVxuICA8L2Rpdj5gO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfcmVmcmVzaFZpZGVvRGV0YWlsKHZpZGVvSWQpIHtcbiAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICBjb25zdCB1cGRhdGVkID0gQXBwU3RhdGUudmlkZW9zLmZpbmQoeCA9PiB4LmlkID09PSB2aWRlb0lkKTtcbiAgaWYgKHVwZGF0ZWQpIHJlbmRlclZpZGVvRGV0YWlsKHVwZGF0ZWQsIG51bGwpO1xufVxuXG4vLyDilIDilIAgcmUtYW5hbHlzaXMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUd28gd2F5cyB0byByZS1ydW4gYW5hbHlzaXMgb24gYW4gYWxyZWFkeS1hbmFseXplZCByZWNvcmRpbmc6XG4vLyAgIHJlYW5hbHl6ZVZpZGVvICAtIGZ1bGwgcGlwZWxpbmUgd2l0aCAtLWZvcmNlIChkZXN0cnVjdGl2ZTogcmVwbGFjZXMgY2xpcHMvc2NvcmVzKS5cbi8vICAgcmVkaWFyaXplVmlkZW8gIC0gc3BlYWtlciBkZXRlY3Rpb24gb25seSAobm9uLWRlc3RydWN0aXZlOiBrZWVwcyBjbGlwcy9zY29yZXMpLlxuLy8gT3BlbnMgdGhlIE5ldyBSZWNvcmRpbmcgcGFuZWwgaW4gcmUtYW5hbHl6ZSBtb2RlOiBzZXR0aW5ncyBkZWZhdWx0IHRvIHRoaXNcbi8vIHJlY29yZGluZydzIG9yaWdpbmFsIHJ1biBidXQgc3RheSBlZGl0YWJsZSwgYW5kIHRoZSBkZXN0cnVjdGl2ZSB3YXJuaW5nIHBsdXNcbi8vIHRoZSBleHBsaWNpdCBcIlJlLWFuYWx5emVcIiBidXR0b24gc3RhbmQgaW4gZm9yIHRoZSBvbGQgY29uZmlybSBkaWFsb2cuXG5mdW5jdGlvbiByZWFuYWx5emVWaWRlbyhpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlLWFuYWx5emUgdGhpcyByZWNvcmRpbmcnKSkgcmV0dXJuO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBpZiAoIXZpZGVvKSByZXR1cm47XG4gIHdpbmRvdy5vcGVuUmVhbmFseXplUGFuZWwodmlkZW8pO1xufVxuXG4vLyBSZWJ1aWxkIGFuIGFuYWx5emUgcmVxdWVzdCB0aGUgd2F5IHRoZSByZWNvcmRpbmcgd2FzIG9yaWdpbmFsbHkgYW5hbHl6ZWRcbi8vIChWaWRlby5hbmFseXplX3J1bi5zZXR0aW5ncyksIGZhbGxpbmcgYmFjayB0byB0aGUgU2V0dGluZ3MtbWFuYWdlZCBjb25maWdcbi8vIGRlZmF1bHRzIHdoZW4gbm8gcnVuIHdhcyByZWNvcmRlZC4gU2hhcmVkIGJ5IHJlLWFuYWx5emUgKGZ1bGwpIGhlcmUgYW5kIHRoZVxuLy8gc3BsaXQgcmUtYW5hbHl6ZSBmbG93IGluIHNwbGl0LmpzLlxuYXN5bmMgZnVuY3Rpb24gX3JlYW5hbHl6ZVBhcmFtcyh2aWRlbykge1xuICBjb25zdCBjdXJyZW50Q29udGV4dHMgPSAodmlkZW8gJiYgdmlkZW8uY29udGV4dF9uYW1lcykgfHwgW107XG4gIGNvbnN0IHJlY29yZGVkID0gdmlkZW8gJiYgdmlkZW8uYW5hbHl6ZV9ydW4gJiYgdmlkZW8uYW5hbHl6ZV9ydW4uc2V0dGluZ3M7XG4gIGlmIChyZWNvcmRlZCAmJiByZWNvcmRlZC5tb2RlbCkge1xuICAgIHJldHVybiB7XG4gICAgICBtb2RlbDogICAgICAgICByZWNvcmRlZC5tb2RlbCxcbiAgICAgIHByb2ZpbGU6ICAgICAgIHJlY29yZGVkLnRyYWNrX2xheW91dCAmJiByZWNvcmRlZC50cmFja19sYXlvdXQgIT09ICdkZWZhdWx0JyA/IHJlY29yZGVkLnRyYWNrX2xheW91dCA6IG51bGwsXG4gICAgICBlbmVyZ3lfbW9kZTogICByZWNvcmRlZC5lbmVyZ3lfbW9kZSB8fCAnZmFzdCcsXG4gICAgICBzY2VuZV9tb2RlOiAgICByZWNvcmRlZC5zY2VuZV9tb2RlIHx8ICdmYXN0JyxcbiAgICAgIGRpYXJpemU6ICAgICAgIHR5cGVvZiByZWNvcmRlZC5zcGVha2VyX2xhYmVscyA9PT0gJ2Jvb2xlYW4nID8gcmVjb3JkZWQuc3BlYWtlcl9sYWJlbHMgOiBudWxsLFxuICAgICAgY29udGV4dF9uYW1lczogY3VycmVudENvbnRleHRzLmxlbmd0aCA/IGN1cnJlbnRDb250ZXh0cyA6IChyZWNvcmRlZC5jb250ZXh0cyB8fCBbXSksXG4gICAgfTtcbiAgfVxuICBsZXQgY2ZnID0ge307XG4gIHRyeSB7IGNmZyA9IGF3YWl0IGZldGNoKCcvYXBpL2NvbmZpZycpLnRoZW4ociA9PiByLmpzb24oKSk7IH0gY2F0Y2ggeyAvKiBrZWVwIHN0YXRpYyBmYWxsYmFja3MgKi8gfVxuICByZXR1cm4ge1xuICAgIG1vZGVsOiAgICAgICAgIGNmZy53aGlzcGVyX21vZGVsIHx8ICdtZWRpdW0nLFxuICAgIHByb2ZpbGU6ICAgICAgIG51bGwsXG4gICAgZW5lcmd5X21vZGU6ICAgY2ZnLmVuZXJneV9tb2RlIHx8ICdmYXN0JyxcbiAgICBzY2VuZV9tb2RlOiAgICBjZmcuc2NlbmVfZGV0ZWN0aW9uX21vZGUgfHwgJ2Zhc3QnLFxuICAgIGRpYXJpemU6ICAgICAgIG51bGwsXG4gICAgY29udGV4dF9uYW1lczogY3VycmVudENvbnRleHRzLFxuICB9O1xufVxuXG5mdW5jdGlvbiByZWRpYXJpemVWaWRlbyhpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlLWRldGVjdCBzcGVha2VycycpKSByZXR1cm47XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gIGNvbnN0IG5hbWUgPSB2aWRlbyA/IHZpZGVvLmZpbGVuYW1lIDogaWQ7XG4gIG9wZW5Mb2coKTtcbiAgYXBwZW5kTG9nKGBSZS1kZXRlY3Rpbmcgc3BlYWtlcnM6ICR7bmFtZX1gKTtcbiAgc3RyZWFtU1NFKFxuICAgIGAvYXBpL3ZpZGVvcy8ke2lkfS9yZWRpYXJpemVgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgICAgIGNvbnN0IHYgPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh4ID0+IHguaWQgPT09IGlkKTtcbiAgICAgIGlmICh2ICYmIEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPT09IGlkKSByZW5kZXJWaWRlb0RldGFpbCh2LCBudWxsKTtcbiAgICAgIGlmICh3aW5kb3cubG9hZFNwZWFrZXJzKSB3aW5kb3cubG9hZFNwZWFrZXJzKGlkKTtcbiAgICAgIHNob3dUb2FzdCgnU3BlYWtlciBkZXRlY3Rpb24gY29tcGxldGUnKTtcbiAgICAgIHdpbmRvdy5Tb3VuZEZ4LnBsYXkoJ2FuYWx5c2lzJyk7XG4gICAgfSxcbiAgICBbe2xhYmVsOiAnU3BlYWtlcnMnLCBwYXR0ZXJuczogWydEZXRlY3Rpbmcgc3BlYWtlcnMnXX1dLFxuICAgICdSZS1kZXRlY3Rpbmcgc3BlYWtlcnMnLFxuICAgIGZhbHNlLFxuICApO1xufVxuXG4vLyDilIDilIAgc2luZ2xlLXN0YWdlIHJlLXJ1bnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBSZS1ydW4gb25lIHBpcGVsaW5lIHN0YWdlIHdpdGhvdXQgcGF5aW5nIGZvciB0aGUgZWFybGllciBvbmVzLiBEb3duc3RyZWFtIHJlc3VsdHNcbi8vIGFyZSBtYXJrZWQgc3RhbGUgKHZpYSB0aGUgZXhpc3RpbmcgXCJjYXB0aW9ucyBjaGFuZ2VkXCIgLyB1bnNjb3JlZCBiYWRnZXMpIHJhdGhlciB0aGFuXG4vLyBjYXNjYWRlZCAtIHRoZSB1c2VyIGNob29zZXMgd2hlbiB0byByZS1zY29yZSAvIHJlZ2VuZXJhdGUuXG5mdW5jdGlvbiByZWV4dHJhY3RWaWRlb1J1bihpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlLWV4dHJhY3QgYXVkaW8nKSkgcmV0dXJuO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBjb25zdCBuYW1lID0gdmlkZW8gPyB2aWRlby5maWxlbmFtZSA6IGlkO1xuICBvcGVuTG9nKCk7XG4gIGFwcGVuZExvZyhgUmUtZXh0cmFjdGluZyBhdWRpbzogJHtuYW1lfWApO1xuICBzdHJlYW1TU0UoXG4gICAgYC9hcGkvdmlkZW9zLyR7aWR9L3JlZXh0cmFjdGAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICAgICAgY29uc3QgdiA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHggPT4geC5pZCA9PT0gaWQpO1xuICAgICAgaWYgKHYgJiYgQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIHJlbmRlclZpZGVvRGV0YWlsKHYsIG51bGwpO1xuICAgICAgc2hvd1RvYXN0KCdBdWRpbyByZS1leHRyYWN0ZWQgLSByZS10cmFuc2NyaWJlIHRvIHVwZGF0ZSB0aGUgdHJhbnNjcmlwdCcpO1xuICAgICAgd2luZG93LlNvdW5kRngucGxheSgnYW5hbHlzaXMnKTtcbiAgICB9LFxuICAgIFt7bGFiZWw6ICdFeHRyYWN0JywgcGF0dGVybnM6IFsnRXh0cmFjdGluZyBhdWRpbyddfV0sXG4gICAgJ1JlLWV4dHJhY3RpbmcgYXVkaW8nLFxuICAgIGZhbHNlLFxuICApO1xufVxuXG5mdW5jdGlvbiByZXRyYW5zY3JpYmVWaWRlb1J1bihpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlLXRyYW5zY3JpYmUgdGhpcyByZWNvcmRpbmcnKSkgcmV0dXJuO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBjb25zdCBuYW1lID0gdmlkZW8gPyB2aWRlby5maWxlbmFtZSA6IGlkO1xuICBvcGVuTG9nKCk7XG4gIGFwcGVuZExvZyhgUmUtdHJhbnNjcmliaW5nOiAke25hbWV9YCk7XG4gIHN0cmVhbVNTRShcbiAgICBgL2FwaS92aWRlb3MvJHtpZH0vcmV0cmFuc2NyaWJlYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gICAgICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIGF3YWl0IHNlbGVjdFZpZGVvKGlkKTtcbiAgICAgIHNob3dUb2FzdCgnUmUtdHJhbnNjcmlwdGlvbiBjb21wbGV0ZSAtIHJlLXNjb3JlIHRvIHJlZnJlc2ggY2xpcCBzY29yZXMnKTtcbiAgICAgIHdpbmRvdy5Tb3VuZEZ4LnBsYXkoJ2FuYWx5c2lzJyk7XG4gICAgfSxcbiAgICBbe2xhYmVsOiAnRXh0cmFjdCcsIHBhdHRlcm5zOiBbJ0V4dHJhY3RpbmcgYXVkaW8nXX0sIHtsYWJlbDogJ1RyYW5zY3JpYmUnLCBwYXR0ZXJuczogWydUcmFuc2NyaWJpbmcnXX1dLFxuICAgICdSZS10cmFuc2NyaWJpbmcnLFxuICAgIGZhbHNlLFxuICApO1xufVxuXG5mdW5jdGlvbiByZWdlbmVyYXRlQ2xpcHNSdW4oaWQpIHtcbiAgaWYgKF9ibG9ja2VkQnlBbmFseXplKCdyZWdlbmVyYXRlIGNsaXBzJykpIHJldHVybjtcbiAgY29uc3QgdmlkZW8gPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IGlkKTtcbiAgY29uc3QgbmFtZSA9IHZpZGVvID8gdmlkZW8uZmlsZW5hbWUgOiBpZDtcbiAgc2hvd0NvbmZpcm0oXG4gICAgJ1JlZ2VuZXJhdGUgY2xpcHM/JyxcbiAgICAnVGhpcyByZWJ1aWxkcyBldmVyeSBjbGlwIGZyb20gdGhlIGN1cnJlbnQgdHJhbnNjcmlwdCwgZGlzY2FyZGluZyBhbGwgYXBwcm92YWxzLCBlZGl0cywgdGFncywgYW5kIHNjb3JlcyBvbiB0aGlzIHJlY29yZGluZ1xcJ3MgZXhpc3RpbmcgY2xpcHMuIFRoZSB0cmFuc2NyaXB0IGl0c2VsZiBpcyBrZXB0LiBSZS1zY29yZSBhZnRlcndhcmQgdG8gcG9wdWxhdGUgdGhlIG5ldyBjbGlwcy4nLFxuICAgICdSZWdlbmVyYXRlIENsaXBzJyxcbiAgICAoKSA9PiB7XG4gICAgICBvcGVuTG9nKCk7XG4gICAgICBhcHBlbmRMb2coYFJlZ2VuZXJhdGluZyBjbGlwczogJHtuYW1lfWApO1xuICAgICAgc3RyZWFtU1NFKFxuICAgICAgICBgL2FwaS92aWRlb3MvJHtpZH0vcmVnZW5lcmF0ZS1jbGlwc2AsXG4gICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gICAgICAgICAgaWYgKEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPT09IGlkKSBhd2FpdCBzZWxlY3RWaWRlbyhpZCk7XG4gICAgICAgICAgc2hvd1RvYXN0KCdDbGlwcyByZWdlbmVyYXRlZCAtIHJlLXNjb3JlIHRvIHBvcHVsYXRlIHNjb3JlcycpO1xuICAgICAgICAgIHdpbmRvdy5Tb3VuZEZ4LnBsYXkoJ2FuYWx5c2lzJyk7XG4gICAgICAgIH0sXG4gICAgICAgIFt7bGFiZWw6ICdHZW5lcmF0ZSBDbGlwcycsIHBhdHRlcm5zOiBbJ0dlbmVyYXRpbmcgY2xpcHMnXX1dLFxuICAgICAgICAnUmVnZW5lcmF0aW5nIGNsaXBzJyxcbiAgICAgICAgZmFsc2UsXG4gICAgICApO1xuICAgIH0sXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuLy8g4pSA4pSAIHVuZG8gc3BsaXQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiB1bnNwbGl0VmlkZW8odmlkZW9JZCkge1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gdmlkZW9JZCk7XG4gIGlmICghdmlkZW8gfHwgdmlkZW8ucGFyZW50X3ZpZGVvX2lkID09IG51bGwpIHJldHVybjtcbiAgY29uc3Qgc2libGluZ3MgID0gQXBwU3RhdGUudmlkZW9zLmZpbHRlcih2ID0+IHYucGFyZW50X3ZpZGVvX2lkID09PSB2aWRlby5wYXJlbnRfdmlkZW9faWQpO1xuICBjb25zdCBjbGlwVG90YWwgPSBzaWJsaW5ncy5yZWR1Y2UoKHN1bSwgdikgPT4gc3VtICsgKHYuY2xpcF9jb3VudCB8fCAwKSwgMCk7XG4gIHNob3dDb25maXJtKFxuICAgICdVbmRvIHNwbGl0PycsXG4gICAgYFRoaXMgbWVyZ2VzICR7cGx1cmFsKHNpYmxpbmdzLmxlbmd0aCwgJ3NlZ21lbnQnKX0gLSBhbmQgJHtwbHVyYWwoY2xpcFRvdGFsLCAnY2xpcCcpfSBvbiB0aGVtIC0gYCArXG4gICAgYGJhY2sgaW50byB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nLCByZXN0b3JpbmcgZWFjaCBjbGlwJ3Mgb3JpZ2luYWwgdGltaW5nLiBgICtcbiAgICBgVGhlIHNlZ21lbnRzIGFyZSByZW1vdmVkIGFuZCB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nIGJlY29tZXMgdmlzaWJsZSBhZ2Fpbi5gLFxuICAgICdVbmRvIFNwbGl0JyxcbiAgICAoKSA9PiBfZG9VbnNwbGl0VmlkZW8odmlkZW9JZCksXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvVW5zcGxpdFZpZGVvKHZpZGVvSWQpIHtcbiAgbGV0IHJlcztcbiAgdHJ5IHtcbiAgICByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS91bnNwbGl0YCwge21ldGhvZDogJ1BPU1QnfSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNob3dUb2FzdChuZXRFcnJNc2coZXJyKSwgJ2Vycm9yJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghcmVzLm9rKSB7XG4gICAgY29uc3QgZXJyID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICBzaG93VG9hc3QoYFVuZG8gc3BsaXQgZmFpbGVkOiAke2Zvcm1hdEFwaUVycm9yKGVycil9YCwgJ2Vycm9yJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpO1xuICBzaG93VG9hc3QoYFNwbGl0IHVuZG9uZSAtICR7cGx1cmFsKGRhdGEubWVyZ2VkX2NsaXBzLCAnY2xpcCcpfSByZXN0b3JlZCB0byB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nYCk7XG4gIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgc2VsZWN0VmlkZW8oZGF0YS5wYXJlbnRfaWQpO1xufVxuXG5mdW5jdGlvbiBfb3BlblZpZGVvRmllbGRLZWJhYih2aWRlb0lkLCBidG4sIGZpZWxkKSB7XG4gIGNvbnN0IHZpZGVvICAgICAgPSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0RhdGE7XG4gIGNvbnN0IGlzVGl0bGUgICAgPSBmaWVsZCA9PT0gJ3RpdGxlJztcbiAgY29uc3QgZWRpdFRpdGxlICA9IGlzVGl0bGUgPyAnRWRpdCBUaXRsZScgICA6ICdFZGl0IFN1bW1hcnknO1xuICBjb25zdCByZXZlcnRUaXRsZSA9IGlzVGl0bGUgPyAnUmV2ZXJ0IFRpdGxlJyA6ICdSZXZlcnQgU3VtbWFyeSc7XG4gIGNvbnN0IGRpZmZMYWJlbCAgPSBpc1RpdGxlID8gJ1RpdGxlJyAgICAgICAgIDogJ1N1bW1hcnknO1xuICBjb25zdCBjdXJyZW50ICAgID0gaXNUaXRsZSA/IHZpZGVvPy50aXRsZSAgICA6IHZpZGVvPy5zdW1tYXJ5O1xuICBjb25zdCBpc0VkaXRlZCAgID0gaXNUaXRsZSA/IHZpZGVvPy50aXRsZV9pc19lZGl0ZWQgICA6IHZpZGVvPy5zdW1tYXJ5X2lzX2VkaXRlZDtcbiAgY29uc3Qgb3JpZ2luYWwgICA9IGlzVGl0bGUgPyB2aWRlbz8udGl0bGVfb3JpZ2luYWwgICAgOiB2aWRlbz8uc3VtbWFyeV9vcmlnaW5hbDtcblxuICBjb25zdCBpdGVtcyA9IFtcbiAgICB7IGxhYmVsOiAnRWRpdCcsIGFjdGlvbjogKCkgPT5cbiAgICAgIG9wZW5GaWVsZEVkaXRNb2RhbChlZGl0VGl0bGUsIGN1cnJlbnQgfHwgJycsIGFzeW5jIHYgPT4ge1xuICAgICAgICBhd2FpdCBfcGF0Y2hWaWRlb0ZpZWxkKHZpZGVvSWQsICdhY2NlcHRfZWRpdCcsIGZpZWxkLFxuICAgICAgICAgIGlzVGl0bGUgPyB2IDogbnVsbCwgaXNUaXRsZSA/IG51bGwgOiB2KTtcbiAgICAgICAgYXdhaXQgX3JlZnJlc2hWaWRlb0RldGFpbCh2aWRlb0lkKTtcbiAgICAgIH0pXG4gICAgfSxcbiAgXTtcbiAgaWYgKGlzRWRpdGVkKSB7XG4gICAgaXRlbXMucHVzaCh7IGxhYmVsOiAnUmV2ZXJ0IHRvIE9yaWdpbmFsJywgYWN0aW9uOiAoKSA9PlxuICAgICAgb3BlbkRpZmZNb2RhbChyZXZlcnRUaXRsZSwgW1xuICAgICAgICB7bGFiZWw6IGRpZmZMYWJlbCwgY3VycmVudCwgcHJvcG9zZWQ6IG9yaWdpbmFsfSxcbiAgICAgIF0sIGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgX3BhdGNoVmlkZW9GaWVsZCh2aWRlb0lkLCAncmV2ZXJ0JywgZmllbGQsIG51bGwsIG51bGwpO1xuICAgICAgICBhd2FpdCBfcmVmcmVzaFZpZGVvRGV0YWlsKHZpZGVvSWQpO1xuICAgICAgfSwge3JldmVydE1vZGU6IHRydWV9KVxuICAgIH0pO1xuICB9XG4gIGl0ZW1zLnB1c2gobnVsbCwgeyBsYWJlbDogJ1JlZ2VuZXJhdGUnLCBhY3Rpb246ICgpID0+IHdpbmRvdy5zdW1tYXJpemVWaWRlbyh2aWRlb0lkLCBudWxsKSB9KTtcbiAgaWYgKCFpc1RpdGxlKSBpdGVtcy5wdXNoKHsgbGFiZWw6ICdSZWdlbmVyYXRlIChhdXRvLXNhdmUpJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cucmVnZW5TdW1tYXJ5QXV0byh2aWRlb0lkLCBudWxsKSB9KTtcbiAgc2hvd0tlYmFiKGJ0biwgaXRlbXMpO1xufVxuXG5mdW5jdGlvbiBvcGVuVmlkZW9UaXRsZUtlYmFiKHZpZGVvSWQsIGJ0bikgICB7IF9vcGVuVmlkZW9GaWVsZEtlYmFiKHZpZGVvSWQsIGJ0biwgJ3RpdGxlJyk7IH1cbmZ1bmN0aW9uIG9wZW5WaWRlb1N1bW1hcnlLZWJhYih2aWRlb0lkLCBidG4pIHsgX29wZW5WaWRlb0ZpZWxkS2ViYWIodmlkZW9JZCwgYnRuLCAnc3VtbWFyeScpOyB9XG5cbmFzeW5jIGZ1bmN0aW9uIF9wYXRjaFZpZGVvRmllbGQodmlkZW9JZCwgYWN0aW9uLCBmaWVsZCwgbmV3VGl0bGUsIG5ld1N1bW1hcnkpIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vZmllbGRzYCwge1xuICAgIG1ldGhvZDogJ1BBVENIJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHthY3Rpb24sIGZpZWxkLCBuZXdfdGl0bGU6IG5ld1RpdGxlLCBuZXdfc3VtbWFyeTogbmV3U3VtbWFyeX0pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHNob3dUb2FzdCgnU2F2ZSBmYWlsZWQnLCAnZXJyb3InKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gb25DbGlwc1NvcnRDaGFuZ2UoKSB7XG4gIGlmICghQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkgcmV0dXJuO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY2xpcHMtc29ydCcsIF9jbGlwc1NvcnRQYXJhbSgpKTtcbiAgdHJ5IHtcbiAgICBBcHBTdGF0ZS5jbGlwcyA9IGF3YWl0IGZldGNoKF9jbGlwc0xpc3RVcmwoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gIH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgd2luZG93Ll9yZW5kZXJDbGlwcygpO1xufVxuXG4vLyDilIDilIAgaW4tZGV0YWlsIGFjdGlvbiBkZWxlZ2F0aW9uIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gI2RldGFpbCdzIGlubmVySFRNTCBpcyByZWJ1aWx0IHdob2xlc2FsZSBieSByZW5kZXJWaWRlb0RldGFpbC9fc2hvd0VtcHR5U3RhdGVcbi8vIChhbmQgYnkgb3RoZXIgbW9kdWxlcycgY29kZSB0aGF0IGFsc28gdGFyZ2V0cyAjZGV0YWlsLCBlLmcuIGNsaXBzLmpzJ3MgY2xpcFxuLy8gZGV0YWlsIHZpZXcpLCBzbyB0aGUgY2xpY2svY2hhbmdlIGxpc3RlbmVycyBhcmUgd2lyZWQgb25jZSBvbiB0aGUgY29udGFpbmVyXG4vLyBpdHNlbGYgLSBzZWUgdGhlIGFkZEV2ZW50TGlzdGVuZXIgY2FsbHMgYXQgdGhlIGJvdHRvbSBvZiB0aGlzIGZpbGUgLSByYXRoZXJcbi8vIHRoYW4gcmUtYXR0YWNoZWQgcGVyIHJlbmRlci4gVGhlIGNvbnRhaW5lciBub2RlIHBlcnNpc3RzIGFjcm9zcyBldmVyeSByZW5kZXI7XG4vLyBvbmx5IGl0cyBjaGlsZHJlbiBhcmUgcmVwbGFjZWQuXG5mdW5jdGlvbiBfaGFuZGxlRGV0YWlsQ2xpY2soZSkge1xuICBjb25zdCBlbCA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWFjdF0nKTtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBjb25zdCBhY3QgPSBlbC5kYXRhc2V0LmFjdDtcbiAgY29uc3QgdmlkZW9JZCA9IGVsLmRhdGFzZXQudmlkZW9JZCAhPSBudWxsID8gcGFyc2VJbnQoZWwuZGF0YXNldC52aWRlb0lkKSA6IG51bGw7XG4gIHN3aXRjaCAoYWN0KSB7XG4gICAgY2FzZSAnb3Blbi1uZXctcmVjb3JkaW5nLXBhbmVsJzogd2luZG93Lm9wZW5OZXdSZWNvcmRpbmdQYW5lbCgpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWdldHRpbmctc3RhcnRlZCc6IG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsKCk7IGJyZWFrO1xuICAgIGNhc2UgJ3ZpZGVvLXRpdGxlLWtlYmFiJzogb3BlblZpZGVvVGl0bGVLZWJhYih2aWRlb0lkLCBlbCk7IGJyZWFrO1xuICAgIGNhc2UgJ3ZpZGVvLXN1bW1hcnkta2ViYWInOiBvcGVuVmlkZW9TdW1tYXJ5S2ViYWIodmlkZW9JZCwgZWwpOyBicmVhaztcbiAgICBjYXNlICdzdW1tYXJpemUtdmlkZW8nOiB3aW5kb3cuc3VtbWFyaXplVmlkZW8odmlkZW9JZCwgZWwpOyBicmVhaztcbiAgICBjYXNlICdyZXZlYWwtaW4tZm9sZGVyJzogcmV2ZWFsSW5Gb2xkZXIoQXBwU3RhdGUuYWN0aXZlVmlkZW9EYXRhLnBhdGgpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWJhdGNoLWV4cG9ydCc6IHdpbmRvdy5vcGVuQmF0Y2hFeHBvcnRNb2RhbCh2aWRlb0lkKTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi12aWRlby1hY3Rpb25zJzogb3BlblZpZGVvQWN0aW9uc01vZGFsKHZpZGVvSWQpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLW5hbWUtY29ycmVjdGlvbnMnOiB3aW5kb3cub3Blbk5hbWVDb3JyZWN0aW9ucyh2aWRlb0lkKTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi1jbGlwLWNyZWF0ZS1waWNrZXInOiB3aW5kb3cub3BlbkNsaXBDcmVhdGVQaWNrZXIodmlkZW9JZCk7IGJyZWFrO1xuICAgIGNhc2UgJ2dlbmVyYXRlLXRpbWVsaW5lJzogd2luZG93LmdlbmVyYXRlVGltZWxpbmUodmlkZW9JZCk7IGJyZWFrO1xuICAgIGNhc2UgJ2NhbmNlbC1qb2InOiBjYW5jZWxKb2IoKTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi1jb250ZXh0LW1hbmFnZXInOiB3aW5kb3cub3BlbkNvbnRleHRNYW5hZ2VyKCk7IGJyZWFrO1xuICAgIGNhc2UgJ3Jlc2NvcmUtY2xpcHMnOiB3aW5kb3cucmVzY29yZUNsaXBzKHZpZGVvSWQsIGVsKTsgYnJlYWs7XG4gICAgY2FzZSAncmVzY29yZS1mYWlsZWQtY2xpcHMnOiB3aW5kb3cucmVzY29yZUZhaWxlZENsaXBzKHZpZGVvSWQsIGVsKTsgYnJlYWs7XG4gICAgY2FzZSAnaW5zdGFsbC1sb2NhbC1tb2RlbCc6XG4gICAgICB3aW5kb3cub3BlblNldHRpbmdzKCk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5fc2Nyb2xsVG9TZXR0aW5nc1NlY3Rpb24oJ3NldHRpbmdzLXNlYy1sbG0nKSwgMTIwKTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9oYW5kbGVEZXRhaWxDaGFuZ2UoZSkge1xuICBjb25zdCBlbCA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWFjdD1cImFkZC12aWRlby1jb250ZXh0XCJdJyk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgY29uc3QgdmlkZW9JZCA9IHBhcnNlSW50KGVsLmRhdGFzZXQudmlkZW9JZCk7XG4gIHdpbmRvdy5hZGRWaWRlb0NvbnRleHQodmlkZW9JZCwgZWwudmFsdWUpO1xuICBlbC52YWx1ZSA9ICcnO1xufVxuXG4vLyBQdWJsaWMgQVBJIC0gc3ltYm9scyB3aXRoIGEgY2xhc3NpYyAoYnVuZGxlLmpzKSBjb25zdW1lciwgYW4gaW5saW5lIGhhbmRsZXIgaW5cbi8vIGluZGV4Lmh0bWwncyBzdGF0aWMgbWFya3VwLCBvciBhIHRlc3RzL3VpLyoucHkgcGFnZS5ldmFsdWF0ZS4gSW50ZXJuYWwgaGVscGVyc1xuLy8gKHJlLWFuYWx5emUvcmUtcnVuIGFjdGlvbnMsIHRoZSB0d28ga2ViYWIgb3BlbmVycywgZXRjLikgc3RheSBtb2R1bGUtcHJpdmF0ZSAtXG4vLyBzZWUgbWFpbi5lc20uanMgZm9yIHdoYXQgZWFjaCBzdXJ2aXZpbmcgbmFtZSBoZXJlIHN0aWxsIG5lZWRzIGl0IGZvci5cbmV4cG9ydCB7XG4gIGxvYWRWaWRlb3MsIHNlbGVjdFZpZGVvLCByZW5kZXJWaWRlb0RldGFpbCwgZGVsZXRlVmlkZW8sXG4gIG9uQ2xpcHNTb3J0Q2hhbmdlLCBfY2xpcHNTb3J0UGFyYW0sIF9jbGlwc0xpc3RVcmwsXG4gIF9yZWFuYWx5emVQYXJhbXMsXG4gIF9uZWVkc01vZGVsQ3RhSFRNTCxcbiAgX3VwZGF0ZURlbW9CdXR0b24sIF91cGRhdGVTdGFydEluZ2VzdEJ1dHRvbixcbiAgX2FuYWx5c2lzTGl2ZVBhbmVsSFRNTCwgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCxcbiAgX2FwcGx5VmlkZW9GaWx0ZXJzLCBfcmVuZGVyVmlkZW9MaXN0LFxuICBzZXRWaWRlb1NlYXJjaCwgc2V0VmlkZW9Tb3J0LCB0b2dnbGVWaWRlb1NvcnREaXIsIHRvZ2dsZVZpZGVvRmlsdGVyLFxuICBvcGVuVmlkZW9BY3Rpb25zTW9kYWwsXG59O1xuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBfaGFuZGxlRGV0YWlsQ2xpY2spO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RldGFpbCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIF9oYW5kbGVEZXRhaWxDaGFuZ2UpO1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUmVjb3JkaW5nIGRldGFpbDogc2Vzc2lvbiB0aW1lbGluZSBnZW5lcmF0aW9uIChjb2RlOiB2aWRlbyAvIFZpZGVvKS5cbi8vIEV4dHJhY3RlZCBvdXQgb2YgdmlkZW9zLmpzICh3aGljaCBncmV3IGludG8gYSBjYXRjaC1hbGwpIC0gdGhlIGxpc3QvZmlsdGVyL1xuLy8gZGV0YWlsLXJlbmRlci9yZS1hbmFseXNpcyBjb3JlIHN0YXlzIHRoZXJlOyBfbmVlZHNNb2RlbEN0YUhUTUwgaXMgc2hhcmVkIHdpdGhcbi8vIHRoZSBzdW1tYXJ5IGZlYXR1cmUgYW5kIHN0YXlzIGluIHZpZGVvcy5qcyBjb3JlIHRvby5cbi8vICAgQVBJOiByb3V0ZXMvdmlkZW9zLnB5ICh0aW1lbGluZSBTU0UpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3ZpZGVvLnB5LCB0ZXN0cy9pbnRlZ3JhdGlvbi90ZXN0X3Njb3Jpbmdfcm91dGVzLnB5XG5cbmltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBlc2NIdG1sLCBwbHVyYWwsIF9wYXJzZUludGVydmFsUyB9IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IHNob3dUb2FzdCB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHtcbiAgX29wZW5TU0UsIF9zZXRBY3RpdmVTdHJlYW0sIF9jbGVhckFjdGl2ZVN0cmVhbSwgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSwgX2Jsb2NrZWRCeUFuYWx5emUsXG59IGZyb20gJy4vam9icy5qcyc7XG5pbXBvcnQgeyBfbmVlZHNNb2RlbEN0YUhUTUwgfSBmcm9tICcuL3ZpZGVvcy5qcyc7XG5cbi8vIOKUgOKUgCB0aW1lbGluZSByZW5kZXIgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmV4cG9ydCBmdW5jdGlvbiBfcmVuZGVyVGltZWxpbmVIVE1MKGVudHJpZXMpIHtcbiAgaWYgKCFlbnRyaWVzIHx8ICFlbnRyaWVzLmxlbmd0aCkgcmV0dXJuICcnO1xuICBjb25zdCByb3dzID0gZW50cmllcy5tYXAoZSA9PlxuICAgIGA8ZGl2IGNsYXNzPVwidGltZWxpbmUtZW50cnlcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJ0aW1lbGluZS1zdGFtcFwiPiR7ZXNjSHRtbChlLnN0YXJ0X2htcyl9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwidGltZWxpbmUtdGV4dFwiPiR7ZXNjSHRtbChlLnRleHQpfTwvZGl2PlxuICAgIDwvZGl2PmBcbiAgKS5qb2luKCcnKTtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwidGltZWxpbmVcIj4ke3Jvd3N9PC9kaXY+YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF90aW1lbGluZUVtcHR5Tm90ZUhUTUwoKSB7XG4gIHJldHVybiBgPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTJweFwiPk5vIHRpbWVsaW5lIHlldCAtIGdlbmVyYXRlIGEgdGltZS1zdGFtcGVkIG91dGxpbmUgb2YgdGhlIHNlc3Npb24uPC9kaXY+YDtcbn1cblxuLy8g4pSA4pSAIHRpbWVsaW5lIGdlbmVyYXRpb24g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX3RpbWVsaW5lVmlkZW9JZCA9IG51bGw7XG5sZXQgX3RpbWVsaW5lSW50ZXJ2YWxPcGVuZXIgPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVUaW1lbGluZShpZCkge1xuICBfdGltZWxpbmVJbnRlcnZhbE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIF90aW1lbGluZVZpZGVvSWQgPSBpZDtcbiAgY29uc3QgdmlkZW8gPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IGlkKTtcbiAgX2xvYWRUaW1lbGluZUludGVydmFsQ29uZmlnKCkudGhlbigoKSA9PiB7XG4gICAgdXBkYXRlVGltZWxpbmVJbnRlcnZhbEhpbnQodmlkZW8pO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC12YWx1ZScpPy5mb2N1cygpLCA1MCk7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX3RpbWVsaW5lSW50ZXJ2YWxPcGVuZXI7XG4gIF90aW1lbGluZUludGVydmFsT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfbG9hZFRpbWVsaW5lSW50ZXJ2YWxDb25maWcoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvY29uZmlnJyk7XG4gICAgaWYgKCFyZXMub2spIHJldHVybjtcbiAgICBjb25zdCBjZmcgPSBhd2FpdCByZXMuanNvbigpO1xuICAgIGNvbnN0IHZhbCA9IGNmZy51aV90aW1lbGluZV9pbnRlcnZhbF9zZWNvbmRzIHx8IDkwMDtcbiAgICBjb25zdCB1bml0ID0gY2ZnLnVpX3RpbWVsaW5lX2ludGVydmFsX3VuaXQgfHwgJ21pbnV0ZXMnO1xuICAgIGlmICh1bml0ID09PSAnbWludXRlcycpIHtcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC12YWx1ZScpLnZhbHVlID0gTWF0aC5yb3VuZCh2YWwgLyA2MCk7XG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdW5pdCcpLnZhbHVlID0gJ21pbnV0ZXMnO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdmFsdWUnKS52YWx1ZSA9IHZhbDtcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC11bml0JykudmFsdWUgPSAnc2Vjb25kcyc7XG4gICAgfVxuICB9IGNhdGNoIChfKSB7fVxufVxuXG5mdW5jdGlvbiB1cGRhdGVUaW1lbGluZUludGVydmFsSGludCh2aWRlbykge1xuICB2aWRlbyA9IHZpZGVvIHx8IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gX3RpbWVsaW5lVmlkZW9JZCk7XG4gIGNvbnN0IHZhbCA9IHBhcnNlSW50KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC12YWx1ZScpLnZhbHVlLCAxMCkgfHwgMTtcbiAgY29uc3QgdW5pdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC11bml0JykudmFsdWU7XG4gIGNvbnN0IGludGVydmFsUyA9IHVuaXQgPT09ICdtaW51dGVzJyA/IHZhbCAqIDYwIDogdmFsO1xuICBjb25zdCBoaW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVsaW5lLWludGVydmFsLWhpbnQnKTtcbiAgY29uc3QgZ2VuQnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RpbWVsaW5lLWludGVydmFsLW1vZGFsIC5idG4ucHJpbWFyeScpO1xuICBpZiAoaW50ZXJ2YWxTIDwgMTApIHtcbiAgICBoaW50LnRleHRDb250ZW50ID0gJ01pbmltdW0gaW50ZXJ2YWwgaXMgMTAgc2Vjb25kcy4nO1xuICAgIGhpbnQuc3R5bGUuY29sb3IgPSAndmFyKC0tcmVkKSc7XG4gICAgaWYgKGdlbkJ0bikgZ2VuQnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGdlbkJ0bikgZ2VuQnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIGhpbnQuc3R5bGUuY29sb3IgPSAndmFyKC0tbXV0ZWQpJztcbiAgaWYgKHZpZGVvICYmIHZpZGVvLmR1cmF0aW9uX21zKSB7XG4gICAgY29uc3QgZHVyID0gdmlkZW8uZHVyYXRpb25fbXMgLyAxMDAwO1xuICAgIGNvbnN0IGR1ck1pbiA9IE1hdGgucm91bmQoZHVyIC8gNjApO1xuICAgIGNvbnN0IGVudHJpZXMgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwoZHVyIC8gaW50ZXJ2YWxTKSk7XG4gICAgaWYgKGludGVydmFsUyA+PSBkdXIpIHtcbiAgICAgIGhpbnQudGV4dENvbnRlbnQgPSBgUmVjb3JkaW5nIGlzICR7ZHVyTWlufSBtaW4gLSB0aGlzIHByb2R1Y2VzIDEgZW50cnkgY292ZXJpbmcgdGhlIHdob2xlIHNlc3Npb24uYDtcbiAgICB9IGVsc2Uge1xuICAgICAgaGludC50ZXh0Q29udGVudCA9IGBSZWNvcmRpbmcgaXMgJHtkdXJNaW59IG1pbiAtIHByb2R1Y2VzIH4ke3BsdXJhbChlbnRyaWVzLCAnZW50cnknLCAnZW50cmllcycpfS5gO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBoaW50LnRleHRDb250ZW50ID0gJyc7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY29uZmlybUdlbmVyYXRlVGltZWxpbmUoKSB7XG4gIGNvbnN0IHVuaXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdW5pdCcpLnZhbHVlO1xuICBjb25zdCBuID0gcGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVsaW5lLWludGVydmFsLXZhbHVlJykudmFsdWUsIDEwKTtcbiAgY29uc3QgaW50ZXJ2YWxTID0gX3BhcnNlSW50ZXJ2YWxTKG4gfHwgMTUsIHVuaXQpO1xuICBpZiAoaW50ZXJ2YWxTID09PSBudWxsKSByZXR1cm47XG5cbiAgZmV0Y2goJy9hcGkvY29uZmlnJywge1xuICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3VpX3RpbWVsaW5lX2ludGVydmFsX3NlY29uZHM6IGludGVydmFsUywgdWlfdGltZWxpbmVfaW50ZXJ2YWxfdW5pdDogdW5pdH0pLFxuICB9KS5jYXRjaCgoKSA9PiB7fSk7XG5cbiAgY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKTtcbiAgX3N0YXJ0R2VuZXJhdGVUaW1lbGluZShfdGltZWxpbmVWaWRlb0lkLCBpbnRlcnZhbFMpO1xufVxuXG5mdW5jdGlvbiBfc3RhcnRHZW5lcmF0ZVRpbWVsaW5lKGlkLCBpbnRlcnZhbFMpIHtcbiAgaWYgKF9ibG9ja2VkQnlBbmFseXplKCdnZW5lcmF0ZSBhIHRpbWVsaW5lJykpIHJldHVybjtcbiAgY29uc3Qgc2VjdGlvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1zZWN0aW9uJyk7XG4gIGNvbnN0IGludGVydmFsTGFiZWwgPSBpbnRlcnZhbFMgPj0gNjBcbiAgICA/IGAke01hdGgucm91bmQoaW50ZXJ2YWxTIC8gNjApfS1taW51dGVgXG4gICAgOiBgJHtpbnRlcnZhbFN9LXNlY29uZGA7XG4gIHNlY3Rpb24uaW5uZXJIVE1MID0gYDxkaXYgc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHg7cGFkZGluZzo0cHggMFwiPkdlbmVyYXRpbmcgdGltZWxpbmUgLSBlbnRyaWVzIHdpbGwgYXBwZWFyIGFzIGVhY2ggJHtpbnRlcnZhbExhYmVsfSB3aW5kb3cgY29tcGxldGVz4oCmPC9kaXY+YDtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1nZW5lcmF0ZS10aW1lbGluZScpO1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICBidG4udGV4dENvbnRlbnQgPSAnR2VuZXJhdGluZyBUaW1lbGluZeKApic7XG5cbiAgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpO1xuICBjb25zdCByZXNldEJ0biA9ICgpID0+IHtcbiAgICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IHZpZGVvPy5oYXNfdGltZWxpbmUgPyAnUmVnZW5lcmF0ZSBUaW1lbGluZScgOiAnR2VuZXJhdGUgVGltZWxpbmUnO1xuICB9O1xuICBsZXQgZmlyc3RFbnRyeSA9IHRydWU7XG4gIGxldCBuZWVkc01vZGVsID0gZmFsc2U7XG5cbiAgY29uc3QgaGFuZGxlID0gX29wZW5TU0UoXG4gICAgYC9hcGkvdmlkZW9zLyR7aWR9L3RpbWVsaW5lP2ludGVydmFsX3M9JHtpbnRlcnZhbFN9YCxcbiAgICBkYXRhID0+IHtcbiAgICAgIGlmIChkYXRhICYmIGRhdGEubmVlZHNfbW9kZWwpIHtcbiAgICAgICAgbmVlZHNNb2RlbCA9IHRydWU7XG4gICAgICAgIHNlY3Rpb24uaW5uZXJIVE1MID0gX25lZWRzTW9kZWxDdGFIVE1MKGRhdGEpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoZmlyc3RFbnRyeSkge1xuICAgICAgICBzZWN0aW9uLmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwidGltZWxpbmVcIiBpZD1cInRpbWVsaW5lLWxpc3RcIj48L2Rpdj5gO1xuICAgICAgICBmaXJzdEVudHJ5ID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHJvdy5jbGFzc05hbWUgPSAndGltZWxpbmUtZW50cnknO1xuICAgICAgcm93LmlubmVySFRNTCA9IGBcbiAgICAgICAgPGRpdiBjbGFzcz1cInRpbWVsaW5lLXN0YW1wXCI+JHtlc2NIdG1sKGRhdGEuc3RhcnRfaG1zKX08L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRpbWVsaW5lLXRleHRcIj4ke2VzY0h0bWwoZGF0YS50ZXh0KX08L2Rpdj5gO1xuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVsaW5lLWxpc3QnKS5hcHBlbmRDaGlsZChyb3cpO1xuICAgIH0sXG4gICAgKCkgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICByZXNldEJ0bigpO1xuICAgICAgaWYgKG5lZWRzTW9kZWwpIHJldHVybjtcbiAgICAgIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gICAgICBpZiAodmlkZW8pIHZpZGVvLmhhc190aW1lbGluZSA9IHRydWU7XG4gICAgICBzaG93VG9hc3QoJ1RpbWVsaW5lIGdlbmVyYXRlZCcpO1xuICAgIH0sXG4gICAgZXJyTXNnID0+IHtcbiAgICAgIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpO1xuICAgICAgcmVzZXRCdG4oKTtcbiAgICAgIC8vIEEgZmFpbGVkIHJlZ2VuZXJhdGUgbGVhdmVzIHRoZSBzdG9yZWQgdGltZWxpbmUgaW50YWN0IHNlcnZlci1zaWRlLCBzb1xuICAgICAgLy8gZG9uJ3QgY2xhaW0gXCJObyB0aW1lbGluZSB5ZXRcIiAtIGxlYXZlIHRoZSBzZWN0aW9uIGJsYW5rIGluc3RlYWQuXG4gICAgICBpZiAoZmlyc3RFbnRyeSkge1xuICAgICAgICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICAgICAgICBzZWN0aW9uLmlubmVySFRNTCA9IHZpZGVvPy5oYXNfdGltZWxpbmUgPyAnJyA6IF90aW1lbGluZUVtcHR5Tm90ZUhUTUwoKTtcbiAgICAgIH1cbiAgICAgIHNob3dUb2FzdChgVGltZWxpbmUgZ2VuZXJhdGlvbiBmYWlsZWQgLSAke2Vyck1zZ31gLCAnZXJyb3InKTtcbiAgICB9LFxuICApO1xuICBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgcmVzZXRCdG4pO1xufVxuXG4vLyDilIDilIAgc3RhdGljIG1vZGFsIHdpcmluZyAocmVwbGFjZXMgdGhlIGlubGluZSBvbmNsaWNrPS9vbmlucHV0PS9vbmNoYW5nZT0gdGhpc1xuLy8gbW9kdWxlIHVzZWQgdG8gb3duIGluIGluZGV4Lmh0bWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gdGltZWxpbmUtaW50ZXJ2YWwtbW9kYWwgaXMgYSBmaXhlZCwgbmV2ZXItcmVjcmVhdGVkIGVsZW1lbnQgaW4gaW5kZXguaHRtbCwgc29cbi8vIHdpcmluZyBpdCBvbmNlIGF0IG1vZHVsZSBsb2FkIChiZWxvdykgY2FuJ3QgZG91YmxlLWZpcmUgb24gYSByZS1yZW5kZXIuXG5mdW5jdGlvbiBfd2lyZVRpbWVsaW5lTW9kYWwoKSB7XG4gIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVsaW5lLWludGVydmFsLW1vZGFsJyk7XG4gIG1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7IGlmIChlLnRhcmdldCA9PT0gbW9kYWwpIGNsb3NlVGltZWxpbmVJbnRlcnZhbE1vZGFsKCk7IH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtY2FuY2VsLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC1nZW5lcmF0ZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNvbmZpcm1HZW5lcmF0ZVRpbWVsaW5lKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdmFsdWUnKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHVwZGF0ZVRpbWVsaW5lSW50ZXJ2YWxIaW50KCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdW5pdCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHVwZGF0ZVRpbWVsaW5lSW50ZXJ2YWxIaW50KCkpO1xufVxuXG5fd2lyZVRpbWVsaW5lTW9kYWwoKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFJlY29yZGluZyBkZXRhaWw6IHNlc3Npb24gdGl0bGUgKyBzdW1tYXJ5IGdlbmVyYXRpb24gKGNvZGU6XG4vLyB2aWRlbyAvIFZpZGVvKS4gRXh0cmFjdGVkIG91dCBvZiB2aWRlb3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLVxuLy8gdGhlIGxpc3QvZmlsdGVyL2RldGFpbC1yZW5kZXIvcmUtYW5hbHlzaXMgY29yZSBzdGF5cyB0aGVyZS5cbi8vICAgQVBJOiByb3V0ZXMvdmlkZW9zLnB5IChzdW1tYXJpemUsIHJlZ2VuZXJhdGUtc3VtbWFyeSwgZmllbGRzKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV92aWRlby5weVxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IGZvcm1hdEFwaUVycm9yIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xuaW1wb3J0IHsgb3BlbkRpZmZNb2RhbCwgc2hvd0NvbmZpcm0gfSBmcm9tICcuL3VpLmpzJztcbmltcG9ydCB7IHNob3dUb2FzdCwgb3BlbkxvZywgYXBwZW5kTG9nIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBfb3BlblNTRSwgX3NldEFjdGl2ZVN0cmVhbSwgX2NsZWFyQWN0aXZlU3RyZWFtLCBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtLCBfYmxvY2tlZEJ5QW5hbHl6ZSB9IGZyb20gJy4vam9icy5qcyc7XG5pbXBvcnQgeyBsb2FkVmlkZW9zLCByZW5kZXJWaWRlb0RldGFpbCwgX25lZWRzTW9kZWxDdGFIVE1MIH0gZnJvbSAnLi92aWRlb3MuanMnO1xuLy8g4pSA4pSAIHZpZGVvIHN1bW1hcnkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5hc3luYyBmdW5jdGlvbiBzdW1tYXJpemVWaWRlbyhpZCwgYnRuKSB7XG4gIGNvbnN0IGFjdGlvbkJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tc3VtbWFyaXplLXZpZGVvJykgfHwgYnRuO1xuICBpZiAoYWN0aW9uQnRuICYmIGFjdGlvbkJ0bi5kaXNhYmxlZCkgcmV0dXJuO1xuICBjb25zdCBvcmlnID0gYWN0aW9uQnRuID8gYWN0aW9uQnRuLnRleHRDb250ZW50IDogJyc7XG4gIGlmIChhY3Rpb25CdG4pIHsgYWN0aW9uQnRuLmRpc2FibGVkID0gdHJ1ZTsgYWN0aW9uQnRuLnRleHRDb250ZW50ID0gJ0dlbmVyYXRpbmcgU3VtbWFyeeKApic7IH1cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHtpZH0vc3VtbWFyaXplYCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIGNvbnN0IGVyciA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0QXBpRXJyb3IoZXJyKSk7XG4gICAgfVxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpO1xuICAgIGlmIChkYXRhLm5lZWRzX21vZGVsKSB7XG4gICAgICBjb25zdCBib2R5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1bW1hcnktYm9keScpO1xuICAgICAgaWYgKGJvZHkpIGJvZHkuaW5uZXJIVE1MID0gX25lZWRzTW9kZWxDdGFIVE1MKGRhdGEpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBvcGVuRGlmZk1vZGFsKCdSZXZpZXcgR2VuZXJhdGVkIFN1bW1hcnknLCBbXG4gICAgICB7bGFiZWw6ICdUaXRsZScsICAgY3VycmVudDogZGF0YS50aXRsZV9jdXJyZW50LCAgIHByb3Bvc2VkOiBkYXRhLnRpdGxlX25ld30sXG4gICAgICB7bGFiZWw6ICdTdW1tYXJ5JywgY3VycmVudDogZGF0YS5zdW1tYXJ5X2N1cnJlbnQsIHByb3Bvc2VkOiBkYXRhLnN1bW1hcnlfbmV3fSxcbiAgICBdLCBhc3luYyAoYWN0aW9uLCBlZGl0ZWQpID0+IHtcbiAgICAgIGNvbnN0IHBhdGNoID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7aWR9L2ZpZWxkc2AsIHtcbiAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHthY3Rpb24sIGZpZWxkOiAnYm90aCcsIG5ld190aXRsZTogZWRpdGVkWzBdLCBuZXdfc3VtbWFyeTogZWRpdGVkWzFdfSksXG4gICAgICB9KTtcbiAgICAgIGlmICghcGF0Y2gub2spIHsgc2hvd1RvYXN0KCdTYXZlIGZhaWxlZCcsICdlcnJvcicpOyByZXR1cm47IH1cbiAgICAgIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgICAgIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gICAgICBpZiAodmlkZW8pIHJlbmRlclZpZGVvRGV0YWlsKHZpZGVvLCBudWxsKTtcbiAgICAgIHNob3dUb2FzdChhY3Rpb24gPT09ICdhY2NlcHRfbmV3JyA/ICdTdW1tYXJ5IGFjY2VwdGVkJyA6ICdTdW1tYXJ5IHNhdmVkIGFzIGVkaXQnKTtcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgc2hvd1RvYXN0KGBTdW1tYXJ5IGZhaWxlZDogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoYWN0aW9uQnRuKSB7IGFjdGlvbkJ0bi5kaXNhYmxlZCA9IGZhbHNlOyBhY3Rpb25CdG4udGV4dENvbnRlbnQgPSBvcmlnOyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnZW5TdW1tYXJ5QXV0byhpZCwgYnRuKSB7XG4gIHNob3dDb25maXJtKFxuICAgICdSZWdlbmVyYXRlIGFuZCBhdXRvLXNhdmU/JyxcbiAgICAnVGhlIGN1cnJlbnQgdGl0bGUgYW5kIHN1bW1hcnkgd2lsbCBiZSByZXBsYWNlZCB3aXRob3V0IGEgcmV2aWV3IHN0ZXAuIFRoaXMgY2Fubm90IGJlIHVuZG9uZS4nLFxuICAgICdSZWdlbmVyYXRlJyxcbiAgICAoKSA9PiBfZG9SZWdlblN1bW1hcnlBdXRvKGlkLCBidG4pLFxuICAgIHRydWUsXG4gICk7XG59XG5cbmZ1bmN0aW9uIF9kb1JlZ2VuU3VtbWFyeUF1dG8oaWQsIGJ0bikge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlZ2VuZXJhdGUgdGhlIHN1bW1hcnknKSkgcmV0dXJuO1xuICBjb25zdCBhY3Rpb25CdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXJlZ2VuLXN1bW1hcnknKSB8fCBidG47XG4gIGlmIChhY3Rpb25CdG4gJiYgYWN0aW9uQnRuLmRpc2FibGVkKSByZXR1cm47XG4gIGlmIChhY3Rpb25CdG4pIHsgYWN0aW9uQnRuLmRpc2FibGVkID0gdHJ1ZTsgYWN0aW9uQnRuLnRleHRDb250ZW50ID0gJ1JlZ2VuZXJhdGluZ+KApic7IH1cbiAgb3BlbkxvZygpO1xuICBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCk7XG4gIGNvbnN0IHJlc2V0QnRuID0gKCkgPT4geyBpZiAoYWN0aW9uQnRuKSB7IGFjdGlvbkJ0bi5kaXNhYmxlZCA9IGZhbHNlOyBhY3Rpb25CdG4udGV4dENvbnRlbnQgPSAnUmVnZW5lcmF0ZSAoYXV0by1zYXZlKSc7IH0gfTtcbiAgbGV0IGhhZEVycm9yID0gZmFsc2U7XG4gIGxldCBuZWVkc01vZGVsID0gZmFsc2U7XG4gIGNvbnN0IGhhbmRsZSA9IF9vcGVuU1NFKFxuICAgIGAvYXBpL3ZpZGVvcy8ke2lkfS9yZWdlbmVyYXRlLXN1bW1hcnlgLFxuICAgIGRhdGEgPT4ge1xuICAgICAgaWYgKGRhdGEgJiYgZGF0YS5uZWVkc19tb2RlbCkge1xuICAgICAgICBuZWVkc01vZGVsID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdW1tYXJ5LWJvZHknKTtcbiAgICAgICAgaWYgKGJvZHkpIGJvZHkuaW5uZXJIVE1MID0gX25lZWRzTW9kZWxDdGFIVE1MKGRhdGEpO1xuICAgICAgICBhcHBlbmRMb2coZGF0YS5kZXRhaWwpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnICYmIGRhdGEuc3RhcnRzV2l0aCgnW0Vycm9yJykpIGhhZEVycm9yID0gdHJ1ZTtcbiAgICAgIGFwcGVuZExvZyhTdHJpbmcoZGF0YSkpO1xuICAgIH0sXG4gICAgKCkgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICByZXNldEJ0bigpO1xuICAgICAgaWYgKG5lZWRzTW9kZWwpIHtcbiAgICAgICAgc2hvd1RvYXN0KCdJbnN0YWxsIGEgbG9jYWwgbW9kZWwgdG8gZ2VuZXJhdGUgc3VtbWFyaWVzJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGhhZEVycm9yKSB7XG4gICAgICAgIHNob3dUb2FzdCgnU3VtbWFyeSBnZW5lcmF0aW9uIGZhaWxlZCAtIGNoZWNrIGxvZyBmb3IgZGV0YWlscycsICdlcnJvcicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBsb2FkVmlkZW9zKCkudGhlbigoKSA9PiB7XG4gICAgICAgIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gICAgICAgIGlmICh2aWRlbyAmJiBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID09PSBpZCkgcmVuZGVyVmlkZW9EZXRhaWwodmlkZW8sIG51bGwpO1xuICAgICAgfSk7XG4gICAgICBzaG93VG9hc3QoJ1N1bW1hcnkgcmVnZW5lcmF0ZWQnKTtcbiAgICB9LFxuICAgIGVyck1zZyA9PiB7XG4gICAgICBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKTtcbiAgICAgIHJlc2V0QnRuKCk7XG4gICAgICBzaG93VG9hc3QoYFN1bW1hcnkgZ2VuZXJhdGlvbiBmYWlsZWQgLSAke2Vyck1zZ31gLCAnZXJyb3InKTtcbiAgICB9LFxuICApO1xuICBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgcmVzZXRCdG4pO1xufVxuXG5leHBvcnQgeyBzdW1tYXJpemVWaWRlbywgcmVnZW5TdW1tYXJ5QXV0byB9O1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUmVjb3JkaW5nIGRldGFpbDogbGFzdC1hbmFseXNpcyBydW4gbWV0YWRhdGEgY2FyZCAocGVyLXN0YWdlXHJcbi8vIHRpbWluZywgZWZmZWN0aXZlIHNldHRpbmdzLCBDUFUvR1BVIGRldmljZSkuIEV4dHJhY3RlZCBvdXQgb2YgdmlkZW9zLmpzXHJcbi8vICh3aGljaCBncmV3IGludG8gYSBjYXRjaC1hbGwpIC0gdGhlIGxpc3QvZmlsdGVyL2RldGFpbC1yZW5kZXIvcmUtYW5hbHlzaXNcclxuLy8gY29yZSBzdGF5cyB0aGVyZS5cclxuLy8gICBBUEk6IHJvdXRlcy92aWRlb3MucHkgKGFuYWx5emVfcnVuIGZpZWxkKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV92aWRlby5weVxyXG5pbXBvcnQgeyBlc2NIdG1sLCBfbXNUb0htcywgX2ZtdEFnbyB9IGZyb20gJy4vZm9ybWF0LmpzJztcclxuLy8g4pSA4pSAIGFuYWx5c2lzIHJ1biBtZXRhZGF0YSBjYXJkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBSZW5kZXJzIHRoZSBzdG9yZWQgcmVjb3JkIG9mIHRoZSBsYXN0IGFuYWx5emUgcnVuIChwZXItc3RhZ2UgdGltaW5nLCBlZmZlY3RpdmVcclxuLy8gc2V0dGluZ3MsIGFuZCBDUFUvR1BVIGRldmljZSkgc28gdGhlIGNyZWF0b3IgY2FuIGFuc3dlciBcImhvdyBsb25nIGRpZCB0aGlzXHJcbi8vIHRha2UsIHdoYXQgc2V0dGluZ3MsIGFuZCBkaWQgaXQgdXNlIG15IEdQVT9cIi5cclxuLy8gRGlzcGxheSBmaW5pc2hlZC1ydW4gc3RhZ2UgbmFtZXMgd2l0aCB0aGUgc2FtZSBsYWJlbHMgYXMgdGhlIGxpdmUgcHJvZ3Jlc3NcclxuLy8gYnViYmxlcyAoSU5HRVNUX1NURVBTKSwgc28gdGhlIFwiTGFzdCBhbmFseXNpc1wiIGNhcmQgcmVhZHMgY29uc2lzdGVudGx5IHdpdGhcclxuLy8gd2hhdCB0aGUgdXNlciB3YXRjaGVkIGR1cmluZyBhbmFseXNpcy4gQ292ZXJzIG5hbWVzIHN0b3JlZCBieSBvbGRlciBydW5zLlxyXG5jb25zdCBfU1RBR0VfTEFCRUwgPSB7XHJcbiAgJ0V4dHJhY3QgYXVkaW8nOiAgICdFeHRyYWN0JyxcclxuICAnR2VuZXJhdGUgY2xpcHMnOiAgJ0dlbmVyYXRlIENsaXBzJyxcclxuICAnSW1wb3J0IGNhcHRpb25zJzogJ1RyYW5zY3JpYmUnLFxyXG59O1xyXG5mdW5jdGlvbiBfc3RhZ2VMYWJlbChuYW1lKSB7IHJldHVybiBfU1RBR0VfTEFCRUxbbmFtZV0gfHwgbmFtZTsgfVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9ydW5UaW1pbmdMaW5lKHJ1bikge1xyXG4gIGNvbnN0IHRvdGFsSG1zID0gX21zVG9IbXMocnVuLmVsYXBzZWRfbXMgfHwgMCk7XHJcbiAgY29uc3Qgc3RhZ2VzID0gcnVuLnN0YWdlcyB8fCBbXTtcclxuICBjb25zdCBzdGFnZVN0ciA9IHN0YWdlcy5tYXAoc3QgPT4gYCR7X3N0YWdlTGFiZWwoc3QubmFtZSl9ICR7X21zVG9IbXMoKHN0LnNlY29uZHMgfHwgMCkgKiAxMDAwKX1gKS5qb2luKCcgwrcgJyk7XHJcbiAgcmV0dXJuIGBMYXN0IHJ1bjogJHt0b3RhbEhtc30gdG90YWwke3N0YWdlU3RyID8gYCAoJHtzdGFnZVN0cn0pYCA6ICcnfWA7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfcmVuZGVyUnVuTWV0YUNhcmQodmlkZW8pIHtcclxuICBjb25zdCBydW4gPSB2aWRlby5hbmFseXplX3J1bjtcclxuICBpZiAoIXJ1bikgcmV0dXJuICcnO1xyXG4gIGNvbnN0IHRvdGFsSG1zID0gX21zVG9IbXMocnVuLmVsYXBzZWRfbXMgfHwgMCk7XHJcbiAgY29uc3QgZGV2ID0gcnVuLmRldmljZSB8fCB7fTtcclxuICBjb25zdCBkZXZpY2VCYWRnZSA9IGRldi5oYXNfZ3B1XHJcbiAgICA/ICc8c3BhbiBjbGFzcz1cInJ1bi1tZXRhLWJhZGdlIGdwdVwiIHRpdGxlPVwiVXNlZCB0aGUgR1BVXCI+R1BVPC9zcGFuPidcclxuICAgIDogJzxzcGFuIGNsYXNzPVwicnVuLW1ldGEtYmFkZ2UgY3B1XCIgdGl0bGU9XCJSYW4gb24gQ1BVXCI+Q1BVPC9zcGFuPic7XHJcbiAgY29uc3Qgd2hlbiA9IHJ1bi5maW5pc2hlZF9hdCA/IGAgJm1pZGRvdDsgJHtlc2NIdG1sKF9mbXRBZ28ocnVuLmZpbmlzaGVkX2F0KSl9YCA6ICcnO1xyXG4gIHJldHVybiBgXHJcbiAgICA8ZGV0YWlscyBjbGFzcz1cImRldGFpbC1jYXJkIHJ1bi1tZXRhLWNhcmRcIj5cclxuICAgICAgPHN1bW1hcnkgY2xhc3M9XCJydW4tbWV0YS1zdW1tYXJ5XCI+TGFzdCBhbmFseXNpcyAmbWlkZG90OyA8c3Ryb25nPiR7dG90YWxIbXN9PC9zdHJvbmc+ICR7ZGV2aWNlQmFkZ2V9JHt3aGVufTwvc3VtbWFyeT5cclxuICAgICAgPGRpdiBjbGFzcz1cInJ1bi1tZXRhLWJvZHlcIj5cclxuICAgICAgICAke19ydW5TZXR0aW5nc1Jvd3MocnVuLnNldHRpbmdzIHx8IHt9LCBkZXYpfVxyXG4gICAgICAgICR7X3J1blN0YWdlQmFycyhydW4uc3RhZ2VzIHx8IFtdKX1cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2RldGFpbHM+YDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3J1blNldHRpbmdzUm93cyhzLCBkZXYpIHtcclxuICBjb25zdCB5ZXNObyA9ICh2KSA9PiB2ID8gJ09uJyA6ICdPZmYnO1xyXG4gIGNvbnN0IHJvd3MgPSBbXHJcbiAgICBbJ1doaXNwZXIgbW9kZWwnLCAgcy5tb2RlbF0sXHJcbiAgICBbJ1RyYWNrIGxheW91dCcsICAgcy50cmFja19sYXlvdXRdLFxyXG4gICAgWydDYXB0aW9ucycsICAgICAgIHMuY2FwdGlvbnNfc291cmNlXSxcclxuICAgIFsnU3BlYWtlciBsYWJlbHMnLCBzLnNwZWFrZXJfbGFiZWxzID09PSB1bmRlZmluZWQgPyBudWxsIDogeWVzTm8ocy5zcGVha2VyX2xhYmVscyldLFxyXG4gICAgWydFbmVyZ3kgbW9kZScsICAgIHMuZW5lcmd5X21vZGVdLFxyXG4gICAgWydTY2VuZSBtb2RlJywgICAgIHMuc2NlbmVfbW9kZV0sXHJcbiAgICBbJ0xMTSBzY29yaW5nJywgICAgcy5zY29yaW5nID09PSB1bmRlZmluZWQgPyBudWxsIDogeWVzTm8ocy5zY29yaW5nKV0sXHJcbiAgICBbJ1dvcmxkIGNvbnRleHRzJywgKHMuY29udGV4dHMgJiYgcy5jb250ZXh0cy5sZW5ndGgpID8gcy5jb250ZXh0cy5qb2luKCcsICcpIDogJ25vbmUnXSxcclxuICAgIFsnVHJhbnNjcmliZSBkZXZpY2UnLCBkZXYudHJhbnNjcmliZV0sXHJcbiAgICBbJ0RpYXJpemF0aW9uIGRldmljZScsIGRldi5kaWFyaXphdGlvbl0sXHJcbiAgXS5maWx0ZXIoKFssIHZdKSA9PiB2ICE9PSBudWxsICYmIHYgIT09IHVuZGVmaW5lZCAmJiB2ICE9PSAnJyk7XHJcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicnVuLW1ldGEtZ3JpZFwiPiR7cm93cy5tYXAoKFtrLCB2XSkgPT5cclxuICAgIGA8ZGl2IGNsYXNzPVwicnVuLW1ldGEta2V5XCI+JHtlc2NIdG1sKGspfTwvZGl2PjxkaXYgY2xhc3M9XCJydW4tbWV0YS12YWxcIj4ke2VzY0h0bWwoU3RyaW5nKHYpKX08L2Rpdj5gXHJcbiAgKS5qb2luKCcnKX08L2Rpdj5gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcnVuU3RhZ2VCYXJzKHN0YWdlcykge1xyXG4gIGlmICghc3RhZ2VzLmxlbmd0aCkgcmV0dXJuICcnO1xyXG4gIGNvbnN0IG1heFMgPSBNYXRoLm1heCguLi5zdGFnZXMubWFwKHN0ID0+IHN0LnNlY29uZHMgfHwgMCksIDAuMDAxKTtcclxuICBjb25zdCBiYXJzID0gc3RhZ2VzLm1hcChzdCA9PiB7XHJcbiAgICBjb25zdCBzZWNzID0gc3Quc2Vjb25kcyB8fCAwO1xyXG4gICAgY29uc3QgcGN0ID0gTWF0aC5tYXgoMiwgTWF0aC5yb3VuZChzZWNzIC8gbWF4UyAqIDEwMCkpO1xyXG4gICAgcmV0dXJuIGBcclxuICAgICAgPGRpdiBjbGFzcz1cInJ1bi1zdGFnZS1yb3dcIj5cclxuICAgICAgICA8c3BhbiBjbGFzcz1cInJ1bi1zdGFnZS1uYW1lXCI+JHtlc2NIdG1sKF9zdGFnZUxhYmVsKHN0Lm5hbWUpKX08L3NwYW4+XHJcbiAgICAgICAgPHNwYW4gY2xhc3M9XCJydW4tc3RhZ2UtdHJhY2tcIj48c3BhbiBjbGFzcz1cInJ1bi1zdGFnZS1maWxsXCIgc3R5bGU9XCJ3aWR0aDoke3BjdH0lXCI+PC9zcGFuPjwvc3Bhbj5cclxuICAgICAgICA8c3BhbiBjbGFzcz1cInJ1bi1zdGFnZS10aW1lXCI+JHtfbXNUb0htcyhzZWNzICogMTAwMCl9PC9zcGFuPlxyXG4gICAgICA8L2Rpdj5gO1xyXG4gIH0pLmpvaW4oJycpO1xyXG4gIHJldHVybiBgPGRpdiBjbGFzcz1cInJ1bi1zdGFnZS1iYXJzXCI+PGRpdiBjbGFzcz1cInJ1bi1tZXRhLXN1YnRpdGxlXCI+U3RhZ2UgdGltaW5nPC9kaXY+JHtiYXJzfTwvZGl2PmA7XHJcbn1cclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gU2Vzc2lvbiAoY29kZTogUmVjb3JkaW5nU2Vzc2lvbiAvIHNlc3Npb25faWQpLlxuLy8gICBBUEk6IHJvdXRlcy9zZXNzaW9ucy5weSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9zZXNzaW9ucy5weVxuLy8g4pSA4pSAIFNlc3Npb25zOiBzaWRlYmFyIGdyb3VwaW5nLCBhdXRvLXN1Z2dlc3QsIGFuZCB0aGUgc2Vzc2lvbiBkZXRhaWwgdmlldyDilIDilIDilIDilIDilIBcbi8vIEEgU2Vzc2lvbiBncm91cHMgdG9wLWxldmVsIHJlY29yZGluZ3MgZnJvbSBvbmUgcGxheSBzZXNzaW9uLiBUaGlzIG1vZHVsZSBvd25zXG4vLyB0aGUgc2lkZWJhciBncm91cCBoZWFkZXJzLCB0aGUgbWFudWFsIGdyb3VwaW5nIHNlbGVjdGlvbiBtb2RlLCB0aGUgc3VnZ2VzdFxuLy8gcHJvbXB0LCBhbmQgdGhlIHNlc3Npb24gZGV0YWlsIHZpZXcgKHJvbGx1cCBzdW1tYXJ5ICsgdW5pZmllZCB0aW1lbGluZSkuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgZXNjSHRtbCwgcGx1cmFsLCBfbXNUb0htcyB9IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IHNob3dUb2FzdCwgY29sbGFwc2libGVDYXJkLCBvcGVuTG9nIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBzaG93S2ViYWIsIHNob3dDb25maXJtIH0gZnJvbSAnLi91aS5qcyc7XG5pbXBvcnQgeyBzdHJlYW1TU0UgfSBmcm9tICcuL2pvYnMuanMnO1xuaW1wb3J0IHsgbG9hZFZpZGVvcywgc2VsZWN0VmlkZW8sIF9yZW5kZXJWaWRlb0xpc3QgfSBmcm9tICcuL3ZpZGVvcy5qcyc7XG5cbmNvbnN0IENPTExBUFNFX0tFWSA9ICd5dXVjbGlwLXNlc3Npb24tY29sbGFwc2VkJztcbmNvbnN0IERJU01JU1NfS0VZICA9ICd5dXVjbGlwLXNlc3Npb24tZGlzbWlzc2VkJztcblxuZnVuY3Rpb24gX2xvYWRJZFNldChrZXkpIHtcbiAgdHJ5IHsgcmV0dXJuIG5ldyBTZXQoSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8ICdbXScpKTsgfSBjYXRjaCB7IHJldHVybiBuZXcgU2V0KCk7IH1cbn1cbmZ1bmN0aW9uIF9zYXZlSWRTZXQoa2V5LCBzZXQpIHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShbLi4uc2V0XSkpOyB9XG5cbmNvbnN0IFNlc3Npb25VSSA9IHtcbiAgc2VsZWN0aW9uTW9kZTogZmFsc2UsXG4gIHNlbGVjdGVkOiBuZXcgU2V0KCksICAgICAgICAgICAgICAgICAgICAgICAvLyB2aWRlbyBpZHMgcGlja2VkIHdoaWxlIGdyb3VwaW5nXG4gIGNvbGxhcHNlZDogX2xvYWRJZFNldChDT0xMQVBTRV9LRVkpLCAgICAgICAvLyBzZXNzaW9uIGlkcyBjb2xsYXBzZWQgaW4gdGhlIHNpZGViYXJcbiAgZGlzbWlzc2VkOiBfbG9hZElkU2V0KERJU01JU1NfS0VZKSwgICAgICAgIC8vIGRpc21pc3NlZCBzdWdnZXN0aW9uIGdyb3VwIGtleXNcbn07XG5cbmZ1bmN0aW9uIF9zZXNzaW9uQnlJZChpZCkgeyByZXR1cm4gKEFwcFN0YXRlLnNlc3Npb25zIHx8IFtdKS5maW5kKHMgPT4gcy5pZCA9PT0gaWQpOyB9XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRTZXNzaW9ucygpIHtcbiAgdHJ5IHtcbiAgICBBcHBTdGF0ZS5zZXNzaW9ucyA9IGF3YWl0IGZldGNoKCcvYXBpL3Nlc3Npb25zJykudGhlbihyID0+IHIuanNvbigpKTtcbiAgfSBjYXRjaCB7IEFwcFN0YXRlLnNlc3Npb25zID0gW107IH1cbiAgX3JlbmRlclZpZGVvTGlzdCgpO1xufVxuXG4vLyDilIDilIAgc2lkZWJhciBncm91cCBoZWFkZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBpc1Nlc3Npb25Db2xsYXBzZWQoaWQpIHsgcmV0dXJuIFNlc3Npb25VSS5jb2xsYXBzZWQuaGFzKGlkKTsgfVxuXG5mdW5jdGlvbiB0b2dnbGVTZXNzaW9uQ29sbGFwc2UoaWQpIHtcbiAgaWYgKFNlc3Npb25VSS5jb2xsYXBzZWQuaGFzKGlkKSkgU2Vzc2lvblVJLmNvbGxhcHNlZC5kZWxldGUoaWQpO1xuICBlbHNlIFNlc3Npb25VSS5jb2xsYXBzZWQuYWRkKGlkKTtcbiAgX3NhdmVJZFNldChDT0xMQVBTRV9LRVksIFNlc3Npb25VSS5jb2xsYXBzZWQpO1xuICBfcmVuZGVyVmlkZW9MaXN0KCk7XG59XG5cbmZ1bmN0aW9uIHNlc3Npb25Hcm91cEhlYWRlckxpKHNlc3Npb24sIHNob3duQ291bnQpIHtcbiAgY29uc3QgY29sbGFwc2VkID0gaXNTZXNzaW9uQ29sbGFwc2VkKHNlc3Npb24uaWQpO1xuICBjb25zdCBsYWJlbCA9IHNlc3Npb24ubmFtZSB8fCBzZXNzaW9uLnRpdGxlIHx8ICdTZXNzaW9uJztcbiAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICBsaS5jbGFzc05hbWUgPSAnc2Vzc2lvbi1oZWFkZXInICsgKEFwcFN0YXRlLmFjdGl2ZVNlc3Npb25JZCA9PT0gc2Vzc2lvbi5pZCA/ICcgYWN0aXZlJyA6ICcnKTtcbiAgbGkuZGF0YXNldC5zZXNzaW9uSWQgPSBzZXNzaW9uLmlkO1xuICBsaS5pbm5lckhUTUwgPSBgXG4gICAgPGJ1dHRvbiBjbGFzcz1cInNlc3Npb24tY2FyZXRcIiBhcmlhLWxhYmVsPVwiJHtjb2xsYXBzZWQgPyAnRXhwYW5kJyA6ICdDb2xsYXBzZSd9IHNlc3Npb25cIiBhcmlhLWV4cGFuZGVkPVwiJHtjb2xsYXBzZWQgPyAnZmFsc2UnIDogJ3RydWUnfVwiPiR7Y29sbGFwc2VkID8gJyYjOTY1NjsnIDogJyYjOTY2MjsnfTwvYnV0dG9uPlxuICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLWhlYWRlci1sYWJlbFwiIHJvbGU9XCJidXR0b25cIiB0YWJpbmRleD1cIjBcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLW5hbWVcIj4mIzEyNzkwMjsgJHtlc2NIdG1sKGxhYmVsKX08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtZXRhXCI+JHtwbHVyYWwoc2hvd25Db3VudCwgJ3JlY29yZGluZycpfTwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxidXR0b24gY2xhc3M9XCJrZWJhYi1idG4gc2Vzc2lvbi1rZWJhYlwiIGFyaWEtbGFiZWw9XCJTZXNzaW9uIGFjdGlvbnNcIiB0aXRsZT1cIlNlc3Npb24gYWN0aW9uc1wiPiYjODk0Mjs8L2J1dHRvbj5gO1xuICBsaS5xdWVyeVNlbGVjdG9yKCcuc2Vzc2lvbi1jYXJldCcpLm9uY2xpY2sgPSBlID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdG9nZ2xlU2Vzc2lvbkNvbGxhcHNlKHNlc3Npb24uaWQpOyB9O1xuICBjb25zdCBsYWJlbEVsID0gbGkucXVlcnlTZWxlY3RvcignLnNlc3Npb24taGVhZGVyLWxhYmVsJyk7XG4gIGxhYmVsRWwub25jbGljayA9IGUgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBzZWxlY3RTZXNzaW9uKHNlc3Npb24uaWQpOyB9O1xuICBsYWJlbEVsLm9ua2V5ZG93biA9IGUgPT4geyBpZiAoZS5rZXkgPT09ICdFbnRlcicgfHwgZS5rZXkgPT09ICcgJykgeyBlLnByZXZlbnREZWZhdWx0KCk7IHNlbGVjdFNlc3Npb24oc2Vzc2lvbi5pZCk7IH0gfTtcbiAgbGkucXVlcnlTZWxlY3RvcignLnNlc3Npb24ta2ViYWInKS5vbmNsaWNrID0gZSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IF9vcGVuU2Vzc2lvbk1lbnUoc2Vzc2lvbi5pZCwgZS5jdXJyZW50VGFyZ2V0KTsgfTtcbiAgcmV0dXJuIGxpO1xufVxuXG5mdW5jdGlvbiBfb3BlblNlc3Npb25NZW51KHNlc3Npb25JZCwgYW5jaG9yKSB7XG4gIGNvbnN0IHNlc3Npb24gPSBfc2Vzc2lvbkJ5SWQoc2Vzc2lvbklkKTtcbiAgaWYgKCFzZXNzaW9uKSByZXR1cm47XG4gIHNob3dLZWJhYihhbmNob3IsIFtcbiAgICB7IGxhYmVsOiAnT3BlbiBzZXNzaW9uJywgYWN0aW9uOiAoKSA9PiBzZWxlY3RTZXNzaW9uKHNlc3Npb25JZCkgfSxcbiAgICB7IGxhYmVsOiAnUmVuYW1l4oCmJywgYWN0aW9uOiAoKSA9PiBfcmVuYW1lU2Vzc2lvbihzZXNzaW9uSWQpIH0sXG4gICAgeyBsYWJlbDogJ0FkZCByZWNvcmRpbmdz4oCmJywgYWN0aW9uOiAoKSA9PiB7IGVudGVyR3JvdXBpbmdNb2RlKHNlc3Npb25JZCk7IH0gfSxcbiAgICBudWxsLFxuICAgIHsgbGFiZWw6ICdVbmdyb3VwIChkaXNzb2x2ZSknLCBhY3Rpb246ICgpID0+IF9kaXNzb2x2ZVNlc3Npb24oc2Vzc2lvbklkKSB9LFxuICBdKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX3JlbmFtZVNlc3Npb24oc2Vzc2lvbklkKSB7XG4gIGNvbnN0IHNlc3Npb24gPSBfc2Vzc2lvbkJ5SWQoc2Vzc2lvbklkKTtcbiAgaWYgKCFzZXNzaW9uKSByZXR1cm47XG4gIGNvbnN0IG5hbWUgPSBhd2FpdCBfcHJvbXB0VGV4dCgnUmVuYW1lIHNlc3Npb24nLCAnU2Vzc2lvbiBuYW1lJywgc2Vzc2lvbi5uYW1lIHx8ICcnKTtcbiAgaWYgKG5hbWUgPT09IG51bGwpIHJldHVybjtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvc2Vzc2lvbnMvJHtzZXNzaW9uSWR9YCwge1xuICAgIG1ldGhvZDogJ1BBVENIJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtuYW1lfSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgeyBzaG93VG9hc3QoJ0NvdWxkIG5vdCByZW5hbWUgc2Vzc2lvbicsICdlcnJvcicpOyByZXR1cm47IH1cbiAgYXdhaXQgbG9hZFNlc3Npb25zKCk7XG4gIGlmIChBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPT09IHNlc3Npb25JZCkgc2VsZWN0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICBzaG93VG9hc3QoJ1Nlc3Npb24gcmVuYW1lZCcpO1xufVxuXG5mdW5jdGlvbiBfZGlzc29sdmVTZXNzaW9uKHNlc3Npb25JZCkge1xuICBjb25zdCBzZXNzaW9uID0gX3Nlc3Npb25CeUlkKHNlc3Npb25JZCk7XG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xuICBzaG93Q29uZmlybShcbiAgICAnVW5ncm91cCB0aGlzIHNlc3Npb24/JyxcbiAgICBgVGhlICR7cGx1cmFsKHNlc3Npb24ubWVtYmVyX2NvdW50LCAncmVjb3JkaW5nJyl9IHN0YXkgLSB0aGV5IGFyZSBqdXN0IG5vIGxvbmdlciBncm91cGVkIGFzIGEgc2Vzc2lvbi4gVGhpcyBjYW5ub3QgZ3JvdXAgdGhlbSBiYWNrIGF1dG9tYXRpY2FsbHkuYCxcbiAgICAnVW5ncm91cCcsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvc2Vzc2lvbnMvJHtzZXNzaW9uSWR9YCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgICAgIGlmICghcmVzLm9rKSB7IHNob3dUb2FzdCgnQ291bGQgbm90IHVuZ3JvdXAgc2Vzc2lvbicsICdlcnJvcicpOyByZXR1cm47IH1cbiAgICAgIGlmIChBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPT09IHNlc3Npb25JZCkgeyBBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPSBudWxsOyBfc2hvd0VtcHR5U2Vzc2lvbkRldGFpbCgpOyB9XG4gICAgICBhd2FpdCBsb2FkU2Vzc2lvbnMoKTtcbiAgICAgIHNob3dUb2FzdCgnU2Vzc2lvbiB1bmdyb3VwZWQnKTtcbiAgICB9LFxuICAgIHRydWUsXG4gICk7XG59XG5cbi8vIOKUgOKUgCBtYW51YWwgZ3JvdXBpbmcgc2VsZWN0aW9uIG1vZGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBhZGRUb1Nlc3Npb25JZCBpcyBzZXQgd2hlbiBncm91cGluZyBmcm9tIGEgc2Vzc2lvbidzIFwiQWRkIHJlY29yZGluZ3PigKZcIiBhY3Rpb246XG4vLyB0aGUgcGlja2VkIHJlY29yZGluZ3MgYXJlIGFkZGVkIHRvIHRoYXQgc2Vzc2lvbiBpbnN0ZWFkIG9mIGNyZWF0aW5nIGEgbmV3IG9uZS5cbmxldCBfYWRkVG9TZXNzaW9uSWQgPSBudWxsO1xuXG5mdW5jdGlvbiBlbnRlckdyb3VwaW5nTW9kZShhZGRUb1Nlc3Npb25JZCA9IG51bGwpIHtcbiAgX2FkZFRvU2Vzc2lvbklkID0gdHlwZW9mIGFkZFRvU2Vzc2lvbklkID09PSAnbnVtYmVyJyA/IGFkZFRvU2Vzc2lvbklkIDogbnVsbDtcbiAgU2Vzc2lvblVJLnNlbGVjdGlvbk1vZGUgPSB0cnVlO1xuICBTZXNzaW9uVUkuc2VsZWN0ZWQgPSBuZXcgU2V0KCk7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbiAgX3N5bmNHcm91cGluZ0JhcigpO1xufVxuXG5mdW5jdGlvbiBleGl0R3JvdXBpbmdNb2RlKCkge1xuICBTZXNzaW9uVUkuc2VsZWN0aW9uTW9kZSA9IGZhbHNlO1xuICBTZXNzaW9uVUkuc2VsZWN0ZWQgPSBuZXcgU2V0KCk7XG4gIF9hZGRUb1Nlc3Npb25JZCA9IG51bGw7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbiAgX3N5bmNHcm91cGluZ0JhcigpO1xufVxuXG5mdW5jdGlvbiB0b2dnbGVHcm91cFNlbGVjdCh2aWRlb0lkKSB7XG4gIGlmIChTZXNzaW9uVUkuc2VsZWN0ZWQuaGFzKHZpZGVvSWQpKSBTZXNzaW9uVUkuc2VsZWN0ZWQuZGVsZXRlKHZpZGVvSWQpO1xuICBlbHNlIFNlc3Npb25VSS5zZWxlY3RlZC5hZGQodmlkZW9JZCk7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbiAgX3N5bmNHcm91cGluZ0JhcigpO1xufVxuXG5mdW5jdGlvbiBfc3luY0dyb3VwaW5nQmFyKCkge1xuICBjb25zdCBiYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2Vzc2lvbi1ncm91cGluZy1iYXInKTtcbiAgaWYgKCFiYXIpIHJldHVybjtcbiAgYmFyLnN0eWxlLmRpc3BsYXkgPSBTZXNzaW9uVUkuc2VsZWN0aW9uTW9kZSA/ICcnIDogJ25vbmUnO1xuICBjb25zdCBjb3VudCA9IFNlc3Npb25VSS5zZWxlY3RlZC5zaXplO1xuICBjb25zdCBjb3VudEVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Nlc3Npb24tZ3JvdXBpbmctY291bnQnKTtcbiAgaWYgKGNvdW50RWwpIGNvdW50RWwudGV4dENvbnRlbnQgPSBwbHVyYWwoY291bnQsICdzZWxlY3RlZCByZWNvcmRpbmcnKTtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jb25maXJtLWdyb3VwJyk7XG4gIGlmIChidG4pIHtcbiAgICBjb25zdCBtaW4gPSBfYWRkVG9TZXNzaW9uSWQgIT0gbnVsbCA/IDEgOiAyO1xuICAgIGJ0bi5kaXNhYmxlZCA9IGNvdW50IDwgbWluO1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IF9hZGRUb1Nlc3Npb25JZCAhPSBudWxsID8gJ0FkZCB0byBzZXNzaW9uJyA6ICdHcm91cCBhcyBzZXNzaW9uJztcbiAgfVxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXNzaW9uLWdyb3VwaW5nLWxhYmVsJyk7XG4gIGlmIChsYWJlbCkge1xuICAgIGxhYmVsLnRleHRDb250ZW50ID0gX2FkZFRvU2Vzc2lvbklkICE9IG51bGxcbiAgICAgID8gJ1BpY2sgcmVjb3JkaW5ncyB0byBhZGQgdG8gdGhpcyBzZXNzaW9uJ1xuICAgICAgOiAnUGljayAyKyByZWNvcmRpbmdzIHRvIGdyb3VwIGFzIGEgc2Vzc2lvbic7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY29uZmlybUdyb3VwU2VsZWN0aW9uKCkge1xuICBjb25zdCBpZHMgPSBbLi4uU2Vzc2lvblVJLnNlbGVjdGVkXTtcbiAgaWYgKF9hZGRUb1Nlc3Npb25JZCAhPSBudWxsKSB7XG4gICAgaWYgKCFpZHMubGVuZ3RoKSByZXR1cm47XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvc2Vzc2lvbnMvJHtfYWRkVG9TZXNzaW9uSWR9L21lbWJlcnNgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3ZpZGVvX2lkczogaWRzfSksXG4gICAgfSk7XG4gICAgaWYgKCFyZXMub2spIHsgc2hvd1RvYXN0KCdDb3VsZCBub3QgYWRkIHJlY29yZGluZ3MnLCAnZXJyb3InKTsgcmV0dXJuOyB9XG4gICAgY29uc3Qgc2lkID0gX2FkZFRvU2Vzc2lvbklkO1xuICAgIGV4aXRHcm91cGluZ01vZGUoKTtcbiAgICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gICAgc2hvd1RvYXN0KGBBZGRlZCAke3BsdXJhbChpZHMubGVuZ3RoLCAncmVjb3JkaW5nJyl9YCk7XG4gICAgaWYgKEFwcFN0YXRlLmFjdGl2ZVNlc3Npb25JZCA9PT0gc2lkKSBzZWxlY3RTZXNzaW9uKHNpZCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChpZHMubGVuZ3RoIDwgMikgcmV0dXJuO1xuICBjb25zdCBuYW1lID0gYXdhaXQgX3Byb21wdFRleHQoJ05hbWUgdGhpcyBzZXNzaW9uJywgJ1Nlc3Npb24gbmFtZSAob3B0aW9uYWwpJywgJycpO1xuICBpZiAobmFtZSA9PT0gbnVsbCkgcmV0dXJuOyAgIC8vIGNhbmNlbGxlZFxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2FwaS9zZXNzaW9ucycsIHtcbiAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtuYW1lLCB2aWRlb19pZHM6IGlkc30pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChlcnIuZGV0YWlsIHx8ICdDb3VsZCBub3QgY3JlYXRlIHNlc3Npb24nLCAnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gIGV4aXRHcm91cGluZ01vZGUoKTtcbiAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICBzaG93VG9hc3QoYEdyb3VwZWQgJHtwbHVyYWwoaWRzLmxlbmd0aCwgJ3JlY29yZGluZycpfSBpbnRvIGEgc2Vzc2lvbmApO1xuICBzZWxlY3RTZXNzaW9uKHNlc3Npb24uaWQpO1xufVxuXG4vLyDilIDilIAgYXV0by1zdWdnZXN0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gX2dyb3VwS2V5KGlkcykgeyByZXR1cm4gWy4uLmlkc10uc29ydCgoYSwgYikgPT4gYSAtIGIpLmpvaW4oJywnKTsgfVxuXG5hc3luYyBmdW5jdGlvbiBzdWdnZXN0U2Vzc2lvbnMoKSB7XG4gIGxldCBncm91cHM7XG4gIHRyeSB7XG4gICAgZ3JvdXBzID0gYXdhaXQgZmV0Y2goJy9hcGkvc2Vzc2lvbnMvc3VnZ2VzdGlvbnMnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICB9IGNhdGNoIHsgc2hvd1RvYXN0KCdDb3VsZCBub3QgbG9hZCBzdWdnZXN0aW9ucycsICdlcnJvcicpOyByZXR1cm47IH1cbiAgY29uc3QgZnJlc2ggPSBncm91cHMuZmlsdGVyKGcgPT4gIVNlc3Npb25VSS5kaXNtaXNzZWQuaGFzKF9ncm91cEtleShnLnZpZGVvX2lkcykpKTtcbiAgaWYgKCFmcmVzaC5sZW5ndGgpIHtcbiAgICBzaG93VG9hc3QoJ05vIG5ldyBzZXNzaW9uIHN1Z2dlc3Rpb25zIC0gcmVjb3JkaW5ncyBsb29rIHNlcGFyYXRlLicsICdpbmZvJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9zaG93U3VnZ2VzdGlvbk1vZGFsKGZyZXNoKTtcbn1cblxuZnVuY3Rpb24gb3BlblJlY29yZGluZ3NBY3Rpb25zTWVudShidG4pIHtcbiAgc2hvd0tlYmFiKGJ0biwgW1xuICAgIHsgbGFiZWw6ICdHcm91cCcsIGFjdGlvbjogKCkgPT4gZW50ZXJHcm91cGluZ01vZGUoKSB9LFxuICAgIHsgbGFiZWw6ICdTdWdnZXN0IHNlc3Npb25zJywgYWN0aW9uOiAoKSA9PiBzdWdnZXN0U2Vzc2lvbnMoKSB9LFxuICBdKTtcbn1cblxuZnVuY3Rpb24gX3Nob3dTdWdnZXN0aW9uTW9kYWwoZ3JvdXBzKSB7XG4gIGNvbnN0IGJnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGJnLmNsYXNzTmFtZSA9ICdtb2RhbC1iZyB2aXNpYmxlJztcbiAgY29uc3QgaXRlbXMgPSBncm91cHMubWFwKChnLCBpKSA9PiBgXG4gICAgPGRpdiBjbGFzcz1cInNlc3Npb24tc3VnZ2VzdGlvblwiIGRhdGEtaWR4PVwiJHtpfVwiPlxuICAgICAgPGRpdiBzdHlsZT1cImZsZXg6MTttaW4td2lkdGg6MFwiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC13ZWlnaHQ6NjAwO21hcmdpbi1ib3R0b206MnB4XCI+JHtwbHVyYWwoZy52aWRlb19pZHMubGVuZ3RoLCAncmVjb3JkaW5nJyl9IGxvb2sgbGlrZSBvbmUgc2Vzc2lvbjwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YVwiIHN0eWxlPVwid2hpdGUtc3BhY2U6bm9ybWFsXCI+JHtnLnRpdGxlcy5tYXAodCA9PiBlc2NIdG1sKHQpKS5qb2luKCcgwrcgJyl9PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjZweDtmbGV4LXNocmluazowXCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWFjdD1cImRpc21pc3NcIiBkYXRhLWlkeD1cIiR7aX1cIj5EaXNtaXNzPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIGRhdGEtYWN0PVwiZ3JvdXBcIiBkYXRhLWlkeD1cIiR7aX1cIj5Hcm91cDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YCkuam9pbignJyk7XG4gIGJnLmlubmVySFRNTCA9IGBcbiAgICA8ZGl2IGNsYXNzPVwibW9kYWxcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIiBhcmlhLWxhYmVsbGVkYnk9XCJzZXNzaW9uLXN1Z2dlc3QtdGl0bGVcIiBzdHlsZT1cIndpZHRoOjUyMHB4O21heC13aWR0aDo5NXZ3XCI+XG4gICAgICA8aDMgaWQ9XCJzZXNzaW9uLXN1Z2dlc3QtdGl0bGVcIj5TdWdnZXN0ZWQgc2Vzc2lvbnM8L2gzPlxuICAgICAgPHAgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJtYXJnaW46MCAwIDEycHhcIj5SZWNvcmRpbmdzIHJlY29yZGVkIGJhY2stdG8tYmFjayBtYXkgYmVsb25nIHRvIG9uZSBwbGF5IHNlc3Npb24uIEdyb3VwIHRoZSBvbmVzIHRoYXQgZG8uPC9wPlxuICAgICAgPGRpdiBjbGFzcz1cInNlc3Npb24tc3VnZ2VzdGlvbi1saXN0XCI+JHtpdGVtc308L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1hY3Rpb25zXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjE0cHhcIj48YnV0dG9uIGNsYXNzPVwiYnRuXCIgZGF0YS1hY3Q9XCJjbG9zZVwiPkRvbmU8L2J1dHRvbj48L2Rpdj5cbiAgICA8L2Rpdj5gO1xuICBjb25zdCBjbG9zZSA9ICgpID0+IHsgYmcucmVtb3ZlKCk7IGxvYWRWaWRlb3MoKTsgfTtcbiAgYmcub25jbGljayA9IGUgPT4ge1xuICAgIGlmIChlLnRhcmdldCA9PT0gYmcpIHsgY2xvc2UoKTsgcmV0dXJuOyB9XG4gICAgY29uc3QgYnRuID0gZS50YXJnZXQuY2xvc2VzdCgnYnV0dG9uW2RhdGEtYWN0XScpO1xuICAgIGlmICghYnRuKSByZXR1cm47XG4gICAgY29uc3QgYWN0ID0gYnRuLmRhdGFzZXQuYWN0O1xuICAgIGlmIChhY3QgPT09ICdjbG9zZScpIHsgY2xvc2UoKTsgcmV0dXJuOyB9XG4gICAgY29uc3QgaWR4ID0gcGFyc2VJbnQoYnRuLmRhdGFzZXQuaWR4LCAxMCk7XG4gICAgY29uc3QgZ3JvdXAgPSBncm91cHNbaWR4XTtcbiAgICBpZiAoYWN0ID09PSAnZGlzbWlzcycpIHtcbiAgICAgIFNlc3Npb25VSS5kaXNtaXNzZWQuYWRkKF9ncm91cEtleShncm91cC52aWRlb19pZHMpKTtcbiAgICAgIF9zYXZlSWRTZXQoRElTTUlTU19LRVksIFNlc3Npb25VSS5kaXNtaXNzZWQpO1xuICAgICAgYmcucXVlcnlTZWxlY3RvcihgLnNlc3Npb24tc3VnZ2VzdGlvbltkYXRhLWlkeD1cIiR7aWR4fVwiXWApPy5yZW1vdmUoKTtcbiAgICAgIGlmICghYmcucXVlcnlTZWxlY3RvcignLnNlc3Npb24tc3VnZ2VzdGlvbicpKSBjbG9zZSgpO1xuICAgIH0gZWxzZSBpZiAoYWN0ID09PSAnZ3JvdXAnKSB7XG4gICAgICBfYWNjZXB0U3VnZ2VzdGlvbihncm91cCwgKCkgPT4ge1xuICAgICAgICBiZy5xdWVyeVNlbGVjdG9yKGAuc2Vzc2lvbi1zdWdnZXN0aW9uW2RhdGEtaWR4PVwiJHtpZHh9XCJdYCk/LnJlbW92ZSgpO1xuICAgICAgICBpZiAoIWJnLnF1ZXJ5U2VsZWN0b3IoJy5zZXNzaW9uLXN1Z2dlc3Rpb24nKSkgY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChiZyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9hY2NlcHRTdWdnZXN0aW9uKGdyb3VwLCBvbkRvbmUpIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvc2Vzc2lvbnMnLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7dmlkZW9faWRzOiBncm91cC52aWRlb19pZHN9KSxcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB7IHNob3dUb2FzdCgnQ291bGQgbm90IGNyZWF0ZSBzZXNzaW9uJywgJ2Vycm9yJyk7IHJldHVybjsgfVxuICBzaG93VG9hc3QoYEdyb3VwZWQgJHtwbHVyYWwoZ3JvdXAudmlkZW9faWRzLmxlbmd0aCwgJ3JlY29yZGluZycpfSBpbnRvIGEgc2Vzc2lvbmApO1xuICBhd2FpdCBsb2FkU2Vzc2lvbnMoKTtcbiAgb25Eb25lKCk7XG59XG5cbi8vIOKUgOKUgCB0ZXh0IHByb21wdCBtb2RhbCAoY3JlYXRlL3JlbmFtZSkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBfcHJvbXB0VGV4dCh0aXRsZSwgbGFiZWxUZXh0LCBpbml0aWFsKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICBjb25zdCBiZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGJnLmNsYXNzTmFtZSA9ICdtb2RhbC1iZyB2aXNpYmxlJztcbiAgICBiZy5pbm5lckhUTUwgPSBgXG4gICAgICA8ZGl2IGNsYXNzPVwibW9kYWxcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIiBhcmlhLWxhYmVsbGVkYnk9XCJzZXNzaW9uLXByb21wdC10aXRsZVwiIHN0eWxlPVwid2lkdGg6NDAwcHg7bWF4LXdpZHRoOjk1dndcIj5cbiAgICAgICAgPGgzIGlkPVwic2Vzc2lvbi1wcm9tcHQtdGl0bGVcIj4ke2VzY0h0bWwodGl0bGUpfTwvaDM+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZFwiPlxuICAgICAgICAgIDxsYWJlbCBmb3I9XCJzZXNzaW9uLXByb21wdC1pbnB1dFwiPiR7ZXNjSHRtbChsYWJlbFRleHQpfTwvbGFiZWw+XG4gICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJzZXNzaW9uLXByb21wdC1pbnB1dFwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm1vZGFsLWFjdGlvbnNcIiBzdHlsZT1cIm1hcmdpbi10b3A6MTRweDtkaXNwbGF5OmZsZXg7Z2FwOjhweDtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1lbmRcIj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgZGF0YS1hY3Q9XCJjYW5jZWxcIj5DYW5jZWw8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBkYXRhLWFjdD1cIm9rXCI+U2F2ZTwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PmA7XG4gICAgY29uc3QgaW5wdXQgPSBiZy5xdWVyeVNlbGVjdG9yKCcjc2Vzc2lvbi1wcm9tcHQtaW5wdXQnKTtcbiAgICBpbnB1dC52YWx1ZSA9IGluaXRpYWwgfHwgJyc7XG4gICAgY29uc3QgZG9uZSA9IHZhbHVlID0+IHsgYmcucmVtb3ZlKCk7IHJlc29sdmUodmFsdWUpOyB9O1xuICAgIGJnLm9uY2xpY2sgPSBlID0+IHtcbiAgICAgIGlmIChlLnRhcmdldCA9PT0gYmcgfHwgZS50YXJnZXQuZGF0YXNldC5hY3QgPT09ICdjYW5jZWwnKSByZXR1cm4gZG9uZShudWxsKTtcbiAgICAgIGlmIChlLnRhcmdldC5kYXRhc2V0LmFjdCA9PT0gJ29rJykgcmV0dXJuIGRvbmUoaW5wdXQudmFsdWUudHJpbSgpKTtcbiAgICB9O1xuICAgIGlucHV0Lm9ua2V5ZG93biA9IGUgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7IGUucHJldmVudERlZmF1bHQoKTsgZG9uZShpbnB1dC52YWx1ZS50cmltKCkpOyB9XG4gICAgICBlbHNlIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBkb25lKG51bGwpOyB9XG4gICAgfTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGJnKTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHsgaW5wdXQuZm9jdXMoKTsgaW5wdXQuc2VsZWN0KCk7IH0sIDMwKTtcbiAgfSk7XG59XG5cbi8vIOKUgOKUgCBzZXNzaW9uIGRldGFpbCB2aWV3IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuYXN5bmMgZnVuY3Rpb24gc2VsZWN0U2Vzc2lvbihzZXNzaW9uSWQpIHtcbiAgQXBwU3RhdGUuYWN0aXZlU2Vzc2lvbklkID0gc2Vzc2lvbklkO1xuICBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID0gbnVsbDtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI3ZpZGVvLWxpc3QgbGknKS5mb3JFYWNoKGwgPT4gbC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKSk7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCN2aWRlby1saXN0IGxpW2RhdGEtc2Vzc2lvbi1pZD1cIiR7c2Vzc2lvbklkfVwiXWApPy5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJykuaW5uZXJIVE1MID0gJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPVxuICAgICc8ZGl2IHN0eWxlPVwicGFkZGluZzoyNHB4O2NvbG9yOnZhcigtLW11dGVkKVwiPkxvYWRpbmcgc2Vzc2lvbuKApjwvZGl2Pic7XG4gIGxldCBzZXNzaW9uO1xuICB0cnkge1xuICAgIHNlc3Npb24gPSBhd2FpdCBmZXRjaChgL2FwaS9zZXNzaW9ucy8ke3Nlc3Npb25JZH1gKS50aGVuKHIgPT4ge1xuICAgICAgaWYgKCFyLm9rKSB0aHJvdyBuZXcgRXJyb3IoU3RyaW5nKHIuc3RhdHVzKSk7XG4gICAgICByZXR1cm4gci5qc29uKCk7XG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPVxuICAgICAgJzxkaXYgc3R5bGU9XCJwYWRkaW5nOjI0cHg7Y29sb3I6dmFyKC0tcmVkKVwiPkNvdWxkIG5vdCBsb2FkIHRoaXMgc2Vzc2lvbi48L2Rpdj4nO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoQXBwU3RhdGUuYWN0aXZlU2Vzc2lvbklkICE9PSBzZXNzaW9uSWQpIHJldHVybjsgICAvLyBzdXBlcnNlZGVkXG4gIF9yZW5kZXJTZXNzaW9uRGV0YWlsKHNlc3Npb24pO1xufVxuXG5mdW5jdGlvbiBfc2hvd0VtcHR5U2Vzc2lvbkRldGFpbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJykuaW5uZXJIVE1MID0gJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPSAnJztcbn1cblxuZnVuY3Rpb24gX3JlbmRlclNlc3Npb25EZXRhaWwoc2Vzc2lvbikge1xuICBjb25zdCBtZW1iZXJJZHMgPSBzZXNzaW9uLm1lbWJlcnMubWFwKG0gPT4gbS5pZCk7XG4gIGNvbnN0IGViID0gaXNFZGl0ZWQgPT4gaXNFZGl0ZWQgPyAnPHNwYW4gY2xhc3M9XCJlZGl0ZWQtYmFkZ2VcIj5lZGl0ZWQ8L3NwYW4+JyA6ICcnO1xuICBjb25zdCB0aXRsZVRleHQgPSBzZXNzaW9uLnRpdGxlIHx8IHNlc3Npb24ubmFtZSB8fCAnU2Vzc2lvbic7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdj48ZGl2IGNsYXNzPVwiZGV0YWlsLXR5cGUtYmFkZ2UgdmlkZW8tYmFkZ2VcIj4mIzEyNzkwMjsgU2Vzc2lvbjwvZGl2PjwvZGl2PlxuXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+XG4gICAgICAgIDxoMiBzdHlsZT1cIm1hcmdpbjowO2ZvbnQtc2l6ZToxN3B4O2ZvbnQtd2VpZ2h0OjcwMFwiPiR7ZXNjSHRtbCh0aXRsZVRleHQpfSR7ZWIoc2Vzc2lvbi50aXRsZV9pc19lZGl0ZWQpfTwvaDI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJrZWJhYi1idG5cIiB0aXRsZT1cIlNlc3Npb24gYWN0aW9uc1wiIGFyaWEtbGFiZWw9XCJTZXNzaW9uIGFjdGlvbnNcIiBpZD1cInNlc3Npb24tZGV0YWlsLWtlYmFiXCI+JiM4OTQyOzwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxM3B4XCI+XG4gICAgICAgICR7cGx1cmFsKHNlc3Npb24ubWVtYmVycy5sZW5ndGgsICdyZWNvcmRpbmcnKX0gJm1pZGRvdDsgJHtfbXNUb0htcyhzZXNzaW9uLnRvdGFsX21zKX0gdG90YWxcbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgJHtjb2xsYXBzaWJsZUNhcmQoJ3Nlc3Npb24tc3VtbWFyeScsXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+U2Vzc2lvbiBTdW1tYXJ5JHtlYihzZXNzaW9uLnN1bW1hcnlfaXNfZWRpdGVkKX08L3NwYW4+YCwgYFxuICAgICAgJHtzZXNzaW9uLnN1bW1hcnlcbiAgICAgICAgPyBgPGRpdiBjbGFzcz1cImRlc2NyaXB0aW9uLWxvbmdcIj4ke2VzY0h0bWwoc2Vzc2lvbi5zdW1tYXJ5KX08L2Rpdj5gXG4gICAgICAgIDogYDxkaXYgc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHhcIj5ObyBzdW1tYXJ5IHlldCAtIHJvbGwgb25lIHVwIGZyb20gdGhlIHJlY29yZGluZ3MnIHN1bW1hcmllcy48L2Rpdj5gfWAsXG4gICAgICB7IGFjdGlvbnM6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJzZXNzaW9uLXN1bW1hcml6ZS1idG5cIj4ke3Nlc3Npb24uc3VtbWFyeSA/ICdSZWdlbmVyYXRlJyA6ICdHZW5lcmF0ZSBTdW1tYXJ5J308L2J1dHRvbj5gIH0pfVxuXG4gICAgPGRpdiBjbGFzcz1cInZpZC1hY3Rpb25zXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwidmlkLWFjdGlvbnMtcm93XCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG5cIiBpZD1cInNlc3Npb24tcmVlbC1idG5cIj5CdWlsZCBIaWdobGlnaHQgUmVlbCBmcm9tIFNlc3Npb248L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgJHtjb2xsYXBzaWJsZUNhcmQoJ3Nlc3Npb24tdGltZWxpbmUnLFxuICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5VbmlmaWVkIFRpbWVsaW5lPC9zcGFuPmAsIGBcbiAgICAgIDxkaXYgaWQ9XCJzZXNzaW9uLXRpbWVsaW5lXCI+JHtfcmVuZGVyVW5pZmllZFRpbWVsaW5lKHNlc3Npb24pfTwvZGl2PmApfWA7XG5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Nlc3Npb24tZGV0YWlsLWtlYmFiJykub25jbGljayA9XG4gICAgZSA9PiBfb3BlblNlc3Npb25NZW51KHNlc3Npb24uaWQsIGUuY3VycmVudFRhcmdldCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXNzaW9uLXN1bW1hcml6ZS1idG4nKS5vbmNsaWNrID0gKCkgPT4gX3N1bW1hcml6ZVNlc3Npb24oc2Vzc2lvbi5pZCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXNzaW9uLXJlZWwtYnRuJykub25jbGljayA9ICgpID0+IHdpbmRvdy5vcGVuUmVlbEZvclNlc3Npb24oc2Vzc2lvbi5pZCwgbWVtYmVySWRzKTtcbiAgX3dpcmVUaW1lbGluZU5hdmlnYXRpb24oKTtcbn1cblxuZnVuY3Rpb24gX3JlbmRlclVuaWZpZWRUaW1lbGluZShzZXNzaW9uKSB7XG4gIGlmICghc2Vzc2lvbi5tZW1iZXJzLmxlbmd0aCkgcmV0dXJuICc8ZGl2IGNsYXNzPVwibWV0YVwiPk5vIHJlY29yZGluZ3MgaW4gdGhpcyBzZXNzaW9uLjwvZGl2Pic7XG4gIGNvbnN0IGJsb2NrcyA9IHNlc3Npb24ubWVtYmVycy5tYXAobSA9PiB7XG4gICAgY29uc3QgZ2FwID0gbS5nYXBfYmVmb3JlX21zID4gMFxuICAgICAgPyBgPGRpdiBjbGFzcz1cInNlc3Npb24tZ2FwXCI+Jm1kYXNoOyAke19mbXRHYXAobS5nYXBfYmVmb3JlX21zKX0gYnJlYWsgJm1kYXNoOzwvZGl2PmBcbiAgICAgIDogJyc7XG4gICAgY29uc3QgaGVhZCA9IGBcbiAgICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLW1lbWJlci1oZWFkXCI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwic2Vzc2lvbi1tZW1iZXItb2Zmc2V0XCI+JHtfbXNUb0htcyhtLm9mZnNldF9tcyl9PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInNlc3Npb24tbWVtYmVyLXRpdGxlXCI+JHtlc2NIdG1sKG0udGl0bGUpfTwvc3Bhbj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjEwcHg7cGFkZGluZzoxcHggN3B4XCIgZGF0YS1vcGVuLXZpZGVvPVwiJHttLmlkfVwiPk9wZW48L2J1dHRvbj5cbiAgICAgIDwvZGl2PmA7XG4gICAgbGV0IGJvZHk7XG4gICAgaWYgKCFtLmhhc190aW1lbGluZSAmJiAhbS5jbGlwcy5sZW5ndGgpIHtcbiAgICAgIGJvZHkgPSBgPGRpdiBjbGFzcz1cIm1ldGFcIiBzdHlsZT1cInBhZGRpbmc6NHB4IDAgOHB4XCI+Tm8gdGltZWxpbmUgeWV0IC0gPGEgaHJlZj1cIiNcIiBkYXRhLW9wZW4tdmlkZW89XCIke20uaWR9XCI+b3BlbiB0byBnZW5lcmF0ZSBvbmU8L2E+LjwvZGl2PmA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJvd3MgPSBfbWVyZ2VUaW1lbGluZVJvd3MobSkubWFwKHIgPT4gci5odG1sKS5qb2luKCcnKTtcbiAgICAgIGJvZHkgPSBgPGRpdiBjbGFzcz1cInNlc3Npb24tdGltZWxpbmUtcm93c1wiPiR7cm93c308L2Rpdj5gO1xuICAgIH1cbiAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJzZXNzaW9uLW1lbWJlci1ibG9ja1wiPiR7Z2FwfSR7aGVhZH0ke2JvZHl9PC9kaXY+YDtcbiAgfSk7XG4gIHJldHVybiBibG9ja3Muam9pbignJyk7XG59XG5cbi8vIEludGVybGVhdmVzIGEgbWVtYmVyJ3MgdGltZWxpbmUgZW50cmllcyBhbmQgY2xpcCBtYXJrZXJzIGJ5IGFic29sdXRlIHRpbWUgc29cbi8vIHRoZSByZWFkZXIgc2VlcyBib3RoIG9uIG9uZSBheGlzLiBFYWNoIHJvdyBjYXJyaWVzIHRoZSBkYXRhLSogbmF2IGF0dHJpYnV0ZXMuXG5mdW5jdGlvbiBfbWVyZ2VUaW1lbGluZVJvd3MobWVtYmVyKSB7XG4gIGNvbnN0IHJvd3MgPSBbXTtcbiAgZm9yIChjb25zdCBlIG9mIG1lbWJlci50aW1lbGluZSkge1xuICAgIHJvd3MucHVzaCh7IGFiczogZS5hYnNfbXMsIGh0bWw6IGBcbiAgICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLXRsLXJvd1wiIGRhdGEtZ290by12aWRlbz1cIiR7bWVtYmVyLmlkfVwiIGRhdGEtZ290by1tcz1cIiR7ZS5sb2NhbF9tc31cIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJzZXNzaW9uLXRsLXN0YW1wXCI+JHtlc2NIdG1sKF9tc1RvSG1zKGUuYWJzX21zKSl9PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInNlc3Npb24tdGwtdGV4dFwiPiR7ZXNjSHRtbChlLnRleHQpfTwvc3Bhbj5cbiAgICAgIDwvZGl2PmAgfSk7XG4gIH1cbiAgZm9yIChjb25zdCBjIG9mIG1lbWJlci5jbGlwcykge1xuICAgIHJvd3MucHVzaCh7IGFiczogYy5hYnNfbXMsIGh0bWw6IGBcbiAgICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLXRsLXJvdyBzZXNzaW9uLXRsLWNsaXBcIiBkYXRhLW9wZW4tY2xpcD1cIiR7Yy5pZH1cIiBkYXRhLWNsaXAtdmlkZW89XCIke21lbWJlci5pZH1cIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJzZXNzaW9uLXRsLXN0YW1wXCI+JHtlc2NIdG1sKF9tc1RvSG1zKGMuYWJzX21zKSl9PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInNlc3Npb24tdGwtdGV4dFwiPiYjMTI3OTE2OyAke2VzY0h0bWwoYy5kZXNjcmlwdGlvbiB8fCBgQ2xpcCAke2MuaWR9YCl9XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZXRhXCI+JiMxMTA4ODsgJHtNYXRoLnJvdW5kKChjLnNjb3JlX292ZXJhbGwgfHwgMCkgKiAxMDApfSU8L3NwYW4+PC9zcGFuPlxuICAgICAgPC9kaXY+YCB9KTtcbiAgfVxuICByb3dzLnNvcnQoKGEsIGIpID0+IGEuYWJzIC0gYi5hYnMpO1xuICByZXR1cm4gcm93cztcbn1cblxuZnVuY3Rpb24gX3dpcmVUaW1lbGluZU5hdmlnYXRpb24oKSB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXNzaW9uLXRpbWVsaW5lJyk7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm47XG4gIGNvbnRhaW5lci5vbmNsaWNrID0gYXN5bmMgZSA9PiB7XG4gICAgY29uc3Qgb3BlblZpZGVvID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtb3Blbi12aWRlb10nKTtcbiAgICBpZiAob3BlblZpZGVvKSB7IGUucHJldmVudERlZmF1bHQoKTsgc2VsZWN0VmlkZW8ocGFyc2VJbnQob3BlblZpZGVvLmRhdGFzZXQub3BlblZpZGVvLCAxMCkpOyByZXR1cm47IH1cbiAgICBjb25zdCBjbGlwUm93ID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtb3Blbi1jbGlwXScpO1xuICAgIGlmIChjbGlwUm93KSB7XG4gICAgICBhd2FpdCBzZWxlY3RWaWRlbyhwYXJzZUludChjbGlwUm93LmRhdGFzZXQuY2xpcFZpZGVvLCAxMCkpO1xuICAgICAgaWYgKHdpbmRvdy5zZWxlY3RDbGlwKSB3aW5kb3cuc2VsZWN0Q2xpcChwYXJzZUludChjbGlwUm93LmRhdGFzZXQub3BlbkNsaXAsIDEwKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGdvdG9Sb3cgPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1nb3RvLXZpZGVvXScpO1xuICAgIGlmIChnb3RvUm93KSB7IF9nb3RvUmVjb3JkaW5nVGltZShwYXJzZUludChnb3RvUm93LmRhdGFzZXQuZ290b1ZpZGVvLCAxMCksIHBhcnNlSW50KGdvdG9Sb3cuZGF0YXNldC5nb3RvTXMsIDEwKSk7IH1cbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2dvdG9SZWNvcmRpbmdUaW1lKHZpZGVvSWQsIGxvY2FsTXMpIHtcbiAgYXdhaXQgc2VsZWN0VmlkZW8odmlkZW9JZCk7XG4gIGNvbnN0IHZpZGVvRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkaW5nLXByZXZpZXctdmlkZW8nKTtcbiAgaWYgKCF2aWRlb0VsKSByZXR1cm47XG4gIGNvbnN0IG9mZnNldFMgPSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0RhdGE/LnNlZ21lbnRfc3RhcnRfcyB8fCAwO1xuICBjb25zdCBzZWVrVG8gPSBsb2NhbE1zIC8gMTAwMCArIG9mZnNldFM7XG4gIGNvbnN0IGRvU2VlayA9ICgpID0+IHsgdHJ5IHsgdmlkZW9FbC5jdXJyZW50VGltZSA9IHNlZWtUbzsgfSBjYXRjaCB7fSB9O1xuICBpZiAodmlkZW9FbC5yZWFkeVN0YXRlID49IDEpIGRvU2VlaygpO1xuICBlbHNlIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBkb1NlZWssIHtvbmNlOiB0cnVlfSk7XG59XG5cbmZ1bmN0aW9uIF9zdW1tYXJpemVTZXNzaW9uKHNlc3Npb25JZCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2Vzc2lvbi1zdW1tYXJpemUtYnRuJyk7XG4gIGlmIChidG4pIHsgYnRuLmRpc2FibGVkID0gdHJ1ZTsgYnRuLnRleHRDb250ZW50ID0gJ1N1bW1hcml6aW5n4oCmJzsgfVxuICBvcGVuTG9nKCk7XG4gIHN0cmVhbVNTRShcbiAgICBgL2FwaS9zZXNzaW9ucy8ke3Nlc3Npb25JZH0vc3VtbWFyaXplYCxcbiAgICAoKSA9PiB7XG4gICAgICBzaG93VG9hc3QoJ1Nlc3Npb24gc3VtbWFyeSBnZW5lcmF0ZWQnKTtcbiAgICAgIGlmIChBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPT09IHNlc3Npb25JZCkgc2VsZWN0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgbG9hZFNlc3Npb25zKCk7XG4gICAgfSxcbiAgICBbe2xhYmVsOiAnU3VtbWFyaXplJywgcGF0dGVybnM6IFsnR2VuZXJhdGluZyddfV0sXG4gICAgJ1Nlc3Npb24gc3VtbWFyeScsXG4gICAgZmFsc2UsXG4gICk7XG59XG5cbmZ1bmN0aW9uIF9mbXRHYXAobXMpIHtcbiAgY29uc3QgbWlucyA9IE1hdGgucm91bmQobXMgLyA2MDAwMCk7XG4gIGlmIChtaW5zIDwgNjApIHJldHVybiBwbHVyYWwobWlucywgJ21pbicpO1xuICBjb25zdCBoID0gTWF0aC5mbG9vcihtaW5zIC8gNjApLCBtID0gbWlucyAlIDYwO1xuICByZXR1cm4gbSA/IGAke2h9aCAke219bWAgOiBwbHVyYWwoaCwgJ2hyJyk7XG59XG5cbi8vIOKUgOKUgCBzdGF0aWMgaW5kZXguaHRtbCBoYW5kbGVycyB0aGlzIG1vZHVsZSBvd25zICh3aXJlZCBvbmNlIGF0IGxvYWQpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVGhlIHJlY29yZGluZ3Mtc2VjdGlvbiBrZWJhYiBhbmQgdGhlIGdyb3VwaW5nLWJhcidzIENhbmNlbC9Hcm91cCBidXR0b25zIGFyZVxuLy8gZml4ZWQsIG5ldmVyLXJlY3JlYXRlZCBlbGVtZW50cyBpbiBpbmRleC5odG1sLCBzbyBhIHNpbmdsZSBsb2FkLXRpbWUgbGlzdGVuZXJcbi8vIGNhbid0IGRvdWJsZS1maXJlIG9uIGEgcmUtcmVuZGVyLlxuZnVuY3Rpb24gX3dpcmVTdGF0aWNIYW5kbGVycygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1yZWNvcmRpbmdzLWFjdGlvbnMnKVxuICAgIC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4gb3BlblJlY29yZGluZ3NBY3Rpb25zTWVudShlLmN1cnJlbnRUYXJnZXQpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jYW5jZWwtZ3JvdXAnKVxuICAgIC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGV4aXRHcm91cGluZ01vZGUoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY29uZmlybS1ncm91cCcpXG4gICAgLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY29uZmlybUdyb3VwU2VsZWN0aW9uKCkpO1xufVxuXG5fd2lyZVN0YXRpY0hhbmRsZXJzKCk7XG5cbmV4cG9ydCB7XG4gIFNlc3Npb25VSSwgaXNTZXNzaW9uQ29sbGFwc2VkLCBzZXNzaW9uR3JvdXBIZWFkZXJMaSwgdG9nZ2xlR3JvdXBTZWxlY3QsXG59O1xuIiwgImltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQge1xuICBlc2NIdG1sLCBfc2NvcmVJY29uLCBfc2NvcmVCb3JkZXJDb2xvciwgX3NvcnRTY29yZSwgZm10RHVyYXRpb24sIHBsdXJhbCwgdHJ1bmNhdGUsXG4gIF9mbXRBZ28sIF9mbXRPZmZzZXQsIGZvcm1hdEFwaUVycm9yLFxufSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5pbXBvcnQge1xuICBzaG93VG9hc3QsIGNvbGxhcHNpYmxlQ2FyZCwgY29weVRleHQsIF9zeW5jU29ydERpckJ0biwgb3BlbkxvZywgYXBwZW5kTG9nLFxufSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7XG4gIHNob3dDb25maXJtLCBzaG93S2ViYWIsIG9wZW5BY3Rpb25zTW9kYWwsIG9wZW5EaWZmTW9kYWwsIG9wZW5GaWVsZEVkaXRNb2RhbCwgc2hvd1VuZG9Ub2FzdCxcbn0gZnJvbSAnLi91aS5qcyc7XG5pbXBvcnQgeyBQYW5lbE5hdiB9IGZyb20gJy4vcGFuZWxuYXYuanMnO1xuaW1wb3J0IHtcbiAgc3RyZWFtU1NFLCBzZXRKb2JDYW5jZWwsIF9ibG9ja2VkQnlBbmFseXplLCBfb3BlblNTRSwgX3NldEFjdGl2ZVN0cmVhbSwgX2NsZWFyQWN0aXZlU3RyZWFtLFxuICBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtLCBGUkFNRVNfU1RFUFMsIFNDT1JFX1NURVBTLCBhcHBseUpvYkJsb2NrZWRTdGF0ZSxcbn0gZnJvbSAnLi9qb2JzLmpzJztcbmltcG9ydCB7IGdhdGVPbkNhcGFiaWxpdHkgfSBmcm9tICcuL21vZGVsY2F0YWxvZy5qcyc7XG5pbXBvcnQgeyBsb2FkVmlkZW9zLCBfY2xpcHNMaXN0VXJsIH0gZnJvbSAnLi92aWRlb3MuanMnO1xuXG4vLyDilIDilIAgY2xpcCBsaXN0ICYgZmlsdGVyaW5nIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gX2FwcGx5RmlsdGVycygpIHtcbiAgY29uc3QgZiA9IEFwcFN0YXRlLmNsaXBGaWx0ZXJzO1xuICBsZXQgcmVzdWx0ID0gQXBwU3RhdGUuY2xpcHM7XG4gIGlmIChmICYmIGYuc2l6ZSkge1xuICAgIGNvbnN0IHN0YXR1c2VzID0gWydwZW5kaW5nJywgJ2FwcHJvdmVkJywgJ3JlamVjdGVkJ10uZmlsdGVyKHMgPT4gZi5oYXMocykpO1xuICAgIGlmIChzdGF0dXNlcy5sZW5ndGgpIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoYyA9PiBzdGF0dXNlcy5pbmNsdWRlcyhjLnN0YXR1cykpO1xuICAgIGlmIChmLmhhcygnZXhwb3J0ZWQnKSAmJiAhZi5oYXMoJ25vdC1leHBvcnRlZCcpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gYy5oYXNfZXhwb3J0KTtcbiAgICBlbHNlIGlmIChmLmhhcygnbm90LWV4cG9ydGVkJykgJiYgIWYuaGFzKCdleHBvcnRlZCcpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gIWMuaGFzX2V4cG9ydCk7XG4gICAgaWYgKGYuaGFzKCdlcnJvcicpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gKGMudGFncyB8fCBbXSkuaW5jbHVkZXMoJ2xsbV9lcnJvcicpKTtcbiAgICBpZiAoZi5oYXMoJ2ZsYWdnZWQnKSkgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihjID0+IChjLnNlbnNpdGl2ZV9tYXRjaGVzIHx8IFtdKS5sZW5ndGggPiAwKTtcbiAgICBpZiAoZi5oYXMoJ2R1cGxpY2F0ZScpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gKGMudGFncyB8fCBbXSkuaW5jbHVkZXMoJ3Bvc3NpYmxlX2R1cGxpY2F0ZScpKTtcbiAgICBpZiAoZi5oYXMoJ25vX3NwZWVjaCcpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gKGMudGFncyB8fCBbXSkuaW5jbHVkZXMoJ25vX3NwZWVjaCcpKTtcbiAgfVxuICBpZiAoQXBwU3RhdGUuY2xpcFNjb3JlTWluID4gMCkgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihjID0+IGMuc2NvcmVfb3ZlcmFsbCA+PSBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4pO1xuICBpZiAoQXBwU3RhdGUuY2xpcFNlYXJjaCkge1xuICAgIGNvbnN0IHEgPSBBcHBTdGF0ZS5jbGlwU2VhcmNoLnRvTG93ZXJDYXNlKCk7XG4gICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihjID0+XG4gICAgICAoYy5kZXNjcmlwdGlvbiB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgKGMuZGVzY3JpcHRpb25fbG9uZyB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgKGMudHJhbnNjcmlwdF9leGNlcnB0IHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XG4gICAgICAoYy51c2VyX3RhZ3MgfHwgW10pLnNvbWUodCA9PiB0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpXG4gICAgKTtcbiAgfVxuICAvLyBEaXJlY3Rpb24gaXMgYXBwbGllZCBjbGllbnQtc2lkZSBieSByZXZlcnNpbmcgdGhlIHNlcnZlci1zb3J0ZWQgb3JkZXI7IGNvcHlcbiAgLy8gZmlyc3Qgc28gd2UgbmV2ZXIgbXV0YXRlIEFwcFN0YXRlLmNsaXBzIChyZXN1bHQgbWF5IHN0aWxsIGJlIHRoYXQgYXJyYXkpLlxuICBpZiAoKEFwcFN0YXRlLmNsaXBTb3J0RGlyIHx8ICdkZXNjJykgPT09ICdhc2MnKSByZXN1bHQgPSBbLi4ucmVzdWx0XS5yZXZlcnNlKCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUNsaXBTb3J0RGlyKCkge1xuICBBcHBTdGF0ZS5jbGlwU29ydERpciA9IChBcHBTdGF0ZS5jbGlwU29ydERpciA9PT0gJ2FzYycpID8gJ2Rlc2MnIDogJ2FzYyc7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjbGlwcy1zb3J0LWRpcicsIEFwcFN0YXRlLmNsaXBTb3J0RGlyKTtcbiAgX3N5bmNTb3J0RGlyQnRuKCdjbGlwcy1zb3J0LWRpcicsIEFwcFN0YXRlLmNsaXBTb3J0RGlyKTtcbiAgX3JlbmRlckNsaXBzKCk7XG59XG5cbi8vIENhbm9uaWNhbCBjbGlwIHJlLXJlbmRlciBlbnRyeSBwb2ludC4gQWx3YXlzIHJvdXRlcyB0aHJvdWdoIF9hcHBseUZpbHRlcnMoKVxuLy8gc28gYSByZS1yZW5kZXIgY2FuJ3QgYWNjaWRlbnRhbGx5IGJ5cGFzcyB0aGUgYWN0aXZlIHNlYXJjaC9zdGF0dXMvc2NvcmVcbi8vIGZpbHRlcnMuIENhbGwgdGhpcyAtIG5ldmVyIF9yZW5kZXJDbGlwSXRlbXMgZGlyZWN0bHkgLSBhZnRlciBtdXRhdGluZyBBcHBTdGF0ZS5jbGlwcy5cbmZ1bmN0aW9uIF9yZW5kZXJDbGlwcygpIHtcbiAgd2luZG93Ll9wcnVuZUNsaXBTZWxlY3Rpb24oKTtcbiAgY29uc3Qgc2hvd24gPSBfYXBwbHlGaWx0ZXJzKCk7XG4gIF9yZW5kZXJDbGlwSXRlbXMoc2hvd24pO1xuICBfcmVuZGVyQ2xpcFN0YXRzTGluZShzaG93bik7XG4gIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCk7XG59XG5cbi8vIFBlci1zdGF0dXMgY291bnRzIHNob3duIGlubGluZSBvbiB0aGUgZmlsdGVyIGNoaXBzIChcIlVucmV2aWV3ZWQgMzBcIikuIENvdW50c1xuLy8gcmVmbGVjdCB0aGUgd2hvbGUgc2VsZWN0ZWQgcmVjb3JkaW5nLCBub3QgdGhlIGZpbHRlcmVkL3Nob3duIHN1YnNldCAtIHNlZSB0aGVcbi8vIHN0YXRzIGxpbmUgZm9yIHRoYXQuIERlcml2ZWQgZW50aXJlbHkgZnJvbSBBcHBTdGF0ZS5jbGlwczsgYmxhbmsgd2hlbiBub1xuLy8gcmVjb3JkaW5nIGlzIHNlbGVjdGVkIHNvIHRoZSBjaGlwcyByZWFkIGFzIGEgcGxhaW4gZmlsdGVyIGJhci5cbmZ1bmN0aW9uIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCkge1xuICAvLyBCYWRnZXMgbGl2ZSBvbmx5IG9uIHRoZSBjbGlwIGZpbHRlciBjaGlwcyAoZGF0YS1jb3VudCBpcyB1bmlxdWUgdG8gdGhlbSksIHNvXG4gIC8vIHF1ZXJ5IHRoZSBkb2N1bWVudCBkaXJlY3RseSAtIHRoZSByZWNvcmRpbmdzIGZpbHRlciByb3cgc2hhcmVzIHRoZVxuICAvLyAuY2xpcC1maWx0ZXItdGFicyBjbGFzcyBidXQgY2FycmllcyBubyBjb3VudHMuXG4gIGNvbnN0IHNldENvdW50ID0gKGtleSwgdmFsdWUpID0+IHtcbiAgICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYC5jbGlwLWNoaXAtY291bnRbZGF0YS1jb3VudD1cIiR7a2V5fVwiXWApO1xuICAgIGlmIChiYWRnZSkgYmFkZ2UudGV4dENvbnRlbnQgPSB2YWx1ZSA9PSBudWxsID8gJycgOiBTdHJpbmcodmFsdWUpO1xuICB9O1xuICBpZiAoIUFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgfHwgIUFwcFN0YXRlLmNsaXBzLmxlbmd0aCkge1xuICAgIGZvciAoY29uc3Qga2V5IG9mIFsnYWxsJywgJ3BlbmRpbmcnLCAnYXBwcm92ZWQnLCAncmVqZWN0ZWQnLCAnZXJyb3InLCAnZHVwbGljYXRlJ10pIHNldENvdW50KGtleSwgbnVsbCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGNvdW50cyA9IHtwZW5kaW5nOiAwLCBhcHByb3ZlZDogMCwgcmVqZWN0ZWQ6IDB9O1xuICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gIGxldCBkdXBsaWNhdGVDb3VudCA9IDA7XG4gIGZvciAoY29uc3QgYyBvZiBBcHBTdGF0ZS5jbGlwcykge1xuICAgIGNvdW50c1tjLnN0YXR1c10gPSAoY291bnRzW2Muc3RhdHVzXSB8fCAwKSArIDE7XG4gICAgaWYgKChjLnRhZ3MgfHwgW10pLmluY2x1ZGVzKCdsbG1fZXJyb3InKSkgZXJyb3JDb3VudCsrO1xuICAgIGlmICgoYy50YWdzIHx8IFtdKS5pbmNsdWRlcygncG9zc2libGVfZHVwbGljYXRlJykpIGR1cGxpY2F0ZUNvdW50Kys7XG4gIH1cbiAgc2V0Q291bnQoJ2FsbCcsIEFwcFN0YXRlLmNsaXBzLmxlbmd0aCk7XG4gIHNldENvdW50KCdwZW5kaW5nJywgY291bnRzLnBlbmRpbmcpO1xuICBzZXRDb3VudCgnYXBwcm92ZWQnLCBjb3VudHMuYXBwcm92ZWQpO1xuICBzZXRDb3VudCgncmVqZWN0ZWQnLCBjb3VudHMucmVqZWN0ZWQpO1xuICBzZXRDb3VudCgnZXJyb3InLCBlcnJvckNvdW50IHx8IG51bGwpO1xuICBzZXRDb3VudCgnZHVwbGljYXRlJywgZHVwbGljYXRlQ291bnQgfHwgbnVsbCk7XG59XG5cbmZ1bmN0aW9uIF9yZW5kZXJDbGlwU3RhdHNMaW5lKHNob3duKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtc3RhdHMtbGluZScpO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGlmICghQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCB8fCAhQXBwU3RhdGUuY2xpcHMubGVuZ3RoKSB7XG4gICAgZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgY291bnRzID0ge3BlbmRpbmc6IDAsIGFwcHJvdmVkOiAwLCByZWplY3RlZDogMH07XG4gIGZvciAoY29uc3QgYyBvZiBBcHBTdGF0ZS5jbGlwcykgY291bnRzW2Muc3RhdHVzXSA9IChjb3VudHNbYy5zdGF0dXNdIHx8IDApICsgMTtcbiAgY29uc3QgdG90YWxTZWNvbmRzID0gc2hvd24ucmVkdWNlKChzdW0sIGMpID0+IHtcbiAgICBjb25zdCBsZW4gPSAoYy5lbmRfbXMgLSBjLnN0YXJ0X21zKSAvIDEwMDA7XG4gICAgcmV0dXJuIHN1bSArIChOdW1iZXIuaXNGaW5pdGUobGVuKSA/IGxlbiA6IDApO1xuICB9LCAwKTtcbiAgZWwudGV4dENvbnRlbnQgPSBgJHtzaG93bi5sZW5ndGh9IHNob3duIMK3ICR7Y291bnRzLnBlbmRpbmd9IHVucmV2aWV3ZWQgwrcgYCArXG4gICAgYCR7Y291bnRzLmFwcHJvdmVkfSBhcHByb3ZlZCDCtyAke2NvdW50cy5yZWplY3RlZH0gcmVqZWN0ZWQgwrcgJHtmbXREdXJhdGlvbih0b3RhbFNlY29uZHMpfSB0b3RhbGA7XG4gIGVsLnN0eWxlLmRpc3BsYXkgPSAnJztcbn1cblxuZnVuY3Rpb24gX2NsZWFyQ2xpcEZpbHRlcnMoKSB7XG4gIEFwcFN0YXRlLmNsaXBGaWx0ZXJzLmNsZWFyKCk7XG4gIEFwcFN0YXRlLmNsaXBTZWFyY2ggPSAnJztcbiAgQXBwU3RhdGUuY2xpcFNjb3JlTWluID0gMDtcbiAgX3N5bmNGaWx0ZXJDaGlwcygpO1xuICBjb25zdCBzZWFyY2hFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwLXNlYXJjaC1pbnB1dCcpO1xuICBpZiAoc2VhcmNoRWwpIHNlYXJjaEVsLnZhbHVlID0gJyc7XG4gIGNvbnN0IHNjb3JlRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1zY29yZS1taW4nKTtcbiAgaWYgKHNjb3JlRWwpIHNjb3JlRWwudmFsdWUgPSAnMCc7XG4gIF9yZW5kZXJDbGlwcygpO1xufVxuXG4vLyBSZWZsZWN0IEFwcFN0YXRlLmNsaXBGaWx0ZXJzIG9udG8gdGhlIGNoaXAgcm93LiBUaGUgXCJBbGxcIiBjaGlwIGlzIGFjdGl2ZSBvbmx5XG4vLyB3aGVuIG5vIG90aGVyIGZpbHRlciBpcyBzZWxlY3RlZC5cbmZ1bmN0aW9uIF9zeW5jRmlsdGVyQ2hpcHMoKSB7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS5jbGlwRmlsdGVycztcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtZmlsdGVyXScpLmZvckVhY2goY2hpcCA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSBjaGlwLmRhdGFzZXQuZmlsdGVyO1xuICAgIGNvbnN0IGFjdGl2ZSA9IHRva2VuID09PSAnYWxsJyA/IGYuc2l6ZSA9PT0gMCA6IGYuaGFzKHRva2VuKTtcbiAgICBjaGlwLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIGFjdGl2ZSk7XG4gICAgY2hpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFjdGl2ZSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuICB9KTtcbiAgX3N5bmNNb3JlRmlsdGVycygpO1xufVxuXG4vLyBGaWx0ZXJzIChhbmQgdGhlIG1pbi1zY29yZSkgdGhhdCBsaXZlIGluc2lkZSB0aGUgXCJNb3JlIGZpbHRlcnNcIiBleHBhbmRlci5cbmNvbnN0IF9ISURERU5fRklMVEVSX1RPS0VOUyA9IFsnZXhwb3J0ZWQnLCAnbm90LWV4cG9ydGVkJywgJ2Vycm9yJywgJ2ZsYWdnZWQnLCAnZHVwbGljYXRlJywgJ25vX3NwZWVjaCddO1xuXG4vLyBGb3JjZSB0aGUgZXhwYW5kZXIgb3BlbiB3aGVuZXZlciBvbmUgb2YgdGhlIGZpbHRlcnMgaXQgaGlkZXMgaXMgYWN0aXZlIChvciBhXG4vLyBub24tZGVmYXVsdCBtaW4tc2NvcmUgaXMgc2V0KSwgc28gdGhlIHVzZXIgaXMgbmV2ZXIgbGVmdCB3b25kZXJpbmcgd2h5IHRoZVxuLy8gbGlzdCBpcyBmaWx0ZXJlZC4gV2Ugb25seSBldmVyIGZvcmNlIGl0IE9QRU4gLSBvbiByZXR1cm4gdG8gZGVmYXVsdHMgd2Ugc3RvcFxuLy8gZm9yY2luZyBpdCBhbmQgbGV0IHRoZSB1c2VyIGNvbGxhcHNlIGl0IHRoZW1zZWx2ZXMuXG5mdW5jdGlvbiBfc3luY01vcmVGaWx0ZXJzKCkge1xuICBjb25zdCBkZXRhaWxzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtbW9yZS1maWx0ZXJzJyk7XG4gIGlmICghZGV0YWlscykgcmV0dXJuO1xuICBjb25zdCBhY3RpdmUgPSBfSElEREVOX0ZJTFRFUl9UT0tFTlMuc29tZSh0ID0+IEFwcFN0YXRlLmNsaXBGaWx0ZXJzLmhhcyh0KSkgfHxcbiAgICBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4gPiAwO1xuICBpZiAoYWN0aXZlKSBkZXRhaWxzLm9wZW4gPSB0cnVlO1xuICBjb25zdCBmbGFnID0gZGV0YWlscy5xdWVyeVNlbGVjdG9yKCdbZGF0YS1tb3JlLWZsYWddJyk7XG4gIGlmIChmbGFnKSBmbGFnLmhpZGRlbiA9ICFhY3RpdmU7XG59XG5cbi8vIEV4cG9ydCAoaGFzLWZpbGUpIGNoaXBzIGFyZSBtdXR1YWxseSBleGNsdXNpdmUgLSBcIkV4cG9ydGVkXCIgYW5kIFwiTm90IGV4cG9ydGVkXCJcbi8vIGNhbid0IGJvdGggaG9sZC4gRXZlcnl0aGluZyBlbHNlIHRvZ2dsZXMgaW5kZXBlbmRlbnRseTsgXCJBbGxcIiBjbGVhcnMgdGhlIHNldC5cbmNvbnN0IF9FWFBPUlRfRklMVEVSX1RPS0VOUyA9IFsnZXhwb3J0ZWQnLCAnbm90LWV4cG9ydGVkJ107XG5mdW5jdGlvbiB0b2dnbGVDbGlwRmlsdGVyKHRva2VuKSB7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS5jbGlwRmlsdGVycztcbiAgaWYgKHRva2VuID09PSAnYWxsJykge1xuICAgIGYuY2xlYXIoKTtcbiAgfSBlbHNlIGlmIChmLmhhcyh0b2tlbikpIHtcbiAgICBmLmRlbGV0ZSh0b2tlbik7XG4gIH0gZWxzZSB7XG4gICAgaWYgKF9FWFBPUlRfRklMVEVSX1RPS0VOUy5pbmNsdWRlcyh0b2tlbikpIF9FWFBPUlRfRklMVEVSX1RPS0VOUy5mb3JFYWNoKHQgPT4gZi5kZWxldGUodCkpO1xuICAgIGYuYWRkKHRva2VuKTtcbiAgfVxuICBfc3luY0ZpbHRlckNoaXBzKCk7XG4gIF9yZW5kZXJDbGlwcygpO1xufVxuXG4vLyBDYW5kaWRhdGUtdHlwZSB0b2dnbGUgKENsaXBzIHZzIFNjZW5lcykuIFVubGlrZSB0aGUgc3RhdHVzIGZpbHRlciBjaGlwcywgdGhpc1xuLy8gaXMgYSBzZXJ2ZXItc2lkZSBzd2l0Y2g6IGl0IHJlbG9hZHMgQXBwU3RhdGUuY2xpcHMgZm9yIHRoZSBzZWxlY3RlZCBraW5kLCBzb1xuLy8gdGhlIHN0YXR1cyBjb3VudHMgYW5kIHN0YXRzIGxpbmUgcmVmbGVjdCBqdXN0IHRoYXQga2luZC4gRGVmYXVsdHMgdG8gQ2xpcHMuXG5mdW5jdGlvbiBzZXRDbGlwS2luZChraW5kKSB7XG4gIGlmIChraW5kICE9PSAnY2xpcCcgJiYga2luZCAhPT0gJ3NjZW5lJykgcmV0dXJuO1xuICBpZiAoQXBwU3RhdGUuY2xpcEtpbmQgPT09IGtpbmQpIHJldHVybjtcbiAgQXBwU3RhdGUuY2xpcEtpbmQgPSBraW5kO1xuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBudWxsO1xuICBfc3luY0tpbmRDaGlwcygpO1xuICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkgX3JlbG9hZENsaXBMaXN0KEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpO1xufVxuXG5mdW5jdGlvbiBfc3luY0tpbmRDaGlwcygpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEta2luZF0nKS5mb3JFYWNoKGNoaXAgPT4ge1xuICAgIGNvbnN0IGFjdGl2ZSA9IGNoaXAuZGF0YXNldC5raW5kID09PSBBcHBTdGF0ZS5jbGlwS2luZDtcbiAgICBjaGlwLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIGFjdGl2ZSk7XG4gICAgY2hpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFjdGl2ZSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gc2V0Q2xpcFNlYXJjaChxKSB7XG4gIEFwcFN0YXRlLmNsaXBTZWFyY2ggPSBxLnRyaW0oKTtcbiAgX3JlbmRlckNsaXBzKCk7XG59XG5cbmZ1bmN0aW9uIHNldENsaXBTY29yZU1pbih2YWwpIHtcbiAgQXBwU3RhdGUuY2xpcFNjb3JlTWluID0gcGFyc2VGbG9hdCh2YWwpIHx8IDA7XG4gIF9zeW5jTW9yZUZpbHRlcnMoKTtcbiAgX3JlbmRlckNsaXBzKCk7XG59XG5cbi8vIOKJpDMgZGlzdGluY3QgcGhyYXNlcyBzaG93IGluZGl2aWR1YWxseTsgbW9yZSBjb2xsYXBzZSB0byBhIHNpbmdsZSBjb3VudCBwaWxsIHNvXG4vLyBhIGhlYXZpbHktbWF0Y2hlZCBjbGlwIGRvZXNuJ3QgY3Jvd2Qgb3V0IHRoZSByZXN0IG9mIHRoZSBzaWRlYmFyIHJvdy5cbmZ1bmN0aW9uIF9ob3R3b3JkUGlsbHNIVE1MKG1hdGNoZXMpIHtcbiAgaWYgKCFtYXRjaGVzIHx8ICFtYXRjaGVzLmxlbmd0aCkgcmV0dXJuICcnO1xuICBpZiAobWF0Y2hlcy5sZW5ndGggPD0gMykge1xuICAgIHJldHVybiBgPGRpdiBjbGFzcz1cInRhZ3NcIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+JHttYXRjaGVzLm1hcChtID0+XG4gICAgICBgPHNwYW4gY2xhc3M9XCJ0YWdcIiB0aXRsZT1cIiR7ZXNjSHRtbChtLnBocmFzZSl9JHttLmNvdW50ID4gMSA/IGAgKCR7bS5jb3VudH3DlylgIDogJyd9XCI+XFx1ezFGNTI1fSAke2VzY0h0bWwobS5waHJhc2UpfTwvc3Bhbj5gXG4gICAgKS5qb2luKCcnKX08L2Rpdj5gO1xuICB9XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cInRhZ3NcIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+PHNwYW4gY2xhc3M9XCJ0YWdcIiB0aXRsZT1cIiR7bWF0Y2hlcy5sZW5ndGh9IGhvdC13b3JkcyBtYXRjaGVkXCI+XFx1ezFGNTI1fSAke21hdGNoZXMubGVuZ3RofTwvc3Bhbj48L2Rpdj5gO1xufVxuXG4vLyBEZWxlZ2F0ZWQgb24gdGhlIHBlcnNpc3RlbnQgI2NsaXAtbGlzdCBlbGVtZW50IChpdHMgaW5uZXJIVE1MIGlzIHJlcGxhY2VkIGVhY2hcbi8vIHJlbmRlciwgc28gcGVyLXJvdyBoYW5kbGVycyB3b3VsZCBiZSBsb3N0IC0gdGhlIGNvbnRhaW5lciBsaXN0ZW5lciBpc24ndCkuIFdpcmVkXG4vLyB1bmNvbmRpdGlvbmFsbHkgb24gZXZlcnkgcmVuZGVyIHNvIGl0IGFsc28gY292ZXJzIHRoZSBlbXB0eS1maWx0ZXItbWVzc2FnZSBsaW5rcy5cbmZ1bmN0aW9uIF9oYW5kbGVDbGlwTGlzdENsaWNrKGUpIHtcbiAgY29uc3QgYWN0ID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0XScpO1xuICBpZiAoYWN0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGlmIChhY3QuZGF0YXNldC5hY3QgPT09ICdvcGVuLXNldHRpbmdzJykgd2luZG93Lm9wZW5TZXR0aW5ncygpO1xuICAgIGVsc2UgaWYgKGFjdC5kYXRhc2V0LmFjdCA9PT0gJ2NsZWFyLWNsaXAtZmlsdGVycycpIF9jbGVhckNsaXBGaWx0ZXJzKCk7XG4gICAgZWxzZSBpZiAoYWN0LmRhdGFzZXQuYWN0ID09PSAnb3Blbi1uZXctcmVjb3JkaW5nLXBhbmVsJykgd2luZG93Lm9wZW5OZXdSZWNvcmRpbmdQYW5lbCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBsaSA9IGUudGFyZ2V0LmNsb3Nlc3QoJ2xpW2RhdGEtY2xpcC1pZF0nKTtcbiAgaWYgKGxpKSBzZWxlY3RDbGlwKE51bWJlcihsaS5kYXRhc2V0LmNsaXBJZCkpO1xufVxuXG5mdW5jdGlvbiBfaGFuZGxlQ2xpcExpc3RLZXlkb3duKGUpIHtcbiAgaWYgKGUua2V5ICE9PSAnRW50ZXInICYmIGUua2V5ICE9PSAnICcpIHJldHVybjtcbiAgY29uc3QgbGkgPSBlLnRhcmdldC5jbG9zZXN0KCdsaVtkYXRhLWNsaXAtaWRdJyk7XG4gIGlmICghbGkgfHwgZS50YXJnZXQgIT09IGxpKSByZXR1cm47ICAvLyBkb24ndCBoaWphY2sgU3BhY2Ugb24gdGhlIGNoZWNrYm94XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgc2VsZWN0Q2xpcChOdW1iZXIobGkuZGF0YXNldC5jbGlwSWQpKTtcbn1cblxuZnVuY3Rpb24gX3JlbmRlckNsaXBJdGVtcyhjbGlwcykge1xuICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtbGlzdCcpO1xuICBsaXN0LmlubmVySFRNTCA9ICcnO1xuICBsaXN0Lm9uY2xpY2sgPSBfaGFuZGxlQ2xpcExpc3RDbGljaztcbiAgbGlzdC5vbmtleWRvd24gPSBfaGFuZGxlQ2xpcExpc3RLZXlkb3duO1xuICBpZiAoIWNsaXBzLmxlbmd0aCkge1xuICAgIGNvbnN0IF9zdGF0dXNMYWJlbCA9IHtwZW5kaW5nOiAnVW5yZXZpZXdlZCcsIGFwcHJvdmVkOiAnQXBwcm92ZWQnLCByZWplY3RlZDogJ1JlamVjdGVkJ307XG4gICAgY29uc3QgaGFzQWN0aXZlRmlsdGVyID0gQXBwU3RhdGUuY2xpcEZpbHRlcnMuc2l6ZSA+IDAgfHwgQXBwU3RhdGUuY2xpcFNlYXJjaCB8fCBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4gPiAwO1xuICAgIGNvbnN0IGlzRmxhZ2dlZE9ubHkgPSBBcHBTdGF0ZS5jbGlwRmlsdGVycy5zaXplID09PSAxICYmIEFwcFN0YXRlLmNsaXBGaWx0ZXJzLmhhcygnZmxhZ2dlZCcpICYmXG4gICAgICAhQXBwU3RhdGUuY2xpcFNlYXJjaCAmJiBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4gPT09IDA7XG4gICAgY29uc3QgZmlsdGVyTXNnID0gaXNGbGFnZ2VkT25seVxuICAgICAgPyBgTm8gZmxhZ2dlZCBjbGlwcyAtIGFkZCBTZW5zaXRpdmUgVGVybXMgaW4gPGEgaHJlZj1cIiNcIiBzdHlsZT1cImNvbG9yOnZhcigtLWFjY2VudCk7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZVwiIGRhdGEtYWN0PVwib3Blbi1zZXR0aW5nc1wiPlNldHRpbmdzPC9hPmBcbiAgICAgIDogaGFzQWN0aXZlRmlsdGVyXG4gICAgICA/IGBObyBjbGlwcyBtYXRjaCB0aGUgY3VycmVudCBmaWx0ZXJzIC0gPGEgaHJlZj1cIiNcIiBzdHlsZT1cImNvbG9yOnZhcigtLWFjY2VudCk7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZVwiIGRhdGEtYWN0PVwiY2xlYXItY2xpcC1maWx0ZXJzXCI+Q2xlYXIgZmlsdGVyczwvYT5gXG4gICAgICA6IGBObyBjbGlwcyBmb3VuZCAtIDxhIGhyZWY9XCIjXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS1hY2NlbnQpO3RleHQtZGVjb3JhdGlvbjp1bmRlcmxpbmVcIiBkYXRhLWFjdD1cIm9wZW4tbmV3LXJlY29yZGluZy1wYW5lbFwiPkFuYWx5emUgYW5vdGhlciByZWNvcmRpbmc8L2E+YDtcbiAgICBsaXN0LmlubmVySFRNTCA9IGA8bGkgc3R5bGU9XCJwYWRkaW5nOjEwcHggMTRweDtjb2xvcjp2YXIoLS1tdXRlZClcIj4ke2ZpbHRlck1zZ308L2xpPmA7XG4gICAgd2luZG93Ll91cGRhdGVCdWxrVG9vbGJhcigpO1xuICAgIHJldHVybjtcbiAgfVxuICBmb3IgKGNvbnN0IGMgb2YgY2xpcHMpIHtcbiAgICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gICAgbGkuY2xhc3NOYW1lID0gYy5pZCA9PT0gQXBwU3RhdGUuYWN0aXZlQ2xpcElkID8gJ2FjdGl2ZScgOiAnJztcbiAgICBsaS5zdHlsZS5ib3JkZXJMZWZ0Q29sb3IgPSBfc2NvcmVCb3JkZXJDb2xvcihfc29ydFNjb3JlKGMpLCBjLnN0YXR1cyA9PT0gJ3JlamVjdGVkJyB8fCAhYy5zY29yZWRfYXQpO1xuICAgIGxpLnRhYkluZGV4ID0gMDtcbiAgICBsaS5kYXRhc2V0LmNsaXBJZCA9IGMuaWQ7XG4gICAgbGkuaW5uZXJIVE1MID0gYFxuICAgICAgPGRpdiBjbGFzcz1cImNsaXAtaXRlbS1yb3cxXCI+XG4gICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cImNsaXAtc2VsZWN0LWNoZWNrYm94XCIgYXJpYS1sYWJlbD1cIlNlbGVjdCBjbGlwICMke2MuaWR9XCI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiY2xpcC1udW1cIiB0aXRsZT1cIkNsaXAgIyR7Yy5pZH1cIj4jJHtjLmlkfTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJjbGlwLXRpbWVcIj4ke2Muc3RhcnRfaG1zfSAmbWlkZG90OyAke2MuZHVyYXRpb25faG1zfTwvc3Bhbj5cbiAgICAgICAgJHtjLmhhc19leHBvcnRcbiAgICAgICAgICA/IChjLmV4cG9ydF9zdGFsZVxuICAgICAgICAgICAgICA/IGA8c3BhbiBjbGFzcz1cImV4cG9ydC1waWxsIGlzLXN0YWxlXCIgdGl0bGU9XCJTdGFsZSAtIHJlLWV4cG9ydCB0byB1cGRhdGUgKCR7ZXNjSHRtbCgoYy5leHBvcnRfc3RhbGVfcmVhc29ucyB8fCBbXSkuam9pbignLCAnKSl9KVwiPlN0YWxlPC9zcGFuPmBcbiAgICAgICAgICAgICAgOiBgPHNwYW4gY2xhc3M9XCJleHBvcnQtcGlsbCBpcy1leHBvcnRlZFwiIHRpdGxlPVwiQ2xpcCBoYXMgYmVlbiBleHBvcnRlZFwiPiR7KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG4gPSAoYy5leHBvcnRzIHx8IFtdKS5maWx0ZXIoZSA9PiBlLmV4aXN0cykubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIG4gPiAxID8gYEV4cG9ydGVkICZ0aW1lczske259YCA6ICdFeHBvcnRlZCc7XG4gICAgICAgICAgICAgICAgfSkoKX08L3NwYW4+YClcbiAgICAgICAgICA6ICc8c3BhbiBjbGFzcz1cImV4cG9ydC1waWxsIG5vdC1leHBvcnRlZFwiIHRpdGxlPVwiTm90IHlldCBleHBvcnRlZFwiPk5vdCBleHBvcnRlZDwvc3Bhbj4nfVxuICAgICAgICA8c3BhbiBjbGFzcz1cInN0YXR1cy1kb3QgZG90LSR7Yy5zdGF0dXN9XCIgdGl0bGU9XCIke2Muc3RhdHVzID09PSAnYXBwcm92ZWQnID8gJ0FwcHJvdmVkJyA6IGMuc3RhdHVzID09PSAncmVqZWN0ZWQnID8gJ1JlamVjdGVkJyA6ICdVbnJldmlld2VkJ31cIj4ke2Muc3RhdHVzID09PSAnYXBwcm92ZWQnID8gJ+KckycgOiBjLnN0YXR1cyA9PT0gJ3JlamVjdGVkJyA/ICfinJUnIDogJyd9PC9zcGFuPlxuICAgICAgICAkeyhjLnRhZ3MgfHwgW10pLmluY2x1ZGVzKCdsbG1fZXJyb3InKSAmJiAhISh3aW5kb3cuX3ByZXJlcXMgfHwge30pLmxsbV9vayA/ICc8c3BhbiBjbGFzcz1cImNsaXAtZXJyb3ItYmFkZ2VcIiB0aXRsZT1cIkxMTSBzY29yaW5nIGZhaWxlZCAtIFJlLXNjb3JlIHRvIHJldHJ5XCI+JiM5ODg4Ozwvc3Bhbj4nIDogJyd9XG4gICAgICAgICR7KGMuc2Vuc2l0aXZlX21hdGNoZXMgfHwgW10pLmxlbmd0aCA/ICc8c3BhbiBjbGFzcz1cImNsaXAtZmxhZy1iYWRnZVwiIHRpdGxlPVwiQ29udGFpbnMgZmxhZ2dlZCB0ZXJtc1wiPiYjOTg4ODs8L3NwYW4+JyA6ICcnfVxuICAgICAgICAkeyhjLnRhZ3MgfHwgW10pLmluY2x1ZGVzKCdwb3NzaWJsZV9kdXBsaWNhdGUnKSA/ICc8c3BhbiBjbGFzcz1cImNsaXAtZHVwLWJhZGdlXCIgdGl0bGU9XCJPdmVybGFwcyBhbm90aGVyIGNsaXAgLSBwb3NzaWJsZSBkdXBsaWNhdGVcIj4mIzg2NDY7PC9zcGFuPicgOiAnJ31cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImNsaXAtc2NvcmVzXCIgYXJpYS1sYWJlbD1cIiR7Yy5zY29yZWRfYXQgPyBgU2NvcmVzOiBvdmVyYWxsICR7TWF0aC5yb3VuZChjLnNjb3JlX292ZXJhbGwqMTAwKX0lLCBmdW5ueSAke01hdGgucm91bmQoYy5zY29yZV9mdW5ueSoxMDApfSUsIGRyYW1hdGljICR7TWF0aC5yb3VuZChjLnNjb3JlX2RyYW1hdGljKjEwMCl9JSwgYWN0aW9uICR7TWF0aC5yb3VuZChjLnNjb3JlX2FjdGlvbioxMDApfSUsIHZpc3VhbCAke01hdGgucm91bmQoKGMuc2NvcmVfdmlzdWFsfHwwKSoxMDApfSUke2Muc2NvcmVfbGF1Z2ggIT0gbnVsbCA/IGAsIGxhdWdocyAke01hdGgucm91bmQoYy5zY29yZV9sYXVnaCoxMDApfSVgIDogJyd9YCA6ICdOb3QgeWV0IHNjb3JlZCd9XCI+XG4gICAgICAgICR7Yy5zY29yZWRfYXQgPyBgXG4gICAgICAgIDxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHRpdGxlPVwiT3ZlcmFsbFwiPiR7X3Njb3JlSWNvbihjLnNjb3JlX292ZXJhbGwpfSAke01hdGgucm91bmQoYy5zY29yZV9vdmVyYWxsKjEwMCl9JTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCIgdGl0bGU9XCJGdW5ueVwiPjxzcGFuPvCfmII8L3NwYW4+ICR7TWF0aC5yb3VuZChjLnNjb3JlX2Z1bm55KjEwMCl9JTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCIgdGl0bGU9XCJEcmFtYXRpY1wiPjxzcGFuPvCfjq08L3NwYW4+ICR7TWF0aC5yb3VuZChjLnNjb3JlX2RyYW1hdGljKjEwMCl9JTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCIgdGl0bGU9XCJBY3Rpb25cIj48c3Bhbj7impTvuI88L3NwYW4+ICR7TWF0aC5yb3VuZChjLnNjb3JlX2FjdGlvbioxMDApfSU8L3NwYW4+XG4gICAgICAgIDxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHRpdGxlPVwiVmlzdWFsXCI+PHNwYW4+8J+OrDwvc3Bhbj4gJHtNYXRoLnJvdW5kKChjLnNjb3JlX3Zpc3VhbHx8MCkqMTAwKX0lPC9zcGFuPlxuICAgICAgICAke2Muc2NvcmVfbGF1Z2ggIT0gbnVsbCA/IGA8c3BhbiBhcmlhLWhpZGRlbj1cInRydWVcIiB0aXRsZT1cIkxhdWdoc1wiPjxzcGFuPvCfpKM8L3NwYW4+ICR7TWF0aC5yb3VuZChjLnNjb3JlX2xhdWdoKjEwMCl9JTwvc3Bhbj5gIDogJyd9XG4gICAgICAgIGAgOiBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHhcIiB0aXRsZT1cIlRoaXMgY2xpcCBoYXMgbm90IGJlZW4gc2NvcmVkIHlldFwiPk5vdCB5ZXQgc2NvcmVkPC9zcGFuPmB9XG4gICAgICA8L2Rpdj5cbiAgICAgICR7Yy5kZXNjcmlwdGlvbiA/IGA8ZGl2IGNsYXNzPVwiY2xpcC1kZXNjLXByZXZpZXdcIiB0aXRsZT1cIiR7ZXNjSHRtbChjLmRlc2NyaXB0aW9uKX1cIj4ke2VzY0h0bWwoYy5kZXNjcmlwdGlvbil9PC9kaXY+YCA6ICcnfVxuICAgICAgJHtfaG90d29yZFBpbGxzSFRNTChjLmhvdHdvcmRfbWF0Y2hlcyl9YDtcbiAgICBjb25zdCBjaGVja2JveCA9IGxpLnF1ZXJ5U2VsZWN0b3IoJy5jbGlwLXNlbGVjdC1jaGVja2JveCcpO1xuICAgIGNoZWNrYm94LmNoZWNrZWQgPSBBcHBTdGF0ZS5zZWxlY3RlZENsaXBJZHMuaGFzKGMuaWQpO1xuICAgIGNoZWNrYm94Lm9uY2xpY2sgPSBlID0+IGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY2hlY2tib3gub25jaGFuZ2UgPSAoKSA9PiB3aW5kb3cuX3RvZ2dsZUNsaXBTZWxlY3Rpb24oYy5pZCwgY2hlY2tib3guY2hlY2tlZCk7XG4gICAgbGlzdC5hcHBlbmRDaGlsZChsaSk7XG4gIH1cbiAgd2luZG93Ll91cGRhdGVCdWxrVG9vbGJhcigpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZWxlY3RDbGlwKGlkKSB7XG4gIEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCA9IGlkO1xuICAvLyBTeW5jIHRoZSBzaWRlYmFyIGhpZ2hsaWdodCBoZXJlIHNvIGV2ZXJ5IGNhbGxlciAtIHJvdyBjbGljaywgYXJyb3cta2V5XG4gIC8vIG5hdmlnYXRpb24sIHJlbGF0ZWQtY2xpcCBsaW5rcywgcG9zdC1yZXRyYW5zY3JpYmUgcmVzdG9yZSAtIG1vdmVzIGl0LlxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjY2xpcC1saXN0IGxpW2RhdGEtY2xpcC1pZF0nKS5mb3JFYWNoKGwgPT5cbiAgICBsLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIE51bWJlcihsLmRhdGFzZXQuY2xpcElkKSA9PT0gaWQpKTtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NsaXAtbGlzdCBsaS5hY3RpdmUnKT8uc2Nyb2xsSW50b1ZpZXcoe2Jsb2NrOiAnbmVhcmVzdCd9KTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3l1dWNsaXAtdmlldycsIEpTT04uc3RyaW5naWZ5KHt2aWRlb0lkOiBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkLCBjbGlwSWQ6IGlkfSkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJkZXRhaWwtZW1wdHlcIiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKVwiPkxvYWRpbmfigKY8L2Rpdj4nO1xuICB0cnkge1xuICAgIGNvbnN0IFtjbGlwUmVzLCBtZWRpYVJlc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBmZXRjaChgL2FwaS9jbGlwcy8ke2lkfWApLFxuICAgICAgZmV0Y2goYC9hcGkvY2xpcHMvJHtpZH0vbWVkaWFfdXJsYCksXG4gICAgXSk7XG4gICAgaWYgKCFjbGlwUmVzLm9rIHx8ICFtZWRpYVJlcy5vaykgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gbG9hZCBjbGlwJyk7XG4gICAgY29uc3QgY2xpcCAgPSBhd2FpdCBjbGlwUmVzLmpzb24oKTtcbiAgICBjb25zdCBtZWRpYSA9IGF3YWl0IG1lZGlhUmVzLmpzb24oKTtcbiAgICBjb25zdCBjYXB0aW9uc1VybCA9IG1lZGlhLmhhc19jYXB0aW9ucyA/IGAvYXBpL2NsaXBzLyR7aWR9L2NhcHRpb25zLnZ0dGAgOiBudWxsO1xuICAgIEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhID0gY2xpcDtcbiAgICBBcHBTdGF0ZS5hY3RpdmVNZWRpYUZpbGVuYW1lID0gbWVkaWEuZmlsZW5hbWU7XG4gICAgcmVuZGVyUGxheWVyKG1lZGlhLnVybCwgY2FwdGlvbnNVcmwsIGlkKTtcbiAgICByZW5kZXJEZXRhaWwoY2xpcCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNob3dUb2FzdChgQ291bGQgbm90IGxvYWQgY2xpcDogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgfVxufVxuXG4vLyBSZS1yZW5kZXIgdGhlIG9wZW4gY2xpcCdzIGRldGFpbCBwYW5lIChleGNlcnB0LCBzdGFsZSBub3RpY2UpIHdpdGhvdXQgdG91Y2hpbmdcbi8vIHRoZSBwbGF5ZXIuIFVzZWQgYWZ0ZXIgYW4gaW5saW5lIGNhcHRpb24gZWRpdCBjaGFuZ2VzIHRoZSBjbGlwJ3MgdHJhbnNjcmlwdC5cbmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hDbGlwRGV0YWlsKGlkKSB7XG4gIGlmIChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgIT09IGlkKSByZXR1cm47XG4gIHRyeSB7XG4gICAgY29uc3QgY2xpcCA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7aWR9YCkudGhlbihyID0+IHIuanNvbigpKTtcbiAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YSA9IGNsaXA7XG4gICAgcmVuZGVyRGV0YWlsKGNsaXApO1xuICB9IGNhdGNoIChfKSB7IC8qIGxlYXZlIHRoZSBzdGFsZSBkZXRhaWwgaW4gcGxhY2Ugb24gZXJyb3IgKi8gfVxufVxuXG4vLyDilIDilIAgcGxheWVyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gcmVuZGVyUGxheWVyKHVybCwgY2FwdGlvbnNVcmwsIGNsaXBJZCkge1xuICBjb25zdCBhcmVhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJyk7XG4gIGNvbnN0IGF1dG9wbGF5ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3l1dWNsaXAtYXV0b3BsYXknKSA9PT0gJ3RydWUnO1xuICBjb25zdCBsb29wQ2xpcCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd5dXVjbGlwLWxvb3AtY2xpcCcpID09PSAndHJ1ZSc7XG4gIGNvbnN0IHBsYXlOZXh0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3l1dWNsaXAtcGxheS1uZXh0JykgPT09ICd0cnVlJztcbiAgaWYgKHVybCkge1xuICAgIGNvbnN0IHRyYWNrID0gY2FwdGlvbnNVcmxcbiAgICAgID8gYDx0cmFjayBraW5kPVwiY2FwdGlvbnNcIiBzcmM9XCIke2VzY0h0bWwoY2FwdGlvbnNVcmwpfVwiIGxhYmVsPVwiQ2FwdGlvbnNcIiBkZWZhdWx0PmBcbiAgICAgIDogJyc7XG4gICAgYXJlYS5pbm5lckhUTUwgPSBgPHZpZGVvIGNvbnRyb2xzICR7YXV0b3BsYXkgPyAnYXV0b3BsYXknIDogJyd9ICR7bG9vcENsaXAgPyAnbG9vcCcgOiAnJ30gc3JjPVwiJHtlc2NIdG1sKHVybCl9XCIgYXJpYS1sYWJlbD1cIkNsaXAgcHJldmlld1wiPiR7dHJhY2t9PC92aWRlbz5gO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB3cmFwLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICBjb25zdCB2aWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2aWRlbycpO1xuICAgIHZpZC5jb250cm9scyA9IHRydWU7XG4gICAgdmlkLmF1dG9wbGF5ID0gYXV0b3BsYXk7XG4gICAgdmlkLmxvb3AgPSBsb29wQ2xpcDtcbiAgICB2aWQuc3JjID0gYC9hcGkvY2xpcHMvJHtjbGlwSWR9L3ByZXZpZXdgO1xuICAgIHZpZC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2xpcCBzb3VyY2UgcHJldmlldycpO1xuICAgIHZpZC5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6YmxvY2s7d2lkdGg6MTAwJTttYXgtaGVpZ2h0OnZhcigtLXBsYXllci1tYXgtaGVpZ2h0LCA0MnZoKTtvYmplY3QtZml0OmNvbnRhaW47YmFja2dyb3VuZDojMDAwJztcbiAgICB2aWQub25lcnJvciA9IGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGRldGFpbCA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcElkfS9wcmV2aWV3YClcbiAgICAgICAgLnRoZW4ociA9PiByLmpzb24oKSkudGhlbihqID0+IGouZGV0YWlsIHx8ICd1bmF2YWlsYWJsZScpLmNhdGNoKCgpID0+ICd1bmF2YWlsYWJsZScpO1xuICAgICAgd3JhcC5pbm5lckhUTUwgPSBgPGRpdiBzdHlsZT1cInBhZGRpbmc6MjRweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHhcIj5Tb3VyY2UgdmlkZW8gdW5hdmFpbGFibGU6ICR7ZXNjSHRtbChkZXRhaWwpfTwvZGl2PmA7XG4gICAgfTtcbiAgICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICBiYWRnZS5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOmFic29sdXRlO3RvcDo4cHg7bGVmdDo4cHg7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC42NSk7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDhweDtib3JkZXItcmFkaXVzOjRweDtwb2ludGVyLWV2ZW50czpub25lJztcbiAgICBiYWRnZS50ZXh0Q29udGVudCA9ICdTb3VyY2UgcHJldmlldyDCtyBub3QgZXhwb3J0ZWQnO1xuICAgIF9tYXJrUHJldmlld1F1YWxpdHkoYmFkZ2UsIGNsaXBJZCk7XG4gICAgd3JhcC5hcHBlbmRDaGlsZCh2aWQpO1xuICAgIHdyYXAuYXBwZW5kQ2hpbGQoYmFkZ2UpO1xuICAgIGFyZWEuaW5uZXJIVE1MID0gJyc7XG4gICAgYXJlYS5hcHBlbmRDaGlsZCh3cmFwKTtcbiAgfVxuICBpZiAocGxheU5leHQpIGFyZWEucXVlcnlTZWxlY3RvcigndmlkZW8nKT8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBfcGxheU5leHRDbGlwKTtcbn1cblxuLy8gQWR2YW5jZXMgdG8gdGhlIG5leHQgY2xpcCBpbiB0aGUgY3VycmVudCBmaWx0ZXJlZC9zb3J0ZWQgb3JkZXIgLSBzYW1lIHBhdGhcbi8vIGFycm93LWtleSBuYXZpZ2F0aW9uIHVzZXMgLSBhbmQgc3RvcHMgc2lsZW50bHkgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdC5cbmZ1bmN0aW9uIF9wbGF5TmV4dENsaXAoKSB7XG4gIGNvbnN0IGlkeCA9IEFwcFN0YXRlLmNsaXBzLmZpbmRJbmRleChjID0+IGMuaWQgPT09IEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCk7XG4gIGlmIChpZHggPT09IC0xIHx8IGlkeCA+PSBBcHBTdGF0ZS5jbGlwcy5sZW5ndGggLSAxKSByZXR1cm47XG4gIGNvbnN0IG5leHRJZCA9IEFwcFN0YXRlLmNsaXBzW2lkeCArIDFdLmlkO1xuICBzZWxlY3RDbGlwKG5leHRJZCk7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCNjbGlwLWxpc3QgbGlbZGF0YS1jbGlwLWlkPVwiJHtuZXh0SWR9XCJdYCk/LmZvY3VzKCk7XG59XG5cbi8vIFRoZSBjbGlwIHByZXZpZXcgcm91dGUgcHJlZmVycyB0aGUgNzIwcCBwcm94eSB3aGVuIG9uZSBleGlzdHM7IHJlZmxlY3QgdGhhdCBvblxuLy8gdGhlIGJhZGdlIHNvIHRoZSBjcmVhdG9yIGtub3dzIHRoZSBwcmV2aWV3IGlzbid0IGZ1bGwgcXVhbGl0eS5cbmFzeW5jIGZ1bmN0aW9uIF9tYXJrUHJldmlld1F1YWxpdHkoYmFkZ2UsIGNsaXBJZCkge1xuICBjb25zdCB2aWRlb0lkID0gQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGE/LnZpZGVvX2lkO1xuICBpZiAoIXZpZGVvSWQpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9wcm94eS1zdGF0dXNgKS50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogbnVsbCk7XG4gICAgaWYgKHN0YXR1cz8uYXZhaWxhYmxlICYmIEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCA9PT0gY2xpcElkKSB7XG4gICAgICBiYWRnZS50ZXh0Q29udGVudCA9ICdTb3VyY2UgcHJldmlldyDCtyA3MjBwIMK3IG5vdCBleHBvcnRlZCc7XG4gICAgICBiYWRnZS50aXRsZSA9ICdQcmV2aWV3ZWQgZnJvbSBhIGRvd25zY2FsZWQgNzIwcCBwcm94eSBmb3IgZmFzdCwgcmVsaWFibGUgcGxheWJhY2suJztcbiAgICB9XG4gIH0gY2F0Y2ggKF8pIHsgLyogbGVhdmUgdGhlIGRlZmF1bHQgYmFkZ2UgKi8gfVxufVxuXG4vLyBGdWxseSB0ZWFyIGRvd24gYW55IDx2aWRlbz4gaW4gdGhlIHBsYXllciBzbyB0aGUgYnJvd3NlciBhYm9ydHMgaXRzIHN0cmVhbWluZ1xuLy8gY29ubmVjdGlvbiB0byAvbWVkaWEvZXhwb3J0cy8qLiBVbnRpbCB0aGF0IGNvbm5lY3Rpb24gY2xvc2VzLCB0aGUgc2VydmVyJ3Ncbi8vIFN0YXRpY0ZpbGVzIGhhbmRsZSBvbiB0aGUgZmlsZSBzdGF5cyBvcGVuIGFuZCBXaW5kb3dzIHJlZnVzZXMgdG8gZGVsZXRlIGl0LlxuLy8gUmVtb3ZpbmcgdGhlIGVsZW1lbnQgYWxvbmUgaXMgbm90IGVub3VnaCAtIHRoZSBtZWRpYSByZXNvdXJjZSBtdXN0IGJlIHJlbGVhc2VkXG4vLyB2aWEgcGF1c2UgKyBjbGVhciBzcmMgKyBsb2FkKCkgYmVmb3JlIHRoZSBjb25uZWN0aW9uIGFjdHVhbGx5IGNsb3Nlcy5cbmZ1bmN0aW9uIF9yZWxlYXNlUGxheWVyTWVkaWEoKSB7XG4gIGNvbnN0IGFyZWEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyLWFyZWEnKTtcbiAgYXJlYS5xdWVyeVNlbGVjdG9yQWxsKCd2aWRlbycpLmZvckVhY2godmlkID0+IHtcbiAgICB0cnkgeyB2aWQucGF1c2UoKTsgfSBjYXRjaCAoXykge31cbiAgICB2aWQucmVtb3ZlQXR0cmlidXRlKCdzcmMnKTtcbiAgICB2aWQubG9hZCgpO1xuICB9KTtcbiAgYXJlYS5pbm5lckhUTUwgPSAnJztcbn1cblxuLy8gQ2FsbCBiZWZvcmUgYW55IGRlbGV0ZSB0aGF0IHJlbW92ZXMgYSBmaWxlIHRoZSBwbGF5ZXIgbWF5IGJlIHN0cmVhbWluZy4gUmVsZWFzZXNcbi8vIHRoZSA8dmlkZW8+LCB0aGVuIHdhaXRzIHNvIHRoZSBicm93c2VyIGNhbiBmaW5pc2ggYWJvcnRpbmcgdGhlIHRyYW5zZmVyIGFuZCB0aGVcbi8vIHNlcnZlciBjYW4gY2xvc2UgaXRzIGZpbGUgaGFuZGxlIGJlZm9yZSB0aGUgZGVsZXRlIHJlcXVlc3QgYXJyaXZlcy5cbmFzeW5jIGZ1bmN0aW9uIF9yZWxlYXNlUGxheWVyQmVmb3JlRGVsZXRlKCkge1xuICBfcmVsZWFzZVBsYXllck1lZGlhKCk7XG4gIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA0MDApKTtcbn1cblxuLy8g4pSA4pSAIGRldGFpbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmZ1bmN0aW9uIF9mbXRTaXplTWIoYnl0ZXMpIHtcbiAgaWYgKGJ5dGVzID09IG51bGwpIHJldHVybiAnJztcbiAgcmV0dXJuIGAkeyhieXRlcyAvICgxMDI0ICogMTAyNCkpLnRvRml4ZWQoMSl9IE1CYDtcbn1cblxuLy8gT25lIHJvdyBwZXIgZXhwb3J0ZWQgZm9ybWF0IChFeHBvcnQgcHJlc2V0cyAtIFBsYW4gMDcpLiBGYWxscyBiYWNrIHRvIHRoZVxuLy8gbGVnYWN5IHNpbmdsZS1ibG9jayBkaXNwbGF5IHdoZW4gYSBjbGlwIGhhcyBoYXNfZXhwb3J0IGJ1dCBubyBjbGlwX2V4cG9ydHNcbi8vIHJvd3MgeWV0IChhIHByb2plY3Qgbm90IGJhY2tmaWxsZWQsIG9yIGEgY2xpcCBtdXRhdGVkIGRpcmVjdGx5IGluIGEgdGVzdCkuXG5mdW5jdGlvbiBfZXhwb3J0Rm9ybWF0c0h0bWwoY2xpcCkge1xuICBpZiAoIWNsaXAuaGFzX2V4cG9ydCkgcmV0dXJuICcnO1xuICBjb25zdCByb3dzID0gKGNsaXAuZXhwb3J0cyB8fCBbXSkuZmlsdGVyKHIgPT4gci5leGlzdHMpO1xuICBpZiAoIXJvd3MubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGBcbiAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjhweDttYXJnaW4tYm90dG9tOjRweDtmb250LXNpemU6MTBweDtmb250LXdlaWdodDo2MDA7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2xldHRlci1zcGFjaW5nOi42cHhcIj5FeHBvcnRlZDwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6MTJweDtmbGV4LXdyYXA6d3JhcFwiPlxuICAgICAgICAke2NsaXAuZXhwb3J0ZWRfY29udGFpbmVyID8gYDxzcGFuPkNvbnRhaW5lcjogPHN0cm9uZyBzdHlsZT1cImNvbG9yOnZhcigtLXRleHQpXCI+JHtlc2NIdG1sKGNsaXAuZXhwb3J0ZWRfY29udGFpbmVyLnRvVXBwZXJDYXNlKCkpfTwvc3Ryb25nPjwvc3Bhbj5gIDogJyd9XG4gICAgICAgIDxzcGFuPkNhcHRpb25zOiA8c3Ryb25nIHN0eWxlPVwiY29sb3I6dmFyKC0tdGV4dClcIj4ke1xuICAgICAgICAgIGNsaXAuc3VidGl0bGVfc3RhdHVzID09PSAnYmFrZWQtaW4nICAgID8gJ0Jha2VkIGluJyA6XG4gICAgICAgICAgY2xpcC5zdWJ0aXRsZV9zdGF0dXMgPT09ICdzcnQtc2lkZWNhcicgPyAnU1JUIHNpZGVjYXInIDpcbiAgICAgICAgICAnTm9uZSdcbiAgICAgICAgfTwvc3Ryb25nPjwvc3Bhbj5cbiAgICAgICAgJHtjbGlwLmV4cG9ydGVkX2F0ID8gYDxzcGFuPldoZW46IDxzdHJvbmcgc3R5bGU9XCJjb2xvcjp2YXIoLS10ZXh0KVwiPiR7X2ZtdEFnbyhjbGlwLmV4cG9ydGVkX2F0KX08L3N0cm9uZz48L3NwYW4+YCA6ICcnfVxuICAgICAgPC9kaXY+XG4gICAgICAke2NsaXAuZXhwb3J0X3N0YWxlID8gYDxkaXYgY2xhc3M9XCJ0cmFuc2NyaXB0LXN0YWxlLW5vdGVcIiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+JiM5ODg4OyBTdGFsZSAtIHJlLWV4cG9ydCB0byB1cGRhdGUgKCR7ZXNjSHRtbCgoY2xpcC5leHBvcnRfc3RhbGVfcmVhc29ucyB8fCBbXSkuam9pbignLCAnKSl9KTwvZGl2PmAgOiAnJ31gO1xuICB9XG4gIHJldHVybiBgXG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4O21hcmdpbi1ib3R0b206NHB4O2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjYwMDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6LjZweFwiPkV4cG9ydGVkIGZvcm1hdHM8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6OHB4XCI+XG4gICAgICAke3Jvd3MubWFwKHJvdyA9PiBgXG4gICAgICAgIDxkaXYgY2xhc3M9XCJleHBvcnQtZm9ybWF0LXJvd1wiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIiBkYXRhLWV4cG9ydC1pZD1cIiR7cm93LmlkfVwiIGRhdGEtcHJlc2V0LW5hbWU9XCIke2VzY0h0bWwocm93LnByZXNldF9uYW1lKX1cIlxuICAgICAgICAgICAgIGRhdGEtZmlsZW5hbWU9XCIke2VzY0h0bWwocm93LmZpbGVuYW1lKX1cIiBkYXRhLWJ1cm4tc3Vicz1cIiR7cm93LmJ1cm5fc3VicyA/ICcxJyA6ICcnfVwiXG4gICAgICAgICAgICAgZGF0YS1lbWJlZC1zdWJzPVwiJHtyb3cuZW1iZWRfc3VicyA/ICcxJyA6ICcnfVwiIGRhdGEtdGl0bGUtY2FyZD1cIiR7cm93LnRpdGxlX2NhcmQgPyAnMScgOiAnJ31cIlxuICAgICAgICAgICAgIHN0eWxlPVwiYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6OHB4XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6MTBweDtmbGV4LXdyYXA6d3JhcDthbGlnbi1pdGVtczpiYXNlbGluZVwiPlxuICAgICAgICAgICAgPHN0cm9uZyBzdHlsZT1cImNvbG9yOnZhcigtLXRleHQpXCI+JHtlc2NIdG1sKHdpbmRvdy5leHBvcnRQcmVzZXRMYWJlbChyb3cucHJlc2V0X25hbWUpKX08L3N0cm9uZz5cbiAgICAgICAgICAgIDxzcGFuPiR7ZXNjSHRtbChyb3cuY29udGFpbmVyLnRvVXBwZXJDYXNlKCkpfTwvc3Bhbj5cbiAgICAgICAgICAgIDxzcGFuPiR7X2ZtdFNpemVNYihyb3cuc2l6ZV9ieXRlcyl9PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4+JHtfZm10QWdvKHJvdy5jcmVhdGVkX2F0KX08L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgJHtyb3cuZXhwb3J0X3N0YWxlID8gYDxkaXYgY2xhc3M9XCJ0cmFuc2NyaXB0LXN0YWxlLW5vdGVcIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+JiM5ODg4OyBTdGFsZSAtIHJlLWV4cG9ydCB0byB1cGRhdGUgKCR7ZXNjSHRtbCgocm93LmV4cG9ydF9zdGFsZV9yZWFzb25zIHx8IFtdKS5qb2luKCcsICcpKX0pPC9kaXY+YCA6ICcnfVxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjRweDtmbGV4LXdyYXA6d3JhcDttYXJnaW4tdG9wOjZweFwiPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIGRhdGEtZXhwb3J0LWFjdGlvbj1cImRvd25sb2FkXCI+RG93bmxvYWQ8L2J1dHRvbj5cbiAgICAgICAgICAgICR7QXBwU3RhdGUuY2FuUmV2ZWFsID8gYDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWV4cG9ydC1hY3Rpb249XCJyZXZlYWxcIj5TaG93IGluIGZvbGRlcjwvYnV0dG9uPmAgOiAnJ31cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWV4cG9ydC1hY3Rpb249XCJjb3B5LXBhdGhcIj5Db3B5IHBhdGg8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWV4cG9ydC1hY3Rpb249XCJyZWdlbmVyYXRlXCI+UmVnZW5lcmF0ZTwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBkYW5nZXJcIiBkYXRhLWV4cG9ydC1hY3Rpb249XCJkZWxldGVcIj5EZWxldGU8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+YCkuam9pbignJyl9XG4gICAgPC9kaXY+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJ0bi1zZWNvbmRhcnlcIiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCIgZGF0YS1hY3Q9XCJleHBvcnQtY2xpcFwiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj4rIEV4cG9ydCBhbm90aGVyIGZvcm1hdDwvYnV0dG9uPmA7XG59XG5cbi8vIFRydWUgd2hlbiBhIGNsaXAncyBvbmx5IG9uZS1saW5lciBpcyB0aGUgdHJhbnNjcmlwdC1kZXJpdmVkIHRlbXBsYXRlICh0YWdnZWRcbi8vIGRlc2NfYmFzaWMpLCBubyBsYW5ndWFnZSBtb2RlbCBpcyB1c2FibGUgcmlnaHQgbm93LCBhbmQgZ2VuZXJhdGl2ZSBBSSB3YXMgbm90XG4vLyBkZWxpYmVyYXRlbHkgdHVybmVkIG9mZi4gSW4gdGhhdCBmaXJzdC1ydW4gc3RhdGUgdGhlIHRlbXBsYXRlIHRleHQgKGEgZmV3XG4vLyB0cmFuc2NyaXB0IHdvcmRzKSByZWFkcyBhcyBhIGJyb2tlbiBkZXNjcmlwdGlvbiwgc28gdGhlIGRlc2NyaXB0aW9uIGFyZWEgc2hvd3MgYVxuLy8gY2xlYXIgXCJzZXQgdXAgYSBtb2RlbFwiIHBsYWNlaG9sZGVyIGluc3RlYWQgb2YgcXVvdGluZyBpdC4gQSB1c2VyIGVkaXQgKHdoaWNoXG4vLyBzdHJpcHMgZGVzY19iYXNpYyBhbnl3YXkpIGlzIG5ldmVyIGhpZGRlbi5cbmZ1bmN0aW9uIF9kZXNjTmVlZHNNb2RlbChjbGlwKSB7XG4gIHJldHVybiAhIWNsaXAudGFncyAmJiBjbGlwLnRhZ3MuaW5jbHVkZXMoJ2Rlc2NfYmFzaWMnKVxuICAgICYmICFjbGlwLmRlc2NyaXB0aW9uX2lzX2VkaXRlZFxuICAgICYmICEoKHdpbmRvdy5fcHJlcmVxcyB8fCB7fSkubGxtX29rKVxuICAgICYmICh3aW5kb3cuX2FpUHJpdmFjeU1vZGUgfHwgJ2xvY2FsX29ubHknKSAhPT0gJ25vbmUnO1xufVxuXG4vLyBUaGUgY2xpcCdzIG9uZS1saW5lciBhcmVhLiBJbiB0aGUgbm8tbW9kZWwgZmlyc3QtcnVuIHN0YXRlIGEgZGVzY19iYXNpYyBjbGlwIGdldHNcbi8vIGEgY2FsbC10by1hY3Rpb24gcGxhY2Vob2xkZXIgKHNlZSBfZGVzY05lZWRzTW9kZWwpOyBvdGhlcndpc2UgdGhlIGRlc2NyaXB0aW9uIChvclxuLy8gYW4gXCJub3Qgc2NvcmVkIHlldFwiIGhpbnQpIHBsdXMgdGhlIGJhc2ljLWZhbGxiYWNrIGxhYmVsbGluZyBjaGlwLlxuZnVuY3Rpb24gX2NsaXBEZXNjcmlwdGlvbkhUTUwoY2xpcCkge1xuICBpZiAoX2Rlc2NOZWVkc01vZGVsKGNsaXApKSB7XG4gICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwibmVlZHMtbW9kZWwtY3RhXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibmVlZHMtbW9kZWwtaGVhZGluZ1wiPkFJIGRlc2NyaXB0aW9ucyBuZWVkIGEgbG9jYWwgbW9kZWw8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJuZWVkcy1tb2RlbC1kZXRhaWxcIj5CYXNlbGluZSBzY29yaW5nIGFscmVhZHkgcmFuLiBTZXQgdXAgYSBsb2NhbCBsYW5ndWFnZSBtb2RlbCB0byBhZGQgYSB3cml0dGVuIGRlc2NyaXB0aW9uIGZvciBlYWNoIGNsaXAuPC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA5cHhcIiBkYXRhLWFjdD1cIm9wZW4tbGxtLXNldHRpbmdzXCI+U2V0IHVwIGEgbG9jYWwgbW9kZWw8L2J1dHRvbj5cbiAgICA8L2Rpdj5gO1xuICB9XG4gIGNvbnN0IGJvZHkgPSBjbGlwLmRlc2NyaXB0aW9uXG4gICAgPyBgXCIke2VzY0h0bWwoY2xpcC5kZXNjcmlwdGlvbil9XCJgXG4gICAgOiBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHhcIj5ObyBkZXNjcmlwdGlvbiB5ZXQgLSBSZS1zY29yZSB0byBnZW5lcmF0ZTwvc3Bhbj5gO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJkZXNjcmlwdGlvblwiPiR7Ym9keX08L2Rpdj4ke19iYXNpY0Rlc2NDaGlwSFRNTChjbGlwKX1gO1xufVxuXG4vLyBBIHN1YnRsZSBudWRnZSB1bmRlciBhIGNsaXAgd2hvc2Ugb25lLWxpbmVyIGlzIHRoZSBub24tTExNIHRlbXBsYXRlIGZhbGxiYWNrXG4vLyAodGFnZ2VkIGRlc2NfYmFzaWMgYnkgdGhlIHNjb3JpbmcgZW5naW5lKS4gVGhlIG1lc3NhZ2UgYWRhcHRzIHRvIHdoeSBubyBsYW5ndWFnZVxuLy8gbW9kZWwgd3JvdGUgdGhlIGRlc2NyaXB0aW9uLiBUaGUgbm8tbW9kZWwgY2FzZSBpcyBoYW5kbGVkIGJ5IF9kZXNjTmVlZHNNb2RlbCAvXG4vLyBfY2xpcERlc2NyaXB0aW9uSFRNTCBpbnN0ZWFkLCBzbyB0aGlzIG9ubHkgY292ZXJzIFwiQUkgZGVsaWJlcmF0ZWx5IG9mZlwiICh0aGVcbi8vIHRlbXBsYXRlIGlzIHRoZSBpbnRlbmRlZCBvdXRwdXQpIGFuZCBcIm1vZGVsIHNldCB1cCBub3csIHJlLWFuYWx5emUgdG8gdXBncmFkZVwiLlxuZnVuY3Rpb24gX2Jhc2ljRGVzY0NoaXBIVE1MKGNsaXApIHtcbiAgaWYgKCFjbGlwLnRhZ3MgfHwgIWNsaXAudGFncy5pbmNsdWRlcygnZGVzY19iYXNpYycpKSByZXR1cm4gJyc7XG4gIGNvbnN0IHRpcCA9ICdUaGlzIG9uZS1saW5lciB3YXMgYnVpbHQgZnJvbSB0aGUgdHJhbnNjcmlwdCB3aXRob3V0IGEgbGFuZ3VhZ2UgbW9kZWwnO1xuICAvLyBVbmRlciBcIk5vIGdlbmVyYXRpdmUgQUlcIiB0aGUgdXNlciBvcHRlZCBvdXQgb2YgbGFuZ3VhZ2UgbW9kZWxzIC0gc2hvdyBhIG5ldXRyYWxcbiAgLy8gbm90ZSwgbmV2ZXIgYSBzZXR1cCBudWRnZSAoU3RhZ2UgMDcpLlxuICBpZiAoKHdpbmRvdy5fYWlQcml2YWN5TW9kZSB8fCAnbG9jYWxfb25seScpID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJiYXNpYy1kZXNjLWNoaXBcIiB0aXRsZT1cIiR7dGlwfVwiPkJhc2ljIGRlc2NyaXB0aW9uIC0gZ2VuZXJhdGl2ZSBBSSBpcyB0dXJuZWQgb2ZmPC9kaXY+YDtcbiAgfVxuICAvLyBBIGxhbmd1YWdlIG1vZGVsIGlzIHVzYWJsZSByaWdodCBub3csIHNvIHRoZSBjbGlwIGlzIGJhc2ljIG9ubHkgYmVjYXVzZSBpdCB3YXNcbiAgLy8gc2NvcmVkIGJlZm9yZSB0aGUgbW9kZWwgd2FzIGF2YWlsYWJsZSAtIHJlLWFuYWx5emluZyB1cGdyYWRlcyBpdC5cbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiYmFzaWMtZGVzYy1jaGlwXCIgdGl0bGU9XCIke3RpcH1cIj5CYXNpYyBkZXNjcmlwdGlvbiAtIGEgbGFuZ3VhZ2UgbW9kZWwgaXMgc2V0IHVwIG5vdzsgcmUtYW5hbHl6ZSB0aGlzIHJlY29yZGluZyB0byBhZGQgYW4gQUkgZGVzY3JpcHRpb248L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiByZW5kZXJEZXRhaWwoY2xpcCkge1xuICBjb25zdCBlYiA9IChpc0VkaXRlZCkgPT4gaXNFZGl0ZWQgPyBgPHNwYW4gY2xhc3M9XCJlZGl0ZWQtYmFkZ2VcIj5lZGl0ZWQ8L3NwYW4+YCA6ICcnO1xuXG4gIGNvbnN0IHRyaW1FeHBvcnRIdG1sID0gYFxuICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZClcIj5cbiAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOjRweDtmb250LXNpemU6MTBweDtmb250LXdlaWdodDo2MDA7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2xldHRlci1zcGFjaW5nOi42cHhcIj5UcmltPC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDoxMnB4O2ZsZXgtd3JhcDp3cmFwO2FsaWduLWl0ZW1zOmNlbnRlclwiPlxuICAgICAgICA8c3Bhbj5TdGFydCA8c3Ryb25nIHN0eWxlPVwiY29sb3I6dmFyKC0tdGV4dCk7Zm9udC1mYW1pbHk6bW9ub3NwYWNlXCI+JHtfZm10T2Zmc2V0KGNsaXAuc3RhcnRfb2Zmc2V0KX08L3N0cm9uZz48L3NwYW4+XG4gICAgICAgIDxzcGFuPkVuZCA8c3Ryb25nIHN0eWxlPVwiY29sb3I6dmFyKC0tdGV4dCk7Zm9udC1mYW1pbHk6bW9ub3NwYWNlXCI+JHtfZm10T2Zmc2V0KGNsaXAuZW5kX29mZnNldCl9PC9zdHJvbmc+PC9zcGFuPlxuICAgICAgICA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4XCI+KGVkaXQgaW4gRXhwb3J0KTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAgJHtfZXhwb3J0Rm9ybWF0c0h0bWwoY2xpcCl9XG4gICAgPC9kaXY+YDtcblxuICBjb25zdCBzY29yaW5nQWN0aW9uc0h0bWwgPSBgXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkcy1yb3dcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPlNjb3Jpbmc8L3NwYW4+XG4gICAgICAgICAgJHtjbGlwLnNjb3JlZF9hdCAmJiBjbGlwLnNjb3JlX292ZXJhbGxfdXNlciAhPSBudWxsXG4gICAgICAgICAgICA/IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjJweCA4cHhcIiBkYXRhLWFjdD1cImNsZWFyLXNjb3JlLW92ZXJyaWRlXCIgZGF0YS1jbGlwLWlkPVwiJHtjbGlwLmlkfVwiIHRpdGxlPVwiUmVtb3ZlIG1hbnVhbCBzY29yZSBvdmVycmlkZVwiPlJlbW92ZSBPdmVycmlkZTwvYnV0dG9uPmBcbiAgICAgICAgICAgIDogY2xpcC5zY29yZWRfYXRcbiAgICAgICAgICAgID8gYDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6MnB4IDhweFwiIGRhdGEtYWN0PVwib3Blbi1zY29yZS1vdmVycmlkZVwiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj5PdmVycmlkZSBTY29yZTwvYnV0dG9uPmBcbiAgICAgICAgICAgIDogJyd9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwic2NvcmVzXCI+XG4gICAgICAgICAgJHshY2xpcC5zY29yZWRfYXQgPyBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHhcIj5Ob3QgeWV0IHNjb3JlZCAtIFJlLXNjb3JlIHRvIGdlbmVyYXRlPC9zcGFuPmAgOlxuICAgICAgICAgICAgY2xpcC5zY29yZV9vdmVyYWxsX3VzZXIgIT0gbnVsbFxuICAgICAgICAgICAgPyBzY29yZVJvd092ZXJyaWRlKCdPdmVyYWxsJywgY2xpcC5zY29yZV9vdmVyYWxsLCBjbGlwLnNjb3JlX292ZXJhbGxfdXNlciwgJ292ZXJhbGwnKVxuICAgICAgICAgICAgOiBzY29yZVJvdygnT3ZlcmFsbCcsIGNsaXAuc2NvcmVfb3ZlcmFsbCwgJ292ZXJhbGwnKX1cbiAgICAgICAgICAke2NsaXAuc2NvcmVkX2F0ID8gc2NvcmVSb3coJ0Z1bm55JywgICAgY2xpcC5zY29yZV9mdW5ueSwgICAgJ2Z1bm55JykgICAgOiAnJ31cbiAgICAgICAgICAke2NsaXAuc2NvcmVkX2F0ID8gc2NvcmVSb3coJ0RyYW1hdGljJywgY2xpcC5zY29yZV9kcmFtYXRpYywgJ2RyYW1hdGljJykgOiAnJ31cbiAgICAgICAgICAke2NsaXAuc2NvcmVkX2F0ID8gc2NvcmVSb3coJ0FjdGlvbicsICAgY2xpcC5zY29yZV9hY3Rpb24sICAgJ2FjdGlvbicpICAgOiAnJ31cbiAgICAgICAgICAke2NsaXAuc2NvcmVkX2F0ID8gc2NvcmVSb3coJ1Zpc3VhbCcsICAgY2xpcC5zY29yZV92aXN1YWwgfHwgMCwgJ3Zpc3VhbCcpIDogJyd9XG4gICAgICAgICAgJHtjbGlwLnNjb3JlZF9hdCAmJiBjbGlwLnNjb3JlX2xhdWdoICE9IG51bGwgPyBzY29yZVJvdygnTGF1Z2hzJywgY2xpcC5zY29yZV9sYXVnaCwgJ2xhdWdoJykgOiAnJ31cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+PHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPkFjdGlvbnM8L3NwYW4+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjbGlwLWFjdGlvbnNcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicmV2aWV3LWFjdGlvbnNcIj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gYXBwcm92ZSAke2NsaXAuc3RhdHVzPT09J2FwcHJvdmVkJz8nYWN0aXZlJzonJ31cIiBkYXRhLWFjdD1cInNldC1zdGF0dXNcIiBkYXRhLWNsaXAtaWQ9XCIke2NsaXAuaWR9XCIgZGF0YS1zdGF0dXM9XCIke2NsaXAuc3RhdHVzPT09J2FwcHJvdmVkJz8ncGVuZGluZyc6J2FwcHJvdmVkJ31cIiB0aXRsZT1cIkFwcHJvdmUgKHByZXNzIEEpXCI+QXBwcm92ZTwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biByZWplY3QgICR7Y2xpcC5zdGF0dXM9PT0ncmVqZWN0ZWQnPydhY3RpdmUnOicnfVwiIGRhdGEtYWN0PVwic2V0LXN0YXR1c1wiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIiBkYXRhLXN0YXR1cz1cIiR7Y2xpcC5zdGF0dXM9PT0ncmVqZWN0ZWQnPydwZW5kaW5nJzoncmVqZWN0ZWQnfVwiIHRpdGxlPVwiUmVqZWN0IChwcmVzcyBSKVwiPlJlamVjdDwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biAke2NsaXAuc3RhdHVzPT09J3BlbmRpbmcnPydhY3RpdmUnOicnfVwiIGRhdGEtYWN0PVwic2V0LXN0YXR1c1wiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIiBkYXRhLXN0YXR1cz1cInBlbmRpbmdcIiB0aXRsZT1cIk1hcmsgYXMgVW5yZXZpZXdlZCAocHJlc3MgVSlcIj5VbnJldmlld2VkPC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm9wLWFjdGlvbnNcIj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gaGlnaGxpZ2h0XCIgZGF0YS1hY3Q9XCJleHBvcnQtY2xpcFwiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj4ke2NsaXAuaGFzX2V4cG9ydCA/ICdSZS1leHBvcnQnIDogJ0V4cG9ydCd9PC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgZGF0YS1hY3Q9XCJvcGVuLWNsaXAtYWN0aW9ucy1tb2RhbFwiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj5BZGRpdGlvbmFsIEFjdGlvbnM8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xuXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtdHlwZS1iYWRnZSBjbGlwLWJhZGdlXCIgc3R5bGU9XCJtYXJnaW4tYm90dG9tOjhweFwiPiYjMTI3OTAyOyBDbGlwICMke2NsaXAuaWR9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiY2xpcC1oZWFkZXJcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJ0aW1lXCI+JHtjbGlwLnN0YXJ0X2htc30gJm1pZGRvdDsgJHtjbGlwLmR1cmF0aW9uX2htc308L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cblxuICAgICR7X2R1cGxpY2F0ZU5vdGljZUhUTUwoY2xpcCl9XG5cbiAgICAke3Njb3JpbmdBY3Rpb25zSHRtbH1cblxuICAgICR7Y29sbGFwc2libGVDYXJkKCdjbGlwLWRlc2NyaXB0aW9uJyxcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5EZXNjcmlwdGlvbiR7ZWIoY2xpcC5kZXNjcmlwdGlvbl9pc19lZGl0ZWQpfTwvc3Bhbj5gLCBgXG4gICAgICAke19jbGlwRGVzY3JpcHRpb25IVE1MKGNsaXApfVxuXG4gICAgICAke2NsaXAuZGVzY3JpcHRpb25fbG9uZyA/IGBcbiAgICAgICAgPGhyIGNsYXNzPVwiZGV0YWlsLWNhcmQtZGl2aWRlclwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPkZ1bGwgRGVzY3JpcHRpb24ke2ViKGNsaXAuZGVzY3JpcHRpb25fbG9uZ19pc19lZGl0ZWQpfTwvc3Bhbj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwia2ViYWItYnRuXCIgdGl0bGU9XCJFZGl0IG9yIHJlZ2VuZXJhdGUgbG9uZyBkZXNjcmlwdGlvblwiIGFyaWEtbGFiZWw9XCJFZGl0IG9yIHJlZ2VuZXJhdGUgbG9uZyBkZXNjcmlwdGlvblwiIGRhdGEtYWN0PVwib3Blbi1kZXNjLWxvbmcta2ViYWJcIiBkYXRhLWNsaXAtaWQ9XCIke2NsaXAuaWR9XCI+JiM4OTQyOzwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRlc2NyaXB0aW9uLWxvbmdcIj4ke2VzY0h0bWwoY2xpcC5kZXNjcmlwdGlvbl9sb25nKX08L2Rpdj5gIDogJyd9XG5cbiAgICAgIDxociBjbGFzcz1cImRldGFpbC1jYXJkLWRpdmlkZXJcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZC1oZWFkZXJcIj48c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+VGFnczwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjbGlwLXRhZ3NcIiBpZD1cImNsaXAtdXNlci10YWdzXCI+JHtfY2xpcFRhZ1BpbGxzSFRNTChjbGlwLnVzZXJfdGFncyl9PC9kaXY+XG4gICAgICA8aW5wdXQgbGlzdD1cImNsaXAtdGFncy1kYXRhbGlzdFwiIGlkPVwiY2xpcC10YWctaW5wdXRcIiBjbGFzcz1cInRhZy1pbnB1dFwiXG4gICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJBZGQgYSB0YWfigKZcIiBtYXhsZW5ndGg9XCI0MFwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiIGFyaWEtbGFiZWw9XCJBZGQgYSB0YWdcIj5cbiAgICAgIDxkYXRhbGlzdCBpZD1cImNsaXAtdGFncy1kYXRhbGlzdFwiPjwvZGF0YWxpc3Q+XG4gICAgICAke19nZW5lcmF0ZWRUYWdQaWxsc0hUTUwoY2xpcC50YWdzKX1gLCB7XG4gICAgICBhY3Rpb25zOiBgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6NHB4XCI+XG4gICAgICAgICAgJHtjbGlwLmRlc2NyaXB0aW9uICYmICFfZGVzY05lZWRzTW9kZWwoY2xpcCkgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOXB4XCIgdGl0bGU9XCJDb3B5IGRlc2NyaXB0aW9uXCIgYXJpYS1sYWJlbD1cIkNvcHkgZGVzY3JpcHRpb25cIiBkYXRhLWNvcHk9XCJkZXNjcmlwdGlvblwiPkNvcHk8L2J1dHRvbj5gIDogJyd9XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImtlYmFiLWJ0blwiIHRpdGxlPVwiRWRpdCBvciByZWdlbmVyYXRlIGRlc2NyaXB0aW9uXCIgYXJpYS1sYWJlbD1cIkVkaXQgb3IgcmVnZW5lcmF0ZSBkZXNjcmlwdGlvblwiIGRhdGEtYWN0PVwib3Blbi1kZXNjLWtlYmFiXCIgZGF0YS1jbGlwLWlkPVwiJHtjbGlwLmlkfVwiPiYjODk0Mjs8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+YCxcbiAgICB9KX1cblxuICAgICR7X3Zpc2lvbkRldGFpbEhUTUwoY2xpcCl9XG4gICAgJHtfaG90d29yZERldGFpbEhUTUwoY2xpcCl9XG4gICAgJHtfc2Vuc2l0aXZlRGV0YWlsSFRNTChjbGlwKX1cblxuICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkLWhlYWRlclwiPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+RXhwb3J0PC9zcGFuPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTJweDtwYWRkaW5nOjJweCAxMHB4XCIgZGF0YS1hY3Q9XCJvcGVuLWV4cG9ydC1lZGl0b3JcIiBkYXRhLWNsaXAtaWQ9XCIke2NsaXAuaWR9XCIgdGl0bGU9XCJUcmltLCBmcmFtZSB2ZXJ0aWNhbCwgcHJldmlldyBjYXB0aW9ucywgdGhlbiBleHBvcnRcIj5FZGl0ICZhbXA7IGV4cG9ydDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICAke3RyaW1FeHBvcnRIdG1sfVxuICAgIDwvZGl2PlxuXG4gICAgJHtjbGlwLnJlbGF0ZWRfY2xpcHMgPyBjb2xsYXBzaWJsZUNhcmQoJ2NsaXAtcmVsYXRlZCcsXG4gICAgICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5SZWxhdGVkIENsaXBzPC9zcGFuPmAsIGBcbiAgICAgICAgJHtjbGlwLnJlbGF0ZWRfY2xpcHMubGVuZ3RoID8gY2xpcC5yZWxhdGVkX2NsaXBzLm1hcChyID0+IGBcbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDo4cHg7YWxpZ24taXRlbXM6YmFzZWxpbmU7cGFkZGluZzo0cHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpXCI+XG4gICAgICAgICAgICA8YSBocmVmPVwiI1wiIHN0eWxlPVwiY29sb3I6dmFyKC0tYWNjZW50KTt0ZXh0LWRlY29yYXRpb246bm9uZTtmb250LXNpemU6MTNweDt3aGl0ZS1zcGFjZTpub3dyYXBcIiBkYXRhLWFjdD1cInNlbGVjdC1yZWxhdGVkLWNsaXBcIiBkYXRhLWNsaXAtaWQ9XCIke3IuaWR9XCI+IyR7ci5pZH08L2E+XG4gICAgICAgICAgICA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZToxMnB4O2NvbG9yOnZhcigtLW11dGVkKVwiPiR7ZXNjSHRtbChyLnJlYXNvbil9PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PmApLmpvaW4oJycpIDogYDxkaXYgc3R5bGU9XCJmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZClcIj5ObyBzaW1pbGFyIGNsaXBzIGZvdW5kPC9kaXY+YH1gLFxuICAgICAgeyBhdHRyczogJ2lkPVwicmVsYXRlZC1jbGlwcy1zZWN0aW9uXCInLCBoZWFkZXJTdHlsZTogJ2p1c3RpZnktY29udGVudDpmbGV4LXN0YXJ0O2dhcDo4cHgnLFxuICAgICAgICBhY3Rpb25zOiBgJHtjbGlwLnJlbGF0ZWRfY2xpcHNfc3RhbGUgPyBgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS13YXJuaW5nKTtmb250LXN0eWxlOml0YWxpY1wiPnN0YWxlIC0gcmUtc2NvcmUgdXBkYXRlZDwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS1tdXRlZCk7bWFyZ2luLWxlZnQ6YXV0b1wiPiR7Y2xpcC5yZWxhdGVkX2NsaXBzX2F0ID8gX2ZtdEFnbyhjbGlwLnJlbGF0ZWRfY2xpcHNfYXQpIDogJyd9PC9zcGFuPmAgfSkgOiAnJ31cblxuICAgICR7X3RyYW5zY3JpcHRDYXJkSFRNTChjbGlwKX1cbiAgYDtcblxuICBpZiAoY2xpcC50cmFuc2NyaXB0X2V4Y2VycHQgJiYgd2luZG93LmxvYWRDbGlwVHJhbnNjcmlwdCkgd2luZG93LmxvYWRDbGlwVHJhbnNjcmlwdChjbGlwLmlkKTtcbiAgX3JlbmRlclRhZ0RhdGFsaXN0KCk7XG4gIF9sb2FkVGFnU3VnZ2VzdGlvbnMoKS50aGVuKF9yZW5kZXJUYWdEYXRhbGlzdCk7XG4gIGNvbnN0IHZpc2lvbkJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbmFseXplLWZyYW1lcy1idG4nKTtcbiAgaWYgKHZpc2lvbkJ0bikge1xuICAgIGdhdGVPbkNhcGFiaWxpdHkodmlzaW9uQnRuLCAndmlzaW9uJyxcbiAgICAgICdGcmFtZSBhbmFseXNpcyBuZWVkcyBhIHZpc2lvbi1jYXBhYmxlIG1vZGVsLicpO1xuICB9XG4gIC8vIEEgcGFuZWwgcmVidWlsdCB3aGlsZSBhIGpvYiBydW5zIG11c3QgY29tZSB1cCB3aXRoIGl0cyBoZWF2eSBidXR0b25zIGRpc2FibGVkLlxuICBhcHBseUpvYkJsb2NrZWRTdGF0ZSgpO1xufVxuXG4vLyBBIGNsaXAgd2l0aCBubyB0cmFuc2NyaXB0IGV4Y2VycHQgKHZpZGVvLWhlYXZ5LWFuYWx5c2lzIFN0YWdlIDAzIC0gYSBzaWxlbnQsXG4vLyB2aXN1YWxseSBhY3RpdmUgbW9tZW50LCBvciBzaW1wbHkgYSBjbGlwIHdpdGggbm8gY2FwdGlvbnMpIHN0aWxsIG5lZWRzIGEgbGVnaWJsZVxuLy8gVHJhbnNjcmlwdCBjYXJkIHJhdGhlciB0aGFuIHRoZSBzZWN0aW9uIGRpc2FwcGVhcmluZy4gU2hvd3MgdGhlIFZpc3VhbCBzY29yZSBhbmRcbi8vIHRoZSBub19zcGVlY2ggdGFnIGlubGluZSwgcGx1cyB0aGUgdmlzaW9uLUxMTSBvbmUtbGluZXIgaWYgXCJBbmFseXplIGZyYW1lc1wiIChiZWxvdylcbi8vIGFscmVhZHkgcHJvZHVjZWQgb25lLiBBIGNsaXAgV0lUSCBhIHRyYW5zY3JpcHQgaXMgdW5hZmZlY3RlZCAtIHRoZSBleGNlcnB0IGFsd2F5cyB3aW5zLlxuZnVuY3Rpb24gX3RyYW5zY3JpcHRDYXJkSFRNTChjbGlwKSB7XG4gIGlmIChjbGlwLnRyYW5zY3JpcHRfZXhjZXJwdCkge1xuICAgIHJldHVybiBjb2xsYXBzaWJsZUNhcmQoJ2NsaXAtdHJhbnNjcmlwdCcsXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+VHJhbnNjcmlwdDwvc3Bhbj5gLCBgXG4gICAgICAke2NsaXAudHJhbnNjcmlwdF9zdGFsZSA/IGA8ZGl2IGNsYXNzPVwidHJhbnNjcmlwdC1zdGFsZS1ub3RlXCI+JiM5ODg4OyBDYXB0aW9ucyBlZGl0ZWQgc2luY2UgbGFzdCBzY29yaW5nIC0gPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzoycHggOHB4XCIgZGF0YS1hY3Q9XCJyZXNjb3JlLWNsaXBcIiBkYXRhLWNsaXAtaWQ9XCIke2NsaXAuaWR9XCI+UmUtc2NvcmU8L2J1dHRvbj4gdG8gcmVmcmVzaC48L2Rpdj5gIDogJyd9XG4gICAgICA8ZGl2IGlkPVwiY2xpcC10cmFuc2NyaXB0LXZpZXdcIiBjbGFzcz1cInRyYW5zY3JpcHRcIj4ke2VzY0h0bWwoY2xpcC50cmFuc2NyaXB0X2V4Y2VycHQpfTwvZGl2PmAsXG4gICAgICB7IGFjdGlvbnM6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA5cHhcIiB0aXRsZT1cIkNvcHkgdHJhbnNjcmlwdFwiIGFyaWEtbGFiZWw9XCJDb3B5IHRyYW5zY3JpcHRcIiBkYXRhLWNvcHk9XCJ0cmFuc2NyaXB0XCI+Q29weTwvYnV0dG9uPmAgfSk7XG4gIH1cbiAgY29uc3QgaXNOb1NwZWVjaCA9IChjbGlwLnRhZ3MgfHwgW10pLmluY2x1ZGVzKCdub19zcGVlY2gnKTtcbiAgY29uc3QgdmlzdWFsUGN0ID0gTWF0aC5yb3VuZCgoY2xpcC5zY29yZV92aXN1YWwgfHwgMCkgKiAxMDApO1xuICByZXR1cm4gY29sbGFwc2libGVDYXJkKCdjbGlwLXRyYW5zY3JpcHQnLFxuICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5UcmFuc2NyaXB0PC9zcGFuPmAsIGBcbiAgICA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxM3B4XCI+Tm8gZGlhbG9ndWUgaW4gdGhpcyBjbGlwPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cInRhZ3NcIiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+XG4gICAgICAke2NsaXAuc2NvcmVkX2F0ID8gYDxzcGFuIGNsYXNzPVwidGFnXCIgdGl0bGU9XCJIb3cgdmlzdWFsbHkgYWN0aXZlIHRoaXMgY2xpcCBpc1wiPiYjMTI3OTA5OyBWaXN1YWwgJHt2aXN1YWxQY3R9JTwvc3Bhbj5gIDogJyd9XG4gICAgICAke2lzTm9TcGVlY2ggPyBgPHNwYW4gY2xhc3M9XCJ0YWdcIiB0aXRsZT1cIk5vIHNwb2tlbiBkaWFsb2d1ZSB3YXMgZGV0ZWN0ZWQgaW4gdGhpcyBjbGlwXCI+Tm8gZGlhbG9ndWU8L3NwYW4+YCA6ICcnfVxuICAgIDwvZGl2PlxuICAgICR7Y2xpcC52aXNpb25fc3VtbWFyeSA/IGA8ZGl2IGNsYXNzPVwiZGVzY3JpcHRpb24tbG9uZ1wiIHN0eWxlPVwibWFyZ2luLXRvcDo4cHhcIj4ke2VzY0h0bWwoY2xpcC52aXNpb25fc3VtbWFyeSl9PC9kaXY+YCA6ICcnfWApO1xufVxuXG4vLyDilIDilIAgaW1hZ2UtYmFzZWQgY2xpcCBhbmFseXNpcyAoV2hhdCdzIG9uIHNjcmVlbikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBfdmlzaW9uU3Bpbm5lckJ1dHRvbigpIHtcbiAgcmV0dXJuIGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJhbmFseXplLWZyYW1lcy1idG5cIiBzdHlsZT1cImZvbnQtc2l6ZToxMnB4O3BhZGRpbmc6M3B4IDEwcHhcIiBkaXNhYmxlZD5gXG4gICAgKyBgPHNwYW4gY2xhc3M9XCJzcGlubmVyXCIgc3R5bGU9XCJkaXNwbGF5OmlubGluZS1ibG9jazt2ZXJ0aWNhbC1hbGlnbjptaWRkbGU7d2lkdGg6MTFweDtoZWlnaHQ6MTFweFwiPjwvc3Bhbj4gYFxuICAgICsgYEFuYWx5emluZyBmcmFtZXMuLi48L2J1dHRvbj5gO1xufVxuXG5mdW5jdGlvbiBfdmlzaW9uRGV0YWlsSFRNTChjbGlwKSB7XG4gIC8vIE1hc3RlciBzd2l0Y2ggKFNldHRpbmdzIOKGkiBJbWFnZSBhbmFseXNpcykuIE9uIGJ5IGRlZmF1bHQ7IHRoZSBidXR0b24gaXRzZWxmIGlzXG4gIC8vIHN0aWxsIGdhdGVkIG9uIGEgdmlzaW9uLWNhcGFibGUgbW9kZWwgYmVpbmcgY29uZmlndXJlZCAoZ2F0ZU9uQ2FwYWJpbGl0eSBhYm92ZSkuXG4gIC8vIHdpbmRvdy5fdmlzaW9uRW5hYmxlZCBpcyBzZWVkZWQgYXQgYm9vdCBhbmQgb24gc2V0dGluZ3Mgc2F2ZS5cbiAgaWYgKCF3aW5kb3cuX3Zpc2lvbkVuYWJsZWQpIHJldHVybiAnJztcbiAgY29uc3Qgc3VtbWFyeSA9IGNsaXAudmlzaW9uX3N1bW1hcnk7XG4gIGNvbnN0IGJ0bkxhYmVsID0gc3VtbWFyeSA/ICdSZS1hbmFseXplIGZyYW1lcycgOiAnQW5hbHl6ZSBmcmFtZXMnO1xuICBjb25zdCBib2R5ID0gc3VtbWFyeVxuICAgID8gYDxkaXYgY2xhc3M9XCJkZXNjcmlwdGlvbi1sb25nXCI+JHtlc2NIdG1sKHN1bW1hcnkpfTwvZGl2PlxuICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS1tdXRlZCk7bWFyZ2luLXRvcDo0cHhcIj5BbmFseXplZCAke19mbXRBZ28oY2xpcC52aXNpb25fYW5hbHl6ZWRfYXQpfTwvZGl2PmBcbiAgICA6IGA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxM3B4XCI+U2FtcGxlIGZyYW1lcyBmcm9tIHRoaXMgY2xpcCBhbmQgZGVzY3JpYmUgd2hhdCdzIG9uIHNjcmVlbiAtIGl0IGVucmljaGVzIHRoZSBkZXNjcmlwdGlvbiBhbmQgZ2l2ZXMgc2NvcmluZyB2aXN1YWwgY29udGV4dC48L2Rpdj5gO1xuICAvLyBJZiBhbiBhbmFseXplLWZyYW1lcyBqb2IgZm9yIFRISVMgY2xpcCBpcyBpbiBmbGlnaHQsIHJlbmRlciB0aGUgc3Bpbm5lciBmcm9tXG4gIC8vIEFwcFN0YXRlLmNsaXBKb2JzIChub3QgYSBjYXB0dXJlZCBET00gbm9kZSkgc28gdGhlIGluZGljYXRvciBzdXJ2aXZlcyBhXG4gIC8vIHJlbmRlckRldGFpbCByZWJ1aWxkIG9yIGEgY2xpcCBzd2l0Y2gtYXdheS1hbmQtYmFjay4gT3RoZXJ3aXNlIHRoZSBub3JtYWxcbiAgLy8gYnV0dG9uLCB0YWdnZWQgZGF0YS1qb2ItYmxvY2tlZCBzbyBpdCBkaXNhYmxlcyB3aGlsZSBzb21lIE9USEVSIGpvYiBydW5zLlxuICBjb25zdCBpbkZsaWdodCA9IEFwcFN0YXRlLmNsaXBKb2JzW2NsaXAuaWRdICYmIEFwcFN0YXRlLmNsaXBKb2JzW2NsaXAuaWRdLm9wID09PSAnYW5hbHl6ZS1mcmFtZXMnO1xuICBjb25zdCBidXR0b25IdG1sID0gaW5GbGlnaHRcbiAgICA/IF92aXNpb25TcGlubmVyQnV0dG9uKClcbiAgICA6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJhbmFseXplLWZyYW1lcy1idG5cIiBkYXRhLWpvYi1ibG9ja2VkIHN0eWxlPVwiZm9udC1zaXplOjEycHg7cGFkZGluZzozcHggMTBweFwiXG4gICAgICAgICAgICAgICAgZGF0YS1hY3Q9XCJhbmFseXplLWZyYW1lc1wiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj4ke2J0bkxhYmVsfTwvYnV0dG9uPmA7XG4gIHJldHVybiBjb2xsYXBzaWJsZUNhcmQoJ2NsaXAtdmlzaW9uJyxcbiAgICBgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPldoYXQncyBvbiBzY3JlZW48L3NwYW4+YCwgYFxuICAgICAgJHtib2R5fVxuICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+JHtidXR0b25IdG1sfTwvZGl2PmApO1xufVxuXG4vLyBPcHRpbWlzdGljIGltbWVkaWF0ZSByZXBhaW50IG9mIHRoZSBidXR0b24gb24gc3RhcnQ7IGR1cmFibGUgaW4tZmxpZ2h0IHN0YXRlXG4vLyBsaXZlcyBpbiBBcHBTdGF0ZS5jbGlwSm9icyBzbyBhbnkgbGF0ZXIgcmVidWlsZCByZW5kZXJzIGNvcnJlY3RseSB2aWEgX3Zpc2lvbkRldGFpbEhUTUwuXG5mdW5jdGlvbiBfcGFpbnRWaXNpb25JbkZsaWdodChjbGlwSWQpIHtcbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCAhPT0gY2xpcElkIHx8IFBhbmVsTmF2LmlzT3BlbigpKSByZXR1cm47XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbmFseXplLWZyYW1lcy1idG4nKTtcbiAgaWYgKGJ0bikgYnRuLm91dGVySFRNTCA9IF92aXNpb25TcGlubmVyQnV0dG9uKCk7XG59XG5cbi8vIFRlcm1pbmFsIGNsZWFudXAgc2hhcmVkIGJ5IHRoZSBkb25lLCBlcnJvciwgYW5kIGNhbmNlbCBwYXRoczogZHJvcCB0aGUgaW4tZmxpZ2h0XG4vLyBmbGFnIChzbyB0aGUgYnV0dG9uIGxlYXZlcyBpdHMgc3Bpbm5lcikgYW5kIHJlcGFpbnQgZnJvbSB0aGUgY2FjaGVkIGNsaXAgaWYgaXQgaXNcbi8vIHN0aWxsIHRoZSBvbmUgb24gc2NyZWVuLiBXaXRob3V0IHRoaXMgdGhlIGZsYWcgd291bGQgbGVhayBvbiBhbiBlcnJvci9jYW5jZWwgYW5kXG4vLyBzdHJhbmQgdGhlIGJ1dHRvbiBhcyBhIHBlcm1hbmVudCBkaXNhYmxlZCBzcGlubmVyIHVudGlsIGEgcGFnZSByZWxvYWQuXG5mdW5jdGlvbiBfZmluaXNoVmlzaW9uSm9iKGNsaXBJZCkge1xuICBkZWxldGUgQXBwU3RhdGUuY2xpcEpvYnNbY2xpcElkXTtcbiAgY29uc3QgZGF0YSA9IEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhO1xuICBpZiAoZGF0YSAmJiBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPT09IGNsaXBJZCAmJiAhUGFuZWxOYXYuaXNPcGVuKCkpIHJlbmRlckRldGFpbChkYXRhKTtcbn1cblxuZnVuY3Rpb24gYW5hbHl6ZUZyYW1lcyhjbGlwSWQpIHtcbiAgaWYgKF9ibG9ja2VkQnlBbmFseXplKCdhbmFseXplIGZyYW1lcycpKSByZXR1cm47XG4gIEFwcFN0YXRlLmNsaXBKb2JzW2NsaXBJZF0gPSB7b3A6ICdhbmFseXplLWZyYW1lcyd9O1xuICBfcGFpbnRWaXNpb25JbkZsaWdodChjbGlwSWQpO1xuICBzdHJlYW1TU0UoXG4gICAgYC9hcGkvY2xpcHMvJHtjbGlwSWR9L2FuYWx5emUtZnJhbWVzYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBkZWxldGUgQXBwU3RhdGUuY2xpcEpvYnNbY2xpcElkXTtcbiAgICAgIGxldCBjbGlwID0gbnVsbDtcbiAgICAgIHRyeSB7IGNsaXAgPSBhd2FpdCBmZXRjaChgL2FwaS9jbGlwcy8ke2NsaXBJZH1gKS50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogbnVsbCk7IH0gY2F0Y2ggKF8pIHt9XG4gICAgICAvLyBPbmx5IHRvdWNoIHRoZSBwYW5lbCBpZiB0aGlzIGNsaXAgaXMgc3RpbGwgdGhlIG9uZSBvbiBzY3JlZW4gYW5kIGEgUGFuZWxOYXZcbiAgICAgIC8vIGZsb3cgaXNuJ3QgY292ZXJpbmcgaXQgLSBvdGhlcndpc2UgdGhlIHJlc3VsdCBtdXN0IG5vdCBsYW5kIGluIGFub3RoZXIgY2xpcCdzXG4gICAgICAvLyB2aWV3LiBBIGxhdGVyIHJldHVybiB0byB0aGlzIGNsaXAgcmUtZmV0Y2hlcyBpdCBmcmVzaCB2aWEgc2VsZWN0Q2xpcC4gUmVidWlsZFxuICAgICAgLy8gZnJvbSB0aGUgZnJlc2hlc3QgZGF0YSAodGhlIGZldGNoZWQgY2xpcCwgZWxzZSB0aGUgY2FjaGVkIGNvcHkpIHNvIHRoZSBidXR0b25cbiAgICAgIC8vIHJldHVybnMgZnJvbSBzcGlubmVyIHRvIG5vcm1hbCBub3cgdGhhdCBjbGlwSm9icyBubyBsb25nZXIgZmxhZ3MgdGhpcyBjbGlwLlxuICAgICAgaWYgKGNsaXAgJiYgQXBwU3RhdGUuYWN0aXZlQ2xpcElkID09PSBjbGlwSWQpIEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhID0gY2xpcDtcbiAgICAgIGNvbnN0IGRhdGEgPSBjbGlwIHx8IEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhO1xuICAgICAgaWYgKGRhdGEgJiYgQXBwU3RhdGUuYWN0aXZlQ2xpcElkID09PSBjbGlwSWQgJiYgIVBhbmVsTmF2LmlzT3BlbigpKSByZW5kZXJEZXRhaWwoZGF0YSk7XG4gICAgfSxcbiAgICBGUkFNRVNfU1RFUFMsICdBbmFseXppbmcgZnJhbWVzLi4uJyxcbiAgICAvLyBDYW5jZWxsYWJsZTogdGhlIGpvYiBydW5zIGFzIGEgc3VicHJvY2VzcyAocGlwZWxpbmUvZnJhbWVfYW5hbHlzaXMucHkpLCBzb1xuICAgIC8vIGtpbGxpbmcgaXQgdmlhIHRoZSBjYW5jZWwgZW5kcG9pbnQgZHJvcHMgdGhlIGxsYW1hLXNlcnZlciBjb25uZWN0aW9uIGFuZFxuICAgIC8vIGdlbmVyYXRpb24gYWN0dWFsbHkgc3RvcHMgLSB0aGUgcG9pbnQgb2YgaXQsIGZvciBhIGJpZyBtb2RlbCBvbiBtYW55IGZyYW1lcy5cbiAgICB0cnVlLFxuICAgIC8vIFRoZSBzdWJwcm9jZXNzIHJlcG9ydHMgaXRzIG93biBoYW5kbGVkIGZhaWx1cmVzIGFzIGJyYWNrZXRlZCBzdGF0dXMgbGluZXMgYW5kXG4gICAgLy8gdGhlbiBleGl0cyBjbGVhbmx5IChubyB0cmFuc3BvcnQgZXJyb3IsIHNvIHN0cmVhbVNTRSdzIGVycm9yIHRvYXN0IG5ldmVyIGZpcmVzKS5cbiAgICAvLyBTdXJmYWNlIHRoZW0gYXMgYSB0b2FzdCwgb3RoZXJ3aXNlIGEgZmFpbGVkIGFuYWx5c2lzIGlzIG9ubHkgdmlzaWJsZSBpbiB0aGUgbG9nLlxuICAgIGxpbmUgPT4geyBpZiAodHlwZW9mIGxpbmUgPT09ICdzdHJpbmcnICYmIGxpbmUuc3RhcnRzV2l0aCgnWycpKSBzaG93VG9hc3QobGluZS5yZXBsYWNlKC9eXFxbfFxcXSQvZywgJycpLCAnZXJyb3InKTsgfSxcbiAgICBmYWxzZSwge21ldGhvZDogJ1BPU1QnfSxcbiAgICAoKSA9PiBfZmluaXNoVmlzaW9uSm9iKGNsaXBJZCksICAvLyBvbkVycm9yOiBjbGVhciB0aGUgaW4tZmxpZ2h0IGZsYWcgc28gdGhlIGJ1dHRvbiByZWNvdmVyc1xuICApO1xuICAvLyBzdGFydEpvYlVJIChpbnNpZGUgc3RyZWFtU1NFKSByZXNldCB0aGUgc2hhcmVkIGNhbmNlbCBjb25maWcgdG8gdGhlIGFuYWx5emVcbiAgLy8gZGVmYXVsdDsgb3ZlcnJpZGUgaXQgc28gdGhlIGhlYWRlciBDYW5jZWwgY29uZmlybXMgKyBQT1NUcyBmb3IgVEhJUyBqb2IuXG4gIHNldEpvYkNhbmNlbCh7XG4gICAgdXJsOiBgL2FwaS9jbGlwcy8ke2NsaXBJZH0vYW5hbHl6ZS1mcmFtZXMvY2FuY2VsYCxcbiAgICB0aXRsZTogJ1N0b3AgaW1hZ2UgYW5hbHlzaXM/JyxcbiAgICBib2R5OiAnVGhlIHdvcmsgc28gZmFyIGlzIGRpc2NhcmRlZC4gWW91IGNhbiBydW4gaW1hZ2UgYW5hbHlzaXMgYWdhaW4gYW55dGltZS4nLFxuICAgIGNvbmZpcm06ICdTdG9wIGFuYWx5c2lzJyxcbiAgICBsb2dNc2c6ICdbSW1hZ2UgYW5hbHlzaXMgY2FuY2VsbGVkXScsXG4gICAgb25DYW5jZWw6ICgpID0+IF9maW5pc2hWaXNpb25Kb2IoY2xpcElkKSxcbiAgfSk7XG59XG5cbi8vIOKUgOKUgCBob3Qtd29yZHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5jb25zdCBfSE9UV09SRF9NT0RFX0xBQkVMUyA9IHtleGFjdDogJ0V4YWN0JywgY2FzZV9pbnNlbnNpdGl2ZTogJ0lnbm9yZSBjYXNlJywgc2VtYW50aWM6ICdNZWFuaW5nJ307XG5cbmZ1bmN0aW9uIF9ob3R3b3JkRGV0YWlsSFRNTChjbGlwKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBjbGlwLmhvdHdvcmRfbWF0Y2hlcztcbiAgaWYgKCFtYXRjaGVzIHx8ICFtYXRjaGVzLmxlbmd0aCkgcmV0dXJuICcnO1xuICBjb25zdCBib29zdCA9IGNsaXAuaG90d29yZF9ib29zdCB8fCB7fTtcbiAgY29uc3QgYm9vc3RMaW5lID0gT2JqZWN0LmVudHJpZXMoYm9vc3QpXG4gICAgLmZpbHRlcigoWywgdl0pID0+IHYpXG4gICAgLm1hcCgoW3RhcmdldCwgdl0pID0+IGAke3RhcmdldH06ICR7diA+IDAgPyAnKycgOiAnJ30ke01hdGgucm91bmQodiAqIDEwMCl9JWApXG4gICAgLmpvaW4oJywgJyk7XG4gIHJldHVybiBgXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+PHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPkhvdC13b3Jkczwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDo0cHg7Zm9udC1zaXplOjEycHhcIj5cbiAgICAgICAgJHttYXRjaGVzLm1hcChtID0+IGBcbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPHN0cm9uZz4ke2VzY0h0bWwobS5waHJhc2UpfTwvc3Ryb25nPlxuICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZClcIj4gLSAke2VzY0h0bWwoX0hPVFdPUkRfTU9ERV9MQUJFTFNbbS5tb2RlXSB8fCBtLm1vZGUpfSR7bS5jb3VudCA+IDEgPyBgLCAke20uY291bnR9w5dgIDogJyd9PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PmApLmpvaW4oJycpfVxuICAgICAgICAke2Jvb3N0TGluZSA/IGA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMXB4O21hcmdpbi10b3A6MnB4XCI+Qm9vc3QgYXBwbGllZDogJHtlc2NIdG1sKGJvb3N0TGluZSl9PC9kaXY+YCA6ICcnfVxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuLy8g4pSA4pSAIHNlbnNpdGl2ZSBjb250ZW50IChQcml2YWN5IFRlcm1zIC8gQ2Vuc29yIFdvcmRzKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmNvbnN0IF9TRU5TSVRJVkVfQ0FURUdPUllfTEFCRUxTID0ge3ByaXZhY3k6ICdQcml2YWN5IFRlcm0nLCBjZW5zb3I6ICdDZW5zb3IgV29yZCd9O1xuY29uc3QgX1NFTlNJVElWRV9NT0RFX0xBQkVMUyA9IHtleGFjdDogJ0V4YWN0JywgY2FzZV9pbnNlbnNpdGl2ZTogJ0lnbm9yZSBjYXNlJywgZnV6enk6ICdDbG9zZSBzcGVsbGluZyd9O1xuXG5mdW5jdGlvbiBfc2Vuc2l0aXZlRGV0YWlsSFRNTChjbGlwKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBjbGlwLnNlbnNpdGl2ZV9tYXRjaGVzO1xuICBpZiAoIW1hdGNoZXMgfHwgIW1hdGNoZXMubGVuZ3RoKSByZXR1cm4gJyc7XG4gIHJldHVybiBgXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+PHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPkZsYWdnZWQgdGVybXM8L3NwYW4+PC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6NHB4O2ZvbnQtc2l6ZToxMnB4XCI+XG4gICAgICAgICR7bWF0Y2hlcy5tYXAobSA9PiBgXG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic2Vuc2l0aXZlLWNhdGVnb3J5IHNlbnNpdGl2ZS1jYXRlZ29yeS0ke20uY2F0ZWdvcnl9XCI+JHtlc2NIdG1sKF9TRU5TSVRJVkVfQ0FURUdPUllfTEFCRUxTW20uY2F0ZWdvcnldIHx8IG0uY2F0ZWdvcnkpfTwvc3Bhbj5cbiAgICAgICAgICAgIDxzdHJvbmc+JHtlc2NIdG1sKG0ubWF0Y2hlZF90ZXh0KX08L3N0cm9uZz5cbiAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpXCI+IC0gJHtlc2NIdG1sKF9TRU5TSVRJVkVfTU9ERV9MQUJFTFNbbS5tb2RlXSB8fCBtLm1vZGUpfSR7bS5jb3VudCA+IDEgPyBgLCAke20uY291bnR9w5dgIDogJyd9PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PmApLmpvaW4oJycpfVxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuLy8g4pSA4pSAIGdlbmVyYXRlZCB0YWdzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUGlwZWxpbmUgdGFncyAoY2xpcC50YWdzKSBhcmUgaW50ZXJuYWwgdG9rZW5zOyBtYXAgdGhlbSB0byBkaXNwbGF5IG5hbWVzXG4vLyBiZWZvcmUgcmVuZGVyaW5nLiBudWxsID0gYm9va2tlZXBpbmcgbWFya2VyLCBoaWRkZW4gZnJvbSB0aGUgVUkgKHRoZSBTY29yaW5nXG4vLyBjYXJkIGFuZCBcIkxhc3Qgc2NvcmVkIHdpdGhcIiBhbHJlYWR5IGNvbnZleSB0aGF0IGEgc2NvcmVyIHJhbikuXG5jb25zdCBfR0VORVJBVEVEX1RBR19JTkZPID0ge1xuICBtYW51YWw6ICAgICAgICAgICAgICB7IG5hbWU6ICdNYW51YWxseSBjcmVhdGVkJywgdGlwOiAnWW91IGNyZWF0ZWQgdGhpcyBjbGlwIGJ5IGhhbmQsIG5vdCBhdXRvbWF0aWMgY2xpcCBnZW5lcmF0aW9uJyB9LFxuICBsbG1fZXJyb3I6ICAgICAgICAgICB7IG5hbWU6ICdTY29yZSBlcnJvcicsIHRpcDogJ0xMTSBzY29yaW5nIGZhaWxlZCBmb3IgdGhpcyBjbGlwIC0gUmUtc2NvcmUgdG8gcmV0cnknIH0sXG4gIGxsbV9ub190cmFuc2NyaXB0OiAgIHsgbmFtZTogJ05vIHNwZWVjaCB0byBzY29yZScsIHRpcDogXCJObyB0cmFuc2NyaXB0IHRleHQgaW4gdGhpcyBjbGlwJ3MgdGltZSByYW5nZSwgc28gTExNIHNjb3Jpbmcgd2FzIHNraXBwZWRcIiB9LFxuICBlbmVyZ3lfbm9fdHJhY2tzOiAgICB7IG5hbWU6ICdObyBhdWRpbyBkYXRhJywgdGlwOiAnTm8gYXVkaW8gdHJhY2sgd2FzIGF2YWlsYWJsZSBmb3IgZW5lcmd5IHNjb3JpbmcnIH0sXG4gIGVuZXJneV9ub19kYXRhOiAgICAgIHsgbmFtZTogJ05vIGF1ZGlvIGRhdGEnLCB0aXA6IFwiVGhlIGF1ZGlvIHRyYWNrIGhhZCBubyBkYXRhIGluIHRoaXMgY2xpcCdzIHRpbWUgcmFuZ2VcIiB9LFxuICBhZnRlcl9oYXJkX3NwbGl0OiAgICB7IG5hbWU6ICdBZnRlciBzcGxpdCcsIHRpcDogJ1RoaXMgY2xpcCBzdGFydHMgcmlnaHQgYWZ0ZXIgYSBzcGxpdCBwb2ludCcgfSxcbiAgbG9uZ19zaWxlbmNlX2JlZm9yZTogeyBuYW1lOiAnTG9uZyBwYXVzZSBiZWZvcmUnLCB0aXA6ICdBIGxvbmcgcXVpZXQgc3RyZXRjaCBjb21lcyByaWdodCBiZWZvcmUgdGhpcyBjbGlwJyB9LFxuICBub19zcGVlY2g6ICAgICAgICAgICB7IG5hbWU6ICdObyBkaWFsb2d1ZScsIHRpcDogJ05vIHNwb2tlbiBkaWFsb2d1ZSB3YXMgZGV0ZWN0ZWQgaW4gdGhpcyBjbGlwJyB9LFxuICB2aXN1YWw6ICAgICAgICAgICAgICB7IG5hbWU6ICdWaXN1YWwgaGlnaGxpZ2h0JywgdGlwOiAnQSBzaWxlbnQsIHZpc3VhbGx5IGFjdGl2ZSBtb21lbnQgZm91bmQgd2l0aG91dCBhbnkgZGlhbG9ndWUnIH0sXG4gIGxsbV9zY29yZWQ6IG51bGwsIGVuZXJneV9zY29yZWQ6IG51bGwsIHNjZW5lc19zY29yZWQ6IG51bGwsXG4gIGxhdWdoX3RyYW5zY3JpcHQ6IG51bGwsIGxhdWdoX2F1ZGlvOiBudWxsLCBsYXVnaF9tb2RlbDogbnVsbCxcbiAgbGF1Z2hfbm9fdHJhbnNjcmlwdDogbnVsbCwgbGF1Z2hfbm9fd2F2OiBudWxsLFxufTtcblxuZnVuY3Rpb24gX2dlbmVyYXRlZFRhZ1BpbGxzSFRNTCh0YWdzKSB7XG4gIGNvbnN0IHBpbGxzID0gKHRhZ3MgfHwgW10pLm1hcCh0b2tlbiA9PiB7XG4gICAgaWYgKF9HRU5FUkFURURfVEFHX0lORk9bdG9rZW5dID09PSBudWxsKSByZXR1cm4gJyc7XG4gICAgbGV0IGluZm8gPSBfR0VORVJBVEVEX1RBR19JTkZPW3Rva2VuXTtcbiAgICBjb25zdCBzaWxlbmNlID0gL15hZnRlcl9zaWxlbmNlXyhcXGQrKXMkLy5leGVjKHRva2VuKTtcbiAgICBpZiAoc2lsZW5jZSkgaW5mbyA9IHsgbmFtZTogYEFmdGVyICR7c2lsZW5jZVsxXX0gcyBzaWxlbmNlYCwgdGlwOiBgVGhpcyBjbGlwIHN0YXJ0cyBhZnRlciBhYm91dCAke3NpbGVuY2VbMV19IHNlY29uZHMgb2Ygc2lsZW5jZWAgfTtcbiAgICBpZiAoIWluZm8pIGluZm8gPSB7IG5hbWU6IHRva2VuLnJlcGxhY2UoL18vZywgJyAnKSwgdGlwOiAnRGV0ZWN0ZWQgZHVyaW5nIGFuYWx5c2lzJyB9O1xuICAgIHJldHVybiBgPHNwYW4gY2xhc3M9XCJ0YWdcIiB0aXRsZT1cIiR7ZXNjSHRtbChpbmZvLnRpcCl9XCI+JHtlc2NIdG1sKGluZm8ubmFtZSl9PC9zcGFuPmA7XG4gIH0pLmZpbHRlcihCb29sZWFuKTtcbiAgcmV0dXJuIHBpbGxzLmxlbmd0aCA/IGA8ZGl2IGNsYXNzPVwidGFnc1wiIHN0eWxlPVwibWFyZ2luLXRvcDo4cHhcIj4ke3BpbGxzLmpvaW4oJycpfTwvZGl2PmAgOiAnJztcbn1cblxuLy8g4pSA4pSAIHVzZXIgdGFncyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRhZyB2YWx1ZXMgY2FuIGNvbnRhaW4gcXVvdGVzL3NwYWNlcywgc28gdGhlIHJlbW92ZSBidXR0b25zIHVzZSBkYXRhLSogK1xuLy8gZXZlbnQgZGVsZWdhdGlvbiAoc2VlIHRoZSAjZGV0YWlsIGxpc3RlbmVyIGJlbG93KSwgbmV2ZXIgaW5saW5lIG9uY2xpY2suXG5mdW5jdGlvbiBfY2xpcFRhZ1BpbGxzSFRNTCh0YWdzKSB7XG4gIGlmICghdGFncyB8fCAhdGFncy5sZW5ndGgpIHJldHVybiAnPHNwYW4gY2xhc3M9XCJ0YWdzLWVtcHR5XCI+Tm8gdGFncyB5ZXQ8L3NwYW4+JztcbiAgcmV0dXJuIHRhZ3MubWFwKHQgPT5cbiAgICBgPHNwYW4gY2xhc3M9XCJ1c2VyLXRhZ1wiPiR7ZXNjSHRtbCh0KX08YnV0dG9uIGNsYXNzPVwidXNlci10YWcteFwiIGRhdGEtcmVtb3ZlLXRhZz1cIiR7ZXNjSHRtbCh0KX1cIlxuICAgICAgIHRpdGxlPVwiUmVtb3ZlIHRhZ1wiIGFyaWEtbGFiZWw9XCJSZW1vdmUgdGFnICR7ZXNjSHRtbCh0KX1cIj4mdGltZXM7PC9idXR0b24+PC9zcGFuPmBcbiAgKS5qb2luKCcnKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2xvYWRUYWdTdWdnZXN0aW9ucygpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2goJy9hcGkvdGFncycpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gICAgQXBwU3RhdGUuYWxsVGFncyA9IEFycmF5LmlzQXJyYXkoZGF0YS50YWdzKSA/IGRhdGEudGFncyA6IFtdO1xuICB9IGNhdGNoIChfKSB7IEFwcFN0YXRlLmFsbFRhZ3MgPSBBcHBTdGF0ZS5hbGxUYWdzIHx8IFtdOyB9XG59XG5cbmZ1bmN0aW9uIF9yZW5kZXJUYWdEYXRhbGlzdCgpIHtcbiAgY29uc3QgZGwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC10YWdzLWRhdGFsaXN0Jyk7XG4gIGlmICghZGwpIHJldHVybjtcbiAgZGwuaW5uZXJIVE1MID0gKEFwcFN0YXRlLmFsbFRhZ3MgfHwgW10pLm1hcCh0ID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2NIdG1sKHQpfVwiPmApLmpvaW4oJycpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfc2F2ZUNsaXBUYWdzKGNsaXBJZCwgdGFncykge1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS9jbGlwcy8ke2NsaXBJZH0vdGFnc2AsIHtcbiAgICBtZXRob2Q6ICdQVVQnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3RhZ3N9KSxcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB7IHNob3dUb2FzdCgnQ291bGQgbm90IHNhdmUgdGFncycsICdlcnJvcicpOyByZXR1cm4gbnVsbDsgfVxuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhICYmIEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhLmlkID09PSBjbGlwSWQpIHtcbiAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YS51c2VyX3RhZ3MgPSBkYXRhLnVzZXJfdGFncztcbiAgfVxuICBhd2FpdCBfbG9hZFRhZ1N1Z2dlc3Rpb25zKCk7XG4gIF9yZW5kZXJUYWdEYXRhbGlzdCgpO1xuICByZXR1cm4gZGF0YS51c2VyX3RhZ3M7XG59XG5cbmZ1bmN0aW9uIF9jdXJyZW50Q2xpcFRhZ3MoKSB7XG4gIHJldHVybiAoQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGEgJiYgQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGEudXNlcl90YWdzKSB8fCBbXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2FkZENsaXBUYWcoY2xpcElkLCByYXcpIHtcbiAgY29uc3QgdGFnID0gKHJhdyB8fCAnJykudHJpbSgpO1xuICBpZiAoIXRhZykgcmV0dXJuO1xuICBjb25zdCBjdXIgPSBfY3VycmVudENsaXBUYWdzKCk7XG4gIGlmIChjdXIuc29tZSh0ID0+IHQudG9Mb3dlckNhc2UoKSA9PT0gdGFnLnRvTG93ZXJDYXNlKCkpKSByZXR1cm47ICAvLyBkZWR1cGUgY2xpZW50LXNpZGVcbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IF9zYXZlQ2xpcFRhZ3MoY2xpcElkLCBbLi4uY3VyLCB0YWddKTtcbiAgaWYgKHVwZGF0ZWQpIF9yZXJlbmRlckNsaXBUYWdzKHVwZGF0ZWQpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfcmVtb3ZlQ2xpcFRhZyhjbGlwSWQsIHRhZykge1xuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgX3NhdmVDbGlwVGFncyhjbGlwSWQsIF9jdXJyZW50Q2xpcFRhZ3MoKS5maWx0ZXIodCA9PiB0ICE9PSB0YWcpKTtcbiAgaWYgKHVwZGF0ZWQpIF9yZXJlbmRlckNsaXBUYWdzKHVwZGF0ZWQpO1xufVxuXG5mdW5jdGlvbiBfcmVyZW5kZXJDbGlwVGFncyh0YWdzKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtdXNlci10YWdzJyk7XG4gIGlmIChlbCkgZWwuaW5uZXJIVE1MID0gX2NsaXBUYWdQaWxsc0hUTUwodGFncyk7XG59XG5cbi8vIEV2ZW50IGRlbGVnYXRpb24gb24gdGhlIHBlcnNpc3RlbnQgI2RldGFpbCBlbGVtZW50IChpdHMgaW5uZXJIVE1MIGlzIHJlcGxhY2VkXG4vLyBlYWNoIHJlbmRlciwgc28gcGVyLXJvdyBoYW5kbGVycyB3b3VsZCBiZSBsb3N0IC0gdGhlIGNvbnRhaW5lciBsaXN0ZW5lciBpc24ndCkuXG4vLyBXaXJlZCBvbmNlIGF0IG1vZHVsZSBsb2FkLCBzYW1lIGFzIHZpZGVvcy5qcydzIG93biAjZGV0YWlsIGxpc3RlbmVyIC0gYm90aFxuLy8gY29leGlzdCBzaW5jZSB0aGV5IHJlYWN0IHRvIGRpc2pvaW50IGRhdGEtYWN0L2RhdGEtKiBuYW1lc3BhY2VzLlxuZnVuY3Rpb24gX2hhbmRsZURldGFpbENsaWNrKGUpIHtcbiAgY29uc3QgbWVyZ2UgPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1tZXJnZS1iXScpO1xuICBpZiAobWVyZ2UpIHtcbiAgICBtZXJnZUNsaXBzKE51bWJlcihtZXJnZS5kYXRhc2V0Lm1lcmdlQSksIE51bWJlcihtZXJnZS5kYXRhc2V0Lm1lcmdlQiksIG1lcmdlLmRhdGFzZXQubWVyZ2VEaXIpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBybSA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLXJlbW92ZS10YWddJyk7XG4gIGlmIChybSAmJiBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpIHsgX3JlbW92ZUNsaXBUYWcoQXBwU3RhdGUuYWN0aXZlQ2xpcElkLCBybS5kYXRhc2V0LnJlbW92ZVRhZyk7IHJldHVybjsgfVxuICBjb25zdCBjb3B5ID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtY29weV0nKTtcbiAgaWYgKGNvcHkgJiYgQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGEpIHtcbiAgICBpZiAoY29weS5kYXRhc2V0LmNvcHkgPT09ICdkZXNjcmlwdGlvbicpIGNvcHlUZXh0KEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhLmRlc2NyaXB0aW9uLCAnRGVzY3JpcHRpb24nKTtcbiAgICBlbHNlIGlmIChjb3B5LmRhdGFzZXQuY29weSA9PT0gJ3RyYW5zY3JpcHQnKSBjb3B5VGV4dChBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YS50cmFuc2NyaXB0X2V4Y2VycHQsICdUcmFuc2NyaXB0Jyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGZvcm1hdEJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWV4cG9ydC1hY3Rpb25dJyk7XG4gIGlmIChmb3JtYXRCdG4pIHtcbiAgICBjb25zdCByb3cgPSBmb3JtYXRCdG4uY2xvc2VzdCgnLmV4cG9ydC1mb3JtYXQtcm93Jyk7XG4gICAgaWYgKHJvdykgd2luZG93Ll9oYW5kbGVFeHBvcnRGb3JtYXRBY3Rpb24oZm9ybWF0QnRuLmRhdGFzZXQuZXhwb3J0QWN0aW9uLCByb3cuZGF0YXNldCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGFjdCA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWFjdF0nKTtcbiAgaWYgKCFhY3QpIHJldHVybjtcbiAgY29uc3QgY2xpcElkID0gTnVtYmVyKGFjdC5kYXRhc2V0LmNsaXBJZCk7XG4gIHN3aXRjaCAoYWN0LmRhdGFzZXQuYWN0KSB7XG4gICAgY2FzZSAnZXhwb3J0LWNsaXAnOiB3aW5kb3cuZXhwb3J0Q2xpcChjbGlwSWQpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWxsbS1zZXR0aW5ncyc6XG4gICAgICB3aW5kb3cub3BlblNldHRpbmdzKCk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5fc2Nyb2xsVG9TZXR0aW5nc1NlY3Rpb24oJ3NldHRpbmdzLXNlYy1sbG0nKSwgMTIwKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2NsZWFyLXNjb3JlLW92ZXJyaWRlJzogY2xlYXJTY29yZU92ZXJyaWRlKGNsaXBJZCk7IGJyZWFrO1xuICAgIGNhc2UgJ29wZW4tc2NvcmUtb3ZlcnJpZGUnOiBvcGVuU2NvcmVPdmVycmlkZShjbGlwSWQpOyBicmVhaztcbiAgICBjYXNlICdzZXQtc3RhdHVzJzogc2V0U3RhdHVzKGNsaXBJZCwgYWN0LmRhdGFzZXQuc3RhdHVzKTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi1jbGlwLWFjdGlvbnMtbW9kYWwnOiBvcGVuQ2xpcEFjdGlvbnNNb2RhbChjbGlwSWQpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWRlc2MtbG9uZy1rZWJhYic6IG9wZW5EZXNjTG9uZ0tlYmFiKGNsaXBJZCwgYWN0KTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi1kZXNjLWtlYmFiJzogb3BlbkRlc2NLZWJhYihjbGlwSWQsIGFjdCk7IGJyZWFrO1xuICAgIGNhc2UgJ29wZW4tZXhwb3J0LWVkaXRvcic6IHdpbmRvdy5vcGVuRXhwb3J0RWRpdG9yKGNsaXBJZCk7IGJyZWFrO1xuICAgIGNhc2UgJ3NlbGVjdC1yZWxhdGVkLWNsaXAnOiBlLnByZXZlbnREZWZhdWx0KCk7IHNlbGVjdENsaXAoY2xpcElkKTsgYnJlYWs7XG4gICAgY2FzZSAncmVzY29yZS1jbGlwJzogd2luZG93LnJlc2NvcmVDbGlwKGNsaXBJZCk7IGJyZWFrO1xuICAgIGNhc2UgJ2FuYWx5emUtZnJhbWVzJzogYW5hbHl6ZUZyYW1lcyhjbGlwSWQpOyBicmVhaztcbiAgfVxufVxuXG5mdW5jdGlvbiBfaGFuZGxlRGV0YWlsS2V5ZG93bihlKSB7XG4gIGNvbnN0IGlucHV0ID0gZS50YXJnZXQuY2xvc2VzdCgnI2NsaXAtdGFnLWlucHV0Jyk7XG4gIGlmICghaW5wdXQpIHJldHVybjtcbiAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnLCcpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZTtcbiAgICBpbnB1dC52YWx1ZSA9ICcnO1xuICAgIGlmIChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpIF9hZGRDbGlwVGFnKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCwgdmFsdWUpO1xuICB9XG59XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIF9oYW5kbGVEZXRhaWxDbGljayk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIF9oYW5kbGVEZXRhaWxLZXlkb3duKTtcblxuZnVuY3Rpb24gc2NvcmVSb3cobGFiZWwsIHZhbCwgY2xzKSB7XG4gIHJldHVybiBgXG4gICAgPHNwYW4gY2xhc3M9XCJzY29yZS1sYWJlbFwiPiR7bGFiZWx9PC9zcGFuPlxuICAgIDxkaXYgY2xhc3M9XCJzY29yZS1iYXItd3JhcFwiPjxkaXYgY2xhc3M9XCJzY29yZS1iYXIgYmFyLSR7Y2xzfVwiIHN0eWxlPVwid2lkdGg6JHsodmFsKjEwMCkudG9GaXhlZCgxKX0lXCI+PC9kaXY+PC9kaXY+XG4gICAgPHNwYW4gY2xhc3M9XCJzY29yZS12YWxcIiBzdHlsZT1cImNvbG9yOnZhcigtLSR7Y2xzfSlcIj4ke01hdGgucm91bmQodmFsKjEwMCl9JTwvc3Bhbj5gO1xufVxuXG5mdW5jdGlvbiBzY29yZVJvd092ZXJyaWRlKGxhYmVsLCBsbG1WYWwsIHVzZXJWYWwsIGNscykge1xuICByZXR1cm4gYFxuICAgIDxzcGFuIGNsYXNzPVwic2NvcmUtbGFiZWxcIj4ke2xhYmVsfSA8c3BhbiBjbGFzcz1cInNjb3JlLW92ZXJyaWRlLWJhZGdlXCI+b3ZlcnJpZGU8L3NwYW4+PC9zcGFuPlxuICAgIDxkaXYgY2xhc3M9XCJzY29yZS1iYXItd3JhcFwiPlxuICAgICAgPGRpdiBjbGFzcz1cInNjb3JlLWJhciBiYXItJHtjbHN9XCIgc3R5bGU9XCJ3aWR0aDokeyh1c2VyVmFsKjEwMCkudG9GaXhlZCgxKX0lO29wYWNpdHk6LjVcIj48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8c3BhbiBjbGFzcz1cInNjb3JlLXZhbFwiIHN0eWxlPVwiY29sb3I6dmFyKC0tJHtjbHN9KVwiPiR7TWF0aC5yb3VuZCh1c2VyVmFsKjEwMCl9JSA8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTBweFwiPihMTE06ICR7TWF0aC5yb3VuZChsbG1WYWwqMTAwKX0lKTwvc3Bhbj48L3NwYW4+YDtcbn1cblxuZnVuY3Rpb24gX21lcmdlTmVpZ2hib3JzKGNsaXApIHtcbiAgY29uc3QgYnlUaW1lID0gWy4uLkFwcFN0YXRlLmNsaXBzXS5zb3J0KChhLCBiKSA9PiBhLnN0YXJ0X21zIC0gYi5zdGFydF9tcyk7XG4gIGNvbnN0IGlkeCA9IGJ5VGltZS5maW5kSW5kZXgoYyA9PiBjLmlkID09PSBjbGlwLmlkKTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2OiBpZHggPiAwID8gYnlUaW1lW2lkeCAtIDFdIDogbnVsbCxcbiAgICBuZXh0OiBpZHggPj0gMCAmJiBpZHggPCBieVRpbWUubGVuZ3RoIC0gMSA/IGJ5VGltZVtpZHggKyAxXSA6IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIG9wZW5DbGlwQWN0aW9uc01vZGFsKGNsaXBJZCkge1xuICBjb25zdCBjbGlwID0gQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGE/LmlkID09PSBjbGlwSWQgPyBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YSA6IEFwcFN0YXRlLmNsaXBzLmZpbmQoYyA9PiBjLmlkID09PSBjbGlwSWQpO1xuICBpZiAoIWNsaXApIHJldHVybjtcbiAgY29uc3QgeyBwcmV2LCBuZXh0IH0gPSBfbWVyZ2VOZWlnaGJvcnMoY2xpcCk7XG5cbiAgY29uc3QgZ3JvdXBzID0gW107XG5cbiAgY29uc3Qgc2NvcmluZ1Jvd3MgPSBbXG4gICAgeyBsYWJlbDogJ1JlLXNjb3JlJywgZGVzY3JpcHRpb246ICdSZS1ydW4gc2NvcmluZyBhbmQgZGVzY3JpcHRpb24gZ2VuZXJhdGlvbiBmb3IgdGhpcyBjbGlwLicsIGFjdGlvbjogKCkgPT4gd2luZG93LnJlc2NvcmVDbGlwQ2hvb3NlKGNsaXBJZCkgfSxcbiAgXTtcbiAgaWYgKGNsaXAuc2NvcmVfb3ZlcmFsbF91c2VyICE9IG51bGwpIHtcbiAgICBzY29yaW5nUm93cy5wdXNoKHsgbGFiZWw6ICdSZW1vdmUgT3ZlcnJpZGUnLCBkZXNjcmlwdGlvbjogJ0Rpc2NhcmQgdGhlIG1hbnVhbCBzY29yZSBhbmQgZ28gYmFjayB0byB0aGUgZ2VuZXJhdGVkIHNjb3JlLicsIGFjdGlvbjogKCkgPT4gY2xlYXJTY29yZU92ZXJyaWRlKGNsaXBJZCkgfSk7XG4gIH0gZWxzZSB7XG4gICAgc2NvcmluZ1Jvd3MucHVzaCh7IGxhYmVsOiAnT3ZlcnJpZGUgU2NvcmUnLCBkZXNjcmlwdGlvbjogJ01hbnVhbGx5IHNldCB0aGUgb3ZlcmFsbCBzY29yZSBpbnN0ZWFkIG9mIHVzaW5nIHRoZSBnZW5lcmF0ZWQgc2NvcmUuJywgYWN0aW9uOiAoKSA9PiBvcGVuU2NvcmVPdmVycmlkZShjbGlwSWQpIH0pO1xuICB9XG4gIGdyb3Vwcy5wdXNoKHsgaGVhZGluZzogJ1Njb3JpbmcnLCByb3dzOiBzY29yaW5nUm93cyB9KTtcblxuICBncm91cHMucHVzaCh7IGhlYWRpbmc6ICdUcmFuc2NyaXB0Jywgcm93czogW1xuICAgIHsgbGFiZWw6ICdSZXRyYW5zY3JpYmUnLCBkZXNjcmlwdGlvbjogXCJSZS1ydW4gdHJhbnNjcmlwdGlvbiBmb3IganVzdCB0aGlzIGNsaXAncyB0aW1lIHJhbmdlLlwiLCBhY3Rpb246ICgpID0+IHdpbmRvdy5vcGVuUmV0cmFuc2NyaWJlTW9kYWwoY2xpcElkKSB9LFxuICBdfSk7XG5cbiAgaWYgKGNsaXAuZGVzY3JpcHRpb25fbG9uZyB8fCBjbGlwLmRlc2NyaXB0aW9uKSB7XG4gICAgZ3JvdXBzLnB1c2goeyBoZWFkaW5nOiAnRGlzY292ZXInLCByb3dzOiBbXG4gICAgICB7IGxhYmVsOiAnRmluZCBTaW1pbGFyJywgZGVzY3JpcHRpb246ICdTZWFyY2ggb3RoZXIgcmVjb3JkaW5ncyBmb3IgY2xpcHMgd2l0aCBhIHNpbWlsYXIgZGVzY3JpcHRpb24uJywgYWN0aW9uOiAoKSA9PiBvcGVuU2ltaWxhckNsaXBzTW9kYWwoY2xpcElkKSB9LFxuICAgIF19KTtcbiAgfVxuXG4gIGlmIChjbGlwLmhhc19leHBvcnQpIHtcbiAgICBjb25zdCBtdWx0aUZvcm1hdCA9IChjbGlwLmV4cG9ydHMgfHwgW10pLmZpbHRlcihlID0+IGUuZXhpc3RzKS5sZW5ndGggPiAxO1xuICAgIGNvbnN0IGZpbGVSb3dzID0gW107XG4gICAgaWYgKEFwcFN0YXRlLmFjdGl2ZU1lZGlhRmlsZW5hbWUpIHtcbiAgICAgIGZpbGVSb3dzLnB1c2goeyBsYWJlbDogJ0Rvd25sb2FkIEV4cG9ydCcsIGRlc2NyaXB0aW9uOiBgU2F2ZSAke211bHRpRm9ybWF0ID8gJ2V2ZXJ5IGV4cG9ydGVkIGZvcm1hdCcgOiAndGhlIGV4cG9ydGVkIGZpbGUnfSAoYW5kIGFueSBjYXB0aW9uIHNpZGVjYXJzKSB0byB5b3VyIGRvd25sb2Fkcy5gLCBhY3Rpb246ICgpID0+IHdpbmRvdy5fZG93bmxvYWRDbGlwRXhwb3J0KGNsaXBJZCkgfSk7XG4gICAgfVxuICAgIGZpbGVSb3dzLnB1c2goeyBsYWJlbDogJ0NvcHkgRmlsZSBQYXRoKHMpJywgZGVzY3JpcHRpb246IGBDb3B5IHRoZSBmdWxsIHBhdGggb2YgJHttdWx0aUZvcm1hdCA/ICdldmVyeSBleHBvcnRlZCBmb3JtYXQnIDogJ3RoZSBleHBvcnRlZCBmaWxlJ30gKGFuZCBhbnkgY2FwdGlvbiBzaWRlY2FycykgdG8geW91ciBjbGlwYm9hcmQuYCwgYWN0aW9uOiAoKSA9PiB3aW5kb3cuX2NvcHlDbGlwRXhwb3J0UGF0aHMoY2xpcElkKSB9KTtcbiAgICBpZiAoQXBwU3RhdGUuY2FuUmV2ZWFsKSB7XG4gICAgICBmaWxlUm93cy5wdXNoKHsgbGFiZWw6ICdTaG93IGluIEZvbGRlcicsIGRlc2NyaXB0aW9uOiAnT3BlbiB0aGUgZXhwb3J0cyBmb2xkZXIgd2l0aCB0aGlzIGZpbGUgc2VsZWN0ZWQuJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cuX3JldmVhbENsaXBFeHBvcnQoY2xpcElkKSB9KTtcbiAgICB9XG4gICAgZmlsZVJvd3MucHVzaCh7IGxhYmVsOiAnRGVsZXRlIEFsbCBFeHBvcnRzJywgZGVzY3JpcHRpb246IGBEZWxldGUgJHttdWx0aUZvcm1hdCA/ICdldmVyeSBleHBvcnRlZCBmb3JtYXQnIDogJ3RoZSBleHBvcnRlZCB2aWRlbyBmaWxlJ30gYnV0IGtlZXAgdGhlIGNsaXAgcmVjb3JkLiBVc2UgdGhlIEV4cG9ydCBzZWN0aW9uIHRvIGRlbGV0ZSBvbmUgZm9ybWF0IGF0IGEgdGltZS5gLCBkYW5nZXI6IHRydWUsIGFjdGlvbjogKCkgPT4gZGVsZXRlRXhwb3J0KGNsaXBJZCkgfSk7XG4gICAgZ3JvdXBzLnB1c2goeyBoZWFkaW5nOiAnRmlsZXMnLCByb3dzOiBmaWxlUm93cyB9KTtcbiAgfVxuXG4gIGlmIChwcmV2IHx8IG5leHQpIHtcbiAgICBjb25zdCBtZXJnZVJvd3MgPSBbXTtcbiAgICBjb25zdCBtZXJnZURlc2MgPSAobmVpZ2hib3IpID0+IHRydW5jYXRlKG5laWdoYm9yLmRlc2NyaXB0aW9uIHx8ICdubyBkZXNjcmlwdGlvbiB5ZXQnLCA2MCk7XG4gICAgaWYgKHByZXYpIG1lcmdlUm93cy5wdXNoKHsgbGFiZWw6ICfihpAgTWVyZ2UgcHJldmlvdXMnLCBkZXNjcmlwdGlvbjogYENvbWJpbmUgd2l0aCBjbGlwICMke3ByZXYuaWR9IChcIiR7bWVyZ2VEZXNjKHByZXYpfVwiKSwgd2hpY2ggc3RhcnRzIGF0ICR7cHJldi5zdGFydF9obXN9LmAsIGFjdGlvbjogKCkgPT4gbWVyZ2VDbGlwcyhjbGlwSWQsIHByZXYuaWQsICdwcmV2JykgfSk7XG4gICAgaWYgKG5leHQpIG1lcmdlUm93cy5wdXNoKHsgbGFiZWw6ICdNZXJnZSBuZXh0IOKGkicsIGRlc2NyaXB0aW9uOiBgQ29tYmluZSB3aXRoIGNsaXAgIyR7bmV4dC5pZH0gKFwiJHttZXJnZURlc2MobmV4dCl9XCIpLCB3aGljaCBzdGFydHMgYXQgJHtuZXh0LnN0YXJ0X2htc30uYCwgYWN0aW9uOiAoKSA9PiBtZXJnZUNsaXBzKGNsaXBJZCwgbmV4dC5pZCwgJ25leHQnKSB9KTtcbiAgICBncm91cHMucHVzaCh7IGhlYWRpbmc6ICdNZXJnZScsIHJvd3M6IG1lcmdlUm93cyB9KTtcbiAgfVxuXG4gIGdyb3Vwcy5wdXNoKHsgaGVhZGluZzogJ0RhbmdlciBab25lJywgcm93czogW1xuICAgIHsgbGFiZWw6ICdEZWxldGUgQ2xpcCcsIGRlc2NyaXB0aW9uOiAnUGVybWFuZW50bHkgcmVtb3ZlIHRoaXMgY2xpcCByZWNvcmQgYW5kIGl0cyBleHBvcnRlZCBmaWxlLicsIGRhbmdlcjogdHJ1ZSwgYWN0aW9uOiAoKSA9PiBkZWxldGVDbGlwKGNsaXBJZCkgfSxcbiAgXX0pO1xuXG4gIG9wZW5BY3Rpb25zTW9kYWwoYENsaXAgIyR7Y2xpcC5pZH0gLSBBZGRpdGlvbmFsIEFjdGlvbnNgLCBncm91cHMpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfcmVsb2FkQ2xpcExpc3QodmlkZW9JZCkge1xuICBpZiAoIXZpZGVvSWQpIHJldHVybjtcbiAgQXBwU3RhdGUuY2xpcHMgPSBhd2FpdCBmZXRjaChfY2xpcHNMaXN0VXJsKHZpZGVvSWQpKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICBfcmVuZGVyQ2xpcHMoKTtcbn1cblxuZnVuY3Rpb24gX3JlcGxhY2VDbGlwSW5MaXN0KHVwZGF0ZWQpIHtcbiAgY29uc3QgaWR4ID0gQXBwU3RhdGUuY2xpcHMuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gdXBkYXRlZC5pZCk7XG4gIGlmIChpZHggIT09IC0xKSBBcHBTdGF0ZS5jbGlwc1tpZHhdID0gdXBkYXRlZDtcbn1cblxuLy8g4pSA4pSAIHNjb3JlIG92ZXJyaWRlICYgbWVyZ2Ug4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX3Njb3JlT3ZlcnJpZGVDbGlwSWQgPSBudWxsO1xubGV0IF9zY29yZU92ZXJyaWRlT3BlbmVyID0gbnVsbDtcblxuZnVuY3Rpb24gb3BlblNjb3JlT3ZlcnJpZGUoY2xpcElkKSB7XG4gIF9zY29yZU92ZXJyaWRlT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgY29uc3QgY2xpcCA9IEFwcFN0YXRlLmNsaXBzLmZpbmQoYyA9PiBjLmlkID09PSBjbGlwSWQpO1xuICBjb25zdCBjdXJyZW50ID0gY2xpcD8uc2NvcmVfb3ZlcmFsbCA/PyAwLjU7XG4gIF9zY29yZU92ZXJyaWRlQ2xpcElkID0gY2xpcElkO1xuICBjb25zdCBzbGlkZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NvcmUtb3ZlcnJpZGUtc2xpZGVyJyk7XG4gIHNsaWRlci52YWx1ZSA9IGN1cnJlbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY29yZS1vdmVycmlkZS1kaXNwbGF5JykudGV4dENvbnRlbnQgPSBNYXRoLnJvdW5kKGN1cnJlbnQqMTAwKSArICclJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njb3JlLW92ZXJyaWRlLWxsbS1ub3RlJykudGV4dENvbnRlbnQgPSBgQ3VycmVudCBhdXRvIHNjb3JlOiAke01hdGgucm91bmQoY3VycmVudCoxMDApfSVgO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NvcmUtb3ZlcnJpZGUtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njb3JlLW92ZXJyaWRlLXNsaWRlcicpPy5mb2N1cygpLCA1MCk7XG59XG5cbmZ1bmN0aW9uIGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NvcmUtb3ZlcnJpZGUtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIF9zY29yZU92ZXJyaWRlQ2xpcElkID0gbnVsbDtcbiAgY29uc3Qgb3BlbmVyID0gX3Njb3JlT3ZlcnJpZGVPcGVuZXI7XG4gIF9zY29yZU92ZXJyaWRlT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfc2NvcmVPdmVycmlkZVNhdmUoKSB7XG4gIGNvbnN0IGNsaXBJZCA9IF9zY29yZU92ZXJyaWRlQ2xpcElkO1xuICBjb25zdCBudW0gPSBwYXJzZUZsb2F0KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY29yZS1vdmVycmlkZS1zbGlkZXInKS52YWx1ZSk7XG4gIGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcElkfS9zY29yZS1vdmVycmlkZWAsIHtcbiAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtzY29yZV9vdmVyYWxsX3VzZXI6IG51bX0pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHsgc2hvd1RvYXN0KCdGYWlsZWQgdG8gc2V0IHNjb3JlIG92ZXJyaWRlJywgJ2Vycm9yJyk7IHJldHVybjsgfVxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgX3JlcGxhY2VDbGlwSW5MaXN0KHVwZGF0ZWQpO1xuICByZW5kZXJEZXRhaWwodXBkYXRlZCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNsZWFyU2NvcmVPdmVycmlkZShjbGlwSWQpIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvY2xpcHMvJHtjbGlwSWR9L3Njb3JlLW92ZXJyaWRlYCwge1xuICAgIG1ldGhvZDogJ1BPU1QnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3Njb3JlX292ZXJhbGxfdXNlcjogbnVsbH0pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHsgc2hvd1RvYXN0KCdGYWlsZWQgdG8gY2xlYXIgb3ZlcnJpZGUnLCAnZXJyb3InKTsgcmV0dXJuOyB9XG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCByZXMuanNvbigpO1xuICBfcmVwbGFjZUNsaXBJbkxpc3QodXBkYXRlZCk7XG4gIHJlbmRlckRldGFpbCh1cGRhdGVkKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbWVyZ2VDbGlwcyhjbGlwQUlkLCBjbGlwQklkLCBkaXJlY3Rpb24pIHtcbiAgY29uc3QgbGFiZWwgPSBkaXJlY3Rpb24gPT09ICdwcmV2JyA/ICdwcmV2aW91cycgOiAnbmV4dCc7XG4gIHNob3dDb25maXJtKFxuICAgICdNZXJnZSBjbGlwcz8nLFxuICAgIGBNZXJnZSB0aGlzIGNsaXAgd2l0aCB0aGUgJHtsYWJlbH0gY2xpcD8gVGhlIG1lcmdlZCBjbGlwIHdpbGwgc3BhbiBib3RoIHRpbWUgcmFuZ2VzLiBUaGlzIGNhbm5vdCBiZSB1bmRvbmUuYCxcbiAgICAnTWVyZ2UnLFxuICAgICgpID0+IF9kb01lcmdlQ2xpcHMoY2xpcEFJZCwgY2xpcEJJZCksXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvTWVyZ2VDbGlwcyhjbGlwQUlkLCBjbGlwQklkKSB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcEFJZH0vbWVyZ2VgLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7Y2xpcF9iX2lkOiBjbGlwQklkfSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgeyBjb25zdCBlID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKT0+KHt9KSk7IHNob3dUb2FzdChlLmRldGFpbCB8fCAnTWVyZ2UgZmFpbGVkJywgJ2Vycm9yJyk7IHJldHVybjsgfVxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgQXBwU3RhdGUuY2xpcHMgPSBBcHBTdGF0ZS5jbGlwcy5maWx0ZXIoYyA9PiBjLmlkICE9PSBjbGlwQklkKTtcbiAgX3JlcGxhY2VDbGlwSW5MaXN0KHVwZGF0ZWQpO1xuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBjbGlwQUlkO1xuICBfcmVuZGVyQ2xpcHMoKTtcbiAgcmVuZGVyRGV0YWlsKHVwZGF0ZWQpO1xuICBzaG93VG9hc3QoJ0NsaXBzIG1lcmdlZCcpO1xufVxuXG4vLyBNaXJyb3JzIERFRkFVTFRfT1ZFUkxBUF9USFJFU0hPTEQgaW4gc2NvcmluZy9kZWR1cC5weS4gVGhlIGR1cmFibGUgZmxhZy9iYWRnZVxuLy8gY29tZXMgZnJvbSBhIHNlcnZlciBzY2FuICh0aGUgJ3Bvc3NpYmxlX2R1cGxpY2F0ZScgdGFnKTsgdGhpcyByZWNvbXB1dGVzIHRoZVxuLy8gc3BlY2lmaWMgb3ZlcmxhcHBpbmcgcGFydG5lciBjbGllbnQtc2lkZSBzbyB0aGUgZGV0YWlsIHBhbmVsIGNhbiBuYW1lIGl0IGFuZFxuLy8gb2ZmZXIgYSBvbmUtY2xpY2sgbWVyZ2Ugd2l0aG91dCBkZXBlbmRpbmcgb24gdGhlIGxhc3Qgc2NhbidzIHJlc3BvbnNlLlxuY29uc3QgX0RVUF9PVkVSTEFQX1RIUkVTSE9MRCA9IDAuNztcblxuZnVuY3Rpb24gX2R1cGxpY2F0ZVBhcnRuZXJzKGNsaXApIHtcbiAgcmV0dXJuIEFwcFN0YXRlLmNsaXBzXG4gICAgLmZpbHRlcihvdGhlciA9PiBvdGhlci5pZCAhPT0gY2xpcC5pZCAmJiBvdGhlci5zdGF0dXMgIT09ICdyZWplY3RlZCcpXG4gICAgLm1hcChvdGhlciA9PiB7XG4gICAgICBjb25zdCBvdmVybGFwTXMgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihjbGlwLmVuZF9tcywgb3RoZXIuZW5kX21zKSAtIE1hdGgubWF4KGNsaXAuc3RhcnRfbXMsIG90aGVyLnN0YXJ0X21zKSk7XG4gICAgICBjb25zdCBzaG9ydGVyTXMgPSBNYXRoLm1pbihjbGlwLmVuZF9tcyAtIGNsaXAuc3RhcnRfbXMsIG90aGVyLmVuZF9tcyAtIG90aGVyLnN0YXJ0X21zKTtcbiAgICAgIHJldHVybiB7Y2xpcDogb3RoZXIsIHJhdGlvOiBzaG9ydGVyTXMgPiAwID8gb3ZlcmxhcE1zIC8gc2hvcnRlck1zIDogMH07XG4gICAgfSlcbiAgICAuZmlsdGVyKHBhcnRuZXIgPT4gcGFydG5lci5yYXRpbyA+PSBfRFVQX09WRVJMQVBfVEhSRVNIT0xEKVxuICAgIC5zb3J0KChhLCBiKSA9PiBiLnJhdGlvIC0gYS5yYXRpbyk7XG59XG5cbmZ1bmN0aW9uIF9kdXBsaWNhdGVOb3RpY2VIVE1MKGNsaXApIHtcbiAgaWYgKCEoY2xpcC50YWdzIHx8IFtdKS5pbmNsdWRlcygncG9zc2libGVfZHVwbGljYXRlJykpIHJldHVybiAnJztcbiAgY29uc3QgcGFydG5lcnMgPSBfZHVwbGljYXRlUGFydG5lcnMoY2xpcCk7XG4gIGlmICghcGFydG5lcnMubGVuZ3RoKSByZXR1cm4gJyc7XG4gIGNvbnN0IGJ1dHRvbnMgPSBwYXJ0bmVycy5tYXAocGFydG5lciA9PiB7XG4gICAgY29uc3QgZGlyZWN0aW9uID0gcGFydG5lci5jbGlwLnN0YXJ0X21zIDwgY2xpcC5zdGFydF9tcyA/ICdwcmV2JyA6ICduZXh0JztcbiAgICByZXR1cm4gYDxidXR0b24gY2xhc3M9XCJidG5cIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDlweFwiIGRhdGEtbWVyZ2UtYT1cIiR7Y2xpcC5pZH1cIiBkYXRhLW1lcmdlLWI9XCIke3BhcnRuZXIuY2xpcC5pZH1cIiBkYXRhLW1lcmdlLWRpcj1cIiR7ZGlyZWN0aW9ufVwiPk1lcmdlICMke3BhcnRuZXIuY2xpcC5pZH0gJm1pZGRvdDsgJHtwYXJ0bmVyLmNsaXAuc3RhcnRfaG1zfTwvYnV0dG9uPmA7XG4gIH0pLmpvaW4oJycpO1xuICBjb25zdCBpZHMgPSBwYXJ0bmVycy5tYXAocGFydG5lciA9PiAnIycgKyBwYXJ0bmVyLmNsaXAuaWQpLmpvaW4oJywgJyk7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImNsaXAtZHVwLW5vdGljZVwiIHJvbGU9XCJub3RlXCI+XG4gICAgPGRpdj4mIzg2NDY7IFBvc3NpYmxlIGR1cGxpY2F0ZSAtIG92ZXJsYXBzICR7cGFydG5lcnMubGVuZ3RoID09PSAxID8gJ2NsaXAnIDogJ2NsaXBzJ30gJHtpZHN9LiBNZXJnZSB0byBjb21iaW5lIGludG8gdGhpcyBjbGlwLjwvZGl2PlxuICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjZweDtmbGV4LXdyYXA6d3JhcDttYXJnaW4tdG9wOjZweFwiPiR7YnV0dG9uc308L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2NhbkR1cGxpY2F0ZXMoYnVzeUJ0bikge1xuICBjb25zdCB2aWRlb0lkID0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZDtcbiAgaWYgKCF2aWRlb0lkKSByZXR1cm47XG4gIGNvbnN0IGJ0biA9IGJ1c3lCdG4gfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1zY2FuLWR1cGxpY2F0ZXMnKTtcbiAgY29uc3Qgb3JpZ0xhYmVsID0gYnRuPy50ZXh0Q29udGVudDtcbiAgaWYgKGJ0bikgeyBidG4uZGlzYWJsZWQgPSB0cnVlOyBidG4udGV4dENvbnRlbnQgPSAnQ2hlY2tpbmcuLi4nOyB9XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vc2Nhbi1kdXBsaWNhdGVzYCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgaWYgKCFyZXMub2spIHsgY29uc3QgZSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7IHNob3dUb2FzdChlLmRldGFpbCB8fCAnRHVwbGljYXRlIHNjYW4gZmFpbGVkJywgJ2Vycm9yJyk7IHJldHVybjsgfVxuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXMuanNvbigpO1xuICAgIGF3YWl0IF9yZWxvYWRDbGlwTGlzdCh2aWRlb0lkKTtcbiAgICBpZiAoQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSByZWZyZXNoQ2xpcERldGFpbChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpO1xuICAgIHNob3dUb2FzdChib2R5LmNsaXBzX2ZsYWdnZWRcbiAgICAgID8gYEZvdW5kICR7Ym9keS5jbGlwc19mbGFnZ2VkfSBwb3NzaWJsZSBkdXBsaWNhdGUgJHtib2R5LmNsaXBzX2ZsYWdnZWQgPT09IDEgPyAnY2xpcCcgOiAnY2xpcHMnfWBcbiAgICAgIDogJ05vIGR1cGxpY2F0ZSBjbGlwcyBmb3VuZCcpO1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChidG4pIHsgYnRuLmRpc2FibGVkID0gZmFsc2U7IGJ0bi50ZXh0Q29udGVudCA9IG9yaWdMYWJlbDsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9wZW5DbGlwc0FjdGlvbnNNZW51KGJ0bikge1xuICBjb25zdCBuZXdMYWJlbCA9IEFwcFN0YXRlLmNsaXBLaW5kID09PSAnc2NlbmUnID8gJ05ldyBzY2VuZScgOiAnTmV3IGNsaXAnO1xuICBzaG93S2ViYWIoYnRuLCBbXG4gICAgeyBsYWJlbDogbmV3TGFiZWwsIGFjdGlvbjogKCkgPT4gd2luZG93Lm9wZW5DbGlwQ3JlYXRlUGlja2VyKEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQsIEFwcFN0YXRlLmNsaXBLaW5kKSB9LFxuICAgIHsgbGFiZWw6ICdDaGVjayBkdXBsaWNhdGVzJywgYWN0aW9uOiAoKSA9PiBzY2FuRHVwbGljYXRlcyhidG4pIH0sXG4gIF0pO1xufVxuXG5mdW5jdGlvbiBfcGFyc2VUaW1pbmdPZmZzZXQoc3RyKSB7XG4gIGlmICghc3RyKSByZXR1cm4gMC4wO1xuICBjb25zdCBzID0gc3RyLnRyaW0oKTtcbiAgaWYgKC9eWystXS8udGVzdChzKSkgcmV0dXJuIHBhcnNlRmxvYXQocyk7XG4gIGlmICgvXlxcZCs6XFxkKyhcXC5cXGQrKT8kLy50ZXN0KHMpKSB7XG4gICAgY29uc3QgW20sIHNlY10gPSBzLnNwbGl0KCc6Jyk7XG4gICAgY29uc3QgYWJzU2VjID0gcGFyc2VJbnQobSkgKiA2MCArIHBhcnNlRmxvYXQoc2VjKTtcbiAgICBjb25zdCBjbGlwU3RhcnRTZWMgPSBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YT8uc3RhcnRfbXMgPyBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YS5zdGFydF9tcyAvIDEwMDAgOiAwO1xuICAgIHJldHVybiBhYnNTZWMgLSBjbGlwU3RhcnRTZWM7XG4gIH1cbiAgcmV0dXJuIHBhcnNlRmxvYXQocyk7XG59XG5cbi8vIOKUgOKUgCBkZXNjcmlwdGlvbiBlZGl0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gX29wZW5DbGlwRGVzY0tlYmFiKGNsaXBJZCwgYnRuLCBmaWVsZCkge1xuICBjb25zdCBjbGlwICAgID0gQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGE7XG4gIGNvbnN0IGlzTG9uZyAgPSBmaWVsZCA9PT0gJ2Rlc2NyaXB0aW9uX2xvbmcnO1xuICBjb25zdCBlZGl0VGl0bGUgICA9IGlzTG9uZyA/ICdFZGl0IExvbmcgRGVzY3JpcHRpb24nICAgOiAnRWRpdCBEZXNjcmlwdGlvbic7XG4gIGNvbnN0IHJldmVydFRpdGxlID0gaXNMb25nID8gJ1JldmVydCBMb25nIERlc2NyaXB0aW9uJyA6ICdSZXZlcnQgRGVzY3JpcHRpb24nO1xuICBjb25zdCBjdXJyZW50ICA9IGlzTG9uZyA/IGNsaXA/LmRlc2NyaXB0aW9uX2xvbmcgICAgICAgICAgOiBjbGlwPy5kZXNjcmlwdGlvbjtcbiAgY29uc3QgaXNFZGl0ZWQgPSBpc0xvbmcgPyBjbGlwPy5kZXNjcmlwdGlvbl9sb25nX2lzX2VkaXRlZCA6IGNsaXA/LmRlc2NyaXB0aW9uX2lzX2VkaXRlZDtcbiAgY29uc3Qgb3JpZ2luYWwgPSBpc0xvbmcgPyBjbGlwPy5kZXNjcmlwdGlvbl9sb25nX29yaWdpbmFsICA6IGNsaXA/LmRlc2NyaXB0aW9uX29yaWdpbmFsO1xuXG4gIGNvbnN0IGl0ZW1zID0gW1xuICAgIHsgbGFiZWw6ICdFZGl0JywgYWN0aW9uOiAoKSA9PlxuICAgICAgb3BlbkZpZWxkRWRpdE1vZGFsKGVkaXRUaXRsZSwgY3VycmVudCB8fCAnJywgYXN5bmMgdiA9PiB7XG4gICAgICAgIGF3YWl0IF9wYXRjaENsaXBGaWVsZChjbGlwSWQsICdhY2NlcHRfZWRpdCcsIGZpZWxkLFxuICAgICAgICAgIGlzTG9uZyA/IG51bGwgOiB2LCBpc0xvbmcgPyB2IDogbnVsbCk7XG4gICAgICAgIHNlbGVjdENsaXAoY2xpcElkKTtcbiAgICAgIH0pXG4gICAgfSxcbiAgXTtcbiAgaWYgKGlzRWRpdGVkKSB7XG4gICAgaXRlbXMucHVzaCh7IGxhYmVsOiAnUmV2ZXJ0IHRvIE9yaWdpbmFsJywgYWN0aW9uOiAoKSA9PlxuICAgICAgb3BlbkRpZmZNb2RhbChyZXZlcnRUaXRsZSwgW1xuICAgICAgICB7bGFiZWw6ICdEZXNjcmlwdGlvbicsIGN1cnJlbnQsIHByb3Bvc2VkOiBvcmlnaW5hbH0sXG4gICAgICBdLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IF9wYXRjaENsaXBGaWVsZChjbGlwSWQsICdyZXZlcnQnLCBmaWVsZCwgbnVsbCwgbnVsbCk7XG4gICAgICAgIHNlbGVjdENsaXAoY2xpcElkKTtcbiAgICAgIH0sIHtyZXZlcnRNb2RlOiB0cnVlfSlcbiAgICB9KTtcbiAgfVxuICBpdGVtcy5wdXNoKG51bGwsIHsgbGFiZWw6ICdSZWdlbmVyYXRlIHZpYSBSZS1zY29yZScsIGFjdGlvbjogKCkgPT4gd2luZG93LnJlc2NvcmVDbGlwKGNsaXBJZCkgfSk7XG4gIHNob3dLZWJhYihidG4sIGl0ZW1zKTtcbn1cblxuZnVuY3Rpb24gb3BlbkRlc2NLZWJhYihjbGlwSWQsIGJ0bikgICAgIHsgX29wZW5DbGlwRGVzY0tlYmFiKGNsaXBJZCwgYnRuLCAnZGVzY3JpcHRpb24nKTsgfVxuZnVuY3Rpb24gb3BlbkRlc2NMb25nS2ViYWIoY2xpcElkLCBidG4pIHsgX29wZW5DbGlwRGVzY0tlYmFiKGNsaXBJZCwgYnRuLCAnZGVzY3JpcHRpb25fbG9uZycpOyB9XG5cbmFzeW5jIGZ1bmN0aW9uIF9wYXRjaENsaXBGaWVsZChjbGlwSWQsIGFjdGlvbiwgZmllbGQsIG5ld0Rlc2MsIG5ld0Rlc2NMb25nKSB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcElkfS9maWVsZHNgLCB7XG4gICAgbWV0aG9kOiAnUEFUQ0gnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe2FjdGlvbiwgZmllbGQsIG5ld19kZXNjcmlwdGlvbjogbmV3RGVzYywgbmV3X2Rlc2NyaXB0aW9uX2xvbmc6IG5ld0Rlc2NMb25nfSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgc2hvd1RvYXN0KCdTYXZlIGZhaWxlZCcsICdlcnJvcicpO1xufVxuXG5mdW5jdGlvbiBjbGVhckRldGFpbCgpIHtcbiAgY29uc3QgaGFzUmVjb3JkaW5nID0gISFBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyLWFyZWEnKS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBjbGFzcz1cIm5vLWV4cG9ydC1tc2dcIj48ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpXCI+JHtoYXNSZWNvcmRpbmcgPyAnU2VsZWN0IGEgY2xpcCB0byByZXZpZXcnIDogJ1NlbGVjdCBhIHJlY29yZGluZyB0byBnZXQgc3RhcnRlZCd9PC9kaXY+PC9kaXY+YDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RldGFpbCcpLmlubmVySFRNTCA9IGhhc1JlY29yZGluZ1xuICAgID8gJzxkaXYgY2xhc3M9XCJkZXRhaWwtZW1wdHlcIj5TZWxlY3QgYSBjbGlwIGZyb20gdGhlIHNpZGViYXI8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4O21hcmdpbi10b3A6NnB4XCI+VXNlIOKGkCDihpIgdG8gbmF2aWdhdGUgYmV0d2VlbiBjbGlwczwvZGl2PjwvZGl2PidcbiAgICA6ICc8ZGl2IGNsYXNzPVwiZGV0YWlsLWVtcHR5XCI+U2VsZWN0IGEgcmVjb3JkaW5nIG9uIHRoZSBsZWZ0PC9kaXY+Jztcbn1cblxuLy8g4pSA4pSAIGNsaXAgYWN0aW9ucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmFzeW5jIGZ1bmN0aW9uIHNldFN0YXR1cyhpZCwgc3RhdHVzKSB7XG4gIGNvbnN0IGNsaXAgPSBBcHBTdGF0ZS5jbGlwcy5maW5kKGMgPT4gYy5pZCA9PT0gaWQpO1xuICBjb25zdCBmcm9tU3RhdHVzID0gY2xpcD8uc3RhdHVzO1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS9jbGlwcy8ke2lkfS9zdGF0dXNgLCB7XG4gICAgbWV0aG9kOiAgJ1BPU1QnLFxuICAgIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICBib2R5OiAgICBKU09OLnN0cmluZ2lmeSh7c3RhdHVzfSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykge1xuICAgIGNvbnN0IGVyciA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgc2hvd1RvYXN0KGBGYWlsZWQgdG8gdXBkYXRlIHN0YXR1czogJHtmb3JtYXRBcGlFcnJvcihlcnIpfWAsICdlcnJvcicpO1xuICAgIHJldHVybjtcbiAgfVxuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBpZDtcbiAgY29uc3QgW2NsaXBzRGF0YSwgY2xpcERldGFpbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgZmV0Y2goX2NsaXBzTGlzdFVybChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKSkudGhlbihyID0+IHIuanNvbigpKSxcbiAgICBmZXRjaChgL2FwaS9jbGlwcy8ke2lkfWApLnRoZW4ociA9PiByLmpzb24oKSksXG4gIF0pO1xuICBBcHBTdGF0ZS5jbGlwcyA9IGNsaXBzRGF0YTtcbiAgX3JlbmRlckNsaXBzKCk7XG4gIHJlbmRlckRldGFpbChjbGlwRGV0YWlsKTtcbiAgbG9hZFZpZGVvcygpO1xuXG4gIGlmIChmcm9tU3RhdHVzICYmIGZyb21TdGF0dXMgIT09IHN0YXR1cykge1xuICAgIGlmIChBcHBTdGF0ZS5sYXN0U3RhdHVzQ2hhbmdlPy50aW1lcikgY2xlYXJUaW1lb3V0KEFwcFN0YXRlLmxhc3RTdGF0dXNDaGFuZ2UudGltZXIpO1xuICAgIGlmIChBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZT8udGltZXIpIGNsZWFyVGltZW91dChBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZS50aW1lcik7XG4gICAgQXBwU3RhdGUubGFzdEJ1bGtTdGF0dXNDaGFuZ2UgPSBudWxsO1xuICAgIGNvbnN0IGxhYmVsID0ge2FwcHJvdmVkOidBcHByb3ZlZCcsIHJlamVjdGVkOidSZWplY3RlZCcsIHBlbmRpbmc6J01hcmtlZCBhcyBVbnJldmlld2VkJ31bc3RhdHVzXSB8fCBzdGF0dXM7XG4gICAgQXBwU3RhdGUubGFzdFN0YXR1c0NoYW5nZSA9IHtjbGlwSWQ6IGlkLCBmcm9tU3RhdHVzfTtcbiAgICBBcHBTdGF0ZS5sYXN0U3RhdHVzQ2hhbmdlLnRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7IEFwcFN0YXRlLmxhc3RTdGF0dXNDaGFuZ2UgPSBudWxsOyB9LCA1MDAwKTtcbiAgICBzaG93VW5kb1RvYXN0KGBDbGlwICR7bGFiZWx9YCwgdW5kb0xhc3RTdGF0dXMpO1xuICB9XG59XG5cbi8vIEN0cmwvQ21kK1ogZGlzcGF0Y2ggKHNldHRpbmdzLmpzKSAtIHByZWZlcnMgd2hpY2hldmVyIG9mIHNpbmdsZS9idWxrIHN0YXR1c1xuLy8gY2hhbmdlIGlzIHN0aWxsIHBlbmRpbmc7IHNldHRpbmcgZWl0aGVyIGNsZWFycyB0aGUgb3RoZXIsIHNvIGF0IG1vc3Qgb25lIGlzXG4vLyBldmVyIGxpdmUgYW5kIHRoaXMgbmV2ZXIgaGFzIHRvIGFyYml0cmF0ZSBiZXR3ZWVuIHRoZSB0d28uXG5mdW5jdGlvbiB1bmRvTGFzdFN0YXR1cygpIHtcbiAgaWYgKEFwcFN0YXRlLmxhc3RCdWxrU3RhdHVzQ2hhbmdlKSB7XG4gICAgdW5kb0xhc3RCdWxrU3RhdHVzKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghQXBwU3RhdGUubGFzdFN0YXR1c0NoYW5nZSkgcmV0dXJuO1xuICBjb25zdCB7Y2xpcElkLCBmcm9tU3RhdHVzfSA9IEFwcFN0YXRlLmxhc3RTdGF0dXNDaGFuZ2U7XG4gIGNsZWFyVGltZW91dChBcHBTdGF0ZS5sYXN0U3RhdHVzQ2hhbmdlLnRpbWVyKTtcbiAgQXBwU3RhdGUubGFzdFN0YXR1c0NoYW5nZSA9IG51bGw7XG4gIHNldFN0YXR1cyhjbGlwSWQsIGZyb21TdGF0dXMpO1xufVxuXG4vLyDilIDilIAgZGVsZXRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gZGVsZXRlRXhwb3J0KGlkKSB7XG4gIHNob3dDb25maXJtKFxuICAgICdEZWxldGUgZXhwb3J0ZWQgZmlsZT8nLFxuICAgICdUaGUgZXhwb3J0ZWQgdmlkZW8gZmlsZSB3aWxsIGJlIHJlbW92ZWQgZnJvbSBkaXNrLiBUaGUgY2xpcCByZWNvcmQgc3RheXMgLSB5b3UgY2FuIHJlLWV4cG9ydCBhbnkgdGltZS4nLFxuICAgICdEZWxldGUgRXhwb3J0JyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBSZWxlYXNlIHRoZSBzdHJlYW1pbmcgY29ubmVjdGlvbiBmaXJzdCAtIG9uIFdpbmRvd3MgdGhlIHNlcnZlcidzIFN0YXRpY0ZpbGVzXG4gICAgICAvLyBoYW5kbGUgc3RheXMgb3BlbiB3aGlsZSB0aGUgPHZpZGVvPiBpcyBjb25uZWN0ZWQsIGJsb2NraW5nIHRoZSBkZWxldGUuXG4gICAgICBhd2FpdCBfcmVsZWFzZVBsYXllckJlZm9yZURlbGV0ZSgpO1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvY2xpcHMvJHtpZH0vZXhwb3J0YCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgICAgIGlmICghcmVzLm9rKSB7XG4gICAgICAgIGNvbnN0IGVyciA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgICAgIHNob3dUb2FzdChgRmFpbGVkIHRvIGRlbGV0ZSBleHBvcnQ6ICR7Zm9ybWF0QXBpRXJyb3IoZXJyKX1gLCAnZXJyb3InKTtcbiAgICAgICAgc2VsZWN0Q2xpcChpZCk7ICAvLyByZXN0b3JlIHRoZSBwbGF5ZXIvZGV0YWlsIHdlIGNsZWFyZWQgYWJvdmVcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGEuaGFzX2V4cG9ydCA9IGZhbHNlO1xuICAgICAgQXBwU3RhdGUuYWN0aXZlTWVkaWFGaWxlbmFtZSA9IG51bGw7XG4gICAgICByZW5kZXJQbGF5ZXIobnVsbCwgbnVsbCwgaWQpO1xuICAgICAgcmVuZGVyRGV0YWlsKEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhKTtcbiAgICAgIGF3YWl0IF9yZWxvYWRDbGlwTGlzdChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKTtcbiAgICAgIHNob3dUb2FzdCgnRXhwb3J0ZWQgZmlsZSBkZWxldGVkJyk7XG4gICAgfSxcbiAgICB0cnVlLFxuICApO1xufVxuXG5mdW5jdGlvbiBkZWxldGVDbGlwKGlkKSB7XG4gIHNob3dDb25maXJtKFxuICAgICdEZWxldGUgY2xpcD8nLFxuICAgIGBUaGUgY2xpcCByZWNvcmQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGRhdGFiYXNlLiBgICtcbiAgICBgSXRzIGV4cG9ydGVkIHZpZGVvIGZpbGUgKGlmIGFueSkgd2lsbCBhbHNvIGJlIGRlbGV0ZWQgZnJvbSB0aGUgZXhwb3J0cyBmb2xkZXIuYCxcbiAgICAnRGVsZXRlJyxcbiAgICAoKSA9PiBfZG9EZWxldGVDbGlwKGlkKSxcbiAgICB0cnVlLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZG9EZWxldGVDbGlwKGlkKSB7XG4gIGNvbnN0IHZpZGVvSWQgPSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkO1xuICAvLyBSZWxlYXNlIHRoZSBwbGF5ZXIgc28gaXRzIGJhY2tpbmcgZXhwb3J0L3ByZXZpZXcgZmlsZSBpc24ndCBsb2NrZWQgZHVyaW5nIGRlbGV0ZS5cbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCA9PT0gaWQpIGF3YWl0IF9yZWxlYXNlUGxheWVyQmVmb3JlRGVsZXRlKCk7XG4gIGNvbnN0IGRlbFJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7aWR9YCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgaWYgKCFkZWxSZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCBkZWxSZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChgRmFpbGVkIHRvIGRlbGV0ZSBjbGlwOiAke2Zvcm1hdEFwaUVycm9yKGVycil9YCwgJ2Vycm9yJyk7XG4gICAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCA9PT0gaWQpIHNlbGVjdENsaXAoaWQpO1xuICAgIHJldHVybjtcbiAgfVxuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBudWxsO1xuICBjbGVhckRldGFpbCgpO1xuICBhd2FpdCBfcmVsb2FkQ2xpcExpc3QodmlkZW9JZCk7XG4gIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgc2hvd1RvYXN0KCdDbGlwIGRlbGV0ZWQnKTtcbn1cblxuLy8g4pSA4pSAIGZpbmQgc2ltaWxhciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfc2ltaWxhckNsaXBzQ2xpcElkID0gbnVsbDtcbmxldCBfc2ltaWxhckNsaXBzT3BlbmVyID0gbnVsbDtcblxuZnVuY3Rpb24gb3BlblNpbWlsYXJDbGlwc01vZGFsKGNsaXBJZCkge1xuICBfc2ltaWxhckNsaXBzT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgX3NpbWlsYXJDbGlwc0NsaXBJZCA9IGNsaXBJZDtcbiAgY29uc3QgY3VycmVudFZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKTtcbiAgY29uc3Qgb3RoZXJWaWRlb3MgPSBBcHBTdGF0ZS52aWRlb3MuZmlsdGVyKHYgPT4gdi5pZCAhPT0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCAmJiB2LnN0YXR1cyA9PT0gJ2RvbmUnKTtcblxuICBjb25zdCBzY29wZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaW1pbGFyLWNsaXBzLXNjb3BlJyk7XG4gIHNjb3BlLmlubmVySFRNTCA9ICcnO1xuXG4gIGNvbnN0IGFkZENoZWNrID0gKGlkLCBsYWJlbCwgY2hlY2tlZCkgPT4ge1xuICAgIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XG4gICAgcm93LnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4O2ZvbnQtc2l6ZToxM3B4O2N1cnNvcjpwb2ludGVyJztcbiAgICByb3cuaW5uZXJIVE1MID0gYDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBkYXRhLXZpZGVvLWlkPVwiJHtpZH1cIiAke2NoZWNrZWQgPyAnY2hlY2tlZCcgOiAnJ30+ICR7ZXNjSHRtbChsYWJlbCl9YDtcbiAgICBzY29wZS5hcHBlbmRDaGlsZChyb3cpO1xuICB9O1xuXG4gIGlmIChjdXJyZW50VmlkZW8pIGFkZENoZWNrKGN1cnJlbnRWaWRlby5pZCwgYCR7Y3VycmVudFZpZGVvLnRpdGxlIHx8IGN1cnJlbnRWaWRlby5maWxlbmFtZX0gKHRoaXMgcmVjb3JkaW5nKWAsIHRydWUpO1xuICBmb3IgKGNvbnN0IHYgb2Ygb3RoZXJWaWRlb3MpIGFkZENoZWNrKHYuaWQsIHYudGl0bGUgfHwgdi5maWxlbmFtZSwgZmFsc2UpO1xuICBpZiAoIWN1cnJlbnRWaWRlbyAmJiAhb3RoZXJWaWRlb3MubGVuZ3RoKSB7XG4gICAgc2NvcGUuaW5uZXJIVE1MID0gJzxkaXYgc3R5bGU9XCJmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZClcIj5ObyBwcm9jZXNzZWQgcmVjb3JkaW5ncyBhdmFpbGFibGU8L2Rpdj4nO1xuICB9XG5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpbWlsYXItY2xpcHMtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGNvbnN0IGZpcnN0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NpbWlsYXItY2xpcHMtc2NvcGUgaW5wdXRbdHlwZT1jaGVja2JveF0nKTtcbiAgICAoZmlyc3QgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NpbWlsYXItY2xpcHMtbW9kYWwgLmJ0bicpKT8uZm9jdXMoKTtcbiAgfSwgNTApO1xufVxuXG5mdW5jdGlvbiBjbG9zZVNpbWlsYXJDbGlwc01vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2ltaWxhci1jbGlwcy1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgX3NpbWlsYXJDbGlwc0NsaXBJZCA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9zaW1pbGFyQ2xpcHNPcGVuZXI7XG4gIF9zaW1pbGFyQ2xpcHNPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0RmluZFNpbWlsYXIoKSB7XG4gIGNvbnN0IGNsaXBJZCA9IF9zaW1pbGFyQ2xpcHNDbGlwSWQ7XG4gIGlmICghY2xpcElkKSByZXR1cm47XG4gIGlmIChfYmxvY2tlZEJ5QW5hbHl6ZSgnZmluZCBzaW1pbGFyIGNsaXBzJykpIHJldHVybjtcblxuICBjb25zdCBjaGVja2VkID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjc2ltaWxhci1jbGlwcy1zY29wZSBpbnB1dFt0eXBlPWNoZWNrYm94XTpjaGVja2VkJykpO1xuICBjb25zdCB2aWRlb0lkcyA9IGNoZWNrZWQubWFwKGVsID0+IGVsLmRhdGFzZXQudmlkZW9JZCkuam9pbignLCcpO1xuXG4gIGNsb3NlU2ltaWxhckNsaXBzTW9kYWwoKTtcblxuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWZpbmQtc2ltaWxhcicpO1xuICBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IHRydWU7IGJ0bi50ZXh0Q29udGVudCA9ICdTZWFyY2hpbmfigKYnOyB9XG4gIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKTtcbiAgb3BlbkxvZygpO1xuXG4gIGNvbnN0IHJlc2V0QnRuID0gKCkgPT4geyBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IGZhbHNlOyBidG4udGV4dENvbnRlbnQgPSAnRmluZCBTaW1pbGFyJzsgfSB9O1xuICBjb25zdCBxcyA9IHZpZGVvSWRzID8gYD92aWRlb19pZHM9JHtlbmNvZGVVUklDb21wb25lbnQodmlkZW9JZHMpfWAgOiAnJztcbiAgY29uc3QgaGFuZGxlID0gX29wZW5TU0UoXG4gICAgYC9hcGkvY2xpcHMvJHtjbGlwSWR9L3JlbGF0ZWQtY2xpcHMke3FzfWAsXG4gICAgbXNnID0+IHsgYXBwZW5kTG9nKFN0cmluZyhtc2cpKTsgfSxcbiAgICBhc3luYyBtc2cgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICByZXNldEJ0bigpO1xuICAgICAgY29uc3QgY2xpcCA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcElkfWApLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICBpZiAoY2xpcCkge1xuICAgICAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YSA9IGNsaXA7XG4gICAgICAgIGlmICghUGFuZWxOYXYuaXNPcGVuKCkpIHJlbmRlckRldGFpbChjbGlwKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvdW50ID0gbXNnLnJlc3VsdHM/Lmxlbmd0aCA/PyAwO1xuICAgICAgc2hvd1RvYXN0KGNvdW50ID8gYEZvdW5kICR7cGx1cmFsKGNvdW50LCAnc2ltaWxhciBjbGlwJyl9YCA6ICdObyBzaW1pbGFyIGNsaXBzIGZvdW5kJyk7XG4gICAgfSxcbiAgICBlcnJNc2cgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICByZXNldEJ0bigpO1xuICAgICAgc2hvd1RvYXN0KGBGaW5kIFNpbWlsYXIgZmFpbGVkIC0gJHtlcnJNc2d9YCwgJ2Vycm9yJyk7XG4gICAgfSxcbiAgKTtcbiAgX3NldEFjdGl2ZVN0cmVhbShoYW5kbGUsIHJlc2V0QnRuKTtcbn1cblxuLy8g4pSA4pSAIHNjb3Jpbmcg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBzY29yZUFsbCgpIHtcbiAgb3BlbkxvZygpO1xuICBzdHJlYW1TU0UoXG4gICAgJy9hcGkvc2NvcmUnLFxuICAgICgpID0+IHtcbiAgICAgIGxvYWRWaWRlb3MoKTtcbiAgICAgIF9yZWxvYWRDbGlwTGlzdChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKTtcbiAgICAgIHNob3dUb2FzdCgnU2NvcmluZyBjb21wbGV0ZScpO1xuICAgIH0sXG4gICAgU0NPUkVfU1RFUFMsXG4gICAgJ1Njb3JpbmcnLFxuICApO1xufVxuXG4vLyBTdGF0aWMgaW5kZXguaHRtbCBidXR0b25zIHRoaXMgbW9kdWxlIG93bnMgKGZpbHRlciBjaGlwcywga2luZCB0b2dnbGUsIHNvcnRcbi8vIGRpciwga2ViYWIsIHNlYXJjaCwgbWluLXNjb3JlKSAtIHdpcmVkIGhlcmUgb25jZSBhdCBtb2R1bGUgbG9hZCwgc2FtZSBwYXR0ZXJuXG4vLyBhcyB0aGUgI2NsaXAtbGlzdCAvICNkZXRhaWwgZGVsZWdhdGlvbiBhYm92ZSwgcmVwbGFjaW5nIHRoZSBvbmNsaWNrPS9vbmlucHV0PS9cbi8vIG9uY2hhbmdlPSBhdHRyaWJ1dGVzIHRoYXQgdXNlZCB0byBsaXZlIG9uIHRoYXQgbWFya3VwIGRpcmVjdGx5LlxuZnVuY3Rpb24gX2hhbmRsZUNsaXBTaWRlYmFyQ2xpY2soZSkge1xuICBjb25zdCBraW5kQnRuID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEta2luZF0nKTtcbiAgaWYgKGtpbmRCdG4pIHsgc2V0Q2xpcEtpbmQoa2luZEJ0bi5kYXRhc2V0LmtpbmQpOyByZXR1cm47IH1cbiAgY29uc3QgZmlsdGVyQ2hpcCA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWZpbHRlcl0nKTtcbiAgaWYgKGZpbHRlckNoaXApIHsgdG9nZ2xlQ2xpcEZpbHRlcihmaWx0ZXJDaGlwLmRhdGFzZXQuZmlsdGVyKTsgcmV0dXJuOyB9XG4gIGlmIChlLnRhcmdldC5jbG9zZXN0KCcjY2xpcHMtc29ydC1kaXInKSkgeyB0b2dnbGVDbGlwU29ydERpcigpOyByZXR1cm47IH1cbiAgY29uc3Qga2ViYWJCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCcjYnRuLWNsaXBzLWFjdGlvbnMnKTtcbiAgaWYgKGtlYmFiQnRuKSB7IG9wZW5DbGlwc0FjdGlvbnNNZW51KGtlYmFiQnRuKTsgcmV0dXJuOyB9XG59XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwcy1zaWRlYmFyLWdyb3VwJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBfaGFuZGxlQ2xpcFNpZGViYXJDbGljayk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1zZWFyY2gtaW5wdXQnKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGUgPT4gc2V0Q2xpcFNlYXJjaChlLnRhcmdldC52YWx1ZSkpO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtc2NvcmUtbWluJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZSA9PiBzZXRDbGlwU2NvcmVNaW4oZS50YXJnZXQudmFsdWUpKTtcblxuY29uc3QgX3NpbWlsYXJDbGlwc01vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpbWlsYXItY2xpcHMtbW9kYWwnKTtcbl9zaW1pbGFyQ2xpcHNNb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IF9zaW1pbGFyQ2xpcHNNb2RhbCkgY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCgpOyB9KTtcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaW1pbGFyLWNsaXBzLWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlU2ltaWxhckNsaXBzTW9kYWwoKSk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWZpbmQtc2ltaWxhci1nbycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gc3RhcnRGaW5kU2ltaWxhcigpKTtcblxuY29uc3QgX3Njb3JlT3ZlcnJpZGVNb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY29yZS1vdmVycmlkZS1tb2RhbCcpO1xuX3Njb3JlT3ZlcnJpZGVNb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IF9zY29yZU92ZXJyaWRlTW9kYWwpIGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCk7IH0pO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njb3JlLW92ZXJyaWRlLWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCkpO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njb3JlLW92ZXJyaWRlLXNhdmUtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfc2NvcmVPdmVycmlkZVNhdmUoKSk7XG5cbi8vIFB1YmxpYyBBUEkgLSBzeW1ib2xzIHdpdGggYSBjbGFzc2ljIChidW5kbGUuanMpIGNvbnN1bWVyLCBhIHN0aWxsLWNsYXNzaWNcbi8vIG1vZHVsZSByZWFkaW5nIHRoaXMgbW9kdWxlJ3MgZXhwb3J0cyBhcyB3aW5kb3cuKiAoc2hvcnRjdXRzLmpzLCBqb2JzLmpzLFxuLy8gdmlkZW9zLmpzKSwgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUuIHNldENsaXBTZWFyY2gsIHNldENsaXBTY29yZU1pbixcbi8vIF9jbGVhckNsaXBGaWx0ZXJzLCBzZXRDbGlwS2luZCwgX3N5bmNLaW5kQ2hpcHMsIHRvZ2dsZUNsaXBTb3J0RGlyLCBkZWxldGVDbGlwLFxuLy8gZGVsZXRlRXhwb3J0LCBtZXJnZUNsaXBzLCBzY2FuRHVwbGljYXRlcywgb3BlbkNsaXBzQWN0aW9uc01lbnUsXG4vLyBfc2NvcmVPdmVycmlkZVNhdmUsIGNsZWFyU2NvcmVPdmVycmlkZSwgb3BlbkRlc2NLZWJhYiwgb3BlbkRlc2NMb25nS2ViYWIsXG4vLyBzdGFydEZpbmRTaW1pbGFyIGFuZCBvcGVuU2ltaWxhckNsaXBzTW9kYWwgZHJvcHBlZDogdGhlaXIgb25seSBjYWxsZXJzIHdlcmVcbi8vIHRoaXMgbW9kdWxlJ3Mgb3duIGlubGluZSBoYW5kbGVycyAobm93IGRhdGEtYWN0IGRlbGVnYXRpb24gb3IgdGhlIHN0YXRpY1xuLy8gd2lyaW5nIGFib3ZlKSBvciBpdHMgb3duIGludGVybmFsIGxvZ2ljLCBzbyBub3RoaW5nIG91dHNpZGUgdGhlIG1vZHVsZSBuZWVkc1xuLy8gdGhlbSBvZmYgd2luZG93IGFueW1vcmUuXG5leHBvcnQge1xuICBzZWxlY3RDbGlwLCBzZXRTdGF0dXMsIHVuZG9MYXN0U3RhdHVzLCByZW5kZXJEZXRhaWwsIHJlbmRlclBsYXllciwgY2xlYXJEZXRhaWwsIHJlZnJlc2hDbGlwRGV0YWlsLFxuICBfcmVsZWFzZVBsYXllckJlZm9yZURlbGV0ZSxcbiAgYW5hbHl6ZUZyYW1lcyxcbiAgdG9nZ2xlQ2xpcEZpbHRlciwgX3N5bmNGaWx0ZXJDaGlwcyxcbiAgX2FwcGx5RmlsdGVycywgX3JlbmRlckNsaXBzLCBfcGFyc2VUaW1pbmdPZmZzZXQsIF9yZWxvYWRDbGlwTGlzdCxcbiAgX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMsXG4gIG9wZW5TY29yZU92ZXJyaWRlLCBjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCxcbiAgY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCxcbiAgb3BlbkNsaXBBY3Rpb25zTW9kYWwsXG59O1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gQnVsayBjbGlwIGFjdGlvbnMgKG11bHRpLXNlbGVjdCBpbiB0aGUgY2xpcCBsaXN0IOKGkiBzdGF0dXMgLyBkZWxldGUgLyBleHBvcnQpLlxuLy8gICBBUEk6IHJvdXRlcy9jbGlwcy9idWxrLnB5IChidWxrLXN0YXR1cywgYnVsay1zdGF0dXMtcmVzdG9yZSwgYnVsay1kZWxldGUsIGJ1bGstZXhwb3J0KSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9jbGlwcy5weVxuLy8gVGhlIHNlbGVjdGlvbiBzZXQgbGl2ZXMgaW4gQXBwU3RhdGUuc2VsZWN0ZWRDbGlwSWRzOyB0aGUgY2xpcCBsaXN0IChjbGlwcy5qcylcbi8vIHJlbmRlcnMgdGhlIGNoZWNrYm94ZXMgYW5kIGNhbGxzIF90b2dnbGVDbGlwU2VsZWN0aW9uIC8gX3VwZGF0ZUJ1bGtUb29sYmFyIGFzXG4vLyByb3dzIGFyZSBkcmF3biwgYW5kIF9wcnVuZUNsaXBTZWxlY3Rpb24gb24gZXZlcnkgcmUtcmVuZGVyLlxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IGZvcm1hdEFwaUVycm9yLCBwbHVyYWwgfSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5pbXBvcnQgeyBzaG93VG9hc3QsIG9wZW5Mb2cgfSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7IHNob3dDb25maXJtLCBzaG93VW5kb1RvYXN0IH0gZnJvbSAnLi91aS5qcyc7XG5pbXBvcnQgeyBzdHJlYW1TU0UgfSBmcm9tICcuL2pvYnMuanMnO1xuaW1wb3J0IHsgbG9hZFZpZGVvcyB9IGZyb20gJy4vdmlkZW9zLmpzJztcbmltcG9ydCB7XG4gIHNlbGVjdENsaXAsIHJlbmRlckRldGFpbCwgY2xlYXJEZXRhaWwsIF9yZWxlYXNlUGxheWVyQmVmb3JlRGVsZXRlLFxuICBfYXBwbHlGaWx0ZXJzLCBfcmVuZGVyQ2xpcHMsIF9yZWxvYWRDbGlwTGlzdCxcbn0gZnJvbSAnLi9jbGlwcy5qcyc7XG5cbi8vIOKUgOKUgCBtdWx0aS1zZWxlY3Qg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBEcm9wcyBzZWxlY3RlZCBJRHMgZm9yIGNsaXBzIHRoYXQgbm8gbG9uZ2VyIGV4aXN0IChlLmcuIGFmdGVyIGEgZGVsZXRlKS5cbi8vIERlbGliZXJhdGVseSBkb2VzIE5PVCBkcm9wIElEcyBqdXN0IGJlY2F1c2UgYSBmaWx0ZXIgaGlkZXMgdGhlbSAtIHN3aXRjaGluZ1xuLy8gZmlsdGVyIHRhYnMgc2hvdWxkbid0IHNpbGVudGx5IGxvc2UgdGhlIHVzZXIncyBzZWxlY3Rpb24uXG5leHBvcnQgZnVuY3Rpb24gX3BydW5lQ2xpcFNlbGVjdGlvbigpIHtcbiAgY29uc3QgZXhpc3RpbmdJZHMgPSBuZXcgU2V0KEFwcFN0YXRlLmNsaXBzLm1hcChjID0+IGMuaWQpKTtcbiAgZm9yIChjb25zdCBpZCBvZiBBcHBTdGF0ZS5zZWxlY3RlZENsaXBJZHMpIHtcbiAgICBpZiAoIWV4aXN0aW5nSWRzLmhhcyhpZCkpIEFwcFN0YXRlLnNlbGVjdGVkQ2xpcElkcy5kZWxldGUoaWQpO1xuICB9XG59XG5cbi8vIFRoZSBzZXQgb2YgY3VycmVudGx5LXNlbGVjdGVkIGNsaXBzIHRoYXQgYWxzbyBwYXNzIHRoZSBhY3RpdmUgZmlsdGVycyAtIHRoZVxuLy8gb25seSBjbGlwcyBhIGJ1bGsgYWN0aW9uIG1heSB0b3VjaCwgc28gYSBoaWRkZW4tYnV0LWNoZWNrZWQgY2xpcCBmcm9tIGJlZm9yZVxuLy8gYSBmaWx0ZXIgY2hhbmdlIGlzIG5ldmVyIHNpbGVudGx5IGluY2x1ZGVkLlxuZnVuY3Rpb24gX3Zpc2libGVTZWxlY3RlZENsaXBzKCkge1xuICByZXR1cm4gX2FwcGx5RmlsdGVycygpLmZpbHRlcihjID0+IEFwcFN0YXRlLnNlbGVjdGVkQ2xpcElkcy5oYXMoYy5pZCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gX3RvZ2dsZUNsaXBTZWxlY3Rpb24oaWQsIGNoZWNrZWQpIHtcbiAgaWYgKGNoZWNrZWQpIEFwcFN0YXRlLnNlbGVjdGVkQ2xpcElkcy5hZGQoaWQpO1xuICBlbHNlIEFwcFN0YXRlLnNlbGVjdGVkQ2xpcElkcy5kZWxldGUoaWQpO1xuICBfdXBkYXRlQnVsa1Rvb2xiYXIoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9jbGVhckNsaXBTZWxlY3Rpb24oKSB7XG4gIEFwcFN0YXRlLnNlbGVjdGVkQ2xpcElkcy5jbGVhcigpO1xuICBfcmVuZGVyQ2xpcHMoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF91cGRhdGVCdWxrVG9vbGJhcigpIHtcbiAgY29uc3QgdG9vbGJhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwLWJ1bGstdG9vbGJhcicpO1xuICBjb25zdCBjb3VudCA9IF92aXNpYmxlU2VsZWN0ZWRDbGlwcygpLmxlbmd0aDtcbiAgdG9vbGJhci5zdHlsZS5kaXNwbGF5ID0gY291bnQgPyAnZmxleCcgOiAnbm9uZSc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwLWJ1bGstY291bnQnKS50ZXh0Q29udGVudCA9IGAke2NvdW50fSBzZWxlY3RlZGA7XG59XG5cbi8vIOKUgOKUgCBidWxrIGNsaXAgYWN0aW9ucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBidWxrU2V0Q2xpcFN0YXR1cyhzdGF0dXMpIHtcbiAgY29uc3QgaWRzID0gX3Zpc2libGVTZWxlY3RlZENsaXBzKCkubWFwKGMgPT4gYy5pZCk7XG4gIGlmICghaWRzLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2FwaS9jbGlwcy9idWxrLXN0YXR1cycsIHtcbiAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtjbGlwX2lkczogaWRzLCBzdGF0dXN9KSxcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB7XG4gICAgY29uc3QgZXJyID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICBzaG93VG9hc3QoYEJ1bGsgdXBkYXRlIGZhaWxlZDogJHtmb3JtYXRBcGlFcnJvcihlcnIpfWAsICdlcnJvcicpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBsYWJlbCA9IHthcHByb3ZlZDogJ0FwcHJvdmVkJywgcmVqZWN0ZWQ6ICdSZWplY3RlZCcsIHBlbmRpbmc6ICdNYXJrZWQgYXMgVW5yZXZpZXdlZCd9W3N0YXR1c10gfHwgc3RhdHVzO1xuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgQXBwU3RhdGUuc2VsZWN0ZWRDbGlwSWRzLmNsZWFyKCk7XG4gIGF3YWl0IF9yZWxvYWRDbGlwTGlzdChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKTtcbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCAmJiBpZHMuaW5jbHVkZXMoQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSkge1xuICAgIGNvbnN0IGNsaXAgPSBhd2FpdCBmZXRjaChgL2FwaS9jbGlwcy8ke0FwcFN0YXRlLmFjdGl2ZUNsaXBJZH1gKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICAgIEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhID0gY2xpcDtcbiAgICByZW5kZXJEZXRhaWwoY2xpcCk7XG4gIH1cbiAgbG9hZFZpZGVvcygpO1xuXG4gIGlmIChBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZT8udGltZXIpIGNsZWFyVGltZW91dChBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZS50aW1lcik7XG4gIGlmIChBcHBTdGF0ZS5sYXN0U3RhdHVzQ2hhbmdlPy50aW1lcikgY2xlYXJUaW1lb3V0KEFwcFN0YXRlLmxhc3RTdGF0dXNDaGFuZ2UudGltZXIpO1xuICBBcHBTdGF0ZS5sYXN0U3RhdHVzQ2hhbmdlID0gbnVsbDtcbiAgQXBwU3RhdGUubGFzdEJ1bGtTdGF0dXNDaGFuZ2UgPSB7cHJldmlvdXM6IGRhdGEucHJldmlvdXN9O1xuICBBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZS50aW1lciA9IHNldFRpbWVvdXQoKCkgPT4geyBBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZSA9IG51bGw7IH0sIDUwMDApO1xuICBzaG93VW5kb1RvYXN0KGAke2xhYmVsfTogJHtwbHVyYWwoaWRzLmxlbmd0aCwgJ2NsaXAnKX1gLCB1bmRvTGFzdEJ1bGtTdGF0dXMpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdW5kb0xhc3RCdWxrU3RhdHVzKCkge1xuICBpZiAoIUFwcFN0YXRlLmxhc3RCdWxrU3RhdHVzQ2hhbmdlKSByZXR1cm47XG4gIGNvbnN0IHtwcmV2aW91c30gPSBBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZTtcbiAgY2xlYXJUaW1lb3V0KEFwcFN0YXRlLmxhc3RCdWxrU3RhdHVzQ2hhbmdlLnRpbWVyKTtcbiAgQXBwU3RhdGUubGFzdEJ1bGtTdGF0dXNDaGFuZ2UgPSBudWxsO1xuICBjb25zdCB1cGRhdGVzID0gT2JqZWN0LmVudHJpZXMocHJldmlvdXMpLm1hcCgoW2lkLCBzdGF0dXNdKSA9PiAoe2lkOiBOdW1iZXIoaWQpLCBzdGF0dXN9KSk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL2NsaXBzL2J1bGstc3RhdHVzLXJlc3RvcmUnLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7dXBkYXRlc30pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChgVW5kbyBmYWlsZWQ6ICR7Zm9ybWF0QXBpRXJyb3IoZXJyKX1gLCAnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cbiAgYXdhaXQgX3JlbG9hZENsaXBMaXN0KEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpO1xuICBpZiAoQXBwU3RhdGUuYWN0aXZlQ2xpcElkICYmIHVwZGF0ZXMuc29tZSh1ID0+IHUuaWQgPT09IEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCkpIHtcbiAgICBjb25zdCBjbGlwID0gYXdhaXQgZmV0Y2goYC9hcGkvY2xpcHMvJHtBcHBTdGF0ZS5hY3RpdmVDbGlwSWR9YCkudGhlbihyID0+IHIuanNvbigpKTtcbiAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YSA9IGNsaXA7XG4gICAgcmVuZGVyRGV0YWlsKGNsaXApO1xuICB9XG4gIGxvYWRWaWRlb3MoKTtcbiAgc2hvd1RvYXN0KGBVbmRvbmU6ICR7cGx1cmFsKHVwZGF0ZXMubGVuZ3RoLCAnY2xpcCcpfSByZXN0b3JlZGApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVsa0RlbGV0ZUNsaXBzKCkge1xuICBjb25zdCBpZHMgPSBfdmlzaWJsZVNlbGVjdGVkQ2xpcHMoKS5tYXAoYyA9PiBjLmlkKTtcbiAgaWYgKCFpZHMubGVuZ3RoKSByZXR1cm47XG4gIHNob3dDb25maXJtKFxuICAgICdEZWxldGUgc2VsZWN0ZWQgY2xpcHM/JyxcbiAgICBgJHtwbHVyYWwoaWRzLmxlbmd0aCwgJ2NsaXAgcmVjb3JkJyl9IHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBkYXRhYmFzZS4gYCArXG4gICAgYEFueSBleHBvcnRlZCB2aWRlbyBmaWxlcyB3aWxsIGFsc28gYmUgZGVsZXRlZCBmcm9tIHRoZSBleHBvcnRzIGZvbGRlci5gLFxuICAgICdEZWxldGUnLFxuICAgICgpID0+IF9kb0J1bGtEZWxldGVDbGlwcyhpZHMpLFxuICAgIHRydWUsXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9kb0J1bGtEZWxldGVDbGlwcyhpZHMpIHtcbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCAmJiBpZHMuaW5jbHVkZXMoQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSkge1xuICAgIGF3YWl0IF9yZWxlYXNlUGxheWVyQmVmb3JlRGVsZXRlKCk7XG4gIH1cbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvY2xpcHMvYnVsay1kZWxldGUnLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7Y2xpcF9pZHM6IGlkc30pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChgQnVsayBkZWxldGUgZmFpbGVkOiAke2Zvcm1hdEFwaUVycm9yKGVycil9YCwgJ2Vycm9yJyk7XG4gICAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCAmJiBpZHMuaW5jbHVkZXMoQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSkgc2VsZWN0Q2xpcChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgQXBwU3RhdGUuc2VsZWN0ZWRDbGlwSWRzLmNsZWFyKCk7XG4gIGlmIChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgJiYgaWRzLmluY2x1ZGVzKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCkpIHtcbiAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBudWxsO1xuICAgIGNsZWFyRGV0YWlsKCk7XG4gIH1cbiAgYXdhaXQgX3JlbG9hZENsaXBMaXN0KEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpO1xuICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gIGNvbnN0IG4gPSBkYXRhLmRlbGV0ZWQubGVuZ3RoO1xuICBpZiAoZGF0YS5sb2NrZWQubGVuZ3RoKSB7XG4gICAgc2hvd1RvYXN0KGBEZWxldGVkICR7cGx1cmFsKG4sICdjbGlwJyl9IC0gJHtkYXRhLmxvY2tlZC5sZW5ndGh9IGNvdWxkIG5vdCBiZSBkZWxldGVkIChmaWxlIGluIHVzZSlgLCAnZXJyb3InKTtcbiAgfSBlbHNlIHtcbiAgICBzaG93VG9hc3QoYERlbGV0ZWQgJHtwbHVyYWwobiwgJ2NsaXAnKX1gKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYnVsa0V4cG9ydENsaXBzKCkge1xuICBjb25zdCBjbGlwcyA9IF92aXNpYmxlU2VsZWN0ZWRDbGlwcygpO1xuICBpZiAoIWNsaXBzLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCBzdGFsZUNvdW50ID0gY2xpcHMuZmlsdGVyKGMgPT4gYy50cmFuc2NyaXB0X3N0YWxlKS5sZW5ndGg7XG4gIGlmIChzdGFsZUNvdW50KSB7XG4gICAgc2hvd0NvbmZpcm0oXG4gICAgICAnRXhwb3J0IGNsaXBzIHdpdGggb3V0ZGF0ZWQgY2FwdGlvbnM/JyxcbiAgICAgIGAke3N0YWxlQ291bnR9IG9mIHRoZSAke2NsaXBzLmxlbmd0aH0gc2VsZWN0ZWQgY2xpcHMgaGF2ZSBjYXB0aW9ucyBlZGl0ZWQgc2luY2UgdGhleSB3ZXJlIGAgK1xuICAgICAgYGxhc3Qgc2NvcmVkLCBzbyB0aGVpciBkZXNjcmlwdGlvbi9zY29yZSB3b24ndCByZWZsZWN0IHRoZSBsYXRlc3QgdHJhbnNjcmlwdC4gYCArXG4gICAgICBgUmUtc2NvcmUgdGhlbSBmaXJzdCwgb3IgZXhwb3J0IGFueXdheT9gLFxuICAgICAgJ0V4cG9ydCBBbnl3YXknLFxuICAgICAgKCkgPT4gX2RvQnVsa0V4cG9ydENsaXBzKGNsaXBzLm1hcChjID0+IGMuaWQpKSxcbiAgICAgIHRydWUsXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgX2RvQnVsa0V4cG9ydENsaXBzKGNsaXBzLm1hcChjID0+IGMuaWQpKTtcbn1cblxuZnVuY3Rpb24gX2RvQnVsa0V4cG9ydENsaXBzKGlkcykge1xuICBjb25zdCBxcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe2NsaXBfaWRzOiBpZHMuam9pbignLCcpfSk7XG4gIEFwcFN0YXRlLnNlbGVjdGVkQ2xpcElkcy5jbGVhcigpO1xuICBvcGVuTG9nKCk7XG4gIHN0cmVhbVNTRShcbiAgICBgL2FwaS9jbGlwcy9idWxrLWV4cG9ydD8ke3FzfWAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgX3JlbG9hZENsaXBMaXN0KEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpO1xuICAgICAgbG9hZFZpZGVvcygpO1xuICAgICAgc2hvd1RvYXN0KGBFeHBvcnRlZCAke3BsdXJhbChpZHMubGVuZ3RoLCAnY2xpcCcpfWApO1xuICAgICAgd2luZG93LlNvdW5kRngucGxheSgnZXhwb3J0Jyk7XG4gICAgfSxcbiAgICBbe2xhYmVsOiAnRXhwb3J0JywgcGF0dGVybnM6IFsnRXhwb3J0aW5nJywgJ09LJywgJ1NraXBwaW5nJ119XSxcbiAgICAnQnVsayBFeHBvcnRpbmcnLFxuICApO1xufVxuXG4vLyDilIDilIAgc3RhdGljIGluZGV4Lmh0bWwgaGFuZGxlcnMgdGhpcyBtb2R1bGUgb3ducyAod2lyZWQgb25jZSBhdCBsb2FkKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZSBidWxrIHRvb2xiYXIgaXMgYSBmaXhlZCwgbmV2ZXItcmVjcmVhdGVkIGVsZW1lbnQgaW4gaW5kZXguaHRtbCAob25seSBpdHNcbi8vIGRpc3BsYXkgc3R5bGUgYW5kIGNvdW50IHRleHQgYXJlIHVwZGF0ZWQgYnkgX3VwZGF0ZUJ1bGtUb29sYmFyKSwgc28gYSBzaW5nbGVcbi8vIGxvYWQtdGltZSBkZWxlZ2F0ZWQgbGlzdGVuZXIgY2FuJ3QgZG91YmxlLWZpcmUgb24gYSByZS1yZW5kZXIuXG5mdW5jdGlvbiBfaGFuZGxlQnVsa1Rvb2xiYXJDbGljayhlKSB7XG4gIGNvbnN0IGVsID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0XScpO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIHN3aXRjaCAoZWwuZGF0YXNldC5hY3QpIHtcbiAgICBjYXNlICdidWxrLWFwcHJvdmUnOiBidWxrU2V0Q2xpcFN0YXR1cygnYXBwcm92ZWQnKTsgYnJlYWs7XG4gICAgY2FzZSAnYnVsay1yZWplY3QnOiBidWxrU2V0Q2xpcFN0YXR1cygncmVqZWN0ZWQnKTsgYnJlYWs7XG4gICAgY2FzZSAnYnVsay1leHBvcnQnOiBidWxrRXhwb3J0Q2xpcHMoKTsgYnJlYWs7XG4gICAgY2FzZSAnYnVsay1kZWxldGUnOiBidWxrRGVsZXRlQ2xpcHMoKTsgYnJlYWs7XG4gICAgY2FzZSAnYnVsay1jbGVhci1zZWxlY3Rpb24nOiBfY2xlYXJDbGlwU2VsZWN0aW9uKCk7IGJyZWFrO1xuICB9XG59XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1idWxrLXRvb2xiYXInKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIF9oYW5kbGVCdWxrVG9vbGJhckNsaWNrKTtcbiIsICIvLyBFU00gZW50cnkgcG9pbnQgLSB0aGUgc3RyYW5nbGVyLWZpZyBzZWFtIChXUzUgc3RlcCAyKS4gZXNidWlsZCBidW5kbGVzIHRoaXNcbi8vIG1vZHVsZSBncmFwaCBpbnRvIHN0YXRpYy9idW5kbGUuZXNtLmpzIChzZWUgc2NyaXB0cy9idWlsZC1lc20ubWpzLCBydW4gYnlcbi8vIGB5dXUtZGV2IGJ1bmRsZWApLiBFdmVyeXRoaW5nIHJlYWNoYWJsZSBmcm9tIGhlcmUgaXMgcmVhbCBFU00gKGltcG9ydC9leHBvcnQpO1xuLy8gdGhlIGNsYXNzaWMgZ2xvYmFsLXNjb3BlIHNjcmlwdHMgc3RpbGwgaW4gYnVuZGxlLmpzIGNhbGwgdGhlc2UgbW9kdWxlcyBhc1xuLy8gd2luZG93IGdsb2JhbHMsIHNvIHRoaXMgZW50cnkgcmUtZXhwb3NlcyBlYWNoIG1pZ3JhdGVkIG1vZHVsZSdzIHB1YmxpYyBzdXJmYWNlXG4vLyBvbiB3aW5kb3cgYXMgYSBjb21wYXRpYmlsaXR5IHNoaW0uXG4vL1xuLy8gTWlncmF0aW5nIGEgY2xhc3NpYyBjb25zdW1lciB0byBgaW1wb3J0YCBzaHJpbmtzIHRoZSBzaGltOiBvbmNlIG5vdGhpbmcgcmVhZHMgYVxuLy8gbmFtZSBvZmYgd2luZG93LCBkZWxldGUgaXRzIGxpbmUgYmVsb3cuIFdoZW4gYnVuZGxlLmpzIGlzIGVtcHR5LCB0aGlzIGZpbGUgaXNcbi8vIHRoZSB3aG9sZSBhcHAgYW5kIHRoZSBzaGltIGlzIGdvbmUuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0ICogYXMgZm9ybWF0IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IENvbG9yUGlja2VyIH0gZnJvbSAnLi9jb2xvcnBpY2tlci5qcyc7XG5pbXBvcnQgeyBQYW5lbE5hdiB9IGZyb20gJy4vcGFuZWxuYXYuanMnO1xuaW1wb3J0ICogYXMgam9icyBmcm9tICcuL2pvYnMuanMnO1xuaW1wb3J0IHsgX2J1aWxkTWVkaWFVcmwsIHNldHVwUmVjb3JkaW5nUHJldmlldyB9IGZyb20gJy4vcHJldmlldy5qcyc7XG5pbXBvcnQge1xuICBfc3luY1NvcnREaXJCdG4sIF9kaWFyaXphdGlvblJlYXNvbiwgX2RpYXJpemF0aW9uUmVhZGluZXNzLCBfZGlhcml6YXRpb25Ob3RlSHRtbCxcbiAgb3BlbkxvZywgY2xlYXJMb2csIGFwcGVuZExvZywgc2hvd1RvYXN0LCBuZXRFcnJNc2csIHJldmVhbEluRm9sZGVyLCBjb3B5VGV4dCxcbiAgY29sbGFwc2libGVDYXJkLFxufSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7XG4gIHNob3dBbGVydCwgY2xvc2VBbGVydE1vZGFsLCBzaG93Q29uZmlybSwgX2NvbmZpcm1DYW5jZWwsXG4gIG9wZW5BY3Rpb25zTW9kYWwsIGNsb3NlQWN0aW9uc01vZGFsLCB0b3Btb3N0VmlzaWJsZU1vZGFsLCBfbWVudUFycm93S2V5ZG93bixcbiAgaXNIYW1idXJnZXJPcGVuLCB0b2dnbGVIYW1idXJnZXIsIGNsb3NlSGFtYnVyZ2VyLFxuICBvcGVuQ29udHJvbHNNb2RhbCwgY2xvc2VDb250cm9sc01vZGFsLFxuICBvcGVuRGlmZk1vZGFsLCBfZGlmZkRpc2NhcmQsXG4gIG9wZW5GaWVsZEVkaXRNb2RhbCwgY2xvc2VGaWVsZEVkaXRNb2RhbCxcbiAgY2xvc2VLZWJhYiwgc2hvd0tlYmFiLCBpbml0UmVzaXplLCBfYXBwbHlQcmVyZXFXYXJuaW5ncywgc2hvd1VuZG9Ub2FzdCxcbiAgcGxheWJhY2tSYXRlUHJlZiwgYXBwbHlQbGF5YmFja1JhdGUsIGluaXRQbGF5YmFja1JhdGUsXG59IGZyb20gJy4vdWkuanMnO1xuaW1wb3J0IHtcbiAgb3BlbkdldHRpbmdTdGFydGVkTW9kYWwsIGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCxcbiAgb3BlbkFib3V0TW9kYWwsIGNsb3NlQWJvdXRNb2RhbCxcbiAgb3BlbkhlbHBNb2RhbCwgY2xvc2VIZWxwTW9kYWwsXG4gIG9wZW5HbG9zc2FyeU1vZGFsLCBjbG9zZUdsb3NzYXJ5TW9kYWwsIF9maWx0ZXJHbG9zc2FyeSxcbn0gZnJvbSAnLi9oZWxwbW9kYWxzLmpzJztcbi8vIHNob3J0Y3V0cy5qcyBoYXMgbm8gcHVibGljIHN1cmZhY2UgKGl0cyBvbmx5IGV4cG9ydCBpcyB0aGUga2V5ZG93biBsaXN0ZW5lclxuLy8gcmVnaXN0cmF0aW9uKSAtIGEgYmFyZSBzaWRlLWVmZmVjdCBpbXBvcnQgcmVnaXN0ZXJzIHRoZSBnbG9iYWwgaGFuZGxlclxuLy8gd2l0aG91dCBhZGRpbmcgYW55dGhpbmcgdG8gdGhlIHdpbmRvdyBzaGltLlxuaW1wb3J0ICcuL3Nob3J0Y3V0cy5qcyc7XG5pbXBvcnQge1xuICBfZW5zdXJlTW9kZWxDYXRhbG9nLCByZWZyZXNoTW9kZWxDYXRhbG9nLFxuICBfdXBkYXRlTGxtQ2FwYWJpbGl0aWVzLCBfcmVuZGVyQ2FwYWJpbGl0eVRpZXJzLFxuICBnYXRlT25DYXBhYmlsaXR5LFxufSBmcm9tICcuL21vZGVsY2F0YWxvZy5qcyc7XG5pbXBvcnQge1xuICBsb2FkVmlkZW9zLCBzZWxlY3RWaWRlbywgcmVuZGVyVmlkZW9EZXRhaWwsIGRlbGV0ZVZpZGVvLFxuICBvbkNsaXBzU29ydENoYW5nZSwgX2NsaXBzU29ydFBhcmFtLCBfY2xpcHNMaXN0VXJsLFxuICBfcmVhbmFseXplUGFyYW1zLFxuICBfbmVlZHNNb2RlbEN0YUhUTUwsXG4gIF91cGRhdGVEZW1vQnV0dG9uLCBfdXBkYXRlU3RhcnRJbmdlc3RCdXR0b24sXG4gIF9hbmFseXNpc0xpdmVQYW5lbEhUTUwsIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwsXG4gIF9hcHBseVZpZGVvRmlsdGVycywgX3JlbmRlclZpZGVvTGlzdCxcbiAgc2V0VmlkZW9TZWFyY2gsIHNldFZpZGVvU29ydCwgdG9nZ2xlVmlkZW9Tb3J0RGlyLCB0b2dnbGVWaWRlb0ZpbHRlcixcbiAgb3BlblZpZGVvQWN0aW9uc01vZGFsLFxufSBmcm9tICcuL3ZpZGVvcy5qcyc7XG5pbXBvcnQge1xuICBnZW5lcmF0ZVRpbWVsaW5lLCBjbG9zZVRpbWVsaW5lSW50ZXJ2YWxNb2RhbCwgX3JlbmRlclRpbWVsaW5lSFRNTCwgX3RpbWVsaW5lRW1wdHlOb3RlSFRNTCxcbn0gZnJvbSAnLi92aWRlb3MtdGltZWxpbmUuanMnO1xuaW1wb3J0IHsgc3VtbWFyaXplVmlkZW8sIHJlZ2VuU3VtbWFyeUF1dG8gfSBmcm9tICcuL3ZpZGVvcy1zdW1tYXJ5LmpzJztcbmltcG9ydCB7IF9yZW5kZXJSdW5NZXRhQ2FyZCwgX3J1blRpbWluZ0xpbmUgfSBmcm9tICcuL3ZpZGVvcy1ydW5tZXRhLmpzJztcbmltcG9ydCB7XG4gIFNlc3Npb25VSSwgaXNTZXNzaW9uQ29sbGFwc2VkLCBzZXNzaW9uR3JvdXBIZWFkZXJMaSwgdG9nZ2xlR3JvdXBTZWxlY3QsXG59IGZyb20gJy4vc2Vzc2lvbnMuanMnO1xuaW1wb3J0IHtcbiAgc2VsZWN0Q2xpcCwgc2V0U3RhdHVzLCB1bmRvTGFzdFN0YXR1cywgcmVuZGVyRGV0YWlsLCByZW5kZXJQbGF5ZXIsIGNsZWFyRGV0YWlsLCByZWZyZXNoQ2xpcERldGFpbCxcbiAgX3JlbGVhc2VQbGF5ZXJCZWZvcmVEZWxldGUsXG4gIGFuYWx5emVGcmFtZXMsXG4gIHRvZ2dsZUNsaXBGaWx0ZXIsIF9zeW5jRmlsdGVyQ2hpcHMsXG4gIF9hcHBseUZpbHRlcnMsIF9yZW5kZXJDbGlwcywgX3BhcnNlVGltaW5nT2Zmc2V0LCBfcmVsb2FkQ2xpcExpc3QsXG4gIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzLFxuICBvcGVuU2NvcmVPdmVycmlkZSwgY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwsXG4gIGNsb3NlU2ltaWxhckNsaXBzTW9kYWwsXG4gIG9wZW5DbGlwQWN0aW9uc01vZGFsLFxufSBmcm9tICcuL2NsaXBzLmpzJztcbmltcG9ydCB7XG4gIF9wcnVuZUNsaXBTZWxlY3Rpb24sIF91cGRhdGVCdWxrVG9vbGJhciwgX3RvZ2dsZUNsaXBTZWxlY3Rpb24sIHVuZG9MYXN0QnVsa1N0YXR1cyxcbn0gZnJvbSAnLi9jbGlwYnVsay5qcyc7XG5cbndpbmRvdy5BcHBTdGF0ZSA9IEFwcFN0YXRlO1xuT2JqZWN0LmFzc2lnbih3aW5kb3csIGZvcm1hdCk7XG53aW5kb3cuQ29sb3JQaWNrZXIgPSBDb2xvclBpY2tlcjtcbndpbmRvdy5QYW5lbE5hdiA9IFBhbmVsTmF2O1xuLy8gdXRpbHMuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyLCBvciAoY2xlYXJMb2csIF9kaWFyaXphdGlvblJlYXNvbiwgX2RpYXJpemF0aW9uTm90ZUh0bWwpIGFcbi8vIHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHkgcGFnZS5ldmFsdWF0ZS4gdG9nZ2xlTG9nIGFuZCBpc0NhcmRDb2xsYXBzZWQgZHJvcHBlZDpcbi8vIHRoZWlyIG9ubHkgY29uc3VtZXJzIHdlcmUgdXRpbHMuanMncyBvd24gaW5saW5lIGhhbmRsZXIgKG5vdyBhZGRFdmVudExpc3RlbmVyKVxuLy8gYW5kIGl0cyBvd24gY29sbGFwc2libGVDYXJkLCByZXNwZWN0aXZlbHkuXG53aW5kb3cuX3N5bmNTb3J0RGlyQnRuID0gX3N5bmNTb3J0RGlyQnRuO1xud2luZG93Ll9kaWFyaXphdGlvblJlYXNvbiA9IF9kaWFyaXphdGlvblJlYXNvbjtcbndpbmRvdy5fZGlhcml6YXRpb25SZWFkaW5lc3MgPSBfZGlhcml6YXRpb25SZWFkaW5lc3M7XG53aW5kb3cuX2RpYXJpemF0aW9uTm90ZUh0bWwgPSBfZGlhcml6YXRpb25Ob3RlSHRtbDtcbndpbmRvdy5vcGVuTG9nID0gb3BlbkxvZztcbndpbmRvdy5jbGVhckxvZyA9IGNsZWFyTG9nO1xud2luZG93LmFwcGVuZExvZyA9IGFwcGVuZExvZztcbndpbmRvdy5zaG93VG9hc3QgPSBzaG93VG9hc3Q7XG53aW5kb3cubmV0RXJyTXNnID0gbmV0RXJyTXNnO1xud2luZG93LnJldmVhbEluRm9sZGVyID0gcmV2ZWFsSW5Gb2xkZXI7XG53aW5kb3cuY29weVRleHQgPSBjb3B5VGV4dDtcbndpbmRvdy5jb2xsYXBzaWJsZUNhcmQgPSBjb2xsYXBzaWJsZUNhcmQ7XG4vLyBqb2JzLmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBldmVyeSBleHBvcnQgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyIG9yIGEgc3RpbGwtcHJlc2VudCBpbmxpbmUgaGFuZGxlciwgc28gbm9uZSBvZiB0aGVzZSBjYW5cbi8vIGJlIGRyb3BwZWQgeWV0LiBJdHMgaGFuZGZ1bCBvZiBtdXRhYmxlIHNoYXJlZC1zdGF0ZSBnbG9iYWxzIChfam9iU3RlcERlZnMsXG4vLyBfYWN0aXZlRVMsIGV0Yy4pIGFyZSBOT1QgaGVyZSAtIGpvYnMuanMgd2lyZXMgdGhvc2Ugb250byB3aW5kb3cgaXRzZWxmIHZpYVxuLy8gbGl2ZSBnZXQvc2V0IGFjY2Vzc29ycywgc2luY2UgYSBwbGFpbiBzbmFwc2hvdCB3b3VsZCBnbyBzdGFsZSBvbiByZWFzc2lnbm1lbnQuXG5PYmplY3QuYXNzaWduKHdpbmRvdywgam9icyk7XG4vLyBwcmV2aWV3LmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBzZXR1cFJlY29yZGluZ1ByZXZpZXcgaGFzIGNsYXNzaWMgY29uc3VtZXJzXG4vLyAoY2xpcGNyZWF0ZS5qcywgdmlkZW9zLmpzLCBzcGxpdC5qcywgZXhwb3J0ZWRpdG9yLmpzKTsgX2J1aWxkTWVkaWFVcmwgaGFzIG5vXG4vLyBKUyBjb25zdW1lciBsZWZ0IGJ1dCB0ZXN0cy91aS90ZXN0X3VpX3ZpZGVvLnB5IGV2YWx1YXRlcyBpdCBhcyBhIHBhZ2UgZ2xvYmFsLlxud2luZG93Ll9idWlsZE1lZGlhVXJsID0gX2J1aWxkTWVkaWFVcmw7XG53aW5kb3cuc2V0dXBSZWNvcmRpbmdQcmV2aWV3ID0gc2V0dXBSZWNvcmRpbmdQcmV2aWV3O1xuLy8gdWkuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyLCBhbiBhbHJlYWR5LUVTTSBjYWxsZXIgKGpvYnMuanMvcGFuZWxuYXYuanMnc1xuLy8gd2luZG93LnNob3dDb25maXJtKSwgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUuIF9jb25maXJtT2ssXG4vLyBfZGlmZkFjY2VwdE5ldywgX2RpZmZBY2NlcHRFZGl0IGFuZCBfZmllbGRFZGl0U2F2ZSBkcm9wcGVkOiB0aGVpciBvbmx5XG4vLyBjb25zdW1lcnMgd2VyZSB1aS5qcydzIG93biBpbmxpbmUgaGFuZGxlcnMsIG5vdyBhZGRFdmVudExpc3RlbmVyIGluc2lkZVxuLy8gdWkuanMgaXRzZWxmLCBzbyBub3RoaW5nIG91dHNpZGUgdGhlIG1vZHVsZSBuZWVkcyB0aGVtIG9mZiB3aW5kb3cgYW55bW9yZS5cbndpbmRvdy5zaG93QWxlcnQgPSBzaG93QWxlcnQ7XG53aW5kb3cuY2xvc2VBbGVydE1vZGFsID0gY2xvc2VBbGVydE1vZGFsO1xud2luZG93LnNob3dDb25maXJtID0gc2hvd0NvbmZpcm07XG53aW5kb3cuX2NvbmZpcm1DYW5jZWwgPSBfY29uZmlybUNhbmNlbDtcbndpbmRvdy5vcGVuQWN0aW9uc01vZGFsID0gb3BlbkFjdGlvbnNNb2RhbDtcbndpbmRvdy5jbG9zZUFjdGlvbnNNb2RhbCA9IGNsb3NlQWN0aW9uc01vZGFsO1xud2luZG93LnRvcG1vc3RWaXNpYmxlTW9kYWwgPSB0b3Btb3N0VmlzaWJsZU1vZGFsO1xud2luZG93Ll9tZW51QXJyb3dLZXlkb3duID0gX21lbnVBcnJvd0tleWRvd247XG53aW5kb3cuaXNIYW1idXJnZXJPcGVuID0gaXNIYW1idXJnZXJPcGVuO1xud2luZG93LnRvZ2dsZUhhbWJ1cmdlciA9IHRvZ2dsZUhhbWJ1cmdlcjtcbndpbmRvdy5jbG9zZUhhbWJ1cmdlciA9IGNsb3NlSGFtYnVyZ2VyO1xud2luZG93Lm9wZW5Db250cm9sc01vZGFsID0gb3BlbkNvbnRyb2xzTW9kYWw7XG53aW5kb3cuY2xvc2VDb250cm9sc01vZGFsID0gY2xvc2VDb250cm9sc01vZGFsO1xud2luZG93Lm9wZW5EaWZmTW9kYWwgPSBvcGVuRGlmZk1vZGFsO1xud2luZG93Ll9kaWZmRGlzY2FyZCA9IF9kaWZmRGlzY2FyZDtcbndpbmRvdy5vcGVuRmllbGRFZGl0TW9kYWwgPSBvcGVuRmllbGRFZGl0TW9kYWw7XG53aW5kb3cuY2xvc2VGaWVsZEVkaXRNb2RhbCA9IGNsb3NlRmllbGRFZGl0TW9kYWw7XG53aW5kb3cuY2xvc2VLZWJhYiA9IGNsb3NlS2ViYWI7XG53aW5kb3cuc2hvd0tlYmFiID0gc2hvd0tlYmFiO1xud2luZG93LmluaXRSZXNpemUgPSBpbml0UmVzaXplO1xud2luZG93Ll9hcHBseVByZXJlcVdhcm5pbmdzID0gX2FwcGx5UHJlcmVxV2FybmluZ3M7XG53aW5kb3cuc2hvd1VuZG9Ub2FzdCA9IHNob3dVbmRvVG9hc3Q7XG53aW5kb3cucGxheWJhY2tSYXRlUHJlZiA9IHBsYXliYWNrUmF0ZVByZWY7XG53aW5kb3cuYXBwbHlQbGF5YmFja1JhdGUgPSBhcHBseVBsYXliYWNrUmF0ZTtcbndpbmRvdy5pbml0UGxheWJhY2tSYXRlID0gaW5pdFBsYXliYWNrUmF0ZTtcbi8vIGhlbHBtb2RhbHMuanMgLSBldmVyeSBuYW1lIGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljIChidW5kbGUuanMpXG4vLyBjb25zdW1lciAoYm9vdC5qcywgdmlkZW9zLmpzLCBzaG9ydGN1dHMuanMsIHNldHRpbmdzLmpzIGNhbGwgdGhlc2UgYXMgYmFyZVxuLy8gZ2xvYmFscykgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUsIHNvIG5vbmUgY2FuIGJlIGRyb3BwZWQgeWV0Llxud2luZG93Lm9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsID0gb3BlbkdldHRpbmdTdGFydGVkTW9kYWw7XG53aW5kb3cuY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsID0gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsO1xud2luZG93Lm9wZW5BYm91dE1vZGFsID0gb3BlbkFib3V0TW9kYWw7XG53aW5kb3cuY2xvc2VBYm91dE1vZGFsID0gY2xvc2VBYm91dE1vZGFsO1xud2luZG93Lm9wZW5IZWxwTW9kYWwgPSBvcGVuSGVscE1vZGFsO1xud2luZG93LmNsb3NlSGVscE1vZGFsID0gY2xvc2VIZWxwTW9kYWw7XG53aW5kb3cub3Blbkdsb3NzYXJ5TW9kYWwgPSBvcGVuR2xvc3NhcnlNb2RhbDtcbndpbmRvdy5jbG9zZUdsb3NzYXJ5TW9kYWwgPSBjbG9zZUdsb3NzYXJ5TW9kYWw7XG53aW5kb3cuX2ZpbHRlckdsb3NzYXJ5ID0gX2ZpbHRlckdsb3NzYXJ5O1xuLy8gbW9kZWxjYXRhbG9nLmpzIC0gZXZlcnkgbmFtZSBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpYyAoYnVuZGxlLmpzKVxuLy8gY29uc3VtZXI6IHNldHRpbmdzLmpzIGNhbGxzIF9lbnN1cmVNb2RlbENhdGFsb2cvcmVmcmVzaE1vZGVsQ2F0YWxvZy9cbi8vIF91cGRhdGVMbG1DYXBhYmlsaXRpZXMvX3JlbmRlckNhcGFiaWxpdHlUaWVycyBhcyBiYXJlIGdsb2JhbHMsIG1vZGVsZG93bmxvYWQuanNcbi8vIGNoZWNrcy9jYWxscyBfdXBkYXRlTGxtQ2FwYWJpbGl0aWVzL19yZW5kZXJDYXBhYmlsaXR5VGllcnMsIGFuZCBjbGlwcy5qcyBjYWxsc1xuLy8gZ2F0ZU9uQ2FwYWJpbGl0eSAoYWxzbyByZWFkIGRpcmVjdGx5IGJ5IHRlc3RzL3VpL3Rlc3RfdWlfbW9kZWxfY2F0YWxvZy5weSB2aWFcbi8vIHBhZ2UuZXZhbHVhdGUpLiBwcmVmZXRjaE1vZGVsIGFuZCBkb3dubG9hZEdndWZNb2RlbCBkcm9wcGVkOiBib3RoIGFyZSB3aXJlZFxuLy8gaW50ZXJuYWxseSB2aWEgYWRkRXZlbnRMaXN0ZW5lci9kYXRhLSogZGVsZWdhdGlvbiBhbmQgaGF2ZSBubyBvdXRzaWRlIGNhbGxlci5cbndpbmRvdy5fZW5zdXJlTW9kZWxDYXRhbG9nID0gX2Vuc3VyZU1vZGVsQ2F0YWxvZztcbndpbmRvdy5yZWZyZXNoTW9kZWxDYXRhbG9nID0gcmVmcmVzaE1vZGVsQ2F0YWxvZztcbndpbmRvdy5fdXBkYXRlTGxtQ2FwYWJpbGl0aWVzID0gX3VwZGF0ZUxsbUNhcGFiaWxpdGllcztcbndpbmRvdy5fcmVuZGVyQ2FwYWJpbGl0eVRpZXJzID0gX3JlbmRlckNhcGFiaWxpdHlUaWVycztcbndpbmRvdy5nYXRlT25DYXBhYmlsaXR5ID0gZ2F0ZU9uQ2FwYWJpbGl0eTtcbi8vIHZpZGVvcy5qcyBpcyBjcm9zcy1jdXR0aW5nIC0gZXZlcnkgbmFtZSBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpY1xuLy8gKGJ1bmRsZS5qcykgY29uc3VtZXIgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUuIF9jbGlwc1NvcnRQYXJhbSBpc1xuLy8gQ1JJVElDQUw6IGZvcm1hdC5qcyAoYWxyZWFkeSBFU00pIHJlYWRzIGl0IGFzIHdpbmRvdy5fY2xpcHNTb3J0UGFyYW0sIHNvIGl0XG4vLyBjYW4gbmV2ZXIgYmUgZHJvcHBlZCBldmVuIGlmIGV2ZXJ5IGNsYXNzaWMgY29uc3VtZXIgZ29lcyBhd2F5LiBFbGV2ZW4gbmFtZXNcbi8vIChyZWFuYWx5emVWaWRlbywgcmVkaWFyaXplVmlkZW8sIHJlZXh0cmFjdFZpZGVvUnVuLCByZXRyYW5zY3JpYmVWaWRlb1J1bixcbi8vIHJlZ2VuZXJhdGVDbGlwc1J1biwgdW5zcGxpdFZpZGVvLCBfZG9VbnNwbGl0VmlkZW8sIG9wZW5WaWRlb1N1bW1hcnlLZWJhYixcbi8vIG9wZW5WaWRlb1RpdGxlS2ViYWIsIF9zeW5jVmlkZW9GaWx0ZXJDaGlwcywgX2NsZWFyVmlkZW9GaWx0ZXJzKSBkcm9wcGVkOiB0aGVpclxuLy8gb25seSBjYWxsZXJzIHdlcmUgdmlkZW9zLmpzJ3Mgb3duIGlubGluZSBoYW5kbGVycyAobm93IGRhdGEtYWN0IGRlbGVnYXRpb24pIG9yXG4vLyBpdHMgb3duIGludGVybmFsIGxvZ2ljLCBzbyBub3RoaW5nIG91dHNpZGUgdGhlIG1vZHVsZSBuZWVkcyB0aGVtIG9mZiB3aW5kb3cuXG53aW5kb3cubG9hZFZpZGVvcyA9IGxvYWRWaWRlb3M7XG53aW5kb3cuc2VsZWN0VmlkZW8gPSBzZWxlY3RWaWRlbztcbndpbmRvdy5yZW5kZXJWaWRlb0RldGFpbCA9IHJlbmRlclZpZGVvRGV0YWlsO1xud2luZG93LmRlbGV0ZVZpZGVvID0gZGVsZXRlVmlkZW87XG53aW5kb3cub25DbGlwc1NvcnRDaGFuZ2UgPSBvbkNsaXBzU29ydENoYW5nZTtcbndpbmRvdy5fY2xpcHNTb3J0UGFyYW0gPSBfY2xpcHNTb3J0UGFyYW07XG53aW5kb3cuX2NsaXBzTGlzdFVybCA9IF9jbGlwc0xpc3RVcmw7XG53aW5kb3cuX3JlYW5hbHl6ZVBhcmFtcyA9IF9yZWFuYWx5emVQYXJhbXM7XG53aW5kb3cuX25lZWRzTW9kZWxDdGFIVE1MID0gX25lZWRzTW9kZWxDdGFIVE1MO1xud2luZG93Ll91cGRhdGVEZW1vQnV0dG9uID0gX3VwZGF0ZURlbW9CdXR0b247XG53aW5kb3cuX3VwZGF0ZVN0YXJ0SW5nZXN0QnV0dG9uID0gX3VwZGF0ZVN0YXJ0SW5nZXN0QnV0dG9uO1xud2luZG93Ll9hbmFseXNpc0xpdmVQYW5lbEhUTUwgPSBfYW5hbHlzaXNMaXZlUGFuZWxIVE1MO1xud2luZG93Ll9zeW5jQW5hbHlzaXNMaXZlUGFuZWwgPSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsO1xud2luZG93Ll9hcHBseVZpZGVvRmlsdGVycyA9IF9hcHBseVZpZGVvRmlsdGVycztcbndpbmRvdy5fcmVuZGVyVmlkZW9MaXN0ID0gX3JlbmRlclZpZGVvTGlzdDtcbndpbmRvdy5zZXRWaWRlb1NlYXJjaCA9IHNldFZpZGVvU2VhcmNoO1xud2luZG93LnNldFZpZGVvU29ydCA9IHNldFZpZGVvU29ydDtcbndpbmRvdy50b2dnbGVWaWRlb1NvcnREaXIgPSB0b2dnbGVWaWRlb1NvcnREaXI7XG53aW5kb3cudG9nZ2xlVmlkZW9GaWx0ZXIgPSB0b2dnbGVWaWRlb0ZpbHRlcjtcbndpbmRvdy5vcGVuVmlkZW9BY3Rpb25zTW9kYWwgPSBvcGVuVmlkZW9BY3Rpb25zTW9kYWw7XG4vLyB2aWRlb3MtdGltZWxpbmUuanMgLSBnZW5lcmF0ZVRpbWVsaW5lLCBfcmVuZGVyVGltZWxpbmVIVE1MIGFuZFxuLy8gX3RpbWVsaW5lRW1wdHlOb3RlSFRNTCBhcmUgcmVhZCBhcyB3aW5kb3cuKiBieSB2aWRlb3MuanMgKGFscmVhZHktRVNNLCBidXRcbi8vIHZpZGVvcy5qcydzIG93biBtaWdyYXRpb24gcHJlZGF0ZXMgdGhpcyBvbmUgYW5kIG5ldmVyIHN3aXRjaGVkIHRoZXNlIHRocmVlXG4vLyB0byBhbiBpbXBvcnQgLSBvdXQgb2Ygc2NvcGUgaGVyZSB0byB0b3VjaCB2aWRlb3MuanMpLiBjbG9zZVRpbWVsaW5lSW50ZXJ2YWxNb2RhbFxuLy8gaXMgY2FsbGVkIGFzIGEgYmFyZSBnbG9iYWwgYnkgc2hvcnRjdXRzLmpzJ3MgRXNjYXBlLWtleSBtb2RhbC1jbG9zZXIgbWFwXG4vLyAoc2hvcnRjdXRzLmpzIGhhc24ndCBiZWVuIHVwZGF0ZWQgdG8gaW1wb3J0IGl0IGRpcmVjdGx5IC0gYWxzbyBvdXQgb2Ygc2NvcGUpLlxuLy8gY29uZmlybUdlbmVyYXRlVGltZWxpbmUgYW5kIHVwZGF0ZVRpbWVsaW5lSW50ZXJ2YWxIaW50IGRyb3BwZWQ6IHRoZWlyIG9ubHlcbi8vIGNhbGxlcnMgd2VyZSB0aGlzIG1vZHVsZSdzIG93biBpbmxpbmUgaGFuZGxlcnMsIG5vdyBhZGRFdmVudExpc3RlbmVyIGluc2lkZVxuLy8gdmlkZW9zLXRpbWVsaW5lLmpzIGl0c2VsZi5cbndpbmRvdy5nZW5lcmF0ZVRpbWVsaW5lID0gZ2VuZXJhdGVUaW1lbGluZTtcbndpbmRvdy5jbG9zZVRpbWVsaW5lSW50ZXJ2YWxNb2RhbCA9IGNsb3NlVGltZWxpbmVJbnRlcnZhbE1vZGFsO1xud2luZG93Ll9yZW5kZXJUaW1lbGluZUhUTUwgPSBfcmVuZGVyVGltZWxpbmVIVE1MO1xud2luZG93Ll90aW1lbGluZUVtcHR5Tm90ZUhUTUwgPSBfdGltZWxpbmVFbXB0eU5vdGVIVE1MO1xuLy8gdmlkZW9zLXN1bW1hcnkuanMgLSBzdW1tYXJpemVWaWRlbyBhbmQgcmVnZW5TdW1tYXJ5QXV0byBhcmUgcmVhZCBhcyB3aW5kb3cuKlxuLy8gYnkgdmlkZW9zLmpzIChhbHJlYWR5LUVTTSwgYnV0IG91dCBvZiBzY29wZSB0byBzd2l0Y2ggdG8gYW4gaW1wb3J0IGhlcmUpIGFuZFxuLy8gcmVnZW5TdW1tYXJ5QXV0byBpcyBhbHNvIGludm9rZWQgZGlyZWN0bHkgYnkgdGVzdHMvdWkvdGVzdF91aV92aWRlby5weSB2aWFcbi8vIHBhZ2UuZXZhbHVhdGUuIF9kb1JlZ2VuU3VtbWFyeUF1dG8gZHJvcHBlZDogaXRzIG9ubHkgY2FsbGVyIHdhcyB0aGlzIG1vZHVsZSdzXG4vLyBvd24gcmVnZW5TdW1tYXJ5QXV0bywgc28gbm90aGluZyBvdXRzaWRlIHRoZSBtb2R1bGUgbmVlZHMgaXQgb2ZmIHdpbmRvdy5cbndpbmRvdy5zdW1tYXJpemVWaWRlbyA9IHN1bW1hcml6ZVZpZGVvO1xud2luZG93LnJlZ2VuU3VtbWFyeUF1dG8gPSByZWdlblN1bW1hcnlBdXRvO1xuLy8gdmlkZW9zLXJ1bm1ldGEuanMgLSBfcmVuZGVyUnVuTWV0YUNhcmQgYW5kIF9ydW5UaW1pbmdMaW5lIGFyZSByZWFkIGFzXG4vLyB3aW5kb3cuKiBieSB2aWRlb3MuanMgKGFscmVhZHktRVNNLCBidXQgb3V0IG9mIHNjb3BlIHRvIHN3aXRjaCB0byBhbiBpbXBvcnRcbi8vIGhlcmUpLlxud2luZG93Ll9yZW5kZXJSdW5NZXRhQ2FyZCA9IF9yZW5kZXJSdW5NZXRhQ2FyZDtcbndpbmRvdy5fcnVuVGltaW5nTGluZSA9IF9ydW5UaW1pbmdMaW5lO1xuLy8gc2Vzc2lvbnMuanMgLSBTZXNzaW9uVUksIGlzU2Vzc2lvbkNvbGxhcHNlZCBhbmQgc2Vzc2lvbkdyb3VwSGVhZGVyTGkgYXJlIHJlYWRcbi8vIGFzIHdpbmRvdy4qIGJ5IHZpZGVvcy5qcyAoYWxyZWFkeS1FU00sIGJ1dCBvdXQgb2Ygc2NvcGUgdG8gc3dpdGNoIHRvIGFuIGltcG9ydFxuLy8gaGVyZSk7IHRvZ2dsZUdyb3VwU2VsZWN0IGlzIGludm9rZWQgZGlyZWN0bHkgYnkgdGVzdHMvdWkvdGVzdF91aV9zZXNzaW9ucy5weVxuLy8gdmlhIHBhZ2UuZXZhbHVhdGUuIEV2ZXJ5dGhpbmcgZWxzZSBzdGF5cyBtb2R1bGUtcHJpdmF0ZTogbG9hZFNlc3Npb25zLFxuLy8gZW50ZXJHcm91cGluZ01vZGUsIHN1Z2dlc3RTZXNzaW9ucyBhbmQgc2VsZWN0U2Vzc2lvbiBhcmUgb25seSBjYWxsZWQgYnkgdGhpc1xuLy8gbW9kdWxlJ3Mgb3duIGludGVybmFsIGxvZ2ljLCBhbmQgZXhpdEdyb3VwaW5nTW9kZSwgY29uZmlybUdyb3VwU2VsZWN0aW9uIGFuZFxuLy8gb3BlblJlY29yZGluZ3NBY3Rpb25zTWVudSBhcmUgbm93IHdpcmVkIHRvIHRoZWlyIHN0YXRpYyBpbmRleC5odG1sIGJ1dHRvbnMgdmlhXG4vLyBhZGRFdmVudExpc3RlbmVyIGluc2lkZSBzZXNzaW9ucy5qcyBpdHNlbGYgKG5vIGlubGluZSBvbmNsaWNrIGxlZnQpLlxud2luZG93LlNlc3Npb25VSSA9IFNlc3Npb25VSTtcbndpbmRvdy5pc1Nlc3Npb25Db2xsYXBzZWQgPSBpc1Nlc3Npb25Db2xsYXBzZWQ7XG53aW5kb3cuc2Vzc2lvbkdyb3VwSGVhZGVyTGkgPSBzZXNzaW9uR3JvdXBIZWFkZXJMaTtcbndpbmRvdy50b2dnbGVHcm91cFNlbGVjdCA9IHRvZ2dsZUdyb3VwU2VsZWN0O1xuLy8gY2xpcHMuanMgLSBldmVyeSBuYW1lIGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljIChidW5kbGUuanMpXG4vLyBjb25zdW1lciwgYSBzdGlsbC1jbGFzc2ljIG1vZHVsZSByZWFkaW5nIGl0IGFzIHdpbmRvdy4qIChzaG9ydGN1dHMuanMgcmVhZHNcbi8vIHNldFN0YXR1cy91bmRvTGFzdFN0YXR1cy9jbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbC9jbG9zZVNpbWlsYXJDbGlwc01vZGFsO1xuLy8gam9icy5qcyByZWFkcyBfcmVuZGVyQ2xpcEZpbHRlckNvdW50czsgdmlkZW9zLmpzIHJlYWRzIF9zeW5jRmlsdGVyQ2hpcHMpLCBvciBhXG4vLyB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUuIHNldENsaXBTZWFyY2gsIHNldENsaXBTY29yZU1pbiwgX2NsZWFyQ2xpcEZpbHRlcnMsXG4vLyBzZXRDbGlwS2luZCwgX3N5bmNLaW5kQ2hpcHMsIHRvZ2dsZUNsaXBTb3J0RGlyLCBkZWxldGVDbGlwLCBkZWxldGVFeHBvcnQsXG4vLyBtZXJnZUNsaXBzLCBzY2FuRHVwbGljYXRlcywgb3BlbkNsaXBzQWN0aW9uc01lbnUsIF9zY29yZU92ZXJyaWRlU2F2ZSxcbi8vIGNsZWFyU2NvcmVPdmVycmlkZSwgb3BlbkRlc2NLZWJhYiwgb3BlbkRlc2NMb25nS2ViYWIsIHN0YXJ0RmluZFNpbWlsYXIgYW5kXG4vLyBvcGVuU2ltaWxhckNsaXBzTW9kYWwgZHJvcHBlZDogdGhlaXIgb25seSBjYWxsZXJzIHdlcmUgY2xpcHMuanMncyBvd24gaW5saW5lXG4vLyBoYW5kbGVycyAobm93IGRhdGEtYWN0IGRlbGVnYXRpb24gb3Igc3RhdGljIGluZGV4Lmh0bWwgd2lyaW5nIGluc2lkZVxuLy8gY2xpcHMuanMgaXRzZWxmKSBvciBpdHMgb3duIGludGVybmFsIGxvZ2ljLCBzbyBub3RoaW5nIG91dHNpZGUgdGhlIG1vZHVsZVxuLy8gbmVlZHMgdGhlbSBvZmYgd2luZG93IGFueW1vcmUuXG53aW5kb3cuc2VsZWN0Q2xpcCA9IHNlbGVjdENsaXA7XG53aW5kb3cuc2V0U3RhdHVzID0gc2V0U3RhdHVzO1xud2luZG93LnVuZG9MYXN0U3RhdHVzID0gdW5kb0xhc3RTdGF0dXM7XG53aW5kb3cucmVuZGVyRGV0YWlsID0gcmVuZGVyRGV0YWlsO1xud2luZG93LnJlbmRlclBsYXllciA9IHJlbmRlclBsYXllcjtcbndpbmRvdy5jbGVhckRldGFpbCA9IGNsZWFyRGV0YWlsO1xud2luZG93LnJlZnJlc2hDbGlwRGV0YWlsID0gcmVmcmVzaENsaXBEZXRhaWw7XG53aW5kb3cuX3JlbGVhc2VQbGF5ZXJCZWZvcmVEZWxldGUgPSBfcmVsZWFzZVBsYXllckJlZm9yZURlbGV0ZTtcbndpbmRvdy5hbmFseXplRnJhbWVzID0gYW5hbHl6ZUZyYW1lcztcbndpbmRvdy50b2dnbGVDbGlwRmlsdGVyID0gdG9nZ2xlQ2xpcEZpbHRlcjtcbndpbmRvdy5fc3luY0ZpbHRlckNoaXBzID0gX3N5bmNGaWx0ZXJDaGlwcztcbndpbmRvdy5fYXBwbHlGaWx0ZXJzID0gX2FwcGx5RmlsdGVycztcbndpbmRvdy5fcmVuZGVyQ2xpcHMgPSBfcmVuZGVyQ2xpcHM7XG53aW5kb3cuX3BhcnNlVGltaW5nT2Zmc2V0ID0gX3BhcnNlVGltaW5nT2Zmc2V0O1xud2luZG93Ll9yZWxvYWRDbGlwTGlzdCA9IF9yZWxvYWRDbGlwTGlzdDtcbndpbmRvdy5fcmVuZGVyQ2xpcEZpbHRlckNvdW50cyA9IF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzO1xud2luZG93Lm9wZW5TY29yZU92ZXJyaWRlID0gb3BlblNjb3JlT3ZlcnJpZGU7XG53aW5kb3cuY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwgPSBjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbDtcbndpbmRvdy5jbG9zZVNpbWlsYXJDbGlwc01vZGFsID0gY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbDtcbndpbmRvdy5vcGVuQ2xpcEFjdGlvbnNNb2RhbCA9IG9wZW5DbGlwQWN0aW9uc01vZGFsO1xuLy8gY2xpcGJ1bGsuanMgLSBfcHJ1bmVDbGlwU2VsZWN0aW9uLCBfdXBkYXRlQnVsa1Rvb2xiYXIgYW5kIF90b2dnbGVDbGlwU2VsZWN0aW9uXG4vLyBhcmUgcmVhZCBhcyB3aW5kb3cuKiBieSBjbGlwcy5qcyAoYWxyZWFkeS1FU00sIGJ1dCBjbGlwcy5qcydzIG93biBtaWdyYXRpb25cbi8vIHByZWRhdGVzIHRoaXMgb25lIGFuZCBuZXZlciBzd2l0Y2hlZCB0aGVzZSB0byBhbiBpbXBvcnQgLSBvdXQgb2Ygc2NvcGUgdG9cbi8vIHRvdWNoIGNsaXBzLmpzIGhlcmUpOyB1bmRvTGFzdEJ1bGtTdGF0dXMgaXMgY2FsbGVkIGFzIGEgYmFyZSBnbG9iYWwgYnlcbi8vIGNsaXBzLmpzJ3MgdW5kb0xhc3RTdGF0dXMgKHNhbWUgcmVhc29uKS4gYnVsa1NldENsaXBTdGF0dXMsIGJ1bGtEZWxldGVDbGlwcyxcbi8vIGJ1bGtFeHBvcnRDbGlwcyBhbmQgX2NsZWFyQ2xpcFNlbGVjdGlvbiBkcm9wcGVkOiB0aGVpciBvbmx5IGNhbGxlcnMgd2VyZSB0aGlzXG4vLyBtb2R1bGUncyBvd24gaW5saW5lIGhhbmRsZXJzLCBub3cgZGF0YS1hY3QgZGVsZWdhdGlvbiBpbnNpZGUgY2xpcGJ1bGsuanNcbi8vIGl0c2VsZiwgc28gbm90aGluZyBvdXRzaWRlIHRoZSBtb2R1bGUgbmVlZHMgdGhlbSBvZmYgd2luZG93IGFueW1vcmUuXG53aW5kb3cuX3BydW5lQ2xpcFNlbGVjdGlvbiA9IF9wcnVuZUNsaXBTZWxlY3Rpb247XG53aW5kb3cuX3VwZGF0ZUJ1bGtUb29sYmFyID0gX3VwZGF0ZUJ1bGtUb29sYmFyO1xud2luZG93Ll90b2dnbGVDbGlwU2VsZWN0aW9uID0gX3RvZ2dsZUNsaXBTZWxlY3Rpb247XG53aW5kb3cudW5kb0xhc3RCdWxrU3RhdHVzID0gdW5kb0xhc3RCdWxrU3RhdHVzO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7QUFNTyxNQUFNLFdBQVc7QUFBQSxJQUN0QixlQUFxQjtBQUFBLElBQ3JCLGNBQXFCO0FBQUEsSUFDckIsUUFBcUIsQ0FBQztBQUFBLElBQ3RCLFVBQXFCLENBQUM7QUFBQTtBQUFBLElBQ3RCLGlCQUFxQjtBQUFBO0FBQUEsSUFDckIsT0FBcUIsQ0FBQztBQUFBLElBQ3RCLGlCQUFxQixDQUFDO0FBQUEsSUFDdEIsVUFBcUIsQ0FBQztBQUFBLElBQ3RCLFVBQXFCLENBQUM7QUFBQSxJQUN0QixpQkFBcUI7QUFBQSxJQUNyQixnQkFBcUIsQ0FBQztBQUFBLElBQ3RCLHVCQUF1QjtBQUFBLElBQ3ZCLGlCQUFx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c3NhbHMiLCAiX3dpcmVNb2RhbEJ1dHRvbnMiLCAiX3dpcmVIYW1idXJnZXJIYW5kbGVycyIsICJfc3luY0FuYWx5c2lzTGl2ZVBhbmVsIiwgImNsb3NlVGltZWxpbmVJbnRlcnZhbE1vZGFsIiwgInJlcyIsICJfcmVuZGVyQ2xpcEZpbHRlckNvdW50cyIsICJzZWxlY3RDbGlwIiwgIl9oYW5kbGVEZXRhaWxDbGljayIsICJzZXRTdGF0dXMiLCAiY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwiLCAidW5kb0xhc3RTdGF0dXMiLCAiY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCIsICJjbG9zZVNpbWlsYXJDbGlwc01vZGFsIiwgImNsb3NlU2NvcmVPdmVycmlkZU1vZGFsIiwgInVuZG9MYXN0QnVsa1N0YXR1cyIsICJzZWxlY3RDbGlwIiwgIl9zeW5jQW5hbHlzaXNMaXZlUGFuZWwiLCAiY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwiLCAic2VsZWN0Q2xpcCIsICJzZXRTdGF0dXMiLCAidW5kb0xhc3RTdGF0dXMiLCAiX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMiLCAiY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwiLCAiY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCIsICJ1bmRvTGFzdEJ1bGtTdGF0dXMiXQp9Cg==
