// ── shared application state ──────────────────────────────────────────────────
// Mutable state shared across feature modules. Centralized in one explicit object
// so cross-module reads/writes are greppable and obviously shared, rather than
// scattered bare globals that look like module locals at the call site.
const AppState = {
  activeVideoId:       null,
  activeClipId:        null,
  videos:              [],
  clips:               [],
  analyzeProfiles:     [],
  contexts:            [],
  analyzeFilename:     null,
  editingContextId:    null,
  clipFilter:          'all',
  clipSearch:          '',
  clipScoreMin:        0,
  lastStatusChange:    null, // {clipId, fromStatus, timer}
  confirmCallback:     null,
  activeClipData:      null,
  activeMediaFilename: null,
  activeVideoData:     null,
  bootRestoreDone:     false,
};

// ── score utils ───────────────────────────────────────────────────────────────
function _scoreIcon(score) {
  const color = score >= 0.7 ? 'var(--green)' : score >= 0.4 ? 'var(--yellow)' : 'var(--muted)';
  return `<span style="color:${color};font-size:10px" aria-hidden="true">&#11088;</span>`;
}

function _lerpColor(c1, c2, t) {
  const h = c => [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
  const [r1,g1,b1] = h(c1), [r2,g2,b2] = h(c2);
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}

function _scoreBorderColor(score, isRejected) {
  if (isRejected) return 'var(--muted)';
  const stops = [[0,'#6b6b80'],[0.3,'#4fc3f7'],[0.5,'#4caf7d'],[0.7,'#f0c060'],[1.0,'#f7a85a']];
  for (let i = 1; i < stops.length; i++) {
    if (score <= stops[i][0]) {
      const t = (score - stops[i-1][0]) / (stops[i][0] - stops[i-1][0]);
      return _lerpColor(stops[i-1][1], stops[i][1], t);
    }
  }
  return stops[stops.length-1][1];
}

function _sortScore(clip) {
  const sort = _clipsSortParam();
  if (sort === 'funny')    return clip.score_funny;
  if (sort === 'dramatic') return clip.score_dramatic;
  if (sort === 'action')   return clip.score_action;
  return clip.score_overall;
}

// ── format utils ──────────────────────────────────────────────────────────────
const _VIDEO_STATUS_DISPLAY = {
  pending: 'Not analyzed', probed: 'Inspected', labeled: 'Tracks assigned',
  extracting: 'Extracting', transcribing: 'Transcribing', segmented: 'Clips generated',
  done: 'Analyzed', failed: 'Analysis interrupted',
};
function _fmtVideoStatus(s) { return _VIDEO_STATUS_DISPLAY[s] || s; }

function _msToHms(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return `${m}m ${String(sec).padStart(2, '0')}s`;
  const h = Math.floor(m / 60), min = m % 60;
  return `${h}h ${String(min).padStart(2, '0')}m`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatApiError(err) {
  if (!err) return 'Unknown error';
  if (typeof err.detail === 'string') return err.detail;
  if (Array.isArray(err.detail)) return err.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
  if (err.message) return err.message;
  const stringified = JSON.stringify(err);
  return (!stringified || stringified === '{}') ? 'Unknown error (no details from server)' : stringified;
}

function stripRichMarkup(text) {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // ANSI escape codes
    .replace(/\[\/?\w+\]/g, '');             // Rich markup tags
}

// ── speaker labels (diarization) readiness ────────────────────────────────────
// Speaker labels need BOTH the pyannote package installed AND a HuggingFace
// token. The per-run checkboxes in the analyze and export panels both gate on
// this single check; the configured backend only sets the default, since the
// CLI --diarize flag overrides the backend for that run. Centralized here so the
// three surfaces (Settings, analyze, export) can't drift to different rules.
function _diarizationReason(installed, hasToken) {
  if (!installed) return 'Install pyannote.audio';
  if (!hasToken)  return 'Requires a HuggingFace token';
  return '';
}

async function _diarizationReadiness() {
  const [cfg, install] = await Promise.all([
    fetch('/api/config').then(r => r.json()).catch(() => ({})),
    fetch('/api/install/pyannote').then(r => r.json()).catch(() => ({installed: false})),
  ]);
  const installed = !!install.installed;
  const hasToken  = !!(cfg.huggingface_token && cfg.huggingface_token.trim());
  return {
    installed,
    hasToken,
    backend: cfg.diarization_backend || 'null',
    ready:   installed && hasToken,
    reason:  _diarizationReason(installed, hasToken),
  };
}

// Note shown on a disabled speaker-labels control: the blocking reason plus a
// button that jumps to Settings. settingsOnclick closes the host surface first
// (the analyze panel or export modal) so Settings isn't opened behind it.
function _diarizationNoteHtml(reason, settingsOnclick) {
  return escHtml(reason) + ' — set up in ' +
    '<button class="btn ghost" style="font-size:11px;padding:0 4px;color:var(--accent);' +
    `display:inline-flex" onclick="${escHtml(settingsOnclick)}">Settings</button>`;
}


// Server timestamps are naive UTC (SQLite DateTime → isoformat() with no zone).
// Treat a zone-less string as UTC so it isn't parsed as the viewer's local time.
function _parseServerDate(iso) {
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasZone ? iso : iso + 'Z');
}

function _fmtDate(iso) {
  if (!iso) return 'never';
  const d = _parseServerDate(iso);
  return d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ' at ' +
    d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
}

function _fmtAgo(isoString) {
  const diffS = (Date.now() - _parseServerDate(isoString).getTime()) / 1000;
  if (diffS < 60)    return 'just now';
  if (diffS < 3600)  return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return `${Math.floor(diffS / 86400)}d ago`;
}

function _fmtOffset(v) {
  if (!v) return '+0.0';
  return (v >= 0 ? '+' : '') + v.toFixed(1);
}

function _fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ── timeline interval ─────────────────────────────────────────────────────────
const _TIMELINE_MIN_INTERVAL_S = 10;

// Convert a timeline interval (value, unit) into seconds; null if non-numeric or
// below the minimum. Shared by the Settings save path and the per-video timeline
// generator so their validation can't drift apart.
function _parseIntervalS(value, unit) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return null;
  const seconds = unit === 'minutes' ? n * 60 : n;
  return seconds >= _TIMELINE_MIN_INTERVAL_S ? seconds : null;
}

