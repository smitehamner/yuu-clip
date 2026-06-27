// ── settings panel ────────────────────────────────────────────────────────────
let _settingsSaveTimer = null;

async function openSettings() {
  document.getElementById('main-layout').style.display = 'none';
  document.getElementById('settings-panel').style.flex = '1';
  document.getElementById('settings-panel').classList.add('visible');
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    _applySettingsToUI(cfg);
  } catch (e) {
    showToast('Failed to load settings', 'error');
  }
  const pathsEl = document.getElementById('s-paths-display');
  if (pathsEl) {
    const st = await fetch('/api/status').then(r => r.json()).catch(() => ({}));
    pathsEl.innerHTML = `<div>${escHtml(st.version || '')}</div>`;
  }
}

function closeSettings() {
  if (!document.getElementById('settings-panel').classList.contains('visible')) return;
  document.getElementById('settings-panel').classList.remove('visible');
  document.getElementById('main-layout').style.display = '';
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
  const ew = (cfg.scorer_energy_weight  ?? 1.0).toFixed(1);
  const sw = (cfg.scorer_scene_weight   ?? 0.5).toFixed(1);
  const lw = (cfg.scorer_llm_weight     ?? 2.0).toFixed(1);
  const fw = (cfg.score_funny_weight    ?? 1.0).toFixed(1);
  const dw = (cfg.score_dramatic_weight ?? 1.0).toFixed(1);
  const aw = (cfg.score_action_weight   ?? 1.0).toFixed(1);
  setVal('s-energy-weight', ew);   setTxt('s-energy-weight-val', ew);
  setVal('s-scene-weight',  sw);   setTxt('s-scene-weight-val',  sw);
  setVal('s-llm-weight',    lw);   setTxt('s-llm-weight-val',    lw);
  setVal('s-funny-weight',  fw);   setTxt('s-funny-weight-val',  fw);
  setVal('s-dramatic-weight',dw);  setTxt('s-dramatic-weight-val',dw);
  setVal('s-action-weight', aw);   setTxt('s-action-weight-val', aw);
  setVal('s-scene-mode',    cfg.scene_detection_mode || 'fast');
  setVal('s-silence-ms',    cfg.silence_threshold_ms ?? 3000);
  setVal('s-min-clip-ms',   cfg.min_clip_ms          ?? 15000);
  const _tlUnit = cfg.ui_timeline_interval_unit || 'minutes';
  const _tlSec  = cfg.ui_timeline_interval_seconds ?? 900;
  const _tlVal  = _tlUnit === 'minutes' ? Math.round(_tlSec / 60) : _tlSec;
  setVal('s-timeline-interval', _tlVal);
  setVal('s-timeline-unit',     _tlUnit);
}

function saveSettings(key, value) {
  clearTimeout(_settingsSaveTimer);
  _settingsSaveTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/config', {
        method: 'PATCH', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({[key]: value}),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        showToast(`Settings error: ${e.detail || 'save failed'}`, 'error');
        return;
      }
      _flashSettingsSaved();
    } catch {
      showToast('Settings save failed', 'error');
    }
  }, 400);
}

function _onLlmBackendChange(backend) {
  const llamacppEl = document.getElementById('s-llamacpp-fields');
  const ollamaEl   = document.getElementById('s-ollama-fields');
  if (!llamacppEl || !ollamaEl) return;
  llamacppEl.style.display = backend === 'llamacpp' ? '' : 'none';
  ollamaEl.style.display   = backend === 'ollama'   ? '' : 'none';
  saveSettings('llm_backend', backend);
}

async function saveTimelineInterval() {
  const val = parseInt(document.getElementById('s-timeline-interval').value);
  const unit = document.getElementById('s-timeline-unit').value;
  if (isNaN(val) || val < 1) return;
  const intervalS = unit === 'minutes' ? val * 60 : val;
  if (intervalS < 10) return;
  try {
    const res = await fetch('/api/config', {
      method: 'PATCH', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ui_timeline_interval_seconds: intervalS, ui_timeline_interval_unit: unit}),
    });
    if (!res.ok) return;
    _flashSettingsSaved();
  } catch {}
}

function _flashSettingsSaved() {
  const badge = document.getElementById('settings-saved-badge');
  if (!badge) return;
  badge.classList.add('show');
  setTimeout(() => badge.classList.remove('show'), 2000);
}

// ── about modal ───────────────────────────────────────────────────────────────
function openAboutModal()  { document.getElementById('about-modal').classList.add('visible'); }
function closeAboutModal() { document.getElementById('about-modal').classList.remove('visible'); }

// ── glossary modal ────────────────────────────────────────────────────────────
async function openGlossaryModal() {
  document.getElementById('glossary-modal').classList.add('visible');
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
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  const _anyModalOpen = () => document.querySelector('.modal-bg.visible') !== null;

  if (e.key === '?' || e.key === '/') {
    if (_anyModalOpen()) return;
    e.preventDefault();
    openControlsModal();
    return;
  }
  if (e.key === 'Escape') {
    closeAboutModal();
    closeControlsModal();
    closeGlossaryModal();
    _confirmCancel();
    closeFieldEditModal();
    _diffDiscard();
    closeAnalyzeModal();
    closeProfileManager();
    closeDemoModal();
    closeReelsModal();
    closeRetranscribeModal();
    closeContextManager();
    closeBatchExportModal();
    closeExportModal();
    closeTimelineIntervalModal();
    closeAutoApproveModal();
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
  if (!activeClipId) return;

  const idx = _clips.findIndex(c => c.id === activeClipId);

  switch (e.key) {
    case 'a': case 'A':
      e.preventDefault();
      setStatus(activeClipId, 'approved');
      break;
    case 'r': case 'R':
      e.preventDefault();
      setStatus(activeClipId, 'rejected');
      break;
    case ' ':
      e.preventDefault();
      { const v = document.querySelector('#player-area video'); if (v) { v.paused ? v.play() : v.pause(); } }
      break;
    case 'e': case 'E':
      e.preventDefault();
      exportClip(activeClipId);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      if (idx > 0) selectClip(_clips[idx - 1].id);
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      if (idx !== -1 && idx < _clips.length - 1) selectClip(_clips[idx + 1].id);
      break;
  }
});
