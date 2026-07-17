// Feature-map - Recordings list + detail (code: video / Video).
//   API: routes/videos.py · Tests: tests/ui/test_ui_video.py, tests/integration/test_videos.py
import { AppState } from '../core/state.js';
import {
  escHtml, plural, _fmtVideoStatus, _msToHms, _fmtDate, _parseServerDate, _fmtElapsed, formatApiError,
} from '../core/format.js';
import { collapsibleCard, showToast, netErrMsg, revealInFolder, _syncSortDirBtn, openLog, appendLog } from '../core/utils.js';
import { showConfirm, openFieldEditModal, openDiffModal, showKebab, openActionsModal } from '../core/ui.js';
import { setupRecordingPreview } from '../core/preview.js';
import {
  streamSSE, cancelJob, _blockedByAnalyze, _stepPillLabel,
  _jobStepDefs, _activeStepIdx, _jobStartTime,
} from '../core/jobs.js';
import { openGettingStartedModal } from '../core/helpmodals.js';
import { _probedInfo, _panelDirty } from '../analyze/analyze.js';
import { _splitPoints } from '../analyze/split.js';
// ── videos ────────────────────────────────────────────────────────────────────
async function loadVideos() {
  let videos;
  try {
    const [videosRes, sessions] = await Promise.all([
      fetch('/api/videos'),
      fetch('/api/sessions').then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    if (!videosRes.ok) throw new Error(`Server error ${videosRes.status}`);
    videos = await videosRes.json();
    AppState.sessions = sessions;
  } catch (err) {
    document.getElementById('video-list').innerHTML =
      `<li style="padding:10px 14px;color:var(--red)">Failed to load recordings: ${escHtml(String(err.message || err))}</li>`;
    return;
  }
  AppState.videos = videos;

  // While a brand-new recording is analyzing, show it in the sidebar right away -
  // before its DB row exists - so the user gets immediate feedback. Suppressed
  // once the real row appears (matched by filename).
  const analyzingName = AppState.analyzeFilename;
  const showPlaceholder = analyzingName && !videos.some(v => v.filename === analyzingName);

  if (!videos.length && !showPlaceholder) {
    document.getElementById('video-list').innerHTML =
      '<li style="padding:10px 14px;color:var(--muted)">No recordings yet</li>';
    _showEmptyState();
    _updateDemoButton(0);
    return;
  }

  _renderVideoList();
  _updateDemoButton(videos.reduce((n, v) => n + v.approved, 0));

  if (!AppState.bootRestoreDone) {
    AppState.bootRestoreDone = true;
    _restoreView();
  }
}

// Client-side search + filter + sort over AppState.videos for the sidebar list.
function _applyVideoFilters(videos) {
  let result = videos.slice();
  const q = (AppState.videoSearch || '').toLowerCase();
  if (q) result = result.filter(v =>
    (v.title || '').toLowerCase().includes(q) || (v.filename || '').toLowerCase().includes(q));
  const f = AppState.videoFilters;
  if (f && f.size) {
    if (f.has('has-clips')) result = result.filter(v => v.clip_count > 0);
    if (f.has('unscored'))  result = result.filter(v => !v.clips_scored_at);
    if (f.has('errors'))    result = result.filter(v => (v.clips_llm_error || 0) > 0);
  }
  const sort = AppState.videoSort || 'recent';
  if (sort === 'title')       result.sort((a, b) => (a.title || a.filename || '').localeCompare(b.title || b.filename || ''));
  else if (sort === 'filename') result.sort((a, b) => (a.filename || '').localeCompare(b.filename || '', undefined, { numeric: true }));
  else if (sort === 'length') result.sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0));
  else if (sort === 'clips')  result.sort((a, b) => (b.clip_count || 0) - (a.clip_count || 0));
  // 'recent' keeps the server order (created_at desc).
  if ((AppState.videoSortDir || 'desc') === 'asc') result.reverse();
  return result;
}

// Per-filter counts shown inline on the recording filter chips ("Unscored 4").
// Counts reflect every loaded recording, not the search-narrowed subset, and use
// the same predicates as _applyVideoFilters. Blank when there are no recordings.
function _renderVideoFilterCounts() {
  const setCount = (key, value) => {
    const badge = document.querySelector(`.clip-chip-count[data-vcount="${key}"]`);
    if (badge) badge.textContent = value == null ? '' : String(value);
  };
  const videos = AppState.videos || [];
  if (!videos.length) {
    for (const key of ['all', 'has-clips', 'unscored', 'errors']) setCount(key, null);
    return;
  }
  setCount('all', videos.length);
  setCount('has-clips', videos.filter(v => v.clip_count > 0).length);
  setCount('unscored', videos.filter(v => !v.clips_scored_at).length);
  setCount('errors', videos.filter(v => (v.clips_llm_error || 0) > 0).length || null);
}

// Rebuilds the sidebar video list from AppState.videos, applying the active
// search/filter/sort. Called by loadVideos (after fetch) and by the controls.
function _renderVideoList() {
  _renderVideoFilterCounts();
  const list = document.getElementById('video-list');
  list.innerHTML = '';
  const analyzingName = AppState.analyzeFilename;
  const showPlaceholder = analyzingName && !AppState.videos.some(v => v.filename === analyzingName);
  if (showPlaceholder) list.appendChild(_analyzingPlaceholderLi(analyzingName));

  const shown = _applyVideoFilters(AppState.videos);
  if (!shown.length && !showPlaceholder) {
    const hasFilter = AppState.videoSearch || (AppState.videoFilters && AppState.videoFilters.size);
    list.innerHTML = hasFilter
      ? `<li style="padding:10px 14px;color:var(--muted)">No recordings match - <a href="#" style="color:var(--accent);text-decoration:underline" data-act="clear-video-filters">Clear filters</a></li>`
      : '<li style="padding:10px 14px;color:var(--muted)">No recordings yet</li>';
    return;
  }

  _renderGroupedVideoItems(list, shown, analyzingName);

  const _handleVideoListActivate = e => {
    const clearLink = e.target.closest('[data-act="clear-video-filters"]');
    if (clearLink) { e.preventDefault(); _clearVideoFilters(); return; }
    const li = e.target.closest('li[data-video-id]');
    if (!li) return;
    const videoId = parseInt(li.dataset.videoId);
    if (window.SessionUI && window.SessionUI.selectionMode) { window.toggleGroupSelect(videoId); return; }
    document.querySelectorAll('#video-list li').forEach(l => l.classList.remove('active'));
    li.classList.add('active');
    selectVideo(videoId);
  };
  list.onclick = _handleVideoListActivate;
  list.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _handleVideoListActivate(e); } };
}

