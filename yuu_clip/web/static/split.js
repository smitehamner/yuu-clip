// ── split editor ─────────────────────────────────────────────────────────────

let _splitVideoId   = null;
let _splitDurationS = 0;
let _splitPoints    = [];  // sorted list of seconds
let _splitNames     = [];  // auto-names, editable
let _splitIgnored   = new Set();  // indices of segments to skip

// Overlay data fetched once when the editor opens
let _splitEnergyFlat = [];   // [{second, rms_db}, …] merged across tracks
let _splitSceneMs    = [];   // [ms, …] scene boundary timecodes
let _splitClipRanges = [];   // [{start_ms, end_ms}, …] existing clips

// Drag state
let _dragMarkerSec  = null;
let _dragActive     = false;

// Suggestion pins (energy-valley seconds)
let _suggestionPins = [];    // [sec, …]

// Timeline zoom (main split editor only): 1 = fit whole recording, higher =
// wider bar inside a horizontal-scroll container. All overlay layers are
// %-positioned so they scale for free; only the waveform canvas needs a redraw.
let _splitZoom = 1;
const _SPLIT_ZOOM_MIN = 1;
const _SPLIT_ZOOM_MAX = 50;

const _SUGGESTION_MIN_GAP_S = 30;
const _SUGGESTION_COUNT     = 8;

// One instruction string for both editors (L6-3); the main editor appends its
// extra affordances. Scripts load at the end of <body>, so the elements exist.
const SPLIT_BAR_INSTRUCTIONS =
  'Click the bar to place a split point. Drag a marker to move it; hover over it and click its × to remove it.';
document.getElementById('pre-split-instructions').textContent = SPLIT_BAR_INSTRUCTIONS;
document.getElementById('split-instructions').textContent =
  `${SPLIT_BAR_INSTRUCTIONS} Click a marker to jump the preview there. Each segment can be analyzed independently after confirming.`;

// Ctrl/⌘+wheel over the timeline zooms; passive:false so preventDefault sticks.
document.getElementById('split-timeline-scroll')
  ?.addEventListener('wheel', _onSplitZoomWheel, { passive: false });

function isSplitEditorOpen() {
  return _splitVideoId !== null;
}

