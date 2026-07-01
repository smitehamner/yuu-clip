(function () {
// ── context manager ───────────────────────────────────────────────────────────
function _parseWeight(id) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? null : Math.max(0, v);
}
async function _loadContexts() {
  AppState.contexts = await fetch('/api/contexts').then(r => r.json()).catch(() => []);
}

let _contextEditorDirty = false;
let _contextModalOpener = null;

async function openContextManager() {
  _contextModalOpener = document.activeElement;
  document.getElementById('context-modal').classList.add('visible');
  document.getElementById('context-editor').style.display = 'none';
  await _refreshContextList();
  setTimeout(() => document.querySelector('#context-modal .btn.primary')?.focus(), 50);
}

function closeContextManager() {
  if (!document.getElementById('context-modal').classList.contains('visible')) return;
  const editor = document.getElementById('context-editor');
  if (editor && editor.style.display !== 'none' && _contextEditorDirty) {
    showConfirm(
      'Discard changes?',
      'You have unsaved changes in the context editor. Close without saving?',
      'Discard',
      () => { _contextEditorDirty = false; _doCloseContextManager(); },
      true,
    );
    return;
  }
  _doCloseContextManager();
}

function _doCloseContextManager() {
  document.getElementById('context-modal').classList.remove('visible');
  const opener = _contextModalOpener;
  _contextModalOpener = null;
  if (opener?.focus) opener.focus();
}

async function _refreshContextList() {
  AppState.contexts = await fetch('/api/contexts').then(r => r.json()).catch(() => []);
  const el = document.getElementById('context-list-items');
  if (!AppState.contexts.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:4px 0">No contexts yet — create one.</div>';
    return;
  }
  el.innerHTML = AppState.contexts.map(c => `
    <div style="display:flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;cursor:pointer"
         data-edit-ctx="${escHtml(c.context_id)}">
      <span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${escHtml(c.display_name || c.context_id)}</span>
      ${c.builtin ? '<span style="font-size:10px;color:var(--muted);background:var(--border);border-radius:3px;padding:1px 5px;flex-shrink:0;pointer-events:none">Built-in</span>' : ''}
    </div>`).join('');
  el.onclick = e => {
    const item = e.target.closest('[data-edit-ctx]');
    if (item) editContext(item.dataset.editCtx);
  };
}

function openNewContext() {
  AppState.editingContextId = null;
  _contextEditorDirty = false;
  ['ce-context-id','ce-display-name','ce-setting','ce-your-chars','ce-other-chars','ce-notes',
   'ce-weight-funny','ce-weight-dramatic','ce-weight-action'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ce-context-id').disabled = false;
  document.getElementById('btn-delete-context').style.display = 'none';
  document.getElementById('context-editor').style.display = 'flex';
  document.getElementById('ce-context-id').focus();
}

function editContext(context_id) {
  const ctx = AppState.contexts.find(c => c.context_id === context_id);
  if (!ctx) return;
  AppState.editingContextId = context_id;
  _contextEditorDirty = false;
  document.getElementById('ce-context-id').value            = ctx.context_id;
  document.getElementById('ce-context-id').disabled         = true;
  document.getElementById('ce-display-name').value    = ctx.display_name || '';
  document.getElementById('ce-setting').value         = ctx.setting || '';
  document.getElementById('ce-your-chars').value      = ctx.your_characters || '';
  document.getElementById('ce-other-chars').value     = ctx.other_characters || '';
  document.getElementById('ce-notes').value           = ctx.notes || '';
  document.getElementById('ce-weight-funny').value    = ctx.score_funny_weight    != null ? ctx.score_funny_weight    : '';
  document.getElementById('ce-weight-dramatic').value = ctx.score_dramatic_weight != null ? ctx.score_dramatic_weight : '';
  document.getElementById('ce-weight-action').value   = ctx.score_action_weight   != null ? ctx.score_action_weight   : '';
  document.getElementById('btn-delete-context').style.display = '';
  document.getElementById('context-editor').style.display = 'flex';
}

function cancelContextEdit() {
  _contextEditorDirty = false;
  document.getElementById('context-editor').style.display = 'none';
}

async function saveContext() {
  const context_id  = AppState.editingContextId || document.getElementById('ce-context-id').value.trim();
  const displayName = document.getElementById('ce-display-name').value.trim();
  if (!context_id)  { showToast('ID is required', 'error'); return; }
  if (!displayName) { showToast('Display name is required', 'error'); return; }
  const res = await fetch('/api/contexts', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      context_id, display_name: displayName,
      setting:               document.getElementById('ce-setting').value,
      your_characters:       document.getElementById('ce-your-chars').value,
      other_characters:      document.getElementById('ce-other-chars').value,
      notes:                 document.getElementById('ce-notes').value,
      score_funny_weight:    _parseWeight('ce-weight-funny'),
      score_dramatic_weight: _parseWeight('ce-weight-dramatic'),
      score_action_weight:   _parseWeight('ce-weight-action'),
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Save failed', 'error');
    return;
  }
  _contextEditorDirty = false;
  document.getElementById('context-editor').style.display = 'none';
  await _refreshContextList();
  showToast(`Context "${displayName}" saved`);
}

function deleteContext() {
  if (!AppState.editingContextId) return;
  const ctx  = AppState.contexts.find(c => c.context_id === AppState.editingContextId);
  const name = ctx ? ctx.display_name : AppState.editingContextId;
  showConfirm(
    'Delete context?',
    `Delete context <strong>${escHtml(name)}</strong>?<br><br>` +
    `Videos already assigned to it will keep the Context ID — you can re-create the context to restore it.`,
    'Delete',
    () => _doDeleteContext(name),
    true,
  );
}

async function _doDeleteContext(name) {
  const res = await fetch(`/api/contexts/${encodeURIComponent(AppState.editingContextId)}`, {method: 'DELETE'});
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Delete failed', 'error');
    return;
  }
  document.getElementById('context-editor').style.display = 'none';
  await _refreshContextList();
  showToast(`Context "${name}" deleted`);
}

// ── video context assignment ──────────────────────────────────────────────────
async function addVideoContext(videoId, context_id) {
  if (!context_id) return;
  const video   = AppState.videos.find(v => v.id === videoId);
  const current = video ? [...(video.context_names || [])] : [];
  if (!current.includes(context_id)) current.push(context_id);
  await _saveVideoContexts(videoId, current);
}

async function removeVideoContext(videoId, context_id) {
  const video   = AppState.videos.find(v => v.id === videoId);
  const current = (video ? video.context_names || [] : []).filter(s => s !== context_id);
  await _saveVideoContexts(videoId, current);
}

async function _saveVideoContexts(videoId, context_ids) {
  const res = await fetch(`/api/videos/${videoId}/contexts`, {
    method: 'PATCH', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({context_names: context_ids}),
  });
  if (!res.ok) { showToast('Failed to update contexts', 'error'); return; }
  const video = AppState.videos.find(v => v.id === videoId);
  if (video) {
    video.context_names = context_ids;
    if (AppState.activeVideoId === videoId) renderVideoDetail(video, null);
  }
}

// Global delegation for chip × buttons in the detail panel
document.addEventListener('click', e => {
  const rmBtn = e.target.closest('[data-rmctx]');
  if (rmBtn && AppState.activeVideoId) removeVideoContext(AppState.activeVideoId, rmBtn.dataset.rmctx);
});

// ── re-score clips with context ───────────────────────────────────────────────
function rescoreClips(videoId, btn) {
  const video = AppState.videos.find(v => v.id === videoId);
  const count = video ? video.clip_count : 0;
  showConfirm(
    'Re-score clips with context?',
    `This will run LLM scoring on <strong>${count} clip${count !== 1 ? 's' : ''}</strong>.<br>` +
    `GPU time varies with clip count — this may take several minutes.`,
    'Re-score',
    () => _doRescoreClips(videoId, btn),
  );
}

function rescoreFailedClips(videoId, btn) {
  const video = AppState.videos.find(v => v.id === videoId);
  const count = video ? (video.clips_llm_error || 0) : 0;
  showConfirm(
    'Re-score failed clips?',
    `This will re-run LLM scoring only on the <strong>${count} clip${count !== 1 ? 's' : ''}</strong> ` +
    `that failed last time. Successfully scored clips are left untouched.`,
    'Re-score',
    () => _doRescoreClips(videoId, btn, 'rescore-failed-clips'),
  );
}

function _doRescoreClips(videoId, btn, endpoint = 'rescore-clips') {
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Re-scoring…'; }
  openLog();
  _supersedeActiveStream();
  const resetBtn = () => { if (btn) { btn.disabled = false; btn.textContent = orig; } };
  let errorCount = 0;
  const handle = _openSSE(
    `/api/videos/${videoId}/${endpoint}`,
    data => {
      if (typeof data === 'string' && data.startsWith('[Error')) errorCount++;
      appendLog(String(data));
    },
    () => {
      _clearActiveStream(handle);
      resetBtn();
      if (errorCount > 0) {
        showToast(`Re-scoring finished — ${errorCount} clip${errorCount !== 1 ? 's' : ''} failed (check log)`, 'error');
        SoundFx.play('error');
      } else {
        showToast('Re-scoring complete');
        SoundFx.play('rescore');
      }
      loadVideos().then(() => {
        if (AppState.activeVideoId === videoId) {
          const v = AppState.videos.find(v => v.id === videoId);
          if (v) renderVideoDetail(v, null);
          fetch(`/api/videos/${videoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json()).then(clips => {
            AppState.clips = clips; _renderClips();
          });
        }
      });
    },
    errMsg => {
      _clearActiveStream(handle);
      resetBtn();
      showToast(`Re-scoring failed — ${errMsg}`, 'error');
      SoundFx.play('error');
    },
  );
  _setActiveStream(handle, resetBtn);
}

function rescoreAllClips(videoId, btn) {
  const video = AppState.videos.find(v => v.id === videoId);
  const count = video ? video.clip_count : 0;
  const hasContext = video && video.context_names && video.context_names.length > 0;
  const contextWarn = hasContext ? '' :
    `<div style="margin-top:8px;padding:6px 10px;background:rgba(255,180,0,.1);border-left:3px solid var(--amber);border-radius:3px;font-size:12px">` +
    `No world context assigned — descriptions will be generic.</div>`;
  showConfirm(
    'Re-score all clips?',
    `Re-run LLM scoring on all <strong>${count} clip${count !== 1 ? 's' : ''}</strong>. ` +
    `Scores and descriptions will be overwritten. This cannot be undone.` +
    contextWarn +
    `<div style="margin-top:8px;font-size:12px;color:var(--muted)">This may take several minutes.</div>`,
    'Re-score All',
    () => _doRescoreClips(videoId, btn),
    true,
  );
}

function redescribeAllClips(videoId, btn) {
  const video = AppState.videos.find(v => v.id === videoId);
  const count = video ? video.clip_count : 0;
  const hasContext = video && video.context_names && video.context_names.length > 0;
  const contextWarn = hasContext ? '' :
    `<div style="margin-top:8px;padding:6px 10px;background:rgba(255,180,0,.1);border-left:3px solid var(--amber);border-radius:3px;font-size:12px">` +
    `No world context assigned — descriptions will be generic.</div>`;
  showConfirm(
    'Re-describe all clips?',
    `Regenerate LLM descriptions for all <strong>${count} clip${count !== 1 ? 's' : ''}</strong>. ` +
    `Scores will not change. Manually edited descriptions are preserved.` +
    contextWarn +
    `<div style="margin-top:8px;font-size:12px;color:var(--muted)">This may take several minutes.</div>`,
    'Re-describe All',
    () => _doRedescribeClips(videoId, btn),
    true,
  );
}

function _doRedescribeClips(videoId, btn) {
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Re-describing…'; }
  openLog();
  _supersedeActiveStream();
  const resetBtn = () => { if (btn) { btn.disabled = false; btn.textContent = orig; } };
  let errorCount = 0;
  const handle = _openSSE(
    `/api/videos/${videoId}/redescribe-clips`,
    data => {
      if (typeof data === 'string' && data.startsWith('[Error')) errorCount++;
      appendLog(String(data));
    },
    () => {
      _clearActiveStream(handle);
      resetBtn();
      if (errorCount > 0) {
        showToast(`Re-describe finished — ${errorCount} clip${errorCount !== 1 ? 's' : ''} failed (check log)`, 'error');
      } else {
        showToast('Descriptions regenerated');
      }
      if (AppState.activeVideoId === videoId) {
        fetch(`/api/videos/${videoId}/clips?sort=${_clipsSortParam()}`)
          .then(r => r.json())
          .then(clips => {
            AppState.clips = clips;
            _renderClips();
            if (AppState.activeClipId) selectClip(AppState.activeClipId);
          });
      }
    },
    errMsg => {
      _clearActiveStream(handle);
      resetBtn();
      showToast(`Re-describe failed — ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, resetBtn);
}

// ── reset approvals ───────────────────────────────────────────────────────────
function resetApprovals(videoId) {
  const nonPending = AppState.clips.filter(c => c.status !== 'pending').length;
  if (!nonPending) { showToast('All clips are already Unreviewed', 'info'); return; }
  showConfirm(
    'Reset all approvals?',
    `Reset <strong>${nonPending} clip${nonPending !== 1 ? 's' : ''}</strong> back to Unreviewed for this video. This cannot be undone.`,
    'Reset',
    () => _doResetApprovals(videoId),
    true,
  );
}

async function _doResetApprovals(videoId) {
  const res = await fetch(`/api/videos/${videoId}/reset-approvals`, {method: 'POST'});
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(`Failed to reset approvals: ${formatApiError(err)}`, 'error');
    return;
  }
  const data = await res.json();
  AppState.clips = await fetch(`/api/videos/${videoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
  _renderClips();
  showToast(`Reset ${data.reset} clip${data.reset !== 1 ? 's' : ''} to Unreviewed`);
}

// ── auto-approve ──────────────────────────────────────────────────────────────
let _autoApproveVideoId = null;
let _autoApproveOpener = null;

const _AUTO_APPROVE_FIELD_MAP = {
  overall:  'score_overall',
  funny:    'score_funny',
  dramatic: 'score_dramatic',
  action:   'score_action',
};

function openAutoApproveModal(videoId) {
  _autoApproveOpener = document.activeElement;
  _autoApproveVideoId = videoId;
  document.getElementById('auto-approve-slider').value = 0.6;
  document.getElementById('auto-approve-field').value = 'overall';
  updateAutoApprovePreview();
  document.getElementById('auto-approve-modal').classList.add('visible');
  setTimeout(() => document.getElementById('auto-approve-slider')?.focus(), 50);
}

function closeAutoApproveModal() {
  document.getElementById('auto-approve-modal').classList.remove('visible');
  const opener = _autoApproveOpener;
  _autoApproveOpener = null;
  if (opener?.focus) opener.focus();
}

function updateAutoApprovePreview() {
  const threshold = parseFloat(document.getElementById('auto-approve-slider').value);
  const field = document.getElementById('auto-approve-field').value;
  document.getElementById('auto-approve-threshold-label').textContent = Math.round(threshold*100) + '%';
  const scoreKey = _AUTO_APPROVE_FIELD_MAP[field] || 'score_overall';
  const pending = AppState.clips.filter(c => c.status === 'pending');
  const eligible = pending.filter(c => (c[scoreKey] || 0) >= threshold);
  const el = document.getElementById('auto-approve-preview');
  if (pending.length === 0) {
    el.textContent = 'No unreviewed clips.';
    document.getElementById('auto-approve-ok').disabled = true;
  } else if (eligible.length === 0) {
    el.textContent = `No unreviewed clips meet this threshold (${pending.length} unreviewed total).`;
    document.getElementById('auto-approve-ok').disabled = true;
  } else {
    el.textContent = `${eligible.length} of ${pending.length} unreviewed clip${eligible.length !== 1 ? 's' : ''} will be approved.`;
    document.getElementById('auto-approve-ok').disabled = false;
  }
}

async function doAutoApprove() {
  const threshold = parseFloat(document.getElementById('auto-approve-slider').value);
  const score_field = document.getElementById('auto-approve-field').value;
  const videoId = _autoApproveVideoId;
  closeAutoApproveModal();
  const res = await fetch(`/api/videos/${videoId}/auto-approve`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({threshold, score_field}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(`Auto-approve failed: ${formatApiError(err)}`, 'error');
    return;
  }
  const data = await res.json();
  AppState.clips = await fetch(`/api/videos/${videoId}/clips?sort=${_clipsSortParam()}`).then(r => r.json());
  _renderClips();
  showToast(`Approved ${data.approved} clip${data.approved !== 1 ? 's' : ''}`);
}

// ── retranscribe ──────────────────────────────────────────────────────────────
let _retranscribeClipId = null;
let _retranscribeOpener = null;

async function _loadRetranscribeSpeakerDefault() {
  const box  = document.getElementById('retranscribe-speaker-labels');
  const note = document.getElementById('retranscribe-speaker-note');
  const readiness = await _diarizationReadiness();
  box.disabled = !readiness.ready;
  box.checked  = readiness.ready;  // on by default when fully set up
  if (!readiness.ready) {
    note.innerHTML = _diarizationNoteHtml(readiness.reason, 'closeRetranscribeModal();openSettings()');
  } else {
    note.textContent = '';
  }
}

function openRetranscribeModal(clipId) {
  _retranscribeOpener = document.activeElement;
  _retranscribeClipId = clipId;
  _loadRetranscribeSpeakerDefault();
  document.getElementById('retranscribe-modal').classList.add('visible');
  setTimeout(() => document.getElementById('retranscribe-model')?.focus(), 50);
}

function closeRetranscribeModal() {
  document.getElementById('retranscribe-modal').classList.remove('visible');
  const opener = _retranscribeOpener;
  _retranscribeOpener = null;
  if (opener?.focus) opener.focus();
}

function startRetranscribe() {
  if (!_retranscribeClipId) return;
  const model = document.getElementById('retranscribe-model').value;
  const speakerLabels = document.getElementById('retranscribe-speaker-labels').checked;
  closeRetranscribeModal();
  openLog();
  streamSSE(
    `/api/clips/${_retranscribeClipId}/retranscribe?model=${encodeURIComponent(model)}&speaker_labels=${speakerLabels}`,
    () => { selectClip(_retranscribeClipId); showToast('Retranscription complete'); },
    [{label: 'Transcribe', patterns: ['Retranscribing', 'OK']}],
    'Retranscribing',
  );
}

// ── re-score individual clip ──────────────────────────────────────────────────
function rescoreClip(clipId) {
  _supersedeActiveStream();
  openLog();
  startJobUI(SCORE_STEPS, 'Re-scoring clip');
  const teardown = () => endJobUI();
  let hadError = false;
  const handle = _openSSE(
    `/api/clips/${clipId}/rescore`,
    msg => {
      updateJobUI(typeof msg === 'string' ? msg : JSON.stringify(msg));
      if (typeof msg === 'string' && msg.startsWith('[Error')) hadError = true;
      appendLog(String(msg));
    },
    async msg => {
      _clearActiveStream(handle);
      teardown();
      if (hadError) {
        showToast('Re-score failed — check log for details', 'error');
        SoundFx.play('error');
        selectClip(clipId);
        return;
      }
      const clip = await fetch(`/api/clips/${clipId}`).then(r => r.json()).catch(() => null);
      const descNew     = msg.description_new;
      const descLongNew = msg.description_long_new;
      if (descNew || descLongNew) {
        openDiffModal('Review Re-scored Descriptions', [
          {label: 'Description',       current: clip?.description_original      || clip?.description      || '', proposed: descNew     || ''},
          {label: 'Description (long)', current: clip?.description_long_original || clip?.description_long || '', proposed: descLongNew || ''},
        ], async (action, edited) => {
          await fetch(`/api/clips/${clipId}/fields`, {
            method: 'PATCH', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action, field: 'both', new_description: edited[0], new_description_long: edited[1]}),
          });
          selectClip(clipId);
        });
      } else {
        selectClip(clipId);
      }
      showToast('Clip re-scored');
      SoundFx.play('rescore');
    },
    errMsg => {
      _clearActiveStream(handle);
      teardown();
      showToast(`Re-score failed — ${errMsg}`, 'error');
      SoundFx.play('error');
    },
  );
  _setActiveStream(handle, teardown);
}

document.addEventListener('DOMContentLoaded', () => {
  const editor = document.getElementById('context-editor');
  if (editor) {
    editor.addEventListener('input',  () => { _contextEditorDirty = true; });
    editor.addEventListener('change', () => { _contextEditorDirty = true; });
  }
});

// Public API — symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  _loadContexts, _parseWeight,
  openContextManager, closeContextManager, openNewContext,
  saveContext, deleteContext, cancelContextEdit,
  addVideoContext,
  openAutoApproveModal, closeAutoApproveModal, doAutoApprove, updateAutoApprovePreview,
  openRetranscribeModal, closeRetranscribeModal, startRetranscribe,
  rescoreClip, rescoreClips, rescoreFailedClips, rescoreAllClips, redescribeAllClips, resetApprovals,
});
})();
