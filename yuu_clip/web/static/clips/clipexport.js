// Feature-map - Clip export (the Export modal flow + per-format export-file actions).
//   API: routes/clips/ (export.py, delete.py clip-exports, crud.py export-files, edit.py suggest-framing) · Tests: tests/ui/test_ui_clips.py, tests/ui/test_ui_exporteditor.py
// Renders and drives the Export dialog and the per-format rows in the clip
// detail's Export card. The rows themselves are built by _exportFormatsHtml in
// clips.js (it renders inside the detail pane); the actions they dispatch live here.

import { AppState } from '../core/state.js';
import { escHtml, formatApiError, _fmtOffset } from '../core/format.js';
import { PanelNav } from '../core/panelnav.js';
import { streamSSE, setJobCancel } from '../core/jobs.js';
import {
  openLog, showToast, revealInFolder, copyText,
  _diarizationNoteHtml, _diarizationReadiness, _exportRetranscribeDefault,
} from '../core/utils.js';
import { showConfirm } from '../core/ui.js';
import {
  selectClip, renderDetail, renderPlayer, _releasePlayerBeforeDelete,
  _parseTimingOffset, _reloadClipList,
} from './clips.js';
import { loadVideos } from '../videos/videos.js';
import {
  exportPresetLabel, exportPresetIsVertical, exportPresetTargetSizeMb, populateExportPresetSelect,
} from '../library/exportpresets.js';
import { openSettings } from '../settings/settings.js';
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

// ── export dialog (modal) flow ───────────────────────────────────────────────
let _exportClipId = null;
let _exportOpener = null;
let _exportDiarReady  = false;
let _exportDiarReason = '';
let _exportCropX = 0.5;  // vertical-framing crop position for the active export

// A 9:16 column spanning the full height of a 16:9 preview is (9/16)^2 = 31.64%
// of its width; the box's left edge therefore travels across the remaining 68.36%.
const _VERT_BOX_W_PCT = 31.64;
const _VERT_BOX_TRAVEL_PCT = 100 - _VERT_BOX_W_PCT;

// One always-visible line answering "will this be quick or slow, and why" -
// the terms match the Getting Started guide and glossary (Quick/Precise export).
export function _exportModeSummary(hardsub, titleCard, retranscribe) {
  const reencodeReasons = [];
  if (hardsub)   reencodeReasons.push('burned-in captions');
  if (titleCard) reencodeReasons.push('the title card');
  const retxNote = retranscribe ? ' Retranscribing runs first and adds time.' : '';
  if (reencodeReasons.length) {
    return {
      precise: true,
      text: `Precise export - re-encodes for ${reencodeReasons.join(' and ')} (slower).${retxNote}`,
    };
  }
  return {
    precise: false,
    text: `Quick export - copies the video without re-encoding (seconds). Cuts may land up to ~1 s off the exact mark.${retxNote}`,
  };
}

