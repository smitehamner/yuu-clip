// B23/B24 Picture-in-Picture safety helpers (static/core/preview.js). Detaching a
// <video>, or clearing its src, while it is the browser's active PiP element closes
// the still-visible PiP window - so the disruptive work must be deferred until the
// user actually exits PiP (leavepictureinpicture). jobs.js is mocked so importing
// preview.js does not drag in the SSE machinery.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../yuu_clip/web/static/core/jobs.js', () => ({ _openSSE: vi.fn() }));

import { _openSSE } from '../../../yuu_clip/web/static/core/jobs.js';
import {
  _isPipElement, releaseVideoRespectingPip, deferPlayerRebuildForPip, _buildMediaUrl,
  _buildRecordingProxy, setupRecordingPreview,
} from '../../../yuu_clip/web/static/core/preview.js';

afterEach(() => { delete window.electronAPI; });

describe('_buildMediaUrl', () => {
  it('uses the HTTP route when electronAPI is absent', () => {
    expect(_buildMediaUrl(7, 'source', 'D:/recordings/session.mp4')).toBe('/api/videos/7/source');
  });

  it('uses the HTTP route when electronAPI is present but the path is missing', () => {
    window.electronAPI = { mediaProtocol: true };
    expect(_buildMediaUrl(7, 'proxy', null)).toBe('/api/videos/7/proxy');
  });

  it('builds a native yuu-media:// url for the source when electronAPI has mediaProtocol', () => {
    window.electronAPI = { mediaProtocol: true };
    const raw = 'D:\\recordings\\session.mp4';
    const encoded = encodeURIComponent(raw.replace(/\\/g, '/'));
    expect(_buildMediaUrl(7, 'source', raw)).toBe(`yuu-media://media/${encoded}`);
  });

  it('builds a native yuu-media:// url for the proxy when electronAPI has mediaProtocol', () => {
    window.electronAPI = { mediaProtocol: true };
    const raw = 'D:\\recordings\\proxy.mp4';
    const encoded = encodeURIComponent(raw.replace(/\\/g, '/'));
    expect(_buildMediaUrl(7, 'proxy', raw)).toBe(`yuu-media://media/${encoded}`);
  });

  it('encodes spaces and unicode in the normalized path', () => {
    window.electronAPI = { mediaProtocol: true };
    const raw = 'D:/recordings/クリップ 2026 (final).mp4';
    const encoded = encodeURIComponent(raw);
    expect(_buildMediaUrl(7, 'source', raw)).toBe(`yuu-media://media/${encoded}`);
  });

  it('normalizes Windows backslashes before encoding', () => {
    window.electronAPI = { mediaProtocol: true };
    expect(_buildMediaUrl(7, 'source', 'C:\\Users\\me\\Videos\\clip.mp4'))
      .toBe('yuu-media://media/C%3A%2FUsers%2Fme%2FVideos%2Fclip.mp4');
  });
});

function setPipElement(el) {
  Object.defineProperty(document, 'pictureInPictureElement', {
    value: el, configurable: true, writable: true,
  });
}

afterEach(() => setPipElement(null));

describe('_isPipElement', () => {
  it('is true only for the active PiP element', () => {
    const vid = document.createElement('video');
    const other = document.createElement('video');
    setPipElement(vid);
    expect(_isPipElement(vid)).toBe(true);
    expect(_isPipElement(other)).toBe(false);
    expect(_isPipElement(null)).toBe(false);
  });
});

