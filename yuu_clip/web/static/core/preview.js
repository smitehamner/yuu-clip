// Feature-map - Recording preview player: picks the media transport (Electron native scheme vs HTTP),
//   prefers the fast 720p proxy over the source, and drives the click-to-build proxy badge.
//   API: routes/videos.py (source/proxy/proxy-status/proxy-generate) · Tests: tests/ui/test_ui_video.py
// Single point that picks the transport for a recording's source/proxy stream
// (roadmap plan 10). Inside the packaged Electron app, window.electronAPI.mediaProtocol
// is set and playback goes straight through the native "yuu-media://" scheme -
// bypassing the Python byte-pump - instead of the HTTP route. Plain browser-dev
// mode never has electronAPI, so it always gets the unchanged HTTP URL. absPath
// may be null (e.g. a proxy that hasn't been generated/looked up yet), which
// simply falls back to HTTP for that one request.
import { _openSSE } from './jobs.js';

// ── Picture-in-Picture safety (B23/B24) ───────────────────────────────────────
// Detaching a <video>, or clearing its src, while the browser holds it in native
// Picture-in-Picture closes the still-visible PiP window the user explicitly asked
// to keep. These helpers defer that disruptive work until the user actually exits
// PiP (the `leavepictureinpicture` event), matching the reel-modal pattern (B23).

export function _isPipElement(vid) {
  return !!vid && document.pictureInPictureElement === vid;
}

// Run `teardown` now, or - if `vid` is the active PiP element - defer it until the
// user leaves PiP so its playback is not cut short. Used by the editing-tool
// preview panels and the reel modals.
export function releaseVideoRespectingPip(vid, teardown) {
  if (_isPipElement(vid)) {
    vid.addEventListener('leavepictureinpicture', teardown, { once: true });
  } else {
    teardown();
  }
}

let _pipDeferredPlayerRebuild = null;

// The main #player-area is fully rebuilt (via innerHTML) on every clip/recording
// selection, which detaches its <video> and kills any active PiP window. Per the
// B24 owner decision, PiP is left alone entirely: when the area currently holds the
// active PiP element, the caller skips its rebuild and registers it here; only the
// latest queued rebuild is applied, and only once the user exits PiP, so the main
// pane catches up to the current selection then. Returns true when the caller must
// skip its own rebuild, false to rebuild normally.
export function deferPlayerRebuildForPip(rebuild) {
  const pip = document.pictureInPictureElement;
  const area = document.getElementById('player-area');
  if (!pip || !area || !area.contains(pip)) return false;
  const alreadyQueued = _pipDeferredPlayerRebuild !== null;
  _pipDeferredPlayerRebuild = rebuild;
  if (!alreadyQueued) {
    pip.addEventListener('leavepictureinpicture', () => {
      const pending = _pipDeferredPlayerRebuild;
      _pipDeferredPlayerRebuild = null;
      pending?.();
    }, { once: true });
  }
  return true;
}

export function _buildMediaUrl(videoId, kind, absPath) {
  if (window.electronAPI?.mediaProtocol && absPath) {
    const normalized = absPath.replace(/\\/g, '/');
    return `yuu-media://media/${encodeURIComponent(normalized)}`;
  }
  return `/api/videos/${videoId}/${kind}`;
}

// ── recording preview quality (720p proxy + badge) ────────────────────────────
// Shared by every full-recording <video> (recording detail player, split editor)
// so the creator always knows whether they're seeing the fast 720p proxy or the
// full-quality original. Prefers the proxy when one exists; otherwise plays the
// source and either builds a proxy on demand (autoBuild) or invites the user to.
//
//   videoEl / badgeEl : the <video> and its overlay badge (caller owns layout)
//   autoBuild         : build immediately when no proxy exists (deliberate
//                       scrubbing surfaces), else the badge offers a click-to-build
//   isCurrent         : guard so a late swap never lands on a since-changed view
//   startS / endS     : a split segment's player streams the full untrimmed parent
//                       file (source and proxy are both keyed by the parent path) -
//                       these bound playback to the segment's own slice of it
//   sourcePath        : the recording's absolute path (video.source_path from the
//                       already-fetched video record) - only used to build the
//                       Electron native-protocol URL; ignored in browser-dev mode
// videoEl may be a persistent element reused across recordings (Split Editor,
// Export preset editor), so a stale track from a previous recording must be
// cleared before adding the current one's.
function _setRecordingCaptionsTrack(videoEl, videoId) {
  videoEl.querySelectorAll('track[data-captions-track]').forEach(t => t.remove());
  const track = document.createElement('track');
  track.kind = 'captions';
  track.label = 'Captions';
  track.default = true;
  track.src = `/api/videos/${videoId}/captions.vtt`;
  track.dataset.captionsTrack = 'true';
  videoEl.appendChild(track);
}

