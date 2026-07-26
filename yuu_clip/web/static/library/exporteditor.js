import { AppState } from '../core/state.js';
import { escHtml, formatApiError, fmtClock } from '../core/format.js';
import { PanelNav } from '../core/panelnav.js';
import { setupRecordingPreview, releaseVideoRespectingPip } from '../core/preview.js';
import { showToast } from '../core/utils.js';
import { streamSSE, setJobCancel } from '../core/jobs.js';
import { renderPlayer, renderDetail, _reloadClipList } from '../clips/clips.js';
import { loadVideos } from '../videos/videos.js';
import { SoundFx } from './sounds.js';
import { ensureExportPresetsCache, exportPresetIsVertical } from './exportpresets.js';

// Feature-map - Clip export editor (Trim + Vertical framing + Caption Style over a live preview).
//   API: routes/clips/ (captions.py context-transcript, export.py)
//   Tests: tests/ui/test_ui_exporteditor.py, tests/js/library/exporteditor.test.js
// ── clip export editor (Plan 07) ──────────────────────────────────────────────
// A PanelNav takeover launched before final export: transcript-driven trim with
// extendable ±30 s context, a drag-to-position 9:16 crop box, and a live caption
// preview. It edits the same start_offset/end_offset/crop_x the export dialog
// does (no new timing model, no new encode path) and, on Export, runs the exact
// single-clip export SSE the dialog uses.
//
// Own inline preview <video>: PanelNav's panel visually covers #player-area
// (known coverage bug), so the editor never relies on the main player - it
// embeds its own, proxy-preferred, exactly like the manual-clip picker.

let _edClipId       = null;
let _edClip         = null;   // saved baseline (start_offset/end_offset/crop_x)
let _edVideo        = null;   // parent recording (from AppState.videos)
let _edConfig       = {};     // caption-style defaults from /api/config
let _edLines        = [];     // context transcript (recording-relative ms)
let _edSeekOffsetS  = 0;      // segment_start_s - added to seek the parent player
let _edAspect       = 16 / 9; // source frame aspect (iw/ih), refined on metadata

let _edStartOffset  = 0;
let _edEndOffset    = 0;
let _edCropX        = 0.5;
let _edPreset       = '';
let _edCaptionMode  = 'embed'; // none | embed | burn
let _edTitleCard    = false;
let _edMetaSeeked   = false;

const _ED_MIN_DURATION_MS = 1_000;
const _ED_PAD_S = 30;

export function isExportEditorOpen() {
  return PanelNav.isOpen('export-editor');
}

export async function openExportEditor(clipId) {
  const clip = await fetch(`/api/clips/${clipId}`).then(r => r.ok ? r.json() : null).catch(() => null);
  if (!clip) { showToast('Could not load clip', 'error'); return; }
  const video = AppState.videos.find(v => v.id === clip.video_id);
  if (!video) { showToast('Open the recording first', 'warning'); return; }

  await ensureExportPresetsCache();
  _edConfig = await fetch('/api/config').then(r => r.ok ? r.json() : {}).catch(() => ({}));

  _edClipId      = clipId;
  _edClip        = clip;
  _edVideo       = video;
  _edLines       = [];
  _edSeekOffsetS = video.segment_start_s || 0;
  _edAspect      = 16 / 9;
  _edStartOffset = clip.start_offset || 0;
  _edEndOffset   = clip.end_offset || 0;
  _edCropX       = clip.crop_x == null ? 0.5 : clip.crop_x;
  _edPreset      = '';
  _edCaptionMode = 'embed';
  _edTitleCard   = false;
  _edMetaSeeked  = false;

  PanelNav.open({
    id: 'export-editor',
    title: `Edit & export: Clip #${clipId}`,
    render: container => _edMount(container),
    isDirty: _edIsDirty,
    onClose: _edTeardown,
  });
  _edLoadContextTranscript();
}

function _edIsDirty() {
  const savedCrop = _edClip.crop_x == null ? 0.5 : _edClip.crop_x;
  return _edStartOffset !== (_edClip.start_offset || 0)
      || _edEndOffset   !== (_edClip.end_offset || 0)
      || _edCropX       !== savedCrop;
}

// ── mount / teardown ──────────────────────────────────────────────────────────

