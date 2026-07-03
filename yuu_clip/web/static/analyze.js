// ── new recording panel ───────────────────────────────────────────────────────
let _probeTimer    = null;
let _probedInfo    = null;
let _panelDirty    = false;

function _isNewRecordingPanelOpen() {
  return document.getElementById('new-recording-panel').style.display !== 'none';
}

async function openNewRecordingPanel() {
  if (_isNewRecordingPanelOpen()) return;
  if (document.getElementById('btn-analyze').disabled) return;
  if (document.getElementById('settings-panel').classList.contains('visible')) {
    closeSettings(openNewRecordingPanel);
    return;
  }
  document.getElementById('player-area').style.display = 'none';
  document.getElementById('player-resize-handle').style.display = 'none';
  document.getElementById('detail').style.display = 'none';
  document.getElementById('new-recording-panel').style.display = '';
  document.getElementById('btn-analyze').setAttribute('aria-pressed', 'true');

  document.getElementById('analyze-path').value = '';
  document.getElementById('estimate-area').innerHTML = '';
  const stEl = document.getElementById('subtitle-source-field');
  if (stEl) stEl.style.display = 'none';
  _probedInfo   = null;
  _panelDirty   = false;
  _updateStartIngestButton();
  hidePreSplitSection();
  await _loadAnalysisDefaults();
  await _loadProfileDropdown();
  await _loadIngestContextPicker();
  await _loadDiarizationDefault();
  document.getElementById('analyze-path').focus();
}

// Pre-fill the panel's model/scene/energy selects from the Settings-managed
// config defaults; the panel's values remain a per-run override.
async function _loadAnalysisDefaults() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    _setSelectIfPresent('analyze-model',       cfg.whisper_model);
    _setSelectIfPresent('analyze-scene-mode',  cfg.scene_detection_mode);
    _setSelectIfPresent('analyze-energy-mode', cfg.energy_mode);
  } catch { /* config unreachable — keep the static defaults */ }
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
}

async function _loadIngestContextPicker() {
  AppState.contexts = await fetch('/api/contexts').then(r => r.json()).catch(() => []);
  const list = document.getElementById('analyze-context-list');
  if (!AppState.contexts.length) {
    list.innerHTML = `<div style="font-size:12px;color:var(--muted)">
      No World Contexts set up — clip descriptions will be generic.
      <button class="btn ghost" style="font-size:11px;padding:0 6px;color:var(--accent);display:inline-flex"
              onclick="closeNewRecordingPanel();openContextManager()">Add one →</button>
    </div>`;
    return;
  }
  list.innerHTML =
    `<div class="ctx-picker" id="ctx-picker">` +
    AppState.contexts.map(c =>
      `<button type="button" class="ctx-pill" data-ctx-id="${escHtml(c.context_id)}"
               onclick="_toggleCtxPill(this)">${escHtml(c.display_name || c.context_id)}</button>`
    ).join('') +
    `</div>` +
    `<div id="ctx-none-selected-note" style="font-size:11px;color:var(--muted);margin-top:6px">No context selected — descriptions will be generic</div>`;
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
      note.innerHTML = _diarizationNoteHtml(
        readiness.reason, 'closeNewRecordingPanel();openSettings()');
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
  _panelDirty = true;
  clearTimeout(_probeTimer);
  const path = document.getElementById('analyze-path').value.trim();
  if (!path) {
    document.getElementById('estimate-area').innerHTML = '';
    _probedInfo = null;
    _updateStartIngestButton();
    return;
  }
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
    runEstimate();
    initPreSplitDuration(_probedInfo.duration_s);
  } catch (err) {
    _probedInfo = null;
    _updateStartIngestButton();
    hidePreSplitSection();
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
    <select id="analyze-subtitle-source" onchange="_onSubtitleSourceChange(this)">${opts.join('')}</select>`;
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
      let ext = document.getElementById('subtitle-external-option');
      if (!ext) {
        ext = document.createElement('option');
        ext.id = 'subtitle-external-option';
        sel.insertBefore(ext, sel.querySelector('option[value="__pick-srt__"]'));
      }
      ext.value = data.path;
      ext.textContent = `External SRT: ${data.path.split(/[\\/]/).pop()}`;
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

function renderEstimate(info, data) {
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

  document.getElementById('estimate-area').innerHTML = `
    <div class="estimate-box">
      <div class="probe-info">
        ${escHtml(info.filename)} &middot; ${info.duration_hms} &middot;
        ${info.width}&#x2715;${info.height} @ ${info.fps.toFixed(0)}fps &middot;
        ${plural(info.audio_tracks, 'audio track')}
      </div>
      ${rows}
      <div class="estimate-total">
        <span>Total estimated</span>
        <span style="display:flex;align-items:center;gap:8px">
          ${totalBadge}
          <span class="${tClass(data.total_seconds)}">${data.total_hms}</span>
        </span>
      </div>
      ${pctLine}
    </div>`;
}

async function startAnalyze() {
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

  const btn = document.getElementById('btn-start-analyze');
  btn.disabled = true;
  btn.textContent = 'Starting…';

  const startRes = await fetch('/api/analyze/start', {
    method:  'POST',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify({path, model, profile, energy_mode: energyMode, scene_mode: sceneMode, diarize, context_names: contextNames, subtitle_source: subtitleSource}),
  });

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    showToast(formatApiError(err) || 'Failed to start analysis', 'error');
    btn.disabled = false;
    btn.textContent = 'Start Analysis';
    return;
  }

  const filename = path.split(/[\\/]/).pop();
  AppState.analyzeFilename = filename;
  _panelDirty = false;
  _doCloseNewRecordingPanel();
  loadVideos();  // surface the recording in the sidebar immediately (placeholder until its row exists)
  openLog();
  appendLog(`Analyzing: ${filename}`);
  _streamAnalyzeEvents(filename);
}

// Attach the header progress bar + in-detail panel to the analyze SSE stream.
// Shared by a fresh start and by reattachAnalysis() after a page refresh — the
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
      SoundFx.play('analysis');
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
      showToast(`Analysis complete — ${plural(segments.length, 'segment')}`)
    );
    SoundFx.play('analysis');
    return;
  }
  await _waitWhileAnalyzePaused();
  const seg = segments[index];
  appendLog(`Analyzing segment ${index + 1}/${segments.length}: ${_fmtSplitTime(seg.start_s)}–${_fmtSplitTime(seg.end_s)}`);
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
  }).catch(err => showToast(`Network error: ${err.message}`, 'error'));
}

function _showAnalysisToast(video) {
  const count = video ? video.clip_count : 0;
  const canJump = video && AppState.activeVideoId !== video.id;
  showToast(`Analysis complete — ${plural(count, 'clip')} found`, 'success', {
    durationMs: 8000,
    ...(canJump ? {action: {label: 'Review', onClick: () => selectVideo(video.id)}} : {}),
  });
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
      <span style="flex:1;font-size:13px">${p.builtin ? '<span title="Built-in layout — cannot be edited or deleted">&#128274;</span> ' : ''}${escHtml(p.display_name)}</span>
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
        <select id="pe-label-${i}" onchange="onLabelChange(${i})"
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
    showToast('Drag and drop needs the desktop app — use Analyze and enter the file path instead.', 'info');
    return;
  }
  if (files.length > 1) {
    showToast('Drop one recording at a time — using the first file.', 'warning');
  }
  const file = files[0];
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!DROP_VIDEO_EXTENSIONS.includes(ext)) {
    showToast(`Unsupported file type "${ext}" — expected a video file.`, 'error');
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
