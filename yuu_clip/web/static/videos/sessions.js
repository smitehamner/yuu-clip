// Feature-map - Session (code: RecordingSession / session_id).
//   API: routes/sessions.py · Tests: tests/ui/test_ui_sessions.py
// ── Sessions: sidebar grouping, auto-suggest, and the session detail view ─────
// A Session groups top-level recordings from one play session. This module owns
// the sidebar group headers, the manual grouping selection mode, the suggest
// prompt, and the session detail view (rollup summary + unified timeline).
import { AppState } from '../core/state.js';
import { escHtml, plural, _msToHms } from '../core/format.js';
import { showToast, collapsibleCard, openLog } from '../core/utils.js';
import { showKebab, showConfirm } from '../core/ui.js';
import { streamSSE } from '../core/jobs.js';
import { loadVideos, selectVideo, _renderVideoList } from './videos.js';

const COLLAPSE_KEY = 'yuuclip-session-collapsed';
const DISMISS_KEY  = 'yuuclip-session-dismissed';

function _loadIdSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function _saveIdSet(key, set) { localStorage.setItem(key, JSON.stringify([...set])); }

const SessionUI = {
  selectionMode: false,
  selected: new Set(),                       // video ids picked while grouping
  collapsed: _loadIdSet(COLLAPSE_KEY),       // session ids collapsed in the sidebar
  dismissed: _loadIdSet(DISMISS_KEY),        // dismissed suggestion group keys
};

function _sessionById(id) { return (AppState.sessions || []).find(s => s.id === id); }

async function loadSessions() {
  try {
    AppState.sessions = await fetch('/api/sessions').then(r => r.json());
  } catch { AppState.sessions = []; }
  _renderVideoList();
}

// ── sidebar group header ──────────────────────────────────────────────────────
function isSessionCollapsed(id) { return SessionUI.collapsed.has(id); }

function toggleSessionCollapse(id) {
  if (SessionUI.collapsed.has(id)) SessionUI.collapsed.delete(id);
  else SessionUI.collapsed.add(id);
  _saveIdSet(COLLAPSE_KEY, SessionUI.collapsed);
  _renderVideoList();
}

function sessionGroupHeaderLi(session, shownCount) {
  const collapsed = isSessionCollapsed(session.id);
  const label = session.name || session.title || 'Session';
  const li = document.createElement('li');
  li.className = 'session-header' + (AppState.activeSessionId === session.id ? ' active' : '');
  li.dataset.sessionId = session.id;
  li.innerHTML = `
    <button class="session-caret" aria-label="${collapsed ? 'Expand' : 'Collapse'} session" aria-expanded="${collapsed ? 'false' : 'true'}">${collapsed ? '&#9656;' : '&#9662;'}</button>
    <div class="session-header-label" role="button" tabindex="0">
      <div class="session-name">&#127902; ${escHtml(label)}</div>
      <div class="meta">${plural(shownCount, 'recording')}</div>
    </div>
    <button class="kebab-btn session-kebab" aria-label="Session actions" title="Session actions">&#8942;</button>`;
  li.querySelector('.session-caret').onclick = e => { e.stopPropagation(); toggleSessionCollapse(session.id); };
  const labelEl = li.querySelector('.session-header-label');
  labelEl.onclick = e => { e.stopPropagation(); selectSession(session.id); };
  labelEl.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSession(session.id); } };
  li.querySelector('.session-kebab').onclick = e => { e.stopPropagation(); _openSessionMenu(session.id, e.currentTarget); };
  return li;
}

function _openSessionMenu(sessionId, anchor) {
  const session = _sessionById(sessionId);
  if (!session) return;
  showKebab(anchor, [
    { label: 'Open session', action: () => selectSession(sessionId) },
    { label: 'Rename…', action: () => _renameSession(sessionId) },
    { label: 'Add recordings…', action: () => { enterGroupingMode(sessionId); } },
    null,
    { label: 'Ungroup (dissolve)', action: () => _dissolveSession(sessionId) },
  ]);
}

