// static/settings/settings-backup.js - the backup download and the restore
// review-before-commit flow. Covers the request/response handling that fetch mocks
// can exercise browserless; the native file-picker and download-link click stay
// implicitly covered by tests/ui/test_ui_backup.py.
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showConfirm: vi.fn() };
});

import { showToast } from '../../../yuu_clip/web/static/core/utils.js';
import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import {
  backupProject, startRestore, initSettingsBackupListeners,
} from '../../../yuu_clip/web/static/settings/settings-backup.js';

const okJson = (body = {}) => Promise.resolve({ ok: true, json: async () => body });
const errJson = (body = {}) => Promise.resolve({ ok: false, json: async () => body });

// Fakes a fetch Response whose body streams the given typed SSE payloads, one
// chunk per event - matches jobs.js's _openSSE reader shape (see the identical
// helper in tests/js/core/jobs.test.js's "streamSSE outcome passthrough" block).
function sseResponse(payloads) {
  const encoder = new TextEncoder();
  const chunks = payloads.map((p) => encoder.encode(`data: ${JSON.stringify(p)}\n\n`));
  let i = 0;
  return {
    ok: true,
    body: { getReader: () => ({ read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }) },
  };
}

const BACKUP_RESULT_AND_DONE = [
  { v: 1, type: 'result', data: { token: 'tok-1', filename: 'my-backup.zip' } },
  { v: 1, type: 'done', outcome: 'ok' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('backupProject', () => {
  it('streams progress, then downloads the archive the result event points to', async () => {
    const headers = new Map([['content-disposition', 'attachment; filename="my-backup.zip"']]);
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url) === '/api/backup/events') return Promise.resolve(sseResponse(BACKUP_RESULT_AND_DONE));
      if (String(url) === '/api/backup/download/tok-1') return Promise.resolve({
        ok: true,
        headers: { get: (k) => headers.get(k.toLowerCase()) || null },
        blob: async () => new Blob(['zip bytes']),
      });
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }));
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    backupProject();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('Backup saved', 'success'));

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    clickSpy.mockRestore();
  });

  it('shows the server error when the follow-up download fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url) === '/api/backup/events') return Promise.resolve(sseResponse(BACKUP_RESULT_AND_DONE));
      if (String(url) === '/api/backup/download/tok-1') return errJson({ detail: 'Disk full' });
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }));

    backupProject();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('Disk full', 'error'));
  });

  it('shows a network error and re-enables the button when the events stream fails to open', async () => {
    const btn = document.getElementById('btn-backup-project');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));

    backupProject();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('offline', 'error'));
    expect(btn.disabled).toBe(false);
  });
});

describe('restore flow', () => {
  function chooseFile(payload) {
    const flow = document.getElementById('restore-flow');
    const file = { arrayBuffer: async () => new Uint8Array([1, 2, 3]) };
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url) === '/api/restore/inspect') return okJson(payload);
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }));
    return { flow, file };
  }

  it('startRestore clears any previous selection and opens the native file picker', () => {
    // A file input's value can only ever be programmatically reset to '' (browser
    // security restriction, enforced by happy-dom too) - the meaningful behavior to
    // pin is that startRestore clears it before opening the picker, not a round-trip
    // from a prior non-empty value.
    const input = document.getElementById('restore-file-input');
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});

    startRestore();

    expect(input.value).toBe('');
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('renders the restore plan with a repoint row for each missing folder', async () => {
    const { flow, file } = chooseFile({
      staging_path: '/tmp/staged.zip',
      manifest: { project_name: 'My Project', created_at: '2026-07-01T00:00:00Z' },
      groups: [{ missing_dir: 'D:\\OldVideos', file_count: 3, sample_filenames: ['a.mkv'] }],
    });

    // _onRestoreFileChosen is not exported - exercise it through the wired file input.
    const input = document.getElementById('restore-file-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    initSettingsBackupListeners();
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(flow.textContent).toContain('My Project'));
    expect(flow.textContent).toContain('D:\\OldVideos');
    expect(flow.textContent).toContain('3 files');
    expect(document.getElementById('btn-restore-confirm')).not.toBe(null);
  });

  it('shows an error and hides the flow for an invalid backup file', async () => {
    const { flow, file } = chooseFile();
    vi.stubGlobal('fetch', vi.fn(() => errJson({ detail: 'Not a valid backup' })));

    const input = document.getElementById('restore-file-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    initSettingsBackupListeners();
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('Not a valid backup', 'error'));
    expect(flow.style.display).toBe('none');
  });

  it('applying without a target folder shows an error and makes no request', async () => {
    const { file } = chooseFile({
      staging_path: '/tmp/staged.zip', manifest: { project_name: 'P' }, groups: [],
    });
    const input = document.getElementById('restore-file-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    initSettingsBackupListeners();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.getElementById('btn-restore-confirm')).not.toBe(null));

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    document.getElementById('restore-target').value = '   ';
    document.getElementById('btn-restore-confirm').click();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('Choose a folder to restore into', 'error'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applying strips quoted paths and posts the repoint mapping', async () => {
    const { file } = chooseFile({
      staging_path: '/tmp/staged.zip',
      manifest: { project_name: 'P' },
      groups: [{ missing_dir: 'D:\\OldVideos', file_count: 1, sample_filenames: [] }],
    });
    const input = document.getElementById('restore-file-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    initSettingsBackupListeners();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.getElementById('repoint-0')).not.toBe(null));

    document.getElementById('restore-target').value = '"D:\\New Project"';
    document.getElementById('repoint-0').value = '"D:\\NewVideos"';
    const fetchMock = vi.fn(() => okJson({ current: 'D:\\New Project', repoint: { still_missing: 0 } }));
    vi.stubGlobal('fetch', fetchMock);

    document.getElementById('btn-restore-confirm').click();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/restore/apply');
    expect(JSON.parse(opts.body)).toEqual({
      archive_path: '/tmp/staged.zip',
      target_dir: 'D:\\New Project',
      mapping: { 'D:\\OldVideos': 'D:\\NewVideos' },
      overwrite: false,
    });
  });

  it('offers to replace an existing project on a 409 project_exists conflict', async () => {
    const { file } = chooseFile({
      staging_path: '/tmp/staged.zip', manifest: { project_name: 'P' }, groups: [],
    });
    const input = document.getElementById('restore-file-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    initSettingsBackupListeners();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.getElementById('restore-target')).not.toBe(null));

    document.getElementById('restore-target').value = 'D:\\Existing';
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      status: 409,
      ok: false,
      json: async () => ({ detail: { code: 'project_exists' } }),
    })));

    document.getElementById('btn-restore-confirm').click();
    await vi.waitFor(() => expect(showConfirm).toHaveBeenCalled());

    expect(showConfirm.mock.calls[0][0]).toBe('Replace the existing project?');
  });
});
