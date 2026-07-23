// Feature-map - Split recording into segments (code: segment / segment_start_s).
//   API: routes/videos.py (split) · Tests: tests/ui/test_ui_split.py, tests/integration/test_segments.py
import { AppState } from '../core/state.js';
import { PanelNav } from '../core/panelnav.js';
import { escHtml, plural, formatApiError } from '../core/format.js';
import { setupRecordingPreview, releaseVideoRespectingPip } from '../core/preview.js';
import { showToast, netErrMsg, openLog, appendLog } from '../core/utils.js';
import { showConfirm } from '../core/ui.js';
import { streamSSE, _openSSE, INGEST_STEPS, _waitWhileAnalyzePaused } from '../core/jobs.js';
import { loadVideos, _reanalyzeParams } from '../videos/videos.js';

// ── shared live split-editor state ────────────────────────────────────────────
// Read cross-module via ESM `import`: videos.js reads _splitPoints for the "has
// splits" badge; analyze.js reads _splitPoints/_splitDurationS/_splitIgnored for
// the pre-split segment plan. `export let` gives those importers a live binding,
// so a reassignment here (e.g. _splitPoints = [] on open) is visible to them.
export let _splitDurationS = 0;
export let _splitPoints    = [];  // sorted list of seconds
let _splitNames            = [];  // auto-names, editable
export let _splitIgnored   = new Set();  // indices of segments to skip
let _splitZoom             = 1;

// Suggestion-pin inputs/outputs, not consumed by other production modules.
let _splitEnergyFlat = [];   // [{second, rms_db}, …] merged across tracks
let _suggestionPins  = [];    // [sec, …]

// Test-only accessor bridge: test_ui_keyboard.py pokes these two split-state names
// as bare page globals via page.evaluate (it mutates _splitPoints / assigns
// _splitNames). Inside the esbuild IIFE they are closure locals, not window
// properties, and this module reassigns them - so a plain window.X = X snapshot
// would go stale and an imported ESM binding is read-only. Live get/set defined here
// (which can read AND write this module's own `let`s) keeps page.evaluate in sync.
// Remove when that test moves to the vitest unit layer (the jobs.js equivalent bridge
// has already been removed that way, and the _splitDurationS / _splitEnergyFlat /
// _suggestionPins entries dropped out once their page.evaluate pokes were ported).
for (const [name, get, set] of [
  ['_splitPoints', () => _splitPoints, v => { _splitPoints = v; }],
  ['_splitNames',  () => _splitNames,  v => { _splitNames = v; }],
]) Object.defineProperty(window, name, { get, set, configurable: true });

// ── split editor ─────────────────────────────────────────────────────────────
let _splitVideoId   = null;

// Overlay data fetched once when the editor opens
let _splitSceneMs    = [];   // [ms, …] scene boundary timecodes
let _splitClipRanges = [];   // [{start_ms, end_ms}, …] existing clips

// Drag state
let _dragMarkerSec  = null;
let _dragActive     = false;

// Timeline zoom (main split editor only): 1 = fit whole recording, higher =
// wider bar inside a horizontal-scroll container. All overlay layers are
// %-positioned so they scale for free; only the waveform canvas needs a redraw.
const _SPLIT_ZOOM_MIN = 1;
const _SPLIT_ZOOM_MAX = 50;

const _SUGGESTION_MIN_GAP_S = 30;
const _SUGGESTION_COUNT     = 8;

// One instruction string for both editors (L6-3); the main editor appends its
// extra affordances.
const SPLIT_BAR_INSTRUCTIONS =
  'Click the bar to place a split point. Drag a marker to move it; hover over it and click its × to remove it.';

export function isSplitEditorOpen() {
  return PanelNav.isOpen('split-editor');
}

export async function openSplitEditor(videoId) {
  const video = AppState.videos.find(v => v.id === videoId);
  if (!video) return;

  _splitVideoId   = videoId;
  _splitDurationS = (video.duration_ms || 0) / 1000;
  _splitPoints    = [];
  _splitNames     = [];
  _splitIgnored   = new Set();
  _splitEnergyFlat = [];
  _splitSceneMs    = [];
  _splitClipRanges = [];
  _suggestionPins  = [];

  PanelNav.open({
    id: 'split-editor',
    title: `Split: ${video.filename}`,
    render: container => _mountSplitEditorPanel(container, videoId),
    isDirty: () => _splitPoints.length > 0,
    onClose: _teardownSplitEditor,
  });

  await _loadSplitEditorOverlays(videoId);
}

function _mountSplitEditorPanel(container, videoId) {
  const panel = document.getElementById('split-editor-panel');
  container.appendChild(panel);
  panel.style.display = 'flex';

  const video = AppState.videos.find(v => v.id === videoId);
  document.getElementById('split-preview-wrap').style.display = 'block';
  setupRecordingPreview(
    document.getElementById('split-preview-video'),
    document.getElementById('split-preview-badge'),
    videoId,
    { autoBuild: true, isCurrent: () => _splitVideoId === videoId, sourcePath: video?.source_path },
  );

  document.getElementById('split-waveform-notice').style.display = 'none';

  // A destructive re-analyze choice must not persist into the next session.
  document.querySelector('input[name="split-action"][value="partition"]').checked = true;

  _resetSplitZoom();
  _renderSplitEditor();
}

