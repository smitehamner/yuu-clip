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

const _SUGGESTION_MIN_GAP_S = 30;
const _SUGGESTION_COUNT     = 8;

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

  const previewEl = document.getElementById('split-preview-video');
  previewEl.src = `/api/videos/${videoId}/source`;
  previewEl.style.display = 'block';

  const notice = document.getElementById('split-waveform-notice');
  notice.style.display = 'none';

  const panel = document.getElementById('split-editor-panel');
  panel.style.display = 'flex';
  document.querySelector('.main').style.overflowY = 'auto';

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

function closeSplitEditor() {
  const previewEl = document.getElementById('split-preview-video');
  previewEl.pause();
  previewEl.src = '';
  previewEl.style.display = 'none';
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

// ── canvas waveform ──────────────────────────────────────────────────────────

function _drawWaveform() {
  const canvas = document.getElementById('split-waveform-canvas');
  if (!canvas || !_splitEnergyFlat.length || !_splitDurationS) return;

  // Use layout size, not CSS pixel size
  const W = canvas.offsetWidth || 800;
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
    return `<div data-pin="${sec}"
                 style="position:absolute;left:${pct}%;top:0;bottom:0;width:1px;border-left:1.5px dashed rgba(255,255,255,0.35);cursor:pointer;pointer-events:auto"
                 title="Quiet valley at ${_fmtSplitTime(sec)} — click to place marker"
                 onclick="event.stopPropagation();_promoteSuggestionPin(${sec})"></div>`;
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

  const threshold = _splitDurationS * 0.005;
  const nearIdx = _splitPoints.findIndex(p => Math.abs(p - sec) <= threshold);
  if (nearIdx !== -1) {
    _splitPoints.splice(nearIdx, 1);
  } else {
    _splitPoints.push(sec);
    _splitPoints.sort((a, b) => a - b);
  }
  _rebuildSplitNames();
  _renderSplitEditor();
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
  const palette = ['var(--accent)', 'var(--amber)', 'var(--green)', 'var(--red)'];
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
    return `<div style="position:absolute;left:${pct}%;top:0;bottom:0;width:10px;transform:translateX(-50%);cursor:ew-resize;pointer-events:auto;display:flex;align-items:stretch;justify-content:center"
                 title="${_fmtSplitTime(p)} — drag to move, click bar edge to remove"
                 onpointerdown="event.stopPropagation();_splitMarkerPointerDown(event,${p})">
               <div style="width:2px;background:var(--accent);border-radius:1px"></div>
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
  if (sec === null || sec <= 0 || sec >= _splitDurationS) { onRerender(); return; }
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
  } else if (action === 'reanalyze-all') {
    _doSplitAndReanalyze(false);
  } else {
    _doSplitAndReanalyze(true);
  }
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
    showToast(`Recording split into ${data.segment_ids.length} segment(s)`);
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
  _reanalyzeSegmentsSequentially(activeIds, 0);
}

function _reanalyzeSegmentsSequentially(segmentIds, index) {
  if (index >= segmentIds.length) {
    loadVideos().then(() =>
      showToast(`Reanalysis complete — ${segmentIds.length} segment(s)`)
    );
    return;
  }
  const segId = segmentIds[index];
  fetch('/api/analyze/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({video_id: segId, model: 'medium'}),
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
      () => { loadVideos(); _reanalyzeSegmentsSequentially(segmentIds, index + 1); },
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
  const palette = ['var(--accent)', 'var(--amber)', 'var(--green)', 'var(--red)'];
  segments.innerHTML = pts.slice(0, -1).map((start, i) => {
    const end      = pts[i + 1];
    const widthPct = ((end - start) / _splitDurationS * 100).toFixed(3);
    const col      = palette[i % palette.length];
    return `<div style="height:100%;width:${widthPct}%;background:${col};opacity:0.12;border-right:1px solid ${col}"></div>`;
  }).join('');

  markers.innerHTML = _splitPoints.map(p => {
    const pct = (p / _splitDurationS * 100).toFixed(3);
    return `<div style="position:absolute;left:${pct}%;top:0;bottom:0;width:10px;transform:translateX(-50%);cursor:ew-resize;pointer-events:auto;display:flex;align-items:stretch;justify-content:center"
                 title="${_fmtSplitTime(p)} — drag to move"
                 onpointerdown="event.stopPropagation();_preSplitMarkerPointerDown(event,${p})">
               <div style="width:2px;background:var(--accent);border-radius:1px"></div>
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
  const nearIdx   = _splitPoints.findIndex(p => Math.abs(p - sec) <= threshold);
  if (nearIdx !== -1) {
    _splitPoints.splice(nearIdx, 1);
  } else {
    _splitPoints.push(sec);
    _splitPoints.sort((a, b) => a - b);
  }
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
