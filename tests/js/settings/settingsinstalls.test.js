// static/settings/settings-installs.js - the CUDA-libs install/remove pair (B10).
//
// installPackage already existed; uninstallPackage is new (POST /api/install/{slug}/uninstall,
// same POST + SSE-progress shape, the inverse pip operation). Covers: success/failure for
// both directions, and that _refreshInstallStatus toggles the Remove button's visibility
// to match the reported installed state.
import {
  _refreshInstallStatus, installPackage, uninstallPackage,
} from '../../../yuu_clip/web/static/settings/settings-installs.js';

const okJson = (obj) => ({ ok: true, json: async () => obj });

// A fetch Response whose body streams the given SSE payloads, then ends.
function sseResponse(payloads) {
  const encoder = new TextEncoder();
  const chunks = payloads.map((p) => encoder.encode(`data: ${JSON.stringify(p)}\n\n`));
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: chunks[i++] } : { done: true },
      }),
    },
  };
}

const SUCCESS_DONE = { v: 1, type: 'done', outcome: 'ok' };
const FAILURE_DONE = { v: 1, type: 'done', outcome: 'error', error: 'pip exited with code 1' };

function elements() {
  return {
    installBtn: document.getElementById('btn-install-cuda-libs'),
    uninstallBtn: document.getElementById('btn-uninstall-cuda-libs'),
    status: document.getElementById('install-status-cuda-libs'),
    log: document.getElementById('install-log-cuda-libs'),
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('installPackage', () => {
  it('on success: shows Installed, flips the label to Reinstall, and reveals Remove', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([SUCCESS_DONE]));

    await installPackage('cuda-libs');

    const { installBtn, uninstallBtn, status } = elements();
    expect(status.textContent).toBe('✓ Installed');
    expect(installBtn.textContent).toBe('Reinstall');
    expect(installBtn.disabled).toBe(false);
    expect(uninstallBtn.style.display).not.toBe('none');
  });

  it('on a failed pip install: reports the failure and leaves Remove hidden', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([FAILURE_DONE]));

    await installPackage('cuda-libs');

    const { installBtn, uninstallBtn, status } = elements();
    expect(status.textContent).toBe('✗ Failed - check log above');
    expect(installBtn.textContent).toBe('Retry');
    expect(uninstallBtn.style.display).toBe('none');
  });
});

describe('uninstallPackage', () => {
  it('on success: shows Removed, flips the install label back to Install, and hides Remove', async () => {
    const { uninstallBtn } = elements();
    uninstallBtn.style.display = '';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([SUCCESS_DONE]));

    await uninstallPackage('cuda-libs');

    const { installBtn, status } = elements();
    expect(status.textContent).toBe('Removed');
    expect(installBtn.textContent).toBe('Install');
    expect(installBtn.disabled).toBe(false);
    expect(uninstallBtn.style.display).toBe('none');
  });

  it('on a failed pip uninstall: reports the failure and keeps Remove visible', async () => {
    const { uninstallBtn } = elements();
    uninstallBtn.style.display = '';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([FAILURE_DONE]));

    await uninstallPackage('cuda-libs');

    const { status } = elements();
    expect(status.textContent).toBe('✗ Remove failed - check log above');
    expect(uninstallBtn.textContent).toBe('Remove');
    expect(uninstallBtn.disabled).toBe(false);
    expect(uninstallBtn.style.display).not.toBe('none');
  });
});

describe('_refreshInstallStatus', () => {
  it('reveals Remove when the package reports installed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ installed: true }));

    await _refreshInstallStatus('cuda-libs');

    const { installBtn, uninstallBtn, status } = elements();
    expect(status.textContent).toBe('✓ Installed');
    expect(installBtn.textContent).toBe('Reinstall');
    expect(uninstallBtn.style.display).not.toBe('none');
  });

  it('keeps Remove hidden when the package reports not installed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okJson({ installed: false }));

    await _refreshInstallStatus('cuda-libs');

    const { uninstallBtn } = elements();
    expect(uninstallBtn.style.display).toBe('none');
  });
});
