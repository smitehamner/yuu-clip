import { AppState } from '../core/state.js';
import {
  AXIS_ICONS, escHtml, _scoreIcon, _scoreBorderColor, _sortScore, fmtDuration, plural, truncate,
  _fmtAgo, _fmtOffset, formatApiError,
} from '../core/format.js';
import {
  showToast, collapsibleCard, copyText, _syncSortDirBtn, openLog, appendLog,
} from '../core/utils.js';
import {
  showConfirm, showKebab, openActionsModal, openDiffModal, openFieldEditModal, showUndoToast,
} from '../core/ui.js';
import { PanelNav } from '../core/panelnav.js';
import {
  streamSSE, setJobCancel, _blockedByAnalyze, _openSSE, _setActiveStream, _clearActiveStream,
  _supersedeActiveStream, FRAMES_STEPS, SCORE_STEPS, applyJobBlockedState,
  startJobUI, updateJobUI, endJobUI, FIND_SIMILAR_STEPS,
} from '../core/jobs.js';
import { gateOnCapability } from '../settings/modelcatalog.js';
import { loadVideos, fetchClipsList } from '../videos/videos.js';
import { deferPlayerRebuildForPip } from '../core/preview.js';
import { exportPresetLabel } from '../library/exportpresets.js';
import { openSettings, _scrollToSettingsSection } from '../settings/settings.js';
import { openNewRecordingPanel } from '../analyze/analyze.js';
import { loadClipTranscript } from '../analyze/transcript.js';
import {
  rescoreClip, rescoreClipChoose, openRetranscribeModal,
} from '../library/contexts.js';
import { openClipCreatePicker } from './clipcreate.js';
import { openExportEditor } from '../library/exporteditor.js';
import {
  exportClip, _handleExportFormatAction, _downloadClipExport, _copyClipExportPaths, _revealClipExport,
} from './clipexport.js';
import { _pruneClipSelection, _updateBulkToolbar, _toggleClipSelection } from './clipbulk.js';

