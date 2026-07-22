// Feature-map - Highlight reel (code: demo_reel; UI "Highlight Reel").
//   API: routes/reel.py · Tests: tests/ui/test_ui_reel.py
// ── highlight reels (combined Build + View modal) ──────────────────────────────
import { AppState } from '../core/state.js';
import { escHtml, plural, formatApiError } from '../core/format.js';
import { showConfirm } from '../core/ui.js';
import { openLog, appendLog, showToast, revealInFolder, _exportRetranscribeDefault } from '../core/utils.js';
import { streamSSE, setJobCancel, _blockedByAnalyze } from '../core/jobs.js';
import { loadVideos } from '../videos/videos.js';
import { _renderExportModeSummary } from '../clips/clipexport.js';
import { releaseVideoRespectingPip } from '../core/preview.js';
import { SoundFx } from '../library/sounds.js';

let _reelClips = [];
let _reelsOpener = null;
// Curation (order + inclusion) lives for one modal session: tab switches keep
// it; reopening the modal or changing the source select starts fresh.
let _reelBuildLoaded = false;

// Preselected "Clips from" source (e.g. a session) applied on the next Build-tab
// population, so a caller can open the reel builder already scoped.
let _reelPendingSource = null;

// Adds one "Session: {name}" option per session that has at least one member with
// approved clips, so the reel pool can span a whole session's recordings.
function _appendSessionScopeOptions(sel) {
  const approvedByVideo = new Map(AppState.videos.map(v => [v.id, v.approved]));
  const usable = (AppState.sessions || []).filter(
    s => s.member_ids.some(id => (approvedByVideo.get(id) || 0) > 0)
  );
  if (!usable.length) return;
  const group = document.createElement('optgroup');
  group.label = 'Sessions';
  for (const s of usable) {
    const approved = s.member_ids.reduce((n, id) => n + (approvedByVideo.get(id) || 0), 0);
    const opt = document.createElement('option');
    opt.value = `session:${s.id}`;
    opt.textContent = `${s.name || s.title || 'Session'} (${approved} approved)`;
    group.appendChild(opt);
  }
  sel.appendChild(group);
}

export function openReelForSession(sessionId, _memberIds) {
  _reelPendingSource = `session:${sessionId}`;
  openHighlightReelsModal('build');
}

export async function openHighlightReelsModal(tab) {
  _reelsOpener = _reelsOpener || document.activeElement;
  _reelBuildLoaded = false;
  _reelPoolStatuses = new Set(['approved']);
  document.querySelectorAll('[data-reel-status]').forEach(chip => {
    const active = chip.dataset.reelStatus === 'approved';
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  document.getElementById('highlight-reels-modal').classList.add('visible');
  await switchReelTab(tab || 'build');
  _prefillReelWordHighlight();
  setTimeout(() => document.querySelector('#highlight-reels-modal .btn')?.focus(), 50);
}

// Word-highlight is a burn-in-only option, so its controls only show when the
// capture mode is "Burn into video", and the words-on-screen count only when
// word-highlight itself is on.
function _onReelCaptionsChange(mode) {
  document.getElementById('demo-word-highlight-row').style.display = mode === 'burnin' ? '' : 'none';
  _onReelWordHighlightChange(document.getElementById('demo-word-highlight').checked);
}

function _onReelWordHighlightChange(enabled) {
  const burnin = document.getElementById('demo-captions').value === 'burnin';
  document.getElementById('demo-chunk-size-row').style.display = (enabled && burnin) ? 'flex' : 'none';
}

async function _prefillReelWordHighlight() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    document.getElementById('demo-word-highlight').checked = !!cfg.caption_word_highlight;
    document.getElementById('demo-chunk-size').value = cfg.caption_word_chunk_size || 4;
  } catch { /* leave defaults */ }
  _onReelCaptionsChange(document.getElementById('demo-captions').value);
}

