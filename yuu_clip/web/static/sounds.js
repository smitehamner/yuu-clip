(function () {
// ── notification sounds ───────────────────────────────────────────────────────
// Plays a short audio cue when a long-running action finishes. All state lives
// in localStorage; the backend only lists/serves audio bytes. Every event is
// OFF by default — the user opts in per event from Settings.

const STORE_KEY = 'yuuclip-sounds';
const EVENTS = [
  {key: 'analysis', label: 'Analysis complete',   note: 'When analyzing a recording finishes',        def: 'Windows Notify.wav'},
  {key: 'rescore',  label: 'Re-score complete',   note: 'When re-scoring clips finishes',              def: 'Windows Ding.wav'},
  {key: 'reel',     label: 'Highlight reel ready', note: 'When a highlight reel finishes building',    def: 'tada.wav'},
  {key: 'export',   label: 'Export complete',     note: 'When a clip or batch export finishes',        def: 'Windows Default.wav'},
  {key: 'error',    label: 'Any job failed',      note: 'When a long-running job errors out',          def: 'Windows Error.wav'},
];

let _sounds = null;                // {builtin:[], custom:[]} from the server
const _player = new Audio();       // single shared element — one cue at a time
let _stopPill = null;

function _defaultState() {
  const events = {};
  for (const e of EVENTS) events[e.key] = {enabled: false, kind: 'builtin', name: e.def};
  return {version: 1, volume: 0.7, events};
}

function _loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return _defaultState();
    const parsed = JSON.parse(raw);
    const base = _defaultState();
    base.volume = typeof parsed.volume === 'number' ? parsed.volume : base.volume;
    for (const e of EVENTS) {
      if (parsed.events && parsed.events[e.key]) {
        base.events[e.key] = {...base.events[e.key], ...parsed.events[e.key]};
      }
    }
    return base;
  } catch {
    return _defaultState();
  }
}

function _saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage full/blocked — non-fatal */ }
}

function _urlFor(choice) {
  if (!choice || !choice.name) return null;
  return `/api/sounds/file?kind=${encodeURIComponent(choice.kind || 'builtin')}&name=${encodeURIComponent(choice.name)}`;
}

function _play(url, volume) {
  if (!url) return;
  try {
    _player.pause();
    _player.src = url;
    _player.volume = Math.max(0, Math.min(1, volume));
    _player.currentTime = 0;
    const started = _player.play();
    if (started && started.catch) started.catch(() => { /* autoplay/codec refusal — ignore */ });
    _showStopPill();
  } catch { /* never let a sound break the action it accompanies */ }
}

// Public: fire the configured cue for a finished action, if the user enabled it.
function playActionSound(eventKey) {
  const state = _loadState();
  const choice = state.events[eventKey];
  if (!choice || !choice.enabled) return;
  _play(_urlFor(choice), state.volume);
}

function stopActionSound() {
  try { _player.pause(); _player.currentTime = 0; } catch { /* nothing playing */ }
  _hideStopPill();
}

// A floating "Stop sound" affordance so a long custom clip (e.g. a full song)
// can always be silenced. Shown while audio plays, removed when it ends.
function _showStopPill() {
  if (!_stopPill) {
    _stopPill = document.createElement('button');
    _stopPill.className = 'sound-stop-pill';
    _stopPill.textContent = '⏹ Stop sound';
    _stopPill.setAttribute('aria-label', 'Stop notification sound');
    _stopPill.onclick = stopActionSound;
    document.body.appendChild(_stopPill);
    _player.addEventListener('ended', _hideStopPill);
    _player.addEventListener('pause', _hideStopPill);
  }
  _stopPill.style.display = '';
}

function _hideStopPill() {
  if (_stopPill) _stopPill.style.display = 'none';
}

