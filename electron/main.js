'use strict';

const { app, BrowserWindow, dialog, shell } = require('electron');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const VENV_DIR = path.join(process.env.LOCALAPPDATA, 'yuu-clip', 'venv');
const VENV_PYTHON = path.join(VENV_DIR, 'Scripts', 'python.exe');
const VENV_PIP = path.join(VENV_DIR, 'Scripts', 'pip.exe');
const SETUP_LOG = path.join(process.env.APPDATA, 'yuu-clip', 'venv-setup.log');
const PROJECT_DIR = path.join(process.env.USERPROFILE, 'Videos', 'yuu-clip');
const BASE_PORT = 8080;

let pyProc = null;
let mainWindow = null;
let appPort = BASE_PORT;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logSetup(msg) {
  const dir = path.dirname(SETUP_LOG);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(SETUP_LOG, `[${new Date().toISOString()}] ${msg}\n`);
}

function findPython() {
  for (const candidate of ['python3.11', 'python3', 'python']) {
    try {
      const out = execFileSync(candidate, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const m = out.match(/Python (\d+)\.(\d+)/);
      if (m && (parseInt(m[1]) > 3 || (parseInt(m[1]) === 3 && parseInt(m[2]) >= 11))) {
        return candidate;
      }
    } catch (_) { /* not on PATH */ }
  }
  return null;
}

function isPortInUse(port) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => { s.close(); resolve(false); });
    s.listen(port, '127.0.0.1');
  });
}

function findFreePort(start) {
  return new Promise(async (resolve) => {
    let p = start;
    while (await isPortInUse(p)) p++;
    resolve(p);
  });
}

// Returns true if something is already listening on the port AND it looks like
// a yuu-clip process (heuristic: process name contains python and cmdline
// contains yuu_clip). Falls back to false (assume unrelated) if detection fails.
async function isYuuClipOnPort(port) {
  try {
    // netstat isn't always reliable for PID; just check if /api/status responds
    const status = await httpGet(`http://127.0.0.1:${port}/api/status`, 1500);
    const parsed = JSON.parse(status);
    return typeof parsed.version === 'string'; // a yuu-clip response
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

function pollReady(port, attempts = 40, delayMs = 500) {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < attempts; i++) {
      try {
        await httpGet(`http://127.0.0.1:${port}/api/videos`, 1000);
        return resolve();
      } catch (_) { /* not ready yet */ }
      await new Promise(r => setTimeout(r, delayMs));
    }
    reject(new Error('Python backend did not start in time'));
  });
}

// ---------------------------------------------------------------------------
// First-run venv setup
// ---------------------------------------------------------------------------

async function ensureVenv() {
  if (fs.existsSync(VENV_PYTHON)) return; // already set up

  logSetup('Venv not found — running first-run setup');

  const pythonBin = findPython();
  if (!pythonBin) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Python 3.11+ required',
      message:
        'yuu-clip needs Python 3.11 or later, which was not found on PATH.\n\n' +
        'Install it with:\n\n    winget install Python.Python.3.11\n\n' +
        'Then restart yuu-clip.',
      buttons: ['Open python.org', 'Quit'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) shell.openExternal('https://www.python.org/downloads/');
    });
    app.quit();
    throw new Error('Python not found');
  }

  logSetup(`Using python: ${pythonBin}`);

  // Find bundled wheel
  const resourcesDir = process.resourcesPath || path.join(__dirname, '..', 'dist');
  const wheels = fs.readdirSync(resourcesDir).filter(f => f.endsWith('.whl'));
  if (wheels.length === 0) {
    throw new Error(`No .whl found in ${resourcesDir}`);
  }
  const wheelPath = path.join(resourcesDir, wheels[0]);
  logSetup(`Installing wheel: ${wheelPath}`);

  fs.mkdirSync(path.dirname(VENV_DIR), { recursive: true });

  execFileSync(pythonBin, ['-m', 'venv', VENV_DIR], { stdio: 'inherit' });
  logSetup('Venv created');

  execFileSync(VENV_PIP, ['install', '--upgrade', 'pip'], { stdio: 'inherit' });
  execFileSync(VENV_PIP, ['install', wheelPath], { stdio: 'inherit' });
  logSetup('Wheel installed');
}

// ---------------------------------------------------------------------------
// Port handling
// ---------------------------------------------------------------------------

async function resolvePort() {
  const inUse = await isPortInUse(BASE_PORT);
  if (!inUse) return BASE_PORT;

  const looksLikeUs = await isYuuClipOnPort(BASE_PORT);
  if (looksLikeUs) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'yuu-clip is already running',
      message:
        'Another yuu-clip instance is already using port 8080.\n\n' +
        'Close it first, then relaunch.',
      buttons: ['OK'],
    });
    app.quit();
    throw new Error('Duplicate yuu-clip instance');
  }

  // Unrelated process on 8080 — find the next free port
  const free = await findFreePort(BASE_PORT + 1);
  logSetup(`Port ${BASE_PORT} in use by unrelated process; using ${free}`);
  return free;
}

// ---------------------------------------------------------------------------
// Spawn Python backend
// ---------------------------------------------------------------------------

function spawnBackend(port) {
  const args = [
    '-m', 'yuu_clip.cli', 'serve',
    '--project', PROJECT_DIR,
    '--no-interact',
  ];
  if (port !== BASE_PORT) args.push('--port', String(port));

  pyProc = spawn(VENV_PYTHON, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  pyProc.stdout.on('data', d => process.stdout.write(d));
  pyProc.stderr.on('data', d => process.stderr.write(d));
  pyProc.on('exit', code => {
    if (code !== 0 && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Backend exited unexpectedly',
        message: `The Python backend exited with code ${code}.\n\nCheck the log at:\n${PROJECT_DIR}\\.yuu-clip\\yuu-clip.log`,
        buttons: ['OK'],
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
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
    e.preventDefault(); // handle asynchronously
    await handleClose();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function handleClose() {
  let anyRunning = false;
  try {
    const body = await httpGet(`http://127.0.0.1:${appPort}/api/status`, 2000);
    anyRunning = JSON.parse(body).any_running === true;
  } catch (_) { /* backend already dead — just quit */ }

  if (anyRunning) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Analysis in progress',
      message: 'Analysis is in progress. Close and cancel it?',
      buttons: ['Cancel', 'Close anyway'],
      defaultId: 0,
      cancelId: 0,
    });
    if (response !== 1) return; // user chose Cancel
  }

  if (pyProc) {
    pyProc.kill();
    pyProc = null;
  }
  mainWindow = null;
  app.quit();
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  try {
    await ensureVenv();
    appPort = await resolvePort();
    spawnBackend(appPort);
    await pollReady(appPort);
    createWindow(appPort);
  } catch (err) {
    if (err.message !== 'Python not found' && err.message !== 'Duplicate yuu-clip instance') {
      dialog.showErrorBox('Startup error', String(err));
    }
    if (!app.isQuitting()) app.quit();
  }
});

app.on('window-all-closed', () => {
  if (pyProc) { pyProc.kill(); pyProc = null; }
  app.quit();
});
