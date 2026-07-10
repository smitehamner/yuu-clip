(function () {
// Feature-map - Clip export (the Export modal flow + per-format export-file actions).
//   API: routes/clips/ (export.py, delete.py clip-exports, crud.py export-files, edit.py suggest-framing) · Tests: tests/test_ui_clips.py, tests/test_ui_exporteditor.py
// Renders and drives the Export dialog and the per-format rows in the clip
// detail's Export card. The rows themselves are built by _exportFormatsHtml in
// clips.js (it renders inside the detail pane); the actions they dispatch live here.

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

function _handleExportFormatAction(action, data) {
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
function _exportModeSummary(hardsub, titleCard, retranscribe) {
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
// track or a container override - the preset dictates both. Reflect that in
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
      note.innerHTML = 'Needs MediaPipe - <a href="#" onclick="closeExportModal();openSettings();return false">install it in Settings</a>.';
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
  );
}

// Public API - symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  exportClip, closeExportModal, confirmExport,
  _onExportCaptionsChange, _onExportRetranscribeChange, _onExportPresetChange,
  _onExportWordHighlightChange,
  _setExportFraming, _autoFrameExport, _updateExportModeSummary, _renderExportModeSummary,
  _handleExportFormatAction, _downloadClipExport, _revealClipExport, _copyClipExportPaths,
});
})();
