// Feature-map - Long-running-job machinery: the job-status header (step pills, timer, ETA), the
//   pause/resume + thermal auto-pause UI, the fetch-based SSE transport (_openSSE/streamSSE), the
//   single-active-stream supersede contract, and the shared Cancel button.
//   API: routes/analyze.py, routes/scoring.py (SSE endpoints) · Tests: tests/ui/test_ui_utils.py, tests/ui/test_ui_sse.py
// ── shared live job-render state ──────────────────────────────────────────────
// Read cross-file by videos.js's compact step strip (and _activeES by the SSE
// teardown in tests). Kept at top level, outside the IIFE below, so the binding
// stays live in the global lexical scope - an Object.assign export snapshots the
// value at wrap time and later readers would see stale data.
let _jobStepDefs   = [];
let _activeES      = null;
let _jobStartTime  = 0;
let _activeStepIdx = -1;

// Per-step progress accounting for the step-pill ETA heuristic. Not read by other
// production modules, but the step-pill / ETA / live-panel tests seed them directly
// via page.evaluate, which resolves against the global lexical scope - so they too
// stay outside the IIFE rather than becoming closure-private.
let _stepStartTime = 0;
let _stepProgress  = {}; // stepIdx -> {current, total}, cleared per job
let _stepRateAnchor = {}; // stepIdx -> {t, current} at first observed count, cleared per job

