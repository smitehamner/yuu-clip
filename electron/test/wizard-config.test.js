'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildProjectConfigFromWizard } = require('../wizard-config');

const defaults = { defaultClaudeModel: 'claude-haiku-4-5-20251001', defaultOllamaModel: 'qwen2.5:7b' };

const baseCfg = {
  whisperModel: 'base',
  llmBackend: 'llamacpp',
  llmModelPath: 'C:\\models\\model.gguf',
};

test('llamacpp backend sets llm_model_path and no claude/ollama keys', () => {
  const pyCfg = buildProjectConfigFromWizard(baseCfg, defaults);
  assert.equal(pyCfg.llm_model_path, 'C:\\models\\model.gguf');
  assert.equal('claude_api_key' in pyCfg, false);
  assert.equal('claude_model' in pyCfg, false);
  assert.equal('ollama_model' in pyCfg, false);
});

test('claude backend sets claude_api_key and claude_model', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...baseCfg, llmBackend: 'claude', claudeApiKey: 'sk-test', claudeModel: 'claude-opus-4-8' },
    defaults
  );
  assert.equal(pyCfg.claude_api_key, 'sk-test');
  assert.equal(pyCfg.claude_model, 'claude-opus-4-8');
});

test('claude backend falls back to the default model when claudeModel is empty', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...baseCfg, llmBackend: 'claude', claudeApiKey: 'sk-test', claudeModel: '' },
    defaults
  );
  assert.equal(pyCfg.claude_model, defaults.defaultClaudeModel);
});

test('ollama backend (else branch) sets ollama_model', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...baseCfg, llmBackend: 'ollama', ollamaModel: 'llama3:8b' },
    defaults
  );
  assert.equal(pyCfg.ollama_model, 'llama3:8b');
});

test('ollama backend falls back to the default model when ollamaModel is empty', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...baseCfg, llmBackend: 'ollama', ollamaModel: '' },
    defaults
  );
  assert.equal(pyCfg.ollama_model, defaults.defaultOllamaModel);
});

test('speaker labels always resolve to the bundled speechbrain backend', () => {
  const pyCfg = buildProjectConfigFromWizard(baseCfg, defaults);
  assert.equal(pyCfg.diarization_backend, 'speechbrain');
});

test('the wizard never emits a pyannote backend or a huggingface token, even if stray fields are passed in', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...baseCfg, diarizationEnabled: true, hfToken: 'hf-test' },
    defaults
  );
  assert.equal(pyCfg.diarization_backend, 'speechbrain');
  assert.equal('huggingface_token' in pyCfg, false);
});

test('defaults apply for whisper_language, ai_privacy_mode, and content_preset', () => {
  const pyCfg = buildProjectConfigFromWizard(baseCfg, defaults);
  assert.equal(pyCfg.whisper_language, '');
  assert.equal(pyCfg.ai_privacy_mode, 'local_only');
  assert.equal(pyCfg.content_preset, 'generic');
});

// ── local-vs-lightweight opt-out framing (first-run-friction Stage 3) ─────────

const localOptInCfg = {
  whisperModel: 'base',
  llmBackend: 'llamacpp',
  llmModelPath: '',
  localModelChoice: 'local',
  recommendedModelId: 'qwen2.5-7b-instruct',
};

test('local opt-in with no model file records pending_local_model and leaves llm_model_path empty', () => {
  const pyCfg = buildProjectConfigFromWizard(localOptInCfg, defaults);
  assert.equal(pyCfg.llm_backend, 'llamacpp');
  assert.equal(pyCfg.llm_model_path, '');
  assert.equal(pyCfg.pending_local_model, 'qwen2.5-7b-instruct');
});

test('lightweight choice clears pending_local_model explicitly', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...localOptInCfg, localModelChoice: 'lightweight' },
    defaults
  );
  assert.equal(pyCfg.llm_model_path, '');
  assert.equal(pyCfg.pending_local_model, '');
});

test('an in-hand model file wins over the pending flag even when local is chosen', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...localOptInCfg, llmModelPath: 'C:\\models\\model.gguf' },
    defaults
  );
  assert.equal(pyCfg.llm_model_path, 'C:\\models\\model.gguf');
  assert.equal(pyCfg.pending_local_model, '');
});

test('local opt-in with generative AI disabled does not queue a download', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...localOptInCfg, aiPrivacyMode: 'none' },
    defaults
  );
  assert.equal(pyCfg.pending_local_model, '');
});

test('claude backend never sets pending_local_model', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...localOptInCfg, llmBackend: 'claude', claudeApiKey: 'sk-test' },
    defaults
  );
  assert.equal(pyCfg.pending_local_model, '');
});

test('ollama backend never sets pending_local_model', () => {
  const pyCfg = buildProjectConfigFromWizard(
    { ...localOptInCfg, llmBackend: 'ollama', ollamaModel: 'llama3:8b' },
    defaults
  );
  assert.equal(pyCfg.pending_local_model, '');
});
