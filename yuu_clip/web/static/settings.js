(function () {
// Feature-map — Settings panel (all sections; see the per-section banners below).
//   API: routes/config.py, llm.py, profiles.py, content_presets.py, export_presets.py · Tests: tests/test_ui_settings.py
// ── settings panel ────────────────────────────────────────────────────────────
const _settingsFieldIds = [
  's-whisper-model','s-whisper-device','s-whisper-compute','s-whisper-language',
  's-ai-privacy-value',
  's-ollama-enabled','s-llm-backend','s-llm-model-path','s-llm-mmproj-path','s-llm-use-gpu',
  's-vision-enabled','s-vision-frames',
  's-ollama-model','s-ollama-vision-model','s-ollama-host','s-ollama-timeout',
  's-claude-api-key','s-claude-model','s-claude-timeout',
  's-diarization-backend','s-hf-token','s-speaker-match-threshold',
  's-similarity-backend',
  's-energy-weight','s-scene-weight','s-llm-weight',
  's-laugh-weight','s-laugh-mode','s-laugh-model-id','s-lexicon-weight',
  's-speech-rate-weight','s-churn-weight','s-prosody-weight',
  's-funny-weight','s-dramatic-weight','s-action-weight',
  's-scene-mode','s-energy-mode','s-silence-ms','s-min-clip-ms',
  's-thermal-autopause','s-thermal-warn-c','s-thermal-pause-c',
  's-audio-event-enabled',
  's-timeline-interval','s-timeline-unit','s-autoplay','s-play-next','s-loop-clip','s-playback-rate',
  's-export-name-template',
  's-title-card-bg-color','s-title-card-font-color','s-title-card-scale',
  's-title-card-template','s-title-card-duration',
  's-caption-font-name','s-caption-font-size','s-caption-position',
];
// [element id, config key, default] — single source for apply + Reset to defaults.
const _weightFields = [
  ['s-energy-weight',   'scorer_energy_weight',   1.0],
  ['s-scene-weight',    'scorer_scene_weight',    0.5],
  ['s-llm-weight',      'scorer_llm_weight',      2.0],
  ['s-laugh-weight',    'scorer_laugh_weight',    1.5],
  ['s-lexicon-weight',  'scorer_lexicon_weight',  1.0],
  ['s-speech-rate-weight', 'scorer_speech_rate_weight', 0.5],
  ['s-churn-weight',       'scorer_churn_weight',       0.5],
  ['s-prosody-weight',     'scorer_prosody_weight',     0.5],
  ['s-audio-event-weight', 'scorer_audio_event_weight', 1.0],
  ['s-funny-weight',    'score_funny_weight',     1.0],
  ['s-dramatic-weight', 'score_dramatic_weight',  1.0],
  ['s-action-weight',   'score_action_weight',    1.0],
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
  if (window._soundSettingsDirty?.()) anyDirty = true;
  const btn = document.getElementById('btn-settings-save');
  if (btn) btn.disabled = !anyDirty;
}

function _scrollToSettingsSection(sectionId) {
  const panel = document.getElementById('settings-panel');
  const section = document.getElementById(sectionId);
  if (!section) return;
  const headerHeight = panel.querySelector('.settings-header')?.offsetHeight ?? 0;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  panel.scrollTo({ top: section.offsetTop - headerHeight - 10, behavior: smooth ? 'smooth' : 'auto' });
}

async function openSettings() {
  _settingsOpener = document.activeElement;
  // Close the new-recording panel so it isn't left open behind the overlay.
  if (typeof _isNewRecordingPanelOpen === 'function' && _isNewRecordingPanelOpen()) {
    _doCloseNewRecordingPanel();
  }
  const panel = document.getElementById('settings-panel');
  panel.classList.add('visible');
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    await _ensureWhisperLanguageOptions();
    // Populate catalog-driven pickers before _applySettingsToUI so the saved
    // claude_model matches a rendered option rather than falling to option 0.
    await _ensureModelCatalog();
    // Sound rows must be rendered (from saved state) before _applySettingsToUI
    // runs the dirty check, or a discarded prior edit would re-enable Save.
    await initSoundSettings();
    await initHotwordSettings();
    await initSensitiveTermSettings();
    await initExportPresetSettings();
    await initContentPresetSettings();
    _applySettingsToUI(cfg);
    // preventScroll: the panel should open at the top (showing the Capabilities
    // overview); a plain focus() scrolls this mid-panel control into view, yanking
    // the panel down — visibly so since Wave 4's taller Capabilities section.
    setTimeout(() => document.getElementById('s-whisper-model')?.focus({ preventScroll: true }), 50);
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
  const opener = _settingsOpener;
  _settingsOpener = null;
  if (opener?.focus) opener.focus();
  onClosed?.();
}

// Populate the transcription-language select from the server's allowlist once,
// rendering English display names via Intl so the codes stay single-sourced in
// config.py. Falls back to the markup's Auto-detect-only option on fetch failure.
let _whisperLangsLoaded = false;
async function _ensureWhisperLanguageOptions() {
  if (_whisperLangsLoaded) return;
  const sel = document.getElementById('s-whisper-language');
  if (!sel) return;
  try {
    const { languages } = await fetch('/api/config/whisper-languages').then(r => r.json());
    let nameOf = code => code;
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'language' });
      nameOf = code => { try { return dn.of(code) || code; } catch { return code; } };
    } catch { /* Intl.DisplayNames unavailable — show raw codes */ }
    const named = languages
      .map(code => ({ code, name: nameOf(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">Auto-detect (recommended)</option>' +
      named.map(o => `<option value="${escHtml(o.code)}">${escHtml(o.name)}</option>`).join('');
    _whisperLangsLoaded = true;
  } catch { /* keep Auto-detect-only fallback */ }
}

// Selects whose option values are numeric strings (e.g. "1.0") won't match a
// JSON number reformatted by JS (1.0 -> "1") via plain .value assignment —
// match by parsed value instead so the saved scale selects the right option.
function _setSelectByNumber(id, num) {
  const el = document.getElementById(id);
  if (!el) return;
  const opt = Array.from(el.options).find(o => parseFloat(o.value) === num);
  if (opt) el.value = opt.value;
}

function _applySettingsToUI(cfg) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setVal('s-whisper-model',  cfg.whisper_model   || 'base');
  setVal('s-whisper-device', cfg.whisper_device  || 'auto');
  setVal('s-whisper-compute',cfg.whisper_compute_type || 'int8');
  setVal('s-whisper-language', cfg.whisper_language || '');
  setChk('s-ollama-enabled',  cfg.ollama_enabled   !== false);
  _onLlmEnabledChange(cfg.ollama_enabled !== false);
  const backend = cfg.llm_backend || 'llamacpp';
  setVal('s-llm-backend',    backend);
  _onLlmBackendChange(backend);
  setVal('s-llm-model-path', cfg.llm_model_path  || '');
  setVal('s-llm-mmproj-path', cfg.llm_mmproj_path || '');
  setChk('s-llm-use-gpu', cfg.llm_use_gpu !== false);
  setChk('s-vision-enabled', cfg.vision_enabled === true);
  setVal('s-vision-frames',  cfg.vision_frames_per_clip ?? 4);
  window._visionEnabled = cfg.vision_enabled === true;
  setVal('s-ollama-model',   cfg.ollama_model    || '');
  setVal('s-ollama-vision-model', cfg.ollama_vision_model || '');
  setVal('s-ollama-host',    cfg.ollama_host     || '');
  setVal('s-ollama-timeout', cfg.ollama_timeout_s|| 120);
  setVal('s-claude-api-key', cfg.claude_api_key  || '');
  _setClaudeModelValue(cfg.claude_model || 'claude-haiku-4-5-20251001');
  setVal('s-claude-timeout', cfg.claude_timeout_s ?? 30);
  setVal('s-similarity-backend', cfg.similarity_backend || 'embeddings');
  // After the backend + similarity selects are populated: applies the privacy mode,
  // which re-evaluates backend visibility, the remote badge, and option filtering.
  _setPrivacyMode(cfg.ai_privacy_mode || 'local_only');
  _onSimilarityBackendChange(cfg.similarity_backend || 'embeddings');
  _updateLlmCapabilities();
  _renderCapabilityTiers();
  const diarBackend = cfg.diarization_backend || 'speechbrain';
  setVal('s-diarization-backend', diarBackend);
  _onDiarizationBackendChange(diarBackend);
  setVal('s-hf-token', cfg.huggingface_token || '');
  setVal('s-speaker-match-threshold', (cfg.speaker_match_threshold ?? 0.75).toFixed(2));
  _onHfTokenInput();
  for (const [id, key, def] of _weightFields) {
    const weight = (cfg[key] ?? def).toFixed(1);
    setVal(id, weight);
    setTxt(`${id}-val`, weight);
  }
  setVal('s-laugh-mode',    cfg.scorer_laugh_mode     || 'transcript');
  setVal('s-laugh-model-id',cfg.scorer_laugh_model_id || 'MIT/ast-finetuned-audioset-10-10-0.4593');
  _onLaughModeChange(cfg.scorer_laugh_mode || 'transcript');
  setChk('s-audio-event-enabled', cfg.scorer_audio_event_enabled === true);
  setVal('s-scene-mode',    cfg.scene_detection_mode || 'fast');
  setVal('s-energy-mode',   cfg.energy_mode          || 'fast');
  setVal('s-silence-ms',    cfg.silence_threshold_ms ?? 3000);
  setVal('s-min-clip-ms',   cfg.min_clip_ms          ?? 15000);
  setChk('s-thermal-autopause', cfg.thermal_autopause_enabled !== false);
  setVal('s-thermal-warn-c',    cfg.thermal_warn_c  ?? 85);
  setVal('s-thermal-pause-c',   cfg.thermal_pause_c ?? 90);
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
  setChk('s-play-next', localStorage.getItem('yuuclip-play-next') === 'true');
  setChk('s-loop-clip', localStorage.getItem('yuuclip-loop-clip') === 'true');
  setVal('s-playback-rate', String(playbackRatePref()));
  setVal('s-theme', localStorage.getItem('yuuclip-theme') || 'dark');
  setVal('s-export-name-template', cfg.export_name_template || '{video}_clip{clip_id}_{start}');
  _updateExportNameTemplatePreview();
  setVal('s-title-card-bg-color', cfg.title_card_bg_color || '#000000');
  setVal('s-title-card-font-color', cfg.title_card_font_color || '#ffffff');
  _setSelectByNumber('s-title-card-scale', cfg.title_card_scale ?? 1.0);
  setVal('s-title-card-template', cfg.title_card_template ?? '{description}\n{start} · {duration}');
  setVal('s-title-card-duration', cfg.title_card_duration_s ?? 3.0);
  _updateTitleCardPreview();
  setVal('s-caption-font-name', cfg.caption_font_name || '');
  setVal('s-caption-font-size', cfg.caption_font_size ? cfg.caption_font_size : '');
  setVal('s-caption-position', cfg.caption_position || 'bottom');
  _snapshotSettings();
  _checkSettingsDirty();
  ['pyannote', 'cuda-libs'].forEach(_refreshInstallStatus);
}

// Applies instantly (outside the Save flow) so the user sees the theme while
// choosing it. Deliberately not in _settingsFieldIds — must not flag dirty.
// The inline <head> script in index.html reads the same key before first paint.
function applyTheme(theme) {
  if (theme === 'dark') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  localStorage.setItem('yuuclip-theme', theme);
}

// ── LLM scoring section (enable toggle + backend selection) ──────────────────
// Everything below the master toggle is inert while LLM scoring is off —
// inert (not disabled) so the fields keep their values for the save payload.
function _onLlmEnabledChange(enabled) {
  const body = document.getElementById('s-llm-body');
  if (!body) return;
  body.classList.toggle('settings-dimmed', !enabled);
  body.inert = !enabled;
}

function _resetScoringWeights() {
  for (const [id, , def] of _weightFields) {
    const el = document.getElementById(id);
    const valEl = document.getElementById(`${id}-val`);
    if (!el || !valEl) continue;
    el.value = def.toFixed(1);
    valEl.textContent = def.toFixed(1);
  }
  _checkSettingsDirty();
}

function _onLlmBackendChange(backend) {
  const mode = _currentPrivacyMode();
  const isClaude      = backend === 'claude';
  const remoteAllowed = mode === 'remote_ok';
  const llamacppEl = document.getElementById('s-llamacpp-fields');
  const ollamaEl   = document.getElementById('s-ollama-fields');
  const claudeEl   = document.getElementById('s-claude-fields');
  const warnEl     = document.getElementById('s-backend-remote-warning');
  const blockedEl  = document.getElementById('s-remote-blocked-notice');
  if (llamacppEl) llamacppEl.style.display = backend === 'llamacpp' ? '' : 'none';
  if (ollamaEl)   ollamaEl.style.display   = backend === 'ollama'   ? '' : 'none';
  if (claudeEl)   claudeEl.style.display   = isClaude ? '' : 'none';
  // Costs warning only when the remote backend is actually usable; otherwise the
  // "blocked by AI privacy mode" notice explains why a saved Claude backend is inert.
  if (warnEl)     warnEl.style.display     = (isClaude && remoteAllowed)  ? '' : 'none';
  if (blockedEl)  blockedEl.style.display  = (isClaude && !remoteAllowed) ? '' : 'none';
}

// ── AI privacy mode (plan non-llm-tiers/07) ─────────────────────────────────
// The UI mirror of the server-side trust guarantee. Hiding the remote option and
// collapsing the generative block is presentation only — enforcement lives in
// resolve_ai_permissions; these controls never *grant* a capability the server blocks.
function _currentPrivacyMode() {
  const checked = document.querySelector('input[name="s-ai-privacy"]:checked');
  return checked ? checked.value : (window._aiPrivacyMode || 'local_only');
}

function _onPrivacyModeChange(mode) {
  window._aiPrivacyMode = mode;
  const hidden = document.getElementById('s-ai-privacy-value');
  if (hidden) hidden.value = mode;
  const generativeOff = mode === 'none';
  const genBlock    = document.getElementById('s-llm-generative-block');
  const noneSummary = document.getElementById('s-privacy-none-summary');
  if (genBlock)    genBlock.style.display    = generativeOff ? 'none' : '';
  if (noneSummary) noneSummary.style.display = generativeOff ? '' : 'none';
  const claudeOption = document.querySelector('#s-llm-backend option[value="claude"]');
  if (claudeOption) claudeOption.hidden = claudeOption.disabled = mode !== 'remote_ok';
  const simLlmOption = document.querySelector('#s-similarity-backend option[value="llm"]');
  if (simLlmOption) simLlmOption.hidden = simLlmOption.disabled = generativeOff;
  const backend = document.getElementById('s-llm-backend')?.value || 'llamacpp';
  _onLlmBackendChange(backend);
  _updateLlmRemoteIndicator(backend, document.getElementById('s-ollama-enabled')?.checked !== false);
}

function _setPrivacyMode(mode) {
  const radio = document.querySelector(`input[name="s-ai-privacy"][value="${mode}"]`);
  if (radio) radio.checked = true;
  _onPrivacyModeChange(mode);
  _checkSettingsDirty();
}

// ── speaker labels section (diarization backend + HF token) ──────────────────
function _onDiarizationBackendChange(backend) {
  const pyannoteEl    = document.getElementById('s-pyannote-fields');
  const speechbrainEl = document.getElementById('s-speechbrain-fields');
  const commonEl      = document.getElementById('s-diarization-common-fields');
  if (pyannoteEl)    pyannoteEl.style.display    = backend === 'pyannote'    ? '' : 'none';
  if (speechbrainEl) speechbrainEl.style.display = backend === 'speechbrain' ? '' : 'none';
  if (commonEl)      commonEl.style.display      = backend !== 'null'        ? '' : 'none';
  // Pyannote's setup stays a collapsed <details> even when it's the active
  // backend (demoted — SpeechBrain is the default) — the install/token status
  // is still visible via #s-diarization-common-fields below, outside the
  // disclosure. Auto-expanding here was tried and reverted: it resized content
  // above the settings panel's current scroll position, and Chrome's scroll
  // anchoring then silently shifted scrollTop to compensate.
  _updateDiarizationStatus();
}

function _toggleSecretVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  btn.textContent = reveal ? 'Hide' : 'Show';
  const label = btn.getAttribute('aria-label') || '';
  btn.setAttribute('aria-label', label.replace(/^(Show|Hide)/, reveal ? 'Hide' : 'Show'));
}

function _onHfTokenInput() {
  const fb = document.getElementById('s-hf-token-feedback');
  if (fb) {
    const val = document.getElementById('s-hf-token').value.trim();
    if (!val) {
      fb.textContent = '';
    } else if (!val.startsWith('hf_')) {
      fb.textContent = '⚠ HuggingFace tokens normally start with "hf_" — double-check this value';
      fb.style.color = 'var(--warning)';
    } else {
      fb.textContent = '✓ Looks like a valid token format';
      fb.style.color = 'var(--green)';
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
  const backend = document.getElementById('s-diarization-backend').value;
  if (backend === 'null') {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  if (backend === 'speechbrain') {
    let installed = false;
    try {
      installed = !!(await fetch('/api/install/speechbrain').then(r => r.json())).installed;
    } catch { /* treat unknown as not installed */ }
    el.innerHTML = `<span>${installed ? '✓' : '○'} SpeechBrain installed — no token needed</span>`;
    el.style.color = installed ? 'var(--green)' : 'var(--muted)';
    return;
  }
  const tokenSet = !!document.getElementById('s-hf-token').value.trim();
  let installed = false;
  try {
    installed = !!(await fetch('/api/install/pyannote').then(r => r.json())).installed;
  } catch { /* treat unknown as not installed */ }
  el.innerHTML =
    `<span style="margin-right:14px">${installed ? '✓' : '○'} pyannote.audio installed</span>` +
    `<span>${tokenSet ? '✓' : '○'} HuggingFace token set</span>`;
  el.style.color = installed && tokenSet ? 'var(--green)' : 'var(--muted)';
}

// ── scoring, similarity & playback section handlers ──────────────────────────
function _onLaughModeChange(mode) {
  const modelEl = document.getElementById('s-laugh-model-fields');
  if (modelEl) modelEl.style.display = mode === 'model' ? '' : 'none';
}

function _onSimilarityBackendChange(backend) {
  const fields = document.getElementById('s-similarity-embeddings-fields');
  if (fields) fields.style.display = backend === 'embeddings' ? '' : 'none';
}

// Play-next and loop-clip are mutually exclusive — looping a clip forever
// would make "play next" unreachable, so enabling one clears the other.
function _onPlayNextChange(enabled) {
  if (!enabled) return;
  const loopEl = document.getElementById('s-loop-clip');
  if (loopEl) loopEl.checked = false;
}

function _onLoopClipChange(enabled) {
  if (!enabled) return;
  const playNextEl = document.getElementById('s-play-next');
  if (playNextEl) playNextEl.checked = false;
}

// ── content-type presets (plan 12) ──────────────────────────────────────────
// A one-choice tuning applied on top of the weight sliders. Unlike the sliders
// (batched into Save), Apply is its own atomic server-side action: it copies the
// preset's dimension + laugh weights into config and, opt-in, inserts starter
// hot-words. The selected preset drives the LLM prompt flavor live server-side.
let _contentPresets = null;
let _activeContentPresetId = 'generic';

async function initContentPresetSettings() {
  const sel = document.getElementById('s-content-preset');
  if (!sel) return;
  try {
    const data = await fetch('/api/content-presets').then(r => r.json());
    _contentPresets = data.presets || [];
    _activeContentPresetId = data.active || 'generic';
    sel.innerHTML = _contentPresets.map(p =>
      `<option value="${escHtml(p.id)}">${escHtml(p.name)}</option>`).join('');
    sel.value = _activeContentPresetId;
  } catch { _contentPresets = []; }
  _renderContentPresetInfo();
}

function _renderContentPresetInfo() {
  const sel = document.getElementById('s-content-preset');
  const chosen = (_contentPresets || []).find(p => p.id === sel?.value);
  const active = (_contentPresets || []).find(p => p.id === _activeContentPresetId);
  const descEl = document.getElementById('s-content-preset-desc');
  const activeEl = document.getElementById('s-content-preset-active');
  if (descEl) descEl.textContent = chosen ? chosen.description : '';
  if (activeEl) activeEl.textContent = active ? `Currently active: ${active.name}` : '';
}

function _onContentPresetChange() { _renderContentPresetInfo(); }

async function applyContentPreset() {
  const sel = document.getElementById('s-content-preset');
  const chosen = (_contentPresets || []).find(p => p.id === sel?.value);
  if (!chosen) return;
  const addHotwords = document.getElementById('s-content-preset-hotwords')?.checked ?? true;
  const w = chosen.dimension_weights || {};
  const weightLine =
    `Funny ${(w.score_funny_weight ?? 1).toFixed(1)}, ` +
    `Dramatic ${(w.score_dramatic_weight ?? 1).toFixed(1)}, ` +
    `Action ${(w.score_action_weight ?? 1).toFixed(1)}, ` +
    `Laughs ${(chosen.laugh_weight ?? 1.5).toFixed(1)}`;
  const hotwordLine = (addHotwords && chosen.hotword_count)
    ? ` and adds up to ${plural(chosen.hotword_count, 'starter hot-word')} (existing hot-words are kept)`
    : '';
  showConfirm(
    `Apply "${chosen.name}"?`,
    `Sets scoring weights to ${weightLine}${hotwordLine}. You can fine-tune everything below afterwards.`,
    'Apply',
    () => _doApplyContentPreset(chosen.id, addHotwords),
  );
}

async function _doApplyContentPreset(id, addHotwords) {
  let res;
  try {
    res = await fetch('/api/content-presets/apply', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id, add_hotwords: addHotwords}),
    });
  } catch { showToast('Could not apply content type', 'error'); return; }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Could not apply content type', 'error');
    return;
  }
  const body = await res.json();
  _activeContentPresetId = body.applied;
  _applyPresetWeightsToUI(body.weights);
  if (addHotwords && body.hotwords_added) await initHotwordSettings();
  _renderContentPresetInfo();
  const added = body.hotwords_added ? ` · ${plural(body.hotwords_added, 'hot-word')} added` : '';
  showToast(`Applied content type${added} — re-score to apply the new weighting`, 'success');
}

