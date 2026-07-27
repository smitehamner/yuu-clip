'use strict';

const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ELECTRON_CONFIG_PATH is derived from process.env.APPDATA at require time
// (constants.js), so the override below must happen before the first require
// of constants/electron-config. node --test isolates each test file in its
// own process, so this does not leak into other test files.
const tempAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'yuu-electron-config-'));
process.env.APPDATA = tempAppData;

const { loadElectronConfig, saveElectronConfig, writeProjectConfig } = require('../electron-config');
const { ELECTRON_CONFIG_PATH } = require('../constants');

beforeEach(() => {
  fs.rmSync(ELECTRON_CONFIG_PATH, { force: true });
});

after(() => {
  fs.rmSync(tempAppData, { recursive: true, force: true });
});

test('loadElectronConfig returns an empty object when no file exists yet', () => {
  assert.deepEqual(loadElectronConfig(), {});
});

test('loadElectronConfig returns an empty object when the file is corrupt JSON', () => {
  fs.mkdirSync(path.dirname(ELECTRON_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(ELECTRON_CONFIG_PATH, '{not valid json');
  assert.deepEqual(loadElectronConfig(), {});
});

test('saveElectronConfig creates the config dir and file on first write', () => {
  saveElectronConfig({ projectDir: 'C:\\Videos\\yuu-clip' });
  assert.equal(fs.existsSync(ELECTRON_CONFIG_PATH), true);
  assert.deepEqual(loadElectronConfig(), { projectDir: 'C:\\Videos\\yuu-clip' });
});

test('saveElectronConfig merges a new key with the existing config rather than overwriting it', () => {
  saveElectronConfig({ a: 1 });
  saveElectronConfig({ b: 2 });
  assert.deepEqual(loadElectronConfig(), { a: 1, b: 2 });
});

test('saveElectronConfig overwrites an existing key with the new value', () => {
  saveElectronConfig({ a: 1 });
  saveElectronConfig({ a: 2 });
  assert.deepEqual(loadElectronConfig(), { a: 2 });
});

function withTempProjectDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yuu-project-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('writeProjectConfig creates .yuu-clip/config.json under the project dir', () => {
  withTempProjectDir(projectDir => {
    writeProjectConfig(projectDir, { whisper_model: 'medium' });
    const cfgPath = path.join(projectDir, '.yuu-clip', 'config.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(cfgPath, 'utf8')), { whisper_model: 'medium' });
  });
});

test('writeProjectConfig merges with an existing project config.json', () => {
  withTempProjectDir(projectDir => {
    writeProjectConfig(projectDir, { whisper_model: 'medium' });
    writeProjectConfig(projectDir, { llm_model_path: 'foo.gguf' });
    const cfgPath = path.join(projectDir, '.yuu-clip', 'config.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(cfgPath, 'utf8')), {
      whisper_model: 'medium',
      llm_model_path: 'foo.gguf',
    });
  });
});

test('writeProjectConfig overwrites a key that already exists in the project config', () => {
  withTempProjectDir(projectDir => {
    writeProjectConfig(projectDir, { whisper_model: 'medium' });
    writeProjectConfig(projectDir, { whisper_model: 'large-v3' });
    const cfgPath = path.join(projectDir, '.yuu-clip', 'config.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(cfgPath, 'utf8')), { whisper_model: 'large-v3' });
  });
});

test('writeProjectConfig starts fresh when the existing project config.json is corrupt', () => {
  withTempProjectDir(projectDir => {
    fs.mkdirSync(path.join(projectDir, '.yuu-clip'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, '.yuu-clip', 'config.json'), 'not json');
    writeProjectConfig(projectDir, { whisper_model: 'medium' });
    const cfgPath = path.join(projectDir, '.yuu-clip', 'config.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(cfgPath, 'utf8')), { whisper_model: 'medium' });
  });
});
