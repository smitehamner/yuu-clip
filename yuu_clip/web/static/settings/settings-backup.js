import { escHtml, formatApiError, plural } from '../core/format.js';
import { showToast } from '../core/utils.js';
import { showConfirm } from '../core/ui.js';

// Feature-map - Settings > Backup & Restore (code: backup)
//   API: routes/backup.py (/api/backup, /api/restore/inspect, /api/restore/apply)
//   Siblings: project_archive.py (archive + re-point core) · projects.js (switchProject reload pattern)
//   Tests: tests/ui/test_ui_backup.py

// Backup: ask the server to build the archive, then download the returned zip.
// Uses the browser download (an <a download>) rather than an Electron save dialog:
// it works identically in browser-dev and inside packaged Electron (Chromium shows
// a native save dialog), and keeps the archive off a server-chosen path.
async function backupProject() {
  const btn = document.getElementById('btn-backup-project');
  const original = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Backing up…'; }
  try {
    const res = await fetch('/api/backup', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(formatApiError(err) || 'Backup failed', 'error');
      return;
    }
    const blob = await res.blob();
    _downloadBlob(blob, _filenameFromResponse(res) || 'yuu-clip-backup.zip');
    showToast('Backup saved', 'success');
  } catch {
    showToast('Backup failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = original; }
  }
}

function _filenameFromResponse(res) {
  const disposition = res.headers.get('content-disposition') || '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match ? match[1] : null;
}

function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Restore is a review-before-commit flow: pick a file, preview what's in it and
// which source-media folders no longer resolve here, choose a target folder (and
// re-map any missing folders), then apply.
let _restoreState = null;

function startRestore() {
  const input = document.getElementById('restore-file-input');
  if (!input) return;
  input.value = '';
  input.click();
}

async function _onRestoreFileChosen(file) {
  if (!file) return;
  const flow = document.getElementById('restore-flow');
  flow.style.display = '';
  flow.innerHTML = '<div class="settings-note">Reading backup…</div>';
  try {
    const bytes = await file.arrayBuffer();
    const res = await fetch('/api/restore/inspect', { method: 'POST', body: bytes });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      _hideRestoreFlow();
      showToast(formatApiError(err) || 'That file is not a valid backup', 'error');
      return;
    }
    const data = await res.json();
    _restoreState = {
      stagingPath: data.staging_path,
      groups: data.groups || [],
      manifest: data.manifest || {},
    };
    _renderRestorePlan();
  } catch {
    _hideRestoreFlow();
    showToast('Could not read backup', 'error');
  }
}

function _hideRestoreFlow() {
  const flow = document.getElementById('restore-flow');
  flow.innerHTML = '';
  flow.style.display = 'none';
  _restoreState = null;
}

function _renderRestorePlan() {
  const flow = document.getElementById('restore-flow');
  const { manifest, groups } = _restoreState;
  const created = manifest.created_at ? manifest.created_at.slice(0, 10) : 'unknown date';
  const canBrowse = !!window.electronAPI?.pickProjectFolder;
  const browseBtn = (id) => canBrowse
    ? `<button type="button" class="btn ghost" data-browse-into="${id}">Choose…</button>` : '';

  const repointRows = groups.map((group, i) => {
    const samples = (group.sample_filenames || []).map(escHtml).join(', ');
    return `
      <div class="restore-repoint-row" style="border-top:1px solid var(--border);padding:10px 0">
        <div style="font-size:12px;color:var(--text)"><code>${escHtml(group.missing_dir)}</code></div>
        <div class="settings-note">${plural(group.file_count, 'file')}${samples ? ` - e.g. ${samples}` : ''}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
          <input type="text" id="repoint-${i}" class="settings-input" style="flex:1"
                 placeholder="New location for these files (leave blank to skip)">
          ${browseBtn(`repoint-${i}`)}
        </div>
      </div>`;
  }).join('');

  const repointBlock = groups.length ? `
    <div style="margin-top:14px">
      <div class="settings-label">Some source videos are not where the backup expected</div>
      <div class="settings-note" style="margin-bottom:4px">Point each missing folder to its new location so the clips still play. Blank folders are left as missing.</div>
      ${repointRows}
    </div>` : '';

  flow.innerHTML = `
    <div class="settings-note" style="margin-bottom:10px">
      Backup of <strong>${escHtml(manifest.project_name || 'project')}</strong> - created ${escHtml(created)}.
    </div>
    <div class="settings-label" for="restore-target">Restore into folder</div>
    <div class="settings-note" style="margin-bottom:4px">Choose an empty or new folder. To replace the current project, enter its folder - a safety copy of its database is kept.</div>
    <div style="display:flex;gap:8px;align-items:center">
      <input type="text" id="restore-target" class="settings-input" style="flex:1" placeholder="Folder to restore into">
      ${browseBtn('restore-target')}
    </div>
    ${repointBlock}
    <div style="display:flex;gap:10px;margin-top:16px">
      <button type="button" class="btn primary" id="btn-restore-confirm">Restore</button>
      <button type="button" class="btn ghost" id="btn-restore-cancel">Cancel</button>
    </div>`;

  flow.querySelectorAll('[data-browse-into]').forEach(btn => {
    btn.onclick = () => _pickFolderInto(btn.getAttribute('data-browse-into'));
  });
  document.getElementById('btn-restore-confirm').onclick = () => _applyRestore(false);
  document.getElementById('btn-restore-cancel').onclick = _hideRestoreFlow;
}

