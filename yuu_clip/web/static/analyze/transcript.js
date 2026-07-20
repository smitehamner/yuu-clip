// Feature-map - Transcript views + click-to-edit captions (code: TranscriptSegment).
//   API: routes/videos.py, routes/scoring.py · Tests: tests/ui/test_ui_transcript.py, tests/integration/test_transcript_edit.py
import { AppState } from '../core/state.js';
import { escHtml, plural, formatApiError } from '../core/format.js';
import { showToast } from '../core/utils.js';
import { loadSpeakers } from '../people/speakers.js';
import { refreshClipDetail } from '../clips/clips.js';

// ── timed transcript views ────────────────────────────────────────────────────
// Per-line transcript for a clip (clip-relative time) and for a whole recording
// (absolute time), each line with a ▶ that seeks the visible player. Works for
// diarized transcripts (speaker name shown when it changes) and plain ones
// (each caption segment becomes its own line). Each line's text is click-to-edit
// so mis-heard names/jargon can be fixed before re-scoring.

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

// opts.seekOffsetS is added to each line's play target - 0 for a clip (its player
// is trimmed to the clip) and the segment start for a split recording (whose player
// streams the untrimmed parent file). opts.videoId enables the per-line speaker
// control (rename / reassign); omit it to render a read-only transcript. opts.readOnly
// suppresses the click-to-edit-caption affordance even when a line carries a seg_id -
// used by the manual clip picker, where a line click selects a range instead.
export function renderTranscriptLines(lines, opts) {
  opts = opts || {};
  const offsetS = opts.seekOffsetS || 0;
  const videoId = opts.videoId;
  const readOnly = !!opts.readOnly;
  if (!Array.isArray(lines) || !lines.length) {
    return '<div class="transcript-empty">No transcript available.</div>';
  }
  // Show the per-line speaker dot on every line of a diarized transcript - including
  // ones the user set to Unassigned - so an unassigned line keeps a control to
  // reattribute it. A plain (never-diarized) transcript has no speakers, so no dots.
  const diarized = videoId != null && lines.some(l => l.speaker_id != null);
  let prevSpeaker = null;
  const rows = lines.map(line => {
    const showSpeaker = line.speaker && line.speaker !== prevSpeaker;
    prevSpeaker = line.speaker;
    const colorAttr = line.color ? ` style="color:${escHtml(line.color)}"` : '';
    // The speaker name label doubles as a rename control (same gate as the dot):
    // click "Speaker 1" and type the real name. Read-only transcripts (no videoId)
    // keep a plain label.
    const nameEditable = videoId != null && line.speaker_id != null;
    const nameEditAttrs = nameEditable
      ? ` data-speaker-id="${line.speaker_id}" data-video-id="${videoId}" role="button" tabindex="0" title="Click to rename this speaker"`
      : '';
    const speaker = showSpeaker
      ? `<div class="tline-speaker${nameEditable ? ' editable' : ''}"${colorAttr}${nameEditAttrs}>${escHtml(line.speaker)}</div>`
      : '';
    const clock = _clock(line.start_ms);
    const seekS = (line.start_ms || 0) / 1000 + offsetS;
    const editable = !readOnly && line.seg_id != null;
    const editAttrs = editable
      ? ` data-seg-id="${line.seg_id}" role="button" tabindex="0" title="Click to edit caption"`
      : '';
    // display_color is always set server-side; var(--muted) is a defensive fallback so
    // no hardcoded hex ever ships (no-hardcoded-colors rule).
    const dotColor = line.color ? escHtml(line.color) : 'var(--muted)';
    const spkName = line.speaker ? escHtml(line.speaker) : 'Unassigned';
    const spkIdAttr = line.speaker_id != null ? line.speaker_id : '';
    const spk = (diarized && line.seg_id != null)
      ? `<button class="tline-spk${line.speaker_edited ? ' edited' : ''}"
                 data-seg-id="${line.seg_id}" data-speaker-id="${spkIdAttr}" data-video-id="${videoId}"
                 title="${line.speaker_edited ? 'Reassigned by you - ' : ''}${spkName} - click to change or rename"
                 aria-label="Change or rename speaker">
           <span class="tline-spk-dot" style="background:${dotColor}"></span></button>`
      : '';
    return `${speaker}<div class="tline" data-start-ms="${line.start_ms || 0}" data-end-ms="${line.end_ms || 0}"
      data-seg-id="${line.seg_id != null ? line.seg_id : ''}" data-speaker-id="${line.speaker_id != null ? line.speaker_id : ''}">
      <button class="tline-play" data-seek-s="${seekS}"
              title="Jump to ${clock}" aria-label="Play from ${clock}">&#9654;</button>
      <span class="tline-time">${clock}</span>
      ${spk}
      <span class="tline-text${editable ? ' editable' : ''}"${editAttrs}>${escHtml(line.text)}</span>
    </div>`;
  }).join('');
  return `<div class="transcript-lines">${rows}</div>`;
}