async function _loadSplitEditorOverlays(videoId) {
  // Fetch overlay data in parallel; render progressively
  const [energyRes, sceneRes, clipsRes] = await Promise.allSettled([
    fetch(`/api/videos/${videoId}/energy`).then(r => r.ok ? r.json() : null),
    fetch(`/api/videos/${videoId}/scene-boundaries`).then(r => r.ok ? r.json() : null),
    fetch(`/api/videos/${videoId}/clips`).then(r => r.ok ? r.json() : null),
  ]);

  let hasEnergy = false;
  if (energyRes.status === 'fulfilled' && energyRes.value?.tracks?.length) {
    const bySecond = new Map();
    for (const track of energyRes.value.tracks) {
      for (const s of track.samples) {
        const prev = bySecond.get(s.second);
        if (prev === undefined || s.rms_db > prev) bySecond.set(s.second, s.rms_db);
      }
    }
    if (bySecond.size > 0) {
      hasEnergy = true;
      _splitEnergyFlat = Array.from(bySecond.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([second, rms_db]) => ({ second, rms_db }));
      _computeSuggestionPins();
      _drawWaveform();
    }
  }

  if (!hasEnergy) {
    document.getElementById('split-waveform-notice').style.display = 'flex';
  }

  if (sceneRes.status === 'fulfilled' && sceneRes.value?.boundaries_ms) {
    _splitSceneMs = sceneRes.value.boundaries_ms;
    _renderSceneLayer();
  }

  if (clipsRes.status === 'fulfilled' && clipsRes.value?.length) {
    _splitClipRanges = clipsRes.value.map(c => ({
      start_ms: c.start_ms,
      end_ms: c.end_ms,
    }));
    _renderClipsLayer();
  }

  _renderSuggestionLayer();
}

// Force-closes the panel (bypasses PanelNav's dirty gate) - used by callers
// that already ran their own confirm (e.g. switching recordings) and by the
// split editor's own post-confirm success paths.
export function closeSplitEditor() {
  PanelNav.forceClose();
}

function _teardownSplitEditor() {
  const previewEl = document.getElementById('split-preview-video');
  releaseVideoRespectingPip(previewEl, () => { previewEl.pause(); previewEl.src = ''; });
  document.getElementById('split-preview-wrap').style.display = 'none';
  const badge = document.getElementById('split-preview-badge');
  if (badge) badge.style.display = 'none';
  const panel = document.getElementById('split-editor-panel');
  panel.style.display = 'none';
  // PanelNav removes its container (and everything still inside it) right
  // after onClose() runs - move the panel's static markup back out first so
  // it survives to be reparented into the next PanelNav container on reopen.
  document.getElementById('panelnav-root').insertAdjacentElement('afterend', panel);
  document.getElementById('split-waveform-notice').style.display = 'none';
  _splitVideoId   = null;
  _dragActive     = false;
  _dragMarkerSec  = null;
}

function _splitSeekTo(sec) {
  const v = document.getElementById('split-preview-video');
  if (v && v.src) {
    v.currentTime = sec;
    v.play().catch(() => {});
  }
}

// Preview proxy (720p, fast scrubbing) is handled by the shared
// setupRecordingPreview() in preview.js - see openSplitEditor.

export async function _generateWaveform() {
  const btn = document.querySelector('#split-waveform-notice button');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  const notice = document.getElementById('split-waveform-notice');
  const resetButton = () => { if (btn) { btn.disabled = false; btn.textContent = 'Generate Waveform'; } };

  // Raw _openSSE, not streamSSE: this is a background convenience (no global job
  // pill), and streamSSE's _supersedeActiveStream() would tear down a live
  // analyze/score/export progress stream just because the Split Editor's waveform
  // started generating alongside it (bug-hunt 2.3).
  _openSSE(
    `/api/videos/${_splitVideoId}/compute-waveform`,
    () => {},  // onLine: no live progress text needed for this one
    async () => {
      // Reload energy data and redraw
      const res = await fetch(`/api/videos/${_splitVideoId}/energy`).then(r => r.ok ? r.json() : null);
      if (res?.tracks?.length) {
        const bySecond = new Map();
        for (const track of res.tracks) {
          for (const s of track.samples) {
            const prev = bySecond.get(s.second);
            if (prev === undefined || s.rms_db > prev) bySecond.set(s.second, s.rms_db);
          }
        }
        if (bySecond.size > 0) {
          _splitEnergyFlat = Array.from(bySecond.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([second, rms_db]) => ({ second, rms_db }));
          _computeSuggestionPins();
          _drawWaveform();
          notice.style.display = 'none';
          return;
        }
      }
      resetButton();
    },
    () => resetButton(),  // onError: a failed waveform build just re-arms the button
  );
}

// ── suggestion pins ──────────────────────────────────────────────────────────

