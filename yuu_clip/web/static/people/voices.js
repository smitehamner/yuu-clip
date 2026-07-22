// Feature-map - People / project-wide speaker identity (code: ProjectVoice; UI "Person"/"People").
//   API: routes/voices.py Tests: tests/ui/test_ui_voices.py
// ── People view (PanelNav takeover) ────────────────────────────────────────────
// A project-level view listing every Person (a voice named once, applied across all
// recordings). Lists each Person's member recordings, pending cross-recording
// suggestions (confirm/dismiss inline), and rename/recolor/merge/split. Naming a
// Person here flows to every linked recording's captions/excerpts/exports because the
// server resolves display_name through the linked voice.
import { AppState } from '../core/state.js';
import { escHtml, plural, formatApiError } from '../core/format.js';
import { showToast } from '../core/utils.js';
import { showConfirm } from '../core/ui.js';
import { ColorPicker } from '../library/colorpicker.js';
import { PanelNav } from '../core/panelnav.js';
import { loadSpeakers } from './speakers.js';
import { selectClip } from '../clips/clips.js';
import { reloadVideoTranscriptIfOpen } from '../analyze/transcript.js';

function isPeopleOpen() {
  return PanelNav.isOpen('people');
}

function openPeopleView() {
  PanelNav.open({
    id: 'people',
    title: 'People',
    render: container => _peopleMount(container),
    isDirty: () => false,
    onClose: () => {},
  });
}

function _peopleMount(container) {
  container.innerHTML = `
    <div class="people-header">
      <p class="people-intro">A <strong>Person</strong> is one voice named once and applied across
        every recording. Name a Person here and the name shows up wherever that voice speaks.</p>
      <button class="btn ghost" id="people-backfill-btn"
              title="Group the speakers you have already named across recordings into people. Nothing is renamed - results appear here for you to review.">Find people across recordings</button>
    </div>
    <div id="people-list"><div class="transcript-empty">Loading&hellip;</div></div>`;
  container.addEventListener('click', _onPeopleClick);
  container.addEventListener('change', _onPeopleChange);
  _loadPeople();
}

let _peopleCache = [];
let _charactersCache = [];

async function _loadPeople() {
  const list = document.getElementById('people-list');
  if (!list) return;
  try {
    const [voices, chars] = await Promise.all([
      fetch('/api/voices').then(r => r.json()),
      fetch('/api/characters').then(r => r.json()).catch(() => []),
    ]);
    _peopleCache = Array.isArray(voices) ? voices : [];
    _charactersCache = Array.isArray(chars) ? chars : [];
    _renderPeople();
  } catch (_) {
    list.innerHTML = '<div class="transcript-empty">Could not load people.</div>';
  }
}

function _renderPeople() {
  const list = document.getElementById('people-list');
  if (!list) return;
  if (!_peopleCache.length) {
    list.innerHTML = `<div class="transcript-empty">No people yet. Open a recording's
      <strong>Speakers</strong> panel and choose <strong>Promote to Person</strong> on a named
      speaker to start.</div>`;
    return;
  }
  list.innerHTML = _peopleCache.map(_personCardHtml).join('');
  list.querySelectorAll('.voice-color-input').forEach(el => ColorPicker.attach(el));
}

function _personCardHtml(voice) {
  return `
    <div class="person-card" data-voice-id="${voice.id}">
      <div class="person-head">
        <input class="voice-color-input" type="color" data-voice-id="${voice.id}"
               value="${escHtml(voice.color)}" title="Caption color for this person"
               aria-label="Caption color for ${escHtml(voice.display_name)}">
        <input class="voice-name-input" type="text" data-voice-id="${voice.id}"
               value="${escHtml(voice.name || '')}" placeholder="Name this person&hellip;"
               aria-label="Name for ${escHtml(voice.display_name)}" maxlength="60">
        <span class="person-count">${plural(voice.member_count, 'recording')}</span>
        ${_mergeControlHtml(voice)}
      </div>
      ${_membersHtml(voice)}
      ${_characterControlHtml(voice)}
      ${_suggestionsHtml(voice)}
    </div>`;
}

// Optional overlay: link this Person to a world-context Character (lore + scoring
// boost). A project with no characters and no existing link shows no picker at all,
// so a zero-context workflow is visually unchanged.
function _characterControlHtml(voice) {
  const linkedId = voice.character ? voice.character.id : null;
  if (!_charactersCache.length && linkedId == null) return '';
  return `
    <div class="person-character">
      <label class="person-character-label" for="voice-char-${voice.id}">Character</label>
      <select class="voice-character-select" id="voice-char-${voice.id}" data-voice-id="${voice.id}"
              aria-label="World-context character for ${escHtml(voice.display_name)}">
        ${_characterOptions(voice.character)}
      </select>
    </div>`;
}