// Renders the sidebar list grouped by session: a session's shown members appear
// together under a collapsible header, anchored at the sort position of their
// first-appearing member; ungrouped recordings render inline.
function _renderGroupedVideoItems(list, shown, analyzingName) {
  const sessionById = new Map((AppState.sessions || []).map(s => [s.id, s]));
  const renderedSessions = new Set();
  for (const v of shown) {
    const session = v.session_id != null ? sessionById.get(v.session_id) : null;
    if (session && !renderedSessions.has(session.id)) {
      renderedSessions.add(session.id);
      const members = shown.filter(x => x.session_id === session.id);
      list.appendChild(window.sessionGroupHeaderLi(session, members.length));
      if (!window.isSessionCollapsed(session.id)) {
        for (const m of members) list.appendChild(_videoItemLi(m, analyzingName, true));
      }
    } else if (!session) {
      list.appendChild(_videoItemLi(v, analyzingName, false));
    }
  }
}

// Builds one recording <li>. inSession indents it under its session header;
// grouping selection mode adds a checkbox and suppresses normal navigation.
function _videoItemLi(v, analyzingName, inSession) {
  const isAnalyzing = v.filename === analyzingName && v.status !== 'done';
  const selecting = !!(window.SessionUI && window.SessionUI.selectionMode);
  const selectable = selecting && v.parent_video_id == null;
  const li = document.createElement('li');
  li.className = 'video-item'
    + (v.id === AppState.activeVideoId ? ' active' : '')
    + (isAnalyzing ? ' analyzing' : '')
    + (inSession ? ' in-session' : '')
    + (selectable && window.SessionUI.selected.has(v.id) ? ' selected' : '');
  li.dataset.videoId = v.id;
  li.tabIndex = 0;
  const clipsPct = v.duration_ms > 0
    ? ` (${Math.round(v.total_clip_ms / v.duration_ms * 100)}%)`
    : '';
  const scoreBar = (v.score_min !== null && v.score_max !== null && v.clip_count > 0)
    ? `<div class="meta">Scores: ${Math.round(v.score_min * 100)}% – ${Math.round(v.score_max * 100)}%</div>`
    : '';
  const segmentMeta = (v.segment_start_s != null && v.segment_end_s != null)
    ? `<div class="meta" style="color:var(--accent2)" title="Where this part sits inside the original recording">from ${_msToHms(v.segment_start_s * 1000)} to ${_msToHms(v.segment_end_s * 1000)}</div>`
    : '';
  const errCount = v.clips_llm_error || 0;
  // A missing model is a setup state, not a failure: when no language model is
  // usable right now, these clips were simply scored before one was set up, so
  // show a calm note rather than an alarming red "N scoring errors" badge.
  const llmUsable = !!(window._prereqs || {}).llm_ok;
  const errBadge = errCount === 0 ? ''
    : llmUsable
    ? `<div class="meta" style="margin-top:2px;color:var(--warning)" title="LLM scoring failed for ${plural(errCount, 'clip')} - re-score to retry">&#9888; ${plural(errCount, 'scoring error')}</div>`
    : `<div class="meta" style="margin-top:2px;color:var(--muted)" title="These clips were scored before a language model was set up - set one up, then re-score for AI scoring and descriptions">Scored without a language model</div>`;
  const checkbox = selectable
    ? `<input type="checkbox" class="session-select-box" aria-label="Select for grouping" ${window.SessionUI.selected.has(v.id) ? 'checked' : ''}>`
    : '';
  li.innerHTML = `
    <div class="video-item-body">
      ${checkbox}
      <div style="flex:1;min-width:0">
        <div class="name" title="${v.title ? escHtml(v.filename) : ''}">${escHtml(v.title || v.filename)}</div>
        ${v.title ? `<div class="video-title">${escHtml(v.filename)}</div>` : ''}
        ${segmentMeta}
        <div class="meta">${v.duration_hms} &middot; ${v.clip_count} clips &middot; ${_msToHms(v.total_clip_ms)} clipped${clipsPct}</div>
        <div class="meta">${isAnalyzing
          ? `<span class="spinner" style="display:inline-block;vertical-align:middle"></span> <span style="color:var(--accent)">${escHtml(_fmtVideoStatus(v.status))}…</span>`
          : `${v.approved} approved &middot; ${v.exported} exported &middot; ${_fmtVideoStatus(v.status)}`}</div>
        ${errBadge}
        ${scoreBar}
      </div>
    </div>`;
  return li;
}

// ── video search / filter / sort controls ──────────────────────────────────
function setVideoSearch(q) { AppState.videoSearch = q.trim(); _renderVideoList(); }
function setVideoSort(sort) {
  AppState.videoSort = sort;
  localStorage.setItem('videos-sort', sort);
  _renderVideoList();
}
function toggleVideoSortDir() {
  AppState.videoSortDir = (AppState.videoSortDir === 'asc') ? 'desc' : 'asc';
  localStorage.setItem('videos-sort-dir', AppState.videoSortDir);
  _syncSortDirBtn('videos-sort-dir', AppState.videoSortDir);
  _renderVideoList();
}

function toggleVideoFilter(token) {
  const f = AppState.videoFilters;
  if (token === 'all') f.clear();
  else if (f.has(token)) f.delete(token);
  else f.add(token);
  _syncVideoFilterChips();
  _renderVideoList();
}