// Pure: pick up to _SUGGESTION_COUNT quiet, spaced, interior seconds from a
// flat [{second, rms_db}, …] energy list. Returns null (not []) when there is
// no data, so the caller leaves any existing suggestions untouched rather than
// clearing them.
export function computeSuggestionPins(energyFlat, durationS) {
  if (!energyFlat.length || !durationS) return null;

  // Work with normalised linear energy (not dB) for valley detection
  const minDb = Math.min(...energyFlat.map(s => s.rms_db));
  const maxDb = Math.max(...energyFlat.map(s => s.rms_db));
  const range  = maxDb - minDb || 1;

  // Score each second: 1 = quietest, 0 = loudest
  const scored = energyFlat.map(s => ({
    sec:   s.second,
    score: 1 - (s.rms_db - minDb) / range,
  }));

  // Greedy pick: take the highest-scoring second not within gap of a chosen pin
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const pins = [];
  for (const { sec } of sorted) {
    if (pins.length >= _SUGGESTION_COUNT) break;
    if (sec <= 0 || sec >= durationS) continue;
    if (pins.some(p => Math.abs(p - sec) < _SUGGESTION_MIN_GAP_S)) continue;
    pins.push(sec);
  }
  return pins.sort((a, b) => a - b);
}

function _computeSuggestionPins() {
  const pins = computeSuggestionPins(_splitEnergyFlat, _splitDurationS);
  if (pins !== null) _suggestionPins = pins;
}

// ── timeline zoom ─────────────────────────────────────────────────────────────

function _fmtZoom(z) {
  return (z >= 9.95 ? Math.round(z) : Math.round(z * 10) / 10) + '×';
}

function _resetSplitZoom() {
  _splitZoom = 1;
  const bar    = document.getElementById('split-timeline-bar');
  const scroll = document.getElementById('split-timeline-scroll');
  const label  = document.getElementById('split-zoom-label');
  if (bar)    bar.style.width = '100%';
  if (scroll) scroll.scrollLeft = 0;
  if (label)  label.textContent = _fmtZoom(1);
  _updateSplitZoomButtons();
}

function _updateSplitZoomButtons() {
  const out = document.getElementById('split-zoom-out');
  const inb = document.getElementById('split-zoom-in');
  if (out) out.disabled = _splitZoom <= _SPLIT_ZOOM_MIN + 1e-6;
  if (inb) inb.disabled = _splitZoom >= _SPLIT_ZOOM_MAX - 1e-6;
}

// Set the zoom factor, keeping the timeline point under *anchorClientX* fixed on
// screen (falls back to the viewport centre for button clicks).
function _setSplitZoom(zoom, anchorClientX) {
  const bar    = document.getElementById('split-timeline-bar');
  const scroll = document.getElementById('split-timeline-scroll');
  const label  = document.getElementById('split-zoom-label');
  if (!bar || !scroll) return;

  const newZoom = Math.max(_SPLIT_ZOOM_MIN, Math.min(_SPLIT_ZOOM_MAX, zoom));
  const oldW    = bar.offsetWidth || scroll.clientWidth;
  const anchorX = anchorClientX != null
    ? anchorClientX - scroll.getBoundingClientRect().left
    : scroll.clientWidth / 2;
  const anchorFrac = oldW ? (scroll.scrollLeft + anchorX) / oldW : 0;

  _splitZoom = newZoom;
  bar.style.width = (newZoom * 100) + '%';
  if (label) label.textContent = _fmtZoom(newZoom);

  _drawWaveform();                       // redraw at the new pixel width
  scroll.scrollLeft = anchorFrac * bar.offsetWidth - anchorX;
  _updateSplitZoomButtons();
}

function _onSplitZoomWheel(e) {
  if (!(e.ctrlKey || e.metaKey)) return;  // plain wheel keeps scrolling/panning
  e.preventDefault();
  _setSplitZoom(_splitZoom * (e.deltaY < 0 ? 1.25 : 1 / 1.25), e.clientX);
}

// ── canvas waveform ──────────────────────────────────────────────────────────

function _drawWaveform() {
  const canvas = document.getElementById('split-waveform-canvas');
  if (!canvas || !_splitEnergyFlat.length || !_splitDurationS) return;

  // Use layout size, not CSS pixel size. Clamp the bitmap width so a deep zoom
  // on a multi-hour recording can't exceed the browser's max canvas dimension;
  // CSS stretches the (soft, semi-transparent) waveform over any excess.
  const W = Math.min(canvas.offsetWidth || 800, 16000);
  const H = canvas.offsetHeight || 60;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const minDb = Math.min(..._splitEnergyFlat.map(s => s.rms_db));
  const maxDb = Math.max(..._splitEnergyFlat.map(s => s.rms_db));
  const range  = maxDb - minDb || 1;

  // Downsample to one bar per CSS pixel bucket
  const buckets = new Float32Array(W);
  const counts  = new Uint16Array(W);
  for (const { second, rms_db } of _splitEnergyFlat) {
    const x = Math.floor((second / _splitDurationS) * W);
    if (x >= 0 && x < W) {
      buckets[x] += rms_db;
      counts[x]++;
    }
  }

  // Filled path from bottom, centred vertically
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x < W; x++) {
    const avg = counts[x] ? buckets[x] / counts[x] : minDb;
    const norm = (avg - minDb) / range;            // 0..1
    const barH = Math.max(2, norm * H * 0.85);
    ctx.lineTo(x, H - barH);
  }
  ctx.lineTo(W, H);
  ctx.closePath();

  // Use CSS variable for accent with low opacity
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue('--accent').trim() || '#6c8ebf';
  ctx.fillStyle = accent + '55';   // ~33 % opacity
  ctx.fill();
}