function _characterOptions(linked) {
  const selectedId = linked ? linked.id : null;
  const byContext = new Map();
  for (const c of _charactersCache) {
    const key = c.context_name || c.context_slug;
    if (!byContext.has(key)) byContext.set(key, []);
    byContext.get(key).push(c);
  }
  let html = `<option value="">No character</option>`;
  // If the linked character isn't in the loaded list (e.g. /api/characters failed to
  // load), still render it as the selected option from the Person's own data - otherwise
  // an existing link shows as "No character", which a subsequent save would clear.
  if (selectedId != null && !_charactersCache.some(c => c.id === selectedId)) {
    html += `<option value="${selectedId}" selected>${escHtml(linked.name || 'Linked character')}</option>`;
  }
  for (const [ctxName, chars] of byContext) {
    html += `<optgroup label="${escHtml(ctxName)}">`
          + chars.map(c => `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${escHtml(c.name)}</option>`).join('')
          + `</optgroup>`;
  }
  return html;
}

function _mergeControlHtml(voice) {
  const others = _peopleCache.filter(v => v.id !== voice.id);
  if (!others.length) return '';
  const opts = others.map(v =>
    `<option value="${v.id}">${escHtml(v.display_name)}</option>`).join('');
  return `
    <select class="voice-merge-select" data-voice-id="${voice.id}"
            aria-label="Merge another person into ${escHtml(voice.display_name)}">
      <option value="">Merge in&hellip;</option>${opts}
    </select>`;
}

function _membersHtml(voice) {
  if (!voice.members.length) {
    return '<div class="person-empty">No recordings linked yet.</div>';
  }
  const rows = voice.members.map(m => `
    <div class="person-member">
      <span class="person-member-name">${escHtml(m.display_name)}</span>
      <span class="person-member-file" title="${escHtml(m.video_filename)}">${escHtml(m.video_filename)}</span>
      <button class="btn ghost voice-detach-btn" data-voice-id="${voice.id}" data-speaker-id="${m.speaker_id}"
              title="Remove this recording's voice from ${escHtml(voice.display_name)}">Remove</button>
    </div>`).join('');
  return `<div class="person-members">${rows}</div>`;
}

function _suggestionsHtml(voice) {
  if (!voice.suggestions || !voice.suggestions.length) return '';
  const rows = voice.suggestions.map(s => `
    <div class="person-suggestion">
      <span class="person-member-file" title="${escHtml(s.video_filename)}">${escHtml(s.video_filename)}</span>
      <span class="person-suggestion-score">${Math.round((s.score || 0) * 100)}% voice match</span>
      <button class="btn primary voice-confirm-btn" data-speaker-id="${s.speaker_id}"
              title="Confirm this recording's voice is ${escHtml(voice.display_name)}">Same person</button>
      <button class="btn ghost voice-reject-btn" data-speaker-id="${s.speaker_id}"
              title="Not the same person">Not them</button>
    </div>`).join('');
  return `
    <div class="person-suggestions">
      <div class="person-suggestions-head">Possible matches from other recordings</div>
      ${rows}
    </div>`;
}

function _onPeopleClick(e) {
  if (e.target.closest('#people-backfill-btn')) {
    _backfillPeople(e.target.closest('#people-backfill-btn'));
    return;
  }
  const detach = e.target.closest('.voice-detach-btn');
  if (detach) {
    _splitPerson(parseInt(detach.dataset.voiceId, 10), parseInt(detach.dataset.speakerId, 10));
    return;
  }
  const confirmBtn = e.target.closest('.voice-confirm-btn');
  if (confirmBtn) {
    _resolveSuggestion(parseInt(confirmBtn.dataset.speakerId, 10), true);
    return;
  }
  const rejectBtn = e.target.closest('.voice-reject-btn');
  if (rejectBtn) {
    _resolveSuggestion(parseInt(rejectBtn.dataset.speakerId, 10), false);
  }
}