function _syncVideoFilterChips() {
  const f = AppState.videoFilters;
  document.querySelectorAll('[data-vfilter]').forEach(chip => {
    const token = chip.dataset.vfilter;
    const active = token === 'all' ? f.size === 0 : f.has(token);
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  _syncVideoMoreFilters();
}

// Recording filters that live inside the "More filters" expander. Mirrors
// clips.js _HIDDEN_FILTER_TOKENS / _syncMoreFilters: force the expander open
// whenever one of the filters it hides is active (and show the "filtered" dot),
// so the list is never mysteriously filtered. Only ever forced OPEN - on return
// to All / Has clips the user can collapse it again.
const _HIDDEN_VFILTER_TOKENS = ['unscored', 'errors'];
function _syncVideoMoreFilters() {
  const details = document.getElementById('video-more-filters');
  if (!details) return;
  const active = _HIDDEN_VFILTER_TOKENS.some(t => AppState.videoFilters.has(t));
  if (active) details.open = true;
  const flag = details.querySelector('[data-more-flag]');
  if (flag) flag.hidden = !active;
}

function _clearVideoFilters() {
  AppState.videoFilters.clear();
  AppState.videoSearch = '';
  const searchEl = document.getElementById('video-search-input');
  if (searchEl) searchEl.value = '';
  _syncVideoFilterChips();
  _renderVideoList();
}

async function _restoreView() {
  try {
    const saved = JSON.parse(localStorage.getItem('yuuclip-view') || 'null');
    if (!saved?.videoId) return;
    if (!AppState.videos.find(v => v.id === saved.videoId)) return;
    await selectVideo(saved.videoId);
    if (saved.clipId && AppState.clips.find(c => c.id === saved.clipId)) {
      await window.selectClip(saved.clipId);
    }
  } catch {}
}

function _analyzingPlaceholderLi(filename) {
  const li = document.createElement('li');
  li.className = 'video-item analyzing-placeholder';
  li.innerHTML = `
    <div class="name" style="display:flex;align-items:center;gap:8px"><span class="spinner"></span>${escHtml(filename)}</div>
    <div class="meta" style="color:var(--accent)">Analyzing…</div>`;
  return li;
}

function _showEmptyState() {
  document.getElementById('player-area').innerHTML = '';
  document.getElementById('detail').innerHTML = `
    <div class="empty-state">
      <img class="empty-state-mascot" src="/static/gamercat.png" alt="">
      <h2>Welcome to YuuClip</h2>
      <p>Analyze a recording to start reviewing and exporting your best moments. YuuClip shines on talk-heavy sessions - RP, voice chat, streaming, podcasts, and commentary.</p>
      <button class="btn highlight" data-act="open-new-recording-panel">+ Analyze your first recording</button>
      <button class="btn ghost" data-act="open-getting-started" style="margin-top:8px">Getting Started Guide</button>
    </div>`;
}

function _updateDemoButton(approvedCount) {
  const btn = document.getElementById('btn-highlight-reels');
  btn.title = approvedCount === 0
    ? 'View existing reels or build one after approving some clips'
    : `View or build a highlight reel from ${plural(approvedCount, 'approved clip')}`;
}

function _updateStartIngestButton() {
  const btn = document.getElementById('btn-start-analyze');
  if (!btn) return;
  if (window._prereqs && !window._prereqs.ffmpeg_ok) return;
  btn.disabled = !_probedInfo;
  btn.title = _probedInfo ? '' : 'Select a valid recording file first';
}

function _clipsSortParam() {
  return document.getElementById('clips-sort').value;
}

// Canonical clip-list URL: every reload of AppState.clips goes through this so the
// active sort AND the active candidate type (Clips vs Scenes) are always applied
// together. Adding a new fetch site? Use this, never a hand-built query string.
function _clipsListUrl(videoId) {
  return `/api/videos/${videoId}/clips?sort=${_clipsSortParam()}&kind=${AppState.clipKind}`;
}

async function selectVideo(id) {
  if (window.isSplitEditorOpen()) {
    // _splitPoints is split.js's shared live-edit state, imported as a live ESM
    // binding (export let), so this always sees the current array.
    const hasSplits = _splitPoints.length > 0;
    if (hasSplits) {
      showConfirm(
        'Leave Split editor?',
        'You have unsaved split points. Switch to this recording and discard them?',
        'Discard',
        () => { window.closeSplitEditor(); selectVideo(id); },
        true,
      );
      return;
    }
    window.closeSplitEditor();
  }
  // _panelDirty is analyze.js's shared live-edit state - same bare-global
  // contract as _splitPoints above (see the comment at the top of analyze.js).
  if (window._isNewRecordingPanelOpen() && _panelDirty) {
    showConfirm(
      'Discard new recording?',
      'You have unsaved configuration. Switch to this recording anyway?',
      'Discard',
      () => { window._doCloseNewRecordingPanel(); selectVideo(id); },
      true,
    );
    return;
  }
  if (window._isNewRecordingPanelOpen()) window._doCloseNewRecordingPanel();
  AppState.activeVideoId = id;
  AppState.activeSessionId = null;
  document.querySelectorAll('#video-list li.session-header.active').forEach(l => l.classList.remove('active'));
  AppState.activeClipId  = null;
  localStorage.setItem('yuuclip-view', JSON.stringify({videoId: id, clipId: null}));
  AppState.clipFilters.clear();
  AppState.clipSearch  = '';
  AppState.clipScoreMin = 0;
  window._syncFilterChips();
  const _searchEl = document.getElementById('clip-search-input');
  if (_searchEl) _searchEl.value = '';
  const _scoreEl = document.getElementById('clip-score-min');
  if (_scoreEl) _scoreEl.value = '0';
  // Load clips and (if the boot fetch hasn't populated them yet) contexts in
  // parallel, so the detail's context chips/dropdown never render from an empty
  // list on the first video opened after load.
  const clipsPromise = fetch(_clipsListUrl(id)).then(r => r.json());
  await window.ensureContexts();
  const clips = await clipsPromise;
  // Guard against a slower earlier fetch resolving after a newer selection -
  // otherwise clicking B while A's clips are in flight renders A into B's detail.
  if (AppState.activeVideoId !== id) return;
  AppState.clips = clips;
  window._renderClips();
  const video = AppState.videos.find(v => v.id === id);
  if (video) renderVideoDetail(video, null);
  else window.clearDetail();
}

// "Imported from" line (roadmap plan 08) - shown only for a recording brought
// in via Import from URL; a recording added from a local file has no source_url.
function _renderImportedFromLine(video) {
  if (!video.source_url) return '';
  const parts = [escHtml(video.source_uploader || 'Unknown channel')];
  if (video.source_upload_date) parts.push(escHtml(video.source_upload_date));
  return `
      <div style="color:var(--muted);font-size:12px;margin-top:4px">
        Imported from ${parts.join(' &middot; ')} &middot;
        <a href="${escHtml(video.source_url)}" target="_blank" rel="noopener noreferrer">View original</a>
      </div>`;
}

function renderVideoDetail(video, savedTimeline) {
  AppState.activeVideoData = video;
  const eb = (isEdited) => isEdited ? `<span class="edited-badge">edited</span>` : '';
  document.getElementById('player-area').innerHTML =
    `<div style="position:relative">
       <video id="recording-preview-video" controls preload="metadata" aria-label="Recording preview" style="display:block;width:100%;max-height:var(--player-max-height, 42vh);object-fit:contain;background:#000"></video>
       <span id="recording-preview-badge" role="status" style="display:none;position:absolute;top:8px;left:8px;background:rgba(0,0,0,.7);color:var(--on-scrim);font-size:11px;padding:3px 8px;border-radius:4px"></span>
     </div>`;
  setupRecordingPreview(
    document.getElementById('recording-preview-video'),
    document.getElementById('recording-preview-badge'),
    video.id,
    {
      autoBuild: false,
      isCurrent: () => AppState.activeVideoId === video.id,
      startS: video.segment_start_s,
      endS: video.segment_end_s,
      sourcePath: video.source_path,
    },
  );
  document.getElementById('detail').innerHTML = `
    <div><div class="detail-type-badge video-badge">&#127916; Recording</div></div>

    <div class="detail-card">
      <div class="detail-card-header">
        <h2 style="margin:0;font-size:17px;font-weight:700" title="${escHtml(video.title || video.filename)}">${escHtml(video.title || video.filename)}${eb(video.title_is_edited)}</h2>
        <button class="kebab-btn" title="Edit or regenerate title" aria-label="Edit or regenerate title" data-act="video-title-kebab" data-video-id="${video.id}">&#8942;</button>
      </div>
      <div style="color:var(--muted);font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span>${video.duration_hms} &middot; ${video.clip_count} clips &middot; ${_msToHms(video.total_clip_ms)} clipped</span>
        ${AppState.canReveal ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" data-act="reveal-in-folder">Show in Folder</button>` : ''}
      </div>
      ${_renderImportedFromLine(video)}
    </div>

    ${_renderContextSection(video)}

    ${collapsibleCard('video-summary',
        `<span class="detail-card-title">Session Summary${eb(video.summary_is_edited)}</span>`, `
      <div id="summary-body">${video.summary
        ? `<div class="description-long">${escHtml(video.summary)}</div>`
        : `<div style="color:var(--muted);font-size:12px">No summary yet - generate a title and summary from the transcript.</div>`}</div>`,
      { actions: `${video.summary
          ? `<button class="kebab-btn" title="Edit or regenerate summary" aria-label="Edit or regenerate summary" data-act="video-summary-kebab" data-video-id="${video.id}">&#8942;</button>`
          : `<button class="btn ghost" id="btn-summarize-video" data-act="summarize-video" data-video-id="${video.id}">Generate Summary</button>`}` })}

    ${_isVideoBeingAnalyzed(video) ? _analysisLivePanelHTML() : ''}
    ${window._renderRunMetaCard(video)}

    <div class="vid-actions">
      <div class="vid-actions-row">
        <button class="btn" data-act="open-batch-export" data-video-id="${video.id}">Export Approved</button>
        <button class="btn ghost" data-act="open-video-actions" data-video-id="${video.id}">Additional Actions</button>
      </div>
    </div>

    <div id="speakers-section"></div>

    ${(video.clip_count > 0 || video.status === 'done') ? collapsibleCard('video-transcript',
        `<span class="detail-card-title">Full transcript</span>`,
      `<div id="video-transcript-view" class="transcript"></div>`,
      { defaultCollapsed: true, attrs: `id="video-transcript-details" data-video-id="${video.id}"`,
        actions: `<span style="display:flex;gap:6px">
          <button class="btn ghost" style="font-size:11px;padding:3px 9px" title="Scan the transcript for mis-heard names (e.g. &quot;You&quot; for &quot;Yuu&quot;) and fix them"
                  data-act="open-name-corrections" data-video-id="${video.id}">Fix names</button>
          <button class="btn ghost" style="font-size:11px;padding:3px 9px" title="Pick a time range to create a clip by hand"
                  data-act="open-clip-create-picker" data-video-id="${video.id}">Create clip</button>
        </span>` }) : ''}

    ${collapsibleCard('video-timeline',
        `<span class="detail-card-title">Session Timeline</span>`, `
      <div id="timeline-section">
        ${savedTimeline ? window._renderTimelineHTML(savedTimeline) : (video.has_timeline ? '' : window._timelineEmptyNoteHTML())}
      </div>`,
      { actions: `<button class="btn ghost" id="btn-generate-timeline" data-act="generate-timeline" data-video-id="${video.id}">${video.has_timeline ? 'Regenerate Timeline' : 'Generate Timeline'}</button>` })}`;

  if (window.loadSpeakers) window.loadSpeakers(video.id);
  if (window.reloadVideoTranscriptIfOpen) window.reloadVideoTranscriptIfOpen(video.id);
  _syncAnalysisLivePanel();

  if (!savedTimeline && video.has_timeline) {
    fetch(`/api/videos/${video.id}`)
      .then(r => r.json())
      .then(v => {
        if (v.timeline && v.timeline.length) {
          document.getElementById('timeline-section').innerHTML = window._renderTimelineHTML(v.timeline);
        }
      })
      .catch(() => {});
  }
}

function openVideoActionsModal(videoId) {
  const video = AppState.activeVideoData?.id === videoId ? AppState.activeVideoData : AppState.videos.find(v => v.id === videoId);
  if (!video) return;
  const isSegment = video.parent_video_id != null;

  const groups = [
    { heading: 'Review', rows: [
      { label: 'Approve Above Score', description: 'Automatically approve every clip in this recording above a score threshold you choose.', action: () => window.openAutoApproveModal(videoId) },
    ]},
    { heading: 'Regenerate', rows: [
      { label: 'Re-score All Clips', description: 'Regenerate scores and descriptions for every clip in this recording.', action: () => window.rescoreAllClips(videoId, document.createElement('button')) },
      { label: 'Re-describe All Clips', description: 'Regenerate descriptions only - scores are kept as-is.', action: () => window.redescribeAllClips(videoId, document.createElement('button')) },
      { label: 'Re-detect Speakers', description: 'Re-run speaker detection on the existing transcript. Clips and scores are kept; named speakers re-attach to matching voices.', action: () => rediarizeVideo(videoId) },
      { label: 'Re-transcribe Recording', description: 'Re-run speech-to-text for the whole recording. Clips are kept but flagged for a re-score; regenerate clips to rebuild them from the new transcript.', action: () => retranscribeVideoRun(videoId) },
      { label: 'Re-extract Audio', description: 'Rebuild the audio tracks from the source file, e.g. after changing the track layout. Re-transcribe afterward to update the transcript.', action: () => reextractVideoRun(videoId) },
      ...(window.hasEnabledSemanticHotwords() ? [
        { label: 'Scan for Hot-words', description: 'Check every clip against your "Meaning" hot-words using the Similarity engine.', action: () => window.confirmScanHotwordsForVideo(videoId, document.createElement('button')) },
      ] : []),
    ]},
    { heading: 'Recording tools', rows: [
      ...(isSegment ? [] : [
        { label: 'Split Recording', description: 'Break this recording into segments that can be analyzed independently.', action: () => window.openSplitEditor(videoId) },
      ]),
      ...(isSegment ? [
        { label: 'Undo Split', description: 'Merge this segment and its siblings back into the original recording, keeping all of their clips.', action: () => unsplitVideo(videoId) },
      ] : []),
      { label: 'Save Captions to SRT', description: 'Write the transcript as an SRT caption file next to the source recording.', action: () => exportVideoTranscript(videoId) },
    ]},
    { heading: 'Danger Zone', rows: [
      { label: 'Regenerate Clips', description: 'Rebuild clips from the existing transcript. Replaces every clip - discarding approvals, edits, tags, and scores - with fresh, unscored candidates. Skips re-transcription.', danger: true, action: () => regenerateClipsRun(videoId) },
      { label: 'Re-analyze (full)', description: 'Re-run the entire pipeline from scratch. Replaces all clips, scores, and speakers for this recording.', danger: true, action: () => reanalyzeVideo(videoId) },
      { label: 'Reset Approvals', description: 'Clear the approve/reject status on every clip in this recording.', danger: true, action: () => window.resetApprovals(videoId) },
      { label: 'Remove Recording', description: 'Remove this recording from YuuClip. The source file on disk is not deleted.', danger: true, action: () => deleteVideo(videoId) },
    ]},
  ];

  openActionsModal(`${video.title || video.filename} - Additional Actions`, groups);
}

// ── recording removal + transcript export ─────────────────────────────────────
async function exportVideoTranscript(id, btn) {
  await _doExportVideoTranscript(id, btn, false);
}

async function _doExportVideoTranscript(id, btn, overwrite) {
  if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }
  try {
    const res = await fetch(`/api/videos/${id}/export-transcript?overwrite=${overwrite}`, {method: 'POST'});
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.exists) {
      showConfirm(
        'Overwrite existing captions?',
        `An SRT file already exists at:<br><code>${escHtml(data.path)}</code><br><br>Overwrite it with the current transcript?`,
        'Overwrite',
        () => _doExportVideoTranscript(id, btn, true),
        true,
      );
      return;
    }
    if (!res.ok) throw new Error(formatApiError(data));
    showToast(`Captions exported → ${data.path}`);
  } catch (err) {
    showToast(`Export failed: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Captions to SRT'; }
  }
}

function deleteVideo(id) {
  const video = AppState.videos.find(v => v.id === id);
  const name  = video ? video.filename : `recording ${id}`;
  showConfirm(
    'Remove recording?',
    `Remove <strong>${escHtml(name)}</strong> from YuuClip?<br><br>` +
    `All clips, transcripts, and extracted audio are removed from the database. ` +
    `Your source recording file is <strong>not</strong> deleted.`,
    'Remove',
    () => _doDeleteVideo(id, name),
    true,
  );
}

async function _doDeleteVideo(id, name) {
  // Release the player so its backing export/preview file isn't locked during delete.
  if (AppState.activeVideoId === id) await window._releasePlayerBeforeDelete();
  const delRes = await fetch(`/api/videos/${id}`, {method: 'DELETE'});
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    showToast(`Failed to remove recording: ${formatApiError(err)}`, 'error');
    if (AppState.activeClipId) window.selectClip(AppState.activeClipId);
    return;
  }
  if (AppState.activeVideoId === id) {
    AppState.activeVideoId = null;
    AppState.activeClipId  = null;
    document.getElementById('clip-list').innerHTML = '';
    window.clearDetail();
  }
  await loadVideos();
  showToast(`"${name}" removed from YuuClip`);
}

// ── live analysis progress (in-detail) ────────────────────────────────────────
// A recording is "being analyzed" when it matches the filename of the active
// analyze job (AppState.analyzeFilename, set on start/reattach) and hasn't yet
// reached 'done'. Same rule the sidebar uses for its spinner.
function _isVideoBeingAnalyzed(video) {
  return !!AppState.analyzeFilename
    && video.filename === AppState.analyzeFilename
    && video.status !== 'done';
}

function _analysisLivePanelHTML() {
  return `
    <div class="detail-card analysis-live" id="analysis-live-panel">
      <div class="detail-card-header">
        <span class="detail-card-title"><span class="spinner"></span> Analysis in progress</span>
        <span style="display:flex;align-items:center;gap:10px">
          <span class="muted" id="analysis-live-elapsed" style="font-size:12px"></span>
          <button class="btn ghost" data-act="cancel-job" style="font-size:12px;padding:2px 10px">Cancel</button>
        </span>
      </div>
      <div id="analysis-live-steps" class="job-steps-detail"></div>
      <div class="muted" style="font-size:11px;margin-top:8px">Runs in the background - you can leave or refresh this page without interrupting it.</div>
    </div>`;
}

// Mirror the header progress bar's step state into the in-detail panel. Driven by
// the analyze SSE stream (updateJobUI / _tickJobTimer in jobs.js). The job-step
// state is imported from jobs.js as live ESM bindings (they reflect jobs.js's
// reassignments); elapsed uses the server-side analyze_started_at so it stays
// accurate across a refresh (unlike the header pill, which restarts at 0).
function _syncAnalysisLivePanel() {
  const stepsEl = document.getElementById('analysis-live-steps');
  if (!stepsEl) return;
  stepsEl.innerHTML = _jobStepDefs.map((step, i) => {
    const cls = i < _activeStepIdx ? 'done' : i === _activeStepIdx ? 'active' : '';
    if (i !== _activeStepIdx) return `<span class="step ${cls}">${escHtml(step.label)}</span>`;
    // Active step mirrors the header pill: live label + the same two-tone fill.
    const {text, pct} = _stepPillLabel(i);
    const fill = pct != null
      ? ` style="background-image:linear-gradient(to right, var(--green) ${pct}%, var(--accent) ${pct}%)"`
      : '';
    return `<span class="step ${cls}"${fill}>${escHtml(text)}</span>`;
  }).join('');

  const elapsedEl = document.getElementById('analysis-live-elapsed');
  if (elapsedEl) {
    const startIso = AppState.activeVideoData && AppState.activeVideoData.analyze_started_at;
    const startMs  = startIso ? _parseServerDate(startIso).getTime() : _jobStartTime;
    elapsedEl.textContent = _fmtElapsed(Date.now() - startMs);
  }
}

function _renderContextSection(video) {
  const assigned = video.context_names || [];
  const chips = assigned.map(context_id => {
    const ctx = AppState.contexts.find(c => c.context_id === context_id);
    const name = ctx ? ctx.display_name : context_id;
    return `<span class="context-chip">${escHtml(name)}<button class="chip-x" data-rmctx="${escHtml(context_id)}" title="Remove" aria-label="Remove ${escHtml(name)}">×</button></span>`;
  });

  const available = AppState.contexts.filter(c => !assigned.includes(c.context_id));
  const addSelect = available.length
    ? `<select style="font-size:11px;padding:3px 7px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--muted);cursor:pointer"
              data-act="add-video-context" data-video-id="${video.id}">
        <option value="">+ Add</option>
        ${available.map(c => `<option value="${escHtml(c.context_id)}">${escHtml(c.display_name || c.context_id)}</option>`).join('')}
       </select>` : '';

  const provLines = [];
  if (video.clips_scored_at) {
    const scoredCtx = video.clips_scored_context || [];
    const stale = JSON.stringify([...assigned].sort()) !== JSON.stringify([...scoredCtx].sort());
    const when = _fmtDate(video.clips_scored_at);
    const ctxNames = scoredCtx.map(s => { const c = AppState.contexts.find(x => x.context_id === s); return c ? c.display_name : s; });
    const ctxStr = ctxNames.length ? ' · ' + ctxNames.map(escHtml).join(', ') : ' · no context';
    provLines.push(`<span class="${stale ? 'provenance-stale' : ''}">Clips scored ${escHtml(when)}${ctxStr}${stale ? ' - ⚠ contexts changed since last score' : ''}</span>`);
  }
  if (video.analyze_run) provLines.push(`<span>${escHtml(window._runTimingLine(video.analyze_run))}</span>`);

  const noContextsDefined = AppState.contexts.length === 0;
  const emptyMsg = noContextsDefined
    ? `<span style="color:var(--muted);font-size:12px">No contexts defined - <button class="btn ghost" style="padding:0;display:inline;font-size:12px" data-act="open-context-manager">create one</button></span>`
    : (!assigned.length ? `<span style="color:var(--muted);font-size:12px">None assigned</span>` : '');

  const rescoreBtn = (assigned.length && video.clips_scored_at)
    ? `<button class="btn" style="font-size:12px;padding:4px 12px" data-act="rescore-clips" data-video-id="${video.id}">Re-score clips with context</button>`
    : assigned.length
    ? `<button class="btn" style="font-size:12px;padding:4px 12px" data-act="rescore-clips" data-video-id="${video.id}">Score clips with context</button>`
    : '';

  const errCount = video.clips_llm_error || 0;
  // Only offer the retry when a model can actually run - otherwise re-scoring the
  // "failed" clips just fails again. With no model these aren't failures, they're
  // clips awaiting a first-run model (surfaced by the description prompt instead).
  const failedBtn = (errCount > 0 && !!(window._prereqs || {}).llm_ok)
    ? `<button class="btn" style="font-size:12px;padding:4px 12px;border-color:var(--warning);color:var(--warning)" data-act="rescore-failed-clips" data-video-id="${video.id}" title="Re-run LLM scoring only for the ${plural(errCount, 'clip')} that failed last time">&#9888; Re-score ${plural(errCount, 'failed clip')}</button>`
    : '';

  return collapsibleCard('video-contexts',
    `<span class="detail-card-title">World Contexts</span>`, `
      <div class="context-chips">
        ${chips.join('')}${emptyMsg}${addSelect ? '&nbsp;' + addSelect : ''}
      </div>
      ${provLines.length ? `<div class="provenance-note">${provLines.join('<br>')}</div>` : ''}
      ${(rescoreBtn || failedBtn) ? `<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">${rescoreBtn}${failedBtn}</div>` : ''}`);
}

// Friendly empty state for the AI summary/timeline features when no language model is
// installed - the backend returns a needs_model payload instead of a hard error, and
// this renders it as an inviting "install a local model" call to action. The install
// nudge is hidden when the payload asks for it (Stage 07 privacy mode).
function _needsModelCtaHTML(payload) {
  const cta = payload.show_cta === false ? '' :
    `<button class="btn ghost" style="font-size:11px;padding:3px 9px"
       data-act="install-local-model">Install a local model</button>`;
  return `<div class="needs-model-cta">
    <div class="needs-model-heading">${escHtml(payload.heading)}</div>
    <div class="needs-model-detail">${escHtml(payload.detail)}</div>
    ${cta}
  </div>`;
}

async function _refreshVideoDetail(videoId) {
  await loadVideos();
  const updated = AppState.videos.find(x => x.id === videoId);
  if (updated) renderVideoDetail(updated, null);
}

// ── re-analysis ───────────────────────────────────────────────────────────────
// Two ways to re-run analysis on an already-analyzed recording:
//   reanalyzeVideo  - full pipeline with --force (destructive: replaces clips/scores).
//   rediarizeVideo  - speaker detection only (non-destructive: keeps clips/scores).
// Opens the New Recording panel in re-analyze mode: settings default to this
// recording's original run but stay editable, and the destructive warning plus
// the explicit "Re-analyze" button stand in for the old confirm dialog.
function reanalyzeVideo(id) {
  if (_blockedByAnalyze('re-analyze this recording')) return;
  const video = AppState.videos.find(v => v.id === id);
  if (!video) return;
  window.openReanalyzePanel(video);
}

// Rebuild an analyze request the way the recording was originally analyzed
// (Video.analyze_run.settings), falling back to the Settings-managed config
// defaults when no run was recorded. Shared by re-analyze (full) here and the
// split re-analyze flow in split.js.
async function _reanalyzeParams(video) {
  const currentContexts = (video && video.context_names) || [];
  const recorded = video && video.analyze_run && video.analyze_run.settings;
  if (recorded && recorded.model) {
    return {
      model:         recorded.model,
      profile:       recorded.track_layout && recorded.track_layout !== 'default' ? recorded.track_layout : null,
      energy_mode:   recorded.energy_mode || 'fast',
      scene_mode:    recorded.scene_mode || 'fast',
      diarize:       typeof recorded.speaker_labels === 'boolean' ? recorded.speaker_labels : null,
      context_names: currentContexts.length ? currentContexts : (recorded.contexts || []),
    };
  }
  let cfg = {};
  try { cfg = await fetch('/api/config').then(r => r.json()); } catch { /* keep static fallbacks */ }
  return {
    model:         cfg.whisper_model || 'base',
    profile:       null,
    energy_mode:   cfg.energy_mode || 'fast',
    scene_mode:    cfg.scene_detection_mode || 'fast',
    diarize:       null,
    context_names: currentContexts,
  };
}

function rediarizeVideo(id) {
  if (_blockedByAnalyze('re-detect speakers')) return;
  const video = AppState.videos.find(v => v.id === id);
  const name = video ? video.filename : id;
  openLog();
  appendLog(`Re-detecting speakers: ${name}`);
  streamSSE(
    `/api/videos/${id}/rediarize`,
    async () => {
      await loadVideos();
      const v = AppState.videos.find(x => x.id === id);
      if (v && AppState.activeVideoId === id) renderVideoDetail(v, null);
      if (window.loadSpeakers) window.loadSpeakers(id);
      showToast('Speaker detection complete');
      window.SoundFx.play('analysis');
    },
    [{label: 'Speakers', patterns: ['Detecting speakers']}],
    'Re-detecting speakers',
    false,
  );
}

// ── single-stage re-runs ──────────────────────────────────────────────────────
// Re-run one pipeline stage without paying for the earlier ones. Downstream results
// are marked stale (via the existing "captions changed" / unscored badges) rather than
// cascaded - the user chooses when to re-score / regenerate.
function reextractVideoRun(id) {
  if (_blockedByAnalyze('re-extract audio')) return;
  const video = AppState.videos.find(v => v.id === id);
  const name = video ? video.filename : id;
  openLog();
  appendLog(`Re-extracting audio: ${name}`);
  streamSSE(
    `/api/videos/${id}/reextract`,
    async () => {
      await loadVideos();
      const v = AppState.videos.find(x => x.id === id);
      if (v && AppState.activeVideoId === id) renderVideoDetail(v, null);
      showToast('Audio re-extracted - re-transcribe to update the transcript');
      window.SoundFx.play('analysis');
    },
    [{label: 'Extract', patterns: ['Extracting audio']}],
    'Re-extracting audio',
    false,
  );
}

function retranscribeVideoRun(id) {
  if (_blockedByAnalyze('re-transcribe this recording')) return;
  const video = AppState.videos.find(v => v.id === id);
  const name = video ? video.filename : id;
  openLog();
  appendLog(`Re-transcribing: ${name}`);
  streamSSE(
    `/api/videos/${id}/retranscribe`,
    async () => {
      await loadVideos();
      if (AppState.activeVideoId === id) await selectVideo(id);
      showToast('Re-transcription complete - re-score to refresh clip scores');
      window.SoundFx.play('analysis');
    },
    [{label: 'Extract', patterns: ['Extracting audio']}, {label: 'Transcribe', patterns: ['Transcribing']}],
    'Re-transcribing',
    false,
  );
}

function regenerateClipsRun(id) {
  if (_blockedByAnalyze('regenerate clips')) return;
  const video = AppState.videos.find(v => v.id === id);
  const name = video ? video.filename : id;
  showConfirm(
    'Regenerate clips?',
    'This rebuilds every clip from the current transcript, discarding all approvals, edits, tags, and scores on this recording\'s existing clips. The transcript itself is kept. Re-score afterward to populate the new clips.',
    'Regenerate Clips',
    () => {
      openLog();
      appendLog(`Regenerating clips: ${name}`);
      streamSSE(
        `/api/videos/${id}/regenerate-clips`,
        async () => {
          await loadVideos();
          if (AppState.activeVideoId === id) await selectVideo(id);
          showToast('Clips regenerated - re-score to populate scores');
          window.SoundFx.play('analysis');
        },
        [{label: 'Generate Clips', patterns: ['Generating clips']}],
        'Regenerating clips',
        false,
      );
    },
    true,
  );
}

// ── undo split ────────────────────────────────────────────────────────────────
function unsplitVideo(videoId) {
  const video = AppState.videos.find(v => v.id === videoId);
  if (!video || video.parent_video_id == null) return;
  const siblings  = AppState.videos.filter(v => v.parent_video_id === video.parent_video_id);
  const clipTotal = siblings.reduce((sum, v) => sum + (v.clip_count || 0), 0);
  showConfirm(
    'Undo split?',
    `This merges ${plural(siblings.length, 'segment')} - and ${plural(clipTotal, 'clip')} on them - ` +
    `back into the original recording, restoring each clip's original timing. ` +
    `The segments are removed and the original recording becomes visible again.`,
    'Undo Split',
    () => _doUnsplitVideo(videoId),
    true,
  );
}

async function _doUnsplitVideo(videoId) {
  let res;
  try {
    res = await fetch(`/api/videos/${videoId}/unsplit`, {method: 'POST'});
  } catch (err) {
    showToast(netErrMsg(err), 'error');
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(`Undo split failed: ${formatApiError(err)}`, 'error');
    return;
  }
  const data = await res.json();
  showToast(`Split undone - ${plural(data.merged_clips, 'clip')} restored to the original recording`);
  await loadVideos();
  selectVideo(data.parent_id);
}

function _openVideoFieldKebab(videoId, btn, field) {
  const video      = AppState.activeVideoData;
  const isTitle    = field === 'title';
  const editTitle  = isTitle ? 'Edit Title'   : 'Edit Summary';
  const revertTitle = isTitle ? 'Revert Title' : 'Revert Summary';
  const diffLabel  = isTitle ? 'Title'         : 'Summary';
  const current    = isTitle ? video?.title    : video?.summary;
  const isEdited   = isTitle ? video?.title_is_edited   : video?.summary_is_edited;
  const original   = isTitle ? video?.title_original    : video?.summary_original;

  const items = [
    { label: 'Edit', action: () =>
      openFieldEditModal(editTitle, current || '', async v => {
        await _patchVideoField(videoId, 'accept_edit', field,
          isTitle ? v : null, isTitle ? null : v);
        await _refreshVideoDetail(videoId);
      })
    },
  ];
  if (isEdited) {
    items.push({ label: 'Revert to Original', action: () =>
      openDiffModal(revertTitle, [
        {label: diffLabel, current, proposed: original},
      ], async () => {
        await _patchVideoField(videoId, 'revert', field, null, null);
        await _refreshVideoDetail(videoId);
      }, {revertMode: true})
    });
  }
  items.push(null, { label: 'Regenerate', action: () => window.summarizeVideo(videoId, null) });
  if (!isTitle) items.push({ label: 'Regenerate (auto-save)', action: () => window.regenSummaryAuto(videoId, null) });
  showKebab(btn, items);
}

function openVideoTitleKebab(videoId, btn)   { _openVideoFieldKebab(videoId, btn, 'title'); }
function openVideoSummaryKebab(videoId, btn) { _openVideoFieldKebab(videoId, btn, 'summary'); }

async function _patchVideoField(videoId, action, field, newTitle, newSummary) {
  const res = await fetch(`/api/videos/${videoId}/fields`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action, field, new_title: newTitle, new_summary: newSummary}),
  });
  if (!res.ok) showToast('Save failed', 'error');
}

async function onClipsSortChange() {
  if (!AppState.activeVideoId) return;
  localStorage.setItem('clips-sort', _clipsSortParam());
  try {
    AppState.clips = await fetch(_clipsListUrl(AppState.activeVideoId)).then(r => r.json());
  } catch { return; }
  window._renderClips();
}

// ── in-detail action delegation ─────────────────────────────────────────────
// #detail's innerHTML is rebuilt wholesale by renderVideoDetail/_showEmptyState
// (and by other modules' code that also targets #detail, e.g. clips.js's clip
// detail view), so the click/change listeners are wired once on the container
// itself - see the addEventListener calls at the bottom of this file - rather
// than re-attached per render. The container node persists across every render;
// only its children are replaced.
function _handleDetailClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const videoId = el.dataset.videoId != null ? parseInt(el.dataset.videoId) : null;
  switch (act) {
    case 'open-new-recording-panel': window.openNewRecordingPanel(); break;
    case 'open-getting-started': openGettingStartedModal(); break;
    case 'video-title-kebab': openVideoTitleKebab(videoId, el); break;
    case 'video-summary-kebab': openVideoSummaryKebab(videoId, el); break;
    case 'summarize-video': window.summarizeVideo(videoId, el); break;
    case 'reveal-in-folder': revealInFolder(AppState.activeVideoData.path); break;
    case 'open-batch-export': window.openBatchExportModal(videoId); break;
    case 'open-video-actions': openVideoActionsModal(videoId); break;
    case 'open-name-corrections': window.openNameCorrections(videoId); break;
    case 'open-clip-create-picker': window.openClipCreatePicker(videoId); break;
    case 'generate-timeline': window.generateTimeline(videoId); break;
    case 'cancel-job': cancelJob(); break;
    case 'open-context-manager': window.openContextManager(); break;
    case 'rescore-clips': window.rescoreClips(videoId, el); break;
    case 'rescore-failed-clips': window.rescoreFailedClips(videoId, el); break;
    case 'install-local-model':
      window.openSettings();
      setTimeout(() => window._scrollToSettingsSection('settings-sec-llm'), 120);
      break;
  }
}

function _handleDetailChange(e) {
  const el = e.target.closest('[data-act="add-video-context"]');
  if (!el) return;
  const videoId = parseInt(el.dataset.videoId);
  window.addVideoContext(videoId, el.value);
  el.value = '';
}

// Public API - symbols with a classic (bundle.js) consumer, an inline handler in
// index.html's static markup, or a tests/ui/*.py page.evaluate. Internal helpers
// (re-analyze/re-run actions, the two kebab openers, etc.) stay module-private -
// see main.esm.js for what each surviving name here still needs it for.
export {
  loadVideos, selectVideo, renderVideoDetail, deleteVideo,
  onClipsSortChange, _clipsSortParam, _clipsListUrl,
  _reanalyzeParams,
  _needsModelCtaHTML,
  _updateDemoButton, _updateStartIngestButton,
  _analysisLivePanelHTML, _syncAnalysisLivePanel,
  _applyVideoFilters, _renderVideoList,
  setVideoSearch, setVideoSort, toggleVideoSortDir, toggleVideoFilter,
  openVideoActionsModal,
};

document.getElementById('detail').addEventListener('click', _handleDetailClick);
document.getElementById('detail').addEventListener('change', _handleDetailChange);