export async function loadClipTranscript(clipId) {
  const el = document.getElementById('clip-transcript-view');
  if (!el) return;
  try {
    const data = await fetch(`/api/clips/${clipId}/transcript`).then(r => r.json());
    if (data.lines && data.lines.length) {
      el.innerHTML = renderTranscriptLines(data.lines, {videoId: AppState.activeVideoId});
    }
    // else: keep the plain excerpt already rendered as a fallback.
  } catch (_) {
    // Leave the excerpt fallback in place on error.
  }
}

let _videoTranscriptLoadedFor = null;
async function loadVideoTranscript(videoId) {
  const el = document.getElementById('video-transcript-view');
  if (!el) return;
  // Skip the fetch only when this video's transcript is still rendered. A bare
  // videoId match isn't enough: renderVideoDetail rebuilds #detail, leaving a
  // fresh empty #video-transcript-view while the flag still points here - that
  // combination is what left the panel silently blank on reopen.
  if (_videoTranscriptLoadedFor === videoId && el.childElementCount > 0) return;
  el.innerHTML = '<div class="transcript-empty">Loading…</div>';
  try {
    const data = await fetch(`/api/videos/${videoId}/transcript`).then(r => r.json());
    _resetLineSelect();
    const tools = (data.lines && data.lines.length) ? _lineMoveToolbar() : '';
    el.innerHTML = tools + renderTranscriptLines(data.lines, {seekOffsetS: data.seek_offset_s || 0, videoId});
    _videoTranscriptLoadedFor = videoId;
  } catch (_) {
    el.innerHTML = '<div class="transcript-empty">Could not load transcript.</div>';
  }
}

// ── multi-select "move lines to a speaker" (bulk split) ────────────────────────
// A selection mode on the full-recording transcript: pick several lines, then move
// them onto another speaker, a new one, or Unassigned in a single bulk call per source
// speaker (rebuilds excerpts + refreshes sidecars once). Only the recording transcript
// gets this - clip transcripts render without the toolbar.
const _lineMove = { videoId: null, active: false, selected: new Set() };

function _resetLineSelect() {
  _lineMove.active = false;
  _lineMove.selected = new Set();
}

function _lineMoveToolbar() {
  return `<div class="tx-move-bar" id="tx-move-bar">
    <button class="btn ghost tx-move-toggle" title="Select several lines and move them onto another speaker">Select lines to move</button>
  </div>`;
}

function _currentTranscriptVideoId() {
  const card = document.getElementById('video-transcript-details');
  return card ? parseInt(card.dataset.videoId, 10) : null;
}

async function _enterLineSelect() {
  _lineMove.videoId = _currentTranscriptVideoId();
  if (_lineMove.videoId == null) return;
  _lineMove.active = true;
  _lineMove.selected = new Set();
  document.getElementById('video-transcript-view')?.classList.add('select-mode');
  await _renderMoveBar();
}

function _exitLineSelect() {
  _resetLineSelect();
  const view = document.getElementById('video-transcript-view');
  if (view) {
    view.classList.remove('select-mode');
    view.querySelectorAll('.tline-selected').forEach(r => r.classList.remove('tline-selected'));
  }
  _renderMoveBar();
}

