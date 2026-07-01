(function () {
// ── settings panel ────────────────────────────────────────────────────────────
const _settingsFieldIds = [
  's-whisper-model','s-whisper-device','s-whisper-compute',
  's-ollama-enabled','s-llm-backend','s-llm-model-path',
  's-ollama-model','s-ollama-host','s-ollama-timeout',
  's-claude-api-key','s-claude-model','s-claude-timeout',
  's-diarization-backend','s-hf-token','s-speaker-match-threshold',
  's-energy-weight','s-scene-weight','s-llm-weight',
  's-laugh-weight','s-laugh-mode','s-laugh-model-id',
  's-funny-weight','s-dramatic-weight','s-action-weight',
  's-scene-mode','s-silence-ms','s-min-clip-ms',
  's-timeline-interval','s-timeline-unit','s-autoplay',
];
let _settingsOriginal = {};
let _settingsOpener = null;

function _snapshotSettings() {
  _settingsOriginal = {};
  for (const id of _settingsFieldIds) {
    const el = document.getElementById(id);
    if (el) _settingsOriginal[id] = el.type === 'checkbox' ? el.checked : el.value;
  }
}

function _checkSettingsDirty() {
  let anyDirty = false;
  for (const id of _settingsFieldIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    const current = el.type === 'checkbox' ? el.checked : el.value;
    const dirty = String(current) !== String(_settingsOriginal[id]);
    if (dirty) anyDirty = true;
    const row = el.closest('.settings-row') || el.closest('.settings-weight-row');
    if (row) row.classList.toggle('dirty', dirty);
  }
  const btn = document.getElementById('btn-settings-save');
  if (btn) btn.disabled = !anyDirty;
}

async function openSettings() {
  _settingsOpener = document.activeElement;
  document.getElementById('main-layout').style.display = 'none';
  document.getElementById('settings-panel').style.flex = '1';
  document.getElementById('settings-panel').classList.add('visible');
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    _applySettingsToUI(cfg);
    initSoundSettings();
    setTimeout(() => document.getElementById('s-whisper-model')?.focus(), 50);
  } catch (e) {
    showToast('Failed to load settings', 'error');
  }
  const pathsEl = document.getElementById('s-paths-display');
  if (pathsEl) {
    const st = await fetch('/api/status').then(r => r.json()).catch(() => ({}));
    pathsEl.innerHTML = [
      ['Project folder', st.project_dir],
      ['Exports folder', st.export_dir],
      ['Database',       st.db_path],
    ].filter(([, v]) => v).map(([label, val]) =>
      `<div><span style="color:var(--text);min-width:130px;display:inline-block">${escHtml(label)}</span><code style="font-size:11px;color:var(--muted)">${escHtml(val)}</code></div>`
    ).join('') || '<div style="color:var(--muted)">Unavailable</div>';
  }
}

function closeSettings(onClosed) {
  if (!document.getElementById('settings-panel').classList.contains('visible')) { onClosed?.(); return; }
  const saveBtn = document.getElementById('btn-settings-save');
  if (saveBtn && !saveBtn.disabled) {
    showConfirm(
      'Discard settings changes?',
      'You have unsaved changes. Close without saving?',
      'Discard',
      () => _doCloseSettings(onClosed),
      true,
    );
    return;
  }
  _doCloseSettings(onClosed);
}

function _doCloseSettings(onClosed) {
  document.getElementById('settings-panel').classList.remove('visible');
  document.getElementById('main-layout').style.display = '';
  const opener = _settingsOpener;
  _settingsOpener = null;
  if (opener?.focus) opener.focus();
  onClosed?.();
}

function _applySettingsToUI(cfg) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setVal('s-whisper-model',  cfg.whisper_model   || 'base');
  setVal('s-whisper-device', cfg.whisper_device  || 'auto');
  setVal('s-whisper-compute',cfg.whisper_compute_type || 'int8');
  setChk('s-ollama-enabled',  cfg.ollama_enabled   !== false);
  const backend = cfg.llm_backend || 'llamacpp';
  setVal('s-llm-backend',    backend);
  _onLlmBackendChange(backend);
  setVal('s-llm-model-path', cfg.llm_model_path  || '');
  setVal('s-ollama-model',   cfg.ollama_model    || '');
  setVal('s-ollama-host',    cfg.ollama_host     || '');
  setVal('s-ollama-timeout', cfg.ollama_timeout_s|| 120);
  setVal('s-claude-api-key', cfg.claude_api_key  || '');
  setVal('s-claude-model',   cfg.claude_model    || 'claude-haiku-4-5-20251001');
  setVal('s-claude-timeout', cfg.claude_timeout_s ?? 30);
  _updateLlmRemoteIndicator(cfg.llm_backend || 'llamacpp', cfg.ollama_enabled !== false);
  const diarBackend = cfg.diarization_backend || 'null';
  setVal('s-diarization-backend', diarBackend);
  _onDiarizationBackendChange(diarBackend);
  setVal('s-hf-token', cfg.huggingface_token || '');
  setVal('s-speaker-match-threshold', (cfg.speaker_match_threshold ?? 0.75).toFixed(2));
  _onHfTokenInput();
  const ew  = (cfg.scorer_energy_weight  ?? 1.0).toFixed(1);
  const sw  = (cfg.scorer_scene_weight   ?? 0.5).toFixed(1);
  const lw  = (cfg.scorer_llm_weight     ?? 2.0).toFixed(1);
  const law = (cfg.scorer_laugh_weight   ?? 1.5).toFixed(1);
  const fw  = (cfg.score_funny_weight    ?? 1.0).toFixed(1);
  const dw  = (cfg.score_dramatic_weight ?? 1.0).toFixed(1);
  const aw  = (cfg.score_action_weight   ?? 1.0).toFixed(1);
  setVal('s-energy-weight', ew);    setTxt('s-energy-weight-val', ew);
  setVal('s-scene-weight',  sw);    setTxt('s-scene-weight-val',  sw);
  setVal('s-llm-weight',    lw);    setTxt('s-llm-weight-val',    lw);
  setVal('s-laugh-weight',  law);   setTxt('s-laugh-weight-val',  law);
  setVal('s-laugh-mode',    cfg.scorer_laugh_mode     || 'transcript');
  setVal('s-laugh-model-id',cfg.scorer_laugh_model_id || 'MIT/ast-finetuned-audioset-10-10-0.4593');
  _onLaughModeChange(cfg.scorer_laugh_mode || 'transcript');
  setVal('s-funny-weight',  fw);    setTxt('s-funny-weight-val',  fw);
  setVal('s-dramatic-weight',dw);   setTxt('s-dramatic-weight-val',dw);
  setVal('s-action-weight', aw);    setTxt('s-action-weight-val', aw);
  setVal('s-scene-mode',    cfg.scene_detection_mode || 'fast');
  setVal('s-silence-ms',    cfg.silence_threshold_ms ?? 3000);
  setVal('s-min-clip-ms',   cfg.min_clip_ms          ?? 15000);
  const _silenceEl = document.getElementById('s-silence-ms');
  const _minClipEl = document.getElementById('s-min-clip-ms');
  const _silenceHint = document.getElementById('s-silence-ms-hint');
  const _minClipHint = document.getElementById('s-min-clip-ms-hint');
  if (_silenceEl && _silenceHint) _silenceHint.textContent = (_silenceEl.value / 1000).toFixed(1) + ' s';
  if (_minClipEl && _minClipHint) _minClipHint.textContent = (_minClipEl.value / 1000).toFixed(1) + ' s';
  const _tlUnit = cfg.ui_timeline_interval_unit || 'minutes';
  const _tlSec  = cfg.ui_timeline_interval_seconds ?? 900;
  const _tlVal  = _tlUnit === 'minutes' ? Math.round(_tlSec / 60) : _tlSec;
  setVal('s-timeline-interval', _tlVal);
  setVal('s-timeline-unit',     _tlUnit);
  setChk('s-autoplay', localStorage.getItem('yuuclip-autoplay') === 'true');
  _snapshotSettings();
  _checkSettingsDirty();
  ['pyannote', 'llamacpp', 'anthropic', 'laugh-deps'].forEach(_refreshInstallStatus);
}

