// Feature-map - Analyze (start + SSE progress) + Import from URL, both in the New Recording panel.
//   API: routes/analyze.py, routes/imports.py · Tests: tests/ui/test_ui_analyze.py
import { AppState } from './state.js';
import { escHtml, plural, formatApiError, _msToHms } from './format.js';
import { showConfirm } from './ui.js';
import { showToast, openLog, appendLog, netErrMsg, _diarizationReadiness, _diarizationNoteHtml } from './utils.js';
import {
  streamSSE, INGEST_STEPS, setJobCancel, _waitWhileAnalyzePaused, _setPausedUIFromStatus,
} from './jobs.js';
import {
  loadVideos, selectVideo, renderVideoDetail, _updateStartIngestButton, _reanalyzeParams,
} from './videos.js';
import { _splitPoints, _splitDurationS, _splitIgnored } from './split.js';

// ── shared live panel state ───────────────────────────────────────────────────
// _probedInfo and _panelDirty are read cross-file by videos.js (analyze-button
// enablement, dirty-guard on view switch) via an explicit `import` - export let
// gives videos.js a live ESM binding, so it always sees the current value.
export let _probedInfo    = null;
export let _panelDirty    = false;

// ── new recording panel ───────────────────────────────────────────────────────
let _probeTimer    = null;
// When set, the New Recording panel is re-analyzing an existing recording rather
// than ingesting a new file: the source picker / pre-split are hidden, settings
// default to the recording's original run, and Start submits {video_id, force}.
let _reanalyzeTarget = null;

function _isNewRecordingPanelOpen() {
  return document.getElementById('new-recording-panel').style.display !== 'none';
}

function _revealRecordingPanel() {
  document.getElementById('player-area').style.display = 'none';
  document.getElementById('player-resize-handle').style.display = 'none';
  document.getElementById('detail').style.display = 'none';
  document.getElementById('new-recording-panel').style.display = '';
  document.getElementById('btn-analyze').setAttribute('aria-pressed', 'true');
}

// Toggle the panel chrome between "new recording" and "re-analyze" modes.
function _applyPanelMode() {
  const reanalyze = !!_reanalyzeTarget;
  const src = document.getElementById('recording-source-field');
  if (src) src.style.display = reanalyze ? 'none' : '';
  const title = document.getElementById('new-recording-title');
  if (title) title.textContent = reanalyze ? 'Re-analyze recording' : 'New Recording';
  const warn = document.getElementById('reanalyze-warning');
  if (warn) {
    warn.style.display = reanalyze ? '' : 'none';
    warn.innerHTML = reanalyze ? _reanalyzeWarningHtml(_reanalyzeTarget) : '';
  }
  const btn = document.getElementById('btn-start-analyze');
  if (btn) {
    btn.textContent = reanalyze ? 'Re-analyze' : 'Start Analysis';
    btn.classList.toggle('danger', reanalyze);
    btn.classList.toggle('primary', !reanalyze);
  }
}

function _reanalyzeWarningHtml(target) {
  const exportedNote = target.exported > 0
    ? ` Files you already exported stay on disk, but the ${plural(target.exported, 'exported clip')} will be regenerated.`
    : '';
  return `<span aria-hidden="true">&#9888;</span>
    <span>Re-analyzing <strong>${escHtml(target.filename)}</strong> re-runs the full pipeline and replaces all
    current clips, including your approvals and any edited descriptions.${exportedNote}
    Adjust the settings below, then choose Re-analyze.</span>`;
}

async function openNewRecordingPanel() {
  if (_isNewRecordingPanelOpen()) return;
  if (document.getElementById('btn-analyze').disabled) return;
  if (document.getElementById('settings-panel').classList.contains('visible')) {
    window.closeSettings(openNewRecordingPanel);
    return;
  }
  _reanalyzeTarget = null;
  _revealRecordingPanel();

  document.getElementById('analyze-path').value = '';
  document.getElementById('estimate-area').innerHTML = '';
  const stEl = document.getElementById('subtitle-source-field');
  if (stEl) stEl.style.display = 'none';
  _probedInfo   = null;
  _panelDirty   = false;
  _updateStartIngestButton();
  window.hidePreSplitSection();
  hideImportUrlSection();
  _applyPanelMode();
  await _loadAnalysisDefaults();
  await _loadProfileDropdown();
  await _loadIngestContextPicker();
  await _loadDiarizationDefault();
  document.getElementById('analyze-path').focus();
}

// Re-analyze an already-analyzed recording: reuse the New Recording panel with
// its settings defaulted to the original run (editable), the source picker and
// pre-split hidden, and the existing file re-probed so the time estimate and
// captions picker still work.
async function openReanalyzePanel(video) {
  if (document.getElementById('btn-analyze').disabled) return;
  if (document.getElementById('settings-panel').classList.contains('visible')) {
    window.closeSettings(() => openReanalyzePanel(video));
    return;
  }
  _reanalyzeTarget = {
    id: video.id, filename: video.filename, path: video.path, exported: video.exported || 0,
    subtitleSource: video.analyze_run?.settings?.subtitle_source || null,
  };
  _revealRecordingPanel();

  document.getElementById('estimate-area').innerHTML = '';
  const stEl = document.getElementById('subtitle-source-field');
  if (stEl) stEl.style.display = 'none';
  _probedInfo   = null;
  _panelDirty   = false;
  _updateStartIngestButton();
  window.hidePreSplitSection();
  hideImportUrlSection();
  _applyPanelMode();
  await _loadProfileDropdown();
  await _loadIngestContextPicker();
  await _loadDiarizationDefault();
  await _applyReanalyzeSettings(video);
  document.getElementById('analyze-path').value = video.path;
  runProbe(video.path);
}

// Default the panel's controls to how this recording was originally analyzed.
async function _applyReanalyzeSettings(video) {
  const params = await _reanalyzeParams(video);
  _setSelectIfPresent('analyze-model',       params.model);
  _setSelectIfPresent('analyze-scene-mode',  params.scene_mode);
  _setSelectIfPresent('analyze-energy-mode', params.energy_mode);
  _setSelectIfPresent('analyze-profile',     params.profile || '__default__');
  const diarBox = document.getElementById('analyze-diarize');
  if (diarBox && !diarBox.disabled && typeof params.diarize === 'boolean') {
    diarBox.checked = params.diarize;
  }
  _preselectContexts(params.context_names);
}

