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
  clipFilters:         new Set(),  // active filter tokens; empty = show all
  clipSearch:          '',
  clipScoreMin:        0,
  videoSearch:         '',
  videoSort:           'recent',
  videoFilters:        new Set(),  // active video filter tokens; empty = show all
  selectedClipIds:     new Set(),
  lastStatusChange:    null, // {clipId, fromStatus, timer}
  lastBulkStatusChange: null, // {previous: {clipId: fromStatus}, timer}
  confirmCallback:     null,
  activeClipData:      null,
  activeMediaFilename: null,
  activeVideoData:     null,
  bootRestoreDone:     false,
  exportDir:           null,
};

// ── score utils ───────────────────────────────────────────────────────────────
function _scoreIcon(score) {
  const color = score >= 0.7 ? 'var(--green)' : score >= 0.4 ? 'var(--warning)' : 'var(--muted)';
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

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : (pluralForm || singular + 's')}`;
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
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
// progressPattern: regex with two capture groups (current, total) matched
// against incoming log lines while this step is active, so the pill can show
// "3/12 (25%)" and a live ETA instead of just elapsed time.
const INGEST_STEPS = [
  {label: 'Extract',        patterns: ['Extracting audio'],      estMatch: ['extract audio'],  progressPattern: /Track (\d+)\/(\d+)/},
  {label: 'Transcribe',     patterns: ['Transcribing'],          estMatch: ['transcribe', 'load captions'], progressPattern: /Track (\d+)\/(\d+)/},
  {label: 'Speakers',       patterns: ['Detecting speakers'],    estMatch: ['speaker labels']},
  {label: 'Generate Clips', patterns: ['Generating clip']},
  {label: 'Energy',         patterns: ['Computing audio energy'], estMatch: ['audio energy']},
  {label: 'Scenes',         patterns: ['Detecting scene'],       estMatch: ['scene detection']},
  {label: 'Score',          patterns: ['Scoring clips'],         estMatch: ['llm scoring'], progressPattern: /Scoring (\d+)\/(\d+)/},
];
const SCORE_STEPS = [
  {label: 'Energy',  patterns: ['Computing audio energy']},
  {label: 'Scenes',  patterns: ['Detecting scene']},
  {label: 'Scoring', patterns: ['Scoring clips'], progressPattern: /Scoring (\d+)\/(\d+)/},
];

let _jobStepDefs   = [];
let _activeES      = null;
let _activeJobCleanup = null;
let _jobStartTime  = 0;
let _jobTimer      = null;
let _jobHideTimer  = null;
let _activeStepIdx = -1;
let _stepStartTime = 0;
let _stepProgress  = {}; // stepIdx -> {current, total}, cleared per job
let _stepRateAnchor = {}; // stepIdx -> {t, current} at first observed count, cleared per job

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
  _stepStartTime = Date.now();
  _stepProgress  = {};
  _stepRateAnchor = {};
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
        if (el) { el.className = 'step done'; el.style.backgroundImage = ''; el.textContent = '✓'; el.title = _jobStepDefs[j].label; }
      }
      const el = document.getElementById(`step-${i}`);
      if (el) { el.className = 'step active'; _activeStepIdx = i; }
    }
  });
  if (_activeStepIdx !== prevStepIdx) {
    _stepStartTime = Date.now();
    // When the pipeline advances a stage, refresh the sidebar so a newly-analyzing
    // recording appears (replacing its placeholder) and its status stays current.
    _debouncedSidebarRefresh();
    // Also refresh the open clip list — picks up the batch "Generate Clips" just
    // committed, and clears any stale progress text from the stage just left.
    _debouncedClipListRefresh();
  }
  const activeDef = _jobStepDefs[_activeStepIdx];
  if (activeDef && activeDef.progressPattern) {
    const m = line.match(activeDef.progressPattern);
    if (m) {
      const current = parseInt(m[1], 10);
      _stepProgress[_activeStepIdx] = {current, total: parseInt(m[2], 10)};
      // Anchor the rate at the first observed count so the cold first item
      // (model load, warmup) is excluded from the ETA extrapolation.
      if (!_stepRateAnchor[_activeStepIdx]) _stepRateAnchor[_activeStepIdx] = {t: Date.now(), current};
      _renderStepPill(_activeStepIdx);
      _debouncedClipListRefresh();
    }
  }
  if (window._syncAnalysisLivePanel) _syncAnalysisLivePanel();
}

let _sidebarRefreshTimer = null;
function _debouncedSidebarRefresh() {
  if (_sidebarRefreshTimer) return;
  _sidebarRefreshTimer = setTimeout(() => { _sidebarRefreshTimer = null; loadVideos(); }, 1200);
}

let _clipListRefreshTimer = null;
// Same push-driven-but-debounced pattern as _debouncedSidebarRefresh above,
// triggered off the SSE line stream rather than a polling timer. Only refreshes
// when the video being analyzed is the one currently open, so newly-committed
// clip scores (yuu_clip/scoring/engine.py now commits per clip) fill into the
// visible list live instead of requiring a manual page refresh.
function _debouncedClipListRefresh() {
  if (_clipListRefreshTimer) return;
  _clipListRefreshTimer = setTimeout(async () => {
    _clipListRefreshTimer = null;
    if (!AppState.activeVideoId || !AppState.analyzeFilename) return;
    const analyzing = AppState.videos.find(v => v.filename === AppState.analyzeFilename);
    if (!analyzing || analyzing.id !== AppState.activeVideoId) return;
    AppState.clips = await fetch(`/api/videos/${AppState.activeVideoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
    _renderClips();
  }, 1200);
}

