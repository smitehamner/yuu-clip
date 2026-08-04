'use strict';

const path = require('node:path');

// Pure cfg -> pyCfg mapping for the setup wizard's `setup:complete` handler,
// split out of main.js so the per-backend branching that seeds the backend's
// config.json can be unit-tested without Electron.

// Belt-and-braces guard for `setup:complete`: the renderer disables Launch
// until a folder is chosen (#project-dir is a readonly field only ever set
// from the OS folder picker or a saved default, both always absolute), but an
// empty or relative value here would otherwise get mkdir'd and handed to the
// Python process as --project.
function resolveProjectDir(cfg, defaultDir) {
  if (cfg.projectDir && path.isAbsolute(cfg.projectDir)) return cfg.projectDir;
  return defaultDir;
}

function buildProjectConfigFromWizard(cfg) {
  const pyCfg = {
    whisper_model:    cfg.whisperModel,
    whisper_language: cfg.whisperLanguage || '',
    ai_privacy_mode:  cfg.aiPrivacyMode || 'local_only',
    // Local inference only - yuu-clip has a single LLM backend.
    llm_backend:      'llamacpp',
    // Speaker labels are bundled and on by default (tokenless speechbrain) -
    // the wizard no longer offers a per-feature choice here. Set explicitly
    // (rather than omit) so re-running the wizard on a project that had an
    // old "pyannote" choice actually clears it back to the current default;
    // writeProjectConfig() merges onto the existing config.json, so an
    // omitted key would leave a stale value in place.
    diarization_backend: 'speechbrain',
    content_preset:   cfg.contentPreset || 'generic',
    // Boot-time handoff flag (first-run-friction Stage 3/4): set to a catalog
    // model id only when the user opts into local AI without a model file in
    // hand. Written explicitly (empty by default) so re-running the wizard and
    // switching to lightweight clears a stale value - see the diarization_backend
    // note above on why an omitted key would not.
    pending_local_model: '',
    // Background model prefetch is default-ON (first-run-friction Stage 6): one
    // wizard checkbox covers the speech + speaker models, checked unless the user
    // opts out. Only an explicit `false` disables it; an absent field keeps the
    // default-on behaviour.
    model_prefetch_disabled: cfg.modelPrefetch === false,
    llm_model_path: cfg.llmModelPath || '',
  };
  const hasModelFile = Boolean((cfg.llmModelPath || '').trim());
  const wantsLocal = cfg.localModelChoice === 'local' && cfg.aiPrivacyMode !== 'none';
  if (wantsLocal && !hasModelFile && cfg.recommendedModelId) {
    pyCfg.pending_local_model = cfg.recommendedModelId;
  }
  // Written explicitly both ways (not just on lightweight) so re-running the
  // wizard and switching back to local AI clears a stale `false` - see the
  // diarization_backend note above on why an omitted key would not. Without
  // this, "Lightweight mode" left config.py's `llm_enabled: bool = True`
  // default in place with no model configured, and the Setup Warnings chip
  // (gpustatus.js gpuMismatchReasons) read that as "enabled but broken" and
  // lit up on every launch, even though lightweight mode was working exactly
  // as chosen.
  pyCfg.llm_enabled = wantsLocal || hasModelFile;
  return pyCfg;
}

module.exports = { buildProjectConfigFromWizard, resolveProjectDir };
