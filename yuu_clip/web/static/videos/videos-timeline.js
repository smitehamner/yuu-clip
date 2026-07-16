// Feature-map - Recording detail: session timeline generation (code: video / Video).
// Extracted out of videos.js (which grew into a catch-all) - the list/filter/
// detail-render/re-analysis core stays there; _needsModelCtaHTML is shared with
// the summary feature and stays in videos.js core too.
//   API: routes/videos.py (timeline SSE) · Tests: tests/ui/test_ui_video.py, tests/integration/test_scoring_routes.py

import { AppState } from '../core/state.js';
import { escHtml, plural, _parseIntervalS } from '../core/format.js';
import { showToast } from '../core/utils.js';
import {
  _openSSE, _setActiveStream, _clearActiveStream, _supersedeActiveStream, _blockedByAnalyze,
} from '../core/jobs.js';
import { _needsModelCtaHTML } from './videos.js';

// ── timeline render helpers ───────────────────────────────────────────────────
export function _renderTimelineHTML(entries) {
  if (!entries || !entries.length) return '';
  const rows = entries.map(e =>
    `<div class="timeline-entry">
      <div class="timeline-stamp">${escHtml(e.start_hms)}</div>
      <div class="timeline-text">${escHtml(e.text)}</div>
    </div>`
  ).join('');
  return `<div class="timeline">${rows}</div>`;
}

export function _timelineEmptyNoteHTML() {
  return `<div style="color:var(--muted);font-size:12px">No timeline yet - generate a time-stamped outline of the session.</div>`;
}

// ── timeline generation ───────────────────────────────────────────────────────
let _timelineVideoId = null;
let _timelineIntervalOpener = null;

export function generateTimeline(id) {
  _timelineIntervalOpener = document.activeElement;
  _timelineVideoId = id;
  const video = AppState.videos.find(v => v.id === id);
  _loadTimelineIntervalConfig().then(() => {
    updateTimelineIntervalHint(video);
    document.getElementById('timeline-interval-modal').classList.add('visible');
    setTimeout(() => document.getElementById('timeline-interval-value')?.focus(), 50);
  });
}

export function closeTimelineIntervalModal() {
  document.getElementById('timeline-interval-modal').classList.remove('visible');
  const opener = _timelineIntervalOpener;
  _timelineIntervalOpener = null;
  if (opener?.focus) opener.focus();
}

async function _loadTimelineIntervalConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const cfg = await res.json();
    const val = cfg.ui_timeline_interval_seconds || 900;
    const unit = cfg.ui_timeline_interval_unit || 'minutes';
    if (unit === 'minutes') {
      document.getElementById('timeline-interval-value').value = Math.round(val / 60);
      document.getElementById('timeline-interval-unit').value = 'minutes';
    } else {
      document.getElementById('timeline-interval-value').value = val;
      document.getElementById('timeline-interval-unit').value = 'seconds';
    }
  } catch (_) {}
}

function updateTimelineIntervalHint(video) {
  video = video || AppState.videos.find(v => v.id === _timelineVideoId);
  const val = parseInt(document.getElementById('timeline-interval-value').value, 10) || 1;
  const unit = document.getElementById('timeline-interval-unit').value;
  const intervalS = unit === 'minutes' ? val * 60 : val;
  const hint = document.getElementById('timeline-interval-hint');
  const genBtn = document.querySelector('#timeline-interval-modal .btn.primary');
  if (intervalS < 10) {
    hint.textContent = 'Minimum interval is 10 seconds.';
    hint.style.color = 'var(--red)';
    if (genBtn) genBtn.disabled = true;
    return;
  }
  if (genBtn) genBtn.disabled = false;
  hint.style.color = 'var(--muted)';
  if (video && video.duration_ms) {
    const dur = video.duration_ms / 1000;
    const durMin = Math.round(dur / 60);
    const entries = Math.max(1, Math.ceil(dur / intervalS));
    if (intervalS >= dur) {
      hint.textContent = `Recording is ${durMin} min - this produces 1 entry covering the whole session.`;
    } else {
      hint.textContent = `Recording is ${durMin} min - produces ~${plural(entries, 'entry', 'entries')}.`;
    }
  } else {
    hint.textContent = '';
  }
}