function _onLlmBackendChange(backend) {
  const llamacppEl = document.getElementById('s-llamacpp-fields');
  const ollamaEl   = document.getElementById('s-ollama-fields');
  const claudeEl   = document.getElementById('s-claude-fields');
  const warnEl     = document.getElementById('s-backend-remote-warning');
  if (llamacppEl) llamacppEl.style.display = backend === 'llamacpp' ? '' : 'none';
  if (ollamaEl)   ollamaEl.style.display   = backend === 'ollama'   ? '' : 'none';
  if (claudeEl)   claudeEl.style.display   = backend === 'claude'   ? '' : 'none';
  if (warnEl)     warnEl.style.display     = backend === 'claude'   ? '' : 'none';
}

function _onDiarizationBackendChange(backend) {
  const pyannoteEl = document.getElementById('s-pyannote-fields');
  if (pyannoteEl) pyannoteEl.style.display = backend === 'pyannote' ? '' : 'none';
  _updateDiarizationStatus();
}

function _toggleHfTokenVisibility() {
  const input = document.getElementById('s-hf-token');
  const btn   = document.getElementById('btn-toggle-hf-token');
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  btn.textContent = reveal ? 'Hide' : 'Show';
  btn.setAttribute('aria-label', reveal ? 'Hide token' : 'Show token');
}

