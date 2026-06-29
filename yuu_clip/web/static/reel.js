// ── highlight reels (combined Build + View modal) ──────────────────────────────
let _reelClips = [];

async function openHighlightReelsModal(tab) {
  document.getElementById('highlight-reels-modal').classList.add('visible');
  await switchReelTab(tab || 'build');
}

async function switchReelTab(tab) {
  document.getElementById('reel-tab-build').style.display = tab === 'build' ? '' : 'none';
  document.getElementById('reel-tab-view').style.display  = tab === 'view'  ? '' : 'none';
  document.getElementById('reel-tab-btn-build').classList.toggle('active', tab === 'build');
  document.getElementById('reel-tab-btn-view').classList.toggle('active',  tab === 'view');

  if (tab === 'build') {
    const totalApproved = _videos.reduce((n, v) => n + v.approved, 0);
    if (totalApproved === 0) {
      document.getElementById('demo-status').textContent = '';
      document.getElementById('reel-clip-list').innerHTML =
        '<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No approved clips yet — approve clips from the sidebar, then come back.</div>';
      document.getElementById('reel-estimate').textContent = '';
      return;
    }
    document.getElementById('demo-status').textContent = '';
    const sel = document.getElementById('demo-video-id');
    sel.innerHTML = '<option value="">All approved clips</option>';
    for (const v of _videos) {
      if (!v.approved) continue;
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.filename} (${v.approved} approved)`;
      sel.appendChild(opt);
    }
    await loadReelClips();
  } else {
    const layout = document.getElementById('reels-layout');
    layout.innerHTML = '<div class="reels-empty">Loading&#x2026;</div>';
    const reels = await fetch('/api/demo/list').then(r => r.json()).catch(() => []);
    if (!reels.length) {
      layout.innerHTML = '<div class="reels-empty">No highlight reels yet — build one first.</div>';
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
      item.innerHTML = `<div class="reel-name">${escHtml(reel.filename)}</div><div class="reel-meta">${escHtml(reel.date)} &middot; ${reel.size_mb} MB</div>`;
      item.onclick = () => _playReel(reel, item);
      list.appendChild(item);
    });
    _playReel(reels[0], list.firstChild);
  }
}

function closeHighlightReelsModal() {
  const vid = document.getElementById('reels-video');
  if (vid) { vid.pause(); vid.src = ''; }
  document.getElementById('highlight-reels-modal').classList.remove('visible');
}

async function loadReelClips() {
  const videoIdVal = document.getElementById('demo-video-id').value;
  const qs = videoIdVal ? `?video_id=${videoIdVal}` : '';
  const listEl = document.getElementById('reel-clip-list');
  listEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Loading…</div>';
  try {
    const clips = await fetch(`/api/demo/approved-clips${qs}`).then(r => r.json());
    _reelClips = clips.map(c => ({...c, included: true}));
  } catch {
    _reelClips = [];
  }
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
  _reelClips.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'reel-clip-row' + (c.included ? '' : ' excluded');
    row.innerHTML = `
      <div class="reel-clip-move">
        <button title="Move up" onclick="_reelMove(${i}, -1)">&#9650;</button>
        <button title="Move down" onclick="_reelMove(${i}, 1)">&#9660;</button>
      </div>
      <input type="checkbox" ${c.included ? 'checked' : ''} onchange="_reelToggle(${i}, this.checked)" title="Include in reel">
      <div class="reel-clip-info">
        <div class="reel-clip-name">${escHtml(c.description || `Clip ${c.id}`)}</div>
        <div class="reel-clip-meta">${escHtml(c.start_hms)} · ${escHtml(c.duration_hms)} · ⭐${c.score_overall.toFixed(2)}
          ${c.has_export ? '' : ' · <span style="color:var(--yellow)">not exported</span>'}
        </div>
      </div>`;
    listEl.appendChild(row);
  });
}

function _reelMove(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= _reelClips.length) return;
  [_reelClips[i], _reelClips[j]] = [_reelClips[j], _reelClips[i]];
  renderReelClipList();
  updateReelEstimate();
}

function _reelToggle(i, included) {
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
  const el = document.getElementById('reel-estimate');
  if (!el) return;
  if (!n) {
    el.innerHTML = 'No clips selected';
    return;
  }
  const fmtS = s => s < 60 ? `${s.toFixed(0)}s` : `${Math.floor(s/60)}m ${(s%60).toFixed(0)}s`;
  el.innerHTML =
    `${n} clip(s) · ${fmtS(totalFootageS)} footage · encode ~${fmtS(encodeEtaS)}` +
    (unexported ? `<div class="reel-no-export-warn">⚠ ${unexported} clip(s) not yet exported — export them first or they will be skipped</div>` : '');
}

function closeDemoModal() { closeHighlightReelsModal(); }

async function previewReelPlaylist() {
  const included = _reelClips.filter(c => c.included && c.has_export);
  if (!included.length) {
    showToast('No exported clips selected — export clips first to preview them', 'info');
    return;
  }
  const modal = document.getElementById('reel-preview-modal');
  const vid   = document.getElementById('reel-preview-video');
  const label = document.getElementById('reel-preview-label');
  modal.classList.add('visible');
  let idx = 0;
  const playNext = async () => {
    if (idx >= included.length) {
      label.textContent = 'Playlist complete';
      return;
    }
    const c = included[idx++];
    label.textContent = `Clip ${idx} of ${included.length}`;
    const media = await fetch(`/api/clips/${c.id}/media_url`).then(r => r.json()).catch(() => null);
    if (media?.url) {
      vid.src = media.url;
      vid.onended = playNext;
      vid.play().catch(() => {});
    } else {
      playNext();
    }
  };
  await playNext();
}

function closeReelPreview() {
  const vid = document.getElementById('reel-preview-video');
  vid.pause();
  vid.src = '';
  vid.onended = null;
  document.getElementById('reel-preview-modal').classList.remove('visible');
}

async function startDemo() {
  const included = _reelClips.filter(c => c.included);
  if (!included.length) {
    showToast('No clips selected', 'info');
    return;
  }
  const unexported = included.filter(c => !c.has_export);
  if (unexported.length > 0 && included.length === unexported.length) {
    showToast('None of the selected clips have been exported — export them first', 'error');
    return;
  }

  const body = {
    clip_ids:    included.map(c => c.id),
    transition:  document.getElementById('demo-transition').value,
    trans_dur:   parseFloat(document.getElementById('demo-trans-dur').value),
    title_dur:   parseFloat(document.getElementById('demo-title-dur').value),
    output_name: document.getElementById('demo-output-name').value.trim(),
  };

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
  statusEl.textContent = `Building reel from ${data.clip_count} clip(s)…`;
  closeDemoModal();
  openLog();
  streamSSE(
    '/api/demo/events',
    () => { loadVideos(); showToast('Highlight reel complete!'); openHighlightReelsModal('view'); },
    [{label: 'Building', patterns: ['Generating title', 'Encoding', 'OK']}],
    'Reel',
  );
}

// ── batch export ──────────────────────────────────────────────────────────────
let _batchExportVideoId = null;

function _onBatchCaptionsChange(val) {
  document.getElementById('batch-hardsub-warn').style.display = val === 'hardsub' ? '' : 'none';
}

function openBatchExportModal(videoId) {
  _batchExportVideoId = videoId;
  const video = _videos.find(v => v.id === videoId);
  const modalTitle = document.querySelector('#batch-export-modal h3');
  if (modalTitle) modalTitle.textContent = video ? `Export Approved — ${video.filename}` : 'Export Approved Clips';
  document.getElementById('batch-min-score').value = 0;
  document.getElementById('batch-min-score-val').textContent = '0.00';
  document.getElementById('batch-skip-exported').checked = true;
  document.getElementById('batch-container').value = '';
  document.getElementById('batch-captions').value = 'none';
  document.getElementById('batch-hardsub-warn').style.display = 'none';
  const retx = document.getElementById('batch-retranscribe');
  retx.checked = false;
  document.getElementById('batch-retranscribe-model').disabled = true;
  document.getElementById('batch-export-modal').classList.add('visible');
  updateBatchEstimate();
}

function closeBatchExportModal() {
  document.getElementById('batch-export-modal').classList.remove('visible');
}

function updateBatchEstimate() {
  const minScore = parseFloat(document.getElementById('batch-min-score').value);
  const video = _videos.find(v => v.id === _batchExportVideoId);
  if (!video) return;
  const el = document.getElementById('batch-estimate-line');
  const eligible = _clips
    ? _clips.filter(c => c.status === 'approved' && c.score_overall >= minScore).length
    : video.approved;
  el.textContent = `${eligible} clip(s) match`;
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
    () => { loadVideos(); showToast('Batch export complete'); },
    [{label: 'Exporting', patterns: ['Exporting clip', 'OK clip', 'Skipping']}],
    'Batch Export',
  );
}

function openReelsModal()  { openHighlightReelsModal('view'); }
function closeReelsModal() { closeHighlightReelsModal(); }

function _playReel(reel, itemEl) {
  document.querySelectorAll('#reels-list .reel-item').forEach(el => el.classList.remove('active'));
  itemEl.classList.add('active');
  const vid = document.getElementById('reels-video');
  vid.src = reel.url;
  vid.load();
}
