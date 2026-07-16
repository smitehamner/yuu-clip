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
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3RhdGUuanMiLCAiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgImpvYnMuanMiLCAicHJldmlldy5qcyIsICJ1dGlscy5qcyIsICJ1aS5qcyIsICJoZWxwbW9kYWxzLmpzIiwgInNob3J0Y3V0cy5qcyIsICJtb2RlbGNhdGFsb2cuanMiLCAidmlkZW9zLmpzIiwgIm1haW4uZXNtLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBGZWF0dXJlLW1hcCAtIFNoYXJlZCBhcHBsaWNhdGlvbiBzdGF0ZTogdGhlIHNpbmdsZSBBcHBTdGF0ZSBvYmplY3QgZXZlcnkgZmVhdHVyZSBtb2R1bGUgcmVhZHMvd3JpdGVzLlxuLy8gICBBUEk6IG5vbmUgKGNsaWVudC1vbmx5KSDCtyBUZXN0czogY292ZXJlZCBpbmRpcmVjdGx5IGJ5IHRoZSB0ZXN0X3VpXyoucHkgc3VpdGVzXG4vLyDilIDilIAgc2hhcmVkIGFwcGxpY2F0aW9uIHN0YXRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTXV0YWJsZSBzdGF0ZSBzaGFyZWQgYWNyb3NzIGZlYXR1cmUgbW9kdWxlcy4gQ2VudHJhbGl6ZWQgaW4gb25lIGV4cGxpY2l0IG9iamVjdFxuLy8gc28gY3Jvc3MtbW9kdWxlIHJlYWRzL3dyaXRlcyBhcmUgZ3JlcHBhYmxlIGFuZCBvYnZpb3VzbHkgc2hhcmVkLCByYXRoZXIgdGhhblxuLy8gc2NhdHRlcmVkIGJhcmUgZ2xvYmFscyB0aGF0IGxvb2sgbGlrZSBtb2R1bGUgbG9jYWxzIGF0IHRoZSBjYWxsIHNpdGUuXG5leHBvcnQgY29uc3QgQXBwU3RhdGUgPSB7XG4gIGFjdGl2ZVZpZGVvSWQ6ICAgICAgIG51bGwsXG4gIGFjdGl2ZUNsaXBJZDogICAgICAgIG51bGwsXG4gIHZpZGVvczogICAgICAgICAgICAgIFtdLFxuICBzZXNzaW9uczogICAgICAgICAgICBbXSwgICAgICAgLy8gZ3JvdXBlZCBwbGF5IHNlc3Npb25zIChSZWNvcmRpbmdTZXNzaW9uIHJvd3MpXG4gIGFjdGl2ZVNlc3Npb25JZDogICAgIG51bGwsICAgICAvLyBzZXNzaW9uIHdob3NlIGRldGFpbCB2aWV3IGlzIG9wZW4sIG9yIG51bGxcbiAgY2xpcHM6ICAgICAgICAgICAgICAgW10sXG4gIGFuYWx5emVQcm9maWxlczogICAgIFtdLFxuICBjb250ZXh0czogICAgICAgICAgICBbXSxcbiAgaG90V29yZHM6ICAgICAgICAgICAgW10sXG4gIF9ob3RXb3Jkc0xvYWRlZDogICAgIGZhbHNlLFxuICBzZW5zaXRpdmVUZXJtczogICAgICBbXSxcbiAgX3NlbnNpdGl2ZVRlcm1zTG9hZGVkOiBmYWxzZSxcbiAgYW5hbHl6ZUZpbGVuYW1lOiAgICAgbnVsbCxcbiAgZWRpdGluZ0NvbnRleHRJZDogICAgbnVsbCxcbiAgY2xpcEZpbHRlcnM6ICAgICAgICAgbmV3IFNldCgpLCAgLy8gYWN0aXZlIGZpbHRlciB0b2tlbnM7IGVtcHR5ID0gc2hvdyBhbGxcbiAgY2xpcEtpbmQ6ICAgICAgICAgICAgJ2NsaXAnLCAgICAgIC8vIGNhbmRpZGF0ZSB0eXBlIHNob3duOiAnY2xpcCcgfCAnc2NlbmUnIChzZXJ2ZXItc2lkZSBmaWx0ZXIpXG4gIGNsaXBTZWFyY2g6ICAgICAgICAgICcnLFxuICBjbGlwU2NvcmVNaW46ICAgICAgICAwLFxuICB2aWRlb1NlYXJjaDogICAgICAgICAnJyxcbiAgdmlkZW9Tb3J0OiAgICAgICAgICAgJ3JlY2VudCcsXG4gIHZpZGVvU29ydERpcjogICAgICAgICdkZXNjJywgIC8vICdkZXNjJyA9IHRoZSBzb3J0IG9wdGlvbidzIG5hdHVyYWwgb3JkZXI7ICdhc2MnIHJldmVyc2VzIGl0XG4gIGNsaXBTb3J0RGlyOiAgICAgICAgICdkZXNjJyxcbiAgdmlkZW9GaWx0ZXJzOiAgICAgICAgbmV3IFNldCgpLCAgLy8gYWN0aXZlIHZpZGVvIGZpbHRlciB0b2tlbnM7IGVtcHR5ID0gc2hvdyBhbGxcbiAgc2VsZWN0ZWRDbGlwSWRzOiAgICAgbmV3IFNldCgpLFxuICBsYXN0U3RhdHVzQ2hhbmdlOiAgICBudWxsLCAvLyB7Y2xpcElkLCBmcm9tU3RhdHVzLCB0aW1lcn1cbiAgbGFzdEJ1bGtTdGF0dXNDaGFuZ2U6IG51bGwsIC8vIHtwcmV2aW91czoge2NsaXBJZDogZnJvbVN0YXR1c30sIHRpbWVyfVxuICBjb25maXJtQ2FsbGJhY2s6ICAgICBudWxsLFxuICBhY3RpdmVDbGlwRGF0YTogICAgICBudWxsLFxuICBjbGlwSm9iczogICAgICAgICAgICB7fSwgICAvLyBjbGlwSWQgLT4ge29wfSBmb3IgYSBwZXItY2xpcCBhc3luYyBqb2IgaW4gZmxpZ2h0IChhbmFseXplLWZyYW1lcyksIHNvIGl0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpbmRpY2F0b3Igc3Vydml2ZXMgYSByZW5kZXJEZXRhaWwgcmVidWlsZCAvIGNsaXAgc3dpdGNoIChzdGF0ZSwgbm90IGEgRE9NIG5vZGUpXG4gIGFjdGl2ZU1lZGlhRmlsZW5hbWU6IG51bGwsXG4gIGFjdGl2ZVZpZGVvRGF0YTogICAgIG51bGwsXG4gIGJvb3RSZXN0b3JlRG9uZTogICAgIGZhbHNlLFxuICBleHBvcnREaXI6ICAgICAgICAgICBudWxsLFxuICByZWVsc0RpcjogICAgICAgICAgICBudWxsLFxuICBjYW5SZXZlYWw6ICAgICAgICAgICBmYWxzZSxcbn07XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBQdXJlIGZvcm1hdHRlcnMgYW5kIHNjb3JlIGhlbHBlcnM6IG5vIERPTSwgbm8gZmV0Y2guIEhUTUwtZXNjYXBlLCBBUEktZXJyb3IgdGV4dCxcclxuLy8gICBkdXJhdGlvbi9kYXRlL29mZnNldCBmb3JtYXR0aW5nLCB2aWRlby1zdGF0dXMgbGFiZWxzLCBhbmQgdGhlIHNjb3JlIGNvbG9yL2ljb24gZW5jb2RpbmcuXHJcbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHlcclxuLy8g4pSA4pSAIHNjb3JlIHV0aWxzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5mdW5jdGlvbiBfc2NvcmVJY29uKHNjb3JlKSB7XHJcbiAgY29uc3QgY29sb3IgPSBzY29yZSA+PSAwLjcgPyAndmFyKC0tZ3JlZW4pJyA6IHNjb3JlID49IDAuNCA/ICd2YXIoLS13YXJuaW5nKScgOiAndmFyKC0tbXV0ZWQpJztcclxuICByZXR1cm4gYDxzcGFuIHN0eWxlPVwiY29sb3I6JHtjb2xvcn07Zm9udC1zaXplOjEwcHhcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4mIzExMDg4Ozwvc3Bhbj5gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfbGVycENvbG9yKGMxLCBjMiwgdCkge1xyXG4gIGNvbnN0IGggPSBjID0+IFtwYXJzZUludChjLnNsaWNlKDEsMyksMTYpLCBwYXJzZUludChjLnNsaWNlKDMsNSksMTYpLCBwYXJzZUludChjLnNsaWNlKDUsNyksMTYpXTtcclxuICBjb25zdCBbcjEsZzEsYjFdID0gaChjMSksIFtyMixnMixiMl0gPSBoKGMyKTtcclxuICByZXR1cm4gYHJnYigke01hdGgucm91bmQocjErKHIyLXIxKSp0KX0sJHtNYXRoLnJvdW5kKGcxKyhnMi1nMSkqdCl9LCR7TWF0aC5yb3VuZChiMSsoYjItYjEpKnQpfSlgO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc2NvcmVCb3JkZXJDb2xvcihzY29yZSwgaXNSZWplY3RlZCkge1xyXG4gIGlmIChpc1JlamVjdGVkKSByZXR1cm4gJ3ZhcigtLW11dGVkKSc7XHJcbiAgY29uc3Qgc3RvcHMgPSBbWzAsJyM2YjZiODAnXSxbMC4zLCcjNGZjM2Y3J10sWzAuNSwnIzRjYWY3ZCddLFswLjcsJyNmMGMwNjAnXSxbMS4wLCcjZjdhODVhJ11dO1xyXG4gIGZvciAobGV0IGkgPSAxOyBpIDwgc3RvcHMubGVuZ3RoOyBpKyspIHtcclxuICAgIGlmIChzY29yZSA8PSBzdG9wc1tpXVswXSkge1xyXG4gICAgICBjb25zdCB0ID0gKHNjb3JlIC0gc3RvcHNbaS0xXVswXSkgLyAoc3RvcHNbaV1bMF0gLSBzdG9wc1tpLTFdWzBdKTtcclxuICAgICAgcmV0dXJuIF9sZXJwQ29sb3Ioc3RvcHNbaS0xXVsxXSwgc3RvcHNbaV1bMV0sIHQpO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gc3RvcHNbc3RvcHMubGVuZ3RoLTFdWzFdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc29ydFNjb3JlKGNsaXApIHtcclxuICBjb25zdCBzb3J0ID0gd2luZG93Ll9jbGlwc1NvcnRQYXJhbSgpO1xyXG4gIGlmIChzb3J0ID09PSAnZnVubnknKSAgICByZXR1cm4gY2xpcC5zY29yZV9mdW5ueTtcclxuICBpZiAoc29ydCA9PT0gJ2RyYW1hdGljJykgcmV0dXJuIGNsaXAuc2NvcmVfZHJhbWF0aWM7XHJcbiAgaWYgKHNvcnQgPT09ICdhY3Rpb24nKSAgIHJldHVybiBjbGlwLnNjb3JlX2FjdGlvbjtcclxuICBpZiAoc29ydCA9PT0gJ3Zpc3VhbCcpICAgcmV0dXJuIGNsaXAuc2NvcmVfdmlzdWFsO1xyXG4gIGlmIChzb3J0ID09PSAnbGF1Z2gnKSAgICByZXR1cm4gY2xpcC5zY29yZV9sYXVnaDtcclxuICByZXR1cm4gY2xpcC5zY29yZV9vdmVyYWxsO1xyXG59XHJcblxyXG4vLyDilIDilIAgZm9ybWF0IHV0aWxzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5jb25zdCBfVklERU9fU1RBVFVTX0RJU1BMQVkgPSB7XHJcbiAgcGVuZGluZzogJ05vdCBhbmFseXplZCcsIHByb2JlZDogJ0luc3BlY3RlZCcsIGxhYmVsZWQ6ICdUcmFja3MgYXNzaWduZWQnLFxyXG4gIGV4dHJhY3Rpbmc6ICdFeHRyYWN0aW5nJywgdHJhbnNjcmliaW5nOiAnVHJhbnNjcmliaW5nJywgdHJhbnNjcmliZWQ6ICdUcmFuc2NyaWJlZCcsXHJcbiAgc2VnbWVudGVkOiAnQ2xpcHMgZ2VuZXJhdGVkJywgZG9uZTogJ0FuYWx5emVkJywgZmFpbGVkOiAnQW5hbHlzaXMgaW50ZXJydXB0ZWQnLFxyXG59O1xyXG5mdW5jdGlvbiBfZm10VmlkZW9TdGF0dXMocykgeyByZXR1cm4gX1ZJREVPX1NUQVRVU19ESVNQTEFZW3NdIHx8IHM7IH1cclxuXHJcbmZ1bmN0aW9uIF9tc1RvSG1zKG1zKSB7XHJcbiAgY29uc3QgcyA9IE1hdGguZmxvb3IobXMgLyAxMDAwKTtcclxuICBpZiAocyA8IDYwKSByZXR1cm4gYCR7c31zYDtcclxuICBjb25zdCBtID0gTWF0aC5mbG9vcihzIC8gNjApLCBzZWMgPSBzICUgNjA7XHJcbiAgaWYgKG0gPCA2MCkgcmV0dXJuIGAke219bSAke1N0cmluZyhzZWMpLnBhZFN0YXJ0KDIsICcwJyl9c2A7XHJcbiAgY29uc3QgaCA9IE1hdGguZmxvb3IobSAvIDYwKSwgbWluID0gbSAlIDYwO1xyXG4gIHJldHVybiBgJHtofWggJHtTdHJpbmcobWluKS5wYWRTdGFydCgyLCAnMCcpfW1gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwbHVyYWwoY291bnQsIHNpbmd1bGFyLCBwbHVyYWxGb3JtKSB7XHJcbiAgcmV0dXJuIGAke2NvdW50fSAke2NvdW50ID09PSAxID8gc2luZ3VsYXIgOiAocGx1cmFsRm9ybSB8fCBzaW5ndWxhciArICdzJyl9YDtcclxufVxyXG5cclxuLy8gU3RhbmRhcmQgZ3VhcmQgZm9yIGFueSBjb21wdXRlZCBudW1iZXIgc2hvd24gdG8gdGhlIHVzZXI6IHJldHVybnMgKnZhbHVlKlxyXG4vLyBvbmx5IHdoZW4gaXQgaXMgYSBmaW5pdGUgbnVtYmVyLCBvdGhlcndpc2UgYSBwbGFpbi1FbmdsaXNoICpmYWxsYmFjayouIE5hTlxyXG4vLyBvciBJbmZpbml0eSAtIHVzdWFsbHkgZnJvbSBhcml0aG1ldGljIG9uIG1pc3NpbmcvcGFydGlhbCBkYXRhIC0gbXVzdCBuZXZlclxyXG4vLyByZWFjaCB0aGUgVUkgYXMgdGhlIGxpdGVyYWwgXCJOYU5cIi9cIkluZmluaXR5XCIuIFVzZSB0aGlzIChvciBmbXREdXJhdGlvbikgYXRcclxuLy8gZXZlcnkgZGlzcGxheSBzaXRlIHRoYXQgZm9ybWF0cyBhIGRlcml2ZWQgbnVtYmVyLlxyXG5mdW5jdGlvbiBmaW5pdGVPcih2YWx1ZSwgZmFsbGJhY2sgPSAnTi9BJykge1xyXG4gIHJldHVybiBOdW1iZXIuaXNGaW5pdGUodmFsdWUpID8gdmFsdWUgOiBmYWxsYmFjaztcclxufVxyXG5cclxuLy8gSHVtYW4tcmVhZGFibGUgY2xpcC9zZWdtZW50IGxlbmd0aC4gUmV0dXJucyAqZmFsbGJhY2sqIGZvciBhIG5vbi1maW5pdGVcclxuLy8gaW5wdXQgKGUuZy4gYSBjbGlwIG1pc3NpbmcgaXRzIHN0YXJ0L2VuZCB0aW1lcykgcmF0aGVyIHRoYW4gXCJOYU4gc2VjXCIuXHJcbmZ1bmN0aW9uIGZtdER1cmF0aW9uKHNlY29uZHMsIGZhbGxiYWNrID0gJ3Vua25vd24nKSB7XHJcbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoc2Vjb25kcykpIHJldHVybiBmYWxsYmFjaztcclxuICByZXR1cm4gc2Vjb25kcyA+PSA2MCA/IGAke01hdGgucm91bmQoc2Vjb25kcyAvIDYwKX0gbWluYCA6IGAke01hdGgucm91bmQoc2Vjb25kcyl9IHNlY2A7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRydW5jYXRlKHRleHQsIG1heCkge1xyXG4gIHJldHVybiB0ZXh0Lmxlbmd0aCA+IG1heCA/IHRleHQuc2xpY2UoMCwgbWF4IC0gMSkgKyAn4oCmJyA6IHRleHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVzY0h0bWwocykge1xyXG4gIHJldHVybiBTdHJpbmcocykucmVwbGFjZSgvJi9nLCcmYW1wOycpLnJlcGxhY2UoLzwvZywnJmx0OycpLnJlcGxhY2UoLz4vZywnJmd0OycpLnJlcGxhY2UoL1wiL2csJyZxdW90OycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb3JtYXRBcGlFcnJvcihlcnIpIHtcclxuICBpZiAoIWVycikgcmV0dXJuICdVbmtub3duIGVycm9yJztcclxuICBpZiAodHlwZW9mIGVyci5kZXRhaWwgPT09ICdzdHJpbmcnKSByZXR1cm4gZXJyLmRldGFpbDtcclxuICBpZiAoQXJyYXkuaXNBcnJheShlcnIuZGV0YWlsKSkgcmV0dXJuIGVyci5kZXRhaWwubWFwKGUgPT4gZS5tc2cgfHwgSlNPTi5zdHJpbmdpZnkoZSkpLmpvaW4oJzsgJyk7XHJcbiAgaWYgKGVyci5tZXNzYWdlKSByZXR1cm4gZXJyLm1lc3NhZ2U7XHJcbiAgY29uc3Qgc3RyaW5naWZpZWQgPSBKU09OLnN0cmluZ2lmeShlcnIpO1xyXG4gIHJldHVybiAoIXN0cmluZ2lmaWVkIHx8IHN0cmluZ2lmaWVkID09PSAne30nKSA/ICdVbmtub3duIGVycm9yIChubyBkZXRhaWxzIGZyb20gc2VydmVyKScgOiBzdHJpbmdpZmllZDtcclxufVxyXG5cclxuZnVuY3Rpb24gc3RyaXBSaWNoTWFya3VwKHRleHQpIHtcclxuICByZXR1cm4gdGV4dFxyXG4gICAgLnJlcGxhY2UoL1xceDFiXFxbWzAtOTtdKlthLXpBLVpdL2csICcnKSAgLy8gQU5TSSBlc2NhcGUgY29kZXNcclxuICAgIC5yZXBsYWNlKC9cXFtcXC8/XFx3K1xcXS9nLCAnJyk7ICAgICAgICAgICAgIC8vIFJpY2ggbWFya3VwIHRhZ3NcclxufVxyXG5cclxuLy8gU2VydmVyIHRpbWVzdGFtcHMgYXJlIG5haXZlIFVUQyAoU1FMaXRlIERhdGVUaW1lIOKGkiBpc29mb3JtYXQoKSB3aXRoIG5vIHpvbmUpLlxyXG4vLyBUcmVhdCBhIHpvbmUtbGVzcyBzdHJpbmcgYXMgVVRDIHNvIGl0IGlzbid0IHBhcnNlZCBhcyB0aGUgdmlld2VyJ3MgbG9jYWwgdGltZS5cclxuZnVuY3Rpb24gX3BhcnNlU2VydmVyRGF0ZShpc28pIHtcclxuICBjb25zdCBoYXNab25lID0gL1t6Wl0kfFsrLV1cXGR7Mn06P1xcZHsyfSQvLnRlc3QoaXNvKTtcclxuICByZXR1cm4gbmV3IERhdGUoaGFzWm9uZSA/IGlzbyA6IGlzbyArICdaJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXREYXRlKGlzbykge1xyXG4gIGlmICghaXNvKSByZXR1cm4gJ25ldmVyJztcclxuICBjb25zdCBkID0gX3BhcnNlU2VydmVyRGF0ZShpc28pO1xyXG4gIHJldHVybiBkLnRvTG9jYWxlRGF0ZVN0cmluZyh1bmRlZmluZWQsIHttb250aDonc2hvcnQnLCBkYXk6J251bWVyaWMnfSkgKyAnIGF0ICcgK1xyXG4gICAgZC50b0xvY2FsZVRpbWVTdHJpbmcodW5kZWZpbmVkLCB7aG91cjonbnVtZXJpYycsIG1pbnV0ZTonMi1kaWdpdCd9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdEFnbyhpc29TdHJpbmcpIHtcclxuICBjb25zdCBkaWZmUyA9IChEYXRlLm5vdygpIC0gX3BhcnNlU2VydmVyRGF0ZShpc29TdHJpbmcpLmdldFRpbWUoKSkgLyAxMDAwO1xyXG4gIGlmIChkaWZmUyA8IDYwKSAgICByZXR1cm4gJ2p1c3Qgbm93JztcclxuICBpZiAoZGlmZlMgPCAzNjAwKSAgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyA2MCl9bSBhZ29gO1xyXG4gIGlmIChkaWZmUyA8IDg2NDAwKSByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDM2MDApfWggYWdvYDtcclxuICByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDg2NDAwKX1kIGFnb2A7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRPZmZzZXQodikge1xyXG4gIGlmICghdikgcmV0dXJuICcrMC4wJztcclxuICByZXR1cm4gKHYgPj0gMCA/ICcrJyA6ICcnKSArIHYudG9GaXhlZCgxKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdEVsYXBzZWQobXMpIHtcclxuICBjb25zdCBzID0gTWF0aC5mbG9vcihtcyAvIDEwMDApO1xyXG4gIGNvbnN0IG0gPSBNYXRoLmZsb29yKHMgLyA2MCk7XHJcbiAgcmV0dXJuIG0gPiAwID8gYCR7bX1tICR7cyAlIDYwfXNgIDogYCR7c31zYDtcclxufVxyXG5cclxuLy8g4pSA4pSAIHRpbWVsaW5lIGludGVydmFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5jb25zdCBfVElNRUxJTkVfTUlOX0lOVEVSVkFMX1MgPSAxMDtcclxuXHJcbi8vIENvbnZlcnQgYSB0aW1lbGluZSBpbnRlcnZhbCAodmFsdWUsIHVuaXQpIGludG8gc2Vjb25kczsgbnVsbCBpZiBub24tbnVtZXJpYyBvclxyXG4vLyBiZWxvdyB0aGUgbWluaW11bS4gU2hhcmVkIGJ5IHRoZSBTZXR0aW5ncyBzYXZlIHBhdGggYW5kIHRoZSBwZXItdmlkZW8gdGltZWxpbmVcclxuLy8gZ2VuZXJhdG9yIHNvIHRoZWlyIHZhbGlkYXRpb24gY2FuJ3QgZHJpZnQgYXBhcnQuXHJcbmZ1bmN0aW9uIF9wYXJzZUludGVydmFsUyh2YWx1ZSwgdW5pdCkge1xyXG4gIGNvbnN0IG4gPSBwYXJzZUludCh2YWx1ZSwgMTApO1xyXG4gIGlmIChpc05hTihuKSkgcmV0dXJuIG51bGw7XHJcbiAgY29uc3Qgc2Vjb25kcyA9IHVuaXQgPT09ICdtaW51dGVzJyA/IG4gKiA2MCA6IG47XHJcbiAgcmV0dXJuIHNlY29uZHMgPj0gX1RJTUVMSU5FX01JTl9JTlRFUlZBTF9TID8gc2Vjb25kcyA6IG51bGw7XHJcbn1cclxuXHJcbmV4cG9ydCB7XHJcbiAgX3Njb3JlSWNvbiwgX2xlcnBDb2xvciwgX3Njb3JlQm9yZGVyQ29sb3IsIF9zb3J0U2NvcmUsIF9mbXRWaWRlb1N0YXR1cywgX21zVG9IbXMsXHJcbiAgcGx1cmFsLCBmaW5pdGVPciwgZm10RHVyYXRpb24sIHRydW5jYXRlLCBlc2NIdG1sLCBmb3JtYXRBcGlFcnJvciwgc3RyaXBSaWNoTWFya3VwLFxyXG4gIF9wYXJzZVNlcnZlckRhdGUsIF9mbXREYXRlLCBfZm10QWdvLCBfZm10T2Zmc2V0LCBfZm10RWxhcHNlZCwgX3BhcnNlSW50ZXJ2YWxTLFxyXG59O1xyXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgY29sb3VyIHBpY2tlci4gUHJvZ3Jlc3NpdmUtZW5oYW5jZXMgYW4gPGlucHV0PiB0aGF0IGhvbGRzXHJcbi8vICAgYSBoZXggdmFsdWU6IHRoZSBvcmlnaW5hbCBpbnB1dCBiZWNvbWVzIGEgaGlkZGVuIHZhbHVlLXN0b3JlIChrZWVwaW5nIGl0cyBpZCxcclxuLy8gICBjbGFzc2VzLCBkYXRhLSogYW5kIGV2ZW50IHdpcmluZykgYW5kIGdhaW5zIGEgY29tcGFjdCBzd2F0Y2ggdHJpZ2dlci4gQ2xpY2tpbmdcclxuLy8gICBpdCBvcGVucyBhIHBvcG92ZXIgd2l0aCBkaXJlY3QgaGV4IGVudHJ5LCBhIHJlY2VudGx5LXVzZWQgc3RyaXAsIGFuZCAoU3RhZ2UgMylcclxuLy8gICBhIHVzZXItY3VyYXRlZCBuYW1lZCBwYWxldHRlLiBSZXBsYWNlcyBuYXRpdmUgPGlucHV0IHR5cGU9XCJjb2xvclwiPiBhdCB0aGVcclxuLy8gICBzcGVha2VyLWNvbG91ciBhbmQgdGl0bGUtY2FyZCBjb2xvdXIgc2l0ZXMuXHJcbi8vICAgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfY29sb3JwaWNrZXIucHlcclxuLy8g4pSA4pSAIHNoYXJlZCBjb2xvdXIgcGlja2VyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuY29uc3QgUkVDRU5UX0tFWSA9ICd5dXVjbGlwLWNvbG9yLXJlY2VudCc7XHJcbmNvbnN0IFBBTEVUVEVfS0VZID0gJ3l1dWNsaXAtY29sb3ItcGFsZXR0ZSc7XHJcbmNvbnN0IFJFQ0VOVF9NQVggPSA4O1xyXG5cclxuLy8gUGlja2FibGUgc3RhcnRlciBjb2xvdXJzIC0gZGF0YSwgbm90IFVJIGNocm9tZSAodGhlIGNocm9tZSBhcm91bmQgdGhlbSBjb21lc1xyXG4vLyBmcm9tIHRoZW1lIHRva2VucykuIEEgc3ByZWFkIG9mIGh1ZXMgcGx1cyBibGFjay93aGl0ZSBzbyBhIGZpcnN0LXRpbWUgdXNlciBoYXNcclxuLy8gdXNhYmxlIGNob2ljZXMgYmVmb3JlIGN1cmF0aW5nIHRoZWlyIG93biBwYWxldHRlLiBUaGVzZSBsaXRlcmFscyBhcmUgdGhlIG9uZVxyXG4vLyBleGNlcHRpb24gdGhlIHRlc3RfdWlfdGhlbWUgY29sb3VyLWxpdGVyYWwgYWxsb3dsaXN0IGNhcnZlcyBvdXQgZm9yIHRoaXMgZmlsZS5cclxuY29uc3QgU1RBUlRFUl9TV0FUQ0hFUyA9IFtcclxuICAnI2ZmZmZmZicsICcjMDAwMDAwJywgJyNlMDVjNWMnLCAnI2YwODAzYycsICcjZjBjMDYwJywgJyM0Y2FmN2QnLFxyXG4gICcjNGZjM2Y3JywgJyMwYTdhOWInLCAnI2IwNmFmNycsICcjZjc3YWMwJywgJyM5ZTllOWUnLCAnIzdhNGIyYScsXHJcbl07XHJcblxyXG5mdW5jdGlvbiBfcmVhZExpc3Qoa2V5KSB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KSB8fCAnW10nKTtcclxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbXTtcclxuICB9IGNhdGNoIHsgcmV0dXJuIFtdOyB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF93cml0ZUxpc3Qoa2V5LCBsaXN0KSB7XHJcbiAgdHJ5IHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShsaXN0KSk7IH0gY2F0Y2ggeyAvKiBzdG9yYWdlIGRpc2FibGVkICovIH1cclxufVxyXG5cclxuLy8gQWNjZXB0cyAjUkdCIG9yICNSUkdHQkIgKHdpdGggb3Igd2l0aG91dCB0aGUgbGVhZGluZyAjKSBhbmQgcmV0dXJucyBhXHJcbi8vIGNhbm9uaWNhbCBsb3dlcmNhc2UgI3JyZ2diYiwgb3IgbnVsbCB3aGVuIHRoZSB2YWx1ZSBpc24ndCBhIHZhbGlkIGhleCBjb2xvdXIuXHJcbmZ1bmN0aW9uIF9ub3JtYWxpemVIZXgocmF3KSB7XHJcbiAgaWYgKHR5cGVvZiByYXcgIT09ICdzdHJpbmcnKSByZXR1cm4gbnVsbDtcclxuICBsZXQgaGV4ID0gcmF3LnRyaW0oKTtcclxuICBpZiAoaGV4ICYmICFoZXguc3RhcnRzV2l0aCgnIycpKSBoZXggPSAnIycgKyBoZXg7XHJcbiAgY29uc3Qgc2hvcnQgPSAvXiMoWzAtOWEtZkEtRl17M30pJC8uZXhlYyhoZXgpO1xyXG4gIGlmIChzaG9ydCkgaGV4ID0gJyMnICsgc2hvcnRbMV0uc3BsaXQoJycpLm1hcChjID0+IGMgKyBjKS5qb2luKCcnKTtcclxuICByZXR1cm4gL14jWzAtOWEtZkEtRl17Nn0kLy50ZXN0KGhleCkgPyBoZXgudG9Mb3dlckNhc2UoKSA6IG51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9yZWNvcmRSZWNlbnQoaGV4KSB7XHJcbiAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgoaGV4KTtcclxuICBpZiAoIW5vcm0pIHJldHVybjtcclxuICBjb25zdCBsaXN0ID0gX3JlYWRMaXN0KFJFQ0VOVF9LRVkpXHJcbiAgICAubWFwKF9ub3JtYWxpemVIZXgpXHJcbiAgICAuZmlsdGVyKGMgPT4gYyAmJiBjICE9PSBub3JtKTtcclxuICBsaXN0LnVuc2hpZnQobm9ybSk7XHJcbiAgX3dyaXRlTGlzdChSRUNFTlRfS0VZLCBsaXN0LnNsaWNlKDAsIFJFQ0VOVF9NQVgpKTtcclxufVxyXG5cclxuLy8gQSBzaW5nbGUgY2xpY2thYmxlIHN3YXRjaCBzaG93aW5nIGFuIGFjdHVhbCBjaG9zZW4gY29sb3VyLiBUaGUgYmFja2dyb3VuZCBpcyBhXHJcbi8vIGRhdGEgdmFsdWUgKHRoZSBwaWNrZWQgY29sb3VyKSwgc2V0IGFzIGEgRE9NIHByb3BlcnR5IHNvIGl0IG5ldmVyIGFwcGVhcnMgYXMgYVxyXG4vLyBsaXRlcmFsIGluIHNvdXJjZSAtIHRoZSBzd2F0Y2gncyBib3JkZXIvZm9jdXMgcmluZyBhcmUgdGhlbWUgdG9rZW5zIHZpYSBDU1MuXHJcbmZ1bmN0aW9uIF9zd2F0Y2hCdXR0b24oY29sb3IpIHtcclxuICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBidG4udHlwZSA9ICdidXR0b24nO1xyXG4gIGJ0bi5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItc3dhdGNoJztcclxuICBidG4uZGF0YXNldC5jb2xvciA9IGNvbG9yO1xyXG4gIGJ0bi5zdHlsZS5iYWNrZ3JvdW5kID0gY29sb3I7XHJcbiAgYnRuLnRpdGxlID0gY29sb3I7XHJcbiAgYnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGNvbG9yKTtcclxuICByZXR1cm4gYnRuO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc3dhdGNoUm93KGNvbG9ycykge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcm93JztcclxuICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xyXG4gIGZvciAoY29uc3QgcmF3IG9mIGNvbG9ycykge1xyXG4gICAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KHJhdyk7XHJcbiAgICBpZiAoIWNvbG9yIHx8IHNlZW4uaGFzKGNvbG9yKSkgY29udGludWU7XHJcbiAgICBzZWVuLmFkZChjb2xvcik7XHJcbiAgICByb3cuYXBwZW5kQ2hpbGQoX3N3YXRjaEJ1dHRvbihjb2xvcikpO1xyXG4gIH1cclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc2VjdGlvbkxhYmVsKHRleHQpIHtcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1zZWN0aW9uLWxhYmVsJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9IHRleHQ7XHJcbiAgcmV0dXJuIGxhYmVsO1xyXG59XHJcblxyXG4vLyDilIDilIAgdXNlci1jdXJhdGVkIG5hbWVkIHBhbGV0dGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmZ1bmN0aW9uIF9wYWxldHRlRW50cmllcygpIHtcclxuICByZXR1cm4gX3JlYWRMaXN0KFBBTEVUVEVfS0VZKVxyXG4gICAgLmZpbHRlcihlID0+IGUgJiYgdHlwZW9mIGUubmFtZSA9PT0gJ3N0cmluZycgJiYgX25vcm1hbGl6ZUhleChlLmNvbG9yKSlcclxuICAgIC5tYXAoZSA9PiAoeyBuYW1lOiBlLm5hbWUsIGNvbG9yOiBfbm9ybWFsaXplSGV4KGUuY29sb3IpIH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3BhbGV0dGVJdGVtKG5hbWUsIGNvbG9yKSB7XHJcbiAgY29uc3QgaXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGl0ZW0uY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtaXRlbSc7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtbmFtZSc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSBuYW1lO1xyXG4gIGNvbnN0IHJlbW92ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIHJlbW92ZS50eXBlID0gJ2J1dHRvbic7XHJcbiAgcmVtb3ZlLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLXJlbW92ZSc7XHJcbiAgcmVtb3ZlLmRhdGFzZXQubmFtZSA9IG5hbWU7XHJcbiAgcmVtb3ZlLnRleHRDb250ZW50ID0gJ8OXJztcclxuICByZW1vdmUuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYFJlbW92ZSAke25hbWV9YCk7XHJcbiAgaXRlbS5hcHBlbmQoX3N3YXRjaEJ1dHRvbihjb2xvciksIGxhYmVsLCByZW1vdmUpO1xyXG4gIHJldHVybiBpdGVtO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRQYWxldHRlKGVudHJpZXMpIHtcclxuICBjb25zdCB3cmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgd3JhcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZSc7XHJcbiAgaWYgKCFlbnRyaWVzLmxlbmd0aCkge1xyXG4gICAgY29uc3QgaGludCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIGhpbnQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhpbnQnO1xyXG4gICAgaGludC50ZXh0Q29udGVudCA9ICdTYXZlIGEgY29sb3VyIGJlbG93IHRvIGJ1aWxkIHlvdXIgcGFsZXR0ZS4nO1xyXG4gICAgd3JhcC5hcHBlbmRDaGlsZChoaW50KTtcclxuICAgIHJldHVybiB3cmFwO1xyXG4gIH1cclxuICBlbnRyaWVzLmZvckVhY2goKHsgbmFtZSwgY29sb3IgfSkgPT4gd3JhcC5hcHBlbmRDaGlsZChfcGFsZXR0ZUl0ZW0obmFtZSwgY29sb3IpKSk7XHJcbiAgcmV0dXJuIHdyYXA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZEFkZFJvdygpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWFkZHJvdyc7XHJcbiAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gIGlucHV0LnR5cGUgPSAndGV4dCc7XHJcbiAgaW5wdXQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnbWF4bGVuZ3RoJywgJzQwJyk7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ05hbWUgZm9yIHRoZSBjdXJyZW50IGNvbG91cicpO1xyXG4gIGlucHV0LnBsYWNlaG9sZGVyID0gJ05hbWUgdGhpcyBjb2xvdXInO1xyXG4gIGNvbnN0IGFkZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGFkZC50eXBlID0gJ2J1dHRvbic7XHJcbiAgYWRkLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWFkZCc7XHJcbiAgYWRkLnRleHRDb250ZW50ID0gJ1NhdmUnO1xyXG4gIHJvdy5hcHBlbmQoaW5wdXQsIGFkZCk7XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuLy8gU2F2ZXMgdGhlIGNvbG91ciBjdXJyZW50bHkgaW4gdGhlIGhleCBmaWVsZCAoZmFsbGluZyBiYWNrIHRvIHRoZSBjb21taXR0ZWRcclxuLy8gdmFsdWUpIHVuZGVyIHRoZSB0eXBlZCBuYW1lLCBkZWZhdWx0aW5nIHRoZSBuYW1lIHRvIHRoZSBoZXggc3RyaW5nIGl0c2VsZi5cclxuZnVuY3Rpb24gX2FkZFBhbGV0dGVFbnRyeShjdHgpIHtcclxuICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgoY3R4LmhleEZpZWxkLnZhbHVlKSB8fCBfbm9ybWFsaXplSGV4KGN0eC5pbnB1dC52YWx1ZSk7XHJcbiAgaWYgKCFjb2xvcikgcmV0dXJuO1xyXG4gIGNvbnN0IG5hbWVJbnB1dCA9IGN0eC5wb3AucXVlcnlTZWxlY3RvcignLmNvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnKTtcclxuICBjb25zdCBuYW1lID0gKG5hbWVJbnB1dCAmJiBuYW1lSW5wdXQudmFsdWUudHJpbSgpKSB8fCBjb2xvcjtcclxuICBjb25zdCBuZXh0ID0gX3BhbGV0dGVFbnRyaWVzKCkuZmlsdGVyKGUgPT4gZS5uYW1lICE9PSBuYW1lKTtcclxuICBuZXh0LnB1c2goeyBuYW1lLCBjb2xvciB9KTtcclxuICBfd3JpdGVMaXN0KFBBTEVUVEVfS0VZLCBuZXh0KTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9yZW1vdmVQYWxldHRlRW50cnkoY3R4LCBuYW1lKSB7XHJcbiAgX3dyaXRlTGlzdChQQUxFVFRFX0tFWSwgX3BhbGV0dGVFbnRyaWVzKCkuZmlsdGVyKGUgPT4gZS5uYW1lICE9PSBuYW1lKSk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc3luY1RyaWdnZXIodHJpZ2dlciwgdmFsdWUpIHtcclxuICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgodmFsdWUpO1xyXG4gIHRyaWdnZXIuc3R5bGUuYmFja2dyb3VuZCA9IGNvbG9yIHx8ICd0cmFuc3BhcmVudCc7XHJcbiAgdHJpZ2dlci5jbGFzc0xpc3QudG9nZ2xlKCdpcy1lbXB0eScsICFjb2xvcik7XHJcbn1cclxuXHJcbi8vIEV2ZXJ5dGhpbmcgaW4gYSBwaWNrZXIgaW5zdGFuY2UgdGhlIGhhbmRsZXJzIG5lZWQgdG8gcmVhY2guXHJcbmZ1bmN0aW9uIF9tYWtlQ29udGV4dChpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCkge1xyXG4gIHJldHVybiB7IGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9jb21taXQoY3R4LCByYXdIZXgpIHtcclxuICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChyYXdIZXgpO1xyXG4gIGlmICghbm9ybSkgcmV0dXJuIGZhbHNlO1xyXG4gIGN0eC5pbnB1dC52YWx1ZSA9IG5vcm07XHJcbiAgLy8gaW5wdXQgZHJpdmVzIHRoZSBsaXZlLXByZXZpZXcgaGFuZGxlcnMgKHRpdGxlIGNhcmQncyBvbmlucHV0KTsgY2hhbmdlIGRyaXZlc1xyXG4gIC8vIHRoZSBzYXZlIGhhbmRsZXJzIChzcGVha2VyIGNoYW5nZS1kZWxlZ2F0aW9uKS4gVGhlIHRyaWdnZXIgcmUtc3luY3Mgb2ZmIHRoZVxyXG4gIC8vICdpbnB1dCcgbGlzdGVuZXIgd2lyZWQgaW4gYXR0YWNoKCkuXHJcbiAgY3R4LmlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgY3R4LmlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG4gIF9yZWNvcmRSZWNlbnQobm9ybSk7XHJcbiAgcmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbi8vIFJlYnVpbHQgZWFjaCB0aW1lIHRoZSBwb3BvdmVyIG9wZW5zIChhbmQgYWZ0ZXIgYSBwYWxldHRlIGFkZC9yZW1vdmUpIHNvIHRoZVxyXG4vLyByZWNlbnRseS11c2VkIHN0cmlwIGFuZCBzYXZlZCBwYWxldHRlIHJlZmxlY3QgdGhlIGxhdGVzdCBzdGF0ZS4gQWxsIG9mIGl0IGdvZXNcclxuLy8gaW4gb25lIGNvbnRhaW5lciB0aGF0IGlzIHJlcGxhY2VkIHdob2xlc2FsZSwgc28gbm90aGluZyBhY2N1bXVsYXRlcy5cclxuZnVuY3Rpb24gX3JlbmRlclN0cmlwcyhjdHgpIHtcclxuICBjb25zdCBzdGFsZSA9IGN0eC5wb3AucXVlcnlTZWxlY3RvcignLmNvbG9ycGlja2VyLWR5bmFtaWMnKTtcclxuICBpZiAoc3RhbGUpIHN0YWxlLnJlbW92ZSgpO1xyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnRhaW5lci5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItZHluYW1pYyc7XHJcbiAgY29uc3QgcmVjZW50ID0gX3JlYWRMaXN0KFJFQ0VOVF9LRVkpO1xyXG4gIGlmIChyZWNlbnQubGVuZ3RoKSB7XHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnUmVjZW50bHkgdXNlZCcpKTtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc3dhdGNoUm93KHJlY2VudCkpO1xyXG4gIH1cclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnWW91ciBwYWxldHRlJykpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfYnVpbGRQYWxldHRlKF9wYWxldHRlRW50cmllcygpKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9idWlsZEFkZFJvdygpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnQ29sb3VycycpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3N3YXRjaFJvdyhTVEFSVEVSX1NXQVRDSEVTKSk7XHJcbiAgY3R4LnBvcC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xyXG59XHJcblxyXG5sZXQgX29wZW5DdHggPSBudWxsOyAgLy8gdGhlIG9uZSBvcGVuIHBpY2tlciBjb250ZXh0LCBvciBudWxsXHJcblxyXG5mdW5jdGlvbiBfY2xvc2VQb3BvdmVyKHJlZm9jdXMpIHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgY29uc3QgeyBwb3AsIHRyaWdnZXIgfSA9IF9vcGVuQ3R4O1xyXG4gIHBvcC5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcclxuICBfb3BlbkN0eCA9IG51bGw7XHJcbiAgaWYgKHJlZm9jdXMpIHRyaWdnZXIuZm9jdXMoKTtcclxufVxyXG5cclxuLy8gVGhlIHBvcG92ZXIgaXMgYSBkaWFsb2csIHNvIFRhYiBtdXN0IG5vdCBmYWxsIHRocm91Z2ggdG8gdGhlIHBhZ2UgYmVoaW5kIGl0XHJcbi8vIChXQ0FHIDIuNC4zKS4gQ3ljbGUgZm9jdXMgYW1vbmcgdGhlIHBvcG92ZXIncyBvd24gY29udHJvbHM7IHRoZSB0cmlnZ2VyIHNpdHNcclxuLy8gb3V0c2lkZSB0aGUgcG9wb3ZlciBhbmQgaXMgaW50ZW50aW9uYWxseSBleGNsdWRlZCB3aGlsZSBpdCBpcyBvcGVuLlxyXG5mdW5jdGlvbiBfZm9jdXNhYmxlcyhwb3ApIHtcclxuICByZXR1cm4gQXJyYXkuZnJvbShwb3AucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uLCBpbnB1dCcpKS5maWx0ZXIoXHJcbiAgICBlbCA9PiAhZWwuZGlzYWJsZWQgJiYgZWwub2Zmc2V0UGFyZW50ICE9PSBudWxsLFxyXG4gICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF90cmFwRm9jdXMoZSkge1xyXG4gIGNvbnN0IGl0ZW1zID0gX2ZvY3VzYWJsZXMoX29wZW5DdHgucG9wKTtcclxuICBpZiAoIWl0ZW1zLmxlbmd0aCkgcmV0dXJuO1xyXG4gIGNvbnN0IGZpcnN0ID0gaXRlbXNbMF07XHJcbiAgY29uc3QgbGFzdCA9IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdO1xyXG4gIGNvbnN0IGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XHJcbiAgaWYgKCFfb3BlbkN0eC5wb3AuY29udGFpbnMoYWN0aXZlKSkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZmlyc3QuZm9jdXMoKTtcclxuICB9IGVsc2UgaWYgKGUuc2hpZnRLZXkgJiYgYWN0aXZlID09PSBmaXJzdCkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgbGFzdC5mb2N1cygpO1xyXG4gIH0gZWxzZSBpZiAoIWUuc2hpZnRLZXkgJiYgYWN0aXZlID09PSBsYXN0KSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBmaXJzdC5mb2N1cygpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gX29wZW5Qb3BvdmVyKGN0eCkge1xyXG4gIF9jbG9zZVBvcG92ZXIoKTtcclxuICBjdHguaGV4RmllbGQudmFsdWUgPSAoX25vcm1hbGl6ZUhleChjdHguaW5wdXQudmFsdWUpIHx8ICcnKS5yZXBsYWNlKCcjJywgJycpO1xyXG4gIGN0eC5oZXhGaWVsZC5jbGFzc0xpc3QucmVtb3ZlKCdpbnZhbGlkJyk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG4gIGN0eC5wb3AuY2xhc3NMaXN0LmFkZCgnb3BlbicpO1xyXG4gIGN0eC50cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XHJcbiAgX29wZW5DdHggPSBjdHg7XHJcbiAgY3R4LmhleEZpZWxkLmZvY3VzKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF93aXJlSGV4RmllbGQoY3R4KSB7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4ge1xyXG4gICAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgoY3R4LmhleEZpZWxkLnZhbHVlKTtcclxuICAgIGN0eC5oZXhGaWVsZC5jbGFzc0xpc3QudG9nZ2xlKCdpbnZhbGlkJywgIW5vcm0gJiYgY3R4LmhleEZpZWxkLnZhbHVlLnRyaW0oKSAhPT0gJycpO1xyXG4gICAgaWYgKG5vcm0pIF9zeW5jVHJpZ2dlcihjdHgudHJpZ2dlciwgbm9ybSk7ICAvLyBsaXZlIHByZXZpZXcsIG5vIGNvbW1pdCB5ZXRcclxuICB9KTtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4gX2NvbW1pdChjdHgsIGN0eC5oZXhGaWVsZC52YWx1ZSkpO1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgICBpZiAoZS5rZXkgIT09ICdFbnRlcicpIHJldHVybjtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChfY29tbWl0KGN0eCwgY3R4LmhleEZpZWxkLnZhbHVlKSkgX2Nsb3NlUG9wb3Zlcih0cnVlKTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkSGV4Um93KCkge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4cm93JztcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4aGFzaCc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSAnIyc7XHJcbiAgY29uc3QgZmllbGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gIGZpZWxkLnR5cGUgPSAndGV4dCc7XHJcbiAgZmllbGQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleGZpZWxkJztcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ21heGxlbmd0aCcsICc3Jyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdhdXRvY29tcGxldGUnLCAnb2ZmJyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hleCBjb2xvdXIgdmFsdWUnKTtcclxuICBmaWVsZC5wbGFjZWhvbGRlciA9ICdSUkdHQkInO1xyXG4gIHJvdy5hcHBlbmQobGFiZWwsIGZpZWxkKTtcclxuICByZXR1cm4geyByb3csIGZpZWxkIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGF0dGFjaChpbnB1dCkge1xyXG4gIGlmICghaW5wdXQgfHwgaW5wdXQuZGF0YXNldC5jcEF0dGFjaGVkKSByZXR1cm47XHJcbiAgaW5wdXQuZGF0YXNldC5jcEF0dGFjaGVkID0gJzEnO1xyXG4gIGNvbnN0IGluaXRpYWwgPSBfbm9ybWFsaXplSGV4KGlucHV0LnZhbHVlKSB8fCAnJztcclxuICBpbnB1dC50eXBlID0gJ2hpZGRlbic7XHJcbiAgaW5wdXQudmFsdWUgPSBpbml0aWFsO1xyXG5cclxuICBjb25zdCB3cmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIHdyYXAuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyJztcclxuICBpbnB1dC5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh3cmFwLCBpbnB1dCk7XHJcblxyXG4gIGNvbnN0IHRyaWdnZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICB0cmlnZ2VyLnR5cGUgPSAnYnV0dG9uJztcclxuICB0cmlnZ2VyLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci10cmlnZ2VyJztcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcsICd0cnVlJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDaG9vc2UgY29sb3VyJyk7XHJcblxyXG4gIGNvbnN0IHBvcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHBvcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcG9wJztcclxuICBwb3Auc2V0QXR0cmlidXRlKCdyb2xlJywgJ2RpYWxvZycpO1xyXG4gIHBvcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ29sb3VyIHBpY2tlcicpO1xyXG4gIGNvbnN0IHsgcm93OiBoZXhSb3csIGZpZWxkOiBoZXhGaWVsZCB9ID0gX2J1aWxkSGV4Um93KCk7XHJcbiAgcG9wLmFwcGVuZENoaWxkKGhleFJvdyk7XHJcblxyXG4gIHdyYXAuYXBwZW5kKHRyaWdnZXIsIGlucHV0LCBwb3ApO1xyXG4gIGNvbnN0IGN0eCA9IF9tYWtlQ29udGV4dChpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCk7XHJcblxyXG4gIF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCBpbnB1dC52YWx1ZSk7XHJcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiBfc3luY1RyaWdnZXIodHJpZ2dlciwgaW5wdXQudmFsdWUpKTtcclxuICB0cmlnZ2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoX29wZW5DdHggJiYgX29wZW5DdHgudHJpZ2dlciA9PT0gdHJpZ2dlcikgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gICAgZWxzZSBfb3BlblBvcG92ZXIoY3R4KTtcclxuICB9KTtcclxuICBwb3AuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICAgIGNvbnN0IHJlbW92ZUJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLXJlbW92ZScpO1xyXG4gICAgaWYgKHJlbW92ZUJ0bikgeyBfcmVtb3ZlUGFsZXR0ZUVudHJ5KGN0eCwgcmVtb3ZlQnRuLmRhdGFzZXQubmFtZSk7IHJldHVybjsgfVxyXG4gICAgaWYgKGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLWFkZCcpKSB7IF9hZGRQYWxldHRlRW50cnkoY3R4KTsgcmV0dXJuOyB9XHJcbiAgICBjb25zdCBzd2F0Y2ggPSBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItc3dhdGNoJyk7XHJcbiAgICBpZiAoIXN3YXRjaCkgcmV0dXJuO1xyXG4gICAgX2NvbW1pdChjdHgsIHN3YXRjaC5kYXRhc2V0LmNvbG9yKTtcclxuICAgIF9jbG9zZVBvcG92ZXIoKTtcclxuICB9KTtcclxuICBwb3AuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gICAgaWYgKGUua2V5ID09PSAnRW50ZXInICYmIGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLWlucHV0JykpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBfYWRkUGFsZXR0ZUVudHJ5KGN0eCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbiAgX3dpcmVIZXhGaWVsZChjdHgpO1xyXG59XHJcblxyXG4vLyBDbG9zZSB0aGUgb3BlbiBwb3BvdmVyIG9uIGFuIG91dHNpZGUgY2xpY2sgb3IgRXNjYXBlLiBSZWdpc3RlcmVkIG9uY2UuXHJcbi8vIEEgY2xpY2sgdGhhdCByZS1yZW5kZXJzIHRoZSBwb3BvdmVyIChTYXZlIC8gcmVtb3ZlIGEgcGFsZXR0ZSBlbnRyeSkgZGV0YWNoZXNcclxuLy8gaXRzIG93biB0YXJnZXQgYmVmb3JlIHRoaXMgYnViYmxpbmcgaGFuZGxlciBydW5zOyBzdWNoIGEgdGFyZ2V0IGlzIG5vIGxvbmdlciBpblxyXG4vLyB0aGUgZG9jdW1lbnQsIHNvIHNraXAgaXQgcmF0aGVyIHRoYW4gbWlzdGFraW5nIGl0IGZvciBhbiBvdXRzaWRlIGNsaWNrLlxyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBpZiAoIWRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyhlLnRhcmdldCkpIHJldHVybjtcclxuICBpZiAoIV9vcGVuQ3R4LnBvcC5wYXJlbnROb2RlLmNvbnRhaW5zKGUudGFyZ2V0KSkgX2Nsb3NlUG9wb3ZlcigpO1xyXG59KTtcclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7IF9jbG9zZVBvcG92ZXIodHJ1ZSk7IHJldHVybjsgfVxyXG4gIGlmIChlLmtleSA9PT0gJ1RhYicpIF90cmFwRm9jdXMoZSk7XHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IENvbG9yUGlja2VyID0geyBhdHRhY2gsIF9ub3JtYWxpemVIZXgsIFJFQ0VOVF9LRVksIFBBTEVUVEVfS0VZIH07XHJcbiIsICIvLyBJbmZyYXN0cnVjdHVyZSAtIFBhbmVsTmF2IHRha2VvdmVyIGZyYW1ld29yayAobm90IGEgZmVhdHVyZSBtb2R1bGUpLlxyXG4vLyAgIFVzZWQgYnk6IHNwbGl0LmpzLCBjbGlwY3JlYXRlLmpzLCBleHBvcnRlZGl0b3IuanMsIG5hbWVjb3JyZWN0aW9ucy5qcyDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9wYW5lbG5hdi5weVxyXG4vLyDilIDilIAgcGFuZWwgbmF2aWdhdGlvbiBmcmFtZXdvcmsg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIE11bHRpLXN0ZXAgZmxvd3MgKFNwbGl0IEVkaXRvciwgYW5kIGZ1dHVyZSBwaWNrZXJzKSB0YWtlIG92ZXIgdGhlIG1haW5cclxuLy8gZGV0YWlsIHBhbmVsIGluc3RlYWQgb2YgdXNpbmcgYSBtb2RhbDogc2hhcmVkIGJyZWFkY3J1bWIsIHNoYXJlZCBkaXJ0eS1zdGF0ZVxyXG4vLyBkaXNjYXJkIHByb21wdC4gRWFjaCBvcGVuIHBhbmVsIGdldHMgaXRzIG93biBjb250ZW50IGNvbnRhaW5lciBzbyBhIGZ1dHVyZVxyXG4vLyBuZXN0ZWQgcGFuZWwgKGUuZy4gbWFudWFsLWNsaXAncyBwaWNrZXIgb24gdG9wIG9mIGEgcmVjb3JkaW5nIHZpZXcpIGNhbiBiZVxyXG4vLyB1bndvdW5kIG9uZSBsZXZlbCBhdCBhIHRpbWUgd2l0aG91dCByZS1ydW5uaW5nIHRoZSBwYXJlbnQncyByZW5kZXIoKS5cclxuLy9cclxuLy8gVGhlIGNvbnRhaW5lciBpcyBkZXN0cm95ZWQgb24gY2xvc2UgcmlnaHQgYWZ0ZXIgb25DbG9zZSgpIHJ1bnMuIElmIHJlbmRlcigpXHJcbi8vIHJlcGFyZW50ZWQgYW4gZXhpc3Rpbmcgc3RhdGljIGVsZW1lbnQgKHJhdGhlciB0aGFuIGJ1aWxkaW5nIGZyZXNoIERPTSksXHJcbi8vIG9uQ2xvc2UoKSBtdXN0IG1vdmUgaXQgYmFjayBvdXQgdG8gYSBzdGFibGUsIGFsd2F5cy1pbi1kb2N1bWVudCBsb2NhdGlvbiAtXHJcbi8vIG90aGVyd2lzZSBpdCBnb2VzIHdpdGggdGhlIGNvbnRhaW5lciBhbmQgZ2V0RWxlbWVudEJ5SWQgY2FuJ3QgZmluZCBpdCBvblxyXG4vLyB0aGUgbmV4dCBvcGVuLiBTZWUgc3BsaXQuanMncyBfdGVhcmRvd25TcGxpdEVkaXRvciBmb3IgdGhlIHBhdHRlcm4uXHJcblxyXG5jb25zdCBfc3RhY2sgPSBbXTsgIC8vIFt7aWQsIHRpdGxlLCBpc0RpcnR5LCBvbkNsb3NlLCBjb250YWluZXJ9XVxyXG5cclxuZnVuY3Rpb24gX3Jvb3QoKSAgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtcm9vdCcpOyB9XHJcbmZ1bmN0aW9uIF9jcnVtYigpICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LWJyZWFkY3J1bWInKTsgfVxyXG5mdW5jdGlvbiBfbW91bnQoKSAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1jb250ZW50Jyk7IH1cclxuZnVuY3Rpb24gX3RvcCgpICAgICB7IHJldHVybiBfc3RhY2tbX3N0YWNrLmxlbmd0aCAtIDFdIHx8IG51bGw7IH1cclxuXHJcbmZ1bmN0aW9uIF9yZW5kZXJCcmVhZGNydW1iKCkge1xyXG4gIGNvbnN0IHRvcCA9IF90b3AoKTtcclxuICBjb25zdCBjcnVtYiA9IF9jcnVtYigpO1xyXG4gIGNydW1iLmlubmVySFRNTCA9ICcnO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgY29uc3QgYmFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGJhY2sudHlwZSA9ICdidXR0b24nO1xyXG4gIGJhY2suY2xhc3NOYW1lID0gJ2J0biBnaG9zdCc7XHJcbiAgYmFjay5zdHlsZS5jc3NUZXh0ID0gJ3BhZGRpbmc6NHB4IDEwcHg7Zm9udC1zaXplOjEzcHgnO1xyXG4gIGJhY2sudGV4dENvbnRlbnQgPSAn4oaQIEJhY2snO1xyXG4gIGJhY2sub25jbGljayA9ICgpID0+IHBhbmVsTmF2Q2xvc2UoKTtcclxuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB0aXRsZS5zdHlsZS5jc3NUZXh0ID0gJ2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjYwMCc7XHJcbiAgdGl0bGUudGV4dENvbnRlbnQgPSB0b3AudGl0bGU7XHJcbiAgY3J1bWIuYXBwZW5kKGJhY2ssIHRpdGxlKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3VwZGF0ZVZpc2liaWxpdHkoKSB7XHJcbiAgX3N0YWNrLmZvckVhY2goKGVudHJ5LCBpKSA9PiB7XHJcbiAgICBlbnRyeS5jb250YWluZXIuc3R5bGUuZGlzcGxheSA9IGkgPT09IF9zdGFjay5sZW5ndGggLSAxID8gJ2ZsZXgnIDogJ25vbmUnO1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdk9wZW4oeyBpZCwgdGl0bGUsIHJlbmRlciwgaXNEaXJ0eSwgb25DbG9zZSB9KSB7XHJcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgY29udGFpbmVyLmRhdGFzZXQucGFuZWxJZCA9IGlkO1xyXG4gIGNvbnRhaW5lci5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjE2cHgnO1xyXG4gIF9tb3VudCgpLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcbiAgX3N0YWNrLnB1c2goe1xyXG4gICAgaWQsXHJcbiAgICB0aXRsZSxcclxuICAgIGlzRGlydHk6IGlzRGlydHkgfHwgKCgpID0+IGZhbHNlKSxcclxuICAgIG9uQ2xvc2U6IG9uQ2xvc2UgfHwgKCgpID0+IHt9KSxcclxuICAgIGNvbnRhaW5lcixcclxuICB9KTtcclxuICBfcm9vdCgpLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XHJcbiAgX3VwZGF0ZVZpc2liaWxpdHkoKTtcclxuICBfcmVuZGVyQnJlYWRjcnVtYigpO1xyXG4gIHJlbmRlcihjb250YWluZXIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfY2xvc2VUb3AoKSB7XHJcbiAgY29uc3QgdG9wID0gX3N0YWNrLnBvcCgpO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgdG9wLm9uQ2xvc2UoKTtcclxuICB0b3AuY29udGFpbmVyLnJlbW92ZSgpO1xyXG4gIGlmIChfc3RhY2subGVuZ3RoID09PSAwKSB7XHJcbiAgICBfcm9vdCgpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgfSBlbHNlIHtcclxuICAgIF91cGRhdGVWaXNpYmlsaXR5KCk7XHJcbiAgICBfcmVuZGVyQnJlYWRjcnVtYigpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZDbG9zZSgpIHtcclxuICBjb25zdCB0b3AgPSBfdG9wKCk7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICBpZiAodG9wLmlzRGlydHkoKSkge1xyXG4gICAgd2luZG93LnNob3dDb25maXJtKFxyXG4gICAgICAnRGlzY2FyZCBjaGFuZ2VzPycsXHJcbiAgICAgICdZb3UgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuIENsb3NlIHdpdGhvdXQgc2F2aW5nPycsXHJcbiAgICAgICdEaXNjYXJkJyxcclxuICAgICAgX2Nsb3NlVG9wLFxyXG4gICAgICB0cnVlLFxyXG4gICAgKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgX2Nsb3NlVG9wKCk7XHJcbn1cclxuXHJcbi8vIEZvcmNlLWNsb3NlIHRoZSB0b3Btb3N0IHBhbmVsLCBieXBhc3NpbmcgdGhlIGRpcnR5IGdhdGUgLSBmb3IgY2FsbGVycyB0aGF0XHJcbi8vIGhhdmUgYWxyZWFkeSBjb25maXJtZWQgdGhlIGRpc2NhcmQgdGhyb3VnaCB0aGVpciBvd24gKGRpZmZlcmVudGx5IHdvcmRlZClcclxuLy8gcHJvbXB0LCBlLmcuIHN3aXRjaGluZyByZWNvcmRpbmdzIHdoaWxlIHRoZSBTcGxpdCBFZGl0b3IgaXMgZGlydHkuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2Rm9yY2VDbG9zZSgpIHtcclxuICBfY2xvc2VUb3AoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZJc09wZW4oaWQpIHtcclxuICBpZiAoaWQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIF9zdGFjay5sZW5ndGggPiAwO1xyXG4gIHJldHVybiBfc3RhY2suc29tZShlbnRyeSA9PiBlbnRyeS5pZCA9PT0gaWQpO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgUGFuZWxOYXYgPSB7XHJcbiAgb3BlbjogcGFuZWxOYXZPcGVuLCBjbG9zZTogcGFuZWxOYXZDbG9zZSwgZm9yY2VDbG9zZTogcGFuZWxOYXZGb3JjZUNsb3NlLCBpc09wZW46IHBhbmVsTmF2SXNPcGVuLFxyXG59O1xyXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBMb25nLXJ1bm5pbmctam9iIG1hY2hpbmVyeTogdGhlIGpvYi1zdGF0dXMgaGVhZGVyIChzdGVwIHBpbGxzLCB0aW1lciwgRVRBKSwgdGhlXG4vLyAgIHBhdXNlL3Jlc3VtZSArIHRoZXJtYWwgYXV0by1wYXVzZSBVSSwgdGhlIGZldGNoLWJhc2VkIFNTRSB0cmFuc3BvcnQgKF9vcGVuU1NFL3N0cmVhbVNTRSksIHRoZVxuLy8gICBzaW5nbGUtYWN0aXZlLXN0cmVhbSBzdXBlcnNlZGUgY29udHJhY3QsIGFuZCB0aGUgc2hhcmVkIENhbmNlbCBidXR0b24uXG4vLyAgIEFQSTogcm91dGVzL2FuYWx5emUucHksIHJvdXRlcy9zY29yaW5nLnB5IChTU0UgZW5kcG9pbnRzKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV91dGlscy5weSwgdGVzdHMvdWkvdGVzdF91aV9zc2UucHlcbmltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBlc2NIdG1sLCBmb3JtYXRBcGlFcnJvciwgX2ZtdEVsYXBzZWQgfSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5cbi8vIOKUgOKUgCBzaGFyZWQgbGl2ZSBqb2ItcmVuZGVyIHN0YXRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUmVhZCBjcm9zcy1maWxlIGJ5IHZpZGVvcy5qcydzIGNvbXBhY3Qgc3RlcCBzdHJpcCAoYmFyZSBpZGVudGlmaWVycyBfam9iU3RlcERlZnMsXG4vLyBfYWN0aXZlU3RlcElkeCwgX2pvYlN0YXJ0VGltZSkgYW5kIGJ5IHRoZSBQbGF5d3JpZ2h0IFVJLXRlc3Qgc3VpdGUsIHdoaWNoIHNlZWRzXG4vLyBzZXZlcmFsIG9mIHRoZXNlIGRpcmVjdGx5IHZpYSBwYWdlLmV2YWx1YXRlLiBCb3RoIHNpZGVzIGFyZSBjbGFzc2ljLCBub24tbW9kdWxlXG4vLyBjb2RlLCBzbyB0aGV5IGNhbiBvbmx5IGV2ZXIgcmVhY2ggdGhlc2UgYXMgYHdpbmRvd2AgcHJvcGVydGllcyAtIG5ldmVyIHZpYSBhbiBFU01cbi8vIGltcG9ydC4gQSBvbmUtc2hvdCBgd2luZG93LlggPSBYYCBzbmFwc2hvdCB3b3VsZCBnbyBzdGFsZSB0aGUgaW5zdGFudCBqb2JzLmpzXG4vLyByZWFzc2lnbnMgWCwgc28gZWFjaCBuYW1lIGdldHMgYSBsaXZlIGdldC9zZXQgYnJpZGdlIG9udG8gYHdpbmRvd2AgYmVsb3cgaW5zdGVhZFxuLy8gb2YgYSBwbGFpbiBPYmplY3QuYXNzaWduIGV4cG9ydC5cbmxldCBfam9iU3RlcERlZnMgICA9IFtdO1xubGV0IF9hY3RpdmVFUyAgICAgID0gbnVsbDtcbmxldCBfam9iU3RhcnRUaW1lICA9IDA7XG5sZXQgX2FjdGl2ZVN0ZXBJZHggPSAtMTtcblxuLy8gUGVyLXN0ZXAgcHJvZ3Jlc3MgYWNjb3VudGluZyBmb3IgdGhlIHN0ZXAtcGlsbCBFVEEgaGV1cmlzdGljLiBOb3QgcmVhZCBieSBvdGhlclxuLy8gcHJvZHVjdGlvbiBtb2R1bGVzLCBidXQgdGhlIHN0ZXAtcGlsbCAvIEVUQSAvIGxpdmUtcGFuZWwgdGVzdHMgc2VlZCB0aGVtIGRpcmVjdGx5XG4vLyB2aWEgcGFnZS5ldmFsdWF0ZSwgc28gdGhleSBuZWVkIHRoZSBzYW1lIHdpbmRvdyBicmlkZ2UgYXMgdGhlIGJsb2NrIGFib3ZlLlxubGV0IF9zdGVwU3RhcnRUaW1lID0gMDtcbmxldCBfc3RlcFByb2dyZXNzICA9IHt9OyAvLyBzdGVwSWR4IC0+IHtjdXJyZW50LCB0b3RhbH0sIGNsZWFyZWQgcGVyIGpvYlxubGV0IF9zdGVwUmF0ZUFuY2hvciA9IHt9OyAvLyBzdGVwSWR4IC0+IHt0LCBjdXJyZW50fSBhdCBmaXJzdCBvYnNlcnZlZCBjb3VudCwgY2xlYXJlZCBwZXIgam9iXG5cbmZvciAoY29uc3QgW25hbWUsIGdldCwgc2V0XSBvZiBbXG4gIFsnX2pvYlN0ZXBEZWZzJywgICAgKCkgPT4gX2pvYlN0ZXBEZWZzLCAgICB2ID0+IHsgX2pvYlN0ZXBEZWZzID0gdjsgfV0sXG4gIFsnX2FjdGl2ZUVTJywgICAgICAgKCkgPT4gX2FjdGl2ZUVTLCAgICAgICB2ID0+IHsgX2FjdGl2ZUVTID0gdjsgfV0sXG4gIFsnX2pvYlN0YXJ0VGltZScsICAgKCkgPT4gX2pvYlN0YXJ0VGltZSwgICB2ID0+IHsgX2pvYlN0YXJ0VGltZSA9IHY7IH1dLFxuICBbJ19hY3RpdmVTdGVwSWR4JywgICgpID0+IF9hY3RpdmVTdGVwSWR4LCAgdiA9PiB7IF9hY3RpdmVTdGVwSWR4ID0gdjsgfV0sXG4gIFsnX3N0ZXBTdGFydFRpbWUnLCAgKCkgPT4gX3N0ZXBTdGFydFRpbWUsICB2ID0+IHsgX3N0ZXBTdGFydFRpbWUgPSB2OyB9XSxcbiAgWydfc3RlcFByb2dyZXNzJywgICAoKSA9PiBfc3RlcFByb2dyZXNzLCAgIHYgPT4geyBfc3RlcFByb2dyZXNzID0gdjsgfV0sXG4gIFsnX3N0ZXBSYXRlQW5jaG9yJywgKCkgPT4gX3N0ZXBSYXRlQW5jaG9yLCB2ID0+IHsgX3N0ZXBSYXRlQW5jaG9yID0gdjsgfV0sXG5dKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh3aW5kb3csIG5hbWUsIHtnZXQsIHNldCwgY29uZmlndXJhYmxlOiB0cnVlfSk7XG59XG5cbi8vIOKUgOKUgCBwcm9ncmVzcyBpbmRpY2F0b3Ig4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBlc3RNYXRjaDogc3Vic3RyaW5ncyB0aGF0IG1hcCB0aGlzIHBpbGwgdG8gYSBzdGVwIG5hbWUgZnJvbSAvYXBpL2VzdGltYXRlLCBzb1xuLy8gdGhlIHByb2dyZXNzIHBpbGwgY2FuIHNob3cgaXRzIHByZS1ydW4gdGltZSBlc3RpbWF0ZSBhcyBhIGhvdmVyIHRvb2x0aXAuXG4vLyBwcm9ncmVzc1BhdHRlcm46IHJlZ2V4IHdpdGggdHdvIGNhcHR1cmUgZ3JvdXBzIChjdXJyZW50LCB0b3RhbCkgbWF0Y2hlZFxuLy8gYWdhaW5zdCBpbmNvbWluZyBsb2cgbGluZXMgd2hpbGUgdGhpcyBzdGVwIGlzIGFjdGl2ZSwgc28gdGhlIHBpbGwgY2FuIHNob3dcbi8vIFwiMy8xMiAoMjUlKVwiIGFuZCBhIGxpdmUgRVRBIGluc3RlYWQgb2YganVzdCBlbGFwc2VkIHRpbWUuXG4vLyBzdGFnZTogdGhlIG1hY2hpbmUtcmVhZGFibGUgaWQgZnJvbSB0aGUgQEBQUk9HUkVTUyBtYXJrZXIgKHl1dV9jbGlwL3BpcGVsaW5lL1xuLy8gcHJvZ3Jlc3MucHkgU3RhZ2UpLiBUaGUgbWFya2VyIGRyaXZlcyB0aGUgcGlsbCBkZXRlcm1pbmlzdGljYWxseTsgdGhlIHBhdHRlcm5zL1xuLy8gcHJvZ3Jlc3NQYXR0ZXJuIHJlZ2V4ZXMgYmVsb3cgc3RheSBhcyBhIG9uZS1yZWxlYXNlIGZhbGxiYWNrIGZvciB0aGUgaHVtYW4gbG9nXG4vLyBsaW5lcy4gVGhlIHN0YWdlIHNldCBoZXJlIGlzIGNvdXBsaW5nLWd1YXJkZWQgYWdhaW5zdCBwcm9ncmVzcy5weSBieVxuLy8gdGVzdHMvdW5pdC90ZXN0X3Byb2dyZXNzX3N0YWdlX2NvdXBsaW5nLnB5LlxuY29uc3QgSU5HRVNUX1NURVBTID0gW1xuICB7bGFiZWw6ICdFeHRyYWN0JywgICAgICAgIHN0YWdlOiAnZXh0cmFjdCcsICAgICAgICBwYXR0ZXJuczogWydFeHRyYWN0aW5nIGF1ZGlvJ10sICAgICAgZXN0TWF0Y2g6IFsnZXh0cmFjdCBhdWRpbyddLCAgcHJvZ3Jlc3NQYXR0ZXJuOiAvVHJhY2sgKFxcZCspXFwvKFxcZCspL30sXG4gIHtsYWJlbDogJ1RyYW5zY3JpYmUnLCAgICAgc3RhZ2U6ICd0cmFuc2NyaWJlJywgICAgIHBhdHRlcm5zOiBbJ1RyYW5zY3JpYmluZyddLCAgICAgICAgICBlc3RNYXRjaDogWyd0cmFuc2NyaWJlJywgJ2xvYWQgY2FwdGlvbnMnXSwgcHJvZ3Jlc3NQYXR0ZXJuOiAvVHJhY2sgKFxcZCspXFwvKFxcZCspLywgd2FpdFBhdHRlcm46IC9XYWl0aW5nIGZvciB0aGUgc3BlZWNoLXRvLXRleHQgbW9kZWwvfSxcbiAge2xhYmVsOiAnU3BlYWtlcnMnLCAgICAgICBzdGFnZTogJ3NwZWFrZXJzJywgICAgICAgcGF0dGVybnM6IFsnRGV0ZWN0aW5nIHNwZWFrZXJzJ10sICAgIGVzdE1hdGNoOiBbJ3NwZWFrZXIgbGFiZWxzJ119LFxuICB7bGFiZWw6ICdHZW5lcmF0ZSBDbGlwcycsIHN0YWdlOiAnZ2VuZXJhdGVfY2xpcHMnLCBwYXR0ZXJuczogWydHZW5lcmF0aW5nIGNsaXAnXX0sXG4gIHtsYWJlbDogJ0VuZXJneScsICAgICAgICAgc3RhZ2U6ICdlbmVyZ3knLCAgICAgICAgIHBhdHRlcm5zOiBbJ0NvbXB1dGluZyBhdWRpbyBlbmVyZ3knXSwgZXN0TWF0Y2g6IFsnYXVkaW8gZW5lcmd5J119LFxuICB7bGFiZWw6ICdTY2VuZXMnLCAgICAgICAgIHN0YWdlOiAnc2NlbmVzJywgICAgICAgICBwYXR0ZXJuczogWydEZXRlY3Rpbmcgc2NlbmUnXSwgICAgICAgZXN0TWF0Y2g6IFsnc2NlbmUgZGV0ZWN0aW9uJ119LFxuICB7bGFiZWw6ICdTY29yZScsICAgICAgICAgIHN0YWdlOiAnc2NvcmUnLCAgICAgICAgICBwYXR0ZXJuczogWydTY29yaW5nIGNsaXBzJ10sICAgICAgICAgZXN0TWF0Y2g6IFsnbGxtIHNjb3JpbmcnXSwgcHJvZ3Jlc3NQYXR0ZXJuOiAvU2NvcmluZyAoXFxkKylcXC8oXFxkKykvfSxcbl07XG5jb25zdCBTQ09SRV9TVEVQUyA9IFtcbiAge2xhYmVsOiAnRW5lcmd5JywgIHN0YWdlOiAnZW5lcmd5JywgcGF0dGVybnM6IFsnQ29tcHV0aW5nIGF1ZGlvIGVuZXJneSddfSxcbiAge2xhYmVsOiAnU2NlbmVzJywgIHN0YWdlOiAnc2NlbmVzJywgcGF0dGVybnM6IFsnRGV0ZWN0aW5nIHNjZW5lJ119LFxuICB7bGFiZWw6ICdTY29yaW5nJywgc3RhZ2U6ICdzY29yZScsICBwYXR0ZXJuczogWydTY29yaW5nIGNsaXBzJ10sIHByb2dyZXNzUGF0dGVybjogL1Njb3JpbmcgKFxcZCspXFwvKFxcZCspL30sXG5dO1xuLy8gTWFya2VyLWRyaXZlbiBvbmx5ICh0aGUgYW5hbHl6ZS1mcmFtZXMgU1NFIGVtaXRzIG5vIHByb3NlIHN0YWdlIGxpbmVzKSwgc28gdGhlc2Vcbi8vIGNhcnJ5IG5vIHBhdHRlcm5zIC0ganVzdCB0aGUgdHdvIEBAUFJPR1JFU1Mgc3RhZ2VzIHRoZSB2aXNpb24gcm91dGUgZW1pdHMuXG5jb25zdCBGUkFNRVNfU1RFUFMgPSBbXG4gIHtsYWJlbDogJ1NhbXBsZScsICAgc3RhZ2U6ICdmcmFtZXNfc2FtcGxlJywgICBwYXR0ZXJuczogW119LFxuICB7bGFiZWw6ICdEZXNjcmliZScsIHN0YWdlOiAnZnJhbWVzX2Rlc2NyaWJlJywgcGF0dGVybnM6IFtdfSxcbl07XG5cbi8vIFRoZSBmdWxsIHNldCBvZiBrbm93biBAQFBST0dSRVNTIHN0YWdlIGlkcyAtIHRoZSBKUyBtaXJyb3Igb2YgcHJvZ3Jlc3MucHknc1xuLy8gU3RhZ2UgZW51bS4gZnJhbWVzX3NhbXBsZS9mcmFtZXNfZGVzY3JpYmUgZHJpdmUgdGhlIGFuYWx5emUtZnJhbWVzIGpvYi4gS2VwdFxuLy8gYXMgaXRzIG93biBzZXQgKG5vdCBkZXJpdmVkIGZyb20gdGhlIHN0ZXAgZGVmcykgc28gaXQgc3RheXMgdGhlIGNvdXBsaW5nXG4vLyBhbmNob3IgZXZlbiBmb3Igc3RhZ2VzIHdob3NlIHN0ZXAgZGVmIGxpdmVzIGVsc2V3aGVyZS5cbmNvbnN0IF9QUk9HUkVTU19QUkVGSVggPSAnQEBQUk9HUkVTUyAnO1xuY29uc3QgSk9CX1NUQUdFUyA9IG5ldyBTZXQoW1xuICAnZXh0cmFjdCcsICd0cmFuc2NyaWJlJywgJ3NwZWFrZXJzJywgJ2dlbmVyYXRlX2NsaXBzJyxcbiAgJ2VuZXJneScsICdzY2VuZXMnLCAnc2NvcmUnLCAnZnJhbWVzX3NhbXBsZScsICdmcmFtZXNfZGVzY3JpYmUnLFxuXSk7XG5cbi8vIE1pcnJvciBvZiBwcm9ncmVzcy5weSBwYXJzZV9wcm9ncmVzczogcmV0dXJucyB0aGUgbWFya2VyIHBheWxvYWQsIG9yIG51bGwgZm9yXG4vLyBhbnkgbm9uLW1hcmtlciAvIG1hbGZvcm1lZCAvIHVua25vd24tc3RhZ2UgbGluZSAoc28gb3JkaW5hcnkgbG9nIG91dHB1dCBmYWxsc1xuLy8gdGhyb3VnaCB0byB0aGUgcHJvc2UgZmFsbGJhY2sgcmF0aGVyIHRoYW4gYmVpbmcgbWlzcmVhZCBhcyBwcm9ncmVzcykuXG5mdW5jdGlvbiBwYXJzZVByb2dyZXNzKGxpbmUpIHtcbiAgaWYgKCFsaW5lIHx8ICFsaW5lLnN0YXJ0c1dpdGgoX1BST0dSRVNTX1BSRUZJWCkpIHJldHVybiBudWxsO1xuICBsZXQgcGF5bG9hZDtcbiAgdHJ5IHsgcGF5bG9hZCA9IEpTT04ucGFyc2UobGluZS5zbGljZShfUFJPR1JFU1NfUFJFRklYLmxlbmd0aCkpOyB9XG4gIGNhdGNoIChlKSB7IHJldHVybiBudWxsOyB9XG4gIGlmICghcGF5bG9hZCB8fCB0eXBlb2YgcGF5bG9hZCAhPT0gJ29iamVjdCcgfHwgIUpPQl9TVEFHRVMuaGFzKHBheWxvYWQuc3RhZ2UpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHBheWxvYWQ7XG59XG5cbi8vIHN0ZXBJZHggLT4gYSB0cmFuc2llbnQgc3RhdHVzIG1lc3NhZ2Ugc2hvd24gaW4gcGxhY2Ugb2YgdGhlIHN0ZXAncyB0aW1pbmdcbi8vIGxhYmVsIChlLmcuIFwid2FpdGluZyBmb3IgdGhlIHNwZWVjaCBtb2RlbCB0byBmaW5pc2ggZG93bmxvYWRpbmdcIikuIFNldCB3aGVuIGFcbi8vIHN0ZXAncyB3YWl0UGF0dGVybiBtYXRjaGVzLCBjbGVhcmVkIHdoZW4gdGhhdCBzdGVwIHJlcG9ydHMgcmVhbCBwcm9ncmVzcy5cbmxldCBfc3RlcFdhaXRpbmdNc2cgPSB7fTtcbmxldCBfam9iQWN0aXZlICAgICA9IGZhbHNlO1xubGV0IF9hY3RpdmVKb2JDbGVhbnVwID0gbnVsbDtcbmxldCBfam9iVGltZXIgICAgICA9IG51bGw7XG5sZXQgX2pvYkhpZGVUaW1lciAgPSBudWxsO1xubGV0IF9qb2JQYXVzYWJsZSAgID0gZmFsc2U7XG5sZXQgX2pvYlBhdXNlZCAgICAgPSBmYWxzZTtcbmxldCBfam9iVGhlcm1hbFBvbGxUaW1lciA9IG51bGw7XG5sZXQgX2xhc3RHcHVTdGF0ZSAgPSAndW5hdmFpbGFibGUnO1xuXG4vLyBCZXN0LWVmZm9ydCBsb29rdXAgb2YgYSBwaWxsJ3MgcHJlLXJ1biB0aW1lIGVzdGltYXRlIChmcm9tIHRoZSBsYXN0XG4vLyAvYXBpL2VzdGltYXRlIGNhbGwsIHNhdmVkIGJ5IHJlbmRlckVzdGltYXRlKSBmb3IgdXNlIGFzIGEgaG92ZXIgdG9vbHRpcC5cbmZ1bmN0aW9uIF9lc3RpbWF0ZUhtc0ZvcihzdGVwRGVmKSB7XG4gIGNvbnN0IHN0ZXBzID0gQXBwU3RhdGUubGFzdEVzdGltYXRlU3RlcHM7XG4gIGlmICghc3RlcHMgfHwgIXN0ZXBEZWYuZXN0TWF0Y2gpIHJldHVybiBudWxsO1xuICBjb25zdCBtYXRjaCA9IHN0ZXBzLmZpbmQoZXMgPT5cbiAgICBzdGVwRGVmLmVzdE1hdGNoLnNvbWUoa2V5ID0+IChlcy5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGtleSkpXG4gICk7XG4gIHJldHVybiBtYXRjaCA/IG1hdGNoLmhtcyA6IG51bGw7XG59XG5cbi8vIFBlci1pdGVtIGJ1dHRvbnMgdGhhdCB0cmlnZ2VyIGEgaGVhdnkgb3AgYXJlIHRhZ2dlZCBkYXRhLWpvYi1ibG9ja2VkLiBEaXNhYmxlXG4vLyB0aGVtICh3aXRoIGEgd2h5LXRvb2x0aXApIHdoaWxlIGFueSBqb2IgcnVucyBzbyBhIHVzZXIgY2FuJ3Qgc3RhcnQgYSBzZWNvbmQgam9iXG4vLyB0aGUgYmFja2VuZCB3b3VsZCBqdXN0IDQwOS4gVGhlIGhlYWRlciAjYnRuLWFuYWx5emUgaXMgaGFuZGxlZCBpbmxpbmUgYmVsb3cuXG4vLyByZW5kZXJEZXRhaWwgY2FsbHMgYXBwbHlKb2JCbG9ja2VkU3RhdGUoKSBzbyBhIHBhbmVsIHJlYnVpbHQgbWlkLWpvYiBjb21lcyB1cFxuLy8gYWxyZWFkeSBkaXNhYmxlZCAtIHRoZSB0YWcgbGl2ZXMgaW4gZnJlc2hseS1idWlsdCBpbm5lckhUTUwsIG5vdCBhIGxpdmUgbm9kZS5cbmZ1bmN0aW9uIF9zZXRKb2JCbG9ja2VkQnV0dG9ucyhkaXNhYmxlZCkge1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1qb2ItYmxvY2tlZF0nKS5mb3JFYWNoKGIgPT4ge1xuICAgIGIuZGlzYWJsZWQgPSBkaXNhYmxlZDtcbiAgICBiLnRpdGxlID0gZGlzYWJsZWQgPyAnQW5vdGhlciBqb2IgaXMgcnVubmluZyAtIHdhaXQgZm9yIGl0IHRvIGZpbmlzaCBvciBjYW5jZWwgaXQnIDogJyc7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhcHBseUpvYkJsb2NrZWRTdGF0ZSgpIHsgX3NldEpvYkJsb2NrZWRCdXR0b25zKF9qb2JBY3RpdmUpOyB9XG5cbmZ1bmN0aW9uIHN0YXJ0Sm9iVUkoc3RlcERlZnMsIGpvYkxhYmVsLCBjYW5jZWxsYWJsZSA9IGZhbHNlLCBwYXVzYWJsZSA9IGZhbHNlKSB7XG4gIF9qb2JBY3RpdmUgICAgID0gdHJ1ZTtcbiAgX2pvYlN0ZXBEZWZzICAgPSBzdGVwRGVmcztcbiAgX2FjdGl2ZVN0ZXBJZHggPSAtMTtcbiAgX2pvYlN0YXJ0VGltZSAgPSBEYXRlLm5vdygpO1xuICBfc3RlcFN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gIF9zdGVwUHJvZ3Jlc3MgID0ge307XG4gIF9zdGVwUmF0ZUFuY2hvciA9IHt9O1xuICBfc3RlcFdhaXRpbmdNc2cgPSB7fTtcbiAgX2pvYlBhdXNhYmxlICAgPSBwYXVzYWJsZTtcbiAgX2pvYlBhdXNlZCAgICAgPSBmYWxzZTtcbiAgX2FjdGl2ZUNhbmNlbCAgPSBfQU5BTFlaRV9DQU5DRUw7XG4gIGlmIChfam9iVGltZXIpIGNsZWFySW50ZXJ2YWwoX2pvYlRpbWVyKTtcbiAgX2pvYlRpbWVyID0gc2V0SW50ZXJ2YWwoX3RpY2tKb2JUaW1lciwgMTAwMCk7XG4gIGlmIChfam9iSGlkZVRpbWVyKSB7IGNsZWFyVGltZW91dChfam9iSGlkZVRpbWVyKTsgX2pvYkhpZGVUaW1lciA9IG51bGw7IH1cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1zdGVwcycpLmlubmVySFRNTCA9XG4gICAgYDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi1yaWdodDo0cHhcIj4ke2VzY0h0bWwoam9iTGFiZWwpfTwvc3Bhbj5gICtcbiAgICBzdGVwRGVmcy5tYXAoKHMsIGkpID0+IHtcbiAgICAgIGNvbnN0IGVzdCA9IF9lc3RpbWF0ZUhtc0ZvcihzKTtcbiAgICAgIGNvbnN0IHRpdGxlID0gZXN0ID8gYCB0aXRsZT1cIkVzdGltYXRlZDogJHtlc2NIdG1sKGVzdCl9XCJgIDogJyc7XG4gICAgICByZXR1cm4gYDxzcGFuIGNsYXNzPVwic3RlcFwiIGlkPVwic3RlcC0ke2l9XCIke3RpdGxlfT4ke3MubGFiZWx9PC9zcGFuPmA7XG4gICAgfSkuam9pbignJyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2Itc3RhdHVzJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVhZGVyLXNwYWNlcicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyNidG4tYW5hbHl6ZSwjYnRuLXNjb3JlJykuZm9yRWFjaChiID0+IGIuZGlzYWJsZWQgPSB0cnVlKTtcbiAgY29uc3QgYW5hbHl6ZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tYW5hbHl6ZScpO1xuICBpZiAoYW5hbHl6ZUJ0bikgYW5hbHl6ZUJ0bi50aXRsZSA9ICdBIGpvYiBpcyBhbHJlYWR5IHJ1bm5pbmcnO1xuICBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnModHJ1ZSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2FuY2VsLWpvYicpLnN0eWxlLmRpc3BsYXkgPSBjYW5jZWxsYWJsZSA/ICcnIDogJ25vbmUnO1xuICBfcmVuZGVyUGF1c2VVSSgpO1xuICBpZiAoX2pvYlRoZXJtYWxQb2xsVGltZXIpIGNsZWFySW50ZXJ2YWwoX2pvYlRoZXJtYWxQb2xsVGltZXIpO1xuICBpZiAocGF1c2FibGUpIHtcbiAgICBfbGFzdEdwdVN0YXRlID0gJ3VuYXZhaWxhYmxlJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWdwdS10ZW1wJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBfcG9sbFRoZXJtYWxTdGF0dXMoKTtcbiAgICBfam9iVGhlcm1hbFBvbGxUaW1lciA9IHNldEludGVydmFsKF9wb2xsVGhlcm1hbFN0YXR1cywgNTAwMCk7XG4gIH1cbiAgaWYgKHdpbmRvdy5fcmVuZGVyQ2xpcEZpbHRlckNvdW50cykgX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMoKTtcbn1cblxuLy8gUG9sbGVkIGV2ZXJ5IDVzIChvbmx5IHdoaWxlIGEgcGF1c2FibGUgLSBpLmUuIGFuYWx5emUtdHlwZSAtIGpvYiBpcyBhY3RpdmUpIHRvXG4vLyBkcml2ZSB0aGUgam9iLWhlYWRlciBHUFUgdGVtcGVyYXR1cmUgcmVhZG91dCBhbmQgdGhlIHdhcm4vYXV0by1wYXVzZSBub3RpY2VzLlxuLy8gVXNlcyAvYXBpL3N0YXR1cyByYXRoZXIgdGhhbiBTU0UgbG9nLWxpbmUgbWF0Y2hpbmcgc28gaXQgYWxzbyB3b3JrcyBjb3JyZWN0bHlcbi8vIGFjcm9zcyB0aGUgSlMgc2VxdWVudGlhbC1zZWdtZW50IHJ1bm5lcnMnIGdhcHMgYmV0d2VlbiBwZXItc2VnbWVudCBqb2JzLlxuYXN5bmMgZnVuY3Rpb24gX3BvbGxUaGVybWFsU3RhdHVzKCkge1xuICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaCgnL2FwaS9zdGF0dXMnKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+IG51bGwpO1xuICBpZiAoIXN0YXR1cykgcmV0dXJuO1xuICBjb25zdCByZWFkb3V0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1ncHUtdGVtcCcpO1xuICBpZiAocmVhZG91dCkge1xuICAgIGlmIChzdGF0dXMuZ3B1X3RlbXBfYyA9PSBudWxsKSB7XG4gICAgICByZWFkb3V0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYWRvdXQuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgICAgcmVhZG91dC5jbGFzc05hbWUgPSAnZ3B1LXRlbXAtcmVhZG91dCcgKyAoc3RhdHVzLmdwdV9zdGF0ZSA9PT0gJ29rJyA/ICcnIDogYCAke3N0YXR1cy5ncHVfc3RhdGV9YCk7XG4gICAgICByZWFkb3V0LnRleHRDb250ZW50ID0gYEdQVSAke01hdGgucm91bmQoc3RhdHVzLmdwdV90ZW1wX2MpfcKwQ2A7XG4gICAgfVxuICB9XG4gIGlmIChzdGF0dXMuZ3B1X3N0YXRlID09PSAnd2FybicgJiYgX2xhc3RHcHVTdGF0ZSAhPT0gJ3dhcm4nICYmIF9sYXN0R3B1U3RhdGUgIT09ICdwYXVzZScpIHtcbiAgICBjb25zdCBuZXh0ID0gc3RhdHVzLnRoZXJtYWxfYXV0b3BhdXNlX2VuYWJsZWRcbiAgICAgID8gYEFuYWx5c2lzIHdpbGwgYXV0by1wYXVzZSBpZiBpdCByZWFjaGVzICR7TWF0aC5yb3VuZChzdGF0dXMudGhlcm1hbF9wYXVzZV9jKX3CsEMuYFxuICAgICAgOiBgQXV0by1wYXVzZSBpcyBvZmYgLSBwYXVzZSB0aGUgam9iIG1hbnVhbGx5IGlmIGl0IGtlZXBzIGNsaW1iaW5nLmA7XG4gICAgd2luZG93LnNob3dUb2FzdChgR1BVIHJ1bm5pbmcgaG90IC0gJHtNYXRoLnJvdW5kKHN0YXR1cy5ncHVfdGVtcF9jKX3CsEMuICR7bmV4dH1gLCAnd2FybmluZycpO1xuICB9XG4gIGlmIChzdGF0dXMuZ3B1X3N0YXRlID09PSAncGF1c2UnICYmIF9sYXN0R3B1U3RhdGUgIT09ICdwYXVzZScpIHtcbiAgICBfam9iUGF1c2VkID0gdHJ1ZTtcbiAgICBfcmVuZGVyUGF1c2VVSSgpO1xuICAgIHdpbmRvdy5zaG93VG9hc3QoYEF1dG8tcGF1c2VkOiBHUFUgcmVhY2hlZCAke01hdGgucm91bmQoc3RhdHVzLmdwdV90ZW1wX2MpfcKwQyAtIHdpbGwgaG9sZCBiZWZvcmUgdGhlIG5leHQgdmlkZW9gLCAnd2FybmluZycsIHtcbiAgICAgIGR1cmF0aW9uTXM6IDIwMDAwLFxuICAgICAgYWN0aW9uOiB7bGFiZWw6ICdSZXN1bWUgbm93Jywgb25DbGljazogdG9nZ2xlUGF1c2VKb2J9LFxuICAgIH0pO1xuICB9XG4gIF9sYXN0R3B1U3RhdGUgPSBzdGF0dXMuZ3B1X3N0YXRlO1xufVxuXG4vLyBcIlBhdXNlIGFmdGVyIGN1cnJlbnQgdmlkZW9cIiB0b2dnbGUgaW4gdGhlIGpvYiBoZWFkZXIgLSBvbmx5IHNob3duIGZvciBqb2JzXG4vLyBiYWNrZWQgYnkgdGhlIHBhdXNlIGZsYWcgZmlsZSAodGhlIHNpbmdsZSBhbmFseXplIHN0cmVhbSBhbmQgdGhlIEpTXG4vLyBzZXF1ZW50aWFsLXNlZ21lbnQgcnVubmVyczsgc2VlIHRvZ2dsZVBhdXNlSm9iKS5cbmZ1bmN0aW9uIF9yZW5kZXJQYXVzZVVJKCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXBhdXNlLWpvYicpO1xuICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItcGF1c2VkLWJhZGdlJyk7XG4gIGlmICghYnRuIHx8ICFiYWRnZSkgcmV0dXJuO1xuICBidG4uc3R5bGUuZGlzcGxheSA9IF9qb2JQYXVzYWJsZSA/ICcnIDogJ25vbmUnO1xuICBidG4udGV4dENvbnRlbnQgPSBfam9iUGF1c2VkID8gJ1Jlc3VtZScgOiAnUGF1c2UgYWZ0ZXIgY3VycmVudCB2aWRlbyc7XG4gIGJhZGdlLnN0eWxlLmRpc3BsYXkgPSBfam9iUGF1c2VkID8gJycgOiAnbm9uZSc7XG59XG5cbi8vIFJlZmxlY3RzIGFuIGFscmVhZHktcGF1c2VkIGpvYiBkaXNjb3ZlcmVkIHZpYSAvYXBpL3N0YXR1cyAocGFnZSByZWNvbm5lY3QpIC1cbi8vIGRvZXMgbm90IGl0c2VsZiBjYWxsIHRoZSBwYXVzZS9yZXN1bWUgQVBJLlxuZnVuY3Rpb24gX3NldFBhdXNlZFVJRnJvbVN0YXR1cyhwYXVzZWQpIHtcbiAgX2pvYlBhdXNlZCA9ICEhcGF1c2VkO1xuICBfcmVuZGVyUGF1c2VVSSgpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0b2dnbGVQYXVzZUpvYigpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1wYXVzZS1qb2InKTtcbiAgY29uc3Qgd2FudFBhdXNlID0gIV9qb2JQYXVzZWQ7XG4gIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvYW5hbHl6ZS8ke3dhbnRQYXVzZSA/ICdwYXVzZScgOiAncmVzdW1lJ31gLCB7bWV0aG9kOiAnUE9TVCd9KTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgd2luZG93LnNob3dUb2FzdChmb3JtYXRBcGlFcnJvcihkYXRhKSB8fCBgQ291bGQgbm90ICR7d2FudFBhdXNlID8gJ3BhdXNlJyA6ICdyZXN1bWUnfWAsICdlcnJvcicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZGF0YS5zdGF0dXMgPT09ICduby1vcCcpIHtcbiAgICAgIHdpbmRvdy5zaG93VG9hc3QoZGF0YS5tZXNzYWdlIHx8ICdObyBhbmFseXNpcyBpcyBydW5uaW5nLicsICdpbmZvJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIF9qb2JQYXVzZWQgPSB3YW50UGF1c2U7XG4gICAgX3JlbmRlclBhdXNlVUkoKTtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KHdhbnRQYXVzZSA/ICdXaWxsIHBhdXNlIGJlZm9yZSB0aGUgbmV4dCB2aWRlbycgOiAnUmVzdW1lZCcsICdpbmZvJyk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHdpbmRvdy5zaG93VG9hc3Qod2luZG93Lm5ldEVyck1zZyhlcnIpLCAnZXJyb3InKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgfVxufVxuXG4vLyBNYXJrIHN0ZXAgKmlkeCogYWN0aXZlIGFuZCBldmVyeSBlYXJsaWVyIHN0ZXAgZG9uZS4gU2hhcmVkIGJ5IHRoZSBwcm9zZVxuLy8gbWF0Y2hlciAodXBkYXRlSm9iVUkpIGFuZCB0aGUgbWFya2VyIHBhdGggKF9kcml2ZVN0ZXBGcm9tTWFya2VyKSBzbyBhIHN0YWdlXG4vLyBhZHZhbmNlIGJlaGF2ZXMgaWRlbnRpY2FsbHkgaG93ZXZlciBpdCB3YXMgZGV0ZWN0ZWQuXG5mdW5jdGlvbiBfYWN0aXZhdGVTdGVwKGlkeCkge1xuICBjb25zdCBwcmV2U3RlcElkeCA9IF9hY3RpdmVTdGVwSWR4O1xuICBmb3IgKGxldCBqID0gMDsgaiA8IGlkeDsgaisrKSB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2p9YCk7XG4gICAgaWYgKGVsKSB7IGVsLmNsYXNzTmFtZSA9ICdzdGVwIGRvbmUnOyBlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnJzsgZWwudGV4dENvbnRlbnQgPSAn4pyTJzsgZWwudGl0bGUgPSBfam9iU3RlcERlZnNbal0ubGFiZWw7IH1cbiAgfVxuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7aWR4fWApO1xuICBpZiAoZWwpIHsgZWwuY2xhc3NOYW1lID0gJ3N0ZXAgYWN0aXZlJzsgX2FjdGl2ZVN0ZXBJZHggPSBpZHg7IH1cbiAgaWYgKF9hY3RpdmVTdGVwSWR4ICE9PSBwcmV2U3RlcElkeCkge1xuICAgIF9zdGVwU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAvLyBXaGVuIHRoZSBwaXBlbGluZSBhZHZhbmNlcyBhIHN0YWdlLCByZWZyZXNoIHRoZSBzaWRlYmFyIHNvIGEgbmV3bHktYW5hbHl6aW5nXG4gICAgLy8gcmVjb3JkaW5nIGFwcGVhcnMgKHJlcGxhY2luZyBpdHMgcGxhY2Vob2xkZXIpIGFuZCBpdHMgc3RhdHVzIHN0YXlzIGN1cnJlbnQsXG4gICAgLy8gYW5kIHJlZnJlc2ggdGhlIG9wZW4gY2xpcCBsaXN0IHRvIHBpY2sgdXAgZnJlc2hseS1jb21taXR0ZWQgY2xpcHMvc2NvcmVzLlxuICAgIF9kZWJvdW5jZWRTaWRlYmFyUmVmcmVzaCgpO1xuICAgIF9kZWJvdW5jZWRDbGlwTGlzdFJlZnJlc2goKTtcbiAgfVxufVxuXG4vLyBSZWNvcmQgYSBzdGVwJ3MgY3VycmVudC90b3RhbCwgYW5jaG9yaW5nIHRoZSB0aHJvdWdocHV0IHJhdGUgYXQgdGhlIGZpcnN0XG4vLyBvYnNlcnZlZCBjb3VudCBzbyBhIGNvbGQgZmlyc3QgaXRlbSBpcyBleGNsdWRlZCBmcm9tIHRoZSBFVEEgZXh0cmFwb2xhdGlvbi5cbmZ1bmN0aW9uIF9zZXRTdGVwUHJvZ3Jlc3MoaWR4LCBjdXJyZW50LCB0b3RhbCkge1xuICAvLyBSZWFsIHByb2dyZXNzIG1lYW5zIGFueSB3YWl0IChlLmcuIG1vZGVsIGRvd25sb2FkKSBpcyBvdmVyIC0gZHJvcCBpdCBzbyB0aGVcbiAgLy8gcGlsbCBzd2l0Y2hlcyBiYWNrIHRvIGxpdmUgY291bnRzLlxuICBkZWxldGUgX3N0ZXBXYWl0aW5nTXNnW2lkeF07XG4gIF9zdGVwUHJvZ3Jlc3NbaWR4XSA9IHtjdXJyZW50LCB0b3RhbH07XG4gIGlmICghX3N0ZXBSYXRlQW5jaG9yW2lkeF0pIF9zdGVwUmF0ZUFuY2hvcltpZHhdID0ge3Q6IERhdGUubm93KCksIGN1cnJlbnR9O1xuICBfcmVuZGVyU3RlcFBpbGwoaWR4KTtcbiAgX2RlYm91bmNlZENsaXBMaXN0UmVmcmVzaCgpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVKb2JVSShsaW5lKSB7XG4gIF9qb2JTdGVwRGVmcy5mb3JFYWNoKChzLCBpKSA9PiB7XG4gICAgaWYgKHMucGF0dGVybnMuc29tZShwID0+IGxpbmUuaW5jbHVkZXMocCkpKSBfYWN0aXZhdGVTdGVwKGkpO1xuICB9KTtcbiAgY29uc3QgYWN0aXZlRGVmID0gX2pvYlN0ZXBEZWZzW19hY3RpdmVTdGVwSWR4XTtcbiAgaWYgKGFjdGl2ZURlZiAmJiBhY3RpdmVEZWYud2FpdFBhdHRlcm4gJiYgYWN0aXZlRGVmLndhaXRQYXR0ZXJuLnRlc3QobGluZSkpIHtcbiAgICBfc3RlcFdhaXRpbmdNc2dbX2FjdGl2ZVN0ZXBJZHhdID0gJ3dhaXRpbmcgZm9yIHRoZSBzcGVlY2ggbW9kZWwgdG8gZmluaXNoIGRvd25sb2FkaW5nJztcbiAgICBfcmVuZGVyU3RlcFBpbGwoX2FjdGl2ZVN0ZXBJZHgpO1xuICB9XG4gIGlmIChhY3RpdmVEZWYgJiYgYWN0aXZlRGVmLnByb2dyZXNzUGF0dGVybikge1xuICAgIGNvbnN0IG0gPSBsaW5lLm1hdGNoKGFjdGl2ZURlZi5wcm9ncmVzc1BhdHRlcm4pO1xuICAgIGlmIChtKSBfc2V0U3RlcFByb2dyZXNzKF9hY3RpdmVTdGVwSWR4LCBwYXJzZUludChtWzFdLCAxMCksIHBhcnNlSW50KG1bMl0sIDEwKSk7XG4gIH1cbiAgaWYgKHdpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCk7XG59XG5cbi8vIERyaXZlIHRoZSBwaWxsIHJvdyBmcm9tIGEgcGFyc2VkIEBAUFJPR1JFU1MgbWFya2VyOiBkZXRlcm1pbmlzdGljIHN0YWdlXG4vLyBhZHZhbmNlIHBsdXMgb3B0aW9uYWwgY3VycmVudC90b3RhbCwga2V5ZWQgb24gdGhlIHN0ZXAgZGVmJ3Mgc3RhZ2UgaWQuXG5mdW5jdGlvbiBfZHJpdmVTdGVwRnJvbU1hcmtlcihtYXJrZXIpIHtcbiAgY29uc3QgaWR4ID0gX2pvYlN0ZXBEZWZzLmZpbmRJbmRleChzID0+IHMuc3RhZ2UgPT09IG1hcmtlci5zdGFnZSk7XG4gIGlmIChpZHggPCAwKSByZXR1cm47XG4gIF9hY3RpdmF0ZVN0ZXAoaWR4KTtcbiAgaWYgKHR5cGVvZiBtYXJrZXIuZG9uZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIG1hcmtlci50b3RhbCA9PT0gJ251bWJlcicgJiYgbWFya2VyLnRvdGFsID4gMCkge1xuICAgIF9zZXRTdGVwUHJvZ3Jlc3MoaWR4LCBtYXJrZXIuZG9uZSwgbWFya2VyLnRvdGFsKTtcbiAgfVxuICBpZiAod2luZG93Ll9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwoKTtcbn1cblxubGV0IF9zaWRlYmFyUmVmcmVzaFRpbWVyID0gbnVsbDtcbmZ1bmN0aW9uIF9kZWJvdW5jZWRTaWRlYmFyUmVmcmVzaCgpIHtcbiAgaWYgKF9zaWRlYmFyUmVmcmVzaFRpbWVyKSByZXR1cm47XG4gIF9zaWRlYmFyUmVmcmVzaFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7IF9zaWRlYmFyUmVmcmVzaFRpbWVyID0gbnVsbDsgd2luZG93LmxvYWRWaWRlb3MoKTsgfSwgMTIwMCk7XG59XG5cbmxldCBfY2xpcExpc3RSZWZyZXNoVGltZXIgPSBudWxsO1xuLy8gU2FtZSBwdXNoLWRyaXZlbi1idXQtZGVib3VuY2VkIHBhdHRlcm4gYXMgX2RlYm91bmNlZFNpZGViYXJSZWZyZXNoIGFib3ZlLFxuLy8gdHJpZ2dlcmVkIG9mZiB0aGUgU1NFIGxpbmUgc3RyZWFtIHJhdGhlciB0aGFuIGEgcG9sbGluZyB0aW1lci4gT25seSByZWZyZXNoZXNcbi8vIHdoZW4gdGhlIHZpZGVvIGJlaW5nIGFuYWx5emVkIGlzIHRoZSBvbmUgY3VycmVudGx5IG9wZW4sIHNvIG5ld2x5LWNvbW1pdHRlZFxuLy8gY2xpcCBzY29yZXMgKHl1dV9jbGlwL3Njb3JpbmcvZW5naW5lLnB5IG5vdyBjb21taXRzIHBlciBjbGlwKSBmaWxsIGludG8gdGhlXG4vLyB2aXNpYmxlIGxpc3QgbGl2ZSBpbnN0ZWFkIG9mIHJlcXVpcmluZyBhIG1hbnVhbCBwYWdlIHJlZnJlc2guXG5mdW5jdGlvbiBfZGVib3VuY2VkQ2xpcExpc3RSZWZyZXNoKCkge1xuICBpZiAoX2NsaXBMaXN0UmVmcmVzaFRpbWVyKSByZXR1cm47XG4gIF9jbGlwTGlzdFJlZnJlc2hUaW1lciA9IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgIF9jbGlwTGlzdFJlZnJlc2hUaW1lciA9IG51bGw7XG4gICAgaWYgKCFBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkIHx8ICFBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUpIHJldHVybjtcbiAgICBjb25zdCBhbmFseXppbmcgPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuZmlsZW5hbWUgPT09IEFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSk7XG4gICAgaWYgKCFhbmFseXppbmcgfHwgYW5hbHl6aW5nLmlkICE9PSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKSByZXR1cm47XG4gICAgQXBwU3RhdGUuY2xpcHMgPSBhd2FpdCBmZXRjaCh3aW5kb3cuX2NsaXBzTGlzdFVybChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKSkudGhlbihyID0+IHIuanNvbigpKTtcbiAgICB3aW5kb3cuX3JlbmRlckNsaXBzKCk7XG4gIH0sIDEyMDApO1xufVxuXG4vLyBCdWlsZHMgdGhlIGxpdmUgbGFiZWwgZm9yIGEgc3RlcCBwaWxsOiBcIlNjb3JlIMK3IDMvMTIgKDI1JSkgwrcgMDo0MiAofjI6MDZcbi8vIGxlZnQpXCIgb25jZSBwZXItaXRlbSBjb3VudHMgYXJyaXZlIGZyb20gdGhlIHN1YnByb2Nlc3MgbG9nOyBlbGFwc2VkLW9ubHlcbi8vIChmYWxsaW5nIGJhY2sgdG8gdGhlIHByZS1ydW4gL2FwaS9lc3RpbWF0ZSBmaWd1cmUpIGJlZm9yZSB0aGUgZmlyc3QgY291bnQuXG5mdW5jdGlvbiBfc3RlcFBpbGxMYWJlbChpZHgpIHtcbiAgY29uc3QgZGVmID0gX2pvYlN0ZXBEZWZzW2lkeF07XG4gIGlmICghZGVmKSByZXR1cm4ge3RleHQ6ICcnLCBwY3Q6IG51bGx9O1xuICBjb25zdCB3YWl0aW5nID0gX3N0ZXBXYWl0aW5nTXNnW2lkeF07XG4gIGlmICh3YWl0aW5nKSByZXR1cm4ge3RleHQ6IGAke2RlZi5sYWJlbH0gwrcgJHt3YWl0aW5nfWAsIHBjdDogbnVsbH07XG4gIGNvbnN0IGVsYXBzZWRNcyA9IERhdGUubm93KCkgLSBfc3RlcFN0YXJ0VGltZTtcbiAgY29uc3QgcHJvZ3Jlc3MgID0gX3N0ZXBQcm9ncmVzc1tpZHhdO1xuICBpZiAoIXByb2dyZXNzIHx8ICFwcm9ncmVzcy5jdXJyZW50KSB7XG4gICAgY29uc3QgZXN0ID0gX2VzdGltYXRlSG1zRm9yKGRlZik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQ6IGVzdCA/IGAke2RlZi5sYWJlbH0gwrcgJHtfZm10RWxhcHNlZChlbGFwc2VkTXMpfSAofiR7ZXN0fSlgIDogYCR7ZGVmLmxhYmVsfSDCtyAke19mbXRFbGFwc2VkKGVsYXBzZWRNcyl9YCxcbiAgICAgIHBjdDogbnVsbCxcbiAgICB9O1xuICB9XG4gIGNvbnN0IHtjdXJyZW50LCB0b3RhbH0gPSBwcm9ncmVzcztcbiAgY29uc3QgcGN0ICAgID0gTWF0aC5yb3VuZChjdXJyZW50IC8gdG90YWwgKiAxMDApO1xuICAvLyBFVEEgZnJvbSB0aHJvdWdocHV0IHNpbmNlIHRoZSByYXRlIGFuY2hvciAoZmlyc3Qgb2JzZXJ2ZWQgY291bnQpLCBub3QgZnJvbVxuICAvLyBlbGFwc2VkL2N1cnJlbnQgLSB0aGUgbGF0dGVyIGxldCBhIHNsb3cgY29sZCBmaXJzdCBpdGVtIHByb2plY3QgYWJzdXJkXG4gIC8vIGZpZ3VyZXMgKGUuZy4gXCI3NyBtaW4gbGVmdFwiIHRoYXQgdmFuaXNoZWQgd2hlbiB0aGUgc3RlcCBmaW5pc2hlZCBzZWNvbmRzIGxhdGVyKS5cbiAgY29uc3QgYW5jaG9yID0gX3N0ZXBSYXRlQW5jaG9yW2lkeF07XG4gIGxldCBldGEgPSAnJztcbiAgaWYgKGFuY2hvciAmJiBjdXJyZW50ID4gYW5jaG9yLmN1cnJlbnQpIHtcbiAgICBjb25zdCBtc1Blckl0ZW0gPSAoRGF0ZS5ub3coKSAtIGFuY2hvci50KSAvIChjdXJyZW50IC0gYW5jaG9yLmN1cnJlbnQpO1xuICAgIGNvbnN0IHJlbWFpbmluZ01zID0gbXNQZXJJdGVtICogKHRvdGFsIC0gY3VycmVudCk7XG4gICAgaWYgKGlzRmluaXRlKHJlbWFpbmluZ01zKSAmJiByZW1haW5pbmdNcyA+PSAwKSBldGEgPSBgICh+JHtfZm10RWxhcHNlZChyZW1haW5pbmdNcyl9IGxlZnQpYDtcbiAgfVxuICByZXR1cm4ge1xuICAgIHRleHQ6IGAke2RlZi5sYWJlbH0gwrcgJHtjdXJyZW50fS8ke3RvdGFsfSAoJHtwY3R9JSkgwrcgJHtfZm10RWxhcHNlZChlbGFwc2VkTXMpfSR7ZXRhfWAsXG4gICAgcGN0LFxuICB9O1xufVxuXG4vLyBQYWludHMgb25lIHN0ZXAgcGlsbCdzIHRleHQgYW5kLCBmb3IgYW4gaW4tcHJvZ3Jlc3Mgc3RlcCB3aXRoIGtub3duIGNvdW50cyxcbi8vIGEgdHdvLXRvbmUgZ3JhZGllbnQgZmlsbCBzdGFuZGluZyBpbiBmb3IgYSBwcm9ncmVzcyBiYXIgKGRvbmUvcGVuZGluZyBwaWxsc1xuLy8ga2VlcCB0aGVpciBmbGF0IENTUyBjbGFzcyBjb2xvciAtIG5vIGZpbGwpLiBTaGFyZWQgYnkgdGhlIGhlYWRlciBwaWxsIHJvd1xuLy8gYW5kICh2aWEgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgdGhlIGluLWRldGFpbCBtaXJyb3IgcGFuZWwuXG5mdW5jdGlvbiBfcmVuZGVyU3RlcFBpbGwoaWR4KSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtpZHh9YCk7XG4gIGlmICghZWwgfHwgIWVsLmNsYXNzTGlzdC5jb250YWlucygnYWN0aXZlJykpIHJldHVybjtcbiAgY29uc3Qge3RleHQsIHBjdH0gPSBfc3RlcFBpbGxMYWJlbChpZHgpO1xuICBlbC50ZXh0Q29udGVudCA9IHRleHQ7XG4gIGVsLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IHBjdCAhPSBudWxsXG4gICAgPyBgbGluZWFyLWdyYWRpZW50KHRvIHJpZ2h0LCB2YXIoLS1ncmVlbikgJHtwY3R9JSwgdmFyKC0tYWNjZW50KSAke3BjdH0lKWBcbiAgICA6ICcnO1xufVxuXG5mdW5jdGlvbiBfdGlja0pvYlRpbWVyKCkge1xuICBpZiAod2luZG93Ll9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwoKTtcbiAgaWYgKF9hY3RpdmVTdGVwSWR4IDwgMCkgcmV0dXJuO1xuICBfcmVuZGVyU3RlcFBpbGwoX2FjdGl2ZVN0ZXBJZHgpO1xufVxuXG5mdW5jdGlvbiBlbmRKb2JVSSgpIHtcbiAgaWYgKF9qb2JUaW1lcikgeyBjbGVhckludGVydmFsKF9qb2JUaW1lcik7IF9qb2JUaW1lciA9IG51bGw7IH1cbiAgX2pvYlN0ZXBEZWZzLmZvckVhY2goKHMsIGkpID0+IHtcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7aX1gKTtcbiAgICBpZiAoZWwpIHsgZWwuY2xhc3NOYW1lID0gJ3N0ZXAgZG9uZSc7IGVsLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnOyBlbC50ZXh0Q29udGVudCA9ICfinJMnOyBlbC50aXRsZSA9IHMubGFiZWw7IH1cbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2FuY2VsLWpvYicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIF9qb2JQYXVzYWJsZSA9IGZhbHNlO1xuICBfam9iUGF1c2VkICAgPSBmYWxzZTtcbiAgX3JlbmRlclBhdXNlVUkoKTtcbiAgaWYgKF9qb2JUaGVybWFsUG9sbFRpbWVyKSB7IGNsZWFySW50ZXJ2YWwoX2pvYlRoZXJtYWxQb2xsVGltZXIpOyBfam9iVGhlcm1hbFBvbGxUaW1lciA9IG51bGw7IH1cbiAgY29uc3QgZ3B1VGVtcCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItZ3B1LXRlbXAnKTtcbiAgaWYgKGdwdVRlbXApIGdwdVRlbXAuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgX2pvYkFjdGl2ZSA9IGZhbHNlO1xuICBfam9iSGlkZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgX2pvYkhpZGVUaW1lciA9IG51bGw7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1zdGF0dXMnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlYWRlci1zcGFjZXInKS5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI2J0bi1hbmFseXplLCNidG4tc2NvcmUnKS5mb3JFYWNoKGIgPT4gYi5kaXNhYmxlZCA9IGZhbHNlKTtcbiAgICBjb25zdCBhbmFseXplQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1hbmFseXplJyk7XG4gICAgaWYgKGFuYWx5emVCdG4pIGFuYWx5emVCdG4udGl0bGUgPSAnJztcbiAgICBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnMoZmFsc2UpO1xuICAgIGNvbnN0IHRvdGFsQXBwcm92ZWQgPSAoQXBwU3RhdGUudmlkZW9zIHx8IFtdKS5yZWR1Y2UoKG4sIHYpID0+IG4gKyB2LmFwcHJvdmVkLCAwKTtcbiAgICB3aW5kb3cuX3VwZGF0ZURlbW9CdXR0b24odG90YWxBcHByb3ZlZCk7XG4gICAgaWYgKHdpbmRvdy5fcmVuZGVyQ2xpcEZpbHRlckNvdW50cykgX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMoKTtcbiAgfSwgMjAwMCk7XG59XG5cbi8vIOKUgOKUgCBTU0UgdHJhbnNwb3J0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTG93LWxldmVsIFNTRSByZWFkZXIgdXNpbmcgZmV0Y2ggKyBSZWFkYWJsZVN0cmVhbSBzbyBub24tMjAwIEhUVFAgcmVzcG9uc2VzXG4vLyBjYW4gYmUgcmVhZCBmb3IgdGhlaXIgZXJyb3IgZGV0YWlsIChFdmVudFNvdXJjZS5vbmVycm9yIGNhbm5vdCBkbyB0aGlzKS5cbi8vXG4vLyBvbkxpbmUobXNnKSAgLSBjYWxsZWQgZm9yIGVhY2ggcGFyc2VkIFNTRSBwYXlsb2FkIGJlZm9yZSBfX0RPTkVfX1xuLy8gb25Eb25lKG1zZykgIC0gY2FsbGVkIHdpdGggdGhlIGZ1bGwgX19ET05FX18gcGF5bG9hZCAoc3RyaW5nIG9yIG9iamVjdClcbi8vIG9uRXJyb3Ioc3RyKSAtIGNhbGxlZCB3aXRoIGEgcGxhaW4tbGFuZ3VhZ2UgbWVzc2FnZSBvbiBIVFRQIGVycm9yIG9yIG5ldHdvcmsgbG9zc1xuLy9cbi8vIG9wdHMgKG9wdGlvbmFsKTogZXh0cmEgZmV0Y2ggaW5pdCwgZS5nLiB7bWV0aG9kOiAnUE9TVCd9IGZvciB0aGUgbW9kZWwtZG93bmxvYWRcbi8vIGVuZHBvaW50cywgd2hpY2ggYXJlIFBPU1Qtb25seSAoYSBHRVQgNDA1cykuIERlZmF1bHRzIHRvIGEgR0VULCBhcyB0aGUgYW5hbHl6ZVxuLy8gYW5kIHNjb3JlIFNTRSBzdHJlYW1zIHVzZS5cbi8vIFJldHVybnMgYSBoYW5kbGUgd2l0aCAuY2xvc2UoKSB0aGF0IGFib3J0cyB0aGUgaW4tZmxpZ2h0IHJlcXVlc3QuXG5mdW5jdGlvbiBfb3BlblNTRSh1cmwsIG9uTGluZSwgb25Eb25lLCBvbkVycm9yLCBvcHRzID0ge30pIHtcbiAgY29uc3QgY3RybCA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgaGFuZGxlID0ge2Nsb3NlOiAoKSA9PiBjdHJsLmFib3J0KCl9O1xuICBmZXRjaCh1cmwsIHtzaWduYWw6IGN0cmwuc2lnbmFsLCAuLi5vcHRzfSkudGhlbihhc3luYyByZXMgPT4ge1xuICAgIGlmICghcmVzLm9rKSB7XG4gICAgICBjb25zdCBlcnJEYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICAgIG9uRXJyb3IoZm9ybWF0QXBpRXJyb3IoZXJyRGF0YSkgfHwgYFNlcnZlciBlcnJvciAke3Jlcy5zdGF0dXN9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJlYWRlciA9IHJlcy5ib2R5LmdldFJlYWRlcigpO1xuICAgIGNvbnN0IGRlYyA9IG5ldyBUZXh0RGVjb2RlcigpO1xuICAgIGxldCBidWYgPSAnJztcbiAgICB0cnkge1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3Qge2RvbmUsIHZhbHVlfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG4gICAgICAgIGlmIChkb25lKSB7XG4gICAgICAgICAgaWYgKCFjdHJsLnNpZ25hbC5hYm9ydGVkKSBvbkVycm9yKCdTdHJlYW0gZW5kZWQgd2l0aG91dCBhIGNvbXBsZXRpb24gc2lnbmFsJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGJ1ZiArPSBkZWMuZGVjb2RlKHZhbHVlLCB7c3RyZWFtOiB0cnVlfSk7XG4gICAgICAgIGNvbnN0IGxpbmVzID0gYnVmLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgYnVmID0gbGluZXMucG9wKCk7XG4gICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKCdkYXRhOiAnKSkgY29udGludWU7XG4gICAgICAgICAgY29uc3QgbXNnID0gSlNPTi5wYXJzZShsaW5lLnNsaWNlKDYpKTtcbiAgICAgICAgICBjb25zdCBpc0RvbmUgPSBtc2cgPT09ICdfX0RPTkVfXycgfHwgKG1zZyAmJiB0eXBlb2YgbXNnID09PSAnb2JqZWN0JyAmJiBtc2cudHlwZSA9PT0gJ19fRE9ORV9fJyk7XG4gICAgICAgICAgaWYgKGlzRG9uZSkgeyBvbkRvbmUobXNnKTsgcmV0dXJuOyB9XG4gICAgICAgICAgb25MaW5lKG1zZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmICghY3RybC5zaWduYWwuYWJvcnRlZCkgb25FcnJvcignQ29ubmVjdGlvbiBsb3N0IC0gc2VydmVyIGRpc2Nvbm5lY3RlZCcpO1xuICAgIH1cbiAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICBpZiAoIWN0cmwuc2lnbmFsLmFib3J0ZWQpIG9uRXJyb3Iod2luZG93Lm5ldEVyck1zZyhlcnIpKTtcbiAgfSk7XG4gIHJldHVybiBoYW5kbGU7XG59XG5cbi8vIE9ubHkgb25lIGpvYiBzdHJlYW0gaXMgbGl2ZSBhdCBhIHRpbWUuIFN0YXJ0aW5nIGEgbmV3IGpvYiBhYm9ydHMgdGhlIHByZXZpb3VzXG4vLyBvbmUgLSBidXQgYWJvcnRpbmcgc3VwcHJlc3NlcyBpdHMgb25Eb25lL29uRXJyb3IsIHNvIGl0cyBVSSB0ZWFyZG93biAoYnV0dG9uXG4vLyByZS1lbmFibGUsIHByb2dyZXNzIHBpbGwpIHdvdWxkIG5ldmVyIHJ1bi4gRWFjaCBqb2IgcmVnaXN0ZXJzIHRoYXQgdGVhcmRvd24gYXNcbi8vIGEgY2xlYW51cCBzbyBhIHN1cGVyc2VkaW5nIGpvYiBjYW4gcnVuIGl0LiBTZWUgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbS5cbmZ1bmN0aW9uIF9zZXRBY3RpdmVTdHJlYW0oaGFuZGxlLCBjbGVhbnVwID0gbnVsbCkge1xuICBfYWN0aXZlRVMgPSBoYW5kbGU7XG4gIF9hY3RpdmVKb2JDbGVhbnVwID0gY2xlYW51cDtcbn1cblxuZnVuY3Rpb24gX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSkge1xuICBpZiAoX2FjdGl2ZUVTID09PSBoYW5kbGUpIHsgX2FjdGl2ZUVTID0gbnVsbDsgX2FjdGl2ZUpvYkNsZWFudXAgPSBudWxsOyB9XG59XG5cbmZ1bmN0aW9uIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKSB7XG4gIGlmIChfYWN0aXZlRVMpIHsgX2FjdGl2ZUVTLmNsb3NlKCk7IF9hY3RpdmVFUyA9IG51bGw7IH1cbiAgaWYgKF9hY3RpdmVKb2JDbGVhbnVwKSB7IGNvbnN0IGNsZWFudXAgPSBfYWN0aXZlSm9iQ2xlYW51cDsgX2FjdGl2ZUpvYkNsZWFudXAgPSBudWxsOyBjbGVhbnVwKCk7IH1cbn1cblxuLy8gR3VhcmQgZm9yIGNvbXBldGluZyBTU0Ugam9icyAocmUtc2NvcmUsIHRpbWVsaW5lLCBzdW1tYXJ5LCBkaWFyaXplLCDigKYpLiBXaGlsZVxuLy8gYW4gYW5hbHlzaXMgaXMgcnVubmluZyB0aGUgYmFja2VuZCA0MDlzIHRoZXNlIGFueXdheSwgYnV0IHRoZXkgY2FsbFxuLy8gX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpIGZpcnN0LCB3aGljaCB3b3VsZCB0ZWFyIGRvd24gdGhlIGxpdmUgYW5hbHl6ZSBwcm9ncmVzc1xuLy8gVUkgYmVmb3JlIHRoZSByZWplY3Rpb24gbGFuZHMuIFJldHVybnMgdHJ1ZSAoYW5kIHRvYXN0cykgc28gdGhlIGNhbGxlciBjYW4gYmFpbFxuLy8gYmVmb3JlIGFueSBzaWRlIGVmZmVjdHMuXG5mdW5jdGlvbiBfYmxvY2tlZEJ5QW5hbHl6ZShhY3Rpb25MYWJlbCkge1xuICBpZiAoIUFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSkgcmV0dXJuIGZhbHNlO1xuICB3aW5kb3cuc2hvd1RvYXN0KGBXYWl0IGZvciB0aGUgY3VycmVudCBhbmFseXNpcyB0byBmaW5pc2ggYmVmb3JlIHlvdSAke2FjdGlvbkxhYmVsfS5gLCAnd2FybmluZycpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gb25MaW5lIChvcHRpb25hbCk6IGNhbGxlZCB3aXRoIGVhY2ggcmF3IFNTRSBwYXlsb2FkIGxpbmUgYmVmb3JlIF9fRE9ORV9fLCBmb3Jcbi8vIGNhbGxlcnMgdGhhdCBuZWVkIGxpdmUgcHJvZ3Jlc3MgdGV4dCAoZS5nLiB0aGUgcHJveHktYnVpbGQgcGVyY2VudGFnZSkuXG4vLyBvcHRzIChvcHRpb25hbCk6IGZldGNoIGluaXQgcGFzc2VkIHRocm91Z2ggdG8gX29wZW5TU0UsIGUuZy4ge21ldGhvZDogJ1BPU1QnfVxuLy8gZm9yIGEgUE9TVC1vbmx5IFNTRSBlbmRwb2ludCAoYW5hbHl6ZS1mcmFtZXMpLlxuLy8gb25FcnJvciAob3B0aW9uYWwpOiBjYWxsZWQgYWZ0ZXIgdGhlIGJ1aWx0LWluIGVycm9yIGhhbmRsaW5nICh0b2FzdCArIGVuZEpvYlVJKVxuLy8gc28gYSBjYWxsZXIgY2FuIHJ1biBpdHMgb3duIHRlcm1pbmFsIGNsZWFudXAgb24gYW4gSFRUUC90cmFuc3BvcnQgZmFpbHVyZSAtIGUuZy5cbi8vIGNsZWFyaW5nIGEgcGVyLWl0ZW0gaW4tZmxpZ2h0IGZsYWcgdGhhdCBvbmx5IGl0cyBvbkRvbmUgd291bGQgb3RoZXJ3aXNlIGNsZWFyLlxuZnVuY3Rpb24gc3RyZWFtU1NFKHVybCwgb25Eb25lLCBzdGVwRGVmcywgam9iTGFiZWwsIGNhbmNlbGxhYmxlID0gZmFsc2UsIG9uTGluZSA9IG51bGwsIHBhdXNhYmxlID0gZmFsc2UsIG9wdHMgPSB7fSwgb25FcnJvciA9IG51bGwpIHtcbiAgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpO1xuICBpZiAoc3RlcERlZnMpIHN0YXJ0Sm9iVUkoc3RlcERlZnMsIGpvYkxhYmVsLCBjYW5jZWxsYWJsZSwgcGF1c2FibGUpO1xuICBjb25zdCBoYW5kbGUgPSBfb3BlblNTRShcbiAgICB1cmwsXG4gICAgdGV4dCA9PiB7XG4gICAgICAvLyBBIEBAUFJPR1JFU1MgbWFya2VyIGRyaXZlcyB0aGUgcGlsbHMgZGV0ZXJtaW5pc3RpY2FsbHkgYW5kIGlzIE5PVCBzaG93biBhc1xuICAgICAgLy8gYSBsb2cgbGluZTsgZXZlcnl0aGluZyBlbHNlIGZhbGxzIHRocm91Z2ggdG8gdGhlIGxvZyArIHByb3NlIGZhbGxiYWNrLlxuICAgICAgY29uc3QgbWFya2VyID0gc3RlcERlZnMgPyBwYXJzZVByb2dyZXNzKHRleHQpIDogbnVsbDtcbiAgICAgIGlmIChtYXJrZXIpIHsgX2RyaXZlU3RlcEZyb21NYXJrZXIobWFya2VyKTsgcmV0dXJuOyB9XG4gICAgICB3aW5kb3cuYXBwZW5kTG9nKHRleHQpOyBpZiAob25MaW5lKSBvbkxpbmUodGV4dCk7IGlmIChzdGVwRGVmcykgdXBkYXRlSm9iVUkodGV4dCk7XG4gICAgfSxcbiAgICAoKSA9PiB7XG4gICAgICBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKTtcbiAgICAgIGlmIChzdGVwRGVmcykgZW5kSm9iVUkoKTtcbiAgICAgIGlmIChvbkRvbmUpIG9uRG9uZSgpO1xuICAgIH0sXG4gICAgZXJyTXNnID0+IHtcbiAgICAgIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpO1xuICAgICAgd2luZG93LmFwcGVuZExvZyhgWyR7ZXJyTXNnfV1gKTtcbiAgICAgIHdpbmRvdy5zaG93VG9hc3QoZXJyTXNnLCAnZXJyb3InKTtcbiAgICAgIHdpbmRvdy5Tb3VuZEZ4LnBsYXkoJ2Vycm9yJyk7XG4gICAgICBpZiAoc3RlcERlZnMpIGVuZEpvYlVJKCk7XG4gICAgICBpZiAob25FcnJvcikgb25FcnJvcihlcnJNc2cpO1xuICAgICAgd2luZG93LmxvYWRWaWRlb3MoKTtcbiAgICB9LFxuICAgIG9wdHMsXG4gICk7XG4gIF9zZXRBY3RpdmVTdHJlYW0oaGFuZGxlLCBzdGVwRGVmcyA/IGVuZEpvYlVJIDogbnVsbCk7XG59XG5cbi8vIFBvbGxlZCBieSB0aGUgSlMgc2VxdWVudGlhbC1zZWdtZW50IHJ1bm5lcnMgKGFuYWx5emUuanMncyBwcmUtc3BsaXQgbG9vcCxcbi8vIHNwbGl0LmpzJ3MgcmUtc3BsaXQgbG9vcCkgYmVmb3JlIGZpcmluZyBvZmYgZWFjaCBzZWdtZW50J3Mgb3duIGFuYWx5emUgam9iLlxuLy8gRWFjaCBzZWdtZW50IGlzIGEgc2VwYXJhdGUgQW5hbHl6ZUpvYiwgc28gdGhlcmUgaXMgYSBnYXAgYmV0d2VlbiBzZWdtZW50c1xuLy8gd2l0aCBubyBcInJ1bm5pbmdcIiBqb2IgZm9yIC9hcGkvc3RhdHVzJ3MgYW5hbHl6ZV9wYXVzZWQgdG8ga2V5IG9mZiAtIHRoaXNcbi8vIGNoZWNrcyB0aGUgcmF3IHBhdXNlIGZsYWcgZmlsZSBpbnN0ZWFkIChwYXVzZV9mbGFnX3NldCkuXG5hc3luYyBmdW5jdGlvbiBfd2FpdFdoaWxlQW5hbHl6ZVBhdXNlZCgpIHtcbiAgbGV0IHRvYXN0ZWQgPSBmYWxzZTtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaCgnL2FwaS9zdGF0dXMnKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgIGlmICghc3RhdHVzIHx8ICFzdGF0dXMucGF1c2VfZmxhZ19zZXQpIHJldHVybjtcbiAgICBpZiAoIXRvYXN0ZWQpIHsgd2luZG93LnNob3dUb2FzdCgnUGF1c2VkIC0gd2lsbCBob2xkIGJlZm9yZSB0aGUgbmV4dCBzZWdtZW50JywgJ2luZm8nKTsgdG9hc3RlZCA9IHRydWU7IH1cbiAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMzAwMCkpO1xuICB9XG59XG5cbi8vIOKUgOKUgCBqb2IgY2FuY2VsbGF0aW9uIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVGhlIGpvYi1oZWFkZXIgQ2FuY2VsIGJ1dHRvbiBzZXJ2ZXMgd2hpY2hldmVyIGNhbmNlbGxhYmxlIGpvYiBpcyBydW5uaW5nLiBFYWNoXG4vLyBjYW5jZWxsYWJsZSBmbG93IHNldHMgX2FjdGl2ZUNhbmNlbCAodmlhIHNldEpvYkNhbmNlbCkgc28gdGhlIGNvbmZpcm0gY29weSBhbmRcbi8vIHRoZSBjYW5jZWwgZW5kcG9pbnQgbWF0Y2ggdGhlIGpvYjsgc3RhcnRKb2JVSSByZXNldHMgaXQgdG8gdGhlIGFuYWx5emUgZGVmYXVsdC5cbmNvbnN0IF9BTkFMWVpFX0NBTkNFTCA9IHtcbiAgdXJsOiAgICAgICcvYXBpL2FuYWx5emUvY2FuY2VsJyxcbiAgdGl0bGU6ICAgICdDYW5jZWwgYW5hbHlzaXM/JyxcbiAgYm9keTogICAgICdBbGwgcHJvZ3Jlc3MgZm9yIHRoaXMgcmVjb3JkaW5nIHdpbGwgYmUgbG9zdCBhbmQgeW91IHdpbGwgbmVlZCB0byBhbmFseXplIGl0IGFnYWluLicsXG4gIGNvbmZpcm06ICAnQ2FuY2VsIEFuYWx5c2lzJyxcbiAgbG9nTXNnOiAgICdbQW5hbHlzaXMgY2FuY2VsbGVkXScsXG59O1xubGV0IF9hY3RpdmVDYW5jZWwgPSBfQU5BTFlaRV9DQU5DRUw7XG5cbmZ1bmN0aW9uIHNldEpvYkNhbmNlbChjZmcpIHsgX2FjdGl2ZUNhbmNlbCA9IGNmZyB8fCBfQU5BTFlaRV9DQU5DRUw7IH1cblxuZnVuY3Rpb24gY2FuY2VsSm9iKCkge1xuICB3aW5kb3cuc2hvd0NvbmZpcm0oXG4gICAgX2FjdGl2ZUNhbmNlbC50aXRsZSxcbiAgICBfYWN0aXZlQ2FuY2VsLmJvZHksXG4gICAgX2FjdGl2ZUNhbmNlbC5jb25maXJtLFxuICAgIF9kb0NhbmNlbEpvYixcbiAgICB0cnVlLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZG9DYW5jZWxKb2IoKSB7XG4gIGNvbnN0IGNhbmNlbCA9IF9hY3RpdmVDYW5jZWw7XG4gIC8vIENhbmNlbCBvbiB0aGUgc2VydmVyIEZJUlNUIC0gaWYgaXQgZmFpbHMsIHRoZSBqb2IgaXMgc3RpbGwgcnVubmluZywgc29cbiAgLy8ga2VlcCB0aGUgc3RyZWFtIGF0dGFjaGVkIGFuZCB0aGUgam9iIFVJIHVwIGluc3RlYWQgb2YgcHJldGVuZGluZyBpdCBzdG9wcGVkLlxuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGNhbmNlbC51cmwsIHttZXRob2Q6ICdQT1NUJ30pO1xuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciBlcnJvciAke3Jlcy5zdGF0dXN9YCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHdpbmRvdy5zaG93VG9hc3QoYENvdWxkIG5vdCBjYW5jZWwgLSAke2Vyci5tZXNzYWdlfWAsICdlcnJvcicpO1xuICAgIHJldHVybjtcbiAgfVxuICBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCk7XG4gIHdpbmRvdy5hcHBlbmRMb2coY2FuY2VsLmxvZ01zZyk7XG4gIGVuZEpvYlVJKCk7XG4gIC8vIEEgam9iLXNwZWNpZmljIHRlcm1pbmFsIGNsZWFudXAgKGUuZy4gY2xlYXJpbmcgYSBwZXItY2xpcCBpbi1mbGlnaHQgZmxhZyBzb1xuICAvLyBpdHMgYnV0dG9uIGxlYXZlcyB0aGUgc3Bpbm5lcikgLSB0aGUgZ2VuZXJpYyBhbmFseXplIGNhbmNlbCBzZXRzIG5vbmUuXG4gIGlmIChjYW5jZWwub25DYW5jZWwpIGNhbmNlbC5vbkNhbmNlbCgpO1xuICAvLyBDbGVhciB0aGUgYW5hbHl6aW5nIG1hcmtlciBzbyBsb2FkVmlkZW9zKCkgZHJvcHMgdGhlIHNpZGViYXIgcGxhY2Vob2xkZXIgL1xuICAvLyBzcGlubmVyLiBMZWZ0IHNldCwgYSBjYW5jZWxsZWQgcnVuIHdob3NlIERCIHJvdyBuZXZlciBtYXRlcmlhbGlzZWQgd291bGRcbiAgLy8ga2VlcCBhbiB1bmNsaWNrYWJsZSBcIkFuYWx5emluZ+KAplwiIHBsYWNlaG9sZGVyIHVudGlsIGEgbWFudWFsIHBhZ2UgcmVmcmVzaC5cbiAgQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lID0gbnVsbDtcbiAgd2luZG93LmxvYWRWaWRlb3MoKTtcbn1cblxuZXhwb3J0IHtcbiAgSU5HRVNUX1NURVBTLCBTQ09SRV9TVEVQUywgRlJBTUVTX1NURVBTLCBKT0JfU1RBR0VTLCBwYXJzZVByb2dyZXNzLCBfZHJpdmVTdGVwRnJvbU1hcmtlcixcbiAgc3RhcnRKb2JVSSwgdXBkYXRlSm9iVUksIGVuZEpvYlVJLCBhcHBseUpvYkJsb2NrZWRTdGF0ZSwgX3N0ZXBQaWxsTGFiZWwsIF9yZW5kZXJTdGVwUGlsbCwgX3RpY2tKb2JUaW1lcixcbiAgX3NldFBhdXNlZFVJRnJvbVN0YXR1cywgdG9nZ2xlUGF1c2VKb2IsIF9wb2xsVGhlcm1hbFN0YXR1cyxcbiAgX29wZW5TU0UsIHN0cmVhbVNTRSwgX3NldEFjdGl2ZVN0cmVhbSwgX2NsZWFyQWN0aXZlU3RyZWFtLCBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtLFxuICBfYmxvY2tlZEJ5QW5hbHl6ZSwgX3dhaXRXaGlsZUFuYWx5emVQYXVzZWQsXG4gIHNldEpvYkNhbmNlbCwgY2FuY2VsSm9iLFxufTtcblxuLy8gVGhlIGpvYiBoZWFkZXIncyBQYXVzZS9DYW5jZWwgYnV0dG9ucyBhcmUgc3RhdGljIG1hcmt1cCBpbiBpbmRleC5odG1sIChuZXZlclxuLy8gcmUtcmVuZGVyZWQpLCBzbyBhIHNpbmdsZSBsaXN0ZW5lciB3aXJlZCBvbmNlIGF0IG1vZHVsZSBsb2FkIC0gcmVwbGFjaW5nIHRoZVxuLy8gb25jbGljaz1cInRvZ2dsZVBhdXNlSm9iKClcIi9cImNhbmNlbEpvYigpXCIgYXR0cmlidXRlcyB0aGF0IHVzZWQgdG8gbGl2ZSB0aGVyZSAtXG4vLyBjYW4gbmV2ZXIgZG91YmxlLXdpcmUuICh2aWRlb3MuanMncyBpbi1kZXRhaWwgQ2FuY2VsIGJ1dHRvbiBzdGlsbCB1c2VzIGl0cyBvd25cbi8vIGlubGluZSBvbmNsaWNrPVwiY2FuY2VsSm9iKClcIjsgdGhhdCBtYXJrdXAgbGl2ZXMgaW4gdmlkZW9zLmpzLCBvdXQgb2Ygc2NvcGUgaGVyZS4pXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXBhdXNlLWpvYicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdG9nZ2xlUGF1c2VKb2IpO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jYW5jZWwtam9iJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjYW5jZWxKb2IpO1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUmVjb3JkaW5nIHByZXZpZXcgcGxheWVyOiBwaWNrcyB0aGUgbWVkaWEgdHJhbnNwb3J0IChFbGVjdHJvbiBuYXRpdmUgc2NoZW1lIHZzIEhUVFApLFxuLy8gICBwcmVmZXJzIHRoZSBmYXN0IDcyMHAgcHJveHkgb3ZlciB0aGUgc291cmNlLCBhbmQgZHJpdmVzIHRoZSBjbGljay10by1idWlsZCBwcm94eSBiYWRnZS5cbi8vICAgQVBJOiByb3V0ZXMvdmlkZW9zLnB5IChzb3VyY2UvcHJveHkvcHJveHktc3RhdHVzL3Byb3h5LWdlbmVyYXRlKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV92aWRlby5weVxuLy8gU2luZ2xlIHBvaW50IHRoYXQgcGlja3MgdGhlIHRyYW5zcG9ydCBmb3IgYSByZWNvcmRpbmcncyBzb3VyY2UvcHJveHkgc3RyZWFtXG4vLyAocm9hZG1hcCBwbGFuIDEwKS4gSW5zaWRlIHRoZSBwYWNrYWdlZCBFbGVjdHJvbiBhcHAsIHdpbmRvdy5lbGVjdHJvbkFQSS5tZWRpYVByb3RvY29sXG4vLyBpcyBzZXQgYW5kIHBsYXliYWNrIGdvZXMgc3RyYWlnaHQgdGhyb3VnaCB0aGUgbmF0aXZlIFwieXV1LW1lZGlhOi8vXCIgc2NoZW1lIC1cbi8vIGJ5cGFzc2luZyB0aGUgUHl0aG9uIGJ5dGUtcHVtcCAtIGluc3RlYWQgb2YgdGhlIEhUVFAgcm91dGUuIFBsYWluIGJyb3dzZXItZGV2XG4vLyBtb2RlIG5ldmVyIGhhcyBlbGVjdHJvbkFQSSwgc28gaXQgYWx3YXlzIGdldHMgdGhlIHVuY2hhbmdlZCBIVFRQIFVSTC4gYWJzUGF0aFxuLy8gbWF5IGJlIG51bGwgKGUuZy4gYSBwcm94eSB0aGF0IGhhc24ndCBiZWVuIGdlbmVyYXRlZC9sb29rZWQgdXAgeWV0KSwgd2hpY2hcbi8vIHNpbXBseSBmYWxscyBiYWNrIHRvIEhUVFAgZm9yIHRoYXQgb25lIHJlcXVlc3QuXG5pbXBvcnQgeyBzdHJlYW1TU0UgfSBmcm9tICcuL2pvYnMuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gX2J1aWxkTWVkaWFVcmwodmlkZW9JZCwga2luZCwgYWJzUGF0aCkge1xuICBpZiAod2luZG93LmVsZWN0cm9uQVBJPy5tZWRpYVByb3RvY29sICYmIGFic1BhdGgpIHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gYWJzUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgcmV0dXJuIGB5dXUtbWVkaWE6Ly9tZWRpYS8ke2VuY29kZVVSSUNvbXBvbmVudChub3JtYWxpemVkKX1gO1xuICB9XG4gIHJldHVybiBgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS8ke2tpbmR9YDtcbn1cblxuLy8g4pSA4pSAIHJlY29yZGluZyBwcmV2aWV3IHF1YWxpdHkgKDcyMHAgcHJveHkgKyBiYWRnZSkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBTaGFyZWQgYnkgZXZlcnkgZnVsbC1yZWNvcmRpbmcgPHZpZGVvPiAocmVjb3JkaW5nIGRldGFpbCBwbGF5ZXIsIHNwbGl0IGVkaXRvcilcbi8vIHNvIHRoZSBjcmVhdG9yIGFsd2F5cyBrbm93cyB3aGV0aGVyIHRoZXkncmUgc2VlaW5nIHRoZSBmYXN0IDcyMHAgcHJveHkgb3IgdGhlXG4vLyBmdWxsLXF1YWxpdHkgb3JpZ2luYWwuIFByZWZlcnMgdGhlIHByb3h5IHdoZW4gb25lIGV4aXN0czsgb3RoZXJ3aXNlIHBsYXlzIHRoZVxuLy8gc291cmNlIGFuZCBlaXRoZXIgYnVpbGRzIGEgcHJveHkgb24gZGVtYW5kIChhdXRvQnVpbGQpIG9yIGludml0ZXMgdGhlIHVzZXIgdG8uXG4vL1xuLy8gICB2aWRlb0VsIC8gYmFkZ2VFbCA6IHRoZSA8dmlkZW8+IGFuZCBpdHMgb3ZlcmxheSBiYWRnZSAoY2FsbGVyIG93bnMgbGF5b3V0KVxuLy8gICBhdXRvQnVpbGQgICAgICAgICA6IGJ1aWxkIGltbWVkaWF0ZWx5IHdoZW4gbm8gcHJveHkgZXhpc3RzIChkZWxpYmVyYXRlXG4vLyAgICAgICAgICAgICAgICAgICAgICAgc2NydWJiaW5nIHN1cmZhY2VzKSwgZWxzZSB0aGUgYmFkZ2Ugb2ZmZXJzIGEgY2xpY2stdG8tYnVpbGRcbi8vICAgaXNDdXJyZW50ICAgICAgICAgOiBndWFyZCBzbyBhIGxhdGUgc3dhcCBuZXZlciBsYW5kcyBvbiBhIHNpbmNlLWNoYW5nZWQgdmlld1xuLy8gICBzdGFydFMgLyBlbmRTICAgICA6IGEgc3BsaXQgc2VnbWVudCdzIHBsYXllciBzdHJlYW1zIHRoZSBmdWxsIHVudHJpbW1lZCBwYXJlbnRcbi8vICAgICAgICAgICAgICAgICAgICAgICBmaWxlIChzb3VyY2UgYW5kIHByb3h5IGFyZSBib3RoIGtleWVkIGJ5IHRoZSBwYXJlbnQgcGF0aCkgLVxuLy8gICAgICAgICAgICAgICAgICAgICAgIHRoZXNlIGJvdW5kIHBsYXliYWNrIHRvIHRoZSBzZWdtZW50J3Mgb3duIHNsaWNlIG9mIGl0XG4vLyAgIHNvdXJjZVBhdGggICAgICAgIDogdGhlIHJlY29yZGluZydzIGFic29sdXRlIHBhdGggKHZpZGVvLnNvdXJjZV9wYXRoIGZyb20gdGhlXG4vLyAgICAgICAgICAgICAgICAgICAgICAgYWxyZWFkeS1mZXRjaGVkIHZpZGVvIHJlY29yZCkgLSBvbmx5IHVzZWQgdG8gYnVpbGQgdGhlXG4vLyAgICAgICAgICAgICAgICAgICAgICAgRWxlY3Ryb24gbmF0aXZlLXByb3RvY29sIFVSTDsgaWdub3JlZCBpbiBicm93c2VyLWRldiBtb2RlXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBSZWNvcmRpbmdQcmV2aWV3KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIHsgYXV0b0J1aWxkID0gZmFsc2UsIGlzQ3VycmVudCA9ICgpID0+IHRydWUsIHN0YXJ0UyA9IG51bGwsIGVuZFMgPSBudWxsLCBzb3VyY2VQYXRoID0gbnVsbCB9ID0ge30pIHtcbiAgdmlkZW9FbC5zcmMgPSBfYnVpbGRNZWRpYVVybCh2aWRlb0lkLCAnc291cmNlJywgc291cmNlUGF0aCk7XG4gIGlmIChzdGFydFMgIT0gbnVsbCkge1xuICAgIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiB7IHRyeSB7IHZpZGVvRWwuY3VycmVudFRpbWUgPSBzdGFydFM7IH0gY2F0Y2ggKF8pIHt9IH0sIHsgb25jZTogdHJ1ZSB9KTtcbiAgfVxuICBpZiAoZW5kUyAhPSBudWxsKSB7XG4gICAgdmlkZW9FbC5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgKCkgPT4geyBpZiAodmlkZW9FbC5jdXJyZW50VGltZSA+PSBlbmRTKSB2aWRlb0VsLnBhdXNlKCk7IH0pO1xuICB9XG4gIGNvbnN0IGJ1aWxkRm4gPSAoKSA9PiBfYnVpbGRSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0Uyk7XG4gIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ29yaWdpbmFsJywgbnVsbCwgYXV0b0J1aWxkID8gbnVsbCA6IGJ1aWxkRm4pO1xuICBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9wcm94eS1zdGF0dXNgKVxuICAgIC50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogbnVsbClcbiAgICAudGhlbihzdGF0dXMgPT4ge1xuICAgICAgaWYgKCFpc0N1cnJlbnQoKSB8fCAhc3RhdHVzKSByZXR1cm47XG4gICAgICBpZiAoc3RhdHVzLmF2YWlsYWJsZSkgX3VzZVJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTLCBzdGF0dXMucHJveHlfcGF0aCk7XG4gICAgICBlbHNlIGlmIChhdXRvQnVpbGQgfHwgc3RhdHVzLmdlbmVyYXRpbmcpIGJ1aWxkRm4oKTtcbiAgICB9KVxuICAgIC5jYXRjaCgoKSA9PiB7IC8qIGxlYXZlIHRoZSBzb3VyY2UgcGxheWluZyB3aXRoIHRoZSBvcmlnaW5hbC1xdWFsaXR5IGJhZGdlICovIH0pO1xufVxuXG4vLyBzdGFydFM6IGZhbGxzIGJhY2sgdG8gaXQgd2hlbiBjdXJyZW50VGltZSBpcyBzdGlsbCAwIC0gdGhlIHByb3h5LXN0YXR1cyBmZXRjaFxuLy8gY2FuIHJlc29sdmUgYmVmb3JlIHRoZSBzb3VyY2UncyBsb2FkZWRtZXRhZGF0YSBzZWVrIChzZXR1cFJlY29yZGluZ1ByZXZpZXcpIHJ1bnMsXG4vLyB3aGljaCB3b3VsZCBvdGhlcndpc2UgcmVzdW1lIGEgc2VnbWVudCdzIHByb3h5IGF0IHRoZSBwYXJlbnQncyB0PTAuXG5mdW5jdGlvbiBfdXNlUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMgPSBudWxsLCBwcm94eVBhdGggPSBudWxsKSB7XG4gIGlmICghaXNDdXJyZW50KCkpIHJldHVybjtcbiAgY29uc3QgcmVzdW1lQXQgICA9IHZpZGVvRWwuY3VycmVudFRpbWUgfHwgc3RhcnRTIHx8IDA7XG4gIGNvbnN0IHdhc1BsYXlpbmcgPSAhdmlkZW9FbC5wYXVzZWQgJiYgIXZpZGVvRWwuZW5kZWQ7XG4gIHZpZGVvRWwuc3JjID0gX2J1aWxkTWVkaWFVcmwodmlkZW9JZCwgJ3Byb3h5JywgcHJveHlQYXRoKTtcbiAgdmlkZW9FbC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsICgpID0+IHtcbiAgICB0cnkgeyB2aWRlb0VsLmN1cnJlbnRUaW1lID0gcmVzdW1lQXQ7IH0gY2F0Y2ggKF8pIHt9XG4gICAgaWYgKHdhc1BsYXlpbmcpIHZpZGVvRWwucGxheSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgfSwgeyBvbmNlOiB0cnVlIH0pO1xuICBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdwcm94eScpO1xufVxuXG5mdW5jdGlvbiBfYnVpbGRSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0UyA9IG51bGwpIHtcbiAgaWYgKCFpc0N1cnJlbnQoKSkgcmV0dXJuO1xuICBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdidWlsZGluZycpO1xuICBzdHJlYW1TU0UoXG4gICAgYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vcHJveHkvZ2VuZXJhdGVgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIGlmICghaXNDdXJyZW50KCkpIHJldHVybjtcbiAgICAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IGZldGNoKGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L3Byb3h5LXN0YXR1c2ApXG4gICAgICAgIC50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogbnVsbCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gICAgICBpZiAoc3RhdHVzPy5hdmFpbGFibGUpIF91c2VSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0Uywgc3RhdHVzLnByb3h5X3BhdGgpO1xuICAgICAgLy8gQW5vdGhlciBvcGVuIGlzIHN0aWxsIGVuY29kaW5nIC0gcG9sbCB1bnRpbCBpdHMgcHJveHkgbGFuZHMuXG4gICAgICBlbHNlIGlmIChzdGF0dXM/LmdlbmVyYXRpbmcpIHNldFRpbWVvdXQoKCkgPT4gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMpLCA1MDAwKTtcbiAgICAgIGVsc2UgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAnb3JpZ2luYWwnLCBudWxsLCAoKSA9PiBfYnVpbGRSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0UykpO1xuICAgIH0sXG4gICAgbnVsbCwgICAgICAgIC8vIG5vIGdsb2JhbCBqb2IgcGlsbCAtIHRoaXMgaXMgYSBiYWNrZ3JvdW5kIGNvbnZlbmllbmNlXG4gICAgJ1ByZXZpZXcnLFxuICAgIGZhbHNlLFxuICAgIGxpbmUgPT4geyAgICAvLyBvbkxpbmU6IHN1cmZhY2UgdGhlIGVuY29kZSBwZXJjZW50YWdlIG9uIHRoZSBiYWRnZVxuICAgICAgY29uc3QgbSA9IC8oXFxkKyklLy5leGVjKGxpbmUpO1xuICAgICAgaWYgKG0gJiYgaXNDdXJyZW50KCkpIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ2J1aWxkaW5nJywgbVsxXSk7XG4gICAgfSxcbiAgKTtcbn1cblxuZnVuY3Rpb24gX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCBtb2RlLCBwY3QsIG9uQnVpbGQpIHtcbiAgaWYgKCFiYWRnZUVsKSByZXR1cm47XG4gIC8vIFJlc2V0IHRvIGEgbm9uLWludGVyYWN0aXZlIHN0YXR1cyBpbmRpY2F0b3I7IHRoZSBidWlsZCBhZmZvcmRhbmNlIGJlbG93XG4gIC8vIHJlLWFybXMgaXQgYXMgYSBidXR0b24gc28gcm9sZS90YWJpbmRleCBuZXZlciBnbyBzdGFsZSBiZXR3ZWVuIHN0YXRlcy5cbiAgYmFkZ2VFbC5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gIGJhZGdlRWwub25jbGljayA9IG51bGw7XG4gIGJhZGdlRWwub25rZXlkb3duID0gbnVsbDtcbiAgYmFkZ2VFbC5zdHlsZS5jdXJzb3IgPSAnJztcbiAgYmFkZ2VFbC5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICBiYWRnZUVsLnJlbW92ZUF0dHJpYnV0ZSgndGFiaW5kZXgnKTtcbiAgYmFkZ2VFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnc3RhdHVzJyk7XG4gIGJhZGdlRWwuY2xhc3NMaXN0LnRvZ2dsZSgncHJldmlldy1iYWRnZS1wcm94eScsIG1vZGUgPT09ICdwcm94eScpO1xuICBiYWRnZUVsLmNsYXNzTGlzdC5yZW1vdmUoJ3ByZXZpZXctYmFkZ2UtYnVpbGQnKTtcbiAgaWYgKG1vZGUgPT09ICdwcm94eScpIHtcbiAgICBiYWRnZUVsLnRleHRDb250ZW50ID0gJ1ByZXZpZXcgcXVhbGl0eSAoNzIwcCknO1xuICAgIGJhZGdlRWwudGl0bGUgPSAnUGxheWluZyBhIGRvd25zY2FsZWQgNzIwcCBwcmV2aWV3IGZvciBmYXN0IHNlZWtpbmcgLSBub3QgZnVsbCBxdWFsaXR5LiBFeHBvcnRzIHVzZSB0aGUgb3JpZ2luYWwuJztcbiAgfSBlbHNlIGlmIChtb2RlID09PSAnYnVpbGRpbmcnKSB7XG4gICAgYmFkZ2VFbC50ZXh0Q29udGVudCA9IHBjdCA/IGBCdWlsZGluZyA3MjBwIHByZXZpZXfigKYgJHtwY3R9JWAgOiAnQnVpbGRpbmcgNzIwcCBwcmV2aWV34oCmJztcbiAgICBiYWRnZUVsLnRpdGxlID0gJ0VuY29kaW5nIGEgZmFzdC1zZWVraW5nIDcyMHAgcHJldmlldyBmcm9tIHRoZSBzb3VyY2UgcmVjb3JkaW5nLic7XG4gIH0gZWxzZSBpZiAob25CdWlsZCkge1xuICAgIC8vIFJlbmRlciB0aGUgYWN0aW9uIGFzIGEgYnV0dG9uLXN0eWxlZCBwaWxsIHNvIGl0IG9idmlvdXNseSBpbnZpdGVzIGEgY2xpY2suXG4gICAgYmFkZ2VFbC5jbGFzc0xpc3QuYWRkKCdwcmV2aWV3LWJhZGdlLWJ1aWxkJyk7XG4gICAgYmFkZ2VFbC5pbm5lckhUTUwgPSAnT3JpZ2luYWwgcXVhbGl0eSDCtyA8c3BhbiBjbGFzcz1cInByZXZpZXctYmFkZ2UtYWN0aW9uXCI+JiM5ODg5OyBCdWlsZCA3MjBwIHByZXZpZXc8L3NwYW4+JztcbiAgICBiYWRnZUVsLnRpdGxlID0gJ1BsYXlpbmcgdGhlIGZ1bGwtcXVhbGl0eSBvcmlnaW5hbC4gQnVpbGQgYSA3MjBwIHByZXZpZXcgc28gc2Vla2luZyBpcyBmYXN0Lic7XG4gICAgYmFkZ2VFbC5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgYmFkZ2VFbC5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ2F1dG8nO1xuICAgIGJhZGdlRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuICAgIGJhZGdlRWwudGFiSW5kZXggPSAwO1xuICAgIGJhZGdlRWwub25jbGljayA9IG9uQnVpbGQ7XG4gICAgYmFkZ2VFbC5vbmtleWRvd24gPSAoZSkgPT4geyBpZiAoZS5rZXkgPT09ICdFbnRlcicgfHwgZS5rZXkgPT09ICcgJykgeyBlLnByZXZlbnREZWZhdWx0KCk7IG9uQnVpbGQoKTsgfSB9O1xuICB9IGVsc2Uge1xuICAgIGJhZGdlRWwudGV4dENvbnRlbnQgPSAnT3JpZ2luYWwgcXVhbGl0eSDCtyBzbG93ZXIgc2Vla2luZyc7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdQbGF5aW5nIHRoZSBvcmlnaW5hbCByZWNvcmRpbmcgLSBzZWVraW5nIGEgbG9uZyBmaWxlIGNhbiBiZSBzbG93Lic7XG4gIH1cbn1cbiIsICIvLyBGZWF0dXJlLW1hcCAtIENyb3NzLWN1dHRpbmcgVUkgZmVlZGJhY2sgaGVscGVycyB3aXRoIG5vIGhvbWUgaW4gYSBzaW5nbGUgZmVhdHVyZTogdG9hc3RzLCB0aGVcclxuLy8gICBib3R0b20gbG9nIHBhbmVsLCBzb3J0LWRpcmVjdGlvbiBidXR0b25zLCBzcGVha2VyLWxhYmVscyAoZGlhcml6YXRpb24pIHJlYWRpbmVzcywgXCJyZXZlYWwgaW5cclxuLy8gICBmb2xkZXJcIiwgYW5kIGNsaXBib2FyZCBjb3B5LiBTdGF0ZS9mb3JtYXQvam9iLVNTRS9wcmV2aWV3IG1hY2hpbmVyeSBzcGxpdCBvdXQgaW4gc3RhZ2UgMDIuXHJcbi8vICAgQVBJOiByb3V0ZXMvY29uZmlnLnB5LCByb3V0ZXMvbG9ncy5weSAoaW5kaXJlY3RseSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHlcclxuaW1wb3J0IHsgZXNjSHRtbCwgc3RyaXBSaWNoTWFya3VwIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xyXG5cclxuLy8g4pSA4pSAIHNvcnQtZGlyZWN0aW9uIHRvZ2dsZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gUmVmbGVjdHMgYSBzb3J0LWRpcmVjdGlvbiB0b2dnbGUncyBjdXJyZW50IHN0YXRlIG9udG8gaXRzIGJ1dHRvbjogYXJyb3cgZ2x5cGgsXHJcbi8vIGFyaWEtcHJlc3NlZCwgYW5kIGEgc2VsZi1kZXNjcmliaW5nIGFyaWEtbGFiZWwuICdkZXNjJyBpcyB0aGUgc29ydCBvcHRpb24nc1xyXG4vLyBuYXR1cmFsIG9yZGVyIChoaWdoZXN0L25ld2VzdCBmaXJzdCk7ICdhc2MnIHJldmVyc2VzIGl0LlxyXG5leHBvcnQgZnVuY3Rpb24gX3N5bmNTb3J0RGlyQnRuKGJ0bklkLCBkaXIpIHtcclxuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChidG5JZCk7XHJcbiAgaWYgKCFidG4pIHJldHVybjtcclxuICBjb25zdCBhc2MgPSBkaXIgPT09ICdhc2MnO1xyXG4gIGJ0bi5pbm5lckhUTUwgPSBhc2MgPyAnJiM4NTkzOycgOiAnJiM4NTk1Oyc7XHJcbiAgYnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJywgYXNjID8gJ3RydWUnIDogJ2ZhbHNlJyk7XHJcbiAgYnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGFzY1xyXG4gICAgPyAnU29ydGVkIGFzY2VuZGluZyAtIGNsaWNrIHRvIHNvcnQgZGVzY2VuZGluZydcclxuICAgIDogJ1NvcnRlZCBkZXNjZW5kaW5nIC0gY2xpY2sgdG8gc29ydCBhc2NlbmRpbmcnKTtcclxuICBidG4udGl0bGUgPSBhc2MgPyAnQXNjZW5kaW5nIG9yZGVyJyA6ICdEZXNjZW5kaW5nIG9yZGVyJztcclxufVxyXG5cclxuLy8g4pSA4pSAIHNwZWFrZXIgbGFiZWxzIChkaWFyaXphdGlvbikgcmVhZGluZXNzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBTcGVlY2hCcmFpbiAodGhlIGRlZmF1bHQgYmFja2VuZCkgaXMgYnVuZGxlZCAtIGl0cyBwYWNrYWdlIHNob3VsZCBhbHdheXMgYmVcclxuLy8gcHJlc2VudCwgc28gYW4gdW5yZWFkeSByZXN1bHQgdGhlcmUgbWVhbnMgYSBicm9rZW4gaW5zdGFsbCwgbm90IGEgbWlzc2luZ1xyXG4vLyBvcHRpb25hbCBkb3dubG9hZC4gUHlhbm5vdGUgaXMgdGhlIGFkdmFuY2VkLCB0b2tlbi1nYXRlZCBhbHRlcm5hdGl2ZSBhbmQgc3RpbGxcclxuLy8gbmVlZHMgYSByZWFsIGluc3RhbGwgKyBhIEh1Z2dpbmdGYWNlIHRva2VuLiBUaGUgcGVyLXJ1biBjaGVja2JveGVzIGluIHRoZVxyXG4vLyBhbmFseXplIGFuZCBleHBvcnQgcGFuZWxzIGJvdGggZ2F0ZSBvbiB0aGlzIHNpbmdsZSBjaGVjay4gQ2VudHJhbGl6ZWQgaGVyZSBzb1xyXG4vLyB0aGUgdGhyZWUgc3VyZmFjZXMgKFNldHRpbmdzLCBhbmFseXplLCBleHBvcnQpIGNhbid0IGRyaWZ0IHRvIGRpZmZlcmVudCBydWxlcy5cclxuZXhwb3J0IGZ1bmN0aW9uIF9kaWFyaXphdGlvblJlYXNvbihpbnN0YWxsZWQpIHtcclxuICByZXR1cm4gaW5zdGFsbGVkID8gJycgOiAnU3BlZWNoQnJhaW4gaXMgdW5hdmFpbGFibGUgLSB0cnkgcmVpbnN0YWxsaW5nIFl1dUNsaXAnO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX2RpYXJpemF0aW9uUmVhZGluZXNzKCkge1xyXG4gIGNvbnN0IGNmZyA9IGF3YWl0IGZldGNoKCcvYXBpL2NvbmZpZycpLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gKHt9KSk7XHJcbiAgY29uc3QgYmFja2VuZCA9IGNmZy5kaWFyaXphdGlvbl9iYWNrZW5kIHx8ICdzcGVlY2hicmFpbic7XHJcbiAgY29uc3QgaW5zdGFsbCA9IGF3YWl0IGZldGNoKCcvYXBpL2luc3RhbGwvc3BlZWNoYnJhaW4nKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+ICh7aW5zdGFsbGVkOiBmYWxzZX0pKTtcclxuICBjb25zdCBpbnN0YWxsZWQgPSAhIWluc3RhbGwuaW5zdGFsbGVkO1xyXG4gIHJldHVybiB7XHJcbiAgICBpbnN0YWxsZWQsXHJcbiAgICBiYWNrZW5kLFxyXG4gICAgcmVhZHk6ICAgaW5zdGFsbGVkLFxyXG4gICAgcmVhc29uOiAgX2RpYXJpemF0aW9uUmVhc29uKGluc3RhbGxlZCksXHJcbiAgfTtcclxufVxyXG5cclxuLy8gTm90ZSBzaG93biBvbiBhIGRpc2FibGVkIHNwZWFrZXItbGFiZWxzIGNvbnRyb2w6IHRoZSBibG9ja2luZyByZWFzb24gcGx1cyBhXHJcbi8vIGJ1dHRvbiB0aGF0IGp1bXBzIHRvIFNldHRpbmdzLiBzZXR0aW5nc09uY2xpY2sgY2xvc2VzIHRoZSBob3N0IHN1cmZhY2UgZmlyc3RcclxuLy8gKHRoZSBhbmFseXplIHBhbmVsIG9yIGV4cG9ydCBtb2RhbCkgc28gU2V0dGluZ3MgaXNuJ3Qgb3BlbmVkIGJlaGluZCBpdC5cclxuZXhwb3J0IGZ1bmN0aW9uIF9kaWFyaXphdGlvbk5vdGVIdG1sKHJlYXNvbiwgc2V0dGluZ3NPbmNsaWNrKSB7XHJcbiAgcmV0dXJuIGVzY0h0bWwocmVhc29uKSArICcgLSBzZXQgdXAgaW4gJyArXHJcbiAgICAnPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzowIDRweDtjb2xvcjp2YXIoLS1hY2NlbnQpOycgK1xyXG4gICAgYGRpc3BsYXk6aW5saW5lLWZsZXhcIiBvbmNsaWNrPVwiJHtlc2NIdG1sKHNldHRpbmdzT25jbGljayl9XCI+U2V0dGluZ3M8L2J1dHRvbj5gO1xyXG59XHJcblxyXG4vLyDilIDilIAgbG9nIHBhbmVsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5leHBvcnQgZnVuY3Rpb24gb3BlbkxvZygpIHtcclxuICBjb25zdCBwYW5lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctcGFuZWwnKTtcclxuICBwYW5lbC5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XHJcbiAgcGFuZWwuY2xhc3NMaXN0LnJlbW92ZSgnbWluaW1pemVkJyk7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy10b2dnbGUnKS50ZXh0Q29udGVudCA9ICfilrInO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlTG9nKCkge1xyXG4gIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1wYW5lbCcpO1xyXG4gIGNvbnN0IG1pbmltaXplZCA9IHBhbmVsLmNsYXNzTGlzdC50b2dnbGUoJ21pbmltaXplZCcpO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctdG9nZ2xlJykudGV4dENvbnRlbnQgPSBtaW5pbWl6ZWQgPyAn4pa8JyA6ICfilrInO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tbG9nLXRvZ2dsZScpLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIG1pbmltaXplZCA/ICdmYWxzZScgOiAndHJ1ZScpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJMb2coKSB7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1saW5lcycpLmlubmVySFRNTCA9ICcnO1xyXG59XHJcblxyXG4vLyBUaGUgbG9nIGhlYWRlcidzIHRvZ2dsZS9jbGVhciBidXR0b25zIGFyZSBzdGF0aWMgbWFya3VwIGluIGluZGV4Lmh0bWwgKG5ldmVyXHJcbi8vIHJlLXJlbmRlcmVkKSwgc28gdGhpcyBvbmUtdGltZSB3aXJpbmcgYXQgbW9kdWxlIGxvYWQgY2FuJ3QgZG91YmxlLWZpcmUuXHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tbG9nLXRvZ2dsZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdG9nZ2xlTG9nKTtcclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jbGVhci1sb2cnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGNsZWFyTG9nKTtcclxuXHJcbi8vIENhcCB0aGUgbG9nIERPTS4gQW4gdW5ib3VuZGVkIGxvZyBmcm96ZSB0aGUgYnJvd3NlciBvbiBsb25nIHJ1bnMgYW5kLCB3b3JzZSxcclxuLy8gd2hlbiBhIHJlYXR0YWNoZWQgYW5hbHl6ZSBzdHJlYW0gcmVwbGF5ZWQgYSBsYXJnZSBidWZmZXIgYWxsIGF0IG9uY2UgKGVhY2ggbGluZVxyXG4vLyB0cmlnZ2VycyBhIHNjcm9sbC10by1ib3R0b20gcmVmbG93KSAtIHRoZSB0YWIgbG9ja2VkIHVwLCB0aGUgZWxhcHNlZCB0aW1lclxyXG4vLyBhcHBlYXJlZCBmcm96ZW4sIGFuZCBDYW5jZWwgd291bGRuJ3QgcmVzcG9uZC4gS2VlcGluZyBvbmx5IHRoZSBtb3N0IHJlY2VudCBsaW5lc1xyXG4vLyBib3VuZHMgdGhlIHJlZmxvdyBjb3N0OyB0aGUgZnVsbCBsb2cgYWx3YXlzIHJlbWFpbnMgaW4gLnl1dS1jbGlwL3l1dS1jbGlwLmxvZy5cclxuY29uc3QgX01BWF9MT0dfTElORVMgPSA1MDA7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kTG9nKHJhdykge1xyXG4gIGNvbnN0IHRleHQgPSBzdHJpcFJpY2hNYXJrdXAocmF3KTtcclxuICBpZiAoIXRleHQudHJpbSgpKSByZXR1cm47XHJcbiAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgY29uc3QgaXNPayAgID0gcmF3LmluY2x1ZGVzKCcgT0snKSB8fCByYXcuaW5jbHVkZXMoJ1tncmVlbl0nKSB8fCByYXcuaW5jbHVkZXMoJ0RvbmUnKTtcclxuICBjb25zdCBpc0VyciAgID0gcmF3LmluY2x1ZGVzKCdGQUlMJykgfHwgcmF3LmluY2x1ZGVzKCdFcnJvcicpIHx8IHJhdy5pbmNsdWRlcygnW3JlZF0nKSB8fCByYXcuaW5jbHVkZXMoJ2Vycm9yJyk7XHJcbiAgY29uc3QgaXNXYXJuICA9IHJhdy5pbmNsdWRlcygnW3llbGxvd10nKSB8fCByYXcuaW5jbHVkZXMoJ1dBUk5JTkcnKSB8fCByYXcuaW5jbHVkZXMoJ292ZXJsYXAnKTtcclxuICBkaXYuY2xhc3NOYW1lID0gJ2xvZy1saW5lJyArIChpc09rID8gJyBvaycgOiBpc0VyciA/ICcgZXJyJyA6IGlzV2FybiA/ICcgd2FybicgOiAnJyk7XHJcbiAgZGl2LnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XHJcbiAgZGl2LnN0eWxlLmdhcCA9ICc2cHgnO1xyXG4gIGNvbnN0IHRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIHRzLnN0eWxlLmNzc1RleHQgPSAnY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMHB4O2ZsZXgtc2hyaW5rOjA7b3BhY2l0eTouNyc7XHJcbiAgdHMudGV4dENvbnRlbnQgPSBuZXcgRGF0ZSgpLnRvTG9jYWxlVGltZVN0cmluZyh1bmRlZmluZWQsIHtob3VyOicyLWRpZ2l0JywgbWludXRlOicyLWRpZ2l0Jywgc2Vjb25kOicyLWRpZ2l0J30pO1xyXG4gIGRpdi5hcHBlbmRDaGlsZCh0cyk7XHJcbiAgZGl2LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHQpKTtcclxuICBjb25zdCBsaW5lcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctbGluZXMnKTtcclxuICBsaW5lcy5hcHBlbmRDaGlsZChkaXYpO1xyXG4gIHdoaWxlIChsaW5lcy5jaGlsZEVsZW1lbnRDb3VudCA+IF9NQVhfTE9HX0xJTkVTKSBsaW5lcy5yZW1vdmVDaGlsZChsaW5lcy5maXJzdEVsZW1lbnRDaGlsZCk7XHJcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctYm9keScpO1xyXG4gIGJvZHkuc2Nyb2xsVG9wID0gYm9keS5zY3JvbGxIZWlnaHQ7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCB0b2FzdCBub3RpZmljYXRpb25zIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBUeXBlczogc3VjY2VzcyB8IGluZm8gfCB3YXJuaW5nIChndWFyZC9ndWlkYW5jZSkgfCBlcnJvciAoYWN0dWFsIGZhaWx1cmVzKS5cclxuLy8gRXJyb3IgdG9hc3RzIHBlcnNpc3QgdW50aWwgZGlzbWlzc2VkIC0gZHVyYXRpb25NcyBpcyBpZ25vcmVkIGZvciB0aGVtLlxyXG4vLyBvcHRzOiB7IGR1cmF0aW9uTXMsIGFjdGlvbjoge2xhYmVsLCBvbkNsaWNrfSB9XHJcbmNvbnN0IFRPQVNUX1NUQUNLX01BWCA9IDQ7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2UsIHR5cGUgPSAnc3VjY2VzcycsIG9wdHMgPSB7fSkge1xyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b2FzdC1jb250YWluZXInKTtcclxuICBjb25zdCBsaXZlUmVnaW9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodHlwZSA9PT0gJ2Vycm9yJyA/ICdzci1saXZlLWFzc2VydGl2ZScgOiAnc3ItbGl2ZS1wb2xpdGUnKTtcclxuICBpZiAobGl2ZVJlZ2lvbikgeyBsaXZlUmVnaW9uLnRleHRDb250ZW50ID0gJyc7IHNldFRpbWVvdXQoKCkgPT4geyBsaXZlUmVnaW9uLnRleHRDb250ZW50ID0gbWVzc2FnZTsgfSwgMTApOyB9XHJcbiAgd2hpbGUgKGNvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGggPj0gVE9BU1RfU1RBQ0tfTUFYKSBjb250YWluZXIuZmlyc3RFbGVtZW50Q2hpbGQucmVtb3ZlKCk7XHJcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICB0b2FzdC5jbGFzc05hbWUgPSBgdG9hc3QgJHt0eXBlfWA7XHJcbiAgdG9hc3Quc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoxMHB4JztcclxuICBjb25zdCBtc2cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgbXNnLnRleHRDb250ZW50ID0gbWVzc2FnZTtcclxuICB0b2FzdC5hcHBlbmRDaGlsZChtc2cpO1xyXG4gIGNvbnN0IGJ1dHRvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBidXR0b25zLnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2dhcDo2cHg7YWxpZ24taXRlbXM6Y2VudGVyO2ZsZXgtc2hyaW5rOjAnO1xyXG4gIGlmIChvcHRzLmFjdGlvbikge1xyXG4gICAgY29uc3QgYWN0aW9uQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgICBhY3Rpb25CdG4uY2xhc3NOYW1lID0gJ2J0biBnaG9zdCc7XHJcbiAgICBhY3Rpb25CdG4uc3R5bGUuY3NzVGV4dCA9ICdmb250LXNpemU6MTFweDtwYWRkaW5nOjJweCA4cHgnO1xyXG4gICAgYWN0aW9uQnRuLnRleHRDb250ZW50ID0gb3B0cy5hY3Rpb24ubGFiZWw7XHJcbiAgICBhY3Rpb25CdG4ub25jbGljayA9ICgpID0+IHsgdG9hc3QucmVtb3ZlKCk7IG9wdHMuYWN0aW9uLm9uQ2xpY2soKTsgfTtcclxuICAgIGJ1dHRvbnMuYXBwZW5kQ2hpbGQoYWN0aW9uQnRuKTtcclxuICB9XHJcbiAgY29uc3QgY2xvc2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBjbG9zZS50ZXh0Q29udGVudCA9ICfDlyc7XHJcbiAgY2xvc2Uuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0Rpc21pc3MnKTtcclxuICBjbG9zZS5zdHlsZS5jc3NUZXh0ID0gYGJhY2tncm91bmQ6bm9uZTtib3JkZXI6bm9uZTtjb2xvcjppbmhlcml0O2N1cnNvcjpwb2ludGVyO2ZvbnQtc2l6ZToxOHB4O2xpbmUtaGVpZ2h0OjE7cGFkZGluZzowO2ZsZXgtc2hyaW5rOjA7b3BhY2l0eToke3R5cGUgPT09ICdlcnJvcicgPyAnLjgnIDogJy41J31gO1xyXG4gIGNsb3NlLm9uY2xpY2sgPSAoKSA9PiB0b2FzdC5yZW1vdmUoKTtcclxuICBidXR0b25zLmFwcGVuZENoaWxkKGNsb3NlKTtcclxuICB0b2FzdC5hcHBlbmRDaGlsZChidXR0b25zKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QpO1xyXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSByZXR1cm47XHJcbiAgY29uc3QgbXMgPSBvcHRzLmR1cmF0aW9uTXMgPz8gKHR5cGUgPT09ICd3YXJuaW5nJyA/IDYwMDAgOiA0MDAwKTtcclxuICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgIHRvYXN0LnN0eWxlLnRyYW5zaXRpb24gPSAnb3BhY2l0eSAuM3MnO1xyXG4gICAgdG9hc3Quc3R5bGUub3BhY2l0eSA9ICcwJztcclxuICAgIHNldFRpbWVvdXQoKCkgPT4gdG9hc3QucmVtb3ZlKCksIDMwMCk7XHJcbiAgfSwgbXMpO1xyXG59XHJcblxyXG4vLyDilIDilIAgbmV0d29yayBlcnJvciBjb3B5IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBBIGZldGNoKCkgcmVqZWN0aW9uIG1lYW5zIHRoZSByZXF1ZXN0IG5ldmVyIGdvdCBhIHJlc3BvbnNlIC0gb24gdGhpcyBsb2NhbGhvc3QvXHJcbi8vIEVsZWN0cm9uIGFwcCB0aGF0IGFsbW9zdCBhbHdheXMgbWVhbnMgdGhlIGJhY2tlbmQgc3RvcHBlZCwgbm90IGEgcmVhbCBuZXR3b3JrLlxyXG4vLyBUaGUgYnJvd3NlciByZXBvcnRzIGl0IGFzIGEgVHlwZUVycm9yIHdob3NlIG1lc3NhZ2UgaXMgdGhlIG9wYXF1ZSBcIkZhaWxlZCB0b1xyXG4vLyBmZXRjaFwiLCB1c2VsZXNzIHRvIGEgbm9uLWRldmVsb3Blci4gQW4gRXJyb3IgdGhyb3duIGFmdGVyIGEgbm9uLW9rIHJlc3BvbnNlXHJcbi8vIGFscmVhZHkgY2FycmllcyBhIHJlYWwsIHNwZWNpZmljIG1lc3NhZ2UsIHNvIHBhc3MgdGhvc2UgdGhyb3VnaCB1bmNoYW5nZWQuIFVzZVxyXG4vLyB0aGlzIG9ubHkgYXQgY2F0Y2ggc2l0ZXMgdGhhdCB3cmFwIGEgYmFyZSBmZXRjaCAobm90IG9uZXMgZG9pbmcgRE9NIHdvcmsgdGhhdFxyXG4vLyBjb3VsZCB0aHJvdyBpdHMgb3duIFR5cGVFcnJvcikuXHJcbmV4cG9ydCBmdW5jdGlvbiBuZXRFcnJNc2coZXJyKSB7XHJcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFR5cGVFcnJvcikgcmV0dXJuIFwiQ291bGRuJ3QgcmVhY2ggWXV1Q2xpcCAtIGl0IG1heSBoYXZlIHN0b3BwZWQuIFRyeSBhZ2Fpbiwgb3IgcmVzdGFydCB0aGUgYXBwLlwiO1xyXG4gIHJldHVybiAoZXJyICYmIGVyci5tZXNzYWdlKSB8fCAnVW5rbm93biBlcnJvcic7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCByZXZlYWwgaW4gZmlsZSBleHBsb3JlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJldmVhbEluRm9sZGVyKHBhdGgpIHtcclxuICB0cnkge1xyXG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvcmV2ZWFsJywge1xyXG4gICAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7cGF0aH0pLFxyXG4gICAgfSk7XHJcbiAgICBpZiAoIXJlcy5vaykge1xyXG4gICAgICBjb25zdCBlID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcclxuICAgICAgc2hvd1RvYXN0KGBDb3VsZCBub3Qgc2hvdyBpbiBmb2xkZXI6ICR7ZS5kZXRhaWwgfHwgJ2ZhaWxlZCd9YCwgJ2Vycm9yJyk7XHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBzaG93VG9hc3QoYENvdWxkIG5vdCBzaG93IGluIGZvbGRlcjogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBjbGlwYm9hcmQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIFRoZSBhcHAgb25seSBldmVyIHJ1bnMgb24gbG9jYWxob3N0IG9yIGluc2lkZSBFbGVjdHJvbiwgc28gbmF2aWdhdG9yLmNsaXBib2FyZFxyXG4vLyBpcyBhbHdheXMgYXZhaWxhYmxlIC0gYSBmYWlsdXJlIHRvYXN0IGlzIGVub3VnaCwgbm8gZXhlY0NvbW1hbmQgZmFsbGJhY2suXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb3B5VGV4dCh0ZXh0LCBsYWJlbCkge1xyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KTtcclxuICAgIHNob3dUb2FzdChgJHtsYWJlbH0gY29waWVkYCwgJ3N1Y2Nlc3MnKTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHNob3dUb2FzdChgQ291bGQgbm90IGNvcHkgJHtsYWJlbC50b0xvd2VyQ2FzZSgpfTogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBjb2xsYXBzaWJsZSBkZXRhaWwgY2FyZHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIE9wdC1pbjogYnVpbGQgYSBjYXJkIHdpdGggY29sbGFwc2libGVDYXJkKGtleSwgdGl0bGUsIGJvZHksIHthY3Rpb25zfSkuIFRoZVxyXG4vLyB0aXRsZSBpcyByZW5kZXJlZCBpbnNpZGUgYSByZWFsIDxidXR0b24gY2xhc3M9XCJjYXJkLXRvZ2dsZVwiPiwgc28gdGhlIHRvZ2dsZVxyXG4vLyBoYXMgbmF0aXZlIGtleWJvYXJkL2ZvY3VzIGJlaGF2aW91ciBhbmQgLSBiZWNhdXNlIHNob3J0Y3V0cy5qcydzIGdsb2JhbFxyXG4vLyBrZXlkb3duIGJhaWxzIG9uIHRhZ05hbWUgPT09ICdCVVRUT04nIC0gU3BhY2Ugb24gYSBmb2N1c2VkIHRvZ2dsZSBuZXZlciBhbHNvXHJcbi8vIGZpcmVzIHBsYXkvcGF1c2UuIEhlYWRlciBhY3Rpb24gY29udHJvbHMgYXJlIHBhc3NlZCB2aWEgb3B0cy5hY3Rpb25zIGFuZCBzaXRcclxuLy8gYXMgU0lCTElOR1Mgb2YgdGhlIHRvZ2dsZSBidXR0b24sIG5ldmVyIGRlc2NlbmRhbnRzLCBzbyBhIGJ1dHRvbiBuZXZlciBuZXN0c1xyXG4vLyBpbnNpZGUgdGhlIHRvZ2dsZSAoV0NBRyA0LjEuMiBuZXN0ZWQtaW50ZXJhY3RpdmUpLiBTZWVkZWQgZnJvbSBpc0NhcmRDb2xsYXBzZWQoa2V5KS5cclxuY29uc3QgX0NBUkRfQ09MTEFQU0VfS0VZID0gJ3l1dWNsaXAtY2FyZC1jb2xsYXBzZWQnO1xyXG5cclxuZnVuY3Rpb24gX2NhcmRDb2xsYXBzZVN0YXRlKCkge1xyXG4gIHRyeSB7IHJldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKF9DQVJEX0NPTExBUFNFX0tFWSkgfHwgJ3t9JykgfHwge307IH1cclxuICBjYXRjaCB7IHJldHVybiB7fTsgfVxyXG59XHJcblxyXG4vLyBQZXJzaXN0ZWQgY29sbGFwc2Ugc3RhdGUgcGVyIGNhcmQga2V5LiBkZWZhdWx0Q29sbGFwc2VkIGxldHMgYSBjYXJkIChlLmcuIHRoZVxyXG4vLyBoZWF2eSBmdWxsLXZpZGVvIHRyYW5zY3JpcHQpIHN0YXJ0IGNvbGxhcHNlZCB1bnRpbCB0aGUgdXNlciBvcGVucyBpdC5cclxuZnVuY3Rpb24gaXNDYXJkQ29sbGFwc2VkKGtleSwgZGVmYXVsdENvbGxhcHNlZCA9IGZhbHNlKSB7XHJcbiAgY29uc3Qgc3RhdGUgPSBfY2FyZENvbGxhcHNlU3RhdGUoKTtcclxuICByZXR1cm4ga2V5IGluIHN0YXRlID8gISFzdGF0ZVtrZXldIDogZGVmYXVsdENvbGxhcHNlZDtcclxufVxyXG5cclxuLy8gU2luZ2xlIHNvdXJjZSBvZiB0aGUgY29sbGFwc2libGUtY2FyZCBtYXJrdXAgY29udHJhY3Q6IHRoZSB+MTEgZGV0YWlsIGNhcmRzXHJcbi8vIHRoYXQgb3B0IGluIGFsbCByZW5kZXIgdGhyb3VnaCBoZXJlIHNvIG5vbmUgY2FuIGRyaWZ0IGZyb20gdGhlIGNsYXNzIC9cclxuLy8gZGF0YS1jb2xsYXBzZS1rZXkgLyB0b2dnbGUtYTExeSBhdHRyaWJ1dGVzIHRoZSB0b2dnbGUgbG9naWMgYmVsb3cgcmVhZHMuXHJcbi8vIHRpdGxlID0gdGhlIGhlYWRlcidzIHRpdGxlIGNvbnRlbnQgKGdvZXMgaW5zaWRlIHRoZSB0b2dnbGUgYnV0dG9uKTsgYm9keSA9XHJcbi8vIGV2ZXJ5dGhpbmcgc2hvd24gYmVsb3cgdGhlIGhlYWRlci4gb3B0cy5hY3Rpb25zID0gaGVhZGVyIGNvbnRyb2xzIHJlbmRlcmVkXHJcbi8vIGJlc2lkZSB0aGUgdG9nZ2xlOyBvcHRzLmRlZmF1bHRDb2xsYXBzZWQgc3RhcnRzIGEgY2FyZCBjb2xsYXBzZWQgdW50aWwgZmlyc3RcclxuLy8gb3BlbmVkOyBvcHRzLmF0dHJzIGFkZHMgY2FyZCBhdHRyaWJ1dGVzIChpZCwgZGF0YS0qKTsgb3B0cy5oZWFkZXJTdHlsZSBzZXRzXHJcbi8vIGFuIGlubGluZSBzdHlsZSBvbiB0aGUgaGVhZGVyIHJvdy5cclxuZXhwb3J0IGZ1bmN0aW9uIGNvbGxhcHNpYmxlQ2FyZChrZXksIHRpdGxlLCBib2R5LCBvcHRzID0ge30pIHtcclxuICBjb25zdCB7IGRlZmF1bHRDb2xsYXBzZWQgPSBmYWxzZSwgYXR0cnMgPSAnJywgaGVhZGVyU3R5bGUgPSAnJywgYWN0aW9ucyA9ICcnIH0gPSBvcHRzO1xyXG4gIGNvbnN0IGNvbGxhcHNlZCA9IGlzQ2FyZENvbGxhcHNlZChrZXksIGRlZmF1bHRDb2xsYXBzZWQpO1xyXG4gIGNvbnN0IHN0eWxlQXR0ciA9IGhlYWRlclN0eWxlID8gYCBzdHlsZT1cIiR7aGVhZGVyU3R5bGV9XCJgIDogJyc7XHJcbiAgY29uc3QgZXh0cmFBdHRycyA9IGF0dHJzID8gYCAke2F0dHJzfWAgOiAnJztcclxuICByZXR1cm4gYFxyXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkIGNvbGxhcHNpYmxlJHtjb2xsYXBzZWQgPyAnIGNvbGxhcHNlZCcgOiAnJ31cIiBkYXRhLWNvbGxhcHNlLWtleT1cIiR7a2V5fVwiJHtleHRyYUF0dHJzfT5cclxuICAgICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkLWhlYWRlclwiJHtzdHlsZUF0dHJ9PlxyXG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY2FyZC10b2dnbGVcIiBhcmlhLWV4cGFuZGVkPVwiJHtjb2xsYXBzZWQgPyAnZmFsc2UnIDogJ3RydWUnfVwiPiR7dGl0bGV9PC9idXR0b24+XHJcbiAgICAgICAgJHthY3Rpb25zfVxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgJHtib2R5fVxyXG4gICAgPC9kaXY+YDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3RvZ2dsZUNvbGxhcHNpYmxlQ2FyZChjYXJkLCB0b2dnbGUpIHtcclxuICBjb25zdCBjb2xsYXBzZWQgPSBjYXJkLmNsYXNzTGlzdC50b2dnbGUoJ2NvbGxhcHNlZCcpO1xyXG4gIHRvZ2dsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBjb2xsYXBzZWQgPyAnZmFsc2UnIDogJ3RydWUnKTtcclxuICBjb25zdCBrZXkgPSBjYXJkLmRhdGFzZXQuY29sbGFwc2VLZXk7XHJcbiAgaWYgKCFrZXkpIHJldHVybjtcclxuICAvLyBQZXJzaXN0IGJlc3QtZWZmb3J0OiBhIHdyaXRlIGZhaWx1cmUgKHByaXZhdGUgbW9kZSwgcXVvdGEpIG11c3Qgbm90IHN3YWxsb3dcclxuICAvLyB0aGUgdG9nZ2xlIG9yIGJsb2NrIHRoZSBsYXp5LWxvYWQgZGlzcGF0Y2ggYmVsb3cuIFRoZSByZWFkIHBhdGhcclxuICAvLyAoX2NhcmRDb2xsYXBzZVN0YXRlKSBpcyBsaWtld2lzZSB0b2xlcmFudC5cclxuICB0cnkge1xyXG4gICAgY29uc3Qgc3RhdGUgPSBfY2FyZENvbGxhcHNlU3RhdGUoKTtcclxuICAgIHN0YXRlW2tleV0gPSBjb2xsYXBzZWQ7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShfQ0FSRF9DT0xMQVBTRV9LRVksIEpTT04uc3RyaW5naWZ5KHN0YXRlKSk7XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLndhcm4oJ0NvdWxkIG5vdCBwZXJzaXN0IGNhcmQgY29sbGFwc2Ugc3RhdGU6JywgZXJyKTtcclxuICB9XHJcbiAgLy8gTGV0cyBhIGNhcmQgbGF6eS1sb2FkIGl0cyBib2R5IHRoZSBmaXJzdCB0aW1lIGl0IGlzIGV4cGFuZGVkLlxyXG4gIGNhcmQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ2NhcmR0b2dnbGUnLCB7IGJ1YmJsZXM6IHRydWUsIGRldGFpbDogeyBrZXksIGNvbGxhcHNlZCB9IH0pKTtcclxufVxyXG5cclxuLy8gT25seSB0aGUgY2FyZCdzIG93biB0b2dnbGUgYnV0dG9uIGNvbGxhcHNlcyBpdCAobmF0aXZlIEVudGVyL1NwYWNlIGFjdGl2YXRlIGl0XHJcbi8vIHRvbykuIE5lc3RlZCBoZWFkZXJzIGluc2lkZSBhIGNvbXBvdW5kIGNhcmQncyBib2R5IGNhcnJ5IG5vIC5jYXJkLXRvZ2dsZSwgc29cclxuLy8gdGhleSBuZWl0aGVyIHRvZ2dsZSBub3Igc2hvdyBhIGNoZXZyb24uXHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuICBjb25zdCB0b2dnbGUgPSBlLnRhcmdldC5jbG9zZXN0KCcuY2FyZC10b2dnbGUnKTtcclxuICBpZiAoIXRvZ2dsZSkgcmV0dXJuO1xyXG4gIGNvbnN0IGNhcmQgPSB0b2dnbGUuY2xvc2VzdCgnLmRldGFpbC1jYXJkLmNvbGxhcHNpYmxlJyk7XHJcbiAgaWYgKGNhcmQpIF90b2dnbGVDb2xsYXBzaWJsZUNhcmQoY2FyZCwgdG9nZ2xlKTtcclxufSk7XHJcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFNoYXJlZCBVSSBwcmltaXRpdmVzIChhbGVydCAvIGNvbmZpcm0gLyBwcm9tcHQgbW9kYWxzKSB1c2VkIGFwcC13aWRlLlxuLy8gICBBUEk6IG5vbmUgKGNsaWVudC1vbmx5KSDCtyBUZXN0czogY292ZXJlZCBpbmRpcmVjdGx5IGJ5IHRoZSB0ZXN0X3VpXyoucHkgc3VpdGVzXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgZXNjSHRtbCB9IGZyb20gJy4vZm9ybWF0LmpzJztcblxuLy8g4pSA4pSAIGFsZXJ0IG1vZGFsIChzaW5nbGUtYnV0dG9uLCBubyBjYW5jZWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9hbGVydE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gc2hvd0FsZXJ0KHRpdGxlLCBib2R5KSB7XG4gIF9hbGVydE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1ib2R5JykuaW5uZXJIVE1MID0gYm9keTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNhbGVydC1tb2RhbCAuYnRuJykuZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQWxlcnRNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfYWxlcnRPcGVuZXI7XG4gIF9hbGVydE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGNvbmZpcm0gbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2NvbmZpcm1PcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIHNob3dDb25maXJtKHRpdGxlLCBib2R5LCBva0xhYmVsLCBvbk9rLCBkYW5nZXIgPSBmYWxzZSwgY2FuY2VsTGFiZWwgPSAnQ2FuY2VsJykge1xuICBfY29uZmlybU9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tYm9keScpLmlubmVySFRNTCA9IGJvZHk7XG4gIGNvbnN0IG9rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tb2stYnRuJyk7XG4gIG9rLnRleHRDb250ZW50ID0gb2tMYWJlbDtcbiAgb2suY2xhc3NOYW1lID0gZGFuZ2VyID8gJ2J0biBkYW5nZXInIDogJ2J0biBwcmltYXJ5JztcbiAgLy8gRXZlcnkgY2FsbCBzZXRzIGl0LCBzbyB0aGUgZGVmYXVsdCAnQ2FuY2VsJyBpcyByZXN0b3JlZCBmb3IgY2FsbGVycyB0aGF0XG4gIC8vIGRvbid0IHBhc3MgYSBjdXN0b20gbGFiZWwgLSBubyBzdGFsZSBsYWJlbCBsZWFrcyBiZXR3ZWVuIGNvbmZpcm1zLlxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1jYW5jZWwtYnRuJykudGV4dENvbnRlbnQgPSBjYW5jZWxMYWJlbDtcbiAgQXBwU3RhdGUuY29uZmlybUNhbGxiYWNrID0gb25PaztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tY2FuY2VsLWJ0bicpLmZvY3VzKCksIDUwKTtcbn1cbmZ1bmN0aW9uIF9jb25maXJtT2soKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBjYiA9IEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjaztcbiAgQXBwU3RhdGUuY29uZmlybUNhbGxiYWNrID0gbnVsbDtcbiAgY29uc3Qgb3BlbmVyID0gX2NvbmZpcm1PcGVuZXI7XG4gIF9jb25maXJtT3BlbmVyID0gbnVsbDtcbiAgaWYgKGNiKSBjYigpO1xuICBlbHNlIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBfY29uZmlybUNhbmNlbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjayA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9jb25maXJtT3BlbmVyO1xuICBfY29uZmlybU9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGFkZGl0aW9uYWwgYWN0aW9ucyBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWN0aW9uc01vZGFsT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBvcGVuQWN0aW9uc01vZGFsKHRpdGxlLCBncm91cHMpIHtcbiAgX2FjdGlvbnNNb2RhbE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsLWJvZHknKTtcbiAgYm9keS5pbm5lckhUTUwgPSAnJztcbiAgZ3JvdXBzLmZvckVhY2goKGdyb3VwLCBpKSA9PiB7XG4gICAgaWYgKGkgPiAwKSB7XG4gICAgICBjb25zdCBkaXZpZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBkaXZpZGVyLmNsYXNzTmFtZSA9ICdoYW1idXJnZXItZGl2aWRlcic7XG4gICAgICBib2R5LmFwcGVuZENoaWxkKGRpdmlkZXIpO1xuICAgIH1cbiAgICBpZiAoZ3JvdXAuaGVhZGluZykge1xuICAgICAgY29uc3QgaGVhZGluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgaGVhZGluZy5jbGFzc05hbWUgPSAnc2VjdGlvbi10aXRsZSc7XG4gICAgICBoZWFkaW5nLnN0eWxlLmNzc1RleHQgPSAnbWFyZ2luOjhweCAwIDJweCA0cHgnO1xuICAgICAgaGVhZGluZy50ZXh0Q29udGVudCA9IGdyb3VwLmhlYWRpbmc7XG4gICAgICBib2R5LmFwcGVuZENoaWxkKGhlYWRpbmcpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHJvdyBvZiBncm91cC5yb3dzKSB7XG4gICAgICBjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgZWwudHlwZSA9ICdidXR0b24nO1xuICAgICAgZWwuY2xhc3NOYW1lID0gJ2FjdGlvbi1yb3cnICsgKHJvdy5kYW5nZXIgPyAnIGRhbmdlcicgOiAnJyk7XG4gICAgICBlbC5kaXNhYmxlZCA9ICEhcm93LmRpc2FibGVkO1xuICAgICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICBsYWJlbC5jbGFzc05hbWUgPSAnYWN0aW9uLXJvdy1sYWJlbCc7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9IHJvdy5sYWJlbDtcbiAgICAgIGNvbnN0IGRlc2MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICBkZXNjLmNsYXNzTmFtZSA9ICdhY3Rpb24tcm93LWRlc2MnO1xuICAgICAgZGVzYy50ZXh0Q29udGVudCA9IHJvdy5kZXNjcmlwdGlvbjtcbiAgICAgIGVsLmFwcGVuZChsYWJlbCwgZGVzYyk7XG4gICAgICBlbC5vbmNsaWNrID0gKCkgPT4geyBjbG9zZUFjdGlvbnNNb2RhbCgpOyByb3cuYWN0aW9uKCk7IH07XG4gICAgICBib2R5LmFwcGVuZENoaWxkKGVsKTtcbiAgICB9XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBib2R5LnF1ZXJ5U2VsZWN0b3IoJy5hY3Rpb24tcm93Om5vdCg6ZGlzYWJsZWQpJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUFjdGlvbnNNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGlvbnMtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9hY3Rpb25zTW9kYWxPcGVuZXI7XG4gIF9hY3Rpb25zTW9kYWxPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBtb2RhbCBsYXllcmluZyArIGZvY3VzIHRyYXAg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBDb25maXJtIGFuZCBhbGVydCBhcmUgdGhlIG9ubHkgbW9kYWxzIHRoYXQgc3RhY2sgb24gdG9wIG9mIG90aGVyIG1vZGFscywgc29cbi8vIHRoZXkgdGFrZSBwcmlvcml0eTsgb3RoZXJ3aXNlIGFsbCAubW9kYWwtYmcgc2hhcmUgei1pbmRleCAyMDAgYW5kIHRoZSBsYXN0XG4vLyB2aXNpYmxlIG9uZSBpbiBET00gb3JkZXIgaXMgdGhlIG9uZSBwYWludGVkIG9uIHRvcC5cbmV4cG9ydCBmdW5jdGlvbiB0b3Btb3N0VmlzaWJsZU1vZGFsKCkge1xuICBmb3IgKGNvbnN0IGlkIG9mIFsnY29uZmlybS1tb2RhbCcsICdhbGVydC1tb2RhbCddKSB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XG4gICAgaWYgKGVsLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpKSByZXR1cm4gZWw7XG4gIH1cbiAgY29uc3QgdmlzaWJsZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb2RhbC1iZy52aXNpYmxlJyk7XG4gIHJldHVybiB2aXNpYmxlLmxlbmd0aCA/IHZpc2libGVbdmlzaWJsZS5sZW5ndGggLSAxXSA6IG51bGw7XG59XG5cbmNvbnN0IF9GT0NVU0FCTEVfU0VMRUNUT1IgPVxuICAnYVtocmVmXSwgYnV0dG9uOm5vdCg6ZGlzYWJsZWQpLCBpbnB1dDpub3QoOmRpc2FibGVkKSwgc2VsZWN0Om5vdCg6ZGlzYWJsZWQpLCAnICtcbiAgJ3RleHRhcmVhOm5vdCg6ZGlzYWJsZWQpLCBbdGFiaW5kZXhdOm5vdChbdGFiaW5kZXg9XCItMVwiXSknO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XG4gIGlmIChlLmtleSAhPT0gJ1RhYicpIHJldHVybjtcbiAgY29uc3QgbW9kYWwgPSB0b3Btb3N0VmlzaWJsZU1vZGFsKCk7XG4gIGlmICghbW9kYWwpIHJldHVybjtcbiAgY29uc3QgZm9jdXNhYmxlcyA9IFsuLi5tb2RhbC5xdWVyeVNlbGVjdG9yQWxsKF9GT0NVU0FCTEVfU0VMRUNUT1IpXVxuICAgIC5maWx0ZXIoZWwgPT4gZWwuZ2V0Q2xpZW50UmVjdHMoKS5sZW5ndGggPiAwKTtcbiAgaWYgKCFmb2N1c2FibGVzLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCBmaXJzdCA9IGZvY3VzYWJsZXNbMF07XG4gIGNvbnN0IGxhc3QgID0gZm9jdXNhYmxlc1tmb2N1c2FibGVzLmxlbmd0aCAtIDFdO1xuICBpZiAoIW1vZGFsLmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIChlLnNoaWZ0S2V5ID8gbGFzdCA6IGZpcnN0KS5mb2N1cygpO1xuICB9IGVsc2UgaWYgKCFlLnNoaWZ0S2V5ICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGxhc3QpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZmlyc3QuZm9jdXMoKTtcbiAgfSBlbHNlIGlmIChlLnNoaWZ0S2V5ICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGZpcnN0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGxhc3QuZm9jdXMoKTtcbiAgfVxufSk7XG5cbi8vIOKUgOKUgCBtZW51IGtleWJvYXJkIHBhdHRlcm4gKGhhbWJ1cmdlciArIGtlYmFiKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmZ1bmN0aW9uIF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSkge1xuICByZXR1cm4gWy4uLm1lbnUucXVlcnlTZWxlY3RvckFsbCgnLmhhbWJ1cmdlci1pdGVtJyldXG4gICAgLmZpbHRlcihlbCA9PiAhZWwuZGlzYWJsZWQgJiYgZWwuZ2V0Q2xpZW50UmVjdHMoKS5sZW5ndGggPiAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9tZW51QXJyb3dLZXlkb3duKG1lbnUsIGUpIHtcbiAgaWYgKGUua2V5ICE9PSAnQXJyb3dEb3duJyAmJiBlLmtleSAhPT0gJ0Fycm93VXAnKSByZXR1cm47XG4gIGNvbnN0IGl0ZW1zID0gX21lbnVGb2N1c2FibGVJdGVtcyhtZW51KTtcbiAgaWYgKCFpdGVtcy5sZW5ndGgpIHJldHVybjtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICBjb25zdCBpZHggID0gaXRlbXMuaW5kZXhPZihkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtcbiAgY29uc3Qgc3RlcCA9IGUua2V5ID09PSAnQXJyb3dEb3duJyA/IDEgOiAtMTtcbiAgaXRlbXNbKGlkeCArIHN0ZXAgKyBpdGVtcy5sZW5ndGgpICUgaXRlbXMubGVuZ3RoXS5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgaGFtYnVyZ2VyIG1lbnUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5leHBvcnQgZnVuY3Rpb24gaXNIYW1idXJnZXJPcGVuKCkge1xuICByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51JykuY2xhc3NMaXN0LmNvbnRhaW5zKCdvcGVuJyk7XG59XG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlSGFtYnVyZ2VyKCkge1xuICBjb25zdCBtZW51ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51Jyk7XG4gIG1lbnUuY2xhc3NMaXN0LnRvZ2dsZSgnb3BlbicpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIG1lbnUuY2xhc3NMaXN0LmNvbnRhaW5zKCdvcGVuJykpO1xuICBpZiAobWVudS5jbGFzc0xpc3QuY29udGFpbnMoJ29wZW4nKSkgX21lbnVGb2N1c2FibGVJdGVtcyhtZW51KVswXT8uZm9jdXMoKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUhhbWJ1cmdlcihyZWZvY3VzVHJpZ2dlciA9IGZhbHNlKSB7XG4gIGNvbnN0IG1lbnUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKTtcbiAgLy8gRm9jdXMgc2l0dGluZyBvbiBhbiBpdGVtIGFib3V0IHRvIGJlIGRpc3BsYXk6bm9uZSdkIHdvdWxkIHNpbGVudGx5IGZhbGwgdG9cbiAgLy8gPGJvZHk+OyBoYW5kIGl0IHRvIHRoZSB0cmlnZ2VyIGZpcnN0IHNvIGl0IGhhcyBzb21ld2hlcmUgcmVhbCB0byBnby5cbiAgaWYgKHJlZm9jdXNUcmlnZ2VyIHx8IG1lbnUuY29udGFpbnMoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLmZvY3VzKCk7XG4gIH1cbiAgbWVudS5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4taGFtYnVyZ2VyJykuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG59XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XG4gIF9tZW51QXJyb3dLZXlkb3duKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpLCBlKTtcbn0pO1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLXdyYXAnKS5jb250YWlucyhlLnRhcmdldCkpIHtcbiAgICBjbG9zZUhhbWJ1cmdlcigpO1xuICB9XG59KTtcblxuLy8g4pSA4pSAIGNvbnRyb2xzIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9jb250cm9sc09wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkNvbnRyb2xzTW9kYWwoKSB7XG4gIF9jb250cm9sc09wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250cm9scy1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjY29udHJvbHMtbW9kYWwgLmJ0bicpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VDb250cm9sc01vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbHMtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9jb250cm9sc09wZW5lcjtcbiAgX2NvbnRyb2xzT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgZGlmZiBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIF9kaWZmU3RhdGU6IHt0aXRsZSwgZmllbGRzOlt7bGFiZWwsY3VycmVudCxwcm9wb3NlZH1dLCBvbkNvbW1pdChhY3Rpb24sIGVkaXRlZFZhbHVlcyl9XG5sZXQgX2RpZmZTdGF0ZSA9IG51bGw7XG5sZXQgX2RpZmZPcGVuZXIgPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gb3BlbkRpZmZNb2RhbCh0aXRsZSwgZmllbGRzLCBvbkNvbW1pdCwgb3B0cyA9IHt9KSB7XG4gIF9kaWZmT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgX2RpZmZTdGF0ZSA9IHt0aXRsZSwgZmllbGRzLCBvbkNvbW1pdH07XG4gIGNvbnN0IHJldmVydCA9IG9wdHMucmV2ZXJ0TW9kZSB8fCBmYWxzZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwtdGl0bGUnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1maWVsZHMnKTtcbiAgY29udGFpbmVyLmlubmVySFRNTCA9IGZpZWxkcy5tYXAoKGYsIGkpID0+IGBcbiAgICA8ZGl2IGNsYXNzPVwiZGlmZi1maWVsZC1ncm91cFwiPlxuICAgICAgJHtmaWVsZHMubGVuZ3RoID4gMSA/IGA8ZGl2IGNsYXNzPVwiZGlmZi1maWVsZC10aXRsZVwiPiR7ZXNjSHRtbChmLmxhYmVsKX08L2Rpdj5gIDogJyd9XG4gICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1wYW5lbHNcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWxcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1wYW5lbC1sYWJlbFwiPiR7cmV2ZXJ0ID8gJ1lvdXIgRWRpdCcgOiAnQ3VycmVudCd9PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtY3VycmVudCR7Zi5jdXJyZW50ID8gJycgOiAnIGVtcHR5J31cIj4ke1xuICAgICAgICAgICAgZi5jdXJyZW50ID8gZXNjSHRtbChmLmN1cnJlbnQpIDogJyhub25lIHlldCknXG4gICAgICAgICAgfTwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWxcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1wYW5lbC1sYWJlbFwiPiR7cmV2ZXJ0ID8gJ09yaWdpbmFsIChMTE0pJyA6ICdOZXcgLSBlZGl0IGhlcmUsIHRoZW4gY2hvb3NlIGJlbG93J308L2Rpdj5cbiAgICAgICAgICAke3JldmVydFxuICAgICAgICAgICAgPyBgPGRpdiBjbGFzcz1cImRpZmYtY3VycmVudCR7Zi5wcm9wb3NlZCA/ICcnIDogJyBlbXB0eSd9XCI+JHtmLnByb3Bvc2VkID8gZXNjSHRtbChmLnByb3Bvc2VkKSA6ICcobm9uZSknfTwvZGl2PmBcbiAgICAgICAgICAgIDogYDx0ZXh0YXJlYSBjbGFzcz1cImRpZmYtbmV3XCIgaWQ9XCJkaWZmLW5ldy0ke2l9XCIgcm93cz1cIjRcIj4ke2VzY0h0bWwoZi5wcm9wb3NlZCB8fCAnJyl9PC90ZXh0YXJlYT5gXG4gICAgICAgICAgfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PmApLmpvaW4oJycpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1kaXNjYXJkLWJ0bicpLnRleHRDb250ZW50ICAgPSByZXZlcnQgPyAnS2VlcCBNeSBFZGl0JyA6ICdEaXNjYXJkJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtYWNjZXB0LWVkaXQtYnRuJykuc3R5bGUuZGlzcGxheSA9IHJldmVydCA/ICdub25lJyA6ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1hY2NlcHQtbmV3LWJ0bicpLnRleHRDb250ZW50ID0gcmV2ZXJ0ID8gJ1JldmVydCB0byBPcmlnaW5hbCcgOiAnQWNjZXB0IGFzLWlzJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGNvbnN0IGZpcnN0VGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1uZXctMCcpO1xuICAgIGlmIChmaXJzdFRhKSBmaXJzdFRhLmZvY3VzKCk7XG4gICAgZWxzZSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1kaXNjYXJkLWJ0bicpPy5mb2N1cygpO1xuICB9LCA1MCk7XG59XG5cbmZ1bmN0aW9uIF9kaWZmR2V0RWRpdGVkKCkge1xuICByZXR1cm4gKF9kaWZmU3RhdGU/LmZpZWxkcyB8fCBbXSkubWFwKChfLCBpKSA9PiB7XG4gICAgY29uc3QgdGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgZGlmZi1uZXctJHtpfWApO1xuICAgIHJldHVybiB0YSA/IHRhLnZhbHVlIDogJyc7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBfZGlmZkNsb3NlRG9uZSgpIHtcbiAgY29uc3Qgb3BlbmVyID0gX2RpZmZPcGVuZXI7XG4gIF9kaWZmT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBfZGlmZkFjY2VwdE5ldygpIHtcbiAgY29uc3QgZWRpdGVkID0gX2RpZmZHZXRFZGl0ZWQoKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IGNiID0gX2RpZmZTdGF0ZT8ub25Db21taXQ7XG4gIF9kaWZmU3RhdGUgPSBudWxsO1xuICBfZGlmZk9wZW5lciA9IG51bGw7XG4gIGlmIChjYikgY2IoJ2FjY2VwdF9uZXcnLCBlZGl0ZWQpO1xufVxuXG5mdW5jdGlvbiBfZGlmZkFjY2VwdEVkaXQoKSB7XG4gIGNvbnN0IGVkaXRlZCA9IF9kaWZmR2V0RWRpdGVkKCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBjYiA9IF9kaWZmU3RhdGU/Lm9uQ29tbWl0O1xuICBfZGlmZlN0YXRlID0gbnVsbDtcbiAgX2RpZmZPcGVuZXIgPSBudWxsO1xuICBpZiAoY2IpIGNiKCdhY2NlcHRfZWRpdCcsIGVkaXRlZCk7XG59XG5cbmZ1bmN0aW9uIF9kaWZmRGlydHkoKSB7XG4gIHJldHVybiAoX2RpZmZTdGF0ZT8uZmllbGRzIHx8IFtdKS5zb21lKChmLCBpKSA9PiB7XG4gICAgY29uc3QgdGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgZGlmZi1uZXctJHtpfWApO1xuICAgIHJldHVybiB0YSAmJiB0YS52YWx1ZSAhPT0gKGYucHJvcG9zZWQgfHwgJycpO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9kaWZmRGlzY2FyZCgpIHtcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpKSByZXR1cm47XG4gIGlmIChfZGlmZkRpcnR5KCkpIHtcbiAgICBzaG93Q29uZmlybShcbiAgICAgICdEaXNjYXJkIGVkaXQ/JyxcbiAgICAgICdZb3UgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuIENsb3NlIHdpdGhvdXQgc2F2aW5nPycsXG4gICAgICAnRGlzY2FyZCcsXG4gICAgICBfZG9EaWZmRGlzY2FyZCxcbiAgICAgIHRydWUsXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgX2RvRGlmZkRpc2NhcmQoKTtcbn1cblxuZnVuY3Rpb24gX2RvRGlmZkRpc2NhcmQoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBfZGlmZlN0YXRlID0gbnVsbDtcbiAgX2RpZmZDbG9zZURvbmUoKTtcbn1cblxuLy8g4pSA4pSAIGZpZWxkIGVkaXQgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2ZpZWxkRWRpdENhbGxiYWNrID0gbnVsbDtcbmxldCBfZmllbGRFZGl0T3JpZ2luYWxWYWx1ZSA9ICcnO1xubGV0IF9maWVsZEVkaXRPcGVuZXIgPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gb3BlbkZpZWxkRWRpdE1vZGFsKHRpdGxlLCBjdXJyZW50VmFsdWUsIG9uU2F2ZSkge1xuICBfZmllbGRFZGl0T3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWUgPSBjdXJyZW50VmFsdWU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLnZhbHVlID0gY3VycmVudFZhbHVlO1xuICBfZmllbGRFZGl0Q2FsbGJhY2sgPSBvblNhdmU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS5mb2N1cygpLCA1MCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUZpZWxkRWRpdE1vZGFsKCkge1xuICBpZiAoIWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykpIHJldHVybjtcbiAgY29uc3QgY3VycmVudFZhbHVlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLnZhbHVlO1xuICBpZiAoY3VycmVudFZhbHVlICE9PSBfZmllbGRFZGl0T3JpZ2luYWxWYWx1ZSkge1xuICAgIHNob3dDb25maXJtKFxuICAgICAgJ0Rpc2NhcmQgZWRpdD8nLFxuICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgY2hhbmdlcy4gQ2xvc2Ugd2l0aG91dCBzYXZpbmc/JyxcbiAgICAgICdEaXNjYXJkJyxcbiAgICAgIF9kb0Nsb3NlRmllbGRFZGl0TW9kYWwsXG4gICAgICB0cnVlLFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9kb0Nsb3NlRmllbGRFZGl0TW9kYWwoKTtcbn1cblxuZnVuY3Rpb24gX2RvQ2xvc2VGaWVsZEVkaXRNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIF9maWVsZEVkaXRDYWxsYmFjayA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9maWVsZEVkaXRPcGVuZXI7XG4gIF9maWVsZEVkaXRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbmZ1bmN0aW9uIF9maWVsZEVkaXRTYXZlKCkge1xuICBjb25zdCB2YWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykudmFsdWU7XG4gIGNvbnN0IGNiID0gX2ZpZWxkRWRpdENhbGxiYWNrO1xuICBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsKCk7XG4gIGlmIChjYikgY2IodmFsKTtcbn1cblxuLy8gUmVmcmVzaC9jbG9zZSB3aXRoIGEgZGlydHkgZWRpdG9yIG9wZW4gd291bGQgc2lsZW50bHkgbG9zZSB0aGUgZWRpdCAtIHRoZVxuLy8gc2FtZSBwcm90ZWN0aW9uIGNsb3NlRmllbGRFZGl0TW9kYWwvX2RpZmZEaXNjYXJkIGdpdmUgRXNjYXBlIGFuZCBEaXNjYXJkLlxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsIGUgPT4ge1xuICBjb25zdCBmaWVsZEVkaXREaXJ0eSA9XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtbW9kYWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSAmJlxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZSAhPT0gX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWU7XG4gIGNvbnN0IGRpZmZEaXJ0eSA9XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSAmJiBfZGlmZkRpcnR5KCk7XG4gIGlmIChmaWVsZEVkaXREaXJ0eSB8fCBkaWZmRGlydHkpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5yZXR1cm5WYWx1ZSA9ICcnO1xuICB9XG59KTtcblxuLy8g4pSA4pSAIGtlYmFiIG1lbnVzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9hY3RpdmVLZWJhYiA9IG51bGw7XG5sZXQgX2FjdGl2ZUtlYmFiQW5jaG9yID0gbnVsbDtcbmxldCBfa2ViYWJEaXNtaXNzID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlS2ViYWIocmVmb2N1c0FuY2hvciA9IGZhbHNlKSB7XG4gIGlmICghX2FjdGl2ZUtlYmFiKSByZXR1cm4gZmFsc2U7XG4gIF9hY3RpdmVLZWJhYi5yZW1vdmUoKTtcbiAgX2FjdGl2ZUtlYmFiID0gbnVsbDtcbiAgaWYgKF9rZWJhYkRpc21pc3MpIHsgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCBfa2ViYWJEaXNtaXNzKTsgX2tlYmFiRGlzbWlzcyA9IG51bGw7IH1cbiAgY29uc3QgYW5jaG9yID0gX2FjdGl2ZUtlYmFiQW5jaG9yO1xuICBfYWN0aXZlS2ViYWJBbmNob3IgPSBudWxsO1xuICBpZiAoYW5jaG9yPy5oYXNBdHRyaWJ1dGU/LignYXJpYS1oYXNwb3B1cCcpKSBhbmNob3Iuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG4gIGlmIChyZWZvY3VzQW5jaG9yICYmIGFuY2hvcj8uZm9jdXMpIGFuY2hvci5mb2N1cygpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dLZWJhYihhbmNob3JFbCwgaXRlbXMpIHtcbiAgY2xvc2VLZWJhYigpO1xuICBjb25zdCBtZW51ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIG1lbnUuY2xhc3NOYW1lID0gJ2hhbWJ1cmdlci1tZW51IG9wZW4nO1xuICAvLyByaWdodDphdXRvIGNsZWFycyB0aGUgLmhhbWJ1cmdlci1tZW51IGJhc2UgcnVsZSdzIHJpZ2h0OjAgLSBvdGhlcndpc2UgdGhlXG4gIC8vIGZpeGVkIG1lbnUsIHdpdGggYm90aCBsZWZ0IGFuZCByaWdodCBzZXQsIHN0cmV0Y2hlcyB0byB0aGUgdmlld3BvcnQgZWRnZS5cbiAgbWVudS5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOmZpeGVkO3otaW5kZXg6NTAwO21pbi13aWR0aDoxNjBweDtyaWdodDphdXRvJztcbiAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgaWYgKGl0ZW0gPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHNlcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgc2VwLmNsYXNzTmFtZSA9ICdoYW1idXJnZXItZGl2aWRlcic7XG4gICAgICBtZW51LmFwcGVuZENoaWxkKHNlcCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgYnRuLmNsYXNzTmFtZSA9ICdoYW1idXJnZXItaXRlbSc7XG4gICAgYnRuLnRleHRDb250ZW50ID0gaXRlbS5sYWJlbDtcbiAgICBpZiAoaXRlbS5kaXNhYmxlZCkgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAvLyBSZWZvY3VzIHRoZSBhbmNob3IgYmVmb3JlIHRoZSBhY3Rpb24gcnVucyBzbyBhbnl0aGluZyB0aGUgYWN0aW9uIG9wZW5zXG4gICAgLy8gcmVjb3JkcyB0aGUgYW5jaG9yIC0gbm90IGEgcmVtb3ZlZCBtZW51IGl0ZW0gLSBhcyBpdHMgcmV0dXJuLWZvY3VzIHRhcmdldC5cbiAgICBidG4ub25jbGljayA9ICgpID0+IHsgY2xvc2VLZWJhYih0cnVlKTsgaXRlbS5hY3Rpb24oKTsgfTtcbiAgICBtZW51LmFwcGVuZENoaWxkKGJ0bik7XG4gIH1cbiAgbWVudS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiBfbWVudUFycm93S2V5ZG93bihtZW51LCBlKSk7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobWVudSk7XG4gIF9hY3RpdmVLZWJhYiA9IG1lbnU7XG4gIF9hY3RpdmVLZWJhYkFuY2hvciA9IGFuY2hvckVsO1xuICBpZiAoYW5jaG9yRWw/Lmhhc0F0dHJpYnV0ZT8uKCdhcmlhLWhhc3BvcHVwJykpIGFuY2hvckVsLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XG5cbiAgY29uc3QgcmVjdCA9IGFuY2hvckVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBsZXQgdG9wICA9IHJlY3QuYm90dG9tICsgNDtcbiAgbGV0IGxlZnQgPSByZWN0LnJpZ2h0IC0gbWVudS5vZmZzZXRXaWR0aDtcbiAgaWYgKGxlZnQgPCA0KSBsZWZ0ID0gcmVjdC5sZWZ0O1xuICBjb25zdCBtZW51SCA9IG1lbnUub2Zmc2V0SGVpZ2h0O1xuICBpZiAodG9wICsgbWVudUggPiB3aW5kb3cuaW5uZXJIZWlnaHQpIHRvcCA9IHJlY3QudG9wIC0gbWVudUg7XG4gIG1lbnUuc3R5bGUudG9wICA9IHRvcCAgKyAncHgnO1xuICBtZW51LnN0eWxlLmxlZnQgPSBsZWZ0ICsgJ3B4JztcblxuICBfbWVudUZvY3VzYWJsZUl0ZW1zKG1lbnUpWzBdPy5mb2N1cygpO1xuXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmIChfYWN0aXZlS2ViYWIgIT09IG1lbnUpIHJldHVybjsgIC8vIGFscmVhZHkgY2xvc2VkIChlLmcuIGltbWVkaWF0ZSBFc2NhcGUpXG4gICAgY29uc3QgZGlzbWlzcyA9IGUgPT4ge1xuICAgICAgaWYgKG1lbnUuY29udGFpbnMoZS50YXJnZXQpKSByZXR1cm47XG4gICAgICBjbG9zZUtlYmFiKCk7XG4gICAgfTtcbiAgICBfa2ViYWJEaXNtaXNzID0gZGlzbWlzcztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGRpc21pc3MpO1xuICB9LCAwKTtcbn1cblxuLy8g4pSA4pSAIHBhbmUgcmVzaXplIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuY29uc3QgX1BBTkVfS0VZID0gJ3l1dWNsaXAtcGFuZS1zaXplcyc7XG5cbmZ1bmN0aW9uIF9sb2FkUGFuZVNpemVzKCkge1xuICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShfUEFORV9LRVkpIHx8ICd7fScpOyB9IGNhdGNoIHsgcmV0dXJuIHt9OyB9XG59XG5cbmZ1bmN0aW9uIF9zYXZlUGFuZVNpemUoa2V5LCB2YWwpIHtcbiAgY29uc3QgcyA9IF9sb2FkUGFuZVNpemVzKCk7XG4gIHNba2V5XSA9IHZhbDtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oX1BBTkVfS0VZLCBKU09OLnN0cmluZ2lmeShzKSk7XG59XG5cbmZ1bmN0aW9uIF9tYWtlRHJhZ0hhbmRsZShpZCwgb25TdGFydCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBlID0+IHtcbiAgICBpZiAoZS5idXR0b24gIT09IDApIHJldHVybjtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZWwuY2xhc3NMaXN0LmFkZCgnZHJhZ2dpbmcnKTtcbiAgICBjb25zdCBvbk1vdmUgPSBvblN0YXJ0KGUpO1xuICAgIGNvbnN0IG9uVXAgPSAoKSA9PiB7XG4gICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ2luZycpO1xuICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlKTtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvblVwKTtcbiAgICB9O1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uVXApO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRSZXNpemUoKSB7XG4gIGNvbnN0IHJvb3QgICAgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG4gIGNvbnN0IHNpemVzICAgPSBfbG9hZFBhbmVTaXplcygpO1xuXG4gIGlmIChzaXplcy5zaWRlYmFyV2lkdGgpICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1zaWRlYmFyLXdpZHRoJywgICAgICAgc2l6ZXMuc2lkZWJhcldpZHRoICsgJ3B4Jyk7XG4gIGlmIChzaXplcy52aWRlb3NIZWlnaHQpICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12aWRlb3MtZ3JvdXAtaGVpZ2h0Jywgc2l6ZXMudmlkZW9zSGVpZ2h0ICsgJ3B4Jyk7XG4gIGlmIChzaXplcy5wbGF5ZXJNYXhIKSAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wbGF5ZXItbWF4LWhlaWdodCcsICAgc2l6ZXMucGxheWVyTWF4SCArICdweCcpO1xuICBpZiAoc2l6ZXMubG9nTWF4SCkgICAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tbG9nLW1heC1oZWlnaHQnLCAgICAgICBzaXplcy5sb2dNYXhIICsgJ3B4Jyk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCdzaWRlYmFyLXJlc2l6ZS1oYW5kbGUnLCBzdGFydEUgPT4ge1xuICAgIGNvbnN0IHN0YXJ0WCAgPSBzdGFydEUuY2xpZW50WDtcbiAgICBjb25zdCBzaWRlYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNpZGViYXInKTtcbiAgICBjb25zdCBzdGFydFcgID0gc2lkZWJhci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aDtcbiAgICByZXR1cm4gbW92ZUUgPT4ge1xuICAgICAgY29uc3QgdyA9IE1hdGgubWF4KDE2MCwgTWF0aC5taW4oNDgwLCBzdGFydFcgKyBtb3ZlRS5jbGllbnRYIC0gc3RhcnRYKSk7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLXNpZGViYXItd2lkdGgnLCB3ICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCdzaWRlYmFyV2lkdGgnLCB3KTtcbiAgICB9O1xuICB9KTtcblxuICBfbWFrZURyYWdIYW5kbGUoJ3ZpZGVvcy1jbGlwcy1yZXNpemUtaGFuZGxlJywgc3RhcnRFID0+IHtcbiAgICBjb25zdCBzdGFydFkgID0gc3RhcnRFLmNsaWVudFk7XG4gICAgY29uc3QgdmcgICAgICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaWRlYmFyLWdyb3VwLnZpZGVvcy1ncm91cCcpO1xuICAgIGNvbnN0IHNpZGViYXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2lkZWJhcicpO1xuICAgIGNvbnN0IHN0YXJ0SCAgPSB2Zy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IG1heEggPSBzaWRlYmFyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCAtIDEyMDtcbiAgICAgIGNvbnN0IGggPSBNYXRoLm1heCg0MCwgTWF0aC5taW4obWF4SCwgc3RhcnRIICsgbW92ZUUuY2xpZW50WSAtIHN0YXJ0WSkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12aWRlb3MtZ3JvdXAtaGVpZ2h0JywgaCArICdweCcpO1xuICAgICAgX3NhdmVQYW5lU2l6ZSgndmlkZW9zSGVpZ2h0JywgaCk7XG4gICAgfTtcbiAgfSk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCdwbGF5ZXItcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRZID0gc3RhcnRFLmNsaWVudFk7XG4gICAgY29uc3QgcGEgICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJyk7XG4gICAgY29uc3QgbWFpbiAgID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm1haW4nKTtcbiAgICBjb25zdCBzdGFydEggPSBwYS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IG1heEggPSBtYWluLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCAtIDEwMDtcbiAgICAgIGNvbnN0IGggPSBNYXRoLm1heCg4MCwgTWF0aC5taW4obWF4SCwgc3RhcnRIICsgbW92ZUUuY2xpZW50WSAtIHN0YXJ0WSkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wbGF5ZXItbWF4LWhlaWdodCcsIGggKyAncHgnKTtcbiAgICAgIF9zYXZlUGFuZVNpemUoJ3BsYXllck1heEgnLCBoKTtcbiAgICB9O1xuICB9KTtcblxuICBfbWFrZURyYWdIYW5kbGUoJ2xvZy1yZXNpemUtaGFuZGxlJywgc3RhcnRFID0+IHtcbiAgICBjb25zdCBzdGFydFkgPSBzdGFydEUuY2xpZW50WTtcbiAgICBjb25zdCBsYiAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWJvZHknKTtcbiAgICBjb25zdCBzdGFydEggPSBsYi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgfHwgMDtcbiAgICByZXR1cm4gbW92ZUUgPT4ge1xuICAgICAgY29uc3QgaCA9IE1hdGgubWF4KDQwLCBNYXRoLm1pbig2MDAsIHN0YXJ0SCAtIChtb3ZlRS5jbGllbnRZIC0gc3RhcnRZKSkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1sb2ctbWF4LWhlaWdodCcsIGggKyAncHgnKTtcbiAgICAgIF9zYXZlUGFuZVNpemUoJ2xvZ01heEgnLCBoKTtcbiAgICB9O1xuICB9KTtcbn1cblxuLy8g4pSA4pSAIHByZXJlcSB3YXJuaW5ncyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmV4cG9ydCBmdW5jdGlvbiBfYXBwbHlQcmVyZXFXYXJuaW5ncyhwcmVyZXFzKSB7XG4gIGNvbnN0IGluRWxlY3Ryb24gPSAhIXdpbmRvdy5lbGVjdHJvbkFQSTtcbiAgY29uc3Qgd2l6YXJkTGluayA9IGluRWxlY3Ryb25cbiAgICA/ICcgPGEgaHJlZj1cIiNcIiBvbmNsaWNrPVwid2luZG93LmVsZWN0cm9uQVBJLnJ1blNldHVwV2l6YXJkKCk7cmV0dXJuIGZhbHNlXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS13YXJuaW5nKVwiPlJlLXJ1biBTZXR1cCBXaXphcmQ8L2E+J1xuICAgIDogJyc7XG5cbiAgY29uc3QgYmFubmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ByZXJlcS1iYW5uZXInKTtcbiAgaWYgKCFiYW5uZXIpIHJldHVybjtcblxuICBpZiAoIXByZXJlcXMuZmZtcGVnX29rKSB7XG4gICAgYmFubmVyLmlubmVySFRNTCA9IGA8c3Bhbj7imqAgRkZtcGVnIG5vdCBmb3VuZCAtIGFuYWx5c2lzIGFuZCBleHBvcnQgd2lsbCBmYWlsLiR7d2l6YXJkTGlua308L3NwYW4+YDtcbiAgICBiYW5uZXIuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tc3RhcnQtYW5hbHl6ZScpO1xuICAgIGlmIChidG4pIHtcbiAgICAgIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICBidG4udGl0bGUgPSAnRkZtcGVnIG5vdCBmb3VuZCAtIFJlLXJ1biBTZXR1cCBXaXphcmQgdG8gaW5zdGFsbCBpdCc7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXByZXJlcXMubGxtX29rICYmIGluRWxlY3Ryb24pIHtcbiAgICBiYW5uZXIuaW5uZXJIVE1MID0gYDxzcGFuPuKEuSBMTE0gc2NvcmluZyBpcyBub3QgY29uZmlndXJlZCAtIGNsaXBzIHdpbGwgYmUgc2NvcmVkIGJ5IGVuZXJneSBhbmQgc2NlbmVzIG9ubHkuJHt3aXphcmRMaW5rfTwvc3Bhbj5gO1xuICAgIGJhbm5lci5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIFByZXJlcXVpc2l0ZXMgc2F0aXNmaWVkIC0gY2xlYXIgYW55IGJhbm5lciBzaG93biBieSBhbiBlYXJsaWVyIHN0YXRlLiBXaXRob3V0XG4gIC8vIHRoaXMsIGEgcmUtY2hlY2sgYWZ0ZXIgdGhlIG1vZGVsIGlzIHNldCB1cCAocmVmcmVzaFNlcnZlclN0YXRlKSBjb3VsZCBuZXZlclxuICAvLyBoaWRlIGEgc3RhbGUgd2FybmluZy5cbiAgYmFubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGJhbm5lci5pbm5lckhUTUwgPSAnJztcbn1cblxuLy8g4pSA4pSAIHVuZG8gdG9hc3QgKGF1dG8tZGlzbWlzcywgc2luZ2xlIFVuZG8gYnV0dG9uKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEEgdHJhbnNpZW50IHRvYXN0IGNhcnJ5aW5nIGFuIFVuZG8gYWN0aW9uLCB1c2VkIGJ5IHJldmVyc2libGUgY2xpcCBvcGVyYXRpb25zXG4vLyAoc2luZ2xlL2J1bGsgc3RhdHVzIGNoYW5nZXMpLiBUaGUgc2hyaW5raW5nIGJhciBtYWtlcyB0aGUgfjVzIHdpbmRvdyB2aXNpYmxlXG4vLyBzbyB0aGUgdW5kbyBhZmZvcmRhbmNlIGRvZXMgbm90IGV4cGlyZSBzaWxlbnRseS4gR2VuZXJpYyBVSSwgc28gaXQgbGl2ZXMgaGVyZVxuLy8gcmF0aGVyIHRoYW4gaW4gYSBmZWF0dXJlIG1vZHVsZS5cbmNvbnN0IFVORE9fVE9BU1RfTVMgPSA1MDAwO1xuXG5leHBvcnQgZnVuY3Rpb24gc2hvd1VuZG9Ub2FzdChtZXNzYWdlLCB1bmRvRm4pIHtcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RvYXN0LWNvbnRhaW5lcicpO1xuICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdC5jbGFzc05hbWUgPSAndG9hc3QgaW5mbyB1bmRvLXRvYXN0JztcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHJvdy5jbGFzc05hbWUgPSAndW5kby10b2FzdC1yb3cnO1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYnRuLmNsYXNzTmFtZSA9ICd1bmRvLXRvYXN0LWJ0bic7XG4gIGJ0bi50ZXh0Q29udGVudCA9ICdVbmRvJztcbiAgYnRuLm9uY2xpY2sgPSAoKSA9PiB7IHRvYXN0LnJlbW92ZSgpOyB1bmRvRm4oKTsgfTtcbiAgcm93LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG1lc3NhZ2UpKTtcbiAgcm93LmFwcGVuZENoaWxkKGJ0bik7XG4gIGNvbnN0IGJhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBiYXIuY2xhc3NOYW1lID0gJ3VuZG8tdG9hc3QtYmFyJztcbiAgYmFyLnN0eWxlLmFuaW1hdGlvbkR1cmF0aW9uID0gVU5ET19UT0FTVF9NUyArICdtcyc7XG4gIHRvYXN0LmFwcGVuZENoaWxkKHJvdyk7XG4gIHRvYXN0LmFwcGVuZENoaWxkKGJhcik7XG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0b2FzdCk7XG4gIHNldFRpbWVvdXQoKCkgPT4gdG9hc3QucmVtb3ZlKCksIFVORE9fVE9BU1RfTVMpO1xufVxuXG4vLyBHbG9iYWwgcGxheWJhY2stc3BlZWQgcHJlZmVyZW5jZSAtIG9uZSBjYXB0dXJlLXBoYXNlIGxpc3RlbmVyIGFwcGxpZXMgdGhlIHNhdmVkXG4vLyByYXRlIHRvIGV2ZXJ5IDx2aWRlbz4gYXMgaXQgbG9hZHMsIHNvIGFsbCBwbGF5ZXJzIChjbGlwIHByZXZpZXcsIHJlY29yZGluZyxcbi8vIHNwbGl0L2V4cG9ydCBlZGl0b3JzLCByZWVscykgaG9ub3IgaXQgd2l0aG91dCBwZXItcGxheWVyIHdpcmluZy4gQ2xpZW50LW9ubHksXG4vLyBzdG9yZWQgaW4gbG9jYWxTdG9yYWdlIGxpa2UgdGhlIG90aGVyIHBsYXliYWNrIHByZWZzLlxuZXhwb3J0IGZ1bmN0aW9uIHBsYXliYWNrUmF0ZVByZWYoKSB7XG4gIGNvbnN0IHJhdGUgPSBwYXJzZUZsb2F0KGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd5dXVjbGlwLXBsYXliYWNrLXJhdGUnKSk7XG4gIHJldHVybiBOdW1iZXIuaXNGaW5pdGUocmF0ZSkgJiYgcmF0ZSA+IDAgPyByYXRlIDogMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UGxheWJhY2tSYXRlKHJhdGUpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndmlkZW8nKS5mb3JFYWNoKHZpZGVvID0+IHsgdmlkZW8ucGxheWJhY2tSYXRlID0gcmF0ZTsgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0UGxheWJhY2tSYXRlKCkge1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIGUgPT4ge1xuICAgIGlmIChlLnRhcmdldCAmJiBlLnRhcmdldC50YWdOYW1lID09PSAnVklERU8nKSBlLnRhcmdldC5wbGF5YmFja1JhdGUgPSBwbGF5YmFja1JhdGVQcmVmKCk7XG4gIH0sIHRydWUpO1xufVxuXG4vLyDilIDilIAgc3RhdGljIG1vZGFsL2hhbWJ1cmdlciB3aXJpbmcgKHJlcGxhY2VzIHRoZSBpbmxpbmUgb25jbGljaz0gdGhpcyBtb2R1bGUgdXNlZFxuLy8gdG8gb3duIGluIGluZGV4Lmh0bWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVGhlc2UgYXJlIGZpeGVkLCBuZXZlci1yZWNyZWF0ZWQgZWxlbWVudHMgaW4gaW5kZXguaHRtbCwgc28gd2lyaW5nIHRoZW0gb25jZSBhdFxuLy8gbW9kdWxlIGxvYWQgKGJlbG93KSBjYW4ndCBkb3VibGUtZmlyZSBvbiBhIHJlLXJlbmRlciB0aGUgd2F5IGEgZHluYW1pY2FsbHlcbi8vIHJlbmRlcmVkIGxpc3QgY291bGQuXG5jb25zdCBfQkdfRElTTUlTU19NT0RBTFMgPSBbXG4gIFsnYWxlcnQtbW9kYWwnLCBjbG9zZUFsZXJ0TW9kYWxdLFxuICBbJ2NvbmZpcm0tbW9kYWwnLCBfY29uZmlybUNhbmNlbF0sXG4gIFsnYWN0aW9ucy1tb2RhbCcsIGNsb3NlQWN0aW9uc01vZGFsXSxcbiAgWydjb250cm9scy1tb2RhbCcsIGNsb3NlQ29udHJvbHNNb2RhbF0sXG4gIFsnZGlmZi1tb2RhbCcsIF9kaWZmRGlzY2FyZF0sXG4gIFsnZmllbGQtZWRpdC1tb2RhbCcsIGNsb3NlRmllbGRFZGl0TW9kYWxdLFxuXTtcblxuZnVuY3Rpb24gX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpIHtcbiAgZm9yIChjb25zdCBbbW9kYWxJZCwgY2xvc2VGbl0gb2YgX0JHX0RJU01JU1NfTU9EQUxTKSB7XG4gICAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtb2RhbElkKTtcbiAgICBtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IG1vZGFsKSBjbG9zZUZuKCk7IH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCdXR0b25zKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtb2stYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUFsZXJ0TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9jb25maXJtQ2FuY2VsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1vay1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9jb25maXJtT2soKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VBY3Rpb25zTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250cm9scy1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlQ29udHJvbHNNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZGlzY2FyZC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9kaWZmRGlzY2FyZCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtYWNjZXB0LWVkaXQtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZGlmZkFjY2VwdEVkaXQoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1uZXctYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZGlmZkFjY2VwdE5ldygpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtY2FuY2VsLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VGaWVsZEVkaXRNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtc2F2ZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9maWVsZEVkaXRTYXZlKCkpO1xufVxuXG4vLyBcIkNvbnRyb2xzXCIgYW5kIFwiRG93bmxvYWQgTG9nXCIgYXJlIHdpcmVkIGhlcmUgYmVjYXVzZSB0aGVpciBvbmNsaWNrPSBjYWxsZWRcbi8vIG9ubHkgdWkuanMgZnVuY3Rpb25zLiBUaGUgR2V0dGluZyBTdGFydGVkIC8gR2xvc3NhcnkgLyBIZWxwIC8gQWJvdXQgaXRlbXMgY2FsbFxuLy8gY2xvc2VIYW1idXJnZXIoKSAodWkuanMpIHBsdXMgYSBoZWxwbW9kYWxzLmpzIG1vZGFsLW9wZW4sIHNvIGhlbHBtb2RhbHMuanMgb3duc1xuLy8gdGhlaXIgZGVsZWdhdGlvbi4gXCJSZS1ydW4gU2V0dXAgV2l6YXJkXCIgYW5kIFwiUmVmcmVzaFwiIChlbGVjdHJvbkFQSSAvIGxvY2F0aW9uKVxuLy8gcmVtYWluIGlubGluZSB1bnRpbCB0aGVpciBvd25pbmcgY29kZSBtaWdyYXRlcy5cbmZ1bmN0aW9uIF93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4taGFtYnVyZ2VyJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0b2dnbGVIYW1idXJnZXIoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1jb250cm9scycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIGNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkNvbnRyb2xzTW9kYWwoKTtcbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1kb3dubG9hZC1sb2cnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlSGFtYnVyZ2VyKCkpO1xufVxuXG5fd2lyZU1vZGFsQmdEaXNtaXNzYWxzKCk7XG5fd2lyZU1vZGFsQnV0dG9ucygpO1xuX3dpcmVIYW1idXJnZXJIYW5kbGVycygpO1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gdGhlIHRocmVlIGFwcC1nbG9iYWwgaGVscC9pbmZvIG1vZGFscyAoR2V0dGluZyBTdGFydGVkLCBBYm91dCxcbi8vIEdsb3NzYXJ5KS4gRXh0cmFjdGVkIG91dCBvZiBzZXR0aW5ncy5qcyAod2hpY2ggZ3JldyBpbnRvIGEgY2F0Y2gtYWxsKSAtIHRoZXNlXG4vLyBoYXZlIG5vIGNvdXBsaW5nIHRvIHRoZSBzZXR0aW5ncyBzYXZlL2RpcnR5IG1hY2hpbmVyeS5cbi8vICAgQVBJOiByb3V0ZXMvY29uZmlnLnB5IChnbG9zc2FyeSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfc2V0dGluZ3MucHksIHRlc3RzL3VpL3Rlc3RfdWlfcGFnZS5weSwgdGVzdHMvdWkvdGVzdF91aV9rZXlib2FyZC5weVxuXG4vLyDilIDilIAgZ2V0dGluZyBzdGFydGVkIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9nZXR0aW5nU3RhcnRlZE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkdldHRpbmdTdGFydGVkTW9kYWwoKSB7XG4gIF9nZXR0aW5nU3RhcnRlZE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2dldHRpbmctc3RhcnRlZC1tb2RhbCAuYnRuJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd5dXUtZ2V0dGluZy1zdGFydGVkLXNlZW4nLCAnMScpO1xuICBjb25zdCBvcGVuZXIgPSBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXI7XG4gIF9nZXR0aW5nU3RhcnRlZE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGFib3V0IG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9hYm91dE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkFib3V0TW9kYWwoKSB7XG4gIF9hYm91dE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhYm91dC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYWJvdXQtbW9kYWwgLmJ0bicpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VBYm91dE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWJvdXQtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9hYm91dE9wZW5lcjtcbiAgX2Fib3V0T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgaGVscCAmIGd1aWRlcyBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIExpbmtzIG91dCB0byB0aGUgR2l0SHViIGRvY3MvdXNlci8gcGFnZXMgcmF0aGVyIHRoYW4gYnVuZGxpbmcgY29waWVzOiB0aGUgYXBwXG4vLyBzaGlwcyB0aGUgd2hlZWwgKHdoaWNoIGNhcnJpZXMgc3RhdGljL2dsb3NzYXJ5Lm1kKSBidXQgbm90IGRvY3MvdXNlci8sIGFuZCBhXG4vLyBidW5kbGVkIDY1MC1saW5lIGZlYXR1cmUgZ3VpZGUgd291bGQgZHJpZnQgZnJvbSB0aGUgVUkuIEluIHRoZSBwYWNrYWdlZCBhcHBcbi8vIHRoZXNlIHRhcmdldD1fYmxhbmsgbGlua3Mgb3BlbiBpbiB0aGUgc3lzdGVtIGJyb3dzZXIgdmlhIHNldFdpbmRvd09wZW5IYW5kbGVyLlxubGV0IF9oZWxwT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBvcGVuSGVscE1vZGFsKCkge1xuICBfaGVscE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWxwLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNoZWxwLW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlSGVscE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVscC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2hlbHBPcGVuZXI7XG4gIF9oZWxwT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgZ2xvc3NhcnkgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2dsb3NzYXJ5T3BlbmVyID0gbnVsbDtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuR2xvc3NhcnlNb2RhbCgpIHtcbiAgX2dsb3NzYXJ5T3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBjb25zdCBmaWx0ZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktZmlsdGVyJyk7XG4gIGZpbHRlci52YWx1ZSA9ICcnO1xuICBzZXRUaW1lb3V0KCgpID0+IGZpbHRlci5mb2N1cygpLCA1MCk7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWNvbnRlbnQnKTtcbiAgaWYgKGVsLmRhdGFzZXQubG9hZGVkKSB7IF9maWx0ZXJHbG9zc2FyeSgnJyk7IHJldHVybjsgfVxuICB0cnkge1xuICAgIGNvbnN0IG1kID0gYXdhaXQgZmV0Y2goJy9hcGkvZ2xvc3NhcnknKS50aGVuKHIgPT4gci50ZXh0KCkpO1xuICAgIGVsLmlubmVySFRNTCA9IF9yZW5kZXJHbG9zc2FyeU1kKG1kKTtcbiAgICBlbC5kYXRhc2V0LmxvYWRlZCA9ICcxJztcbiAgfSBjYXRjaCAoZSkge1xuICAgIGVsLmlubmVySFRNTCA9ICc8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tcmVkKVwiPkZhaWxlZCB0byBsb2FkIGdsb3NzYXJ5LjwvZGl2Pic7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9maWx0ZXJHbG9zc2FyeShxdWVyeSkge1xuICBjb25zdCBxID0gcXVlcnkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGNvbnRlbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktY29udGVudCcpO1xuICBsZXQgYW55VmlzaWJsZSA9IGZhbHNlO1xuICBjb250ZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5nbG9zc2FyeS10ZXJtJykuZm9yRWFjaCh0ZXJtID0+IHtcbiAgICBjb25zdCBzaG93ID0gIXEgfHwgdGVybS50ZXh0Q29udGVudC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpO1xuICAgIHRlcm0uc3R5bGUuZGlzcGxheSA9IHNob3cgPyAnJyA6ICdub25lJztcbiAgICBpZiAoc2hvdykgYW55VmlzaWJsZSA9IHRydWU7XG4gIH0pO1xuICBjb250ZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5nbG9zc2FyeS1zZWN0aW9uJykuZm9yRWFjaChzZWN0aW9uID0+IHtcbiAgICBjb25zdCB0ZXJtcyA9IEFycmF5LmZyb20oc2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKCcuZ2xvc3NhcnktdGVybScpKTtcbiAgICBjb25zdCBzaG93ID0gIXEgfHwgdGVybXMuc29tZSh0ID0+IHQuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnKTtcbiAgICBzZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBzaG93ID8gJycgOiAnbm9uZSc7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3Nhcnktbm8tbWF0Y2hlcycpLnN0eWxlLmRpc3BsYXkgPSAocSAmJiAhYW55VmlzaWJsZSkgPyAnJyA6ICdub25lJztcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUdsb3NzYXJ5TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2dsb3NzYXJ5T3BlbmVyO1xuICBfZ2xvc3NhcnlPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbmZ1bmN0aW9uIF9yZW5kZXJHbG9zc2FyeU1kKG1kKSB7XG4gIGNvbnN0IGxpbmVzID0gbWQuc3BsaXQoJ1xcbicpO1xuICBsZXQgaHRtbCA9ICcnO1xuICBsZXQgaW5MaXN0ID0gZmFsc2U7XG4gIGxldCBpblRhYmxlID0gZmFsc2U7XG4gIGxldCB0YWJsZUhlYWQgPSBmYWxzZTtcbiAgbGV0IGluU2VjdGlvbiA9IGZhbHNlO1xuICBsZXQgaW5UZXJtID0gZmFsc2U7XG5cbiAgY29uc3QgaW5saW5lID0gcyA9PiBzXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKVxuICAgIC5yZXBsYWNlKC9gKFteYF0rKWAvZywgJzxjb2RlPiQxPC9jb2RlPicpXG4gICAgLnJlcGxhY2UoL1xcKlxcKihbXipdKylcXCpcXCovZywgJzxzdHJvbmc+JDE8L3N0cm9uZz4nKVxuICAgIC5yZXBsYWNlKC9cXCooW14qXSspXFwqL2csICc8ZW0+JDE8L2VtPicpO1xuXG4gIGNvbnN0IGNsb3NlTGlzdCAgPSAoKSA9PiB7IGlmIChpbkxpc3QpICB7IGh0bWwgKz0gJzwvdWw+JzsgICBpbkxpc3QgID0gZmFsc2U7IH0gfTtcbiAgY29uc3QgY2xvc2VUYWJsZSA9ICgpID0+IHsgaWYgKGluVGFibGUpIHsgaHRtbCArPSAnPC90Ym9keT48L3RhYmxlPic7IGluVGFibGUgPSBmYWxzZTsgdGFibGVIZWFkID0gZmFsc2U7IH0gfTtcbiAgLy8gU2VjdGlvbiAoIyMpIGFuZCB0ZXJtICgjIyMpIHdyYXBwZXIgZGl2cyBhcmUgdGhlIHVuaXRzIHRoZSBnbG9zc2FyeSBmaWx0ZXJcbiAgLy8gc2hvd3MvaGlkZXMgLSBldmVyeSAjIyMgYmxvY2sgbXVzdCBsYW5kIGluc2lkZSBleGFjdGx5IG9uZSAuZ2xvc3NhcnktdGVybS5cbiAgY29uc3QgY2xvc2VUZXJtICAgID0gKCkgPT4geyBpZiAoaW5UZXJtKSAgICB7IGh0bWwgKz0gJzwvZGl2Pic7IGluVGVybSAgICA9IGZhbHNlOyB9IH07XG4gIGNvbnN0IGNsb3NlU2VjdGlvbiA9ICgpID0+IHsgY2xvc2VUZXJtKCk7IGlmIChpblNlY3Rpb24pIHsgaHRtbCArPSAnPC9kaXY+JzsgaW5TZWN0aW9uID0gZmFsc2U7IH0gfTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcmF3ID0gbGluZXNbaV07XG4gICAgY29uc3QgbGluZSA9IHJhdy50cmltRW5kKCk7XG5cbiAgICBpZiAobGluZS5zdGFydHNXaXRoKCcjIyAnKSkge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VTZWN0aW9uKCk7XG4gICAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiZ2xvc3Nhcnktc2VjdGlvblwiPjxoMiBzdHlsZT1cIm1hcmdpbjoyMHB4IDAgNHB4O2ZvbnQtc2l6ZToxNXB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7cGFkZGluZy1ib3R0b206NHB4XCI+JHtpbmxpbmUobGluZS5zbGljZSgzKSl9PC9oMj5gO1xuICAgICAgaW5TZWN0aW9uID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnIyMjICcpKSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpOyBjbG9zZVRlcm0oKTtcbiAgICAgIGh0bWwgKz0gYDxkaXYgY2xhc3M9XCJnbG9zc2FyeS10ZXJtXCI+PGgzIHN0eWxlPVwibWFyZ2luOjE0cHggMCAycHg7Zm9udC1zaXplOjEzcHg7Y29sb3I6dmFyKC0tYWNjZW50KVwiPiR7aW5saW5lKGxpbmUuc2xpY2UoNCkpfTwvaDM+YDtcbiAgICAgIGluVGVybSA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJy0tLScpKSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpOyBjbG9zZVRlcm0oKTtcbiAgICAgIGh0bWwgKz0gJzxociBzdHlsZT1cImJvcmRlcjpub25lO2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7bWFyZ2luOjE0cHggMFwiPic7XG4gICAgfSBlbHNlIGlmICgvXlxcfC8udGVzdChsaW5lKSkge1xuICAgICAgY2xvc2VMaXN0KCk7XG4gICAgICBjb25zdCBjZWxscyA9IGxpbmUuc3BsaXQoJ3wnKS5zbGljZSgxLCAtMSkubWFwKGMgPT4gYy50cmltKCkpO1xuICAgICAgaWYgKC9eWy1cXHN8Ol0rJC8udGVzdChsaW5lKSkge1xuICAgICAgICB0YWJsZUhlYWQgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoIWluVGFibGUpIHtcbiAgICAgICAgaW5UYWJsZSA9IHRydWU7IHRhYmxlSGVhZCA9IHRydWU7XG4gICAgICAgIGh0bWwgKz0gJzx0YWJsZSBzdHlsZT1cIndpZHRoOjEwMCU7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2ZvbnQtc2l6ZToxMnB4O21hcmdpbjo2cHggMFwiPjx0aGVhZD48dHI+JztcbiAgICAgICAgY2VsbHMuZm9yRWFjaChjID0+IHsgaHRtbCArPSBgPHRoIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0O3BhZGRpbmc6NHB4IDhweCA0cHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2NvbG9yOnZhcigtLXRleHQpXCI+JHtpbmxpbmUoYyl9PC90aD5gOyB9KTtcbiAgICAgICAgaHRtbCArPSAnPC90cj48L3RoZWFkPjx0Ym9keT4nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaHRtbCArPSAnPHRyPic7XG4gICAgICAgIGNlbGxzLmZvckVhY2goYyA9PiB7IGh0bWwgKz0gYDx0ZCBzdHlsZT1cInBhZGRpbmc6M3B4IDhweCAzcHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2NvbG9yOnZhcigtLW11dGVkKTt2ZXJ0aWNhbC1hbGlnbjp0b3BcIj4ke2lubGluZShjKX08L3RkPmA7IH0pO1xuICAgICAgICBodG1sICs9ICc8L3RyPic7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICgvXi0gLy50ZXN0KGxpbmUpKSB7XG4gICAgICBjbG9zZVRhYmxlKCk7XG4gICAgICBpZiAoIWluTGlzdCkgeyBodG1sICs9ICc8dWwgc3R5bGU9XCJtYXJnaW46NHB4IDAgNHB4IDE2cHg7cGFkZGluZzowXCI+JzsgaW5MaXN0ID0gdHJ1ZTsgfVxuICAgICAgaHRtbCArPSBgPGxpIHN0eWxlPVwibWFyZ2luOjFweCAwXCI+JHtpbmxpbmUobGluZS5zbGljZSgyKSl9PC9saT5gO1xuICAgIH0gZWxzZSBpZiAobGluZSA9PT0gJycpIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7XG4gICAgICBodG1sICs9ICc8ZGl2IHN0eWxlPVwibWFyZ2luOjRweCAwXCI+PC9kaXY+JztcbiAgICB9IGVsc2Uge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTtcbiAgICAgIGh0bWwgKz0gYDxwIHN0eWxlPVwibWFyZ2luOjNweCAwXCI+JHtpbmxpbmUobGluZSl9PC9wPmA7XG4gICAgfVxuICB9XG4gIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7IGNsb3NlU2VjdGlvbigpO1xuICByZXR1cm4gaHRtbDtcbn1cblxuLy8g4pSA4pSAIHN0YXRpYyBtb2RhbC9oYW1idXJnZXIgd2lyaW5nIChyZXBsYWNlcyB0aGUgaW5saW5lIG9uY2xpY2s9L29uaW5wdXQ9IHRoaXNcbi8vIG1vZHVsZSB1c2VkIHRvIG93biBpbiBpbmRleC5odG1sKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZXNlIGFyZSBmaXhlZCwgbmV2ZXItcmVjcmVhdGVkIGVsZW1lbnRzIGluIGluZGV4Lmh0bWwsIHNvIHdpcmluZyB0aGVtIG9uY2UgYXRcbi8vIG1vZHVsZSBsb2FkIChiZWxvdykgY2FuJ3QgZG91YmxlLWZpcmUgb24gYSByZS1yZW5kZXIgdGhlIHdheSBhIGR5bmFtaWNhbGx5XG4vLyByZW5kZXJlZCBsaXN0IGNvdWxkLlxuY29uc3QgX0JHX0RJU01JU1NfTU9EQUxTID0gW1xuICBbJ2dldHRpbmctc3RhcnRlZC1tb2RhbCcsIGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbF0sXG4gIFsnaGVscC1tb2RhbCcsIGNsb3NlSGVscE1vZGFsXSxcbiAgWydhYm91dC1tb2RhbCcsIGNsb3NlQWJvdXRNb2RhbF0sXG4gIFsnZ2xvc3NhcnktbW9kYWwnLCBjbG9zZUdsb3NzYXJ5TW9kYWxdLFxuXTtcblxuZnVuY3Rpb24gX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpIHtcbiAgZm9yIChjb25zdCBbbW9kYWxJZCwgY2xvc2VGbl0gb2YgX0JHX0RJU01JU1NfTU9EQUxTKSB7XG4gICAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtb2RhbElkKTtcbiAgICBtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IG1vZGFsKSBjbG9zZUZuKCk7IH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCdXR0b25zKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2V0dGluZy1zdGFydGVkLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVscC1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlSGVscE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWJvdXQtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUFib3V0TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlR2xvc3NhcnlNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWZpbHRlcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZSA9PiBfZmlsdGVyR2xvc3NhcnkoZS50YXJnZXQudmFsdWUpKTtcbn1cblxuLy8gVGhlIDQgaGFtYnVyZ2VyIGl0ZW1zIHVpLmpzJ3Mgb3duIG1pZ3JhdGlvbiBkZWZlcnJlZCAodGhlaXIgaW5saW5lIG9uY2xpY2s9XG4vLyBtaXhlZCB1aS5qcydzIGNsb3NlSGFtYnVyZ2VyKCkgd2l0aCBhIGhlbHBtb2RhbHMuanMgbW9kYWwtb3BlbiBjYWxsKSAtIHRoaXNcbi8vIG1vZHVsZSBub3cgb3ducyB0aGUgbW9kYWwtb3BlbiBoYWxmLCBzbyBpdCBvd25zIHJldGlyaW5nIHRoZW0gdG9vLlxuZnVuY3Rpb24gX3dpcmVIYW1idXJnZXJIYW5kbGVycygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWdldHRpbmctc3RhcnRlZCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIHdpbmRvdy5jbG9zZUhhbWJ1cmdlcigpO1xuICAgIG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsKCk7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tZ2xvc3NhcnknKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuR2xvc3NhcnlNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWhlbHAnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuSGVscE1vZGFsKCk7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tYWJvdXQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuQWJvdXRNb2RhbCgpO1xuICB9KTtcbn1cblxuX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpO1xuX3dpcmVNb2RhbEJ1dHRvbnMoKTtcbl93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIGFwcC1nbG9iYWwga2V5Ym9hcmQgc2hvcnRjdXRzIGFuZCB0aGUgRXNjYXBlLWtleSBsYXllciBjYXNjYWRlLlxuLy8gRXh0cmFjdGVkIG91dCBvZiBzZXR0aW5ncy5qcyAod2hpY2ggZ3JldyBpbnRvIGEgY2F0Y2gtYWxsKSAtIHNob3J0Y3V0cyBhcmVcbi8vIGFwcC13aWRlLCBub3Qgc2V0dGluZ3Mtc3BlY2lmaWMuXG4vLyAgIFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX2tleWJvYXJkLnB5XG5cbmltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBQYW5lbE5hdiB9IGZyb20gJy4vcGFuZWxuYXYuanMnO1xuaW1wb3J0IHtcbiAgX2NvbmZpcm1DYW5jZWwsIGNsb3NlQWxlcnRNb2RhbCwgY2xvc2VDb250cm9sc01vZGFsLCBjbG9zZUZpZWxkRWRpdE1vZGFsLFxuICBfZGlmZkRpc2NhcmQsIGNsb3NlQWN0aW9uc01vZGFsLCBjbG9zZUtlYmFiLCBpc0hhbWJ1cmdlck9wZW4sIGNsb3NlSGFtYnVyZ2VyLFxuICB0b3Btb3N0VmlzaWJsZU1vZGFsLCBvcGVuQ29udHJvbHNNb2RhbCxcbn0gZnJvbSAnLi91aS5qcyc7XG5pbXBvcnQge1xuICBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWwsIGNsb3NlQWJvdXRNb2RhbCwgY2xvc2VHbG9zc2FyeU1vZGFsLCBjbG9zZUhlbHBNb2RhbCxcbn0gZnJvbSAnLi9oZWxwbW9kYWxzLmpzJztcblxuLy8g4pSA4pSAIGtleWJvYXJkIHNob3J0Y3V0cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuLy8gRXNjYXBlIHBlZWxzIG9uZSBsYXllciBwZXIgcHJlc3MsIHRvcG1vc3QgZmlyc3Q6IGZsb2F0aW5nIG1lbnVzIChrZWJhYiB6OjUwMCxcbi8vIGhhbWJ1cmdlciB6OjMwMCkgc2l0IGFib3ZlIG1vZGFscyAoejoyMDApLCB3aGljaCBzaXQgYWJvdmUgdGhlIHNldHRpbmdzIHBhbmVsXG4vLyBhbmQgdGhlIGZ1bGwtcGFuZWwgZWRpdG9ycy4gdG9wbW9zdFZpc2libGVNb2RhbCAodWkuanMpIHJlc29sdmVzIG1vZGFsXG4vLyBzdGFja2luZyAtIGNvbmZpcm0vYWxlcnQgdGFrZSBwcmlvcml0eSwgc28gYSBcIkRpc2NhcmQ/XCIgY29uZmlybSBjYW5jZWxzXG4vLyB3aXRob3V0IGFsc28gY2xvc2luZyB0aGUgc3RpbGwtZGlydHkgZWRpdG9yIHVuZGVybmVhdGggaXQuXG4vL1xuLy8gU3RpbGwtY2xhc3NpYyBtb2RhbCBjbG9zZXJzICh3aW5kb3cuY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwgZXRjLikgYXJlIGNhbGxlZFxuLy8gYXMgYmFyZSBnbG9iYWxzIC0gdGhlaXIgb3duaW5nIG1vZHVsZXMgaGF2ZW4ndCBtaWdyYXRlZCB0byBFU00geWV0LlxuY29uc3QgX21vZGFsRXNjYXBlQ2xvc2VycyA9IHtcbiAgJ2NvbmZpcm0tbW9kYWwnOiAgICAgICAgICAgKCkgPT4gX2NvbmZpcm1DYW5jZWwoKSxcbiAgJ2FsZXJ0LW1vZGFsJzogICAgICAgICAgICAgKCkgPT4gY2xvc2VBbGVydE1vZGFsKCksXG4gICdnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwnOiAgICgpID0+IGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpLFxuICAnYWJvdXQtbW9kYWwnOiAgICAgICAgICAgICAoKSA9PiBjbG9zZUFib3V0TW9kYWwoKSxcbiAgJ2NvbnRyb2xzLW1vZGFsJzogICAgICAgICAgKCkgPT4gY2xvc2VDb250cm9sc01vZGFsKCksXG4gICdnbG9zc2FyeS1tb2RhbCc6ICAgICAgICAgICgpID0+IGNsb3NlR2xvc3NhcnlNb2RhbCgpLFxuICAnaGVscC1tb2RhbCc6ICAgICAgICAgICAgICAoKSA9PiBjbG9zZUhlbHBNb2RhbCgpLFxuICAnZmllbGQtZWRpdC1tb2RhbCc6ICAgICAgICAoKSA9PiBjbG9zZUZpZWxkRWRpdE1vZGFsKCksXG4gICdkaWZmLW1vZGFsJzogICAgICAgICAgICAgICgpID0+IF9kaWZmRGlzY2FyZCgpLFxuICAnc2NvcmUtb3ZlcnJpZGUtbW9kYWwnOiAgICAoKSA9PiBjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCgpLFxuICAncHJvZmlsZS1tb2RhbCc6ICAgICAgICAgICAoKSA9PiBjbG9zZVByb2ZpbGVNYW5hZ2VyKCksXG4gICdoaWdobGlnaHQtcmVlbHMtbW9kYWwnOiAgICgpID0+IGNsb3NlSGlnaGxpZ2h0UmVlbHNNb2RhbCgpLFxuICAncmVlbC1wcmV2aWV3LW1vZGFsJzogICAgICAoKSA9PiBjbG9zZVJlZWxQcmV2aWV3KCksXG4gICdyZXRyYW5zY3JpYmUtbW9kYWwnOiAgICAgICgpID0+IGNsb3NlUmV0cmFuc2NyaWJlTW9kYWwoKSxcbiAgJ2NvbnRleHQtbW9kYWwnOiAgICAgICAgICAgKCkgPT4gY2xvc2VDb250ZXh0TWFuYWdlcigpLFxuICAnYmF0Y2gtZXhwb3J0LW1vZGFsJzogICAgICAoKSA9PiBjbG9zZUJhdGNoRXhwb3J0TW9kYWwoKSxcbiAgJ2V4cG9ydC1zZXR0aW5ncy1tb2RhbCc6ICAgKCkgPT4gY2xvc2VFeHBvcnRNb2RhbCgpLFxuICAndGltZWxpbmUtaW50ZXJ2YWwtbW9kYWwnOiAoKSA9PiBjbG9zZVRpbWVsaW5lSW50ZXJ2YWxNb2RhbCgpLFxuICAnYXV0by1hcHByb3ZlLW1vZGFsJzogICAgICAoKSA9PiBjbG9zZUF1dG9BcHByb3ZlTW9kYWwoKSxcbiAgJ3NpbWlsYXItY2xpcHMtbW9kYWwnOiAgICAgKCkgPT4gY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCgpLFxuICAnYWN0aW9ucy1tb2RhbCc6ICAgICAgICAgICAoKSA9PiBjbG9zZUFjdGlvbnNNb2RhbCgpLFxufTtcblxuZnVuY3Rpb24gX2Nsb3NlVG9wbW9zdExheWVyKCkge1xuICBpZiAoY2xvc2VLZWJhYih0cnVlKSkgcmV0dXJuO1xuICBpZiAoaXNIYW1idXJnZXJPcGVuKCkpIHsgY2xvc2VIYW1idXJnZXIodHJ1ZSk7IHJldHVybjsgfVxuICBpZiAoaXNQcm9qZWN0TWVudU9wZW4oKSkgeyBjbG9zZVByb2plY3RNZW51KHRydWUpOyByZXR1cm47IH1cbiAgY29uc3QgdG9wTW9kYWwgPSB0b3Btb3N0VmlzaWJsZU1vZGFsKCk7XG4gIGlmICh0b3BNb2RhbCkge1xuICAgIChfbW9kYWxFc2NhcGVDbG9zZXJzW3RvcE1vZGFsLmlkXSB8fCAoKCkgPT4gdG9wTW9kYWwuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpKSkoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXR0aW5ncy1wYW5lbCcpLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpKSB7IGNsb3NlU2V0dGluZ3MoKTsgcmV0dXJuOyB9XG4gIGlmIChQYW5lbE5hdi5pc09wZW4oKSkgeyBQYW5lbE5hdi5jbG9zZSgpOyByZXR1cm47IH1cbiAgaWYgKF9pc05ld1JlY29yZGluZ1BhbmVsT3BlbigpKSBjbG9zZU5ld1JlY29yZGluZ1BhbmVsKCk7XG59XG5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcbiAgLy8gQSBmb2N1c2VkIGxpc3QgaXRlbSAoY2xpcC92aWRlbyA8bGk+KSBoYW5kbGVzIEVudGVyL1NwYWNlIGl0c2VsZiBhbmQgY2FsbHNcbiAgLy8gcHJldmVudERlZmF1bHQgLSBkb24ndCBBTFNPIHJ1biB0aGUgZ2xvYmFsIHNob3J0Y3V0IChlLmcuIFNwYWNlIHRvZ2dsaW5nXG4gIC8vIHBsYXkvcGF1c2Ugd2hpbGUgdGhlIGxpIGFjdGl2YXRpb24gaXMgc2VsZWN0aW5nIGEgY2xpcCkuXG4gIGlmIChlLmRlZmF1bHRQcmV2ZW50ZWQpIHJldHVybjtcblxuICBjb25zdCBpc1R5cGluZyA9IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdJTlBVVCcgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJyB8fCBlLnRhcmdldC5pc0NvbnRlbnRFZGl0YWJsZTtcblxuICAvLyBFc2NhcGUgbXVzdCB3b3JrIHdpdGggZm9jdXMgb24gYSBidXR0b24vc2VsZWN0L2xpbmsgLSB0aGF0J3Mgd2hlcmUgZXZlcnlcbiAgLy8gbW9kYWwgcGxhY2VzIGZvY3VzIG9uIG9wZW4uIE9ubHkgdHlwaW5nIHN1cmZhY2VzIGtlZXAgRXNjYXBlIHRvIHRoZW1zZWx2ZXNcbiAgLy8gKHRoZWlyIG93biBoYW5kbGVycywgZS5nLiB0aGUgaW5saW5lIGNhcHRpb24gZWRpdG9yLCB1c2UgaXQgdG8gY2FuY2VsKS5cbiAgaWYgKGUua2V5ID09PSAnRXNjYXBlJyAmJiBpc1R5cGluZykgcmV0dXJuO1xuXG4gIGlmIChlLmtleSAhPT0gJ0VzY2FwZScgJiZcbiAgICAgIChpc1R5cGluZyB8fCBlLnRhcmdldC50YWdOYW1lID09PSAnQlVUVE9OJyB8fCBlLnRhcmdldC50YWdOYW1lID09PSAnU0VMRUNUJyB8fCBlLnRhcmdldC50YWdOYW1lID09PSAnQScpKSByZXR1cm47XG5cbiAgLy8gQ3RybC9DbWQrWiAodW5kbykgaXMgdGhlIG9ubHkgYmluZGluZyB0aGF0IGludGVudGlvbmFsbHkgdXNlcyBhIG1vZGlmaWVyLlxuICAvLyBFdmVyeSBvdGhlciBzaG9ydGN1dCBpcyBhIGJhcmUga2V5LCBzbyBsZXQgbW9kaWZpZXIgY2hvcmRzIGZhbGwgdGhyb3VnaCB0b1xuICAvLyB0aGUgYnJvd3Nlci9PUyAoQ3RybCtSIHJlZnJlc2gsIENtZCtBIHNlbGVjdC1hbGwsIGV0Yy4pIGluc3RlYWQgb2YgaGlqYWNraW5nXG4gIC8vIHRoZW0gLSBydW5uaW5nIGEgYmFyZS1rZXkgaGFuZGxlciBoZXJlIHdvdWxkIGFsc28gcHJldmVudERlZmF1bHQgdGhlIGNob3JkLlxuICBpZiAoZS5rZXkgPT09ICd6JyAmJiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSkpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgdW5kb0xhc3RTdGF0dXMoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfHwgZS5hbHRLZXkpIHJldHVybjtcblxuICBjb25zdCBfYW55TW9kYWxPcGVuID0gKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm1vZGFsLWJnLnZpc2libGUnKSAhPT0gbnVsbDtcblxuICBpZiAoZS5rZXkgPT09ICc/JyB8fCBlLmtleSA9PT0gJy8nKSB7XG4gICAgaWYgKF9hbnlNb2RhbE9wZW4oKSkgcmV0dXJuO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBvcGVuQ29udHJvbHNNb2RhbCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgX2Nsb3NlVG9wbW9zdExheWVyKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gQSB0YWtlb3ZlciBwYW5lbCAoZS5nLiBTcGxpdCBFZGl0b3IpIGNvdmVycyB0aGUgZGV0YWlsIHBhbmUgYnV0IG5vdCB0aGVcbiAgLy8gY2xpcCBsaXN0IGJlc2lkZSBpdCAtIHdpdGhvdXQgdGhpcyBndWFyZCBKL0svQS9SIHdvdWxkIHNpbGVudGx5IGFjdCBvbiBhXG4gIC8vIGNsaXAgdGhlIHVzZXIgY2FuIG5vIGxvbmdlciBzZWUuXG4gIGlmIChfYW55TW9kYWxPcGVuKCkgfHwgUGFuZWxOYXYuaXNPcGVuKCkpIHJldHVybjtcblxuICAvLyBBL1IvRSBtdXN0IGFjdCBvbiB0aGUgY2xpcCB0aGUgdXNlciBpcyBwb2ludGluZyBhdDogd2hlbiBrZXlib2FyZCBmb2N1c1xuICAvLyBzaXRzIG9uIGEgY2xpcCBsaXN0IHJvdyAoVGFiKSwgdGhhdCByb3cgaXMgdGhlIHN1YmplY3QgLSBub3QgdGhlIGFjdGl2ZVxuICAvLyBjbGlwLCB3aGljaCBjYW4gYmUgYSBkaWZmZXJlbnQgcm93IChmb2N1c2VkLXZzLWFjdGl2ZSBtaXNtYXRjaCkuXG4gIGNvbnN0IGZvY3VzZWRSb3cgPSBlLnRhcmdldCBpbnN0YW5jZW9mIEVsZW1lbnQgPyBlLnRhcmdldC5jbG9zZXN0KCcjY2xpcC1saXN0IGxpW2RhdGEtY2xpcC1pZF0nKSA6IG51bGw7XG4gIGNvbnN0IHN1YmplY3RDbGlwSWQgPSBmb2N1c2VkUm93ID8gTnVtYmVyKGZvY3VzZWRSb3cuZGF0YXNldC5jbGlwSWQpIDogQXBwU3RhdGUuYWN0aXZlQ2xpcElkO1xuICBpZiAoIXN1YmplY3RDbGlwSWQpIHJldHVybjtcblxuICAvLyBBY3RpdmF0ZSB0aGUgc3ViamVjdCBmaXJzdCBzbyB0aGUgZGV0YWlsIHBhbmUgYW5kIHBsYXllciBzaG93IHRoZSBjbGlwXG4gIC8vIHRoZSBzaG9ydGN1dCBpcyBhY3Rpbmcgb24gYmVmb3JlIHRoZSBhY3Rpb24gbGFuZHMuXG4gIGNvbnN0IF9hY3RPblN1YmplY3QgPSBhY3Rpb24gPT4ge1xuICAgIGlmIChzdWJqZWN0Q2xpcElkICE9PSBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpIHNlbGVjdENsaXAoc3ViamVjdENsaXBJZCkudGhlbigoKSA9PiBhY3Rpb24oc3ViamVjdENsaXBJZCkpO1xuICAgIGVsc2UgYWN0aW9uKHN1YmplY3RDbGlwSWQpO1xuICB9O1xuICAvLyBBcnJvdyBuYXZpZ2F0aW9uIG1vdmVzIGtleWJvYXJkIGZvY3VzIGFsb25nIHdpdGggdGhlIGFjdGl2ZSBjbGlwIHNvIHRoZVxuICAvLyBmb2N1cyByaW5nIGFuZCB0aGUgYWN0aXZlIGhpZ2hsaWdodCBjYW4gbmV2ZXIgcG9pbnQgYXQgZGlmZmVyZW50IHJvd3MuXG4gIGNvbnN0IF9uYXZpZ2F0ZVRvID0gaWQgPT4ge1xuICAgIHNlbGVjdENsaXAoaWQpO1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCNjbGlwLWxpc3QgbGlbZGF0YS1jbGlwLWlkPVwiJHtpZH1cIl1gKT8uZm9jdXMoKTtcbiAgfTtcblxuICBjb25zdCBpZHggPSBBcHBTdGF0ZS5jbGlwcy5maW5kSW5kZXgoYyA9PiBjLmlkID09PSBzdWJqZWN0Q2xpcElkKTtcblxuICBzd2l0Y2ggKGUua2V5KSB7XG4gICAgY2FzZSAnYSc6IGNhc2UgJ0EnOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgX2FjdE9uU3ViamVjdChpZCA9PiBzZXRTdGF0dXMoaWQsICdhcHByb3ZlZCcpKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3InOiBjYXNlICdSJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIF9hY3RPblN1YmplY3QoaWQgPT4gc2V0U3RhdHVzKGlkLCAncmVqZWN0ZWQnKSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1JzogY2FzZSAnVSc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBfYWN0T25TdWJqZWN0KGlkID0+IHNldFN0YXR1cyhpZCwgJ3BlbmRpbmcnKSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICcgJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHsgY29uc3QgdiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNwbGF5ZXItYXJlYSB2aWRlbycpOyBpZiAodikgeyB2LnBhdXNlZCA/IHYucGxheSgpIDogdi5wYXVzZSgpOyB9IH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2UnOiBjYXNlICdFJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIF9hY3RPblN1YmplY3QoZXhwb3J0Q2xpcCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdBcnJvd0xlZnQnOlxuICAgIGNhc2UgJ0Fycm93VXAnOlxuICAgIGNhc2UgJ2snOiBjYXNlICdLJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGlmIChpZHggPiAwKSBfbmF2aWdhdGVUbyhBcHBTdGF0ZS5jbGlwc1tpZHggLSAxXS5pZCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdBcnJvd1JpZ2h0JzpcbiAgICBjYXNlICdBcnJvd0Rvd24nOlxuICAgIGNhc2UgJ2onOiBjYXNlICdKJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGlmIChpZHggIT09IC0xICYmIGlkeCA8IEFwcFN0YXRlLmNsaXBzLmxlbmd0aCAtIDEpIF9uYXZpZ2F0ZVRvKEFwcFN0YXRlLmNsaXBzW2lkeCArIDFdLmlkKTtcbiAgICAgIGJyZWFrO1xuICB9XG59KTtcblxuLy8gTm8gZXhwb3J0cyAtIHRoaXMgbW9kdWxlJ3Mgb25seSBwdWJsaWMgc3VyZmFjZSBpcyB0aGUga2V5ZG93biBsaXN0ZW5lclxuLy8gcmVnaXN0cmF0aW9uIGl0c2VsZjsgX21vZGFsRXNjYXBlQ2xvc2Vycy9fY2xvc2VUb3Btb3N0TGF5ZXIgYXJlIHJlZmVyZW5jZWRcbi8vIG9ubHkgZnJvbSB3aXRoaW4gdGhpcyBtb2R1bGUuIFN0aWxsLWNsYXNzaWMgZ2xvYmFscyBpdCBjYWxsc1xuLy8gKGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsLCBzZWxlY3RDbGlwLCBzZXRTdGF0dXMsIGV4cG9ydENsaXAsIGV0Yy4pIHJlc29sdmVcbi8vIG9mZiB3aW5kb3cgc2luY2UgdGhlaXIgb3duaW5nIG1vZHVsZXMgaGF2ZW4ndCBtaWdyYXRlZCB0byBFU00geWV0LlxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gdGhlIHJlY29tbWVuZGVkLW1vZGVsIGNhdGFsb2csIG1vZGVsLXJlYWRpbmVzcyByb3csIGFuZCB0aGVcbi8vIGNhcGFiaWxpdGllcyBvdmVydmlldyAoXCJ3aGF0IHNjb3JpbmcvdmlzaW9uIHBvd2VyIGlzIGluc3RhbGxlZCBhbmQgaG93IGRvIElcbi8vIGdldCBtb3JlXCIpLiBFeHRyYWN0ZWQgb3V0IG9mIHNldHRpbmdzLmpzICh3aGljaCBncmV3IGludG8gYSBjYXRjaC1hbGwpIC1cbi8vIHRoZXNlIHJlYWQgYmFja2VuZC9tb2RlbCBjb25maWcgdG8gZGVjaWRlIHdoYXQgdG8gcmVuZGVyLCBidXQgdGhlIHNhdmUvZGlydHlcbi8vIGVuZ2luZSB0aGF0IHBlcnNpc3RzIGNvbmZpZyBzdGF5cyBpbiBzZXR0aW5ncy5qcy5cbi8vICAgQVBJOiByb3V0ZXMvbGxtLnB5LCByb3V0ZXMvY29uZmlnLnB5IChjYXBhYmlsaXRpZXMvdGllcnMpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX21vZGVsX2NhdGFsb2cucHksIHRlc3RzL3VpL3Rlc3RfdWlfc2V0dGluZ3MucHlcbmltcG9ydCB7IGVzY0h0bWwgfSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5pbXBvcnQgeyBzaG93VG9hc3QgfSBmcm9tICcuL3V0aWxzLmpzJztcblxuLy8g4pSA4pSAIG1vZGVsIGNhdGFsb2cgKHJlY29tbWVuZGVkIHRleHQgKyB2aXNpb24gbW9kZWxzKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIExvYWRlZCBvbmNlIHBlciBzZXNzaW9uLiBGaWxscyB0aGUgcmVjb21tZW5kZWQgbW9kZWwgbGlzdHM7IHRoZSBjYXBhYmlsaXRpZXNcbi8vIGxpbmUgcmVmbGVjdHMgdGhlICpzYXZlZCogYWN0aXZlIG1vZGVsLlxubGV0IF9tb2RlbENhdGFsb2cgPSBudWxsO1xuLy8gbW9kZWxzX2RpciAvIGZyZWUgZGlzayAvIHNhdmVkIGJhY2tlbmQsIHNvIGNhcmRzIGNhbiBzaG93IFwiflggR0IsIFkgR0IgZnJlZVwiXG4vLyB1cCBmcm9udCBhbmQgdGhlIHN1bW1hcnkgbGluZSBjYW4gbmFtZSB0aGUgYWN0aXZlIGJhY2tlbmQuXG5sZXQgX21vZGVsQ2F0YWxvZ0luZm8gPSB7IG1vZGVsc19kaXI6ICcnLCBmcmVlX2diOiBudWxsLCBiYWNrZW5kOiAnbGxhbWFjcHAnIH07XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBfZW5zdXJlTW9kZWxDYXRhbG9nKCkge1xuICBpZiAoX21vZGVsQ2F0YWxvZykgcmV0dXJuO1xuICBhd2FpdCBfbG9hZE1vZGVsQ2F0YWxvZygpO1xufVxuXG4vLyBGb3JjZSBhIHJlLWZldGNoICsgcmUtcmVuZGVyLiBDYWxsZWQgYWZ0ZXIgU2F2ZSAoY29uZmlnIGNoYW5nZWQgd2hpY2ggbW9kZWwgaXNcbi8vIGFjdGl2ZSkgc28gdGhlIFwiQWN0aXZlXCIgYmFkZ2UgYW5kIHRoZSBzdW1tYXJ5IGxpbmUgcmVmbGVjdCB0aGUgc2F2ZWQgc3RhdGUuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVmcmVzaE1vZGVsQ2F0YWxvZygpIHtcbiAgX21vZGVsQ2F0YWxvZyA9IG51bGw7XG4gIGF3YWl0IF9sb2FkTW9kZWxDYXRhbG9nKCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9sb2FkTW9kZWxDYXRhbG9nKCkge1xuICB0cnkge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBmZXRjaCgnL2FwaS9sbG0vY2F0YWxvZycpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gICAgX21vZGVsQ2F0YWxvZyA9IGRhdGEubW9kZWxzIHx8IFtdO1xuICAgIF9tb2RlbENhdGFsb2dJbmZvID0ge1xuICAgICAgbW9kZWxzX2RpcjogZGF0YS5tb2RlbHNfZGlyIHx8ICcnLFxuICAgICAgZnJlZV9nYjogZGF0YS5mcmVlX2diID8/IG51bGwsXG4gICAgICBiYWNrZW5kOiBkYXRhLmJhY2tlbmQgfHwgJ2xsYW1hY3BwJyxcbiAgICB9O1xuICB9IGNhdGNoIHtcbiAgICBfbW9kZWxDYXRhbG9nID0gW107XG4gICAgY29uc3QgZmFpbGVkRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1sbGFtYWNwcC1yZWNvbW1lbmRlZCcpO1xuICAgIGlmIChmYWlsZWRFbCkgZmFpbGVkRWwuaW5uZXJIVE1MID1cbiAgICAgICc8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiPkNvdWxkIG5vdCBsb2FkIHRoZSByZWNvbW1lbmRlZCBtb2RlbCBsaXN0IC0gY2hlY2sgeW91ciBpbnRlcm5ldCBjb25uZWN0aW9uIGFuZCByZW9wZW4gU2V0dGluZ3MuIFlvdSBjYW4gc3RpbGwgc2V0IGEgbW9kZWwgZmlsZSBieSBoYW5kIHVuZGVyIEFkdmFuY2VkIEFJIG9wdGlvbnMgYmVsb3cuPC9kaXY+JztcbiAgICByZXR1cm47XG4gIH1cbiAgX3JlbmRlclJlY29tbWVuZGVkTW9kZWxzKCdzLWxsYW1hY3BwLXJlY29tbWVuZGVkJywgJ2xsYW1hY3BwJyk7XG4gIF91cGRhdGVDdXJyZW50TW9kZWxTdW1tYXJ5KCk7XG59XG5cbi8vIFwiQ3VycmVudGx5IHVzaW5nOiA8bW9kZWw+ICg8YmFja2VuZD4pXCIgLSBzdGF0ZXMgdGhlIHNhdmVkIGFjdGl2ZSBtb2RlbCBwbGFpbmx5XG4vLyBzbyBpdCBpc24ndCByZXZlcnNlLWVuZ2luZWVyZWQgZnJvbSBhIHBhdGggc3RyaW5nLiBIaWRkZW4gd2hlbiBub3RoaW5nIG1hdGNoZXMuXG5jb25zdCBfQkFDS0VORF9MQUJFTFMgPSB7IGxsYW1hY3BwOiAnTG9jYWwgbGxhbWEuY3BwJyB9O1xuXG5mdW5jdGlvbiBfdXBkYXRlQ3VycmVudE1vZGVsU3VtbWFyeSgpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1sbG0tY3VycmVudC1zdW1tYXJ5Jyk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgY29uc3QgYWN0aXZlID0gKF9tb2RlbENhdGFsb2cgfHwgW10pLmZpbmQobSA9PiBtLmFjdGl2ZSk7XG4gIGlmICghYWN0aXZlKSB7IGVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IHJldHVybjsgfVxuICBjb25zdCBiYWNrZW5kID0gX21vZGVsQ2F0YWxvZ0luZm8uYmFja2VuZDtcbiAgY29uc3QgbGFiZWwgPSBfQkFDS0VORF9MQUJFTFNbYmFja2VuZF0gfHwgYmFja2VuZDtcbiAgZWwuaW5uZXJIVE1MID1cbiAgICBgQ3VycmVudGx5IHVzaW5nOiA8c3Ryb25nPiR7ZXNjSHRtbChhY3RpdmUuZGlzcGxheV9uYW1lKX08L3N0cm9uZz4gYCArXG4gICAgYDxzcGFuIGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiPigke2VzY0h0bWwobGFiZWwpfSk8L3NwYW4+YDtcbiAgZWwuc3R5bGUuZGlzcGxheSA9ICcnO1xufVxuXG4vLyBUZXh0IGFuZCB2aXNpb24gbW9kZWxzIHJlbmRlciBhcyB0d28gbGFiZWxsZWQgZ3JvdXBzIHBlciBiYWNrZW5kLCBlYWNoIHdpdGhcbi8vIGl0cyBvd24gaW50cm8sIHJhdGhlciB0aGFuIG9uZSBmbGF0IGxpc3QgLSBzbyBpdCdzIG9idmlvdXMgd2hpY2ggbW9kZWxzIHNjb3JlXG4vLyBjbGlwcyBhbmQgd2hpY2ggZGVzY3JpYmUgZnJhbWVzLlxuZnVuY3Rpb24gX3JlbmRlclJlY29tbWVuZGVkTW9kZWxzKGNvbnRhaW5lcklkLCBiYWNrZW5kKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY29udGFpbmVySWQpO1xuICBpZiAoIWVsIHx8ICFfbW9kZWxDYXRhbG9nKSByZXR1cm47XG4gIGNvbnN0IG1vZGVscyA9IF9tb2RlbENhdGFsb2cuZmlsdGVyKG0gPT4gbS5iYWNrZW5kcy5pbmNsdWRlcyhiYWNrZW5kKSk7XG4gIGlmICghbW9kZWxzLmxlbmd0aCkgeyBlbC5pbm5lckhUTUwgPSAnJzsgcmV0dXJuOyB9XG4gIGNvbnN0IHRleHRNb2RlbHMgPSBtb2RlbHMuZmlsdGVyKG0gPT4gIW0ua2luZHMuaW5jbHVkZXMoJ3Zpc2lvbicpKTtcbiAgY29uc3QgdmlzaW9uTW9kZWxzID0gbW9kZWxzLmZpbHRlcihtID0+IG0ua2luZHMuaW5jbHVkZXMoJ3Zpc2lvbicpKTtcbiAgZWwuaW5uZXJIVE1MID1cbiAgICBfbW9kZWxHcm91cEh0bWwoJ1RleHQgc2NvcmluZyBtb2RlbHMnLFxuICAgICAgJ1Njb3JlIGNsaXBzIGFuZCB3cml0ZSBkZXNjcmlwdGlvbnMuIFBpY2sgb25lIHRvIGdldCBzdGFydGVkLicsIHRleHRNb2RlbHMsIGJhY2tlbmQsICd0ZXh0JykgK1xuICAgIF9tb2RlbEdyb3VwSHRtbCgnSW1hZ2UgYW5hbHlzaXMgKHZpc2lvbikgbW9kZWxzJyxcbiAgICAgICdPcHRpb25hbCAtIGxldCBZdXVDbGlwIGxvb2sgYXQgZnJhbWVzIGFuZCBkZXNjcmliZSB3aGF0IGlzIG9uIHNjcmVlbi4nLCB2aXNpb25Nb2RlbHMsIGJhY2tlbmQsICd2aXNpb24nKTtcbiAgX3dpcmVNb2RlbENhcmRzKGVsKTtcbn1cblxuZnVuY3Rpb24gX21vZGVsR3JvdXBIdG1sKHRpdGxlLCBpbnRybywgbW9kZWxzLCBiYWNrZW5kLCBraW5kKSB7XG4gIGlmICghbW9kZWxzLmxlbmd0aCkgcmV0dXJuICcnO1xuICByZXR1cm4gKFxuICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsLWdyb3VwXCI+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cInJlYy1tb2RlbC1ncm91cC10aXRsZVwiPiR7ZXNjSHRtbCh0aXRsZSl9PC9kaXY+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj4ke2VzY0h0bWwoaW50cm8pfTwvZGl2PmAgK1xuICAgICAgbW9kZWxzLm1hcChtID0+IF9yZWNNb2RlbEh0bWwobSwgYmFja2VuZCwga2luZCkpLmpvaW4oJycpICtcbiAgICBgPC9kaXY+YFxuICApO1xufVxuXG5mdW5jdGlvbiBfd2lyZU1vZGVsQ2FyZHMoZWwpIHtcbiAgZWwucXVlcnlTZWxlY3RvckFsbCgnLnJlYy1tb2RlbCcpLmZvckVhY2goY2FyZCA9PiB7XG4gICAgY29uc3QgbW9kZWxJZCA9IGNhcmQuZ2V0QXR0cmlidXRlKCdkYXRhLW1vZGVsLWlkJyk7XG4gICAgY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1hY3Q9XCJkb3dubG9hZC1nZ3VmXCJdJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gZG93bmxvYWRHZ3VmTW9kZWwobW9kZWxJZCwgY2FyZCkpO1xuICAgIGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtYWN0PVwidXNlLWdndWZcIl0nKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfdXNlR2d1Zk1vZGVsKG1vZGVsSWQpKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIF9tb2RlbE1ldGFMaW5lKG0pIHtcbiAgY29uc3QgZnJlZSA9IF9tb2RlbENhdGFsb2dJbmZvLmZyZWVfZ2I7XG4gIHJldHVybiBbXG4gICAgbS5zaXplX2diID8gYH4ke20uc2l6ZV9nYn0gR0JgIDogbnVsbCxcbiAgICAobS5zaXplX2diICE9IG51bGwgJiYgZnJlZSAhPSBudWxsKSA/IGAke2ZyZWV9IEdCIGZyZWVgIDogbnVsbCxcbiAgICBtLmxpY2VuY2UsXG4gIF0uZmlsdGVyKEJvb2xlYW4pLmpvaW4oJyDCtyAnKTtcbn1cblxuZnVuY3Rpb24gX21vZGVsQmFkZ2UobSkge1xuICBpZiAobS5hY3RpdmUpIHJldHVybiBgPHNwYW4gY2xhc3M9XCJyZWMtbW9kZWwtYmFkZ2UgYWN0aXZlXCI+QWN0aXZlPC9zcGFuPmA7XG4gIGlmIChtLmluc3RhbGxlZCkgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInJlYy1tb2RlbC1iYWRnZVwiPkRvd25sb2FkZWQ8L3NwYW4+YDtcbiAgcmV0dXJuICcnO1xufVxuXG5mdW5jdGlvbiBfcmVjTW9kZWxIdG1sKG0sIGJhY2tlbmQsIGtpbmQpIHtcbiAgY29uc3QgYWN0aW9ucyA9IF9sbGFtYWNwcEFjdGlvbnMobSk7XG4gIHJldHVybiAoXG4gICAgYDxkaXYgY2xhc3M9XCJyZWMtbW9kZWwke20uYWN0aXZlID8gJyBhY3RpdmUnIDogJyd9XCIgZGF0YS1tb2RlbC1pZD1cIiR7ZXNjSHRtbChtLmlkKX1cIiBkYXRhLWtpbmQ9XCIke2VzY0h0bWwoa2luZCB8fCAndGV4dCcpfVwiPmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJyZWMtbW9kZWwtaGVhZFwiPjxzcGFuIGNsYXNzPVwicmVjLW1vZGVsLW5hbWVcIj4ke2VzY0h0bWwobS5kaXNwbGF5X25hbWUpfTwvc3Bhbj5gICtcbiAgICAgIF9tb2RlbEJhZGdlKG0pICtcbiAgICAgIGA8c3BhbiBjbGFzcz1cInJlYy1tb2RlbC1tZXRhXCI+JHtlc2NIdG1sKF9tb2RlbE1ldGFMaW5lKG0pKX08L3NwYW4+PC9kaXY+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cInJlYy1tb2RlbC13aHlcIj4ke2VzY0h0bWwobS53aHkpfTwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJyZWMtbW9kZWwtYWN0aW9uc1wiPiR7YWN0aW9uc308L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwibWRsLXByb2dyZXNzXCIgZGF0YS1nZ3VmLXByb2dyZXNzIHN0eWxlPVwiZGlzcGxheTpub25lXCI+YCArXG4gICAgICAgIGA8ZGl2IGNsYXNzPVwibWRsLWJhclwiPjxkaXYgY2xhc3M9XCJtZGwtYmFyLWZpbGxcIiBkYXRhLWdndWYtZmlsbD48L2Rpdj48L2Rpdj5gICtcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwibWRsLXBjdFwiIGRhdGEtZ2d1Zi1wY3Q+PC9zcGFuPjwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1pbnN0YWxsLWxvZ1wiIGRhdGEtZ2d1Zi1sb2c+PC9kaXY+YCArXG4gICAgYDwvZGl2PmBcbiAgKTtcbn1cblxuLy8gT25lLWNsaWNrIHN1cmZhY2UgZm9yIGxvY2FsIC5nZ3VmIG1vZGVsczogZG93bmxvYWQgd2hlbiBtaXNzaW5nLCBcIlVzZSB0aGlzXG4vLyBtb2RlbFwiIHdoZW4gdGhlIGZpbGUgaXMgYWxyZWFkeSBvbiBkaXNrLCBhbmQgYSBwbGFpbiBcImluIHVzZVwiIG5vdGUgd2hlbiBhY3RpdmUuXG4vLyBUaGUgcmF3IHBhdGggYm94ZXMgKEFkdmFuY2VkIGRpc2Nsb3N1cmUpIHN0YXkgYXMgdGhlIG1hbnVhbCBmYWxsYmFjay5cbmZ1bmN0aW9uIF9sbGFtYWNwcEFjdGlvbnMobSkge1xuICBpZiAoIW0uZ2d1Zl91cmwpIHJldHVybiAnJztcbiAgaWYgKCFtLmdndWZfZmlsZW5hbWUpIHtcbiAgICByZXR1cm4gYDxhIGhyZWY9XCIke2VzY0h0bWwobS5nZ3VmX3VybCl9XCIgdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9vcGVuZXJcIj5Eb3dubG9hZCBwYWdlPC9hPmA7XG4gIH1cbiAgY29uc3QgcGFydHMgPSBbXTtcbiAgaWYgKG0uYWN0aXZlKSB7XG4gICAgcGFydHMucHVzaChgPHNwYW4gY2xhc3M9XCJyZWMtbW9kZWwtbm90ZVwiPkluIHVzZSBmb3IgbG9jYWwgc2NvcmluZy48L3NwYW4+YCk7XG4gIH0gZWxzZSBpZiAobS5pbnN0YWxsZWQpIHtcbiAgICBwYXJ0cy5wdXNoKGA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ0bi1zZWNvbmRhcnlcIiBkYXRhLWFjdD1cInVzZS1nZ3VmXCI+VXNlIHRoaXMgbW9kZWw8L2J1dHRvbj5gKTtcbiAgfSBlbHNlIHtcbiAgICBwYXJ0cy5wdXNoKGA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ0bi1zZWNvbmRhcnlcIiBkYXRhLWFjdD1cImRvd25sb2FkLWdndWZcIj5Eb3dubG9hZCBub3c8L2J1dHRvbj5gKTtcbiAgfVxuICBwYXJ0cy5wdXNoKGA8YSBocmVmPVwiJHtlc2NIdG1sKG0uZ2d1Zl91cmwpfVwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyXCI+Q2hvb3NlIGEgZGlmZmVyZW50IGZpbGU8L2E+YCk7XG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKTtcbn1cblxuLy8gUG9pbnQgdGhlIChhZHZhbmNlZCkgcGF0aCBmaWVsZHMgYXQgYW4gYWxyZWFkeS1wcmVzZW50IG1vZGVsIHNvIGEgcGxhaW4gU2F2ZVxuLy8gYWN0aXZhdGVzIGl0IC0gbm8gcmUtZG93bmxvYWQuIEEgdmlzaW9uIGVudHJ5IGZpbGxzIHRoZSB2aXNpb24gbW9kZWwgKyBtbXByb2pcbi8vIHByb2plY3RvciBmaWVsZHM7IGEgdGV4dCBlbnRyeSBmaWxscyB0aGUgdGV4dCBtb2RlbCBmaWVsZC4gVGhlIHR3byBidWNrZXRzXG4vLyBhcmUgaW5kZXBlbmRlbnQgY29uZmlnIGtleXMsIHNvIG9uZSBtdXN0IG5ldmVyIG92ZXJ3cml0ZSB0aGUgb3RoZXIuXG5mdW5jdGlvbiBfYXBwbHlNb2RlbFBhdGhzKG0pIHtcbiAgY29uc3QgaXNWaXNpb24gPSBBcnJheS5pc0FycmF5KG0ua2luZHMpICYmIG0ua2luZHMuaW5jbHVkZXMoJ3Zpc2lvbicpO1xuICBpZiAoaXNWaXNpb24pIHtcbiAgICBjb25zdCB2aXNpb25FbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWxsbS12aXNpb24tbW9kZWwtcGF0aCcpO1xuICAgIGlmICh2aXNpb25FbCAmJiBtLmdndWZfcGF0aCkgdmlzaW9uRWwudmFsdWUgPSBtLmdndWZfcGF0aDtcbiAgICBjb25zdCBwcm9qRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1sbG0tbW1wcm9qLXBhdGgnKTtcbiAgICBpZiAocHJvakVsICYmIG0ubW1wcm9qX3BhdGgpIHByb2pFbC52YWx1ZSA9IG0ubW1wcm9qX3BhdGg7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgcGF0aEVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxtLW1vZGVsLXBhdGgnKTtcbiAgICBpZiAocGF0aEVsICYmIG0uZ2d1Zl9wYXRoKSBwYXRoRWwudmFsdWUgPSBtLmdndWZfcGF0aDtcbiAgfVxuICB3aW5kb3cuX2NoZWNrU2V0dGluZ3NEaXJ0eSgpO1xufVxuXG5mdW5jdGlvbiBfdXNlR2d1Zk1vZGVsKG1vZGVsSWQpIHtcbiAgY29uc3QgbSA9IChfbW9kZWxDYXRhbG9nIHx8IFtdKS5maW5kKHggPT4geC5pZCA9PT0gbW9kZWxJZCk7XG4gIGlmICghbSkgcmV0dXJuO1xuICBfYXBwbHlNb2RlbFBhdGhzKG0pO1xuICBzaG93VG9hc3QoJ01vZGVsIHNlbGVjdGVkIC0gY2xpY2sgU2F2ZSB0byBhcHBseScsICdpbmZvJyk7XG59XG5cbi8vIOKUgOKUgCBvbmUtY2xpY2sgbG9jYWwgKC5nZ3VmKSBkb3dubG9hZCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFNlcnZlci1vd25lZCBkb3dubG9hZCAoUE9TVCAvYXBpL2xsbS9nZ3VmL2Rvd25sb2FkKSBmb3IgYSByZWNvbW1lbmRlZCBsb2NhbFxuLy8gbW9kZWwgKHRleHQsIG9yIHZpc2lvbiArIGl0cyBtbXByb2ogcHJvamVjdG9yKSwgc28gbGxhbWEuY3BwIGdldHMgYSBvbmUtY2xpY2tcbi8vIGZsb3cgaW5zdGVhZCBvZiBvbmx5IGEgXCJEb3dubG9hZCBwYWdlXCIgbGluay4gU1NFICsgQ2FuY2VsLXZpYS1hYm9ydCBzdHJlYW07XG4vLyBvbiBzdWNjZXNzIHRoZSBzZXJ2ZXIgaGFzIHdyaXR0ZW4gdGhlIG1vZGVsIChhbmQgcHJvamVjdG9yKSBwYXRoKHMpLCBzbyB3ZVxuLy8gcG9pbnQgdGhlIHBhdGggZmllbGRzIGF0IHRoZW0sIHJlZnJlc2ggdGhlIHJlYWRpbmVzcyBsaW5lLCBhbmQgcHJvbXB0IGEgU2F2ZS5cbmxldCBfZ2d1ZkFib3J0ID0gbnVsbDtcblxuLy8gVGhlIENMSSBwcmludHMgXCJEb3dubG9hZGluZyA8bmFtZT4gLSA8ZmlsZT46IE5OJSAoeC95IEdCKVwiIGxpbmVzOyBwdWxsIHRoZVxuLy8gcGVyY2VudGFnZSBvdXQgdG8gZHJpdmUgYSBkZXRlcm1pbmF0ZSBiYXIuIFZpc2lvbiBlbnRyaWVzIHN0cmVhbSB0d28gZmlsZXMgaW5cbi8vIHR1cm4sIHNvIHRoZSBiYXIgcmVzZXRzIHBlciBmaWxlIC0gZXhwZWN0ZWQsIG5vdCBhIGJ1Zy5cbmZ1bmN0aW9uIF9wYXJzZUdndWZQY3QobGluZSkge1xuICBjb25zdCBtYXRjaCA9IC8oXFxkKyklLy5leGVjKGxpbmUpO1xuICBpZiAoIW1hdGNoKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgcGN0ID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgcmV0dXJuIHBjdCA+PSAwICYmIHBjdCA8PSAxMDAgPyBwY3QgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBfc2V0R2d1ZlByb2dyZXNzKGNhcmQsIHZhbHVlKSB7XG4gIGNvbnN0IGZpbGwgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWdndWYtZmlsbF0nKTtcbiAgY29uc3QgcGN0ID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1nZ3VmLXBjdF0nKTtcbiAgaWYgKCFmaWxsIHx8ICFwY3QpIHJldHVybjtcbiAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICBmaWxsLmNsYXNzTGlzdC5hZGQoJ2luZGV0ZXJtaW5hdGUnKTtcbiAgICBmaWxsLnN0eWxlLndpZHRoID0gJyc7XG4gICAgcGN0LnRleHRDb250ZW50ID0gJyc7XG4gIH0gZWxzZSB7XG4gICAgZmlsbC5jbGFzc0xpc3QucmVtb3ZlKCdpbmRldGVybWluYXRlJyk7XG4gICAgZmlsbC5zdHlsZS53aWR0aCA9IHZhbHVlICsgJyUnO1xuICAgIHBjdC50ZXh0Q29udGVudCA9IHZhbHVlICsgJyUnO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9zZXRHZ3VmQ2FuY2VsKGNhcmQsIHNob3csIG9uQ2FuY2VsKSB7XG4gIGNvbnN0IGxvZyA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1sb2ddJyk7XG4gIGlmICghbG9nKSByZXR1cm47XG4gIGxldCBidG4gPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWdndWYtY2FuY2VsXScpO1xuICBpZiAoc2hvdykge1xuICAgIGlmICghYnRuKSB7XG4gICAgICBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgIGJ0bi5zZXRBdHRyaWJ1dGUoJ2RhdGEtZ2d1Zi1jYW5jZWwnLCAnJyk7XG4gICAgICBidG4udHlwZSA9ICdidXR0b24nO1xuICAgICAgYnRuLmNsYXNzTmFtZSA9ICdidG4tc2Vjb25kYXJ5JztcbiAgICAgIGJ0bi50ZXh0Q29udGVudCA9ICdDYW5jZWwgZG93bmxvYWQnO1xuICAgICAgYnRuLnN0eWxlLm1hcmdpblRvcCA9ICc0cHgnO1xuICAgICAgbG9nLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJ0biwgbG9nKTtcbiAgICB9XG4gICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgYnRuLm9uY2xpY2sgPSBvbkNhbmNlbDtcbiAgICBidG4uc3R5bGUuZGlzcGxheSA9ICcnO1xuICB9IGVsc2UgaWYgKGJ0bikge1xuICAgIGJ0bi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRvd25sb2FkR2d1Zk1vZGVsKG1vZGVsSWQsIGNhcmQpIHtcbiAgY29uc3QgbG9nID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1nZ3VmLWxvZ10nKTtcbiAgY29uc3QgYnV0dG9uID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1hY3Q9XCJkb3dubG9hZC1nZ3VmXCJdJyk7XG4gIGNvbnN0IHByb2dyZXNzID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1nZ3VmLXByb2dyZXNzXScpO1xuICBpZiAoIWxvZykgcmV0dXJuO1xuICBjb25zdCBtb2RlbCA9IChfbW9kZWxDYXRhbG9nIHx8IFtdKS5maW5kKHggPT4geC5pZCA9PT0gbW9kZWxJZCk7XG4gIGxvZy5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgbG9nLnRleHRDb250ZW50ID0gJ1N0YXJ0aW5nIGRvd25sb2FkIC0gdGhpcyBjYW4gdGFrZSBzZXZlcmFsIG1pbnV0ZXMuLi5cXG4nO1xuICBpZiAocHJvZ3Jlc3MpIHByb2dyZXNzLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgX3NldEdndWZQcm9ncmVzcyhjYXJkLCBudWxsKTtcbiAgaWYgKGJ1dHRvbikgeyBidXR0b24uZGlzYWJsZWQgPSB0cnVlOyBidXR0b24udGV4dENvbnRlbnQgPSAnRG93bmxvYWRpbmcuLi4nOyB9XG4gIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIF9nZ3VmQWJvcnQgPSBjb250cm9sbGVyO1xuICBfc2V0R2d1ZkNhbmNlbChjYXJkLCB0cnVlLCAoKSA9PiB7IGNvbnRyb2xsZXIuYWJvcnQoKTsgfSk7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcCA9IGF3YWl0IGZldGNoKGAvYXBpL2xsbS9nZ3VmL2Rvd25sb2FkP21vZGVsX2lkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KG1vZGVsSWQpfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgbWV0aG9kOiAnUE9TVCcsIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgaWYgKCFyZXNwLm9rKSB7XG4gICAgICBsZXQgZGV0YWlsID0gJyc7XG4gICAgICB0cnkgeyBkZXRhaWwgPSAoYXdhaXQgcmVzcC5qc29uKCkpLmRldGFpbCB8fCAnJzsgfSBjYXRjaCB7IGRldGFpbCA9IGF3YWl0IHJlc3AudGV4dCgpOyB9XG4gICAgICBsb2cudGV4dENvbnRlbnQgKz0gYOKclyAke2RldGFpbCB8fCAnRG93bmxvYWQgY291bGQgbm90IHN0YXJ0Lid9XFxuYDtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcmVhZGVyID0gcmVzcC5ib2R5LmdldFJlYWRlcigpO1xuICAgIGNvbnN0IGRlYyA9IG5ldyBUZXh0RGVjb2RlcigpO1xuICAgIGxldCBidWYgPSAnJztcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgeyBkb25lLCB2YWx1ZSB9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICAgIGlmIChkb25lKSBicmVhaztcbiAgICAgIGJ1ZiArPSBkZWMuZGVjb2RlKHZhbHVlLCB7IHN0cmVhbTogdHJ1ZSB9KTtcbiAgICAgIGNvbnN0IGxpbmVzID0gYnVmLnNwbGl0KCdcXG4nKTtcbiAgICAgIGJ1ZiA9IGxpbmVzLnBvcCgpO1xuICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKCdkYXRhOiAnKSkgY29udGludWU7XG4gICAgICAgIGNvbnN0IG1zZyA9IEpTT04ucGFyc2UobGluZS5zbGljZSg2KSk7XG4gICAgICAgIGlmIChtc2cgPT09ICdfX0RPTkVfXycpIHtcbiAgICAgICAgICBfc2V0R2d1ZlByb2dyZXNzKGNhcmQsIDEwMCk7XG4gICAgICAgICAgbG9nLnRleHRDb250ZW50ICs9ICfinJMgRG9uZSAtIG1vZGVsIHNlbGVjdGVkLiBTYXZlIHRvIGFwcGx5Llxcbic7XG4gICAgICAgICAgaWYgKG1vZGVsKSBfYXBwbHlNb2RlbFBhdGhzKG1vZGVsKTtcbiAgICAgICAgICBfdXBkYXRlTGxtQ2FwYWJpbGl0aWVzKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBjdCA9IF9wYXJzZUdndWZQY3QobXNnKTtcbiAgICAgICAgaWYgKHBjdCAhPSBudWxsKSBfc2V0R2d1ZlByb2dyZXNzKGNhcmQsIHBjdCk7XG4gICAgICAgIGxvZy50ZXh0Q29udGVudCArPSBtc2cgKyAnXFxuJztcbiAgICAgICAgbG9nLnNjcm9sbFRvcCA9IGxvZy5zY3JvbGxIZWlnaHQ7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyICYmIGVyci5uYW1lID09PSAnQWJvcnRFcnJvcicpIGxvZy50ZXh0Q29udGVudCArPSAn4pagIERvd25sb2FkIGNhbmNlbGxlZC5cXG4nO1xuICAgIGVsc2UgbG9nLnRleHRDb250ZW50ICs9ICfinJcgRG93bmxvYWQgZmFpbGVkIC0gY2hlY2sgeW91ciBjb25uZWN0aW9uIGFuZCB0cnkgYWdhaW4uXFxuJztcbiAgfSBmaW5hbGx5IHtcbiAgICBfZ2d1ZkFib3J0ID0gbnVsbDtcbiAgICBfc2V0R2d1ZkNhbmNlbChjYXJkLCBmYWxzZSk7XG4gICAgaWYgKHByb2dyZXNzKSBwcm9ncmVzcy5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIGlmIChidXR0b24pIHsgYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7IGJ1dHRvbi50ZXh0Q29udGVudCA9ICdEb3dubG9hZCBub3cnOyB9XG4gIH1cbn1cblxuLy8g4pSA4pSAIG1vZGVsIHJlYWRpbmVzcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFJlYWRpbmVzcyBvZiB0aGUgKnNhdmVkKiBhY3RpdmUgbW9kZWwuIFJlZmxlY3RzIGNvbmZpZyBvbiBkaXNrLCBub3QgdW5zYXZlZFxuLy8gZWRpdHMgLSByZWZyZXNoZWQgb24gb3BlbiBhbmQgYWZ0ZXIgU2F2ZS5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBfdXBkYXRlTGxtQ2FwYWJpbGl0aWVzKCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWxsbS1jYXBhYmlsaXRpZXMnKTtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBsZXQgY2FwO1xuICB0cnkge1xuICAgIGNhcCA9IGF3YWl0IGZldGNoKCcvYXBpL2xsbS9jYXBhYmlsaXRpZXMnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICB9IGNhdGNoIHsgZWwudGV4dENvbnRlbnQgPSAnQ291bGQgbm90IGNoZWNrIG1vZGVsIHJlYWRpbmVzcy4nOyByZXR1cm47IH1cbiAgY29uc3QgbWFyayA9IG9rID0+IG9rXG4gICAgPyAnPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+4pyTPC9zcGFuPiBSZWFkeSdcbiAgICA6ICc8c3BhbiBhcmlhLWhpZGRlbj1cInRydWVcIj7il4s8L3NwYW4+IE5vdCBzZXQgdXAnO1xuICBlbC5pbm5lckhUTUwgPVxuICAgIGA8c3BhbiBzdHlsZT1cIm1hcmdpbi1yaWdodDoxNHB4XCI+VGV4dCBzY29yaW5nOiAke21hcmsoY2FwLnRleHQpfTwvc3Bhbj5gICtcbiAgICBgPHNwYW4+SW1hZ2UgYW5hbHlzaXM6ICR7bWFyayhjYXAudmlzaW9uKX08L3NwYW4+YCArXG4gICAgYDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjRweFwiPiR7ZXNjSHRtbChjYXAuZGV0YWlsIHx8ICcnKX08L2Rpdj5gO1xuICBlbC5zdHlsZS5jb2xvciA9IGNhcC50ZXh0ID8gJ3ZhcigtLWdyZWVuKScgOiAndmFyKC0tbXV0ZWQpJztcbn1cblxuLy8g4pSA4pSAIGNhcGFiaWxpdGllcyBvdmVydmlldyAoU3RhZ2UgMDYpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQSByZWFkLW9ubHksIGF0LWEtZ2xhbmNlIG1hcCBvZiB0aGUgbm9uLUxMTSB1cGdyYWRlIHRpZXJzLiBTb3VyY2VzIGVhY2ggdGllcidzXG4vLyBhY3RpdmUgc3RhdGUgKyBpbnN0YWxsIGd1aWRhbmNlIGZyb20gdGhlIGJhY2tlbmQncyBhdmFpbGFiaWxpdHkoKSByZWFzb25zIHZpYVxuLy8gL2FwaS9jYXBhYmlsaXRpZXMvdGllcnMgLSBpdCBuZXZlciBpbnN0YWxscyBhbnl0aGluZyBpdHNlbGY7IGVhY2ggcm93IGxpbmtzIHRvXG4vLyB0aGUgc2VjdGlvbiB3aGVyZSB0aGUgcmVhbCBpbnN0YWxsL2VuYWJsZSBjb250cm9sIGxpdmVzLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIF9yZW5kZXJDYXBhYmlsaXR5VGllcnMoKSB7XG4gIGNvbnN0IGxpc3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1jYXBhYmlsaXRpZXMtbGlzdCcpO1xuICBjb25zdCBpbnRybyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWNhcGFiaWxpdGllcy1pbnRybycpO1xuICBpZiAoIWxpc3QpIHJldHVybjtcbiAgbGV0IGRhdGE7XG4gIHRyeSB7XG4gICAgZGF0YSA9IGF3YWl0IGZldGNoKCcvYXBpL2NhcGFiaWxpdGllcy90aWVycycpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gIH0gY2F0Y2gge1xuICAgIGlmIChpbnRybykgaW50cm8udGV4dENvbnRlbnQgPSAnJztcbiAgICBsaXN0LmlubmVySFRNTCA9ICc8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiPkNvdWxkIG5vdCBjaGVjayBjYXBhYmlsaXRpZXMuPC9kaXY+JztcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGludHJvKSB7XG4gICAgaW50cm8udGV4dENvbnRlbnQgPSBkYXRhLmxpZ2h0d2VpZ2h0XG4gICAgICA/IFwiTm8gbG9jYWwgbW9kZWwgaXMgc2V0IHVwIHlldCAtIHRyYW5zY3JpcHRpb24gYW5kIHRoZSBjb3JlIHNjb3JpbmcgYXJlIHdvcmtpbmcsIGFuZCBjbGlwcyBnZXQgYSBzaG9ydCB0ZW1wbGF0ZSBkZXNjcmlwdGlvbi4gU2V0dGluZyB1cCBhIGxvY2FsIG1vZGVsIGlzIHRoZSBub3JtYWwgbmV4dCBzdGVwOiBpdCBhZGRzIHdyaXR0ZW4gZGVzY3JpcHRpb25zLCBzZXNzaW9uIHN1bW1hcmllcywgYW5kIGEgc21hcnRlciByZWFkIG9uIHNjb3JpbmcuXCJcbiAgICAgIDogXCJIZXJlJ3Mgd2hhdCBlYWNoIHBhcnQgb2YgWXV1Q2xpcCBpcyB1c2luZyByaWdodCBub3csIGFuZCB3aGF0IHlvdSBjYW4gdXBncmFkZS5cIjtcbiAgfVxuICBsaXN0LmlubmVySFRNTCA9IChkYXRhLnRpZXJzIHx8IFtdKS5tYXAoX2NhcGFiaWxpdHlUaWVySHRtbCkuam9pbignJyk7XG4gIGxpc3QucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtc2VjdGlvbl0nKS5mb3JFYWNoKGJ0biA9PiB7XG4gICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gd2luZG93Ll9zY3JvbGxUb1NldHRpbmdzU2VjdGlvbihidG4uZ2V0QXR0cmlidXRlKCdkYXRhLXNlY3Rpb24nKSkpO1xuICB9KTtcbiAgbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1wcmVmZXRjaF0nKS5mb3JFYWNoKGJ0biA9PiB7XG4gICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gcHJlZmV0Y2hNb2RlbChidG4uZ2V0QXR0cmlidXRlKCdkYXRhLXByZWZldGNoJyksIGJ0bi5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGllci1pZCcpKSk7XG4gIH0pO1xufVxuXG4vLyBGb3VyIHZpc3VhbCBzdGF0ZXMsIG5vdCB0d286IGEgdGllciBjYW4gYmUgZnVsbHkgUmVhZHkgKGdyZWVuIGNoZWNrKSwgd2FpdGluZ1xuLy8gb24gYSBUaWVyLUIgbW9kZWwgaXQgY2FuIGZldGNoIHJpZ2h0IG5vdyAocHJlZmV0Y2hfc2x1ZyBzZXQgLSBcIkRvd25sb2FkIG5vd1wiKSxcbi8vIHdhaXRpbmcgb24gYSBUaWVyLUIgbW9kZWwgdG9vIHNtYWxsIHRvIGJvdGhlciB3aXRoIGEgcHJvZ3Jlc3MgVUkgKG5ldXRyYWwsIG5vXG4vLyBDVEEpLCBvciBnZW51aW5lbHkgbmVlZCBhIHJlYWwgc2V0dXAgc3RlcCAoaW5zdGFsbF9zbHVnIHNldCAtIGUuZy4gUHlhbm5vdGVcbi8vIG5lZWRzIGEgcGlwIGluc3RhbGwgKyBIdWdnaW5nRmFjZSB0b2tlbiwgc2hvd24gYXMgXCJTZXQgdXAg4oaSXCIpLlxuZnVuY3Rpb24gX2NhcGFiaWxpdHlUaWVySHRtbCh0aWVyKSB7XG4gIGNvbnN0IG5lZWRzU2V0dXAgPSAhdGllci5yZWFkeSAmJiAhIXRpZXIuaW5zdGFsbF9zbHVnO1xuICBjb25zdCBuZWVkc1ByZWZldGNoID0gIXRpZXIucmVhZHkgJiYgIW5lZWRzU2V0dXAgJiYgISF0aWVyLnByZWZldGNoX3NsdWc7XG4gIGNvbnN0IG1hcmsgPSB0aWVyLnJlYWR5ID8gJ+KckycgOiAobmVlZHNTZXR1cCB8fCBuZWVkc1ByZWZldGNoID8gJ+KXiycgOiAnJiM4OTQzOycpO1xuICBjb25zdCBtYXJrQ2xhc3MgPSB0aWVyLnJlYWR5ID8gJyByZWFkeScgOiAnJztcbiAgbGV0IGFjdGlvbiA9ICcnO1xuICBpZiAobmVlZHNTZXR1cCkge1xuICAgIGFjdGlvbiA9IGA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInNldHRpbmdzLWp1bXAtbGlua1wiIGRhdGEtc2VjdGlvbj1cIiR7ZXNjSHRtbCh0aWVyLnNlY3Rpb24pfVwiIHN0eWxlPVwibWFyZ2luLXRvcDoycHhcIj5TZXQgdXAgJnJhcnI7PC9idXR0b24+YDtcbiAgfSBlbHNlIGlmIChuZWVkc1ByZWZldGNoKSB7XG4gICAgYWN0aW9uID1cbiAgICAgIGA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImJ0bi1zZWNvbmRhcnlcIiBkYXRhLXByZWZldGNoPVwiJHtlc2NIdG1sKHRpZXIucHJlZmV0Y2hfc2x1Zyl9XCIgZGF0YS10aWVyLWlkPVwiJHtlc2NIdG1sKHRpZXIuaWQpfVwiIHN0eWxlPVwibWFyZ2luLXRvcDo0cHhcIj5Eb3dubG9hZCBub3c8L2J1dHRvbj5gICtcbiAgICAgIGA8ZGl2IGlkPVwiY2FwLXByZWZldGNoLWxvZy0ke2VzY0h0bWwodGllci5pZCl9XCIgY2xhc3M9XCJzZXR0aW5ncy1pbnN0YWxsLWxvZ1wiPjwvZGl2PmA7XG4gIH1cbiAgcmV0dXJuIChcbiAgICBgPGRpdiBjbGFzcz1cImNhcGFiaWxpdHktdGllclwiPmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJjYXBhYmlsaXR5LXRpZXItaGVhZFwiPmAgK1xuICAgICAgICBgPHNwYW4gY2xhc3M9XCJjYXBhYmlsaXR5LW1hcmske21hcmtDbGFzc31cIiBhcmlhLWhpZGRlbj1cInRydWVcIj4ke21hcmt9PC9zcGFuPmAgK1xuICAgICAgICBgPHNwYW4gY2xhc3M9XCJjYXBhYmlsaXR5LXRpZXItbmFtZVwiPiR7ZXNjSHRtbCh0aWVyLm5hbWUpfTwvc3Bhbj5gICtcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiY2FwYWJpbGl0eS10aWVyLWFjdGl2ZVwiPiR7ZXNjSHRtbCh0aWVyLmFjdGl2ZSl9PC9zcGFuPmAgK1xuICAgICAgYDwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+JHtlc2NIdG1sKHRpZXIucHVycG9zZSl9PC9kaXY+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj4ke2VzY0h0bWwodGllci51cGdyYWRlKX08L2Rpdj5gICtcbiAgICAgICh0aWVyLmRldGFpbCA/IGA8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiPiR7ZXNjSHRtbCh0aWVyLmRldGFpbCl9PC9kaXY+YCA6ICcnKSArXG4gICAgICBhY3Rpb24gK1xuICAgIGA8L2Rpdj5gXG4gICk7XG59XG5cbi8vIOKUgOKUgCBUaWVyLUIgbW9kZWwgcHJlZmV0Y2ggKFwiRG93bmxvYWQgbm93XCIpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gT25lIGZsb3cgZm9yIGV2ZXJ5IG5vbi1MTE0gVGllci1CIG1vZGVsIChzcGVha2VyL2F1ZGlvLWV2ZW50L2VtYmVkZGluZ3MpIC1cbi8vIHRoZSBzYW1lIFNTRSArIENhbmNlbCArIGxvZyBwYXR0ZXJuIGFzIHRoZSAuZ2d1ZiBkb3dubG9hZCBhYm92ZS4gVGhlIGxvY2FsXG4vLyAuZ2d1ZiBMTE0gbW9kZWwga2VlcHMgaXRzIG93biBzZXBhcmF0ZSBkb3dubG9hZCBmbG93LlxuY29uc3QgX1BSRUZFVENIX0xBQkVMUyA9IHtcbiAgc3BlYWtlcjogJ3RoZSBzcGVha2VyIG1vZGVsICh+ODAgTUIpJyxcbiAgYXVkaW9fZXZlbnQ6ICd0aGUgYXVkaW8tZXZlbnQgbW9kZWwgKH4zNTAgTUIpJyxcbiAgZW1iZWRkaW5nczogJ3RoZSBlbWJlZGRpbmdzIG1vZGVsICh+MTMwIE1CKScsXG59O1xuXG5sZXQgX3ByZWZldGNoQWJvcnQgPSBudWxsO1xuXG5mdW5jdGlvbiBfc2V0UHJlZmV0Y2hDYW5jZWwodGllcklkLCBzaG93LCBvbkNhbmNlbCkge1xuICBjb25zdCBsb2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgY2FwLXByZWZldGNoLWxvZy0ke3RpZXJJZH1gKTtcbiAgaWYgKCFsb2cpIHJldHVybjtcbiAgbGV0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBjYXAtcHJlZmV0Y2gtY2FuY2VsLSR7dGllcklkfWApO1xuICBpZiAoc2hvdykge1xuICAgIGlmICghYnRuKSB7XG4gICAgICBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgIGJ0bi5pZCA9IGBjYXAtcHJlZmV0Y2gtY2FuY2VsLSR7dGllcklkfWA7XG4gICAgICBidG4udHlwZSA9ICdidXR0b24nO1xuICAgICAgYnRuLmNsYXNzTmFtZSA9ICdidG4tc2Vjb25kYXJ5JztcbiAgICAgIGJ0bi50ZXh0Q29udGVudCA9ICdDYW5jZWwgZG93bmxvYWQnO1xuICAgICAgYnRuLnN0eWxlLm1hcmdpblRvcCA9ICc0cHgnO1xuICAgICAgbG9nLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGJ0biwgbG9nKTtcbiAgICB9XG4gICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgYnRuLm9uY2xpY2sgPSBvbkNhbmNlbDtcbiAgICBidG4uc3R5bGUuZGlzcGxheSA9ICcnO1xuICB9IGVsc2UgaWYgKGJ0bikge1xuICAgIGJ0bi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHByZWZldGNoTW9kZWwoc2x1ZywgdGllcklkKSB7XG4gIGNvbnN0IGxvZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBjYXAtcHJlZmV0Y2gtbG9nLSR7dGllcklkfWApO1xuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGBbZGF0YS1wcmVmZXRjaD1cIiR7Q1NTLmVzY2FwZShzbHVnKX1cIl1gKTtcbiAgaWYgKCFsb2cpIHJldHVybjtcbiAgbG9nLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICBsb2cudGV4dENvbnRlbnQgPSBgRG93bmxvYWRpbmcgJHtfUFJFRkVUQ0hfTEFCRUxTW3NsdWddIHx8IHNsdWd94oCmXFxuYDtcbiAgaWYgKGJ1dHRvbikgeyBidXR0b24uZGlzYWJsZWQgPSB0cnVlOyBidXR0b24udGV4dENvbnRlbnQgPSAnRG93bmxvYWRpbmfigKYnOyB9XG4gIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIF9wcmVmZXRjaEFib3J0ID0gY29udHJvbGxlcjtcbiAgX3NldFByZWZldGNoQ2FuY2VsKHRpZXJJZCwgdHJ1ZSwgKCkgPT4geyBjb250cm9sbGVyLmFib3J0KCk7IH0pO1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChgL2FwaS9tb2RlbHMvcHJlZmV0Y2g/c2x1Zz0ke2VuY29kZVVSSUNvbXBvbmVudChzbHVnKX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IG1ldGhvZDogJ1BPU1QnLCBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIH0pO1xuICAgIGlmICghcmVzcC5vaykge1xuICAgICAgbGV0IGRldGFpbCA9ICcnO1xuICAgICAgdHJ5IHsgZGV0YWlsID0gKGF3YWl0IHJlc3AuanNvbigpKS5kZXRhaWwgfHwgJyc7IH0gY2F0Y2ggeyBkZXRhaWwgPSBhd2FpdCByZXNwLnRleHQoKTsgfVxuICAgICAgbG9nLnRleHRDb250ZW50ICs9IGDinJcgJHtkZXRhaWwgfHwgJ0Rvd25sb2FkIGNvdWxkIG5vdCBzdGFydC4nfVxcbmA7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJlYWRlciA9IHJlc3AuYm9keS5nZXRSZWFkZXIoKTtcbiAgICBjb25zdCBkZWMgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICBsZXQgYnVmID0gJyc7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHsgZG9uZSwgdmFsdWUgfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG4gICAgICBpZiAoZG9uZSkgYnJlYWs7XG4gICAgICBidWYgKz0gZGVjLmRlY29kZSh2YWx1ZSwgeyBzdHJlYW06IHRydWUgfSk7XG4gICAgICBjb25zdCBsaW5lcyA9IGJ1Zi5zcGxpdCgnXFxuJyk7XG4gICAgICBidWYgPSBsaW5lcy5wb3AoKTtcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnZGF0YTogJykpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBtc2cgPSBKU09OLnBhcnNlKGxpbmUuc2xpY2UoNikpO1xuICAgICAgICBpZiAobXNnID09PSAnX19ET05FX18nKSB7XG4gICAgICAgICAgbG9nLnRleHRDb250ZW50ICs9ICfinJMgUmVhZHkuXFxuJztcbiAgICAgICAgICBfcmVuZGVyQ2FwYWJpbGl0eVRpZXJzKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxvZy50ZXh0Q29udGVudCArPSBtc2cgKyAnXFxuJztcbiAgICAgICAgbG9nLnNjcm9sbFRvcCA9IGxvZy5zY3JvbGxIZWlnaHQ7XG4gICAgICB9XG4gICAgfVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyICYmIGVyci5uYW1lID09PSAnQWJvcnRFcnJvcicpIGxvZy50ZXh0Q29udGVudCArPSAn4pagIERvd25sb2FkIGNhbmNlbGxlZC5cXG4nO1xuICAgIGVsc2UgbG9nLnRleHRDb250ZW50ICs9ICfinJcgRG93bmxvYWQgZmFpbGVkIC0gY2hlY2sgeW91ciBjb25uZWN0aW9uIGFuZCB0cnkgYWdhaW4uXFxuJztcbiAgfSBmaW5hbGx5IHtcbiAgICBfcHJlZmV0Y2hBYm9ydCA9IG51bGw7XG4gICAgX3NldFByZWZldGNoQ2FuY2VsKHRpZXJJZCwgZmFsc2UpO1xuICAgIGlmIChidXR0b24pIHsgYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7IGJ1dHRvbi50ZXh0Q29udGVudCA9ICdEb3dubG9hZCBub3cnOyB9XG4gIH1cbn1cblxuLy8gR2F0ZSBhIGNvbnRyb2wgb24gYSBtb2RlbCBjYXBhYmlsaXR5IChcInRleHRcIiB8IFwidmlzaW9uXCIpIGZyb21cbi8vIC9hcGkvbGxtL2NhcGFiaWxpdGllcy4gRGlzYWJsZXMgdGhlIGVsZW1lbnQgYW5kIGFwcGVuZHMgYSBsaW5rZWQgZXhwbGFuYXRpb25cbi8vIHdoZW4gdGhlIGNhcGFiaWxpdHkgaXMgdW5hdmFpbGFibGU7IHVzZWQgYnkgaW1hZ2UtYW5hbHlzaXMgY29udHJvbHMgKHBsYW4gMTEpLlxuLy8gUmV0dXJucyB0aGUgcmVzb2x2ZWQgY2FwYWJpbGl0aWVzIG9iamVjdC5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnYXRlT25DYXBhYmlsaXR5KGVsLCBjYXBhYmlsaXR5LCBtZXNzYWdlKSB7XG4gIGxldCBjYXA7XG4gIHRyeSB7XG4gICAgY2FwID0gYXdhaXQgZmV0Y2goJy9hcGkvbGxtL2NhcGFiaWxpdGllcycpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gIH0gY2F0Y2ggeyBjYXAgPSB7IHRleHQ6IGZhbHNlLCB2aXNpb246IGZhbHNlLCBkZXRhaWw6ICcnIH07IH1cbiAgY29uc3Qgb2sgPSAhIWNhcFtjYXBhYmlsaXR5XTtcbiAgZWwuZGlzYWJsZWQgPSAhb2s7XG4gIGxldCBub3RlID0gZWwucGFyZW50RWxlbWVudD8ucXVlcnlTZWxlY3RvcignLmdhdGUtbm90ZScpO1xuICBpZiAoIW9rKSB7XG4gICAgaWYgKCFub3RlKSB7XG4gICAgICBub3RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBub3RlLmNsYXNzTmFtZSA9ICdnYXRlLW5vdGUnO1xuICAgICAgZWwucGFyZW50RWxlbWVudD8uYXBwZW5kQ2hpbGQobm90ZSk7XG4gICAgfVxuICAgIG5vdGUuaW5uZXJIVE1MID0gYCR7ZXNjSHRtbChtZXNzYWdlKX0gPGEgaHJlZj1cIiNcIiBvbmNsaWNrPVwib3BlblNldHRpbmdzKCk7cmV0dXJuIGZhbHNlXCI+T3BlbiBTZXR0aW5nczwvYT5gO1xuICB9IGVsc2UgaWYgKG5vdGUpIHtcbiAgICBub3RlLnJlbW92ZSgpO1xuICB9XG4gIHJldHVybiBjYXA7XG59XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBSZWNvcmRpbmdzIGxpc3QgKyBkZXRhaWwgKGNvZGU6IHZpZGVvIC8gVmlkZW8pLlxuLy8gICBBUEk6IHJvdXRlcy92aWRlb3MucHkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdmlkZW8ucHksIHRlc3RzL2ludGVncmF0aW9uL3Rlc3RfdmlkZW9zLnB5XG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHtcbiAgZXNjSHRtbCwgcGx1cmFsLCBfZm10VmlkZW9TdGF0dXMsIF9tc1RvSG1zLCBfZm10RGF0ZSwgX3BhcnNlU2VydmVyRGF0ZSwgX2ZtdEVsYXBzZWQsIGZvcm1hdEFwaUVycm9yLFxufSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5pbXBvcnQgeyBjb2xsYXBzaWJsZUNhcmQsIHNob3dUb2FzdCwgbmV0RXJyTXNnLCByZXZlYWxJbkZvbGRlciwgX3N5bmNTb3J0RGlyQnRuLCBvcGVuTG9nLCBhcHBlbmRMb2cgfSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7IHNob3dDb25maXJtLCBvcGVuRmllbGRFZGl0TW9kYWwsIG9wZW5EaWZmTW9kYWwsIHNob3dLZWJhYiwgb3BlbkFjdGlvbnNNb2RhbCB9IGZyb20gJy4vdWkuanMnO1xuaW1wb3J0IHsgc2V0dXBSZWNvcmRpbmdQcmV2aWV3IH0gZnJvbSAnLi9wcmV2aWV3LmpzJztcbmltcG9ydCB7IHN0cmVhbVNTRSwgY2FuY2VsSm9iLCBfYmxvY2tlZEJ5QW5hbHl6ZSwgX3N0ZXBQaWxsTGFiZWwgfSBmcm9tICcuL2pvYnMuanMnO1xuaW1wb3J0IHsgb3BlbkdldHRpbmdTdGFydGVkTW9kYWwgfSBmcm9tICcuL2hlbHBtb2RhbHMuanMnO1xuLy8g4pSA4pSAIHZpZGVvcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmFzeW5jIGZ1bmN0aW9uIGxvYWRWaWRlb3MoKSB7XG4gIGxldCB2aWRlb3M7XG4gIHRyeSB7XG4gICAgY29uc3QgW3ZpZGVvc1Jlcywgc2Vzc2lvbnNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgZmV0Y2goJy9hcGkvdmlkZW9zJyksXG4gICAgICBmZXRjaCgnL2FwaS9zZXNzaW9ucycpLnRoZW4ociA9PiByLm9rID8gci5qc29uKCkgOiBbXSkuY2F0Y2goKCkgPT4gW10pLFxuICAgIF0pO1xuICAgIGlmICghdmlkZW9zUmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciBlcnJvciAke3ZpZGVvc1Jlcy5zdGF0dXN9YCk7XG4gICAgdmlkZW9zID0gYXdhaXQgdmlkZW9zUmVzLmpzb24oKTtcbiAgICBBcHBTdGF0ZS5zZXNzaW9ucyA9IHNlc3Npb25zO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlkZW8tbGlzdCcpLmlubmVySFRNTCA9XG4gICAgICBgPGxpIHN0eWxlPVwicGFkZGluZzoxMHB4IDE0cHg7Y29sb3I6dmFyKC0tcmVkKVwiPkZhaWxlZCB0byBsb2FkIHJlY29yZGluZ3M6ICR7ZXNjSHRtbChTdHJpbmcoZXJyLm1lc3NhZ2UgfHwgZXJyKSl9PC9saT5gO1xuICAgIHJldHVybjtcbiAgfVxuICBBcHBTdGF0ZS52aWRlb3MgPSB2aWRlb3M7XG5cbiAgLy8gV2hpbGUgYSBicmFuZC1uZXcgcmVjb3JkaW5nIGlzIGFuYWx5emluZywgc2hvdyBpdCBpbiB0aGUgc2lkZWJhciByaWdodCBhd2F5IC1cbiAgLy8gYmVmb3JlIGl0cyBEQiByb3cgZXhpc3RzIC0gc28gdGhlIHVzZXIgZ2V0cyBpbW1lZGlhdGUgZmVlZGJhY2suIFN1cHByZXNzZWRcbiAgLy8gb25jZSB0aGUgcmVhbCByb3cgYXBwZWFycyAobWF0Y2hlZCBieSBmaWxlbmFtZSkuXG4gIGNvbnN0IGFuYWx5emluZ05hbWUgPSBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWU7XG4gIGNvbnN0IHNob3dQbGFjZWhvbGRlciA9IGFuYWx5emluZ05hbWUgJiYgIXZpZGVvcy5zb21lKHYgPT4gdi5maWxlbmFtZSA9PT0gYW5hbHl6aW5nTmFtZSk7XG5cbiAgaWYgKCF2aWRlb3MubGVuZ3RoICYmICFzaG93UGxhY2Vob2xkZXIpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlkZW8tbGlzdCcpLmlubmVySFRNTCA9XG4gICAgICAnPGxpIHN0eWxlPVwicGFkZGluZzoxMHB4IDE0cHg7Y29sb3I6dmFyKC0tbXV0ZWQpXCI+Tm8gcmVjb3JkaW5ncyB5ZXQ8L2xpPic7XG4gICAgX3Nob3dFbXB0eVN0YXRlKCk7XG4gICAgX3VwZGF0ZURlbW9CdXR0b24oMCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgX3JlbmRlclZpZGVvTGlzdCgpO1xuICBfdXBkYXRlRGVtb0J1dHRvbih2aWRlb3MucmVkdWNlKChuLCB2KSA9PiBuICsgdi5hcHByb3ZlZCwgMCkpO1xuXG4gIGlmICghQXBwU3RhdGUuYm9vdFJlc3RvcmVEb25lKSB7XG4gICAgQXBwU3RhdGUuYm9vdFJlc3RvcmVEb25lID0gdHJ1ZTtcbiAgICBfcmVzdG9yZVZpZXcoKTtcbiAgfVxufVxuXG4vLyBDbGllbnQtc2lkZSBzZWFyY2ggKyBmaWx0ZXIgKyBzb3J0IG92ZXIgQXBwU3RhdGUudmlkZW9zIGZvciB0aGUgc2lkZWJhciBsaXN0LlxuZnVuY3Rpb24gX2FwcGx5VmlkZW9GaWx0ZXJzKHZpZGVvcykge1xuICBsZXQgcmVzdWx0ID0gdmlkZW9zLnNsaWNlKCk7XG4gIGNvbnN0IHEgPSAoQXBwU3RhdGUudmlkZW9TZWFyY2ggfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChxKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKHYgPT5cbiAgICAodi50aXRsZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fCAodi5maWxlbmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSk7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS52aWRlb0ZpbHRlcnM7XG4gIGlmIChmICYmIGYuc2l6ZSkge1xuICAgIGlmIChmLmhhcygnaGFzLWNsaXBzJykpIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIodiA9PiB2LmNsaXBfY291bnQgPiAwKTtcbiAgICBpZiAoZi5oYXMoJ3Vuc2NvcmVkJykpICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKHYgPT4gIXYuY2xpcHNfc2NvcmVkX2F0KTtcbiAgICBpZiAoZi5oYXMoJ2Vycm9ycycpKSAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKHYgPT4gKHYuY2xpcHNfbGxtX2Vycm9yIHx8IDApID4gMCk7XG4gIH1cbiAgY29uc3Qgc29ydCA9IEFwcFN0YXRlLnZpZGVvU29ydCB8fCAncmVjZW50JztcbiAgaWYgKHNvcnQgPT09ICd0aXRsZScpICAgICAgIHJlc3VsdC5zb3J0KChhLCBiKSA9PiAoYS50aXRsZSB8fCBhLmZpbGVuYW1lIHx8ICcnKS5sb2NhbGVDb21wYXJlKGIudGl0bGUgfHwgYi5maWxlbmFtZSB8fCAnJykpO1xuICBlbHNlIGlmIChzb3J0ID09PSAnZmlsZW5hbWUnKSByZXN1bHQuc29ydCgoYSwgYikgPT4gKGEuZmlsZW5hbWUgfHwgJycpLmxvY2FsZUNvbXBhcmUoYi5maWxlbmFtZSB8fCAnJywgdW5kZWZpbmVkLCB7IG51bWVyaWM6IHRydWUgfSkpO1xuICBlbHNlIGlmIChzb3J0ID09PSAnbGVuZ3RoJykgcmVzdWx0LnNvcnQoKGEsIGIpID0+IChiLmR1cmF0aW9uX21zIHx8IDApIC0gKGEuZHVyYXRpb25fbXMgfHwgMCkpO1xuICBlbHNlIGlmIChzb3J0ID09PSAnY2xpcHMnKSAgcmVzdWx0LnNvcnQoKGEsIGIpID0+IChiLmNsaXBfY291bnQgfHwgMCkgLSAoYS5jbGlwX2NvdW50IHx8IDApKTtcbiAgLy8gJ3JlY2VudCcga2VlcHMgdGhlIHNlcnZlciBvcmRlciAoY3JlYXRlZF9hdCBkZXNjKS5cbiAgaWYgKChBcHBTdGF0ZS52aWRlb1NvcnREaXIgfHwgJ2Rlc2MnKSA9PT0gJ2FzYycpIHJlc3VsdC5yZXZlcnNlKCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIFBlci1maWx0ZXIgY291bnRzIHNob3duIGlubGluZSBvbiB0aGUgcmVjb3JkaW5nIGZpbHRlciBjaGlwcyAoXCJVbnNjb3JlZCA0XCIpLlxuLy8gQ291bnRzIHJlZmxlY3QgZXZlcnkgbG9hZGVkIHJlY29yZGluZywgbm90IHRoZSBzZWFyY2gtbmFycm93ZWQgc3Vic2V0LCBhbmQgdXNlXG4vLyB0aGUgc2FtZSBwcmVkaWNhdGVzIGFzIF9hcHBseVZpZGVvRmlsdGVycy4gQmxhbmsgd2hlbiB0aGVyZSBhcmUgbm8gcmVjb3JkaW5ncy5cbmZ1bmN0aW9uIF9yZW5kZXJWaWRlb0ZpbHRlckNvdW50cygpIHtcbiAgY29uc3Qgc2V0Q291bnQgPSAoa2V5LCB2YWx1ZSkgPT4ge1xuICAgIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgLmNsaXAtY2hpcC1jb3VudFtkYXRhLXZjb3VudD1cIiR7a2V5fVwiXWApO1xuICAgIGlmIChiYWRnZSkgYmFkZ2UudGV4dENvbnRlbnQgPSB2YWx1ZSA9PSBudWxsID8gJycgOiBTdHJpbmcodmFsdWUpO1xuICB9O1xuICBjb25zdCB2aWRlb3MgPSBBcHBTdGF0ZS52aWRlb3MgfHwgW107XG4gIGlmICghdmlkZW9zLmxlbmd0aCkge1xuICAgIGZvciAoY29uc3Qga2V5IG9mIFsnYWxsJywgJ2hhcy1jbGlwcycsICd1bnNjb3JlZCcsICdlcnJvcnMnXSkgc2V0Q291bnQoa2V5LCBudWxsKTtcbiAgICByZXR1cm47XG4gIH1cbiAgc2V0Q291bnQoJ2FsbCcsIHZpZGVvcy5sZW5ndGgpO1xuICBzZXRDb3VudCgnaGFzLWNsaXBzJywgdmlkZW9zLmZpbHRlcih2ID0+IHYuY2xpcF9jb3VudCA+IDApLmxlbmd0aCk7XG4gIHNldENvdW50KCd1bnNjb3JlZCcsIHZpZGVvcy5maWx0ZXIodiA9PiAhdi5jbGlwc19zY29yZWRfYXQpLmxlbmd0aCk7XG4gIHNldENvdW50KCdlcnJvcnMnLCB2aWRlb3MuZmlsdGVyKHYgPT4gKHYuY2xpcHNfbGxtX2Vycm9yIHx8IDApID4gMCkubGVuZ3RoIHx8IG51bGwpO1xufVxuXG4vLyBSZWJ1aWxkcyB0aGUgc2lkZWJhciB2aWRlbyBsaXN0IGZyb20gQXBwU3RhdGUudmlkZW9zLCBhcHBseWluZyB0aGUgYWN0aXZlXG4vLyBzZWFyY2gvZmlsdGVyL3NvcnQuIENhbGxlZCBieSBsb2FkVmlkZW9zIChhZnRlciBmZXRjaCkgYW5kIGJ5IHRoZSBjb250cm9scy5cbmZ1bmN0aW9uIF9yZW5kZXJWaWRlb0xpc3QoKSB7XG4gIF9yZW5kZXJWaWRlb0ZpbHRlckNvdW50cygpO1xuICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZGVvLWxpc3QnKTtcbiAgbGlzdC5pbm5lckhUTUwgPSAnJztcbiAgY29uc3QgYW5hbHl6aW5nTmFtZSA9IEFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZTtcbiAgY29uc3Qgc2hvd1BsYWNlaG9sZGVyID0gYW5hbHl6aW5nTmFtZSAmJiAhQXBwU3RhdGUudmlkZW9zLnNvbWUodiA9PiB2LmZpbGVuYW1lID09PSBhbmFseXppbmdOYW1lKTtcbiAgaWYgKHNob3dQbGFjZWhvbGRlcikgbGlzdC5hcHBlbmRDaGlsZChfYW5hbHl6aW5nUGxhY2Vob2xkZXJMaShhbmFseXppbmdOYW1lKSk7XG5cbiAgY29uc3Qgc2hvd24gPSBfYXBwbHlWaWRlb0ZpbHRlcnMoQXBwU3RhdGUudmlkZW9zKTtcbiAgaWYgKCFzaG93bi5sZW5ndGggJiYgIXNob3dQbGFjZWhvbGRlcikge1xuICAgIGNvbnN0IGhhc0ZpbHRlciA9IEFwcFN0YXRlLnZpZGVvU2VhcmNoIHx8IChBcHBTdGF0ZS52aWRlb0ZpbHRlcnMgJiYgQXBwU3RhdGUudmlkZW9GaWx0ZXJzLnNpemUpO1xuICAgIGxpc3QuaW5uZXJIVE1MID0gaGFzRmlsdGVyXG4gICAgICA/IGA8bGkgc3R5bGU9XCJwYWRkaW5nOjEwcHggMTRweDtjb2xvcjp2YXIoLS1tdXRlZClcIj5ObyByZWNvcmRpbmdzIG1hdGNoIC0gPGEgaHJlZj1cIiNcIiBzdHlsZT1cImNvbG9yOnZhcigtLWFjY2VudCk7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZVwiIGRhdGEtYWN0PVwiY2xlYXItdmlkZW8tZmlsdGVyc1wiPkNsZWFyIGZpbHRlcnM8L2E+PC9saT5gXG4gICAgICA6ICc8bGkgc3R5bGU9XCJwYWRkaW5nOjEwcHggMTRweDtjb2xvcjp2YXIoLS1tdXRlZClcIj5ObyByZWNvcmRpbmdzIHlldDwvbGk+JztcbiAgICByZXR1cm47XG4gIH1cblxuICBfcmVuZGVyR3JvdXBlZFZpZGVvSXRlbXMobGlzdCwgc2hvd24sIGFuYWx5emluZ05hbWUpO1xuXG4gIGNvbnN0IF9oYW5kbGVWaWRlb0xpc3RBY3RpdmF0ZSA9IGUgPT4ge1xuICAgIGNvbnN0IGNsZWFyTGluayA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWFjdD1cImNsZWFyLXZpZGVvLWZpbHRlcnNcIl0nKTtcbiAgICBpZiAoY2xlYXJMaW5rKSB7IGUucHJldmVudERlZmF1bHQoKTsgX2NsZWFyVmlkZW9GaWx0ZXJzKCk7IHJldHVybjsgfVxuICAgIGNvbnN0IGxpID0gZS50YXJnZXQuY2xvc2VzdCgnbGlbZGF0YS12aWRlby1pZF0nKTtcbiAgICBpZiAoIWxpKSByZXR1cm47XG4gICAgY29uc3QgdmlkZW9JZCA9IHBhcnNlSW50KGxpLmRhdGFzZXQudmlkZW9JZCk7XG4gICAgaWYgKHdpbmRvdy5TZXNzaW9uVUkgJiYgd2luZG93LlNlc3Npb25VSS5zZWxlY3Rpb25Nb2RlKSB7IHdpbmRvdy50b2dnbGVHcm91cFNlbGVjdCh2aWRlb0lkKTsgcmV0dXJuOyB9XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI3ZpZGVvLWxpc3QgbGknKS5mb3JFYWNoKGwgPT4gbC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKSk7XG4gICAgbGkuY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XG4gICAgc2VsZWN0VmlkZW8odmlkZW9JZCk7XG4gIH07XG4gIGxpc3Qub25jbGljayA9IF9oYW5kbGVWaWRlb0xpc3RBY3RpdmF0ZTtcbiAgbGlzdC5vbmtleWRvd24gPSBlID0+IHsgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBfaGFuZGxlVmlkZW9MaXN0QWN0aXZhdGUoZSk7IH0gfTtcbn1cblxuLy8gUmVuZGVycyB0aGUgc2lkZWJhciBsaXN0IGdyb3VwZWQgYnkgc2Vzc2lvbjogYSBzZXNzaW9uJ3Mgc2hvd24gbWVtYmVycyBhcHBlYXJcbi8vIHRvZ2V0aGVyIHVuZGVyIGEgY29sbGFwc2libGUgaGVhZGVyLCBhbmNob3JlZCBhdCB0aGUgc29ydCBwb3NpdGlvbiBvZiB0aGVpclxuLy8gZmlyc3QtYXBwZWFyaW5nIG1lbWJlcjsgdW5ncm91cGVkIHJlY29yZGluZ3MgcmVuZGVyIGlubGluZS5cbmZ1bmN0aW9uIF9yZW5kZXJHcm91cGVkVmlkZW9JdGVtcyhsaXN0LCBzaG93biwgYW5hbHl6aW5nTmFtZSkge1xuICBjb25zdCBzZXNzaW9uQnlJZCA9IG5ldyBNYXAoKEFwcFN0YXRlLnNlc3Npb25zIHx8IFtdKS5tYXAocyA9PiBbcy5pZCwgc10pKTtcbiAgY29uc3QgcmVuZGVyZWRTZXNzaW9ucyA9IG5ldyBTZXQoKTtcbiAgZm9yIChjb25zdCB2IG9mIHNob3duKSB7XG4gICAgY29uc3Qgc2Vzc2lvbiA9IHYuc2Vzc2lvbl9pZCAhPSBudWxsID8gc2Vzc2lvbkJ5SWQuZ2V0KHYuc2Vzc2lvbl9pZCkgOiBudWxsO1xuICAgIGlmIChzZXNzaW9uICYmICFyZW5kZXJlZFNlc3Npb25zLmhhcyhzZXNzaW9uLmlkKSkge1xuICAgICAgcmVuZGVyZWRTZXNzaW9ucy5hZGQoc2Vzc2lvbi5pZCk7XG4gICAgICBjb25zdCBtZW1iZXJzID0gc2hvd24uZmlsdGVyKHggPT4geC5zZXNzaW9uX2lkID09PSBzZXNzaW9uLmlkKTtcbiAgICAgIGxpc3QuYXBwZW5kQ2hpbGQod2luZG93LnNlc3Npb25Hcm91cEhlYWRlckxpKHNlc3Npb24sIG1lbWJlcnMubGVuZ3RoKSk7XG4gICAgICBpZiAoIXdpbmRvdy5pc1Nlc3Npb25Db2xsYXBzZWQoc2Vzc2lvbi5pZCkpIHtcbiAgICAgICAgZm9yIChjb25zdCBtIG9mIG1lbWJlcnMpIGxpc3QuYXBwZW5kQ2hpbGQoX3ZpZGVvSXRlbUxpKG0sIGFuYWx5emluZ05hbWUsIHRydWUpKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCFzZXNzaW9uKSB7XG4gICAgICBsaXN0LmFwcGVuZENoaWxkKF92aWRlb0l0ZW1MaSh2LCBhbmFseXppbmdOYW1lLCBmYWxzZSkpO1xuICAgIH1cbiAgfVxufVxuXG4vLyBCdWlsZHMgb25lIHJlY29yZGluZyA8bGk+LiBpblNlc3Npb24gaW5kZW50cyBpdCB1bmRlciBpdHMgc2Vzc2lvbiBoZWFkZXI7XG4vLyBncm91cGluZyBzZWxlY3Rpb24gbW9kZSBhZGRzIGEgY2hlY2tib3ggYW5kIHN1cHByZXNzZXMgbm9ybWFsIG5hdmlnYXRpb24uXG5mdW5jdGlvbiBfdmlkZW9JdGVtTGkodiwgYW5hbHl6aW5nTmFtZSwgaW5TZXNzaW9uKSB7XG4gIGNvbnN0IGlzQW5hbHl6aW5nID0gdi5maWxlbmFtZSA9PT0gYW5hbHl6aW5nTmFtZSAmJiB2LnN0YXR1cyAhPT0gJ2RvbmUnO1xuICBjb25zdCBzZWxlY3RpbmcgPSAhISh3aW5kb3cuU2Vzc2lvblVJICYmIHdpbmRvdy5TZXNzaW9uVUkuc2VsZWN0aW9uTW9kZSk7XG4gIGNvbnN0IHNlbGVjdGFibGUgPSBzZWxlY3RpbmcgJiYgdi5wYXJlbnRfdmlkZW9faWQgPT0gbnVsbDtcbiAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICBsaS5jbGFzc05hbWUgPSAndmlkZW8taXRlbSdcbiAgICArICh2LmlkID09PSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID8gJyBhY3RpdmUnIDogJycpXG4gICAgKyAoaXNBbmFseXppbmcgPyAnIGFuYWx5emluZycgOiAnJylcbiAgICArIChpblNlc3Npb24gPyAnIGluLXNlc3Npb24nIDogJycpXG4gICAgKyAoc2VsZWN0YWJsZSAmJiB3aW5kb3cuU2Vzc2lvblVJLnNlbGVjdGVkLmhhcyh2LmlkKSA/ICcgc2VsZWN0ZWQnIDogJycpO1xuICBsaS5kYXRhc2V0LnZpZGVvSWQgPSB2LmlkO1xuICBsaS50YWJJbmRleCA9IDA7XG4gIGNvbnN0IGNsaXBzUGN0ID0gdi5kdXJhdGlvbl9tcyA+IDBcbiAgICA/IGAgKCR7TWF0aC5yb3VuZCh2LnRvdGFsX2NsaXBfbXMgLyB2LmR1cmF0aW9uX21zICogMTAwKX0lKWBcbiAgICA6ICcnO1xuICBjb25zdCBzY29yZUJhciA9ICh2LnNjb3JlX21pbiAhPT0gbnVsbCAmJiB2LnNjb3JlX21heCAhPT0gbnVsbCAmJiB2LmNsaXBfY291bnQgPiAwKVxuICAgID8gYDxkaXYgY2xhc3M9XCJtZXRhXCI+U2NvcmVzOiAke01hdGgucm91bmQodi5zY29yZV9taW4gKiAxMDApfSUg4oCTICR7TWF0aC5yb3VuZCh2LnNjb3JlX21heCAqIDEwMCl9JTwvZGl2PmBcbiAgICA6ICcnO1xuICBjb25zdCBzZWdtZW50TWV0YSA9ICh2LnNlZ21lbnRfc3RhcnRfcyAhPSBudWxsICYmIHYuc2VnbWVudF9lbmRfcyAhPSBudWxsKVxuICAgID8gYDxkaXYgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS1hY2NlbnQyKVwiIHRpdGxlPVwiV2hlcmUgdGhpcyBwYXJ0IHNpdHMgaW5zaWRlIHRoZSBvcmlnaW5hbCByZWNvcmRpbmdcIj5mcm9tICR7X21zVG9IbXModi5zZWdtZW50X3N0YXJ0X3MgKiAxMDAwKX0gdG8gJHtfbXNUb0htcyh2LnNlZ21lbnRfZW5kX3MgKiAxMDAwKX08L2Rpdj5gXG4gICAgOiAnJztcbiAgY29uc3QgZXJyQ291bnQgPSB2LmNsaXBzX2xsbV9lcnJvciB8fCAwO1xuICAvLyBBIG1pc3NpbmcgbW9kZWwgaXMgYSBzZXR1cCBzdGF0ZSwgbm90IGEgZmFpbHVyZTogd2hlbiBubyBsYW5ndWFnZSBtb2RlbCBpc1xuICAvLyB1c2FibGUgcmlnaHQgbm93LCB0aGVzZSBjbGlwcyB3ZXJlIHNpbXBseSBzY29yZWQgYmVmb3JlIG9uZSB3YXMgc2V0IHVwLCBzb1xuICAvLyBzaG93IGEgY2FsbSBub3RlIHJhdGhlciB0aGFuIGFuIGFsYXJtaW5nIHJlZCBcIk4gc2NvcmluZyBlcnJvcnNcIiBiYWRnZS5cbiAgY29uc3QgbGxtVXNhYmxlID0gISEod2luZG93Ll9wcmVyZXFzIHx8IHt9KS5sbG1fb2s7XG4gIGNvbnN0IGVyckJhZGdlID0gZXJyQ291bnQgPT09IDAgPyAnJ1xuICAgIDogbGxtVXNhYmxlXG4gICAgPyBgPGRpdiBjbGFzcz1cIm1ldGFcIiBzdHlsZT1cIm1hcmdpbi10b3A6MnB4O2NvbG9yOnZhcigtLXdhcm5pbmcpXCIgdGl0bGU9XCJMTE0gc2NvcmluZyBmYWlsZWQgZm9yICR7cGx1cmFsKGVyckNvdW50LCAnY2xpcCcpfSAtIHJlLXNjb3JlIHRvIHJldHJ5XCI+JiM5ODg4OyAke3BsdXJhbChlcnJDb3VudCwgJ3Njb3JpbmcgZXJyb3InKX08L2Rpdj5gXG4gICAgOiBgPGRpdiBjbGFzcz1cIm1ldGFcIiBzdHlsZT1cIm1hcmdpbi10b3A6MnB4O2NvbG9yOnZhcigtLW11dGVkKVwiIHRpdGxlPVwiVGhlc2UgY2xpcHMgd2VyZSBzY29yZWQgYmVmb3JlIGEgbGFuZ3VhZ2UgbW9kZWwgd2FzIHNldCB1cCAtIHNldCBvbmUgdXAsIHRoZW4gcmUtc2NvcmUgZm9yIEFJIHNjb3JpbmcgYW5kIGRlc2NyaXB0aW9uc1wiPlNjb3JlZCB3aXRob3V0IGEgbGFuZ3VhZ2UgbW9kZWw8L2Rpdj5gO1xuICBjb25zdCBjaGVja2JveCA9IHNlbGVjdGFibGVcbiAgICA/IGA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgY2xhc3M9XCJzZXNzaW9uLXNlbGVjdC1ib3hcIiBhcmlhLWxhYmVsPVwiU2VsZWN0IGZvciBncm91cGluZ1wiICR7d2luZG93LlNlc3Npb25VSS5zZWxlY3RlZC5oYXModi5pZCkgPyAnY2hlY2tlZCcgOiAnJ30+YFxuICAgIDogJyc7XG4gIGxpLmlubmVySFRNTCA9IGBcbiAgICA8ZGl2IGNsYXNzPVwidmlkZW8taXRlbS1ib2R5XCI+XG4gICAgICAke2NoZWNrYm94fVxuICAgICAgPGRpdiBzdHlsZT1cImZsZXg6MTttaW4td2lkdGg6MFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwibmFtZVwiIHRpdGxlPVwiJHt2LnRpdGxlID8gZXNjSHRtbCh2LmZpbGVuYW1lKSA6ICcnfVwiPiR7ZXNjSHRtbCh2LnRpdGxlIHx8IHYuZmlsZW5hbWUpfTwvZGl2PlxuICAgICAgICAke3YudGl0bGUgPyBgPGRpdiBjbGFzcz1cInZpZGVvLXRpdGxlXCI+JHtlc2NIdG1sKHYuZmlsZW5hbWUpfTwvZGl2PmAgOiAnJ31cbiAgICAgICAgJHtzZWdtZW50TWV0YX1cbiAgICAgICAgPGRpdiBjbGFzcz1cIm1ldGFcIj4ke3YuZHVyYXRpb25faG1zfSAmbWlkZG90OyAke3YuY2xpcF9jb3VudH0gY2xpcHMgJm1pZGRvdDsgJHtfbXNUb0htcyh2LnRvdGFsX2NsaXBfbXMpfSBjbGlwcGVkJHtjbGlwc1BjdH08L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm1ldGFcIj4ke2lzQW5hbHl6aW5nXG4gICAgICAgICAgPyBgPHNwYW4gY2xhc3M9XCJzcGlubmVyXCIgc3R5bGU9XCJkaXNwbGF5OmlubGluZS1ibG9jazt2ZXJ0aWNhbC1hbGlnbjptaWRkbGVcIj48L3NwYW4+IDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tYWNjZW50KVwiPiR7ZXNjSHRtbChfZm10VmlkZW9TdGF0dXModi5zdGF0dXMpKX3igKY8L3NwYW4+YFxuICAgICAgICAgIDogYCR7di5hcHByb3ZlZH0gYXBwcm92ZWQgJm1pZGRvdDsgJHt2LmV4cG9ydGVkfSBleHBvcnRlZCAmbWlkZG90OyAke19mbXRWaWRlb1N0YXR1cyh2LnN0YXR1cyl9YH08L2Rpdj5cbiAgICAgICAgJHtlcnJCYWRnZX1cbiAgICAgICAgJHtzY29yZUJhcn1cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PmA7XG4gIHJldHVybiBsaTtcbn1cblxuLy8g4pSA4pSAIHZpZGVvIHNlYXJjaCAvIGZpbHRlciAvIHNvcnQgY29udHJvbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBzZXRWaWRlb1NlYXJjaChxKSB7IEFwcFN0YXRlLnZpZGVvU2VhcmNoID0gcS50cmltKCk7IF9yZW5kZXJWaWRlb0xpc3QoKTsgfVxuZnVuY3Rpb24gc2V0VmlkZW9Tb3J0KHNvcnQpIHtcbiAgQXBwU3RhdGUudmlkZW9Tb3J0ID0gc29ydDtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3ZpZGVvcy1zb3J0Jywgc29ydCk7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbn1cbmZ1bmN0aW9uIHRvZ2dsZVZpZGVvU29ydERpcigpIHtcbiAgQXBwU3RhdGUudmlkZW9Tb3J0RGlyID0gKEFwcFN0YXRlLnZpZGVvU29ydERpciA9PT0gJ2FzYycpID8gJ2Rlc2MnIDogJ2FzYyc7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd2aWRlb3Mtc29ydC1kaXInLCBBcHBTdGF0ZS52aWRlb1NvcnREaXIpO1xuICBfc3luY1NvcnREaXJCdG4oJ3ZpZGVvcy1zb3J0LWRpcicsIEFwcFN0YXRlLnZpZGVvU29ydERpcik7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbn1cblxuZnVuY3Rpb24gdG9nZ2xlVmlkZW9GaWx0ZXIodG9rZW4pIHtcbiAgY29uc3QgZiA9IEFwcFN0YXRlLnZpZGVvRmlsdGVycztcbiAgaWYgKHRva2VuID09PSAnYWxsJykgZi5jbGVhcigpO1xuICBlbHNlIGlmIChmLmhhcyh0b2tlbikpIGYuZGVsZXRlKHRva2VuKTtcbiAgZWxzZSBmLmFkZCh0b2tlbik7XG4gIF9zeW5jVmlkZW9GaWx0ZXJDaGlwcygpO1xuICBfcmVuZGVyVmlkZW9MaXN0KCk7XG59XG5cbmZ1bmN0aW9uIF9zeW5jVmlkZW9GaWx0ZXJDaGlwcygpIHtcbiAgY29uc3QgZiA9IEFwcFN0YXRlLnZpZGVvRmlsdGVycztcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtdmZpbHRlcl0nKS5mb3JFYWNoKGNoaXAgPT4ge1xuICAgIGNvbnN0IHRva2VuID0gY2hpcC5kYXRhc2V0LnZmaWx0ZXI7XG4gICAgY29uc3QgYWN0aXZlID0gdG9rZW4gPT09ICdhbGwnID8gZi5zaXplID09PSAwIDogZi5oYXModG9rZW4pO1xuICAgIGNoaXAuY2xhc3NMaXN0LnRvZ2dsZSgnYWN0aXZlJywgYWN0aXZlKTtcbiAgICBjaGlwLnNldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJywgYWN0aXZlID8gJ3RydWUnIDogJ2ZhbHNlJyk7XG4gIH0pO1xuICBfc3luY1ZpZGVvTW9yZUZpbHRlcnMoKTtcbn1cblxuLy8gUmVjb3JkaW5nIGZpbHRlcnMgdGhhdCBsaXZlIGluc2lkZSB0aGUgXCJNb3JlIGZpbHRlcnNcIiBleHBhbmRlci4gTWlycm9yc1xuLy8gY2xpcHMuanMgX0hJRERFTl9GSUxURVJfVE9LRU5TIC8gX3N5bmNNb3JlRmlsdGVyczogZm9yY2UgdGhlIGV4cGFuZGVyIG9wZW5cbi8vIHdoZW5ldmVyIG9uZSBvZiB0aGUgZmlsdGVycyBpdCBoaWRlcyBpcyBhY3RpdmUgKGFuZCBzaG93IHRoZSBcImZpbHRlcmVkXCIgZG90KSxcbi8vIHNvIHRoZSBsaXN0IGlzIG5ldmVyIG15c3RlcmlvdXNseSBmaWx0ZXJlZC4gT25seSBldmVyIGZvcmNlZCBPUEVOIC0gb24gcmV0dXJuXG4vLyB0byBBbGwgLyBIYXMgY2xpcHMgdGhlIHVzZXIgY2FuIGNvbGxhcHNlIGl0IGFnYWluLlxuY29uc3QgX0hJRERFTl9WRklMVEVSX1RPS0VOUyA9IFsndW5zY29yZWQnLCAnZXJyb3JzJ107XG5mdW5jdGlvbiBfc3luY1ZpZGVvTW9yZUZpbHRlcnMoKSB7XG4gIGNvbnN0IGRldGFpbHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlkZW8tbW9yZS1maWx0ZXJzJyk7XG4gIGlmICghZGV0YWlscykgcmV0dXJuO1xuICBjb25zdCBhY3RpdmUgPSBfSElEREVOX1ZGSUxURVJfVE9LRU5TLnNvbWUodCA9PiBBcHBTdGF0ZS52aWRlb0ZpbHRlcnMuaGFzKHQpKTtcbiAgaWYgKGFjdGl2ZSkgZGV0YWlscy5vcGVuID0gdHJ1ZTtcbiAgY29uc3QgZmxhZyA9IGRldGFpbHMucXVlcnlTZWxlY3RvcignW2RhdGEtbW9yZS1mbGFnXScpO1xuICBpZiAoZmxhZykgZmxhZy5oaWRkZW4gPSAhYWN0aXZlO1xufVxuXG5mdW5jdGlvbiBfY2xlYXJWaWRlb0ZpbHRlcnMoKSB7XG4gIEFwcFN0YXRlLnZpZGVvRmlsdGVycy5jbGVhcigpO1xuICBBcHBTdGF0ZS52aWRlb1NlYXJjaCA9ICcnO1xuICBjb25zdCBzZWFyY2hFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2aWRlby1zZWFyY2gtaW5wdXQnKTtcbiAgaWYgKHNlYXJjaEVsKSBzZWFyY2hFbC52YWx1ZSA9ICcnO1xuICBfc3luY1ZpZGVvRmlsdGVyQ2hpcHMoKTtcbiAgX3JlbmRlclZpZGVvTGlzdCgpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfcmVzdG9yZVZpZXcoKSB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc2F2ZWQgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd5dXVjbGlwLXZpZXcnKSB8fCAnbnVsbCcpO1xuICAgIGlmICghc2F2ZWQ/LnZpZGVvSWQpIHJldHVybjtcbiAgICBpZiAoIUFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gc2F2ZWQudmlkZW9JZCkpIHJldHVybjtcbiAgICBhd2FpdCBzZWxlY3RWaWRlbyhzYXZlZC52aWRlb0lkKTtcbiAgICBpZiAoc2F2ZWQuY2xpcElkICYmIEFwcFN0YXRlLmNsaXBzLmZpbmQoYyA9PiBjLmlkID09PSBzYXZlZC5jbGlwSWQpKSB7XG4gICAgICBhd2FpdCB3aW5kb3cuc2VsZWN0Q2xpcChzYXZlZC5jbGlwSWQpO1xuICAgIH1cbiAgfSBjYXRjaCB7fVxufVxuXG5mdW5jdGlvbiBfYW5hbHl6aW5nUGxhY2Vob2xkZXJMaShmaWxlbmFtZSkge1xuICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gIGxpLmNsYXNzTmFtZSA9ICd2aWRlby1pdGVtIGFuYWx5emluZy1wbGFjZWhvbGRlcic7XG4gIGxpLmlubmVySFRNTCA9IGBcbiAgICA8ZGl2IGNsYXNzPVwibmFtZVwiIHN0eWxlPVwiZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4XCI+PHNwYW4gY2xhc3M9XCJzcGlubmVyXCI+PC9zcGFuPiR7ZXNjSHRtbChmaWxlbmFtZSl9PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm1ldGFcIiBzdHlsZT1cImNvbG9yOnZhcigtLWFjY2VudClcIj5BbmFseXppbmfigKY8L2Rpdj5gO1xuICByZXR1cm4gbGk7XG59XG5cbmZ1bmN0aW9uIF9zaG93RW1wdHlTdGF0ZSgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJykuaW5uZXJIVE1MID0gJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBjbGFzcz1cImVtcHR5LXN0YXRlXCI+XG4gICAgICA8aW1nIGNsYXNzPVwiZW1wdHktc3RhdGUtbWFzY290XCIgc3JjPVwiL3N0YXRpYy9nYW1lcmNhdC5wbmdcIiBhbHQ9XCJcIj5cbiAgICAgIDxoMj5XZWxjb21lIHRvIFl1dUNsaXA8L2gyPlxuICAgICAgPHA+QW5hbHl6ZSBhIHJlY29yZGluZyB0byBzdGFydCByZXZpZXdpbmcgYW5kIGV4cG9ydGluZyB5b3VyIGJlc3QgbW9tZW50cy4gWXV1Q2xpcCBzaGluZXMgb24gdGFsay1oZWF2eSBzZXNzaW9ucyAtIFJQLCB2b2ljZSBjaGF0LCBzdHJlYW1pbmcsIHBvZGNhc3RzLCBhbmQgY29tbWVudGFyeS48L3A+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGhpZ2hsaWdodFwiIGRhdGEtYWN0PVwib3Blbi1uZXctcmVjb3JkaW5nLXBhbmVsXCI+KyBBbmFseXplIHlvdXIgZmlyc3QgcmVjb3JkaW5nPC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgZGF0YS1hY3Q9XCJvcGVuLWdldHRpbmctc3RhcnRlZFwiIHN0eWxlPVwibWFyZ2luLXRvcDo4cHhcIj5HZXR0aW5nIFN0YXJ0ZWQgR3VpZGU8L2J1dHRvbj5cbiAgICA8L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiBfdXBkYXRlRGVtb0J1dHRvbihhcHByb3ZlZENvdW50KSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4taGlnaGxpZ2h0LXJlZWxzJyk7XG4gIGJ0bi50aXRsZSA9IGFwcHJvdmVkQ291bnQgPT09IDBcbiAgICA/ICdWaWV3IGV4aXN0aW5nIHJlZWxzIG9yIGJ1aWxkIG9uZSBhZnRlciBhcHByb3Zpbmcgc29tZSBjbGlwcydcbiAgICA6IGBWaWV3IG9yIGJ1aWxkIGEgaGlnaGxpZ2h0IHJlZWwgZnJvbSAke3BsdXJhbChhcHByb3ZlZENvdW50LCAnYXBwcm92ZWQgY2xpcCcpfWA7XG59XG5cbmZ1bmN0aW9uIF91cGRhdGVTdGFydEluZ2VzdEJ1dHRvbigpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1zdGFydC1hbmFseXplJyk7XG4gIGlmICghYnRuKSByZXR1cm47XG4gIGlmICh3aW5kb3cuX3ByZXJlcXMgJiYgIXdpbmRvdy5fcHJlcmVxcy5mZm1wZWdfb2spIHJldHVybjtcbiAgYnRuLmRpc2FibGVkID0gIV9wcm9iZWRJbmZvO1xuICBidG4udGl0bGUgPSBfcHJvYmVkSW5mbyA/ICcnIDogJ1NlbGVjdCBhIHZhbGlkIHJlY29yZGluZyBmaWxlIGZpcnN0Jztcbn1cblxuZnVuY3Rpb24gX2NsaXBzU29ydFBhcmFtKCkge1xuICByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXBzLXNvcnQnKS52YWx1ZTtcbn1cblxuLy8gQ2Fub25pY2FsIGNsaXAtbGlzdCBVUkw6IGV2ZXJ5IHJlbG9hZCBvZiBBcHBTdGF0ZS5jbGlwcyBnb2VzIHRocm91Z2ggdGhpcyBzbyB0aGVcbi8vIGFjdGl2ZSBzb3J0IEFORCB0aGUgYWN0aXZlIGNhbmRpZGF0ZSB0eXBlIChDbGlwcyB2cyBTY2VuZXMpIGFyZSBhbHdheXMgYXBwbGllZFxuLy8gdG9nZXRoZXIuIEFkZGluZyBhIG5ldyBmZXRjaCBzaXRlPyBVc2UgdGhpcywgbmV2ZXIgYSBoYW5kLWJ1aWx0IHF1ZXJ5IHN0cmluZy5cbmZ1bmN0aW9uIF9jbGlwc0xpc3RVcmwodmlkZW9JZCkge1xuICByZXR1cm4gYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vY2xpcHM/c29ydD0ke19jbGlwc1NvcnRQYXJhbSgpfSZraW5kPSR7QXBwU3RhdGUuY2xpcEtpbmR9YDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2VsZWN0VmlkZW8oaWQpIHtcbiAgaWYgKHdpbmRvdy5pc1NwbGl0RWRpdG9yT3BlbigpKSB7XG4gICAgLy8gX3NwbGl0UG9pbnRzIGlzIHNwbGl0LmpzJ3Mgc2hhcmVkIGxpdmUtZWRpdCBzdGF0ZTogYSB0b3AtbGV2ZWwgYGxldGAga2VwdFxuICAgIC8vIG91dHNpZGUgaXRzIElJRkUgc3BlY2lmaWNhbGx5IHNvIG90aGVyIGNsYXNzaWMgc2NyaXB0cyBjYW4gcmVhZCBpdCBiYXJlXG4gICAgLy8gKHNlZSB0aGUgY29tbWVudCBpbiBzcGxpdC5qcykuIEl0IGlzIG5ldmVyIGEgd2luZG93IHByb3BlcnR5LCBzbyB0aGlzXG4gICAgLy8gbXVzdCBzdGF5IGEgYmFyZSByZWZlcmVuY2UgcmF0aGVyIHRoYW4gd2luZG93Ll9zcGxpdFBvaW50cy5cbiAgICBjb25zdCBoYXNTcGxpdHMgPSB0eXBlb2YgX3NwbGl0UG9pbnRzICE9PSAndW5kZWZpbmVkJyAmJiBfc3BsaXRQb2ludHMubGVuZ3RoID4gMDtcbiAgICBpZiAoaGFzU3BsaXRzKSB7XG4gICAgICBzaG93Q29uZmlybShcbiAgICAgICAgJ0xlYXZlIFNwbGl0IGVkaXRvcj8nLFxuICAgICAgICAnWW91IGhhdmUgdW5zYXZlZCBzcGxpdCBwb2ludHMuIFN3aXRjaCB0byB0aGlzIHJlY29yZGluZyBhbmQgZGlzY2FyZCB0aGVtPycsXG4gICAgICAgICdEaXNjYXJkJyxcbiAgICAgICAgKCkgPT4geyB3aW5kb3cuY2xvc2VTcGxpdEVkaXRvcigpOyBzZWxlY3RWaWRlbyhpZCk7IH0sXG4gICAgICAgIHRydWUsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB3aW5kb3cuY2xvc2VTcGxpdEVkaXRvcigpO1xuICB9XG4gIC8vIF9wYW5lbERpcnR5IGlzIGFuYWx5emUuanMncyBzaGFyZWQgbGl2ZS1lZGl0IHN0YXRlIC0gc2FtZSBiYXJlLWdsb2JhbFxuICAvLyBjb250cmFjdCBhcyBfc3BsaXRQb2ludHMgYWJvdmUgKHNlZSB0aGUgY29tbWVudCBhdCB0aGUgdG9wIG9mIGFuYWx5emUuanMpLlxuICBpZiAod2luZG93Ll9pc05ld1JlY29yZGluZ1BhbmVsT3BlbigpICYmIF9wYW5lbERpcnR5KSB7XG4gICAgc2hvd0NvbmZpcm0oXG4gICAgICAnRGlzY2FyZCBuZXcgcmVjb3JkaW5nPycsXG4gICAgICAnWW91IGhhdmUgdW5zYXZlZCBjb25maWd1cmF0aW9uLiBTd2l0Y2ggdG8gdGhpcyByZWNvcmRpbmcgYW55d2F5PycsXG4gICAgICAnRGlzY2FyZCcsXG4gICAgICAoKSA9PiB7IHdpbmRvdy5fZG9DbG9zZU5ld1JlY29yZGluZ1BhbmVsKCk7IHNlbGVjdFZpZGVvKGlkKTsgfSxcbiAgICAgIHRydWUsXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHdpbmRvdy5faXNOZXdSZWNvcmRpbmdQYW5lbE9wZW4oKSkgd2luZG93Ll9kb0Nsb3NlTmV3UmVjb3JkaW5nUGFuZWwoKTtcbiAgQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9IGlkO1xuICBBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPSBudWxsO1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjdmlkZW8tbGlzdCBsaS5zZXNzaW9uLWhlYWRlci5hY3RpdmUnKS5mb3JFYWNoKGwgPT4gbC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKSk7XG4gIEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCAgPSBudWxsO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgneXV1Y2xpcC12aWV3JywgSlNPTi5zdHJpbmdpZnkoe3ZpZGVvSWQ6IGlkLCBjbGlwSWQ6IG51bGx9KSk7XG4gIEFwcFN0YXRlLmNsaXBGaWx0ZXJzLmNsZWFyKCk7XG4gIEFwcFN0YXRlLmNsaXBTZWFyY2ggID0gJyc7XG4gIEFwcFN0YXRlLmNsaXBTY29yZU1pbiA9IDA7XG4gIHdpbmRvdy5fc3luY0ZpbHRlckNoaXBzKCk7XG4gIGNvbnN0IF9zZWFyY2hFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwLXNlYXJjaC1pbnB1dCcpO1xuICBpZiAoX3NlYXJjaEVsKSBfc2VhcmNoRWwudmFsdWUgPSAnJztcbiAgY29uc3QgX3Njb3JlRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1zY29yZS1taW4nKTtcbiAgaWYgKF9zY29yZUVsKSBfc2NvcmVFbC52YWx1ZSA9ICcwJztcbiAgLy8gTG9hZCBjbGlwcyBhbmQgKGlmIHRoZSBib290IGZldGNoIGhhc24ndCBwb3B1bGF0ZWQgdGhlbSB5ZXQpIGNvbnRleHRzIGluXG4gIC8vIHBhcmFsbGVsLCBzbyB0aGUgZGV0YWlsJ3MgY29udGV4dCBjaGlwcy9kcm9wZG93biBuZXZlciByZW5kZXIgZnJvbSBhbiBlbXB0eVxuICAvLyBsaXN0IG9uIHRoZSBmaXJzdCB2aWRlbyBvcGVuZWQgYWZ0ZXIgbG9hZC5cbiAgY29uc3QgY2xpcHNQcm9taXNlID0gZmV0Y2goX2NsaXBzTGlzdFVybChpZCkpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gIGF3YWl0IHdpbmRvdy5lbnN1cmVDb250ZXh0cygpO1xuICBjb25zdCBjbGlwcyA9IGF3YWl0IGNsaXBzUHJvbWlzZTtcbiAgLy8gR3VhcmQgYWdhaW5zdCBhIHNsb3dlciBlYXJsaWVyIGZldGNoIHJlc29sdmluZyBhZnRlciBhIG5ld2VyIHNlbGVjdGlvbiAtXG4gIC8vIG90aGVyd2lzZSBjbGlja2luZyBCIHdoaWxlIEEncyBjbGlwcyBhcmUgaW4gZmxpZ2h0IHJlbmRlcnMgQSBpbnRvIEIncyBkZXRhaWwuXG4gIGlmIChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkICE9PSBpZCkgcmV0dXJuO1xuICBBcHBTdGF0ZS5jbGlwcyA9IGNsaXBzO1xuICB3aW5kb3cuX3JlbmRlckNsaXBzKCk7XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gIGlmICh2aWRlbykgcmVuZGVyVmlkZW9EZXRhaWwodmlkZW8sIG51bGwpO1xuICBlbHNlIHdpbmRvdy5jbGVhckRldGFpbCgpO1xufVxuXG4vLyBcIkltcG9ydGVkIGZyb21cIiBsaW5lIChyb2FkbWFwIHBsYW4gMDgpIC0gc2hvd24gb25seSBmb3IgYSByZWNvcmRpbmcgYnJvdWdodFxuLy8gaW4gdmlhIEltcG9ydCBmcm9tIFVSTDsgYSByZWNvcmRpbmcgYWRkZWQgZnJvbSBhIGxvY2FsIGZpbGUgaGFzIG5vIHNvdXJjZV91cmwuXG5mdW5jdGlvbiBfcmVuZGVySW1wb3J0ZWRGcm9tTGluZSh2aWRlbykge1xuICBpZiAoIXZpZGVvLnNvdXJjZV91cmwpIHJldHVybiAnJztcbiAgY29uc3QgcGFydHMgPSBbZXNjSHRtbCh2aWRlby5zb3VyY2VfdXBsb2FkZXIgfHwgJ1Vua25vd24gY2hhbm5lbCcpXTtcbiAgaWYgKHZpZGVvLnNvdXJjZV91cGxvYWRfZGF0ZSkgcGFydHMucHVzaChlc2NIdG1sKHZpZGVvLnNvdXJjZV91cGxvYWRfZGF0ZSkpO1xuICByZXR1cm4gYFxuICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTJweDttYXJnaW4tdG9wOjRweFwiPlxuICAgICAgICBJbXBvcnRlZCBmcm9tICR7cGFydHMuam9pbignICZtaWRkb3Q7ICcpfSAmbWlkZG90O1xuICAgICAgICA8YSBocmVmPVwiJHtlc2NIdG1sKHZpZGVvLnNvdXJjZV91cmwpfVwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIj5WaWV3IG9yaWdpbmFsPC9hPlxuICAgICAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyVmlkZW9EZXRhaWwodmlkZW8sIHNhdmVkVGltZWxpbmUpIHtcbiAgQXBwU3RhdGUuYWN0aXZlVmlkZW9EYXRhID0gdmlkZW87XG4gIGNvbnN0IGViID0gKGlzRWRpdGVkKSA9PiBpc0VkaXRlZCA/IGA8c3BhbiBjbGFzcz1cImVkaXRlZC1iYWRnZVwiPmVkaXRlZDwvc3Bhbj5gIDogJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXItYXJlYScpLmlubmVySFRNTCA9XG4gICAgYDxkaXYgc3R5bGU9XCJwb3NpdGlvbjpyZWxhdGl2ZVwiPlxuICAgICAgIDx2aWRlbyBpZD1cInJlY29yZGluZy1wcmV2aWV3LXZpZGVvXCIgY29udHJvbHMgcHJlbG9hZD1cIm1ldGFkYXRhXCIgYXJpYS1sYWJlbD1cIlJlY29yZGluZyBwcmV2aWV3XCIgc3R5bGU9XCJkaXNwbGF5OmJsb2NrO3dpZHRoOjEwMCU7bWF4LWhlaWdodDp2YXIoLS1wbGF5ZXItbWF4LWhlaWdodCwgNDJ2aCk7b2JqZWN0LWZpdDpjb250YWluO2JhY2tncm91bmQ6IzAwMFwiPjwvdmlkZW8+XG4gICAgICAgPHNwYW4gaWQ9XCJyZWNvcmRpbmctcHJldmlldy1iYWRnZVwiIHJvbGU9XCJzdGF0dXNcIiBzdHlsZT1cImRpc3BsYXk6bm9uZTtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6OHB4O2xlZnQ6OHB4O2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuNyk7Y29sb3I6I2U2ZTZlNjtmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA4cHg7Ym9yZGVyLXJhZGl1czo0cHhcIj48L3NwYW4+XG4gICAgIDwvZGl2PmA7XG4gIHNldHVwUmVjb3JkaW5nUHJldmlldyhcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkaW5nLXByZXZpZXctdmlkZW8nKSxcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkaW5nLXByZXZpZXctYmFkZ2UnKSxcbiAgICB2aWRlby5pZCxcbiAgICB7XG4gICAgICBhdXRvQnVpbGQ6IGZhbHNlLFxuICAgICAgaXNDdXJyZW50OiAoKSA9PiBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID09PSB2aWRlby5pZCxcbiAgICAgIHN0YXJ0UzogdmlkZW8uc2VnbWVudF9zdGFydF9zLFxuICAgICAgZW5kUzogdmlkZW8uc2VnbWVudF9lbmRfcyxcbiAgICAgIHNvdXJjZVBhdGg6IHZpZGVvLnNvdXJjZV9wYXRoLFxuICAgIH0sXG4gICk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdj48ZGl2IGNsYXNzPVwiZGV0YWlsLXR5cGUtYmFkZ2UgdmlkZW8tYmFkZ2VcIj4mIzEyNzkxNjsgUmVjb3JkaW5nPC9kaXY+PC9kaXY+XG5cbiAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmRcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZC1oZWFkZXJcIj5cbiAgICAgICAgPGgyIHN0eWxlPVwibWFyZ2luOjA7Zm9udC1zaXplOjE3cHg7Zm9udC13ZWlnaHQ6NzAwXCIgdGl0bGU9XCIke2VzY0h0bWwodmlkZW8udGl0bGUgfHwgdmlkZW8uZmlsZW5hbWUpfVwiPiR7ZXNjSHRtbCh2aWRlby50aXRsZSB8fCB2aWRlby5maWxlbmFtZSl9JHtlYih2aWRlby50aXRsZV9pc19lZGl0ZWQpfTwvaDI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJrZWJhYi1idG5cIiB0aXRsZT1cIkVkaXQgb3IgcmVnZW5lcmF0ZSB0aXRsZVwiIGFyaWEtbGFiZWw9XCJFZGl0IG9yIHJlZ2VuZXJhdGUgdGl0bGVcIiBkYXRhLWFjdD1cInZpZGVvLXRpdGxlLWtlYmFiXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+JiM4OTQyOzwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxM3B4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweDtmbGV4LXdyYXA6d3JhcFwiPlxuICAgICAgICA8c3Bhbj4ke3ZpZGVvLmR1cmF0aW9uX2htc30gJm1pZGRvdDsgJHt2aWRlby5jbGlwX2NvdW50fSBjbGlwcyAmbWlkZG90OyAke19tc1RvSG1zKHZpZGVvLnRvdGFsX2NsaXBfbXMpfSBjbGlwcGVkPC9zcGFuPlxuICAgICAgICAke0FwcFN0YXRlLmNhblJldmVhbCA/IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjJweCA4cHhcIiBkYXRhLWFjdD1cInJldmVhbC1pbi1mb2xkZXJcIj5TaG93IGluIEZvbGRlcjwvYnV0dG9uPmAgOiAnJ31cbiAgICAgIDwvZGl2PlxuICAgICAgJHtfcmVuZGVySW1wb3J0ZWRGcm9tTGluZSh2aWRlbyl9XG4gICAgPC9kaXY+XG5cbiAgICAke19yZW5kZXJDb250ZXh0U2VjdGlvbih2aWRlbyl9XG5cbiAgICAke2NvbGxhcHNpYmxlQ2FyZCgndmlkZW8tc3VtbWFyeScsXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+U2Vzc2lvbiBTdW1tYXJ5JHtlYih2aWRlby5zdW1tYXJ5X2lzX2VkaXRlZCl9PC9zcGFuPmAsIGBcbiAgICAgIDxkaXYgaWQ9XCJzdW1tYXJ5LWJvZHlcIj4ke3ZpZGVvLnN1bW1hcnlcbiAgICAgICAgPyBgPGRpdiBjbGFzcz1cImRlc2NyaXB0aW9uLWxvbmdcIj4ke2VzY0h0bWwodmlkZW8uc3VtbWFyeSl9PC9kaXY+YFxuICAgICAgICA6IGA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4XCI+Tm8gc3VtbWFyeSB5ZXQgLSBnZW5lcmF0ZSBhIHRpdGxlIGFuZCBzdW1tYXJ5IGZyb20gdGhlIHRyYW5zY3JpcHQuPC9kaXY+YH08L2Rpdj5gLFxuICAgICAgeyBhY3Rpb25zOiBgJHt2aWRlby5zdW1tYXJ5XG4gICAgICAgICAgPyBgPGJ1dHRvbiBjbGFzcz1cImtlYmFiLWJ0blwiIHRpdGxlPVwiRWRpdCBvciByZWdlbmVyYXRlIHN1bW1hcnlcIiBhcmlhLWxhYmVsPVwiRWRpdCBvciByZWdlbmVyYXRlIHN1bW1hcnlcIiBkYXRhLWFjdD1cInZpZGVvLXN1bW1hcnkta2ViYWJcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj4mIzg5NDI7PC9idXR0b24+YFxuICAgICAgICAgIDogYDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBpZD1cImJ0bi1zdW1tYXJpemUtdmlkZW9cIiBkYXRhLWFjdD1cInN1bW1hcml6ZS12aWRlb1wiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPkdlbmVyYXRlIFN1bW1hcnk8L2J1dHRvbj5gfWAgfSl9XG5cbiAgICAke19pc1ZpZGVvQmVpbmdBbmFseXplZCh2aWRlbykgPyBfYW5hbHlzaXNMaXZlUGFuZWxIVE1MKCkgOiAnJ31cbiAgICAke3dpbmRvdy5fcmVuZGVyUnVuTWV0YUNhcmQodmlkZW8pfVxuXG4gICAgPGRpdiBjbGFzcz1cInZpZC1hY3Rpb25zXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwidmlkLWFjdGlvbnMtcm93XCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG5cIiBkYXRhLWFjdD1cIm9wZW4tYmF0Y2gtZXhwb3J0XCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+RXhwb3J0IEFwcHJvdmVkPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWFjdD1cIm9wZW4tdmlkZW8tYWN0aW9uc1wiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPkFkZGl0aW9uYWwgQWN0aW9uczwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG5cbiAgICA8ZGl2IGlkPVwic3BlYWtlcnMtc2VjdGlvblwiPjwvZGl2PlxuXG4gICAgJHsodmlkZW8uY2xpcF9jb3VudCA+IDAgfHwgdmlkZW8uc3RhdHVzID09PSAnZG9uZScpID8gY29sbGFwc2libGVDYXJkKCd2aWRlby10cmFuc2NyaXB0JyxcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5GdWxsIHRyYW5zY3JpcHQ8L3NwYW4+YCxcbiAgICAgIGA8ZGl2IGlkPVwidmlkZW8tdHJhbnNjcmlwdC12aWV3XCIgY2xhc3M9XCJ0cmFuc2NyaXB0XCI+PC9kaXY+YCxcbiAgICAgIHsgZGVmYXVsdENvbGxhcHNlZDogdHJ1ZSwgYXR0cnM6IGBpZD1cInZpZGVvLXRyYW5zY3JpcHQtZGV0YWlsc1wiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiYCxcbiAgICAgICAgYWN0aW9uczogYDxzcGFuIHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDo2cHhcIj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA5cHhcIiB0aXRsZT1cIlNjYW4gdGhlIHRyYW5zY3JpcHQgZm9yIG1pcy1oZWFyZCBuYW1lcyAoZS5nLiAmcXVvdDtZb3UmcXVvdDsgZm9yICZxdW90O1l1dSZxdW90OykgYW5kIGZpeCB0aGVtXCJcbiAgICAgICAgICAgICAgICAgIGRhdGEtYWN0PVwib3Blbi1uYW1lLWNvcnJlY3Rpb25zXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+Rml4IG5hbWVzPC9idXR0b24+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOXB4XCIgdGl0bGU9XCJQaWNrIGEgdGltZSByYW5nZSB0byBjcmVhdGUgYSBjbGlwIGJ5IGhhbmRcIlxuICAgICAgICAgICAgICAgICAgZGF0YS1hY3Q9XCJvcGVuLWNsaXAtY3JlYXRlLXBpY2tlclwiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPkNyZWF0ZSBjbGlwPC9idXR0b24+XG4gICAgICAgIDwvc3Bhbj5gIH0pIDogJyd9XG5cbiAgICAke2NvbGxhcHNpYmxlQ2FyZCgndmlkZW8tdGltZWxpbmUnLFxuICAgICAgICBgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPlNlc3Npb24gVGltZWxpbmU8L3NwYW4+YCwgYFxuICAgICAgPGRpdiBpZD1cInRpbWVsaW5lLXNlY3Rpb25cIj5cbiAgICAgICAgJHtzYXZlZFRpbWVsaW5lID8gd2luZG93Ll9yZW5kZXJUaW1lbGluZUhUTUwoc2F2ZWRUaW1lbGluZSkgOiAodmlkZW8uaGFzX3RpbWVsaW5lID8gJycgOiB3aW5kb3cuX3RpbWVsaW5lRW1wdHlOb3RlSFRNTCgpKX1cbiAgICAgIDwvZGl2PmAsXG4gICAgICB7IGFjdGlvbnM6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJidG4tZ2VuZXJhdGUtdGltZWxpbmVcIiBkYXRhLWFjdD1cImdlbmVyYXRlLXRpbWVsaW5lXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+JHt2aWRlby5oYXNfdGltZWxpbmUgPyAnUmVnZW5lcmF0ZSBUaW1lbGluZScgOiAnR2VuZXJhdGUgVGltZWxpbmUnfTwvYnV0dG9uPmAgfSl9YDtcblxuICBpZiAod2luZG93LmxvYWRTcGVha2Vycykgd2luZG93LmxvYWRTcGVha2Vycyh2aWRlby5pZCk7XG4gIGlmICh3aW5kb3cucmVsb2FkVmlkZW9UcmFuc2NyaXB0SWZPcGVuKSB3aW5kb3cucmVsb2FkVmlkZW9UcmFuc2NyaXB0SWZPcGVuKHZpZGVvLmlkKTtcbiAgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpO1xuXG4gIGlmICghc2F2ZWRUaW1lbGluZSAmJiB2aWRlby5oYXNfdGltZWxpbmUpIHtcbiAgICBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlby5pZH1gKVxuICAgICAgLnRoZW4ociA9PiByLmpzb24oKSlcbiAgICAgIC50aGVuKHYgPT4ge1xuICAgICAgICBpZiAodi50aW1lbGluZSAmJiB2LnRpbWVsaW5lLmxlbmd0aCkge1xuICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1zZWN0aW9uJykuaW5uZXJIVE1MID0gd2luZG93Ll9yZW5kZXJUaW1lbGluZUhUTUwodi50aW1lbGluZSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKCkgPT4ge30pO1xuICB9XG59XG5cbmZ1bmN0aW9uIG9wZW5WaWRlb0FjdGlvbnNNb2RhbCh2aWRlb0lkKSB7XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUuYWN0aXZlVmlkZW9EYXRhPy5pZCA9PT0gdmlkZW9JZCA/IEFwcFN0YXRlLmFjdGl2ZVZpZGVvRGF0YSA6IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gdmlkZW9JZCk7XG4gIGlmICghdmlkZW8pIHJldHVybjtcbiAgY29uc3QgaXNTZWdtZW50ID0gdmlkZW8ucGFyZW50X3ZpZGVvX2lkICE9IG51bGw7XG5cbiAgY29uc3QgZ3JvdXBzID0gW1xuICAgIHsgaGVhZGluZzogJ1JldmlldycsIHJvd3M6IFtcbiAgICAgIHsgbGFiZWw6ICdBcHByb3ZlIEFib3ZlIFNjb3JlJywgZGVzY3JpcHRpb246ICdBdXRvbWF0aWNhbGx5IGFwcHJvdmUgZXZlcnkgY2xpcCBpbiB0aGlzIHJlY29yZGluZyBhYm92ZSBhIHNjb3JlIHRocmVzaG9sZCB5b3UgY2hvb3NlLicsIGFjdGlvbjogKCkgPT4gd2luZG93Lm9wZW5BdXRvQXBwcm92ZU1vZGFsKHZpZGVvSWQpIH0sXG4gICAgXX0sXG4gICAgeyBoZWFkaW5nOiAnUmVnZW5lcmF0ZScsIHJvd3M6IFtcbiAgICAgIHsgbGFiZWw6ICdSZS1zY29yZSBBbGwgQ2xpcHMnLCBkZXNjcmlwdGlvbjogJ1JlZ2VuZXJhdGUgc2NvcmVzIGFuZCBkZXNjcmlwdGlvbnMgZm9yIGV2ZXJ5IGNsaXAgaW4gdGhpcyByZWNvcmRpbmcuJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cucmVzY29yZUFsbENsaXBzKHZpZGVvSWQsIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlLWRlc2NyaWJlIEFsbCBDbGlwcycsIGRlc2NyaXB0aW9uOiAnUmVnZW5lcmF0ZSBkZXNjcmlwdGlvbnMgb25seSAtIHNjb3JlcyBhcmUga2VwdCBhcy1pcy4nLCBhY3Rpb246ICgpID0+IHdpbmRvdy5yZWRlc2NyaWJlQWxsQ2xpcHModmlkZW9JZCwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJykpIH0sXG4gICAgICB7IGxhYmVsOiAnUmUtZGV0ZWN0IFNwZWFrZXJzJywgZGVzY3JpcHRpb246ICdSZS1ydW4gc3BlYWtlciBkZXRlY3Rpb24gb24gdGhlIGV4aXN0aW5nIHRyYW5zY3JpcHQuIENsaXBzIGFuZCBzY29yZXMgYXJlIGtlcHQ7IG5hbWVkIHNwZWFrZXJzIHJlLWF0dGFjaCB0byBtYXRjaGluZyB2b2ljZXMuJywgYWN0aW9uOiAoKSA9PiByZWRpYXJpemVWaWRlbyh2aWRlb0lkKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlLXRyYW5zY3JpYmUgUmVjb3JkaW5nJywgZGVzY3JpcHRpb246ICdSZS1ydW4gc3BlZWNoLXRvLXRleHQgZm9yIHRoZSB3aG9sZSByZWNvcmRpbmcuIENsaXBzIGFyZSBrZXB0IGJ1dCBmbGFnZ2VkIGZvciBhIHJlLXNjb3JlOyByZWdlbmVyYXRlIGNsaXBzIHRvIHJlYnVpbGQgdGhlbSBmcm9tIHRoZSBuZXcgdHJhbnNjcmlwdC4nLCBhY3Rpb246ICgpID0+IHJldHJhbnNjcmliZVZpZGVvUnVuKHZpZGVvSWQpIH0sXG4gICAgICB7IGxhYmVsOiAnUmUtZXh0cmFjdCBBdWRpbycsIGRlc2NyaXB0aW9uOiAnUmVidWlsZCB0aGUgYXVkaW8gdHJhY2tzIGZyb20gdGhlIHNvdXJjZSBmaWxlLCBlLmcuIGFmdGVyIGNoYW5naW5nIHRoZSB0cmFjayBsYXlvdXQuIFJlLXRyYW5zY3JpYmUgYWZ0ZXJ3YXJkIHRvIHVwZGF0ZSB0aGUgdHJhbnNjcmlwdC4nLCBhY3Rpb246ICgpID0+IHJlZXh0cmFjdFZpZGVvUnVuKHZpZGVvSWQpIH0sXG4gICAgICAuLi4od2luZG93Lmhhc0VuYWJsZWRTZW1hbnRpY0hvdHdvcmRzKCkgPyBbXG4gICAgICAgIHsgbGFiZWw6ICdTY2FuIGZvciBIb3Qtd29yZHMnLCBkZXNjcmlwdGlvbjogJ0NoZWNrIGV2ZXJ5IGNsaXAgYWdhaW5zdCB5b3VyIFwiTWVhbmluZ1wiIGhvdC13b3JkcyB1c2luZyB0aGUgU2ltaWxhcml0eSBlbmdpbmUuJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cuY29uZmlybVNjYW5Ib3R3b3Jkc0ZvclZpZGVvKHZpZGVvSWQsIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpKSB9LFxuICAgICAgXSA6IFtdKSxcbiAgICBdfSxcbiAgICB7IGhlYWRpbmc6ICdSZWNvcmRpbmcgdG9vbHMnLCByb3dzOiBbXG4gICAgICAuLi4oaXNTZWdtZW50ID8gW10gOiBbXG4gICAgICAgIHsgbGFiZWw6ICdTcGxpdCBSZWNvcmRpbmcnLCBkZXNjcmlwdGlvbjogJ0JyZWFrIHRoaXMgcmVjb3JkaW5nIGludG8gc2VnbWVudHMgdGhhdCBjYW4gYmUgYW5hbHl6ZWQgaW5kZXBlbmRlbnRseS4nLCBhY3Rpb246ICgpID0+IHdpbmRvdy5vcGVuU3BsaXRFZGl0b3IodmlkZW9JZCkgfSxcbiAgICAgIF0pLFxuICAgICAgLi4uKGlzU2VnbWVudCA/IFtcbiAgICAgICAgeyBsYWJlbDogJ1VuZG8gU3BsaXQnLCBkZXNjcmlwdGlvbjogJ01lcmdlIHRoaXMgc2VnbWVudCBhbmQgaXRzIHNpYmxpbmdzIGJhY2sgaW50byB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nLCBrZWVwaW5nIGFsbCBvZiB0aGVpciBjbGlwcy4nLCBhY3Rpb246ICgpID0+IHVuc3BsaXRWaWRlbyh2aWRlb0lkKSB9LFxuICAgICAgXSA6IFtdKSxcbiAgICAgIHsgbGFiZWw6ICdTYXZlIENhcHRpb25zIHRvIFNSVCcsIGRlc2NyaXB0aW9uOiAnV3JpdGUgdGhlIHRyYW5zY3JpcHQgYXMgYW4gU1JUIGNhcHRpb24gZmlsZSBuZXh0IHRvIHRoZSBzb3VyY2UgcmVjb3JkaW5nLicsIGFjdGlvbjogKCkgPT4gZXhwb3J0VmlkZW9UcmFuc2NyaXB0KHZpZGVvSWQpIH0sXG4gICAgXX0sXG4gICAgeyBoZWFkaW5nOiAnRGFuZ2VyIFpvbmUnLCByb3dzOiBbXG4gICAgICB7IGxhYmVsOiAnUmVnZW5lcmF0ZSBDbGlwcycsIGRlc2NyaXB0aW9uOiAnUmVidWlsZCBjbGlwcyBmcm9tIHRoZSBleGlzdGluZyB0cmFuc2NyaXB0LiBSZXBsYWNlcyBldmVyeSBjbGlwIC0gZGlzY2FyZGluZyBhcHByb3ZhbHMsIGVkaXRzLCB0YWdzLCBhbmQgc2NvcmVzIC0gd2l0aCBmcmVzaCwgdW5zY29yZWQgY2FuZGlkYXRlcy4gU2tpcHMgcmUtdHJhbnNjcmlwdGlvbi4nLCBkYW5nZXI6IHRydWUsIGFjdGlvbjogKCkgPT4gcmVnZW5lcmF0ZUNsaXBzUnVuKHZpZGVvSWQpIH0sXG4gICAgICB7IGxhYmVsOiAnUmUtYW5hbHl6ZSAoZnVsbCknLCBkZXNjcmlwdGlvbjogJ1JlLXJ1biB0aGUgZW50aXJlIHBpcGVsaW5lIGZyb20gc2NyYXRjaC4gUmVwbGFjZXMgYWxsIGNsaXBzLCBzY29yZXMsIGFuZCBzcGVha2VycyBmb3IgdGhpcyByZWNvcmRpbmcuJywgZGFuZ2VyOiB0cnVlLCBhY3Rpb246ICgpID0+IHJlYW5hbHl6ZVZpZGVvKHZpZGVvSWQpIH0sXG4gICAgICB7IGxhYmVsOiAnUmVzZXQgQXBwcm92YWxzJywgZGVzY3JpcHRpb246ICdDbGVhciB0aGUgYXBwcm92ZS9yZWplY3Qgc3RhdHVzIG9uIGV2ZXJ5IGNsaXAgaW4gdGhpcyByZWNvcmRpbmcuJywgZGFuZ2VyOiB0cnVlLCBhY3Rpb246ICgpID0+IHdpbmRvdy5yZXNldEFwcHJvdmFscyh2aWRlb0lkKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlbW92ZSBSZWNvcmRpbmcnLCBkZXNjcmlwdGlvbjogJ1JlbW92ZSB0aGlzIHJlY29yZGluZyBmcm9tIFl1dUNsaXAuIFRoZSBzb3VyY2UgZmlsZSBvbiBkaXNrIGlzIG5vdCBkZWxldGVkLicsIGRhbmdlcjogdHJ1ZSwgYWN0aW9uOiAoKSA9PiBkZWxldGVWaWRlbyh2aWRlb0lkKSB9LFxuICAgIF19LFxuICBdO1xuXG4gIG9wZW5BY3Rpb25zTW9kYWwoYCR7dmlkZW8udGl0bGUgfHwgdmlkZW8uZmlsZW5hbWV9IC0gQWRkaXRpb25hbCBBY3Rpb25zYCwgZ3JvdXBzKTtcbn1cblxuLy8g4pSA4pSAIHJlY29yZGluZyByZW1vdmFsICsgdHJhbnNjcmlwdCBleHBvcnQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5hc3luYyBmdW5jdGlvbiBleHBvcnRWaWRlb1RyYW5zY3JpcHQoaWQsIGJ0bikge1xuICBhd2FpdCBfZG9FeHBvcnRWaWRlb1RyYW5zY3JpcHQoaWQsIGJ0biwgZmFsc2UpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZG9FeHBvcnRWaWRlb1RyYW5zY3JpcHQoaWQsIGJ0biwgb3ZlcndyaXRlKSB7XG4gIGlmIChidG4pIHsgYnRuLmRpc2FibGVkID0gdHJ1ZTsgYnRuLnRleHRDb250ZW50ID0gJ0V4cG9ydGluZ+KApic7IH1cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHtpZH0vZXhwb3J0LXRyYW5zY3JpcHQ/b3ZlcndyaXRlPSR7b3ZlcndyaXRlfWAsIHttZXRob2Q6ICdQT1NUJ30pO1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIGlmIChyZXMuc3RhdHVzID09PSA0MDkgJiYgZGF0YS5leGlzdHMpIHtcbiAgICAgIHNob3dDb25maXJtKFxuICAgICAgICAnT3ZlcndyaXRlIGV4aXN0aW5nIGNhcHRpb25zPycsXG4gICAgICAgIGBBbiBTUlQgZmlsZSBhbHJlYWR5IGV4aXN0cyBhdDo8YnI+PGNvZGU+JHtlc2NIdG1sKGRhdGEucGF0aCl9PC9jb2RlPjxicj48YnI+T3ZlcndyaXRlIGl0IHdpdGggdGhlIGN1cnJlbnQgdHJhbnNjcmlwdD9gLFxuICAgICAgICAnT3ZlcndyaXRlJyxcbiAgICAgICAgKCkgPT4gX2RvRXhwb3J0VmlkZW9UcmFuc2NyaXB0KGlkLCBidG4sIHRydWUpLFxuICAgICAgICB0cnVlLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBFcnJvcihmb3JtYXRBcGlFcnJvcihkYXRhKSk7XG4gICAgc2hvd1RvYXN0KGBDYXB0aW9ucyBleHBvcnRlZCDihpIgJHtkYXRhLnBhdGh9YCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNob3dUb2FzdChgRXhwb3J0IGZhaWxlZDogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IGZhbHNlOyBidG4udGV4dENvbnRlbnQgPSAnU2F2ZSBDYXB0aW9ucyB0byBTUlQnOyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVsZXRlVmlkZW8oaWQpIHtcbiAgY29uc3QgdmlkZW8gPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IGlkKTtcbiAgY29uc3QgbmFtZSAgPSB2aWRlbyA/IHZpZGVvLmZpbGVuYW1lIDogYHJlY29yZGluZyAke2lkfWA7XG4gIHNob3dDb25maXJtKFxuICAgICdSZW1vdmUgcmVjb3JkaW5nPycsXG4gICAgYFJlbW92ZSA8c3Ryb25nPiR7ZXNjSHRtbChuYW1lKX08L3N0cm9uZz4gZnJvbSBZdXVDbGlwPzxicj48YnI+YCArXG4gICAgYEFsbCBjbGlwcywgdHJhbnNjcmlwdHMsIGFuZCBleHRyYWN0ZWQgYXVkaW8gYXJlIHJlbW92ZWQgZnJvbSB0aGUgZGF0YWJhc2UuIGAgK1xuICAgIGBZb3VyIHNvdXJjZSByZWNvcmRpbmcgZmlsZSBpcyA8c3Ryb25nPm5vdDwvc3Ryb25nPiBkZWxldGVkLmAsXG4gICAgJ1JlbW92ZScsXG4gICAgKCkgPT4gX2RvRGVsZXRlVmlkZW8oaWQsIG5hbWUpLFxuICAgIHRydWUsXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9kb0RlbGV0ZVZpZGVvKGlkLCBuYW1lKSB7XG4gIC8vIFJlbGVhc2UgdGhlIHBsYXllciBzbyBpdHMgYmFja2luZyBleHBvcnQvcHJldmlldyBmaWxlIGlzbid0IGxvY2tlZCBkdXJpbmcgZGVsZXRlLlxuICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIGF3YWl0IHdpbmRvdy5fcmVsZWFzZVBsYXllckJlZm9yZURlbGV0ZSgpO1xuICBjb25zdCBkZWxSZXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHtpZH1gLCB7bWV0aG9kOiAnREVMRVRFJ30pO1xuICBpZiAoIWRlbFJlcy5vaykge1xuICAgIGNvbnN0IGVyciA9IGF3YWl0IGRlbFJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgc2hvd1RvYXN0KGBGYWlsZWQgdG8gcmVtb3ZlIHJlY29yZGluZzogJHtmb3JtYXRBcGlFcnJvcihlcnIpfWAsICdlcnJvcicpO1xuICAgIGlmIChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpIHdpbmRvdy5zZWxlY3RDbGlwKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID09PSBpZCkge1xuICAgIEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPSBudWxsO1xuICAgIEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCAgPSBudWxsO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwLWxpc3QnKS5pbm5lckhUTUwgPSAnJztcbiAgICB3aW5kb3cuY2xlYXJEZXRhaWwoKTtcbiAgfVxuICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gIHNob3dUb2FzdChgXCIke25hbWV9XCIgcmVtb3ZlZCBmcm9tIFl1dUNsaXBgKTtcbn1cblxuLy8g4pSA4pSAIGxpdmUgYW5hbHlzaXMgcHJvZ3Jlc3MgKGluLWRldGFpbCkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBBIHJlY29yZGluZyBpcyBcImJlaW5nIGFuYWx5emVkXCIgd2hlbiBpdCBtYXRjaGVzIHRoZSBmaWxlbmFtZSBvZiB0aGUgYWN0aXZlXG4vLyBhbmFseXplIGpvYiAoQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lLCBzZXQgb24gc3RhcnQvcmVhdHRhY2gpIGFuZCBoYXNuJ3QgeWV0XG4vLyByZWFjaGVkICdkb25lJy4gU2FtZSBydWxlIHRoZSBzaWRlYmFyIHVzZXMgZm9yIGl0cyBzcGlubmVyLlxuZnVuY3Rpb24gX2lzVmlkZW9CZWluZ0FuYWx5emVkKHZpZGVvKSB7XG4gIHJldHVybiAhIUFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZVxuICAgICYmIHZpZGVvLmZpbGVuYW1lID09PSBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWVcbiAgICAmJiB2aWRlby5zdGF0dXMgIT09ICdkb25lJztcbn1cblxuZnVuY3Rpb24gX2FuYWx5c2lzTGl2ZVBhbmVsSFRNTCgpIHtcbiAgcmV0dXJuIGBcbiAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQgYW5hbHlzaXMtbGl2ZVwiIGlkPVwiYW5hbHlzaXMtbGl2ZS1wYW5lbFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkLWhlYWRlclwiPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+PHNwYW4gY2xhc3M9XCJzcGlubmVyXCI+PC9zcGFuPiBBbmFseXNpcyBpbiBwcm9ncmVzczwvc3Bhbj5cbiAgICAgICAgPHNwYW4gc3R5bGU9XCJkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMHB4XCI+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJtdXRlZFwiIGlkPVwiYW5hbHlzaXMtbGl2ZS1lbGFwc2VkXCIgc3R5bGU9XCJmb250LXNpemU6MTJweFwiPjwvc3Bhbj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgZGF0YS1hY3Q9XCJjYW5jZWwtam9iXCIgc3R5bGU9XCJmb250LXNpemU6MTJweDtwYWRkaW5nOjJweCAxMHB4XCI+Q2FuY2VsPC9idXR0b24+XG4gICAgICAgIDwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBpZD1cImFuYWx5c2lzLWxpdmUtc3RlcHNcIiBjbGFzcz1cImpvYi1zdGVwcy1kZXRhaWxcIj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtdXRlZFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7bWFyZ2luLXRvcDo4cHhcIj5SdW5zIGluIHRoZSBiYWNrZ3JvdW5kIC0geW91IGNhbiBsZWF2ZSBvciByZWZyZXNoIHRoaXMgcGFnZSB3aXRob3V0IGludGVycnVwdGluZyBpdC48L2Rpdj5cbiAgICA8L2Rpdj5gO1xufVxuXG4vLyBNaXJyb3IgdGhlIGhlYWRlciBwcm9ncmVzcyBiYXIncyBzdGVwIHN0YXRlIGludG8gdGhlIGluLWRldGFpbCBwYW5lbC4gRHJpdmVuIGJ5XG4vLyB0aGUgYW5hbHl6ZSBTU0Ugc3RyZWFtICh1cGRhdGVKb2JVSSAvIF90aWNrSm9iVGltZXIgaW4gam9icy5qcykuIFJlYWRzIGpvYnMuanMnc1xuLy8gc2hhcmVkIGpvYi1zdGVwIHN0YXRlIG9mZiB3aW5kb3cgKGpvYnMuanMgYnJpZGdlcyB0aGVzZSB2aWEgbGl2ZSBnZXQvc2V0XG4vLyBhY2Nlc3NvcnMsIHNpbmNlIGEgcGxhaW4gaW1wb3J0IHNuYXBzaG90IHdvdWxkIGdvIHN0YWxlIG9uIHJlYXNzaWdubWVudCk7IGVsYXBzZWRcbi8vIHVzZXMgdGhlIHNlcnZlci1zaWRlIGFuYWx5emVfc3RhcnRlZF9hdCBzbyBpdCBzdGF5cyBhY2N1cmF0ZSBhY3Jvc3MgYSByZWZyZXNoXG4vLyAodW5saWtlIHRoZSBoZWFkZXIgcGlsbCwgd2hpY2ggcmVzdGFydHMgYXQgMCkuXG5mdW5jdGlvbiBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCkge1xuICBjb25zdCBzdGVwc0VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FuYWx5c2lzLWxpdmUtc3RlcHMnKTtcbiAgaWYgKCFzdGVwc0VsKSByZXR1cm47XG4gIHN0ZXBzRWwuaW5uZXJIVE1MID0gd2luZG93Ll9qb2JTdGVwRGVmcy5tYXAoKHN0ZXAsIGkpID0+IHtcbiAgICBjb25zdCBjbHMgPSBpIDwgd2luZG93Ll9hY3RpdmVTdGVwSWR4ID8gJ2RvbmUnIDogaSA9PT0gd2luZG93Ll9hY3RpdmVTdGVwSWR4ID8gJ2FjdGl2ZScgOiAnJztcbiAgICBpZiAoaSAhPT0gd2luZG93Ll9hY3RpdmVTdGVwSWR4KSByZXR1cm4gYDxzcGFuIGNsYXNzPVwic3RlcCAke2Nsc31cIj4ke2VzY0h0bWwoc3RlcC5sYWJlbCl9PC9zcGFuPmA7XG4gICAgLy8gQWN0aXZlIHN0ZXAgbWlycm9ycyB0aGUgaGVhZGVyIHBpbGw6IGxpdmUgbGFiZWwgKyB0aGUgc2FtZSB0d28tdG9uZSBmaWxsLlxuICAgIGNvbnN0IHt0ZXh0LCBwY3R9ID0gX3N0ZXBQaWxsTGFiZWwoaSk7XG4gICAgY29uc3QgZmlsbCA9IHBjdCAhPSBudWxsXG4gICAgICA/IGAgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOmxpbmVhci1ncmFkaWVudCh0byByaWdodCwgdmFyKC0tZ3JlZW4pICR7cGN0fSUsIHZhcigtLWFjY2VudCkgJHtwY3R9JSlcImBcbiAgICAgIDogJyc7XG4gICAgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInN0ZXAgJHtjbHN9XCIke2ZpbGx9PiR7ZXNjSHRtbCh0ZXh0KX08L3NwYW4+YDtcbiAgfSkuam9pbignJyk7XG5cbiAgY29uc3QgZWxhcHNlZEVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FuYWx5c2lzLWxpdmUtZWxhcHNlZCcpO1xuICBpZiAoZWxhcHNlZEVsKSB7XG4gICAgY29uc3Qgc3RhcnRJc28gPSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0RhdGEgJiYgQXBwU3RhdGUuYWN0aXZlVmlkZW9EYXRhLmFuYWx5emVfc3RhcnRlZF9hdDtcbiAgICBjb25zdCBzdGFydE1zICA9IHN0YXJ0SXNvID8gX3BhcnNlU2VydmVyRGF0ZShzdGFydElzbykuZ2V0VGltZSgpIDogd2luZG93Ll9qb2JTdGFydFRpbWU7XG4gICAgZWxhcHNlZEVsLnRleHRDb250ZW50ID0gX2ZtdEVsYXBzZWQoRGF0ZS5ub3coKSAtIHN0YXJ0TXMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9yZW5kZXJDb250ZXh0U2VjdGlvbih2aWRlbykge1xuICBjb25zdCBhc3NpZ25lZCA9IHZpZGVvLmNvbnRleHRfbmFtZXMgfHwgW107XG4gIGNvbnN0IGNoaXBzID0gYXNzaWduZWQubWFwKGNvbnRleHRfaWQgPT4ge1xuICAgIGNvbnN0IGN0eCA9IEFwcFN0YXRlLmNvbnRleHRzLmZpbmQoYyA9PiBjLmNvbnRleHRfaWQgPT09IGNvbnRleHRfaWQpO1xuICAgIGNvbnN0IG5hbWUgPSBjdHggPyBjdHguZGlzcGxheV9uYW1lIDogY29udGV4dF9pZDtcbiAgICByZXR1cm4gYDxzcGFuIGNsYXNzPVwiY29udGV4dC1jaGlwXCI+JHtlc2NIdG1sKG5hbWUpfTxidXR0b24gY2xhc3M9XCJjaGlwLXhcIiBkYXRhLXJtY3R4PVwiJHtlc2NIdG1sKGNvbnRleHRfaWQpfVwiIHRpdGxlPVwiUmVtb3ZlXCIgYXJpYS1sYWJlbD1cIlJlbW92ZSAke2VzY0h0bWwobmFtZSl9XCI+w5c8L2J1dHRvbj48L3NwYW4+YDtcbiAgfSk7XG5cbiAgY29uc3QgYXZhaWxhYmxlID0gQXBwU3RhdGUuY29udGV4dHMuZmlsdGVyKGMgPT4gIWFzc2lnbmVkLmluY2x1ZGVzKGMuY29udGV4dF9pZCkpO1xuICBjb25zdCBhZGRTZWxlY3QgPSBhdmFpbGFibGUubGVuZ3RoXG4gICAgPyBgPHNlbGVjdCBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDdweDtiYWNrZ3JvdW5kOnZhcigtLWJnKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czoxMHB4O2NvbG9yOnZhcigtLW11dGVkKTtjdXJzb3I6cG9pbnRlclwiXG4gICAgICAgICAgICAgIGRhdGEtYWN0PVwiYWRkLXZpZGVvLWNvbnRleHRcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj5cbiAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlwiPisgQWRkPC9vcHRpb24+XG4gICAgICAgICR7YXZhaWxhYmxlLm1hcChjID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2NIdG1sKGMuY29udGV4dF9pZCl9XCI+JHtlc2NIdG1sKGMuZGlzcGxheV9uYW1lIHx8IGMuY29udGV4dF9pZCl9PC9vcHRpb24+YCkuam9pbignJyl9XG4gICAgICAgPC9zZWxlY3Q+YCA6ICcnO1xuXG4gIGNvbnN0IHByb3ZMaW5lcyA9IFtdO1xuICBpZiAodmlkZW8uY2xpcHNfc2NvcmVkX2F0KSB7XG4gICAgY29uc3Qgc2NvcmVkQ3R4ID0gdmlkZW8uY2xpcHNfc2NvcmVkX2NvbnRleHQgfHwgW107XG4gICAgY29uc3Qgc3RhbGUgPSBKU09OLnN0cmluZ2lmeShbLi4uYXNzaWduZWRdLnNvcnQoKSkgIT09IEpTT04uc3RyaW5naWZ5KFsuLi5zY29yZWRDdHhdLnNvcnQoKSk7XG4gICAgY29uc3Qgd2hlbiA9IF9mbXREYXRlKHZpZGVvLmNsaXBzX3Njb3JlZF9hdCk7XG4gICAgY29uc3QgY3R4TmFtZXMgPSBzY29yZWRDdHgubWFwKHMgPT4geyBjb25zdCBjID0gQXBwU3RhdGUuY29udGV4dHMuZmluZCh4ID0+IHguY29udGV4dF9pZCA9PT0gcyk7IHJldHVybiBjID8gYy5kaXNwbGF5X25hbWUgOiBzOyB9KTtcbiAgICBjb25zdCBjdHhTdHIgPSBjdHhOYW1lcy5sZW5ndGggPyAnIMK3ICcgKyBjdHhOYW1lcy5tYXAoZXNjSHRtbCkuam9pbignLCAnKSA6ICcgwrcgbm8gY29udGV4dCc7XG4gICAgcHJvdkxpbmVzLnB1c2goYDxzcGFuIGNsYXNzPVwiJHtzdGFsZSA/ICdwcm92ZW5hbmNlLXN0YWxlJyA6ICcnfVwiPkNsaXBzIHNjb3JlZCAke2VzY0h0bWwod2hlbil9JHtjdHhTdHJ9JHtzdGFsZSA/ICcgLSDimqAgY29udGV4dHMgY2hhbmdlZCBzaW5jZSBsYXN0IHNjb3JlJyA6ICcnfTwvc3Bhbj5gKTtcbiAgfVxuICBpZiAodmlkZW8uYW5hbHl6ZV9ydW4pIHByb3ZMaW5lcy5wdXNoKGA8c3Bhbj4ke2VzY0h0bWwod2luZG93Ll9ydW5UaW1pbmdMaW5lKHZpZGVvLmFuYWx5emVfcnVuKSl9PC9zcGFuPmApO1xuXG4gIGNvbnN0IG5vQ29udGV4dHNEZWZpbmVkID0gQXBwU3RhdGUuY29udGV4dHMubGVuZ3RoID09PSAwO1xuICBjb25zdCBlbXB0eU1zZyA9IG5vQ29udGV4dHNEZWZpbmVkXG4gICAgPyBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHhcIj5ObyBjb250ZXh0cyBkZWZpbmVkIC0gPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwicGFkZGluZzowO2Rpc3BsYXk6aW5saW5lO2ZvbnQtc2l6ZToxMnB4XCIgZGF0YS1hY3Q9XCJvcGVuLWNvbnRleHQtbWFuYWdlclwiPmNyZWF0ZSBvbmU8L2J1dHRvbj48L3NwYW4+YFxuICAgIDogKCFhc3NpZ25lZC5sZW5ndGggPyBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHhcIj5Ob25lIGFzc2lnbmVkPC9zcGFuPmAgOiAnJyk7XG5cbiAgY29uc3QgcmVzY29yZUJ0biA9IChhc3NpZ25lZC5sZW5ndGggJiYgdmlkZW8uY2xpcHNfc2NvcmVkX2F0KVxuICAgID8gYDxidXR0b24gY2xhc3M9XCJidG5cIiBzdHlsZT1cImZvbnQtc2l6ZToxMnB4O3BhZGRpbmc6NHB4IDEycHhcIiBkYXRhLWFjdD1cInJlc2NvcmUtY2xpcHNcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj5SZS1zY29yZSBjbGlwcyB3aXRoIGNvbnRleHQ8L2J1dHRvbj5gXG4gICAgOiBhc3NpZ25lZC5sZW5ndGhcbiAgICA/IGA8YnV0dG9uIGNsYXNzPVwiYnRuXCIgc3R5bGU9XCJmb250LXNpemU6MTJweDtwYWRkaW5nOjRweCAxMnB4XCIgZGF0YS1hY3Q9XCJyZXNjb3JlLWNsaXBzXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+U2NvcmUgY2xpcHMgd2l0aCBjb250ZXh0PC9idXR0b24+YFxuICAgIDogJyc7XG5cbiAgY29uc3QgZXJyQ291bnQgPSB2aWRlby5jbGlwc19sbG1fZXJyb3IgfHwgMDtcbiAgLy8gT25seSBvZmZlciB0aGUgcmV0cnkgd2hlbiBhIG1vZGVsIGNhbiBhY3R1YWxseSBydW4gLSBvdGhlcndpc2UgcmUtc2NvcmluZyB0aGVcbiAgLy8gXCJmYWlsZWRcIiBjbGlwcyBqdXN0IGZhaWxzIGFnYWluLiBXaXRoIG5vIG1vZGVsIHRoZXNlIGFyZW4ndCBmYWlsdXJlcywgdGhleSdyZVxuICAvLyBjbGlwcyBhd2FpdGluZyBhIGZpcnN0LXJ1biBtb2RlbCAoc3VyZmFjZWQgYnkgdGhlIGRlc2NyaXB0aW9uIHByb21wdCBpbnN0ZWFkKS5cbiAgY29uc3QgZmFpbGVkQnRuID0gKGVyckNvdW50ID4gMCAmJiAhISh3aW5kb3cuX3ByZXJlcXMgfHwge30pLmxsbV9vaylcbiAgICA/IGA8YnV0dG9uIGNsYXNzPVwiYnRuXCIgc3R5bGU9XCJmb250LXNpemU6MTJweDtwYWRkaW5nOjRweCAxMnB4O2JvcmRlci1jb2xvcjp2YXIoLS13YXJuaW5nKTtjb2xvcjp2YXIoLS13YXJuaW5nKVwiIGRhdGEtYWN0PVwicmVzY29yZS1mYWlsZWQtY2xpcHNcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIiB0aXRsZT1cIlJlLXJ1biBMTE0gc2NvcmluZyBvbmx5IGZvciB0aGUgJHtwbHVyYWwoZXJyQ291bnQsICdjbGlwJyl9IHRoYXQgZmFpbGVkIGxhc3QgdGltZVwiPiYjOTg4ODsgUmUtc2NvcmUgJHtwbHVyYWwoZXJyQ291bnQsICdmYWlsZWQgY2xpcCcpfTwvYnV0dG9uPmBcbiAgICA6ICcnO1xuXG4gIHJldHVybiBjb2xsYXBzaWJsZUNhcmQoJ3ZpZGVvLWNvbnRleHRzJyxcbiAgICBgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPldvcmxkIENvbnRleHRzPC9zcGFuPmAsIGBcbiAgICAgIDxkaXYgY2xhc3M9XCJjb250ZXh0LWNoaXBzXCI+XG4gICAgICAgICR7Y2hpcHMuam9pbignJyl9JHtlbXB0eU1zZ30ke2FkZFNlbGVjdCA/ICcmbmJzcDsnICsgYWRkU2VsZWN0IDogJyd9XG4gICAgICA8L2Rpdj5cbiAgICAgICR7cHJvdkxpbmVzLmxlbmd0aCA/IGA8ZGl2IGNsYXNzPVwicHJvdmVuYW5jZS1ub3RlXCI+JHtwcm92TGluZXMuam9pbignPGJyPicpfTwvZGl2PmAgOiAnJ31cbiAgICAgICR7KHJlc2NvcmVCdG4gfHwgZmFpbGVkQnRuKSA/IGA8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDo2cHg7ZGlzcGxheTpmbGV4O2dhcDo4cHg7ZmxleC13cmFwOndyYXBcIj4ke3Jlc2NvcmVCdG59JHtmYWlsZWRCdG59PC9kaXY+YCA6ICcnfWApO1xufVxuXG4vLyBGcmllbmRseSBlbXB0eSBzdGF0ZSBmb3IgdGhlIEFJIHN1bW1hcnkvdGltZWxpbmUgZmVhdHVyZXMgd2hlbiBubyBsYW5ndWFnZSBtb2RlbCBpc1xuLy8gaW5zdGFsbGVkIC0gdGhlIGJhY2tlbmQgcmV0dXJucyBhIG5lZWRzX21vZGVsIHBheWxvYWQgaW5zdGVhZCBvZiBhIGhhcmQgZXJyb3IsIGFuZFxuLy8gdGhpcyByZW5kZXJzIGl0IGFzIGFuIGludml0aW5nIFwiaW5zdGFsbCBhIGxvY2FsIG1vZGVsXCIgY2FsbCB0byBhY3Rpb24uIFRoZSBpbnN0YWxsXG4vLyBudWRnZSBpcyBoaWRkZW4gd2hlbiB0aGUgcGF5bG9hZCBhc2tzIGZvciBpdCAoU3RhZ2UgMDcgcHJpdmFjeSBtb2RlKS5cbmZ1bmN0aW9uIF9uZWVkc01vZGVsQ3RhSFRNTChwYXlsb2FkKSB7XG4gIGNvbnN0IGN0YSA9IHBheWxvYWQuc2hvd19jdGEgPT09IGZhbHNlID8gJycgOlxuICAgIGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA5cHhcIlxuICAgICAgIGRhdGEtYWN0PVwiaW5zdGFsbC1sb2NhbC1tb2RlbFwiPkluc3RhbGwgYSBsb2NhbCBtb2RlbDwvYnV0dG9uPmA7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cIm5lZWRzLW1vZGVsLWN0YVwiPlxuICAgIDxkaXYgY2xhc3M9XCJuZWVkcy1tb2RlbC1oZWFkaW5nXCI+JHtlc2NIdG1sKHBheWxvYWQuaGVhZGluZyl9PC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cIm5lZWRzLW1vZGVsLWRldGFpbFwiPiR7ZXNjSHRtbChwYXlsb2FkLmRldGFpbCl9PC9kaXY+XG4gICAgJHtjdGF9XG4gIDwvZGl2PmA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9yZWZyZXNoVmlkZW9EZXRhaWwodmlkZW9JZCkge1xuICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gIGNvbnN0IHVwZGF0ZWQgPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh4ID0+IHguaWQgPT09IHZpZGVvSWQpO1xuICBpZiAodXBkYXRlZCkgcmVuZGVyVmlkZW9EZXRhaWwodXBkYXRlZCwgbnVsbCk7XG59XG5cbi8vIOKUgOKUgCByZS1hbmFseXNpcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFR3byB3YXlzIHRvIHJlLXJ1biBhbmFseXNpcyBvbiBhbiBhbHJlYWR5LWFuYWx5emVkIHJlY29yZGluZzpcbi8vICAgcmVhbmFseXplVmlkZW8gIC0gZnVsbCBwaXBlbGluZSB3aXRoIC0tZm9yY2UgKGRlc3RydWN0aXZlOiByZXBsYWNlcyBjbGlwcy9zY29yZXMpLlxuLy8gICByZWRpYXJpemVWaWRlbyAgLSBzcGVha2VyIGRldGVjdGlvbiBvbmx5IChub24tZGVzdHJ1Y3RpdmU6IGtlZXBzIGNsaXBzL3Njb3JlcykuXG4vLyBPcGVucyB0aGUgTmV3IFJlY29yZGluZyBwYW5lbCBpbiByZS1hbmFseXplIG1vZGU6IHNldHRpbmdzIGRlZmF1bHQgdG8gdGhpc1xuLy8gcmVjb3JkaW5nJ3Mgb3JpZ2luYWwgcnVuIGJ1dCBzdGF5IGVkaXRhYmxlLCBhbmQgdGhlIGRlc3RydWN0aXZlIHdhcm5pbmcgcGx1c1xuLy8gdGhlIGV4cGxpY2l0IFwiUmUtYW5hbHl6ZVwiIGJ1dHRvbiBzdGFuZCBpbiBmb3IgdGhlIG9sZCBjb25maXJtIGRpYWxvZy5cbmZ1bmN0aW9uIHJlYW5hbHl6ZVZpZGVvKGlkKSB7XG4gIGlmIChfYmxvY2tlZEJ5QW5hbHl6ZSgncmUtYW5hbHl6ZSB0aGlzIHJlY29yZGluZycpKSByZXR1cm47XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gIGlmICghdmlkZW8pIHJldHVybjtcbiAgd2luZG93Lm9wZW5SZWFuYWx5emVQYW5lbCh2aWRlbyk7XG59XG5cbi8vIFJlYnVpbGQgYW4gYW5hbHl6ZSByZXF1ZXN0IHRoZSB3YXkgdGhlIHJlY29yZGluZyB3YXMgb3JpZ2luYWxseSBhbmFseXplZFxuLy8gKFZpZGVvLmFuYWx5emVfcnVuLnNldHRpbmdzKSwgZmFsbGluZyBiYWNrIHRvIHRoZSBTZXR0aW5ncy1tYW5hZ2VkIGNvbmZpZ1xuLy8gZGVmYXVsdHMgd2hlbiBubyBydW4gd2FzIHJlY29yZGVkLiBTaGFyZWQgYnkgcmUtYW5hbHl6ZSAoZnVsbCkgaGVyZSBhbmQgdGhlXG4vLyBzcGxpdCByZS1hbmFseXplIGZsb3cgaW4gc3BsaXQuanMuXG5hc3luYyBmdW5jdGlvbiBfcmVhbmFseXplUGFyYW1zKHZpZGVvKSB7XG4gIGNvbnN0IGN1cnJlbnRDb250ZXh0cyA9ICh2aWRlbyAmJiB2aWRlby5jb250ZXh0X25hbWVzKSB8fCBbXTtcbiAgY29uc3QgcmVjb3JkZWQgPSB2aWRlbyAmJiB2aWRlby5hbmFseXplX3J1biAmJiB2aWRlby5hbmFseXplX3J1bi5zZXR0aW5ncztcbiAgaWYgKHJlY29yZGVkICYmIHJlY29yZGVkLm1vZGVsKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1vZGVsOiAgICAgICAgIHJlY29yZGVkLm1vZGVsLFxuICAgICAgcHJvZmlsZTogICAgICAgcmVjb3JkZWQudHJhY2tfbGF5b3V0ICYmIHJlY29yZGVkLnRyYWNrX2xheW91dCAhPT0gJ2RlZmF1bHQnID8gcmVjb3JkZWQudHJhY2tfbGF5b3V0IDogbnVsbCxcbiAgICAgIGVuZXJneV9tb2RlOiAgIHJlY29yZGVkLmVuZXJneV9tb2RlIHx8ICdmYXN0JyxcbiAgICAgIHNjZW5lX21vZGU6ICAgIHJlY29yZGVkLnNjZW5lX21vZGUgfHwgJ2Zhc3QnLFxuICAgICAgZGlhcml6ZTogICAgICAgdHlwZW9mIHJlY29yZGVkLnNwZWFrZXJfbGFiZWxzID09PSAnYm9vbGVhbicgPyByZWNvcmRlZC5zcGVha2VyX2xhYmVscyA6IG51bGwsXG4gICAgICBjb250ZXh0X25hbWVzOiBjdXJyZW50Q29udGV4dHMubGVuZ3RoID8gY3VycmVudENvbnRleHRzIDogKHJlY29yZGVkLmNvbnRleHRzIHx8IFtdKSxcbiAgICB9O1xuICB9XG4gIGxldCBjZmcgPSB7fTtcbiAgdHJ5IHsgY2ZnID0gYXdhaXQgZmV0Y2goJy9hcGkvY29uZmlnJykudGhlbihyID0+IHIuanNvbigpKTsgfSBjYXRjaCB7IC8qIGtlZXAgc3RhdGljIGZhbGxiYWNrcyAqLyB9XG4gIHJldHVybiB7XG4gICAgbW9kZWw6ICAgICAgICAgY2ZnLndoaXNwZXJfbW9kZWwgfHwgJ21lZGl1bScsXG4gICAgcHJvZmlsZTogICAgICAgbnVsbCxcbiAgICBlbmVyZ3lfbW9kZTogICBjZmcuZW5lcmd5X21vZGUgfHwgJ2Zhc3QnLFxuICAgIHNjZW5lX21vZGU6ICAgIGNmZy5zY2VuZV9kZXRlY3Rpb25fbW9kZSB8fCAnZmFzdCcsXG4gICAgZGlhcml6ZTogICAgICAgbnVsbCxcbiAgICBjb250ZXh0X25hbWVzOiBjdXJyZW50Q29udGV4dHMsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlZGlhcml6ZVZpZGVvKGlkKSB7XG4gIGlmIChfYmxvY2tlZEJ5QW5hbHl6ZSgncmUtZGV0ZWN0IHNwZWFrZXJzJykpIHJldHVybjtcbiAgY29uc3QgdmlkZW8gPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IGlkKTtcbiAgY29uc3QgbmFtZSA9IHZpZGVvID8gdmlkZW8uZmlsZW5hbWUgOiBpZDtcbiAgb3BlbkxvZygpO1xuICBhcHBlbmRMb2coYFJlLWRldGVjdGluZyBzcGVha2VyczogJHtuYW1lfWApO1xuICBzdHJlYW1TU0UoXG4gICAgYC9hcGkvdmlkZW9zLyR7aWR9L3JlZGlhcml6ZWAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICAgICAgY29uc3QgdiA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHggPT4geC5pZCA9PT0gaWQpO1xuICAgICAgaWYgKHYgJiYgQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIHJlbmRlclZpZGVvRGV0YWlsKHYsIG51bGwpO1xuICAgICAgaWYgKHdpbmRvdy5sb2FkU3BlYWtlcnMpIHdpbmRvdy5sb2FkU3BlYWtlcnMoaWQpO1xuICAgICAgc2hvd1RvYXN0KCdTcGVha2VyIGRldGVjdGlvbiBjb21wbGV0ZScpO1xuICAgICAgd2luZG93LlNvdW5kRngucGxheSgnYW5hbHlzaXMnKTtcbiAgICB9LFxuICAgIFt7bGFiZWw6ICdTcGVha2VycycsIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzcGVha2VycyddfV0sXG4gICAgJ1JlLWRldGVjdGluZyBzcGVha2VycycsXG4gICAgZmFsc2UsXG4gICk7XG59XG5cbi8vIOKUgOKUgCBzaW5nbGUtc3RhZ2UgcmUtcnVucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFJlLXJ1biBvbmUgcGlwZWxpbmUgc3RhZ2Ugd2l0aG91dCBwYXlpbmcgZm9yIHRoZSBlYXJsaWVyIG9uZXMuIERvd25zdHJlYW0gcmVzdWx0c1xuLy8gYXJlIG1hcmtlZCBzdGFsZSAodmlhIHRoZSBleGlzdGluZyBcImNhcHRpb25zIGNoYW5nZWRcIiAvIHVuc2NvcmVkIGJhZGdlcykgcmF0aGVyIHRoYW5cbi8vIGNhc2NhZGVkIC0gdGhlIHVzZXIgY2hvb3NlcyB3aGVuIHRvIHJlLXNjb3JlIC8gcmVnZW5lcmF0ZS5cbmZ1bmN0aW9uIHJlZXh0cmFjdFZpZGVvUnVuKGlkKSB7XG4gIGlmIChfYmxvY2tlZEJ5QW5hbHl6ZSgncmUtZXh0cmFjdCBhdWRpbycpKSByZXR1cm47XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gIGNvbnN0IG5hbWUgPSB2aWRlbyA/IHZpZGVvLmZpbGVuYW1lIDogaWQ7XG4gIG9wZW5Mb2coKTtcbiAgYXBwZW5kTG9nKGBSZS1leHRyYWN0aW5nIGF1ZGlvOiAke25hbWV9YCk7XG4gIHN0cmVhbVNTRShcbiAgICBgL2FwaS92aWRlb3MvJHtpZH0vcmVleHRyYWN0YCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gICAgICBjb25zdCB2ID0gQXBwU3RhdGUudmlkZW9zLmZpbmQoeCA9PiB4LmlkID09PSBpZCk7XG4gICAgICBpZiAodiAmJiBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID09PSBpZCkgcmVuZGVyVmlkZW9EZXRhaWwodiwgbnVsbCk7XG4gICAgICBzaG93VG9hc3QoJ0F1ZGlvIHJlLWV4dHJhY3RlZCAtIHJlLXRyYW5zY3JpYmUgdG8gdXBkYXRlIHRoZSB0cmFuc2NyaXB0Jyk7XG4gICAgICB3aW5kb3cuU291bmRGeC5wbGF5KCdhbmFseXNpcycpO1xuICAgIH0sXG4gICAgW3tsYWJlbDogJ0V4dHJhY3QnLCBwYXR0ZXJuczogWydFeHRyYWN0aW5nIGF1ZGlvJ119XSxcbiAgICAnUmUtZXh0cmFjdGluZyBhdWRpbycsXG4gICAgZmFsc2UsXG4gICk7XG59XG5cbmZ1bmN0aW9uIHJldHJhbnNjcmliZVZpZGVvUnVuKGlkKSB7XG4gIGlmIChfYmxvY2tlZEJ5QW5hbHl6ZSgncmUtdHJhbnNjcmliZSB0aGlzIHJlY29yZGluZycpKSByZXR1cm47XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gIGNvbnN0IG5hbWUgPSB2aWRlbyA/IHZpZGVvLmZpbGVuYW1lIDogaWQ7XG4gIG9wZW5Mb2coKTtcbiAgYXBwZW5kTG9nKGBSZS10cmFuc2NyaWJpbmc6ICR7bmFtZX1gKTtcbiAgc3RyZWFtU1NFKFxuICAgIGAvYXBpL3ZpZGVvcy8ke2lkfS9yZXRyYW5zY3JpYmVgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgICAgIGlmIChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID09PSBpZCkgYXdhaXQgc2VsZWN0VmlkZW8oaWQpO1xuICAgICAgc2hvd1RvYXN0KCdSZS10cmFuc2NyaXB0aW9uIGNvbXBsZXRlIC0gcmUtc2NvcmUgdG8gcmVmcmVzaCBjbGlwIHNjb3JlcycpO1xuICAgICAgd2luZG93LlNvdW5kRngucGxheSgnYW5hbHlzaXMnKTtcbiAgICB9LFxuICAgIFt7bGFiZWw6ICdFeHRyYWN0JywgcGF0dGVybnM6IFsnRXh0cmFjdGluZyBhdWRpbyddfSwge2xhYmVsOiAnVHJhbnNjcmliZScsIHBhdHRlcm5zOiBbJ1RyYW5zY3JpYmluZyddfV0sXG4gICAgJ1JlLXRyYW5zY3JpYmluZycsXG4gICAgZmFsc2UsXG4gICk7XG59XG5cbmZ1bmN0aW9uIHJlZ2VuZXJhdGVDbGlwc1J1bihpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlZ2VuZXJhdGUgY2xpcHMnKSkgcmV0dXJuO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBjb25zdCBuYW1lID0gdmlkZW8gPyB2aWRlby5maWxlbmFtZSA6IGlkO1xuICBzaG93Q29uZmlybShcbiAgICAnUmVnZW5lcmF0ZSBjbGlwcz8nLFxuICAgICdUaGlzIHJlYnVpbGRzIGV2ZXJ5IGNsaXAgZnJvbSB0aGUgY3VycmVudCB0cmFuc2NyaXB0LCBkaXNjYXJkaW5nIGFsbCBhcHByb3ZhbHMsIGVkaXRzLCB0YWdzLCBhbmQgc2NvcmVzIG9uIHRoaXMgcmVjb3JkaW5nXFwncyBleGlzdGluZyBjbGlwcy4gVGhlIHRyYW5zY3JpcHQgaXRzZWxmIGlzIGtlcHQuIFJlLXNjb3JlIGFmdGVyd2FyZCB0byBwb3B1bGF0ZSB0aGUgbmV3IGNsaXBzLicsXG4gICAgJ1JlZ2VuZXJhdGUgQ2xpcHMnLFxuICAgICgpID0+IHtcbiAgICAgIG9wZW5Mb2coKTtcbiAgICAgIGFwcGVuZExvZyhgUmVnZW5lcmF0aW5nIGNsaXBzOiAke25hbWV9YCk7XG4gICAgICBzdHJlYW1TU0UoXG4gICAgICAgIGAvYXBpL3ZpZGVvcy8ke2lkfS9yZWdlbmVyYXRlLWNsaXBzYCxcbiAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgICAgICAgICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIGF3YWl0IHNlbGVjdFZpZGVvKGlkKTtcbiAgICAgICAgICBzaG93VG9hc3QoJ0NsaXBzIHJlZ2VuZXJhdGVkIC0gcmUtc2NvcmUgdG8gcG9wdWxhdGUgc2NvcmVzJyk7XG4gICAgICAgICAgd2luZG93LlNvdW5kRngucGxheSgnYW5hbHlzaXMnKTtcbiAgICAgICAgfSxcbiAgICAgICAgW3tsYWJlbDogJ0dlbmVyYXRlIENsaXBzJywgcGF0dGVybnM6IFsnR2VuZXJhdGluZyBjbGlwcyddfV0sXG4gICAgICAgICdSZWdlbmVyYXRpbmcgY2xpcHMnLFxuICAgICAgICBmYWxzZSxcbiAgICAgICk7XG4gICAgfSxcbiAgICB0cnVlLFxuICApO1xufVxuXG4vLyDilIDilIAgdW5kbyBzcGxpdCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmZ1bmN0aW9uIHVuc3BsaXRWaWRlbyh2aWRlb0lkKSB7XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSB2aWRlb0lkKTtcbiAgaWYgKCF2aWRlbyB8fCB2aWRlby5wYXJlbnRfdmlkZW9faWQgPT0gbnVsbCkgcmV0dXJuO1xuICBjb25zdCBzaWJsaW5ncyAgPSBBcHBTdGF0ZS52aWRlb3MuZmlsdGVyKHYgPT4gdi5wYXJlbnRfdmlkZW9faWQgPT09IHZpZGVvLnBhcmVudF92aWRlb19pZCk7XG4gIGNvbnN0IGNsaXBUb3RhbCA9IHNpYmxpbmdzLnJlZHVjZSgoc3VtLCB2KSA9PiBzdW0gKyAodi5jbGlwX2NvdW50IHx8IDApLCAwKTtcbiAgc2hvd0NvbmZpcm0oXG4gICAgJ1VuZG8gc3BsaXQ/JyxcbiAgICBgVGhpcyBtZXJnZXMgJHtwbHVyYWwoc2libGluZ3MubGVuZ3RoLCAnc2VnbWVudCcpfSAtIGFuZCAke3BsdXJhbChjbGlwVG90YWwsICdjbGlwJyl9IG9uIHRoZW0gLSBgICtcbiAgICBgYmFjayBpbnRvIHRoZSBvcmlnaW5hbCByZWNvcmRpbmcsIHJlc3RvcmluZyBlYWNoIGNsaXAncyBvcmlnaW5hbCB0aW1pbmcuIGAgK1xuICAgIGBUaGUgc2VnbWVudHMgYXJlIHJlbW92ZWQgYW5kIHRoZSBvcmlnaW5hbCByZWNvcmRpbmcgYmVjb21lcyB2aXNpYmxlIGFnYWluLmAsXG4gICAgJ1VuZG8gU3BsaXQnLFxuICAgICgpID0+IF9kb1Vuc3BsaXRWaWRlbyh2aWRlb0lkKSxcbiAgICB0cnVlLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZG9VbnNwbGl0VmlkZW8odmlkZW9JZCkge1xuICBsZXQgcmVzO1xuICB0cnkge1xuICAgIHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L3Vuc3BsaXRgLCB7bWV0aG9kOiAnUE9TVCd9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgc2hvd1RvYXN0KG5ldEVyck1zZyhlcnIpLCAnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFyZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChgVW5kbyBzcGxpdCBmYWlsZWQ6ICR7Zm9ybWF0QXBpRXJyb3IoZXJyKX1gLCAnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCk7XG4gIHNob3dUb2FzdChgU3BsaXQgdW5kb25lIC0gJHtwbHVyYWwoZGF0YS5tZXJnZWRfY2xpcHMsICdjbGlwJyl9IHJlc3RvcmVkIHRvIHRoZSBvcmlnaW5hbCByZWNvcmRpbmdgKTtcbiAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICBzZWxlY3RWaWRlbyhkYXRhLnBhcmVudF9pZCk7XG59XG5cbmZ1bmN0aW9uIF9vcGVuVmlkZW9GaWVsZEtlYmFiKHZpZGVvSWQsIGJ0biwgZmllbGQpIHtcbiAgY29uc3QgdmlkZW8gICAgICA9IEFwcFN0YXRlLmFjdGl2ZVZpZGVvRGF0YTtcbiAgY29uc3QgaXNUaXRsZSAgICA9IGZpZWxkID09PSAndGl0bGUnO1xuICBjb25zdCBlZGl0VGl0bGUgID0gaXNUaXRsZSA/ICdFZGl0IFRpdGxlJyAgIDogJ0VkaXQgU3VtbWFyeSc7XG4gIGNvbnN0IHJldmVydFRpdGxlID0gaXNUaXRsZSA/ICdSZXZlcnQgVGl0bGUnIDogJ1JldmVydCBTdW1tYXJ5JztcbiAgY29uc3QgZGlmZkxhYmVsICA9IGlzVGl0bGUgPyAnVGl0bGUnICAgICAgICAgOiAnU3VtbWFyeSc7XG4gIGNvbnN0IGN1cnJlbnQgICAgPSBpc1RpdGxlID8gdmlkZW8/LnRpdGxlICAgIDogdmlkZW8/LnN1bW1hcnk7XG4gIGNvbnN0IGlzRWRpdGVkICAgPSBpc1RpdGxlID8gdmlkZW8/LnRpdGxlX2lzX2VkaXRlZCAgIDogdmlkZW8/LnN1bW1hcnlfaXNfZWRpdGVkO1xuICBjb25zdCBvcmlnaW5hbCAgID0gaXNUaXRsZSA/IHZpZGVvPy50aXRsZV9vcmlnaW5hbCAgICA6IHZpZGVvPy5zdW1tYXJ5X29yaWdpbmFsO1xuXG4gIGNvbnN0IGl0ZW1zID0gW1xuICAgIHsgbGFiZWw6ICdFZGl0JywgYWN0aW9uOiAoKSA9PlxuICAgICAgb3BlbkZpZWxkRWRpdE1vZGFsKGVkaXRUaXRsZSwgY3VycmVudCB8fCAnJywgYXN5bmMgdiA9PiB7XG4gICAgICAgIGF3YWl0IF9wYXRjaFZpZGVvRmllbGQodmlkZW9JZCwgJ2FjY2VwdF9lZGl0JywgZmllbGQsXG4gICAgICAgICAgaXNUaXRsZSA/IHYgOiBudWxsLCBpc1RpdGxlID8gbnVsbCA6IHYpO1xuICAgICAgICBhd2FpdCBfcmVmcmVzaFZpZGVvRGV0YWlsKHZpZGVvSWQpO1xuICAgICAgfSlcbiAgICB9LFxuICBdO1xuICBpZiAoaXNFZGl0ZWQpIHtcbiAgICBpdGVtcy5wdXNoKHsgbGFiZWw6ICdSZXZlcnQgdG8gT3JpZ2luYWwnLCBhY3Rpb246ICgpID0+XG4gICAgICBvcGVuRGlmZk1vZGFsKHJldmVydFRpdGxlLCBbXG4gICAgICAgIHtsYWJlbDogZGlmZkxhYmVsLCBjdXJyZW50LCBwcm9wb3NlZDogb3JpZ2luYWx9LFxuICAgICAgXSwgYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCBfcGF0Y2hWaWRlb0ZpZWxkKHZpZGVvSWQsICdyZXZlcnQnLCBmaWVsZCwgbnVsbCwgbnVsbCk7XG4gICAgICAgIGF3YWl0IF9yZWZyZXNoVmlkZW9EZXRhaWwodmlkZW9JZCk7XG4gICAgICB9LCB7cmV2ZXJ0TW9kZTogdHJ1ZX0pXG4gICAgfSk7XG4gIH1cbiAgaXRlbXMucHVzaChudWxsLCB7IGxhYmVsOiAnUmVnZW5lcmF0ZScsIGFjdGlvbjogKCkgPT4gd2luZG93LnN1bW1hcml6ZVZpZGVvKHZpZGVvSWQsIG51bGwpIH0pO1xuICBpZiAoIWlzVGl0bGUpIGl0ZW1zLnB1c2goeyBsYWJlbDogJ1JlZ2VuZXJhdGUgKGF1dG8tc2F2ZSknLCBhY3Rpb246ICgpID0+IHdpbmRvdy5yZWdlblN1bW1hcnlBdXRvKHZpZGVvSWQsIG51bGwpIH0pO1xuICBzaG93S2ViYWIoYnRuLCBpdGVtcyk7XG59XG5cbmZ1bmN0aW9uIG9wZW5WaWRlb1RpdGxlS2ViYWIodmlkZW9JZCwgYnRuKSAgIHsgX29wZW5WaWRlb0ZpZWxkS2ViYWIodmlkZW9JZCwgYnRuLCAndGl0bGUnKTsgfVxuZnVuY3Rpb24gb3BlblZpZGVvU3VtbWFyeUtlYmFiKHZpZGVvSWQsIGJ0bikgeyBfb3BlblZpZGVvRmllbGRLZWJhYih2aWRlb0lkLCBidG4sICdzdW1tYXJ5Jyk7IH1cblxuYXN5bmMgZnVuY3Rpb24gX3BhdGNoVmlkZW9GaWVsZCh2aWRlb0lkLCBhY3Rpb24sIGZpZWxkLCBuZXdUaXRsZSwgbmV3U3VtbWFyeSkge1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9maWVsZHNgLCB7XG4gICAgbWV0aG9kOiAnUEFUQ0gnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe2FjdGlvbiwgZmllbGQsIG5ld190aXRsZTogbmV3VGl0bGUsIG5ld19zdW1tYXJ5OiBuZXdTdW1tYXJ5fSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgc2hvd1RvYXN0KCdTYXZlIGZhaWxlZCcsICdlcnJvcicpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBvbkNsaXBzU29ydENoYW5nZSgpIHtcbiAgaWYgKCFBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKSByZXR1cm47XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjbGlwcy1zb3J0JywgX2NsaXBzU29ydFBhcmFtKCkpO1xuICB0cnkge1xuICAgIEFwcFN0YXRlLmNsaXBzID0gYXdhaXQgZmV0Y2goX2NsaXBzTGlzdFVybChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKSkudGhlbihyID0+IHIuanNvbigpKTtcbiAgfSBjYXRjaCB7IHJldHVybjsgfVxuICB3aW5kb3cuX3JlbmRlckNsaXBzKCk7XG59XG5cbi8vIOKUgOKUgCBpbi1kZXRhaWwgYWN0aW9uIGRlbGVnYXRpb24g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyAjZGV0YWlsJ3MgaW5uZXJIVE1MIGlzIHJlYnVpbHQgd2hvbGVzYWxlIGJ5IHJlbmRlclZpZGVvRGV0YWlsL19zaG93RW1wdHlTdGF0ZVxuLy8gKGFuZCBieSBvdGhlciBtb2R1bGVzJyBjb2RlIHRoYXQgYWxzbyB0YXJnZXRzICNkZXRhaWwsIGUuZy4gY2xpcHMuanMncyBjbGlwXG4vLyBkZXRhaWwgdmlldyksIHNvIHRoZSBjbGljay9jaGFuZ2UgbGlzdGVuZXJzIGFyZSB3aXJlZCBvbmNlIG9uIHRoZSBjb250YWluZXJcbi8vIGl0c2VsZiAtIHNlZSB0aGUgYWRkRXZlbnRMaXN0ZW5lciBjYWxscyBhdCB0aGUgYm90dG9tIG9mIHRoaXMgZmlsZSAtIHJhdGhlclxuLy8gdGhhbiByZS1hdHRhY2hlZCBwZXIgcmVuZGVyLiBUaGUgY29udGFpbmVyIG5vZGUgcGVyc2lzdHMgYWNyb3NzIGV2ZXJ5IHJlbmRlcjtcbi8vIG9ubHkgaXRzIGNoaWxkcmVuIGFyZSByZXBsYWNlZC5cbmZ1bmN0aW9uIF9oYW5kbGVEZXRhaWxDbGljayhlKSB7XG4gIGNvbnN0IGVsID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0XScpO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGNvbnN0IGFjdCA9IGVsLmRhdGFzZXQuYWN0O1xuICBjb25zdCB2aWRlb0lkID0gZWwuZGF0YXNldC52aWRlb0lkICE9IG51bGwgPyBwYXJzZUludChlbC5kYXRhc2V0LnZpZGVvSWQpIDogbnVsbDtcbiAgc3dpdGNoIChhY3QpIHtcbiAgICBjYXNlICdvcGVuLW5ldy1yZWNvcmRpbmctcGFuZWwnOiB3aW5kb3cub3Blbk5ld1JlY29yZGluZ1BhbmVsKCk7IGJyZWFrO1xuICAgIGNhc2UgJ29wZW4tZ2V0dGluZy1zdGFydGVkJzogb3BlbkdldHRpbmdTdGFydGVkTW9kYWwoKTsgYnJlYWs7XG4gICAgY2FzZSAndmlkZW8tdGl0bGUta2ViYWInOiBvcGVuVmlkZW9UaXRsZUtlYmFiKHZpZGVvSWQsIGVsKTsgYnJlYWs7XG4gICAgY2FzZSAndmlkZW8tc3VtbWFyeS1rZWJhYic6IG9wZW5WaWRlb1N1bW1hcnlLZWJhYih2aWRlb0lkLCBlbCk7IGJyZWFrO1xuICAgIGNhc2UgJ3N1bW1hcml6ZS12aWRlbyc6IHdpbmRvdy5zdW1tYXJpemVWaWRlbyh2aWRlb0lkLCBlbCk7IGJyZWFrO1xuICAgIGNhc2UgJ3JldmVhbC1pbi1mb2xkZXInOiByZXZlYWxJbkZvbGRlcihBcHBTdGF0ZS5hY3RpdmVWaWRlb0RhdGEucGF0aCk7IGJyZWFrO1xuICAgIGNhc2UgJ29wZW4tYmF0Y2gtZXhwb3J0Jzogd2luZG93Lm9wZW5CYXRjaEV4cG9ydE1vZGFsKHZpZGVvSWQpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLXZpZGVvLWFjdGlvbnMnOiBvcGVuVmlkZW9BY3Rpb25zTW9kYWwodmlkZW9JZCk7IGJyZWFrO1xuICAgIGNhc2UgJ29wZW4tbmFtZS1jb3JyZWN0aW9ucyc6IHdpbmRvdy5vcGVuTmFtZUNvcnJlY3Rpb25zKHZpZGVvSWQpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWNsaXAtY3JlYXRlLXBpY2tlcic6IHdpbmRvdy5vcGVuQ2xpcENyZWF0ZVBpY2tlcih2aWRlb0lkKTsgYnJlYWs7XG4gICAgY2FzZSAnZ2VuZXJhdGUtdGltZWxpbmUnOiB3aW5kb3cuZ2VuZXJhdGVUaW1lbGluZSh2aWRlb0lkKTsgYnJlYWs7XG4gICAgY2FzZSAnY2FuY2VsLWpvYic6IGNhbmNlbEpvYigpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWNvbnRleHQtbWFuYWdlcic6IHdpbmRvdy5vcGVuQ29udGV4dE1hbmFnZXIoKTsgYnJlYWs7XG4gICAgY2FzZSAncmVzY29yZS1jbGlwcyc6IHdpbmRvdy5yZXNjb3JlQ2xpcHModmlkZW9JZCwgZWwpOyBicmVhaztcbiAgICBjYXNlICdyZXNjb3JlLWZhaWxlZC1jbGlwcyc6IHdpbmRvdy5yZXNjb3JlRmFpbGVkQ2xpcHModmlkZW9JZCwgZWwpOyBicmVhaztcbiAgICBjYXNlICdpbnN0YWxsLWxvY2FsLW1vZGVsJzpcbiAgICAgIHdpbmRvdy5vcGVuU2V0dGluZ3MoKTtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gd2luZG93Ll9zY3JvbGxUb1NldHRpbmdzU2VjdGlvbignc2V0dGluZ3Mtc2VjLWxsbScpLCAxMjApO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cblxuZnVuY3Rpb24gX2hhbmRsZURldGFpbENoYW5nZShlKSB7XG4gIGNvbnN0IGVsID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0PVwiYWRkLXZpZGVvLWNvbnRleHRcIl0nKTtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBjb25zdCB2aWRlb0lkID0gcGFyc2VJbnQoZWwuZGF0YXNldC52aWRlb0lkKTtcbiAgd2luZG93LmFkZFZpZGVvQ29udGV4dCh2aWRlb0lkLCBlbC52YWx1ZSk7XG4gIGVsLnZhbHVlID0gJyc7XG59XG5cbi8vIFB1YmxpYyBBUEkgLSBzeW1ib2xzIHdpdGggYSBjbGFzc2ljIChidW5kbGUuanMpIGNvbnN1bWVyLCBhbiBpbmxpbmUgaGFuZGxlciBpblxuLy8gaW5kZXguaHRtbCdzIHN0YXRpYyBtYXJrdXAsIG9yIGEgdGVzdHMvdWkvKi5weSBwYWdlLmV2YWx1YXRlLiBJbnRlcm5hbCBoZWxwZXJzXG4vLyAocmUtYW5hbHl6ZS9yZS1ydW4gYWN0aW9ucywgdGhlIHR3byBrZWJhYiBvcGVuZXJzLCBldGMuKSBzdGF5IG1vZHVsZS1wcml2YXRlIC1cbi8vIHNlZSBtYWluLmVzbS5qcyBmb3Igd2hhdCBlYWNoIHN1cnZpdmluZyBuYW1lIGhlcmUgc3RpbGwgbmVlZHMgaXQgZm9yLlxuZXhwb3J0IHtcbiAgbG9hZFZpZGVvcywgc2VsZWN0VmlkZW8sIHJlbmRlclZpZGVvRGV0YWlsLCBkZWxldGVWaWRlbyxcbiAgb25DbGlwc1NvcnRDaGFuZ2UsIF9jbGlwc1NvcnRQYXJhbSwgX2NsaXBzTGlzdFVybCxcbiAgX3JlYW5hbHl6ZVBhcmFtcyxcbiAgX25lZWRzTW9kZWxDdGFIVE1MLFxuICBfdXBkYXRlRGVtb0J1dHRvbiwgX3VwZGF0ZVN0YXJ0SW5nZXN0QnV0dG9uLFxuICBfYW5hbHlzaXNMaXZlUGFuZWxIVE1MLCBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsLFxuICBfYXBwbHlWaWRlb0ZpbHRlcnMsIF9yZW5kZXJWaWRlb0xpc3QsXG4gIHNldFZpZGVvU2VhcmNoLCBzZXRWaWRlb1NvcnQsIHRvZ2dsZVZpZGVvU29ydERpciwgdG9nZ2xlVmlkZW9GaWx0ZXIsXG4gIG9wZW5WaWRlb0FjdGlvbnNNb2RhbCxcbn07XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIF9oYW5kbGVEZXRhaWxDbGljayk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgX2hhbmRsZURldGFpbENoYW5nZSk7XG4iLCAiLy8gRVNNIGVudHJ5IHBvaW50IC0gdGhlIHN0cmFuZ2xlci1maWcgc2VhbSAoV1M1IHN0ZXAgMikuIGVzYnVpbGQgYnVuZGxlcyB0aGlzXG4vLyBtb2R1bGUgZ3JhcGggaW50byBzdGF0aWMvYnVuZGxlLmVzbS5qcyAoc2VlIHNjcmlwdHMvYnVpbGQtZXNtLm1qcywgcnVuIGJ5XG4vLyBgeXV1LWRldiBidW5kbGVgKS4gRXZlcnl0aGluZyByZWFjaGFibGUgZnJvbSBoZXJlIGlzIHJlYWwgRVNNIChpbXBvcnQvZXhwb3J0KTtcbi8vIHRoZSBjbGFzc2ljIGdsb2JhbC1zY29wZSBzY3JpcHRzIHN0aWxsIGluIGJ1bmRsZS5qcyBjYWxsIHRoZXNlIG1vZHVsZXMgYXNcbi8vIHdpbmRvdyBnbG9iYWxzLCBzbyB0aGlzIGVudHJ5IHJlLWV4cG9zZXMgZWFjaCBtaWdyYXRlZCBtb2R1bGUncyBwdWJsaWMgc3VyZmFjZVxuLy8gb24gd2luZG93IGFzIGEgY29tcGF0aWJpbGl0eSBzaGltLlxuLy9cbi8vIE1pZ3JhdGluZyBhIGNsYXNzaWMgY29uc3VtZXIgdG8gYGltcG9ydGAgc2hyaW5rcyB0aGUgc2hpbTogb25jZSBub3RoaW5nIHJlYWRzIGFcbi8vIG5hbWUgb2ZmIHdpbmRvdywgZGVsZXRlIGl0cyBsaW5lIGJlbG93LiBXaGVuIGJ1bmRsZS5qcyBpcyBlbXB0eSwgdGhpcyBmaWxlIGlzXG4vLyB0aGUgd2hvbGUgYXBwIGFuZCB0aGUgc2hpbSBpcyBnb25lLlxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCAqIGFzIGZvcm1hdCBmcm9tICcuL2Zvcm1hdC5qcyc7XG5pbXBvcnQgeyBDb2xvclBpY2tlciB9IGZyb20gJy4vY29sb3JwaWNrZXIuanMnO1xuaW1wb3J0IHsgUGFuZWxOYXYgfSBmcm9tICcuL3BhbmVsbmF2LmpzJztcbmltcG9ydCAqIGFzIGpvYnMgZnJvbSAnLi9qb2JzLmpzJztcbmltcG9ydCB7IF9idWlsZE1lZGlhVXJsLCBzZXR1cFJlY29yZGluZ1ByZXZpZXcgfSBmcm9tICcuL3ByZXZpZXcuanMnO1xuaW1wb3J0IHtcbiAgX3N5bmNTb3J0RGlyQnRuLCBfZGlhcml6YXRpb25SZWFzb24sIF9kaWFyaXphdGlvblJlYWRpbmVzcywgX2RpYXJpemF0aW9uTm90ZUh0bWwsXG4gIG9wZW5Mb2csIGNsZWFyTG9nLCBhcHBlbmRMb2csIHNob3dUb2FzdCwgbmV0RXJyTXNnLCByZXZlYWxJbkZvbGRlciwgY29weVRleHQsXG4gIGNvbGxhcHNpYmxlQ2FyZCxcbn0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQge1xuICBzaG93QWxlcnQsIGNsb3NlQWxlcnRNb2RhbCwgc2hvd0NvbmZpcm0sIF9jb25maXJtQ2FuY2VsLFxuICBvcGVuQWN0aW9uc01vZGFsLCBjbG9zZUFjdGlvbnNNb2RhbCwgdG9wbW9zdFZpc2libGVNb2RhbCwgX21lbnVBcnJvd0tleWRvd24sXG4gIGlzSGFtYnVyZ2VyT3BlbiwgdG9nZ2xlSGFtYnVyZ2VyLCBjbG9zZUhhbWJ1cmdlcixcbiAgb3BlbkNvbnRyb2xzTW9kYWwsIGNsb3NlQ29udHJvbHNNb2RhbCxcbiAgb3BlbkRpZmZNb2RhbCwgX2RpZmZEaXNjYXJkLFxuICBvcGVuRmllbGRFZGl0TW9kYWwsIGNsb3NlRmllbGRFZGl0TW9kYWwsXG4gIGNsb3NlS2ViYWIsIHNob3dLZWJhYiwgaW5pdFJlc2l6ZSwgX2FwcGx5UHJlcmVxV2FybmluZ3MsIHNob3dVbmRvVG9hc3QsXG4gIHBsYXliYWNrUmF0ZVByZWYsIGFwcGx5UGxheWJhY2tSYXRlLCBpbml0UGxheWJhY2tSYXRlLFxufSBmcm9tICcuL3VpLmpzJztcbmltcG9ydCB7XG4gIG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsLCBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWwsXG4gIG9wZW5BYm91dE1vZGFsLCBjbG9zZUFib3V0TW9kYWwsXG4gIG9wZW5IZWxwTW9kYWwsIGNsb3NlSGVscE1vZGFsLFxuICBvcGVuR2xvc3NhcnlNb2RhbCwgY2xvc2VHbG9zc2FyeU1vZGFsLCBfZmlsdGVyR2xvc3NhcnksXG59IGZyb20gJy4vaGVscG1vZGFscy5qcyc7XG4vLyBzaG9ydGN1dHMuanMgaGFzIG5vIHB1YmxpYyBzdXJmYWNlIChpdHMgb25seSBleHBvcnQgaXMgdGhlIGtleWRvd24gbGlzdGVuZXJcbi8vIHJlZ2lzdHJhdGlvbikgLSBhIGJhcmUgc2lkZS1lZmZlY3QgaW1wb3J0IHJlZ2lzdGVycyB0aGUgZ2xvYmFsIGhhbmRsZXJcbi8vIHdpdGhvdXQgYWRkaW5nIGFueXRoaW5nIHRvIHRoZSB3aW5kb3cgc2hpbS5cbmltcG9ydCAnLi9zaG9ydGN1dHMuanMnO1xuaW1wb3J0IHtcbiAgX2Vuc3VyZU1vZGVsQ2F0YWxvZywgcmVmcmVzaE1vZGVsQ2F0YWxvZyxcbiAgX3VwZGF0ZUxsbUNhcGFiaWxpdGllcywgX3JlbmRlckNhcGFiaWxpdHlUaWVycyxcbiAgZ2F0ZU9uQ2FwYWJpbGl0eSxcbn0gZnJvbSAnLi9tb2RlbGNhdGFsb2cuanMnO1xuaW1wb3J0IHtcbiAgbG9hZFZpZGVvcywgc2VsZWN0VmlkZW8sIHJlbmRlclZpZGVvRGV0YWlsLCBkZWxldGVWaWRlbyxcbiAgb25DbGlwc1NvcnRDaGFuZ2UsIF9jbGlwc1NvcnRQYXJhbSwgX2NsaXBzTGlzdFVybCxcbiAgX3JlYW5hbHl6ZVBhcmFtcyxcbiAgX25lZWRzTW9kZWxDdGFIVE1MLFxuICBfdXBkYXRlRGVtb0J1dHRvbiwgX3VwZGF0ZVN0YXJ0SW5nZXN0QnV0dG9uLFxuICBfYW5hbHlzaXNMaXZlUGFuZWxIVE1MLCBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsLFxuICBfYXBwbHlWaWRlb0ZpbHRlcnMsIF9yZW5kZXJWaWRlb0xpc3QsXG4gIHNldFZpZGVvU2VhcmNoLCBzZXRWaWRlb1NvcnQsIHRvZ2dsZVZpZGVvU29ydERpciwgdG9nZ2xlVmlkZW9GaWx0ZXIsXG4gIG9wZW5WaWRlb0FjdGlvbnNNb2RhbCxcbn0gZnJvbSAnLi92aWRlb3MuanMnO1xuXG53aW5kb3cuQXBwU3RhdGUgPSBBcHBTdGF0ZTtcbk9iamVjdC5hc3NpZ24od2luZG93LCBmb3JtYXQpO1xud2luZG93LkNvbG9yUGlja2VyID0gQ29sb3JQaWNrZXI7XG53aW5kb3cuUGFuZWxOYXYgPSBQYW5lbE5hdjtcbi8vIHV0aWxzLmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBldmVyeSBuYW1lIGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljXG4vLyAoYnVuZGxlLmpzKSBjb25zdW1lciwgb3IgKGNsZWFyTG9nLCBfZGlhcml6YXRpb25SZWFzb24sIF9kaWFyaXphdGlvbk5vdGVIdG1sKSBhXG4vLyB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5IHBhZ2UuZXZhbHVhdGUuIHRvZ2dsZUxvZyBhbmQgaXNDYXJkQ29sbGFwc2VkIGRyb3BwZWQ6XG4vLyB0aGVpciBvbmx5IGNvbnN1bWVycyB3ZXJlIHV0aWxzLmpzJ3Mgb3duIGlubGluZSBoYW5kbGVyIChub3cgYWRkRXZlbnRMaXN0ZW5lcilcbi8vIGFuZCBpdHMgb3duIGNvbGxhcHNpYmxlQ2FyZCwgcmVzcGVjdGl2ZWx5Llxud2luZG93Ll9zeW5jU29ydERpckJ0biA9IF9zeW5jU29ydERpckJ0bjtcbndpbmRvdy5fZGlhcml6YXRpb25SZWFzb24gPSBfZGlhcml6YXRpb25SZWFzb247XG53aW5kb3cuX2RpYXJpemF0aW9uUmVhZGluZXNzID0gX2RpYXJpemF0aW9uUmVhZGluZXNzO1xud2luZG93Ll9kaWFyaXphdGlvbk5vdGVIdG1sID0gX2RpYXJpemF0aW9uTm90ZUh0bWw7XG53aW5kb3cub3BlbkxvZyA9IG9wZW5Mb2c7XG53aW5kb3cuY2xlYXJMb2cgPSBjbGVhckxvZztcbndpbmRvdy5hcHBlbmRMb2cgPSBhcHBlbmRMb2c7XG53aW5kb3cuc2hvd1RvYXN0ID0gc2hvd1RvYXN0O1xud2luZG93Lm5ldEVyck1zZyA9IG5ldEVyck1zZztcbndpbmRvdy5yZXZlYWxJbkZvbGRlciA9IHJldmVhbEluRm9sZGVyO1xud2luZG93LmNvcHlUZXh0ID0gY29weVRleHQ7XG53aW5kb3cuY29sbGFwc2libGVDYXJkID0gY29sbGFwc2libGVDYXJkO1xuLy8gam9icy5qcyBpcyBjcm9zcy1jdXR0aW5nIC0gZXZlcnkgZXhwb3J0IGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljXG4vLyAoYnVuZGxlLmpzKSBjb25zdW1lciBvciBhIHN0aWxsLXByZXNlbnQgaW5saW5lIGhhbmRsZXIsIHNvIG5vbmUgb2YgdGhlc2UgY2FuXG4vLyBiZSBkcm9wcGVkIHlldC4gSXRzIGhhbmRmdWwgb2YgbXV0YWJsZSBzaGFyZWQtc3RhdGUgZ2xvYmFscyAoX2pvYlN0ZXBEZWZzLFxuLy8gX2FjdGl2ZUVTLCBldGMuKSBhcmUgTk9UIGhlcmUgLSBqb2JzLmpzIHdpcmVzIHRob3NlIG9udG8gd2luZG93IGl0c2VsZiB2aWFcbi8vIGxpdmUgZ2V0L3NldCBhY2Nlc3NvcnMsIHNpbmNlIGEgcGxhaW4gc25hcHNob3Qgd291bGQgZ28gc3RhbGUgb24gcmVhc3NpZ25tZW50LlxuT2JqZWN0LmFzc2lnbih3aW5kb3csIGpvYnMpO1xuLy8gcHJldmlldy5qcyBpcyBjcm9zcy1jdXR0aW5nIC0gc2V0dXBSZWNvcmRpbmdQcmV2aWV3IGhhcyBjbGFzc2ljIGNvbnN1bWVyc1xuLy8gKGNsaXBjcmVhdGUuanMsIHZpZGVvcy5qcywgc3BsaXQuanMsIGV4cG9ydGVkaXRvci5qcyk7IF9idWlsZE1lZGlhVXJsIGhhcyBub1xuLy8gSlMgY29uc3VtZXIgbGVmdCBidXQgdGVzdHMvdWkvdGVzdF91aV92aWRlby5weSBldmFsdWF0ZXMgaXQgYXMgYSBwYWdlIGdsb2JhbC5cbndpbmRvdy5fYnVpbGRNZWRpYVVybCA9IF9idWlsZE1lZGlhVXJsO1xud2luZG93LnNldHVwUmVjb3JkaW5nUHJldmlldyA9IHNldHVwUmVjb3JkaW5nUHJldmlldztcbi8vIHVpLmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBldmVyeSBuYW1lIGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljXG4vLyAoYnVuZGxlLmpzKSBjb25zdW1lciwgYW4gYWxyZWFkeS1FU00gY2FsbGVyIChqb2JzLmpzL3BhbmVsbmF2LmpzJ3Ncbi8vIHdpbmRvdy5zaG93Q29uZmlybSksIG9yIGEgdGVzdHMvdWkvKi5weSBwYWdlLmV2YWx1YXRlLiBfY29uZmlybU9rLFxuLy8gX2RpZmZBY2NlcHROZXcsIF9kaWZmQWNjZXB0RWRpdCBhbmQgX2ZpZWxkRWRpdFNhdmUgZHJvcHBlZDogdGhlaXIgb25seVxuLy8gY29uc3VtZXJzIHdlcmUgdWkuanMncyBvd24gaW5saW5lIGhhbmRsZXJzLCBub3cgYWRkRXZlbnRMaXN0ZW5lciBpbnNpZGVcbi8vIHVpLmpzIGl0c2VsZiwgc28gbm90aGluZyBvdXRzaWRlIHRoZSBtb2R1bGUgbmVlZHMgdGhlbSBvZmYgd2luZG93IGFueW1vcmUuXG53aW5kb3cuc2hvd0FsZXJ0ID0gc2hvd0FsZXJ0O1xud2luZG93LmNsb3NlQWxlcnRNb2RhbCA9IGNsb3NlQWxlcnRNb2RhbDtcbndpbmRvdy5zaG93Q29uZmlybSA9IHNob3dDb25maXJtO1xud2luZG93Ll9jb25maXJtQ2FuY2VsID0gX2NvbmZpcm1DYW5jZWw7XG53aW5kb3cub3BlbkFjdGlvbnNNb2RhbCA9IG9wZW5BY3Rpb25zTW9kYWw7XG53aW5kb3cuY2xvc2VBY3Rpb25zTW9kYWwgPSBjbG9zZUFjdGlvbnNNb2RhbDtcbndpbmRvdy50b3Btb3N0VmlzaWJsZU1vZGFsID0gdG9wbW9zdFZpc2libGVNb2RhbDtcbndpbmRvdy5fbWVudUFycm93S2V5ZG93biA9IF9tZW51QXJyb3dLZXlkb3duO1xud2luZG93LmlzSGFtYnVyZ2VyT3BlbiA9IGlzSGFtYnVyZ2VyT3BlbjtcbndpbmRvdy50b2dnbGVIYW1idXJnZXIgPSB0b2dnbGVIYW1idXJnZXI7XG53aW5kb3cuY2xvc2VIYW1idXJnZXIgPSBjbG9zZUhhbWJ1cmdlcjtcbndpbmRvdy5vcGVuQ29udHJvbHNNb2RhbCA9IG9wZW5Db250cm9sc01vZGFsO1xud2luZG93LmNsb3NlQ29udHJvbHNNb2RhbCA9IGNsb3NlQ29udHJvbHNNb2RhbDtcbndpbmRvdy5vcGVuRGlmZk1vZGFsID0gb3BlbkRpZmZNb2RhbDtcbndpbmRvdy5fZGlmZkRpc2NhcmQgPSBfZGlmZkRpc2NhcmQ7XG53aW5kb3cub3BlbkZpZWxkRWRpdE1vZGFsID0gb3BlbkZpZWxkRWRpdE1vZGFsO1xud2luZG93LmNsb3NlRmllbGRFZGl0TW9kYWwgPSBjbG9zZUZpZWxkRWRpdE1vZGFsO1xud2luZG93LmNsb3NlS2ViYWIgPSBjbG9zZUtlYmFiO1xud2luZG93LnNob3dLZWJhYiA9IHNob3dLZWJhYjtcbndpbmRvdy5pbml0UmVzaXplID0gaW5pdFJlc2l6ZTtcbndpbmRvdy5fYXBwbHlQcmVyZXFXYXJuaW5ncyA9IF9hcHBseVByZXJlcVdhcm5pbmdzO1xud2luZG93LnNob3dVbmRvVG9hc3QgPSBzaG93VW5kb1RvYXN0O1xud2luZG93LnBsYXliYWNrUmF0ZVByZWYgPSBwbGF5YmFja1JhdGVQcmVmO1xud2luZG93LmFwcGx5UGxheWJhY2tSYXRlID0gYXBwbHlQbGF5YmFja1JhdGU7XG53aW5kb3cuaW5pdFBsYXliYWNrUmF0ZSA9IGluaXRQbGF5YmFja1JhdGU7XG4vLyBoZWxwbW9kYWxzLmpzIC0gZXZlcnkgbmFtZSBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpYyAoYnVuZGxlLmpzKVxuLy8gY29uc3VtZXIgKGJvb3QuanMsIHZpZGVvcy5qcywgc2hvcnRjdXRzLmpzLCBzZXR0aW5ncy5qcyBjYWxsIHRoZXNlIGFzIGJhcmVcbi8vIGdsb2JhbHMpIG9yIGEgdGVzdHMvdWkvKi5weSBwYWdlLmV2YWx1YXRlLCBzbyBub25lIGNhbiBiZSBkcm9wcGVkIHlldC5cbndpbmRvdy5vcGVuR2V0dGluZ1N0YXJ0ZWRNb2RhbCA9IG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsO1xud2luZG93LmNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCA9IGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbDtcbndpbmRvdy5vcGVuQWJvdXRNb2RhbCA9IG9wZW5BYm91dE1vZGFsO1xud2luZG93LmNsb3NlQWJvdXRNb2RhbCA9IGNsb3NlQWJvdXRNb2RhbDtcbndpbmRvdy5vcGVuSGVscE1vZGFsID0gb3BlbkhlbHBNb2RhbDtcbndpbmRvdy5jbG9zZUhlbHBNb2RhbCA9IGNsb3NlSGVscE1vZGFsO1xud2luZG93Lm9wZW5HbG9zc2FyeU1vZGFsID0gb3Blbkdsb3NzYXJ5TW9kYWw7XG53aW5kb3cuY2xvc2VHbG9zc2FyeU1vZGFsID0gY2xvc2VHbG9zc2FyeU1vZGFsO1xud2luZG93Ll9maWx0ZXJHbG9zc2FyeSA9IF9maWx0ZXJHbG9zc2FyeTtcbi8vIG1vZGVsY2F0YWxvZy5qcyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWMgKGJ1bmRsZS5qcylcbi8vIGNvbnN1bWVyOiBzZXR0aW5ncy5qcyBjYWxscyBfZW5zdXJlTW9kZWxDYXRhbG9nL3JlZnJlc2hNb2RlbENhdGFsb2cvXG4vLyBfdXBkYXRlTGxtQ2FwYWJpbGl0aWVzL19yZW5kZXJDYXBhYmlsaXR5VGllcnMgYXMgYmFyZSBnbG9iYWxzLCBtb2RlbGRvd25sb2FkLmpzXG4vLyBjaGVja3MvY2FsbHMgX3VwZGF0ZUxsbUNhcGFiaWxpdGllcy9fcmVuZGVyQ2FwYWJpbGl0eVRpZXJzLCBhbmQgY2xpcHMuanMgY2FsbHNcbi8vIGdhdGVPbkNhcGFiaWxpdHkgKGFsc28gcmVhZCBkaXJlY3RseSBieSB0ZXN0cy91aS90ZXN0X3VpX21vZGVsX2NhdGFsb2cucHkgdmlhXG4vLyBwYWdlLmV2YWx1YXRlKS4gcHJlZmV0Y2hNb2RlbCBhbmQgZG93bmxvYWRHZ3VmTW9kZWwgZHJvcHBlZDogYm90aCBhcmUgd2lyZWRcbi8vIGludGVybmFsbHkgdmlhIGFkZEV2ZW50TGlzdGVuZXIvZGF0YS0qIGRlbGVnYXRpb24gYW5kIGhhdmUgbm8gb3V0c2lkZSBjYWxsZXIuXG53aW5kb3cuX2Vuc3VyZU1vZGVsQ2F0YWxvZyA9IF9lbnN1cmVNb2RlbENhdGFsb2c7XG53aW5kb3cucmVmcmVzaE1vZGVsQ2F0YWxvZyA9IHJlZnJlc2hNb2RlbENhdGFsb2c7XG53aW5kb3cuX3VwZGF0ZUxsbUNhcGFiaWxpdGllcyA9IF91cGRhdGVMbG1DYXBhYmlsaXRpZXM7XG53aW5kb3cuX3JlbmRlckNhcGFiaWxpdHlUaWVycyA9IF9yZW5kZXJDYXBhYmlsaXR5VGllcnM7XG53aW5kb3cuZ2F0ZU9uQ2FwYWJpbGl0eSA9IGdhdGVPbkNhcGFiaWxpdHk7XG4vLyB2aWRlb3MuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyIG9yIGEgdGVzdHMvdWkvKi5weSBwYWdlLmV2YWx1YXRlLiBfY2xpcHNTb3J0UGFyYW0gaXNcbi8vIENSSVRJQ0FMOiBmb3JtYXQuanMgKGFscmVhZHkgRVNNKSByZWFkcyBpdCBhcyB3aW5kb3cuX2NsaXBzU29ydFBhcmFtLCBzbyBpdFxuLy8gY2FuIG5ldmVyIGJlIGRyb3BwZWQgZXZlbiBpZiBldmVyeSBjbGFzc2ljIGNvbnN1bWVyIGdvZXMgYXdheS4gRWxldmVuIG5hbWVzXG4vLyAocmVhbmFseXplVmlkZW8sIHJlZGlhcml6ZVZpZGVvLCByZWV4dHJhY3RWaWRlb1J1biwgcmV0cmFuc2NyaWJlVmlkZW9SdW4sXG4vLyByZWdlbmVyYXRlQ2xpcHNSdW4sIHVuc3BsaXRWaWRlbywgX2RvVW5zcGxpdFZpZGVvLCBvcGVuVmlkZW9TdW1tYXJ5S2ViYWIsXG4vLyBvcGVuVmlkZW9UaXRsZUtlYmFiLCBfc3luY1ZpZGVvRmlsdGVyQ2hpcHMsIF9jbGVhclZpZGVvRmlsdGVycykgZHJvcHBlZDogdGhlaXJcbi8vIG9ubHkgY2FsbGVycyB3ZXJlIHZpZGVvcy5qcydzIG93biBpbmxpbmUgaGFuZGxlcnMgKG5vdyBkYXRhLWFjdCBkZWxlZ2F0aW9uKSBvclxuLy8gaXRzIG93biBpbnRlcm5hbCBsb2dpYywgc28gbm90aGluZyBvdXRzaWRlIHRoZSBtb2R1bGUgbmVlZHMgdGhlbSBvZmYgd2luZG93Llxud2luZG93LmxvYWRWaWRlb3MgPSBsb2FkVmlkZW9zO1xud2luZG93LnNlbGVjdFZpZGVvID0gc2VsZWN0VmlkZW87XG53aW5kb3cucmVuZGVyVmlkZW9EZXRhaWwgPSByZW5kZXJWaWRlb0RldGFpbDtcbndpbmRvdy5kZWxldGVWaWRlbyA9IGRlbGV0ZVZpZGVvO1xud2luZG93Lm9uQ2xpcHNTb3J0Q2hhbmdlID0gb25DbGlwc1NvcnRDaGFuZ2U7XG53aW5kb3cuX2NsaXBzU29ydFBhcmFtID0gX2NsaXBzU29ydFBhcmFtO1xud2luZG93Ll9jbGlwc0xpc3RVcmwgPSBfY2xpcHNMaXN0VXJsO1xud2luZG93Ll9yZWFuYWx5emVQYXJhbXMgPSBfcmVhbmFseXplUGFyYW1zO1xud2luZG93Ll9uZWVkc01vZGVsQ3RhSFRNTCA9IF9uZWVkc01vZGVsQ3RhSFRNTDtcbndpbmRvdy5fdXBkYXRlRGVtb0J1dHRvbiA9IF91cGRhdGVEZW1vQnV0dG9uO1xud2luZG93Ll91cGRhdGVTdGFydEluZ2VzdEJ1dHRvbiA9IF91cGRhdGVTdGFydEluZ2VzdEJ1dHRvbjtcbndpbmRvdy5fYW5hbHlzaXNMaXZlUGFuZWxIVE1MID0gX2FuYWx5c2lzTGl2ZVBhbmVsSFRNTDtcbndpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsID0gX3N5bmNBbmFseXNpc0xpdmVQYW5lbDtcbndpbmRvdy5fYXBwbHlWaWRlb0ZpbHRlcnMgPSBfYXBwbHlWaWRlb0ZpbHRlcnM7XG53aW5kb3cuX3JlbmRlclZpZGVvTGlzdCA9IF9yZW5kZXJWaWRlb0xpc3Q7XG53aW5kb3cuc2V0VmlkZW9TZWFyY2ggPSBzZXRWaWRlb1NlYXJjaDtcbndpbmRvdy5zZXRWaWRlb1NvcnQgPSBzZXRWaWRlb1NvcnQ7XG53aW5kb3cudG9nZ2xlVmlkZW9Tb3J0RGlyID0gdG9nZ2xlVmlkZW9Tb3J0RGlyO1xud2luZG93LnRvZ2dsZVZpZGVvRmlsdGVyID0gdG9nZ2xlVmlkZW9GaWx0ZXI7XG53aW5kb3cub3BlblZpZGVvQWN0aW9uc01vZGFsID0gb3BlblZpZGVvQWN0aW9uc01vZGFsO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7QUFNTyxNQUFNLFdBQVc7QUFBQSxJQUN0QixlQUFxQjtBQUFBLElBQ3JCLGNBQXFCO0FBQUEsSUFDckIsUUFBcUIsQ0FBQztBQUFBLElBQ3RCLFVBQXFCLENBQUM7QUFBQTtBQUFBLElBQ3RCLGlCQUFxQjtBQUFBO0FBQUEsSUFDckIsT0FBcUIsQ0FBQztBQUFBLElBQ3RCLGlCQUFxQixDQUFDO0FBQUEsSUFDdEIsVUFBcUIsQ0FBQztBQUFBLElBQ3RCLFVBQXFCLENBQUM7QUFBQSxJQUN0QixpQkFBcUI7QUFBQSxJQUNyQixnQkFBcUIsQ0FBQztBQUFBLElBQ3RCLHVCQUF1QjtBQUFBLElBQ3ZCLGlCQUFxQjtBQUFBLElBQ3JCLGtCQUFxQjtBQUFBLElBQ3JCLGFBQXFCLG9CQUFJLElBQUk7QUFBQTtBQUFBLElBQzdCLFVBQXFCO0FBQUE7QUFBQSxJQUNyQixZQUFxQjtBQUFBLElBQ3JCLGNBQXFCO0FBQUEsSUFDckIsYUFBcUI7QUFBQSxJQUNyQixXQUFxQjtBQUFBLElBQ3JCLGNBQXFCO0FBQUE7QUFBQSxJQUNyQixhQUFxQjtBQUFBLElBQ3JCLGNBQXFCLG9CQUFJLElBQUk7QUFBQTtBQUFBLElBQzdCLGlCQUFxQixvQkFBSSxJQUFJO0FBQUEsSUFDN0Isa0JBQXFCO0FBQUE7QUFBQSxJQUNyQixzQkFBc0I7QUFBQTtBQUFBLElBQ3RCLGlCQUFxQjtBQUFBLElBQ3JCLGdCQUFxQjtBQUFBLElBQ3JCLFVBQXFCLENBQUM7QUFBQTtBQUFBO0FBQUEsSUFFdEIscUJBQXFCO0FBQUEsSUFDckIsaUJBQXFCO0FBQUEsSUFDckIsaUJBQXFCO0FBQUEsSUFDckIsV0FBcUI7QUFBQSxJQUNyQixVQUFxQjtBQUFBLElBQ3JCLFdB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QU8saUJBQWlCO0FBQ3hCLFNBQU8sV0FBVztBQUNsQixTQUFPLGtCQUFrQjtBQU16QixTQUFPLE9BQU8sUUFBUSxZQUFJO0FBSTFCLFNBQU8saUJBQWlCO0FBQ3hCLFNBQU8sd0JBQXdCO0FBTy9CLFNBQU8sWUFBWTtBQUNuQixTQUFPLGtCQUFrQjtBQUN6QixTQUFPLGNBQWM7QUFDckIsU0FBTyxpQkFBaUI7QUFDeEIsU0FBTyxtQkFBbUI7QUFDMUIsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyxzQkFBc0I7QUFDN0IsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyxrQkFBa0I7QUFDekIsU0FBTyxrQkFBa0I7QUFDekIsU0FBTyxpQkFBaUI7QUFDeEIsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyxxQkFBcUI7QUFDNUIsU0FBTyxnQkFBZ0I7QUFDdkIsU0FBTyxlQUFlO0FBQ3RCLFNBQU8scUJBQXFCO0FBQzVCLFNBQU8sc0JBQXNCO0FBQzdCLFNBQU8sYUFBYTtBQUNwQixTQUFPLFlBQVk7QUFDbkIsU0FBTyxhQUFhO0FBQ3BCLFNBQU8sdUJBQXVCO0FBQzlCLFNBQU8sZ0JBQWdCO0FBQ3ZCLFNBQU8sbUJBQW1CO0FBQzFCLFNBQU8sb0JBQW9CO0FBQzNCLFNBQU8sbUJBQW1CO0FBSTFCLFNBQU8sMEJBQTBCO0FBQ2pDLFNBQU8sMkJBQTJCO0FBQ2xDLFNBQU8saUJBQWlCO0FBQ3hCLFNBQU8sa0JBQWtCO0FBQ3pCLFNBQU8sZ0JBQWdCO0FBQ3ZCLFNBQU8saUJBQWlCO0FBQ3hCLFNBQU8sb0JBQW9CO0FBQzNCLFNBQU8scUJBQXFCO0FBQzVCLFNBQU8sa0JBQWtCO0FBUXpCLFNBQU8sc0JBQXNCO0FBQzdCLFNBQU8sc0JBQXNCO0FBQzdCLFNBQU8seUJBQXlCO0FBQ2hDLFNBQU8seUJBQXlCO0FBQ2hDLFNBQU8sbUJBQW1CO0FBVTFCLFNBQU8sYUFBYTtBQUNwQixTQUFPLGNBQWM7QUFDckIsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyxjQUFjO0FBQ3JCLFNBQU8sb0JBQW9CO0FBQzNCLFNBQU8sa0JBQWtCO0FBQ3pCLFNBQU8sZ0JBQWdCO0FBQ3ZCLFNBQU8sbUJBQW1CO0FBQzFCLFNBQU8scUJBQXFCO0FBQzVCLFNBQU8sb0JBQW9CO0FBQzNCLFNBQU8sMkJBQTJCO0FBQ2xDLFNBQU8seUJBQXlCO0FBQ2hDLFNBQU8seUJBQXlCQztBQUNoQyxTQUFPLHFCQUFxQjtBQUM1QixTQUFPLG1CQUFtQjtBQUMxQixTQUFPLGlCQUFpQjtBQUN4QixTQUFPLGVBQWU7QUFDdEIsU0FBTyxxQkFBcUI7QUFDNUIsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyx3QkFBd0I7IiwKICAibmFtZXMiOiBbImVsIiwgIl9CR19ESVNNSVNTX01PREFMUyIsICJfd2lyZU1vZGFsQmdEaXNtaXNzYWxzIiwgIl93aXJlTW9kYWxCdXR0b25zIiwgIl93aXJlSGFtYnVyZ2VySGFuZGxlcnMiLCAiX3N5bmNBbmFseXNpc0xpdmVQYW5lbCIsICJfc3luY0FuYWx5c2lzTGl2ZVBhbmVsIl0KfQo=
