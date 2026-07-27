// Feature-map - Per-format export-file actions in the clip detail's Export card.
//   API: routes/clips/ (export.py regenerate, delete.py clip-exports, crud.py export-files) · Tests: tests/ui/test_ui_clips.py
// The Export card's per-format rows are built by _exportFormatsHtml in clips.js (it
// renders inside the detail pane); the download / reveal / copy-path / regenerate /
// delete actions they dispatch live here. The full export flow itself is the visual
// editor (library/exporteditor.js) - the old quick-export modal was retired in favour
// of that single door.

import { AppState } from '../core/state.js';
import { escHtml, formatApiError } from '../core/format.js';
import { PanelNav } from '../core/panelnav.js';
import { streamSSE, setJobCancel } from '../core/jobs.js';
import { showToast, revealInFolder, copyText } from '../core/utils.js';
import { showConfirm } from '../core/ui.js';
import {
  selectClip, renderDetail, renderPlayer, _releasePlayerBeforeDelete, _reloadClipList,
} from './clips.js';
import { exportPresetLabel } from '../library/exportpresets.js';
import { SoundFx } from '../library/sounds.js';

// ── per-format export row actions (Export presets - Plan 07) ───────────────
function _downloadFile(filename) {
  const a = document.createElement('a');
  a.href = `/media/exports/${encodeURIComponent(filename)}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Download the clip's exported video plus any SRT caption sidecars on disk.
export async function _downloadClipExport(clipId) {
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

export async function _revealClipExport(clipId) {
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

export async function _copyClipExportPaths(clipId) {
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

export function _handleExportFormatAction(action, data) {
  // Read from the row's own dataset rather than AppState.activeClipId - the
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

  streamSSE(
    `/api/clips/${clipId}/export${qs}`,
    async outcome => {
      const clip = await fetch(`/api/clips/${clipId}`).then(r => r.json());
      AppState.activeClipData = clip;
      if (!PanelNav.isOpen()) renderDetail(clip);
      await _reloadClipList(AppState.activeVideoId);
      if (outcome === 'cancelled') return;
      showToast('Format regenerated');
      SoundFx.play('export');
    },
    [{label: 'Export', patterns: ['Exporting', 'OK Saved']}],
    'Exporting',
    true,
  );
  setJobCancel({
    url:     '/api/analyze/cancel',
    title:   'Cancel export?',
    body:    'The export will stop and no file will be saved. You can export again anytime.',
    confirm: 'Cancel Export',
    logMsg:  '[Export cancelled]',
  });
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
