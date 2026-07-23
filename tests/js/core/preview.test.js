// B23/B24 Picture-in-Picture safety helpers (static/core/preview.js). Detaching a
// <video>, or clearing its src, while it is the browser's active PiP element closes
// the still-visible PiP window - so the disruptive work must be deferred until the
// user actually exits PiP (leavepictureinpicture). jobs.js is mocked so importing
// preview.js does not drag in the SSE machinery.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../yuu_clip/web/static/core/jobs.js', () => ({ streamSSE: vi.fn() }));

import {
  _isPipElement, releaseVideoRespectingPip, deferPlayerRebuildForPip, _buildMediaUrl,
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
