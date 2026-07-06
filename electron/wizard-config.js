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
    diarization_backend: cfg.diarizationEnabled ? 'pyannote' : 'null',
    content_preset:   cfg.contentPreset || 'generic',
  };
  if (cfg.diarizationEnabled) pyCfg.huggingface_token = cfg.hfToken || '';
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
