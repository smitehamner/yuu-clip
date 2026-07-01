'use strict';

const { app, BrowserWindow, Menu, MenuItem, clipboard, dialog, ipcMain, shell } = require('electron');
const { execFileSync, spawn } = require('child_process');
const fs   = require('fs');
const http = require('http');
const net  = require('net');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const VENV_DIR    = path.join(process.env.LOCALAPPDATA, 'yuu-clip', 'venv');
const VENV_PYTHON = path.join(VENV_DIR, 'Scripts', 'python.exe');
const VENV_PIP    = path.join(VENV_DIR, 'Scripts', 'pip.exe');
const SETUP_LOG   = path.join(process.env.APPDATA, 'yuu-clip', 'yuu-clip_install.log');
const SETUP_COMPLETE_MARKER = path.join(process.env.APPDATA, 'yuu-clip', 'setup-complete');
const WHEEL_MARKER          = path.join(process.env.APPDATA, 'yuu-clip', 'installed-wheel-version');
const ELECTRON_CONFIG_PATH  = path.join(process.env.APPDATA, 'yuu-clip', 'electron-config.json');

const DEFAULT_PROJECT_DIR = path.join(process.env.USERPROFILE, 'Videos', 'yuu-clip');
const BASE_PORT = 8080;

// Bump ONLY when the setup wizard gains new settings or steps. A completed
// setup stores this number; an older stored number re-shows the wizard once
// after updating, so existing users discover the new options. Routine app
// updates that don't change setup stay silent.
const SETUP_SCHEMA_VERSION = 2;

let projectDir      = DEFAULT_PROJECT_DIR;
let pyProc          = null;
let mainWindow      = null;
let appPort         = BASE_PORT;
let wizardWin       = null;
let startupComplete = false;
let isQuitting      = false;

// ---------------------------------------------------------------------------
// Electron config persistence (project dir choice etc.)
// ---------------------------------------------------------------------------