(function () {
// ── progress indicator ────────────────────────────────────────────────────────
// estMatch: substrings that map this pill to a step name from /api/estimate, so
// the progress pill can show its pre-run time estimate as a hover tooltip.
// progressPattern: regex with two capture groups (current, total) matched
// against incoming log lines while this step is active, so the pill can show
// "3/12 (25%)" and a live ETA instead of just elapsed time.
const INGEST_STEPS = [
  {label: 'Extract',        patterns: ['Extracting audio'],      estMatch: ['extract audio'],  progressPattern: /Track (\d+)\/(\d+)/},
  {label: 'Transcribe',     patterns: ['Transcribing'],          estMatch: ['transcribe', 'load captions'], progressPattern: /Track (\d+)\/(\d+)/, waitPattern: /Waiting for the speech-to-text model/},
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

// stepIdx -> a transient status message shown in place of the step's timing
// label (e.g. "waiting for the speech model to finish downloading"). Set when a
// step's waitPattern matches, cleared when that step reports real progress.
let _stepWaitingMsg = {};
let _activeJobCleanup = null;
let _jobTimer      = null;
let _jobHideTimer  = null;
let _jobPausable   = false;
let _jobPaused     = false;
let _jobThermalPollTimer = null;
let _lastGpuState  = 'unavailable';

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

function startJobUI(stepDefs, jobLabel, cancellable = false, pausable = false) {
  _jobStepDefs   = stepDefs;
  _activeStepIdx = -1;
  _jobStartTime  = Date.now();
  _stepStartTime = Date.now();
  _stepProgress  = {};
  _stepRateAnchor = {};
  _stepWaitingMsg = {};
  _jobPausable   = pausable;
  _jobPaused     = false;
  _activeCancel  = _ANALYZE_CANCEL;
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
  _renderPauseUI();
  if (_jobThermalPollTimer) clearInterval(_jobThermalPollTimer);
  if (pausable) {
    _lastGpuState = 'unavailable';
    document.getElementById('job-gpu-temp').style.display = 'none';
    _pollThermalStatus();
    _jobThermalPollTimer = setInterval(_pollThermalStatus, 5000);
  }
  if (window._renderClipFilterCounts) _renderClipFilterCounts();
}

// Polled every 5s (only while a pausable - i.e. analyze-type - job is active) to
// drive the job-header GPU temperature readout and the warn/auto-pause notices.
// Uses /api/status rather than SSE log-line matching so it also works correctly
// across the JS sequential-segment runners' gaps between per-segment jobs.
async function _pollThermalStatus() {
  const status = await fetch('/api/status').then(r => r.json()).catch(() => null);
  if (!status) return;
  const readout = document.getElementById('job-gpu-temp');
  if (readout) {
    if (status.gpu_temp_c == null) {
      readout.style.display = 'none';
    } else {
      readout.style.display = '';
      readout.className = 'gpu-temp-readout' + (status.gpu_state === 'ok' ? '' : ` ${status.gpu_state}`);
      readout.textContent = `GPU ${Math.round(status.gpu_temp_c)}°C`;
    }
  }
  if (status.gpu_state === 'warn' && _lastGpuState !== 'warn' && _lastGpuState !== 'pause') {
    const next = status.thermal_autopause_enabled
      ? `Analysis will auto-pause if it reaches ${Math.round(status.thermal_pause_c)}°C.`
      : `Auto-pause is off - pause the job manually if it keeps climbing.`;
    showToast(`GPU running hot - ${Math.round(status.gpu_temp_c)}°C. ${next}`, 'warning');
  }
  if (status.gpu_state === 'pause' && _lastGpuState !== 'pause') {
    _jobPaused = true;
    _renderPauseUI();
    showToast(`Auto-paused: GPU reached ${Math.round(status.gpu_temp_c)}°C - will hold before the next video`, 'warning', {
      durationMs: 20000,
      action: {label: 'Resume now', onClick: togglePauseJob},
    });
  }
  _lastGpuState = status.gpu_state;
}

// "Pause after current video" toggle in the job header - only shown for jobs
// backed by the pause flag file (the single analyze stream and the JS
// sequential-segment runners; see togglePauseJob).
function _renderPauseUI() {
  const btn = document.getElementById('btn-pause-job');
  const badge = document.getElementById('job-paused-badge');
  if (!btn || !badge) return;
  btn.style.display = _jobPausable ? '' : 'none';
  btn.textContent = _jobPaused ? 'Resume' : 'Pause after current video';
  badge.style.display = _jobPaused ? '' : 'none';
}

// Reflects an already-paused job discovered via /api/status (page reconnect) -
// does not itself call the pause/resume API.
function _setPausedUIFromStatus(paused) {
  _jobPaused = !!paused;
  _renderPauseUI();
}

async function togglePauseJob() {
  const btn = document.getElementById('btn-pause-job');
  const wantPause = !_jobPaused;
  btn.disabled = true;
  try {
    const res = await fetch(`/api/analyze/${wantPause ? 'pause' : 'resume'}`, {method: 'POST'});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(formatApiError(data) || `Could not ${wantPause ? 'pause' : 'resume'}`, 'error');
      return;
    }
    if (data.status === 'no-op') {
      showToast(data.message || 'No analysis is running.', 'info');
      return;
    }
    _jobPaused = wantPause;
    _renderPauseUI();
    showToast(wantPause ? 'Will pause before the next video' : 'Resumed', 'info');
  } catch (err) {
    showToast(netErrMsg(err), 'error');
  } finally {
    btn.disabled = false;
  }
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
    // Also refresh the open clip list - picks up the batch "Generate Clips" just
    // committed, and clears any stale progress text from the stage just left.
    _debouncedClipListRefresh();
  }
  const activeDef = _jobStepDefs[_activeStepIdx];
  if (activeDef && activeDef.waitPattern && activeDef.waitPattern.test(line)) {
    _stepWaitingMsg[_activeStepIdx] = 'waiting for the speech model to finish downloading';
    _renderStepPill(_activeStepIdx);
  }
  if (activeDef && activeDef.progressPattern) {
    const m = line.match(activeDef.progressPattern);
    if (m) {
      // Real progress means the model is ready and transcription is running -
      // drop any waiting message so the pill switches back to live counts.
      delete _stepWaitingMsg[_activeStepIdx];
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
  const waiting = _stepWaitingMsg[idx];
  if (waiting) return {text: `${def.label} · ${waiting}`, pct: null};
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
  // elapsed/current - the latter let a slow cold first item project absurd
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
// keep their flat CSS class color - no fill). Shared by the header pill row
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
  _jobPausable = false;
  _jobPaused   = false;
  _renderPauseUI();
  if (_jobThermalPollTimer) { clearInterval(_jobThermalPollTimer); _jobThermalPollTimer = null; }
  const gpuTemp = document.getElementById('job-gpu-temp');
  if (gpuTemp) gpuTemp.style.display = 'none';
  _jobHideTimer = setTimeout(() => {
    _jobHideTimer = null;
    document.getElementById('job-status').classList.remove('visible');
    document.getElementById('header-spacer').style.display = '';
    document.querySelectorAll('#btn-analyze,#btn-score').forEach(b => b.disabled = false);
    const analyzeBtn = document.getElementById('btn-analyze');
    if (analyzeBtn) analyzeBtn.title = '';
    const totalApproved = (AppState.videos || []).reduce((n, v) => n + v.approved, 0);
    _updateDemoButton(totalApproved);
    if (window._renderClipFilterCounts) _renderClipFilterCounts();
  }, 2000);
}

// ── SSE transport ─────────────────────────────────────────────────────────────
// Low-level SSE reader using fetch + ReadableStream so non-200 HTTP responses
// can be read for their error detail (EventSource.onerror cannot do this).
//
// onLine(msg)  - called for each parsed SSE payload before __DONE__
// onDone(msg)  - called with the full __DONE__ payload (string or object)
// onError(str) - called with a plain-language message on HTTP error or network loss
//
// opts (optional): extra fetch init, e.g. {method: 'POST'} for the model-download
// endpoints, which are POST-only (a GET 405s). Defaults to a GET, as the analyze
// and score SSE streams use.
// Returns a handle with .close() that aborts the in-flight request.
function _openSSE(url, onLine, onDone, onError, opts = {}) {
  const ctrl = new AbortController();
  const handle = {close: () => ctrl.abort()};
  fetch(url, {signal: ctrl.signal, ...opts}).then(async res => {
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
      if (!ctrl.signal.aborted) onError('Connection lost - server disconnected');
    }
  }).catch(err => {
    if (!ctrl.signal.aborted) onError(netErrMsg(err));
  });
  return handle;
}

// Only one job stream is live at a time. Starting a new job aborts the previous
// one - but aborting suppresses its onDone/onError, so its UI teardown (button
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
function streamSSE(url, onDone, stepDefs, jobLabel, cancellable = false, onLine = null, pausable = false) {
  _supersedeActiveStream();
  if (stepDefs) startJobUI(stepDefs, jobLabel, cancellable, pausable);
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

// Polled by the JS sequential-segment runners (analyze.js's pre-split loop,
// split.js's re-split loop) before firing off each segment's own analyze job.
// Each segment is a separate AnalyzeJob, so there is a gap between segments
// with no "running" job for /api/status's analyze_paused to key off - this
// checks the raw pause flag file instead (pause_flag_set).
async function _waitWhileAnalyzePaused() {
  let toasted = false;
  while (true) {
    const status = await fetch('/api/status').then(r => r.json()).catch(() => null);
    if (!status || !status.pause_flag_set) return;
    if (!toasted) { showToast('Paused - will hold before the next segment', 'info'); toasted = true; }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// ── job cancellation ──────────────────────────────────────────────────────────
// The job-header Cancel button serves whichever cancellable job is running. Each
// cancellable flow sets _activeCancel (via setJobCancel) so the confirm copy and
// the cancel endpoint match the job; startJobUI resets it to the analyze default.
const _ANALYZE_CANCEL = {
  url:      '/api/analyze/cancel',
  title:    'Cancel analysis?',
  body:     'All progress for this recording will be lost and you will need to analyze it again.',
  confirm:  'Cancel Analysis',
  logMsg:   '[Analysis cancelled]',
};
let _activeCancel = _ANALYZE_CANCEL;

function setJobCancel(cfg) { _activeCancel = cfg || _ANALYZE_CANCEL; }

function cancelJob() {
  showConfirm(
    _activeCancel.title,
    _activeCancel.body,
    _activeCancel.confirm,
    _doCancelJob,
    true,
  );
}

async function _doCancelJob() {
  const cancel = _activeCancel;
  // Cancel on the server FIRST - if it fails, the job is still running, so
  // keep the stream attached and the job UI up instead of pretending it stopped.
  try {
    const res = await fetch(cancel.url, {method: 'POST'});
    if (!res.ok) throw new Error(`Server error ${res.status}`);
  } catch (err) {
    showToast(`Could not cancel - ${err.message}`, 'error');
    return;
  }
  _supersedeActiveStream();
  appendLog(cancel.logMsg);
  endJobUI();
  // Clear the analyzing marker so loadVideos() drops the sidebar placeholder /
  // spinner. Left set, a cancelled run whose DB row never materialised would
  // keep an unclickable "Analyzing…" placeholder until a manual page refresh.
  AppState.analyzeFilename = null;
  loadVideos();
}

Object.assign(window, {
  INGEST_STEPS, SCORE_STEPS,
  startJobUI, updateJobUI, endJobUI, _stepPillLabel, _renderStepPill, _tickJobTimer,
  _setPausedUIFromStatus, togglePauseJob, _pollThermalStatus,
  _openSSE, streamSSE, _setActiveStream, _clearActiveStream, _supersedeActiveStream,
  _blockedByAnalyze, _waitWhileAnalyzePaused,
  setJobCancel, cancelJob,
});
})();
