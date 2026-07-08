'use strict';

// Pure cfg -> pyCfg mapping for the setup wizard's `setup:complete` handler,
// split out of main.js so the per-backend branching that seeds the backend's
// config.json can be unit-tested without Electron.

function buildProjectConfigFromWizard(cfg, defaults) {
  const { defaultClaudeModel, defaultOllamaModel } = defaults;
  const pyCfg = {
    whisper_model:    cfg.whisperModel,
    whisper_language: cfg.whisperLanguage || '',
    ai_privacy_mode:  cfg.aiPrivacyMode || 'local_only',
    llm_backend:      cfg.llmBackend,
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
    // switching to lightweight/claude/ollama clears a stale value - see the
    // diarization_backend note above on why an omitted key would not.
    pending_local_model: '',
    // Background model prefetch is default-ON (first-run-friction Stage 6): one
    // wizard checkbox covers the speech + speaker models, checked unless the user
    // opts out. Only an explicit `false` disables it; an absent field keeps the
    // default-on behaviour.
    model_prefetch_disabled: cfg.modelPrefetch === false,
  };
  if (cfg.llmBackend === 'llamacpp') {
    pyCfg.llm_model_path = cfg.llmModelPath || '';
    const hasModelFile = Boolean((cfg.llmModelPath || '').trim());
    const wantsLocal = cfg.localModelChoice === 'local' && cfg.aiPrivacyMode !== 'none';
    if (wantsLocal && !hasModelFile && cfg.recommendedModelId) {
      pyCfg.pending_local_model = cfg.recommendedModelId;
    }
  } else if (cfg.llmBackend === 'claude') {
    pyCfg.claude_api_key = cfg.claudeApiKey || '';
    pyCfg.claude_model   = cfg.claudeModel  || defaultClaudeModel;
  } else {
    pyCfg.ollama_model = cfg.ollamaModel || defaultOllamaModel;
  }
  return pyCfg;
}

module.exports = { buildProjectConfigFromWizard };