async function _renameSession(sessionId) {
  const session = _sessionById(sessionId);
  if (!session) return;
  const name = await _promptText('Rename session', 'Session name', session.name || '');
  if (name === null) return;
  const res = await fetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name}),
  });
  if (!res.ok) { showToast('Could not rename session', 'error'); return; }
  await loadSessions();
  if (AppState.activeSessionId === sessionId) selectSession(sessionId);
  showToast('Session renamed');
}

function _dissolveSession(sessionId) {
  const session = _sessionById(sessionId);
  if (!session) return;
  showConfirm(
    'Ungroup this session?',
    `The ${plural(session.member_count, 'recording')} stay - they are just no longer grouped as a session. This cannot group them back automatically.`,
    'Ungroup',
    async () => {
      const res = await fetch(`/api/sessions/${sessionId}`, {method: 'DELETE'});
      if (!res.ok) { showToast('Could not ungroup session', 'error'); return; }
      if (AppState.activeSessionId === sessionId) { AppState.activeSessionId = null; _showEmptySessionDetail(); }
      await loadSessions();
      showToast('Session ungrouped');
    },
    true,
  );
}

// ── manual grouping selection mode ────────────────────────────────────────────
// addToSessionId is set when grouping from a session's "Add recordings…" action:
// the picked recordings are added to that session instead of creating a new one.
let _addToSessionId = null;

function enterGroupingMode(addToSessionId = null) {
  _addToSessionId = typeof addToSessionId === 'number' ? addToSessionId : null;
  SessionUI.selectionMode = true;
  SessionUI.selected = new Set();
  _renderVideoList();
  _syncGroupingBar();
}

function exitGroupingMode() {
  SessionUI.selectionMode = false;
  SessionUI.selected = new Set();
  _addToSessionId = null;
  _renderVideoList();
  _syncGroupingBar();
}

function toggleGroupSelect(videoId) {
  if (SessionUI.selected.has(videoId)) SessionUI.selected.delete(videoId);
  else SessionUI.selected.add(videoId);
  _renderVideoList();
  _syncGroupingBar();
}

function _syncGroupingBar() {
  const bar = document.getElementById('session-grouping-bar');
  if (!bar) return;
  bar.style.display = SessionUI.selectionMode ? '' : 'none';
  const count = SessionUI.selected.size;
  const countEl = document.getElementById('session-grouping-count');
  if (countEl) countEl.textContent = plural(count, 'selected recording');
  const btn = document.getElementById('btn-confirm-group');
  if (btn) {
    const min = _addToSessionId != null ? 1 : 2;
    btn.disabled = count < min;
    btn.textContent = _addToSessionId != null ? 'Add to session' : 'Group as session';
  }
  const label = document.getElementById('session-grouping-label');
  if (label) {
    label.textContent = _addToSessionId != null
      ? 'Pick recordings to add to this session'
      : 'Pick 2+ recordings to group as a session';
  }
}

async function confirmGroupSelection() {
  const ids = [...SessionUI.selected];
  if (_addToSessionId != null) {
    if (!ids.length) return;
    const res = await fetch(`/api/sessions/${_addToSessionId}/members`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({video_ids: ids}),
    });
    if (!res.ok) { showToast('Could not add recordings', 'error'); return; }
    const sid = _addToSessionId;
    exitGroupingMode();
    await loadVideos();
    showToast(`Added ${plural(ids.length, 'recording')}`);
    if (AppState.activeSessionId === sid) selectSession(sid);
    return;
  }
  if (ids.length < 2) return;
  const name = await _promptText('Name this session', 'Session name (optional)', '');
  if (name === null) return;   // cancelled
  const res = await fetch('/api/sessions', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name, video_ids: ids}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(err.detail || 'Could not create session', 'error');
    return;
  }
  const session = await res.json();
  exitGroupingMode();
  await loadVideos();
  showToast(`Grouped ${plural(ids.length, 'recording')} into a session`);
  selectSession(session.id);
}

// ── auto-suggest ──────────────────────────────────────────────────────────────
function _groupKey(ids) { return [...ids].sort((a, b) => a - b).join(','); }