async function _renderMoveBar() {
  const bar = document.getElementById('tx-move-bar');
  if (!bar) return;
  if (!_lineMove.active) {
    bar.innerHTML = `<button class="btn ghost tx-move-toggle" title="Select several lines and move them onto another speaker">Select lines to move</button>`;
    return;
  }
  const speakers = await _getVideoSpeakers(_lineMove.videoId);
  const opts = speakers.map(s => `<option value="${s.id}">${escHtml(s.display_name)}</option>`).join('');
  bar.innerHTML = `
    <span class="tx-move-count">${plural(_lineMove.selected.size, 'line')} selected</span>
    <select class="tx-move-target" aria-label="Move selected lines to">
      <option value="">Move to&hellip;</option>${opts}
      <option value="__new__">+ New speaker</option>
      <option value="__none__">Unassigned</option>
    </select>
    <button class="btn ghost tx-move-cancel">Cancel</button>`;
}

function _toggleLineSelection(row) {
  const segId = parseInt(row.dataset.segId, 10);
  if (!segId || !row.dataset.speakerId) return;  // only attributed lines can be moved
  if (_lineMove.selected.has(segId)) {
    _lineMove.selected.delete(segId);
    row.classList.remove('tline-selected');
  } else {
    _lineMove.selected.add(segId);
    row.classList.add('tline-selected');
  }
  const count = document.querySelector('.tx-move-count');
  if (count) count.textContent = `${plural(_lineMove.selected.size, 'line')} selected`;
}

async function _moveSelectedLines(value) {
  const segIds = [..._lineMove.selected];
  const videoId = _lineMove.videoId;
  if (!segIds.length) { showToast('Select some lines first', 'warning'); await _renderMoveBar(); return; }
  try {
    const target = await _resolveMoveTarget(value, videoId);
    // The bulk endpoint moves lines of ONE source speaker, so group the selection by
    // each line's current speaker and call once per group.
    const groups = {};
    for (const segId of segIds) {
      const row = document.querySelector(`#video-transcript-view .tline[data-seg-id="${segId}"]`);
      const src = row && row.dataset.speakerId;
      if (src && parseInt(src, 10) !== target) (groups[src] = groups[src] || []).push(segId);
    }
    let moved = 0;
    for (const [src, ids] of Object.entries(groups)) {
      const res = await fetch(`/api/speakers/${src}/reassign-segments`, {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({seg_ids: ids, target_speaker_id: target}),
      });
      if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
      moved += (await res.json()).reassigned;
    }
    showToast(moved ? `Moved ${plural(moved, 'line')}` : 'Those lines were already on that speaker');
    _exitLineSelect();
    _refreshAfterSpeakerChange(videoId, null);
  } catch (err) {
    showToast(`Could not move lines: ${err.message}`, 'error');
    await _renderMoveBar();
  }
}

async function _resolveMoveTarget(value, videoId) {
  if (value === '__none__') return null;
  if (value !== '__new__') return parseInt(value, 10);
  const res = await fetch(`/api/videos/${videoId}/speakers`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
  });
  if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
  delete _videoSpeakersCache[videoId];
  return (await res.json()).id;
}

// Called after a speaker rename/recolor so the open recording transcript picks up
// the new label without a manual refresh. Clears the fetch-once cache and, if the
// full-transcript panel is expanded, reloads it in place.
export function reloadVideoTranscriptIfOpen(videoId) {
  _videoTranscriptLoadedFor = null;
  const card = document.getElementById('video-transcript-details');
  if (card && !card.classList.contains('collapsed')) loadVideoTranscript(videoId);
}

// ── per-line speaker control (rename + reassign) ───────────────────────────────
// A transcript line's speaker dot opens a menu to reattribute that one line to a
// different speaker (or detach it) and to name the line's current speaker without
// leaving the transcript. Speaker lists are cached per video and invalidated on any
// change so a fresh menu always reflects renames.
const _videoSpeakersCache = {};

async function _getVideoSpeakers(videoId) {
  if (_videoSpeakersCache[videoId]) return _videoSpeakersCache[videoId];
  const list = await fetch(`/api/videos/${videoId}/speakers`).then(r => r.json()).catch(() => []);
  _videoSpeakersCache[videoId] = Array.isArray(list) ? list : [];
  return _videoSpeakersCache[videoId];
}

let _openSpkMenu = null;

