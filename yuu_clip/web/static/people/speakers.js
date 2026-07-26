// Feature-map - Speaker naming (code: Speaker; UI "Speakers" card).
//   API: routes/speakers.py · Tests: tests/ui/test_ui_speakers.py
// ── speaker naming ────────────────────────────────────────────────────────────
// Renders the "Speakers" card in the recording detail view and saves names.
// The card only appears when the recording has diarized speakers.
import { AppState } from '../core/state.js';
import { escHtml, truncate, plural, formatApiError } from '../core/format.js';
import { ColorPicker } from '../library/colorpicker.js';
import { appendLog, showToast, collapsibleCard } from '../core/utils.js';
import { showConfirm } from '../core/ui.js';
import {
  _blockedByAnalyze, _openSSE, _supersedeActiveStream, _clearActiveStream, _setActiveStream,
  startJobUI, updateJobUI, endJobUI, SPEAKER_NAMES_STEPS,
} from '../core/jobs.js';
import { selectClip } from '../clips/clips.js';
import { updateSpeakerLabelsInTranscript, reloadVideoTranscriptIfOpen } from '../analyze/transcript.js';
import { openPeopleView } from './voices.js';

let _currentVideoId = null;

export async function loadSpeakers(videoId) {
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
  section.querySelectorAll('.speaker-color-input').forEach(el => ColorPicker.attach(el));
}

// The auto-generated "Speaker N" placeholder label - never a real name. The server now
// filters these out of new suggestions, but this also hides any already written to the
// DB by an older run so a bogus "Suggested: Speaker 55" doesn't linger.
function _isPlaceholderName(name) {
  return /^\s*speaker\s+\d+\s*$/i.test(name || '');
}

// A speaker with an inferred name the user hasn't accepted yet. Its name stays out of
// captions/excerpts (server gates display_name on `confirmed`) until accepted here.
export function _isSuggestion(s) {
  return s.source === 'inferred' && !s.confirmed && !!s.name && !_isPlaceholderName(s.name);
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
    // Project-wide identity (Person). A confirmed link shows a read-only line into the
    // People view; a named-but-unlinked speaker can be promoted; a cross-recording
    // near-miss offers a confirm/dismiss chip (mirrors the same-recording voiceMatch).
    // Promote only a CONFIRMED name: an unconfirmed inferred suggestion (s.name set,
    // s.confirmed false) would mint an unnamed Person, since the server carries only a
    // confirmed name across. Accept the suggestion first.
    const person = s.global_voice_id
      ? `<span class="speaker-person" title="This voice is part of a Person - one name across recordings">
           Person: <strong>${escHtml(s.person_name)}</strong>
           <button class="speaker-open-people" title="Manage people">Manage</button>
         </span>`
      : ((s.name && s.confirmed)
          ? `<button class="btn ghost speaker-promote" data-speaker-id="${s.id}"
                     title="Use this name across every recording of this voice">Promote to Person</button>`
          : '');
    const personMatch = (s.suggested_voice_id && s.suggested_voice_name)
      ? `<span class="speaker-voicematch" title="This voice matches a person from another recording - confirm if it's the same person">
           Might be <strong>${escHtml(s.suggested_voice_name)}</strong> from another recording
           (${Math.round((s.suggested_voice_score || 0) * 100)}% voice match)
           <button class="speaker-sameperson" data-speaker-id="${s.id}" data-match-name="${escHtml(s.suggested_voice_name)}"
                   title="Confirm this is the same person">Same person</button>
           <button class="speaker-diffperson" data-speaker-id="${s.id}"
                   title="Keep as a separate person">Not them</button>
         </span>`
      : '';
    return `
      <div class="speaker-row">
        ${play}
        <span class="speaker-tag">Speaker ${s.display_index}</span>
        <input class="speaker-color-input" type="color" data-speaker-id="${s.id}"
               value="${escHtml(s.color)}" title="Caption color for this speaker"
               aria-label="Caption color for Speaker ${s.display_index}">
        <input class="speaker-name-input" type="text" data-speaker-id="${s.id}"
               value="${inputValue}" placeholder="Add a name&hellip;"
               aria-label="Name for Speaker ${s.display_index}" maxlength="60">
        ${_speakerMergeHtml(s, speakers)}
        ${suggestion}
        ${voiceMatch}
        ${person}
        ${personMatch}
        ${sample}
      </div>`;
  }).join('');
  return collapsibleCard('speakers',
        `<span class="detail-card-title">Speakers</span>`, `
      <div class="speaker-list">${rows}</div>
      <div class="speaker-hint">Names show up in clip transcripts and captions. They stick even if you re-analyze this recording.</div>`,
      { actions: `<button class="btn ghost speaker-new-btn"
                title="Add a speaker diarization missed or merged, then move lines onto it from the transcript.">+ New speaker</button>
              <button class="btn ghost speaker-suggest-btn"
                title="Use the LLM to suggest names from how speakers address each other. Suggestions are never applied until you accept them.">Suggest names</button>` });
}

