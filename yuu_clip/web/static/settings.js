(function () {
// Feature-map - Settings panel (all sections; see the per-section banners below).
//   API: routes/config.py, llm.py, profiles.py, content_presets.py, export_presets.py · Tests: tests/test_ui_settings.py
// ── settings panel ────────────────────────────────────────────────────────────
const _settingsFieldIds = [
  's-whisper-model','s-whisper-device','s-whisper-compute','s-whisper-language',
  's-ai-privacy-value',
  's-llm-enabled','s-llm-backend','s-llm-model-path','s-llm-vision-model-path','s-llm-mmproj-path','s-llm-use-gpu',
  's-vision-enabled','s-vision-frames',
  's-claude-api-key','s-claude-model','s-claude-timeout',
  's-diarization-backend','s-hf-token','s-speaker-match-threshold','s-speaker-cluster-threshold',
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
// [element id, config key, default] - single source for apply + Reset to defaults.
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
    await _ensureDefaults();  // so the Reset controls work without a per-click fetch
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
    // the panel down - visibly so since Wave 4's taller Capabilities section.
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
    } catch { /* Intl.DisplayNames unavailable - show raw codes */ }
    const named = languages
      .map(code => ({ code, name: nameOf(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    sel.innerHTML = '<option value="">Auto-detect (recommended)</option>' +
      named.map(o => `<option value="${escHtml(o.code)}">${escHtml(o.name)}</option>`).join('');
    _whisperLangsLoaded = true;
  } catch { /* keep Auto-detect-only fallback */ }
}

// Selects whose option values are numeric strings (e.g. "1.0") won't match a
// JSON number reformatted by JS (1.0 -> "1") via plain .value assignment -
// match by parsed value instead so the saved scale selects the right option.
function _setSelectByNumber(id, num) {
  const el = document.getElementById(id);
  if (!el) return;
  const opt = Array.from(el.options).find(o => parseFloat(o.value) === num);
  if (opt) el.value = opt.value;
}

function _setFieldVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function _setFieldChk(id, val) { const el = document.getElementById(id); if (el) el.checked = val; }
function _setFieldTxt(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

// Per-section field appliers - the single source for rendering a config into
// each section's controls, shared by the initial load (_applySettingsToUI) and
// the per-section / whole-panel "Reset to defaults" controls (revertSection).
// The `?? default` fallbacks handle a partial/legacy saved config on load;
// reverts pass a complete factory config from /api/config/defaults.
function _applySttFields(cfg) {
  _setFieldVal('s-whisper-model',  cfg.whisper_model   || 'base');
  _setFieldVal('s-whisper-device', cfg.whisper_device  || 'auto');
  _setFieldVal('s-whisper-compute',cfg.whisper_compute_type || 'int8');
  _setFieldVal('s-whisper-language', cfg.whisper_language || '');
}

function _applyLlmFields(cfg) {
  _setFieldChk('s-llm-enabled',  cfg.llm_enabled   !== false);
  _onLlmEnabledChange(cfg.llm_enabled !== false);
  const backend = cfg.llm_backend || 'llamacpp';
  _setFieldVal('s-llm-backend',    backend);
  _onLlmBackendChange(backend);
  _setFieldVal('s-llm-model-path', cfg.llm_model_path  || '');
  _setFieldVal('s-llm-vision-model-path', cfg.llm_vision_model_path || '');
  _setFieldVal('s-llm-mmproj-path', cfg.llm_mmproj_path || '');
  _setFieldChk('s-llm-use-gpu', cfg.llm_use_gpu !== false);
  _setFieldChk('s-vision-enabled', cfg.vision_enabled === true);
  _setFieldVal('s-vision-frames',  cfg.vision_frames_per_clip ?? 2);
  window._visionEnabled = cfg.vision_enabled === true;
  _setFieldVal('s-claude-api-key', cfg.claude_api_key  || '');
  _setClaudeModelValue(cfg.claude_model || 'claude-haiku-4-5-20251001');
  _setFieldVal('s-claude-timeout', cfg.claude_timeout_s ?? 30);
  _setFieldVal('s-similarity-backend', cfg.similarity_backend || 'embeddings');
  // After the backend + similarity selects are populated: applies the privacy mode,
  // which re-evaluates backend visibility, the remote badge, and option filtering.
  _setPrivacyMode(cfg.ai_privacy_mode || 'local_only');
  _onSimilarityBackendChange(cfg.similarity_backend || 'embeddings');
  _updateLlmCapabilities();
  _renderCapabilityTiers();
}

function _applySpeakerFields(cfg) {
  const diarBackend = cfg.diarization_backend || 'speechbrain';
  _setFieldVal('s-diarization-backend', diarBackend);
  _onDiarizationBackendChange(diarBackend);
  _setFieldVal('s-hf-token', cfg.huggingface_token || '');
  _setFieldVal('s-speaker-match-threshold', (cfg.speaker_match_threshold ?? 0.75).toFixed(2));
  _setFieldVal('s-speaker-cluster-threshold', (cfg.speaker_cluster_threshold ?? 0.55).toFixed(2));
  _onHfTokenInput();
}

function _applyWeightFields(cfg) {
  for (const [id, key, def] of _weightFields) {
    const weight = (cfg[key] ?? def).toFixed(1);
    _setFieldVal(id, weight);
    _setFieldTxt(`${id}-val`, weight);
  }
  _setFieldVal('s-laugh-mode',    cfg.scorer_laugh_mode     || 'transcript');
  _setFieldVal('s-laugh-model-id',cfg.scorer_laugh_model_id || 'MIT/ast-finetuned-audioset-10-10-0.4593');
  _onLaughModeChange(cfg.scorer_laugh_mode || 'transcript');
  _setFieldChk('s-audio-event-enabled', cfg.scorer_audio_event_enabled === true);
}

function _applyAnalysisFields(cfg) {
  _setFieldVal('s-scene-mode',    cfg.scene_detection_mode || 'fast');
  _setFieldVal('s-energy-mode',   cfg.energy_mode          || 'fast');
  _setFieldVal('s-silence-ms',    cfg.silence_threshold_ms ?? 3000);
  _setFieldVal('s-min-clip-ms',   cfg.min_clip_ms          ?? 15000);
  const silenceEl = document.getElementById('s-silence-ms');
  const minClipEl = document.getElementById('s-min-clip-ms');
  const silenceHint = document.getElementById('s-silence-ms-hint');
  const minClipHint = document.getElementById('s-min-clip-ms-hint');
  if (silenceEl && silenceHint) silenceHint.textContent = (silenceEl.value / 1000).toFixed(1) + ' s';
  if (minClipEl && minClipHint) minClipHint.textContent = (minClipEl.value / 1000).toFixed(1) + ' s';
}

function _applyHardwareFields(cfg) {
  _setFieldChk('s-thermal-autopause', cfg.thermal_autopause_enabled !== false);
  _setFieldVal('s-thermal-warn-c',    cfg.thermal_warn_c  ?? 85);
  _setFieldVal('s-thermal-pause-c',   cfg.thermal_pause_c ?? 90);
}

// Timeline is a saved config field; the playback/theme prefs below it are
// browser-local (localStorage), applied by saveSettings, not the config PATCH.
function _applyUiFields(cfg) {
  const tlUnit = cfg.ui_timeline_interval_unit || 'minutes';
  const tlSec  = cfg.ui_timeline_interval_seconds ?? 900;
  const tlVal  = tlUnit === 'minutes' ? Math.round(tlSec / 60) : tlSec;
  _setFieldVal('s-timeline-interval', tlVal);
  _setFieldVal('s-timeline-unit',     tlUnit);
  _setFieldChk('s-autoplay', localStorage.getItem('yuuclip-autoplay') === 'true');
  _setFieldChk('s-play-next', localStorage.getItem('yuuclip-play-next') === 'true');
  _setFieldChk('s-loop-clip', localStorage.getItem('yuuclip-loop-clip') === 'true');
  _setFieldVal('s-playback-rate', String(playbackRatePref()));
  _setFieldVal('s-theme', localStorage.getItem('yuuclip-theme') || 'dark');
}

function _applyExportFields(cfg) {
  _setFieldVal('s-export-name-template', cfg.export_name_template || '{video}_clip{clip_id}_{start}');
  _updateExportNameTemplatePreview();
  _setFieldVal('s-title-card-bg-color', cfg.title_card_bg_color || '#000000');
  _setFieldVal('s-title-card-font-color', cfg.title_card_font_color || '#ffffff');
  _setSelectByNumber('s-title-card-scale', cfg.title_card_scale ?? 1.0);
  _setFieldVal('s-title-card-template', cfg.title_card_template ?? '{description}\n{start} · {duration}');
  _setFieldVal('s-title-card-duration', cfg.title_card_duration_s ?? 3.0);
  _updateTitleCardPreview();
  _setFieldVal('s-caption-font-name', cfg.caption_font_name || '');
  _setFieldVal('s-caption-font-size', cfg.caption_font_size ? cfg.caption_font_size : '');
  _setFieldVal('s-caption-position', cfg.caption_position || 'bottom');
}

// section id -> the applier that renders that section's fields from a config.
const _SECTION_APPLIERS = {
  'settings-sec-stt':      _applySttFields,
  'settings-sec-llm':      _applyLlmFields,
  'settings-sec-speakers': _applySpeakerFields,
  'settings-sec-weights':  _applyWeightFields,
  'settings-sec-analysis': _applyAnalysisFields,
  'settings-sec-hardware': _applyHardwareFields,
  'settings-sec-ui':       _applyUiFields,
  'settings-sec-export':   _applyExportFields,
};

function _applySettingsToUI(cfg) {
  _applySttFields(cfg);
  _applyLlmFields(cfg);
  _applySpeakerFields(cfg);
  _applyWeightFields(cfg);
  _applyAnalysisFields(cfg);
  _applyHardwareFields(cfg);
  _applyUiFields(cfg);
  _applyExportFields(cfg);
  _snapshotSettings();
  _checkSettingsDirty();
  ['pyannote', 'cuda-libs'].forEach(_refreshInstallStatus);
}

// Factory defaults, fetched once per session and reused by every reset control.
let _defaultsCfg = null;
async function _ensureDefaults() {
  if (_defaultsCfg) return _defaultsCfg;
  _defaultsCfg = await fetch('/api/config/defaults').then(r => r.json());
  return _defaultsCfg;
}

// The playback/theme prefs are browser-local, not in the config, so their
// defaults live here rather than in the backend defaults payload.
function _resetUiPrefsToDefaults() {
  _setFieldChk('s-autoplay', false);
  _setFieldChk('s-play-next', false);
  _setFieldChk('s-loop-clip', false);
  _setFieldVal('s-playback-rate', '1');
  _setFieldVal('s-theme', 'dark');
  applyTheme('dark');
}

// Fill one section's controls with factory defaults, leaving every other
// section untouched. Stages into the form (flags dirty); nothing persists
// until the user clicks Save. Defaults are prefetched when Settings opens.
function revertSection(sectionId) {
  const applier = _SECTION_APPLIERS[sectionId];
  if (!applier || !_defaultsCfg) return;
  applier(_defaultsCfg);
  if (sectionId === 'settings-sec-ui') _resetUiPrefsToDefaults();
  _checkSettingsDirty();
}

function revertAllSettings() {
  if (!_defaultsCfg) return;
  showConfirm(
    'Reset all settings to defaults?',
    'Every setting will be replaced with its default value. Nothing is saved until you click Save, so you can cancel by closing Settings without saving.',
    'Reset all',
    () => {
      for (const applier of Object.values(_SECTION_APPLIERS)) applier(_defaultsCfg);
      _resetUiPrefsToDefaults();
      _checkSettingsDirty();
      showToast('Settings reset to defaults - review and click Save to apply', 'info');
    },
    true,
  );
}

// Applies instantly (outside the Save flow) so the user sees the theme while
// choosing it. Deliberately not in _settingsFieldIds - must not flag dirty.
// The inline <head> script in index.html reads the same key before first paint.
function applyTheme(theme) {
  if (theme === 'dark') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  localStorage.setItem('yuuclip-theme', theme);
}

// ── LLM scoring section (enable toggle + backend selection) ──────────────────
// Everything below the master toggle is inert while LLM scoring is off -
// inert (not disabled) so the fields keep their values for the save payload.
function _onLlmEnabledChange(enabled) {
  const body = document.getElementById('s-llm-body');
  if (!body) return;
  body.classList.toggle('settings-dimmed', !enabled);
  body.inert = !enabled;
}

function _onLlmBackendChange(backend) {
  const mode = _currentPrivacyMode();
  const isClaude      = backend === 'claude';
  const remoteAllowed = mode === 'remote_ok';
  // The local-model picker (cards) lives in the main flow; #s-llamacpp-fields (GPU +
  // manual paths) lives under Advanced. Both are llamacpp-only, so toggle together.
  const pickerEl   = document.getElementById('s-llamacpp-picker');
  const llamacppEl = document.getElementById('s-llamacpp-fields');
  const claudeEl   = document.getElementById('s-claude-fields');
  const warnEl     = document.getElementById('s-backend-remote-warning');
  const blockedEl  = document.getElementById('s-remote-blocked-notice');
  if (pickerEl)   pickerEl.style.display   = backend === 'llamacpp' ? '' : 'none';
  if (llamacppEl) llamacppEl.style.display = backend === 'llamacpp' ? '' : 'none';
  if (claudeEl)   claudeEl.style.display   = isClaude ? '' : 'none';
  // Costs warning only when the remote backend is actually usable; otherwise the
  // "blocked by AI privacy mode" notice explains why a saved Claude backend is inert.
  if (warnEl)     warnEl.style.display     = (isClaude && remoteAllowed)  ? '' : 'none';
  if (blockedEl)  blockedEl.style.display  = (isClaude && !remoteAllowed) ? '' : 'none';
}

// ── AI privacy mode (plan non-llm-tiers/07) ─────────────────────────────────
// The UI mirror of the server-side trust guarantee. Hiding the remote option and
// collapsing the generative block is presentation only - enforcement lives in
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
  _updateLlmRemoteIndicator(backend, document.getElementById('s-llm-enabled')?.checked !== false);
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
  // backend (demoted - SpeechBrain is the default) - the install/token status
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
      fb.textContent = '⚠ HuggingFace tokens normally start with "hf_" - double-check this value';
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
    el.innerHTML = `<span>${installed ? '✓' : '○'} SpeechBrain installed - no token needed</span>`;
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

// Play-next and loop-clip are mutually exclusive - looping a clip forever
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
  showToast(`Applied content type${added} - re-score to apply the new weighting`, 'success');
}

// The preset already persisted these weights server-side, so rebaseline the
// settings snapshot for the weight fields - otherwise the panel's dirty check
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
    llm_enabled:                getChk('s-llm-enabled'),
    llm_backend:                getVal('s-llm-backend'),
    llm_model_path:             getVal('s-llm-model-path'),
    llm_vision_model_path:      getVal('s-llm-vision-model-path'),
    llm_mmproj_path:            getVal('s-llm-mmproj-path'),
    llm_use_gpu:                getChk('s-llm-use-gpu'),
    vision_enabled:             getChk('s-vision-enabled'),
    vision_frames_per_clip:     getNum('s-vision-frames', v => parseInt(v, 10)),
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
    speaker_cluster_threshold:  getNum('s-speaker-cluster-threshold', parseFloat),
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
    _updateLlmRemoteIndicator(payload.llm_backend || 'llamacpp', payload.llm_enabled !== false);
    _updateLlmCapabilities();
    _renderCapabilityTiers();
    refreshModelCatalog();
    window._visionEnabled = payload.vision_enabled === true;
  } catch {
    showToast('Settings save failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}


// Native ".gguf" file picker beside each model-path field - Electron only. In
// browser-dev mode there's no electronAPI, so the buttons stay hidden and the
// text box remains the way to set a path. Reveals + wires every
// [data-browse-target] button on load.
function _wireModelBrowseButtons() {
  if (!window.electronAPI?.pickModelFile) return;
  document.querySelectorAll('.settings-browse-btn[data-browse-target]').forEach(btn => {
    btn.style.display = '';
    btn.addEventListener('click', async () => {
      const target = document.getElementById(btn.getAttribute('data-browse-target'));
      if (!target) return;
      let picked = null;
      try { picked = await window.electronAPI.pickModelFile(); } catch { picked = null; }
      if (!picked) return;  // cancelled - leave the field unchanged
      target.value = picked;
      _checkSettingsDirty();
    });
  });
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
  // LLM), the job-progress row shows during analyze, or buttons wrap - so keep the
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

  _wireModelBrowseButtons();

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

// Public API - symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  openSettings, closeSettings, saveSettings, applyTheme,
  _onLlmBackendChange, _onLlmEnabledChange, _onDiarizationBackendChange, _onLaughModeChange,
  _onSimilarityBackendChange, _onPrivacyModeChange, _setPrivacyMode, _currentPrivacyMode,
  _onPlayNextChange, _onLoopClipChange,
  _toggleSecretVisibility, _onHfTokenInput, _updateDiarizationStatus,
  _scrollToSettingsSection, revertSection, revertAllSettings, _checkSettingsDirty,
  applyContentPreset, _onContentPresetChange,
});
})();
