// _warmPreviewProxy (static/analyze/analyze.js) - the silent background job that
// re-encodes the 720p preview proxy right after analysis finishes. It still holds
// the backend's job_in_flight busy gate for the whole encode (routes/videos.py's
// active_job()), so a heavy action attempted during the warm-up 409s with nothing
// on screen to explain why (B4, 2026-07-19 UX bug hunt). Asserts the fix: the
// #preview-warm-status indicator is shown only while an encode actually runs, and
// always cleared afterward - even on failure.
import { _warmPreviewProxy } from '../../../yuu_clip/web/static/analyze/analyze.js';

const statusEl = () => document.getElementById('preview-warm-status');
const isVisible = () => statusEl().classList.contains('visible');

// A fetch Response whose body streams no lines and ends immediately - just enough
// for _warmPreviewProxy's drain loop to see `done: true` on the first read.
const emptyStreamResponse = () => ({
  ok: true,
  body: { getReader: () => ({ read: async () => ({ done: true }) }) },
});

afterEach(() => { vi.restoreAllMocks(); statusEl().classList.remove('visible'); });

describe('_warmPreviewProxy', () => {
  it('shows the status indicator while actually building a proxy, then clears it', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/proxy-status')) {
        return Promise.resolve({ ok: true, json: async () => ({ available: false, generating: false }) });
      }
      expect(isVisible()).toBe(true); // visible for the duration of the encode call
      return Promise.resolve(emptyStreamResponse());
    });
    vi.stubGlobal('fetch', fetchMock);

    await _warmPreviewProxy(42);

    expect(isVisible()).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/proxy/generate'))).toBe(true);
  });

  it('never shows the indicator when a fresh proxy already exists', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ available: true, generating: false }) })));

    await _warmPreviewProxy(42);

    expect(isVisible()).toBe(false);
  });

  it('never shows the indicator when another tab is already generating one', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ available: false, generating: true }) })));

    await _warmPreviewProxy(42);

    expect(isVisible()).toBe(false);
  });

  it('surfaces the encode percentage and elapsed time while building', async () => {
    const chunk = new TextEncoder().encode(`data: ${JSON.stringify('frame= 120 45% done')}\n\n`);
    let capturedLabel = '';
    let reads = 0;
    const reader = {
      read: async () => {
        if (reads++ === 0) return { done: false, value: chunk };
        // The progress line was processed before this second read - capture the
        // live label now, since the finally block resets it once the stream ends.
        capturedLabel = statusEl().querySelector('span').textContent;
        return { done: true };
      },
    };
    const fetchMock = vi.fn((url) => {
      if (url.includes('/proxy-status')) {
        return Promise.resolve({ ok: true, json: async () => ({ available: false, generating: false }) });
      }
      return Promise.resolve({ ok: true, body: { getReader: () => reader } });
    });
    vi.stubGlobal('fetch', fetchMock);

    await _warmPreviewProxy(42);

    expect(capturedLabel).toContain('45%');
    expect(capturedLabel).toMatch(/\(\d+s\)/); // elapsed time is always shown
    expect(isVisible()).toBe(false); // cleared afterward
  });

  it('clears the indicator even when the encode request fails', async () => {
    const fetchMock = vi.fn((url) => {
      if (url.includes('/proxy-status')) {
        return Promise.resolve({ ok: true, json: async () => ({ available: false, generating: false }) });
      }
      return Promise.reject(new Error('network lost'));
    });
    vi.stubGlobal('fetch', fetchMock);

    await _warmPreviewProxy(42);

    expect(isVisible()).toBe(false);
  });
});
