(function () {
// ── timed transcript views ────────────────────────────────────────────────────
// Per-line transcript for a clip (clip-relative time) and for a whole recording
// (absolute time), each line with a ▶ that seeks the visible player. Works for
// diarized transcripts (speaker name shown when it changes) and plain ones
// (each caption segment becomes its own line).

function seekPlayerTo(seconds) {
  const video = document.querySelector('#player-area video');
  if (!video) return;
  video.currentTime = Math.max(0, seconds || 0);
  const attempt = video.play();
  if (attempt && attempt.catch) attempt.catch(() => {});
}

function _clock(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function renderTranscriptLines(lines) {
  if (!Array.isArray(lines) || !lines.length) {
    return '<div class="transcript-empty">No transcript available.</div>';
  }
  let prevSpeaker = null;
  const rows = lines.map(line => {
    const showSpeaker = line.speaker && line.speaker !== prevSpeaker;
    prevSpeaker = line.speaker;
    const speaker = showSpeaker ? `<div class="tline-speaker">${escHtml(line.speaker)}</div>` : '';
    const clock = _clock(line.start_ms);
    return `${speaker}<div class="tline">
      <button class="tline-play" data-seek-s="${(line.start_ms || 0) / 1000}"
              title="Jump to ${clock}" aria-label="Play from ${clock}">&#9654;</button>
      <span class="tline-time">${clock}</span>
      <span class="tline-text">${escHtml(line.text)}</span>
    </div>`;
  }).join('');
  return `<div class="transcript-lines">${rows}</div>`;
}

async function loadClipTranscript(clipId) {
  const el = document.getElementById('clip-transcript-view');
  if (!el) return;
  try {
    const data = await fetch(`/api/clips/${clipId}/transcript`).then(r => r.json());
    if (data.lines && data.lines.length) el.innerHTML = renderTranscriptLines(data.lines);
    // else: keep the plain excerpt already rendered as a fallback.
  } catch (_) {
    // Leave the excerpt fallback in place on error.
  }
}

let _videoTranscriptLoadedFor = null;
async function loadVideoTranscript(videoId) {
  const el = document.getElementById('video-transcript-view');
  if (!el) return;
  if (_videoTranscriptLoadedFor === videoId) return;  // fetch once per open
  el.innerHTML = '<div class="transcript-empty">Loading…</div>';
  try {
    const data = await fetch(`/api/videos/${videoId}/transcript`).then(r => r.json());
    el.innerHTML = renderTranscriptLines(data.lines);
    _videoTranscriptLoadedFor = videoId;
  } catch (_) {
    el.innerHTML = '<div class="transcript-empty">Could not load transcript.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const detail = document.getElementById('detail');
  if (!detail) return;
  detail.addEventListener('click', e => {
    const btn = e.target.closest && e.target.closest('.tline-play');
    if (btn) seekPlayerTo(parseFloat(btn.dataset.seekS));
  });
  // 'toggle' does not bubble — listen in the capture phase to catch it on the
  // <details> element, and lazy-load the full-video transcript on first expand.
  detail.addEventListener('toggle', e => {
    const d = e.target;
    if (d && d.id === 'video-transcript-details' && d.open) {
      loadVideoTranscript(parseInt(d.dataset.videoId, 10));
    }
  }, true);
});

Object.assign(window, { loadClipTranscript, loadVideoTranscript, renderTranscriptLines, seekPlayerTo });
})();