function _preselectContexts(ids) {
  const wanted = new Set(ids || []);
  document.querySelectorAll('.ctx-pill').forEach(pill => {
    pill.classList.toggle('selected', wanted.has(pill.dataset.ctxId));
  });
  const note = document.getElementById('ctx-none-selected-note');
  if (note) note.style.display = document.querySelectorAll('.ctx-pill.selected').length ? 'none' : '';
}

// Pre-fill the panel's model/scene/energy selects from the Settings-managed
// config defaults; the panel's values remain a per-run override.
async function _loadAnalysisDefaults() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    _setSelectIfPresent('analyze-model',       cfg.whisper_model);
    _setSelectIfPresent('analyze-scene-mode',  cfg.scene_detection_mode);
    _setSelectIfPresent('analyze-energy-mode', cfg.energy_mode);
  } catch { /* config unreachable - keep the static defaults */ }
}

function _setSelectIfPresent(id, value) {
  const sel = document.getElementById(id);
  if (!sel || !value) return;
  if (Array.from(sel.options).some(o => o.value === value)) sel.value = value;
}

function closeNewRecordingPanel() {
  if (!_isNewRecordingPanelOpen()) return;
  if (_panelDirty) {
    showConfirm(
      'Discard new recording?',
      'You have unsaved configuration. Close anyway?',
      'Discard',
      _doCloseNewRecordingPanel,
      true,
    );
    return;
  }
  _doCloseNewRecordingPanel();
}

function _doCloseNewRecordingPanel() {
  clearTimeout(_probeTimer);
  document.getElementById('new-recording-panel').style.display = 'none';
  document.getElementById('player-area').style.display = '';
  document.getElementById('player-resize-handle').style.display = '';
  document.getElementById('detail').style.display = '';
  document.getElementById('btn-analyze').setAttribute('aria-pressed', 'false');
  _panelDirty = false;
  _reanalyzeTarget = null;
}

async function _loadIngestContextPicker() {
  AppState.contexts = await fetch('/api/contexts').then(r => r.json()).catch(() => []);
  const list = document.getElementById('analyze-context-list');
  if (!AppState.contexts.length) {
    list.innerHTML = `<div style="font-size:12px;color:var(--muted)">
      No World Contexts set up - clip descriptions will be generic.
      <button type="button" class="btn ghost" data-act="add-context"
              style="font-size:11px;padding:0 6px;color:var(--accent);display:inline-flex">Add one →</button>
    </div>`;
    return;
  }
  list.innerHTML =
    `<div class="ctx-picker" id="ctx-picker">` +
    AppState.contexts.map(c =>
      `<button type="button" class="ctx-pill" data-ctx-id="${escHtml(c.context_id)}">${escHtml(c.display_name || c.context_id)}</button>`
    ).join('') +
    `</div>` +
    `<div id="ctx-none-selected-note" style="font-size:11px;color:var(--muted);margin-top:6px">No context selected - descriptions will be generic</div>`;
}

// Delegated once at module load - #analyze-context-list is a stable container,
// only its innerHTML is replaced by _loadIngestContextPicker's re-renders.
function _handleContextListClick(e) {
  if (e.target.closest('[data-act="add-context"]')) {
    closeNewRecordingPanel();
    window.openContextManager();
    return;
  }
  const pill = e.target.closest('.ctx-pill');
  if (pill) _toggleCtxPill(pill);
}

function _toggleCtxPill(btn) {
  btn.classList.toggle('selected');
  const note = document.getElementById('ctx-none-selected-note');
  if (note) note.style.display = document.querySelectorAll('.ctx-pill.selected').length ? 'none' : '';
}

function _selectedContextIds() {
  return Array.from(document.querySelectorAll('.ctx-pill.selected')).map(b => b.dataset.ctxId);
}

async function _loadDiarizationDefault() {
  const box  = document.getElementById('analyze-diarize');
  const note = document.getElementById('analyze-diarize-note');
  if (!box || !note) return;
  try {
    const readiness = await _diarizationReadiness();
    if (!readiness.ready) {
      box.checked = false;
      box.disabled = true;
      note.innerHTML = _diarizationNoteHtml(readiness.reason, 'closeNewRecordingPanel();openSettings()');
    } else {
      const enabledByDefault = readiness.backend !== 'null';
      box.disabled = false;
      box.checked = enabledByDefault;
      note.textContent = enabledByDefault ? 'On by default (from Settings)' : 'Off by default (from Settings)';
    }
  } catch { /* leave the checkbox at its default state on error */ }
}

async function _loadProfileDropdown() {
  const sel = document.getElementById('analyze-profile');
  try {
    AppState.analyzeProfiles = await fetch('/api/profiles').then(r => r.json());
    sel.innerHTML = AppState.analyzeProfiles.map(p =>
      `<option value="${escHtml(p.name)}">${escHtml(p.display_name)}</option>`
    ).join('');
  } catch { AppState.analyzeProfiles = []; }
}

function scheduleProbe() {
  clearTimeout(_probeTimer);
  const path = document.getElementById('analyze-path').value.trim();
  if (!path) {
    document.getElementById('estimate-area').innerHTML = '';
    _probedInfo = null;
    _updateStartIngestButton();
    return;
  }
  _panelDirty = true;
  document.getElementById('estimate-area').innerHTML = '<div class="probing-spinner">Inspecting file...</div>';
  _probeTimer = setTimeout(() => runProbe(path), 700);
}

