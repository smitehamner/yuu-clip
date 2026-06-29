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
  _videos = videos;

  const list = document.getElementById('video-list');
  list.innerHTML = '';

  if (!videos.length) {
    list.innerHTML = '<li style="padding:10px 14px;color:var(--muted)">No videos yet</li>';
    _showEmptyState();
    _updateDemoButton(0);
    return;
  }

  for (const v of videos) {
    const li = document.createElement('li');
    li.className = 'video-item' + (v.id === activeVideoId ? ' active' : '');
    li.dataset.videoId = v.id;
    li.tabIndex = 0;
    const clipsPct = v.duration_ms > 0
      ? ` (${Math.round(v.total_clip_ms / v.duration_ms * 100)}%)`
      : '';
    const scoreBar = (v.score_min !== null && v.score_max !== null && v.clip_count > 0)
      ? `<div class="meta">Scores: ${v.score_min.toFixed(2)} – ${v.score_max.toFixed(2)}</div>`
      : '';
    const procBadges = [
      v.summarized_at   ? '' : '<span style="font-size:10px;color:var(--muted)" title="No summary yet">∅ summary</span>',
      v.clips_scored_at ? '' : '<span style="font-size:10px;color:var(--muted)" title="Not scored yet">∅ scored</span>',
      v.has_timeline    ? '' : '<span style="font-size:10px;color:var(--muted)" title="No timeline yet">∅ timeline</span>',
    ].filter(Boolean).join(' &middot; ');
    const segmentMeta = (v.segment_start_s != null && v.segment_end_s != null)
      ? `<div class="meta" style="color:var(--accent2)">${_msToHms(v.segment_start_s * 1000)} – ${_msToHms(v.segment_end_s * 1000)}</div>`
      : '';
    li.innerHTML = `
      <div class="name" title="${escHtml(v.filename)}">${escHtml(v.filename)}</div>
      ${v.title ? `<div class="video-title" title="${escHtml(v.title)}">${escHtml(v.title)}</div>` : ''}
      ${segmentMeta}
      <div class="meta">${v.duration_hms} &middot; ${v.clip_count} clips &middot; ${_msToHms(v.total_clip_ms)} clipped${clipsPct}</div>
      <div class="meta">${v.approved} approved &middot; ${v.exported} exported &middot; ${_fmtVideoStatus(v.status)}</div>
      ${procBadges ? `<div class="meta" style="margin-top:2px">${procBadges}</div>` : ''}
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

  if (!_bootRestoreDone) {
    _bootRestoreDone = true;
    _restoreView();
  }
}

async function _restoreView() {
  try {
    const saved = JSON.parse(localStorage.getItem('yuuclip-view') || 'null');
    if (!saved?.videoId) return;
    if (!_videos.find(v => v.id === saved.videoId)) return;
    await selectVideo(saved.videoId);
    if (saved.clipId && _clips.find(c => c.id === saved.clipId)) {
      await selectClip(saved.clipId);
    }
  } catch {}
}

function _showEmptyState() {
  document.getElementById('player-area').innerHTML = '';
  document.getElementById('detail').innerHTML = `
    <div class="empty-state">
      <h2>Welcome to yuu-clip</h2>
      <p>Analyze a recording to start reviewing and exporting your best gaming moments.</p>
      <button class="btn primary" onclick="openNewRecordingPanel()">+ Analyze your first recording</button>
    </div>`;
}

function _updateDemoButton(approvedCount) {
  const btn = document.getElementById('btn-demo');
  btn.disabled = approvedCount === 0;
  btn.title = approvedCount === 0
    ? 'Approve some clips first to build a highlight reel'
    : `Build a highlight reel from ${approvedCount} approved clip(s)`;
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
  activeVideoId = id;
  activeClipId  = null;
  localStorage.setItem('yuuclip-view', JSON.stringify({videoId: id, clipId: null}));
  _clipFilter = 'all';
  document.querySelectorAll('.clip-tab').forEach(t => {
    const active = t.dataset.filter === 'all';
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  _clips = await fetch(`/api/videos/${id}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
  renderClipList(_clips);
  const video = _videos.find(v => v.id === id);
  if (video) renderVideoDetail(video, null);
  else clearDetail();
}