function _closeSpeakerMenu() {
  if (_openSpkMenu) { _openSpkMenu.remove(); _openSpkMenu = null; }
  document.removeEventListener('click', _onDocClickSpkMenu, true);
  document.removeEventListener('keydown', _onKeydownSpkMenu, true);
}

function _onDocClickSpkMenu(e) {
  if (_openSpkMenu && !_openSpkMenu.contains(e.target)) _closeSpeakerMenu();
}

function _onKeydownSpkMenu(e) {
  if (e.key === 'Escape') { e.preventDefault(); _closeSpeakerMenu(); }
}

async function _openSpeakerMenu(chip) {
  _closeSpeakerMenu();
  const segId = parseInt(chip.dataset.segId, 10);
  const curId = chip.dataset.speakerId ? parseInt(chip.dataset.speakerId, 10) : null;
  const videoId = parseInt(chip.dataset.videoId, 10);
  if (!videoId) return;
  const speakers = await _getVideoSpeakers(videoId);
  const cur = speakers.find(s => s.id === curId);

  const items = speakers.map(s =>
    `<button class="spk-menu-item${s.id === curId ? ' active' : ''}" data-reassign="${s.id}">
       <span class="spk-dot" style="background:${escHtml(s.color)}"></span>${escHtml(s.display_name)}</button>`
  ).join('');

  const menu = document.createElement('div');
  menu.className = 'spk-menu';
  menu.innerHTML = `
    <div class="spk-menu-head">Attribute this line to</div>
    <div class="spk-menu-list">
      ${items}
      <button class="spk-menu-item" data-reassign="">Unassigned</button>
      <button class="spk-menu-item spk-menu-new">+ New speaker</button>
    </div>
    <div class="spk-menu-sep"></div>
    <div class="spk-menu-head">Name ${escHtml(cur ? cur.display_name : 'this speaker')}</div>
    <div class="spk-menu-rename">
      <input type="text" class="spk-menu-name" maxlength="60" placeholder="Add a name&hellip;"
             value="${escHtml(cur && cur.name ? cur.name : '')}">
      <button class="btn primary spk-menu-save">Save</button>
    </div>`;
  document.body.appendChild(menu);

  const rect = chip.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 12));
  const top = Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  _openSpkMenu = menu;

  menu.addEventListener('click', e => {
    const newSpeakerBtn = e.target.closest('.spk-menu-new');
    if (newSpeakerBtn) { _newSpeakerForLine(segId, videoId, newSpeakerBtn); return; }
    const reassign = e.target.closest('[data-reassign]');
    if (reassign) {
      const val = reassign.dataset.reassign;
      _reassignLine(segId, val === '' ? null : parseInt(val, 10), videoId, reassign);
      return;
    }
    const saveBtn = e.target.closest('.spk-menu-save');
    if (saveBtn && curId != null) {
      _renameSpeakerFromLine(curId, menu.querySelector('.spk-menu-name').value.trim(), videoId, saveBtn);
    }
  });
  menu.querySelector('.spk-menu-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); menu.querySelector('.spk-menu-save').click(); }
  });

  // Defer wiring the dismiss handlers so the click that opened the menu doesn't close it.
  setTimeout(() => {
    document.addEventListener('click', _onDocClickSpkMenu, true);
    document.addEventListener('keydown', _onKeydownSpkMenu, true);
  }, 0);
}

// Create a fresh unnamed speaker (for a voice diarization missed or merged) and move
// this line onto it. The user can name it from its dot afterward. Reassignment reuses
// the same path as picking an existing speaker (rebuilds excerpts, refreshes the card).
async function _newSpeakerForLine(segId, videoId, triggerEl) {
  if (triggerEl) triggerEl.disabled = true;
  try {
    const res = await fetch(`/api/videos/${videoId}/speakers`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}',
    });
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    const speaker = await res.json();
    delete _videoSpeakersCache[videoId];
    await _reassignLine(segId, speaker.id, videoId);
    showToast(`Line moved to a new ${speaker.display_name}`);
  } catch (err) {
    showToast(`Could not add a speaker: ${err.message}`, 'error');
  } finally {
    if (triggerEl) triggerEl.disabled = false;
  }
}

