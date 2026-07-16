// Feature-map - Manual clip (code: "manual" tag on ClipCandidate).
//   API: routes/clips/crud.py (create_manual_clip) · Tests: tests/ui/test_ui_clipcreate.py, tests/integration/test_clip_create.py
// ── manual clip creation picker ───────────────────────────────────────────────
// Lets the creator pick an arbitrary time window from a recording's transcript
// (or, with no transcript, from typed times) and create a clip from it. The
// clip then goes through the normal review pipeline: it's created "pending"
// and LLM-scored right away via the existing rescoreClip() SSE flow - there is
// no separate "manual, unscored" state.
//
// The picker gets its own inline preview video (like split.js's split-preview-video)
// rather than reusing #player-area - PanelNav's takeover panel visually covers
// #player-area while open, so seeking that hidden element would give no visible
// feedback for "Play selection".

import { AppState } from './state.js';
import { formatApiError } from './format.js';
import { PanelNav } from './panelnav.js';
import { setupRecordingPreview } from './preview.js';
import { showToast } from './utils.js';
import { selectClip, _reloadClipList } from './clips.js';

let _ccVideoId    = null;
let _ccKind       = 'clip';
let _ccDurationMs = 0;
let _ccSeekOffsetS = 0;
let _ccStartMs    = null;
let _ccEndMs      = null;
let _ccPlaybackGuard = null;

export function isClipCreateOpen() {
  return PanelNav.isOpen('clip-create');
}

// kind: 'clip' (default) or 'scene' - a scene reuses this exact picker, differing
// only in the created row's kind, the panel copy, and (Stage 0) skipping the
// auto-rescore chain (scene scoring lands in a later stage).
export function openClipCreatePicker(videoId, kind = 'clip') {
  if (!videoId) { showToast('Select a recording first', 'warning'); return; }
  const video = AppState.videos.find(v => v.id === videoId);
  if (!video) return;

  _ccVideoId     = videoId;
  _ccKind        = kind === 'scene' ? 'scene' : 'clip';
  _ccDurationMs  = video.duration_ms || 0;
  _ccSeekOffsetS = 0;
  _ccStartMs     = null;
  _ccEndMs       = null;

  const noun = _ccKind === 'scene' ? 'scene' : 'clip';
  PanelNav.open({
    id: 'clip-create',
    title: `New ${noun}: ${video.title || video.filename}`,
    render: container => _mountClipCreatePanel(container, video),
    isDirty: () => _ccStartMs != null || _ccEndMs != null,
    onClose: _teardownClipCreatePanel,
  });
}

function _mountClipCreatePanel(container, video) {
  container.innerHTML = `
    <div style="position:relative">
      <video id="clipcreate-preview-video" controls preload="metadata" aria-label="Recording preview"
             style="display:block;width:100%;max-height:38vh;object-fit:contain;background:#000;border-radius:6px"></video>
      <span id="clipcreate-preview-badge" role="status"
            style="display:none;position:absolute;top:8px;left:8px;background:rgba(0,0,0,.7);color:#e6e6e6;font-size:11px;padding:3px 8px;border-radius:4px"></span>
    </div>
    <div style="font-size:12px;color:var(--muted)">
      Click a transcript line to set the start, then click a later line to set the end - or type exact times below.
    </div>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div id="clipcreate-range-header" style="font-size:14px;font-weight:600"></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">Start
        <input type="text" id="clipcreate-start-input" placeholder="0:00" aria-label="Clip start time (h:mm:ss or m:ss)"
               style="width:70px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px">
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">End
        <input type="text" id="clipcreate-end-input" placeholder="0:00" aria-label="Clip end time (h:mm:ss or m:ss)"
               style="width:70px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px">
      </label>
      <button class="btn ghost" id="clipcreate-play-btn" disabled>&#9654; Play selection</button>
    </div>
    <div id="clipcreate-transcript-view" class="transcript"><div class="transcript-empty">Loading…</div></div>
    <div style="display:flex;justify-content:flex-end">
      <button class="btn primary" id="clipcreate-confirm-btn" disabled>Create ${_ccKind === 'scene' ? 'scene' : 'clip'}</button>
    </div>
  `;

  document.getElementById('clipcreate-start-input').onchange = e => _ccApplyTimeInput('start', e.target.value);
  document.getElementById('clipcreate-end-input').onchange   = e => _ccApplyTimeInput('end', e.target.value);
  document.getElementById('clipcreate-play-btn').onclick      = _ccPlaySelection;
  document.getElementById('clipcreate-confirm-btn').onclick   = _ccConfirmCreate;
  document.getElementById('clipcreate-transcript-view').addEventListener('click', _ccOnTranscriptClick);

  setupRecordingPreview(
    document.getElementById('clipcreate-preview-video'),
    document.getElementById('clipcreate-preview-badge'),
    video.id,
    {
      autoBuild: false,
      isCurrent: () => _ccVideoId === video.id,
      startS: video.segment_start_s,
      endS: video.segment_end_s,
      sourcePath: video.source_path,
    },
  );

  _ccRenderHeader();
  _ccLoadTranscript(video.id);
}

