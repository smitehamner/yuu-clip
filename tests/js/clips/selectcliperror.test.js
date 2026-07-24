// H2 (UX-REVIEW-2026-07-23): a failed clip load must replace the "Loading..."
// placeholder with the server's reason + a Try-again control, instead of leaving
// #detail stuck on "Loading..." forever with only a transient toast.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/videos/videos.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, loadVideos: vi.fn(), fetchClipsList: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});

import { selectClip } from '../../../yuu_clip/web/static/clips/clips.js';

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<ul id="clip-list"></ul><div id="detail"></div>';
  AppState.activeVideoId = 7;
  AppState.activeClipId = null;
});

describe('selectClip error state', () => {
  it('renders the server reason and a working Try-again button on load failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({ detail: 'clip file went missing' }) }),
    ));

    await selectClip(42);

    const detail = document.getElementById('detail');
    expect(detail.textContent).toContain("Couldn't load this clip");
    expect(detail.textContent).toContain('clip file went missing');
    const retry = document.getElementById('clip-load-retry');
    expect(retry).not.toBeNull();
    expect(typeof retry.onclick).toBe('function');
  });

  it('does not leave the Loading placeholder in place after a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: false, status: 404, json: async () => ({}) }),
    ));

    await selectClip(1);

    expect(document.getElementById('detail').textContent).not.toContain('Loading');
  });
});