// A per-row "Merge into..." picker (whole-speaker merge). Only shown when there is at
// least one other speaker to merge into.
function _speakerMergeHtml(speaker, speakers) {
  const others = speakers.filter(o => o.id !== speaker.id);
  if (!others.length) return '';
  const opts = others.map(o =>
    `<option value="${o.id}">${escHtml(o.display_name)}</option>`).join('');
  return `<select class="speaker-merge-select" data-speaker-id="${speaker.id}"
                  aria-label="Merge Speaker ${speaker.display_index} into another speaker">
            <option value="">Merge into&hellip;</option>${opts}</select>`;
}

// Streams the LLM inference job as SSE (the transcript pass can be slow). Mirrors
// _doRegenSummaryAuto: log lines while it runs, then reload the card so the fresh
// suggestions render. A typed result event carries how many names were applied.
function _suggestSpeakerNames() {
  if (!_currentVideoId) return;
  if (_blockedByAnalyze('suggest speaker names')) return;
  const videoId = _currentVideoId;
  const btn = document.querySelector('.speaker-suggest-btn');
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Suggesting…'; }
  _supersedeActiveStream();
  startJobUI(SPEAKER_NAMES_STEPS, 'Suggesting speaker names');
  const resetBtn = () => {
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = 'Suggest names'; }
  };
  const teardown = () => { resetBtn(); endJobUI(); };
  let suggestResult = null;
  const handle = _openSSE(
    `/api/videos/${videoId}/infer-speaker-names`,
    data => {
      updateJobUI(typeof data === 'string' ? data : JSON.stringify(data));
      appendLog(String(data));
    },
    async () => {
      _clearActiveStream(handle);
      teardown();
      const n = suggestResult?.suggested || 0;
      if (n > 0) showToast(`${plural(n, 'name suggestion')} - review and accept`);
      else showToast('No names could be inferred from the transcript', 'warning', { persist: true });
      await loadSpeakers(videoId);
    },
    errMsg => {
      _clearActiveStream(handle);
      teardown();
      showToast(`Name suggestion failed - ${errMsg}`, 'error');
    },
    {},
    null,
    data => { suggestResult = data; },
  );
  _setActiveStream(handle, teardown);
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

export async function _saveSpeakerName(speakerId, name) {
  const input = document.querySelector(`.speaker-name-input[data-speaker-id="${speakerId}"]`);
  if (input) input.disabled = true;
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
    if (input && !updated.is_named) input.value = '';
    showToast(updated.is_named ? `Speaker named ${updated.display_name}` : 'Name cleared');
    // Patch the name in place across every rendered transcript row (recording + open
    // clip) instead of reloading the whole panel - a full reload was disruptive while
    // editing inside the transcript. A rename changes only the label, never structure.
    updateSpeakerLabelsInTranscript(speakerId, { displayName: updated.display_name, color: updated.color });
    // A manual rename confirms the speaker server-side, but a stale "Suggested: ...
    // Dismiss" chip from an earlier inferred suggestion can still be sitting in this
    // row (no full-card reload ran to drop it) - if left in place, clicking its
    // Dismiss button would still fire and blank out the name just saved. Remove it now
    // that the row's own manual name has confirmed the speaker.
    input?.closest('.speaker-row')?.querySelector('.speaker-suggestion')?.remove();
  } catch (_) {
    showToast('Could not save speaker name', 'error');
  } finally {
    if (input) input.disabled = false;
  }
}

export async function _saveSpeakerColor(speakerId, color) {
  const input = document.querySelector(`.speaker-color-input[data-speaker-id="${speakerId}"]`);
  if (input) input.disabled = true;
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
    const updated = await res.json();
    // Patch the colour in place across rendered transcript rows (recording + open clip)
    // instead of reloading the whole panel.
    updateSpeakerLabelsInTranscript(speakerId, { color: updated.color });
  } catch (_) {
    showToast('Could not save speaker color', 'error');
  } finally {
    if (input) input.disabled = false;
  }
}