// ── clip list & filtering ─────────────────────────────────────────────────────────────────────
function _applyFilters() {
  const f = AppState.clipFilters;
  let result = AppState.clips;
  const kindFilter = AppState.clipKindFilter || 'all';
  if (kindFilter !== 'all') result = result.filter(c => c.kind === kindFilter);
  if (f && f.size) {
    const statuses = ['pending', 'approved', 'rejected'].filter(s => f.has(s));
    if (statuses.length) result = result.filter(c => statuses.includes(c.status));
    if (f.has('exported') && !f.has('not-exported')) result = result.filter(c => c.has_export);
    else if (f.has('not-exported') && !f.has('exported')) result = result.filter(c => !c.has_export);
    if (f.has('error')) result = result.filter(c => (c.tags || []).includes('llm_error'));
    if (f.has('flagged')) result = result.filter(c => (c.sensitive_matches || []).length > 0);
    if (f.has('duplicate')) result = result.filter(c => (c.tags || []).includes('possible_duplicate'));
    if (f.has('no_speech')) result = result.filter(c => (c.tags || []).includes('no_speech'));
  }
  if (AppState.clipScoreMin > 0) result = result.filter(c => c.score_overall >= AppState.clipScoreMin);
  if (AppState.clipSearch) {
    const q = AppState.clipSearch.toLowerCase();
    result = result.filter(c =>
      (c.description || '').toLowerCase().includes(q) ||
      (c.description_long || '').toLowerCase().includes(q) ||
      (c.transcript_excerpt || '').toLowerCase().includes(q) ||
      (c.user_tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  // Direction is applied client-side by reversing the server-sorted order; copy
  // first so we never mutate AppState.clips (result may still be that array).
  if ((AppState.clipSortDir || 'desc') === 'asc') result = [...result].reverse();
  return result;
}

function toggleClipSortDir() {
  AppState.clipSortDir = (AppState.clipSortDir === 'asc') ? 'desc' : 'asc';
  localStorage.setItem('clips-sort-dir', AppState.clipSortDir);
  _syncSortDirBtn('clips-sort-dir', AppState.clipSortDir);
  _renderClips();
}

// Canonical clip re-render entry point. Always routes through _applyFilters()
// so a re-render can't accidentally bypass the active search/status/score
// filters. Call this - never _renderClipItems directly - after mutating AppState.clips.
function _renderClips() {
  _pruneClipSelection();
  const shown = _applyFilters();
  _renderClipItems(shown);
  _renderClipStatsLine(shown);
  _renderClipFilterCounts();
}

// Per-status counts shown inline on the filter chips ("Unreviewed 30"). Counts
// reflect the whole selected recording, not the filtered/shown subset - see the
// stats line for that. Derived entirely from AppState.clips; blank when no
// recording is selected so the chips read as a plain filter bar.
function _renderClipFilterCounts() {
  // Badges live only on the clip filter chips (data-count is unique to them), so
  // query the document directly - the recordings filter row shares the
  // .clip-filter-tabs class but carries no counts.
  const setCount = (key, value) => {
    const badge = document.querySelector(`.clip-chip-count[data-count="${key}"]`);
    if (badge) badge.textContent = value == null ? '' : String(value);
  };
  const setKindCount = (key, value) => {
    const badge = document.querySelector(`.clip-chip-count[data-kcount="${key}"]`);
    if (badge) badge.textContent = value == null ? '' : String(value);
  };
  if (!AppState.activeVideoId || !AppState.clips.length) {
    for (const key of ['all', 'pending', 'approved', 'rejected', 'error', 'duplicate']) setCount(key, null);
    for (const key of ['all', 'clip', 'scene']) setKindCount(key, null);
    return;
  }
  const counts = computeClipFilterCounts(AppState.clips);
  setCount('all', counts.total);
  setCount('pending', counts.pending);
  setCount('approved', counts.approved);
  setCount('rejected', counts.rejected);
  setCount('error', counts.error || null);
  setCount('duplicate', counts.duplicate || null);
  setKindCount('all', counts.total);
  setKindCount('clip', counts.clipKind);
  setKindCount('scene', counts.sceneKind);
}

// Per-status / per-tag / per-kind tallies over the whole clip list (status counts,
// llm_error + possible_duplicate tag counts, clip vs scene kind). Pure; the renderer
// decides which zero counts blank out (error/duplicate) vs show as 0.
export function computeClipFilterCounts(clips) {
  const counts = {pending: 0, approved: 0, rejected: 0};
  let errorCount = 0;
  let duplicateCount = 0;
  let clipKindCount = 0;
  let sceneKindCount = 0;
  for (const c of clips) {
    counts[c.status] = (counts[c.status] || 0) + 1;
    if ((c.tags || []).includes('llm_error')) errorCount++;
    if ((c.tags || []).includes('possible_duplicate')) duplicateCount++;
    if (c.kind === 'scene') sceneKindCount++; else clipKindCount++;
  }
  return {
    total: clips.length,
    pending: counts.pending, approved: counts.approved, rejected: counts.rejected,
    error: errorCount, duplicate: duplicateCount,
    clipKind: clipKindCount, sceneKind: sceneKindCount,
  };
}

function _renderClipStatsLine(shown) {
  const el = document.getElementById('clip-stats-line');
  if (!el) return;
  if (!AppState.activeVideoId || !AppState.clips.length) {
    el.style.display = 'none';
    return;
  }
  const stats = computeClipStats(shown, AppState.clips);
  el.textContent = `${stats.shownCount} shown · ${stats.pending} unreviewed · ` +
    `${stats.approved} approved · ${stats.rejected} rejected · ${fmtDuration(stats.totalSeconds)} total`;
  el.style.display = '';
}

// Stats-line tallies: per-status counts over the whole list plus the summed duration
// (seconds) of the shown subset, guarding non-finite clip lengths to 0. Pure.
export function computeClipStats(shown, all) {
  const counts = {pending: 0, approved: 0, rejected: 0};
  for (const c of all) counts[c.status] = (counts[c.status] || 0) + 1;
  const totalSeconds = shown.reduce((sum, c) => {
    const len = (c.end_ms - c.start_ms) / 1000;
    return sum + (Number.isFinite(len) ? len : 0);
  }, 0);
  return {
    shownCount: shown.length,
    pending: counts.pending, approved: counts.approved, rejected: counts.rejected,
    totalSeconds,
  };
}

function _clearClipFilters() {
  AppState.clipFilters.clear();
  AppState.clipSearch = '';
  AppState.clipScoreMin = 0;
  AppState.clipKindFilter = 'all';
  _syncFilterChips();
  _syncKindChips();
  const searchEl = document.getElementById('clip-search-input');
  if (searchEl) searchEl.value = '';
  const scoreEl = document.getElementById('clip-score-min');
  if (scoreEl) scoreEl.value = '0';
  _renderClips();
  localStorage.setItem('clips-kind-filter', 'all');
}

// Reflect AppState.clipFilters onto the chip row. The "All" chip is active only
// when no other filter is selected.
function _syncFilterChips() {
  const f = AppState.clipFilters;
  document.querySelectorAll('[data-filter]').forEach(chip => {
    const token = chip.dataset.filter;
    const active = token === 'all' ? f.size === 0 : f.has(token);
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  _syncMoreFilters();
}

// Filters (and the min-score) that live inside the "More filters" expander.
const _HIDDEN_FILTER_TOKENS = ['exported', 'not-exported', 'error', 'flagged', 'duplicate', 'no_speech'];

// Force the expander open whenever one of the filters it hides is active (or a
// non-default min-score is set), so the user is never left wondering why the
// list is filtered. We only ever force it OPEN - on return to defaults we stop
// forcing it and let the user collapse it themselves.
function _syncMoreFilters() {
  const details = document.getElementById('clip-more-filters');
  if (!details) return;
  const active = _HIDDEN_FILTER_TOKENS.some(t => AppState.clipFilters.has(t)) ||
    AppState.clipScoreMin > 0;
  if (active) details.open = true;
  const flag = details.querySelector('[data-more-flag]');
  if (flag) flag.hidden = !active;
}

// Export (has-file) chips are mutually exclusive - "Exported" and "Not exported"
// can't both hold. Everything else toggles independently; "All" clears the set.
const _EXPORT_FILTER_TOKENS = ['exported', 'not-exported'];
function toggleClipFilter(token) {
  const f = AppState.clipFilters;
  if (token === 'all') {
    f.clear();
  } else if (f.has(token)) {
    f.delete(token);
  } else {
    if (_EXPORT_FILTER_TOKENS.includes(token)) _EXPORT_FILTER_TOKENS.forEach(t => f.delete(t));
    f.add(token);
  }
  _syncFilterChips();
  _renderClips();
}

// Candidate-type filter (All / Clips / Scenes). Both kinds are always fetched into
// AppState.clips (see _clipsListUrl); this is a purely client-side filter applied in
// _applyFilters, exactly like the status chips - no server reload, no re-fetch. The
// selection persists in localStorage. Defaults to All.
function setClipKindFilter(kind) {
  if (kind !== 'all' && kind !== 'clip' && kind !== 'scene') return;
  if ((AppState.clipKindFilter || 'all') === kind) return;
  AppState.clipKindFilter = kind;
  _syncKindChips();
  _renderClips();
  // Persist last so a storage failure (quota/private mode) can never block the
  // chip switch itself - same failure shape as the collapse-toggle fix in utils.js.
  localStorage.setItem('clips-kind-filter', kind);
}

function _syncKindChips() {
  const active = AppState.clipKindFilter || 'all';
  document.querySelectorAll('[data-kfilter]').forEach(chip => {
    const on = chip.dataset.kfilter === active;
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function setClipSearch(q) {
  AppState.clipSearch = q.trim();
  _renderClips();
}

function setClipScoreMin(val) {
  AppState.clipScoreMin = parseFloat(val) || 0;
  _syncMoreFilters();
  _renderClips();
}

// ≤3 distinct phrases show individually; more collapse to a single count pill so
// a heavily-matched clip doesn't crowd out the rest of the sidebar row.
function _hotwordPillsHTML(matches) {
  if (!matches || !matches.length) return '';
  if (matches.length <= 3) {
    return `<div class="tags" style="margin-top:4px">${matches.map(m =>
      `<span class="tag" title="${escHtml(m.phrase)}${m.count > 1 ? ` (${m.count}×)` : ''}">\u{1F525} ${escHtml(m.phrase)}</span>`
    ).join('')}</div>`;
  }
  return `<div class="tags" style="margin-top:4px"><span class="tag" title="${matches.length} hot-words matched">\u{1F525} ${matches.length}</span></div>`;
}

// Delegated on the persistent #clip-list element (its innerHTML is replaced each
// render, so per-row handlers would be lost - the container listener isn't). Wired
// unconditionally on every render so it also covers the empty-filter-message links.
function _handleClipListClick(e) {
  const act = e.target.closest('[data-act]');
  if (act) {
    e.preventDefault();
    if (act.dataset.act === 'open-settings') openSettings();
    else if (act.dataset.act === 'clear-clip-filters') _clearClipFilters();
    else if (act.dataset.act === 'open-new-recording-panel') openNewRecordingPanel();
    return;
  }
  const li = e.target.closest('li[data-clip-id]');
  if (li) selectClip(Number(li.dataset.clipId));
}

function _handleClipListKeydown(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const li = e.target.closest('li[data-clip-id]');
  if (!li || e.target !== li) return;  // don't hijack Space on the checkbox
  e.preventDefault();
  selectClip(Number(li.dataset.clipId));
}

function _renderClipItems(clips) {
  const list = document.getElementById('clip-list');
  list.innerHTML = '';
  list.onclick = _handleClipListClick;
  list.onkeydown = _handleClipListKeydown;
  if (!clips.length) {
    const _statusLabel = {pending: 'Unreviewed', approved: 'Approved', rejected: 'Rejected'};
    const kindFilter = AppState.clipKindFilter || 'all';
    const hasActiveFilter = AppState.clipFilters.size > 0 || AppState.clipSearch || AppState.clipScoreMin > 0;
    const isFlaggedOnly = AppState.clipFilters.size === 1 && AppState.clipFilters.has('flagged') &&
      !AppState.clipSearch && AppState.clipScoreMin === 0;
    const isKindOnly = kindFilter !== 'all' && !hasActiveFilter;
    const filterMsg = isFlaggedOnly
      ? `No flagged clips - add Sensitive Terms in <a href="#" style="color:var(--accent);text-decoration:underline" data-act="open-settings">Settings</a>`
      : isKindOnly
      ? `No ${kindFilter === 'scene' ? 'scenes' : 'clips'} in this recording - <a href="#" style="color:var(--accent);text-decoration:underline" data-act="clear-clip-filters">Show all</a>`
      : (hasActiveFilter || kindFilter !== 'all')
      ? `No clips match the current filters - <a href="#" style="color:var(--accent);text-decoration:underline" data-act="clear-clip-filters">Clear filters</a>`
      : `No clips found - <a href="#" style="color:var(--accent);text-decoration:underline" data-act="open-new-recording-panel">Analyze another recording</a>`;
    list.innerHTML = `<li style="padding:10px 14px;color:var(--muted)">${filterMsg}</li>`;
    _updateBulkToolbar();
    return;
  }
  for (const c of clips) {
    const li = document.createElement('li');
    li.className = c.id === AppState.activeClipId ? 'active' : '';
    li.style.borderLeftColor = _scoreBorderColor(_sortScore(c), c.status === 'rejected' || !c.scored_at);
    li.tabIndex = 0;
    li.dataset.clipId = c.id;
    li.innerHTML = `
      <div class="clip-item-row1">
        <input type="checkbox" class="clip-select-checkbox" aria-label="Select clip #${c.id}">
        <span class="clip-num" title="${c.kind === 'scene' ? 'Scene' : 'Clip'} #${c.id}">#${c.id}</span>
        <span class="clip-time">${c.start_hms} &middot; ${c.duration_hms}</span>
        ${c.kind === 'scene' ? '<span class="scene-badge" title="A longer scene (1-5 min contextual moment), not a short clip">SCENE</span>' : ''}
        ${c.has_export
          ? (c.export_stale
              ? `<span class="export-pill is-stale" title="Stale - re-export to update (${escHtml((c.export_stale_reasons || []).join(', '))})">Stale</span>`
              : `<span class="export-pill is-exported" title="Clip has been exported">${(() => {
                  const n = (c.exports || []).filter(e => e.exists).length;
                  return n > 1 ? `Exported &times;${n}` : 'Exported';
                })()}</span>`)
          : '<span class="export-pill not-exported" title="Not yet exported">Not exported</span>'}
        <span class="status-dot dot-${c.status}" title="${c.status === 'approved' ? 'Approved' : c.status === 'rejected' ? 'Rejected' : 'Unreviewed'}">${c.status === 'approved' ? '✓' : c.status === 'rejected' ? '✕' : ''}</span>
        ${(c.tags || []).includes('llm_error') && !!(window._prereqs || {}).llm_ok ? '<span class="clip-error-badge" title="LLM scoring failed - Re-score to retry">&#9888;</span>' : ''}
        ${(c.sensitive_matches || []).length ? '<span class="clip-flag-badge" title="Contains flagged terms">&#9888;</span>' : ''}
        ${(c.tags || []).includes('possible_duplicate') ? '<span class="clip-dup-badge" title="Overlaps another clip - possible duplicate">&#8646;</span>' : ''}
      </div>
      <div class="clip-scores" aria-label="${c.scored_at ? `Scores: overall ${Math.round(c.score_overall*100)}%, funny ${Math.round(c.score_funny*100)}%, dramatic ${Math.round(c.score_dramatic*100)}%, action ${Math.round(c.score_action*100)}%, visual ${Math.round((c.score_visual||0)*100)}%${c.score_laugh != null ? `, laughs ${Math.round(c.score_laugh*100)}%` : ''}` : 'Not yet scored'}">
        ${c.scored_at ? `
        <span aria-hidden="true" title="Overall">${_scoreIcon(c.score_overall)} ${Math.round(c.score_overall*100)}%</span>
        <span aria-hidden="true" title="Funny"><span>😂</span> ${Math.round(c.score_funny*100)}%</span>
        <span aria-hidden="true" title="Dramatic"><span>🎭</span> ${Math.round(c.score_dramatic*100)}%</span>
        <span aria-hidden="true" title="Action"><span>⚔️</span> ${Math.round(c.score_action*100)}%</span>
        <span aria-hidden="true" title="Visual"><span>🎬</span> ${Math.round((c.score_visual||0)*100)}%</span>
        ${c.score_laugh != null ? `<span aria-hidden="true" title="Laughs"><span>🤣</span> ${Math.round(c.score_laugh*100)}%</span>` : ''}
        ` : `<span style="color:var(--muted);font-size:12px" title="This clip has not been scored yet">Not yet scored</span>`}
      </div>
      ${c.description ? `<div class="clip-desc-preview" title="${escHtml(c.description)}">${escHtml(c.description)}</div>` : ''}
      ${_hotwordPillsHTML(c.hotword_matches)}`;
    const checkbox = li.querySelector('.clip-select-checkbox');
    checkbox.checked = AppState.selectedClipIds.has(c.id);
    checkbox.onclick = e => e.stopPropagation();
    checkbox.onchange = () => _toggleClipSelection(c.id, checkbox.checked);
    list.appendChild(li);
  }
  _updateBulkToolbar();
}

async function selectClip(id) {
  AppState.activeClipId = id;
  // Sync the sidebar highlight here so every caller - row click, arrow-key
  // navigation, related-clip links, post-retranscribe restore - moves it.
  document.querySelectorAll('#clip-list li[data-clip-id]').forEach(l =>
    l.classList.toggle('active', Number(l.dataset.clipId) === id));
  document.querySelector('#clip-list li.active')?.scrollIntoView({block: 'nearest'});
  localStorage.setItem('yuuclip-view', JSON.stringify({videoId: AppState.activeVideoId, clipId: id}));
  document.getElementById('detail').innerHTML = '<div class="detail-empty" style="color:var(--muted)">Loading…</div>';
  try {
    const [clipRes, mediaRes] = await Promise.all([
      fetch(`/api/clips/${id}`),
      fetch(`/api/clips/${id}/media_url`),
    ]);
    if (!clipRes.ok || !mediaRes.ok) throw new Error('Failed to load clip');
    const clip  = await clipRes.json();
    const media = await mediaRes.json();
    const captionsUrl = media.has_captions ? `/api/clips/${id}/captions.vtt` : null;
    AppState.activeClipData = clip;
    AppState.activeMediaFilename = media.filename;
    renderPlayer(media.url, captionsUrl, id);
    renderDetail(clip);
  } catch (err) {
    showToast(`Could not load clip: ${err.message}`, 'error');
  }
}

// Re-render the open clip's detail pane (excerpt, stale notice) without touching
// the player. Used after an inline caption edit changes the clip's transcript.
async function refreshClipDetail(id) {
  if (AppState.activeClipId !== id) return;
  try {
    const clip = await fetch(`/api/clips/${id}`).then(r => r.json());
    AppState.activeClipData = clip;
    renderDetail(clip);
  } catch (_) { /* leave the stale detail in place on error */ }
}

// ── player ────────────────────────────────────────────────────────────────────
function renderPlayer(url, captionsUrl, clipId) {
  // Leave a native PiP window alone: skip rebuilding #player-area (which would detach
  // its <video> and close PiP) and re-apply this selection once the user exits PiP.
  if (deferPlayerRebuildForPip(() => renderPlayer(url, captionsUrl, clipId))) return;
  const area = document.getElementById('player-area');
  const autoplay = localStorage.getItem('yuuclip-autoplay') === 'true';
  const loopClip = localStorage.getItem('yuuclip-loop-clip') === 'true';
  const playNext = localStorage.getItem('yuuclip-play-next') === 'true';
  if (url) {
    const track = captionsUrl
      ? `<track kind="captions" src="${escHtml(captionsUrl)}" label="Captions" default>`
      : '';
    area.innerHTML = `<video controls ${autoplay ? 'autoplay' : ''} ${loopClip ? 'loop' : ''} src="${escHtml(url)}" aria-label="Clip preview">${track}</video>`;
  } else {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    const vid = document.createElement('video');
    vid.controls = true;
    vid.autoplay = autoplay;
    vid.loop = loopClip;
    vid.src = `/api/clips/${clipId}/preview`;
    vid.setAttribute('aria-label', 'Clip source preview');
    vid.style.cssText = 'display:block;width:100%;max-height:var(--player-max-height, 42vh);object-fit:contain;background:#000';
    vid.onerror = async () => {
      const detail = await fetch(`/api/clips/${clipId}/preview`)
        .then(r => r.json()).then(j => j.detail || 'unavailable').catch(() => 'unavailable');
      wrap.innerHTML = `<div style="padding:24px;color:var(--muted);font-size:13px">Source video unavailable: ${escHtml(detail)}</div>`;
    };
    const badge = document.createElement('span');
    badge.style.cssText = 'position:absolute;top:8px;left:8px;background:rgba(0,0,0,.65);color:var(--muted);font-size:11px;padding:3px 8px;border-radius:4px;pointer-events:none';
    badge.textContent = 'Source preview · not exported';
    _markPreviewQuality(badge, clipId);
    wrap.appendChild(vid);
    wrap.appendChild(badge);
    area.innerHTML = '';
    area.appendChild(wrap);
  }
  if (playNext) area.querySelector('video')?.addEventListener('ended', _playNextClip);
}

// Advances to the next clip in the current filtered/sorted order - same shown
// list arrow-key navigation uses - and stops silently at the end of the list.
function _playNextClip() {
  const shown = _applyFilters();
  const idx = shown.findIndex(c => c.id === AppState.activeClipId);
  if (idx === -1 || idx >= shown.length - 1) return;
  const nextId = shown[idx + 1].id;
  selectClip(nextId);
  document.querySelector(`#clip-list li[data-clip-id="${nextId}"]`)?.focus();
}

// The clip preview route prefers the 720p proxy when one exists; reflect that on
// the badge so the creator knows the preview isn't full quality.
async function _markPreviewQuality(badge, clipId) {
  const videoId = AppState.activeClipData?.video_id;
  if (!videoId) return;
  try {
    const status = await fetch(`/api/videos/${videoId}/proxy-status`).then(r => r.ok ? r.json() : null);
    if (status?.available && AppState.activeClipId === clipId) {
      badge.textContent = 'Source preview · 720p · not exported';
      badge.title = 'Previewed from a downscaled 720p proxy for fast, reliable playback.';
    }
  } catch (_) { /* leave the default badge */ }
}

// Fully tear down any <video> in the player so the browser aborts its streaming
// connection to /media/exports/*. Until that connection closes, the server's
// StaticFiles handle on the file stays open and Windows refuses to delete it.
// Removing the element alone is not enough - the media resource must be released
// via pause + clear src + load() before the connection actually closes.
function _releasePlayerMedia() {
  const area = document.getElementById('player-area');
  area.querySelectorAll('video').forEach(vid => {
    try { vid.pause(); } catch (_) {}
    vid.removeAttribute('src');
    vid.load();
  });
  area.innerHTML = '';
}

// Call before any delete that removes a file the player may be streaming. Releases
// the <video>, then waits so the browser can finish aborting the transfer and the
// server can close its file handle before the delete request arrives.
async function _releasePlayerBeforeDelete() {
  _releasePlayerMedia();
  await new Promise(resolve => setTimeout(resolve, 400));
}

// ── detail ────────────────────────────────────────────────────────────────────
export function _fmtSizeMb(bytes) {
  if (bytes == null) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// One row per exported format (Export presets - Plan 07). Falls back to the
// legacy single-block display when a clip has has_export but no clip_exports
// rows yet (a project not backfilled, or a clip mutated directly in a test).
export function _exportFormatsHtml(clip) {
  if (!clip.has_export) return '';
  const rows = (clip.exports || []).filter(r => r.exists);
  if (!rows.length) {
    return `
      <div style="margin-top:8px;margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">Exported</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${clip.exported_container ? `<span>Container: <strong style="color:var(--text)">${escHtml(clip.exported_container.toUpperCase())}</strong></span>` : ''}
        <span>Captions: <strong style="color:var(--text)">${
          clip.subtitle_status === 'baked-in'    ? 'Baked in' :
          clip.subtitle_status === 'srt-sidecar' ? 'SRT sidecar' :
          'None'
        }</strong></span>
        ${clip.exported_at ? `<span>When: <strong style="color:var(--text)">${_fmtAgo(clip.exported_at)}</strong></span>` : ''}
      </div>
      ${clip.export_stale ? `<div class="transcript-stale-note" style="margin-top:8px">&#9888; Stale - re-export to update (${escHtml((clip.export_stale_reasons || []).join(', '))})</div>` : ''}`;
  }
  return `
    <div style="margin-top:8px;margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">Exported formats</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${rows.map(row => `
        <div class="export-format-row" data-clip-id="${clip.id}" data-export-id="${row.id}" data-preset-name="${escHtml(row.preset_name)}"
             data-filename="${escHtml(row.filename)}" data-burn-subs="${row.burn_subs ? '1' : ''}"
             data-embed-subs="${row.embed_subs ? '1' : ''}" data-title-card="${row.title_card ? '1' : ''}"
             style="border:1px solid var(--border);border-radius:6px;padding:8px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline">
            <strong style="color:var(--text)">${escHtml(exportPresetLabel(row.preset_name))}</strong>
            <span>${escHtml(row.container.toUpperCase())}</span>
            <span>${_fmtSizeMb(row.size_bytes)}</span>
            <span>${_fmtAgo(row.created_at)}</span>
          </div>
          ${row.export_stale ? `<div class="transcript-stale-note" style="margin-top:4px">&#9888; Stale - re-export to update (${escHtml((row.export_stale_reasons || []).join(', '))})</div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
            <button class="btn ghost" data-export-action="download">Download</button>
            ${AppState.canReveal ? `<button class="btn ghost" data-export-action="reveal">Show in folder</button>` : ''}
            <button class="btn ghost" data-export-action="copy-path">Copy path</button>
            <button class="btn ghost" data-export-action="regenerate">Regenerate</button>
            <button class="btn danger" data-export-action="delete">Delete</button>
          </div>
        </div>`).join('')}
    </div>
    <button class="btn-secondary" style="margin-top:8px" data-act="export-clip" data-clip-id="${clip.id}">+ Export another format</button>`;
}

// True when a clip's only one-liner is the transcript-derived template (tagged
// desc_basic), no language model is usable right now, and generative AI was not
// deliberately turned off. In that first-run state the template text (a few
// transcript words) reads as a broken description, so the description area shows a
// clear "set up a model" placeholder instead of quoting it. A user edit (which
// strips desc_basic anyway) is never hidden.
export function _descNeedsModel(clip) {
  return !!clip.tags && clip.tags.includes('desc_basic')
    && !clip.description_is_edited
    && !((window._prereqs || {}).llm_ok)
    && (window._aiPrivacyMode || 'local_only') !== 'none';
}

// The clip's one-liner area. In the no-model first-run state a desc_basic clip gets
// a call-to-action placeholder (see _descNeedsModel); otherwise the description (or
// an "not scored yet" hint) plus the basic-fallback labelling chip.
function _clipDescriptionHTML(clip) {
  if (_descNeedsModel(clip)) {
    return `<div class="needs-model-cta">
      <div class="needs-model-heading">AI descriptions need a local model</div>
      <div class="needs-model-detail">Baseline scoring already ran. Set up a local language model to add a written description for each clip.</div>
      <button class="btn ghost" style="font-size:11px;padding:3px 9px" data-act="open-llm-settings">Set up a local model</button>
    </div>`;
  }
  const body = clip.description
    ? `"${escHtml(clip.description)}"`
    : `<span style="color:var(--muted);font-size:13px">No description yet - Re-score to generate</span>`;
  return `<div class="description">${body}</div>${_basicDescChipHTML(clip)}`;
}

// A subtle nudge under a clip whose one-liner is the non-LLM template fallback
// (tagged desc_basic by the scoring engine). The message adapts to why no language
// model wrote the description. The no-model case is handled by _descNeedsModel /
// _clipDescriptionHTML instead, so this only covers "AI deliberately off" (the
// template is the intended output) and "model set up now, re-analyze to upgrade".
function _basicDescChipHTML(clip) {
  if (!clip.tags || !clip.tags.includes('desc_basic')) return '';
  const tip = 'This one-liner was built from the transcript without a language model';
  // Under "No generative AI" the user opted out of language models - show a neutral
  // note, never a setup nudge (Stage 07).
  if ((window._aiPrivacyMode || 'local_only') === 'none') {
    return `<div class="basic-desc-chip" title="${tip}">Basic description - generative AI is turned off</div>`;
  }
  // A language model is usable right now, so the clip is basic only because it was
  // scored before the model was available - re-analyzing upgrades it.
  return `<div class="basic-desc-chip" title="${tip}">Basic description - a language model is set up now; re-analyze this recording to add an AI description</div>`;
}

function renderDetail(clip) {
  const eb = (isEdited) => isEdited ? `<span class="edited-badge">edited</span>` : '';

  const trimExportHtml = `
    <div style="font-size:12px;color:var(--muted)">
      <div style="margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">Trim</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <span>Start <strong style="color:var(--text);font-family:monospace">${_fmtOffset(clip.start_offset)}</strong></span>
        <span>End <strong style="color:var(--text);font-family:monospace">${_fmtOffset(clip.end_offset)}</strong></span>
        <span style="font-size:11px">(edit in Export)</span>
      </div>
      ${_exportFormatsHtml(clip)}
    </div>`;

  const scoringActionsHtml = `
    <div class="detail-cards-row">
      <div class="detail-card">
        <div class="detail-card-header">
          <span class="detail-card-title">Scoring</span>
          ${clip.scored_at && clip.score_overall_user != null
            ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" data-act="clear-score-override" data-clip-id="${clip.id}" title="Remove manual score override">Remove Override</button>`
            : clip.scored_at
            ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" data-act="open-score-override" data-clip-id="${clip.id}">Override Score</button>`
            : ''}
        </div>
        <div class="scores">
          ${!clip.scored_at ? `<span style="color:var(--muted);font-size:13px">Not yet scored - Re-score to generate</span>` :
            clip.score_overall_user != null
            ? scoreRowOverride('Overall', clip.score_overall, clip.score_overall_user, 'overall')
            : scoreRow('Overall', clip.score_overall, 'overall')}
          ${clip.scored_at ? scoreRow('Funny',    clip.score_funny,    'funny')    : ''}
          ${clip.scored_at ? scoreRow('Dramatic', clip.score_dramatic, 'dramatic') : ''}
          ${clip.scored_at ? scoreRow('Action',   clip.score_action,   'action')   : ''}
          ${clip.scored_at ? scoreRow('Visual',   clip.score_visual || 0, 'visual') : ''}
          ${clip.scored_at && clip.score_laugh != null ? scoreRow('Laughs', clip.score_laugh, 'laugh') : ''}
        </div>
      </div>
      <div class="detail-card">
        <div class="detail-card-header"><span class="detail-card-title">Actions</span></div>
        <div class="clip-actions">
          <div class="review-actions">
            <button class="btn approve ${clip.status==='approved'?'active':''}" data-act="set-status" data-clip-id="${clip.id}" data-status="${clip.status==='approved'?'pending':'approved'}" title="Approve (press A)">Approve</button>
            <button class="btn reject  ${clip.status==='rejected'?'active':''}" data-act="set-status" data-clip-id="${clip.id}" data-status="${clip.status==='rejected'?'pending':'rejected'}" title="Reject (press R)">Reject</button>
            <button class="btn ${clip.status==='pending'?'active':''}" data-act="set-status" data-clip-id="${clip.id}" data-status="pending" title="Mark as Unreviewed (press U)">Unreviewed</button>
          </div>
          <div class="op-actions">
            <button class="btn highlight" data-act="export-clip" data-clip-id="${clip.id}">${clip.has_export ? 'Re-export' : 'Export'}</button>
            <button class="btn ghost" data-act="open-clip-actions-modal" data-clip-id="${clip.id}">Additional Actions</button>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('detail').innerHTML = `
    <div>
      <div class="detail-type-badge clip-badge" style="margin-bottom:8px">&#127902; ${clip.kind === 'scene' ? 'Scene' : 'Clip'} #${clip.id}</div>
      <div class="clip-header">
        <span class="time">${clip.start_hms} &middot; ${clip.duration_hms}</span>
      </div>
    </div>

    ${_duplicateNoticeHTML(clip)}

    ${scoringActionsHtml}

    ${collapsibleCard('clip-description',
        `<span class="detail-card-title">Description${eb(clip.description_is_edited)}</span>`, `
      ${_clipDescriptionHTML(clip)}

      ${clip.description_long ? `
        <hr class="detail-card-divider">
        <div class="detail-card-header">
          <span class="detail-card-title">Full Description${eb(clip.description_long_is_edited)}</span>
          <button class="kebab-btn" title="Edit or regenerate long description" aria-label="Edit or regenerate long description" data-act="open-desc-long-kebab" data-clip-id="${clip.id}">&#8942;</button>
        </div>
        <div class="description-long">${escHtml(clip.description_long)}</div>` : ''}

      <hr class="detail-card-divider">
      <div class="detail-card-header"><span class="detail-card-title">Tags</span></div>
      <div class="clip-tags" id="clip-user-tags">${_clipTagPillsHTML(clip.user_tags)}</div>
      <input list="clip-tags-datalist" id="clip-tag-input" class="tag-input"
             placeholder="Add a tag…" maxlength="40" autocomplete="off" aria-label="Add a tag">
      <datalist id="clip-tags-datalist"></datalist>
      ${_generatedTagPillsHTML(clip.tags)}`, {
      actions: `<div style="display:flex;gap:4px">
          ${clip.description && !_descNeedsModel(clip) ? `<button class="btn ghost" style="font-size:11px;padding:3px 9px" title="Copy description" aria-label="Copy description" data-copy="description">Copy</button>` : ''}
          <button class="kebab-btn" title="Edit or regenerate description" aria-label="Edit or regenerate description" data-act="open-desc-kebab" data-clip-id="${clip.id}">&#8942;</button>
        </div>`,
    })}

    ${_visionDetailHTML(clip)}
    ${_hotwordDetailHTML(clip)}
    ${_sensitiveDetailHTML(clip)}

    <div class="detail-card">
      <div class="detail-card-header">
        <span class="detail-card-title">Export</span>
        <button class="btn ghost" style="font-size:12px;padding:2px 10px" data-act="open-export-editor" data-clip-id="${clip.id}" title="Trim, frame vertical, preview captions, then export">Edit &amp; export</button>
      </div>
      ${trimExportHtml}
    </div>

    ${(clip.related_clips || _findingSimilarClipId === clip.id) ? collapsibleCard('clip-related',
          `<span class="detail-card-title">Related Clips</span>`, `
        ${_findingSimilarClipId === clip.id
          ? `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)"><span class="spinner" aria-hidden="true"></span> Searching for similar clips…</div>`
          : ((clip.related_clips && clip.related_clips.length) ? clip.related_clips.map(r => `
          <div style="display:flex;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--border)">
            <a href="#" style="color:var(--accent);text-decoration:none;font-size:13px;white-space:nowrap" data-act="select-related-clip" data-clip-id="${r.id}">#${r.id}</a>
            <span style="font-size:12px;color:var(--muted)">${escHtml(r.reason)}</span>
          </div>`).join('') : `<div style="font-size:12px;color:var(--muted)">No similar clips found</div>`)}`,
      { attrs: 'id="related-clips-section"', headerStyle: 'justify-content:flex-start;gap:8px',
        actions: `${clip.related_clips_stale ? `<span style="font-size:11px;color:var(--warning);font-style:italic">stale - re-score updated</span>` : ''}
          <span style="font-size:11px;color:var(--muted);margin-left:auto">${clip.related_clips_at ? _fmtAgo(clip.related_clips_at) : ''}</span>` }) : ''}

    ${_transcriptCardHTML(clip)}
  `;

  if (clip.transcript_excerpt) loadClipTranscript(clip.id);
  _renderTagDatalist();
  _loadTagSuggestions().then(_renderTagDatalist);
  const visionBtn = document.getElementById('analyze-frames-btn');
  if (visionBtn) {
    gateOnCapability(visionBtn, 'vision',
      'Frame analysis needs a vision-capable model.');
  }
  // A panel rebuilt while a job runs must come up with its heavy buttons disabled.
  applyJobBlockedState();
}

// A clip with no transcript excerpt (video-heavy-analysis Stage 03 - a silent,
// visually active moment, or simply a clip with no captions) still needs a legible
// Transcript card rather than the section disappearing. Shows the Visual score and
// the no_speech tag inline, plus the vision-LLM one-liner if "Analyze frames" (below)
// already produced one. A clip WITH a transcript is unaffected - the excerpt always wins.
function _transcriptCardHTML(clip) {
  if (clip.transcript_excerpt) {
    return collapsibleCard('clip-transcript',
        `<span class="detail-card-title">Transcript</span>`, `
      ${clip.transcript_stale ? `<div class="transcript-stale-note">&#9888; Captions edited since last scoring - <button class="btn ghost" style="font-size:11px;padding:2px 8px" data-act="rescore-clip" data-clip-id="${clip.id}">Re-score</button> to refresh.</div>` : ''}
      <div id="clip-transcript-view" class="transcript">${escHtml(clip.transcript_excerpt)}</div>`,
      { actions: `<button class="btn ghost" style="font-size:11px;padding:3px 9px" title="Copy transcript" aria-label="Copy transcript" data-copy="transcript">Copy</button>` });
  }
  const isNoSpeech = (clip.tags || []).includes('no_speech');
  const visualPct = Math.round((clip.score_visual || 0) * 100);
  return collapsibleCard('clip-transcript',
      `<span class="detail-card-title">Transcript</span>`, `
    <div style="color:var(--muted);font-size:13px">No dialogue in this clip</div>
    <div class="tags" style="margin-top:8px">
      ${clip.scored_at ? `<span class="tag" title="How visually active this clip is">&#127916; Visual ${visualPct}%</span>` : ''}
      ${isNoSpeech ? `<span class="tag" title="No spoken dialogue was detected in this clip">No dialogue</span>` : ''}
    </div>
    ${clip.vision_summary ? `<div class="description-long" style="margin-top:8px">${escHtml(clip.vision_summary)}</div>` : ''}`);
}

// ── image-based clip analysis (What's on screen) ─────────────────────────────
function _visionSpinnerButton() {
  return `<button class="btn ghost" id="analyze-frames-btn" style="font-size:12px;padding:3px 10px" disabled>`
    + `<span class="spinner" style="display:inline-block;vertical-align:middle;width:11px;height:11px"></span> `
    + `Analyzing frames...</button>`;
}

function _visionDetailHTML(clip) {
  // Master switch (Settings → Image analysis). On by default; the button itself is
  // still gated on a vision-capable model being configured (gateOnCapability above).
  // window._visionEnabled is seeded at boot and on settings save.
  if (!window._visionEnabled) return '';
  const summary = clip.vision_summary;
  const btnLabel = summary ? 'Re-analyze frames' : 'Analyze frames';
  const body = summary
    ? `<div class="description-long">${escHtml(summary)}</div>
       <div style="font-size:11px;color:var(--muted);margin-top:4px">Analyzed ${_fmtAgo(clip.vision_analyzed_at)}</div>`
    : `<div style="color:var(--muted);font-size:13px">Sample frames from this clip and describe what's on screen - it enriches the description and gives scoring visual context.</div>`;
  // If an analyze-frames job for THIS clip is in flight, render the spinner from
  // AppState.clipJobs (not a captured DOM node) so the indicator survives a
  // renderDetail rebuild or a clip switch-away-and-back. Otherwise the normal
  // button, tagged data-job-blocked so it disables while some OTHER job runs.
  const inFlight = AppState.clipJobs[clip.id] && AppState.clipJobs[clip.id].op === 'analyze-frames';
  const buttonHtml = inFlight
    ? _visionSpinnerButton()
    : `<button class="btn ghost" id="analyze-frames-btn" data-job-blocked style="font-size:12px;padding:3px 10px"
                data-act="analyze-frames" data-clip-id="${clip.id}">${btnLabel}</button>`;
  return collapsibleCard('clip-vision',
    `<span class="detail-card-title">What's on screen</span>`, `
      ${body}
      <div style="margin-top:8px">${buttonHtml}</div>`);
}

// Optimistic immediate repaint of the button on start; durable in-flight state
// lives in AppState.clipJobs so any later rebuild renders correctly via _visionDetailHTML.
function _paintVisionInFlight(clipId) {
  if (AppState.activeClipId !== clipId || PanelNav.isOpen()) return;
  const btn = document.getElementById('analyze-frames-btn');
  if (btn) btn.outerHTML = _visionSpinnerButton();
}

// Terminal cleanup shared by the done, error, and cancel paths: drop the in-flight
// flag (so the button leaves its spinner) and repaint from the cached clip if it is
// still the one on screen. Without this the flag would leak on an error/cancel and
// strand the button as a permanent disabled spinner until a page reload.
function _finishVisionJob(clipId) {
  delete AppState.clipJobs[clipId];
  const data = AppState.activeClipData;
  if (data && AppState.activeClipId === clipId && !PanelNav.isOpen()) renderDetail(data);
}

function analyzeFrames(clipId) {
  if (_blockedByAnalyze('analyze frames')) return;
  AppState.clipJobs[clipId] = {op: 'analyze-frames'};
  _paintVisionInFlight(clipId);
  streamSSE(
    `/api/clips/${clipId}/analyze-frames`,
    async () => {
      delete AppState.clipJobs[clipId];
      let clip = null;
      try { clip = await fetch(`/api/clips/${clipId}`).then(r => r.ok ? r.json() : null); } catch (_) {}
      // Only touch the panel if this clip is still the one on screen and a PanelNav
      // flow isn't covering it - otherwise the result must not land in another clip's
      // view. A later return to this clip re-fetches it fresh via selectClip. Rebuild
      // from the freshest data (the fetched clip, else the cached copy) so the button
      // returns from spinner to normal now that clipJobs no longer flags this clip.
      if (clip && AppState.activeClipId === clipId) AppState.activeClipData = clip;
      const data = clip || AppState.activeClipData;
      if (data && AppState.activeClipId === clipId && !PanelNav.isOpen()) renderDetail(data);
    },
    FRAMES_STEPS, 'Analyzing frames...',
    // Cancellable: the job runs as a subprocess (pipeline/frame_analysis.py), so
    // killing it via the cancel endpoint drops the llama-server connection and
    // generation actually stops - the point of it, for a big model on many frames.
    true,
    // The subprocess reports its own handled failures as bracketed status lines and
    // then exits cleanly (no transport error, so streamSSE's error toast never fires).
    // Surface them as a toast, otherwise a failed analysis is only visible in the log.
    line => { if (typeof line === 'string' && line.startsWith('[')) showToast(line.replace(/^\[|\]$/g, ''), 'error'); },
    false, {method: 'POST'},
    () => _finishVisionJob(clipId),  // onError: clear the in-flight flag so the button recovers
  );
  // startJobUI (inside streamSSE) reset the shared cancel config to the analyze
  // default; override it so the header Cancel confirms + POSTs for THIS job.
  setJobCancel({
    url: `/api/clips/${clipId}/analyze-frames/cancel`,
    title: 'Stop image analysis?',
    body: 'The work so far is discarded. You can run image analysis again anytime.',
    confirm: 'Stop analysis',
    logMsg: '[Image analysis cancelled]',
    onCancel: () => _finishVisionJob(clipId),
  });
}

// ── hot-words ────────────────────────────────────────────────────────────────
const _HOTWORD_MODE_LABELS = {exact: 'Exact', case_insensitive: 'Ignore case', semantic: 'Meaning'};

function _hotwordDetailHTML(clip) {
  const matches = clip.hotword_matches;
  if (!matches || !matches.length) return '';
  const boost = clip.hotword_boost || {};
  const boostLine = Object.entries(boost)
    .filter(([, v]) => v)
    .map(([target, v]) => `${target}: ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`)
    .join(', ');
  return `
    <div class="detail-card">
      <div class="detail-card-header"><span class="detail-card-title">Hot-words</span></div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:12px">
        ${matches.map(m => `
          <div>
            <strong>${escHtml(m.phrase)}</strong>
            <span style="color:var(--muted)"> - ${escHtml(_HOTWORD_MODE_LABELS[m.mode] || m.mode)}${m.count > 1 ? `, ${m.count}×` : ''}</span>
          </div>`).join('')}
        ${boostLine ? `<div style="color:var(--muted);font-size:11px;margin-top:2px">Boost applied: ${escHtml(boostLine)}</div>` : ''}
      </div>
    </div>`;
}

// ── sensitive content (Privacy Terms / Censor Words) ────────────────────────
const _SENSITIVE_CATEGORY_LABELS = {privacy: 'Privacy Term', censor: 'Censor Word'};
const _SENSITIVE_MODE_LABELS = {exact: 'Exact', case_insensitive: 'Ignore case', fuzzy: 'Close spelling'};

function _sensitiveDetailHTML(clip) {
  const matches = clip.sensitive_matches;
  if (!matches || !matches.length) return '';
  return `
    <div class="detail-card">
      <div class="detail-card-header"><span class="detail-card-title">Flagged terms</span></div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:12px">
        ${matches.map(m => `
          <div>
            <span class="sensitive-category sensitive-category-${m.category}">${escHtml(_SENSITIVE_CATEGORY_LABELS[m.category] || m.category)}</span>
            <strong>${escHtml(m.matched_text)}</strong>
            <span style="color:var(--muted)"> - ${escHtml(_SENSITIVE_MODE_LABELS[m.mode] || m.mode)}${m.count > 1 ? `, ${m.count}×` : ''}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── generated tags ──────────────────────────────────────────────────────────
// Pipeline tags (clip.tags) are internal tokens; map them to display names
// before rendering. null = bookkeeping marker, hidden from the UI (the Scoring
// card and "Last scored with" already convey that a scorer ran).
const _GENERATED_TAG_INFO = {
  manual:              { name: 'Manually created', tip: 'You created this clip by hand, not automatic clip generation' },
  llm_error:           { name: 'Score error', tip: 'LLM scoring failed for this clip - Re-score to retry' },
  llm_no_transcript:   { name: 'No speech to score', tip: "No transcript text in this clip's time range, so LLM scoring was skipped" },
  energy_no_tracks:    { name: 'No audio data', tip: 'No audio track was available for energy scoring' },
  energy_no_data:      { name: 'No audio data', tip: "The audio track had no data in this clip's time range" },
  after_hard_split:    { name: 'After split', tip: 'This clip starts right after a split point' },
  long_silence_before: { name: 'Long pause before', tip: 'A long quiet stretch comes right before this clip' },
  no_speech:           { name: 'No dialogue', tip: 'No spoken dialogue was detected in this clip' },
  visual:              { name: 'Visual highlight', tip: 'A silent, visually active moment found without any dialogue' },
  llm_scored: null, energy_scored: null, scenes_scored: null,
  laugh_transcript: null, laugh_audio: null, laugh_model: null,
  laugh_no_transcript: null, laugh_no_wav: null,
};

function _generatedTagPillsHTML(tags) {
  const pills = (tags || []).map(token => {
    if (_GENERATED_TAG_INFO[token] === null) return '';
    let info = _GENERATED_TAG_INFO[token];
    const silence = /^after_silence_(\d+)s$/.exec(token);
    if (silence) info = { name: `After ${silence[1]} s silence`, tip: `This clip starts after about ${silence[1]} seconds of silence` };
    if (!info) info = { name: token.replace(/_/g, ' '), tip: 'Detected during analysis' };
    return `<span class="tag" title="${escHtml(info.tip)}">${escHtml(info.name)}</span>`;
  }).filter(Boolean);
  return pills.length ? `<div class="tags" style="margin-top:8px">${pills.join('')}</div>` : '';
}

// ── user tags ───────────────────────────────────────────────────────────────
// Tag values can contain quotes/spaces, so the remove buttons use data-* +
// event delegation (see the #detail listener below), never inline onclick.
function _clipTagPillsHTML(tags) {
  if (!tags || !tags.length) return '<span class="tags-empty">No tags yet</span>';
  return tags.map(t =>
    `<span class="user-tag">${escHtml(t)}<button class="user-tag-x" data-remove-tag="${escHtml(t)}"
       title="Remove tag" aria-label="Remove tag ${escHtml(t)}">&times;</button></span>`
  ).join('');
}

async function _loadTagSuggestions() {
  try {
    const data = await fetch('/api/tags').then(r => r.json());
    AppState.allTags = Array.isArray(data.tags) ? data.tags : [];
  } catch (_) { AppState.allTags = AppState.allTags || []; }
}

function _renderTagDatalist() {
  const dl = document.getElementById('clip-tags-datalist');
  if (!dl) return;
  dl.innerHTML = (AppState.allTags || []).map(t => `<option value="${escHtml(t)}">`).join('');
}

async function _saveClipTags(clipId, tags) {
  const res = await fetch(`/api/clips/${clipId}/tags`, {
    method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({tags}),
  });
  if (!res.ok) { showToast('Could not save tags', 'error'); return null; }
  const data = await res.json();
  if (AppState.activeClipData && AppState.activeClipData.id === clipId) {
    AppState.activeClipData.user_tags = data.user_tags;
  }
  await _loadTagSuggestions();
  _renderTagDatalist();
  return data.user_tags;
}

function _currentClipTags() {
  return (AppState.activeClipData && AppState.activeClipData.user_tags) || [];
}

async function _addClipTag(clipId, raw) {
  const tag = (raw || '').trim();
  if (!tag) return;
  const cur = _currentClipTags();
  if (cur.some(t => t.toLowerCase() === tag.toLowerCase())) return;  // dedupe client-side
  const updated = await _saveClipTags(clipId, [...cur, tag]);
  if (updated) _rerenderClipTags(updated);
}

async function _removeClipTag(clipId, tag) {
  const updated = await _saveClipTags(clipId, _currentClipTags().filter(t => t !== tag));
  if (updated) _rerenderClipTags(updated);
}

function _rerenderClipTags(tags) {
  const el = document.getElementById('clip-user-tags');
  if (el) el.innerHTML = _clipTagPillsHTML(tags);
}

// Event delegation on the persistent #detail element (its innerHTML is replaced
// each render, so per-row handlers would be lost - the container listener isn't).
// Wired once at module load, same as videos.js's own #detail listener - both
// coexist since they react to disjoint data-act/data-* namespaces.
function _handleDetailClick(e) {
  const merge = e.target.closest('[data-merge-b]');
  if (merge) {
    mergeClips(Number(merge.dataset.mergeA), Number(merge.dataset.mergeB), merge.dataset.mergeDir);
    return;
  }
  const rm = e.target.closest('[data-remove-tag]');
  if (rm && AppState.activeClipId) { _removeClipTag(AppState.activeClipId, rm.dataset.removeTag); return; }
  const copy = e.target.closest('[data-copy]');
  if (copy && AppState.activeClipData) {
    if (copy.dataset.copy === 'description') copyText(AppState.activeClipData.description, 'Description');
    else if (copy.dataset.copy === 'transcript') copyText(AppState.activeClipData.transcript_excerpt, 'Transcript');
    return;
  }
  const formatBtn = e.target.closest('[data-export-action]');
  if (formatBtn) {
    const row = formatBtn.closest('.export-format-row');
    if (row) _handleExportFormatAction(formatBtn.dataset.exportAction, row.dataset);
    return;
  }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const clipId = Number(act.dataset.clipId);
  switch (act.dataset.act) {
    case 'export-clip': exportClip(clipId); break;
    case 'open-llm-settings':
      openSettings();
      setTimeout(() => _scrollToSettingsSection('settings-sec-llm'), 120);
      break;
    case 'clear-score-override': clearScoreOverride(clipId); break;
    case 'open-score-override': openScoreOverride(clipId); break;
    case 'set-status': setStatus(clipId, act.dataset.status); break;
    case 'open-clip-actions-modal': openClipActionsModal(clipId); break;
    case 'open-desc-long-kebab': openDescLongKebab(clipId, act); break;
    case 'open-desc-kebab': openDescKebab(clipId, act); break;
    case 'open-export-editor': openExportEditor(clipId); break;
    case 'select-related-clip': e.preventDefault(); selectClip(clipId); break;
    case 'rescore-clip': rescoreClip(clipId); break;
    case 'analyze-frames': analyzeFrames(clipId); break;
  }
}

function _handleDetailKeydown(e) {
  const input = e.target.closest('#clip-tag-input');
  if (!input) return;
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    if (AppState.activeClipId) _addClipTag(AppState.activeClipId, value);
  }
}

function scoreRow(label, val, cls) {
  const icon = AXIS_ICONS[cls] || '';
  return `
    <span class="score-label">${icon ? icon + ' ' : ''}${label}</span>
    <div class="score-bar-wrap"><div class="score-bar bar-${cls}" style="width:${(val*100).toFixed(1)}%"></div></div>
    <span class="score-val" style="color:var(--${cls})">${Math.round(val*100)}%</span>`;
}

function scoreRowOverride(label, llmVal, userVal, cls) {
  const icon = AXIS_ICONS[cls] || '';
  return `
    <span class="score-label">${icon ? icon + ' ' : ''}${label} <span class="score-override-badge">override</span></span>
    <div class="score-bar-wrap">
      <div class="score-bar bar-${cls}" style="width:${(userVal*100).toFixed(1)}%;opacity:.5"></div>
    </div>
    <span class="score-val" style="color:var(--${cls})">${Math.round(userVal*100)}% <span style="color:var(--muted);font-size:10px">(LLM: ${Math.round(llmVal*100)}%)</span></span>`;
}

function _mergeNeighbors(clip) {
  const byTime = [...AppState.clips].sort((a, b) => a.start_ms - b.start_ms);
  const idx = byTime.findIndex(c => c.id === clip.id);
  return {
    prev: idx > 0 ? byTime[idx - 1] : null,
    next: idx >= 0 && idx < byTime.length - 1 ? byTime[idx + 1] : null,
  };
}

function openClipActionsModal(clipId) {
  const clip = AppState.activeClipData?.id === clipId ? AppState.activeClipData : AppState.clips.find(c => c.id === clipId);
  if (!clip) return;
  const { prev, next } = _mergeNeighbors(clip);

  const groups = [];

  const scoringRows = [
    { label: 'Re-score', description: 'Re-run scoring and description generation for this clip.', action: () => rescoreClipChoose(clipId) },
  ];
  if (clip.score_overall_user != null) {
    scoringRows.push({ label: 'Remove Override', description: 'Discard the manual score and go back to the generated score.', action: () => clearScoreOverride(clipId) });
  } else {
    scoringRows.push({ label: 'Override Score', description: 'Manually set the overall score instead of using the generated score.', action: () => openScoreOverride(clipId) });
  }
  groups.push({ heading: 'Scoring', rows: scoringRows });

  groups.push({ heading: 'Transcript', rows: [
    { label: 'Retranscribe', description: "Re-run transcription for just this clip's time range.", action: () => openRetranscribeModal(clipId) },
  ]});

  if (clip.description_long || clip.description) {
    groups.push({ heading: 'Discover', rows: [
      { label: 'Find Similar', description: 'Search other recordings for clips with a similar description.', action: () => openSimilarClipsModal(clipId) },
    ]});
  }

  if (clip.has_export) {
    const multiFormat = (clip.exports || []).filter(e => e.exists).length > 1;
    const fileRows = [];
    if (AppState.activeMediaFilename) {
      fileRows.push({ label: 'Download Export', description: `Save ${multiFormat ? 'every exported format' : 'the exported file'} (and any caption sidecars) to your downloads.`, action: () => _downloadClipExport(clipId) });
    }
    fileRows.push({ label: 'Copy File Path(s)', description: `Copy the full path of ${multiFormat ? 'every exported format' : 'the exported file'} (and any caption sidecars) to your clipboard.`, action: () => _copyClipExportPaths(clipId) });
    if (AppState.canReveal) {
      fileRows.push({ label: 'Show in Folder', description: 'Open the exports folder with this file selected.', action: () => _revealClipExport(clipId) });
    }
    fileRows.push({ label: 'Delete All Exports', description: `Delete ${multiFormat ? 'every exported format' : 'the exported video file'} but keep the clip record. Use the Export section to delete one format at a time.`, danger: true, action: () => deleteExport(clipId) });
    groups.push({ heading: 'Files', rows: fileRows });
  }

  if (prev || next) {
    const mergeRows = [];
    const mergeDesc = (neighbor) => truncate(neighbor.description || 'no description yet', 60);
    if (prev) mergeRows.push({ label: '← Merge previous', description: `Combine with clip #${prev.id} ("${mergeDesc(prev)}"), which starts at ${prev.start_hms}.`, action: () => mergeClips(clipId, prev.id, 'prev') });
    if (next) mergeRows.push({ label: 'Merge next →', description: `Combine with clip #${next.id} ("${mergeDesc(next)}"), which starts at ${next.start_hms}.`, action: () => mergeClips(clipId, next.id, 'next') });
    groups.push({ heading: 'Merge', rows: mergeRows });
  }

  groups.push({ heading: 'Danger Zone', rows: [
    { label: 'Delete Clip', description: 'Permanently remove this clip record and its exported file.', danger: true, action: () => deleteClip(clipId) },
  ]});

  openActionsModal(`Clip #${clip.id} - Additional Actions`, groups);
}

async function _reloadClipList(videoId) {
  if (!videoId) return;
  const clips = await fetchClipsList(videoId);
  if (clips) { AppState.clips = clips; _renderClips(); }
}

function _replaceClipInList(updated) {
  const idx = AppState.clips.findIndex(c => c.id === updated.id);
  if (idx !== -1) AppState.clips[idx] = updated;
}

// ── score override & merge ───────────────────────────────────────────────────
let _scoreOverrideClipId = null;
let _scoreOverrideOpener = null;

function openScoreOverride(clipId) {
  _scoreOverrideOpener = document.activeElement;
  const clip = AppState.clips.find(c => c.id === clipId);
  const current = clip?.score_overall ?? 0.5;
  _scoreOverrideClipId = clipId;
  const slider = document.getElementById('score-override-slider');
  slider.value = current;
  document.getElementById('score-override-display').textContent = Math.round(current*100) + '%';
  document.getElementById('score-override-llm-note').textContent = `Current auto score: ${Math.round(current*100)}%`;
  document.getElementById('score-override-modal').classList.add('visible');
  setTimeout(() => document.getElementById('score-override-slider')?.focus(), 50);
}

function closeScoreOverrideModal() {
  document.getElementById('score-override-modal').classList.remove('visible');
  _scoreOverrideClipId = null;
  const opener = _scoreOverrideOpener;
  _scoreOverrideOpener = null;
  if (opener?.focus) opener.focus();
}

async function _scoreOverrideSave() {
  const clipId = _scoreOverrideClipId;
  const num = parseFloat(document.getElementById('score-override-slider').value);
  closeScoreOverrideModal();
  const res = await fetch(`/api/clips/${clipId}/score-override`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({score_overall_user: num}),
  });
  if (!res.ok) { showToast('Failed to set score override', 'error'); return; }
  const updated = await res.json();
  _replaceClipInList(updated);
  renderDetail(updated);
}

async function clearScoreOverride(clipId) {
  const res = await fetch(`/api/clips/${clipId}/score-override`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({score_overall_user: null}),
  });
  if (!res.ok) { showToast('Failed to clear override', 'error'); return; }
  const updated = await res.json();
  _replaceClipInList(updated);
  renderDetail(updated);
}

async function mergeClips(clipAId, clipBId, direction) {
  const label = direction === 'prev' ? 'previous' : 'next';
  showConfirm(
    'Merge clips?',
    `Merge this clip with the ${label} clip? The merged clip will span both time ranges. This cannot be undone.`,
    'Merge',
    () => _doMergeClips(clipAId, clipBId),
    true,
  );
}

async function _doMergeClips(clipAId, clipBId) {
  const res = await fetch(`/api/clips/${clipAId}/merge`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip_b_id: clipBId}),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); showToast(e.detail || 'Merge failed', 'error'); return; }
  const updated = await res.json();
  AppState.clips = AppState.clips.filter(c => c.id !== clipBId);
  _replaceClipInList(updated);
  AppState.activeClipId = clipAId;
  _renderClips();
  renderDetail(updated);
  showToast('Clips merged');
}

// Mirrors DEFAULT_OVERLAP_THRESHOLD in scoring/dedup.py. The durable flag/badge
// comes from a server scan (the 'possible_duplicate' tag); this recomputes the
// specific overlapping partner client-side so the detail panel can name it and
// offer a one-click merge without depending on the last scan's response.
const _DUP_OVERLAP_THRESHOLD = 0.7;

function _duplicatePartners(clip) {
  return AppState.clips
    .filter(other => other.id !== clip.id && other.status !== 'rejected')
    .map(other => {
      const overlapMs = Math.max(0, Math.min(clip.end_ms, other.end_ms) - Math.max(clip.start_ms, other.start_ms));
      const shorterMs = Math.min(clip.end_ms - clip.start_ms, other.end_ms - other.start_ms);
      return {clip: other, ratio: shorterMs > 0 ? overlapMs / shorterMs : 0};
    })
    .filter(partner => partner.ratio >= _DUP_OVERLAP_THRESHOLD)
    .sort((a, b) => b.ratio - a.ratio);
}

function _duplicateNoticeHTML(clip) {
  if (!(clip.tags || []).includes('possible_duplicate')) return '';
  const partners = _duplicatePartners(clip);
  if (!partners.length) return '';
  const buttons = partners.map(partner => {
    const direction = partner.clip.start_ms < clip.start_ms ? 'prev' : 'next';
    return `<button class="btn" style="font-size:11px;padding:3px 9px" data-merge-a="${clip.id}" data-merge-b="${partner.clip.id}" data-merge-dir="${direction}">Merge #${partner.clip.id} &middot; ${partner.clip.start_hms}</button>`;
  }).join('');
  const ids = partners.map(partner => '#' + partner.clip.id).join(', ');
  return `<div class="clip-dup-notice" role="note">
    <div>&#8646; Possible duplicate - overlaps ${partners.length === 1 ? 'clip' : 'clips'} ${ids}. Merge to combine into this clip.</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${buttons}</div>
  </div>`;
}

async function scanDuplicates(busyBtn) {
  const videoId = AppState.activeVideoId;
  if (!videoId) return;
  const btn = busyBtn || document.getElementById('btn-scan-duplicates');
  const origLabel = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }
  try {
    const res = await fetch(`/api/videos/${videoId}/scan-duplicates`, {method: 'POST'});
    if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e.detail || 'Duplicate scan failed', 'error'); return; }
    const body = await res.json();
    await _reloadClipList(videoId);
    if (AppState.activeClipId) refreshClipDetail(AppState.activeClipId);
    showToast(body.clips_flagged
      ? `Found ${body.clips_flagged} possible duplicate ${body.clips_flagged === 1 ? 'clip' : 'clips'}`
      : 'No duplicate clips found');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origLabel; }
  }
}

function openClipsActionsMenu(btn) {
  // With both kinds merged, the create entry follows the active kind filter:
  // the Scenes view offers "New scene", the Clips view "New clip". The default
  // All view can't infer intent, so it offers both (otherwise scene creation is
  // undiscoverable without first clicking the Scenes chip).
  const filter = AppState.clipKindFilter;
  const createItems = filter === 'scene'
    ? [{ label: 'New scene', action: () => openClipCreatePicker(AppState.activeVideoId, 'scene') }]
    : filter === 'clip'
    ? [{ label: 'New clip', action: () => openClipCreatePicker(AppState.activeVideoId, 'clip') }]
    : [
        { label: 'New clip',  action: () => openClipCreatePicker(AppState.activeVideoId, 'clip') },
        { label: 'New scene', action: () => openClipCreatePicker(AppState.activeVideoId, 'scene') },
      ];
  showKebab(btn, [
    ...createItems,
    { label: 'Check duplicates', action: () => scanDuplicates(btn) },
  ]);
}

function _parseTimingOffset(str) {
  if (!str) return 0.0;
  const s = str.trim();
  if (/^[+-]/.test(s)) return parseFloat(s);
  if (/^\d+:\d+(\.\d+)?$/.test(s)) {
    const [m, sec] = s.split(':');
    const absSec = parseInt(m) * 60 + parseFloat(sec);
    const clipStartSec = AppState.activeClipData?.start_ms ? AppState.activeClipData.start_ms / 1000 : 0;
    return absSec - clipStartSec;
  }
  return parseFloat(s);
}

// ── description edit ─────────────────────────────────────────────────────────
function _openClipDescKebab(clipId, btn, field) {
  const clip    = AppState.activeClipData;
  const isLong  = field === 'description_long';
  const editTitle   = isLong ? 'Edit Long Description'   : 'Edit Description';
  const revertTitle = isLong ? 'Revert Long Description' : 'Revert Description';
  const current  = isLong ? clip?.description_long          : clip?.description;
  const isEdited = isLong ? clip?.description_long_is_edited : clip?.description_is_edited;
  const original = isLong ? clip?.description_long_original  : clip?.description_original;

  const items = [
    { label: 'Edit', action: () =>
      openFieldEditModal(editTitle, current || '', async v => {
        await _patchClipField(clipId, 'accept_edit', field,
          isLong ? null : v, isLong ? v : null);
        selectClip(clipId);
      })
    },
  ];
  if (isEdited) {
    items.push({ label: 'Revert to Original', action: () =>
      openDiffModal(revertTitle, [
        {label: 'Description', current, proposed: original},
      ], async () => {
        await _patchClipField(clipId, 'revert', field, null, null);
        selectClip(clipId);
      }, {revertMode: true})
    });
  }
  items.push(null, { label: 'Regenerate via Re-score', action: () => rescoreClip(clipId) });
  showKebab(btn, items);
}

function openDescKebab(clipId, btn)     { _openClipDescKebab(clipId, btn, 'description'); }
function openDescLongKebab(clipId, btn) { _openClipDescKebab(clipId, btn, 'description_long'); }

async function _patchClipField(clipId, action, field, newDesc, newDescLong) {
  const res = await fetch(`/api/clips/${clipId}/fields`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action, field, new_description: newDesc, new_description_long: newDescLong}),
  });
  if (!res.ok) showToast('Save failed', 'error');
}