export function setupRecordingPreview(videoEl, badgeEl, videoId, { autoBuild = false, isCurrent = () => true, startS = null, endS = null, sourcePath = null } = {}) {
  videoEl.src = _buildMediaUrl(videoId, 'source', sourcePath);
  _setRecordingCaptionsTrack(videoEl, videoId);
  if (startS != null) {
    videoEl.addEventListener('loadedmetadata', () => { try { videoEl.currentTime = startS; } catch (_) {} }, { once: true });
  }
  if (endS != null) {
    videoEl.addEventListener('timeupdate', () => { if (videoEl.currentTime >= endS) videoEl.pause(); });
  }
  const buildFn = () => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS);
  _setPreviewBadge(badgeEl, 'original', null, autoBuild ? null : buildFn);
  fetch(`/api/videos/${videoId}/proxy-status`)
    .then(r => r.ok ? r.json() : null)
    .then(status => {
      if (!isCurrent() || !status) return;
      if (status.available) _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS, status.proxy_path);
      else if (autoBuild || status.generating) buildFn();
    })
    .catch(() => { /* leave the source playing with the original-quality badge */ });
}

// startS: falls back to it when currentTime is still 0 - the proxy-status fetch
// can resolve before the source's loadedmetadata seek (setupRecordingPreview) runs,
// which would otherwise resume a segment's proxy at the parent's t=0.
function _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS = null, proxyPath = null) {
  if (!isCurrent()) return;
  const resumeAt   = videoEl.currentTime || startS || 0;
  const wasPlaying = !videoEl.paused && !videoEl.ended;
  videoEl.src = _buildMediaUrl(videoId, 'proxy', proxyPath);
  videoEl.addEventListener('loadedmetadata', () => {
    try { videoEl.currentTime = resumeAt; } catch (_) {}
    if (wasPlaying) videoEl.play().catch(() => {});
  }, { once: true });
  _setPreviewBadge(badgeEl, 'proxy');
}

export function _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS = null) {
  if (!isCurrent()) return;
  _setPreviewBadge(badgeEl, 'building');
  const retryBadge = () => _setPreviewBadge(badgeEl, 'original', null, () => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS));
  // Raw _openSSE, not streamSSE: this is a background convenience (no global job
  // pill), and streamSSE's _supersedeActiveStream() would tear down a live
  // analyze/score/export progress stream just because a preview proxy started
  // building alongside it (bug-hunt 2.3).
  _openSSE(
    `/api/videos/${videoId}/proxy/generate`,
    msg => {    // onLine: surface the encode percentage on the badge
      const m = typeof msg === 'string' ? /(\d+)%/.exec(msg) : null;
      if (m && isCurrent()) _setPreviewBadge(badgeEl, 'building', m[1]);
    },
    async () => {
      if (!isCurrent()) return;
      const status = await fetch(`/api/videos/${videoId}/proxy-status`)
        .then(r => r.ok ? r.json() : null).catch(() => null);
      if (!isCurrent()) return;
      if (status?.available) _useRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS, status.proxy_path);
      // Another open is still encoding - poll until its proxy lands.
      else if (status?.generating) setTimeout(() => _buildRecordingProxy(videoEl, badgeEl, videoId, isCurrent, startS), 5000);
      else retryBadge();
    },
    () => {     // onError: a failed background build is a convenience miss, not
      if (isCurrent()) retryBadge();  // an error to surface - just offer a retry.
    },
  );
}

function _setPreviewBadge(badgeEl, mode, pct, onBuild) {
  if (!badgeEl) return;
  // Reset to a non-interactive status indicator; the build affordance below
  // re-arms it as a button so role/tabindex never go stale between states.
  badgeEl.style.display = 'inline-block';
  badgeEl.onclick = null;
  badgeEl.onkeydown = null;
  badgeEl.style.cursor = '';
  badgeEl.style.pointerEvents = 'none';
  badgeEl.removeAttribute('tabindex');
  badgeEl.setAttribute('role', 'status');
  badgeEl.classList.toggle('preview-badge-proxy', mode === 'proxy');
  badgeEl.classList.remove('preview-badge-build');
  if (mode === 'proxy') {
    badgeEl.textContent = 'Preview quality (720p)';
    badgeEl.title = 'Playing a downscaled 720p preview for fast seeking - not full quality. Exports use the original.';
  } else if (mode === 'building') {
    badgeEl.textContent = pct ? `Building 720p preview… ${pct}%` : 'Building 720p preview…';
    badgeEl.title = 'Encoding a fast-seeking 720p preview from the source recording.';
  } else if (onBuild) {
    // Render the action as a button-styled pill so it obviously invites a click.
    badgeEl.classList.add('preview-badge-build');
    badgeEl.innerHTML = 'Original quality · <span class="preview-badge-action">&#9889; Build 720p preview</span>';
    badgeEl.title = 'Playing the full-quality original. Build a 720p preview so seeking is fast.';
    badgeEl.style.cursor = 'pointer';
    badgeEl.style.pointerEvents = 'auto';
    badgeEl.setAttribute('role', 'button');
    badgeEl.tabIndex = 0;
    badgeEl.onclick = onBuild;
    badgeEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBuild(); } };
  } else {
    badgeEl.textContent = 'Original quality · slower seeking';
    badgeEl.title = 'Playing the original recording - seeking a long file can be slow.';
  }
}
