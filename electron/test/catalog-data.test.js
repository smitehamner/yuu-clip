'use strict';

// The setup wizard's model/whisper/preset facts are single-sourced from the generated
// electron/shared/catalog-data.json (`yuu-dev shared-data`, guarded by
// tests/unit/test_shared_data_drift.py). These tests pin that the electron consumers
// read from that JSON rather than a hand-copied literal, so a catalog change can't
// silently skip the wizard.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const catalog = require('../shared/catalog-data.json');
const { DEFAULT_LLAMACPP_MODEL, CATALOG_DATA } = require('../constants');
const { MODEL_ID, MODEL_SIZE_GB } = require('../recommend-model');

test('constants re-exports the generated catalog', () => {
  assert.equal(CATALOG_DATA, catalog);
});

test('DEFAULT_LLAMACPP_MODEL is derived from the catalog recommended_model', () => {
  const rec = catalog.recommended_model;
  assert.equal(DEFAULT_LLAMACPP_MODEL.id, rec.id);
  assert.equal(DEFAULT_LLAMACPP_MODEL.repoUrl, rec.gguf_url);
  assert.equal(DEFAULT_LLAMACPP_MODEL.filename, rec.filename);
  assert.equal(DEFAULT_LLAMACPP_MODEL.sizeGb, rec.size_gb);
});

test('recommend-model pushes the catalog recommended model', () => {
  assert.equal(MODEL_ID, catalog.recommended_model.id);
  assert.equal(MODEL_SIZE_GB, catalog.recommended_model.size_gb);
});

test('recommended_model is a text llama.cpp model the wizard can download', () => {
  const rec = catalog.recommended_model;
  assert.ok(rec.filename && rec.filename.endsWith('.gguf'));
  assert.ok(rec.gguf_url && rec.gguf_url.startsWith('https://'));
  assert.equal(rec.resolve_url, `${rec.gguf_url}/resolve/main/${rec.filename}`);
});

test('catalog carries the wizard option lists', () => {
  assert.ok(Array.isArray(catalog.whisper_models) && catalog.whisper_models.length === 5);
  for (const m of catalog.whisper_models) {
    assert.ok(m.id && m.option_text, 'whisper model needs id + option_text');
  }
  assert.ok(catalog.whisper_languages.length > 50);
  assert.ok(catalog.content_presets.some(p => p.id === 'generic'));
  assert.deepEqual(
    catalog.ai_privacy_options.map(o => o.value),
    ['none', 'local_only']
  );
});