export function _renderExportModeSummary(el, hardsub, titleCard, retranscribe) {
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

// Preset exports always re-encode and don't support the soft-subtitle (embed)
// track or a container override - the preset dictates both. Reflect that in
// the rest of the modal so a creator never hits the server-side 400 for the
// unsupported combination.
export function _onExportPresetChange(presetName) {
  const containerSel = document.getElementById('export-container');
  const captionsSel  = document.getElementById('export-captions');
  const softsubOpt   = captionsSel.querySelector('option[value="softsub"]');
  const usingPreset  = !!presetName;

  containerSel.disabled = usingPreset;
  softsubOpt.disabled = usingPreset;
  // Explain why these are locked, rather than leaving them greyed with no reason.
  const lockedReason = usingPreset ? 'Set by the chosen preset.' : '';
  containerSel.title = lockedReason;
  captionsSel.title = lockedReason;
  if (usingPreset && captionsSel.value === 'softsub') captionsSel.value = 'none';
  document.getElementById('export-framing').style.display =
    exportPresetIsVertical(presetName) ? '' : 'none';
  _updateExportTightCapWarning(presetName);
  _updateExportModeSummary();
}

// A size-capped preset spreads target_size_mb across the whole clip, so a long
// selection leaves too little video bitrate and comes out blocky. Below this
// total budget the result looks rough; a 4-min clip under Discord's 10 MB cap
// lands here, a short clip or a generous/CRF preset does not. Coarse mirror of
// export/presets.py's size math - the real encode still uses the server formula.
const _TIGHT_CAP_TOTAL_KBPS = 900;

export function _exportTightCapWarning(presetName, clip) {
  const capMb = exportPresetTargetSizeMb(presetName);
  if (!capMb || !clip || clip.start_ms == null || clip.end_ms == null) return '';
  const durationS = (clip.end_ms - clip.start_ms) / 1000;
  if (durationS <= 0) return '';
  if ((capMb * 8192) / durationS >= _TIGHT_CAP_TOTAL_KBPS) return '';
  const minutes = Math.max(1, Math.round(durationS / 60));
  const noun = clip.kind === 'scene' ? 'scene' : 'clip';
  return `This ${minutes}-minute ${noun} squeezed under a ${capMb} MB cap will look rough (blocky). Consider a larger preset or a shorter selection.`;
}

// Advisory only - never blocks export; just surfaces when the cap is too tight.
export function _updateExportTightCapWarning(presetName) {
  const el = document.getElementById('export-tightcap-warning');
  if (!el) return;
  const message = _exportTightCapWarning(presetName, AppState.activeClipData);
  el.textContent = message;
  el.style.display = message ? '' : 'none';
}

// Position the 9:16 crop box for the active export and keep the slider + buttons in sync.
export function _setExportFraming(fraction) {
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
// Fills the slider on success; the creator still confirms by exporting. A missing
// face-detection component (503) is a broken-install case (it ships with the app
// and auto-downloads), so we point at reinstalling; no face found leaves the
// manual position untouched.
async function _autoFrameExport() {
  const btn  = document.getElementById('export-autoframe-btn');
  const note = document.getElementById('export-autoframe-note');
  btn.disabled = true;
  note.textContent = 'Finding faces…';
  try {
    const res = await fetch(`/api/clips/${_exportClipId}/suggest-framing`, {method: 'POST'});
    if (res.status === 503) {
      note.textContent = "Auto-frame isn't available - the face-detection component is missing. "
        + 'Try reinstalling YuuClip, or set the crop by hand.';
      return;
    }
    if (!res.ok) throw new Error(formatApiError(await res.json().catch(() => ({}))) || `HTTP ${res.status}`);
    const {crop_x} = await res.json();
    if (crop_x == null) {
      note.textContent = 'No face found - set the crop manually.';
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

// Speaker labels only apply to a retranscribe pass and need the diarization
// backend set up (SpeechBrain installed), so the checkbox is enabled only when
// readiness holds.
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
// non-fatal - the fields just stay empty (renderer default).
async function _prefillExportCaptionStyle() {
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    document.getElementById('export-caption-font').value = cfg.caption_font_name || '';
    document.getElementById('export-caption-size').value = cfg.caption_font_size ? cfg.caption_font_size : '';
    document.getElementById('export-caption-position').value = cfg.caption_position || 'bottom';
    document.getElementById('export-caption-word-highlight').checked = !!cfg.caption_word_highlight;
    document.getElementById('export-caption-chunk-size').value = cfg.caption_word_chunk_size || 4;
    _onExportWordHighlightChange(!!cfg.caption_word_highlight);
  } catch { /* leave fields at their defaults */ }
}

// The words-on-screen count only applies when word-highlight is on; grey it out
// otherwise so the control's dependency is discoverable.
function _onExportWordHighlightChange(enabled) {
  document.getElementById('export-caption-chunk-size').disabled = !enabled;
}

export async function exportClip(id) {
  _exportOpener = document.activeElement;
  _exportClipId = id;
  document.getElementById('export-captions').value = 'softsub';
  document.getElementById('export-container').value = '';
  document.getElementById('export-trim-start').value = _fmtOffset(AppState.activeClipData?.start_offset);
  document.getElementById('export-trim-end').value   = _fmtOffset(AppState.activeClipData?.end_offset);
  const retx      = document.getElementById('export-retranscribe');
  const retxModel = document.getElementById('export-retranscribe-model');
  const { model, needsRetranscribe } = await _exportRetranscribeDefault(AppState.activeClipData?.video_id);
  retxModel.value = model;
  retx.checked = needsRetranscribe;
  _onExportRetranscribeChange(needsRetranscribe);
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

export function closeExportModal() {
  document.getElementById('export-settings-modal').classList.remove('visible');
  const opener = _exportOpener;
  _exportOpener = null;
  if (opener?.focus) opener.focus();
}

// The trim fields are free text. A blank one means "no trim" (parses to 0), but
// anything else that fails to parse is a typo the user needs told about - it used
// to skip the save silently and export the clip's previously-saved trim instead.
export function trimInputError(startRaw, endRaw) {
  for (const [label, raw] of [['Start', startRaw], ['End', endRaw]]) {
    if (isNaN(_parseTimingOffset(raw))) {
      return `${label} trim "${String(raw).trim()}" isn't a time - use +2.5, -1, or 1:23.`;
    }
  }
  return '';
}

export async function confirmExport() {
  const id        = _exportClipId;
  const captions  = document.getElementById('export-captions').value;
  const burnSubs  = captions === 'hardsub';
  const embedSubs = captions === 'softsub';
  const container = document.getElementById('export-container').value;
  const preset    = document.getElementById('export-preset').value;
  const trimStartRaw = document.getElementById('export-trim-start').value;
  const trimEndRaw   = document.getElementById('export-trim-end').value;
  const retx      = document.getElementById('export-retranscribe').checked;
  const retxModel = document.getElementById('export-retranscribe-model').value;
  const speakerLabels = document.getElementById('export-speaker-labels').checked;
  const titleCard = document.getElementById('export-title-card').checked;

  // Checked before the modal closes so the offending field is still on screen.
  const trimError = trimInputError(trimStartRaw, trimEndRaw);
  if (trimError) {
    showToast(trimError, 'error');
    return;
  }
  closeExportModal();

  const timingRes = await fetch(`/api/clips/${id}/timing`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      start_offset: _parseTimingOffset(trimStartRaw),
      end_offset: _parseTimingOffset(trimEndRaw),
    }),
  }).catch(err => { showToast(`Failed to save trim: ${err.message}`, 'error'); return null; });
  if (!timingRes || !timingRes.ok) {
    if (timingRes) {
      const detail = formatApiError(await timingRes.json().catch(() => ({})));
      showToast(detail || 'Failed to save trim points', 'error');
    }
    return;
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
    const wordHighlight = document.getElementById('export-caption-word-highlight').checked;
    params.set('word_highlight', wordHighlight ? 'true' : 'false');
    if (wordHighlight) {
      const chunkRaw = document.getElementById('export-caption-chunk-size').value.trim();
      if (chunkRaw !== '') params.set('word_chunk_size', chunkRaw);
    }
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
      // was streaming - don't clobber it by re-rendering the covered detail pane.
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

// ── static modal wiring (replaces the inline onclick=/oninput=/onchange= this
// module used to own in index.html) ────────────────────────────────────────────
// export-settings-modal is a fixed, never-recreated element in index.html, so
// wiring it once at module load (below) can't double-fire on a re-render.
function _wireExportModal() {
  const modal = document.getElementById('export-settings-modal');
  modal.addEventListener('click', e => { if (e.target === modal) closeExportModal(); });
  document.getElementById('export-cancel-btn').addEventListener('click', () => closeExportModal());
  document.getElementById('export-settings-x-btn').addEventListener('click', () => closeExportModal());
  document.getElementById('export-confirm-btn').addEventListener('click', () => confirmExport());
  document.getElementById('export-preset').addEventListener('change', e => _onExportPresetChange(e.target.value));
  document.getElementById('export-captions').addEventListener('change', () => _updateExportModeSummary());
  document.getElementById('export-caption-word-highlight').addEventListener('change', e => _onExportWordHighlightChange(e.target.checked));
  document.querySelectorAll('#export-framing [data-frame-pos]').forEach(btn => {
    btn.addEventListener('click', () => _setExportFraming(parseFloat(btn.dataset.framePos)));
  });
  document.getElementById('export-framing-slider').addEventListener('input', e => _setExportFraming(parseFloat(e.target.value)));
  document.getElementById('export-autoframe-btn').addEventListener('click', () => _autoFrameExport());
  document.getElementById('export-retranscribe').addEventListener('change', e => _onExportRetranscribeChange(e.target.checked));
  document.getElementById('export-title-card').addEventListener('change', () => _updateExportModeSummary());
}

export function initClipExportListeners() {
  _wireExportModal();
}