async function runProbe(path) {
  try {
    const res = await fetch('/api/probe', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body:   JSON.stringify({path}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      _probedInfo = null;
      _updateStartIngestButton();
      document.getElementById('estimate-area').innerHTML =
        `<div style="color:var(--red);font-size:12px">${escHtml(formatApiError(err))}</div>`;
      return;
    }
    _probedInfo = await res.json();
    _updateStartIngestButton();
    _renderSubtitleSourcePicker(_probedInfo);
    if (_reanalyzeTarget) _selectSubtitleSource(_reanalyzeTarget.subtitleSource);
    runEstimate();
    if (!_reanalyzeTarget) window.initPreSplitDuration(_probedInfo.duration_s);
  } catch (err) {
    _probedInfo = null;
    _updateStartIngestButton();
    window.hidePreSplitSection();
    document.getElementById('estimate-area').innerHTML =
      `<div style="color:var(--red);font-size:12px">Could not inspect file: ${escHtml(String(err.message || err))}</div>`;
  }
}

function _renderSubtitleSourcePicker(info) {
  let el = document.getElementById('subtitle-source-field');
  if (!el) {
    const anchor = document.getElementById('estimate-area');
    el = document.createElement('div');
    el.id = 'subtitle-source-field';
    el.className = 'field';
    anchor.before(el);
  }
  el.style.display = '';
  const opts = [`<option value="">Transcribe with Whisper (default)</option>`];
  if (info.srt_sidecar) {
    const name = info.srt_sidecar.split(/[\\/]/).pop();
    opts.push(`<option value="${escHtml(info.srt_sidecar)}">Use SRT sidecar: ${escHtml(name)}</option>`);
  }
  for (const s of info.subtitle_streams || []) {
    const label = s.title || s.language || `stream ${s.index}`;
    opts.push(`<option value="stream:${s.index}">Use embedded captions: ${escHtml(label)}</option>`);
  }
  opts.push(`<option value="__pick-srt__">Choose SRT file&#8230;</option>`);
  el.innerHTML = `<label for="analyze-subtitle-source">Captions</label>
    <select id="analyze-subtitle-source">${opts.join('')}</select>`;
  document.getElementById('analyze-subtitle-source')
    .addEventListener('change', e => _onSubtitleSourceChange(e.target));
}

// Add (or update) the "External SRT: name" option for an arbitrary picked/recorded
// SRT path, inserted just before the "Choose SRT file…" entry.
function _addExternalSrtOption(sel, srtPath) {
  let ext = document.getElementById('subtitle-external-option');
  if (!ext) {
    ext = document.createElement('option');
    ext.id = 'subtitle-external-option';
    sel.insertBefore(ext, sel.querySelector('option[value="__pick-srt__"]'));
  }
  ext.value = srtPath;
  ext.textContent = `External SRT: ${srtPath.split(/[\\/]/).pop()}`;
}

// Default the captions picker to a previously-used source (re-analyze). A path or
// stream already listed is simply selected; an arbitrary external SRT path gets an
// injected option first. An embedded stream absent from this file is left at default.
function _selectSubtitleSource(srtSource) {
  const sel = document.getElementById('analyze-subtitle-source');
  if (!sel || !srtSource) return;
  const known = Array.from(sel.options).some(o => o.value === srtSource);
  if (!known) {
    if (srtSource.startsWith('stream:')) return;
    _addExternalSrtOption(sel, srtSource);
  }
  sel.value = srtSource;
  sel.dataset.prev = srtSource;
}

// "Choose SRT file…" opens the native picker; a successful pick becomes a
// selectable "External SRT: name" option, cancel restores the previous choice.
async function _onSubtitleSourceChange(sel) {
  if (sel.value !== '__pick-srt__') {
    sel.dataset.prev = sel.value;
    runEstimate();
    return;
  }
  const prev = sel.dataset.prev || '';
  try {
    const data = await fetch('/api/pick-file?kind=captions').then(r => r.json());
    if (data.path) {
      _addExternalSrtOption(sel, data.path);
      sel.value = data.path;
      sel.dataset.prev = data.path;
    } else {
      sel.value = prev;
    }
  } catch {
    sel.value = prev;
  }
  runEstimate();
}

function _selectedSubtitleSource() {
  const sel = document.getElementById('analyze-subtitle-source');
  if (!sel || !sel.value || sel.value === '__pick-srt__') return null;
  return sel.value;
}

async function runEstimate() {
  if (!_probedInfo) return;
  const profileName = document.getElementById('analyze-profile').value;
  const profile     = AppState.analyzeProfiles.find(p => p.name === profileName);
  const transcribeTracks = profile
    ? profile.assignments.filter(a => a.do_transcribe).length
    : undefined;
  const extractTracks = profile
    ? profile.assignments.filter(a => a.do_score || a.do_transcribe).length
    : _probedInfo.audio_tracks;
  const usingExternalCaptions = !!_selectedSubtitleSource();
  try {
    const res = await fetch('/api/estimate', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body:   JSON.stringify({
        duration_s:        _probedInfo.duration_s,
        model:             document.getElementById('analyze-model').value,
        audio_tracks:      extractTracks,
        transcribe_tracks: usingExternalCaptions ? 0 : transcribeTracks,
        has_gpu:           true,
        scene_mode:        document.getElementById('analyze-scene-mode').value,
        energy_mode:       document.getElementById('analyze-energy-mode').value,
        diarize:           !!document.getElementById('analyze-diarize')?.checked,
      }),
    });
    if (!res.ok) return;
    renderEstimate(_probedInfo, await res.json());
  } catch { /* estimate is non-critical */ }
}

const _warnThresholdMin = 30;

