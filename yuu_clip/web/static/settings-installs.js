// Feature-map - Settings optional-package install controls.
//   API: routes/analyze.py (install status/POST) · Tests: tests/ui/test_ui_settings.py
// ── optional-package installs ────────────────────────────────────────────────
// Only two install actions remain (packaging-strategy overhaul, Wave 3): Pyannote
// (the advanced, token-gated alternative to the default SpeechBrain speaker-labels
// backend) and the CUDA libraries for GPU-accelerated transcription. Everything
// else the app needs is bundled by default - see the Capabilities overview
// (_renderCapabilityTiers) for their Ready / "fetches on first use" status.
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
  } catch { /* leave default "Install" label on network error */ }
}

async function installPackage(slug) {
  const btn    = document.getElementById(`btn-install-${slug}`);
  const status = document.getElementById(`install-status-${slug}`);
  const log    = document.getElementById(`install-log-${slug}`);
  btn.disabled = true;
  btn.textContent = 'Installing…';
  status.textContent = '';
  log.textContent = '';
  log.style.display = 'block';
  try {
    const resp = await fetch(`/api/install/${slug}`, { method: 'POST' });
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
        if (msg === '__DONE__') {
          status.textContent = '✓ Installed';
          status.style.color = 'var(--green)';
          btn.textContent = 'Reinstall';
          btn.disabled = false;
          return;
        }
        log.textContent += msg + '\n';
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch (e) {
    status.textContent = '✗ Failed - check log above';
    status.style.color = 'var(--red)';
  }
  btn.textContent = 'Retry';
  btn.disabled = false;
}

// ── static index.html handler this module owns (wired once at load) ───────────
// The CUDA-libs install button is a fixed, never-recreated element in index.html,
// so a single load-time listener can't double-fire on a re-render.
function _wireStaticHandlers() {
  document.getElementById('btn-install-cuda-libs')
    ?.addEventListener('click', () => installPackage('cuda-libs'));
}

_wireStaticHandlers();

export { _refreshInstallStatus, installPackage };
