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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3RhdGUuanMiLCAiZm9ybWF0LmpzIiwgImNvbG9ycGlja2VyLmpzIiwgInBhbmVsbmF2LmpzIiwgImpvYnMuanMiLCAicHJldmlldy5qcyIsICJ1dGlscy5qcyIsICJ1aS5qcyIsICJoZWxwbW9kYWxzLmpzIiwgIm1haW4uZXNtLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBGZWF0dXJlLW1hcCAtIFNoYXJlZCBhcHBsaWNhdGlvbiBzdGF0ZTogdGhlIHNpbmdsZSBBcHBTdGF0ZSBvYmplY3QgZXZlcnkgZmVhdHVyZSBtb2R1bGUgcmVhZHMvd3JpdGVzLlxuLy8gICBBUEk6IG5vbmUgKGNsaWVudC1vbmx5KSDCtyBUZXN0czogY292ZXJlZCBpbmRpcmVjdGx5IGJ5IHRoZSB0ZXN0X3VpXyoucHkgc3VpdGVzXG4vLyDilIDilIAgc2hhcmVkIGFwcGxpY2F0aW9uIHN0YXRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTXV0YWJsZSBzdGF0ZSBzaGFyZWQgYWNyb3NzIGZlYXR1cmUgbW9kdWxlcy4gQ2VudHJhbGl6ZWQgaW4gb25lIGV4cGxpY2l0IG9iamVjdFxuLy8gc28gY3Jvc3MtbW9kdWxlIHJlYWRzL3dyaXRlcyBhcmUgZ3JlcHBhYmxlIGFuZCBvYnZpb3VzbHkgc2hhcmVkLCByYXRoZXIgdGhhblxuLy8gc2NhdHRlcmVkIGJhcmUgZ2xvYmFscyB0aGF0IGxvb2sgbGlrZSBtb2R1bGUgbG9jYWxzIGF0IHRoZSBjYWxsIHNpdGUuXG5leHBvcnQgY29uc3QgQXBwU3RhdGUgPSB7XG4gIGFjdGl2ZVZpZGVvSWQ6ICAgICAgIG51bGwsXG4gIGFjdGl2ZUNsaXBJZDogICAgICAgIG51bGwsXG4gIHZpZGVvczogICAgICAgICAgICAgIFtdLFxuICBzZXNzaW9uczogICAgICAgICAgICBbXSwgICAgICAgLy8gZ3JvdXBlZCBwbGF5IHNlc3Npb25zIChSZWNvcmRpbmdTZXNzaW9uIHJvd3MpXG4gIGFjdGl2ZVNlc3Npb25JZDogICAgIG51bGwsICAgICAvLyBzZXNzaW9uIHdob3NlIGRldGFpbCB2aWV3IGlzIG9wZW4sIG9yIG51bGxcbiAgY2xpcHM6ICAgICAgICAgICAgICAgW10sXG4gIGFuYWx5emVQcm9maWxlczogICAgIFtdLFxuICBjb250ZXh0czogICAgICAgICAgICBbXSxcbiAgaG90V29yZHM6ICAgICAgICAgICAgW10sXG4gIF9ob3RXb3Jkc0xvYWRlZDogICAgIGZhbHNlLFxuICBzZW5zaXRpdmVUZXJtczogICAgICBbXSxcbiAgX3NlbnNpdGl2ZVRlcm1zTG9hZGVkOiBmYWxzZSxcbiAgYW5hbHl6ZUZpbGVuYW1lOiAgICAgbnVsbCxcbiAgZWRpdGluZ0NvbnRleHRJZDogICAgbnVsbCxcbiAgY2xpcEZpbHRlcnM6ICAgICAgICAgbmV3IFNldCgpLCAgLy8gYWN0aXZlIGZpbHRlciB0b2tlbnM7IGVtcHR5ID0gc2hvdyBhbGxcbiAgY2xpcEtpbmQ6ICAgICAgICAgICAgJ2NsaXAnLCAgICAgIC8vIGNhbmRpZGF0ZSB0eXBlIHNob3duOiAnY2xpcCcgfCAnc2NlbmUnIChzZXJ2ZXItc2lkZSBmaWx0ZXIpXG4gIGNsaXBTZWFyY2g6ICAgICAgICAgICcnLFxuICBjbGlwU2NvcmVNaW46ICAgICAgICAwLFxuICB2aWRlb1NlYXJjaDogICAgICAgICAnJyxcbiAgdmlkZW9Tb3J0OiAgICAgICAgICAgJ3JlY2VudCcsXG4gIHZpZGVvU29ydERpcjogICAgICAgICdkZXNjJywgIC8vICdkZXNjJyA9IHRoZSBzb3J0IG9wdGlvbidzIG5hdHVyYWwgb3JkZXI7ICdhc2MnIHJldmVyc2VzIGl0XG4gIGNsaXBTb3J0RGlyOiAgICAgICAgICdkZXNjJyxcbiAgdmlkZW9GaWx0ZXJzOiAgICAgICAgbmV3IFNldCgpLCAgLy8gYWN0aXZlIHZpZGVvIGZpbHRlciB0b2tlbnM7IGVtcHR5ID0gc2hvdyBhbGxcbiAgc2VsZWN0ZWRDbGlwSWRzOiAgICAgbmV3IFNldCgpLFxuICBsYXN0U3RhdHVzQ2hhbmdlOiAgICBudWxsLCAvLyB7Y2xpcElkLCBmcm9tU3RhdHVzLCB0aW1lcn1cbiAgbGFzdEJ1bGtTdGF0dXNDaGFuZ2U6IG51bGwsIC8vIHtwcmV2aW91czoge2NsaXBJZDogZnJvbVN0YXR1c30sIHRpbWVyfVxuICBjb25maXJtQ2FsbGJhY2s6ICAgICBudWxsLFxuICBhY3RpdmVDbGlwRGF0YTogICAgICBudWxsLFxuICBjbGlwSm9iczogICAgICAgICAgICB7fSwgICAvLyBjbGlwSWQgLT4ge29wfSBmb3IgYSBwZXItY2xpcCBhc3luYyBqb2IgaW4gZmxpZ2h0IChhbmFseXplLWZyYW1lcyksIHNvIGl0c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpbmRpY2F0b3Igc3Vydml2ZXMgYSByZW5kZXJEZXRhaWwgcmVidWlsZCAvIGNsaXAgc3dpdGNoIChzdGF0ZSwgbm90IGEgRE9NIG5vZGUpXG4gIGFjdGl2ZU1lZGlhRmlsZW5hbWU6IG51bGwsXG4gIGFjdGl2ZVZpZGVvRGF0YTogICAgIG51bGwsXG4gIGJvb3RSZXN0b3JlRG9uZTogICAgIGZhbHNlLFxuICBleHBvcnREaXI6ICAgICAgICAgICBudWxsLFxuICByZWVsc0RpcjogICAgICAgICAgICBudWxsLFxuICBjYW5SZXZlYWw6ICAgICAgICAgICBmYWxzZSxcbn07XG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBQdXJlIGZvcm1hdHRlcnMgYW5kIHNjb3JlIGhlbHBlcnM6IG5vIERPTSwgbm8gZmV0Y2guIEhUTUwtZXNjYXBlLCBBUEktZXJyb3IgdGV4dCxcclxuLy8gICBkdXJhdGlvbi9kYXRlL29mZnNldCBmb3JtYXR0aW5nLCB2aWRlby1zdGF0dXMgbGFiZWxzLCBhbmQgdGhlIHNjb3JlIGNvbG9yL2ljb24gZW5jb2RpbmcuXHJcbi8vICAgQVBJOiBub25lIChjbGllbnQtb25seSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHlcclxuLy8g4pSA4pSAIHNjb3JlIHV0aWxzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5mdW5jdGlvbiBfc2NvcmVJY29uKHNjb3JlKSB7XHJcbiAgY29uc3QgY29sb3IgPSBzY29yZSA+PSAwLjcgPyAndmFyKC0tZ3JlZW4pJyA6IHNjb3JlID49IDAuNCA/ICd2YXIoLS13YXJuaW5nKScgOiAndmFyKC0tbXV0ZWQpJztcclxuICByZXR1cm4gYDxzcGFuIHN0eWxlPVwiY29sb3I6JHtjb2xvcn07Zm9udC1zaXplOjEwcHhcIiBhcmlhLWhpZGRlbj1cInRydWVcIj4mIzExMDg4Ozwvc3Bhbj5gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfbGVycENvbG9yKGMxLCBjMiwgdCkge1xyXG4gIGNvbnN0IGggPSBjID0+IFtwYXJzZUludChjLnNsaWNlKDEsMyksMTYpLCBwYXJzZUludChjLnNsaWNlKDMsNSksMTYpLCBwYXJzZUludChjLnNsaWNlKDUsNyksMTYpXTtcclxuICBjb25zdCBbcjEsZzEsYjFdID0gaChjMSksIFtyMixnMixiMl0gPSBoKGMyKTtcclxuICByZXR1cm4gYHJnYigke01hdGgucm91bmQocjErKHIyLXIxKSp0KX0sJHtNYXRoLnJvdW5kKGcxKyhnMi1nMSkqdCl9LCR7TWF0aC5yb3VuZChiMSsoYjItYjEpKnQpfSlgO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc2NvcmVCb3JkZXJDb2xvcihzY29yZSwgaXNSZWplY3RlZCkge1xyXG4gIGlmIChpc1JlamVjdGVkKSByZXR1cm4gJ3ZhcigtLW11dGVkKSc7XHJcbiAgY29uc3Qgc3RvcHMgPSBbWzAsJyM2YjZiODAnXSxbMC4zLCcjNGZjM2Y3J10sWzAuNSwnIzRjYWY3ZCddLFswLjcsJyNmMGMwNjAnXSxbMS4wLCcjZjdhODVhJ11dO1xyXG4gIGZvciAobGV0IGkgPSAxOyBpIDwgc3RvcHMubGVuZ3RoOyBpKyspIHtcclxuICAgIGlmIChzY29yZSA8PSBzdG9wc1tpXVswXSkge1xyXG4gICAgICBjb25zdCB0ID0gKHNjb3JlIC0gc3RvcHNbaS0xXVswXSkgLyAoc3RvcHNbaV1bMF0gLSBzdG9wc1tpLTFdWzBdKTtcclxuICAgICAgcmV0dXJuIF9sZXJwQ29sb3Ioc3RvcHNbaS0xXVsxXSwgc3RvcHNbaV1bMV0sIHQpO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gc3RvcHNbc3RvcHMubGVuZ3RoLTFdWzFdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc29ydFNjb3JlKGNsaXApIHtcclxuICBjb25zdCBzb3J0ID0gd2luZG93Ll9jbGlwc1NvcnRQYXJhbSgpO1xyXG4gIGlmIChzb3J0ID09PSAnZnVubnknKSAgICByZXR1cm4gY2xpcC5zY29yZV9mdW5ueTtcclxuICBpZiAoc29ydCA9PT0gJ2RyYW1hdGljJykgcmV0dXJuIGNsaXAuc2NvcmVfZHJhbWF0aWM7XHJcbiAgaWYgKHNvcnQgPT09ICdhY3Rpb24nKSAgIHJldHVybiBjbGlwLnNjb3JlX2FjdGlvbjtcclxuICBpZiAoc29ydCA9PT0gJ3Zpc3VhbCcpICAgcmV0dXJuIGNsaXAuc2NvcmVfdmlzdWFsO1xyXG4gIGlmIChzb3J0ID09PSAnbGF1Z2gnKSAgICByZXR1cm4gY2xpcC5zY29yZV9sYXVnaDtcclxuICByZXR1cm4gY2xpcC5zY29yZV9vdmVyYWxsO1xyXG59XHJcblxyXG4vLyDilIDilIAgZm9ybWF0IHV0aWxzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5jb25zdCBfVklERU9fU1RBVFVTX0RJU1BMQVkgPSB7XHJcbiAgcGVuZGluZzogJ05vdCBhbmFseXplZCcsIHByb2JlZDogJ0luc3BlY3RlZCcsIGxhYmVsZWQ6ICdUcmFja3MgYXNzaWduZWQnLFxyXG4gIGV4dHJhY3Rpbmc6ICdFeHRyYWN0aW5nJywgdHJhbnNjcmliaW5nOiAnVHJhbnNjcmliaW5nJywgdHJhbnNjcmliZWQ6ICdUcmFuc2NyaWJlZCcsXHJcbiAgc2VnbWVudGVkOiAnQ2xpcHMgZ2VuZXJhdGVkJywgZG9uZTogJ0FuYWx5emVkJywgZmFpbGVkOiAnQW5hbHlzaXMgaW50ZXJydXB0ZWQnLFxyXG59O1xyXG5mdW5jdGlvbiBfZm10VmlkZW9TdGF0dXMocykgeyByZXR1cm4gX1ZJREVPX1NUQVRVU19ESVNQTEFZW3NdIHx8IHM7IH1cclxuXHJcbmZ1bmN0aW9uIF9tc1RvSG1zKG1zKSB7XHJcbiAgY29uc3QgcyA9IE1hdGguZmxvb3IobXMgLyAxMDAwKTtcclxuICBpZiAocyA8IDYwKSByZXR1cm4gYCR7c31zYDtcclxuICBjb25zdCBtID0gTWF0aC5mbG9vcihzIC8gNjApLCBzZWMgPSBzICUgNjA7XHJcbiAgaWYgKG0gPCA2MCkgcmV0dXJuIGAke219bSAke1N0cmluZyhzZWMpLnBhZFN0YXJ0KDIsICcwJyl9c2A7XHJcbiAgY29uc3QgaCA9IE1hdGguZmxvb3IobSAvIDYwKSwgbWluID0gbSAlIDYwO1xyXG4gIHJldHVybiBgJHtofWggJHtTdHJpbmcobWluKS5wYWRTdGFydCgyLCAnMCcpfW1gO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwbHVyYWwoY291bnQsIHNpbmd1bGFyLCBwbHVyYWxGb3JtKSB7XHJcbiAgcmV0dXJuIGAke2NvdW50fSAke2NvdW50ID09PSAxID8gc2luZ3VsYXIgOiAocGx1cmFsRm9ybSB8fCBzaW5ndWxhciArICdzJyl9YDtcclxufVxyXG5cclxuLy8gU3RhbmRhcmQgZ3VhcmQgZm9yIGFueSBjb21wdXRlZCBudW1iZXIgc2hvd24gdG8gdGhlIHVzZXI6IHJldHVybnMgKnZhbHVlKlxyXG4vLyBvbmx5IHdoZW4gaXQgaXMgYSBmaW5pdGUgbnVtYmVyLCBvdGhlcndpc2UgYSBwbGFpbi1FbmdsaXNoICpmYWxsYmFjayouIE5hTlxyXG4vLyBvciBJbmZpbml0eSAtIHVzdWFsbHkgZnJvbSBhcml0aG1ldGljIG9uIG1pc3NpbmcvcGFydGlhbCBkYXRhIC0gbXVzdCBuZXZlclxyXG4vLyByZWFjaCB0aGUgVUkgYXMgdGhlIGxpdGVyYWwgXCJOYU5cIi9cIkluZmluaXR5XCIuIFVzZSB0aGlzIChvciBmbXREdXJhdGlvbikgYXRcclxuLy8gZXZlcnkgZGlzcGxheSBzaXRlIHRoYXQgZm9ybWF0cyBhIGRlcml2ZWQgbnVtYmVyLlxyXG5mdW5jdGlvbiBmaW5pdGVPcih2YWx1ZSwgZmFsbGJhY2sgPSAnTi9BJykge1xyXG4gIHJldHVybiBOdW1iZXIuaXNGaW5pdGUodmFsdWUpID8gdmFsdWUgOiBmYWxsYmFjaztcclxufVxyXG5cclxuLy8gSHVtYW4tcmVhZGFibGUgY2xpcC9zZWdtZW50IGxlbmd0aC4gUmV0dXJucyAqZmFsbGJhY2sqIGZvciBhIG5vbi1maW5pdGVcclxuLy8gaW5wdXQgKGUuZy4gYSBjbGlwIG1pc3NpbmcgaXRzIHN0YXJ0L2VuZCB0aW1lcykgcmF0aGVyIHRoYW4gXCJOYU4gc2VjXCIuXHJcbmZ1bmN0aW9uIGZtdER1cmF0aW9uKHNlY29uZHMsIGZhbGxiYWNrID0gJ3Vua25vd24nKSB7XHJcbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoc2Vjb25kcykpIHJldHVybiBmYWxsYmFjaztcclxuICByZXR1cm4gc2Vjb25kcyA+PSA2MCA/IGAke01hdGgucm91bmQoc2Vjb25kcyAvIDYwKX0gbWluYCA6IGAke01hdGgucm91bmQoc2Vjb25kcyl9IHNlY2A7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHRydW5jYXRlKHRleHQsIG1heCkge1xyXG4gIHJldHVybiB0ZXh0Lmxlbmd0aCA+IG1heCA/IHRleHQuc2xpY2UoMCwgbWF4IC0gMSkgKyAn4oCmJyA6IHRleHQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGVzY0h0bWwocykge1xyXG4gIHJldHVybiBTdHJpbmcocykucmVwbGFjZSgvJi9nLCcmYW1wOycpLnJlcGxhY2UoLzwvZywnJmx0OycpLnJlcGxhY2UoLz4vZywnJmd0OycpLnJlcGxhY2UoL1wiL2csJyZxdW90OycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmb3JtYXRBcGlFcnJvcihlcnIpIHtcclxuICBpZiAoIWVycikgcmV0dXJuICdVbmtub3duIGVycm9yJztcclxuICBpZiAodHlwZW9mIGVyci5kZXRhaWwgPT09ICdzdHJpbmcnKSByZXR1cm4gZXJyLmRldGFpbDtcclxuICBpZiAoQXJyYXkuaXNBcnJheShlcnIuZGV0YWlsKSkgcmV0dXJuIGVyci5kZXRhaWwubWFwKGUgPT4gZS5tc2cgfHwgSlNPTi5zdHJpbmdpZnkoZSkpLmpvaW4oJzsgJyk7XHJcbiAgaWYgKGVyci5tZXNzYWdlKSByZXR1cm4gZXJyLm1lc3NhZ2U7XHJcbiAgY29uc3Qgc3RyaW5naWZpZWQgPSBKU09OLnN0cmluZ2lmeShlcnIpO1xyXG4gIHJldHVybiAoIXN0cmluZ2lmaWVkIHx8IHN0cmluZ2lmaWVkID09PSAne30nKSA/ICdVbmtub3duIGVycm9yIChubyBkZXRhaWxzIGZyb20gc2VydmVyKScgOiBzdHJpbmdpZmllZDtcclxufVxyXG5cclxuZnVuY3Rpb24gc3RyaXBSaWNoTWFya3VwKHRleHQpIHtcclxuICByZXR1cm4gdGV4dFxyXG4gICAgLnJlcGxhY2UoL1xceDFiXFxbWzAtOTtdKlthLXpBLVpdL2csICcnKSAgLy8gQU5TSSBlc2NhcGUgY29kZXNcclxuICAgIC5yZXBsYWNlKC9cXFtcXC8/XFx3K1xcXS9nLCAnJyk7ICAgICAgICAgICAgIC8vIFJpY2ggbWFya3VwIHRhZ3NcclxufVxyXG5cclxuLy8gU2VydmVyIHRpbWVzdGFtcHMgYXJlIG5haXZlIFVUQyAoU1FMaXRlIERhdGVUaW1lIOKGkiBpc29mb3JtYXQoKSB3aXRoIG5vIHpvbmUpLlxyXG4vLyBUcmVhdCBhIHpvbmUtbGVzcyBzdHJpbmcgYXMgVVRDIHNvIGl0IGlzbid0IHBhcnNlZCBhcyB0aGUgdmlld2VyJ3MgbG9jYWwgdGltZS5cclxuZnVuY3Rpb24gX3BhcnNlU2VydmVyRGF0ZShpc28pIHtcclxuICBjb25zdCBoYXNab25lID0gL1t6Wl0kfFsrLV1cXGR7Mn06P1xcZHsyfSQvLnRlc3QoaXNvKTtcclxuICByZXR1cm4gbmV3IERhdGUoaGFzWm9uZSA/IGlzbyA6IGlzbyArICdaJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXREYXRlKGlzbykge1xyXG4gIGlmICghaXNvKSByZXR1cm4gJ25ldmVyJztcclxuICBjb25zdCBkID0gX3BhcnNlU2VydmVyRGF0ZShpc28pO1xyXG4gIHJldHVybiBkLnRvTG9jYWxlRGF0ZVN0cmluZyh1bmRlZmluZWQsIHttb250aDonc2hvcnQnLCBkYXk6J251bWVyaWMnfSkgKyAnIGF0ICcgK1xyXG4gICAgZC50b0xvY2FsZVRpbWVTdHJpbmcodW5kZWZpbmVkLCB7aG91cjonbnVtZXJpYycsIG1pbnV0ZTonMi1kaWdpdCd9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdEFnbyhpc29TdHJpbmcpIHtcclxuICBjb25zdCBkaWZmUyA9IChEYXRlLm5vdygpIC0gX3BhcnNlU2VydmVyRGF0ZShpc29TdHJpbmcpLmdldFRpbWUoKSkgLyAxMDAwO1xyXG4gIGlmIChkaWZmUyA8IDYwKSAgICByZXR1cm4gJ2p1c3Qgbm93JztcclxuICBpZiAoZGlmZlMgPCAzNjAwKSAgcmV0dXJuIGAke01hdGguZmxvb3IoZGlmZlMgLyA2MCl9bSBhZ29gO1xyXG4gIGlmIChkaWZmUyA8IDg2NDAwKSByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDM2MDApfWggYWdvYDtcclxuICByZXR1cm4gYCR7TWF0aC5mbG9vcihkaWZmUyAvIDg2NDAwKX1kIGFnb2A7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9mbXRPZmZzZXQodikge1xyXG4gIGlmICghdikgcmV0dXJuICcrMC4wJztcclxuICByZXR1cm4gKHYgPj0gMCA/ICcrJyA6ICcnKSArIHYudG9GaXhlZCgxKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2ZtdEVsYXBzZWQobXMpIHtcclxuICBjb25zdCBzID0gTWF0aC5mbG9vcihtcyAvIDEwMDApO1xyXG4gIGNvbnN0IG0gPSBNYXRoLmZsb29yKHMgLyA2MCk7XHJcbiAgcmV0dXJuIG0gPiAwID8gYCR7bX1tICR7cyAlIDYwfXNgIDogYCR7c31zYDtcclxufVxyXG5cclxuLy8g4pSA4pSAIHRpbWVsaW5lIGludGVydmFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5jb25zdCBfVElNRUxJTkVfTUlOX0lOVEVSVkFMX1MgPSAxMDtcclxuXHJcbi8vIENvbnZlcnQgYSB0aW1lbGluZSBpbnRlcnZhbCAodmFsdWUsIHVuaXQpIGludG8gc2Vjb25kczsgbnVsbCBpZiBub24tbnVtZXJpYyBvclxyXG4vLyBiZWxvdyB0aGUgbWluaW11bS4gU2hhcmVkIGJ5IHRoZSBTZXR0aW5ncyBzYXZlIHBhdGggYW5kIHRoZSBwZXItdmlkZW8gdGltZWxpbmVcclxuLy8gZ2VuZXJhdG9yIHNvIHRoZWlyIHZhbGlkYXRpb24gY2FuJ3QgZHJpZnQgYXBhcnQuXHJcbmZ1bmN0aW9uIF9wYXJzZUludGVydmFsUyh2YWx1ZSwgdW5pdCkge1xyXG4gIGNvbnN0IG4gPSBwYXJzZUludCh2YWx1ZSwgMTApO1xyXG4gIGlmIChpc05hTihuKSkgcmV0dXJuIG51bGw7XHJcbiAgY29uc3Qgc2Vjb25kcyA9IHVuaXQgPT09ICdtaW51dGVzJyA/IG4gKiA2MCA6IG47XHJcbiAgcmV0dXJuIHNlY29uZHMgPj0gX1RJTUVMSU5FX01JTl9JTlRFUlZBTF9TID8gc2Vjb25kcyA6IG51bGw7XHJcbn1cclxuXHJcbmV4cG9ydCB7XHJcbiAgX3Njb3JlSWNvbiwgX2xlcnBDb2xvciwgX3Njb3JlQm9yZGVyQ29sb3IsIF9zb3J0U2NvcmUsIF9mbXRWaWRlb1N0YXR1cywgX21zVG9IbXMsXHJcbiAgcGx1cmFsLCBmaW5pdGVPciwgZm10RHVyYXRpb24sIHRydW5jYXRlLCBlc2NIdG1sLCBmb3JtYXRBcGlFcnJvciwgc3RyaXBSaWNoTWFya3VwLFxyXG4gIF9wYXJzZVNlcnZlckRhdGUsIF9mbXREYXRlLCBfZm10QWdvLCBfZm10T2Zmc2V0LCBfZm10RWxhcHNlZCwgX3BhcnNlSW50ZXJ2YWxTLFxyXG59O1xyXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBTaGFyZWQgY29sb3VyIHBpY2tlci4gUHJvZ3Jlc3NpdmUtZW5oYW5jZXMgYW4gPGlucHV0PiB0aGF0IGhvbGRzXHJcbi8vICAgYSBoZXggdmFsdWU6IHRoZSBvcmlnaW5hbCBpbnB1dCBiZWNvbWVzIGEgaGlkZGVuIHZhbHVlLXN0b3JlIChrZWVwaW5nIGl0cyBpZCxcclxuLy8gICBjbGFzc2VzLCBkYXRhLSogYW5kIGV2ZW50IHdpcmluZykgYW5kIGdhaW5zIGEgY29tcGFjdCBzd2F0Y2ggdHJpZ2dlci4gQ2xpY2tpbmdcclxuLy8gICBpdCBvcGVucyBhIHBvcG92ZXIgd2l0aCBkaXJlY3QgaGV4IGVudHJ5LCBhIHJlY2VudGx5LXVzZWQgc3RyaXAsIGFuZCAoU3RhZ2UgMylcclxuLy8gICBhIHVzZXItY3VyYXRlZCBuYW1lZCBwYWxldHRlLiBSZXBsYWNlcyBuYXRpdmUgPGlucHV0IHR5cGU9XCJjb2xvclwiPiBhdCB0aGVcclxuLy8gICBzcGVha2VyLWNvbG91ciBhbmQgdGl0bGUtY2FyZCBjb2xvdXIgc2l0ZXMuXHJcbi8vICAgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfY29sb3JwaWNrZXIucHlcclxuLy8g4pSA4pSAIHNoYXJlZCBjb2xvdXIgcGlja2VyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuY29uc3QgUkVDRU5UX0tFWSA9ICd5dXVjbGlwLWNvbG9yLXJlY2VudCc7XHJcbmNvbnN0IFBBTEVUVEVfS0VZID0gJ3l1dWNsaXAtY29sb3ItcGFsZXR0ZSc7XHJcbmNvbnN0IFJFQ0VOVF9NQVggPSA4O1xyXG5cclxuLy8gUGlja2FibGUgc3RhcnRlciBjb2xvdXJzIC0gZGF0YSwgbm90IFVJIGNocm9tZSAodGhlIGNocm9tZSBhcm91bmQgdGhlbSBjb21lc1xyXG4vLyBmcm9tIHRoZW1lIHRva2VucykuIEEgc3ByZWFkIG9mIGh1ZXMgcGx1cyBibGFjay93aGl0ZSBzbyBhIGZpcnN0LXRpbWUgdXNlciBoYXNcclxuLy8gdXNhYmxlIGNob2ljZXMgYmVmb3JlIGN1cmF0aW5nIHRoZWlyIG93biBwYWxldHRlLiBUaGVzZSBsaXRlcmFscyBhcmUgdGhlIG9uZVxyXG4vLyBleGNlcHRpb24gdGhlIHRlc3RfdWlfdGhlbWUgY29sb3VyLWxpdGVyYWwgYWxsb3dsaXN0IGNhcnZlcyBvdXQgZm9yIHRoaXMgZmlsZS5cclxuY29uc3QgU1RBUlRFUl9TV0FUQ0hFUyA9IFtcclxuICAnI2ZmZmZmZicsICcjMDAwMDAwJywgJyNlMDVjNWMnLCAnI2YwODAzYycsICcjZjBjMDYwJywgJyM0Y2FmN2QnLFxyXG4gICcjNGZjM2Y3JywgJyMwYTdhOWInLCAnI2IwNmFmNycsICcjZjc3YWMwJywgJyM5ZTllOWUnLCAnIzdhNGIyYScsXHJcbl07XHJcblxyXG5mdW5jdGlvbiBfcmVhZExpc3Qoa2V5KSB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KSB8fCAnW10nKTtcclxuICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBhcnNlZCkgPyBwYXJzZWQgOiBbXTtcclxuICB9IGNhdGNoIHsgcmV0dXJuIFtdOyB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF93cml0ZUxpc3Qoa2V5LCBsaXN0KSB7XHJcbiAgdHJ5IHsgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShsaXN0KSk7IH0gY2F0Y2ggeyAvKiBzdG9yYWdlIGRpc2FibGVkICovIH1cclxufVxyXG5cclxuLy8gQWNjZXB0cyAjUkdCIG9yICNSUkdHQkIgKHdpdGggb3Igd2l0aG91dCB0aGUgbGVhZGluZyAjKSBhbmQgcmV0dXJucyBhXHJcbi8vIGNhbm9uaWNhbCBsb3dlcmNhc2UgI3JyZ2diYiwgb3IgbnVsbCB3aGVuIHRoZSB2YWx1ZSBpc24ndCBhIHZhbGlkIGhleCBjb2xvdXIuXHJcbmZ1bmN0aW9uIF9ub3JtYWxpemVIZXgocmF3KSB7XHJcbiAgaWYgKHR5cGVvZiByYXcgIT09ICdzdHJpbmcnKSByZXR1cm4gbnVsbDtcclxuICBsZXQgaGV4ID0gcmF3LnRyaW0oKTtcclxuICBpZiAoaGV4ICYmICFoZXguc3RhcnRzV2l0aCgnIycpKSBoZXggPSAnIycgKyBoZXg7XHJcbiAgY29uc3Qgc2hvcnQgPSAvXiMoWzAtOWEtZkEtRl17M30pJC8uZXhlYyhoZXgpO1xyXG4gIGlmIChzaG9ydCkgaGV4ID0gJyMnICsgc2hvcnRbMV0uc3BsaXQoJycpLm1hcChjID0+IGMgKyBjKS5qb2luKCcnKTtcclxuICByZXR1cm4gL14jWzAtOWEtZkEtRl17Nn0kLy50ZXN0KGhleCkgPyBoZXgudG9Mb3dlckNhc2UoKSA6IG51bGw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9yZWNvcmRSZWNlbnQoaGV4KSB7XHJcbiAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgoaGV4KTtcclxuICBpZiAoIW5vcm0pIHJldHVybjtcclxuICBjb25zdCBsaXN0ID0gX3JlYWRMaXN0KFJFQ0VOVF9LRVkpXHJcbiAgICAubWFwKF9ub3JtYWxpemVIZXgpXHJcbiAgICAuZmlsdGVyKGMgPT4gYyAmJiBjICE9PSBub3JtKTtcclxuICBsaXN0LnVuc2hpZnQobm9ybSk7XHJcbiAgX3dyaXRlTGlzdChSRUNFTlRfS0VZLCBsaXN0LnNsaWNlKDAsIFJFQ0VOVF9NQVgpKTtcclxufVxyXG5cclxuLy8gQSBzaW5nbGUgY2xpY2thYmxlIHN3YXRjaCBzaG93aW5nIGFuIGFjdHVhbCBjaG9zZW4gY29sb3VyLiBUaGUgYmFja2dyb3VuZCBpcyBhXHJcbi8vIGRhdGEgdmFsdWUgKHRoZSBwaWNrZWQgY29sb3VyKSwgc2V0IGFzIGEgRE9NIHByb3BlcnR5IHNvIGl0IG5ldmVyIGFwcGVhcnMgYXMgYVxyXG4vLyBsaXRlcmFsIGluIHNvdXJjZSAtIHRoZSBzd2F0Y2gncyBib3JkZXIvZm9jdXMgcmluZyBhcmUgdGhlbWUgdG9rZW5zIHZpYSBDU1MuXHJcbmZ1bmN0aW9uIF9zd2F0Y2hCdXR0b24oY29sb3IpIHtcclxuICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBidG4udHlwZSA9ICdidXR0b24nO1xyXG4gIGJ0bi5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItc3dhdGNoJztcclxuICBidG4uZGF0YXNldC5jb2xvciA9IGNvbG9yO1xyXG4gIGJ0bi5zdHlsZS5iYWNrZ3JvdW5kID0gY29sb3I7XHJcbiAgYnRuLnRpdGxlID0gY29sb3I7XHJcbiAgYnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGNvbG9yKTtcclxuICByZXR1cm4gYnRuO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc3dhdGNoUm93KGNvbG9ycykge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcm93JztcclxuICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xyXG4gIGZvciAoY29uc3QgcmF3IG9mIGNvbG9ycykge1xyXG4gICAgY29uc3QgY29sb3IgPSBfbm9ybWFsaXplSGV4KHJhdyk7XHJcbiAgICBpZiAoIWNvbG9yIHx8IHNlZW4uaGFzKGNvbG9yKSkgY29udGludWU7XHJcbiAgICBzZWVuLmFkZChjb2xvcik7XHJcbiAgICByb3cuYXBwZW5kQ2hpbGQoX3N3YXRjaEJ1dHRvbihjb2xvcikpO1xyXG4gIH1cclxuICByZXR1cm4gcm93O1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc2VjdGlvbkxhYmVsKHRleHQpIHtcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGxhYmVsLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1zZWN0aW9uLWxhYmVsJztcclxuICBsYWJlbC50ZXh0Q29udGVudCA9IHRleHQ7XHJcbiAgcmV0dXJuIGxhYmVsO1xyXG59XHJcblxyXG4vLyDilIDilIAgdXNlci1jdXJhdGVkIG5hbWVkIHBhbGV0dGUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbmZ1bmN0aW9uIF9wYWxldHRlRW50cmllcygpIHtcclxuICByZXR1cm4gX3JlYWRMaXN0KFBBTEVUVEVfS0VZKVxyXG4gICAgLmZpbHRlcihlID0+IGUgJiYgdHlwZW9mIGUubmFtZSA9PT0gJ3N0cmluZycgJiYgX25vcm1hbGl6ZUhleChlLmNvbG9yKSlcclxuICAgIC5tYXAoZSA9PiAoeyBuYW1lOiBlLm5hbWUsIGNvbG9yOiBfbm9ybWFsaXplSGV4KGUuY29sb3IpIH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3BhbGV0dGVJdGVtKG5hbWUsIGNvbG9yKSB7XHJcbiAgY29uc3QgaXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGl0ZW0uY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtaXRlbSc7XHJcbiAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgbGFiZWwuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtbmFtZSc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSBuYW1lO1xyXG4gIGNvbnN0IHJlbW92ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIHJlbW92ZS50eXBlID0gJ2J1dHRvbic7XHJcbiAgcmVtb3ZlLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLXJlbW92ZSc7XHJcbiAgcmVtb3ZlLmRhdGFzZXQubmFtZSA9IG5hbWU7XHJcbiAgcmVtb3ZlLnRleHRDb250ZW50ID0gJ8OXJztcclxuICByZW1vdmUuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYFJlbW92ZSAke25hbWV9YCk7XHJcbiAgaXRlbS5hcHBlbmQoX3N3YXRjaEJ1dHRvbihjb2xvciksIGxhYmVsLCByZW1vdmUpO1xyXG4gIHJldHVybiBpdGVtO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfYnVpbGRQYWxldHRlKGVudHJpZXMpIHtcclxuICBjb25zdCB3cmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgd3JhcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcGFsZXR0ZSc7XHJcbiAgaWYgKCFlbnRyaWVzLmxlbmd0aCkge1xyXG4gICAgY29uc3QgaGludCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgIGhpbnQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhpbnQnO1xyXG4gICAgaGludC50ZXh0Q29udGVudCA9ICdTYXZlIGEgY29sb3VyIGJlbG93IHRvIGJ1aWxkIHlvdXIgcGFsZXR0ZS4nO1xyXG4gICAgd3JhcC5hcHBlbmRDaGlsZChoaW50KTtcclxuICAgIHJldHVybiB3cmFwO1xyXG4gIH1cclxuICBlbnRyaWVzLmZvckVhY2goKHsgbmFtZSwgY29sb3IgfSkgPT4gd3JhcC5hcHBlbmRDaGlsZChfcGFsZXR0ZUl0ZW0obmFtZSwgY29sb3IpKSk7XHJcbiAgcmV0dXJuIHdyYXA7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9idWlsZEFkZFJvdygpIHtcclxuICBjb25zdCByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICByb3cuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWFkZHJvdyc7XHJcbiAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gIGlucHV0LnR5cGUgPSAndGV4dCc7XHJcbiAgaW5wdXQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnO1xyXG4gIGlucHV0LnNldEF0dHJpYnV0ZSgnbWF4bGVuZ3RoJywgJzQwJyk7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XHJcbiAgaW5wdXQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ05hbWUgZm9yIHRoZSBjdXJyZW50IGNvbG91cicpO1xyXG4gIGlucHV0LnBsYWNlaG9sZGVyID0gJ05hbWUgdGhpcyBjb2xvdXInO1xyXG4gIGNvbnN0IGFkZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGFkZC50eXBlID0gJ2J1dHRvbic7XHJcbiAgYWRkLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci1wYWxldHRlLWFkZCc7XHJcbiAgYWRkLnRleHRDb250ZW50ID0gJ1NhdmUnO1xyXG4gIHJvdy5hcHBlbmQoaW5wdXQsIGFkZCk7XHJcbiAgcmV0dXJuIHJvdztcclxufVxyXG5cclxuLy8gU2F2ZXMgdGhlIGNvbG91ciBjdXJyZW50bHkgaW4gdGhlIGhleCBmaWVsZCAoZmFsbGluZyBiYWNrIHRvIHRoZSBjb21taXR0ZWRcclxuLy8gdmFsdWUpIHVuZGVyIHRoZSB0eXBlZCBuYW1lLCBkZWZhdWx0aW5nIHRoZSBuYW1lIHRvIHRoZSBoZXggc3RyaW5nIGl0c2VsZi5cclxuZnVuY3Rpb24gX2FkZFBhbGV0dGVFbnRyeShjdHgpIHtcclxuICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgoY3R4LmhleEZpZWxkLnZhbHVlKSB8fCBfbm9ybWFsaXplSGV4KGN0eC5pbnB1dC52YWx1ZSk7XHJcbiAgaWYgKCFjb2xvcikgcmV0dXJuO1xyXG4gIGNvbnN0IG5hbWVJbnB1dCA9IGN0eC5wb3AucXVlcnlTZWxlY3RvcignLmNvbG9ycGlja2VyLXBhbGV0dGUtaW5wdXQnKTtcclxuICBjb25zdCBuYW1lID0gKG5hbWVJbnB1dCAmJiBuYW1lSW5wdXQudmFsdWUudHJpbSgpKSB8fCBjb2xvcjtcclxuICBjb25zdCBuZXh0ID0gX3BhbGV0dGVFbnRyaWVzKCkuZmlsdGVyKGUgPT4gZS5uYW1lICE9PSBuYW1lKTtcclxuICBuZXh0LnB1c2goeyBuYW1lLCBjb2xvciB9KTtcclxuICBfd3JpdGVMaXN0KFBBTEVUVEVfS0VZLCBuZXh0KTtcclxuICBfcmVuZGVyU3RyaXBzKGN0eCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9yZW1vdmVQYWxldHRlRW50cnkoY3R4LCBuYW1lKSB7XHJcbiAgX3dyaXRlTGlzdChQQUxFVFRFX0tFWSwgX3BhbGV0dGVFbnRyaWVzKCkuZmlsdGVyKGUgPT4gZS5uYW1lICE9PSBuYW1lKSk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfc3luY1RyaWdnZXIodHJpZ2dlciwgdmFsdWUpIHtcclxuICBjb25zdCBjb2xvciA9IF9ub3JtYWxpemVIZXgodmFsdWUpO1xyXG4gIHRyaWdnZXIuc3R5bGUuYmFja2dyb3VuZCA9IGNvbG9yIHx8ICd0cmFuc3BhcmVudCc7XHJcbiAgdHJpZ2dlci5jbGFzc0xpc3QudG9nZ2xlKCdpcy1lbXB0eScsICFjb2xvcik7XHJcbn1cclxuXHJcbi8vIEV2ZXJ5dGhpbmcgaW4gYSBwaWNrZXIgaW5zdGFuY2UgdGhlIGhhbmRsZXJzIG5lZWQgdG8gcmVhY2guXHJcbmZ1bmN0aW9uIF9tYWtlQ29udGV4dChpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCkge1xyXG4gIHJldHVybiB7IGlucHV0LCB0cmlnZ2VyLCBwb3AsIGhleEZpZWxkIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9jb21taXQoY3R4LCByYXdIZXgpIHtcclxuICBjb25zdCBub3JtID0gX25vcm1hbGl6ZUhleChyYXdIZXgpO1xyXG4gIGlmICghbm9ybSkgcmV0dXJuIGZhbHNlO1xyXG4gIGN0eC5pbnB1dC52YWx1ZSA9IG5vcm07XHJcbiAgLy8gaW5wdXQgZHJpdmVzIHRoZSBsaXZlLXByZXZpZXcgaGFuZGxlcnMgKHRpdGxlIGNhcmQncyBvbmlucHV0KTsgY2hhbmdlIGRyaXZlc1xyXG4gIC8vIHRoZSBzYXZlIGhhbmRsZXJzIChzcGVha2VyIGNoYW5nZS1kZWxlZ2F0aW9uKS4gVGhlIHRyaWdnZXIgcmUtc3luY3Mgb2ZmIHRoZVxyXG4gIC8vICdpbnB1dCcgbGlzdGVuZXIgd2lyZWQgaW4gYXR0YWNoKCkuXHJcbiAgY3R4LmlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcbiAgY3R4LmlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG4gIF9yZWNvcmRSZWNlbnQobm9ybSk7XHJcbiAgcmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbi8vIFJlYnVpbHQgZWFjaCB0aW1lIHRoZSBwb3BvdmVyIG9wZW5zIChhbmQgYWZ0ZXIgYSBwYWxldHRlIGFkZC9yZW1vdmUpIHNvIHRoZVxyXG4vLyByZWNlbnRseS11c2VkIHN0cmlwIGFuZCBzYXZlZCBwYWxldHRlIHJlZmxlY3QgdGhlIGxhdGVzdCBzdGF0ZS4gQWxsIG9mIGl0IGdvZXNcclxuLy8gaW4gb25lIGNvbnRhaW5lciB0aGF0IGlzIHJlcGxhY2VkIHdob2xlc2FsZSwgc28gbm90aGluZyBhY2N1bXVsYXRlcy5cclxuZnVuY3Rpb24gX3JlbmRlclN0cmlwcyhjdHgpIHtcclxuICBjb25zdCBzdGFsZSA9IGN0eC5wb3AucXVlcnlTZWxlY3RvcignLmNvbG9ycGlja2VyLWR5bmFtaWMnKTtcclxuICBpZiAoc3RhbGUpIHN0YWxlLnJlbW92ZSgpO1xyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGNvbnRhaW5lci5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItZHluYW1pYyc7XHJcbiAgY29uc3QgcmVjZW50ID0gX3JlYWRMaXN0KFJFQ0VOVF9LRVkpO1xyXG4gIGlmIChyZWNlbnQubGVuZ3RoKSB7XHJcbiAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnUmVjZW50bHkgdXNlZCcpKTtcclxuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfc3dhdGNoUm93KHJlY2VudCkpO1xyXG4gIH1cclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnWW91ciBwYWxldHRlJykpO1xyXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChfYnVpbGRQYWxldHRlKF9wYWxldHRlRW50cmllcygpKSk7XHJcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKF9idWlsZEFkZFJvdygpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3NlY3Rpb25MYWJlbCgnQ29sb3VycycpKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQoX3N3YXRjaFJvdyhTVEFSVEVSX1NXQVRDSEVTKSk7XHJcbiAgY3R4LnBvcC5hcHBlbmRDaGlsZChjb250YWluZXIpO1xyXG59XHJcblxyXG5sZXQgX29wZW5DdHggPSBudWxsOyAgLy8gdGhlIG9uZSBvcGVuIHBpY2tlciBjb250ZXh0LCBvciBudWxsXHJcblxyXG5mdW5jdGlvbiBfY2xvc2VQb3BvdmVyKHJlZm9jdXMpIHtcclxuICBpZiAoIV9vcGVuQ3R4KSByZXR1cm47XHJcbiAgY29uc3QgeyBwb3AsIHRyaWdnZXIgfSA9IF9vcGVuQ3R4O1xyXG4gIHBvcC5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcclxuICBfb3BlbkN0eCA9IG51bGw7XHJcbiAgaWYgKHJlZm9jdXMpIHRyaWdnZXIuZm9jdXMoKTtcclxufVxyXG5cclxuLy8gVGhlIHBvcG92ZXIgaXMgYSBkaWFsb2csIHNvIFRhYiBtdXN0IG5vdCBmYWxsIHRocm91Z2ggdG8gdGhlIHBhZ2UgYmVoaW5kIGl0XHJcbi8vIChXQ0FHIDIuNC4zKS4gQ3ljbGUgZm9jdXMgYW1vbmcgdGhlIHBvcG92ZXIncyBvd24gY29udHJvbHM7IHRoZSB0cmlnZ2VyIHNpdHNcclxuLy8gb3V0c2lkZSB0aGUgcG9wb3ZlciBhbmQgaXMgaW50ZW50aW9uYWxseSBleGNsdWRlZCB3aGlsZSBpdCBpcyBvcGVuLlxyXG5mdW5jdGlvbiBfZm9jdXNhYmxlcyhwb3ApIHtcclxuICByZXR1cm4gQXJyYXkuZnJvbShwb3AucXVlcnlTZWxlY3RvckFsbCgnYnV0dG9uLCBpbnB1dCcpKS5maWx0ZXIoXHJcbiAgICBlbCA9PiAhZWwuZGlzYWJsZWQgJiYgZWwub2Zmc2V0UGFyZW50ICE9PSBudWxsLFxyXG4gICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF90cmFwRm9jdXMoZSkge1xyXG4gIGNvbnN0IGl0ZW1zID0gX2ZvY3VzYWJsZXMoX29wZW5DdHgucG9wKTtcclxuICBpZiAoIWl0ZW1zLmxlbmd0aCkgcmV0dXJuO1xyXG4gIGNvbnN0IGZpcnN0ID0gaXRlbXNbMF07XHJcbiAgY29uc3QgbGFzdCA9IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdO1xyXG4gIGNvbnN0IGFjdGl2ZSA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XHJcbiAgaWYgKCFfb3BlbkN0eC5wb3AuY29udGFpbnMoYWN0aXZlKSkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgZmlyc3QuZm9jdXMoKTtcclxuICB9IGVsc2UgaWYgKGUuc2hpZnRLZXkgJiYgYWN0aXZlID09PSBmaXJzdCkge1xyXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgbGFzdC5mb2N1cygpO1xyXG4gIH0gZWxzZSBpZiAoIWUuc2hpZnRLZXkgJiYgYWN0aXZlID09PSBsYXN0KSB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBmaXJzdC5mb2N1cygpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gX29wZW5Qb3BvdmVyKGN0eCkge1xyXG4gIF9jbG9zZVBvcG92ZXIoKTtcclxuICBjdHguaGV4RmllbGQudmFsdWUgPSAoX25vcm1hbGl6ZUhleChjdHguaW5wdXQudmFsdWUpIHx8ICcnKS5yZXBsYWNlKCcjJywgJycpO1xyXG4gIGN0eC5oZXhGaWVsZC5jbGFzc0xpc3QucmVtb3ZlKCdpbnZhbGlkJyk7XHJcbiAgX3JlbmRlclN0cmlwcyhjdHgpO1xyXG4gIGN0eC5wb3AuY2xhc3NMaXN0LmFkZCgnb3BlbicpO1xyXG4gIGN0eC50cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XHJcbiAgX29wZW5DdHggPSBjdHg7XHJcbiAgY3R4LmhleEZpZWxkLmZvY3VzKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIF93aXJlSGV4RmllbGQoY3R4KSB7XHJcbiAgY3R4LmhleEZpZWxkLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgKCkgPT4ge1xyXG4gICAgY29uc3Qgbm9ybSA9IF9ub3JtYWxpemVIZXgoY3R4LmhleEZpZWxkLnZhbHVlKTtcclxuICAgIGN0eC5oZXhGaWVsZC5jbGFzc0xpc3QudG9nZ2xlKCdpbnZhbGlkJywgIW5vcm0gJiYgY3R4LmhleEZpZWxkLnZhbHVlLnRyaW0oKSAhPT0gJycpO1xyXG4gICAgaWYgKG5vcm0pIF9zeW5jVHJpZ2dlcihjdHgudHJpZ2dlciwgbm9ybSk7ICAvLyBsaXZlIHByZXZpZXcsIG5vIGNvbW1pdCB5ZXRcclxuICB9KTtcclxuICBjdHguaGV4RmllbGQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4gX2NvbW1pdChjdHgsIGN0eC5oZXhGaWVsZC52YWx1ZSkpO1xyXG4gIGN0eC5oZXhGaWVsZC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XHJcbiAgICBpZiAoZS5rZXkgIT09ICdFbnRlcicpIHJldHVybjtcclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGlmIChfY29tbWl0KGN0eCwgY3R4LmhleEZpZWxkLnZhbHVlKSkgX2Nsb3NlUG9wb3Zlcih0cnVlKTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gX2J1aWxkSGV4Um93KCkge1xyXG4gIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHJvdy5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4cm93JztcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICBsYWJlbC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItaGV4aGFzaCc7XHJcbiAgbGFiZWwudGV4dENvbnRlbnQgPSAnIyc7XHJcbiAgY29uc3QgZmllbGQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gIGZpZWxkLnR5cGUgPSAndGV4dCc7XHJcbiAgZmllbGQuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyLWhleGZpZWxkJztcclxuICBmaWVsZC5zZXRBdHRyaWJ1dGUoJ21heGxlbmd0aCcsICc3Jyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdzcGVsbGNoZWNrJywgJ2ZhbHNlJyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdhdXRvY29tcGxldGUnLCAnb2ZmJyk7XHJcbiAgZmllbGQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0hleCBjb2xvdXIgdmFsdWUnKTtcclxuICBmaWVsZC5wbGFjZWhvbGRlciA9ICdSUkdHQkInO1xyXG4gIHJvdy5hcHBlbmQobGFiZWwsIGZpZWxkKTtcclxuICByZXR1cm4geyByb3csIGZpZWxkIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGF0dGFjaChpbnB1dCkge1xyXG4gIGlmICghaW5wdXQgfHwgaW5wdXQuZGF0YXNldC5jcEF0dGFjaGVkKSByZXR1cm47XHJcbiAgaW5wdXQuZGF0YXNldC5jcEF0dGFjaGVkID0gJzEnO1xyXG4gIGNvbnN0IGluaXRpYWwgPSBfbm9ybWFsaXplSGV4KGlucHV0LnZhbHVlKSB8fCAnJztcclxuICBpbnB1dC50eXBlID0gJ2hpZGRlbic7XHJcbiAgaW5wdXQudmFsdWUgPSBpbml0aWFsO1xyXG5cclxuICBjb25zdCB3cmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIHdyYXAuY2xhc3NOYW1lID0gJ2NvbG9ycGlja2VyJztcclxuICBpbnB1dC5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh3cmFwLCBpbnB1dCk7XHJcblxyXG4gIGNvbnN0IHRyaWdnZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICB0cmlnZ2VyLnR5cGUgPSAnYnV0dG9uJztcclxuICB0cmlnZ2VyLmNsYXNzTmFtZSA9ICdjb2xvcnBpY2tlci10cmlnZ2VyJztcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcsICd0cnVlJyk7XHJcbiAgdHJpZ2dlci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcclxuICB0cmlnZ2VyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdDaG9vc2UgY29sb3VyJyk7XHJcblxyXG4gIGNvbnN0IHBvcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIHBvcC5jbGFzc05hbWUgPSAnY29sb3JwaWNrZXItcG9wJztcclxuICBwb3Auc2V0QXR0cmlidXRlKCdyb2xlJywgJ2RpYWxvZycpO1xyXG4gIHBvcC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ29sb3VyIHBpY2tlcicpO1xyXG4gIGNvbnN0IHsgcm93OiBoZXhSb3csIGZpZWxkOiBoZXhGaWVsZCB9ID0gX2J1aWxkSGV4Um93KCk7XHJcbiAgcG9wLmFwcGVuZENoaWxkKGhleFJvdyk7XHJcblxyXG4gIHdyYXAuYXBwZW5kKHRyaWdnZXIsIGlucHV0LCBwb3ApO1xyXG4gIGNvbnN0IGN0eCA9IF9tYWtlQ29udGV4dChpbnB1dCwgdHJpZ2dlciwgcG9wLCBoZXhGaWVsZCk7XHJcblxyXG4gIF9zeW5jVHJpZ2dlcih0cmlnZ2VyLCBpbnB1dC52YWx1ZSk7XHJcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoKSA9PiBfc3luY1RyaWdnZXIodHJpZ2dlciwgaW5wdXQudmFsdWUpKTtcclxuICB0cmlnZ2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBpZiAoX29wZW5DdHggJiYgX29wZW5DdHgudHJpZ2dlciA9PT0gdHJpZ2dlcikgX2Nsb3NlUG9wb3ZlcigpO1xyXG4gICAgZWxzZSBfb3BlblBvcG92ZXIoY3R4KTtcclxuICB9KTtcclxuICBwb3AuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICAgIGNvbnN0IHJlbW92ZUJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLXJlbW92ZScpO1xyXG4gICAgaWYgKHJlbW92ZUJ0bikgeyBfcmVtb3ZlUGFsZXR0ZUVudHJ5KGN0eCwgcmVtb3ZlQnRuLmRhdGFzZXQubmFtZSk7IHJldHVybjsgfVxyXG4gICAgaWYgKGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLWFkZCcpKSB7IF9hZGRQYWxldHRlRW50cnkoY3R4KTsgcmV0dXJuOyB9XHJcbiAgICBjb25zdCBzd2F0Y2ggPSBlLnRhcmdldC5jbG9zZXN0KCcuY29sb3JwaWNrZXItc3dhdGNoJyk7XHJcbiAgICBpZiAoIXN3YXRjaCkgcmV0dXJuO1xyXG4gICAgX2NvbW1pdChjdHgsIHN3YXRjaC5kYXRhc2V0LmNvbG9yKTtcclxuICAgIF9jbG9zZVBvcG92ZXIoKTtcclxuICB9KTtcclxuICBwb3AuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gICAgaWYgKGUua2V5ID09PSAnRW50ZXInICYmIGUudGFyZ2V0LmNsb3Nlc3QoJy5jb2xvcnBpY2tlci1wYWxldHRlLWlucHV0JykpIHtcclxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICBfYWRkUGFsZXR0ZUVudHJ5KGN0eCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbiAgX3dpcmVIZXhGaWVsZChjdHgpO1xyXG59XHJcblxyXG4vLyBDbG9zZSB0aGUgb3BlbiBwb3BvdmVyIG9uIGFuIG91dHNpZGUgY2xpY2sgb3IgRXNjYXBlLiBSZWdpc3RlcmVkIG9uY2UuXHJcbi8vIEEgY2xpY2sgdGhhdCByZS1yZW5kZXJzIHRoZSBwb3BvdmVyIChTYXZlIC8gcmVtb3ZlIGEgcGFsZXR0ZSBlbnRyeSkgZGV0YWNoZXNcclxuLy8gaXRzIG93biB0YXJnZXQgYmVmb3JlIHRoaXMgYnViYmxpbmcgaGFuZGxlciBydW5zOyBzdWNoIGEgdGFyZ2V0IGlzIG5vIGxvbmdlciBpblxyXG4vLyB0aGUgZG9jdW1lbnQsIHNvIHNraXAgaXQgcmF0aGVyIHRoYW4gbWlzdGFraW5nIGl0IGZvciBhbiBvdXRzaWRlIGNsaWNrLlxyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBpZiAoIWRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyhlLnRhcmdldCkpIHJldHVybjtcclxuICBpZiAoIV9vcGVuQ3R4LnBvcC5wYXJlbnROb2RlLmNvbnRhaW5zKGUudGFyZ2V0KSkgX2Nsb3NlUG9wb3ZlcigpO1xyXG59KTtcclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGUgPT4ge1xyXG4gIGlmICghX29wZW5DdHgpIHJldHVybjtcclxuICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7IF9jbG9zZVBvcG92ZXIodHJ1ZSk7IHJldHVybjsgfVxyXG4gIGlmIChlLmtleSA9PT0gJ1RhYicpIF90cmFwRm9jdXMoZSk7XHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IENvbG9yUGlja2VyID0geyBhdHRhY2gsIF9ub3JtYWxpemVIZXgsIFJFQ0VOVF9LRVksIFBBTEVUVEVfS0VZIH07XHJcbiIsICIvLyBJbmZyYXN0cnVjdHVyZSAtIFBhbmVsTmF2IHRha2VvdmVyIGZyYW1ld29yayAobm90IGEgZmVhdHVyZSBtb2R1bGUpLlxyXG4vLyAgIFVzZWQgYnk6IHNwbGl0LmpzLCBjbGlwY3JlYXRlLmpzLCBleHBvcnRlZGl0b3IuanMsIG5hbWVjb3JyZWN0aW9ucy5qcyDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV9wYW5lbG5hdi5weVxyXG4vLyDilIDilIAgcGFuZWwgbmF2aWdhdGlvbiBmcmFtZXdvcmsg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIE11bHRpLXN0ZXAgZmxvd3MgKFNwbGl0IEVkaXRvciwgYW5kIGZ1dHVyZSBwaWNrZXJzKSB0YWtlIG92ZXIgdGhlIG1haW5cclxuLy8gZGV0YWlsIHBhbmVsIGluc3RlYWQgb2YgdXNpbmcgYSBtb2RhbDogc2hhcmVkIGJyZWFkY3J1bWIsIHNoYXJlZCBkaXJ0eS1zdGF0ZVxyXG4vLyBkaXNjYXJkIHByb21wdC4gRWFjaCBvcGVuIHBhbmVsIGdldHMgaXRzIG93biBjb250ZW50IGNvbnRhaW5lciBzbyBhIGZ1dHVyZVxyXG4vLyBuZXN0ZWQgcGFuZWwgKGUuZy4gbWFudWFsLWNsaXAncyBwaWNrZXIgb24gdG9wIG9mIGEgcmVjb3JkaW5nIHZpZXcpIGNhbiBiZVxyXG4vLyB1bndvdW5kIG9uZSBsZXZlbCBhdCBhIHRpbWUgd2l0aG91dCByZS1ydW5uaW5nIHRoZSBwYXJlbnQncyByZW5kZXIoKS5cclxuLy9cclxuLy8gVGhlIGNvbnRhaW5lciBpcyBkZXN0cm95ZWQgb24gY2xvc2UgcmlnaHQgYWZ0ZXIgb25DbG9zZSgpIHJ1bnMuIElmIHJlbmRlcigpXHJcbi8vIHJlcGFyZW50ZWQgYW4gZXhpc3Rpbmcgc3RhdGljIGVsZW1lbnQgKHJhdGhlciB0aGFuIGJ1aWxkaW5nIGZyZXNoIERPTSksXHJcbi8vIG9uQ2xvc2UoKSBtdXN0IG1vdmUgaXQgYmFjayBvdXQgdG8gYSBzdGFibGUsIGFsd2F5cy1pbi1kb2N1bWVudCBsb2NhdGlvbiAtXHJcbi8vIG90aGVyd2lzZSBpdCBnb2VzIHdpdGggdGhlIGNvbnRhaW5lciBhbmQgZ2V0RWxlbWVudEJ5SWQgY2FuJ3QgZmluZCBpdCBvblxyXG4vLyB0aGUgbmV4dCBvcGVuLiBTZWUgc3BsaXQuanMncyBfdGVhcmRvd25TcGxpdEVkaXRvciBmb3IgdGhlIHBhdHRlcm4uXHJcblxyXG5jb25zdCBfc3RhY2sgPSBbXTsgIC8vIFt7aWQsIHRpdGxlLCBpc0RpcnR5LCBvbkNsb3NlLCBjb250YWluZXJ9XVxyXG5cclxuZnVuY3Rpb24gX3Jvb3QoKSAgICB7IHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFuZWxuYXYtcm9vdCcpOyB9XHJcbmZ1bmN0aW9uIF9jcnVtYigpICAgeyByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhbmVsbmF2LWJyZWFkY3J1bWInKTsgfVxyXG5mdW5jdGlvbiBfbW91bnQoKSAgIHsgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwYW5lbG5hdi1jb250ZW50Jyk7IH1cclxuZnVuY3Rpb24gX3RvcCgpICAgICB7IHJldHVybiBfc3RhY2tbX3N0YWNrLmxlbmd0aCAtIDFdIHx8IG51bGw7IH1cclxuXHJcbmZ1bmN0aW9uIF9yZW5kZXJCcmVhZGNydW1iKCkge1xyXG4gIGNvbnN0IHRvcCA9IF90b3AoKTtcclxuICBjb25zdCBjcnVtYiA9IF9jcnVtYigpO1xyXG4gIGNydW1iLmlubmVySFRNTCA9ICcnO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgY29uc3QgYmFjayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gIGJhY2sudHlwZSA9ICdidXR0b24nO1xyXG4gIGJhY2suY2xhc3NOYW1lID0gJ2J0biBnaG9zdCc7XHJcbiAgYmFjay5zdHlsZS5jc3NUZXh0ID0gJ3BhZGRpbmc6NHB4IDEwcHg7Zm9udC1zaXplOjEzcHgnO1xyXG4gIGJhY2sudGV4dENvbnRlbnQgPSAn4oaQIEJhY2snO1xyXG4gIGJhY2sub25jbGljayA9ICgpID0+IHBhbmVsTmF2Q2xvc2UoKTtcclxuICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICB0aXRsZS5zdHlsZS5jc3NUZXh0ID0gJ2ZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjYwMCc7XHJcbiAgdGl0bGUudGV4dENvbnRlbnQgPSB0b3AudGl0bGU7XHJcbiAgY3J1bWIuYXBwZW5kKGJhY2ssIHRpdGxlKTtcclxufVxyXG5cclxuZnVuY3Rpb24gX3VwZGF0ZVZpc2liaWxpdHkoKSB7XHJcbiAgX3N0YWNrLmZvckVhY2goKGVudHJ5LCBpKSA9PiB7XHJcbiAgICBlbnRyeS5jb250YWluZXIuc3R5bGUuZGlzcGxheSA9IGkgPT09IF9zdGFjay5sZW5ndGggLSAxID8gJ2ZsZXgnIDogJ25vbmUnO1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYW5lbE5hdk9wZW4oeyBpZCwgdGl0bGUsIHJlbmRlciwgaXNEaXJ0eSwgb25DbG9zZSB9KSB7XHJcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgY29udGFpbmVyLmRhdGFzZXQucGFuZWxJZCA9IGlkO1xyXG4gIGNvbnRhaW5lci5zdHlsZS5jc3NUZXh0ID0gJ2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjE2cHgnO1xyXG4gIF9tb3VudCgpLmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XHJcbiAgX3N0YWNrLnB1c2goe1xyXG4gICAgaWQsXHJcbiAgICB0aXRsZSxcclxuICAgIGlzRGlydHk6IGlzRGlydHkgfHwgKCgpID0+IGZhbHNlKSxcclxuICAgIG9uQ2xvc2U6IG9uQ2xvc2UgfHwgKCgpID0+IHt9KSxcclxuICAgIGNvbnRhaW5lcixcclxuICB9KTtcclxuICBfcm9vdCgpLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XHJcbiAgX3VwZGF0ZVZpc2liaWxpdHkoKTtcclxuICBfcmVuZGVyQnJlYWRjcnVtYigpO1xyXG4gIHJlbmRlcihjb250YWluZXIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBfY2xvc2VUb3AoKSB7XHJcbiAgY29uc3QgdG9wID0gX3N0YWNrLnBvcCgpO1xyXG4gIGlmICghdG9wKSByZXR1cm47XHJcbiAgdG9wLm9uQ2xvc2UoKTtcclxuICB0b3AuY29udGFpbmVyLnJlbW92ZSgpO1xyXG4gIGlmIChfc3RhY2subGVuZ3RoID09PSAwKSB7XHJcbiAgICBfcm9vdCgpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgfSBlbHNlIHtcclxuICAgIF91cGRhdGVWaXNpYmlsaXR5KCk7XHJcbiAgICBfcmVuZGVyQnJlYWRjcnVtYigpO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZDbG9zZSgpIHtcclxuICBjb25zdCB0b3AgPSBfdG9wKCk7XHJcbiAgaWYgKCF0b3ApIHJldHVybjtcclxuICBpZiAodG9wLmlzRGlydHkoKSkge1xyXG4gICAgd2luZG93LnNob3dDb25maXJtKFxyXG4gICAgICAnRGlzY2FyZCBjaGFuZ2VzPycsXHJcbiAgICAgICdZb3UgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuIENsb3NlIHdpdGhvdXQgc2F2aW5nPycsXHJcbiAgICAgICdEaXNjYXJkJyxcclxuICAgICAgX2Nsb3NlVG9wLFxyXG4gICAgICB0cnVlLFxyXG4gICAgKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgX2Nsb3NlVG9wKCk7XHJcbn1cclxuXHJcbi8vIEZvcmNlLWNsb3NlIHRoZSB0b3Btb3N0IHBhbmVsLCBieXBhc3NpbmcgdGhlIGRpcnR5IGdhdGUgLSBmb3IgY2FsbGVycyB0aGF0XHJcbi8vIGhhdmUgYWxyZWFkeSBjb25maXJtZWQgdGhlIGRpc2NhcmQgdGhyb3VnaCB0aGVpciBvd24gKGRpZmZlcmVudGx5IHdvcmRlZClcclxuLy8gcHJvbXB0LCBlLmcuIHN3aXRjaGluZyByZWNvcmRpbmdzIHdoaWxlIHRoZSBTcGxpdCBFZGl0b3IgaXMgZGlydHkuXHJcbmZ1bmN0aW9uIHBhbmVsTmF2Rm9yY2VDbG9zZSgpIHtcclxuICBfY2xvc2VUb3AoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFuZWxOYXZJc09wZW4oaWQpIHtcclxuICBpZiAoaWQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIF9zdGFjay5sZW5ndGggPiAwO1xyXG4gIHJldHVybiBfc3RhY2suc29tZShlbnRyeSA9PiBlbnRyeS5pZCA9PT0gaWQpO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgUGFuZWxOYXYgPSB7XHJcbiAgb3BlbjogcGFuZWxOYXZPcGVuLCBjbG9zZTogcGFuZWxOYXZDbG9zZSwgZm9yY2VDbG9zZTogcGFuZWxOYXZGb3JjZUNsb3NlLCBpc09wZW46IHBhbmVsTmF2SXNPcGVuLFxyXG59O1xyXG4iLCAiLy8gRmVhdHVyZS1tYXAgLSBMb25nLXJ1bm5pbmctam9iIG1hY2hpbmVyeTogdGhlIGpvYi1zdGF0dXMgaGVhZGVyIChzdGVwIHBpbGxzLCB0aW1lciwgRVRBKSwgdGhlXG4vLyAgIHBhdXNlL3Jlc3VtZSArIHRoZXJtYWwgYXV0by1wYXVzZSBVSSwgdGhlIGZldGNoLWJhc2VkIFNTRSB0cmFuc3BvcnQgKF9vcGVuU1NFL3N0cmVhbVNTRSksIHRoZVxuLy8gICBzaW5nbGUtYWN0aXZlLXN0cmVhbSBzdXBlcnNlZGUgY29udHJhY3QsIGFuZCB0aGUgc2hhcmVkIENhbmNlbCBidXR0b24uXG4vLyAgIEFQSTogcm91dGVzL2FuYWx5emUucHksIHJvdXRlcy9zY29yaW5nLnB5IChTU0UgZW5kcG9pbnRzKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV91dGlscy5weSwgdGVzdHMvdWkvdGVzdF91aV9zc2UucHlcbmltcG9ydCB7IEFwcFN0YXRlIH0gZnJvbSAnLi9zdGF0ZS5qcyc7XG5pbXBvcnQgeyBlc2NIdG1sLCBmb3JtYXRBcGlFcnJvciwgX2ZtdEVsYXBzZWQgfSBmcm9tICcuL2Zvcm1hdC5qcyc7XG5cbi8vIOKUgOKUgCBzaGFyZWQgbGl2ZSBqb2ItcmVuZGVyIHN0YXRlIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gUmVhZCBjcm9zcy1maWxlIGJ5IHZpZGVvcy5qcydzIGNvbXBhY3Qgc3RlcCBzdHJpcCAoYmFyZSBpZGVudGlmaWVycyBfam9iU3RlcERlZnMsXG4vLyBfYWN0aXZlU3RlcElkeCwgX2pvYlN0YXJ0VGltZSkgYW5kIGJ5IHRoZSBQbGF5d3JpZ2h0IFVJLXRlc3Qgc3VpdGUsIHdoaWNoIHNlZWRzXG4vLyBzZXZlcmFsIG9mIHRoZXNlIGRpcmVjdGx5IHZpYSBwYWdlLmV2YWx1YXRlLiBCb3RoIHNpZGVzIGFyZSBjbGFzc2ljLCBub24tbW9kdWxlXG4vLyBjb2RlLCBzbyB0aGV5IGNhbiBvbmx5IGV2ZXIgcmVhY2ggdGhlc2UgYXMgYHdpbmRvd2AgcHJvcGVydGllcyAtIG5ldmVyIHZpYSBhbiBFU01cbi8vIGltcG9ydC4gQSBvbmUtc2hvdCBgd2luZG93LlggPSBYYCBzbmFwc2hvdCB3b3VsZCBnbyBzdGFsZSB0aGUgaW5zdGFudCBqb2JzLmpzXG4vLyByZWFzc2lnbnMgWCwgc28gZWFjaCBuYW1lIGdldHMgYSBsaXZlIGdldC9zZXQgYnJpZGdlIG9udG8gYHdpbmRvd2AgYmVsb3cgaW5zdGVhZFxuLy8gb2YgYSBwbGFpbiBPYmplY3QuYXNzaWduIGV4cG9ydC5cbmxldCBfam9iU3RlcERlZnMgICA9IFtdO1xubGV0IF9hY3RpdmVFUyAgICAgID0gbnVsbDtcbmxldCBfam9iU3RhcnRUaW1lICA9IDA7XG5sZXQgX2FjdGl2ZVN0ZXBJZHggPSAtMTtcblxuLy8gUGVyLXN0ZXAgcHJvZ3Jlc3MgYWNjb3VudGluZyBmb3IgdGhlIHN0ZXAtcGlsbCBFVEEgaGV1cmlzdGljLiBOb3QgcmVhZCBieSBvdGhlclxuLy8gcHJvZHVjdGlvbiBtb2R1bGVzLCBidXQgdGhlIHN0ZXAtcGlsbCAvIEVUQSAvIGxpdmUtcGFuZWwgdGVzdHMgc2VlZCB0aGVtIGRpcmVjdGx5XG4vLyB2aWEgcGFnZS5ldmFsdWF0ZSwgc28gdGhleSBuZWVkIHRoZSBzYW1lIHdpbmRvdyBicmlkZ2UgYXMgdGhlIGJsb2NrIGFib3ZlLlxubGV0IF9zdGVwU3RhcnRUaW1lID0gMDtcbmxldCBfc3RlcFByb2dyZXNzICA9IHt9OyAvLyBzdGVwSWR4IC0+IHtjdXJyZW50LCB0b3RhbH0sIGNsZWFyZWQgcGVyIGpvYlxubGV0IF9zdGVwUmF0ZUFuY2hvciA9IHt9OyAvLyBzdGVwSWR4IC0+IHt0LCBjdXJyZW50fSBhdCBmaXJzdCBvYnNlcnZlZCBjb3VudCwgY2xlYXJlZCBwZXIgam9iXG5cbmZvciAoY29uc3QgW25hbWUsIGdldCwgc2V0XSBvZiBbXG4gIFsnX2pvYlN0ZXBEZWZzJywgICAgKCkgPT4gX2pvYlN0ZXBEZWZzLCAgICB2ID0+IHsgX2pvYlN0ZXBEZWZzID0gdjsgfV0sXG4gIFsnX2FjdGl2ZUVTJywgICAgICAgKCkgPT4gX2FjdGl2ZUVTLCAgICAgICB2ID0+IHsgX2FjdGl2ZUVTID0gdjsgfV0sXG4gIFsnX2pvYlN0YXJ0VGltZScsICAgKCkgPT4gX2pvYlN0YXJ0VGltZSwgICB2ID0+IHsgX2pvYlN0YXJ0VGltZSA9IHY7IH1dLFxuICBbJ19hY3RpdmVTdGVwSWR4JywgICgpID0+IF9hY3RpdmVTdGVwSWR4LCAgdiA9PiB7IF9hY3RpdmVTdGVwSWR4ID0gdjsgfV0sXG4gIFsnX3N0ZXBTdGFydFRpbWUnLCAgKCkgPT4gX3N0ZXBTdGFydFRpbWUsICB2ID0+IHsgX3N0ZXBTdGFydFRpbWUgPSB2OyB9XSxcbiAgWydfc3RlcFByb2dyZXNzJywgICAoKSA9PiBfc3RlcFByb2dyZXNzLCAgIHYgPT4geyBfc3RlcFByb2dyZXNzID0gdjsgfV0sXG4gIFsnX3N0ZXBSYXRlQW5jaG9yJywgKCkgPT4gX3N0ZXBSYXRlQW5jaG9yLCB2ID0+IHsgX3N0ZXBSYXRlQW5jaG9yID0gdjsgfV0sXG5dKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh3aW5kb3csIG5hbWUsIHtnZXQsIHNldCwgY29uZmlndXJhYmxlOiB0cnVlfSk7XG59XG5cbi8vIOKUgOKUgCBwcm9ncmVzcyBpbmRpY2F0b3Ig4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBlc3RNYXRjaDogc3Vic3RyaW5ncyB0aGF0IG1hcCB0aGlzIHBpbGwgdG8gYSBzdGVwIG5hbWUgZnJvbSAvYXBpL2VzdGltYXRlLCBzb1xuLy8gdGhlIHByb2dyZXNzIHBpbGwgY2FuIHNob3cgaXRzIHByZS1ydW4gdGltZSBlc3RpbWF0ZSBhcyBhIGhvdmVyIHRvb2x0aXAuXG4vLyBwcm9ncmVzc1BhdHRlcm46IHJlZ2V4IHdpdGggdHdvIGNhcHR1cmUgZ3JvdXBzIChjdXJyZW50LCB0b3RhbCkgbWF0Y2hlZFxuLy8gYWdhaW5zdCBpbmNvbWluZyBsb2cgbGluZXMgd2hpbGUgdGhpcyBzdGVwIGlzIGFjdGl2ZSwgc28gdGhlIHBpbGwgY2FuIHNob3dcbi8vIFwiMy8xMiAoMjUlKVwiIGFuZCBhIGxpdmUgRVRBIGluc3RlYWQgb2YganVzdCBlbGFwc2VkIHRpbWUuXG4vLyBzdGFnZTogdGhlIG1hY2hpbmUtcmVhZGFibGUgaWQgZnJvbSB0aGUgQEBQUk9HUkVTUyBtYXJrZXIgKHl1dV9jbGlwL3BpcGVsaW5lL1xuLy8gcHJvZ3Jlc3MucHkgU3RhZ2UpLiBUaGUgbWFya2VyIGRyaXZlcyB0aGUgcGlsbCBkZXRlcm1pbmlzdGljYWxseTsgdGhlIHBhdHRlcm5zL1xuLy8gcHJvZ3Jlc3NQYXR0ZXJuIHJlZ2V4ZXMgYmVsb3cgc3RheSBhcyBhIG9uZS1yZWxlYXNlIGZhbGxiYWNrIGZvciB0aGUgaHVtYW4gbG9nXG4vLyBsaW5lcy4gVGhlIHN0YWdlIHNldCBoZXJlIGlzIGNvdXBsaW5nLWd1YXJkZWQgYWdhaW5zdCBwcm9ncmVzcy5weSBieVxuLy8gdGVzdHMvdW5pdC90ZXN0X3Byb2dyZXNzX3N0YWdlX2NvdXBsaW5nLnB5LlxuY29uc3QgSU5HRVNUX1NURVBTID0gW1xuICB7bGFiZWw6ICdFeHRyYWN0JywgICAgICAgIHN0YWdlOiAnZXh0cmFjdCcsICAgICAgICBwYXR0ZXJuczogWydFeHRyYWN0aW5nIGF1ZGlvJ10sICAgICAgZXN0TWF0Y2g6IFsnZXh0cmFjdCBhdWRpbyddLCAgcHJvZ3Jlc3NQYXR0ZXJuOiAvVHJhY2sgKFxcZCspXFwvKFxcZCspL30sXG4gIHtsYWJlbDogJ1RyYW5zY3JpYmUnLCAgICAgc3RhZ2U6ICd0cmFuc2NyaWJlJywgICAgIHBhdHRlcm5zOiBbJ1RyYW5zY3JpYmluZyddLCAgICAgICAgICBlc3RNYXRjaDogWyd0cmFuc2NyaWJlJywgJ2xvYWQgY2FwdGlvbnMnXSwgcHJvZ3Jlc3NQYXR0ZXJuOiAvVHJhY2sgKFxcZCspXFwvKFxcZCspLywgd2FpdFBhdHRlcm46IC9XYWl0aW5nIGZvciB0aGUgc3BlZWNoLXRvLXRleHQgbW9kZWwvfSxcbiAge2xhYmVsOiAnU3BlYWtlcnMnLCAgICAgICBzdGFnZTogJ3NwZWFrZXJzJywgICAgICAgcGF0dGVybnM6IFsnRGV0ZWN0aW5nIHNwZWFrZXJzJ10sICAgIGVzdE1hdGNoOiBbJ3NwZWFrZXIgbGFiZWxzJ119LFxuICB7bGFiZWw6ICdHZW5lcmF0ZSBDbGlwcycsIHN0YWdlOiAnZ2VuZXJhdGVfY2xpcHMnLCBwYXR0ZXJuczogWydHZW5lcmF0aW5nIGNsaXAnXX0sXG4gIHtsYWJlbDogJ0VuZXJneScsICAgICAgICAgc3RhZ2U6ICdlbmVyZ3knLCAgICAgICAgIHBhdHRlcm5zOiBbJ0NvbXB1dGluZyBhdWRpbyBlbmVyZ3knXSwgZXN0TWF0Y2g6IFsnYXVkaW8gZW5lcmd5J119LFxuICB7bGFiZWw6ICdTY2VuZXMnLCAgICAgICAgIHN0YWdlOiAnc2NlbmVzJywgICAgICAgICBwYXR0ZXJuczogWydEZXRlY3Rpbmcgc2NlbmUnXSwgICAgICAgZXN0TWF0Y2g6IFsnc2NlbmUgZGV0ZWN0aW9uJ119LFxuICB7bGFiZWw6ICdTY29yZScsICAgICAgICAgIHN0YWdlOiAnc2NvcmUnLCAgICAgICAgICBwYXR0ZXJuczogWydTY29yaW5nIGNsaXBzJ10sICAgICAgICAgZXN0TWF0Y2g6IFsnbGxtIHNjb3JpbmcnXSwgcHJvZ3Jlc3NQYXR0ZXJuOiAvU2NvcmluZyAoXFxkKylcXC8oXFxkKykvfSxcbl07XG5jb25zdCBTQ09SRV9TVEVQUyA9IFtcbiAge2xhYmVsOiAnRW5lcmd5JywgIHN0YWdlOiAnZW5lcmd5JywgcGF0dGVybnM6IFsnQ29tcHV0aW5nIGF1ZGlvIGVuZXJneSddfSxcbiAge2xhYmVsOiAnU2NlbmVzJywgIHN0YWdlOiAnc2NlbmVzJywgcGF0dGVybnM6IFsnRGV0ZWN0aW5nIHNjZW5lJ119LFxuICB7bGFiZWw6ICdTY29yaW5nJywgc3RhZ2U6ICdzY29yZScsICBwYXR0ZXJuczogWydTY29yaW5nIGNsaXBzJ10sIHByb2dyZXNzUGF0dGVybjogL1Njb3JpbmcgKFxcZCspXFwvKFxcZCspL30sXG5dO1xuLy8gTWFya2VyLWRyaXZlbiBvbmx5ICh0aGUgYW5hbHl6ZS1mcmFtZXMgU1NFIGVtaXRzIG5vIHByb3NlIHN0YWdlIGxpbmVzKSwgc28gdGhlc2Vcbi8vIGNhcnJ5IG5vIHBhdHRlcm5zIC0ganVzdCB0aGUgdHdvIEBAUFJPR1JFU1Mgc3RhZ2VzIHRoZSB2aXNpb24gcm91dGUgZW1pdHMuXG5jb25zdCBGUkFNRVNfU1RFUFMgPSBbXG4gIHtsYWJlbDogJ1NhbXBsZScsICAgc3RhZ2U6ICdmcmFtZXNfc2FtcGxlJywgICBwYXR0ZXJuczogW119LFxuICB7bGFiZWw6ICdEZXNjcmliZScsIHN0YWdlOiAnZnJhbWVzX2Rlc2NyaWJlJywgcGF0dGVybnM6IFtdfSxcbl07XG5cbi8vIFRoZSBmdWxsIHNldCBvZiBrbm93biBAQFBST0dSRVNTIHN0YWdlIGlkcyAtIHRoZSBKUyBtaXJyb3Igb2YgcHJvZ3Jlc3MucHknc1xuLy8gU3RhZ2UgZW51bS4gZnJhbWVzX3NhbXBsZS9mcmFtZXNfZGVzY3JpYmUgZHJpdmUgdGhlIGFuYWx5emUtZnJhbWVzIGpvYi4gS2VwdFxuLy8gYXMgaXRzIG93biBzZXQgKG5vdCBkZXJpdmVkIGZyb20gdGhlIHN0ZXAgZGVmcykgc28gaXQgc3RheXMgdGhlIGNvdXBsaW5nXG4vLyBhbmNob3IgZXZlbiBmb3Igc3RhZ2VzIHdob3NlIHN0ZXAgZGVmIGxpdmVzIGVsc2V3aGVyZS5cbmNvbnN0IF9QUk9HUkVTU19QUkVGSVggPSAnQEBQUk9HUkVTUyAnO1xuY29uc3QgSk9CX1NUQUdFUyA9IG5ldyBTZXQoW1xuICAnZXh0cmFjdCcsICd0cmFuc2NyaWJlJywgJ3NwZWFrZXJzJywgJ2dlbmVyYXRlX2NsaXBzJyxcbiAgJ2VuZXJneScsICdzY2VuZXMnLCAnc2NvcmUnLCAnZnJhbWVzX3NhbXBsZScsICdmcmFtZXNfZGVzY3JpYmUnLFxuXSk7XG5cbi8vIE1pcnJvciBvZiBwcm9ncmVzcy5weSBwYXJzZV9wcm9ncmVzczogcmV0dXJucyB0aGUgbWFya2VyIHBheWxvYWQsIG9yIG51bGwgZm9yXG4vLyBhbnkgbm9uLW1hcmtlciAvIG1hbGZvcm1lZCAvIHVua25vd24tc3RhZ2UgbGluZSAoc28gb3JkaW5hcnkgbG9nIG91dHB1dCBmYWxsc1xuLy8gdGhyb3VnaCB0byB0aGUgcHJvc2UgZmFsbGJhY2sgcmF0aGVyIHRoYW4gYmVpbmcgbWlzcmVhZCBhcyBwcm9ncmVzcykuXG5mdW5jdGlvbiBwYXJzZVByb2dyZXNzKGxpbmUpIHtcbiAgaWYgKCFsaW5lIHx8ICFsaW5lLnN0YXJ0c1dpdGgoX1BST0dSRVNTX1BSRUZJWCkpIHJldHVybiBudWxsO1xuICBsZXQgcGF5bG9hZDtcbiAgdHJ5IHsgcGF5bG9hZCA9IEpTT04ucGFyc2UobGluZS5zbGljZShfUFJPR1JFU1NfUFJFRklYLmxlbmd0aCkpOyB9XG4gIGNhdGNoIChlKSB7IHJldHVybiBudWxsOyB9XG4gIGlmICghcGF5bG9hZCB8fCB0eXBlb2YgcGF5bG9hZCAhPT0gJ29iamVjdCcgfHwgIUpPQl9TVEFHRVMuaGFzKHBheWxvYWQuc3RhZ2UpKSByZXR1cm4gbnVsbDtcbiAgcmV0dXJuIHBheWxvYWQ7XG59XG5cbi8vIHN0ZXBJZHggLT4gYSB0cmFuc2llbnQgc3RhdHVzIG1lc3NhZ2Ugc2hvd24gaW4gcGxhY2Ugb2YgdGhlIHN0ZXAncyB0aW1pbmdcbi8vIGxhYmVsIChlLmcuIFwid2FpdGluZyBmb3IgdGhlIHNwZWVjaCBtb2RlbCB0byBmaW5pc2ggZG93bmxvYWRpbmdcIikuIFNldCB3aGVuIGFcbi8vIHN0ZXAncyB3YWl0UGF0dGVybiBtYXRjaGVzLCBjbGVhcmVkIHdoZW4gdGhhdCBzdGVwIHJlcG9ydHMgcmVhbCBwcm9ncmVzcy5cbmxldCBfc3RlcFdhaXRpbmdNc2cgPSB7fTtcbmxldCBfam9iQWN0aXZlICAgICA9IGZhbHNlO1xubGV0IF9hY3RpdmVKb2JDbGVhbnVwID0gbnVsbDtcbmxldCBfam9iVGltZXIgICAgICA9IG51bGw7XG5sZXQgX2pvYkhpZGVUaW1lciAgPSBudWxsO1xubGV0IF9qb2JQYXVzYWJsZSAgID0gZmFsc2U7XG5sZXQgX2pvYlBhdXNlZCAgICAgPSBmYWxzZTtcbmxldCBfam9iVGhlcm1hbFBvbGxUaW1lciA9IG51bGw7XG5sZXQgX2xhc3RHcHVTdGF0ZSAgPSAndW5hdmFpbGFibGUnO1xuXG4vLyBCZXN0LWVmZm9ydCBsb29rdXAgb2YgYSBwaWxsJ3MgcHJlLXJ1biB0aW1lIGVzdGltYXRlIChmcm9tIHRoZSBsYXN0XG4vLyAvYXBpL2VzdGltYXRlIGNhbGwsIHNhdmVkIGJ5IHJlbmRlckVzdGltYXRlKSBmb3IgdXNlIGFzIGEgaG92ZXIgdG9vbHRpcC5cbmZ1bmN0aW9uIF9lc3RpbWF0ZUhtc0ZvcihzdGVwRGVmKSB7XG4gIGNvbnN0IHN0ZXBzID0gQXBwU3RhdGUubGFzdEVzdGltYXRlU3RlcHM7XG4gIGlmICghc3RlcHMgfHwgIXN0ZXBEZWYuZXN0TWF0Y2gpIHJldHVybiBudWxsO1xuICBjb25zdCBtYXRjaCA9IHN0ZXBzLmZpbmQoZXMgPT5cbiAgICBzdGVwRGVmLmVzdE1hdGNoLnNvbWUoa2V5ID0+IChlcy5uYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGtleSkpXG4gICk7XG4gIHJldHVybiBtYXRjaCA/IG1hdGNoLmhtcyA6IG51bGw7XG59XG5cbi8vIFBlci1pdGVtIGJ1dHRvbnMgdGhhdCB0cmlnZ2VyIGEgaGVhdnkgb3AgYXJlIHRhZ2dlZCBkYXRhLWpvYi1ibG9ja2VkLiBEaXNhYmxlXG4vLyB0aGVtICh3aXRoIGEgd2h5LXRvb2x0aXApIHdoaWxlIGFueSBqb2IgcnVucyBzbyBhIHVzZXIgY2FuJ3Qgc3RhcnQgYSBzZWNvbmQgam9iXG4vLyB0aGUgYmFja2VuZCB3b3VsZCBqdXN0IDQwOS4gVGhlIGhlYWRlciAjYnRuLWFuYWx5emUgaXMgaGFuZGxlZCBpbmxpbmUgYmVsb3cuXG4vLyByZW5kZXJEZXRhaWwgY2FsbHMgYXBwbHlKb2JCbG9ja2VkU3RhdGUoKSBzbyBhIHBhbmVsIHJlYnVpbHQgbWlkLWpvYiBjb21lcyB1cFxuLy8gYWxyZWFkeSBkaXNhYmxlZCAtIHRoZSB0YWcgbGl2ZXMgaW4gZnJlc2hseS1idWlsdCBpbm5lckhUTUwsIG5vdCBhIGxpdmUgbm9kZS5cbmZ1bmN0aW9uIF9zZXRKb2JCbG9ja2VkQnV0dG9ucyhkaXNhYmxlZCkge1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1qb2ItYmxvY2tlZF0nKS5mb3JFYWNoKGIgPT4ge1xuICAgIGIuZGlzYWJsZWQgPSBkaXNhYmxlZDtcbiAgICBiLnRpdGxlID0gZGlzYWJsZWQgPyAnQW5vdGhlciBqb2IgaXMgcnVubmluZyAtIHdhaXQgZm9yIGl0IHRvIGZpbmlzaCBvciBjYW5jZWwgaXQnIDogJyc7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhcHBseUpvYkJsb2NrZWRTdGF0ZSgpIHsgX3NldEpvYkJsb2NrZWRCdXR0b25zKF9qb2JBY3RpdmUpOyB9XG5cbmZ1bmN0aW9uIHN0YXJ0Sm9iVUkoc3RlcERlZnMsIGpvYkxhYmVsLCBjYW5jZWxsYWJsZSA9IGZhbHNlLCBwYXVzYWJsZSA9IGZhbHNlKSB7XG4gIF9qb2JBY3RpdmUgICAgID0gdHJ1ZTtcbiAgX2pvYlN0ZXBEZWZzICAgPSBzdGVwRGVmcztcbiAgX2FjdGl2ZVN0ZXBJZHggPSAtMTtcbiAgX2pvYlN0YXJ0VGltZSAgPSBEYXRlLm5vdygpO1xuICBfc3RlcFN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gIF9zdGVwUHJvZ3Jlc3MgID0ge307XG4gIF9zdGVwUmF0ZUFuY2hvciA9IHt9O1xuICBfc3RlcFdhaXRpbmdNc2cgPSB7fTtcbiAgX2pvYlBhdXNhYmxlICAgPSBwYXVzYWJsZTtcbiAgX2pvYlBhdXNlZCAgICAgPSBmYWxzZTtcbiAgX2FjdGl2ZUNhbmNlbCAgPSBfQU5BTFlaRV9DQU5DRUw7XG4gIGlmIChfam9iVGltZXIpIGNsZWFySW50ZXJ2YWwoX2pvYlRpbWVyKTtcbiAgX2pvYlRpbWVyID0gc2V0SW50ZXJ2YWwoX3RpY2tKb2JUaW1lciwgMTAwMCk7XG4gIGlmIChfam9iSGlkZVRpbWVyKSB7IGNsZWFyVGltZW91dChfam9iSGlkZVRpbWVyKTsgX2pvYkhpZGVUaW1lciA9IG51bGw7IH1cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1zdGVwcycpLmlubmVySFRNTCA9XG4gICAgYDxzcGFuIHN0eWxlPVwiY29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi1yaWdodDo0cHhcIj4ke2VzY0h0bWwoam9iTGFiZWwpfTwvc3Bhbj5gICtcbiAgICBzdGVwRGVmcy5tYXAoKHMsIGkpID0+IHtcbiAgICAgIGNvbnN0IGVzdCA9IF9lc3RpbWF0ZUhtc0ZvcihzKTtcbiAgICAgIGNvbnN0IHRpdGxlID0gZXN0ID8gYCB0aXRsZT1cIkVzdGltYXRlZDogJHtlc2NIdG1sKGVzdCl9XCJgIDogJyc7XG4gICAgICByZXR1cm4gYDxzcGFuIGNsYXNzPVwic3RlcFwiIGlkPVwic3RlcC0ke2l9XCIke3RpdGxlfT4ke3MubGFiZWx9PC9zcGFuPmA7XG4gICAgfSkuam9pbignJyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2Itc3RhdHVzJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVhZGVyLXNwYWNlcicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJyNidG4tYW5hbHl6ZSwjYnRuLXNjb3JlJykuZm9yRWFjaChiID0+IGIuZGlzYWJsZWQgPSB0cnVlKTtcbiAgY29uc3QgYW5hbHl6ZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tYW5hbHl6ZScpO1xuICBpZiAoYW5hbHl6ZUJ0bikgYW5hbHl6ZUJ0bi50aXRsZSA9ICdBIGpvYiBpcyBhbHJlYWR5IHJ1bm5pbmcnO1xuICBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnModHJ1ZSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2FuY2VsLWpvYicpLnN0eWxlLmRpc3BsYXkgPSBjYW5jZWxsYWJsZSA/ICcnIDogJ25vbmUnO1xuICBfcmVuZGVyUGF1c2VVSSgpO1xuICBpZiAoX2pvYlRoZXJtYWxQb2xsVGltZXIpIGNsZWFySW50ZXJ2YWwoX2pvYlRoZXJtYWxQb2xsVGltZXIpO1xuICBpZiAocGF1c2FibGUpIHtcbiAgICBfbGFzdEdwdVN0YXRlID0gJ3VuYXZhaWxhYmxlJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnam9iLWdwdS10ZW1wJykuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBfcG9sbFRoZXJtYWxTdGF0dXMoKTtcbiAgICBfam9iVGhlcm1hbFBvbGxUaW1lciA9IHNldEludGVydmFsKF9wb2xsVGhlcm1hbFN0YXR1cywgNTAwMCk7XG4gIH1cbiAgaWYgKHdpbmRvdy5fcmVuZGVyQ2xpcEZpbHRlckNvdW50cykgX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMoKTtcbn1cblxuLy8gUG9sbGVkIGV2ZXJ5IDVzIChvbmx5IHdoaWxlIGEgcGF1c2FibGUgLSBpLmUuIGFuYWx5emUtdHlwZSAtIGpvYiBpcyBhY3RpdmUpIHRvXG4vLyBkcml2ZSB0aGUgam9iLWhlYWRlciBHUFUgdGVtcGVyYXR1cmUgcmVhZG91dCBhbmQgdGhlIHdhcm4vYXV0by1wYXVzZSBub3RpY2VzLlxuLy8gVXNlcyAvYXBpL3N0YXR1cyByYXRoZXIgdGhhbiBTU0UgbG9nLWxpbmUgbWF0Y2hpbmcgc28gaXQgYWxzbyB3b3JrcyBjb3JyZWN0bHlcbi8vIGFjcm9zcyB0aGUgSlMgc2VxdWVudGlhbC1zZWdtZW50IHJ1bm5lcnMnIGdhcHMgYmV0d2VlbiBwZXItc2VnbWVudCBqb2JzLlxuYXN5bmMgZnVuY3Rpb24gX3BvbGxUaGVybWFsU3RhdHVzKCkge1xuICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaCgnL2FwaS9zdGF0dXMnKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+IG51bGwpO1xuICBpZiAoIXN0YXR1cykgcmV0dXJuO1xuICBjb25zdCByZWFkb3V0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1ncHUtdGVtcCcpO1xuICBpZiAocmVhZG91dCkge1xuICAgIGlmIChzdGF0dXMuZ3B1X3RlbXBfYyA9PSBudWxsKSB7XG4gICAgICByZWFkb3V0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlYWRvdXQuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgICAgcmVhZG91dC5jbGFzc05hbWUgPSAnZ3B1LXRlbXAtcmVhZG91dCcgKyAoc3RhdHVzLmdwdV9zdGF0ZSA9PT0gJ29rJyA/ICcnIDogYCAke3N0YXR1cy5ncHVfc3RhdGV9YCk7XG4gICAgICByZWFkb3V0LnRleHRDb250ZW50ID0gYEdQVSAke01hdGgucm91bmQoc3RhdHVzLmdwdV90ZW1wX2MpfcKwQ2A7XG4gICAgfVxuICB9XG4gIGlmIChzdGF0dXMuZ3B1X3N0YXRlID09PSAnd2FybicgJiYgX2xhc3RHcHVTdGF0ZSAhPT0gJ3dhcm4nICYmIF9sYXN0R3B1U3RhdGUgIT09ICdwYXVzZScpIHtcbiAgICBjb25zdCBuZXh0ID0gc3RhdHVzLnRoZXJtYWxfYXV0b3BhdXNlX2VuYWJsZWRcbiAgICAgID8gYEFuYWx5c2lzIHdpbGwgYXV0by1wYXVzZSBpZiBpdCByZWFjaGVzICR7TWF0aC5yb3VuZChzdGF0dXMudGhlcm1hbF9wYXVzZV9jKX3CsEMuYFxuICAgICAgOiBgQXV0by1wYXVzZSBpcyBvZmYgLSBwYXVzZSB0aGUgam9iIG1hbnVhbGx5IGlmIGl0IGtlZXBzIGNsaW1iaW5nLmA7XG4gICAgd2luZG93LnNob3dUb2FzdChgR1BVIHJ1bm5pbmcgaG90IC0gJHtNYXRoLnJvdW5kKHN0YXR1cy5ncHVfdGVtcF9jKX3CsEMuICR7bmV4dH1gLCAnd2FybmluZycpO1xuICB9XG4gIGlmIChzdGF0dXMuZ3B1X3N0YXRlID09PSAncGF1c2UnICYmIF9sYXN0R3B1U3RhdGUgIT09ICdwYXVzZScpIHtcbiAgICBfam9iUGF1c2VkID0gdHJ1ZTtcbiAgICBfcmVuZGVyUGF1c2VVSSgpO1xuICAgIHdpbmRvdy5zaG93VG9hc3QoYEF1dG8tcGF1c2VkOiBHUFUgcmVhY2hlZCAke01hdGgucm91bmQoc3RhdHVzLmdwdV90ZW1wX2MpfcKwQyAtIHdpbGwgaG9sZCBiZWZvcmUgdGhlIG5leHQgdmlkZW9gLCAnd2FybmluZycsIHtcbiAgICAgIGR1cmF0aW9uTXM6IDIwMDAwLFxuICAgICAgYWN0aW9uOiB7bGFiZWw6ICdSZXN1bWUgbm93Jywgb25DbGljazogdG9nZ2xlUGF1c2VKb2J9LFxuICAgIH0pO1xuICB9XG4gIF9sYXN0R3B1U3RhdGUgPSBzdGF0dXMuZ3B1X3N0YXRlO1xufVxuXG4vLyBcIlBhdXNlIGFmdGVyIGN1cnJlbnQgdmlkZW9cIiB0b2dnbGUgaW4gdGhlIGpvYiBoZWFkZXIgLSBvbmx5IHNob3duIGZvciBqb2JzXG4vLyBiYWNrZWQgYnkgdGhlIHBhdXNlIGZsYWcgZmlsZSAodGhlIHNpbmdsZSBhbmFseXplIHN0cmVhbSBhbmQgdGhlIEpTXG4vLyBzZXF1ZW50aWFsLXNlZ21lbnQgcnVubmVyczsgc2VlIHRvZ2dsZVBhdXNlSm9iKS5cbmZ1bmN0aW9uIF9yZW5kZXJQYXVzZVVJKCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXBhdXNlLWpvYicpO1xuICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItcGF1c2VkLWJhZGdlJyk7XG4gIGlmICghYnRuIHx8ICFiYWRnZSkgcmV0dXJuO1xuICBidG4uc3R5bGUuZGlzcGxheSA9IF9qb2JQYXVzYWJsZSA/ICcnIDogJ25vbmUnO1xuICBidG4udGV4dENvbnRlbnQgPSBfam9iUGF1c2VkID8gJ1Jlc3VtZScgOiAnUGF1c2UgYWZ0ZXIgY3VycmVudCB2aWRlbyc7XG4gIGJhZGdlLnN0eWxlLmRpc3BsYXkgPSBfam9iUGF1c2VkID8gJycgOiAnbm9uZSc7XG59XG5cbi8vIFJlZmxlY3RzIGFuIGFscmVhZHktcGF1c2VkIGpvYiBkaXNjb3ZlcmVkIHZpYSAvYXBpL3N0YXR1cyAocGFnZSByZWNvbm5lY3QpIC1cbi8vIGRvZXMgbm90IGl0c2VsZiBjYWxsIHRoZSBwYXVzZS9yZXN1bWUgQVBJLlxuZnVuY3Rpb24gX3NldFBhdXNlZFVJRnJvbVN0YXR1cyhwYXVzZWQpIHtcbiAgX2pvYlBhdXNlZCA9ICEhcGF1c2VkO1xuICBfcmVuZGVyUGF1c2VVSSgpO1xufVxuXG5hc3luYyBmdW5jdGlvbiB0b2dnbGVQYXVzZUpvYigpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1wYXVzZS1qb2InKTtcbiAgY29uc3Qgd2FudFBhdXNlID0gIV9qb2JQYXVzZWQ7XG4gIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIHRyeSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYC9hcGkvYW5hbHl6ZS8ke3dhbnRQYXVzZSA/ICdwYXVzZScgOiAncmVzdW1lJ31gLCB7bWV0aG9kOiAnUE9TVCd9KTtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgd2luZG93LnNob3dUb2FzdChmb3JtYXRBcGlFcnJvcihkYXRhKSB8fCBgQ291bGQgbm90ICR7d2FudFBhdXNlID8gJ3BhdXNlJyA6ICdyZXN1bWUnfWAsICdlcnJvcicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZGF0YS5zdGF0dXMgPT09ICduby1vcCcpIHtcbiAgICAgIHdpbmRvdy5zaG93VG9hc3QoZGF0YS5tZXNzYWdlIHx8ICdObyBhbmFseXNpcyBpcyBydW5uaW5nLicsICdpbmZvJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIF9qb2JQYXVzZWQgPSB3YW50UGF1c2U7XG4gICAgX3JlbmRlclBhdXNlVUkoKTtcbiAgICB3aW5kb3cuc2hvd1RvYXN0KHdhbnRQYXVzZSA/ICdXaWxsIHBhdXNlIGJlZm9yZSB0aGUgbmV4dCB2aWRlbycgOiAnUmVzdW1lZCcsICdpbmZvJyk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHdpbmRvdy5zaG93VG9hc3Qod2luZG93Lm5ldEVyck1zZyhlcnIpLCAnZXJyb3InKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgfVxufVxuXG4vLyBNYXJrIHN0ZXAgKmlkeCogYWN0aXZlIGFuZCBldmVyeSBlYXJsaWVyIHN0ZXAgZG9uZS4gU2hhcmVkIGJ5IHRoZSBwcm9zZVxuLy8gbWF0Y2hlciAodXBkYXRlSm9iVUkpIGFuZCB0aGUgbWFya2VyIHBhdGggKF9kcml2ZVN0ZXBGcm9tTWFya2VyKSBzbyBhIHN0YWdlXG4vLyBhZHZhbmNlIGJlaGF2ZXMgaWRlbnRpY2FsbHkgaG93ZXZlciBpdCB3YXMgZGV0ZWN0ZWQuXG5mdW5jdGlvbiBfYWN0aXZhdGVTdGVwKGlkeCkge1xuICBjb25zdCBwcmV2U3RlcElkeCA9IF9hY3RpdmVTdGVwSWR4O1xuICBmb3IgKGxldCBqID0gMDsgaiA8IGlkeDsgaisrKSB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgc3RlcC0ke2p9YCk7XG4gICAgaWYgKGVsKSB7IGVsLmNsYXNzTmFtZSA9ICdzdGVwIGRvbmUnOyBlbC5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnJzsgZWwudGV4dENvbnRlbnQgPSAn4pyTJzsgZWwudGl0bGUgPSBfam9iU3RlcERlZnNbal0ubGFiZWw7IH1cbiAgfVxuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7aWR4fWApO1xuICBpZiAoZWwpIHsgZWwuY2xhc3NOYW1lID0gJ3N0ZXAgYWN0aXZlJzsgX2FjdGl2ZVN0ZXBJZHggPSBpZHg7IH1cbiAgaWYgKF9hY3RpdmVTdGVwSWR4ICE9PSBwcmV2U3RlcElkeCkge1xuICAgIF9zdGVwU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAvLyBXaGVuIHRoZSBwaXBlbGluZSBhZHZhbmNlcyBhIHN0YWdlLCByZWZyZXNoIHRoZSBzaWRlYmFyIHNvIGEgbmV3bHktYW5hbHl6aW5nXG4gICAgLy8gcmVjb3JkaW5nIGFwcGVhcnMgKHJlcGxhY2luZyBpdHMgcGxhY2Vob2xkZXIpIGFuZCBpdHMgc3RhdHVzIHN0YXlzIGN1cnJlbnQsXG4gICAgLy8gYW5kIHJlZnJlc2ggdGhlIG9wZW4gY2xpcCBsaXN0IHRvIHBpY2sgdXAgZnJlc2hseS1jb21taXR0ZWQgY2xpcHMvc2NvcmVzLlxuICAgIF9kZWJvdW5jZWRTaWRlYmFyUmVmcmVzaCgpO1xuICAgIF9kZWJvdW5jZWRDbGlwTGlzdFJlZnJlc2goKTtcbiAgfVxufVxuXG4vLyBSZWNvcmQgYSBzdGVwJ3MgY3VycmVudC90b3RhbCwgYW5jaG9yaW5nIHRoZSB0aHJvdWdocHV0IHJhdGUgYXQgdGhlIGZpcnN0XG4vLyBvYnNlcnZlZCBjb3VudCBzbyBhIGNvbGQgZmlyc3QgaXRlbSBpcyBleGNsdWRlZCBmcm9tIHRoZSBFVEEgZXh0cmFwb2xhdGlvbi5cbmZ1bmN0aW9uIF9zZXRTdGVwUHJvZ3Jlc3MoaWR4LCBjdXJyZW50LCB0b3RhbCkge1xuICAvLyBSZWFsIHByb2dyZXNzIG1lYW5zIGFueSB3YWl0IChlLmcuIG1vZGVsIGRvd25sb2FkKSBpcyBvdmVyIC0gZHJvcCBpdCBzbyB0aGVcbiAgLy8gcGlsbCBzd2l0Y2hlcyBiYWNrIHRvIGxpdmUgY291bnRzLlxuICBkZWxldGUgX3N0ZXBXYWl0aW5nTXNnW2lkeF07XG4gIF9zdGVwUHJvZ3Jlc3NbaWR4XSA9IHtjdXJyZW50LCB0b3RhbH07XG4gIGlmICghX3N0ZXBSYXRlQW5jaG9yW2lkeF0pIF9zdGVwUmF0ZUFuY2hvcltpZHhdID0ge3Q6IERhdGUubm93KCksIGN1cnJlbnR9O1xuICBfcmVuZGVyU3RlcFBpbGwoaWR4KTtcbiAgX2RlYm91bmNlZENsaXBMaXN0UmVmcmVzaCgpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVKb2JVSShsaW5lKSB7XG4gIF9qb2JTdGVwRGVmcy5mb3JFYWNoKChzLCBpKSA9PiB7XG4gICAgaWYgKHMucGF0dGVybnMuc29tZShwID0+IGxpbmUuaW5jbHVkZXMocCkpKSBfYWN0aXZhdGVTdGVwKGkpO1xuICB9KTtcbiAgY29uc3QgYWN0aXZlRGVmID0gX2pvYlN0ZXBEZWZzW19hY3RpdmVTdGVwSWR4XTtcbiAgaWYgKGFjdGl2ZURlZiAmJiBhY3RpdmVEZWYud2FpdFBhdHRlcm4gJiYgYWN0aXZlRGVmLndhaXRQYXR0ZXJuLnRlc3QobGluZSkpIHtcbiAgICBfc3RlcFdhaXRpbmdNc2dbX2FjdGl2ZVN0ZXBJZHhdID0gJ3dhaXRpbmcgZm9yIHRoZSBzcGVlY2ggbW9kZWwgdG8gZmluaXNoIGRvd25sb2FkaW5nJztcbiAgICBfcmVuZGVyU3RlcFBpbGwoX2FjdGl2ZVN0ZXBJZHgpO1xuICB9XG4gIGlmIChhY3RpdmVEZWYgJiYgYWN0aXZlRGVmLnByb2dyZXNzUGF0dGVybikge1xuICAgIGNvbnN0IG0gPSBsaW5lLm1hdGNoKGFjdGl2ZURlZi5wcm9ncmVzc1BhdHRlcm4pO1xuICAgIGlmIChtKSBfc2V0U3RlcFByb2dyZXNzKF9hY3RpdmVTdGVwSWR4LCBwYXJzZUludChtWzFdLCAxMCksIHBhcnNlSW50KG1bMl0sIDEwKSk7XG4gIH1cbiAgaWYgKHdpbmRvdy5fc3luY0FuYWx5c2lzTGl2ZVBhbmVsKSBfc3luY0FuYWx5c2lzTGl2ZVBhbmVsKCk7XG59XG5cbi8vIERyaXZlIHRoZSBwaWxsIHJvdyBmcm9tIGEgcGFyc2VkIEBAUFJPR1JFU1MgbWFya2VyOiBkZXRlcm1pbmlzdGljIHN0YWdlXG4vLyBhZHZhbmNlIHBsdXMgb3B0aW9uYWwgY3VycmVudC90b3RhbCwga2V5ZWQgb24gdGhlIHN0ZXAgZGVmJ3Mgc3RhZ2UgaWQuXG5mdW5jdGlvbiBfZHJpdmVTdGVwRnJvbU1hcmtlcihtYXJrZXIpIHtcbiAgY29uc3QgaWR4ID0gX2pvYlN0ZXBEZWZzLmZpbmRJbmRleChzID0+IHMuc3RhZ2UgPT09IG1hcmtlci5zdGFnZSk7XG4gIGlmIChpZHggPCAwKSByZXR1cm47XG4gIF9hY3RpdmF0ZVN0ZXAoaWR4KTtcbiAgaWYgKHR5cGVvZiBtYXJrZXIuZG9uZSA9PT0gJ251bWJlcicgJiYgdHlwZW9mIG1hcmtlci50b3RhbCA9PT0gJ251bWJlcicgJiYgbWFya2VyLnRvdGFsID4gMCkge1xuICAgIF9zZXRTdGVwUHJvZ3Jlc3MoaWR4LCBtYXJrZXIuZG9uZSwgbWFya2VyLnRvdGFsKTtcbiAgfVxuICBpZiAod2luZG93Ll9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwoKTtcbn1cblxubGV0IF9zaWRlYmFyUmVmcmVzaFRpbWVyID0gbnVsbDtcbmZ1bmN0aW9uIF9kZWJvdW5jZWRTaWRlYmFyUmVmcmVzaCgpIHtcbiAgaWYgKF9zaWRlYmFyUmVmcmVzaFRpbWVyKSByZXR1cm47XG4gIF9zaWRlYmFyUmVmcmVzaFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7IF9zaWRlYmFyUmVmcmVzaFRpbWVyID0gbnVsbDsgd2luZG93LmxvYWRWaWRlb3MoKTsgfSwgMTIwMCk7XG59XG5cbmxldCBfY2xpcExpc3RSZWZyZXNoVGltZXIgPSBudWxsO1xuLy8gU2FtZSBwdXNoLWRyaXZlbi1idXQtZGVib3VuY2VkIHBhdHRlcm4gYXMgX2RlYm91bmNlZFNpZGViYXJSZWZyZXNoIGFib3ZlLFxuLy8gdHJpZ2dlcmVkIG9mZiB0aGUgU1NFIGxpbmUgc3RyZWFtIHJhdGhlciB0aGFuIGEgcG9sbGluZyB0aW1lci4gT25seSByZWZyZXNoZXNcbi8vIHdoZW4gdGhlIHZpZGVvIGJlaW5nIGFuYWx5emVkIGlzIHRoZSBvbmUgY3VycmVudGx5IG9wZW4sIHNvIG5ld2x5LWNvbW1pdHRlZFxuLy8gY2xpcCBzY29yZXMgKHl1dV9jbGlwL3Njb3JpbmcvZW5naW5lLnB5IG5vdyBjb21taXRzIHBlciBjbGlwKSBmaWxsIGludG8gdGhlXG4vLyB2aXNpYmxlIGxpc3QgbGl2ZSBpbnN0ZWFkIG9mIHJlcXVpcmluZyBhIG1hbnVhbCBwYWdlIHJlZnJlc2guXG5mdW5jdGlvbiBfZGVib3VuY2VkQ2xpcExpc3RSZWZyZXNoKCkge1xuICBpZiAoX2NsaXBMaXN0UmVmcmVzaFRpbWVyKSByZXR1cm47XG4gIF9jbGlwTGlzdFJlZnJlc2hUaW1lciA9IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgIF9jbGlwTGlzdFJlZnJlc2hUaW1lciA9IG51bGw7XG4gICAgaWYgKCFBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkIHx8ICFBcHBTdGF0ZS5hbmFseXplRmlsZW5hbWUpIHJldHVybjtcbiAgICBjb25zdCBhbmFseXppbmcgPSBBcHBTdGF0ZS52aWRlb3MuZmluZCh2ID0+IHYuZmlsZW5hbWUgPT09IEFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSk7XG4gICAgaWYgKCFhbmFseXppbmcgfHwgYW5hbHl6aW5nLmlkICE9PSBBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKSByZXR1cm47XG4gICAgQXBwU3RhdGUuY2xpcHMgPSBhd2FpdCBmZXRjaCh3aW5kb3cuX2NsaXBzTGlzdFVybChBcHBTdGF0ZS5hY3RpdmVWaWRlb0lkKSkudGhlbihyID0+IHIuanNvbigpKTtcbiAgICB3aW5kb3cuX3JlbmRlckNsaXBzKCk7XG4gIH0sIDEyMDApO1xufVxuXG4vLyBCdWlsZHMgdGhlIGxpdmUgbGFiZWwgZm9yIGEgc3RlcCBwaWxsOiBcIlNjb3JlIMK3IDMvMTIgKDI1JSkgwrcgMDo0MiAofjI6MDZcbi8vIGxlZnQpXCIgb25jZSBwZXItaXRlbSBjb3VudHMgYXJyaXZlIGZyb20gdGhlIHN1YnByb2Nlc3MgbG9nOyBlbGFwc2VkLW9ubHlcbi8vIChmYWxsaW5nIGJhY2sgdG8gdGhlIHByZS1ydW4gL2FwaS9lc3RpbWF0ZSBmaWd1cmUpIGJlZm9yZSB0aGUgZmlyc3QgY291bnQuXG5mdW5jdGlvbiBfc3RlcFBpbGxMYWJlbChpZHgpIHtcbiAgY29uc3QgZGVmID0gX2pvYlN0ZXBEZWZzW2lkeF07XG4gIGlmICghZGVmKSByZXR1cm4ge3RleHQ6ICcnLCBwY3Q6IG51bGx9O1xuICBjb25zdCB3YWl0aW5nID0gX3N0ZXBXYWl0aW5nTXNnW2lkeF07XG4gIGlmICh3YWl0aW5nKSByZXR1cm4ge3RleHQ6IGAke2RlZi5sYWJlbH0gwrcgJHt3YWl0aW5nfWAsIHBjdDogbnVsbH07XG4gIGNvbnN0IGVsYXBzZWRNcyA9IERhdGUubm93KCkgLSBfc3RlcFN0YXJ0VGltZTtcbiAgY29uc3QgcHJvZ3Jlc3MgID0gX3N0ZXBQcm9ncmVzc1tpZHhdO1xuICBpZiAoIXByb2dyZXNzIHx8ICFwcm9ncmVzcy5jdXJyZW50KSB7XG4gICAgY29uc3QgZXN0ID0gX2VzdGltYXRlSG1zRm9yKGRlZik7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRleHQ6IGVzdCA/IGAke2RlZi5sYWJlbH0gwrcgJHtfZm10RWxhcHNlZChlbGFwc2VkTXMpfSAofiR7ZXN0fSlgIDogYCR7ZGVmLmxhYmVsfSDCtyAke19mbXRFbGFwc2VkKGVsYXBzZWRNcyl9YCxcbiAgICAgIHBjdDogbnVsbCxcbiAgICB9O1xuICB9XG4gIGNvbnN0IHtjdXJyZW50LCB0b3RhbH0gPSBwcm9ncmVzcztcbiAgY29uc3QgcGN0ICAgID0gTWF0aC5yb3VuZChjdXJyZW50IC8gdG90YWwgKiAxMDApO1xuICAvLyBFVEEgZnJvbSB0aHJvdWdocHV0IHNpbmNlIHRoZSByYXRlIGFuY2hvciAoZmlyc3Qgb2JzZXJ2ZWQgY291bnQpLCBub3QgZnJvbVxuICAvLyBlbGFwc2VkL2N1cnJlbnQgLSB0aGUgbGF0dGVyIGxldCBhIHNsb3cgY29sZCBmaXJzdCBpdGVtIHByb2plY3QgYWJzdXJkXG4gIC8vIGZpZ3VyZXMgKGUuZy4gXCI3NyBtaW4gbGVmdFwiIHRoYXQgdmFuaXNoZWQgd2hlbiB0aGUgc3RlcCBmaW5pc2hlZCBzZWNvbmRzIGxhdGVyKS5cbiAgY29uc3QgYW5jaG9yID0gX3N0ZXBSYXRlQW5jaG9yW2lkeF07XG4gIGxldCBldGEgPSAnJztcbiAgaWYgKGFuY2hvciAmJiBjdXJyZW50ID4gYW5jaG9yLmN1cnJlbnQpIHtcbiAgICBjb25zdCBtc1Blckl0ZW0gPSAoRGF0ZS5ub3coKSAtIGFuY2hvci50KSAvIChjdXJyZW50IC0gYW5jaG9yLmN1cnJlbnQpO1xuICAgIGNvbnN0IHJlbWFpbmluZ01zID0gbXNQZXJJdGVtICogKHRvdGFsIC0gY3VycmVudCk7XG4gICAgaWYgKGlzRmluaXRlKHJlbWFpbmluZ01zKSAmJiByZW1haW5pbmdNcyA+PSAwKSBldGEgPSBgICh+JHtfZm10RWxhcHNlZChyZW1haW5pbmdNcyl9IGxlZnQpYDtcbiAgfVxuICByZXR1cm4ge1xuICAgIHRleHQ6IGAke2RlZi5sYWJlbH0gwrcgJHtjdXJyZW50fS8ke3RvdGFsfSAoJHtwY3R9JSkgwrcgJHtfZm10RWxhcHNlZChlbGFwc2VkTXMpfSR7ZXRhfWAsXG4gICAgcGN0LFxuICB9O1xufVxuXG4vLyBQYWludHMgb25lIHN0ZXAgcGlsbCdzIHRleHQgYW5kLCBmb3IgYW4gaW4tcHJvZ3Jlc3Mgc3RlcCB3aXRoIGtub3duIGNvdW50cyxcbi8vIGEgdHdvLXRvbmUgZ3JhZGllbnQgZmlsbCBzdGFuZGluZyBpbiBmb3IgYSBwcm9ncmVzcyBiYXIgKGRvbmUvcGVuZGluZyBwaWxsc1xuLy8ga2VlcCB0aGVpciBmbGF0IENTUyBjbGFzcyBjb2xvciAtIG5vIGZpbGwpLiBTaGFyZWQgYnkgdGhlIGhlYWRlciBwaWxsIHJvd1xuLy8gYW5kICh2aWEgX3N5bmNBbmFseXNpc0xpdmVQYW5lbCkgdGhlIGluLWRldGFpbCBtaXJyb3IgcGFuZWwuXG5mdW5jdGlvbiBfcmVuZGVyU3RlcFBpbGwoaWR4KSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHN0ZXAtJHtpZHh9YCk7XG4gIGlmICghZWwgfHwgIWVsLmNsYXNzTGlzdC5jb250YWlucygnYWN0aXZlJykpIHJldHVybjtcbiAgY29uc3Qge3RleHQsIHBjdH0gPSBfc3RlcFBpbGxMYWJlbChpZHgpO1xuICBlbC50ZXh0Q29udGVudCA9IHRleHQ7XG4gIGVsLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IHBjdCAhPSBudWxsXG4gICAgPyBgbGluZWFyLWdyYWRpZW50KHRvIHJpZ2h0LCB2YXIoLS1ncmVlbikgJHtwY3R9JSwgdmFyKC0tYWNjZW50KSAke3BjdH0lKWBcbiAgICA6ICcnO1xufVxuXG5mdW5jdGlvbiBfdGlja0pvYlRpbWVyKCkge1xuICBpZiAod2luZG93Ll9zeW5jQW5hbHlzaXNMaXZlUGFuZWwpIF9zeW5jQW5hbHlzaXNMaXZlUGFuZWwoKTtcbiAgaWYgKF9hY3RpdmVTdGVwSWR4IDwgMCkgcmV0dXJuO1xuICBfcmVuZGVyU3RlcFBpbGwoX2FjdGl2ZVN0ZXBJZHgpO1xufVxuXG5mdW5jdGlvbiBlbmRKb2JVSSgpIHtcbiAgaWYgKF9qb2JUaW1lcikgeyBjbGVhckludGVydmFsKF9qb2JUaW1lcik7IF9qb2JUaW1lciA9IG51bGw7IH1cbiAgX2pvYlN0ZXBEZWZzLmZvckVhY2goKHMsIGkpID0+IHtcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBzdGVwLSR7aX1gKTtcbiAgICBpZiAoZWwpIHsgZWwuY2xhc3NOYW1lID0gJ3N0ZXAgZG9uZSc7IGVsLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnOyBlbC50ZXh0Q29udGVudCA9ICfinJMnOyBlbC50aXRsZSA9IHMubGFiZWw7IH1cbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tY2FuY2VsLWpvYicpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIF9qb2JQYXVzYWJsZSA9IGZhbHNlO1xuICBfam9iUGF1c2VkICAgPSBmYWxzZTtcbiAgX3JlbmRlclBhdXNlVUkoKTtcbiAgaWYgKF9qb2JUaGVybWFsUG9sbFRpbWVyKSB7IGNsZWFySW50ZXJ2YWwoX2pvYlRoZXJtYWxQb2xsVGltZXIpOyBfam9iVGhlcm1hbFBvbGxUaW1lciA9IG51bGw7IH1cbiAgY29uc3QgZ3B1VGVtcCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqb2ItZ3B1LXRlbXAnKTtcbiAgaWYgKGdwdVRlbXApIGdwdVRlbXAuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgX2pvYkFjdGl2ZSA9IGZhbHNlO1xuICBfam9iSGlkZVRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgX2pvYkhpZGVUaW1lciA9IG51bGw7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pvYi1zdGF0dXMnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlYWRlci1zcGFjZXInKS5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnI2J0bi1hbmFseXplLCNidG4tc2NvcmUnKS5mb3JFYWNoKGIgPT4gYi5kaXNhYmxlZCA9IGZhbHNlKTtcbiAgICBjb25zdCBhbmFseXplQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1hbmFseXplJyk7XG4gICAgaWYgKGFuYWx5emVCdG4pIGFuYWx5emVCdG4udGl0bGUgPSAnJztcbiAgICBfc2V0Sm9iQmxvY2tlZEJ1dHRvbnMoZmFsc2UpO1xuICAgIGNvbnN0IHRvdGFsQXBwcm92ZWQgPSAoQXBwU3RhdGUudmlkZW9zIHx8IFtdKS5yZWR1Y2UoKG4sIHYpID0+IG4gKyB2LmFwcHJvdmVkLCAwKTtcbiAgICB3aW5kb3cuX3VwZGF0ZURlbW9CdXR0b24odG90YWxBcHByb3ZlZCk7XG4gICAgaWYgKHdpbmRvdy5fcmVuZGVyQ2xpcEZpbHRlckNvdW50cykgX3JlbmRlckNsaXBGaWx0ZXJDb3VudHMoKTtcbiAgfSwgMjAwMCk7XG59XG5cbi8vIOKUgOKUgCBTU0UgdHJhbnNwb3J0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gTG93LWxldmVsIFNTRSByZWFkZXIgdXNpbmcgZmV0Y2ggKyBSZWFkYWJsZVN0cmVhbSBzbyBub24tMjAwIEhUVFAgcmVzcG9uc2VzXG4vLyBjYW4gYmUgcmVhZCBmb3IgdGhlaXIgZXJyb3IgZGV0YWlsIChFdmVudFNvdXJjZS5vbmVycm9yIGNhbm5vdCBkbyB0aGlzKS5cbi8vXG4vLyBvbkxpbmUobXNnKSAgLSBjYWxsZWQgZm9yIGVhY2ggcGFyc2VkIFNTRSBwYXlsb2FkIGJlZm9yZSBfX0RPTkVfX1xuLy8gb25Eb25lKG1zZykgIC0gY2FsbGVkIHdpdGggdGhlIGZ1bGwgX19ET05FX18gcGF5bG9hZCAoc3RyaW5nIG9yIG9iamVjdClcbi8vIG9uRXJyb3Ioc3RyKSAtIGNhbGxlZCB3aXRoIGEgcGxhaW4tbGFuZ3VhZ2UgbWVzc2FnZSBvbiBIVFRQIGVycm9yIG9yIG5ldHdvcmsgbG9zc1xuLy9cbi8vIG9wdHMgKG9wdGlvbmFsKTogZXh0cmEgZmV0Y2ggaW5pdCwgZS5nLiB7bWV0aG9kOiAnUE9TVCd9IGZvciB0aGUgbW9kZWwtZG93bmxvYWRcbi8vIGVuZHBvaW50cywgd2hpY2ggYXJlIFBPU1Qtb25seSAoYSBHRVQgNDA1cykuIERlZmF1bHRzIHRvIGEgR0VULCBhcyB0aGUgYW5hbHl6ZVxuLy8gYW5kIHNjb3JlIFNTRSBzdHJlYW1zIHVzZS5cbi8vIFJldHVybnMgYSBoYW5kbGUgd2l0aCAuY2xvc2UoKSB0aGF0IGFib3J0cyB0aGUgaW4tZmxpZ2h0IHJlcXVlc3QuXG5mdW5jdGlvbiBfb3BlblNTRSh1cmwsIG9uTGluZSwgb25Eb25lLCBvbkVycm9yLCBvcHRzID0ge30pIHtcbiAgY29uc3QgY3RybCA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgY29uc3QgaGFuZGxlID0ge2Nsb3NlOiAoKSA9PiBjdHJsLmFib3J0KCl9O1xuICBmZXRjaCh1cmwsIHtzaWduYWw6IGN0cmwuc2lnbmFsLCAuLi5vcHRzfSkudGhlbihhc3luYyByZXMgPT4ge1xuICAgIGlmICghcmVzLm9rKSB7XG4gICAgICBjb25zdCBlcnJEYXRhID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcbiAgICAgIG9uRXJyb3IoZm9ybWF0QXBpRXJyb3IoZXJyRGF0YSkgfHwgYFNlcnZlciBlcnJvciAke3Jlcy5zdGF0dXN9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJlYWRlciA9IHJlcy5ib2R5LmdldFJlYWRlcigpO1xuICAgIGNvbnN0IGRlYyA9IG5ldyBUZXh0RGVjb2RlcigpO1xuICAgIGxldCBidWYgPSAnJztcbiAgICB0cnkge1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3Qge2RvbmUsIHZhbHVlfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XG4gICAgICAgIGlmIChkb25lKSB7XG4gICAgICAgICAgaWYgKCFjdHJsLnNpZ25hbC5hYm9ydGVkKSBvbkVycm9yKCdTdHJlYW0gZW5kZWQgd2l0aG91dCBhIGNvbXBsZXRpb24gc2lnbmFsJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGJ1ZiArPSBkZWMuZGVjb2RlKHZhbHVlLCB7c3RyZWFtOiB0cnVlfSk7XG4gICAgICAgIGNvbnN0IGxpbmVzID0gYnVmLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgYnVmID0gbGluZXMucG9wKCk7XG4gICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xuICAgICAgICAgIGlmICghbGluZS5zdGFydHNXaXRoKCdkYXRhOiAnKSkgY29udGludWU7XG4gICAgICAgICAgY29uc3QgbXNnID0gSlNPTi5wYXJzZShsaW5lLnNsaWNlKDYpKTtcbiAgICAgICAgICBjb25zdCBpc0RvbmUgPSBtc2cgPT09ICdfX0RPTkVfXycgfHwgKG1zZyAmJiB0eXBlb2YgbXNnID09PSAnb2JqZWN0JyAmJiBtc2cudHlwZSA9PT0gJ19fRE9ORV9fJyk7XG4gICAgICAgICAgaWYgKGlzRG9uZSkgeyBvbkRvbmUobXNnKTsgcmV0dXJuOyB9XG4gICAgICAgICAgb25MaW5lKG1zZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmICghY3RybC5zaWduYWwuYWJvcnRlZCkgb25FcnJvcignQ29ubmVjdGlvbiBsb3N0IC0gc2VydmVyIGRpc2Nvbm5lY3RlZCcpO1xuICAgIH1cbiAgfSkuY2F0Y2goZXJyID0+IHtcbiAgICBpZiAoIWN0cmwuc2lnbmFsLmFib3J0ZWQpIG9uRXJyb3Iod2luZG93Lm5ldEVyck1zZyhlcnIpKTtcbiAgfSk7XG4gIHJldHVybiBoYW5kbGU7XG59XG5cbi8vIE9ubHkgb25lIGpvYiBzdHJlYW0gaXMgbGl2ZSBhdCBhIHRpbWUuIFN0YXJ0aW5nIGEgbmV3IGpvYiBhYm9ydHMgdGhlIHByZXZpb3VzXG4vLyBvbmUgLSBidXQgYWJvcnRpbmcgc3VwcHJlc3NlcyBpdHMgb25Eb25lL29uRXJyb3IsIHNvIGl0cyBVSSB0ZWFyZG93biAoYnV0dG9uXG4vLyByZS1lbmFibGUsIHByb2dyZXNzIHBpbGwpIHdvdWxkIG5ldmVyIHJ1bi4gRWFjaCBqb2IgcmVnaXN0ZXJzIHRoYXQgdGVhcmRvd24gYXNcbi8vIGEgY2xlYW51cCBzbyBhIHN1cGVyc2VkaW5nIGpvYiBjYW4gcnVuIGl0LiBTZWUgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbS5cbmZ1bmN0aW9uIF9zZXRBY3RpdmVTdHJlYW0oaGFuZGxlLCBjbGVhbnVwID0gbnVsbCkge1xuICBfYWN0aXZlRVMgPSBoYW5kbGU7XG4gIF9hY3RpdmVKb2JDbGVhbnVwID0gY2xlYW51cDtcbn1cblxuZnVuY3Rpb24gX2NsZWFyQWN0aXZlU3RyZWFtKGhhbmRsZSkge1xuICBpZiAoX2FjdGl2ZUVTID09PSBoYW5kbGUpIHsgX2FjdGl2ZUVTID0gbnVsbDsgX2FjdGl2ZUpvYkNsZWFudXAgPSBudWxsOyB9XG59XG5cbmZ1bmN0aW9uIF9zdXBlcnNlZGVBY3RpdmVTdHJlYW0oKSB7XG4gIGlmIChfYWN0aXZlRVMpIHsgX2FjdGl2ZUVTLmNsb3NlKCk7IF9hY3RpdmVFUyA9IG51bGw7IH1cbiAgaWYgKF9hY3RpdmVKb2JDbGVhbnVwKSB7IGNvbnN0IGNsZWFudXAgPSBfYWN0aXZlSm9iQ2xlYW51cDsgX2FjdGl2ZUpvYkNsZWFudXAgPSBudWxsOyBjbGVhbnVwKCk7IH1cbn1cblxuLy8gR3VhcmQgZm9yIGNvbXBldGluZyBTU0Ugam9icyAocmUtc2NvcmUsIHRpbWVsaW5lLCBzdW1tYXJ5LCBkaWFyaXplLCDigKYpLiBXaGlsZVxuLy8gYW4gYW5hbHlzaXMgaXMgcnVubmluZyB0aGUgYmFja2VuZCA0MDlzIHRoZXNlIGFueXdheSwgYnV0IHRoZXkgY2FsbFxuLy8gX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpIGZpcnN0LCB3aGljaCB3b3VsZCB0ZWFyIGRvd24gdGhlIGxpdmUgYW5hbHl6ZSBwcm9ncmVzc1xuLy8gVUkgYmVmb3JlIHRoZSByZWplY3Rpb24gbGFuZHMuIFJldHVybnMgdHJ1ZSAoYW5kIHRvYXN0cykgc28gdGhlIGNhbGxlciBjYW4gYmFpbFxuLy8gYmVmb3JlIGFueSBzaWRlIGVmZmVjdHMuXG5mdW5jdGlvbiBfYmxvY2tlZEJ5QW5hbHl6ZShhY3Rpb25MYWJlbCkge1xuICBpZiAoIUFwcFN0YXRlLmFuYWx5emVGaWxlbmFtZSkgcmV0dXJuIGZhbHNlO1xuICB3aW5kb3cuc2hvd1RvYXN0KGBXYWl0IGZvciB0aGUgY3VycmVudCBhbmFseXNpcyB0byBmaW5pc2ggYmVmb3JlIHlvdSAke2FjdGlvbkxhYmVsfS5gLCAnd2FybmluZycpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuLy8gb25MaW5lIChvcHRpb25hbCk6IGNhbGxlZCB3aXRoIGVhY2ggcmF3IFNTRSBwYXlsb2FkIGxpbmUgYmVmb3JlIF9fRE9ORV9fLCBmb3Jcbi8vIGNhbGxlcnMgdGhhdCBuZWVkIGxpdmUgcHJvZ3Jlc3MgdGV4dCAoZS5nLiB0aGUgcHJveHktYnVpbGQgcGVyY2VudGFnZSkuXG4vLyBvcHRzIChvcHRpb25hbCk6IGZldGNoIGluaXQgcGFzc2VkIHRocm91Z2ggdG8gX29wZW5TU0UsIGUuZy4ge21ldGhvZDogJ1BPU1QnfVxuLy8gZm9yIGEgUE9TVC1vbmx5IFNTRSBlbmRwb2ludCAoYW5hbHl6ZS1mcmFtZXMpLlxuLy8gb25FcnJvciAob3B0aW9uYWwpOiBjYWxsZWQgYWZ0ZXIgdGhlIGJ1aWx0LWluIGVycm9yIGhhbmRsaW5nICh0b2FzdCArIGVuZEpvYlVJKVxuLy8gc28gYSBjYWxsZXIgY2FuIHJ1biBpdHMgb3duIHRlcm1pbmFsIGNsZWFudXAgb24gYW4gSFRUUC90cmFuc3BvcnQgZmFpbHVyZSAtIGUuZy5cbi8vIGNsZWFyaW5nIGEgcGVyLWl0ZW0gaW4tZmxpZ2h0IGZsYWcgdGhhdCBvbmx5IGl0cyBvbkRvbmUgd291bGQgb3RoZXJ3aXNlIGNsZWFyLlxuZnVuY3Rpb24gc3RyZWFtU1NFKHVybCwgb25Eb25lLCBzdGVwRGVmcywgam9iTGFiZWwsIGNhbmNlbGxhYmxlID0gZmFsc2UsIG9uTGluZSA9IG51bGwsIHBhdXNhYmxlID0gZmFsc2UsIG9wdHMgPSB7fSwgb25FcnJvciA9IG51bGwpIHtcbiAgX3N1cGVyc2VkZUFjdGl2ZVN0cmVhbSgpO1xuICBpZiAoc3RlcERlZnMpIHN0YXJ0Sm9iVUkoc3RlcERlZnMsIGpvYkxhYmVsLCBjYW5jZWxsYWJsZSwgcGF1c2FibGUpO1xuICBjb25zdCBoYW5kbGUgPSBfb3BlblNTRShcbiAgICB1cmwsXG4gICAgdGV4dCA9PiB7XG4gICAgICAvLyBBIEBAUFJPR1JFU1MgbWFya2VyIGRyaXZlcyB0aGUgcGlsbHMgZGV0ZXJtaW5pc3RpY2FsbHkgYW5kIGlzIE5PVCBzaG93biBhc1xuICAgICAgLy8gYSBsb2cgbGluZTsgZXZlcnl0aGluZyBlbHNlIGZhbGxzIHRocm91Z2ggdG8gdGhlIGxvZyArIHByb3NlIGZhbGxiYWNrLlxuICAgICAgY29uc3QgbWFya2VyID0gc3RlcERlZnMgPyBwYXJzZVByb2dyZXNzKHRleHQpIDogbnVsbDtcbiAgICAgIGlmIChtYXJrZXIpIHsgX2RyaXZlU3RlcEZyb21NYXJrZXIobWFya2VyKTsgcmV0dXJuOyB9XG4gICAgICB3aW5kb3cuYXBwZW5kTG9nKHRleHQpOyBpZiAob25MaW5lKSBvbkxpbmUodGV4dCk7IGlmIChzdGVwRGVmcykgdXBkYXRlSm9iVUkodGV4dCk7XG4gICAgfSxcbiAgICAoKSA9PiB7XG4gICAgICBfY2xlYXJBY3RpdmVTdHJlYW0oaGFuZGxlKTtcbiAgICAgIGlmIChzdGVwRGVmcykgZW5kSm9iVUkoKTtcbiAgICAgIGlmIChvbkRvbmUpIG9uRG9uZSgpO1xuICAgIH0sXG4gICAgZXJyTXNnID0+IHtcbiAgICAgIF9jbGVhckFjdGl2ZVN0cmVhbShoYW5kbGUpO1xuICAgICAgd2luZG93LmFwcGVuZExvZyhgWyR7ZXJyTXNnfV1gKTtcbiAgICAgIHdpbmRvdy5zaG93VG9hc3QoZXJyTXNnLCAnZXJyb3InKTtcbiAgICAgIHdpbmRvdy5Tb3VuZEZ4LnBsYXkoJ2Vycm9yJyk7XG4gICAgICBpZiAoc3RlcERlZnMpIGVuZEpvYlVJKCk7XG4gICAgICBpZiAob25FcnJvcikgb25FcnJvcihlcnJNc2cpO1xuICAgICAgd2luZG93LmxvYWRWaWRlb3MoKTtcbiAgICB9LFxuICAgIG9wdHMsXG4gICk7XG4gIF9zZXRBY3RpdmVTdHJlYW0oaGFuZGxlLCBzdGVwRGVmcyA/IGVuZEpvYlVJIDogbnVsbCk7XG59XG5cbi8vIFBvbGxlZCBieSB0aGUgSlMgc2VxdWVudGlhbC1zZWdtZW50IHJ1bm5lcnMgKGFuYWx5emUuanMncyBwcmUtc3BsaXQgbG9vcCxcbi8vIHNwbGl0LmpzJ3MgcmUtc3BsaXQgbG9vcCkgYmVmb3JlIGZpcmluZyBvZmYgZWFjaCBzZWdtZW50J3Mgb3duIGFuYWx5emUgam9iLlxuLy8gRWFjaCBzZWdtZW50IGlzIGEgc2VwYXJhdGUgQW5hbHl6ZUpvYiwgc28gdGhlcmUgaXMgYSBnYXAgYmV0d2VlbiBzZWdtZW50c1xuLy8gd2l0aCBubyBcInJ1bm5pbmdcIiBqb2IgZm9yIC9hcGkvc3RhdHVzJ3MgYW5hbHl6ZV9wYXVzZWQgdG8ga2V5IG9mZiAtIHRoaXNcbi8vIGNoZWNrcyB0aGUgcmF3IHBhdXNlIGZsYWcgZmlsZSBpbnN0ZWFkIChwYXVzZV9mbGFnX3NldCkuXG5hc3luYyBmdW5jdGlvbiBfd2FpdFdoaWxlQW5hbHl6ZVBhdXNlZCgpIHtcbiAgbGV0IHRvYXN0ZWQgPSBmYWxzZTtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjb25zdCBzdGF0dXMgPSBhd2FpdCBmZXRjaCgnL2FwaS9zdGF0dXMnKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgIGlmICghc3RhdHVzIHx8ICFzdGF0dXMucGF1c2VfZmxhZ19zZXQpIHJldHVybjtcbiAgICBpZiAoIXRvYXN0ZWQpIHsgd2luZG93LnNob3dUb2FzdCgnUGF1c2VkIC0gd2lsbCBob2xkIGJlZm9yZSB0aGUgbmV4dCBzZWdtZW50JywgJ2luZm8nKTsgdG9hc3RlZCA9IHRydWU7IH1cbiAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMzAwMCkpO1xuICB9XG59XG5cbi8vIOKUgOKUgCBqb2IgY2FuY2VsbGF0aW9uIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVGhlIGpvYi1oZWFkZXIgQ2FuY2VsIGJ1dHRvbiBzZXJ2ZXMgd2hpY2hldmVyIGNhbmNlbGxhYmxlIGpvYiBpcyBydW5uaW5nLiBFYWNoXG4vLyBjYW5jZWxsYWJsZSBmbG93IHNldHMgX2FjdGl2ZUNhbmNlbCAodmlhIHNldEpvYkNhbmNlbCkgc28gdGhlIGNvbmZpcm0gY29weSBhbmRcbi8vIHRoZSBjYW5jZWwgZW5kcG9pbnQgbWF0Y2ggdGhlIGpvYjsgc3RhcnRKb2JVSSByZXNldHMgaXQgdG8gdGhlIGFuYWx5emUgZGVmYXVsdC5cbmNvbnN0IF9BTkFMWVpFX0NBTkNFTCA9IHtcbiAgdXJsOiAgICAgICcvYXBpL2FuYWx5emUvY2FuY2VsJyxcbiAgdGl0bGU6ICAgICdDYW5jZWwgYW5hbHlzaXM/JyxcbiAgYm9keTogICAgICdBbGwgcHJvZ3Jlc3MgZm9yIHRoaXMgcmVjb3JkaW5nIHdpbGwgYmUgbG9zdCBhbmQgeW91IHdpbGwgbmVlZCB0byBhbmFseXplIGl0IGFnYWluLicsXG4gIGNvbmZpcm06ICAnQ2FuY2VsIEFuYWx5c2lzJyxcbiAgbG9nTXNnOiAgICdbQW5hbHlzaXMgY2FuY2VsbGVkXScsXG59O1xubGV0IF9hY3RpdmVDYW5jZWwgPSBfQU5BTFlaRV9DQU5DRUw7XG5cbmZ1bmN0aW9uIHNldEpvYkNhbmNlbChjZmcpIHsgX2FjdGl2ZUNhbmNlbCA9IGNmZyB8fCBfQU5BTFlaRV9DQU5DRUw7IH1cblxuZnVuY3Rpb24gY2FuY2VsSm9iKCkge1xuICB3aW5kb3cuc2hvd0NvbmZpcm0oXG4gICAgX2FjdGl2ZUNhbmNlbC50aXRsZSxcbiAgICBfYWN0aXZlQ2FuY2VsLmJvZHksXG4gICAgX2FjdGl2ZUNhbmNlbC5jb25maXJtLFxuICAgIF9kb0NhbmNlbEpvYixcbiAgICB0cnVlLFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBfZG9DYW5jZWxKb2IoKSB7XG4gIGNvbnN0IGNhbmNlbCA9IF9hY3RpdmVDYW5jZWw7XG4gIC8vIENhbmNlbCBvbiB0aGUgc2VydmVyIEZJUlNUIC0gaWYgaXQgZmFpbHMsIHRoZSBqb2IgaXMgc3RpbGwgcnVubmluZywgc29cbiAgLy8ga2VlcCB0aGUgc3RyZWFtIGF0dGFjaGVkIGFuZCB0aGUgam9iIFVJIHVwIGluc3RlYWQgb2YgcHJldGVuZGluZyBpdCBzdG9wcGVkLlxuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGNhbmNlbC51cmwsIHttZXRob2Q6ICdQT1NUJ30pO1xuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciBlcnJvciAke3Jlcy5zdGF0dXN9YCk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIHdpbmRvdy5zaG93VG9hc3QoYENvdWxkIG5vdCBjYW5jZWwgLSAke2Vyci5tZXNzYWdlfWAsICdlcnJvcicpO1xuICAgIHJldHVybjtcbiAgfVxuICBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtKCk7XG4gIHdpbmRvdy5hcHBlbmRMb2coY2FuY2VsLmxvZ01zZyk7XG4gIGVuZEpvYlVJKCk7XG4gIC8vIEEgam9iLXNwZWNpZmljIHRlcm1pbmFsIGNsZWFudXAgKGUuZy4gY2xlYXJpbmcgYSBwZXItY2xpcCBpbi1mbGlnaHQgZmxhZyBzb1xuICAvLyBpdHMgYnV0dG9uIGxlYXZlcyB0aGUgc3Bpbm5lcikgLSB0aGUgZ2VuZXJpYyBhbmFseXplIGNhbmNlbCBzZXRzIG5vbmUuXG4gIGlmIChjYW5jZWwub25DYW5jZWwpIGNhbmNlbC5vbkNhbmNlbCgpO1xuICAvLyBDbGVhciB0aGUgYW5hbHl6aW5nIG1hcmtlciBzbyBsb2FkVmlkZW9zKCkgZHJvcHMgdGhlIHNpZGViYXIgcGxhY2Vob2xkZXIgL1xuICAvLyBzcGlubmVyLiBMZWZ0IHNldCwgYSBjYW5jZWxsZWQgcnVuIHdob3NlIERCIHJvdyBuZXZlciBtYXRlcmlhbGlzZWQgd291bGRcbiAgLy8ga2VlcCBhbiB1bmNsaWNrYWJsZSBcIkFuYWx5emluZ+KAplwiIHBsYWNlaG9sZGVyIHVudGlsIGEgbWFudWFsIHBhZ2UgcmVmcmVzaC5cbiAgQXBwU3RhdGUuYW5hbHl6ZUZpbGVuYW1lID0gbnVsbDtcbiAgd2luZG93LmxvYWRWaWRlb3MoKTtcbn1cblxuZXhwb3J0IHtcbiAgSU5HRVNUX1NURVBTLCBTQ09SRV9TVEVQUywgRlJBTUVTX1NURVBTLCBKT0JfU1RBR0VTLCBwYXJzZVByb2dyZXNzLCBfZHJpdmVTdGVwRnJvbU1hcmtlcixcbiAgc3RhcnRKb2JVSSwgdXBkYXRlSm9iVUksIGVuZEpvYlVJLCBhcHBseUpvYkJsb2NrZWRTdGF0ZSwgX3N0ZXBQaWxsTGFiZWwsIF9yZW5kZXJTdGVwUGlsbCwgX3RpY2tKb2JUaW1lcixcbiAgX3NldFBhdXNlZFVJRnJvbVN0YXR1cywgdG9nZ2xlUGF1c2VKb2IsIF9wb2xsVGhlcm1hbFN0YXR1cyxcbiAgX29wZW5TU0UsIHN0cmVhbVNTRSwgX3NldEFjdGl2ZVN0cmVhbSwgX2NsZWFyQWN0aXZlU3RyZWFtLCBfc3VwZXJzZWRlQWN0aXZlU3RyZWFtLFxuICBfYmxvY2tlZEJ5QW5hbHl6ZSwgX3dhaXRXaGlsZUFuYWx5emVQYXVzZWQsXG4gIHNldEpvYkNhbmNlbCwgY2FuY2VsSm9iLFxufTtcblxuLy8gVGhlIGpvYiBoZWFkZXIncyBQYXVzZS9DYW5jZWwgYnV0dG9ucyBhcmUgc3RhdGljIG1hcmt1cCBpbiBpbmRleC5odG1sIChuZXZlclxuLy8gcmUtcmVuZGVyZWQpLCBzbyBhIHNpbmdsZSBsaXN0ZW5lciB3aXJlZCBvbmNlIGF0IG1vZHVsZSBsb2FkIC0gcmVwbGFjaW5nIHRoZVxuLy8gb25jbGljaz1cInRvZ2dsZVBhdXNlSm9iKClcIi9cImNhbmNlbEpvYigpXCIgYXR0cmlidXRlcyB0aGF0IHVzZWQgdG8gbGl2ZSB0aGVyZSAtXG4vLyBjYW4gbmV2ZXIgZG91YmxlLXdpcmUuICh2aWRlb3MuanMncyBpbi1kZXRhaWwgQ2FuY2VsIGJ1dHRvbiBzdGlsbCB1c2VzIGl0cyBvd25cbi8vIGlubGluZSBvbmNsaWNrPVwiY2FuY2VsSm9iKClcIjsgdGhhdCBtYXJrdXAgbGl2ZXMgaW4gdmlkZW9zLmpzLCBvdXQgb2Ygc2NvcGUgaGVyZS4pXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLXBhdXNlLWpvYicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdG9nZ2xlUGF1c2VKb2IpO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jYW5jZWwtam9iJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBjYW5jZWxKb2IpO1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gUmVjb3JkaW5nIHByZXZpZXcgcGxheWVyOiBwaWNrcyB0aGUgbWVkaWEgdHJhbnNwb3J0IChFbGVjdHJvbiBuYXRpdmUgc2NoZW1lIHZzIEhUVFApLFxuLy8gICBwcmVmZXJzIHRoZSBmYXN0IDcyMHAgcHJveHkgb3ZlciB0aGUgc291cmNlLCBhbmQgZHJpdmVzIHRoZSBjbGljay10by1idWlsZCBwcm94eSBiYWRnZS5cbi8vICAgQVBJOiByb3V0ZXMvdmlkZW9zLnB5IChzb3VyY2UvcHJveHkvcHJveHktc3RhdHVzL3Byb3h5LWdlbmVyYXRlKSDCtyBUZXN0czogdGVzdHMvdWkvdGVzdF91aV92aWRlby5weVxuLy8gU2luZ2xlIHBvaW50IHRoYXQgcGlja3MgdGhlIHRyYW5zcG9ydCBmb3IgYSByZWNvcmRpbmcncyBzb3VyY2UvcHJveHkgc3RyZWFtXG4vLyAocm9hZG1hcCBwbGFuIDEwKS4gSW5zaWRlIHRoZSBwYWNrYWdlZCBFbGVjdHJvbiBhcHAsIHdpbmRvdy5lbGVjdHJvbkFQSS5tZWRpYVByb3RvY29sXG4vLyBpcyBzZXQgYW5kIHBsYXliYWNrIGdvZXMgc3RyYWlnaHQgdGhyb3VnaCB0aGUgbmF0aXZlIFwieXV1LW1lZGlhOi8vXCIgc2NoZW1lIC1cbi8vIGJ5cGFzc2luZyB0aGUgUHl0aG9uIGJ5dGUtcHVtcCAtIGluc3RlYWQgb2YgdGhlIEhUVFAgcm91dGUuIFBsYWluIGJyb3dzZXItZGV2XG4vLyBtb2RlIG5ldmVyIGhhcyBlbGVjdHJvbkFQSSwgc28gaXQgYWx3YXlzIGdldHMgdGhlIHVuY2hhbmdlZCBIVFRQIFVSTC4gYWJzUGF0aFxuLy8gbWF5IGJlIG51bGwgKGUuZy4gYSBwcm94eSB0aGF0IGhhc24ndCBiZWVuIGdlbmVyYXRlZC9sb29rZWQgdXAgeWV0KSwgd2hpY2hcbi8vIHNpbXBseSBmYWxscyBiYWNrIHRvIEhUVFAgZm9yIHRoYXQgb25lIHJlcXVlc3QuXG5pbXBvcnQgeyBzdHJlYW1TU0UgfSBmcm9tICcuL2pvYnMuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gX2J1aWxkTWVkaWFVcmwodmlkZW9JZCwga2luZCwgYWJzUGF0aCkge1xuICBpZiAod2luZG93LmVsZWN0cm9uQVBJPy5tZWRpYVByb3RvY29sICYmIGFic1BhdGgpIHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gYWJzUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgcmV0dXJuIGB5dXUtbWVkaWE6Ly9tZWRpYS8ke2VuY29kZVVSSUNvbXBvbmVudChub3JtYWxpemVkKX1gO1xuICB9XG4gIHJldHVybiBgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS8ke2tpbmR9YDtcbn1cblxuLy8g4pSA4pSAIHJlY29yZGluZyBwcmV2aWV3IHF1YWxpdHkgKDcyMHAgcHJveHkgKyBiYWRnZSkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBTaGFyZWQgYnkgZXZlcnkgZnVsbC1yZWNvcmRpbmcgPHZpZGVvPiAocmVjb3JkaW5nIGRldGFpbCBwbGF5ZXIsIHNwbGl0IGVkaXRvcilcbi8vIHNvIHRoZSBjcmVhdG9yIGFsd2F5cyBrbm93cyB3aGV0aGVyIHRoZXkncmUgc2VlaW5nIHRoZSBmYXN0IDcyMHAgcHJveHkgb3IgdGhlXG4vLyBmdWxsLXF1YWxpdHkgb3JpZ2luYWwuIFByZWZlcnMgdGhlIHByb3h5IHdoZW4gb25lIGV4aXN0czsgb3RoZXJ3aXNlIHBsYXlzIHRoZVxuLy8gc291cmNlIGFuZCBlaXRoZXIgYnVpbGRzIGEgcHJveHkgb24gZGVtYW5kIChhdXRvQnVpbGQpIG9yIGludml0ZXMgdGhlIHVzZXIgdG8uXG4vL1xuLy8gICB2aWRlb0VsIC8gYmFkZ2VFbCA6IHRoZSA8dmlkZW8+IGFuZCBpdHMgb3ZlcmxheSBiYWRnZSAoY2FsbGVyIG93bnMgbGF5b3V0KVxuLy8gICBhdXRvQnVpbGQgICAgICAgICA6IGJ1aWxkIGltbWVkaWF0ZWx5IHdoZW4gbm8gcHJveHkgZXhpc3RzIChkZWxpYmVyYXRlXG4vLyAgICAgICAgICAgICAgICAgICAgICAgc2NydWJiaW5nIHN1cmZhY2VzKSwgZWxzZSB0aGUgYmFkZ2Ugb2ZmZXJzIGEgY2xpY2stdG8tYnVpbGRcbi8vICAgaXNDdXJyZW50ICAgICAgICAgOiBndWFyZCBzbyBhIGxhdGUgc3dhcCBuZXZlciBsYW5kcyBvbiBhIHNpbmNlLWNoYW5nZWQgdmlld1xuLy8gICBzdGFydFMgLyBlbmRTICAgICA6IGEgc3BsaXQgc2VnbWVudCdzIHBsYXllciBzdHJlYW1zIHRoZSBmdWxsIHVudHJpbW1lZCBwYXJlbnRcbi8vICAgICAgICAgICAgICAgICAgICAgICBmaWxlIChzb3VyY2UgYW5kIHByb3h5IGFyZSBib3RoIGtleWVkIGJ5IHRoZSBwYXJlbnQgcGF0aCkgLVxuLy8gICAgICAgICAgICAgICAgICAgICAgIHRoZXNlIGJvdW5kIHBsYXliYWNrIHRvIHRoZSBzZWdtZW50J3Mgb3duIHNsaWNlIG9mIGl0XG4vLyAgIHNvdXJjZVBhdGggICAgICAgIDogdGhlIHJlY29yZGluZydzIGFic29sdXRlIHBhdGggKHZpZGVvLnNvdXJjZV9wYXRoIGZyb20gdGhlXG4vLyAgICAgICAgICAgICAgICAgICAgICAgYWxyZWFkeS1mZXRjaGVkIHZpZGVvIHJlY29yZCkgLSBvbmx5IHVzZWQgdG8gYnVpbGQgdGhlXG4vLyAgICAgICAgICAgICAgICAgICAgICAgRWxlY3Ryb24gbmF0aXZlLXByb3RvY29sIFVSTDsgaWdub3JlZCBpbiBicm93c2VyLWRldiBtb2RlXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBSZWNvcmRpbmdQcmV2aWV3KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIHsgYXV0b0J1aWxkID0gZmFsc2UsIGlzQ3VycmVudCA9ICgpID0+IHRydWUsIHN0YXJ0UyA9IG51bGwsIGVuZFMgPSBudWxsLCBzb3VyY2VQYXRoID0gbnVsbCB9ID0ge30pIHtcbiAgdmlkZW9FbC5zcmMgPSBfYnVpbGRNZWRpYVVybCh2aWRlb0lkLCAnc291cmNlJywgc291cmNlUGF0aCk7XG4gIGlmIChzdGFydFMgIT0gbnVsbCkge1xuICAgIHZpZGVvRWwuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiB7IHRyeSB7IHZpZGVvRWwuY3VycmVudFRpbWUgPSBzdGFydFM7IH0gY2F0Y2ggKF8pIHt9IH0sIHsgb25jZTogdHJ1ZSB9KTtcbiAgfVxuICBpZiAoZW5kUyAhPSBudWxsKSB7XG4gICAgdmlkZW9FbC5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgKCkgPT4geyBpZiAodmlkZW9FbC5jdXJyZW50VGltZSA+PSBlbmRTKSB2aWRlb0VsLnBhdXNlKCk7IH0pO1xuICB9XG4gIGNvbnN0IGJ1aWxkRm4gPSAoKSA9PiBfYnVpbGRSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0Uyk7XG4gIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ29yaWdpbmFsJywgbnVsbCwgYXV0b0J1aWxkID8gbnVsbCA6IGJ1aWxkRm4pO1xuICBmZXRjaChgL2FwaS92aWRlb3MvJHt2aWRlb0lkfS9wcm94eS1zdGF0dXNgKVxuICAgIC50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogbnVsbClcbiAgICAudGhlbihzdGF0dXMgPT4ge1xuICAgICAgaWYgKCFpc0N1cnJlbnQoKSB8fCAhc3RhdHVzKSByZXR1cm47XG4gICAgICBpZiAoc3RhdHVzLmF2YWlsYWJsZSkgX3VzZVJlY29yZGluZ1Byb3h5KHZpZGVvRWwsIGJhZGdlRWwsIHZpZGVvSWQsIGlzQ3VycmVudCwgc3RhcnRTLCBzdGF0dXMucHJveHlfcGF0aCk7XG4gICAgICBlbHNlIGlmIChhdXRvQnVpbGQgfHwgc3RhdHVzLmdlbmVyYXRpbmcpIGJ1aWxkRm4oKTtcbiAgICB9KVxuICAgIC5jYXRjaCgoKSA9PiB7IC8qIGxlYXZlIHRoZSBzb3VyY2UgcGxheWluZyB3aXRoIHRoZSBvcmlnaW5hbC1xdWFsaXR5IGJhZGdlICovIH0pO1xufVxuXG4vLyBzdGFydFM6IGZhbGxzIGJhY2sgdG8gaXQgd2hlbiBjdXJyZW50VGltZSBpcyBzdGlsbCAwIC0gdGhlIHByb3h5LXN0YXR1cyBmZXRjaFxuLy8gY2FuIHJlc29sdmUgYmVmb3JlIHRoZSBzb3VyY2UncyBsb2FkZWRtZXRhZGF0YSBzZWVrIChzZXR1cFJlY29yZGluZ1ByZXZpZXcpIHJ1bnMsXG4vLyB3aGljaCB3b3VsZCBvdGhlcndpc2UgcmVzdW1lIGEgc2VnbWVudCdzIHByb3h5IGF0IHRoZSBwYXJlbnQncyB0PTAuXG5mdW5jdGlvbiBfdXNlUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMgPSBudWxsLCBwcm94eVBhdGggPSBudWxsKSB7XG4gIGlmICghaXNDdXJyZW50KCkpIHJldHVybjtcbiAgY29uc3QgcmVzdW1lQXQgICA9IHZpZGVvRWwuY3VycmVudFRpbWUgfHwgc3RhcnRTIHx8IDA7XG4gIGNvbnN0IHdhc1BsYXlpbmcgPSAhdmlkZW9FbC5wYXVzZWQgJiYgIXZpZGVvRWwuZW5kZWQ7XG4gIHZpZGVvRWwuc3JjID0gX2J1aWxkTWVkaWFVcmwodmlkZW9JZCwgJ3Byb3h5JywgcHJveHlQYXRoKTtcbiAgdmlkZW9FbC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsICgpID0+IHtcbiAgICB0cnkgeyB2aWRlb0VsLmN1cnJlbnRUaW1lID0gcmVzdW1lQXQ7IH0gY2F0Y2ggKF8pIHt9XG4gICAgaWYgKHdhc1BsYXlpbmcpIHZpZGVvRWwucGxheSgpLmNhdGNoKCgpID0+IHt9KTtcbiAgfSwgeyBvbmNlOiB0cnVlIH0pO1xuICBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdwcm94eScpO1xufVxuXG5mdW5jdGlvbiBfYnVpbGRSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0UyA9IG51bGwpIHtcbiAgaWYgKCFpc0N1cnJlbnQoKSkgcmV0dXJuO1xuICBfc2V0UHJldmlld0JhZGdlKGJhZGdlRWwsICdidWlsZGluZycpO1xuICBzdHJlYW1TU0UoXG4gICAgYC9hcGkvdmlkZW9zLyR7dmlkZW9JZH0vcHJveHkvZ2VuZXJhdGVgLFxuICAgIGFzeW5jICgpID0+IHtcbiAgICAgIGlmICghaXNDdXJyZW50KCkpIHJldHVybjtcbiAgICAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IGZldGNoKGAvYXBpL3ZpZGVvcy8ke3ZpZGVvSWR9L3Byb3h5LXN0YXR1c2ApXG4gICAgICAgIC50aGVuKHIgPT4gci5vayA/IHIuanNvbigpIDogbnVsbCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICBpZiAoIWlzQ3VycmVudCgpKSByZXR1cm47XG4gICAgICBpZiAoc3RhdHVzPy5hdmFpbGFibGUpIF91c2VSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0Uywgc3RhdHVzLnByb3h5X3BhdGgpO1xuICAgICAgLy8gQW5vdGhlciBvcGVuIGlzIHN0aWxsIGVuY29kaW5nIC0gcG9sbCB1bnRpbCBpdHMgcHJveHkgbGFuZHMuXG4gICAgICBlbHNlIGlmIChzdGF0dXM/LmdlbmVyYXRpbmcpIHNldFRpbWVvdXQoKCkgPT4gX2J1aWxkUmVjb3JkaW5nUHJveHkodmlkZW9FbCwgYmFkZ2VFbCwgdmlkZW9JZCwgaXNDdXJyZW50LCBzdGFydFMpLCA1MDAwKTtcbiAgICAgIGVsc2UgX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCAnb3JpZ2luYWwnLCBudWxsLCAoKSA9PiBfYnVpbGRSZWNvcmRpbmdQcm94eSh2aWRlb0VsLCBiYWRnZUVsLCB2aWRlb0lkLCBpc0N1cnJlbnQsIHN0YXJ0UykpO1xuICAgIH0sXG4gICAgbnVsbCwgICAgICAgIC8vIG5vIGdsb2JhbCBqb2IgcGlsbCAtIHRoaXMgaXMgYSBiYWNrZ3JvdW5kIGNvbnZlbmllbmNlXG4gICAgJ1ByZXZpZXcnLFxuICAgIGZhbHNlLFxuICAgIGxpbmUgPT4geyAgICAvLyBvbkxpbmU6IHN1cmZhY2UgdGhlIGVuY29kZSBwZXJjZW50YWdlIG9uIHRoZSBiYWRnZVxuICAgICAgY29uc3QgbSA9IC8oXFxkKyklLy5leGVjKGxpbmUpO1xuICAgICAgaWYgKG0gJiYgaXNDdXJyZW50KCkpIF9zZXRQcmV2aWV3QmFkZ2UoYmFkZ2VFbCwgJ2J1aWxkaW5nJywgbVsxXSk7XG4gICAgfSxcbiAgKTtcbn1cblxuZnVuY3Rpb24gX3NldFByZXZpZXdCYWRnZShiYWRnZUVsLCBtb2RlLCBwY3QsIG9uQnVpbGQpIHtcbiAgaWYgKCFiYWRnZUVsKSByZXR1cm47XG4gIC8vIFJlc2V0IHRvIGEgbm9uLWludGVyYWN0aXZlIHN0YXR1cyBpbmRpY2F0b3I7IHRoZSBidWlsZCBhZmZvcmRhbmNlIGJlbG93XG4gIC8vIHJlLWFybXMgaXQgYXMgYSBidXR0b24gc28gcm9sZS90YWJpbmRleCBuZXZlciBnbyBzdGFsZSBiZXR3ZWVuIHN0YXRlcy5cbiAgYmFkZ2VFbC5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gIGJhZGdlRWwub25jbGljayA9IG51bGw7XG4gIGJhZGdlRWwub25rZXlkb3duID0gbnVsbDtcbiAgYmFkZ2VFbC5zdHlsZS5jdXJzb3IgPSAnJztcbiAgYmFkZ2VFbC5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xuICBiYWRnZUVsLnJlbW92ZUF0dHJpYnV0ZSgndGFiaW5kZXgnKTtcbiAgYmFkZ2VFbC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnc3RhdHVzJyk7XG4gIGJhZGdlRWwuY2xhc3NMaXN0LnRvZ2dsZSgncHJldmlldy1iYWRnZS1wcm94eScsIG1vZGUgPT09ICdwcm94eScpO1xuICBiYWRnZUVsLmNsYXNzTGlzdC5yZW1vdmUoJ3ByZXZpZXctYmFkZ2UtYnVpbGQnKTtcbiAgaWYgKG1vZGUgPT09ICdwcm94eScpIHtcbiAgICBiYWRnZUVsLnRleHRDb250ZW50ID0gJ1ByZXZpZXcgcXVhbGl0eSAoNzIwcCknO1xuICAgIGJhZGdlRWwudGl0bGUgPSAnUGxheWluZyBhIGRvd25zY2FsZWQgNzIwcCBwcmV2aWV3IGZvciBmYXN0IHNlZWtpbmcgLSBub3QgZnVsbCBxdWFsaXR5LiBFeHBvcnRzIHVzZSB0aGUgb3JpZ2luYWwuJztcbiAgfSBlbHNlIGlmIChtb2RlID09PSAnYnVpbGRpbmcnKSB7XG4gICAgYmFkZ2VFbC50ZXh0Q29udGVudCA9IHBjdCA/IGBCdWlsZGluZyA3MjBwIHByZXZpZXfigKYgJHtwY3R9JWAgOiAnQnVpbGRpbmcgNzIwcCBwcmV2aWV34oCmJztcbiAgICBiYWRnZUVsLnRpdGxlID0gJ0VuY29kaW5nIGEgZmFzdC1zZWVraW5nIDcyMHAgcHJldmlldyBmcm9tIHRoZSBzb3VyY2UgcmVjb3JkaW5nLic7XG4gIH0gZWxzZSBpZiAob25CdWlsZCkge1xuICAgIC8vIFJlbmRlciB0aGUgYWN0aW9uIGFzIGEgYnV0dG9uLXN0eWxlZCBwaWxsIHNvIGl0IG9idmlvdXNseSBpbnZpdGVzIGEgY2xpY2suXG4gICAgYmFkZ2VFbC5jbGFzc0xpc3QuYWRkKCdwcmV2aWV3LWJhZGdlLWJ1aWxkJyk7XG4gICAgYmFkZ2VFbC5pbm5lckhUTUwgPSAnT3JpZ2luYWwgcXVhbGl0eSDCtyA8c3BhbiBjbGFzcz1cInByZXZpZXctYmFkZ2UtYWN0aW9uXCI+JiM5ODg5OyBCdWlsZCA3MjBwIHByZXZpZXc8L3NwYW4+JztcbiAgICBiYWRnZUVsLnRpdGxlID0gJ1BsYXlpbmcgdGhlIGZ1bGwtcXVhbGl0eSBvcmlnaW5hbC4gQnVpbGQgYSA3MjBwIHByZXZpZXcgc28gc2Vla2luZyBpcyBmYXN0Lic7XG4gICAgYmFkZ2VFbC5zdHlsZS5jdXJzb3IgPSAncG9pbnRlcic7XG4gICAgYmFkZ2VFbC5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ2F1dG8nO1xuICAgIGJhZGdlRWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuICAgIGJhZGdlRWwudGFiSW5kZXggPSAwO1xuICAgIGJhZGdlRWwub25jbGljayA9IG9uQnVpbGQ7XG4gICAgYmFkZ2VFbC5vbmtleWRvd24gPSAoZSkgPT4geyBpZiAoZS5rZXkgPT09ICdFbnRlcicgfHwgZS5rZXkgPT09ICcgJykgeyBlLnByZXZlbnREZWZhdWx0KCk7IG9uQnVpbGQoKTsgfSB9O1xuICB9IGVsc2Uge1xuICAgIGJhZGdlRWwudGV4dENvbnRlbnQgPSAnT3JpZ2luYWwgcXVhbGl0eSDCtyBzbG93ZXIgc2Vla2luZyc7XG4gICAgYmFkZ2VFbC50aXRsZSA9ICdQbGF5aW5nIHRoZSBvcmlnaW5hbCByZWNvcmRpbmcgLSBzZWVraW5nIGEgbG9uZyBmaWxlIGNhbiBiZSBzbG93Lic7XG4gIH1cbn1cbiIsICIvLyBGZWF0dXJlLW1hcCAtIENyb3NzLWN1dHRpbmcgVUkgZmVlZGJhY2sgaGVscGVycyB3aXRoIG5vIGhvbWUgaW4gYSBzaW5nbGUgZmVhdHVyZTogdG9hc3RzLCB0aGVcclxuLy8gICBib3R0b20gbG9nIHBhbmVsLCBzb3J0LWRpcmVjdGlvbiBidXR0b25zLCBzcGVha2VyLWxhYmVscyAoZGlhcml6YXRpb24pIHJlYWRpbmVzcywgXCJyZXZlYWwgaW5cclxuLy8gICBmb2xkZXJcIiwgYW5kIGNsaXBib2FyZCBjb3B5LiBTdGF0ZS9mb3JtYXQvam9iLVNTRS9wcmV2aWV3IG1hY2hpbmVyeSBzcGxpdCBvdXQgaW4gc3RhZ2UgMDIuXHJcbi8vICAgQVBJOiByb3V0ZXMvY29uZmlnLnB5LCByb3V0ZXMvbG9ncy5weSAoaW5kaXJlY3RseSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfdXRpbHMucHlcclxuaW1wb3J0IHsgZXNjSHRtbCwgc3RyaXBSaWNoTWFya3VwIH0gZnJvbSAnLi9mb3JtYXQuanMnO1xyXG5cclxuLy8g4pSA4pSAIHNvcnQtZGlyZWN0aW9uIHRvZ2dsZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuLy8gUmVmbGVjdHMgYSBzb3J0LWRpcmVjdGlvbiB0b2dnbGUncyBjdXJyZW50IHN0YXRlIG9udG8gaXRzIGJ1dHRvbjogYXJyb3cgZ2x5cGgsXHJcbi8vIGFyaWEtcHJlc3NlZCwgYW5kIGEgc2VsZi1kZXNjcmliaW5nIGFyaWEtbGFiZWwuICdkZXNjJyBpcyB0aGUgc29ydCBvcHRpb24nc1xyXG4vLyBuYXR1cmFsIG9yZGVyIChoaWdoZXN0L25ld2VzdCBmaXJzdCk7ICdhc2MnIHJldmVyc2VzIGl0LlxyXG5leHBvcnQgZnVuY3Rpb24gX3N5bmNTb3J0RGlyQnRuKGJ0bklkLCBkaXIpIHtcclxuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChidG5JZCk7XHJcbiAgaWYgKCFidG4pIHJldHVybjtcclxuICBjb25zdCBhc2MgPSBkaXIgPT09ICdhc2MnO1xyXG4gIGJ0bi5pbm5lckhUTUwgPSBhc2MgPyAnJiM4NTkzOycgOiAnJiM4NTk1Oyc7XHJcbiAgYnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJywgYXNjID8gJ3RydWUnIDogJ2ZhbHNlJyk7XHJcbiAgYnRuLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGFzY1xyXG4gICAgPyAnU29ydGVkIGFzY2VuZGluZyAtIGNsaWNrIHRvIHNvcnQgZGVzY2VuZGluZydcclxuICAgIDogJ1NvcnRlZCBkZXNjZW5kaW5nIC0gY2xpY2sgdG8gc29ydCBhc2NlbmRpbmcnKTtcclxuICBidG4udGl0bGUgPSBhc2MgPyAnQXNjZW5kaW5nIG9yZGVyJyA6ICdEZXNjZW5kaW5nIG9yZGVyJztcclxufVxyXG5cclxuLy8g4pSA4pSAIHNwZWFrZXIgbGFiZWxzIChkaWFyaXphdGlvbikgcmVhZGluZXNzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBTcGVlY2hCcmFpbiAodGhlIGRlZmF1bHQgYmFja2VuZCkgaXMgYnVuZGxlZCAtIGl0cyBwYWNrYWdlIHNob3VsZCBhbHdheXMgYmVcclxuLy8gcHJlc2VudCwgc28gYW4gdW5yZWFkeSByZXN1bHQgdGhlcmUgbWVhbnMgYSBicm9rZW4gaW5zdGFsbCwgbm90IGEgbWlzc2luZ1xyXG4vLyBvcHRpb25hbCBkb3dubG9hZC4gUHlhbm5vdGUgaXMgdGhlIGFkdmFuY2VkLCB0b2tlbi1nYXRlZCBhbHRlcm5hdGl2ZSBhbmQgc3RpbGxcclxuLy8gbmVlZHMgYSByZWFsIGluc3RhbGwgKyBhIEh1Z2dpbmdGYWNlIHRva2VuLiBUaGUgcGVyLXJ1biBjaGVja2JveGVzIGluIHRoZVxyXG4vLyBhbmFseXplIGFuZCBleHBvcnQgcGFuZWxzIGJvdGggZ2F0ZSBvbiB0aGlzIHNpbmdsZSBjaGVjay4gQ2VudHJhbGl6ZWQgaGVyZSBzb1xyXG4vLyB0aGUgdGhyZWUgc3VyZmFjZXMgKFNldHRpbmdzLCBhbmFseXplLCBleHBvcnQpIGNhbid0IGRyaWZ0IHRvIGRpZmZlcmVudCBydWxlcy5cclxuZXhwb3J0IGZ1bmN0aW9uIF9kaWFyaXphdGlvblJlYXNvbihpbnN0YWxsZWQpIHtcclxuICByZXR1cm4gaW5zdGFsbGVkID8gJycgOiAnU3BlZWNoQnJhaW4gaXMgdW5hdmFpbGFibGUgLSB0cnkgcmVpbnN0YWxsaW5nIFl1dUNsaXAnO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gX2RpYXJpemF0aW9uUmVhZGluZXNzKCkge1xyXG4gIGNvbnN0IGNmZyA9IGF3YWl0IGZldGNoKCcvYXBpL2NvbmZpZycpLnRoZW4ociA9PiByLmpzb24oKSkuY2F0Y2goKCkgPT4gKHt9KSk7XHJcbiAgY29uc3QgYmFja2VuZCA9IGNmZy5kaWFyaXphdGlvbl9iYWNrZW5kIHx8ICdzcGVlY2hicmFpbic7XHJcbiAgY29uc3QgaW5zdGFsbCA9IGF3YWl0IGZldGNoKCcvYXBpL2luc3RhbGwvc3BlZWNoYnJhaW4nKS50aGVuKHIgPT4gci5qc29uKCkpLmNhdGNoKCgpID0+ICh7aW5zdGFsbGVkOiBmYWxzZX0pKTtcclxuICBjb25zdCBpbnN0YWxsZWQgPSAhIWluc3RhbGwuaW5zdGFsbGVkO1xyXG4gIHJldHVybiB7XHJcbiAgICBpbnN0YWxsZWQsXHJcbiAgICBiYWNrZW5kLFxyXG4gICAgcmVhZHk6ICAgaW5zdGFsbGVkLFxyXG4gICAgcmVhc29uOiAgX2RpYXJpemF0aW9uUmVhc29uKGluc3RhbGxlZCksXHJcbiAgfTtcclxufVxyXG5cclxuLy8gTm90ZSBzaG93biBvbiBhIGRpc2FibGVkIHNwZWFrZXItbGFiZWxzIGNvbnRyb2w6IHRoZSBibG9ja2luZyByZWFzb24gcGx1cyBhXHJcbi8vIGJ1dHRvbiB0aGF0IGp1bXBzIHRvIFNldHRpbmdzLiBzZXR0aW5nc09uY2xpY2sgY2xvc2VzIHRoZSBob3N0IHN1cmZhY2UgZmlyc3RcclxuLy8gKHRoZSBhbmFseXplIHBhbmVsIG9yIGV4cG9ydCBtb2RhbCkgc28gU2V0dGluZ3MgaXNuJ3Qgb3BlbmVkIGJlaGluZCBpdC5cclxuZXhwb3J0IGZ1bmN0aW9uIF9kaWFyaXphdGlvbk5vdGVIdG1sKHJlYXNvbiwgc2V0dGluZ3NPbmNsaWNrKSB7XHJcbiAgcmV0dXJuIGVzY0h0bWwocmVhc29uKSArICcgLSBzZXQgdXAgaW4gJyArXHJcbiAgICAnPGJ1dHRvbiBjbGFzcz1cImJ0biBnaG9zdFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7cGFkZGluZzowIDRweDtjb2xvcjp2YXIoLS1hY2NlbnQpOycgK1xyXG4gICAgYGRpc3BsYXk6aW5saW5lLWZsZXhcIiBvbmNsaWNrPVwiJHtlc2NIdG1sKHNldHRpbmdzT25jbGljayl9XCI+U2V0dGluZ3M8L2J1dHRvbj5gO1xyXG59XHJcblxyXG4vLyDilIDilIAgbG9nIHBhbmVsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5leHBvcnQgZnVuY3Rpb24gb3BlbkxvZygpIHtcclxuICBjb25zdCBwYW5lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctcGFuZWwnKTtcclxuICBwYW5lbC5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XHJcbiAgcGFuZWwuY2xhc3NMaXN0LnJlbW92ZSgnbWluaW1pemVkJyk7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy10b2dnbGUnKS50ZXh0Q29udGVudCA9ICfilrInO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlTG9nKCkge1xyXG4gIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1wYW5lbCcpO1xyXG4gIGNvbnN0IG1pbmltaXplZCA9IHBhbmVsLmNsYXNzTGlzdC50b2dnbGUoJ21pbmltaXplZCcpO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctdG9nZ2xlJykudGV4dENvbnRlbnQgPSBtaW5pbWl6ZWQgPyAn4pa8JyA6ICfilrInO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tbG9nLXRvZ2dsZScpLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIG1pbmltaXplZCA/ICdmYWxzZScgOiAndHJ1ZScpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJMb2coKSB7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvZy1saW5lcycpLmlubmVySFRNTCA9ICcnO1xyXG59XHJcblxyXG4vLyBUaGUgbG9nIGhlYWRlcidzIHRvZ2dsZS9jbGVhciBidXR0b25zIGFyZSBzdGF0aWMgbWFya3VwIGluIGluZGV4Lmh0bWwgKG5ldmVyXHJcbi8vIHJlLXJlbmRlcmVkKSwgc28gdGhpcyBvbmUtdGltZSB3aXJpbmcgYXQgbW9kdWxlIGxvYWQgY2FuJ3QgZG91YmxlLWZpcmUuXHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tbG9nLXRvZ2dsZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdG9nZ2xlTG9nKTtcclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2J0bi1jbGVhci1sb2cnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGNsZWFyTG9nKTtcclxuXHJcbi8vIENhcCB0aGUgbG9nIERPTS4gQW4gdW5ib3VuZGVkIGxvZyBmcm96ZSB0aGUgYnJvd3NlciBvbiBsb25nIHJ1bnMgYW5kLCB3b3JzZSxcclxuLy8gd2hlbiBhIHJlYXR0YWNoZWQgYW5hbHl6ZSBzdHJlYW0gcmVwbGF5ZWQgYSBsYXJnZSBidWZmZXIgYWxsIGF0IG9uY2UgKGVhY2ggbGluZVxyXG4vLyB0cmlnZ2VycyBhIHNjcm9sbC10by1ib3R0b20gcmVmbG93KSAtIHRoZSB0YWIgbG9ja2VkIHVwLCB0aGUgZWxhcHNlZCB0aW1lclxyXG4vLyBhcHBlYXJlZCBmcm96ZW4sIGFuZCBDYW5jZWwgd291bGRuJ3QgcmVzcG9uZC4gS2VlcGluZyBvbmx5IHRoZSBtb3N0IHJlY2VudCBsaW5lc1xyXG4vLyBib3VuZHMgdGhlIHJlZmxvdyBjb3N0OyB0aGUgZnVsbCBsb2cgYWx3YXlzIHJlbWFpbnMgaW4gLnl1dS1jbGlwL3l1dS1jbGlwLmxvZy5cclxuY29uc3QgX01BWF9MT0dfTElORVMgPSA1MDA7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kTG9nKHJhdykge1xyXG4gIGNvbnN0IHRleHQgPSBzdHJpcFJpY2hNYXJrdXAocmF3KTtcclxuICBpZiAoIXRleHQudHJpbSgpKSByZXR1cm47XHJcbiAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgY29uc3QgaXNPayAgID0gcmF3LmluY2x1ZGVzKCcgT0snKSB8fCByYXcuaW5jbHVkZXMoJ1tncmVlbl0nKSB8fCByYXcuaW5jbHVkZXMoJ0RvbmUnKTtcclxuICBjb25zdCBpc0VyciAgID0gcmF3LmluY2x1ZGVzKCdGQUlMJykgfHwgcmF3LmluY2x1ZGVzKCdFcnJvcicpIHx8IHJhdy5pbmNsdWRlcygnW3JlZF0nKSB8fCByYXcuaW5jbHVkZXMoJ2Vycm9yJyk7XHJcbiAgY29uc3QgaXNXYXJuICA9IHJhdy5pbmNsdWRlcygnW3llbGxvd10nKSB8fCByYXcuaW5jbHVkZXMoJ1dBUk5JTkcnKSB8fCByYXcuaW5jbHVkZXMoJ292ZXJsYXAnKTtcclxuICBkaXYuY2xhc3NOYW1lID0gJ2xvZy1saW5lJyArIChpc09rID8gJyBvaycgOiBpc0VyciA/ICcgZXJyJyA6IGlzV2FybiA/ICcgd2FybicgOiAnJyk7XHJcbiAgZGl2LnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XHJcbiAgZGl2LnN0eWxlLmdhcCA9ICc2cHgnO1xyXG4gIGNvbnN0IHRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gIHRzLnN0eWxlLmNzc1RleHQgPSAnY29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMHB4O2ZsZXgtc2hyaW5rOjA7b3BhY2l0eTouNyc7XHJcbiAgdHMudGV4dENvbnRlbnQgPSBuZXcgRGF0ZSgpLnRvTG9jYWxlVGltZVN0cmluZyh1bmRlZmluZWQsIHtob3VyOicyLWRpZ2l0JywgbWludXRlOicyLWRpZ2l0Jywgc2Vjb25kOicyLWRpZ2l0J30pO1xyXG4gIGRpdi5hcHBlbmRDaGlsZCh0cyk7XHJcbiAgZGl2LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHQpKTtcclxuICBjb25zdCBsaW5lcyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctbGluZXMnKTtcclxuICBsaW5lcy5hcHBlbmRDaGlsZChkaXYpO1xyXG4gIHdoaWxlIChsaW5lcy5jaGlsZEVsZW1lbnRDb3VudCA+IF9NQVhfTE9HX0xJTkVTKSBsaW5lcy5yZW1vdmVDaGlsZChsaW5lcy5maXJzdEVsZW1lbnRDaGlsZCk7XHJcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2ctYm9keScpO1xyXG4gIGJvZHkuc2Nyb2xsVG9wID0gYm9keS5zY3JvbGxIZWlnaHQ7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCB0b2FzdCBub3RpZmljYXRpb25zIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBUeXBlczogc3VjY2VzcyB8IGluZm8gfCB3YXJuaW5nIChndWFyZC9ndWlkYW5jZSkgfCBlcnJvciAoYWN0dWFsIGZhaWx1cmVzKS5cclxuLy8gRXJyb3IgdG9hc3RzIHBlcnNpc3QgdW50aWwgZGlzbWlzc2VkIC0gZHVyYXRpb25NcyBpcyBpZ25vcmVkIGZvciB0aGVtLlxyXG4vLyBvcHRzOiB7IGR1cmF0aW9uTXMsIGFjdGlvbjoge2xhYmVsLCBvbkNsaWNrfSB9XHJcbmNvbnN0IFRPQVNUX1NUQUNLX01BWCA9IDQ7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2UsIHR5cGUgPSAnc3VjY2VzcycsIG9wdHMgPSB7fSkge1xyXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0b2FzdC1jb250YWluZXInKTtcclxuICBjb25zdCBsaXZlUmVnaW9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodHlwZSA9PT0gJ2Vycm9yJyA/ICdzci1saXZlLWFzc2VydGl2ZScgOiAnc3ItbGl2ZS1wb2xpdGUnKTtcclxuICBpZiAobGl2ZVJlZ2lvbikgeyBsaXZlUmVnaW9uLnRleHRDb250ZW50ID0gJyc7IHNldFRpbWVvdXQoKCkgPT4geyBsaXZlUmVnaW9uLnRleHRDb250ZW50ID0gbWVzc2FnZTsgfSwgMTApOyB9XHJcbiAgd2hpbGUgKGNvbnRhaW5lci5jaGlsZHJlbi5sZW5ndGggPj0gVE9BU1RfU1RBQ0tfTUFYKSBjb250YWluZXIuZmlyc3RFbGVtZW50Q2hpbGQucmVtb3ZlKCk7XHJcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICB0b2FzdC5jbGFzc05hbWUgPSBgdG9hc3QgJHt0eXBlfWA7XHJcbiAgdG9hc3Quc3R5bGUuY3NzVGV4dCA9ICdkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoxMHB4JztcclxuICBjb25zdCBtc2cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgbXNnLnRleHRDb250ZW50ID0gbWVzc2FnZTtcclxuICB0b2FzdC5hcHBlbmRDaGlsZChtc2cpO1xyXG4gIGNvbnN0IGJ1dHRvbnMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICBidXR0b25zLnN0eWxlLmNzc1RleHQgPSAnZGlzcGxheTpmbGV4O2dhcDo2cHg7YWxpZ24taXRlbXM6Y2VudGVyO2ZsZXgtc2hyaW5rOjAnO1xyXG4gIGlmIChvcHRzLmFjdGlvbikge1xyXG4gICAgY29uc3QgYWN0aW9uQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgICBhY3Rpb25CdG4uY2xhc3NOYW1lID0gJ2J0biBnaG9zdCc7XHJcbiAgICBhY3Rpb25CdG4uc3R5bGUuY3NzVGV4dCA9ICdmb250LXNpemU6MTFweDtwYWRkaW5nOjJweCA4cHgnO1xyXG4gICAgYWN0aW9uQnRuLnRleHRDb250ZW50ID0gb3B0cy5hY3Rpb24ubGFiZWw7XHJcbiAgICBhY3Rpb25CdG4ub25jbGljayA9ICgpID0+IHsgdG9hc3QucmVtb3ZlKCk7IG9wdHMuYWN0aW9uLm9uQ2xpY2soKTsgfTtcclxuICAgIGJ1dHRvbnMuYXBwZW5kQ2hpbGQoYWN0aW9uQnRuKTtcclxuICB9XHJcbiAgY29uc3QgY2xvc2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICBjbG9zZS50ZXh0Q29udGVudCA9ICfDlyc7XHJcbiAgY2xvc2Uuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgJ0Rpc21pc3MnKTtcclxuICBjbG9zZS5zdHlsZS5jc3NUZXh0ID0gYGJhY2tncm91bmQ6bm9uZTtib3JkZXI6bm9uZTtjb2xvcjppbmhlcml0O2N1cnNvcjpwb2ludGVyO2ZvbnQtc2l6ZToxOHB4O2xpbmUtaGVpZ2h0OjE7cGFkZGluZzowO2ZsZXgtc2hyaW5rOjA7b3BhY2l0eToke3R5cGUgPT09ICdlcnJvcicgPyAnLjgnIDogJy41J31gO1xyXG4gIGNsb3NlLm9uY2xpY2sgPSAoKSA9PiB0b2FzdC5yZW1vdmUoKTtcclxuICBidXR0b25zLmFwcGVuZENoaWxkKGNsb3NlKTtcclxuICB0b2FzdC5hcHBlbmRDaGlsZChidXR0b25zKTtcclxuICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QpO1xyXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSByZXR1cm47XHJcbiAgY29uc3QgbXMgPSBvcHRzLmR1cmF0aW9uTXMgPz8gKHR5cGUgPT09ICd3YXJuaW5nJyA/IDYwMDAgOiA0MDAwKTtcclxuICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgIHRvYXN0LnN0eWxlLnRyYW5zaXRpb24gPSAnb3BhY2l0eSAuM3MnO1xyXG4gICAgdG9hc3Quc3R5bGUub3BhY2l0eSA9ICcwJztcclxuICAgIHNldFRpbWVvdXQoKCkgPT4gdG9hc3QucmVtb3ZlKCksIDMwMCk7XHJcbiAgfSwgbXMpO1xyXG59XHJcblxyXG4vLyDilIDilIAgbmV0d29yayBlcnJvciBjb3B5IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4vLyBBIGZldGNoKCkgcmVqZWN0aW9uIG1lYW5zIHRoZSByZXF1ZXN0IG5ldmVyIGdvdCBhIHJlc3BvbnNlIC0gb24gdGhpcyBsb2NhbGhvc3QvXHJcbi8vIEVsZWN0cm9uIGFwcCB0aGF0IGFsbW9zdCBhbHdheXMgbWVhbnMgdGhlIGJhY2tlbmQgc3RvcHBlZCwgbm90IGEgcmVhbCBuZXR3b3JrLlxyXG4vLyBUaGUgYnJvd3NlciByZXBvcnRzIGl0IGFzIGEgVHlwZUVycm9yIHdob3NlIG1lc3NhZ2UgaXMgdGhlIG9wYXF1ZSBcIkZhaWxlZCB0b1xyXG4vLyBmZXRjaFwiLCB1c2VsZXNzIHRvIGEgbm9uLWRldmVsb3Blci4gQW4gRXJyb3IgdGhyb3duIGFmdGVyIGEgbm9uLW9rIHJlc3BvbnNlXHJcbi8vIGFscmVhZHkgY2FycmllcyBhIHJlYWwsIHNwZWNpZmljIG1lc3NhZ2UsIHNvIHBhc3MgdGhvc2UgdGhyb3VnaCB1bmNoYW5nZWQuIFVzZVxyXG4vLyB0aGlzIG9ubHkgYXQgY2F0Y2ggc2l0ZXMgdGhhdCB3cmFwIGEgYmFyZSBmZXRjaCAobm90IG9uZXMgZG9pbmcgRE9NIHdvcmsgdGhhdFxyXG4vLyBjb3VsZCB0aHJvdyBpdHMgb3duIFR5cGVFcnJvcikuXHJcbmV4cG9ydCBmdW5jdGlvbiBuZXRFcnJNc2coZXJyKSB7XHJcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFR5cGVFcnJvcikgcmV0dXJuIFwiQ291bGRuJ3QgcmVhY2ggWXV1Q2xpcCAtIGl0IG1heSBoYXZlIHN0b3BwZWQuIFRyeSBhZ2Fpbiwgb3IgcmVzdGFydCB0aGUgYXBwLlwiO1xyXG4gIHJldHVybiAoZXJyICYmIGVyci5tZXNzYWdlKSB8fCAnVW5rbm93biBlcnJvcic7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCByZXZlYWwgaW4gZmlsZSBleHBsb3JlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJldmVhbEluRm9sZGVyKHBhdGgpIHtcclxuICB0cnkge1xyXG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJy9hcGkvcmV2ZWFsJywge1xyXG4gICAgICBtZXRob2Q6ICdQT1NUJywgaGVhZGVyczogeydDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbid9LFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7cGF0aH0pLFxyXG4gICAgfSk7XHJcbiAgICBpZiAoIXJlcy5vaykge1xyXG4gICAgICBjb25zdCBlID0gYXdhaXQgcmVzLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKTtcclxuICAgICAgc2hvd1RvYXN0KGBDb3VsZCBub3Qgc2hvdyBpbiBmb2xkZXI6ICR7ZS5kZXRhaWwgfHwgJ2ZhaWxlZCd9YCwgJ2Vycm9yJyk7XHJcbiAgICB9XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBzaG93VG9hc3QoYENvdWxkIG5vdCBzaG93IGluIGZvbGRlcjogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBjbGlwYm9hcmQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIFRoZSBhcHAgb25seSBldmVyIHJ1bnMgb24gbG9jYWxob3N0IG9yIGluc2lkZSBFbGVjdHJvbiwgc28gbmF2aWdhdG9yLmNsaXBib2FyZFxyXG4vLyBpcyBhbHdheXMgYXZhaWxhYmxlIC0gYSBmYWlsdXJlIHRvYXN0IGlzIGVub3VnaCwgbm8gZXhlY0NvbW1hbmQgZmFsbGJhY2suXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb3B5VGV4dCh0ZXh0LCBsYWJlbCkge1xyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KTtcclxuICAgIHNob3dUb2FzdChgJHtsYWJlbH0gY29waWVkYCwgJ3N1Y2Nlc3MnKTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHNob3dUb2FzdChgQ291bGQgbm90IGNvcHkgJHtsYWJlbC50b0xvd2VyQ2FzZSgpfTogJHtlcnIubWVzc2FnZX1gLCAnZXJyb3InKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBjb2xsYXBzaWJsZSBkZXRhaWwgY2FyZHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbi8vIE9wdC1pbjogYnVpbGQgYSBjYXJkIHdpdGggY29sbGFwc2libGVDYXJkKGtleSwgdGl0bGUsIGJvZHksIHthY3Rpb25zfSkuIFRoZVxyXG4vLyB0aXRsZSBpcyByZW5kZXJlZCBpbnNpZGUgYSByZWFsIDxidXR0b24gY2xhc3M9XCJjYXJkLXRvZ2dsZVwiPiwgc28gdGhlIHRvZ2dsZVxyXG4vLyBoYXMgbmF0aXZlIGtleWJvYXJkL2ZvY3VzIGJlaGF2aW91ciBhbmQgLSBiZWNhdXNlIHNob3J0Y3V0cy5qcydzIGdsb2JhbFxyXG4vLyBrZXlkb3duIGJhaWxzIG9uIHRhZ05hbWUgPT09ICdCVVRUT04nIC0gU3BhY2Ugb24gYSBmb2N1c2VkIHRvZ2dsZSBuZXZlciBhbHNvXHJcbi8vIGZpcmVzIHBsYXkvcGF1c2UuIEhlYWRlciBhY3Rpb24gY29udHJvbHMgYXJlIHBhc3NlZCB2aWEgb3B0cy5hY3Rpb25zIGFuZCBzaXRcclxuLy8gYXMgU0lCTElOR1Mgb2YgdGhlIHRvZ2dsZSBidXR0b24sIG5ldmVyIGRlc2NlbmRhbnRzLCBzbyBhIGJ1dHRvbiBuZXZlciBuZXN0c1xyXG4vLyBpbnNpZGUgdGhlIHRvZ2dsZSAoV0NBRyA0LjEuMiBuZXN0ZWQtaW50ZXJhY3RpdmUpLiBTZWVkZWQgZnJvbSBpc0NhcmRDb2xsYXBzZWQoa2V5KS5cclxuY29uc3QgX0NBUkRfQ09MTEFQU0VfS0VZID0gJ3l1dWNsaXAtY2FyZC1jb2xsYXBzZWQnO1xyXG5cclxuZnVuY3Rpb24gX2NhcmRDb2xsYXBzZVN0YXRlKCkge1xyXG4gIHRyeSB7IHJldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKF9DQVJEX0NPTExBUFNFX0tFWSkgfHwgJ3t9JykgfHwge307IH1cclxuICBjYXRjaCB7IHJldHVybiB7fTsgfVxyXG59XHJcblxyXG4vLyBQZXJzaXN0ZWQgY29sbGFwc2Ugc3RhdGUgcGVyIGNhcmQga2V5LiBkZWZhdWx0Q29sbGFwc2VkIGxldHMgYSBjYXJkIChlLmcuIHRoZVxyXG4vLyBoZWF2eSBmdWxsLXZpZGVvIHRyYW5zY3JpcHQpIHN0YXJ0IGNvbGxhcHNlZCB1bnRpbCB0aGUgdXNlciBvcGVucyBpdC5cclxuZnVuY3Rpb24gaXNDYXJkQ29sbGFwc2VkKGtleSwgZGVmYXVsdENvbGxhcHNlZCA9IGZhbHNlKSB7XHJcbiAgY29uc3Qgc3RhdGUgPSBfY2FyZENvbGxhcHNlU3RhdGUoKTtcclxuICByZXR1cm4ga2V5IGluIHN0YXRlID8gISFzdGF0ZVtrZXldIDogZGVmYXVsdENvbGxhcHNlZDtcclxufVxyXG5cclxuLy8gU2luZ2xlIHNvdXJjZSBvZiB0aGUgY29sbGFwc2libGUtY2FyZCBtYXJrdXAgY29udHJhY3Q6IHRoZSB+MTEgZGV0YWlsIGNhcmRzXHJcbi8vIHRoYXQgb3B0IGluIGFsbCByZW5kZXIgdGhyb3VnaCBoZXJlIHNvIG5vbmUgY2FuIGRyaWZ0IGZyb20gdGhlIGNsYXNzIC9cclxuLy8gZGF0YS1jb2xsYXBzZS1rZXkgLyB0b2dnbGUtYTExeSBhdHRyaWJ1dGVzIHRoZSB0b2dnbGUgbG9naWMgYmVsb3cgcmVhZHMuXHJcbi8vIHRpdGxlID0gdGhlIGhlYWRlcidzIHRpdGxlIGNvbnRlbnQgKGdvZXMgaW5zaWRlIHRoZSB0b2dnbGUgYnV0dG9uKTsgYm9keSA9XHJcbi8vIGV2ZXJ5dGhpbmcgc2hvd24gYmVsb3cgdGhlIGhlYWRlci4gb3B0cy5hY3Rpb25zID0gaGVhZGVyIGNvbnRyb2xzIHJlbmRlcmVkXHJcbi8vIGJlc2lkZSB0aGUgdG9nZ2xlOyBvcHRzLmRlZmF1bHRDb2xsYXBzZWQgc3RhcnRzIGEgY2FyZCBjb2xsYXBzZWQgdW50aWwgZmlyc3RcclxuLy8gb3BlbmVkOyBvcHRzLmF0dHJzIGFkZHMgY2FyZCBhdHRyaWJ1dGVzIChpZCwgZGF0YS0qKTsgb3B0cy5oZWFkZXJTdHlsZSBzZXRzXHJcbi8vIGFuIGlubGluZSBzdHlsZSBvbiB0aGUgaGVhZGVyIHJvdy5cclxuZXhwb3J0IGZ1bmN0aW9uIGNvbGxhcHNpYmxlQ2FyZChrZXksIHRpdGxlLCBib2R5LCBvcHRzID0ge30pIHtcclxuICBjb25zdCB7IGRlZmF1bHRDb2xsYXBzZWQgPSBmYWxzZSwgYXR0cnMgPSAnJywgaGVhZGVyU3R5bGUgPSAnJywgYWN0aW9ucyA9ICcnIH0gPSBvcHRzO1xyXG4gIGNvbnN0IGNvbGxhcHNlZCA9IGlzQ2FyZENvbGxhcHNlZChrZXksIGRlZmF1bHRDb2xsYXBzZWQpO1xyXG4gIGNvbnN0IHN0eWxlQXR0ciA9IGhlYWRlclN0eWxlID8gYCBzdHlsZT1cIiR7aGVhZGVyU3R5bGV9XCJgIDogJyc7XHJcbiAgY29uc3QgZXh0cmFBdHRycyA9IGF0dHJzID8gYCAke2F0dHJzfWAgOiAnJztcclxuICByZXR1cm4gYFxyXG4gICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkIGNvbGxhcHNpYmxlJHtjb2xsYXBzZWQgPyAnIGNvbGxhcHNlZCcgOiAnJ31cIiBkYXRhLWNvbGxhcHNlLWtleT1cIiR7a2V5fVwiJHtleHRyYUF0dHJzfT5cclxuICAgICAgPGRpdiBjbGFzcz1cImRldGFpbC1jYXJkLWhlYWRlclwiJHtzdHlsZUF0dHJ9PlxyXG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY2FyZC10b2dnbGVcIiBhcmlhLWV4cGFuZGVkPVwiJHtjb2xsYXBzZWQgPyAnZmFsc2UnIDogJ3RydWUnfVwiPiR7dGl0bGV9PC9idXR0b24+XHJcbiAgICAgICAgJHthY3Rpb25zfVxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgJHtib2R5fVxyXG4gICAgPC9kaXY+YDtcclxufVxyXG5cclxuZnVuY3Rpb24gX3RvZ2dsZUNvbGxhcHNpYmxlQ2FyZChjYXJkLCB0b2dnbGUpIHtcclxuICBjb25zdCBjb2xsYXBzZWQgPSBjYXJkLmNsYXNzTGlzdC50b2dnbGUoJ2NvbGxhcHNlZCcpO1xyXG4gIHRvZ2dsZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBjb2xsYXBzZWQgPyAnZmFsc2UnIDogJ3RydWUnKTtcclxuICBjb25zdCBrZXkgPSBjYXJkLmRhdGFzZXQuY29sbGFwc2VLZXk7XHJcbiAgaWYgKCFrZXkpIHJldHVybjtcclxuICAvLyBQZXJzaXN0IGJlc3QtZWZmb3J0OiBhIHdyaXRlIGZhaWx1cmUgKHByaXZhdGUgbW9kZSwgcXVvdGEpIG11c3Qgbm90IHN3YWxsb3dcclxuICAvLyB0aGUgdG9nZ2xlIG9yIGJsb2NrIHRoZSBsYXp5LWxvYWQgZGlzcGF0Y2ggYmVsb3cuIFRoZSByZWFkIHBhdGhcclxuICAvLyAoX2NhcmRDb2xsYXBzZVN0YXRlKSBpcyBsaWtld2lzZSB0b2xlcmFudC5cclxuICB0cnkge1xyXG4gICAgY29uc3Qgc3RhdGUgPSBfY2FyZENvbGxhcHNlU3RhdGUoKTtcclxuICAgIHN0YXRlW2tleV0gPSBjb2xsYXBzZWQ7XHJcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShfQ0FSRF9DT0xMQVBTRV9LRVksIEpTT04uc3RyaW5naWZ5KHN0YXRlKSk7XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLndhcm4oJ0NvdWxkIG5vdCBwZXJzaXN0IGNhcmQgY29sbGFwc2Ugc3RhdGU6JywgZXJyKTtcclxuICB9XHJcbiAgLy8gTGV0cyBhIGNhcmQgbGF6eS1sb2FkIGl0cyBib2R5IHRoZSBmaXJzdCB0aW1lIGl0IGlzIGV4cGFuZGVkLlxyXG4gIGNhcmQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ2NhcmR0b2dnbGUnLCB7IGJ1YmJsZXM6IHRydWUsIGRldGFpbDogeyBrZXksIGNvbGxhcHNlZCB9IH0pKTtcclxufVxyXG5cclxuLy8gT25seSB0aGUgY2FyZCdzIG93biB0b2dnbGUgYnV0dG9uIGNvbGxhcHNlcyBpdCAobmF0aXZlIEVudGVyL1NwYWNlIGFjdGl2YXRlIGl0XHJcbi8vIHRvbykuIE5lc3RlZCBoZWFkZXJzIGluc2lkZSBhIGNvbXBvdW5kIGNhcmQncyBib2R5IGNhcnJ5IG5vIC5jYXJkLXRvZ2dsZSwgc29cclxuLy8gdGhleSBuZWl0aGVyIHRvZ2dsZSBub3Igc2hvdyBhIGNoZXZyb24uXHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuICBjb25zdCB0b2dnbGUgPSBlLnRhcmdldC5jbG9zZXN0KCcuY2FyZC10b2dnbGUnKTtcclxuICBpZiAoIXRvZ2dsZSkgcmV0dXJuO1xyXG4gIGNvbnN0IGNhcmQgPSB0b2dnbGUuY2xvc2VzdCgnLmRldGFpbC1jYXJkLmNvbGxhcHNpYmxlJyk7XHJcbiAgaWYgKGNhcmQpIF90b2dnbGVDb2xsYXBzaWJsZUNhcmQoY2FyZCwgdG9nZ2xlKTtcclxufSk7XHJcbiIsICIvLyBGZWF0dXJlLW1hcCAtIFNoYXJlZCBVSSBwcmltaXRpdmVzIChhbGVydCAvIGNvbmZpcm0gLyBwcm9tcHQgbW9kYWxzKSB1c2VkIGFwcC13aWRlLlxuLy8gICBBUEk6IG5vbmUgKGNsaWVudC1vbmx5KSDCtyBUZXN0czogY292ZXJlZCBpbmRpcmVjdGx5IGJ5IHRoZSB0ZXN0X3VpXyoucHkgc3VpdGVzXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0IHsgZXNjSHRtbCB9IGZyb20gJy4vZm9ybWF0LmpzJztcblxuLy8g4pSA4pSAIGFsZXJ0IG1vZGFsIChzaW5nbGUtYnV0dG9uLCBubyBjYW5jZWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9hbGVydE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gc2hvd0FsZXJ0KHRpdGxlLCBib2R5KSB7XG4gIF9hbGVydE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC10aXRsZScpLnRleHRDb250ZW50ID0gdGl0bGU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhbGVydC1ib2R5JykuaW5uZXJIVE1MID0gYm9keTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNhbGVydC1tb2RhbCAuYnRuJykuZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlQWxlcnRNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FsZXJ0LW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBvcGVuZXIgPSBfYWxlcnRPcGVuZXI7XG4gIF9hbGVydE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGNvbmZpcm0gbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2NvbmZpcm1PcGVuZXIgPSBudWxsO1xuZXhwb3J0IGZ1bmN0aW9uIHNob3dDb25maXJtKHRpdGxlLCBib2R5LCBva0xhYmVsLCBvbk9rLCBkYW5nZXIgPSBmYWxzZSwgY2FuY2VsTGFiZWwgPSAnQ2FuY2VsJykge1xuICBfY29uZmlybU9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tYm9keScpLmlubmVySFRNTCA9IGJvZHk7XG4gIGNvbnN0IG9rID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tb2stYnRuJyk7XG4gIG9rLnRleHRDb250ZW50ID0gb2tMYWJlbDtcbiAgb2suY2xhc3NOYW1lID0gZGFuZ2VyID8gJ2J0biBkYW5nZXInIDogJ2J0biBwcmltYXJ5JztcbiAgLy8gRXZlcnkgY2FsbCBzZXRzIGl0LCBzbyB0aGUgZGVmYXVsdCAnQ2FuY2VsJyBpcyByZXN0b3JlZCBmb3IgY2FsbGVycyB0aGF0XG4gIC8vIGRvbid0IHBhc3MgYSBjdXN0b20gbGFiZWwgLSBubyBzdGFsZSBsYWJlbCBsZWFrcyBiZXR3ZWVuIGNvbmZpcm1zLlxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1jYW5jZWwtYnRuJykudGV4dENvbnRlbnQgPSBjYW5jZWxMYWJlbDtcbiAgQXBwU3RhdGUuY29uZmlybUNhbGxiYWNrID0gb25PaztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tY2FuY2VsLWJ0bicpLmZvY3VzKCksIDUwKTtcbn1cbmZ1bmN0aW9uIF9jb25maXJtT2soKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBjYiA9IEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjaztcbiAgQXBwU3RhdGUuY29uZmlybUNhbGxiYWNrID0gbnVsbDtcbiAgY29uc3Qgb3BlbmVyID0gX2NvbmZpcm1PcGVuZXI7XG4gIF9jb25maXJtT3BlbmVyID0gbnVsbDtcbiAgaWYgKGNiKSBjYigpO1xuICBlbHNlIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBfY29uZmlybUNhbmNlbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm0tbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIEFwcFN0YXRlLmNvbmZpcm1DYWxsYmFjayA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9jb25maXJtT3BlbmVyO1xuICBfY29uZmlybU9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGFkZGl0aW9uYWwgYWN0aW9ucyBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmxldCBfYWN0aW9uc01vZGFsT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBvcGVuQWN0aW9uc01vZGFsKHRpdGxlLCBncm91cHMpIHtcbiAgX2FjdGlvbnNNb2RhbE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsLXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgY29uc3QgYm9keSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsLWJvZHknKTtcbiAgYm9keS5pbm5lckhUTUwgPSAnJztcbiAgZ3JvdXBzLmZvckVhY2goKGdyb3VwLCBpKSA9PiB7XG4gICAgaWYgKGkgPiAwKSB7XG4gICAgICBjb25zdCBkaXZpZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICBkaXZpZGVyLmNsYXNzTmFtZSA9ICdoYW1idXJnZXItZGl2aWRlcic7XG4gICAgICBib2R5LmFwcGVuZENoaWxkKGRpdmlkZXIpO1xuICAgIH1cbiAgICBpZiAoZ3JvdXAuaGVhZGluZykge1xuICAgICAgY29uc3QgaGVhZGluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgaGVhZGluZy5jbGFzc05hbWUgPSAnc2VjdGlvbi10aXRsZSc7XG4gICAgICBoZWFkaW5nLnN0eWxlLmNzc1RleHQgPSAnbWFyZ2luOjhweCAwIDJweCA0cHgnO1xuICAgICAgaGVhZGluZy50ZXh0Q29udGVudCA9IGdyb3VwLmhlYWRpbmc7XG4gICAgICBib2R5LmFwcGVuZENoaWxkKGhlYWRpbmcpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHJvdyBvZiBncm91cC5yb3dzKSB7XG4gICAgICBjb25zdCBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgZWwudHlwZSA9ICdidXR0b24nO1xuICAgICAgZWwuY2xhc3NOYW1lID0gJ2FjdGlvbi1yb3cnICsgKHJvdy5kYW5nZXIgPyAnIGRhbmdlcicgOiAnJyk7XG4gICAgICBlbC5kaXNhYmxlZCA9ICEhcm93LmRpc2FibGVkO1xuICAgICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICBsYWJlbC5jbGFzc05hbWUgPSAnYWN0aW9uLXJvdy1sYWJlbCc7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9IHJvdy5sYWJlbDtcbiAgICAgIGNvbnN0IGRlc2MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICBkZXNjLmNsYXNzTmFtZSA9ICdhY3Rpb24tcm93LWRlc2MnO1xuICAgICAgZGVzYy50ZXh0Q29udGVudCA9IHJvdy5kZXNjcmlwdGlvbjtcbiAgICAgIGVsLmFwcGVuZChsYWJlbCwgZGVzYyk7XG4gICAgICBlbC5vbmNsaWNrID0gKCkgPT4geyBjbG9zZUFjdGlvbnNNb2RhbCgpOyByb3cuYWN0aW9uKCk7IH07XG4gICAgICBib2R5LmFwcGVuZENoaWxkKGVsKTtcbiAgICB9XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aW9ucy1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBib2R5LnF1ZXJ5U2VsZWN0b3IoJy5hY3Rpb24tcm93Om5vdCg6ZGlzYWJsZWQpJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUFjdGlvbnNNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGlvbnMtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9hY3Rpb25zTW9kYWxPcGVuZXI7XG4gIF9hY3Rpb25zTW9kYWxPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbi8vIOKUgOKUgCBtb2RhbCBsYXllcmluZyArIGZvY3VzIHRyYXAg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4vLyBDb25maXJtIGFuZCBhbGVydCBhcmUgdGhlIG9ubHkgbW9kYWxzIHRoYXQgc3RhY2sgb24gdG9wIG9mIG90aGVyIG1vZGFscywgc29cbi8vIHRoZXkgdGFrZSBwcmlvcml0eTsgb3RoZXJ3aXNlIGFsbCAubW9kYWwtYmcgc2hhcmUgei1pbmRleCAyMDAgYW5kIHRoZSBsYXN0XG4vLyB2aXNpYmxlIG9uZSBpbiBET00gb3JkZXIgaXMgdGhlIG9uZSBwYWludGVkIG9uIHRvcC5cbmV4cG9ydCBmdW5jdGlvbiB0b3Btb3N0VmlzaWJsZU1vZGFsKCkge1xuICBmb3IgKGNvbnN0IGlkIG9mIFsnY29uZmlybS1tb2RhbCcsICdhbGVydC1tb2RhbCddKSB7XG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XG4gICAgaWYgKGVsLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpKSByZXR1cm4gZWw7XG4gIH1cbiAgY29uc3QgdmlzaWJsZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5tb2RhbC1iZy52aXNpYmxlJyk7XG4gIHJldHVybiB2aXNpYmxlLmxlbmd0aCA/IHZpc2libGVbdmlzaWJsZS5sZW5ndGggLSAxXSA6IG51bGw7XG59XG5cbmNvbnN0IF9GT0NVU0FCTEVfU0VMRUNUT1IgPVxuICAnYVtocmVmXSwgYnV0dG9uOm5vdCg6ZGlzYWJsZWQpLCBpbnB1dDpub3QoOmRpc2FibGVkKSwgc2VsZWN0Om5vdCg6ZGlzYWJsZWQpLCAnICtcbiAgJ3RleHRhcmVhOm5vdCg6ZGlzYWJsZWQpLCBbdGFiaW5kZXhdOm5vdChbdGFiaW5kZXg9XCItMVwiXSknO1xuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XG4gIGlmIChlLmtleSAhPT0gJ1RhYicpIHJldHVybjtcbiAgY29uc3QgbW9kYWwgPSB0b3Btb3N0VmlzaWJsZU1vZGFsKCk7XG4gIGlmICghbW9kYWwpIHJldHVybjtcbiAgY29uc3QgZm9jdXNhYmxlcyA9IFsuLi5tb2RhbC5xdWVyeVNlbGVjdG9yQWxsKF9GT0NVU0FCTEVfU0VMRUNUT1IpXVxuICAgIC5maWx0ZXIoZWwgPT4gZWwuZ2V0Q2xpZW50UmVjdHMoKS5sZW5ndGggPiAwKTtcbiAgaWYgKCFmb2N1c2FibGVzLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCBmaXJzdCA9IGZvY3VzYWJsZXNbMF07XG4gIGNvbnN0IGxhc3QgID0gZm9jdXNhYmxlc1tmb2N1c2FibGVzLmxlbmd0aCAtIDFdO1xuICBpZiAoIW1vZGFsLmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIChlLnNoaWZ0S2V5ID8gbGFzdCA6IGZpcnN0KS5mb2N1cygpO1xuICB9IGVsc2UgaWYgKCFlLnNoaWZ0S2V5ICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGxhc3QpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZmlyc3QuZm9jdXMoKTtcbiAgfSBlbHNlIGlmIChlLnNoaWZ0S2V5ICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGZpcnN0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGxhc3QuZm9jdXMoKTtcbiAgfVxufSk7XG5cbi8vIOKUgOKUgCBtZW51IGtleWJvYXJkIHBhdHRlcm4gKGhhbWJ1cmdlciArIGtlYmFiKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmZ1bmN0aW9uIF9tZW51Rm9jdXNhYmxlSXRlbXMobWVudSkge1xuICByZXR1cm4gWy4uLm1lbnUucXVlcnlTZWxlY3RvckFsbCgnLmhhbWJ1cmdlci1pdGVtJyldXG4gICAgLmZpbHRlcihlbCA9PiAhZWwuZGlzYWJsZWQgJiYgZWwuZ2V0Q2xpZW50UmVjdHMoKS5sZW5ndGggPiAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9tZW51QXJyb3dLZXlkb3duKG1lbnUsIGUpIHtcbiAgaWYgKGUua2V5ICE9PSAnQXJyb3dEb3duJyAmJiBlLmtleSAhPT0gJ0Fycm93VXAnKSByZXR1cm47XG4gIGNvbnN0IGl0ZW1zID0gX21lbnVGb2N1c2FibGVJdGVtcyhtZW51KTtcbiAgaWYgKCFpdGVtcy5sZW5ndGgpIHJldHVybjtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICBjb25zdCBpZHggID0gaXRlbXMuaW5kZXhPZihkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtcbiAgY29uc3Qgc3RlcCA9IGUua2V5ID09PSAnQXJyb3dEb3duJyA/IDEgOiAtMTtcbiAgaXRlbXNbKGlkeCArIHN0ZXAgKyBpdGVtcy5sZW5ndGgpICUgaXRlbXMubGVuZ3RoXS5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgaGFtYnVyZ2VyIG1lbnUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5leHBvcnQgZnVuY3Rpb24gaXNIYW1idXJnZXJPcGVuKCkge1xuICByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51JykuY2xhc3NMaXN0LmNvbnRhaW5zKCdvcGVuJyk7XG59XG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlSGFtYnVyZ2VyKCkge1xuICBjb25zdCBtZW51ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1tZW51Jyk7XG4gIG1lbnUuY2xhc3NMaXN0LnRvZ2dsZSgnb3BlbicpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIG1lbnUuY2xhc3NMaXN0LmNvbnRhaW5zKCdvcGVuJykpO1xuICBpZiAobWVudS5jbGFzc0xpc3QuY29udGFpbnMoJ29wZW4nKSkgX21lbnVGb2N1c2FibGVJdGVtcyhtZW51KVswXT8uZm9jdXMoKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUhhbWJ1cmdlcihyZWZvY3VzVHJpZ2dlciA9IGZhbHNlKSB7XG4gIGNvbnN0IG1lbnUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKTtcbiAgLy8gRm9jdXMgc2l0dGluZyBvbiBhbiBpdGVtIGFib3V0IHRvIGJlIGRpc3BsYXk6bm9uZSdkIHdvdWxkIHNpbGVudGx5IGZhbGwgdG9cbiAgLy8gPGJvZHk+OyBoYW5kIGl0IHRvIHRoZSB0cmlnZ2VyIGZpcnN0IHNvIGl0IGhhcyBzb21ld2hlcmUgcmVhbCB0byBnby5cbiAgaWYgKHJlZm9jdXNUcmlnZ2VyIHx8IG1lbnUuY29udGFpbnMoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnRuLWhhbWJ1cmdlcicpLmZvY3VzKCk7XG4gIH1cbiAgbWVudS5jbGFzc0xpc3QucmVtb3ZlKCdvcGVuJyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4taGFtYnVyZ2VyJykuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG59XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLW1lbnUnKS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XG4gIF9tZW51QXJyb3dLZXlkb3duKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItbWVudScpLCBlKTtcbn0pO1xuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLXdyYXAnKS5jb250YWlucyhlLnRhcmdldCkpIHtcbiAgICBjbG9zZUhhbWJ1cmdlcigpO1xuICB9XG59KTtcblxuLy8g4pSA4pSAIGNvbnRyb2xzIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9jb250cm9sc09wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkNvbnRyb2xzTW9kYWwoKSB7XG4gIF9jb250cm9sc09wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250cm9scy1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjY29udHJvbHMtbW9kYWwgLmJ0bicpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VDb250cm9sc01vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udHJvbHMtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9jb250cm9sc09wZW5lcjtcbiAgX2NvbnRyb2xzT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgZGlmZiBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIF9kaWZmU3RhdGU6IHt0aXRsZSwgZmllbGRzOlt7bGFiZWwsY3VycmVudCxwcm9wb3NlZH1dLCBvbkNvbW1pdChhY3Rpb24sIGVkaXRlZFZhbHVlcyl9XG5sZXQgX2RpZmZTdGF0ZSA9IG51bGw7XG5sZXQgX2RpZmZPcGVuZXIgPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gb3BlbkRpZmZNb2RhbCh0aXRsZSwgZmllbGRzLCBvbkNvbW1pdCwgb3B0cyA9IHt9KSB7XG4gIF9kaWZmT3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgX2RpZmZTdGF0ZSA9IHt0aXRsZSwgZmllbGRzLCBvbkNvbW1pdH07XG4gIGNvbnN0IHJldmVydCA9IG9wdHMucmV2ZXJ0TW9kZSB8fCBmYWxzZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwtdGl0bGUnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1maWVsZHMnKTtcbiAgY29udGFpbmVyLmlubmVySFRNTCA9IGZpZWxkcy5tYXAoKGYsIGkpID0+IGBcbiAgICA8ZGl2IGNsYXNzPVwiZGlmZi1maWVsZC1ncm91cFwiPlxuICAgICAgJHtmaWVsZHMubGVuZ3RoID4gMSA/IGA8ZGl2IGNsYXNzPVwiZGlmZi1maWVsZC10aXRsZVwiPiR7ZXNjSHRtbChmLmxhYmVsKX08L2Rpdj5gIDogJyd9XG4gICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1wYW5lbHNcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWxcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1wYW5lbC1sYWJlbFwiPiR7cmV2ZXJ0ID8gJ1lvdXIgRWRpdCcgOiAnQ3VycmVudCd9PC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtY3VycmVudCR7Zi5jdXJyZW50ID8gJycgOiAnIGVtcHR5J31cIj4ke1xuICAgICAgICAgICAgZi5jdXJyZW50ID8gZXNjSHRtbChmLmN1cnJlbnQpIDogJyhub25lIHlldCknXG4gICAgICAgICAgfTwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImRpZmYtcGFuZWxcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGlmZi1wYW5lbC1sYWJlbFwiPiR7cmV2ZXJ0ID8gJ09yaWdpbmFsIChMTE0pJyA6ICdOZXcgLSBlZGl0IGhlcmUsIHRoZW4gY2hvb3NlIGJlbG93J308L2Rpdj5cbiAgICAgICAgICAke3JldmVydFxuICAgICAgICAgICAgPyBgPGRpdiBjbGFzcz1cImRpZmYtY3VycmVudCR7Zi5wcm9wb3NlZCA/ICcnIDogJyBlbXB0eSd9XCI+JHtmLnByb3Bvc2VkID8gZXNjSHRtbChmLnByb3Bvc2VkKSA6ICcobm9uZSknfTwvZGl2PmBcbiAgICAgICAgICAgIDogYDx0ZXh0YXJlYSBjbGFzcz1cImRpZmYtbmV3XCIgaWQ9XCJkaWZmLW5ldy0ke2l9XCIgcm93cz1cIjRcIj4ke2VzY0h0bWwoZi5wcm9wb3NlZCB8fCAnJyl9PC90ZXh0YXJlYT5gXG4gICAgICAgICAgfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PmApLmpvaW4oJycpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1kaXNjYXJkLWJ0bicpLnRleHRDb250ZW50ICAgPSByZXZlcnQgPyAnS2VlcCBNeSBFZGl0JyA6ICdEaXNjYXJkJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtYWNjZXB0LWVkaXQtYnRuJykuc3R5bGUuZGlzcGxheSA9IHJldmVydCA/ICdub25lJyA6ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1hY2NlcHQtbmV3LWJ0bicpLnRleHRDb250ZW50ID0gcmV2ZXJ0ID8gJ1JldmVydCB0byBPcmlnaW5hbCcgOiAnQWNjZXB0IGFzLWlzJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGNvbnN0IGZpcnN0VGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1uZXctMCcpO1xuICAgIGlmIChmaXJzdFRhKSBmaXJzdFRhLmZvY3VzKCk7XG4gICAgZWxzZSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1kaXNjYXJkLWJ0bicpPy5mb2N1cygpO1xuICB9LCA1MCk7XG59XG5cbmZ1bmN0aW9uIF9kaWZmR2V0RWRpdGVkKCkge1xuICByZXR1cm4gKF9kaWZmU3RhdGU/LmZpZWxkcyB8fCBbXSkubWFwKChfLCBpKSA9PiB7XG4gICAgY29uc3QgdGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgZGlmZi1uZXctJHtpfWApO1xuICAgIHJldHVybiB0YSA/IHRhLnZhbHVlIDogJyc7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBfZGlmZkNsb3NlRG9uZSgpIHtcbiAgY29uc3Qgb3BlbmVyID0gX2RpZmZPcGVuZXI7XG4gIF9kaWZmT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG5mdW5jdGlvbiBfZGlmZkFjY2VwdE5ldygpIHtcbiAgY29uc3QgZWRpdGVkID0gX2RpZmZHZXRFZGl0ZWQoKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IGNiID0gX2RpZmZTdGF0ZT8ub25Db21taXQ7XG4gIF9kaWZmU3RhdGUgPSBudWxsO1xuICBfZGlmZk9wZW5lciA9IG51bGw7XG4gIGlmIChjYikgY2IoJ2FjY2VwdF9uZXcnLCBlZGl0ZWQpO1xufVxuXG5mdW5jdGlvbiBfZGlmZkFjY2VwdEVkaXQoKSB7XG4gIGNvbnN0IGVkaXRlZCA9IF9kaWZmR2V0RWRpdGVkKCk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBjb25zdCBjYiA9IF9kaWZmU3RhdGU/Lm9uQ29tbWl0O1xuICBfZGlmZlN0YXRlID0gbnVsbDtcbiAgX2RpZmZPcGVuZXIgPSBudWxsO1xuICBpZiAoY2IpIGNiKCdhY2NlcHRfZWRpdCcsIGVkaXRlZCk7XG59XG5cbmZ1bmN0aW9uIF9kaWZmRGlydHkoKSB7XG4gIHJldHVybiAoX2RpZmZTdGF0ZT8uZmllbGRzIHx8IFtdKS5zb21lKChmLCBpKSA9PiB7XG4gICAgY29uc3QgdGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgZGlmZi1uZXctJHtpfWApO1xuICAgIHJldHVybiB0YSAmJiB0YS52YWx1ZSAhPT0gKGYucHJvcG9zZWQgfHwgJycpO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9kaWZmRGlzY2FyZCgpIHtcbiAgaWYgKCFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGlmZi1tb2RhbCcpLmNsYXNzTGlzdC5jb250YWlucygndmlzaWJsZScpKSByZXR1cm47XG4gIGlmIChfZGlmZkRpcnR5KCkpIHtcbiAgICBzaG93Q29uZmlybShcbiAgICAgICdEaXNjYXJkIGVkaXQ/JyxcbiAgICAgICdZb3UgaGF2ZSB1bnNhdmVkIGNoYW5nZXMuIENsb3NlIHdpdGhvdXQgc2F2aW5nPycsXG4gICAgICAnRGlzY2FyZCcsXG4gICAgICBfZG9EaWZmRGlzY2FyZCxcbiAgICAgIHRydWUsXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cbiAgX2RvRGlmZkRpc2NhcmQoKTtcbn1cblxuZnVuY3Rpb24gX2RvRGlmZkRpc2NhcmQoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLW1vZGFsJykuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuICBfZGlmZlN0YXRlID0gbnVsbDtcbiAgX2RpZmZDbG9zZURvbmUoKTtcbn1cblxuLy8g4pSA4pSAIGZpZWxkIGVkaXQgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2ZpZWxkRWRpdENhbGxiYWNrID0gbnVsbDtcbmxldCBfZmllbGRFZGl0T3JpZ2luYWxWYWx1ZSA9ICcnO1xubGV0IF9maWVsZEVkaXRPcGVuZXIgPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gb3BlbkZpZWxkRWRpdE1vZGFsKHRpdGxlLCBjdXJyZW50VmFsdWUsIG9uU2F2ZSkge1xuICBfZmllbGRFZGl0T3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWUgPSBjdXJyZW50VmFsdWU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRpdGxlJykudGV4dENvbnRlbnQgPSB0aXRsZTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLnZhbHVlID0gY3VycmVudFZhbHVlO1xuICBfZmllbGRFZGl0Q2FsbGJhY2sgPSBvblNhdmU7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS5mb2N1cygpLCA1MCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUZpZWxkRWRpdE1vZGFsKCkge1xuICBpZiAoIWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LW1vZGFsJykuY2xhc3NMaXN0LmNvbnRhaW5zKCd2aXNpYmxlJykpIHJldHVybjtcbiAgY29uc3QgY3VycmVudFZhbHVlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtdGV4dCcpLnZhbHVlO1xuICBpZiAoY3VycmVudFZhbHVlICE9PSBfZmllbGRFZGl0T3JpZ2luYWxWYWx1ZSkge1xuICAgIHNob3dDb25maXJtKFxuICAgICAgJ0Rpc2NhcmQgZWRpdD8nLFxuICAgICAgJ1lvdSBoYXZlIHVuc2F2ZWQgY2hhbmdlcy4gQ2xvc2Ugd2l0aG91dCBzYXZpbmc/JyxcbiAgICAgICdEaXNjYXJkJyxcbiAgICAgIF9kb0Nsb3NlRmllbGRFZGl0TW9kYWwsXG4gICAgICB0cnVlLFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIF9kb0Nsb3NlRmllbGRFZGl0TW9kYWwoKTtcbn1cblxuZnVuY3Rpb24gX2RvQ2xvc2VGaWVsZEVkaXRNb2RhbCgpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIF9maWVsZEVkaXRDYWxsYmFjayA9IG51bGw7XG4gIGNvbnN0IG9wZW5lciA9IF9maWVsZEVkaXRPcGVuZXI7XG4gIF9maWVsZEVkaXRPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbmZ1bmN0aW9uIF9maWVsZEVkaXRTYXZlKCkge1xuICBjb25zdCB2YWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmllbGQtZWRpdC10ZXh0JykudmFsdWU7XG4gIGNvbnN0IGNiID0gX2ZpZWxkRWRpdENhbGxiYWNrO1xuICBfZG9DbG9zZUZpZWxkRWRpdE1vZGFsKCk7XG4gIGlmIChjYikgY2IodmFsKTtcbn1cblxuLy8gUmVmcmVzaC9jbG9zZSB3aXRoIGEgZGlydHkgZWRpdG9yIG9wZW4gd291bGQgc2lsZW50bHkgbG9zZSB0aGUgZWRpdCAtIHRoZVxuLy8gc2FtZSBwcm90ZWN0aW9uIGNsb3NlRmllbGRFZGl0TW9kYWwvX2RpZmZEaXNjYXJkIGdpdmUgRXNjYXBlIGFuZCBEaXNjYXJkLlxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsIGUgPT4ge1xuICBjb25zdCBmaWVsZEVkaXREaXJ0eSA9XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtbW9kYWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSAmJlxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdmaWVsZC1lZGl0LXRleHQnKS52YWx1ZSAhPT0gX2ZpZWxkRWRpdE9yaWdpbmFsVmFsdWU7XG4gIGNvbnN0IGRpZmZEaXJ0eSA9XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtbW9kYWwnKS5jbGFzc0xpc3QuY29udGFpbnMoJ3Zpc2libGUnKSAmJiBfZGlmZkRpcnR5KCk7XG4gIGlmIChmaWVsZEVkaXREaXJ0eSB8fCBkaWZmRGlydHkpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5yZXR1cm5WYWx1ZSA9ICcnO1xuICB9XG59KTtcblxuLy8g4pSA4pSAIGtlYmFiIG1lbnVzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9hY3RpdmVLZWJhYiA9IG51bGw7XG5sZXQgX2FjdGl2ZUtlYmFiQW5jaG9yID0gbnVsbDtcbmxldCBfa2ViYWJEaXNtaXNzID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlS2ViYWIocmVmb2N1c0FuY2hvciA9IGZhbHNlKSB7XG4gIGlmICghX2FjdGl2ZUtlYmFiKSByZXR1cm4gZmFsc2U7XG4gIF9hY3RpdmVLZWJhYi5yZW1vdmUoKTtcbiAgX2FjdGl2ZUtlYmFiID0gbnVsbDtcbiAgaWYgKF9rZWJhYkRpc21pc3MpIHsgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2xpY2snLCBfa2ViYWJEaXNtaXNzKTsgX2tlYmFiRGlzbWlzcyA9IG51bGw7IH1cbiAgY29uc3QgYW5jaG9yID0gX2FjdGl2ZUtlYmFiQW5jaG9yO1xuICBfYWN0aXZlS2ViYWJBbmNob3IgPSBudWxsO1xuICBpZiAoYW5jaG9yPy5oYXNBdHRyaWJ1dGU/LignYXJpYS1oYXNwb3B1cCcpKSBhbmNob3Iuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG4gIGlmIChyZWZvY3VzQW5jaG9yICYmIGFuY2hvcj8uZm9jdXMpIGFuY2hvci5mb2N1cygpO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dLZWJhYihhbmNob3JFbCwgaXRlbXMpIHtcbiAgY2xvc2VLZWJhYigpO1xuICBjb25zdCBtZW51ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIG1lbnUuY2xhc3NOYW1lID0gJ2hhbWJ1cmdlci1tZW51IG9wZW4nO1xuICAvLyByaWdodDphdXRvIGNsZWFycyB0aGUgLmhhbWJ1cmdlci1tZW51IGJhc2UgcnVsZSdzIHJpZ2h0OjAgLSBvdGhlcndpc2UgdGhlXG4gIC8vIGZpeGVkIG1lbnUsIHdpdGggYm90aCBsZWZ0IGFuZCByaWdodCBzZXQsIHN0cmV0Y2hlcyB0byB0aGUgdmlld3BvcnQgZWRnZS5cbiAgbWVudS5zdHlsZS5jc3NUZXh0ID0gJ3Bvc2l0aW9uOmZpeGVkO3otaW5kZXg6NTAwO21pbi13aWR0aDoxNjBweDtyaWdodDphdXRvJztcbiAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgaWYgKGl0ZW0gPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IHNlcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgc2VwLmNsYXNzTmFtZSA9ICdoYW1idXJnZXItZGl2aWRlcic7XG4gICAgICBtZW51LmFwcGVuZENoaWxkKHNlcCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgY29uc3QgYnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgYnRuLmNsYXNzTmFtZSA9ICdoYW1idXJnZXItaXRlbSc7XG4gICAgYnRuLnRleHRDb250ZW50ID0gaXRlbS5sYWJlbDtcbiAgICBpZiAoaXRlbS5kaXNhYmxlZCkgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgICAvLyBSZWZvY3VzIHRoZSBhbmNob3IgYmVmb3JlIHRoZSBhY3Rpb24gcnVucyBzbyBhbnl0aGluZyB0aGUgYWN0aW9uIG9wZW5zXG4gICAgLy8gcmVjb3JkcyB0aGUgYW5jaG9yIC0gbm90IGEgcmVtb3ZlZCBtZW51IGl0ZW0gLSBhcyBpdHMgcmV0dXJuLWZvY3VzIHRhcmdldC5cbiAgICBidG4ub25jbGljayA9ICgpID0+IHsgY2xvc2VLZWJhYih0cnVlKTsgaXRlbS5hY3Rpb24oKTsgfTtcbiAgICBtZW51LmFwcGVuZENoaWxkKGJ0bik7XG4gIH1cbiAgbWVudS5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiBfbWVudUFycm93S2V5ZG93bihtZW51LCBlKSk7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobWVudSk7XG4gIF9hY3RpdmVLZWJhYiA9IG1lbnU7XG4gIF9hY3RpdmVLZWJhYkFuY2hvciA9IGFuY2hvckVsO1xuICBpZiAoYW5jaG9yRWw/Lmhhc0F0dHJpYnV0ZT8uKCdhcmlhLWhhc3BvcHVwJykpIGFuY2hvckVsLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XG5cbiAgY29uc3QgcmVjdCA9IGFuY2hvckVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBsZXQgdG9wICA9IHJlY3QuYm90dG9tICsgNDtcbiAgbGV0IGxlZnQgPSByZWN0LnJpZ2h0IC0gbWVudS5vZmZzZXRXaWR0aDtcbiAgaWYgKGxlZnQgPCA0KSBsZWZ0ID0gcmVjdC5sZWZ0O1xuICBjb25zdCBtZW51SCA9IG1lbnUub2Zmc2V0SGVpZ2h0O1xuICBpZiAodG9wICsgbWVudUggPiB3aW5kb3cuaW5uZXJIZWlnaHQpIHRvcCA9IHJlY3QudG9wIC0gbWVudUg7XG4gIG1lbnUuc3R5bGUudG9wICA9IHRvcCAgKyAncHgnO1xuICBtZW51LnN0eWxlLmxlZnQgPSBsZWZ0ICsgJ3B4JztcblxuICBfbWVudUZvY3VzYWJsZUl0ZW1zKG1lbnUpWzBdPy5mb2N1cygpO1xuXG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmIChfYWN0aXZlS2ViYWIgIT09IG1lbnUpIHJldHVybjsgIC8vIGFscmVhZHkgY2xvc2VkIChlLmcuIGltbWVkaWF0ZSBFc2NhcGUpXG4gICAgY29uc3QgZGlzbWlzcyA9IGUgPT4ge1xuICAgICAgaWYgKG1lbnUuY29udGFpbnMoZS50YXJnZXQpKSByZXR1cm47XG4gICAgICBjbG9zZUtlYmFiKCk7XG4gICAgfTtcbiAgICBfa2ViYWJEaXNtaXNzID0gZGlzbWlzcztcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGRpc21pc3MpO1xuICB9LCAwKTtcbn1cblxuLy8g4pSA4pSAIHBhbmUgcmVzaXplIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuY29uc3QgX1BBTkVfS0VZID0gJ3l1dWNsaXAtcGFuZS1zaXplcyc7XG5cbmZ1bmN0aW9uIF9sb2FkUGFuZVNpemVzKCkge1xuICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShfUEFORV9LRVkpIHx8ICd7fScpOyB9IGNhdGNoIHsgcmV0dXJuIHt9OyB9XG59XG5cbmZ1bmN0aW9uIF9zYXZlUGFuZVNpemUoa2V5LCB2YWwpIHtcbiAgY29uc3QgcyA9IF9sb2FkUGFuZVNpemVzKCk7XG4gIHNba2V5XSA9IHZhbDtcbiAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oX1BBTkVfS0VZLCBKU09OLnN0cmluZ2lmeShzKSk7XG59XG5cbmZ1bmN0aW9uIF9tYWtlRHJhZ0hhbmRsZShpZCwgb25TdGFydCkge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBlID0+IHtcbiAgICBpZiAoZS5idXR0b24gIT09IDApIHJldHVybjtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZWwuY2xhc3NMaXN0LmFkZCgnZHJhZ2dpbmcnKTtcbiAgICBjb25zdCBvbk1vdmUgPSBvblN0YXJ0KGUpO1xuICAgIGNvbnN0IG9uVXAgPSAoKSA9PiB7XG4gICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnZ2luZycpO1xuICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgb25Nb3ZlKTtcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBvblVwKTtcbiAgICB9O1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIG9uTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIG9uVXApO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluaXRSZXNpemUoKSB7XG4gIGNvbnN0IHJvb3QgICAgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG4gIGNvbnN0IHNpemVzICAgPSBfbG9hZFBhbmVTaXplcygpO1xuXG4gIGlmIChzaXplcy5zaWRlYmFyV2lkdGgpICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1zaWRlYmFyLXdpZHRoJywgICAgICAgc2l6ZXMuc2lkZWJhcldpZHRoICsgJ3B4Jyk7XG4gIGlmIChzaXplcy52aWRlb3NIZWlnaHQpICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12aWRlb3MtZ3JvdXAtaGVpZ2h0Jywgc2l6ZXMudmlkZW9zSGVpZ2h0ICsgJ3B4Jyk7XG4gIGlmIChzaXplcy5wbGF5ZXJNYXhIKSAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wbGF5ZXItbWF4LWhlaWdodCcsICAgc2l6ZXMucGxheWVyTWF4SCArICdweCcpO1xuICBpZiAoc2l6ZXMubG9nTWF4SCkgICAgICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJy0tbG9nLW1heC1oZWlnaHQnLCAgICAgICBzaXplcy5sb2dNYXhIICsgJ3B4Jyk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCdzaWRlYmFyLXJlc2l6ZS1oYW5kbGUnLCBzdGFydEUgPT4ge1xuICAgIGNvbnN0IHN0YXJ0WCAgPSBzdGFydEUuY2xpZW50WDtcbiAgICBjb25zdCBzaWRlYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNpZGViYXInKTtcbiAgICBjb25zdCBzdGFydFcgID0gc2lkZWJhci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aDtcbiAgICByZXR1cm4gbW92ZUUgPT4ge1xuICAgICAgY29uc3QgdyA9IE1hdGgubWF4KDE2MCwgTWF0aC5taW4oNDgwLCBzdGFydFcgKyBtb3ZlRS5jbGllbnRYIC0gc3RhcnRYKSk7XG4gICAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCctLXNpZGViYXItd2lkdGgnLCB3ICsgJ3B4Jyk7XG4gICAgICBfc2F2ZVBhbmVTaXplKCdzaWRlYmFyV2lkdGgnLCB3KTtcbiAgICB9O1xuICB9KTtcblxuICBfbWFrZURyYWdIYW5kbGUoJ3ZpZGVvcy1jbGlwcy1yZXNpemUtaGFuZGxlJywgc3RhcnRFID0+IHtcbiAgICBjb25zdCBzdGFydFkgID0gc3RhcnRFLmNsaWVudFk7XG4gICAgY29uc3QgdmcgICAgICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zaWRlYmFyLWdyb3VwLnZpZGVvcy1ncm91cCcpO1xuICAgIGNvbnN0IHNpZGViYXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2lkZWJhcicpO1xuICAgIGNvbnN0IHN0YXJ0SCAgPSB2Zy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IG1heEggPSBzaWRlYmFyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCAtIDEyMDtcbiAgICAgIGNvbnN0IGggPSBNYXRoLm1heCg0MCwgTWF0aC5taW4obWF4SCwgc3RhcnRIICsgbW92ZUUuY2xpZW50WSAtIHN0YXJ0WSkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12aWRlb3MtZ3JvdXAtaGVpZ2h0JywgaCArICdweCcpO1xuICAgICAgX3NhdmVQYW5lU2l6ZSgndmlkZW9zSGVpZ2h0JywgaCk7XG4gICAgfTtcbiAgfSk7XG5cbiAgX21ha2VEcmFnSGFuZGxlKCdwbGF5ZXItcmVzaXplLWhhbmRsZScsIHN0YXJ0RSA9PiB7XG4gICAgY29uc3Qgc3RhcnRZID0gc3RhcnRFLmNsaWVudFk7XG4gICAgY29uc3QgcGEgICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllci1hcmVhJyk7XG4gICAgY29uc3QgbWFpbiAgID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm1haW4nKTtcbiAgICBjb25zdCBzdGFydEggPSBwYS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQ7XG4gICAgcmV0dXJuIG1vdmVFID0+IHtcbiAgICAgIGNvbnN0IG1heEggPSBtYWluLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCAtIDEwMDtcbiAgICAgIGNvbnN0IGggPSBNYXRoLm1heCg4MCwgTWF0aC5taW4obWF4SCwgc3RhcnRIICsgbW92ZUUuY2xpZW50WSAtIHN0YXJ0WSkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1wbGF5ZXItbWF4LWhlaWdodCcsIGggKyAncHgnKTtcbiAgICAgIF9zYXZlUGFuZVNpemUoJ3BsYXllck1heEgnLCBoKTtcbiAgICB9O1xuICB9KTtcblxuICBfbWFrZURyYWdIYW5kbGUoJ2xvZy1yZXNpemUtaGFuZGxlJywgc3RhcnRFID0+IHtcbiAgICBjb25zdCBzdGFydFkgPSBzdGFydEUuY2xpZW50WTtcbiAgICBjb25zdCBsYiAgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9nLWJvZHknKTtcbiAgICBjb25zdCBzdGFydEggPSBsYi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgfHwgMDtcbiAgICByZXR1cm4gbW92ZUUgPT4ge1xuICAgICAgY29uc3QgaCA9IE1hdGgubWF4KDQwLCBNYXRoLm1pbig2MDAsIHN0YXJ0SCAtIChtb3ZlRS5jbGllbnRZIC0gc3RhcnRZKSkpO1xuICAgICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1sb2ctbWF4LWhlaWdodCcsIGggKyAncHgnKTtcbiAgICAgIF9zYXZlUGFuZVNpemUoJ2xvZ01heEgnLCBoKTtcbiAgICB9O1xuICB9KTtcbn1cblxuLy8g4pSA4pSAIHByZXJlcSB3YXJuaW5ncyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbmV4cG9ydCBmdW5jdGlvbiBfYXBwbHlQcmVyZXFXYXJuaW5ncyhwcmVyZXFzKSB7XG4gIGNvbnN0IGluRWxlY3Ryb24gPSAhIXdpbmRvdy5lbGVjdHJvbkFQSTtcbiAgY29uc3Qgd2l6YXJkTGluayA9IGluRWxlY3Ryb25cbiAgICA/ICcgPGEgaHJlZj1cIiNcIiBvbmNsaWNrPVwid2luZG93LmVsZWN0cm9uQVBJLnJ1blNldHVwV2l6YXJkKCk7cmV0dXJuIGZhbHNlXCIgc3R5bGU9XCJjb2xvcjp2YXIoLS13YXJuaW5nKVwiPlJlLXJ1biBTZXR1cCBXaXphcmQ8L2E+J1xuICAgIDogJyc7XG5cbiAgY29uc3QgYmFubmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ByZXJlcS1iYW5uZXInKTtcbiAgaWYgKCFiYW5uZXIpIHJldHVybjtcblxuICBpZiAoIXByZXJlcXMuZmZtcGVnX29rKSB7XG4gICAgYmFubmVyLmlubmVySFRNTCA9IGA8c3Bhbj7imqAgRkZtcGVnIG5vdCBmb3VuZCAtIGFuYWx5c2lzIGFuZCBleHBvcnQgd2lsbCBmYWlsLiR7d2l6YXJkTGlua308L3NwYW4+YDtcbiAgICBiYW5uZXIuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tc3RhcnQtYW5hbHl6ZScpO1xuICAgIGlmIChidG4pIHtcbiAgICAgIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICBidG4udGl0bGUgPSAnRkZtcGVnIG5vdCBmb3VuZCAtIFJlLXJ1biBTZXR1cCBXaXphcmQgdG8gaW5zdGFsbCBpdCc7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXByZXJlcXMubGxtX29rICYmIGluRWxlY3Ryb24pIHtcbiAgICBiYW5uZXIuaW5uZXJIVE1MID0gYDxzcGFuPuKEuSBMTE0gc2NvcmluZyBpcyBub3QgY29uZmlndXJlZCAtIGNsaXBzIHdpbGwgYmUgc2NvcmVkIGJ5IGVuZXJneSBhbmQgc2NlbmVzIG9ubHkuJHt3aXphcmRMaW5rfTwvc3Bhbj5gO1xuICAgIGJhbm5lci5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIFByZXJlcXVpc2l0ZXMgc2F0aXNmaWVkIC0gY2xlYXIgYW55IGJhbm5lciBzaG93biBieSBhbiBlYXJsaWVyIHN0YXRlLiBXaXRob3V0XG4gIC8vIHRoaXMsIGEgcmUtY2hlY2sgYWZ0ZXIgdGhlIG1vZGVsIGlzIHNldCB1cCAocmVmcmVzaFNlcnZlclN0YXRlKSBjb3VsZCBuZXZlclxuICAvLyBoaWRlIGEgc3RhbGUgd2FybmluZy5cbiAgYmFubmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGJhbm5lci5pbm5lckhUTUwgPSAnJztcbn1cblxuLy8g4pSA4pSAIHVuZG8gdG9hc3QgKGF1dG8tZGlzbWlzcywgc2luZ2xlIFVuZG8gYnV0dG9uKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIEEgdHJhbnNpZW50IHRvYXN0IGNhcnJ5aW5nIGFuIFVuZG8gYWN0aW9uLCB1c2VkIGJ5IHJldmVyc2libGUgY2xpcCBvcGVyYXRpb25zXG4vLyAoc2luZ2xlL2J1bGsgc3RhdHVzIGNoYW5nZXMpLiBUaGUgc2hyaW5raW5nIGJhciBtYWtlcyB0aGUgfjVzIHdpbmRvdyB2aXNpYmxlXG4vLyBzbyB0aGUgdW5kbyBhZmZvcmRhbmNlIGRvZXMgbm90IGV4cGlyZSBzaWxlbnRseS4gR2VuZXJpYyBVSSwgc28gaXQgbGl2ZXMgaGVyZVxuLy8gcmF0aGVyIHRoYW4gaW4gYSBmZWF0dXJlIG1vZHVsZS5cbmNvbnN0IFVORE9fVE9BU1RfTVMgPSA1MDAwO1xuXG5leHBvcnQgZnVuY3Rpb24gc2hvd1VuZG9Ub2FzdChtZXNzYWdlLCB1bmRvRm4pIHtcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3RvYXN0LWNvbnRhaW5lcicpO1xuICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdC5jbGFzc05hbWUgPSAndG9hc3QgaW5mbyB1bmRvLXRvYXN0JztcbiAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHJvdy5jbGFzc05hbWUgPSAndW5kby10b2FzdC1yb3cnO1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYnRuLmNsYXNzTmFtZSA9ICd1bmRvLXRvYXN0LWJ0bic7XG4gIGJ0bi50ZXh0Q29udGVudCA9ICdVbmRvJztcbiAgYnRuLm9uY2xpY2sgPSAoKSA9PiB7IHRvYXN0LnJlbW92ZSgpOyB1bmRvRm4oKTsgfTtcbiAgcm93LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG1lc3NhZ2UpKTtcbiAgcm93LmFwcGVuZENoaWxkKGJ0bik7XG4gIGNvbnN0IGJhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBiYXIuY2xhc3NOYW1lID0gJ3VuZG8tdG9hc3QtYmFyJztcbiAgYmFyLnN0eWxlLmFuaW1hdGlvbkR1cmF0aW9uID0gVU5ET19UT0FTVF9NUyArICdtcyc7XG4gIHRvYXN0LmFwcGVuZENoaWxkKHJvdyk7XG4gIHRvYXN0LmFwcGVuZENoaWxkKGJhcik7XG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0b2FzdCk7XG4gIHNldFRpbWVvdXQoKCkgPT4gdG9hc3QucmVtb3ZlKCksIFVORE9fVE9BU1RfTVMpO1xufVxuXG4vLyBHbG9iYWwgcGxheWJhY2stc3BlZWQgcHJlZmVyZW5jZSAtIG9uZSBjYXB0dXJlLXBoYXNlIGxpc3RlbmVyIGFwcGxpZXMgdGhlIHNhdmVkXG4vLyByYXRlIHRvIGV2ZXJ5IDx2aWRlbz4gYXMgaXQgbG9hZHMsIHNvIGFsbCBwbGF5ZXJzIChjbGlwIHByZXZpZXcsIHJlY29yZGluZyxcbi8vIHNwbGl0L2V4cG9ydCBlZGl0b3JzLCByZWVscykgaG9ub3IgaXQgd2l0aG91dCBwZXItcGxheWVyIHdpcmluZy4gQ2xpZW50LW9ubHksXG4vLyBzdG9yZWQgaW4gbG9jYWxTdG9yYWdlIGxpa2UgdGhlIG90aGVyIHBsYXliYWNrIHByZWZzLlxuZXhwb3J0IGZ1bmN0aW9uIHBsYXliYWNrUmF0ZVByZWYoKSB7XG4gIGNvbnN0IHJhdGUgPSBwYXJzZUZsb2F0KGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd5dXVjbGlwLXBsYXliYWNrLXJhdGUnKSk7XG4gIHJldHVybiBOdW1iZXIuaXNGaW5pdGUocmF0ZSkgJiYgcmF0ZSA+IDAgPyByYXRlIDogMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5UGxheWJhY2tSYXRlKHJhdGUpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndmlkZW8nKS5mb3JFYWNoKHZpZGVvID0+IHsgdmlkZW8ucGxheWJhY2tSYXRlID0gcmF0ZTsgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbml0UGxheWJhY2tSYXRlKCkge1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIGUgPT4ge1xuICAgIGlmIChlLnRhcmdldCAmJiBlLnRhcmdldC50YWdOYW1lID09PSAnVklERU8nKSBlLnRhcmdldC5wbGF5YmFja1JhdGUgPSBwbGF5YmFja1JhdGVQcmVmKCk7XG4gIH0sIHRydWUpO1xufVxuXG4vLyDilIDilIAgc3RhdGljIG1vZGFsL2hhbWJ1cmdlciB3aXJpbmcgKHJlcGxhY2VzIHRoZSBpbmxpbmUgb25jbGljaz0gdGhpcyBtb2R1bGUgdXNlZFxuLy8gdG8gb3duIGluIGluZGV4Lmh0bWwpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuLy8gVGhlc2UgYXJlIGZpeGVkLCBuZXZlci1yZWNyZWF0ZWQgZWxlbWVudHMgaW4gaW5kZXguaHRtbCwgc28gd2lyaW5nIHRoZW0gb25jZSBhdFxuLy8gbW9kdWxlIGxvYWQgKGJlbG93KSBjYW4ndCBkb3VibGUtZmlyZSBvbiBhIHJlLXJlbmRlciB0aGUgd2F5IGEgZHluYW1pY2FsbHlcbi8vIHJlbmRlcmVkIGxpc3QgY291bGQuXG5jb25zdCBfQkdfRElTTUlTU19NT0RBTFMgPSBbXG4gIFsnYWxlcnQtbW9kYWwnLCBjbG9zZUFsZXJ0TW9kYWxdLFxuICBbJ2NvbmZpcm0tbW9kYWwnLCBfY29uZmlybUNhbmNlbF0sXG4gIFsnYWN0aW9ucy1tb2RhbCcsIGNsb3NlQWN0aW9uc01vZGFsXSxcbiAgWydjb250cm9scy1tb2RhbCcsIGNsb3NlQ29udHJvbHNNb2RhbF0sXG4gIFsnZGlmZi1tb2RhbCcsIF9kaWZmRGlzY2FyZF0sXG4gIFsnZmllbGQtZWRpdC1tb2RhbCcsIGNsb3NlRmllbGRFZGl0TW9kYWxdLFxuXTtcblxuZnVuY3Rpb24gX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpIHtcbiAgZm9yIChjb25zdCBbbW9kYWxJZCwgY2xvc2VGbl0gb2YgX0JHX0RJU01JU1NfTU9EQUxTKSB7XG4gICAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtb2RhbElkKTtcbiAgICBtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IG1vZGFsKSBjbG9zZUZuKCk7IH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCdXR0b25zKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWxlcnQtb2stYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUFsZXJ0TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtLWNhbmNlbC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9jb25maXJtQ2FuY2VsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybS1vay1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9jb25maXJtT2soKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3Rpb25zLW1vZGFsLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VBY3Rpb25zTW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250cm9scy1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlQ29udHJvbHNNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtZGlzY2FyZC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9kaWZmRGlzY2FyZCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RpZmYtYWNjZXB0LWVkaXQtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZGlmZkFjY2VwdEVkaXQoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkaWZmLWFjY2VwdC1uZXctYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBfZGlmZkFjY2VwdE5ldygpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtY2FuY2VsLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VGaWVsZEVkaXRNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZpZWxkLWVkaXQtc2F2ZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IF9maWVsZEVkaXRTYXZlKCkpO1xufVxuXG4vLyBcIkNvbnRyb2xzXCIgYW5kIFwiRG93bmxvYWQgTG9nXCIgYXJlIHdpcmVkIGhlcmUgYmVjYXVzZSB0aGVpciBvbmNsaWNrPSBjYWxsZWRcbi8vIG9ubHkgdWkuanMgZnVuY3Rpb25zLiBUaGUgR2V0dGluZyBTdGFydGVkIC8gR2xvc3NhcnkgLyBIZWxwIC8gQWJvdXQgaXRlbXMgY2FsbFxuLy8gY2xvc2VIYW1idXJnZXIoKSAodWkuanMpIHBsdXMgYSBoZWxwbW9kYWxzLmpzIG1vZGFsLW9wZW4sIHNvIGhlbHBtb2RhbHMuanMgb3duc1xuLy8gdGhlaXIgZGVsZWdhdGlvbi4gXCJSZS1ydW4gU2V0dXAgV2l6YXJkXCIgYW5kIFwiUmVmcmVzaFwiIChlbGVjdHJvbkFQSSAvIGxvY2F0aW9uKVxuLy8gcmVtYWluIGlubGluZSB1bnRpbCB0aGVpciBvd25pbmcgY29kZSBtaWdyYXRlcy5cbmZ1bmN0aW9uIF93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4taGFtYnVyZ2VyJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0b2dnbGVIYW1idXJnZXIoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1jb250cm9scycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIGNsb3NlSGFtYnVyZ2VyKCk7XG4gICAgb3BlbkNvbnRyb2xzTW9kYWwoKTtcbiAgfSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoYW1idXJnZXItaXRlbS1kb3dubG9hZC1sb2cnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlSGFtYnVyZ2VyKCkpO1xufVxuXG5fd2lyZU1vZGFsQmdEaXNtaXNzYWxzKCk7XG5fd2lyZU1vZGFsQnV0dG9ucygpO1xuX3dpcmVIYW1idXJnZXJIYW5kbGVycygpO1xuIiwgIi8vIEZlYXR1cmUtbWFwIC0gdGhlIHRocmVlIGFwcC1nbG9iYWwgaGVscC9pbmZvIG1vZGFscyAoR2V0dGluZyBTdGFydGVkLCBBYm91dCxcbi8vIEdsb3NzYXJ5KS4gRXh0cmFjdGVkIG91dCBvZiBzZXR0aW5ncy5qcyAod2hpY2ggZ3JldyBpbnRvIGEgY2F0Y2gtYWxsKSAtIHRoZXNlXG4vLyBoYXZlIG5vIGNvdXBsaW5nIHRvIHRoZSBzZXR0aW5ncyBzYXZlL2RpcnR5IG1hY2hpbmVyeS5cbi8vICAgQVBJOiByb3V0ZXMvY29uZmlnLnB5IChnbG9zc2FyeSkgwrcgVGVzdHM6IHRlc3RzL3VpL3Rlc3RfdWlfc2V0dGluZ3MucHksIHRlc3RzL3VpL3Rlc3RfdWlfcGFnZS5weSwgdGVzdHMvdWkvdGVzdF91aV9rZXlib2FyZC5weVxuXG4vLyDilIDilIAgZ2V0dGluZyBzdGFydGVkIG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9nZXR0aW5nU3RhcnRlZE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkdldHRpbmdTdGFydGVkTW9kYWwoKSB7XG4gIF9nZXR0aW5nU3RhcnRlZE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwnKS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG4gIHNldFRpbWVvdXQoKCkgPT4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2dldHRpbmctc3RhcnRlZC1tb2RhbCAuYnRuJyk/LmZvY3VzKCksIDUwKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZXR0aW5nLXN0YXJ0ZWQtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCd5dXUtZ2V0dGluZy1zdGFydGVkLXNlZW4nLCAnMScpO1xuICBjb25zdCBvcGVuZXIgPSBfZ2V0dGluZ1N0YXJ0ZWRPcGVuZXI7XG4gIF9nZXR0aW5nU3RhcnRlZE9wZW5lciA9IG51bGw7XG4gIGlmIChvcGVuZXI/LmZvY3VzKSBvcGVuZXIuZm9jdXMoKTtcbn1cblxuLy8g4pSA4pSAIGFib3V0IG1vZGFsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxubGV0IF9hYm91dE9wZW5lciA9IG51bGw7XG5leHBvcnQgZnVuY3Rpb24gb3BlbkFib3V0TW9kYWwoKSB7XG4gIF9hYm91dE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhYm91dC1tb2RhbCcpLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcbiAgc2V0VGltZW91dCgoKSA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjYWJvdXQtbW9kYWwgLmJ0bicpPy5mb2N1cygpLCA1MCk7XG59XG5leHBvcnQgZnVuY3Rpb24gY2xvc2VBYm91dE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWJvdXQtbW9kYWwnKS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG4gIGNvbnN0IG9wZW5lciA9IF9hYm91dE9wZW5lcjtcbiAgX2Fib3V0T3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgaGVscCAmIGd1aWRlcyBtb2RhbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIExpbmtzIG91dCB0byB0aGUgR2l0SHViIGRvY3MvdXNlci8gcGFnZXMgcmF0aGVyIHRoYW4gYnVuZGxpbmcgY29waWVzOiB0aGUgYXBwXG4vLyBzaGlwcyB0aGUgd2hlZWwgKHdoaWNoIGNhcnJpZXMgc3RhdGljL2dsb3NzYXJ5Lm1kKSBidXQgbm90IGRvY3MvdXNlci8sIGFuZCBhXG4vLyBidW5kbGVkIDY1MC1saW5lIGZlYXR1cmUgZ3VpZGUgd291bGQgZHJpZnQgZnJvbSB0aGUgVUkuIEluIHRoZSBwYWNrYWdlZCBhcHBcbi8vIHRoZXNlIHRhcmdldD1fYmxhbmsgbGlua3Mgb3BlbiBpbiB0aGUgc3lzdGVtIGJyb3dzZXIgdmlhIHNldFdpbmRvd09wZW5IYW5kbGVyLlxubGV0IF9oZWxwT3BlbmVyID0gbnVsbDtcbmV4cG9ydCBmdW5jdGlvbiBvcGVuSGVscE1vZGFsKCkge1xuICBfaGVscE9wZW5lciA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWxwLW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBzZXRUaW1lb3V0KCgpID0+IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNoZWxwLW1vZGFsIC5idG4nKT8uZm9jdXMoKSwgNTApO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlSGVscE1vZGFsKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVscC1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2hlbHBPcGVuZXI7XG4gIF9oZWxwT3BlbmVyID0gbnVsbDtcbiAgaWYgKG9wZW5lcj8uZm9jdXMpIG9wZW5lci5mb2N1cygpO1xufVxuXG4vLyDilIDilIAgZ2xvc3NhcnkgbW9kYWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5sZXQgX2dsb3NzYXJ5T3BlbmVyID0gbnVsbDtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuR2xvc3NhcnlNb2RhbCgpIHtcbiAgX2dsb3NzYXJ5T3BlbmVyID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LW1vZGFsJykuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuICBjb25zdCBmaWx0ZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktZmlsdGVyJyk7XG4gIGZpbHRlci52YWx1ZSA9ICcnO1xuICBzZXRUaW1lb3V0KCgpID0+IGZpbHRlci5mb2N1cygpLCA1MCk7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWNvbnRlbnQnKTtcbiAgaWYgKGVsLmRhdGFzZXQubG9hZGVkKSB7IF9maWx0ZXJHbG9zc2FyeSgnJyk7IHJldHVybjsgfVxuICB0cnkge1xuICAgIGNvbnN0IG1kID0gYXdhaXQgZmV0Y2goJy9hcGkvZ2xvc3NhcnknKS50aGVuKHIgPT4gci50ZXh0KCkpO1xuICAgIGVsLmlubmVySFRNTCA9IF9yZW5kZXJHbG9zc2FyeU1kKG1kKTtcbiAgICBlbC5kYXRhc2V0LmxvYWRlZCA9ICcxJztcbiAgfSBjYXRjaCAoZSkge1xuICAgIGVsLmlubmVySFRNTCA9ICc8ZGl2IHN0eWxlPVwiY29sb3I6dmFyKC0tcmVkKVwiPkZhaWxlZCB0byBsb2FkIGdsb3NzYXJ5LjwvZGl2Pic7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIF9maWx0ZXJHbG9zc2FyeShxdWVyeSkge1xuICBjb25zdCBxID0gcXVlcnkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGNvbnRlbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3NhcnktY29udGVudCcpO1xuICBsZXQgYW55VmlzaWJsZSA9IGZhbHNlO1xuICBjb250ZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5nbG9zc2FyeS10ZXJtJykuZm9yRWFjaCh0ZXJtID0+IHtcbiAgICBjb25zdCBzaG93ID0gIXEgfHwgdGVybS50ZXh0Q29udGVudC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpO1xuICAgIHRlcm0uc3R5bGUuZGlzcGxheSA9IHNob3cgPyAnJyA6ICdub25lJztcbiAgICBpZiAoc2hvdykgYW55VmlzaWJsZSA9IHRydWU7XG4gIH0pO1xuICBjb250ZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5nbG9zc2FyeS1zZWN0aW9uJykuZm9yRWFjaChzZWN0aW9uID0+IHtcbiAgICBjb25zdCB0ZXJtcyA9IEFycmF5LmZyb20oc2VjdGlvbi5xdWVyeVNlbGVjdG9yQWxsKCcuZ2xvc3NhcnktdGVybScpKTtcbiAgICBjb25zdCBzaG93ID0gIXEgfHwgdGVybXMuc29tZSh0ID0+IHQuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnKTtcbiAgICBzZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBzaG93ID8gJycgOiAnbm9uZSc7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2xvc3Nhcnktbm8tbWF0Y2hlcycpLnN0eWxlLmRpc3BsYXkgPSAocSAmJiAhYW55VmlzaWJsZSkgPyAnJyA6ICdub25lJztcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZUdsb3NzYXJ5TW9kYWwoKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1tb2RhbCcpLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUnKTtcbiAgY29uc3Qgb3BlbmVyID0gX2dsb3NzYXJ5T3BlbmVyO1xuICBfZ2xvc3NhcnlPcGVuZXIgPSBudWxsO1xuICBpZiAob3BlbmVyPy5mb2N1cykgb3BlbmVyLmZvY3VzKCk7XG59XG5cbmZ1bmN0aW9uIF9yZW5kZXJHbG9zc2FyeU1kKG1kKSB7XG4gIGNvbnN0IGxpbmVzID0gbWQuc3BsaXQoJ1xcbicpO1xuICBsZXQgaHRtbCA9ICcnO1xuICBsZXQgaW5MaXN0ID0gZmFsc2U7XG4gIGxldCBpblRhYmxlID0gZmFsc2U7XG4gIGxldCB0YWJsZUhlYWQgPSBmYWxzZTtcbiAgbGV0IGluU2VjdGlvbiA9IGZhbHNlO1xuICBsZXQgaW5UZXJtID0gZmFsc2U7XG5cbiAgY29uc3QgaW5saW5lID0gcyA9PiBzXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKVxuICAgIC5yZXBsYWNlKC9gKFteYF0rKWAvZywgJzxjb2RlPiQxPC9jb2RlPicpXG4gICAgLnJlcGxhY2UoL1xcKlxcKihbXipdKylcXCpcXCovZywgJzxzdHJvbmc+JDE8L3N0cm9uZz4nKVxuICAgIC5yZXBsYWNlKC9cXCooW14qXSspXFwqL2csICc8ZW0+JDE8L2VtPicpO1xuXG4gIGNvbnN0IGNsb3NlTGlzdCAgPSAoKSA9PiB7IGlmIChpbkxpc3QpICB7IGh0bWwgKz0gJzwvdWw+JzsgICBpbkxpc3QgID0gZmFsc2U7IH0gfTtcbiAgY29uc3QgY2xvc2VUYWJsZSA9ICgpID0+IHsgaWYgKGluVGFibGUpIHsgaHRtbCArPSAnPC90Ym9keT48L3RhYmxlPic7IGluVGFibGUgPSBmYWxzZTsgdGFibGVIZWFkID0gZmFsc2U7IH0gfTtcbiAgLy8gU2VjdGlvbiAoIyMpIGFuZCB0ZXJtICgjIyMpIHdyYXBwZXIgZGl2cyBhcmUgdGhlIHVuaXRzIHRoZSBnbG9zc2FyeSBmaWx0ZXJcbiAgLy8gc2hvd3MvaGlkZXMgLSBldmVyeSAjIyMgYmxvY2sgbXVzdCBsYW5kIGluc2lkZSBleGFjdGx5IG9uZSAuZ2xvc3NhcnktdGVybS5cbiAgY29uc3QgY2xvc2VUZXJtICAgID0gKCkgPT4geyBpZiAoaW5UZXJtKSAgICB7IGh0bWwgKz0gJzwvZGl2Pic7IGluVGVybSAgICA9IGZhbHNlOyB9IH07XG4gIGNvbnN0IGNsb3NlU2VjdGlvbiA9ICgpID0+IHsgY2xvc2VUZXJtKCk7IGlmIChpblNlY3Rpb24pIHsgaHRtbCArPSAnPC9kaXY+JzsgaW5TZWN0aW9uID0gZmFsc2U7IH0gfTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgcmF3ID0gbGluZXNbaV07XG4gICAgY29uc3QgbGluZSA9IHJhdy50cmltRW5kKCk7XG5cbiAgICBpZiAobGluZS5zdGFydHNXaXRoKCcjIyAnKSkge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTsgY2xvc2VTZWN0aW9uKCk7XG4gICAgICBodG1sICs9IGA8ZGl2IGNsYXNzPVwiZ2xvc3Nhcnktc2VjdGlvblwiPjxoMiBzdHlsZT1cIm1hcmdpbjoyMHB4IDAgNHB4O2ZvbnQtc2l6ZToxNXB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7cGFkZGluZy1ib3R0b206NHB4XCI+JHtpbmxpbmUobGluZS5zbGljZSgzKSl9PC9oMj5gO1xuICAgICAgaW5TZWN0aW9uID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGxpbmUuc3RhcnRzV2l0aCgnIyMjICcpKSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpOyBjbG9zZVRlcm0oKTtcbiAgICAgIGh0bWwgKz0gYDxkaXYgY2xhc3M9XCJnbG9zc2FyeS10ZXJtXCI+PGgzIHN0eWxlPVwibWFyZ2luOjE0cHggMCAycHg7Zm9udC1zaXplOjEzcHg7Y29sb3I6dmFyKC0tYWNjZW50KVwiPiR7aW5saW5lKGxpbmUuc2xpY2UoNCkpfTwvaDM+YDtcbiAgICAgIGluVGVybSA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChsaW5lLnN0YXJ0c1dpdGgoJy0tLScpKSB7XG4gICAgICBjbG9zZUxpc3QoKTsgY2xvc2VUYWJsZSgpOyBjbG9zZVRlcm0oKTtcbiAgICAgIGh0bWwgKz0gJzxociBzdHlsZT1cImJvcmRlcjpub25lO2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7bWFyZ2luOjE0cHggMFwiPic7XG4gICAgfSBlbHNlIGlmICgvXlxcfC8udGVzdChsaW5lKSkge1xuICAgICAgY2xvc2VMaXN0KCk7XG4gICAgICBjb25zdCBjZWxscyA9IGxpbmUuc3BsaXQoJ3wnKS5zbGljZSgxLCAtMSkubWFwKGMgPT4gYy50cmltKCkpO1xuICAgICAgaWYgKC9eWy1cXHN8Ol0rJC8udGVzdChsaW5lKSkge1xuICAgICAgICB0YWJsZUhlYWQgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoIWluVGFibGUpIHtcbiAgICAgICAgaW5UYWJsZSA9IHRydWU7IHRhYmxlSGVhZCA9IHRydWU7XG4gICAgICAgIGh0bWwgKz0gJzx0YWJsZSBzdHlsZT1cIndpZHRoOjEwMCU7Ym9yZGVyLWNvbGxhcHNlOmNvbGxhcHNlO2ZvbnQtc2l6ZToxMnB4O21hcmdpbjo2cHggMFwiPjx0aGVhZD48dHI+JztcbiAgICAgICAgY2VsbHMuZm9yRWFjaChjID0+IHsgaHRtbCArPSBgPHRoIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0O3BhZGRpbmc6NHB4IDhweCA0cHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2NvbG9yOnZhcigtLXRleHQpXCI+JHtpbmxpbmUoYyl9PC90aD5gOyB9KTtcbiAgICAgICAgaHRtbCArPSAnPC90cj48L3RoZWFkPjx0Ym9keT4nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaHRtbCArPSAnPHRyPic7XG4gICAgICAgIGNlbGxzLmZvckVhY2goYyA9PiB7IGh0bWwgKz0gYDx0ZCBzdHlsZT1cInBhZGRpbmc6M3B4IDhweCAzcHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2NvbG9yOnZhcigtLW11dGVkKTt2ZXJ0aWNhbC1hbGlnbjp0b3BcIj4ke2lubGluZShjKX08L3RkPmA7IH0pO1xuICAgICAgICBodG1sICs9ICc8L3RyPic7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICgvXi0gLy50ZXN0KGxpbmUpKSB7XG4gICAgICBjbG9zZVRhYmxlKCk7XG4gICAgICBpZiAoIWluTGlzdCkgeyBodG1sICs9ICc8dWwgc3R5bGU9XCJtYXJnaW46NHB4IDAgNHB4IDE2cHg7cGFkZGluZzowXCI+JzsgaW5MaXN0ID0gdHJ1ZTsgfVxuICAgICAgaHRtbCArPSBgPGxpIHN0eWxlPVwibWFyZ2luOjFweCAwXCI+JHtpbmxpbmUobGluZS5zbGljZSgyKSl9PC9saT5gO1xuICAgIH0gZWxzZSBpZiAobGluZSA9PT0gJycpIHtcbiAgICAgIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7XG4gICAgICBodG1sICs9ICc8ZGl2IHN0eWxlPVwibWFyZ2luOjRweCAwXCI+PC9kaXY+JztcbiAgICB9IGVsc2Uge1xuICAgICAgY2xvc2VMaXN0KCk7IGNsb3NlVGFibGUoKTtcbiAgICAgIGh0bWwgKz0gYDxwIHN0eWxlPVwibWFyZ2luOjNweCAwXCI+JHtpbmxpbmUobGluZSl9PC9wPmA7XG4gICAgfVxuICB9XG4gIGNsb3NlTGlzdCgpOyBjbG9zZVRhYmxlKCk7IGNsb3NlU2VjdGlvbigpO1xuICByZXR1cm4gaHRtbDtcbn1cblxuLy8g4pSA4pSAIHN0YXRpYyBtb2RhbC9oYW1idXJnZXIgd2lyaW5nIChyZXBsYWNlcyB0aGUgaW5saW5lIG9uY2xpY2s9L29uaW5wdXQ9IHRoaXNcbi8vIG1vZHVsZSB1c2VkIHRvIG93biBpbiBpbmRleC5odG1sKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbi8vIFRoZXNlIGFyZSBmaXhlZCwgbmV2ZXItcmVjcmVhdGVkIGVsZW1lbnRzIGluIGluZGV4Lmh0bWwsIHNvIHdpcmluZyB0aGVtIG9uY2UgYXRcbi8vIG1vZHVsZSBsb2FkIChiZWxvdykgY2FuJ3QgZG91YmxlLWZpcmUgb24gYSByZS1yZW5kZXIgdGhlIHdheSBhIGR5bmFtaWNhbGx5XG4vLyByZW5kZXJlZCBsaXN0IGNvdWxkLlxuY29uc3QgX0JHX0RJU01JU1NfTU9EQUxTID0gW1xuICBbJ2dldHRpbmctc3RhcnRlZC1tb2RhbCcsIGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbF0sXG4gIFsnaGVscC1tb2RhbCcsIGNsb3NlSGVscE1vZGFsXSxcbiAgWydhYm91dC1tb2RhbCcsIGNsb3NlQWJvdXRNb2RhbF0sXG4gIFsnZ2xvc3NhcnktbW9kYWwnLCBjbG9zZUdsb3NzYXJ5TW9kYWxdLFxuXTtcblxuZnVuY3Rpb24gX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpIHtcbiAgZm9yIChjb25zdCBbbW9kYWxJZCwgY2xvc2VGbl0gb2YgX0JHX0RJU01JU1NfTU9EQUxTKSB7XG4gICAgY29uc3QgbW9kYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChtb2RhbElkKTtcbiAgICBtb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4geyBpZiAoZS50YXJnZXQgPT09IG1vZGFsKSBjbG9zZUZuKCk7IH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIF93aXJlTW9kYWxCdXR0b25zKCkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2V0dGluZy1zdGFydGVkLWNsb3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gY2xvc2VHZXR0aW5nU3RhcnRlZE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGVscC1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlSGVscE1vZGFsKCkpO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWJvdXQtbW9kYWwtY2xvc2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBjbG9zZUFib3V0TW9kYWwoKSk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnbG9zc2FyeS1tb2RhbC1jbG9zZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IGNsb3NlR2xvc3NhcnlNb2RhbCgpKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dsb3NzYXJ5LWZpbHRlcicpLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZSA9PiBfZmlsdGVyR2xvc3NhcnkoZS50YXJnZXQudmFsdWUpKTtcbn1cblxuLy8gVGhlIDQgaGFtYnVyZ2VyIGl0ZW1zIHVpLmpzJ3Mgb3duIG1pZ3JhdGlvbiBkZWZlcnJlZCAodGhlaXIgaW5saW5lIG9uY2xpY2s9XG4vLyBtaXhlZCB1aS5qcydzIGNsb3NlSGFtYnVyZ2VyKCkgd2l0aCBhIGhlbHBtb2RhbHMuanMgbW9kYWwtb3BlbiBjYWxsKSAtIHRoaXNcbi8vIG1vZHVsZSBub3cgb3ducyB0aGUgbW9kYWwtb3BlbiBoYWxmLCBzbyBpdCBvd25zIHJldGlyaW5nIHRoZW0gdG9vLlxuZnVuY3Rpb24gX3dpcmVIYW1idXJnZXJIYW5kbGVycygpIHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWdldHRpbmctc3RhcnRlZCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgIHdpbmRvdy5jbG9zZUhhbWJ1cmdlcigpO1xuICAgIG9wZW5HZXR0aW5nU3RhcnRlZE1vZGFsKCk7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tZ2xvc3NhcnknKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuR2xvc3NhcnlNb2RhbCgpO1xuICB9KTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hhbWJ1cmdlci1pdGVtLWhlbHAnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuSGVscE1vZGFsKCk7XG4gIH0pO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaGFtYnVyZ2VyLWl0ZW0tYWJvdXQnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICB3aW5kb3cuY2xvc2VIYW1idXJnZXIoKTtcbiAgICBvcGVuQWJvdXRNb2RhbCgpO1xuICB9KTtcbn1cblxuX3dpcmVNb2RhbEJnRGlzbWlzc2FscygpO1xuX3dpcmVNb2RhbEJ1dHRvbnMoKTtcbl93aXJlSGFtYnVyZ2VySGFuZGxlcnMoKTtcbiIsICIvLyBFU00gZW50cnkgcG9pbnQgLSB0aGUgc3RyYW5nbGVyLWZpZyBzZWFtIChXUzUgc3RlcCAyKS4gZXNidWlsZCBidW5kbGVzIHRoaXNcbi8vIG1vZHVsZSBncmFwaCBpbnRvIHN0YXRpYy9idW5kbGUuZXNtLmpzIChzZWUgc2NyaXB0cy9idWlsZC1lc20ubWpzLCBydW4gYnlcbi8vIGB5dXUtZGV2IGJ1bmRsZWApLiBFdmVyeXRoaW5nIHJlYWNoYWJsZSBmcm9tIGhlcmUgaXMgcmVhbCBFU00gKGltcG9ydC9leHBvcnQpO1xuLy8gdGhlIGNsYXNzaWMgZ2xvYmFsLXNjb3BlIHNjcmlwdHMgc3RpbGwgaW4gYnVuZGxlLmpzIGNhbGwgdGhlc2UgbW9kdWxlcyBhc1xuLy8gd2luZG93IGdsb2JhbHMsIHNvIHRoaXMgZW50cnkgcmUtZXhwb3NlcyBlYWNoIG1pZ3JhdGVkIG1vZHVsZSdzIHB1YmxpYyBzdXJmYWNlXG4vLyBvbiB3aW5kb3cgYXMgYSBjb21wYXRpYmlsaXR5IHNoaW0uXG4vL1xuLy8gTWlncmF0aW5nIGEgY2xhc3NpYyBjb25zdW1lciB0byBgaW1wb3J0YCBzaHJpbmtzIHRoZSBzaGltOiBvbmNlIG5vdGhpbmcgcmVhZHMgYVxuLy8gbmFtZSBvZmYgd2luZG93LCBkZWxldGUgaXRzIGxpbmUgYmVsb3cuIFdoZW4gYnVuZGxlLmpzIGlzIGVtcHR5LCB0aGlzIGZpbGUgaXNcbi8vIHRoZSB3aG9sZSBhcHAgYW5kIHRoZSBzaGltIGlzIGdvbmUuXG5pbXBvcnQgeyBBcHBTdGF0ZSB9IGZyb20gJy4vc3RhdGUuanMnO1xuaW1wb3J0ICogYXMgZm9ybWF0IGZyb20gJy4vZm9ybWF0LmpzJztcbmltcG9ydCB7IENvbG9yUGlja2VyIH0gZnJvbSAnLi9jb2xvcnBpY2tlci5qcyc7XG5pbXBvcnQgeyBQYW5lbE5hdiB9IGZyb20gJy4vcGFuZWxuYXYuanMnO1xuaW1wb3J0ICogYXMgam9icyBmcm9tICcuL2pvYnMuanMnO1xuaW1wb3J0IHsgX2J1aWxkTWVkaWFVcmwsIHNldHVwUmVjb3JkaW5nUHJldmlldyB9IGZyb20gJy4vcHJldmlldy5qcyc7XG5pbXBvcnQge1xuICBfc3luY1NvcnREaXJCdG4sIF9kaWFyaXphdGlvblJlYXNvbiwgX2RpYXJpemF0aW9uUmVhZGluZXNzLCBfZGlhcml6YXRpb25Ob3RlSHRtbCxcbiAgb3BlbkxvZywgY2xlYXJMb2csIGFwcGVuZExvZywgc2hvd1RvYXN0LCBuZXRFcnJNc2csIHJldmVhbEluRm9sZGVyLCBjb3B5VGV4dCxcbiAgY29sbGFwc2libGVDYXJkLFxufSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7XG4gIHNob3dBbGVydCwgY2xvc2VBbGVydE1vZGFsLCBzaG93Q29uZmlybSwgX2NvbmZpcm1DYW5jZWwsXG4gIG9wZW5BY3Rpb25zTW9kYWwsIGNsb3NlQWN0aW9uc01vZGFsLCB0b3Btb3N0VmlzaWJsZU1vZGFsLCBfbWVudUFycm93S2V5ZG93bixcbiAgaXNIYW1idXJnZXJPcGVuLCB0b2dnbGVIYW1idXJnZXIsIGNsb3NlSGFtYnVyZ2VyLFxuICBvcGVuQ29udHJvbHNNb2RhbCwgY2xvc2VDb250cm9sc01vZGFsLFxuICBvcGVuRGlmZk1vZGFsLCBfZGlmZkRpc2NhcmQsXG4gIG9wZW5GaWVsZEVkaXRNb2RhbCwgY2xvc2VGaWVsZEVkaXRNb2RhbCxcbiAgY2xvc2VLZWJhYiwgc2hvd0tlYmFiLCBpbml0UmVzaXplLCBfYXBwbHlQcmVyZXFXYXJuaW5ncywgc2hvd1VuZG9Ub2FzdCxcbiAgcGxheWJhY2tSYXRlUHJlZiwgYXBwbHlQbGF5YmFja1JhdGUsIGluaXRQbGF5YmFja1JhdGUsXG59IGZyb20gJy4vdWkuanMnO1xuaW1wb3J0IHtcbiAgb3BlbkdldHRpbmdTdGFydGVkTW9kYWwsIGNsb3NlR2V0dGluZ1N0YXJ0ZWRNb2RhbCxcbiAgb3BlbkFib3V0TW9kYWwsIGNsb3NlQWJvdXRNb2RhbCxcbiAgb3BlbkhlbHBNb2RhbCwgY2xvc2VIZWxwTW9kYWwsXG4gIG9wZW5HbG9zc2FyeU1vZGFsLCBjbG9zZUdsb3NzYXJ5TW9kYWwsIF9maWx0ZXJHbG9zc2FyeSxcbn0gZnJvbSAnLi9oZWxwbW9kYWxzLmpzJztcblxud2luZG93LkFwcFN0YXRlID0gQXBwU3RhdGU7XG5PYmplY3QuYXNzaWduKHdpbmRvdywgZm9ybWF0KTtcbndpbmRvdy5Db2xvclBpY2tlciA9IENvbG9yUGlja2VyO1xud2luZG93LlBhbmVsTmF2ID0gUGFuZWxOYXY7XG4vLyB1dGlscy5qcyBpcyBjcm9zcy1jdXR0aW5nIC0gZXZlcnkgbmFtZSBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpY1xuLy8gKGJ1bmRsZS5qcykgY29uc3VtZXIsIG9yIChjbGVhckxvZywgX2RpYXJpemF0aW9uUmVhc29uLCBfZGlhcml6YXRpb25Ob3RlSHRtbCkgYVxuLy8gdGVzdHMvdWkvdGVzdF91aV91dGlscy5weSBwYWdlLmV2YWx1YXRlLiB0b2dnbGVMb2cgYW5kIGlzQ2FyZENvbGxhcHNlZCBkcm9wcGVkOlxuLy8gdGhlaXIgb25seSBjb25zdW1lcnMgd2VyZSB1dGlscy5qcydzIG93biBpbmxpbmUgaGFuZGxlciAobm93IGFkZEV2ZW50TGlzdGVuZXIpXG4vLyBhbmQgaXRzIG93biBjb2xsYXBzaWJsZUNhcmQsIHJlc3BlY3RpdmVseS5cbndpbmRvdy5fc3luY1NvcnREaXJCdG4gPSBfc3luY1NvcnREaXJCdG47XG53aW5kb3cuX2RpYXJpemF0aW9uUmVhc29uID0gX2RpYXJpemF0aW9uUmVhc29uO1xud2luZG93Ll9kaWFyaXphdGlvblJlYWRpbmVzcyA9IF9kaWFyaXphdGlvblJlYWRpbmVzcztcbndpbmRvdy5fZGlhcml6YXRpb25Ob3RlSHRtbCA9IF9kaWFyaXphdGlvbk5vdGVIdG1sO1xud2luZG93Lm9wZW5Mb2cgPSBvcGVuTG9nO1xud2luZG93LmNsZWFyTG9nID0gY2xlYXJMb2c7XG53aW5kb3cuYXBwZW5kTG9nID0gYXBwZW5kTG9nO1xud2luZG93LnNob3dUb2FzdCA9IHNob3dUb2FzdDtcbndpbmRvdy5uZXRFcnJNc2cgPSBuZXRFcnJNc2c7XG53aW5kb3cucmV2ZWFsSW5Gb2xkZXIgPSByZXZlYWxJbkZvbGRlcjtcbndpbmRvdy5jb3B5VGV4dCA9IGNvcHlUZXh0O1xud2luZG93LmNvbGxhcHNpYmxlQ2FyZCA9IGNvbGxhcHNpYmxlQ2FyZDtcbi8vIGpvYnMuanMgaXMgY3Jvc3MtY3V0dGluZyAtIGV2ZXJ5IGV4cG9ydCBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpY1xuLy8gKGJ1bmRsZS5qcykgY29uc3VtZXIgb3IgYSBzdGlsbC1wcmVzZW50IGlubGluZSBoYW5kbGVyLCBzbyBub25lIG9mIHRoZXNlIGNhblxuLy8gYmUgZHJvcHBlZCB5ZXQuIEl0cyBoYW5kZnVsIG9mIG11dGFibGUgc2hhcmVkLXN0YXRlIGdsb2JhbHMgKF9qb2JTdGVwRGVmcyxcbi8vIF9hY3RpdmVFUywgZXRjLikgYXJlIE5PVCBoZXJlIC0gam9icy5qcyB3aXJlcyB0aG9zZSBvbnRvIHdpbmRvdyBpdHNlbGYgdmlhXG4vLyBsaXZlIGdldC9zZXQgYWNjZXNzb3JzLCBzaW5jZSBhIHBsYWluIHNuYXBzaG90IHdvdWxkIGdvIHN0YWxlIG9uIHJlYXNzaWdubWVudC5cbk9iamVjdC5hc3NpZ24od2luZG93LCBqb2JzKTtcbi8vIHByZXZpZXcuanMgaXMgY3Jvc3MtY3V0dGluZyAtIHNldHVwUmVjb3JkaW5nUHJldmlldyBoYXMgY2xhc3NpYyBjb25zdW1lcnNcbi8vIChjbGlwY3JlYXRlLmpzLCB2aWRlb3MuanMsIHNwbGl0LmpzLCBleHBvcnRlZGl0b3IuanMpOyBfYnVpbGRNZWRpYVVybCBoYXMgbm9cbi8vIEpTIGNvbnN1bWVyIGxlZnQgYnV0IHRlc3RzL3VpL3Rlc3RfdWlfdmlkZW8ucHkgZXZhbHVhdGVzIGl0IGFzIGEgcGFnZSBnbG9iYWwuXG53aW5kb3cuX2J1aWxkTWVkaWFVcmwgPSBfYnVpbGRNZWRpYVVybDtcbndpbmRvdy5zZXR1cFJlY29yZGluZ1ByZXZpZXcgPSBzZXR1cFJlY29yZGluZ1ByZXZpZXc7XG4vLyB1aS5qcyBpcyBjcm9zcy1jdXR0aW5nIC0gZXZlcnkgbmFtZSBoZXJlIHN0aWxsIGhhcyBhdCBsZWFzdCBvbmUgY2xhc3NpY1xuLy8gKGJ1bmRsZS5qcykgY29uc3VtZXIsIGFuIGFscmVhZHktRVNNIGNhbGxlciAoam9icy5qcy9wYW5lbG5hdi5qcydzXG4vLyB3aW5kb3cuc2hvd0NvbmZpcm0pLCBvciBhIHRlc3RzL3VpLyoucHkgcGFnZS5ldmFsdWF0ZS4gX2NvbmZpcm1Payxcbi8vIF9kaWZmQWNjZXB0TmV3LCBfZGlmZkFjY2VwdEVkaXQgYW5kIF9maWVsZEVkaXRTYXZlIGRyb3BwZWQ6IHRoZWlyIG9ubHlcbi8vIGNvbnN1bWVycyB3ZXJlIHVpLmpzJ3Mgb3duIGlubGluZSBoYW5kbGVycywgbm93IGFkZEV2ZW50TGlzdGVuZXIgaW5zaWRlXG4vLyB1aS5qcyBpdHNlbGYsIHNvIG5vdGhpbmcgb3V0c2lkZSB0aGUgbW9kdWxlIG5lZWRzIHRoZW0gb2ZmIHdpbmRvdyBhbnltb3JlLlxud2luZG93LnNob3dBbGVydCA9IHNob3dBbGVydDtcbndpbmRvdy5jbG9zZUFsZXJ0TW9kYWwgPSBjbG9zZUFsZXJ0TW9kYWw7XG53aW5kb3cuc2hvd0NvbmZpcm0gPSBzaG93Q29uZmlybTtcbndpbmRvdy5fY29uZmlybUNhbmNlbCA9IF9jb25maXJtQ2FuY2VsO1xud2luZG93Lm9wZW5BY3Rpb25zTW9kYWwgPSBvcGVuQWN0aW9uc01vZGFsO1xud2luZG93LmNsb3NlQWN0aW9uc01vZGFsID0gY2xvc2VBY3Rpb25zTW9kYWw7XG53aW5kb3cudG9wbW9zdFZpc2libGVNb2RhbCA9IHRvcG1vc3RWaXNpYmxlTW9kYWw7XG53aW5kb3cuX21lbnVBcnJvd0tleWRvd24gPSBfbWVudUFycm93S2V5ZG93bjtcbndpbmRvdy5pc0hhbWJ1cmdlck9wZW4gPSBpc0hhbWJ1cmdlck9wZW47XG53aW5kb3cudG9nZ2xlSGFtYnVyZ2VyID0gdG9nZ2xlSGFtYnVyZ2VyO1xud2luZG93LmNsb3NlSGFtYnVyZ2VyID0gY2xvc2VIYW1idXJnZXI7XG53aW5kb3cub3BlbkNvbnRyb2xzTW9kYWwgPSBvcGVuQ29udHJvbHNNb2RhbDtcbndpbmRvdy5jbG9zZUNvbnRyb2xzTW9kYWwgPSBjbG9zZUNvbnRyb2xzTW9kYWw7XG53aW5kb3cub3BlbkRpZmZNb2RhbCA9IG9wZW5EaWZmTW9kYWw7XG53aW5kb3cuX2RpZmZEaXNjYXJkID0gX2RpZmZEaXNjYXJkO1xud2luZG93Lm9wZW5GaWVsZEVkaXRNb2RhbCA9IG9wZW5GaWVsZEVkaXRNb2RhbDtcbndpbmRvdy5jbG9zZUZpZWxkRWRpdE1vZGFsID0gY2xvc2VGaWVsZEVkaXRNb2RhbDtcbndpbmRvdy5jbG9zZUtlYmFiID0gY2xvc2VLZWJhYjtcbndpbmRvdy5zaG93S2ViYWIgPSBzaG93S2ViYWI7XG53aW5kb3cuaW5pdFJlc2l6ZSA9IGluaXRSZXNpemU7XG53aW5kb3cuX2FwcGx5UHJlcmVxV2FybmluZ3MgPSBfYXBwbHlQcmVyZXFXYXJuaW5ncztcbndpbmRvdy5zaG93VW5kb1RvYXN0ID0gc2hvd1VuZG9Ub2FzdDtcbndpbmRvdy5wbGF5YmFja1JhdGVQcmVmID0gcGxheWJhY2tSYXRlUHJlZjtcbndpbmRvdy5hcHBseVBsYXliYWNrUmF0ZSA9IGFwcGx5UGxheWJhY2tSYXRlO1xud2luZG93LmluaXRQbGF5YmFja1JhdGUgPSBpbml0UGxheWJhY2tSYXRlO1xuLy8gaGVscG1vZGFscy5qcyAtIGV2ZXJ5IG5hbWUgaGVyZSBzdGlsbCBoYXMgYXQgbGVhc3Qgb25lIGNsYXNzaWMgKGJ1bmRsZS5qcylcbi8vIGNvbnN1bWVyIChib290LmpzLCB2aWRlb3MuanMsIHNob3J0Y3V0cy5qcywgc2V0dGluZ3MuanMgY2FsbCB0aGVzZSBhcyBiYXJlXG4vLyBnbG9iYWxzKSBvciBhIHRlc3RzL3VpLyoucHkgcGFnZS5ldmFsdWF0ZSwgc28gbm9uZSBjYW4gYmUgZHJvcHBlZCB5ZXQuXG53aW5kb3cub3BlbkdldHRpbmdTdGFydGVkTW9kYWwgPSBvcGVuR2V0dGluZ1N0YXJ0ZWRNb2RhbDtcbndpbmRvdy5jbG9zZUdldHRpbmdTdGFydGVkTW9kYWwgPSBjbG9zZUdldHRpbmdTdGFydGVkTW9kYWw7XG53aW5kb3cub3BlbkFib3V0TW9kYWwgPSBvcGVuQWJvdXRNb2RhbDtcbndpbmRvdy5jbG9zZUFib3V0TW9kYWwgPSBjbG9zZUFib3V0TW9kYWw7XG53aW5kb3cub3BlbkhlbHBNb2RhbCA9IG9wZW5IZWxwTW9kYWw7XG53aW5kb3cuY2xvc2VIZWxwTW9kYWwgPSBjbG9zZUhlbHBNb2RhbDtcbndpbmRvdy5vcGVuR2xvc3NhcnlNb2RhbCA9IG9wZW5HbG9zc2FyeU1vZGFsO1xud2luZG93LmNsb3NlR2xvc3NhcnlNb2RhbCA9IGNsb3NlR2xvc3NhcnlNb2RhbDtcbndpbmRvdy5fZmlsdGVyR2xvc3NhcnkgPSBfZmlsdGVyR2xvc3Nhcnk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7OztBQU1PLE1BQU0sV0FBVztBQUFBLElBQ3RCLGVBQXFCO0FBQUEsSUFDckIsY0FBcUI7QUFBQSxJQUNyQixRQUFxQixDQUFDO0FBQUEsSUFDdEIsVUFBcUIsQ0FBQztBQUFBO0FBQUEsSUFDdEIsaUJBQXFCO0FBQUE7QUFB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eEIsU0FBTyx3QkFBd0I7QUFPL0IsU0FBTyxZQUFZO0FBQ25CLFNBQU8sa0JBQWtCO0FBQ3pCLFNBQU8sY0FBYztBQUNyQixTQUFPLGlCQUFpQjtBQUN4QixTQUFPLG1CQUFtQjtBQUMxQixTQUFPLG9CQUFvQjtBQUMzQixTQUFPLHNCQUFzQjtBQUM3QixTQUFPLG9CQUFvQjtBQUMzQixTQUFPLGtCQUFrQjtBQUN6QixTQUFPLGtCQUFrQjtBQUN6QixTQUFPLGlCQUFpQjtBQUN4QixTQUFPLG9CQUFvQjtBQUMzQixTQUFPLHFCQUFxQjtBQUM1QixTQUFPLGdCQUFnQjtBQUN2QixTQUFPLGVBQWU7QUFDdEIsU0FBTyxxQkFBcUI7QUFDNUIsU0FBTyxzQkFBc0I7QUFDN0IsU0FBTyxhQUFhO0FBQ3BCLFNBQU8sWUFBWTtBQUNuQixTQUFPLGFBQWE7QUFDcEIsU0FBTyx1QkFBdUI7QUFDOUIsU0FBTyxnQkFBZ0I7QUFDdkIsU0FBTyxtQkFBbUI7QUFDMUIsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyxtQkFBbUI7QUFJMUIsU0FBTywwQkFBMEI7QUFDakMsU0FBTywyQkFBMkI7QUFDbEMsU0FBTyxpQkFBaUI7QUFDeEIsU0FBTyxrQkFBa0I7QUFDekIsU0FBTyxnQkFBZ0I7QUFDdkIsU0FBTyxpQkFBaUI7QUFDeEIsU0FBTyxvQkFBb0I7QUFDM0IsU0FBTyxxQkFBcUI7QUFDNUIsU0FBTyxrQkFBa0I7IiwKICAibmFtZXMiOiBbImVsIiwgIl9CR19ESVNNSVNTX01PREFMUyIsICJfd2lyZU1vZGFsQmdEaXNtaXNzYWxzIiwgIl93aXJlTW9kYWxCdXR0b25zIiwgIl93aXJlSGFtYnVyZ2VySGFuZGxlcnMiXQp9Cg==
