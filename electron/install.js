'use strict';

// Install-side plumbing for the desktop wrapper, split out of main.js: the async
// command runner, the streaming binary downloader for GGUF models, pip-output
// condensing, and the wizard's optional-package catalog + venv presence check.
// Pure logic - no Electron, no shared main.js state - so main.js drives these
// while owning the download-cancel controllers and the setup UI.

const { spawn } = require('child_process');
const fs        = require('fs');
const https     = require('https');
const { VENV_PYTHON } = require('./constants');

// Async command runner - keeps the event loop free during long pip installs.
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

// Streams a large binary download (GGUF model files) to disk with percentage
// progress. Unlike the pip installs elsewhere, there's no package manager doing
// this for us, so redirects, progress accounting, and a truncated-download check
// are handled by hand. Writes to a `.part` sibling and renames on success, so a
// half-finished download can never be mistaken for a complete model file.
// `opts.signal` (an AbortSignal) makes the download cancellable - aborting fires
// an ABORT_ERR on the request, and the .part file is removed so a cancelled
// download never leaves a stray file behind.
function downloadFileWithProgress(url, destPath, onProgress, opts = {}) {
  const { signal, redirectsLeft = 5 } = opts;
  return new Promise((resolve, reject) => {
    const tmpPath = `${destPath}.part`;
    const cleanupAndReject = (err) => { fs.unlink(tmpPath, () => {}); reject(err); };
    const req = https.get(url, { headers: { 'User-Agent': 'yuu-clip' }, signal }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) { reject(new Error('Too many redirects')); return; }
        downloadFileWithProgress(res.headers.location, destPath, onProgress,
                                 { signal, redirectsLeft: redirectsLeft - 1 }).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const fileStream = fs.createWriteStream(tmpPath);
      res.on('data', chunk => {
        received += chunk.length;
        if (total > 0) onProgress(Math.round((received / total) * 100));
      });
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        if (total > 0 && received !== total) {
          cleanupAndReject(new Error(`Downloaded size (${received}) doesn't match expected (${total}) - try again`));
          return;
        }
        fs.rename(tmpPath, destPath, err => (err ? reject(err) : resolve()));
      });
      fileStream.on('error', cleanupAndReject);
      res.on('error', cleanupAndReject);
    });
    req.on('error', cleanupAndReject);
  });
}

// Wraps an onStatus callback so a pip run only reports each condensed status
// line once (raw pip repeats download-progress lines many times per second).
function pipStatusReporter(onStatus) {
  let lastStatus = '';
  return line => {
    const statusText = formatPipLine(line);
    if (statusText && statusText !== lastStatus) {
      lastStatus = statusText;
      onStatus(statusText);
    }
  };
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

// Optional packages the wizard can install into the venv. The backend exposes
// the same installs via /api/install/{slug}, but it isn't running yet during
// first-run setup, so the wizard drives pip directly.
const WIZARD_INSTALLABLE = {
  llamacpp:    { packages: ['llama-cpp-python'], importName: 'llama_cpp' },
  // Both wheels install together, so nvidia.cublas is a sufficient presence proxy.
  'cuda-libs': { packages: ['nvidia-cublas-cu12', 'nvidia-cudnn-cu12'], importName: 'nvidia.cublas' },
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

module.exports = {
  runCmd,
  downloadFileWithProgress,
  pipStatusReporter,
  formatPipLine,
  WIZARD_INSTALLABLE,
  checkVenvModule,
};
