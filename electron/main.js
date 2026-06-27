'use strict';

const { app, BrowserWindow, Menu, MenuItem, dialog, ipcMain, shell } = require('electron');
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
const SETUP_LOG   = path.join(process.env.APPDATA, 'yuu-clip', 'venv-setup.log');
const SETUP_COMPLETE_MARKER = path.join(process.env.APPDATA, 'yuu-clip', 'setup-complete');
const ELECTRON_CONFIG_PATH  = path.join(process.env.APPDATA, 'yuu-clip', 'electron-config.json');

const DEFAULT_PROJECT_DIR = path.join(process.env.USERPROFILE, 'Videos', 'yuu-clip');
const BASE_PORT = 8080;

let projectDir  = DEFAULT_PROJECT_DIR;
let pyProc      = null;
let mainWindow  = null;
let appPort     = BASE_PORT;
let wizardWin   = null;

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

function logSetup(msg) {
  fs.mkdirSync(path.dirname(SETUP_LOG), { recursive: true });
  fs.appendFileSync(SETUP_LOG, `[${new Date().toISOString()}] ${msg}\n`);
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
        return reject(new Error(`Python backend exited unexpectedly (exit code ${pyProc.exitCode}). Check the log at:\n${projectDir}\\.yuu-clip\\yuu-clip.log`));
      }
      try {
        await httpGet(`http://127.0.0.1:${port}/api/videos`, 1000);
        logSetup(`Backend ready after ${i + 1} attempts (${Date.now() - t0} ms)`);
        return resolve();
      } catch (_) { /* not ready yet */ }
      await new Promise(r => setTimeout(r, delayMs));
    }
    logSetup(`Backend did not respond after ${attempts} attempts (${Date.now() - t0} ms)`);
    reject(new Error(`Python backend did not start within 60 seconds. Check the log at:\n${projectDir}\\.yuu-clip\\yuu-clip.log`));
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
  for (const ch of ['setup:get-status', 'setup:pick-folder']) {
    try { ipcMain.removeHandler(ch); } catch (_) {}
  }
  ipcMain.removeAllListeners('setup:pull-model');
  ipcMain.removeAllListeners('setup:open-url');

  ipcMain.handle('setup:get-status', async () => {
    const eCfg          = loadElectronConfig();
    const ollamaModel   = 'llama3.2';
    const gpu           = detectGPU();
    const cuda          = detectCUDA();
    const ollamaRunning = await checkOllama();
    const ollamaModelPulled = ollamaRunning ? await checkOllamaModel(ollamaModel) : false;
    logSetup(`Status check — FFmpeg:${checkFFmpeg()} GPU:${gpu.name} CUDA:${cuda.available} Ollama:${ollamaRunning} Model:${ollamaModelPulled}`);
    return {
      ffmpegOk: checkFFmpeg(),
      gpu, cuda,
      ollamaRunning, ollamaModel, ollamaModelPulled,
      recommendedWhisper: recommendWhisperModel(gpu.vramMB),
      projectDir: eCfg.projectDir || DEFAULT_PROJECT_DIR,
    };
  });

  ipcMain.handle('setup:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(wizardWin, {
      title: 'Choose project folder',
      defaultPath: projectDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.on('setup:open-url', (_, url) => shell.openExternal(url));

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

// Opens the setup wizard.  In initial mode, returns a promise that resolves
// with { projectDir, whisperModel } when the user clicks Launch.  In rerun
// mode the caller doesn't await; the wizard just saves config and closes.
function showSetupWizard({ rerun = false } = {}) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 580, height: 680,
      resizable: false,
      title: 'yuu-clip Setup',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'setup-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.loadFile(path.join(__dirname, 'setup.html'),
      rerun ? { query: { mode: 'rerun' } } : {}
    );

    registerWizardIPC(win);

    ipcMain.removeAllListeners('setup:complete');
    ipcMain.removeAllListeners('setup:quit');

    ipcMain.once('setup:complete', (_, cfg) => {
      saveElectronConfig({ projectDir: cfg.projectDir });
      writeProjectConfig(cfg.projectDir, { whisper_model: cfg.whisperModel });
      logSetup(`Setup complete — projectDir:${cfg.projectDir} whisperModel:${cfg.whisperModel}`);
      fs.mkdirSync(path.dirname(SETUP_COMPLETE_MARKER), { recursive: true });
      fs.writeFileSync(SETUP_COMPLETE_MARKER, new Date().toISOString());
      if (!rerun) {
        const loadingHtml = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12121e;color:#d8d8e8;text-align:center"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><div><div style="width:32px;height:32px;border:3px solid #1e1e30;border-top-color:#5b8ef0;border-radius:50%;animation:spin 0.65s linear infinite;margin:0 auto 14px"></div><h3 style="margin:0 0 6px;font-size:14px;color:#e8e8f8">Starting yuu-clip…</h3><p style="margin:0;color:#666;font-size:12px">Waiting for backend</p></div></body></html>`;
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml)}`);
        wizardWin = win;
      } else {
        win.close();
      }
      resolve(cfg);
    });

    ipcMain.once('setup:quit', () => {
      app.quit();
      reject(new Error('User quit setup'));
    });

    win.on('closed', () => {
      // If closed by the OS (Alt+F4) without completing, treat as quit.
      // resolve/reject are no-ops if already called.
      reject(new Error('Setup window closed'));
    });
  });
}

// ---------------------------------------------------------------------------
// First-run venv setup
// ---------------------------------------------------------------------------

function showVenvSetupWindow() {
  const win = new BrowserWindow({
    width: 440, height: 160,
    resizable: false, frame: false, alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12121e;color:#d8d8e8;text-align:center"><div><h3 style="margin:0 0 8px">Setting up yuu-clip</h3><p style="margin:0;color:#888">Installing Python dependencies — this may take a few minutes…</p></div></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

async function ensureVenv() {
  if (fs.existsSync(VENV_PYTHON)) return;

  logSetup('Venv not found — running first-run setup');

  const pythonBin = findPython();
  if (!pythonBin) {
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

  const resourcesDir = process.resourcesPath || path.join(__dirname, '..', 'dist');
  const wheels = fs.readdirSync(resourcesDir).filter(f => f.endsWith('.whl'));
  if (wheels.length === 0) throw new Error(`No .whl found in ${resourcesDir}`);
  const wheelPath = path.join(resourcesDir, wheels[0]);
  logSetup(`Installing wheel: ${wheelPath}`);

  fs.mkdirSync(path.dirname(VENV_DIR), { recursive: true });

  const setupWin = showVenvSetupWindow();
  try {
    execFileSync(pythonBin, ['-m', 'venv', VENV_DIR]);
    logSetup('Venv created');
    logSetup('Upgrading pip…');
    execFileSync(VENV_PIP, ['install', '--upgrade', 'pip'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    logSetup('Installing wheel…');
    execFileSync(VENV_PIP, ['install', wheelPath],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    logSetup('Wheel installed');
  } catch (err) {
    logSetup(`Venv setup failed: ${err.message}${err.stderr ? '\n' + err.stderr : ''}`);
    throw err;
  } finally {
    setupWin.close();
  }
}

// ---------------------------------------------------------------------------
// Port handling
// ---------------------------------------------------------------------------

async function resolvePort() {
  if (!await isPortInUse(BASE_PORT)) return BASE_PORT;

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
  const args = ['-m', 'yuu_clip.cli', 'serve', '--project', projectDir, '--no-interact'];
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
    if (code !== 0 && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error', title: 'Backend exited unexpectedly',
        message: `The Python backend exited with code ${code}.\n\nCheck the log at:\n${projectDir}\\.yuu-clip\\yuu-clip.log`,
        buttons: ['OK'],
      });
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

  if (pyProc) { pyProc.kill(); pyProc = null; }
  mainWindow = null;
  app.quit();
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
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
    const ffmpegOk = checkFFmpeg();

    if (firstRun || !ffmpegOk) {
      const cfg = await showSetupWizard({ rerun: false });
      projectDir = cfg.projectDir;
    } else {
      projectDir = loadElectronConfig().projectDir || DEFAULT_PROJECT_DIR;
    }

    appPort = await resolvePort();
    spawnBackend(appPort);
    await pollReady(appPort);
    logSetup('Creating main window');
    createWindow(appPort);
    if (wizardWin && !wizardWin.isDestroyed()) { wizardWin.close(); wizardWin = null; }
  } catch (err) {
    if (!knownQuits.includes(err.message)) {
      dialog.showErrorBox('Startup error', String(err));
    }
    if (!app.isQuitting()) app.quit();
  }
});

app.on('window-all-closed', () => {
  if (pyProc) { pyProc.kill(); pyProc = null; }
  app.quit();
});
