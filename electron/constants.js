'use strict';

// Shared paths and default-model constants for the desktop wrapper, split out of
// main.js so logging / electron-config / install can share them without importing
// main. Derived from env + process.resourcesPath at load, exactly as when they
// lived in main.js.

const path = require('path');

// Shared catalog facts generated from the Python sources of truth by
// `yuu-dev shared-data` (see yuu_clip/dev/shareddata.py). Committed here so the main
// process can read them before the Python server (or even the venv) exists. Keep in
// sync via that command - tests/unit/test_shared_data_drift.py guards it.
const CATALOG_DATA = require('./shared/catalog-data.json');

const VENV_DIR    = path.join(process.env.LOCALAPPDATA, 'yuu-clip', 'venv');
// pip is always invoked as `VENV_PYTHON -m pip`, never Scripts/pip.exe directly -
// that launcher stub embeds an absolute path to the interpreter that existed when
// pip was installed into the venv (the release-build machine's own path for the
// prebuilt/relocated venv), which breaks silently once the venv is extracted onto
// a different machine (found 2026-07-28: GPU-acceleration restore-after-upgrade
// reported success but wrote into the build machine's leftover venv, not the
// deployed one). `python -m pip` always resolves through the calling interpreter.
const VENV_PYTHON = path.join(VENV_DIR, 'Scripts', 'python.exe');

// Pinned CPython bundled into the installer (see scripts/windows-release/fetch-python-runtime.ps1)
// so end users never need a system Python. Only present in packaged builds -
// dev mode (running unpackaged) falls back to a system Python on PATH.
const BUNDLED_PYTHON = path.join(process.resourcesPath || '', 'python', 'python.exe');

// Pinned GPL FFmpeg bundled into the installer (see
// scripts/windows-release/fetch-ffmpeg-runtime.ps1 and docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md)
// so end users never need to install FFmpeg themselves. Only present in
// packaged builds - dev mode keeps resolving FFmpeg from PATH.
const BUNDLED_FFMPEG_DIR = path.join(process.resourcesPath || '', 'ffmpeg');

// Pinned upstream llama.cpp `llama-server` binaries (Vulkan + CPU) bundled into
// the installer (see scripts/windows-release/fetch-llama-server-runtime.ps1) so local LLM/vision
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

// The wizard's default text model, sourced from the generated catalog (no longer a
// hand-copied literal). `recommended_model` is model_catalog.py's first recommended
// text entry; the drift test keeps the JSON current with the catalog.
const _rec = CATALOG_DATA.recommended_model;
const DEFAULT_LLAMACPP_MODEL = {
  id: _rec.id,
  repoUrl: _rec.gguf_url,
  filename: _rec.filename,
  sizeGb: _rec.size_gb,
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
  VENV_DIR, VENV_PYTHON,
  BUNDLED_PYTHON, BUNDLED_FFMPEG_DIR, BUNDLED_LLAMA_SERVER_DIR,
  SETUP_LOG, SETUP_COMPLETE_MARKER, WHEEL_MARKER, ELECTRON_CONFIG_PATH,
  DEFAULT_PROJECT_DIR, BASE_PORT,
  DEFAULT_LLAMACPP_MODEL, MODELS_DIR, SETUP_SCHEMA_VERSION,
  CATALOG_DATA,
};