// Builds the live label for a step pill: "Score · 3/12 (25%) · 0:42 (~2:06
// left)" once per-item counts arrive from the subprocess log; elapsed-only
// (falling back to the pre-run /api/estimate figure) before the first count.
function _stepPillLabel(idx) {
  const def = _jobStepDefs[idx];
  if (!def) return {text: '', pct: null};
  const elapsedMs = Date.now() - _stepStartTime;
  const progress  = _stepProgress[idx];
  if (!progress || !progress.current) {
    const est = _estimateHmsFor(def);
    return {
      text: est ? `${def.label} · ${_fmtElapsed(elapsedMs)} (~${est})` : `${def.label} · ${_fmtElapsed(elapsedMs)}`,
      pct: null,
    };
  }
  const {current, total} = progress;
  const pct    = Math.round(current / total * 100);
  // ETA from throughput since the rate anchor (first observed count), not from
  // elapsed/current — the latter let a slow cold first item project absurd
  // figures (e.g. "77 min left" that vanished when the step finished seconds later).
  const anchor = _stepRateAnchor[idx];
  let eta = '';
  if (anchor && current > anchor.current) {
    const msPerItem = (Date.now() - anchor.t) / (current - anchor.current);
    const remainingMs = msPerItem * (total - current);
    if (isFinite(remainingMs) && remainingMs >= 0) eta = ` (~${_fmtElapsed(remainingMs)} left)`;
  }
  return {
    text: `${def.label} · ${current}/${total} (${pct}%) · ${_fmtElapsed(elapsedMs)}${eta}`,
    pct,
  };
}

// Paints one step pill's text and, for an in-progress step with known counts,
// a two-tone gradient fill standing in for a progress bar (done/pending pills
// keep their flat CSS class color — no fill). Shared by the header pill row
// and (via _syncAnalysisLivePanel) the in-detail mirror panel.
function _renderStepPill(idx) {
  const el = document.getElementById(`step-${idx}`);
  if (!el || !el.classList.contains('active')) return;
  const {text, pct} = _stepPillLabel(idx);
  el.textContent = text;
  el.style.backgroundImage = pct != null
    ? `linear-gradient(to right, var(--green) ${pct}%, var(--accent) ${pct}%)`
    : '';
}

function _tickJobTimer() {
  if (window._syncAnalysisLivePanel) _syncAnalysisLivePanel();
  if (_activeStepIdx < 0) return;
  _renderStepPill(_activeStepIdx);
}

