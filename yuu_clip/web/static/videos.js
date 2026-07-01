(function () {
// ── videos ────────────────────────────────────────────────────────────────────
async function loadVideos() {
  let videos;
  try {
    const res = await fetch('/api/videos');
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    videos = await res.json();
  } catch (err) {
    document.getElementById('video-list').innerHTML =
      `<li style="padding:10px 14px;color:var(--red)">Failed to load videos: ${escHtml(String(err.message || err))}</li>`;
    return;
  }
  AppState.videos = videos;

  const list = document.getElementById('video-list');
  list.innerHTML = '';

  // While a brand-new recording is analyzing, show it in the sidebar right away —
  // before its DB row exists — so the user gets immediate feedback. Suppressed
  // once the real row appears (matched by filename).
  const analyzingName = AppState.analyzeFilename;
  const showPlaceholder = analyzingName && !videos.some(v => v.filename === analyzingName);

  if (!videos.length && !showPlaceholder) {
    list.innerHTML = '<li style="padding:10px 14px;color:var(--muted)">No videos yet</li>';
    _showEmptyState();
    _updateDemoButton(0);
    return;
  }

  if (showPlaceholder) list.appendChild(_analyzingPlaceholderLi(analyzingName));

  for (const v of videos) {
    const isAnalyzing = v.filename === analyzingName && v.status !== 'done';
    const li = document.createElement('li');
    li.className = 'video-item'
      + (v.id === AppState.activeVideoId ? ' active' : '')
      + (isAnalyzing ? ' analyzing' : '');
    li.dataset.videoId = v.id;
    li.tabIndex = 0;
    const clipsPct = v.duration_ms > 0
      ? ` (${Math.round(v.total_clip_ms / v.duration_ms * 100)}%)`
      : '';
    const scoreBar = (v.score_min !== null && v.score_max !== null && v.clip_count > 0)
      ? `<div class="meta">Scores: ${v.score_min.toFixed(2)} – ${v.score_max.toFixed(2)}</div>`
      : '';
    const procBadges = [
      v.summarized_at   ? '' : '<span style="font-size:10px;color:var(--muted)" title="No summary yet">– no summary</span>',
      v.clips_scored_at ? '' : '<span style="font-size:10px;color:var(--muted)" title="Not scored yet">– unscored</span>',
      v.has_timeline    ? '' : '<span style="font-size:10px;color:var(--muted)" title="No timeline yet">– no timeline</span>',
    ].filter(Boolean).join(' &middot; ');
    const segmentMeta = (v.segment_start_s != null && v.segment_end_s != null)
      ? `<div class="meta" style="color:var(--accent2)">${_msToHms(v.segment_start_s * 1000)} – ${_msToHms(v.segment_end_s * 1000)}</div>`
      : '';
    const errCount = v.clips_llm_error || 0;
    const errBadge = errCount > 0
      ? `<div class="meta" style="margin-top:2px;color:var(--amber)" title="LLM scoring failed for ${errCount} clip${errCount !== 1 ? 's' : ''} — re-score to retry">&#9888; ${errCount} scoring error${errCount !== 1 ? 's' : ''}</div>`
      : '';
    li.innerHTML = `
      <div class="name" title="${v.title ? escHtml(v.filename) : ''}">${escHtml(v.title || v.filename)}</div>
      ${v.title ? `<div class="video-title">${escHtml(v.filename)}</div>` : ''}
      ${segmentMeta}
      <div class="meta">${v.duration_hms} &middot; ${v.clip_count} clips &middot; ${_msToHms(v.total_clip_ms)} clipped${clipsPct}</div>
      <div class="meta">${isAnalyzing
        ? `<span class="spinner" style="display:inline-block;vertical-align:middle"></span> <span style="color:var(--accent)">${escHtml(_fmtVideoStatus(v.status))}…</span>`
        : `${v.approved} approved &middot; ${v.exported} exported &middot; ${_fmtVideoStatus(v.status)}`}</div>
      ${procBadges ? `<div class="meta" style="margin-top:2px">${procBadges}</div>` : ''}
      ${errBadge}
      ${scoreBar}`;
    list.appendChild(li);
  }

  const _handleVideoListActivate = e => {
    const li = e.target.closest('li[data-video-id]');
    if (!li) return;
    document.querySelectorAll('#video-list li').forEach(l => l.classList.remove('active'));
    li.classList.add('active');
    selectVideo(parseInt(li.dataset.videoId));
  };
  list.onclick = _handleVideoListActivate;
  list.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _handleVideoListActivate(e); } };

  const totalApproved = videos.reduce((n, v) => n + v.approved, 0);
  _updateDemoButton(totalApproved);

  if (!AppState.bootRestoreDone) {
    AppState.bootRestoreDone = true;
    _restoreView();
  }
}

