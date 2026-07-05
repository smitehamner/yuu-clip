(function () {
// ── clips ─────────────────────────────────────────────────────────────────────
function _applyFilters() {
  const f = AppState.clipFilters;
  let result = AppState.clips;
  if (f && f.size) {
    const statuses = ['pending', 'approved', 'rejected'].filter(s => f.has(s));
    if (statuses.length) result = result.filter(c => statuses.includes(c.status));
    if (f.has('exported') && !f.has('not-exported')) result = result.filter(c => c.has_export);
    else if (f.has('not-exported') && !f.has('exported')) result = result.filter(c => !c.has_export);
    if (f.has('error')) result = result.filter(c => (c.tags || []).includes('llm_error'));
    if (f.has('flagged')) result = result.filter(c => (c.sensitive_matches || []).length > 0);
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
  return result;
}

// Canonical clip re-render entry point. Always routes through _applyFilters()
// so a re-render can't accidentally bypass the active search/status/score
// filters. Call this — never _renderClipItems directly — after mutating AppState.clips.
function _renderClips() {
  _pruneClipSelection();
  const shown = _applyFilters();
  _renderClipItems(shown);
  _renderClipStatsLine(shown);
  _renderBatchStatusPanel();
}

// Collapsible summary bar above the filter chips: status counts for the
// selected recording (not the filtered/shown subset — see the stats line for
// that) plus an in-flight job indicator. Clicking a count applies the
// matching filter chip. Derived entirely from AppState.clips and the
// existing job-status pill — no new endpoints.
function _renderBatchStatusPanel() {
  const panel = document.getElementById('batch-status-panel');
  if (!panel) return;
  if (!AppState.activeVideoId || !AppState.clips.length) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = '';

  const counts = {pending: 0, approved: 0, rejected: 0};
  let errorCount = 0;
  for (const c of AppState.clips) {
    counts[c.status] = (counts[c.status] || 0) + 1;
    if ((c.tags || []).includes('llm_error')) errorCount++;
  }
  const jobRunning = document.getElementById('job-status')?.classList.contains('visible') || false;
  const collapsed = localStorage.getItem('yuuclip-batch-panel') === 'collapsed';

  panel.classList.toggle('collapsed', collapsed);
  document.getElementById('batch-status-toggle').setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  document.getElementById('batch-status-summary').textContent =
    `${counts.pending} unreviewed · ${counts.approved} approved · ${counts.rejected} rejected` +
    (errorCount ? ` · ${plural(errorCount, 'scoring error')}` : '') +
    (jobRunning ? ' · job running…' : '');

  document.getElementById('batch-status-body').innerHTML = `
    <button class="batch-status-count" onclick="toggleClipFilter('pending')">${counts.pending} Unreviewed</button>
    <button class="batch-status-count" onclick="toggleClipFilter('approved')">${counts.approved} Approved</button>
    <button class="batch-status-count" onclick="toggleClipFilter('rejected')">${counts.rejected} Rejected</button>
    ${errorCount ? `<button class="batch-status-count" onclick="toggleClipFilter('error')">${plural(errorCount, 'scoring error')}</button>` : ''}
    ${jobRunning ? `<span class="batch-status-job">&#9679; Job running…</span>` : ''}
  `;
}

function _toggleBatchStatusPanel() {
  const collapsed = localStorage.getItem('yuuclip-batch-panel') === 'collapsed';
  localStorage.setItem('yuuclip-batch-panel', collapsed ? 'expanded' : 'collapsed');
  _renderBatchStatusPanel();
}

function _renderClipStatsLine(shown) {
  const el = document.getElementById('clip-stats-line');
  if (!el) return;
  if (!AppState.activeVideoId || !AppState.clips.length) {
    el.style.display = 'none';
    return;
  }
  const counts = {pending: 0, approved: 0, rejected: 0};
  for (const c of AppState.clips) counts[c.status] = (counts[c.status] || 0) + 1;
  const totalSeconds = shown.reduce((sum, c) => {
    const len = c.end_s - c.start_s;
    return sum + (Number.isFinite(len) ? len : 0);
  }, 0);
  el.textContent = `${shown.length} shown · ${counts.pending} unreviewed · ` +
    `${counts.approved} approved · ${counts.rejected} rejected · ${fmtDuration(totalSeconds)} total`;
  el.style.display = '';
}

// ── multi-select bulk actions ────────────────────────────────────────────────
// Drops selected IDs for clips that no longer exist (e.g. after a delete).
// Deliberately does NOT drop IDs just because a filter hides them — switching
// filter tabs shouldn't silently lose the user's selection.
function _pruneClipSelection() {
  const existingIds = new Set(AppState.clips.map(c => c.id));
  for (const id of AppState.selectedClipIds) {
    if (!existingIds.has(id)) AppState.selectedClipIds.delete(id);
  }
}

// The set of currently-selected clips that also pass the active filters — the
// only clips a bulk action may touch, so a hidden-but-checked clip from before
// a filter change is never silently included.
function _visibleSelectedClips() {
  return _applyFilters().filter(c => AppState.selectedClipIds.has(c.id));
}

function _toggleClipSelection(id, checked) {
  if (checked) AppState.selectedClipIds.add(id);
  else AppState.selectedClipIds.delete(id);
  _updateBulkToolbar();
}

function _clearClipSelection() {
  AppState.selectedClipIds.clear();
  _renderClips();
}

function _updateBulkToolbar() {
  const toolbar = document.getElementById('clip-bulk-toolbar');
  const count = _visibleSelectedClips().length;
  toolbar.style.display = count ? 'flex' : 'none';
  document.getElementById('clip-bulk-count').textContent = `${count} selected`;
}

function _clearClipFilters() {
  AppState.clipFilters.clear();
  AppState.clipSearch = '';
  AppState.clipScoreMin = 0;
  _syncFilterChips();
  const searchEl = document.getElementById('clip-search-input');
  if (searchEl) searchEl.value = '';
  const scoreEl = document.getElementById('clip-score-min');
  if (scoreEl) scoreEl.value = '0';
  _renderClips();
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
}

// Export (has-file) chips are mutually exclusive — "Exported" and "Not exported"
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

function setClipSearch(q) {
  AppState.clipSearch = q.trim();
  _renderClips();
}

function setClipScoreMin(val) {
  AppState.clipScoreMin = parseFloat(val) || 0;
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

function _renderClipItems(clips) {
  const list = document.getElementById('clip-list');
  list.innerHTML = '';
  if (!clips.length) {
    const _statusLabel = {pending: 'Unreviewed', approved: 'Approved', rejected: 'Rejected'};
    const hasActiveFilter = AppState.clipFilters.size > 0 || AppState.clipSearch || AppState.clipScoreMin > 0;
    const isFlaggedOnly = AppState.clipFilters.size === 1 && AppState.clipFilters.has('flagged') &&
      !AppState.clipSearch && AppState.clipScoreMin === 0;
    const filterMsg = isFlaggedOnly
      ? `No flagged clips — add Sensitive Terms in <a href="#" style="color:var(--accent);text-decoration:underline" onclick="event.preventDefault();openSettings()">Settings</a>`
      : hasActiveFilter
      ? `No clips match the current filters — <a href="#" style="color:var(--accent);text-decoration:underline" onclick="event.preventDefault();_clearClipFilters()">Clear filters</a>`
      : `No clips found — <a href="#" style="color:var(--accent);text-decoration:underline" onclick="event.preventDefault();openNewRecordingPanel()">Analyze another recording</a>`;
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
        <span class="clip-num" title="Clip #${c.id}">#${c.id}</span>
        <span class="clip-time">${c.start_hms} &middot; ${c.duration_hms}</span>
        ${c.has_export
          ? (c.export_stale
              ? `<span class="export-pill is-stale" title="Stale — re-export to update (${escHtml((c.export_stale_reasons || []).join(', '))})">Stale</span>`
              : `<span class="export-pill is-exported" title="Clip has been exported">${(() => {
                  const n = (c.exports || []).filter(e => e.exists).length;
                  return n > 1 ? `Exported &times;${n}` : 'Exported';
                })()}</span>`)
          : '<span class="export-pill not-exported" title="Not yet exported">Not exported</span>'}
        <span class="status-dot dot-${c.status}" title="${c.status === 'approved' ? 'Approved' : c.status === 'rejected' ? 'Rejected' : 'Unreviewed'}">${c.status === 'approved' ? '✓' : c.status === 'rejected' ? '✕' : ''}</span>
        ${(c.sensitive_matches || []).length ? '<span class="clip-flag-badge" title="Contains flagged terms">&#9888;</span>' : ''}
      </div>
      <div class="clip-scores" aria-label="${c.scored_at ? `Scores: overall ${Math.round(c.score_overall*100)}%, funny ${Math.round(c.score_funny*100)}%, dramatic ${Math.round(c.score_dramatic*100)}%, action ${Math.round(c.score_action*100)}%${c.score_laugh != null ? `, laughs ${Math.round(c.score_laugh*100)}%` : ''}` : 'Not yet scored'}">
        ${c.scored_at ? `
        <span aria-hidden="true" title="Overall">${_scoreIcon(c.score_overall)} ${Math.round(c.score_overall*100)}%</span>
        <span aria-hidden="true" title="Funny"><span>😂</span> ${Math.round(c.score_funny*100)}%</span>
        <span aria-hidden="true" title="Dramatic"><span>🎭</span> ${Math.round(c.score_dramatic*100)}%</span>
        <span aria-hidden="true" title="Action"><span>⚔️</span> ${Math.round(c.score_action*100)}%</span>
        ${c.score_laugh != null ? `<span aria-hidden="true" title="Laughs"><span>🤣</span> ${Math.round(c.score_laugh*100)}%</span>` : ''}
        ` : `<span style="color:var(--muted);font-size:12px" title="This clip has not been scored yet">Not yet scored</span>`}
      </div>
      ${c.description ? `<div class="clip-desc-preview" title="${escHtml(c.description)}">${escHtml(c.description)}</div>` : ''}
      ${_hotwordPillsHTML(c.hotword_matches)}`;
    const checkbox = li.querySelector('.clip-select-checkbox');
    checkbox.checked = AppState.selectedClipIds.has(c.id);
    checkbox.onclick = e => e.stopPropagation();
    checkbox.onchange = () => _toggleClipSelection(c.id, checkbox.checked);
    const _activateClip = () => selectClip(c.id);
    li.onclick = _activateClip;
    li.onkeydown = e => {
      if (e.target !== li) return;  // don't hijack Space on the checkbox
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _activateClip(); }
    };
    list.appendChild(li);
  }
  _updateBulkToolbar();
}

async function selectClip(id) {
  AppState.activeClipId = id;
  // Sync the sidebar highlight here so every caller — row click, arrow-key
  // navigation, related-clip links, post-retranscribe restore — moves it.
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

// Advances to the next clip in the current filtered/sorted order — same path
// arrow-key navigation uses — and stops silently at the end of the list.
function _playNextClip() {
  const idx = AppState.clips.findIndex(c => c.id === AppState.activeClipId);
  if (idx === -1 || idx >= AppState.clips.length - 1) return;
  const nextId = AppState.clips[idx + 1].id;
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
// Removing the element alone is not enough — the media resource must be released
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
function _fmtSizeMb(bytes) {
  if (bytes == null) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// One row per exported format (Export presets — Plan 07). Falls back to the
// legacy single-block display when a clip has has_export but no clip_exports
// rows yet (a project not backfilled, or a clip mutated directly in a test).
function _exportFormatsHtml(clip) {
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
      ${clip.export_stale ? `<div class="transcript-stale-note" style="margin-top:8px">&#9888; Stale — re-export to update (${escHtml((clip.export_stale_reasons || []).join(', '))})</div>` : ''}`;
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
          ${row.export_stale ? `<div class="transcript-stale-note" style="margin-top:4px">&#9888; Stale — re-export to update (${escHtml((row.export_stale_reasons || []).join(', '))})</div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
            <button class="btn ghost" data-export-action="download">Download</button>
            ${AppState.canReveal ? `<button class="btn ghost" data-export-action="reveal">Show in folder</button>` : ''}
            <button class="btn ghost" data-export-action="copy-path">Copy path</button>
            <button class="btn ghost" data-export-action="regenerate">Regenerate</button>
            <button class="btn danger" data-export-action="delete">Delete</button>
          </div>
        </div>`).join('')}
    </div>
    <button class="btn-secondary" style="margin-top:8px" onclick="exportClip(${clip.id})">+ Export another format</button>`;
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
        <div style="display:flex;gap:4px">
          ${clip.description ? `<button class="copy-icon-btn" title="Copy description" aria-label="Copy description" data-copy="description">&#128203;</button>` : ''}
          <button class="kebab-btn" title="Edit or regenerate description" aria-label="Edit or regenerate description" onclick="openDescKebab(${clip.id}, this)">&#8942;</button>
        </div>
      </div>
      <div class="description">${clip.description ? `"${escHtml(clip.description)}"` : `<span style="color:var(--muted);font-size:13px">No description yet — Re-score to generate</span>`}</div>

      ${clip.description_long ? `
        <hr class="detail-card-divider">
        <div class="detail-card-header">
          <span class="detail-card-title">Full Description${eb(clip.description_long_is_edited)}</span>
          <button class="kebab-btn" title="Edit or regenerate long description" aria-label="Edit or regenerate long description" onclick="openDescLongKebab(${clip.id}, this)">&#8942;</button>
        </div>
        <div class="description-long">${escHtml(clip.description_long)}</div>` : ''}

      <hr class="detail-card-divider">
      <div class="detail-card-header"><span class="detail-card-title">Tags</span></div>
      <div class="clip-tags" id="clip-user-tags">${_clipTagPillsHTML(clip.user_tags)}</div>
      <input list="clip-tags-datalist" id="clip-tag-input" class="tag-input"
             placeholder="Add a tag…" maxlength="40" autocomplete="off" aria-label="Add a tag">
      <datalist id="clip-tags-datalist"></datalist>
      ${_generatedTagPillsHTML(clip.tags)}
    </div>

    ${_hotwordDetailHTML(clip)}
    ${_sensitiveDetailHTML(clip)}

    <div class="detail-cards-row">
      <div class="detail-card">
        <div class="detail-card-header">
          <span class="detail-card-title">Scoring</span>
          ${clip.scored_at && clip.score_overall_user != null
            ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" onclick="clearScoreOverride(${clip.id})" title="Remove manual score override">Remove Override</button>`
            : clip.scored_at
            ? `<button class="btn ghost" style="font-size:11px;padding:2px 8px" onclick="openScoreOverride(${clip.id})">Override Score</button>`
            : ''}
        </div>
        <div class="scores">
          ${!clip.scored_at ? `<span style="color:var(--muted);font-size:13px">Not yet scored — Re-score to generate</span>` :
            clip.score_overall_user != null
            ? scoreRowOverride('Overall', clip.score_overall, clip.score_overall_user, 'overall')
            : scoreRow('Overall', clip.score_overall, 'overall')}
          ${clip.scored_at ? scoreRow('Funny',    clip.score_funny,    'funny')    : ''}
          ${clip.scored_at ? scoreRow('Dramatic', clip.score_dramatic, 'dramatic') : ''}
          ${clip.scored_at ? scoreRow('Action',   clip.score_action,   'action')   : ''}
          ${clip.scored_at && clip.score_laugh != null ? scoreRow('Laughs', clip.score_laugh, 'laugh') : ''}
        </div>
      </div>
      <div class="detail-card">
        <div class="detail-card-header"><span class="detail-card-title">Actions</span></div>
        <div class="clip-actions">
          <div class="review-actions">
            <button class="btn approve ${clip.status==='approved'?'active':''}" onclick="setStatus(${clip.id},'approved')" title="Approve (press A)">Approve</button>
            <button class="btn reject  ${clip.status==='rejected'?'active':''}" onclick="setStatus(${clip.id},'rejected')" title="Reject (press R)">Reject</button>
          </div>
          <div class="op-actions">
            <button class="btn" onclick="exportClip(${clip.id})">${clip.has_export ? 'Re-export' : 'Export'}</button>
            <button class="btn ghost" onclick="openClipActionsModal(${clip.id})">Additional Actions</button>
          </div>
        </div>
      </div>
    </div>

    <div class="detail-card">
      <div class="detail-card-header">
        <span class="detail-card-title">Export</span>
        <button class="btn ghost" style="font-size:12px;padding:2px 10px" onclick="openExportEditor(${clip.id})" title="Trim, frame vertical, preview captions, then export">Edit &amp; export</button>
      </div>
      ${trimExportHtml}
    </div>

    ${clip.related_clips ? `
      <div class="detail-card" id="related-clips-section">
        <div class="detail-card-header" style="justify-content:flex-start;gap:8px">
          <span class="detail-card-title">Related Clips</span>
          ${clip.related_clips_stale ? `<span style="font-size:11px;color:var(--warning);font-style:italic">stale — re-score updated</span>` : ''}
          <span style="font-size:11px;color:var(--muted);margin-left:auto">${clip.related_clips_at ? _fmtAgo(clip.related_clips_at) : ''}</span>
        </div>
        ${clip.related_clips.length ? clip.related_clips.map(r => `
          <div style="display:flex;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--border)">
            <a href="#" style="color:var(--accent);text-decoration:none;font-size:13px;white-space:nowrap" onclick="event.preventDefault();selectClip(${r.id})">#${r.id}</a>
            <span style="font-size:12px;color:var(--muted)">${escHtml(r.reason)}</span>
          </div>`).join('') : `<div style="font-size:12px;color:var(--muted)">No similar clips found</div>`}
      </div>` : ''}

    ${clip.transcript_excerpt ? `
      <div class="detail-card">
        <div class="detail-card-header">
          <span class="detail-card-title">Transcript</span>
          <button class="copy-icon-btn" title="Copy transcript" aria-label="Copy transcript" data-copy="transcript">&#128203;</button>
        </div>
        ${clip.transcript_stale ? `<div class="transcript-stale-note">&#9888; Captions edited since last scoring — <button class="btn ghost" style="font-size:11px;padding:2px 8px" onclick="rescoreClip(${clip.id})">Re-score</button> to refresh.</div>` : ''}
        <div id="clip-transcript-view" class="transcript">${escHtml(clip.transcript_excerpt)}</div>
      </div>` : ''}
  `;

  if (clip.transcript_excerpt && window.loadClipTranscript) loadClipTranscript(clip.id);
  _renderTagDatalist();
  _loadTagSuggestions().then(_renderTagDatalist);
}

// ── hot-words ────────────────────────────────────────────────────────────────
const _HOTWORD_MODE_LABELS = {exact: 'Exact', case_insensitive: 'Ignore case', semantic: 'Meaning (LLM)'};

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
            <span style="color:var(--muted)"> — ${escHtml(_HOTWORD_MODE_LABELS[m.mode] || m.mode)}${m.count > 1 ? `, ${m.count}×` : ''}</span>
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
            <span style="color:var(--muted)"> — ${escHtml(_SENSITIVE_MODE_LABELS[m.mode] || m.mode)}${m.count > 1 ? `, ${m.count}×` : ''}</span>
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
  llm_error:           { name: 'Score error', tip: 'LLM scoring failed for this clip — Re-score to retry' },
  llm_no_transcript:   { name: 'No speech to score', tip: "No transcript text in this clip's time range, so LLM scoring was skipped" },
  energy_no_tracks:    { name: 'No audio data', tip: 'No audio track was available for energy scoring' },
  energy_no_data:      { name: 'No audio data', tip: "The audio track had no data in this clip's time range" },
  after_hard_split:    { name: 'After split', tip: 'This clip starts right after a split point' },
  long_silence_before: { name: 'Long pause before', tip: 'A long quiet stretch comes right before this clip' },
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

document.addEventListener('DOMContentLoaded', () => {
  const detail = document.getElementById('detail');
  if (!detail) return;
  detail.addEventListener('click', e => {
    const rm = e.target.closest && e.target.closest('[data-remove-tag]');
    if (rm && AppState.activeClipId) _removeClipTag(AppState.activeClipId, rm.dataset.removeTag);
    const copy = e.target.closest && e.target.closest('[data-copy]');
    if (copy && AppState.activeClipData) {
      if (copy.dataset.copy === 'description') copyText(AppState.activeClipData.description, 'Description');
      else if (copy.dataset.copy === 'transcript') copyText(AppState.activeClipData.transcript_excerpt, 'Transcript');
    }
    const formatBtn = e.target.closest && e.target.closest('[data-export-action]');
    if (formatBtn) {
      const row = formatBtn.closest('.export-format-row');
      if (row) _handleExportFormatAction(formatBtn.dataset.exportAction, row.dataset);
    }
  });
  detail.addEventListener('keydown', e => {
    const input = e.target.closest && e.target.closest('#clip-tag-input');
    if (!input) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = input.value;
      input.value = '';
      if (AppState.activeClipId) _addClipTag(AppState.activeClipId, value);
    }
  });
});

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

  if (clip.status !== 'pending') {
    groups.push({ heading: 'Review', rows: [
      { label: 'Mark Unreviewed', description: 'Clear the approve/reject status and return this clip to the unreviewed queue.', action: () => setStatus(clipId, 'pending') },
    ]});
  }

  const scoringRows = [
    { label: 'Re-score', description: 'Re-run scoring and description generation for this clip.', action: () => rescoreClip(clipId) },
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

  openActionsModal(`Clip #${clip.id} — Additional Actions`, groups);
}

function _downloadFile(filename) {
  const a = document.createElement('a');
  a.href = `/media/exports/${encodeURIComponent(filename)}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Download the clip's exported video plus any SRT caption sidecars on disk.
async function _downloadClipExport(clipId) {
  let files = [];
  try {
    const data = await fetch(`/api/clips/${clipId}/export-files`).then(r => r.json());
    files = (data && data.files) || [];
  } catch (_) { /* fall back to the single known media file below */ }
  if (!files.length && AppState.activeMediaFilename) files = [AppState.activeMediaFilename];
  if (!files.length) { showToast('No exported files found', 'warning'); return; }
  // Stagger so the browser doesn't collapse rapid sequential downloads into one.
  files.forEach((fn, i) => setTimeout(() => _downloadFile(fn), i * 200));
  if (files.length > 1) showToast(`Downloading ${files.length} files (video + captions)`, 'info');
}

async function _revealClipExport(clipId) {
  let files = [];
  try {
    const data = await fetch(`/api/clips/${clipId}/export-files`).then(r => r.json());
    files = (data && data.files) || [];
  } catch (_) { /* fall back to the single known media file below */ }
  if (!files.length && AppState.activeMediaFilename) files = [AppState.activeMediaFilename];
  if (!files.length || !AppState.exportDir) { showToast('No exported files found', 'warning'); return; }
  const sep = AppState.exportDir.includes('\\') ? '\\' : '/';
  revealInFolder(`${AppState.exportDir}${sep}${files[0]}`);
}

async function _copyClipExportPaths(clipId) {
  let files = [];
  try {
    const data = await fetch(`/api/clips/${clipId}/export-files`).then(r => r.json());
    files = (data && data.files) || [];
  } catch (_) { /* fall back to the single known media file below */ }
  if (!files.length && AppState.activeMediaFilename) files = [AppState.activeMediaFilename];
  if (!files.length) { showToast('No exported files found', 'warning'); return; }
  const sep = AppState.exportDir && AppState.exportDir.includes('\\') ? '\\' : '/';
  const paths = files.map(fn => AppState.exportDir ? `${AppState.exportDir}${sep}${fn}` : fn);
  copyText(paths.join('\n'), files.length > 1 ? 'File paths' : 'File path');
}

// ── per-format export row actions (Export presets — Plan 07) ───────────────
function _handleExportFormatAction(action, data) {
  // Read from the row's own dataset rather than AppState.activeClipId — the
  // Export card can be rendered for a clip before it's the globally "active"
  // one (e.g. in tests, or a future non-selection preview), so each row must
  // be self-contained.
  const clipId = parseInt(data.clipId, 10);
  if (!clipId) return;
  if (action === 'download') _downloadFile(data.filename);
  else if (action === 'reveal') {
    if (!AppState.exportDir) { showToast('Exports folder unknown', 'warning'); return; }
    const sep = AppState.exportDir.includes('\\') ? '\\' : '/';
    revealInFolder(`${AppState.exportDir}${sep}${data.filename}`);
  } else if (action === 'copy-path') {
    const path = AppState.exportDir ? `${AppState.exportDir}${AppState.exportDir.includes('\\') ? '\\' : '/'}${data.filename}` : data.filename;
    copyText(path, 'File path');
  } else if (action === 'regenerate') {
    _confirmRegenerateExportFormat(clipId, data);
  } else if (action === 'delete') {
    _confirmDeleteExportFormat(clipId, data.exportId);
  }
}

function _confirmRegenerateExportFormat(clipId, data) {
  const label = exportPresetLabel(data.presetName);
  showConfirm(
    'Regenerate this format?',
    `Re-export "${escHtml(label)}" with the same settings, overwriting the existing file.`,
    'Regenerate',
    () => _regenerateExportFormat(clipId, data),
  );
}

function _regenerateExportFormat(clipId, data) {
  const params = new URLSearchParams();
  if (data.presetName && data.presetName !== 'default') params.set('preset', data.presetName);
  if (data.burnSubs) params.set('burn_subs', 'true');
  else if (data.embedSubs) params.set('embed_subs', 'true');
  if (data.titleCard) params.set('title_card', 'true');
  const qs = params.toString() ? `?${params}` : '';

  openLog();
  streamSSE(
    `/api/clips/${clipId}/export${qs}`,
    async () => {
      const clip = await fetch(`/api/clips/${clipId}`).then(r => r.json());
      AppState.activeClipData = clip;
      if (!PanelNav.isOpen()) renderDetail(clip);
      await _reloadClipList(AppState.activeVideoId);
      showToast('Format regenerated');
      SoundFx.play('export');
    },
    [{label: 'Export', patterns: ['Exporting', 'OK Saved']}],
    'Exporting',
  );
}

function _confirmDeleteExportFormat(clipId, exportId) {
  showConfirm(
    'Delete this format?',
    'This exported file will be removed from disk. The clip\'s other formats (if any) are kept.',
    'Delete Format',
    () => _deleteExportFormat(clipId, exportId),
    true,
  );
}

async function _deleteExportFormat(clipId, exportId) {
  await _releasePlayerBeforeDelete();
  const res = await fetch(`/api/clip-exports/${exportId}`, {method: 'DELETE'});
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(`Failed to delete format: ${formatApiError(err)}`, 'error');
    selectClip(clipId);
    return;
  }
  const clip = await fetch(`/api/clips/${clipId}`).then(r => r.json());
  AppState.activeClipData = clip;
  if (!clip.has_export) renderPlayer(null, null, clipId);
  renderDetail(clip);
  await _reloadClipList(AppState.activeVideoId);
  showToast('Format deleted');
}

async function _reloadClipList(videoId) {
  if (!videoId) return;
  AppState.clips = await fetch(`/api/videos/${videoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
  _renderClips();
}

function _replaceClipInList(updated) {
  const idx = AppState.clips.findIndex(c => c.id === updated.id);
  if (idx !== -1) AppState.clips[idx] = updated;
}

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
  document.getElementById('player-area').innerHTML = `
    <div class="no-export-msg"><div style="color:var(--muted)">Select a clip to review</div></div>`;
  document.getElementById('detail').innerHTML = '<div class="detail-empty">Select a clip from the sidebar<div style="color:var(--muted);font-size:12px;margin-top:6px">Use ← → to navigate between clips</div></div>';
}

// ── clip actions ──────────────────────────────────────────────────────────────
async function setStatus(id, status) {
  const clip = AppState.clips.find(c => c.id === id);
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
  AppState.activeClipId = id;
  const [clipsData, clipDetail] = await Promise.all([
    fetch(`/api/videos/${AppState.activeVideoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json()),
    fetch(`/api/clips/${id}`).then(r => r.json()),
  ]);
  AppState.clips = clipsData;
  _renderClips();
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
}

// Ctrl/Cmd+Z dispatch (settings.js) — prefers whichever of single/bulk status
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
let _exportDiarReady  = false;
let _exportDiarReason = '';
let _exportCropX = 0.5;  // vertical-framing crop position for the active export

// A 9:16 column spanning the full height of a 16:9 preview is (9/16)^2 = 31.64%
// of its width; the box's left edge therefore travels across the remaining 68.36%.
const _VERT_BOX_W_PCT = 31.64;
const _VERT_BOX_TRAVEL_PCT = 100 - _VERT_BOX_W_PCT;

// One always-visible line answering "will this be quick or slow, and why" —
// the terms match the Getting Started guide and glossary (Quick/Precise export).
function _exportModeSummary(hardsub, titleCard, retranscribe) {
  const reencodeReasons = [];
  if (hardsub)   reencodeReasons.push('burned-in captions');
  if (titleCard) reencodeReasons.push('the title card');
  const retxNote = retranscribe ? ' Retranscribing runs first and adds time.' : '';
  if (reencodeReasons.length) {
    return {
      precise: true,
      text: `Precise export — re-encodes for ${reencodeReasons.join(' and ')} (slower).${retxNote}`,
    };
  }
  return {
    precise: false,
    text: `Quick export — copies the video without re-encoding (seconds). Cuts may land up to ~1 s off the exact mark.${retxNote}`,
  };
}

function _renderExportModeSummary(el, hardsub, titleCard, retranscribe) {
  const summary = _exportModeSummary(hardsub, titleCard, retranscribe);
  el.textContent = summary.text;
  el.style.color = summary.precise ? 'var(--warning)' : 'var(--muted)';
}

function _updateExportModeSummary() {
  _renderExportModeSummary(
    document.getElementById('export-mode-summary'),
    document.getElementById('export-captions').value === 'hardsub',
    document.getElementById('export-title-card').checked,
    document.getElementById('export-retranscribe').checked,
  );
}

function _onExportCaptionsChange() {
  _updateExportModeSummary();
}

// Preset exports always re-encode and don't support the soft-subtitle (embed)
// track or a container override — the preset dictates both. Reflect that in
// the rest of the modal so a creator never hits the server-side 400 for the
// unsupported combination.
function _onExportPresetChange(presetName) {
  const containerSel = document.getElementById('export-container');
  const captionsSel  = document.getElementById('export-captions');
  const softsubOpt   = captionsSel.querySelector('option[value="softsub"]');
  const usingPreset  = !!presetName;

  containerSel.disabled = usingPreset;
  softsubOpt.disabled = usingPreset;
  if (usingPreset && captionsSel.value === 'softsub') captionsSel.value = 'none';
  document.getElementById('export-framing').style.display =
    exportPresetIsVertical(presetName) ? '' : 'none';
  _updateExportModeSummary();
}

// Position the 9:16 crop box for the active export and keep the slider + buttons in sync.
function _setExportFraming(fraction) {
  _exportCropX = Math.max(0, Math.min(1, fraction));
  const slider = document.getElementById('export-framing-slider');
  if (slider && parseFloat(slider.value) !== _exportCropX) slider.value = _exportCropX;
  const box = document.getElementById('export-framing-box');
  if (box) {
    box.style.width = `${_VERT_BOX_W_PCT}%`;
    box.style.left  = `${_exportCropX * _VERT_BOX_TRAVEL_PCT}%`;
  }
  document.querySelectorAll('#export-framing [data-frame-pos]').forEach(btn => {
    btn.classList.toggle('active', parseFloat(btn.dataset.framePos) === _exportCropX);
  });
}

// Ask the server to suggest a crop position from faces in the clip (MediaPipe).
// Fills the slider on success; the creator still confirms by exporting. Absent
// package (503) points at the Settings install; no face found leaves the manual
// position untouched.
async function _autoFrameExport() {
  const btn  = document.getElementById('export-autoframe-btn');
  const note = document.getElementById('export-autoframe-note');
  btn.disabled = true;
  note.textContent = 'Finding faces…';
  try {
    const res = await fetch(`/api/clips/${_exportClipId}/suggest-framing`, {method: 'POST'});
    if (res.status === 503) {
      note.innerHTML = 'Needs MediaPipe — <a href="#" onclick="closeExportModal();openSettings();return false">install it in Settings</a>.';
      return;
    }
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))) || `HTTP ${res.status}`);
    const {crop_x} = await res.json();
    if (crop_x == null) {
      note.textContent = 'No face found — set the crop manually.';
      return;
    }
    _setExportFraming(crop_x);
    note.textContent = 'Framed on faces.';
  } catch (err) {
    note.textContent = `Auto-frame failed: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
}

// Speaker labels only apply to a retranscribe pass and need the configured
// diarization backend set up (SpeechBrain installed, or pyannote installed + a
// HuggingFace token), so the checkbox is enabled only when readiness holds.
function _onExportRetranscribeChange(checked) {
  document.getElementById('export-retranscribe-model').disabled = !checked;
  const row  = document.getElementById('export-speaker-row');
  const box  = document.getElementById('export-speaker-labels');
  const note = document.getElementById('export-speaker-note');
  row.style.opacity = checked ? '1' : '.5';
  box.disabled = !checked || !_exportDiarReady;
  // Only surface the prerequisite note when retranscribe is on; when it's off the
  // row is dimmed for that reason and a token/install note would be ambiguous.
  if (checked && !_exportDiarReady) {
    note.innerHTML = _diarizationNoteHtml(_exportDiarReason, 'closeExportModal();openSettings()');
  } else {
    note.textContent = '';
  }
  _updateExportModeSummary();
}

async function _loadExportSpeakerDefault() {
  const box = document.getElementById('export-speaker-labels');
  const readiness = await _diarizationReadiness();
  _exportDiarReady  = readiness.ready;
  _exportDiarReason = readiness.reason;
  box.checked = readiness.ready;  // on by default when fully set up
  _onExportRetranscribeChange(document.getElementById('export-retranscribe').checked);
}

// Prefill the export dialog's Caption style group from the global defaults so the
// per-export override starts where Settings -> Export left it. Failures are
// non-fatal — the fields just stay empty (renderer default).
async function _prefillExportCaptionStyle() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    document.getElementById('export-caption-font').value = cfg.caption_font_name || '';
    document.getElementById('export-caption-size').value = cfg.caption_font_size ? cfg.caption_font_size : '';
    document.getElementById('export-caption-position').value = cfg.caption_position || 'bottom';
  } catch { /* leave fields at their defaults */ }
}

async function exportClip(id) {
  _exportOpener = document.activeElement;
  _exportClipId = id;
  document.getElementById('export-captions').value = 'softsub';
  document.getElementById('export-container').value = '';
  document.getElementById('export-trim-start').value = _fmtOffset(AppState.activeClipData?.start_offset);
  document.getElementById('export-trim-end').value   = _fmtOffset(AppState.activeClipData?.end_offset);
  const retx = document.getElementById('export-retranscribe');
  retx.checked = false;
  document.getElementById('export-retranscribe-model').disabled = true;
  document.getElementById('export-title-card').checked = false;
  await _prefillExportCaptionStyle();
  await populateExportPresetSelect('');
  const savedCropX = AppState.activeClipData?.crop_x;
  _setExportFraming(savedCropX == null ? 0.5 : savedCropX);
  document.getElementById('export-autoframe-note').textContent = '';
  _onExportPresetChange('');
  _updateExportModeSummary();
  _loadExportSpeakerDefault();
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
  const preset    = document.getElementById('export-preset').value;
  const trimStart = _parseTimingOffset(document.getElementById('export-trim-start').value);
  const trimEnd   = _parseTimingOffset(document.getElementById('export-trim-end').value);
  const retx      = document.getElementById('export-retranscribe').checked;
  const retxModel = document.getElementById('export-retranscribe-model').value;
  const speakerLabels = document.getElementById('export-speaker-labels').checked;
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

  if (exportPresetIsVertical(preset)) {
    const framingRes = await fetch(`/api/clips/${id}/framing`, {
      method: 'PATCH', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({crop_x: _exportCropX}),
    }).catch(err => { showToast(`Failed to save framing: ${err.message}`, 'error'); return null; });
    if (!framingRes || !framingRes.ok) {
      if (framingRes) showToast('Failed to save vertical framing', 'error');
      return;
    }
  }

  const params = new URLSearchParams();
  if (burnSubs)   params.set('burn_subs', 'true');
  if (embedSubs)  params.set('embed_subs', 'true');
  if (preset)     params.set('preset', preset);
  else if (container) params.set('container', container);  // a preset dictates its own container
  if (retx)       {
    params.set('retranscribe', 'true');
    params.set('retranscribe_model', retxModel);
    params.set('speaker_labels', speakerLabels ? 'true' : 'false');
  }
  if (titleCard)  params.set('title_card', 'true');
  if (burnSubs) {
    // Caption style only affects burned-in captions; send the dialog's values so
    // the export is pinned to what the creator saw, independent of later config edits.
    params.set('caption_font', document.getElementById('export-caption-font').value.trim());
    const sizeRaw = document.getElementById('export-caption-size').value.trim();
    params.set('caption_size', sizeRaw === '' ? '0' : sizeRaw);
    params.set('caption_position', document.getElementById('export-caption-position').value);
  }
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
      AppState.activeClipData = clip;
      AppState.activeMediaFilename = media.filename;
      // A takeover panel (e.g. Split Editor) may have opened while the export
      // was streaming — don't clobber it by re-rendering the covered detail pane.
      if (!PanelNav.isOpen()) {
        const captionsUrl = media.has_captions ? `/api/clips/${id}/captions.vtt` : null;
        renderPlayer(media.url, captionsUrl, id);
        renderDetail(clip);
      }
      await _reloadClipList(AppState.activeVideoId);
      loadVideos();
      showToast('Clip exported successfully');
      SoundFx.play('export');
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
  const video = AppState.videos.find(v => v.id === id);
  const name  = video ? video.filename : `recording ${id}`;
  showConfirm(
    'Remove recording?',
    `Remove <strong>${escHtml(name)}</strong> from yuu-clip?<br><br>` +
    `All clips, transcripts, and extracted audio are removed from the database. ` +
    `Your source recording file is <strong>not</strong> deleted.`,
    'Remove',
    () => _doDeleteVideo(id, name),
    true,
  );
}

async function _doDeleteVideo(id, name) {
  // Release the player so its backing export/preview file isn't locked during delete.
  if (AppState.activeVideoId === id) await _releasePlayerBeforeDelete();
  const delRes = await fetch(`/api/videos/${id}`, {method: 'DELETE'});
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    showToast(`Failed to remove recording: ${formatApiError(err)}`, 'error');
    if (AppState.activeClipId) selectClip(AppState.activeClipId);
    return;
  }
  if (AppState.activeVideoId === id) {
    AppState.activeVideoId = null;
    AppState.activeClipId  = null;
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
      // Release the streaming connection first — on Windows the server's StaticFiles
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

// ── bulk clip actions ────────────────────────────────────────────────────────
async function bulkSetClipStatus(status) {
  const ids = _visibleSelectedClips().map(c => c.id);
  if (!ids.length) return;
  const res = await fetch('/api/clips/bulk-status', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip_ids: ids, status}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(`Bulk update failed: ${formatApiError(err)}`, 'error');
    return;
  }
  const label = {approved: 'Approved', rejected: 'Rejected', pending: 'Marked as Unreviewed'}[status] || status;
  const data = await res.json();
  AppState.selectedClipIds.clear();
  await _reloadClipList(AppState.activeVideoId);
  if (AppState.activeClipId && ids.includes(AppState.activeClipId)) {
    const clip = await fetch(`/api/clips/${AppState.activeClipId}`).then(r => r.json());
    AppState.activeClipData = clip;
    renderDetail(clip);
  }
  loadVideos();

  if (AppState.lastBulkStatusChange?.timer) clearTimeout(AppState.lastBulkStatusChange.timer);
  if (AppState.lastStatusChange?.timer) clearTimeout(AppState.lastStatusChange.timer);
  AppState.lastStatusChange = null;
  AppState.lastBulkStatusChange = {previous: data.previous};
  AppState.lastBulkStatusChange.timer = setTimeout(() => { AppState.lastBulkStatusChange = null; }, 5000);
  showUndoToast(`${label}: ${plural(ids.length, 'clip')}`, undoLastBulkStatus);
}

async function undoLastBulkStatus() {
  if (!AppState.lastBulkStatusChange) return;
  const {previous} = AppState.lastBulkStatusChange;
  clearTimeout(AppState.lastBulkStatusChange.timer);
  AppState.lastBulkStatusChange = null;
  const updates = Object.entries(previous).map(([id, status]) => ({id: Number(id), status}));
  const res = await fetch('/api/clips/bulk-status-restore', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({updates}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(`Undo failed: ${formatApiError(err)}`, 'error');
    return;
  }
  await _reloadClipList(AppState.activeVideoId);
  if (AppState.activeClipId && updates.some(u => u.id === AppState.activeClipId)) {
    const clip = await fetch(`/api/clips/${AppState.activeClipId}`).then(r => r.json());
    AppState.activeClipData = clip;
    renderDetail(clip);
  }
  loadVideos();
  showToast(`Undone: ${plural(updates.length, 'clip')} restored`);
}

function bulkDeleteClips() {
  const ids = _visibleSelectedClips().map(c => c.id);
  if (!ids.length) return;
  showConfirm(
    'Delete selected clips?',
    `${plural(ids.length, 'clip record')} will be removed from the database. ` +
    `Any exported video files will also be deleted from the exports folder.`,
    'Delete',
    () => _doBulkDeleteClips(ids),
    true,
  );
}

async function _doBulkDeleteClips(ids) {
  if (AppState.activeClipId && ids.includes(AppState.activeClipId)) {
    await _releasePlayerBeforeDelete();
  }
  const res = await fetch('/api/clips/bulk-delete', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({clip_ids: ids}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(`Bulk delete failed: ${formatApiError(err)}`, 'error');
    if (AppState.activeClipId && ids.includes(AppState.activeClipId)) selectClip(AppState.activeClipId);
    return;
  }
  const data = await res.json();
  AppState.selectedClipIds.clear();
  if (AppState.activeClipId && ids.includes(AppState.activeClipId)) {
    AppState.activeClipId = null;
    clearDetail();
  }
  await _reloadClipList(AppState.activeVideoId);
  await loadVideos();
  const n = data.deleted.length;
  if (data.locked.length) {
    showToast(`Deleted ${plural(n, 'clip')} — ${data.locked.length} could not be deleted (file in use)`, 'error');
  } else {
    showToast(`Deleted ${plural(n, 'clip')}`);
  }
}

function bulkExportClips() {
  const clips = _visibleSelectedClips();
  if (!clips.length) return;
  const staleCount = clips.filter(c => c.transcript_stale).length;
  if (staleCount) {
    showConfirm(
      'Export clips with outdated captions?',
      `${staleCount} of the ${clips.length} selected clips have captions edited since they were ` +
      `last scored, so their description/score won't reflect the latest transcript. ` +
      `Re-score them first, or export anyway?`,
      'Export Anyway',
      () => _doBulkExportClips(clips.map(c => c.id)),
      true,
    );
    return;
  }
  _doBulkExportClips(clips.map(c => c.id));
}

function _doBulkExportClips(ids) {
  const qs = new URLSearchParams({clip_ids: ids.join(',')});
  AppState.selectedClipIds.clear();
  openLog();
  streamSSE(
    `/api/clips/bulk-export?${qs}`,
    async () => {
      await _reloadClipList(AppState.activeVideoId);
      loadVideos();
      showToast(`Exported ${plural(ids.length, 'clip')}`);
      SoundFx.play('export');
    },
    [{label: 'Export', patterns: ['Exporting', 'OK', 'Skipping']}],
    'Bulk Exporting',
  );
}

// ── find similar ──────────────────────────────────────────────────────────────
let _similarClipsClipId = null;
let _similarClipsOpener = null;

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

  const btn = document.getElementById('btn-find-similar');
  if (btn) { btn.disabled = true; btn.textContent = 'Searching…'; }
  _supersedeActiveStream();
  openLog();

  const resetBtn = () => { if (btn) { btn.disabled = false; btn.textContent = 'Find Similar'; } };
  const qs = videoIds ? `?video_ids=${encodeURIComponent(videoIds)}` : '';
  const handle = _openSSE(
    `/api/clips/${clipId}/related-clips${qs}`,
    msg => { appendLog(String(msg)); },
    async msg => {
      _clearActiveStream(handle);
      resetBtn();
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
      resetBtn();
      showToast(`Find Similar failed — ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, resetBtn);
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
  );
}

// Public API — symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  selectClip, setStatus, undoLastStatus, renderDetail, clearDetail, refreshClipDetail,
  toggleClipFilter, _syncFilterChips, setClipSearch, setClipScoreMin, _clearClipFilters,
  _applyFilters, _renderClips, _parseTimingOffset, _reloadClipList,
  _renderBatchStatusPanel, _toggleBatchStatusPanel,
  deleteClip, deleteVideo, deleteExport, mergeClips,
  exportClip, exportVideoTranscript, confirmExport, closeExportModal,
  bulkSetClipStatus, bulkDeleteClips, bulkExportClips, _clearClipSelection,
  _onExportCaptionsChange, _onExportRetranscribeChange, _onExportPresetChange,
  _setExportFraming, _autoFrameExport, _updateExportModeSummary, _renderExportModeSummary,
  openScoreOverride, closeScoreOverrideModal, _scoreOverrideSave, clearScoreOverride,
  openDescKebab, openDescLongKebab,
  startFindSimilar, openSimilarClipsModal, closeSimilarClipsModal,
  openClipActionsModal,
});
})();
