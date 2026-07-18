// regenSummaryAuto (static/videos/videos-summary.js) - the confirm-then-SSE guard
// on the auto-save summary regen. Ported from the copy + request cases in
// tests/ui/test_ui_video.py::TestRegenSummaryAutoConfirm: the confirm-dialog copy,
// "confirm starts the regenerate-summary stream", and "nothing streams until
// confirmed" run browserless by mocking the ui.js confirm + jobs.js SSE seams. The
// real #confirm-modal show/hide DOM wiring stays in Playwright.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/videos/videos.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, loadVideos: vi.fn().mockResolvedValue(undefined) };
});
vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showConfirm: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/core/jobs.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    _openSSE: vi.fn(),
    _blockedByAnalyze: vi.fn(() => false),
    _supersedeActiveStream: vi.fn(),
  };
});

import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import { _openSSE } from '../../../yuu_clip/web/static/core/jobs.js';
import { regenSummaryAuto } from '../../../yuu_clip/web/static/videos/videos-summary.js';

beforeEach(() => {
  vi.clearAllMocks();
  AppState.videos = [{ id: 7, title: 'a' }];
  AppState.analyzeFilename = null;
});

describe('regenSummaryAuto', () => {
  it('warns via confirm before regenerating (title + auto-save-is-irreversible body)', () => {
    regenSummaryAuto(7, document.createElement('button'));
    expect(showConfirm).toHaveBeenCalledTimes(1);
    const [title, body, confirmLabel] = showConfirm.mock.calls[0];
    expect(title).toContain('Regenerate');
    expect(body).toContain('replaced without a review step');
    expect(confirmLabel).toBe('Regenerate');
  });

  it('does not start the regen stream until the confirm is accepted', () => {
    showConfirm.mockImplementation(() => {}); // user has not confirmed yet
    regenSummaryAuto(7, document.createElement('button'));
    expect(_openSSE).not.toHaveBeenCalled();
  });

  it('streams the regenerate-summary endpoint for the video once confirmed', () => {
    showConfirm.mockImplementation((t, b, l, onConfirm) => onConfirm());
    regenSummaryAuto(7, document.createElement('button'));
    expect(_openSSE).toHaveBeenCalledTimes(1);
    expect(_openSSE.mock.calls[0][0]).toBe('/api/videos/7/regenerate-summary');
  });
});
