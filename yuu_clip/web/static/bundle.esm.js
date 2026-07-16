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

  // yuu_clip/web/static/main.esm.js
  window.AppState = AppState;
  Object.assign(window, format_exports);
  window.ColorPicker = ColorPicker;
  window.PanelNav = PanelNav;
  Object.assign(window, jobs_exports);
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3RhdGUuanMiLCAiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgImpvYnMuanMiLCAibWFpbi5lc20uanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIEZlYXR1cmUtbWFwIC0gU2hhcmVkIGFwcGxpY2F0aW9uIHN0YXRlOiB0aGUgc2luZ2xlIEFwcFN0YXRlIG9iamVjdCBldmVyeSBmZWF0dXJlIG1vZHVsZSByZWFkcy93cml0ZXMuXG4vLyAgIEFQSTogbm9uZSAoY2xpZW50LW9ubHkpIMK3IFRlc3RzOiBjb3ZlcmVkIGluZGlyZWN0bHkgYnkgdGhlIHRlc3RfdWlfKi5weSBzdWl0ZXNcbi8vIOKUgOKUgCBzaGFyZWQgYXBwbGljYXRpb24gc3RhdGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBNdXRhYmxlIHN0YXRlIHNoYXJlZCBhY3Jvc3MgZmVhdHVyZSBtb2R1bGVzLiBDZW50cmFsaXplZCBpbiBvbmUgZXhwbGljaXQgb2JqZWN0XG4vLyBzbyBjcm9zcy1tb2R1bGUgcmVhZHMvd3JpdGVzIGFyZSBncmVwcGFibGUgYW5kIG9idmlvdXNseSBzaGFyZWQsIHJhdGhlciB0aGFuXG4vLyBzY2F0dGVyZWQgYmFyZSBnbG9iYWxzIHRoYXQgbG9vayBsaWtlIG1vZHVsZSBsb2NhbHMgYXQgdGhlIGNhbGwgc2l0ZS5cbmV4cG9ydCBjb25zdCBBcHBTdGF0ZSA9IHtcbiAgYWN0aXZlVmlkZW9JZDogICAgICAgbnVsbCxcbiAgYWN0aXZlQ2xpcElkOiAgICAgICAgbnVsbCxcbiAgdmlkZW9zOiAgICAgICAgICAgICAgW10sXG4gIHNlc3Npb25zOiAgICAgICAgICAgIFtdLCAgICAgICAvLyBncm91cGVkIHBsYXkgc2Vzc2lvbnMgKFJlY29yZGluZ1Nlc3Npb24gcm93cylcbiAgYWN0aXZlU2Vzc2lvbklkOiAgICAgbnVsbCwgICAgIC8vIHNlc3Npb24gd2hvc2UgZGV0YWlsIHZpZXcgaXMgb3Blbiwgb3IgbnVsbFxuICBjbGlwczogICAgICAgICAgICAgICBbXSxcbiAgYW5hbHl6ZVByb2ZpbGVzOiAgICAgW10sXG4gIGNvbnRleHRzOiAgICAgICAgICAgIFtdLFxuICBob3RXb3JkczogICAgICAgICAgICBbXSxcbiAgX2hvdFdvcmRzTG9hZGVkOiAgICAgZmFsc2UsXG4gIHNlbnNpdGl2ZVRlcm1zOiAgICAgIFtdLFxuICBfc2Vuc2l0aXZlVGVybXNMb2FkZWQ6IGZhbHNlLFxuICBhbmFseXplRmlsZW5hbWU6ICAgICBudWxsLFxuICBlZGl0aW5nQ29udGV4dElkOiAgICBudWxsLFxuICBjbGlwRmlsdGVyczogICAgICAgICBuZXcgU2V0KCksICAvLyBhY3RpdmUgZmlsdGVyIHRva2VuczsgZW1wdHkgPSBzaG93IGFsbFxuICBjbGlwS2luZDogICAgICAgICAgICAnY2xpcCcsICAgICAgLy8gY2FuZGlkYXRlIHR5cGUgc2hvd246ICdjbGlwJyB8ICdzY2VuZScgKHNlcnZlci1zaWRlIGZpbHRlcilcbiAgY2xpcFNlYXJjaDogICAgICAgICAgJycsXG4gIGNsaXBTY29yZU1pbjogICAgICAgIDAsXG4gIHZpZGVvU2VhcmNoOiAgICAgICAgICcnLFxuICB2aWRlb1NvcnQ6ICAgICAgICAgICAncmVjZW50JyxcbiAgdmlkZW9Tb3J0RGlyOiAgICAgICAgJ2Rlc2MnLCAgLy8gJ2Rlc2MnID0gdGhlIHNvcnQgb3B0aW9uJ3MgbmF0dXJhbCBvcmRlcjsgJ2FzYycgcmV2ZXJzZXMgaXRcbiAgY2xpcFNvcnREaXI6ICAgICAgICAgJ2Rlc2MnLFxuICB2aWRlb0ZpbHRlcnM6ICAgICAgICBuZXcgU2V0KCksICAvLyBhY3RpdmUgdmlkZW8gZmlsdGVyIHRva2VuczsgZW1wdHkgPSBzaG93IGFsbFxuICBzZWxlY3RlZENsaXBJZHM6ICAgICBuZXcgU2V0KCksXG4gIGxhc3RTdGF0dXNDaGFuZ2U6ICAgIG51bGwsIC8vIHtjbGlwSWQsIGZyb21TdGF0dXMsIHRpbWVyfVxuICBsYXN0QnVsa1N0YXR1c0NoYW5nZTogbnVsbCwgLy8ge3ByZXZpb3VzOiB7Y2xpcElkOiBmcm9tU3RhdHVzfSwgdGltZXJ9XG4gIGNvbmZpcm1DYWxsYmFjazogICAgIG51bGwsXG4gIGFjdGl2ZUNsaXBEYXRhOiAgICAgIG51bGwsXG4gIGNsaXBKb2JzOiAgICAgICAgICAgIHt9LCAgIC8vIGNsaXBJZCAtPiB7b3B9IGZvciBhIHBlci1jbGlwIGFzeW5jIGpvYiBpbiBmbGlnaHQgKGFuYWx5emUtZnJhbWVzKSwgc28gaXRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluZGljYXRvciBzdXJ2aXZlcyBhIHJlbmRlckRldGFpbCByZWJ1aWxkIC8gY2xpcCBzd2l0Y2ggKHN0YXRlLCBub3QgYSBET00gbm9kZSlcbiAgYWN0aXZlTWVkaWFGaWxlbmFtZTogbnVsbCxcbiAgYWN0aXZlVmlkZW9EYXRhOiAgICAgbnVsbCxcbiAgYm9vdFJlc3RvcmVEb25lOiAgICAgZmFsc2UsXG4gIGV4cG9ydERpcjogICAgICAgICAgIG51bGwsXG4gIHJlZWxzRGlyOiAgICAgICAgICAgIG51bGwsXG4gIGNhblJldmVhbDogICAgICAgICAgIGZhbHNlLFxufTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFB1cmUgZm9ybWF0dGVycyBhbmQgc2NvcmUgaGVscGVyczogbm8gRE9NLCBubyBmZXRjaC4gSFRNTC1lc2NhcGUsIEFQSS1lcnJvciB0ZXh0LFxyXG4vLyAgIGR1cmF0aW9uL2RhdGUvb2Zmc2V0IGZvcm1hdHRpbmcsIHZpZGVvLXN0YXR1cyBsYWJlbHMsIGFuZCB0aGUgc2NvcmUgY29sb3IvaWNvbiBlbmNvZGluZy5cclxuLy8gICBBUEk6IG5vbmUgKGNsaWVudC1vbmx5KSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV91dGlscy5weVxyXG4vLyDilIDilIAgc2NvcmUgdXRpbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmZ1bmN0aW9uIF9zY29yZUljb24oc2NvcmUpIHtcclxuICBjb25zdCBjb2xvciA9IHNjb3JlID49IDAuNyA/ICd2YXIoLS1ncmVlbiknIDogc2NvcmUgPj0gMC40ID8gJ3ZhcigtLXdhcm5pbmcpJyA6ICd2YXIoLS1tdXRlZCknO1xyXG4gIHJldHVybiBgPHNwYW4gc3R5bGU9XCJjb2xvcjoke2NvbG9yfTtmb250LXNpemU6MTBweFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPiYjMTEwODg7PC9zcGFuPmA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9sZXJwQ29sb3IoYzEsIGMyLCB0KSB7XHJcbiAgY29uc3QgaCA9IGMgPT4gW3BhcnNlSW50KGMuc2xpY2UoMSwzKSwxNiksIHBhcnNlSW50KGMuc2xpY2UoMyw1KSwxNiksIHBhcnNlSW50KGMuc2xpY2UoNSw3KSwxNildO1xyXG4gIGNvbnN0IFtyMSxnMSxiMV0gPSBoKGMxKSwgW3IyLGcyLGIyXSA9IGgoYzIpO1xyXG4gIHJldHVybiBgcmdiKCR7TWF0aC5yb3VuZChyMSsocjItcjEpKnQpfSwke01hdGgucm91bmQoZzErKGcyLWcxKSp0KX0sJHtNYXRoLnJvdW5kKGIxKyhiMi1iMSkqdCl9KWA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zY29yZUJvcmRlckNvbG9yKHNjb3JlLCBpc1JlamVjdGVkKSB7XHJcbiAgaWYgKGlzUmVqZWN0ZWQpIHJldHVybiAndmFyKC0tbXV0ZWQpJztcclxuICBjb25zdCBzdG9wcyA9IFtbMCwnIzZiNmI4MCddLFswLjMsJyM0ZmMzZjcnXSxbMC41LCcjNGNhZjdkJ10sWzAuNywnI2YwYzA2MCddLFsxLjAsJyNmN2E4NWEnXV07XHJcbiAgZm9yIChsZXQgaSA9IDE7IGkgPCBzdG9wcy5sZW5ndGg7IGkrKykge1xyXG4gICAgaWYgKHNjb3JlIDw9IHN0b3BzW2ldWzBdKSB7XHJcbiAgICAgIGNvbnN0IHQgPSAoc2NvcmUgLSBzdG9wc1tpLTFdWzBdKSAvIChzdG9wc1tpXVswXSAtIHN0b3BzW2ktMV1bMF0pO1xyXG4gICAgICByZXR1cm4gX2xlcnBDb2xvcihzdG9wc1tpLTFdWzFdLCBzdG9wc1tpXVsxXSwgdCk7XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBzdG9wc1tzdG9wcy5sZW5ndGgtMV1bMV07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zb3J0U2NvcmUoY2xpcCkge1xyXG4gIGNvbnN0IHNvcnQgPSB3aW5kb3cuX2NsaXBzU29ydFBhcmFtKCk7XHJcbiAgaWYgKHNvcnQgPT09ICdmdW5ueScpICAgIHJldHVybiBjbGlwLnNjb3JlX2Z1bm55O1xyXG4gIGlmIChzb3J0ID09PSAnZHJhbWF0aWMnKSByZXR1cm4gY2xpcC5zY29yZV9kcmFtYXRpYztcclxuICBpZiAoc29ydCA9PT0gJ2FjdGlvbicpICAgcmV0dXJuIGNsaXAuc2NvcmVfYWN0aW9uO1xyXG4gIGlmIChzb3J0ID09PSAndmlzdWFsJykgICByZXR1cm4gY2xpcC5zY29yZV92aXN1YWw7XHJcbiAgaWYgKHNvcnQgPT09ICdsYXVnaCcpICAgIHJldHVybiBjbGlwLnNjb3JlX2xhdWdoO1xyXG4gIHJldHVybiBjbGlwLnNjb3JlX292ZXJhbGw7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBmb3JtYXQgdXRpbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmNvbnN0IF9WSURFT19TVEFUVVNfRElTUExBWSA9IHtcclxuICBwZW5kaW5nOiAnTm90IGFuYWx5emVkJywgcHJvYmVkOiAnSW5zcGVjdGVkJywgbGFiZWxlZDogJ1RyYWNrcyBhc3NpZ25lZCcsXHJcbiAgZXh0cmFjdGluZzogJ0V4dHJhY3RpbmcnLCB0cmFuc2NyaWJpbmc6ICdUcmFuc2NyaWJpbmcnLCB0cmFuc2NyaWJlZDogJ1RyYW5zY3JpYmVkJyxcclxuICBzZWdtZW50ZWQ6ICdDbGlwcyBnZW5lcmF0ZWQnLCBkb25lOiAnQW5hbHl6ZWQnLCBmYWlsZWQ6ICdBbmFseXNpcyBpbnRlcnJ1cHRlZCcsXHJcbn07XHJcbmZ1bmN0aW9uIF9mbXRWaWRlb1N0YXR1cyhzKSB7IHJldHVybiBfVklERU9fU1RBVFVTX0RJU1BMQVlbc10gfHwgczsgfVxyXG5cclxuZnVuY3Rpb24gX21zVG9IbXMobXMpIHtcclxuICBjb25zdCBzID0gTWF0aC5mbG9vcihtcyAvIDEwMDApO1xyXG4gIGlmIChzIDwgNjApIHJldHVybiBgJHtzfXNgO1xyXG4gIGNvbnN0IG0gPSBNYXRoLmZsb29yKHMgLyA2MCksIHNlYyA9IHMgJSA2MDtcclxuICBpZiAobSA8IDYwKSByZXR1cm4gYCR7bX1tICR7U3RyaW5nKHNlYykucGFkU3RhcnQoMiwgJzAnKX1zYDtcclxuICBjb25zdCBoID0gTWF0aC5mbG9vcihtIC8gNjApLCBtaW4gPSBtICUgNjA7XHJcbiAgcmV0dXJuIGAke2h9aCAke1N0cmluZyhtaW4pLnBhZFN0YXJ0KDIsICcwJyl9bWA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBsdXJhbChjb3VudCwgc2luZ3VsYXIsIHBsdXJhbEZvcm0pIHtcclxuICByZXR1cm4gYCR7Y291bnR9ICR7Y291bnQgPT09IDEgPyBzaW5ndWxhciA6IChwbHVyYWxGb3JtIHx8IHNpbmd1bGFyICsgJ3MnKX1gO1xyXG59XHJcblxyXG4vLyBTdGFuZGFyZCBndWFyZCBmb3IgYW55IGNvbXB1dGVkIG51bWJlciBzaG93biB0byB0aGUgdXNlcjogcmV0dXJucyAqdmFsdWUqXHJcbi8vIG9ubHkgd2hlbiBpdCBpcyBhIGZpbml0ZSBudW1iZXIsIG90aGVyd2lzZSBhIHBsYWluLUVuZ2xpc2ggKmZhbGxiYWNrKi4gTmFOXHJcbi8vIG9yIEluZmluaXR5IC0gdXN1YWxseSBmcm9tIGFyaXRobWV0aWMgb24gbWlzc2luZy9wYXJ0aWFsIGRhdGEgLSBtdXN0IG5ldmVyXHJcbi8vIHJlYWNoIHRoZSBVSSBhcyB0aGUgbGl0ZXJhbCBcIk5hTlwiL1wiSW5maW5pdHlcIi4gVXNlIHRoaXMgKG9yIGZtdER1cmF0aW9uKSBhdFxyXG4vLyBldmVyeSBkaXNwbGF5IHNpdGUgdGhhdCBmb3JtYXRzIGEgZGVyaXZlZCBudW1iZXIuXHJcbmZ1bmN0aW9uIGZpbml0ZU9yKHZhbHVlLCBmYWxsYmFjayA9ICdOL0EnKSB7XHJcbiAgcmV0dXJuIE51bWJlci5pc0Zpbml0ZSh2YWx1ZSkgPyB2YWx1ZSA6IGZhbGxiYWNrO1xyXG59XHJcblxyXG4vLyBIdW1hbi1yZWFkYWJsZSBjbGlwL3NlZ21lbnQgbGVuZ3RoLiBSZXR1cm5zICpmYWxsYmFjayogZm9yIGEgbm9uLWZpbml0ZVxyXG4vLyBpbnB1dCAoZS5nLiBhIGNsaXAgbWlzc2luZyBpdHMgc3RhcnQvZW5kIHRpbWVzKSByYXRoZXIgdGhhbiBcIk5hTiBzZWNcIi5cclxuZnVuY3Rpb24gZm10RHVyYXRpb24oc2Vjb25kcywgZmFsbGJhY2sgPSAndW5rbm93bicpIHtcclxuICBpZiAoIU51bWJlci5pc0Zpbml0ZShzZWNvbmRzKSkgcmV0dXJuIGZhbGxiYWNrO1xyXG4gIHJldHVybiBzZWNvbmRzID49IDYwID8gYCR7TWF0aC5yb3VuZChzZWNvbmRzIC8gNjApfSBtaW5gIDogYCR7TWF0aC5yb3VuZChzZWNvbmRzKX0gc2VjYDtcclxufVxyXG5cclxuZnVuY3Rpb24gdHJ1bmNhdGUodGV4dCwgbWF4KSB7XHJcbiAgcmV0dXJuIHRleHQubGVuZ3RoID4gbWF4ID8gdGV4dC5zbGljZSgwLCBtYXggLSAxKSArICfigKYnIDogdGV4dDtcclxufVxyXG5cclxuZnVuY3Rpb24gZXNjSHRtbChzKSB7XHJcbiAgcmV0dXJuIFN0cmluZyhzKS5yZXBsYWNlKC8mL2csJyZhbXA7JykucmVwbGFjZSgvPC9nLCcmbHQ7JykucmVwbGFjZSgvPi9nLCcmZ3Q7JykucmVwbGFjZSgvXCIvZywnJnF1b3Q7Jyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZvcm1hdEFwaUVycm9yKGVycikge1xyXG4gIGlmICghZXJyKSByZXR1cm4gJ1Vua25vd24gZXJyb3InO1xyXG4gIGlmICh0eXBlb2YgZXJyLmRldGFpbCA9PT0gJ3N0cmluZycpIHJldHVybiBlcnIuZGV0YWlsO1xyXG4gIGlmIChBcnJheS5pc0FycmF5KGVyci5kZXRhaWwpKSByZXR1cm4gZXJyLmRldGFpbC5tYXAoZSA9PiBlLm1zZyB8fCBKU09OLnN0cmluZ2lmeShlKSkuam9pbignOyAnKTtcclxuICBpZiAoZXJyLm1lc3NhZ2UpIHJldHVybiBlcnIubWVzc2FnZTtcclxuICBjb25zdCBzdHJpbmdpZmllZCA9IEpTT04uc3RyaW5naWZ5KGVycik7XHJcbiAgcmV0dXJuICghc3RyaW5naWZpZWQgfHwgc3RyaW5naWZpZWQgPT09ICd7fScpID8gJ1Vua25vd24gZXJyb3IgKG5vIGRldGFpbHMgZnJvbSBzZXJ2ZXIpJyA6IHN0cmluZ2lmaWVkO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzdHJpcFJpY2hNYXJrdXAodGV4dCkge1xyXG4gIHJldHVybiB0ZXh0XHJcbiAgICAucmVwbGFjZSgvXFx4MWJcXFtbMC05O10qW2EtekEtWl0vZywgJycpICAvLyBBTlNJIGVzY2FwZSBjb2Rlc1xyXG4gICAgLnJlcGxhY2UoL1xcW1xcLz9cXHcrXFxdL2csICcnKTsgICAgICAgICAgICAgLy8gUmljaCBtYXJrdXAgdGFnc1xyXG59XHJcblxyXG4vLyBTZXJ2ZXIgdGltZXN0YW1wcyBhcmUgbmFpdmUgVVRDIChTUUxpdGUgRGF0ZVRpbWUg4oaSIGlzb2Zvcm1hdCgpIHdpdGggbm8gem9uZSkuXHJcbi8vIFRyZWF0IGEgem9uZS1sZXNzIHN0cmluZyBhcyBVVEMgc28gaXQgaXNuJ3QgcGFyc2VkIGFzIHRoZSB2aWV3ZXIncyBsb2NhbCB0aW1lLlxyXG5mdW5jdGlvbiBfcGFyc2VTZXJ2ZXJEYXRlKGlzbykge1xyXG4gIGNvbnN0IGhhc1pvbmUgPSAvW3paXSR8WystXVxcZHsyfTo/XFxkezJ9JC8udGVzdChpc28pO1xyXG4gIHJldHVybiBuZXcgRGF0ZShoYXNab25lID8gaXNvIDogaXNvICsgJ1onKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdERhdGUoaXNvKSB7XHJcbiAgaWYgKCFpc28pIHJldHVybiAnbmV2ZXInO1xyXG4gIGNvbnN0IGQgPSBfcGFyc2VTZXJ2ZXJEYXRlKGlzbyk7XHJcbiAgcmV0dXJuIGQudG9Mb2NhbGVEYXRlU3RyaW5nKHVuZGVmaW5lZCwge21vbnRoOidzaG9ydCcsIGRheTonbnVtZXJpYyd9KSArICcgYXQgJyArXHJcbiAgICBkLnRvTG9jYWxlVGltZVN0cmluZyh1bmRlZmluZWQsIHtob3VyOidudW1lcmljJywgbWludXRlOicyLWRpZ2l0J30pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10QWdvKGlzb1N0cmluZykge1xyXG4gIGNvbnN0IGRpZmZTID0gKERhdGUubm93KCkgLSBfcGFyc2VTZXJ2ZXJEYXRlKGlzb1N0cmluZykuZ2V0VGltZSgpKSAvIDEwMDA7XHJcbiAgaWYgKGRpZmZTIDwgNjApICAgIHJldHVybiAnanVzdCBub3cnO1xyXG4gIGlmIChkaWZmUyA8IDM2MDApICByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDYwKX1tIGFnb2A7XHJcbiAgaWYgKGRpZmZTIDwgODY0MDApIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gMzYwMCl9aCBhZ29gO1xyXG4gIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gODY0MDApfWQgYWdvYDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdE9mZnNldCh2KSB7XHJcbiAgaWYgKCF2KSByZXR1cm4gJyswLjAnO1xyXG4gIHJldHVybiAodiA+PSAwID8gJysnIDogJycpICsgdi50b0ZpeGVkKDEpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10RWxhcHNlZChtcykge1xyXG4gIGNvbnN0IHMgPSBNYXRoLmZsb29yKG1zIC8gMTAwMCk7XHJcbiAgY29uc3QgbSA9IE1hdGguZmxvb3IocyAvIDYwKTtcclxuICByZXR1cm4gbSA+IDAgPyBgJHttfW0gJHtzICUgNjB9c2AgOiBgJHtzfXNgO1xyXG59XHJcblxyXG4vLyDilIDilIAgdGltZWxpbmUgaW50ZXJ2YWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmNvbnN0IF9USU1FTElORV9NSU5fSU5URVJWQUxfUyA9IDEwO1xyXG5cclxuLy8gQ29udmVydCBhIHRpbWVsaW5lIGludGVydmFsICh2YWx1ZSwgdW5pdCkgaW50byBzZWNvbmRzOyBudWxsIGlmIG5vbi1udW1lcmljIG9yXHJcbi8vIGJlbG93IHRoZSBtaW5pbXVtLiBTaGFyZWQgYnkgdGhlIFNldHRpbmdzIHNhdmUgcGF0aCBhbmQgdGhlIHBlci12aWRlbyB0aW1lbGluZVxyXG4vLyBnZW5lcmF0b3Igc28gdGhlaXIgdmFsaWRhdGlvbiBjYW4ndCBkcmlmdCBhcGFydC5cclxuZnVuY3Rpb24gX3BhcnNlSW50ZXJ2YWxTKHZhbHVlLCB1bml0KSB7XHJcbiAgY29uc3QgbiA9IHBhcnNlSW50KHZhbHVlLCAxMCk7XHJcbiAgaWYgKGlzTmFOKG4pKSByZXR1cm4gbnVsbDtcclxuICBjb25zdCBzZWNvbmRzID0gdW5pdCA9PT0gJ21pbnV0ZXMnID8gbiAqIDYwIDogbjtcclxuICByZXR1cm4gc2Vjb25kcyA+PSBfVElNRUxJTkVfTUlOX0lOVEVSVkFMX1MgPyBzZWNvbmRzIDogbnVsbDtcclxufVxyXG5cclxuZXhwb3J0IHtcclxuICBfc2NvcmVJY29uLCBfbGVycENvbG9yLCBfc2NvcmVCb3JkZXJDb2xvciwgX3NvcnRTY29yZSwgX2ZtdFZpZGVvU3RhdHVzLCBfbXNUb0htcyxcclxuICBwbHVyYWwsIGZpbml0ZU9yLCBmbXREdXJhdGlvbiwgdHJ1bmNhdGUsIGVzY0h0bWwsIGZvcm1hdEFwaUVycm9yLCBzdHJpcFJpY2hNYXJrdXAsXHJcbiAgX3BhcnNlU2VydmVyRGF0ZSwgX2ZtdERhdGUsIF9mbXRBZ28sIF9mbXRPZmZzZXQsIF9mbXRFbGFwc2VkLCBfcGFyc2VJbnRlcnZhbFMsXHJcbn07XHJcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFNoYXJlZCBjb2xvdXIgcGlja2VyLiBQcm9ncmVzc2l2ZS1lbmhhbmNlcyBhbiA8aW5wdXQ+IHRoYXQgaG9sZHNcclxuLy8gICBhIGhleCB2YWx1ZTogdGhlIG9yaWdpbmFsIGlucHV0IGJlY29tZXMgYSBoaWRkZW4gdmFsdWUtc3RvcmUgKGtlZXBpbmcgaXRzIGlkLFxyXG4vLyAgIGNsYXNzZXMsIGRhdGEtKiBhbmQgZXZlbnQgd2lyaW5nKSBhbmQgZ2FpbnMgYSBjb21wYWN0IHN3YXRjaCB0cmlnZ2VyLiBDbGlja2luZ1xyXG4vLyAgIGl0IG9wZW5zIGEgcG9wb3ZlciB3aXRoIGRpcmVjdCBoZXggZW50cnksIGEgcmVjZW50bHktdXNlZCBzdHJpcCwgYW5kIChTdGFnZSAzKVxyXG4vLyAgIGEgdXNlci1jdXJhdGVkIG5hbWVkIHBhbGV0dGUuIFJlcGxhY2VzIG5hdGl2ZSA8aW5wdXQgdHlwZT1cImNvbG9yXCI+IGF0IHRoZVxyXG4vLyAgIHNwZWFrZXItY29sb3VyIGFuZCB0aXRsZS1jYXJkIGNvbG91ciBzaXRlcy5cclxuLy8gICBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9jb2xvcnBpY2tlci5weVxyXG4vLyDilIDilIAgc2hhcmVkIGNvbG91ciBwaWNrZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG5jb25zdCBSRUNFTlRfS0VZID0gJ3l1dWNsaXAtY29sb3ItcmVjZW50JztcclxuY29uc3QgUEFMRVRURV9LRVkgPSAneXV1Y2xpcC1jb2xvci1wYWxldHRlJztcclxuY29uc3QgUkVDRU5UX01BWCA9IDg7XHJcblxyXG4vLyBQaWNrYWJsZSBzdGFydGVyIGNvbG91cnMgLSBkYXRhLCBub3QgVUkgY2hyb21lICh0aGUgY2hyb21lIGFyb3VuZCB0aGVtIGNvbWVzXHJcbi8vIGZyb20gdGhlbWUgdG9rZW5zKS4gQSBzcHJlYWQgb2YgaHVlcyBwbHVzIGJsYWNrL3doaXRlIHNvIGEgZmlyc3QtdGltZSB1c2VyIGhhc1xyXG4vLyB1c2FibGUgY2hvaWNlcyBiZWZvcmUgY3VyYXRpbmcgdGhlaXIgb3duIHBhbGV0dGUuIFRoZXNlIGxpdGVyYWxzIGFyZSB0aGUgb25lXHJcbi8vIGV4Y2VwdGlvbiB0aGUgdGVzdF91aV90aGVtZSBjb2xvdXItbGl0ZXJhbCBhbGxvd2xpc3QgY2FydmVzIG91dCBmb3IgdGhpcyBmaWxlLlxyXG5jb25zdCBTVEFSVEVSX1NXQVRDSEVTID0gW1xyXG4gICcjZmZmZmZmJywgJyMwMDAwMDAnLCAnI2UwNWM1YycsICcjZjA4MDNjJywgJyNmMGMwNjAnLCAnIzRjYWY3ZCcsXHJcbiAgJyM0ZmMzZjcnLCAnIzBhN2E5YicsICcjYjA2YWY3JywgJyNmNzdhYzAnLCAnIzllOWU5ZScsICcjN2E0YjJhJyxcclxuXTtcclxuXHJcbmZ1bmN0aW9uIF9yZWFkTGlzdChrZXkpIHtcclxuICB0cnkge1xyXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8ICdbXScpO1xyXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocGFyc2VkKSA/IHBhcnNlZCA6IFtdO1xyXG4gIH0gY2F0Y2ggeyByZXR1cm4gW107IH1cclxufVxyXG5cclxuZnVuY3Rpb24gX3dyaXRlTGlzdChrZXksIGxpc3QpIHtcclxuICB0cnkgeyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIEpTT04uc3RyaW5naWZ5KGxpc3QpKTsgfSBjYXRjaCB7IC8qIHN0b3JhZ2UgZGlzYWJsZWQgKi8gfVxyXG59XHJcblxyXG4vLyBBY2NlcHRzICNSR0Igb3IgI1JSR0dCQiAod2l0aCBvciB3aXRob3V0IHRoZSBsZWFkaW5nICMpIGFuZCByZXR1cm5zIGFcclxuLy8gY2Fub25pY2FsIGxvd2VyY2FzZSAjcnJnZ2JiLCBvciBudWxsIHdoZW4gdGhlIHZhbHVlIGlzbid0IGEgdmFsaWQgaGV4IGNvbG91ci5cclxuZnVuY3Rpb24gX25vcm1hbGl6ZUhleChyYXcpIHtcclxuICBpZiAodHlwZW9mIHJhdyAhPT0gJ3N0cmluZycpIHJldHVybiBudWxsO1xyXG4gIGxldCBoZXggPSByYXcudHJpbSgpO1xyXG4gIGlmIChoZXggJiYgIWhleC5zdGFydHNXaXRoKCcjJykpIGhleCA9ICcjJyArIGhleDtcclxuICBjb25zdCBzaG9ydCA9IC9eIyhbMC05YS1mQS1GXXszfSkkLy5leGVjKGhleCk7XHJcbiAgaWYgKHNob3J0KSBoZXggPSAnIycgKyBzaG9ydFsxXS5zcGxpdCgnJykubWFwKGMgPT4gYyArIGMpLmpvaW4oJycpO1xyXG4gIHJldHVybiAvXiNbMC05YS1mQS1GXXs2fSQvLnRlc3QoaGV4KSA/IGhleC50b0xvd2VyQ2FzZSgpIDogbnVsbDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3JlY29yZFJlY2VudChoZXgpIHtcclxuICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChoZXgpO1xyXG4gIGlmICghbm9ybSkgcmV0dXJuO1xyXG4gIGNvbnN0IGxpc3QgPSBfcmVhZExpc3QoUkVDRU5UX0tFWSlcclxuICAgIC5tYXAoX25vcm1hbGl6ZUhleClcclxuICAgIC5maWx0ZXIoYyA9PiBjICYmIGMgIT09IG5vcm0pO1xyXG4gIGxpc3QudW5zaGlmdChub3JtKTtcclxuICBfd3JpdGVMaXN0KFJFQ0VOVF9LRVksIGxpc3Quc2xpY2UoMCwgUkVDRU5UX01BWCkpO1xyXG59XHJcblxyXG4vLyBBIHNpbmdsZSBjbGlja2FibGUgc3dhdGNoIHNob3dpbmcgYW4gYWN0dWFsIGNob3NlbiBjb2xvdXIuIFRoZSBiYWNrZ3JvdW5kIGlzIGFcclxuLy8gZGF0YSB2YWx1ZSAodGhlIHBpY2tlZCBjb2xvdXIpLCBzZXQgYXMgYSBET00gcHJvcGVydHkgc28gaXQgbmV2ZXIgYXBwZWFycyBhcyBhXHJcbi8vIGxpdGVyYWwgaW4gc291cmNlIC0gdGhlIHN3YXRjaCdzIGJvcmRlci9mb2N1cyByaW5nIGFyZSB0aGVtZSB0b2tlbnMgdmlhIENTUy5cclxuZnVuY3Rpb24gX3N3YXRjaEJ1dHRvbihjb2xvcikge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGJ0bi50eXBlID0gJ2J1dHRvbic7XHJcbiAgYnRuLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1zd2F0Y2gnO1xyXG4gIGJ0bi5kYXRhc2V0LmNvbG9yID0gY29sb3I7XHJcbiAgYnRuLnN0eWxlLmJhY2tncm91bmQgPSBjb2xvcjtcclxuICBidG4udGl0bGUgPSBjb2xvcjtcclxuICBidG4uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgY29sb3IpO1xyXG4gIHJldHVybiBidG47XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zd2F0Y2hSb3coY29sb3JzKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1yb3cnO1xyXG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XHJcbiAgZm9yIChjb25zdCByYXcgb2YgY29sb3JzKSB7XHJcbiAgICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgocmF3KTtcclxuICAgIGlmICghY29sb3IgfHwgc2Vlbi5oYXMoY29sb3IpKSBjb250aW51ZTtcclxuICAgIHNlZW4uYWRkKGNvbG9yKTtcclxuICAgIHJvdy5hcHBlbmRDaGlsZChfc3dhdGNoQnV0dG9uKGNvbG9yKSk7XHJcbiAgfVxyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zZWN0aW9uTGFiZWwodGV4dCkge1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXNlY3Rpb24tbGFiZWwnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gdGV4dDtcclxuICByZXR1cm4gbGFiZWw7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCB1c2VyLWN1cmF0ZWQgbmFtZWQgcGFsZXR0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZnVuY3Rpb24gX3BhbGV0dGVFbnRyaWVzKCkge1xyXG4gIHJldHVybiBfcmVhZExpc3QoUEFMRVRURV9LRVkpXHJcbiAgICAuZmlsdGVyKGUgPT4gZSAmJiB0eXBlb2YgZS5uYW1lID09PSAnc3RyaW5nJyAmJiBfbm9ybWFsaXplSGV4KGUuY29sb3IpKVxyXG4gICAgLm1hcChlID0+ICh7IG5hbWU6IGUubmFtZSwgY29sb3I6IF9ub3JtYWxpemVIZXgoZS5jb2xvcikgfSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcGFsZXR0ZUl0ZW0obmFtZSwgY29sb3IpIHtcclxuICBjb25zdCBpdGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgaXRlbS5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1pdGVtJztcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1uYW1lJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9IG5hbWU7XHJcbiAgY29uc3QgcmVtb3ZlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgcmVtb3ZlLnR5cGUgPSAnYnV0dG9uJztcclxuICByZW1vdmUuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtcmVtb3ZlJztcclxuICByZW1vdmUuZGF0YXNldC5uYW1lID0gbmFtZTtcclxuICByZW1vdmUudGV4dENvbnRlbnQgPSAnw5cnO1xyXG4gIHJlbW92ZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBgUmVtb3ZlICR7bmFtZX1gKTtcclxuICBpdGVtLmFwcGVuZChfc3dhdGNoQnV0dG9uKGNvbG9yKSwgbGFiZWwsIHJlbW92ZSk7XHJcbiAgcmV0dXJuIGl0ZW07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZFBhbGV0dGUoZW50cmllcykge1xyXG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICB3cmFwLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlJztcclxuICBpZiAoIWVudHJpZXMubGVuZ3RoKSB7XHJcbiAgICBjb25zdCBoaW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgaGludC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGludCc7XHJcbiAgICBoaW50LnRleHRDb250ZW50ID0gJ1NhdmUgYSBjb2xvdXIgYmVsb3cgdG8gYnVpbGQgeW91ciBwYWxldHRlLic7XHJcbiAgICB3cmFwLmFwcGVuZENoaWxkKGhpbnQpO1xyXG4gICAgcmV0dXJuIHdyYXA7XHJcbiAgfVxyXG4gIGVudHJpZXMuZm9yRWFjaCgoeyBuYW1lLCBjb2xvciB9KSA9PiB3cmFwLmFwcGVuZENoaWxkKF9wYWxldHRlSXRlbShuYW1lLCBjb2xvcikpKTtcclxuICByZXR1cm4gd3JhcDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkQWRkUm93KCkge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItYWRkcm93JztcclxuICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgaW5wdXQudHlwZSA9ICd0ZXh0JztcclxuICBpbnB1dC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCc7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdtYXhsZW5ndGgnLCAnNDAnKTtcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTmFtZSBmb3IgdGhlIGN1cnJlbnQgY29sb3VyJyk7XHJcbiAgaW5wdXQucGxhY2Vob2xkZXIgPSAnTmFtZSB0aGlzIGNvbG91cic7XHJcbiAgY29uc3QgYWRkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYWRkLnR5cGUgPSAnYnV0dG9uJztcclxuICBhZGQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtYWRkJztcclxuICBhZGQudGV4dENvbnRlbnQgPSAnU2F2ZSc7XHJcbiAgcm93LmFwcGVuZChpbnB1dCwgYWRkKTtcclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG4vLyBTYXZlcyB0aGUgY29sb3VyIGN1cnJlbnRseSBpbiB0aGUgaGV4IGZpZWxkIChmYWxsaW5nIGJhY2sgdG8gdGhlIGNvbW1pdHRlZFxyXG4vLyB2YWx1ZSkgdW5kZXIgdGhlIHR5cGVkIG5hbWUsIGRlZmF1bHRpbmcgdGhlIG5hbWUgdG8gdGhlIGhleCBzdHJpbmcgaXRzZWxmLlxyXG5mdW5jdGlvbiBfYWRkUGFsZXR0ZUVudHJ5KGN0eCkge1xyXG4gIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleChjdHguaGV4RmllbGQudmFsdWUpIHx8IF9ub3JtYWxpemVIZXgoY3R4LmlucHV0LnZhbHVlKTtcclxuICBpZiAoIWNvbG9yKSByZXR1cm47XHJcbiAgY29uc3QgbmFtZUlucHV0ID0gY3R4LnBvcC5xdWVyeVNlbGVjdG9yKCcuY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCcpO1xyXG4gIGNvbnN0IG5hbWUgPSAobmFtZUlucHV0ICYmIG5hbWVJbnB1dC52YWx1ZS50cmltKCkpIHx8IGNvbG9yO1xyXG4gIGNvbnN0IG5leHQgPSBfcGFsZXR0ZUVudHJpZXMoKS5maWx0ZXIoZSA9PiBlLm5hbWUgIT09IG5hbWUpO1xyXG4gIG5leHQucHVzaCh7IG5hbWUsIGNvbG9yIH0pO1xyXG4gIF93cml0ZUxpc3QoUEFMRVRURV9LRVksIG5leHQpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3JlbW92ZVBhbGV0dGVFbnRyeShjdHgsIG5hbWUpIHtcclxuICBfd3JpdGVMaXN0KFBBTEVUVEVfS0VZLCBfcGFsZXR0ZUVudHJpZXMoKS5maWx0ZXIoZSA9PiBlLm5hbWUgIT09IG5hbWUpKTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCB2YWx1ZSkge1xyXG4gIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleCh2YWx1ZSk7XHJcbiAgdHJpZ2dlci5zdHlsZS5iYWNrZ3JvdW5kID0gY29sb3IgfHwgJ3RyYW5zcGFyZW50JztcclxuICB0cmlnZ2VyLmNsYXNzTGlzdC50b2dnbGUoJ2lzLWVtcHR5JywgIWNvbG9yKTtcclxufVxyXG5cclxuLy8gRXZlcnl0aGluZyBpbiBhIHBpY2tlciBpbnN0YW5jZSB0aGUgaGFuZGxlcnMgbmVlZCB0byByZWFjaC5cclxuZnVuY3Rpb24gX21ha2VDb250ZXh0KGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkKSB7XHJcbiAgcmV0dXJuIHsgaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2NvbW1pdChjdHgsIHJhd0hleCkge1xyXG4gIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KHJhd0hleCk7XHJcbiAgaWYgKCFub3JtKSByZXR1cm4gZmFsc2U7XHJcbiAgY3R4LmlucHV0LnZhbHVlID0gbm9ybTtcclxuICAvLyBpbnB1dCBkcml2ZXMgdGhlIGxpdmUtcHJldmlldyBoYW5kbGVycyAodGl0bGUgY2FyZCdzIG9uaW5wdXQpOyBjaGFuZ2UgZHJpdmVzXHJcbiAgLy8gdGhlIHNhdmUgaGFuZGxlcnMgKHNwZWFrZXIgY2hhbmdlLWRlbGVnYXRpb24pLiBUaGUgdHJpZ2dlciByZS1zeW5jcyBvZmYgdGhlXHJcbiAgLy8gJ2lucHV0JyBsaXN0ZW5lciB3aXJlZCBpbiBhdHRhY2goKS5cclxuICBjdHguaW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcclxuICBjdHguaW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgX3JlY29yZFJlY2VudChub3JtKTtcclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuLy8gUmVidWlsdCBlYWNoIHRpbWUgdGhlIHBvcG92ZXIgb3BlbnMgKGFuZCBhZnRlciBhIHBhbGV0dGUgYWRkL3JlbW92ZSkgc28gdGhlXHJcbi8vIHJlY2VudGx5LXVzZWQgc3RyaXAgYW5kIHNhdmVkIHBhbGV0dGUgcmVmbGVjdCB0aGUgbGF0ZXN0IHN0YXRlLiBBbGwgb2YgaXQgZ29lc1xyXG4vLyBpbiBvbmUgY29udGFpbmVyIHRoYXQgaXMgcmVwbGFjZWQgd2hvbGVzYWxlLCBzbyBub3RoaW5nIGFjY3VtdWxhdGVzLlxyXG5mdW5jdGlvbiBfcmVuZGVyU3RyaXBzKGN0eCkge1xyXG4gIGNvbnN0IHN0YWxlID0gY3R4LnBvcC5xdWVyeVNlbGVjdG9yKCcuY29sb3JwaWNrZXItZHluYW1pYycpO1xyXG4gIGlmIChzdGFsZSkgc3RhbGUucmVtb3ZlKCk7XHJcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgY29udGFpbmVyLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1keW5hbWljJztcclxuICBjb25zdCByZWNlbnQgPSBfcmVhZExpc3QoUkVDRU5UX0tFWSk7XHJcbiAgaWYgKHJlY2VudC5sZW5ndGgpIHtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdSZWNlbnRseSB1c2VkJykpO1xyXG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zd2F0Y2hSb3cocmVjZW50KSk7XHJcbiAgfVxyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdZb3VyIHBhbGV0dGUnKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9idWlsZFBhbGV0dGUoX3BhbGV0dGVFbnRyaWVzKCkpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX2J1aWxkQWRkUm93KCkpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc2VjdGlvbkxhYmVsKCdDb2xvdXJzJykpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc3dhdGNoUm93KFNUQVJURVJfU1dBVENIRVMpKTtcclxuICBjdHgucG9wLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcbn1cclxuXHJcbmxldCBfb3BlbkN0eCA9IG51bGw7ICAvLyB0aGUgb25lIG9wZW4gcGlja2VyIGNvbnRleHQsIG9yIG51bGxcclxuXHJcbmZ1bmN0aW9uIF9jbG9zZVBvcG92ZXIocmVmb2N1cykge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBjb25zdCB7IHBvcCwgdHJpZ2dlciB9ID0gX29wZW5DdHg7XHJcbiAgcG9wLmNsYXNzTGlzdC5yZW1vdmUoJ29wZW4nKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xyXG4gIF9vcGVuQ3R4ID0gbnVsbDtcclxuICBpZiAocmVmb2N1cykgdHJpZ2dlci5mb2N1cygpO1xyXG59XHJcblxyXG4vLyBUaGUgcG9wb3ZlciBpcyBhIGRpYWxvZywgc28gVGFiIG11c3Qgbm90IGZhbGwgdGhyb3VnaCB0byB0aGUgcGFnZSBiZWhpbmQgaXRcclxuLy8gKFdDQUcgMi40LjMpLiBDeWNsZSBmb2N1cyBhbW9uZyB0aGUgcG9wb3ZlcidzIG93biBjb250cm9sczsgdGhlIHRyaWdnZXIgc2l0c1xyXG4vLyBvdXRzaWRlIHRoZSBwb3BvdmVyIGFuZCBpcyBpbnRlbnRpb25hbGx5IGV4Y2x1ZGVkIHdoaWxlIGl0IGlzIG9wZW4uXHJcbmZ1bmN0aW9uIF9mb2N1c2FibGVzKHBvcCkge1xyXG4gIHJldHVybiBBcnJheS5mcm9tKHBvcC5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24sIGlucHV0JykpLmZpbHRlcihcclxuICAgIGVsID0+ICFlbC5kaXNhYmxlZCAmJiBlbC5vZmZzZXRQYXJlbnQgIT09IG51bGwsXHJcbiAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3RyYXBGb2N1cyhlKSB7XHJcbiAgY29uc3QgaXRlbXMgPSBfZm9jdXNhYmxlcyhfb3BlbkN0eC5wb3ApO1xyXG4gIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XHJcbiAgY29uc3QgZmlyc3QgPSBpdGVtc1swXTtcclxuICBjb25zdCBsYXN0ID0gaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV07XHJcbiAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcclxuICBpZiAoIV9vcGVuQ3R4LnBvcC5jb250YWlucyhhY3RpdmUpKSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBmaXJzdC5mb2N1cygpO1xyXG4gIH0gZWxzZSBpZiAoZS5zaGlmdEtleSAmJiBhY3RpdmUgPT09IGZpcnN0KSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBsYXN0LmZvY3VzKCk7XHJcbiAgfSBlbHNlIGlmICghZS5zaGlmdEtleSAmJiBhY3RpdmUgPT09IGxhc3QpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGZpcnN0LmZvY3VzKCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBfb3BlblBvcG92ZXIoY3R4KSB7XHJcbiAgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gIGN0eC5oZXhGaWVsZC52YWx1ZSA9IChfbm9ybWFsaXplSGV4KGN0eC5pbnB1dC52YWx1ZSkgfHwgJycpLnJlcGxhY2UoJyMnLCAnJyk7XHJcbiAgY3R4LmhleEZpZWxkLmNsYXNzTGlzdC5yZW1vdmUoJ2ludmFsaWQnKTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbiAgY3R4LnBvcC5jbGFzc0xpc3QuYWRkKCdvcGVuJyk7XHJcbiAgY3R4LnRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcclxuICBfb3BlbkN0eCA9IGN0eDtcclxuICBjdHguaGV4RmllbGQuZm9jdXMoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3dpcmVIZXhGaWVsZChjdHgpIHtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiB7XHJcbiAgICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChjdHguaGV4RmllbGQudmFsdWUpO1xyXG4gICAgY3R4LmhleEZpZWxkLmNsYXNzTGlzdC50b2dnbGUoJ2ludmFsaWQnLCAhbm9ybSAmJiBjdHguaGV4RmllbGQudmFsdWUudHJpbSgpICE9PSAnJyk7XHJcbiAgICBpZiAobm9ybSkgX3N5bmNUcmlnZ2VyKGN0eC50cmlnZ2VyLCBub3JtKTsgIC8vIGxpdmUgcHJldmlldywgbm8gY29tbWl0IHlldFxyXG4gIH0pO1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiBfY29tbWl0KGN0eCwgY3R4LmhleEZpZWxkLnZhbHVlKSk7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICAgIGlmIChlLmtleSAhPT0gJ0VudGVyJykgcmV0dXJuO1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgaWYgKF9jb21taXQoY3R4LCBjdHguaGV4RmllbGQudmFsdWUpKSBfY2xvc2VQb3BvdmVyKHRydWUpO1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRIZXhSb3coKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhyb3cnO1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhoYXNoJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9ICcjJztcclxuICBjb25zdCBmaWVsZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XHJcbiAgZmllbGQudHlwZSA9ICd0ZXh0JztcclxuICBmaWVsZC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4ZmllbGQnO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnbWF4bGVuZ3RoJywgJzcnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ3NwZWxsY2hlY2snLCAnZmFsc2UnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ2F1dG9jb21wbGV0ZScsICdvZmYnKTtcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnSGV4IGNvbG91ciB2YWx1ZScpO1xyXG4gIGZpZWxkLnBsYWNlaG9sZGVyID0gJ1JSR0dCQic7XHJcbiAgcm93LmFwcGVuZChsYWJlbCwgZmllbGQpO1xyXG4gIHJldHVybiB7IHJvdywgZmllbGQgfTtcclxufVxyXG5cclxuZnVuY3Rpb24gYXR0YWNoKGlucHV0KSB7XHJcbiAgaWYgKCFpbnB1dCB8fCBpbnB1dC5kYXRhc2V0LmNwQXR0YWNoZWQpIHJldHVybjtcclxuICBpbnB1dC5kYXRhc2V0LmNwQXR0YWNoZWQgPSAnMSc7XHJcbiAgY29uc3QgaW5pdGlhbCA9IF9ub3JtYWxpemVIZXgoaW5wdXQudmFsdWUpIHx8ICcnO1xyXG4gIGlucHV0LnR5cGUgPSAnaGlkZGVuJztcclxuICBpbnB1dC52YWx1ZSA9IGluaXRpYWw7XHJcblxyXG4gIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgd3JhcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXInO1xyXG4gIGlucHV0LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHdyYXAsIGlucHV0KTtcclxuXHJcbiAgY29uc3QgdHJpZ2dlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIHRyaWdnZXIudHlwZSA9ICdidXR0b24nO1xyXG4gIHRyaWdnZXIuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXRyaWdnZXInO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWhhc3BvcHVwJywgJ3RydWUnKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0Nob29zZSBjb2xvdXInKTtcclxuXHJcbiAgY29uc3QgcG9wID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcG9wLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wb3AnO1xyXG4gIHBvcC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnZGlhbG9nJyk7XHJcbiAgcG9wLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDb2xvdXIgcGlja2VyJyk7XHJcbiAgY29uc3QgeyByb3c6IGhleFJvdywgZmllbGQ6IGhleEZpZWxkIH0gPSBfYnVpbGRIZXhSb3coKTtcclxuICBwb3AuYXBwZW5kQ2hpbGQoaGV4Um93KTtcclxuXHJcbiAgd3JhcC5hcHBlbmQodHJpZ2dlciwgaW5wdXQsIHBvcCk7XHJcbiAgY29uc3QgY3R4ID0gX21ha2VDb250ZXh0KGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkKTtcclxuXHJcbiAgX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIGlucHV0LnZhbHVlKTtcclxuICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCBpbnB1dC52YWx1ZSkpO1xyXG4gIHRyaWdnZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChfb3BlbkN0eCAmJiBfb3BlbkN0eC50cmlnZ2VyID09PSB0cmlnZ2VyKSBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgICBlbHNlIF9vcGVuUG9wb3ZlcihjdHgpO1xyXG4gIH0pO1xyXG4gIHBvcC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gICAgY29uc3QgcmVtb3ZlQnRuID0gZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtcmVtb3ZlJyk7XHJcbiAgICBpZiAocmVtb3ZlQnRuKSB7IF9yZW1vdmVQYWxldHRlRW50cnkoY3R4LCByZW1vdmVCdG4uZGF0YXNldC5uYW1lKTsgcmV0dXJuOyB9XHJcbiAgICBpZiAoZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtYWRkJykpIHsgX2FkZFBhbGV0dGVFbnRyeShjdHgpOyByZXR1cm47IH1cclxuICAgIGNvbnN0IHN3YXRjaCA9IGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1zd2F0Y2gnKTtcclxuICAgIGlmICghc3dhdGNoKSByZXR1cm47XHJcbiAgICBfY29tbWl0KGN0eCwgc3dhdGNoLmRhdGFzZXQuY29sb3IpO1xyXG4gICAgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gIH0pO1xyXG4gIHBvcC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicgJiYgZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnKSkge1xyXG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgIF9hZGRQYWxldHRlRW50cnkoY3R4KTtcclxuICAgIH1cclxuICB9KTtcclxuICBfd2lyZUhleEZpZWxkKGN0eCk7XHJcbn1cclxuXHJcbi8vIENsb3NlIHRoZSBvcGVuIHBvcG92ZXIgb24gYW4gb3V0c2lkZSBjbGljayBvciBFc2NhcGUuIFJlZ2lzdGVyZWQgb25jZS5cclxuLy8gQSBjbGljayB0aGF0IHJlLXJlbmRlcnMgdGhlIHBvcG92ZXIgKFNhdmUgLyByZW1vdmUgYSBwYWxldHRlIGVudHJ5KSBkZXRhY2hlc1xyXG4vLyBpdHMgb3duIHRhcmdldCBiZWZvcmUgdGhpcyBidWJibGluZyBoYW5kbGVyIHJ1bnM7IHN1Y2ggYSB0YXJnZXQgaXMgbm8gbG9uZ2VyIGluXHJcbi8vIHRoZSBkb2N1bWVudCwgc28gc2tpcCBpdCByYXRoZXIgdGhhbiBtaXN0YWtpbmcgaXQgZm9yIGFuIG91dHNpZGUgY2xpY2suXHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGlmICghZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKGUudGFyZ2V0KSkgcmV0dXJuO1xyXG4gIGlmICghX29wZW5DdHgucG9wLnBhcmVudE5vZGUuY29udGFpbnMoZS50YXJnZXQpKSBfY2xvc2VQb3BvdmVyKCk7XHJcbn0pO1xyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHsgX2Nsb3NlUG9wb3Zlcih0cnVlKTsgcmV0dXJuOyB9XHJcbiAgaWYgKGUua2V5ID09PSAnVGFiJykgX3RyYXBGb2N1cyhlKTtcclxufSk7XHJcblxyXG5leHBvcnQgY29uc3QgQ29sb3JQaWNrZXIgPSB7IGF0dGFjaCwgX25vcm1hbGl6ZUhleCwgUkVDRU5UX0tFWSwgUEFMRVRURV9LRVkgfTtcclxuIiwgIi8vIEluZnJhc3RydWN0dXJlIC0gUGFuZWxOYXYgdGFrZW92ZXIgZnJhbWV3b3JrIChub3QgYSBmZWF0dXJlIG1vZHVsZSkuXHJcbi8vICAgVXNlZCBieTogc3BsaXQuanMsIGNsaXBjcmVhdGUuanMsIGV4cG9ydGVkaXRvci5qcywgbmFtZWNvcnJlY3Rpb25zLmpzIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3BhbmVsbmF2LnB5XHJcbi8vIOKUgOKUgCBwYW5lbCBuYXZpZ2F0aW9uIGZyYW1ld29yayDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gTXVsdGktc3RlcCBmbG93cyAoU3BsaXQgRWRpdG9yLCBhbmQgZnV0dXJlIHBpY2tlcnMpIHRha2Ugb3ZlciB0aGUgbWFpblxyXG4vLyBkZXRhaWwgcGFuZWwgaW5zdGVhZCBvZiB1c2luZyBhIG1vZGFsOiBzaGFyZWQgYnJlYWRjcnVtYiwgc2hhcmVkIGRpcnR5LXN0YXRlXHJcbi8vIGRpc2NhcmQgcHJvbXB0LiBFYWNoIG9wZW4gcGFuZWwgZ2V0cyBpdHMgb3duIGNvbnRlbnQgY29udGFpbmVyIHNvIGEgZnV0dXJlXHJcbi8vIG5lc3RlZCBwYW5lbCAoZS5nLiBtYW51YWwtY2xpcCdzIHBpY2tlciBvbiB0b3Agb2YgYSByZWNvcmRpbmcgdmlldykgY2FuIGJlXHJcbi8vIHVud291bmQgb25lIGxldmVsIGF0IGEgdGltZSB3aXRob3V0IHJlLXJ1bm5pbmcgdGhlIHBhcmVudCdzIHJlbmRlcigpLlxyXG4vL1xyXG4vLyBUaGUgY29udGFpbmVyIGlzIGRlc3Ryb3llZCBvbiBjbG9zZSByaWdodCBhZnRlciBvbkNsb3NlKCkgcnVucy4gSWYgcmVuZGVyKClcclxuLy8gcmVwYXJlbnRlZCBhbiBleGlzdGluZyBzdGF0aWMgZWxlbWVudCAocmF0aGVyIHRoYW4gYnVpbGRpbmcgZnJlc2ggRE9NKSxcclxuLy8gb25DbG9zZSgpIG11c3QgbW92ZSBpdCBiYWNrIG91dCB0byBhIHN0YWJsZSwgYWx3YXlzLWluLWRvY3VtZW50IGxvY2F0aW9uIC1cclxuLy8gb3RoZXJ3aXNlIGl0IGdvZXMgd2l0aCB0aGUgY29udGFpbmVyIGFuZCBnZXRFbGVtZW50QnlJZCBjYW4ndCBmaW5kIGl0IG9uXHJcbi8vIHRoZSBuZXh0IG9wZW4uIFNlZSBzcGxpdC5qcydzIF90ZWFyZG93blNwbGl0RWRpdG9yIGZvciB0aGUgcGF0dGVybi5cclxuXHJcbmNvbnN0IF9zdGFjayA9IFtdOyAgLy8gW3tpZCwgdGl0bGUsIGlzRGlydHksIG9uQ2xvc2UsIGNvbnRhaW5lcn1dXHJcblxyXG5mdW5jdGlvbiBfcm9vdCgpICAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1yb290Jyk7IH1cclxuZnVuY3Rpb24gX2NydW1iKCkgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtYnJlYWRjcnVtYicpOyB9XHJcbmZ1bmN0aW9uIF9tb3VudCgpICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LWNvbnRlbnQnKTsgfVxyXG5mdW5jdGlvbiBfdG9wKCkgICAgIHsgcmV0dXJuIF9zdGFja1tfc3RhY2subGVuZ3RoIC0gMV0gfHwgbnVsbDsgfVxyXG5cclxuZnVuY3Rpb24gX3JlbmRlckJyZWFkY3J1bWIoKSB7XHJcbiAgY29uc3QgdG9wID0gX3RvcCgpO1xyXG4gIGNvbnN0IGNydW1iID0gX2NydW1iKCk7XHJcbiAgY3J1bWIuaW5uZXJIVE1MID0gJyc7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICBjb25zdCBiYWNrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYmFjay50eXBlID0gJ2J1dHRvbic7XHJcbiAgYmFjay5jbGFzc05hbWUgPSAnYnRuIGdob3N0JztcclxuICBiYWNrLnN0eWxlLmNzc1RleHQgPSAncGFkZGluZzo0cHggMTBweDtmb250LXNpemU6MTNweCc7XHJcbiAgYmFjay50ZXh0Q29udGVudCA9ICfihpAgQmFjayc7XHJcbiAgYmFjay5vbmNsaWNrID0gKCkgPT4gcGFuZWxOYXZDbG9zZSgpO1xyXG4gIGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIHRpdGxlLnN0eWxlLmNzc1RleHQgPSAnZm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NjAwJztcclxuICB0aXRsZS50ZXh0Q29udGVudCA9IHRvcC50aXRsZTtcclxuICBjcnVtYi5hcHBlbmQoYmFjaywgdGl0bGUpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfdXBkYXRlVmlzaWJpbGl0eSgpIHtcclxuICBfc3RhY2suZm9yRWFjaCgoZW50cnksIGkpID0+IHtcclxuICAgIGVudHJ5LmNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gaSA9PT0gX3N0YWNrLmxlbmd0aCAtIDEgPyAnZmxleCcgOiAnbm9uZSc7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2T3Blbih7IGlkLCB0aXRsZSwgcmVuZGVyLCBpc0RpcnR5LCBvbkNsb3NlIH0pIHtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBjb250YWluZXIuZGF0YXNldC5wYW5lbElkID0gaWQ7XHJcbiAgY29udGFpbmVyLnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6MTZweCc7XHJcbiAgX21vdW50KCkuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxuICBfc3RhY2sucHVzaCh7XHJcbiAgICBpZCxcclxuICAgIHRpdGxlLFxyXG4gICAgaXNEaXJ0eTogaXNEaXJ0eSB8fCAoKCkgPT4gZmFsc2UpLFxyXG4gICAgb25DbG9zZTogb25DbG9zZSB8fCAoKCkgPT4ge30pLFxyXG4gICAgY29udGFpbmVyLFxyXG4gIH0pO1xyXG4gIF9yb290KCkuc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcclxuICBfdXBkYXRlVmlzaWJpbGl0eSgpO1xyXG4gIF9yZW5kZXJCcmVhZGNydW1iKCk7XHJcbiAgcmVuZGVyKGNvbnRhaW5lcik7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9jbG9zZVRvcCgpIHtcclxuICBjb25zdCB0b3AgPSBfc3RhY2sucG9wKCk7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICB0b3Aub25DbG9zZSgpO1xyXG4gIHRvcC5jb250YWluZXIucmVtb3ZlKCk7XHJcbiAgaWYgKF9zdGFjay5sZW5ndGggPT09IDApIHtcclxuICAgIF9yb290KCkuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuICB9IGVsc2Uge1xyXG4gICAgX3VwZGF0ZVZpc2liaWxpdHkoKTtcclxuICAgIF9yZW5kZXJCcmVhZGNydW1iKCk7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdkNsb3NlKCkge1xyXG4gIGNvbnN0IHRvcCA9IF90b3AoKTtcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIGlmICh0b3AuaXNEaXJ0eSgpKSB7XHJcbiAgICB3aW5kb3cuc2hvd0NvbmZpcm0oXHJcbiAgICAgICdEaXNjYXJkIGNoYW5nZXM/JyxcclxuICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgY2hhbmdlcy4gQ2xvc2Ugd2l0aG91dCBzYXZpbmc/JyxcclxuICAgICAgJ0Rpc2NhcmQnLFxyXG4gICAgICBfY2xvc2VUb3AsXHJcbiAgICAgIHRydWUsXHJcbiAgICApO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBfY2xvc2VUb3AoKTtcclxufVxyXG5cclxuLy8gRm9yY2UtY2xvc2UgdGhlIHRvcG1vc3QgcGFuZWwsIGJ5cGFzc2luZyB0aGUgZGlydHkgZ2F0ZSAtIGZvciBjYWxsZXJzIHRoYXRcclxuLy8gaGF2ZSBhbHJlYWR5IGNvbmZpcm1lZCB0aGUgZGlzY2FyZCB0aHJvdWdoIHRoZWlyIG93biAoZGlmZmVyZW50bHkgd29yZGVkKVxyXG4vLyBwcm9tcHQsIGUuZy4gc3dpdGNoaW5nIHJlY29yZGluZ3Mgd2hpbGUgdGhlIFNwbGl0IEVkaXRvciBpcyBkaXJ0eS5cclxuZnVuY3Rpb24gcGFuZWxOYXZGb3JjZUNsb3NlKCkge1xyXG4gIF9jbG9zZVRvcCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdklzT3BlbihpZCkge1xyXG4gIGlmIChpZCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gX3N0YWNrLmxlbmd0aCA+IDA7XHJcbiAgcmV0dXJuIF9zdGFjay5zb21lKGVudHJ5ID0+IGVudHJ5LmlkID09PSBpZCk7XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBQYW5lbE5hdiA9IHtcclxuICBvcGVuOiBwYW5lbE5hdk9wZW4sIGNsb3NlOiBwYW5lbE5hdkNsb3NlLCBmb3JjZUNsb3NlOiBwYW5lbE5hdkZvcmNlQ2xvc2UsIGlzT3BlbjogcGFuZWxOYXZJc09wZW4sXHJcbn07XHJcbiIsICIvLyBGZWF0dXJlLW1hcCAtIExvbmctcnVubmluZy1qb2IgbWFjaGluZXJ5OiB0aGUgam9iLXN0YXR1cyBoZWFkZXIgKHN0ZXAgcGlsbHMsIHRpbWVyLCBFVEEpLCB0aGVcbi8vICAgcGF1c2UvcmVzdW1lICsgdGhlcm1hbCBhdXRvLXBhdXNlIFVJLCB0aGUgZmV0Y2gtYmFzZWQgU1NFIHRyYW5zcG9ydCAoX29wZW5TU0Uvc3RyZWFtU1NFKSwgdGhlXG4vLyAgIHNpbmdsZS1hY3RpdmUtc3RyZWFtIHN1cGVyc2VkZSBjb250cmFjdCwgYW5kIHRoZSBzaGFyZWQgQ2FuY2VsIGJ1dHRvbi5cbi8vICAgQVBJOiByb3V0ZXMvYW5hbHl6ZS5weSwgcm91dGVzL3Njb3JpbmcucHkgKFNTRSBlbmRwb2ludHMpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5LCB0ZXN0cy91aS90ZXN0X3VpX3NzZS5weVxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IGVzY0h0bWwsIGZvcm1hdEFwaUVycm9yLCBfZm10RWxhcHNlZCB9IGZyb20gJy4vZm9ybWF0LmpzJztcblxuLy8g4pSA4pSAIHNoYXJlZCBsaXZlIGpvYi1yZW5kZXIgc3RhdGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBSZWFkIGNyb3NzLWZpbGUgYnkgdmlkZW9zLmpzJ3MgY29tcGFjdCBzdGVwIHN0cmlwIChiYXJlIGlkZW50aWZpZXJzIF9qb2JTdGVwRGVmcyxcbi8vIF9hY3RpdmVTdGVwSWR4LCBfam9iU3RhcnRUaW1lKSBhbmQgYnkgdGhlIFBsYXl3cmlnaHQgVUktdGVzdCBzdWl0ZSwgd2hpY2ggc2VlZHNcbi8vIHNldmVyYWwgb2YgdGhlc2UgZGlyZWN0bHkgdmlhIHBhZ2UuZXZhbHVhdGUuIEJvdGggc2lkZXMgYXJlIGNsYXNzaWMsIG5vbi1tb2R1bGVcbi8vIGNvZGUsIHNvIHRoZXkgY2FuIG9ubHkgZXZlciByZWFjaCB0aGVzZSBhcyBgd2luZG93YCBwcm9wZXJ0aWVzIC0gbmV2ZXIgdmlhIGFuIEVTTVxuLy8gaW1wb3J0LiBBIG9uZS1zaG90IGB3aW5kb3cuWCA9IFhgIHNuYXBzaG90IHdvdWxkIGdvIHN0YWxlIHRoZSBpbnN0YW50IGpvYnMuanNcbi8vIHJlYXNzaWducyBYLCBzbyBlYWNoIG5hbWUgZ2V0cyBhIGxpdmUgZ2V0L3NldCBicmlkZ2Ugb250byBgd2luZG93YCBiZWxvdyBpbnN0ZWFkXG4vLyBvZiBhIHBsYWluIE9iamVjdC5hc3NpZ24gZXhwb3J0LlxubGV0IF9qb2JTdGVwRGVmcyAgID0gW107XG5sZXQgX2FjdGl2ZUVTICAgICAgPSBudWxsO1xubGV0IF9qb2JTdGFydFRpbWUgID0gMDtcbmxldCBfYWN0aXZlU3RlcElkeCA9IC0xO1xuXG4vLyBQZXItc3RlcCBwcm9ncmVzcyBhY2NvdW50aW5nIGZvciB0aGUgc3RlcC1waWxsIEVUQSBoZXVyaXN0aWMuIE5vdCByZWFkIGJ5IG90aGVyXG4vLyBwcm9kdWN0aW9uIG1vZHVsZXMsIGJ1dCB0aGUgc3RlcC1waWxsIC8gRVRBIC8gbGl2ZS1wYW5lbCB0ZXN0cyBzZWVkIHRoZW0gZGlyZWN0bHlcbi8vIHZpYSBwYWdlLmV2YWx1YXRlLCBzbyB0aGV5IG5lZWQgdGhlIHNhbWUgd2luZG93IGJyaWRnZSBhcyB0aGUgYmxvY2sgYWJvdmUuXG5sZXQgX3N0ZXBTdGFydFRpbWUgPSAwO1xubGV0IF9zdGVwUHJvZ3Jlc3MgID0ge307IC8vIHN0ZXBJZHggLT4ge2N1cnJlbnQsIHRvdGFsfSwgY2xlYXJlZCBwZXIgam9iXG5sZXQgX3N0ZXBSYXRlQW5jaG9yID0ge307IC8vIHN0ZXBJZHggLT4ge3QsIGN1cnJlbnR9IGF0IGZpcnN0IG9ic2VydmVkIGNvdW50LCBjbGVhcmVkIHBlciBqb2JcblxuZm9yIChjb25zdCBbbmFtZSwgZ2V0LCBzZXRdIG9mIFtcbiAgWydfam9iU3RlcERlZnMnLCAgICAoKSA9PiBfam9iU3RlcERlZnMsICAgIHYgPT4geyBfam9iU3RlcERlZnMgPSB2OyB9XSxcbiAgWydfYWN0aXZlRVMnLCAgICAgICAoKSA9PiBfYWN0aXZlRVMsICAgICAgIHYgPT4geyBfYWN0aXZlRVMgPSB2OyB9XSxcbiAgWydfam9iU3RhcnRUaW1lJywgICAoKSA9PiBfam9iU3RhcnRUaW1lLCAgIHYgPT4geyBfam9iU3RhcnRUaW1lID0gdjsgfV0sXG4gIFsnX2FjdGl2ZVN0ZXBJZHgnLCAgKCkgPT4gX2FjdGl2ZVN0ZXBJZHgsICB2ID0+IHsgX2FjdGl2ZVN0ZXBJZHggPSB2OyB9XSxcbiAgWydfc3RlcFN0YXJ0VGltZScsICAoKSA9PiBfc3RlcFN0YXJ0VGltZSwgIHYgPT4geyBfc3RlcFN0YXJ0VGltZSA9IHY7IH1dLFxuICBbJ19zdGVwUHJvZ3Jlc3MnLCAgICgpID0+IF9zdGVwUHJvZ3Jlc3MsICAgdiA9PiB7IF9zdGVwUHJvZ3Jlc3MgPSB2OyB9XSxcbiAgWydfc3RlcFJhdGVBbmNob3InLCAoKSA9PiBfc3RlcFJhdGVBbmNob3IsIHYgPT4geyBfc3RlcFJhdGVBbmNob3IgPSB2OyB9XSxcbl0pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHdpbmRvdywgbmFtZSwge2dldCwgc2V0LCBjb25maWd1cmFibGU6IHRydWV9KTtcbn1cblxuLy8g4pSA4pSAIHByb2dyZXNzIGluZGljYXRvciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIGVzdE1hdGNoOiBzdWJzdHJpbmdzIHRoYXQgbWFwIHRoaXMgcGlsbCB0byBhIHN0ZXAgbmFtZSBmcm9tIC9hcGkvZXN0aW1hdGUsIHNvXG4vLyB0aGUgcHJvZ3Jlc3MgcGlsbCBjYW4gc2hvdyBpdHMgcHJlLXJ1biB0aW1lIGVzdGltYXRlIGFzIGEgaG92ZXIgdG9vbHRpcC5cbi8vIHByb2dyZXNzUGF0dGVybjogcmVnZXggd2l0aCB0d28gY2FwdHVyZSBncm91cHMgKGN1cnJlbnQsIHRvdGFsKSBtYXRjaGVkXG4vLyBhZ2FpbnN0IGluY29taW5nIGxvZyBsaW5lcyB3aGlsZSB0aGlzIHN0ZXAgaXMgYWN0aXZlLCBzbyB0aGUgcGlsbCBjYW4gc2hvd1xuLy8gXCIzLzEyICgyNSUpXCIgYW5kIGEgbGl2ZSBFVEEgaW5zdGVhZCBvZiBqdXN0IGVsYXBzZWQgdGltZS5cbi8vIHN0YWdlOiB0aGUgbWFjaGluZS1yZWFkYWJsZSBpZCBmcm9tIHRoZSBAQFBST0dSRVNTIG1hcmtlciAoeXV1X2NsaXAvcGlwZWxpbmUvXG4vLyBwcm9ncmVzcy5weSBTdGFnZSkuIFRoZSBtYXJrZXIgZHJpdmVzIHRoZSBwaWxsIGRldGVybWluaXN0aWNhbGx5OyB0aGUgcGF0dGVybnMvXG4vLyBwcm9ncmVzc1BhdHRlcm4gcmVnZXhlcyBiZWxvdyBzdGF5IGFzIGEgb25lLXJlbGVhc2UgZmFsbGJhY2sgZm9yIHRoZSBodW1hbiBsb2dcbi8vIGxpbmVzLiBUaGUgc3RhZ2Ugc2V0IGhlcmUgaXMgY291cGxpbmctZ3VhcmRlZCBhZ2FpbnN0IHByb2dyZXNzLnB5IGJ5XG4vLyB0ZXN0cy91bml0L3Rlc3RfcHJvZ3Jlc3Nfc3RhZ2VfY291cGxpbmcucHkuXG5jb25zdCBJTkdFU1RfU1RFUFMgPSBbXG4gIHtsYWJlbDogJ0V4dHJhY3QnLCAgICAgICAgc3RhZ2U6ICdleHRyYWN0JywgICAgICAgIHBhdHRlcm5zOiBbJ0V4dHJhY3RpbmcgYXVkaW8nXSwgICAgICBlc3RNYXRjaDogWydleHRyYWN0IGF1ZGlvJ10sICBwcm9ncmVzc1BhdHRlcm46IC9UcmFjayAoXFxkKylcXC8oXFxkKykvfSxcbiAge2xhYmVsOiAnVHJhbnNjcmliZScsICAgICBzdGFnZTogJ3RyYW5zY3JpYmUnLCAgICAgcGF0dGVybnM6IFsnVHJhbnNjcmliaW5nJ10sICAgICAgICAgIGVzdE1hdGNoOiBbJ3RyYW5zY3JpYmUnLCAnbG9hZCBjYXB0aW9ucyddLCBwcm9ncmVzc1BhdHRlcm46IC9UcmFjayAoXFxkKylcXC8oXFxkKykvLCB3YWl0UGF0dGVybjogL1dhaXRpbmcgZm9yIHRoZSBzcGVlY2gtdG8tdGV4dCBtb2RlbC99LFxuICB7bGFiZWw6ICdTcGVha2VycycsICAgICAgIHN0YWdlOiAnc3BlYWtlcnMnLCAgICAgICBwYXR0ZXJuczogWydEZXRlY3Rpbmcgc3BlYWtlcnMnXSwgICAgZXN0TWF0Y2g6IFsnc3BlYWtlciBsYWJlbHMnXX0sXG4gIHtsYWJlbDogJ0dlbmVyYXRlIENsaXBzJywgc3RhZ2U6ICdnZW5lcmF0ZV9jbGlwcycsIHBhdHRlcm5zOiBbJ0dlbmVyYXRpbmcgY2xpcCddfSxcbiAge2xhYmVsOiAnRW5lcmd5JywgICAgICAgICBzdGFnZTogJ2VuZXJneScsICAgICAgICAgcGF0dGVybnM6IFsnQ29tcHV0aW5nIGF1ZGlvIGVuZXJneSddLCBlc3RNYXRjaDogWydhdWRpbyBlbmVyZ3knXX0sXG4gIHtsYWJlbDogJ1NjZW5lcycsICAgICAgICAgc3RhZ2U6ICdzY2VuZXMnLCAgICAgICAgIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzY2VuZSddLCAgICAgICBlc3RNYXRjaDogWydzY2VuZSBkZXRlY3Rpb24nXX0sXG4gIHtsYWJlbDogJ1Njb3JlJywgICAgICAgICAgc3RhZ2U6ICdzY29yZScsICAgICAgICAgIHBhdHRlcm5zOiBbJ1Njb3JpbmcgY2xpcHMnXSwgICAgICAgICBlc3RNYXRjaDogWydsbG0gc2NvcmluZyddLCBwcm9ncmVzc1BhdHRlcm46IC9TY29yaW5nIChcXGQrKVxcLyhcXGQrKS99LFxuXTtcbmNvbnN0IFNDT1JFX1NURVBTID0gW1xuICB7bGFiZWw6ICdFbmVyZ3knLCAgc3RhZ2U6ICdlbmVyZ3knLCBwYXR0ZXJuczogWydDb21wdXRpbmcgYXVkaW8gZW5lcmd5J119LFxuICB7bGFiZWw6ICdTY2VuZXMnLCAgc3RhZ2U6ICdzY2VuZXMnLCBwYXR0ZXJuczogWydEZXRlY3Rpbmcgc2NlbmUnXX0sXG4gIHtsYWJlbDogJ1Njb3JpbmcnLCBzdGFnZTogJ3Njb3JlJywgIHBhdHRlcm5zOiBbJ1Njb3JpbmcgY2xpcHMnXSwgcHJvZ3Jlc3NQYXR0ZXJuOiAvU2NvcmluZyAoXFxkKylcXC8oXFxkKykvfSxcbl07XG4vLyBNYXJrZXItZHJpdmVuIG9ubHkgKHRoZSBhbmFseXplLWZyYW1lcyBTU0UgZW1pdHMgbm8gcHJvc2Ugc3RhZ2UgbGluZXMpLCBzbyB0aGVzZVxuLy8gY2Fycnkgbm8gcGF0dGVybnMgLSBqdXN0IHRoZSB0d28gQEBQUk9HUkVTUyBzdGFnZXMgdGhlIHZpc2lvbiByb3V0ZSBlbWl0cy5cbmNvbnN0IEZSQU1FU19TVEVQUyA9IFtcbiAge2xhYmVsOiAnU2FtcGxlJywgICBzdGFnZTogJ2ZyYW1lc19zYW1wbGUnLCAgIHBhdHRlcm5zOiBbXX0sXG4gIHtsYWJlbDogJ0Rlc2NyaWJlJywgc3RhZ2U6ICdmcmFtZXNfZGVzY3JpYmUnLCBwYXR0ZXJuczogW119LFxuXTtcblxuLy8gVGhlIGZ1bGwgc2V0IG9mIGtub3duIEBAUFJPR1JFU1Mgc3RhZ2UgaWRzIC0gdGhlIEpTIG1pcnJvciBvZiBwcm9ncmVzcy5weSdzXG4vLyBTdGFnZSBlbnVtLiBmcmFtZXNfc2FtcGxlL2ZyYW1lc19kZXNjcmliZSBkcml2ZSB0aGUgYW5hbHl6ZS1mcmFtZXMgam9iLiBLZXB0XG4vLyBhcyBpdHMgb3duIHNldCAobm90IGRlcml2ZWQgZnJvbSB0aGUgc3RlcCBkZWZzKSBzbyBpdCBzdGF5cyB0aGUgY291cGxpbmdcbi8vIGFuY2hvciBldmVuIGZvciBzdGFnZXMgd2hvc2Ugc3RlcCBkZWYgbGl2ZXMgZWxzZXdoZXJlLlxuY29uc3QgX1BST0dSRVNTX1BSRUZJWCA9ICdAQFBST0dSRVNTICc7XG5jb25zdCBKT0JfU1RBR0VTID0gbmV3IFNldChbXG4gICdleHRyYWN0JywgJ3RyYW5zY3JpYmUnLCAnc3BlYWtlcnMnLCAnZ2VuZXJhdGVfY2xpcHMnLFxuICAnZW5lcmd5JywgJ3NjZW5lcycsICdzY29yZScsICdmcmFtZXNfc2FtcGxlJywgJ2ZyYW1lc19kZXNjcmliZScsXG5dKTtcblxuLy8gTWlycm9yIG9mIHByb2dyZXNzLnB5IHBhcnNlX3Byb2dyZXNzOiByZXR1cm5zIHRoZSBtYXJrZXIgcGF5bG9hZCwgb3IgbnVsbCBmb3Jcbi8vIGFueSBub24tbWFya2VyIC8gbWFsZm9ybWVkIC8gdW5rbm93bi1zdGFnZSBsaW5lIChzbyBvcmRpbmFyeSBsb2cgb3V0cHV0IGZhbGxzXG4vLyB0aHJvdWdoIHRvIHRoZSBwcm9zZSBmYWxsYmFjayByYXRoZXIgdGhhbiBiZWluZyBtaXNyZWFkIGFzIHByb2dyZXNzKS5cbmZ1bmN0aW9uIHBhcnNlUHJvZ3Jlc3MobGluZSkge1xuICBpZiAoIWxpbmUgfHwgIWxpbmUuc3RhcnRzV2l0aChfUFJPR1JFU1NfUFJFRklYKSkgcmV0dXJuIG51bGw7XG4gIGxldCBwYXlsb2FkO1xuICB0cnkgeyBwYXlsb2FkID0gSlNPTi5wYXJzZShsaW5lLnNsaWNlKF9QUk9HUkVTU19QUkVGSVgubGVuZ3RoKSk7IH1cbiAgY2F0Y2ggKGUpIHsgcmV0dXJuIG51bGw7IH1cbiAgaWYgKCFwYXlsb2FkIHx8IHR5cGVvZiBwYXlsb2FkICE9PSAnb2JqZWN0JyB8fCAhSk9CX1NUQUdFUy5oYXMocGF5bG9hZC5zdGFnZSkpIHJldHVybiBudWxsO1xuICByZXR1cm4gcGF5bG9hZDtcbn1cblxuLy8gc3RlcElkeCAtPiBhIHRyYW5zaWVudCBzdGF0dXMgbWVzc2FnZSBzaG93biBpbiBwbGFjZSBvZiB0aGUgc3RlcCdzIHRpbWluZ1xuLy8gbGFiZWwgKGUuZy4gXCJ3YWl0aW5nIGZvciB0aGUgc3BlZWNoIG1vZGVsIHRvIGZpbmlzaCBkb3dubG9hZGluZ1wiKS4gU2V0IHdoZW4gYVxuLy8gc3RlcCdzIHdhaXRQYXR0ZXJuIG1hdGNoZXMsIGNsZWFyZWQgd2hlbiB0aGF0IHN0ZXAgcmVwb3J0cyByZWFsIHByb2dyZXNzLlxubGV0IF9zdGVwV2FpdGluZ01zZyA9IHt9O1xubGV0IF9qb2JBY3RpdmUgICAgID0gZmFsc2U7XG5sZXQgX2FjdGl2ZUpvYkNsZWFudXAgPSBudWxsO1xubGV0IF9qb2JUaW1lciAgICAgID0gbnVsbDtcbmxldCBfam9iSGlkZVRpbWVyICA9IG51bGw7XG5sZXQgX2pvYlBhdXNhYmxlICAgPSBmYWxzZTtcbmxldCBfam9iUGF1c2VkICAgICA9IGZhbHNlO1xubGV0IF9qb2JUaGVybWFsUG9sbFRpbWVyID0gbnVsbDtcbmxldCBfbGFzdEdwdVN0YXRlICA9ICd1bmF2YWlsYWJsZSc7XG5cbi8vIEJlc3QtZWZmb3J0IGxvb2t1cCBvZiBhIHBpbGwncyBwcmUtcnVuIHRpbWUgZXN0aW1hdGUgKGZyb20gdGhlIGxhc3Rcbi8vIC9hcGkvZXN0aW1hdGUgY2FsbCwgc2F2ZWQgYnkgcmVuZGVyRXN0aW1hdGUpIGZvciB1c2UgYXMgYSBob3ZlciB0b29sdGlwLlxuZnVuY3Rpb24gX2VzdGltYXRlSG1zRm9yKHN0ZXBEZWYpIHtcbiAgY29uc3Qgc3RlcHMgPSBBcHBTdGF0ZS5sYXN0RXN0aW1hdGVTdGVwcztcbiAgaWYgKCFzdGVwcyB8fCAhc3RlcERlZi5lc3RNYXRjaCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IG1hdGNoID0gc3RlcHMuZmluZChlcyA9PlxuICAgIHN0ZXBEZWYuZXN0TWF0Y2guc29tZShrZXkgPT4gKGVzLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoa2V5KSlcbiAgKTtcbiAgcmV0dXJuIG1hdGNoID8gbWF0Y2guaG1zIDogbnVsbDtcbn1cblxuLy8gUGVyLWl0ZW0gYnV0dG9ucyB0aGF0IHRyaWdnZXIgYSBoZWF2eSBvcCBhcmUgdGFnZ2VkIGRhdGEtam9iLWJsb2NrZWQuIERpc2FibGVcbi8vIHRoZW0gKHdpdGggYSB3aHktdG9vbHRpcCkgd2hpbGUgYW55IGpvYiBydW5zIHNvIGEgdXNlciBjYW4ndCBzdGFydCBhIHNlY29uZCBqb2Jcbi8vIHRoZSBiYWNrZW5kIHdvdWxkIGp1c3QgNDA5LiBUaGUgaGVhZGVyICNidG4tYW5hbHl6ZSBpcyBoYW5kbGVkIGlubGluZSBiZWxvdy5cbi8vIHJlbmRlckRldGFpbCBjYWxscyBhcHBseUpvYkJsb2NrZWRTdGF0ZSgpIHNvIGEgcGFuZWwgcmVidWlsdCBtaWQtam9iIGNvbWVzIHVwXG4vLyBhbHJlYWR5IGRpc2FibGVkIC0gdGhlIHRhZyBsaXZlcyBpbiBmcmVzaGx5LWJ1aWx0IGlubmVySFRNTCwgbm90IGEgbGl2ZSBub2RlLlxuZnVuY3Rpb24gX3NldEpvYkJsb2NrZWRCdXR0b25zKGRpc2FibGVkKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWpvYi1ibG9ja2VkXScpLmZvckVhY2goYiA9PiB7XG4gICAgYi5kaXNhYmxlZCA9IGRpc2FibGVkO1xuICAgIGIudGl0bGUgPSBkaXNhYmxlZCA/ICdBbm90aGVyIGpvYiBpcyBydW5uaW5nIC0gd2FpdCBmb3IgaXQgdG8gZmluaXNoIG9yIGNhbmNlbCBpdCcgOiAnJztcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5Sm9iQmxvY2tlZFN0YXRlKCkgeyBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnMoX2pvYkFjdGl2ZSk7IH1cblxuZnVuY3Rpb24gc3RhcnRKb2JVSShzdGVwRGVmcywgam9iTGFiZWwsIGNhbmNlbGxhYmxlID0gZmFsc2UsIHBhdXNhYmxlID0gZmFsc2UpIHtcbiAgX2pvYkFjdGl2ZSAgICAgPSB0cnVlO1xuICBfam9iU3RlcERlZnMgICA9IHN0ZXBEZWZzO1xuICBfYWN0aXZlU3RlcElkeCA9IC0xO1xuICBfam9iU3RhcnRUaW1lICA9IERhdGUubm93KCk7XG4gIF9zdGVwU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgX3N0ZXBQcm9ncmVzcyAgPSB7fTtcbiAgX3N0ZXBSYXRlQW5jaG9yID0ge307XG4gIF9zdGVwV2FpdGluZ01zZyA9IHt9O1xuICBfam9iUGF1c2FibGUgICA9IHBhdXNhYmxlO1xuICBfam9iUGF1c2VkICAgICA9IGZhbHNlO1xuICBfYWN0aXZlQ2FuY2VsICA9IF9BTkFMWVpFX0NBTkNFTDtcbiAgaWYgKF9qb2JUaW1lcikgY2xlYXJJbnRlcnZhbChfam9iVGltZXIpO1xuICBfam9iVGltZXIgPSBzZXRJbnRlcnZhbChfdGlja0pvYlRpbWVyLCAxMDAwKTtcbiAgaWYgKF9qb2JIaWRlVGltZXIpIHsgY2xlYXJUaW1lb3V0KF9qb2JIaWRlVGltZXIpOyBfam9iSGlkZVRpbWVyID0gbnVsbDsgfVxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXN0ZXBzJykuaW5uZXJIVE1MID1cbiAgICBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7bWFyZ2luLXJpZ2h0OjRweFwiPiR7ZXNjSHRtbChqb2JMYWJlbCl9PC9zcGFuPmAgK1xuICAgIHN0ZXBEZWZzLm1hcCgocywgaSkgPT4ge1xuICAgICAgY29uc3QgZXN0ID0gX2VzdGltYXRlSG1zRm9yKHMpO1xuICAgICAgY29uc3QgdGl0bGUgPSBlc3QgPyBgIHRpdGxlPVwiRXN0aW1hdGVkOiAke2VzY0h0bWwoZXN0KX1cImAgOiAnJztcbiAgICAgIHJldHVybiBgPHNwYW4gY2xhc3M9XCJzdGVwXCIgaWQ9XCJzdGVwLSR7aX1cIiR7dGl0bGV9PiR7cy5sYWJlbH08L3NwYW4+YDtcbiAgICB9KS5qb2luKCcnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1zdGF0dXMnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWFkZXItc3BhY2VyJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI2J0bi1hbmFseXplLCNidG4tc2NvcmUnKS5mb3JFYWNoKGIgPT4gYi5kaXNhYmxlZCA9IHRydWUpO1xuICBjb25zdCBhbmFseXplQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1hbmFseXplJyk7XG4gIGlmIChhbmFseXplQnRuKSBhbmFseXplQnRuLnRpdGxlID0gJ0Egam9iIGlzIGFscmVhZHkgcnVubmluZyc7XG4gIF9zZXRKb2JCbG9ja2VkQnV0dG9ucyh0cnVlKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jYW5jZWwtam9iJykuc3R5bGUuZGlzcGxheSA9IGNhbmNlbGxhYmxlID8gJycgOiAnbm9uZSc7XG4gIF9yZW5kZXJQYXVzZVVJKCk7XG4gIGlmIChfam9iVGhlcm1hbFBvbGxUaW1lcikgY2xlYXJJbnRlcnZhbChfam9iVGhlcm1hbFBvbGxUaW1lcik7XG4gIGlmIChwYXVzYWJsZSkge1xuICAgIF9sYXN0R3B1U3RhdGUgPSAndW5hdmFpbGFibGUnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItZ3B1LXRlbXAnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIF9wb2xsVGhlcm1hbFN0YXR1cygpO1xuICAgIF9qb2JUaGVybWFsUG9sbFRpbWVyID0gc2V0SW50ZXJ2YWwoX3BvbGxUaGVybWFsU3RhdHVzLCA1MDAwKTtcbiAgfVxuICBpZiAod2luZG93Ll9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKSBfcmVuZGVyQ2xpcEZpbHRlckNvdW50cygpO1xufVxuXG4vLyBQb2xsZWQgZXZlcnkgNXMgKG9ubHkgd2hpbGUgYSBwYXVzYWJsZSAtIGkuZS4gYW5hbHl6ZS10eXBlIC0gam9iIGlzIGFjdGl2ZSkgdG9cbi8vIGRyaXZlIHRoZSBqb2ItaGVhZGVyIEdQVSB0ZW1wZXJhdHVyZSByZWFkb3V0IGFuZCB0aGUgd2Fybi9hdXRvLXBhdXNlIG5vdGljZXMuXG4vLyBVc2VzIC9hcGkvc3RhdHVzIHJhdGhlciB0aGFuIFNTRSBsb2ctbGluZSBtYXRjaGluZyBzbyBpdCBhbHNvIHdvcmtzIGNvcnJlY3RseVxuLy8gYWNyb3NzIHRoZSBKUyBzZXF1ZW50aWFsLXNlZ21lbnQgcnVubmVycycgZ2FwcyBiZXR3ZWVuIHBlci1zZWdtZW50IGpvYnMuXG5hc3luYyBmdW5jdGlvbiBfcG9sbFRoZXJtYWxTdGF0dXMoKSB7XG4gIGNvbnN0IHN0YXR1cyA9IGF3YWl0IGZldGNoKCcvYXBpL3N0YXR1cycpLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gIGlmICghc3RhdHVzKSByZXR1cm47XG4gIGNvbnN0IHJlYWRvdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWdwdS10ZW1wJyk7XG4gIGlmIChyZWFkb3V0KSB7XG4gICAgaWYgKHN0YXR1cy5ncHVfdGVtcF9jID09IG51bGwpIHtcbiAgICAgIHJlYWRvdXQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmVhZG91dC5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgICByZWFkb3V0LmNsYXNzTmFtZSA9ICdncHUtdGVtcC1yZWFkb3V0JyArIChzdGF0dXMuZ3B1X3N0YXRlID09PSAnb2snID8gJycgOiBgICR7c3RhdHVzLmdwdV9zdGF0ZX1gKTtcbiAgICAgIHJlYWRvdXQudGV4dENvbnRlbnQgPSBgR1BVICR7TWF0aC5yb3VuZChzdGF0dXMuZ3B1X3RlbXBfYyl9wrBDYDtcbiAgICB9XG4gIH1cbiAgaWYgKHN0YXR1cy5ncHVfc3RhdGUgPT09ICd3YXJuJyAmJiBfbGFzdEdwdVN0YXRlICE9PSAnd2FybicgJiYgX2xhc3RHcHVTdGF0ZSAhPT0gJ3BhdXNlJykge1xuICAgIGNvbnN0IG5leHQgPSBzdGF0dXMudGhlcm1hbF9hdXRvcGF1c2VfZW5hYmxlZFxuICAgICAgPyBgQW5hbHlzaXMgd2lsbCBhdXRvLXBhdXNlIGlmIGl0IHJlYWNoZXMgJHtNYXRoLnJvdW5kKHN0YXR1cy50aGVybWFsX3BhdXNlX2MpfcKwQy5gXG4gICAgICA6IGBBdXRvLXBhdXNlIGlzIG9mZiAtIHBhdXNlIHRoZSBqb2IgbWFudWFsbHkgaWYgaXQga2VlcHMgY2xpbWJpbmcuYDtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KGBHUFUgcnVubmluZyBob3QgLSAke01hdGgucm91bmQoc3RhdHVzLmdwdV90ZW1wX2MpfcKwQy4gJHtuZXh0fWAsICd3YXJuaW5nJyk7XG4gIH1cbiAgaWYgKHN0YXR1cy5ncHVfc3RhdGUgPT09ICdwYXVzZScgJiYgX2xhc3RHcHVTdGF0ZSAhPT0gJ3BhdXNlJykge1xuICAgIF9qb2JQYXVzZWQgPSB0cnVlO1xuICAgIF9yZW5kZXJQYXVzZVVJKCk7XG4gICAgd2luZG93LnNob3dUb2FzdChgQXV0by1wYXVzZWQ6IEdQVSByZWFjaGVkICR7TWF0aC5yb3VuZChzdGF0dXMuZ3B1X3RlbXBfYyl9wrBDIC0gd2lsbCBob2xkIGJlZm9yZSB0aGUgbmV4dCB2aWRlb2AsICd3YXJuaW5nJywge1xuICAgICAgZHVyYXRpb25NczogMjAwMDAsXG4gICAgICBhY3Rpb246IHtsYWJlbDogJ1Jlc3VtZSBub3cnLCBvbkNsaWNrOiB0b2dnbGVQYXVzZUpvYn0sXG4gICAgfSk7XG4gIH1cbiAgX2xhc3RHcHVTdGF0ZSA9IHN0YXR1cy5ncHVfc3RhdGU7XG59XG5cbi8vIFwiUGF1c2UgYWZ0ZXIgY3VycmVudCB2aWRlb1wiIHRvZ2dsZSBpbiB0aGUgam9iIGhlYWRlciAtIG9ubHkgc2hvd24gZm9yIGpvYnNcbi8vIGJhY2tlZCBieSB0aGUgcGF1c2UgZmxhZyBmaWxlICh0aGUgc2luZ2xlIGFuYWx5emUgc3RyZWFtIGFuZCB0aGUgSlNcbi8vIHNlcXVlbnRpYWwtc2VnbWVudCBydW5uZXJzOyBzZWUgdG9nZ2xlUGF1c2VKb2IpLlxuZnVuY3Rpb24gX3JlbmRlclBhdXNlVUkoKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tcGF1c2Utam9iJyk7XG4gIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1wYXVzZWQtYmFkZ2UnKTtcbiAgaWYgKCFidG4gfHwgIWJhZGdlKSByZXR1cm47XG4gIGJ0bi5zdHlsZS5kaXNwbGF5ID0gX2pvYlBhdXNhYmxlID8gJycgOiAnbm9uZSc7XG4gIGJ0bi50ZXh0Q29udGVudCA9IF9qb2JQYXVzZWQgPyAnUmVzdW1lJyA6ICdQYXVzZSBhZnRlciBjdXJyZW50IHZpZGVvJztcbiAgYmFkZ2Uuc3R5bGUuZGlzcGxheSA9IF9qb2JQYXVzZWQgPyAnJyA6ICdub25lJztcbn1cblxuLy8gUmVmbGVjdHMgYW4gYWxyZWFkeS1wYXVzZWQgam9iIGRpc2NvdmVyZWQgdmlhIC9hcGkvc3RhdHVzIChwYWdlIHJlY29ubmVjdCkgLVxuLy8gZG9lcyBub3QgaXRzZWxmIGNhbGwgdGhlIHBhdXNlL3Jlc3VtZSBBUEkuXG5mdW5jdGlvbiBfc2V0UGF1c2VkVUlGcm9tU3RhdHVzKHBhdXNlZCkge1xuICBfam9iUGF1c2VkID0gISFwYXVzZWQ7XG4gIF9yZW5kZXJQYXVzZVVJKCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVBhdXNlSm9iKCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXBhdXNlLWpvYicpO1xuICBjb25zdCB3YW50UGF1c2UgPSAhX2pvYlBhdXNlZDtcbiAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS9hbmFseXplLyR7d2FudFBhdXNlID8gJ3BhdXNlJyA6ICdyZXN1bWUnfWAsIHttZXRob2Q6ICdQT1NUJ30pO1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIGlmICghcmVzLm9rKSB7XG4gICAgICB3aW5kb3cuc2hvd1RvYXN0KGZvcm1hdEFwaUVycm9yKGRhdGEpIHx8IGBDb3VsZCBub3QgJHt3YW50UGF1c2UgPyAncGF1c2UnIDogJ3Jlc3VtZSd9YCwgJ2Vycm9yJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChkYXRhLnN0YXR1cyA9PT0gJ25vLW9wJykge1xuICAgICAgd2luZG93LnNob3dUb2FzdChkYXRhLm1lc3NhZ2UgfHwgJ05vIGFuYWx5c2lzIGlzIHJ1bm5pbmcuJywgJ2luZm8nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgX2pvYlBhdXNlZCA9IHdhbnRQYXVzZTtcbiAgICBfcmVuZGVyUGF1c2VVSSgpO1xuICAgIHdpbmRvdy5zaG93VG9hc3Qod2FudFBhdXNlID8gJ1dpbGwgcGF1c2UgYmVmb3JlIHRoZSBuZXh0IHZpZGVvJyA6ICdSZXN1bWVkJywgJ2luZm8nKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgd2luZG93LnNob3dUb2FzdCh3aW5kb3cubmV0RXJyTXNnKGVyciksICdlcnJvcicpO1xuICB9IGZpbmFsbHkge1xuICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICB9XG59XG5cbi8vIE1hcmsgc3RlcCAqaWR4KiBhY3RpdmUgYW5kIGV2ZXJ5IGVhcmxpZXIgc3RlcCBkb25lLiBTaGFyZWQgYnkgdGhlIHByb3NlXG4vLyBtYXRjaGVyICh1cGRhdGVKb2JVSSkgYW5kIHRoZSBtYXJrZXIgcGF0aCAoX2RyaXZlU3RlcEZyb21NYXJrZXIpIHNvIGEgc3RhZ2Vcbi8vIGFkdmFuY2UgYmVoYXZlcyBpZGVudGljYWxseSBob3dldmVyIGl0IHdhcyBkZXRlY3RlZC5cbmZ1bmN0aW9uIF9hY3RpdmF0ZVN0ZXAoaWR4KSB7XG4gIGNvbnN0IHByZXZTdGVwSWR4ID0gX2FjdGl2ZVN0ZXBJZHg7XG4gIGZvciAobGV0IGogPSAwOyBqIDwgaWR4OyBqKyspIHtcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7an1gKTtcbiAgICBpZiAoZWwpIHsgZWwuY2xhc3NOYW1lID0gJ3N0ZXAgZG9uZSc7IGVsLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnOyBlbC50ZXh0Q29udGVudCA9ICfinJMnOyBlbC50aXRsZSA9IF9qb2JTdGVwRGVmc1tqXS5sYWJlbDsgfVxuICB9XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtpZHh9YCk7XG4gIGlmIChlbCkgeyBlbC5jbGFzc05hbWUgPSAnc3RlcCBhY3RpdmUnOyBfYWN0aXZlU3RlcElkeCA9IGlkeDsgfVxuICBpZiAoX2FjdGl2ZVN0ZXBJZHggIT09IHByZXZTdGVwSWR4KSB7XG4gICAgX3N0ZXBTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIC8vIFdoZW4gdGhlIHBpcGVsaW5lIGFkdmFuY2VzIGEgc3RhZ2UsIHJlZnJlc2ggdGhlIHNpZGViYXIgc28gYSBuZXdseS1hbmFseXppbmdcbiAgICAvLyByZWNvcmRpbmcgYXBwZWFycyAocmVwbGFjaW5nIGl0cyBwbGFjZWhvbGRlcikgYW5kIGl0cyBzdGF0dXMgc3RheXMgY3VycmVudCxcbiAgICAvLyBhbmQgcmVmcmVzaCB0aGUgb3BlbiBjbGlwIGxpc3QgdG8gcGljayB1cCBmcmVzaGx5LWNvbW1pdHRlZCBjbGlwcy9zY29yZXMuXG4gICAgX2RlYm91bmNlZFNpZGViYXJSZWZyZXNoKCk7XG4gICAgX2RlYm91bmNlZENsaXBMaXN0UmVmcmVzaCgpO1xuICB9XG59XG5cbi8vIFJlY29yZCBhIHN0ZXAncyBjdXJyZW50L3RvdGFsLCBhbmNob3JpbmcgdGhlIHRocm91Z2hwdXQgcmF0ZSBhdCB0aGUgZmlyc3Rcbi8vIG9ic2VydmVkIGNvdW50IHNvIGEgY29sZCBmaXJzdCBpdGVtIGlzIGV4Y2x1ZGVkIGZyb20gdGhlIEVUQSBleHRyYXBvbGF0aW9uLlxuZnVuY3Rpb24gX3NldFN0ZXBQcm9ncmVzcyhpZHgsIGN1cnJlbnQsIHRvdGFsKSB7XG4gIC8vIFJlYWwgcHJvZ3Jlc3MgbWVhbnMgYW55IHdhaXQgKGUuZy4gbW9kZWwgZG93bmxvYWQpIGlzIG92ZXIgLSBkcm9wIGl0IHNvIHRoZVxuICAvLyBwaWxsIHN3aXRjaGVzIGJhY2sgdG8gbGl2ZSBjb3VudHMuXG4gIGRlbGV0ZSBfc3RlcFdhaXRpbmdNc2dbaWR4XTtcbiAgX3N0ZXBQcm9ncmVzc1tpZHhdID0ge2N1cnJlbnQsIHRvdGFsfTtcbiAgaWYgKCFfc3RlcFJhdGVBbmNob3JbaWR4XSkgX3N0ZXBSYXRlQW5jaG9yW2lkeF0gPSB7dDogRGF0ZS5ub3coKSwgY3VycmVudH07XG4gIF9yZW5kZXJTdGVwUGlsbChpZHgpO1xuICBfZGVib3VuY2VkQ2xpcExpc3RSZWZyZXNoKCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUpvYlVJKGxpbmUpIHtcbiAgX2pvYlN0ZXBEZWZzLmZvckVhY2goKHMsIGkpID0+IHtcbiAgICBpZiAocy5wYXR0ZXJucy5zb21lKHAgPT4gbGluZS5pbmNsdWRlcyhwKSkpIF9hY3RpdmF0ZVN0ZXAoaSk7XG4gIH0pO1xuICBjb25zdCBhY3RpdmVEZWYgPSBfam9iU3RlcERlZnNbX2FjdGl2ZVN0ZXBJZHhdO1xuICBpZiAoYWN0aXZlRGVmICYmIGFjdGl2ZURlZi53YWl0UGF0dGVybiAmJiBhY3RpdmVEZWYud2FpdFBhdHRlcm4udGVzdChsaW5lKSkge1xuICAgIF9zdGVwV2FpdGluZ01zZ1tfYWN0aXZlU3RlcElkeF0gPSAnd2FpdGluZyBmb3IgdGhlIHNwZWVjaCBtb2RlbCB0byBmaW5pc2ggZG93bmxvYWRpbmcnO1xuICAgIF9yZW5kZXJTdGVwUGlsbChfYWN0aXZlU3RlcElkeCk7XG4gIH1cbiAgaWYgKGFjdGl2ZURlZiAmJiBhY3RpdmVEZWYucHJvZ3Jlc3NQYXR0ZXJuKSB7XG4gICAgY29uc3QgbSA9IGxpbmUubWF0Y2goYWN0aXZlRGVmLnByb2dyZXNzUGF0dGVybik7XG4gICAgaWYgKG0pIF9zZXRTdGVwUHJvZ3Jlc3MoX2FjdGl2ZVN0ZXBJZHgsIHBhcnNlSW50KG1bMV0sIDEwKSwgcGFyc2VJbnQobVsyXSwgMTApKTtcbiAgfVxuICBpZiAod2luZG93Ll9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwoKTtcbn1cblxuLy8gRHJpdmUgdGhlIHBpbGwgcm93IGZyb20gYSBwYXJzZWQgQEBQUk9HUkVTUyBtYXJrZXI6IGRldGVybWluaXN0aWMgc3RhZ2Vcbi8vIGFkdmFuY2UgcGx1cyBvcHRpb25hbCBjdXJyZW50L3RvdGFsLCBrZXllZCBvbiB0aGUgc3RlcCBkZWYncyBzdGFnZSBpZC5cbmZ1bmN0aW9uIF9kcml2ZVN0ZXBGcm9tTWFya2VyKG1hcmtlcikge1xuICBjb25zdCBpZHggPSBfam9iU3RlcERlZnMuZmluZEluZGV4KHMgPT4gcy5zdGFnZSA9PT0gbWFya2VyLnN0YWdlKTtcbiAgaWYgKGlkeCA8IDApIHJldHVybjtcbiAgX2FjdGl2YXRlU3RlcChpZHgpO1xuICBpZiAodHlwZW9mIG1hcmtlci5kb25lID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgbWFya2VyLnRvdGFsID09PSAnbnVtYmVyJyAmJiBtYXJrZXIudG90YWwgPiAwKSB7XG4gICAgX3NldFN0ZXBQcm9ncmVzcyhpZHgsIG1hcmtlci5kb25lLCBtYXJrZXIudG90YWwpO1xuICB9XG4gIGlmICh3aW5kb3cuX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpO1xufVxuXG5sZXQgX3NpZGViYXJSZWZyZXNoVGltZXIgPSBudWxsO1xuZnVuY3Rpb24gX2RlYm91bmNlZFNpZGViYXJSZWZyZXNoKCkge1xuICBpZiAoX3NpZGViYXJSZWZyZXNoVGltZXIpIHJldHVybjtcbiAgX3NpZGViYXJSZWZyZXNoVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHsgX3NpZGViYXJSZWZyZXNoVGltZXIgPSBudWxsOyB3aW5kb3cubG9hZFZpZGVvcygpOyB9LCAxMjAwKTtcbn1cblxubGV0IF9jbGlwTGlzdFJlZnJlc2hUaW1lciA9IG51bGw7XG4vLyBTYW1lIHB1c2gtZHJpdmVuLWJ1dC1kZWJvdW5jZWQgcGF0dGVybiBhcyBfZGVib3VuY2VkU2lkZWJhclJlZnJlc2ggYWJvdmUsXG4vLyB0cmlnZ2VyZWQgb2ZmIHRoZSBTU0UgbGluZSBzdHJlYW0gcmF0aGVyIHRoYW4gYSBwb2xsaW5nIHRpbWVyLiBPbmx5IHJlZnJlc2hlc1xuLy8gd2hlbiB0aGUgdmlkZW8gYmVpbmcgYW5hbHl6ZWQgaXMgdGhlIG9uZSBjdXJyZW50bHkgb3Blbiwgc28gbmV3bHktY29tbWl0dGVkXG4vLyBjbGlwIHNjb3JlcyAoeXV1X2NsaXAvc2NvcmluZy9lbmdpbmUucHkgbm93IGNvbW1pdHMgcGVyIGNsaXApIGZpbGwgaW50byB0aGVcbi8vIHZpc2libGUgbGlzdCBsaXZlIGluc3RlYWQgb2YgcmVxdWlyaW5nIGEgbWFudWFsIHBhZ2UgcmVmcmVzaC5cbmZ1bmN0aW9uIF9kZWJvdW5jZWRDbGlwTGlzdFJlZnJlc2goKSB7XG4gIGlmIChfY2xpcExpc3RSZWZyZXNoVGltZXIpIHJldHVybjtcbiAgX2NsaXBMaXN0UmVmcmVzaFRpbWVyID0gc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgX2NsaXBMaXN0UmVmcmVzaFRpbWVyID0gbnVsbDtcbiAgICBpZiAoIUFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgfHwgIUFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSkgcmV0dXJuO1xuICAgIGNvbnN0IGFuYWx5emluZyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5maWxlbmFtZSA9PT0gQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lKTtcbiAgICBpZiAoIWFuYWx5emluZyB8fCBhbmFseXppbmcuaWQgIT09IEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpIHJldHVybjtcbiAgICBBcHBTdGF0ZS5jbGlwcyA9IGF3YWl0IGZldGNoKHdpbmRvdy5fY2xpcHNMaXN0VXJsKEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICAgIHdpbmRvdy5fcmVuZGVyQ2xpcHMoKTtcbiAgfSwgMTIwMCk7XG59XG5cbi8vIEJ1aWxkcyB0aGUgbGl2ZSBsYWJlbCBmb3IgYSBzdGVwIHBpbGw6IFwiU2NvcmUgwrcgMy8xMiAoMjUlKSDCtyAwOjQyICh+MjowNlxuLy8gbGVmdClcIiBvbmNlIHBlci1pdGVtIGNvdW50cyBhcnJpdmUgZnJvbSB0aGUgc3VicHJvY2VzcyBsb2c7IGVsYXBzZWQtb25seVxuLy8gKGZhbGxpbmcgYmFjayB0byB0aGUgcHJlLXJ1biAvYXBpL2VzdGltYXRlIGZpZ3VyZSkgYmVmb3JlIHRoZSBmaXJzdCBjb3VudC5cbmZ1bmN0aW9uIF9zdGVwUGlsbExhYmVsKGlkeCkge1xuICBjb25zdCBkZWYgPSBfam9iU3RlcERlZnNbaWR4XTtcbiAgaWYgKCFkZWYpIHJldHVybiB7dGV4dDogJycsIHBjdDogbnVsbH07XG4gIGNvbnN0IHdhaXRpbmcgPSBfc3RlcFdhaXRpbmdNc2dbaWR4XTtcbiAgaWYgKHdhaXRpbmcpIHJldHVybiB7dGV4dDogYCR7ZGVmLmxhYmVsfSDCtyAke3dhaXRpbmd9YCwgcGN0OiBudWxsfTtcbiAgY29uc3QgZWxhcHNlZE1zID0gRGF0ZS5ub3coKSAtIF9zdGVwU3RhcnRUaW1lO1xuICBjb25zdCBwcm9ncmVzcyAgPSBfc3RlcFByb2dyZXNzW2lkeF07XG4gIGlmICghcHJvZ3Jlc3MgfHwgIXByb2dyZXNzLmN1cnJlbnQpIHtcbiAgICBjb25zdCBlc3QgPSBfZXN0aW1hdGVIbXNGb3IoZGVmKTtcbiAgICByZXR1cm4ge1xuICAgICAgdGV4dDogZXN0ID8gYCR7ZGVmLmxhYmVsfSDCtyAke19mbXRFbGFwc2VkKGVsYXBzZWRNcyl9ICh+JHtlc3R9KWAgOiBgJHtkZWYubGFiZWx9IMK3ICR7X2ZtdEVsYXBzZWQoZWxhcHNlZE1zKX1gLFxuICAgICAgcGN0OiBudWxsLFxuICAgIH07XG4gIH1cbiAgY29uc3Qge2N1cnJlbnQsIHRvdGFsfSA9IHByb2dyZXNzO1xuICBjb25zdCBwY3QgICAgPSBNYXRoLnJvdW5kKGN1cnJlbnQgLyB0b3RhbCAqIDEwMCk7XG4gIC8vIEVUQSBmcm9tIHRocm91Z2hwdXQgc2luY2UgdGhlIHJhdGUgYW5jaG9yIChmaXJzdCBvYnNlcnZlZCBjb3VudCksIG5vdCBmcm9tXG4gIC8vIGVsYXBzZWQvY3VycmVudCAtIHRoZSBsYXR0ZXIgbGV0IGEgc2xvdyBjb2xkIGZpcnN0IGl0ZW0gcHJvamVjdCBhYnN1cmRcbiAgLy8gZmlndXJlcyAoZS5nLiBcIjc3IG1pbiBsZWZ0XCIgdGhhdCB2YW5pc2hlZCB3aGVuIHRoZSBzdGVwIGZpbmlzaGVkIHNlY29uZHMgbGF0ZXIpLlxuICBjb25zdCBhbmNob3IgPSBfc3RlcFJhdGVBbmNob3JbaWR4XTtcbiAgbGV0IGV0YSA9ICcnO1xuICBpZiAoYW5jaG9yICYmIGN1cnJlbnQgPiBhbmNob3IuY3VycmVudCkge1xuICAgIGNvbnN0IG1zUGVySXRlbSA9IChEYXRlLm5vdygpIC0gYW5jaG9yLnQpIC8gKGN1cnJlbnQgLSBhbmNob3IuY3VycmVudCk7XG4gICAgY29uc3QgcmVtYWluaW5nTXMgPSBtc1Blckl0ZW0gKiAodG90YWwgLSBjdXJyZW50KTtcbiAgICBpZiAoaXNGaW5pdGUocmVtYWluaW5nTXMpICYmIHJlbWFpbmluZ01zID49IDApIGV0YSA9IGAgKH4ke19mbXRFbGFwc2VkKHJlbWFpbmluZ01zKX0gbGVmdClgO1xuICB9XG4gIHJldHVybiB7XG4gICAgdGV4dDogYCR7ZGVmLmxhYmVsfSDCtyAke2N1cnJlbnR9LyR7dG90YWx9ICgke3BjdH0lKSDCtyAke19mbXRFbGFwc2VkKGVsYXBzZWRNcyl9JHtldGF9YCxcbiAgICBwY3QsXG4gIH07XG59XG5cbi8vIFBhaW50cyBvbmUgc3RlcCBwaWxsJ3MgdGV4dCBhbmQsIGZvciBhbiBpbi1wcm9ncmVzcyBzdGVwIHdpdGgga25vd24gY291bnRzLFxuLy8gYSB0d28tdG9uZSBncmFkaWVudCBmaWxsIHN0YW5kaW5nIGluIGZvciBhIHByb2dyZXNzIGJhciAoZG9uZS9wZW5kaW5nIHBpbGxzXG4vLyBrZWVwIHRoZWlyIGZsYXQgQ1NTIGNsYXNzIGNvbG9yIC0gbm8gZmlsbCkuIFNoYXJlZCBieSB0aGUgaGVhZGVyIHBpbGwgcm93XG4vLyBhbmQgKHZpYSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSB0aGUgaW4tZGV0YWlsIG1pcnJvciBwYW5lbC5cbmZ1bmN0aW9uIF9yZW5kZXJTdGVwUGlsbChpZHgpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2lkeH1gKTtcbiAgaWYgKCFlbCB8fCAhZWwuY2xhc3NMaXN0LmNvbnRhaW5zKCdhY3RpdmUnKSkgcmV0dXJuO1xuICBjb25zdCB7dGV4dCwgcGN0fSA9IF9zdGVwUGlsbExhYmVsKGlkeCk7XG4gIGVsLnRleHRDb250ZW50ID0gdGV4dDtcbiAgZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gcGN0ICE9IG51bGxcbiAgICA/IGBsaW5lYXItZ3JhZGllbnQodG8gcmlnaHQsIHZhcigtLWdyZWVuKSAke3BjdH0lLCB2YXIoLS1hY2NlbnQpICR7cGN0fSUpYFxuICAgIDogJyc7XG59XG5cbmZ1bmN0aW9uIF90aWNrSm9iVGltZXIoKSB7XG4gIGlmICh3aW5kb3cuX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpO1xuICBpZiAoX2FjdGl2ZVN0ZXBJZHggPCAwKSByZXR1cm47XG4gIF9yZW5kZXJTdGVwUGlsbChfYWN0aXZlU3RlcElkeCk7XG59XG5cbmZ1bmN0aW9uIGVuZEpvYlVJKCkge1xuICBpZiAoX2pvYlRpbWVyKSB7IGNsZWFySW50ZXJ2YWwoX2pvYlRpbWVyKTsgX2pvYlRpbWVyID0gbnVsbDsgfVxuICBfam9iU3RlcERlZnMuZm9yRWFjaCgocywgaSkgPT4ge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtpfWApO1xuICAgIGlmIChlbCkgeyBlbC5jbGFzc05hbWUgPSAnc3RlcCBkb25lJzsgZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7IGVsLnRleHRDb250ZW50ID0gJ+Kckyc7IGVsLnRpdGxlID0gcy5sYWJlbDsgfVxuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jYW5jZWwtam9iJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgX2pvYlBhdXNhYmxlID0gZmFsc2U7XG4gIF9qb2JQYXVzZWQgICA9IGZhbHNlO1xuICBfcmVuZGVyUGF1c2VVSSgpO1xuICBpZiAoX2pvYlRoZXJtYWxQb2xsVGltZXIpIHsgY2xlYXJJbnRlcnZhbChfam9iVGhlcm1hbFBvbGxUaW1lcik7IF9qb2JUaGVybWFsUG9sbFRpbWVyID0gbnVsbDsgfVxuICBjb25zdCBncHVUZW1wID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1ncHUtdGVtcCcpO1xuICBpZiAoZ3B1VGVtcCkgZ3B1VGVtcC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBfam9iQWN0aXZlID0gZmFsc2U7XG4gIF9qb2JIaWRlVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBfam9iSGlkZVRpbWVyID0gbnVsbDtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXN0YXR1cycpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVhZGVyLXNwYWNlcicpLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjYnRuLWFuYWx5emUsI2J0bi1zY29yZScpLmZvckVhY2goYiA9PiBiLmRpc2FibGVkID0gZmFsc2UpO1xuICAgIGNvbnN0IGFuYWx5emVCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWFuYWx5emUnKTtcbiAgICBpZiAoYW5hbHl6ZUJ0bikgYW5hbHl6ZUJ0bi50aXRsZSA9ICcnO1xuICAgIF9zZXRKb2JCbG9ja2VkQnV0dG9ucyhmYWxzZSk7XG4gICAgY29uc3QgdG90YWxBcHByb3ZlZCA9IChBcHBTdGF0ZS52aWRlb3MgfHwgW10pLnJlZHVjZSgobiwgdikgPT4gbiArIHYuYXBwcm92ZWQsIDApO1xuICAgIHdpbmRvdy5fdXBkYXRlRGVtb0J1dHRvbih0b3RhbEFwcHJvdmVkKTtcbiAgICBpZiAod2luZG93Ll9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKSBfcmVuZGVyQ2xpcEZpbHRlckNvdW50cygpO1xuICB9LCAyMDAwKTtcbn1cblxuLy8g4pSA4pSAIFNTRSB0cmFuc3BvcnQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBMb3ctbGV2ZWwgU1NFIHJlYWRlciB1c2luZyBmZXRjaCArIFJlYWRhYmxlU3RyZWFtIHNvIG5vbi0yMDAgSFRUUCByZXNwb25zZXNcbi8vIGNhbiBiZSByZWFkIGZvciB0aGVpciBlcnJvciBkZXRhaWwgKEV2ZW50U291cmNlLm9uZXJyb3IgY2Fubm90IGRvIHRoaXMpLlxuLy9cbi8vIG9uTGluZShtc2cpICAtIGNhbGxlZCBmb3IgZWFjaCBwYXJzZWQgU1NFIHBheWxvYWQgYmVmb3JlIF9fRE9ORV9fXG4vLyBvbkRvbmUobXNnKSAgLSBjYWxsZWQgd2l0aCB0aGUgZnVsbCBfX0RPTkVfXyBwYXlsb2FkIChzdHJpbmcgb3Igb2JqZWN0KVxuLy8gb25FcnJvcihzdHIpIC0gY2FsbGVkIHdpdGggYSBwbGFpbi1sYW5ndWFnZSBtZXNzYWdlIG9uIEhUVFAgZXJyb3Igb3IgbmV0d29yayBsb3NzXG4vL1xuLy8gb3B0cyAob3B0aW9uYWwpOiBleHRyYSBmZXRjaCBpbml0LCBlLmcuIHttZXRob2Q6ICdQT1NUJ30gZm9yIHRoZSBtb2RlbC1kb3dubG9hZFxuLy8gZW5kcG9pbnRzLCB3aGljaCBhcmUgUE9TVC1vbmx5IChhIEdFVCA0MDVzKS4gRGVmYXVsdHMgdG8gYSBHRVQsIGFzIHRoZSBhbmFseXplXG4vLyBhbmQgc2NvcmUgU1NFIHN0cmVhbXMgdXNlLlxuLy8gUmV0dXJucyBhIGhhbmRsZSB3aXRoIC5jbG9zZSgpIHRoYXQgYWJvcnRzIHRoZSBpbi1mbGlnaHQgcmVxdWVzdC5cbmZ1bmN0aW9uIF9vcGVuU1NFKHVybCwgb25MaW5lLCBvbkRvbmUsIG9uRXJyb3IsIG9wdHMgPSB7fSkge1xuICBjb25zdCBjdHJsID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBjb25zdCBoYW5kbGUgPSB7Y2xvc2U6ICgpID0+IGN0cmwuYWJvcnQoKX07XG4gIGZldGNoKHVybCwge3NpZ25hbDogY3RybC5zaWduYWwsIC4uLm9wdHN9KS50aGVuKGFzeW5jIHJlcyA9PiB7XG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIGNvbnN0IGVyckRhdGEgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgICAgb25FcnJvcihmb3JtYXRBcGlFcnJvcihlcnJEYXRhKSB8fCBgU2VydmVyIGVycm9yICR7cmVzLnN0YXR1c31gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcmVhZGVyID0gcmVzLmJvZHkuZ2V0UmVhZGVyKCk7XG4gICAgY29uc3QgZGVjID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgbGV0IGJ1ZiA9ICcnO1xuICAgIHRyeSB7XG4gICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBjb25zdCB7ZG9uZSwgdmFsdWV9ID0gYXdhaXQgcmVhZGVyLnJlYWQoKTtcbiAgICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgICBpZiAoIWN0cmwuc2lnbmFsLmFib3J0ZWQpIG9uRXJyb3IoJ1N0cmVhbSBlbmRlZCB3aXRob3V0IGEgY29tcGxldGlvbiBzaWduYWwnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgYnVmICs9IGRlYy5kZWNvZGUodmFsdWUsIHtzdHJlYW06IHRydWV9KTtcbiAgICAgICAgY29uc3QgbGluZXMgPSBidWYuc3BsaXQoJ1xcbicpO1xuICAgICAgICBidWYgPSBsaW5lcy5wb3AoKTtcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIGxpbmVzKSB7XG4gICAgICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJ2RhdGE6ICcpKSBjb250aW51ZTtcbiAgICAgICAgICBjb25zdCBtc2cgPSBKU09OLnBhcnNlKGxpbmUuc2xpY2UoNikpO1xuICAgICAgICAgIGNvbnN0IGlzRG9uZSA9IG1zZyA9PT0gJ19fRE9ORV9fJyB8fCAobXNnICYmIHR5cGVvZiBtc2cgPT09ICdvYmplY3QnICYmIG1zZy50eXBlID09PSAnX19ET05FX18nKTtcbiAgICAgICAgICBpZiAoaXNEb25lKSB7IG9uRG9uZShtc2cpOyByZXR1cm47IH1cbiAgICAgICAgICBvbkxpbmUobXNnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKCFjdHJsLnNpZ25hbC5hYm9ydGVkKSBvbkVycm9yKCdDb25uZWN0aW9uIGxvc3QgLSBzZXJ2ZXIgZGlzY29ubmVjdGVkJyk7XG4gICAgfVxuICB9KS5jYXRjaChlcnIgPT4ge1xuICAgIGlmICghY3RybC5zaWduYWwuYWJvcnRlZCkgb25FcnJvcih3aW5kb3cubmV0RXJyTXNnKGVycikpO1xuICB9KTtcbiAgcmV0dXJuIGhhbmRsZTtcbn1cblxuLy8gT25seSBvbmUgam9iIHN0cmVhbSBpcyBsaXZlIGF0IGEgdGltZS4gU3RhcnRpbmcgYSBuZXcgam9iIGFib3J0cyB0aGUgcHJldmlvdXNcbi8vIG9uZSAtIGJ1dCBhYm9ydGluZyBzdXBwcmVzc2VzIGl0cyBvbkRvbmUvb25FcnJvciwgc28gaXRzIFVJIHRlYXJkb3duIChidXR0b25cbi8vIHJlLWVuYWJsZSwgcHJvZ3Jlc3MgcGlsbCkgd291bGQgbmV2ZXIgcnVuLiBFYWNoIGpvYiByZWdpc3RlcnMgdGhhdCB0ZWFyZG93biBhc1xuLy8gYSBjbGVhbnVwIHNvIGEgc3VwZXJzZWRpbmcgam9iIGNhbiBydW4gaXQuIFNlZSBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtLlxuZnVuY3Rpb24gX3NldEFjdGl2ZVN0cmVhbShoYW5kbGUsIGNsZWFudXAgPSBudWxsKSB7XG4gIF9hY3RpdmVFUyA9IGhhbmRsZTtcbiAgX2FjdGl2ZUpvYkNsZWFudXAgPSBjbGVhbnVwO1xufVxuXG5mdW5jdGlvbiBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKSB7XG4gIGlmIChfYWN0aXZlRVMgPT09IGhhbmRsZSkgeyBfYWN0aXZlRVMgPSBudWxsOyBfYWN0aXZlSm9iQ2xlYW51cCA9IG51bGw7IH1cbn1cblxuZnVuY3Rpb24gX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpIHtcbiAgaWYgKF9hY3RpdmVFUykgeyBfYWN0aXZlRVMuY2xvc2UoKTsgX2FjdGl2ZUVTID0gbnVsbDsgfVxuICBpZiAoX2FjdGl2ZUpvYkNsZWFudXApIHsgY29uc3QgY2xlYW51cCA9IF9hY3RpdmVKb2JDbGVhbnVwOyBfYWN0aXZlSm9iQ2xlYW51cCA9IG51bGw7IGNsZWFudXAoKTsgfVxufVxuXG4vLyBHdWFyZCBmb3IgY29tcGV0aW5nIFNTRSBqb2JzIChyZS1zY29yZSwgdGltZWxpbmUsIHN1bW1hcnksIGRpYXJpemUsIOKApikuIFdoaWxlXG4vLyBhbiBhbmFseXNpcyBpcyBydW5uaW5nIHRoZSBiYWNrZW5kIDQwOXMgdGhlc2UgYW55d2F5LCBidXQgdGhleSBjYWxsXG4vLyBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCkgZmlyc3QsIHdoaWNoIHdvdWxkIHRlYXIgZG93biB0aGUgbGl2ZSBhbmFseXplIHByb2dyZXNzXG4vLyBVSSBiZWZvcmUgdGhlIHJlamVjdGlvbiBsYW5kcy4gUmV0dXJucyB0cnVlIChhbmQgdG9hc3RzKSBzbyB0aGUgY2FsbGVyIGNhbiBiYWlsXG4vLyBiZWZvcmUgYW55IHNpZGUgZWZmZWN0cy5cbmZ1bmN0aW9uIF9ibG9ja2VkQnlBbmFseXplKGFjdGlvbkxhYmVsKSB7XG4gIGlmICghQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lKSByZXR1cm4gZmFsc2U7XG4gIHdpbmRvdy5zaG93VG9hc3QoYFdhaXQgZm9yIHRoZSBjdXJyZW50IGFuYWx5c2lzIHRvIGZpbmlzaCBiZWZvcmUgeW91ICR7YWN0aW9uTGFiZWx9LmAsICd3YXJuaW5nJyk7XG4gIHJldHVybiB0cnVlO1xufVxuXG4vLyBvbkxpbmUgKG9wdGlvbmFsKTogY2FsbGVkIHdpdGggZWFjaCByYXcgU1NFIHBheWxvYWQgbGluZSBiZWZvcmUgX19ET05FX18sIGZvclxuLy8gY2FsbGVycyB0aGF0IG5lZWQgbGl2ZSBwcm9ncmVzcyB0ZXh0IChlLmcuIHRoZSBwcm94eS1idWlsZCBwZXJjZW50YWdlKS5cbi8vIG9wdHMgKG9wdGlvbmFsKTogZmV0Y2ggaW5pdCBwYXNzZWQgdGhyb3VnaCB0byBfb3BlblNTRSwgZS5nLiB7bWV0aG9kOiAnUE9TVCd9XG4vLyBmb3IgYSBQT1NULW9ubHkgU1NFIGVuZHBvaW50IChhbmFseXplLWZyYW1lcykuXG4vLyBvbkVycm9yIChvcHRpb25hbCk6IGNhbGxlZCBhZnRlciB0aGUgYnVpbHQtaW4gZXJyb3IgaGFuZGxpbmcgKHRvYXN0ICsgZW5kSm9iVUkpXG4vLyBzbyBhIGNhbGxlciBjYW4gcnVuIGl0cyBvd24gdGVybWluYWwgY2xlYW51cCBvbiBhbiBIVFRQL3RyYW5zcG9ydCBmYWlsdXJlIC0gZS5nLlxuLy8gY2xlYXJpbmcgYSBwZXItaXRlbSBpbi1mbGlnaHQgZmxhZyB0aGF0IG9ubHkgaXRzIG9uRG9uZSB3b3VsZCBvdGhlcndpc2UgY2xlYXIuXG5mdW5jdGlvbiBzdHJlYW1TU0UodXJsLCBvbkRvbmUsIHN0ZXBEZWZzLCBqb2JMYWJlbCwgY2FuY2VsbGFibGUgPSBmYWxzZSwgb25MaW5lID0gbnVsbCwgcGF1c2FibGUgPSBmYWxzZSwgb3B0cyA9IHt9LCBvbkVycm9yID0gbnVsbCkge1xuICBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCk7XG4gIGlmIChzdGVwRGVmcykgc3RhcnRKb2JVSShzdGVwRGVmcywgam9iTGFiZWwsIGNhbmNlbGxhYmxlLCBwYXVzYWJsZSk7XG4gIGNvbnN0IGhhbmRsZSA9IF9vcGVuU1NFKFxuICAgIHVybCxcbiAgICB0ZXh0ID0+IHtcbiAgICAgIC8vIEEgQEBQUk9HUkVTUyBtYXJrZXIgZHJpdmVzIHRoZSBwaWxscyBkZXRlcm1pbmlzdGljYWxseSBhbmQgaXMgTk9UIHNob3duIGFzXG4gICAgICAvLyBhIGxvZyBsaW5lOyBldmVyeXRoaW5nIGVsc2UgZmFsbHMgdGhyb3VnaCB0byB0aGUgbG9nICsgcHJvc2UgZmFsbGJhY2suXG4gICAgICBjb25zdCBtYXJrZXIgPSBzdGVwRGVmcyA/IHBhcnNlUHJvZ3Jlc3ModGV4dCkgOiBudWxsO1xuICAgICAgaWYgKG1hcmtlcikgeyBfZHJpdmVTdGVwRnJvbU1hcmtlcihtYXJrZXIpOyByZXR1cm47IH1cbiAgICAgIHdpbmRvdy5hcHBlbmRMb2codGV4dCk7IGlmIChvbkxpbmUpIG9uTGluZSh0ZXh0KTsgaWYgKHN0ZXBEZWZzKSB1cGRhdGVKb2JVSSh0ZXh0KTtcbiAgICB9LFxuICAgICgpID0+IHtcbiAgICAgIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpO1xuICAgICAgaWYgKHN0ZXBEZWZzKSBlbmRKb2JVSSgpO1xuICAgICAgaWYgKG9uRG9uZSkgb25Eb25lKCk7XG4gICAgfSxcbiAgICBlcnJNc2cgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICB3aW5kb3cuYXBwZW5kTG9nKGBbJHtlcnJNc2d9XWApO1xuICAgICAgd2luZG93LnNob3dUb2FzdChlcnJNc2csICdlcnJvcicpO1xuICAgICAgd2luZG93LlNvdW5kRngucGxheSgnZXJyb3InKTtcbiAgICAgIGlmIChzdGVwRGVmcykgZW5kSm9iVUkoKTtcbiAgICAgIGlmIChvbkVycm9yKSBvbkVycm9yKGVyck1zZyk7XG4gICAgICB3aW5kb3cubG9hZFZpZGVvcygpO1xuICAgIH0sXG4gICAgb3B0cyxcbiAgKTtcbiAgX3NldEFjdGl2ZVN0cmVhbShoYW5kbGUsIHN0ZXBEZWZzID8gZW5kSm9iVUkgOiBudWxsKTtcbn1cblxuLy8gUG9sbGVkIGJ5IHRoZSBKUyBzZXF1ZW50aWFsLXNlZ21lbnQgcnVubmVycyAoYW5hbHl6ZS5qcydzIHByZS1zcGxpdCBsb29wLFxuLy8gc3BsaXQuanMncyByZS1zcGxpdCBsb29wKSBiZWZvcmUgZmlyaW5nIG9mZiBlYWNoIHNlZ21lbnQncyBvd24gYW5hbHl6ZSBqb2IuXG4vLyBFYWNoIHNlZ21lbnQgaXMgYSBzZXBhcmF0ZSBBbmFseXplSm9iLCBzbyB0aGVyZSBpcyBhIGdhcCBiZXR3ZWVuIHNlZ21lbnRzXG4vLyB3aXRoIG5vIFwicnVubmluZ1wiIGpvYiBmb3IgL2FwaS9zdGF0dXMncyBhbmFseXplX3BhdXNlZCB0byBrZXkgb2ZmIC0gdGhpc1xuLy8gY2hlY2tzIHRoZSByYXcgcGF1c2UgZmxhZyBmaWxlIGluc3RlYWQgKHBhdXNlX2ZsYWdfc2V0KS5cbmFzeW5jIGZ1bmN0aW9uIF93YWl0V2hpbGVBbmFseXplUGF1c2VkKCkge1xuICBsZXQgdG9hc3RlZCA9IGZhbHNlO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IGZldGNoKCcvYXBpL3N0YXR1cycpLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgaWYgKCFzdGF0dXMgfHwgIXN0YXR1cy5wYXVzZV9mbGFnX3NldCkgcmV0dXJuO1xuICAgIGlmICghdG9hc3RlZCkgeyB3aW5kb3cuc2hvd1RvYXN0KCdQYXVzZWQgLSB3aWxsIGhvbGQgYmVmb3JlIHRoZSBuZXh0IHNlZ21lbnQnLCAnaW5mbycpOyB0b2FzdGVkID0gdHJ1ZTsgfVxuICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAzMDAwKSk7XG4gIH1cbn1cblxuLy8g4pSA4pSAIGpvYiBjYW5jZWxsYXRpb24g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUaGUgam9iLWhlYWRlciBDYW5jZWwgYnV0dG9uIHNlcnZlcyB3aGljaGV2ZXIgY2FuY2VsbGFibGUgam9iIGlzIHJ1bm5pbmcuIEVhY2hcbi8vIGNhbmNlbGxhYmxlIGZsb3cgc2V0cyBfYWN0aXZlQ2FuY2VsICh2aWEgc2V0Sm9iQ2FuY2VsKSBzbyB0aGUgY29uZmlybSBjb3B5IGFuZFxuLy8gdGhlIGNhbmNlbCBlbmRwb2ludCBtYXRjaCB0aGUgam9iOyBzdGFydEpvYlVJIHJlc2V0cyBpdCB0byB0aGUgYW5hbHl6ZSBkZWZhdWx0LlxuY29uc3QgX0FOQUxZWkVfQ0FOQ0VMID0ge1xuICB1cmw6ICAgICAgJy9hcGkvYW5hbHl6ZS9jYW5jZWwnLFxuICB0aXRsZTogICAgJ0NhbmNlbCBhbmFseXNpcz8nLFxuICBib2R5OiAgICAgJ0FsbCBwcm9ncmVzcyBmb3IgdGhpcyByZWNvcmRpbmcgd2lsbCBiZSBsb3N0IGFuZCB5b3Ugd2lsbCBuZWVkIHRvIGFuYWx5emUgaXQgYWdhaW4uJyxcbiAgY29uZmlybTogICdDYW5jZWwgQW5hbHlzaXMnLFxuICBsb2dNc2c6ICAgJ1tBbmFseXNpcyBjYW5jZWxsZWRdJyxcbn07XG5sZXQgX2FjdGl2ZUNhbmNlbCA9IF9BTkFMWVpFX0NBTkNFTDtcblxuZnVuY3Rpb24gc2V0Sm9iQ2FuY2VsKGNmZykgeyBfYWN0aXZlQ2FuY2VsID0gY2ZnIHx8IF9BTkFMWVpFX0NBTkNFTDsgfVxuXG5mdW5jdGlvbiBjYW5jZWxKb2IoKSB7XG4gIHdpbmRvdy5zaG93Q29uZmlybShcbiAgICBfYWN0aXZlQ2FuY2VsLnRpdGxlLFxuICAgIF9hY3RpdmVDYW5jZWwuYm9keSxcbiAgICBfYWN0aXZlQ2FuY2VsLmNvbmZpcm0sXG4gICAgX2RvQ2FuY2VsSm9iLFxuICAgIHRydWUsXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9kb0NhbmNlbEpvYigpIHtcbiAgY29uc3QgY2FuY2VsID0gX2FjdGl2ZUNhbmNlbDtcbiAgLy8gQ2FuY2VsIG9uIHRoZSBzZXJ2ZXIgRklSU1QgLSBpZiBpdCBmYWlscywgdGhlIGpvYiBpcyBzdGlsbCBydW5uaW5nLCBzb1xuICAvLyBrZWVwIHRoZSBzdHJlYW0gYXR0YWNoZWQgYW5kIHRoZSBqb2IgVUkgdXAgaW5zdGVhZCBvZiBwcmV0ZW5kaW5nIGl0IHN0b3BwZWQuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goY2FuY2VsLnVybCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgaWYgKCFyZXMub2spIHRocm93IG5ldyBFcnJvcihgU2VydmVyIGVycm9yICR7cmVzLnN0YXR1c31gKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgd2luZG93LnNob3dUb2FzdChgQ291bGQgbm90IGNhbmNlbCAtICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKTtcbiAgd2luZG93LmFwcGVuZExvZyhjYW5jZWwubG9nTXNnKTtcbiAgZW5kSm9iVUkoKTtcbiAgLy8gQSBqb2Itc3BlY2lmaWMgdGVybWluYWwgY2xlYW51cCAoZS5nLiBjbGVhcmluZyBhIHBlci1jbGlwIGluLWZsaWdodCBmbGFnIHNvXG4gIC8vIGl0cyBidXR0b24gbGVhdmVzIHRoZSBzcGlubmVyKSAtIHRoZSBnZW5lcmljIGFuYWx5emUgY2FuY2VsIHNldHMgbm9uZS5cbiAgaWYgKGNhbmNlbC5vbkNhbmNlbCkgY2FuY2VsLm9uQ2FuY2VsKCk7XG4gIC8vIENsZWFyIHRoZSBhbmFseXppbmcgbWFya2VyIHNvIGxvYWRWaWRlb3MoKSBkcm9wcyB0aGUgc2lkZWJhciBwbGFjZWhvbGRlciAvXG4gIC8vIHNwaW5uZXIuIExlZnQgc2V0LCBhIGNhbmNlbGxlZCBydW4gd2hvc2UgREIgcm93IG5ldmVyIG1hdGVyaWFsaXNlZCB3b3VsZFxuICAvLyBrZWVwIGFuIHVuY2xpY2thYmxlIFwiQW5hbHl6aW5n4oCmXCIgcGxhY2Vob2xkZXIgdW50aWwgYSBtYW51YWwgcGFnZSByZWZyZXNoLlxuICBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUgPSBudWxsO1xuICB3aW5kb3cubG9hZFZpZGVvcygpO1xufVxuXG5leHBvcnQge1xuICBJTkdFU1RfU1RFUFMsIFNDT1JFX1NURVBTLCBGUkFNRVNfU1RFUFMsIEpPQl9TVEFHRVMsIHBhcnNlUHJvZ3Jlc3MsIF9kcml2ZVN0ZXBGcm9tTWFya2VyLFxuICBzdGFydEpvYlVJLCB1cGRhdGVKb2JVSSwgZW5kSm9iVUksIGFwcGx5Sm9iQmxvY2tlZFN0YXRlLCBfc3RlcFBpbGxMYWJlbCwgX3JlbmRlclN0ZXBQaWxsLCBfdGlja0pvYlRpbWVyLFxuICBfc2V0UGF1c2VkVUlGcm9tU3RhdHVzLCB0b2dnbGVQYXVzZUpvYiwgX3BvbGxUaGVybWFsU3RhdHVzLFxuICBfb3BlblNTRSwgc3RyZWFtU1NFLCBfc2V0QWN0aXZlU3RyZWFtLCBfY2xlYXJBY3RpdmVTdHJlYW0sIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0sXG4gIF9ibG9ja2VkQnlBbmFseXplLCBfd2FpdFdoaWxlQW5hbHl6ZVBhdXNlZCxcbiAgc2V0Sm9iQ2FuY2VsLCBjYW5jZWxKb2IsXG59O1xuXG4vLyBUaGUgam9iIGhlYWRlcidzIFBhdXNlL0NhbmNlbCBidXR0b25zIGFyZSBzdGF0aWMgbWFya3VwIGluIGluZGV4Lmh0bWwgKG5ldmVyXG4vLyByZS1yZW5kZXJlZCksIHNvIGEgc2luZ2xlIGxpc3RlbmVyIHdpcmVkIG9uY2UgYXQgbW9kdWxlIGxvYWQgLSByZXBsYWNpbmcgdGhlXG4vLyBvbmNsaWNrPVwidG9nZ2xlUGF1c2VKb2IoKVwiL1wiY2FuY2VsSm9iKClcIiBhdHRyaWJ1dGVzIHRoYXQgdXNlZCB0byBsaXZlIHRoZXJlIC1cbi8vIGNhbiBuZXZlciBkb3VibGUtd2lyZS4gKHZpZGVvcy5qcydzIGluLWRldGFpbCBDYW5jZWwgYnV0dG9uIHN0aWxsIHVzZXMgaXRzIG93blxuLy8gaW5saW5lIG9uY2xpY2s9XCJjYW5jZWxKb2IoKVwiOyB0aGF0IG1hcmt1cCBsaXZlcyBpbiB2aWRlb3MuanMsIG91dCBvZiBzY29wZSBoZXJlLilcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tcGF1c2Utam9iJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0b2dnbGVQYXVzZUpvYik7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNhbmNlbC1qb2InKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGNhbmNlbEpvYik7XG4iLCAiLy8gRVNNIGVudHJ5IHBvaW50IC0gdGhlIHN0cmFuZ2xlci1maWcgc2VhbSAoV1M1IHN0ZXAgMikuIGVzYnVpbGQgYnVuZGxlcyB0aGlzXG4vLyBtb2R1bGUgZ3JhcGggaW50byBzdGF0aWMvYnVuZGxlLmVzbS5qcyAoc2VlIHNjcmlwdHMvYnVpbGQtZXNtLm1qcywgcnVuIGJ5XG4vLyBgeXV1LWRldiBidW5kbGVgKS4gRXZlcnl0aGluZyByZWFjaGFibGUgZnJvbSBoZXJlIGlzIHJlYWwgRVNNIChpbXBvcnQvZXhwb3J0KTtcbi8vIHRoZSBjbGFzc2ljIGdsb2JhbC1zY29wZSBzY3JpcHRzIHN0aWxsIGluIGJ1bmRsZS5qcyBjYWxsIHRoZXNlIG1vZHVsZXMgYXNcbi8vIHdpbmRvdyBnbG9iYWxzLCBzbyB0aGlzIGVudHJ5IHJlLWV4cG9zZXMgZWFjaCBtaWdyYXRlZCBtb2R1bGUncyBwdWJsaWMgc3VyZmFjZVxuLy8gb24gd2luZG93IGFzIGEgY29tcGF0aWJpbGl0eSBzaGltLlxuLy9cbi8vIE1pZ3JhdGluZyBhIGNsYXNzaWMgY29uc3VtZXIgdG8gYGltcG9ydGAgc2hyaW5rcyB0aGUgc2hpbTogb25jZSBub3RoaW5nIHJlYWRzIGFcbi8vIG5hbWUgb2ZmIHdpbmRvdywgZGVsZXRlIGl0cyBsaW5lIGJlbG93LiBXaGVuIGJ1bmRsZS5qcyBpcyBlbXB0eSwgdGhpcyBmaWxlIGlzXG4vLyB0aGUgd2hvbGUgYXBwIGFuZCB0aGUgc2hpbSBpcyBnb25lLlxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCAqIGFzIGZvcm1hdCBmcm9tICcuL2Zvcm1hdC5qcyc7XG5pbXBvcnQgeyBDb2xvclBpY2tlciB9IGZyb20gJy4vY29sb3JwaWNrZXIuanMnO1xuaW1wb3J0IHsgUGFuZWxOYXYgfSBmcm9tICcuL3BhbmVsbmF2LmpzJztcbmltcG9ydCAqIGFzIGpvYnMgZnJvbSAnLi9qb2JzLmpzJztcblxud2luZG93LkFwcFN0YXRlID0gQXBwU3RhdGU7XG5PYmplY3QuYXNzaWduKHdpbmRvdywgZm9ybWF0KTtcbndpbmRvdy5Db2xvclBpY2tlciA9IENvbG9yUGlja2VyO1xud2luZG93LlBhbmVsTmF2ID0gUGFuZWxOYXY7XG4vLyBqb2JzLmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBldmVyeSBleHBvcnQgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyIG9yIGEgc3RpbGwtcHJlc2VudCBpbmxpbmUgaGFuZGxlciwgc28gbm9uZSBvZiB0aGVzZSBjYW5cbi8vIGJlIGRyb3BwZWQgeWV0LiBJdHMgaGFuZGZ1bCBvZiBtdXRhYmxlIHNoYXJlZC1zdGF0ZSBnbG9iYWxzIChfam9iU3RlcERlZnMsXG4vLyBfYWN0aXZlRVMsIGV0Yy4pIGFyZSBOT1QgaGVyZSAtIGpvYnMuanMgd2lyZXMgdGhvc2Ugb250byB3aW5kb3cgaXRzZWxmIHZpYVxuLy8gbGl2ZSBnZXQvc2V0IGFjY2Vzc29ycywgc2luY2UgYSBwbGFpbiBzbmFwc2hvdCB3b3VsZCBnbyBzdGFsZSBvbiByZWFzc2lnbm1lbnQuXG5PYmplY3QuYXNzaWduKHdpbmRvdywgam9icyk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7OztBQU1PLE1BQU0sV0FBVztBQUFBLElBQ3RCLGVBQXFCO0FBQUEsSUFDckIsY0FBcUI7QUFBQSxJQUNyQixRQUFxQixDQUFDO0FBQUEsSUFDdEIsVUFBcUIsQ0FBQztBQUFBO0FBQUEsSUFDdEIsaUJBQXFCO0FBQUE7QUFBQSxJQUNyQixPQUFxQixDQUFDO0FBQUEsSUFDdEIsaUJBQXFCLENBQUM7QUFBQSxJQUN0QixVQUFxQixDQUFDO0FBQUEsSUFDdEIsVUFBcUIsQ0FBQztBQUFBLElBQ3RCLGlCQUFxQjtBQUFBLElBQ3JCLGdCQUFxQixDQUFDO0FBQUEsSUFDdEIsdUJBQXVCO0FBQUEsSUFDdkIsaUJBQXFCO0FBQUEsSUFDckIsa0JBQXFCO0FBQUEsSUFDckIsYUFBcUIsb0JBQUksSUFBSTtBQUFBO0FBQUEsSUFDN0IsVUFBcUI7QUFBQTtBQUFBLElBQ3JCLFlBQXFCO0FBQUEsSUFDckIsY0FBcUI7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QUUsS0FBSyxDQUFDLEVBQUUsTUFBTSxNQUFNLElBQUk7QUFDOUUsVUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLGVBQWdCO0FBQ3ZDLFVBQUksQ0FBQyxTQUFTO0FBQUUsZUFBTyxVQUFVLDhDQUE4QyxNQUFNO0FBQUcsa0JBQVU7QUFBQSxNQUFNO0FBQ3hHLFlBQU0sSUFBSSxRQUFRLGFBQVcsV0FBVyxTQUFTLEdBQUksQ0FBQztBQUFBLElBQ3hEO0FBQUEsRUFDRjtBQU1BLE1BQU0sa0JBQWtCO0FBQUEsSUFDdEIsS0FBVTtBQUFBLElBQ1YsT0FBVTtBQUFBLElBQ1YsTUFBVTtBQUFBLElBQ1YsU0FBVTtBQUFBLElBQ1YsUUFBVTtBQUFBLEVBQ1o7QUFDQSxNQUFJLGdCQUFnQjtBQUVwQixXQUFTLGFBQWEsS0FBSztBQUFFLG9CQUFnQixPQUFPO0FBQUEsRUFBaUI7QUFFckUsV0FBUyxZQUFZO0FBQ25CLFdBQU87QUFBQSxNQUNMLGNBQWM7QUFBQSxNQUNkLGNBQWM7QUFBQSxNQUNkLGNBQWM7QUFBQSxNQUNkO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBRUEsaUJBQWUsZUFBZTtBQUM1QixVQUFNLFNBQVM7QUFHZixRQUFJO0FBQ0YsWUFBTSxNQUFNLE1BQU0sTUFBTSxPQUFPLEtBQUssRUFBQyxRQUFRLE9BQU0sQ0FBQztBQUNwRCxVQUFJLENBQUMsSUFBSSxHQUFJLE9BQU0sSUFBSSxNQUFNLGdCQUFnQixJQUFJLE1BQU0sRUFBRTtBQUFBLElBQzNELFNBQVMsS0FBSztBQUNaLGFBQU8sVUFBVSxzQkFBc0IsSUFBSSxPQUFPLElBQUksT0FBTztBQUM3RDtBQUFBLElBQ0Y7QUFDQSwyQkFBdUI7QUFDdkIsV0FBTyxVQUFVLE9BQU8sTUFBTTtBQUM5QixhQUFTO0FBR1QsUUFBSSxPQUFPLFNBQVUsUUFBTyxTQUFTO0FBSXJDLGFBQVMsa0JBQWtCO0FBQzNCLFdBQU8sV0FBVztBQUFBLEVBQ3BCO0FBZ0JBLFdBQVMsZUFBZSxlQUFlLEVBQUUsaUJBQWlCLFNBQVMsY0FBYztBQUNqRixXQUFTLGVBQWUsZ0JBQWdCLEVBQUUsaUJBQWlCLFNBQVMsU0FBUzs7O0FDdGxCN0UsU0FBTyxXQUFXO0FBQ2xCLFNBQU8sT0FBTyxRQUFRLGNBQU07QUFDNUIsU0FBTyxjQUFjO0FBQ3JCLFNBQU8sV0FBVztBQU1sQixTQUFPLE9BQU8sUUFBUSxZQUFJOyIsCiAgIm5hbWVzIjogWyJlbCJdCn0K