// ── progress indicator ────────────────────────────────────────────────────────
// estMatch: substrings that map this pill to a step name from /api/estimate, so
// the progress pill can show its pre-run time estimate as a hover tooltip.
const INGEST_STEPS = [
  {label: 'Extract',        patterns: ['Extracting audio'],      estMatch: ['extract audio']},
  {label: 'Transcribe',     patterns: ['Transcribing'],          estMatch: ['transcribe', 'load captions']},
  {label: 'Speakers',       patterns: ['Detecting speakers'],    estMatch: ['speaker labels']},
  {label: 'Generate Clips', patterns: ['Generating clip']},
  {label: 'Energy',         patterns: ['Computing audio energy'], estMatch: ['audio energy']},
  {label: 'Scenes',         patterns: ['Detecting scene'],       estMatch: ['scene detection']},
  {label: 'Score',          patterns: ['Scoring clips'],         estMatch: ['llm scoring']},
];
const SCORE_STEPS = [
  {label: 'Energy',  patterns: ['Computing audio energy']},
  {label: 'Scenes',  patterns: ['Detecting scene']},
  {label: 'Scoring', patterns: ['Scoring clips']},
];

let _jobStepDefs   = [];
let _activeES      = null;
let _activeJobCleanup = null;
let _jobStartTime  = 0;
let _jobTimer      = null;
let _jobHideTimer  = null;
let _activeStepIdx = -1;

// Best-effort lookup of a pill's pre-run time estimate (from the last
// /api/estimate call, saved by renderEstimate) for use as a hover tooltip.
function _estimateHmsFor(stepDef) {
  const steps = AppState.lastEstimateSteps;
  if (!steps || !stepDef.estMatch) return null;
  const match = steps.find(es =>
    stepDef.estMatch.some(key => (es.name || '').toLowerCase().includes(key))
  );
  return match ? match.hms : null;
}

function startJobUI(stepDefs, jobLabel, cancellable = false) {
  _jobStepDefs   = stepDefs;
  _activeStepIdx = -1;
  _jobStartTime  = Date.now();
  if (_jobTimer) clearInterval(_jobTimer);
  _jobTimer = setInterval(_tickJobTimer, 1000);
  if (_jobHideTimer) { clearTimeout(_jobHideTimer); _jobHideTimer = null; }
  document.getElementById('job-steps').innerHTML =
    `<span style="color:var(--muted);margin-right:4px">${escHtml(jobLabel)}</span>` +
    stepDefs.map((s, i) => {
      const est = _estimateHmsFor(s);
      const title = est ? ` title="Estimated: ${escHtml(est)}"` : '';
      return `<span class="step" id="step-${i}"${title}>${s.label}</span>`;
    }).join('');
  document.getElementById('job-status').classList.add('visible');
  document.getElementById('header-spacer').style.display = 'none';
  document.querySelectorAll('#btn-analyze,#btn-score').forEach(b => b.disabled = true);
  const analyzeBtn = document.getElementById('btn-analyze');
  if (analyzeBtn) analyzeBtn.title = 'A job is already running';
  document.getElementById('btn-cancel-job').style.display = cancellable ? '' : 'none';
}