async function openSplitEditor(videoId) {
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

  document.getElementById('split-editor-title').textContent =
    `Split: ${video.filename}`;

  _setupSplitPreview(videoId);

  const notice = document.getElementById('split-waveform-notice');
  notice.style.display = 'none';

  const panel = document.getElementById('split-editor-panel');
  panel.style.display = 'flex';
  document.querySelector('.main').style.overflowY = 'auto';

  // A destructive re-analyze choice must not persist into the next session.
  document.querySelector('input[name="split-action"][value="partition"]').checked = true;

  _resetSplitZoom();
  _renderSplitEditor();

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
    notice.style.display = 'flex';
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

function requestCloseSplitEditor() {
  if (_splitPoints.length > 0) {
    showConfirm(
      'Discard split points?',
      'The split points you placed will be lost. Close without splitting?',
      'Discard',
      closeSplitEditor,
      true,
    );
    return;
  }
  closeSplitEditor();
}

function closeSplitEditor() {
  const previewEl = document.getElementById('split-preview-video');
  previewEl.pause();
  previewEl.src = '';
  document.getElementById('split-preview-wrap').style.display = 'none';
  const badge = document.getElementById('split-preview-badge');
  if (badge) badge.style.display = 'none';
  document.getElementById('split-editor-panel').style.display = 'none';
  document.getElementById('split-waveform-notice').style.display = 'none';
  document.querySelector('.main').style.overflowY = '';
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

// ── preview proxy (720p, fast scrubbing) ──────────────────────────────────────
// A multi-hour source .mkv is not browser-seekable, so we prefer a downscaled
// 720p proxy. Start on the source (usable immediately), then swap to the proxy
// when one exists or is built on demand. A badge always states which is playing.

async function _setupSplitPreview(videoId) {
  const wrap  = document.getElementById('split-preview-wrap');
  const video = document.getElementById('split-preview-video');
  wrap.style.display = 'block';
  video.src = `/api/videos/${videoId}/source`;
  _setSplitPreviewBadge('original');

  let status = null;
  try {
    status = await fetch(`/api/videos/${videoId}/proxy-status`).then(r => r.ok ? r.json() : null);
  } catch (_) { /* leave on source */ }
  if (_splitVideoId !== videoId) return;   // editor closed or switched while awaiting
  if (!status) return;

  if (status.available) _useSplitProxy(videoId);
  else _buildSplitProxy(videoId);
}

function _useSplitProxy(videoId) {
  if (_splitVideoId !== videoId) return;
  const video = document.getElementById('split-preview-video');
  const resumeAt   = video.currentTime || 0;
  const wasPlaying = !video.paused;
  video.src = `/api/videos/${videoId}/proxy`;
  video.addEventListener('loadedmetadata', () => {
    try { video.currentTime = resumeAt; } catch (_) {}
    if (wasPlaying) video.play().catch(() => {});
  }, { once: true });
  _setSplitPreviewBadge('proxy');
}

function _buildSplitProxy(videoId) {
  if (_splitVideoId !== videoId) return;
  _setSplitPreviewBadge('building');
  streamSSE(
    `/api/videos/${videoId}/proxy/generate`,
    async () => {
      if (_splitVideoId !== videoId) return;
      const status = await fetch(`/api/videos/${videoId}/proxy-status`)
        .then(r => r.ok ? r.json() : null).catch(() => null);
      if (_splitVideoId !== videoId) return;
      if (status?.available) _useSplitProxy(videoId);
      // Another tab/open is still encoding — poll until its proxy lands.
      else if (status?.generating) setTimeout(() => _buildSplitProxy(videoId), 5000);
      else _setSplitPreviewBadge('original');
    },
    null,        // no global job pill — this is a background convenience
    'Preview',
    false,
    line => {    // onLine: surface the encode percentage on the badge
      const m = /(\d+)%/.exec(line);
      if (m && _splitVideoId === videoId) _setSplitPreviewBadge('building', m[1]);
    },
  );
}

function _setSplitPreviewBadge(mode, pct) {
  const badge = document.getElementById('split-preview-badge');
  if (!badge) return;
  badge.style.display = 'inline-block';
  if (mode === 'proxy') {
    badge.textContent = 'Preview quality (720p)';
    badge.title = 'Playing a downscaled 720p preview for fast seeking — not full quality.';
  } else if (mode === 'building') {
    badge.textContent = pct ? `Building 720p preview… ${pct}%` : 'Building 720p preview…';
    badge.title = 'Encoding a fast-seeking 720p preview from the source recording.';
  } else {
    badge.textContent = 'Original quality · slower seeking';
    badge.title = 'Playing the original recording — seeking a long file can be slow.';
  }
}

async function _generateWaveform() {
  const btn = document.querySelector('#split-waveform-notice button');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  const notice = document.getElementById('split-waveform-notice');

  streamSSE(
    `/api/videos/${_splitVideoId}/compute-waveform`,
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
      if (btn) { btn.disabled = false; btn.textContent = 'Generate Waveform'; }
    },
    null,
    'Waveform',
    false,
  );
}

// ── suggestion pins ──────────────────────────────────────────────────────────

function _computeSuggestionPins() {
  if (!_splitEnergyFlat.length || !_splitDurationS) return;

  // Work with normalised linear energy (not dB) for valley detection
  const minDb = Math.min(..._splitEnergyFlat.map(s => s.rms_db));
  const maxDb = Math.max(..._splitEnergyFlat.map(s => s.rms_db));
  const range  = maxDb - minDb || 1;

  // Score each second: 1 = quietest, 0 = loudest
  const scored = _splitEnergyFlat.map(s => ({
    sec:   s.second,
    score: 1 - (s.rms_db - minDb) / range,
  }));

  // Greedy pick: take the highest-scoring second not within gap of a chosen pin
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const pins = [];
  for (const { sec } of sorted) {
    if (pins.length >= _SUGGESTION_COUNT) break;
    if (sec <= 0 || sec >= _splitDurationS) continue;
    if (pins.some(p => Math.abs(p - sec) < _SUGGESTION_MIN_GAP_S)) continue;
    pins.push(sec);
  }
  _suggestionPins = pins.sort((a, b) => a - b);
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
    return `<div style="position:absolute;left:${pct}%;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.25)" title="Scene cut at ${_fmtSplitTime(ms / 1000)}"></div>`;
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
                 title="Quiet valley at ${_fmtSplitTime(sec)} — click to place a split point here"
                 onclick="event.stopPropagation();_promoteSuggestionPin(${sec})">
               <div style="width:0;border-left:1.5px dashed rgba(255,255,255,0.35)"></div>
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
    return `<div style="position:absolute;left:${leftPct}%;width:${widthPct}%;top:50%;transform:translateY(-50%);height:4px;background:rgba(255,255,255,0.18);border-radius:2px" title="Existing clip ${_fmtSplitTime(start_ms/1000)}–${_fmtSplitTime(end_ms/1000)}"></div>`;
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

function splitTimelineClick(e) {
  if (!_splitDurationS || _dragActive) return;
  const bar  = document.getElementById('split-timeline-bar');
  const rect = bar.getBoundingClientRect();
  const frac = (e.clientX - rect.left) / rect.width;
  const sec  = Math.round(frac * _splitDurationS * 10) / 10;

  if (sec <= 0 || sec >= _splitDurationS) return;

  // Too close to an existing marker — ignore rather than stack a near-duplicate
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
  _splitNames = Array.from({length: count}, (_, i) => `${stem} — Part ${i + 1}`);
}

function _renderSplitEditor() {
  _renderSplitTimeline();
  _renderSplitSegmentList();
  _updateSplitConfirmState();
}

function _updateSplitConfirmState() {
  const btn = document.getElementById('btn-split-confirm');
  const action = document.querySelector('input[name="split-action"]:checked')?.value || 'partition';
  btn.classList.toggle('danger', action !== 'partition');
  btn.classList.toggle('primary', action === 'partition');
  const noPoints = _splitPoints.length === 0;
  btn.disabled = noPoints;
  btn.title = noPoints ? 'Place at least one split point first' : '';
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

  // User-placed markers with drag handles
  markers.innerHTML = _splitPoints.map(p => {
    const pct = (p / _splitDurationS * 100).toFixed(3);
    const timeLabel = _fmtSplitTime(p);
    return `<div class="split-marker" style="position:absolute;left:${pct}%;top:0;bottom:0;width:10px;transform:translateX(-50%);cursor:ew-resize;pointer-events:auto;display:flex;align-items:stretch;justify-content:center"
                 title="${timeLabel} — drag to move, click to preview from here"
                 onpointerdown="event.stopPropagation();_splitMarkerPointerDown(event,${p})">
               <div style="width:2px;background:var(--accent);border-radius:1px"></div>
               <button type="button" class="split-marker-x" title="Remove split point"
                       aria-label="Remove split point at ${timeLabel}"
                       onpointerdown="event.stopPropagation()"
                       onclick="event.stopPropagation();_removeSplitPoint(${p},false)">&#215;</button>
             </div>`;
  }).join('');
}

function _parseSplitTime(str) {
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
    showToast(`Couldn't read "${timeStr}" — use h:mm:ss or m:ss`, 'error');
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

function _renderSegmentList(listId, onRerender, showPlayBtn) {
  const list = document.getElementById(listId);
  if (!list || !_splitDurationS) return;
  const pts = [0, ..._splitPoints, _splitDurationS];

  list.innerHTML = pts.slice(0, -1).map((start, i) => {
    const end      = pts[i + 1];
    const ignored  = _splitIgnored.has(i);
    const name     = escHtml(_splitNames[i] || `Part ${i + 1}`);
    const startStr = escHtml(_fmtSplitTime(start));
    const endStr   = escHtml(_fmtSplitTime(end));
    const onUpdate = `_updateSplitPoint(%idx%, this.value, ${onRerender.name})`;
    const dimStyle = ignored ? 'opacity:0.45;' : '';
    const startEl  = i === 0
      ? `<span style="font-size:12px;color:var(--muted);min-width:58px">${startStr}</span>`
      : `<input type="text" value="${startStr}"
               style="font-size:12px;color:var(--muted);background:transparent;border:none;border-bottom:1px dashed var(--muted);width:58px;text-align:center;padding:1px 2px"
               title="Edit split point (h:mm:ss or m:ss)"
               onchange="${onUpdate.replace('%idx%', i - 1)}"
               aria-label="Segment ${i + 1} start time">`;
    const endEl    = i === pts.length - 2
      ? `<span style="font-size:12px;color:var(--muted);min-width:58px">${endStr}</span>`
      : `<input type="text" value="${endStr}"
               style="font-size:12px;color:var(--muted);background:transparent;border:none;border-bottom:1px dashed var(--muted);width:58px;text-align:center;padding:1px 2px"
               title="Edit split point (h:mm:ss or m:ss)"
               onchange="${onUpdate.replace('%idx%', i)}"
               aria-label="Segment ${i + 1} end time">`;
    const playBtn  = showPlayBtn
      ? `<button class="btn ghost" style="padding:2px 7px;font-size:12px;flex-shrink:0" title="Play from ${startStr}" onclick="_splitSeekTo(${start})">&#9654;</button>`
      : '';
    const ignoreChk = `<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);white-space:nowrap;cursor:pointer;flex-shrink:0" title="Ignore this segment — it will be split off but not analyzed">
        <input type="checkbox" ${ignored ? 'checked' : ''} onchange="_toggleIgnored(${i}, ${onRerender.name})"> Ignore
      </label>`;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;${ignored ? 'opacity:0.5' : ''}">
        ${playBtn}
        <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;${dimStyle}">${startEl}<span style="font-size:12px;color:var(--muted)">–</span>${endEl}</div>
        <input type="text" value="${name}"
               style="flex:1;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px"
               onchange="_splitNames[${i}] = this.value"
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
  _renderSegmentList('split-segment-list', _renderSplitEditor, true);
}

function _fmtSplitTime(sec) {
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
      body: JSON.stringify({split_points: _splitPoints, segment_names: _splitNames}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatApiError(err));
    }
    const data = await res.json();
    showToast(`Recording split into ${plural(data.segment_ids.length, 'segment')}`);
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

  // Filter out ignored segments — they are split off but not analyzed
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

function _reanalyzeSegmentsSequentially(segmentIds, index, params) {
  if (index >= segmentIds.length) {
    loadVideos().then(() =>
      showToast(`Reanalysis complete — ${plural(segmentIds.length, 'segment')}`)
    );
    return;
  }
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
    );
  }).catch(err => showToast(`Network error: ${err.message}`, 'error'));
}

// ── pre-analysis split editor (inline in New Recording panel) ─────────────────

function onPreSplitToggle(checked) {
  if (checked && _splitDurationS > 0) {
    _openPreSplitEditor();
  } else {
    _closePreSplitEditor();
  }
}

function initPreSplitDuration(durationS) {
  _splitDurationS = durationS;
  _splitPoints    = [];
  _splitNames     = [];
  const section = document.getElementById('pre-split-section');
  if (section) section.style.display = '';
  const toggle = document.getElementById('pre-split-toggle');
  if (toggle && toggle.checked) _openPreSplitEditor();
}

function hidePreSplitSection() {
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
    return `<div class="split-marker" style="position:absolute;left:${pct}%;top:0;bottom:0;width:10px;transform:translateX(-50%);cursor:ew-resize;pointer-events:auto;display:flex;align-items:stretch;justify-content:center"
                 title="${timeLabel} — drag to move"
                 onpointerdown="event.stopPropagation();_preSplitMarkerPointerDown(event,${p})">
               <div style="width:2px;background:var(--accent);border-radius:1px"></div>
               <button type="button" class="split-marker-x" title="Remove split point"
                       aria-label="Remove split point at ${timeLabel}"
                       onpointerdown="event.stopPropagation()"
                       onclick="event.stopPropagation();_removeSplitPoint(${p},true)">&#215;</button>
             </div>`;
  }).join('');
}

function _renderPreSplitSegmentList() {
  _renderSegmentList('pre-split-segment-list', _renderPreSplitEditor, false);
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