function endJobUI() {
  if (_jobTimer) { clearInterval(_jobTimer); _jobTimer = null; }
  _jobStepDefs.forEach((s, i) => {
    const el = document.getElementById(`step-${i}`);
    if (el) { el.className = 'step done'; el.style.backgroundImage = ''; el.textContent = '✓'; el.title = s.label; }
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

// Guard for competing SSE jobs (re-score, timeline, summary, diarize, …). While
// an analysis is running the backend 409s these anyway, but they call
// _supersedeActiveStream() first, which would tear down the live analyze progress
// UI before the rejection lands. Returns true (and toasts) so the caller can bail
// before any side effects.
function _blockedByAnalyze(actionLabel) {
  if (!AppState.analyzeFilename) return false;
  showToast(`Wait for the current analysis to finish before you ${actionLabel}.`, 'warning');
  return true;
}

// onLine (optional): called with each raw SSE payload line before __DONE__, for
// callers that need live progress text (e.g. the proxy-build percentage).
function streamSSE(url, onDone, stepDefs, jobLabel, cancellable = false, onLine = null) {
  _supersedeActiveStream();
  if (stepDefs) startJobUI(stepDefs, jobLabel, cancellable);
  const handle = _openSSE(
    url,
    text => { appendLog(text); if (onLine) onLine(text); if (stepDefs) updateJobUI(text); },
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

// ── recording preview quality (720p proxy + badge) ────────────────────────────
// Shared by every full-recording <video> (recording detail player, split editor)
// so the creator always knows whether they're seeing the fast 720p proxy or the
// full-quality original. Prefers the proxy when one exists; otherwise plays the
// source and either builds a proxy on demand (autoBuild) or invites the user to.
//
//   videoEl / badgeEl : the <video> and its overlay badge (caller owns layout)
//   autoBuild         : build immediately when no proxy exists (deliberate
//                       scrubbing surfaces), else the badge offers a click-to-build
//   isCurrent         : guard so a late swap never lands on a since-changed view
//   startS / endS     : a split segment's player streams the full untrimmed parent
//                       file (source and proxy are both keyed by the parent path) —
//                       these bound playback to the segment's own slice of it
function setupRecordingPreview(videoEl, badgeEl, videoId, { autoBuild = false, isCurrent = () => true, startS = null, endS = null } = {}) {
  videoEl.src = `/api/videos/${videoId}/source`;
  if (startS != null) {
    videoEl.addEventListener('loadedmetadata', () => { try { videoEl.currentTime = startS; } catch (_) {} }, { once: true });
  }
  if (endS != null) {
    videoEl.addEventListener('timeupdate', () => { if (videoEl.currentTime >= endS) videoEl.pause(); });
  }
  const buildFn = () => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS);
  _setPreviewBadge(badgeEl, 'original', null, autoBuild ? null : buildFn);
  fetch(`/api/videos/${videoId}/proxy-status`)
    .then(r => r.ok ? r.json() : null)
    .then(status => {
      if (!isCurrent() || !status) return;
      if (status.available) _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS);
      else if (autoBuild || status.generating) buildFn();
    })
    .catch(() => { /* leave the source playing with the original-quality badge */ });
}

// startS: falls back to it when currentTime is still 0 — the proxy-status fetch
// can resolve before the source's loadedmetadata seek (setupRecordingPreview) runs,
// which would otherwise resume a segment's proxy at the parent's t=0.
function _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS = null) {
  if (!isCurrent()) return;
  const resumeAt   = videoEl.currentTime || startS || 0;
  const wasPlaying = !videoEl.paused && !videoEl.ended;
  videoEl.src = `/api/videos/${videoId}/proxy`;
  videoEl.addEventListener('loadedmetadata', () => {
    try { videoEl.currentTime = resumeAt; } catch (_) {}
    if (wasPlaying) videoEl.play().catch(() => {});
  }, { once: true });
  _setPreviewBadge(badgeEl, 'proxy');
}

function _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS = null) {
  if (!isCurrent()) return;
  _setPreviewBadge(badgeEl, 'building');
  streamSSE(
    `/api/videos/${videoId}/proxy/generate`,
    async () => {
      if (!isCurrent()) return;
      const status = await fetch(`/api/videos/${videoId}/proxy-status`)
        .then(r => r.ok ? r.json() : null).catch(() => null);
      if (!isCurrent()) return;
      if (status?.available) _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS);
      // Another open is still encoding — poll until its proxy lands.
      else if (status?.generating) setTimeout(() => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS), 5000);
      else _setPreviewBadge(badgeEl, 'original', null, () => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS));
    },
    null,        // no global job pill — this is a background convenience
    'Preview',
    false,
    line => {    // onLine: surface the encode percentage on the badge
      const m = /(\d+)%/.exec(line);
      if (m && isCurrent()) _setPreviewBadge(badgeEl, 'building', m[1]);
    },
  );
}