function _edMount(container) {
  container.innerHTML = `
    <div style="font-size:12px;color:var(--muted)">
      Trim with the transcript, frame the vertical crop, preview captions, then export - in one place.
      Just need a quick export with no visual tools? Cancel and use the plain <strong>Export</strong> button instead.
    </div>
    <div id="ed-preview-wrap" style="position:relative;height:42vh;aspect-ratio:16/9;max-width:100%;margin:0 auto;background:#000;border-radius:6px;overflow:hidden">
      <video id="ed-video" controls preload="metadata" aria-label="Clip preview"
             style="display:block;width:100%;height:100%;object-fit:contain;background:#000"></video>
      <div id="ed-crop-box" aria-hidden="true"
           style="display:none;position:absolute;top:0;bottom:0;border:2px solid var(--accent);box-sizing:border-box;box-shadow:0 0 0 9999px rgba(0,0,0,.5);cursor:ew-resize"></div>
      <div id="ed-caption-overlay" aria-hidden="true"
           style="display:none;position:absolute;left:6%;right:6%;bottom:6%;text-align:center;pointer-events:none;font-weight:600;line-height:1.3;text-shadow:0 1px 3px rgba(0,0,0,.9)"></div>
      <span id="ed-badge" role="status"
            style="display:none;position:absolute;top:8px;left:8px;background:rgba(0,0,0,.7);color:var(--on-scrim);font-size:11px;padding:3px 8px;border-radius:4px"></span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">
      <button class="btn ghost" id="ed-play-btn" title="Play the trimmed clip on a loop">&#9654; Play selection</button>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">Start
        <button class="btn ghost ed-nudge" data-edge="start" data-delta="-0.5" title="Start 0.5s earlier">&minus;0.5s</button>
        <strong id="ed-start-read" style="color:var(--text);font-family:monospace;min-width:70px;text-align:center"></strong>
        <button class="btn ghost ed-nudge" data-edge="start" data-delta="0.5" title="Start 0.5s later">+0.5s</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">End
        <button class="btn ghost ed-nudge" data-edge="end" data-delta="-0.5" title="End 0.5s earlier">&minus;0.5s</button>
        <strong id="ed-end-read" style="color:var(--text);font-family:monospace;min-width:70px;text-align:center"></strong>
        <button class="btn ghost ed-nudge" data-edge="end" data-delta="0.5" title="End 0.5s later">+0.5s</button>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text)">Duration <span id="ed-duration" style="font-family:monospace"></span></div>
      <button class="btn ghost" id="ed-reset-trim" style="font-size:12px" title="Reset the trim to the original clip window">Reset trim</button>
    </div>
    <div style="font-size:11px;color:var(--muted)">Click a line's <strong>&#8676;</strong> to start the clip there or <strong>&#8677;</strong> to end it. Highlighted lines are inside the clip.</div>
    <div id="ed-transcript" class="transcript" style="max-height:24vh;overflow-y:auto"><div class="transcript-empty">Loading transcript…</div></div>
    <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;border-top:1px solid var(--border);padding-top:12px">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)">Preset
        <select id="ed-preset" aria-label="Export preset" style="padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px">${_edPresetOptionsHtml('')}</select>
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted)">Captions
        <select id="ed-captions" aria-label="Captions" style="padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px">
          <option value="none">None</option>
          <option value="embed" selected>Embed captions - toggle on/off in your player (fast, no re-encode)</option>
          <option value="burn">Burn in captions - can't turn off later (slower, re-encodes)</option>
        </select>
      </label>
      <span id="ed-caption-approx" style="font-size:11px;color:var(--muted)">Caption overlay is a preview approximation.</span>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
        <input type="checkbox" id="ed-title-card"> Title card
      </label>
      <button class="btn-secondary" id="ed-autoframe-btn" style="display:none;font-size:12px;padding:4px 8px" title="Suggest a crop position from faces (MediaPipe)">Auto-frame on faces</button>
      <span id="ed-autoframe-note" style="font-size:11px;color:var(--muted)"></span>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn ghost" id="ed-cancel-btn">Cancel</button>
        <button class="btn primary" id="ed-export-btn">Export</button>
      </div>
    </div>`;

  _edWire(container);
  _edSetupPreview();
  _edRenderReadouts();
  _edUpdateVerticalControls();
  _edApplyCaptionStyle();
}