function clearDetail() {
  const hasRecording = !!AppState.activeVideoId;
  document.getElementById('player-area').innerHTML = `
    <div class="no-export-msg"><div style="color:var(--muted)">${hasRecording ? 'Select a clip to review' : 'Select a recording to get started'}</div></div>`;
  document.getElementById('detail').innerHTML = hasRecording
    ? '<div class="detail-empty">Select a clip from the sidebar<div style="color:var(--muted);font-size:12px;margin-top:6px">Use ← → to navigate between clips</div></div>'
    : '<div class="detail-empty">Select a recording on the left</div>';
}

// ── clip actions ──────────────────────────────────────────────────────────────
async function setStatus(id, status) {
  const clip = AppState.clips.find(c => c.id === id);
  const fromStatus = clip?.status;
  // A slow DB-lock retry (with_write_retry, B6) can take seconds while analysis is
  // hammering the DB - disable the review buttons for the duration so that wait
  // reads as "working" instead of "stuck" (B7). Only the currently-shown clip's
  // buttons exist in the DOM; a keyboard-shortcut call already selected its clip
  // first, so this still finds them.
  const statusButtons = id === AppState.activeClipId
    ? [...document.querySelectorAll('.review-actions [data-act="set-status"]')]
    : [];
  statusButtons.forEach(btn => { btn.disabled = true; });
  try {
    const res = await fetch(`/api/clips/${id}/status`, {
      method:  'POST',
      headers: {'Content-Type': 'application/json'},
      body:    JSON.stringify({status}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(`Failed to update status: ${formatApiError(err)}`, 'error');
      return;
    }
    AppState.activeClipId = id;
    const [clipsData, clipDetail] = await Promise.all([
      fetchClipsList(AppState.activeVideoId),
      fetch(`/api/clips/${id}`).then(r => r.json()),
    ]);
    if (clipsData) { AppState.clips = clipsData; _renderClips(); }
    renderDetail(clipDetail);
    loadVideos();

    if (fromStatus && fromStatus !== status) {
      if (AppState.lastStatusChange?.timer) clearTimeout(AppState.lastStatusChange.timer);
      if (AppState.lastBulkStatusChange?.timer) clearTimeout(AppState.lastBulkStatusChange.timer);
      AppState.lastBulkStatusChange = null;
      const label = {approved:'Approved', rejected:'Rejected', pending:'Marked as Unreviewed'}[status] || status;
      AppState.lastStatusChange = {clipId: id, fromStatus};
      AppState.lastStatusChange.timer = setTimeout(() => { AppState.lastStatusChange = null; }, 5000);
      showUndoToast(`Clip ${label}`, undoLastStatus);
    }
  } finally {
    // renderDetail() already replaced these nodes on success - re-enabling a
    // detached node is a harmless no-op there; this only matters on the error path.
    statusButtons.forEach(btn => { btn.disabled = false; });
  }
}

// Ctrl/Cmd+Z dispatch (settings.js) - prefers whichever of single/bulk status
// change is still pending; setting either clears the other, so at most one is
// ever live and this never has to arbitrate between the two.
function undoLastStatus() {
  if (AppState.lastBulkStatusChange) {
    undoLastBulkStatus();
    return;
  }
  if (!AppState.lastStatusChange) return;
  const {clipId, fromStatus} = AppState.lastStatusChange;
  clearTimeout(AppState.lastStatusChange.timer);
  AppState.lastStatusChange = null;
  setStatus(clipId, fromStatus);
}

// ── delete ────────────────────────────────────────────────────────────────────
function deleteExport(id) {
  showConfirm(
    'Delete exported file?',
    'The exported video file will be removed from disk. The clip record stays - you can re-export any time.',
    'Delete Export',
    async () => {
      // Release the streaming connection first - on Windows the server's StaticFiles
      // handle stays open while the <video> is connected, blocking the delete.
      await _releasePlayerBeforeDelete();
      const res = await fetch(`/api/clips/${id}/export`, {method: 'DELETE'});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(`Failed to delete export: ${formatApiError(err)}`, 'error');
        selectClip(id);  // restore the player/detail we cleared above
        return;
      }
      AppState.activeClipData.has_export = false;
      AppState.activeMediaFilename = null;
      renderPlayer(null, null, id);
      renderDetail(AppState.activeClipData);
      await _reloadClipList(AppState.activeVideoId);
      showToast('Exported file deleted');
    },
    true,
  );
}

function deleteClip(id) {
  showConfirm(
    'Delete clip?',
    `The clip record will be removed from the database. ` +
    `Its exported video file (if any) will also be deleted from the exports folder.`,
    'Delete',
    () => _doDeleteClip(id),
    true,
  );
}

async function _doDeleteClip(id) {
  const videoId = AppState.activeVideoId;
  // Release the player so its backing export/preview file isn't locked during delete.
  if (AppState.activeClipId === id) await _releasePlayerBeforeDelete();
  const delRes = await fetch(`/api/clips/${id}`, {method: 'DELETE'});
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    showToast(`Failed to delete clip: ${formatApiError(err)}`, 'error');
    if (AppState.activeClipId === id) selectClip(id);
    return;
  }
  AppState.activeClipId = null;
  clearDetail();
  await _reloadClipList(videoId);
  await loadVideos();
  showToast('Clip deleted');
}