// triggerEl (a menu button/chip) is disabled for the fetch's duration - the DB
// write it hits can retry through a lock for several seconds while an analyze
// run is in progress (with_write_retry, B6), and this is the only feedback the
// user gets that the click landed.
async function _reassignLine(segId, speakerId, videoId, triggerEl) {
  if (triggerEl) triggerEl.disabled = true;
  try {
    const res = await fetch(`/api/transcript-segments/${segId}/speaker`, {
      method: 'PUT', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({speaker_id: speakerId}),
    });
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))));
    const data = await res.json();
    _closeSpeakerMenu();
    const n = (data.affected_clip_ids || []).length;
    showToast(n ? `Speaker reassigned - ${plural(n, 'clip')} affected; re-score to refresh` : 'Speaker reassigned');
    _refreshAfterSpeakerChange(videoId, data.affected_clip_ids);
  } catch (err) {
    showToast(`Could not reassign speaker: ${err.message}`, 'error');
  } finally {
    if (triggerEl) triggerEl.disabled = false;
  }
}

async function _renameSpeakerFromLine(speakerId, name, videoId, triggerEl) {
  if (triggerEl) triggerEl.disabled = true;
  try {
    const res = await fetch(`/api/speakers/${speakerId}`, {
      method: 'PUT', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name}),
    });
    if (!res.ok) throw new Error('save failed');
    const updated = await res.json();
    _closeSpeakerMenu();
    showToast(updated.is_named ? `Speaker named ${updated.display_name}` : 'Name cleared');
    _refreshAfterSpeakerChange(videoId, null);
  } catch (_) {
    showToast('Could not save speaker name', 'error');
  } finally {
    if (triggerEl) triggerEl.disabled = false;
  }
}

