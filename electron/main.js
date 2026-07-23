'use strict';

const { app, BrowserWindow, Menu, MenuItem, clipboard, dialog, ipcMain, protocol, shell } = require('electron');
const { execFileSync, spawn } = require('child_process');
const fs     = require('fs');
const http   = require('http');
const net    = require('net');
const path   = require('path');
const { Readable } = require('stream');
const { parseNvidiaVramMB, selectGPU } = require('./gpu-detect');
const { resolveBundledFfmpegDir } = require('./ffmpeg-detect');
const { buildWheelInstallArgs, buildOpencvDedupeArgs } = require('./venv-setup');
const { rewritePyvenvCfg, decidePrebuiltEnvAction } = require('./prebuilt-env');
const { parsePipRawProgress } = require('./pip-progress');
const { describeInstallFailure, describeDownloadFailure } = require('./install-error');
const diskSpace = require('./disk-space');
const { recommendWhisperModel } = require('./whisper-select');
const { modelFileDialogOptions } = require('./model-file-dialog');
const { recommendLocalModel } = require('./recommend-model');
const { mimeTypeFor, isPathInside, rangeResponseInit } = require('./media-serve');
const { buildProjectConfigFromWizard } = require('./wizard-config');
const { decideSetupMode } = require('./startup-mode');
const { buildRestoreArgs, parseRestoreExit } = require('./restore-backup');
const {
  VENV_DIR, VENV_PYTHON, VENV_PIP, BUNDLED_PYTHON, BUNDLED_FFMPEG_DIR,
  BUNDLED_LLAMA_SERVER_DIR,
  SETUP_LOG, SETUP_COMPLETE_MARKER, WHEEL_MARKER,
  DEFAULT_PROJECT_DIR, BASE_PORT,
  DEFAULT_LLAMACPP_MODEL, MODELS_DIR, SETUP_SCHEMA_VERSION,
} = require('./constants');
const { rotateLogs, logSetup } = require('./logging');
const { loadElectronConfig, saveElectronConfig, writeProjectConfig } = require('./electron-config');
const { runCmd, downloadFileWithProgress, pipStatusReporter, WIZARD_INSTALLABLE, checkVenvModule } = require('./install');

// Roadmap plan 10 - the "yuu-media" scheme must be registered as privileged
// before app.ready fires (Electron requirement); the actual request handler
// is wired up in registerMediaProtocol(), called from app.whenReady().
protocol.registerSchemesAsPrivileged([
  { scheme: 'yuu-media', privileges: { stream: true, supportFetchAPI: true, corsEnabled: true } },
]);

// ---------------------------------------------------------------------------
// Mutable runtime state
// ---------------------------------------------------------------------------

let projectDir      = DEFAULT_PROJECT_DIR;
let pyProc          = null;
let pySpawnError    = null;  // spawn 'error' (e.g. ENOENT) - pollReady turns it into the fatal dialog
let mainWindow      = null;
let appPort         = BASE_PORT;
let wizardWin       = null;
let setupWizardWin  = null;  // the live setup-wizard window, if one is open
let startupComplete = false;
let isQuitting      = false;

// In-flight model-download state, for the wizard's Cancel buttons.
let activeGgufController = null;  // AbortController for the .gguf download

// ---------------------------------------------------------------------------
// Python discovery
// ---------------------------------------------------------------------------

// The interpreter that runs the backend. Normally the provisioned venv python;
// YUU_SMOKE_BACKEND_PYTHON overrides it so a dev/CI smoke test (or a developer)
// can boot the real desktop shell against an already-set-up interpreter without
// building an installer - the only way to exercise this startup path unpackaged,
// where ensureVenv's pip-from-wheelhouse fallback can't provision a venv. Paired
// with the ensureVenv short-circuit below.
function backendPython() {
  return process.env.YUU_SMOKE_BACKEND_PYTHON || VENV_PYTHON;
}

function findPython() {
  if (app.isPackaged) {
    if (fs.existsSync(BUNDLED_PYTHON)) {
      logSetup(`Using bundled python: ${BUNDLED_PYTHON}`);
      return BUNDLED_PYTHON;
    }
    logSetup(`Bundled python not found at ${BUNDLED_PYTHON}`);
    return null;
  }
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

function httpPost(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', timeout: timeoutMs }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function pollReady(port, attempts = 120, delayMs = 500) {
  const t0 = Date.now();
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < attempts; i++) {
      if (pySpawnError) {
        return reject(startupError(
          'YuuClip could not start its engine.\n\n' +
          'Start YuuClip again. If it keeps happening, open the log and send it to us.',
          SETUP_LOG));
      }
      if (pyProc && pyProc.exitCode !== null) {
        logSetup(`Backend exited during startup (code ${pyProc.exitCode}) after ${i} poll attempts`);
        return reject(startupError(
          'YuuClip started, but its engine stopped before it was ready.\n\n' +
          'This is usually a temporary hiccup - start YuuClip again. If it keeps ' +
          'happening, open the log and send it to us.', SETUP_LOG));
      }
      try {
        await httpGet(`http://127.0.0.1:${port}/api/videos`, 1000);
        logSetup(`Backend ready after ${i + 1} attempts (${Date.now() - t0} ms)`);
        return resolve();
      } catch (_) { /* not ready yet */ }
      await new Promise(r => setTimeout(r, delayMs));
    }
    logSetup(`Backend did not respond after ${attempts} attempts (${Date.now() - t0} ms)`);
    reject(startupError(
      'YuuClip’s engine didn’t start in time.\n\n' +
      'Start YuuClip again. If it keeps happening, open the log and send it to us.',
      SETUP_LOG));
  });
}

// Builds a startup-failure error carrying the plain-English text and log path
// the fatal dialog shows. The Error message stays one-line for the log.
function startupError(userMessage, logPath) {
  const err = new Error(userMessage.replace(/\s*\n+\s*/g, ' '));
  err.userMessage = userMessage;
  err.logPath = logPath;
  return err;
}

// A single dead-end-free fatal dialog for unrecoverable startup/runtime
// failures: plain-English "what happened", plus Try again (relaunch) / Open log
// folder / Quit. Technical detail stays in the log, never the dialog.
async function showFatalDialog(userMessage, logPath) {
  logSetup(`Fatal dialog shown: ${userMessage.replace(/\s*\n+\s*/g, ' ')}`);
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const opts = {
    type: 'error', title: 'YuuClip couldn’t start', message: userMessage,
    buttons: ['Try again', 'Open log folder', 'Quit'],
    defaultId: 0, cancelId: 2, noLink: true,
  };
  const { response } = win
    ? await dialog.showMessageBox(win, opts)
    : await dialog.showMessageBox(opts);
  if (response === 0) { isQuitting = true; app.relaunch(); app.exit(0); return; }
  if (response === 1) { try { shell.showItemInFolder(logPath); } catch (_) {} }
}

