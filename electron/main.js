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
const { selectLlamaWheelUrl } = require('./llamacpp-cuda');
const { buildWheelInstallArgs, buildOpencvDedupeArgs } = require('./venv-setup');
const { describeInstallFailure } = require('./install-error');
const diskSpace = require('./disk-space');
const { recommendWhisperModel } = require('./whisper-select');
const { mimeTypeFor, isPathInside, rangeResponseInit } = require('./media-serve');
const { buildProjectConfigFromWizard } = require('./wizard-config');
const { decideSetupMode } = require('./startup-mode');
const { buildRestoreArgs, parseRestoreExit } = require('./restore-backup');
const {
  VENV_DIR, VENV_PYTHON, VENV_PIP, BUNDLED_PYTHON, BUNDLED_FFMPEG_DIR,
  SETUP_LOG, SETUP_COMPLETE_MARKER, WHEEL_MARKER,
  DEFAULT_PROJECT_DIR, BASE_PORT, DEFAULT_OLLAMA_MODEL, DEFAULT_CLAUDE_MODEL,
  DEFAULT_OLLAMA_MODEL_SIZE_GB, DEFAULT_LLAMACPP_MODEL, MODELS_DIR, SETUP_SCHEMA_VERSION,
} = require('./constants');
const { rotateLogs, logSetup } = require('./logging');
const { loadElectronConfig, saveElectronConfig, writeProjectConfig } = require('./electron-config');
const { runCmd, downloadFileWithProgress, pipStatusReporter, WIZARD_INSTALLABLE, checkVenvModule } = require('./install');

// Roadmap plan 10 — the "yuu-media" scheme must be registered as privileged
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
let mainWindow      = null;
let appPort         = BASE_PORT;
let wizardWin       = null;
let startupComplete = false;
let isQuitting      = false;

// In-flight model-download state, for the wizard's Cancel buttons.
let activeGgufController = null;  // AbortController for the .gguf download
let activePullReq       = null;  // http.ClientRequest for the Ollama pull
let pullCancelled       = false;

// ---------------------------------------------------------------------------
// Python discovery
// ---------------------------------------------------------------------------

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

