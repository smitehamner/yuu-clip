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
    // Speaker labels are bundled and on by default (tokenless speechbrain) —
    // the wizard no longer offers a per-feature choice here. Set explicitly
    // (rather than omit) so re-running the wizard on a project that had an
    // old "pyannote" choice actually clears it back to the current default;
    // writeProjectConfig() merges onto the existing config.json, so an
    // omitted key would leave a stale value in place.
    diarization_backend: 'speechbrain',
    content_preset:   cfg.contentPreset || 'generic',
  };
  if (cfg.llmBackend === 'llamacpp') {
    pyCfg.llm_model_path = cfg.llmModelPath || '';
  } else if (cfg.llmBackend === 'claude') {
    pyCfg.claude_api_key = cfg.claudeApiKey || '';
    pyCfg.claude_model   = cfg.claudeModel  || defaultClaudeModel;
  } else {
    pyCfg.ollama_model = cfg.ollamaModel || defaultOllamaModel;
  }
  return pyCfg;
}

module.exports = { buildProjectConfigFromWizard };