// ── settings panel wiring ─────────────────────────────────────────────────────
async function initSoundSettings() {
  const state = _loadState();
  const volEl = document.getElementById('s-sound-volume');
  const volVal = document.getElementById('s-sound-volume-val');
  if (volEl) {
    volEl.value = Math.round(state.volume * 100);
    if (volVal) volVal.textContent = `${volEl.value}%`;
    volEl.oninput = () => {
      const s = _loadState();
      s.volume = (parseInt(volEl.value, 10) || 0) / 100;
      _saveState(s);
      if (volVal) volVal.textContent = `${volEl.value}%`;
    };
  }
  if (!_sounds) {
    try {
      _sounds = await fetch('/api/sounds').then(r => r.json());
    } catch {
      _sounds = {builtin: [], custom: []};
    }
  }
  _renderSoundRows();
}

function _optionsHtml(selected) {
  const opt = (kind, name, label) => {
    const isSel = selected && selected.kind === kind && selected.name === name;
    const value = `${kind}:${name}`;
    return `<option value="${escHtml(value)}"${isSel ? ' selected' : ''}>${escHtml(label)}</option>`;
  };
  let html = '<optgroup label="Windows sounds">';
  html += (_sounds.builtin || []).map(s => opt('builtin', s.name, s.label)).join('');
  html += '</optgroup>';
  if ((_sounds.custom || []).length) {
    html += '<optgroup label="Your sounds">';
    html += _sounds.custom.map(s => opt('custom', s.name, s.name)).join('');
    html += '</optgroup>';
  }
  return html;
}

function _renderSoundRows() {
  const host = document.getElementById('s-sound-rows');
  if (!host) return;
  const state = _loadState();
  host.innerHTML = EVENTS.map(e => {
    const choice = state.events[e.key];
    return `
      <div class="settings-row">
        <div class="settings-col">
          <div class="settings-label">${escHtml(e.label)}</div>
          <div class="settings-note">${escHtml(e.note)}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <label class="settings-checkbox" style="margin-right:4px">
            <input type="checkbox" class="s-sound-enabled" data-key="${escHtml(e.key)}"${choice.enabled ? ' checked' : ''}>
            <span style="font-size:13px">On</span>
          </label>
          <select class="settings-select s-sound-select" data-key="${escHtml(e.key)}" style="max-width:190px"${choice.enabled ? '' : ' disabled'}>
            ${_optionsHtml(choice)}
          </select>
          <button type="button" class="btn ghost s-sound-preview" data-key="${escHtml(e.key)}" title="Preview this sound" style="font-size:13px;padding:2px 8px">&#9654;</button>
        </div>
      </div>`;
  }).join('');

  host.querySelectorAll('.s-sound-enabled').forEach(el => {
    el.onchange = () => {
      const s = _loadState();
      s.events[el.dataset.key].enabled = el.checked;
      _saveState(s);
      const sel = host.querySelector(`.s-sound-select[data-key="${el.dataset.key}"]`);
      if (sel) sel.disabled = !el.checked;
    };
  });
  host.querySelectorAll('.s-sound-select').forEach(el => {
    el.onchange = () => {
      const [kind, ...rest] = el.value.split(':');
      const s = _loadState();
      s.events[el.dataset.key] = {...s.events[el.dataset.key], kind, name: rest.join(':')};
      _saveState(s);
    };
  });
  host.querySelectorAll('.s-sound-preview').forEach(el => {
    el.onclick = () => {
      const s = _loadState();
      _play(_urlFor(s.events[el.dataset.key]), s.volume);
    };
  });
}

async function _onSoundUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const status = document.getElementById('s-sound-upload-status');
  if (status) { status.textContent = 'Uploading…'; status.style.color = 'var(--muted)'; }
  try {
    const res = await fetch(`/api/sounds/upload?name=${encodeURIComponent(file.name)}`, {method: 'POST', body: file});
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Upload failed (${res.status})`);
    }
    _sounds = await fetch('/api/sounds').then(r => r.json());
    _renderSoundRows();
    if (status) { status.textContent = `✓ Added "${file.name}" — pick it in a dropdown above`; status.style.color = 'var(--green, #22c55e)'; }
  } catch (e) {
    if (status) { status.textContent = `✗ ${e.message}`; status.style.color = 'var(--red, #ef4444)'; }
  } finally {
    input.value = '';
  }
}

Object.assign(window, {
  SoundFx: {play: playActionSound, stop: stopActionSound},
  initSoundSettings, _onSoundUpload,
});
})();