async function _ccLoadTranscript(videoId) {
  const el = document.getElementById('clipcreate-transcript-view');
  try {
    const data = await fetch(`/api/videos/${videoId}/transcript`).then(r => r.json());
    if (_ccVideoId !== videoId || !el) return;
    _ccSeekOffsetS = data.seek_offset_s || 0;
    const lines = data.lines || [];
    if (!lines.length) {
      el.innerHTML = '<div class="transcript-empty">No transcript yet - the clip will have no excerpt ' +
        'until this recording is (re)transcribed. Use the time inputs above to pick a range.</div>';
      return;
    }
    el.innerHTML = window.renderTranscriptLines(lines, { seekOffsetS: _ccSeekOffsetS, readOnly: true });
    el.querySelectorAll('.tline').forEach(row => row.classList.add('cc-pickable'));
    _ccRenderSelectionHighlight();
  } catch (_) {
    if (el) el.innerHTML = '<div class="transcript-empty">Could not load transcript.</div>';
  }
}

function _ccOnTranscriptClick(e) {
  const playBtn = e.target.closest('.tline-play');
  if (playBtn) { _ccSeekTo(parseFloat(playBtn.dataset.seekS)); return; }
  const row = e.target.closest('.tline');
  if (!row) return;
  const startMs = parseInt(row.dataset.startMs, 10);
  const endMs   = parseInt(row.dataset.endMs, 10);
  if (isNaN(startMs) || isNaN(endMs)) return;
  _ccPickLine(startMs, endMs);
}

// First click (or a click before the current start) sets the start and clears
// any end; a click at or after the current start sets the end - clicking the
// same line twice yields a 1-line clip.
function _ccPickLine(lineStartMs, lineEndMs) {
  if (_ccStartMs == null || lineStartMs < _ccStartMs) {
    _ccStartMs = lineStartMs;
    _ccEndMs   = null;
  } else {
    _ccEndMs = lineEndMs;
  }
  _ccRenderHeader();
}

function _ccApplyTimeInput(which, raw) {
  const ms = _ccParseTimeToMs(raw);
  if (ms == null) {
    showToast(`Couldn't read "${raw}" - use h:mm:ss or m:ss`, 'error');
    _ccRenderHeader();
    return;
  }
  if (ms < 0 || (_ccDurationMs > 0 && ms > _ccDurationMs)) {
    showToast(`Time must be between 0:00 and ${_ccFmt(_ccDurationMs)}`, 'error');
    _ccRenderHeader();
    return;
  }
  if (which === 'start') _ccStartMs = ms; else _ccEndMs = ms;
  _ccRenderHeader();
}

function _ccParseTimeToMs(str) {
  const parts = (str || '').trim().split(':').map(Number);
  if (!parts.length || parts.some(isNaN)) return null;
  let sec;
  if (parts.length === 3)      sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) sec = parts[0] * 60 + parts[1];
  else if (parts.length === 1) sec = parts[0];
  else return null;
  return Math.round(sec * 1000);
}