// Shared by the New Recording panel's own probe estimate (renderEstimate) and
// the Import from URL inspect card (renderImportUrlEstimate) - both call
// /api/estimate and show the same per-step breakdown, just under a different
// header (local file probe info vs. downloaded-video metadata).
function _estimateBodyHTML(data) {
  AppState.lastEstimateSteps = data.steps;
  const warnS = _warnThresholdMin * 60;
  const tClass = s => s >= warnS ? 't-warn' : s >= warnS / 3 ? 't-medium' : 't-fast';

  const rows = data.steps.map(s => {
    const isWarn = s.seconds >= warnS;
    return `
      <div class="estimate-row${isWarn ? ' warn' : ''}">
        <span class="warn-icon">${isWarn ? '&#9888;' : ''}</span>
        <span class="estimate-step">${s.name}</span>
        <span class="estimate-note">${s.note}</span>
        <span class="estimate-time ${tClass(s.seconds)}">${s.hms}</span>
      </div>`;
  }).join('');

  const totalWarn  = data.total_seconds >= warnS;
  const totalBadge = totalWarn ? `<span class="total-warn-badge">&#9888; Long job</span>` : '';
  const pctLine    = data.pct_of_video != null
    ? `<div class="estimate-pct">&#8776; ${data.pct_of_video.toFixed(1)}% of recording duration</div>`
    : '';
  const sourceLine = `<div class="estimate-source">${
    data.source === 'measured' ? 'Based on your last runs on this model/device' : 'Rough estimate - no matching past runs yet'
  }</div>`;
  const longRunWarning = data.long_run_warning ? `
    <div class="long-run-warning">
      <span aria-hidden="true">&#9888;</span>
      <span>This is a long analysis (over ${data.warn_hours}h estimated). Consider splitting the
      recording into smaller segments before analyzing (see Pre-split below), or analyzing fewer
      recordings at once. You can also pause between videos, or let auto-pause hold it if your
      GPU runs hot (Settings &rarr; Hardware).</span>
    </div>` : '';

  return `
      ${rows}
      <div class="estimate-total">
        <span>Total estimated</span>
        <span style="display:flex;align-items:center;gap:8px">
          ${totalBadge}
          <span class="${tClass(data.total_seconds)}">${data.total_hms}</span>
        </span>
      </div>
      ${pctLine}
      ${sourceLine}
      ${longRunWarning}`;
}

function renderEstimate(info, data) {
  document.getElementById('estimate-area').innerHTML = `
    <div class="estimate-box">
      <div class="probe-info">
        ${escHtml(info.filename)} &middot; ${info.duration_hms} &middot;
        ${info.width}&#x2715;${info.height} @ ${info.fps.toFixed(0)}fps &middot;
        ${plural(info.audio_tracks, 'audio track')}
      </div>
      ${_estimateBodyHTML(data)}
    </div>`;
}

// Before starting, warn if the speech model is still downloading - analysis will
// pause at the transcription step until it finishes (it waits on the same HF
// download rather than starting a second one). Never silently block or duplicate.
async function startAnalyze() {
  const path = document.getElementById('analyze-path').value.trim();
  if (!path) return;
  let status = null;
  try {
    status = await fetch('/api/llm/download-status').then(r => r.json());
  } catch { /* can't tell - don't block the user */ }
  if (status && status.whisper_downloading) {
    const pct = window.getWhisperDownloadPct ? window.getWhisperDownloadPct() : null;
    const pctText = (typeof pct === 'number' && pct >= 0) ? ` (${pct}%)` : '';
    showConfirm(
      'Speech model still downloading',
      `The speech-to-text model is still downloading${pctText}. Analysis will pause at the ` +
        `transcription step until it finishes. Start anyway, or wait for the download to complete?`,
      'Start anyway',
      _doStartAnalyze,
      false,
      'Wait',
    );
    return;
  }
  _doStartAnalyze();
}

async function _doStartAnalyze() {
  const path       = document.getElementById('analyze-path').value.trim();
  const model      = document.getElementById('analyze-model').value;
  const profileVal = document.getElementById('analyze-profile').value;
  const profile    = (!profileVal || profileVal === '__default__') ? null : profileVal;
  if (!path) return;

  const energyMode    = document.getElementById('analyze-energy-mode').value;
  const sceneMode     = document.getElementById('analyze-scene-mode').value;
  const diarizeEl     = document.getElementById('analyze-diarize');
  const diarize       = diarizeEl && !diarizeEl.disabled ? diarizeEl.checked : null;
  const contextNames  = _selectedContextIds();
  const subtitleSource = _selectedSubtitleSource();

  // _splitPoints/_splitDurationS/_splitIgnored are split.js's shared live-edit
  // state, imported as live ESM bindings (export let) so they always reflect
  // the pre-split editor's current plan.
  const preSplitToggle = document.getElementById('pre-split-toggle');
  if (preSplitToggle && preSplitToggle.checked && _splitPoints.length > 0 && _splitDurationS > 0) {
    const pts      = [0, ..._splitPoints, _splitDurationS];
    const segments = pts.slice(0, -1)
      .map((start, i) => ({ start_s: start, end_s: pts[i + 1], ignored: _splitIgnored.has(i) }))
      .filter(s => !s.ignored);
    _panelDirty = false;
    _doCloseNewRecordingPanel();
    openLog();
    _analyzeSegmentsSequentially(
      path, model, profile, energyMode, sceneMode, contextNames, subtitleSource, diarize, segments, 0,
    );
    return;
  }

  const target = _reanalyzeTarget;
  const btn = document.getElementById('btn-start-analyze');
  btn.disabled = true;
  btn.textContent = target ? 'Starting re-analysis…' : 'Starting…';

  const payload = {
    path, model, profile, energy_mode: energyMode, scene_mode: sceneMode,
    diarize, context_names: contextNames, subtitle_source: subtitleSource,
  };
  if (target) { payload.video_id = target.id; payload.force = true; }

  const startRes = await fetch('/api/analyze/start', {
    method:  'POST',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify(payload),
  });

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    showToast(formatApiError(err) || `Failed to start ${target ? 're-analysis' : 'analysis'}`, 'error');
    btn.disabled = false;
    btn.textContent = target ? 'Re-analyze' : 'Start Analysis';
    return;
  }

  const filename = target ? target.filename : path.split(/[\\/]/).pop();
  AppState.analyzeFilename = filename;
  _panelDirty = false;
  _doCloseNewRecordingPanel();
  loadVideos();  // surface the recording in the sidebar immediately (placeholder until its row exists)
  openLog();
  appendLog(`${target ? 'Re-analyzing' : 'Analyzing'}: ${filename}`);
  _streamAnalyzeEvents(filename);
}

// Attach the header progress bar + in-detail panel to the analyze SSE stream.
// Shared by a fresh start and by reattachAnalysis() after a page refresh - the
// stream replays everything so far, so both paths render the same live UI.
function _streamAnalyzeEvents(filename) {
  streamSSE(
    '/api/analyze/events',
    async () => {
      await loadVideos();
      const v = AppState.videos.find(x => x.filename === filename);
      AppState.analyzeFilename = null;
      _rerenderActiveVideoDetail();
      _showAnalysisToast(v);
      _surfaceAnalyzeWarnings(v);
      if (v) _warmPreviewProxy(v.id);
      window.SoundFx.play('analysis');
    },
    INGEST_STEPS,
    `Analyzing ${filename}`,
    true,
    null,
    true,
  );
}