// ── find similar ──────────────────────────────────────────────────────────────
let _similarClipsClipId = null;
let _similarClipsOpener = null;
// The clip id whose Find Similar search is in flight, so the Related Clips card can
// show an inline "Searching…" spinner co-located with where the results land (the
// global job-header pill also shows progress). Cleared on done/error.
let _findingSimilarClipId = null;

// Re-render the open clip detail so its Related Clips card reflects the current
// _findingSimilarClipId (spinner) state. No-op when the panel is taken over or a
// different clip is showing.
function _renderSimilarSearchState() {
  if (PanelNav.isOpen()) return;
  if (AppState.activeClipId !== _findingSimilarClipId) return;
  if (AppState.activeClipData) renderDetail(AppState.activeClipData);
}

function openSimilarClipsModal(clipId) {
  _similarClipsOpener = document.activeElement;
  _similarClipsClipId = clipId;
  const currentVideo = AppState.videos.find(v => v.id === AppState.activeVideoId);
  const otherVideos = AppState.videos.filter(v => v.id !== AppState.activeVideoId && v.status === 'done');

  const scope = document.getElementById('similar-clips-scope');
  scope.innerHTML = '';

  const addCheck = (id, label, checked) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer';
    row.innerHTML = `<input type="checkbox" data-video-id="${id}" ${checked ? 'checked' : ''}> ${escHtml(label)}`;
    scope.appendChild(row);
  };

  if (currentVideo) addCheck(currentVideo.id, `${currentVideo.title || currentVideo.filename} (this recording)`, true);
  for (const v of otherVideos) addCheck(v.id, v.title || v.filename, false);
  if (!currentVideo && !otherVideos.length) {
    scope.innerHTML = '<div style="font-size:12px;color:var(--muted)">No processed recordings available</div>';
  }

  document.getElementById('similar-clips-modal').classList.add('visible');
  setTimeout(() => {
    const first = document.querySelector('#similar-clips-scope input[type=checkbox]');
    (first || document.querySelector('#similar-clips-modal .btn'))?.focus();
  }, 50);
}