function updateJobUI(line) {
  const prevStepIdx = _activeStepIdx;
  _jobStepDefs.forEach((s, i) => {
    if (s.patterns.some(p => line.includes(p))) {
      for (let j = 0; j < i; j++) {
        const el = document.getElementById(`step-${j}`);
        if (el) { el.className = 'step done'; el.textContent = _jobStepDefs[j].label; }
      }
      const el = document.getElementById(`step-${i}`);
      if (el) { el.className = 'step active'; _activeStepIdx = i; }
    }
  });
  // When the pipeline advances a stage, refresh the sidebar so a newly-analyzing
  // recording appears (replacing its placeholder) and its status stays current.
  if (_activeStepIdx !== prevStepIdx) _debouncedSidebarRefresh();
  if (window._syncAnalysisLivePanel) _syncAnalysisLivePanel();
}

let _sidebarRefreshTimer = null;
function _debouncedSidebarRefresh() {
  if (_sidebarRefreshTimer) return;
  _sidebarRefreshTimer = setTimeout(() => { _sidebarRefreshTimer = null; loadVideos(); }, 1200);
}

function _tickJobTimer() {
  if (window._syncAnalysisLivePanel) _syncAnalysisLivePanel();
  if (_activeStepIdx < 0) return;
  const el  = document.getElementById(`step-${_activeStepIdx}`);
  const def = _jobStepDefs[_activeStepIdx];
  if (!el || !def || !el.classList.contains('active')) return;
  el.textContent = `${def.label} · ${_fmtElapsed(Date.now() - _jobStartTime)}`;
}

function endJobUI() {
  if (_jobTimer) { clearInterval(_jobTimer); _jobTimer = null; }
  _jobStepDefs.forEach((s, i) => {
    const el = document.getElementById(`step-${i}`);
    if (el) { el.className = 'step done'; el.textContent = s.label; }
  });
  document.getElementById('btn-cancel-job').style.display = 'none';
  _jobHideTimer = setTimeout(() => {
    _jobHideTimer = null;
    document.getElementById('job-status').classList.remove('visible');
    document.getElementById('header-spacer').style.display = '';
    document.querySelectorAll('#btn-analyze,#btn-score').forEach(b => b.disabled = false);
    const analyzeBtn = document.getElementById('btn-analyze');
    if (analyzeBtn) analyzeBtn.title = '';
    const totalApproved = (AppState.videos || []).reduce((n, v) => n + v.approved, 0);
    _updateDemoButton(totalApproved);
  }, 2000);
}

