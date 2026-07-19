'use strict';

// Packaged-app boot smoke test (e2e-use-cases Stage 5 / UC-G03).
//
// Boots the REAL desktop shell (`electron main.js`) against a throwaway userData,
// waits for the embedded FastAPI server, confirms the UI document loads with a
// known root element, then asks the app to quit and asserts it leaves NO orphan
// python.exe. Orphaned backend processes on quit are the packaging failure mode
// the pytest suites can't see - this is the one automated backstop for it.
//
// It is heavy (a real Electron + Python boot) and opt-in: set YUU_SMOKE=1 to run
// it. It otherwise skips - with a clear reason - so the fast `npm test` inner loop
// (~0.2s of pure unit tests) is unaffected, and so it never fails on a machine
// without the Electron/Python runtime. Boot only; no analyze runs.
//
// It relies on main.js's YUU_SMOKE_BACKEND_PYTHON seam: with that env var set,
// ensureVenv() is skipped and the backend spawns with the supplied interpreter,
// which is the only way to boot the shell from an unpackaged dev checkout.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const MAIN_JS = path.join(__dirname, '..', 'main.js');
const PORT = 8080;
const BOOT_TIMEOUT_MS = 90000;
const QUIT_TIMEOUT_MS = 20000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(predicate, deadline) {
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(250);
  }
  return predicate();
}

function electronBinary() {
  try {
    const resolved = require('electron');
    return typeof resolved === 'string' ? resolved : null;
  } catch (_) {
    return null;
  }
}

// First interpreter that can import yuu_clip: an explicit override, the repo's
// dev venv, or a PATH python. Null when none works (-> skip).
function discoverBackendPython() {
  const candidates = [
    process.env.YUU_SMOKE_BACKEND_PYTHON,
    path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(REPO_ROOT, 'venv', 'Scripts', 'python.exe'),
    'python',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-c', 'import yuu_clip'], { stdio: 'ignore' });
      return candidate;
    } catch (_) { /* try the next */ }
  }
  return null;
}

function portFree(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

function httpGet(pathname, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: pathname, timeout: timeoutMs }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function pollStatus(deadline) {
  while (Date.now() < deadline) {
    try {
      const { status, body } = await httpGet('/api/status', 1500);
      if (status === 200 && typeof JSON.parse(body).version === 'string') return true;
    } catch (_) { /* server not up yet */ }
    await sleep(500);
  }
  return false;
}

// PIDs of python.exe whose command line references our throwaway project dir -
// i.e. THIS test's backend, never a concurrent dev server on another project.
function backendPythonPids(projectDir) {
  if (process.platform !== 'win32') return [];
  const pattern = `*${projectDir.replace(/'/g, "''")}*`;
  const script =
    "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | " +
    `Where-Object { $_.CommandLine -like '${pattern}' } | ` +
    'Select-Object -ExpandProperty ProcessId';
  try {
    const out = execFileSync('powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
    return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(Number);
  } catch (_) {
    return [];
  }
}

function taskkill(pid, force) {
  if (!pid) return;
  const args = force ? ['/F', '/T', '/PID', String(pid)] : ['/PID', String(pid)];
  try { execFileSync('taskkill', args, { stdio: 'ignore' }); } catch (_) { /* already gone */ }
}

function seedUserData() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yuu-smoke-'));
  const appData = path.join(root, 'AppData', 'Roaming');
  const localAppData = path.join(root, 'AppData', 'Local');
  const projectDir = path.join(root, 'project');
  fs.mkdirSync(path.join(appData, 'yuu-clip'), { recursive: true });
  fs.mkdirSync(localAppData, { recursive: true });
  fs.mkdirSync(path.join(projectDir, '.yuu-clip'), { recursive: true });

  // Pre-seed a completed, current-schema setup so decideSetupMode returns
  // { show: false } and the app boots straight to the backend (no wizard).
  const { SETUP_SCHEMA_VERSION } = require('../constants');
  fs.writeFileSync(path.join(appData, 'yuu-clip', 'setup-complete'), new Date().toISOString());
  fs.writeFileSync(
    path.join(appData, 'yuu-clip', 'electron-config.json'),
    JSON.stringify({ projectDir, setupSchemaVersion: SETUP_SCHEMA_VERSION }, null, 2),
  );
  return { root, appData, localAppData, projectDir };
}

test('desktop shell boots the embedded server, serves the UI, and quits with no orphan python',
  { timeout: 180000 }, async (t) => {
    if (process.platform !== 'win32') { t.skip('Windows-only desktop shell'); return; }
    if (process.env.YUU_SMOKE !== '1') {
      t.skip('opt-in heavy boot test - set YUU_SMOKE=1 to run it'); return;
    }
    const electronExe = electronBinary();
    if (!electronExe) { t.skip('Electron runtime not installed (run npm install in electron/)'); return; }
    const backendPython = discoverBackendPython();
    if (!backendPython) { t.skip('no python with yuu_clip importable (.venv or PATH)'); return; }
    if (!(await portFree(PORT))) {
      t.skip(`port ${PORT} is busy - stop any running YuuClip / dev server and retry`); return;
    }

    const { root, appData, localAppData, projectDir } = seedUserData();
    const env = {
      ...process.env,
      APPDATA: appData,
      LOCALAPPDATA: localAppData,
      YUU_SMOKE_BACKEND_PYTHON: backendPython,
    };
    // When the test host is itself Electron-run-as-node (or the shell inherited the
    // flag), spawning the electron binary would launch it in Node mode - require
    // ('electron') then returns undefined and main.js crashes at load. Clear it so
    // the child runs as a real Electron app.
    delete env.ELECTRON_RUN_AS_NODE;

    const child = spawn(electronExe, [MAIN_JS], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let childExited = false;
    child.on('exit', () => { childExited = true; });
    let logTail = '';
    const capture = d => { logTail = (logTail + d).slice(-4000); };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    try {
      const booted = await pollStatus(Date.now() + BOOT_TIMEOUT_MS);
      assert.ok(booted, `embedded server never answered /api/status on :${PORT}\n---\n${logTail}`);

      const { status, body } = await httpGet('/', 3000);
      assert.equal(status, 200, 'UI document did not return 200');
      assert.match(body, /id="btn-analyze"/, 'served UI is missing its known root control');

      const before = backendPythonPids(projectDir);
      assert.ok(before.length >= 1, 'expected a backend python.exe serving the temp project');

      // Graceful quit: a plain taskkill (no /F) posts WM_CLOSE to the Electron
      // window, which runs main.js's close handler (handleClose -> pyProc.kill()
      // + app.quit()) - the exact path a user closing the window takes.
      taskkill(child.pid, false);
      const exited = await waitFor(() => childExited, Date.now() + QUIT_TIMEOUT_MS);
      assert.ok(exited, 'Electron did not exit after a graceful close request');

      const survivors = await waitFor(
        () => backendPythonPids(projectDir).length === 0, Date.now() + 8000);
      assert.ok(survivors,
        `orphan backend python.exe survived shutdown: ${backendPythonPids(projectDir).join(', ')}`);
    } finally {
      if (!childExited) taskkill(child.pid, true);
      for (const pid of backendPythonPids(projectDir)) taskkill(pid, true);
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) { /* best effort */ }
    }
  });