// On page load, reconnect to an analysis that was already running server-side
// (detected via /api/status). The subprocess kept going through the refresh; we
// rebuild the sidebar row, header progress bar, and in-detail progress panel by
// replaying the job's buffered output.
async function reattachAnalysis(filename, paused = false) {
  if (!filename || AppState.analyzeFilename === filename) return;
  AppState.analyzeFilename = filename;
  openLog();
  appendLog(`Reconnected to analysis in progress: ${filename}`);
  await loadVideos();
  _rerenderActiveVideoDetail();
  _streamAnalyzeEvents(filename);
  if (paused) _setPausedUIFromStatus(true);
}

function _rerenderActiveVideoDetail() {
  if (AppState.activeVideoId == null) return;
  const active = AppState.videos.find(x => x.id === AppState.activeVideoId);
  if (active) renderVideoDetail(active, null);
}

async function _analyzeSegmentsSequentially(
  path, model, profile, energyMode, sceneMode, contextNames, subtitleSource, diarize, segments, index,
) {
  if (index >= segments.length) {
    loadVideos().then(() =>
      showToast(`Analysis complete - ${plural(segments.length, 'segment')}`)
    );
    window.SoundFx.play('analysis');
    return;
  }
  await _waitWhileAnalyzePaused();
  const seg = segments[index];
  appendLog(`Analyzing segment ${index + 1}/${segments.length}: ${window._fmtSplitTime(seg.start_s)}–${window._fmtSplitTime(seg.end_s)}`);
  fetch('/api/analyze/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      path,
      model,
      profile,
      energy_mode:      energyMode,
      scene_mode:       sceneMode,
      diarize,
      context_names:    contextNames,
      subtitle_source:  subtitleSource,
      segment_start_s:  seg.start_s,
      segment_end_s:    seg.end_s,
    }),
  }).then(res => {
    if (!res.ok) {
      res.json().catch(() => ({})).then(err =>
        showToast(formatApiError(err) || `Failed to start segment ${index + 1}`, 'error')
      );
      return;
    }
    streamSSE(
      '/api/analyze/events',
      () => _analyzeSegmentsSequentially(
        path, model, profile, energyMode, sceneMode, contextNames, subtitleSource, diarize, segments, index + 1,
      ),
      INGEST_STEPS,
      `Segment ${index + 1}/${segments.length}`,
      false,
      null,
      true,
    );
  }).catch(err => showToast(netErrMsg(err), 'error'));
}

function _showAnalysisToast(video) {
  const count = video ? video.clip_count : 0;
  const canJump = video && AppState.activeVideoId !== video.id;
  showToast(`Analysis complete - ${plural(count, 'clip')} found`, 'success', {
    durationMs: 8000,
    ...(canJump ? {action: {label: 'Review', onClick: () => selectVideo(video.id)}} : {}),
  });
}

// Warm the 720p preview proxy in the background after analysis finishes. The
// proxy build used to run inline in the analyze subprocess and blocked "Analysis
// complete" while the whole recording re-encoded; now completion is instant and
// this drains the existing encode SSE quietly (no job pill). Non-fatal - if it's
// skipped or the page closes, the proxy still builds lazily on first preview.
async function _warmPreviewProxy(videoId) {
  try {
    const status = await fetch(`/api/videos/${videoId}/proxy-status`).then(r => r.ok ? r.json() : null);
    if (!status || status.available || status.generating) return;
    const response = await fetch(`/api/videos/${videoId}/proxy/generate`);
    if (!response.ok || !response.body) return;
    const reader = response.body.getReader();
    while (true) { const {done} = await reader.read(); if (done) break; }
  } catch (_) {
    // Preview is a convenience; a failed warm must never surface as an error.
  }
}

// A run can finish "successfully" while a signal was skipped (most often the LLM,
// leaving clips with a basic description). Those reasons are recorded in the run
// metadata; surface them as dismissible warnings so they aren't lost in the log.
async function _surfaceAnalyzeWarnings(video) {
  if (!video) return;
  try {
    const detail = await fetch(`/api/videos/${video.id}`).then(r => r.json());
    for (const warning of (detail?.analyze_run?.warnings || [])) {
      showToast(warning, 'warning', {durationMs: 14000});
    }
  } catch (_) {
    // A missing warning must never break the completion flow.
  }
}