function _edWire(container) {
  document.getElementById('ed-play-btn').onclick   = _edPlaySelection;
  document.getElementById('ed-reset-trim').onclick = _edResetTrim;
  document.getElementById('ed-cancel-btn').onclick = () => PanelNav.close();
  document.getElementById('ed-export-btn').onclick = _edExport;
  document.getElementById('ed-autoframe-btn').onclick = _edAutoFrame;
  document.getElementById('ed-crop-box').addEventListener('pointerdown', _edCropPointerDown);
  document.getElementById('ed-preset').onchange = e => { _edPreset = e.target.value; _edUpdateVerticalControls(); };
  document.getElementById('ed-captions').onchange = e => {
    _edCaptionMode = e.target.value;
    _edUpdateCaptionOverlay(_edCurrentRecordingMs());
    document.getElementById('ed-caption-approx').style.visibility = _edCaptionMode === 'burn' ? 'visible' : 'hidden';
  };
  document.getElementById('ed-title-card').onchange = e => { _edTitleCard = e.target.checked; };
  container.querySelectorAll('.ed-nudge').forEach(btn => {
    btn.onclick = () => _edNudge(btn.dataset.edge, parseFloat(btn.dataset.delta));
  });
  document.getElementById('ed-transcript').addEventListener('click', _edOnTranscriptClick);
}

function _edSetupPreview() {
  const videoEl = document.getElementById('ed-video');
  setupRecordingPreview(
    videoEl,
    document.getElementById('ed-badge'),
    _edVideo.id,
    { autoBuild: true, isCurrent: () => _edVideo && _edClipId != null, sourcePath: _edVideo.source_path },
  );
  videoEl.addEventListener('loadedmetadata', _edOnMetadata);
  videoEl.addEventListener('timeupdate', _edOnTimeUpdate);
}

function _edTeardown() {
  const videoEl = document.getElementById('ed-video');
  if (videoEl) {
    videoEl.removeEventListener('loadedmetadata', _edOnMetadata);
    videoEl.removeEventListener('timeupdate', _edOnTimeUpdate);
    releaseVideoRespectingPip(videoEl, () => {
      try { videoEl.pause(); } catch (_) { /* ignore */ }
      videoEl.src = '';
    });
  }
  _edClipId = null;
  _edClip   = null;
  _edVideo  = null;
  _edLines  = [];
}

// ── transcript context ────────────────────────────────────────────────────────

async function _edLoadContextTranscript() {
  const clipId = _edClipId;
  try {
    const data = await fetch(`/api/clips/${clipId}/context-transcript?pad_s=${_ED_PAD_S}`).then(r => r.json());
    if (_edClipId !== clipId) return;
    _edSeekOffsetS = data.seek_offset_s || 0;
    _edLines = data.lines || [];
    _edRenderTranscript();
  } catch (_) {
    const el = document.getElementById('ed-transcript');
    if (el && _edClipId === clipId) el.innerHTML = '<div class="transcript-empty">Could not load transcript.</div>';
  }
}