// Inline rename straight from the transcript's speaker label - the discoverable path
// the dot menu's rename field duplicates. Prefills the speaker's raw name (empty when
// unnamed) so the placeholder invites a real name rather than editing the "Speaker N"
// fallback. On commit, _renameSpeakerFromLine reloads the transcript, replacing the label.
export async function startRenameSpeaker(label) {
  if (label.classList.contains('editing')) return;
  const speakerId = parseInt(label.dataset.speakerId, 10);
  const videoId = parseInt(label.dataset.videoId, 10);
  if (!speakerId || !videoId) return;
  // Claim the label BEFORE the await: the speaker fetch is uncached on first use, and
  // a second click during it would otherwise pass the guard too, appending a second
  // input and capturing `original` from the already-blanked label (so a later Escape
  // restored an empty name).
  const original = label.textContent;
  label.classList.add('editing');
  const speakers = await _getVideoSpeakers(videoId);
  const cur = speakers.find(s => s.id === speakerId);
  const prevName = cur && cur.name ? cur.name : '';
  label.textContent = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tline-speaker-input';
  input.maxLength = 60;
  input.placeholder = 'Name this speaker...';
  input.value = prevName;
  label.appendChild(input);
  input.focus();
  input.select();

  let settled = false;
  const finish = (commit) => {
    if (settled) return;
    settled = true;
    const next = input.value.trim();
    if (commit && next !== prevName) {
      _renameSpeakerFromLine(speakerId, next, videoId, input);
    } else {
      label.classList.remove('editing');
      label.textContent = original;
    }
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

function _refreshAfterSpeakerChange(videoId, affectedClipIds) {
  delete _videoSpeakersCache[videoId];
  loadSpeakers(videoId);
  reloadVideoTranscriptIfOpen(videoId);
  const openClip = AppState.activeClipId;
  if (openClip != null && (affectedClipIds == null || affectedClipIds.includes(openClip))) {
    refreshClipDetail(openClip);
  }
}

// ── inline caption editing ────────────────────────────────────────────────────
function startEditCaption(span) {
  if (span.classList.contains('editing')) return;
  const segId = span.dataset.segId;
  const original = span.textContent;
  span.classList.add('editing');
  span.innerHTML = '';

  const input = document.createElement('textarea');
  input.className = 'tline-edit-input';
  input.value = original;
  input.rows = Math.min(4, Math.max(1, Math.ceil(original.length / 48)));

  const actions = document.createElement('div');
  actions.className = 'tline-edit-actions';
  const save = document.createElement('button');
  save.className = 'btn primary';
  save.textContent = 'Save';
  const cancel = document.createElement('button');
  cancel.className = 'btn ghost';
  cancel.textContent = 'Cancel';
  actions.append(save, cancel);
  span.append(input, actions);
  input.focus();
  input.setSelectionRange(original.length, original.length);

  const restore = (text) => { span.classList.remove('editing'); span.textContent = text; };

  cancel.onclick = () => restore(original);
  input.onkeydown = ev => {
    if (ev.key === 'Escape') { ev.preventDefault(); restore(original); }
    else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); save.click(); }
  };
  save.onclick = async () => {
    const text = input.value.trim();
    if (!text) { showToast('Caption cannot be empty', 'warning'); return; }
    if (text === original) { restore(original); return; }
    save.disabled = cancel.disabled = true;
    try {
      const res = await fetch(`/api/caption-segments/${segId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatApiError(err));
      }
      const data = await res.json();
      restore(data.text);
      _onCaptionEdited(data);
    } catch (err) {
      save.disabled = cancel.disabled = false;
      showToast(`Could not save caption: ${err.message}`, 'error');
    }
  };
}

function _onCaptionEdited(data) {
  const affected = data.affected_clip_ids || [];
  showToast(affected.length
    ? `Caption updated - ${plural(affected.length, 'clip')} affected; re-score to refresh`
    : 'Caption updated');
  // Refresh the open clip's detail so its excerpt and the re-score notice update.
  const openId = AppState.activeClipId;
  if (openId && affected.includes(openId)) refreshClipDetail(openId);
}

document.addEventListener('DOMContentLoaded', () => {
  const detail = document.getElementById('detail');
  if (!detail) return;
  detail.addEventListener('click', e => {
    if (e.target.closest('.tx-move-toggle')) { _enterLineSelect(); return; }
    if (e.target.closest('.tx-move-cancel')) { _exitLineSelect(); return; }
    const view = document.getElementById('video-transcript-view');
    if (view && view.classList.contains('select-mode') && view.contains(e.target)) {
      // In select mode a line click toggles selection; playback still works, but the
      // dot menu and caption editing yield to selection.
      const play = e.target.closest('.tline-play');
      if (play) { seekPlayerTo(parseFloat(play.dataset.seekS)); return; }
      const row = e.target.closest('.tline');
      if (row) { _toggleLineSelection(row); return; }
    }
    const spkLabel = e.target.closest && e.target.closest('.tline-speaker.editable');
    if (spkLabel) {
      // Select mode owns clicks on the recording transcript while a bulk move is being
      // built - don't hijack one into a rename there. Clip transcripts have no select mode.
      const inView = spkLabel.closest('#video-transcript-view');
      if (inView && inView.classList.contains('select-mode')) return;
      startRenameSpeaker(spkLabel);
      return;
    }
    const spk = e.target.closest && e.target.closest('.tline-spk');
    if (spk) { e.stopPropagation(); _openSpeakerMenu(spk); return; }
    const text = e.target.closest && e.target.closest('.tline-text.editable');
    if (text) { startEditCaption(text); return; }
    const btn = e.target.closest && e.target.closest('.tline-play');
    if (btn) seekPlayerTo(parseFloat(btn.dataset.seekS));
  });
  detail.addEventListener('change', e => {
    const target = e.target.closest && e.target.closest('.tx-move-target');
    if (target && target.value) _moveSelectedLines(target.value);
  });
  detail.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const spkLabel = e.target.closest && e.target.closest('.tline-speaker.editable');
    if (spkLabel && !spkLabel.classList.contains('editing')) { e.preventDefault(); startRenameSpeaker(spkLabel); return; }
    const text = e.target.closest && e.target.closest('.tline-text.editable');
    if (text && !text.classList.contains('editing')) { e.preventDefault(); startEditCaption(text); }
  });
  // Lazy-load the full-video transcript the first time its collapsible card is
  // expanded (cardtoggle bubbles up from the card - see utils.js).
  detail.addEventListener('cardtoggle', e => {
    if (e.detail.key === 'video-transcript' && !e.detail.collapsed) {
      const card = document.getElementById('video-transcript-details');
      if (card) loadVideoTranscript(parseInt(card.dataset.videoId, 10));
    }
  });
});