// ── native file picker ────────────────────────────────────────────────────────
async function pickFile() {
  const btn = document.getElementById('btn-browse-recording');
  const orig = btn.textContent;
  btn.textContent = '…';
  btn.disabled = true;
  try {
    const data = await fetch('/api/pick-file').then(r => r.json());
    if (data.path) {
      document.getElementById('analyze-path').value = data.path;
      scheduleProbe();
    }
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
}

// ── Import from URL (Twitch VOD / YouTube) ────────────────────────────────────
let _importUrlInfo = null;
let _importUrlUrl  = null;

function showImportUrlSection() {
  document.getElementById('recording-source-field').style.display = 'none';
  document.getElementById('import-url-field').style.display = '';
  document.getElementById('analyze-path').value = '';
  scheduleProbe();
  document.getElementById('import-url-input').focus();
}

function hideImportUrlSection() {
  document.getElementById('recording-source-field').style.display = '';
  document.getElementById('import-url-field').style.display = 'none';
  document.getElementById('import-url-input').value = '';
  document.getElementById('import-url-inspect-area').innerHTML = '';
  _importUrlInfo = null;
  _importUrlUrl  = null;
}

async function checkImportUrl() {
  const url = document.getElementById('import-url-input').value.trim();
  const area = document.getElementById('import-url-inspect-area');
  if (!url) return;
  _panelDirty = true;
  const btn = document.getElementById('btn-check-url');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  area.innerHTML = '<div class="probing-spinner">Checking link...</div>';
  _importUrlInfo = null;
  try {
    const res = await fetch('/api/import-url/inspect', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body:   JSON.stringify({url}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      area.innerHTML = `<div style="color:var(--red);font-size:12px">${escHtml(formatApiError(data))}</div>`;
      return;
    }
    _importUrlInfo = data;
    _importUrlUrl  = url;
    renderImportUrlInspect(data);
  } catch (err) {
    area.innerHTML = `<div style="color:var(--red);font-size:12px">Could not check link: ${escHtml(String(err.message || err))}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Check link';
  }
}

function _fmtDurationS(seconds) {
  return _msToHms(Math.max(0, seconds || 0) * 1000);
}

function _fmtBytesHuman(n) {
  if (!n || n <= 0) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = n;
  for (const unit of units) {
    if (size < 1024 || unit === 'GB') return `${unit === 'B' ? Math.round(size) : size.toFixed(1)} ${unit}`;
    size /= 1024;
  }
  return `${size.toFixed(1)} GB`;
}

function renderImportUrlInspect(info) {
  const area = document.getElementById('import-url-inspect-area');
  const metaParts = [
    escHtml(info.uploader || 'Unknown channel'),
    _fmtDurationS(info.duration_s),
    ...(info.category ? [escHtml(info.category)] : []),
    ...(info.upload_date ? [escHtml(info.upload_date)] : []),
    `est. ${_fmtBytesHuman(info.estimated_size_bytes)}`,
  ];
  const alreadyNote = info.already_imported ? `
    <div class="long-run-warning">
      <span aria-hidden="true">&#9888;</span>
      <span>Already imported as "${escHtml(info.existing_filename || '')}". Downloading again saves a separate copy.</span>
    </div>` : '';

  area.innerHTML = `
    <div class="estimate-box">
      <div class="probe-info"><strong>${escHtml(info.title)}</strong><br>${metaParts.join(' &middot; ')}</div>
      <div id="import-url-estimate-body"><div class="probing-spinner">Estimating processing time...</div></div>
      ${alreadyNote}
    </div>
    <div class="new-recording-actions" style="padding-top:10px">
      <button class="btn primary" id="btn-start-import">Download</button>
    </div>`;
  document.getElementById('btn-start-import').addEventListener('click', startImportUrlDownload);
  _renderImportUrlEstimate(info.duration_s);
}

async function _renderImportUrlEstimate(durationS) {
  const body = document.getElementById('import-url-estimate-body');
  try {
    const res = await fetch('/api/estimate', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      // Downloaded VODs have exactly one audio track (see roadmap plan 08) -
      // the default one-track/one-transcribe estimate is trivially right.
      body:   JSON.stringify({duration_s: durationS, audio_tracks: 1, transcribe_tracks: 1, has_gpu: true}),
    });
    if (!body) return;
    if (!res.ok) { body.innerHTML = ''; return; }
    body.innerHTML = _estimateBodyHTML(await res.json());
  } catch {
    if (body) body.innerHTML = '';
  }
}

async function startImportUrlDownload() {
  if (!_importUrlInfo || !_importUrlUrl) return;
  const btn = document.getElementById('btn-start-import');
  btn.disabled = true;
  btn.textContent = 'Starting…';

  const startRes = await fetch('/api/import-url/start', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body:   JSON.stringify({url: _importUrlUrl}),
  });
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    showToast(formatApiError(err) || 'Failed to start download', 'error');
    btn.disabled = false;
    btn.textContent = 'Download';
    return;
  }

  const title = _importUrlInfo.title;
  _panelDirty = false;
  _doCloseNewRecordingPanel();
  openLog();
  appendLog(`Downloading: ${title}`);
  streamSSE(
    '/api/import-url/events',
    () => _onImportUrlDownloadDone(title),
    [{label: 'Download', patterns: ['[Download]']}],
    `Importing ${title}`,
    true,
    line => _onImportUrlLine(line),
  );
  setJobCancel({
    url:     '/api/import-url/cancel',
    title:   'Cancel download?',
    body:    'The partial download will be discarded. You can start the import again later.',
    confirm: 'Cancel Download',
    logMsg:  '[Import cancelled]',
  });
}

// Mirrors url_import.py's format_progress_line/parse_progress_line - keep the
// three in sync if that format ever changes.
const _IMPORT_PROGRESS_RE = /^\[Download\] ([\d.]+)% of (\S+)(?: at (\S+)\/s)?(?:, ETA (\S+))?$/;
const _IMPORT_DONE_RE     = /^\[Imported\] (.+)$/;

let _lastImportedPath = null;

function _onImportUrlLine(line) {
  const imported = line.match(_IMPORT_DONE_RE);
  if (imported) { _lastImportedPath = imported[1].trim(); return; }

  const m = line.match(_IMPORT_PROGRESS_RE);
  const el = document.getElementById('step-0');
  if (!m || !el) return;
  const pct = parseFloat(m[1]);
  const speedPart = m[3] ? ` at ${m[3]}/s` : '';
  const etaPart = m[4] ? ` (~${m[4]} left)` : '';
  el.textContent = `Download · ${pct.toFixed(0)}%${speedPart}${etaPart}`;
  el.style.backgroundImage = `linear-gradient(to right, var(--green) ${pct}%, var(--accent) ${pct}%)`;
}

function _onImportUrlDownloadDone(title) {
  showToast('Download complete', 'success');
  window.SoundFx.play('analysis');
  if (!_lastImportedPath) {
    showToast('Download finished, but the file path was not reported - open it from the downloads folder.', 'warning');
    return;
  }
  const path = _lastImportedPath;
  _lastImportedPath = null;
  // The job just finished, but endJobUI() only re-enables #btn-analyze after its
  // cosmetic 2s "done" pill delay - force it open now instead of waiting.
  document.getElementById('btn-analyze').disabled = false;
  openNewRecordingPanel().then(() => {
    document.getElementById('analyze-path').value = path;
    scheduleProbe();
  });
}

// ── profile manager ───────────────────────────────────────────────────────────
const TRACK_LABELS = ['player_voice', 'ingame_voicechat', 'game_sounds', 'combined', 'unlabeled'];
const TRACK_LABEL_DISPLAY = {
  player_voice:      'Player voice',
  ingame_voicechat:  'In-game voice chat',
  game_sounds:       'Game sounds',
  combined:          'Combined (all tracks)',
  unlabeled:         'Unlabeled',
};
let _allProfiles = [];
let _profileEditorDirty = false;
let _profileModalOpener = null;

async function openProfileManager() {
  _profileModalOpener = document.activeElement;
  document.getElementById('profile-modal').classList.add('visible');
  document.getElementById('profile-editor').style.display = 'none';
  await _refreshProfileList();
  setTimeout(() => document.querySelector('#profile-modal .btn.primary')?.focus(), 50);
}

function closeProfileManager() {
  if (!document.getElementById('profile-modal').classList.contains('visible')) return;
  const editor = document.getElementById('profile-editor');
  if (editor && editor.style.display !== 'none' && _profileEditorDirty) {
    showConfirm(
      'Discard changes?',
      'You have unsaved changes in the track layout editor. Close without saving?',
      'Discard',
      () => { _profileEditorDirty = false; _doCloseProfileManager(); },
      true,
    );
    return;
  }
  _doCloseProfileManager();
}

function _doCloseProfileManager() {
  document.getElementById('profile-modal').classList.remove('visible');
  _loadProfileDropdown();
  const opener = _profileModalOpener;
  _profileModalOpener = null;
  if (opener?.focus) opener.focus();
}

async function _refreshProfileList() {
  _allProfiles = await fetch('/api/profiles').then(r => r.json());
  const el = document.getElementById('profile-list');
  if (!_allProfiles.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px">No track layouts saved.</div>';
    return;
  }
  el.innerHTML = _allProfiles.map(p => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:13px">${p.builtin ? '<span title="Built-in layout - cannot be edited or deleted">&#128274;</span> ' : ''}${escHtml(p.display_name)}</span>
      <span style="color:var(--muted);font-size:12px">${plural(p.num_tracks, 'track')}</span>
      ${!p.builtin ? `
        <button class="btn" style="padding:4px 10px;font-size:12px" data-edit-profile="${escHtml(p.name)}">Edit</button>
        <button class="btn danger" style="padding:4px 10px;font-size:12px" data-delete-profile="${escHtml(p.name)}">Delete</button>
      ` : ''}
    </div>`).join('');
  el.onclick = e => {
    const editBtn   = e.target.closest('[data-edit-profile]');
    const deleteBtn = e.target.closest('[data-delete-profile]');
    if (editBtn)   editProfile(editBtn.dataset.editProfile);
    if (deleteBtn) deleteProfile(deleteBtn.dataset.deleteProfile);
  };
}

function openNewProfile() {
  _profileEditorDirty = false;
  _clearPeNameError();
  document.getElementById('profile-editor').style.display = '';
  document.getElementById('pe-name').value = '';
  document.getElementById('pe-numtracks').value = 2;
  renderTrackRows();
  setTimeout(() => document.getElementById('pe-name')?.focus(), 50);
}

function editProfile(name) {
  const p = _allProfiles.find(x => x.name === name);
  if (!p) return;
  _profileEditorDirty = false;
  _clearPeNameError();
  document.getElementById('profile-editor').style.display = '';
  document.getElementById('pe-name').value     = p.name;
  document.getElementById('pe-numtracks').value = p.num_tracks;
  renderTrackRows(p.assignments);
}

function renderTrackRows(existingAssignments) {
  const n   = parseInt(document.getElementById('pe-numtracks').value) || 1;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const a     = existingAssignments?.[i] ?? null;
    const label = a ? a.label : (i === 0 ? 'combined' : 'unlabeled');
    const doTx  = a ? (a.do_transcribe !== false) : (label !== 'game_sounds');
    const doSc  = a ? (a.do_score !== false)      : (label !== 'game_sounds');
    const opts  = TRACK_LABELS.map(l =>
      `<option value="${l}"${l === label ? ' selected' : ''}>${TRACK_LABEL_DISPLAY[l] || l}</option>`
    ).join('');
    rows.push(`
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px">
        <span style="color:var(--muted);width:60px;flex-shrink:0">Track ${i + 1}</span>
        <select id="pe-label-${i}"
                style="flex:1;padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px">${opts}</select>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap"
               title="Transcribe this track's speech">
          <input type="checkbox" id="pe-tx-${i}" ${doTx ? 'checked' : ''}> Transcribe
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap"
               title="Use this track for scoring">
          <input type="checkbox" id="pe-sc-${i}" ${doSc ? 'checked' : ''}> Score
        </label>
      </div>`);
  }
  document.getElementById('pe-tracks').innerHTML = rows.join('');
}

function onLabelChange(i) {
  const isGameSound = document.getElementById(`pe-label-${i}`).value === 'game_sounds';
  document.getElementById(`pe-tx-${i}`).checked = !isGameSound;
  document.getElementById(`pe-sc-${i}`).checked = !isGameSound;
}

function _peNameError(msg) {
  const errEl = document.getElementById('pe-name-error');
  errEl.textContent = msg;
  errEl.style.display = '';
  document.getElementById('pe-name').focus();
}

function _clearPeNameError() {
  const errEl = document.getElementById('pe-name-error');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
}

async function saveProfile() {
  const name = document.getElementById('pe-name').value.trim();
  if (!name)                 { _peNameError('Enter a name for this layout'); return; }
  if (name.startsWith('__')) { _peNameError('Names starting with "__" are reserved for built-in layouts'); return; }
  const n = parseInt(document.getElementById('pe-numtracks').value) || 1;
  const assignments = Array.from({length: n}, (_, i) => ({
    stream_position: i,
    label:           document.getElementById(`pe-label-${i}`).value,
    do_transcribe:   document.getElementById(`pe-tx-${i}`).checked,
    do_score:        document.getElementById(`pe-sc-${i}`).checked,
  }));
  const res = await fetch('/api/profiles', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body:   JSON.stringify({name, assignments}),
  });
  if (!res.ok) {
    const e = await res.json();
    showToast(e.detail || 'Save failed', 'error');
    return;
  }
  _profileEditorDirty = false;
  document.getElementById('profile-editor').style.display = 'none';
  await _refreshProfileList();
  showToast(`Track layout "${name}" saved`);
}