async function suggestSessions() {
  let groups;
  try {
    groups = await fetch('/api/sessions/suggestions').then(r => r.json());
  } catch { showToast('Could not load suggestions', 'error'); return; }
  const fresh = groups.filter(g => !SessionUI.dismissed.has(_groupKey(g.video_ids)));
  if (!fresh.length) {
    showToast('No new session suggestions - recordings look separate.', 'info');
    return;
  }
  _showSuggestionModal(fresh);
}

function openRecordingsActionsMenu(btn) {
  showKebab(btn, [
    { label: 'Group', action: () => enterGroupingMode() },
    { label: 'Suggest sessions', action: () => suggestSessions() },
  ]);
}

function _showSuggestionModal(groups) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg visible';
  const items = groups.map((g, i) => `
    <div class="session-suggestion" data-idx="${i}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;margin-bottom:2px">${plural(g.video_ids.length, 'recording')} look like one session</div>
        <div class="meta" style="white-space:normal">${g.titles.map(t => escHtml(t)).join(' · ')}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn ghost" data-act="dismiss" data-idx="${i}">Dismiss</button>
        <button class="btn primary" data-act="group" data-idx="${i}">Group</button>
      </div>
    </div>`).join('');
  bg.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="session-suggest-title" style="width:520px;max-width:95vw">
      <h3 id="session-suggest-title">Suggested sessions</h3>
      <p class="meta" style="margin:0 0 12px">Recordings recorded back-to-back may belong to one play session. Group the ones that do.</p>
      <div class="session-suggestion-list">${items}</div>
      <div class="modal-actions" style="margin-top:14px"><button class="btn" data-act="close">Done</button></div>
    </div>`;
  const close = () => { bg.remove(); loadVideos(); };
  bg.onclick = e => {
    if (e.target === bg) { close(); return; }
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'close') { close(); return; }
    const idx = parseInt(btn.dataset.idx, 10);
    const group = groups[idx];
    if (act === 'dismiss') {
      SessionUI.dismissed.add(_groupKey(group.video_ids));
      _saveIdSet(DISMISS_KEY, SessionUI.dismissed);
      bg.querySelector(`.session-suggestion[data-idx="${idx}"]`)?.remove();
      if (!bg.querySelector('.session-suggestion')) close();
    } else if (act === 'group') {
      _acceptSuggestion(group, () => {
        bg.querySelector(`.session-suggestion[data-idx="${idx}"]`)?.remove();
        if (!bg.querySelector('.session-suggestion')) close();
      });
    }
  };
  document.body.appendChild(bg);
}

async function _acceptSuggestion(group, onDone) {
  const res = await fetch('/api/sessions', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({video_ids: group.video_ids}),
  });
  if (!res.ok) { showToast('Could not create session', 'error'); return; }
  showToast(`Grouped ${plural(group.video_ids.length, 'recording')} into a session`);
  await loadSessions();
  onDone();
}

// ── text prompt modal (create/rename) ─────────────────────────────────────────
function _promptText(title, labelText, initial) {
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg visible';
    bg.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="session-prompt-title" style="width:400px;max-width:95vw">
        <h3 id="session-prompt-title">${escHtml(title)}</h3>
        <div class="field">
          <label for="session-prompt-input">${escHtml(labelText)}</label>
          <input type="text" id="session-prompt-input" autocomplete="off">
        </div>
        <div class="modal-actions" style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
          <button class="btn ghost" data-act="cancel">Cancel</button>
          <button class="btn primary" data-act="ok">Save</button>
        </div>
      </div>`;
    const input = bg.querySelector('#session-prompt-input');
    input.value = initial || '';
    const done = value => { bg.remove(); resolve(value); };
    bg.onclick = e => {
      if (e.target === bg || e.target.dataset.act === 'cancel') return done(null);
      if (e.target.dataset.act === 'ok') return done(input.value.trim());
    };
    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); done(input.value.trim()); }
      else if (e.key === 'Escape') { e.preventDefault(); done(null); }
    };
    document.body.appendChild(bg);
    setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