function loadElectronConfig() {
  try {
    return JSON.parse(fs.readFileSync(ELECTRON_CONFIG_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
}

function saveElectronConfig(updates) {
  const current = loadElectronConfig();
  const merged  = { ...current, ...updates };
  fs.mkdirSync(path.dirname(ELECTRON_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(ELECTRON_CONFIG_PATH, JSON.stringify(merged, null, 2));
}

// Write whisper_model into the project's .yuu-clip/config.json so the backend
// picks it up. Merges with any existing config rather than overwriting.
function writeProjectConfig(dir, config) {
  const cfgDir  = path.join(dir, '.yuu-clip');
  const cfgPath = path.join(cfgDir, 'config.json');
  fs.mkdirSync(cfgDir, { recursive: true });
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (_) {}
  fs.writeFileSync(cfgPath, JSON.stringify({ ...existing, ...config }, null, 2));
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const MAX_LOG_FILES = 5;

function rotateLogs() {
  const dir = path.dirname(SETUP_LOG);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const oldest = `${SETUP_LOG}.${MAX_LOG_FILES - 1}`;
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
    for (let i = MAX_LOG_FILES - 2; i >= 1; i--) {
      const src = `${SETUP_LOG}.${i}`;
      if (fs.existsSync(src)) fs.renameSync(src, `${SETUP_LOG}.${i + 1}`);
    }
    if (fs.existsSync(SETUP_LOG)) fs.renameSync(SETUP_LOG, `${SETUP_LOG}.1`);
  } catch (_) {}
}

function logSetup(msg) {
  fs.mkdirSync(path.dirname(SETUP_LOG), { recursive: true });
  fs.appendFileSync(SETUP_LOG, `[${new Date().toISOString()}] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Async command runner — keeps the event loop free during long pip installs
// ---------------------------------------------------------------------------

function runCmd(cmd, args, onLine = null) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '';
    const feed = (text, isErr) => {
      if (isErr) stderr += text; else stdout += text;
      if (!onLine) return;
      for (const piece of text.split(/[\r\n]+/)) {
        const line = piece.trim();
        if (line) onLine(line);
      }
    };
    proc.stdout.on('data', d => feed(d.toString(), false));
    proc.stderr.on('data', d => feed(d.toString(), true));
    proc.on('close', code => {
      if (code === 0) { resolve({ stdout, stderr }); return; }
      const err = new Error(`Exited with code ${code}: ${cmd} ${args.join(' ')}`);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
    proc.on('error', reject);
  });
}

// Condense a raw pip output line into a short, human-readable status, or null
// for noise. `--progress-bar raw` emits "Progress <done> of <total>" lines even
// when stdout is not a TTY, which is what gives us a live percentage.
function formatPipLine(line) {
  const prog = line.match(/^Progress\s+(\d+)\s+of\s+(\d+)/i);
  if (prog) {
    const total = parseInt(prog[2]);
    if (total > 0) return `Downloading… ${Math.round((parseInt(prog[1]) / total) * 100)}%`;
    return null;
  }
  if (/^(Collecting|Downloading|Using cached|Building wheel|Preparing metadata|Installing collected)/i.test(line)) {
    return line.length > 60 ? line.slice(0, 59) + '…' : line;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Python discovery
// ---------------------------------------------------------------------------

function findPython() {
  for (const candidate of ['python3.11', 'python3', 'python']) {
    try {
      const out = execFileSync(candidate, ['--version'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const m = out.match(/Python (\d+)\.(\d+)\.(\d+)/);
      if (m && (parseInt(m[1]) > 3 || (parseInt(m[1]) === 3 && parseInt(m[2]) >= 11))) {
        logSetup(`Found python: ${candidate} (${out.trim()})`);
        return candidate;
      } else if (m) {
        logSetup(`Skipping ${candidate}: version ${out.trim()} is below 3.11`);
      }
    } catch (_) { /* not on PATH */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

function isPortInUse(port) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => { s.close(); resolve(false); });
    s.listen(port, '127.0.0.1');
  });
}

function findFreePort(start) {
  return new Promise(async resolve => {
    let p = start;
    while (await isPortInUse(p)) p++;
    resolve(p);
  });
}

async function isYuuClipOnPort(port) {
  try {
    const body   = await httpGet(`http://127.0.0.1:${port}/api/status`, 1500);
    const parsed = JSON.parse(body);
    return typeof parsed.version === 'string';
  } catch (_) {
    return false;
  }
}

function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function pollReady(port, attempts = 120, delayMs = 500) {
  const t0 = Date.now();
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < attempts; i++) {
      if (pyProc && pyProc.exitCode !== null) {
        logSetup(`Backend exited during startup (code ${pyProc.exitCode}) after ${i} poll attempts`);
        return reject(new Error(`Python backend exited unexpectedly (exit code ${pyProc.exitCode}).\n\nCheck the startup log at:\n${SETUP_LOG}`));
      }
      try {
        await httpGet(`http://127.0.0.1:${port}/api/videos`, 1000);
        logSetup(`Backend ready after ${i + 1} attempts (${Date.now() - t0} ms)`);
        return resolve();
      } catch (_) { /* not ready yet */ }
      await new Promise(r => setTimeout(r, delayMs));
    }
    logSetup(`Backend did not respond after ${attempts} attempts (${Date.now() - t0} ms)`);
    reject(new Error(`Python backend did not start within 60 seconds.\n\nCheck the startup log at:\n${SETUP_LOG}`));
  });
}

// ---------------------------------------------------------------------------
// Dependency detection
// ---------------------------------------------------------------------------

function checkFFmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

// A running process never sees PATH entries added after it started (installers
// like winget write the registry, not our environment). Re-reading the registry
// lets the wizard's "Check again" detect a just-installed FFmpeg without a full
// app restart, and makes a relaunch inherit the fresh PATH.
function refreshPathFromRegistry() {
  const readRegPath = (key) => {
    try {
      const out = execFileSync('reg', ['query', key, '/v', 'Path'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const m = out.match(/Path\s+REG(?:_EXPAND)?_SZ\s+(.+)/i);
      return m ? m[1].trim() : '';
    } catch (_) { return ''; }
  };
  const machine = readRegPath('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment');
  const user    = readRegPath('HKCU\\Environment');
  if (!machine && !user) return;
  const expand = s => s.replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`);
  process.env.PATH = [expand(machine), expand(user)].filter(Boolean).join(';');
}

// Optional packages the wizard can install into the venv. The backend exposes
// the same installs via /api/install/{slug}, but it isn't running yet during
// first-run setup, so the wizard drives pip directly.
const WIZARD_INSTALLABLE = {
  pyannote: { packages: ['pyannote.audio'],     importName: 'pyannote.audio' },
  llamacpp: { packages: ['llama-cpp-python'],   importName: 'llama_cpp' },
};

function checkVenvModule(importName) {
  const code =
    'import importlib.util, sys\n' +
    'try:\n' +
    `    found = importlib.util.find_spec(${JSON.stringify(importName)}) is not None\n` +
    'except ModuleNotFoundError:\n' +
    '    found = False\n' +
    'sys.exit(0 if found else 1)\n';
  return runCmd(VENV_PYTHON, ['-c', code]).then(() => true).catch(() => false);
}

async function checkOllama() {
  try { await httpGet('http://localhost:11434/api/tags', 2000); return true; }
  catch (_) { return false; }
}

async function checkOllamaModel(modelName) {
  try {
    const body = await httpGet('http://localhost:11434/api/tags', 2000);
    const data = JSON.parse(body);
    const base = modelName.split(':')[0];
    return (data.models || []).some(m => m.name === modelName || m.name.startsWith(base + ':'));
  } catch (_) {
    return false;
  }
}

function detectGPU() {
  try {
    const out = execFileSync(
      'wmic', ['path', 'win32_VideoController', 'get', 'Name,AdapterRAM', '/format:value'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    // Parse blocks separated by blank lines; each block has Key=Value lines.
    const gpus = [];
    let cur = {};
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^(\w+)=(.+)$/);
      if (m) {
        cur[m[1].toLowerCase()] = m[2].trim();
      } else if (Object.keys(cur).length > 0) {
        gpus.push(cur);
        cur = {};
      }
    }
    if (Object.keys(cur).length > 0) gpus.push(cur);

    // Pick GPU with most VRAM (prefer discrete over integrated).
    gpus.sort((a, b) => parseInt(b.adapterram || 0) - parseInt(a.adapterram || 0));
    const best = gpus[0];
    if (!best) return { name: 'Unknown', vramMB: 0, vendor: 'unknown' };

    const vramMB = Math.round(parseInt(best.adapterram || 0) / (1024 * 1024));
    const name   = best.name || 'Unknown';
    const nl     = name.toLowerCase();
    const vendor = nl.includes('nvidia') ? 'nvidia'
      : (nl.includes('amd') || nl.includes('radeon')) ? 'amd'
      : nl.includes('intel') ? 'intel' : 'unknown';

    return { name, vramMB, vendor };
  } catch (_) {
    return { name: 'Unknown', vramMB: 0, vendor: 'unknown' };
  }
}

function detectCUDA() {
  try {
    const out = execFileSync('nvidia-smi', [],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const m = out.match(/CUDA Version:\s*([\d.]+)/);
    return { available: true, version: m ? m[1] : 'unknown' };
  } catch (_) {
    return { available: false, version: null };
  }
}

function recommendWhisperModel(vramMB) {
  if (vramMB >= 10000) return { model: 'large-v3', reason: '10 GB+ VRAM — best accuracy'      };
  if (vramMB >=  5000) return { model: 'medium',   reason: '5 GB+ VRAM — good accuracy'       };
  if (vramMB >=  2000) return { model: 'small',    reason: '2 GB+ VRAM — balanced'            };
  if (vramMB >=  1000) return { model: 'base',     reason: '1 GB+ VRAM — fast'                };
  return                      { model: 'base',     reason: 'CPU mode — base model recommended' };
}

// ---------------------------------------------------------------------------
// Setup wizard IPC
// ---------------------------------------------------------------------------

function registerWizardIPC(wizardWin) {
  // Clean up any previous handlers first.
  for (const ch of ['setup:get-status', 'setup:pick-folder', 'setup:pick-file']) {
    try { ipcMain.removeHandler(ch); } catch (_) {}
  }
  ipcMain.removeAllListeners('setup:pull-model');
  ipcMain.removeAllListeners('setup:open-url');
  ipcMain.removeAllListeners('setup:install-package');
  ipcMain.removeAllListeners('setup:restart-app');

  ipcMain.handle('setup:get-status', async () => {
    refreshPathFromRegistry();
    const eCfg = loadElectronConfig();
    const pDir = eCfg.projectDir || DEFAULT_PROJECT_DIR;

    let projCfg = {};
    try { projCfg = JSON.parse(fs.readFileSync(path.join(pDir, '.yuu-clip', 'config.json'), 'utf8')); } catch (_) {}

    const ollamaModel   = projCfg.ollama_model || 'llama3.2';
    const gpu           = detectGPU();
    const cuda          = detectCUDA();
    const [ollamaRunning, llamacppInstalled, pyannoteInstalled] = await Promise.all([
      checkOllama(),
      checkVenvModule(WIZARD_INSTALLABLE.llamacpp.importName),
      checkVenvModule(WIZARD_INSTALLABLE.pyannote.importName),
    ]);
    const ollamaModelPulled = ollamaRunning ? await checkOllamaModel(ollamaModel) : false;

    const existingBackend   = projCfg.llm_backend;
    const existingModelPath = projCfg.llm_model_path || '';
    const defaultBackend    = existingBackend || (ollamaRunning ? 'ollama' : 'llamacpp');

    logSetup(`Status check — FFmpeg:${checkFFmpeg()} GPU:${gpu.name} CUDA:${cuda.available} Ollama:${ollamaRunning} Model:${ollamaModelPulled} llamacpp:${llamacppInstalled} pyannote:${pyannoteInstalled}`);
    return {
      ffmpegOk: checkFFmpeg(),
      gpu, cuda,
      ollamaRunning, ollamaModel, ollamaModelPulled,
      llamacppInstalled, pyannoteInstalled,
      recommendedWhisper: recommendWhisperModel(gpu.vramMB),
      projectDir: pDir,
      llmBackend:    defaultBackend,
      llmModelPath:  existingModelPath,
      claudeApiKey:  projCfg.claude_api_key  || '',
      claudeModel:   projCfg.claude_model    || 'claude-haiku-4-5-20251001',
      whisperLanguage:    projCfg.whisper_language || '',
      diarizationEnabled: projCfg.diarization_backend === 'pyannote',
      hfToken:            projCfg.huggingface_token || '',
    };
  });

  // Install an optional pip package into the venv, streaming condensed pip
  // output back as progress events keyed by slug.
  ipcMain.on('setup:install-package', async (event, slug) => {
    const spec = WIZARD_INSTALLABLE[slug];
    const send = (payload) => {
      try { event.sender.send('setup:install-progress', { slug, ...payload }); } catch (_) {}
    };
    if (!spec) { send({ error: `Unknown package '${slug}'` }); return; }
    logSetup(`Wizard install starting: ${spec.packages.join(' ')}`);
    try {
      let lastStatus = '';
      await runCmd(VENV_PIP, ['install', '--progress-bar', 'raw', ...spec.packages], line => {
        const statusText = formatPipLine(line);
        if (statusText && statusText !== lastStatus) {
          lastStatus = statusText;
          send({ status: statusText });
        }
      });
      logSetup(`Wizard install complete: ${slug}`);
      send({ done: true });
    } catch (err) {
      logSetup(`Wizard install failed: ${slug} — ${err.message}`);
      send({ error: err.message });
    }
  });

  ipcMain.on('setup:restart-app', () => {
    logSetup('Restart requested from setup wizard');
    refreshPathFromRegistry();
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('setup:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(wizardWin, {
      title: 'Choose project folder',
      defaultPath: projectDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('setup:pick-file', async (_, opts = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(wizardWin, {
      title:       opts.title || 'Choose file',
      defaultPath: opts.defaultPath,
      filters:     opts.filters,
      properties:  ['openFile'],
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.on('setup:open-url', (_, url) => shell.openExternal(url));

  ipcMain.on('setup:copy-text', (_, text) => clipboard.writeText(String(text || '')));

  // Stream an Ollama model pull back to the wizard as progress events.
  ipcMain.on('setup:pull-model', (event, modelName) => {
    const req = http.request({
      hostname: 'localhost', port: 11434, path: '/api/pull', method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, res => {
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', chunk => {
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try { event.sender.send('setup:pull-progress', JSON.parse(line)); } catch (_) {}
        }
      });
      res.on('end', () => event.sender.send('setup:pull-progress', { status: 'success' }));
    });
    req.on('error', err =>
      event.sender.send('setup:pull-progress', { status: 'error', error: err.message })
    );
    req.write(JSON.stringify({ name: modelName }));
    req.end();
  });
}

// Swap the wizard window to a "Starting yuu-clip…" screen while the backend
// boots; app lifecycle closes it once the main window is ready.
function showWizardLoadingScreen(win) {
  const loadingHtml = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12121e;color:#d8d8e8;text-align:center"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><div><div style="width:32px;height:32px;border:3px solid #1e1e30;border-top-color:#5b8ef0;border-radius:50%;animation:spin 0.65s linear infinite;margin:0 auto 14px"></div><h3 style="margin:0 0 6px;font-size:14px;color:#e8e8f8">Starting yuu-clip…</h3><p style="margin:0;color:#666;font-size:12px">Waiting for backend</p></div></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml)}`);
  wizardWin = win;
}

// Opens the setup wizard.  In initial/update mode, returns a promise that
// resolves with the collected config when the user clicks Launch.  In rerun
// mode the caller doesn't await; the wizard saves config on Apply & Close, or
// discards on Close.
function showSetupWizard({ rerun = false, updated = false } = {}) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 620, height: 780,
      minWidth: 560, minHeight: 600,
      resizable: true,
      title: 'yuu-clip Setup',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'setup-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const mode = rerun ? 'rerun' : updated ? 'update' : 'initial';
    win.loadFile(path.join(__dirname, 'setup.html'),
      mode === 'initial' ? {} : { query: { mode } }
    );

    registerWizardIPC(win);

    ipcMain.removeAllListeners('setup:complete');
    ipcMain.removeAllListeners('setup:quit');
    ipcMain.removeAllListeners('setup:close');
    ipcMain.removeAllListeners('setup:skip');

    ipcMain.once('setup:complete', (_, cfg) => {
      saveElectronConfig({ projectDir: cfg.projectDir, setupSchemaVersion: SETUP_SCHEMA_VERSION });
      const pyCfg = {
        whisper_model:    cfg.whisperModel,
        whisper_language: cfg.whisperLanguage || '',
        llm_backend:      cfg.llmBackend,
        diarization_backend: cfg.diarizationEnabled ? 'pyannote' : 'null',
      };
      if (cfg.diarizationEnabled) pyCfg.huggingface_token = cfg.hfToken || '';
      if (cfg.llmBackend === 'llamacpp') {
        pyCfg.llm_model_path = cfg.llmModelPath || '';
      } else if (cfg.llmBackend === 'claude') {
        pyCfg.claude_api_key = cfg.claudeApiKey || '';
        pyCfg.claude_model   = cfg.claudeModel  || 'claude-haiku-4-5-20251001';
      } else {
        pyCfg.ollama_model = cfg.ollamaModel || 'llama3.2';
      }
      writeProjectConfig(cfg.projectDir, pyCfg);
      logSetup(`Setup complete — projectDir:${cfg.projectDir} whisperModel:${cfg.whisperModel} llmBackend:${cfg.llmBackend} diarization:${pyCfg.diarization_backend}`);
      fs.mkdirSync(path.dirname(SETUP_COMPLETE_MARKER), { recursive: true });
      fs.writeFileSync(SETUP_COMPLETE_MARKER, new Date().toISOString());
      if (!rerun) {
        showWizardLoadingScreen(win);
      } else {
        win.close();
      }
      resolve(cfg);
    });

    ipcMain.once('setup:quit', () => {
      app.quit();
      reject(new Error('User quit setup'));
    });

    // Rerun mode only: close the wizard without saving anything.
    ipcMain.once('setup:close', () => {
      win.close();
      reject(new Error('Setup window closed'));
    });

    // Update mode only: launch with existing config. The schema version is
    // still stored — the user saw the new options once and chose to move on;
    // re-showing every launch would be nagging. Re-run remains in the menu.
    const skipUpdateWizard = () => {
      saveElectronConfig({ setupSchemaVersion: SETUP_SCHEMA_VERSION });
      logSetup('Update-mode setup skipped — launching with existing config');
      resolve({ projectDir: loadElectronConfig().projectDir || DEFAULT_PROJECT_DIR });
      showWizardLoadingScreen(win);
    };
    ipcMain.once('setup:skip', skipUpdateWizard);

    win.on('closed', () => {
      // Closed by the OS (Alt+F4) without completing: in update mode that
      // means "skip", otherwise treat as quit. resolve/reject are no-ops if
      // already called.
      if (mode === 'update') {
        saveElectronConfig({ setupSchemaVersion: SETUP_SCHEMA_VERSION });
        resolve({ projectDir: loadElectronConfig().projectDir || DEFAULT_PROJECT_DIR });
      }
      reject(new Error('Setup window closed'));
    });
  });
}