function _onHfTokenInput() {
  const fb = document.getElementById('s-hf-token-feedback');
  if (fb) {
    const val = document.getElementById('s-hf-token').value.trim();
    if (!val) {
      fb.textContent = '';
    } else if (!val.startsWith('hf_')) {
      fb.textContent = '⚠ HuggingFace tokens normally start with "hf_" — double-check this value';
      fb.style.color = 'var(--yellow, #f0c060)';
    } else {
      fb.textContent = '✓ Looks like a valid token format';
      fb.style.color = 'var(--green, #22c55e)';
    }
  }
  _updateDiarizationStatus();
}

// Summarize the two hard prerequisites (package installed + token set) so the
// user can see at a glance whether speaker labels will actually run, rather than
// discovering it only when an analyze run fails. Reads the live token input (may
// be unsaved) and the server for install state.
async function _updateDiarizationStatus() {
  const el = document.getElementById('s-diarization-status');
  if (!el) return;
  if (document.getElementById('s-diarization-backend').value !== 'pyannote') {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  const tokenSet = !!document.getElementById('s-hf-token').value.trim();
  let installed = false;
  try {
    installed = !!(await fetch('/api/install/pyannote').then(r => r.json())).installed;
  } catch { /* treat unknown as not installed */ }
  el.innerHTML =
    `<span style="margin-right:14px">${installed ? '✓' : '○'} pyannote.audio installed</span>` +
    `<span>${tokenSet ? '✓' : '○'} HuggingFace token set</span>`;
  el.style.color = installed && tokenSet ? 'var(--green, #22c55e)' : 'var(--muted, #888)';
}

function _onLaughModeChange(mode) {
  const modelEl = document.getElementById('s-laugh-model-fields');
  if (modelEl) modelEl.style.display = mode === 'model' ? '' : 'none';
}

async function _refreshInstallStatus(slug) {
  const btn    = document.getElementById(`btn-install-${slug}`);
  const status = document.getElementById(`install-status-${slug}`);
  if (!btn || !status) return;
  try {
    const resp = await fetch(`/api/install/${slug}`);
    if (!resp.ok) return;
    const { installed } = await resp.json();
    if (installed) {
      status.textContent = '✓ Installed';
      status.style.color = 'var(--green, #22c55e)';
      btn.textContent = 'Reinstall';
    }
  } catch { /* leave default "Install" label on network error */ }
}

async function installPackage(slug) {
  const btn    = document.getElementById(`btn-install-${slug}`);
  const status = document.getElementById(`install-status-${slug}`);
  const log    = document.getElementById(`install-log-${slug}`);
  btn.disabled = true;
  btn.textContent = 'Installing…';
  status.textContent = '';
  log.textContent = '';
  log.style.display = '';
  try {
    const resp = await fetch(`/api/install/${slug}`, { method: 'POST' });
    if (!resp.ok) { throw new Error(await resp.text()); }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const msg = JSON.parse(line.slice(6));
        if (msg === '__DONE__') {
          status.textContent = '✓ Installed';
          status.style.color = 'var(--green, #22c55e)';
          btn.textContent = 'Reinstall';
          btn.disabled = false;
          if (slug === 'pyannote') _updateDiarizationStatus();
          return;
        }
        log.textContent += msg + '\n';
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch (e) {
    status.textContent = '✗ Failed — check log above';
    status.style.color = 'var(--red, #ef4444)';
  }
  btn.textContent = 'Retry';
  btn.disabled = false;
}

function _updateLlmRemoteIndicator(backend, llmEnabled) {
  const badge = document.getElementById('llm-remote-badge');
  if (badge) badge.style.display = (llmEnabled && backend === 'claude') ? '' : 'none';
}

async function saveSettings() {
  const getVal = id => { const el = document.getElementById(id); return el ? el.value : null; };
  const getChk = id => { const el = document.getElementById(id); return el ? el.checked : null; };
  const getNum = (id, parse) => { const v = getVal(id); return v !== null ? parse(v) : null; };

  const tlUnit = getVal('s-timeline-unit');
  const tlRaw  = getVal('s-timeline-interval');
  const tlSec  = _parseIntervalS(tlRaw, tlUnit);
  if (tlRaw !== null && tlRaw.trim() !== '' && tlSec === null) {
    showToast('Timeline interval must be at least 10 seconds.', 'error');
    document.getElementById('s-timeline-interval')?.focus();
    return;
  }

  const payload = {
    whisper_model:              getVal('s-whisper-model'),
    whisper_device:             getVal('s-whisper-device'),
    whisper_compute_type:       getVal('s-whisper-compute'),
    ollama_enabled:             getChk('s-ollama-enabled'),
    llm_backend:                getVal('s-llm-backend'),
    llm_model_path:             getVal('s-llm-model-path'),
    ollama_model:               getVal('s-ollama-model'),
    ollama_host:                getVal('s-ollama-host'),
    ollama_timeout_s:           getNum('s-ollama-timeout', parseFloat),
    claude_api_key:             getVal('s-claude-api-key'),
    claude_model:               getVal('s-claude-model'),
    claude_timeout_s:           getNum('s-claude-timeout', parseFloat),
    scorer_energy_weight:       getNum('s-energy-weight', parseFloat),
    scorer_scene_weight:        getNum('s-scene-weight', parseFloat),
    scorer_llm_weight:          getNum('s-llm-weight', parseFloat),
    scorer_laugh_weight:        getNum('s-laugh-weight', parseFloat),
    scorer_laugh_mode:          getVal('s-laugh-mode'),
    scorer_laugh_model_id:      getVal('s-laugh-model-id'),
    score_funny_weight:         getNum('s-funny-weight', parseFloat),
    score_dramatic_weight:      getNum('s-dramatic-weight', parseFloat),
    score_action_weight:        getNum('s-action-weight', parseFloat),
    diarization_backend:        getVal('s-diarization-backend'),
    huggingface_token:          getVal('s-hf-token'),
    speaker_match_threshold:    getNum('s-speaker-match-threshold', parseFloat),
    scene_detection_mode:       getVal('s-scene-mode'),
    silence_threshold_ms:       getNum('s-silence-ms', parseInt),
    min_clip_ms:                getNum('s-min-clip-ms', parseInt),
    ...(tlSec ? {ui_timeline_interval_seconds: tlSec, ui_timeline_interval_unit: tlUnit} : {}),
  };

  localStorage.setItem('yuuclip-autoplay', getChk('s-autoplay'));

  const btn = document.getElementById('btn-settings-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const res = await fetch('/api/config', {
      method: 'PATCH', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      showToast(`Settings error: ${e.detail || 'save failed'}`, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      return;
    }
    _flashSettingsSaved();
    _snapshotSettings();
    _checkSettingsDirty();
    if (btn) btn.textContent = 'Save';
    _updateLlmRemoteIndicator(payload.llm_backend || 'llamacpp', payload.ollama_enabled !== false);
  } catch {
    showToast('Settings save failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}


function _flashSettingsSaved() {
  const badge = document.getElementById('settings-saved-badge');
  if (!badge) return;
  badge.classList.add('show');
  setTimeout(() => badge.classList.remove('show'), 2000);
}

// Dirty-state tracking: re-check on any input/change in the settings panel
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('settings-panel');
  if (panel) {
    panel.addEventListener('input',  _checkSettingsDirty);
    panel.addEventListener('change', _checkSettingsDirty);
  }

  // Show "Re-run Setup Wizard" in the hamburger only when running inside Electron.
  if (window.electronAPI) {
    const btn = document.getElementById('btn-setup-wizard');
    if (btn) btn.style.display = '';
  }
});

// ── getting started modal ─────────────────────────────────────────────────────
let _gettingStartedOpener = null;
function openGettingStartedModal() {
  _gettingStartedOpener = document.activeElement;
  document.getElementById('getting-started-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#getting-started-modal .btn')?.focus(), 50);
}
function closeGettingStartedModal() {
  document.getElementById('getting-started-modal').classList.remove('visible');
  localStorage.setItem('yuu-getting-started-seen', '1');
  const opener = _gettingStartedOpener;
  _gettingStartedOpener = null;
  if (opener?.focus) opener.focus();
}

// ── about modal ───────────────────────────────────────────────────────────────
let _aboutOpener = null;
function openAboutModal() {
  _aboutOpener = document.activeElement;
  document.getElementById('about-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#about-modal .btn')?.focus(), 50);
}
function closeAboutModal() {
  document.getElementById('about-modal').classList.remove('visible');
  const opener = _aboutOpener;
  _aboutOpener = null;
  if (opener?.focus) opener.focus();
}

// ── glossary modal ────────────────────────────────────────────────────────────
let _glossaryOpener = null;
async function openGlossaryModal() {
  _glossaryOpener = document.activeElement;
  document.getElementById('glossary-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#glossary-modal .btn')?.focus(), 50);
  const el = document.getElementById('glossary-content');
  if (el.dataset.loaded) return;
  try {
    const md = await fetch('/api/glossary').then(r => r.text());
    el.innerHTML = _renderGlossaryMd(md);
    el.dataset.loaded = '1';
  } catch (e) {
    el.innerHTML = '<div style="color:var(--red)">Failed to load glossary.</div>';
  }
}
function closeGlossaryModal() {
  document.getElementById('glossary-modal').classList.remove('visible');
  const opener = _glossaryOpener;
  _glossaryOpener = null;
  if (opener?.focus) opener.focus();
}

