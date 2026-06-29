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
  await _loadProfileDropdown();
  await _loadIngestContextPicker();
  document.getElementById('analyze-path').focus();
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
  _contexts = await fetch('/api/contexts').then(r => r.json()).catch(() => []);
  const list = document.getElementById('analyze-context-list');
  if (!_contexts.length) {
    list.innerHTML = `<div style="font-size:12px;color:var(--muted)">
      No World Contexts set up — clip descriptions will be generic.
      <button class="btn ghost" style="font-size:11px;padding:0 6px;color:var(--accent);display:inline-flex"
              onclick="closeNewRecordingPanel();openContextManager()">Add one →</button>
    </div>`;
    return;
  }
  list.innerHTML =
    `<div class="ctx-picker" id="ctx-picker">` +
    _contexts.map(c =>
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

async function _loadProfileDropdown() {
  const sel = document.getElementById('analyze-profile');
  try {
    _analyzeProfiles = await fetch('/api/profiles').then(r => r.json());
    sel.innerHTML = _analyzeProfiles.map(p =>
      `<option value="${escHtml(p.name)}">${escHtml(p.display_name)}</option>`
    ).join('');
  } catch { _analyzeProfiles = []; }
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
  const hasSrt    = !!info.srt_sidecar;
  const hasStream = info.subtitle_streams && info.subtitle_streams.length > 0;
  if (!hasSrt && !hasStream) {
    if (el) el.style.display = 'none';
    return;
  }
  if (!el) {
    const anchor = document.getElementById('estimate-area');
    el = document.createElement('div');
    el.id = 'subtitle-source-field';
    el.className = 'field';
    anchor.before(el);
  }
  el.style.display = '';
  const opts = [`<option value="">Transcribe with Whisper (default)</option>`];
  if (hasSrt) {
    const name = info.srt_sidecar.split(/[\\/]/).pop();
    opts.push(`<option value="${escHtml(info.srt_sidecar)}">Use SRT sidecar: ${escHtml(name)}</option>`);
  }
  if (hasStream) {
    for (const s of info.subtitle_streams) {
      const label = s.title || s.language || `stream ${s.index}`;
      opts.push(`<option value="stream:${s.index}">Use embedded captions: ${escHtml(label)}</option>`);
    }
  }
  el.innerHTML = `<label for="analyze-subtitle-source">Captions</label>
    <select id="analyze-subtitle-source" onchange="runEstimate()">${opts.join('')}</select>`;
}

async function runEstimate() {
  if (!_probedInfo) return;
  const profileName = document.getElementById('analyze-profile').value;
  const profile     = _analyzeProfiles.find(p => p.name === profileName);
  const transcribeTracks = profile
    ? profile.assignments.filter(a => a.do_transcribe).length
    : undefined;
  const extractTracks = profile
    ? profile.assignments.filter(a => a.do_score || a.do_transcribe).length
    : _probedInfo.audio_tracks;
  const externalSrt   = document.getElementById('analyze-external-srt').value.trim();
  const subtitlePickEl = document.getElementById('analyze-subtitle-source');
  const usingExternalCaptions = !!(externalSrt || (subtitlePickEl && subtitlePickEl.value));
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
      }),
    });
    if (!res.ok) return;
    renderEstimate(_probedInfo, await res.json());
  } catch { /* estimate is non-critical */ }
}

let _warnThresholdMin = 30;