// ── scene boundary layer ─────────────────────────────────────────────────────

function _renderSceneLayer() {
  const el = document.getElementById('split-scene-layer');
  if (!el || !_splitDurationS) return;

  el.innerHTML = _splitSceneMs.map(ms => {
    const pct = (ms / 1000 / _splitDurationS * 100).toFixed(3);
    return `<div style="position:absolute;left:${pct}%;top:0;bottom:0;width:1px;background:color-mix(in srgb, var(--text) 30%, transparent)" title="Scene cut at ${_fmtSplitTime(ms / 1000)}"></div>`;
  }).join('');
}

// ── suggestion pin layer ─────────────────────────────────────────────────────

function _renderSuggestionLayer() {
  const el = document.getElementById('split-suggestion-layer');
  if (!el || !_splitDurationS) return;

  el.innerHTML = _suggestionPins.map(sec => {
    // Hide if already a real marker
    if (_splitPoints.some(p => Math.abs(p - sec) < 1)) return '';
    const pct = (sec / _splitDurationS * 100).toFixed(3);
    return `<div data-pin="${sec}" class="split-suggestion-pin"
                 style="position:absolute;left:${pct}%;top:0;bottom:0;width:14px;transform:translateX(-50%);cursor:pointer;pointer-events:auto;display:flex;justify-content:center"
                 title="Quiet valley at ${_fmtSplitTime(sec)} - click to place a split point here">
               <div style="width:0;border-left:1.5px dashed color-mix(in srgb, var(--text) 40%, transparent)"></div>
             </div>`;
  }).join('');
}

function _promoteSuggestionPin(sec) {
  if (_splitPoints.some(p => Math.abs(p - sec) < 0.5)) return;
  _splitPoints.push(sec);
  _splitPoints.sort((a, b) => a - b);
  _rebuildSplitNames();
  _renderSplitEditor();
}

// ── existing clips dot layer ─────────────────────────────────────────────────

function _renderClipsLayer() {
  const el = document.getElementById('split-clips-layer');
  if (!el || !_splitDurationS) return;

  el.innerHTML = _splitClipRanges.map(({ start_ms, end_ms }) => {
    const leftPct  = (start_ms / 1000 / _splitDurationS * 100).toFixed(3);
    const widthPct = ((end_ms - start_ms) / 1000 / _splitDurationS * 100).toFixed(3);
    return `<div style="position:absolute;left:${leftPct}%;width:${widthPct}%;top:50%;transform:translateY(-50%);height:4px;background:color-mix(in srgb, var(--text) 22%, transparent);border-radius:2px" title="Existing clip ${_fmtSplitTime(start_ms/1000)}–${_fmtSplitTime(end_ms/1000)}"></div>`;
  }).join('');
}

// ── drag-to-reposition markers ────────────────────────────────────────────────

