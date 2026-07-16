// Feature-map - Export preset (code: ExportPreset; Settings -> Export editor).
//   API: routes/export_presets.py . Tests: tests/integration/test_export_presets.py, tests/ui/test_ui_settings.py
// Export presets (Plan 07)
// Custom presets are a global-config preference (Config.export_presets), not
// per-project DB rows like hot-words - but the Settings editor follows the
// same server-backed-per-row-save table pattern (hotwords.js) against
// /api/export-presets instead of /api/hotwords. AppState.exportPresets caches
// {builtins, custom} - populated at boot so the export options picker never
// needs an extra round trip, refreshed here when Settings opens.
import { AppState } from './state.js';
import { escHtml, formatApiError } from './format.js';
import { showToast } from './utils.js';

let _draftSeq = 0;

export async function ensureExportPresetsCache(force = false) {
  if (!force && AppState._exportPresetsLoaded) return;
  try {
    AppState.exportPresets = await fetch('/api/export-presets').then(r => r.json());
  } catch {
    AppState.exportPresets = AppState.exportPresets || {builtins: [], custom: []};
  }
  AppState._exportPresetsLoaded = true;
}

function _allExportPresets() {
  const presets = AppState.exportPresets || {builtins: [], custom: []};
  return [...(presets.builtins || []), ...(presets.custom || [])];
}

export function exportPresetLabel(name) {
  if (!name || name === 'default') return 'Original quality';
  return _allExportPresets().find(p => p.name === name)?.label || name;
}

export function exportPresetIsVertical(name) {
  if (!name || name === 'default') return false;
  return !!_allExportPresets().find(p => p.name === name)?.vertical;
}

// The size cap (MB) a preset targets, or null for a quality/CRF preset. Used by
// the export dialog's tight-cap warning to spot a long clip squeezed too small.
export function exportPresetTargetSizeMb(name) {
  if (!name || name === 'default') return null;
  return _allExportPresets().find(p => p.name === name)?.target_size_mb ?? null;
}

// Renders the <option>s for the export options modal's preset picker.
export async function populateExportPresetSelect(selectedName = '') {
  await ensureExportPresetsCache();
  const sel = document.getElementById('export-preset');
  if (!sel) return;
  const presets = AppState.exportPresets || {builtins: [], custom: []};
  const opt = (value, label) => `<option value="${escHtml(value)}"${selectedName === value ? ' selected' : ''}>${escHtml(label)}</option>`;
  sel.innerHTML = [
    opt('', 'Original quality (default)'),
    ...(presets.builtins || []).map(p => opt(p.name, p.label)),
    ...(presets.custom || []).map(p => opt(p.name, p.label)),
  ].join('');
}

// ── Settings: custom-preset editor ──────────────────────────────────────────

export async function initExportPresetSettings() {
  await ensureExportPresetsCache(true);
  _renderExportPresetRows();
}

function _presetRowKey(p) { return String(p.name ?? p._draftKey); }

function _builtinPresetRowHtml(p) {
  const quality = p.target_size_mb != null ? `Target ${p.target_size_mb} MB` : `CRF ${p.crf}`;
  return `
    <div class="settings-row" style="align-items:center;gap:10px;flex-wrap:wrap;opacity:.7">
      <span style="flex:1;min-width:110px">${escHtml(p.label)}</span>
      <span style="font-size:12px;color:var(--muted)">${escHtml(p.container.toUpperCase())} · ${p.height ? `&le;${p.height}p` : 'Source resolution'} · ${escHtml(quality)}</span>
      <span style="font-size:11px;color:var(--muted)">Built-in</span>
    </div>`;
}

function _customPresetRowHtml(p) {
  const key = _presetRowKey(p);
  const sizeMode = p.target_size_mb != null;
  return `
    <div class="settings-row" data-preset-row="${escHtml(key)}" style="flex-direction:column;align-items:stretch;gap:6px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <input type="text" class="settings-input ep-label" value="${escHtml(p.label || '')}" maxlength="60"
               placeholder="Label" style="flex:1;min-width:120px" aria-label="Preset label">
        <select class="settings-select ep-container" style="max-width:90px" aria-label="Container">
          <option value="mp4"${p.container === 'mp4' ? ' selected' : ''}>MP4</option>
          <option value="mkv"${p.container === 'mkv' ? ' selected' : ''}>MKV</option>
        </select>
        <select class="settings-select ep-height" style="max-width:140px" aria-label="Resolution">
          <option value=""${!p.height ? ' selected' : ''}>Source resolution</option>
          <option value="720"${p.height === 720 ? ' selected' : ''}>&le;720p</option>
          <option value="1080"${p.height === 1080 ? ' selected' : ''}>&le;1080p</option>
          <option value="1440"${p.height === 1440 ? ' selected' : ''}>&le;1440p</option>
          <option value="2160"${p.height === 2160 ? ' selected' : ''}>&le;2160p</option>
        </select>
        <label style="display:flex;align-items:center;gap:4px;font-size:12px" title="Crop to a 9:16 column and scale to 1080x1920 for TikTok / Shorts">
          <input type="checkbox" class="ep-vertical"${p.vertical ? ' checked' : ''}> Vertical 9:16
        </label>
        <button type="button" class="btn ghost ep-delete" title="Delete preset"
                aria-label="Delete preset ${escHtml(p.label || 'draft')}" style="font-size:13px;padding:2px 8px">&times;</button>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding-left:4px;font-size:12px">
        <label style="display:flex;align-items:center;gap:4px">
          <input type="radio" name="ep-mode-${escHtml(key)}" class="ep-mode-crf"${!sizeMode ? ' checked' : ''}> Quality (CRF)
        </label>
        <input type="number" class="settings-input ep-crf" min="0" max="51" value="${p.crf ?? 20}"
               style="max-width:60px" aria-label="CRF value"${sizeMode ? ' disabled' : ''}>
        <label style="display:flex;align-items:center;gap:4px">
          <input type="radio" name="ep-mode-${escHtml(key)}" class="ep-mode-size"${sizeMode ? ' checked' : ''}> Target size (MB)
        </label>
        <input type="number" class="settings-input ep-size" min="1" step="0.5" value="${p.target_size_mb ?? 10}"
               style="max-width:70px" aria-label="Target size in MB"${!sizeMode ? ' disabled' : ''}>
        <label style="display:flex;align-items:center;gap:4px">Audio
          <input type="number" class="settings-input ep-audio" min="32" max="320" value="${p.audio_kbps ?? 128}"
                 style="max-width:60px" aria-label="Audio bitrate kbps"> kbps
        </label>
      </div>
    </div>`;
}