export async function switchReelTab(tab) {
  document.getElementById('reel-tab-build').style.display = tab === 'build' ? '' : 'none';
  document.getElementById('reel-tab-view').style.display  = tab === 'view'  ? '' : 'none';
  document.getElementById('reel-tab-btn-build').classList.toggle('active', tab === 'build');
  document.getElementById('reel-tab-btn-view').classList.toggle('active',  tab === 'view');

  if (tab === 'build') {
    const totalApproved = AppState.videos.reduce((n, v) => n + v.approved, 0);
    if (totalApproved === 0) {
      _reelClips = [];
      _reelBuildLoaded = false;
      document.getElementById('demo-status').textContent = '';
      document.getElementById('reel-clip-list').innerHTML =
        '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No approved clips yet - approve clips from the sidebar, then come back.</div>';
      document.getElementById('reel-estimate').textContent = '';
      return;
    }
    document.getElementById('demo-status').textContent = '';
    const sel = document.getElementById('demo-video-id');
    const prevSource = _reelPendingSource || sel.value;
    _reelPendingSource = null;
    sel.innerHTML = '<option value="">All approved clips</option>';
    _appendSessionScopeOptions(sel);
    for (const v of AppState.videos) {
      if (!v.approved) continue;
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.filename} (${v.approved} approved)`;
      sel.appendChild(opt);
    }
    sel.value = prevSource;
    if (sel.value !== prevSource) {
      // Selected source lost its approved clips - fall back to all and reload
      sel.value = '';
      _reelBuildLoaded = false;
    }
    if (!_reelBuildLoaded) await loadReelClips();
  } else {
    const layout = document.getElementById('reels-layout');
    layout.innerHTML = '<div class="reels-empty">Loading&#x2026;</div>';
    const reels = await fetch('/api/demo/list').then(r => r.json()).catch(() => []);
    if (!reels.length) {
      layout.innerHTML = '<div class="reels-empty">No highlight reels yet - build one first.</div>';
      return;
    }
    layout.innerHTML = `
      <div class="reels-list" id="reels-list"></div>
      <div class="reels-player-area">
        <video controls id="reels-video"></video>
      </div>
    `;
    const list = document.getElementById('reels-list');
    reels.forEach((reel, i) => {
      const item = document.createElement('div');
      item.className = 'reel-item' + (i === 0 ? ' active' : '');
      const capBadge = reel.has_captions ? ' &middot; <span style="color:var(--green)" title="Captions available">CC</span>' : '';
      const staleBadge = reel.stale ? ' &middot; <span style="color:var(--warning)" title="A member clip was re-exported since this reel was built">Stale - rebuild to update</span>' : '';
      item.innerHTML =
        `<div class="reel-name">${escHtml(reel.filename)}</div>` +
        `<div class="reel-meta">${escHtml(reel.date)} &middot; ${reel.size_mb} MB${capBadge}${staleBadge}</div>`;
      if (reel.can_caption) {
        const capBtn = document.createElement('button');
        capBtn.className = 'btn ghost';
        capBtn.style.cssText = 'font-size:10px;padding:2px 6px;margin-top:4px';
        capBtn.textContent = reel.has_captions ? '↻ Regenerate captions' : '+ Generate captions';
        capBtn.onclick = e => { e.stopPropagation(); _regenReelCaptions(reel, capBtn); };
        item.appendChild(capBtn);
      }
      if (AppState.canReveal) {
        const revealBtn = document.createElement('button');
        revealBtn.className = 'btn ghost';
        revealBtn.style.cssText = 'font-size:10px;padding:2px 6px;margin-top:4px';
        revealBtn.textContent = 'Show in Folder';
        revealBtn.onclick = e => {
          e.stopPropagation();
          const sep = AppState.reelsDir && AppState.reelsDir.includes('\\') ? '\\' : '/';
          revealInFolder(`${AppState.reelsDir}${sep}${reel.filename}`);
        };
        item.appendChild(revealBtn);
      }
      const delBtn = document.createElement('button');
      delBtn.className = 'btn ghost danger';
      delBtn.style.cssText = 'font-size:10px;padding:2px 6px;margin-top:4px';
      delBtn.textContent = 'Delete';
      delBtn.onclick = e => { e.stopPropagation(); _deleteReel(reel); };
      item.appendChild(delBtn);
      item.onclick = () => _playReel(reel, item);
      list.appendChild(item);
    });
    _playReel(reels[0], list.firstChild);
  }
}

export function closeHighlightReelsModal() {
  const vid = document.getElementById('reels-video');
  if (vid) releaseVideoRespectingPip(vid, () => { vid.pause(); vid.src = ''; });
  document.getElementById('highlight-reels-modal').classList.remove('visible');
  const opener = _reelsOpener;
  _reelsOpener = null;
  if (opener?.focus) opener.focus();
}

// Status filter for the reel builder's clip pool - Approved only by default,
// matching the historical /api/demo/approved-clips behavior.
let _reelPoolStatuses = new Set(['approved']);

function _reelPoolQs() {
  const params = new URLSearchParams();
  const sourceVal = document.getElementById('demo-video-id').value;
  if (sourceVal.startsWith('session:')) {
    const sessionId = parseInt(sourceVal.slice('session:'.length), 10);
    const session = (AppState.sessions || []).find(s => s.id === sessionId);
    if (session && session.member_ids.length) params.set('video_ids', session.member_ids.join(','));
  } else if (sourceVal) {
    params.set('video_id', sourceVal);
  }
  params.set('statuses', [..._reelPoolStatuses].join(','));
  return `?${params.toString()}`;
}

// Toggling a chip must never leave zero statuses selected - the API rejects
// an empty statuses param, and an empty pool with no way back out is a trap.
function _toggleReelPoolStatus(status) {
  if (_reelPoolStatuses.has(status)) {
    if (_reelPoolStatuses.size === 1) return;
    _reelPoolStatuses.delete(status);
  } else {
    _reelPoolStatuses.add(status);
  }
  document.querySelectorAll('[data-reel-status]').forEach(chip => {
    const active = _reelPoolStatuses.has(chip.dataset.reelStatus);
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  _refetchReelPool();
}

async function loadReelClips() {
  _reelClips = [];
  await _refetchReelPool();
}

// Fetches the current status/video pool and merges it into _reelClips:
// clips still in the pool keep their order and included/excluded state;
// clips newly entering the pool are appended, defaulting to excluded unless
// they're approved - so toggling on Unreviewed/Rejected can't silently stuff
// clips into the reel. Clips that fell out of the pool are dropped.
async function _refetchReelPool() {
  const listEl = document.getElementById('reel-clip-list');
  if (!_reelBuildLoaded) {
    listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Loading…</div>';
  }
  let fresh;
  try {
    fresh = await fetch(`/api/demo/approved-clips${_reelPoolQs()}`).then(r => r.json());
    _reelBuildLoaded = true;
  } catch {
    fresh = null;
  }
  if (!fresh) {
    _reelClips = [];
    _reelBuildLoaded = false;
    renderReelClipList();
    updateReelEstimate();
    return;
  }
  const freshById = new Map(fresh.map(c => [c.id, c]));
  const kept = _reelClips.filter(c => freshById.has(c.id)).map(c => ({...c, ...freshById.get(c.id), included: c.included}));
  const keptIds = new Set(kept.map(c => c.id));
  const added = fresh.filter(c => !keptIds.has(c.id)).map(c => ({...c, included: c.status === 'approved'}));
  _reelClips = [...kept, ...added];
  renderReelClipList();
  updateReelEstimate();
}

function renderReelClipList() {
  const listEl = document.getElementById('reel-clip-list');
  if (!_reelClips.length) {
    listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">No approved clips found</div>';
    return;
  }
  listEl.innerHTML = '';
  listEl.ondragover = _reelListDragOver;
  _reelClips.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'reel-clip-row' + (c.included ? '' : ' excluded');
    row.dataset.clipId = c.id;
    row.innerHTML = `
      <div class="reel-clip-drag" title="Drag to reorder">&#x2830;&#x2830;</div>
      <div class="reel-clip-move">
        <button title="Move up" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
        <button title="Move down" ${i === _reelClips.length - 1 ? 'disabled' : ''}>&#9660;</button>
      </div>
      <input type="checkbox" ${c.included ? 'checked' : ''} title="Include in reel">
      <div class="reel-clip-info">
        <div class="reel-clip-name">${escHtml(c.description || `Clip ${c.id}`)}</div>
        <div class="reel-clip-meta">${escHtml(c.start_hms)} · ${escHtml(c.duration_hms)} · &#11088;${Math.round(c.score_overall*100)}%
          ${c.has_export ? '' : ' · <span style="color:var(--warning)">not exported</span>'}
        </div>
      </div>`;
    const [moveUpBtn, moveDownBtn] = row.querySelectorAll('.reel-clip-move button');
    moveUpBtn.onclick = () => _reelMove(i, -1);
    moveDownBtn.onclick = () => _reelMove(i, 1);
    row.querySelector('input[type="checkbox"]').onchange = e => _reelToggle(i, e.target.checked);
    _wireReelRowDrag(row);
    listEl.appendChild(row);
  });
}

// Rows are draggable only while the grip is pressed, so text selection and the
// checkbox keep working; the ▲▼ buttons remain the keyboard path.
function _wireReelRowDrag(row) {
  const handle = row.querySelector('.reel-clip-drag');
  handle.addEventListener('mousedown', () => { row.draggable = true; });
  row.addEventListener('dragstart', e => {
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.clipId);
  });
  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    row.draggable = false;
    _commitReelDomOrder();
  });
}

function _reelListDragOver(e) {
  const listEl = e.currentTarget;
  const dragging = listEl.querySelector('.reel-clip-row.dragging');
  if (!dragging) return;
  e.preventDefault();
  const rows = [...listEl.querySelectorAll('.reel-clip-row:not(.dragging)')];
  const rowBelow = rows.find(el => {
    const box = el.getBoundingClientRect();
    return e.clientY < box.top + box.height / 2;
  });
  if (rowBelow) listEl.insertBefore(dragging, rowBelow);
  else listEl.appendChild(dragging);
}

function _commitReelDomOrder() {
  const listEl = document.getElementById('reel-clip-list');
  const domOrder = [...listEl.querySelectorAll('.reel-clip-row')].map(el => Number(el.dataset.clipId));
  _reelClips.sort((a, b) => domOrder.indexOf(a.id) - domOrder.indexOf(b.id));
  renderReelClipList();
  updateReelEstimate();
}

export function _reelMove(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= _reelClips.length) return;
  [_reelClips[i], _reelClips[j]] = [_reelClips[j], _reelClips[i]];
  renderReelClipList();
  updateReelEstimate();
}

export function _reelToggle(i, included) {
  _reelClips[i].included = included;
  renderReelClipList();
  updateReelEstimate();
}

function updateReelEstimate() {
  const included = _reelClips.filter(c => c.included);
  const n = included.length;
  const totalFootageMs = included.reduce((s, c) => s + c.duration_ms, 0);
  const titleDur = parseFloat(document.getElementById('demo-title-dur')?.value || 3);
  const transDur = parseFloat(document.getElementById('demo-trans-dur')?.value || 0.5);
  const transition = document.getElementById('demo-transition')?.value || 'fade';

  const totalFootageS = totalFootageMs / 1000;
  let encodeEtaS = 0;
  if (transition === 'none') {
    encodeEtaS = 5;
  } else {
    const totalEncodeS = totalFootageS + n * titleDur;
    encodeEtaS = totalEncodeS / 3;
  }

  const unexported = included.filter(c => !c.has_export).length;
  const exportBtn = document.getElementById('reel-export-btn');
  if (exportBtn) {
    exportBtn.style.display = unexported > 0 ? '' : 'none';
    exportBtn.textContent = `⬇ Export ${plural(unexported, 'clip')}`;
  }
  const el = document.getElementById('reel-estimate');
  if (!el) return;
  if (!n) {
    el.innerHTML = 'No clips selected';
    return;
  }
  const fmtS = s => s < 60 ? `${s.toFixed(0)}s` : `${Math.floor(s/60)}m ${(s%60).toFixed(0)}s`;
  el.innerHTML =
    `${plural(n, 'clip')} · ${fmtS(totalFootageS)} footage · encode ~${fmtS(encodeEtaS)}` +
    (unexported ? `<div class="reel-no-export-warn">⚠ ${plural(unexported, 'clip')} not yet exported - export them first or they will be skipped</div>` : '');
}

async function exportUnexportedReelClips() {
  if (_blockedByAnalyze('export clips')) return;
  const toExport = _reelClips.filter(c => c.included && !c.has_export);
  if (!toExport.length) {
    showToast('All selected clips are already exported', 'info');
    return;
  }
  const ids = toExport.map(c => c.id).join(',');
  const statusEl = document.getElementById('demo-status');
  statusEl.style.color = 'var(--muted)';
  statusEl.textContent = `Exporting ${plural(toExport.length, 'clip')}…`;
  openLog();
  streamSSE(
    `/api/clips/bulk-export?clip_ids=${encodeURIComponent(ids)}`,
    () => {
      statusEl.textContent = '';
      showToast('Clips exported');
      SoundFx.play('export');
      _refreshReelExportStatus();
      loadVideos();
    },
    [{label: 'Exporting', patterns: ['Exporting clip', 'OK clip', 'Skipping']}],
    'Export',
  );
}

// Refresh has_export on the current clip list without discarding the user's
// order/inclusion choices (loadReelClips() would reset both).
async function _refreshReelExportStatus() {
  const fresh = await fetch(`/api/demo/approved-clips${_reelPoolQs()}`).then(r => r.json()).catch(() => null);
  if (!fresh) return;
  const exportById = new Map(fresh.map(c => [c.id, c.has_export]));
  _reelClips.forEach(c => { if (exportById.has(c.id)) c.has_export = exportById.get(c.id); });
  renderReelClipList();
  updateReelEstimate();
}

function closeDemoModal() { closeHighlightReelsModal(); }

let _reelPreviewOpener = null;
let _reelPreviewList = [];
let _reelPreviewIdx = 0;

async function previewReelPlaylist() {
  const included = _reelClips.filter(c => c.included && c.has_export);
  if (!included.length) {
    showToast('No exported clips selected - export clips first to preview them', 'warning');
    return;
  }
  _reelPreviewOpener = document.activeElement;
  _reelPreviewList = included;
  document.getElementById('reel-preview-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#reel-preview-modal .btn')?.focus(), 50);
  await _reelPreviewPlay(0);
}

async function _reelPreviewPlay(idx) {
  const vid   = document.getElementById('reel-preview-video');
  const label = document.getElementById('reel-preview-label');
  if (idx >= _reelPreviewList.length) {
    _reelPreviewIdx = _reelPreviewList.length;  // Previous from here returns to the last clip
    label.textContent = 'Playlist complete';
    vid.pause();
    _updateReelPreviewNav();
    return;
  }
  _reelPreviewIdx = idx;
  label.textContent = `Clip ${idx + 1} of ${_reelPreviewList.length}`;
  _updateReelPreviewNav();
  const c = _reelPreviewList[idx];
  const media = await fetch(`/api/clips/${c.id}/media_url`).then(r => r.json()).catch(() => null);
  if (media?.url) {
    vid.src = media.url;
    vid.onended = () => _reelPreviewPlay(_reelPreviewIdx + 1);
    vid.play().catch(() => {});
  } else {
    await _reelPreviewPlay(idx + 1);
  }
}

function _reelPreviewStep(dir) {
  const target = _reelPreviewIdx + dir;
  if (target < 0 || target >= _reelPreviewList.length) return;
  _reelPreviewPlay(target);
}

function _updateReelPreviewNav() {
  const prev = document.getElementById('reel-preview-prev');
  const next = document.getElementById('reel-preview-next');
  if (!prev || !next) return;
  prev.disabled = _reelPreviewIdx <= 0;
  next.disabled = _reelPreviewIdx >= _reelPreviewList.length - 1;
}

export function closeReelPreview() {
  const vid = document.getElementById('reel-preview-video');
  releaseVideoRespectingPip(vid, () => { vid.pause(); vid.src = ''; vid.onended = null; });
  document.getElementById('reel-preview-modal').classList.remove('visible');
  const opener = _reelPreviewOpener;
  _reelPreviewOpener = null;
  if (opener?.focus) opener.focus();
}

async function startDemo() {
  const included = _reelClips.filter(c => c.included);
  if (!included.length) {
    showToast('No clips selected', 'warning');
    return;
  }
  const unexported = included.filter(c => !c.has_export);
  if (unexported.length > 0 && included.length === unexported.length) {
    showToast('None of the selected clips have been exported - export them first', 'warning');
    return;
  }

  const captionMode = document.getElementById('demo-captions').value;
  const body = {
    clip_ids:    included.map(c => c.id),
    transition:  document.getElementById('demo-transition').value,
    trans_dur:   parseFloat(document.getElementById('demo-trans-dur').value),
    title_dur:   parseFloat(document.getElementById('demo-title-dur').value),
    output_name: document.getElementById('demo-output-name').value.trim(),
    captions:      captionMode !== 'none',
    bake_captions: captionMode === 'burnin',
  };
  if (captionMode === 'burnin') {
    body.word_highlight = document.getElementById('demo-word-highlight').checked;
    if (body.word_highlight) {
      const chunkRaw = document.getElementById('demo-chunk-size').value.trim();
      if (chunkRaw !== '') body.word_chunk_size = parseInt(chunkRaw, 10);
    }
  }

  const statusEl = document.getElementById('demo-status');
  statusEl.style.color = 'var(--muted)';
  statusEl.textContent = 'Starting…';

  const res = await fetch('/api/demo/start', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body:   JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json();
    statusEl.style.color = 'var(--red)';
    statusEl.textContent = e.detail || 'Failed to start reel build.';
    return;
  }
  const data = await res.json();
  const skipNote = unexported.length ? ` - ${plural(unexported.length, 'unexported clip')} skipped` : '';
  statusEl.textContent = `Building reel from ${plural(data.clip_count, 'clip')}…${skipNote}`;
  closeDemoModal();
  openLog();
  if (unexported.length) appendLog(`[Skipping ${plural(unexported.length, 'clip')} not yet exported]`);
  streamSSE(
    '/api/demo/events',
    () => {
      loadVideos();
      showToast(`Highlight reel complete!${skipNote}`, 'success');
      openHighlightReelsModal('view');
      SoundFx.play('reel');
    },
    [{label: 'Building', patterns: ['Generating title', 'Encoding', 'OK']}],
    'Reel',
    true,
  );
  setJobCancel({
    url:     '/api/analyze/cancel',
    title:   'Cancel reel build?',
    body:    'The reel build will stop and no reel file will be saved. You can start it again anytime.',
    confirm: 'Cancel Build',
    logMsg:  '[Reel build cancelled]',
  });
}

// ── batch export ──────────────────────────────────────────────────────────────
let _batchExportVideoId = null;
let _batchExportOpener = null;

function _updateBatchModeSummary() {
  _renderExportModeSummary(
    document.getElementById('batch-mode-summary'),
    document.getElementById('batch-captions').value === 'hardsub',
    false,
    document.getElementById('batch-retranscribe').checked,
  );
}

function _onBatchCaptionsChange() {
  _updateBatchModeSummary();
}

function _onBatchRetranscribeChange(checked) {
  document.getElementById('batch-retranscribe-model').disabled = !checked;
  _updateBatchModeSummary();
}

export async function openBatchExportModal(videoId) {
  _batchExportOpener = document.activeElement;
  _batchExportVideoId = videoId;
  const video = AppState.videos.find(v => v.id === videoId);
  const modalTitle = document.querySelector('#batch-export-modal h3');
  if (modalTitle) modalTitle.textContent = video ? `Export Approved - ${video.filename}` : 'Export Approved Clips';
  document.getElementById('batch-min-score').value = 0;
  document.getElementById('batch-min-score-val').textContent = '0%';
  document.getElementById('batch-skip-exported').checked = true;
  document.getElementById('batch-container').value = '';
  document.getElementById('batch-captions').value = 'softsub';
  const retx      = document.getElementById('batch-retranscribe');
  const retxModel = document.getElementById('batch-retranscribe-model');
  const { model, needsRetranscribe } = await _exportRetranscribeDefault(videoId);
  retxModel.value = model;
  retx.checked = needsRetranscribe;
  _onBatchRetranscribeChange(needsRetranscribe);
  document.getElementById('batch-export-modal').classList.add('visible');
  updateBatchEstimate();
  setTimeout(() => document.getElementById('batch-min-score')?.focus(), 50);
}

export function closeBatchExportModal() {
  document.getElementById('batch-export-modal').classList.remove('visible');
  const opener = _batchExportOpener;
  _batchExportOpener = null;
  if (opener?.focus) opener.focus();
}

function updateBatchEstimate() {
  const minScore = parseFloat(document.getElementById('batch-min-score').value);
  const video = AppState.videos.find(v => v.id === _batchExportVideoId);
  if (!video) return;
  const el = document.getElementById('batch-estimate-line');
  const eligible = AppState.clips
    ? AppState.clips.filter(c => c.status === 'approved' && c.score_overall >= minScore).length
    : video.approved;
  el.textContent = `${plural(eligible, 'clip')} ${eligible === 1 ? 'matches' : 'match'}`;
}

async function confirmBatchExport() {
  const id = _batchExportVideoId;
  const minScore   = parseFloat(document.getElementById('batch-min-score').value);
  const skipExp    = document.getElementById('batch-skip-exported').checked;
  const container  = document.getElementById('batch-container').value;
  const captions   = document.getElementById('batch-captions').value;
  const retx       = document.getElementById('batch-retranscribe').checked;
  const retxModel  = document.getElementById('batch-retranscribe-model').value;
  closeBatchExportModal();

  const params = new URLSearchParams({min_score: minScore});
  if (!skipExp) params.set('skip_exported', 'false');
  if (container) params.set('container', container);
  if (captions === 'hardsub') params.set('burn_subs', 'true');
  if (captions === 'softsub') params.set('embed_subs', 'true');
  if (retx) { params.set('retranscribe', 'true'); params.set('retranscribe_model', retxModel); }

  openLog();
  streamSSE(
    `/api/videos/${id}/batch-export?${params}`,
    () => { loadVideos(); showToast('Batch export complete'); SoundFx.play('export'); },
    [{label: 'Exporting', patterns: ['Exporting clip', 'OK clip', 'Skipping']}],
    'Batch Export',
  );
}

function _playReel(reel, itemEl) {
  document.querySelectorAll('#reels-list .reel-item').forEach(el => el.classList.remove('active'));
  itemEl.classList.add('active');
  const vid = document.getElementById('reels-video');
  vid.innerHTML = '';
  vid.src = reel.url;
  if (reel.has_captions) {
    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = 'Captions';
    track.srclang = 'en';
    track.default = true;
    track.src = `/api/demo/${encodeURIComponent(reel.filename)}/captions.vtt`;
    vid.appendChild(track);
  }
  vid.load();
}

function _deleteReel(reel) {
  showConfirm(
    'Delete highlight reel?',
    `"${escHtml(reel.filename)}" will be permanently removed from disk, along with its captions. Your clips are not affected.`,
    'Delete Reel',
    async () => {
      // Release the player's file handle first - on Windows the server keeps the
      // reel open while the <video> is connected, blocking the delete.
      const vid = document.getElementById('reels-video');
      if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
      await new Promise(resolve => setTimeout(resolve, 400));
      const res = await fetch(`/api/demo/${encodeURIComponent(reel.filename)}`, {method: 'DELETE'});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(`Failed to delete reel: ${formatApiError(err)}`, 'error');
      } else {
        showToast('Highlight reel deleted');
      }
      switchReelTab('view');
    },
    true,
  );
}

async function _regenReelCaptions(reel, btn) {
  if (_blockedByAnalyze('generate captions')) return;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const res = await fetch(`/api/demo/${encodeURIComponent(reel.filename)}/captions`, {method: 'POST'});
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      showToast(e.detail || 'Could not generate captions', 'error');
      btn.textContent = original;
      btn.disabled = false;
      return;
    }
    showToast('Captions generated');
    switchReelTab('view');  // refresh badge + player track
  } catch {
    showToast('Could not generate captions', 'error');
    btn.textContent = original;
    btn.disabled = false;
  }
}

// ── static modal wiring (replaces the inline onclick=/oninput=/onchange= these
// modals used to own in index.html) ────────────────────────────────────────────
// The nav button and all three modals below are fixed, never-recreated elements
// in index.html, so wiring them once at module load can't double-fire on a
// re-render.
function _wireHighlightReelsModal() {
  const modal = document.getElementById('highlight-reels-modal');
  modal.addEventListener('click', e => { if (e.target === modal) closeHighlightReelsModal(); });
  document.getElementById('reel-close-btn').addEventListener('click', () => closeHighlightReelsModal());
  document.getElementById('reel-tab-btn-build').addEventListener('click', () => switchReelTab('build'));
  document.getElementById('reel-tab-btn-view').addEventListener('click', () => switchReelTab('view'));
  document.getElementById('demo-video-id').addEventListener('change', () => loadReelClips());
  document.querySelectorAll('[data-reel-status]').forEach(chip => {
    chip.addEventListener('click', () => _toggleReelPoolStatus(chip.dataset.reelStatus));
  });
  document.getElementById('reel-refresh-btn').addEventListener('click', () => loadReelClips());
  document.getElementById('demo-transition').addEventListener('change', () => updateReelEstimate());
  document.getElementById('demo-trans-dur').addEventListener('change', () => updateReelEstimate());
  document.getElementById('demo-title-dur').addEventListener('change', () => updateReelEstimate());
  document.getElementById('demo-captions').addEventListener('change', e => _onReelCaptionsChange(e.target.value));
  document.getElementById('demo-word-highlight').addEventListener('change', e => _onReelWordHighlightChange(e.target.checked));
  document.getElementById('reel-build-cancel-btn').addEventListener('click', () => closeHighlightReelsModal());
  document.getElementById('reel-preview-open-btn').addEventListener('click', () => previewReelPlaylist());
  document.getElementById('reel-export-btn').addEventListener('click', () => exportUnexportedReelClips());
  document.getElementById('reel-build-btn').addEventListener('click', () => startDemo());
  document.getElementById('reel-view-close-btn').addEventListener('click', () => closeHighlightReelsModal());
}

function _wireReelPreviewModal() {
  const modal = document.getElementById('reel-preview-modal');
  modal.addEventListener('click', e => { if (e.target === modal) closeReelPreview(); });
  document.getElementById('reel-preview-prev').addEventListener('click', () => _reelPreviewStep(-1));
  document.getElementById('reel-preview-next').addEventListener('click', () => _reelPreviewStep(1));
  document.getElementById('reel-preview-close-btn').addEventListener('click', () => closeReelPreview());
}

function _wireBatchExportModal() {
  const modal = document.getElementById('batch-export-modal');
  modal.addEventListener('click', e => { if (e.target === modal) closeBatchExportModal(); });
  document.getElementById('batch-min-score').addEventListener('input', e => {
    document.getElementById('batch-min-score-val').textContent = `${Math.round(parseFloat(e.target.value) * 100)}%`;
    updateBatchEstimate();
  });
  document.getElementById('batch-captions').addEventListener('change', e => _onBatchCaptionsChange(e.target.value));
  document.getElementById('batch-retranscribe').addEventListener('change', e => _onBatchRetranscribeChange(e.target.checked));
  document.getElementById('batch-cancel-btn').addEventListener('click', () => closeBatchExportModal());
  document.getElementById('batch-export-x-btn').addEventListener('click', () => closeBatchExportModal());
  document.getElementById('batch-confirm-btn').addEventListener('click', () => confirmBatchExport());
}

// Called once from boot.js at first paint (see initHotwordListeners in hotwords.js
// for the reference pattern) so importing this module has no DOM side effect.
export function initReelListeners() {
  document.getElementById('btn-highlight-reels').addEventListener('click', () => openHighlightReelsModal('build'));
  _wireHighlightReelsModal();
  _wireReelPreviewModal();
  _wireBatchExportModal();
}
