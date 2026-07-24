// Feature-map - Pure formatters and score helpers: no DOM, no fetch. HTML-escape, API-error text,
//   duration/date/offset formatting, video-status labels, and the score color/icon encoding.
//   API: none (client-only) · Tests: tests/ui/test_ui_utils.py
// escHtml is the shared escaper (also used by the Electron wizard); re-exported here so
// the many `import { escHtml } from '../core/format.js'` call sites stay unchanged.
import { escHtml } from '../shared/escapehtml.js';

// ── score utils ───────────────────────────────────────────────────────────────
const AXIS_ICONS = {
  overall: '&#11088;',
  funny: '&#128514;',
  dramatic: '&#127917;',
  action: '&#9876;&#65039;',
  visual: '&#127916;',
  laugh: '&#129315;',
  length: '&#8986;',
  timeline: '&#128336;',
};

function _scoreIcon(score) {
  const color = score >= 0.7 ? 'var(--green)' : score >= 0.4 ? 'var(--warning)' : 'var(--muted)';
  return `<span style="color:${color};font-size:10px" aria-hidden="true">&#11088;</span>`;
}

function _lerpColor(c1, c2, t) {
  const h = c => [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
  const [r1,g1,b1] = h(c1), [r2,g2,b2] = h(c2);
  return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}

function _scoreBorderColor(score, isRejected) {
  if (isRejected) return 'var(--muted)';
  const stops = [[0,'#6b6b80'],[0.3,'#4fc3f7'],[0.5,'#4caf7d'],[0.7,'#f0c060'],[1.0,'#f7a85a']];
  for (let i = 1; i < stops.length; i++) {
    if (score <= stops[i][0]) {
      const t = (score - stops[i-1][0]) / (stops[i][0] - stops[i-1][0]);
      return _lerpColor(stops[i-1][1], stops[i][1], t);
    }
  }
  return stops[stops.length-1][1];
}

function _sortScore(clip) {
  const sort = window._clipsSortParam();
  if (sort === 'funny')    return clip.score_funny;
  if (sort === 'dramatic') return clip.score_dramatic;
  if (sort === 'action')   return clip.score_action;
  if (sort === 'visual')   return clip.score_visual;
  if (sort === 'laugh')    return clip.score_laugh;
  return clip.score_overall;
}

// ── format utils ──────────────────────────────────────────────────────────────
const _VIDEO_STATUS_DISPLAY = {
  pending: 'Not analyzed', probed: 'Inspected', labeled: 'Tracks assigned',
  extracting: 'Extracting', transcribing: 'Transcribing', transcribed: 'Transcribed',
  segmented: 'Clips generated', done: 'Analyzed', failed: 'Analysis interrupted',
};
function _fmtVideoStatus(s) { return _VIDEO_STATUS_DISPLAY[s] || s; }

function _msToHms(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return `${m}m ${String(sec).padStart(2, '0')}s`;
  const h = Math.floor(m / 60), min = m % 60;
  return `${h}h ${String(min).padStart(2, '0')}m`;
}

// m:ss (or h:mm:ss past an hour) clock for a millisecond timestamp. Clamps negative
// input to 0. Shared by the transcript line views and the clip export editor.
function fmtClock(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : (pluralForm || singular + 's')}`;
}

// Standard guard for any computed number shown to the user: returns *value*
// only when it is a finite number, otherwise a plain-English *fallback*. NaN
// or Infinity - usually from arithmetic on missing/partial data - must never
// reach the UI as the literal "NaN"/"Infinity". Use this (or fmtDuration) at
// every display site that formats a derived number.
function finiteOr(value, fallback = 'N/A') {
  return Number.isFinite(value) ? value : fallback;
}

// Human-readable clip/segment length. Returns *fallback* for a non-finite
// input (e.g. a clip missing its start/end times) rather than "NaN sec".
function fmtDuration(seconds, fallback = 'unknown') {
  if (!Number.isFinite(seconds)) return fallback;
  return seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds)} sec`;
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function formatApiError(err) {
  if (!err) return 'Unknown error';
  if (typeof err.detail === 'string') return err.detail;
  if (Array.isArray(err.detail)) return err.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
  if (err.message) return err.message;
  const stringified = JSON.stringify(err);
  return (!stringified || stringified === '{}') ? 'Unknown error (no details from server)' : stringified;
}

function stripRichMarkup(text) {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // ANSI escape codes
    .replace(/\[\/?\w+\]/g, '');             // Rich markup tags
}

// Server timestamps are naive UTC (SQLite DateTime → isoformat() with no zone).
// Treat a zone-less string as UTC so it isn't parsed as the viewer's local time.
function _parseServerDate(iso) {
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasZone ? iso : iso + 'Z');
}

function _fmtDate(iso) {
  if (!iso) return 'never';
  const d = _parseServerDate(iso);
  return d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ' at ' +
    d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
}

function _fmtAgo(isoString) {
  const diffS = (Date.now() - _parseServerDate(isoString).getTime()) / 1000;
  if (diffS < 60)    return 'just now';
  if (diffS < 3600)  return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return `${Math.floor(diffS / 86400)}d ago`;
}

function _fmtOffset(v) {
  if (!v) return '+0.0';
  return (v >= 0 ? '+' : '') + v.toFixed(1);
}

function _fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ── path-entry text boxes ─────────────────────────────────────────────────────
// Windows Explorer's "Copy as path" wraps the clipboard value in double quotes
// (e.g. `"D:\Videos\my-project"`), which fails path validation even though the
// unquoted path is valid. Strip one matching pair of leading/trailing quotes -
// same char on both ends - and leave an unbalanced quote alone rather than
// guessing at malformed input. Shared by every path-entry text box (Open
// Project, the Settings LLM model/vision/mmproj path fields, backup restore).
function stripQuotedPath(value) {
  if (typeof value !== 'string' || value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' || first === "'") && first === last) return value.slice(1, -1);
  return value;
}

// ── timeline interval ─────────────────────────────────────────────────────────
const _TIMELINE_MIN_INTERVAL_S = 10;

// Convert a timeline interval (value, unit) into seconds; null if non-numeric or
// below the minimum. Shared by the Settings save path and the per-video timeline
// generator so their validation can't drift apart.
function _parseIntervalS(value, unit) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return null;
  const seconds = unit === 'minutes' ? n * 60 : n;
  return seconds >= _TIMELINE_MIN_INTERVAL_S ? seconds : null;
}

export {
  AXIS_ICONS, _scoreIcon, _lerpColor, _scoreBorderColor, _sortScore, _fmtVideoStatus, _msToHms,
  fmtClock, plural, finiteOr, fmtDuration, truncate, escHtml, formatApiError, stripRichMarkup,
  _parseServerDate, _fmtDate, _fmtAgo, _fmtOffset, _fmtElapsed, _parseIntervalS, stripQuotedPath,
};