describe('releaseVideoRespectingPip', () => {
  it('runs the teardown immediately when the video is not in PiP', () => {
    const vid = document.createElement('video');
    setPipElement(null);
    const teardown = vi.fn();
    releaseVideoRespectingPip(vid, teardown);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('defers the teardown until the user leaves PiP', () => {
    const vid = document.createElement('video');
    setPipElement(vid);
    const teardown = vi.fn();
    releaseVideoRespectingPip(vid, teardown);
    expect(teardown).not.toHaveBeenCalled();
    vid.dispatchEvent(new Event('leavepictureinpicture'));
    expect(teardown).toHaveBeenCalledTimes(1);
  });
});

describe('deferPlayerRebuildForPip', () => {
  it('returns false (caller rebuilds normally) when nothing is in PiP', () => {
    setPipElement(null);
    const rebuild = vi.fn();
    expect(deferPlayerRebuildForPip(rebuild)).toBe(false);
    expect(rebuild).not.toHaveBeenCalled();
  });

  it('returns false when the PiP element is outside #player-area', () => {
    const stray = document.createElement('video');
    document.body.appendChild(stray);
    setPipElement(stray);
    expect(deferPlayerRebuildForPip(vi.fn())).toBe(false);
  });

  it('defers the rebuild and applies only the latest once PiP is exited', () => {
    const area = document.getElementById('player-area');
    const vid = document.createElement('video');
    area.appendChild(vid);
    setPipElement(vid);

    const first = vi.fn();
    const second = vi.fn();
    expect(deferPlayerRebuildForPip(first)).toBe(true);
    expect(deferPlayerRebuildForPip(second)).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    vid.dispatchEvent(new Event('leavepictureinpicture'));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('registers only one leave handler across repeated deferrals', () => {
    const area = document.getElementById('player-area');
    const vid = document.createElement('video');
    area.appendChild(vid);
    setPipElement(vid);
    const addSpy = vi.spyOn(vid, 'addEventListener');

    deferPlayerRebuildForPip(vi.fn());
    deferPlayerRebuildForPip(vi.fn());
    deferPlayerRebuildForPip(vi.fn());

    const leaveHandlers = addSpy.mock.calls.filter(
      ([evt]) => evt === 'leavepictureinpicture',
    );
    expect(leaveHandlers).toHaveLength(1);
    vid.dispatchEvent(new Event('leavepictureinpicture')); // drain the queued rebuild
  });
});

// bug-hunt 2.3: a background proxy build must never supersede a live analyze/
// score/export progress stream, which is exactly what streamSSE's
// _supersedeActiveStream() would do. _buildRecordingProxy must go through the
// raw, non-superseding _openSSE instead.
describe('_buildRecordingProxy', () => {
  afterEach(() => vi.clearAllMocks());

  it('drains via the non-superseding _openSSE, not streamSSE', () => {
    const badge = document.createElement('div');
    _buildRecordingProxy(document.createElement('video'), badge, 7, () => true);

    expect(_openSSE).toHaveBeenCalledTimes(1);
    expect(_openSSE.mock.calls[0][0]).toBe('/api/videos/7/proxy/generate');
  });

  it('surfaces the encode percentage on the badge via onLine', () => {
    const badge = document.createElement('div');
    _buildRecordingProxy(document.createElement('video'), badge, 7, () => true);

    const onLine = _openSSE.mock.calls[0][1];
    onLine('frame= 10 42% done');

    expect(badge.textContent).toContain('42%');
  });

  it('on error, resets the badge to a clickable retry button rather than leaving it stuck building', () => {
    const badge = document.createElement('div');
    _buildRecordingProxy(document.createElement('video'), badge, 7, () => true);

    const onError = _openSSE.mock.calls[0][3];
    onError('[Error: subprocess exited with code 1]');

    expect(badge.classList.contains('preview-badge-build')).toBe(true);
    expect(typeof badge.onclick).toBe('function');
  });

  it('on completion, checks proxy-status and switches the badge to proxy quality when it landed', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ available: true, proxy_path: '/tmp/proxy.mp4' }) })));
    const badge = document.createElement('div');
    _buildRecordingProxy(document.createElement('video'), badge, 7, () => true);

    const onDone = _openSSE.mock.calls[0][2];
    await onDone();

    expect(badge.classList.contains('preview-badge-proxy')).toBe(true);
  });

  it('renders a Cancel pill on the badge while building', () => {
    _openSSE.mockReturnValue({ close: vi.fn() });
    const badge = document.createElement('div');
    _buildRecordingProxy(document.createElement('video'), badge, 7, () => true);

    const cancelEl = badge.querySelector('.preview-badge-cancel');
    expect(cancelEl).not.toBeNull();
    expect(cancelEl.textContent).toBe('Cancel');
  });

  it('Cancel closes the local stream, posts to proxy/cancel, and resets the badge to a retry button', () => {
    const closeSpy = vi.fn();
    _openSSE.mockReturnValue({ close: closeSpy });
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchSpy);
    const badge = document.createElement('div');
    _buildRecordingProxy(document.createElement('video'), badge, 7, () => true);

    badge.querySelector('.preview-badge-cancel').click();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/videos/7/proxy/cancel', { method: 'POST' });
    expect(badge.classList.contains('preview-badge-build')).toBe(true);
  });

  // Cancel must never route through the global job pill/cancelJob() - it would
  // then compete with (and could tear down) an unrelated running job's pill,
  // reintroducing the exact bug-hunt 2.3 failure mode this file avoids above.
  it('Cancel never touches streamSSE/the global job pill', () => {
    _openSSE.mockReturnValue({ close: vi.fn() });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
    const badge = document.createElement('div');
    _buildRecordingProxy(document.createElement('video'), badge, 7, () => true);

    badge.querySelector('.preview-badge-cancel').click();

    expect(_openSSE).toHaveBeenCalledTimes(1); // no second (superseding) stream opened
  });
});

// chaos-test finding 2026-07-26: attaching a captions <track> unconditionally
// made the player fetch /captions.vtt (and log a console 404) for any recording
// with no transcribed dialogue - has_transcript gates it, matching how clip
// players already gate on media.has_captions.
describe('setupRecordingPreview captions track', () => {
  const stubProxyStatusFetch = () => vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({ available: false }) })));

  afterEach(() => vi.unstubAllGlobals());

  it('attaches no captions track when the recording has no transcript', () => {
    stubProxyStatusFetch();
    const vid = document.createElement('video');
    setupRecordingPreview(vid, document.createElement('div'), 7, { hasTranscript: false });
    expect(vid.querySelector('track[data-captions-track]')).toBeNull();
  });

  it('attaches a captions track pointed at the video when it has a transcript', () => {
    stubProxyStatusFetch();
    const vid = document.createElement('video');
    setupRecordingPreview(vid, document.createElement('div'), 7, { hasTranscript: true });
    const track = vid.querySelector('track[data-captions-track]');
    expect(track).not.toBeNull();
    expect(track.src).toContain('/api/videos/7/captions.vtt');
  });

  it('clears a stale track from a previous recording when the new one has no transcript', () => {
    stubProxyStatusFetch();
    const vid = document.createElement('video');
    setupRecordingPreview(vid, document.createElement('div'), 7, { hasTranscript: true });
    expect(vid.querySelector('track[data-captions-track]')).not.toBeNull();

    setupRecordingPreview(vid, document.createElement('div'), 9, { hasTranscript: false });
    expect(vid.querySelector('track[data-captions-track]')).toBeNull();
  });
});
