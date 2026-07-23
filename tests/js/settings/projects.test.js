// Project switcher (static/settings/projects.js) - the switch/confirm flows and the
// display-name basename logic. This module was converted off window.* globals to real
// ESM imports (showToast from utils.js, stripQuotedPath from format.js) during the
// shim-drain arc; these tests exercise the REAL code paths that call those imports, so
// a dropped import would surface here rather than only in a live browser. The
// menu-open/close/focus DOM wiring stays in tests/ui/test_ui_projects.py.
//
// Mocks only the toast seam; stripQuotedPath (format.js) is kept real so the confirm
// flow's quote-stripping is genuinely wired, not simulated.
import { showToast } from '../../../yuu_clip/web/static/core/utils.js';
import {
  _openProjectConfirm, switchProject, initProjectSwitcher,
} from '../../../yuu_clip/web/static/settings/projects.js';

vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});

const okJson = (obj) => ({ ok: true, json: async () => obj });
const errJson = (obj) => ({ ok: false, json: async () => obj });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('switchProject', () => {
  it('POSTs the target path to the switch endpoint and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ current: 'D:\\Videos\\proj' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await switchProject('D:\\Videos\\proj');

    expect(result).toBe(true);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/projects/switch');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ path: 'D:\\Videos\\proj' });
  });

  it('surfaces the server rejection detail as an error toast and reports failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errJson({ detail: 'Folder not found' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await switchProject('D:\\gone');

    expect(result).toBe(false);
    expect(showToast).toHaveBeenCalledWith('Folder not found', 'error');
  });

  it('reports failure with a generic error toast when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await switchProject('D:\\any');

    expect(result).toBe(false);
    expect(showToast).toHaveBeenCalledWith('Could not switch project', 'error');
  });
});

describe('_openProjectConfirm', () => {
  const setPath = (raw) => { document.getElementById('open-project-path').value = raw; };

  it('strips surrounding quotes off the entered path before switching', async () => {
    setPath('"D:\\Videos\\My Session"');
    const fetchMock = vi.fn().mockResolvedValue(okJson({ current: 'x' }));
    vi.stubGlobal('fetch', fetchMock);

    _openProjectConfirm();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ path: 'D:\\Videos\\My Session' });
  });

  it('rejects an empty path with an error toast and makes no request', () => {
    setPath('   ');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    _openProjectConfirm();

    expect(showToast).toHaveBeenCalledWith('Enter a project folder path', 'error');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('initProjectSwitcher display name', () => {
  it('shows the Windows folder basename as the current project name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      okJson({ current: 'D:\\Videos\\My Session', known: [] }),
    ));

    await initProjectSwitcher();

    expect(document.getElementById('project-current-name').textContent).toBe('My Session');
    expect(document.getElementById('btn-project-switcher').title).toBe('Current project: D:\\Videos\\My Session');
  });

  it('shows the POSIX folder basename as the current project name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      okJson({ current: '/home/user/videos/proj2', known: [] }),
    ));

    await initProjectSwitcher();

    expect(document.getElementById('project-current-name').textContent).toBe('proj2');
  });
});