function pollReady(port, attempts = 120, delayMs = 500) {
  const t0 = Date.now();
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < attempts; i++) {
      if (pyProc && pyProc.exitCode !== null) {
        logSetup(`Backend exited during startup (code ${pyProc.exitCode}) after ${i} poll attempts`);
        return reject(startupError(
          'yuu-clip started, but its engine stopped before it was ready.\n\n' +
          'This is usually a temporary hiccup — start yuu-clip again. If it keeps ' +
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
      'yuu-clip’s engine didn’t start in time.\n\n' +
      'Start yuu-clip again. If it keeps happening, open the log and send it to us.',
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
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const opts = {
    type: 'error', title: 'yuu-clip couldn’t start', message: userMessage,
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
  // Clean up any previous handlers first.
  for (const ch of ['setup:get-status', 'setup:pick-folder', 'setup:pick-file']) {
    try { ipcMain.removeHandler(ch); } catch (_) {}
  }
  ipcMain.removeAllListeners('setup:pull-model');
  ipcMain.removeAllListeners('setup:cancel-pull');
  ipcMain.removeAllListeners('setup:download-gguf-model');
  ipcMain.removeAllListeners('setup:cancel-gguf-download');
  ipcMain.removeAllListeners('setup:open-url');
  ipcMain.removeAllListeners('setup:install-package');
  ipcMain.removeAllListeners('setup:restart-app');

  ipcMain.handle('setup:get-status', async () => {
    refreshPathFromRegistry();
    const eCfg = loadElectronConfig();
    const pDir = eCfg.projectDir || DEFAULT_PROJECT_DIR;

    let projCfg = {};
    try { projCfg = JSON.parse(fs.readFileSync(path.join(pDir, '.yuu-clip', 'config.json'), 'utf8')); } catch (_) {}

    const ollamaModel   = projCfg.ollama_model || DEFAULT_OLLAMA_MODEL;
    const ffmpegOk      = checkFFmpeg();
    const gpu           = detectGPU();
    const cuda          = detectCUDA();
    const [ollamaRunning, llamacppInstalled, cudaLibsInstalled] = await Promise.all([
      checkOllama(),
      checkVenvModule(WIZARD_INSTALLABLE.llamacpp.importName),
      checkVenvModule(WIZARD_INSTALLABLE['cuda-libs'].importName),
    ]);
    const ollamaModelPulled = ollamaRunning ? await checkOllamaModel(ollamaModel) : false;

    const existingBackend   = projCfg.llm_backend;
    const existingModelPath = projCfg.llm_model_path || '';
    const defaultBackend    = existingBackend || 'llamacpp';

    logSetup(`Status check — FFmpeg:${ffmpegOk} GPU:${gpu.name} CUDA:${cuda.available} cudaLibs:${cudaLibsInstalled} Ollama:${ollamaRunning} Model:${ollamaModelPulled} llamacpp:${llamacppInstalled}`);
    return {
      ffmpegOk,
      ffmpegBundled: app.isPackaged,
      gpu, cuda,
      ollamaRunning, ollamaModel, ollamaModelPulled,
      llamacppInstalled, cudaLibsInstalled,
      recommendedWhisper: recommendWhisperModel(gpu.vramMB),
      whisperModel:  projCfg.whisper_model || '',
      projectDir: pDir,
      aiPrivacyMode: projCfg.ai_privacy_mode || 'local_only',
      llmBackend:    defaultBackend,
      llmModelPath:  existingModelPath,
      claudeApiKey:  projCfg.claude_api_key  || '',
      claudeModel:   projCfg.claude_model    || DEFAULT_CLAUDE_MODEL,
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

    // The LLM engine always installs from a prebuilt win_amd64 wheel — a CUDA
    // build for NVIDIA GPUs, else the CPU build — so an end user never triggers
    // a from-source compile (which needs MSVC/CMake and fails for nearly all of
    // them). Same import name either way, so checkVenvModule()'s presence check
    // is unaffected.
    let installArgs = ['install', '--progress-bar', 'raw', ...spec.packages];
    if (slug === 'llamacpp') {
      const wheelUrl = selectLlamaWheelUrl({
        cudaVersion: detectCUDA().version,
        gpuVendor:   detectGPU().vendor,
      });
      logSetup(`Installing llama-cpp-python from prebuilt wheel: ${wheelUrl}`);
      installArgs = ['install', '--progress-bar', 'raw', '--force-reinstall', wheelUrl];
    }

    logSetup(`Wizard install starting: ${installArgs.join(' ')}`);
    try {
      await runCmd(VENV_PIP, installArgs,
        pipStatusReporter(statusText => send({ status: statusText })));
      logSetup(`Wizard install complete: ${slug}`);
      send({ done: true });
    } catch (err) {
      const stderr = (err.stderr || '').trim();
      const tail   = stderr.split(/\r?\n/).filter(Boolean).slice(-3).join('\n');
      logSetup(`Wizard install failed: ${slug} — ${err.message}${tail ? '\n' + tail : ''}`);
      send({ error: describeInstallFailure(stderr) });
    }
  });

  // Stream a one-click .gguf model download for the llama.cpp backend, mirroring
  // the Ollama pull flow's progress pattern below.
  ipcMain.on('setup:download-gguf-model', (event) => {
    const send = (payload) => {
      try { event.sender.send('setup:gguf-download-progress', payload); } catch (_) {}
    };
    const shortfall = diskSpace.diskShortfallMessage(MODELS_DIR, DEFAULT_LLAMACPP_MODEL.sizeGb);
    if (shortfall) {
      logSetup(`GGUF model download blocked — ${shortfall}`);
      send({ error: shortfall });
      return;
    }
    const url = `${DEFAULT_LLAMACPP_MODEL.repoUrl}/resolve/main/${DEFAULT_LLAMACPP_MODEL.filename}`;
    const destPath = path.join(MODELS_DIR, DEFAULT_LLAMACPP_MODEL.filename);
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    logSetup(`GGUF model download starting: ${url}`);
    activeGgufController = new AbortController();
    downloadFileWithProgress(url, destPath, pct => send({ progress: pct }),
                             { signal: activeGgufController.signal })
      .then(() => {
        activeGgufController = null;
        logSetup(`GGUF model download complete: ${destPath}`);
        send({ done: true, path: destPath });
      })
      .catch(err => {
        activeGgufController = null;
        if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) return; // cancel event already sent
        logSetup(`GGUF model download failed: ${err.message}`);
        send({ error: err.message });
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
  // Restore flow. Exit code 2 means "folder already has a project" — offer to
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
        detail: result.error || 'Check that the file is a yuu-clip backup.',
        buttons: ['OK'],
      });
    }
    return result;
  });

  ipcMain.on('setup:open-url', (_, url) => shell.openExternal(url));

  ipcMain.on('setup:copy-text', (_, text) => clipboard.writeText(String(text || '')));

  // Stream an Ollama model pull back to the wizard as progress events.
  ipcMain.on('setup:pull-model', (event, modelName) => {
    const ollamaStore = process.env.OLLAMA_MODELS
      || path.join(process.env.USERPROFILE, '.ollama', 'models');
    const shortfall = diskSpace.diskShortfallMessage(ollamaStore, DEFAULT_OLLAMA_MODEL_SIZE_GB);
    if (shortfall) {
      logSetup(`Ollama model pull blocked — ${shortfall}`);
      event.sender.send('setup:pull-progress', { status: 'error', error: shortfall });
      return;
    }
    logSetup(`Ollama model pull starting: ${modelName}`);
    pullCancelled = false;
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
      res.on('end', () => {
        activePullReq = null;
        if (!pullCancelled) event.sender.send('setup:pull-progress', { status: 'success' });
      });
    });
    activePullReq = req;
    req.on('error', err => {
      activePullReq = null;
      if (pullCancelled) return; // cancel event already sent
      logSetup(`Ollama model pull failed: ${modelName} — ${err.message}`);
      event.sender.send('setup:pull-progress', { status: 'error', error: err.message });
    });
    req.write(JSON.stringify({ name: modelName }));
    req.end();
  });

  // Cancels an in-flight pull. Destroying the request disconnects the client;
  // the Ollama daemon aborts the pull when its client goes away.
  ipcMain.on('setup:cancel-pull', (event) => {
    if (!activePullReq) return;
    pullCancelled = true;
    logSetup('Ollama model pull cancelled by user');
    activePullReq.destroy();
    activePullReq = null;
    event.sender.send('setup:pull-progress', { status: 'cancelled' });
  });
}

// Swap the wizard window to a "Starting yuu-clip…" screen while the backend
// boots; app lifecycle closes it once the main window is ready.
function showWizardLoadingScreen(win) {
  const loadingHtml = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#12121e;color:#d8d8e8;text-align:center"><style>@keyframes spin{to{transform:rotate(360deg)}}</style><div><div style="width:32px;height:32px;border:3px solid #1e1e30;border-top-color:#5b8ef0;border-radius:50%;animation:spin 0.65s linear infinite;margin:0 auto 14px"></div><h3 style="margin:0 0 6px;font-size:14px;color:#e8e8f8">Starting yuu-clip…</h3><p id="status" style="margin:0;color:#9090a8;font-size:12px">Waiting for backend</p></div></body></html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml)}`);
  wizardWin = win;
}

// Updates the "Starting yuu-clip…" loading screen's status line from the main
// process. No preload/IPC needed for one line of text — executeJavaScript is
// simpler than wiring a context-bridged channel just for this.
function updateLoadingStatus(win, text) {
  if (!win || win.isDestroyed()) return;
  const statusJs = `var el = document.getElementById('status'); if (el) el.textContent = ${JSON.stringify(text)};`;
  win.webContents.executeJavaScript(statusJs).catch(() => {});
}

// Approx on-disk download sizes, mirroring the wizard's whisper-sel option
// labels, so the one-time prefetch tells the user how long to expect to wait.
const WHISPER_MODEL_SIZES = {
  tiny: '~75 MB', base: '~145 MB', small: '~465 MB',
  medium: '~1.5 GB', 'large-v3': '~3 GB',
};

// Best-effort pre-download of the Whisper model chosen in setup, so first
// Analyze doesn't stall on a surprise multi-GB download. Reuses the exact
// download path production transcription already takes (see
// yuu_clip/transcribe/whisper_runner.py _load_whisper_model) rather than
// re-deriving the HuggingFace repo id ourselves. Failure is logged and
// swallowed — analyze-time already has a clear retry message if this didn't
// warm the cache (see _model_load_error in whisper_runner.py).
async function prefetchWhisperModel(modelName, win) {
  const size = WHISPER_MODEL_SIZES[modelName];
  const sizeNote = size ? `, ${size} — one-time` : ' — one-time';
  updateLoadingStatus(win, `Downloading the speech-to-text model (${modelName}${sizeNote})…`);
  logSetup(`Pre-fetching Whisper model: ${modelName}`);
  const code =
    'from faster_whisper import WhisperModel\n' +
    `WhisperModel(${JSON.stringify(modelName)}, device="cpu", compute_type="int8")\n`;
  try {
    await runCmd(VENV_PYTHON, ['-c', code]);
    logSetup(`Whisper model pre-fetch complete: ${modelName}`);
  } catch (err) {
    logSetup(`Whisper model pre-fetch failed (non-fatal, will retry on first Analyze): ${modelName} — ${err.message}`);
  }
  updateLoadingStatus(win, 'Waiting for backend');
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
      // A restored project already carries its own config.json — writing the
      // wizard defaults over it would wipe the user's saved settings.
      if (cfg.restored) {
        logSetup(`Setup complete via restore — projectDir:${cfg.projectDir} (kept restored settings)`);
      } else {
        const pyCfg = buildProjectConfigFromWizard(cfg, {
          defaultClaudeModel: DEFAULT_CLAUDE_MODEL,
          defaultOllamaModel: DEFAULT_OLLAMA_MODEL,
        });
        writeProjectConfig(cfg.projectDir, pyCfg);
        logSetup(`Setup complete — projectDir:${cfg.projectDir} whisperModel:${cfg.whisperModel} llmBackend:${cfg.llmBackend} diarization:${pyCfg.diarization_backend}`);
      }
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
    .steps li{font-size:12px;color:#87879f;padding:2px 0;padding-left:18px;position:relative}
    .steps li.done{color:#4caf7d}
    .steps li.active{color:#d0d0e0}
    .steps li::before{content:'·';position:absolute;left:4px}
    .steps li.done::before{content:'✓';color:#4caf7d}
    .steps li.active::before{content:'›';color:#5b8ef0}
    .status{font-size:11px;color:#5b8ef0;margin-top:14px;min-height:14px;padding:0 16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .note{font-size:11px;color:#87879f;margin-top:4px}
  </style></head><body><div>
    <div class="spin"></div>
    <h3>Setting up yuu-clip</h3>
    <ul class="steps" id="steps">
      <li id="s0">Create virtual environment</li>
      <li id="s1">Install yuu-clip</li>
    </ul>
    <div class="status" id="status"></div>
    <div class="note">This can take a few minutes — please don't close this window.</div>
  </div><script>
    if(window.venvAPI) window.venvAPI.onProgress(function(msg){
      var steps=['s0','s1'];
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
    if (app.isPackaged) {
      await dialog.showMessageBox({
        type: 'error', title: 'yuu-clip installation is damaged',
        message:
          'The Python runtime bundled with yuu-clip is missing or damaged.\n\n' +
          'Try reinstalling yuu-clip. If the problem persists, please report it.',
        buttons: ['Quit'], defaultId: 0,
      });
    } else {
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
    }
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
    }
    progress('s1', 'active');
    logSetup('Installing wheel…');
    const lockPath = path.join(resourcesDir, 'requirements.lock');
    const lockOk   = fs.existsSync(lockPath);
    const wheelhouseDir = path.join(resourcesDir, 'wheelhouse');
    const wheelhouseOk  = fs.existsSync(wheelhouseDir)
      && fs.readdirSync(wheelhouseDir).some(f => f.endsWith('.whl'));
    logSetup(wheelhouseOk
      ? `Installing offline from bundled wheelhouse: ${wheelhouseDir}`
      : 'Wheelhouse not bundled — installing base deps from PyPI (online)');
    logSetup(lockOk ? `Constraining deps to ${lockPath}`
                    : 'requirements.lock not bundled — installing without a constraint');
    await runCmd(
      VENV_PIP,
      buildWheelInstallArgs(wheelPath, lockOk ? lockPath : null, wheelhouseOk ? wheelhouseDir : null),
      pipStatusReporter(statusText => {
        try { setupWin.webContents.send('venv:status', statusText); } catch (_) {}
      })
    );
    logSetup('Ensuring a single OpenCV build (contrib superset wins)…');
    await runCmd(
      VENV_PIP,
      buildOpencvDedupeArgs(lockOk ? lockPath : null, wheelhouseOk ? wheelhouseDir : null),
      pipStatusReporter(statusText => {
        try { setupWin.webContents.send('venv:status', statusText); } catch (_) {}
      })
    );
    progress('s1', 'done');
    logSetup('Wheel installed');
    if (bundledVersion) fs.writeFileSync(WHEEL_MARKER, bundledVersion);
  } catch (err) {
    const detail = [err.stderr, err.stdout].filter(Boolean).join('\n');
    logSetup(`Venv setup failed: ${err.message}${detail ? '\n' + detail : ''}`);
    const wrapped = new Error(err.message);
    wrapped.userMessage =
      'yuu-clip couldn’t finish setting itself up — ' + describeInstallFailure(detail);
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

// Run the Python restore CLI once and resolve to a plain result object
// (see restore-backup.js parseRestoreExit). Never rejects — the wizard shows the
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
  // relying on an inherited PATH — YUU_CLIP_FFMPEG_DIR set-but-broken raises a
  // loud error in find_ffmpeg() instead of silently falling back to PATH, so a
  // packaging bug surfaces immediately (see yuu_clip/config.py find_ffmpeg()).
  const env = { ...process.env };
  if (app.isPackaged) env.YUU_CLIP_FFMPEG_DIR = BUNDLED_FFMPEG_DIR;

  logSetup(`Spawning backend: ${VENV_PYTHON} ${args.join(' ')}`);
  pyProc = spawn(VENV_PYTHON, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env,
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
      'yuu-clip’s engine stopped unexpectedly.\n\n' +
      'Start yuu-clip again. If it keeps happening, open the log and send it to us.',
      projectLog,
    ).then(() => { if (!isQuitting) app.quit(); });
  });
}

// ---------------------------------------------------------------------------
// Native media protocol (roadmap plan 10) — serves the recording source/proxy
// files directly from disk instead of proxying every byte through the Python
// HTTP server. Startup-latency win only; seeking already works fine over HTTP
// via the 720p proxy, so this is intentionally low-stakes and surgical.
//
// Electron's protocol.handle() + net.fetch(pathToFileURL(...)) is the
// documented pattern for this, but Range-request/video-seeking support on top
// of it has been an unresolved Electron bug (electron/electron#38749) across
// every version from 25 through at least 35 — still open as of our pinned
// 33.2.1 (electron/package.json). Range handling is therefore done manually
// here (parse header, fs.createReadStream(start, end), 206 + Content-Range)
// rather than trusting net.fetch to cover it.
// ---------------------------------------------------------------------------

// Renderer input is untrusted: a path is only served if it's inside the
// project's proxies dir (deterministic, always true for generated proxies) or
// it exactly matches a source/proxy path the backend has told us about for a
// known video. Source recordings live wherever the creator originally pointed
// `analyze` at — often outside the project dir entirely — so an allowed-*root*
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
    // Backend not reachable (e.g. still starting) — leave the cache as-is.
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
      logSetup(`yuu-media: malformed request URL ${request.url} — ${err.message}`);
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

  registerProjectIPC();
  buildMenu();
}

// Project switcher (roadmap plan 03): the Python server swaps projects in place,
// but main.js keeps its own projectDir for media-proxy serving and for the next
// launch, so the renderer notifies us after a successful switch. We also provide
// the native folder picker the renderer's "Open another project…" dialog uses.
function registerProjectIPC() {
  try { ipcMain.removeHandler('project:pick-folder'); } catch (_) {}
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
  registerMediaProtocol();

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
    const { show: showWizard, mode: setupMode } = decideSetupMode({
      firstRun, ffmpegOk, storedSchema, schemaVersion: SETUP_SCHEMA_VERSION,
    });

    if (showWizard) {
      if (setupOutdated) logSetup(`Setup schema ${storedSchema} < ${SETUP_SCHEMA_VERSION} — showing wizard with new options`);
      const cfg = await showSetupWizard({ rerun: false, updated: setupMode === 'update' });
      projectDir = cfg.projectDir;
      if (cfg.whisperModel) await prefetchWhisperModel(cfg.whisperModel, wizardWin);
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
      logSetup(`Startup error: ${err.stack || err.message}`);
      const userMessage = err.userMessage ||
        'yuu-clip ran into a problem while starting up.\n\n' +
        'Start yuu-clip again. If it keeps happening, open the log and send it to us.';
      await showFatalDialog(userMessage, err.logPath || SETUP_LOG);
    }
    if (!isQuitting) app.quit();
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