// ---------------------------------------------------------------------------
// Dependency detection
// ---------------------------------------------------------------------------

function checkFFmpeg() {
  if (app.isPackaged) {
    return resolveBundledFfmpegDir(true, BUNDLED_FFMPEG_DIR, fs.existsSync) !== null;
  }
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


function detectNvidiaVramMB() {
  try {
    const out = execFileSync(
      'nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader,nounits'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return parseNvidiaVramMB(out);
  } catch (_) {
    return 0;
  }
}

function detectGPU() {
  // wmic is deprecated (and emits UTF-16, which broke the old utf8 parse);
  // Get-CimInstance is the supported path and returns clean JSON.
  try {
    const out = execFileSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command',
        'Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return selectGPU(out, detectNvidiaVramMB);
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

// ---------------------------------------------------------------------------
// Setup wizard IPC
// ---------------------------------------------------------------------------

function registerWizardIPC(wizardWin) {
  // Clean up any previous handlers first. Every ipcMain.handle() channel below
  // MUST be listed here: handle() throws "second handler" if re-registered, and
  // that throw lands mid-setup so the setup:close/complete once-listeners never
  // get wired up - leaving a wizard whose Close button does nothing.
  for (const ch of ['setup:get-status', 'setup:pick-folder', 'setup:pick-file', 'setup:restore-backup']) {
    try { ipcMain.removeHandler(ch); } catch (_) {}
  }
  ipcMain.removeAllListeners('setup:pull-model');
  ipcMain.removeAllListeners('setup:cancel-pull');
  ipcMain.removeAllListeners('setup:download-gguf-model');
  ipcMain.removeAllListeners('setup:cancel-gguf-download');
  ipcMain.removeAllListeners('setup:open-url');
  ipcMain.removeAllListeners('setup:copy-text');
  ipcMain.removeAllListeners('setup:install-package');
  ipcMain.removeAllListeners('setup:restart-app');

  ipcMain.handle('setup:get-status', async () => {
    refreshPathFromRegistry();
    const eCfg = loadElectronConfig();
    const pDir = eCfg.projectDir || DEFAULT_PROJECT_DIR;

    let projCfg = {};
    try { projCfg = JSON.parse(fs.readFileSync(path.join(pDir, '.yuu-clip', 'config.json'), 'utf8')); } catch (_) {}

    const ffmpegOk      = checkFFmpeg();
    const gpu           = detectGPU();
    const cuda          = detectCUDA();
    const cudaLibsInstalled = await checkVenvModule(WIZARD_INSTALLABLE['cuda-libs'].importName);

    const existingModelPath = projCfg.llm_model_path || '';

    let freeDiskGB;
    try { freeDiskGB = diskSpace.freeBytesAt(pDir) / 1e9; } catch (_) { freeDiskGB = undefined; }

    logSetup(`Status check - FFmpeg:${ffmpegOk} GPU:${gpu.name} CUDA:${cuda.available} cudaLibs:${cudaLibsInstalled}`);
    return {
      ffmpegOk,
      ffmpegBundled: app.isPackaged,
      gpu, cuda,
      cudaLibsInstalled,
      recommendedWhisper: recommendWhisperModel(gpu.vramMB),
      localModelRecommendation: recommendLocalModel({ vramMB: gpu.vramMB, freeDiskGB, gpuVendor: gpu.vendor }),
      whisperModel:  projCfg.whisper_model || '',
      projectDir: pDir,
      aiPrivacyMode: projCfg.ai_privacy_mode || 'local_only',
      llmBackend:    'llamacpp',
      llmModelPath:  existingModelPath,
      whisperLanguage:    projCfg.whisper_language || '',
      contentPreset:      projCfg.content_preset || 'generic',
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

    const installArgs = ['install', '--progress-bar', 'raw', ...spec.packages];
    logSetup(`Wizard install starting: ${installArgs.join(' ')}`);
    try {
      await runCmd(VENV_PIP, installArgs,
        pipStatusReporter(statusText => send({ status: statusText })));
      logSetup(`Wizard install complete: ${slug}`);
      send({ done: true });
    } catch (err) {
      const stderr = (err.stderr || '').trim();
      const tail   = stderr.split(/\r?\n/).filter(Boolean).slice(-3).join('\n');
      logSetup(`Wizard install failed: ${slug} - ${err.message}${tail ? '\n' + tail : ''}`);
      send({ error: describeInstallFailure(stderr) });
    }
  });

  // Stream a one-click .gguf model download for the llama.cpp backend.
  ipcMain.on('setup:download-gguf-model', (event) => {
    const send = (payload) => {
      try { event.sender.send('setup:gguf-download-progress', payload); } catch (_) {}
    };
    const shortfall = diskSpace.diskShortfallMessage(MODELS_DIR, DEFAULT_LLAMACPP_MODEL.sizeGb);
    if (shortfall) {
      logSetup(`GGUF model download blocked - ${shortfall}`);
      send({ error: shortfall });
      return;
    }
    const url = `${DEFAULT_LLAMACPP_MODEL.repoUrl}/resolve/main/${DEFAULT_LLAMACPP_MODEL.filename}`;
    const destPath = path.join(MODELS_DIR, DEFAULT_LLAMACPP_MODEL.filename);
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    logSetup(`GGUF model download starting: ${url}`);
    // Compare before clearing: an aborted download's late .catch must not null
    // out the controller a newly started download just installed.
    const controller = new AbortController();
    activeGgufController = controller;
    downloadFileWithProgress(url, destPath, pct => send({ progress: pct }),
                             { signal: controller.signal })
      .then(() => {
        if (activeGgufController === controller) activeGgufController = null;
        logSetup(`GGUF model download complete: ${destPath}`);
        send({ done: true, path: destPath });
      })
      .catch(err => {
        if (activeGgufController === controller) activeGgufController = null;
        if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) return; // cancel event already sent
        logSetup(`GGUF model download failed: ${err.message}`);
        send({ error: describeDownloadFailure(err.message) });
      });
  });

  ipcMain.on('setup:cancel-gguf-download', (event) => {
    if (!activeGgufController) return;
    logSetup('GGUF model download cancelled by user');
    activeGgufController.abort();
    activeGgufController = null;
    try { event.sender.send('setup:gguf-download-progress', { cancelled: true }); } catch (_) {}
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

  // Restore a backup into the chosen project folder before the server spawns
  // (Stage 4). Re-pointing of moved source media is deferred to the in-app
  // Restore flow. Exit code 2 means "folder already has a project" - offer to
  // replace it (a project.db.pre-restore safety copy is kept) and retry.
  ipcMain.handle('setup:restore-backup', async (_, opts = {}) => {
    const { archive, project } = opts;
    if (!archive || !project) {
      return { ok: false, error: 'Choose a backup file and a project folder first.' };
    }
    let result = await runRestore(archive, project, false);
    if (result.code === 'project_exists') {
      const { response } = await dialog.showMessageBox(wizardWin, {
        type: 'warning',
        title: 'Folder already has a project',
        message: 'That folder already contains a project.',
        detail: 'Replace it with the backup? A safety copy of the existing database is kept.',
        buttons: ['Replace', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      });
      if (response !== 0) return { ok: false, cancelled: true };
      result = await runRestore(archive, project, true);
    }
    if (!result.ok && !result.cancelled) {
      await dialog.showMessageBox(wizardWin, {
        type: 'error',
        title: 'Restore failed',
        message: 'The backup could not be restored.',
        detail: result.error || 'Check that the file is a YuuClip backup.',
        buttons: ['OK'],
      });
    }
    return result;
  });

  ipcMain.on('setup:open-url', (_, url) => shell.openExternal(url));

  ipcMain.on('setup:copy-text', (_, text) => clipboard.writeText(String(text || '')));

}

// The "Starting YuuClip…" spinner shown while the backend boots. When
// frameless, it draws the same custom titlebar + minimize button as the venv
// setup window (showVenvSetupWindow) instead of the native OS header; that path
// reuses venv-preload's venvAPI.minimize, so a frameless caller must load
// venv-preload.js and wire the 'venv:minimize' channel.
function loadingScreenUrl(frameless = false) {
  const chromeStyle = frameless ? `<style>
    .titlebar{position:fixed;top:0;left:0;right:0;height:28px;-webkit-app-region:drag}
    .min-btn{position:fixed;top:0;right:0;width:32px;height:28px;-webkit-app-region:no-drag;display:flex;align-items:center;justify-content:center;color:#87879f;font-size:14px;cursor:pointer;user-select:none}
    .min-btn:hover{color:#e8e8f8;background:#1e1e30}
  </style>` : '';
  const chromeMarkup = frameless
    ? `<div class="titlebar"></div><div class="min-btn" id="minBtn" title="Minimize">-</div>`
    : '';
  const chromeScript = frameless
    ? `<script>var b=document.getElementById('minBtn');if(b)b.onclick=function(){if(window.venvAPI&&window.venvAPI.minimize)window.venvAPI.minimize();};</script>`
    : '';
  const loadingHtml = `<!DOCTYPE html><html><head>${chromeStyle}</head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12121e;color:#d8d8e8;text-align:center"><style>@keyframes spin{to{transform:rotate(360deg)}}</style>${chromeMarkup}<div><div style="width:32px;height:32px;border:3px solid #1e1e30;border-top-color:#5b8ef0;border-radius:50%;animation:spin 0.65s linear infinite;margin:0 auto 14px"></div><h3 style="margin:0 0 6px;font-size:14px;color:#e8e8f8">Starting YuuClip…</h3><p id="status" style="margin:0;color:#9090a8;font-size:12px">Waiting for backend</p></div>${chromeScript}</body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml)}`;
}

// Swap the wizard window to the loading screen while the backend boots;
// app lifecycle closes it once the main window is ready.
function showWizardLoadingScreen(win) {
  win.loadURL(loadingScreenUrl());
  wizardWin = win;
}

// A standalone loading window for launch paths with no wizard to repurpose, so
// the taskbar isn't empty during the (multi-second) backend boot. Tracked as
// wizardWin so the same startup teardown closes it once the main window opens.
function showStartupLoadingWindow() {
  const win = new BrowserWindow({
    width: 480, height: 400, resizable: false, frame: false, minimizable: true,
    title: 'YuuClip',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      preload: path.join(__dirname, 'venv-preload.js'),
    },
  });
  ipcMain.removeAllListeners('venv:minimize');
  ipcMain.on('venv:minimize', () => {
    if (!win.isDestroyed()) win.minimize();
  });
  win.on('closed', () => ipcMain.removeAllListeners('venv:minimize'));
  win.loadURL(loadingScreenUrl(true));
  wizardWin = win;
  return win;
}

// Updates the "Starting YuuClip…" loading screen's status line from the main
// process. No preload/IPC needed for one line of text - executeJavaScript is
// simpler than wiring a context-bridged channel just for this.
function updateLoadingStatus(win, text) {
  if (!win || win.isDestroyed()) return;
  const statusJs = `var el = document.getElementById('status'); if (el) el.textContent = ${JSON.stringify(text)};`;
  win.webContents.executeJavaScript(statusJs).catch(() => {});
}

// Opens the setup wizard.  In initial/update mode, returns a promise that
// resolves with the collected config when the user clicks Launch.  In rerun
// mode the caller doesn't await; the wizard saves config on Apply & Close, or
// discards on Close.
function showSetupWizard({ rerun = false, updated = false } = {}) {
  return new Promise((resolve, reject) => {
    // Only ever one setup window. A second window sharing the global setup:*
    // IPC channels leaves a stale once-handler bound to the other window; when
    // that handler later calls win.close() on the destroyed window it throws
    // "Object has been destroyed", which crashes the whole app.
    if (setupWizardWin && !setupWizardWin.isDestroyed()) {
      logSetup('Setup wizard already open - focusing it instead of opening another');
      setupWizardWin.focus();
      reject(new Error('Setup window already open'));
      return;
    }

    const win = new BrowserWindow({
      width: 620, height: 780,
      minWidth: 560, minHeight: 600,
      resizable: true,
      title: 'YuuClip Setup',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'setup-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    setupWizardWin = win;

    const mode = rerun ? 'rerun' : updated ? 'update' : 'initial';
    win.loadFile(path.join(__dirname, 'setup.html'),
      mode === 'initial' ? {} : { query: { mode } }
    );

    registerWizardIPC(win);

    ipcMain.removeAllListeners('setup:complete');
    ipcMain.removeAllListeners('setup:quit');
    ipcMain.removeAllListeners('setup:close');
    ipcMain.removeAllListeners('setup:skip');

    logSetup(`Setup wizard opened (mode=${mode})`);

    ipcMain.once('setup:complete', (_, cfg) => {
      saveElectronConfig({ projectDir: cfg.projectDir, setupSchemaVersion: SETUP_SCHEMA_VERSION });
      // A restored project already carries its own config.json - writing the
      // wizard defaults over it would wipe the user's saved settings.
      if (cfg.restored) {
        logSetup(`Setup complete via restore - projectDir:${cfg.projectDir} (kept restored settings)`);
      } else {
        const pyCfg = buildProjectConfigFromWizard(cfg);
        writeProjectConfig(cfg.projectDir, pyCfg);
        logSetup(`Setup complete - projectDir:${cfg.projectDir} whisperModel:${cfg.whisperModel} llmBackend:${pyCfg.llm_backend} diarization:${pyCfg.diarization_backend}`);
      }
      fs.mkdirSync(path.dirname(SETUP_COMPLETE_MARKER), { recursive: true });
      fs.writeFileSync(SETUP_COMPLETE_MARKER, new Date().toISOString());
      if (!rerun) {
        showWizardLoadingScreen(win);
      } else {
        if (!win.isDestroyed()) win.close();
      }
      resolve(cfg);
    });

    ipcMain.once('setup:quit', () => {
      logSetup('Setup wizard: user chose Quit - exiting app');
      app.quit();
      reject(new Error('User quit setup'));
    });

    // Rerun mode only: close the wizard without saving anything.
    ipcMain.once('setup:close', () => {
      if (!win.isDestroyed()) win.close();
      reject(new Error('Setup window closed'));
    });

    // Update mode only: launch with existing config. The schema version is
    // still stored - the user saw the new options once and chose to move on;
    // re-showing every launch would be nagging. Re-run remains in the menu.
    const skipUpdateWizard = () => {
      saveElectronConfig({ setupSchemaVersion: SETUP_SCHEMA_VERSION });
      logSetup('Update-mode setup skipped - launching with existing config');
      resolve({ projectDir: loadElectronConfig().projectDir || DEFAULT_PROJECT_DIR });
      showWizardLoadingScreen(win);
    };
    ipcMain.once('setup:skip', skipUpdateWizard);

    win.on('closed', () => {
      if (setupWizardWin === win) setupWizardWin = null;
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

function showVenvSetupWindow(stepLabel, note) {
  const win = new BrowserWindow({
    width: 440, height: 240,
    resizable: false, frame: false, minimizable: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'venv-preload.js'),
    },
  });
  ipcMain.removeAllListeners('venv:minimize');
  ipcMain.on('venv:minimize', () => {
    if (!win.isDestroyed()) win.minimize();
  });
  win.on('closed', () => ipcMain.removeAllListeners('venv:minimize'));
  const html = `<!DOCTYPE html><html><head><style>
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes indeterminate-slide{0%{left:-30%}100%{left:100%}}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12121e;color:#d8d8e8;text-align:center}
    .titlebar{position:fixed;top:0;left:0;right:0;height:28px;-webkit-app-region:drag}
    .min-btn{position:fixed;top:0;right:0;width:32px;height:28px;-webkit-app-region:no-drag;display:flex;align-items:center;justify-content:center;color:#87879f;font-size:14px;cursor:pointer;user-select:none}
    .min-btn:hover{color:#e8e8f8;background:#1e1e30}
    h3{margin:0 0 12px;font-size:14px;color:#e8e8f8}
    .spin{display:inline-block;width:28px;height:28px;border:3px solid #1e1e30;border-top-color:#5b8ef0;border-radius:50%;animation:spin 0.65s linear infinite;margin:0 auto 14px}
    .steps{list-style:none;margin:0;padding:0;text-align:left;display:inline-block}
    .steps li{font-size:12px;color:#87879f;padding:2px 0;padding-left:18px;position:relative}
    .steps li.done{color:#4caf7d}
    .steps li.active{color:#d0d0e0}
    .steps li::before{content:'·';position:absolute;left:4px}
    .steps li.done::before{content:'✓';color:#4caf7d}
    .steps li.active::before{content:'›';color:#5b8ef0}
    .bar-track{position:relative;overflow:hidden;width:260px;height:6px;background:#1e1e30;border-radius:3px;margin:12px auto 0}
    .bar-fill{position:absolute;left:0;top:0;height:100%;width:0%;background:#5b8ef0;border-radius:3px;transition:width 0.25s ease}
    .bar-fill.indeterminate{width:30%;transition:none;animation:indeterminate-slide 1.1s ease-in-out infinite}
    .bar-label{font-size:10px;color:#87879f;margin-top:4px}
    .elapsed{font-size:10px;color:#5b8ef0;margin-top:2px}
    .status{font-size:11px;color:#5b8ef0;margin-top:10px;min-height:14px;padding:0 16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .note{font-size:11px;color:#87879f;margin-top:4px;padding:0 16px}
  </style></head><body>
    <div class="titlebar"></div>
    <div class="min-btn" id="minBtn" title="Minimize">-</div>
    <div>
    <div class="spin"></div>
    <h3>Setting up YuuClip</h3>
    <ul class="steps" id="steps">
      <li id="s0">${stepLabel}</li>
    </ul>
    <div class="bar-track"><div class="bar-fill indeterminate" id="barFill"></div></div>
    <div class="bar-label" id="barLabel">working...</div>
    <div class="elapsed" id="elapsed">elapsed 0:00</div>
    <div class="status" id="status"></div>
    <div class="note">${note}</div>
  </div><script>
    var minBtn=document.getElementById('minBtn');
    if(minBtn) minBtn.onclick=function(){ if(window.venvAPI&&window.venvAPI.minimize) window.venvAPI.minimize(); };
    if(window.venvAPI) window.venvAPI.onProgress(function(msg){
      var steps=['s0'];
      var idx=steps.indexOf(msg.id);
      if(idx<0)return;
      if(msg.state==='active'){document.getElementById(msg.id).className='active';}
      else if(msg.state==='done'){document.getElementById(msg.id).className='done';}
    });
    var barFill=document.getElementById('barFill');
    var barLabel=document.getElementById('barLabel');
    var lastFractionAt=0;
    var WATCHDOG_MS=3500;
    setInterval(function(){
      if(lastFractionAt&&Date.now()-lastFractionAt>WATCHDOG_MS){
        barFill.className='bar-fill indeterminate';
        barLabel.textContent='working...';
      }
    },500);
    var startedAt=Date.now();
    setInterval(function(){
      var secs=Math.floor((Date.now()-startedAt)/1000);
      var m=Math.floor(secs/60), s=secs%60;
      document.getElementById('elapsed').textContent='elapsed '+m+':'+(s<10?'0':'')+s;
    },1000);
    if(window.venvAPI&&window.venvAPI.onStatus) window.venvAPI.onStatus(function(msg){
      if(msg.text) document.getElementById('status').textContent=msg.text;
      if(typeof msg.fraction==='number'){
        lastFractionAt=Date.now();
        barFill.className='bar-fill';
        barFill.style.width=Math.round(msg.fraction*100)+'%';
        barLabel.textContent=msg.label||'';
      }
    });
  </script></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

// Feeds every raw pip stdout/stderr line to both the condensed status text
// (pipStatusReporter) and the raw progress-bar parser, over the single
// 'venv:status' bridge. Byte counts in pip's raw progress reset to 0 for each
// new package it downloads within the same install - peakFraction is a
// running high-water mark so the bar only ever moves forward, never back.
function makePipLineHandler(setupWin) {
  const reportStatus = pipStatusReporter(statusText => {
    try { setupWin.webContents.send('venv:status', { text: statusText }); } catch (_) {}
  });
  let peakFraction = 0;
  return line => {
    reportStatus(line);
    const parsed = parsePipRawProgress(line);
    if (!parsed) return;
    peakFraction = Math.max(peakFraction, parsed.fraction);
    try {
      setupWin.webContents.send('venv:status', { fraction: peakFraction, label: parsed.label });
    } catch (_) {}
  };
}

// Packaged builds ship the analysis venv prebuilt (scripts/windows-release/build-prebuilt-env.ps1)
// so first run unpacks an archive instead of running pip - no resolution, no
// compile. The extracted venv unpacks to roughly 1.2 GB; the .incoming temp copy
// during extract plus this headroom is what the disk precheck guards against.
const PREBUILT_ENV_EXTRACTED_GB = 2;
const EXTRACT_HEADROOM_GB = 2;

function readPrebuiltEnvVersion(resourcesDir) {
  try { return fs.readFileSync(path.join(resourcesDir, 'prebuilt-env.version'), 'utf8').trim(); }
  catch (_) { return null; }
}

// Chooses how to provision the venv: unpack the shipped prebuilt env (packaged),
// reuse it when the version already matches, or fall back to pip-from-wheelhouse
// (dev/unpackaged builds, which don't carry the archive).
async function ensureVenv() {
  // Smoke/dev boot: the backend interpreter is supplied ready-to-run, so there is
  // no venv to provision - skip straight to spawnBackend (which uses the same
  // override). See backendPython().
  if (process.env.YUU_SMOKE_BACKEND_PYTHON) {
    logSetup(`Venv setup skipped - using supplied backend python ${backendPython()}`);
    return;
  }
  const resourcesDir = process.resourcesPath || path.join(__dirname, '..', 'dist');
  const envArchive = path.join(resourcesDir, 'prebuilt-env.tar.gz');
  const envArchivePresent = fs.existsSync(envArchive);

  let installedVersion = null;
  try { installedVersion = fs.readFileSync(WHEEL_MARKER, 'utf8').trim(); } catch (_) {}
  const venvExists = fs.existsSync(VENV_PYTHON);
  const bundledVersion = envArchivePresent ? readPrebuiltEnvVersion(resourcesDir) : null;

  const action = decidePrebuiltEnvAction({ envArchivePresent, installedVersion, bundledVersion, venvExists });
  logSetup(`Venv setup: ${action} (installed=${installedVersion || 'none'}, bundled=${bundledVersion || 'unknown'}, venv=${venvExists})`);

  if (action === 'use-existing') return;
  if (action === 'extract') { await runPrebuiltEnvSetup(envArchive, bundledVersion); return; }
  await runPipVenvSetup(resourcesDir);
}

async function runPrebuiltEnvSetup(envArchive, bundledVersion) {
  const shortfall = diskSpace.diskShortfallMessage(VENV_DIR, PREBUILT_ENV_EXTRACTED_GB, EXTRACT_HEADROOM_GB);
  if (shortfall) {
    logSetup(`Prebuilt env extract blocked - ${shortfall}`);
    const err = new Error('Not enough disk space to unpack the analysis engine');
    err.userMessage = shortfall;
    err.logPath = SETUP_LOG;
    throw err;
  }
  fs.mkdirSync(path.dirname(VENV_DIR), { recursive: true });
  const setupWin = showVenvSetupWindow(
    'Unpacking the analysis engine',
    "Unpacking the analysis engine - just a moment. The first time can take a little longer while your antivirus scans the new files. Please don't close this window.");
  const progress = (id, state) => { try { setupWin.webContents.send('venv:progress', { id, state }); } catch (_) {} };
  try {
    await extractPrebuiltEnv(envArchive, bundledVersion, progress);
  } catch (err) {
    const detail = [err.stderr, err.stdout].filter(Boolean).join('\n');
    logSetup(`Prebuilt env setup failed: ${err.message}${detail ? '\n' + detail : ''}`);
    const wrapped = new Error(err.message);
    wrapped.userMessage = "YuuClip couldn't finish setting itself up - " + describeInstallFailure(detail);
    wrapped.logPath = SETUP_LOG;
    throw wrapped;
  } finally {
    setupWin.close();
  }
}

// Extracts to a temp sibling and only renames into place on success, so a crash
// mid-unpack never leaves a half-venv that looks complete (the version marker
// stays old and the next launch re-extracts cleanly). The prebuilt venv records
// the build machine's python path; relocateExtractedVenv repoints it at the
// bundled runtime's real install location before it is used.
async function extractPrebuiltEnv(envArchive, bundledVersion, progress) {
  progress('s0', 'active');
  logSetup(`Unpacking prebuilt env from ${envArchive}`);
  const incoming = VENV_DIR + '.incoming';
  if (fs.existsSync(VENV_DIR)) fs.rmSync(VENV_DIR, { recursive: true, force: true });
  if (fs.existsSync(incoming)) fs.rmSync(incoming, { recursive: true, force: true });
  fs.mkdirSync(incoming, { recursive: true });
  await runCmd('tar', ['-xzf', envArchive, '-C', incoming]);
  const extractedVenv = path.join(incoming, 'venv');
  relocateExtractedVenv(extractedVenv);
  fs.renameSync(extractedVenv, VENV_DIR);
  fs.rmSync(incoming, { recursive: true, force: true });
  if (bundledVersion) fs.writeFileSync(WHEEL_MARKER, bundledVersion);
  progress('s0', 'done');
  logSetup('Prebuilt env unpacked and relocated');
}

function relocateExtractedVenv(venvPath) {
  const cfgPath = path.join(venvPath, 'pyvenv.cfg');
  const basePythonDir = path.dirname(BUNDLED_PYTHON);
  fs.writeFileSync(cfgPath, rewritePyvenvCfg(fs.readFileSync(cfgPath, 'utf8'), basePythonDir));
}

async function promptPythonMissing() {
  if (app.isPackaged) {
    await dialog.showMessageBox({
      type: 'error', title: 'YuuClip installation is damaged',
      message:
        'The Python runtime bundled with YuuClip is missing or damaged.\n\n' +
        'Try reinstalling YuuClip. If the problem persists, please report it.',
      buttons: ['Quit'], defaultId: 0,
    });
  } else {
    logSetup('No Python 3.11+ found on PATH - aborting setup');
    await dialog.showMessageBox({
      type: 'error', title: 'Python 3.11+ required',
      message:
        'YuuClip needs Python 3.11 or later, which was not found on PATH.\n\n' +
        'Download and install it from python.org, then restart YuuClip.\n\n' +
        '(Make sure to check "Add Python to PATH" during installation.)',
      buttons: ['Open python.org', 'Quit'], defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) shell.openExternal('https://www.python.org/downloads/');
    });
  }
  app.quit();
}

// Dev/unpackaged fallback: build the venv with pip from the bundled wheelhouse.
// Packaged builds never reach here (they carry the prebuilt archive), so this path
// keeps its own version-match short-circuit to avoid reinstalling every launch.
async function runPipVenvSetup(resourcesDir) {
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
    logSetup(`Venv OK - wheel ${bundledVersion || 'unknown'} already installed`);
    return;
  }
  logSetup(venvExists
    ? `Wheel update needed (installed: ${installedVersion || 'none'}, bundled: ${bundledVersion}) - reinstalling`
    : 'Venv not found - running first-run setup');

  const pythonBin = findPython();
  if (!pythonBin) { await promptPythonMissing(); throw new Error('Python not found'); }

  logSetup(`Using python: ${pythonBin}`);
  logSetup(`Installing wheel: ${wheelPath}`);
  fs.mkdirSync(path.dirname(VENV_DIR), { recursive: true });

  const setupWin = showVenvSetupWindow(
    'Installing the analysis engine',
    "Installing the analysis engine - first time only, this can take a few minutes. Please don't close this window.");
  const progress = (id, state) => { try { setupWin.webContents.send('venv:progress', { id, state }); } catch (_) {} };
  try {
    progress('s0', 'active');
    if (!venvExists) { await runCmd(pythonBin, ['-m', 'venv', VENV_DIR]); logSetup('Venv created'); }
    logSetup('Installing wheel...');
    const lockPath = path.join(resourcesDir, 'requirements.lock');
    const lockOk   = fs.existsSync(lockPath);
    const wheelhouseDir = path.join(resourcesDir, 'wheelhouse');
    const wheelhouseOk  = fs.existsSync(wheelhouseDir)
      && fs.readdirSync(wheelhouseDir).some(f => f.endsWith('.whl'));
    logSetup(wheelhouseOk
      ? `Installing offline from bundled wheelhouse: ${wheelhouseDir}`
      : 'Wheelhouse not bundled - installing base deps from PyPI (online)');
    logSetup(lockOk ? `Constraining deps to ${lockPath}`
                    : 'requirements.lock not bundled - installing without a constraint');
    const onPipLine = makePipLineHandler(setupWin);
    await runCmd(
      VENV_PIP,
      buildWheelInstallArgs(wheelPath, lockOk ? lockPath : null, wheelhouseOk ? wheelhouseDir : null),
      onPipLine
    );
    logSetup('Ensuring a single OpenCV build (contrib superset wins)...');
    await runCmd(
      VENV_PIP,
      buildOpencvDedupeArgs(lockOk ? lockPath : null, wheelhouseOk ? wheelhouseDir : null),
      onPipLine
    );
    progress('s0', 'done');
    logSetup('Wheel installed');
    if (bundledVersion) fs.writeFileSync(WHEEL_MARKER, bundledVersion);
  } catch (err) {
    const detail = [err.stderr, err.stdout].filter(Boolean).join('\n');
    logSetup(`Venv setup failed: ${err.message}${detail ? '\n' + detail : ''}`);
    const wrapped = new Error(err.message);
    wrapped.userMessage =
      "YuuClip couldn't finish setting itself up - " + describeInstallFailure(detail);
    wrapped.logPath = SETUP_LOG;
    throw wrapped;
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
      type: 'warning', title: 'YuuClip is already running',
      message: 'Another YuuClip instance is already using port 8080.\n\nClose it first, then relaunch.',
      buttons: ['OK'],
    });
    app.quit();
    throw new Error('Duplicate YuuClip instance');
  }

  const free = await findFreePort(BASE_PORT + 1);
  logSetup(`Port ${BASE_PORT} in use by unrelated process; using ${free}`);
  return free;
}

// ---------------------------------------------------------------------------
// Spawn Python backend
// ---------------------------------------------------------------------------

// Run the Python restore CLI once and resolve to a plain result object
// (see restore-backup.js parseRestoreExit). Never rejects - the wizard shows the
// error message rather than crashing.
function runRestore(archive, project, overwrite) {
  return new Promise((resolve) => {
    const args = buildRestoreArgs(archive, project, overwrite);
    const env = { ...process.env };
    if (app.isPackaged) env.YUU_CLIP_FFMPEG_DIR = BUNDLED_FFMPEG_DIR;
    logSetup(`Running restore: ${VENV_PYTHON} ${args.join(' ')}`);
    let stderr = '';
    const proc = spawn(VENV_PYTHON, args, { windowsHide: true, env });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => resolve({ ok: false, error: err.message }));
    proc.on('exit', code => {
      logSetup(`Restore exited with code ${code}`);
      resolve(parseRestoreExit(code, stderr));
    });
  });
}

function spawnBackend(port) {
  const args = ['-m', 'yuu_clip.cli', 'serve', '--project', projectDir, '--no-open'];
  if (port !== BASE_PORT) args.push('--port', String(port));

  // Packaged builds always point the backend at the bundled FFmpeg, rather than
  // relying on an inherited PATH - YUU_CLIP_FFMPEG_DIR set-but-broken raises a
  // loud error in find_ffmpeg() instead of silently falling back to PATH, so a
  // packaging bug surfaces immediately (see yuu_clip/config.py find_ffmpeg()).
  const env = { ...process.env };
  if (app.isPackaged) {
    env.YUU_CLIP_FFMPEG_DIR = BUNDLED_FFMPEG_DIR;
    // The bundled llama-server dir holds vulkan\ + cpu\; resolve_server_binary
    // picks between them. Set for the backend so its child analyze subprocess
    // (which does the LLM/vision scoring) inherits it too.
    env.YUU_CLIP_LLAMA_SERVER_DIR = BUNDLED_LLAMA_SERVER_DIR;
  }

  const python = backendPython();
  logSetup(`Spawning backend: ${python} ${args.join(' ')}`);
  pySpawnError = null;
  pyProc = spawn(python, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env,
  });

  // Without a listener a failed spawn (missing/blocked python) raises an
  // unhandled 'error' event - the app would vanish via uncaughtException
  // instead of showing the fatal dialog (pollReady watches pySpawnError).
  pyProc.on('error', err => {
    logSetup(`Backend failed to spawn: ${err.message}`);
    pySpawnError = err;
  });

  pyProc.stdout.on('data', d => process.stdout.write(d));
  pyProc.stderr.on('data', d => {
    process.stderr.write(d);
    logSetup(`[backend] ${d.toString().trimEnd()}`);
  });
  pyProc.on('exit', code => {
    if (isQuitting) return;
    // During startup, pollReady already owns the failure dialog (it watches
    // pyProc.exitCode); showing one here too would double up. Only handle the
    // post-startup runtime crash.
    if (!startupComplete) return;
    logSetup(`Backend exited unexpectedly (code ${code})`);
    const projectLog = path.join(projectDir, '.yuu-clip', 'yuu-clip.log');
    showFatalDialog(
      'YuuClip’s engine stopped unexpectedly.\n\n' +
      'Start YuuClip again. If it keeps happening, open the log and send it to us.',
      projectLog,
    ).then(() => { if (!isQuitting) app.quit(); });
  });
}

// ---------------------------------------------------------------------------
// Native media protocol (roadmap plan 10) - serves the recording source/proxy
// files directly from disk instead of proxying every byte through the Python
// HTTP server. Startup-latency win only; seeking already works fine over HTTP
// via the 720p proxy, so this is intentionally low-stakes and surgical.
//
// Electron's protocol.handle() + net.fetch(pathToFileURL(...)) is the
// documented pattern for this, but Range-request/video-seeking support on top
// of it has been an unresolved Electron bug (electron/electron#38749) across
// every version from 25 through at least 35 - still open as of our pinned
// 33.2.1 (electron/package.json). Range handling is therefore done manually
// here (parse header, fs.createReadStream(start, end), 206 + Content-Range)
// rather than trusting net.fetch to cover it.
// ---------------------------------------------------------------------------

// Renderer input is untrusted: a path is only served if it's inside the
// project's proxies dir (deterministic, always true for generated proxies) or
// it exactly matches a source/proxy path the backend has told us about for a
// known video. Source recordings live wherever the creator originally pointed
// `analyze` at - often outside the project dir entirely - so an allowed-*root*
// check alone (as for proxies) can't cover them; this whitelist of exact,
// backend-confirmed paths does. The cache is refreshed at most once every
// MEDIA_PATH_REFRESH_MIN_INTERVAL_MS so a burst of Range requests during
// scrubbing doesn't hammer the backend, while a first request for a
// just-ingested recording still triggers one refresh instead of a flat reject.
const MEDIA_PATH_REFRESH_MIN_INTERVAL_MS = 2000;
let knownMediaPaths          = new Set();
let knownMediaPathsFetchedAt = 0;

async function refreshKnownMediaPaths() {
  try {
    const body   = await httpGet(`http://127.0.0.1:${appPort}/api/videos`, 2000);
    const videos = JSON.parse(body);
    const paths  = new Set();
    for (const video of videos) {
      if (video.source_path) paths.add(path.resolve(video.source_path));
      if (video.proxy_path)  paths.add(path.resolve(video.proxy_path));
    }
    knownMediaPaths = paths;
  } catch (_) {
    // Backend not reachable (e.g. still starting) - leave the cache as-is.
  } finally {
    knownMediaPathsFetchedAt = Date.now();
  }
}

async function isAllowedMediaPath(resolvedPath) {
  const proxiesRoot = path.join(projectDir, '.yuu-clip', 'proxies');
  if (isPathInside(resolvedPath, proxiesRoot)) return true;
  if (knownMediaPaths.has(resolvedPath)) return true;
  if (Date.now() - knownMediaPathsFetchedAt > MEDIA_PATH_REFRESH_MIN_INTERVAL_MS) {
    await refreshKnownMediaPaths();
    if (knownMediaPaths.has(resolvedPath)) return true;
  }
  return false;
}

function serveFileWithRange(filePath, stat, rangeHeader) {
  const fileSize = stat.size;
  const mimeType = mimeTypeFor(path.extname(filePath));
  const init = rangeResponseInit(rangeHeader, fileSize, mimeType);

  if (init.status === 416) {
    return new Response(null, { status: init.status, headers: init.headers });
  }

  const streamOpts = init.range ? { start: init.range.start, end: init.range.end } : undefined;
  const body = Readable.toWeb(fs.createReadStream(filePath, streamOpts));
  return new Response(body, { status: init.status, headers: init.headers });
}

function registerMediaProtocol() {
  protocol.handle('yuu-media', async request => {
    let resolvedPath;
    try {
      const parsed = new URL(request.url);
      if (parsed.hostname !== 'media') return new Response('Not found', { status: 404 });
      resolvedPath = path.resolve(decodeURIComponent(parsed.pathname.replace(/^\/+/, '')));
    } catch (err) {
      logSetup(`yuu-media: malformed request URL ${request.url} - ${err.message}`);
      return new Response('Bad request', { status: 400 });
    }

    if (!await isAllowedMediaPath(resolvedPath)) {
      logSetup(`yuu-media: rejected path outside allowed roots: ${resolvedPath}`);
      return new Response('Forbidden', { status: 403 });
    }

    let stat;
    try {
      stat = fs.statSync(resolvedPath);
    } catch (_) {
      return new Response('Not found', { status: 404 });
    }

    return serveFileWithRange(resolvedPath, stat, request.headers.get('range'));
  });
}

// ---------------------------------------------------------------------------
// Window + menu
// ---------------------------------------------------------------------------

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280, height: 900,
    minWidth: 1024, minHeight: 700,
    title: 'YuuClip',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // A blank main window is a common "it stopped working" report. Log the two
  // ways it happens - the page failing to load the backend, or the renderer
  // process crashing out from under a window that still looks alive.
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (code === -3) return;  // ERR_ABORTED - benign (e.g. a superseded nav)
    logSetup(`Main window failed to load (${code} ${desc}) - ${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logSetup(`Main window renderer gone: ${details.reason} (exitCode ${details.exitCode})`);
  });

  mainWindow.on('close', async e => {
    if (isQuitting) return;
    e.preventDefault();
    await handleClose();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  registerProjectIPC();
  buildMenu();
}

// Project switcher (roadmap plan 03): the Python server swaps projects in place,
// but main.js keeps its own projectDir for media-proxy serving and for the next
// launch, so the renderer notifies us after a successful switch. We also provide
// the native folder picker the renderer's "Open another project…" dialog uses.
function registerProjectIPC() {
  try { ipcMain.removeHandler('project:pick-folder'); } catch (_) {}
  try { ipcMain.removeHandler('model:pick-file'); } catch (_) {}
  ipcMain.removeAllListeners('project:changed');

  ipcMain.on('project:changed', (_, newDir) => {
    if (typeof newDir !== 'string' || !newDir) return;
    projectDir = newDir;
    saveElectronConfig({ projectDir: newDir });
    // Force the media-path allowlist to rebuild against the new project's videos.
    knownMediaPaths = new Set();
    knownMediaPathsFetchedAt = 0;
    logSetup(`Project switched to ${newDir}`);
  });

  ipcMain.handle('project:pick-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose project folder',
      defaultPath: projectDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('model:pick-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, modelFileDialogOptions());
    return canceled ? null : filePaths[0];
  });
}

function buildMenu() {
  ipcMain.on('app:run-setup-wizard', () => {
    showSetupWizard({ rerun: true }).catch(err => logSetup(`Setup wizard dismissed: ${err.message}`));
  });

  const template = [
    {
      label: 'YuuClip',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Re-run Setup Wizard…',
          click: () => {
            // Non-blocking - backend keeps running while wizard is open.
            showSetupWizard({ rerun: true }).catch(err => logSetup(`Setup wizard dismissed: ${err.message}`));
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
    if (response !== 1) {
      logSetup('Main window close cancelled by user (analysis in progress)');
      return;
    }

    try {
      await httpPost(`http://127.0.0.1:${appPort}/api/analyze/cancel`, 5000);
    } catch (err) {
      logSetup(`Close-time analyze cancel failed (continuing to quit): ${err.message}`);
    }
  }

  logSetup(`Main window closed - shutting down (analysis was running: ${anyRunning})`);
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
  logSetup(`YuuClip ${app.getVersion()} starting - ${process.platform} ${process.arch} node/${process.versions.node}`);
  registerMediaProtocol();

  const knownQuits = [
    'Python not found',
    'Setup window closed',
    'User quit setup',
    'Duplicate YuuClip instance',
  ];

  try {
    await ensureVenv();

    const firstRun = !fs.existsSync(SETUP_COMPLETE_MARKER);
    refreshPathFromRegistry();
    const ffmpegOk = checkFFmpeg();
    // Setups completed before schema versioning existed count as version 1.
    const storedSchema  = loadElectronConfig().setupSchemaVersion || 1;
    const setupOutdated = !firstRun && storedSchema < SETUP_SCHEMA_VERSION;
    const { show: showWizard, mode: setupMode } = decideSetupMode({
      firstRun, ffmpegOk, storedSchema, schemaVersion: SETUP_SCHEMA_VERSION,
    });

    if (showWizard) {
      if (setupOutdated) logSetup(`Setup schema ${storedSchema} < ${SETUP_SCHEMA_VERSION} - showing wizard with new options`);
      const cfg = await showSetupWizard({ rerun: false, updated: setupMode === 'update' });
      projectDir = cfg.projectDir;
    } else {
      projectDir = loadElectronConfig().projectDir || DEFAULT_PROJECT_DIR;
      logSetup(`Project dir: ${projectDir}`);
    }

    // Guarantee a visible window (taskbar presence) during the backend boot.
    // The wizard paths leave a live wizardWin; other launches have none yet.
    if (!wizardWin || wizardWin.isDestroyed()) showStartupLoadingWindow();

    appPort = await resolvePort();
    spawnBackend(appPort);
    await pollReady(appPort);
    logSetup('Creating main window');
    createWindow(appPort);
    startupComplete = true;
    if (wizardWin && !wizardWin.isDestroyed()) { wizardWin.close(); wizardWin = null; }
  } catch (err) {
    if (!knownQuits.includes(err.message)) {
      logSetup(`Startup error: ${err.stack || err.message}`);
      const userMessage = err.userMessage ||
        'YuuClip ran into a problem while starting up.\n\n' +
        'Start YuuClip again. If it keeps happening, open the log and send it to us.';
      await showFatalDialog(userMessage, err.logPath || SETUP_LOG);
    }
    if (!isQuitting) app.quit();
  }
});

app.on('window-all-closed', () => {
  if (!startupComplete) return;
  logSetup('All windows closed - shutting down');
  isQuitting = true;  // keep the backend exit handler from racing a "stopped unexpectedly" dialog
  if (pyProc) { pyProc.kill(); pyProc = null; }
  app.quit();
});

// Kill the backend on any process exit - covers crashes, SIGTERM, and
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

// Rejected promises don't reach uncaughtException; log them so async failures
// that leave the app misbehaving are still diagnosable from the log alone.
process.on('unhandledRejection', reason => {
  const detail = reason instanceof Error ? (reason.stack || reason.message) : String(reason);
  logSetup(`Unhandled promise rejection: ${detail}`);
});
