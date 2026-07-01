(function () {
// ── speaker naming ────────────────────────────────────────────────────────────
// Renders the "Speakers" card in the recording detail view and saves names.
// The card only appears when the recording has diarized speakers.

async function loadSpeakers(videoId) {
  const section = document.getElementById('speakers-section');
  if (!section) return;
  let speakers = [];
  try {
    speakers = await fetch(`/api/videos/${videoId}/speakers`).then(r => r.json());
  } catch (_) {
    speakers = [];
  }
  if (!Array.isArray(speakers) || speakers.length === 0) {
    section.innerHTML = '';
    return;
  }
  section.innerHTML = _renderSpeakersCard(speakers);
}

function _renderSpeakersCard(speakers) {
  const rows = speakers.map(s => {
    const play = (s.sample_start_ms !== null && s.sample_start_ms !== undefined)
      ? `<button class="speaker-play" data-sample-ms="${s.sample_start_ms}" data-sample-end-ms="${s.sample_end_ms === null ? '' : s.sample_end_ms}"
                 title="Play a sample of this voice" aria-label="Play a sample of Speaker ${s.display_index}">&#9654;</button>`
      : '';
    const sample = s.sample_text
      ? `<span class="speaker-sample" title="${escHtml(s.sample_text)}">&ldquo;${escHtml(_truncate(s.sample_text, 60))}&rdquo;</span>`
      : '';
    return `
      <div class="speaker-row">
        ${play}
        <span class="speaker-tag">Speaker ${s.display_index}</span>
        <input class="speaker-name-input" type="text" data-speaker-id="${s.id}"
               value="${escHtml(s.name || '')}" placeholder="Add a name&hellip;"
               aria-label="Name for Speaker ${s.display_index}" maxlength="60">
        ${sample}
      </div>`;
  }).join('');
  return `
    <div class="detail-card">
      <div class="detail-card-header"><span class="detail-card-title">Speakers</span></div>
      <div class="speaker-list">${rows}</div>
      <div class="speaker-hint">Names show up in clip transcripts and captions. They stick even if you re-analyze this recording.</div>
    </div>`;
}

function _truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// Play a short sample of a speaker's voice by seeking the recording's own video
// player — no separate audio route needed. Stops after the sample segment (capped
// at 6s so a long turn doesn't play in full).
let _sampleStopTimer = null;
function _playSpeakerSample(startMs, endMs) {
  const video = document.querySelector('#player-area video');
  if (!video) return;
  if (_sampleStopTimer) { clearTimeout(_sampleStopTimer); _sampleStopTimer = null; }
  video.currentTime = (startMs || 0) / 1000;
  const playAttempt = video.play();
  if (playAttempt && playAttempt.catch) playAttempt.catch(() => {});
  const spanMs = (endMs ? endMs - startMs : 4000);
  const durationMs = Math.min(6000, Math.max(1500, spanMs));
  _sampleStopTimer = setTimeout(() => { video.pause(); _sampleStopTimer = null; }, durationMs);
}

async function _saveSpeakerName(speakerId, name) {
  try {
    const res = await fetch(`/api/speakers/${speakerId}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name}),
    });
    if (!res.ok) {
      showToast('Could not save speaker name', 'error');
      return;
    }
    const updated = await res.json();
    const input = document.querySelector(`.speaker-name-input[data-speaker-id="${speakerId}"]`);
    if (input && !updated.is_named) input.value = '';
    showToast(updated.is_named ? `Speaker named ${updated.display_name}` : 'Name cleared');
    // Refresh the open clip so its transcript reflects the new name.
    if (AppState.activeClipId) selectClip(AppState.activeClipId);
  } catch (_) {
    showToast('Could not save speaker name', 'error');
  }
}

// Event delegation on the persistent #detail element (its innerHTML is replaced
// each render, so per-row handlers would be lost — the container listener isn't).
document.addEventListener('DOMContentLoaded', () => {
  const detail = document.getElementById('detail');
  if (!detail) return;
  detail.addEventListener('click', e => {
    const playBtn = e.target.closest && e.target.closest('.speaker-play');
    if (playBtn) {
      const endRaw = playBtn.dataset.sampleEndMs;
      _playSpeakerSample(
        parseInt(playBtn.dataset.sampleMs, 10),
        endRaw ? parseInt(endRaw, 10) : null,
      );
    }
  });
  detail.addEventListener('change', e => {
    const input = e.target.closest && e.target.closest('.speaker-name-input');
    if (input) _saveSpeakerName(parseInt(input.dataset.speakerId, 10), input.value.trim());
  });
  detail.addEventListener('keydown', e => {
    const input = e.target.closest && e.target.closest('.speaker-name-input');
    if (input && e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });
});

Object.assign(window, { loadSpeakers });
})();