async function _restoreView() {
  try {
    const saved = JSON.parse(localStorage.getItem('yuuclip-view') || 'null');
    if (!saved?.videoId) return;
    if (!AppState.videos.find(v => v.id === saved.videoId)) return;
    await selectVideo(saved.videoId);
    if (saved.clipId && AppState.clips.find(c => c.id === saved.clipId)) {
      await selectClip(saved.clipId);
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
      <h2>Welcome to yuu-clip</h2>
      <p>Analyze a recording to start reviewing and exporting your best gaming moments.</p>
      <button class="btn primary" onclick="openNewRecordingPanel()">+ Analyze your first recording</button>
      <button class="btn ghost" onclick="openGettingStartedModal()" style="margin-top:8px">Getting Started Guide</button>
    </div>`;
}

function _updateDemoButton(approvedCount) {
  const btn = document.getElementById('btn-highlight-reels');
  btn.title = approvedCount === 0
    ? 'View existing reels or build one after approving some clips'
    : `View or build a highlight reel from ${approvedCount} approved clip(s)`;
}

function _updateStartIngestButton() {
  const btn = document.getElementById('btn-start-analyze');
  if (!btn) return;
  if (window._prereqs && !window._prereqs.ffmpeg_ok) return;
  btn.disabled = !_probedInfo;
  btn.title = _probedInfo ? '' : 'Select a valid video file first';
}

function _clipsSortParam() {
  return document.getElementById('clips-sort').value;
}

async function selectVideo(id) {
  if (isSplitEditorOpen()) {
    const hasSplits = typeof _splitPoints !== 'undefined' && _splitPoints.length > 0;
    if (hasSplits) {
      showConfirm(
        'Leave Split editor?',
        'You have unsaved split points. Switch to this recording and discard them?',
        'Discard',
        () => { closeSplitEditor(); selectVideo(id); },
        true,
      );
      return;
    }
    closeSplitEditor();
  }
  if (_isNewRecordingPanelOpen() && _panelDirty) {
    showConfirm(
      'Discard new recording?',
      'You have unsaved configuration. Switch to this recording anyway?',
      'Discard',
      () => { _doCloseNewRecordingPanel(); selectVideo(id); },
      true,
    );
    return;
  }
  if (_isNewRecordingPanelOpen()) _doCloseNewRecordingPanel();
  AppState.activeVideoId = id;
  AppState.activeClipId  = null;
  localStorage.setItem('yuuclip-view', JSON.stringify({videoId: id, clipId: null}));
  AppState.clipFilter  = 'all';
  AppState.clipSearch  = '';
  AppState.clipScoreMin = 0;
  document.querySelectorAll('.clip-tab').forEach(t => {
    const active = t.dataset.filter === 'all';
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const _searchEl = document.getElementById('clip-search-input');
  if (_searchEl) _searchEl.value = '';
  const _scoreEl = document.getElementById('clip-score-min');
  if (_scoreEl) _scoreEl.value = '0';
  AppState.clips = await fetch(`/api/videos/${id}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
  _renderClips();
  const video = AppState.videos.find(v => v.id === id);
  if (video) renderVideoDetail(video, null);
  else clearDetail();
}

function renderVideoDetail(video, savedTimeline) {
  AppState.activeVideoData = video;
  const eb = (isEdited) => isEdited ? `<span class="edited-badge">edited</span>` : '';
  document.getElementById('player-area').innerHTML =
    `<video controls preload="metadata" src="/api/videos/${video.id}/source" aria-label="Recording preview" style="display:block;width:100%;max-height:var(--player-max-height, 42vh);object-fit:contain;background:#000"></video>`;
  document.getElementById('detail').innerHTML = `
    <div>
      <div class="detail-type-badge video-badge" style="margin-bottom:8px">&#127916; Video</div>
      <div class="video-detail-header">
        <div style="color:var(--muted);font-size:13px;margin-top:4px">${video.duration_hms} &middot; ${video.clip_count} clips &middot; ${_msToHms(video.total_clip_ms)} clipped</div>
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-card-header">
        <h2 style="margin:0;font-size:17px;font-weight:700" title="${escHtml(video.title || video.filename)}">${escHtml(video.title || video.filename)}${eb(video.title_is_edited)}</h2>
        ${video.title ? `<button class="kebab-btn" title="Edit or regenerate title" aria-label="Edit or regenerate title" onclick="openVideoTitleKebab(${video.id}, this)">&#8942;</button>` : ''}
      </div>
      ${_renderContextSection(video)}
    </div>

    ${video.summary ? `
      <div class="detail-card">
        <div class="detail-card-header">
          <span class="detail-card-title">Session Summary${eb(video.summary_is_edited)}</span>
          <button class="kebab-btn" title="Edit or regenerate summary" aria-label="Edit or regenerate summary" onclick="openVideoSummaryKebab(${video.id}, this)">&#8942;</button>
        </div>
        <div class="description-long">${escHtml(video.summary)}</div>
      </div>` : ''}

    ${_isVideoBeingAnalyzed(video) ? _analysisLivePanelHTML() : ''}
    ${_renderRunMetaCard(video)}

    <div class="vid-actions">
      <div class="vid-actions-row">
        <button class="btn" id="btn-summarize-video" onclick="summarizeVideo(${video.id}, this)">${video.summary ? 'Regenerate Summary' : 'Generate Summary'}</button>
        <button class="btn" id="btn-generate-timeline" onclick="generateTimeline(${video.id})">${video.has_timeline ? 'Regenerate Timeline' : 'Generate Timeline'}</button>
      </div>
      <div class="vid-actions-row">
        <button class="btn" onclick="openBatchExportModal(${video.id})">Export Approved</button>
        <button class="btn ghost" onclick="openVideoActionsModal(${video.id})">Additional Actions</button>
      </div>
    </div>

    <div id="speakers-section"></div>

    ${(video.clip_count > 0 || video.status === 'done') ? `
    <details id="video-transcript-details" class="transcript-details" data-video-id="${video.id}">
      <summary class="transcript-summary">Full transcript</summary>
      <div id="video-transcript-view" class="transcript"></div>
    </details>` : ''}

    <div id="timeline-section">
      ${savedTimeline ? _renderTimelineHTML(savedTimeline) : ''}
    </div>`;

  if (window.loadSpeakers) loadSpeakers(video.id);
  _syncAnalysisLivePanel();

  if (!savedTimeline && video.has_timeline) {
    fetch(`/api/videos/${video.id}`)
      .then(r => r.json())
      .then(v => {
        if (v.timeline && v.timeline.length) {
          document.getElementById('timeline-section').innerHTML = _renderTimelineHTML(v.timeline);
        }
      })
      .catch(() => {});
  }
}

function openVideoActionsModal(videoId) {
  const video = AppState.activeVideoData?.id === videoId ? AppState.activeVideoData : AppState.videos.find(v => v.id === videoId);
  if (!video) return;

  const groups = [
    { heading: 'Review', rows: [
      { label: 'Approve Above Score', description: 'Automatically approve every clip in this recording above a score threshold you choose.', action: () => openAutoApproveModal(videoId) },
    ]},
    { heading: 'Regenerate', rows: [
      { label: 'Re-score All Clips', description: 'Regenerate scores and descriptions for every clip in this recording.', action: () => rescoreAllClips(videoId, document.createElement('button')) },
      { label: 'Re-describe All Clips', description: 'Regenerate descriptions only — scores are kept as-is.', action: () => redescribeAllClips(videoId, document.createElement('button')) },
      { label: 'Re-detect Speakers', description: 'Re-run speaker detection on the existing transcript. Clips and scores are kept; named speakers re-attach to matching voices.', action: () => rediarizeVideo(videoId) },
    ]},
    { heading: 'Recording tools', rows: [
      { label: 'Split Recording', description: 'Break this recording into segments that can be analyzed independently.', action: () => openSplitEditor(videoId) },
      { label: 'Save Captions to SRT', description: 'Write the transcript as an SRT caption file next to the source recording.', action: () => exportVideoTranscript(videoId) },
    ]},
    { heading: 'Danger Zone', rows: [
      { label: 'Re-analyze (full)', description: 'Re-run the entire pipeline from scratch. Replaces all clips, scores, and speakers for this recording.', danger: true, action: () => reanalyzeVideo(videoId) },
      { label: 'Reset Approvals', description: 'Clear the approve/reject status on every clip in this recording.', danger: true, action: () => resetApprovals(videoId) },
      { label: 'Remove Recording', description: 'Remove this recording from yuu-clip. The source file on disk is not deleted.', danger: true, action: () => deleteVideo(videoId) },
    ]},
  ];

  openActionsModal(`${video.title || video.filename} — Additional Actions`, groups);
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
        <span class="muted" id="analysis-live-elapsed" style="font-size:12px"></span>
      </div>
      <div id="analysis-live-steps" class="job-steps-detail"></div>
      <div class="muted" style="font-size:11px;margin-top:8px">Runs in the background — you can leave or refresh this page without interrupting it.</div>
    </div>`;
}

// Mirror the header progress bar's step state into the in-detail panel. Driven by
// the analyze SSE stream (updateJobUI / _tickJobTimer in utils.js). Reads the
// shared job-step globals; elapsed uses the server-side analyze_started_at so it
// stays accurate across a refresh (unlike the header pill, which restarts at 0).
function _syncAnalysisLivePanel() {
  const stepsEl = document.getElementById('analysis-live-steps');
  if (!stepsEl) return;
  stepsEl.innerHTML = _jobStepDefs.map((step, i) => {
    const cls  = i < _activeStepIdx ? 'done' : i === _activeStepIdx ? 'active' : '';
    const text = i === _activeStepIdx ? _stepPillLabel(i).text : step.label;
    return `<span class="step ${cls}">${escHtml(text)}</span>`;
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
              onchange="addVideoContext(${video.id}, this.value); this.value=''">
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
    provLines.push(`<span class="${stale ? 'provenance-stale' : ''}">Clips scored ${escHtml(when)}${ctxStr}${stale ? ' — ⚠ contexts changed since last score' : ''}</span>`);
  }

  const noContextsDefined = AppState.contexts.length === 0;
  const emptyMsg = noContextsDefined
    ? `<span style="color:var(--muted);font-size:12px">No contexts defined — <button class="btn ghost" style="padding:0;display:inline;font-size:12px" onclick="openContextManager()">create one</button></span>`
    : (!assigned.length ? `<span style="color:var(--muted);font-size:12px">None assigned</span>` : '');

  const rescoreBtn = (assigned.length && video.clips_scored_at)
    ? `<button class="btn" style="font-size:12px;padding:4px 12px" onclick="rescoreClips(${video.id}, this)">Re-score clips with context</button>`
    : assigned.length
    ? `<button class="btn" style="font-size:12px;padding:4px 12px" onclick="rescoreClips(${video.id}, this)">Score clips with context</button>`
    : '';

  const errCount = video.clips_llm_error || 0;
  const failedBtn = errCount > 0
    ? `<button class="btn" style="font-size:12px;padding:4px 12px;border-color:var(--amber);color:var(--amber)" onclick="rescoreFailedClips(${video.id}, this)" title="Re-run LLM scoring only for the ${errCount} clip${errCount !== 1 ? 's' : ''} that failed last time">&#9888; Re-score ${errCount} failed clip${errCount !== 1 ? 's' : ''}</button>`
    : '';

  return `
    <div>
      <div class="section-title" style="margin-bottom:6px">World Contexts</div>
      <div class="context-chips">
        ${chips.join('')}${emptyMsg}${addSelect ? '&nbsp;' + addSelect : ''}
      </div>
      ${provLines.length ? `<div class="provenance-note">${provLines.join('<br>')}</div>` : ''}
      ${(rescoreBtn || failedBtn) ? `<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">${rescoreBtn}${failedBtn}</div>` : ''}
    </div>`;
}

function _renderTimelineHTML(entries) {
  if (!entries || !entries.length) return '';
  const rows = entries.map(e =>
    `<div class="timeline-entry">
      <div class="timeline-stamp">${escHtml(e.start_hms)}</div>
      <div class="timeline-text">${escHtml(e.text)}</div>
    </div>`
  ).join('');
  return `<div>
    <div class="section-title" style="margin-bottom:8px">Session Timeline</div>
    <div class="timeline">${rows}</div>
  </div>`;
}

// ── timeline generation ───────────────────────────────────────────────────────
let _timelineVideoId = null;
let _timelineIntervalOpener = null;

function generateTimeline(id) {
  _timelineIntervalOpener = document.activeElement;
  _timelineVideoId = id;
  const video = AppState.videos.find(v => v.id === id);
  _loadTimelineIntervalConfig().then(() => {
    updateTimelineIntervalHint(video);
    document.getElementById('timeline-interval-modal').classList.add('visible');
    setTimeout(() => document.getElementById('timeline-interval-value')?.focus(), 50);
  });
}

function closeTimelineIntervalModal() {
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
      hint.textContent = `Video is ${durMin} min — this produces 1 entry covering the whole session.`;
    } else {
      hint.textContent = `Video is ${durMin} min — produces ~${entries} entr${entries !== 1 ? 'ies' : 'y'}.`;
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
  const section = document.getElementById('timeline-section');
  const intervalLabel = intervalS >= 60
    ? `${Math.round(intervalS / 60)}-minute`
    : `${intervalS}-second`;
  section.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:4px 0">Generating timeline — entries will appear as each ${intervalLabel} window completes…</div>`;
  const btn = document.getElementById('btn-generate-timeline');
  btn.disabled = true;
  btn.textContent = 'Generating Timeline…';

  _supersedeActiveStream();
  const resetBtn = () => { btn.disabled = false; btn.textContent = 'Regenerate Timeline'; };
  let firstEntry = true;

  const handle = _openSSE(
    `/api/videos/${id}/timeline?interval_s=${intervalS}`,
    data => {
      if (firstEntry) {
        section.innerHTML = `<div class="section-title" style="margin-bottom:8px">Session Timeline</div><div class="timeline" id="timeline-list"></div>`;
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
      const video = AppState.videos.find(v => v.id === id);
      if (video) video.has_timeline = true;
      showToast('Timeline generated');
    },
    errMsg => {
      _clearActiveStream(handle);
      resetBtn();
      if (firstEntry) section.innerHTML = '';
      showToast(`Timeline generation failed — ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, resetBtn);
}

// ── video summary ─────────────────────────────────────────────────────────────
async function summarizeVideo(id, btn) {
  const actionBtn = document.getElementById('btn-summarize-video') || btn;
  if (actionBtn && actionBtn.disabled) return;
  const orig = actionBtn ? actionBtn.textContent : '';
  if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = 'Generating Summary…'; }
  try {
    const res = await fetch(`/api/videos/${id}/summarize`, {method: 'POST'});
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatApiError(err));
    }
    const data = await res.json();
    openDiffModal('Review Generated Summary', [
      {label: 'Title',   current: data.title_current,   proposed: data.title_new},
      {label: 'Summary', current: data.summary_current, proposed: data.summary_new},
    ], async (action, edited) => {
      const patch = await fetch(`/api/videos/${id}/fields`, {
        method: 'PATCH', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action, field: 'both', new_title: edited[0], new_summary: edited[1]}),
      });
      if (!patch.ok) { showToast('Save failed', 'error'); return; }
      await loadVideos();
      const video = AppState.videos.find(v => v.id === id);
      if (video) renderVideoDetail(video, null);
      showToast(action === 'accept_new' ? 'Summary accepted' : 'Summary saved as edit');
    });
  } catch (err) {
    showToast(`Summary failed: ${err.message}`, 'error');
  } finally {
    if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = orig; }
  }
}

function regenSummaryAuto(id, btn) {
  showConfirm(
    'Regenerate and auto-save?',
    'The current title and summary will be replaced without a review step. This cannot be undone.',
    'Regenerate',
    () => _doRegenSummaryAuto(id, btn),
    true,
  );
}

function _doRegenSummaryAuto(id, btn) {
  const actionBtn = document.getElementById('btn-regen-summary') || btn;
  if (actionBtn && actionBtn.disabled) return;
  if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = 'Regenerating…'; }
  openLog();
  _supersedeActiveStream();
  const resetBtn = () => { if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = 'Regenerate (auto-save)'; } };
  let hadError = false;
  const handle = _openSSE(
    `/api/videos/${id}/regenerate-summary`,
    data => {
      if (typeof data === 'string' && data.startsWith('[Error')) hadError = true;
      appendLog(String(data));
    },
    () => {
      _clearActiveStream(handle);
      resetBtn();
      if (hadError) {
        showToast('Summary generation failed — check log for details', 'error');
        return;
      }
      loadVideos().then(() => {
        const video = AppState.videos.find(v => v.id === id);
        if (video && AppState.activeVideoId === id) renderVideoDetail(video, null);
      });
      showToast('Summary regenerated');
    },
    errMsg => {
      _clearActiveStream(handle);
      resetBtn();
      showToast(`Summary generation failed — ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, resetBtn);
}

async function _refreshVideoDetail(videoId) {
  await loadVideos();
  const updated = AppState.videos.find(x => x.id === videoId);
  if (updated) renderVideoDetail(updated, null);
}

// ── re-analysis ───────────────────────────────────────────────────────────────
// Two ways to re-run analysis on an already-analyzed recording:
//   reanalyzeVideo  — full pipeline with --force (destructive: replaces clips/scores).
//   rediarizeVideo  — speaker detection only (non-destructive: keeps clips/scores).
function reanalyzeVideo(id) {
  const video = AppState.videos.find(v => v.id === id);
  const exportedNote = (video && video.exported > 0)
    ? ` Files you already exported for this recording stay on disk, but the ${video.exported} exported clip(s) will be regenerated.`
    : '';
  showConfirm(
    'Re-analyze this recording?',
    `This re-runs the full pipeline — re-transcribe, re-detect speakers, regenerate clips, and re-score. All current clips, including your approvals and any edited descriptions, will be replaced.${exportedNote}`,
    'Re-analyze',
    () => _doReanalyzeVideo(video || {id}),
    true,
  );
}

async function _doReanalyzeVideo(video) {
  const model = (video.analyze_run && video.analyze_run.settings && video.analyze_run.settings.model) || 'medium';
  let res;
  try {
    res = await fetch('/api/analyze/start', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        video_id: video.id, force: true, model,
        context_names: video.context_names || [],
      }),
    });
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(formatApiError(err) || 'Failed to start re-analysis', 'error');
    return;
  }
  AppState.analyzeFilename = video.filename || null;
  loadVideos();  // surface the spinner on the recording immediately
  openLog();
  appendLog(`Re-analyzing: ${video.filename || video.id}`);
  _streamAnalyzeEvents(video.filename || '');
}

function rediarizeVideo(id) {
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
      if (window.loadSpeakers) loadSpeakers(id);
      showToast('Speaker detection complete');
      SoundFx.play('analysis');
    },
    [{label: 'Speakers', patterns: ['Detecting speakers']}],
    'Re-detecting speakers',
    false,
  );
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
  items.push(null, { label: 'Regenerate', action: () => summarizeVideo(videoId, null) });
  if (!isTitle) items.push({ label: 'Regenerate (auto-save)', action: () => regenSummaryAuto(videoId, null) });
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
    AppState.clips = await fetch(`/api/videos/${AppState.activeVideoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
  } catch { return; }
  _renderClips();
}

// ── analysis run metadata card ────────────────────────────────────────────────
// Renders the stored record of the last analyze run (per-stage timing, effective
// settings, and CPU/GPU device) so the creator can answer "how long did this
// take, what settings, and did it use my GPU?".
function _renderRunMetaCard(video) {
  const run = video.analyze_run;
  if (!run) return '';
  const totalHms = _msToHms(run.elapsed_ms || 0);
  const dev = run.device || {};
  const deviceBadge = dev.has_gpu
    ? '<span class="run-meta-badge gpu" title="Used the GPU">GPU</span>'
    : '<span class="run-meta-badge cpu" title="Ran on CPU">CPU</span>';
  const when = run.finished_at ? ` &middot; ${escHtml(_fmtAgo(run.finished_at))}` : '';
  return `
    <details class="detail-card run-meta-card">
      <summary class="run-meta-summary">Last analysis &middot; <strong>${totalHms}</strong> ${deviceBadge}${when}</summary>
      <div class="run-meta-body">
        ${_runSettingsRows(run.settings || {}, dev)}
        ${_runStageBars(run.stages || [])}
      </div>
    </details>`;
}

function _runSettingsRows(s, dev) {
  const yesNo = (v) => v ? 'On' : 'Off';
  const rows = [
    ['Whisper model',  s.model],
    ['Track layout',   s.track_layout],
    ['Captions',       s.captions_source],
    ['Speaker labels', s.speaker_labels === undefined ? null : yesNo(s.speaker_labels)],
    ['Energy mode',    s.energy_mode],
    ['Scene mode',     s.scene_mode],
    ['LLM scoring',    s.scoring === undefined ? null : yesNo(s.scoring)],
    ['World contexts', (s.contexts && s.contexts.length) ? s.contexts.join(', ') : 'none'],
    ['Transcribe device', dev.transcribe],
    ['Diarization device', dev.diarization],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
  return `<div class="run-meta-grid">${rows.map(([k, v]) =>
    `<div class="run-meta-key">${escHtml(k)}</div><div class="run-meta-val">${escHtml(String(v))}</div>`
  ).join('')}</div>`;
}

function _runStageBars(stages) {
  if (!stages.length) return '';
  const maxS = Math.max(...stages.map(st => st.seconds || 0), 0.001);
  const bars = stages.map(st => {
    const secs = st.seconds || 0;
    const pct = Math.max(2, Math.round(secs / maxS * 100));
    return `
      <div class="run-stage-row">
        <span class="run-stage-name">${escHtml(st.name)}</span>
        <span class="run-stage-track"><span class="run-stage-fill" style="width:${pct}%"></span></span>
        <span class="run-stage-time">${_msToHms(secs * 1000)}</span>
      </div>`;
  }).join('');
  return `<div class="run-stage-bars"><div class="run-meta-subtitle">Stage timing</div>${bars}</div>`;
}

// Public API — symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  loadVideos, selectVideo, renderVideoDetail,
  onClipsSortChange, _clipsSortParam,
  summarizeVideo, regenSummaryAuto, _doRegenSummaryAuto,
  reanalyzeVideo, rediarizeVideo,
  openVideoSummaryKebab, openVideoTitleKebab,
  generateTimeline, confirmGenerateTimeline, closeTimelineIntervalModal,
  updateTimelineIntervalHint,
  _updateDemoButton, _updateStartIngestButton,
  _syncAnalysisLivePanel,
  openVideoActionsModal,
});
})();