function deleteProfile(name) {
  showConfirm(
    'Delete track layout?',
    `Delete track layout <strong>${escHtml(name)}</strong>? This cannot be undone.`,
    'Delete',
    () => _doDeleteProfile(name),
    true,
  );
}

async function _doDeleteProfile(name) {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`, {method: 'DELETE'});
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Delete failed', 'error');
    return;
  }
  await _refreshProfileList();
  showToast(`Track layout "${name}" deleted`);
}

function cancelProfileEdit() {
  _profileEditorDirty = false;
  document.getElementById('profile-editor').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const editor = document.getElementById('profile-editor');
  if (editor) {
    editor.addEventListener('input',  () => { _profileEditorDirty = true; });
    editor.addEventListener('change', () => { _profileEditorDirty = true; });
  }
});

// ── drag-and-drop analyze (Electron-first) ──────────────────────────────────
// A plain browser can't read a filesystem path off a dropped File, so the
// overlay affordance only appears when window.electronAPI is present; a
// browser drop still gets a toast pointing at manual path entry instead.
const DROP_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.ts'];

let _dragDepth = 0;

function _dragHasFiles(e) {
  return !!(e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files'));
}

document.addEventListener('dragenter', e => {
  if (!_dragHasFiles(e) || !window.electronAPI) return;
  e.preventDefault();
  _dragDepth++;
  document.getElementById('drop-overlay').style.display = 'flex';
});

document.addEventListener('dragover', e => {
  if (!_dragHasFiles(e) || !window.electronAPI) return;
  e.preventDefault();  // required for the browser to fire 'drop'
});

document.addEventListener('dragleave', e => {
  if (!_dragHasFiles(e) || !window.electronAPI) return;
  e.preventDefault();
  _dragDepth = Math.max(0, _dragDepth - 1);
  if (_dragDepth === 0) document.getElementById('drop-overlay').style.display = 'none';
});

document.addEventListener('drop', async e => {
  if (!_dragHasFiles(e)) return;
  e.preventDefault();
  _dragDepth = 0;
  document.getElementById('drop-overlay').style.display = 'none';

  const files = Array.from(e.dataTransfer.files);
  if (!files.length) return;

  if (!window.electronAPI || typeof window.electronAPI.getPathForFile !== 'function') {
    showToast('Drag and drop needs the desktop app - use Analyze and enter the file path instead.', 'info');
    return;
  }
  if (files.length > 1) {
    showToast('Drop one recording at a time - using the first file.', 'warning');
  }
  const file = files[0];
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!DROP_VIDEO_EXTENSIONS.includes(ext)) {
    showToast(`Unsupported file type "${ext}" - expected a video file.`, 'error');
    return;
  }
  const path = window.electronAPI.getPathForFile(file);
  if (!path) {
    showToast("Could not read the dropped file's path.", 'error');
    return;
  }
  await openNewRecordingPanel();
  document.getElementById('analyze-path').value = path;
  scheduleProbe();
});

// ── static control wiring ─────────────────────────────────────────────────────
// This markup is static in index.html (never re-rendered), so each listener is
// wired once at module load - replacing the onclick=/oninput=/onchange=
// attributes that used to live there.
document.getElementById('btn-analyze').addEventListener('click', openNewRecordingPanel);
document.getElementById('btn-close-new-recording').addEventListener('click', closeNewRecordingPanel);
document.getElementById('btn-browse-recording').addEventListener('click', pickFile);
document.getElementById('analyze-path').addEventListener('input', scheduleProbe);
document.getElementById('btn-show-import-url').addEventListener('click', showImportUrlSection);
document.getElementById('btn-use-local-file').addEventListener('click', hideImportUrlSection);
document.getElementById('import-url-input').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  checkImportUrl();
});
document.getElementById('btn-check-url').addEventListener('click', checkImportUrl);
document.getElementById('analyze-profile').addEventListener('change', runEstimate);
document.getElementById('btn-open-profile-manager').addEventListener('click', openProfileManager);
document.getElementById('analyze-model').addEventListener('change', runEstimate);
document.getElementById('analyze-diarize').addEventListener('change', runEstimate);
document.getElementById('analyze-scene-mode').addEventListener('change', runEstimate);
document.getElementById('analyze-energy-mode').addEventListener('change', runEstimate);
document.getElementById('btn-start-analyze').addEventListener('click', startAnalyze);

const _profileModalBg = document.getElementById('profile-modal');
_profileModalBg.addEventListener('click', e => { if (e.target === _profileModalBg) closeProfileManager(); });
document.getElementById('btn-close-profile-manager').addEventListener('click', closeProfileManager);
document.getElementById('btn-new-track-layout').addEventListener('click', openNewProfile);
document.getElementById('pe-name').addEventListener('input', _clearPeNameError);
document.getElementById('pe-numtracks').addEventListener('input', () => renderTrackRows());
document.getElementById('btn-save-profile').addEventListener('click', saveProfile);
document.getElementById('btn-cancel-profile-edit').addEventListener('click', cancelProfileEdit);

document.getElementById('analyze-context-list').addEventListener('click', _handleContextListClick);
// #pe-tracks is a stable container - renderTrackRows only replaces its innerHTML,
// so a single delegated listener here covers every row across re-renders.
document.getElementById('pe-tracks').addEventListener('change', e => {
  const sel = e.target.closest('select[id^="pe-label-"]');
  if (sel) onLabelChange(parseInt(sel.id.slice('pe-label-'.length), 10));
});

// Public API - symbols with a still-classic (bundle.js) bare-global consumer, an
// already-ESM caller reading this module's exports as window.* (clips.js,
// videos.js), or a tests/ui/*.py page.evaluate. Internal helpers (the profile
// manager, Import from URL, drag-and-drop, etc.) stay module-private -
// see main.esm.js for what each surviving name here still needs it for.
// _probedInfo/_panelDirty are NOT here - videos.js imports them directly (see
// the top of this file) as live ESM bindings instead of reading them off window.
export {
  _isNewRecordingPanelOpen, openNewRecordingPanel, openReanalyzePanel, closeNewRecordingPanel,
  _doCloseNewRecordingPanel,
  _renderSubtitleSourcePicker,
  renderEstimate, startAnalyze, reattachAnalysis,
  _showAnalysisToast,
  closeProfileManager,
};
