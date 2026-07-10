(function () {
// Feature-map - Transcript views + click-to-edit captions (code: TranscriptSegment).
//   API: routes/videos.py, routes/scoring.py · Tests: tests/ui/test_ui_transcript.py, tests/integration/test_transcript_edit.py
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
function renderTranscriptLines(lines, opts) {
  opts = opts || {};
  const offsetS = opts.seekOffsetS || 0;
  const videoId = opts.videoId;
  const readOnly = !!opts.readOnly;
  if (!Array.isArray(lines) || !lines.length) {
    return '<div class="transcript-empty">No transcript available.</div>';
  }
  let prevSpeaker = null;
  const rows = lines.map(line => {
    const showSpeaker = line.speaker && line.speaker !== prevSpeaker;
    prevSpeaker = line.speaker;
    const colorAttr = line.color ? ` style="color:${escHtml(line.color)}"` : '';
    const speaker = showSpeaker
      ? `<div class="tline-speaker"${colorAttr}>${escHtml(line.speaker)}</div>`
      : '';
    const clock = _clock(line.start_ms);
    const seekS = (line.start_ms || 0) / 1000 + offsetS;
    const editable = !readOnly && line.seg_id != null;
    const editAttrs = editable
      ? ` data-seg-id="${line.seg_id}" role="button" tabindex="0" title="Click to edit caption"`
      : '';
    const spk = (videoId != null && line.speaker_id != null)
      ? `<button class="tline-spk${line.speaker_edited ? ' edited' : ''}"
                 data-seg-id="${line.seg_id}" data-speaker-id="${line.speaker_id}" data-video-id="${videoId}"
                 title="${line.speaker_edited ? 'Reassigned by you - c' : 'C'}hange or name this speaker"
                 aria-label="Change speaker">
           <span class="tline-spk-dot" style="background:${escHtml(line.color || '#888')}"></span></button>`
      : '';
    return `${speaker}<div class="tline" data-start-ms="${line.start_ms || 0}" data-end-ms="${line.end_ms || 0}">
      <button class="tline-play" data-seek-s="${seekS}"
              title="Jump to ${clock}" aria-label="Play from ${clock}">&#9654;</button>
      <span class="tline-time">${clock}</span>
      ${spk}
      <span class="tline-text${editable ? ' editable' : ''}"${editAttrs}>${escHtml(line.text)}</span>
    </div>`;
  }).join('');
  return `<div class="transcript-lines">${rows}</div>`;
}

async function loadClipTranscript(clipId) {
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
    el.innerHTML = renderTranscriptLines(data.lines, {seekOffsetS: data.seek_offset_s || 0, videoId});
    _videoTranscriptLoadedFor = videoId;
  } catch (_) {
    el.innerHTML = '<div class="transcript-empty">Could not load transcript.</div>';
  }
}

// Called after a speaker rename/recolor so the open recording transcript picks up
// the new label without a manual refresh. Clears the fetch-once cache and, if the
// full-transcript panel is expanded, reloads it in place.
function reloadVideoTranscriptIfOpen(videoId) {
  _videoTranscriptLoadedFor = null;
  const details = document.getElementById('video-transcript-details');
  if (details && details.open) loadVideoTranscript(videoId);
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
    ${items}
    <button class="spk-menu-item" data-reassign="">Unassigned</button>
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
    const reassign = e.target.closest('[data-reassign]');
    if (reassign) {
      const val = reassign.dataset.reassign;
      _reassignLine(segId, val === '' ? null : parseInt(val, 10), videoId);
      return;
    }
    if (e.target.closest('.spk-menu-save') && curId != null) {
      _renameSpeakerFromLine(curId, menu.querySelector('.spk-menu-name').value.trim(), videoId);
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

async function _reassignLine(segId, speakerId, videoId) {
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
  }
}

async function _renameSpeakerFromLine(speakerId, name, videoId) {
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
  }
}

function _refreshAfterSpeakerChange(videoId, affectedClipIds) {
  delete _videoSpeakersCache[videoId];
  if (window.loadSpeakers) loadSpeakers(videoId);
  reloadVideoTranscriptIfOpen(videoId);
  const openClip = AppState.activeClipId;
  if (openClip != null && (affectedClipIds == null || affectedClipIds.includes(openClip))
      && window.refreshClipDetail) {
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
  if (openId && affected.includes(openId) && window.refreshClipDetail) refreshClipDetail(openId);
}

document.addEventListener('DOMContentLoaded', () => {
  const detail = document.getElementById('detail');
  if (!detail) return;
  detail.addEventListener('click', e => {
    const spk = e.target.closest && e.target.closest('.tline-spk');
    if (spk) { e.stopPropagation(); _openSpeakerMenu(spk); return; }
    const text = e.target.closest && e.target.closest('.tline-text.editable');
    if (text) { startEditCaption(text); return; }
    const btn = e.target.closest && e.target.closest('.tline-play');
    if (btn) seekPlayerTo(parseFloat(btn.dataset.seekS));
  });
  detail.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const text = e.target.closest && e.target.closest('.tline-text.editable');
    if (text && !text.classList.contains('editing')) { e.preventDefault(); startEditCaption(text); }
  });
  // 'toggle' does not bubble - listen in the capture phase to catch it on the
  // <details> element, and lazy-load the full-video transcript on first expand.
  detail.addEventListener('toggle', e => {
    const d = e.target;
    if (d && d.id === 'video-transcript-details' && d.open) {
      loadVideoTranscript(parseInt(d.dataset.videoId, 10));
    }
  }, true);
});

Object.assign(window, {
  loadClipTranscript, loadVideoTranscript, reloadVideoTranscriptIfOpen,
  renderTranscriptLines, seekPlayerTo, startEditCaption,
});
})();