function _ccFmt(ms) {
  const s  = Math.round((ms || 0) / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

function _ccRenderHeader() {
  const header      = document.getElementById('clipcreate-range-header');
  const playBtn      = document.getElementById('clipcreate-play-btn');
  const confirmBtn   = document.getElementById('clipcreate-confirm-btn');
  const startInput   = document.getElementById('clipcreate-start-input');
  const endInput     = document.getElementById('clipcreate-end-input');
  if (startInput && document.activeElement !== startInput) startInput.value = _ccStartMs != null ? _ccFmt(_ccStartMs) : '';
  if (endInput && document.activeElement !== endInput)     endInput.value   = _ccEndMs   != null ? _ccFmt(_ccEndMs)   : '';

  if (header) {
    if (_ccStartMs == null) {
      header.textContent = 'No range picked yet';
      header.style.color = 'var(--muted)';
    } else if (_ccEndMs == null) {
      header.textContent = `Start ${_ccFmt(_ccStartMs)} - pick an end`;
      header.style.color = 'var(--muted)';
    } else {
      const durationS = Math.round((_ccEndMs - _ccStartMs) / 1000);
      header.textContent = `${_ccFmt(_ccStartMs)} – ${_ccFmt(_ccEndMs)} (${durationS}s)`;
      header.style.color = 'var(--text)';
    }
  }
  const hasRange = _ccStartMs != null && _ccEndMs != null && _ccEndMs > _ccStartMs;
  if (playBtn)    playBtn.disabled    = !hasRange;
  if (confirmBtn) confirmBtn.disabled = !hasRange;
  _ccRenderSelectionHighlight();
}

function _ccRenderSelectionHighlight() {
  const container = document.getElementById('clipcreate-transcript-view');
  if (!container) return;
  container.querySelectorAll('.tline').forEach(row => {
    const startMs = parseInt(row.dataset.startMs, 10);
    const inRange = _ccStartMs != null && (
      (_ccEndMs != null && startMs >= _ccStartMs && startMs < _ccEndMs) ||
      (_ccEndMs == null && startMs === _ccStartMs)
    );
    row.classList.toggle('cc-selected', inRange);
  });
}

function _ccSeekTo(seconds) {
  const video = document.getElementById('clipcreate-preview-video');
  if (!video) return;
  video.currentTime = Math.max(0, seconds || 0);
  const attempt = video.play();
  if (attempt && attempt.catch) attempt.catch(() => {});
}

function _ccPlaySelection() {
  if (_ccStartMs == null || _ccEndMs == null) return;
  const video = document.getElementById('clipcreate-preview-video');
  if (!video) return;
  if (_ccPlaybackGuard) video.removeEventListener('timeupdate', _ccPlaybackGuard);
  const endS = _ccEndMs / 1000 + _ccSeekOffsetS;
  _ccPlaybackGuard = () => {
    if (video.currentTime >= endS) {
      video.pause();
      video.removeEventListener('timeupdate', _ccPlaybackGuard);
      _ccPlaybackGuard = null;
    }
  };
  video.addEventListener('timeupdate', _ccPlaybackGuard);
  _ccSeekTo(_ccStartMs / 1000 + _ccSeekOffsetS);
}

async function _ccConfirmCreate() {
  const btn = document.getElementById('clipcreate-confirm-btn');
  if (!btn || btn.disabled) return;
  if (_ccStartMs == null || _ccEndMs == null || _ccEndMs <= _ccStartMs) return;
  const videoId = _ccVideoId;
  const kind = _ccKind;
  const noun = kind === 'scene' ? 'scene' : 'clip';
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    const res = await fetch(`/api/videos/${videoId}/clips`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({start_ms: _ccStartMs, end_ms: _ccEndMs, kind}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatApiError(err));
    }
    const clip = await res.json();
    _ccStartMs = _ccEndMs = null;  // clears isDirty() before PanelNav tears the panel down
    PanelNav.forceClose();
    await _reloadClipList(videoId);
    selectClip(clip.id);
    // Both kinds auto-score on creation - clips via the Funny/Dramatic/Action prompt,
    // scenes via the scene rubric (the rescore route picks the prompt by kind).
    showToast(`${noun === 'scene' ? 'Scene' : 'Clip'} created - scoring…`);
    window.rescoreClip(clip.id);
  } catch (err) {
    showToast(`Could not create ${noun}: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = `Create ${noun}`;
  }
}

function _teardownClipCreatePanel() {
  const video = document.getElementById('clipcreate-preview-video');
  if (video) {
    if (_ccPlaybackGuard) video.removeEventListener('timeupdate', _ccPlaybackGuard);
    try { video.pause(); } catch (_) { /* ignore */ }
    video.src = '';
  }
  _ccPlaybackGuard = null;
  _ccVideoId    = null;
  _ccKind       = 'clip';
  _ccStartMs    = null;
  _ccEndMs      = null;
}
