// Feature-map - Speaker naming (code: Speaker; UI "Speakers" card).
//   API: routes/speakers.py · Tests: tests/ui/test_ui_speakers.py, tests/js/people/speakers.test.js
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
import { openPeopleView, refreshPeopleViewIfOpen } from './voices.js';

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
    // An LLM name suggestion (unconfirmed) is shown as a ghost value INSIDE the name
    // field with inline accept (check) / dismiss (cross), rather than a separate banner
    // beside an empty field. The value stays empty (so it never looks accepted); the
    // suggested name is the placeholder. Wrapped in .speaker-suggestion so the manual-
    // rename cleanup (_saveSpeakerName) can still drop a stale chip.
    const isSug = _isSuggestion(s);
    const inputValue = isSug ? '' : escHtml(s.name || '');
    const namePlaceholder = isSug ? escHtml(s.name) : 'Add a name&hellip;';
    const nameArea = `
      <div class="speaker-name-wrap">
        <input class="speaker-name-input${isSug ? ' is-suggested' : ''}" type="text" data-speaker-id="${s.id}"
               value="${inputValue}" placeholder="${namePlaceholder}"
               aria-label="Name for Speaker ${s.display_index}" maxlength="60">
        ${isSug ? `<span class="speaker-suggestion">
          <button class="speaker-accept" data-speaker-id="${s.id}" data-name="${escHtml(s.name)}"
                  title="Use the suggested name ${escHtml(s.name)}" aria-label="Accept suggested name ${escHtml(s.name)}">&#10003;</button>
          <button class="speaker-dismiss" data-speaker-id="${s.id}"
                  title="Dismiss suggestion" aria-label="Dismiss suggested name">&#10005;</button>
        </span>` : ''}
      </div>`;

    // Second-line status chips - each a distinct, consistently-styled pill, shown only
    // when present. A within-recording voiceprint near-miss ("same voice?") and a
    // cross-recording person near-miss ("same person?") stay visually separate.
    const chips = [];
    if (s.suggested_match_id && s.suggested_match_name) {
      chips.push(`<span class="speaker-chip speaker-voicematch" title="This voice is close to another speaker in this recording - confirm if it's the same person">
        Same voice as <strong>${escHtml(s.suggested_match_name)}</strong>? (${Math.round((s.suggested_match_score || 0) * 100)}%)
        <button class="speaker-samevoice" data-speaker-id="${s.id}" data-match-name="${escHtml(s.suggested_match_name)}" title="Merge into ${escHtml(s.suggested_match_name)}">Same voice</button>
        <button class="speaker-diffvoice" data-speaker-id="${s.id}" title="Keep as a separate speaker">Different</button>
      </span>`);
    }
    if (s.suggested_voice_id && s.suggested_voice_name) {
      // When the LLM name suggestion and this cross-recording match name the same
      // person, reframe so the two don't read as duplicate "X" banners.
      const agrees = isSug && s.name === s.suggested_voice_name;
      const lead = agrees
        ? `Also <strong>${escHtml(s.suggested_voice_name)}</strong> from another recording (${Math.round((s.suggested_voice_score || 0) * 100)}% match)`
        : `Might be <strong>${escHtml(s.suggested_voice_name)}</strong> from another recording (${Math.round((s.suggested_voice_score || 0) * 100)}% match)`;
      chips.push(`<span class="speaker-chip speaker-personmatch" title="This voice matches a person from another recording - confirm if it's the same person">
        ${lead}
        <button class="speaker-sameperson" data-speaker-id="${s.id}" data-match-name="${escHtml(s.suggested_voice_name)}" title="Confirm this is the same person">Same person</button>
        <button class="speaker-diffperson" data-speaker-id="${s.id}" title="Keep as a separate person">Not them</button>
      </span>`);
    }
    // Project-wide identity: a confirmed Person link, or a Promote action for a
    // confirmed-but-unlinked name. Promote only a CONFIRMED name (an unconfirmed
    // suggestion would mint an unnamed Person - accept it first).
    if (s.global_voice_id) {
      const overrideNote = s.identity_override
        ? ` <span class="speaker-override-note" title="Clear this speaker's name to go back to showing ${escHtml(s.person_name)} here">(showing its own name/color here)</span>`
        : '';
      chips.push(`<span class="speaker-chip speaker-person" title="This voice is part of a Person - one name across recordings">
        Person: <strong>${escHtml(s.person_name)}</strong>${overrideNote}
        <button class="speaker-open-people" title="Manage people">Manage</button>
        <button class="speaker-unlink-btn" data-speaker-id="${s.id}" data-voice-id="${s.global_voice_id}"
                data-person-name="${escHtml(s.person_name)}" title="Remove this recording from ${escHtml(s.person_name)}">Unlink</button>
      </span>`);
    } else if (s.name && s.confirmed) {
      chips.push(`<button class="btn ghost speaker-promote" data-speaker-id="${s.id}"
                   title="Use this name across every recording of this voice">Promote to Person</button>`);
    }
    const statusLine = chips.length ? `<div class="speaker-status">${chips.join('')}</div>` : '';

    return `
      <div class="speaker-row">
        <div class="speaker-identity">
          ${play}
          <span class="speaker-tag">Speaker ${s.display_index}</span>
          <input class="speaker-color-input" type="color" data-speaker-id="${s.id}"
                 value="${escHtml(s.color)}" title="Caption color for this speaker"
                 aria-label="Caption color for Speaker ${s.display_index}">
          ${nameArea}
          ${_speakerMergeHtml(s, speakers)}
          ${sample}
        </div>
        ${statusLine}
      </div>`;
  }).join('');
  return collapsibleCard('speakers',
        `<span class="detail-card-title">Speakers</span>`, `
      <div class="speaker-list">${rows}</div>
      <div class="speaker-hint">Names show up in clip transcripts and captions. They stick even if you re-analyze this recording.</div>`,
      { actions: `<span style="display:flex;gap:6px">
              <button class="btn ghost" style="font-size:11px;padding:3px 9px" data-act="rediarize-video" data-job-blocked data-video-id="${_currentVideoId}"
                title="Re-run speaker detection on the existing transcript. Clips and scores are kept; named speakers re-attach to matching voices.">Re-detect speakers</button>
              <button class="btn ghost speaker-new-btn" style="font-size:11px;padding:3px 9px"
                title="Add a speaker diarization missed or merged, then move lines onto it from the transcript.">+ New speaker</button>
              <button class="btn ghost speaker-suggest-btn" style="font-size:11px;padding:3px 9px"
                title="Use the LLM to suggest names from how speakers address each other. Suggestions are never applied until you accept them.">Suggest names</button>
            </span>` });
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

export async function _unlinkSpeaker(speakerId, voiceId, personName) {
  try {
    const res = await fetch(`/api/voices/${voiceId}/split`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({speaker_id: speakerId}),
    });
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    showToast(`Removed this recording from ${personName}`);
    await loadSpeakers(_currentVideoId);
    reloadVideoTranscriptIfOpen(_currentVideoId);
    refreshPeopleViewIfOpen();
  } catch (err) {
    showToast(`Could not unlink: ${err.message}`, 'error');
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
    const unlinkBtn = e.target.closest && e.target.closest('.speaker-unlink-btn');
    if (unlinkBtn) {
      const speakerId = parseInt(unlinkBtn.dataset.speakerId, 10);
      const voiceId = parseInt(unlinkBtn.dataset.voiceId, 10);
      const personName = unlinkBtn.dataset.personName;
      showConfirm(
        'Remove this recording from this person?',
        `This recording's voice becomes unlinked from ${personName} - you can link it again later from the voice match suggestions.`,
        'Unlink',
        () => _unlinkSpeaker(speakerId, voiceId, personName),
      );
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