async function confirmGenerateTimeline() {
  const unit = document.getElementById('timeline-interval-unit').value;
  const n = parseInt(document.getElementById('timeline-interval-value').value, 10);
  const intervalS = _parseIntervalS(n || 15, unit);
  if (intervalS === null) return;

  fetch('/api/config', {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ui_timeline_interval_seconds: intervalS, ui_timeline_interval_unit: unit}),
  }).catch(() => {});

  closeTimelineIntervalModal();
  _startGenerateTimeline(_timelineVideoId, intervalS);
}

function _startGenerateTimeline(id, intervalS) {
  if (_blockedByAnalyze('generate a timeline')) return;
  const section = document.getElementById('timeline-section');
  const intervalLabel = intervalS >= 60
    ? `${Math.round(intervalS / 60)}-minute`
    : `${intervalS}-second`;
  section.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:4px 0">Generating timeline - entries will appear as each ${intervalLabel} window completes…</div>`;
  const btn = document.getElementById('btn-generate-timeline');
  btn.disabled = true;
  btn.textContent = 'Generating Timeline…';

  _supersedeActiveStream();
  const resetBtn = () => {
    const video = AppState.videos.find(v => v.id === id);
    btn.disabled = false;
    btn.textContent = video?.has_timeline ? 'Regenerate Timeline' : 'Generate Timeline';
  };
  let firstEntry = true;
  let needsModel = false;

  const handle = _openSSE(
    `/api/videos/${id}/timeline?interval_s=${intervalS}`,
    data => {
      if (data && data.needs_model) {
        needsModel = true;
        section.innerHTML = _needsModelCtaHTML(data);
        return;
      }
      if (firstEntry) {
        section.innerHTML = `<div class="timeline" id="timeline-list"></div>`;
        firstEntry = false;
      }
      const row = document.createElement('div');
      row.className = 'timeline-entry';
      row.innerHTML = `
        <div class="timeline-stamp">${escHtml(data.start_hms)}</div>
        <div class="timeline-text">${escHtml(data.text)}</div>`;
      document.getElementById('timeline-list').appendChild(row);
    },
    () => {
      _clearActiveStream(handle);
      resetBtn();
      if (needsModel) return;
      const video = AppState.videos.find(v => v.id === id);
      if (video) video.has_timeline = true;
      showToast('Timeline generated');
    },
    errMsg => {
      _clearActiveStream(handle);
      resetBtn();
      // A failed regenerate leaves the stored timeline intact server-side, so
      // don't claim "No timeline yet" - leave the section blank instead.
      if (firstEntry) {
        const video = AppState.videos.find(v => v.id === id);
        section.innerHTML = video?.has_timeline ? '' : _timelineEmptyNoteHTML();
      }
      showToast(`Timeline generation failed - ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, resetBtn);
}

// ── static modal wiring (replaces the inline onclick=/oninput=/onchange= this
// module used to own in index.html) ────────────────────────────────────────────
// timeline-interval-modal is a fixed, never-recreated element in index.html, so
// wiring it once at module load (below) can't double-fire on a re-render.
function _wireTimelineModal() {
  const modal = document.getElementById('timeline-interval-modal');
  modal.addEventListener('click', e => { if (e.target === modal) closeTimelineIntervalModal(); });
  document.getElementById('timeline-interval-cancel-btn').addEventListener('click', () => closeTimelineIntervalModal());
  document.getElementById('timeline-interval-generate-btn').addEventListener('click', () => confirmGenerateTimeline());
  document.getElementById('timeline-interval-value').addEventListener('input', () => updateTimelineIntervalHint());
  document.getElementById('timeline-interval-unit').addEventListener('change', () => updateTimelineIntervalHint());
}

_wireTimelineModal();