// Accept (name = the suggestion) or dismiss (name = "") an inferred suggestion.
// Both confirm the speaker server-side, so the suggestion prompt clears on reload.
export async function _resolveSuggestion(speakerId, name) {
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
export async function _resolveVoiceMatch(speakerId, sameVoice, matchName) {
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

// Add a fresh unnamed speaker to this recording, for a voice diarization missed or
// merged. Lines are moved onto it from the transcript or via "Merge into...".
export async function _createSpeaker() {
  if (!_currentVideoId) return;
  try {
    const res = await fetch(`/api/videos/${_currentVideoId}/speakers`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
    });
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    const speaker = await res.json();
    showToast(`Added ${speaker.display_name} - name it or move lines onto it`);
    await loadSpeakers(_currentVideoId);
  } catch (err) {
    showToast(`Could not add a speaker: ${err.message}`, 'error');
  }
}

// Whole-speaker merge: move every line of one speaker onto another. Confirmed first
// because it deletes the source speaker.
export async function _mergeSpeakerInto(sourceId, targetId, targetName) {
  showConfirm(
    'Merge speakers?',
    `Move all of this speaker's lines onto ${targetName || 'the other speaker'}? `
      + 'The merged speaker is removed. This affects clip transcripts and exports.',
    'Merge',
    async () => {
      try {
        const res = await fetch(`/api/speakers/${sourceId}/merge-into/${targetId}`, {method: 'POST'});
        if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
        showToast(`Merged into ${targetName || 'the other speaker'}`);
        if (_currentVideoId) await loadSpeakers(_currentVideoId);
        if (AppState.activeClipId) selectClip(AppState.activeClipId);
        if (_currentVideoId) reloadVideoTranscriptIfOpen(_currentVideoId);
      } catch (err) {
        showToast(`Could not merge: ${err.message}`, 'error');
      }
    },
  );
  if (_currentVideoId) await loadSpeakers(_currentVideoId);  // reset the select either way
}

// Promote a named speaker into a project-wide Person so the name applies across every
// recording of this voice. Reloads the card so the "Person: X" line appears.
export async function _promoteToPerson(speakerId) {
  try {
    const res = await fetch('/api/voices', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({speaker_id: speakerId}),
    });
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    const voice = await res.json();
    showToast(`${voice.display_name} is now a Person - name applies across recordings`);
    if (_currentVideoId) await loadSpeakers(_currentVideoId);
  } catch (err) {
    showToast(`Could not promote to Person: ${err.message}`, 'error');
  }
}

// Confirm ("Same person" -> confirm-voice) or dismiss ("Not them" -> reject-voice) a
// cross-recording Person suggestion. Confirming links this recording's voice to the
// Person, so its captions/excerpts pick up the Person's name.
export async function _resolvePersonMatch(speakerId, samePerson, matchName) {
  const endpoint = samePerson ? 'confirm-voice' : 'reject-voice';
  try {
    const res = await fetch(`/api/speakers/${speakerId}/${endpoint}`, {method: 'POST'});
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    showToast(samePerson
      ? `Linked to ${matchName || 'that person'}`
      : 'Kept as a separate person');
    if (_currentVideoId) await loadSpeakers(_currentVideoId);
    if (AppState.activeClipId) selectClip(AppState.activeClipId);
    if (_currentVideoId) reloadVideoTranscriptIfOpen(_currentVideoId);
  } catch (err) {
    showToast(`Could not update: ${err.message}`, 'error');
  }
}

// Event delegation on the persistent #detail element (its innerHTML is replaced
// each render, so per-row handlers would be lost - the container listener isn't).
// Called once from boot.js at first paint (see initHotwordListeners in hotwords.js
// for the reference pattern) so importing this module has no DOM side effect.
export function initSpeakerListeners() {
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
    if (e.target.closest && e.target.closest('.speaker-new-btn')) {
      _createSpeaker();
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
      return;
    }
    const promoteBtn = e.target.closest && e.target.closest('.speaker-promote');
    if (promoteBtn) {
      _promoteToPerson(parseInt(promoteBtn.dataset.speakerId, 10));
      return;
    }
    if (e.target.closest && e.target.closest('.speaker-open-people')) {
      openPeopleView();
      return;
    }
    const samePersonBtn = e.target.closest && e.target.closest('.speaker-sameperson');
    if (samePersonBtn) {
      _resolvePersonMatch(parseInt(samePersonBtn.dataset.speakerId, 10), true, samePersonBtn.dataset.matchName);
      return;
    }
    const diffPersonBtn = e.target.closest && e.target.closest('.speaker-diffperson');
    if (diffPersonBtn) {
      _resolvePersonMatch(parseInt(diffPersonBtn.dataset.speakerId, 10), false);
    }
  });
  detail.addEventListener('change', e => {
    const nameInput = e.target.closest && e.target.closest('.speaker-name-input');
    if (nameInput) { _saveSpeakerName(parseInt(nameInput.dataset.speakerId, 10), nameInput.value.trim()); return; }
    const colorInput = e.target.closest && e.target.closest('.speaker-color-input');
    if (colorInput) { _saveSpeakerColor(parseInt(colorInput.dataset.speakerId, 10), colorInput.value); return; }
    const mergeSelect = e.target.closest && e.target.closest('.speaker-merge-select');
    if (mergeSelect && mergeSelect.value) {
      _mergeSpeakerInto(parseInt(mergeSelect.dataset.speakerId, 10), parseInt(mergeSelect.value, 10),
                        mergeSelect.options[mergeSelect.selectedIndex].text);
    }
  });
  detail.addEventListener('keydown', e => {
    const input = e.target.closest && e.target.closest('.speaker-name-input');
    if (input && e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });
}
