(function () {
// Feature-map - Bulk clip actions (multi-select in the clip list → status / delete / export).
//   API: routes/clips/bulk.py (bulk-status, bulk-status-restore, bulk-delete, bulk-export) · Tests: tests/test_ui_clips.py
// The selection set lives in AppState.selectedClipIds; the clip list (clips.js)
// renders the checkboxes and calls _toggleClipSelection / _updateBulkToolbar as
// rows are drawn, and _pruneClipSelection on every re-render.

// ── multi-select ─────────────────────────────────────────────────────────────
// Drops selected IDs for clips that no longer exist (e.g. after a delete).
// Deliberately does NOT drop IDs just because a filter hides them - switching
// filter tabs shouldn't silently lose the user's selection.
function _pruneClipSelection() {
  const existingIds = new Set(AppState.clips.map(c => c.id));
  for (const id of AppState.selectedClipIds) {
    if (!existingIds.has(id)) AppState.selectedClipIds.delete(id);
  }
}

// The set of currently-selected clips that also pass the active filters - the
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
    showToast(`Deleted ${plural(n, 'clip')} - ${data.locked.length} could not be deleted (file in use)`, 'error');
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

// Public API - symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  _pruneClipSelection, _updateBulkToolbar, _toggleClipSelection, _clearClipSelection,
  bulkSetClipStatus, undoLastBulkStatus, bulkDeleteClips, bulkExportClips,
});
})();