function closeSimilarClipsModal() {
  document.getElementById('similar-clips-modal').classList.remove('visible');
  _similarClipsClipId = null;
  const opener = _similarClipsOpener;
  _similarClipsOpener = null;
  if (opener?.focus) opener.focus();
}

function startFindSimilar() {
  const clipId = _similarClipsClipId;
  if (!clipId) return;
  if (_blockedByAnalyze('find similar clips')) return;

  const checked = Array.from(document.querySelectorAll('#similar-clips-scope input[type=checkbox]:checked'));
  const videoIds = checked.map(el => el.dataset.videoId).join(',');

  closeSimilarClipsModal();

  // A single similarity ranking call (no per-item loop to interrupt), so it is
  // progress-only: no Cancel button. Feedback is the global job-header pill plus an
  // inline spinner on the Related Clips card (PROGRESS-CANCEL-GAP Part B / bug 3.3).
  _supersedeActiveStream();
  startJobUI(FIND_SIMILAR_STEPS, 'Finding similar clips');
  openLog();
  _findingSimilarClipId = clipId;
  _renderSimilarSearchState();

  const teardown = () => { _findingSimilarClipId = null; endJobUI(); };
  const qs = videoIds ? `?video_ids=${encodeURIComponent(videoIds)}` : '';
  const handle = _openSSE(
    `/api/clips/${clipId}/related-clips${qs}`,
    msg => { updateJobUI(typeof msg === 'string' ? msg : JSON.stringify(msg)); appendLog(String(msg)); },
    async msg => {
      _clearActiveStream(handle);
      teardown();
      const clip = await fetch(`/api/clips/${clipId}`).then(r => r.json()).catch(() => null);
      if (clip) {
        AppState.activeClipData = clip;
        if (!PanelNav.isOpen()) renderDetail(clip);
      }
      const count = msg.results?.length ?? 0;
      showToast(count ? `Found ${plural(count, 'similar clip')}` : 'No similar clips found');
    },
    errMsg => {
      _clearActiveStream(handle);
      teardown();
      // Clear the in-card spinner by re-rendering the displayed clip from cache.
      if (AppState.activeClipId === clipId && !PanelNav.isOpen() && AppState.activeClipData) {
        renderDetail(AppState.activeClipData);
      }
      showToast(`Find Similar failed - ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, teardown);
}

// ── scoring ───────────────────────────────────────────────────────────────────
function scoreAll() {
  openLog();
  streamSSE(
    '/api/score',
    () => {
      loadVideos();
      _reloadClipList(AppState.activeVideoId);
      showToast('Scoring complete');
    },
    SCORE_STEPS,
    'Scoring',
    true,
  );
  setJobCancel({
    url:     '/api/analyze/cancel',
    title:   'Cancel scoring?',
    body:    'Clips already scored keep their scores; the rest will need scoring again.',
    confirm: 'Cancel Scoring',
    logMsg:  '[Scoring cancelled]',
  });
}

// Static index.html buttons this module owns (filter chips, kind toggle, sort
// dir, kebab, search, min-score) - wired here once at module load, same pattern
// as the #clip-list / #detail delegation above, replacing the onclick=/oninput=/
// onchange= attributes that used to live on that markup directly.
function _handleClipSidebarClick(e) {
  const kindBtn = e.target.closest('[data-kfilter]');
  if (kindBtn) { setClipKindFilter(kindBtn.dataset.kfilter); return; }
  const filterChip = e.target.closest('[data-filter]');
  if (filterChip) { toggleClipFilter(filterChip.dataset.filter); return; }
  if (e.target.closest('#clips-sort-dir')) { toggleClipSortDir(); return; }
  const kebabBtn = e.target.closest('#btn-clips-actions');
  if (kebabBtn) { openClipsActionsMenu(kebabBtn); return; }
}

// Delegated #detail click/keydown handling plus the static index.html clip-sidebar
// and modal controls this module owns. Called once from boot.js at first paint (see
// initHotwordListeners in hotwords.js for the reference pattern) so importing this
// module has no DOM side effect.
function initClipsListeners() {
  document.getElementById('detail').addEventListener('click', _handleDetailClick);
  document.getElementById('detail').addEventListener('keydown', _handleDetailKeydown);

  document.getElementById('clips-sidebar-group').addEventListener('click', _handleClipSidebarClick);
  document.getElementById('clip-search-input').addEventListener('input', e => setClipSearch(e.target.value));
  document.getElementById('clip-score-min').addEventListener('change', e => setClipScoreMin(e.target.value));

  const similarClipsModal = document.getElementById('similar-clips-modal');
  similarClipsModal.addEventListener('click', e => { if (e.target === similarClipsModal) closeSimilarClipsModal(); });
  document.getElementById('similar-clips-cancel-btn').addEventListener('click', () => closeSimilarClipsModal());
  document.getElementById('btn-find-similar-go').addEventListener('click', () => startFindSimilar());

  const scoreOverrideModal = document.getElementById('score-override-modal');
  scoreOverrideModal.addEventListener('click', e => { if (e.target === scoreOverrideModal) closeScoreOverrideModal(); });
  document.getElementById('score-override-cancel-btn').addEventListener('click', () => closeScoreOverrideModal());
  document.getElementById('score-override-save-btn').addEventListener('click', () => _scoreOverrideSave());
}

// Public API - symbols another already-ESM module reads off window as this
// module's exports (shortcuts.js, jobs.js, videos.js), or a tests/ui/*.py
// page.evaluate. setClipSearch, setClipScoreMin,
// _clearClipFilters, setClipKindFilter, toggleClipSortDir, deleteClip,
// deleteExport, mergeClips, scanDuplicates, openClipsActionsMenu,
// _scoreOverrideSave, clearScoreOverride, openDescKebab, openDescLongKebab,
// startFindSimilar and openSimilarClipsModal dropped: their only callers were
// this module's own inline handlers (now data-act delegation or the static
// wiring above) or its own internal logic, so nothing outside the module needs
// them off window anymore.
export {
  initClipsListeners,
  selectClip, setStatus, undoLastStatus, renderDetail, renderPlayer, clearDetail, refreshClipDetail,
  _releasePlayerBeforeDelete,
  analyzeFrames,
  toggleClipFilter, _syncFilterChips, _syncKindChips,
  _applyFilters, _renderClips, _parseTimingOffset, _reloadClipList,
  _renderClipFilterCounts,
  _duplicatePartners, _mergeNeighbors, _generatedTagPillsHTML,
  openScoreOverride, closeScoreOverrideModal,
  closeSimilarClipsModal,
  openClipActionsModal,
};