// ── SSE transport ─────────────────────────────────────────────────────────────
// Low-level SSE reader using fetch + ReadableStream so non-200 HTTP responses
// can be read for their error detail (EventSource.onerror cannot do this).
//
// onLine(msg)  — called for each parsed SSE payload before __DONE__
// onDone(msg)  — called with the full __DONE__ payload (string or object)
// onError(str) — called with a plain-language message on HTTP error or network loss
//
// Returns a handle with .close() that aborts the in-flight request.
function _openSSE(url, onLine, onDone, onError) {
  const ctrl = new AbortController();
  const handle = {close: () => ctrl.abort()};
  fetch(url, {signal: ctrl.signal}).then(async res => {
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      onError(formatApiError(errData) || `Server error ${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) {
          if (!ctrl.signal.aborted) onError('Stream ended without a completion signal');
          return;
        }
        buf += dec.decode(value, {stream: true});
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const msg = JSON.parse(line.slice(6));
          const isDone = msg === '__DONE__' || (msg && typeof msg === 'object' && msg.type === '__DONE__');
          if (isDone) { onDone(msg); return; }
          onLine(msg);
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) onError('Connection lost — server disconnected');
    }
  }).catch(err => {
    if (!ctrl.signal.aborted) onError(`Could not connect — ${err.message}`);
  });
  return handle;
}

// Only one job stream is live at a time. Starting a new job aborts the previous
// one — but aborting suppresses its onDone/onError, so its UI teardown (button
// re-enable, progress pill) would never run. Each job registers that teardown as
// a cleanup so a superseding job can run it. See _supersedeActiveStream.
function _setActiveStream(handle, cleanup = null) {
  _activeES = handle;
  _activeJobCleanup = cleanup;
}

function _clearActiveStream(handle) {
  if (_activeES === handle) { _activeES = null; _activeJobCleanup = null; }
}

function _supersedeActiveStream() {
  if (_activeES) { _activeES.close(); _activeES = null; }
  if (_activeJobCleanup) { const cleanup = _activeJobCleanup; _activeJobCleanup = null; cleanup(); }
}

function streamSSE(url, onDone, stepDefs, jobLabel, cancellable = false) {
  _supersedeActiveStream();
  if (stepDefs) startJobUI(stepDefs, jobLabel, cancellable);
  const handle = _openSSE(
    url,
    text => { appendLog(text); if (stepDefs) updateJobUI(text); },
    () => {
      _clearActiveStream(handle);
      if (stepDefs) endJobUI();
      if (onDone) onDone();
    },
    errMsg => {
      _clearActiveStream(handle);
      appendLog(`[${errMsg}]`);
      showToast(errMsg, 'error');
      SoundFx.play('error');
      if (stepDefs) endJobUI();
      loadVideos();
    },
  );
  _setActiveStream(handle, stepDefs ? endJobUI : null);
}

function cancelJob() {
  showConfirm(
    'Cancel analysis?',
    `All progress for this recording will be lost and you will need to analyze it again.`,
    'Cancel Analysis',
    _doCancelJob,
    true,
  );
}

async function _doCancelJob() {
  _supersedeActiveStream();
  try { await fetch('/api/analyze/cancel', {method: 'POST'}); } catch {}
  appendLog('[Analysis cancelled]');
  endJobUI();
  loadVideos();
}

// ── log panel ─────────────────────────────────────────────────────────────────
function openLog() {
  const panel = document.getElementById('log-panel');
  panel.classList.add('visible');
  panel.classList.remove('minimized');
  document.getElementById('log-toggle').textContent = '▲';
}

function toggleLog() {
  const panel = document.getElementById('log-panel');
  const minimized = panel.classList.toggle('minimized');
  document.getElementById('log-toggle').textContent = minimized ? '▼' : '▲';
  document.getElementById('btn-log-toggle').setAttribute('aria-expanded', minimized ? 'false' : 'true');
}

function clearLog() {
  document.getElementById('log-lines').innerHTML = '';
}

function appendLog(raw) {
  const text = stripRichMarkup(raw);
  if (!text.trim()) return;
  const div = document.createElement('div');
  const isOk   = raw.includes(' OK') || raw.includes('[green]') || raw.includes('Done');
  const isErr   = raw.includes('FAIL') || raw.includes('Error') || raw.includes('[red]') || raw.includes('error');
  const isWarn  = raw.includes('[yellow]') || raw.includes('WARNING') || raw.includes('overlap');
  div.className = 'log-line' + (isOk ? ' ok' : isErr ? ' err' : isWarn ? ' warn' : '');
  div.style.display = 'flex';
  div.style.gap = '6px';
  const ts = document.createElement('span');
  ts.style.cssText = 'color:var(--muted);font-size:10px;flex-shrink:0;opacity:.7';
  ts.textContent = new Date().toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  div.appendChild(ts);
  div.appendChild(document.createTextNode(text));
  document.getElementById('log-lines').appendChild(div);
  const body = document.getElementById('log-body');
  body.scrollTop = body.scrollHeight;
}

// ── toast notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'success', durationMs) {
  const ms = durationMs ?? (type === 'error' ? 8000 : 4000);
  const container = document.getElementById('toast-container');
  const liveRegion = document.getElementById(type === 'error' ? 'sr-live-assertive' : 'sr-live-polite');
  if (liveRegion) { liveRegion.textContent = ''; setTimeout(() => { liveRegion.textContent = message; }, 10); }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px';
  const msg = document.createElement('span');
  msg.textContent = message;
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.style.cssText = `background:none;border:none;color:inherit;cursor:pointer;font-size:18px;line-height:1;padding:0;flex-shrink:0;opacity:${type === 'error' ? '.8' : '.5'}`;
  close.onclick = () => toast.remove();
  toast.appendChild(msg);
  toast.appendChild(close);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, ms);
}