function _splitMarkerPointerDown(e, sec) {
  e.stopPropagation();
  e.preventDefault();
  _dragMarkerSec = sec;
  _dragActive    = true;
  let moved      = false;

  const bar = document.getElementById('split-timeline-bar');

  function onMove(ev) {
    if (!_dragActive) return;
    moved = true;
    const rect = bar.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    const newSec = Math.round(frac * _splitDurationS * 10) / 10;
    if (newSec <= 0 || newSec >= _splitDurationS) return;

    const idx = _splitPoints.indexOf(_dragMarkerSec);
    if (idx !== -1) {
      _splitPoints[idx] = newSec;
      _dragMarkerSec = newSec;
      _splitPoints.sort((a, b) => a - b);
      _renderSplitEditor();
    }
  }

  function onUp() {
    _dragActive    = false;
    if (!moved) _splitSeekTo(sec);
    _dragMarkerSec = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup',   onUp);
    _rebuildSplitNames();
    _renderSplitEditor();
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup',   onUp);
}

// ── main click handler ───────────────────────────────────────────────────────

export function splitTimelineClick(e) {
  if (!_splitDurationS || _dragActive) return;
  const bar  = document.getElementById('split-timeline-bar');
  const rect = bar.getBoundingClientRect();
  const frac = (e.clientX - rect.left) / rect.width;
  const sec  = Math.round(frac * _splitDurationS * 10) / 10;

  if (sec <= 0 || sec >= _splitDurationS) return;

  // Too close to an existing marker - ignore rather than stack a near-duplicate
  // (removal is via the marker's × button).
  const threshold = _splitDurationS * 0.005;
  if (_splitPoints.some(p => Math.abs(p - sec) <= threshold)) return;

  _splitPoints.push(sec);
  _splitPoints.sort((a, b) => a - b);
  _rebuildSplitNames();
  _renderSplitEditor();
}

function _removeSplitPoint(sec, isPreSplit) {
  const idx = _splitPoints.indexOf(sec);
  if (idx === -1) return;
  _splitPoints.splice(idx, 1);
  if (isPreSplit) {
    _rebuildPreSplitNames();
    _renderPreSplitEditor();
  } else {
    _rebuildSplitNames();
    _renderSplitEditor();
  }
}

// ── render ───────────────────────────────────────────────────────────────────

function _rebuildSplitNames() {
  if (!_splitVideoId) return;
  const video = AppState.videos.find(v => v.id === _splitVideoId);
  const stem  = video ? video.filename.replace(/\.[^.]+$/, '') : 'Recording';
  const count = _splitPoints.length + 1;
  _splitNames = Array.from({length: count}, (_, i) => `${stem} - Part ${i + 1}`);
}

function _renderSplitEditor() {
  _renderSplitTimeline();
  _updateSplitConfirmState();  // also re-renders the segment list
}

function _updateSplitConfirmState() {
  const btn = document.getElementById('btn-split-confirm');
  const action = document.querySelector('input[name="split-action"]:checked')?.value || 'partition';
  btn.classList.toggle('danger', action !== 'partition');
  btn.classList.toggle('primary', action === 'partition');
  const noPoints = _splitPoints.length === 0;
  btn.disabled = noPoints;
  btn.title = noPoints ? 'Place at least one split point first' : '';
  _renderSplitSegmentList();
}

function _renderSplitTimeline() {
  const bar      = document.getElementById('split-timeline-bar');
  const markers  = document.getElementById('split-markers-layer');
  const segments = document.getElementById('split-segments-layer');
  if (!bar) return;

  // Redraw waveform canvas in case width changed
  _drawWaveform();

  // Re-render overlay layers that depend on user markers (suggestion pins hide when near a marker)
  _renderSuggestionLayer();

  // Segment colour bands
  const pts = [0, ..._splitPoints, _splitDurationS];
  const palette = ['var(--accent)', 'var(--warning)', 'var(--green)', 'var(--red)'];
  segments.innerHTML = pts.slice(0, -1).map((start, i) => {
    const end      = pts[i + 1];
    const widthPct = ((end - start) / _splitDurationS * 100).toFixed(3);
    const col      = _splitIgnored.has(i) ? 'var(--muted)' : palette[i % palette.length];
    const opacity  = _splitIgnored.has(i) ? '0.08' : '0.12';
    return `<div style="height:100%;width:${widthPct}%;background:${col};opacity:${opacity};border-right:1px solid ${col}"></div>`;
  }).join('');

  // User-placed markers with drag handles (wired via delegation - see _wireMarkerLayer)
  markers.innerHTML = _splitPoints.map(p => {
    const pct = (p / _splitDurationS * 100).toFixed(3);
    const timeLabel = _fmtSplitTime(p);
    return `<div class="split-marker" data-split-sec="${p}" style="position:absolute;left:${pct}%;top:0;bottom:0;width:10px;transform:translateX(-50%);cursor:ew-resize;pointer-events:auto;display:flex;align-items:stretch;justify-content:center"
                 title="${timeLabel} - drag to move, click to preview from here">
               <div style="width:2px;background:var(--accent);border-radius:1px"></div>
               <button type="button" class="split-marker-x" title="Remove split point"
                       aria-label="Remove split point at ${timeLabel}">&#215;</button>
             </div>`;
  }).join('');
}

export function _parseSplitTime(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

function _updateSplitPoint(idx, timeStr, onRerender) {
  const sec = _parseSplitTime(timeStr);
  if (sec === null) {
    showToast(`Couldn't read "${timeStr}" - use h:mm:ss or m:ss`, 'error');
    onRerender();
    return;
  }
  if (sec <= 0 || sec >= _splitDurationS) {
    showToast(`Split point must be between 0:00 and ${_fmtSplitTime(_splitDurationS)}`, 'error');
    onRerender();
    return;
  }
  _splitPoints[idx] = sec;
  _splitPoints.sort((a, b) => a - b);
  if (_splitVideoId) _rebuildSplitNames(); else _rebuildPreSplitNames();
  onRerender();
}

// Segment rows carry data-split-role attributes; their change/click events are
// handled by one delegated listener per list container (see _wireSegmentList).
function _renderSegmentList(listId, showPlayBtn, showIgnore = true) {
  const list = document.getElementById(listId);
  if (!list || !_splitDurationS) return;
  const pts = [0, ..._splitPoints, _splitDurationS];

  list.innerHTML = pts.slice(0, -1).map((start, i) => {
    const end      = pts[i + 1];
    const ignored  = _splitIgnored.has(i);
    const name     = escHtml(_splitNames[i] || `Part ${i + 1}`);
    const startStr = escHtml(_fmtSplitTime(start));
    const endStr   = escHtml(_fmtSplitTime(end));
    const dimStyle = ignored ? 'opacity:0.45;' : '';
    const startEl  = i === 0
      ? `<span style="font-size:12px;color:var(--muted);min-width:58px">${startStr}</span>`
      : `<input type="text" value="${startStr}" data-split-role="edit-point" data-split-point-idx="${i - 1}"
               style="font-size:12px;color:var(--muted);background:transparent;border:none;border-bottom:1px dashed var(--muted);width:58px;text-align:center;padding:1px 2px"
               title="Edit split point (h:mm:ss or m:ss)"
               aria-label="Segment ${i + 1} start time">`;
    const endEl    = i === pts.length - 2
      ? `<span style="font-size:12px;color:var(--muted);min-width:58px">${endStr}</span>`
      : `<input type="text" value="${endStr}" data-split-role="edit-point" data-split-point-idx="${i}"
               style="font-size:12px;color:var(--muted);background:transparent;border:none;border-bottom:1px dashed var(--muted);width:58px;text-align:center;padding:1px 2px"
               title="Edit split point (h:mm:ss or m:ss)"
               aria-label="Segment ${i + 1} end time">`;
    const playBtn  = showPlayBtn
      ? `<button class="btn ghost" data-split-role="play" data-split-start="${start}" style="padding:2px 7px;font-size:12px;flex-shrink:0" title="Play from ${startStr}">&#9654;</button>`
      : '';
    const ignoreChk = showIgnore ? `<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);white-space:nowrap;cursor:pointer;flex-shrink:0" title="Ignore this segment - it will be split off but not analyzed">
        <input type="checkbox" ${ignored ? 'checked' : ''} data-split-role="ignore" data-split-idx="${i}"> Ignore
      </label>` : '';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;${ignored ? 'opacity:0.5' : ''}">
        ${playBtn}
        <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;${dimStyle}">${startEl}<span style="font-size:12px;color:var(--muted)">–</span>${endEl}</div>
        <input type="text" value="${name}" data-split-role="name" data-split-idx="${i}"
               style="flex:1;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px"
               ${ignored ? 'disabled' : ''}
               aria-label="Segment ${i + 1} name">
        ${ignoreChk}
      </div>`;
  }).join('');
}

function _toggleIgnored(idx, onRerender) {
  if (_splitIgnored.has(idx)) _splitIgnored.delete(idx);
  else _splitIgnored.add(idx);
  onRerender();
}

function _renderSplitSegmentList() {
  const action = document.querySelector('input[name="split-action"]:checked')?.value || 'partition';
  // Ignore only matters when segments get reanalyzed independently - meaningless
  // for a plain partition, where every segment keeps whatever clips land in it.
  _renderSegmentList('split-segment-list', true, action !== 'partition');
}

export function _fmtSplitTime(sec) {
  const s  = Math.round(sec);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  return `${m}:${String(ss).padStart(2,'0')}`;
}

// ── confirm ───────────────────────────────────────────────────────────────────

function confirmSplit() {
  const action = document.querySelector('input[name="split-action"]:checked')?.value || 'partition';
  if (action === 'partition') {
    _doSplitPartitionOnly();
    return;
  }
  const keepExported     = action === 'reanalyze-keep';
  const video            = AppState.videos.find(v => v.id === _splitVideoId);
  const clipCount        = video?.clip_count ?? _splitClipRanges.length;
  const exportedCount    = video?.exported ?? 0;
  const analyzedSegments = _splitPoints.length + 1 - _splitIgnored.size;
  const consequence = keepExported
    ? `This deletes ${plural(Math.max(0, clipCount - exportedCount), 'unexported clip')} (keeping ${plural(exportedCount, 'exported clip')}) and runs analysis fresh on ${plural(analyzedSegments, 'segment')}.`
    : `This deletes all ${plural(clipCount, 'existing clip')} and runs analysis fresh on ${plural(analyzedSegments, 'segment')}.`;
  showConfirm(
    'Delete clips and re-analyze?',
    consequence,
    'Delete & Re-analyze',
    () => _doSplitAndReanalyze(keepExported),
    true,
  );
}

async function _doSplitPartitionOnly() {
  if (!_splitVideoId) return;

  const btn = document.getElementById('btn-split-confirm');
  btn.disabled = true;
  btn.textContent = 'Splitting…';

  try {
    const res = await fetch(`/api/videos/${_splitVideoId}/split`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({split_points: _splitPoints, segment_names: _splitNames, migrate_clips: true}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatApiError(err));
    }
    const data = await res.json();
    showToast(
      `Recording split into ${plural(data.segment_ids.length, 'segment')} ` +
      ` -  ${plural(data.migrated_clips, 'clip')} moved over`
    );
    closeSplitEditor();
    await loadVideos();
  } catch (err) {
    showToast(`Split failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm';
  }
}

async function _doSplitAndReanalyze(keepExported) {
  if (!_splitVideoId) return;

  const parentVideo     = AppState.videos.find(v => v.id === _splitVideoId);
  const reanalyzeParams = await _reanalyzeParams(parentVideo);

  const btn = document.getElementById('btn-split-confirm');
  btn.disabled = true;
  btn.textContent = 'Splitting…';

  let segmentIds;
  try {
    const splitRes = await fetch(`/api/videos/${_splitVideoId}/split`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({split_points: _splitPoints, segment_names: _splitNames}),
    });
    if (!splitRes.ok) {
      const err = await splitRes.json().catch(() => ({}));
      throw new Error(formatApiError(err));
    }
    segmentIds = (await splitRes.json()).segment_ids;
  } catch (err) {
    showToast(`Split failed: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Confirm';
    return;
  }

  // Filter out ignored segments - they are split off but not analyzed
  const activeIds = segmentIds.filter((_, i) => !_splitIgnored.has(i));

  // Clear existing clips on each active segment before reanalyzing
  for (const segId of activeIds) {
    const clearRes = await fetch(`/api/videos/${segId}/clips/clear`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({keep_exported: keepExported}),
    });
    if (!clearRes.ok) {
      showToast(`Failed to clear clips on segment ${segId}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Confirm';
      return;
    }
  }

  closeSplitEditor();
  openLog();
  _reanalyzeSegmentsSequentially(activeIds, 0, reanalyzeParams);
}

async function _reanalyzeSegmentsSequentially(segmentIds, index, params) {
  if (index >= segmentIds.length) {
    loadVideos().then(() =>
      showToast(`Reanalysis complete - ${plural(segmentIds.length, 'segment')}`)
    );
    return;
  }
  await _waitWhileAnalyzePaused();
  const segId = segmentIds[index];
  fetch('/api/analyze/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({video_id: segId, ...params}),
  }).then(res => {
    if (!res.ok) {
      res.json().catch(() => ({})).then(err => {
        showToast(formatApiError(err) || `Failed to start analysis for segment ${segId}`, 'error');
      });
      return;
    }
    appendLog(`Analyzing segment ${index + 1}/${segmentIds.length}…`);
    streamSSE(
      '/api/analyze/events',
      () => { loadVideos(); _reanalyzeSegmentsSequentially(segmentIds, index + 1, params); },
      INGEST_STEPS,
      `Segment ${index + 1}/${segmentIds.length}`,
      false,
      null,
      true,
    );
  }).catch(err => showToast(netErrMsg(err), 'error'));
}

// ── pre-analysis split editor (inline in New Recording panel) ─────────────────

function onPreSplitToggle(checked) {
  if (checked && _splitDurationS > 0) {
    _openPreSplitEditor();
  } else {
    _closePreSplitEditor();
  }
}

export function initPreSplitDuration(durationS) {
  _splitDurationS = durationS;
  _splitPoints    = [];
  _splitNames     = [];
  const section = document.getElementById('pre-split-section');
  if (section) section.style.display = '';
  const toggle = document.getElementById('pre-split-toggle');
  if (toggle && toggle.checked) _openPreSplitEditor();
}

export function hidePreSplitSection() {
  _splitDurationS = 0;
  _splitPoints    = [];
  _splitNames     = [];
  const section = document.getElementById('pre-split-section');
  if (section) section.style.display = 'none';
  _closePreSplitEditor();
  const toggle = document.getElementById('pre-split-toggle');
  if (toggle) toggle.checked = false;
}

function _openPreSplitEditor() {
  _splitPoints = [];
  _splitNames  = [];
  const ed = document.getElementById('pre-split-editor');
  if (ed) ed.style.display = 'flex';
  _renderPreSplitEditor();
}

function _closePreSplitEditor() {
  const ed = document.getElementById('pre-split-editor');
  if (ed) ed.style.display = 'none';
}

function _rebuildPreSplitNames() {
  const count = _splitPoints.length + 1;
  _splitNames = Array.from({length: count}, (_, i) => `Part ${i + 1}`);
}

function _renderPreSplitEditor() {
  _renderPreSplitTimeline();
  _renderPreSplitSegmentList();
}

function _renderPreSplitTimeline() {
  const markers  = document.getElementById('pre-split-markers-layer');
  const segments = document.getElementById('pre-split-segments-layer');
  if (!markers || !_splitDurationS) return;

  const pts     = [0, ..._splitPoints, _splitDurationS];
  const palette = ['var(--accent)', 'var(--warning)', 'var(--green)', 'var(--red)'];
  segments.innerHTML = pts.slice(0, -1).map((start, i) => {
    const end      = pts[i + 1];
    const widthPct = ((end - start) / _splitDurationS * 100).toFixed(3);
    const col      = palette[i % palette.length];
    return `<div style="height:100%;width:${widthPct}%;background:${col};opacity:0.12;border-right:1px solid ${col}"></div>`;
  }).join('');

  markers.innerHTML = _splitPoints.map(p => {
    const pct = (p / _splitDurationS * 100).toFixed(3);
    const timeLabel = _fmtSplitTime(p);
    return `<div class="split-marker" data-split-sec="${p}" style="position:absolute;left:${pct}%;top:0;bottom:0;width:10px;transform:translateX(-50%);cursor:ew-resize;pointer-events:auto;display:flex;align-items:stretch;justify-content:center"
                 title="${timeLabel} - drag to move">
               <div style="width:2px;background:var(--accent);border-radius:1px"></div>
               <button type="button" class="split-marker-x" title="Remove split point"
                       aria-label="Remove split point at ${timeLabel}">&#215;</button>
             </div>`;
  }).join('');
}

function _renderPreSplitSegmentList() {
  _renderSegmentList('pre-split-segment-list', false);
}

function preSplitTimelineClick(e) {
  if (!_splitDurationS || _dragActive) return;
  const bar  = document.getElementById('pre-split-timeline-bar');
  const rect = bar.getBoundingClientRect();
  const frac = (e.clientX - rect.left) / rect.width;
  const sec  = Math.round(frac * _splitDurationS * 10) / 10;

  if (sec <= 0 || sec >= _splitDurationS) return;

  const threshold = _splitDurationS * 0.005;
  if (_splitPoints.some(p => Math.abs(p - sec) <= threshold)) return;

  _splitPoints.push(sec);
  _splitPoints.sort((a, b) => a - b);
  _rebuildPreSplitNames();
  _renderPreSplitEditor();
}

function _preSplitMarkerPointerDown(e, sec) {
  e.stopPropagation();
  e.preventDefault();
  _dragMarkerSec = sec;
  _dragActive    = true;

  const bar = document.getElementById('pre-split-timeline-bar');

  function onMove(ev) {
    if (!_dragActive) return;
    const rect   = bar.getBoundingClientRect();
    const frac   = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    const newSec = Math.round(frac * _splitDurationS * 10) / 10;
    if (newSec <= 0 || newSec >= _splitDurationS) return;
    const idx = _splitPoints.indexOf(_dragMarkerSec);
    if (idx !== -1) {
      _splitPoints[idx] = newSec;
      _dragMarkerSec    = newSec;
      _splitPoints.sort((a, b) => a - b);
      _renderPreSplitEditor();
    }
  }

  function onUp() {
    _dragActive    = false;
    _dragMarkerSec = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup',   onUp);
    _rebuildPreSplitNames();
    _renderPreSplitEditor();
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup',   onUp);
}

// ── event wiring (replaces the former inline on* attributes) ──────────────────
// Every element below is static markup in index.html (the split-editor-panel is
// only reparented by PanelNav, never re-created; the pre-split editor lives in
// the New Recording panel), so a single set of listeners wired once at module
// load covers every open. The marker / segment-row markup is re-rendered, so
// those use one delegated listener per persistent container.

function _wireMarkerLayer(layerId, onPointerDown, isPreSplit) {
  const layer = document.getElementById(layerId);
  if (!layer) return;
  layer.addEventListener('pointerdown', e => {
    // A pointerdown on the × button must not start a drag.
    if (e.target.closest('.split-marker-x')) { e.stopPropagation(); return; }
    const marker = e.target.closest('.split-marker');
    if (marker) onPointerDown(e, Number(marker.dataset.splitSec));
  });
  layer.addEventListener('click', e => {
    const xBtn = e.target.closest('.split-marker-x');
    if (!xBtn) return;
    e.stopPropagation();
    const marker = xBtn.closest('.split-marker');
    if (marker) _removeSplitPoint(Number(marker.dataset.splitSec), isPreSplit);
  });
}

function _wireSegmentList(listId, onRerender) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.addEventListener('change', e => {
    const el = e.target;
    const role = el.dataset.splitRole;
    if (role === 'edit-point') _updateSplitPoint(Number(el.dataset.splitPointIdx), el.value, onRerender);
    else if (role === 'name') _splitNames[Number(el.dataset.splitIdx)] = el.value;
    else if (role === 'ignore') _toggleIgnored(Number(el.dataset.splitIdx), onRerender);
  });
  list.addEventListener('click', e => {
    const playBtn = e.target.closest('[data-split-role="play"]');
    if (playBtn) _splitSeekTo(Number(playBtn.dataset.splitStart));
  });
}

function _wireSplitEditor() {
  // Instruction copy (scripts load at end of <body>, so the elements exist).
  document.getElementById('pre-split-instructions').textContent = SPLIT_BAR_INSTRUCTIONS;
  document.getElementById('split-instructions').textContent =
    `${SPLIT_BAR_INSTRUCTIONS} Click a marker to jump the preview there. Each segment can be analyzed independently after confirming.`;

  // Ctrl/⌘+wheel over the timeline zooms; passive:false so preventDefault sticks.
  document.getElementById('split-timeline-scroll')
    ?.addEventListener('wheel', _onSplitZoomWheel, { passive: false });

  // Main split editor - zoom controls, timeline click, confirm, action radios.
  document.getElementById('split-zoom-out')?.addEventListener('click', () => _setSplitZoom(_splitZoom / 1.6));
  document.getElementById('split-zoom-in')?.addEventListener('click', () => _setSplitZoom(_splitZoom * 1.6));
  document.getElementById('split-zoom-fit')?.addEventListener('click', () => _setSplitZoom(1));
  document.getElementById('split-timeline-bar')?.addEventListener('click', splitTimelineClick);
  // Suggestion pins sit inside the timeline bar; catch their click here and stop it
  // bubbling so the bar's coordinate-based splitTimelineClick doesn't also fire.
  document.getElementById('split-suggestion-layer')?.addEventListener('click', e => {
    const pin = e.target.closest('[data-pin]');
    if (!pin) return;
    e.stopPropagation();
    _promoteSuggestionPin(Number(pin.dataset.pin));
  });
  document.getElementById('btn-split-confirm')?.addEventListener('click', confirmSplit);
  document.getElementById('split-action-options')?.addEventListener('change', _updateSplitConfirmState);
  document.querySelector('#split-waveform-notice button')?.addEventListener('click', _generateWaveform);

  // Pre-analysis split editor (New Recording panel).
  document.getElementById('pre-split-toggle')?.addEventListener('change', e => onPreSplitToggle(e.target.checked));
  document.getElementById('pre-split-timeline-bar')?.addEventListener('click', preSplitTimelineClick);

  // Re-rendered markup - one delegated listener per persistent container.
  _wireMarkerLayer('split-markers-layer', _splitMarkerPointerDown, false);
  _wireMarkerLayer('pre-split-markers-layer', _preSplitMarkerPointerDown, true);
  _wireSegmentList('split-segment-list', _renderSplitEditor);
  _wireSegmentList('pre-split-segment-list', _renderPreSplitEditor);
}

export function initSplitListeners() {
  _wireSplitEditor();
}