// The preset already persisted these weights server-side, so rebaseline the
// settings snapshot for the weight fields — otherwise the panel's dirty check
// would flag them and prompt a redundant "discard changes?" on close.
function _applyPresetWeightsToUI(weights) {
  if (!weights) return;
  const map = {
    score_funny_weight: 's-funny-weight',
    score_dramatic_weight: 's-dramatic-weight',
    score_action_weight: 's-action-weight',
    scorer_laugh_weight: 's-laugh-weight',
  };
  for (const [key, id] of Object.entries(map)) {
    if (weights[key] == null) continue;
    const el = document.getElementById(id);
    const valEl = document.getElementById(`${id}-val`);
    const v = Number(weights[key]).toFixed(1);
    if (valEl) valEl.textContent = v;
    // Baseline from the element's own read-back, not `v`: a range input
    // normalizes "1.0" to "1", so storing `v` would falsely read as dirty.
    if (el) { el.value = v; _settingsOriginal[id] = el.value; }
  }
  _checkSettingsDirty();
}

// Blank caption size means "renderer default", stored as 0. A non-numeric entry
// also collapses to 0 so the PATCH never sends NaN.
function _captionSizeValue(raw) {
  if (raw === null || raw.trim() === '') return 0;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? 0 : n;
}

// ── save + dirty tracking ────────────────────────────────────────────────────
async function saveSettings() {
  const getVal = id => { const el = document.getElementById(id); return el ? el.value : null; };
  const getChk = id => { const el = document.getElementById(id); return el ? el.checked : null; };
  const getNum = (id, parse) => { const v = getVal(id); return v !== null ? parse(v) : null; };

  const tlUnit = getVal('s-timeline-unit');
  const tlRaw  = getVal('s-timeline-interval');
  const tlSec  = _parseIntervalS(tlRaw, tlUnit);
  if (tlRaw !== null && tlRaw.trim() !== '' && tlSec === null) {
    showToast('Timeline interval must be at least 10 seconds.', 'warning');
    document.getElementById('s-timeline-interval')?.focus();
    return;
  }

  const payload = {
    whisper_model:              getVal('s-whisper-model'),
    whisper_device:             getVal('s-whisper-device'),
    whisper_compute_type:       getVal('s-whisper-compute'),
    whisper_language:           getVal('s-whisper-language'),
    ai_privacy_mode:            _currentPrivacyMode(),
    ollama_enabled:             getChk('s-ollama-enabled'),
    llm_backend:                getVal('s-llm-backend'),
    llm_model_path:             getVal('s-llm-model-path'),
    llm_mmproj_path:            getVal('s-llm-mmproj-path'),
    llm_use_gpu:                getChk('s-llm-use-gpu'),
    vision_enabled:             getChk('s-vision-enabled'),
    vision_frames_per_clip:     getNum('s-vision-frames', v => parseInt(v, 10)),
    ollama_model:               getVal('s-ollama-model'),
    ollama_vision_model:        getVal('s-ollama-vision-model'),
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
    scorer_lexicon_weight:      getNum('s-lexicon-weight', parseFloat),
    scorer_speech_rate_weight:  getNum('s-speech-rate-weight', parseFloat),
    scorer_churn_weight:        getNum('s-churn-weight', parseFloat),
    scorer_prosody_weight:      getNum('s-prosody-weight', parseFloat),
    scorer_audio_event_weight:  getNum('s-audio-event-weight', parseFloat),
    scorer_audio_event_enabled: getChk('s-audio-event-enabled'),
    similarity_backend:         getVal('s-similarity-backend'),
    score_funny_weight:         getNum('s-funny-weight', parseFloat),
    score_dramatic_weight:      getNum('s-dramatic-weight', parseFloat),
    score_action_weight:        getNum('s-action-weight', parseFloat),
    diarization_backend:        getVal('s-diarization-backend'),
    huggingface_token:          getVal('s-hf-token'),
    speaker_match_threshold:    getNum('s-speaker-match-threshold', parseFloat),
    scene_detection_mode:       getVal('s-scene-mode'),
    energy_mode:                getVal('s-energy-mode'),
    silence_threshold_ms:       getNum('s-silence-ms', parseInt),
    min_clip_ms:                getNum('s-min-clip-ms', parseInt),
    thermal_autopause_enabled:  getChk('s-thermal-autopause'),
    thermal_warn_c:             getNum('s-thermal-warn-c', parseInt),
    thermal_pause_c:            getNum('s-thermal-pause-c', parseInt),
    export_name_template:       getVal('s-export-name-template'),
    title_card_bg_color:        getVal('s-title-card-bg-color'),
    title_card_font_color:      getVal('s-title-card-font-color'),
    title_card_scale:           getNum('s-title-card-scale', parseFloat),
    title_card_template:        getVal('s-title-card-template'),
    title_card_duration_s:      getNum('s-title-card-duration', parseFloat),
    caption_font_name:          getVal('s-caption-font-name') ?? '',
    caption_font_size:          _captionSizeValue(getVal('s-caption-font-size')),
    caption_position:           getVal('s-caption-position'),
    ...(tlSec ? {ui_timeline_interval_seconds: tlSec, ui_timeline_interval_unit: tlUnit} : {}),
  };

  localStorage.setItem('yuuclip-autoplay', getChk('s-autoplay'));
  localStorage.setItem('yuuclip-play-next', getChk('s-play-next'));
  localStorage.setItem('yuuclip-loop-clip', getChk('s-loop-clip'));
  localStorage.setItem('yuuclip-playback-rate', getVal('s-playback-rate'));
  applyPlaybackRate(playbackRatePref());

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
    window.commitSoundSettings?.();
    _flashSettingsSaved();
    _snapshotSettings();
    _checkSettingsDirty();
    if (btn) btn.textContent = 'Save';
    _updateLlmRemoteIndicator(payload.llm_backend || 'llamacpp', payload.ollama_enabled !== false);
    _updateLlmCapabilities();
    _renderCapabilityTiers();
    window._visionEnabled = payload.vision_enabled === true;
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

  // The settings panel is a fixed overlay pinned below the header (CSS reads
  // --header-height for `top`). The header grows/shrinks as badges appear (remote
  // LLM), the job-progress row shows during analyze, or buttons wrap — so keep the
  // token live rather than snapshotting it once, or a stale value lets the panel
  // ride up over the header buttons.
  const header = document.querySelector('header');
  if (header && typeof ResizeObserver !== 'undefined') {
    const syncHeaderHeight = () =>
      document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    syncHeaderHeight();
    new ResizeObserver(syncHeaderHeight).observe(header);
  }

  // Show "Re-run Setup Wizard" in the hamburger only when running inside Electron.
  if (window.electronAPI) {
    const btn = document.getElementById('btn-setup-wizard');
    if (btn) btn.style.display = '';
  }

  // The global Escape handler leaves Escape to typing surfaces, so the glossary
  // filter handles it itself: first press clears the filter, second closes.
  const glossaryFilter = document.getElementById('glossary-filter');
  if (glossaryFilter) {
    glossaryFilter.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (glossaryFilter.value) {
        glossaryFilter.value = '';
        _filterGlossary('');
      } else {
        closeGlossaryModal();
      }
    });
  }
});

// Public API — symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  openSettings, closeSettings, saveSettings, applyTheme,
  _onLlmBackendChange, _onLlmEnabledChange, _onDiarizationBackendChange, _onLaughModeChange,
  _onSimilarityBackendChange, _onPrivacyModeChange, _setPrivacyMode, _currentPrivacyMode,
  _onPlayNextChange, _onLoopClipChange,
  _toggleSecretVisibility, _onHfTokenInput, _updateDiarizationStatus,
  _scrollToSettingsSection, _resetScoringWeights, _checkSettingsDirty,
  applyContentPreset, _onContentPresetChange,
});
})();
