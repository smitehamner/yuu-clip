'use strict';

// Shared paths and default-model constants for the desktop wrapper, split out of
// main.js so logging / electron-config / install can share them without importing
// main. Derived from env + process.resourcesPath at load, exactly as when they
// lived in main.js.

const path = require('path');

const VENV_DIR    = path.join(process.env.LOCALAPPDATA, 'yuu-clip', 'venv');
const VENV_PYTHON = path.join(VENV_DIR, 'Scripts', 'python.exe');
const VENV_PIP    = path.join(VENV_DIR, 'Scripts', 'pip.exe');

// Pinned CPython bundled into the installer (see scripts/fetch-python-runtime.ps1)
// so end users never need a system Python. Only present in packaged builds -
// dev mode (running unpackaged) falls back to a system Python on PATH.
const BUNDLED_PYTHON = path.join(process.resourcesPath || '', 'python', 'python.exe');

// Pinned GPL FFmpeg bundled into the installer (see
// scripts/fetch-ffmpeg-runtime.ps1 and docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md)
// so end users never need to install FFmpeg themselves. Only present in
// packaged builds - dev mode keeps resolving FFmpeg from PATH.
const BUNDLED_FFMPEG_DIR = path.join(process.resourcesPath || '', 'ffmpeg');

// Pinned upstream llama.cpp `llama-server` binaries (Vulkan + CPU) bundled into
// the installer (see scripts/fetch-llama-server-runtime.ps1) so local LLM/vision
// inference has GPU acceleration with nothing to install. Only present in packaged
// builds; dev mode resolves llama-server from PATH or config. The dir holds
// vulkan\ and cpu\ subfolders - the Python side (resolve_server_binary) prefers
// vulkan and falls back to cpu.
const BUNDLED_LLAMA_SERVER_DIR = path.join(process.resourcesPath || '', 'llama-server');
const SETUP_LOG   = path.join(process.env.APPDATA, 'yuu-clip', 'yuu-clip_install.log');
const SETUP_COMPLETE_MARKER = path.join(process.env.APPDATA, 'yuu-clip', 'setup-complete');
const WHEEL_MARKER          = path.join(process.env.APPDATA, 'yuu-clip', 'installed-wheel-version');
const ELECTRON_CONFIG_PATH  = path.join(process.env.APPDATA, 'yuu-clip', 'electron-config.json');

const DEFAULT_PROJECT_DIR = path.join(process.env.USERPROFILE, 'Videos', 'yuu-clip');
const BASE_PORT = 8080;

const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// Distribution/dev gate for the remote (Claude) backend (WS4), mirroring the Python
// Config.remote_ai_enabled default. Shipped builds keep this false so the wizard never
// offers the remote path; a truthy YUU_REMOTE_AI env var overrides it for own testing
// (see remoteAiEnabled() in main.js). Keep in sync with yuu_clip/config.py.
const REMOTE_AI_ENABLED = false;

// Effective remote-AI gate: the build constant OR a truthy YUU_REMOTE_AI env var.
// Mirrors Python's remote_ai_allowed so the wizard offers the remote backend under
// exactly the same conditions as the in-app Settings do.
function isRemoteAiEnabled(env = process.env) {
  const value = String((env && env.YUU_REMOTE_AI) || '').trim().toLowerCase();
  return REMOTE_AI_ENABLED || ['1', 'true', 'yes', 'on'].includes(value);
}

// Cross-checked against yuu_clip/model_catalog.py by
// tests/test_model_catalog.py::test_electron_wizard_default_llamacpp_model_matches_the_catalog
// - keep id/repoUrl/filename in sync with that catalog entry.
const DEFAULT_LLAMACPP_MODEL = {
  id: 'qwen2.5-7b-instruct',
  repoUrl: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF',
  filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
  sizeGb: 4.7,
};

// One-click .gguf downloads land here, out of the user's way (same spirit as
// the venv/runtime dirs) - never a folder picker for this.
const MODELS_DIR = path.join(process.env.LOCALAPPDATA, 'yuu-clip', 'models');

// Bump ONLY when the setup wizard gains new settings or steps. A completed
// setup stores this number; an older stored number re-shows the wizard once
// after updating, so existing users discover the new options. Routine app
// updates that don't change setup stay silent.
const SETUP_SCHEMA_VERSION = 3;

module.exports = {
  VENV_DIR, VENV_PYTHON, VENV_PIP,
  BUNDLED_PYTHON, BUNDLED_FFMPEG_DIR, BUNDLED_LLAMA_SERVER_DIR,
  SETUP_LOG, SETUP_COMPLETE_MARKER, WHEEL_MARKER, ELECTRON_CONFIG_PATH,
  DEFAULT_PROJECT_DIR, BASE_PORT,
  DEFAULT_CLAUDE_MODEL, REMOTE_AI_ENABLED, isRemoteAiEnabled,
  DEFAULT_LLAMACPP_MODEL, MODELS_DIR, SETUP_SCHEMA_VERSION,
};
