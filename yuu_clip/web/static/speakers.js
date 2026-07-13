(function () {
// Feature-map - Speaker naming (code: Speaker; UI "Speakers" card).
//   API: routes/speakers.py · Tests: tests/ui/test_ui_speakers.py
// ── speaker naming ────────────────────────────────────────────────────────────
// Renders the "Speakers" card in the recording detail view and saves names.
// The card only appears when the recording has diarized speakers.

let _currentVideoId = null;

async function loadSpeakers(videoId) {
  const section = document.getElementById('speakers-section');
  if (!section) return;
  _currentVideoId = videoId;
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
  section.querySelectorAll('.speaker-color-input').forEach(el => window.ColorPicker?.attach(el));
}

// A speaker with an inferred name the user hasn't accepted yet. Its name stays out of
// captions/excerpts (server gates display_name on `confirmed`) until accepted here.
function _isSuggestion(s) {
  return s.source === 'inferred' && !s.confirmed && !!s.name;
}

function _renderSpeakersCard(speakers) {
  const rows = speakers.map(s => {
    const play = (s.sample_start_ms !== null && s.sample_start_ms !== undefined)
      ? `<button class="speaker-play" data-sample-ms="${s.sample_start_ms}" data-sample-end-ms="${s.sample_end_ms === null ? '' : s.sample_end_ms}"
                 title="Play a sample of this voice" aria-label="Play a sample of Speaker ${s.display_index}">&#9654;</button>`
      : '';
    const sample = s.sample_text
      ? `<span class="speaker-sample" title="${escHtml(s.sample_text)}">&ldquo;${escHtml(truncate(s.sample_text, 60))}&rdquo;</span>`
      : '';
    // An unconfirmed suggestion keeps the input empty (so it doesn't look accepted)
    // and shows an Accept/Dismiss prompt instead.
    const inputValue = _isSuggestion(s) ? '' : escHtml(s.name || '');
    const suggestion = _isSuggestion(s)
      ? `<span class="speaker-suggestion" title="Suggested from how others address this voice - accept to apply it">
           Suggested: <strong>${escHtml(s.name)}</strong>
           <button class="speaker-accept" data-speaker-id="${s.id}" data-name="${escHtml(s.name)}"
                   title="Use this name">Accept</button>
           <button class="speaker-dismiss" data-speaker-id="${s.id}"
                   title="Discard this suggestion">Dismiss</button>
         </span>`
      : '';
    // A borderline voiceprint near-miss: this new voice was close to an existing
    // speaker but under the re-attach threshold, so we ask instead of guessing.
    const voiceMatch = (s.suggested_match_id && s.suggested_match_name)
      ? `<span class="speaker-voicematch" title="This voice is close to an existing speaker - confirm if it's the same person">
           Might be <strong>${escHtml(s.suggested_match_name)}</strong>
           (${Math.round((s.suggested_match_score || 0) * 100)}% voice match)
           <button class="speaker-samevoice" data-speaker-id="${s.id}" data-match-name="${escHtml(s.suggested_match_name)}"
                   title="Merge into ${escHtml(s.suggested_match_name)}">Same voice</button>
           <button class="speaker-diffvoice" data-speaker-id="${s.id}"
                   title="Keep as a separate speaker">Different voice</button>
         </span>`
      : '';
    return `
      <div class="speaker-row">
        ${play}
        <span class="speaker-tag">Speaker ${s.display_index}</span>
        <input class="speaker-color-input" type="color" data-speaker-id="${s.id}"
               value="${escHtml(s.color)}" title="Subtitle color for this speaker"
               aria-label="Subtitle color for Speaker ${s.display_index}">
        <input class="speaker-name-input" type="text" data-speaker-id="${s.id}"
               value="${inputValue}" placeholder="Add a name&hellip;"
               aria-label="Name for Speaker ${s.display_index}" maxlength="60">
        ${suggestion}
        ${voiceMatch}
        ${sample}
      </div>`;
  }).join('');
  const collapsed = isCardCollapsed('speakers');
  return `
    <div class="detail-card collapsible${collapsed ? ' collapsed' : ''}" data-collapse-key="speakers">
      <div class="detail-card-header" role="button" tabindex="0" aria-expanded="${collapsed ? 'false' : 'true'}">
        <span class="detail-card-title">Speakers</span>
        <button class="btn ghost speaker-suggest-btn"
                title="Use the LLM to suggest names from how speakers address each other. Suggestions are never applied until you accept them.">Suggest names</button>
      </div>
      <div class="speaker-list">${rows}</div>
      <div class="speaker-hint">Names show up in clip transcripts and captions. They stick even if you re-analyze this recording.</div>
    </div>`;
}

// Streams the LLM inference job as SSE (the transcript pass can be slow). Mirrors
// _doRegenSummaryAuto: log lines while it runs, then reload the card so the fresh
// suggestions render. The __DONE__ sentinel carries how many were applied.
function _suggestSpeakerNames() {
  if (!_currentVideoId) return;
  if (_blockedByAnalyze('suggest speaker names')) return;
  const videoId = _currentVideoId;
  const btn = document.querySelector('.speaker-suggest-btn');
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Suggesting…'; }
  openLog();
  _supersedeActiveStream();
  const resetBtn = () => {
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = 'Suggest names'; }
  };
  let hadError = false;
  const handle = _openSSE(
    `/api/videos/${videoId}/infer-speaker-names`,
    data => {
      if (typeof data === 'string' && data.startsWith('[Error')) hadError = true;
      appendLog(String(data));
    },
    async msg => {
      _clearActiveStream(handle);
      resetBtn();
      if (hadError) { showToast('Name suggestion failed - check log for details', 'error'); return; }
      const n = (msg && typeof msg === 'object' && msg.suggested) || 0;
      showToast(n > 0
        ? `${plural(n, 'name suggestion')} - review and accept`
        : 'No names could be inferred from the transcript');
      await loadSpeakers(videoId);
    },
    errMsg => {
      _clearActiveStream(handle);
      resetBtn();
      showToast(`Name suggestion failed - ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, resetBtn);
}

// Play a short sample of a speaker's voice by seeking the recording's own video
// player - no separate audio route needed. Stops after the sample segment (capped
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
    // Refresh the open clip so its transcript reflects the new name, and the
    // recording's full-transcript panel if it's expanded.
    if (AppState.activeClipId) selectClip(AppState.activeClipId);
    if (_currentVideoId) reloadVideoTranscriptIfOpen(_currentVideoId);
  } catch (_) {
    showToast('Could not save speaker name', 'error');
  }
}

async function _saveSpeakerColor(speakerId, color) {
  try {
    const res = await fetch(`/api/speakers/${speakerId}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({color}),
    });
    if (!res.ok) {
      showToast('Could not save speaker color', 'error');
      return;
    }
    // Refresh the open clip's transcript so its speaker labels pick up the new color.
    if (AppState.activeClipId) selectClip(AppState.activeClipId);
    if (_currentVideoId) reloadVideoTranscriptIfOpen(_currentVideoId);
  } catch (_) {
    showToast('Could not save speaker color', 'error');
  }
}

// Accept (name = the suggestion) or dismiss (name = "") an inferred suggestion.
// Both confirm the speaker server-side, so the suggestion prompt clears on reload.
async function _resolveSuggestion(speakerId, name) {
  try {
    const res = await fetch(`/api/speakers/${speakerId}`, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name}),
    });
    if (!res.ok) { showToast('Could not update speaker', 'error'); return; }
    const updated = await res.json();
    showToast(updated.is_named ? `Speaker named ${updated.display_name}` : 'Suggestion dismissed');
    if (_currentVideoId) await loadSpeakers(_currentVideoId);
    if (AppState.activeClipId) selectClip(AppState.activeClipId);
    if (_currentVideoId) reloadVideoTranscriptIfOpen(_currentVideoId);
  } catch (_) {
    showToast('Could not update speaker', 'error');
  }
}