async function _pickFolderInto(inputId) {
  if (!window.electronAPI?.pickProjectFolder) return;
  const dir = await window.electronAPI.pickProjectFolder();
  if (dir) document.getElementById(inputId).value = dir;
}

async function _applyRestore(overwrite) {
  if (!_restoreState) return;
  const target = document.getElementById('restore-target').value.trim();
  if (!target) { showToast('Choose a folder to restore into', 'error'); return; }
  const mapping = {};
  _restoreState.groups.forEach((group, i) => {
    const value = document.getElementById(`repoint-${i}`)?.value.trim();
    if (value) mapping[group.missing_dir] = value;
  });

  const btn = document.getElementById('btn-restore-confirm');
  if (btn) { btn.disabled = true; btn.textContent = 'Restoring…'; }
  let res;
  try {
    res = await fetch('/api/restore/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive_path: _restoreState.stagingPath, target_dir: target, mapping, overwrite }),
    });
  } catch {
    showToast('Restore failed', 'error');
    _resetRestoreConfirm();
    return;
  }

  if (res.status === 409) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    if (!overwrite && detail && typeof detail === 'object' && detail.code === 'project_exists') {
      _resetRestoreConfirm();
      showConfirm(
        'Replace the existing project?',
        'That folder already contains a project. Replacing it keeps a safety copy of its database (project.db.pre-restore). Continue?',
        'Replace',
        () => _applyRestore(true),
        true,
      );
      return;
    }
    showToast((detail && detail.message) || 'Restore is unavailable right now', 'error');
    _resetRestoreConfirm();
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(formatApiError(err) || 'Restore failed', 'error');
    _resetRestoreConfirm();
    return;
  }

  const data = await res.json();
  if (window.electronAPI?.projectChanged) window.electronAPI.projectChanged(data.current);
  const stillMissing = data.repoint?.still_missing || 0;
  const missingNote = stillMissing ? ` (${plural(stillMissing, 'video')} still missing)` : '';
  showToast(`Restored${missingNote} - reloading…`, 'success');
  setTimeout(() => location.reload(), 600);
}

function _resetRestoreConfirm() {
  const btn = document.getElementById('btn-restore-confirm');
  if (btn) { btn.disabled = false; btn.textContent = 'Restore'; }
}

// Static index.html controls this module owns, wired once at module load. All
// three are fixed, never-recreated elements in index.html's settings panel, so a
// single load-time listener can't double-fire on a re-render.
function _wireStaticHandlers() {
  document.getElementById('btn-backup-project')
    ?.addEventListener('click', () => backupProject());
  document.getElementById('btn-restore-project')
    ?.addEventListener('click', () => startRestore());
  const input = document.getElementById('restore-file-input');
  if (input) input.addEventListener('change', () => _onRestoreFileChosen(input.files[0]));
}

_wireStaticHandlers();

export { backupProject, startRestore };
