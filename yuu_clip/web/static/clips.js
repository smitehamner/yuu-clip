// ── clips ─────────────────────────────────────────────────────────────────────
function renderClipList(clips) {
  const list = document.getElementById('clip-list');
  list.innerHTML = '';
  if (!clips.length) {
    const _statusLabel = {pending: 'Unreviewed', approved: 'Approved', rejected: 'Rejected'};
    const filterMsg = _clipFilter !== 'all'
      ? `No ${_statusLabel[_clipFilter] || _clipFilter} clips`
      : `No clips found — <a href="#" style="color:var(--muted);text-decoration:underline" onclick="event.preventDefault();openAnalyzeModal()">Re-analyze this recording</a>`;
    list.innerHTML = `<li style="padding:10px 14px;color:var(--muted)">${filterMsg}</li>`;
    return;
  }
  for (const c of clips) {
    const li = document.createElement('li');
    li.className = c.id === activeClipId ? 'active' : '';
    li.style.borderLeftColor = _scoreBorderColor(_sortScore(c), c.status === 'rejected');
    li.tabIndex = 0;
    li.innerHTML = `
      <div class="clip-item">
        <span class="score-badge" title="Overall score">${_scoreIcon(c.score_overall)}${c.score_overall.toFixed(2)}</span>
        <span class="clip-label" title="${escHtml(c.description || '')}">
          <span style="color:var(--muted);font-size:11px">#${c.id}</span>
          ${c.start_hms} &middot; ${c.duration_hms}
        </span>
        ${c.has_export
          ? '<span class="export-pill is-exported" title="Clip has been exported">Exported</span>'
          : '<span class="export-pill not-exported" title="Not yet exported">Not exported</span>'}
        <span class="status-dot dot-${c.status}" title="${c.status === 'approved' ? 'Approved' : c.status === 'rejected' ? 'Rejected' : 'Unreviewed'}">${c.status === 'approved' ? '✓' : c.status === 'rejected' ? '✕' : ''}</span>
      </div>
      ${c.description ? `<div style="font-size:11px;color:var(--muted);margin-top:3px;padding-left:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.description)}</div>` : ''}
      <div class="clip-scores">
        <span title="Funny"><span aria-hidden="true">😂</span> ${c.score_funny.toFixed(2)}</span>
        <span title="Dramatic"><span aria-hidden="true">🎭</span> ${c.score_dramatic.toFixed(2)}</span>
        <span title="Action"><span aria-hidden="true">⚔️</span> ${c.score_action.toFixed(2)}</span>
      </div>`;
    const _activateClip = () => {
      document.querySelectorAll('#clip-list li').forEach(l => l.classList.remove('active'));
      li.classList.add('active');
      selectClip(c.id);
    };
    li.onclick = _activateClip;
    li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _activateClip(); } };
    list.appendChild(li);
  }
}

async function selectClip(id) {
  activeClipId = id;
  localStorage.setItem('yuuclip-view', JSON.stringify({videoId: activeVideoId, clipId: id}));
  try {
    const [clipRes, mediaRes] = await Promise.all([
      fetch(`/api/clips/${id}`),
      fetch(`/api/clips/${id}/media_url`),
    ]);
    if (!clipRes.ok || !mediaRes.ok) throw new Error('Failed to load clip');
    const clip  = await clipRes.json();
    const media = await mediaRes.json();
    const captionsUrl = media.has_captions ? `/api/clips/${id}/captions.vtt` : null;
    _activeClipData = clip;
    _activeMediaFilename = media.filename;
    renderPlayer(media.url, captionsUrl, id);
    renderDetail(clip);
  } catch (err) {
    showToast(`Could not load clip: ${err.message}`, 'error');
  }
}

// ── player ────────────────────────────────────────────────────────────────────
function renderPlayer(url, captionsUrl, clipId) {
  const area = document.getElementById('player-area');
  if (url) {
    const track = captionsUrl
      ? `<track kind="captions" src="${captionsUrl}" label="Transcript" default>`
      : '';
    area.innerHTML = `<video controls src="${url}" aria-label="Clip preview">${track}</video>`;
  } else {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    const vid = document.createElement('video');
    vid.controls = true;
    vid.src = `/api/clips/${clipId}/preview`;
    vid.setAttribute('aria-label', 'Clip source preview');
    vid.style.cssText = 'display:block;width:100%;max-height:42vh;object-fit:contain;background:#000';
    vid.onerror = async () => {
      const detail = await fetch(`/api/clips/${clipId}/preview`)
        .then(r => r.json()).then(j => j.detail || 'unavailable').catch(() => 'unavailable');
      wrap.innerHTML = `<div style="padding:24px;color:var(--muted);font-size:13px">Source video unavailable: ${escHtml(detail)}</div>`;
    };
    const badge = document.createElement('span');
    badge.style.cssText = 'position:absolute;top:8px;left:8px;background:rgba(0,0,0,.65);color:var(--muted);font-size:11px;padding:3px 8px;border-radius:4px;pointer-events:none';
    badge.textContent = 'Source preview · not exported';
    wrap.appendChild(vid);
    wrap.appendChild(badge);
    area.innerHTML = '';
    area.appendChild(wrap);
  }
}

// ── detail ────────────────────────────────────────────────────────────────────
function renderDetail(clip) {
  const eb = (isEdited) => isEdited ? `<span class="edited-badge">edited</span>` : '';
  document.getElementById('detail').innerHTML = `
    <div>
      <div class="detail-type-badge clip-badge" style="margin-bottom:8px">&#9986; Clip #${clip.id}</div>
      <div class="clip-header">
        <span class="time">${clip.start_hms} &middot; ${clip.duration_hms}</span>
      </div>
    </div>

    <div class="field-row" style="margin-bottom:4px">
      <div class="description">${clip.description ? `"${escHtml(clip.description)}"` : `<span style="color:var(--muted);font-size:13px">No description yet — Re-score to generate</span>`}${eb(clip.description_is_edited)}</div>
      <button class="kebab-btn" title="Edit or regenerate description" aria-label="Edit or regenerate description" onclick="openDescKebab(${clip.id}, this)">&#8943;</button>
    </div>

    ${clip.description_long ? `
      <div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <div class="section-title">Full Description${eb(clip.description_long_is_edited)}</div>
          <button class="kebab-btn" title="Edit or regenerate long description" aria-label="Edit or regenerate long description" onclick="openDescLongKebab(${clip.id}, this)">&#8943;</button>
        </div>
        <div class="description-long">${escHtml(clip.description_long)}</div>
      </div>` : ''}

    <div class="scores">
      ${scoreRow('Overall',  clip.score_overall,  'overall')}
      ${scoreRow('Funny',    clip.score_funny,    'funny')}
      ${scoreRow('Dramatic', clip.score_dramatic, 'dramatic')}
      ${scoreRow('Action',   clip.score_action,   'action')}
    </div>

    <div class="clip-actions">
      <div class="review-actions">
        <button class="btn approve ${clip.status==='approved'?'active':''}" onclick="setStatus(${clip.id},'approved')">Approve</button>
        <button class="btn reject  ${clip.status==='rejected'?'active':''}" onclick="setStatus(${clip.id},'rejected')">Reject</button>
        <button class="btn         ${clip.status==='pending' ?'active':''}" onclick="setStatus(${clip.id},'pending')" title="Mark as Unreviewed">Unreviewed</button>
      </div>
      <div class="op-actions">
        <button class="btn" id="btn-rescore-clip" onclick="rescoreClip(${clip.id})">Re-score</button>
        <button class="btn" onclick="openRetranscribeModal(${clip.id})">Retranscribe</button>
        <button class="btn" onclick="exportClip(${clip.id})">${clip.has_export ? 'Re-export' : 'Export'}</button>
        ${clip.has_export && _activeMediaFilename
          ? `<a class="btn" href="/media/exports/${escHtml(_activeMediaFilename)}" download="${escHtml(_activeMediaFilename)}" title="Save exported clip to disk">Save As</a>`
          : ''}
      </div>
      <div class="danger-actions">
        ${clip.has_export ? `<button class="btn danger" onclick="deleteExport(${clip.id})" title="Delete exported file but keep clip record">Delete Export</button>` : ''}
        <button class="btn danger" onclick="deleteClip(${clip.id})" title="Delete clip record and exported file">Delete Clip</button>
      </div>
    </div>

    <div class="timing-row">
      <span class="section-title" style="font-size:12px">Trim</span>
      <span style="color:var(--muted);font-size:12px">Start</span>
      <input class="timing-input" id="clip-trim-start" value="${_fmtOffset(clip.start_offset)}" placeholder="+0.0" title="Offset in ±seconds, absolute seconds, or M:SS">
      <span style="color:var(--muted);font-size:12px">End</span>
      <input class="timing-input" id="clip-trim-end" value="${_fmtOffset(clip.end_offset)}" placeholder="+0.0" title="Offset in ±seconds, absolute seconds, or M:SS">
      <button class="btn" style="font-size:12px;padding:4px 10px" onclick="saveClipTiming(${clip.id})">Apply</button>
    </div>

    ${clip.tags.length ? `<div class="tags">${clip.tags.map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}

    ${clip.has_export ? `
      <div>
        <div class="section-title" style="margin-bottom:6px">Export info</div>
        <div style="font-size:12px;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap">
          ${clip.exported_container ? `<span>Container: <strong style="color:var(--text)">${clip.exported_container.toUpperCase()}</strong></span>` : ''}
          <span>Captions: <strong style="color:var(--text)">${
            clip.subtitle_status === 'baked-in'    ? 'Baked into video' :
            clip.subtitle_status === 'srt-sidecar' ? 'Separate SRT file' :
            'None'
          }</strong></span>
          ${clip.exported_at ? `<span>Exported: <strong style="color:var(--text)">${_fmtAgo(clip.exported_at)}</strong></span>` : ''}
        </div>
      </div>` : ''}

    ${clip.transcript_excerpt ? `
      <div>
        <div class="section-title" style="margin-bottom:6px">Transcript</div>
        <div class="transcript">${escHtml(clip.transcript_excerpt)}</div>
      </div>` : ''}
  `;
}

function scoreRow(label, val, cls) {
  return `
    <span class="score-label">${label}</span>
    <div class="score-bar-wrap"><div class="score-bar bar-${cls}" style="width:${(val*100).toFixed(1)}%"></div></div>
    <span class="score-val" style="color:var(--${cls})">${val.toFixed(2)}</span>`;
}

function saveClipTiming(clipId) {
  const parseOff = (str) => {
    if (!str) return 0.0;
    const s = str.trim();
    if (/^[+-]/.test(s)) return parseFloat(s);
    if (/^\d+:\d+(\.\d+)?$/.test(s)) {
      const [m, sec] = s.split(':');
      const absSec = parseInt(m) * 60 + parseFloat(sec);
      const clipStartSec = _activeClipData?.start_ms ? _activeClipData.start_ms / 1000 : 0;
      return absSec - clipStartSec;
    }
    return parseFloat(s);
  };
  const startOffset = parseOff(document.getElementById('clip-trim-start').value);
  const endOffset   = parseOff(document.getElementById('clip-trim-end').value);
  if (isNaN(startOffset) || isNaN(endOffset)) { showToast('Invalid timing value', 'error'); return; }
  fetch(`/api/clips/${clipId}/timing`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({start_offset: startOffset, end_offset: endOffset}),
  }).then(r => {
    if (!r.ok) { showToast('Save timing failed', 'error'); return; }
    showToast('Timing saved');
    selectClip(clipId);
  }).catch(() => showToast('Save timing failed', 'error'));
}

function openDescKebab(clipId, btn) {
  const clip = _activeClipData;
  const items = [
    { label: 'Edit', action: () =>
      openFieldEditModal('Edit Description', clip?.description || '', async v => {
        await _patchClipField(clipId, 'accept_edit', 'description', v, null);
        selectClip(clipId);
      })
    },
  ];
  if (clip?.description_is_edited) {
    items.push({ label: 'Revert to Original', action: () =>
      openDiffModal('Revert Description', [
        {label: 'Description', current: clip.description, proposed: clip.description_original},
      ], async () => {
        await _patchClipField(clipId, 'revert', 'description', null, null);
        selectClip(clipId);
      }, {revertMode: true})
    });
  }
  items.push(null, { label: 'Regenerate via Re-score', action: () => rescoreClip(clipId) });
  showKebab(btn, items);
}

function openDescLongKebab(clipId, btn) {
  const clip = _activeClipData;
  const items = [
    { label: 'Edit', action: () =>
      openFieldEditModal('Edit Long Description', clip?.description_long || '', async v => {
        await _patchClipField(clipId, 'accept_edit', 'description_long', null, v);
        selectClip(clipId);
      })
    },
  ];
  if (clip?.description_long_is_edited) {
    items.push({ label: 'Revert to Original', action: () =>
      openDiffModal('Revert Long Description', [
        {label: 'Description', current: clip.description_long, proposed: clip.description_long_original},
      ], async () => {
        await _patchClipField(clipId, 'revert', 'description_long', null, null);
        selectClip(clipId);
      }, {revertMode: true})
    });
  }
  items.push(null, { label: 'Regenerate via Re-score', action: () => rescoreClip(clipId) });
  showKebab(btn, items);
}

async function _patchClipField(clipId, action, field, newDesc, newDescLong) {
  const res = await fetch(`/api/clips/${clipId}/fields`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action, field, new_description: newDesc, new_description_long: newDescLong}),
  });
  if (!res.ok) showToast('Save failed', 'error');
}