// Confirm ("Same voice" → merge into the suggested speaker) or dismiss
// ("Different voice" → keep separate) a borderline voiceprint suggestion.
async function _resolveVoiceMatch(speakerId, sameVoice, matchName) {
  const endpoint = sameVoice ? 'confirm-match' : 'reject-match';
  try {
    const res = await fetch(`/api/speakers/${speakerId}/${endpoint}`, { method: 'POST' });
    if (!res.ok) { showToast('Could not update speaker', 'error'); return; }
    showToast(sameVoice
      ? `Merged into ${matchName || 'the suggested speaker'}`
      : 'Kept as a separate speaker');
    if (_currentVideoId) await loadSpeakers(_currentVideoId);
    if (AppState.activeClipId) selectClip(AppState.activeClipId);
    if (_currentVideoId) reloadVideoTranscriptIfOpen(_currentVideoId);
  } catch (_) {
    showToast('Could not update speaker', 'error');
  }
}

// Event delegation on the persistent #detail element (its innerHTML is replaced
// each render, so per-row handlers would be lost - the container listener isn't).
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
      return;
    }
    if (e.target.closest && e.target.closest('.speaker-suggest-btn')) {
      _suggestSpeakerNames();
      return;
    }
    const acceptBtn = e.target.closest && e.target.closest('.speaker-accept');
    if (acceptBtn) {
      _resolveSuggestion(parseInt(acceptBtn.dataset.speakerId, 10), acceptBtn.dataset.name);
      return;
    }
    const dismissBtn = e.target.closest && e.target.closest('.speaker-dismiss');
    if (dismissBtn) {
      _resolveSuggestion(parseInt(dismissBtn.dataset.speakerId, 10), '');
      return;
    }
    const sameVoiceBtn = e.target.closest && e.target.closest('.speaker-samevoice');
    if (sameVoiceBtn) {
      _resolveVoiceMatch(parseInt(sameVoiceBtn.dataset.speakerId, 10), true, sameVoiceBtn.dataset.matchName);
      return;
    }
    const diffVoiceBtn = e.target.closest && e.target.closest('.speaker-diffvoice');
    if (diffVoiceBtn) {
      _resolveVoiceMatch(parseInt(diffVoiceBtn.dataset.speakerId, 10), false);
    }
  });
  detail.addEventListener('change', e => {
    const nameInput = e.target.closest && e.target.closest('.speaker-name-input');
    if (nameInput) { _saveSpeakerName(parseInt(nameInput.dataset.speakerId, 10), nameInput.value.trim()); return; }
    const colorInput = e.target.closest && e.target.closest('.speaker-color-input');
    if (colorInput) _saveSpeakerColor(parseInt(colorInput.dataset.speakerId, 10), colorInput.value);
  });
  detail.addEventListener('keydown', e => {
    const input = e.target.closest && e.target.closest('.speaker-name-input');
    if (input && e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });
});

Object.assign(window, { loadSpeakers });
})();
