// ── state ─────────────────────────────────────────────────────────────────────
let activeVideoId      = null;
let activeClipId       = null;
let _videos            = [];
let _clips             = [];
let _analyzeProfiles   = [];
let _contexts          = [];
let _analyzeFilename   = null;
let _editingContextId  = null;
let _clipFilter        = 'all';
let _clipSearch        = '';
let _clipScoreMin      = 0;
let _lastStatusChange  = null; // {clipId, fromStatus, timer}
let _confirmCallback   = null;
let _activeClipData    = null;
let _activeMediaFilename = null;
let _activeVideoData   = null;
let _bootRestoreDone   = false;

// ── score utils ───────────────────────────────────────────────────────────────
function _scoreIcon(score) {
  const color = score >= 0.7 ? 'var(--green)' : score >= 0.4 ? 'var(--yellow)' : 'var(--muted)';
  return `<span style="color:${color};font-size:10px" aria-hidden="true">⭐</span>`;
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
  extracting: 'Extracting', transcribing: 'Transcribing', segmented: 'Segmented', done: 'Analyzed',
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
  return err.message || JSON.stringify(err);
}

function stripRichMarkup(text) {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // ANSI escape codes
    .replace(/\[\/?\w+\]/g, '');             // Rich markup tags
}

function miniBar(abbr, fullName, val, color) {
  return `<div class="mini-bar-wrap" title="${fullName}: ${(val * 100).toFixed(0)}%">
    <span class="mini-bar-label">${abbr}</span>
    <div class="mini-bar-bg"><div class="mini-bar" style="width:${(val*100).toFixed(1)}%;background:${color}"></div></div>
  </div>`;
}

function _fmtDate(iso) {
  if (!iso) return 'never';
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  return d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ' at ' +
    d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
}

function _fmtAgo(isoString) {
  const diffS = (Date.now() - new Date(isoString).getTime()) / 1000;
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

// ── progress indicator ────────────────────────────────────────────────────────
const INGEST_STEPS = [
  {label: 'Extract',        patterns: ['Extracting audio']},
  {label: 'Transcribe',     patterns: ['Transcribing']},
  {label: 'Generate Clips', patterns: ['Generating clip']},
  {label: 'Energy',         patterns: ['Computing audio energy']},
  {label: 'Scenes',         patterns: ['Detecting scene']},
  {label: 'Score',          patterns: ['Scoring clips']},
];
const SCORE_STEPS = [
  {label: 'Energy',  patterns: ['Computing audio energy']},
  {label: 'Scenes',  patterns: ['Detecting scene']},
  {label: 'Scoring', patterns: ['Scoring clips']},
];

let _jobStepDefs   = [];
let _activeES      = null;
let _jobStartTime  = 0;
let _jobTimer      = null;
let _jobHideTimer  = null;
let _activeStepIdx = -1;

function startJobUI(stepDefs, jobLabel, cancellable = false) {
  _jobStepDefs   = stepDefs;
  _activeStepIdx = -1;
  _jobStartTime  = Date.now();
  if (_jobTimer) clearInterval(_jobTimer);
  _jobTimer = setInterval(_tickJobTimer, 1000);
  if (_jobHideTimer) { clearTimeout(_jobHideTimer); _jobHideTimer = null; }
  document.getElementById('job-steps').innerHTML =
    `<span style="color:var(--muted);margin-right:4px">${escHtml(jobLabel)}</span>` +
    stepDefs.map((s, i) => `<span class="step" id="step-${i}">${s.label}</span>`).join('');
  document.getElementById('job-status').classList.add('visible');
  document.getElementById('header-spacer').style.display = 'none';
  document.querySelectorAll('#btn-analyze,#btn-score,#btn-demo').forEach(b => b.disabled = true);
  const analyzeBtn = document.getElementById('btn-analyze');
  if (analyzeBtn) analyzeBtn.title = 'A job is already running';
  document.getElementById('btn-cancel-job').style.display = cancellable ? '' : 'none';
}

function updateJobUI(line) {
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
}

function _tickJobTimer() {
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
    const totalApproved = (_videos || []).reduce((n, v) => n + v.approved, 0);
    _updateDemoButton(totalApproved);
  }, 2000);
}

// ── SSE helper ────────────────────────────────────────────────────────────────
function streamSSE(url, onDone, stepDefs, jobLabel, cancellable = false) {
  if (stepDefs) startJobUI(stepDefs, jobLabel, cancellable);
  const es = new EventSource(url);
  _activeES = es;
  es.onmessage = e => {
    const text = JSON.parse(e.data);
    if (text === '__DONE__') {
      es.close();
      if (_activeES === es) _activeES = null;
      if (stepDefs) endJobUI();
      if (onDone) onDone();
      return;
    }
    appendLog(text);
    if (stepDefs) updateJobUI(text);
  };
  es.onerror = () => {
    es.close();
    if (_activeES === es) _activeES = null;
    appendLog('[connection error — job failed to start or server disconnected]');
    showToast('Job failed — see log for details', 'error');
    if (stepDefs) endJobUI();
    loadVideos();
  };
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
  if (_activeES) { _activeES.close(); _activeES = null; }
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
  document.querySelector('.log-header').setAttribute('aria-expanded', minimized ? 'false' : 'true');
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
  div.textContent = text;
  document.getElementById('log-lines').appendChild(div);
  const body = document.getElementById('log-body');
  body.scrollTop = body.scrollHeight;
}

// ── toast notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'success', durationMs = 4000) {
  const container = document.getElementById('toast-container');
  container.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}