function renderVideoDetail(video, savedTimeline) {
  _activeVideoData = video;
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
        <h2 style="margin:0;font-size:17px;font-weight:700">${escHtml(video.title || video.filename)}${eb(video.title_is_edited)}</h2>
        ${video.title ? `<button class="kebab-btn" title="Edit or regenerate title" aria-label="Edit or regenerate title" onclick="openVideoTitleKebab(${video.id}, this)">&#8943;</button>` : ''}
      </div>
      ${_renderContextSection(video)}
    </div>

    ${video.summary ? `
      <div class="detail-card">
        <div class="detail-card-header">
          <span class="detail-card-title">Session Summary${eb(video.summary_is_edited)}</span>
          <button class="kebab-btn" title="Edit or regenerate summary" aria-label="Edit or regenerate summary" onclick="openVideoSummaryKebab(${video.id}, this)">&#8943;</button>
        </div>
        <div class="description-long">${escHtml(video.summary)}</div>
      </div>` : ''}

    <div class="actions">
      <button class="btn" id="btn-summarize-video" onclick="summarizeVideo(${video.id}, this)">${video.summary ? 'Regenerate Summary' : 'Generate Summary'}</button>
      ${video.summary ? `<button class="btn" id="btn-regen-summary" onclick="regenSummaryAuto(${video.id}, this)" title="Regenerate summary and auto-save without review">Regenerate (auto-save)</button>` : ''}
      <button class="btn" id="btn-generate-timeline" onclick="generateTimeline(${video.id})">${video.has_timeline ? 'Regenerate Timeline' : 'Generate Timeline'}</button>
      <button class="btn" onclick="openAutoApproveModal(${video.id})">Approve Above Score</button>
      <button class="btn" onclick="openBatchExportModal(${video.id})">Export Approved</button>
      <button class="btn" onclick="openSplitEditor(${video.id})">Split Recording</button>
      <button class="btn" onclick="exportVideoTranscript(${video.id}, this)" title="Write captions as an SRT file next to the source recording, for reuse on reimport">Export Captions to File</button>
      <div class="danger-actions">
        <button class="btn danger" onclick="resetApprovals(${video.id})">Reset Approvals</button>
        <button class="btn danger" onclick="deleteVideo(${video.id})" title="Remove from yuu-clip (source file is NOT deleted)">Remove Recording</button>
      </div>
    </div>

    <div id="timeline-section">
      ${savedTimeline ? _renderTimelineHTML(savedTimeline) : ''}
    </div>`;

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

function _renderContextSection(video) {
  const assigned = video.context_names || [];
  const chips = assigned.map(context_id => {
    const ctx = _contexts.find(c => c.context_id === context_id);
    const name = ctx ? ctx.display_name : context_id;
    return `<span class="context-chip">${escHtml(name)}<button class="chip-x" data-rmctx="${escHtml(context_id)}" title="Remove" aria-label="Remove ${escHtml(name)}">×</button></span>`;
  });

  const available = _contexts.filter(c => !assigned.includes(c.context_id));
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
    const ctxNames = scoredCtx.map(s => { const c = _contexts.find(x => x.context_id === s); return c ? c.display_name : s; });
    const ctxStr = ctxNames.length ? ' · ' + ctxNames.map(escHtml).join(', ') : ' · no context';
    provLines.push(`<span class="${stale ? 'provenance-stale' : ''}">Clips scored ${escHtml(when)}${ctxStr}${stale ? ' — ⚠ contexts changed since last score' : ''}</span>`);
  }

  const noContextsDefined = _contexts.length === 0;
  const emptyMsg = noContextsDefined
    ? `<span style="color:var(--muted);font-size:12px">No contexts defined — <button class="btn ghost" style="padding:0;display:inline;font-size:12px" onclick="openContextManager()">create one</button></span>`
    : (!assigned.length ? `<span style="color:var(--muted);font-size:12px">None assigned</span>` : '');

  const rescoreBtn = (assigned.length && video.clips_scored_at)
    ? `<button class="btn" style="font-size:12px;padding:4px 12px" onclick="rescoreClips(${video.id}, this)">Re-score clips with context</button>`
    : assigned.length
    ? `<button class="btn" style="font-size:12px;padding:4px 12px" onclick="rescoreClips(${video.id}, this)">Score clips with context</button>`
    : '';

  return `
    <div>
      <div class="section-title" style="margin-bottom:6px">World Contexts</div>
      <div class="context-chips">
        ${chips.join('')}${emptyMsg}${addSelect ? '&nbsp;' + addSelect : ''}
      </div>
      ${provLines.length ? `<div class="provenance-note">${provLines.join('<br>')}</div>` : ''}
      ${rescoreBtn ? `<div style="margin-top:6px">${rescoreBtn}</div>` : ''}
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

function generateTimeline(id) {
  _timelineVideoId = id;
  const video = _videos.find(v => v.id === id);
  _loadTimelineIntervalConfig().then(() => {
    updateTimelineIntervalHint(video);
    document.getElementById('timeline-interval-modal').classList.add('visible');
  });
}

function closeTimelineIntervalModal() {
  document.getElementById('timeline-interval-modal').classList.remove('visible');
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
  video = video || _videos.find(v => v.id === _timelineVideoId);
  const val = parseInt(document.getElementById('timeline-interval-value').value, 10) || 1;
  const unit = document.getElementById('timeline-interval-unit').value;
  const intervalS = unit === 'minutes' ? val * 60 : val;
  const hint = document.getElementById('timeline-interval-hint');
  if (intervalS < 10) {
    hint.textContent = 'Minimum interval is 10 seconds.';
    hint.style.color = 'var(--red)';
    return;
  }
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
  const val = parseInt(document.getElementById('timeline-interval-value').value, 10) || 15;
  const unit = document.getElementById('timeline-interval-unit').value;
  const intervalS = unit === 'minutes' ? val * 60 : val;
  if (intervalS < 10) return;

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

  if (_activeES) { _activeES.close(); _activeES = null; }
  const es = new EventSource(`/api/videos/${id}/timeline?interval_s=${intervalS}`);
  _activeES = es;
  let entries = [];
  let firstEntry = true;

  es.onmessage = e => {
    const data = JSON.parse(e.data);
    if (data === '__DONE__') {
      es.close();
      if (_activeES === es) _activeES = null;
      btn.disabled = false;
      btn.textContent = 'Regenerate Timeline';
      const video = _videos.find(v => v.id === id);
      if (video) video.has_timeline = true;
      showToast('Timeline generated');
      return;
    }
    if (firstEntry) {
      section.innerHTML = `<div class="section-title" style="margin-bottom:8px">Session Timeline</div><div class="timeline" id="timeline-list"></div>`;
      firstEntry = false;
    }
    entries.push(data);
    const row = document.createElement('div');
    row.className = 'timeline-entry';
    row.innerHTML = `
      <div class="timeline-stamp">${escHtml(data.start_hms)}</div>
      <div class="timeline-text">${escHtml(data.text)}</div>`;
    document.getElementById('timeline-list').appendChild(row);
  };

  es.onerror = () => {
    es.close();
    if (_activeES === es) _activeES = null;
    btn.disabled = false;
    btn.textContent = 'Regenerate Timeline';
    showToast('Timeline generation failed — see log', 'error');
  };
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
      const video = _videos.find(v => v.id === id);
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
  actionBtn.disabled = true;
  actionBtn.textContent = 'Regenerating…';
  openLog();
  if (_activeES) { _activeES.close(); _activeES = null; }
  const es = new EventSource(`/api/videos/${id}/regenerate-summary`);
  _activeES = es;
  es.onmessage = e => {
    const data = JSON.parse(e.data);
    if (data === '__DONE__') {
      es.close();
      if (_activeES === es) _activeES = null;
      actionBtn.disabled = false;
      actionBtn.textContent = 'Regenerate (auto-save)';
      loadVideos().then(() => {
        const video = _videos.find(v => v.id === id);
        if (video && activeVideoId === id) renderVideoDetail(video, null);
      });
      showToast('Summary regenerated');
      return;
    }
    appendLog(String(data));
  };
  es.onerror = () => {
    es.close();
    if (_activeES === es) _activeES = null;
    actionBtn.disabled = false;
    actionBtn.textContent = 'Regenerate (auto-save)';
    showToast('Summary regeneration failed — see log', 'error');
  };
}

async function _refreshVideoDetail(videoId) {
  await loadVideos();
  const updated = _videos.find(x => x.id === videoId);
  if (updated) renderVideoDetail(updated, null);
}

function _openVideoFieldKebab(videoId, btn, field) {
  const video      = _activeVideoData;
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
  if (!activeVideoId) return;
  localStorage.setItem('clips-sort', _clipsSortParam());
  try {
    _clips = await fetch(`/api/videos/${activeVideoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
  } catch { return; }
  const filtered = _clipFilter === 'all' ? _clips : _clips.filter(c => c.status === _clipFilter);
  renderClipList(filtered);
}