function _renderExportPresetRows() {
  const host = document.getElementById('s-export-preset-rows');
  if (!host) return;
  const presets = AppState.exportPresets || {builtins: [], custom: []};
  const builtinRows = (presets.builtins || []).map(_builtinPresetRowHtml).join('');
  const customRows = (presets.custom || []).length
    ? presets.custom.map(_customPresetRowHtml).join('')
    : '<div style="color:var(--muted);font-size:12px;padding:4px 0 8px">No custom presets yet - add one below.</div>';
  host.innerHTML = builtinRows + customRows;
}

function _presetModeInputs(rowEl) {
  const crfRadio = rowEl.querySelector('.ep-mode-crf');
  const sizeRadio = rowEl.querySelector('.ep-mode-size');
  const crfInput = rowEl.querySelector('.ep-crf');
  const sizeInput = rowEl.querySelector('.ep-size');
  crfInput.disabled = !crfRadio.checked;
  sizeInput.disabled = !sizeRadio.checked;
}

function _presetRowValues(rowEl) {
  const sizeMode = rowEl.querySelector('.ep-mode-size').checked;
  const height = rowEl.querySelector('.ep-height').value;
  return {
    label: rowEl.querySelector('.ep-label').value.trim(),
    container: rowEl.querySelector('.ep-container').value,
    height: height ? parseInt(height, 10) : null,
    crf: sizeMode ? null : parseInt(rowEl.querySelector('.ep-crf').value, 10),
    target_size_mb: sizeMode ? parseFloat(rowEl.querySelector('.ep-size').value) : null,
    audio_kbps: parseInt(rowEl.querySelector('.ep-audio').value, 10) || 128,
    vertical: rowEl.querySelector('.ep-vertical').checked,
  };
}

async function _saveExportPresetRow(rowEl) {
  const key = rowEl.dataset.presetRow;
  const isDraft = key.startsWith('draft-');
  const body = _presetRowValues(rowEl);
  if (isDraft && !body.label) return; // wait for a label before creating anything
  const res = await fetch(isDraft ? '/api/export-presets' : `/api/export-presets/${encodeURIComponent(key)}`, {
    method: isDraft ? 'POST' : 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Could not save export preset', 'error');
    return;
  }
  const saved = await res.json();
  const customs = AppState.exportPresets.custom;
  const idx = customs.findIndex(p => String(p.name ?? p._draftKey) === key);
  if (idx !== -1) customs[idx] = saved;
  else customs.push(saved);
  _renderExportPresetRows();
  showToast('Export preset saved');
}

async function _deleteExportPresetRow(rowEl) {
  const key = rowEl.dataset.presetRow;
  if (key.startsWith('draft-')) {
    AppState.exportPresets.custom = AppState.exportPresets.custom.filter(p => p._draftKey !== key);
    _renderExportPresetRows();
    return;
  }
  const res = await fetch(`/api/export-presets/${encodeURIComponent(key)}`, {method: 'DELETE'});
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Could not delete export preset', 'error');
    return;
  }
  AppState.exportPresets.custom = AppState.exportPresets.custom.filter(p => p.name !== key);
  _renderExportPresetRows();
  showToast('Export preset deleted');
}

function addExportPresetRow() {
  AppState.exportPresets = AppState.exportPresets || {builtins: [], custom: []};
  AppState.exportPresets.custom.push({
    _draftKey: `draft-${++_draftSeq}`, label: '', container: 'mp4',
    height: null, crf: 20, target_size_mb: null, audio_kbps: 128, vertical: false,
  });
  _renderExportPresetRows();
  const host = document.getElementById('s-export-preset-rows');
  host?.querySelector('[data-preset-row^="draft-"]:last-of-type .ep-label')?.focus();
}

document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('s-add-export-preset');
  if (addBtn && !addBtn.dataset.epWired) {
    addBtn.dataset.epWired = '1';
    addBtn.addEventListener('click', addExportPresetRow);
  }
  const host = document.getElementById('s-export-preset-rows');
  if (!host) return;
  host.addEventListener('change', e => {
    const row = e.target.closest('[data-preset-row]');
    if (!row) return;
    if (e.target.classList.contains('ep-mode-crf') || e.target.classList.contains('ep-mode-size')) {
      _presetModeInputs(row);
    }
    _saveExportPresetRow(row);
  });
  host.addEventListener('click', e => {
    const del = e.target.closest('.ep-delete');
    const row = del?.closest('[data-preset-row]');
    if (row) _deleteExportPresetRow(row);
  });
});
