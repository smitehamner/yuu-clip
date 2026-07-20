// Feature-map - Settings optional-package install controls.
//   API: routes/analyze.py (install status/POST/uninstall) · Tests: tests/ui/test_ui_settings.py
import { isDoneSentinel, doneError } from '../core/jobs.js';

// ── optional-package installs ────────────────────────────────────────────────
// Only one install action remains (packaging-strategy overhaul, Wave 3): the CUDA
// libraries for GPU-accelerated transcription. Everything else the app needs is
// bundled by default - see the Capabilities overview (_renderCapabilityTiers) for
// their Ready / "fetches on first use" status. SpeechBrain still gets a read-only
// status check (no install action) because the analyze/export panels gate the
// speaker-labels checkbox on it.

function _setUninstallVisible(slug, visible) {
  const uninstallBtn = document.getElementById(`btn-uninstall-${slug}`);
  if (uninstallBtn) uninstallBtn.style.display = visible ? '' : 'none';
}

async function _refreshInstallStatus(slug) {
  const btn    = document.getElementById(`btn-install-${slug}`);
  const status = document.getElementById(`install-status-${slug}`);
  if (!btn || !status) return;
  try {
    const resp = await fetch(`/api/install/${slug}`);
    if (!resp.ok) return;
    const { installed } = await resp.json();
    if (installed) {
      status.textContent = '✓ Installed';
      status.style.color = 'var(--green)';
      btn.textContent = 'Reinstall';
    }
    _setUninstallVisible(slug, installed);
  } catch { /* leave default "Install" label on network error */ }
}

// One config per direction - install and uninstall share the same POST + SSE
// progress shape (routes/analyze.py's install_package / uninstall_package), just
// the inverse pip operation and end-state labels.
function _opConfig(op) {
  return op === 'install'
    ? {
        url: slug => `/api/install/${slug}`,
        busyLabel: 'Installing…', doneLabel: 'Reinstall',
        doneStatus: '✓ Installed', doneColor: 'var(--green)',
        failStatus: '✗ Failed - check log above', failLabel: 'Retry',
      }
    : {
        url: slug => `/api/install/${slug}/uninstall`,
        busyLabel: 'Removing…', doneLabel: 'Install',
        doneStatus: 'Removed', doneColor: 'var(--muted)',
        failStatus: '✗ Remove failed - check log above', failLabel: 'Remove',
      };
}

async function _streamPackageOp(slug, op, { installBtn, status, log }) {
  const cfg = _opConfig(op);
  const resp = await fetch(cfg.url(slug), { method: 'POST' });
  if (!resp.ok) { throw new Error(await resp.text()); }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const msg = JSON.parse(line.slice(6));
      if (isDoneSentinel(msg)) {
        // A failed pip op exits non-zero: fall through to the caller's failure
        // status rather than reporting success.
        if (doneError(msg)) throw new Error(doneError(msg));
        status.textContent = cfg.doneStatus;
        status.style.color = cfg.doneColor;
        installBtn.textContent = cfg.doneLabel;
        _setUninstallVisible(slug, op === 'install');
        return;
      }
      log.textContent += msg + '\n';
      log.scrollTop = log.scrollHeight;
    }
  }
}

async function _runPackageOp(slug, op) {
  const installBtn   = document.getElementById(`btn-install-${slug}`);
  const uninstallBtn = document.getElementById(`btn-uninstall-${slug}`);
  const actingBtn = op === 'install' ? installBtn : uninstallBtn;
  const status = document.getElementById(`install-status-${slug}`);
  const log    = document.getElementById(`install-log-${slug}`);
  if (!actingBtn || !status || !log) return;

  const cfg = _opConfig(op);
  installBtn.disabled = true;
  if (uninstallBtn) uninstallBtn.disabled = true;
  actingBtn.textContent = cfg.busyLabel;
  status.textContent = '';
  log.textContent = '';
  log.style.display = 'block';
  try {
    await _streamPackageOp(slug, op, { installBtn, status, log });
    installBtn.disabled = false;
    if (uninstallBtn) uninstallBtn.disabled = false;
    return;
  } catch (e) {
    status.textContent = cfg.failStatus;
    status.style.color = 'var(--red)';
  }
  actingBtn.textContent = cfg.failLabel;
  installBtn.disabled = false;
  if (uninstallBtn) uninstallBtn.disabled = false;
}

async function installPackage(slug) { return _runPackageOp(slug, 'install'); }
async function uninstallPackage(slug) { return _runPackageOp(slug, 'uninstall'); }

// ── static index.html handlers this module owns (wired once at load) ───────────
// The CUDA-libs install/remove buttons are fixed, never-recreated elements in
// index.html, so a single load-time listener can't double-fire on a re-render.
function _wireStaticHandlers() {
  document.getElementById('btn-install-cuda-libs')
    ?.addEventListener('click', () => installPackage('cuda-libs'));
  document.getElementById('btn-uninstall-cuda-libs')
    ?.addEventListener('click', () => uninstallPackage('cuda-libs'));
}

_wireStaticHandlers();

export { _refreshInstallStatus, installPackage, uninstallPackage };
