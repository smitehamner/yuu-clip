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
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3RhdGUuanMiLCAiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgImpvYnMuanMiLCAicHJldmlldy5qcyIsICJ1dGlscy5qcyIsICJ1aS5qcyIsICJoZWxwbW9kYWxzLmpzIiwgInNob3J0Y3V0cy5qcyIsICJtb2RlbGNhdGFsb2cuanMiLCAidmlkZW9zLmpzIiwgInZpZGVvcy10aW1lbGluZS5qcyIsICJ2aWRlb3Mtc3VtbWFyeS5qcyIsICJ2aWRlb3MtcnVubWV0YS5qcyIsICJzZXNzaW9ucy5qcyIsICJjbGlwcy5qcyIsICJtYWluLmVzbS5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgYXBwbGljYXRpb24gc3RhdGU6IHRoZSBzaW5nbGUgQXBwU3RhdGUgb2JqZWN0IGV2ZXJ5IGZlYXR1cmUgbW9kdWxlIHJlYWRzL3dyaXRlcy5cbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IGNvdmVyZWQgaW5kaXJlY3RseSBieSB0aGUgdGVzdF91aV8qLnB5IHN1aXRlc1xuLy8g4pSA4pSAIHNoYXJlZCBhcHBsaWNhdGlvbiBzdGF0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIE11dGFibGUgc3RhdGUgc2hhcmVkIGFjcm9zcyBmZWF0dXJlIG1vZHVsZXMuIENlbnRyYWxpemVkIGluIG9uZSBleHBsaWNpdCBvYmplY3Rcbi8vIHNvIGNyb3NzLW1vZHVsZSByZWFkcy93cml0ZXMgYXJlIGdyZXBwYWJsZSBhbmQgb2J2aW91c2x5IHNoYXJlZCwgcmF0aGVyIHRoYW5cbi8vIHNjYXR0ZXJlZCBiYXJlIGdsb2JhbHMgdGhhdCBsb29rIGxpa2UgbW9kdWxlIGxvY2FscyBhdCB0aGUgY2FsbCBzaXRlLlxuZXhwb3J0IGNvbnN0IEFwcFN0YXRlID0ge1xuICBhY3RpdmVWaWRlb0lkOiAgICAgICBudWxsLFxuICBhY3RpdmVDbGlwSWQ6ICAgICAgICBudWxsLFxuICB2aWRlb3M6ICAgICAgICAgICAgICBbXSxcbiAgc2Vzc2lvbnM6ICAgICAgICAgICAgW10sICAgICAgIC8vIGdyb3VwZWQgcGxheSBzZXNzaW9ucyAoUmVjb3JkaW5nU2Vzc2lvbiByb3dzKVxuICBhY3RpdmVTZXNzaW9uSWQ6ICAgICBudWxsLCAgICAgLy8gc2Vzc2lvbiB3aG9zZSBkZXRhaWwgdmlldyBpcyBvcGVuLCBvciBudWxsXG4gIGNsaXBzOiAgICAgICAgICAgICAgIFtdLFxuICBhbmFseXplUHJvZmlsZXM6ICAgICBbXSxcbiAgY29udGV4dHM6ICAgICAgICAgICAgW10sXG4gIGhvdFdvcmRzOiAgICAgICAgICAgIFtdLFxuICBfaG90V29yZHNMb2FkZWQ6ICAgICBmYWxzZSxcbiAgc2Vuc2l0aXZlVGVybXM6ICAgICAgW10sXG4gIF9zZW5zaXRpdmVUZXJtc0xvYWRlZDogZmFsc2UsXG4gIGFuYWx5emVGaWxlbmFtZTogICAgIG51bGwsXG4gIGVkaXRpbmdDb250ZXh0SWQ6ICAgIG51bGwsXG4gIGNsaXBGaWx0ZXJzOiAgICAgICAgIG5ldyBTZXQoKSwgIC8vIGFjdGl2ZSBmaWx0ZXIgdG9rZW5zOyBlbXB0eSA9IHNob3cgYWxsXG4gIGNsaXBLaW5kOiAgICAgICAgICAgICdjbGlwJywgICAgICAvLyBjYW5kaWRhdGUgdHlwZSBzaG93bjogJ2NsaXAnIHwgJ3NjZW5lJyAoc2VydmVyLXNpZGUgZmlsdGVyKVxuICBjbGlwU2VhcmNoOiAgICAgICAgICAnJyxcbiAgY2xpcFNjb3JlTWluOiAgICAgICAgMCxcbiAgdmlkZW9TZWFyY2g6ICAgICAgICAgJycsXG4gIHZpZGVvU29ydDogICAgICAgICAgICdyZWNlbnQnLFxuICB2aWRlb1NvcnREaXI6ICAgICAgICAnZGVzYycsICAvLyAnZGVzYycgPSB0aGUgc29ydCBvcHRpb24ncyBuYXR1cmFsIG9yZGVyOyAnYXNjJyByZXZlcnNlcyBpdFxuICBjbGlwU29ydERpcjogICAgICAgICAnZGVzYycsXG4gIHZpZGVvRmlsdGVyczogICAgICAgIG5ldyBTZXQoKSwgIC8vIGFjdGl2ZSB2aWRlbyBmaWx0ZXIgdG9rZW5zOyBlbXB0eSA9IHNob3cgYWxsXG4gIHNlbGVjdGVkQ2xpcElkczogICAgIG5ldyBTZXQoKSxcbiAgbGFzdFN0YXR1c0NoYW5nZTogICAgbnVsbCwgLy8ge2NsaXBJZCwgZnJvbVN0YXR1cywgdGltZXJ9XG4gIGxhc3RCdWxrU3RhdHVzQ2hhbmdlOiBudWxsLCAvLyB7cHJldmlvdXM6IHtjbGlwSWQ6IGZyb21TdGF0dXN9LCB0aW1lcn1cbiAgY29uZmlybUNhbGxiYWNrOiAgICAgbnVsbCxcbiAgYWN0aXZlQ2xpcERhdGE6ICAgICAgbnVsbCxcbiAgY2xpcEpvYnM6ICAgICAgICAgICAge30sICAgLy8gY2xpcElkIC0+IHtvcH0gZm9yIGEgcGVyLWNsaXAgYXN5bmMgam9iIGluIGZsaWdodCAoYW5hbHl6ZS1mcmFtZXMpLCBzbyBpdHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW5kaWNhdG9yIHN1cnZpdmVzIGEgcmVuZGVyRGV0YWlsIHJlYnVpbGQgLyBjbGlwIHN3aXRjaCAoc3RhdGUsIG5vdCBhIERPTSBub2RlKVxuICBhY3RpdmVNZWRpYUZpbGVuYW1lOiBudWxsLFxuICBhY3RpdmVWaWRlb0RhdGE6ICAgICBudWxsLFxuICBib290UmVzdG9yZURvbmU6ICAgICBmYWxzZSxcbiAgZXhwb3J0RGlyOiAgICAgICAgICAgbnVsbCxcbiAgcmVlbHNEaXI6ICAgICAgICAgICAgbnVsbCxcbiAgY2FuUmV2ZWFsOiAgICAgICAgICAgZmFsc2UsXG59O1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUHVyZSBmb3JtYXR0ZXJzIGFuZCBzY29yZSBoZWxwZXJzOiBubyBET00sIG5vIGZldGNoLiBIVE1MLWVzY2FwZSwgQVBJLWVycm9yIHRleHQsXHJcbi8vICAgZHVyYXRpb24vZGF0ZS9vZmZzZXQgZm9ybWF0dGluZywgdmlkZW8tc3RhdHVzIGxhYmVscywgYW5kIHRoZSBzY29yZSBjb2xvci9pY29uIGVuY29kaW5nLlxyXG4vLyAgIEFQSTogbm9uZSAoY2xpZW50LW9ubHkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5XHJcbi8vIOKUgOKUgCBzY29yZSB1dGlscyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZnVuY3Rpb24gX3Njb3JlSWNvbihzY29yZSkge1xyXG4gIGNvbnN0IGNvbG9yID0gc2NvcmUgPj0gMC43ID8gJ3ZhcigtLWdyZWVuKScgOiBzY29yZSA+PSAwLjQgPyAndmFyKC0td2FybmluZyknIDogJ3ZhcigtLW11dGVkKSc7XHJcbiAgcmV0dXJuIGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7Y29sb3J9O2ZvbnQtc2l6ZToxMHB4XCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+JiMxMTA4ODs8L3NwYW4+YDtcclxufVxyXG5cclxuZnVuY3Rpb24gX2xlcnBDb2xvcihjMSwgYzIsIHQpIHtcclxuICBjb25zdCBoID0gYyA9PiBbcGFyc2VJbnQoYy5zbGljZSgxLDMpLDE2KSwgcGFyc2VJbnQoYy5zbGljZSgzLDUpLDE2KSwgcGFyc2VJbnQoYy5zbGljZSg1LDcpLDE2KV07XHJcbiAgY29uc3QgW3IxLGcxLGIxXSA9IGgoYzEpLCBbcjIsZzIsYjJdID0gaChjMik7XHJcbiAgcmV0dXJuIGByZ2IoJHtNYXRoLnJvdW5kKHIxKyhyMi1yMSkqdCl9LCR7TWF0aC5yb3VuZChnMSsoZzItZzEpKnQpfSwke01hdGgucm91bmQoYjErKGIyLWIxKSp0KX0pYDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3Njb3JlQm9yZGVyQ29sb3Ioc2NvcmUsIGlzUmVqZWN0ZWQpIHtcclxuICBpZiAoaXNSZWplY3RlZCkgcmV0dXJuICd2YXIoLS1tdXRlZCknO1xyXG4gIGNvbnN0IHN0b3BzID0gW1swLCcjNmI2YjgwJ10sWzAuMywnIzRmYzNmNyddLFswLjUsJyM0Y2FmN2QnXSxbMC43LCcjZjBjMDYwJ10sWzEuMCwnI2Y3YTg1YSddXTtcclxuICBmb3IgKGxldCBpID0gMTsgaSA8IHN0b3BzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBpZiAoc2NvcmUgPD0gc3RvcHNbaV1bMF0pIHtcclxuICAgICAgY29uc3QgdCA9IChzY29yZSAtIHN0b3BzW2ktMV1bMF0pIC8gKHN0b3BzW2ldWzBdIC0gc3RvcHNbaS0xXVswXSk7XHJcbiAgICAgIHJldHVybiBfbGVycENvbG9yKHN0b3BzW2ktMV1bMV0sIHN0b3BzW2ldWzFdLCB0KTtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHN0b3BzW3N0b3BzLmxlbmd0aC0xXVsxXTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3NvcnRTY29yZShjbGlwKSB7XHJcbiAgY29uc3Qgc29ydCA9IHdpbmRvdy5fY2xpcHNTb3J0UGFyYW0oKTtcclxuICBpZiAoc29ydCA9PT0gJ2Z1bm55JykgICAgcmV0dXJuIGNsaXAuc2NvcmVfZnVubnk7XHJcbiAgaWYgKHNvcnQgPT09ICdkcmFtYXRpYycpIHJldHVybiBjbGlwLnNjb3JlX2RyYW1hdGljO1xyXG4gIGlmIChzb3J0ID09PSAnYWN0aW9uJykgICByZXR1cm4gY2xpcC5zY29yZV9hY3Rpb247XHJcbiAgaWYgKHNvcnQgPT09ICd2aXN1YWwnKSAgIHJldHVybiBjbGlwLnNjb3JlX3Zpc3VhbDtcclxuICBpZiAoc29ydCA9PT0gJ2xhdWdoJykgICAgcmV0dXJuIGNsaXAuc2NvcmVfbGF1Z2g7XHJcbiAgcmV0dXJuIGNsaXAuc2NvcmVfb3ZlcmFsbDtcclxufVxyXG5cclxuLy8g4pSA4pSAIGZvcm1hdCB1dGlscyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuY29uc3QgX1ZJREVPX1NUQVRVU19ESVNQTEFZID0ge1xyXG4gIHBlbmRpbmc6ICdOb3QgYW5hbHl6ZWQnLCBwcm9iZWQ6ICdJbnNwZWN0ZWQnLCBsYWJlbGVkOiAnVHJhY2tzIGFzc2lnbmVkJyxcclxuICBleHRyYWN0aW5nOiAnRXh0cmFjdGluZycsIHRyYW5zY3JpYmluZzogJ1RyYW5zY3JpYmluZycsIHRyYW5zY3JpYmVkOiAnVHJhbnNjcmliZWQnLFxyXG4gIHNlZ21lbnRlZDogJ0NsaXBzIGdlbmVyYXRlZCcsIGRvbmU6ICdBbmFseXplZCcsIGZhaWxlZDogJ0FuYWx5c2lzIGludGVycnVwdGVkJyxcclxufTtcclxuZnVuY3Rpb24gX2ZtdFZpZGVvU3RhdHVzKHMpIHsgcmV0dXJuIF9WSURFT19TVEFUVVNfRElTUExBWVtzXSB8fCBzOyB9XHJcblxyXG5mdW5jdGlvbiBfbXNUb0htcyhtcykge1xyXG4gIGNvbnN0IHMgPSBNYXRoLmZsb29yKG1zIC8gMTAwMCk7XHJcbiAgaWYgKHMgPCA2MCkgcmV0dXJuIGAke3N9c2A7XHJcbiAgY29uc3QgbSA9IE1hdGguZmxvb3IocyAvIDYwKSwgc2VjID0gcyAlIDYwO1xyXG4gIGlmIChtIDwgNjApIHJldHVybiBgJHttfW0gJHtTdHJpbmcoc2VjKS5wYWRTdGFydCgyLCAnMCcpfXNgO1xyXG4gIGNvbnN0IGggPSBNYXRoLmZsb29yKG0gLyA2MCksIG1pbiA9IG0gJSA2MDtcclxuICByZXR1cm4gYCR7aH1oICR7U3RyaW5nKG1pbikucGFkU3RhcnQoMiwgJzAnKX1tYDtcclxufVxyXG5cclxuZnVuY3Rpb24gcGx1cmFsKGNvdW50LCBzaW5ndWxhciwgcGx1cmFsRm9ybSkge1xyXG4gIHJldHVybiBgJHtjb3VudH0gJHtjb3VudCA9PT0gMSA/IHNpbmd1bGFyIDogKHBsdXJhbEZvcm0gfHwgc2luZ3VsYXIgKyAncycpfWA7XHJcbn1cclxuXHJcbi8vIFN0YW5kYXJkIGd1YXJkIGZvciBhbnkgY29tcHV0ZWQgbnVtYmVyIHNob3duIHRvIHRoZSB1c2VyOiByZXR1cm5zICp2YWx1ZSpcclxuLy8gb25seSB3aGVuIGl0IGlzIGEgZmluaXRlIG51bWJlciwgb3RoZXJ3aXNlIGEgcGxhaW4tRW5nbGlzaCAqZmFsbGJhY2sqLiBOYU5cclxuLy8gb3IgSW5maW5pdHkgLSB1c3VhbGx5IGZyb20gYXJpdGhtZXRpYyBvbiBtaXNzaW5nL3BhcnRpYWwgZGF0YSAtIG11c3QgbmV2ZXJcclxuLy8gcmVhY2ggdGhlIFVJIGFzIHRoZSBsaXRlcmFsIFwiTmFOXCIvXCJJbmZpbml0eVwiLiBVc2UgdGhpcyAob3IgZm10RHVyYXRpb24pIGF0XHJcbi8vIGV2ZXJ5IGRpc3BsYXkgc2l0ZSB0aGF0IGZvcm1hdHMgYSBkZXJpdmVkIG51bWJlci5cclxuZnVuY3Rpb24gZmluaXRlT3IodmFsdWUsIGZhbGxiYWNrID0gJ04vQScpIHtcclxuICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKHZhbHVlKSA/IHZhbHVlIDogZmFsbGJhY2s7XHJcbn1cclxuXHJcbi8vIEh1bWFuLXJlYWRhYmxlIGNsaXAvc2VnbWVudCBsZW5ndGguIFJldHVybnMgKmZhbGxiYWNrKiBmb3IgYSBub24tZmluaXRlXHJcbi8vIGlucHV0IChlLmcuIGEgY2xpcCBtaXNzaW5nIGl0cyBzdGFydC9lbmQgdGltZXMpIHJhdGhlciB0aGFuIFwiTmFOIHNlY1wiLlxyXG5mdW5jdGlvbiBmbXREdXJhdGlvbihzZWNvbmRzLCBmYWxsYmFjayA9ICd1bmtub3duJykge1xyXG4gIGlmICghTnVtYmVyLmlzRmluaXRlKHNlY29uZHMpKSByZXR1cm4gZmFsbGJhY2s7XHJcbiAgcmV0dXJuIHNlY29uZHMgPj0gNjAgPyBgJHtNYXRoLnJvdW5kKHNlY29uZHMgLyA2MCl9IG1pbmAgOiBgJHtNYXRoLnJvdW5kKHNlY29uZHMpfSBzZWNgO1xyXG59XHJcblxyXG5mdW5jdGlvbiB0cnVuY2F0ZSh0ZXh0LCBtYXgpIHtcclxuICByZXR1cm4gdGV4dC5sZW5ndGggPiBtYXggPyB0ZXh0LnNsaWNlKDAsIG1heCAtIDEpICsgJ+KApicgOiB0ZXh0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBlc2NIdG1sKHMpIHtcclxuICByZXR1cm4gU3RyaW5nKHMpLnJlcGxhY2UoLyYvZywnJmFtcDsnKS5yZXBsYWNlKC88L2csJyZsdDsnKS5yZXBsYWNlKC8+L2csJyZndDsnKS5yZXBsYWNlKC9cIi9nLCcmcXVvdDsnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZm9ybWF0QXBpRXJyb3IoZXJyKSB7XHJcbiAgaWYgKCFlcnIpIHJldHVybiAnVW5rbm93biBlcnJvcic7XHJcbiAgaWYgKHR5cGVvZiBlcnIuZGV0YWlsID09PSAnc3RyaW5nJykgcmV0dXJuIGVyci5kZXRhaWw7XHJcbiAgaWYgKEFycmF5LmlzQXJyYXkoZXJyLmRldGFpbCkpIHJldHVybiBlcnIuZGV0YWlsLm1hcChlID0+IGUubXNnIHx8IEpTT04uc3RyaW5naWZ5KGUpKS5qb2luKCc7ICcpO1xyXG4gIGlmIChlcnIubWVzc2FnZSkgcmV0dXJuIGVyci5tZXNzYWdlO1xyXG4gIGNvbnN0IHN0cmluZ2lmaWVkID0gSlNPTi5zdHJpbmdpZnkoZXJyKTtcclxuICByZXR1cm4gKCFzdHJpbmdpZmllZCB8fCBzdHJpbmdpZmllZCA9PT0gJ3t9JykgPyAnVW5rbm93biBlcnJvciAobm8gZGV0YWlscyBmcm9tIHNlcnZlciknIDogc3RyaW5naWZpZWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN0cmlwUmljaE1hcmt1cCh0ZXh0KSB7XHJcbiAgcmV0dXJuIHRleHRcclxuICAgIC5yZXBsYWNlKC9cXHgxYlxcW1swLTk7XSpbYS16QS1aXS9nLCAnJykgIC8vIEFOU0kgZXNjYXBlIGNvZGVzXHJcbiAgICAucmVwbGFjZSgvXFxbXFwvP1xcdytcXF0vZywgJycpOyAgICAgICAgICAgICAvLyBSaWNoIG1hcmt1cCB0YWdzXHJcbn1cclxuXHJcbi8vIFNlcnZlciB0aW1lc3RhbXBzIGFyZSBuYWl2ZSBVVEMgKFNRTGl0ZSBEYXRlVGltZSDihpIgaXNvZm9ybWF0KCkgd2l0aCBubyB6b25lKS5cclxuLy8gVHJlYXQgYSB6b25lLWxlc3Mgc3RyaW5nIGFzIFVUQyBzbyBpdCBpc24ndCBwYXJzZWQgYXMgdGhlIHZpZXdlcidzIGxvY2FsIHRpbWUuXHJcbmZ1bmN0aW9uIF9wYXJzZVNlcnZlckRhdGUoaXNvKSB7XHJcbiAgY29uc3QgaGFzWm9uZSA9IC9belpdJHxbKy1dXFxkezJ9Oj9cXGR7Mn0kLy50ZXN0KGlzbyk7XHJcbiAgcmV0dXJuIG5ldyBEYXRlKGhhc1pvbmUgPyBpc28gOiBpc28gKyAnWicpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10RGF0ZShpc28pIHtcclxuICBpZiAoIWlzbykgcmV0dXJuICduZXZlcic7XHJcbiAgY29uc3QgZCA9IF9wYXJzZVNlcnZlckRhdGUoaXNvKTtcclxuICByZXR1cm4gZC50b0xvY2FsZURhdGVTdHJpbmcodW5kZWZpbmVkLCB7bW9udGg6J3Nob3J0JywgZGF5OidudW1lcmljJ30pICsgJyBhdCAnICtcclxuICAgIGQudG9Mb2NhbGVUaW1lU3RyaW5nKHVuZGVmaW5lZCwge2hvdXI6J251bWVyaWMnLCBtaW51dGU6JzItZGlnaXQnfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRBZ28oaXNvU3RyaW5nKSB7XHJcbiAgY29uc3QgZGlmZlMgPSAoRGF0ZS5ub3coKSAtIF9wYXJzZVNlcnZlckRhdGUoaXNvU3RyaW5nKS5nZXRUaW1lKCkpIC8gMTAwMDtcclxuICBpZiAoZGlmZlMgPCA2MCkgICAgcmV0dXJuICdqdXN0IG5vdyc7XHJcbiAgaWYgKGRpZmZTIDwgMzYwMCkgIHJldHVybiBgJHtNYXRoLmZsb29yKGRpZmZTIC8gNjApfW0gYWdvYDtcclxuICBpZiAoZGlmZlMgPCA4NjQwMCkgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyAzNjAwKX1oIGFnb2A7XHJcbiAgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyA4NjQwMCl9ZCBhZ29gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfZm10T2Zmc2V0KHYpIHtcclxuICBpZiAoIXYpIHJldHVybiAnKzAuMCc7XHJcbiAgcmV0dXJuICh2ID49IDAgPyAnKycgOiAnJykgKyB2LnRvRml4ZWQoMSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRFbGFwc2VkKG1zKSB7XHJcbiAgY29uc3QgcyA9IE1hdGguZmxvb3IobXMgLyAxMDAwKTtcclxuICBjb25zdCBtID0gTWF0aC5mbG9vcihzIC8gNjApO1xyXG4gIHJldHVybiBtID4gMCA/IGAke219bSAke3MgJSA2MH1zYCA6IGAke3N9c2A7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCB0aW1lbGluZSBpbnRlcnZhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuY29uc3QgX1RJTUVMSU5FX01JTl9JTlRFUlZBTF9TID0gMTA7XHJcblxyXG4vLyBDb252ZXJ0IGEgdGltZWxpbmUgaW50ZXJ2YWwgKHZhbHVlLCB1bml0KSBpbnRvIHNlY29uZHM7IG51bGwgaWYgbm9uLW51bWVyaWMgb3JcclxuLy8gYmVsb3cgdGhlIG1pbmltdW0uIFNoYXJlZCBieSB0aGUgU2V0dGluZ3Mgc2F2ZSBwYXRoIGFuZCB0aGUgcGVyLXZpZGVvIHRpbWVsaW5lXHJcbi8vIGdlbmVyYXRvciBzbyB0aGVpciB2YWxpZGF0aW9uIGNhbid0IGRyaWZ0IGFwYXJ0LlxyXG5mdW5jdGlvbiBfcGFyc2VJbnRlcnZhbFModmFsdWUsIHVuaXQpIHtcclxuICBjb25zdCBuID0gcGFyc2VJbnQodmFsdWUsIDEwKTtcclxuICBpZiAoaXNOYU4obikpIHJldHVybiBudWxsO1xyXG4gIGNvbnN0IHNlY29uZHMgPSB1bml0ID09PSAnbWludXRlcycgPyBuICogNjAgOiBuO1xyXG4gIHJldHVybiBzZWNvbmRzID49IF9USU1FTElORV9NSU5fSU5URVJWQUxfUyA/IHNlY29uZHMgOiBudWxsO1xyXG59XHJcblxyXG5leHBvcnQge1xyXG4gIF9zY29yZUljb24sIF9sZXJwQ29sb3IsIF9zY29yZUJvcmRlckNvbG9yLCBfc29ydFNjb3JlLCBfZm10VmlkZW9TdGF0dXMsIF9tc1RvSG1zLFxyXG4gIHBsdXJhbCwgZmluaXRlT3IsIGZtdER1cmF0aW9uLCB0cnVuY2F0ZSwgZXNjSHRtbCwgZm9ybWF0QXBpRXJyb3IsIHN0cmlwUmljaE1hcmt1cCxcclxuICBfcGFyc2VTZXJ2ZXJEYXRlLCBfZm10RGF0ZSwgX2ZtdEFnbywgX2ZtdE9mZnNldCwgX2ZtdEVsYXBzZWQsIF9wYXJzZUludGVydmFsUyxcclxufTtcclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gU2hhcmVkIGNvbG91ciBwaWNrZXIuIFByb2dyZXNzaXZlLWVuaGFuY2VzIGFuIDxpbnB1dD4gdGhhdCBob2xkc1xyXG4vLyAgIGEgaGV4IHZhbHVlOiB0aGUgb3JpZ2luYWwgaW5wdXQgYmVjb21lcyBhIGhpZGRlbiB2YWx1ZS1zdG9yZSAoa2VlcGluZyBpdHMgaWQsXHJcbi8vICAgY2xhc3NlcywgZGF0YS0qIGFuZCBldmVudCB3aXJpbmcpIGFuZCBnYWlucyBhIGNvbXBhY3Qgc3dhdGNoIHRyaWdnZXIuIENsaWNraW5nXHJcbi8vICAgaXQgb3BlbnMgYSBwb3BvdmVyIHdpdGggZGlyZWN0IGhleCBlbnRyeSwgYSByZWNlbnRseS11c2VkIHN0cmlwLCBhbmQgKFN0YWdlIDMpXHJcbi8vICAgYSB1c2VyLWN1cmF0ZWQgbmFtZWQgcGFsZXR0ZS4gUmVwbGFjZXMgbmF0aXZlIDxpbnB1dCB0eXBlPVwiY29sb3JcIj4gYXQgdGhlXHJcbi8vICAgc3BlYWtlci1jb2xvdXIgYW5kIHRpdGxlLWNhcmQgY29sb3VyIHNpdGVzLlxyXG4vLyAgIFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX2NvbG9ycGlja2VyLnB5XHJcbi8vIOKUgOKUgCBzaGFyZWQgY29sb3VyIHBpY2tlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbmNvbnN0IFJFQ0VOVF9LRVkgPSAneXV1Y2xpcC1jb2xvci1yZWNlbnQnO1xyXG5jb25zdCBQQUxFVFRFX0tFWSA9ICd5dXVjbGlwLWNvbG9yLXBhbGV0dGUnO1xyXG5jb25zdCBSRUNFTlRfTUFYID0gODtcclxuXHJcbi8vIFBpY2thYmxlIHN0YXJ0ZXIgY29sb3VycyAtIGRhdGEsIG5vdCBVSSBjaHJvbWUgKHRoZSBjaHJvbWUgYXJvdW5kIHRoZW0gY29tZXNcclxuLy8gZnJvbSB0aGVtZSB0b2tlbnMpLiBBIHNwcmVhZCBvZiBodWVzIHBsdXMgYmxhY2svd2hpdGUgc28gYSBmaXJzdC10aW1lIHVzZXIgaGFzXHJcbi8vIHVzYWJsZSBjaG9pY2VzIGJlZm9yZSBjdXJhdGluZyB0aGVpciBvd24gcGFsZXR0ZS4gVGhlc2UgbGl0ZXJhbHMgYXJlIHRoZSBvbmVcclxuLy8gZXhjZXB0aW9uIHRoZSB0ZXN0X3VpX3RoZW1lIGNvbG91ci1saXRlcmFsIGFsbG93bGlzdCBjYXJ2ZXMgb3V0IGZvciB0aGlzIGZpbGUuXHJcbmNvbnN0IFNUQVJURVJfU1dBVENIRVMgPSBbXHJcbiAgJyNmZmZmZmYnLCAnIzAwMDAwMCcsICcjZTA1YzVjJywgJyNmMDgwM2MnLCAnI2YwYzA2MCcsICcjNGNhZjdkJyxcclxuICAnIzRmYzNmNycsICcjMGE3YTliJywgJyNiMDZhZjcnLCAnI2Y3N2FjMCcsICcjOWU5ZTllJywgJyM3YTRiMmEnLFxyXG5dO1xyXG5cclxuZnVuY3Rpb24gX3JlYWRMaXN0KGtleSkge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgfHwgJ1tdJyk7XHJcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShwYXJzZWQpID8gcGFyc2VkIDogW107XHJcbiAgfSBjYXRjaCB7IHJldHVybiBbXTsgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBfd3JpdGVMaXN0KGtleSwgbGlzdCkge1xyXG4gIHRyeSB7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkobGlzdCkpOyB9IGNhdGNoIHsgLyogc3RvcmFnZSBkaXNhYmxlZCAqLyB9XHJcbn1cclxuXHJcbi8vIEFjY2VwdHMgI1JHQiBvciAjUlJHR0JCICh3aXRoIG9yIHdpdGhvdXQgdGhlIGxlYWRpbmcgIykgYW5kIHJldHVybnMgYVxyXG4vLyBjYW5vbmljYWwgbG93ZXJjYXNlICNycmdnYmIsIG9yIG51bGwgd2hlbiB0aGUgdmFsdWUgaXNuJ3QgYSB2YWxpZCBoZXggY29sb3VyLlxyXG5mdW5jdGlvbiBfbm9ybWFsaXplSGV4KHJhdykge1xyXG4gIGlmICh0eXBlb2YgcmF3ICE9PSAnc3RyaW5nJykgcmV0dXJuIG51bGw7XHJcbiAgbGV0IGhleCA9IHJhdy50cmltKCk7XHJcbiAgaWYgKGhleCAmJiAhaGV4LnN0YXJ0c1dpdGgoJyMnKSkgaGV4ID0gJyMnICsgaGV4O1xyXG4gIGNvbnN0IHNob3J0ID0gL14jKFswLTlhLWZBLUZdezN9KSQvLmV4ZWMoaGV4KTtcclxuICBpZiAoc2hvcnQpIGhleCA9ICcjJyArIHNob3J0WzFdLnNwbGl0KCcnKS5tYXAoYyA9PiBjICsgYykuam9pbignJyk7XHJcbiAgcmV0dXJuIC9eI1swLTlhLWZBLUZdezZ9JC8udGVzdChoZXgpID8gaGV4LnRvTG93ZXJDYXNlKCkgOiBudWxsO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcmVjb3JkUmVjZW50KGhleCkge1xyXG4gIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KGhleCk7XHJcbiAgaWYgKCFub3JtKSByZXR1cm47XHJcbiAgY29uc3QgbGlzdCA9IF9yZWFkTGlzdChSRUNFTlRfS0VZKVxyXG4gICAgLm1hcChfbm9ybWFsaXplSGV4KVxyXG4gICAgLmZpbHRlcihjID0+IGMgJiYgYyAhPT0gbm9ybSk7XHJcbiAgbGlzdC51bnNoaWZ0KG5vcm0pO1xyXG4gIF93cml0ZUxpc3QoUkVDRU5UX0tFWSwgbGlzdC5zbGljZSgwLCBSRUNFTlRfTUFYKSk7XHJcbn1cclxuXHJcbi8vIEEgc2luZ2xlIGNsaWNrYWJsZSBzd2F0Y2ggc2hvd2luZyBhbiBhY3R1YWwgY2hvc2VuIGNvbG91ci4gVGhlIGJhY2tncm91bmQgaXMgYVxyXG4vLyBkYXRhIHZhbHVlICh0aGUgcGlja2VkIGNvbG91ciksIHNldCBhcyBhIERPTSBwcm9wZXJ0eSBzbyBpdCBuZXZlciBhcHBlYXJzIGFzIGFcclxuLy8gbGl0ZXJhbCBpbiBzb3VyY2UgLSB0aGUgc3dhdGNoJ3MgYm9yZGVyL2ZvY3VzIHJpbmcgYXJlIHRoZW1lIHRva2VucyB2aWEgQ1NTLlxyXG5mdW5jdGlvbiBfc3dhdGNoQnV0dG9uKGNvbG9yKSB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgYnRuLnR5cGUgPSAnYnV0dG9uJztcclxuICBidG4uY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXN3YXRjaCc7XHJcbiAgYnRuLmRhdGFzZXQuY29sb3IgPSBjb2xvcjtcclxuICBidG4uc3R5bGUuYmFja2dyb3VuZCA9IGNvbG9yO1xyXG4gIGJ0bi50aXRsZSA9IGNvbG9yO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBjb2xvcik7XHJcbiAgcmV0dXJuIGJ0bjtcclxufVxyXG5cclxuZnVuY3Rpb24gX3N3YXRjaFJvdyhjb2xvcnMpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXJvdyc7XHJcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcclxuICBmb3IgKGNvbnN0IHJhdyBvZiBjb2xvcnMpIHtcclxuICAgIGNvbnN0IGNvbG9yID0gX25vcm1hbGl6ZUhleChyYXcpO1xyXG4gICAgaWYgKCFjb2xvciB8fCBzZWVuLmhhcyhjb2xvcikpIGNvbnRpbnVlO1xyXG4gICAgc2Vlbi5hZGQoY29sb3IpO1xyXG4gICAgcm93LmFwcGVuZENoaWxkKF9zd2F0Y2hCdXR0b24oY29sb3IpKTtcclxuICB9XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuZnVuY3Rpb24gX3NlY3Rpb25MYWJlbCh0ZXh0KSB7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItc2VjdGlvbi1sYWJlbCc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSB0ZXh0O1xyXG4gIHJldHVybiBsYWJlbDtcclxufVxyXG5cclxuLy8g4pSA4pSAIHVzZXItY3VyYXRlZCBuYW1lZCBwYWxldHRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5mdW5jdGlvbiBfcGFsZXR0ZUVudHJpZXMoKSB7XHJcbiAgcmV0dXJuIF9yZWFkTGlzdChQQUxFVFRFX0tFWSlcclxuICAgIC5maWx0ZXIoZSA9PiBlICYmIHR5cGVvZiBlLm5hbWUgPT09ICdzdHJpbmcnICYmIF9ub3JtYWxpemVIZXgoZS5jb2xvcikpXHJcbiAgICAubWFwKGUgPT4gKHsgbmFtZTogZS5uYW1lLCBjb2xvcjogX25vcm1hbGl6ZUhleChlLmNvbG9yKSB9KSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9wYWxldHRlSXRlbShuYW1lLCBjb2xvcikge1xyXG4gIGNvbnN0IGl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBpdGVtLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWl0ZW0nO1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLW5hbWUnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gbmFtZTtcclxuICBjb25zdCByZW1vdmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICByZW1vdmUudHlwZSA9ICdidXR0b24nO1xyXG4gIHJlbW92ZS5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1yZW1vdmUnO1xyXG4gIHJlbW92ZS5kYXRhc2V0Lm5hbWUgPSBuYW1lO1xyXG4gIHJlbW92ZS50ZXh0Q29udGVudCA9ICfDlyc7XHJcbiAgcmVtb3ZlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGBSZW1vdmUgJHtuYW1lfWApO1xyXG4gIGl0ZW0uYXBwZW5kKF9zd2F0Y2hCdXR0b24oY29sb3IpLCBsYWJlbCwgcmVtb3ZlKTtcclxuICByZXR1cm4gaXRlbTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkUGFsZXR0ZShlbnRyaWVzKSB7XHJcbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHdyYXAuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUnO1xyXG4gIGlmICghZW50cmllcy5sZW5ndGgpIHtcclxuICAgIGNvbnN0IGhpbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICBoaW50LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oaW50JztcclxuICAgIGhpbnQudGV4dENvbnRlbnQgPSAnU2F2ZSBhIGNvbG91ciBiZWxvdyB0byBidWlsZCB5b3VyIHBhbGV0dGUuJztcclxuICAgIHdyYXAuYXBwZW5kQ2hpbGQoaGludCk7XHJcbiAgICByZXR1cm4gd3JhcDtcclxuICB9XHJcbiAgZW50cmllcy5mb3JFYWNoKCh7IG5hbWUsIGNvbG9yIH0pID0+IHdyYXAuYXBwZW5kQ2hpbGQoX3BhbGV0dGVJdGVtKG5hbWUsIGNvbG9yKSkpO1xyXG4gIHJldHVybiB3cmFwO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRBZGRSb3coKSB7XHJcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgcm93LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1hZGRyb3cnO1xyXG4gIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICBpbnB1dC50eXBlID0gJ3RleHQnO1xyXG4gIGlucHV0LmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWlucHV0JztcclxuICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ21heGxlbmd0aCcsICc0MCcpO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdOYW1lIGZvciB0aGUgY3VycmVudCBjb2xvdXInKTtcclxuICBpbnB1dC5wbGFjZWhvbGRlciA9ICdOYW1lIHRoaXMgY29sb3VyJztcclxuICBjb25zdCBhZGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBhZGQudHlwZSA9ICdidXR0b24nO1xyXG4gIGFkZC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZS1hZGQnO1xyXG4gIGFkZC50ZXh0Q29udGVudCA9ICdTYXZlJztcclxuICByb3cuYXBwZW5kKGlucHV0LCBhZGQpO1xyXG4gIHJldHVybiByb3c7XHJcbn1cclxuXHJcbi8vIFNhdmVzIHRoZSBjb2xvdXIgY3VycmVudGx5IGluIHRoZSBoZXggZmllbGQgKGZhbGxpbmcgYmFjayB0byB0aGUgY29tbWl0dGVkXHJcbi8vIHZhbHVlKSB1bmRlciB0aGUgdHlwZWQgbmFtZSwgZGVmYXVsdGluZyB0aGUgbmFtZSB0byB0aGUgaGV4IHN0cmluZyBpdHNlbGYuXHJcbmZ1bmN0aW9uIF9hZGRQYWxldHRlRW50cnkoY3R4KSB7XHJcbiAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KGN0eC5oZXhGaWVsZC52YWx1ZSkgfHwgX25vcm1hbGl6ZUhleChjdHguaW5wdXQudmFsdWUpO1xyXG4gIGlmICghY29sb3IpIHJldHVybjtcclxuICBjb25zdCBuYW1lSW5wdXQgPSBjdHgucG9wLnF1ZXJ5U2VsZWN0b3IoJy5jb2xvcnBpY2tlci1wYWxldHRlLWlucHV0Jyk7XHJcbiAgY29uc3QgbmFtZSA9IChuYW1lSW5wdXQgJiYgbmFtZUlucHV0LnZhbHVlLnRyaW0oKSkgfHwgY29sb3I7XHJcbiAgY29uc3QgbmV4dCA9IF9wYWxldHRlRW50cmllcygpLmZpbHRlcihlID0+IGUubmFtZSAhPT0gbmFtZSk7XHJcbiAgbmV4dC5wdXNoKHsgbmFtZSwgY29sb3IgfSk7XHJcbiAgX3dyaXRlTGlzdChQQUxFVFRFX0tFWSwgbmV4dCk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcmVtb3ZlUGFsZXR0ZUVudHJ5KGN0eCwgbmFtZSkge1xyXG4gIF93cml0ZUxpc3QoUEFMRVRURV9LRVksIF9wYWxldHRlRW50cmllcygpLmZpbHRlcihlID0+IGUubmFtZSAhPT0gbmFtZSkpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIHZhbHVlKSB7XHJcbiAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KHZhbHVlKTtcclxuICB0cmlnZ2VyLnN0eWxlLmJhY2tncm91bmQgPSBjb2xvciB8fCAndHJhbnNwYXJlbnQnO1xyXG4gIHRyaWdnZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtZW1wdHknLCAhY29sb3IpO1xyXG59XHJcblxyXG4vLyBFdmVyeXRoaW5nIGluIGEgcGlja2VyIGluc3RhbmNlIHRoZSBoYW5kbGVycyBuZWVkIHRvIHJlYWNoLlxyXG5mdW5jdGlvbiBfbWFrZUNvbnRleHQoaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQpIHtcclxuICByZXR1cm4geyBpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBfY29tbWl0KGN0eCwgcmF3SGV4KSB7XHJcbiAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgocmF3SGV4KTtcclxuICBpZiAoIW5vcm0pIHJldHVybiBmYWxzZTtcclxuICBjdHguaW5wdXQudmFsdWUgPSBub3JtO1xyXG4gIC8vIGlucHV0IGRyaXZlcyB0aGUgbGl2ZS1wcmV2aWV3IGhhbmRsZXJzICh0aXRsZSBjYXJkJ3Mgb25pbnB1dCk7IGNoYW5nZSBkcml2ZXNcclxuICAvLyB0aGUgc2F2ZSBoYW5kbGVycyAoc3BlYWtlciBjaGFuZ2UtZGVsZWdhdGlvbikuIFRoZSB0cmlnZ2VyIHJlLXN5bmNzIG9mZiB0aGVcclxuICAvLyAnaW5wdXQnIGxpc3RlbmVyIHdpcmVkIGluIGF0dGFjaCgpLlxyXG4gIGN0eC5pbnB1dC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG4gIGN0eC5pbnB1dC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnY2hhbmdlJywgeyBidWJibGVzOiB0cnVlIH0pKTtcclxuICBfcmVjb3JkUmVjZW50KG5vcm0pO1xyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG4vLyBSZWJ1aWx0IGVhY2ggdGltZSB0aGUgcG9wb3ZlciBvcGVucyAoYW5kIGFmdGVyIGEgcGFsZXR0ZSBhZGQvcmVtb3ZlKSBzbyB0aGVcclxuLy8gcmVjZW50bHktdXNlZCBzdHJpcCBhbmQgc2F2ZWQgcGFsZXR0ZSByZWZsZWN0IHRoZSBsYXRlc3Qgc3RhdGUuIEFsbCBvZiBpdCBnb2VzXHJcbi8vIGluIG9uZSBjb250YWluZXIgdGhhdCBpcyByZXBsYWNlZCB3aG9sZXNhbGUsIHNvIG5vdGhpbmcgYWNjdW11bGF0ZXMuXHJcbmZ1bmN0aW9uIF9yZW5kZXJTdHJpcHMoY3R4KSB7XHJcbiAgY29uc3Qgc3RhbGUgPSBjdHgucG9wLnF1ZXJ5U2VsZWN0b3IoJy5jb2xvcnBpY2tlci1keW5hbWljJyk7XHJcbiAgaWYgKHN0YWxlKSBzdGFsZS5yZW1vdmUoKTtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBjb250YWluZXIuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWR5bmFtaWMnO1xyXG4gIGNvbnN0IHJlY2VudCA9IF9yZWFkTGlzdChSRUNFTlRfS0VZKTtcclxuICBpZiAocmVjZW50Lmxlbmd0aCkge1xyXG4gICAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ1JlY2VudGx5IHVzZWQnKSk7XHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3N3YXRjaFJvdyhyZWNlbnQpKTtcclxuICB9XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ1lvdXIgcGFsZXR0ZScpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX2J1aWxkUGFsZXR0ZShfcGFsZXR0ZUVudHJpZXMoKSkpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfYnVpbGRBZGRSb3coKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zZWN0aW9uTGFiZWwoJ0NvbG91cnMnKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9zd2F0Y2hSb3coU1RBUlRFUl9TV0FUQ0hFUykpO1xyXG4gIGN0eC5wb3AuYXBwZW5kQ2hpbGQoY29udGFpbmVyKTtcclxufVxyXG5cclxubGV0IF9vcGVuQ3R4ID0gbnVsbDsgIC8vIHRoZSBvbmUgb3BlbiBwaWNrZXIgY29udGV4dCwgb3IgbnVsbFxyXG5cclxuZnVuY3Rpb24gX2Nsb3NlUG9wb3ZlcihyZWZvY3VzKSB7XHJcbiAgaWYgKCFfb3BlbkN0eCkgcmV0dXJuO1xyXG4gIGNvbnN0IHsgcG9wLCB0cmlnZ2VyIH0gPSBfb3BlbkN0eDtcclxuICBwb3AuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XHJcbiAgX29wZW5DdHggPSBudWxsO1xyXG4gIGlmIChyZWZvY3VzKSB0cmlnZ2VyLmZvY3VzKCk7XHJcbn1cclxuXHJcbi8vIFRoZSBwb3BvdmVyIGlzIGEgZGlhbG9nLCBzbyBUYWIgbXVzdCBub3QgZmFsbCB0aHJvdWdoIHRvIHRoZSBwYWdlIGJlaGluZCBpdFxyXG4vLyAoV0NBRyAyLjQuMykuIEN5Y2xlIGZvY3VzIGFtb25nIHRoZSBwb3BvdmVyJ3Mgb3duIGNvbnRyb2xzOyB0aGUgdHJpZ2dlciBzaXRzXHJcbi8vIG91dHNpZGUgdGhlIHBvcG92ZXIgYW5kIGlzIGludGVudGlvbmFsbHkgZXhjbHVkZWQgd2hpbGUgaXQgaXMgb3Blbi5cclxuZnVuY3Rpb24gX2ZvY3VzYWJsZXMocG9wKSB7XHJcbiAgcmV0dXJuIEFycmF5LmZyb20ocG9wLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbiwgaW5wdXQnKSkuZmlsdGVyKFxyXG4gICAgZWwgPT4gIWVsLmRpc2FibGVkICYmIGVsLm9mZnNldFBhcmVudCAhPT0gbnVsbCxcclxuICApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfdHJhcEZvY3VzKGUpIHtcclxuICBjb25zdCBpdGVtcyA9IF9mb2N1c2FibGVzKF9vcGVuQ3R4LnBvcCk7XHJcbiAgaWYgKCFpdGVtcy5sZW5ndGgpIHJldHVybjtcclxuICBjb25zdCBmaXJzdCA9IGl0ZW1zWzBdO1xyXG4gIGNvbnN0IGxhc3QgPSBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXTtcclxuICBjb25zdCBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xyXG4gIGlmICghX29wZW5DdHgucG9wLmNvbnRhaW5zKGFjdGl2ZSkpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGZpcnN0LmZvY3VzKCk7XHJcbiAgfSBlbHNlIGlmIChlLnNoaWZ0S2V5ICYmIGFjdGl2ZSA9PT0gZmlyc3QpIHtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGxhc3QuZm9jdXMoKTtcclxuICB9IGVsc2UgaWYgKCFlLnNoaWZ0S2V5ICYmIGFjdGl2ZSA9PT0gbGFzdCkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZmlyc3QuZm9jdXMoKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9vcGVuUG9wb3ZlcihjdHgpIHtcclxuICBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgY3R4LmhleEZpZWxkLnZhbHVlID0gKF9ub3JtYWxpemVIZXgoY3R4LmlucHV0LnZhbHVlKSB8fCAnJykucmVwbGFjZSgnIycsICcnKTtcclxuICBjdHguaGV4RmllbGQuY2xhc3NMaXN0LnJlbW92ZSgnaW52YWxpZCcpO1xyXG4gIF9yZW5kZXJTdHJpcHMoY3R4KTtcclxuICBjdHgucG9wLmNsYXNzTGlzdC5hZGQoJ29wZW4nKTtcclxuICBjdHgudHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xyXG4gIF9vcGVuQ3R4ID0gY3R4O1xyXG4gIGN0eC5oZXhGaWVsZC5mb2N1cygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfd2lyZUhleEZpZWxkKGN0eCkge1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHtcclxuICAgIGNvbnN0IG5vcm0gPSBfbm9ybWFsaXplSGV4KGN0eC5oZXhGaWVsZC52YWx1ZSk7XHJcbiAgICBjdHguaGV4RmllbGQuY2xhc3NMaXN0LnRvZ2dsZSgnaW52YWxpZCcsICFub3JtICYmIGN0eC5oZXhGaWVsZC52YWx1ZS50cmltKCkgIT09ICcnKTtcclxuICAgIGlmIChub3JtKSBfc3luY1RyaWdnZXIoY3R4LnRyaWdnZXIsIG5vcm0pOyAgLy8gbGl2ZSBwcmV2aWV3LCBubyBjb21taXQgeWV0XHJcbiAgfSk7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IF9jb21taXQoY3R4LCBjdHguaGV4RmllbGQudmFsdWUpKTtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gICAgaWYgKGUua2V5ICE9PSAnRW50ZXInKSByZXR1cm47XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoX2NvbW1pdChjdHgsIGN0eC5oZXhGaWVsZC52YWx1ZSkpIF9jbG9zZVBvcG92ZXIodHJ1ZSk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZEhleFJvdygpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleHJvdyc7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleGhhc2gnO1xyXG4gIGxhYmVsLnRleHRDb250ZW50ID0gJyMnO1xyXG4gIGNvbnN0IGZpZWxkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICBmaWVsZC50eXBlID0gJ3RleHQnO1xyXG4gIGZpZWxkLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1oZXhmaWVsZCc7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdtYXhsZW5ndGgnLCAnNycpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnc3BlbGxjaGVjaycsICdmYWxzZScpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnYXV0b2NvbXBsZXRlJywgJ29mZicpO1xyXG4gIGZpZWxkLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdIZXggY29sb3VyIHZhbHVlJyk7XHJcbiAgZmllbGQucGxhY2Vob2xkZXIgPSAnUlJHR0JCJztcclxuICByb3cuYXBwZW5kKGxhYmVsLCBmaWVsZCk7XHJcbiAgcmV0dXJuIHsgcm93LCBmaWVsZCB9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBhdHRhY2goaW5wdXQpIHtcclxuICBpZiAoIWlucHV0IHx8IGlucHV0LmRhdGFzZXQuY3BBdHRhY2hlZCkgcmV0dXJuO1xyXG4gIGlucHV0LmRhdGFzZXQuY3BBdHRhY2hlZCA9ICcxJztcclxuICBjb25zdCBpbml0aWFsID0gX25vcm1hbGl6ZUhleChpbnB1dC52YWx1ZSkgfHwgJyc7XHJcbiAgaW5wdXQudHlwZSA9ICdoaWRkZW4nO1xyXG4gIGlucHV0LnZhbHVlID0gaW5pdGlhbDtcclxuXHJcbiAgY29uc3Qgd3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB3cmFwLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlcic7XHJcbiAgaW5wdXQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUod3JhcCwgaW5wdXQpO1xyXG5cclxuICBjb25zdCB0cmlnZ2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgdHJpZ2dlci50eXBlID0gJ2J1dHRvbic7XHJcbiAgdHJpZ2dlci5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItdHJpZ2dlcic7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGFzcG9wdXAnLCAndHJ1ZScpO1xyXG4gIHRyaWdnZXIuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2hvb3NlIGNvbG91cicpO1xyXG5cclxuICBjb25zdCBwb3AgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBwb3AuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBvcCc7XHJcbiAgcG9wLnNldEF0dHJpYnV0ZSgncm9sZScsICdkaWFsb2cnKTtcclxuICBwb3Auc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0NvbG91ciBwaWNrZXInKTtcclxuICBjb25zdCB7IHJvdzogaGV4Um93LCBmaWVsZDogaGV4RmllbGQgfSA9IF9idWlsZEhleFJvdygpO1xyXG4gIHBvcC5hcHBlbmRDaGlsZChoZXhSb3cpO1xyXG5cclxuICB3cmFwLmFwcGVuZCh0cmlnZ2VyLCBpbnB1dCwgcG9wKTtcclxuICBjb25zdCBjdHggPSBfbWFrZUNvbnRleHQoaW5wdXQsIHRyaWdnZXIsIHBvcCwgaGV4RmllbGQpO1xyXG5cclxuICBfc3luY1RyaWdnZXIodHJpZ2dlciwgaW5wdXQudmFsdWUpO1xyXG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4gX3N5bmNUcmlnZ2VyKHRyaWdnZXIsIGlucHV0LnZhbHVlKSk7XHJcbiAgdHJpZ2dlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgaWYgKF9vcGVuQ3R4ICYmIF9vcGVuQ3R4LnRyaWdnZXIgPT09IHRyaWdnZXIpIF9jbG9zZVBvcG92ZXIoKTtcclxuICAgIGVsc2UgX29wZW5Qb3BvdmVyKGN0eCk7XHJcbiAgfSk7XHJcbiAgcG9wLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgICBjb25zdCByZW1vdmVCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1yZW1vdmUnKTtcclxuICAgIGlmIChyZW1vdmVCdG4pIHsgX3JlbW92ZVBhbGV0dGVFbnRyeShjdHgsIHJlbW92ZUJ0bi5kYXRhc2V0Lm5hbWUpOyByZXR1cm47IH1cclxuICAgIGlmIChlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1hZGQnKSkgeyBfYWRkUGFsZXR0ZUVudHJ5KGN0eCk7IHJldHVybjsgfVxyXG4gICAgY29uc3Qgc3dhdGNoID0gZS50YXJnZXQuY2xvc2VzdCgnLmNvbG9ycGlja2VyLXN3YXRjaCcpO1xyXG4gICAgaWYgKCFzd2F0Y2gpIHJldHVybjtcclxuICAgIF9jb21taXQoY3R4LCBzd2F0Y2guZGF0YXNldC5jb2xvcik7XHJcbiAgICBfY2xvc2VQb3BvdmVyKCk7XHJcbiAgfSk7XHJcbiAgcG9wLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJyAmJiBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItcGFsZXR0ZS1pbnB1dCcpKSB7XHJcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgX2FkZFBhbGV0dGVFbnRyeShjdHgpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG4gIF93aXJlSGV4RmllbGQoY3R4KTtcclxufVxyXG5cclxuLy8gQ2xvc2UgdGhlIG9wZW4gcG9wb3ZlciBvbiBhbiBvdXRzaWRlIGNsaWNrIG9yIEVzY2FwZS4gUmVnaXN0ZXJlZCBvbmNlLlxyXG4vLyBBIGNsaWNrIHRoYXQgcmUtcmVuZGVycyB0aGUgcG9wb3ZlciAoU2F2ZSAvIHJlbW92ZSBhIHBhbGV0dGUgZW50cnkpIGRldGFjaGVzXHJcbi8vIGl0cyBvd24gdGFyZ2V0IGJlZm9yZSB0aGlzIGJ1YmJsaW5nIGhhbmRsZXIgcnVuczsgc3VjaCBhIHRhcmdldCBpcyBubyBsb25nZXIgaW5cclxuLy8gdGhlIGRvY3VtZW50LCBzbyBza2lwIGl0IHJhdGhlciB0aGFuIG1pc3Rha2luZyBpdCBmb3IgYW4gb3V0c2lkZSBjbGljay5cclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgaWYgKCFkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoZS50YXJnZXQpKSByZXR1cm47XHJcbiAgaWYgKCFfb3BlbkN0eC5wb3AucGFyZW50Tm9kZS5jb250YWlucyhlLnRhcmdldCkpIF9jbG9zZVBvcG92ZXIoKTtcclxufSk7XHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykgeyBfY2xvc2VQb3BvdmVyKHRydWUpOyByZXR1cm47IH1cclxuICBpZiAoZS5rZXkgPT09ICdUYWInKSBfdHJhcEZvY3VzKGUpO1xyXG59KTtcclxuXHJcbmV4cG9ydCBjb25zdCBDb2xvclBpY2tlciA9IHsgYXR0YWNoLCBfbm9ybWFsaXplSGV4LCBSRUNFTlRfS0VZLCBQQUxFVFRFX0tFWSB9O1xyXG4iLCAiLy8gSW5mcmFzdHJ1Y3R1cmUgLSBQYW5lbE5hdiB0YWtlb3ZlciBmcmFtZXdvcmsgKG5vdCBhIGZlYXR1cmUgbW9kdWxlKS5cclxuLy8gICBVc2VkIGJ5OiBzcGxpdC5qcywgY2xpcGNyZWF0ZS5qcywgZXhwb3J0ZWRpdG9yLmpzLCBuYW1lY29ycmVjdGlvbnMuanMgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfcGFuZWxuYXYucHlcclxuLy8g4pSA4pSAIHBhbmVsIG5hdmlnYXRpb24gZnJhbWV3b3JrIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBNdWx0aS1zdGVwIGZsb3dzIChTcGxpdCBFZGl0b3IsIGFuZCBmdXR1cmUgcGlja2VycykgdGFrZSBvdmVyIHRoZSBtYWluXHJcbi8vIGRldGFpbCBwYW5lbCBpbnN0ZWFkIG9mIHVzaW5nIGEgbW9kYWw6IHNoYXJlZCBicmVhZGNydW1iLCBzaGFyZWQgZGlydHktc3RhdGVcclxuLy8gZGlzY2FyZCBwcm9tcHQuIEVhY2ggb3BlbiBwYW5lbCBnZXRzIGl0cyBvd24gY29udGVudCBjb250YWluZXIgc28gYSBmdXR1cmVcclxuLy8gbmVzdGVkIHBhbmVsIChlLmcuIG1hbnVhbC1jbGlwJ3MgcGlja2VyIG9uIHRvcCBvZiBhIHJlY29yZGluZyB2aWV3KSBjYW4gYmVcclxuLy8gdW53b3VuZCBvbmUgbGV2ZWwgYXQgYSB0aW1lIHdpdGhvdXQgcmUtcnVubmluZyB0aGUgcGFyZW50J3MgcmVuZGVyKCkuXHJcbi8vXHJcbi8vIFRoZSBjb250YWluZXIgaXMgZGVzdHJveWVkIG9uIGNsb3NlIHJpZ2h0IGFmdGVyIG9uQ2xvc2UoKSBydW5zLiBJZiByZW5kZXIoKVxyXG4vLyByZXBhcmVudGVkIGFuIGV4aXN0aW5nIHN0YXRpYyBlbGVtZW50IChyYXRoZXIgdGhhbiBidWlsZGluZyBmcmVzaCBET00pLFxyXG4vLyBvbkNsb3NlKCkgbXVzdCBtb3ZlIGl0IGJhY2sgb3V0IHRvIGEgc3RhYmxlLCBhbHdheXMtaW4tZG9jdW1lbnQgbG9jYXRpb24gLVxyXG4vLyBvdGhlcndpc2UgaXQgZ29lcyB3aXRoIHRoZSBjb250YWluZXIgYW5kIGdldEVsZW1lbnRCeUlkIGNhbid0IGZpbmQgaXQgb25cclxuLy8gdGhlIG5leHQgb3Blbi4gU2VlIHNwbGl0LmpzJ3MgX3RlYXJkb3duU3BsaXRFZGl0b3IgZm9yIHRoZSBwYXR0ZXJuLlxyXG5cclxuY29uc3QgX3N0YWNrID0gW107ICAvLyBbe2lkLCB0aXRsZSwgaXNEaXJ0eSwgb25DbG9zZSwgY29udGFpbmVyfV1cclxuXHJcbmZ1bmN0aW9uIF9yb290KCkgICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LXJvb3QnKTsgfVxyXG5mdW5jdGlvbiBfY3J1bWIoKSAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1icmVhZGNydW1iJyk7IH1cclxuZnVuY3Rpb24gX21vdW50KCkgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtY29udGVudCcpOyB9XHJcbmZ1bmN0aW9uIF90b3AoKSAgICAgeyByZXR1cm4gX3N0YWNrW19zdGFjay5sZW5ndGggLSAxXSB8fCBudWxsOyB9XHJcblxyXG5mdW5jdGlvbiBfcmVuZGVyQnJlYWRjcnVtYigpIHtcclxuICBjb25zdCB0b3AgPSBfdG9wKCk7XHJcbiAgY29uc3QgY3J1bWIgPSBfY3J1bWIoKTtcclxuICBjcnVtYi5pbm5lckhUTUwgPSAnJztcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIGNvbnN0IGJhY2sgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBiYWNrLnR5cGUgPSAnYnV0dG9uJztcclxuICBiYWNrLmNsYXNzTmFtZSA9ICdidG4gZ2hvc3QnO1xyXG4gIGJhY2suc3R5bGUuY3NzVGV4dCA9ICdwYWRkaW5nOjRweCAxMHB4O2ZvbnQtc2l6ZToxM3B4JztcclxuICBiYWNrLnRleHRDb250ZW50ID0gJ+KGkCBCYWNrJztcclxuICBiYWNrLm9uY2xpY2sgPSAoKSA9PiBwYW5lbE5hdkNsb3NlKCk7XHJcbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgdGl0bGUuc3R5bGUuY3NzVGV4dCA9ICdmb250LXNpemU6MTRweDtmb250LXdlaWdodDo2MDAnO1xyXG4gIHRpdGxlLnRleHRDb250ZW50ID0gdG9wLnRpdGxlO1xyXG4gIGNydW1iLmFwcGVuZChiYWNrLCB0aXRsZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF91cGRhdGVWaXNpYmlsaXR5KCkge1xyXG4gIF9zdGFjay5mb3JFYWNoKChlbnRyeSwgaSkgPT4ge1xyXG4gICAgZW50cnkuY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSBpID09PSBfc3RhY2subGVuZ3RoIC0gMSA/ICdmbGV4JyA6ICdub25lJztcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZPcGVuKHsgaWQsIHRpdGxlLCByZW5kZXIsIGlzRGlydHksIG9uQ2xvc2UgfSkge1xyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnRhaW5lci5kYXRhc2V0LnBhbmVsSWQgPSBpZDtcclxuICBjb250YWluZXIuc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDoxNnB4JztcclxuICBfbW91bnQoKS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xyXG4gIF9zdGFjay5wdXNoKHtcclxuICAgIGlkLFxyXG4gICAgdGl0bGUsXHJcbiAgICBpc0RpcnR5OiBpc0RpcnR5IHx8ICgoKSA9PiBmYWxzZSksXHJcbiAgICBvbkNsb3NlOiBvbkNsb3NlIHx8ICgoKSA9PiB7fSksXHJcbiAgICBjb250YWluZXIsXHJcbiAgfSk7XHJcbiAgX3Jvb3QoKS5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gIF91cGRhdGVWaXNpYmlsaXR5KCk7XHJcbiAgX3JlbmRlckJyZWFkY3J1bWIoKTtcclxuICByZW5kZXIoY29udGFpbmVyKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2Nsb3NlVG9wKCkge1xyXG4gIGNvbnN0IHRvcCA9IF9zdGFjay5wb3AoKTtcclxuICBpZiAoIXRvcCkgcmV0dXJuO1xyXG4gIHRvcC5vbkNsb3NlKCk7XHJcbiAgdG9wLmNvbnRhaW5lci5yZW1vdmUoKTtcclxuICBpZiAoX3N0YWNrLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgX3Jvb3QoKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBfdXBkYXRlVmlzaWJpbGl0eSgpO1xyXG4gICAgX3JlbmRlckJyZWFkY3J1bWIoKTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2Q2xvc2UoKSB7XHJcbiAgY29uc3QgdG9wID0gX3RvcCgpO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgaWYgKHRvcC5pc0RpcnR5KCkpIHtcclxuICAgIHdpbmRvdy5zaG93Q29uZmlybShcclxuICAgICAgJ0Rpc2NhcmQgY2hhbmdlcz8nLFxyXG4gICAgICAnWW91IGhhdmUgdW5zYXZlZCBjaGFuZ2VzLiBDbG9zZSB3aXRob3V0IHNhdmluZz8nLFxyXG4gICAgICAnRGlzY2FyZCcsXHJcbiAgICAgIF9jbG9zZVRvcCxcclxuICAgICAgdHJ1ZSxcclxuICAgICk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIF9jbG9zZVRvcCgpO1xyXG59XHJcblxyXG4vLyBGb3JjZS1jbG9zZSB0aGUgdG9wbW9zdCBwYW5lbCwgYnlwYXNzaW5nIHRoZSBkaXJ0eSBnYXRlIC0gZm9yIGNhbGxlcnMgdGhhdFxyXG4vLyBoYXZlIGFscmVhZHkgY29uZmlybWVkIHRoZSBkaXNjYXJkIHRocm91Z2ggdGhlaXIgb3duIChkaWZmZXJlbnRseSB3b3JkZWQpXHJcbi8vIHByb21wdCwgZS5nLiBzd2l0Y2hpbmcgcmVjb3JkaW5ncyB3aGlsZSB0aGUgU3BsaXQgRWRpdG9yIGlzIGRpcnR5LlxyXG5mdW5jdGlvbiBwYW5lbE5hdkZvcmNlQ2xvc2UoKSB7XHJcbiAgX2Nsb3NlVG9wKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2SXNPcGVuKGlkKSB7XHJcbiAgaWYgKGlkID09PSB1bmRlZmluZWQpIHJldHVybiBfc3RhY2subGVuZ3RoID4gMDtcclxuICByZXR1cm4gX3N0YWNrLnNvbWUoZW50cnkgPT4gZW50cnkuaWQgPT09IGlkKTtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IFBhbmVsTmF2ID0ge1xyXG4gIG9wZW46IHBhbmVsTmF2T3BlbiwgY2xvc2U6IHBhbmVsTmF2Q2xvc2UsIGZvcmNlQ2xvc2U6IHBhbmVsTmF2Rm9yY2VDbG9zZSwgaXNPcGVuOiBwYW5lbE5hdklzT3BlbixcclxufTtcclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gTG9uZy1ydW5uaW5nLWpvYiBtYWNoaW5lcnk6IHRoZSBqb2Itc3RhdHVzIGhlYWRlciAoc3RlcCBwaWxscywgdGltZXIsIEVUQSksIHRoZVxuLy8gICBwYXVzZS9yZXN1bWUgKyB0aGVybWFsIGF1dG8tcGF1c2UgVUksIHRoZSBmZXRjaC1iYXNlZCBTU0UgdHJhbnNwb3J0IChfb3BlblNTRS9zdHJlYW1TU0UpLCB0aGVcbi8vICAgc2luZ2xlLWFjdGl2ZS1zdHJlYW0gc3VwZXJzZWRlIGNvbnRyYWN0LCBhbmQgdGhlIHNoYXJlZCBDYW5jZWwgYnV0dG9uLlxuLy8gICBBUEk6IHJvdXRlcy9hbmFseXplLnB5LCByb3V0ZXMvc2NvcmluZy5weSAoU1NFIGVuZHBvaW50cykgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHksIHRlc3RzL3VpL3Rlc3RfdWlfc3NlLnB5XG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgZXNjSHRtbCwgZm9ybWF0QXBpRXJyb3IsIF9mbXRFbGFwc2VkIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xuXG4vLyDilIDilIAgc2hhcmVkIGxpdmUgam9iLXJlbmRlciBzdGF0ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFJlYWQgY3Jvc3MtZmlsZSBieSB2aWRlb3MuanMncyBjb21wYWN0IHN0ZXAgc3RyaXAgKGJhcmUgaWRlbnRpZmllcnMgX2pvYlN0ZXBEZWZzLFxuLy8gX2FjdGl2ZVN0ZXBJZHgsIF9qb2JTdGFydFRpbWUpIGFuZCBieSB0aGUgUGxheXdyaWdodCBVSS10ZXN0IHN1aXRlLCB3aGljaCBzZWVkc1xuLy8gc2V2ZXJhbCBvZiB0aGVzZSBkaXJlY3RseSB2aWEgcGFnZS5ldmFsdWF0ZS4gQm90aCBzaWRlcyBhcmUgY2xhc3NpYywgbm9uLW1vZHVsZVxuLy8gY29kZSwgc28gdGhleSBjYW4gb25seSBldmVyIHJlYWNoIHRoZXNlIGFzIGB3aW5kb3dgIHByb3BlcnRpZXMgLSBuZXZlciB2aWEgYW4gRVNNXG4vLyBpbXBvcnQuIEEgb25lLXNob3QgYHdpbmRvdy5YID0gWGAgc25hcHNob3Qgd291bGQgZ28gc3RhbGUgdGhlIGluc3RhbnQgam9icy5qc1xuLy8gcmVhc3NpZ25zIFgsIHNvIGVhY2ggbmFtZSBnZXRzIGEgbGl2ZSBnZXQvc2V0IGJyaWRnZSBvbnRvIGB3aW5kb3dgIGJlbG93IGluc3RlYWRcbi8vIG9mIGEgcGxhaW4gT2JqZWN0LmFzc2lnbiBleHBvcnQuXG5sZXQgX2pvYlN0ZXBEZWZzICAgPSBbXTtcbmxldCBfYWN0aXZlRVMgICAgICA9IG51bGw7XG5sZXQgX2pvYlN0YXJ0VGltZSAgPSAwO1xubGV0IF9hY3RpdmVTdGVwSWR4ID0gLTE7XG5cbi8vIFBlci1zdGVwIHByb2dyZXNzIGFjY291bnRpbmcgZm9yIHRoZSBzdGVwLXBpbGwgRVRBIGhldXJpc3RpYy4gTm90IHJlYWQgYnkgb3RoZXJcbi8vIHByb2R1Y3Rpb24gbW9kdWxlcywgYnV0IHRoZSBzdGVwLXBpbGwgLyBFVEEgLyBsaXZlLXBhbmVsIHRlc3RzIHNlZWQgdGhlbSBkaXJlY3RseVxuLy8gdmlhIHBhZ2UuZXZhbHVhdGUsIHNvIHRoZXkgbmVlZCB0aGUgc2FtZSB3aW5kb3cgYnJpZGdlIGFzIHRoZSBibG9jayBhYm92ZS5cbmxldCBfc3RlcFN0YXJ0VGltZSA9IDA7XG5sZXQgX3N0ZXBQcm9ncmVzcyAgPSB7fTsgLy8gc3RlcElkeCAtPiB7Y3VycmVudCwgdG90YWx9LCBjbGVhcmVkIHBlciBqb2JcbmxldCBfc3RlcFJhdGVBbmNob3IgPSB7fTsgLy8gc3RlcElkeCAtPiB7dCwgY3VycmVudH0gYXQgZmlyc3Qgb2JzZXJ2ZWQgY291bnQsIGNsZWFyZWQgcGVyIGpvYlxuXG5mb3IgKGNvbnN0IFtuYW1lLCBnZXQsIHNldF0gb2YgW1xuICBbJ19qb2JTdGVwRGVmcycsICAgICgpID0+IF9qb2JTdGVwRGVmcywgICAgdiA9PiB7IF9qb2JTdGVwRGVmcyA9IHY7IH1dLFxuICBbJ19hY3RpdmVFUycsICAgICAgICgpID0+IF9hY3RpdmVFUywgICAgICAgdiA9PiB7IF9hY3RpdmVFUyA9IHY7IH1dLFxuICBbJ19qb2JTdGFydFRpbWUnLCAgICgpID0+IF9qb2JTdGFydFRpbWUsICAgdiA9PiB7IF9qb2JTdGFydFRpbWUgPSB2OyB9XSxcbiAgWydfYWN0aXZlU3RlcElkeCcsICAoKSA9PiBfYWN0aXZlU3RlcElkeCwgIHYgPT4geyBfYWN0aXZlU3RlcElkeCA9IHY7IH1dLFxuICBbJ19zdGVwU3RhcnRUaW1lJywgICgpID0+IF9zdGVwU3RhcnRUaW1lLCAgdiA9PiB7IF9zdGVwU3RhcnRUaW1lID0gdjsgfV0sXG4gIFsnX3N0ZXBQcm9ncmVzcycsICAgKCkgPT4gX3N0ZXBQcm9ncmVzcywgICB2ID0+IHsgX3N0ZXBQcm9ncmVzcyA9IHY7IH1dLFxuICBbJ19zdGVwUmF0ZUFuY2hvcicsICgpID0+IF9zdGVwUmF0ZUFuY2hvciwgdiA9PiB7IF9zdGVwUmF0ZUFuY2hvciA9IHY7IH1dLFxuXSkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkod2luZG93LCBuYW1lLCB7Z2V0LCBzZXQsIGNvbmZpZ3VyYWJsZTogdHJ1ZX0pO1xufVxuXG4vLyDilIDilIAgcHJvZ3Jlc3MgaW5kaWNhdG9yIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gZXN0TWF0Y2g6IHN1YnN0cmluZ3MgdGhhdCBtYXAgdGhpcyBwaWxsIHRvIGEgc3RlcCBuYW1lIGZyb20gL2FwaS9lc3RpbWF0ZSwgc29cbi8vIHRoZSBwcm9ncmVzcyBwaWxsIGNhbiBzaG93IGl0cyBwcmUtcnVuIHRpbWUgZXN0aW1hdGUgYXMgYSBob3ZlciB0b29sdGlwLlxuLy8gcHJvZ3Jlc3NQYXR0ZXJuOiByZWdleCB3aXRoIHR3byBjYXB0dXJlIGdyb3VwcyAoY3VycmVudCwgdG90YWwpIG1hdGNoZWRcbi8vIGFnYWluc3QgaW5jb21pbmcgbG9nIGxpbmVzIHdoaWxlIHRoaXMgc3RlcCBpcyBhY3RpdmUsIHNvIHRoZSBwaWxsIGNhbiBzaG93XG4vLyBcIjMvMTIgKDI1JSlcIiBhbmQgYSBsaXZlIEVUQSBpbnN0ZWFkIG9mIGp1c3QgZWxhcHNlZCB0aW1lLlxuLy8gc3RhZ2U6IHRoZSBtYWNoaW5lLXJlYWRhYmxlIGlkIGZyb20gdGhlIEBAUFJPR1JFU1MgbWFya2VyICh5dXVfY2xpcC9waXBlbGluZS9cbi8vIHByb2dyZXNzLnB5IFN0YWdlKS4gVGhlIG1hcmtlciBkcml2ZXMgdGhlIHBpbGwgZGV0ZXJtaW5pc3RpY2FsbHk7IHRoZSBwYXR0ZXJucy9cbi8vIHByb2dyZXNzUGF0dGVybiByZWdleGVzIGJlbG93IHN0YXkgYXMgYSBvbmUtcmVsZWFzZSBmYWxsYmFjayBmb3IgdGhlIGh1bWFuIGxvZ1xuLy8gbGluZXMuIFRoZSBzdGFnZSBzZXQgaGVyZSBpcyBjb3VwbGluZy1ndWFyZGVkIGFnYWluc3QgcHJvZ3Jlc3MucHkgYnlcbi8vIHRlc3RzL3VuaXQvdGVzdF9wcm9ncmVzc19zdGFnZV9jb3VwbGluZy5weS5cbmNvbnN0IElOR0VTVF9TVEVQUyA9IFtcbiAge2xhYmVsOiAnRXh0cmFjdCcsICAgICAgICBzdGFnZTogJ2V4dHJhY3QnLCAgICAgICAgcGF0dGVybnM6IFsnRXh0cmFjdGluZyBhdWRpbyddLCAgICAgIGVzdE1hdGNoOiBbJ2V4dHJhY3QgYXVkaW8nXSwgIHByb2dyZXNzUGF0dGVybjogL1RyYWNrIChcXGQrKVxcLyhcXGQrKS99LFxuICB7bGFiZWw6ICdUcmFuc2NyaWJlJywgICAgIHN0YWdlOiAndHJhbnNjcmliZScsICAgICBwYXR0ZXJuczogWydUcmFuc2NyaWJpbmcnXSwgICAgICAgICAgZXN0TWF0Y2g6IFsndHJhbnNjcmliZScsICdsb2FkIGNhcHRpb25zJ10sIHByb2dyZXNzUGF0dGVybjogL1RyYWNrIChcXGQrKVxcLyhcXGQrKS8sIHdhaXRQYXR0ZXJuOiAvV2FpdGluZyBmb3IgdGhlIHNwZWVjaC10by10ZXh0IG1vZGVsL30sXG4gIHtsYWJlbDogJ1NwZWFrZXJzJywgICAgICAgc3RhZ2U6ICdzcGVha2VycycsICAgICAgIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzcGVha2VycyddLCAgICBlc3RNYXRjaDogWydzcGVha2VyIGxhYmVscyddfSxcbiAge2xhYmVsOiAnR2VuZXJhdGUgQ2xpcHMnLCBzdGFnZTogJ2dlbmVyYXRlX2NsaXBzJywgcGF0dGVybnM6IFsnR2VuZXJhdGluZyBjbGlwJ119LFxuICB7bGFiZWw6ICdFbmVyZ3knLCAgICAgICAgIHN0YWdlOiAnZW5lcmd5JywgICAgICAgICBwYXR0ZXJuczogWydDb21wdXRpbmcgYXVkaW8gZW5lcmd5J10sIGVzdE1hdGNoOiBbJ2F1ZGlvIGVuZXJneSddfSxcbiAge2xhYmVsOiAnU2NlbmVzJywgICAgICAgICBzdGFnZTogJ3NjZW5lcycsICAgICAgICAgcGF0dGVybnM6IFsnRGV0ZWN0aW5nIHNjZW5lJ10sICAgICAgIGVzdE1hdGNoOiBbJ3NjZW5lIGRldGVjdGlvbiddfSxcbiAge2xhYmVsOiAnU2NvcmUnLCAgICAgICAgICBzdGFnZTogJ3Njb3JlJywgICAgICAgICAgcGF0dGVybnM6IFsnU2NvcmluZyBjbGlwcyddLCAgICAgICAgIGVzdE1hdGNoOiBbJ2xsbSBzY29yaW5nJ10sIHByb2dyZXNzUGF0dGVybjogL1Njb3JpbmcgKFxcZCspXFwvKFxcZCspL30sXG5dO1xuY29uc3QgU0NPUkVfU1RFUFMgPSBbXG4gIHtsYWJlbDogJ0VuZXJneScsICBzdGFnZTogJ2VuZXJneScsIHBhdHRlcm5zOiBbJ0NvbXB1dGluZyBhdWRpbyBlbmVyZ3knXX0sXG4gIHtsYWJlbDogJ1NjZW5lcycsICBzdGFnZTogJ3NjZW5lcycsIHBhdHRlcm5zOiBbJ0RldGVjdGluZyBzY2VuZSddfSxcbiAge2xhYmVsOiAnU2NvcmluZycsIHN0YWdlOiAnc2NvcmUnLCAgcGF0dGVybnM6IFsnU2NvcmluZyBjbGlwcyddLCBwcm9ncmVzc1BhdHRlcm46IC9TY29yaW5nIChcXGQrKVxcLyhcXGQrKS99LFxuXTtcbi8vIE1hcmtlci1kcml2ZW4gb25seSAodGhlIGFuYWx5emUtZnJhbWVzIFNTRSBlbWl0cyBubyBwcm9zZSBzdGFnZSBsaW5lcyksIHNvIHRoZXNlXG4vLyBjYXJyeSBubyBwYXR0ZXJucyAtIGp1c3QgdGhlIHR3byBAQFBST0dSRVNTIHN0YWdlcyB0aGUgdmlzaW9uIHJvdXRlIGVtaXRzLlxuY29uc3QgRlJBTUVTX1NURVBTID0gW1xuICB7bGFiZWw6ICdTYW1wbGUnLCAgIHN0YWdlOiAnZnJhbWVzX3NhbXBsZScsICAgcGF0dGVybnM6IFtdfSxcbiAge2xhYmVsOiAnRGVzY3JpYmUnLCBzdGFnZTogJ2ZyYW1lc19kZXNjcmliZScsIHBhdHRlcm5zOiBbXX0sXG5dO1xuXG4vLyBUaGUgZnVsbCBzZXQgb2Yga25vd24gQEBQUk9HUkVTUyBzdGFnZSBpZHMgLSB0aGUgSlMgbWlycm9yIG9mIHByb2dyZXNzLnB5J3Ncbi8vIFN0YWdlIGVudW0uIGZyYW1lc19zYW1wbGUvZnJhbWVzX2Rlc2NyaWJlIGRyaXZlIHRoZSBhbmFseXplLWZyYW1lcyBqb2IuIEtlcHRcbi8vIGFzIGl0cyBvd24gc2V0IChub3QgZGVyaXZlZCBmcm9tIHRoZSBzdGVwIGRlZnMpIHNvIGl0IHN0YXlzIHRoZSBjb3VwbGluZ1xuLy8gYW5jaG9yIGV2ZW4gZm9yIHN0YWdlcyB3aG9zZSBzdGVwIGRlZiBsaXZlcyBlbHNld2hlcmUuXG5jb25zdCBfUFJPR1JFU1NfUFJFRklYID0gJ0BAUFJPR1JFU1MgJztcbmNvbnN0IEpPQl9TVEFHRVMgPSBuZXcgU2V0KFtcbiAgJ2V4dHJhY3QnLCAndHJhbnNjcmliZScsICdzcGVha2VycycsICdnZW5lcmF0ZV9jbGlwcycsXG4gICdlbmVyZ3knLCAnc2NlbmVzJywgJ3Njb3JlJywgJ2ZyYW1lc19zYW1wbGUnLCAnZnJhbWVzX2Rlc2NyaWJlJyxcbl0pO1xuXG4vLyBNaXJyb3Igb2YgcHJvZ3Jlc3MucHkgcGFyc2VfcHJvZ3Jlc3M6IHJldHVybnMgdGhlIG1hcmtlciBwYXlsb2FkLCBvciBudWxsIGZvclxuLy8gYW55IG5vbi1tYXJrZXIgLyBtYWxmb3JtZWQgLyB1bmtub3duLXN0YWdlIGxpbmUgKHNvIG9yZGluYXJ5IGxvZyBvdXRwdXQgZmFsbHNcbi8vIHRocm91Z2ggdG8gdGhlIHByb3NlIGZhbGxiYWNrIHJhdGhlciB0aGFuIGJlaW5nIG1pc3JlYWQgYXMgcHJvZ3Jlc3MpLlxuZnVuY3Rpb24gcGFyc2VQcm9ncmVzcyhsaW5lKSB7XG4gIGlmICghbGluZSB8fCAhbGluZS5zdGFydHNXaXRoKF9QUk9HUkVTU19QUkVGSVgpKSByZXR1cm4gbnVsbDtcbiAgbGV0IHBheWxvYWQ7XG4gIHRyeSB7IHBheWxvYWQgPSBKU09OLnBhcnNlKGxpbmUuc2xpY2UoX1BST0dSRVNTX1BSRUZJWC5sZW5ndGgpKTsgfVxuICBjYXRjaCAoZSkgeyByZXR1cm4gbnVsbDsgfVxuICBpZiAoIXBheWxvYWQgfHwgdHlwZW9mIHBheWxvYWQgIT09ICdvYmplY3QnIHx8ICFKT0JfU1RBR0VTLmhhcyhwYXlsb2FkLnN0YWdlKSkgcmV0dXJuIG51bGw7XG4gIHJldHVybiBwYXlsb2FkO1xufVxuXG4vLyBzdGVwSWR4IC0+IGEgdHJhbnNpZW50IHN0YXR1cyBtZXNzYWdlIHNob3duIGluIHBsYWNlIG9mIHRoZSBzdGVwJ3MgdGltaW5nXG4vLyBsYWJlbCAoZS5nLiBcIndhaXRpbmcgZm9yIHRoZSBzcGVlY2ggbW9kZWwgdG8gZmluaXNoIGRvd25sb2FkaW5nXCIpLiBTZXQgd2hlbiBhXG4vLyBzdGVwJ3Mgd2FpdFBhdHRlcm4gbWF0Y2hlcywgY2xlYXJlZCB3aGVuIHRoYXQgc3RlcCByZXBvcnRzIHJlYWwgcHJvZ3Jlc3MuXG5sZXQgX3N0ZXBXYWl0aW5nTXNnID0ge307XG5sZXQgX2pvYkFjdGl2ZSAgICAgPSBmYWxzZTtcbmxldCBfYWN0aXZlSm9iQ2xlYW51cCA9IG51bGw7XG5sZXQgX2pvYlRpbWVyICAgICAgPSBudWxsO1xubGV0IF9qb2JIaWRlVGltZXIgID0gbnVsbDtcbmxldCBfam9iUGF1c2FibGUgICA9IGZhbHNlO1xubGV0IF9qb2JQYXVzZWQgICAgID0gZmFsc2U7XG5sZXQgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBudWxsO1xubGV0IF9sYXN0R3B1U3RhdGUgID0gJ3VuYXZhaWxhYmxlJztcblxuLy8gQmVzdC1lZmZvcnQgbG9va3VwIG9mIGEgcGlsbCdzIHByZS1ydW4gdGltZSBlc3RpbWF0ZSAoZnJvbSB0aGUgbGFzdFxuLy8gL2FwaS9lc3RpbWF0ZSBjYWxsLCBzYXZlZCBieSByZW5kZXJFc3RpbWF0ZSkgZm9yIHVzZSBhcyBhIGhvdmVyIHRvb2x0aXAuXG5mdW5jdGlvbiBfZXN0aW1hdGVIbXNGb3Ioc3RlcERlZikge1xuICBjb25zdCBzdGVwcyA9IEFwcFN0YXRlLmxhc3RFc3RpbWF0ZVN0ZXBzO1xuICBpZiAoIXN0ZXBzIHx8ICFzdGVwRGVmLmVzdE1hdGNoKSByZXR1cm4gbnVsbDtcbiAgY29uc3QgbWF0Y2ggPSBzdGVwcy5maW5kKGVzID0+XG4gICAgc3RlcERlZi5lc3RNYXRjaC5zb21lKGtleSA9PiAoZXMubmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrZXkpKVxuICApO1xuICByZXR1cm4gbWF0Y2ggPyBtYXRjaC5obXMgOiBudWxsO1xufVxuXG4vLyBQZXItaXRlbSBidXR0b25zIHRoYXQgdHJpZ2dlciBhIGhlYXZ5IG9wIGFyZSB0YWdnZWQgZGF0YS1qb2ItYmxvY2tlZC4gRGlzYWJsZVxuLy8gdGhlbSAod2l0aCBhIHdoeS10b29sdGlwKSB3aGlsZSBhbnkgam9iIHJ1bnMgc28gYSB1c2VyIGNhbid0IHN0YXJ0IGEgc2Vjb25kIGpvYlxuLy8gdGhlIGJhY2tlbmQgd291bGQganVzdCA0MDkuIFRoZSBoZWFkZXIgI2J0bi1hbmFseXplIGlzIGhhbmRsZWQgaW5saW5lIGJlbG93LlxuLy8gcmVuZGVyRGV0YWlsIGNhbGxzIGFwcGx5Sm9iQmxvY2tlZFN0YXRlKCkgc28gYSBwYW5lbCByZWJ1aWx0IG1pZC1qb2IgY29tZXMgdXBcbi8vIGFscmVhZHkgZGlzYWJsZWQgLSB0aGUgdGFnIGxpdmVzIGluIGZyZXNobHktYnVpbHQgaW5uZXJIVE1MLCBub3QgYSBsaXZlIG5vZGUuXG5mdW5jdGlvbiBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnMoZGlzYWJsZWQpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtam9iLWJsb2NrZWRdJykuZm9yRWFjaChiID0+IHtcbiAgICBiLmRpc2FibGVkID0gZGlzYWJsZWQ7XG4gICAgYi50aXRsZSA9IGRpc2FibGVkID8gJ0Fub3RoZXIgam9iIGlzIHJ1bm5pbmcgLSB3YWl0IGZvciBpdCB0byBmaW5pc2ggb3IgY2FuY2VsIGl0JyA6ICcnO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gYXBwbHlKb2JCbG9ja2VkU3RhdGUoKSB7IF9zZXRKb2JCbG9ja2VkQnV0dG9ucyhfam9iQWN0aXZlKTsgfVxuXG5mdW5jdGlvbiBzdGFydEpvYlVJKHN0ZXBEZWZzLCBqb2JMYWJlbCwgY2FuY2VsbGFibGUgPSBmYWxzZSwgcGF1c2FibGUgPSBmYWxzZSkge1xuICBfam9iQWN0aXZlICAgICA9IHRydWU7XG4gIF9qb2JTdGVwRGVmcyAgID0gc3RlcERlZnM7XG4gIF9hY3RpdmVTdGVwSWR4ID0gLTE7XG4gIF9qb2JTdGFydFRpbWUgID0gRGF0ZS5ub3coKTtcbiAgX3N0ZXBTdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICBfc3RlcFByb2dyZXNzICA9IHt9O1xuICBfc3RlcFJhdGVBbmNob3IgPSB7fTtcbiAgX3N0ZXBXYWl0aW5nTXNnID0ge307XG4gIF9qb2JQYXVzYWJsZSAgID0gcGF1c2FibGU7XG4gIF9qb2JQYXVzZWQgICAgID0gZmFsc2U7XG4gIF9hY3RpdmVDYW5jZWwgID0gX0FOQUxZWkVfQ0FOQ0VMO1xuICBpZiAoX2pvYlRpbWVyKSBjbGVhckludGVydmFsKF9qb2JUaW1lcik7XG4gIF9qb2JUaW1lciA9IHNldEludGVydmFsKF90aWNrSm9iVGltZXIsIDEwMDApO1xuICBpZiAoX2pvYkhpZGVUaW1lcikgeyBjbGVhclRpbWVvdXQoX2pvYkhpZGVUaW1lcik7IF9qb2JIaWRlVGltZXIgPSBudWxsOyB9XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2Itc3RlcHMnKS5pbm5lckhUTUwgPVxuICAgIGA8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tcmlnaHQ6NHB4XCI+JHtlc2NIdG1sKGpvYkxhYmVsKX08L3NwYW4+YCArXG4gICAgc3RlcERlZnMubWFwKChzLCBpKSA9PiB7XG4gICAgICBjb25zdCBlc3QgPSBfZXN0aW1hdGVIbXNGb3Iocyk7XG4gICAgICBjb25zdCB0aXRsZSA9IGVzdCA/IGAgdGl0bGU9XCJFc3RpbWF0ZWQ6ICR7ZXNjSHRtbChlc3QpfVwiYCA6ICcnO1xuICAgICAgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInN0ZXBcIiBpZD1cInN0ZXAtJHtpfVwiJHt0aXRsZX0+JHtzLmxhYmVsfTwvc3Bhbj5gO1xuICAgIH0pLmpvaW4oJycpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXN0YXR1cycpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlYWRlci1zcGFjZXInKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjYnRuLWFuYWx5emUsI2J0bi1zY29yZScpLmZvckVhY2goYiA9PiBiLmRpc2FibGVkID0gdHJ1ZSk7XG4gIGNvbnN0IGFuYWx5emVCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWFuYWx5emUnKTtcbiAgaWYgKGFuYWx5emVCdG4pIGFuYWx5emVCdG4udGl0bGUgPSAnQSBqb2IgaXMgYWxyZWFkeSBydW5uaW5nJztcbiAgX3NldEpvYkJsb2NrZWRCdXR0b25zKHRydWUpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNhbmNlbC1qb2InKS5zdHlsZS5kaXNwbGF5ID0gY2FuY2VsbGFibGUgPyAnJyA6ICdub25lJztcbiAgX3JlbmRlclBhdXNlVUkoKTtcbiAgaWYgKF9qb2JUaGVybWFsUG9sbFRpbWVyKSBjbGVhckludGVydmFsKF9qb2JUaGVybWFsUG9sbFRpbWVyKTtcbiAgaWYgKHBhdXNhYmxlKSB7XG4gICAgX2xhc3RHcHVTdGF0ZSA9ICd1bmF2YWlsYWJsZSc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1ncHUtdGVtcCcpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgX3BvbGxUaGVybWFsU3RhdHVzKCk7XG4gICAgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBzZXRJbnRlcnZhbChfcG9sbFRoZXJtYWxTdGF0dXMsIDUwMDApO1xuICB9XG4gIGlmICh3aW5kb3cuX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMpIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCk7XG59XG5cbi8vIFBvbGxlZCBldmVyeSA1cyAob25seSB3aGlsZSBhIHBhdXNhYmxlIC0gaS5lLiBhbmFseXplLXR5cGUgLSBqb2IgaXMgYWN0aXZlKSB0b1xuLy8gZHJpdmUgdGhlIGpvYi1oZWFkZXIgR1BVIHRlbXBlcmF0dXJlIHJlYWRvdXQgYW5kIHRoZSB3YXJuL2F1dG8tcGF1c2Ugbm90aWNlcy5cbi8vIFVzZXMgL2FwaS9zdGF0dXMgcmF0aGVyIHRoYW4gU1NFIGxvZy1saW5lIG1hdGNoaW5nIHNvIGl0IGFsc28gd29ya3MgY29ycmVjdGx5XG4vLyBhY3Jvc3MgdGhlIEpTIHNlcXVlbnRpYWwtc2VnbWVudCBydW5uZXJzJyBnYXBzIGJldHdlZW4gcGVyLXNlZ21lbnQgam9icy5cbmFzeW5jIGZ1bmN0aW9uIF9wb2xsVGhlcm1hbFN0YXR1cygpIHtcbiAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZmV0Y2goJy9hcGkvc3RhdHVzJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgaWYgKCFzdGF0dXMpIHJldHVybjtcbiAgY29uc3QgcmVhZG91dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItZ3B1LXRlbXAnKTtcbiAgaWYgKHJlYWRvdXQpIHtcbiAgICBpZiAoc3RhdHVzLmdwdV90ZW1wX2MgPT0gbnVsbCkge1xuICAgICAgcmVhZG91dC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWFkb3V0LnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICAgIHJlYWRvdXQuY2xhc3NOYW1lID0gJ2dwdS10ZW1wLXJlYWRvdXQnICsgKHN0YXR1cy5ncHVfc3RhdGUgPT09ICdvaycgPyAnJyA6IGAgJHtzdGF0dXMuZ3B1X3N0YXRlfWApO1xuICAgICAgcmVhZG91dC50ZXh0Q29udGVudCA9IGBHUFUgJHtNYXRoLnJvdW5kKHN0YXR1cy5ncHVfdGVtcF9jKX3CsENgO1xuICAgIH1cbiAgfVxuICBpZiAoc3RhdHVzLmdwdV9zdGF0ZSA9PT0gJ3dhcm4nICYmIF9sYXN0R3B1U3RhdGUgIT09ICd3YXJuJyAmJiBfbGFzdEdwdVN0YXRlICE9PSAncGF1c2UnKSB7XG4gICAgY29uc3QgbmV4dCA9IHN0YXR1cy50aGVybWFsX2F1dG9wYXVzZV9lbmFibGVkXG4gICAgICA/IGBBbmFseXNpcyB3aWxsIGF1dG8tcGF1c2UgaWYgaXQgcmVhY2hlcyAke01hdGgucm91bmQoc3RhdHVzLnRoZXJtYWxfcGF1c2VfYyl9wrBDLmBcbiAgICAgIDogYEF1dG8tcGF1c2UgaXMgb2ZmIC0gcGF1c2UgdGhlIGpvYiBtYW51YWxseSBpZiBpdCBrZWVwcyBjbGltYmluZy5gO1xuICAgIHdpbmRvdy5zaG93VG9hc3QoYEdQVSBydW5uaW5nIGhvdCAtICR7TWF0aC5yb3VuZChzdGF0dXMuZ3B1X3RlbXBfYyl9wrBDLiAke25leHR9YCwgJ3dhcm5pbmcnKTtcbiAgfVxuICBpZiAoc3RhdHVzLmdwdV9zdGF0ZSA9PT0gJ3BhdXNlJyAmJiBfbGFzdEdwdVN0YXRlICE9PSAncGF1c2UnKSB7XG4gICAgX2pvYlBhdXNlZCA9IHRydWU7XG4gICAgX3JlbmRlclBhdXNlVUkoKTtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KGBBdXRvLXBhdXNlZDogR1BVIHJlYWNoZWQgJHtNYXRoLnJvdW5kKHN0YXR1cy5ncHVfdGVtcF9jKX3CsEMgLSB3aWxsIGhvbGQgYmVmb3JlIHRoZSBuZXh0IHZpZGVvYCwgJ3dhcm5pbmcnLCB7XG4gICAgICBkdXJhdGlvbk1zOiAyMDAwMCxcbiAgICAgIGFjdGlvbjoge2xhYmVsOiAnUmVzdW1lIG5vdycsIG9uQ2xpY2s6IHRvZ2dsZVBhdXNlSm9ifSxcbiAgICB9KTtcbiAgfVxuICBfbGFzdEdwdVN0YXRlID0gc3RhdHVzLmdwdV9zdGF0ZTtcbn1cblxuLy8gXCJQYXVzZSBhZnRlciBjdXJyZW50IHZpZGVvXCIgdG9nZ2xlIGluIHRoZSBqb2IgaGVhZGVyIC0gb25seSBzaG93biBmb3Igam9ic1xuLy8gYmFja2VkIGJ5IHRoZSBwYXVzZSBmbGFnIGZpbGUgKHRoZSBzaW5nbGUgYW5hbHl6ZSBzdHJlYW0gYW5kIHRoZSBKU1xuLy8gc2VxdWVudGlhbC1zZWdtZW50IHJ1bm5lcnM7IHNlZSB0b2dnbGVQYXVzZUpvYikuXG5mdW5jdGlvbiBfcmVuZGVyUGF1c2VVSSgpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1wYXVzZS1qb2InKTtcbiAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLXBhdXNlZC1iYWRnZScpO1xuICBpZiAoIWJ0biB8fCAhYmFkZ2UpIHJldHVybjtcbiAgYnRuLnN0eWxlLmRpc3BsYXkgPSBfam9iUGF1c2FibGUgPyAnJyA6ICdub25lJztcbiAgYnRuLnRleHRDb250ZW50ID0gX2pvYlBhdXNlZCA/ICdSZXN1bWUnIDogJ1BhdXNlIGFmdGVyIGN1cnJlbnQgdmlkZW8nO1xuICBiYWRnZS5zdHlsZS5kaXNwbGF5ID0gX2pvYlBhdXNlZCA/ICcnIDogJ25vbmUnO1xufVxuXG4vLyBSZWZsZWN0cyBhbiBhbHJlYWR5LXBhdXNlZCBqb2IgZGlzY292ZXJlZCB2aWEgL2FwaS9zdGF0dXMgKHBhZ2UgcmVjb25uZWN0KSAtXG4vLyBkb2VzIG5vdCBpdHNlbGYgY2FsbCB0aGUgcGF1c2UvcmVzdW1lIEFQSS5cbmZ1bmN0aW9uIF9zZXRQYXVzZWRVSUZyb21TdGF0dXMocGF1c2VkKSB7XG4gIF9qb2JQYXVzZWQgPSAhIXBhdXNlZDtcbiAgX3JlbmRlclBhdXNlVUkoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdG9nZ2xlUGF1c2VKb2IoKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tcGF1c2Utam9iJyk7XG4gIGNvbnN0IHdhbnRQYXVzZSA9ICFfam9iUGF1c2VkO1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2FuYWx5emUvJHt3YW50UGF1c2UgPyAncGF1c2UnIDogJ3Jlc3VtZSd9YCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIHdpbmRvdy5zaG93VG9hc3QoZm9ybWF0QXBpRXJyb3IoZGF0YSkgfHwgYENvdWxkIG5vdCAke3dhbnRQYXVzZSA/ICdwYXVzZScgOiAncmVzdW1lJ31gLCAnZXJyb3InKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGRhdGEuc3RhdHVzID09PSAnbm8tb3AnKSB7XG4gICAgICB3aW5kb3cuc2hvd1RvYXN0KGRhdGEubWVzc2FnZSB8fCAnTm8gYW5hbHlzaXMgaXMgcnVubmluZy4nLCAnaW5mbycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBfam9iUGF1c2VkID0gd2FudFBhdXNlO1xuICAgIF9yZW5kZXJQYXVzZVVJKCk7XG4gICAgd2luZG93LnNob3dUb2FzdCh3YW50UGF1c2UgPyAnV2lsbCBwYXVzZSBiZWZvcmUgdGhlIG5leHQgdmlkZW8nIDogJ1Jlc3VtZWQnLCAnaW5mbycpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KHdpbmRvdy5uZXRFcnJNc2coZXJyKSwgJ2Vycm9yJyk7XG4gIH0gZmluYWxseSB7XG4gICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIH1cbn1cblxuLy8gTWFyayBzdGVwICppZHgqIGFjdGl2ZSBhbmQgZXZlcnkgZWFybGllciBzdGVwIGRvbmUuIFNoYXJlZCBieSB0aGUgcHJvc2Vcbi8vIG1hdGNoZXIgKHVwZGF0ZUpvYlVJKSBhbmQgdGhlIG1hcmtlciBwYXRoIChfZHJpdmVTdGVwRnJvbU1hcmtlcikgc28gYSBzdGFnZVxuLy8gYWR2YW5jZSBiZWhhdmVzIGlkZW50aWNhbGx5IGhvd2V2ZXIgaXQgd2FzIGRldGVjdGVkLlxuZnVuY3Rpb24gX2FjdGl2YXRlU3RlcChpZHgpIHtcbiAgY29uc3QgcHJldlN0ZXBJZHggPSBfYWN0aXZlU3RlcElkeDtcbiAgZm9yIChsZXQgaiA9IDA7IGogPCBpZHg7IGorKykge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtqfWApO1xuICAgIGlmIChlbCkgeyBlbC5jbGFzc05hbWUgPSAnc3RlcCBkb25lJzsgZWwuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7IGVsLnRleHRDb250ZW50ID0gJ+Kckyc7IGVsLnRpdGxlID0gX2pvYlN0ZXBEZWZzW2pdLmxhYmVsOyB9XG4gIH1cbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2lkeH1gKTtcbiAgaWYgKGVsKSB7IGVsLmNsYXNzTmFtZSA9ICdzdGVwIGFjdGl2ZSc7IF9hY3RpdmVTdGVwSWR4ID0gaWR4OyB9XG4gIGlmIChfYWN0aXZlU3RlcElkeCAhPT0gcHJldlN0ZXBJZHgpIHtcbiAgICBfc3RlcFN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgLy8gV2hlbiB0aGUgcGlwZWxpbmUgYWR2YW5jZXMgYSBzdGFnZSwgcmVmcmVzaCB0aGUgc2lkZWJhciBzbyBhIG5ld2x5LWFuYWx5emluZ1xuICAgIC8vIHJlY29yZGluZyBhcHBlYXJzIChyZXBsYWNpbmcgaXRzIHBsYWNlaG9sZGVyKSBhbmQgaXRzIHN0YXR1cyBzdGF5cyBjdXJyZW50LFxuICAgIC8vIGFuZCByZWZyZXNoIHRoZSBvcGVuIGNsaXAgbGlzdCB0byBwaWNrIHVwIGZyZXNobHktY29tbWl0dGVkIGNsaXBzL3Njb3Jlcy5cbiAgICBfZGVib3VuY2VkU2lkZWJhclJlZnJlc2goKTtcbiAgICBfZGVib3VuY2VkQ2xpcExpc3RSZWZyZXNoKCk7XG4gIH1cbn1cblxuLy8gUmVjb3JkIGEgc3RlcCdzIGN1cnJlbnQvdG90YWwsIGFuY2hvcmluZyB0aGUgdGhyb3VnaHB1dCByYXRlIGF0IHRoZSBmaXJzdFxuLy8gb2JzZXJ2ZWQgY291bnQgc28gYSBjb2xkIGZpcnN0IGl0ZW0gaXMgZXhjbHVkZWQgZnJvbSB0aGUgRVRBIGV4dHJhcG9sYXRpb24uXG5mdW5jdGlvbiBfc2V0U3RlcFByb2dyZXNzKGlkeCwgY3VycmVudCwgdG90YWwpIHtcbiAgLy8gUmVhbCBwcm9ncmVzcyBtZWFucyBhbnkgd2FpdCAoZS5nLiBtb2RlbCBkb3dubG9hZCkgaXMgb3ZlciAtIGRyb3AgaXQgc28gdGhlXG4gIC8vIHBpbGwgc3dpdGNoZXMgYmFjayB0byBsaXZlIGNvdW50cy5cbiAgZGVsZXRlIF9zdGVwV2FpdGluZ01zZ1tpZHhdO1xuICBfc3RlcFByb2dyZXNzW2lkeF0gPSB7Y3VycmVudCwgdG90YWx9O1xuICBpZiAoIV9zdGVwUmF0ZUFuY2hvcltpZHhdKSBfc3RlcFJhdGVBbmNob3JbaWR4XSA9IHt0OiBEYXRlLm5vdygpLCBjdXJyZW50fTtcbiAgX3JlbmRlclN0ZXBQaWxsKGlkeCk7XG4gIF9kZWJvdW5jZWRDbGlwTGlzdFJlZnJlc2goKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlSm9iVUkobGluZSkge1xuICBfam9iU3RlcERlZnMuZm9yRWFjaCgocywgaSkgPT4ge1xuICAgIGlmIChzLnBhdHRlcm5zLnNvbWUocCA9PiBsaW5lLmluY2x1ZGVzKHApKSkgX2FjdGl2YXRlU3RlcChpKTtcbiAgfSk7XG4gIGNvbnN0IGFjdGl2ZURlZiA9IF9qb2JTdGVwRGVmc1tfYWN0aXZlU3RlcElkeF07XG4gIGlmIChhY3RpdmVEZWYgJiYgYWN0aXZlRGVmLndhaXRQYXR0ZXJuICYmIGFjdGl2ZURlZi53YWl0UGF0dGVybi50ZXN0KGxpbmUpKSB7XG4gICAgX3N0ZXBXYWl0aW5nTXNnW19hY3RpdmVTdGVwSWR4XSA9ICd3YWl0aW5nIGZvciB0aGUgc3BlZWNoIG1vZGVsIHRvIGZpbmlzaCBkb3dubG9hZGluZyc7XG4gICAgX3JlbmRlclN0ZXBQaWxsKF9hY3RpdmVTdGVwSWR4KTtcbiAgfVxuICBpZiAoYWN0aXZlRGVmICYmIGFjdGl2ZURlZi5wcm9ncmVzc1BhdHRlcm4pIHtcbiAgICBjb25zdCBtID0gbGluZS5tYXRjaChhY3RpdmVEZWYucHJvZ3Jlc3NQYXR0ZXJuKTtcbiAgICBpZiAobSkgX3NldFN0ZXBQcm9ncmVzcyhfYWN0aXZlU3RlcElkeCwgcGFyc2VJbnQobVsxXSwgMTApLCBwYXJzZUludChtWzJdLCAxMCkpO1xuICB9XG4gIGlmICh3aW5kb3cuX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpO1xufVxuXG4vLyBEcml2ZSB0aGUgcGlsbCByb3cgZnJvbSBhIHBhcnNlZCBAQFBST0dSRVNTIG1hcmtlcjogZGV0ZXJtaW5pc3RpYyBzdGFnZVxuLy8gYWR2YW5jZSBwbHVzIG9wdGlvbmFsIGN1cnJlbnQvdG90YWwsIGtleWVkIG9uIHRoZSBzdGVwIGRlZidzIHN0YWdlIGlkLlxuZnVuY3Rpb24gX2RyaXZlU3RlcEZyb21NYXJrZXIobWFya2VyKSB7XG4gIGNvbnN0IGlkeCA9IF9qb2JTdGVwRGVmcy5maW5kSW5kZXgocyA9PiBzLnN0YWdlID09PSBtYXJrZXIuc3RhZ2UpO1xuICBpZiAoaWR4IDwgMCkgcmV0dXJuO1xuICBfYWN0aXZhdGVTdGVwKGlkeCk7XG4gIGlmICh0eXBlb2YgbWFya2VyLmRvbmUgPT09ICdudW1iZXInICYmIHR5cGVvZiBtYXJrZXIudG90YWwgPT09ICdudW1iZXInICYmIG1hcmtlci50b3RhbCA+IDApIHtcbiAgICBfc2V0U3RlcFByb2dyZXNzKGlkeCwgbWFya2VyLmRvbmUsIG1hcmtlci50b3RhbCk7XG4gIH1cbiAgaWYgKHdpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCk7XG59XG5cbmxldCBfc2lkZWJhclJlZnJlc2hUaW1lciA9IG51bGw7XG5mdW5jdGlvbiBfZGVib3VuY2VkU2lkZWJhclJlZnJlc2goKSB7XG4gIGlmIChfc2lkZWJhclJlZnJlc2hUaW1lcikgcmV0dXJuO1xuICBfc2lkZWJhclJlZnJlc2hUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4geyBfc2lkZWJhclJlZnJlc2hUaW1lciA9IG51bGw7IHdpbmRvdy5sb2FkVmlkZW9zKCk7IH0sIDEyMDApO1xufVxuXG5sZXQgX2NsaXBMaXN0UmVmcmVzaFRpbWVyID0gbnVsbDtcbi8vIFNhbWUgcHVzaC1kcml2ZW4tYnV0LWRlYm91bmNlZCBwYXR0ZXJuIGFzIF9kZWJvdW5jZWRTaWRlYmFyUmVmcmVzaCBhYm92ZSxcbi8vIHRyaWdnZXJlZCBvZmYgdGhlIFNTRSBsaW5lIHN0cmVhbSByYXRoZXIgdGhhbiBhIHBvbGxpbmcgdGltZXIuIE9ubHkgcmVmcmVzaGVzXG4vLyB3aGVuIHRoZSB2aWRlbyBiZWluZyBhbmFseXplZCBpcyB0aGUgb25lIGN1cnJlbnRseSBvcGVuLCBzbyBuZXdseS1jb21taXR0ZWRcbi8vIGNsaXAgc2NvcmVzICh5dXVfY2xpcC9zY29yaW5nL2VuZ2luZS5weSBub3cgY29tbWl0cyBwZXIgY2xpcCkgZmlsbCBpbnRvIHRoZVxuLy8gdmlzaWJsZSBsaXN0IGxpdmUgaW5zdGVhZCBvZiByZXF1aXJpbmcgYSBtYW51YWwgcGFnZSByZWZyZXNoLlxuZnVuY3Rpb24gX2RlYm91bmNlZENsaXBMaXN0UmVmcmVzaCgpIHtcbiAgaWYgKF9jbGlwTGlzdFJlZnJlc2hUaW1lcikgcmV0dXJuO1xuICBfY2xpcExpc3RSZWZyZXNoVGltZXIgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICBfY2xpcExpc3RSZWZyZXNoVGltZXIgPSBudWxsO1xuICAgIGlmICghQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCB8fCAhQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lKSByZXR1cm47XG4gICAgY29uc3QgYW5hbHl6aW5nID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmZpbGVuYW1lID09PSBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUpO1xuICAgIGlmICghYW5hbHl6aW5nIHx8IGFuYWx5emluZy5pZCAhPT0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkgcmV0dXJuO1xuICAgIEFwcFN0YXRlLmNsaXBzID0gYXdhaXQgZmV0Y2god2luZG93Ll9jbGlwc0xpc3RVcmwoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gICAgd2luZG93Ll9yZW5kZXJDbGlwcygpO1xuICB9LCAxMjAwKTtcbn1cblxuLy8gQnVpbGRzIHRoZSBsaXZlIGxhYmVsIGZvciBhIHN0ZXAgcGlsbDogXCJTY29yZSDCtyAzLzEyICgyNSUpIMK3IDA6NDIgKH4yOjA2XG4vLyBsZWZ0KVwiIG9uY2UgcGVyLWl0ZW0gY291bnRzIGFycml2ZSBmcm9tIHRoZSBzdWJwcm9jZXNzIGxvZzsgZWxhcHNlZC1vbmx5XG4vLyAoZmFsbGluZyBiYWNrIHRvIHRoZSBwcmUtcnVuIC9hcGkvZXN0aW1hdGUgZmlndXJlKSBiZWZvcmUgdGhlIGZpcnN0IGNvdW50LlxuZnVuY3Rpb24gX3N0ZXBQaWxsTGFiZWwoaWR4KSB7XG4gIGNvbnN0IGRlZiA9IF9qb2JTdGVwRGVmc1tpZHhdO1xuICBpZiAoIWRlZikgcmV0dXJuIHt0ZXh0OiAnJywgcGN0OiBudWxsfTtcbiAgY29uc3Qgd2FpdGluZyA9IF9zdGVwV2FpdGluZ01zZ1tpZHhdO1xuICBpZiAod2FpdGluZykgcmV0dXJuIHt0ZXh0OiBgJHtkZWYubGFiZWx9IMK3ICR7d2FpdGluZ31gLCBwY3Q6IG51bGx9O1xuICBjb25zdCBlbGFwc2VkTXMgPSBEYXRlLm5vdygpIC0gX3N0ZXBTdGFydFRpbWU7XG4gIGNvbnN0IHByb2dyZXNzICA9IF9zdGVwUHJvZ3Jlc3NbaWR4XTtcbiAgaWYgKCFwcm9ncmVzcyB8fCAhcHJvZ3Jlc3MuY3VycmVudCkge1xuICAgIGNvbnN0IGVzdCA9IF9lc3RpbWF0ZUhtc0ZvcihkZWYpO1xuICAgIHJldHVybiB7XG4gICAgICB0ZXh0OiBlc3QgPyBgJHtkZWYubGFiZWx9IMK3ICR7X2ZtdEVsYXBzZWQoZWxhcHNlZE1zKX0gKH4ke2VzdH0pYCA6IGAke2RlZi5sYWJlbH0gwrcgJHtfZm10RWxhcHNlZChlbGFwc2VkTXMpfWAsXG4gICAgICBwY3Q6IG51bGwsXG4gICAgfTtcbiAgfVxuICBjb25zdCB7Y3VycmVudCwgdG90YWx9ID0gcHJvZ3Jlc3M7XG4gIGNvbnN0IHBjdCAgICA9IE1hdGgucm91bmQoY3VycmVudCAvIHRvdGFsICogMTAwKTtcbiAgLy8gRVRBIGZyb20gdGhyb3VnaHB1dCBzaW5jZSB0aGUgcmF0ZSBhbmNob3IgKGZpcnN0IG9ic2VydmVkIGNvdW50KSwgbm90IGZyb21cbiAgLy8gZWxhcHNlZC9jdXJyZW50IC0gdGhlIGxhdHRlciBsZXQgYSBzbG93IGNvbGQgZmlyc3QgaXRlbSBwcm9qZWN0IGFic3VyZFxuICAvLyBmaWd1cmVzIChlLmcuIFwiNzcgbWluIGxlZnRcIiB0aGF0IHZhbmlzaGVkIHdoZW4gdGhlIHN0ZXAgZmluaXNoZWQgc2Vjb25kcyBsYXRlcikuXG4gIGNvbnN0IGFuY2hvciA9IF9zdGVwUmF0ZUFuY2hvcltpZHhdO1xuICBsZXQgZXRhID0gJyc7XG4gIGlmIChhbmNob3IgJiYgY3VycmVudCA+IGFuY2hvci5jdXJyZW50KSB7XG4gICAgY29uc3QgbXNQZXJJdGVtID0gKERhdGUubm93KCkgLSBhbmNob3IudCkgLyAoY3VycmVudCAtIGFuY2hvci5jdXJyZW50KTtcbiAgICBjb25zdCByZW1haW5pbmdNcyA9IG1zUGVySXRlbSAqICh0b3RhbCAtIGN1cnJlbnQpO1xuICAgIGlmIChpc0Zpbml0ZShyZW1haW5pbmdNcykgJiYgcmVtYWluaW5nTXMgPj0gMCkgZXRhID0gYCAofiR7X2ZtdEVsYXBzZWQocmVtYWluaW5nTXMpfSBsZWZ0KWA7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB0ZXh0OiBgJHtkZWYubGFiZWx9IMK3ICR7Y3VycmVudH0vJHt0b3RhbH0gKCR7cGN0fSUpIMK3ICR7X2ZtdEVsYXBzZWQoZWxhcHNlZE1zKX0ke2V0YX1gLFxuICAgIHBjdCxcbiAgfTtcbn1cblxuLy8gUGFpbnRzIG9uZSBzdGVwIHBpbGwncyB0ZXh0IGFuZCwgZm9yIGFuIGluLXByb2dyZXNzIHN0ZXAgd2l0aCBrbm93biBjb3VudHMsXG4vLyBhIHR3by10b25lIGdyYWRpZW50IGZpbGwgc3RhbmRpbmcgaW4gZm9yIGEgcHJvZ3Jlc3MgYmFyIChkb25lL3BlbmRpbmcgcGlsbHNcbi8vIGtlZXAgdGhlaXIgZmxhdCBDU1MgY2xhc3MgY29sb3IgLSBubyBmaWxsKS4gU2hhcmVkIGJ5IHRoZSBoZWFkZXIgcGlsbCByb3dcbi8vIGFuZCAodmlhIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIHRoZSBpbi1kZXRhaWwgbWlycm9yIHBhbmVsLlxuZnVuY3Rpb24gX3JlbmRlclN0ZXBQaWxsKGlkeCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7aWR4fWApO1xuICBpZiAoIWVsIHx8ICFlbC5jbGFzc0xpc3QuY29udGFpbnMoJ2FjdGl2ZScpKSByZXR1cm47XG4gIGNvbnN0IHt0ZXh0LCBwY3R9ID0gX3N0ZXBQaWxsTGFiZWwoaWR4KTtcbiAgZWwudGV4dENvbnRlbnQgPSB0ZXh0O1xuICBlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBwY3QgIT0gbnVsbFxuICAgID8gYGxpbmVhci1ncmFkaWVudCh0byByaWdodCwgdmFyKC0tZ3JlZW4pICR7cGN0fSUsIHZhcigtLWFjY2VudCkgJHtwY3R9JSlgXG4gICAgOiAnJztcbn1cblxuZnVuY3Rpb24gX3RpY2tKb2JUaW1lcigpIHtcbiAgaWYgKHdpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCk7XG4gIGlmIChfYWN0aXZlU3RlcElkeCA8IDApIHJldHVybjtcbiAgX3JlbmRlclN0ZXBQaWxsKF9hY3RpdmVTdGVwSWR4KTtcbn1cblxuZnVuY3Rpb24gZW5kSm9iVUkoKSB7XG4gIGlmIChfam9iVGltZXIpIHsgY2xlYXJJbnRlcnZhbChfam9iVGltZXIpOyBfam9iVGltZXIgPSBudWxsOyB9XG4gIF9qb2JTdGVwRGVmcy5mb3JFYWNoKChzLCBpKSA9PiB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2l9YCk7XG4gICAgaWYgKGVsKSB7IGVsLmNsYXNzTmFtZSA9ICdzdGVwIGRvbmUnOyBlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnJzsgZWwudGV4dENvbnRlbnQgPSAn4pyTJzsgZWwudGl0bGUgPSBzLmxhYmVsOyB9XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWNhbmNlbC1qb2InKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBfam9iUGF1c2FibGUgPSBmYWxzZTtcbiAgX2pvYlBhdXNlZCAgID0gZmFsc2U7XG4gIF9yZW5kZXJQYXVzZVVJKCk7XG4gIGlmIChfam9iVGhlcm1hbFBvbGxUaW1lcikgeyBjbGVhckludGVydmFsKF9qb2JUaGVybWFsUG9sbFRpbWVyKTsgX2pvYlRoZXJtYWxQb2xsVGltZXIgPSBudWxsOyB9XG4gIGNvbnN0IGdwdVRlbXAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWdwdS10ZW1wJyk7XG4gIGlmIChncHVUZW1wKSBncHVUZW1wLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIF9qb2JBY3RpdmUgPSBmYWxzZTtcbiAgX2pvYkhpZGVUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIF9qb2JIaWRlVGltZXIgPSBudWxsO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2Itc3RhdHVzJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWFkZXItc3BhY2VyJykuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyNidG4tYW5hbHl6ZSwjYnRuLXNjb3JlJykuZm9yRWFjaChiID0+IGIuZGlzYWJsZWQgPSBmYWxzZSk7XG4gICAgY29uc3QgYW5hbHl6ZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tYW5hbHl6ZScpO1xuICAgIGlmIChhbmFseXplQnRuKSBhbmFseXplQnRuLnRpdGxlID0gJyc7XG4gICAgX3NldEpvYkJsb2NrZWRCdXR0b25zKGZhbHNlKTtcbiAgICBjb25zdCB0b3RhbEFwcHJvdmVkID0gKEFwcFN0YXRlLnZpZGVvcyB8fCBbXSkucmVkdWNlKChuLCB2KSA9PiBuICsgdi5hcHByb3ZlZCwgMCk7XG4gICAgd2luZG93Ll91cGRhdGVEZW1vQnV0dG9uKHRvdGFsQXBwcm92ZWQpO1xuICAgIGlmICh3aW5kb3cuX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMpIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCk7XG4gIH0sIDIwMDApO1xufVxuXG4vLyDilIDilIAgU1NFIHRyYW5zcG9ydCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIExvdy1sZXZlbCBTU0UgcmVhZGVyIHVzaW5nIGZldGNoICsgUmVhZGFibGVTdHJlYW0gc28gbm9uLTIwMCBIVFRQIHJlc3BvbnNlc1xuLy8gY2FuIGJlIHJlYWQgZm9yIHRoZWlyIGVycm9yIGRldGFpbCAoRXZlbnRTb3VyY2Uub25lcnJvciBjYW5ub3QgZG8gdGhpcykuXG4vL1xuLy8gb25MaW5lKG1zZykgIC0gY2FsbGVkIGZvciBlYWNoIHBhcnNlZCBTU0UgcGF5bG9hZCBiZWZvcmUgX19ET05FX19cbi8vIG9uRG9uZShtc2cpICAtIGNhbGxlZCB3aXRoIHRoZSBmdWxsIF9fRE9ORV9fIHBheWxvYWQgKHN0cmluZyBvciBvYmplY3QpXG4vLyBvbkVycm9yKHN0cikgLSBjYWxsZWQgd2l0aCBhIHBsYWluLWxhbmd1YWdlIG1lc3NhZ2Ugb24gSFRUUCBlcnJvciBvciBuZXR3b3JrIGxvc3Ncbi8vXG4vLyBvcHRzIChvcHRpb25hbCk6IGV4dHJhIGZldGNoIGluaXQsIGUuZy4ge21ldGhvZDogJ1BPU1QnfSBmb3IgdGhlIG1vZGVsLWRvd25sb2FkXG4vLyBlbmRwb2ludHMsIHdoaWNoIGFyZSBQT1NULW9ubHkgKGEgR0VUIDQwNXMpLiBEZWZhdWx0cyB0byBhIEdFVCwgYXMgdGhlIGFuYWx5emVcbi8vIGFuZCBzY29yZSBTU0Ugc3RyZWFtcyB1c2UuXG4vLyBSZXR1cm5zIGEgaGFuZGxlIHdpdGggLmNsb3NlKCkgdGhhdCBhYm9ydHMgdGhlIGluLWZsaWdodCByZXF1ZXN0LlxuZnVuY3Rpb24gX29wZW5TU0UodXJsLCBvbkxpbmUsIG9uRG9uZSwgb25FcnJvciwgb3B0cyA9IHt9KSB7XG4gIGNvbnN0IGN0cmwgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gIGNvbnN0IGhhbmRsZSA9IHtjbG9zZTogKCkgPT4gY3RybC5hYm9ydCgpfTtcbiAgZmV0Y2godXJsLCB7c2lnbmFsOiBjdHJsLnNpZ25hbCwgLi4ub3B0c30pLnRoZW4oYXN5bmMgcmVzID0+IHtcbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgY29uc3QgZXJyRGF0YSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgICBvbkVycm9yKGZvcm1hdEFwaUVycm9yKGVyckRhdGEpIHx8IGBTZXJ2ZXIgZXJyb3IgJHtyZXMuc3RhdHVzfWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZWFkZXIgPSByZXMuYm9keS5nZXRSZWFkZXIoKTtcbiAgICBjb25zdCBkZWMgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICBsZXQgYnVmID0gJyc7XG4gICAgdHJ5IHtcbiAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIGNvbnN0IHtkb25lLCB2YWx1ZX0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgIGlmICghY3RybC5zaWduYWwuYWJvcnRlZCkgb25FcnJvcignU3RyZWFtIGVuZGVkIHdpdGhvdXQgYSBjb21wbGV0aW9uIHNpZ25hbCcpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBidWYgKz0gZGVjLmRlY29kZSh2YWx1ZSwge3N0cmVhbTogdHJ1ZX0pO1xuICAgICAgICBjb25zdCBsaW5lcyA9IGJ1Zi5zcGxpdCgnXFxuJyk7XG4gICAgICAgIGJ1ZiA9IGxpbmVzLnBvcCgpO1xuICAgICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnZGF0YTogJykpIGNvbnRpbnVlO1xuICAgICAgICAgIGNvbnN0IG1zZyA9IEpTT04ucGFyc2UobGluZS5zbGljZSg2KSk7XG4gICAgICAgICAgY29uc3QgaXNEb25lID0gbXNnID09PSAnX19ET05FX18nIHx8IChtc2cgJiYgdHlwZW9mIG1zZyA9PT0gJ29iamVjdCcgJiYgbXNnLnR5cGUgPT09ICdfX0RPTkVfXycpO1xuICAgICAgICAgIGlmIChpc0RvbmUpIHsgb25Eb25lKG1zZyk7IHJldHVybjsgfVxuICAgICAgICAgIG9uTGluZShtc2cpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoIWN0cmwuc2lnbmFsLmFib3J0ZWQpIG9uRXJyb3IoJ0Nvbm5lY3Rpb24gbG9zdCAtIHNlcnZlciBkaXNjb25uZWN0ZWQnKTtcbiAgICB9XG4gIH0pLmNhdGNoKGVyciA9PiB7XG4gICAgaWYgKCFjdHJsLnNpZ25hbC5hYm9ydGVkKSBvbkVycm9yKHdpbmRvdy5uZXRFcnJNc2coZXJyKSk7XG4gIH0pO1xuICByZXR1cm4gaGFuZGxlO1xufVxuXG4vLyBPbmx5IG9uZSBqb2Igc3RyZWFtIGlzIGxpdmUgYXQgYSB0aW1lLiBTdGFydGluZyBhIG5ldyBqb2IgYWJvcnRzIHRoZSBwcmV2aW91c1xuLy8gb25lIC0gYnV0IGFib3J0aW5nIHN1cHByZXNzZXMgaXRzIG9uRG9uZS9vbkVycm9yLCBzbyBpdHMgVUkgdGVhcmRvd24gKGJ1dHRvblxuLy8gcmUtZW5hYmxlLCBwcm9ncmVzcyBwaWxsKSB3b3VsZCBuZXZlciBydW4uIEVhY2ggam9iIHJlZ2lzdGVycyB0aGF0IHRlYXJkb3duIGFzXG4vLyBhIGNsZWFudXAgc28gYSBzdXBlcnNlZGluZyBqb2IgY2FuIHJ1biBpdC4gU2VlIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0uXG5mdW5jdGlvbiBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgY2xlYW51cCA9IG51bGwpIHtcbiAgX2FjdGl2ZUVTID0gaGFuZGxlO1xuICBfYWN0aXZlSm9iQ2xlYW51cCA9IGNsZWFudXA7XG59XG5cbmZ1bmN0aW9uIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpIHtcbiAgaWYgKF9hY3RpdmVFUyA9PT0gaGFuZGxlKSB7IF9hY3RpdmVFUyA9IG51bGw7IF9hY3RpdmVKb2JDbGVhbnVwID0gbnVsbDsgfVxufVxuXG5mdW5jdGlvbiBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCkge1xuICBpZiAoX2FjdGl2ZUVTKSB7IF9hY3RpdmVFUy5jbG9zZSgpOyBfYWN0aXZlRVMgPSBudWxsOyB9XG4gIGlmIChfYWN0aXZlSm9iQ2xlYW51cCkgeyBjb25zdCBjbGVhbnVwID0gX2FjdGl2ZUpvYkNsZWFudXA7IF9hY3RpdmVKb2JDbGVhbnVwID0gbnVsbDsgY2xlYW51cCgpOyB9XG59XG5cbi8vIEd1YXJkIGZvciBjb21wZXRpbmcgU1NFIGpvYnMgKHJlLXNjb3JlLCB0aW1lbGluZSwgc3VtbWFyeSwgZGlhcml6ZSwg4oCmKS4gV2hpbGVcbi8vIGFuIGFuYWx5c2lzIGlzIHJ1bm5pbmcgdGhlIGJhY2tlbmQgNDA5cyB0aGVzZSBhbnl3YXksIGJ1dCB0aGV5IGNhbGxcbi8vIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKSBmaXJzdCwgd2hpY2ggd291bGQgdGVhciBkb3duIHRoZSBsaXZlIGFuYWx5emUgcHJvZ3Jlc3Ncbi8vIFVJIGJlZm9yZSB0aGUgcmVqZWN0aW9uIGxhbmRzLiBSZXR1cm5zIHRydWUgKGFuZCB0b2FzdHMpIHNvIHRoZSBjYWxsZXIgY2FuIGJhaWxcbi8vIGJlZm9yZSBhbnkgc2lkZSBlZmZlY3RzLlxuZnVuY3Rpb24gX2Jsb2NrZWRCeUFuYWx5emUoYWN0aW9uTGFiZWwpIHtcbiAgaWYgKCFBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUpIHJldHVybiBmYWxzZTtcbiAgd2luZG93LnNob3dUb2FzdChgV2FpdCBmb3IgdGhlIGN1cnJlbnQgYW5hbHlzaXMgdG8gZmluaXNoIGJlZm9yZSB5b3UgJHthY3Rpb25MYWJlbH0uYCwgJ3dhcm5pbmcnKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIG9uTGluZSAob3B0aW9uYWwpOiBjYWxsZWQgd2l0aCBlYWNoIHJhdyBTU0UgcGF5bG9hZCBsaW5lIGJlZm9yZSBfX0RPTkVfXywgZm9yXG4vLyBjYWxsZXJzIHRoYXQgbmVlZCBsaXZlIHByb2dyZXNzIHRleHQgKGUuZy4gdGhlIHByb3h5LWJ1aWxkIHBlcmNlbnRhZ2UpLlxuLy8gb3B0cyAob3B0aW9uYWwpOiBmZXRjaCBpbml0IHBhc3NlZCB0aHJvdWdoIHRvIF9vcGVuU1NFLCBlLmcuIHttZXRob2Q6ICdQT1NUJ31cbi8vIGZvciBhIFBPU1Qtb25seSBTU0UgZW5kcG9pbnQgKGFuYWx5emUtZnJhbWVzKS5cbi8vIG9uRXJyb3IgKG9wdGlvbmFsKTogY2FsbGVkIGFmdGVyIHRoZSBidWlsdC1pbiBlcnJvciBoYW5kbGluZyAodG9hc3QgKyBlbmRKb2JVSSlcbi8vIHNvIGEgY2FsbGVyIGNhbiBydW4gaXRzIG93biB0ZXJtaW5hbCBjbGVhbnVwIG9uIGFuIEhUVFAvdHJhbnNwb3J0IGZhaWx1cmUgLSBlLmcuXG4vLyBjbGVhcmluZyBhIHBlci1pdGVtIGluLWZsaWdodCBmbGFnIHRoYXQgb25seSBpdHMgb25Eb25lIHdvdWxkIG90aGVyd2lzZSBjbGVhci5cbmZ1bmN0aW9uIHN0cmVhbVNTRSh1cmwsIG9uRG9uZSwgc3RlcERlZnMsIGpvYkxhYmVsLCBjYW5jZWxsYWJsZSA9IGZhbHNlLCBvbkxpbmUgPSBudWxsLCBwYXVzYWJsZSA9IGZhbHNlLCBvcHRzID0ge30sIG9uRXJyb3IgPSBudWxsKSB7XG4gIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKTtcbiAgaWYgKHN0ZXBEZWZzKSBzdGFydEpvYlVJKHN0ZXBEZWZzLCBqb2JMYWJlbCwgY2FuY2VsbGFibGUsIHBhdXNhYmxlKTtcbiAgY29uc3QgaGFuZGxlID0gX29wZW5TU0UoXG4gICAgdXJsLFxuICAgIHRleHQgPT4ge1xuICAgICAgLy8gQSBAQFBST0dSRVNTIG1hcmtlciBkcml2ZXMgdGhlIHBpbGxzIGRldGVybWluaXN0aWNhbGx5IGFuZCBpcyBOT1Qgc2hvd24gYXNcbiAgICAgIC8vIGEgbG9nIGxpbmU7IGV2ZXJ5dGhpbmcgZWxzZSBmYWxscyB0aHJvdWdoIHRvIHRoZSBsb2cgKyBwcm9zZSBmYWxsYmFjay5cbiAgICAgIGNvbnN0IG1hcmtlciA9IHN0ZXBEZWZzID8gcGFyc2VQcm9ncmVzcyh0ZXh0KSA6IG51bGw7XG4gICAgICBpZiAobWFya2VyKSB7IF9kcml2ZVN0ZXBGcm9tTWFya2VyKG1hcmtlcik7IHJldHVybjsgfVxuICAgICAgd2luZG93LmFwcGVuZExvZyh0ZXh0KTsgaWYgKG9uTGluZSkgb25MaW5lKHRleHQpOyBpZiAoc3RlcERlZnMpIHVwZGF0ZUpvYlVJKHRleHQpO1xuICAgIH0sXG4gICAgKCkgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICBpZiAoc3RlcERlZnMpIGVuZEpvYlVJKCk7XG4gICAgICBpZiAob25Eb25lKSBvbkRvbmUoKTtcbiAgICB9LFxuICAgIGVyck1zZyA9PiB7XG4gICAgICBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKTtcbiAgICAgIHdpbmRvdy5hcHBlbmRMb2coYFske2Vyck1zZ31dYCk7XG4gICAgICB3aW5kb3cuc2hvd1RvYXN0KGVyck1zZywgJ2Vycm9yJyk7XG4gICAgICB3aW5kb3cuU291bmRGeC5wbGF5KCdlcnJvcicpO1xuICAgICAgaWYgKHN0ZXBEZWZzKSBlbmRKb2JVSSgpO1xuICAgICAgaWYgKG9uRXJyb3IpIG9uRXJyb3IoZXJyTXNnKTtcbiAgICAgIHdpbmRvdy5sb2FkVmlkZW9zKCk7XG4gICAgfSxcbiAgICBvcHRzLFxuICApO1xuICBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgc3RlcERlZnMgPyBlbmRKb2JVSSA6IG51bGwpO1xufVxuXG4vLyBQb2xsZWQgYnkgdGhlIEpTIHNlcXVlbnRpYWwtc2VnbWVudCBydW5uZXJzIChhbmFseXplLmpzJ3MgcHJlLXNwbGl0IGxvb3AsXG4vLyBzcGxpdC5qcydzIHJlLXNwbGl0IGxvb3ApIGJlZm9yZSBmaXJpbmcgb2ZmIGVhY2ggc2VnbWVudCdzIG93biBhbmFseXplIGpvYi5cbi8vIEVhY2ggc2VnbWVudCBpcyBhIHNlcGFyYXRlIEFuYWx5emVKb2IsIHNvIHRoZXJlIGlzIGEgZ2FwIGJldHdlZW4gc2VnbWVudHNcbi8vIHdpdGggbm8gXCJydW5uaW5nXCIgam9iIGZvciAvYXBpL3N0YXR1cydzIGFuYWx5emVfcGF1c2VkIHRvIGtleSBvZmYgLSB0aGlzXG4vLyBjaGVja3MgdGhlIHJhdyBwYXVzZSBmbGFnIGZpbGUgaW5zdGVhZCAocGF1c2VfZmxhZ19zZXQpLlxuYXN5bmMgZnVuY3Rpb24gX3dhaXRXaGlsZUFuYWx5emVQYXVzZWQoKSB7XG4gIGxldCB0b2FzdGVkID0gZmFsc2U7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZmV0Y2goJy9hcGkvc3RhdHVzJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICBpZiAoIXN0YXR1cyB8fCAhc3RhdHVzLnBhdXNlX2ZsYWdfc2V0KSByZXR1cm47XG4gICAgaWYgKCF0b2FzdGVkKSB7IHdpbmRvdy5zaG93VG9hc3QoJ1BhdXNlZCAtIHdpbGwgaG9sZCBiZWZvcmUgdGhlIG5leHQgc2VnbWVudCcsICdpbmZvJyk7IHRvYXN0ZWQgPSB0cnVlOyB9XG4gICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDMwMDApKTtcbiAgfVxufVxuXG4vLyDilIDilIAgam9iIGNhbmNlbGxhdGlvbiDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZSBqb2ItaGVhZGVyIENhbmNlbCBidXR0b24gc2VydmVzIHdoaWNoZXZlciBjYW5jZWxsYWJsZSBqb2IgaXMgcnVubmluZy4gRWFjaFxuLy8gY2FuY2VsbGFibGUgZmxvdyBzZXRzIF9hY3RpdmVDYW5jZWwgKHZpYSBzZXRKb2JDYW5jZWwpIHNvIHRoZSBjb25maXJtIGNvcHkgYW5kXG4vLyB0aGUgY2FuY2VsIGVuZHBvaW50IG1hdGNoIHRoZSBqb2I7IHN0YXJ0Sm9iVUkgcmVzZXRzIGl0IHRvIHRoZSBhbmFseXplIGRlZmF1bHQuXG5jb25zdCBfQU5BTFlaRV9DQU5DRUwgPSB7XG4gIHVybDogICAgICAnL2FwaS9hbmFseXplL2NhbmNlbCcsXG4gIHRpdGxlOiAgICAnQ2FuY2VsIGFuYWx5c2lzPycsXG4gIGJvZHk6ICAgICAnQWxsIHByb2dyZXNzIGZvciB0aGlzIHJlY29yZGluZyB3aWxsIGJlIGxvc3QgYW5kIHlvdSB3aWxsIG5lZWQgdG8gYW5hbHl6ZSBpdCBhZ2Fpbi4nLFxuICBjb25maXJtOiAgJ0NhbmNlbCBBbmFseXNpcycsXG4gIGxvZ01zZzogICAnW0FuYWx5c2lzIGNhbmNlbGxlZF0nLFxufTtcbmxldCBfYWN0aXZlQ2FuY2VsID0gX0FOQUxZWkVfQ0FOQ0VMO1xuXG5mdW5jdGlvbiBzZXRKb2JDYW5jZWwoY2ZnKSB7IF9hY3RpdmVDYW5jZWwgPSBjZmcgfHwgX0FOQUxZWkVfQ0FOQ0VMOyB9XG5cbmZ1bmN0aW9uIGNhbmNlbEpvYigpIHtcbiAgd2luZG93LnNob3dDb25maXJtKFxuICAgIF9hY3RpdmVDYW5jZWwudGl0bGUsXG4gICAgX2FjdGl2ZUNhbmNlbC5ib2R5LFxuICAgIF9hY3RpdmVDYW5jZWwuY29uZmlybSxcbiAgICBfZG9DYW5jZWxKb2IsXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvQ2FuY2VsSm9iKCkge1xuICBjb25zdCBjYW5jZWwgPSBfYWN0aXZlQ2FuY2VsO1xuICAvLyBDYW5jZWwgb24gdGhlIHNlcnZlciBGSVJTVCAtIGlmIGl0IGZhaWxzLCB0aGUgam9iIGlzIHN0aWxsIHJ1bm5pbmcsIHNvXG4gIC8vIGtlZXAgdGhlIHN0cmVhbSBhdHRhY2hlZCBhbmQgdGhlIGpvYiBVSSB1cCBpbnN0ZWFkIG9mIHByZXRlbmRpbmcgaXQgc3RvcHBlZC5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChjYW5jZWwudXJsLCB7bWV0aG9kOiAnUE9TVCd9KTtcbiAgICBpZiAoIXJlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3IgJHtyZXMuc3RhdHVzfWApO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KGBDb3VsZCBub3QgY2FuY2VsIC0gJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cbiAgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpO1xuICB3aW5kb3cuYXBwZW5kTG9nKGNhbmNlbC5sb2dNc2cpO1xuICBlbmRKb2JVSSgpO1xuICAvLyBBIGpvYi1zcGVjaWZpYyB0ZXJtaW5hbCBjbGVhbnVwIChlLmcuIGNsZWFyaW5nIGEgcGVyLWNsaXAgaW4tZmxpZ2h0IGZsYWcgc29cbiAgLy8gaXRzIGJ1dHRvbiBsZWF2ZXMgdGhlIHNwaW5uZXIpIC0gdGhlIGdlbmVyaWMgYW5hbHl6ZSBjYW5jZWwgc2V0cyBub25lLlxuICBpZiAoY2FuY2VsLm9uQ2FuY2VsKSBjYW5jZWwub25DYW5jZWwoKTtcbiAgLy8gQ2xlYXIgdGhlIGFuYWx5emluZyBtYXJrZXIgc28gbG9hZFZpZGVvcygpIGRyb3BzIHRoZSBzaWRlYmFyIHBsYWNlaG9sZGVyIC9cbiAgLy8gc3Bpbm5lci4gTGVmdCBzZXQsIGEgY2FuY2VsbGVkIHJ1biB3aG9zZSBEQiByb3cgbmV2ZXIgbWF0ZXJpYWxpc2VkIHdvdWxkXG4gIC8vIGtlZXAgYW4gdW5jbGlja2FibGUgXCJBbmFseXppbmfigKZcIiBwbGFjZWhvbGRlciB1bnRpbCBhIG1hbnVhbCBwYWdlIHJlZnJlc2guXG4gIEFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSA9IG51bGw7XG4gIHdpbmRvdy5sb2FkVmlkZW9zKCk7XG59XG5cbmV4cG9ydCB7XG4gIElOR0VTVF9TVEVQUywgU0NPUkVfU1RFUFMsIEZSQU1FU19TVEVQUywgSk9CX1NUQUdFUywgcGFyc2VQcm9ncmVzcywgX2RyaXZlU3RlcEZyb21NYXJrZXIsXG4gIHN0YXJ0Sm9iVUksIHVwZGF0ZUpvYlVJLCBlbmRKb2JVSSwgYXBwbHlKb2JCbG9ja2VkU3RhdGUsIF9zdGVwUGlsbExhYmVsLCBfcmVuZGVyU3RlcFBpbGwsIF90aWNrSm9iVGltZXIsXG4gIF9zZXRQYXVzZWRVSUZyb21TdGF0dXMsIHRvZ2dsZVBhdXNlSm9iLCBfcG9sbFRoZXJtYWxTdGF0dXMsXG4gIF9vcGVuU1NFLCBzdHJlYW1TU0UsIF9zZXRBY3RpdmVTdHJlYW0sIF9jbGVhckFjdGl2ZVN0cmVhbSwgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSxcbiAgX2Jsb2NrZWRCeUFuYWx5emUsIF93YWl0V2hpbGVBbmFseXplUGF1c2VkLFxuICBzZXRKb2JDYW5jZWwsIGNhbmNlbEpvYixcbn07XG5cbi8vIFRoZSBqb2IgaGVhZGVyJ3MgUGF1c2UvQ2FuY2VsIGJ1dHRvbnMgYXJlIHN0YXRpYyBtYXJrdXAgaW4gaW5kZXguaHRtbCAobmV2ZXJcbi8vIHJlLXJlbmRlcmVkKSwgc28gYSBzaW5nbGUgbGlzdGVuZXIgd2lyZWQgb25jZSBhdCBtb2R1bGUgbG9hZCAtIHJlcGxhY2luZyB0aGVcbi8vIG9uY2xpY2s9XCJ0b2dnbGVQYXVzZUpvYigpXCIvXCJjYW5jZWxKb2IoKVwiIGF0dHJpYnV0ZXMgdGhhdCB1c2VkIHRvIGxpdmUgdGhlcmUgLVxuLy8gY2FuIG5ldmVyIGRvdWJsZS13aXJlLiAodmlkZW9zLmpzJ3MgaW4tZGV0YWlsIENhbmNlbCBidXR0b24gc3RpbGwgdXNlcyBpdHMgb3duXG4vLyBpbmxpbmUgb25jbGljaz1cImNhbmNlbEpvYigpXCI7IHRoYXQgbWFya3VwIGxpdmVzIGluIHZpZGVvcy5qcywgb3V0IG9mIHNjb3BlIGhlcmUuKVxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1wYXVzZS1qb2InKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZVBhdXNlSm9iKTtcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2FuY2VsLWpvYicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgY2FuY2VsSm9iKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFJlY29yZGluZyBwcmV2aWV3IHBsYXllcjogcGlja3MgdGhlIG1lZGlhIHRyYW5zcG9ydCAoRWxlY3Ryb24gbmF0aXZlIHNjaGVtZSB2cyBIVFRQKSxcbi8vICAgcHJlZmVycyB0aGUgZmFzdCA3MjBwIHByb3h5IG92ZXIgdGhlIHNvdXJjZSwgYW5kIGRyaXZlcyB0aGUgY2xpY2stdG8tYnVpbGQgcHJveHkgYmFkZ2UuXG4vLyAgIEFQSTogcm91dGVzL3ZpZGVvcy5weSAoc291cmNlL3Byb3h5L3Byb3h5LXN0YXR1cy9wcm94eS1nZW5lcmF0ZSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdmlkZW8ucHlcbi8vIFNpbmdsZSBwb2ludCB0aGF0IHBpY2tzIHRoZSB0cmFuc3BvcnQgZm9yIGEgcmVjb3JkaW5nJ3Mgc291cmNlL3Byb3h5IHN0cmVhbVxuLy8gKHJvYWRtYXAgcGxhbiAxMCkuIEluc2lkZSB0aGUgcGFja2FnZWQgRWxlY3Ryb24gYXBwLCB3aW5kb3cuZWxlY3Ryb25BUEkubWVkaWFQcm90b2NvbFxuLy8gaXMgc2V0IGFuZCBwbGF5YmFjayBnb2VzIHN0cmFpZ2h0IHRocm91Z2ggdGhlIG5hdGl2ZSBcInl1dS1tZWRpYTovL1wiIHNjaGVtZSAtXG4vLyBieXBhc3NpbmcgdGhlIFB5dGhvbiBieXRlLXB1bXAgLSBpbnN0ZWFkIG9mIHRoZSBIVFRQIHJvdXRlLiBQbGFpbiBicm93c2VyLWRldlxuLy8gbW9kZSBuZXZlciBoYXMgZWxlY3Ryb25BUEksIHNvIGl0IGFsd2F5cyBnZXRzIHRoZSB1bmNoYW5nZWQgSFRUUCBVUkwuIGFic1BhdGhcbi8vIG1heSBiZSBudWxsIChlLmcuIGEgcHJveHkgdGhhdCBoYXNuJ3QgYmVlbiBnZW5lcmF0ZWQvbG9va2VkIHVwIHlldCksIHdoaWNoXG4vLyBzaW1wbHkgZmFsbHMgYmFjayB0byBIVFRQIGZvciB0aGF0IG9uZSByZXF1ZXN0LlxuaW1wb3J0IHsgc3RyZWFtU1NFIH0gZnJvbSAnLi9qb2JzLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIF9idWlsZE1lZGlhVXJsKHZpZGVvSWQsIGtpbmQsIGFic1BhdGgpIHtcbiAgaWYgKHdpbmRvdy5lbGVjdHJvbkFQST8ubWVkaWFQcm90b2NvbCAmJiBhYnNQYXRoKSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZCA9IGFic1BhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuICAgIHJldHVybiBgeXV1LW1lZGlhOi8vbWVkaWEvJHtlbmNvZGVVUklDb21wb25lbnQobm9ybWFsaXplZCl9YDtcbiAgfVxuICByZXR1cm4gYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vJHtraW5kfWA7XG59XG5cbi8vIOKUgOKUgCByZWNvcmRpbmcgcHJldmlldyBxdWFsaXR5ICg3MjBwIHByb3h5ICsgYmFkZ2UpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gU2hhcmVkIGJ5IGV2ZXJ5IGZ1bGwtcmVjb3JkaW5nIDx2aWRlbz4gKHJlY29yZGluZyBkZXRhaWwgcGxheWVyLCBzcGxpdCBlZGl0b3IpXG4vLyBzbyB0aGUgY3JlYXRvciBhbHdheXMga25vd3Mgd2hldGhlciB0aGV5J3JlIHNlZWluZyB0aGUgZmFzdCA3MjBwIHByb3h5IG9yIHRoZVxuLy8gZnVsbC1xdWFsaXR5IG9yaWdpbmFsLiBQcmVmZXJzIHRoZSBwcm94eSB3aGVuIG9uZSBleGlzdHM7IG90aGVyd2lzZSBwbGF5cyB0aGVcbi8vIHNvdXJjZSBhbmQgZWl0aGVyIGJ1aWxkcyBhIHByb3h5IG9uIGRlbWFuZCAoYXV0b0J1aWxkKSBvciBpbnZpdGVzIHRoZSB1c2VyIHRvLlxuLy9cbi8vICAgdmlkZW9FbCAvIGJhZGdlRWwgOiB0aGUgPHZpZGVvPiBhbmQgaXRzIG92ZXJsYXkgYmFkZ2UgKGNhbGxlciBvd25zIGxheW91dClcbi8vICAgYXV0b0J1aWxkICAgICAgICAgOiBidWlsZCBpbW1lZGlhdGVseSB3aGVuIG5vIHByb3h5IGV4aXN0cyAoZGVsaWJlcmF0ZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIHNjcnViYmluZyBzdXJmYWNlcyksIGVsc2UgdGhlIGJhZGdlIG9mZmVycyBhIGNsaWNrLXRvLWJ1aWxkXG4vLyAgIGlzQ3VycmVudCAgICAgICAgIDogZ3VhcmQgc28gYSBsYXRlIHN3YXAgbmV2ZXIgbGFuZHMgb24gYSBzaW5jZS1jaGFuZ2VkIHZpZXdcbi8vICAgc3RhcnRTIC8gZW5kUyAgICAgOiBhIHNwbGl0IHNlZ21lbnQncyBwbGF5ZXIgc3RyZWFtcyB0aGUgZnVsbCB1bnRyaW1tZWQgcGFyZW50XG4vLyAgICAgICAgICAgICAgICAgICAgICAgZmlsZSAoc291cmNlIGFuZCBwcm94eSBhcmUgYm90aCBrZXllZCBieSB0aGUgcGFyZW50IHBhdGgpIC1cbi8vICAgICAgICAgICAgICAgICAgICAgICB0aGVzZSBib3VuZCBwbGF5YmFjayB0byB0aGUgc2VnbWVudCdzIG93biBzbGljZSBvZiBpdFxuLy8gICBzb3VyY2VQYXRoICAgICAgICA6IHRoZSByZWNvcmRpbmcncyBhYnNvbHV0ZSBwYXRoICh2aWRlby5zb3VyY2VfcGF0aCBmcm9tIHRoZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIGFscmVhZHktZmV0Y2hlZCB2aWRlbyByZWNvcmQpIC0gb25seSB1c2VkIHRvIGJ1aWxkIHRoZVxuLy8gICAgICAgICAgICAgICAgICAgICAgIEVsZWN0cm9uIG5hdGl2ZS1wcm90b2NvbCBVUkw7IGlnbm9yZWQgaW4gYnJvd3Nlci1kZXYgbW9kZVxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwUmVjb3JkaW5nUHJldmlldyh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCB7IGF1dG9CdWlsZCA9IGZhbHNlLCBpc0N1cnJlbnQgPSAoKSA9PiB0cnVlLCBzdGFydFMgPSBudWxsLCBlbmRTID0gbnVsbCwgc291cmNlUGF0aCA9IG51bGwgfSA9IHt9KSB7XG4gIHZpZGVvRWwuc3JjID0gX2J1aWxkTWVkaWFVcmwodmlkZW9JZCwgJ3NvdXJjZScsIHNvdXJjZVBhdGgpO1xuICBpZiAoc3RhcnRTICE9IG51bGwpIHtcbiAgICB2aWRlb0VsLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4geyB0cnkgeyB2aWRlb0VsLmN1cnJlbnRUaW1lID0gc3RhcnRTOyB9IGNhdGNoIChfKSB7fSB9LCB7IG9uY2U6IHRydWUgfSk7XG4gIH1cbiAgaWYgKGVuZFMgIT0gbnVsbCkge1xuICAgIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsICgpID0+IHsgaWYgKHZpZGVvRWwuY3VycmVudFRpbWUgPj0gZW5kUykgdmlkZW9FbC5wYXVzZSgpOyB9KTtcbiAgfVxuICBjb25zdCBidWlsZEZuID0gKCkgPT4gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMpO1xuICBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdvcmlnaW5hbCcsIG51bGwsIGF1dG9CdWlsZCA/IG51bGwgOiBidWlsZEZuKTtcbiAgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vcHJveHktc3RhdHVzYClcbiAgICAudGhlbihyID0+IHIub2sgPyByLmpzb24oKSA6IG51bGwpXG4gICAgLnRoZW4oc3RhdHVzID0+IHtcbiAgICAgIGlmICghaXNDdXJyZW50KCkgfHwgIXN0YXR1cykgcmV0dXJuO1xuICAgICAgaWYgKHN0YXR1cy5hdmFpbGFibGUpIF91c2VSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0Uywgc3RhdHVzLnByb3h5X3BhdGgpO1xuICAgICAgZWxzZSBpZiAoYXV0b0J1aWxkIHx8IHN0YXR1cy5nZW5lcmF0aW5nKSBidWlsZEZuKCk7XG4gICAgfSlcbiAgICAuY2F0Y2goKCkgPT4geyAvKiBsZWF2ZSB0aGUgc291cmNlIHBsYXlpbmcgd2l0aCB0aGUgb3JpZ2luYWwtcXVhbGl0eSBiYWRnZSAqLyB9KTtcbn1cblxuLy8gc3RhcnRTOiBmYWxscyBiYWNrIHRvIGl0IHdoZW4gY3VycmVudFRpbWUgaXMgc3RpbGwgMCAtIHRoZSBwcm94eS1zdGF0dXMgZmV0Y2hcbi8vIGNhbiByZXNvbHZlIGJlZm9yZSB0aGUgc291cmNlJ3MgbG9hZGVkbWV0YWRhdGEgc2VlayAoc2V0dXBSZWNvcmRpbmdQcmV2aWV3KSBydW5zLFxuLy8gd2hpY2ggd291bGQgb3RoZXJ3aXNlIHJlc3VtZSBhIHNlZ21lbnQncyBwcm94eSBhdCB0aGUgcGFyZW50J3MgdD0wLlxuZnVuY3Rpb24gX3VzZVJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTID0gbnVsbCwgcHJveHlQYXRoID0gbnVsbCkge1xuICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gIGNvbnN0IHJlc3VtZUF0ICAgPSB2aWRlb0VsLmN1cnJlbnRUaW1lIHx8IHN0YXJ0UyB8fCAwO1xuICBjb25zdCB3YXNQbGF5aW5nID0gIXZpZGVvRWwucGF1c2VkICYmICF2aWRlb0VsLmVuZGVkO1xuICB2aWRlb0VsLnNyYyA9IF9idWlsZE1lZGlhVXJsKHZpZGVvSWQsICdwcm94eScsIHByb3h5UGF0aCk7XG4gIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiB7XG4gICAgdHJ5IHsgdmlkZW9FbC5jdXJyZW50VGltZSA9IHJlc3VtZUF0OyB9IGNhdGNoIChfKSB7fVxuICAgIGlmICh3YXNQbGF5aW5nKSB2aWRlb0VsLnBsYXkoKS5jYXRjaCgoKSA9PiB7fSk7XG4gIH0sIHsgb25jZTogdHJ1ZSB9KTtcbiAgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAncHJveHknKTtcbn1cblxuZnVuY3Rpb24gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMgPSBudWxsKSB7XG4gIGlmICghaXNDdXJyZW50KCkpIHJldHVybjtcbiAgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAnYnVpbGRpbmcnKTtcbiAgc3RyZWFtU1NFKFxuICAgIGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L3Byb3h5L2dlbmVyYXRlYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gICAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9wcm94eS1zdGF0dXNgKVxuICAgICAgICAudGhlbihyID0+IHIub2sgPyByLmpzb24oKSA6IG51bGwpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgaWYgKCFpc0N1cnJlbnQoKSkgcmV0dXJuO1xuICAgICAgaWYgKHN0YXR1cz8uYXZhaWxhYmxlKSBfdXNlUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMsIHN0YXR1cy5wcm94eV9wYXRoKTtcbiAgICAgIC8vIEFub3RoZXIgb3BlbiBpcyBzdGlsbCBlbmNvZGluZyAtIHBvbGwgdW50aWwgaXRzIHByb3h5IGxhbmRzLlxuICAgICAgZWxzZSBpZiAoc3RhdHVzPy5nZW5lcmF0aW5nKSBzZXRUaW1lb3V0KCgpID0+IF9idWlsZFJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTKSwgNTAwMCk7XG4gICAgICBlbHNlIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ29yaWdpbmFsJywgbnVsbCwgKCkgPT4gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMpKTtcbiAgICB9LFxuICAgIG51bGwsICAgICAgICAvLyBubyBnbG9iYWwgam9iIHBpbGwgLSB0aGlzIGlzIGEgYmFja2dyb3VuZCBjb252ZW5pZW5jZVxuICAgICdQcmV2aWV3JyxcbiAgICBmYWxzZSxcbiAgICBsaW5lID0+IHsgICAgLy8gb25MaW5lOiBzdXJmYWNlIHRoZSBlbmNvZGUgcGVyY2VudGFnZSBvbiB0aGUgYmFkZ2VcbiAgICAgIGNvbnN0IG0gPSAvKFxcZCspJS8uZXhlYyhsaW5lKTtcbiAgICAgIGlmIChtICYmIGlzQ3VycmVudCgpKSBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdidWlsZGluZycsIG1bMV0pO1xuICAgIH0sXG4gICk7XG59XG5cbmZ1bmN0aW9uIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgbW9kZSwgcGN0LCBvbkJ1aWxkKSB7XG4gIGlmICghYmFkZ2VFbCkgcmV0dXJuO1xuICAvLyBSZXNldCB0byBhIG5vbi1pbnRlcmFjdGl2ZSBzdGF0dXMgaW5kaWNhdG9yOyB0aGUgYnVpbGQgYWZmb3JkYW5jZSBiZWxvd1xuICAvLyByZS1hcm1zIGl0IGFzIGEgYnV0dG9uIHNvIHJvbGUvdGFiaW5kZXggbmV2ZXIgZ28gc3RhbGUgYmV0d2VlbiBzdGF0ZXMuXG4gIGJhZGdlRWwuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICBiYWRnZUVsLm9uY2xpY2sgPSBudWxsO1xuICBiYWRnZUVsLm9ua2V5ZG93biA9IG51bGw7XG4gIGJhZGdlRWwuc3R5bGUuY3Vyc29yID0gJyc7XG4gIGJhZGdlRWwuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdub25lJztcbiAgYmFkZ2VFbC5yZW1vdmVBdHRyaWJ1dGUoJ3RhYmluZGV4Jyk7XG4gIGJhZGdlRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3N0YXR1cycpO1xuICBiYWRnZUVsLmNsYXNzTGlzdC50b2dnbGUoJ3ByZXZpZXctYmFkZ2UtcHJveHknLCBtb2RlID09PSAncHJveHknKTtcbiAgYmFkZ2VFbC5jbGFzc0xpc3QucmVtb3ZlKCdwcmV2aWV3LWJhZGdlLWJ1aWxkJyk7XG4gIGlmIChtb2RlID09PSAncHJveHknKSB7XG4gICAgYmFkZ2VFbC50ZXh0Q29udGVudCA9ICdQcmV2aWV3IHF1YWxpdHkgKDcyMHApJztcbiAgICBiYWRnZUVsLnRpdGxlID0gJ1BsYXlpbmcgYSBkb3duc2NhbGVkIDcyMHAgcHJldmlldyBmb3IgZmFzdCBzZWVraW5nIC0gbm90IGZ1bGwgcXVhbGl0eS4gRXhwb3J0cyB1c2UgdGhlIG9yaWdpbmFsLic7XG4gIH0gZWxzZSBpZiAobW9kZSA9PT0gJ2J1aWxkaW5nJykge1xuICAgIGJhZGdlRWwudGV4dENvbnRlbnQgPSBwY3QgPyBgQnVpbGRpbmcgNzIwcCBwcmV2aWV34oCmICR7cGN0fSVgIDogJ0J1aWxkaW5nIDcyMHAgcHJldmlld+KApic7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdFbmNvZGluZyBhIGZhc3Qtc2Vla2luZyA3MjBwIHByZXZpZXcgZnJvbSB0aGUgc291cmNlIHJlY29yZGluZy4nO1xuICB9IGVsc2UgaWYgKG9uQnVpbGQpIHtcbiAgICAvLyBSZW5kZXIgdGhlIGFjdGlvbiBhcyBhIGJ1dHRvbi1zdHlsZWQgcGlsbCBzbyBpdCBvYnZpb3VzbHkgaW52aXRlcyBhIGNsaWNrLlxuICAgIGJhZGdlRWwuY2xhc3NMaXN0LmFkZCgncHJldmlldy1iYWRnZS1idWlsZCcpO1xuICAgIGJhZGdlRWwuaW5uZXJIVE1MID0gJ09yaWdpbmFsIHF1YWxpdHkgwrcgPHNwYW4gY2xhc3M9XCJwcmV2aWV3LWJhZGdlLWFjdGlvblwiPiYjOTg4OTsgQnVpbGQgNzIwcCBwcmV2aWV3PC9zcGFuPic7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdQbGF5aW5nIHRoZSBmdWxsLXF1YWxpdHkgb3JpZ2luYWwuIEJ1aWxkIGEgNzIwcCBwcmV2aWV3IHNvIHNlZWtpbmcgaXMgZmFzdC4nO1xuICAgIGJhZGdlRWwuc3R5bGUuY3Vyc29yID0gJ3BvaW50ZXInO1xuICAgIGJhZGdlRWwuc3R5bGUucG9pbnRlckV2ZW50cyA9ICdhdXRvJztcbiAgICBiYWRnZUVsLnNldEF0dHJpYnV0ZSgncm9sZScsICdidXR0b24nKTtcbiAgICBiYWRnZUVsLnRhYkluZGV4ID0gMDtcbiAgICBiYWRnZUVsLm9uY2xpY2sgPSBvbkJ1aWxkO1xuICAgIGJhZGdlRWwub25rZXlkb3duID0gKGUpID0+IHsgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnICcpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBvbkJ1aWxkKCk7IH0gfTtcbiAgfSBlbHNlIHtcbiAgICBiYWRnZUVsLnRleHRDb250ZW50ID0gJ09yaWdpbmFsIHF1YWxpdHkgwrcgc2xvd2VyIHNlZWtpbmcnO1xuICAgIGJhZGdlRWwudGl0bGUgPSAnUGxheWluZyB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nIC0gc2Vla2luZyBhIGxvbmcgZmlsZSBjYW4gYmUgc2xvdy4nO1xuICB9XG59XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBDcm9zcy1jdXR0aW5nIFVJIGZlZWRiYWNrIGhlbHBlcnMgd2l0aCBubyBob21lIGluIGEgc2luZ2xlIGZlYXR1cmU6IHRvYXN0cywgdGhlXHJcbi8vICAgYm90dG9tIGxvZyBwYW5lbCwgc29ydC1kaXJlY3Rpb24gYnV0dG9ucywgc3BlYWtlci1sYWJlbHMgKGRpYXJpemF0aW9uKSByZWFkaW5lc3MsIFwicmV2ZWFsIGluXHJcbi8vICAgZm9sZGVyXCIsIGFuZCBjbGlwYm9hcmQgY29weS4gU3RhdGUvZm9ybWF0L2pvYi1TU0UvcHJldmlldyBtYWNoaW5lcnkgc3BsaXQgb3V0IGluIHN0YWdlIDAyLlxyXG4vLyAgIEFQSTogcm91dGVzL2NvbmZpZy5weSwgcm91dGVzL2xvZ3MucHkgKGluZGlyZWN0bHkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5XHJcbmltcG9ydCB7IGVzY0h0bWwsIHN0cmlwUmljaE1hcmt1cCB9IGZyb20gJy4vZm9ybWF0LmpzJztcclxuXHJcbi8vIOKUgOKUgCBzb3J0LWRpcmVjdGlvbiB0b2dnbGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIFJlZmxlY3RzIGEgc29ydC1kaXJlY3Rpb24gdG9nZ2xlJ3MgY3VycmVudCBzdGF0ZSBvbnRvIGl0cyBidXR0b246IGFycm93IGdseXBoLFxyXG4vLyBhcmlhLXByZXNzZWQsIGFuZCBhIHNlbGYtZGVzY3JpYmluZyBhcmlhLWxhYmVsLiAnZGVzYycgaXMgdGhlIHNvcnQgb3B0aW9uJ3NcclxuLy8gbmF0dXJhbCBvcmRlciAoaGlnaGVzdC9uZXdlc3QgZmlyc3QpOyAnYXNjJyByZXZlcnNlcyBpdC5cclxuZXhwb3J0IGZ1bmN0aW9uIF9zeW5jU29ydERpckJ0bihidG5JZCwgZGlyKSB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYnRuSWQpO1xyXG4gIGlmICghYnRuKSByZXR1cm47XHJcbiAgY29uc3QgYXNjID0gZGlyID09PSAnYXNjJztcclxuICBidG4uaW5uZXJIVE1MID0gYXNjID8gJyYjODU5MzsnIDogJyYjODU5NTsnO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFzYyA/ICd0cnVlJyA6ICdmYWxzZScpO1xyXG4gIGJ0bi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhc2NcclxuICAgID8gJ1NvcnRlZCBhc2NlbmRpbmcgLSBjbGljayB0byBzb3J0IGRlc2NlbmRpbmcnXHJcbiAgICA6ICdTb3J0ZWQgZGVzY2VuZGluZyAtIGNsaWNrIHRvIHNvcnQgYXNjZW5kaW5nJyk7XHJcbiAgYnRuLnRpdGxlID0gYXNjID8gJ0FzY2VuZGluZyBvcmRlcicgOiAnRGVzY2VuZGluZyBvcmRlcic7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBzcGVha2VyIGxhYmVscyAoZGlhcml6YXRpb24pIHJlYWRpbmVzcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gU3BlZWNoQnJhaW4gKHRoZSBkZWZhdWx0IGJhY2tlbmQpIGlzIGJ1bmRsZWQgLSBpdHMgcGFja2FnZSBzaG91bGQgYWx3YXlzIGJlXHJcbi8vIHByZXNlbnQsIHNvIGFuIHVucmVhZHkgcmVzdWx0IHRoZXJlIG1lYW5zIGEgYnJva2VuIGluc3RhbGwsIG5vdCBhIG1pc3NpbmdcclxuLy8gb3B0aW9uYWwgZG93bmxvYWQuIFB5YW5ub3RlIGlzIHRoZSBhZHZhbmNlZCwgdG9rZW4tZ2F0ZWQgYWx0ZXJuYXRpdmUgYW5kIHN0aWxsXHJcbi8vIG5lZWRzIGEgcmVhbCBpbnN0YWxsICsgYSBIdWdnaW5nRmFjZSB0b2tlbi4gVGhlIHBlci1ydW4gY2hlY2tib3hlcyBpbiB0aGVcclxuLy8gYW5hbHl6ZSBhbmQgZXhwb3J0IHBhbmVscyBib3RoIGdhdGUgb24gdGhpcyBzaW5nbGUgY2hlY2suIENlbnRyYWxpemVkIGhlcmUgc29cclxuLy8gdGhlIHRocmVlIHN1cmZhY2VzIChTZXR0aW5ncywgYW5hbHl6ZSwgZXhwb3J0KSBjYW4ndCBkcmlmdCB0byBkaWZmZXJlbnQgcnVsZXMuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZGlhcml6YXRpb25SZWFzb24oaW5zdGFsbGVkKSB7XHJcbiAgcmV0dXJuIGluc3RhbGxlZCA/ICcnIDogJ1NwZWVjaEJyYWluIGlzIHVuYXZhaWxhYmxlIC0gdHJ5IHJlaW5zdGFsbGluZyBZdXVDbGlwJztcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIF9kaWFyaXphdGlvblJlYWRpbmVzcygpIHtcclxuICBjb25zdCBjZmcgPSBhd2FpdCBmZXRjaCgnL2FwaS9jb25maWcnKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+ICh7fSkpO1xyXG4gIGNvbnN0IGJhY2tlbmQgPSBjZmcuZGlhcml6YXRpb25fYmFja2VuZCB8fCAnc3BlZWNoYnJhaW4nO1xyXG4gIGNvbnN0IGluc3RhbGwgPSBhd2FpdCBmZXRjaCgnL2FwaS9pbnN0YWxsL3NwZWVjaGJyYWluJykudGhlbihyID0+IHIuanNvbigpKS5jYXRjaCgoKSA9PiAoe2luc3RhbGxlZDogZmFsc2V9KSk7XHJcbiAgY29uc3QgaW5zdGFsbGVkID0gISFpbnN0YWxsLmluc3RhbGxlZDtcclxuICByZXR1cm4ge1xyXG4gICAgaW5zdGFsbGVkLFxyXG4gICAgYmFja2VuZCxcclxuICAgIHJlYWR5OiAgIGluc3RhbGxlZCxcclxuICAgIHJlYXNvbjogIF9kaWFyaXphdGlvblJlYXNvbihpbnN0YWxsZWQpLFxyXG4gIH07XHJcbn1cclxuXHJcbi8vIE5vdGUgc2hvd24gb24gYSBkaXNhYmxlZCBzcGVha2VyLWxhYmVscyBjb250cm9sOiB0aGUgYmxvY2tpbmcgcmVhc29uIHBsdXMgYVxyXG4vLyBidXR0b24gdGhhdCBqdW1wcyB0byBTZXR0aW5ncy4gc2V0dGluZ3NPbmNsaWNrIGNsb3NlcyB0aGUgaG9zdCBzdXJmYWNlIGZpcnN0XHJcbi8vICh0aGUgYW5hbHl6ZSBwYW5lbCBvciBleHBvcnQgbW9kYWwpIHNvIFNldHRpbmdzIGlzbid0IG9wZW5lZCBiZWhpbmQgaXQuXHJcbmV4cG9ydCBmdW5jdGlvbiBfZGlhcml6YXRpb25Ob3RlSHRtbChyZWFzb24sIHNldHRpbmdzT25jbGljaykge1xyXG4gIHJldHVybiBlc2NIdG1sKHJlYXNvbikgKyAnIC0gc2V0IHVwIGluICcgK1xyXG4gICAgJzxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6MCA0cHg7Y29sb3I6dmFyKC0tYWNjZW50KTsnICtcclxuICAgIGBkaXNwbGF5OmlubGluZS1mbGV4XCIgb25jbGljaz1cIiR7ZXNjSHRtbChzZXR0aW5nc09uY2xpY2spfVwiPlNldHRpbmdzPC9idXR0b24+YDtcclxufVxyXG5cclxuLy8g4pSA4pSAIGxvZyBwYW5lbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5Mb2coKSB7XHJcbiAgY29uc3QgcGFuZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLXBhbmVsJyk7XHJcbiAgcGFuZWwuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xyXG4gIHBhbmVsLmNsYXNzTGlzdC5yZW1vdmUoJ21pbmltaXplZCcpO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctdG9nZ2xlJykudGV4dENvbnRlbnQgPSAn4payJztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUxvZygpIHtcclxuICBjb25zdCBwYW5lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctcGFuZWwnKTtcclxuICBjb25zdCBtaW5pbWl6ZWQgPSBwYW5lbC5jbGFzc0xpc3QudG9nZ2xlKCdtaW5pbWl6ZWQnKTtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLXRvZ2dsZScpLnRleHRDb250ZW50ID0gbWluaW1pemVkID8gJ+KWvCcgOiAn4payJztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWxvZy10b2dnbGUnKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBtaW5pbWl6ZWQgPyAnZmFsc2UnIDogJ3RydWUnKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNsZWFyTG9nKCkge1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctbGluZXMnKS5pbm5lckhUTUwgPSAnJztcclxufVxyXG5cclxuLy8gVGhlIGxvZyBoZWFkZXIncyB0b2dnbGUvY2xlYXIgYnV0dG9ucyBhcmUgc3RhdGljIG1hcmt1cCBpbiBpbmRleC5odG1sIChuZXZlclxyXG4vLyByZS1yZW5kZXJlZCksIHNvIHRoaXMgb25lLXRpbWUgd2lyaW5nIGF0IG1vZHVsZSBsb2FkIGNhbid0IGRvdWJsZS1maXJlLlxyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWxvZy10b2dnbGUnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZUxvZyk7XHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2xlYXItbG9nJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjbGVhckxvZyk7XHJcblxyXG4vLyBDYXAgdGhlIGxvZyBET00uIEFuIHVuYm91bmRlZCBsb2cgZnJvemUgdGhlIGJyb3dzZXIgb24gbG9uZyBydW5zIGFuZCwgd29yc2UsXHJcbi8vIHdoZW4gYSByZWF0dGFjaGVkIGFuYWx5emUgc3RyZWFtIHJlcGxheWVkIGEgbGFyZ2UgYnVmZmVyIGFsbCBhdCBvbmNlIChlYWNoIGxpbmVcclxuLy8gdHJpZ2dlcnMgYSBzY3JvbGwtdG8tYm90dG9tIHJlZmxvdykgLSB0aGUgdGFiIGxvY2tlZCB1cCwgdGhlIGVsYXBzZWQgdGltZXJcclxuLy8gYXBwZWFyZWQgZnJvemVuLCBhbmQgQ2FuY2VsIHdvdWxkbid0IHJlc3BvbmQuIEtlZXBpbmcgb25seSB0aGUgbW9zdCByZWNlbnQgbGluZXNcclxuLy8gYm91bmRzIHRoZSByZWZsb3cgY29zdDsgdGhlIGZ1bGwgbG9nIGFsd2F5cyByZW1haW5zIGluIC55dXUtY2xpcC95dXUtY2xpcC5sb2cuXHJcbmNvbnN0IF9NQVhfTE9HX0xJTkVTID0gNTAwO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZExvZyhyYXcpIHtcclxuICBjb25zdCB0ZXh0ID0gc3RyaXBSaWNoTWFya3VwKHJhdyk7XHJcbiAgaWYgKCF0ZXh0LnRyaW0oKSkgcmV0dXJuO1xyXG4gIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnN0IGlzT2sgICA9IHJhdy5pbmNsdWRlcygnIE9LJykgfHwgcmF3LmluY2x1ZGVzKCdbZ3JlZW5dJykgfHwgcmF3LmluY2x1ZGVzKCdEb25lJyk7XHJcbiAgY29uc3QgaXNFcnIgICA9IHJhdy5pbmNsdWRlcygnRkFJTCcpIHx8IHJhdy5pbmNsdWRlcygnRXJyb3InKSB8fCByYXcuaW5jbHVkZXMoJ1tyZWRdJykgfHwgcmF3LmluY2x1ZGVzKCdlcnJvcicpO1xyXG4gIGNvbnN0IGlzV2FybiAgPSByYXcuaW5jbHVkZXMoJ1t5ZWxsb3ddJykgfHwgcmF3LmluY2x1ZGVzKCdXQVJOSU5HJykgfHwgcmF3LmluY2x1ZGVzKCdvdmVybGFwJyk7XHJcbiAgZGl2LmNsYXNzTmFtZSA9ICdsb2ctbGluZScgKyAoaXNPayA/ICcgb2snIDogaXNFcnIgPyAnIGVycicgOiBpc1dhcm4gPyAnIHdhcm4nIDogJycpO1xyXG4gIGRpdi5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xyXG4gIGRpdi5zdHlsZS5nYXAgPSAnNnB4JztcclxuICBjb25zdCB0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB0cy5zdHlsZS5jc3NUZXh0ID0gJ2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTBweDtmbGV4LXNocmluazowO29wYWNpdHk6LjcnO1xyXG4gIHRzLnRleHRDb250ZW50ID0gbmV3IERhdGUoKS50b0xvY2FsZVRpbWVTdHJpbmcodW5kZWZpbmVkLCB7aG91cjonMi1kaWdpdCcsIG1pbnV0ZTonMi1kaWdpdCcsIHNlY29uZDonMi1kaWdpdCd9KTtcclxuICBkaXYuYXBwZW5kQ2hpbGQodHMpO1xyXG4gIGRpdi5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0KSk7XHJcbiAgY29uc3QgbGluZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWxpbmVzJyk7XHJcbiAgbGluZXMuYXBwZW5kQ2hpbGQoZGl2KTtcclxuICB3aGlsZSAobGluZXMuY2hpbGRFbGVtZW50Q291bnQgPiBfTUFYX0xPR19MSU5FUykgbGluZXMucmVtb3ZlQ2hpbGQobGluZXMuZmlyc3RFbGVtZW50Q2hpbGQpO1xyXG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWJvZHknKTtcclxuICBib2R5LnNjcm9sbFRvcCA9IGJvZHkuc2Nyb2xsSGVpZ2h0O1xyXG59XHJcblxyXG4vLyDilIDilIAgdG9hc3Qgbm90aWZpY2F0aW9ucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gVHlwZXM6IHN1Y2Nlc3MgfCBpbmZvIHwgd2FybmluZyAoZ3VhcmQvZ3VpZGFuY2UpIHwgZXJyb3IgKGFjdHVhbCBmYWlsdXJlcykuXHJcbi8vIEVycm9yIHRvYXN0cyBwZXJzaXN0IHVudGlsIGRpc21pc3NlZCAtIGR1cmF0aW9uTXMgaXMgaWdub3JlZCBmb3IgdGhlbS5cclxuLy8gb3B0czogeyBkdXJhdGlvbk1zLCBhY3Rpb246IHtsYWJlbCwgb25DbGlja30gfVxyXG5jb25zdCBUT0FTVF9TVEFDS19NQVggPSA0O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlLCB0eXBlID0gJ3N1Y2Nlc3MnLCBvcHRzID0ge30pIHtcclxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9hc3QtY29udGFpbmVyJyk7XHJcbiAgY29uc3QgbGl2ZVJlZ2lvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHR5cGUgPT09ICdlcnJvcicgPyAnc3ItbGl2ZS1hc3NlcnRpdmUnIDogJ3NyLWxpdmUtcG9saXRlJyk7XHJcbiAgaWYgKGxpdmVSZWdpb24pIHsgbGl2ZVJlZ2lvbi50ZXh0Q29udGVudCA9ICcnOyBzZXRUaW1lb3V0KCgpID0+IHsgbGl2ZVJlZ2lvbi50ZXh0Q29udGVudCA9IG1lc3NhZ2U7IH0sIDEwKTsgfVxyXG4gIHdoaWxlIChjb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID49IFRPQVNUX1NUQUNLX01BWCkgY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkLnJlbW92ZSgpO1xyXG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHRvYXN0ICR7dHlwZX1gO1xyXG4gIHRvYXN0LnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MTBweCc7XHJcbiAgY29uc3QgbXNnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIG1zZy50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XHJcbiAgdG9hc3QuYXBwZW5kQ2hpbGQobXNnKTtcclxuICBjb25zdCBidXR0b25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgYnV0dG9ucy5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDtnYXA6NnB4O2FsaWduLWl0ZW1zOmNlbnRlcjtmbGV4LXNocmluazowJztcclxuICBpZiAob3B0cy5hY3Rpb24pIHtcclxuICAgIGNvbnN0IGFjdGlvbkJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgYWN0aW9uQnRuLmNsYXNzTmFtZSA9ICdidG4gZ2hvc3QnO1xyXG4gICAgYWN0aW9uQnRuLnN0eWxlLmNzc1RleHQgPSAnZm9udC1zaXplOjExcHg7cGFkZGluZzoycHggOHB4JztcclxuICAgIGFjdGlvbkJ0bi50ZXh0Q29udGVudCA9IG9wdHMuYWN0aW9uLmxhYmVsO1xyXG4gICAgYWN0aW9uQnRuLm9uY2xpY2sgPSAoKSA9PiB7IHRvYXN0LnJlbW92ZSgpOyBvcHRzLmFjdGlvbi5vbkNsaWNrKCk7IH07XHJcbiAgICBidXR0b25zLmFwcGVuZENoaWxkKGFjdGlvbkJ0bik7XHJcbiAgfVxyXG4gIGNvbnN0IGNsb3NlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgY2xvc2UudGV4dENvbnRlbnQgPSAnw5cnO1xyXG4gIGNsb3NlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdEaXNtaXNzJyk7XHJcbiAgY2xvc2Uuc3R5bGUuY3NzVGV4dCA9IGBiYWNrZ3JvdW5kOm5vbmU7Ym9yZGVyOm5vbmU7Y29sb3I6aW5oZXJpdDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MThweDtsaW5lLWhlaWdodDoxO3BhZGRpbmc6MDtmbGV4LXNocmluazowO29wYWNpdHk6JHt0eXBlID09PSAnZXJyb3InID8gJy44JyA6ICcuNSd9YDtcclxuICBjbG9zZS5vbmNsaWNrID0gKCkgPT4gdG9hc3QucmVtb3ZlKCk7XHJcbiAgYnV0dG9ucy5hcHBlbmRDaGlsZChjbG9zZSk7XHJcbiAgdG9hc3QuYXBwZW5kQ2hpbGQoYnV0dG9ucyk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcclxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykgcmV0dXJuO1xyXG4gIGNvbnN0IG1zID0gb3B0cy5kdXJhdGlvbk1zID8/ICh0eXBlID09PSAnd2FybmluZycgPyA2MDAwIDogNDAwMCk7XHJcbiAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICB0b2FzdC5zdHlsZS50cmFuc2l0aW9uID0gJ29wYWNpdHkgLjNzJztcclxuICAgIHRvYXN0LnN0eWxlLm9wYWNpdHkgPSAnMCc7XHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHRvYXN0LnJlbW92ZSgpLCAzMDApO1xyXG4gIH0sIG1zKTtcclxufVxyXG5cclxuLy8g4pSA4pSAIG5ldHdvcmsgZXJyb3IgY29weSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gQSBmZXRjaCgpIHJlamVjdGlvbiBtZWFucyB0aGUgcmVxdWVzdCBuZXZlciBnb3QgYSByZXNwb25zZSAtIG9uIHRoaXMgbG9jYWxob3N0L1xyXG4vLyBFbGVjdHJvbiBhcHAgdGhhdCBhbG1vc3QgYWx3YXlzIG1lYW5zIHRoZSBiYWNrZW5kIHN0b3BwZWQsIG5vdCBhIHJlYWwgbmV0d29yay5cclxuLy8gVGhlIGJyb3dzZXIgcmVwb3J0cyBpdCBhcyBhIFR5cGVFcnJvciB3aG9zZSBtZXNzYWdlIGlzIHRoZSBvcGFxdWUgXCJGYWlsZWQgdG9cclxuLy8gZmV0Y2hcIiwgdXNlbGVzcyB0byBhIG5vbi1kZXZlbG9wZXIuIEFuIEVycm9yIHRocm93biBhZnRlciBhIG5vbi1vayByZXNwb25zZVxyXG4vLyBhbHJlYWR5IGNhcnJpZXMgYSByZWFsLCBzcGVjaWZpYyBtZXNzYWdlLCBzbyBwYXNzIHRob3NlIHRocm91Z2ggdW5jaGFuZ2VkLiBVc2VcclxuLy8gdGhpcyBvbmx5IGF0IGNhdGNoIHNpdGVzIHRoYXQgd3JhcCBhIGJhcmUgZmV0Y2ggKG5vdCBvbmVzIGRvaW5nIERPTSB3b3JrIHRoYXRcclxuLy8gY291bGQgdGhyb3cgaXRzIG93biBUeXBlRXJyb3IpLlxyXG5leHBvcnQgZnVuY3Rpb24gbmV0RXJyTXNnKGVycikge1xyXG4gIGlmIChlcnIgaW5zdGFuY2VvZiBUeXBlRXJyb3IpIHJldHVybiBcIkNvdWxkbid0IHJlYWNoIFl1dUNsaXAgLSBpdCBtYXkgaGF2ZSBzdG9wcGVkLiBUcnkgYWdhaW4sIG9yIHJlc3RhcnQgdGhlIGFwcC5cIjtcclxuICByZXR1cm4gKGVyciAmJiBlcnIubWVzc2FnZSkgfHwgJ1Vua25vd24gZXJyb3InO1xyXG59XHJcblxyXG4vLyDilIDilIAgcmV2ZWFsIGluIGZpbGUgZXhwbG9yZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXZlYWxJbkZvbGRlcihwYXRoKSB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCcvYXBpL3JldmVhbCcsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcclxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3BhdGh9KSxcclxuICAgIH0pO1xyXG4gICAgaWYgKCFyZXMub2spIHtcclxuICAgICAgY29uc3QgZSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XHJcbiAgICAgIHNob3dUb2FzdChgQ291bGQgbm90IHNob3cgaW4gZm9sZGVyOiAke2UuZGV0YWlsIHx8ICdmYWlsZWQnfWAsICdlcnJvcicpO1xyXG4gICAgfVxyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgc2hvd1RvYXN0KGBDb3VsZCBub3Qgc2hvdyBpbiBmb2xkZXI6ICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyDilIDilIAgY2xpcGJvYXJkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBUaGUgYXBwIG9ubHkgZXZlciBydW5zIG9uIGxvY2FsaG9zdCBvciBpbnNpZGUgRWxlY3Ryb24sIHNvIG5hdmlnYXRvci5jbGlwYm9hcmRcclxuLy8gaXMgYWx3YXlzIGF2YWlsYWJsZSAtIGEgZmFpbHVyZSB0b2FzdCBpcyBlbm91Z2gsIG5vIGV4ZWNDb21tYW5kIGZhbGxiYWNrLlxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY29weVRleHQodGV4dCwgbGFiZWwpIHtcclxuICB0cnkge1xyXG4gICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dCk7XHJcbiAgICBzaG93VG9hc3QoYCR7bGFiZWx9IGNvcGllZGAsICdzdWNjZXNzJyk7XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBzaG93VG9hc3QoYENvdWxkIG5vdCBjb3B5ICR7bGFiZWwudG9Mb3dlckNhc2UoKX06ICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyDilIDilIAgY29sbGFwc2libGUgZGV0YWlsIGNhcmRzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBPcHQtaW46IGJ1aWxkIGEgY2FyZCB3aXRoIGNvbGxhcHNpYmxlQ2FyZChrZXksIHRpdGxlLCBib2R5LCB7YWN0aW9uc30pLiBUaGVcclxuLy8gdGl0bGUgaXMgcmVuZGVyZWQgaW5zaWRlIGEgcmVhbCA8YnV0dG9uIGNsYXNzPVwiY2FyZC10b2dnbGVcIj4sIHNvIHRoZSB0b2dnbGVcclxuLy8gaGFzIG5hdGl2ZSBrZXlib2FyZC9mb2N1cyBiZWhhdmlvdXIgYW5kIC0gYmVjYXVzZSBzaG9ydGN1dHMuanMncyBnbG9iYWxcclxuLy8ga2V5ZG93biBiYWlscyBvbiB0YWdOYW1lID09PSAnQlVUVE9OJyAtIFNwYWNlIG9uIGEgZm9jdXNlZCB0b2dnbGUgbmV2ZXIgYWxzb1xyXG4vLyBmaXJlcyBwbGF5L3BhdXNlLiBIZWFkZXIgYWN0aW9uIGNvbnRyb2xzIGFyZSBwYXNzZWQgdmlhIG9wdHMuYWN0aW9ucyBhbmQgc2l0XHJcbi8vIGFzIFNJQkxJTkdTIG9mIHRoZSB0b2dnbGUgYnV0dG9uLCBuZXZlciBkZXNjZW5kYW50cywgc28gYSBidXR0b24gbmV2ZXIgbmVzdHNcclxuLy8gaW5zaWRlIHRoZSB0b2dnbGUgKFdDQUcgNC4xLjIgbmVzdGVkLWludGVyYWN0aXZlKS4gU2VlZGVkIGZyb20gaXNDYXJkQ29sbGFwc2VkKGtleSkuXHJcbmNvbnN0IF9DQVJEX0NPTExBUFNFX0tFWSA9ICd5dXVjbGlwLWNhcmQtY29sbGFwc2VkJztcclxuXHJcbmZ1bmN0aW9uIF9jYXJkQ29sbGFwc2VTdGF0ZSgpIHtcclxuICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShfQ0FSRF9DT0xMQVBTRV9LRVkpIHx8ICd7fScpIHx8IHt9OyB9XHJcbiAgY2F0Y2ggeyByZXR1cm4ge307IH1cclxufVxyXG5cclxuLy8gUGVyc2lzdGVkIGNvbGxhcHNlIHN0YXRlIHBlciBjYXJkIGtleS4gZGVmYXVsdENvbGxhcHNlZCBsZXRzIGEgY2FyZCAoZS5nLiB0aGVcclxuLy8gaGVhdnkgZnVsbC12aWRlbyB0cmFuc2NyaXB0KSBzdGFydCBjb2xsYXBzZWQgdW50aWwgdGhlIHVzZXIgb3BlbnMgaXQuXHJcbmZ1bmN0aW9uIGlzQ2FyZENvbGxhcHNlZChrZXksIGRlZmF1bHRDb2xsYXBzZWQgPSBmYWxzZSkge1xyXG4gIGNvbnN0IHN0YXRlID0gX2NhcmRDb2xsYXBzZVN0YXRlKCk7XHJcbiAgcmV0dXJuIGtleSBpbiBzdGF0ZSA/ICEhc3RhdGVba2V5XSA6IGRlZmF1bHRDb2xsYXBzZWQ7XHJcbn1cclxuXHJcbi8vIFNpbmdsZSBzb3VyY2Ugb2YgdGhlIGNvbGxhcHNpYmxlLWNhcmQgbWFya3VwIGNvbnRyYWN0OiB0aGUgfjExIGRldGFpbCBjYXJkc1xyXG4vLyB0aGF0IG9wdCBpbiBhbGwgcmVuZGVyIHRocm91Z2ggaGVyZSBzbyBub25lIGNhbiBkcmlmdCBmcm9tIHRoZSBjbGFzcyAvXHJcbi8vIGRhdGEtY29sbGFwc2Uta2V5IC8gdG9nZ2xlLWExMXkgYXR0cmlidXRlcyB0aGUgdG9nZ2xlIGxvZ2ljIGJlbG93IHJlYWRzLlxyXG4vLyB0aXRsZSA9IHRoZSBoZWFkZXIncyB0aXRsZSBjb250ZW50IChnb2VzIGluc2lkZSB0aGUgdG9nZ2xlIGJ1dHRvbik7IGJvZHkgPVxyXG4vLyBldmVyeXRoaW5nIHNob3duIGJlbG93IHRoZSBoZWFkZXIuIG9wdHMuYWN0aW9ucyA9IGhlYWRlciBjb250cm9scyByZW5kZXJlZFxyXG4vLyBiZXNpZGUgdGhlIHRvZ2dsZTsgb3B0cy5kZWZhdWx0Q29sbGFwc2VkIHN0YXJ0cyBhIGNhcmQgY29sbGFwc2VkIHVudGlsIGZpcnN0XHJcbi8vIG9wZW5lZDsgb3B0cy5hdHRycyBhZGRzIGNhcmQgYXR0cmlidXRlcyAoaWQsIGRhdGEtKik7IG9wdHMuaGVhZGVyU3R5bGUgc2V0c1xyXG4vLyBhbiBpbmxpbmUgc3R5bGUgb24gdGhlIGhlYWRlciByb3cuXHJcbmV4cG9ydCBmdW5jdGlvbiBjb2xsYXBzaWJsZUNhcmQoa2V5LCB0aXRsZSwgYm9keSwgb3B0cyA9IHt9KSB7XHJcbiAgY29uc3QgeyBkZWZhdWx0Q29sbGFwc2VkID0gZmFsc2UsIGF0dHJzID0gJycsIGhlYWRlclN0eWxlID0gJycsIGFjdGlvbnMgPSAnJyB9ID0gb3B0cztcclxuICBjb25zdCBjb2xsYXBzZWQgPSBpc0NhcmRDb2xsYXBzZWQoa2V5LCBkZWZhdWx0Q29sbGFwc2VkKTtcclxuICBjb25zdCBzdHlsZUF0dHIgPSBoZWFkZXJTdHlsZSA/IGAgc3R5bGU9XCIke2hlYWRlclN0eWxlfVwiYCA6ICcnO1xyXG4gIGNvbnN0IGV4dHJhQXR0cnMgPSBhdHRycyA/IGAgJHthdHRyc31gIDogJyc7XHJcbiAgcmV0dXJuIGBcclxuICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZCBjb2xsYXBzaWJsZSR7Y29sbGFwc2VkID8gJyBjb2xsYXBzZWQnIDogJyd9XCIgZGF0YS1jb2xsYXBzZS1rZXk9XCIke2tleX1cIiR7ZXh0cmFBdHRyc30+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZC1oZWFkZXJcIiR7c3R5bGVBdHRyfT5cclxuICAgICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImNhcmQtdG9nZ2xlXCIgYXJpYS1leHBhbmRlZD1cIiR7Y29sbGFwc2VkID8gJ2ZhbHNlJyA6ICd0cnVlJ31cIj4ke3RpdGxlfTwvYnV0dG9uPlxyXG4gICAgICAgICR7YWN0aW9uc31cclxuICAgICAgPC9kaXY+XHJcbiAgICAgICR7Ym9keX1cclxuICAgIDwvZGl2PmA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF90b2dnbGVDb2xsYXBzaWJsZUNhcmQoY2FyZCwgdG9nZ2xlKSB7XHJcbiAgY29uc3QgY29sbGFwc2VkID0gY2FyZC5jbGFzc0xpc3QudG9nZ2xlKCdjb2xsYXBzZWQnKTtcclxuICB0b2dnbGUuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgY29sbGFwc2VkID8gJ2ZhbHNlJyA6ICd0cnVlJyk7XHJcbiAgY29uc3Qga2V5ID0gY2FyZC5kYXRhc2V0LmNvbGxhcHNlS2V5O1xyXG4gIGlmICgha2V5KSByZXR1cm47XHJcbiAgLy8gUGVyc2lzdCBiZXN0LWVmZm9ydDogYSB3cml0ZSBmYWlsdXJlIChwcml2YXRlIG1vZGUsIHF1b3RhKSBtdXN0IG5vdCBzd2FsbG93XHJcbiAgLy8gdGhlIHRvZ2dsZSBvciBibG9jayB0aGUgbGF6eS1sb2FkIGRpc3BhdGNoIGJlbG93LiBUaGUgcmVhZCBwYXRoXHJcbiAgLy8gKF9jYXJkQ29sbGFwc2VTdGF0ZSkgaXMgbGlrZXdpc2UgdG9sZXJhbnQuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHN0YXRlID0gX2NhcmRDb2xsYXBzZVN0YXRlKCk7XHJcbiAgICBzdGF0ZVtrZXldID0gY29sbGFwc2VkO1xyXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oX0NBUkRfQ09MTEFQU0VfS0VZLCBKU09OLnN0cmluZ2lmeShzdGF0ZSkpO1xyXG4gIH0gY2F0Y2ggKGVycikge1xyXG4gICAgY29uc29sZS53YXJuKCdDb3VsZCBub3QgcGVyc2lzdCBjYXJkIGNvbGxhcHNlIHN0YXRlOicsIGVycik7XHJcbiAgfVxyXG4gIC8vIExldHMgYSBjYXJkIGxhenktbG9hZCBpdHMgYm9keSB0aGUgZmlyc3QgdGltZSBpdCBpcyBleHBhbmRlZC5cclxuICBjYXJkLmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KCdjYXJkdG9nZ2xlJywgeyBidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsga2V5LCBjb2xsYXBzZWQgfSB9KSk7XHJcbn1cclxuXHJcbi8vIE9ubHkgdGhlIGNhcmQncyBvd24gdG9nZ2xlIGJ1dHRvbiBjb2xsYXBzZXMgaXQgKG5hdGl2ZSBFbnRlci9TcGFjZSBhY3RpdmF0ZSBpdFxyXG4vLyB0b28pLiBOZXN0ZWQgaGVhZGVycyBpbnNpZGUgYSBjb21wb3VuZCBjYXJkJ3MgYm9keSBjYXJyeSBubyAuY2FyZC10b2dnbGUsIHNvXHJcbi8vIHRoZXkgbmVpdGhlciB0b2dnbGUgbm9yIHNob3cgYSBjaGV2cm9uLlxyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgY29uc3QgdG9nZ2xlID0gZS50YXJnZXQuY2xvc2VzdCgnLmNhcmQtdG9nZ2xlJyk7XHJcbiAgaWYgKCF0b2dnbGUpIHJldHVybjtcclxuICBjb25zdCBjYXJkID0gdG9nZ2xlLmNsb3Nlc3QoJy5kZXRhaWwtY2FyZC5jb2xsYXBzaWJsZScpO1xyXG4gIGlmIChjYXJkKSBfdG9nZ2xlQ29sbGFwc2libGVDYXJkKGNhcmQsIHRvZ2dsZSk7XHJcbn0pO1xyXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgVUkgcHJpbWl0aXZlcyAoYWxlcnQgLyBjb25maXJtIC8gcHJvbXB0IG1vZGFscykgdXNlZCBhcHAtd2lkZS5cbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IGNvdmVyZWQgaW5kaXJlY3RseSBieSB0aGUgdGVzdF91aV8qLnB5IHN1aXRlc1xuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IGVzY0h0bWwgfSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5cbi8vIOKUgOKUgCBhbGVydCBtb2RhbCAoc2luZ2xlLWJ1dHRvbiwgbm8gY2FuY2VsKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWxlcnRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIHNob3dBbGVydCh0aXRsZSwgYm9keSkge1xuICBfYWxlcnRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtdGl0bGUnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtYm9keScpLmlubmVySFRNTCA9IGJvZHk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYWxlcnQtbW9kYWwgLmJ0bicpLmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUFsZXJ0TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2FsZXJ0T3BlbmVyO1xuICBfYWxlcnRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBjb25maXJtIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9jb25maXJtT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBzaG93Q29uZmlybSh0aXRsZSwgYm9keSwgb2tMYWJlbCwgb25PaywgZGFuZ2VyID0gZmFsc2UsIGNhbmNlbExhYmVsID0gJ0NhbmNlbCcpIHtcbiAgX2NvbmZpcm1PcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWJvZHknKS5pbm5lckhUTUwgPSBib2R5O1xuICBjb25zdCBvayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW9rLWJ0bicpO1xuICBvay50ZXh0Q29udGVudCA9IG9rTGFiZWw7XG4gIG9rLmNsYXNzTmFtZSA9IGRhbmdlciA/ICdidG4gZGFuZ2VyJyA6ICdidG4gcHJpbWFyeSc7XG4gIC8vIEV2ZXJ5IGNhbGwgc2V0cyBpdCwgc28gdGhlIGRlZmF1bHQgJ0NhbmNlbCcgaXMgcmVzdG9yZWQgZm9yIGNhbGxlcnMgdGhhdFxuICAvLyBkb24ndCBwYXNzIGEgY3VzdG9tIGxhYmVsIC0gbm8gc3RhbGUgbGFiZWwgbGVha3MgYmV0d2VlbiBjb25maXJtcy5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tY2FuY2VsLWJ0bicpLnRleHRDb250ZW50ID0gY2FuY2VsTGFiZWw7XG4gIEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjayA9IG9uT2s7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWNhbmNlbC1idG4nKS5mb2N1cygpLCA1MCk7XG59XG5mdW5jdGlvbiBfY29uZmlybU9rKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3QgY2IgPSBBcHBTdGF0ZS5jb25maXJtQ2FsbGJhY2s7XG4gIEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjayA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9jb25maXJtT3BlbmVyO1xuICBfY29uZmlybU9wZW5lciA9IG51bGw7XG4gIGlmIChjYikgY2IoKTtcbiAgZWxzZSBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5leHBvcnQgZnVuY3Rpb24gX2NvbmZpcm1DYW5jZWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBBcHBTdGF0ZS5jb25maXJtQ2FsbGJhY2sgPSBudWxsO1xuICBjb25zdCBvcGVuZXIgPSBfY29uZmlybU9wZW5lcjtcbiAgX2NvbmZpcm1PcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBhZGRpdGlvbmFsIGFjdGlvbnMgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2FjdGlvbnNNb2RhbE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkFjdGlvbnNNb2RhbCh0aXRsZSwgZ3JvdXBzKSB7XG4gIF9hY3Rpb25zTW9kYWxPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC1ib2R5Jyk7XG4gIGJvZHkuaW5uZXJIVE1MID0gJyc7XG4gIGdyb3Vwcy5mb3JFYWNoKChncm91cCwgaSkgPT4ge1xuICAgIGlmIChpID4gMCkge1xuICAgICAgY29uc3QgZGl2aWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgZGl2aWRlci5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWRpdmlkZXInO1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChkaXZpZGVyKTtcbiAgICB9XG4gICAgaWYgKGdyb3VwLmhlYWRpbmcpIHtcbiAgICAgIGNvbnN0IGhlYWRpbmcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIGhlYWRpbmcuY2xhc3NOYW1lID0gJ3NlY3Rpb24tdGl0bGUnO1xuICAgICAgaGVhZGluZy5zdHlsZS5jc3NUZXh0ID0gJ21hcmdpbjo4cHggMCAycHggNHB4JztcbiAgICAgIGhlYWRpbmcudGV4dENvbnRlbnQgPSBncm91cC5oZWFkaW5nO1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChoZWFkaW5nKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCByb3cgb2YgZ3JvdXAucm93cykge1xuICAgICAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgIGVsLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGVsLmNsYXNzTmFtZSA9ICdhY3Rpb24tcm93JyArIChyb3cuZGFuZ2VyID8gJyBkYW5nZXInIDogJycpO1xuICAgICAgZWwuZGlzYWJsZWQgPSAhIXJvdy5kaXNhYmxlZDtcbiAgICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgbGFiZWwuY2xhc3NOYW1lID0gJ2FjdGlvbi1yb3ctbGFiZWwnO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSByb3cubGFiZWw7XG4gICAgICBjb25zdCBkZXNjID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgZGVzYy5jbGFzc05hbWUgPSAnYWN0aW9uLXJvdy1kZXNjJztcbiAgICAgIGRlc2MudGV4dENvbnRlbnQgPSByb3cuZGVzY3JpcHRpb247XG4gICAgICBlbC5hcHBlbmQobGFiZWwsIGRlc2MpO1xuICAgICAgZWwub25jbGljayA9ICgpID0+IHsgY2xvc2VBY3Rpb25zTW9kYWwoKTsgcm93LmFjdGlvbigpOyB9O1xuICAgICAgYm9keS5hcHBlbmRDaGlsZChlbCk7XG4gICAgfVxuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGlvbnMtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gYm9keS5xdWVyeVNlbGVjdG9yKCcuYWN0aW9uLXJvdzpub3QoOmRpc2FibGVkKScpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VBY3Rpb25zTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfYWN0aW9uc01vZGFsT3BlbmVyO1xuICBfYWN0aW9uc01vZGFsT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgbW9kYWwgbGF5ZXJpbmcgKyBmb2N1cyB0cmFwIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQ29uZmlybSBhbmQgYWxlcnQgYXJlIHRoZSBvbmx5IG1vZGFscyB0aGF0IHN0YWNrIG9uIHRvcCBvZiBvdGhlciBtb2RhbHMsIHNvXG4vLyB0aGV5IHRha2UgcHJpb3JpdHk7IG90aGVyd2lzZSBhbGwgLm1vZGFsLWJnIHNoYXJlIHotaW5kZXggMjAwIGFuZCB0aGUgbGFzdFxuLy8gdmlzaWJsZSBvbmUgaW4gRE9NIG9yZGVyIGlzIHRoZSBvbmUgcGFpbnRlZCBvbiB0b3AuXG5leHBvcnQgZnVuY3Rpb24gdG9wbW9zdFZpc2libGVNb2RhbCgpIHtcbiAgZm9yIChjb25zdCBpZCBvZiBbJ2NvbmZpcm0tbW9kYWwnLCAnYWxlcnQtbW9kYWwnXSkge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuICAgIGlmIChlbC5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgcmV0dXJuIGVsO1xuICB9XG4gIGNvbnN0IHZpc2libGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcubW9kYWwtYmcudmlzaWJsZScpO1xuICByZXR1cm4gdmlzaWJsZS5sZW5ndGggPyB2aXNpYmxlW3Zpc2libGUubGVuZ3RoIC0gMV0gOiBudWxsO1xufVxuXG5jb25zdCBfRk9DVVNBQkxFX1NFTEVDVE9SID1cbiAgJ2FbaHJlZl0sIGJ1dHRvbjpub3QoOmRpc2FibGVkKSwgaW5wdXQ6bm90KDpkaXNhYmxlZCksIHNlbGVjdDpub3QoOmRpc2FibGVkKSwgJyArXG4gICd0ZXh0YXJlYTpub3QoOmRpc2FibGVkKSwgW3RhYmluZGV4XTpub3QoW3RhYmluZGV4PVwiLTFcIl0pJztcblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xuICBpZiAoZS5rZXkgIT09ICdUYWInKSByZXR1cm47XG4gIGNvbnN0IG1vZGFsID0gdG9wbW9zdFZpc2libGVNb2RhbCgpO1xuICBpZiAoIW1vZGFsKSByZXR1cm47XG4gIGNvbnN0IGZvY3VzYWJsZXMgPSBbLi4ubW9kYWwucXVlcnlTZWxlY3RvckFsbChfRk9DVVNBQkxFX1NFTEVDVE9SKV1cbiAgICAuZmlsdGVyKGVsID0+IGVsLmdldENsaWVudFJlY3RzKCkubGVuZ3RoID4gMCk7XG4gIGlmICghZm9jdXNhYmxlcy5sZW5ndGgpIHJldHVybjtcbiAgY29uc3QgZmlyc3QgPSBmb2N1c2FibGVzWzBdO1xuICBjb25zdCBsYXN0ICA9IGZvY3VzYWJsZXNbZm9jdXNhYmxlcy5sZW5ndGggLSAxXTtcbiAgaWYgKCFtb2RhbC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAoZS5zaGlmdEtleSA/IGxhc3QgOiBmaXJzdCkuZm9jdXMoKTtcbiAgfSBlbHNlIGlmICghZS5zaGlmdEtleSAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBsYXN0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGZpcnN0LmZvY3VzKCk7XG4gIH0gZWxzZSBpZiAoZS5zaGlmdEtleSAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBmaXJzdCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBsYXN0LmZvY3VzKCk7XG4gIH1cbn0pO1xuXG4vLyDilIDilIAgbWVudSBrZXlib2FyZCBwYXR0ZXJuIChoYW1idXJnZXIgKyBrZWJhYikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBfbWVudUZvY3VzYWJsZUl0ZW1zKG1lbnUpIHtcbiAgcmV0dXJuIFsuLi5tZW51LnF1ZXJ5U2VsZWN0b3JBbGwoJy5oYW1idXJnZXItaXRlbScpXVxuICAgIC5maWx0ZXIoZWwgPT4gIWVsLmRpc2FibGVkICYmIGVsLmdldENsaWVudFJlY3RzKCkubGVuZ3RoID4gMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfbWVudUFycm93S2V5ZG93bihtZW51LCBlKSB7XG4gIGlmIChlLmtleSAhPT0gJ0Fycm93RG93bicgJiYgZS5rZXkgIT09ICdBcnJvd1VwJykgcmV0dXJuO1xuICBjb25zdCBpdGVtcyA9IF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSk7XG4gIGlmICghaXRlbXMubGVuZ3RoKSByZXR1cm47XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgY29uc3QgaWR4ICA9IGl0ZW1zLmluZGV4T2YoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7XG4gIGNvbnN0IHN0ZXAgPSBlLmtleSA9PT0gJ0Fycm93RG93bicgPyAxIDogLTE7XG4gIGl0ZW1zWyhpZHggKyBzdGVwICsgaXRlbXMubGVuZ3RoKSAlIGl0ZW1zLmxlbmd0aF0uZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGhhbWJ1cmdlciBtZW51IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZXhwb3J0IGZ1bmN0aW9uIGlzSGFtYnVyZ2VyT3BlbigpIHtcbiAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpLmNsYXNzTGlzdC5jb250YWlucygnb3BlbicpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRvZ2dsZUhhbWJ1cmdlcigpIHtcbiAgY29uc3QgbWVudSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpO1xuICBtZW51LmNsYXNzTGlzdC50b2dnbGUoJ29wZW4nKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1oYW1idXJnZXInKS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBtZW51LmNsYXNzTGlzdC5jb250YWlucygnb3BlbicpKTtcbiAgaWYgKG1lbnUuY2xhc3NMaXN0LmNvbnRhaW5zKCdvcGVuJykpIF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSlbMF0/LmZvY3VzKCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VIYW1idXJnZXIocmVmb2N1c1RyaWdnZXIgPSBmYWxzZSkge1xuICBjb25zdCBtZW51ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51Jyk7XG4gIC8vIEZvY3VzIHNpdHRpbmcgb24gYW4gaXRlbSBhYm91dCB0byBiZSBkaXNwbGF5Om5vbmUnZCB3b3VsZCBzaWxlbnRseSBmYWxsIHRvXG4gIC8vIDxib2R5PjsgaGFuZCBpdCB0byB0aGUgdHJpZ2dlciBmaXJzdCBzbyBpdCBoYXMgc29tZXdoZXJlIHJlYWwgdG8gZ28uXG4gIGlmIChyZWZvY3VzVHJpZ2dlciB8fCBtZW51LmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1oYW1idXJnZXInKS5mb2N1cygpO1xuICB9XG4gIG1lbnUuY2xhc3NMaXN0LnJlbW92ZSgnb3BlbicpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xufVxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51JykuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xuICBfbWVudUFycm93S2V5ZG93bihkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKSwgZSk7XG59KTtcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XG4gIGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci13cmFwJykuY29udGFpbnMoZS50YXJnZXQpKSB7XG4gICAgY2xvc2VIYW1idXJnZXIoKTtcbiAgfVxufSk7XG5cbi8vIOKUgOKUgCBjb250cm9scyBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfY29udHJvbHNPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5Db250cm9sc01vZGFsKCkge1xuICBfY29udHJvbHNPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbHMtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NvbnRyb2xzLW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQ29udHJvbHNNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRyb2xzLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfY29udHJvbHNPcGVuZXI7XG4gIF9jb250cm9sc09wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGRpZmYgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBfZGlmZlN0YXRlOiB7dGl0bGUsIGZpZWxkczpbe2xhYmVsLGN1cnJlbnQscHJvcG9zZWR9XSwgb25Db21taXQoYWN0aW9uLCBlZGl0ZWRWYWx1ZXMpfVxubGV0IF9kaWZmU3RhdGUgPSBudWxsO1xubGV0IF9kaWZmT3BlbmVyID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5EaWZmTW9kYWwodGl0bGUsIGZpZWxkcywgb25Db21taXQsIG9wdHMgPSB7fSkge1xuICBfZGlmZk9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIF9kaWZmU3RhdGUgPSB7dGl0bGUsIGZpZWxkcywgb25Db21taXR9O1xuICBjb25zdCByZXZlcnQgPSBvcHRzLnJldmVydE1vZGUgfHwgZmFsc2U7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZmllbGRzJyk7XG4gIGNvbnRhaW5lci5pbm5lckhUTUwgPSBmaWVsZHMubWFwKChmLCBpKSA9PiBgXG4gICAgPGRpdiBjbGFzcz1cImRpZmYtZmllbGQtZ3JvdXBcIj5cbiAgICAgICR7ZmllbGRzLmxlbmd0aCA+IDEgPyBgPGRpdiBjbGFzcz1cImRpZmYtZmllbGQtdGl0bGVcIj4ke2VzY0h0bWwoZi5sYWJlbCl9PC9kaXY+YCA6ICcnfVxuICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWxzXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWwtbGFiZWxcIj4ke3JldmVydCA/ICdZb3VyIEVkaXQnIDogJ0N1cnJlbnQnfTwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLWN1cnJlbnQke2YuY3VycmVudCA/ICcnIDogJyBlbXB0eSd9XCI+JHtcbiAgICAgICAgICAgIGYuY3VycmVudCA/IGVzY0h0bWwoZi5jdXJyZW50KSA6ICcobm9uZSB5ZXQpJ1xuICAgICAgICAgIH08L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJkaWZmLXBhbmVsXCI+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWwtbGFiZWxcIj4ke3JldmVydCA/ICdPcmlnaW5hbCAoTExNKScgOiAnTmV3IC0gZWRpdCBoZXJlLCB0aGVuIGNob29zZSBiZWxvdyd9PC9kaXY+XG4gICAgICAgICAgJHtyZXZlcnRcbiAgICAgICAgICAgID8gYDxkaXYgY2xhc3M9XCJkaWZmLWN1cnJlbnQke2YucHJvcG9zZWQgPyAnJyA6ICcgZW1wdHknfVwiPiR7Zi5wcm9wb3NlZCA/IGVzY0h0bWwoZi5wcm9wb3NlZCkgOiAnKG5vbmUpJ308L2Rpdj5gXG4gICAgICAgICAgICA6IGA8dGV4dGFyZWEgY2xhc3M9XCJkaWZmLW5ld1wiIGlkPVwiZGlmZi1uZXctJHtpfVwiIHJvd3M9XCI0XCI+JHtlc2NIdG1sKGYucHJvcG9zZWQgfHwgJycpfTwvdGV4dGFyZWE+YFxuICAgICAgICAgIH1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gKS5qb2luKCcnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZGlzY2FyZC1idG4nKS50ZXh0Q29udGVudCAgID0gcmV2ZXJ0ID8gJ0tlZXAgTXkgRWRpdCcgOiAnRGlzY2FyZCc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1lZGl0LWJ0bicpLnN0eWxlLmRpc3BsYXkgPSByZXZlcnQgPyAnbm9uZScgOiAnJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtYWNjZXB0LW5ldy1idG4nKS50ZXh0Q29udGVudCA9IHJldmVydCA/ICdSZXZlcnQgdG8gT3JpZ2luYWwnIDogJ0FjY2VwdCBhcy1pcyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBjb25zdCBmaXJzdFRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbmV3LTAnKTtcbiAgICBpZiAoZmlyc3RUYSkgZmlyc3RUYS5mb2N1cygpO1xuICAgIGVsc2UgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZGlzY2FyZC1idG4nKT8uZm9jdXMoKTtcbiAgfSwgNTApO1xufVxuXG5mdW5jdGlvbiBfZGlmZkdldEVkaXRlZCgpIHtcbiAgcmV0dXJuIChfZGlmZlN0YXRlPy5maWVsZHMgfHwgW10pLm1hcCgoXywgaSkgPT4ge1xuICAgIGNvbnN0IHRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGRpZmYtbmV3LSR7aX1gKTtcbiAgICByZXR1cm4gdGEgPyB0YS52YWx1ZSA6ICcnO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gX2RpZmZDbG9zZURvbmUoKSB7XG4gIGNvbnN0IG9wZW5lciA9IF9kaWZmT3BlbmVyO1xuICBfZGlmZk9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuZnVuY3Rpb24gX2RpZmZBY2NlcHROZXcoKSB7XG4gIGNvbnN0IGVkaXRlZCA9IF9kaWZmR2V0RWRpdGVkKCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBjYiA9IF9kaWZmU3RhdGU/Lm9uQ29tbWl0O1xuICBfZGlmZlN0YXRlID0gbnVsbDtcbiAgX2RpZmZPcGVuZXIgPSBudWxsO1xuICBpZiAoY2IpIGNiKCdhY2NlcHRfbmV3JywgZWRpdGVkKTtcbn1cblxuZnVuY3Rpb24gX2RpZmZBY2NlcHRFZGl0KCkge1xuICBjb25zdCBlZGl0ZWQgPSBfZGlmZkdldEVkaXRlZCgpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3QgY2IgPSBfZGlmZlN0YXRlPy5vbkNvbW1pdDtcbiAgX2RpZmZTdGF0ZSA9IG51bGw7XG4gIF9kaWZmT3BlbmVyID0gbnVsbDtcbiAgaWYgKGNiKSBjYignYWNjZXB0X2VkaXQnLCBlZGl0ZWQpO1xufVxuXG5mdW5jdGlvbiBfZGlmZkRpcnR5KCkge1xuICByZXR1cm4gKF9kaWZmU3RhdGU/LmZpZWxkcyB8fCBbXSkuc29tZSgoZiwgaSkgPT4ge1xuICAgIGNvbnN0IHRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGRpZmYtbmV3LSR7aX1gKTtcbiAgICByZXR1cm4gdGEgJiYgdGEudmFsdWUgIT09IChmLnByb3Bvc2VkIHx8ICcnKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZGlmZkRpc2NhcmQoKSB7XG4gIGlmICghZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgcmV0dXJuO1xuICBpZiAoX2RpZmZEaXJ0eSgpKSB7XG4gICAgc2hvd0NvbmZpcm0oXG4gICAgICAnRGlzY2FyZCBlZGl0PycsXG4gICAgICAnWW91IGhhdmUgdW5zYXZlZCBjaGFuZ2VzLiBDbG9zZSB3aXRob3V0IHNhdmluZz8nLFxuICAgICAgJ0Rpc2NhcmQnLFxuICAgICAgX2RvRGlmZkRpc2NhcmQsXG4gICAgICB0cnVlLFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9kb0RpZmZEaXNjYXJkKCk7XG59XG5cbmZ1bmN0aW9uIF9kb0RpZmZEaXNjYXJkKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgX2RpZmZTdGF0ZSA9IG51bGw7XG4gIF9kaWZmQ2xvc2VEb25lKCk7XG59XG5cbi8vIOKUgOKUgCBmaWVsZCBlZGl0IG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9maWVsZEVkaXRDYWxsYmFjayA9IG51bGw7XG5sZXQgX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWUgPSAnJztcbmxldCBfZmllbGRFZGl0T3BlbmVyID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5GaWVsZEVkaXRNb2RhbCh0aXRsZSwgY3VycmVudFZhbHVlLCBvblNhdmUpIHtcbiAgX2ZpZWxkRWRpdE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIF9maWVsZEVkaXRPcmlnaW5hbFZhbHVlID0gY3VycmVudFZhbHVlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZSA9IGN1cnJlbnRWYWx1ZTtcbiAgX2ZpZWxkRWRpdENhbGxiYWNrID0gb25TYXZlO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykuZm9jdXMoKSwgNTApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xvc2VGaWVsZEVkaXRNb2RhbCgpIHtcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC1tb2RhbCcpLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpKSByZXR1cm47XG4gIGNvbnN0IGN1cnJlbnRWYWx1ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZTtcbiAgaWYgKGN1cnJlbnRWYWx1ZSAhPT0gX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWUpIHtcbiAgICBzaG93Q29uZmlybShcbiAgICAgICdEaXNjYXJkIGVkaXQ/JyxcbiAgICAgICdZb3UgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuIENsb3NlIHdpdGhvdXQgc2F2aW5nPycsXG4gICAgICAnRGlzY2FyZCcsXG4gICAgICBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsLFxuICAgICAgdHJ1ZSxcbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuICBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsKCk7XG59XG5cbmZ1bmN0aW9uIF9kb0Nsb3NlRmllbGRFZGl0TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBfZmllbGRFZGl0Q2FsbGJhY2sgPSBudWxsO1xuICBjb25zdCBvcGVuZXIgPSBfZmllbGRFZGl0T3BlbmVyO1xuICBfZmllbGRFZGl0T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBfZmllbGRFZGl0U2F2ZSgpIHtcbiAgY29uc3QgdmFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLnZhbHVlO1xuICBjb25zdCBjYiA9IF9maWVsZEVkaXRDYWxsYmFjaztcbiAgX2RvQ2xvc2VGaWVsZEVkaXRNb2RhbCgpO1xuICBpZiAoY2IpIGNiKHZhbCk7XG59XG5cbi8vIFJlZnJlc2gvY2xvc2Ugd2l0aCBhIGRpcnR5IGVkaXRvciBvcGVuIHdvdWxkIHNpbGVudGx5IGxvc2UgdGhlIGVkaXQgLSB0aGVcbi8vIHNhbWUgcHJvdGVjdGlvbiBjbG9zZUZpZWxkRWRpdE1vZGFsL19kaWZmRGlzY2FyZCBnaXZlIEVzY2FwZSBhbmQgRGlzY2FyZC5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBlID0+IHtcbiAgY29uc3QgZmllbGRFZGl0RGlydHkgPVxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykgJiZcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykudmFsdWUgIT09IF9maWVsZEVkaXRPcmlnaW5hbFZhbHVlO1xuICBjb25zdCBkaWZmRGlydHkgPVxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykgJiYgX2RpZmZEaXJ0eSgpO1xuICBpZiAoZmllbGRFZGl0RGlydHkgfHwgZGlmZkRpcnR5KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUucmV0dXJuVmFsdWUgPSAnJztcbiAgfVxufSk7XG5cbi8vIOKUgOKUgCBrZWJhYiBtZW51cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWN0aXZlS2ViYWIgPSBudWxsO1xubGV0IF9hY3RpdmVLZWJhYkFuY2hvciA9IG51bGw7XG5sZXQgX2tlYmFiRGlzbWlzcyA9IG51bGw7XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUtlYmFiKHJlZm9jdXNBbmNob3IgPSBmYWxzZSkge1xuICBpZiAoIV9hY3RpdmVLZWJhYikgcmV0dXJuIGZhbHNlO1xuICBfYWN0aXZlS2ViYWIucmVtb3ZlKCk7XG4gIF9hY3RpdmVLZWJhYiA9IG51bGw7XG4gIGlmIChfa2ViYWJEaXNtaXNzKSB7IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgX2tlYmFiRGlzbWlzcyk7IF9rZWJhYkRpc21pc3MgPSBudWxsOyB9XG4gIGNvbnN0IGFuY2hvciA9IF9hY3RpdmVLZWJhYkFuY2hvcjtcbiAgX2FjdGl2ZUtlYmFiQW5jaG9yID0gbnVsbDtcbiAgaWYgKGFuY2hvcj8uaGFzQXR0cmlidXRlPy4oJ2FyaWEtaGFzcG9wdXAnKSkgYW5jaG9yLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xuICBpZiAocmVmb2N1c0FuY2hvciAmJiBhbmNob3I/LmZvY3VzKSBhbmNob3IuZm9jdXMoKTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93S2ViYWIoYW5jaG9yRWwsIGl0ZW1zKSB7XG4gIGNsb3NlS2ViYWIoKTtcbiAgY29uc3QgbWVudSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBtZW51LmNsYXNzTmFtZSA9ICdoYW1idXJnZXItbWVudSBvcGVuJztcbiAgLy8gcmlnaHQ6YXV0byBjbGVhcnMgdGhlIC5oYW1idXJnZXItbWVudSBiYXNlIHJ1bGUncyByaWdodDowIC0gb3RoZXJ3aXNlIHRoZVxuICAvLyBmaXhlZCBtZW51LCB3aXRoIGJvdGggbGVmdCBhbmQgcmlnaHQgc2V0LCBzdHJldGNoZXMgdG8gdGhlIHZpZXdwb3J0IGVkZ2UuXG4gIG1lbnUuc3R5bGUuY3NzVGV4dCA9ICdwb3NpdGlvbjpmaXhlZDt6LWluZGV4OjUwMDttaW4td2lkdGg6MTYwcHg7cmlnaHQ6YXV0byc7XG4gIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgIGlmIChpdGVtID09PSBudWxsKSB7XG4gICAgICBjb25zdCBzZXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHNlcC5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWRpdmlkZXInO1xuICAgICAgbWVudS5hcHBlbmRDaGlsZChzZXApO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IGJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIGJ0bi5jbGFzc05hbWUgPSAnaGFtYnVyZ2VyLWl0ZW0nO1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IGl0ZW0ubGFiZWw7XG4gICAgaWYgKGl0ZW0uZGlzYWJsZWQpIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gICAgLy8gUmVmb2N1cyB0aGUgYW5jaG9yIGJlZm9yZSB0aGUgYWN0aW9uIHJ1bnMgc28gYW55dGhpbmcgdGhlIGFjdGlvbiBvcGVuc1xuICAgIC8vIHJlY29yZHMgdGhlIGFuY2hvciAtIG5vdCBhIHJlbW92ZWQgbWVudSBpdGVtIC0gYXMgaXRzIHJldHVybi1mb2N1cyB0YXJnZXQuXG4gICAgYnRuLm9uY2xpY2sgPSAoKSA9PiB7IGNsb3NlS2ViYWIodHJ1ZSk7IGl0ZW0uYWN0aW9uKCk7IH07XG4gICAgbWVudS5hcHBlbmRDaGlsZChidG4pO1xuICB9XG4gIG1lbnUuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4gX21lbnVBcnJvd0tleWRvd24obWVudSwgZSkpO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICBfYWN0aXZlS2ViYWIgPSBtZW51O1xuICBfYWN0aXZlS2ViYWJBbmNob3IgPSBhbmNob3JFbDtcbiAgaWYgKGFuY2hvckVsPy5oYXNBdHRyaWJ1dGU/LignYXJpYS1oYXNwb3B1cCcpKSBhbmNob3JFbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xuXG4gIGNvbnN0IHJlY3QgPSBhbmNob3JFbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgbGV0IHRvcCAgPSByZWN0LmJvdHRvbSArIDQ7XG4gIGxldCBsZWZ0ID0gcmVjdC5yaWdodCAtIG1lbnUub2Zmc2V0V2lkdGg7XG4gIGlmIChsZWZ0IDwgNCkgbGVmdCA9IHJlY3QubGVmdDtcbiAgY29uc3QgbWVudUggPSBtZW51Lm9mZnNldEhlaWdodDtcbiAgaWYgKHRvcCArIG1lbnVIID4gd2luZG93LmlubmVySGVpZ2h0KSB0b3AgPSByZWN0LnRvcCAtIG1lbnVIO1xuICBtZW51LnN0eWxlLnRvcCAgPSB0b3AgICsgJ3B4JztcbiAgbWVudS5zdHlsZS5sZWZ0ID0gbGVmdCArICdweCc7XG5cbiAgX21lbnVGb2N1c2FibGVJdGVtcyhtZW51KVswXT8uZm9jdXMoKTtcblxuICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoX2FjdGl2ZUtlYmFiICE9PSBtZW51KSByZXR1cm47ICAvLyBhbHJlYWR5IGNsb3NlZCAoZS5nLiBpbW1lZGlhdGUgRXNjYXBlKVxuICAgIGNvbnN0IGRpc21pc3MgPSBlID0+IHtcbiAgICAgIGlmIChtZW51LmNvbnRhaW5zKGUudGFyZ2V0KSkgcmV0dXJuO1xuICAgICAgY2xvc2VLZWJhYigpO1xuICAgIH07XG4gICAgX2tlYmFiRGlzbWlzcyA9IGRpc21pc3M7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBkaXNtaXNzKTtcbiAgfSwgMCk7XG59XG5cbi8vIOKUgOKUgCBwYW5lIHJlc2l6ZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmNvbnN0IF9QQU5FX0tFWSA9ICd5dXVjbGlwLXBhbmUtc2l6ZXMnO1xuXG5mdW5jdGlvbiBfbG9hZFBhbmVTaXplcygpIHtcbiAgdHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oX1BBTkVfS0VZKSB8fCAne30nKTsgfSBjYXRjaCB7IHJldHVybiB7fTsgfVxufVxuXG5mdW5jdGlvbiBfc2F2ZVBhbmVTaXplKGtleSwgdmFsKSB7XG4gIGNvbnN0IHMgPSBfbG9hZFBhbmVTaXplcygpO1xuICBzW2tleV0gPSB2YWw7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKF9QQU5FX0tFWSwgSlNPTi5zdHJpbmdpZnkocykpO1xufVxuXG5mdW5jdGlvbiBfbWFrZURyYWdIYW5kbGUoaWQsIG9uU3RhcnQpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgZSA9PiB7XG4gICAgaWYgKGUuYnV0dG9uICE9PSAwKSByZXR1cm47XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGVsLmNsYXNzTGlzdC5hZGQoJ2RyYWdnaW5nJyk7XG4gICAgY29uc3Qgb25Nb3ZlID0gb25TdGFydChlKTtcbiAgICBjb25zdCBvblVwID0gKCkgPT4ge1xuICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZ2dpbmcnKTtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW92ZSk7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgb25VcCk7XG4gICAgfTtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBvbk1vdmUpO1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvblVwKTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0UmVzaXplKCkge1xuICBjb25zdCByb290ICAgID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuICBjb25zdCBzaXplcyAgID0gX2xvYWRQYW5lU2l6ZXMoKTtcblxuICBpZiAoc2l6ZXMuc2lkZWJhcldpZHRoKSAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tc2lkZWJhci13aWR0aCcsICAgICAgIHNpemVzLnNpZGViYXJXaWR0aCArICdweCcpO1xuICBpZiAoc2l6ZXMudmlkZW9zSGVpZ2h0KSAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tdmlkZW9zLWdyb3VwLWhlaWdodCcsIHNpemVzLnZpZGVvc0hlaWdodCArICdweCcpO1xuICBpZiAoc2l6ZXMucGxheWVyTWF4SCkgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tcGxheWVyLW1heC1oZWlnaHQnLCAgIHNpemVzLnBsYXllck1heEggKyAncHgnKTtcbiAgaWYgKHNpemVzLmxvZ01heEgpICAgICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLWxvZy1tYXgtaGVpZ2h0JywgICAgICAgc2l6ZXMubG9nTWF4SCArICdweCcpO1xuXG4gIF9tYWtlRHJhZ0hhbmRsZSgnc2lkZWJhci1yZXNpemUtaGFuZGxlJywgc3RhcnRFID0+IHtcbiAgICBjb25zdCBzdGFydFggID0gc3RhcnRFLmNsaWVudFg7XG4gICAgY29uc3Qgc2lkZWJhciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaWRlYmFyJyk7XG4gICAgY29uc3Qgc3RhcnRXICA9IHNpZGViYXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGg7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IHcgPSBNYXRoLm1heCgxNjAsIE1hdGgubWluKDQ4MCwgc3RhcnRXICsgbW92ZUUuY2xpZW50WCAtIHN0YXJ0WCkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1zaWRlYmFyLXdpZHRoJywgdyArICdweCcpO1xuICAgICAgX3NhdmVQYW5lU2l6ZSgnc2lkZWJhcldpZHRoJywgdyk7XG4gICAgfTtcbiAgfSk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCd2aWRlb3MtY2xpcHMtcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRZICA9IHN0YXJ0RS5jbGllbnRZO1xuICAgIGNvbnN0IHZnICAgICAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2lkZWJhci1ncm91cC52aWRlb3MtZ3JvdXAnKTtcbiAgICBjb25zdCBzaWRlYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNpZGViYXInKTtcbiAgICBjb25zdCBzdGFydEggID0gdmcuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgIHJldHVybiBtb3ZlRSA9PiB7XG4gICAgICBjb25zdCBtYXhIID0gc2lkZWJhci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgLSAxMjA7XG4gICAgICBjb25zdCBoID0gTWF0aC5tYXgoNDAsIE1hdGgubWluKG1heEgsIHN0YXJ0SCArIG1vdmVFLmNsaWVudFkgLSBzdGFydFkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tdmlkZW9zLWdyb3VwLWhlaWdodCcsIGggKyAncHgnKTtcbiAgICAgIF9zYXZlUGFuZVNpemUoJ3ZpZGVvc0hlaWdodCcsIGgpO1xuICAgIH07XG4gIH0pO1xuXG4gIF9tYWtlRHJhZ0hhbmRsZSgncGxheWVyLXJlc2l6ZS1oYW5kbGUnLCBzdGFydEUgPT4ge1xuICAgIGNvbnN0IHN0YXJ0WSA9IHN0YXJ0RS5jbGllbnRZO1xuICAgIGNvbnN0IHBhICAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXItYXJlYScpO1xuICAgIGNvbnN0IG1haW4gICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tYWluJyk7XG4gICAgY29uc3Qgc3RhcnRIID0gcGEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0O1xuICAgIHJldHVybiBtb3ZlRSA9PiB7XG4gICAgICBjb25zdCBtYXhIID0gbWFpbi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgLSAxMDA7XG4gICAgICBjb25zdCBoID0gTWF0aC5tYXgoODAsIE1hdGgubWluKG1heEgsIHN0YXJ0SCArIG1vdmVFLmNsaWVudFkgLSBzdGFydFkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tcGxheWVyLW1heC1oZWlnaHQnLCBoICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCdwbGF5ZXJNYXhIJywgaCk7XG4gICAgfTtcbiAgfSk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCdsb2ctcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRZID0gc3RhcnRFLmNsaWVudFk7XG4gICAgY29uc3QgbGIgICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1ib2R5Jyk7XG4gICAgY29uc3Qgc3RhcnRIID0gbGIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuaGVpZ2h0IHx8IDA7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IGggPSBNYXRoLm1heCg0MCwgTWF0aC5taW4oNjAwLCBzdGFydEggLSAobW92ZUUuY2xpZW50WSAtIHN0YXJ0WSkpKTtcbiAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tbG9nLW1heC1oZWlnaHQnLCBoICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCdsb2dNYXhIJywgaCk7XG4gICAgfTtcbiAgfSk7XG59XG5cbi8vIOKUgOKUgCBwcmVyZXEgd2FybmluZ3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5leHBvcnQgZnVuY3Rpb24gX2FwcGx5UHJlcmVxV2FybmluZ3MocHJlcmVxcykge1xuICBjb25zdCBpbkVsZWN0cm9uID0gISF3aW5kb3cuZWxlY3Ryb25BUEk7XG4gIGNvbnN0IHdpemFyZExpbmsgPSBpbkVsZWN0cm9uXG4gICAgPyAnIDxhIGhyZWY9XCIjXCIgb25jbGljaz1cIndpbmRvdy5lbGVjdHJvbkFQSS5ydW5TZXR1cFdpemFyZCgpO3JldHVybiBmYWxzZVwiIHN0eWxlPVwiY29sb3I6dmFyKC0td2FybmluZylcIj5SZS1ydW4gU2V0dXAgV2l6YXJkPC9hPidcbiAgICA6ICcnO1xuXG4gIGNvbnN0IGJhbm5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcmVyZXEtYmFubmVyJyk7XG4gIGlmICghYmFubmVyKSByZXR1cm47XG5cbiAgaWYgKCFwcmVyZXFzLmZmbXBlZ19vaykge1xuICAgIGJhbm5lci5pbm5lckhUTUwgPSBgPHNwYW4+4pqgIEZGbXBlZyBub3QgZm91bmQgLSBhbmFseXNpcyBhbmQgZXhwb3J0IHdpbGwgZmFpbC4ke3dpemFyZExpbmt9PC9zcGFuPmA7XG4gICAgYmFubmVyLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXN0YXJ0LWFuYWx5emUnKTtcbiAgICBpZiAoYnRuKSB7XG4gICAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgYnRuLnRpdGxlID0gJ0ZGbXBlZyBub3QgZm91bmQgLSBSZS1ydW4gU2V0dXAgV2l6YXJkIHRvIGluc3RhbGwgaXQnO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFwcmVyZXFzLmxsbV9vayAmJiBpbkVsZWN0cm9uKSB7XG4gICAgYmFubmVyLmlubmVySFRNTCA9IGA8c3Bhbj7ihLkgTExNIHNjb3JpbmcgaXMgbm90IGNvbmZpZ3VyZWQgLSBjbGlwcyB3aWxsIGJlIHNjb3JlZCBieSBlbmVyZ3kgYW5kIHNjZW5lcyBvbmx5LiR7d2l6YXJkTGlua308L3NwYW4+YDtcbiAgICBiYW5uZXIuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBQcmVyZXF1aXNpdGVzIHNhdGlzZmllZCAtIGNsZWFyIGFueSBiYW5uZXIgc2hvd24gYnkgYW4gZWFybGllciBzdGF0ZS4gV2l0aG91dFxuICAvLyB0aGlzLCBhIHJlLWNoZWNrIGFmdGVyIHRoZSBtb2RlbCBpcyBzZXQgdXAgKHJlZnJlc2hTZXJ2ZXJTdGF0ZSkgY291bGQgbmV2ZXJcbiAgLy8gaGlkZSBhIHN0YWxlIHdhcm5pbmcuXG4gIGJhbm5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBiYW5uZXIuaW5uZXJIVE1MID0gJyc7XG59XG5cbi8vIOKUgOKUgCB1bmRvIHRvYXN0IChhdXRvLWRpc21pc3MsIHNpbmdsZSBVbmRvIGJ1dHRvbikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBBIHRyYW5zaWVudCB0b2FzdCBjYXJyeWluZyBhbiBVbmRvIGFjdGlvbiwgdXNlZCBieSByZXZlcnNpYmxlIGNsaXAgb3BlcmF0aW9uc1xuLy8gKHNpbmdsZS9idWxrIHN0YXR1cyBjaGFuZ2VzKS4gVGhlIHNocmlua2luZyBiYXIgbWFrZXMgdGhlIH41cyB3aW5kb3cgdmlzaWJsZVxuLy8gc28gdGhlIHVuZG8gYWZmb3JkYW5jZSBkb2VzIG5vdCBleHBpcmUgc2lsZW50bHkuIEdlbmVyaWMgVUksIHNvIGl0IGxpdmVzIGhlcmVcbi8vIHJhdGhlciB0aGFuIGluIGEgZmVhdHVyZSBtb2R1bGUuXG5jb25zdCBVTkRPX1RPQVNUX01TID0gNTAwMDtcblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dVbmRvVG9hc3QobWVzc2FnZSwgdW5kb0ZuKSB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b2FzdC1jb250YWluZXInKTtcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gJ3RvYXN0IGluZm8gdW5kby10b2FzdCc7XG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICByb3cuY2xhc3NOYW1lID0gJ3VuZG8tdG9hc3Qtcm93JztcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gIGJ0bi5jbGFzc05hbWUgPSAndW5kby10b2FzdC1idG4nO1xuICBidG4udGV4dENvbnRlbnQgPSAnVW5kbyc7XG4gIGJ0bi5vbmNsaWNrID0gKCkgPT4geyB0b2FzdC5yZW1vdmUoKTsgdW5kb0ZuKCk7IH07XG4gIHJvdy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShtZXNzYWdlKSk7XG4gIHJvdy5hcHBlbmRDaGlsZChidG4pO1xuICBjb25zdCBiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgYmFyLmNsYXNzTmFtZSA9ICd1bmRvLXRvYXN0LWJhcic7XG4gIGJhci5zdHlsZS5hbmltYXRpb25EdXJhdGlvbiA9IFVORE9fVE9BU1RfTVMgKyAnbXMnO1xuICB0b2FzdC5hcHBlbmRDaGlsZChyb3cpO1xuICB0b2FzdC5hcHBlbmRDaGlsZChiYXIpO1xuICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QpO1xuICBzZXRUaW1lb3V0KCgpID0+IHRvYXN0LnJlbW92ZSgpLCBVTkRPX1RPQVNUX01TKTtcbn1cblxuLy8gR2xvYmFsIHBsYXliYWNrLXNwZWVkIHByZWZlcmVuY2UgLSBvbmUgY2FwdHVyZS1waGFzZSBsaXN0ZW5lciBhcHBsaWVzIHRoZSBzYXZlZFxuLy8gcmF0ZSB0byBldmVyeSA8dmlkZW8+IGFzIGl0IGxvYWRzLCBzbyBhbGwgcGxheWVycyAoY2xpcCBwcmV2aWV3LCByZWNvcmRpbmcsXG4vLyBzcGxpdC9leHBvcnQgZWRpdG9ycywgcmVlbHMpIGhvbm9yIGl0IHdpdGhvdXQgcGVyLXBsYXllciB3aXJpbmcuIENsaWVudC1vbmx5LFxuLy8gc3RvcmVkIGluIGxvY2FsU3RvcmFnZSBsaWtlIHRoZSBvdGhlciBwbGF5YmFjayBwcmVmcy5cbmV4cG9ydCBmdW5jdGlvbiBwbGF5YmFja1JhdGVQcmVmKCkge1xuICBjb25zdCByYXRlID0gcGFyc2VGbG9hdChsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgneXV1Y2xpcC1wbGF5YmFjay1yYXRlJykpO1xuICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKHJhdGUpICYmIHJhdGUgPiAwID8gcmF0ZSA6IDE7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBsYXliYWNrUmF0ZShyYXRlKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ZpZGVvJykuZm9yRWFjaCh2aWRlbyA9PiB7IHZpZGVvLnBsYXliYWNrUmF0ZSA9IHJhdGU7IH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5pdFBsYXliYWNrUmF0ZSgpIHtcbiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBlID0+IHtcbiAgICBpZiAoZS50YXJnZXQgJiYgZS50YXJnZXQudGFnTmFtZSA9PT0gJ1ZJREVPJykgZS50YXJnZXQucGxheWJhY2tSYXRlID0gcGxheWJhY2tSYXRlUHJlZigpO1xuICB9LCB0cnVlKTtcbn1cblxuLy8g4pSA4pSAIHN0YXRpYyBtb2RhbC9oYW1idXJnZXIgd2lyaW5nIChyZXBsYWNlcyB0aGUgaW5saW5lIG9uY2xpY2s9IHRoaXMgbW9kdWxlIHVzZWRcbi8vIHRvIG93biBpbiBpbmRleC5odG1sKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZXNlIGFyZSBmaXhlZCwgbmV2ZXItcmVjcmVhdGVkIGVsZW1lbnRzIGluIGluZGV4Lmh0bWwsIHNvIHdpcmluZyB0aGVtIG9uY2UgYXRcbi8vIG1vZHVsZSBsb2FkIChiZWxvdykgY2FuJ3QgZG91YmxlLWZpcmUgb24gYSByZS1yZW5kZXIgdGhlIHdheSBhIGR5bmFtaWNhbGx5XG4vLyByZW5kZXJlZCBsaXN0IGNvdWxkLlxuY29uc3QgX0JHX0RJU01JU1NfTU9EQUxTID0gW1xuICBbJ2FsZXJ0LW1vZGFsJywgY2xvc2VBbGVydE1vZGFsXSxcbiAgWydjb25maXJtLW1vZGFsJywgX2NvbmZpcm1DYW5jZWxdLFxuICBbJ2FjdGlvbnMtbW9kYWwnLCBjbG9zZUFjdGlvbnNNb2RhbF0sXG4gIFsnY29udHJvbHMtbW9kYWwnLCBjbG9zZUNvbnRyb2xzTW9kYWxdLFxuICBbJ2RpZmYtbW9kYWwnLCBfZGlmZkRpc2NhcmRdLFxuICBbJ2ZpZWxkLWVkaXQtbW9kYWwnLCBjbG9zZUZpZWxkRWRpdE1vZGFsXSxcbl07XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKSB7XG4gIGZvciAoY29uc3QgW21vZGFsSWQsIGNsb3NlRm5dIG9mIF9CR19ESVNNSVNTX01PREFMUykge1xuICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobW9kYWxJZCk7XG4gICAgbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBtb2RhbCkgY2xvc2VGbigpOyB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfd2lyZU1vZGFsQnV0dG9ucygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LW9rLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VBbGVydE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1jYW5jZWwtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfY29uZmlybUNhbmNlbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tb2stYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfY29uZmlybU9rKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlQWN0aW9uc01vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbHMtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUNvbnRyb2xzTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWRpc2NhcmQtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZGlmZkRpc2NhcmQoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1lZGl0LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2RpZmZBY2NlcHRFZGl0KCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1hY2NlcHQtbmV3LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX2RpZmZBY2NlcHROZXcoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlRmllbGRFZGl0TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXNhdmUtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZmllbGRFZGl0U2F2ZSgpKTtcbn1cblxuLy8gXCJDb250cm9sc1wiIGFuZCBcIkRvd25sb2FkIExvZ1wiIGFyZSB3aXJlZCBoZXJlIGJlY2F1c2UgdGhlaXIgb25jbGljaz0gY2FsbGVkXG4vLyBvbmx5IHVpLmpzIGZ1bmN0aW9ucy4gVGhlIEdldHRpbmcgU3RhcnRlZCAvIEdsb3NzYXJ5IC8gSGVscCAvIEFib3V0IGl0ZW1zIGNhbGxcbi8vIGNsb3NlSGFtYnVyZ2VyKCkgKHVpLmpzKSBwbHVzIGEgaGVscG1vZGFscy5qcyBtb2RhbC1vcGVuLCBzbyBoZWxwbW9kYWxzLmpzIG93bnNcbi8vIHRoZWlyIGRlbGVnYXRpb24uIFwiUmUtcnVuIFNldHVwIFdpemFyZFwiIGFuZCBcIlJlZnJlc2hcIiAoZWxlY3Ryb25BUEkgLyBsb2NhdGlvbilcbi8vIHJlbWFpbiBpbmxpbmUgdW50aWwgdGhlaXIgb3duaW5nIGNvZGUgbWlncmF0ZXMuXG5mdW5jdGlvbiBfd2lyZUhhbWJ1cmdlckhhbmRsZXJzKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdG9nZ2xlSGFtYnVyZ2VyKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tY29udHJvbHMnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICBjbG9zZUhhbWJ1cmdlcigpO1xuICAgIG9wZW5Db250cm9sc01vZGFsKCk7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tZG93bmxvYWQtbG9nJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUhhbWJ1cmdlcigpKTtcbn1cblxuX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpO1xuX3dpcmVNb2RhbEJ1dHRvbnMoKTtcbl93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIHRoZSB0aHJlZSBhcHAtZ2xvYmFsIGhlbHAvaW5mbyBtb2RhbHMgKEdldHRpbmcgU3RhcnRlZCwgQWJvdXQsXG4vLyBHbG9zc2FyeSkuIEV4dHJhY3RlZCBvdXQgb2Ygc2V0dGluZ3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLSB0aGVzZVxuLy8gaGF2ZSBubyBjb3VwbGluZyB0byB0aGUgc2V0dGluZ3Mgc2F2ZS9kaXJ0eSBtYWNoaW5lcnkuXG4vLyAgIEFQSTogcm91dGVzL2NvbmZpZy5weSAoZ2xvc3NhcnkpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3NldHRpbmdzLnB5LCB0ZXN0cy91aS90ZXN0X3VpX3BhZ2UucHksIHRlc3RzL3VpL3Rlc3RfdWlfa2V5Ym9hcmQucHlcblxuLy8g4pSA4pSAIGdldHRpbmcgc3RhcnRlZCBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsKCkge1xuICBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2V0dGluZy1zdGFydGVkLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwgLmJ0bicpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2V0dGluZy1zdGFydGVkLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgneXV1LWdldHRpbmctc3RhcnRlZC1zZWVuJywgJzEnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2dldHRpbmdTdGFydGVkT3BlbmVyO1xuICBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBhYm91dCBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWJvdXRPcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5BYm91dE1vZGFsKCkge1xuICBfYWJvdXRPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWJvdXQtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2Fib3V0LW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQWJvdXRNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fib3V0LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfYWJvdXRPcGVuZXI7XG4gIF9hYm91dE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGhlbHAgJiBndWlkZXMgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBMaW5rcyBvdXQgdG8gdGhlIEdpdEh1YiBkb2NzL3VzZXIvIHBhZ2VzIHJhdGhlciB0aGFuIGJ1bmRsaW5nIGNvcGllczogdGhlIGFwcFxuLy8gc2hpcHMgdGhlIHdoZWVsICh3aGljaCBjYXJyaWVzIHN0YXRpYy9nbG9zc2FyeS5tZCkgYnV0IG5vdCBkb2NzL3VzZXIvLCBhbmQgYVxuLy8gYnVuZGxlZCA2NTAtbGluZSBmZWF0dXJlIGd1aWRlIHdvdWxkIGRyaWZ0IGZyb20gdGhlIFVJLiBJbiB0aGUgcGFja2FnZWQgYXBwXG4vLyB0aGVzZSB0YXJnZXQ9X2JsYW5rIGxpbmtzIG9wZW4gaW4gdGhlIHN5c3RlbSBicm93c2VyIHZpYSBzZXRXaW5kb3dPcGVuSGFuZGxlci5cbmxldCBfaGVscE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkhlbHBNb2RhbCgpIHtcbiAgX2hlbHBPcGVuZXIgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVscC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjaGVscC1tb2RhbCAuYnRuJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUhlbHBNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlbHAtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9oZWxwT3BlbmVyO1xuICBfaGVscE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGdsb3NzYXJ5IG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9nbG9zc2FyeU9wZW5lciA9IG51bGw7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3Blbkdsb3NzYXJ5TW9kYWwoKSB7XG4gIF9nbG9zc2FyeU9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgY29uc3QgZmlsdGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWZpbHRlcicpO1xuICBmaWx0ZXIudmFsdWUgPSAnJztcbiAgc2V0VGltZW91dCgoKSA9PiBmaWx0ZXIuZm9jdXMoKSwgNTApO1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1jb250ZW50Jyk7XG4gIGlmIChlbC5kYXRhc2V0LmxvYWRlZCkgeyBfZmlsdGVyR2xvc3NhcnkoJycpOyByZXR1cm47IH1cbiAgdHJ5IHtcbiAgICBjb25zdCBtZCA9IGF3YWl0IGZldGNoKCcvYXBpL2dsb3NzYXJ5JykudGhlbihyID0+IHIudGV4dCgpKTtcbiAgICBlbC5pbm5lckhUTUwgPSBfcmVuZGVyR2xvc3NhcnlNZChtZCk7XG4gICAgZWwuZGF0YXNldC5sb2FkZWQgPSAnMSc7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBlbC5pbm5lckhUTUwgPSAnPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLXJlZClcIj5GYWlsZWQgdG8gbG9hZCBnbG9zc2FyeS48L2Rpdj4nO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBfZmlsdGVyR2xvc3NhcnkocXVlcnkpIHtcbiAgY29uc3QgcSA9IHF1ZXJ5LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBjb250ZW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWNvbnRlbnQnKTtcbiAgbGV0IGFueVZpc2libGUgPSBmYWxzZTtcbiAgY29udGVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZ2xvc3NhcnktdGVybScpLmZvckVhY2godGVybSA9PiB7XG4gICAgY29uc3Qgc2hvdyA9ICFxIHx8IHRlcm0udGV4dENvbnRlbnQudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKTtcbiAgICB0ZXJtLnN0eWxlLmRpc3BsYXkgPSBzaG93ID8gJycgOiAnbm9uZSc7XG4gICAgaWYgKHNob3cpIGFueVZpc2libGUgPSB0cnVlO1xuICB9KTtcbiAgY29udGVudC5xdWVyeVNlbGVjdG9yQWxsKCcuZ2xvc3Nhcnktc2VjdGlvbicpLmZvckVhY2goc2VjdGlvbiA9PiB7XG4gICAgY29uc3QgdGVybXMgPSBBcnJheS5mcm9tKHNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbCgnLmdsb3NzYXJ5LXRlcm0nKSk7XG4gICAgY29uc3Qgc2hvdyA9ICFxIHx8IHRlcm1zLnNvbWUodCA9PiB0LnN0eWxlLmRpc3BsYXkgIT09ICdub25lJyk7XG4gICAgc2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gc2hvdyA/ICcnIDogJ25vbmUnO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LW5vLW1hdGNoZXMnKS5zdHlsZS5kaXNwbGF5ID0gKHEgJiYgIWFueVZpc2libGUpID8gJycgOiAnbm9uZSc7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VHbG9zc2FyeU1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9nbG9zc2FyeU9wZW5lcjtcbiAgX2dsb3NzYXJ5T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBfcmVuZGVyR2xvc3NhcnlNZChtZCkge1xuICBjb25zdCBsaW5lcyA9IG1kLnNwbGl0KCdcXG4nKTtcbiAgbGV0IGh0bWwgPSAnJztcbiAgbGV0IGluTGlzdCA9IGZhbHNlO1xuICBsZXQgaW5UYWJsZSA9IGZhbHNlO1xuICBsZXQgdGFibGVIZWFkID0gZmFsc2U7XG4gIGxldCBpblNlY3Rpb24gPSBmYWxzZTtcbiAgbGV0IGluVGVybSA9IGZhbHNlO1xuXG4gIGNvbnN0IGlubGluZSA9IHMgPT4gc1xuICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKS5yZXBsYWNlKC8+L2csICcmZ3Q7JylcbiAgICAucmVwbGFjZSgvYChbXmBdKylgL2csICc8Y29kZT4kMTwvY29kZT4nKVxuICAgIC5yZXBsYWNlKC9cXCpcXCooW14qXSspXFwqXFwqL2csICc8c3Ryb25nPiQxPC9zdHJvbmc+JylcbiAgICAucmVwbGFjZSgvXFwqKFteKl0rKVxcKi9nLCAnPGVtPiQxPC9lbT4nKTtcblxuICBjb25zdCBjbG9zZUxpc3QgID0gKCkgPT4geyBpZiAoaW5MaXN0KSAgeyBodG1sICs9ICc8L3VsPic7ICAgaW5MaXN0ICA9IGZhbHNlOyB9IH07XG4gIGNvbnN0IGNsb3NlVGFibGUgPSAoKSA9PiB7IGlmIChpblRhYmxlKSB7IGh0bWwgKz0gJzwvdGJvZHk+PC90YWJsZT4nOyBpblRhYmxlID0gZmFsc2U7IHRhYmxlSGVhZCA9IGZhbHNlOyB9IH07XG4gIC8vIFNlY3Rpb24gKCMjKSBhbmQgdGVybSAoIyMjKSB3cmFwcGVyIGRpdnMgYXJlIHRoZSB1bml0cyB0aGUgZ2xvc3NhcnkgZmlsdGVyXG4gIC8vIHNob3dzL2hpZGVzIC0gZXZlcnkgIyMjIGJsb2NrIG11c3QgbGFuZCBpbnNpZGUgZXhhY3RseSBvbmUgLmdsb3NzYXJ5LXRlcm0uXG4gIGNvbnN0IGNsb3NlVGVybSAgICA9ICgpID0+IHsgaWYgKGluVGVybSkgICAgeyBodG1sICs9ICc8L2Rpdj4nOyBpblRlcm0gICAgPSBmYWxzZTsgfSB9O1xuICBjb25zdCBjbG9zZVNlY3Rpb24gPSAoKSA9PiB7IGNsb3NlVGVybSgpOyBpZiAoaW5TZWN0aW9uKSB7IGh0bWwgKz0gJzwvZGl2Pic7IGluU2VjdGlvbiA9IGZhbHNlOyB9IH07XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHJhdyA9IGxpbmVzW2ldO1xuICAgIGNvbnN0IGxpbmUgPSByYXcudHJpbUVuZCgpO1xuXG4gICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnIyMgJykpIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7IGNsb3NlU2VjdGlvbigpO1xuICAgICAgaHRtbCArPSBgPGRpdiBjbGFzcz1cImdsb3NzYXJ5LXNlY3Rpb25cIj48aDIgc3R5bGU9XCJtYXJnaW46MjBweCAwIDRweDtmb250LXNpemU6MTVweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO3BhZGRpbmctYm90dG9tOjRweFwiPiR7aW5saW5lKGxpbmUuc2xpY2UoMykpfTwvaDI+YDtcbiAgICAgIGluU2VjdGlvbiA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJyMjIyAnKSkge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VUZXJtKCk7XG4gICAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiZ2xvc3NhcnktdGVybVwiPjxoMyBzdHlsZT1cIm1hcmdpbjoxNHB4IDAgMnB4O2ZvbnQtc2l6ZToxM3B4O2NvbG9yOnZhcigtLWFjY2VudClcIj4ke2lubGluZShsaW5lLnNsaWNlKDQpKX08L2gzPmA7XG4gICAgICBpblRlcm0gPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAobGluZS5zdGFydHNXaXRoKCctLS0nKSkge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VUZXJtKCk7XG4gICAgICBodG1sICs9ICc8aHIgc3R5bGU9XCJib3JkZXI6bm9uZTtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO21hcmdpbjoxNHB4IDBcIj4nO1xuICAgIH0gZWxzZSBpZiAoL15cXHwvLnRlc3QobGluZSkpIHtcbiAgICAgIGNsb3NlTGlzdCgpO1xuICAgICAgY29uc3QgY2VsbHMgPSBsaW5lLnNwbGl0KCd8Jykuc2xpY2UoMSwgLTEpLm1hcChjID0+IGMudHJpbSgpKTtcbiAgICAgIGlmICgvXlstXFxzfDpdKyQvLnRlc3QobGluZSkpIHtcbiAgICAgICAgdGFibGVIZWFkID0gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKCFpblRhYmxlKSB7XG4gICAgICAgIGluVGFibGUgPSB0cnVlOyB0YWJsZUhlYWQgPSB0cnVlO1xuICAgICAgICBodG1sICs9ICc8dGFibGUgc3R5bGU9XCJ3aWR0aDoxMDAlO2JvcmRlci1jb2xsYXBzZTpjb2xsYXBzZTtmb250LXNpemU6MTJweDttYXJnaW46NnB4IDBcIj48dGhlYWQ+PHRyPic7XG4gICAgICAgIGNlbGxzLmZvckVhY2goYyA9PiB7IGh0bWwgKz0gYDx0aCBzdHlsZT1cInRleHQtYWxpZ246bGVmdDtwYWRkaW5nOjRweCA4cHggNHB4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTtjb2xvcjp2YXIoLS10ZXh0KVwiPiR7aW5saW5lKGMpfTwvdGg+YDsgfSk7XG4gICAgICAgIGh0bWwgKz0gJzwvdHI+PC90aGVhZD48dGJvZHk+JztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGh0bWwgKz0gJzx0cj4nO1xuICAgICAgICBjZWxscy5mb3JFYWNoKGMgPT4geyBodG1sICs9IGA8dGQgc3R5bGU9XCJwYWRkaW5nOjNweCA4cHggM3B4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTtjb2xvcjp2YXIoLS1tdXRlZCk7dmVydGljYWwtYWxpZ246dG9wXCI+JHtpbmxpbmUoYyl9PC90ZD5gOyB9KTtcbiAgICAgICAgaHRtbCArPSAnPC90cj4nO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoL14tIC8udGVzdChsaW5lKSkge1xuICAgICAgY2xvc2VUYWJsZSgpO1xuICAgICAgaWYgKCFpbkxpc3QpIHsgaHRtbCArPSAnPHVsIHN0eWxlPVwibWFyZ2luOjRweCAwIDRweCAxNnB4O3BhZGRpbmc6MFwiPic7IGluTGlzdCA9IHRydWU7IH1cbiAgICAgIGh0bWwgKz0gYDxsaSBzdHlsZT1cIm1hcmdpbjoxcHggMFwiPiR7aW5saW5lKGxpbmUuc2xpY2UoMikpfTwvbGk+YDtcbiAgICB9IGVsc2UgaWYgKGxpbmUgPT09ICcnKSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpO1xuICAgICAgaHRtbCArPSAnPGRpdiBzdHlsZT1cIm1hcmdpbjo0cHggMFwiPjwvZGl2Pic7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7XG4gICAgICBodG1sICs9IGA8cCBzdHlsZT1cIm1hcmdpbjozcHggMFwiPiR7aW5saW5lKGxpbmUpfTwvcD5gO1xuICAgIH1cbiAgfVxuICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpOyBjbG9zZVNlY3Rpb24oKTtcbiAgcmV0dXJuIGh0bWw7XG59XG5cbi8vIOKUgOKUgCBzdGF0aWMgbW9kYWwvaGFtYnVyZ2VyIHdpcmluZyAocmVwbGFjZXMgdGhlIGlubGluZSBvbmNsaWNrPS9vbmlucHV0PSB0aGlzXG4vLyBtb2R1bGUgdXNlZCB0byBvd24gaW4gaW5kZXguaHRtbCkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUaGVzZSBhcmUgZml4ZWQsIG5ldmVyLXJlY3JlYXRlZCBlbGVtZW50cyBpbiBpbmRleC5odG1sLCBzbyB3aXJpbmcgdGhlbSBvbmNlIGF0XG4vLyBtb2R1bGUgbG9hZCAoYmVsb3cpIGNhbid0IGRvdWJsZS1maXJlIG9uIGEgcmUtcmVuZGVyIHRoZSB3YXkgYSBkeW5hbWljYWxseVxuLy8gcmVuZGVyZWQgbGlzdCBjb3VsZC5cbmNvbnN0IF9CR19ESVNNSVNTX01PREFMUyA9IFtcbiAgWydnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwnLCBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWxdLFxuICBbJ2hlbHAtbW9kYWwnLCBjbG9zZUhlbHBNb2RhbF0sXG4gIFsnYWJvdXQtbW9kYWwnLCBjbG9zZUFib3V0TW9kYWxdLFxuICBbJ2dsb3NzYXJ5LW1vZGFsJywgY2xvc2VHbG9zc2FyeU1vZGFsXSxcbl07XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKSB7XG4gIGZvciAoY29uc3QgW21vZGFsSWQsIGNsb3NlRm5dIG9mIF9CR19ESVNNSVNTX01PREFMUykge1xuICAgIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQobW9kYWxJZCk7XG4gICAgbW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHsgaWYgKGUudGFyZ2V0ID09PSBtb2RhbCkgY2xvc2VGbigpOyB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfd2lyZU1vZGFsQnV0dG9ucygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dldHRpbmctc3RhcnRlZC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlbHAtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUhlbHBNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Fib3V0LW1vZGFsLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VBYm91dE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUdsb3NzYXJ5TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1maWx0ZXInKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGUgPT4gX2ZpbHRlckdsb3NzYXJ5KGUudGFyZ2V0LnZhbHVlKSk7XG59XG5cbi8vIFRoZSA0IGhhbWJ1cmdlciBpdGVtcyB1aS5qcydzIG93biBtaWdyYXRpb24gZGVmZXJyZWQgKHRoZWlyIGlubGluZSBvbmNsaWNrPVxuLy8gbWl4ZWQgdWkuanMncyBjbG9zZUhhbWJ1cmdlcigpIHdpdGggYSBoZWxwbW9kYWxzLmpzIG1vZGFsLW9wZW4gY2FsbCkgLSB0aGlzXG4vLyBtb2R1bGUgbm93IG93bnMgdGhlIG1vZGFsLW9wZW4gaGFsZiwgc28gaXQgb3ducyByZXRpcmluZyB0aGVtIHRvby5cbmZ1bmN0aW9uIF93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1nZXR0aW5nLXN0YXJ0ZWQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuR2V0dGluZ1N0YXJ0ZWRNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWdsb3NzYXJ5JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3Blbkdsb3NzYXJ5TW9kYWwoKTtcbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1oZWxwJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkhlbHBNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWFib3V0JykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgd2luZG93LmNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkFib3V0TW9kYWwoKTtcbiAgfSk7XG59XG5cbl93aXJlTW9kYWxCZ0Rpc21pc3NhbHMoKTtcbl93aXJlTW9kYWxCdXR0b25zKCk7XG5fd2lyZUhhbWJ1cmdlckhhbmRsZXJzKCk7XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBhcHAtZ2xvYmFsIGtleWJvYXJkIHNob3J0Y3V0cyBhbmQgdGhlIEVzY2FwZS1rZXkgbGF5ZXIgY2FzY2FkZS5cbi8vIEV4dHJhY3RlZCBvdXQgb2Ygc2V0dGluZ3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLSBzaG9ydGN1dHMgYXJlXG4vLyBhcHAtd2lkZSwgbm90IHNldHRpbmdzLXNwZWNpZmljLlxuLy8gICBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9rZXlib2FyZC5weVxuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgUGFuZWxOYXYgfSBmcm9tICcuL3BhbmVsbmF2LmpzJztcbmltcG9ydCB7XG4gIF9jb25maXJtQ2FuY2VsLCBjbG9zZUFsZXJ0TW9kYWwsIGNsb3NlQ29udHJvbHNNb2RhbCwgY2xvc2VGaWVsZEVkaXRNb2RhbCxcbiAgX2RpZmZEaXNjYXJkLCBjbG9zZUFjdGlvbnNNb2RhbCwgY2xvc2VLZWJhYiwgaXNIYW1idXJnZXJPcGVuLCBjbG9zZUhhbWJ1cmdlcixcbiAgdG9wbW9zdFZpc2libGVNb2RhbCwgb3BlbkNvbnRyb2xzTW9kYWwsXG59IGZyb20gJy4vdWkuanMnO1xuaW1wb3J0IHtcbiAgY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsLCBjbG9zZUFib3V0TW9kYWwsIGNsb3NlR2xvc3NhcnlNb2RhbCwgY2xvc2VIZWxwTW9kYWwsXG59IGZyb20gJy4vaGVscG1vZGFscy5qcyc7XG5cbi8vIOKUgOKUgCBrZXlib2FyZCBzaG9ydGN1dHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbi8vIEVzY2FwZSBwZWVscyBvbmUgbGF5ZXIgcGVyIHByZXNzLCB0b3Btb3N0IGZpcnN0OiBmbG9hdGluZyBtZW51cyAoa2ViYWIgejo1MDAsXG4vLyBoYW1idXJnZXIgejozMDApIHNpdCBhYm92ZSBtb2RhbHMgKHo6MjAwKSwgd2hpY2ggc2l0IGFib3ZlIHRoZSBzZXR0aW5ncyBwYW5lbFxuLy8gYW5kIHRoZSBmdWxsLXBhbmVsIGVkaXRvcnMuIHRvcG1vc3RWaXNpYmxlTW9kYWwgKHVpLmpzKSByZXNvbHZlcyBtb2RhbFxuLy8gc3RhY2tpbmcgLSBjb25maXJtL2FsZXJ0IHRha2UgcHJpb3JpdHksIHNvIGEgXCJEaXNjYXJkP1wiIGNvbmZpcm0gY2FuY2Vsc1xuLy8gd2l0aG91dCBhbHNvIGNsb3NpbmcgdGhlIHN0aWxsLWRpcnR5IGVkaXRvciB1bmRlcm5lYXRoIGl0LlxuLy9cbi8vIFN0aWxsLWNsYXNzaWMgbW9kYWwgY2xvc2VycyAod2luZG93LmNsb3NlU2NvcmVPdmVycmlkZU1vZGFsIGV0Yy4pIGFyZSBjYWxsZWRcbi8vIGFzIGJhcmUgZ2xvYmFscyAtIHRoZWlyIG93bmluZyBtb2R1bGVzIGhhdmVuJ3QgbWlncmF0ZWQgdG8gRVNNIHlldC5cbmNvbnN0IF9tb2RhbEVzY2FwZUNsb3NlcnMgPSB7XG4gICdjb25maXJtLW1vZGFsJzogICAgICAgICAgICgpID0+IF9jb25maXJtQ2FuY2VsKCksXG4gICdhbGVydC1tb2RhbCc6ICAgICAgICAgICAgICgpID0+IGNsb3NlQWxlcnRNb2RhbCgpLFxuICAnZ2V0dGluZy1zdGFydGVkLW1vZGFsJzogICAoKSA9PiBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWwoKSxcbiAgJ2Fib3V0LW1vZGFsJzogICAgICAgICAgICAgKCkgPT4gY2xvc2VBYm91dE1vZGFsKCksXG4gICdjb250cm9scy1tb2RhbCc6ICAgICAgICAgICgpID0+IGNsb3NlQ29udHJvbHNNb2RhbCgpLFxuICAnZ2xvc3NhcnktbW9kYWwnOiAgICAgICAgICAoKSA9PiBjbG9zZUdsb3NzYXJ5TW9kYWwoKSxcbiAgJ2hlbHAtbW9kYWwnOiAgICAgICAgICAgICAgKCkgPT4gY2xvc2VIZWxwTW9kYWwoKSxcbiAgJ2ZpZWxkLWVkaXQtbW9kYWwnOiAgICAgICAgKCkgPT4gY2xvc2VGaWVsZEVkaXRNb2RhbCgpLFxuICAnZGlmZi1tb2RhbCc6ICAgICAgICAgICAgICAoKSA9PiBfZGlmZkRpc2NhcmQoKSxcbiAgJ3Njb3JlLW92ZXJyaWRlLW1vZGFsJzogICAgKCkgPT4gY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwoKSxcbiAgJ3Byb2ZpbGUtbW9kYWwnOiAgICAgICAgICAgKCkgPT4gY2xvc2VQcm9maWxlTWFuYWdlcigpLFxuICAnaGlnaGxpZ2h0LXJlZWxzLW1vZGFsJzogICAoKSA9PiBjbG9zZUhpZ2hsaWdodFJlZWxzTW9kYWwoKSxcbiAgJ3JlZWwtcHJldmlldy1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VSZWVsUHJldmlldygpLFxuICAncmV0cmFuc2NyaWJlLW1vZGFsJzogICAgICAoKSA9PiBjbG9zZVJldHJhbnNjcmliZU1vZGFsKCksXG4gICdjb250ZXh0LW1vZGFsJzogICAgICAgICAgICgpID0+IGNsb3NlQ29udGV4dE1hbmFnZXIoKSxcbiAgJ2JhdGNoLWV4cG9ydC1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VCYXRjaEV4cG9ydE1vZGFsKCksXG4gICdleHBvcnQtc2V0dGluZ3MtbW9kYWwnOiAgICgpID0+IGNsb3NlRXhwb3J0TW9kYWwoKSxcbiAgJ3RpbWVsaW5lLWludGVydmFsLW1vZGFsJzogKCkgPT4gY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKSxcbiAgJ2F1dG8tYXBwcm92ZS1tb2RhbCc6ICAgICAgKCkgPT4gY2xvc2VBdXRvQXBwcm92ZU1vZGFsKCksXG4gICdzaW1pbGFyLWNsaXBzLW1vZGFsJzogICAgICgpID0+IGNsb3NlU2ltaWxhckNsaXBzTW9kYWwoKSxcbiAgJ2FjdGlvbnMtbW9kYWwnOiAgICAgICAgICAgKCkgPT4gY2xvc2VBY3Rpb25zTW9kYWwoKSxcbn07XG5cbmZ1bmN0aW9uIF9jbG9zZVRvcG1vc3RMYXllcigpIHtcbiAgaWYgKGNsb3NlS2ViYWIodHJ1ZSkpIHJldHVybjtcbiAgaWYgKGlzSGFtYnVyZ2VyT3BlbigpKSB7IGNsb3NlSGFtYnVyZ2VyKHRydWUpOyByZXR1cm47IH1cbiAgaWYgKGlzUHJvamVjdE1lbnVPcGVuKCkpIHsgY2xvc2VQcm9qZWN0TWVudSh0cnVlKTsgcmV0dXJuOyB9XG4gIGNvbnN0IHRvcE1vZGFsID0gdG9wbW9zdFZpc2libGVNb2RhbCgpO1xuICBpZiAodG9wTW9kYWwpIHtcbiAgICAoX21vZGFsRXNjYXBlQ2xvc2Vyc1t0b3BNb2RhbC5pZF0gfHwgKCgpID0+IHRvcE1vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKSkpKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2V0dGluZ3MtcGFuZWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSkgeyBjbG9zZVNldHRpbmdzKCk7IHJldHVybjsgfVxuICBpZiAoUGFuZWxOYXYuaXNPcGVuKCkpIHsgUGFuZWxOYXYuY2xvc2UoKTsgcmV0dXJuOyB9XG4gIGlmIChfaXNOZXdSZWNvcmRpbmdQYW5lbE9wZW4oKSkgY2xvc2VOZXdSZWNvcmRpbmdQYW5lbCgpO1xufVxuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XG4gIC8vIEEgZm9jdXNlZCBsaXN0IGl0ZW0gKGNsaXAvdmlkZW8gPGxpPikgaGFuZGxlcyBFbnRlci9TcGFjZSBpdHNlbGYgYW5kIGNhbGxzXG4gIC8vIHByZXZlbnREZWZhdWx0IC0gZG9uJ3QgQUxTTyBydW4gdGhlIGdsb2JhbCBzaG9ydGN1dCAoZS5nLiBTcGFjZSB0b2dnbGluZ1xuICAvLyBwbGF5L3BhdXNlIHdoaWxlIHRoZSBsaSBhY3RpdmF0aW9uIGlzIHNlbGVjdGluZyBhIGNsaXApLlxuICBpZiAoZS5kZWZhdWx0UHJldmVudGVkKSByZXR1cm47XG5cbiAgY29uc3QgaXNUeXBpbmcgPSBlLnRhcmdldC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGUudGFyZ2V0LnRhZ05hbWUgPT09ICdURVhUQVJFQScgfHwgZS50YXJnZXQuaXNDb250ZW50RWRpdGFibGU7XG5cbiAgLy8gRXNjYXBlIG11c3Qgd29yayB3aXRoIGZvY3VzIG9uIGEgYnV0dG9uL3NlbGVjdC9saW5rIC0gdGhhdCdzIHdoZXJlIGV2ZXJ5XG4gIC8vIG1vZGFsIHBsYWNlcyBmb2N1cyBvbiBvcGVuLiBPbmx5IHR5cGluZyBzdXJmYWNlcyBrZWVwIEVzY2FwZSB0byB0aGVtc2VsdmVzXG4gIC8vICh0aGVpciBvd24gaGFuZGxlcnMsIGUuZy4gdGhlIGlubGluZSBjYXB0aW9uIGVkaXRvciwgdXNlIGl0IHRvIGNhbmNlbCkuXG4gIGlmIChlLmtleSA9PT0gJ0VzY2FwZScgJiYgaXNUeXBpbmcpIHJldHVybjtcblxuICBpZiAoZS5rZXkgIT09ICdFc2NhcGUnICYmXG4gICAgICAoaXNUeXBpbmcgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ0JVVFRPTicgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ1NFTEVDVCcgfHwgZS50YXJnZXQudGFnTmFtZSA9PT0gJ0EnKSkgcmV0dXJuO1xuXG4gIC8vIEN0cmwvQ21kK1ogKHVuZG8pIGlzIHRoZSBvbmx5IGJpbmRpbmcgdGhhdCBpbnRlbnRpb25hbGx5IHVzZXMgYSBtb2RpZmllci5cbiAgLy8gRXZlcnkgb3RoZXIgc2hvcnRjdXQgaXMgYSBiYXJlIGtleSwgc28gbGV0IG1vZGlmaWVyIGNob3JkcyBmYWxsIHRocm91Z2ggdG9cbiAgLy8gdGhlIGJyb3dzZXIvT1MgKEN0cmwrUiByZWZyZXNoLCBDbWQrQSBzZWxlY3QtYWxsLCBldGMuKSBpbnN0ZWFkIG9mIGhpamFja2luZ1xuICAvLyB0aGVtIC0gcnVubmluZyBhIGJhcmUta2V5IGhhbmRsZXIgaGVyZSB3b3VsZCBhbHNvIHByZXZlbnREZWZhdWx0IHRoZSBjaG9yZC5cbiAgaWYgKGUua2V5ID09PSAneicgJiYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkpKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHVuZG9MYXN0U3RhdHVzKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5IHx8IGUuYWx0S2V5KSByZXR1cm47XG5cbiAgY29uc3QgX2FueU1vZGFsT3BlbiA9ICgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5tb2RhbC1iZy52aXNpYmxlJykgIT09IG51bGw7XG5cbiAgaWYgKGUua2V5ID09PSAnPycgfHwgZS5rZXkgPT09ICcvJykge1xuICAgIGlmIChfYW55TW9kYWxPcGVuKCkpIHJldHVybjtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgb3BlbkNvbnRyb2xzTW9kYWwoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuICAgIF9jbG9zZVRvcG1vc3RMYXllcigpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEEgdGFrZW92ZXIgcGFuZWwgKGUuZy4gU3BsaXQgRWRpdG9yKSBjb3ZlcnMgdGhlIGRldGFpbCBwYW5lIGJ1dCBub3QgdGhlXG4gIC8vIGNsaXAgbGlzdCBiZXNpZGUgaXQgLSB3aXRob3V0IHRoaXMgZ3VhcmQgSi9LL0EvUiB3b3VsZCBzaWxlbnRseSBhY3Qgb24gYVxuICAvLyBjbGlwIHRoZSB1c2VyIGNhbiBubyBsb25nZXIgc2VlLlxuICBpZiAoX2FueU1vZGFsT3BlbigpIHx8IFBhbmVsTmF2LmlzT3BlbigpKSByZXR1cm47XG5cbiAgLy8gQS9SL0UgbXVzdCBhY3Qgb24gdGhlIGNsaXAgdGhlIHVzZXIgaXMgcG9pbnRpbmcgYXQ6IHdoZW4ga2V5Ym9hcmQgZm9jdXNcbiAgLy8gc2l0cyBvbiBhIGNsaXAgbGlzdCByb3cgKFRhYiksIHRoYXQgcm93IGlzIHRoZSBzdWJqZWN0IC0gbm90IHRoZSBhY3RpdmVcbiAgLy8gY2xpcCwgd2hpY2ggY2FuIGJlIGEgZGlmZmVyZW50IHJvdyAoZm9jdXNlZC12cy1hY3RpdmUgbWlzbWF0Y2gpLlxuICBjb25zdCBmb2N1c2VkUm93ID0gZS50YXJnZXQgaW5zdGFuY2VvZiBFbGVtZW50ID8gZS50YXJnZXQuY2xvc2VzdCgnI2NsaXAtbGlzdCBsaVtkYXRhLWNsaXAtaWRdJykgOiBudWxsO1xuICBjb25zdCBzdWJqZWN0Q2xpcElkID0gZm9jdXNlZFJvdyA/IE51bWJlcihmb2N1c2VkUm93LmRhdGFzZXQuY2xpcElkKSA6IEFwcFN0YXRlLmFjdGl2ZUNsaXBJZDtcbiAgaWYgKCFzdWJqZWN0Q2xpcElkKSByZXR1cm47XG5cbiAgLy8gQWN0aXZhdGUgdGhlIHN1YmplY3QgZmlyc3Qgc28gdGhlIGRldGFpbCBwYW5lIGFuZCBwbGF5ZXIgc2hvdyB0aGUgY2xpcFxuICAvLyB0aGUgc2hvcnRjdXQgaXMgYWN0aW5nIG9uIGJlZm9yZSB0aGUgYWN0aW9uIGxhbmRzLlxuICBjb25zdCBfYWN0T25TdWJqZWN0ID0gYWN0aW9uID0+IHtcbiAgICBpZiAoc3ViamVjdENsaXBJZCAhPT0gQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSBzZWxlY3RDbGlwKHN1YmplY3RDbGlwSWQpLnRoZW4oKCkgPT4gYWN0aW9uKHN1YmplY3RDbGlwSWQpKTtcbiAgICBlbHNlIGFjdGlvbihzdWJqZWN0Q2xpcElkKTtcbiAgfTtcbiAgLy8gQXJyb3cgbmF2aWdhdGlvbiBtb3ZlcyBrZXlib2FyZCBmb2N1cyBhbG9uZyB3aXRoIHRoZSBhY3RpdmUgY2xpcCBzbyB0aGVcbiAgLy8gZm9jdXMgcmluZyBhbmQgdGhlIGFjdGl2ZSBoaWdobGlnaHQgY2FuIG5ldmVyIHBvaW50IGF0IGRpZmZlcmVudCByb3dzLlxuICBjb25zdCBfbmF2aWdhdGVUbyA9IGlkID0+IHtcbiAgICBzZWxlY3RDbGlwKGlkKTtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAjY2xpcC1saXN0IGxpW2RhdGEtY2xpcC1pZD1cIiR7aWR9XCJdYCk/LmZvY3VzKCk7XG4gIH07XG5cbiAgY29uc3QgaWR4ID0gQXBwU3RhdGUuY2xpcHMuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gc3ViamVjdENsaXBJZCk7XG5cbiAgc3dpdGNoIChlLmtleSkge1xuICAgIGNhc2UgJ2EnOiBjYXNlICdBJzpcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIF9hY3RPblN1YmplY3QoaWQgPT4gc2V0U3RhdHVzKGlkLCAnYXBwcm92ZWQnKSk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdyJzogY2FzZSAnUic6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBfYWN0T25TdWJqZWN0KGlkID0+IHNldFN0YXR1cyhpZCwgJ3JlamVjdGVkJykpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAndSc6IGNhc2UgJ1UnOlxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgX2FjdE9uU3ViamVjdChpZCA9PiBzZXRTdGF0dXMoaWQsICdwZW5kaW5nJykpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnICc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB7IGNvbnN0IHYgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGxheWVyLWFyZWEgdmlkZW8nKTsgaWYgKHYpIHsgdi5wYXVzZWQgPyB2LnBsYXkoKSA6IHYucGF1c2UoKTsgfSB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdlJzogY2FzZSAnRSc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBfYWN0T25TdWJqZWN0KGV4cG9ydENsaXApO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQXJyb3dMZWZ0JzpcbiAgICBjYXNlICdBcnJvd1VwJzpcbiAgICBjYXNlICdrJzogY2FzZSAnSyc6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBpZiAoaWR4ID4gMCkgX25hdmlnYXRlVG8oQXBwU3RhdGUuY2xpcHNbaWR4IC0gMV0uaWQpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQXJyb3dSaWdodCc6XG4gICAgY2FzZSAnQXJyb3dEb3duJzpcbiAgICBjYXNlICdqJzogY2FzZSAnSic6XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBpZiAoaWR4ICE9PSAtMSAmJiBpZHggPCBBcHBTdGF0ZS5jbGlwcy5sZW5ndGggLSAxKSBfbmF2aWdhdGVUbyhBcHBTdGF0ZS5jbGlwc1tpZHggKyAxXS5pZCk7XG4gICAgICBicmVhaztcbiAgfVxufSk7XG5cbi8vIE5vIGV4cG9ydHMgLSB0aGlzIG1vZHVsZSdzIG9ubHkgcHVibGljIHN1cmZhY2UgaXMgdGhlIGtleWRvd24gbGlzdGVuZXJcbi8vIHJlZ2lzdHJhdGlvbiBpdHNlbGY7IF9tb2RhbEVzY2FwZUNsb3NlcnMvX2Nsb3NlVG9wbW9zdExheWVyIGFyZSByZWZlcmVuY2VkXG4vLyBvbmx5IGZyb20gd2l0aGluIHRoaXMgbW9kdWxlLiBTdGlsbC1jbGFzc2ljIGdsb2JhbHMgaXQgY2FsbHNcbi8vIChjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCwgc2VsZWN0Q2xpcCwgc2V0U3RhdHVzLCBleHBvcnRDbGlwLCBldGMuKSByZXNvbHZlXG4vLyBvZmYgd2luZG93IHNpbmNlIHRoZWlyIG93bmluZyBtb2R1bGVzIGhhdmVuJ3QgbWlncmF0ZWQgdG8gRVNNIHlldC5cbiIsICIvLyBGZWF0dXJlLW1hcCAtIHRoZSByZWNvbW1lbmRlZC1tb2RlbCBjYXRhbG9nLCBtb2RlbC1yZWFkaW5lc3Mgcm93LCBhbmQgdGhlXG4vLyBjYXBhYmlsaXRpZXMgb3ZlcnZpZXcgKFwid2hhdCBzY29yaW5nL3Zpc2lvbiBwb3dlciBpcyBpbnN0YWxsZWQgYW5kIGhvdyBkbyBJXG4vLyBnZXQgbW9yZVwiKS4gRXh0cmFjdGVkIG91dCBvZiBzZXR0aW5ncy5qcyAod2hpY2ggZ3JldyBpbnRvIGEgY2F0Y2gtYWxsKSAtXG4vLyB0aGVzZSByZWFkIGJhY2tlbmQvbW9kZWwgY29uZmlnIHRvIGRlY2lkZSB3aGF0IHRvIHJlbmRlciwgYnV0IHRoZSBzYXZlL2RpcnR5XG4vLyBlbmdpbmUgdGhhdCBwZXJzaXN0cyBjb25maWcgc3RheXMgaW4gc2V0dGluZ3MuanMuXG4vLyAgIEFQSTogcm91dGVzL2xsbS5weSwgcm91dGVzL2NvbmZpZy5weSAoY2FwYWJpbGl0aWVzL3RpZXJzKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9tb2RlbF9jYXRhbG9nLnB5LCB0ZXN0cy91aS90ZXN0X3VpX3NldHRpbmdzLnB5XG5pbXBvcnQgeyBlc2NIdG1sIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xuaW1wb3J0IHsgc2hvd1RvYXN0IH0gZnJvbSAnLi91dGlscy5qcyc7XG5cbi8vIOKUgOKUgCBtb2RlbCBjYXRhbG9nIChyZWNvbW1lbmRlZCB0ZXh0ICsgdmlzaW9uIG1vZGVscykg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBMb2FkZWQgb25jZSBwZXIgc2Vzc2lvbi4gRmlsbHMgdGhlIHJlY29tbWVuZGVkIG1vZGVsIGxpc3RzOyB0aGUgY2FwYWJpbGl0aWVzXG4vLyBsaW5lIHJlZmxlY3RzIHRoZSAqc2F2ZWQqIGFjdGl2ZSBtb2RlbC5cbmxldCBfbW9kZWxDYXRhbG9nID0gbnVsbDtcbi8vIG1vZGVsc19kaXIgLyBmcmVlIGRpc2sgLyBzYXZlZCBiYWNrZW5kLCBzbyBjYXJkcyBjYW4gc2hvdyBcIn5YIEdCLCBZIEdCIGZyZWVcIlxuLy8gdXAgZnJvbnQgYW5kIHRoZSBzdW1tYXJ5IGxpbmUgY2FuIG5hbWUgdGhlIGFjdGl2ZSBiYWNrZW5kLlxubGV0IF9tb2RlbENhdGFsb2dJbmZvID0geyBtb2RlbHNfZGlyOiAnJywgZnJlZV9nYjogbnVsbCwgYmFja2VuZDogJ2xsYW1hY3BwJyB9O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX2Vuc3VyZU1vZGVsQ2F0YWxvZygpIHtcbiAgaWYgKF9tb2RlbENhdGFsb2cpIHJldHVybjtcbiAgYXdhaXQgX2xvYWRNb2RlbENhdGFsb2coKTtcbn1cblxuLy8gRm9yY2UgYSByZS1mZXRjaCArIHJlLXJlbmRlci4gQ2FsbGVkIGFmdGVyIFNhdmUgKGNvbmZpZyBjaGFuZ2VkIHdoaWNoIG1vZGVsIGlzXG4vLyBhY3RpdmUpIHNvIHRoZSBcIkFjdGl2ZVwiIGJhZGdlIGFuZCB0aGUgc3VtbWFyeSBsaW5lIHJlZmxlY3QgdGhlIHNhdmVkIHN0YXRlLlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hNb2RlbENhdGFsb2coKSB7XG4gIF9tb2RlbENhdGFsb2cgPSBudWxsO1xuICBhd2FpdCBfbG9hZE1vZGVsQ2F0YWxvZygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfbG9hZE1vZGVsQ2F0YWxvZygpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2goJy9hcGkvbGxtL2NhdGFsb2cnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICAgIF9tb2RlbENhdGFsb2cgPSBkYXRhLm1vZGVscyB8fCBbXTtcbiAgICBfbW9kZWxDYXRhbG9nSW5mbyA9IHtcbiAgICAgIG1vZGVsc19kaXI6IGRhdGEubW9kZWxzX2RpciB8fCAnJyxcbiAgICAgIGZyZWVfZ2I6IGRhdGEuZnJlZV9nYiA/PyBudWxsLFxuICAgICAgYmFja2VuZDogZGF0YS5iYWNrZW5kIHx8ICdsbGFtYWNwcCcsXG4gICAgfTtcbiAgfSBjYXRjaCB7XG4gICAgX21vZGVsQ2F0YWxvZyA9IFtdO1xuICAgIGNvbnN0IGZhaWxlZEVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxhbWFjcHAtcmVjb21tZW5kZWQnKTtcbiAgICBpZiAoZmFpbGVkRWwpIGZhaWxlZEVsLmlubmVySFRNTCA9XG4gICAgICAnPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj5Db3VsZCBub3QgbG9hZCB0aGUgcmVjb21tZW5kZWQgbW9kZWwgbGlzdCAtIGNoZWNrIHlvdXIgaW50ZXJuZXQgY29ubmVjdGlvbiBhbmQgcmVvcGVuIFNldHRpbmdzLiBZb3UgY2FuIHN0aWxsIHNldCBhIG1vZGVsIGZpbGUgYnkgaGFuZCB1bmRlciBBZHZhbmNlZCBBSSBvcHRpb25zIGJlbG93LjwvZGl2Pic7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9yZW5kZXJSZWNvbW1lbmRlZE1vZGVscygncy1sbGFtYWNwcC1yZWNvbW1lbmRlZCcsICdsbGFtYWNwcCcpO1xuICBfdXBkYXRlQ3VycmVudE1vZGVsU3VtbWFyeSgpO1xufVxuXG4vLyBcIkN1cnJlbnRseSB1c2luZzogPG1vZGVsPiAoPGJhY2tlbmQ+KVwiIC0gc3RhdGVzIHRoZSBzYXZlZCBhY3RpdmUgbW9kZWwgcGxhaW5seVxuLy8gc28gaXQgaXNuJ3QgcmV2ZXJzZS1lbmdpbmVlcmVkIGZyb20gYSBwYXRoIHN0cmluZy4gSGlkZGVuIHdoZW4gbm90aGluZyBtYXRjaGVzLlxuY29uc3QgX0JBQ0tFTkRfTEFCRUxTID0geyBsbGFtYWNwcDogJ0xvY2FsIGxsYW1hLmNwcCcgfTtcblxuZnVuY3Rpb24gX3VwZGF0ZUN1cnJlbnRNb2RlbFN1bW1hcnkoKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxtLWN1cnJlbnQtc3VtbWFyeScpO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGNvbnN0IGFjdGl2ZSA9IChfbW9kZWxDYXRhbG9nIHx8IFtdKS5maW5kKG0gPT4gbS5hY3RpdmUpO1xuICBpZiAoIWFjdGl2ZSkgeyBlbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyByZXR1cm47IH1cbiAgY29uc3QgYmFja2VuZCA9IF9tb2RlbENhdGFsb2dJbmZvLmJhY2tlbmQ7XG4gIGNvbnN0IGxhYmVsID0gX0JBQ0tFTkRfTEFCRUxTW2JhY2tlbmRdIHx8IGJhY2tlbmQ7XG4gIGVsLmlubmVySFRNTCA9XG4gICAgYEN1cnJlbnRseSB1c2luZzogPHN0cm9uZz4ke2VzY0h0bWwoYWN0aXZlLmRpc3BsYXlfbmFtZSl9PC9zdHJvbmc+IGAgK1xuICAgIGA8c3BhbiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj4oJHtlc2NIdG1sKGxhYmVsKX0pPC9zcGFuPmA7XG4gIGVsLnN0eWxlLmRpc3BsYXkgPSAnJztcbn1cblxuLy8gVGV4dCBhbmQgdmlzaW9uIG1vZGVscyByZW5kZXIgYXMgdHdvIGxhYmVsbGVkIGdyb3VwcyBwZXIgYmFja2VuZCwgZWFjaCB3aXRoXG4vLyBpdHMgb3duIGludHJvLCByYXRoZXIgdGhhbiBvbmUgZmxhdCBsaXN0IC0gc28gaXQncyBvYnZpb3VzIHdoaWNoIG1vZGVscyBzY29yZVxuLy8gY2xpcHMgYW5kIHdoaWNoIGRlc2NyaWJlIGZyYW1lcy5cbmZ1bmN0aW9uIF9yZW5kZXJSZWNvbW1lbmRlZE1vZGVscyhjb250YWluZXJJZCwgYmFja2VuZCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGNvbnRhaW5lcklkKTtcbiAgaWYgKCFlbCB8fCAhX21vZGVsQ2F0YWxvZykgcmV0dXJuO1xuICBjb25zdCBtb2RlbHMgPSBfbW9kZWxDYXRhbG9nLmZpbHRlcihtID0+IG0uYmFja2VuZHMuaW5jbHVkZXMoYmFja2VuZCkpO1xuICBpZiAoIW1vZGVscy5sZW5ndGgpIHsgZWwuaW5uZXJIVE1MID0gJyc7IHJldHVybjsgfVxuICBjb25zdCB0ZXh0TW9kZWxzID0gbW9kZWxzLmZpbHRlcihtID0+ICFtLmtpbmRzLmluY2x1ZGVzKCd2aXNpb24nKSk7XG4gIGNvbnN0IHZpc2lvbk1vZGVscyA9IG1vZGVscy5maWx0ZXIobSA9PiBtLmtpbmRzLmluY2x1ZGVzKCd2aXNpb24nKSk7XG4gIGVsLmlubmVySFRNTCA9XG4gICAgX21vZGVsR3JvdXBIdG1sKCdUZXh0IHNjb3JpbmcgbW9kZWxzJyxcbiAgICAgICdTY29yZSBjbGlwcyBhbmQgd3JpdGUgZGVzY3JpcHRpb25zLiBQaWNrIG9uZSB0byBnZXQgc3RhcnRlZC4nLCB0ZXh0TW9kZWxzLCBiYWNrZW5kLCAndGV4dCcpICtcbiAgICBfbW9kZWxHcm91cEh0bWwoJ0ltYWdlIGFuYWx5c2lzICh2aXNpb24pIG1vZGVscycsXG4gICAgICAnT3B0aW9uYWwgLSBsZXQgWXV1Q2xpcCBsb29rIGF0IGZyYW1lcyBhbmQgZGVzY3JpYmUgd2hhdCBpcyBvbiBzY3JlZW4uJywgdmlzaW9uTW9kZWxzLCBiYWNrZW5kLCAndmlzaW9uJyk7XG4gIF93aXJlTW9kZWxDYXJkcyhlbCk7XG59XG5cbmZ1bmN0aW9uIF9tb2RlbEdyb3VwSHRtbCh0aXRsZSwgaW50cm8sIG1vZGVscywgYmFja2VuZCwga2luZCkge1xuICBpZiAoIW1vZGVscy5sZW5ndGgpIHJldHVybiAnJztcbiAgcmV0dXJuIChcbiAgICBgPGRpdiBjbGFzcz1cInJlYy1tb2RlbC1ncm91cFwiPmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJyZWMtbW9kZWwtZ3JvdXAtdGl0bGVcIj4ke2VzY0h0bWwodGl0bGUpfTwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+JHtlc2NIdG1sKGludHJvKX08L2Rpdj5gICtcbiAgICAgIG1vZGVscy5tYXAobSA9PiBfcmVjTW9kZWxIdG1sKG0sIGJhY2tlbmQsIGtpbmQpKS5qb2luKCcnKSArXG4gICAgYDwvZGl2PmBcbiAgKTtcbn1cblxuZnVuY3Rpb24gX3dpcmVNb2RlbENhcmRzKGVsKSB7XG4gIGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5yZWMtbW9kZWwnKS5mb3JFYWNoKGNhcmQgPT4ge1xuICAgIGNvbnN0IG1vZGVsSWQgPSBjYXJkLmdldEF0dHJpYnV0ZSgnZGF0YS1tb2RlbC1pZCcpO1xuICAgIGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtYWN0PVwiZG93bmxvYWQtZ2d1ZlwiXScpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGRvd25sb2FkR2d1Zk1vZGVsKG1vZGVsSWQsIGNhcmQpKTtcbiAgICBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWFjdD1cInVzZS1nZ3VmXCJdJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gX3VzZUdndWZNb2RlbChtb2RlbElkKSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBfbW9kZWxNZXRhTGluZShtKSB7XG4gIGNvbnN0IGZyZWUgPSBfbW9kZWxDYXRhbG9nSW5mby5mcmVlX2diO1xuICByZXR1cm4gW1xuICAgIG0uc2l6ZV9nYiA/IGB+JHttLnNpemVfZ2J9IEdCYCA6IG51bGwsXG4gICAgKG0uc2l6ZV9nYiAhPSBudWxsICYmIGZyZWUgIT0gbnVsbCkgPyBgJHtmcmVlfSBHQiBmcmVlYCA6IG51bGwsXG4gICAgbS5saWNlbmNlLFxuICBdLmZpbHRlcihCb29sZWFuKS5qb2luKCcgwrcgJyk7XG59XG5cbmZ1bmN0aW9uIF9tb2RlbEJhZGdlKG0pIHtcbiAgaWYgKG0uYWN0aXZlKSByZXR1cm4gYDxzcGFuIGNsYXNzPVwicmVjLW1vZGVsLWJhZGdlIGFjdGl2ZVwiPkFjdGl2ZTwvc3Bhbj5gO1xuICBpZiAobS5pbnN0YWxsZWQpIHJldHVybiBgPHNwYW4gY2xhc3M9XCJyZWMtbW9kZWwtYmFkZ2VcIj5Eb3dubG9hZGVkPC9zcGFuPmA7XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gX3JlY01vZGVsSHRtbChtLCBiYWNrZW5kLCBraW5kKSB7XG4gIGNvbnN0IGFjdGlvbnMgPSBfbGxhbWFjcHBBY3Rpb25zKG0pO1xuICByZXR1cm4gKFxuICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsJHttLmFjdGl2ZSA/ICcgYWN0aXZlJyA6ICcnfVwiIGRhdGEtbW9kZWwtaWQ9XCIke2VzY0h0bWwobS5pZCl9XCIgZGF0YS1raW5kPVwiJHtlc2NIdG1sKGtpbmQgfHwgJ3RleHQnKX1cIj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsLWhlYWRcIj48c3BhbiBjbGFzcz1cInJlYy1tb2RlbC1uYW1lXCI+JHtlc2NIdG1sKG0uZGlzcGxheV9uYW1lKX08L3NwYW4+YCArXG4gICAgICBfbW9kZWxCYWRnZShtKSArXG4gICAgICBgPHNwYW4gY2xhc3M9XCJyZWMtbW9kZWwtbWV0YVwiPiR7ZXNjSHRtbChfbW9kZWxNZXRhTGluZShtKSl9PC9zcGFuPjwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJyZWMtbW9kZWwtd2h5XCI+JHtlc2NIdG1sKG0ud2h5KX08L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwicmVjLW1vZGVsLWFjdGlvbnNcIj4ke2FjdGlvbnN9PC9kaXY+YCArXG4gICAgICBgPGRpdiBjbGFzcz1cIm1kbC1wcm9ncmVzc1wiIGRhdGEtZ2d1Zi1wcm9ncmVzcyBzdHlsZT1cImRpc3BsYXk6bm9uZVwiPmAgK1xuICAgICAgICBgPGRpdiBjbGFzcz1cIm1kbC1iYXJcIj48ZGl2IGNsYXNzPVwibWRsLWJhci1maWxsXCIgZGF0YS1nZ3VmLWZpbGw+PC9kaXY+PC9kaXY+YCArXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cIm1kbC1wY3RcIiBkYXRhLWdndWYtcGN0Pjwvc3Bhbj48L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwic2V0dGluZ3MtaW5zdGFsbC1sb2dcIiBkYXRhLWdndWYtbG9nPjwvZGl2PmAgK1xuICAgIGA8L2Rpdj5gXG4gICk7XG59XG5cbi8vIE9uZS1jbGljayBzdXJmYWNlIGZvciBsb2NhbCAuZ2d1ZiBtb2RlbHM6IGRvd25sb2FkIHdoZW4gbWlzc2luZywgXCJVc2UgdGhpc1xuLy8gbW9kZWxcIiB3aGVuIHRoZSBmaWxlIGlzIGFscmVhZHkgb24gZGlzaywgYW5kIGEgcGxhaW4gXCJpbiB1c2VcIiBub3RlIHdoZW4gYWN0aXZlLlxuLy8gVGhlIHJhdyBwYXRoIGJveGVzIChBZHZhbmNlZCBkaXNjbG9zdXJlKSBzdGF5IGFzIHRoZSBtYW51YWwgZmFsbGJhY2suXG5mdW5jdGlvbiBfbGxhbWFjcHBBY3Rpb25zKG0pIHtcbiAgaWYgKCFtLmdndWZfdXJsKSByZXR1cm4gJyc7XG4gIGlmICghbS5nZ3VmX2ZpbGVuYW1lKSB7XG4gICAgcmV0dXJuIGA8YSBocmVmPVwiJHtlc2NIdG1sKG0uZ2d1Zl91cmwpfVwiIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyXCI+RG93bmxvYWQgcGFnZTwvYT5gO1xuICB9XG4gIGNvbnN0IHBhcnRzID0gW107XG4gIGlmIChtLmFjdGl2ZSkge1xuICAgIHBhcnRzLnB1c2goYDxzcGFuIGNsYXNzPVwicmVjLW1vZGVsLW5vdGVcIj5JbiB1c2UgZm9yIGxvY2FsIHNjb3JpbmcuPC9zcGFuPmApO1xuICB9IGVsc2UgaWYgKG0uaW5zdGFsbGVkKSB7XG4gICAgcGFydHMucHVzaChgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidG4tc2Vjb25kYXJ5XCIgZGF0YS1hY3Q9XCJ1c2UtZ2d1ZlwiPlVzZSB0aGlzIG1vZGVsPC9idXR0b24+YCk7XG4gIH0gZWxzZSB7XG4gICAgcGFydHMucHVzaChgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidG4tc2Vjb25kYXJ5XCIgZGF0YS1hY3Q9XCJkb3dubG9hZC1nZ3VmXCI+RG93bmxvYWQgbm93PC9idXR0b24+YCk7XG4gIH1cbiAgcGFydHMucHVzaChgPGEgaHJlZj1cIiR7ZXNjSHRtbChtLmdndWZfdXJsKX1cIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lclwiPkNob29zZSBhIGRpZmZlcmVudCBmaWxlPC9hPmApO1xuICByZXR1cm4gcGFydHMuam9pbignJyk7XG59XG5cbi8vIFBvaW50IHRoZSAoYWR2YW5jZWQpIHBhdGggZmllbGRzIGF0IGFuIGFscmVhZHktcHJlc2VudCBtb2RlbCBzbyBhIHBsYWluIFNhdmVcbi8vIGFjdGl2YXRlcyBpdCAtIG5vIHJlLWRvd25sb2FkLiBBIHZpc2lvbiBlbnRyeSBmaWxscyB0aGUgdmlzaW9uIG1vZGVsICsgbW1wcm9qXG4vLyBwcm9qZWN0b3IgZmllbGRzOyBhIHRleHQgZW50cnkgZmlsbHMgdGhlIHRleHQgbW9kZWwgZmllbGQuIFRoZSB0d28gYnVja2V0c1xuLy8gYXJlIGluZGVwZW5kZW50IGNvbmZpZyBrZXlzLCBzbyBvbmUgbXVzdCBuZXZlciBvdmVyd3JpdGUgdGhlIG90aGVyLlxuZnVuY3Rpb24gX2FwcGx5TW9kZWxQYXRocyhtKSB7XG4gIGNvbnN0IGlzVmlzaW9uID0gQXJyYXkuaXNBcnJheShtLmtpbmRzKSAmJiBtLmtpbmRzLmluY2x1ZGVzKCd2aXNpb24nKTtcbiAgaWYgKGlzVmlzaW9uKSB7XG4gICAgY29uc3QgdmlzaW9uRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1sbG0tdmlzaW9uLW1vZGVsLXBhdGgnKTtcbiAgICBpZiAodmlzaW9uRWwgJiYgbS5nZ3VmX3BhdGgpIHZpc2lvbkVsLnZhbHVlID0gbS5nZ3VmX3BhdGg7XG4gICAgY29uc3QgcHJvakVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtbGxtLW1tcHJvai1wYXRoJyk7XG4gICAgaWYgKHByb2pFbCAmJiBtLm1tcHJval9wYXRoKSBwcm9qRWwudmFsdWUgPSBtLm1tcHJval9wYXRoO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHBhdGhFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzLWxsbS1tb2RlbC1wYXRoJyk7XG4gICAgaWYgKHBhdGhFbCAmJiBtLmdndWZfcGF0aCkgcGF0aEVsLnZhbHVlID0gbS5nZ3VmX3BhdGg7XG4gIH1cbiAgd2luZG93Ll9jaGVja1NldHRpbmdzRGlydHkoKTtcbn1cblxuZnVuY3Rpb24gX3VzZUdndWZNb2RlbChtb2RlbElkKSB7XG4gIGNvbnN0IG0gPSAoX21vZGVsQ2F0YWxvZyB8fCBbXSkuZmluZCh4ID0+IHguaWQgPT09IG1vZGVsSWQpO1xuICBpZiAoIW0pIHJldHVybjtcbiAgX2FwcGx5TW9kZWxQYXRocyhtKTtcbiAgc2hvd1RvYXN0KCdNb2RlbCBzZWxlY3RlZCAtIGNsaWNrIFNhdmUgdG8gYXBwbHknLCAnaW5mbycpO1xufVxuXG4vLyDilIDilIAgb25lLWNsaWNrIGxvY2FsICguZ2d1ZikgZG93bmxvYWQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBTZXJ2ZXItb3duZWQgZG93bmxvYWQgKFBPU1QgL2FwaS9sbG0vZ2d1Zi9kb3dubG9hZCkgZm9yIGEgcmVjb21tZW5kZWQgbG9jYWxcbi8vIG1vZGVsICh0ZXh0LCBvciB2aXNpb24gKyBpdHMgbW1wcm9qIHByb2plY3RvciksIHNvIGxsYW1hLmNwcCBnZXRzIGEgb25lLWNsaWNrXG4vLyBmbG93IGluc3RlYWQgb2Ygb25seSBhIFwiRG93bmxvYWQgcGFnZVwiIGxpbmsuIFNTRSArIENhbmNlbC12aWEtYWJvcnQgc3RyZWFtO1xuLy8gb24gc3VjY2VzcyB0aGUgc2VydmVyIGhhcyB3cml0dGVuIHRoZSBtb2RlbCAoYW5kIHByb2plY3RvcikgcGF0aChzKSwgc28gd2Vcbi8vIHBvaW50IHRoZSBwYXRoIGZpZWxkcyBhdCB0aGVtLCByZWZyZXNoIHRoZSByZWFkaW5lc3MgbGluZSwgYW5kIHByb21wdCBhIFNhdmUuXG5sZXQgX2dndWZBYm9ydCA9IG51bGw7XG5cbi8vIFRoZSBDTEkgcHJpbnRzIFwiRG93bmxvYWRpbmcgPG5hbWU+IC0gPGZpbGU+OiBOTiUgKHgveSBHQilcIiBsaW5lczsgcHVsbCB0aGVcbi8vIHBlcmNlbnRhZ2Ugb3V0IHRvIGRyaXZlIGEgZGV0ZXJtaW5hdGUgYmFyLiBWaXNpb24gZW50cmllcyBzdHJlYW0gdHdvIGZpbGVzIGluXG4vLyB0dXJuLCBzbyB0aGUgYmFyIHJlc2V0cyBwZXIgZmlsZSAtIGV4cGVjdGVkLCBub3QgYSBidWcuXG5mdW5jdGlvbiBfcGFyc2VHZ3VmUGN0KGxpbmUpIHtcbiAgY29uc3QgbWF0Y2ggPSAvKFxcZCspJS8uZXhlYyhsaW5lKTtcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHBjdCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gIHJldHVybiBwY3QgPj0gMCAmJiBwY3QgPD0gMTAwID8gcGN0IDogbnVsbDtcbn1cblxuZnVuY3Rpb24gX3NldEdndWZQcm9ncmVzcyhjYXJkLCB2YWx1ZSkge1xuICBjb25zdCBmaWxsID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1nZ3VmLWZpbGxdJyk7XG4gIGNvbnN0IHBjdCA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1wY3RdJyk7XG4gIGlmICghZmlsbCB8fCAhcGN0KSByZXR1cm47XG4gIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgZmlsbC5jbGFzc0xpc3QuYWRkKCdpbmRldGVybWluYXRlJyk7XG4gICAgZmlsbC5zdHlsZS53aWR0aCA9ICcnO1xuICAgIHBjdC50ZXh0Q29udGVudCA9ICcnO1xuICB9IGVsc2Uge1xuICAgIGZpbGwuY2xhc3NMaXN0LnJlbW92ZSgnaW5kZXRlcm1pbmF0ZScpO1xuICAgIGZpbGwuc3R5bGUud2lkdGggPSB2YWx1ZSArICclJztcbiAgICBwY3QudGV4dENvbnRlbnQgPSB2YWx1ZSArICclJztcbiAgfVxufVxuXG5mdW5jdGlvbiBfc2V0R2d1ZkNhbmNlbChjYXJkLCBzaG93LCBvbkNhbmNlbCkge1xuICBjb25zdCBsb2cgPSBjYXJkLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWdndWYtbG9nXScpO1xuICBpZiAoIWxvZykgcmV0dXJuO1xuICBsZXQgYnRuID0gY2FyZC5xdWVyeVNlbGVjdG9yKCdbZGF0YS1nZ3VmLWNhbmNlbF0nKTtcbiAgaWYgKHNob3cpIHtcbiAgICBpZiAoIWJ0bikge1xuICAgICAgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICBidG4uc2V0QXR0cmlidXRlKCdkYXRhLWdndWYtY2FuY2VsJywgJycpO1xuICAgICAgYnRuLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGJ0bi5jbGFzc05hbWUgPSAnYnRuLXNlY29uZGFyeSc7XG4gICAgICBidG4udGV4dENvbnRlbnQgPSAnQ2FuY2VsIGRvd25sb2FkJztcbiAgICAgIGJ0bi5zdHlsZS5tYXJnaW5Ub3AgPSAnNHB4JztcbiAgICAgIGxvZy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShidG4sIGxvZyk7XG4gICAgfVxuICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGJ0bi5vbmNsaWNrID0gb25DYW5jZWw7XG4gICAgYnRuLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgfSBlbHNlIGlmIChidG4pIHtcbiAgICBidG4uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBkb3dubG9hZEdndWZNb2RlbChtb2RlbElkLCBjYXJkKSB7XG4gIGNvbnN0IGxvZyA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1sb2ddJyk7XG4gIGNvbnN0IGJ1dHRvbiA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtYWN0PVwiZG93bmxvYWQtZ2d1ZlwiXScpO1xuICBjb25zdCBwcm9ncmVzcyA9IGNhcmQucXVlcnlTZWxlY3RvcignW2RhdGEtZ2d1Zi1wcm9ncmVzc10nKTtcbiAgaWYgKCFsb2cpIHJldHVybjtcbiAgY29uc3QgbW9kZWwgPSAoX21vZGVsQ2F0YWxvZyB8fCBbXSkuZmluZCh4ID0+IHguaWQgPT09IG1vZGVsSWQpO1xuICBsb2cuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gIGxvZy50ZXh0Q29udGVudCA9ICdTdGFydGluZyBkb3dubG9hZCAtIHRoaXMgY2FuIHRha2Ugc2V2ZXJhbCBtaW51dGVzLi4uXFxuJztcbiAgaWYgKHByb2dyZXNzKSBwcm9ncmVzcy5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gIF9zZXRHZ3VmUHJvZ3Jlc3MoY2FyZCwgbnVsbCk7XG4gIGlmIChidXR0b24pIHsgYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTsgYnV0dG9uLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkaW5nLi4uJzsgfVxuICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBfZ2d1ZkFib3J0ID0gY29udHJvbGxlcjtcbiAgX3NldEdndWZDYW5jZWwoY2FyZCwgdHJ1ZSwgKCkgPT4geyBjb250cm9sbGVyLmFib3J0KCk7IH0pO1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3AgPSBhd2FpdCBmZXRjaChgL2FwaS9sbG0vZ2d1Zi9kb3dubG9hZD9tb2RlbF9pZD0ke2VuY29kZVVSSUNvbXBvbmVudChtb2RlbElkKX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IG1ldGhvZDogJ1BPU1QnLCBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsIH0pO1xuICAgIGlmICghcmVzcC5vaykge1xuICAgICAgbGV0IGRldGFpbCA9ICcnO1xuICAgICAgdHJ5IHsgZGV0YWlsID0gKGF3YWl0IHJlc3AuanNvbigpKS5kZXRhaWwgfHwgJyc7IH0gY2F0Y2ggeyBkZXRhaWwgPSBhd2FpdCByZXNwLnRleHQoKTsgfVxuICAgICAgbG9nLnRleHRDb250ZW50ICs9IGDinJcgJHtkZXRhaWwgfHwgJ0Rvd25sb2FkIGNvdWxkIG5vdCBzdGFydC4nfVxcbmA7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJlYWRlciA9IHJlc3AuYm9keS5nZXRSZWFkZXIoKTtcbiAgICBjb25zdCBkZWMgPSBuZXcgVGV4dERlY29kZXIoKTtcbiAgICBsZXQgYnVmID0gJyc7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHsgZG9uZSwgdmFsdWUgfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG4gICAgICBpZiAoZG9uZSkgYnJlYWs7XG4gICAgICBidWYgKz0gZGVjLmRlY29kZSh2YWx1ZSwgeyBzdHJlYW06IHRydWUgfSk7XG4gICAgICBjb25zdCBsaW5lcyA9IGJ1Zi5zcGxpdCgnXFxuJyk7XG4gICAgICBidWYgPSBsaW5lcy5wb3AoKTtcbiAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aCgnZGF0YTogJykpIGNvbnRpbnVlO1xuICAgICAgICBjb25zdCBtc2cgPSBKU09OLnBhcnNlKGxpbmUuc2xpY2UoNikpO1xuICAgICAgICBpZiAobXNnID09PSAnX19ET05FX18nKSB7XG4gICAgICAgICAgX3NldEdndWZQcm9ncmVzcyhjYXJkLCAxMDApO1xuICAgICAgICAgIGxvZy50ZXh0Q29udGVudCArPSAn4pyTIERvbmUgLSBtb2RlbCBzZWxlY3RlZC4gU2F2ZSB0byBhcHBseS5cXG4nO1xuICAgICAgICAgIGlmIChtb2RlbCkgX2FwcGx5TW9kZWxQYXRocyhtb2RlbCk7XG4gICAgICAgICAgX3VwZGF0ZUxsbUNhcGFiaWxpdGllcygpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwY3QgPSBfcGFyc2VHZ3VmUGN0KG1zZyk7XG4gICAgICAgIGlmIChwY3QgIT0gbnVsbCkgX3NldEdndWZQcm9ncmVzcyhjYXJkLCBwY3QpO1xuICAgICAgICBsb2cudGV4dENvbnRlbnQgKz0gbXNnICsgJ1xcbic7XG4gICAgICAgIGxvZy5zY3JvbGxUb3AgPSBsb2cuc2Nyb2xsSGVpZ2h0O1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciAmJiBlcnIubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSBsb2cudGV4dENvbnRlbnQgKz0gJ+KWoCBEb3dubG9hZCBjYW5jZWxsZWQuXFxuJztcbiAgICBlbHNlIGxvZy50ZXh0Q29udGVudCArPSAn4pyXIERvd25sb2FkIGZhaWxlZCAtIGNoZWNrIHlvdXIgY29ubmVjdGlvbiBhbmQgdHJ5IGFnYWluLlxcbic7XG4gIH0gZmluYWxseSB7XG4gICAgX2dndWZBYm9ydCA9IG51bGw7XG4gICAgX3NldEdndWZDYW5jZWwoY2FyZCwgZmFsc2UpO1xuICAgIGlmIChwcm9ncmVzcykgcHJvZ3Jlc3Muc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBpZiAoYnV0dG9uKSB7IGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlOyBidXR0b24udGV4dENvbnRlbnQgPSAnRG93bmxvYWQgbm93JzsgfVxuICB9XG59XG5cbi8vIOKUgOKUgCBtb2RlbCByZWFkaW5lc3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBSZWFkaW5lc3Mgb2YgdGhlICpzYXZlZCogYWN0aXZlIG1vZGVsLiBSZWZsZWN0cyBjb25maWcgb24gZGlzaywgbm90IHVuc2F2ZWRcbi8vIGVkaXRzIC0gcmVmcmVzaGVkIG9uIG9wZW4gYW5kIGFmdGVyIFNhdmUuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX3VwZGF0ZUxsbUNhcGFiaWxpdGllcygpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1sbG0tY2FwYWJpbGl0aWVzJyk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgbGV0IGNhcDtcbiAgdHJ5IHtcbiAgICBjYXAgPSBhd2FpdCBmZXRjaCgnL2FwaS9sbG0vY2FwYWJpbGl0aWVzJykudGhlbihyID0+IHIuanNvbigpKTtcbiAgfSBjYXRjaCB7IGVsLnRleHRDb250ZW50ID0gJ0NvdWxkIG5vdCBjaGVjayBtb2RlbCByZWFkaW5lc3MuJzsgcmV0dXJuOyB9XG4gIGNvbnN0IG1hcmsgPSBvayA9PiBva1xuICAgID8gJzxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPuKckzwvc3Bhbj4gUmVhZHknXG4gICAgOiAnPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCI+4peLPC9zcGFuPiBOb3Qgc2V0IHVwJztcbiAgZWwuaW5uZXJIVE1MID1cbiAgICBgPHNwYW4gc3R5bGU9XCJtYXJnaW4tcmlnaHQ6MTRweFwiPlRleHQgc2NvcmluZzogJHttYXJrKGNhcC50ZXh0KX08L3NwYW4+YCArXG4gICAgYDxzcGFuPkltYWdlIGFuYWx5c2lzOiAke21hcmsoY2FwLnZpc2lvbil9PC9zcGFuPmAgK1xuICAgIGA8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiIHN0eWxlPVwibWFyZ2luLXRvcDo0cHhcIj4ke2VzY0h0bWwoY2FwLmRldGFpbCB8fCAnJyl9PC9kaXY+YDtcbiAgZWwuc3R5bGUuY29sb3IgPSBjYXAudGV4dCA/ICd2YXIoLS1ncmVlbiknIDogJ3ZhcigtLW11dGVkKSc7XG59XG5cbi8vIOKUgOKUgCBjYXBhYmlsaXRpZXMgb3ZlcnZpZXcgKFN0YWdlIDA2KSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEEgcmVhZC1vbmx5LCBhdC1hLWdsYW5jZSBtYXAgb2YgdGhlIG5vbi1MTE0gdXBncmFkZSB0aWVycy4gU291cmNlcyBlYWNoIHRpZXInc1xuLy8gYWN0aXZlIHN0YXRlICsgaW5zdGFsbCBndWlkYW5jZSBmcm9tIHRoZSBiYWNrZW5kJ3MgYXZhaWxhYmlsaXR5KCkgcmVhc29ucyB2aWFcbi8vIC9hcGkvY2FwYWJpbGl0aWVzL3RpZXJzIC0gaXQgbmV2ZXIgaW5zdGFsbHMgYW55dGhpbmcgaXRzZWxmOyBlYWNoIHJvdyBsaW5rcyB0b1xuLy8gdGhlIHNlY3Rpb24gd2hlcmUgdGhlIHJlYWwgaW5zdGFsbC9lbmFibGUgY29udHJvbCBsaXZlcy5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBfcmVuZGVyQ2FwYWJpbGl0eVRpZXJzKCkge1xuICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3MtY2FwYWJpbGl0aWVzLWxpc3QnKTtcbiAgY29uc3QgaW50cm8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncy1jYXBhYmlsaXRpZXMtaW50cm8nKTtcbiAgaWYgKCFsaXN0KSByZXR1cm47XG4gIGxldCBkYXRhO1xuICB0cnkge1xuICAgIGRhdGEgPSBhd2FpdCBmZXRjaCgnL2FwaS9jYXBhYmlsaXRpZXMvdGllcnMnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICB9IGNhdGNoIHtcbiAgICBpZiAoaW50cm8pIGludHJvLnRleHRDb250ZW50ID0gJyc7XG4gICAgbGlzdC5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj5Db3VsZCBub3QgY2hlY2sgY2FwYWJpbGl0aWVzLjwvZGl2Pic7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChpbnRybykge1xuICAgIGludHJvLnRleHRDb250ZW50ID0gZGF0YS5saWdodHdlaWdodFxuICAgICAgPyBcIk5vIGxvY2FsIG1vZGVsIGlzIHNldCB1cCB5ZXQgLSB0cmFuc2NyaXB0aW9uIGFuZCB0aGUgY29yZSBzY29yaW5nIGFyZSB3b3JraW5nLCBhbmQgY2xpcHMgZ2V0IGEgc2hvcnQgdGVtcGxhdGUgZGVzY3JpcHRpb24uIFNldHRpbmcgdXAgYSBsb2NhbCBtb2RlbCBpcyB0aGUgbm9ybWFsIG5leHQgc3RlcDogaXQgYWRkcyB3cml0dGVuIGRlc2NyaXB0aW9ucywgc2Vzc2lvbiBzdW1tYXJpZXMsIGFuZCBhIHNtYXJ0ZXIgcmVhZCBvbiBzY29yaW5nLlwiXG4gICAgICA6IFwiSGVyZSdzIHdoYXQgZWFjaCBwYXJ0IG9mIFl1dUNsaXAgaXMgdXNpbmcgcmlnaHQgbm93LCBhbmQgd2hhdCB5b3UgY2FuIHVwZ3JhZGUuXCI7XG4gIH1cbiAgbGlzdC5pbm5lckhUTUwgPSAoZGF0YS50aWVycyB8fCBbXSkubWFwKF9jYXBhYmlsaXR5VGllckh0bWwpLmpvaW4oJycpO1xuICBsaXN0LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXNlY3Rpb25dJykuZm9yRWFjaChidG4gPT4ge1xuICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHdpbmRvdy5fc2Nyb2xsVG9TZXR0aW5nc1NlY3Rpb24oYnRuLmdldEF0dHJpYnV0ZSgnZGF0YS1zZWN0aW9uJykpKTtcbiAgfSk7XG4gIGxpc3QucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtcHJlZmV0Y2hdJykuZm9yRWFjaChidG4gPT4ge1xuICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHByZWZldGNoTW9kZWwoYnRuLmdldEF0dHJpYnV0ZSgnZGF0YS1wcmVmZXRjaCcpLCBidG4uZ2V0QXR0cmlidXRlKCdkYXRhLXRpZXItaWQnKSkpO1xuICB9KTtcbn1cblxuLy8gRm91ciB2aXN1YWwgc3RhdGVzLCBub3QgdHdvOiBhIHRpZXIgY2FuIGJlIGZ1bGx5IFJlYWR5IChncmVlbiBjaGVjayksIHdhaXRpbmdcbi8vIG9uIGEgVGllci1CIG1vZGVsIGl0IGNhbiBmZXRjaCByaWdodCBub3cgKHByZWZldGNoX3NsdWcgc2V0IC0gXCJEb3dubG9hZCBub3dcIiksXG4vLyB3YWl0aW5nIG9uIGEgVGllci1CIG1vZGVsIHRvbyBzbWFsbCB0byBib3RoZXIgd2l0aCBhIHByb2dyZXNzIFVJIChuZXV0cmFsLCBub1xuLy8gQ1RBKSwgb3IgZ2VudWluZWx5IG5lZWQgYSByZWFsIHNldHVwIHN0ZXAgKGluc3RhbGxfc2x1ZyBzZXQgLSBlLmcuIFB5YW5ub3RlXG4vLyBuZWVkcyBhIHBpcCBpbnN0YWxsICsgSHVnZ2luZ0ZhY2UgdG9rZW4sIHNob3duIGFzIFwiU2V0IHVwIOKGklwiKS5cbmZ1bmN0aW9uIF9jYXBhYmlsaXR5VGllckh0bWwodGllcikge1xuICBjb25zdCBuZWVkc1NldHVwID0gIXRpZXIucmVhZHkgJiYgISF0aWVyLmluc3RhbGxfc2x1ZztcbiAgY29uc3QgbmVlZHNQcmVmZXRjaCA9ICF0aWVyLnJlYWR5ICYmICFuZWVkc1NldHVwICYmICEhdGllci5wcmVmZXRjaF9zbHVnO1xuICBjb25zdCBtYXJrID0gdGllci5yZWFkeSA/ICfinJMnIDogKG5lZWRzU2V0dXAgfHwgbmVlZHNQcmVmZXRjaCA/ICfil4snIDogJyYjODk0MzsnKTtcbiAgY29uc3QgbWFya0NsYXNzID0gdGllci5yZWFkeSA/ICcgcmVhZHknIDogJyc7XG4gIGxldCBhY3Rpb24gPSAnJztcbiAgaWYgKG5lZWRzU2V0dXApIHtcbiAgICBhY3Rpb24gPSBgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJzZXR0aW5ncy1qdW1wLWxpbmtcIiBkYXRhLXNlY3Rpb249XCIke2VzY0h0bWwodGllci5zZWN0aW9uKX1cIiBzdHlsZT1cIm1hcmdpbi10b3A6MnB4XCI+U2V0IHVwICZyYXJyOzwvYnV0dG9uPmA7XG4gIH0gZWxzZSBpZiAobmVlZHNQcmVmZXRjaCkge1xuICAgIGFjdGlvbiA9XG4gICAgICBgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJidG4tc2Vjb25kYXJ5XCIgZGF0YS1wcmVmZXRjaD1cIiR7ZXNjSHRtbCh0aWVyLnByZWZldGNoX3NsdWcpfVwiIGRhdGEtdGllci1pZD1cIiR7ZXNjSHRtbCh0aWVyLmlkKX1cIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+RG93bmxvYWQgbm93PC9idXR0b24+YCArXG4gICAgICBgPGRpdiBpZD1cImNhcC1wcmVmZXRjaC1sb2ctJHtlc2NIdG1sKHRpZXIuaWQpfVwiIGNsYXNzPVwic2V0dGluZ3MtaW5zdGFsbC1sb2dcIj48L2Rpdj5gO1xuICB9XG4gIHJldHVybiAoXG4gICAgYDxkaXYgY2xhc3M9XCJjYXBhYmlsaXR5LXRpZXJcIj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwiY2FwYWJpbGl0eS10aWVyLWhlYWRcIj5gICtcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiY2FwYWJpbGl0eS1tYXJrJHttYXJrQ2xhc3N9XCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+JHttYXJrfTwvc3Bhbj5gICtcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiY2FwYWJpbGl0eS10aWVyLW5hbWVcIj4ke2VzY0h0bWwodGllci5uYW1lKX08L3NwYW4+YCArXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImNhcGFiaWxpdHktdGllci1hY3RpdmVcIj4ke2VzY0h0bWwodGllci5hY3RpdmUpfTwvc3Bhbj5gICtcbiAgICAgIGA8L2Rpdj5gICtcbiAgICAgIGA8ZGl2IGNsYXNzPVwic2V0dGluZ3Mtbm90ZVwiPiR7ZXNjSHRtbCh0aWVyLnB1cnBvc2UpfTwvZGl2PmAgK1xuICAgICAgYDxkaXYgY2xhc3M9XCJzZXR0aW5ncy1ub3RlXCI+JHtlc2NIdG1sKHRpZXIudXBncmFkZSl9PC9kaXY+YCArXG4gICAgICAodGllci5kZXRhaWwgPyBgPGRpdiBjbGFzcz1cInNldHRpbmdzLW5vdGVcIj4ke2VzY0h0bWwodGllci5kZXRhaWwpfTwvZGl2PmAgOiAnJykgK1xuICAgICAgYWN0aW9uICtcbiAgICBgPC9kaXY+YFxuICApO1xufVxuXG4vLyDilIDilIAgVGllci1CIG1vZGVsIHByZWZldGNoIChcIkRvd25sb2FkIG5vd1wiKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIE9uZSBmbG93IGZvciBldmVyeSBub24tTExNIFRpZXItQiBtb2RlbCAoc3BlYWtlci9hdWRpby1ldmVudC9lbWJlZGRpbmdzKSAtXG4vLyB0aGUgc2FtZSBTU0UgKyBDYW5jZWwgKyBsb2cgcGF0dGVybiBhcyB0aGUgLmdndWYgZG93bmxvYWQgYWJvdmUuIFRoZSBsb2NhbFxuLy8gLmdndWYgTExNIG1vZGVsIGtlZXBzIGl0cyBvd24gc2VwYXJhdGUgZG93bmxvYWQgZmxvdy5cbmNvbnN0IF9QUkVGRVRDSF9MQUJFTFMgPSB7XG4gIHNwZWFrZXI6ICd0aGUgc3BlYWtlciBtb2RlbCAofjgwIE1CKScsXG4gIGF1ZGlvX2V2ZW50OiAndGhlIGF1ZGlvLWV2ZW50IG1vZGVsICh+MzUwIE1CKScsXG4gIGVtYmVkZGluZ3M6ICd0aGUgZW1iZWRkaW5ncyBtb2RlbCAofjEzMCBNQiknLFxufTtcblxubGV0IF9wcmVmZXRjaEFib3J0ID0gbnVsbDtcblxuZnVuY3Rpb24gX3NldFByZWZldGNoQ2FuY2VsKHRpZXJJZCwgc2hvdywgb25DYW5jZWwpIHtcbiAgY29uc3QgbG9nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGNhcC1wcmVmZXRjaC1sb2ctJHt0aWVySWR9YCk7XG4gIGlmICghbG9nKSByZXR1cm47XG4gIGxldCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgY2FwLXByZWZldGNoLWNhbmNlbC0ke3RpZXJJZH1gKTtcbiAgaWYgKHNob3cpIHtcbiAgICBpZiAoIWJ0bikge1xuICAgICAgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICBidG4uaWQgPSBgY2FwLXByZWZldGNoLWNhbmNlbC0ke3RpZXJJZH1gO1xuICAgICAgYnRuLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGJ0bi5jbGFzc05hbWUgPSAnYnRuLXNlY29uZGFyeSc7XG4gICAgICBidG4udGV4dENvbnRlbnQgPSAnQ2FuY2VsIGRvd25sb2FkJztcbiAgICAgIGJ0bi5zdHlsZS5tYXJnaW5Ub3AgPSAnNHB4JztcbiAgICAgIGxvZy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShidG4sIGxvZyk7XG4gICAgfVxuICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGJ0bi5vbmNsaWNrID0gb25DYW5jZWw7XG4gICAgYnRuLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgfSBlbHNlIGlmIChidG4pIHtcbiAgICBidG4uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBwcmVmZXRjaE1vZGVsKHNsdWcsIHRpZXJJZCkge1xuICBjb25zdCBsb2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgY2FwLXByZWZldGNoLWxvZy0ke3RpZXJJZH1gKTtcbiAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgW2RhdGEtcHJlZmV0Y2g9XCIke0NTUy5lc2NhcGUoc2x1Zyl9XCJdYCk7XG4gIGlmICghbG9nKSByZXR1cm47XG4gIGxvZy5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgbG9nLnRleHRDb250ZW50ID0gYERvd25sb2FkaW5nICR7X1BSRUZFVENIX0xBQkVMU1tzbHVnXSB8fCBzbHVnfeKAplxcbmA7XG4gIGlmIChidXR0b24pIHsgYnV0dG9uLmRpc2FibGVkID0gdHJ1ZTsgYnV0dG9uLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkaW5n4oCmJzsgfVxuICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICBfcHJlZmV0Y2hBYm9ydCA9IGNvbnRyb2xsZXI7XG4gIF9zZXRQcmVmZXRjaENhbmNlbCh0aWVySWQsIHRydWUsICgpID0+IHsgY29udHJvbGxlci5hYm9ydCgpOyB9KTtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXNwID0gYXdhaXQgZmV0Y2goYC9hcGkvbW9kZWxzL3ByZWZldGNoP3NsdWc9JHtlbmNvZGVVUklDb21wb25lbnQoc2x1Zyl9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBtZXRob2Q6ICdQT1NUJywgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICBpZiAoIXJlc3Aub2spIHtcbiAgICAgIGxldCBkZXRhaWwgPSAnJztcbiAgICAgIHRyeSB7IGRldGFpbCA9IChhd2FpdCByZXNwLmpzb24oKSkuZGV0YWlsIHx8ICcnOyB9IGNhdGNoIHsgZGV0YWlsID0gYXdhaXQgcmVzcC50ZXh0KCk7IH1cbiAgICAgIGxvZy50ZXh0Q29udGVudCArPSBg4pyXICR7ZGV0YWlsIHx8ICdEb3dubG9hZCBjb3VsZCBub3Qgc3RhcnQuJ31cXG5gO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCByZWFkZXIgPSByZXNwLmJvZHkuZ2V0UmVhZGVyKCk7XG4gICAgY29uc3QgZGVjID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgbGV0IGJ1ZiA9ICcnO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCB7IGRvbmUsIHZhbHVlIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuICAgICAgaWYgKGRvbmUpIGJyZWFrO1xuICAgICAgYnVmICs9IGRlYy5kZWNvZGUodmFsdWUsIHsgc3RyZWFtOiB0cnVlIH0pO1xuICAgICAgY29uc3QgbGluZXMgPSBidWYuc3BsaXQoJ1xcbicpO1xuICAgICAgYnVmID0gbGluZXMucG9wKCk7XG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgbGluZXMpIHtcbiAgICAgICAgaWYgKCFsaW5lLnN0YXJ0c1dpdGgoJ2RhdGE6ICcpKSBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbXNnID0gSlNPTi5wYXJzZShsaW5lLnNsaWNlKDYpKTtcbiAgICAgICAgaWYgKG1zZyA9PT0gJ19fRE9ORV9fJykge1xuICAgICAgICAgIGxvZy50ZXh0Q29udGVudCArPSAn4pyTIFJlYWR5Llxcbic7XG4gICAgICAgICAgX3JlbmRlckNhcGFiaWxpdHlUaWVycygpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsb2cudGV4dENvbnRlbnQgKz0gbXNnICsgJ1xcbic7XG4gICAgICAgIGxvZy5zY3JvbGxUb3AgPSBsb2cuc2Nyb2xsSGVpZ2h0O1xuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGVyciAmJiBlcnIubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSBsb2cudGV4dENvbnRlbnQgKz0gJ+KWoCBEb3dubG9hZCBjYW5jZWxsZWQuXFxuJztcbiAgICBlbHNlIGxvZy50ZXh0Q29udGVudCArPSAn4pyXIERvd25sb2FkIGZhaWxlZCAtIGNoZWNrIHlvdXIgY29ubmVjdGlvbiBhbmQgdHJ5IGFnYWluLlxcbic7XG4gIH0gZmluYWxseSB7XG4gICAgX3ByZWZldGNoQWJvcnQgPSBudWxsO1xuICAgIF9zZXRQcmVmZXRjaENhbmNlbCh0aWVySWQsIGZhbHNlKTtcbiAgICBpZiAoYnV0dG9uKSB7IGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlOyBidXR0b24udGV4dENvbnRlbnQgPSAnRG93bmxvYWQgbm93JzsgfVxuICB9XG59XG5cbi8vIEdhdGUgYSBjb250cm9sIG9uIGEgbW9kZWwgY2FwYWJpbGl0eSAoXCJ0ZXh0XCIgfCBcInZpc2lvblwiKSBmcm9tXG4vLyAvYXBpL2xsbS9jYXBhYmlsaXRpZXMuIERpc2FibGVzIHRoZSBlbGVtZW50IGFuZCBhcHBlbmRzIGEgbGlua2VkIGV4cGxhbmF0aW9uXG4vLyB3aGVuIHRoZSBjYXBhYmlsaXR5IGlzIHVuYXZhaWxhYmxlOyB1c2VkIGJ5IGltYWdlLWFuYWx5c2lzIGNvbnRyb2xzIChwbGFuIDExKS5cbi8vIFJldHVybnMgdGhlIHJlc29sdmVkIGNhcGFiaWxpdGllcyBvYmplY3QuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2F0ZU9uQ2FwYWJpbGl0eShlbCwgY2FwYWJpbGl0eSwgbWVzc2FnZSkge1xuICBsZXQgY2FwO1xuICB0cnkge1xuICAgIGNhcCA9IGF3YWl0IGZldGNoKCcvYXBpL2xsbS9jYXBhYmlsaXRpZXMnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICB9IGNhdGNoIHsgY2FwID0geyB0ZXh0OiBmYWxzZSwgdmlzaW9uOiBmYWxzZSwgZGV0YWlsOiAnJyB9OyB9XG4gIGNvbnN0IG9rID0gISFjYXBbY2FwYWJpbGl0eV07XG4gIGVsLmRpc2FibGVkID0gIW9rO1xuICBsZXQgbm90ZSA9IGVsLnBhcmVudEVsZW1lbnQ/LnF1ZXJ5U2VsZWN0b3IoJy5nYXRlLW5vdGUnKTtcbiAgaWYgKCFvaykge1xuICAgIGlmICghbm90ZSkge1xuICAgICAgbm90ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgbm90ZS5jbGFzc05hbWUgPSAnZ2F0ZS1ub3RlJztcbiAgICAgIGVsLnBhcmVudEVsZW1lbnQ/LmFwcGVuZENoaWxkKG5vdGUpO1xuICAgIH1cbiAgICBub3RlLmlubmVySFRNTCA9IGAke2VzY0h0bWwobWVzc2FnZSl9IDxhIGhyZWY9XCIjXCIgb25jbGljaz1cIm9wZW5TZXR0aW5ncygpO3JldHVybiBmYWxzZVwiPk9wZW4gU2V0dGluZ3M8L2E+YDtcbiAgfSBlbHNlIGlmIChub3RlKSB7XG4gICAgbm90ZS5yZW1vdmUoKTtcbiAgfVxuICByZXR1cm4gY2FwO1xufVxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUmVjb3JkaW5ncyBsaXN0ICsgZGV0YWlsIChjb2RlOiB2aWRlbyAvIFZpZGVvKS5cbi8vICAgQVBJOiByb3V0ZXMvdmlkZW9zLnB5IMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3ZpZGVvLnB5LCB0ZXN0cy9pbnRlZ3JhdGlvbi90ZXN0X3ZpZGVvcy5weVxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7XG4gIGVzY0h0bWwsIHBsdXJhbCwgX2ZtdFZpZGVvU3RhdHVzLCBfbXNUb0htcywgX2ZtdERhdGUsIF9wYXJzZVNlcnZlckRhdGUsIF9mbXRFbGFwc2VkLCBmb3JtYXRBcGlFcnJvcixcbn0gZnJvbSAnLi9mb3JtYXQuanMnO1xuaW1wb3J0IHsgY29sbGFwc2libGVDYXJkLCBzaG93VG9hc3QsIG5ldEVyck1zZywgcmV2ZWFsSW5Gb2xkZXIsIF9zeW5jU29ydERpckJ0biwgb3BlbkxvZywgYXBwZW5kTG9nIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBzaG93Q29uZmlybSwgb3BlbkZpZWxkRWRpdE1vZGFsLCBvcGVuRGlmZk1vZGFsLCBzaG93S2ViYWIsIG9wZW5BY3Rpb25zTW9kYWwgfSBmcm9tICcuL3VpLmpzJztcbmltcG9ydCB7IHNldHVwUmVjb3JkaW5nUHJldmlldyB9IGZyb20gJy4vcHJldmlldy5qcyc7XG5pbXBvcnQgeyBzdHJlYW1TU0UsIGNhbmNlbEpvYiwgX2Jsb2NrZWRCeUFuYWx5emUsIF9zdGVwUGlsbExhYmVsIH0gZnJvbSAnLi9qb2JzLmpzJztcbmltcG9ydCB7IG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsIH0gZnJvbSAnLi9oZWxwbW9kYWxzLmpzJztcbi8vIOKUgOKUgCB2aWRlb3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5hc3luYyBmdW5jdGlvbiBsb2FkVmlkZW9zKCkge1xuICBsZXQgdmlkZW9zO1xuICB0cnkge1xuICAgIGNvbnN0IFt2aWRlb3NSZXMsIHNlc3Npb25zXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIGZldGNoKCcvYXBpL3ZpZGVvcycpLFxuICAgICAgZmV0Y2goJy9hcGkvc2Vzc2lvbnMnKS50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogW10pLmNhdGNoKCgpID0+IFtdKSxcbiAgICBdKTtcbiAgICBpZiAoIXZpZGVvc1Jlcy5vaykgdGhyb3cgbmV3IEVycm9yKGBTZXJ2ZXIgZXJyb3IgJHt2aWRlb3NSZXMuc3RhdHVzfWApO1xuICAgIHZpZGVvcyA9IGF3YWl0IHZpZGVvc1Jlcy5qc29uKCk7XG4gICAgQXBwU3RhdGUuc2Vzc2lvbnMgPSBzZXNzaW9ucztcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZGVvLWxpc3QnKS5pbm5lckhUTUwgPVxuICAgICAgYDxsaSBzdHlsZT1cInBhZGRpbmc6MTBweCAxNHB4O2NvbG9yOnZhcigtLXJlZClcIj5GYWlsZWQgdG8gbG9hZCByZWNvcmRpbmdzOiAke2VzY0h0bWwoU3RyaW5nKGVyci5tZXNzYWdlIHx8IGVycikpfTwvbGk+YDtcbiAgICByZXR1cm47XG4gIH1cbiAgQXBwU3RhdGUudmlkZW9zID0gdmlkZW9zO1xuXG4gIC8vIFdoaWxlIGEgYnJhbmQtbmV3IHJlY29yZGluZyBpcyBhbmFseXppbmcsIHNob3cgaXQgaW4gdGhlIHNpZGViYXIgcmlnaHQgYXdheSAtXG4gIC8vIGJlZm9yZSBpdHMgREIgcm93IGV4aXN0cyAtIHNvIHRoZSB1c2VyIGdldHMgaW1tZWRpYXRlIGZlZWRiYWNrLiBTdXBwcmVzc2VkXG4gIC8vIG9uY2UgdGhlIHJlYWwgcm93IGFwcGVhcnMgKG1hdGNoZWQgYnkgZmlsZW5hbWUpLlxuICBjb25zdCBhbmFseXppbmdOYW1lID0gQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lO1xuICBjb25zdCBzaG93UGxhY2Vob2xkZXIgPSBhbmFseXppbmdOYW1lICYmICF2aWRlb3Muc29tZSh2ID0+IHYuZmlsZW5hbWUgPT09IGFuYWx5emluZ05hbWUpO1xuXG4gIGlmICghdmlkZW9zLmxlbmd0aCAmJiAhc2hvd1BsYWNlaG9sZGVyKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZGVvLWxpc3QnKS5pbm5lckhUTUwgPVxuICAgICAgJzxsaSBzdHlsZT1cInBhZGRpbmc6MTBweCAxNHB4O2NvbG9yOnZhcigtLW11dGVkKVwiPk5vIHJlY29yZGluZ3MgeWV0PC9saT4nO1xuICAgIF9zaG93RW1wdHlTdGF0ZSgpO1xuICAgIF91cGRhdGVEZW1vQnV0dG9uKDApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbiAgX3VwZGF0ZURlbW9CdXR0b24odmlkZW9zLnJlZHVjZSgobiwgdikgPT4gbiArIHYuYXBwcm92ZWQsIDApKTtcblxuICBpZiAoIUFwcFN0YXRlLmJvb3RSZXN0b3JlRG9uZSkge1xuICAgIEFwcFN0YXRlLmJvb3RSZXN0b3JlRG9uZSA9IHRydWU7XG4gICAgX3Jlc3RvcmVWaWV3KCk7XG4gIH1cbn1cblxuLy8gQ2xpZW50LXNpZGUgc2VhcmNoICsgZmlsdGVyICsgc29ydCBvdmVyIEFwcFN0YXRlLnZpZGVvcyBmb3IgdGhlIHNpZGViYXIgbGlzdC5cbmZ1bmN0aW9uIF9hcHBseVZpZGVvRmlsdGVycyh2aWRlb3MpIHtcbiAgbGV0IHJlc3VsdCA9IHZpZGVvcy5zbGljZSgpO1xuICBjb25zdCBxID0gKEFwcFN0YXRlLnZpZGVvU2VhcmNoIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAocSkgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcih2ID0+XG4gICAgKHYudGl0bGUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHwgKHYuZmlsZW5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpO1xuICBjb25zdCBmID0gQXBwU3RhdGUudmlkZW9GaWx0ZXJzO1xuICBpZiAoZiAmJiBmLnNpemUpIHtcbiAgICBpZiAoZi5oYXMoJ2hhcy1jbGlwcycpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKHYgPT4gdi5jbGlwX2NvdW50ID4gMCk7XG4gICAgaWYgKGYuaGFzKCd1bnNjb3JlZCcpKSAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcih2ID0+ICF2LmNsaXBzX3Njb3JlZF9hdCk7XG4gICAgaWYgKGYuaGFzKCdlcnJvcnMnKSkgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcih2ID0+ICh2LmNsaXBzX2xsbV9lcnJvciB8fCAwKSA+IDApO1xuICB9XG4gIGNvbnN0IHNvcnQgPSBBcHBTdGF0ZS52aWRlb1NvcnQgfHwgJ3JlY2VudCc7XG4gIGlmIChzb3J0ID09PSAndGl0bGUnKSAgICAgICByZXN1bHQuc29ydCgoYSwgYikgPT4gKGEudGl0bGUgfHwgYS5maWxlbmFtZSB8fCAnJykubG9jYWxlQ29tcGFyZShiLnRpdGxlIHx8IGIuZmlsZW5hbWUgfHwgJycpKTtcbiAgZWxzZSBpZiAoc29ydCA9PT0gJ2ZpbGVuYW1lJykgcmVzdWx0LnNvcnQoKGEsIGIpID0+IChhLmZpbGVuYW1lIHx8ICcnKS5sb2NhbGVDb21wYXJlKGIuZmlsZW5hbWUgfHwgJycsIHVuZGVmaW5lZCwgeyBudW1lcmljOiB0cnVlIH0pKTtcbiAgZWxzZSBpZiAoc29ydCA9PT0gJ2xlbmd0aCcpIHJlc3VsdC5zb3J0KChhLCBiKSA9PiAoYi5kdXJhdGlvbl9tcyB8fCAwKSAtIChhLmR1cmF0aW9uX21zIHx8IDApKTtcbiAgZWxzZSBpZiAoc29ydCA9PT0gJ2NsaXBzJykgIHJlc3VsdC5zb3J0KChhLCBiKSA9PiAoYi5jbGlwX2NvdW50IHx8IDApIC0gKGEuY2xpcF9jb3VudCB8fCAwKSk7XG4gIC8vICdyZWNlbnQnIGtlZXBzIHRoZSBzZXJ2ZXIgb3JkZXIgKGNyZWF0ZWRfYXQgZGVzYykuXG4gIGlmICgoQXBwU3RhdGUudmlkZW9Tb3J0RGlyIHx8ICdkZXNjJykgPT09ICdhc2MnKSByZXN1bHQucmV2ZXJzZSgpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBQZXItZmlsdGVyIGNvdW50cyBzaG93biBpbmxpbmUgb24gdGhlIHJlY29yZGluZyBmaWx0ZXIgY2hpcHMgKFwiVW5zY29yZWQgNFwiKS5cbi8vIENvdW50cyByZWZsZWN0IGV2ZXJ5IGxvYWRlZCByZWNvcmRpbmcsIG5vdCB0aGUgc2VhcmNoLW5hcnJvd2VkIHN1YnNldCwgYW5kIHVzZVxuLy8gdGhlIHNhbWUgcHJlZGljYXRlcyBhcyBfYXBwbHlWaWRlb0ZpbHRlcnMuIEJsYW5rIHdoZW4gdGhlcmUgYXJlIG5vIHJlY29yZGluZ3MuXG5mdW5jdGlvbiBfcmVuZGVyVmlkZW9GaWx0ZXJDb3VudHMoKSB7XG4gIGNvbnN0IHNldENvdW50ID0gKGtleSwgdmFsdWUpID0+IHtcbiAgICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYC5jbGlwLWNoaXAtY291bnRbZGF0YS12Y291bnQ9XCIke2tleX1cIl1gKTtcbiAgICBpZiAoYmFkZ2UpIGJhZGdlLnRleHRDb250ZW50ID0gdmFsdWUgPT0gbnVsbCA/ICcnIDogU3RyaW5nKHZhbHVlKTtcbiAgfTtcbiAgY29uc3QgdmlkZW9zID0gQXBwU3RhdGUudmlkZW9zIHx8IFtdO1xuICBpZiAoIXZpZGVvcy5sZW5ndGgpIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBbJ2FsbCcsICdoYXMtY2xpcHMnLCAndW5zY29yZWQnLCAnZXJyb3JzJ10pIHNldENvdW50KGtleSwgbnVsbCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHNldENvdW50KCdhbGwnLCB2aWRlb3MubGVuZ3RoKTtcbiAgc2V0Q291bnQoJ2hhcy1jbGlwcycsIHZpZGVvcy5maWx0ZXIodiA9PiB2LmNsaXBfY291bnQgPiAwKS5sZW5ndGgpO1xuICBzZXRDb3VudCgndW5zY29yZWQnLCB2aWRlb3MuZmlsdGVyKHYgPT4gIXYuY2xpcHNfc2NvcmVkX2F0KS5sZW5ndGgpO1xuICBzZXRDb3VudCgnZXJyb3JzJywgdmlkZW9zLmZpbHRlcih2ID0+ICh2LmNsaXBzX2xsbV9lcnJvciB8fCAwKSA+IDApLmxlbmd0aCB8fCBudWxsKTtcbn1cblxuLy8gUmVidWlsZHMgdGhlIHNpZGViYXIgdmlkZW8gbGlzdCBmcm9tIEFwcFN0YXRlLnZpZGVvcywgYXBwbHlpbmcgdGhlIGFjdGl2ZVxuLy8gc2VhcmNoL2ZpbHRlci9zb3J0LiBDYWxsZWQgYnkgbG9hZFZpZGVvcyAoYWZ0ZXIgZmV0Y2gpIGFuZCBieSB0aGUgY29udHJvbHMuXG5mdW5jdGlvbiBfcmVuZGVyVmlkZW9MaXN0KCkge1xuICBfcmVuZGVyVmlkZW9GaWx0ZXJDb3VudHMoKTtcbiAgY29uc3QgbGlzdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2aWRlby1saXN0Jyk7XG4gIGxpc3QuaW5uZXJIVE1MID0gJyc7XG4gIGNvbnN0IGFuYWx5emluZ05hbWUgPSBBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWU7XG4gIGNvbnN0IHNob3dQbGFjZWhvbGRlciA9IGFuYWx5emluZ05hbWUgJiYgIUFwcFN0YXRlLnZpZGVvcy5zb21lKHYgPT4gdi5maWxlbmFtZSA9PT0gYW5hbHl6aW5nTmFtZSk7XG4gIGlmIChzaG93UGxhY2Vob2xkZXIpIGxpc3QuYXBwZW5kQ2hpbGQoX2FuYWx5emluZ1BsYWNlaG9sZGVyTGkoYW5hbHl6aW5nTmFtZSkpO1xuXG4gIGNvbnN0IHNob3duID0gX2FwcGx5VmlkZW9GaWx0ZXJzKEFwcFN0YXRlLnZpZGVvcyk7XG4gIGlmICghc2hvd24ubGVuZ3RoICYmICFzaG93UGxhY2Vob2xkZXIpIHtcbiAgICBjb25zdCBoYXNGaWx0ZXIgPSBBcHBTdGF0ZS52aWRlb1NlYXJjaCB8fCAoQXBwU3RhdGUudmlkZW9GaWx0ZXJzICYmIEFwcFN0YXRlLnZpZGVvRmlsdGVycy5zaXplKTtcbiAgICBsaXN0LmlubmVySFRNTCA9IGhhc0ZpbHRlclxuICAgICAgPyBgPGxpIHN0eWxlPVwicGFkZGluZzoxMHB4IDE0cHg7Y29sb3I6dmFyKC0tbXV0ZWQpXCI+Tm8gcmVjb3JkaW5ncyBtYXRjaCAtIDxhIGhyZWY9XCIjXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS1hY2NlbnQpO3RleHQtZGVjb3JhdGlvbjp1bmRlcmxpbmVcIiBkYXRhLWFjdD1cImNsZWFyLXZpZGVvLWZpbHRlcnNcIj5DbGVhciBmaWx0ZXJzPC9hPjwvbGk+YFxuICAgICAgOiAnPGxpIHN0eWxlPVwicGFkZGluZzoxMHB4IDE0cHg7Y29sb3I6dmFyKC0tbXV0ZWQpXCI+Tm8gcmVjb3JkaW5ncyB5ZXQ8L2xpPic7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgX3JlbmRlckdyb3VwZWRWaWRlb0l0ZW1zKGxpc3QsIHNob3duLCBhbmFseXppbmdOYW1lKTtcblxuICBjb25zdCBfaGFuZGxlVmlkZW9MaXN0QWN0aXZhdGUgPSBlID0+IHtcbiAgICBjb25zdCBjbGVhckxpbmsgPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1hY3Q9XCJjbGVhci12aWRlby1maWx0ZXJzXCJdJyk7XG4gICAgaWYgKGNsZWFyTGluaykgeyBlLnByZXZlbnREZWZhdWx0KCk7IF9jbGVhclZpZGVvRmlsdGVycygpOyByZXR1cm47IH1cbiAgICBjb25zdCBsaSA9IGUudGFyZ2V0LmNsb3Nlc3QoJ2xpW2RhdGEtdmlkZW8taWRdJyk7XG4gICAgaWYgKCFsaSkgcmV0dXJuO1xuICAgIGNvbnN0IHZpZGVvSWQgPSBwYXJzZUludChsaS5kYXRhc2V0LnZpZGVvSWQpO1xuICAgIGlmICh3aW5kb3cuU2Vzc2lvblVJICYmIHdpbmRvdy5TZXNzaW9uVUkuc2VsZWN0aW9uTW9kZSkgeyB3aW5kb3cudG9nZ2xlR3JvdXBTZWxlY3QodmlkZW9JZCk7IHJldHVybjsgfVxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyN2aWRlby1saXN0IGxpJykuZm9yRWFjaChsID0+IGwuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJykpO1xuICAgIGxpLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xuICAgIHNlbGVjdFZpZGVvKHZpZGVvSWQpO1xuICB9O1xuICBsaXN0Lm9uY2xpY2sgPSBfaGFuZGxlVmlkZW9MaXN0QWN0aXZhdGU7XG4gIGxpc3Qub25rZXlkb3duID0gZSA9PiB7IGlmIChlLmtleSA9PT0gJ0VudGVyJyB8fCBlLmtleSA9PT0gJyAnKSB7IGUucHJldmVudERlZmF1bHQoKTsgX2hhbmRsZVZpZGVvTGlzdEFjdGl2YXRlKGUpOyB9IH07XG59XG5cbi8vIFJlbmRlcnMgdGhlIHNpZGViYXIgbGlzdCBncm91cGVkIGJ5IHNlc3Npb246IGEgc2Vzc2lvbidzIHNob3duIG1lbWJlcnMgYXBwZWFyXG4vLyB0b2dldGhlciB1bmRlciBhIGNvbGxhcHNpYmxlIGhlYWRlciwgYW5jaG9yZWQgYXQgdGhlIHNvcnQgcG9zaXRpb24gb2YgdGhlaXJcbi8vIGZpcnN0LWFwcGVhcmluZyBtZW1iZXI7IHVuZ3JvdXBlZCByZWNvcmRpbmdzIHJlbmRlciBpbmxpbmUuXG5mdW5jdGlvbiBfcmVuZGVyR3JvdXBlZFZpZGVvSXRlbXMobGlzdCwgc2hvd24sIGFuYWx5emluZ05hbWUpIHtcbiAgY29uc3Qgc2Vzc2lvbkJ5SWQgPSBuZXcgTWFwKChBcHBTdGF0ZS5zZXNzaW9ucyB8fCBbXSkubWFwKHMgPT4gW3MuaWQsIHNdKSk7XG4gIGNvbnN0IHJlbmRlcmVkU2Vzc2lvbnMgPSBuZXcgU2V0KCk7XG4gIGZvciAoY29uc3QgdiBvZiBzaG93bikge1xuICAgIGNvbnN0IHNlc3Npb24gPSB2LnNlc3Npb25faWQgIT0gbnVsbCA/IHNlc3Npb25CeUlkLmdldCh2LnNlc3Npb25faWQpIDogbnVsbDtcbiAgICBpZiAoc2Vzc2lvbiAmJiAhcmVuZGVyZWRTZXNzaW9ucy5oYXMoc2Vzc2lvbi5pZCkpIHtcbiAgICAgIHJlbmRlcmVkU2Vzc2lvbnMuYWRkKHNlc3Npb24uaWQpO1xuICAgICAgY29uc3QgbWVtYmVycyA9IHNob3duLmZpbHRlcih4ID0+IHguc2Vzc2lvbl9pZCA9PT0gc2Vzc2lvbi5pZCk7XG4gICAgICBsaXN0LmFwcGVuZENoaWxkKHdpbmRvdy5zZXNzaW9uR3JvdXBIZWFkZXJMaShzZXNzaW9uLCBtZW1iZXJzLmxlbmd0aCkpO1xuICAgICAgaWYgKCF3aW5kb3cuaXNTZXNzaW9uQ29sbGFwc2VkKHNlc3Npb24uaWQpKSB7XG4gICAgICAgIGZvciAoY29uc3QgbSBvZiBtZW1iZXJzKSBsaXN0LmFwcGVuZENoaWxkKF92aWRlb0l0ZW1MaShtLCBhbmFseXppbmdOYW1lLCB0cnVlKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghc2Vzc2lvbikge1xuICAgICAgbGlzdC5hcHBlbmRDaGlsZChfdmlkZW9JdGVtTGkodiwgYW5hbHl6aW5nTmFtZSwgZmFsc2UpKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gQnVpbGRzIG9uZSByZWNvcmRpbmcgPGxpPi4gaW5TZXNzaW9uIGluZGVudHMgaXQgdW5kZXIgaXRzIHNlc3Npb24gaGVhZGVyO1xuLy8gZ3JvdXBpbmcgc2VsZWN0aW9uIG1vZGUgYWRkcyBhIGNoZWNrYm94IGFuZCBzdXBwcmVzc2VzIG5vcm1hbCBuYXZpZ2F0aW9uLlxuZnVuY3Rpb24gX3ZpZGVvSXRlbUxpKHYsIGFuYWx5emluZ05hbWUsIGluU2Vzc2lvbikge1xuICBjb25zdCBpc0FuYWx5emluZyA9IHYuZmlsZW5hbWUgPT09IGFuYWx5emluZ05hbWUgJiYgdi5zdGF0dXMgIT09ICdkb25lJztcbiAgY29uc3Qgc2VsZWN0aW5nID0gISEod2luZG93LlNlc3Npb25VSSAmJiB3aW5kb3cuU2Vzc2lvblVJLnNlbGVjdGlvbk1vZGUpO1xuICBjb25zdCBzZWxlY3RhYmxlID0gc2VsZWN0aW5nICYmIHYucGFyZW50X3ZpZGVvX2lkID09IG51bGw7XG4gIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgbGkuY2xhc3NOYW1lID0gJ3ZpZGVvLWl0ZW0nXG4gICAgKyAodi5pZCA9PT0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA/ICcgYWN0aXZlJyA6ICcnKVxuICAgICsgKGlzQW5hbHl6aW5nID8gJyBhbmFseXppbmcnIDogJycpXG4gICAgKyAoaW5TZXNzaW9uID8gJyBpbi1zZXNzaW9uJyA6ICcnKVxuICAgICsgKHNlbGVjdGFibGUgJiYgd2luZG93LlNlc3Npb25VSS5zZWxlY3RlZC5oYXModi5pZCkgPyAnIHNlbGVjdGVkJyA6ICcnKTtcbiAgbGkuZGF0YXNldC52aWRlb0lkID0gdi5pZDtcbiAgbGkudGFiSW5kZXggPSAwO1xuICBjb25zdCBjbGlwc1BjdCA9IHYuZHVyYXRpb25fbXMgPiAwXG4gICAgPyBgICgke01hdGgucm91bmQodi50b3RhbF9jbGlwX21zIC8gdi5kdXJhdGlvbl9tcyAqIDEwMCl9JSlgXG4gICAgOiAnJztcbiAgY29uc3Qgc2NvcmVCYXIgPSAodi5zY29yZV9taW4gIT09IG51bGwgJiYgdi5zY29yZV9tYXggIT09IG51bGwgJiYgdi5jbGlwX2NvdW50ID4gMClcbiAgICA/IGA8ZGl2IGNsYXNzPVwibWV0YVwiPlNjb3JlczogJHtNYXRoLnJvdW5kKHYuc2NvcmVfbWluICogMTAwKX0lIOKAkyAke01hdGgucm91bmQodi5zY29yZV9tYXggKiAxMDApfSU8L2Rpdj5gXG4gICAgOiAnJztcbiAgY29uc3Qgc2VnbWVudE1ldGEgPSAodi5zZWdtZW50X3N0YXJ0X3MgIT0gbnVsbCAmJiB2LnNlZ21lbnRfZW5kX3MgIT0gbnVsbClcbiAgICA/IGA8ZGl2IGNsYXNzPVwibWV0YVwiIHN0eWxlPVwiY29sb3I6dmFyKC0tYWNjZW50MilcIiB0aXRsZT1cIldoZXJlIHRoaXMgcGFydCBzaXRzIGluc2lkZSB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nXCI+ZnJvbSAke19tc1RvSG1zKHYuc2VnbWVudF9zdGFydF9zICogMTAwMCl9IHRvICR7X21zVG9IbXModi5zZWdtZW50X2VuZF9zICogMTAwMCl9PC9kaXY+YFxuICAgIDogJyc7XG4gIGNvbnN0IGVyckNvdW50ID0gdi5jbGlwc19sbG1fZXJyb3IgfHwgMDtcbiAgLy8gQSBtaXNzaW5nIG1vZGVsIGlzIGEgc2V0dXAgc3RhdGUsIG5vdCBhIGZhaWx1cmU6IHdoZW4gbm8gbGFuZ3VhZ2UgbW9kZWwgaXNcbiAgLy8gdXNhYmxlIHJpZ2h0IG5vdywgdGhlc2UgY2xpcHMgd2VyZSBzaW1wbHkgc2NvcmVkIGJlZm9yZSBvbmUgd2FzIHNldCB1cCwgc29cbiAgLy8gc2hvdyBhIGNhbG0gbm90ZSByYXRoZXIgdGhhbiBhbiBhbGFybWluZyByZWQgXCJOIHNjb3JpbmcgZXJyb3JzXCIgYmFkZ2UuXG4gIGNvbnN0IGxsbVVzYWJsZSA9ICEhKHdpbmRvdy5fcHJlcmVxcyB8fCB7fSkubGxtX29rO1xuICBjb25zdCBlcnJCYWRnZSA9IGVyckNvdW50ID09PSAwID8gJydcbiAgICA6IGxsbVVzYWJsZVxuICAgID8gYDxkaXYgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjJweDtjb2xvcjp2YXIoLS13YXJuaW5nKVwiIHRpdGxlPVwiTExNIHNjb3JpbmcgZmFpbGVkIGZvciAke3BsdXJhbChlcnJDb3VudCwgJ2NsaXAnKX0gLSByZS1zY29yZSB0byByZXRyeVwiPiYjOTg4ODsgJHtwbHVyYWwoZXJyQ291bnQsICdzY29yaW5nIGVycm9yJyl9PC9kaXY+YFxuICAgIDogYDxkaXYgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjJweDtjb2xvcjp2YXIoLS1tdXRlZClcIiB0aXRsZT1cIlRoZXNlIGNsaXBzIHdlcmUgc2NvcmVkIGJlZm9yZSBhIGxhbmd1YWdlIG1vZGVsIHdhcyBzZXQgdXAgLSBzZXQgb25lIHVwLCB0aGVuIHJlLXNjb3JlIGZvciBBSSBzY29yaW5nIGFuZCBkZXNjcmlwdGlvbnNcIj5TY29yZWQgd2l0aG91dCBhIGxhbmd1YWdlIG1vZGVsPC9kaXY+YDtcbiAgY29uc3QgY2hlY2tib3ggPSBzZWxlY3RhYmxlXG4gICAgPyBgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwic2Vzc2lvbi1zZWxlY3QtYm94XCIgYXJpYS1sYWJlbD1cIlNlbGVjdCBmb3IgZ3JvdXBpbmdcIiAke3dpbmRvdy5TZXNzaW9uVUkuc2VsZWN0ZWQuaGFzKHYuaWQpID8gJ2NoZWNrZWQnIDogJyd9PmBcbiAgICA6ICcnO1xuICBsaS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBjbGFzcz1cInZpZGVvLWl0ZW0tYm9keVwiPlxuICAgICAgJHtjaGVja2JveH1cbiAgICAgIDxkaXYgc3R5bGU9XCJmbGV4OjE7bWluLXdpZHRoOjBcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm5hbWVcIiB0aXRsZT1cIiR7di50aXRsZSA/IGVzY0h0bWwodi5maWxlbmFtZSkgOiAnJ31cIj4ke2VzY0h0bWwodi50aXRsZSB8fCB2LmZpbGVuYW1lKX08L2Rpdj5cbiAgICAgICAgJHt2LnRpdGxlID8gYDxkaXYgY2xhc3M9XCJ2aWRlby10aXRsZVwiPiR7ZXNjSHRtbCh2LmZpbGVuYW1lKX08L2Rpdj5gIDogJyd9XG4gICAgICAgICR7c2VnbWVudE1ldGF9XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhXCI+JHt2LmR1cmF0aW9uX2htc30gJm1pZGRvdDsgJHt2LmNsaXBfY291bnR9IGNsaXBzICZtaWRkb3Q7ICR7X21zVG9IbXModi50b3RhbF9jbGlwX21zKX0gY2xpcHBlZCR7Y2xpcHNQY3R9PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhXCI+JHtpc0FuYWx5emluZ1xuICAgICAgICAgID8gYDxzcGFuIGNsYXNzPVwic3Bpbm5lclwiIHN0eWxlPVwiZGlzcGxheTppbmxpbmUtYmxvY2s7dmVydGljYWwtYWxpZ246bWlkZGxlXCI+PC9zcGFuPiA8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLWFjY2VudClcIj4ke2VzY0h0bWwoX2ZtdFZpZGVvU3RhdHVzKHYuc3RhdHVzKSl94oCmPC9zcGFuPmBcbiAgICAgICAgICA6IGAke3YuYXBwcm92ZWR9IGFwcHJvdmVkICZtaWRkb3Q7ICR7di5leHBvcnRlZH0gZXhwb3J0ZWQgJm1pZGRvdDsgJHtfZm10VmlkZW9TdGF0dXModi5zdGF0dXMpfWB9PC9kaXY+XG4gICAgICAgICR7ZXJyQmFkZ2V9XG4gICAgICAgICR7c2NvcmVCYXJ9XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xuICByZXR1cm4gbGk7XG59XG5cbi8vIOKUgOKUgCB2aWRlbyBzZWFyY2ggLyBmaWx0ZXIgLyBzb3J0IGNvbnRyb2xzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gc2V0VmlkZW9TZWFyY2gocSkgeyBBcHBTdGF0ZS52aWRlb1NlYXJjaCA9IHEudHJpbSgpOyBfcmVuZGVyVmlkZW9MaXN0KCk7IH1cbmZ1bmN0aW9uIHNldFZpZGVvU29ydChzb3J0KSB7XG4gIEFwcFN0YXRlLnZpZGVvU29ydCA9IHNvcnQ7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd2aWRlb3Mtc29ydCcsIHNvcnQpO1xuICBfcmVuZGVyVmlkZW9MaXN0KCk7XG59XG5mdW5jdGlvbiB0b2dnbGVWaWRlb1NvcnREaXIoKSB7XG4gIEFwcFN0YXRlLnZpZGVvU29ydERpciA9IChBcHBTdGF0ZS52aWRlb1NvcnREaXIgPT09ICdhc2MnKSA/ICdkZXNjJyA6ICdhc2MnO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgndmlkZW9zLXNvcnQtZGlyJywgQXBwU3RhdGUudmlkZW9Tb3J0RGlyKTtcbiAgX3N5bmNTb3J0RGlyQnRuKCd2aWRlb3Mtc29ydC1kaXInLCBBcHBTdGF0ZS52aWRlb1NvcnREaXIpO1xuICBfcmVuZGVyVmlkZW9MaXN0KCk7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZVZpZGVvRmlsdGVyKHRva2VuKSB7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS52aWRlb0ZpbHRlcnM7XG4gIGlmICh0b2tlbiA9PT0gJ2FsbCcpIGYuY2xlYXIoKTtcbiAgZWxzZSBpZiAoZi5oYXModG9rZW4pKSBmLmRlbGV0ZSh0b2tlbik7XG4gIGVsc2UgZi5hZGQodG9rZW4pO1xuICBfc3luY1ZpZGVvRmlsdGVyQ2hpcHMoKTtcbiAgX3JlbmRlclZpZGVvTGlzdCgpO1xufVxuXG5mdW5jdGlvbiBfc3luY1ZpZGVvRmlsdGVyQ2hpcHMoKSB7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS52aWRlb0ZpbHRlcnM7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLXZmaWx0ZXJdJykuZm9yRWFjaChjaGlwID0+IHtcbiAgICBjb25zdCB0b2tlbiA9IGNoaXAuZGF0YXNldC52ZmlsdGVyO1xuICAgIGNvbnN0IGFjdGl2ZSA9IHRva2VuID09PSAnYWxsJyA/IGYuc2l6ZSA9PT0gMCA6IGYuaGFzKHRva2VuKTtcbiAgICBjaGlwLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIGFjdGl2ZSk7XG4gICAgY2hpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFjdGl2ZSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuICB9KTtcbiAgX3N5bmNWaWRlb01vcmVGaWx0ZXJzKCk7XG59XG5cbi8vIFJlY29yZGluZyBmaWx0ZXJzIHRoYXQgbGl2ZSBpbnNpZGUgdGhlIFwiTW9yZSBmaWx0ZXJzXCIgZXhwYW5kZXIuIE1pcnJvcnNcbi8vIGNsaXBzLmpzIF9ISURERU5fRklMVEVSX1RPS0VOUyAvIF9zeW5jTW9yZUZpbHRlcnM6IGZvcmNlIHRoZSBleHBhbmRlciBvcGVuXG4vLyB3aGVuZXZlciBvbmUgb2YgdGhlIGZpbHRlcnMgaXQgaGlkZXMgaXMgYWN0aXZlIChhbmQgc2hvdyB0aGUgXCJmaWx0ZXJlZFwiIGRvdCksXG4vLyBzbyB0aGUgbGlzdCBpcyBuZXZlciBteXN0ZXJpb3VzbHkgZmlsdGVyZWQuIE9ubHkgZXZlciBmb3JjZWQgT1BFTiAtIG9uIHJldHVyblxuLy8gdG8gQWxsIC8gSGFzIGNsaXBzIHRoZSB1c2VyIGNhbiBjb2xsYXBzZSBpdCBhZ2Fpbi5cbmNvbnN0IF9ISURERU5fVkZJTFRFUl9UT0tFTlMgPSBbJ3Vuc2NvcmVkJywgJ2Vycm9ycyddO1xuZnVuY3Rpb24gX3N5bmNWaWRlb01vcmVGaWx0ZXJzKCkge1xuICBjb25zdCBkZXRhaWxzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZpZGVvLW1vcmUtZmlsdGVycycpO1xuICBpZiAoIWRldGFpbHMpIHJldHVybjtcbiAgY29uc3QgYWN0aXZlID0gX0hJRERFTl9WRklMVEVSX1RPS0VOUy5zb21lKHQgPT4gQXBwU3RhdGUudmlkZW9GaWx0ZXJzLmhhcyh0KSk7XG4gIGlmIChhY3RpdmUpIGRldGFpbHMub3BlbiA9IHRydWU7XG4gIGNvbnN0IGZsYWcgPSBkZXRhaWxzLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLW1vcmUtZmxhZ10nKTtcbiAgaWYgKGZsYWcpIGZsYWcuaGlkZGVuID0gIWFjdGl2ZTtcbn1cblxuZnVuY3Rpb24gX2NsZWFyVmlkZW9GaWx0ZXJzKCkge1xuICBBcHBTdGF0ZS52aWRlb0ZpbHRlcnMuY2xlYXIoKTtcbiAgQXBwU3RhdGUudmlkZW9TZWFyY2ggPSAnJztcbiAgY29uc3Qgc2VhcmNoRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndmlkZW8tc2VhcmNoLWlucHV0Jyk7XG4gIGlmIChzZWFyY2hFbCkgc2VhcmNoRWwudmFsdWUgPSAnJztcbiAgX3N5bmNWaWRlb0ZpbHRlckNoaXBzKCk7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX3Jlc3RvcmVWaWV3KCkge1xuICB0cnkge1xuICAgIGNvbnN0IHNhdmVkID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgneXV1Y2xpcC12aWV3JykgfHwgJ251bGwnKTtcbiAgICBpZiAoIXNhdmVkPy52aWRlb0lkKSByZXR1cm47XG4gICAgaWYgKCFBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IHNhdmVkLnZpZGVvSWQpKSByZXR1cm47XG4gICAgYXdhaXQgc2VsZWN0VmlkZW8oc2F2ZWQudmlkZW9JZCk7XG4gICAgaWYgKHNhdmVkLmNsaXBJZCAmJiBBcHBTdGF0ZS5jbGlwcy5maW5kKGMgPT4gYy5pZCA9PT0gc2F2ZWQuY2xpcElkKSkge1xuICAgICAgYXdhaXQgd2luZG93LnNlbGVjdENsaXAoc2F2ZWQuY2xpcElkKTtcbiAgICB9XG4gIH0gY2F0Y2gge31cbn1cblxuZnVuY3Rpb24gX2FuYWx5emluZ1BsYWNlaG9sZGVyTGkoZmlsZW5hbWUpIHtcbiAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICBsaS5jbGFzc05hbWUgPSAndmlkZW8taXRlbSBhbmFseXppbmctcGxhY2Vob2xkZXInO1xuICBsaS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBjbGFzcz1cIm5hbWVcIiBzdHlsZT1cImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweFwiPjxzcGFuIGNsYXNzPVwic3Bpbm5lclwiPjwvc3Bhbj4ke2VzY0h0bWwoZmlsZW5hbWUpfTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS1hY2NlbnQpXCI+QW5hbHl6aW5n4oCmPC9kaXY+YDtcbiAgcmV0dXJuIGxpO1xufVxuXG5mdW5jdGlvbiBfc2hvd0VtcHR5U3RhdGUoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwbGF5ZXItYXJlYScpLmlubmVySFRNTCA9ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuaW5uZXJIVE1MID0gYFxuICAgIDxkaXYgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPlxuICAgICAgPGltZyBjbGFzcz1cImVtcHR5LXN0YXRlLW1hc2NvdFwiIHNyYz1cIi9zdGF0aWMvZ2FtZXJjYXQucG5nXCIgYWx0PVwiXCI+XG4gICAgICA8aDI+V2VsY29tZSB0byBZdXVDbGlwPC9oMj5cbiAgICAgIDxwPkFuYWx5emUgYSByZWNvcmRpbmcgdG8gc3RhcnQgcmV2aWV3aW5nIGFuZCBleHBvcnRpbmcgeW91ciBiZXN0IG1vbWVudHMuIFl1dUNsaXAgc2hpbmVzIG9uIHRhbGstaGVhdnkgc2Vzc2lvbnMgLSBSUCwgdm9pY2UgY2hhdCwgc3RyZWFtaW5nLCBwb2RjYXN0cywgYW5kIGNvbW1lbnRhcnkuPC9wPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBoaWdobGlnaHRcIiBkYXRhLWFjdD1cIm9wZW4tbmV3LXJlY29yZGluZy1wYW5lbFwiPisgQW5hbHl6ZSB5b3VyIGZpcnN0IHJlY29yZGluZzwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIGRhdGEtYWN0PVwib3Blbi1nZXR0aW5nLXN0YXJ0ZWRcIiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+R2V0dGluZyBTdGFydGVkIEd1aWRlPC9idXR0b24+XG4gICAgPC9kaXY+YDtcbn1cblxuZnVuY3Rpb24gX3VwZGF0ZURlbW9CdXR0b24oYXBwcm92ZWRDb3VudCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhpZ2hsaWdodC1yZWVscycpO1xuICBidG4udGl0bGUgPSBhcHByb3ZlZENvdW50ID09PSAwXG4gICAgPyAnVmlldyBleGlzdGluZyByZWVscyBvciBidWlsZCBvbmUgYWZ0ZXIgYXBwcm92aW5nIHNvbWUgY2xpcHMnXG4gICAgOiBgVmlldyBvciBidWlsZCBhIGhpZ2hsaWdodCByZWVsIGZyb20gJHtwbHVyYWwoYXBwcm92ZWRDb3VudCwgJ2FwcHJvdmVkIGNsaXAnKX1gO1xufVxuXG5mdW5jdGlvbiBfdXBkYXRlU3RhcnRJbmdlc3RCdXR0b24oKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tc3RhcnQtYW5hbHl6ZScpO1xuICBpZiAoIWJ0bikgcmV0dXJuO1xuICBpZiAod2luZG93Ll9wcmVyZXFzICYmICF3aW5kb3cuX3ByZXJlcXMuZmZtcGVnX29rKSByZXR1cm47XG4gIGJ0bi5kaXNhYmxlZCA9ICFfcHJvYmVkSW5mbztcbiAgYnRuLnRpdGxlID0gX3Byb2JlZEluZm8gPyAnJyA6ICdTZWxlY3QgYSB2YWxpZCByZWNvcmRpbmcgZmlsZSBmaXJzdCc7XG59XG5cbmZ1bmN0aW9uIF9jbGlwc1NvcnRQYXJhbSgpIHtcbiAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwcy1zb3J0JykudmFsdWU7XG59XG5cbi8vIENhbm9uaWNhbCBjbGlwLWxpc3QgVVJMOiBldmVyeSByZWxvYWQgb2YgQXBwU3RhdGUuY2xpcHMgZ29lcyB0aHJvdWdoIHRoaXMgc28gdGhlXG4vLyBhY3RpdmUgc29ydCBBTkQgdGhlIGFjdGl2ZSBjYW5kaWRhdGUgdHlwZSAoQ2xpcHMgdnMgU2NlbmVzKSBhcmUgYWx3YXlzIGFwcGxpZWRcbi8vIHRvZ2V0aGVyLiBBZGRpbmcgYSBuZXcgZmV0Y2ggc2l0ZT8gVXNlIHRoaXMsIG5ldmVyIGEgaGFuZC1idWlsdCBxdWVyeSBzdHJpbmcuXG5mdW5jdGlvbiBfY2xpcHNMaXN0VXJsKHZpZGVvSWQpIHtcbiAgcmV0dXJuIGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L2NsaXBzP3NvcnQ9JHtfY2xpcHNTb3J0UGFyYW0oKX0ma2luZD0ke0FwcFN0YXRlLmNsaXBLaW5kfWA7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlbGVjdFZpZGVvKGlkKSB7XG4gIGlmICh3aW5kb3cuaXNTcGxpdEVkaXRvck9wZW4oKSkge1xuICAgIC8vIF9zcGxpdFBvaW50cyBpcyBzcGxpdC5qcydzIHNoYXJlZCBsaXZlLWVkaXQgc3RhdGU6IGEgdG9wLWxldmVsIGBsZXRgIGtlcHRcbiAgICAvLyBvdXRzaWRlIGl0cyBJSUZFIHNwZWNpZmljYWxseSBzbyBvdGhlciBjbGFzc2ljIHNjcmlwdHMgY2FuIHJlYWQgaXQgYmFyZVxuICAgIC8vIChzZWUgdGhlIGNvbW1lbnQgaW4gc3BsaXQuanMpLiBJdCBpcyBuZXZlciBhIHdpbmRvdyBwcm9wZXJ0eSwgc28gdGhpc1xuICAgIC8vIG11c3Qgc3RheSBhIGJhcmUgcmVmZXJlbmNlIHJhdGhlciB0aGFuIHdpbmRvdy5fc3BsaXRQb2ludHMuXG4gICAgY29uc3QgaGFzU3BsaXRzID0gdHlwZW9mIF9zcGxpdFBvaW50cyAhPT0gJ3VuZGVmaW5lZCcgJiYgX3NwbGl0UG9pbnRzLmxlbmd0aCA+IDA7XG4gICAgaWYgKGhhc1NwbGl0cykge1xuICAgICAgc2hvd0NvbmZpcm0oXG4gICAgICAgICdMZWF2ZSBTcGxpdCBlZGl0b3I/JyxcbiAgICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgc3BsaXQgcG9pbnRzLiBTd2l0Y2ggdG8gdGhpcyByZWNvcmRpbmcgYW5kIGRpc2NhcmQgdGhlbT8nLFxuICAgICAgICAnRGlzY2FyZCcsXG4gICAgICAgICgpID0+IHsgd2luZG93LmNsb3NlU3BsaXRFZGl0b3IoKTsgc2VsZWN0VmlkZW8oaWQpOyB9LFxuICAgICAgICB0cnVlLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgd2luZG93LmNsb3NlU3BsaXRFZGl0b3IoKTtcbiAgfVxuICAvLyBfcGFuZWxEaXJ0eSBpcyBhbmFseXplLmpzJ3Mgc2hhcmVkIGxpdmUtZWRpdCBzdGF0ZSAtIHNhbWUgYmFyZS1nbG9iYWxcbiAgLy8gY29udHJhY3QgYXMgX3NwbGl0UG9pbnRzIGFib3ZlIChzZWUgdGhlIGNvbW1lbnQgYXQgdGhlIHRvcCBvZiBhbmFseXplLmpzKS5cbiAgaWYgKHdpbmRvdy5faXNOZXdSZWNvcmRpbmdQYW5lbE9wZW4oKSAmJiBfcGFuZWxEaXJ0eSkge1xuICAgIHNob3dDb25maXJtKFxuICAgICAgJ0Rpc2NhcmQgbmV3IHJlY29yZGluZz8nLFxuICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgY29uZmlndXJhdGlvbi4gU3dpdGNoIHRvIHRoaXMgcmVjb3JkaW5nIGFueXdheT8nLFxuICAgICAgJ0Rpc2NhcmQnLFxuICAgICAgKCkgPT4geyB3aW5kb3cuX2RvQ2xvc2VOZXdSZWNvcmRpbmdQYW5lbCgpOyBzZWxlY3RWaWRlbyhpZCk7IH0sXG4gICAgICB0cnVlLFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh3aW5kb3cuX2lzTmV3UmVjb3JkaW5nUGFuZWxPcGVuKCkpIHdpbmRvdy5fZG9DbG9zZU5ld1JlY29yZGluZ1BhbmVsKCk7XG4gIEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPSBpZDtcbiAgQXBwU3RhdGUuYWN0aXZlU2Vzc2lvbklkID0gbnVsbDtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI3ZpZGVvLWxpc3QgbGkuc2Vzc2lvbi1oZWFkZXIuYWN0aXZlJykuZm9yRWFjaChsID0+IGwuY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJykpO1xuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgID0gbnVsbDtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3l1dWNsaXAtdmlldycsIEpTT04uc3RyaW5naWZ5KHt2aWRlb0lkOiBpZCwgY2xpcElkOiBudWxsfSkpO1xuICBBcHBTdGF0ZS5jbGlwRmlsdGVycy5jbGVhcigpO1xuICBBcHBTdGF0ZS5jbGlwU2VhcmNoICA9ICcnO1xuICBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4gPSAwO1xuICB3aW5kb3cuX3N5bmNGaWx0ZXJDaGlwcygpO1xuICBjb25zdCBfc2VhcmNoRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1zZWFyY2gtaW5wdXQnKTtcbiAgaWYgKF9zZWFyY2hFbCkgX3NlYXJjaEVsLnZhbHVlID0gJyc7XG4gIGNvbnN0IF9zY29yZUVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtc2NvcmUtbWluJyk7XG4gIGlmIChfc2NvcmVFbCkgX3Njb3JlRWwudmFsdWUgPSAnMCc7XG4gIC8vIExvYWQgY2xpcHMgYW5kIChpZiB0aGUgYm9vdCBmZXRjaCBoYXNuJ3QgcG9wdWxhdGVkIHRoZW0geWV0KSBjb250ZXh0cyBpblxuICAvLyBwYXJhbGxlbCwgc28gdGhlIGRldGFpbCdzIGNvbnRleHQgY2hpcHMvZHJvcGRvd24gbmV2ZXIgcmVuZGVyIGZyb20gYW4gZW1wdHlcbiAgLy8gbGlzdCBvbiB0aGUgZmlyc3QgdmlkZW8gb3BlbmVkIGFmdGVyIGxvYWQuXG4gIGNvbnN0IGNsaXBzUHJvbWlzZSA9IGZldGNoKF9jbGlwc0xpc3RVcmwoaWQpKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICBhd2FpdCB3aW5kb3cuZW5zdXJlQ29udGV4dHMoKTtcbiAgY29uc3QgY2xpcHMgPSBhd2FpdCBjbGlwc1Byb21pc2U7XG4gIC8vIEd1YXJkIGFnYWluc3QgYSBzbG93ZXIgZWFybGllciBmZXRjaCByZXNvbHZpbmcgYWZ0ZXIgYSBuZXdlciBzZWxlY3Rpb24gLVxuICAvLyBvdGhlcndpc2UgY2xpY2tpbmcgQiB3aGlsZSBBJ3MgY2xpcHMgYXJlIGluIGZsaWdodCByZW5kZXJzIEEgaW50byBCJ3MgZGV0YWlsLlxuICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCAhPT0gaWQpIHJldHVybjtcbiAgQXBwU3RhdGUuY2xpcHMgPSBjbGlwcztcbiAgd2luZG93Ll9yZW5kZXJDbGlwcygpO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBpZiAodmlkZW8pIHJlbmRlclZpZGVvRGV0YWlsKHZpZGVvLCBudWxsKTtcbiAgZWxzZSB3aW5kb3cuY2xlYXJEZXRhaWwoKTtcbn1cblxuLy8gXCJJbXBvcnRlZCBmcm9tXCIgbGluZSAocm9hZG1hcCBwbGFuIDA4KSAtIHNob3duIG9ubHkgZm9yIGEgcmVjb3JkaW5nIGJyb3VnaHRcbi8vIGluIHZpYSBJbXBvcnQgZnJvbSBVUkw7IGEgcmVjb3JkaW5nIGFkZGVkIGZyb20gYSBsb2NhbCBmaWxlIGhhcyBubyBzb3VyY2VfdXJsLlxuZnVuY3Rpb24gX3JlbmRlckltcG9ydGVkRnJvbUxpbmUodmlkZW8pIHtcbiAgaWYgKCF2aWRlby5zb3VyY2VfdXJsKSByZXR1cm4gJyc7XG4gIGNvbnN0IHBhcnRzID0gW2VzY0h0bWwodmlkZW8uc291cmNlX3VwbG9hZGVyIHx8ICdVbmtub3duIGNoYW5uZWwnKV07XG4gIGlmICh2aWRlby5zb3VyY2VfdXBsb2FkX2RhdGUpIHBhcnRzLnB1c2goZXNjSHRtbCh2aWRlby5zb3VyY2VfdXBsb2FkX2RhdGUpKTtcbiAgcmV0dXJuIGBcbiAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHg7bWFyZ2luLXRvcDo0cHhcIj5cbiAgICAgICAgSW1wb3J0ZWQgZnJvbSAke3BhcnRzLmpvaW4oJyAmbWlkZG90OyAnKX0gJm1pZGRvdDtcbiAgICAgICAgPGEgaHJlZj1cIiR7ZXNjSHRtbCh2aWRlby5zb3VyY2VfdXJsKX1cIiB0YXJnZXQ9XCJfYmxhbmtcIiByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCI+VmlldyBvcmlnaW5hbDwvYT5cbiAgICAgIDwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclZpZGVvRGV0YWlsKHZpZGVvLCBzYXZlZFRpbWVsaW5lKSB7XG4gIEFwcFN0YXRlLmFjdGl2ZVZpZGVvRGF0YSA9IHZpZGVvO1xuICBjb25zdCBlYiA9IChpc0VkaXRlZCkgPT4gaXNFZGl0ZWQgPyBgPHNwYW4gY2xhc3M9XCJlZGl0ZWQtYmFkZ2VcIj5lZGl0ZWQ8L3NwYW4+YCA6ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyLWFyZWEnKS5pbm5lckhUTUwgPVxuICAgIGA8ZGl2IHN0eWxlPVwicG9zaXRpb246cmVsYXRpdmVcIj5cbiAgICAgICA8dmlkZW8gaWQ9XCJyZWNvcmRpbmctcHJldmlldy12aWRlb1wiIGNvbnRyb2xzIHByZWxvYWQ9XCJtZXRhZGF0YVwiIGFyaWEtbGFiZWw9XCJSZWNvcmRpbmcgcHJldmlld1wiIHN0eWxlPVwiZGlzcGxheTpibG9jazt3aWR0aDoxMDAlO21heC1oZWlnaHQ6dmFyKC0tcGxheWVyLW1heC1oZWlnaHQsIDQydmgpO29iamVjdC1maXQ6Y29udGFpbjtiYWNrZ3JvdW5kOiMwMDBcIj48L3ZpZGVvPlxuICAgICAgIDxzcGFuIGlkPVwicmVjb3JkaW5nLXByZXZpZXctYmFkZ2VcIiByb2xlPVwic3RhdHVzXCIgc3R5bGU9XCJkaXNwbGF5Om5vbmU7cG9zaXRpb246YWJzb2x1dGU7dG9wOjhweDtsZWZ0OjhweDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjcpO2NvbG9yOiNlNmU2ZTY7Zm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOHB4O2JvcmRlci1yYWRpdXM6NHB4XCI+PC9zcGFuPlxuICAgICA8L2Rpdj5gO1xuICBzZXR1cFJlY29yZGluZ1ByZXZpZXcoXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY29yZGluZy1wcmV2aWV3LXZpZGVvJyksXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY29yZGluZy1wcmV2aWV3LWJhZGdlJyksXG4gICAgdmlkZW8uaWQsXG4gICAge1xuICAgICAgYXV0b0J1aWxkOiBmYWxzZSxcbiAgICAgIGlzQ3VycmVudDogKCkgPT4gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gdmlkZW8uaWQsXG4gICAgICBzdGFydFM6IHZpZGVvLnNlZ21lbnRfc3RhcnRfcyxcbiAgICAgIGVuZFM6IHZpZGVvLnNlZ21lbnRfZW5kX3MsXG4gICAgICBzb3VyY2VQYXRoOiB2aWRlby5zb3VyY2VfcGF0aCxcbiAgICB9LFxuICApO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuaW5uZXJIVE1MID0gYFxuICAgIDxkaXY+PGRpdiBjbGFzcz1cImRldGFpbC10eXBlLWJhZGdlIHZpZGVvLWJhZGdlXCI+JiMxMjc5MTY7IFJlY29yZGluZzwvZGl2PjwvZGl2PlxuXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+XG4gICAgICAgIDxoMiBzdHlsZT1cIm1hcmdpbjowO2ZvbnQtc2l6ZToxN3B4O2ZvbnQtd2VpZ2h0OjcwMFwiIHRpdGxlPVwiJHtlc2NIdG1sKHZpZGVvLnRpdGxlIHx8IHZpZGVvLmZpbGVuYW1lKX1cIj4ke2VzY0h0bWwodmlkZW8udGl0bGUgfHwgdmlkZW8uZmlsZW5hbWUpfSR7ZWIodmlkZW8udGl0bGVfaXNfZWRpdGVkKX08L2gyPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwia2ViYWItYnRuXCIgdGl0bGU9XCJFZGl0IG9yIHJlZ2VuZXJhdGUgdGl0bGVcIiBhcmlhLWxhYmVsPVwiRWRpdCBvciByZWdlbmVyYXRlIHRpdGxlXCIgZGF0YS1hY3Q9XCJ2aWRlby10aXRsZS1rZWJhYlwiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPiYjODk0Mjs8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTNweDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo4cHg7ZmxleC13cmFwOndyYXBcIj5cbiAgICAgICAgPHNwYW4+JHt2aWRlby5kdXJhdGlvbl9obXN9ICZtaWRkb3Q7ICR7dmlkZW8uY2xpcF9jb3VudH0gY2xpcHMgJm1pZGRvdDsgJHtfbXNUb0htcyh2aWRlby50b3RhbF9jbGlwX21zKX0gY2xpcHBlZDwvc3Bhbj5cbiAgICAgICAgJHtBcHBTdGF0ZS5jYW5SZXZlYWwgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzoycHggOHB4XCIgZGF0YS1hY3Q9XCJyZXZlYWwtaW4tZm9sZGVyXCI+U2hvdyBpbiBGb2xkZXI8L2J1dHRvbj5gIDogJyd9XG4gICAgICA8L2Rpdj5cbiAgICAgICR7X3JlbmRlckltcG9ydGVkRnJvbUxpbmUodmlkZW8pfVxuICAgIDwvZGl2PlxuXG4gICAgJHtfcmVuZGVyQ29udGV4dFNlY3Rpb24odmlkZW8pfVxuXG4gICAgJHtjb2xsYXBzaWJsZUNhcmQoJ3ZpZGVvLXN1bW1hcnknLFxuICAgICAgICBgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPlNlc3Npb24gU3VtbWFyeSR7ZWIodmlkZW8uc3VtbWFyeV9pc19lZGl0ZWQpfTwvc3Bhbj5gLCBgXG4gICAgICA8ZGl2IGlkPVwic3VtbWFyeS1ib2R5XCI+JHt2aWRlby5zdW1tYXJ5XG4gICAgICAgID8gYDxkaXYgY2xhc3M9XCJkZXNjcmlwdGlvbi1sb25nXCI+JHtlc2NIdG1sKHZpZGVvLnN1bW1hcnkpfTwvZGl2PmBcbiAgICAgICAgOiBgPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTJweFwiPk5vIHN1bW1hcnkgeWV0IC0gZ2VuZXJhdGUgYSB0aXRsZSBhbmQgc3VtbWFyeSBmcm9tIHRoZSB0cmFuc2NyaXB0LjwvZGl2PmB9PC9kaXY+YCxcbiAgICAgIHsgYWN0aW9uczogYCR7dmlkZW8uc3VtbWFyeVxuICAgICAgICAgID8gYDxidXR0b24gY2xhc3M9XCJrZWJhYi1idG5cIiB0aXRsZT1cIkVkaXQgb3IgcmVnZW5lcmF0ZSBzdW1tYXJ5XCIgYXJpYS1sYWJlbD1cIkVkaXQgb3IgcmVnZW5lcmF0ZSBzdW1tYXJ5XCIgZGF0YS1hY3Q9XCJ2aWRlby1zdW1tYXJ5LWtlYmFiXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+JiM4OTQyOzwvYnV0dG9uPmBcbiAgICAgICAgICA6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJidG4tc3VtbWFyaXplLXZpZGVvXCIgZGF0YS1hY3Q9XCJzdW1tYXJpemUtdmlkZW9cIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj5HZW5lcmF0ZSBTdW1tYXJ5PC9idXR0b24+YH1gIH0pfVxuXG4gICAgJHtfaXNWaWRlb0JlaW5nQW5hbHl6ZWQodmlkZW8pID8gX2FuYWx5c2lzTGl2ZVBhbmVsSFRNTCgpIDogJyd9XG4gICAgJHt3aW5kb3cuX3JlbmRlclJ1bk1ldGFDYXJkKHZpZGVvKX1cblxuICAgIDxkaXYgY2xhc3M9XCJ2aWQtYWN0aW9uc1wiPlxuICAgICAgPGRpdiBjbGFzcz1cInZpZC1hY3Rpb25zLXJvd1wiPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuXCIgZGF0YS1hY3Q9XCJvcGVuLWJhdGNoLWV4cG9ydFwiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPkV4cG9ydCBBcHByb3ZlZDwvYnV0dG9uPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgZGF0YS1hY3Q9XCJvcGVuLXZpZGVvLWFjdGlvbnNcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj5BZGRpdGlvbmFsIEFjdGlvbnM8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgPGRpdiBpZD1cInNwZWFrZXJzLXNlY3Rpb25cIj48L2Rpdj5cblxuICAgICR7KHZpZGVvLmNsaXBfY291bnQgPiAwIHx8IHZpZGVvLnN0YXR1cyA9PT0gJ2RvbmUnKSA/IGNvbGxhcHNpYmxlQ2FyZCgndmlkZW8tdHJhbnNjcmlwdCcsXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+RnVsbCB0cmFuc2NyaXB0PC9zcGFuPmAsXG4gICAgICBgPGRpdiBpZD1cInZpZGVvLXRyYW5zY3JpcHQtdmlld1wiIGNsYXNzPVwidHJhbnNjcmlwdFwiPjwvZGl2PmAsXG4gICAgICB7IGRlZmF1bHRDb2xsYXBzZWQ6IHRydWUsIGF0dHJzOiBgaWQ9XCJ2aWRlby10cmFuc2NyaXB0LWRldGFpbHNcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cImAsXG4gICAgICAgIGFjdGlvbnM6IGA8c3BhbiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6NnB4XCI+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOXB4XCIgdGl0bGU9XCJTY2FuIHRoZSB0cmFuc2NyaXB0IGZvciBtaXMtaGVhcmQgbmFtZXMgKGUuZy4gJnF1b3Q7WW91JnF1b3Q7IGZvciAmcXVvdDtZdXUmcXVvdDspIGFuZCBmaXggdGhlbVwiXG4gICAgICAgICAgICAgICAgICBkYXRhLWFjdD1cIm9wZW4tbmFtZS1jb3JyZWN0aW9uc1wiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPkZpeCBuYW1lczwvYnV0dG9uPlxuICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDlweFwiIHRpdGxlPVwiUGljayBhIHRpbWUgcmFuZ2UgdG8gY3JlYXRlIGEgY2xpcCBieSBoYW5kXCJcbiAgICAgICAgICAgICAgICAgIGRhdGEtYWN0PVwib3Blbi1jbGlwLWNyZWF0ZS1waWNrZXJcIiBkYXRhLXZpZGVvLWlkPVwiJHt2aWRlby5pZH1cIj5DcmVhdGUgY2xpcDwvYnV0dG9uPlxuICAgICAgICA8L3NwYW4+YCB9KSA6ICcnfVxuXG4gICAgJHtjb2xsYXBzaWJsZUNhcmQoJ3ZpZGVvLXRpbWVsaW5lJyxcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5TZXNzaW9uIFRpbWVsaW5lPC9zcGFuPmAsIGBcbiAgICAgIDxkaXYgaWQ9XCJ0aW1lbGluZS1zZWN0aW9uXCI+XG4gICAgICAgICR7c2F2ZWRUaW1lbGluZSA/IHdpbmRvdy5fcmVuZGVyVGltZWxpbmVIVE1MKHNhdmVkVGltZWxpbmUpIDogKHZpZGVvLmhhc190aW1lbGluZSA/ICcnIDogd2luZG93Ll90aW1lbGluZUVtcHR5Tm90ZUhUTUwoKSl9XG4gICAgICA8L2Rpdj5gLFxuICAgICAgeyBhY3Rpb25zOiBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIGlkPVwiYnRuLWdlbmVyYXRlLXRpbWVsaW5lXCIgZGF0YS1hY3Q9XCJnZW5lcmF0ZS10aW1lbGluZVwiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPiR7dmlkZW8uaGFzX3RpbWVsaW5lID8gJ1JlZ2VuZXJhdGUgVGltZWxpbmUnIDogJ0dlbmVyYXRlIFRpbWVsaW5lJ308L2J1dHRvbj5gIH0pfWA7XG5cbiAgaWYgKHdpbmRvdy5sb2FkU3BlYWtlcnMpIHdpbmRvdy5sb2FkU3BlYWtlcnModmlkZW8uaWQpO1xuICBpZiAod2luZG93LnJlbG9hZFZpZGVvVHJhbnNjcmlwdElmT3Blbikgd2luZG93LnJlbG9hZFZpZGVvVHJhbnNjcmlwdElmT3Blbih2aWRlby5pZCk7XG4gIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwoKTtcblxuICBpZiAoIXNhdmVkVGltZWxpbmUgJiYgdmlkZW8uaGFzX3RpbWVsaW5lKSB7XG4gICAgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW8uaWR9YClcbiAgICAgIC50aGVuKHIgPT4gci5qc29uKCkpXG4gICAgICAudGhlbih2ID0+IHtcbiAgICAgICAgaWYgKHYudGltZWxpbmUgJiYgdi50aW1lbGluZS5sZW5ndGgpIHtcbiAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtc2VjdGlvbicpLmlubmVySFRNTCA9IHdpbmRvdy5fcmVuZGVyVGltZWxpbmVIVE1MKHYudGltZWxpbmUpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmNhdGNoKCgpID0+IHt9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvcGVuVmlkZW9BY3Rpb25zTW9kYWwodmlkZW9JZCkge1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLmFjdGl2ZVZpZGVvRGF0YT8uaWQgPT09IHZpZGVvSWQgPyBBcHBTdGF0ZS5hY3RpdmVWaWRlb0RhdGEgOiBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IHZpZGVvSWQpO1xuICBpZiAoIXZpZGVvKSByZXR1cm47XG4gIGNvbnN0IGlzU2VnbWVudCA9IHZpZGVvLnBhcmVudF92aWRlb19pZCAhPSBudWxsO1xuXG4gIGNvbnN0IGdyb3VwcyA9IFtcbiAgICB7IGhlYWRpbmc6ICdSZXZpZXcnLCByb3dzOiBbXG4gICAgICB7IGxhYmVsOiAnQXBwcm92ZSBBYm92ZSBTY29yZScsIGRlc2NyaXB0aW9uOiAnQXV0b21hdGljYWxseSBhcHByb3ZlIGV2ZXJ5IGNsaXAgaW4gdGhpcyByZWNvcmRpbmcgYWJvdmUgYSBzY29yZSB0aHJlc2hvbGQgeW91IGNob29zZS4nLCBhY3Rpb246ICgpID0+IHdpbmRvdy5vcGVuQXV0b0FwcHJvdmVNb2RhbCh2aWRlb0lkKSB9LFxuICAgIF19LFxuICAgIHsgaGVhZGluZzogJ1JlZ2VuZXJhdGUnLCByb3dzOiBbXG4gICAgICB7IGxhYmVsOiAnUmUtc2NvcmUgQWxsIENsaXBzJywgZGVzY3JpcHRpb246ICdSZWdlbmVyYXRlIHNjb3JlcyBhbmQgZGVzY3JpcHRpb25zIGZvciBldmVyeSBjbGlwIGluIHRoaXMgcmVjb3JkaW5nLicsIGFjdGlvbjogKCkgPT4gd2luZG93LnJlc2NvcmVBbGxDbGlwcyh2aWRlb0lkLCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKSkgfSxcbiAgICAgIHsgbGFiZWw6ICdSZS1kZXNjcmliZSBBbGwgQ2xpcHMnLCBkZXNjcmlwdGlvbjogJ1JlZ2VuZXJhdGUgZGVzY3JpcHRpb25zIG9ubHkgLSBzY29yZXMgYXJlIGtlcHQgYXMtaXMuJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cucmVkZXNjcmliZUFsbENsaXBzKHZpZGVvSWQsIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlLWRldGVjdCBTcGVha2VycycsIGRlc2NyaXB0aW9uOiAnUmUtcnVuIHNwZWFrZXIgZGV0ZWN0aW9uIG9uIHRoZSBleGlzdGluZyB0cmFuc2NyaXB0LiBDbGlwcyBhbmQgc2NvcmVzIGFyZSBrZXB0OyBuYW1lZCBzcGVha2VycyByZS1hdHRhY2ggdG8gbWF0Y2hpbmcgdm9pY2VzLicsIGFjdGlvbjogKCkgPT4gcmVkaWFyaXplVmlkZW8odmlkZW9JZCkgfSxcbiAgICAgIHsgbGFiZWw6ICdSZS10cmFuc2NyaWJlIFJlY29yZGluZycsIGRlc2NyaXB0aW9uOiAnUmUtcnVuIHNwZWVjaC10by10ZXh0IGZvciB0aGUgd2hvbGUgcmVjb3JkaW5nLiBDbGlwcyBhcmUga2VwdCBidXQgZmxhZ2dlZCBmb3IgYSByZS1zY29yZTsgcmVnZW5lcmF0ZSBjbGlwcyB0byByZWJ1aWxkIHRoZW0gZnJvbSB0aGUgbmV3IHRyYW5zY3JpcHQuJywgYWN0aW9uOiAoKSA9PiByZXRyYW5zY3JpYmVWaWRlb1J1bih2aWRlb0lkKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlLWV4dHJhY3QgQXVkaW8nLCBkZXNjcmlwdGlvbjogJ1JlYnVpbGQgdGhlIGF1ZGlvIHRyYWNrcyBmcm9tIHRoZSBzb3VyY2UgZmlsZSwgZS5nLiBhZnRlciBjaGFuZ2luZyB0aGUgdHJhY2sgbGF5b3V0LiBSZS10cmFuc2NyaWJlIGFmdGVyd2FyZCB0byB1cGRhdGUgdGhlIHRyYW5zY3JpcHQuJywgYWN0aW9uOiAoKSA9PiByZWV4dHJhY3RWaWRlb1J1bih2aWRlb0lkKSB9LFxuICAgICAgLi4uKHdpbmRvdy5oYXNFbmFibGVkU2VtYW50aWNIb3R3b3JkcygpID8gW1xuICAgICAgICB7IGxhYmVsOiAnU2NhbiBmb3IgSG90LXdvcmRzJywgZGVzY3JpcHRpb246ICdDaGVjayBldmVyeSBjbGlwIGFnYWluc3QgeW91ciBcIk1lYW5pbmdcIiBob3Qtd29yZHMgdXNpbmcgdGhlIFNpbWlsYXJpdHkgZW5naW5lLicsIGFjdGlvbjogKCkgPT4gd2luZG93LmNvbmZpcm1TY2FuSG90d29yZHNGb3JWaWRlbyh2aWRlb0lkLCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKSkgfSxcbiAgICAgIF0gOiBbXSksXG4gICAgXX0sXG4gICAgeyBoZWFkaW5nOiAnUmVjb3JkaW5nIHRvb2xzJywgcm93czogW1xuICAgICAgLi4uKGlzU2VnbWVudCA/IFtdIDogW1xuICAgICAgICB7IGxhYmVsOiAnU3BsaXQgUmVjb3JkaW5nJywgZGVzY3JpcHRpb246ICdCcmVhayB0aGlzIHJlY29yZGluZyBpbnRvIHNlZ21lbnRzIHRoYXQgY2FuIGJlIGFuYWx5emVkIGluZGVwZW5kZW50bHkuJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cub3BlblNwbGl0RWRpdG9yKHZpZGVvSWQpIH0sXG4gICAgICBdKSxcbiAgICAgIC4uLihpc1NlZ21lbnQgPyBbXG4gICAgICAgIHsgbGFiZWw6ICdVbmRvIFNwbGl0JywgZGVzY3JpcHRpb246ICdNZXJnZSB0aGlzIHNlZ21lbnQgYW5kIGl0cyBzaWJsaW5ncyBiYWNrIGludG8gdGhlIG9yaWdpbmFsIHJlY29yZGluZywga2VlcGluZyBhbGwgb2YgdGhlaXIgY2xpcHMuJywgYWN0aW9uOiAoKSA9PiB1bnNwbGl0VmlkZW8odmlkZW9JZCkgfSxcbiAgICAgIF0gOiBbXSksXG4gICAgICB7IGxhYmVsOiAnU2F2ZSBDYXB0aW9ucyB0byBTUlQnLCBkZXNjcmlwdGlvbjogJ1dyaXRlIHRoZSB0cmFuc2NyaXB0IGFzIGFuIFNSVCBjYXB0aW9uIGZpbGUgbmV4dCB0byB0aGUgc291cmNlIHJlY29yZGluZy4nLCBhY3Rpb246ICgpID0+IGV4cG9ydFZpZGVvVHJhbnNjcmlwdCh2aWRlb0lkKSB9LFxuICAgIF19LFxuICAgIHsgaGVhZGluZzogJ0RhbmdlciBab25lJywgcm93czogW1xuICAgICAgeyBsYWJlbDogJ1JlZ2VuZXJhdGUgQ2xpcHMnLCBkZXNjcmlwdGlvbjogJ1JlYnVpbGQgY2xpcHMgZnJvbSB0aGUgZXhpc3RpbmcgdHJhbnNjcmlwdC4gUmVwbGFjZXMgZXZlcnkgY2xpcCAtIGRpc2NhcmRpbmcgYXBwcm92YWxzLCBlZGl0cywgdGFncywgYW5kIHNjb3JlcyAtIHdpdGggZnJlc2gsIHVuc2NvcmVkIGNhbmRpZGF0ZXMuIFNraXBzIHJlLXRyYW5zY3JpcHRpb24uJywgZGFuZ2VyOiB0cnVlLCBhY3Rpb246ICgpID0+IHJlZ2VuZXJhdGVDbGlwc1J1bih2aWRlb0lkKSB9LFxuICAgICAgeyBsYWJlbDogJ1JlLWFuYWx5emUgKGZ1bGwpJywgZGVzY3JpcHRpb246ICdSZS1ydW4gdGhlIGVudGlyZSBwaXBlbGluZSBmcm9tIHNjcmF0Y2guIFJlcGxhY2VzIGFsbCBjbGlwcywgc2NvcmVzLCBhbmQgc3BlYWtlcnMgZm9yIHRoaXMgcmVjb3JkaW5nLicsIGRhbmdlcjogdHJ1ZSwgYWN0aW9uOiAoKSA9PiByZWFuYWx5emVWaWRlbyh2aWRlb0lkKSB9LFxuICAgICAgeyBsYWJlbDogJ1Jlc2V0IEFwcHJvdmFscycsIGRlc2NyaXB0aW9uOiAnQ2xlYXIgdGhlIGFwcHJvdmUvcmVqZWN0IHN0YXR1cyBvbiBldmVyeSBjbGlwIGluIHRoaXMgcmVjb3JkaW5nLicsIGRhbmdlcjogdHJ1ZSwgYWN0aW9uOiAoKSA9PiB3aW5kb3cucmVzZXRBcHByb3ZhbHModmlkZW9JZCkgfSxcbiAgICAgIHsgbGFiZWw6ICdSZW1vdmUgUmVjb3JkaW5nJywgZGVzY3JpcHRpb246ICdSZW1vdmUgdGhpcyByZWNvcmRpbmcgZnJvbSBZdXVDbGlwLiBUaGUgc291cmNlIGZpbGUgb24gZGlzayBpcyBub3QgZGVsZXRlZC4nLCBkYW5nZXI6IHRydWUsIGFjdGlvbjogKCkgPT4gZGVsZXRlVmlkZW8odmlkZW9JZCkgfSxcbiAgICBdfSxcbiAgXTtcblxuICBvcGVuQWN0aW9uc01vZGFsKGAke3ZpZGVvLnRpdGxlIHx8IHZpZGVvLmZpbGVuYW1lfSAtIEFkZGl0aW9uYWwgQWN0aW9uc2AsIGdyb3Vwcyk7XG59XG5cbi8vIOKUgOKUgCByZWNvcmRpbmcgcmVtb3ZhbCArIHRyYW5zY3JpcHQgZXhwb3J0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuYXN5bmMgZnVuY3Rpb24gZXhwb3J0VmlkZW9UcmFuc2NyaXB0KGlkLCBidG4pIHtcbiAgYXdhaXQgX2RvRXhwb3J0VmlkZW9UcmFuc2NyaXB0KGlkLCBidG4sIGZhbHNlKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvRXhwb3J0VmlkZW9UcmFuc2NyaXB0KGlkLCBidG4sIG92ZXJ3cml0ZSkge1xuICBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IHRydWU7IGJ0bi50ZXh0Q29udGVudCA9ICdFeHBvcnRpbmfigKYnOyB9XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7aWR9L2V4cG9ydC10cmFuc2NyaXB0P292ZXJ3cml0ZT0ke292ZXJ3cml0ZX1gLCB7bWV0aG9kOiAnUE9TVCd9KTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICBpZiAocmVzLnN0YXR1cyA9PT0gNDA5ICYmIGRhdGEuZXhpc3RzKSB7XG4gICAgICBzaG93Q29uZmlybShcbiAgICAgICAgJ092ZXJ3cml0ZSBleGlzdGluZyBjYXB0aW9ucz8nLFxuICAgICAgICBgQW4gU1JUIGZpbGUgYWxyZWFkeSBleGlzdHMgYXQ6PGJyPjxjb2RlPiR7ZXNjSHRtbChkYXRhLnBhdGgpfTwvY29kZT48YnI+PGJyPk92ZXJ3cml0ZSBpdCB3aXRoIHRoZSBjdXJyZW50IHRyYW5zY3JpcHQ/YCxcbiAgICAgICAgJ092ZXJ3cml0ZScsXG4gICAgICAgICgpID0+IF9kb0V4cG9ydFZpZGVvVHJhbnNjcmlwdChpZCwgYnRuLCB0cnVlKSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0QXBpRXJyb3IoZGF0YSkpO1xuICAgIHNob3dUb2FzdChgQ2FwdGlvbnMgZXhwb3J0ZWQg4oaSICR7ZGF0YS5wYXRofWApO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBzaG93VG9hc3QoYEV4cG9ydCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCwgJ2Vycm9yJyk7XG4gIH0gZmluYWxseSB7XG4gICAgaWYgKGJ0bikgeyBidG4uZGlzYWJsZWQgPSBmYWxzZTsgYnRuLnRleHRDb250ZW50ID0gJ1NhdmUgQ2FwdGlvbnMgdG8gU1JUJzsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGRlbGV0ZVZpZGVvKGlkKSB7XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gIGNvbnN0IG5hbWUgID0gdmlkZW8gPyB2aWRlby5maWxlbmFtZSA6IGByZWNvcmRpbmcgJHtpZH1gO1xuICBzaG93Q29uZmlybShcbiAgICAnUmVtb3ZlIHJlY29yZGluZz8nLFxuICAgIGBSZW1vdmUgPHN0cm9uZz4ke2VzY0h0bWwobmFtZSl9PC9zdHJvbmc+IGZyb20gWXV1Q2xpcD88YnI+PGJyPmAgK1xuICAgIGBBbGwgY2xpcHMsIHRyYW5zY3JpcHRzLCBhbmQgZXh0cmFjdGVkIGF1ZGlvIGFyZSByZW1vdmVkIGZyb20gdGhlIGRhdGFiYXNlLiBgICtcbiAgICBgWW91ciBzb3VyY2UgcmVjb3JkaW5nIGZpbGUgaXMgPHN0cm9uZz5ub3Q8L3N0cm9uZz4gZGVsZXRlZC5gLFxuICAgICdSZW1vdmUnLFxuICAgICgpID0+IF9kb0RlbGV0ZVZpZGVvKGlkLCBuYW1lKSxcbiAgICB0cnVlLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZG9EZWxldGVWaWRlbyhpZCwgbmFtZSkge1xuICAvLyBSZWxlYXNlIHRoZSBwbGF5ZXIgc28gaXRzIGJhY2tpbmcgZXhwb3J0L3ByZXZpZXcgZmlsZSBpc24ndCBsb2NrZWQgZHVyaW5nIGRlbGV0ZS5cbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPT09IGlkKSBhd2FpdCB3aW5kb3cuX3JlbGVhc2VQbGF5ZXJCZWZvcmVEZWxldGUoKTtcbiAgY29uc3QgZGVsUmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7aWR9YCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgaWYgKCFkZWxSZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCBkZWxSZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChgRmFpbGVkIHRvIHJlbW92ZSByZWNvcmRpbmc6ICR7Zm9ybWF0QXBpRXJyb3IoZXJyKX1gLCAnZXJyb3InKTtcbiAgICBpZiAoQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSB3aW5kb3cuc2VsZWN0Q2xpcChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIHtcbiAgICBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID0gbnVsbDtcbiAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgID0gbnVsbDtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1saXN0JykuaW5uZXJIVE1MID0gJyc7XG4gICAgd2luZG93LmNsZWFyRGV0YWlsKCk7XG4gIH1cbiAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICBzaG93VG9hc3QoYFwiJHtuYW1lfVwiIHJlbW92ZWQgZnJvbSBZdXVDbGlwYCk7XG59XG5cbi8vIOKUgOKUgCBsaXZlIGFuYWx5c2lzIHByb2dyZXNzIChpbi1kZXRhaWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gQSByZWNvcmRpbmcgaXMgXCJiZWluZyBhbmFseXplZFwiIHdoZW4gaXQgbWF0Y2hlcyB0aGUgZmlsZW5hbWUgb2YgdGhlIGFjdGl2ZVxuLy8gYW5hbHl6ZSBqb2IgKEFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSwgc2V0IG9uIHN0YXJ0L3JlYXR0YWNoKSBhbmQgaGFzbid0IHlldFxuLy8gcmVhY2hlZCAnZG9uZScuIFNhbWUgcnVsZSB0aGUgc2lkZWJhciB1c2VzIGZvciBpdHMgc3Bpbm5lci5cbmZ1bmN0aW9uIF9pc1ZpZGVvQmVpbmdBbmFseXplZCh2aWRlbykge1xuICByZXR1cm4gISFBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWVcbiAgICAmJiB2aWRlby5maWxlbmFtZSA9PT0gQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lXG4gICAgJiYgdmlkZW8uc3RhdHVzICE9PSAnZG9uZSc7XG59XG5cbmZ1bmN0aW9uIF9hbmFseXNpc0xpdmVQYW5lbEhUTUwoKSB7XG4gIHJldHVybiBgXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkIGFuYWx5c2lzLWxpdmVcIiBpZD1cImFuYWx5c2lzLWxpdmUtcGFuZWxcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZC1oZWFkZXJcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPjxzcGFuIGNsYXNzPVwic3Bpbm5lclwiPjwvc3Bhbj4gQW5hbHlzaXMgaW4gcHJvZ3Jlc3M8L3NwYW4+XG4gICAgICAgIDxzcGFuIHN0eWxlPVwiZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTBweFwiPlxuICAgICAgICAgIDxzcGFuIGNsYXNzPVwibXV0ZWRcIiBpZD1cImFuYWx5c2lzLWxpdmUtZWxhcHNlZFwiIHN0eWxlPVwiZm9udC1zaXplOjEycHhcIj48L3NwYW4+XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIGRhdGEtYWN0PVwiY2FuY2VsLWpvYlwiIHN0eWxlPVwiZm9udC1zaXplOjEycHg7cGFkZGluZzoycHggMTBweFwiPkNhbmNlbDwvYnV0dG9uPlxuICAgICAgICA8L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgaWQ9XCJhbmFseXNpcy1saXZlLXN0ZXBzXCIgY2xhc3M9XCJqb2Itc3RlcHMtZGV0YWlsXCI+PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwibXV0ZWRcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O21hcmdpbi10b3A6OHB4XCI+UnVucyBpbiB0aGUgYmFja2dyb3VuZCAtIHlvdSBjYW4gbGVhdmUgb3IgcmVmcmVzaCB0aGlzIHBhZ2Ugd2l0aG91dCBpbnRlcnJ1cHRpbmcgaXQuPC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuLy8gTWlycm9yIHRoZSBoZWFkZXIgcHJvZ3Jlc3MgYmFyJ3Mgc3RlcCBzdGF0ZSBpbnRvIHRoZSBpbi1kZXRhaWwgcGFuZWwuIERyaXZlbiBieVxuLy8gdGhlIGFuYWx5emUgU1NFIHN0cmVhbSAodXBkYXRlSm9iVUkgLyBfdGlja0pvYlRpbWVyIGluIGpvYnMuanMpLiBSZWFkcyBqb2JzLmpzJ3Ncbi8vIHNoYXJlZCBqb2Itc3RlcCBzdGF0ZSBvZmYgd2luZG93IChqb2JzLmpzIGJyaWRnZXMgdGhlc2UgdmlhIGxpdmUgZ2V0L3NldFxuLy8gYWNjZXNzb3JzLCBzaW5jZSBhIHBsYWluIGltcG9ydCBzbmFwc2hvdCB3b3VsZCBnbyBzdGFsZSBvbiByZWFzc2lnbm1lbnQpOyBlbGFwc2VkXG4vLyB1c2VzIHRoZSBzZXJ2ZXItc2lkZSBhbmFseXplX3N0YXJ0ZWRfYXQgc28gaXQgc3RheXMgYWNjdXJhdGUgYWNyb3NzIGEgcmVmcmVzaFxuLy8gKHVubGlrZSB0aGUgaGVhZGVyIHBpbGwsIHdoaWNoIHJlc3RhcnRzIGF0IDApLlxuZnVuY3Rpb24gX3N5bmNBbmFseXNpc0xpdmVQYW5lbCgpIHtcbiAgY29uc3Qgc3RlcHNFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbmFseXNpcy1saXZlLXN0ZXBzJyk7XG4gIGlmICghc3RlcHNFbCkgcmV0dXJuO1xuICBzdGVwc0VsLmlubmVySFRNTCA9IHdpbmRvdy5fam9iU3RlcERlZnMubWFwKChzdGVwLCBpKSA9PiB7XG4gICAgY29uc3QgY2xzID0gaSA8IHdpbmRvdy5fYWN0aXZlU3RlcElkeCA/ICdkb25lJyA6IGkgPT09IHdpbmRvdy5fYWN0aXZlU3RlcElkeCA/ICdhY3RpdmUnIDogJyc7XG4gICAgaWYgKGkgIT09IHdpbmRvdy5fYWN0aXZlU3RlcElkeCkgcmV0dXJuIGA8c3BhbiBjbGFzcz1cInN0ZXAgJHtjbHN9XCI+JHtlc2NIdG1sKHN0ZXAubGFiZWwpfTwvc3Bhbj5gO1xuICAgIC8vIEFjdGl2ZSBzdGVwIG1pcnJvcnMgdGhlIGhlYWRlciBwaWxsOiBsaXZlIGxhYmVsICsgdGhlIHNhbWUgdHdvLXRvbmUgZmlsbC5cbiAgICBjb25zdCB7dGV4dCwgcGN0fSA9IF9zdGVwUGlsbExhYmVsKGkpO1xuICAgIGNvbnN0IGZpbGwgPSBwY3QgIT0gbnVsbFxuICAgICAgPyBgIHN0eWxlPVwiYmFja2dyb3VuZC1pbWFnZTpsaW5lYXItZ3JhZGllbnQodG8gcmlnaHQsIHZhcigtLWdyZWVuKSAke3BjdH0lLCB2YXIoLS1hY2NlbnQpICR7cGN0fSUpXCJgXG4gICAgICA6ICcnO1xuICAgIHJldHVybiBgPHNwYW4gY2xhc3M9XCJzdGVwICR7Y2xzfVwiJHtmaWxsfT4ke2VzY0h0bWwodGV4dCl9PC9zcGFuPmA7XG4gIH0pLmpvaW4oJycpO1xuXG4gIGNvbnN0IGVsYXBzZWRFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbmFseXNpcy1saXZlLWVsYXBzZWQnKTtcbiAgaWYgKGVsYXBzZWRFbCkge1xuICAgIGNvbnN0IHN0YXJ0SXNvID0gQXBwU3RhdGUuYWN0aXZlVmlkZW9EYXRhICYmIEFwcFN0YXRlLmFjdGl2ZVZpZGVvRGF0YS5hbmFseXplX3N0YXJ0ZWRfYXQ7XG4gICAgY29uc3Qgc3RhcnRNcyAgPSBzdGFydElzbyA/IF9wYXJzZVNlcnZlckRhdGUoc3RhcnRJc28pLmdldFRpbWUoKSA6IHdpbmRvdy5fam9iU3RhcnRUaW1lO1xuICAgIGVsYXBzZWRFbC50ZXh0Q29udGVudCA9IF9mbXRFbGFwc2VkKERhdGUubm93KCkgLSBzdGFydE1zKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfcmVuZGVyQ29udGV4dFNlY3Rpb24odmlkZW8pIHtcbiAgY29uc3QgYXNzaWduZWQgPSB2aWRlby5jb250ZXh0X25hbWVzIHx8IFtdO1xuICBjb25zdCBjaGlwcyA9IGFzc2lnbmVkLm1hcChjb250ZXh0X2lkID0+IHtcbiAgICBjb25zdCBjdHggPSBBcHBTdGF0ZS5jb250ZXh0cy5maW5kKGMgPT4gYy5jb250ZXh0X2lkID09PSBjb250ZXh0X2lkKTtcbiAgICBjb25zdCBuYW1lID0gY3R4ID8gY3R4LmRpc3BsYXlfbmFtZSA6IGNvbnRleHRfaWQ7XG4gICAgcmV0dXJuIGA8c3BhbiBjbGFzcz1cImNvbnRleHQtY2hpcFwiPiR7ZXNjSHRtbChuYW1lKX08YnV0dG9uIGNsYXNzPVwiY2hpcC14XCIgZGF0YS1ybWN0eD1cIiR7ZXNjSHRtbChjb250ZXh0X2lkKX1cIiB0aXRsZT1cIlJlbW92ZVwiIGFyaWEtbGFiZWw9XCJSZW1vdmUgJHtlc2NIdG1sKG5hbWUpfVwiPsOXPC9idXR0b24+PC9zcGFuPmA7XG4gIH0pO1xuXG4gIGNvbnN0IGF2YWlsYWJsZSA9IEFwcFN0YXRlLmNvbnRleHRzLmZpbHRlcihjID0+ICFhc3NpZ25lZC5pbmNsdWRlcyhjLmNvbnRleHRfaWQpKTtcbiAgY29uc3QgYWRkU2VsZWN0ID0gYXZhaWxhYmxlLmxlbmd0aFxuICAgID8gYDxzZWxlY3Qgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA3cHg7YmFja2dyb3VuZDp2YXIoLS1iZyk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2JvcmRlci1yYWRpdXM6MTBweDtjb2xvcjp2YXIoLS1tdXRlZCk7Y3Vyc29yOnBvaW50ZXJcIlxuICAgICAgICAgICAgICBkYXRhLWFjdD1cImFkZC12aWRlby1jb250ZXh0XCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+XG4gICAgICAgIDxvcHRpb24gdmFsdWU9XCJcIj4rIEFkZDwvb3B0aW9uPlxuICAgICAgICAke2F2YWlsYWJsZS5tYXAoYyA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjSHRtbChjLmNvbnRleHRfaWQpfVwiPiR7ZXNjSHRtbChjLmRpc3BsYXlfbmFtZSB8fCBjLmNvbnRleHRfaWQpfTwvb3B0aW9uPmApLmpvaW4oJycpfVxuICAgICAgIDwvc2VsZWN0PmAgOiAnJztcblxuICBjb25zdCBwcm92TGluZXMgPSBbXTtcbiAgaWYgKHZpZGVvLmNsaXBzX3Njb3JlZF9hdCkge1xuICAgIGNvbnN0IHNjb3JlZEN0eCA9IHZpZGVvLmNsaXBzX3Njb3JlZF9jb250ZXh0IHx8IFtdO1xuICAgIGNvbnN0IHN0YWxlID0gSlNPTi5zdHJpbmdpZnkoWy4uLmFzc2lnbmVkXS5zb3J0KCkpICE9PSBKU09OLnN0cmluZ2lmeShbLi4uc2NvcmVkQ3R4XS5zb3J0KCkpO1xuICAgIGNvbnN0IHdoZW4gPSBfZm10RGF0ZSh2aWRlby5jbGlwc19zY29yZWRfYXQpO1xuICAgIGNvbnN0IGN0eE5hbWVzID0gc2NvcmVkQ3R4Lm1hcChzID0+IHsgY29uc3QgYyA9IEFwcFN0YXRlLmNvbnRleHRzLmZpbmQoeCA9PiB4LmNvbnRleHRfaWQgPT09IHMpOyByZXR1cm4gYyA/IGMuZGlzcGxheV9uYW1lIDogczsgfSk7XG4gICAgY29uc3QgY3R4U3RyID0gY3R4TmFtZXMubGVuZ3RoID8gJyDCtyAnICsgY3R4TmFtZXMubWFwKGVzY0h0bWwpLmpvaW4oJywgJykgOiAnIMK3IG5vIGNvbnRleHQnO1xuICAgIHByb3ZMaW5lcy5wdXNoKGA8c3BhbiBjbGFzcz1cIiR7c3RhbGUgPyAncHJvdmVuYW5jZS1zdGFsZScgOiAnJ31cIj5DbGlwcyBzY29yZWQgJHtlc2NIdG1sKHdoZW4pfSR7Y3R4U3RyfSR7c3RhbGUgPyAnIC0g4pqgIGNvbnRleHRzIGNoYW5nZWQgc2luY2UgbGFzdCBzY29yZScgOiAnJ308L3NwYW4+YCk7XG4gIH1cbiAgaWYgKHZpZGVvLmFuYWx5emVfcnVuKSBwcm92TGluZXMucHVzaChgPHNwYW4+JHtlc2NIdG1sKHdpbmRvdy5fcnVuVGltaW5nTGluZSh2aWRlby5hbmFseXplX3J1bikpfTwvc3Bhbj5gKTtcblxuICBjb25zdCBub0NvbnRleHRzRGVmaW5lZCA9IEFwcFN0YXRlLmNvbnRleHRzLmxlbmd0aCA9PT0gMDtcbiAgY29uc3QgZW1wdHlNc2cgPSBub0NvbnRleHRzRGVmaW5lZFxuICAgID8gYDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4XCI+Tm8gY29udGV4dHMgZGVmaW5lZCAtIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cInBhZGRpbmc6MDtkaXNwbGF5OmlubGluZTtmb250LXNpemU6MTJweFwiIGRhdGEtYWN0PVwib3Blbi1jb250ZXh0LW1hbmFnZXJcIj5jcmVhdGUgb25lPC9idXR0b24+PC9zcGFuPmBcbiAgICA6ICghYXNzaWduZWQubGVuZ3RoID8gYDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4XCI+Tm9uZSBhc3NpZ25lZDwvc3Bhbj5gIDogJycpO1xuXG4gIGNvbnN0IHJlc2NvcmVCdG4gPSAoYXNzaWduZWQubGVuZ3RoICYmIHZpZGVvLmNsaXBzX3Njb3JlZF9hdClcbiAgICA/IGA8YnV0dG9uIGNsYXNzPVwiYnRuXCIgc3R5bGU9XCJmb250LXNpemU6MTJweDtwYWRkaW5nOjRweCAxMnB4XCIgZGF0YS1hY3Q9XCJyZXNjb3JlLWNsaXBzXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCI+UmUtc2NvcmUgY2xpcHMgd2l0aCBjb250ZXh0PC9idXR0b24+YFxuICAgIDogYXNzaWduZWQubGVuZ3RoXG4gICAgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0blwiIHN0eWxlPVwiZm9udC1zaXplOjEycHg7cGFkZGluZzo0cHggMTJweFwiIGRhdGEtYWN0PVwicmVzY29yZS1jbGlwc1wiIGRhdGEtdmlkZW8taWQ9XCIke3ZpZGVvLmlkfVwiPlNjb3JlIGNsaXBzIHdpdGggY29udGV4dDwvYnV0dG9uPmBcbiAgICA6ICcnO1xuXG4gIGNvbnN0IGVyckNvdW50ID0gdmlkZW8uY2xpcHNfbGxtX2Vycm9yIHx8IDA7XG4gIC8vIE9ubHkgb2ZmZXIgdGhlIHJldHJ5IHdoZW4gYSBtb2RlbCBjYW4gYWN0dWFsbHkgcnVuIC0gb3RoZXJ3aXNlIHJlLXNjb3JpbmcgdGhlXG4gIC8vIFwiZmFpbGVkXCIgY2xpcHMganVzdCBmYWlscyBhZ2Fpbi4gV2l0aCBubyBtb2RlbCB0aGVzZSBhcmVuJ3QgZmFpbHVyZXMsIHRoZXkncmVcbiAgLy8gY2xpcHMgYXdhaXRpbmcgYSBmaXJzdC1ydW4gbW9kZWwgKHN1cmZhY2VkIGJ5IHRoZSBkZXNjcmlwdGlvbiBwcm9tcHQgaW5zdGVhZCkuXG4gIGNvbnN0IGZhaWxlZEJ0biA9IChlcnJDb3VudCA+IDAgJiYgISEod2luZG93Ll9wcmVyZXFzIHx8IHt9KS5sbG1fb2spXG4gICAgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0blwiIHN0eWxlPVwiZm9udC1zaXplOjEycHg7cGFkZGluZzo0cHggMTJweDtib3JkZXItY29sb3I6dmFyKC0td2FybmluZyk7Y29sb3I6dmFyKC0td2FybmluZylcIiBkYXRhLWFjdD1cInJlc2NvcmUtZmFpbGVkLWNsaXBzXCIgZGF0YS12aWRlby1pZD1cIiR7dmlkZW8uaWR9XCIgdGl0bGU9XCJSZS1ydW4gTExNIHNjb3Jpbmcgb25seSBmb3IgdGhlICR7cGx1cmFsKGVyckNvdW50LCAnY2xpcCcpfSB0aGF0IGZhaWxlZCBsYXN0IHRpbWVcIj4mIzk4ODg7IFJlLXNjb3JlICR7cGx1cmFsKGVyckNvdW50LCAnZmFpbGVkIGNsaXAnKX08L2J1dHRvbj5gXG4gICAgOiAnJztcblxuICByZXR1cm4gY29sbGFwc2libGVDYXJkKCd2aWRlby1jb250ZXh0cycsXG4gICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5Xb3JsZCBDb250ZXh0czwvc3Bhbj5gLCBgXG4gICAgICA8ZGl2IGNsYXNzPVwiY29udGV4dC1jaGlwc1wiPlxuICAgICAgICAke2NoaXBzLmpvaW4oJycpfSR7ZW1wdHlNc2d9JHthZGRTZWxlY3QgPyAnJm5ic3A7JyArIGFkZFNlbGVjdCA6ICcnfVxuICAgICAgPC9kaXY+XG4gICAgICAke3Byb3ZMaW5lcy5sZW5ndGggPyBgPGRpdiBjbGFzcz1cInByb3ZlbmFuY2Utbm90ZVwiPiR7cHJvdkxpbmVzLmpvaW4oJzxicj4nKX08L2Rpdj5gIDogJyd9XG4gICAgICAkeyhyZXNjb3JlQnRuIHx8IGZhaWxlZEJ0bikgPyBgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6NnB4O2Rpc3BsYXk6ZmxleDtnYXA6OHB4O2ZsZXgtd3JhcDp3cmFwXCI+JHtyZXNjb3JlQnRufSR7ZmFpbGVkQnRufTwvZGl2PmAgOiAnJ31gKTtcbn1cblxuLy8gRnJpZW5kbHkgZW1wdHkgc3RhdGUgZm9yIHRoZSBBSSBzdW1tYXJ5L3RpbWVsaW5lIGZlYXR1cmVzIHdoZW4gbm8gbGFuZ3VhZ2UgbW9kZWwgaXNcbi8vIGluc3RhbGxlZCAtIHRoZSBiYWNrZW5kIHJldHVybnMgYSBuZWVkc19tb2RlbCBwYXlsb2FkIGluc3RlYWQgb2YgYSBoYXJkIGVycm9yLCBhbmRcbi8vIHRoaXMgcmVuZGVycyBpdCBhcyBhbiBpbnZpdGluZyBcImluc3RhbGwgYSBsb2NhbCBtb2RlbFwiIGNhbGwgdG8gYWN0aW9uLiBUaGUgaW5zdGFsbFxuLy8gbnVkZ2UgaXMgaGlkZGVuIHdoZW4gdGhlIHBheWxvYWQgYXNrcyBmb3IgaXQgKFN0YWdlIDA3IHByaXZhY3kgbW9kZSkuXG5mdW5jdGlvbiBfbmVlZHNNb2RlbEN0YUhUTUwocGF5bG9hZCkge1xuICBjb25zdCBjdGEgPSBwYXlsb2FkLnNob3dfY3RhID09PSBmYWxzZSA/ICcnIDpcbiAgICBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOXB4XCJcbiAgICAgICBkYXRhLWFjdD1cImluc3RhbGwtbG9jYWwtbW9kZWxcIj5JbnN0YWxsIGEgbG9jYWwgbW9kZWw8L2J1dHRvbj5gO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJuZWVkcy1tb2RlbC1jdGFcIj5cbiAgICA8ZGl2IGNsYXNzPVwibmVlZHMtbW9kZWwtaGVhZGluZ1wiPiR7ZXNjSHRtbChwYXlsb2FkLmhlYWRpbmcpfTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJuZWVkcy1tb2RlbC1kZXRhaWxcIj4ke2VzY0h0bWwocGF5bG9hZC5kZXRhaWwpfTwvZGl2PlxuICAgICR7Y3RhfVxuICA8L2Rpdj5gO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfcmVmcmVzaFZpZGVvRGV0YWlsKHZpZGVvSWQpIHtcbiAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICBjb25zdCB1cGRhdGVkID0gQXBwU3RhdGUudmlkZW9zLmZpbmQoeCA9PiB4LmlkID09PSB2aWRlb0lkKTtcbiAgaWYgKHVwZGF0ZWQpIHJlbmRlclZpZGVvRGV0YWlsKHVwZGF0ZWQsIG51bGwpO1xufVxuXG4vLyDilIDilIAgcmUtYW5hbHlzaXMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBUd28gd2F5cyB0byByZS1ydW4gYW5hbHlzaXMgb24gYW4gYWxyZWFkeS1hbmFseXplZCByZWNvcmRpbmc6XG4vLyAgIHJlYW5hbHl6ZVZpZGVvICAtIGZ1bGwgcGlwZWxpbmUgd2l0aCAtLWZvcmNlIChkZXN0cnVjdGl2ZTogcmVwbGFjZXMgY2xpcHMvc2NvcmVzKS5cbi8vICAgcmVkaWFyaXplVmlkZW8gIC0gc3BlYWtlciBkZXRlY3Rpb24gb25seSAobm9uLWRlc3RydWN0aXZlOiBrZWVwcyBjbGlwcy9zY29yZXMpLlxuLy8gT3BlbnMgdGhlIE5ldyBSZWNvcmRpbmcgcGFuZWwgaW4gcmUtYW5hbHl6ZSBtb2RlOiBzZXR0aW5ncyBkZWZhdWx0IHRvIHRoaXNcbi8vIHJlY29yZGluZydzIG9yaWdpbmFsIHJ1biBidXQgc3RheSBlZGl0YWJsZSwgYW5kIHRoZSBkZXN0cnVjdGl2ZSB3YXJuaW5nIHBsdXNcbi8vIHRoZSBleHBsaWNpdCBcIlJlLWFuYWx5emVcIiBidXR0b24gc3RhbmQgaW4gZm9yIHRoZSBvbGQgY29uZmlybSBkaWFsb2cuXG5mdW5jdGlvbiByZWFuYWx5emVWaWRlbyhpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlLWFuYWx5emUgdGhpcyByZWNvcmRpbmcnKSkgcmV0dXJuO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBpZiAoIXZpZGVvKSByZXR1cm47XG4gIHdpbmRvdy5vcGVuUmVhbmFseXplUGFuZWwodmlkZW8pO1xufVxuXG4vLyBSZWJ1aWxkIGFuIGFuYWx5emUgcmVxdWVzdCB0aGUgd2F5IHRoZSByZWNvcmRpbmcgd2FzIG9yaWdpbmFsbHkgYW5hbHl6ZWRcbi8vIChWaWRlby5hbmFseXplX3J1bi5zZXR0aW5ncyksIGZhbGxpbmcgYmFjayB0byB0aGUgU2V0dGluZ3MtbWFuYWdlZCBjb25maWdcbi8vIGRlZmF1bHRzIHdoZW4gbm8gcnVuIHdhcyByZWNvcmRlZC4gU2hhcmVkIGJ5IHJlLWFuYWx5emUgKGZ1bGwpIGhlcmUgYW5kIHRoZVxuLy8gc3BsaXQgcmUtYW5hbHl6ZSBmbG93IGluIHNwbGl0LmpzLlxuYXN5bmMgZnVuY3Rpb24gX3JlYW5hbHl6ZVBhcmFtcyh2aWRlbykge1xuICBjb25zdCBjdXJyZW50Q29udGV4dHMgPSAodmlkZW8gJiYgdmlkZW8uY29udGV4dF9uYW1lcykgfHwgW107XG4gIGNvbnN0IHJlY29yZGVkID0gdmlkZW8gJiYgdmlkZW8uYW5hbHl6ZV9ydW4gJiYgdmlkZW8uYW5hbHl6ZV9ydW4uc2V0dGluZ3M7XG4gIGlmIChyZWNvcmRlZCAmJiByZWNvcmRlZC5tb2RlbCkge1xuICAgIHJldHVybiB7XG4gICAgICBtb2RlbDogICAgICAgICByZWNvcmRlZC5tb2RlbCxcbiAgICAgIHByb2ZpbGU6ICAgICAgIHJlY29yZGVkLnRyYWNrX2xheW91dCAmJiByZWNvcmRlZC50cmFja19sYXlvdXQgIT09ICdkZWZhdWx0JyA/IHJlY29yZGVkLnRyYWNrX2xheW91dCA6IG51bGwsXG4gICAgICBlbmVyZ3lfbW9kZTogICByZWNvcmRlZC5lbmVyZ3lfbW9kZSB8fCAnZmFzdCcsXG4gICAgICBzY2VuZV9tb2RlOiAgICByZWNvcmRlZC5zY2VuZV9tb2RlIHx8ICdmYXN0JyxcbiAgICAgIGRpYXJpemU6ICAgICAgIHR5cGVvZiByZWNvcmRlZC5zcGVha2VyX2xhYmVscyA9PT0gJ2Jvb2xlYW4nID8gcmVjb3JkZWQuc3BlYWtlcl9sYWJlbHMgOiBudWxsLFxuICAgICAgY29udGV4dF9uYW1lczogY3VycmVudENvbnRleHRzLmxlbmd0aCA/IGN1cnJlbnRDb250ZXh0cyA6IChyZWNvcmRlZC5jb250ZXh0cyB8fCBbXSksXG4gICAgfTtcbiAgfVxuICBsZXQgY2ZnID0ge307XG4gIHRyeSB7IGNmZyA9IGF3YWl0IGZldGNoKCcvYXBpL2NvbmZpZycpLnRoZW4ociA9PiByLmpzb24oKSk7IH0gY2F0Y2ggeyAvKiBrZWVwIHN0YXRpYyBmYWxsYmFja3MgKi8gfVxuICByZXR1cm4ge1xuICAgIG1vZGVsOiAgICAgICAgIGNmZy53aGlzcGVyX21vZGVsIHx8ICdtZWRpdW0nLFxuICAgIHByb2ZpbGU6ICAgICAgIG51bGwsXG4gICAgZW5lcmd5X21vZGU6ICAgY2ZnLmVuZXJneV9tb2RlIHx8ICdmYXN0JyxcbiAgICBzY2VuZV9tb2RlOiAgICBjZmcuc2NlbmVfZGV0ZWN0aW9uX21vZGUgfHwgJ2Zhc3QnLFxuICAgIGRpYXJpemU6ICAgICAgIG51bGwsXG4gICAgY29udGV4dF9uYW1lczogY3VycmVudENvbnRleHRzLFxuICB9O1xufVxuXG5mdW5jdGlvbiByZWRpYXJpemVWaWRlbyhpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlLWRldGVjdCBzcGVha2VycycpKSByZXR1cm47XG4gIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gIGNvbnN0IG5hbWUgPSB2aWRlbyA/IHZpZGVvLmZpbGVuYW1lIDogaWQ7XG4gIG9wZW5Mb2coKTtcbiAgYXBwZW5kTG9nKGBSZS1kZXRlY3Rpbmcgc3BlYWtlcnM6ICR7bmFtZX1gKTtcbiAgc3RyZWFtU1NFKFxuICAgIGAvYXBpL3ZpZGVvcy8ke2lkfS9yZWRpYXJpemVgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgICAgIGNvbnN0IHYgPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh4ID0+IHguaWQgPT09IGlkKTtcbiAgICAgIGlmICh2ICYmIEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPT09IGlkKSByZW5kZXJWaWRlb0RldGFpbCh2LCBudWxsKTtcbiAgICAgIGlmICh3aW5kb3cubG9hZFNwZWFrZXJzKSB3aW5kb3cubG9hZFNwZWFrZXJzKGlkKTtcbiAgICAgIHNob3dUb2FzdCgnU3BlYWtlciBkZXRlY3Rpb24gY29tcGxldGUnKTtcbiAgICAgIHdpbmRvdy5Tb3VuZEZ4LnBsYXkoJ2FuYWx5c2lzJyk7XG4gICAgfSxcbiAgICBbe2xhYmVsOiAnU3BlYWtlcnMnLCBwYXR0ZXJuczogWydEZXRlY3Rpbmcgc3BlYWtlcnMnXX1dLFxuICAgICdSZS1kZXRlY3Rpbmcgc3BlYWtlcnMnLFxuICAgIGZhbHNlLFxuICApO1xufVxuXG4vLyDilIDilIAgc2luZ2xlLXN0YWdlIHJlLXJ1bnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBSZS1ydW4gb25lIHBpcGVsaW5lIHN0YWdlIHdpdGhvdXQgcGF5aW5nIGZvciB0aGUgZWFybGllciBvbmVzLiBEb3duc3RyZWFtIHJlc3VsdHNcbi8vIGFyZSBtYXJrZWQgc3RhbGUgKHZpYSB0aGUgZXhpc3RpbmcgXCJjYXB0aW9ucyBjaGFuZ2VkXCIgLyB1bnNjb3JlZCBiYWRnZXMpIHJhdGhlciB0aGFuXG4vLyBjYXNjYWRlZCAtIHRoZSB1c2VyIGNob29zZXMgd2hlbiB0byByZS1zY29yZSAvIHJlZ2VuZXJhdGUuXG5mdW5jdGlvbiByZWV4dHJhY3RWaWRlb1J1bihpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlLWV4dHJhY3QgYXVkaW8nKSkgcmV0dXJuO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBjb25zdCBuYW1lID0gdmlkZW8gPyB2aWRlby5maWxlbmFtZSA6IGlkO1xuICBvcGVuTG9nKCk7XG4gIGFwcGVuZExvZyhgUmUtZXh0cmFjdGluZyBhdWRpbzogJHtuYW1lfWApO1xuICBzdHJlYW1TU0UoXG4gICAgYC9hcGkvdmlkZW9zLyR7aWR9L3JlZXh0cmFjdGAsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICAgICAgY29uc3QgdiA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHggPT4geC5pZCA9PT0gaWQpO1xuICAgICAgaWYgKHYgJiYgQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIHJlbmRlclZpZGVvRGV0YWlsKHYsIG51bGwpO1xuICAgICAgc2hvd1RvYXN0KCdBdWRpbyByZS1leHRyYWN0ZWQgLSByZS10cmFuc2NyaWJlIHRvIHVwZGF0ZSB0aGUgdHJhbnNjcmlwdCcpO1xuICAgICAgd2luZG93LlNvdW5kRngucGxheSgnYW5hbHlzaXMnKTtcbiAgICB9LFxuICAgIFt7bGFiZWw6ICdFeHRyYWN0JywgcGF0dGVybnM6IFsnRXh0cmFjdGluZyBhdWRpbyddfV0sXG4gICAgJ1JlLWV4dHJhY3RpbmcgYXVkaW8nLFxuICAgIGZhbHNlLFxuICApO1xufVxuXG5mdW5jdGlvbiByZXRyYW5zY3JpYmVWaWRlb1J1bihpZCkge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlLXRyYW5zY3JpYmUgdGhpcyByZWNvcmRpbmcnKSkgcmV0dXJuO1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICBjb25zdCBuYW1lID0gdmlkZW8gPyB2aWRlby5maWxlbmFtZSA6IGlkO1xuICBvcGVuTG9nKCk7XG4gIGFwcGVuZExvZyhgUmUtdHJhbnNjcmliaW5nOiAke25hbWV9YCk7XG4gIHN0cmVhbVNTRShcbiAgICBgL2FwaS92aWRlb3MvJHtpZH0vcmV0cmFuc2NyaWJlYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gICAgICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCA9PT0gaWQpIGF3YWl0IHNlbGVjdFZpZGVvKGlkKTtcbiAgICAgIHNob3dUb2FzdCgnUmUtdHJhbnNjcmlwdGlvbiBjb21wbGV0ZSAtIHJlLXNjb3JlIHRvIHJlZnJlc2ggY2xpcCBzY29yZXMnKTtcbiAgICAgIHdpbmRvdy5Tb3VuZEZ4LnBsYXkoJ2FuYWx5c2lzJyk7XG4gICAgfSxcbiAgICBbe2xhYmVsOiAnRXh0cmFjdCcsIHBhdHRlcm5zOiBbJ0V4dHJhY3RpbmcgYXVkaW8nXX0sIHtsYWJlbDogJ1RyYW5zY3JpYmUnLCBwYXR0ZXJuczogWydUcmFuc2NyaWJpbmcnXX1dLFxuICAgICdSZS10cmFuc2NyaWJpbmcnLFxuICAgIGZhbHNlLFxuICApO1xufVxuXG5mdW5jdGlvbiByZWdlbmVyYXRlQ2xpcHNSdW4oaWQpIHtcbiAgaWYgKF9ibG9ja2VkQnlBbmFseXplKCdyZWdlbmVyYXRlIGNsaXBzJykpIHJldHVybjtcbiAgY29uc3QgdmlkZW8gPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IGlkKTtcbiAgY29uc3QgbmFtZSA9IHZpZGVvID8gdmlkZW8uZmlsZW5hbWUgOiBpZDtcbiAgc2hvd0NvbmZpcm0oXG4gICAgJ1JlZ2VuZXJhdGUgY2xpcHM/JyxcbiAgICAnVGhpcyByZWJ1aWxkcyBldmVyeSBjbGlwIGZyb20gdGhlIGN1cnJlbnQgdHJhbnNjcmlwdCwgZGlzY2FyZGluZyBhbGwgYXBwcm92YWxzLCBlZGl0cywgdGFncywgYW5kIHNjb3JlcyBvbiB0aGlzIHJlY29yZGluZ1xcJ3MgZXhpc3RpbmcgY2xpcHMuIFRoZSB0cmFuc2NyaXB0IGl0c2VsZiBpcyBrZXB0LiBSZS1zY29yZSBhZnRlcndhcmQgdG8gcG9wdWxhdGUgdGhlIG5ldyBjbGlwcy4nLFxuICAgICdSZWdlbmVyYXRlIENsaXBzJyxcbiAgICAoKSA9PiB7XG4gICAgICBvcGVuTG9nKCk7XG4gICAgICBhcHBlbmRMb2coYFJlZ2VuZXJhdGluZyBjbGlwczogJHtuYW1lfWApO1xuICAgICAgc3RyZWFtU1NFKFxuICAgICAgICBgL2FwaS92aWRlb3MvJHtpZH0vcmVnZW5lcmF0ZS1jbGlwc2AsXG4gICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gICAgICAgICAgaWYgKEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgPT09IGlkKSBhd2FpdCBzZWxlY3RWaWRlbyhpZCk7XG4gICAgICAgICAgc2hvd1RvYXN0KCdDbGlwcyByZWdlbmVyYXRlZCAtIHJlLXNjb3JlIHRvIHBvcHVsYXRlIHNjb3JlcycpO1xuICAgICAgICAgIHdpbmRvdy5Tb3VuZEZ4LnBsYXkoJ2FuYWx5c2lzJyk7XG4gICAgICAgIH0sXG4gICAgICAgIFt7bGFiZWw6ICdHZW5lcmF0ZSBDbGlwcycsIHBhdHRlcm5zOiBbJ0dlbmVyYXRpbmcgY2xpcHMnXX1dLFxuICAgICAgICAnUmVnZW5lcmF0aW5nIGNsaXBzJyxcbiAgICAgICAgZmFsc2UsXG4gICAgICApO1xuICAgIH0sXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuLy8g4pSA4pSAIHVuZG8gc3BsaXQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiB1bnNwbGl0VmlkZW8odmlkZW9JZCkge1xuICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gdmlkZW9JZCk7XG4gIGlmICghdmlkZW8gfHwgdmlkZW8ucGFyZW50X3ZpZGVvX2lkID09IG51bGwpIHJldHVybjtcbiAgY29uc3Qgc2libGluZ3MgID0gQXBwU3RhdGUudmlkZW9zLmZpbHRlcih2ID0+IHYucGFyZW50X3ZpZGVvX2lkID09PSB2aWRlby5wYXJlbnRfdmlkZW9faWQpO1xuICBjb25zdCBjbGlwVG90YWwgPSBzaWJsaW5ncy5yZWR1Y2UoKHN1bSwgdikgPT4gc3VtICsgKHYuY2xpcF9jb3VudCB8fCAwKSwgMCk7XG4gIHNob3dDb25maXJtKFxuICAgICdVbmRvIHNwbGl0PycsXG4gICAgYFRoaXMgbWVyZ2VzICR7cGx1cmFsKHNpYmxpbmdzLmxlbmd0aCwgJ3NlZ21lbnQnKX0gLSBhbmQgJHtwbHVyYWwoY2xpcFRvdGFsLCAnY2xpcCcpfSBvbiB0aGVtIC0gYCArXG4gICAgYGJhY2sgaW50byB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nLCByZXN0b3JpbmcgZWFjaCBjbGlwJ3Mgb3JpZ2luYWwgdGltaW5nLiBgICtcbiAgICBgVGhlIHNlZ21lbnRzIGFyZSByZW1vdmVkIGFuZCB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nIGJlY29tZXMgdmlzaWJsZSBhZ2Fpbi5gLFxuICAgICdVbmRvIFNwbGl0JyxcbiAgICAoKSA9PiBfZG9VbnNwbGl0VmlkZW8odmlkZW9JZCksXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvVW5zcGxpdFZpZGVvKHZpZGVvSWQpIHtcbiAgbGV0IHJlcztcbiAgdHJ5IHtcbiAgICByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS91bnNwbGl0YCwge21ldGhvZDogJ1BPU1QnfSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNob3dUb2FzdChuZXRFcnJNc2coZXJyKSwgJ2Vycm9yJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghcmVzLm9rKSB7XG4gICAgY29uc3QgZXJyID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICBzaG93VG9hc3QoYFVuZG8gc3BsaXQgZmFpbGVkOiAke2Zvcm1hdEFwaUVycm9yKGVycil9YCwgJ2Vycm9yJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpO1xuICBzaG93VG9hc3QoYFNwbGl0IHVuZG9uZSAtICR7cGx1cmFsKGRhdGEubWVyZ2VkX2NsaXBzLCAnY2xpcCcpfSByZXN0b3JlZCB0byB0aGUgb3JpZ2luYWwgcmVjb3JkaW5nYCk7XG4gIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgc2VsZWN0VmlkZW8oZGF0YS5wYXJlbnRfaWQpO1xufVxuXG5mdW5jdGlvbiBfb3BlblZpZGVvRmllbGRLZWJhYih2aWRlb0lkLCBidG4sIGZpZWxkKSB7XG4gIGNvbnN0IHZpZGVvICAgICAgPSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0RhdGE7XG4gIGNvbnN0IGlzVGl0bGUgICAgPSBmaWVsZCA9PT0gJ3RpdGxlJztcbiAgY29uc3QgZWRpdFRpdGxlICA9IGlzVGl0bGUgPyAnRWRpdCBUaXRsZScgICA6ICdFZGl0IFN1bW1hcnknO1xuICBjb25zdCByZXZlcnRUaXRsZSA9IGlzVGl0bGUgPyAnUmV2ZXJ0IFRpdGxlJyA6ICdSZXZlcnQgU3VtbWFyeSc7XG4gIGNvbnN0IGRpZmZMYWJlbCAgPSBpc1RpdGxlID8gJ1RpdGxlJyAgICAgICAgIDogJ1N1bW1hcnknO1xuICBjb25zdCBjdXJyZW50ICAgID0gaXNUaXRsZSA/IHZpZGVvPy50aXRsZSAgICA6IHZpZGVvPy5zdW1tYXJ5O1xuICBjb25zdCBpc0VkaXRlZCAgID0gaXNUaXRsZSA/IHZpZGVvPy50aXRsZV9pc19lZGl0ZWQgICA6IHZpZGVvPy5zdW1tYXJ5X2lzX2VkaXRlZDtcbiAgY29uc3Qgb3JpZ2luYWwgICA9IGlzVGl0bGUgPyB2aWRlbz8udGl0bGVfb3JpZ2luYWwgICAgOiB2aWRlbz8uc3VtbWFyeV9vcmlnaW5hbDtcblxuICBjb25zdCBpdGVtcyA9IFtcbiAgICB7IGxhYmVsOiAnRWRpdCcsIGFjdGlvbjogKCkgPT5cbiAgICAgIG9wZW5GaWVsZEVkaXRNb2RhbChlZGl0VGl0bGUsIGN1cnJlbnQgfHwgJycsIGFzeW5jIHYgPT4ge1xuICAgICAgICBhd2FpdCBfcGF0Y2hWaWRlb0ZpZWxkKHZpZGVvSWQsICdhY2NlcHRfZWRpdCcsIGZpZWxkLFxuICAgICAgICAgIGlzVGl0bGUgPyB2IDogbnVsbCwgaXNUaXRsZSA/IG51bGwgOiB2KTtcbiAgICAgICAgYXdhaXQgX3JlZnJlc2hWaWRlb0RldGFpbCh2aWRlb0lkKTtcbiAgICAgIH0pXG4gICAgfSxcbiAgXTtcbiAgaWYgKGlzRWRpdGVkKSB7XG4gICAgaXRlbXMucHVzaCh7IGxhYmVsOiAnUmV2ZXJ0IHRvIE9yaWdpbmFsJywgYWN0aW9uOiAoKSA9PlxuICAgICAgb3BlbkRpZmZNb2RhbChyZXZlcnRUaXRsZSwgW1xuICAgICAgICB7bGFiZWw6IGRpZmZMYWJlbCwgY3VycmVudCwgcHJvcG9zZWQ6IG9yaWdpbmFsfSxcbiAgICAgIF0sIGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgX3BhdGNoVmlkZW9GaWVsZCh2aWRlb0lkLCAncmV2ZXJ0JywgZmllbGQsIG51bGwsIG51bGwpO1xuICAgICAgICBhd2FpdCBfcmVmcmVzaFZpZGVvRGV0YWlsKHZpZGVvSWQpO1xuICAgICAgfSwge3JldmVydE1vZGU6IHRydWV9KVxuICAgIH0pO1xuICB9XG4gIGl0ZW1zLnB1c2gobnVsbCwgeyBsYWJlbDogJ1JlZ2VuZXJhdGUnLCBhY3Rpb246ICgpID0+IHdpbmRvdy5zdW1tYXJpemVWaWRlbyh2aWRlb0lkLCBudWxsKSB9KTtcbiAgaWYgKCFpc1RpdGxlKSBpdGVtcy5wdXNoKHsgbGFiZWw6ICdSZWdlbmVyYXRlIChhdXRvLXNhdmUpJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cucmVnZW5TdW1tYXJ5QXV0byh2aWRlb0lkLCBudWxsKSB9KTtcbiAgc2hvd0tlYmFiKGJ0biwgaXRlbXMpO1xufVxuXG5mdW5jdGlvbiBvcGVuVmlkZW9UaXRsZUtlYmFiKHZpZGVvSWQsIGJ0bikgICB7IF9vcGVuVmlkZW9GaWVsZEtlYmFiKHZpZGVvSWQsIGJ0biwgJ3RpdGxlJyk7IH1cbmZ1bmN0aW9uIG9wZW5WaWRlb1N1bW1hcnlLZWJhYih2aWRlb0lkLCBidG4pIHsgX29wZW5WaWRlb0ZpZWxkS2ViYWIodmlkZW9JZCwgYnRuLCAnc3VtbWFyeScpOyB9XG5cbmFzeW5jIGZ1bmN0aW9uIF9wYXRjaFZpZGVvRmllbGQodmlkZW9JZCwgYWN0aW9uLCBmaWVsZCwgbmV3VGl0bGUsIG5ld1N1bW1hcnkpIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vZmllbGRzYCwge1xuICAgIG1ldGhvZDogJ1BBVENIJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHthY3Rpb24sIGZpZWxkLCBuZXdfdGl0bGU6IG5ld1RpdGxlLCBuZXdfc3VtbWFyeTogbmV3U3VtbWFyeX0pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHNob3dUb2FzdCgnU2F2ZSBmYWlsZWQnLCAnZXJyb3InKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gb25DbGlwc1NvcnRDaGFuZ2UoKSB7XG4gIGlmICghQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkgcmV0dXJuO1xuICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnY2xpcHMtc29ydCcsIF9jbGlwc1NvcnRQYXJhbSgpKTtcbiAgdHJ5IHtcbiAgICBBcHBTdGF0ZS5jbGlwcyA9IGF3YWl0IGZldGNoKF9jbGlwc0xpc3RVcmwoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gIH0gY2F0Y2ggeyByZXR1cm47IH1cbiAgd2luZG93Ll9yZW5kZXJDbGlwcygpO1xufVxuXG4vLyDilIDilIAgaW4tZGV0YWlsIGFjdGlvbiBkZWxlZ2F0aW9uIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gI2RldGFpbCdzIGlubmVySFRNTCBpcyByZWJ1aWx0IHdob2xlc2FsZSBieSByZW5kZXJWaWRlb0RldGFpbC9fc2hvd0VtcHR5U3RhdGVcbi8vIChhbmQgYnkgb3RoZXIgbW9kdWxlcycgY29kZSB0aGF0IGFsc28gdGFyZ2V0cyAjZGV0YWlsLCBlLmcuIGNsaXBzLmpzJ3MgY2xpcFxuLy8gZGV0YWlsIHZpZXcpLCBzbyB0aGUgY2xpY2svY2hhbmdlIGxpc3RlbmVycyBhcmUgd2lyZWQgb25jZSBvbiB0aGUgY29udGFpbmVyXG4vLyBpdHNlbGYgLSBzZWUgdGhlIGFkZEV2ZW50TGlzdGVuZXIgY2FsbHMgYXQgdGhlIGJvdHRvbSBvZiB0aGlzIGZpbGUgLSByYXRoZXJcbi8vIHRoYW4gcmUtYXR0YWNoZWQgcGVyIHJlbmRlci4gVGhlIGNvbnRhaW5lciBub2RlIHBlcnNpc3RzIGFjcm9zcyBldmVyeSByZW5kZXI7XG4vLyBvbmx5IGl0cyBjaGlsZHJlbiBhcmUgcmVwbGFjZWQuXG5mdW5jdGlvbiBfaGFuZGxlRGV0YWlsQ2xpY2soZSkge1xuICBjb25zdCBlbCA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWFjdF0nKTtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBjb25zdCBhY3QgPSBlbC5kYXRhc2V0LmFjdDtcbiAgY29uc3QgdmlkZW9JZCA9IGVsLmRhdGFzZXQudmlkZW9JZCAhPSBudWxsID8gcGFyc2VJbnQoZWwuZGF0YXNldC52aWRlb0lkKSA6IG51bGw7XG4gIHN3aXRjaCAoYWN0KSB7XG4gICAgY2FzZSAnb3Blbi1uZXctcmVjb3JkaW5nLXBhbmVsJzogd2luZG93Lm9wZW5OZXdSZWNvcmRpbmdQYW5lbCgpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWdldHRpbmctc3RhcnRlZCc6IG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsKCk7IGJyZWFrO1xuICAgIGNhc2UgJ3ZpZGVvLXRpdGxlLWtlYmFiJzogb3BlblZpZGVvVGl0bGVLZWJhYih2aWRlb0lkLCBlbCk7IGJyZWFrO1xuICAgIGNhc2UgJ3ZpZGVvLXN1bW1hcnkta2ViYWInOiBvcGVuVmlkZW9TdW1tYXJ5S2ViYWIodmlkZW9JZCwgZWwpOyBicmVhaztcbiAgICBjYXNlICdzdW1tYXJpemUtdmlkZW8nOiB3aW5kb3cuc3VtbWFyaXplVmlkZW8odmlkZW9JZCwgZWwpOyBicmVhaztcbiAgICBjYXNlICdyZXZlYWwtaW4tZm9sZGVyJzogcmV2ZWFsSW5Gb2xkZXIoQXBwU3RhdGUuYWN0aXZlVmlkZW9EYXRhLnBhdGgpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWJhdGNoLWV4cG9ydCc6IHdpbmRvdy5vcGVuQmF0Y2hFeHBvcnRNb2RhbCh2aWRlb0lkKTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi12aWRlby1hY3Rpb25zJzogb3BlblZpZGVvQWN0aW9uc01vZGFsKHZpZGVvSWQpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLW5hbWUtY29ycmVjdGlvbnMnOiB3aW5kb3cub3Blbk5hbWVDb3JyZWN0aW9ucyh2aWRlb0lkKTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi1jbGlwLWNyZWF0ZS1waWNrZXInOiB3aW5kb3cub3BlbkNsaXBDcmVhdGVQaWNrZXIodmlkZW9JZCk7IGJyZWFrO1xuICAgIGNhc2UgJ2dlbmVyYXRlLXRpbWVsaW5lJzogd2luZG93LmdlbmVyYXRlVGltZWxpbmUodmlkZW9JZCk7IGJyZWFrO1xuICAgIGNhc2UgJ2NhbmNlbC1qb2InOiBjYW5jZWxKb2IoKTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi1jb250ZXh0LW1hbmFnZXInOiB3aW5kb3cub3BlbkNvbnRleHRNYW5hZ2VyKCk7IGJyZWFrO1xuICAgIGNhc2UgJ3Jlc2NvcmUtY2xpcHMnOiB3aW5kb3cucmVzY29yZUNsaXBzKHZpZGVvSWQsIGVsKTsgYnJlYWs7XG4gICAgY2FzZSAncmVzY29yZS1mYWlsZWQtY2xpcHMnOiB3aW5kb3cucmVzY29yZUZhaWxlZENsaXBzKHZpZGVvSWQsIGVsKTsgYnJlYWs7XG4gICAgY2FzZSAnaW5zdGFsbC1sb2NhbC1tb2RlbCc6XG4gICAgICB3aW5kb3cub3BlblNldHRpbmdzKCk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5fc2Nyb2xsVG9TZXR0aW5nc1NlY3Rpb24oJ3NldHRpbmdzLXNlYy1sbG0nKSwgMTIwKTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9oYW5kbGVEZXRhaWxDaGFuZ2UoZSkge1xuICBjb25zdCBlbCA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWFjdD1cImFkZC12aWRlby1jb250ZXh0XCJdJyk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgY29uc3QgdmlkZW9JZCA9IHBhcnNlSW50KGVsLmRhdGFzZXQudmlkZW9JZCk7XG4gIHdpbmRvdy5hZGRWaWRlb0NvbnRleHQodmlkZW9JZCwgZWwudmFsdWUpO1xuICBlbC52YWx1ZSA9ICcnO1xufVxuXG4vLyBQdWJsaWMgQVBJIC0gc3ltYm9scyB3aXRoIGEgY2xhc3NpYyAoYnVuZGxlLmpzKSBjb25zdW1lciwgYW4gaW5saW5lIGhhbmRsZXIgaW5cbi8vIGluZGV4Lmh0bWwncyBzdGF0aWMgbWFya3VwLCBvciBhIHRlc3RzL3VpLyoucHkgcGFnZS5ldmFsdWF0ZS4gSW50ZXJuYWwgaGVscGVyc1xuLy8gKHJlLWFuYWx5emUvcmUtcnVuIGFjdGlvbnMsIHRoZSB0d28ga2ViYWIgb3BlbmVycywgZXRjLikgc3RheSBtb2R1bGUtcHJpdmF0ZSAtXG4vLyBzZWUgbWFpbi5lc20uanMgZm9yIHdoYXQgZWFjaCBzdXJ2aXZpbmcgbmFtZSBoZXJlIHN0aWxsIG5lZWRzIGl0IGZvci5cbmV4cG9ydCB7XG4gIGxvYWRWaWRlb3MsIHNlbGVjdFZpZGVvLCByZW5kZXJWaWRlb0RldGFpbCwgZGVsZXRlVmlkZW8sXG4gIG9uQ2xpcHNTb3J0Q2hhbmdlLCBfY2xpcHNTb3J0UGFyYW0sIF9jbGlwc0xpc3RVcmwsXG4gIF9yZWFuYWx5emVQYXJhbXMsXG4gIF9uZWVkc01vZGVsQ3RhSFRNTCxcbiAgX3VwZGF0ZURlbW9CdXR0b24sIF91cGRhdGVTdGFydEluZ2VzdEJ1dHRvbixcbiAgX2FuYWx5c2lzTGl2ZVBhbmVsSFRNTCwgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCxcbiAgX2FwcGx5VmlkZW9GaWx0ZXJzLCBfcmVuZGVyVmlkZW9MaXN0LFxuICBzZXRWaWRlb1NlYXJjaCwgc2V0VmlkZW9Tb3J0LCB0b2dnbGVWaWRlb1NvcnREaXIsIHRvZ2dsZVZpZGVvRmlsdGVyLFxuICBvcGVuVmlkZW9BY3Rpb25zTW9kYWwsXG59O1xuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBfaGFuZGxlRGV0YWlsQ2xpY2spO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RldGFpbCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIF9oYW5kbGVEZXRhaWxDaGFuZ2UpO1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUmVjb3JkaW5nIGRldGFpbDogc2Vzc2lvbiB0aW1lbGluZSBnZW5lcmF0aW9uIChjb2RlOiB2aWRlbyAvIFZpZGVvKS5cbi8vIEV4dHJhY3RlZCBvdXQgb2YgdmlkZW9zLmpzICh3aGljaCBncmV3IGludG8gYSBjYXRjaC1hbGwpIC0gdGhlIGxpc3QvZmlsdGVyL1xuLy8gZGV0YWlsLXJlbmRlci9yZS1hbmFseXNpcyBjb3JlIHN0YXlzIHRoZXJlOyBfbmVlZHNNb2RlbEN0YUhUTUwgaXMgc2hhcmVkIHdpdGhcbi8vIHRoZSBzdW1tYXJ5IGZlYXR1cmUgYW5kIHN0YXlzIGluIHZpZGVvcy5qcyBjb3JlIHRvby5cbi8vICAgQVBJOiByb3V0ZXMvdmlkZW9zLnB5ICh0aW1lbGluZSBTU0UpIMK3IFRlc3RzOiB0ZXN0cy91aS90ZXN0X3VpX3ZpZGVvLnB5LCB0ZXN0cy9pbnRlZ3JhdGlvbi90ZXN0X3Njb3Jpbmdfcm91dGVzLnB5XG5cbmltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBlc2NIdG1sLCBwbHVyYWwsIF9wYXJzZUludGVydmFsUyB9IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IHNob3dUb2FzdCB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHtcbiAgX29wZW5TU0UsIF9zZXRBY3RpdmVTdHJlYW0sIF9jbGVhckFjdGl2ZVN0cmVhbSwgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSwgX2Jsb2NrZWRCeUFuYWx5emUsXG59IGZyb20gJy4vam9icy5qcyc7XG5pbXBvcnQgeyBfbmVlZHNNb2RlbEN0YUhUTUwgfSBmcm9tICcuL3ZpZGVvcy5qcyc7XG5cbi8vIOKUgOKUgCB0aW1lbGluZSByZW5kZXIgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmV4cG9ydCBmdW5jdGlvbiBfcmVuZGVyVGltZWxpbmVIVE1MKGVudHJpZXMpIHtcbiAgaWYgKCFlbnRyaWVzIHx8ICFlbnRyaWVzLmxlbmd0aCkgcmV0dXJuICcnO1xuICBjb25zdCByb3dzID0gZW50cmllcy5tYXAoZSA9PlxuICAgIGA8ZGl2IGNsYXNzPVwidGltZWxpbmUtZW50cnlcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJ0aW1lbGluZS1zdGFtcFwiPiR7ZXNjSHRtbChlLnN0YXJ0X2htcyl9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwidGltZWxpbmUtdGV4dFwiPiR7ZXNjSHRtbChlLnRleHQpfTwvZGl2PlxuICAgIDwvZGl2PmBcbiAgKS5qb2luKCcnKTtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwidGltZWxpbmVcIj4ke3Jvd3N9PC9kaXY+YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF90aW1lbGluZUVtcHR5Tm90ZUhUTUwoKSB7XG4gIHJldHVybiBgPGRpdiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTJweFwiPk5vIHRpbWVsaW5lIHlldCAtIGdlbmVyYXRlIGEgdGltZS1zdGFtcGVkIG91dGxpbmUgb2YgdGhlIHNlc3Npb24uPC9kaXY+YDtcbn1cblxuLy8g4pSA4pSAIHRpbWVsaW5lIGdlbmVyYXRpb24g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX3RpbWVsaW5lVmlkZW9JZCA9IG51bGw7XG5sZXQgX3RpbWVsaW5lSW50ZXJ2YWxPcGVuZXIgPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVUaW1lbGluZShpZCkge1xuICBfdGltZWxpbmVJbnRlcnZhbE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIF90aW1lbGluZVZpZGVvSWQgPSBpZDtcbiAgY29uc3QgdmlkZW8gPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuaWQgPT09IGlkKTtcbiAgX2xvYWRUaW1lbGluZUludGVydmFsQ29uZmlnKCkudGhlbigoKSA9PiB7XG4gICAgdXBkYXRlVGltZWxpbmVJbnRlcnZhbEhpbnQodmlkZW8pO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC12YWx1ZScpPy5mb2N1cygpLCA1MCk7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX3RpbWVsaW5lSW50ZXJ2YWxPcGVuZXI7XG4gIF90aW1lbGluZUludGVydmFsT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfbG9hZFRpbWVsaW5lSW50ZXJ2YWxDb25maWcoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvY29uZmlnJyk7XG4gICAgaWYgKCFyZXMub2spIHJldHVybjtcbiAgICBjb25zdCBjZmcgPSBhd2FpdCByZXMuanNvbigpO1xuICAgIGNvbnN0IHZhbCA9IGNmZy51aV90aW1lbGluZV9pbnRlcnZhbF9zZWNvbmRzIHx8IDkwMDtcbiAgICBjb25zdCB1bml0ID0gY2ZnLnVpX3RpbWVsaW5lX2ludGVydmFsX3VuaXQgfHwgJ21pbnV0ZXMnO1xuICAgIGlmICh1bml0ID09PSAnbWludXRlcycpIHtcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC12YWx1ZScpLnZhbHVlID0gTWF0aC5yb3VuZCh2YWwgLyA2MCk7XG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdW5pdCcpLnZhbHVlID0gJ21pbnV0ZXMnO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdmFsdWUnKS52YWx1ZSA9IHZhbDtcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC11bml0JykudmFsdWUgPSAnc2Vjb25kcyc7XG4gICAgfVxuICB9IGNhdGNoIChfKSB7fVxufVxuXG5mdW5jdGlvbiB1cGRhdGVUaW1lbGluZUludGVydmFsSGludCh2aWRlbykge1xuICB2aWRlbyA9IHZpZGVvIHx8IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gX3RpbWVsaW5lVmlkZW9JZCk7XG4gIGNvbnN0IHZhbCA9IHBhcnNlSW50KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC12YWx1ZScpLnZhbHVlLCAxMCkgfHwgMTtcbiAgY29uc3QgdW5pdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC11bml0JykudmFsdWU7XG4gIGNvbnN0IGludGVydmFsUyA9IHVuaXQgPT09ICdtaW51dGVzJyA/IHZhbCAqIDYwIDogdmFsO1xuICBjb25zdCBoaW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVsaW5lLWludGVydmFsLWhpbnQnKTtcbiAgY29uc3QgZ2VuQnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RpbWVsaW5lLWludGVydmFsLW1vZGFsIC5idG4ucHJpbWFyeScpO1xuICBpZiAoaW50ZXJ2YWxTIDwgMTApIHtcbiAgICBoaW50LnRleHRDb250ZW50ID0gJ01pbmltdW0gaW50ZXJ2YWwgaXMgMTAgc2Vjb25kcy4nO1xuICAgIGhpbnQuc3R5bGUuY29sb3IgPSAndmFyKC0tcmVkKSc7XG4gICAgaWYgKGdlbkJ0bikgZ2VuQnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKGdlbkJ0bikgZ2VuQnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIGhpbnQuc3R5bGUuY29sb3IgPSAndmFyKC0tbXV0ZWQpJztcbiAgaWYgKHZpZGVvICYmIHZpZGVvLmR1cmF0aW9uX21zKSB7XG4gICAgY29uc3QgZHVyID0gdmlkZW8uZHVyYXRpb25fbXMgLyAxMDAwO1xuICAgIGNvbnN0IGR1ck1pbiA9IE1hdGgucm91bmQoZHVyIC8gNjApO1xuICAgIGNvbnN0IGVudHJpZXMgPSBNYXRoLm1heCgxLCBNYXRoLmNlaWwoZHVyIC8gaW50ZXJ2YWxTKSk7XG4gICAgaWYgKGludGVydmFsUyA+PSBkdXIpIHtcbiAgICAgIGhpbnQudGV4dENvbnRlbnQgPSBgUmVjb3JkaW5nIGlzICR7ZHVyTWlufSBtaW4gLSB0aGlzIHByb2R1Y2VzIDEgZW50cnkgY292ZXJpbmcgdGhlIHdob2xlIHNlc3Npb24uYDtcbiAgICB9IGVsc2Uge1xuICAgICAgaGludC50ZXh0Q29udGVudCA9IGBSZWNvcmRpbmcgaXMgJHtkdXJNaW59IG1pbiAtIHByb2R1Y2VzIH4ke3BsdXJhbChlbnRyaWVzLCAnZW50cnknLCAnZW50cmllcycpfS5gO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBoaW50LnRleHRDb250ZW50ID0gJyc7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY29uZmlybUdlbmVyYXRlVGltZWxpbmUoKSB7XG4gIGNvbnN0IHVuaXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdW5pdCcpLnZhbHVlO1xuICBjb25zdCBuID0gcGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVsaW5lLWludGVydmFsLXZhbHVlJykudmFsdWUsIDEwKTtcbiAgY29uc3QgaW50ZXJ2YWxTID0gX3BhcnNlSW50ZXJ2YWxTKG4gfHwgMTUsIHVuaXQpO1xuICBpZiAoaW50ZXJ2YWxTID09PSBudWxsKSByZXR1cm47XG5cbiAgZmV0Y2goJy9hcGkvY29uZmlnJywge1xuICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3VpX3RpbWVsaW5lX2ludGVydmFsX3NlY29uZHM6IGludGVydmFsUywgdWlfdGltZWxpbmVfaW50ZXJ2YWxfdW5pdDogdW5pdH0pLFxuICB9KS5jYXRjaCgoKSA9PiB7fSk7XG5cbiAgY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKTtcbiAgX3N0YXJ0R2VuZXJhdGVUaW1lbGluZShfdGltZWxpbmVWaWRlb0lkLCBpbnRlcnZhbFMpO1xufVxuXG5mdW5jdGlvbiBfc3RhcnRHZW5lcmF0ZVRpbWVsaW5lKGlkLCBpbnRlcnZhbFMpIHtcbiAgaWYgKF9ibG9ja2VkQnlBbmFseXplKCdnZW5lcmF0ZSBhIHRpbWVsaW5lJykpIHJldHVybjtcbiAgY29uc3Qgc2VjdGlvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1zZWN0aW9uJyk7XG4gIGNvbnN0IGludGVydmFsTGFiZWwgPSBpbnRlcnZhbFMgPj0gNjBcbiAgICA/IGAke01hdGgucm91bmQoaW50ZXJ2YWxTIC8gNjApfS1taW51dGVgXG4gICAgOiBgJHtpbnRlcnZhbFN9LXNlY29uZGA7XG4gIHNlY3Rpb24uaW5uZXJIVE1MID0gYDxkaXYgc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHg7cGFkZGluZzo0cHggMFwiPkdlbmVyYXRpbmcgdGltZWxpbmUgLSBlbnRyaWVzIHdpbGwgYXBwZWFyIGFzIGVhY2ggJHtpbnRlcnZhbExhYmVsfSB3aW5kb3cgY29tcGxldGVz4oCmPC9kaXY+YDtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1nZW5lcmF0ZS10aW1lbGluZScpO1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICBidG4udGV4dENvbnRlbnQgPSAnR2VuZXJhdGluZyBUaW1lbGluZeKApic7XG5cbiAgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpO1xuICBjb25zdCByZXNldEJ0biA9ICgpID0+IHtcbiAgICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICAgIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IHZpZGVvPy5oYXNfdGltZWxpbmUgPyAnUmVnZW5lcmF0ZSBUaW1lbGluZScgOiAnR2VuZXJhdGUgVGltZWxpbmUnO1xuICB9O1xuICBsZXQgZmlyc3RFbnRyeSA9IHRydWU7XG4gIGxldCBuZWVkc01vZGVsID0gZmFsc2U7XG5cbiAgY29uc3QgaGFuZGxlID0gX29wZW5TU0UoXG4gICAgYC9hcGkvdmlkZW9zLyR7aWR9L3RpbWVsaW5lP2ludGVydmFsX3M9JHtpbnRlcnZhbFN9YCxcbiAgICBkYXRhID0+IHtcbiAgICAgIGlmIChkYXRhICYmIGRhdGEubmVlZHNfbW9kZWwpIHtcbiAgICAgICAgbmVlZHNNb2RlbCA9IHRydWU7XG4gICAgICAgIHNlY3Rpb24uaW5uZXJIVE1MID0gX25lZWRzTW9kZWxDdGFIVE1MKGRhdGEpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoZmlyc3RFbnRyeSkge1xuICAgICAgICBzZWN0aW9uLmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwidGltZWxpbmVcIiBpZD1cInRpbWVsaW5lLWxpc3RcIj48L2Rpdj5gO1xuICAgICAgICBmaXJzdEVudHJ5ID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHJvdy5jbGFzc05hbWUgPSAndGltZWxpbmUtZW50cnknO1xuICAgICAgcm93LmlubmVySFRNTCA9IGBcbiAgICAgICAgPGRpdiBjbGFzcz1cInRpbWVsaW5lLXN0YW1wXCI+JHtlc2NIdG1sKGRhdGEuc3RhcnRfaG1zKX08L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInRpbWVsaW5lLXRleHRcIj4ke2VzY0h0bWwoZGF0YS50ZXh0KX08L2Rpdj5gO1xuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVsaW5lLWxpc3QnKS5hcHBlbmRDaGlsZChyb3cpO1xuICAgIH0sXG4gICAgKCkgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICByZXNldEJ0bigpO1xuICAgICAgaWYgKG5lZWRzTW9kZWwpIHJldHVybjtcbiAgICAgIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gICAgICBpZiAodmlkZW8pIHZpZGVvLmhhc190aW1lbGluZSA9IHRydWU7XG4gICAgICBzaG93VG9hc3QoJ1RpbWVsaW5lIGdlbmVyYXRlZCcpO1xuICAgIH0sXG4gICAgZXJyTXNnID0+IHtcbiAgICAgIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpO1xuICAgICAgcmVzZXRCdG4oKTtcbiAgICAgIC8vIEEgZmFpbGVkIHJlZ2VuZXJhdGUgbGVhdmVzIHRoZSBzdG9yZWQgdGltZWxpbmUgaW50YWN0IHNlcnZlci1zaWRlLCBzb1xuICAgICAgLy8gZG9uJ3QgY2xhaW0gXCJObyB0aW1lbGluZSB5ZXRcIiAtIGxlYXZlIHRoZSBzZWN0aW9uIGJsYW5rIGluc3RlYWQuXG4gICAgICBpZiAoZmlyc3RFbnRyeSkge1xuICAgICAgICBjb25zdCB2aWRlbyA9IEFwcFN0YXRlLnZpZGVvcy5maW5kKHYgPT4gdi5pZCA9PT0gaWQpO1xuICAgICAgICBzZWN0aW9uLmlubmVySFRNTCA9IHZpZGVvPy5oYXNfdGltZWxpbmUgPyAnJyA6IF90aW1lbGluZUVtcHR5Tm90ZUhUTUwoKTtcbiAgICAgIH1cbiAgICAgIHNob3dUb2FzdChgVGltZWxpbmUgZ2VuZXJhdGlvbiBmYWlsZWQgLSAke2Vyck1zZ31gLCAnZXJyb3InKTtcbiAgICB9LFxuICApO1xuICBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgcmVzZXRCdG4pO1xufVxuXG4vLyDilIDilIAgc3RhdGljIG1vZGFsIHdpcmluZyAocmVwbGFjZXMgdGhlIGlubGluZSBvbmNsaWNrPS9vbmlucHV0PS9vbmNoYW5nZT0gdGhpc1xuLy8gbW9kdWxlIHVzZWQgdG8gb3duIGluIGluZGV4Lmh0bWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gdGltZWxpbmUtaW50ZXJ2YWwtbW9kYWwgaXMgYSBmaXhlZCwgbmV2ZXItcmVjcmVhdGVkIGVsZW1lbnQgaW4gaW5kZXguaHRtbCwgc29cbi8vIHdpcmluZyBpdCBvbmNlIGF0IG1vZHVsZSBsb2FkIChiZWxvdykgY2FuJ3QgZG91YmxlLWZpcmUgb24gYSByZS1yZW5kZXIuXG5mdW5jdGlvbiBfd2lyZVRpbWVsaW5lTW9kYWwoKSB7XG4gIGNvbnN0IG1vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RpbWVsaW5lLWludGVydmFsLW1vZGFsJyk7XG4gIG1vZGFsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7IGlmIChlLnRhcmdldCA9PT0gbW9kYWwpIGNsb3NlVGltZWxpbmVJbnRlcnZhbE1vZGFsKCk7IH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtY2FuY2VsLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0aW1lbGluZS1pbnRlcnZhbC1nZW5lcmF0ZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNvbmZpcm1HZW5lcmF0ZVRpbWVsaW5lKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdmFsdWUnKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsICgpID0+IHVwZGF0ZVRpbWVsaW5lSW50ZXJ2YWxIaW50KCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndGltZWxpbmUtaW50ZXJ2YWwtdW5pdCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHVwZGF0ZVRpbWVsaW5lSW50ZXJ2YWxIaW50KCkpO1xufVxuXG5fd2lyZVRpbWVsaW5lTW9kYWwoKTtcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFJlY29yZGluZyBkZXRhaWw6IHNlc3Npb24gdGl0bGUgKyBzdW1tYXJ5IGdlbmVyYXRpb24gKGNvZGU6XG4vLyB2aWRlbyAvIFZpZGVvKS4gRXh0cmFjdGVkIG91dCBvZiB2aWRlb3MuanMgKHdoaWNoIGdyZXcgaW50byBhIGNhdGNoLWFsbCkgLVxuLy8gdGhlIGxpc3QvZmlsdGVyL2RldGFpbC1yZW5kZXIvcmUtYW5hbHlzaXMgY29yZSBzdGF5cyB0aGVyZS5cbi8vICAgQVBJOiByb3V0ZXMvdmlkZW9zLnB5IChzdW1tYXJpemUsIHJlZ2VuZXJhdGUtc3VtbWFyeSwgZmllbGRzKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV92aWRlby5weVxuaW1wb3J0IHsgQXBwU3RhdGUgfSBmcm9tICcuL3N0YXRlLmpzJztcbmltcG9ydCB7IGZvcm1hdEFwaUVycm9yIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xuaW1wb3J0IHsgb3BlbkRpZmZNb2RhbCwgc2hvd0NvbmZpcm0gfSBmcm9tICcuL3VpLmpzJztcbmltcG9ydCB7IHNob3dUb2FzdCwgb3BlbkxvZywgYXBwZW5kTG9nIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBfb3BlblNTRSwgX3NldEFjdGl2ZVN0cmVhbSwgX2NsZWFyQWN0aXZlU3RyZWFtLCBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtLCBfYmxvY2tlZEJ5QW5hbHl6ZSB9IGZyb20gJy4vam9icy5qcyc7XG5pbXBvcnQgeyBsb2FkVmlkZW9zLCByZW5kZXJWaWRlb0RldGFpbCwgX25lZWRzTW9kZWxDdGFIVE1MIH0gZnJvbSAnLi92aWRlb3MuanMnO1xuLy8g4pSA4pSAIHZpZGVvIHN1bW1hcnkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5hc3luYyBmdW5jdGlvbiBzdW1tYXJpemVWaWRlbyhpZCwgYnRuKSB7XG4gIGNvbnN0IGFjdGlvbkJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tc3VtbWFyaXplLXZpZGVvJykgfHwgYnRuO1xuICBpZiAoYWN0aW9uQnRuICYmIGFjdGlvbkJ0bi5kaXNhYmxlZCkgcmV0dXJuO1xuICBjb25zdCBvcmlnID0gYWN0aW9uQnRuID8gYWN0aW9uQnRuLnRleHRDb250ZW50IDogJyc7XG4gIGlmIChhY3Rpb25CdG4pIHsgYWN0aW9uQnRuLmRpc2FibGVkID0gdHJ1ZTsgYWN0aW9uQnRuLnRleHRDb250ZW50ID0gJ0dlbmVyYXRpbmcgU3VtbWFyeeKApic7IH1cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHtpZH0vc3VtbWFyaXplYCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIGNvbnN0IGVyciA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0QXBpRXJyb3IoZXJyKSk7XG4gICAgfVxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpO1xuICAgIGlmIChkYXRhLm5lZWRzX21vZGVsKSB7XG4gICAgICBjb25zdCBib2R5ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1bW1hcnktYm9keScpO1xuICAgICAgaWYgKGJvZHkpIGJvZHkuaW5uZXJIVE1MID0gX25lZWRzTW9kZWxDdGFIVE1MKGRhdGEpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBvcGVuRGlmZk1vZGFsKCdSZXZpZXcgR2VuZXJhdGVkIFN1bW1hcnknLCBbXG4gICAgICB7bGFiZWw6ICdUaXRsZScsICAgY3VycmVudDogZGF0YS50aXRsZV9jdXJyZW50LCAgIHByb3Bvc2VkOiBkYXRhLnRpdGxlX25ld30sXG4gICAgICB7bGFiZWw6ICdTdW1tYXJ5JywgY3VycmVudDogZGF0YS5zdW1tYXJ5X2N1cnJlbnQsIHByb3Bvc2VkOiBkYXRhLnN1bW1hcnlfbmV3fSxcbiAgICBdLCBhc3luYyAoYWN0aW9uLCBlZGl0ZWQpID0+IHtcbiAgICAgIGNvbnN0IHBhdGNoID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7aWR9L2ZpZWxkc2AsIHtcbiAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHthY3Rpb24sIGZpZWxkOiAnYm90aCcsIG5ld190aXRsZTogZWRpdGVkWzBdLCBuZXdfc3VtbWFyeTogZWRpdGVkWzFdfSksXG4gICAgICB9KTtcbiAgICAgIGlmICghcGF0Y2gub2spIHsgc2hvd1RvYXN0KCdTYXZlIGZhaWxlZCcsICdlcnJvcicpOyByZXR1cm47IH1cbiAgICAgIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgICAgIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gICAgICBpZiAodmlkZW8pIHJlbmRlclZpZGVvRGV0YWlsKHZpZGVvLCBudWxsKTtcbiAgICAgIHNob3dUb2FzdChhY3Rpb24gPT09ICdhY2NlcHRfbmV3JyA/ICdTdW1tYXJ5IGFjY2VwdGVkJyA6ICdTdW1tYXJ5IHNhdmVkIGFzIGVkaXQnKTtcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgc2hvd1RvYXN0KGBTdW1tYXJ5IGZhaWxlZDogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBpZiAoYWN0aW9uQnRuKSB7IGFjdGlvbkJ0bi5kaXNhYmxlZCA9IGZhbHNlOyBhY3Rpb25CdG4udGV4dENvbnRlbnQgPSBvcmlnOyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVnZW5TdW1tYXJ5QXV0byhpZCwgYnRuKSB7XG4gIHNob3dDb25maXJtKFxuICAgICdSZWdlbmVyYXRlIGFuZCBhdXRvLXNhdmU/JyxcbiAgICAnVGhlIGN1cnJlbnQgdGl0bGUgYW5kIHN1bW1hcnkgd2lsbCBiZSByZXBsYWNlZCB3aXRob3V0IGEgcmV2aWV3IHN0ZXAuIFRoaXMgY2Fubm90IGJlIHVuZG9uZS4nLFxuICAgICdSZWdlbmVyYXRlJyxcbiAgICAoKSA9PiBfZG9SZWdlblN1bW1hcnlBdXRvKGlkLCBidG4pLFxuICAgIHRydWUsXG4gICk7XG59XG5cbmZ1bmN0aW9uIF9kb1JlZ2VuU3VtbWFyeUF1dG8oaWQsIGJ0bikge1xuICBpZiAoX2Jsb2NrZWRCeUFuYWx5emUoJ3JlZ2VuZXJhdGUgdGhlIHN1bW1hcnknKSkgcmV0dXJuO1xuICBjb25zdCBhY3Rpb25CdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXJlZ2VuLXN1bW1hcnknKSB8fCBidG47XG4gIGlmIChhY3Rpb25CdG4gJiYgYWN0aW9uQnRuLmRpc2FibGVkKSByZXR1cm47XG4gIGlmIChhY3Rpb25CdG4pIHsgYWN0aW9uQnRuLmRpc2FibGVkID0gdHJ1ZTsgYWN0aW9uQnRuLnRleHRDb250ZW50ID0gJ1JlZ2VuZXJhdGluZ+KApic7IH1cbiAgb3BlbkxvZygpO1xuICBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCk7XG4gIGNvbnN0IHJlc2V0QnRuID0gKCkgPT4geyBpZiAoYWN0aW9uQnRuKSB7IGFjdGlvbkJ0bi5kaXNhYmxlZCA9IGZhbHNlOyBhY3Rpb25CdG4udGV4dENvbnRlbnQgPSAnUmVnZW5lcmF0ZSAoYXV0by1zYXZlKSc7IH0gfTtcbiAgbGV0IGhhZEVycm9yID0gZmFsc2U7XG4gIGxldCBuZWVkc01vZGVsID0gZmFsc2U7XG4gIGNvbnN0IGhhbmRsZSA9IF9vcGVuU1NFKFxuICAgIGAvYXBpL3ZpZGVvcy8ke2lkfS9yZWdlbmVyYXRlLXN1bW1hcnlgLFxuICAgIGRhdGEgPT4ge1xuICAgICAgaWYgKGRhdGEgJiYgZGF0YS5uZWVkc19tb2RlbCkge1xuICAgICAgICBuZWVkc01vZGVsID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdW1tYXJ5LWJvZHknKTtcbiAgICAgICAgaWYgKGJvZHkpIGJvZHkuaW5uZXJIVE1MID0gX25lZWRzTW9kZWxDdGFIVE1MKGRhdGEpO1xuICAgICAgICBhcHBlbmRMb2coZGF0YS5kZXRhaWwpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnICYmIGRhdGEuc3RhcnRzV2l0aCgnW0Vycm9yJykpIGhhZEVycm9yID0gdHJ1ZTtcbiAgICAgIGFwcGVuZExvZyhTdHJpbmcoZGF0YSkpO1xuICAgIH0sXG4gICAgKCkgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICByZXNldEJ0bigpO1xuICAgICAgaWYgKG5lZWRzTW9kZWwpIHtcbiAgICAgICAgc2hvd1RvYXN0KCdJbnN0YWxsIGEgbG9jYWwgbW9kZWwgdG8gZ2VuZXJhdGUgc3VtbWFyaWVzJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGhhZEVycm9yKSB7XG4gICAgICAgIHNob3dUb2FzdCgnU3VtbWFyeSBnZW5lcmF0aW9uIGZhaWxlZCAtIGNoZWNrIGxvZyBmb3IgZGV0YWlscycsICdlcnJvcicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBsb2FkVmlkZW9zKCkudGhlbigoKSA9PiB7XG4gICAgICAgIGNvbnN0IHZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBpZCk7XG4gICAgICAgIGlmICh2aWRlbyAmJiBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID09PSBpZCkgcmVuZGVyVmlkZW9EZXRhaWwodmlkZW8sIG51bGwpO1xuICAgICAgfSk7XG4gICAgICBzaG93VG9hc3QoJ1N1bW1hcnkgcmVnZW5lcmF0ZWQnKTtcbiAgICB9LFxuICAgIGVyck1zZyA9PiB7XG4gICAgICBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKTtcbiAgICAgIHJlc2V0QnRuKCk7XG4gICAgICBzaG93VG9hc3QoYFN1bW1hcnkgZ2VuZXJhdGlvbiBmYWlsZWQgLSAke2Vyck1zZ31gLCAnZXJyb3InKTtcbiAgICB9LFxuICApO1xuICBfc2V0QWN0aXZlU3RyZWFtKGhhbmRsZSwgcmVzZXRCdG4pO1xufVxuXG5leHBvcnQgeyBzdW1tYXJpemVWaWRlbywgcmVnZW5TdW1tYXJ5QXV0byB9O1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUmVjb3JkaW5nIGRldGFpbDogbGFzdC1hbmFseXNpcyBydW4gbWV0YWRhdGEgY2FyZCAocGVyLXN0YWdlXHJcbi8vIHRpbWluZywgZWZmZWN0aXZlIHNldHRpbmdzLCBDUFUvR1BVIGRldmljZSkuIEV4dHJhY3RlZCBvdXQgb2YgdmlkZW9zLmpzXHJcbi8vICh3aGljaCBncmV3IGludG8gYSBjYXRjaC1hbGwpIC0gdGhlIGxpc3QvZmlsdGVyL2RldGFpbC1yZW5kZXIvcmUtYW5hbHlzaXNcclxuLy8gY29yZSBzdGF5cyB0aGVyZS5cclxuLy8gICBBUEk6IHJvdXRlcy92aWRlb3MucHkgKGFuYWx5emVfcnVuIGZpZWxkKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV92aWRlby5weVxyXG5pbXBvcnQgeyBlc2NIdG1sLCBfbXNUb0htcywgX2ZtdEFnbyB9IGZyb20gJy4vZm9ybWF0LmpzJztcclxuLy8g4pSA4pSAIGFuYWx5c2lzIHJ1biBtZXRhZGF0YSBjYXJkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBSZW5kZXJzIHRoZSBzdG9yZWQgcmVjb3JkIG9mIHRoZSBsYXN0IGFuYWx5emUgcnVuIChwZXItc3RhZ2UgdGltaW5nLCBlZmZlY3RpdmVcclxuLy8gc2V0dGluZ3MsIGFuZCBDUFUvR1BVIGRldmljZSkgc28gdGhlIGNyZWF0b3IgY2FuIGFuc3dlciBcImhvdyBsb25nIGRpZCB0aGlzXHJcbi8vIHRha2UsIHdoYXQgc2V0dGluZ3MsIGFuZCBkaWQgaXQgdXNlIG15IEdQVT9cIi5cclxuLy8gRGlzcGxheSBmaW5pc2hlZC1ydW4gc3RhZ2UgbmFtZXMgd2l0aCB0aGUgc2FtZSBsYWJlbHMgYXMgdGhlIGxpdmUgcHJvZ3Jlc3NcclxuLy8gYnViYmxlcyAoSU5HRVNUX1NURVBTKSwgc28gdGhlIFwiTGFzdCBhbmFseXNpc1wiIGNhcmQgcmVhZHMgY29uc2lzdGVudGx5IHdpdGhcclxuLy8gd2hhdCB0aGUgdXNlciB3YXRjaGVkIGR1cmluZyBhbmFseXNpcy4gQ292ZXJzIG5hbWVzIHN0b3JlZCBieSBvbGRlciBydW5zLlxyXG5jb25zdCBfU1RBR0VfTEFCRUwgPSB7XHJcbiAgJ0V4dHJhY3QgYXVkaW8nOiAgICdFeHRyYWN0JyxcclxuICAnR2VuZXJhdGUgY2xpcHMnOiAgJ0dlbmVyYXRlIENsaXBzJyxcclxuICAnSW1wb3J0IGNhcHRpb25zJzogJ1RyYW5zY3JpYmUnLFxyXG59O1xyXG5mdW5jdGlvbiBfc3RhZ2VMYWJlbChuYW1lKSB7IHJldHVybiBfU1RBR0VfTEFCRUxbbmFtZV0gfHwgbmFtZTsgfVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9ydW5UaW1pbmdMaW5lKHJ1bikge1xyXG4gIGNvbnN0IHRvdGFsSG1zID0gX21zVG9IbXMocnVuLmVsYXBzZWRfbXMgfHwgMCk7XHJcbiAgY29uc3Qgc3RhZ2VzID0gcnVuLnN0YWdlcyB8fCBbXTtcclxuICBjb25zdCBzdGFnZVN0ciA9IHN0YWdlcy5tYXAoc3QgPT4gYCR7X3N0YWdlTGFiZWwoc3QubmFtZSl9ICR7X21zVG9IbXMoKHN0LnNlY29uZHMgfHwgMCkgKiAxMDAwKX1gKS5qb2luKCcgwrcgJyk7XHJcbiAgcmV0dXJuIGBMYXN0IHJ1bjogJHt0b3RhbEhtc30gdG90YWwke3N0YWdlU3RyID8gYCAoJHtzdGFnZVN0cn0pYCA6ICcnfWA7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfcmVuZGVyUnVuTWV0YUNhcmQodmlkZW8pIHtcclxuICBjb25zdCBydW4gPSB2aWRlby5hbmFseXplX3J1bjtcclxuICBpZiAoIXJ1bikgcmV0dXJuICcnO1xyXG4gIGNvbnN0IHRvdGFsSG1zID0gX21zVG9IbXMocnVuLmVsYXBzZWRfbXMgfHwgMCk7XHJcbiAgY29uc3QgZGV2ID0gcnVuLmRldmljZSB8fCB7fTtcclxuICBjb25zdCBkZXZpY2VCYWRnZSA9IGRldi5oYXNfZ3B1XHJcbiAgICA/ICc8c3BhbiBjbGFzcz1cInJ1bi1tZXRhLWJhZGdlIGdwdVwiIHRpdGxlPVwiVXNlZCB0aGUgR1BVXCI+R1BVPC9zcGFuPidcclxuICAgIDogJzxzcGFuIGNsYXNzPVwicnVuLW1ldGEtYmFkZ2UgY3B1XCIgdGl0bGU9XCJSYW4gb24gQ1BVXCI+Q1BVPC9zcGFuPic7XHJcbiAgY29uc3Qgd2hlbiA9IHJ1bi5maW5pc2hlZF9hdCA/IGAgJm1pZGRvdDsgJHtlc2NIdG1sKF9mbXRBZ28ocnVuLmZpbmlzaGVkX2F0KSl9YCA6ICcnO1xyXG4gIHJldHVybiBgXHJcbiAgICA8ZGV0YWlscyBjbGFzcz1cImRldGFpbC1jYXJkIHJ1bi1tZXRhLWNhcmRcIj5cclxuICAgICAgPHN1bW1hcnkgY2xhc3M9XCJydW4tbWV0YS1zdW1tYXJ5XCI+TGFzdCBhbmFseXNpcyAmbWlkZG90OyA8c3Ryb25nPiR7dG90YWxIbXN9PC9zdHJvbmc+ICR7ZGV2aWNlQmFkZ2V9JHt3aGVufTwvc3VtbWFyeT5cclxuICAgICAgPGRpdiBjbGFzcz1cInJ1bi1tZXRhLWJvZHlcIj5cclxuICAgICAgICAke19ydW5TZXR0aW5nc1Jvd3MocnVuLnNldHRpbmdzIHx8IHt9LCBkZXYpfVxyXG4gICAgICAgICR7X3J1blN0YWdlQmFycyhydW4uc3RhZ2VzIHx8IFtdKX1cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2RldGFpbHM+YDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3J1blNldHRpbmdzUm93cyhzLCBkZXYpIHtcclxuICBjb25zdCB5ZXNObyA9ICh2KSA9PiB2ID8gJ09uJyA6ICdPZmYnO1xyXG4gIGNvbnN0IHJvd3MgPSBbXHJcbiAgICBbJ1doaXNwZXIgbW9kZWwnLCAgcy5tb2RlbF0sXHJcbiAgICBbJ1RyYWNrIGxheW91dCcsICAgcy50cmFja19sYXlvdXRdLFxyXG4gICAgWydDYXB0aW9ucycsICAgICAgIHMuY2FwdGlvbnNfc291cmNlXSxcclxuICAgIFsnU3BlYWtlciBsYWJlbHMnLCBzLnNwZWFrZXJfbGFiZWxzID09PSB1bmRlZmluZWQgPyBudWxsIDogeWVzTm8ocy5zcGVha2VyX2xhYmVscyldLFxyXG4gICAgWydFbmVyZ3kgbW9kZScsICAgIHMuZW5lcmd5X21vZGVdLFxyXG4gICAgWydTY2VuZSBtb2RlJywgICAgIHMuc2NlbmVfbW9kZV0sXHJcbiAgICBbJ0xMTSBzY29yaW5nJywgICAgcy5zY29yaW5nID09PSB1bmRlZmluZWQgPyBudWxsIDogeWVzTm8ocy5zY29yaW5nKV0sXHJcbiAgICBbJ1dvcmxkIGNvbnRleHRzJywgKHMuY29udGV4dHMgJiYgcy5jb250ZXh0cy5sZW5ndGgpID8gcy5jb250ZXh0cy5qb2luKCcsICcpIDogJ25vbmUnXSxcclxuICAgIFsnVHJhbnNjcmliZSBkZXZpY2UnLCBkZXYudHJhbnNjcmliZV0sXHJcbiAgICBbJ0RpYXJpemF0aW9uIGRldmljZScsIGRldi5kaWFyaXphdGlvbl0sXHJcbiAgXS5maWx0ZXIoKFssIHZdKSA9PiB2ICE9PSBudWxsICYmIHYgIT09IHVuZGVmaW5lZCAmJiB2ICE9PSAnJyk7XHJcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwicnVuLW1ldGEtZ3JpZFwiPiR7cm93cy5tYXAoKFtrLCB2XSkgPT5cclxuICAgIGA8ZGl2IGNsYXNzPVwicnVuLW1ldGEta2V5XCI+JHtlc2NIdG1sKGspfTwvZGl2PjxkaXYgY2xhc3M9XCJydW4tbWV0YS12YWxcIj4ke2VzY0h0bWwoU3RyaW5nKHYpKX08L2Rpdj5gXHJcbiAgKS5qb2luKCcnKX08L2Rpdj5gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfcnVuU3RhZ2VCYXJzKHN0YWdlcykge1xyXG4gIGlmICghc3RhZ2VzLmxlbmd0aCkgcmV0dXJuICcnO1xyXG4gIGNvbnN0IG1heFMgPSBNYXRoLm1heCguLi5zdGFnZXMubWFwKHN0ID0+IHN0LnNlY29uZHMgfHwgMCksIDAuMDAxKTtcclxuICBjb25zdCBiYXJzID0gc3RhZ2VzLm1hcChzdCA9PiB7XHJcbiAgICBjb25zdCBzZWNzID0gc3Quc2Vjb25kcyB8fCAwO1xyXG4gICAgY29uc3QgcGN0ID0gTWF0aC5tYXgoMiwgTWF0aC5yb3VuZChzZWNzIC8gbWF4UyAqIDEwMCkpO1xyXG4gICAgcmV0dXJuIGBcclxuICAgICAgPGRpdiBjbGFzcz1cInJ1bi1zdGFnZS1yb3dcIj5cclxuICAgICAgICA8c3BhbiBjbGFzcz1cInJ1bi1zdGFnZS1uYW1lXCI+JHtlc2NIdG1sKF9zdGFnZUxhYmVsKHN0Lm5hbWUpKX08L3NwYW4+XHJcbiAgICAgICAgPHNwYW4gY2xhc3M9XCJydW4tc3RhZ2UtdHJhY2tcIj48c3BhbiBjbGFzcz1cInJ1bi1zdGFnZS1maWxsXCIgc3R5bGU9XCJ3aWR0aDoke3BjdH0lXCI+PC9zcGFuPjwvc3Bhbj5cclxuICAgICAgICA8c3BhbiBjbGFzcz1cInJ1bi1zdGFnZS10aW1lXCI+JHtfbXNUb0htcyhzZWNzICogMTAwMCl9PC9zcGFuPlxyXG4gICAgICA8L2Rpdj5gO1xyXG4gIH0pLmpvaW4oJycpO1xyXG4gIHJldHVybiBgPGRpdiBjbGFzcz1cInJ1bi1zdGFnZS1iYXJzXCI+PGRpdiBjbGFzcz1cInJ1bi1tZXRhLXN1YnRpdGxlXCI+U3RhZ2UgdGltaW5nPC9kaXY+JHtiYXJzfTwvZGl2PmA7XHJcbn1cclxuIiwgIi8vIEZlYXR1cmUtbWFwIC0gU2Vzc2lvbiAoY29kZTogUmVjb3JkaW5nU2Vzc2lvbiAvIHNlc3Npb25faWQpLlxuLy8gICBBUEk6IHJvdXRlcy9zZXNzaW9ucy5weSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9zZXNzaW9ucy5weVxuLy8g4pSA4pSAIFNlc3Npb25zOiBzaWRlYmFyIGdyb3VwaW5nLCBhdXRvLXN1Z2dlc3QsIGFuZCB0aGUgc2Vzc2lvbiBkZXRhaWwgdmlldyDilIDilIDilIDilIDilIBcbi8vIEEgU2Vzc2lvbiBncm91cHMgdG9wLWxldmVsIHJlY29yZGluZ3MgZnJvbSBvbmUgcGxheSBzZXNzaW9uLiBUaGlzIG1vZHVsZSBvd25zXG4vLyB0aGUgc2lkZWJhciBncm91cCBoZWFkZXJzLCB0aGUgbWFudWFsIGdyb3VwaW5nIHNlbGVjdGlvbiBtb2RlLCB0aGUgc3VnZ2VzdFxuLy8gcHJvbXB0LCBhbmQgdGhlIHNlc3Npb24gZGV0YWlsIHZpZXcgKHJvbGx1cCBzdW1tYXJ5ICsgdW5pZmllZCB0aW1lbGluZSkuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgZXNjSHRtbCwgcGx1cmFsLCBfbXNUb0htcyB9IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IHNob3dUb2FzdCwgY29sbGFwc2libGVDYXJkLCBvcGVuTG9nIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBzaG93S2ViYWIsIHNob3dDb25maXJtIH0gZnJvbSAnLi91aS5qcyc7XG5pbXBvcnQgeyBzdHJlYW1TU0UgfSBmcm9tICcuL2pvYnMuanMnO1xuaW1wb3J0IHsgbG9hZFZpZGVvcywgc2VsZWN0VmlkZW8sIF9yZW5kZXJWaWRlb0xpc3QgfSBmcm9tICcuL3ZpZGVvcy5qcyc7XG5cbmNvbnN0IENPTExBUFNFX0tFWSA9ICd5dXVjbGlwLXNlc3Npb24tY29sbGFwc2VkJztcbmNvbnN0IERJU01JU1NfS0VZICA9ICd5dXVjbGlwLXNlc3Npb24tZGlzbWlzc2VkJztcblxuZnVuY3Rpb24gX2xvYWRJZFNldChrZXkpIHtcbiAgdHJ5IHsgcmV0dXJuIG5ldyBTZXQoSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8ICdbXScpKTsgfSBjYXRjaCB7IHJldHVybiBuZXcgU2V0KCk7IH1cbn1cbmZ1bmN0aW9uIF9zYXZlSWRTZXQoa2V5LCBzZXQpIHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShbLi4uc2V0XSkpOyB9XG5cbmNvbnN0IFNlc3Npb25VSSA9IHtcbiAgc2VsZWN0aW9uTW9kZTogZmFsc2UsXG4gIHNlbGVjdGVkOiBuZXcgU2V0KCksICAgICAgICAgICAgICAgICAgICAgICAvLyB2aWRlbyBpZHMgcGlja2VkIHdoaWxlIGdyb3VwaW5nXG4gIGNvbGxhcHNlZDogX2xvYWRJZFNldChDT0xMQVBTRV9LRVkpLCAgICAgICAvLyBzZXNzaW9uIGlkcyBjb2xsYXBzZWQgaW4gdGhlIHNpZGViYXJcbiAgZGlzbWlzc2VkOiBfbG9hZElkU2V0KERJU01JU1NfS0VZKSwgICAgICAgIC8vIGRpc21pc3NlZCBzdWdnZXN0aW9uIGdyb3VwIGtleXNcbn07XG5cbmZ1bmN0aW9uIF9zZXNzaW9uQnlJZChpZCkgeyByZXR1cm4gKEFwcFN0YXRlLnNlc3Npb25zIHx8IFtdKS5maW5kKHMgPT4gcy5pZCA9PT0gaWQpOyB9XG5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRTZXNzaW9ucygpIHtcbiAgdHJ5IHtcbiAgICBBcHBTdGF0ZS5zZXNzaW9ucyA9IGF3YWl0IGZldGNoKCcvYXBpL3Nlc3Npb25zJykudGhlbihyID0+IHIuanNvbigpKTtcbiAgfSBjYXRjaCB7IEFwcFN0YXRlLnNlc3Npb25zID0gW107IH1cbiAgX3JlbmRlclZpZGVvTGlzdCgpO1xufVxuXG4vLyDilIDilIAgc2lkZWJhciBncm91cCBoZWFkZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBpc1Nlc3Npb25Db2xsYXBzZWQoaWQpIHsgcmV0dXJuIFNlc3Npb25VSS5jb2xsYXBzZWQuaGFzKGlkKTsgfVxuXG5mdW5jdGlvbiB0b2dnbGVTZXNzaW9uQ29sbGFwc2UoaWQpIHtcbiAgaWYgKFNlc3Npb25VSS5jb2xsYXBzZWQuaGFzKGlkKSkgU2Vzc2lvblVJLmNvbGxhcHNlZC5kZWxldGUoaWQpO1xuICBlbHNlIFNlc3Npb25VSS5jb2xsYXBzZWQuYWRkKGlkKTtcbiAgX3NhdmVJZFNldChDT0xMQVBTRV9LRVksIFNlc3Npb25VSS5jb2xsYXBzZWQpO1xuICBfcmVuZGVyVmlkZW9MaXN0KCk7XG59XG5cbmZ1bmN0aW9uIHNlc3Npb25Hcm91cEhlYWRlckxpKHNlc3Npb24sIHNob3duQ291bnQpIHtcbiAgY29uc3QgY29sbGFwc2VkID0gaXNTZXNzaW9uQ29sbGFwc2VkKHNlc3Npb24uaWQpO1xuICBjb25zdCBsYWJlbCA9IHNlc3Npb24ubmFtZSB8fCBzZXNzaW9uLnRpdGxlIHx8ICdTZXNzaW9uJztcbiAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICBsaS5jbGFzc05hbWUgPSAnc2Vzc2lvbi1oZWFkZXInICsgKEFwcFN0YXRlLmFjdGl2ZVNlc3Npb25JZCA9PT0gc2Vzc2lvbi5pZCA/ICcgYWN0aXZlJyA6ICcnKTtcbiAgbGkuZGF0YXNldC5zZXNzaW9uSWQgPSBzZXNzaW9uLmlkO1xuICBsaS5pbm5lckhUTUwgPSBgXG4gICAgPGJ1dHRvbiBjbGFzcz1cInNlc3Npb24tY2FyZXRcIiBhcmlhLWxhYmVsPVwiJHtjb2xsYXBzZWQgPyAnRXhwYW5kJyA6ICdDb2xsYXBzZSd9IHNlc3Npb25cIiBhcmlhLWV4cGFuZGVkPVwiJHtjb2xsYXBzZWQgPyAnZmFsc2UnIDogJ3RydWUnfVwiPiR7Y29sbGFwc2VkID8gJyYjOTY1NjsnIDogJyYjOTY2MjsnfTwvYnV0dG9uPlxuICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLWhlYWRlci1sYWJlbFwiIHJvbGU9XCJidXR0b25cIiB0YWJpbmRleD1cIjBcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLW5hbWVcIj4mIzEyNzkwMjsgJHtlc2NIdG1sKGxhYmVsKX08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtZXRhXCI+JHtwbHVyYWwoc2hvd25Db3VudCwgJ3JlY29yZGluZycpfTwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxidXR0b24gY2xhc3M9XCJrZWJhYi1idG4gc2Vzc2lvbi1rZWJhYlwiIGFyaWEtbGFiZWw9XCJTZXNzaW9uIGFjdGlvbnNcIiB0aXRsZT1cIlNlc3Npb24gYWN0aW9uc1wiPiYjODk0Mjs8L2J1dHRvbj5gO1xuICBsaS5xdWVyeVNlbGVjdG9yKCcuc2Vzc2lvbi1jYXJldCcpLm9uY2xpY2sgPSBlID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgdG9nZ2xlU2Vzc2lvbkNvbGxhcHNlKHNlc3Npb24uaWQpOyB9O1xuICBjb25zdCBsYWJlbEVsID0gbGkucXVlcnlTZWxlY3RvcignLnNlc3Npb24taGVhZGVyLWxhYmVsJyk7XG4gIGxhYmVsRWwub25jbGljayA9IGUgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBzZWxlY3RTZXNzaW9uKHNlc3Npb24uaWQpOyB9O1xuICBsYWJlbEVsLm9ua2V5ZG93biA9IGUgPT4geyBpZiAoZS5rZXkgPT09ICdFbnRlcicgfHwgZS5rZXkgPT09ICcgJykgeyBlLnByZXZlbnREZWZhdWx0KCk7IHNlbGVjdFNlc3Npb24oc2Vzc2lvbi5pZCk7IH0gfTtcbiAgbGkucXVlcnlTZWxlY3RvcignLnNlc3Npb24ta2ViYWInKS5vbmNsaWNrID0gZSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IF9vcGVuU2Vzc2lvbk1lbnUoc2Vzc2lvbi5pZCwgZS5jdXJyZW50VGFyZ2V0KTsgfTtcbiAgcmV0dXJuIGxpO1xufVxuXG5mdW5jdGlvbiBfb3BlblNlc3Npb25NZW51KHNlc3Npb25JZCwgYW5jaG9yKSB7XG4gIGNvbnN0IHNlc3Npb24gPSBfc2Vzc2lvbkJ5SWQoc2Vzc2lvbklkKTtcbiAgaWYgKCFzZXNzaW9uKSByZXR1cm47XG4gIHNob3dLZWJhYihhbmNob3IsIFtcbiAgICB7IGxhYmVsOiAnT3BlbiBzZXNzaW9uJywgYWN0aW9uOiAoKSA9PiBzZWxlY3RTZXNzaW9uKHNlc3Npb25JZCkgfSxcbiAgICB7IGxhYmVsOiAnUmVuYW1l4oCmJywgYWN0aW9uOiAoKSA9PiBfcmVuYW1lU2Vzc2lvbihzZXNzaW9uSWQpIH0sXG4gICAgeyBsYWJlbDogJ0FkZCByZWNvcmRpbmdz4oCmJywgYWN0aW9uOiAoKSA9PiB7IGVudGVyR3JvdXBpbmdNb2RlKHNlc3Npb25JZCk7IH0gfSxcbiAgICBudWxsLFxuICAgIHsgbGFiZWw6ICdVbmdyb3VwIChkaXNzb2x2ZSknLCBhY3Rpb246ICgpID0+IF9kaXNzb2x2ZVNlc3Npb24oc2Vzc2lvbklkKSB9LFxuICBdKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX3JlbmFtZVNlc3Npb24oc2Vzc2lvbklkKSB7XG4gIGNvbnN0IHNlc3Npb24gPSBfc2Vzc2lvbkJ5SWQoc2Vzc2lvbklkKTtcbiAgaWYgKCFzZXNzaW9uKSByZXR1cm47XG4gIGNvbnN0IG5hbWUgPSBhd2FpdCBfcHJvbXB0VGV4dCgnUmVuYW1lIHNlc3Npb24nLCAnU2Vzc2lvbiBuYW1lJywgc2Vzc2lvbi5uYW1lIHx8ICcnKTtcbiAgaWYgKG5hbWUgPT09IG51bGwpIHJldHVybjtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvc2Vzc2lvbnMvJHtzZXNzaW9uSWR9YCwge1xuICAgIG1ldGhvZDogJ1BBVENIJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtuYW1lfSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgeyBzaG93VG9hc3QoJ0NvdWxkIG5vdCByZW5hbWUgc2Vzc2lvbicsICdlcnJvcicpOyByZXR1cm47IH1cbiAgYXdhaXQgbG9hZFNlc3Npb25zKCk7XG4gIGlmIChBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPT09IHNlc3Npb25JZCkgc2VsZWN0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICBzaG93VG9hc3QoJ1Nlc3Npb24gcmVuYW1lZCcpO1xufVxuXG5mdW5jdGlvbiBfZGlzc29sdmVTZXNzaW9uKHNlc3Npb25JZCkge1xuICBjb25zdCBzZXNzaW9uID0gX3Nlc3Npb25CeUlkKHNlc3Npb25JZCk7XG4gIGlmICghc2Vzc2lvbikgcmV0dXJuO1xuICBzaG93Q29uZmlybShcbiAgICAnVW5ncm91cCB0aGlzIHNlc3Npb24/JyxcbiAgICBgVGhlICR7cGx1cmFsKHNlc3Npb24ubWVtYmVyX2NvdW50LCAncmVjb3JkaW5nJyl9IHN0YXkgLSB0aGV5IGFyZSBqdXN0IG5vIGxvbmdlciBncm91cGVkIGFzIGEgc2Vzc2lvbi4gVGhpcyBjYW5ub3QgZ3JvdXAgdGhlbSBiYWNrIGF1dG9tYXRpY2FsbHkuYCxcbiAgICAnVW5ncm91cCcsXG4gICAgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvc2Vzc2lvbnMvJHtzZXNzaW9uSWR9YCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgICAgIGlmICghcmVzLm9rKSB7IHNob3dUb2FzdCgnQ291bGQgbm90IHVuZ3JvdXAgc2Vzc2lvbicsICdlcnJvcicpOyByZXR1cm47IH1cbiAgICAgIGlmIChBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPT09IHNlc3Npb25JZCkgeyBBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPSBudWxsOyBfc2hvd0VtcHR5U2Vzc2lvbkRldGFpbCgpOyB9XG4gICAgICBhd2FpdCBsb2FkU2Vzc2lvbnMoKTtcbiAgICAgIHNob3dUb2FzdCgnU2Vzc2lvbiB1bmdyb3VwZWQnKTtcbiAgICB9LFxuICAgIHRydWUsXG4gICk7XG59XG5cbi8vIOKUgOKUgCBtYW51YWwgZ3JvdXBpbmcgc2VsZWN0aW9uIG1vZGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBhZGRUb1Nlc3Npb25JZCBpcyBzZXQgd2hlbiBncm91cGluZyBmcm9tIGEgc2Vzc2lvbidzIFwiQWRkIHJlY29yZGluZ3PigKZcIiBhY3Rpb246XG4vLyB0aGUgcGlja2VkIHJlY29yZGluZ3MgYXJlIGFkZGVkIHRvIHRoYXQgc2Vzc2lvbiBpbnN0ZWFkIG9mIGNyZWF0aW5nIGEgbmV3IG9uZS5cbmxldCBfYWRkVG9TZXNzaW9uSWQgPSBudWxsO1xuXG5mdW5jdGlvbiBlbnRlckdyb3VwaW5nTW9kZShhZGRUb1Nlc3Npb25JZCA9IG51bGwpIHtcbiAgX2FkZFRvU2Vzc2lvbklkID0gdHlwZW9mIGFkZFRvU2Vzc2lvbklkID09PSAnbnVtYmVyJyA/IGFkZFRvU2Vzc2lvbklkIDogbnVsbDtcbiAgU2Vzc2lvblVJLnNlbGVjdGlvbk1vZGUgPSB0cnVlO1xuICBTZXNzaW9uVUkuc2VsZWN0ZWQgPSBuZXcgU2V0KCk7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbiAgX3N5bmNHcm91cGluZ0JhcigpO1xufVxuXG5mdW5jdGlvbiBleGl0R3JvdXBpbmdNb2RlKCkge1xuICBTZXNzaW9uVUkuc2VsZWN0aW9uTW9kZSA9IGZhbHNlO1xuICBTZXNzaW9uVUkuc2VsZWN0ZWQgPSBuZXcgU2V0KCk7XG4gIF9hZGRUb1Nlc3Npb25JZCA9IG51bGw7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbiAgX3N5bmNHcm91cGluZ0JhcigpO1xufVxuXG5mdW5jdGlvbiB0b2dnbGVHcm91cFNlbGVjdCh2aWRlb0lkKSB7XG4gIGlmIChTZXNzaW9uVUkuc2VsZWN0ZWQuaGFzKHZpZGVvSWQpKSBTZXNzaW9uVUkuc2VsZWN0ZWQuZGVsZXRlKHZpZGVvSWQpO1xuICBlbHNlIFNlc3Npb25VSS5zZWxlY3RlZC5hZGQodmlkZW9JZCk7XG4gIF9yZW5kZXJWaWRlb0xpc3QoKTtcbiAgX3N5bmNHcm91cGluZ0JhcigpO1xufVxuXG5mdW5jdGlvbiBfc3luY0dyb3VwaW5nQmFyKCkge1xuICBjb25zdCBiYXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2Vzc2lvbi1ncm91cGluZy1iYXInKTtcbiAgaWYgKCFiYXIpIHJldHVybjtcbiAgYmFyLnN0eWxlLmRpc3BsYXkgPSBTZXNzaW9uVUkuc2VsZWN0aW9uTW9kZSA/ICcnIDogJ25vbmUnO1xuICBjb25zdCBjb3VudCA9IFNlc3Npb25VSS5zZWxlY3RlZC5zaXplO1xuICBjb25zdCBjb3VudEVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Nlc3Npb24tZ3JvdXBpbmctY291bnQnKTtcbiAgaWYgKGNvdW50RWwpIGNvdW50RWwudGV4dENvbnRlbnQgPSBwbHVyYWwoY291bnQsICdzZWxlY3RlZCByZWNvcmRpbmcnKTtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jb25maXJtLWdyb3VwJyk7XG4gIGlmIChidG4pIHtcbiAgICBjb25zdCBtaW4gPSBfYWRkVG9TZXNzaW9uSWQgIT0gbnVsbCA/IDEgOiAyO1xuICAgIGJ0bi5kaXNhYmxlZCA9IGNvdW50IDwgbWluO1xuICAgIGJ0bi50ZXh0Q29udGVudCA9IF9hZGRUb1Nlc3Npb25JZCAhPSBudWxsID8gJ0FkZCB0byBzZXNzaW9uJyA6ICdHcm91cCBhcyBzZXNzaW9uJztcbiAgfVxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXNzaW9uLWdyb3VwaW5nLWxhYmVsJyk7XG4gIGlmIChsYWJlbCkge1xuICAgIGxhYmVsLnRleHRDb250ZW50ID0gX2FkZFRvU2Vzc2lvbklkICE9IG51bGxcbiAgICAgID8gJ1BpY2sgcmVjb3JkaW5ncyB0byBhZGQgdG8gdGhpcyBzZXNzaW9uJ1xuICAgICAgOiAnUGljayAyKyByZWNvcmRpbmdzIHRvIGdyb3VwIGFzIGEgc2Vzc2lvbic7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY29uZmlybUdyb3VwU2VsZWN0aW9uKCkge1xuICBjb25zdCBpZHMgPSBbLi4uU2Vzc2lvblVJLnNlbGVjdGVkXTtcbiAgaWYgKF9hZGRUb1Nlc3Npb25JZCAhPSBudWxsKSB7XG4gICAgaWYgKCFpZHMubGVuZ3RoKSByZXR1cm47XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvc2Vzc2lvbnMvJHtfYWRkVG9TZXNzaW9uSWR9L21lbWJlcnNgLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3ZpZGVvX2lkczogaWRzfSksXG4gICAgfSk7XG4gICAgaWYgKCFyZXMub2spIHsgc2hvd1RvYXN0KCdDb3VsZCBub3QgYWRkIHJlY29yZGluZ3MnLCAnZXJyb3InKTsgcmV0dXJuOyB9XG4gICAgY29uc3Qgc2lkID0gX2FkZFRvU2Vzc2lvbklkO1xuICAgIGV4aXRHcm91cGluZ01vZGUoKTtcbiAgICBhd2FpdCBsb2FkVmlkZW9zKCk7XG4gICAgc2hvd1RvYXN0KGBBZGRlZCAke3BsdXJhbChpZHMubGVuZ3RoLCAncmVjb3JkaW5nJyl9YCk7XG4gICAgaWYgKEFwcFN0YXRlLmFjdGl2ZVNlc3Npb25JZCA9PT0gc2lkKSBzZWxlY3RTZXNzaW9uKHNpZCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChpZHMubGVuZ3RoIDwgMikgcmV0dXJuO1xuICBjb25zdCBuYW1lID0gYXdhaXQgX3Byb21wdFRleHQoJ05hbWUgdGhpcyBzZXNzaW9uJywgJ1Nlc3Npb24gbmFtZSAob3B0aW9uYWwpJywgJycpO1xuICBpZiAobmFtZSA9PT0gbnVsbCkgcmV0dXJuOyAgIC8vIGNhbmNlbGxlZFxuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnL2FwaS9zZXNzaW9ucycsIHtcbiAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtuYW1lLCB2aWRlb19pZHM6IGlkc30pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCByZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChlcnIuZGV0YWlsIHx8ICdDb3VsZCBub3QgY3JlYXRlIHNlc3Npb24nLCAnZXJyb3InKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gIGV4aXRHcm91cGluZ01vZGUoKTtcbiAgYXdhaXQgbG9hZFZpZGVvcygpO1xuICBzaG93VG9hc3QoYEdyb3VwZWQgJHtwbHVyYWwoaWRzLmxlbmd0aCwgJ3JlY29yZGluZycpfSBpbnRvIGEgc2Vzc2lvbmApO1xuICBzZWxlY3RTZXNzaW9uKHNlc3Npb24uaWQpO1xufVxuXG4vLyDilIDilIAgYXV0by1zdWdnZXN0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gX2dyb3VwS2V5KGlkcykgeyByZXR1cm4gWy4uLmlkc10uc29ydCgoYSwgYikgPT4gYSAtIGIpLmpvaW4oJywnKTsgfVxuXG5hc3luYyBmdW5jdGlvbiBzdWdnZXN0U2Vzc2lvbnMoKSB7XG4gIGxldCBncm91cHM7XG4gIHRyeSB7XG4gICAgZ3JvdXBzID0gYXdhaXQgZmV0Y2goJy9hcGkvc2Vzc2lvbnMvc3VnZ2VzdGlvbnMnKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICB9IGNhdGNoIHsgc2hvd1RvYXN0KCdDb3VsZCBub3QgbG9hZCBzdWdnZXN0aW9ucycsICdlcnJvcicpOyByZXR1cm47IH1cbiAgY29uc3QgZnJlc2ggPSBncm91cHMuZmlsdGVyKGcgPT4gIVNlc3Npb25VSS5kaXNtaXNzZWQuaGFzKF9ncm91cEtleShnLnZpZGVvX2lkcykpKTtcbiAgaWYgKCFmcmVzaC5sZW5ndGgpIHtcbiAgICBzaG93VG9hc3QoJ05vIG5ldyBzZXNzaW9uIHN1Z2dlc3Rpb25zIC0gcmVjb3JkaW5ncyBsb29rIHNlcGFyYXRlLicsICdpbmZvJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9zaG93U3VnZ2VzdGlvbk1vZGFsKGZyZXNoKTtcbn1cblxuZnVuY3Rpb24gb3BlblJlY29yZGluZ3NBY3Rpb25zTWVudShidG4pIHtcbiAgc2hvd0tlYmFiKGJ0biwgW1xuICAgIHsgbGFiZWw6ICdHcm91cCcsIGFjdGlvbjogKCkgPT4gZW50ZXJHcm91cGluZ01vZGUoKSB9LFxuICAgIHsgbGFiZWw6ICdTdWdnZXN0IHNlc3Npb25zJywgYWN0aW9uOiAoKSA9PiBzdWdnZXN0U2Vzc2lvbnMoKSB9LFxuICBdKTtcbn1cblxuZnVuY3Rpb24gX3Nob3dTdWdnZXN0aW9uTW9kYWwoZ3JvdXBzKSB7XG4gIGNvbnN0IGJnID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGJnLmNsYXNzTmFtZSA9ICdtb2RhbC1iZyB2aXNpYmxlJztcbiAgY29uc3QgaXRlbXMgPSBncm91cHMubWFwKChnLCBpKSA9PiBgXG4gICAgPGRpdiBjbGFzcz1cInNlc3Npb24tc3VnZ2VzdGlvblwiIGRhdGEtaWR4PVwiJHtpfVwiPlxuICAgICAgPGRpdiBzdHlsZT1cImZsZXg6MTttaW4td2lkdGg6MFwiPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZm9udC13ZWlnaHQ6NjAwO21hcmdpbi1ib3R0b206MnB4XCI+JHtwbHVyYWwoZy52aWRlb19pZHMubGVuZ3RoLCAncmVjb3JkaW5nJyl9IGxvb2sgbGlrZSBvbmUgc2Vzc2lvbjwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwibWV0YVwiIHN0eWxlPVwid2hpdGUtc3BhY2U6bm9ybWFsXCI+JHtnLnRpdGxlcy5tYXAodCA9PiBlc2NIdG1sKHQpKS5qb2luKCcgwrcgJyl9PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjZweDtmbGV4LXNocmluazowXCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWFjdD1cImRpc21pc3NcIiBkYXRhLWlkeD1cIiR7aX1cIj5EaXNtaXNzPC9idXR0b24+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIGRhdGEtYWN0PVwiZ3JvdXBcIiBkYXRhLWlkeD1cIiR7aX1cIj5Hcm91cDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YCkuam9pbignJyk7XG4gIGJnLmlubmVySFRNTCA9IGBcbiAgICA8ZGl2IGNsYXNzPVwibW9kYWxcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIiBhcmlhLWxhYmVsbGVkYnk9XCJzZXNzaW9uLXN1Z2dlc3QtdGl0bGVcIiBzdHlsZT1cIndpZHRoOjUyMHB4O21heC13aWR0aDo5NXZ3XCI+XG4gICAgICA8aDMgaWQ9XCJzZXNzaW9uLXN1Z2dlc3QtdGl0bGVcIj5TdWdnZXN0ZWQgc2Vzc2lvbnM8L2gzPlxuICAgICAgPHAgY2xhc3M9XCJtZXRhXCIgc3R5bGU9XCJtYXJnaW46MCAwIDEycHhcIj5SZWNvcmRpbmdzIHJlY29yZGVkIGJhY2stdG8tYmFjayBtYXkgYmVsb25nIHRvIG9uZSBwbGF5IHNlc3Npb24uIEdyb3VwIHRoZSBvbmVzIHRoYXQgZG8uPC9wPlxuICAgICAgPGRpdiBjbGFzcz1cInNlc3Npb24tc3VnZ2VzdGlvbi1saXN0XCI+JHtpdGVtc308L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJtb2RhbC1hY3Rpb25zXCIgc3R5bGU9XCJtYXJnaW4tdG9wOjE0cHhcIj48YnV0dG9uIGNsYXNzPVwiYnRuXCIgZGF0YS1hY3Q9XCJjbG9zZVwiPkRvbmU8L2J1dHRvbj48L2Rpdj5cbiAgICA8L2Rpdj5gO1xuICBjb25zdCBjbG9zZSA9ICgpID0+IHsgYmcucmVtb3ZlKCk7IGxvYWRWaWRlb3MoKTsgfTtcbiAgYmcub25jbGljayA9IGUgPT4ge1xuICAgIGlmIChlLnRhcmdldCA9PT0gYmcpIHsgY2xvc2UoKTsgcmV0dXJuOyB9XG4gICAgY29uc3QgYnRuID0gZS50YXJnZXQuY2xvc2VzdCgnYnV0dG9uW2RhdGEtYWN0XScpO1xuICAgIGlmICghYnRuKSByZXR1cm47XG4gICAgY29uc3QgYWN0ID0gYnRuLmRhdGFzZXQuYWN0O1xuICAgIGlmIChhY3QgPT09ICdjbG9zZScpIHsgY2xvc2UoKTsgcmV0dXJuOyB9XG4gICAgY29uc3QgaWR4ID0gcGFyc2VJbnQoYnRuLmRhdGFzZXQuaWR4LCAxMCk7XG4gICAgY29uc3QgZ3JvdXAgPSBncm91cHNbaWR4XTtcbiAgICBpZiAoYWN0ID09PSAnZGlzbWlzcycpIHtcbiAgICAgIFNlc3Npb25VSS5kaXNtaXNzZWQuYWRkKF9ncm91cEtleShncm91cC52aWRlb19pZHMpKTtcbiAgICAgIF9zYXZlSWRTZXQoRElTTUlTU19LRVksIFNlc3Npb25VSS5kaXNtaXNzZWQpO1xuICAgICAgYmcucXVlcnlTZWxlY3RvcihgLnNlc3Npb24tc3VnZ2VzdGlvbltkYXRhLWlkeD1cIiR7aWR4fVwiXWApPy5yZW1vdmUoKTtcbiAgICAgIGlmICghYmcucXVlcnlTZWxlY3RvcignLnNlc3Npb24tc3VnZ2VzdGlvbicpKSBjbG9zZSgpO1xuICAgIH0gZWxzZSBpZiAoYWN0ID09PSAnZ3JvdXAnKSB7XG4gICAgICBfYWNjZXB0U3VnZ2VzdGlvbihncm91cCwgKCkgPT4ge1xuICAgICAgICBiZy5xdWVyeVNlbGVjdG9yKGAuc2Vzc2lvbi1zdWdnZXN0aW9uW2RhdGEtaWR4PVwiJHtpZHh9XCJdYCk/LnJlbW92ZSgpO1xuICAgICAgICBpZiAoIWJnLnF1ZXJ5U2VsZWN0b3IoJy5zZXNzaW9uLXN1Z2dlc3Rpb24nKSkgY2xvc2UoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChiZyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9hY2NlcHRTdWdnZXN0aW9uKGdyb3VwLCBvbkRvbmUpIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvc2Vzc2lvbnMnLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7dmlkZW9faWRzOiBncm91cC52aWRlb19pZHN9KSxcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB7IHNob3dUb2FzdCgnQ291bGQgbm90IGNyZWF0ZSBzZXNzaW9uJywgJ2Vycm9yJyk7IHJldHVybjsgfVxuICBzaG93VG9hc3QoYEdyb3VwZWQgJHtwbHVyYWwoZ3JvdXAudmlkZW9faWRzLmxlbmd0aCwgJ3JlY29yZGluZycpfSBpbnRvIGEgc2Vzc2lvbmApO1xuICBhd2FpdCBsb2FkU2Vzc2lvbnMoKTtcbiAgb25Eb25lKCk7XG59XG5cbi8vIOKUgOKUgCB0ZXh0IHByb21wdCBtb2RhbCAoY3JlYXRlL3JlbmFtZSkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBfcHJvbXB0VGV4dCh0aXRsZSwgbGFiZWxUZXh0LCBpbml0aWFsKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICBjb25zdCBiZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGJnLmNsYXNzTmFtZSA9ICdtb2RhbC1iZyB2aXNpYmxlJztcbiAgICBiZy5pbm5lckhUTUwgPSBgXG4gICAgICA8ZGl2IGNsYXNzPVwibW9kYWxcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1tb2RhbD1cInRydWVcIiBhcmlhLWxhYmVsbGVkYnk9XCJzZXNzaW9uLXByb21wdC10aXRsZVwiIHN0eWxlPVwid2lkdGg6NDAwcHg7bWF4LXdpZHRoOjk1dndcIj5cbiAgICAgICAgPGgzIGlkPVwic2Vzc2lvbi1wcm9tcHQtdGl0bGVcIj4ke2VzY0h0bWwodGl0bGUpfTwvaDM+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZFwiPlxuICAgICAgICAgIDxsYWJlbCBmb3I9XCJzZXNzaW9uLXByb21wdC1pbnB1dFwiPiR7ZXNjSHRtbChsYWJlbFRleHQpfTwvbGFiZWw+XG4gICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJzZXNzaW9uLXByb21wdC1pbnB1dFwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cIm1vZGFsLWFjdGlvbnNcIiBzdHlsZT1cIm1hcmdpbi10b3A6MTRweDtkaXNwbGF5OmZsZXg7Z2FwOjhweDtqdXN0aWZ5LWNvbnRlbnQ6ZmxleC1lbmRcIj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgZGF0YS1hY3Q9XCJjYW5jZWxcIj5DYW5jZWw8L2J1dHRvbj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBkYXRhLWFjdD1cIm9rXCI+U2F2ZTwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PmA7XG4gICAgY29uc3QgaW5wdXQgPSBiZy5xdWVyeVNlbGVjdG9yKCcjc2Vzc2lvbi1wcm9tcHQtaW5wdXQnKTtcbiAgICBpbnB1dC52YWx1ZSA9IGluaXRpYWwgfHwgJyc7XG4gICAgY29uc3QgZG9uZSA9IHZhbHVlID0+IHsgYmcucmVtb3ZlKCk7IHJlc29sdmUodmFsdWUpOyB9O1xuICAgIGJnLm9uY2xpY2sgPSBlID0+IHtcbiAgICAgIGlmIChlLnRhcmdldCA9PT0gYmcgfHwgZS50YXJnZXQuZGF0YXNldC5hY3QgPT09ICdjYW5jZWwnKSByZXR1cm4gZG9uZShudWxsKTtcbiAgICAgIGlmIChlLnRhcmdldC5kYXRhc2V0LmFjdCA9PT0gJ29rJykgcmV0dXJuIGRvbmUoaW5wdXQudmFsdWUudHJpbSgpKTtcbiAgICB9O1xuICAgIGlucHV0Lm9ua2V5ZG93biA9IGUgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7IGUucHJldmVudERlZmF1bHQoKTsgZG9uZShpbnB1dC52YWx1ZS50cmltKCkpOyB9XG4gICAgICBlbHNlIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBkb25lKG51bGwpOyB9XG4gICAgfTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGJnKTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHsgaW5wdXQuZm9jdXMoKTsgaW5wdXQuc2VsZWN0KCk7IH0sIDMwKTtcbiAgfSk7XG59XG5cbi8vIOKUgOKUgCBzZXNzaW9uIGRldGFpbCB2aWV3IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuYXN5bmMgZnVuY3Rpb24gc2VsZWN0U2Vzc2lvbihzZXNzaW9uSWQpIHtcbiAgQXBwU3RhdGUuYWN0aXZlU2Vzc2lvbklkID0gc2Vzc2lvbklkO1xuICBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkID0gbnVsbDtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI3ZpZGVvLWxpc3QgbGknKS5mb3JFYWNoKGwgPT4gbC5jbGFzc0xpc3QucmVtb3ZlKCdhY3RpdmUnKSk7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCN2aWRlby1saXN0IGxpW2RhdGEtc2Vzc2lvbi1pZD1cIiR7c2Vzc2lvbklkfVwiXWApPy5jbGFzc0xpc3QuYWRkKCdhY3RpdmUnKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJykuaW5uZXJIVE1MID0gJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPVxuICAgICc8ZGl2IHN0eWxlPVwicGFkZGluZzoyNHB4O2NvbG9yOnZhcigtLW11dGVkKVwiPkxvYWRpbmcgc2Vzc2lvbuKApjwvZGl2Pic7XG4gIGxldCBzZXNzaW9uO1xuICB0cnkge1xuICAgIHNlc3Npb24gPSBhd2FpdCBmZXRjaChgL2FwaS9zZXNzaW9ucy8ke3Nlc3Npb25JZH1gKS50aGVuKHIgPT4ge1xuICAgICAgaWYgKCFyLm9rKSB0aHJvdyBuZXcgRXJyb3IoU3RyaW5nKHIuc3RhdHVzKSk7XG4gICAgICByZXR1cm4gci5qc29uKCk7XG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPVxuICAgICAgJzxkaXYgc3R5bGU9XCJwYWRkaW5nOjI0cHg7Y29sb3I6dmFyKC0tcmVkKVwiPkNvdWxkIG5vdCBsb2FkIHRoaXMgc2Vzc2lvbi48L2Rpdj4nO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoQXBwU3RhdGUuYWN0aXZlU2Vzc2lvbklkICE9PSBzZXNzaW9uSWQpIHJldHVybjsgICAvLyBzdXBlcnNlZGVkXG4gIF9yZW5kZXJTZXNzaW9uRGV0YWlsKHNlc3Npb24pO1xufVxuXG5mdW5jdGlvbiBfc2hvd0VtcHR5U2Vzc2lvbkRldGFpbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJykuaW5uZXJIVE1MID0gJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPSAnJztcbn1cblxuZnVuY3Rpb24gX3JlbmRlclNlc3Npb25EZXRhaWwoc2Vzc2lvbikge1xuICBjb25zdCBtZW1iZXJJZHMgPSBzZXNzaW9uLm1lbWJlcnMubWFwKG0gPT4gbS5pZCk7XG4gIGNvbnN0IGViID0gaXNFZGl0ZWQgPT4gaXNFZGl0ZWQgPyAnPHNwYW4gY2xhc3M9XCJlZGl0ZWQtYmFkZ2VcIj5lZGl0ZWQ8L3NwYW4+JyA6ICcnO1xuICBjb25zdCB0aXRsZVRleHQgPSBzZXNzaW9uLnRpdGxlIHx8IHNlc3Npb24ubmFtZSB8fCAnU2Vzc2lvbic7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdj48ZGl2IGNsYXNzPVwiZGV0YWlsLXR5cGUtYmFkZ2UgdmlkZW8tYmFkZ2VcIj4mIzEyNzkwMjsgU2Vzc2lvbjwvZGl2PjwvZGl2PlxuXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+XG4gICAgICAgIDxoMiBzdHlsZT1cIm1hcmdpbjowO2ZvbnQtc2l6ZToxN3B4O2ZvbnQtd2VpZ2h0OjcwMFwiPiR7ZXNjSHRtbCh0aXRsZVRleHQpfSR7ZWIoc2Vzc2lvbi50aXRsZV9pc19lZGl0ZWQpfTwvaDI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJrZWJhYi1idG5cIiB0aXRsZT1cIlNlc3Npb24gYWN0aW9uc1wiIGFyaWEtbGFiZWw9XCJTZXNzaW9uIGFjdGlvbnNcIiBpZD1cInNlc3Npb24tZGV0YWlsLWtlYmFiXCI+JiM4OTQyOzwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxM3B4XCI+XG4gICAgICAgICR7cGx1cmFsKHNlc3Npb24ubWVtYmVycy5sZW5ndGgsICdyZWNvcmRpbmcnKX0gJm1pZGRvdDsgJHtfbXNUb0htcyhzZXNzaW9uLnRvdGFsX21zKX0gdG90YWxcbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgJHtjb2xsYXBzaWJsZUNhcmQoJ3Nlc3Npb24tc3VtbWFyeScsXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+U2Vzc2lvbiBTdW1tYXJ5JHtlYihzZXNzaW9uLnN1bW1hcnlfaXNfZWRpdGVkKX08L3NwYW4+YCwgYFxuICAgICAgJHtzZXNzaW9uLnN1bW1hcnlcbiAgICAgICAgPyBgPGRpdiBjbGFzcz1cImRlc2NyaXB0aW9uLWxvbmdcIj4ke2VzY0h0bWwoc2Vzc2lvbi5zdW1tYXJ5KX08L2Rpdj5gXG4gICAgICAgIDogYDxkaXYgc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHhcIj5ObyBzdW1tYXJ5IHlldCAtIHJvbGwgb25lIHVwIGZyb20gdGhlIHJlY29yZGluZ3MnIHN1bW1hcmllcy48L2Rpdj5gfWAsXG4gICAgICB7IGFjdGlvbnM6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJzZXNzaW9uLXN1bW1hcml6ZS1idG5cIj4ke3Nlc3Npb24uc3VtbWFyeSA/ICdSZWdlbmVyYXRlJyA6ICdHZW5lcmF0ZSBTdW1tYXJ5J308L2J1dHRvbj5gIH0pfVxuXG4gICAgPGRpdiBjbGFzcz1cInZpZC1hY3Rpb25zXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwidmlkLWFjdGlvbnMtcm93XCI+XG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJidG5cIiBpZD1cInNlc3Npb24tcmVlbC1idG5cIj5CdWlsZCBIaWdobGlnaHQgUmVlbCBmcm9tIFNlc3Npb248L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuXG4gICAgJHtjb2xsYXBzaWJsZUNhcmQoJ3Nlc3Npb24tdGltZWxpbmUnLFxuICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5VbmlmaWVkIFRpbWVsaW5lPC9zcGFuPmAsIGBcbiAgICAgIDxkaXYgaWQ9XCJzZXNzaW9uLXRpbWVsaW5lXCI+JHtfcmVuZGVyVW5pZmllZFRpbWVsaW5lKHNlc3Npb24pfTwvZGl2PmApfWA7XG5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Nlc3Npb24tZGV0YWlsLWtlYmFiJykub25jbGljayA9XG4gICAgZSA9PiBfb3BlblNlc3Npb25NZW51KHNlc3Npb24uaWQsIGUuY3VycmVudFRhcmdldCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXNzaW9uLXN1bW1hcml6ZS1idG4nKS5vbmNsaWNrID0gKCkgPT4gX3N1bW1hcml6ZVNlc3Npb24oc2Vzc2lvbi5pZCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXNzaW9uLXJlZWwtYnRuJykub25jbGljayA9ICgpID0+IHdpbmRvdy5vcGVuUmVlbEZvclNlc3Npb24oc2Vzc2lvbi5pZCwgbWVtYmVySWRzKTtcbiAgX3dpcmVUaW1lbGluZU5hdmlnYXRpb24oKTtcbn1cblxuZnVuY3Rpb24gX3JlbmRlclVuaWZpZWRUaW1lbGluZShzZXNzaW9uKSB7XG4gIGlmICghc2Vzc2lvbi5tZW1iZXJzLmxlbmd0aCkgcmV0dXJuICc8ZGl2IGNsYXNzPVwibWV0YVwiPk5vIHJlY29yZGluZ3MgaW4gdGhpcyBzZXNzaW9uLjwvZGl2Pic7XG4gIGNvbnN0IGJsb2NrcyA9IHNlc3Npb24ubWVtYmVycy5tYXAobSA9PiB7XG4gICAgY29uc3QgZ2FwID0gbS5nYXBfYmVmb3JlX21zID4gMFxuICAgICAgPyBgPGRpdiBjbGFzcz1cInNlc3Npb24tZ2FwXCI+Jm1kYXNoOyAke19mbXRHYXAobS5nYXBfYmVmb3JlX21zKX0gYnJlYWsgJm1kYXNoOzwvZGl2PmBcbiAgICAgIDogJyc7XG4gICAgY29uc3QgaGVhZCA9IGBcbiAgICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLW1lbWJlci1oZWFkXCI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwic2Vzc2lvbi1tZW1iZXItb2Zmc2V0XCI+JHtfbXNUb0htcyhtLm9mZnNldF9tcyl9PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInNlc3Npb24tbWVtYmVyLXRpdGxlXCI+JHtlc2NIdG1sKG0udGl0bGUpfTwvc3Bhbj5cbiAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjEwcHg7cGFkZGluZzoxcHggN3B4XCIgZGF0YS1vcGVuLXZpZGVvPVwiJHttLmlkfVwiPk9wZW48L2J1dHRvbj5cbiAgICAgIDwvZGl2PmA7XG4gICAgbGV0IGJvZHk7XG4gICAgaWYgKCFtLmhhc190aW1lbGluZSAmJiAhbS5jbGlwcy5sZW5ndGgpIHtcbiAgICAgIGJvZHkgPSBgPGRpdiBjbGFzcz1cIm1ldGFcIiBzdHlsZT1cInBhZGRpbmc6NHB4IDAgOHB4XCI+Tm8gdGltZWxpbmUgeWV0IC0gPGEgaHJlZj1cIiNcIiBkYXRhLW9wZW4tdmlkZW89XCIke20uaWR9XCI+b3BlbiB0byBnZW5lcmF0ZSBvbmU8L2E+LjwvZGl2PmA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHJvd3MgPSBfbWVyZ2VUaW1lbGluZVJvd3MobSkubWFwKHIgPT4gci5odG1sKS5qb2luKCcnKTtcbiAgICAgIGJvZHkgPSBgPGRpdiBjbGFzcz1cInNlc3Npb24tdGltZWxpbmUtcm93c1wiPiR7cm93c308L2Rpdj5gO1xuICAgIH1cbiAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJzZXNzaW9uLW1lbWJlci1ibG9ja1wiPiR7Z2FwfSR7aGVhZH0ke2JvZHl9PC9kaXY+YDtcbiAgfSk7XG4gIHJldHVybiBibG9ja3Muam9pbignJyk7XG59XG5cbi8vIEludGVybGVhdmVzIGEgbWVtYmVyJ3MgdGltZWxpbmUgZW50cmllcyBhbmQgY2xpcCBtYXJrZXJzIGJ5IGFic29sdXRlIHRpbWUgc29cbi8vIHRoZSByZWFkZXIgc2VlcyBib3RoIG9uIG9uZSBheGlzLiBFYWNoIHJvdyBjYXJyaWVzIHRoZSBkYXRhLSogbmF2IGF0dHJpYnV0ZXMuXG5mdW5jdGlvbiBfbWVyZ2VUaW1lbGluZVJvd3MobWVtYmVyKSB7XG4gIGNvbnN0IHJvd3MgPSBbXTtcbiAgZm9yIChjb25zdCBlIG9mIG1lbWJlci50aW1lbGluZSkge1xuICAgIHJvd3MucHVzaCh7IGFiczogZS5hYnNfbXMsIGh0bWw6IGBcbiAgICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLXRsLXJvd1wiIGRhdGEtZ290by12aWRlbz1cIiR7bWVtYmVyLmlkfVwiIGRhdGEtZ290by1tcz1cIiR7ZS5sb2NhbF9tc31cIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJzZXNzaW9uLXRsLXN0YW1wXCI+JHtlc2NIdG1sKF9tc1RvSG1zKGUuYWJzX21zKSl9PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInNlc3Npb24tdGwtdGV4dFwiPiR7ZXNjSHRtbChlLnRleHQpfTwvc3Bhbj5cbiAgICAgIDwvZGl2PmAgfSk7XG4gIH1cbiAgZm9yIChjb25zdCBjIG9mIG1lbWJlci5jbGlwcykge1xuICAgIHJvd3MucHVzaCh7IGFiczogYy5hYnNfbXMsIGh0bWw6IGBcbiAgICAgIDxkaXYgY2xhc3M9XCJzZXNzaW9uLXRsLXJvdyBzZXNzaW9uLXRsLWNsaXBcIiBkYXRhLW9wZW4tY2xpcD1cIiR7Yy5pZH1cIiBkYXRhLWNsaXAtdmlkZW89XCIke21lbWJlci5pZH1cIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJzZXNzaW9uLXRsLXN0YW1wXCI+JHtlc2NIdG1sKF9tc1RvSG1zKGMuYWJzX21zKSl9PC9zcGFuPlxuICAgICAgICA8c3BhbiBjbGFzcz1cInNlc3Npb24tdGwtdGV4dFwiPiYjMTI3OTE2OyAke2VzY0h0bWwoYy5kZXNjcmlwdGlvbiB8fCBgQ2xpcCAke2MuaWR9YCl9XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJtZXRhXCI+JiMxMTA4ODsgJHtNYXRoLnJvdW5kKChjLnNjb3JlX292ZXJhbGwgfHwgMCkgKiAxMDApfSU8L3NwYW4+PC9zcGFuPlxuICAgICAgPC9kaXY+YCB9KTtcbiAgfVxuICByb3dzLnNvcnQoKGEsIGIpID0+IGEuYWJzIC0gYi5hYnMpO1xuICByZXR1cm4gcm93cztcbn1cblxuZnVuY3Rpb24gX3dpcmVUaW1lbGluZU5hdmlnYXRpb24oKSB7XG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZXNzaW9uLXRpbWVsaW5lJyk7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm47XG4gIGNvbnRhaW5lci5vbmNsaWNrID0gYXN5bmMgZSA9PiB7XG4gICAgY29uc3Qgb3BlblZpZGVvID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtb3Blbi12aWRlb10nKTtcbiAgICBpZiAob3BlblZpZGVvKSB7IGUucHJldmVudERlZmF1bHQoKTsgc2VsZWN0VmlkZW8ocGFyc2VJbnQob3BlblZpZGVvLmRhdGFzZXQub3BlblZpZGVvLCAxMCkpOyByZXR1cm47IH1cbiAgICBjb25zdCBjbGlwUm93ID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtb3Blbi1jbGlwXScpO1xuICAgIGlmIChjbGlwUm93KSB7XG4gICAgICBhd2FpdCBzZWxlY3RWaWRlbyhwYXJzZUludChjbGlwUm93LmRhdGFzZXQuY2xpcFZpZGVvLCAxMCkpO1xuICAgICAgaWYgKHdpbmRvdy5zZWxlY3RDbGlwKSB3aW5kb3cuc2VsZWN0Q2xpcChwYXJzZUludChjbGlwUm93LmRhdGFzZXQub3BlbkNsaXAsIDEwKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGdvdG9Sb3cgPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1nb3RvLXZpZGVvXScpO1xuICAgIGlmIChnb3RvUm93KSB7IF9nb3RvUmVjb3JkaW5nVGltZShwYXJzZUludChnb3RvUm93LmRhdGFzZXQuZ290b1ZpZGVvLCAxMCksIHBhcnNlSW50KGdvdG9Sb3cuZGF0YXNldC5nb3RvTXMsIDEwKSk7IH1cbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2dvdG9SZWNvcmRpbmdUaW1lKHZpZGVvSWQsIGxvY2FsTXMpIHtcbiAgYXdhaXQgc2VsZWN0VmlkZW8odmlkZW9JZCk7XG4gIGNvbnN0IHZpZGVvRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjb3JkaW5nLXByZXZpZXctdmlkZW8nKTtcbiAgaWYgKCF2aWRlb0VsKSByZXR1cm47XG4gIGNvbnN0IG9mZnNldFMgPSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0RhdGE/LnNlZ21lbnRfc3RhcnRfcyB8fCAwO1xuICBjb25zdCBzZWVrVG8gPSBsb2NhbE1zIC8gMTAwMCArIG9mZnNldFM7XG4gIGNvbnN0IGRvU2VlayA9ICgpID0+IHsgdHJ5IHsgdmlkZW9FbC5jdXJyZW50VGltZSA9IHNlZWtUbzsgfSBjYXRjaCB7fSB9O1xuICBpZiAodmlkZW9FbC5yZWFkeVN0YXRlID49IDEpIGRvU2VlaygpO1xuICBlbHNlIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCBkb1NlZWssIHtvbmNlOiB0cnVlfSk7XG59XG5cbmZ1bmN0aW9uIF9zdW1tYXJpemVTZXNzaW9uKHNlc3Npb25JZCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2Vzc2lvbi1zdW1tYXJpemUtYnRuJyk7XG4gIGlmIChidG4pIHsgYnRuLmRpc2FibGVkID0gdHJ1ZTsgYnRuLnRleHRDb250ZW50ID0gJ1N1bW1hcml6aW5n4oCmJzsgfVxuICBvcGVuTG9nKCk7XG4gIHN0cmVhbVNTRShcbiAgICBgL2FwaS9zZXNzaW9ucy8ke3Nlc3Npb25JZH0vc3VtbWFyaXplYCxcbiAgICAoKSA9PiB7XG4gICAgICBzaG93VG9hc3QoJ1Nlc3Npb24gc3VtbWFyeSBnZW5lcmF0ZWQnKTtcbiAgICAgIGlmIChBcHBTdGF0ZS5hY3RpdmVTZXNzaW9uSWQgPT09IHNlc3Npb25JZCkgc2VsZWN0U2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgbG9hZFNlc3Npb25zKCk7XG4gICAgfSxcbiAgICBbe2xhYmVsOiAnU3VtbWFyaXplJywgcGF0dGVybnM6IFsnR2VuZXJhdGluZyddfV0sXG4gICAgJ1Nlc3Npb24gc3VtbWFyeScsXG4gICAgZmFsc2UsXG4gICk7XG59XG5cbmZ1bmN0aW9uIF9mbXRHYXAobXMpIHtcbiAgY29uc3QgbWlucyA9IE1hdGgucm91bmQobXMgLyA2MDAwMCk7XG4gIGlmIChtaW5zIDwgNjApIHJldHVybiBwbHVyYWwobWlucywgJ21pbicpO1xuICBjb25zdCBoID0gTWF0aC5mbG9vcihtaW5zIC8gNjApLCBtID0gbWlucyAlIDYwO1xuICByZXR1cm4gbSA/IGAke2h9aCAke219bWAgOiBwbHVyYWwoaCwgJ2hyJyk7XG59XG5cbi8vIOKUgOKUgCBzdGF0aWMgaW5kZXguaHRtbCBoYW5kbGVycyB0aGlzIG1vZHVsZSBvd25zICh3aXJlZCBvbmNlIGF0IGxvYWQpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVGhlIHJlY29yZGluZ3Mtc2VjdGlvbiBrZWJhYiBhbmQgdGhlIGdyb3VwaW5nLWJhcidzIENhbmNlbC9Hcm91cCBidXR0b25zIGFyZVxuLy8gZml4ZWQsIG5ldmVyLXJlY3JlYXRlZCBlbGVtZW50cyBpbiBpbmRleC5odG1sLCBzbyBhIHNpbmdsZSBsb2FkLXRpbWUgbGlzdGVuZXJcbi8vIGNhbid0IGRvdWJsZS1maXJlIG9uIGEgcmUtcmVuZGVyLlxuZnVuY3Rpb24gX3dpcmVTdGF0aWNIYW5kbGVycygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1yZWNvcmRpbmdzLWFjdGlvbnMnKVxuICAgIC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4gb3BlblJlY29yZGluZ3NBY3Rpb25zTWVudShlLmN1cnJlbnRUYXJnZXQpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jYW5jZWwtZ3JvdXAnKVxuICAgIC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGV4aXRHcm91cGluZ01vZGUoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY29uZmlybS1ncm91cCcpXG4gICAgLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY29uZmlybUdyb3VwU2VsZWN0aW9uKCkpO1xufVxuXG5fd2lyZVN0YXRpY0hhbmRsZXJzKCk7XG5cbmV4cG9ydCB7XG4gIFNlc3Npb25VSSwgaXNTZXNzaW9uQ29sbGFwc2VkLCBzZXNzaW9uR3JvdXBIZWFkZXJMaSwgdG9nZ2xlR3JvdXBTZWxlY3QsXG59O1xuIiwgImltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQge1xuICBlc2NIdG1sLCBfc2NvcmVJY29uLCBfc2NvcmVCb3JkZXJDb2xvciwgX3NvcnRTY29yZSwgZm10RHVyYXRpb24sIHBsdXJhbCwgdHJ1bmNhdGUsXG4gIF9mbXRBZ28sIF9mbXRPZmZzZXQsIGZvcm1hdEFwaUVycm9yLFxufSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5pbXBvcnQge1xuICBzaG93VG9hc3QsIGNvbGxhcHNpYmxlQ2FyZCwgY29weVRleHQsIF9zeW5jU29ydERpckJ0biwgb3BlbkxvZywgYXBwZW5kTG9nLFxufSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7XG4gIHNob3dDb25maXJtLCBzaG93S2ViYWIsIG9wZW5BY3Rpb25zTW9kYWwsIG9wZW5EaWZmTW9kYWwsIG9wZW5GaWVsZEVkaXRNb2RhbCwgc2hvd1VuZG9Ub2FzdCxcbn0gZnJvbSAnLi91aS5qcyc7XG5pbXBvcnQgeyBQYW5lbE5hdiB9IGZyb20gJy4vcGFuZWxuYXYuanMnO1xuaW1wb3J0IHtcbiAgc3RyZWFtU1NFLCBzZXRKb2JDYW5jZWwsIF9ibG9ja2VkQnlBbmFseXplLCBfb3BlblNTRSwgX3NldEFjdGl2ZVN0cmVhbSwgX2NsZWFyQWN0aXZlU3RyZWFtLFxuICBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtLCBGUkFNRVNfU1RFUFMsIFNDT1JFX1NURVBTLCBhcHBseUpvYkJsb2NrZWRTdGF0ZSxcbn0gZnJvbSAnLi9qb2JzLmpzJztcbmltcG9ydCB7IGdhdGVPbkNhcGFiaWxpdHkgfSBmcm9tICcuL21vZGVsY2F0YWxvZy5qcyc7XG5pbXBvcnQgeyBsb2FkVmlkZW9zLCBfY2xpcHNMaXN0VXJsIH0gZnJvbSAnLi92aWRlb3MuanMnO1xuXG4vLyDilIDilIAgY2xpcCBsaXN0ICYgZmlsdGVyaW5nIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gX2FwcGx5RmlsdGVycygpIHtcbiAgY29uc3QgZiA9IEFwcFN0YXRlLmNsaXBGaWx0ZXJzO1xuICBsZXQgcmVzdWx0ID0gQXBwU3RhdGUuY2xpcHM7XG4gIGlmIChmICYmIGYuc2l6ZSkge1xuICAgIGNvbnN0IHN0YXR1c2VzID0gWydwZW5kaW5nJywgJ2FwcHJvdmVkJywgJ3JlamVjdGVkJ10uZmlsdGVyKHMgPT4gZi5oYXMocykpO1xuICAgIGlmIChzdGF0dXNlcy5sZW5ndGgpIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoYyA9PiBzdGF0dXNlcy5pbmNsdWRlcyhjLnN0YXR1cykpO1xuICAgIGlmIChmLmhhcygnZXhwb3J0ZWQnKSAmJiAhZi5oYXMoJ25vdC1leHBvcnRlZCcpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gYy5oYXNfZXhwb3J0KTtcbiAgICBlbHNlIGlmIChmLmhhcygnbm90LWV4cG9ydGVkJykgJiYgIWYuaGFzKCdleHBvcnRlZCcpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gIWMuaGFzX2V4cG9ydCk7XG4gICAgaWYgKGYuaGFzKCdlcnJvcicpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gKGMudGFncyB8fCBbXSkuaW5jbHVkZXMoJ2xsbV9lcnJvcicpKTtcbiAgICBpZiAoZi5oYXMoJ2ZsYWdnZWQnKSkgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihjID0+IChjLnNlbnNpdGl2ZV9tYXRjaGVzIHx8IFtdKS5sZW5ndGggPiAwKTtcbiAgICBpZiAoZi5oYXMoJ2R1cGxpY2F0ZScpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gKGMudGFncyB8fCBbXSkuaW5jbHVkZXMoJ3Bvc3NpYmxlX2R1cGxpY2F0ZScpKTtcbiAgICBpZiAoZi5oYXMoJ25vX3NwZWVjaCcpKSByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGMgPT4gKGMudGFncyB8fCBbXSkuaW5jbHVkZXMoJ25vX3NwZWVjaCcpKTtcbiAgfVxuICBpZiAoQXBwU3RhdGUuY2xpcFNjb3JlTWluID4gMCkgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihjID0+IGMuc2NvcmVfb3ZlcmFsbCA+PSBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4pO1xuICBpZiAoQXBwU3RhdGUuY2xpcFNlYXJjaCkge1xuICAgIGNvbnN0IHEgPSBBcHBTdGF0ZS5jbGlwU2VhcmNoLnRvTG93ZXJDYXNlKCk7XG4gICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihjID0+XG4gICAgICAoYy5kZXNjcmlwdGlvbiB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgKGMuZGVzY3JpcHRpb25fbG9uZyB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgKGMudHJhbnNjcmlwdF9leGNlcnB0IHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XG4gICAgICAoYy51c2VyX3RhZ3MgfHwgW10pLnNvbWUodCA9PiB0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpXG4gICAgKTtcbiAgfVxuICAvLyBEaXJlY3Rpb24gaXMgYXBwbGllZCBjbGllbnQtc2lkZSBieSByZXZlcnNpbmcgdGhlIHNlcnZlci1zb3J0ZWQgb3JkZXI7IGNvcHlcbiAgLy8gZmlyc3Qgc28gd2UgbmV2ZXIgbXV0YXRlIEFwcFN0YXRlLmNsaXBzIChyZXN1bHQgbWF5IHN0aWxsIGJlIHRoYXQgYXJyYXkpLlxuICBpZiAoKEFwcFN0YXRlLmNsaXBTb3J0RGlyIHx8ICdkZXNjJykgPT09ICdhc2MnKSByZXN1bHQgPSBbLi4ucmVzdWx0XS5yZXZlcnNlKCk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUNsaXBTb3J0RGlyKCkge1xuICBBcHBTdGF0ZS5jbGlwU29ydERpciA9IChBcHBTdGF0ZS5jbGlwU29ydERpciA9PT0gJ2FzYycpID8gJ2Rlc2MnIDogJ2FzYyc7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdjbGlwcy1zb3J0LWRpcicsIEFwcFN0YXRlLmNsaXBTb3J0RGlyKTtcbiAgX3N5bmNTb3J0RGlyQnRuKCdjbGlwcy1zb3J0LWRpcicsIEFwcFN0YXRlLmNsaXBTb3J0RGlyKTtcbiAgX3JlbmRlckNsaXBzKCk7XG59XG5cbi8vIENhbm9uaWNhbCBjbGlwIHJlLXJlbmRlciBlbnRyeSBwb2ludC4gQWx3YXlzIHJvdXRlcyB0aHJvdWdoIF9hcHBseUZpbHRlcnMoKVxuLy8gc28gYSByZS1yZW5kZXIgY2FuJ3QgYWNjaWRlbnRhbGx5IGJ5cGFzcyB0aGUgYWN0aXZlIHNlYXJjaC9zdGF0dXMvc2NvcmVcbi8vIGZpbHRlcnMuIENhbGwgdGhpcyAtIG5ldmVyIF9yZW5kZXJDbGlwSXRlbXMgZGlyZWN0bHkgLSBhZnRlciBtdXRhdGluZyBBcHBTdGF0ZS5jbGlwcy5cbmZ1bmN0aW9uIF9yZW5kZXJDbGlwcygpIHtcbiAgd2luZG93Ll9wcnVuZUNsaXBTZWxlY3Rpb24oKTtcbiAgY29uc3Qgc2hvd24gPSBfYXBwbHlGaWx0ZXJzKCk7XG4gIF9yZW5kZXJDbGlwSXRlbXMoc2hvd24pO1xuICBfcmVuZGVyQ2xpcFN0YXRzTGluZShzaG93bik7XG4gIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCk7XG59XG5cbi8vIFBlci1zdGF0dXMgY291bnRzIHNob3duIGlubGluZSBvbiB0aGUgZmlsdGVyIGNoaXBzIChcIlVucmV2aWV3ZWQgMzBcIikuIENvdW50c1xuLy8gcmVmbGVjdCB0aGUgd2hvbGUgc2VsZWN0ZWQgcmVjb3JkaW5nLCBub3QgdGhlIGZpbHRlcmVkL3Nob3duIHN1YnNldCAtIHNlZSB0aGVcbi8vIHN0YXRzIGxpbmUgZm9yIHRoYXQuIERlcml2ZWQgZW50aXJlbHkgZnJvbSBBcHBTdGF0ZS5jbGlwczsgYmxhbmsgd2hlbiBub1xuLy8gcmVjb3JkaW5nIGlzIHNlbGVjdGVkIHNvIHRoZSBjaGlwcyByZWFkIGFzIGEgcGxhaW4gZmlsdGVyIGJhci5cbmZ1bmN0aW9uIF9yZW5kZXJDbGlwRmlsdGVyQ291bnRzKCkge1xuICAvLyBCYWRnZXMgbGl2ZSBvbmx5IG9uIHRoZSBjbGlwIGZpbHRlciBjaGlwcyAoZGF0YS1jb3VudCBpcyB1bmlxdWUgdG8gdGhlbSksIHNvXG4gIC8vIHF1ZXJ5IHRoZSBkb2N1bWVudCBkaXJlY3RseSAtIHRoZSByZWNvcmRpbmdzIGZpbHRlciByb3cgc2hhcmVzIHRoZVxuICAvLyAuY2xpcC1maWx0ZXItdGFicyBjbGFzcyBidXQgY2FycmllcyBubyBjb3VudHMuXG4gIGNvbnN0IHNldENvdW50ID0gKGtleSwgdmFsdWUpID0+IHtcbiAgICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYC5jbGlwLWNoaXAtY291bnRbZGF0YS1jb3VudD1cIiR7a2V5fVwiXWApO1xuICAgIGlmIChiYWRnZSkgYmFkZ2UudGV4dENvbnRlbnQgPSB2YWx1ZSA9PSBudWxsID8gJycgOiBTdHJpbmcodmFsdWUpO1xuICB9O1xuICBpZiAoIUFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQgfHwgIUFwcFN0YXRlLmNsaXBzLmxlbmd0aCkge1xuICAgIGZvciAoY29uc3Qga2V5IG9mIFsnYWxsJywgJ3BlbmRpbmcnLCAnYXBwcm92ZWQnLCAncmVqZWN0ZWQnLCAnZXJyb3InLCAnZHVwbGljYXRlJ10pIHNldENvdW50KGtleSwgbnVsbCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGNvdW50cyA9IHtwZW5kaW5nOiAwLCBhcHByb3ZlZDogMCwgcmVqZWN0ZWQ6IDB9O1xuICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gIGxldCBkdXBsaWNhdGVDb3VudCA9IDA7XG4gIGZvciAoY29uc3QgYyBvZiBBcHBTdGF0ZS5jbGlwcykge1xuICAgIGNvdW50c1tjLnN0YXR1c10gPSAoY291bnRzW2Muc3RhdHVzXSB8fCAwKSArIDE7XG4gICAgaWYgKChjLnRhZ3MgfHwgW10pLmluY2x1ZGVzKCdsbG1fZXJyb3InKSkgZXJyb3JDb3VudCsrO1xuICAgIGlmICgoYy50YWdzIHx8IFtdKS5pbmNsdWRlcygncG9zc2libGVfZHVwbGljYXRlJykpIGR1cGxpY2F0ZUNvdW50Kys7XG4gIH1cbiAgc2V0Q291bnQoJ2FsbCcsIEFwcFN0YXRlLmNsaXBzLmxlbmd0aCk7XG4gIHNldENvdW50KCdwZW5kaW5nJywgY291bnRzLnBlbmRpbmcpO1xuICBzZXRDb3VudCgnYXBwcm92ZWQnLCBjb3VudHMuYXBwcm92ZWQpO1xuICBzZXRDb3VudCgncmVqZWN0ZWQnLCBjb3VudHMucmVqZWN0ZWQpO1xuICBzZXRDb3VudCgnZXJyb3InLCBlcnJvckNvdW50IHx8IG51bGwpO1xuICBzZXRDb3VudCgnZHVwbGljYXRlJywgZHVwbGljYXRlQ291bnQgfHwgbnVsbCk7XG59XG5cbmZ1bmN0aW9uIF9yZW5kZXJDbGlwU3RhdHNMaW5lKHNob3duKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtc3RhdHMtbGluZScpO1xuICBpZiAoIWVsKSByZXR1cm47XG4gIGlmICghQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCB8fCAhQXBwU3RhdGUuY2xpcHMubGVuZ3RoKSB7XG4gICAgZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgY291bnRzID0ge3BlbmRpbmc6IDAsIGFwcHJvdmVkOiAwLCByZWplY3RlZDogMH07XG4gIGZvciAoY29uc3QgYyBvZiBBcHBTdGF0ZS5jbGlwcykgY291bnRzW2Muc3RhdHVzXSA9IChjb3VudHNbYy5zdGF0dXNdIHx8IDApICsgMTtcbiAgY29uc3QgdG90YWxTZWNvbmRzID0gc2hvd24ucmVkdWNlKChzdW0sIGMpID0+IHtcbiAgICBjb25zdCBsZW4gPSAoYy5lbmRfbXMgLSBjLnN0YXJ0X21zKSAvIDEwMDA7XG4gICAgcmV0dXJuIHN1bSArIChOdW1iZXIuaXNGaW5pdGUobGVuKSA/IGxlbiA6IDApO1xuICB9LCAwKTtcbiAgZWwudGV4dENvbnRlbnQgPSBgJHtzaG93bi5sZW5ndGh9IHNob3duIMK3ICR7Y291bnRzLnBlbmRpbmd9IHVucmV2aWV3ZWQgwrcgYCArXG4gICAgYCR7Y291bnRzLmFwcHJvdmVkfSBhcHByb3ZlZCDCtyAke2NvdW50cy5yZWplY3RlZH0gcmVqZWN0ZWQgwrcgJHtmbXREdXJhdGlvbih0b3RhbFNlY29uZHMpfSB0b3RhbGA7XG4gIGVsLnN0eWxlLmRpc3BsYXkgPSAnJztcbn1cblxuZnVuY3Rpb24gX2NsZWFyQ2xpcEZpbHRlcnMoKSB7XG4gIEFwcFN0YXRlLmNsaXBGaWx0ZXJzLmNsZWFyKCk7XG4gIEFwcFN0YXRlLmNsaXBTZWFyY2ggPSAnJztcbiAgQXBwU3RhdGUuY2xpcFNjb3JlTWluID0gMDtcbiAgX3N5bmNGaWx0ZXJDaGlwcygpO1xuICBjb25zdCBzZWFyY2hFbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwLXNlYXJjaC1pbnB1dCcpO1xuICBpZiAoc2VhcmNoRWwpIHNlYXJjaEVsLnZhbHVlID0gJyc7XG4gIGNvbnN0IHNjb3JlRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1zY29yZS1taW4nKTtcbiAgaWYgKHNjb3JlRWwpIHNjb3JlRWwudmFsdWUgPSAnMCc7XG4gIF9yZW5kZXJDbGlwcygpO1xufVxuXG4vLyBSZWZsZWN0IEFwcFN0YXRlLmNsaXBGaWx0ZXJzIG9udG8gdGhlIGNoaXAgcm93LiBUaGUgXCJBbGxcIiBjaGlwIGlzIGFjdGl2ZSBvbmx5XG4vLyB3aGVuIG5vIG90aGVyIGZpbHRlciBpcyBzZWxlY3RlZC5cbmZ1bmN0aW9uIF9zeW5jRmlsdGVyQ2hpcHMoKSB7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS5jbGlwRmlsdGVycztcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEtZmlsdGVyXScpLmZvckVhY2goY2hpcCA9PiB7XG4gICAgY29uc3QgdG9rZW4gPSBjaGlwLmRhdGFzZXQuZmlsdGVyO1xuICAgIGNvbnN0IGFjdGl2ZSA9IHRva2VuID09PSAnYWxsJyA/IGYuc2l6ZSA9PT0gMCA6IGYuaGFzKHRva2VuKTtcbiAgICBjaGlwLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIGFjdGl2ZSk7XG4gICAgY2hpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFjdGl2ZSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuICB9KTtcbiAgX3N5bmNNb3JlRmlsdGVycygpO1xufVxuXG4vLyBGaWx0ZXJzIChhbmQgdGhlIG1pbi1zY29yZSkgdGhhdCBsaXZlIGluc2lkZSB0aGUgXCJNb3JlIGZpbHRlcnNcIiBleHBhbmRlci5cbmNvbnN0IF9ISURERU5fRklMVEVSX1RPS0VOUyA9IFsnZXhwb3J0ZWQnLCAnbm90LWV4cG9ydGVkJywgJ2Vycm9yJywgJ2ZsYWdnZWQnLCAnZHVwbGljYXRlJywgJ25vX3NwZWVjaCddO1xuXG4vLyBGb3JjZSB0aGUgZXhwYW5kZXIgb3BlbiB3aGVuZXZlciBvbmUgb2YgdGhlIGZpbHRlcnMgaXQgaGlkZXMgaXMgYWN0aXZlIChvciBhXG4vLyBub24tZGVmYXVsdCBtaW4tc2NvcmUgaXMgc2V0KSwgc28gdGhlIHVzZXIgaXMgbmV2ZXIgbGVmdCB3b25kZXJpbmcgd2h5IHRoZVxuLy8gbGlzdCBpcyBmaWx0ZXJlZC4gV2Ugb25seSBldmVyIGZvcmNlIGl0IE9QRU4gLSBvbiByZXR1cm4gdG8gZGVmYXVsdHMgd2Ugc3RvcFxuLy8gZm9yY2luZyBpdCBhbmQgbGV0IHRoZSB1c2VyIGNvbGxhcHNlIGl0IHRoZW1zZWx2ZXMuXG5mdW5jdGlvbiBfc3luY01vcmVGaWx0ZXJzKCkge1xuICBjb25zdCBkZXRhaWxzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtbW9yZS1maWx0ZXJzJyk7XG4gIGlmICghZGV0YWlscykgcmV0dXJuO1xuICBjb25zdCBhY3RpdmUgPSBfSElEREVOX0ZJTFRFUl9UT0tFTlMuc29tZSh0ID0+IEFwcFN0YXRlLmNsaXBGaWx0ZXJzLmhhcyh0KSkgfHxcbiAgICBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4gPiAwO1xuICBpZiAoYWN0aXZlKSBkZXRhaWxzLm9wZW4gPSB0cnVlO1xuICBjb25zdCBmbGFnID0gZGV0YWlscy5xdWVyeVNlbGVjdG9yKCdbZGF0YS1tb3JlLWZsYWddJyk7XG4gIGlmIChmbGFnKSBmbGFnLmhpZGRlbiA9ICFhY3RpdmU7XG59XG5cbi8vIEV4cG9ydCAoaGFzLWZpbGUpIGNoaXBzIGFyZSBtdXR1YWxseSBleGNsdXNpdmUgLSBcIkV4cG9ydGVkXCIgYW5kIFwiTm90IGV4cG9ydGVkXCJcbi8vIGNhbid0IGJvdGggaG9sZC4gRXZlcnl0aGluZyBlbHNlIHRvZ2dsZXMgaW5kZXBlbmRlbnRseTsgXCJBbGxcIiBjbGVhcnMgdGhlIHNldC5cbmNvbnN0IF9FWFBPUlRfRklMVEVSX1RPS0VOUyA9IFsnZXhwb3J0ZWQnLCAnbm90LWV4cG9ydGVkJ107XG5mdW5jdGlvbiB0b2dnbGVDbGlwRmlsdGVyKHRva2VuKSB7XG4gIGNvbnN0IGYgPSBBcHBTdGF0ZS5jbGlwRmlsdGVycztcbiAgaWYgKHRva2VuID09PSAnYWxsJykge1xuICAgIGYuY2xlYXIoKTtcbiAgfSBlbHNlIGlmIChmLmhhcyh0b2tlbikpIHtcbiAgICBmLmRlbGV0ZSh0b2tlbik7XG4gIH0gZWxzZSB7XG4gICAgaWYgKF9FWFBPUlRfRklMVEVSX1RPS0VOUy5pbmNsdWRlcyh0b2tlbikpIF9FWFBPUlRfRklMVEVSX1RPS0VOUy5mb3JFYWNoKHQgPT4gZi5kZWxldGUodCkpO1xuICAgIGYuYWRkKHRva2VuKTtcbiAgfVxuICBfc3luY0ZpbHRlckNoaXBzKCk7XG4gIF9yZW5kZXJDbGlwcygpO1xufVxuXG4vLyBDYW5kaWRhdGUtdHlwZSB0b2dnbGUgKENsaXBzIHZzIFNjZW5lcykuIFVubGlrZSB0aGUgc3RhdHVzIGZpbHRlciBjaGlwcywgdGhpc1xuLy8gaXMgYSBzZXJ2ZXItc2lkZSBzd2l0Y2g6IGl0IHJlbG9hZHMgQXBwU3RhdGUuY2xpcHMgZm9yIHRoZSBzZWxlY3RlZCBraW5kLCBzb1xuLy8gdGhlIHN0YXR1cyBjb3VudHMgYW5kIHN0YXRzIGxpbmUgcmVmbGVjdCBqdXN0IHRoYXQga2luZC4gRGVmYXVsdHMgdG8gQ2xpcHMuXG5mdW5jdGlvbiBzZXRDbGlwS2luZChraW5kKSB7XG4gIGlmIChraW5kICE9PSAnY2xpcCcgJiYga2luZCAhPT0gJ3NjZW5lJykgcmV0dXJuO1xuICBpZiAoQXBwU3RhdGUuY2xpcEtpbmQgPT09IGtpbmQpIHJldHVybjtcbiAgQXBwU3RhdGUuY2xpcEtpbmQgPSBraW5kO1xuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBudWxsO1xuICBfc3luY0tpbmRDaGlwcygpO1xuICBpZiAoQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCkgX3JlbG9hZENsaXBMaXN0KEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQpO1xufVxuXG5mdW5jdGlvbiBfc3luY0tpbmRDaGlwcygpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2RhdGEta2luZF0nKS5mb3JFYWNoKGNoaXAgPT4ge1xuICAgIGNvbnN0IGFjdGl2ZSA9IGNoaXAuZGF0YXNldC5raW5kID09PSBBcHBTdGF0ZS5jbGlwS2luZDtcbiAgICBjaGlwLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIGFjdGl2ZSk7XG4gICAgY2hpcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcsIGFjdGl2ZSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gc2V0Q2xpcFNlYXJjaChxKSB7XG4gIEFwcFN0YXRlLmNsaXBTZWFyY2ggPSBxLnRyaW0oKTtcbiAgX3JlbmRlckNsaXBzKCk7XG59XG5cbmZ1bmN0aW9uIHNldENsaXBTY29yZU1pbih2YWwpIHtcbiAgQXBwU3RhdGUuY2xpcFNjb3JlTWluID0gcGFyc2VGbG9hdCh2YWwpIHx8IDA7XG4gIF9zeW5jTW9yZUZpbHRlcnMoKTtcbiAgX3JlbmRlckNsaXBzKCk7XG59XG5cbi8vIOKJpDMgZGlzdGluY3QgcGhyYXNlcyBzaG93IGluZGl2aWR1YWxseTsgbW9yZSBjb2xsYXBzZSB0byBhIHNpbmdsZSBjb3VudCBwaWxsIHNvXG4vLyBhIGhlYXZpbHktbWF0Y2hlZCBjbGlwIGRvZXNuJ3QgY3Jvd2Qgb3V0IHRoZSByZXN0IG9mIHRoZSBzaWRlYmFyIHJvdy5cbmZ1bmN0aW9uIF9ob3R3b3JkUGlsbHNIVE1MKG1hdGNoZXMpIHtcbiAgaWYgKCFtYXRjaGVzIHx8ICFtYXRjaGVzLmxlbmd0aCkgcmV0dXJuICcnO1xuICBpZiAobWF0Y2hlcy5sZW5ndGggPD0gMykge1xuICAgIHJldHVybiBgPGRpdiBjbGFzcz1cInRhZ3NcIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+JHttYXRjaGVzLm1hcChtID0+XG4gICAgICBgPHNwYW4gY2xhc3M9XCJ0YWdcIiB0aXRsZT1cIiR7ZXNjSHRtbChtLnBocmFzZSl9JHttLmNvdW50ID4gMSA/IGAgKCR7bS5jb3VudH3DlylgIDogJyd9XCI+XFx1ezFGNTI1fSAke2VzY0h0bWwobS5waHJhc2UpfTwvc3Bhbj5gXG4gICAgKS5qb2luKCcnKX08L2Rpdj5gO1xuICB9XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cInRhZ3NcIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+PHNwYW4gY2xhc3M9XCJ0YWdcIiB0aXRsZT1cIiR7bWF0Y2hlcy5sZW5ndGh9IGhvdC13b3JkcyBtYXRjaGVkXCI+XFx1ezFGNTI1fSAke21hdGNoZXMubGVuZ3RofTwvc3Bhbj48L2Rpdj5gO1xufVxuXG4vLyBEZWxlZ2F0ZWQgb24gdGhlIHBlcnNpc3RlbnQgI2NsaXAtbGlzdCBlbGVtZW50IChpdHMgaW5uZXJIVE1MIGlzIHJlcGxhY2VkIGVhY2hcbi8vIHJlbmRlciwgc28gcGVyLXJvdyBoYW5kbGVycyB3b3VsZCBiZSBsb3N0IC0gdGhlIGNvbnRhaW5lciBsaXN0ZW5lciBpc24ndCkuIFdpcmVkXG4vLyB1bmNvbmRpdGlvbmFsbHkgb24gZXZlcnkgcmVuZGVyIHNvIGl0IGFsc28gY292ZXJzIHRoZSBlbXB0eS1maWx0ZXItbWVzc2FnZSBsaW5rcy5cbmZ1bmN0aW9uIF9oYW5kbGVDbGlwTGlzdENsaWNrKGUpIHtcbiAgY29uc3QgYWN0ID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0XScpO1xuICBpZiAoYWN0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGlmIChhY3QuZGF0YXNldC5hY3QgPT09ICdvcGVuLXNldHRpbmdzJykgd2luZG93Lm9wZW5TZXR0aW5ncygpO1xuICAgIGVsc2UgaWYgKGFjdC5kYXRhc2V0LmFjdCA9PT0gJ2NsZWFyLWNsaXAtZmlsdGVycycpIF9jbGVhckNsaXBGaWx0ZXJzKCk7XG4gICAgZWxzZSBpZiAoYWN0LmRhdGFzZXQuYWN0ID09PSAnb3Blbi1uZXctcmVjb3JkaW5nLXBhbmVsJykgd2luZG93Lm9wZW5OZXdSZWNvcmRpbmdQYW5lbCgpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBsaSA9IGUudGFyZ2V0LmNsb3Nlc3QoJ2xpW2RhdGEtY2xpcC1pZF0nKTtcbiAgaWYgKGxpKSBzZWxlY3RDbGlwKE51bWJlcihsaS5kYXRhc2V0LmNsaXBJZCkpO1xufVxuXG5mdW5jdGlvbiBfaGFuZGxlQ2xpcExpc3RLZXlkb3duKGUpIHtcbiAgaWYgKGUua2V5ICE9PSAnRW50ZXInICYmIGUua2V5ICE9PSAnICcpIHJldHVybjtcbiAgY29uc3QgbGkgPSBlLnRhcmdldC5jbG9zZXN0KCdsaVtkYXRhLWNsaXAtaWRdJyk7XG4gIGlmICghbGkgfHwgZS50YXJnZXQgIT09IGxpKSByZXR1cm47ICAvLyBkb24ndCBoaWphY2sgU3BhY2Ugb24gdGhlIGNoZWNrYm94XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgc2VsZWN0Q2xpcChOdW1iZXIobGkuZGF0YXNldC5jbGlwSWQpKTtcbn1cblxuZnVuY3Rpb24gX3JlbmRlckNsaXBJdGVtcyhjbGlwcykge1xuICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtbGlzdCcpO1xuICBsaXN0LmlubmVySFRNTCA9ICcnO1xuICBsaXN0Lm9uY2xpY2sgPSBfaGFuZGxlQ2xpcExpc3RDbGljaztcbiAgbGlzdC5vbmtleWRvd24gPSBfaGFuZGxlQ2xpcExpc3RLZXlkb3duO1xuICBpZiAoIWNsaXBzLmxlbmd0aCkge1xuICAgIGNvbnN0IF9zdGF0dXNMYWJlbCA9IHtwZW5kaW5nOiAnVW5yZXZpZXdlZCcsIGFwcHJvdmVkOiAnQXBwcm92ZWQnLCByZWplY3RlZDogJ1JlamVjdGVkJ307XG4gICAgY29uc3QgaGFzQWN0aXZlRmlsdGVyID0gQXBwU3RhdGUuY2xpcEZpbHRlcnMuc2l6ZSA+IDAgfHwgQXBwU3RhdGUuY2xpcFNlYXJjaCB8fCBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4gPiAwO1xuICAgIGNvbnN0IGlzRmxhZ2dlZE9ubHkgPSBBcHBTdGF0ZS5jbGlwRmlsdGVycy5zaXplID09PSAxICYmIEFwcFN0YXRlLmNsaXBGaWx0ZXJzLmhhcygnZmxhZ2dlZCcpICYmXG4gICAgICAhQXBwU3RhdGUuY2xpcFNlYXJjaCAmJiBBcHBTdGF0ZS5jbGlwU2NvcmVNaW4gPT09IDA7XG4gICAgY29uc3QgZmlsdGVyTXNnID0gaXNGbGFnZ2VkT25seVxuICAgICAgPyBgTm8gZmxhZ2dlZCBjbGlwcyAtIGFkZCBTZW5zaXRpdmUgVGVybXMgaW4gPGEgaHJlZj1cIiNcIiBzdHlsZT1cImNvbG9yOnZhcigtLWFjY2VudCk7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZVwiIGRhdGEtYWN0PVwib3Blbi1zZXR0aW5nc1wiPlNldHRpbmdzPC9hPmBcbiAgICAgIDogaGFzQWN0aXZlRmlsdGVyXG4gICAgICA/IGBObyBjbGlwcyBtYXRjaCB0aGUgY3VycmVudCBmaWx0ZXJzIC0gPGEgaHJlZj1cIiNcIiBzdHlsZT1cImNvbG9yOnZhcigtLWFjY2VudCk7dGV4dC1kZWNvcmF0aW9uOnVuZGVybGluZVwiIGRhdGEtYWN0PVwiY2xlYXItY2xpcC1maWx0ZXJzXCI+Q2xlYXIgZmlsdGVyczwvYT5gXG4gICAgICA6IGBObyBjbGlwcyBmb3VuZCAtIDxhIGhyZWY9XCIjXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS1hY2NlbnQpO3RleHQtZGVjb3JhdGlvbjp1bmRlcmxpbmVcIiBkYXRhLWFjdD1cIm9wZW4tbmV3LXJlY29yZGluZy1wYW5lbFwiPkFuYWx5emUgYW5vdGhlciByZWNvcmRpbmc8L2E+YDtcbiAgICBsaXN0LmlubmVySFRNTCA9IGA8bGkgc3R5bGU9XCJwYWRkaW5nOjEwcHggMTRweDtjb2xvcjp2YXIoLS1tdXRlZClcIj4ke2ZpbHRlck1zZ308L2xpPmA7XG4gICAgd2luZG93Ll91cGRhdGVCdWxrVG9vbGJhcigpO1xuICAgIHJldHVybjtcbiAgfVxuICBmb3IgKGNvbnN0IGMgb2YgY2xpcHMpIHtcbiAgICBjb25zdCBsaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpJyk7XG4gICAgbGkuY2xhc3NOYW1lID0gYy5pZCA9PT0gQXBwU3RhdGUuYWN0aXZlQ2xpcElkID8gJ2FjdGl2ZScgOiAnJztcbiAgICBsaS5zdHlsZS5ib3JkZXJMZWZ0Q29sb3IgPSBfc2NvcmVCb3JkZXJDb2xvcihfc29ydFNjb3JlKGMpLCBjLnN0YXR1cyA9PT0gJ3JlamVjdGVkJyB8fCAhYy5zY29yZWRfYXQpO1xuICAgIGxpLnRhYkluZGV4ID0gMDtcbiAgICBsaS5kYXRhc2V0LmNsaXBJZCA9IGMuaWQ7XG4gICAgbGkuaW5uZXJIVE1MID0gYFxuICAgICAgPGRpdiBjbGFzcz1cImNsaXAtaXRlbS1yb3cxXCI+XG4gICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cImNsaXAtc2VsZWN0LWNoZWNrYm94XCIgYXJpYS1sYWJlbD1cIlNlbGVjdCBjbGlwICMke2MuaWR9XCI+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwiY2xpcC1udW1cIiB0aXRsZT1cIkNsaXAgIyR7Yy5pZH1cIj4jJHtjLmlkfTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJjbGlwLXRpbWVcIj4ke2Muc3RhcnRfaG1zfSAmbWlkZG90OyAke2MuZHVyYXRpb25faG1zfTwvc3Bhbj5cbiAgICAgICAgJHtjLmhhc19leHBvcnRcbiAgICAgICAgICA/IChjLmV4cG9ydF9zdGFsZVxuICAgICAgICAgICAgICA/IGA8c3BhbiBjbGFzcz1cImV4cG9ydC1waWxsIGlzLXN0YWxlXCIgdGl0bGU9XCJTdGFsZSAtIHJlLWV4cG9ydCB0byB1cGRhdGUgKCR7ZXNjSHRtbCgoYy5leHBvcnRfc3RhbGVfcmVhc29ucyB8fCBbXSkuam9pbignLCAnKSl9KVwiPlN0YWxlPC9zcGFuPmBcbiAgICAgICAgICAgICAgOiBgPHNwYW4gY2xhc3M9XCJleHBvcnQtcGlsbCBpcy1leHBvcnRlZFwiIHRpdGxlPVwiQ2xpcCBoYXMgYmVlbiBleHBvcnRlZFwiPiR7KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG4gPSAoYy5leHBvcnRzIHx8IFtdKS5maWx0ZXIoZSA9PiBlLmV4aXN0cykubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIG4gPiAxID8gYEV4cG9ydGVkICZ0aW1lczske259YCA6ICdFeHBvcnRlZCc7XG4gICAgICAgICAgICAgICAgfSkoKX08L3NwYW4+YClcbiAgICAgICAgICA6ICc8c3BhbiBjbGFzcz1cImV4cG9ydC1waWxsIG5vdC1leHBvcnRlZFwiIHRpdGxlPVwiTm90IHlldCBleHBvcnRlZFwiPk5vdCBleHBvcnRlZDwvc3Bhbj4nfVxuICAgICAgICA8c3BhbiBjbGFzcz1cInN0YXR1cy1kb3QgZG90LSR7Yy5zdGF0dXN9XCIgdGl0bGU9XCIke2Muc3RhdHVzID09PSAnYXBwcm92ZWQnID8gJ0FwcHJvdmVkJyA6IGMuc3RhdHVzID09PSAncmVqZWN0ZWQnID8gJ1JlamVjdGVkJyA6ICdVbnJldmlld2VkJ31cIj4ke2Muc3RhdHVzID09PSAnYXBwcm92ZWQnID8gJ+KckycgOiBjLnN0YXR1cyA9PT0gJ3JlamVjdGVkJyA/ICfinJUnIDogJyd9PC9zcGFuPlxuICAgICAgICAkeyhjLnRhZ3MgfHwgW10pLmluY2x1ZGVzKCdsbG1fZXJyb3InKSAmJiAhISh3aW5kb3cuX3ByZXJlcXMgfHwge30pLmxsbV9vayA/ICc8c3BhbiBjbGFzcz1cImNsaXAtZXJyb3ItYmFkZ2VcIiB0aXRsZT1cIkxMTSBzY29yaW5nIGZhaWxlZCAtIFJlLXNjb3JlIHRvIHJldHJ5XCI+JiM5ODg4Ozwvc3Bhbj4nIDogJyd9XG4gICAgICAgICR7KGMuc2Vuc2l0aXZlX21hdGNoZXMgfHwgW10pLmxlbmd0aCA/ICc8c3BhbiBjbGFzcz1cImNsaXAtZmxhZy1iYWRnZVwiIHRpdGxlPVwiQ29udGFpbnMgZmxhZ2dlZCB0ZXJtc1wiPiYjOTg4ODs8L3NwYW4+JyA6ICcnfVxuICAgICAgICAkeyhjLnRhZ3MgfHwgW10pLmluY2x1ZGVzKCdwb3NzaWJsZV9kdXBsaWNhdGUnKSA/ICc8c3BhbiBjbGFzcz1cImNsaXAtZHVwLWJhZGdlXCIgdGl0bGU9XCJPdmVybGFwcyBhbm90aGVyIGNsaXAgLSBwb3NzaWJsZSBkdXBsaWNhdGVcIj4mIzg2NDY7PC9zcGFuPicgOiAnJ31cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImNsaXAtc2NvcmVzXCIgYXJpYS1sYWJlbD1cIiR7Yy5zY29yZWRfYXQgPyBgU2NvcmVzOiBvdmVyYWxsICR7TWF0aC5yb3VuZChjLnNjb3JlX292ZXJhbGwqMTAwKX0lLCBmdW5ueSAke01hdGgucm91bmQoYy5zY29yZV9mdW5ueSoxMDApfSUsIGRyYW1hdGljICR7TWF0aC5yb3VuZChjLnNjb3JlX2RyYW1hdGljKjEwMCl9JSwgYWN0aW9uICR7TWF0aC5yb3VuZChjLnNjb3JlX2FjdGlvbioxMDApfSUsIHZpc3VhbCAke01hdGgucm91bmQoKGMuc2NvcmVfdmlzdWFsfHwwKSoxMDApfSUke2Muc2NvcmVfbGF1Z2ggIT0gbnVsbCA/IGAsIGxhdWdocyAke01hdGgucm91bmQoYy5zY29yZV9sYXVnaCoxMDApfSVgIDogJyd9YCA6ICdOb3QgeWV0IHNjb3JlZCd9XCI+XG4gICAgICAgICR7Yy5zY29yZWRfYXQgPyBgXG4gICAgICAgIDxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHRpdGxlPVwiT3ZlcmFsbFwiPiR7X3Njb3JlSWNvbihjLnNjb3JlX292ZXJhbGwpfSAke01hdGgucm91bmQoYy5zY29yZV9vdmVyYWxsKjEwMCl9JTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCIgdGl0bGU9XCJGdW5ueVwiPjxzcGFuPvCfmII8L3NwYW4+ICR7TWF0aC5yb3VuZChjLnNjb3JlX2Z1bm55KjEwMCl9JTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCIgdGl0bGU9XCJEcmFtYXRpY1wiPjxzcGFuPvCfjq08L3NwYW4+ICR7TWF0aC5yb3VuZChjLnNjb3JlX2RyYW1hdGljKjEwMCl9JTwvc3Bhbj5cbiAgICAgICAgPHNwYW4gYXJpYS1oaWRkZW49XCJ0cnVlXCIgdGl0bGU9XCJBY3Rpb25cIj48c3Bhbj7impTvuI88L3NwYW4+ICR7TWF0aC5yb3VuZChjLnNjb3JlX2FjdGlvbioxMDApfSU8L3NwYW4+XG4gICAgICAgIDxzcGFuIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHRpdGxlPVwiVmlzdWFsXCI+PHNwYW4+8J+OrDwvc3Bhbj4gJHtNYXRoLnJvdW5kKChjLnNjb3JlX3Zpc3VhbHx8MCkqMTAwKX0lPC9zcGFuPlxuICAgICAgICAke2Muc2NvcmVfbGF1Z2ggIT0gbnVsbCA/IGA8c3BhbiBhcmlhLWhpZGRlbj1cInRydWVcIiB0aXRsZT1cIkxhdWdoc1wiPjxzcGFuPvCfpKM8L3NwYW4+ICR7TWF0aC5yb3VuZChjLnNjb3JlX2xhdWdoKjEwMCl9JTwvc3Bhbj5gIDogJyd9XG4gICAgICAgIGAgOiBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHhcIiB0aXRsZT1cIlRoaXMgY2xpcCBoYXMgbm90IGJlZW4gc2NvcmVkIHlldFwiPk5vdCB5ZXQgc2NvcmVkPC9zcGFuPmB9XG4gICAgICA8L2Rpdj5cbiAgICAgICR7Yy5kZXNjcmlwdGlvbiA/IGA8ZGl2IGNsYXNzPVwiY2xpcC1kZXNjLXByZXZpZXdcIiB0aXRsZT1cIiR7ZXNjSHRtbChjLmRlc2NyaXB0aW9uKX1cIj4ke2VzY0h0bWwoYy5kZXNjcmlwdGlvbil9PC9kaXY+YCA6ICcnfVxuICAgICAgJHtfaG90d29yZFBpbGxzSFRNTChjLmhvdHdvcmRfbWF0Y2hlcyl9YDtcbiAgICBjb25zdCBjaGVja2JveCA9IGxpLnF1ZXJ5U2VsZWN0b3IoJy5jbGlwLXNlbGVjdC1jaGVja2JveCcpO1xuICAgIGNoZWNrYm94LmNoZWNrZWQgPSBBcHBTdGF0ZS5zZWxlY3RlZENsaXBJZHMuaGFzKGMuaWQpO1xuICAgIGNoZWNrYm94Lm9uY2xpY2sgPSBlID0+IGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgY2hlY2tib3gub25jaGFuZ2UgPSAoKSA9PiB3aW5kb3cuX3RvZ2dsZUNsaXBTZWxlY3Rpb24oYy5pZCwgY2hlY2tib3guY2hlY2tlZCk7XG4gICAgbGlzdC5hcHBlbmRDaGlsZChsaSk7XG4gIH1cbiAgd2luZG93Ll91cGRhdGVCdWxrVG9vbGJhcigpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzZWxlY3RDbGlwKGlkKSB7XG4gIEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCA9IGlkO1xuICAvLyBTeW5jIHRoZSBzaWRlYmFyIGhpZ2hsaWdodCBoZXJlIHNvIGV2ZXJ5IGNhbGxlciAtIHJvdyBjbGljaywgYXJyb3cta2V5XG4gIC8vIG5hdmlnYXRpb24sIHJlbGF0ZWQtY2xpcCBsaW5rcywgcG9zdC1yZXRyYW5zY3JpYmUgcmVzdG9yZSAtIG1vdmVzIGl0LlxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjY2xpcC1saXN0IGxpW2RhdGEtY2xpcC1pZF0nKS5mb3JFYWNoKGwgPT5cbiAgICBsLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScsIE51bWJlcihsLmRhdGFzZXQuY2xpcElkKSA9PT0gaWQpKTtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NsaXAtbGlzdCBsaS5hY3RpdmUnKT8uc2Nyb2xsSW50b1ZpZXcoe2Jsb2NrOiAnbmVhcmVzdCd9KTtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ3l1dWNsaXAtdmlldycsIEpTT04uc3RyaW5naWZ5KHt2aWRlb0lkOiBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkLCBjbGlwSWQ6IGlkfSkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJkZXRhaWwtZW1wdHlcIiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKVwiPkxvYWRpbmfigKY8L2Rpdj4nO1xuICB0cnkge1xuICAgIGNvbnN0IFtjbGlwUmVzLCBtZWRpYVJlc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBmZXRjaChgL2FwaS9jbGlwcy8ke2lkfWApLFxuICAgICAgZmV0Y2goYC9hcGkvY2xpcHMvJHtpZH0vbWVkaWFfdXJsYCksXG4gICAgXSk7XG4gICAgaWYgKCFjbGlwUmVzLm9rIHx8ICFtZWRpYVJlcy5vaykgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gbG9hZCBjbGlwJyk7XG4gICAgY29uc3QgY2xpcCAgPSBhd2FpdCBjbGlwUmVzLmpzb24oKTtcbiAgICBjb25zdCBtZWRpYSA9IGF3YWl0IG1lZGlhUmVzLmpzb24oKTtcbiAgICBjb25zdCBjYXB0aW9uc1VybCA9IG1lZGlhLmhhc19jYXB0aW9ucyA/IGAvYXBpL2NsaXBzLyR7aWR9L2NhcHRpb25zLnZ0dGAgOiBudWxsO1xuICAgIEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhID0gY2xpcDtcbiAgICBBcHBTdGF0ZS5hY3RpdmVNZWRpYUZpbGVuYW1lID0gbWVkaWEuZmlsZW5hbWU7XG4gICAgcmVuZGVyUGxheWVyKG1lZGlhLnVybCwgY2FwdGlvbnNVcmwsIGlkKTtcbiAgICByZW5kZXJEZXRhaWwoY2xpcCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHNob3dUb2FzdChgQ291bGQgbm90IGxvYWQgY2xpcDogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcbiAgfVxufVxuXG4vLyBSZS1yZW5kZXIgdGhlIG9wZW4gY2xpcCdzIGRldGFpbCBwYW5lIChleGNlcnB0LCBzdGFsZSBub3RpY2UpIHdpdGhvdXQgdG91Y2hpbmdcbi8vIHRoZSBwbGF5ZXIuIFVzZWQgYWZ0ZXIgYW4gaW5saW5lIGNhcHRpb24gZWRpdCBjaGFuZ2VzIHRoZSBjbGlwJ3MgdHJhbnNjcmlwdC5cbmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2hDbGlwRGV0YWlsKGlkKSB7XG4gIGlmIChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgIT09IGlkKSByZXR1cm47XG4gIHRyeSB7XG4gICAgY29uc3QgY2xpcCA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7aWR9YCkudGhlbihyID0+IHIuanNvbigpKTtcbiAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YSA9IGNsaXA7XG4gICAgcmVuZGVyRGV0YWlsKGNsaXApO1xuICB9IGNhdGNoIChfKSB7IC8qIGxlYXZlIHRoZSBzdGFsZSBkZXRhaWwgaW4gcGxhY2Ugb24gZXJyb3IgKi8gfVxufVxuXG4vLyDilIDilIAgcGxheWVyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gcmVuZGVyUGxheWVyKHVybCwgY2FwdGlvbnNVcmwsIGNsaXBJZCkge1xuICBjb25zdCBhcmVhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJyk7XG4gIGNvbnN0IGF1dG9wbGF5ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3l1dWNsaXAtYXV0b3BsYXknKSA9PT0gJ3RydWUnO1xuICBjb25zdCBsb29wQ2xpcCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd5dXVjbGlwLWxvb3AtY2xpcCcpID09PSAndHJ1ZSc7XG4gIGNvbnN0IHBsYXlOZXh0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3l1dWNsaXAtcGxheS1uZXh0JykgPT09ICd0cnVlJztcbiAgaWYgKHVybCkge1xuICAgIGNvbnN0IHRyYWNrID0gY2FwdGlvbnNVcmxcbiAgICAgID8gYDx0cmFjayBraW5kPVwiY2FwdGlvbnNcIiBzcmM9XCIke2VzY0h0bWwoY2FwdGlvbnNVcmwpfVwiIGxhYmVsPVwiQ2FwdGlvbnNcIiBkZWZhdWx0PmBcbiAgICAgIDogJyc7XG4gICAgYXJlYS5pbm5lckhUTUwgPSBgPHZpZGVvIGNvbnRyb2xzICR7YXV0b3BsYXkgPyAnYXV0b3BsYXknIDogJyd9ICR7bG9vcENsaXAgPyAnbG9vcCcgOiAnJ30gc3JjPVwiJHtlc2NIdG1sKHVybCl9XCIgYXJpYS1sYWJlbD1cIkNsaXAgcHJldmlld1wiPiR7dHJhY2t9PC92aWRlbz5gO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHdyYXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB3cmFwLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICBjb25zdCB2aWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2aWRlbycpO1xuICAgIHZpZC5jb250cm9scyA9IHRydWU7XG4gICAgdmlkLmF1dG9wbGF5ID0gYXV0b3BsYXk7XG4gICAgdmlkLmxvb3AgPSBsb29wQ2xpcDtcbiAgICB2aWQuc3JjID0gYC9hcGkvY2xpcHMvJHtjbGlwSWR9L3ByZXZpZXdgO1xuICAgIHZpZC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2xpcCBzb3VyY2UgcHJldmlldycpO1xuICAgIHZpZC5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6YmxvY2s7d2lkdGg6MTAwJTttYXgtaGVpZ2h0OnZhcigtLXBsYXllci1tYXgtaGVpZ2h0LCA0MnZoKTtvYmplY3QtZml0OmNvbnRhaW47YmFja2dyb3VuZDojMDAwJztcbiAgICB2aWQub25lcnJvciA9IGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGRldGFpbCA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcElkfS9wcmV2aWV3YClcbiAgICAgICAgLnRoZW4ociA9PiByLmpzb24oKSkudGhlbihqID0+IGouZGV0YWlsIHx8ICd1bmF2YWlsYWJsZScpLmNhdGNoKCgpID0+ICd1bmF2YWlsYWJsZScpO1xuICAgICAgd3JhcC5pbm5lckhUTUwgPSBgPGRpdiBzdHlsZT1cInBhZGRpbmc6MjRweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHhcIj5Tb3VyY2UgdmlkZW8gdW5hdmFpbGFibGU6ICR7ZXNjSHRtbChkZXRhaWwpfTwvZGl2PmA7XG4gICAgfTtcbiAgICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICBiYWRnZS5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOmFic29sdXRlO3RvcDo4cHg7bGVmdDo4cHg7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC42NSk7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDhweDtib3JkZXItcmFkaXVzOjRweDtwb2ludGVyLWV2ZW50czpub25lJztcbiAgICBiYWRnZS50ZXh0Q29udGVudCA9ICdTb3VyY2UgcHJldmlldyDCtyBub3QgZXhwb3J0ZWQnO1xuICAgIF9tYXJrUHJldmlld1F1YWxpdHkoYmFkZ2UsIGNsaXBJZCk7XG4gICAgd3JhcC5hcHBlbmRDaGlsZCh2aWQpO1xuICAgIHdyYXAuYXBwZW5kQ2hpbGQoYmFkZ2UpO1xuICAgIGFyZWEuaW5uZXJIVE1MID0gJyc7XG4gICAgYXJlYS5hcHBlbmRDaGlsZCh3cmFwKTtcbiAgfVxuICBpZiAocGxheU5leHQpIGFyZWEucXVlcnlTZWxlY3RvcigndmlkZW8nKT8uYWRkRXZlbnRMaXN0ZW5lcignZW5kZWQnLCBfcGxheU5leHRDbGlwKTtcbn1cblxuLy8gQWR2YW5jZXMgdG8gdGhlIG5leHQgY2xpcCBpbiB0aGUgY3VycmVudCBmaWx0ZXJlZC9zb3J0ZWQgb3JkZXIgLSBzYW1lIHBhdGhcbi8vIGFycm93LWtleSBuYXZpZ2F0aW9uIHVzZXMgLSBhbmQgc3RvcHMgc2lsZW50bHkgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdC5cbmZ1bmN0aW9uIF9wbGF5TmV4dENsaXAoKSB7XG4gIGNvbnN0IGlkeCA9IEFwcFN0YXRlLmNsaXBzLmZpbmRJbmRleChjID0+IGMuaWQgPT09IEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCk7XG4gIGlmIChpZHggPT09IC0xIHx8IGlkeCA+PSBBcHBTdGF0ZS5jbGlwcy5sZW5ndGggLSAxKSByZXR1cm47XG4gIGNvbnN0IG5leHRJZCA9IEFwcFN0YXRlLmNsaXBzW2lkeCArIDFdLmlkO1xuICBzZWxlY3RDbGlwKG5leHRJZCk7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYCNjbGlwLWxpc3QgbGlbZGF0YS1jbGlwLWlkPVwiJHtuZXh0SWR9XCJdYCk/LmZvY3VzKCk7XG59XG5cbi8vIFRoZSBjbGlwIHByZXZpZXcgcm91dGUgcHJlZmVycyB0aGUgNzIwcCBwcm94eSB3aGVuIG9uZSBleGlzdHM7IHJlZmxlY3QgdGhhdCBvblxuLy8gdGhlIGJhZGdlIHNvIHRoZSBjcmVhdG9yIGtub3dzIHRoZSBwcmV2aWV3IGlzbid0IGZ1bGwgcXVhbGl0eS5cbmFzeW5jIGZ1bmN0aW9uIF9tYXJrUHJldmlld1F1YWxpdHkoYmFkZ2UsIGNsaXBJZCkge1xuICBjb25zdCB2aWRlb0lkID0gQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGE/LnZpZGVvX2lkO1xuICBpZiAoIXZpZGVvSWQpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9wcm94eS1zdGF0dXNgKS50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogbnVsbCk7XG4gICAgaWYgKHN0YXR1cz8uYXZhaWxhYmxlICYmIEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCA9PT0gY2xpcElkKSB7XG4gICAgICBiYWRnZS50ZXh0Q29udGVudCA9ICdTb3VyY2UgcHJldmlldyDCtyA3MjBwIMK3IG5vdCBleHBvcnRlZCc7XG4gICAgICBiYWRnZS50aXRsZSA9ICdQcmV2aWV3ZWQgZnJvbSBhIGRvd25zY2FsZWQgNzIwcCBwcm94eSBmb3IgZmFzdCwgcmVsaWFibGUgcGxheWJhY2suJztcbiAgICB9XG4gIH0gY2F0Y2ggKF8pIHsgLyogbGVhdmUgdGhlIGRlZmF1bHQgYmFkZ2UgKi8gfVxufVxuXG4vLyBGdWxseSB0ZWFyIGRvd24gYW55IDx2aWRlbz4gaW4gdGhlIHBsYXllciBzbyB0aGUgYnJvd3NlciBhYm9ydHMgaXRzIHN0cmVhbWluZ1xuLy8gY29ubmVjdGlvbiB0byAvbWVkaWEvZXhwb3J0cy8qLiBVbnRpbCB0aGF0IGNvbm5lY3Rpb24gY2xvc2VzLCB0aGUgc2VydmVyJ3Ncbi8vIFN0YXRpY0ZpbGVzIGhhbmRsZSBvbiB0aGUgZmlsZSBzdGF5cyBvcGVuIGFuZCBXaW5kb3dzIHJlZnVzZXMgdG8gZGVsZXRlIGl0LlxuLy8gUmVtb3ZpbmcgdGhlIGVsZW1lbnQgYWxvbmUgaXMgbm90IGVub3VnaCAtIHRoZSBtZWRpYSByZXNvdXJjZSBtdXN0IGJlIHJlbGVhc2VkXG4vLyB2aWEgcGF1c2UgKyBjbGVhciBzcmMgKyBsb2FkKCkgYmVmb3JlIHRoZSBjb25uZWN0aW9uIGFjdHVhbGx5IGNsb3Nlcy5cbmZ1bmN0aW9uIF9yZWxlYXNlUGxheWVyTWVkaWEoKSB7XG4gIGNvbnN0IGFyZWEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyLWFyZWEnKTtcbiAgYXJlYS5xdWVyeVNlbGVjdG9yQWxsKCd2aWRlbycpLmZvckVhY2godmlkID0+IHtcbiAgICB0cnkgeyB2aWQucGF1c2UoKTsgfSBjYXRjaCAoXykge31cbiAgICB2aWQucmVtb3ZlQXR0cmlidXRlKCdzcmMnKTtcbiAgICB2aWQubG9hZCgpO1xuICB9KTtcbiAgYXJlYS5pbm5lckhUTUwgPSAnJztcbn1cblxuLy8gQ2FsbCBiZWZvcmUgYW55IGRlbGV0ZSB0aGF0IHJlbW92ZXMgYSBmaWxlIHRoZSBwbGF5ZXIgbWF5IGJlIHN0cmVhbWluZy4gUmVsZWFzZXNcbi8vIHRoZSA8dmlkZW8+LCB0aGVuIHdhaXRzIHNvIHRoZSBicm93c2VyIGNhbiBmaW5pc2ggYWJvcnRpbmcgdGhlIHRyYW5zZmVyIGFuZCB0aGVcbi8vIHNlcnZlciBjYW4gY2xvc2UgaXRzIGZpbGUgaGFuZGxlIGJlZm9yZSB0aGUgZGVsZXRlIHJlcXVlc3QgYXJyaXZlcy5cbmFzeW5jIGZ1bmN0aW9uIF9yZWxlYXNlUGxheWVyQmVmb3JlRGVsZXRlKCkge1xuICBfcmVsZWFzZVBsYXllck1lZGlhKCk7XG4gIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA0MDApKTtcbn1cblxuLy8g4pSA4pSAIGRldGFpbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmZ1bmN0aW9uIF9mbXRTaXplTWIoYnl0ZXMpIHtcbiAgaWYgKGJ5dGVzID09IG51bGwpIHJldHVybiAnJztcbiAgcmV0dXJuIGAkeyhieXRlcyAvICgxMDI0ICogMTAyNCkpLnRvRml4ZWQoMSl9IE1CYDtcbn1cblxuLy8gT25lIHJvdyBwZXIgZXhwb3J0ZWQgZm9ybWF0IChFeHBvcnQgcHJlc2V0cyAtIFBsYW4gMDcpLiBGYWxscyBiYWNrIHRvIHRoZVxuLy8gbGVnYWN5IHNpbmdsZS1ibG9jayBkaXNwbGF5IHdoZW4gYSBjbGlwIGhhcyBoYXNfZXhwb3J0IGJ1dCBubyBjbGlwX2V4cG9ydHNcbi8vIHJvd3MgeWV0IChhIHByb2plY3Qgbm90IGJhY2tmaWxsZWQsIG9yIGEgY2xpcCBtdXRhdGVkIGRpcmVjdGx5IGluIGEgdGVzdCkuXG5mdW5jdGlvbiBfZXhwb3J0Rm9ybWF0c0h0bWwoY2xpcCkge1xuICBpZiAoIWNsaXAuaGFzX2V4cG9ydCkgcmV0dXJuICcnO1xuICBjb25zdCByb3dzID0gKGNsaXAuZXhwb3J0cyB8fCBbXSkuZmlsdGVyKHIgPT4gci5leGlzdHMpO1xuICBpZiAoIXJvd3MubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGBcbiAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjhweDttYXJnaW4tYm90dG9tOjRweDtmb250LXNpemU6MTBweDtmb250LXdlaWdodDo2MDA7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2xldHRlci1zcGFjaW5nOi42cHhcIj5FeHBvcnRlZDwvZGl2PlxuICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6MTJweDtmbGV4LXdyYXA6d3JhcFwiPlxuICAgICAgICAke2NsaXAuZXhwb3J0ZWRfY29udGFpbmVyID8gYDxzcGFuPkNvbnRhaW5lcjogPHN0cm9uZyBzdHlsZT1cImNvbG9yOnZhcigtLXRleHQpXCI+JHtlc2NIdG1sKGNsaXAuZXhwb3J0ZWRfY29udGFpbmVyLnRvVXBwZXJDYXNlKCkpfTwvc3Ryb25nPjwvc3Bhbj5gIDogJyd9XG4gICAgICAgIDxzcGFuPkNhcHRpb25zOiA8c3Ryb25nIHN0eWxlPVwiY29sb3I6dmFyKC0tdGV4dClcIj4ke1xuICAgICAgICAgIGNsaXAuc3VidGl0bGVfc3RhdHVzID09PSAnYmFrZWQtaW4nICAgID8gJ0Jha2VkIGluJyA6XG4gICAgICAgICAgY2xpcC5zdWJ0aXRsZV9zdGF0dXMgPT09ICdzcnQtc2lkZWNhcicgPyAnU1JUIHNpZGVjYXInIDpcbiAgICAgICAgICAnTm9uZSdcbiAgICAgICAgfTwvc3Ryb25nPjwvc3Bhbj5cbiAgICAgICAgJHtjbGlwLmV4cG9ydGVkX2F0ID8gYDxzcGFuPldoZW46IDxzdHJvbmcgc3R5bGU9XCJjb2xvcjp2YXIoLS10ZXh0KVwiPiR7X2ZtdEFnbyhjbGlwLmV4cG9ydGVkX2F0KX08L3N0cm9uZz48L3NwYW4+YCA6ICcnfVxuICAgICAgPC9kaXY+XG4gICAgICAke2NsaXAuZXhwb3J0X3N0YWxlID8gYDxkaXYgY2xhc3M9XCJ0cmFuc2NyaXB0LXN0YWxlLW5vdGVcIiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+JiM5ODg4OyBTdGFsZSAtIHJlLWV4cG9ydCB0byB1cGRhdGUgKCR7ZXNjSHRtbCgoY2xpcC5leHBvcnRfc3RhbGVfcmVhc29ucyB8fCBbXSkuam9pbignLCAnKSl9KTwvZGl2PmAgOiAnJ31gO1xuICB9XG4gIHJldHVybiBgXG4gICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4O21hcmdpbi1ib3R0b206NHB4O2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjYwMDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6LjZweFwiPkV4cG9ydGVkIGZvcm1hdHM8L2Rpdj5cbiAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6OHB4XCI+XG4gICAgICAke3Jvd3MubWFwKHJvdyA9PiBgXG4gICAgICAgIDxkaXYgY2xhc3M9XCJleHBvcnQtZm9ybWF0LXJvd1wiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIiBkYXRhLWV4cG9ydC1pZD1cIiR7cm93LmlkfVwiIGRhdGEtcHJlc2V0LW5hbWU9XCIke2VzY0h0bWwocm93LnByZXNldF9uYW1lKX1cIlxuICAgICAgICAgICAgIGRhdGEtZmlsZW5hbWU9XCIke2VzY0h0bWwocm93LmZpbGVuYW1lKX1cIiBkYXRhLWJ1cm4tc3Vicz1cIiR7cm93LmJ1cm5fc3VicyA/ICcxJyA6ICcnfVwiXG4gICAgICAgICAgICAgZGF0YS1lbWJlZC1zdWJzPVwiJHtyb3cuZW1iZWRfc3VicyA/ICcxJyA6ICcnfVwiIGRhdGEtdGl0bGUtY2FyZD1cIiR7cm93LnRpdGxlX2NhcmQgPyAnMScgOiAnJ31cIlxuICAgICAgICAgICAgIHN0eWxlPVwiYm9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2JvcmRlci1yYWRpdXM6NnB4O3BhZGRpbmc6OHB4XCI+XG4gICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6MTBweDtmbGV4LXdyYXA6d3JhcDthbGlnbi1pdGVtczpiYXNlbGluZVwiPlxuICAgICAgICAgICAgPHN0cm9uZyBzdHlsZT1cImNvbG9yOnZhcigtLXRleHQpXCI+JHtlc2NIdG1sKHdpbmRvdy5leHBvcnRQcmVzZXRMYWJlbChyb3cucHJlc2V0X25hbWUpKX08L3N0cm9uZz5cbiAgICAgICAgICAgIDxzcGFuPiR7ZXNjSHRtbChyb3cuY29udGFpbmVyLnRvVXBwZXJDYXNlKCkpfTwvc3Bhbj5cbiAgICAgICAgICAgIDxzcGFuPiR7X2ZtdFNpemVNYihyb3cuc2l6ZV9ieXRlcyl9PC9zcGFuPlxuICAgICAgICAgICAgPHNwYW4+JHtfZm10QWdvKHJvdy5jcmVhdGVkX2F0KX08L3NwYW4+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgJHtyb3cuZXhwb3J0X3N0YWxlID8gYDxkaXYgY2xhc3M9XCJ0cmFuc2NyaXB0LXN0YWxlLW5vdGVcIiBzdHlsZT1cIm1hcmdpbi10b3A6NHB4XCI+JiM5ODg4OyBTdGFsZSAtIHJlLWV4cG9ydCB0byB1cGRhdGUgKCR7ZXNjSHRtbCgocm93LmV4cG9ydF9zdGFsZV9yZWFzb25zIHx8IFtdKS5qb2luKCcsICcpKX0pPC9kaXY+YCA6ICcnfVxuICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjRweDtmbGV4LXdyYXA6d3JhcDttYXJnaW4tdG9wOjZweFwiPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIGRhdGEtZXhwb3J0LWFjdGlvbj1cImRvd25sb2FkXCI+RG93bmxvYWQ8L2J1dHRvbj5cbiAgICAgICAgICAgICR7QXBwU3RhdGUuY2FuUmV2ZWFsID8gYDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWV4cG9ydC1hY3Rpb249XCJyZXZlYWxcIj5TaG93IGluIGZvbGRlcjwvYnV0dG9uPmAgOiAnJ31cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWV4cG9ydC1hY3Rpb249XCJjb3B5LXBhdGhcIj5Db3B5IHBhdGg8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBkYXRhLWV4cG9ydC1hY3Rpb249XCJyZWdlbmVyYXRlXCI+UmVnZW5lcmF0ZTwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBkYW5nZXJcIiBkYXRhLWV4cG9ydC1hY3Rpb249XCJkZWxldGVcIj5EZWxldGU8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+YCkuam9pbignJyl9XG4gICAgPC9kaXY+XG4gICAgPGJ1dHRvbiBjbGFzcz1cImJ0bi1zZWNvbmRhcnlcIiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCIgZGF0YS1hY3Q9XCJleHBvcnQtY2xpcFwiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj4rIEV4cG9ydCBhbm90aGVyIGZvcm1hdDwvYnV0dG9uPmA7XG59XG5cbi8vIFRydWUgd2hlbiBhIGNsaXAncyBvbmx5IG9uZS1saW5lciBpcyB0aGUgdHJhbnNjcmlwdC1kZXJpdmVkIHRlbXBsYXRlICh0YWdnZWRcbi8vIGRlc2NfYmFzaWMpLCBubyBsYW5ndWFnZSBtb2RlbCBpcyB1c2FibGUgcmlnaHQgbm93LCBhbmQgZ2VuZXJhdGl2ZSBBSSB3YXMgbm90XG4vLyBkZWxpYmVyYXRlbHkgdHVybmVkIG9mZi4gSW4gdGhhdCBmaXJzdC1ydW4gc3RhdGUgdGhlIHRlbXBsYXRlIHRleHQgKGEgZmV3XG4vLyB0cmFuc2NyaXB0IHdvcmRzKSByZWFkcyBhcyBhIGJyb2tlbiBkZXNjcmlwdGlvbiwgc28gdGhlIGRlc2NyaXB0aW9uIGFyZWEgc2hvd3MgYVxuLy8gY2xlYXIgXCJzZXQgdXAgYSBtb2RlbFwiIHBsYWNlaG9sZGVyIGluc3RlYWQgb2YgcXVvdGluZyBpdC4gQSB1c2VyIGVkaXQgKHdoaWNoXG4vLyBzdHJpcHMgZGVzY19iYXNpYyBhbnl3YXkpIGlzIG5ldmVyIGhpZGRlbi5cbmZ1bmN0aW9uIF9kZXNjTmVlZHNNb2RlbChjbGlwKSB7XG4gIHJldHVybiAhIWNsaXAudGFncyAmJiBjbGlwLnRhZ3MuaW5jbHVkZXMoJ2Rlc2NfYmFzaWMnKVxuICAgICYmICFjbGlwLmRlc2NyaXB0aW9uX2lzX2VkaXRlZFxuICAgICYmICEoKHdpbmRvdy5fcHJlcmVxcyB8fCB7fSkubGxtX29rKVxuICAgICYmICh3aW5kb3cuX2FpUHJpdmFjeU1vZGUgfHwgJ2xvY2FsX29ubHknKSAhPT0gJ25vbmUnO1xufVxuXG4vLyBUaGUgY2xpcCdzIG9uZS1saW5lciBhcmVhLiBJbiB0aGUgbm8tbW9kZWwgZmlyc3QtcnVuIHN0YXRlIGEgZGVzY19iYXNpYyBjbGlwIGdldHNcbi8vIGEgY2FsbC10by1hY3Rpb24gcGxhY2Vob2xkZXIgKHNlZSBfZGVzY05lZWRzTW9kZWwpOyBvdGhlcndpc2UgdGhlIGRlc2NyaXB0aW9uIChvclxuLy8gYW4gXCJub3Qgc2NvcmVkIHlldFwiIGhpbnQpIHBsdXMgdGhlIGJhc2ljLWZhbGxiYWNrIGxhYmVsbGluZyBjaGlwLlxuZnVuY3Rpb24gX2NsaXBEZXNjcmlwdGlvbkhUTUwoY2xpcCkge1xuICBpZiAoX2Rlc2NOZWVkc01vZGVsKGNsaXApKSB7XG4gICAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwibmVlZHMtbW9kZWwtY3RhXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwibmVlZHMtbW9kZWwtaGVhZGluZ1wiPkFJIGRlc2NyaXB0aW9ucyBuZWVkIGEgbG9jYWwgbW9kZWw8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJuZWVkcy1tb2RlbC1kZXRhaWxcIj5CYXNlbGluZSBzY29yaW5nIGFscmVhZHkgcmFuLiBTZXQgdXAgYSBsb2NhbCBsYW5ndWFnZSBtb2RlbCB0byBhZGQgYSB3cml0dGVuIGRlc2NyaXB0aW9uIGZvciBlYWNoIGNsaXAuPC9kaXY+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA5cHhcIiBkYXRhLWFjdD1cIm9wZW4tbGxtLXNldHRpbmdzXCI+U2V0IHVwIGEgbG9jYWwgbW9kZWw8L2J1dHRvbj5cbiAgICA8L2Rpdj5gO1xuICB9XG4gIGNvbnN0IGJvZHkgPSBjbGlwLmRlc2NyaXB0aW9uXG4gICAgPyBgXCIke2VzY0h0bWwoY2xpcC5kZXNjcmlwdGlvbil9XCJgXG4gICAgOiBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHhcIj5ObyBkZXNjcmlwdGlvbiB5ZXQgLSBSZS1zY29yZSB0byBnZW5lcmF0ZTwvc3Bhbj5gO1xuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJkZXNjcmlwdGlvblwiPiR7Ym9keX08L2Rpdj4ke19iYXNpY0Rlc2NDaGlwSFRNTChjbGlwKX1gO1xufVxuXG4vLyBBIHN1YnRsZSBudWRnZSB1bmRlciBhIGNsaXAgd2hvc2Ugb25lLWxpbmVyIGlzIHRoZSBub24tTExNIHRlbXBsYXRlIGZhbGxiYWNrXG4vLyAodGFnZ2VkIGRlc2NfYmFzaWMgYnkgdGhlIHNjb3JpbmcgZW5naW5lKS4gVGhlIG1lc3NhZ2UgYWRhcHRzIHRvIHdoeSBubyBsYW5ndWFnZVxuLy8gbW9kZWwgd3JvdGUgdGhlIGRlc2NyaXB0aW9uLiBUaGUgbm8tbW9kZWwgY2FzZSBpcyBoYW5kbGVkIGJ5IF9kZXNjTmVlZHNNb2RlbCAvXG4vLyBfY2xpcERlc2NyaXB0aW9uSFRNTCBpbnN0ZWFkLCBzbyB0aGlzIG9ubHkgY292ZXJzIFwiQUkgZGVsaWJlcmF0ZWx5IG9mZlwiICh0aGVcbi8vIHRlbXBsYXRlIGlzIHRoZSBpbnRlbmRlZCBvdXRwdXQpIGFuZCBcIm1vZGVsIHNldCB1cCBub3csIHJlLWFuYWx5emUgdG8gdXBncmFkZVwiLlxuZnVuY3Rpb24gX2Jhc2ljRGVzY0NoaXBIVE1MKGNsaXApIHtcbiAgaWYgKCFjbGlwLnRhZ3MgfHwgIWNsaXAudGFncy5pbmNsdWRlcygnZGVzY19iYXNpYycpKSByZXR1cm4gJyc7XG4gIGNvbnN0IHRpcCA9ICdUaGlzIG9uZS1saW5lciB3YXMgYnVpbHQgZnJvbSB0aGUgdHJhbnNjcmlwdCB3aXRob3V0IGEgbGFuZ3VhZ2UgbW9kZWwnO1xuICAvLyBVbmRlciBcIk5vIGdlbmVyYXRpdmUgQUlcIiB0aGUgdXNlciBvcHRlZCBvdXQgb2YgbGFuZ3VhZ2UgbW9kZWxzIC0gc2hvdyBhIG5ldXRyYWxcbiAgLy8gbm90ZSwgbmV2ZXIgYSBzZXR1cCBudWRnZSAoU3RhZ2UgMDcpLlxuICBpZiAoKHdpbmRvdy5fYWlQcml2YWN5TW9kZSB8fCAnbG9jYWxfb25seScpID09PSAnbm9uZScpIHtcbiAgICByZXR1cm4gYDxkaXYgY2xhc3M9XCJiYXNpYy1kZXNjLWNoaXBcIiB0aXRsZT1cIiR7dGlwfVwiPkJhc2ljIGRlc2NyaXB0aW9uIC0gZ2VuZXJhdGl2ZSBBSSBpcyB0dXJuZWQgb2ZmPC9kaXY+YDtcbiAgfVxuICAvLyBBIGxhbmd1YWdlIG1vZGVsIGlzIHVzYWJsZSByaWdodCBub3csIHNvIHRoZSBjbGlwIGlzIGJhc2ljIG9ubHkgYmVjYXVzZSBpdCB3YXNcbiAgLy8gc2NvcmVkIGJlZm9yZSB0aGUgbW9kZWwgd2FzIGF2YWlsYWJsZSAtIHJlLWFuYWx5emluZyB1cGdyYWRlcyBpdC5cbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiYmFzaWMtZGVzYy1jaGlwXCIgdGl0bGU9XCIke3RpcH1cIj5CYXNpYyBkZXNjcmlwdGlvbiAtIGEgbGFuZ3VhZ2UgbW9kZWwgaXMgc2V0IHVwIG5vdzsgcmUtYW5hbHl6ZSB0aGlzIHJlY29yZGluZyB0byBhZGQgYW4gQUkgZGVzY3JpcHRpb248L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiByZW5kZXJEZXRhaWwoY2xpcCkge1xuICBjb25zdCBlYiA9IChpc0VkaXRlZCkgPT4gaXNFZGl0ZWQgPyBgPHNwYW4gY2xhc3M9XCJlZGl0ZWQtYmFkZ2VcIj5lZGl0ZWQ8L3NwYW4+YCA6ICcnO1xuXG4gIGNvbnN0IHRyaW1FeHBvcnRIdG1sID0gYFxuICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZClcIj5cbiAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOjRweDtmb250LXNpemU6MTBweDtmb250LXdlaWdodDo2MDA7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2xldHRlci1zcGFjaW5nOi42cHhcIj5UcmltPC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDoxMnB4O2ZsZXgtd3JhcDp3cmFwO2FsaWduLWl0ZW1zOmNlbnRlclwiPlxuICAgICAgICA8c3Bhbj5TdGFydCA8c3Ryb25nIHN0eWxlPVwiY29sb3I6dmFyKC0tdGV4dCk7Zm9udC1mYW1pbHk6bW9ub3NwYWNlXCI+JHtfZm10T2Zmc2V0KGNsaXAuc3RhcnRfb2Zmc2V0KX08L3N0cm9uZz48L3NwYW4+XG4gICAgICAgIDxzcGFuPkVuZCA8c3Ryb25nIHN0eWxlPVwiY29sb3I6dmFyKC0tdGV4dCk7Zm9udC1mYW1pbHk6bW9ub3NwYWNlXCI+JHtfZm10T2Zmc2V0KGNsaXAuZW5kX29mZnNldCl9PC9zdHJvbmc+PC9zcGFuPlxuICAgICAgICA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4XCI+KGVkaXQgaW4gRXhwb3J0KTwvc3Bhbj5cbiAgICAgIDwvZGl2PlxuICAgICAgJHtfZXhwb3J0Rm9ybWF0c0h0bWwoY2xpcCl9XG4gICAgPC9kaXY+YDtcblxuICBjb25zdCBzY29yaW5nQWN0aW9uc0h0bWwgPSBgXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkcy1yb3dcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPlNjb3Jpbmc8L3NwYW4+XG4gICAgICAgICAgJHtjbGlwLnNjb3JlZF9hdCAmJiBjbGlwLnNjb3JlX292ZXJhbGxfdXNlciAhPSBudWxsXG4gICAgICAgICAgICA/IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjJweCA4cHhcIiBkYXRhLWFjdD1cImNsZWFyLXNjb3JlLW92ZXJyaWRlXCIgZGF0YS1jbGlwLWlkPVwiJHtjbGlwLmlkfVwiIHRpdGxlPVwiUmVtb3ZlIG1hbnVhbCBzY29yZSBvdmVycmlkZVwiPlJlbW92ZSBPdmVycmlkZTwvYnV0dG9uPmBcbiAgICAgICAgICAgIDogY2xpcC5zY29yZWRfYXRcbiAgICAgICAgICAgID8gYDxidXR0b24gY2xhc3M9XCJidG4gZ2hvc3RcIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6MnB4IDhweFwiIGRhdGEtYWN0PVwib3Blbi1zY29yZS1vdmVycmlkZVwiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj5PdmVycmlkZSBTY29yZTwvYnV0dG9uPmBcbiAgICAgICAgICAgIDogJyd9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwic2NvcmVzXCI+XG4gICAgICAgICAgJHshY2xpcC5zY29yZWRfYXQgPyBgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHhcIj5Ob3QgeWV0IHNjb3JlZCAtIFJlLXNjb3JlIHRvIGdlbmVyYXRlPC9zcGFuPmAgOlxuICAgICAgICAgICAgY2xpcC5zY29yZV9vdmVyYWxsX3VzZXIgIT0gbnVsbFxuICAgICAgICAgICAgPyBzY29yZVJvd092ZXJyaWRlKCdPdmVyYWxsJywgY2xpcC5zY29yZV9vdmVyYWxsLCBjbGlwLnNjb3JlX292ZXJhbGxfdXNlciwgJ292ZXJhbGwnKVxuICAgICAgICAgICAgOiBzY29yZVJvdygnT3ZlcmFsbCcsIGNsaXAuc2NvcmVfb3ZlcmFsbCwgJ292ZXJhbGwnKX1cbiAgICAgICAgICAke2NsaXAuc2NvcmVkX2F0ID8gc2NvcmVSb3coJ0Z1bm55JywgICAgY2xpcC5zY29yZV9mdW5ueSwgICAgJ2Z1bm55JykgICAgOiAnJ31cbiAgICAgICAgICAke2NsaXAuc2NvcmVkX2F0ID8gc2NvcmVSb3coJ0RyYW1hdGljJywgY2xpcC5zY29yZV9kcmFtYXRpYywgJ2RyYW1hdGljJykgOiAnJ31cbiAgICAgICAgICAke2NsaXAuc2NvcmVkX2F0ID8gc2NvcmVSb3coJ0FjdGlvbicsICAgY2xpcC5zY29yZV9hY3Rpb24sICAgJ2FjdGlvbicpICAgOiAnJ31cbiAgICAgICAgICAke2NsaXAuc2NvcmVkX2F0ID8gc2NvcmVSb3coJ1Zpc3VhbCcsICAgY2xpcC5zY29yZV92aXN1YWwgfHwgMCwgJ3Zpc3VhbCcpIDogJyd9XG4gICAgICAgICAgJHtjbGlwLnNjb3JlZF9hdCAmJiBjbGlwLnNjb3JlX2xhdWdoICE9IG51bGwgPyBzY29yZVJvdygnTGF1Z2hzJywgY2xpcC5zY29yZV9sYXVnaCwgJ2xhdWdoJykgOiAnJ31cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZFwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+PHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPkFjdGlvbnM8L3NwYW4+PC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjbGlwLWFjdGlvbnNcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwicmV2aWV3LWFjdGlvbnNcIj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gYXBwcm92ZSAke2NsaXAuc3RhdHVzPT09J2FwcHJvdmVkJz8nYWN0aXZlJzonJ31cIiBkYXRhLWFjdD1cInNldC1zdGF0dXNcIiBkYXRhLWNsaXAtaWQ9XCIke2NsaXAuaWR9XCIgZGF0YS1zdGF0dXM9XCIke2NsaXAuc3RhdHVzPT09J2FwcHJvdmVkJz8ncGVuZGluZyc6J2FwcHJvdmVkJ31cIiB0aXRsZT1cIkFwcHJvdmUgKHByZXNzIEEpXCI+QXBwcm92ZTwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biByZWplY3QgICR7Y2xpcC5zdGF0dXM9PT0ncmVqZWN0ZWQnPydhY3RpdmUnOicnfVwiIGRhdGEtYWN0PVwic2V0LXN0YXR1c1wiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIiBkYXRhLXN0YXR1cz1cIiR7Y2xpcC5zdGF0dXM9PT0ncmVqZWN0ZWQnPydwZW5kaW5nJzoncmVqZWN0ZWQnfVwiIHRpdGxlPVwiUmVqZWN0IChwcmVzcyBSKVwiPlJlamVjdDwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biAke2NsaXAuc3RhdHVzPT09J3BlbmRpbmcnPydhY3RpdmUnOicnfVwiIGRhdGEtYWN0PVwic2V0LXN0YXR1c1wiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIiBkYXRhLXN0YXR1cz1cInBlbmRpbmdcIiB0aXRsZT1cIk1hcmsgYXMgVW5yZXZpZXdlZCAocHJlc3MgVSlcIj5VbnJldmlld2VkPC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cIm9wLWFjdGlvbnNcIj5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gaGlnaGxpZ2h0XCIgZGF0YS1hY3Q9XCJleHBvcnQtY2xpcFwiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj4ke2NsaXAuaGFzX2V4cG9ydCA/ICdSZS1leHBvcnQnIDogJ0V4cG9ydCd9PC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgZGF0YS1hY3Q9XCJvcGVuLWNsaXAtYWN0aW9ucy1tb2RhbFwiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj5BZGRpdGlvbmFsIEFjdGlvbnM8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xuXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtdHlwZS1iYWRnZSBjbGlwLWJhZGdlXCIgc3R5bGU9XCJtYXJnaW4tYm90dG9tOjhweFwiPiYjMTI3OTAyOyBDbGlwICMke2NsaXAuaWR9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiY2xpcC1oZWFkZXJcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJ0aW1lXCI+JHtjbGlwLnN0YXJ0X2htc30gJm1pZGRvdDsgJHtjbGlwLmR1cmF0aW9uX2htc308L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cblxuICAgICR7X2R1cGxpY2F0ZU5vdGljZUhUTUwoY2xpcCl9XG5cbiAgICAke3Njb3JpbmdBY3Rpb25zSHRtbH1cblxuICAgICR7Y29sbGFwc2libGVDYXJkKCdjbGlwLWRlc2NyaXB0aW9uJyxcbiAgICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5EZXNjcmlwdGlvbiR7ZWIoY2xpcC5kZXNjcmlwdGlvbl9pc19lZGl0ZWQpfTwvc3Bhbj5gLCBgXG4gICAgICAke19jbGlwRGVzY3JpcHRpb25IVE1MKGNsaXApfVxuXG4gICAgICAke2NsaXAuZGVzY3JpcHRpb25fbG9uZyA/IGBcbiAgICAgICAgPGhyIGNsYXNzPVwiZGV0YWlsLWNhcmQtZGl2aWRlclwiPlxuICAgICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPkZ1bGwgRGVzY3JpcHRpb24ke2ViKGNsaXAuZGVzY3JpcHRpb25fbG9uZ19pc19lZGl0ZWQpfTwvc3Bhbj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwia2ViYWItYnRuXCIgdGl0bGU9XCJFZGl0IG9yIHJlZ2VuZXJhdGUgbG9uZyBkZXNjcmlwdGlvblwiIGFyaWEtbGFiZWw9XCJFZGl0IG9yIHJlZ2VuZXJhdGUgbG9uZyBkZXNjcmlwdGlvblwiIGRhdGEtYWN0PVwib3Blbi1kZXNjLWxvbmcta2ViYWJcIiBkYXRhLWNsaXAtaWQ9XCIke2NsaXAuaWR9XCI+JiM4OTQyOzwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRlc2NyaXB0aW9uLWxvbmdcIj4ke2VzY0h0bWwoY2xpcC5kZXNjcmlwdGlvbl9sb25nKX08L2Rpdj5gIDogJyd9XG5cbiAgICAgIDxociBjbGFzcz1cImRldGFpbC1jYXJkLWRpdmlkZXJcIj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZC1oZWFkZXJcIj48c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+VGFnczwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJjbGlwLXRhZ3NcIiBpZD1cImNsaXAtdXNlci10YWdzXCI+JHtfY2xpcFRhZ1BpbGxzSFRNTChjbGlwLnVzZXJfdGFncyl9PC9kaXY+XG4gICAgICA8aW5wdXQgbGlzdD1cImNsaXAtdGFncy1kYXRhbGlzdFwiIGlkPVwiY2xpcC10YWctaW5wdXRcIiBjbGFzcz1cInRhZy1pbnB1dFwiXG4gICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJBZGQgYSB0YWfigKZcIiBtYXhsZW5ndGg9XCI0MFwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiIGFyaWEtbGFiZWw9XCJBZGQgYSB0YWdcIj5cbiAgICAgIDxkYXRhbGlzdCBpZD1cImNsaXAtdGFncy1kYXRhbGlzdFwiPjwvZGF0YWxpc3Q+XG4gICAgICAke19nZW5lcmF0ZWRUYWdQaWxsc0hUTUwoY2xpcC50YWdzKX1gLCB7XG4gICAgICBhY3Rpb25zOiBgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6NHB4XCI+XG4gICAgICAgICAgJHtjbGlwLmRlc2NyaXB0aW9uICYmICFfZGVzY05lZWRzTW9kZWwoY2xpcCkgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzozcHggOXB4XCIgdGl0bGU9XCJDb3B5IGRlc2NyaXB0aW9uXCIgYXJpYS1sYWJlbD1cIkNvcHkgZGVzY3JpcHRpb25cIiBkYXRhLWNvcHk9XCJkZXNjcmlwdGlvblwiPkNvcHk8L2J1dHRvbj5gIDogJyd9XG4gICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImtlYmFiLWJ0blwiIHRpdGxlPVwiRWRpdCBvciByZWdlbmVyYXRlIGRlc2NyaXB0aW9uXCIgYXJpYS1sYWJlbD1cIkVkaXQgb3IgcmVnZW5lcmF0ZSBkZXNjcmlwdGlvblwiIGRhdGEtYWN0PVwib3Blbi1kZXNjLWtlYmFiXCIgZGF0YS1jbGlwLWlkPVwiJHtjbGlwLmlkfVwiPiYjODk0Mjs8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+YCxcbiAgICB9KX1cblxuICAgICR7X3Zpc2lvbkRldGFpbEhUTUwoY2xpcCl9XG4gICAgJHtfaG90d29yZERldGFpbEhUTUwoY2xpcCl9XG4gICAgJHtfc2Vuc2l0aXZlRGV0YWlsSFRNTChjbGlwKX1cblxuICAgIDxkaXYgY2xhc3M9XCJkZXRhaWwtY2FyZFwiPlxuICAgICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkLWhlYWRlclwiPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+RXhwb3J0PC9zcGFuPlxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTJweDtwYWRkaW5nOjJweCAxMHB4XCIgZGF0YS1hY3Q9XCJvcGVuLWV4cG9ydC1lZGl0b3JcIiBkYXRhLWNsaXAtaWQ9XCIke2NsaXAuaWR9XCIgdGl0bGU9XCJUcmltLCBmcmFtZSB2ZXJ0aWNhbCwgcHJldmlldyBjYXB0aW9ucywgdGhlbiBleHBvcnRcIj5FZGl0ICZhbXA7IGV4cG9ydDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG4gICAgICAke3RyaW1FeHBvcnRIdG1sfVxuICAgIDwvZGl2PlxuXG4gICAgJHtjbGlwLnJlbGF0ZWRfY2xpcHMgPyBjb2xsYXBzaWJsZUNhcmQoJ2NsaXAtcmVsYXRlZCcsXG4gICAgICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5SZWxhdGVkIENsaXBzPC9zcGFuPmAsIGBcbiAgICAgICAgJHtjbGlwLnJlbGF0ZWRfY2xpcHMubGVuZ3RoID8gY2xpcC5yZWxhdGVkX2NsaXBzLm1hcChyID0+IGBcbiAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDo4cHg7YWxpZ24taXRlbXM6YmFzZWxpbmU7cGFkZGluZzo0cHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpXCI+XG4gICAgICAgICAgICA8YSBocmVmPVwiI1wiIHN0eWxlPVwiY29sb3I6dmFyKC0tYWNjZW50KTt0ZXh0LWRlY29yYXRpb246bm9uZTtmb250LXNpemU6MTNweDt3aGl0ZS1zcGFjZTpub3dyYXBcIiBkYXRhLWFjdD1cInNlbGVjdC1yZWxhdGVkLWNsaXBcIiBkYXRhLWNsaXAtaWQ9XCIke3IuaWR9XCI+IyR7ci5pZH08L2E+XG4gICAgICAgICAgICA8c3BhbiBzdHlsZT1cImZvbnQtc2l6ZToxMnB4O2NvbG9yOnZhcigtLW11dGVkKVwiPiR7ZXNjSHRtbChyLnJlYXNvbil9PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PmApLmpvaW4oJycpIDogYDxkaXYgc3R5bGU9XCJmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZClcIj5ObyBzaW1pbGFyIGNsaXBzIGZvdW5kPC9kaXY+YH1gLFxuICAgICAgeyBhdHRyczogJ2lkPVwicmVsYXRlZC1jbGlwcy1zZWN0aW9uXCInLCBoZWFkZXJTdHlsZTogJ2p1c3RpZnktY29udGVudDpmbGV4LXN0YXJ0O2dhcDo4cHgnLFxuICAgICAgICBhY3Rpb25zOiBgJHtjbGlwLnJlbGF0ZWRfY2xpcHNfc3RhbGUgPyBgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS13YXJuaW5nKTtmb250LXN0eWxlOml0YWxpY1wiPnN0YWxlIC0gcmUtc2NvcmUgdXBkYXRlZDwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgPHNwYW4gc3R5bGU9XCJmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS1tdXRlZCk7bWFyZ2luLWxlZnQ6YXV0b1wiPiR7Y2xpcC5yZWxhdGVkX2NsaXBzX2F0ID8gX2ZtdEFnbyhjbGlwLnJlbGF0ZWRfY2xpcHNfYXQpIDogJyd9PC9zcGFuPmAgfSkgOiAnJ31cblxuICAgICR7X3RyYW5zY3JpcHRDYXJkSFRNTChjbGlwKX1cbiAgYDtcblxuICBpZiAoY2xpcC50cmFuc2NyaXB0X2V4Y2VycHQgJiYgd2luZG93LmxvYWRDbGlwVHJhbnNjcmlwdCkgd2luZG93LmxvYWRDbGlwVHJhbnNjcmlwdChjbGlwLmlkKTtcbiAgX3JlbmRlclRhZ0RhdGFsaXN0KCk7XG4gIF9sb2FkVGFnU3VnZ2VzdGlvbnMoKS50aGVuKF9yZW5kZXJUYWdEYXRhbGlzdCk7XG4gIGNvbnN0IHZpc2lvbkJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbmFseXplLWZyYW1lcy1idG4nKTtcbiAgaWYgKHZpc2lvbkJ0bikge1xuICAgIGdhdGVPbkNhcGFiaWxpdHkodmlzaW9uQnRuLCAndmlzaW9uJyxcbiAgICAgICdGcmFtZSBhbmFseXNpcyBuZWVkcyBhIHZpc2lvbi1jYXBhYmxlIG1vZGVsLicpO1xuICB9XG4gIC8vIEEgcGFuZWwgcmVidWlsdCB3aGlsZSBhIGpvYiBydW5zIG11c3QgY29tZSB1cCB3aXRoIGl0cyBoZWF2eSBidXR0b25zIGRpc2FibGVkLlxuICBhcHBseUpvYkJsb2NrZWRTdGF0ZSgpO1xufVxuXG4vLyBBIGNsaXAgd2l0aCBubyB0cmFuc2NyaXB0IGV4Y2VycHQgKHZpZGVvLWhlYXZ5LWFuYWx5c2lzIFN0YWdlIDAzIC0gYSBzaWxlbnQsXG4vLyB2aXN1YWxseSBhY3RpdmUgbW9tZW50LCBvciBzaW1wbHkgYSBjbGlwIHdpdGggbm8gY2FwdGlvbnMpIHN0aWxsIG5lZWRzIGEgbGVnaWJsZVxuLy8gVHJhbnNjcmlwdCBjYXJkIHJhdGhlciB0aGFuIHRoZSBzZWN0aW9uIGRpc2FwcGVhcmluZy4gU2hvd3MgdGhlIFZpc3VhbCBzY29yZSBhbmRcbi8vIHRoZSBub19zcGVlY2ggdGFnIGlubGluZSwgcGx1cyB0aGUgdmlzaW9uLUxMTSBvbmUtbGluZXIgaWYgXCJBbmFseXplIGZyYW1lc1wiIChiZWxvdylcbi8vIGFscmVhZHkgcHJvZHVjZWQgb25lLiBBIGNsaXAgV0lUSCBhIHRyYW5zY3JpcHQgaXMgdW5hZmZlY3RlZCAtIHRoZSBleGNlcnB0IGFsd2F5cyB3aW5zLlxuZnVuY3Rpb24gX3RyYW5zY3JpcHRDYXJkSFRNTChjbGlwKSB7XG4gIGlmIChjbGlwLnRyYW5zY3JpcHRfZXhjZXJwdCkge1xuICAgIHJldHVybiBjb2xsYXBzaWJsZUNhcmQoJ2NsaXAtdHJhbnNjcmlwdCcsXG4gICAgICAgIGA8c3BhbiBjbGFzcz1cImRldGFpbC1jYXJkLXRpdGxlXCI+VHJhbnNjcmlwdDwvc3Bhbj5gLCBgXG4gICAgICAke2NsaXAudHJhbnNjcmlwdF9zdGFsZSA/IGA8ZGl2IGNsYXNzPVwidHJhbnNjcmlwdC1zdGFsZS1ub3RlXCI+JiM5ODg4OyBDYXB0aW9ucyBlZGl0ZWQgc2luY2UgbGFzdCBzY29yaW5nIC0gPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzoycHggOHB4XCIgZGF0YS1hY3Q9XCJyZXNjb3JlLWNsaXBcIiBkYXRhLWNsaXAtaWQ9XCIke2NsaXAuaWR9XCI+UmUtc2NvcmU8L2J1dHRvbj4gdG8gcmVmcmVzaC48L2Rpdj5gIDogJyd9XG4gICAgICA8ZGl2IGlkPVwiY2xpcC10cmFuc2NyaXB0LXZpZXdcIiBjbGFzcz1cInRyYW5zY3JpcHRcIj4ke2VzY0h0bWwoY2xpcC50cmFuc2NyaXB0X2V4Y2VycHQpfTwvZGl2PmAsXG4gICAgICB7IGFjdGlvbnM6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgc3R5bGU9XCJmb250LXNpemU6MTFweDtwYWRkaW5nOjNweCA5cHhcIiB0aXRsZT1cIkNvcHkgdHJhbnNjcmlwdFwiIGFyaWEtbGFiZWw9XCJDb3B5IHRyYW5zY3JpcHRcIiBkYXRhLWNvcHk9XCJ0cmFuc2NyaXB0XCI+Q29weTwvYnV0dG9uPmAgfSk7XG4gIH1cbiAgY29uc3QgaXNOb1NwZWVjaCA9IChjbGlwLnRhZ3MgfHwgW10pLmluY2x1ZGVzKCdub19zcGVlY2gnKTtcbiAgY29uc3QgdmlzdWFsUGN0ID0gTWF0aC5yb3VuZCgoY2xpcC5zY29yZV92aXN1YWwgfHwgMCkgKiAxMDApO1xuICByZXR1cm4gY29sbGFwc2libGVDYXJkKCdjbGlwLXRyYW5zY3JpcHQnLFxuICAgICAgYDxzcGFuIGNsYXNzPVwiZGV0YWlsLWNhcmQtdGl0bGVcIj5UcmFuc2NyaXB0PC9zcGFuPmAsIGBcbiAgICA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxM3B4XCI+Tm8gZGlhbG9ndWUgaW4gdGhpcyBjbGlwPC9kaXY+XG4gICAgPGRpdiBjbGFzcz1cInRhZ3NcIiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+XG4gICAgICAke2NsaXAuc2NvcmVkX2F0ID8gYDxzcGFuIGNsYXNzPVwidGFnXCIgdGl0bGU9XCJIb3cgdmlzdWFsbHkgYWN0aXZlIHRoaXMgY2xpcCBpc1wiPiYjMTI3OTA5OyBWaXN1YWwgJHt2aXN1YWxQY3R9JTwvc3Bhbj5gIDogJyd9XG4gICAgICAke2lzTm9TcGVlY2ggPyBgPHNwYW4gY2xhc3M9XCJ0YWdcIiB0aXRsZT1cIk5vIHNwb2tlbiBkaWFsb2d1ZSB3YXMgZGV0ZWN0ZWQgaW4gdGhpcyBjbGlwXCI+Tm8gZGlhbG9ndWU8L3NwYW4+YCA6ICcnfVxuICAgIDwvZGl2PlxuICAgICR7Y2xpcC52aXNpb25fc3VtbWFyeSA/IGA8ZGl2IGNsYXNzPVwiZGVzY3JpcHRpb24tbG9uZ1wiIHN0eWxlPVwibWFyZ2luLXRvcDo4cHhcIj4ke2VzY0h0bWwoY2xpcC52aXNpb25fc3VtbWFyeSl9PC9kaXY+YCA6ICcnfWApO1xufVxuXG4vLyDilIDilIAgaW1hZ2UtYmFzZWQgY2xpcCBhbmFseXNpcyAoV2hhdCdzIG9uIHNjcmVlbikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBfdmlzaW9uU3Bpbm5lckJ1dHRvbigpIHtcbiAgcmV0dXJuIGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJhbmFseXplLWZyYW1lcy1idG5cIiBzdHlsZT1cImZvbnQtc2l6ZToxMnB4O3BhZGRpbmc6M3B4IDEwcHhcIiBkaXNhYmxlZD5gXG4gICAgKyBgPHNwYW4gY2xhc3M9XCJzcGlubmVyXCIgc3R5bGU9XCJkaXNwbGF5OmlubGluZS1ibG9jazt2ZXJ0aWNhbC1hbGlnbjptaWRkbGU7d2lkdGg6MTFweDtoZWlnaHQ6MTFweFwiPjwvc3Bhbj4gYFxuICAgICsgYEFuYWx5emluZyBmcmFtZXMuLi48L2J1dHRvbj5gO1xufVxuXG5mdW5jdGlvbiBfdmlzaW9uRGV0YWlsSFRNTChjbGlwKSB7XG4gIC8vIE1hc3RlciBzd2l0Y2ggKFNldHRpbmdzIOKGkiBJbWFnZSBhbmFseXNpcykuIE9uIGJ5IGRlZmF1bHQ7IHRoZSBidXR0b24gaXRzZWxmIGlzXG4gIC8vIHN0aWxsIGdhdGVkIG9uIGEgdmlzaW9uLWNhcGFibGUgbW9kZWwgYmVpbmcgY29uZmlndXJlZCAoZ2F0ZU9uQ2FwYWJpbGl0eSBhYm92ZSkuXG4gIC8vIHdpbmRvdy5fdmlzaW9uRW5hYmxlZCBpcyBzZWVkZWQgYXQgYm9vdCBhbmQgb24gc2V0dGluZ3Mgc2F2ZS5cbiAgaWYgKCF3aW5kb3cuX3Zpc2lvbkVuYWJsZWQpIHJldHVybiAnJztcbiAgY29uc3Qgc3VtbWFyeSA9IGNsaXAudmlzaW9uX3N1bW1hcnk7XG4gIGNvbnN0IGJ0bkxhYmVsID0gc3VtbWFyeSA/ICdSZS1hbmFseXplIGZyYW1lcycgOiAnQW5hbHl6ZSBmcmFtZXMnO1xuICBjb25zdCBib2R5ID0gc3VtbWFyeVxuICAgID8gYDxkaXYgY2xhc3M9XCJkZXNjcmlwdGlvbi1sb25nXCI+JHtlc2NIdG1sKHN1bW1hcnkpfTwvZGl2PlxuICAgICAgIDxkaXYgc3R5bGU9XCJmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS1tdXRlZCk7bWFyZ2luLXRvcDo0cHhcIj5BbmFseXplZCAke19mbXRBZ28oY2xpcC52aXNpb25fYW5hbHl6ZWRfYXQpfTwvZGl2PmBcbiAgICA6IGA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxM3B4XCI+U2FtcGxlIGZyYW1lcyBmcm9tIHRoaXMgY2xpcCBhbmQgZGVzY3JpYmUgd2hhdCdzIG9uIHNjcmVlbiAtIGl0IGVucmljaGVzIHRoZSBkZXNjcmlwdGlvbiBhbmQgZ2l2ZXMgc2NvcmluZyB2aXN1YWwgY29udGV4dC48L2Rpdj5gO1xuICAvLyBJZiBhbiBhbmFseXplLWZyYW1lcyBqb2IgZm9yIFRISVMgY2xpcCBpcyBpbiBmbGlnaHQsIHJlbmRlciB0aGUgc3Bpbm5lciBmcm9tXG4gIC8vIEFwcFN0YXRlLmNsaXBKb2JzIChub3QgYSBjYXB0dXJlZCBET00gbm9kZSkgc28gdGhlIGluZGljYXRvciBzdXJ2aXZlcyBhXG4gIC8vIHJlbmRlckRldGFpbCByZWJ1aWxkIG9yIGEgY2xpcCBzd2l0Y2gtYXdheS1hbmQtYmFjay4gT3RoZXJ3aXNlIHRoZSBub3JtYWxcbiAgLy8gYnV0dG9uLCB0YWdnZWQgZGF0YS1qb2ItYmxvY2tlZCBzbyBpdCBkaXNhYmxlcyB3aGlsZSBzb21lIE9USEVSIGpvYiBydW5zLlxuICBjb25zdCBpbkZsaWdodCA9IEFwcFN0YXRlLmNsaXBKb2JzW2NsaXAuaWRdICYmIEFwcFN0YXRlLmNsaXBKb2JzW2NsaXAuaWRdLm9wID09PSAnYW5hbHl6ZS1mcmFtZXMnO1xuICBjb25zdCBidXR0b25IdG1sID0gaW5GbGlnaHRcbiAgICA/IF92aXNpb25TcGlubmVyQnV0dG9uKClcbiAgICA6IGA8YnV0dG9uIGNsYXNzPVwiYnRuIGdob3N0XCIgaWQ9XCJhbmFseXplLWZyYW1lcy1idG5cIiBkYXRhLWpvYi1ibG9ja2VkIHN0eWxlPVwiZm9udC1zaXplOjEycHg7cGFkZGluZzozcHggMTBweFwiXG4gICAgICAgICAgICAgICAgZGF0YS1hY3Q9XCJhbmFseXplLWZyYW1lc1wiIGRhdGEtY2xpcC1pZD1cIiR7Y2xpcC5pZH1cIj4ke2J0bkxhYmVsfTwvYnV0dG9uPmA7XG4gIHJldHVybiBjb2xsYXBzaWJsZUNhcmQoJ2NsaXAtdmlzaW9uJyxcbiAgICBgPHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPldoYXQncyBvbiBzY3JlZW48L3NwYW4+YCwgYFxuICAgICAgJHtib2R5fVxuICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi10b3A6OHB4XCI+JHtidXR0b25IdG1sfTwvZGl2PmApO1xufVxuXG4vLyBPcHRpbWlzdGljIGltbWVkaWF0ZSByZXBhaW50IG9mIHRoZSBidXR0b24gb24gc3RhcnQ7IGR1cmFibGUgaW4tZmxpZ2h0IHN0YXRlXG4vLyBsaXZlcyBpbiBBcHBTdGF0ZS5jbGlwSm9icyBzbyBhbnkgbGF0ZXIgcmVidWlsZCByZW5kZXJzIGNvcnJlY3RseSB2aWEgX3Zpc2lvbkRldGFpbEhUTUwuXG5mdW5jdGlvbiBfcGFpbnRWaXNpb25JbkZsaWdodChjbGlwSWQpIHtcbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCAhPT0gY2xpcElkIHx8IFBhbmVsTmF2LmlzT3BlbigpKSByZXR1cm47XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbmFseXplLWZyYW1lcy1idG4nKTtcbiAgaWYgKGJ0bikgYnRuLm91dGVySFRNTCA9IF92aXNpb25TcGlubmVyQnV0dG9uKCk7XG59XG5cbi8vIFRlcm1pbmFsIGNsZWFudXAgc2hhcmVkIGJ5IHRoZSBkb25lLCBlcnJvciwgYW5kIGNhbmNlbCBwYXRoczogZHJvcCB0aGUgaW4tZmxpZ2h0XG4vLyBmbGFnIChzbyB0aGUgYnV0dG9uIGxlYXZlcyBpdHMgc3Bpbm5lcikgYW5kIHJlcGFpbnQgZnJvbSB0aGUgY2FjaGVkIGNsaXAgaWYgaXQgaXNcbi8vIHN0aWxsIHRoZSBvbmUgb24gc2NyZWVuLiBXaXRob3V0IHRoaXMgdGhlIGZsYWcgd291bGQgbGVhayBvbiBhbiBlcnJvci9jYW5jZWwgYW5kXG4vLyBzdHJhbmQgdGhlIGJ1dHRvbiBhcyBhIHBlcm1hbmVudCBkaXNhYmxlZCBzcGlubmVyIHVudGlsIGEgcGFnZSByZWxvYWQuXG5mdW5jdGlvbiBfZmluaXNoVmlzaW9uSm9iKGNsaXBJZCkge1xuICBkZWxldGUgQXBwU3RhdGUuY2xpcEpvYnNbY2xpcElkXTtcbiAgY29uc3QgZGF0YSA9IEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhO1xuICBpZiAoZGF0YSAmJiBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPT09IGNsaXBJZCAmJiAhUGFuZWxOYXYuaXNPcGVuKCkpIHJlbmRlckRldGFpbChkYXRhKTtcbn1cblxuZnVuY3Rpb24gYW5hbHl6ZUZyYW1lcyhjbGlwSWQpIHtcbiAgaWYgKF9ibG9ja2VkQnlBbmFseXplKCdhbmFseXplIGZyYW1lcycpKSByZXR1cm47XG4gIEFwcFN0YXRlLmNsaXBKb2JzW2NsaXBJZF0gPSB7b3A6ICdhbmFseXplLWZyYW1lcyd9O1xuICBfcGFpbnRWaXNpb25JbkZsaWdodChjbGlwSWQpO1xuICBzdHJlYW1TU0UoXG4gICAgYC9hcGkvY2xpcHMvJHtjbGlwSWR9L2FuYWx5emUtZnJhbWVzYCxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBkZWxldGUgQXBwU3RhdGUuY2xpcEpvYnNbY2xpcElkXTtcbiAgICAgIGxldCBjbGlwID0gbnVsbDtcbiAgICAgIHRyeSB7IGNsaXAgPSBhd2FpdCBmZXRjaChgL2FwaS9jbGlwcy8ke2NsaXBJZH1gKS50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogbnVsbCk7IH0gY2F0Y2ggKF8pIHt9XG4gICAgICAvLyBPbmx5IHRvdWNoIHRoZSBwYW5lbCBpZiB0aGlzIGNsaXAgaXMgc3RpbGwgdGhlIG9uZSBvbiBzY3JlZW4gYW5kIGEgUGFuZWxOYXZcbiAgICAgIC8vIGZsb3cgaXNuJ3QgY292ZXJpbmcgaXQgLSBvdGhlcndpc2UgdGhlIHJlc3VsdCBtdXN0IG5vdCBsYW5kIGluIGFub3RoZXIgY2xpcCdzXG4gICAgICAvLyB2aWV3LiBBIGxhdGVyIHJldHVybiB0byB0aGlzIGNsaXAgcmUtZmV0Y2hlcyBpdCBmcmVzaCB2aWEgc2VsZWN0Q2xpcC4gUmVidWlsZFxuICAgICAgLy8gZnJvbSB0aGUgZnJlc2hlc3QgZGF0YSAodGhlIGZldGNoZWQgY2xpcCwgZWxzZSB0aGUgY2FjaGVkIGNvcHkpIHNvIHRoZSBidXR0b25cbiAgICAgIC8vIHJldHVybnMgZnJvbSBzcGlubmVyIHRvIG5vcm1hbCBub3cgdGhhdCBjbGlwSm9icyBubyBsb25nZXIgZmxhZ3MgdGhpcyBjbGlwLlxuICAgICAgaWYgKGNsaXAgJiYgQXBwU3RhdGUuYWN0aXZlQ2xpcElkID09PSBjbGlwSWQpIEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhID0gY2xpcDtcbiAgICAgIGNvbnN0IGRhdGEgPSBjbGlwIHx8IEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhO1xuICAgICAgaWYgKGRhdGEgJiYgQXBwU3RhdGUuYWN0aXZlQ2xpcElkID09PSBjbGlwSWQgJiYgIVBhbmVsTmF2LmlzT3BlbigpKSByZW5kZXJEZXRhaWwoZGF0YSk7XG4gICAgfSxcbiAgICBGUkFNRVNfU1RFUFMsICdBbmFseXppbmcgZnJhbWVzLi4uJyxcbiAgICAvLyBDYW5jZWxsYWJsZTogdGhlIGpvYiBydW5zIGFzIGEgc3VicHJvY2VzcyAocGlwZWxpbmUvZnJhbWVfYW5hbHlzaXMucHkpLCBzb1xuICAgIC8vIGtpbGxpbmcgaXQgdmlhIHRoZSBjYW5jZWwgZW5kcG9pbnQgZHJvcHMgdGhlIGxsYW1hLXNlcnZlciBjb25uZWN0aW9uIGFuZFxuICAgIC8vIGdlbmVyYXRpb24gYWN0dWFsbHkgc3RvcHMgLSB0aGUgcG9pbnQgb2YgaXQsIGZvciBhIGJpZyBtb2RlbCBvbiBtYW55IGZyYW1lcy5cbiAgICB0cnVlLFxuICAgIC8vIFRoZSBzdWJwcm9jZXNzIHJlcG9ydHMgaXRzIG93biBoYW5kbGVkIGZhaWx1cmVzIGFzIGJyYWNrZXRlZCBzdGF0dXMgbGluZXMgYW5kXG4gICAgLy8gdGhlbiBleGl0cyBjbGVhbmx5IChubyB0cmFuc3BvcnQgZXJyb3IsIHNvIHN0cmVhbVNTRSdzIGVycm9yIHRvYXN0IG5ldmVyIGZpcmVzKS5cbiAgICAvLyBTdXJmYWNlIHRoZW0gYXMgYSB0b2FzdCwgb3RoZXJ3aXNlIGEgZmFpbGVkIGFuYWx5c2lzIGlzIG9ubHkgdmlzaWJsZSBpbiB0aGUgbG9nLlxuICAgIGxpbmUgPT4geyBpZiAodHlwZW9mIGxpbmUgPT09ICdzdHJpbmcnICYmIGxpbmUuc3RhcnRzV2l0aCgnWycpKSBzaG93VG9hc3QobGluZS5yZXBsYWNlKC9eXFxbfFxcXSQvZywgJycpLCAnZXJyb3InKTsgfSxcbiAgICBmYWxzZSwge21ldGhvZDogJ1BPU1QnfSxcbiAgICAoKSA9PiBfZmluaXNoVmlzaW9uSm9iKGNsaXBJZCksICAvLyBvbkVycm9yOiBjbGVhciB0aGUgaW4tZmxpZ2h0IGZsYWcgc28gdGhlIGJ1dHRvbiByZWNvdmVyc1xuICApO1xuICAvLyBzdGFydEpvYlVJIChpbnNpZGUgc3RyZWFtU1NFKSByZXNldCB0aGUgc2hhcmVkIGNhbmNlbCBjb25maWcgdG8gdGhlIGFuYWx5emVcbiAgLy8gZGVmYXVsdDsgb3ZlcnJpZGUgaXQgc28gdGhlIGhlYWRlciBDYW5jZWwgY29uZmlybXMgKyBQT1NUcyBmb3IgVEhJUyBqb2IuXG4gIHNldEpvYkNhbmNlbCh7XG4gICAgdXJsOiBgL2FwaS9jbGlwcy8ke2NsaXBJZH0vYW5hbHl6ZS1mcmFtZXMvY2FuY2VsYCxcbiAgICB0aXRsZTogJ1N0b3AgaW1hZ2UgYW5hbHlzaXM/JyxcbiAgICBib2R5OiAnVGhlIHdvcmsgc28gZmFyIGlzIGRpc2NhcmRlZC4gWW91IGNhbiBydW4gaW1hZ2UgYW5hbHlzaXMgYWdhaW4gYW55dGltZS4nLFxuICAgIGNvbmZpcm06ICdTdG9wIGFuYWx5c2lzJyxcbiAgICBsb2dNc2c6ICdbSW1hZ2UgYW5hbHlzaXMgY2FuY2VsbGVkXScsXG4gICAgb25DYW5jZWw6ICgpID0+IF9maW5pc2hWaXNpb25Kb2IoY2xpcElkKSxcbiAgfSk7XG59XG5cbi8vIOKUgOKUgCBob3Qtd29yZHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5jb25zdCBfSE9UV09SRF9NT0RFX0xBQkVMUyA9IHtleGFjdDogJ0V4YWN0JywgY2FzZV9pbnNlbnNpdGl2ZTogJ0lnbm9yZSBjYXNlJywgc2VtYW50aWM6ICdNZWFuaW5nJ307XG5cbmZ1bmN0aW9uIF9ob3R3b3JkRGV0YWlsSFRNTChjbGlwKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBjbGlwLmhvdHdvcmRfbWF0Y2hlcztcbiAgaWYgKCFtYXRjaGVzIHx8ICFtYXRjaGVzLmxlbmd0aCkgcmV0dXJuICcnO1xuICBjb25zdCBib29zdCA9IGNsaXAuaG90d29yZF9ib29zdCB8fCB7fTtcbiAgY29uc3QgYm9vc3RMaW5lID0gT2JqZWN0LmVudHJpZXMoYm9vc3QpXG4gICAgLmZpbHRlcigoWywgdl0pID0+IHYpXG4gICAgLm1hcCgoW3RhcmdldCwgdl0pID0+IGAke3RhcmdldH06ICR7diA+IDAgPyAnKycgOiAnJ30ke01hdGgucm91bmQodiAqIDEwMCl9JWApXG4gICAgLmpvaW4oJywgJyk7XG4gIHJldHVybiBgXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+PHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPkhvdC13b3Jkczwvc3Bhbj48L2Rpdj5cbiAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDo0cHg7Zm9udC1zaXplOjEycHhcIj5cbiAgICAgICAgJHttYXRjaGVzLm1hcChtID0+IGBcbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPHN0cm9uZz4ke2VzY0h0bWwobS5waHJhc2UpfTwvc3Ryb25nPlxuICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjp2YXIoLS1tdXRlZClcIj4gLSAke2VzY0h0bWwoX0hPVFdPUkRfTU9ERV9MQUJFTFNbbS5tb2RlXSB8fCBtLm1vZGUpfSR7bS5jb3VudCA+IDEgPyBgLCAke20uY291bnR9w5dgIDogJyd9PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PmApLmpvaW4oJycpfVxuICAgICAgICAke2Jvb3N0TGluZSA/IGA8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMXB4O21hcmdpbi10b3A6MnB4XCI+Qm9vc3QgYXBwbGllZDogJHtlc2NIdG1sKGJvb3N0TGluZSl9PC9kaXY+YCA6ICcnfVxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuLy8g4pSA4pSAIHNlbnNpdGl2ZSBjb250ZW50IChQcml2YWN5IFRlcm1zIC8gQ2Vuc29yIFdvcmRzKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmNvbnN0IF9TRU5TSVRJVkVfQ0FURUdPUllfTEFCRUxTID0ge3ByaXZhY3k6ICdQcml2YWN5IFRlcm0nLCBjZW5zb3I6ICdDZW5zb3IgV29yZCd9O1xuY29uc3QgX1NFTlNJVElWRV9NT0RFX0xBQkVMUyA9IHtleGFjdDogJ0V4YWN0JywgY2FzZV9pbnNlbnNpdGl2ZTogJ0lnbm9yZSBjYXNlJywgZnV6enk6ICdDbG9zZSBzcGVsbGluZyd9O1xuXG5mdW5jdGlvbiBfc2Vuc2l0aXZlRGV0YWlsSFRNTChjbGlwKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBjbGlwLnNlbnNpdGl2ZV9tYXRjaGVzO1xuICBpZiAoIW1hdGNoZXMgfHwgIW1hdGNoZXMubGVuZ3RoKSByZXR1cm4gJyc7XG4gIHJldHVybiBgXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGV0YWlsLWNhcmQtaGVhZGVyXCI+PHNwYW4gY2xhc3M9XCJkZXRhaWwtY2FyZC10aXRsZVwiPkZsYWdnZWQgdGVybXM8L3NwYW4+PC9kaXY+XG4gICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6NHB4O2ZvbnQtc2l6ZToxMnB4XCI+XG4gICAgICAgICR7bWF0Y2hlcy5tYXAobSA9PiBgXG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwic2Vuc2l0aXZlLWNhdGVnb3J5IHNlbnNpdGl2ZS1jYXRlZ29yeS0ke20uY2F0ZWdvcnl9XCI+JHtlc2NIdG1sKF9TRU5TSVRJVkVfQ0FURUdPUllfTEFCRUxTW20uY2F0ZWdvcnldIHx8IG0uY2F0ZWdvcnkpfTwvc3Bhbj5cbiAgICAgICAgICAgIDxzdHJvbmc+JHtlc2NIdG1sKG0ubWF0Y2hlZF90ZXh0KX08L3N0cm9uZz5cbiAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpXCI+IC0gJHtlc2NIdG1sKF9TRU5TSVRJVkVfTU9ERV9MQUJFTFNbbS5tb2RlXSB8fCBtLm1vZGUpfSR7bS5jb3VudCA+IDEgPyBgLCAke20uY291bnR9w5dgIDogJyd9PC9zcGFuPlxuICAgICAgICAgIDwvZGl2PmApLmpvaW4oJycpfVxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+YDtcbn1cblxuLy8g4pSA4pSAIGdlbmVyYXRlZCB0YWdzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUGlwZWxpbmUgdGFncyAoY2xpcC50YWdzKSBhcmUgaW50ZXJuYWwgdG9rZW5zOyBtYXAgdGhlbSB0byBkaXNwbGF5IG5hbWVzXG4vLyBiZWZvcmUgcmVuZGVyaW5nLiBudWxsID0gYm9va2tlZXBpbmcgbWFya2VyLCBoaWRkZW4gZnJvbSB0aGUgVUkgKHRoZSBTY29yaW5nXG4vLyBjYXJkIGFuZCBcIkxhc3Qgc2NvcmVkIHdpdGhcIiBhbHJlYWR5IGNvbnZleSB0aGF0IGEgc2NvcmVyIHJhbikuXG5jb25zdCBfR0VORVJBVEVEX1RBR19JTkZPID0ge1xuICBtYW51YWw6ICAgICAgICAgICAgICB7IG5hbWU6ICdNYW51YWxseSBjcmVhdGVkJywgdGlwOiAnWW91IGNyZWF0ZWQgdGhpcyBjbGlwIGJ5IGhhbmQsIG5vdCBhdXRvbWF0aWMgY2xpcCBnZW5lcmF0aW9uJyB9LFxuICBsbG1fZXJyb3I6ICAgICAgICAgICB7IG5hbWU6ICdTY29yZSBlcnJvcicsIHRpcDogJ0xMTSBzY29yaW5nIGZhaWxlZCBmb3IgdGhpcyBjbGlwIC0gUmUtc2NvcmUgdG8gcmV0cnknIH0sXG4gIGxsbV9ub190cmFuc2NyaXB0OiAgIHsgbmFtZTogJ05vIHNwZWVjaCB0byBzY29yZScsIHRpcDogXCJObyB0cmFuc2NyaXB0IHRleHQgaW4gdGhpcyBjbGlwJ3MgdGltZSByYW5nZSwgc28gTExNIHNjb3Jpbmcgd2FzIHNraXBwZWRcIiB9LFxuICBlbmVyZ3lfbm9fdHJhY2tzOiAgICB7IG5hbWU6ICdObyBhdWRpbyBkYXRhJywgdGlwOiAnTm8gYXVkaW8gdHJhY2sgd2FzIGF2YWlsYWJsZSBmb3IgZW5lcmd5IHNjb3JpbmcnIH0sXG4gIGVuZXJneV9ub19kYXRhOiAgICAgIHsgbmFtZTogJ05vIGF1ZGlvIGRhdGEnLCB0aXA6IFwiVGhlIGF1ZGlvIHRyYWNrIGhhZCBubyBkYXRhIGluIHRoaXMgY2xpcCdzIHRpbWUgcmFuZ2VcIiB9LFxuICBhZnRlcl9oYXJkX3NwbGl0OiAgICB7IG5hbWU6ICdBZnRlciBzcGxpdCcsIHRpcDogJ1RoaXMgY2xpcCBzdGFydHMgcmlnaHQgYWZ0ZXIgYSBzcGxpdCBwb2ludCcgfSxcbiAgbG9uZ19zaWxlbmNlX2JlZm9yZTogeyBuYW1lOiAnTG9uZyBwYXVzZSBiZWZvcmUnLCB0aXA6ICdBIGxvbmcgcXVpZXQgc3RyZXRjaCBjb21lcyByaWdodCBiZWZvcmUgdGhpcyBjbGlwJyB9LFxuICBub19zcGVlY2g6ICAgICAgICAgICB7IG5hbWU6ICdObyBkaWFsb2d1ZScsIHRpcDogJ05vIHNwb2tlbiBkaWFsb2d1ZSB3YXMgZGV0ZWN0ZWQgaW4gdGhpcyBjbGlwJyB9LFxuICB2aXN1YWw6ICAgICAgICAgICAgICB7IG5hbWU6ICdWaXN1YWwgaGlnaGxpZ2h0JywgdGlwOiAnQSBzaWxlbnQsIHZpc3VhbGx5IGFjdGl2ZSBtb21lbnQgZm91bmQgd2l0aG91dCBhbnkgZGlhbG9ndWUnIH0sXG4gIGxsbV9zY29yZWQ6IG51bGwsIGVuZXJneV9zY29yZWQ6IG51bGwsIHNjZW5lc19zY29yZWQ6IG51bGwsXG4gIGxhdWdoX3RyYW5zY3JpcHQ6IG51bGwsIGxhdWdoX2F1ZGlvOiBudWxsLCBsYXVnaF9tb2RlbDogbnVsbCxcbiAgbGF1Z2hfbm9fdHJhbnNjcmlwdDogbnVsbCwgbGF1Z2hfbm9fd2F2OiBudWxsLFxufTtcblxuZnVuY3Rpb24gX2dlbmVyYXRlZFRhZ1BpbGxzSFRNTCh0YWdzKSB7XG4gIGNvbnN0IHBpbGxzID0gKHRhZ3MgfHwgW10pLm1hcCh0b2tlbiA9PiB7XG4gICAgaWYgKF9HRU5FUkFURURfVEFHX0lORk9bdG9rZW5dID09PSBudWxsKSByZXR1cm4gJyc7XG4gICAgbGV0IGluZm8gPSBfR0VORVJBVEVEX1RBR19JTkZPW3Rva2VuXTtcbiAgICBjb25zdCBzaWxlbmNlID0gL15hZnRlcl9zaWxlbmNlXyhcXGQrKXMkLy5leGVjKHRva2VuKTtcbiAgICBpZiAoc2lsZW5jZSkgaW5mbyA9IHsgbmFtZTogYEFmdGVyICR7c2lsZW5jZVsxXX0gcyBzaWxlbmNlYCwgdGlwOiBgVGhpcyBjbGlwIHN0YXJ0cyBhZnRlciBhYm91dCAke3NpbGVuY2VbMV19IHNlY29uZHMgb2Ygc2lsZW5jZWAgfTtcbiAgICBpZiAoIWluZm8pIGluZm8gPSB7IG5hbWU6IHRva2VuLnJlcGxhY2UoL18vZywgJyAnKSwgdGlwOiAnRGV0ZWN0ZWQgZHVyaW5nIGFuYWx5c2lzJyB9O1xuICAgIHJldHVybiBgPHNwYW4gY2xhc3M9XCJ0YWdcIiB0aXRsZT1cIiR7ZXNjSHRtbChpbmZvLnRpcCl9XCI+JHtlc2NIdG1sKGluZm8ubmFtZSl9PC9zcGFuPmA7XG4gIH0pLmZpbHRlcihCb29sZWFuKTtcbiAgcmV0dXJuIHBpbGxzLmxlbmd0aCA/IGA8ZGl2IGNsYXNzPVwidGFnc1wiIHN0eWxlPVwibWFyZ2luLXRvcDo4cHhcIj4ke3BpbGxzLmpvaW4oJycpfTwvZGl2PmAgOiAnJztcbn1cblxuLy8g4pSA4pSAIHVzZXIgdGFncyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRhZyB2YWx1ZXMgY2FuIGNvbnRhaW4gcXVvdGVzL3NwYWNlcywgc28gdGhlIHJlbW92ZSBidXR0b25zIHVzZSBkYXRhLSogK1xuLy8gZXZlbnQgZGVsZWdhdGlvbiAoc2VlIHRoZSAjZGV0YWlsIGxpc3RlbmVyIGJlbG93KSwgbmV2ZXIgaW5saW5lIG9uY2xpY2suXG5mdW5jdGlvbiBfY2xpcFRhZ1BpbGxzSFRNTCh0YWdzKSB7XG4gIGlmICghdGFncyB8fCAhdGFncy5sZW5ndGgpIHJldHVybiAnPHNwYW4gY2xhc3M9XCJ0YWdzLWVtcHR5XCI+Tm8gdGFncyB5ZXQ8L3NwYW4+JztcbiAgcmV0dXJuIHRhZ3MubWFwKHQgPT5cbiAgICBgPHNwYW4gY2xhc3M9XCJ1c2VyLXRhZ1wiPiR7ZXNjSHRtbCh0KX08YnV0dG9uIGNsYXNzPVwidXNlci10YWcteFwiIGRhdGEtcmVtb3ZlLXRhZz1cIiR7ZXNjSHRtbCh0KX1cIlxuICAgICAgIHRpdGxlPVwiUmVtb3ZlIHRhZ1wiIGFyaWEtbGFiZWw9XCJSZW1vdmUgdGFnICR7ZXNjSHRtbCh0KX1cIj4mdGltZXM7PC9idXR0b24+PC9zcGFuPmBcbiAgKS5qb2luKCcnKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2xvYWRUYWdTdWdnZXN0aW9ucygpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgZmV0Y2goJy9hcGkvdGFncycpLnRoZW4ociA9PiByLmpzb24oKSk7XG4gICAgQXBwU3RhdGUuYWxsVGFncyA9IEFycmF5LmlzQXJyYXkoZGF0YS50YWdzKSA/IGRhdGEudGFncyA6IFtdO1xuICB9IGNhdGNoIChfKSB7IEFwcFN0YXRlLmFsbFRhZ3MgPSBBcHBTdGF0ZS5hbGxUYWdzIHx8IFtdOyB9XG59XG5cbmZ1bmN0aW9uIF9yZW5kZXJUYWdEYXRhbGlzdCgpIHtcbiAgY29uc3QgZGwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC10YWdzLWRhdGFsaXN0Jyk7XG4gIGlmICghZGwpIHJldHVybjtcbiAgZGwuaW5uZXJIVE1MID0gKEFwcFN0YXRlLmFsbFRhZ3MgfHwgW10pLm1hcCh0ID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2NIdG1sKHQpfVwiPmApLmpvaW4oJycpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfc2F2ZUNsaXBUYWdzKGNsaXBJZCwgdGFncykge1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS9jbGlwcy8ke2NsaXBJZH0vdGFnc2AsIHtcbiAgICBtZXRob2Q6ICdQVVQnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3RhZ3N9KSxcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB7IHNob3dUb2FzdCgnQ291bGQgbm90IHNhdmUgdGFncycsICdlcnJvcicpOyByZXR1cm4gbnVsbDsgfVxuICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhICYmIEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhLmlkID09PSBjbGlwSWQpIHtcbiAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YS51c2VyX3RhZ3MgPSBkYXRhLnVzZXJfdGFncztcbiAgfVxuICBhd2FpdCBfbG9hZFRhZ1N1Z2dlc3Rpb25zKCk7XG4gIF9yZW5kZXJUYWdEYXRhbGlzdCgpO1xuICByZXR1cm4gZGF0YS51c2VyX3RhZ3M7XG59XG5cbmZ1bmN0aW9uIF9jdXJyZW50Q2xpcFRhZ3MoKSB7XG4gIHJldHVybiAoQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGEgJiYgQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGEudXNlcl90YWdzKSB8fCBbXTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2FkZENsaXBUYWcoY2xpcElkLCByYXcpIHtcbiAgY29uc3QgdGFnID0gKHJhdyB8fCAnJykudHJpbSgpO1xuICBpZiAoIXRhZykgcmV0dXJuO1xuICBjb25zdCBjdXIgPSBfY3VycmVudENsaXBUYWdzKCk7XG4gIGlmIChjdXIuc29tZSh0ID0+IHQudG9Mb3dlckNhc2UoKSA9PT0gdGFnLnRvTG93ZXJDYXNlKCkpKSByZXR1cm47ICAvLyBkZWR1cGUgY2xpZW50LXNpZGVcbiAgY29uc3QgdXBkYXRlZCA9IGF3YWl0IF9zYXZlQ2xpcFRhZ3MoY2xpcElkLCBbLi4uY3VyLCB0YWddKTtcbiAgaWYgKHVwZGF0ZWQpIF9yZXJlbmRlckNsaXBUYWdzKHVwZGF0ZWQpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfcmVtb3ZlQ2xpcFRhZyhjbGlwSWQsIHRhZykge1xuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgX3NhdmVDbGlwVGFncyhjbGlwSWQsIF9jdXJyZW50Q2xpcFRhZ3MoKS5maWx0ZXIodCA9PiB0ICE9PSB0YWcpKTtcbiAgaWYgKHVwZGF0ZWQpIF9yZXJlbmRlckNsaXBUYWdzKHVwZGF0ZWQpO1xufVxuXG5mdW5jdGlvbiBfcmVyZW5kZXJDbGlwVGFncyh0YWdzKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtdXNlci10YWdzJyk7XG4gIGlmIChlbCkgZWwuaW5uZXJIVE1MID0gX2NsaXBUYWdQaWxsc0hUTUwodGFncyk7XG59XG5cbi8vIEV2ZW50IGRlbGVnYXRpb24gb24gdGhlIHBlcnNpc3RlbnQgI2RldGFpbCBlbGVtZW50IChpdHMgaW5uZXJIVE1MIGlzIHJlcGxhY2VkXG4vLyBlYWNoIHJlbmRlciwgc28gcGVyLXJvdyBoYW5kbGVycyB3b3VsZCBiZSBsb3N0IC0gdGhlIGNvbnRhaW5lciBsaXN0ZW5lciBpc24ndCkuXG4vLyBXaXJlZCBvbmNlIGF0IG1vZHVsZSBsb2FkLCBzYW1lIGFzIHZpZGVvcy5qcydzIG93biAjZGV0YWlsIGxpc3RlbmVyIC0gYm90aFxuLy8gY29leGlzdCBzaW5jZSB0aGV5IHJlYWN0IHRvIGRpc2pvaW50IGRhdGEtYWN0L2RhdGEtKiBuYW1lc3BhY2VzLlxuZnVuY3Rpb24gX2hhbmRsZURldGFpbENsaWNrKGUpIHtcbiAgY29uc3QgbWVyZ2UgPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1tZXJnZS1iXScpO1xuICBpZiAobWVyZ2UpIHtcbiAgICBtZXJnZUNsaXBzKE51bWJlcihtZXJnZS5kYXRhc2V0Lm1lcmdlQSksIE51bWJlcihtZXJnZS5kYXRhc2V0Lm1lcmdlQiksIG1lcmdlLmRhdGFzZXQubWVyZ2VEaXIpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBybSA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLXJlbW92ZS10YWddJyk7XG4gIGlmIChybSAmJiBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpIHsgX3JlbW92ZUNsaXBUYWcoQXBwU3RhdGUuYWN0aXZlQ2xpcElkLCBybS5kYXRhc2V0LnJlbW92ZVRhZyk7IHJldHVybjsgfVxuICBjb25zdCBjb3B5ID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtY29weV0nKTtcbiAgaWYgKGNvcHkgJiYgQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGEpIHtcbiAgICBpZiAoY29weS5kYXRhc2V0LmNvcHkgPT09ICdkZXNjcmlwdGlvbicpIGNvcHlUZXh0KEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhLmRlc2NyaXB0aW9uLCAnRGVzY3JpcHRpb24nKTtcbiAgICBlbHNlIGlmIChjb3B5LmRhdGFzZXQuY29weSA9PT0gJ3RyYW5zY3JpcHQnKSBjb3B5VGV4dChBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YS50cmFuc2NyaXB0X2V4Y2VycHQsICdUcmFuc2NyaXB0Jyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGZvcm1hdEJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWV4cG9ydC1hY3Rpb25dJyk7XG4gIGlmIChmb3JtYXRCdG4pIHtcbiAgICBjb25zdCByb3cgPSBmb3JtYXRCdG4uY2xvc2VzdCgnLmV4cG9ydC1mb3JtYXQtcm93Jyk7XG4gICAgaWYgKHJvdykgd2luZG93Ll9oYW5kbGVFeHBvcnRGb3JtYXRBY3Rpb24oZm9ybWF0QnRuLmRhdGFzZXQuZXhwb3J0QWN0aW9uLCByb3cuZGF0YXNldCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IGFjdCA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWFjdF0nKTtcbiAgaWYgKCFhY3QpIHJldHVybjtcbiAgY29uc3QgY2xpcElkID0gTnVtYmVyKGFjdC5kYXRhc2V0LmNsaXBJZCk7XG4gIHN3aXRjaCAoYWN0LmRhdGFzZXQuYWN0KSB7XG4gICAgY2FzZSAnZXhwb3J0LWNsaXAnOiB3aW5kb3cuZXhwb3J0Q2xpcChjbGlwSWQpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWxsbS1zZXR0aW5ncyc6XG4gICAgICB3aW5kb3cub3BlblNldHRpbmdzKCk7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5fc2Nyb2xsVG9TZXR0aW5nc1NlY3Rpb24oJ3NldHRpbmdzLXNlYy1sbG0nKSwgMTIwKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2NsZWFyLXNjb3JlLW92ZXJyaWRlJzogY2xlYXJTY29yZU92ZXJyaWRlKGNsaXBJZCk7IGJyZWFrO1xuICAgIGNhc2UgJ29wZW4tc2NvcmUtb3ZlcnJpZGUnOiBvcGVuU2NvcmVPdmVycmlkZShjbGlwSWQpOyBicmVhaztcbiAgICBjYXNlICdzZXQtc3RhdHVzJzogc2V0U3RhdHVzKGNsaXBJZCwgYWN0LmRhdGFzZXQuc3RhdHVzKTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi1jbGlwLWFjdGlvbnMtbW9kYWwnOiBvcGVuQ2xpcEFjdGlvbnNNb2RhbChjbGlwSWQpOyBicmVhaztcbiAgICBjYXNlICdvcGVuLWRlc2MtbG9uZy1rZWJhYic6IG9wZW5EZXNjTG9uZ0tlYmFiKGNsaXBJZCwgYWN0KTsgYnJlYWs7XG4gICAgY2FzZSAnb3Blbi1kZXNjLWtlYmFiJzogb3BlbkRlc2NLZWJhYihjbGlwSWQsIGFjdCk7IGJyZWFrO1xuICAgIGNhc2UgJ29wZW4tZXhwb3J0LWVkaXRvcic6IHdpbmRvdy5vcGVuRXhwb3J0RWRpdG9yKGNsaXBJZCk7IGJyZWFrO1xuICAgIGNhc2UgJ3NlbGVjdC1yZWxhdGVkLWNsaXAnOiBlLnByZXZlbnREZWZhdWx0KCk7IHNlbGVjdENsaXAoY2xpcElkKTsgYnJlYWs7XG4gICAgY2FzZSAncmVzY29yZS1jbGlwJzogd2luZG93LnJlc2NvcmVDbGlwKGNsaXBJZCk7IGJyZWFrO1xuICAgIGNhc2UgJ2FuYWx5emUtZnJhbWVzJzogYW5hbHl6ZUZyYW1lcyhjbGlwSWQpOyBicmVhaztcbiAgfVxufVxuXG5mdW5jdGlvbiBfaGFuZGxlRGV0YWlsS2V5ZG93bihlKSB7XG4gIGNvbnN0IGlucHV0ID0gZS50YXJnZXQuY2xvc2VzdCgnI2NsaXAtdGFnLWlucHV0Jyk7XG4gIGlmICghaW5wdXQpIHJldHVybjtcbiAgaWYgKGUua2V5ID09PSAnRW50ZXInIHx8IGUua2V5ID09PSAnLCcpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgY29uc3QgdmFsdWUgPSBpbnB1dC52YWx1ZTtcbiAgICBpbnB1dC52YWx1ZSA9ICcnO1xuICAgIGlmIChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpIF9hZGRDbGlwVGFnKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCwgdmFsdWUpO1xuICB9XG59XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZXRhaWwnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIF9oYW5kbGVEZXRhaWxDbGljayk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJykuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIF9oYW5kbGVEZXRhaWxLZXlkb3duKTtcblxuZnVuY3Rpb24gc2NvcmVSb3cobGFiZWwsIHZhbCwgY2xzKSB7XG4gIHJldHVybiBgXG4gICAgPHNwYW4gY2xhc3M9XCJzY29yZS1sYWJlbFwiPiR7bGFiZWx9PC9zcGFuPlxuICAgIDxkaXYgY2xhc3M9XCJzY29yZS1iYXItd3JhcFwiPjxkaXYgY2xhc3M9XCJzY29yZS1iYXIgYmFyLSR7Y2xzfVwiIHN0eWxlPVwid2lkdGg6JHsodmFsKjEwMCkudG9GaXhlZCgxKX0lXCI+PC9kaXY+PC9kaXY+XG4gICAgPHNwYW4gY2xhc3M9XCJzY29yZS12YWxcIiBzdHlsZT1cImNvbG9yOnZhcigtLSR7Y2xzfSlcIj4ke01hdGgucm91bmQodmFsKjEwMCl9JTwvc3Bhbj5gO1xufVxuXG5mdW5jdGlvbiBzY29yZVJvd092ZXJyaWRlKGxhYmVsLCBsbG1WYWwsIHVzZXJWYWwsIGNscykge1xuICByZXR1cm4gYFxuICAgIDxzcGFuIGNsYXNzPVwic2NvcmUtbGFiZWxcIj4ke2xhYmVsfSA8c3BhbiBjbGFzcz1cInNjb3JlLW92ZXJyaWRlLWJhZGdlXCI+b3ZlcnJpZGU8L3NwYW4+PC9zcGFuPlxuICAgIDxkaXYgY2xhc3M9XCJzY29yZS1iYXItd3JhcFwiPlxuICAgICAgPGRpdiBjbGFzcz1cInNjb3JlLWJhciBiYXItJHtjbHN9XCIgc3R5bGU9XCJ3aWR0aDokeyh1c2VyVmFsKjEwMCkudG9GaXhlZCgxKX0lO29wYWNpdHk6LjVcIj48L2Rpdj5cbiAgICA8L2Rpdj5cbiAgICA8c3BhbiBjbGFzcz1cInNjb3JlLXZhbFwiIHN0eWxlPVwiY29sb3I6dmFyKC0tJHtjbHN9KVwiPiR7TWF0aC5yb3VuZCh1c2VyVmFsKjEwMCl9JSA8c3BhbiBzdHlsZT1cImNvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTBweFwiPihMTE06ICR7TWF0aC5yb3VuZChsbG1WYWwqMTAwKX0lKTwvc3Bhbj48L3NwYW4+YDtcbn1cblxuZnVuY3Rpb24gX21lcmdlTmVpZ2hib3JzKGNsaXApIHtcbiAgY29uc3QgYnlUaW1lID0gWy4uLkFwcFN0YXRlLmNsaXBzXS5zb3J0KChhLCBiKSA9PiBhLnN0YXJ0X21zIC0gYi5zdGFydF9tcyk7XG4gIGNvbnN0IGlkeCA9IGJ5VGltZS5maW5kSW5kZXgoYyA9PiBjLmlkID09PSBjbGlwLmlkKTtcbiAgcmV0dXJuIHtcbiAgICBwcmV2OiBpZHggPiAwID8gYnlUaW1lW2lkeCAtIDFdIDogbnVsbCxcbiAgICBuZXh0OiBpZHggPj0gMCAmJiBpZHggPCBieVRpbWUubGVuZ3RoIC0gMSA/IGJ5VGltZVtpZHggKyAxXSA6IG51bGwsXG4gIH07XG59XG5cbmZ1bmN0aW9uIG9wZW5DbGlwQWN0aW9uc01vZGFsKGNsaXBJZCkge1xuICBjb25zdCBjbGlwID0gQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGE/LmlkID09PSBjbGlwSWQgPyBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YSA6IEFwcFN0YXRlLmNsaXBzLmZpbmQoYyA9PiBjLmlkID09PSBjbGlwSWQpO1xuICBpZiAoIWNsaXApIHJldHVybjtcbiAgY29uc3QgeyBwcmV2LCBuZXh0IH0gPSBfbWVyZ2VOZWlnaGJvcnMoY2xpcCk7XG5cbiAgY29uc3QgZ3JvdXBzID0gW107XG5cbiAgY29uc3Qgc2NvcmluZ1Jvd3MgPSBbXG4gICAgeyBsYWJlbDogJ1JlLXNjb3JlJywgZGVzY3JpcHRpb246ICdSZS1ydW4gc2NvcmluZyBhbmQgZGVzY3JpcHRpb24gZ2VuZXJhdGlvbiBmb3IgdGhpcyBjbGlwLicsIGFjdGlvbjogKCkgPT4gd2luZG93LnJlc2NvcmVDbGlwQ2hvb3NlKGNsaXBJZCkgfSxcbiAgXTtcbiAgaWYgKGNsaXAuc2NvcmVfb3ZlcmFsbF91c2VyICE9IG51bGwpIHtcbiAgICBzY29yaW5nUm93cy5wdXNoKHsgbGFiZWw6ICdSZW1vdmUgT3ZlcnJpZGUnLCBkZXNjcmlwdGlvbjogJ0Rpc2NhcmQgdGhlIG1hbnVhbCBzY29yZSBhbmQgZ28gYmFjayB0byB0aGUgZ2VuZXJhdGVkIHNjb3JlLicsIGFjdGlvbjogKCkgPT4gY2xlYXJTY29yZU92ZXJyaWRlKGNsaXBJZCkgfSk7XG4gIH0gZWxzZSB7XG4gICAgc2NvcmluZ1Jvd3MucHVzaCh7IGxhYmVsOiAnT3ZlcnJpZGUgU2NvcmUnLCBkZXNjcmlwdGlvbjogJ01hbnVhbGx5IHNldCB0aGUgb3ZlcmFsbCBzY29yZSBpbnN0ZWFkIG9mIHVzaW5nIHRoZSBnZW5lcmF0ZWQgc2NvcmUuJywgYWN0aW9uOiAoKSA9PiBvcGVuU2NvcmVPdmVycmlkZShjbGlwSWQpIH0pO1xuICB9XG4gIGdyb3Vwcy5wdXNoKHsgaGVhZGluZzogJ1Njb3JpbmcnLCByb3dzOiBzY29yaW5nUm93cyB9KTtcblxuICBncm91cHMucHVzaCh7IGhlYWRpbmc6ICdUcmFuc2NyaXB0Jywgcm93czogW1xuICAgIHsgbGFiZWw6ICdSZXRyYW5zY3JpYmUnLCBkZXNjcmlwdGlvbjogXCJSZS1ydW4gdHJhbnNjcmlwdGlvbiBmb3IganVzdCB0aGlzIGNsaXAncyB0aW1lIHJhbmdlLlwiLCBhY3Rpb246ICgpID0+IHdpbmRvdy5vcGVuUmV0cmFuc2NyaWJlTW9kYWwoY2xpcElkKSB9LFxuICBdfSk7XG5cbiAgaWYgKGNsaXAuZGVzY3JpcHRpb25fbG9uZyB8fCBjbGlwLmRlc2NyaXB0aW9uKSB7XG4gICAgZ3JvdXBzLnB1c2goeyBoZWFkaW5nOiAnRGlzY292ZXInLCByb3dzOiBbXG4gICAgICB7IGxhYmVsOiAnRmluZCBTaW1pbGFyJywgZGVzY3JpcHRpb246ICdTZWFyY2ggb3RoZXIgcmVjb3JkaW5ncyBmb3IgY2xpcHMgd2l0aCBhIHNpbWlsYXIgZGVzY3JpcHRpb24uJywgYWN0aW9uOiAoKSA9PiBvcGVuU2ltaWxhckNsaXBzTW9kYWwoY2xpcElkKSB9LFxuICAgIF19KTtcbiAgfVxuXG4gIGlmIChjbGlwLmhhc19leHBvcnQpIHtcbiAgICBjb25zdCBtdWx0aUZvcm1hdCA9IChjbGlwLmV4cG9ydHMgfHwgW10pLmZpbHRlcihlID0+IGUuZXhpc3RzKS5sZW5ndGggPiAxO1xuICAgIGNvbnN0IGZpbGVSb3dzID0gW107XG4gICAgaWYgKEFwcFN0YXRlLmFjdGl2ZU1lZGlhRmlsZW5hbWUpIHtcbiAgICAgIGZpbGVSb3dzLnB1c2goeyBsYWJlbDogJ0Rvd25sb2FkIEV4cG9ydCcsIGRlc2NyaXB0aW9uOiBgU2F2ZSAke211bHRpRm9ybWF0ID8gJ2V2ZXJ5IGV4cG9ydGVkIGZvcm1hdCcgOiAndGhlIGV4cG9ydGVkIGZpbGUnfSAoYW5kIGFueSBjYXB0aW9uIHNpZGVjYXJzKSB0byB5b3VyIGRvd25sb2Fkcy5gLCBhY3Rpb246ICgpID0+IHdpbmRvdy5fZG93bmxvYWRDbGlwRXhwb3J0KGNsaXBJZCkgfSk7XG4gICAgfVxuICAgIGZpbGVSb3dzLnB1c2goeyBsYWJlbDogJ0NvcHkgRmlsZSBQYXRoKHMpJywgZGVzY3JpcHRpb246IGBDb3B5IHRoZSBmdWxsIHBhdGggb2YgJHttdWx0aUZvcm1hdCA/ICdldmVyeSBleHBvcnRlZCBmb3JtYXQnIDogJ3RoZSBleHBvcnRlZCBmaWxlJ30gKGFuZCBhbnkgY2FwdGlvbiBzaWRlY2FycykgdG8geW91ciBjbGlwYm9hcmQuYCwgYWN0aW9uOiAoKSA9PiB3aW5kb3cuX2NvcHlDbGlwRXhwb3J0UGF0aHMoY2xpcElkKSB9KTtcbiAgICBpZiAoQXBwU3RhdGUuY2FuUmV2ZWFsKSB7XG4gICAgICBmaWxlUm93cy5wdXNoKHsgbGFiZWw6ICdTaG93IGluIEZvbGRlcicsIGRlc2NyaXB0aW9uOiAnT3BlbiB0aGUgZXhwb3J0cyBmb2xkZXIgd2l0aCB0aGlzIGZpbGUgc2VsZWN0ZWQuJywgYWN0aW9uOiAoKSA9PiB3aW5kb3cuX3JldmVhbENsaXBFeHBvcnQoY2xpcElkKSB9KTtcbiAgICB9XG4gICAgZmlsZVJvd3MucHVzaCh7IGxhYmVsOiAnRGVsZXRlIEFsbCBFeHBvcnRzJywgZGVzY3JpcHRpb246IGBEZWxldGUgJHttdWx0aUZvcm1hdCA/ICdldmVyeSBleHBvcnRlZCBmb3JtYXQnIDogJ3RoZSBleHBvcnRlZCB2aWRlbyBmaWxlJ30gYnV0IGtlZXAgdGhlIGNsaXAgcmVjb3JkLiBVc2UgdGhlIEV4cG9ydCBzZWN0aW9uIHRvIGRlbGV0ZSBvbmUgZm9ybWF0IGF0IGEgdGltZS5gLCBkYW5nZXI6IHRydWUsIGFjdGlvbjogKCkgPT4gZGVsZXRlRXhwb3J0KGNsaXBJZCkgfSk7XG4gICAgZ3JvdXBzLnB1c2goeyBoZWFkaW5nOiAnRmlsZXMnLCByb3dzOiBmaWxlUm93cyB9KTtcbiAgfVxuXG4gIGlmIChwcmV2IHx8IG5leHQpIHtcbiAgICBjb25zdCBtZXJnZVJvd3MgPSBbXTtcbiAgICBjb25zdCBtZXJnZURlc2MgPSAobmVpZ2hib3IpID0+IHRydW5jYXRlKG5laWdoYm9yLmRlc2NyaXB0aW9uIHx8ICdubyBkZXNjcmlwdGlvbiB5ZXQnLCA2MCk7XG4gICAgaWYgKHByZXYpIG1lcmdlUm93cy5wdXNoKHsgbGFiZWw6ICfihpAgTWVyZ2UgcHJldmlvdXMnLCBkZXNjcmlwdGlvbjogYENvbWJpbmUgd2l0aCBjbGlwICMke3ByZXYuaWR9IChcIiR7bWVyZ2VEZXNjKHByZXYpfVwiKSwgd2hpY2ggc3RhcnRzIGF0ICR7cHJldi5zdGFydF9obXN9LmAsIGFjdGlvbjogKCkgPT4gbWVyZ2VDbGlwcyhjbGlwSWQsIHByZXYuaWQsICdwcmV2JykgfSk7XG4gICAgaWYgKG5leHQpIG1lcmdlUm93cy5wdXNoKHsgbGFiZWw6ICdNZXJnZSBuZXh0IOKGkicsIGRlc2NyaXB0aW9uOiBgQ29tYmluZSB3aXRoIGNsaXAgIyR7bmV4dC5pZH0gKFwiJHttZXJnZURlc2MobmV4dCl9XCIpLCB3aGljaCBzdGFydHMgYXQgJHtuZXh0LnN0YXJ0X2htc30uYCwgYWN0aW9uOiAoKSA9PiBtZXJnZUNsaXBzKGNsaXBJZCwgbmV4dC5pZCwgJ25leHQnKSB9KTtcbiAgICBncm91cHMucHVzaCh7IGhlYWRpbmc6ICdNZXJnZScsIHJvd3M6IG1lcmdlUm93cyB9KTtcbiAgfVxuXG4gIGdyb3Vwcy5wdXNoKHsgaGVhZGluZzogJ0RhbmdlciBab25lJywgcm93czogW1xuICAgIHsgbGFiZWw6ICdEZWxldGUgQ2xpcCcsIGRlc2NyaXB0aW9uOiAnUGVybWFuZW50bHkgcmVtb3ZlIHRoaXMgY2xpcCByZWNvcmQgYW5kIGl0cyBleHBvcnRlZCBmaWxlLicsIGRhbmdlcjogdHJ1ZSwgYWN0aW9uOiAoKSA9PiBkZWxldGVDbGlwKGNsaXBJZCkgfSxcbiAgXX0pO1xuXG4gIG9wZW5BY3Rpb25zTW9kYWwoYENsaXAgIyR7Y2xpcC5pZH0gLSBBZGRpdGlvbmFsIEFjdGlvbnNgLCBncm91cHMpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfcmVsb2FkQ2xpcExpc3QodmlkZW9JZCkge1xuICBpZiAoIXZpZGVvSWQpIHJldHVybjtcbiAgQXBwU3RhdGUuY2xpcHMgPSBhd2FpdCBmZXRjaChfY2xpcHNMaXN0VXJsKHZpZGVvSWQpKS50aGVuKHIgPT4gci5qc29uKCkpO1xuICBfcmVuZGVyQ2xpcHMoKTtcbn1cblxuZnVuY3Rpb24gX3JlcGxhY2VDbGlwSW5MaXN0KHVwZGF0ZWQpIHtcbiAgY29uc3QgaWR4ID0gQXBwU3RhdGUuY2xpcHMuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gdXBkYXRlZC5pZCk7XG4gIGlmIChpZHggIT09IC0xKSBBcHBTdGF0ZS5jbGlwc1tpZHhdID0gdXBkYXRlZDtcbn1cblxuLy8g4pSA4pSAIHNjb3JlIG92ZXJyaWRlICYgbWVyZ2Ug4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX3Njb3JlT3ZlcnJpZGVDbGlwSWQgPSBudWxsO1xubGV0IF9zY29yZU92ZXJyaWRlT3BlbmVyID0gbnVsbDtcblxuZnVuY3Rpb24gb3BlblNjb3JlT3ZlcnJpZGUoY2xpcElkKSB7XG4gIF9zY29yZU92ZXJyaWRlT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgY29uc3QgY2xpcCA9IEFwcFN0YXRlLmNsaXBzLmZpbmQoYyA9PiBjLmlkID09PSBjbGlwSWQpO1xuICBjb25zdCBjdXJyZW50ID0gY2xpcD8uc2NvcmVfb3ZlcmFsbCA/PyAwLjU7XG4gIF9zY29yZU92ZXJyaWRlQ2xpcElkID0gY2xpcElkO1xuICBjb25zdCBzbGlkZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NvcmUtb3ZlcnJpZGUtc2xpZGVyJyk7XG4gIHNsaWRlci52YWx1ZSA9IGN1cnJlbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY29yZS1vdmVycmlkZS1kaXNwbGF5JykudGV4dENvbnRlbnQgPSBNYXRoLnJvdW5kKGN1cnJlbnQqMTAwKSArICclJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njb3JlLW92ZXJyaWRlLWxsbS1ub3RlJykudGV4dENvbnRlbnQgPSBgQ3VycmVudCBhdXRvIHNjb3JlOiAke01hdGgucm91bmQoY3VycmVudCoxMDApfSVgO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NvcmUtb3ZlcnJpZGUtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njb3JlLW92ZXJyaWRlLXNsaWRlcicpPy5mb2N1cygpLCA1MCk7XG59XG5cbmZ1bmN0aW9uIGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2NvcmUtb3ZlcnJpZGUtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIF9zY29yZU92ZXJyaWRlQ2xpcElkID0gbnVsbDtcbiAgY29uc3Qgb3BlbmVyID0gX3Njb3JlT3ZlcnJpZGVPcGVuZXI7XG4gIF9zY29yZU92ZXJyaWRlT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfc2NvcmVPdmVycmlkZVNhdmUoKSB7XG4gIGNvbnN0IGNsaXBJZCA9IF9zY29yZU92ZXJyaWRlQ2xpcElkO1xuICBjb25zdCBudW0gPSBwYXJzZUZsb2F0KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY29yZS1vdmVycmlkZS1zbGlkZXInKS52YWx1ZSk7XG4gIGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcElkfS9zY29yZS1vdmVycmlkZWAsIHtcbiAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtzY29yZV9vdmVyYWxsX3VzZXI6IG51bX0pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHsgc2hvd1RvYXN0KCdGYWlsZWQgdG8gc2V0IHNjb3JlIG92ZXJyaWRlJywgJ2Vycm9yJyk7IHJldHVybjsgfVxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgX3JlcGxhY2VDbGlwSW5MaXN0KHVwZGF0ZWQpO1xuICByZW5kZXJEZXRhaWwodXBkYXRlZCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNsZWFyU2NvcmVPdmVycmlkZShjbGlwSWQpIHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvY2xpcHMvJHtjbGlwSWR9L3Njb3JlLW92ZXJyaWRlYCwge1xuICAgIG1ldGhvZDogJ1BPU1QnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe3Njb3JlX292ZXJhbGxfdXNlcjogbnVsbH0pLFxuICB9KTtcbiAgaWYgKCFyZXMub2spIHsgc2hvd1RvYXN0KCdGYWlsZWQgdG8gY2xlYXIgb3ZlcnJpZGUnLCAnZXJyb3InKTsgcmV0dXJuOyB9XG4gIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCByZXMuanNvbigpO1xuICBfcmVwbGFjZUNsaXBJbkxpc3QodXBkYXRlZCk7XG4gIHJlbmRlckRldGFpbCh1cGRhdGVkKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbWVyZ2VDbGlwcyhjbGlwQUlkLCBjbGlwQklkLCBkaXJlY3Rpb24pIHtcbiAgY29uc3QgbGFiZWwgPSBkaXJlY3Rpb24gPT09ICdwcmV2JyA/ICdwcmV2aW91cycgOiAnbmV4dCc7XG4gIHNob3dDb25maXJtKFxuICAgICdNZXJnZSBjbGlwcz8nLFxuICAgIGBNZXJnZSB0aGlzIGNsaXAgd2l0aCB0aGUgJHtsYWJlbH0gY2xpcD8gVGhlIG1lcmdlZCBjbGlwIHdpbGwgc3BhbiBib3RoIHRpbWUgcmFuZ2VzLiBUaGlzIGNhbm5vdCBiZSB1bmRvbmUuYCxcbiAgICAnTWVyZ2UnLFxuICAgICgpID0+IF9kb01lcmdlQ2xpcHMoY2xpcEFJZCwgY2xpcEJJZCksXG4gICAgdHJ1ZSxcbiAgKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gX2RvTWVyZ2VDbGlwcyhjbGlwQUlkLCBjbGlwQklkKSB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcEFJZH0vbWVyZ2VgLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7Y2xpcF9iX2lkOiBjbGlwQklkfSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgeyBjb25zdCBlID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKT0+KHt9KSk7IHNob3dUb2FzdChlLmRldGFpbCB8fCAnTWVyZ2UgZmFpbGVkJywgJ2Vycm9yJyk7IHJldHVybjsgfVxuICBjb25zdCB1cGRhdGVkID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgQXBwU3RhdGUuY2xpcHMgPSBBcHBTdGF0ZS5jbGlwcy5maWx0ZXIoYyA9PiBjLmlkICE9PSBjbGlwQklkKTtcbiAgX3JlcGxhY2VDbGlwSW5MaXN0KHVwZGF0ZWQpO1xuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBjbGlwQUlkO1xuICBfcmVuZGVyQ2xpcHMoKTtcbiAgcmVuZGVyRGV0YWlsKHVwZGF0ZWQpO1xuICBzaG93VG9hc3QoJ0NsaXBzIG1lcmdlZCcpO1xufVxuXG4vLyBNaXJyb3JzIERFRkFVTFRfT1ZFUkxBUF9USFJFU0hPTEQgaW4gc2NvcmluZy9kZWR1cC5weS4gVGhlIGR1cmFibGUgZmxhZy9iYWRnZVxuLy8gY29tZXMgZnJvbSBhIHNlcnZlciBzY2FuICh0aGUgJ3Bvc3NpYmxlX2R1cGxpY2F0ZScgdGFnKTsgdGhpcyByZWNvbXB1dGVzIHRoZVxuLy8gc3BlY2lmaWMgb3ZlcmxhcHBpbmcgcGFydG5lciBjbGllbnQtc2lkZSBzbyB0aGUgZGV0YWlsIHBhbmVsIGNhbiBuYW1lIGl0IGFuZFxuLy8gb2ZmZXIgYSBvbmUtY2xpY2sgbWVyZ2Ugd2l0aG91dCBkZXBlbmRpbmcgb24gdGhlIGxhc3Qgc2NhbidzIHJlc3BvbnNlLlxuY29uc3QgX0RVUF9PVkVSTEFQX1RIUkVTSE9MRCA9IDAuNztcblxuZnVuY3Rpb24gX2R1cGxpY2F0ZVBhcnRuZXJzKGNsaXApIHtcbiAgcmV0dXJuIEFwcFN0YXRlLmNsaXBzXG4gICAgLmZpbHRlcihvdGhlciA9PiBvdGhlci5pZCAhPT0gY2xpcC5pZCAmJiBvdGhlci5zdGF0dXMgIT09ICdyZWplY3RlZCcpXG4gICAgLm1hcChvdGhlciA9PiB7XG4gICAgICBjb25zdCBvdmVybGFwTXMgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihjbGlwLmVuZF9tcywgb3RoZXIuZW5kX21zKSAtIE1hdGgubWF4KGNsaXAuc3RhcnRfbXMsIG90aGVyLnN0YXJ0X21zKSk7XG4gICAgICBjb25zdCBzaG9ydGVyTXMgPSBNYXRoLm1pbihjbGlwLmVuZF9tcyAtIGNsaXAuc3RhcnRfbXMsIG90aGVyLmVuZF9tcyAtIG90aGVyLnN0YXJ0X21zKTtcbiAgICAgIHJldHVybiB7Y2xpcDogb3RoZXIsIHJhdGlvOiBzaG9ydGVyTXMgPiAwID8gb3ZlcmxhcE1zIC8gc2hvcnRlck1zIDogMH07XG4gICAgfSlcbiAgICAuZmlsdGVyKHBhcnRuZXIgPT4gcGFydG5lci5yYXRpbyA+PSBfRFVQX09WRVJMQVBfVEhSRVNIT0xEKVxuICAgIC5zb3J0KChhLCBiKSA9PiBiLnJhdGlvIC0gYS5yYXRpbyk7XG59XG5cbmZ1bmN0aW9uIF9kdXBsaWNhdGVOb3RpY2VIVE1MKGNsaXApIHtcbiAgaWYgKCEoY2xpcC50YWdzIHx8IFtdKS5pbmNsdWRlcygncG9zc2libGVfZHVwbGljYXRlJykpIHJldHVybiAnJztcbiAgY29uc3QgcGFydG5lcnMgPSBfZHVwbGljYXRlUGFydG5lcnMoY2xpcCk7XG4gIGlmICghcGFydG5lcnMubGVuZ3RoKSByZXR1cm4gJyc7XG4gIGNvbnN0IGJ1dHRvbnMgPSBwYXJ0bmVycy5tYXAocGFydG5lciA9PiB7XG4gICAgY29uc3QgZGlyZWN0aW9uID0gcGFydG5lci5jbGlwLnN0YXJ0X21zIDwgY2xpcC5zdGFydF9tcyA/ICdwcmV2JyA6ICduZXh0JztcbiAgICByZXR1cm4gYDxidXR0b24gY2xhc3M9XCJidG5cIiBzdHlsZT1cImZvbnQtc2l6ZToxMXB4O3BhZGRpbmc6M3B4IDlweFwiIGRhdGEtbWVyZ2UtYT1cIiR7Y2xpcC5pZH1cIiBkYXRhLW1lcmdlLWI9XCIke3BhcnRuZXIuY2xpcC5pZH1cIiBkYXRhLW1lcmdlLWRpcj1cIiR7ZGlyZWN0aW9ufVwiPk1lcmdlICMke3BhcnRuZXIuY2xpcC5pZH0gJm1pZGRvdDsgJHtwYXJ0bmVyLmNsaXAuc3RhcnRfaG1zfTwvYnV0dG9uPmA7XG4gIH0pLmpvaW4oJycpO1xuICBjb25zdCBpZHMgPSBwYXJ0bmVycy5tYXAocGFydG5lciA9PiAnIycgKyBwYXJ0bmVyLmNsaXAuaWQpLmpvaW4oJywgJyk7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cImNsaXAtZHVwLW5vdGljZVwiIHJvbGU9XCJub3RlXCI+XG4gICAgPGRpdj4mIzg2NDY7IFBvc3NpYmxlIGR1cGxpY2F0ZSAtIG92ZXJsYXBzICR7cGFydG5lcnMubGVuZ3RoID09PSAxID8gJ2NsaXAnIDogJ2NsaXBzJ30gJHtpZHN9LiBNZXJnZSB0byBjb21iaW5lIGludG8gdGhpcyBjbGlwLjwvZGl2PlxuICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjZweDtmbGV4LXdyYXA6d3JhcDttYXJnaW4tdG9wOjZweFwiPiR7YnV0dG9uc308L2Rpdj5cbiAgPC9kaXY+YDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gc2NhbkR1cGxpY2F0ZXMoYnVzeUJ0bikge1xuICBjb25zdCB2aWRlb0lkID0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZDtcbiAgaWYgKCF2aWRlb0lkKSByZXR1cm47XG4gIGNvbnN0IGJ0biA9IGJ1c3lCdG4gfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1zY2FuLWR1cGxpY2F0ZXMnKTtcbiAgY29uc3Qgb3JpZ0xhYmVsID0gYnRuPy50ZXh0Q29udGVudDtcbiAgaWYgKGJ0bikgeyBidG4uZGlzYWJsZWQgPSB0cnVlOyBidG4udGV4dENvbnRlbnQgPSAnQ2hlY2tpbmcuLi4nOyB9XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vc2Nhbi1kdXBsaWNhdGVzYCwge21ldGhvZDogJ1BPU1QnfSk7XG4gICAgaWYgKCFyZXMub2spIHsgY29uc3QgZSA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7IHNob3dUb2FzdChlLmRldGFpbCB8fCAnRHVwbGljYXRlIHNjYW4gZmFpbGVkJywgJ2Vycm9yJyk7IHJldHVybjsgfVxuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXMuanNvbigpO1xuICAgIGF3YWl0IF9yZWxvYWRDbGlwTGlzdCh2aWRlb0lkKTtcbiAgICBpZiAoQXBwU3RhdGUuYWN0aXZlQ2xpcElkKSByZWZyZXNoQ2xpcERldGFpbChBcHBTdGF0ZS5hY3RpdmVDbGlwSWQpO1xuICAgIHNob3dUb2FzdChib2R5LmNsaXBzX2ZsYWdnZWRcbiAgICAgID8gYEZvdW5kICR7Ym9keS5jbGlwc19mbGFnZ2VkfSBwb3NzaWJsZSBkdXBsaWNhdGUgJHtib2R5LmNsaXBzX2ZsYWdnZWQgPT09IDEgPyAnY2xpcCcgOiAnY2xpcHMnfWBcbiAgICAgIDogJ05vIGR1cGxpY2F0ZSBjbGlwcyBmb3VuZCcpO1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChidG4pIHsgYnRuLmRpc2FibGVkID0gZmFsc2U7IGJ0bi50ZXh0Q29udGVudCA9IG9yaWdMYWJlbDsgfVxuICB9XG59XG5cbmZ1bmN0aW9uIG9wZW5DbGlwc0FjdGlvbnNNZW51KGJ0bikge1xuICBjb25zdCBuZXdMYWJlbCA9IEFwcFN0YXRlLmNsaXBLaW5kID09PSAnc2NlbmUnID8gJ05ldyBzY2VuZScgOiAnTmV3IGNsaXAnO1xuICBzaG93S2ViYWIoYnRuLCBbXG4gICAgeyBsYWJlbDogbmV3TGFiZWwsIGFjdGlvbjogKCkgPT4gd2luZG93Lm9wZW5DbGlwQ3JlYXRlUGlja2VyKEFwcFN0YXRlLmFjdGl2ZVZpZGVvSWQsIEFwcFN0YXRlLmNsaXBLaW5kKSB9LFxuICAgIHsgbGFiZWw6ICdDaGVjayBkdXBsaWNhdGVzJywgYWN0aW9uOiAoKSA9PiBzY2FuRHVwbGljYXRlcyhidG4pIH0sXG4gIF0pO1xufVxuXG5mdW5jdGlvbiBfcGFyc2VUaW1pbmdPZmZzZXQoc3RyKSB7XG4gIGlmICghc3RyKSByZXR1cm4gMC4wO1xuICBjb25zdCBzID0gc3RyLnRyaW0oKTtcbiAgaWYgKC9eWystXS8udGVzdChzKSkgcmV0dXJuIHBhcnNlRmxvYXQocyk7XG4gIGlmICgvXlxcZCs6XFxkKyhcXC5cXGQrKT8kLy50ZXN0KHMpKSB7XG4gICAgY29uc3QgW20sIHNlY10gPSBzLnNwbGl0KCc6Jyk7XG4gICAgY29uc3QgYWJzU2VjID0gcGFyc2VJbnQobSkgKiA2MCArIHBhcnNlRmxvYXQoc2VjKTtcbiAgICBjb25zdCBjbGlwU3RhcnRTZWMgPSBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YT8uc3RhcnRfbXMgPyBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YS5zdGFydF9tcyAvIDEwMDAgOiAwO1xuICAgIHJldHVybiBhYnNTZWMgLSBjbGlwU3RhcnRTZWM7XG4gIH1cbiAgcmV0dXJuIHBhcnNlRmxvYXQocyk7XG59XG5cbi8vIOKUgOKUgCBkZXNjcmlwdGlvbiBlZGl0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gX29wZW5DbGlwRGVzY0tlYmFiKGNsaXBJZCwgYnRuLCBmaWVsZCkge1xuICBjb25zdCBjbGlwICAgID0gQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGE7XG4gIGNvbnN0IGlzTG9uZyAgPSBmaWVsZCA9PT0gJ2Rlc2NyaXB0aW9uX2xvbmcnO1xuICBjb25zdCBlZGl0VGl0bGUgICA9IGlzTG9uZyA/ICdFZGl0IExvbmcgRGVzY3JpcHRpb24nICAgOiAnRWRpdCBEZXNjcmlwdGlvbic7XG4gIGNvbnN0IHJldmVydFRpdGxlID0gaXNMb25nID8gJ1JldmVydCBMb25nIERlc2NyaXB0aW9uJyA6ICdSZXZlcnQgRGVzY3JpcHRpb24nO1xuICBjb25zdCBjdXJyZW50ICA9IGlzTG9uZyA/IGNsaXA/LmRlc2NyaXB0aW9uX2xvbmcgICAgICAgICAgOiBjbGlwPy5kZXNjcmlwdGlvbjtcbiAgY29uc3QgaXNFZGl0ZWQgPSBpc0xvbmcgPyBjbGlwPy5kZXNjcmlwdGlvbl9sb25nX2lzX2VkaXRlZCA6IGNsaXA/LmRlc2NyaXB0aW9uX2lzX2VkaXRlZDtcbiAgY29uc3Qgb3JpZ2luYWwgPSBpc0xvbmcgPyBjbGlwPy5kZXNjcmlwdGlvbl9sb25nX29yaWdpbmFsICA6IGNsaXA/LmRlc2NyaXB0aW9uX29yaWdpbmFsO1xuXG4gIGNvbnN0IGl0ZW1zID0gW1xuICAgIHsgbGFiZWw6ICdFZGl0JywgYWN0aW9uOiAoKSA9PlxuICAgICAgb3BlbkZpZWxkRWRpdE1vZGFsKGVkaXRUaXRsZSwgY3VycmVudCB8fCAnJywgYXN5bmMgdiA9PiB7XG4gICAgICAgIGF3YWl0IF9wYXRjaENsaXBGaWVsZChjbGlwSWQsICdhY2NlcHRfZWRpdCcsIGZpZWxkLFxuICAgICAgICAgIGlzTG9uZyA/IG51bGwgOiB2LCBpc0xvbmcgPyB2IDogbnVsbCk7XG4gICAgICAgIHNlbGVjdENsaXAoY2xpcElkKTtcbiAgICAgIH0pXG4gICAgfSxcbiAgXTtcbiAgaWYgKGlzRWRpdGVkKSB7XG4gICAgaXRlbXMucHVzaCh7IGxhYmVsOiAnUmV2ZXJ0IHRvIE9yaWdpbmFsJywgYWN0aW9uOiAoKSA9PlxuICAgICAgb3BlbkRpZmZNb2RhbChyZXZlcnRUaXRsZSwgW1xuICAgICAgICB7bGFiZWw6ICdEZXNjcmlwdGlvbicsIGN1cnJlbnQsIHByb3Bvc2VkOiBvcmlnaW5hbH0sXG4gICAgICBdLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IF9wYXRjaENsaXBGaWVsZChjbGlwSWQsICdyZXZlcnQnLCBmaWVsZCwgbnVsbCwgbnVsbCk7XG4gICAgICAgIHNlbGVjdENsaXAoY2xpcElkKTtcbiAgICAgIH0sIHtyZXZlcnRNb2RlOiB0cnVlfSlcbiAgICB9KTtcbiAgfVxuICBpdGVtcy5wdXNoKG51bGwsIHsgbGFiZWw6ICdSZWdlbmVyYXRlIHZpYSBSZS1zY29yZScsIGFjdGlvbjogKCkgPT4gd2luZG93LnJlc2NvcmVDbGlwKGNsaXBJZCkgfSk7XG4gIHNob3dLZWJhYihidG4sIGl0ZW1zKTtcbn1cblxuZnVuY3Rpb24gb3BlbkRlc2NLZWJhYihjbGlwSWQsIGJ0bikgICAgIHsgX29wZW5DbGlwRGVzY0tlYmFiKGNsaXBJZCwgYnRuLCAnZGVzY3JpcHRpb24nKTsgfVxuZnVuY3Rpb24gb3BlbkRlc2NMb25nS2ViYWIoY2xpcElkLCBidG4pIHsgX29wZW5DbGlwRGVzY0tlYmFiKGNsaXBJZCwgYnRuLCAnZGVzY3JpcHRpb25fbG9uZycpOyB9XG5cbmFzeW5jIGZ1bmN0aW9uIF9wYXRjaENsaXBGaWVsZChjbGlwSWQsIGFjdGlvbiwgZmllbGQsIG5ld0Rlc2MsIG5ld0Rlc2NMb25nKSB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcElkfS9maWVsZHNgLCB7XG4gICAgbWV0aG9kOiAnUEFUQ0gnLCBoZWFkZXJzOiB7J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ30sXG4gICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe2FjdGlvbiwgZmllbGQsIG5ld19kZXNjcmlwdGlvbjogbmV3RGVzYywgbmV3X2Rlc2NyaXB0aW9uX2xvbmc6IG5ld0Rlc2NMb25nfSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykgc2hvd1RvYXN0KCdTYXZlIGZhaWxlZCcsICdlcnJvcicpO1xufVxuXG5mdW5jdGlvbiBjbGVhckRldGFpbCgpIHtcbiAgY29uc3QgaGFzUmVjb3JkaW5nID0gISFBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyLWFyZWEnKS5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBjbGFzcz1cIm5vLWV4cG9ydC1tc2dcIj48ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpXCI+JHtoYXNSZWNvcmRpbmcgPyAnU2VsZWN0IGEgY2xpcCB0byByZXZpZXcnIDogJ1NlbGVjdCBhIHJlY29yZGluZyB0byBnZXQgc3RhcnRlZCd9PC9kaXY+PC9kaXY+YDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RldGFpbCcpLmlubmVySFRNTCA9IGhhc1JlY29yZGluZ1xuICAgID8gJzxkaXYgY2xhc3M9XCJkZXRhaWwtZW1wdHlcIj5TZWxlY3QgYSBjbGlwIGZyb20gdGhlIHNpZGViYXI8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4O21hcmdpbi10b3A6NnB4XCI+VXNlIOKGkCDihpIgdG8gbmF2aWdhdGUgYmV0d2VlbiBjbGlwczwvZGl2PjwvZGl2PidcbiAgICA6ICc8ZGl2IGNsYXNzPVwiZGV0YWlsLWVtcHR5XCI+U2VsZWN0IGEgcmVjb3JkaW5nIG9uIHRoZSBsZWZ0PC9kaXY+Jztcbn1cblxuLy8g4pSA4pSAIGNsaXAgYWN0aW9ucyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmFzeW5jIGZ1bmN0aW9uIHNldFN0YXR1cyhpZCwgc3RhdHVzKSB7XG4gIGNvbnN0IGNsaXAgPSBBcHBTdGF0ZS5jbGlwcy5maW5kKGMgPT4gYy5pZCA9PT0gaWQpO1xuICBjb25zdCBmcm9tU3RhdHVzID0gY2xpcD8uc3RhdHVzO1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgL2FwaS9jbGlwcy8ke2lkfS9zdGF0dXNgLCB7XG4gICAgbWV0aG9kOiAgJ1BPU1QnLFxuICAgIGhlYWRlcnM6IHsnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSxcbiAgICBib2R5OiAgICBKU09OLnN0cmluZ2lmeSh7c3RhdHVzfSksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykge1xuICAgIGNvbnN0IGVyciA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgc2hvd1RvYXN0KGBGYWlsZWQgdG8gdXBkYXRlIHN0YXR1czogJHtmb3JtYXRBcGlFcnJvcihlcnIpfWAsICdlcnJvcicpO1xuICAgIHJldHVybjtcbiAgfVxuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBpZDtcbiAgY29uc3QgW2NsaXBzRGF0YSwgY2xpcERldGFpbF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgZmV0Y2goX2NsaXBzTGlzdFVybChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKSkudGhlbihyID0+IHIuanNvbigpKSxcbiAgICBmZXRjaChgL2FwaS9jbGlwcy8ke2lkfWApLnRoZW4ociA9PiByLmpzb24oKSksXG4gIF0pO1xuICBBcHBTdGF0ZS5jbGlwcyA9IGNsaXBzRGF0YTtcbiAgX3JlbmRlckNsaXBzKCk7XG4gIHJlbmRlckRldGFpbChjbGlwRGV0YWlsKTtcbiAgbG9hZFZpZGVvcygpO1xuXG4gIGlmIChmcm9tU3RhdHVzICYmIGZyb21TdGF0dXMgIT09IHN0YXR1cykge1xuICAgIGlmIChBcHBTdGF0ZS5sYXN0U3RhdHVzQ2hhbmdlPy50aW1lcikgY2xlYXJUaW1lb3V0KEFwcFN0YXRlLmxhc3RTdGF0dXNDaGFuZ2UudGltZXIpO1xuICAgIGlmIChBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZT8udGltZXIpIGNsZWFyVGltZW91dChBcHBTdGF0ZS5sYXN0QnVsa1N0YXR1c0NoYW5nZS50aW1lcik7XG4gICAgQXBwU3RhdGUubGFzdEJ1bGtTdGF0dXNDaGFuZ2UgPSBudWxsO1xuICAgIGNvbnN0IGxhYmVsID0ge2FwcHJvdmVkOidBcHByb3ZlZCcsIHJlamVjdGVkOidSZWplY3RlZCcsIHBlbmRpbmc6J01hcmtlZCBhcyBVbnJldmlld2VkJ31bc3RhdHVzXSB8fCBzdGF0dXM7XG4gICAgQXBwU3RhdGUubGFzdFN0YXR1c0NoYW5nZSA9IHtjbGlwSWQ6IGlkLCBmcm9tU3RhdHVzfTtcbiAgICBBcHBTdGF0ZS5sYXN0U3RhdHVzQ2hhbmdlLnRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7IEFwcFN0YXRlLmxhc3RTdGF0dXNDaGFuZ2UgPSBudWxsOyB9LCA1MDAwKTtcbiAgICBzaG93VW5kb1RvYXN0KGBDbGlwICR7bGFiZWx9YCwgdW5kb0xhc3RTdGF0dXMpO1xuICB9XG59XG5cbi8vIEN0cmwvQ21kK1ogZGlzcGF0Y2ggKHNldHRpbmdzLmpzKSAtIHByZWZlcnMgd2hpY2hldmVyIG9mIHNpbmdsZS9idWxrIHN0YXR1c1xuLy8gY2hhbmdlIGlzIHN0aWxsIHBlbmRpbmc7IHNldHRpbmcgZWl0aGVyIGNsZWFycyB0aGUgb3RoZXIsIHNvIGF0IG1vc3Qgb25lIGlzXG4vLyBldmVyIGxpdmUgYW5kIHRoaXMgbmV2ZXIgaGFzIHRvIGFyYml0cmF0ZSBiZXR3ZWVuIHRoZSB0d28uXG5mdW5jdGlvbiB1bmRvTGFzdFN0YXR1cygpIHtcbiAgaWYgKEFwcFN0YXRlLmxhc3RCdWxrU3RhdHVzQ2hhbmdlKSB7XG4gICAgdW5kb0xhc3RCdWxrU3RhdHVzKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghQXBwU3RhdGUubGFzdFN0YXR1c0NoYW5nZSkgcmV0dXJuO1xuICBjb25zdCB7Y2xpcElkLCBmcm9tU3RhdHVzfSA9IEFwcFN0YXRlLmxhc3RTdGF0dXNDaGFuZ2U7XG4gIGNsZWFyVGltZW91dChBcHBTdGF0ZS5sYXN0U3RhdHVzQ2hhbmdlLnRpbWVyKTtcbiAgQXBwU3RhdGUubGFzdFN0YXR1c0NoYW5nZSA9IG51bGw7XG4gIHNldFN0YXR1cyhjbGlwSWQsIGZyb21TdGF0dXMpO1xufVxuXG4vLyDilIDilIAgZGVsZXRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuZnVuY3Rpb24gZGVsZXRlRXhwb3J0KGlkKSB7XG4gIHNob3dDb25maXJtKFxuICAgICdEZWxldGUgZXhwb3J0ZWQgZmlsZT8nLFxuICAgICdUaGUgZXhwb3J0ZWQgdmlkZW8gZmlsZSB3aWxsIGJlIHJlbW92ZWQgZnJvbSBkaXNrLiBUaGUgY2xpcCByZWNvcmQgc3RheXMgLSB5b3UgY2FuIHJlLWV4cG9ydCBhbnkgdGltZS4nLFxuICAgICdEZWxldGUgRXhwb3J0JyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICAvLyBSZWxlYXNlIHRoZSBzdHJlYW1pbmcgY29ubmVjdGlvbiBmaXJzdCAtIG9uIFdpbmRvd3MgdGhlIHNlcnZlcidzIFN0YXRpY0ZpbGVzXG4gICAgICAvLyBoYW5kbGUgc3RheXMgb3BlbiB3aGlsZSB0aGUgPHZpZGVvPiBpcyBjb25uZWN0ZWQsIGJsb2NraW5nIHRoZSBkZWxldGUuXG4gICAgICBhd2FpdCBfcmVsZWFzZVBsYXllckJlZm9yZURlbGV0ZSgpO1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvY2xpcHMvJHtpZH0vZXhwb3J0YCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgICAgIGlmICghcmVzLm9rKSB7XG4gICAgICAgIGNvbnN0IGVyciA9IGF3YWl0IHJlcy5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7XG4gICAgICAgIHNob3dUb2FzdChgRmFpbGVkIHRvIGRlbGV0ZSBleHBvcnQ6ICR7Zm9ybWF0QXBpRXJyb3IoZXJyKX1gLCAnZXJyb3InKTtcbiAgICAgICAgc2VsZWN0Q2xpcChpZCk7ICAvLyByZXN0b3JlIHRoZSBwbGF5ZXIvZGV0YWlsIHdlIGNsZWFyZWQgYWJvdmVcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgQXBwU3RhdGUuYWN0aXZlQ2xpcERhdGEuaGFzX2V4cG9ydCA9IGZhbHNlO1xuICAgICAgQXBwU3RhdGUuYWN0aXZlTWVkaWFGaWxlbmFtZSA9IG51bGw7XG4gICAgICByZW5kZXJQbGF5ZXIobnVsbCwgbnVsbCwgaWQpO1xuICAgICAgcmVuZGVyRGV0YWlsKEFwcFN0YXRlLmFjdGl2ZUNsaXBEYXRhKTtcbiAgICAgIGF3YWl0IF9yZWxvYWRDbGlwTGlzdChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKTtcbiAgICAgIHNob3dUb2FzdCgnRXhwb3J0ZWQgZmlsZSBkZWxldGVkJyk7XG4gICAgfSxcbiAgICB0cnVlLFxuICApO1xufVxuXG5mdW5jdGlvbiBkZWxldGVDbGlwKGlkKSB7XG4gIHNob3dDb25maXJtKFxuICAgICdEZWxldGUgY2xpcD8nLFxuICAgIGBUaGUgY2xpcCByZWNvcmQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGRhdGFiYXNlLiBgICtcbiAgICBgSXRzIGV4cG9ydGVkIHZpZGVvIGZpbGUgKGlmIGFueSkgd2lsbCBhbHNvIGJlIGRlbGV0ZWQgZnJvbSB0aGUgZXhwb3J0cyBmb2xkZXIuYCxcbiAgICAnRGVsZXRlJyxcbiAgICAoKSA9PiBfZG9EZWxldGVDbGlwKGlkKSxcbiAgICB0cnVlLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZG9EZWxldGVDbGlwKGlkKSB7XG4gIGNvbnN0IHZpZGVvSWQgPSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkO1xuICAvLyBSZWxlYXNlIHRoZSBwbGF5ZXIgc28gaXRzIGJhY2tpbmcgZXhwb3J0L3ByZXZpZXcgZmlsZSBpc24ndCBsb2NrZWQgZHVyaW5nIGRlbGV0ZS5cbiAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCA9PT0gaWQpIGF3YWl0IF9yZWxlYXNlUGxheWVyQmVmb3JlRGVsZXRlKCk7XG4gIGNvbnN0IGRlbFJlcyA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7aWR9YCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgaWYgKCFkZWxSZXMub2spIHtcbiAgICBjb25zdCBlcnIgPSBhd2FpdCBkZWxSZXMuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpO1xuICAgIHNob3dUb2FzdChgRmFpbGVkIHRvIGRlbGV0ZSBjbGlwOiAke2Zvcm1hdEFwaUVycm9yKGVycil9YCwgJ2Vycm9yJyk7XG4gICAgaWYgKEFwcFN0YXRlLmFjdGl2ZUNsaXBJZCA9PT0gaWQpIHNlbGVjdENsaXAoaWQpO1xuICAgIHJldHVybjtcbiAgfVxuICBBcHBTdGF0ZS5hY3RpdmVDbGlwSWQgPSBudWxsO1xuICBjbGVhckRldGFpbCgpO1xuICBhd2FpdCBfcmVsb2FkQ2xpcExpc3QodmlkZW9JZCk7XG4gIGF3YWl0IGxvYWRWaWRlb3MoKTtcbiAgc2hvd1RvYXN0KCdDbGlwIGRlbGV0ZWQnKTtcbn1cblxuLy8g4pSA4pSAIGZpbmQgc2ltaWxhciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfc2ltaWxhckNsaXBzQ2xpcElkID0gbnVsbDtcbmxldCBfc2ltaWxhckNsaXBzT3BlbmVyID0gbnVsbDtcblxuZnVuY3Rpb24gb3BlblNpbWlsYXJDbGlwc01vZGFsKGNsaXBJZCkge1xuICBfc2ltaWxhckNsaXBzT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgX3NpbWlsYXJDbGlwc0NsaXBJZCA9IGNsaXBJZDtcbiAgY29uc3QgY3VycmVudFZpZGVvID0gQXBwU3RhdGUudmlkZW9zLmZpbmQodiA9PiB2LmlkID09PSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKTtcbiAgY29uc3Qgb3RoZXJWaWRlb3MgPSBBcHBTdGF0ZS52aWRlb3MuZmlsdGVyKHYgPT4gdi5pZCAhPT0gQXBwU3RhdGUuYWN0aXZlVmlkZW9JZCAmJiB2LnN0YXR1cyA9PT0gJ2RvbmUnKTtcblxuICBjb25zdCBzY29wZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaW1pbGFyLWNsaXBzLXNjb3BlJyk7XG4gIHNjb3BlLmlubmVySFRNTCA9ICcnO1xuXG4gIGNvbnN0IGFkZENoZWNrID0gKGlkLCBsYWJlbCwgY2hlY2tlZCkgPT4ge1xuICAgIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XG4gICAgcm93LnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4O2ZvbnQtc2l6ZToxM3B4O2N1cnNvcjpwb2ludGVyJztcbiAgICByb3cuaW5uZXJIVE1MID0gYDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBkYXRhLXZpZGVvLWlkPVwiJHtpZH1cIiAke2NoZWNrZWQgPyAnY2hlY2tlZCcgOiAnJ30+ICR7ZXNjSHRtbChsYWJlbCl9YDtcbiAgICBzY29wZS5hcHBlbmRDaGlsZChyb3cpO1xuICB9O1xuXG4gIGlmIChjdXJyZW50VmlkZW8pIGFkZENoZWNrKGN1cnJlbnRWaWRlby5pZCwgYCR7Y3VycmVudFZpZGVvLnRpdGxlIHx8IGN1cnJlbnRWaWRlby5maWxlbmFtZX0gKHRoaXMgcmVjb3JkaW5nKWAsIHRydWUpO1xuICBmb3IgKGNvbnN0IHYgb2Ygb3RoZXJWaWRlb3MpIGFkZENoZWNrKHYuaWQsIHYudGl0bGUgfHwgdi5maWxlbmFtZSwgZmFsc2UpO1xuICBpZiAoIWN1cnJlbnRWaWRlbyAmJiAhb3RoZXJWaWRlb3MubGVuZ3RoKSB7XG4gICAgc2NvcGUuaW5uZXJIVE1MID0gJzxkaXYgc3R5bGU9XCJmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZClcIj5ObyBwcm9jZXNzZWQgcmVjb3JkaW5ncyBhdmFpbGFibGU8L2Rpdj4nO1xuICB9XG5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpbWlsYXItY2xpcHMtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGNvbnN0IGZpcnN0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NpbWlsYXItY2xpcHMtc2NvcGUgaW5wdXRbdHlwZT1jaGVja2JveF0nKTtcbiAgICAoZmlyc3QgfHwgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3NpbWlsYXItY2xpcHMtbW9kYWwgLmJ0bicpKT8uZm9jdXMoKTtcbiAgfSwgNTApO1xufVxuXG5mdW5jdGlvbiBjbG9zZVNpbWlsYXJDbGlwc01vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2ltaWxhci1jbGlwcy1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgX3NpbWlsYXJDbGlwc0NsaXBJZCA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9zaW1pbGFyQ2xpcHNPcGVuZXI7XG4gIF9zaW1pbGFyQ2xpcHNPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0RmluZFNpbWlsYXIoKSB7XG4gIGNvbnN0IGNsaXBJZCA9IF9zaW1pbGFyQ2xpcHNDbGlwSWQ7XG4gIGlmICghY2xpcElkKSByZXR1cm47XG4gIGlmIChfYmxvY2tlZEJ5QW5hbHl6ZSgnZmluZCBzaW1pbGFyIGNsaXBzJykpIHJldHVybjtcblxuICBjb25zdCBjaGVja2VkID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcjc2ltaWxhci1jbGlwcy1zY29wZSBpbnB1dFt0eXBlPWNoZWNrYm94XTpjaGVja2VkJykpO1xuICBjb25zdCB2aWRlb0lkcyA9IGNoZWNrZWQubWFwKGVsID0+IGVsLmRhdGFzZXQudmlkZW9JZCkuam9pbignLCcpO1xuXG4gIGNsb3NlU2ltaWxhckNsaXBzTW9kYWwoKTtcblxuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWZpbmQtc2ltaWxhcicpO1xuICBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IHRydWU7IGJ0bi50ZXh0Q29udGVudCA9ICdTZWFyY2hpbmfigKYnOyB9XG4gIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKTtcbiAgb3BlbkxvZygpO1xuXG4gIGNvbnN0IHJlc2V0QnRuID0gKCkgPT4geyBpZiAoYnRuKSB7IGJ0bi5kaXNhYmxlZCA9IGZhbHNlOyBidG4udGV4dENvbnRlbnQgPSAnRmluZCBTaW1pbGFyJzsgfSB9O1xuICBjb25zdCBxcyA9IHZpZGVvSWRzID8gYD92aWRlb19pZHM9JHtlbmNvZGVVUklDb21wb25lbnQodmlkZW9JZHMpfWAgOiAnJztcbiAgY29uc3QgaGFuZGxlID0gX29wZW5TU0UoXG4gICAgYC9hcGkvY2xpcHMvJHtjbGlwSWR9L3JlbGF0ZWQtY2xpcHMke3FzfWAsXG4gICAgbXNnID0+IHsgYXBwZW5kTG9nKFN0cmluZyhtc2cpKTsgfSxcbiAgICBhc3luYyBtc2cgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICByZXNldEJ0bigpO1xuICAgICAgY29uc3QgY2xpcCA9IGF3YWl0IGZldGNoKGAvYXBpL2NsaXBzLyR7Y2xpcElkfWApLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICBpZiAoY2xpcCkge1xuICAgICAgICBBcHBTdGF0ZS5hY3RpdmVDbGlwRGF0YSA9IGNsaXA7XG4gICAgICAgIGlmICghUGFuZWxOYXYuaXNPcGVuKCkpIHJlbmRlckRldGFpbChjbGlwKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNvdW50ID0gbXNnLnJlc3VsdHM/Lmxlbmd0aCA/PyAwO1xuICAgICAgc2hvd1RvYXN0KGNvdW50ID8gYEZvdW5kICR7cGx1cmFsKGNvdW50LCAnc2ltaWxhciBjbGlwJyl9YCA6ICdObyBzaW1pbGFyIGNsaXBzIGZvdW5kJyk7XG4gICAgfSxcbiAgICBlcnJNc2cgPT4ge1xuICAgICAgX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSk7XG4gICAgICByZXNldEJ0bigpO1xuICAgICAgc2hvd1RvYXN0KGBGaW5kIFNpbWlsYXIgZmFpbGVkIC0gJHtlcnJNc2d9YCwgJ2Vycm9yJyk7XG4gICAgfSxcbiAgKTtcbiAgX3NldEFjdGl2ZVN0cmVhbShoYW5kbGUsIHJlc2V0QnRuKTtcbn1cblxuLy8g4pSA4pSAIHNjb3Jpbmcg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5mdW5jdGlvbiBzY29yZUFsbCgpIHtcbiAgb3BlbkxvZygpO1xuICBzdHJlYW1TU0UoXG4gICAgJy9hcGkvc2NvcmUnLFxuICAgICgpID0+IHtcbiAgICAgIGxvYWRWaWRlb3MoKTtcbiAgICAgIF9yZWxvYWRDbGlwTGlzdChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKTtcbiAgICAgIHNob3dUb2FzdCgnU2NvcmluZyBjb21wbGV0ZScpO1xuICAgIH0sXG4gICAgU0NPUkVfU1RFUFMsXG4gICAgJ1Njb3JpbmcnLFxuICApO1xufVxuXG4vLyBTdGF0aWMgaW5kZXguaHRtbCBidXR0b25zIHRoaXMgbW9kdWxlIG93bnMgKGZpbHRlciBjaGlwcywga2luZCB0b2dnbGUsIHNvcnRcbi8vIGRpciwga2ViYWIsIHNlYXJjaCwgbWluLXNjb3JlKSAtIHdpcmVkIGhlcmUgb25jZSBhdCBtb2R1bGUgbG9hZCwgc2FtZSBwYXR0ZXJuXG4vLyBhcyB0aGUgI2NsaXAtbGlzdCAvICNkZXRhaWwgZGVsZWdhdGlvbiBhYm92ZSwgcmVwbGFjaW5nIHRoZSBvbmNsaWNrPS9vbmlucHV0PS9cbi8vIG9uY2hhbmdlPSBhdHRyaWJ1dGVzIHRoYXQgdXNlZCB0byBsaXZlIG9uIHRoYXQgbWFya3VwIGRpcmVjdGx5LlxuZnVuY3Rpb24gX2hhbmRsZUNsaXBTaWRlYmFyQ2xpY2soZSkge1xuICBjb25zdCBraW5kQnRuID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEta2luZF0nKTtcbiAgaWYgKGtpbmRCdG4pIHsgc2V0Q2xpcEtpbmQoa2luZEJ0bi5kYXRhc2V0LmtpbmQpOyByZXR1cm47IH1cbiAgY29uc3QgZmlsdGVyQ2hpcCA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWZpbHRlcl0nKTtcbiAgaWYgKGZpbHRlckNoaXApIHsgdG9nZ2xlQ2xpcEZpbHRlcihmaWx0ZXJDaGlwLmRhdGFzZXQuZmlsdGVyKTsgcmV0dXJuOyB9XG4gIGlmIChlLnRhcmdldC5jbG9zZXN0KCcjY2xpcHMtc29ydC1kaXInKSkgeyB0b2dnbGVDbGlwU29ydERpcigpOyByZXR1cm47IH1cbiAgY29uc3Qga2ViYWJCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCcjYnRuLWNsaXBzLWFjdGlvbnMnKTtcbiAgaWYgKGtlYmFiQnRuKSB7IG9wZW5DbGlwc0FjdGlvbnNNZW51KGtlYmFiQnRuKTsgcmV0dXJuOyB9XG59XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjbGlwcy1zaWRlYmFyLWdyb3VwJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBfaGFuZGxlQ2xpcFNpZGViYXJDbGljayk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2xpcC1zZWFyY2gtaW5wdXQnKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGUgPT4gc2V0Q2xpcFNlYXJjaChlLnRhcmdldC52YWx1ZSkpO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NsaXAtc2NvcmUtbWluJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZSA9PiBzZXRDbGlwU2NvcmVNaW4oZS50YXJnZXQudmFsdWUpKTtcblxuY29uc3QgX3NpbWlsYXJDbGlwc01vZGFsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NpbWlsYXItY2xpcHMtbW9kYWwnKTtcbl9zaW1pbGFyQ2xpcHNNb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IF9zaW1pbGFyQ2xpcHNNb2RhbCkgY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCgpOyB9KTtcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaW1pbGFyLWNsaXBzLWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlU2ltaWxhckNsaXBzTW9kYWwoKSk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWZpbmQtc2ltaWxhci1nbycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gc3RhcnRGaW5kU2ltaWxhcigpKTtcblxuY29uc3QgX3Njb3JlT3ZlcnJpZGVNb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzY29yZS1vdmVycmlkZS1tb2RhbCcpO1xuX3Njb3JlT3ZlcnJpZGVNb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IF9zY29yZU92ZXJyaWRlTW9kYWwpIGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCk7IH0pO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njb3JlLW92ZXJyaWRlLWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlU2NvcmVPdmVycmlkZU1vZGFsKCkpO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Njb3JlLW92ZXJyaWRlLXNhdmUtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfc2NvcmVPdmVycmlkZVNhdmUoKSk7XG5cbi8vIFB1YmxpYyBBUEkgLSBzeW1ib2xzIHdpdGggYSBjbGFzc2ljIChidW5kbGUuanMpIGNvbnN1bWVyLCBhIHN0aWxsLWNsYXNzaWNcbi8vIG1vZHVsZSByZWFkaW5nIHRoaXMgbW9kdWxlJ3MgZXhwb3J0cyBhcyB3aW5kb3cuKiAoc2hvcnRjdXRzLmpzLCBqb2JzLmpzLFxuLy8gdmlkZW9zLmpzKSwgb3IgYSB0ZXN0cy91aS8qLnB5IHBhZ2UuZXZhbHVhdGUuIHNldENsaXBTZWFyY2gsIHNldENsaXBTY29yZU1pbixcbi8vIF9jbGVhckNsaXBGaWx0ZXJzLCBzZXRDbGlwS2luZCwgX3N5bmNLaW5kQ2hpcHMsIHRvZ2dsZUNsaXBTb3J0RGlyLCBkZWxldGVDbGlwLFxuLy8gZGVsZXRlRXhwb3J0LCBtZXJnZUNsaXBzLCBzY2FuRHVwbGljYXRlcywgb3BlbkNsaXBzQWN0aW9uc01lbnUsXG4vLyBfc2NvcmVPdmVycmlkZVNhdmUsIGNsZWFyU2NvcmVPdmVycmlkZSwgb3BlbkRlc2NLZWJhYiwgb3BlbkRlc2NMb25nS2ViYWIsXG4vLyBzdGFydEZpbmRTaW1pbGFyIGFuZCBvcGVuU2ltaWxhckNsaXBzTW9kYWwgZHJvcHBlZDogdGhlaXIgb25seSBjYWxsZXJzIHdlcmVcbi8vIHRoaXMgbW9kdWxlJ3Mgb3duIGlubGluZSBoYW5kbGVycyAobm93IGRhdGEtYWN0IGRlbGVnYXRpb24gb3IgdGhlIHN0YXRpY1xuLy8gd2lyaW5nIGFib3ZlKSBvciBpdHMgb3duIGludGVybmFsIGxvZ2ljLCBzbyBub3RoaW5nIG91dHNpZGUgdGhlIG1vZHVsZSBuZWVkc1xuLy8gdGhlbSBvZmYgd2luZG93IGFueW1vcmUuXG5leHBvcnQge1xuICBzZWxlY3RDbGlwLCBzZXRTdGF0dXMsIHVuZG9MYXN0U3RhdHVzLCByZW5kZXJEZXRhaWwsIHJlbmRlclBsYXllciwgY2xlYXJEZXRhaWwsIHJlZnJlc2hDbGlwRGV0YWlsLFxuICBfcmVsZWFzZVBsYXllckJlZm9yZURlbGV0ZSxcbiAgYW5hbHl6ZUZyYW1lcyxcbiAgdG9nZ2xlQ2xpcEZpbHRlciwgX3N5bmNGaWx0ZXJDaGlwcyxcbiAgX2FwcGx5RmlsdGVycywgX3JlbmRlckNsaXBzLCBfcGFyc2VUaW1pbmdPZmZzZXQsIF9yZWxvYWRDbGlwTGlzdCxcbiAgX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMsXG4gIG9wZW5TY29yZU92ZXJyaWRlLCBjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCxcbiAgY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCxcbiAgb3BlbkNsaXBBY3Rpb25zTW9kYWwsXG59O1xuIiwgIi8vIEVTTSBlbnRyeSBwb2ludCAtIHRoZSBzdHJhbmdsZXItZmlnIHNlYW0gKFdTNSBzdGVwIDIpLiBlc2J1aWxkIGJ1bmRsZXMgdGhpc1xuLy8gbW9kdWxlIGdyYXBoIGludG8gc3RhdGljL2J1bmRsZS5lc20uanMgKHNlZSBzY3JpcHRzL2J1aWxkLWVzbS5tanMsIHJ1biBieVxuLy8gYHl1dS1kZXYgYnVuZGxlYCkuIEV2ZXJ5dGhpbmcgcmVhY2hhYmxlIGZyb20gaGVyZSBpcyByZWFsIEVTTSAoaW1wb3J0L2V4cG9ydCk7XG4vLyB0aGUgY2xhc3NpYyBnbG9iYWwtc2NvcGUgc2NyaXB0cyBzdGlsbCBpbiBidW5kbGUuanMgY2FsbCB0aGVzZSBtb2R1bGVzIGFzXG4vLyB3aW5kb3cgZ2xvYmFscywgc28gdGhpcyBlbnRyeSByZS1leHBvc2VzIGVhY2ggbWlncmF0ZWQgbW9kdWxlJ3MgcHVibGljIHN1cmZhY2Vcbi8vIG9uIHdpbmRvdyBhcyBhIGNvbXBhdGliaWxpdHkgc2hpbS5cbi8vXG4vLyBNaWdyYXRpbmcgYSBjbGFzc2ljIGNvbnN1bWVyIHRvIGBpbXBvcnRgIHNocmlua3MgdGhlIHNoaW06IG9uY2Ugbm90aGluZyByZWFkcyBhXG4vLyBuYW1lIG9mZiB3aW5kb3csIGRlbGV0ZSBpdHMgbGluZSBiZWxvdy4gV2hlbiBidW5kbGUuanMgaXMgZW1wdHksIHRoaXMgZmlsZSBpc1xuLy8gdGhlIHdob2xlIGFwcCBhbmQgdGhlIHNoaW0gaXMgZ29uZS5cbmltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQgKiBhcyBmb3JtYXQgZnJvbSAnLi9mb3JtYXQuanMnO1xuaW1wb3J0IHsgQ29sb3JQaWNrZXIgfSBmcm9tICcuL2NvbG9ycGlja2VyLmpzJztcbmltcG9ydCB7IFBhbmVsTmF2IH0gZnJvbSAnLi9wYW5lbG5hdi5qcyc7XG5pbXBvcnQgKiBhcyBqb2JzIGZyb20gJy4vam9icy5qcyc7XG5pbXBvcnQgeyBfYnVpbGRNZWRpYVVybCwgc2V0dXBSZWNvcmRpbmdQcmV2aWV3IH0gZnJvbSAnLi9wcmV2aWV3LmpzJztcbmltcG9ydCB7XG4gIF9zeW5jU29ydERpckJ0biwgX2RpYXJpemF0aW9uUmVhc29uLCBfZGlhcml6YXRpb25SZWFkaW5lc3MsIF9kaWFyaXphdGlvbk5vdGVIdG1sLFxuICBvcGVuTG9nLCBjbGVhckxvZywgYXBwZW5kTG9nLCBzaG93VG9hc3QsIG5ldEVyck1zZywgcmV2ZWFsSW5Gb2xkZXIsIGNvcHlUZXh0LFxuICBjb2xsYXBzaWJsZUNhcmQsXG59IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHtcbiAgc2hvd0FsZXJ0LCBjbG9zZUFsZXJ0TW9kYWwsIHNob3dDb25maXJtLCBfY29uZmlybUNhbmNlbCxcbiAgb3BlbkFjdGlvbnNNb2RhbCwgY2xvc2VBY3Rpb25zTW9kYWwsIHRvcG1vc3RWaXNpYmxlTW9kYWwsIF9tZW51QXJyb3dLZXlkb3duLFxuICBpc0hhbWJ1cmdlck9wZW4sIHRvZ2dsZUhhbWJ1cmdlciwgY2xvc2VIYW1idXJnZXIsXG4gIG9wZW5Db250cm9sc01vZGFsLCBjbG9zZUNvbnRyb2xzTW9kYWwsXG4gIG9wZW5EaWZmTW9kYWwsIF9kaWZmRGlzY2FyZCxcbiAgb3BlbkZpZWxkRWRpdE1vZGFsLCBjbG9zZUZpZWxkRWRpdE1vZGFsLFxuICBjbG9zZUtlYmFiLCBzaG93S2ViYWIsIGluaXRSZXNpemUsIF9hcHBseVByZXJlcVdhcm5pbmdzLCBzaG93VW5kb1RvYXN0LFxuICBwbGF5YmFja1JhdGVQcmVmLCBhcHBseVBsYXliYWNrUmF0ZSwgaW5pdFBsYXliYWNrUmF0ZSxcbn0gZnJvbSAnLi91aS5qcyc7XG5pbXBvcnQge1xuICBvcGVuR2V0dGluZ1N0YXJ0ZWRNb2RhbCwgY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsLFxuICBvcGVuQWJvdXRNb2RhbCwgY2xvc2VBYm91dE1vZGFsLFxuICBvcGVuSGVscE1vZGFsLCBjbG9zZUhlbHBNb2RhbCxcbiAgb3Blbkdsb3NzYXJ5TW9kYWwsIGNsb3NlR2xvc3NhcnlNb2RhbCwgX2ZpbHRlckdsb3NzYXJ5LFxufSBmcm9tICcuL2hlbHBtb2RhbHMuanMnO1xuLy8gc2hvcnRjdXRzLmpzIGhhcyBubyBwdWJsaWMgc3VyZmFjZSAoaXRzIG9ubHkgZXhwb3J0IGlzIHRoZSBrZXlkb3duIGxpc3RlbmVyXG4vLyByZWdpc3RyYXRpb24pIC0gYSBiYXJlIHNpZGUtZWZmZWN0IGltcG9ydCByZWdpc3RlcnMgdGhlIGdsb2JhbCBoYW5kbGVyXG4vLyB3aXRob3V0IGFkZGluZyBhbnl0aGluZyB0byB0aGUgd2luZG93IHNoaW0uXG5pbXBvcnQgJy4vc2hvcnRjdXRzLmpzJztcbmltcG9ydCB7XG4gIF9lbnN1cmVNb2RlbENhdGFsb2csIHJlZnJlc2hNb2RlbENhdGFsb2csXG4gIF91cGRhdGVMbG1DYXBhYmlsaXRpZXMsIF9yZW5kZXJDYXBhYmlsaXR5VGllcnMsXG4gIGdhdGVPbkNhcGFiaWxpdHksXG59IGZyb20gJy4vbW9kZWxjYXRhbG9nLmpzJztcbmltcG9ydCB7XG4gIGxvYWRWaWRlb3MsIHNlbGVjdFZpZGVvLCByZW5kZXJWaWRlb0RldGFpbCwgZGVsZXRlVmlkZW8sXG4gIG9uQ2xpcHNTb3J0Q2hhbmdlLCBfY2xpcHNTb3J0UGFyYW0sIF9jbGlwc0xpc3RVcmwsXG4gIF9yZWFuYWx5emVQYXJhbXMsXG4gIF9uZWVkc01vZGVsQ3RhSFRNTCxcbiAgX3VwZGF0ZURlbW9CdXR0b24sIF91cGRhdGVTdGFydEluZ2VzdEJ1dHRvbixcbiAgX2FuYWx5c2lzTGl2ZVBhbmVsSFRNTCwgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCxcbiAgX2FwcGx5VmlkZW9GaWx0ZXJzLCBfcmVuZGVyVmlkZW9MaXN0LFxuICBzZXRWaWRlb1NlYXJjaCwgc2V0VmlkZW9Tb3J0LCB0b2dnbGVWaWRlb1NvcnREaXIsIHRvZ2dsZVZpZGVvRmlsdGVyLFxuICBvcGVuVmlkZW9BY3Rpb25zTW9kYWwsXG59IGZyb20gJy4vdmlkZW9zLmpzJztcbmltcG9ydCB7XG4gIGdlbmVyYXRlVGltZWxpbmUsIGNsb3NlVGltZWxpbmVJbnRlcnZhbE1vZGFsLCBfcmVuZGVyVGltZWxpbmVIVE1MLCBfdGltZWxpbmVFbXB0eU5vdGVIVE1MLFxufSBmcm9tICcuL3ZpZGVvcy10aW1lbGluZS5qcyc7XG5pbXBvcnQgeyBzdW1tYXJpemVWaWRlbywgcmVnZW5TdW1tYXJ5QXV0byB9IGZyb20gJy4vdmlkZW9zLXN1bW1hcnkuanMnO1xuaW1wb3J0IHsgX3JlbmRlclJ1bk1ldGFDYXJkLCBfcnVuVGltaW5nTGluZSB9IGZyb20gJy4vdmlkZW9zLXJ1bm1ldGEuanMnO1xuaW1wb3J0IHtcbiAgU2Vzc2lvblVJLCBpc1Nlc3Npb25Db2xsYXBzZWQsIHNlc3Npb25Hcm91cEhlYWRlckxpLCB0b2dnbGVHcm91cFNlbGVjdCxcbn0gZnJvbSAnLi9zZXNzaW9ucy5qcyc7XG5pbXBvcnQge1xuICBzZWxlY3RDbGlwLCBzZXRTdGF0dXMsIHVuZG9MYXN0U3RhdHVzLCByZW5kZXJEZXRhaWwsIHJlbmRlclBsYXllciwgY2xlYXJEZXRhaWwsIHJlZnJlc2hDbGlwRGV0YWlsLFxuICBfcmVsZWFzZVBsYXllckJlZm9yZURlbGV0ZSxcbiAgYW5hbHl6ZUZyYW1lcyxcbiAgdG9nZ2xlQ2xpcEZpbHRlciwgX3N5bmNGaWx0ZXJDaGlwcyxcbiAgX2FwcGx5RmlsdGVycywgX3JlbmRlckNsaXBzLCBfcGFyc2VUaW1pbmdPZmZzZXQsIF9yZWxvYWRDbGlwTGlzdCxcbiAgX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMsXG4gIG9wZW5TY29yZU92ZXJyaWRlLCBjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCxcbiAgY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCxcbiAgb3BlbkNsaXBBY3Rpb25zTW9kYWwsXG59IGZyb20gJy4vY2xpcHMuanMnO1xuXG53aW5kb3cuQXBwU3RhdGUgPSBBcHBTdGF0ZTtcbk9iamVjdC5hc3NpZ24od2luZG93LCBmb3JtYXQpO1xud2luZG93LkNvbG9yUGlja2VyID0gQ29sb3JQaWNrZXI7XG53aW5kb3cuUGFuZWxOYXYgPSBQYW5lbE5hdjtcbi8vIHV0aWxzLmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBldmVyeSBuYW1lIGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljXG4vLyAoYnVuZGxlLmpzKSBjb25zdW1lciwgb3IgKGNsZWFyTG9nLCBfZGlhcml6YXRpb25SZWFzb24sIF9kaWFyaXphdGlvbk5vdGVIdG1sKSBhXG4vLyB0ZXN0cy91aS90ZXN0X3VpX3V0aWxzLnB5IHBhZ2UuZXZhbHVhdGUuIHRvZ2dsZUxvZyBhbmQgaXNDYXJkQ29sbGFwc2VkIGRyb3BwZWQ6XG4vLyB0aGVpciBvbmx5IGNvbnN1bWVycyB3ZXJlIHV0aWxzLmpzJ3Mgb3duIGlubGluZSBoYW5kbGVyIChub3cgYWRkRXZlbnRMaXN0ZW5lcilcbi8vIGFuZCBpdHMgb3duIGNvbGxhcHNpYmxlQ2FyZCwgcmVzcGVjdGl2ZWx5Llxud2luZG93Ll9zeW5jU29ydERpckJ0biA9IF9zeW5jU29ydERpckJ0bjtcbndpbmRvdy5fZGlhcml6YXRpb25SZWFzb24gPSBfZGlhcml6YXRpb25SZWFzb247XG53aW5kb3cuX2RpYXJpemF0aW9uUmVhZGluZXNzID0gX2RpYXJpemF0aW9uUmVhZGluZXNzO1xud2luZG93Ll9kaWFyaXphdGlvbk5vdGVIdG1sID0gX2RpYXJpemF0aW9uTm90ZUh0bWw7XG53aW5kb3cub3BlbkxvZyA9IG9wZW5Mb2c7XG53aW5kb3cuY2xlYXJMb2cgPSBjbGVhckxvZztcbndpbmRvdy5hcHBlbmRMb2cgPSBhcHBlbmRMb2c7XG53aW5kb3cuc2hvd1RvYXN0ID0gc2hvd1RvYXN0O1xud2luZG93Lm5ldEVyck1zZyA9IG5ldEVyck1zZztcbndpbmRvdy5yZXZlYWxJbkZvbGRlciA9IHJldmVhbEluRm9sZGVyO1xud2luZG93LmNvcHlUZXh0ID0gY29weVRleHQ7XG53aW5kb3cuY29sbGFwc2libGVDYXJkID0gY29sbGFwc2libGVDYXJkO1xuLy8gam9icy5qcyBpcyBjcm9zcy1jdXR0aW5nIC0gZXZlcnkgZXhwb3J0IGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljXG4vLyAoYnVuZGxlLmpzKSBjb25zdW1lciBvciBhIHN0aWxsLXByZXNlbnQgaW5saW5lIGhhbmRsZXIsIHNvIG5vbmUgb2YgdGhlc2UgY2FuXG4vLyBiZSBkcm9wcGVkIHlldC4gSXRzIGhhbmRmdWwgb2YgbXV0YWJsZSBzaGFyZWQtc3RhdGUgZ2xvYmFscyAoX2pvYlN0ZXBEZWZzLFxuLy8gX2FjdGl2ZUVTLCBldGMuKSBhcmUgTk9UIGhlcmUgLSBqb2JzLmpzIHdpcmVzIHRob3NlIG9udG8gd2luZG93IGl0c2VsZiB2aWFcbi8vIGxpdmUgZ2V0L3NldCBhY2Nlc3NvcnMsIHNpbmNlIGEgcGxhaW4gc25hcHNob3Qgd291bGQgZ28gc3RhbGUgb24gcmVhc3NpZ25tZW50LlxuT2JqZWN0LmFzc2lnbih3aW5kb3csIGpvYnMpO1xuLy8gcHJldmlldy5qcyBpcyBjcm9zcy1jdXR0aW5nIC0gc2V0dXBSZWNvcmRpbmdQcmV2aWV3IGhhcyBjbGFzc2ljIGNvbnN1bWVyc1xuLy8gKGNsaXBjcmVhdGUuanMsIHZpZGVvcy5qcywgc3BsaXQuanMsIGV4cG9ydGVkaXRvci5qcyk7IF9idWlsZE1lZGlhVXJsIGhhcyBub1xuLy8gSlMgY29uc3VtZXIgbGVmdCBidXQgdGVzdHMvdWkvdGVzdF91aV92aWRlby5weSBldmFsdWF0ZXMgaXQgYXMgYSBwYWdlIGdsb2JhbC5cbndpbmRvdy5fYnVpbGRNZWRpYVVybCA9IF9idWlsZE1lZGlhVXJsO1xud2luZG93LnNldHVwUmVjb3JkaW5nUHJldmlldyA9IHNldHVwUmVjb3JkaW5nUHJldmlldztcbi8vIHVpLmpzIGlzIGNyb3NzLWN1dHRpbmcgLSBldmVyeSBuYW1lIGhlcmUgc3RpbGwgaGFzIGF0IGxlYXN0IG9uZSBjbGFzc2ljXG4vLyAoYnVuZGxlLmpzKSBjb25zdW1lciwgYW4gYWxyZWFkeS1FU00gY2FsbGVyIChqb2JzLmpzL3BhbmVsbmF2LmpzJ3Ncbi8vIHdpbmRvdy5zaG93Q29uZmlybSksIG9yIGEgdGVzdHMvdWkvKi5weSBwYWdlLmV2YWx1YXRlLiBfY29uZmlybU9rLFxuLy8gX2RpZmZBY2NlcHROZXcsIF9kaWZmQWNjZXB0RWRpdCBhbmQgX2ZpZWxkRWRpdFNhdmUgZHJvcHBlZDogdGhlaXIgb25seVxuLy8gY29uc3VtZXJzIHdlcmUgdWkuanMncyBvd24gaW5saW5lIGhhbmRsZXJzLCBub3cgYWRkRXZlbnRMaXN0ZW5lciBpbnNpZGVcbi8vIHVpLmpzIGl0c2VsZiwgc28gbm90aGluZyBvdXRzaWRlIHRoZSBtb2R1bGUgbmVlZHMgdGhlbSBvZmYgd2luZG93IGFueW1vcmUuXG53aW5kb3cuc2hvd0FsZXJ0ID0gc2hvd0FsZXJ0O1xud2luZG93LmNsb3NlQWxlcnRNb2RhbCA9IGNsb3NlQWxlcnRNb2RhbDtcbndpbmRvdy5zaG93Q29uZmlybSA9IHNob3dDb25maXJtO1xud2luZG93Ll9jb25maXJtQ2FuY2VsID0gX2NvbmZpcm1DYW5jZWw7XG53aW5kb3cub3BlbkFjdGlvbnNNb2RhbCA9IG9wZW5BY3Rpb25zTW9kYWw7XG53aW5kb3cuY2xvc2VBY3Rpb25zTW9kYWwgPSBjbG9zZUFjdGlvbnNNb2RhbDtcbndpbmRvdy50b3Btb3N0VmlzaWJsZU1vZGFsID0gdG9wbW9zdFZpc2libGVNb2RhbDtcbndpbmRvdy5fbWVudUFycm93S2V5ZG93biA9IF9tZW51QXJyb3dLZXlkb3duO1xud2luZG93LmlzSGFtYnVyZ2VyT3BlbiA9IGlzSGFtYnVyZ2VyT3BlbjtcbndpbmRvdy50b2dnbGVIYW1idXJnZXIgPSB0b2dnbGVIYW1idXJnZXI7XG53aW5kb3cuY2xvc2VIYW1idXJnZXIgPSBjbG9zZUhhbWJ1cmdlcjtcbndpbmRvdy5vcGVuQ29udHJvbHNNb2RhbCA9IG9wZW5Db250cm9sc01vZGFsO1xud2luZG93LmNsb3NlQ29udHJvbHNNb2RhbCA9IGNsb3NlQ29udHJvbHNNb2RhbDtcbndpbmRvdy5vcGVuRGlmZk1vZGFsID0gb3BlbkRpZmZNb2RhbDtcbndpbmRvdy5fZGlmZkRpc2NhcmQgPSBfZGlmZkRpc2NhcmQ7XG53aW5kb3cub3BlbkZpZWxkRWRpdE1vZGFsID0gb3BlbkZpZWxkRWRpdE1vZGFsO1xud2luZG93LmNsb3NlRmllbGRFZGl0TW9kYWwgPSBjbG9zZUZpZWxkRWRpdE1vZGFsO1xud2luZG93LmNsb3NlS2ViYWIgPSBjbG9zZUtlYmFiO1xud2luZG93LnNob3dLZWJhYiA9IHNob3dLZWJhYjtcbndpbmRvdy5pbml0UmVzaXplID0gaW5pdFJlc2l6ZTtcbndpbmRvdy5fYXBwbHlQcmVyZXFXYXJuaW5ncyA9IF9hcHBseVByZXJlcVdhcm5pbmdzO1xud2luZG93LnNob3dVbmRvVG9hc3QgPSBzaG93VW5kb1RvYXN0O1xud2luZG93LnBsYXliYWNrUmF0ZVByZWYgPSBwbGF5YmFja1JhdGVQcmVmO1xud2luZG93LmFwcGx5UGxheWJhY2tSYXRlID0gYXBwbHlQbGF5YmFja1JhdGU7XG53aW5kb3cuaW5pdFBsYXliYWNrUmF0ZSA9IGluaXRQbGF5YmFja1JhdGU7XG4vLyBoZWxwbW9kYWxzLmpzIC0gZXZlcnkgbmFtZSBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpYyAoYnVuZGxlLmpzKVxuLy8gY29uc3VtZXIgKGJvb3QuanMsIHZpZGVvcy5qcywgc2hvcnRjdXRzLmpzLCBzZXR0aW5ncy5qcyBjYWxsIHRoZXNlIGFzIGJhcmVcbi8vIGdsb2JhbHMpIG9yIGEgdGVzdHMvdWkvKi5weSBwYWdlLmV2YWx1YXRlLCBzbyBub25lIGNhbiBiZSBkcm9wcGVkIHlldC5cbndpbmRvdy5vcGVuR2V0dGluZ1N0YXJ0ZWRNb2RhbCA9IG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsO1xud2luZG93LmNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCA9IGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbDtcbndpbmRvdy5vcGVuQWJvdXRNb2RhbCA9IG9wZW5BYm91dE1vZGFsO1xud2luZG93LmNsb3NlQWJvdXRNb2RhbCA9IGNsb3NlQWJvdXRNb2RhbDtcbndpbmRvdy5vcGVuSGVscE1vZGFsID0gb3BlbkhlbHBNb2RhbDtcbndpbmRvdy5jbG9zZUhlbHBNb2RhbCA9IGNsb3NlSGVscE1vZGFsO1xud2luZG93Lm9wZW5HbG9zc2FyeU1vZGFsID0gb3Blbkdsb3NzYXJ5TW9kYWw7XG53aW5kb3cuY2xvc2VHbG9zc2FyeU1vZGFsID0gY2xvc2VHbG9zc2FyeU1vZGFsO1xud2luZG93Ll9maWx0ZXJHbG9zc2FyeSA9IF9maWx0ZXJHbG9zc2FyeTtcbi8vIG1vZGVsY2F0YWxvZy5qcyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWMgKGJ1bmRsZS5qcylcbi8vIGNvbnN1bWVyOiBzZXR0aW5ncy5qcyBjYWxscyBfZW5zdXJlTW9kZWxDYXRhbG9nL3JlZnJlc2hNb2RlbENhdGFsb2cvXG4vLyBfdXBkYXRlTGxtQ2FwYWJpbGl0aWVzL19yZW5kZXJDYXBhYmlsaXR5VGllcnMgYXMgYmFyZSBnbG9iYWxzLCBtb2RlbGRvd25sb2FkLmpzXG4vLyBjaGVja3MvY2FsbHMgX3VwZGF0ZUxsbUNhcGFiaWxpdGllcy9fcmVuZGVyQ2FwYWJpbGl0eVRpZXJzLCBhbmQgY2xpcHMuanMgY2FsbHNcbi8vIGdhdGVPbkNhcGFiaWxpdHkgKGFsc28gcmVhZCBkaXJlY3RseSBieSB0ZXN0cy91aS90ZXN0X3VpX21vZGVsX2NhdGFsb2cucHkgdmlhXG4vLyBwYWdlLmV2YWx1YXRlKS4gcHJlZmV0Y2hNb2RlbCBhbmQgZG93bmxvYWRHZ3VmTW9kZWwgZHJvcHBlZDogYm90aCBhcmUgd2lyZWRcbi8vIGludGVybmFsbHkgdmlhIGFkZEV2ZW50TGlzdGVuZXIvZGF0YS0qIGRlbGVnYXRpb24gYW5kIGhhdmUgbm8gb3V0c2lkZSBjYWxsZXIuXG53aW5kb3cuX2Vuc3VyZU1vZGVsQ2F0YWxvZyA9IF9lbnN1cmVNb2RlbENhdGFsb2c7XG53aW5kb3cucmVmcmVzaE1vZGVsQ2F0YWxvZyA9IHJlZnJlc2hNb2RlbENhdGFsb2c7XG53aW5kb3cuX3VwZGF0ZUxsbUNhcGFiaWxpdGllcyA9IF91cGRhdGVMbG1DYXBhYmlsaXRpZXM7XG53aW5kb3cuX3JlbmRlckNhcGFiaWxpdHlUaWVycyA9IF9yZW5kZXJDYXBhYmlsaXR5VGllcnM7XG53aW5kb3cuZ2F0ZU9uQ2FwYWJpbGl0eSA9IGdhdGVPbkNhcGFiaWxpdHk7XG4vLyB2aWRlb3MuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWNcbi8vIChidW5kbGUuanMpIGNvbnN1bWVyIG9yIGEgdGVzdHMvdWkvKi5weSBwYWdlLmV2YWx1YXRlLiBfY2xpcHNTb3J0UGFyYW0gaXNcbi8vIENSSVRJQ0FMOiBmb3JtYXQuanMgKGFscmVhZHkgRVNNKSByZWFkcyBpdCBhcyB3aW5kb3cuX2NsaXBzU29ydFBhcmFtLCBzbyBpdFxuLy8gY2FuIG5ldmVyIGJlIGRyb3BwZWQgZXZlbiBpZiBldmVyeSBjbGFzc2ljIGNvbnN1bWVyIGdvZXMgYXdheS4gRWxldmVuIG5hbWVzXG4vLyAocmVhbmFseXplVmlkZW8sIHJlZGlhcml6ZVZpZGVvLCByZWV4dHJhY3RWaWRlb1J1biwgcmV0cmFuc2NyaWJlVmlkZW9SdW4sXG4vLyByZWdlbmVyYXRlQ2xpcHNSdW4sIHVuc3BsaXRWaWRlbywgX2RvVW5zcGxpdFZpZGVvLCBvcGVuVmlkZW9TdW1tYXJ5S2ViYWIsXG4vLyBvcGVuVmlkZW9UaXRsZUtlYmFiLCBfc3luY1ZpZGVvRmlsdGVyQ2hpcHMsIF9jbGVhclZpZGVvRmlsdGVycykgZHJvcHBlZDogdGhlaXJcbi8vIG9ubHkgY2FsbGVycyB3ZXJlIHZpZGVvcy5qcydzIG93biBpbmxpbmUgaGFuZGxlcnMgKG5vdyBkYXRhLWFjdCBkZWxlZ2F0aW9uKSBvclxuLy8gaXRzIG93biBpbnRlcm5hbCBsb2dpYywgc28gbm90aGluZyBvdXRzaWRlIHRoZSBtb2R1bGUgbmVlZHMgdGhlbSBvZmYgd2luZG93Llxud2luZG93LmxvYWRWaWRlb3MgPSBsb2FkVmlkZW9zO1xud2luZG93LnNlbGVjdFZpZGVvID0gc2VsZWN0VmlkZW87XG53aW5kb3cucmVuZGVyVmlkZW9EZXRhaWwgPSByZW5kZXJWaWRlb0RldGFpbDtcbndpbmRvdy5kZWxldGVWaWRlbyA9IGRlbGV0ZVZpZGVvO1xud2luZG93Lm9uQ2xpcHNTb3J0Q2hhbmdlID0gb25DbGlwc1NvcnRDaGFuZ2U7XG53aW5kb3cuX2NsaXBzU29ydFBhcmFtID0gX2NsaXBzU29ydFBhcmFtO1xud2luZG93Ll9jbGlwc0xpc3RVcmwgPSBfY2xpcHNMaXN0VXJsO1xud2luZG93Ll9yZWFuYWx5emVQYXJhbXMgPSBfcmVhbmFseXplUGFyYW1zO1xud2luZG93Ll9uZWVkc01vZGVsQ3RhSFRNTCA9IF9uZWVkc01vZGVsQ3RhSFRNTDtcbndpbmRvdy5fdXBkYXRlRGVtb0J1dHRvbiA9IF91cGRhdGVEZW1vQnV0dG9uO1xud2luZG93Ll91cGRhdGVTdGFydEluZ2VzdEJ1dHRvbiA9IF91cGRhdGVTdGFydEluZ2VzdEJ1dHRvbjtcbndpbmRvdy5fYW5hbHlzaXNMaXZlUGFuZWxIVE1MID0gX2FuYWx5c2lzTGl2ZVBhbmVsSFRNTDtcbndpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsID0gX3N5bmNBbmFseXNpc0xpdmVQYW5lbDtcbndpbmRvdy5fYXBwbHlWaWRlb0ZpbHRlcnMgPSBfYXBwbHlWaWRlb0ZpbHRlcnM7XG53aW5kb3cuX3JlbmRlclZpZGVvTGlzdCA9IF9yZW5kZXJWaWRlb0xpc3Q7XG53aW5kb3cuc2V0VmlkZW9TZWFyY2ggPSBzZXRWaWRlb1NlYXJjaDtcbndpbmRvdy5zZXRWaWRlb1NvcnQgPSBzZXRWaWRlb1NvcnQ7XG53aW5kb3cudG9nZ2xlVmlkZW9Tb3J0RGlyID0gdG9nZ2xlVmlkZW9Tb3J0RGlyO1xud2luZG93LnRvZ2dsZVZpZGVvRmlsdGVyID0gdG9nZ2xlVmlkZW9GaWx0ZXI7XG53aW5kb3cub3BlblZpZGVvQWN0aW9uc01vZGFsID0gb3BlblZpZGVvQWN0aW9uc01vZGFsO1xuLy8gdmlkZW9zLXRpbWVsaW5lLmpzIC0gZ2VuZXJhdGVUaW1lbGluZSwgX3JlbmRlclRpbWVsaW5lSFRNTCBhbmRcbi8vIF90aW1lbGluZUVtcHR5Tm90ZUhUTUwgYXJlIHJlYWQgYXMgd2luZG93LiogYnkgdmlkZW9zLmpzIChhbHJlYWR5LUVTTSwgYnV0XG4vLyB2aWRlb3MuanMncyBvd24gbWlncmF0aW9uIHByZWRhdGVzIHRoaXMgb25lIGFuZCBuZXZlciBzd2l0Y2hlZCB0aGVzZSB0aHJlZVxuLy8gdG8gYW4gaW1wb3J0IC0gb3V0IG9mIHNjb3BlIGhlcmUgdG8gdG91Y2ggdmlkZW9zLmpzKS4gY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWxcbi8vIGlzIGNhbGxlZCBhcyBhIGJhcmUgZ2xvYmFsIGJ5IHNob3J0Y3V0cy5qcydzIEVzY2FwZS1rZXkgbW9kYWwtY2xvc2VyIG1hcFxuLy8gKHNob3J0Y3V0cy5qcyBoYXNuJ3QgYmVlbiB1cGRhdGVkIHRvIGltcG9ydCBpdCBkaXJlY3RseSAtIGFsc28gb3V0IG9mIHNjb3BlKS5cbi8vIGNvbmZpcm1HZW5lcmF0ZVRpbWVsaW5lIGFuZCB1cGRhdGVUaW1lbGluZUludGVydmFsSGludCBkcm9wcGVkOiB0aGVpciBvbmx5XG4vLyBjYWxsZXJzIHdlcmUgdGhpcyBtb2R1bGUncyBvd24gaW5saW5lIGhhbmRsZXJzLCBub3cgYWRkRXZlbnRMaXN0ZW5lciBpbnNpZGVcbi8vIHZpZGVvcy10aW1lbGluZS5qcyBpdHNlbGYuXG53aW5kb3cuZ2VuZXJhdGVUaW1lbGluZSA9IGdlbmVyYXRlVGltZWxpbmU7XG53aW5kb3cuY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwgPSBjbG9zZVRpbWVsaW5lSW50ZXJ2YWxNb2RhbDtcbndpbmRvdy5fcmVuZGVyVGltZWxpbmVIVE1MID0gX3JlbmRlclRpbWVsaW5lSFRNTDtcbndpbmRvdy5fdGltZWxpbmVFbXB0eU5vdGVIVE1MID0gX3RpbWVsaW5lRW1wdHlOb3RlSFRNTDtcbi8vIHZpZGVvcy1zdW1tYXJ5LmpzIC0gc3VtbWFyaXplVmlkZW8gYW5kIHJlZ2VuU3VtbWFyeUF1dG8gYXJlIHJlYWQgYXMgd2luZG93Lipcbi8vIGJ5IHZpZGVvcy5qcyAoYWxyZWFkeS1FU00sIGJ1dCBvdXQgb2Ygc2NvcGUgdG8gc3dpdGNoIHRvIGFuIGltcG9ydCBoZXJlKSBhbmRcbi8vIHJlZ2VuU3VtbWFyeUF1dG8gaXMgYWxzbyBpbnZva2VkIGRpcmVjdGx5IGJ5IHRlc3RzL3VpL3Rlc3RfdWlfdmlkZW8ucHkgdmlhXG4vLyBwYWdlLmV2YWx1YXRlLiBfZG9SZWdlblN1bW1hcnlBdXRvIGRyb3BwZWQ6IGl0cyBvbmx5IGNhbGxlciB3YXMgdGhpcyBtb2R1bGUnc1xuLy8gb3duIHJlZ2VuU3VtbWFyeUF1dG8sIHNvIG5vdGhpbmcgb3V0c2lkZSB0aGUgbW9kdWxlIG5lZWRzIGl0IG9mZiB3aW5kb3cuXG53aW5kb3cuc3VtbWFyaXplVmlkZW8gPSBzdW1tYXJpemVWaWRlbztcbndpbmRvdy5yZWdlblN1bW1hcnlBdXRvID0gcmVnZW5TdW1tYXJ5QXV0bztcbi8vIHZpZGVvcy1ydW5tZXRhLmpzIC0gX3JlbmRlclJ1bk1ldGFDYXJkIGFuZCBfcnVuVGltaW5nTGluZSBhcmUgcmVhZCBhc1xuLy8gd2luZG93LiogYnkgdmlkZW9zLmpzIChhbHJlYWR5LUVTTSwgYnV0IG91dCBvZiBzY29wZSB0byBzd2l0Y2ggdG8gYW4gaW1wb3J0XG4vLyBoZXJlKS5cbndpbmRvdy5fcmVuZGVyUnVuTWV0YUNhcmQgPSBfcmVuZGVyUnVuTWV0YUNhcmQ7XG53aW5kb3cuX3J1blRpbWluZ0xpbmUgPSBfcnVuVGltaW5nTGluZTtcbi8vIHNlc3Npb25zLmpzIC0gU2Vzc2lvblVJLCBpc1Nlc3Npb25Db2xsYXBzZWQgYW5kIHNlc3Npb25Hcm91cEhlYWRlckxpIGFyZSByZWFkXG4vLyBhcyB3aW5kb3cuKiBieSB2aWRlb3MuanMgKGFscmVhZHktRVNNLCBidXQgb3V0IG9mIHNjb3BlIHRvIHN3aXRjaCB0byBhbiBpbXBvcnRcbi8vIGhlcmUpOyB0b2dnbGVHcm91cFNlbGVjdCBpcyBpbnZva2VkIGRpcmVjdGx5IGJ5IHRlc3RzL3VpL3Rlc3RfdWlfc2Vzc2lvbnMucHlcbi8vIHZpYSBwYWdlLmV2YWx1YXRlLiBFdmVyeXRoaW5nIGVsc2Ugc3RheXMgbW9kdWxlLXByaXZhdGU6IGxvYWRTZXNzaW9ucyxcbi8vIGVudGVyR3JvdXBpbmdNb2RlLCBzdWdnZXN0U2Vzc2lvbnMgYW5kIHNlbGVjdFNlc3Npb24gYXJlIG9ubHkgY2FsbGVkIGJ5IHRoaXNcbi8vIG1vZHVsZSdzIG93biBpbnRlcm5hbCBsb2dpYywgYW5kIGV4aXRHcm91cGluZ01vZGUsIGNvbmZpcm1Hcm91cFNlbGVjdGlvbiBhbmRcbi8vIG9wZW5SZWNvcmRpbmdzQWN0aW9uc01lbnUgYXJlIG5vdyB3aXJlZCB0byB0aGVpciBzdGF0aWMgaW5kZXguaHRtbCBidXR0b25zIHZpYVxuLy8gYWRkRXZlbnRMaXN0ZW5lciBpbnNpZGUgc2Vzc2lvbnMuanMgaXRzZWxmIChubyBpbmxpbmUgb25jbGljayBsZWZ0KS5cbndpbmRvdy5TZXNzaW9uVUkgPSBTZXNzaW9uVUk7XG53aW5kb3cuaXNTZXNzaW9uQ29sbGFwc2VkID0gaXNTZXNzaW9uQ29sbGFwc2VkO1xud2luZG93LnNlc3Npb25Hcm91cEhlYWRlckxpID0gc2Vzc2lvbkdyb3VwSGVhZGVyTGk7XG53aW5kb3cudG9nZ2xlR3JvdXBTZWxlY3QgPSB0b2dnbGVHcm91cFNlbGVjdDtcbi8vIGNsaXBzLmpzIC0gZXZlcnkgbmFtZSBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpYyAoYnVuZGxlLmpzKVxuLy8gY29uc3VtZXIsIGEgc3RpbGwtY2xhc3NpYyBtb2R1bGUgcmVhZGluZyBpdCBhcyB3aW5kb3cuKiAoc2hvcnRjdXRzLmpzIHJlYWRzXG4vLyBzZXRTdGF0dXMvdW5kb0xhc3RTdGF0dXMvY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwvY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbDtcbi8vIGpvYnMuanMgcmVhZHMgX3JlbmRlckNsaXBGaWx0ZXJDb3VudHM7IHZpZGVvcy5qcyByZWFkcyBfc3luY0ZpbHRlckNoaXBzKSwgb3IgYVxuLy8gdGVzdHMvdWkvKi5weSBwYWdlLmV2YWx1YXRlLiBzZXRDbGlwU2VhcmNoLCBzZXRDbGlwU2NvcmVNaW4sIF9jbGVhckNsaXBGaWx0ZXJzLFxuLy8gc2V0Q2xpcEtpbmQsIF9zeW5jS2luZENoaXBzLCB0b2dnbGVDbGlwU29ydERpciwgZGVsZXRlQ2xpcCwgZGVsZXRlRXhwb3J0LFxuLy8gbWVyZ2VDbGlwcywgc2NhbkR1cGxpY2F0ZXMsIG9wZW5DbGlwc0FjdGlvbnNNZW51LCBfc2NvcmVPdmVycmlkZVNhdmUsXG4vLyBjbGVhclNjb3JlT3ZlcnJpZGUsIG9wZW5EZXNjS2ViYWIsIG9wZW5EZXNjTG9uZ0tlYmFiLCBzdGFydEZpbmRTaW1pbGFyIGFuZFxuLy8gb3BlblNpbWlsYXJDbGlwc01vZGFsIGRyb3BwZWQ6IHRoZWlyIG9ubHkgY2FsbGVycyB3ZXJlIGNsaXBzLmpzJ3Mgb3duIGlubGluZVxuLy8gaGFuZGxlcnMgKG5vdyBkYXRhLWFjdCBkZWxlZ2F0aW9uIG9yIHN0YXRpYyBpbmRleC5odG1sIHdpcmluZyBpbnNpZGVcbi8vIGNsaXBzLmpzIGl0c2VsZikgb3IgaXRzIG93biBpbnRlcm5hbCBsb2dpYywgc28gbm90aGluZyBvdXRzaWRlIHRoZSBtb2R1bGVcbi8vIG5lZWRzIHRoZW0gb2ZmIHdpbmRvdyBhbnltb3JlLlxud2luZG93LnNlbGVjdENsaXAgPSBzZWxlY3RDbGlwO1xud2luZG93LnNldFN0YXR1cyA9IHNldFN0YXR1cztcbndpbmRvdy51bmRvTGFzdFN0YXR1cyA9IHVuZG9MYXN0U3RhdHVzO1xud2luZG93LnJlbmRlckRldGFpbCA9IHJlbmRlckRldGFpbDtcbndpbmRvdy5yZW5kZXJQbGF5ZXIgPSByZW5kZXJQbGF5ZXI7XG53aW5kb3cuY2xlYXJEZXRhaWwgPSBjbGVhckRldGFpbDtcbndpbmRvdy5yZWZyZXNoQ2xpcERldGFpbCA9IHJlZnJlc2hDbGlwRGV0YWlsO1xud2luZG93Ll9yZWxlYXNlUGxheWVyQmVmb3JlRGVsZXRlID0gX3JlbGVhc2VQbGF5ZXJCZWZvcmVEZWxldGU7XG53aW5kb3cuYW5hbHl6ZUZyYW1lcyA9IGFuYWx5emVGcmFtZXM7XG53aW5kb3cudG9nZ2xlQ2xpcEZpbHRlciA9IHRvZ2dsZUNsaXBGaWx0ZXI7XG53aW5kb3cuX3N5bmNGaWx0ZXJDaGlwcyA9IF9zeW5jRmlsdGVyQ2hpcHM7XG53aW5kb3cuX2FwcGx5RmlsdGVycyA9IF9hcHBseUZpbHRlcnM7XG53aW5kb3cuX3JlbmRlckNsaXBzID0gX3JlbmRlckNsaXBzO1xud2luZG93Ll9wYXJzZVRpbWluZ09mZnNldCA9IF9wYXJzZVRpbWluZ09mZnNldDtcbndpbmRvdy5fcmVsb2FkQ2xpcExpc3QgPSBfcmVsb2FkQ2xpcExpc3Q7XG53aW5kb3cuX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMgPSBfcmVuZGVyQ2xpcEZpbHRlckNvdW50cztcbndpbmRvdy5vcGVuU2NvcmVPdmVycmlkZSA9IG9wZW5TY29yZU92ZXJyaWRlO1xud2luZG93LmNsb3NlU2NvcmVPdmVycmlkZU1vZGFsID0gY2xvc2VTY29yZU92ZXJyaWRlTW9kYWw7XG53aW5kb3cuY2xvc2VTaW1pbGFyQ2xpcHNNb2RhbCA9IGNsb3NlU2ltaWxhckNsaXBzTW9kYWw7XG53aW5kb3cub3BlbkNsaXBBY3Rpb25zTW9kYWwgPSBvcGVuQ2xpcEFjdGlvbnNNb2RhbDtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7O0FBTU8sTUFBTSxXQUFXO0FBQUEsSUFDdEIsZUFBcUI7QUFBQSxJQUNyQixjQUFx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LG9CQUFvQjtBQUMzQixTQUFPLDBCQUEwQkM7QUFDakMsU0FBTyx5QkFBeUJDO0FBQ2hDLFNBQU8sdUJBQXVCOyIsCiAgIm5hbWVzIjogWyJlbCIsICJfQkdfRElTTUlTU19NT0RBTFMiLCAiX3dpcmVNb2RhbEJnRGlzbWlzc2FscyIsICJfd2lyZU1vZGFsQnV0dG9ucyIsICJfd2lyZUhhbWJ1cmdlckhhbmRsZXJzIiwgIl9zeW5jQW5hbHlzaXNMaXZlUGFuZWwiLCAiY2xvc2VUaW1lbGluZUludGVydmFsTW9kYWwiLCAicmVzIiwgIl9yZW5kZXJDbGlwRmlsdGVyQ291bnRzIiwgInNlbGVjdENsaXAiLCAiX2hhbmRsZURldGFpbENsaWNrIiwgInNldFN0YXR1cyIsICJjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCIsICJ1bmRvTGFzdFN0YXR1cyIsICJjbG9zZVNpbWlsYXJDbGlwc01vZGFsIiwgImNsb3NlU2ltaWxhckNsaXBzTW9kYWwiLCAiY2xvc2VTY29yZU92ZXJyaWRlTW9kYWwiLCAiX3N5bmNBbmFseXNpc0xpdmVQYW5lbCIsICJjbG9zZVRpbWVsaW5lSW50ZXJ2YWxNb2RhbCIsICJzZWxlY3RDbGlwIiwgInNldFN0YXR1cyIsICJ1bmRvTGFzdFN0YXR1cyIsICJfcmVuZGVyQ2xpcEZpbHRlckNvdW50cyIsICJjbG9zZVNjb3JlT3ZlcnJpZGVNb2RhbCIsICJjbG9zZVNpbWlsYXJDbGlwc01vZGFsIl0KfQo=