// ── session detail view ───────────────────────────────────────────────────────
async function selectSession(sessionId) {
  AppState.activeSessionId = sessionId;
  AppState.activeVideoId = null;
  document.querySelectorAll('#video-list li').forEach(l => l.classList.remove('active'));
  document.querySelector(`#video-list li[data-session-id="${sessionId}"]`)?.classList.add('active');
  document.getElementById('player-area').innerHTML = '';
  document.getElementById('detail').innerHTML =
    '<div style="padding:24px;color:var(--muted)">Loading session…</div>';
  let session;
  try {
    session = await fetch(`/api/sessions/${sessionId}`).then(r => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  } catch {
    document.getElementById('detail').innerHTML =
      '<div style="padding:24px;color:var(--red)">Could not load this session.</div>';
    return;
  }
  if (AppState.activeSessionId !== sessionId) return;   // superseded
  _renderSessionDetail(session);
}

function _showEmptySessionDetail() {
  document.getElementById('player-area').innerHTML = '';
  document.getElementById('detail').innerHTML = '';
}

function _renderSessionDetail(session) {
  const memberIds = session.members.map(m => m.id);
  const eb = isEdited => isEdited ? '<span class="edited-badge">edited</span>' : '';
  const titleText = session.title || session.name || 'Session';
  document.getElementById('detail').innerHTML = `
    <div><div class="detail-type-badge video-badge">&#127902; Session</div></div>

    <div class="detail-card">
      <div class="detail-card-header">
        <h2 style="margin:0;font-size:17px;font-weight:700">${escHtml(titleText)}${eb(session.title_is_edited)}</h2>
        <button class="kebab-btn" title="Session actions" aria-label="Session actions" id="session-detail-kebab">&#8942;</button>
      </div>
      <div style="color:var(--muted);font-size:13px">
        ${plural(session.members.length, 'recording')} &middot; ${_msToHms(session.total_ms)} total
      </div>
    </div>

    ${collapsibleCard('session-summary',
        `<span class="detail-card-title">Session Summary${eb(session.summary_is_edited)}</span>`, `
      ${session.summary
        ? `<div class="description-long">${escHtml(session.summary)}</div>`
        : `<div style="color:var(--muted);font-size:12px">No summary yet - roll one up from the recordings' summaries.</div>`}`,
      { actions: `<button class="btn ghost" id="session-summarize-btn">${session.summary ? 'Regenerate' : 'Generate Summary'}</button>` })}

    <div class="vid-actions">
      <div class="vid-actions-row">
        <button class="btn" id="session-reel-btn">Build Highlight Reel from Session</button>
      </div>
    </div>

    ${collapsibleCard('session-timeline',
      `<span class="detail-card-title">Unified Timeline</span>`, `
      <div id="session-timeline">${_renderUnifiedTimeline(session)}</div>`)}`;

  document.getElementById('session-detail-kebab').onclick =
    e => _openSessionMenu(session.id, e.currentTarget);
  document.getElementById('session-summarize-btn').onclick = () => _summarizeSession(session.id);
  document.getElementById('session-reel-btn').onclick = () => window.openReelForSession(session.id, memberIds);
  _wireTimelineNavigation();
}

function _renderUnifiedTimeline(session) {
  if (!session.members.length) return '<div class="meta">No recordings in this session.</div>';
  const blocks = session.members.map(m => {
    const gap = m.gap_before_ms > 0
      ? `<div class="session-gap">&middot; ${_fmtGap(m.gap_before_ms)} break &middot;</div>`
      : '';
    const head = `
      <div class="session-member-head">
        <span class="session-member-offset">${_msToHms(m.offset_ms)}</span>
        <span class="session-member-title">${escHtml(m.title)}</span>
        <button class="btn ghost" style="font-size:10px;padding:1px 7px" data-open-video="${m.id}">Open</button>
      </div>`;
    let body;
    if (!m.has_timeline && !m.clips.length) {
      body = `<div class="meta" style="padding:4px 0 8px">No timeline yet - <a href="#" data-open-video="${m.id}">open to generate one</a>.</div>`;
    } else {
      const rows = _mergeTimelineRows(m).map(r => r.html).join('');
      body = `<div class="session-timeline-rows">${rows}</div>`;
    }
    return `<div class="session-member-block">${gap}${head}${body}</div>`;
  });
  return blocks.join('');
}

// Interleaves a member's timeline entries and clip markers by absolute time so
// the reader sees both on one axis. Each row carries the data-* nav attributes.
function _mergeTimelineRows(member) {
  const rows = [];
  for (const e of member.timeline) {
    rows.push({ abs: e.abs_ms, html: `
      <div class="session-tl-row" data-goto-video="${member.id}" data-goto-ms="${e.local_ms}">
        <span class="session-tl-stamp">${escHtml(_msToHms(e.abs_ms))}</span>
        <span class="session-tl-text">${escHtml(e.text)}</span>
      </div>` });
  }
  for (const c of member.clips) {
    rows.push({ abs: c.abs_ms, html: `
      <div class="session-tl-row session-tl-clip" data-open-clip="${c.id}" data-clip-video="${member.id}">
        <span class="session-tl-stamp">${escHtml(_msToHms(c.abs_ms))}</span>
        <span class="session-tl-text">&#127916; ${escHtml(c.description || `Clip ${c.id}`)}
          <span class="meta">&#11088; ${Math.round((c.score_overall || 0) * 100)}%</span></span>
      </div>` });
  }
  rows.sort((a, b) => a.abs - b.abs);
  return rows;
}

function _wireTimelineNavigation() {
  const container = document.getElementById('session-timeline');
  if (!container) return;
  container.onclick = async e => {
    const openVideo = e.target.closest('[data-open-video]');
    if (openVideo) { e.preventDefault(); selectVideo(parseInt(openVideo.dataset.openVideo, 10)); return; }
    const clipRow = e.target.closest('[data-open-clip]');
    if (clipRow) {
      await selectVideo(parseInt(clipRow.dataset.clipVideo, 10));
      if (window.selectClip) window.selectClip(parseInt(clipRow.dataset.openClip, 10));
      return;
    }
    const gotoRow = e.target.closest('[data-goto-video]');
    if (gotoRow) { _gotoRecordingTime(parseInt(gotoRow.dataset.gotoVideo, 10), parseInt(gotoRow.dataset.gotoMs, 10)); }
  };
}

async function _gotoRecordingTime(videoId, localMs) {
  await selectVideo(videoId);
  const videoEl = document.getElementById('recording-preview-video');
  if (!videoEl) return;
  const offsetS = AppState.activeVideoData?.segment_start_s || 0;
  const seekTo = localMs / 1000 + offsetS;
  const doSeek = () => { try { videoEl.currentTime = seekTo; } catch {} };
  if (videoEl.readyState >= 1) doSeek();
  else videoEl.addEventListener('loadedmetadata', doSeek, {once: true});
}

function _summarizeSession(sessionId) {
  const btn = document.getElementById('session-summarize-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Summarizing…'; }
  openLog();
  streamSSE(
    `/api/sessions/${sessionId}/summarize`,
    () => {
      showToast('Session summary generated');
      if (AppState.activeSessionId === sessionId) selectSession(sessionId);
      loadSessions();
    },
    [{label: 'Summarize', patterns: ['Generating']}],
    'Session summary',
    false,
  );
}

function _fmtGap(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return plural(mins, 'min');
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : plural(h, 'hr');
}

// ── static index.html handlers this module owns (wired once at load) ──────────
// The recordings-section kebab and the grouping-bar's Cancel/Group buttons are
// fixed, never-recreated elements in index.html, so a single load-time listener
// can't double-fire on a re-render.
function _wireStaticHandlers() {
  document.getElementById('btn-recordings-actions')
    .addEventListener('click', e => openRecordingsActionsMenu(e.currentTarget));
  document.getElementById('btn-cancel-group')
    .addEventListener('click', () => exitGroupingMode());
  document.getElementById('btn-confirm-group')
    .addEventListener('click', () => confirmGroupSelection());
}

_wireStaticHandlers();

export {
  SessionUI, isSessionCollapsed, sessionGroupHeaderLi, toggleGroupSelect,
};