function _renderGlossaryMd(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inTable = false;
  let tableHead = false;

  const inline = s => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const closeList  = () => { if (inList)  { html += '</ul>';   inList  = false; } };
  const closeTable = () => { if (inTable) { html += '</tbody></table>'; inTable = false; tableHead = false; } };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line.startsWith('## ')) {
      closeList(); closeTable();
      html += `<h2 style="margin:20px 0 4px;font-size:15px;border-bottom:1px solid var(--border);padding-bottom:4px">${inline(line.slice(3))}</h2>`;
    } else if (line.startsWith('### ')) {
      closeList(); closeTable();
      html += `<h3 style="margin:14px 0 2px;font-size:13px;color:var(--accent)">${inline(line.slice(4))}</h3>`;
    } else if (line.startsWith('---')) {
      closeList(); closeTable();
      html += '<hr style="border:none;border-top:1px solid var(--border);margin:14px 0">';
    } else if (/^\|/.test(line)) {
      closeList();
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (/^[-\s|:]+$/.test(line)) {
        tableHead = false;
      } else if (!inTable) {
        inTable = true; tableHead = true;
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:6px 0"><thead><tr>';
        cells.forEach(c => { html += `<th style="text-align:left;padding:4px 8px 4px 0;border-bottom:1px solid var(--border);color:var(--text)">${inline(c)}</th>`; });
        html += '</tr></thead><tbody>';
      } else {
        html += '<tr>';
        cells.forEach(c => { html += `<td style="padding:3px 8px 3px 0;border-bottom:1px solid var(--border);color:var(--muted);vertical-align:top">${inline(c)}</td>`; });
        html += '</tr>';
      }
    } else if (/^- /.test(line)) {
      closeTable();
      if (!inList) { html += '<ul style="margin:4px 0 4px 16px;padding:0">'; inList = true; }
      html += `<li style="margin:1px 0">${inline(line.slice(2))}</li>`;
    } else if (line === '') {
      closeList(); closeTable();
      html += '<div style="margin:4px 0"></div>';
    } else {
      closeList(); closeTable();
      html += `<p style="margin:3px 0">${inline(line)}</p>`;
    }
  }
  closeList(); closeTable();
  return html;
}

// ── keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'A' || e.target.isContentEditable) return;

  const _anyModalOpen = () => document.querySelector('.modal-bg.visible') !== null;

  if (e.key === '?' || e.key === '/') {
    if (_anyModalOpen()) return;
    e.preventDefault();
    openControlsModal();
    return;
  }
  if (e.key === 'Escape') {
    closeGettingStartedModal();
    closeAboutModal();
    closeControlsModal();
    closeGlossaryModal();
    closeAlertModal();
    _confirmCancel();
    closeFieldEditModal();
    closeScoreOverrideModal();
    _diffDiscard();
    if (_isNewRecordingPanelOpen()) { closeNewRecordingPanel(); return; }
    closeProfileManager();
    closeDemoModal();
    closeReelsModal();
    closeRetranscribeModal();
    closeContextManager();
    closeBatchExportModal();
    closeExportModal();
    closeTimelineIntervalModal();
    closeAutoApproveModal();
    closeSimilarClipsModal();
    closeActionsModal();
    closeReelPreview();
    closeSettings();
    closeHamburger();
    return;
  }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undoLastStatus();
    return;
  }

  if (_anyModalOpen()) return;
  if (!AppState.activeClipId) return;

  const idx = AppState.clips.findIndex(c => c.id === AppState.activeClipId);

  switch (e.key) {
    case 'a': case 'A':
      e.preventDefault();
      setStatus(AppState.activeClipId, 'approved');
      break;
    case 'r': case 'R':
      e.preventDefault();
      setStatus(AppState.activeClipId, 'rejected');
      break;
    case ' ':
      e.preventDefault();
      { const v = document.querySelector('#player-area video'); if (v) { v.paused ? v.play() : v.pause(); } }
      break;
    case 'e': case 'E':
      e.preventDefault();
      exportClip(AppState.activeClipId);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      if (idx > 0) selectClip(AppState.clips[idx - 1].id);
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      if (idx !== -1 && idx < AppState.clips.length - 1) selectClip(AppState.clips[idx + 1].id);
      break;
  }
});

// Public API — symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  openSettings, closeSettings, saveSettings, installPackage,
  openAboutModal, closeAboutModal,
  openGettingStartedModal, closeGettingStartedModal,
  openGlossaryModal, closeGlossaryModal,
  _onLlmBackendChange, _onDiarizationBackendChange, _onLaughModeChange,
  _toggleHfTokenVisibility, _onHfTokenInput, _updateDiarizationStatus,
  _updateLlmRemoteIndicator,
});
})();