function _onPeopleChange(e) {
  const nameInput = e.target.closest('.voice-name-input');
  if (nameInput) {
    _saveVoice(parseInt(nameInput.dataset.voiceId, 10), {name: nameInput.value.trim()});
    return;
  }
  const colorInput = e.target.closest('.voice-color-input');
  if (colorInput) {
    _saveVoice(parseInt(colorInput.dataset.voiceId, 10), {color: colorInput.value});
    return;
  }
  const mergeSelect = e.target.closest('.voice-merge-select');
  if (mergeSelect && mergeSelect.value) {
    _mergePerson(parseInt(mergeSelect.dataset.voiceId, 10), parseInt(mergeSelect.value, 10));
    return;
  }
  const charSelect = e.target.closest('.voice-character-select');
  if (charSelect) {
    _setPersonCharacter(parseInt(charSelect.dataset.voiceId, 10),
      charSelect.value ? parseInt(charSelect.value, 10) : null);
  }
}

async function _setPersonCharacter(voiceId, characterId) {
  try {
    const res = await fetch(`/api/voices/${voiceId}/character`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({character_id: characterId}),
    });
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    showToast(characterId ? 'Character linked' : 'Character unlinked');
    await _loadPeople();
  } catch (err) {
    showToast(`Could not update: ${err.message}`, 'error');
  }
}

async function _saveVoice(voiceId, body) {
  try {
    const res = await fetch(`/api/voices/${voiceId}`, {
      method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    const updated = await res.json();
    if ('name' in body) showToast(updated.is_named ? `Named ${updated.display_name}` : 'Name cleared');
    await _loadPeople();
    _syncOpenRecording();
  } catch (err) {
    showToast(`Could not save: ${err.message}`, 'error');
  }
}

async function _mergePerson(targetId, otherId) {
  const other = _peopleCache.find(v => v.id === otherId);
  const target = _peopleCache.find(v => v.id === targetId);
  showConfirm(
    'Merge people?',
    `Merge ${other ? other.display_name : 'that person'} into ${target ? target.display_name : 'this person'}? `
      + 'Their recordings move over and the other person is removed.',
    'Merge',
    async () => {
      try {
        const res = await fetch(`/api/voices/${targetId}/merge`, {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({other_id: otherId}),
        });
        if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
        showToast('People merged');
        await _loadPeople();
        _syncOpenRecording();
      } catch (err) {
        showToast(`Could not merge: ${err.message}`, 'error');
      }
    },
  );
  await _loadPeople();  // reset the select whether or not they confirm
}

async function _splitPerson(voiceId, speakerId) {
  try {
    const res = await fetch(`/api/voices/${voiceId}/split`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({speaker_id: speakerId}),
    });
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    showToast('Recording removed from this person');
    await _loadPeople();
    _syncOpenRecording();
  } catch (err) {
    showToast(`Could not update: ${err.message}`, 'error');
  }
}

async function _resolveSuggestion(speakerId, same) {
  const endpoint = same ? 'confirm-voice' : 'reject-voice';
  try {
    const res = await fetch(`/api/speakers/${speakerId}/${endpoint}`, {method: 'POST'});
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    showToast(same ? 'Confirmed - same person' : 'Kept separate');
    await _loadPeople();
    _syncOpenRecording();
  } catch (err) {
    showToast(`Could not update: ${err.message}`, 'error');
  }
}

async function _backfillPeople(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Finding…'; }
  try {
    const res = await fetch('/api/voices/backfill', {method: 'POST'});
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    const data = await res.json();
    showToast(data.created
      ? `Found ${plural(data.created, 'person')} to review`
      : 'No new people found across your recordings');
    await _loadPeople();
    _syncOpenRecording();
  } catch (err) {
    showToast(`Could not find people: ${err.message}`, 'error');
  } finally {
    if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = 'Find people across recordings'; }
  }
}

// A People-view change can alter a display name in the currently open recording -
// refresh its Speakers card, transcript, and clip so it doesn't show a stale name.
function _syncOpenRecording() {
  const videoId = AppState.activeVideoId;
  if (videoId != null) loadSpeakers(videoId);
  if (videoId != null) reloadVideoTranscriptIfOpen(videoId);
  if (AppState.activeClipId != null) selectClip(AppState.activeClipId);
}

// Static index.html nav button (fixed element, never recreated - one load-time listener).
// Called once from boot.js at first paint (see initHotwordListeners in hotwords.js for
// the reference pattern) so importing this module has no DOM side effect.
function initVoicesListeners() {
  document.getElementById('btn-people')?.addEventListener('click', () => openPeopleView());
}

export { openPeopleView, isPeopleOpen, initVoicesListeners };