function _setPreviewBadge(badgeEl, mode, pct, onBuild) {
  if (!badgeEl) return;
  // Reset to a non-interactive status indicator; the build affordance below
  // re-arms it as a button so role/tabindex never go stale between states.
  badgeEl.style.display = 'inline-block';
  badgeEl.onclick = null;
  badgeEl.onkeydown = null;
  badgeEl.style.cursor = '';
  badgeEl.style.pointerEvents = 'none';
  badgeEl.removeAttribute('tabindex');
  badgeEl.setAttribute('role', 'status');
  badgeEl.classList.toggle('preview-badge-proxy', mode === 'proxy');
  badgeEl.classList.remove('preview-badge-build');
  if (mode === 'proxy') {
    badgeEl.textContent = 'Preview quality (720p)';
    badgeEl.title = 'Playing a downscaled 720p preview for fast seeking — not full quality. Exports use the original.';
  } else if (mode === 'building') {
    badgeEl.textContent = pct ? `Building 720p preview… ${pct}%` : 'Building 720p preview…';
    badgeEl.title = 'Encoding a fast-seeking 720p preview from the source recording.';
  } else if (onBuild) {
    // Render the action as a button-styled pill so it obviously invites a click.
    badgeEl.classList.add('preview-badge-build');
    badgeEl.innerHTML = 'Original quality · <span class="preview-badge-action">&#9889; Build 720p preview</span>';
    badgeEl.title = 'Playing the full-quality original. Build a 720p preview so seeking is fast.';
    badgeEl.style.cursor = 'pointer';
    badgeEl.style.pointerEvents = 'auto';
    badgeEl.setAttribute('role', 'button');
    badgeEl.tabIndex = 0;
    badgeEl.onclick = onBuild;
    badgeEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBuild(); } };
  } else {
    badgeEl.textContent = 'Original quality · slower seeking';
    badgeEl.title = 'Playing the original recording — seeking a long file can be slow.';
  }
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
  // Cancel on the server FIRST — if it fails, the analysis is still running, so
  // keep the stream attached and the job UI up instead of pretending it stopped.
  try {
    const res = await fetch('/api/analyze/cancel', {method: 'POST'});
    if (!res.ok) throw new Error(`Server error ${res.status}`);
  } catch (err) {
    showToast(`Could not cancel — ${err.message}`, 'error');
    return;
  }
  _supersedeActiveStream();
  appendLog('[Analysis cancelled]');
  endJobUI();
  // Clear the analyzing marker so loadVideos() drops the sidebar placeholder /
  // spinner. Left set, a cancelled run whose DB row never materialised would
  // keep an unclickable "Analyzing…" placeholder until a manual page refresh.
  AppState.analyzeFilename = null;
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
// Types: success | info | warning (guard/guidance) | error (actual failures).
// Error toasts persist until dismissed — durationMs is ignored for them.
// opts: { durationMs, action: {label, onClick} }
const TOAST_STACK_MAX = 4;

function showToast(message, type = 'success', opts = {}) {
  const container = document.getElementById('toast-container');
  const liveRegion = document.getElementById(type === 'error' ? 'sr-live-assertive' : 'sr-live-polite');
  if (liveRegion) { liveRegion.textContent = ''; setTimeout(() => { liveRegion.textContent = message; }, 10); }
  while (container.children.length >= TOAST_STACK_MAX) container.firstElementChild.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px';
  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(msg);
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:6px;align-items:center;flex-shrink:0';
  if (opts.action) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn ghost';
    actionBtn.style.cssText = 'font-size:11px;padding:2px 8px';
    actionBtn.textContent = opts.action.label;
    actionBtn.onclick = () => { toast.remove(); opts.action.onClick(); };
    buttons.appendChild(actionBtn);
  }
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss');
  close.style.cssText = `background:none;border:none;color:inherit;cursor:pointer;font-size:18px;line-height:1;padding:0;flex-shrink:0;opacity:${type === 'error' ? '.8' : '.5'}`;
  close.onclick = () => toast.remove();
  buttons.appendChild(close);
  toast.appendChild(buttons);
  container.appendChild(toast);
  if (type === 'error') return;
  const ms = opts.durationMs ?? (type === 'warning' ? 6000 : 4000);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, ms);
}

// ── clipboard ─────────────────────────────────────────────────────────────────
// The app only ever runs on localhost or inside Electron, so navigator.clipboard
// is always available — a failure toast is enough, no execCommand fallback.
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied`, 'success');
  } catch (err) {
    showToast(`Could not copy ${label.toLowerCase()}: ${err.message}`, 'error');
  }
}