function renderEstimate(info, data) {
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
    ? `<div class="estimate-pct">&#8776; ${data.pct_of_video.toFixed(1)}% of video duration</div>`
    : '';

  document.getElementById('estimate-area').innerHTML = `
    <div class="estimate-box">
      <div class="probe-info">
        ${escHtml(info.filename)} &middot; ${info.duration_hms} &middot;
        ${info.width}&#x2715;${info.height} @ ${info.fps.toFixed(0)}fps &middot;
        ${info.audio_tracks} audio track(s)
      </div>
      <div class="estimate-threshold">
        Warn steps longer than
        <input type="number" min="1" max="480" value="${_warnThresholdMin}" id="warn-threshold-input"
               onchange="_warnThresholdMin=+this.value; runEstimate()"> min
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
  const contextNames  = _selectedContextIds();
  const externalSrt    = document.getElementById('analyze-external-srt').value.trim();
  const subtitleSrcEl  = document.getElementById('analyze-subtitle-source');
  const subtitleSource = externalSrt || (subtitleSrcEl ? subtitleSrcEl.value || null : null);

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
      path, model, profile, energyMode, sceneMode, contextNames, subtitleSource, segments, 0,
    );
    return;
  }

  const btn = document.getElementById('btn-start-analyze');
  btn.disabled = true;
  btn.textContent = 'Starting…';

  const startRes = await fetch('/api/analyze/start', {
    method:  'POST',
    headers: {'Content-Type': 'application/json'},
    body:    JSON.stringify({path, model, profile, energy_mode: energyMode, scene_mode: sceneMode, context_names: contextNames, subtitle_source: subtitleSource}),
  });

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    showToast(formatApiError(err) || 'Failed to start analysis', 'error');
    btn.disabled = false;
    btn.textContent = 'Start Analysis';
    return;
  }

  const filename = path.split(/[\\/]/).pop();
  _analyzeFilename = filename;
  _panelDirty = false;
  _doCloseNewRecordingPanel();
  openLog();
  appendLog(`Analyzing: ${filename}`);
  streamSSE(
    '/api/analyze/events',
    async () => {
      await loadVideos();
      const v = _videos.find(v => v.filename === _analyzeFilename);
      _analyzeFilename = null;
      _showAnalysisToast(v);
    },
    INGEST_STEPS,
    `Analyzing ${filename}`,
    true,
  );
}

function _analyzeSegmentsSequentially(
  path, model, profile, energyMode, sceneMode, contextNames, subtitleSource, segments, index,
) {
  if (index >= segments.length) {
    loadVideos().then(() =>
      showToast(`Analysis complete — ${segments.length} segment(s)`)
    );
    return;
  }
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
        path, model, profile, energyMode, sceneMode, contextNames, subtitleSource, segments, index + 1,
      ),
      INGEST_STEPS,
      `Segment ${index + 1}/${segments.length}`,
      false,
    );
  }).catch(err => showToast(`Network error: ${err.message}`, 'error'));
}

function _showAnalysisToast(video) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast success';
  toast.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px';
  const count = video ? video.clip_count : 0;
  toast.appendChild(document.createTextNode(
    `Analysis complete — ${count} clip${count !== 1 ? 's' : ''} found`
  ));
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;align-items:center;flex-shrink:0';
  if (video && activeVideoId !== video.id) {
    const link = document.createElement('button');
    link.className = 'btn ghost';
    link.style.cssText = 'font-size:11px;padding:2px 8px';
    link.textContent = 'Review';
    link.onclick = () => { selectVideo(video.id); toast.remove(); };
    actions.appendChild(link);
  }
  const close = document.createElement('button');
  close.className = 'btn ghost';
  close.style.cssText = 'font-size:14px;padding:0 4px';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '×';
  close.onclick = () => toast.remove();
  actions.appendChild(close);
  toast.appendChild(actions);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 8000);
}

// ── native file picker ────────────────────────────────────────────────────────
async function pickFile() {
  const btn = document.querySelector('.path-row .btn');
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

async function openProfileManager() {
  document.getElementById('profile-modal').classList.add('visible');
  document.getElementById('profile-editor').style.display = 'none';
  await _refreshProfileList();
}

function closeProfileManager() {
  document.getElementById('profile-modal').classList.remove('visible');
  _loadProfileDropdown();
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
      <span style="flex:1;font-size:13px">${p.builtin ? '&#128274; ' : ''}${escHtml(p.display_name)}</span>
      <span style="color:var(--muted);font-size:12px">${p.num_tracks} track${p.num_tracks !== 1 ? 's' : ''}</span>
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
  document.getElementById('profile-editor').style.display = '';
  document.getElementById('pe-name').value = '';
  document.getElementById('pe-numtracks').value = 2;
  renderTrackRows();
}

function editProfile(name) {
  const p = _allProfiles.find(x => x.name === name);
  if (!p) return;
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
        <span style="color:var(--muted);width:60px;flex-shrink:0">Track ${i}</span>
        <select id="pe-label-${i}" onchange="onLabelChange(${i})"
                style="flex:1;padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px">${opts}</select>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap">
          <input type="checkbox" id="pe-tx-${i}" ${doTx ? 'checked' : ''}> Transcribe
        </label>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap">
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

async function saveProfile() {
  const name = document.getElementById('pe-name').value.trim();
  if (!name)                { showToast('Layout name is required', 'error'); return; }
  if (name.startsWith('__')) { showToast('Layout name cannot start with __', 'error'); return; }
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
  document.getElementById('profile-editor').style.display = 'none';
}
