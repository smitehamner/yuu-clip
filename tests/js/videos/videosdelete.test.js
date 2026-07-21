// deleteVideo (static/videos/videos.js) - the confirm-then-DELETE flow. Ported
// from the request-shape half of tests/ui/test_ui_video.py::TestDeleteVideoConfirm
// by mocking the ui.js confirm seam, matching the same split already used for
// regenSummaryAuto (videos-summary.test.js) and the bulk clip actions
// (clipbulk.test.js): the real #confirm-modal show/hide DOM wiring stays in
// Playwright, browserless here for the confirm-copy and DELETE-request shape.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showConfirm: vi.fn() };
});

import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import { deleteVideo } from '../../../yuu_clip/web/static/videos/videos.js';

beforeEach(() => {
  vi.clearAllMocks();
  AppState.videos = [{ id: 42, filename: 'session.mkv' }];
  AppState.activeVideoId = null;
  AppState.activeClipId = null;
});

afterEach(() => { delete globalThis.fetch; });

describe('deleteVideo', () => {
  it('warns via confirm with the filename and a danger-styled Remove action', () => {
    deleteVideo(42);
    expect(showConfirm).toHaveBeenCalledTimes(1);
    const [title, body, okLabel, , danger] = showConfirm.mock.calls[0];
    expect(title).toBe('Remove recording?');
    expect(body).toContain('session.mkv');
    expect(body).toContain('not</strong> deleted');
    expect(okLabel).toBe('Remove');
    expect(danger).toBe(true);
  });

  it('confirming sends DELETE for that video', async () => {
    globalThis.fetch = vi.fn((url, opts) => {
      if (url === '/api/videos/42' && opts?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
    deleteVideo(42);
    const onOk = showConfirm.mock.calls[0][3];
    await onOk();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/videos/42', { method: 'DELETE' });
  });
});