function _edRenderTranscript() {
  const el = document.getElementById('ed-transcript');
  if (!el) return;
  if (!_edLines.length) {
    el.innerHTML = '<div class="transcript-empty">No transcript for this recording - trim with the nudge buttons above.</div>';
    return;
  }
  const effStart = _edEffStartMs(), effEnd = _edEffEndMs();
  const rows = _edLines.map(line => {
    const inClip = line.start_ms < effEnd && line.end_ms > effStart;
    const clock  = fmtClock(line.start_ms);
    const spk = line.speaker
      ? `<span class="tline-speaker" style="align-self:center;margin-top:0${line.color ? `;color:${escHtml(line.color)}` : ''}">${escHtml(line.speaker)}</span>`
      : '';
    return `<div class="tline${inClip ? ' cc-selected' : ''}" data-start-ms="${line.start_ms}" data-end-ms="${line.end_ms}"${inClip ? '' : ' style="opacity:.55"'}>
      <button class="tline-play" data-seek-ms="${line.start_ms}" title="Play from ${clock}" aria-label="Play from ${clock}">&#9654;</button>
      <span class="tline-time">${clock}</span>
      <button class="btn ghost ed-bound" data-edge="start" data-ms="${line.start_ms}" title="Start the clip at this line" aria-label="Start clip here" style="padding:0 6px;font-size:13px">&#8676;</button>
      ${spk}
      <span class="tline-text" style="flex:1">${escHtml(line.text)}</span>
      <button class="btn ghost ed-bound" data-edge="end" data-ms="${line.end_ms}" title="End the clip at this line" aria-label="End clip here" style="padding:0 6px;font-size:13px">&#8677;</button>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="transcript-lines">${rows}</div>`;
}

function _edOnTranscriptClick(e) {
  const bound = e.target.closest('.ed-bound');
  if (bound) { _edSetBoundaryToLine(bound.dataset.edge, parseInt(bound.dataset.ms, 10)); return; }
  const play = e.target.closest('.tline-play');
  if (play) { _edSeekMs(parseInt(play.dataset.seekMs, 10), true); }
}

// ── trim boundaries ───────────────────────────────────────────────────────────

function _edEffStartMs() { return _edClip.start_ms + _edStartOffset * 1000; }
function _edEffEndMs()   { return _edClip.end_ms   + _edEndOffset   * 1000; }

// Compute the new trim offset (seconds, 3dp) for a boundary change, or signal too-short.
// edge 'start' clamps the requested ms to >=0 and floors the duration against the current
// effective end; edge 'end' floors against the current effective start. requestedMs and
// effStart/EndMs are recording-relative ms; clipStart/EndMs are the clip's saved baseline
// the offset is measured from. Returns {ok:true, offset} or {ok:false}.
export function computeTrimBoundary(edge, requestedMs, {clipStartMs, clipEndMs, effStartMs, effEndMs, minDurationMs}) {
  if (edge === 'start') {
    const startMs = Math.max(0, requestedMs);
    if (effEndMs - startMs < minDurationMs) return { ok: false };
    return { ok: true, offset: +((startMs - clipStartMs) / 1000).toFixed(3) };
  }
  if (requestedMs - effStartMs < minDurationMs) return { ok: false };
  return { ok: true, offset: +((requestedMs - clipEndMs) / 1000).toFixed(3) };
}

function _edSetBoundaryToLine(edge, ms) {
  if (edge === 'start') _edApplyStartMs(ms);
  else                  _edApplyEndMs(ms);
}

function _edBoundaryCtx() {
  return {
    clipStartMs: _edClip.start_ms, clipEndMs: _edClip.end_ms,
    effStartMs: _edEffStartMs(), effEndMs: _edEffEndMs(), minDurationMs: _ED_MIN_DURATION_MS,
  };
}

function _edApplyStartMs(requestedMs) {
  const result = computeTrimBoundary('start', requestedMs, _edBoundaryCtx());
  if (!result.ok) { showToast('Clip must stay at least 1 second long', 'warning'); return; }
  _edStartOffset = result.offset;
  _edAfterBoundaryChange();
}

function _edApplyEndMs(requestedMs) {
  const result = computeTrimBoundary('end', requestedMs, _edBoundaryCtx());
  if (!result.ok) { showToast('Clip must stay at least 1 second long', 'warning'); return; }
  _edEndOffset = result.offset;
  _edAfterBoundaryChange();
}

function _edNudge(edge, deltaS) {
  if (edge === 'start') _edApplyStartMs(_edEffStartMs() + deltaS * 1000);
  else                  _edApplyEndMs(_edEffEndMs() + deltaS * 1000);
}

function _edResetTrim() {
  _edStartOffset = 0;
  _edEndOffset   = 0;
  _edAfterBoundaryChange();
}

function _edAfterBoundaryChange() {
  _edRenderReadouts();
  _edRenderTranscript();
  _edSeekMs(_edEffStartMs(), false);
}

function _edRenderReadouts() {
  const startEl = document.getElementById('ed-start-read');
  const endEl   = document.getElementById('ed-end-read');
  const durEl   = document.getElementById('ed-duration');
  if (startEl) startEl.textContent = fmtClock(_edEffStartMs());
  if (endEl)   endEl.textContent   = fmtClock(_edEffEndMs());
  if (durEl)   durEl.textContent   = `${((_edEffEndMs() - _edEffStartMs()) / 1000).toFixed(1)}s`;
}

// ── preview playback ──────────────────────────────────────────────────────────

function _edOnMetadata() {
  const videoEl = document.getElementById('ed-video');
  if (!videoEl || !videoEl.videoWidth) return;
  _edAspect = videoEl.videoWidth / videoEl.videoHeight;
  const wrap = document.getElementById('ed-preview-wrap');
  if (wrap) wrap.style.aspectRatio = `${videoEl.videoWidth}/${videoEl.videoHeight}`;
  _edUpdateVerticalControls();
  _edApplyCaptionStyle();
  if (!_edMetaSeeked) {
    _edMetaSeeked = true;
    _edSeekMs(_edEffStartMs(), false);
  }
}

function _edOnTimeUpdate() {
  const videoEl = document.getElementById('ed-video');
  if (!videoEl) return;
  _edUpdateCaptionOverlay(_edCurrentRecordingMs());
  if (!videoEl.paused) {
    const endParent = _edSeekOffsetS + _edEffEndMs() / 1000;
    if (videoEl.currentTime >= endParent - 0.03) {
      videoEl.currentTime = _edSeekOffsetS + _edEffStartMs() / 1000;
    }
  }
}

function _edCurrentRecordingMs() {
  const videoEl = document.getElementById('ed-video');
  if (!videoEl) return 0;
  return (videoEl.currentTime - _edSeekOffsetS) * 1000;
}

// recordingMs is recording-relative; add the segment offset to seek the parent.
function _edSeekMs(recordingMs, play) {
  const videoEl = document.getElementById('ed-video');
  if (!videoEl) return;
  videoEl.currentTime = Math.max(0, _edSeekOffsetS + recordingMs / 1000);
  if (play) { const p = videoEl.play(); if (p && p.catch) p.catch(() => {}); }
}

function _edPlaySelection() {
  _edSeekMs(_edEffStartMs(), true);
}

// ── caption overlay (preview approximation) ───────────────────────────────────

function _edApplyCaptionStyle() {
  const overlay = document.getElementById('ed-caption-overlay');
  const wrap    = document.getElementById('ed-preview-wrap');
  const videoEl = document.getElementById('ed-video');
  if (!overlay || !wrap) return;
  const sourceH = (videoEl && videoEl.videoHeight) || 1080;
  const sizePt  = _edConfig.caption_font_size || 28;
  const px      = Math.max(11, sizePt * (wrap.clientHeight || 1) / sourceH);
  overlay.style.fontSize   = `${px.toFixed(1)}px`;
  overlay.style.fontFamily = _edConfig.caption_font_name ? `"${_edConfig.caption_font_name}", sans-serif` : '';
  const top = (_edConfig.caption_position === 'top');
  overlay.style.bottom = top ? '' : '6%';
  overlay.style.top    = top ? '6%' : '';
}

function _edUpdateCaptionOverlay(recordingMs) {
  const overlay = document.getElementById('ed-caption-overlay');
  if (!overlay) return;
  if (_edCaptionMode !== 'burn') { overlay.style.display = 'none'; return; }
  const active = _edLines.filter(l => l.in_clip && l.start_ms <= recordingMs && l.end_ms > recordingMs);
  if (!active.length) { overlay.style.display = 'none'; return; }
  overlay.style.display = 'block';
  overlay.innerHTML = active
    .map(l => `<span style="color:${escHtml(l.color || '#fff')}">${escHtml(l.text)}</span>`)
    .join('<br>');
}

// ── vertical crop box ─────────────────────────────────────────────────────────

// Fraction of frame width the 9:16 crop column occupies: min(1, (9/16)/aspect).
export function cropWidthFraction(aspect) {
  return Math.min(1, (9 / 16) / aspect);
}

function _edUpdateVerticalControls() {
  const vertical = exportPresetIsVertical(_edPreset);
  const box = document.getElementById('ed-crop-box');
  const btn = document.getElementById('ed-autoframe-btn');
  if (btn) btn.style.display = vertical ? '' : 'none';
  if (!box) return;
  if (!vertical) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  _edRenderCropBox();
}

function _edRenderCropBox() {
  const box = document.getElementById('ed-crop-box');
  if (!box) return;
  const wFrac = cropWidthFraction(_edAspect);
  box.style.width = `${(wFrac * 100).toFixed(2)}%`;
  box.style.left  = `${(_edCropX * (1 - wFrac) * 100).toFixed(2)}%`;
}

function _edSetCropX(fraction) {
  _edCropX = Math.max(0, Math.min(1, fraction));
  _edRenderCropBox();
}

function _edCropPointerDown(e) {
  e.preventDefault();
  const wrap  = document.getElementById('ed-preview-wrap');
  const wFrac = cropWidthFraction(_edAspect);
  if (wFrac >= 0.999 || !wrap) return;  // source already ≤9:16 - nothing to pan
  function onMove(ev) {
    const rect = wrap.getBoundingClientRect();
    const centerFrac = (ev.clientX - rect.left) / rect.width;
    _edSetCropX((centerFrac - wFrac / 2) / (1 - wFrac));
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

async function _edAutoFrame() {
  const btn  = document.getElementById('ed-autoframe-btn');
  const note = document.getElementById('ed-autoframe-note');
  btn.disabled = true;
  note.textContent = 'Finding faces…';
  try {
    const res = await fetch(`/api/clips/${_edClipId}/suggest-framing`, { method: 'POST' });
    if (res.status === 503) {
      note.textContent = "Auto-frame isn't available - the face-detection component is missing. "
        + 'Try reinstalling YuuClip, or set the crop by hand.';
      return;
    }
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))) || `HTTP ${res.status}`);
    const { crop_x } = await res.json();
    if (crop_x == null) { note.textContent = 'No face found - set the crop manually.'; return; }
    _edSetCropX(crop_x);
    note.textContent = 'Framed on faces.';
  } catch (err) {
    note.textContent = `Auto-frame failed: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

// ── export ────────────────────────────────────────────────────────────────────

function _edPresetOptionsHtml(selected) {
  const presets = AppState.exportPresets || { builtins: [], custom: [] };
  const opt = (v, l) => `<option value="${escHtml(v)}"${selected === v ? ' selected' : ''}>${escHtml(l)}</option>`;
  return [
    opt('', 'Original quality'),
    ...(presets.builtins || []).map(p => opt(p.name, p.label)),
    ...(presets.custom || []).map(p => opt(p.name, p.label)),
  ].join('');
}

async function _edSaveEdits() {
  const timingRes = await fetch(`/api/clips/${_edClipId}/timing`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ start_offset: _edStartOffset, end_offset: _edEndOffset }),
  }).catch(() => null);
  if (!timingRes || !timingRes.ok) {
    const detail = timingRes ? formatApiError(await timingRes.json().catch(() => ({}))) : '';
    showToast(detail || 'Failed to save trim', 'error');
    return false;
  }

  if (exportPresetIsVertical(_edPreset)) {
    const framingRes = await fetch(`/api/clips/${_edClipId}/framing`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop_x: _edCropX }),
    }).catch(() => null);
    if (!framingRes || !framingRes.ok) { showToast('Failed to save vertical framing', 'error'); return false; }
    _edClip.crop_x = _edCropX;
  }
  _edClip.start_offset = _edStartOffset;
  _edClip.end_offset   = _edEndOffset;
  return true;
}

// Build the single-clip export query from the editor's current state. captionMode is
// none | embed | burn; burn-in additionally carries the caption-style fields from config.
// Kept editor-specific (the export dialog and reel builder assemble different fields).
export function buildExportParams({captionMode, preset, titleCard, config}) {
  const params = new URLSearchParams();
  if (captionMode === 'burn')  params.set('burn_subs', 'true');
  if (captionMode === 'embed') params.set('embed_subs', 'true');
  if (preset)   params.set('preset', preset);
  if (titleCard) params.set('title_card', 'true');
  if (captionMode === 'burn') {
    params.set('caption_font', config.caption_font_name || '');
    params.set('caption_size', String(config.caption_font_size || 0));
    params.set('caption_position', config.caption_position || 'bottom');
  }
  return params;
}

async function _edExport() {
  const id  = _edClipId;
  const btn = document.getElementById('ed-export-btn');
  btn.disabled = true;
  if (!await _edSaveEdits()) { btn.disabled = false; return; }

  const params = buildExportParams({
    captionMode: _edCaptionMode, preset: _edPreset, titleCard: _edTitleCard, config: _edConfig,
  });
  const qs = params.toString() ? `?${params}` : '';
  streamSSE(
    `/api/clips/${id}/export${qs}`,
    async outcome => {
      const [clip, media] = await Promise.all([
        fetch(`/api/clips/${id}`).then(r => r.json()),
        fetch(`/api/clips/${id}/media_url`).then(r => r.json()),
      ]);
      AppState.activeClipData = clip;
      AppState.activeMediaFilename = media.filename;
      PanelNav.forceClose();
      const captionsUrl = media.has_captions ? `/api/clips/${id}/captions.vtt` : null;
      renderPlayer(media.url, captionsUrl, id);
      renderDetail(clip);
      await _reloadClipList(AppState.activeVideoId);
      loadVideos();
      if (outcome === 'cancelled') return;
      showToast('Clip exported successfully');
      SoundFx.play('export');
    },
    [{ label: 'Export', patterns: ['Exporting', 'OK Saved'] }],
    'Exporting',
    true,
    null,
    false,
    {},
    () => { btn.disabled = false; },
  );
  setJobCancel({
    url:     '/api/analyze/cancel',
    title:   'Cancel export?',
    body:    'The export will stop and no file will be saved. You can export again anytime.',
    confirm: 'Cancel Export',
    logMsg:  '[Export cancelled]',
  });
}

