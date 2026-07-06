(function () {
// Feature-map — Settings optional-package install controls + remote-LLM badge.
//   API: routes/install.py · Tests: tests/test_ui_settings.py
// ── optional-package installs (hardware / model dependencies) ────────────────
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
      status.style.color = 'var(--green, #22c55e)';
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
          status.style.color = 'var(--green, #22c55e)';
          btn.textContent = 'Reinstall';
          btn.disabled = false;
          if (slug === 'pyannote' || slug === 'speechbrain') _updateDiarizationStatus();
          return;
        }
        log.textContent += msg + '\n';
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch (e) {
    status.textContent = '✗ Failed — check log above';
    status.style.color = 'var(--red, #ef4444)';
  }
  btn.textContent = 'Retry';
  btn.disabled = false;
}

function _updateLlmRemoteIndicator(backend, llmEnabled) {
  const badge = document.getElementById('llm-remote-badge');
  const remoteActive = llmEnabled && backend === 'claude' && _currentPrivacyMode() === 'remote_ok';
  if (badge) badge.style.display = remoteActive ? '' : 'none';
}

// Public API — installPackage is wired to inline install-button handlers in
// index.html; _refreshInstallStatus is called from settings.js's
// _applySettingsToUI; _updateLlmRemoteIndicator from settings.js save + boot.js.
// _updateDiarizationStatus and _currentPrivacyMode resolve through window
// (owned by settings.js core) at call time.
Object.assign(window, {
  _refreshInstallStatus, installPackage, _updateLlmRemoteIndicator,
});
})();
