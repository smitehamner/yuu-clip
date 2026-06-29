// ── clips ─────────────────────────────────────────────────────────────────────
function _applyFilters() {
  let result = _clipFilter === 'all' ? _clips : _clips.filter(c => c.status === _clipFilter);
  if (_clipScoreMin > 0) result = result.filter(c => c.score_overall >= _clipScoreMin);
  if (_clipSearch) {
    const q = _clipSearch.toLowerCase();
    result = result.filter(c =>
      (c.description || '').toLowerCase().includes(q) ||
      (c.description_long || '').toLowerCase().includes(q) ||
      (c.transcript_excerpt || '').toLowerCase().includes(q)
    );
  }
  return result;
}

function _clearClipFilters() {
  _clipFilter = 'all';
  _clipSearch = '';
  _clipScoreMin = 0;
  document.querySelectorAll('.clip-tab').forEach(t => {
    const active = t.dataset.filter === 'all';
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  const searchEl = document.getElementById('clip-search-input');
  if (searchEl) searchEl.value = '';
  const scoreEl = document.getElementById('clip-score-min');
  if (scoreEl) scoreEl.value = '0';
  renderClipList(_clips);
}

function setClipSearch(q) {
  _clipSearch = q.trim();
  renderClipList(_applyFilters());
}

function setClipScoreMin(val) {
  _clipScoreMin = parseFloat(val) || 0;
  renderClipList(_applyFilters());
}

function renderClipList(clips) {
  const list = document.getElementById('clip-list');
  list.innerHTML = '';
  if (!clips.length) {
    const _statusLabel = {pending: 'Unreviewed', approved: 'Approved', rejected: 'Rejected'};
    const hasActiveFilter = _clipFilter !== 'all' || _clipSearch || _clipScoreMin > 0;
    const filterMsg = hasActiveFilter
      ? `No clips match the current filters — <a href="#" style="color:var(--accent);text-decoration:underline" onclick="event.preventDefault();_clearClipFilters()">Clear filters</a>`
      : `No clips found — <a href="#" style="color:var(--muted);text-decoration:underline" onclick="event.preventDefault();openNewRecordingPanel()">Analyze another recording</a>`;
    list.innerHTML = `<li style="padding:10px 14px;color:var(--muted)">${filterMsg}</li>`;
    return;
  }
  for (const c of clips) {
    const li = document.createElement('li');
    li.className = c.id === activeClipId ? 'active' : '';
    li.style.borderLeftColor = _scoreBorderColor(_sortScore(c), c.status === 'rejected');
    li.tabIndex = 0;
    li.innerHTML = `
      <div class="clip-item-row1">
        <span class="clip-num" title="Clip #${c.id}">#${c.id}</span>
        <span class="clip-time">${c.start_hms} &middot; ${c.duration_hms}</span>
        ${c.has_export
          ? '<span class="export-pill is-exported" title="Clip has been exported">Exported</span>'
          : '<span class="export-pill not-exported" title="Not yet exported">Not exported</span>'}
        <span class="status-dot dot-${c.status}" title="${c.status === 'approved' ? 'Approved' : c.status === 'rejected' ? 'Rejected' : 'Unreviewed'}">${c.status === 'approved' ? '✓' : c.status === 'rejected' ? '✕' : ''}</span>
      </div>
      <div class="clip-scores" aria-label="Scores: overall ${Math.round(c.score_overall*100)}%, funny ${Math.round(c.score_funny*100)}%, dramatic ${Math.round(c.score_dramatic*100)}%, action ${Math.round(c.score_action*100)}%">
        <span aria-hidden="true" title="Overall">${_scoreIcon(c.score_overall)} ${Math.round(c.score_overall*100)}%</span>
        <span aria-hidden="true" title="Funny"><span>😂</span> ${Math.round(c.score_funny*100)}%</span>
        <span aria-hidden="true" title="Dramatic"><span>🎭</span> ${Math.round(c.score_dramatic*100)}%</span>
        <span aria-hidden="true" title="Action"><span>⚔️</span> ${Math.round(c.score_action*100)}%</span>
      </div>
      ${c.description ? `<div class="clip-desc-preview" title="${escHtml(c.description)}">${escHtml(c.description)}</div>` : ''}`;
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
  const autoplay = localStorage.getItem('yuuclip-autoplay') === 'true';
  if (url) {
    const track = captionsUrl
      ? `<track kind="captions" src="${captionsUrl}" label="Captions" default>`
      : '';
    area.innerHTML = `<video controls ${autoplay ? 'autoplay' : ''} src="${url}" aria-label="Clip preview">${track}</video>`;
  } else {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    const vid = document.createElement('video');
    vid.controls = true;
    vid.autoplay = autoplay;
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
    wrap.appendChild(vid);
    wrap.appendChild(badge);
    area.innerHTML = '';
    area.appendChild(wrap);
  }
}

// ── detail ────────────────────────────────────────────────────────────────────
function renderDetail(clip) {
  const eb = (isEdited) => isEdited ? `<span class="edited-badge">edited</span>` : '';

  const trimExportHtml = `
    <hr class="detail-card-divider">
    <div style="font-size:12px;color:var(--muted)">
      <div style="margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">Trim</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <span>Start <strong style="color:var(--text);font-family:monospace">${_fmtOffset(clip.start_offset)}</strong></span>
        <span>End <strong style="color:var(--text);font-family:monospace">${_fmtOffset(clip.end_offset)}</strong></span>
        <span style="font-size:11px">(edit in Export)</span>
      </div>
      ${clip.has_export ? `
        <div style="margin-top:8px;margin-bottom:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">Exported</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${clip.exported_container ? `<span>Container: <strong style="color:var(--text)">${escHtml(clip.exported_container.toUpperCase())}</strong></span>` : ''}
          <span>Captions: <strong style="color:var(--text)">${
            clip.subtitle_status === 'baked-in'    ? 'Baked in' :
            clip.subtitle_status === 'srt-sidecar' ? 'SRT sidecar' :
            'None'
          }</strong></span>
          ${clip.exported_at ? `<span>When: <strong style="color:var(--text)">${_fmtAgo(clip.exported_at)}</strong></span>` : ''}
        </div>` : ''}
    </div>`;

  document.getElementById('detail').innerHTML = `
    <div>
      <div class="detail-type-badge clip-badge" style="margin-bottom:8px">&#127902; Clip #${clip.id}</div>
      <div class="clip-header">
        <span class="time">${clip.start_hms} &middot; ${clip.duration_hms}</span>
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-card-header">
        <span class="detail-card-title">Description${eb(clip.description_is_edited)}</span>
        <button class="kebab-btn" title="Edit or regenerate description" aria-label="Edit or regenerate description" onclick="openDescKebab(${clip.id}, this)">&#8942;</button>
      </div>
      <div class="description">${clip.description ? `"${escHtml(clip.description)}"` : `<span style="color:var(--muted);font-size:13px">No description yet — Re-score to generate</span>`}</div>
    </div>

    ${clip.description_long ? `
      <div class="detail-card">
        <div class="detail-card-header">
          <span class="detail-card-title">Full Description${eb(clip.description_long_is_edited)}</span>
          <button class="kebab-btn" title="Edit or regenerate long description" aria-label="Edit or regenerate long description" onclick="openDescLongKebab(${clip.id}, this)">&#8942;</button>
        </div>
        <div class="description-long">${escHtml(clip.description_long)}</div>
      </div>` : ''}

    <div class="detail-cards-row">
      <div class="detail-card" style="flex:1">
        <div class="detail-card-header">
          <span class="detail-card-title">Scoring</span>
          ${clip.score_overall_user != null
            ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" onclick="clearScoreOverride(${clip.id})" title="Remove manual score override">Remove Override</button>`
            : `<button class="btn ghost" style="font-size:11px;padding:2px 8px" onclick="openScoreOverride(${clip.id})">Override Score</button>`}
        </div>
        <div class="scores">
          ${clip.score_overall_user != null
            ? scoreRowOverride('Overall', clip.score_overall, clip.score_overall_user, 'overall')
            : scoreRow('Overall', clip.score_overall, 'overall')}
          ${scoreRow('Funny',    clip.score_funny,    'funny')}
          ${scoreRow('Dramatic', clip.score_dramatic, 'dramatic')}
          ${scoreRow('Action',   clip.score_action,   'action')}
        </div>
      </div>
      <div class="detail-card" style="flex:1">
        <div class="clip-actions">
          <div class="review-actions">
            <button class="btn approve ${clip.status==='approved'?'active':''}" onclick="setStatus(${clip.id},'approved')" title="Approve (press A)">Approve</button>
            <button class="btn reject  ${clip.status==='rejected'?'active':''}" onclick="setStatus(${clip.id},'rejected')" title="Reject (press R)">Reject</button>
          </div>
          <div class="op-actions">
            ${clip.status !== 'pending' ? `<button class="btn ghost" style="font-size:12px" onclick="setStatus(${clip.id},'pending')" title="Clear review status">Mark Unreviewed</button>` : ''}
            <button class="btn" id="btn-rescore-clip" onclick="rescoreClip(${clip.id})">Re-score</button>
            <button class="btn" onclick="openRetranscribeModal(${clip.id})">Retranscribe</button>
            ${clip.description_long || clip.description ? `<button class="btn" id="btn-find-similar" onclick="openSimilarClipsModal(${clip.id})">Find Similar</button>` : ''}
            <button class="btn" onclick="exportClip(${clip.id})">${clip.has_export ? 'Re-export' : 'Export'}</button>
            ${clip.has_export && _activeMediaFilename
              ? `<a class="btn" href="/media/exports/${escHtml(_activeMediaFilename)}" download="${escHtml(_activeMediaFilename)}" title="Download the already-exported file to disk">Download Export</a>`
              : ''}
          </div>
          ${_mergeButtonsHtml(clip)}
          ${trimExportHtml}
        </div>
      </div>
    </div>

    <div class="clip-danger-zone">
      ${clip.has_export ? `<button class="btn danger" onclick="deleteExport(${clip.id})" title="Delete exported file but keep clip record">Delete Export</button>` : ''}
      <button class="btn danger" onclick="deleteClip(${clip.id})" title="Delete clip record and exported file">Delete Clip</button>
    </div>

    ${clip.tags.length ? `<div class="tags">${clip.tags.map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}

    ${clip.related_clips ? `
      <div id="related-clips-section">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div class="section-title">Related Clips</div>
          ${clip.related_clips_stale ? `<span style="font-size:11px;color:var(--amber);font-style:italic">stale — re-score updated</span>` : ''}
          <span style="font-size:11px;color:var(--muted);margin-left:auto">${clip.related_clips_at ? _fmtAgo(clip.related_clips_at) : ''}</span>
        </div>
        ${clip.related_clips.length ? clip.related_clips.map(r => `
          <div style="display:flex;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--border)">
            <a href="#" style="color:var(--accent);text-decoration:none;font-size:13px;white-space:nowrap" onclick="event.preventDefault();selectClip(${r.id})">#${r.id}</a>
            <span style="font-size:12px;color:var(--muted)">${escHtml(r.reason)}</span>
          </div>`).join('') : `<div style="font-size:12px;color:var(--muted)">No similar clips found</div>`}
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
    <span class="score-val" style="color:var(--${cls})">${Math.round(val*100)}%</span>`;
}

function scoreRowOverride(label, llmVal, userVal, cls) {
  return `
    <span class="score-label">${label} <span class="score-override-badge">override</span></span>
    <div class="score-bar-wrap">
      <div class="score-bar bar-${cls}" style="width:${(userVal*100).toFixed(1)}%;opacity:.5"></div>
    </div>
    <span class="score-val" style="color:var(--${cls})">${Math.round(userVal*100)}% <span style="color:var(--muted);font-size:10px">(LLM: ${Math.round(llmVal*100)}%)</span></span>`;
}

function _mergeButtonsHtml(clip) {
  const byTime = [..._clips].sort((a, b) => a.start_ms - b.start_ms);
  const idx = byTime.findIndex(c => c.id === clip.id);
  const prev = idx > 0 ? byTime[idx - 1] : null;
  const next = idx >= 0 && idx < byTime.length - 1 ? byTime[idx + 1] : null;
  if (!prev && !next) return '';
  return `<div class="op-actions">
    ${prev ? `<button class="btn" onclick="mergeClips(${clip.id},${prev.id},'prev')" title="Merge with previous clip (${prev.start_hms})">← Merge previous</button>` : ''}
    ${next ? `<button class="btn" onclick="mergeClips(${clip.id},${next.id},'next')" title="Merge with next clip (${next.start_hms})">Merge next →</button>` : ''}
  </div>`;
}

async function _reloadClipList(videoId) {
  if (!videoId) return;
  _clips = await fetch(`/api/videos/${videoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
  renderClipList(_applyFilters());
}

function _replaceClipInList(updated) {
  const idx = _clips.findIndex(c => c.id === updated.id);
  if (idx !== -1) _clips[idx] = updated;
}

let _scoreOverrideClipId = null;
let _scoreOverrideOpener = null;

function openScoreOverride(clipId) {
  _scoreOverrideOpener = document.activeElement;
  const clip = _clips.find(c => c.id === clipId);
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
  _clips = _clips.filter(c => c.id !== clipBId);
  _replaceClipInList(updated);
  activeClipId = clipAId;
  renderClipList(_applyFilters());
  renderDetail(updated);
  showToast('Clips merged');
}

function _parseTimingOffset(str) {
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
}

function _openClipDescKebab(clipId, btn, field) {
  const clip    = _activeClipData;
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
  document.getElementById('player-area').innerHTML = `
    <div class="no-export-msg"><div style="color:var(--muted)">Select a clip to review</div></div>`;
  document.getElementById('detail').innerHTML = '<div class="detail-empty">Select a clip from the sidebar<div style="color:var(--muted);font-size:12px;margin-top:6px">Use ← → to navigate between clips</div></div>';
}

// ── filter tabs ───────────────────────────────────────────────────────────────
function setClipFilter(filter) {
  _clipFilter = filter;
  document.querySelectorAll('.clip-tab').forEach(t => {
    const active = t.dataset.filter === filter;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  renderClipList(_applyFilters());
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
  renderClipList(_applyFilters());
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
let _exportOpener = null;

function _onExportCaptionsChange(val) {
  document.getElementById('export-hardsub-warn').style.display = val === 'hardsub' ? '' : 'none';
}

function exportClip(id) {
  _exportOpener = document.activeElement;
  _exportClipId = id;
  document.getElementById('export-captions').value = 'none';
  document.getElementById('export-hardsub-warn').style.display = 'none';
  document.getElementById('export-container').value = '';
  document.getElementById('export-trim-start').value = _fmtOffset(_activeClipData?.start_offset);
  document.getElementById('export-trim-end').value   = _fmtOffset(_activeClipData?.end_offset);
  const retx = document.getElementById('export-retranscribe');
  retx.checked = false;
  document.getElementById('export-retranscribe-model').disabled = true;
  document.getElementById('export-title-card').checked = false;
  document.getElementById('export-settings-modal').classList.add('visible');
  setTimeout(() => document.getElementById('export-captions')?.focus(), 50);
}

function closeExportModal() {
  document.getElementById('export-settings-modal').classList.remove('visible');
  const opener = _exportOpener;
  _exportOpener = null;
  if (opener?.focus) opener.focus();
}

async function confirmExport() {
  const id        = _exportClipId;
  const captions  = document.getElementById('export-captions').value;
  const burnSubs  = captions === 'hardsub';
  const embedSubs = captions === 'softsub';
  const container = document.getElementById('export-container').value;
  const trimStart = _parseTimingOffset(document.getElementById('export-trim-start').value);
  const trimEnd   = _parseTimingOffset(document.getElementById('export-trim-end').value);
  const retx      = document.getElementById('export-retranscribe').checked;
  const retxModel = document.getElementById('export-retranscribe-model').value;
  const titleCard = document.getElementById('export-title-card').checked;
  closeExportModal();

  if (!isNaN(trimStart) && !isNaN(trimEnd)) {
    const timingRes = await fetch(`/api/clips/${id}/timing`, {
      method: 'PATCH', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({start_offset: trimStart, end_offset: trimEnd}),
    }).catch(err => { showToast(`Failed to save trim: ${err.message}`, 'error'); return null; });
    if (!timingRes || !timingRes.ok) {
      if (timingRes) showToast('Failed to save trim points', 'error');
      return;
    }
  }

  const params = new URLSearchParams();
  if (burnSubs)   params.set('burn_subs', 'true');
  if (embedSubs)  params.set('embed_subs', 'true');
  if (container)  params.set('container', container);
  if (retx)       { params.set('retranscribe', 'true'); params.set('retranscribe_model', retxModel); }
  if (titleCard)  params.set('title_card', 'true');
  const qs = params.toString() ? `?${params}` : '';

  const steps = [{label: 'Export', patterns: ['Exporting', 'OK Saved']}];
  if (retx) steps.unshift({label: 'Transcribe', patterns: ['Retranscribing', 'OK']});

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
      await _reloadClipList(activeVideoId);
      loadVideos();
      showToast('Clip exported successfully');
    },
    steps,
    retx ? 'Retranscribing' : 'Exporting',
  );
}

// ── export transcript ─────────────────────────────────────────────────────────
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
      await _reloadClipList(activeVideoId);
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
  await _reloadClipList(videoId);
  await loadVideos();
  showToast('Clip deleted');
}

// ── find similar ──────────────────────────────────────────────────────────────
let _similarClipsClipId = null;
let _similarClipsOpener = null;

function openSimilarClipsModal(clipId) {
  _similarClipsOpener = document.activeElement;
  _similarClipsClipId = clipId;
  const currentVideo = _videos.find(v => v.id === activeVideoId);
  const otherVideos = _videos.filter(v => v.id !== activeVideoId && v.status === 'done');

  const scope = document.getElementById('similar-clips-scope');
  scope.innerHTML = '';

  const addCheck = (id, label, checked) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer';
    row.innerHTML = `<input type="checkbox" data-video-id="${id}" ${checked ? 'checked' : ''}> ${escHtml(label)}`;
    scope.appendChild(row);
  };

  if (currentVideo) addCheck(currentVideo.id, `${currentVideo.title || currentVideo.filename} (this video)`, true);
  for (const v of otherVideos) addCheck(v.id, v.title || v.filename, false);
  if (!currentVideo && !otherVideos.length) {
    scope.innerHTML = '<div style="font-size:12px;color:var(--muted)">No processed videos available</div>';
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

  const checked = Array.from(document.querySelectorAll('#similar-clips-scope input[type=checkbox]:checked'));
  const videoIds = checked.map(el => el.dataset.videoId).join(',');

  closeSimilarClipsModal();

  const btn = document.getElementById('btn-find-similar');
  if (btn) { btn.disabled = true; btn.textContent = 'Searching…'; }
  if (_activeES) { _activeES.close(); _activeES = null; }
  openLog();

  const qs = videoIds ? `?video_ids=${encodeURIComponent(videoIds)}` : '';
  const handle = _openSSE(
    `/api/clips/${clipId}/related-clips${qs}`,
    msg => { appendLog(String(msg)); },
    async msg => {
      if (_activeES === handle) _activeES = null;
      if (btn) { btn.disabled = false; btn.textContent = 'Find Similar'; }
      const clip = await fetch(`/api/clips/${clipId}`).then(r => r.json()).catch(() => null);
      if (clip) { _activeClipData = clip; renderDetail(clip); }
      const count = msg.results?.length ?? 0;
      showToast(count ? `Found ${count} similar clip${count !== 1 ? 's' : ''}` : 'No similar clips found');
    },
    errMsg => {
      if (_activeES === handle) _activeES = null;
      if (btn) { btn.disabled = false; btn.textContent = 'Find Similar'; }
      showToast(`Find Similar failed — ${errMsg}`, 'error');
    },
  );
  _activeES = handle;
}

// ── scoring ───────────────────────────────────────────────────────────────────
function scoreAll() {
  openLog();
  streamSSE(
    '/api/score',
    () => {
      loadVideos();
      _reloadClipList(activeVideoId);
      showToast('Scoring complete');
    },
    SCORE_STEPS,
    'Scoring',
  );
}