function clearDetail() {
  document.getElementById('player-area').innerHTML = `
    <div class="no-export-msg"><div style="color:var(--muted)">Select a clip to review</div></div>`;
  document.getElementById('detail').innerHTML = '<div class="detail-empty">Select a clip from the sidebar</div>';
}

// ── filter tabs ───────────────────────────────────────────────────────────────
function setClipFilter(filter) {
  _clipFilter = filter;
  document.querySelectorAll('.clip-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.filter === filter));
  const filtered = filter === 'all' ? _clips : _clips.filter(c => c.status === filter);
  renderClipList(filtered);
}

// ── clip actions ──────────────────────────────────────────────────────────────
async function setStatus(id, status) {
  const clip = _clips.find(c => c.id === id);
  const fromStatus = clip?.status;
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
  activeClipId = id;
  const [clipsData, clipDetail] = await Promise.all([
    fetch(`/api/videos/${activeVideoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json()),
    fetch(`/api/clips/${id}`).then(r => r.json()),
  ]);
  _clips = clipsData;
  const filtered = _clipFilter === 'all' ? _clips : _clips.filter(c => c.status === _clipFilter);
  renderClipList(filtered);
  renderDetail(clipDetail);
  loadVideos();

  if (fromStatus && fromStatus !== status) {
    if (_lastStatusChange?.timer) clearTimeout(_lastStatusChange.timer);
    const label = {approved:'Approved', rejected:'Rejected', pending:'Marked as Unreviewed'}[status] || status;
    _lastStatusChange = {clipId: id, fromStatus};
    _lastStatusChange.timer = setTimeout(() => { _lastStatusChange = null; }, 5000);
    showUndoToast(`Clip ${label}`, undoLastStatus);
  }
}

function undoLastStatus() {
  if (!_lastStatusChange) return;
  const {clipId, fromStatus} = _lastStatusChange;
  clearTimeout(_lastStatusChange.timer);
  _lastStatusChange = null;
  setStatus(clipId, fromStatus);
}

function showUndoToast(message, undoFn) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast info';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.justifyContent = 'space-between';
  toast.style.gap = '12px';
  const btn = document.createElement('button');
  btn.textContent = 'Undo';
  btn.style.cssText = 'font-size:11px;padding:2px 8px;border-radius:4px;border:1px solid var(--accent);background:none;color:var(--accent);cursor:pointer;flex-shrink:0';
  btn.onclick = () => { toast.remove(); undoFn(); };
  toast.appendChild(document.createTextNode(message));
  toast.appendChild(btn);
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

let _exportClipId = null;

function exportClip(id) {
  _exportClipId = id;
  document.getElementById('export-burn-subs').checked = false;
  document.getElementById('export-container').value = '';
  document.getElementById('export-settings-modal').classList.add('visible');
}

function closeExportModal() {
  document.getElementById('export-settings-modal').classList.remove('visible');
}

function confirmExport() {
  const id        = _exportClipId;
  const burnSubs  = document.getElementById('export-burn-subs').checked;
  const container = document.getElementById('export-container').value;
  closeExportModal();

  const params = new URLSearchParams();
  if (burnSubs)  params.set('burn_subs', 'true');
  if (container) params.set('container', container);
  const qs = params.toString() ? `?${params}` : '';

  openLog();
  streamSSE(
    `/api/clips/${id}/export${qs}`,
    async () => {
      const [clip, media] = await Promise.all([
        fetch(`/api/clips/${id}`).then(r => r.json()),
        fetch(`/api/clips/${id}/media_url`).then(r => r.json()),
      ]);
      _activeClipData = clip;
      _activeMediaFilename = media.filename;
      const captionsUrl = media.has_captions ? `/api/clips/${id}/captions.vtt` : null;
      renderPlayer(media.url, captionsUrl, id);
      renderDetail(clip);
      if (activeVideoId) {
        _clips = await fetch(`/api/videos/${activeVideoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
        renderClipList(_clips);
      }
      loadVideos();
      showToast('Clip exported successfully');
    },
    [{label: 'Export', patterns: ['Exporting', 'OK Saved']}],
    'Exporting',
  );
}

// ── delete ────────────────────────────────────────────────────────────────────
function deleteVideo(id) {
  const video = _videos.find(v => v.id === id);
  const name  = video ? video.filename : `video ${id}`;
  showConfirm(
    'Remove video?',
    `Remove <strong>${escHtml(name)}</strong> from yuu-clip?<br><br>` +
    `All clips, transcripts, and extracted audio are removed from the database. ` +
    `Your source recording file is <strong>not</strong> deleted.`,
    'Remove',
    () => _doDeleteVideo(id, name),
    true,
  );
}

async function _doDeleteVideo(id, name) {
  const delRes = await fetch(`/api/videos/${id}`, {method: 'DELETE'});
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    showToast(`Failed to remove video: ${formatApiError(err)}`, 'error');
    return;
  }
  if (activeVideoId === id) {
    activeVideoId = null;
    activeClipId  = null;
    document.getElementById('clip-list').innerHTML = '';
    clearDetail();
  }
  await loadVideos();
  showToast(`"${name}" removed from yuu-clip`);
}

function deleteExport(id) {
  showConfirm(
    'Delete exported file?',
    'The exported video file will be removed from disk. The clip record stays — you can re-export any time.',
    'Delete Export',
    async () => {
      const res = await fetch(`/api/clips/${id}/export`, {method: 'DELETE'});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(`Failed to delete export: ${formatApiError(err)}`, 'error');
        return;
      }
      _activeClipData.has_export = false;
      _activeMediaFilename = null;
      renderPlayer(null, null, id);
      renderDetail(_activeClipData);
      if (activeVideoId) {
        _clips = await fetch(`/api/videos/${activeVideoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
        renderClipList(_clips);
      }
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
  const videoId = activeVideoId;
  const delRes = await fetch(`/api/clips/${id}`, {method: 'DELETE'});
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    showToast(`Failed to delete clip: ${formatApiError(err)}`, 'error');
    return;
  }
  activeClipId = null;
  clearDetail();
  if (videoId) {
    _clips = await fetch(`/api/videos/${videoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
    renderClipList(_clips);
  }
  await loadVideos();
  showToast('Clip deleted');
}

// ── scoring ───────────────────────────────────────────────────────────────────
function scoreAll() {
  openLog();
  streamSSE(
    '/api/score',
    () => {
      loadVideos();
      if (activeVideoId) fetch(`/api/videos/${activeVideoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json()).then(data => {
        _clips = data;
        renderClipList(_clips);
      });
      showToast('Scoring complete');
    },
    SCORE_STEPS,
    'Scoring',
  );
}