// ---------------------------------------------------------------------------
// First-run venv setup
// ---------------------------------------------------------------------------

function showVenvSetupWindow() {
  const win = new BrowserWindow({
    width: 440, height: 240,
    resizable: false, frame: false, alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'venv-preload.js'),
    },
  });
  const html = `<!DOCTYPE html><html><head><style>
    @keyframes spin{to{transform:rotate(360deg)}}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12121e;color:#d8d8e8;text-align:center}
    h3{margin:0 0 12px;font-size:14px;color:#e8e8f8}
    .spin{display:inline-block;width:28px;height:28px;border:3px solid #1e1e30;border-top-color:#5b8ef0;border-radius:50%;animation:spin 0.65s linear infinite;margin:0 auto 14px}
    .steps{list-style:none;margin:0;padding:0;text-align:left;display:inline-block}
    .steps li{font-size:12px;color:#555;padding:2px 0;padding-left:18px;position:relative}
    .steps li.done{color:#4caf7d}
    .steps li.active{color:#d0d0e0}
    .steps li::before{content:'·';position:absolute;left:4px}
    .steps li.done::before{content:'✓';color:#4caf7d}
    .steps li.active::before{content:'›';color:#5b8ef0}
    .status{font-size:11px;color:#5b8ef0;margin-top:14px;min-height:14px;padding:0 16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .note{font-size:11px;color:#555;margin-top:4px}
  </style></head><body><div>
    <div class="spin"></div>
    <h3>Setting up yuu-clip</h3>
    <ul class="steps" id="steps">
      <li id="s0">Create virtual environment</li>
      <li id="s1">Upgrade pip</li>
      <li id="s2">Install yuu-clip</li>
    </ul>
    <div class="status" id="status"></div>
    <div class="note">This can take a few minutes — please don't close this window.</div>
  </div><script>
    if(window.venvAPI) window.venvAPI.onProgress(function(msg){
      var steps=['s0','s1','s2'];
      var idx=steps.indexOf(msg.id);
      if(idx<0)return;
      if(msg.state==='active'){document.getElementById(msg.id).className='active';}
      else if(msg.state==='done'){document.getElementById(msg.id).className='done';}
    });
    if(window.venvAPI&&window.venvAPI.onStatus) window.venvAPI.onStatus(function(text){
      document.getElementById('status').textContent=text;
    });
  </script></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

async function ensureVenv() {
  const resourcesDir = process.resourcesPath || path.join(__dirname, '..', 'dist');
  const wheels = fs.readdirSync(resourcesDir).filter(f => f.endsWith('.whl'));
  if (wheels.length === 0) throw new Error(`No .whl found in ${resourcesDir}`);
  const wheelFile = wheels[0];
  const wheelPath = path.join(resourcesDir, wheelFile);

  const vm = wheelFile.match(/yuu_clip-([^-]+)-/);
  const bundledVersion = vm ? vm[1] : null;

  let installedVersion = null;
  try { installedVersion = fs.readFileSync(WHEEL_MARKER, 'utf8').trim(); } catch (_) {}

  logSetup(`Bundled wheel: ${wheelFile}`);

  const venvExists = fs.existsSync(VENV_PYTHON);
  const versionOk  = !bundledVersion || installedVersion === bundledVersion;
  if (venvExists && versionOk) {
    logSetup(`Venv OK — wheel ${bundledVersion || 'unknown'} already installed`);
    return;
  }

  if (!venvExists) {
    logSetup('Venv not found — running first-run setup');
  } else {
    logSetup(`Wheel update needed (installed: ${installedVersion || 'none'}, bundled: ${bundledVersion}) — reinstalling`);
  }

  const pythonBin = findPython();
  if (!pythonBin) {
    logSetup('No Python 3.11+ found on PATH — aborting setup');
    await dialog.showMessageBox({
      type: 'error', title: 'Python 3.11+ required',
      message:
        'yuu-clip needs Python 3.11 or later, which was not found on PATH.\n\n' +
        'Download and install it from python.org, then restart yuu-clip.\n\n' +
        '(Make sure to check "Add Python to PATH" during installation.)',
      buttons: ['Open python.org', 'Quit'], defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) shell.openExternal('https://www.python.org/downloads/');
    });
    app.quit();
    throw new Error('Python not found');
  }

  logSetup(`Using python: ${pythonBin}`);
  logSetup(`Installing wheel: ${wheelPath}`);

  fs.mkdirSync(path.dirname(VENV_DIR), { recursive: true });

  const setupWin = showVenvSetupWindow();
  const progress = (id, state) => {
    try { setupWin.webContents.send('venv:progress', { id, state }); } catch (_) {}
  };
  try {
    if (!venvExists) {
      progress('s0', 'active');
      await runCmd(pythonBin, ['-m', 'venv', VENV_DIR]);
      logSetup('Venv created');
      progress('s0', 'done');
      progress('s1', 'active');
      logSetup('Upgrading pip…');
      await runCmd(VENV_PIP, ['install', '--upgrade', 'pip']);
      progress('s1', 'done');
    }
    progress('s2', 'active');
    logSetup('Installing wheel…');
    let lastStatus = '';
    await runCmd(
      VENV_PIP,
      ['install', '--force-reinstall', '--progress-bar', 'raw', wheelPath],
      line => {
        const statusText = formatPipLine(line);
        if (statusText && statusText !== lastStatus) {
          lastStatus = statusText;
          try { setupWin.webContents.send('venv:status', statusText); } catch (_) {}
        }
      }
    );
    progress('s2', 'done');
    logSetup('Wheel installed');
    if (bundledVersion) fs.writeFileSync(WHEEL_MARKER, bundledVersion);
  } catch (err) {
    const detail = [err.stderr, err.stdout].filter(Boolean).join('\n');
    logSetup(`Venv setup failed: ${err.message}${detail ? '\n' + detail : ''}`);
    throw err;
  } finally {
    setupWin.close();
  }
}

// ---------------------------------------------------------------------------
// Port handling
// ---------------------------------------------------------------------------

async function resolvePort() {
  if (!await isPortInUse(BASE_PORT)) {
    logSetup(`Using port ${BASE_PORT}`);
    return BASE_PORT;
  }

  if (await isYuuClipOnPort(BASE_PORT)) {
    await dialog.showMessageBox({
      type: 'warning', title: 'yuu-clip is already running',
      message: 'Another yuu-clip instance is already using port 8080.\n\nClose it first, then relaunch.',
      buttons: ['OK'],
    });
    app.quit();
    throw new Error('Duplicate yuu-clip instance');
  }

  const free = await findFreePort(BASE_PORT + 1);
  logSetup(`Port ${BASE_PORT} in use by unrelated process; using ${free}`);
  return free;
}

// ---------------------------------------------------------------------------
// Spawn Python backend
// ---------------------------------------------------------------------------

function spawnBackend(port) {
  const args = ['-m', 'yuu_clip.cli', 'serve', '--project', projectDir, '--no-open'];
  if (port !== BASE_PORT) args.push('--port', String(port));

  logSetup(`Spawning backend: ${VENV_PYTHON} ${args.join(' ')}`);
  pyProc = spawn(VENV_PYTHON, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  pyProc.stdout.on('data', d => process.stdout.write(d));
  pyProc.stderr.on('data', d => {
    process.stderr.write(d);
    logSetup(`[backend] ${d.toString().trimEnd()}`);
  });
  pyProc.on('exit', code => {
    if (isQuitting) return;
    const msg = code !== null && code !== 0
      ? `The Python backend exited with code ${code}.`
      : 'The Python backend stopped unexpectedly.';
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'error', title: 'Backend stopped',
        message: `${msg}\n\nCheck the log at:\n${projectDir}\\.yuu-clip\\yuu-clip.log`,
        buttons: ['Quit'],
      }).then(() => { isQuitting = true; app.quit(); });
    } else {
      isQuitting = true;
      app.quit();
    }
  });
}

// ---------------------------------------------------------------------------
// Window + menu
// ---------------------------------------------------------------------------

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280, height: 900,
    title: 'yuu-clip',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('close', async e => {
    if (isQuitting) return;
    e.preventDefault();
    await handleClose();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  buildMenu();
}

function buildMenu() {
  ipcMain.on('app:run-setup-wizard', () => {
    showSetupWizard({ rerun: true }).catch(() => {});
  });

  const template = [
    {
      label: 'yuu-clip',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Re-run Setup Wizard…',
          click: () => {
            // Non-blocking — backend keeps running while wizard is open.
            showSetupWizard({ rerun: true }).catch(() => {});
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function handleClose() {
  let anyRunning = false;
  try {
    const body = await httpGet(`http://127.0.0.1:${appPort}/api/status`, 2000);
    anyRunning  = JSON.parse(body).any_running === true;
  } catch (_) { /* backend already dead */ }

  if (anyRunning) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question', title: 'Analysis in progress',
      message: 'Analysis is in progress. Close and cancel it?',
      buttons: ['Cancel', 'Close anyway'],
      defaultId: 0, cancelId: 0,
    });
    if (response !== 1) return;
  }

  isQuitting = true;
  if (pyProc) { pyProc.kill(); pyProc = null; }
  mainWindow = null;
  app.quit();
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  rotateLogs();
  logSetup(`yuu-clip ${app.getVersion()} starting — ${process.platform} ${process.arch} node/${process.versions.node}`);

  const knownQuits = [
    'Python not found',
    'Setup window closed',
    'User quit setup',
    'Duplicate yuu-clip instance',
  ];

  try {
    await ensureVenv();

    const firstRun = !fs.existsSync(SETUP_COMPLETE_MARKER);
    refreshPathFromRegistry();
    const ffmpegOk = checkFFmpeg();
    // Setups completed before schema versioning existed count as version 1.
    const storedSchema  = loadElectronConfig().setupSchemaVersion || 1;
    const setupOutdated = !firstRun && storedSchema < SETUP_SCHEMA_VERSION;

    if (firstRun || !ffmpegOk || setupOutdated) {
      if (setupOutdated) logSetup(`Setup schema ${storedSchema} < ${SETUP_SCHEMA_VERSION} — showing wizard with new options`);
      const cfg = await showSetupWizard({ rerun: false, updated: setupOutdated && ffmpegOk && !firstRun });
      projectDir = cfg.projectDir;
    } else {
      projectDir = loadElectronConfig().projectDir || DEFAULT_PROJECT_DIR;
      logSetup(`Project dir: ${projectDir}`);
    }

    appPort = await resolvePort();
    spawnBackend(appPort);
    await pollReady(appPort);
    logSetup('Creating main window');
    createWindow(appPort);
    startupComplete = true;
    if (wizardWin && !wizardWin.isDestroyed()) { wizardWin.close(); wizardWin = null; }
  } catch (err) {
    if (!knownQuits.includes(err.message)) {
      dialog.showErrorBox('Startup error', String(err));
    }
    if (!app.isQuitting()) app.quit();
  }
});

app.on('window-all-closed', () => {
  if (!startupComplete) return;
  if (pyProc) { pyProc.kill(); pyProc = null; }
  app.quit();
});

// Kill the backend on any process exit — covers crashes, SIGTERM, and
// Task Manager kills that bypass the normal close flow.
process.on('exit', () => {
  if (pyProc) try { pyProc.kill(); } catch (_) {}
});

// Log uncaught main-process exceptions and shut down cleanly instead of
// leaving the Python backend orphaned.
process.on('uncaughtException', err => {
  logSetup(`Uncaught exception: ${err.stack || err.message}`);
  if (pyProc) try { pyProc.kill(); } catch (_) {}
  app.quit();
});
