// Feature-map - World context (code: rp_context / Context; UI term "Contexts").
//   API: routes/contexts.py · Tests: tests/ui/test_ui_contexts.py
import { AppState } from '../core/state.js';
import { escHtml, formatApiError, plural } from '../core/format.js';
import { showConfirm, openDiffModal } from '../core/ui.js';
import { showToast, openLog, appendLog, _diarizationReadiness, _diarizationNoteHtml } from '../core/utils.js';
import {
  _blockedByAnalyze, _openSSE, streamSSE, setJobCancel, _setActiveStream, _clearActiveStream,
  _supersedeActiveStream, startJobUI, updateJobUI, endJobUI, SCORE_STEPS,
  RESCORE_JOB_STEPS, REDESCRIBE_JOB_STEPS,
} from '../core/jobs.js';
import { loadVideos, renderVideoDetail, fetchClipsList } from '../videos/videos.js';
import { selectClip, _renderClips } from '../clips/clips.js';
import { SoundFx } from './sounds.js';

// ── context manager ───────────────────────────────────────────────────────────
export function _parseWeight(id) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? null : Math.max(0, v);
}
export async function _loadContexts() {
  AppState.contexts = await fetch('/api/contexts').then(r => r.json()).catch(() => []);
}

// A successful load always returns at least the built-in contexts, so an empty
// list means the boot-time fetch is still pending or failed transiently. Callers
// that render contexts (e.g. the recording detail) await this so the list heals
// itself instead of staying stuck empty until a manual page refresh.
export async function ensureContexts() {
  if (Array.isArray(AppState.contexts) && AppState.contexts.length) return;
  await _loadContexts();
}

// ── shared term-scope helpers (hot-words + sensitive terms) ───────────────────
// Both Settings lists let an entry be Global or scoped to a world context. These
// two helpers build the per-row "Applies to" <select> and the grouped rendering,
// so hotwords.js and sensitive.js stay identical on scoping without duplicating it.

// Options: Global first, then every known context by display name. A slug that no
// longer names a live context (its context was deleted) keeps a "(removed)" option
// so the orphaned entry still shows its scope rather than silently reading Global.
export function _termContextOptions(selectedSlug) {
  const slug = selectedSlug || '';
  let html = `<option value=""${slug === '' ? ' selected' : ''}>Global (all recordings)</option>`;
  const known = new Set();
  for (const c of (AppState.contexts || [])) {
    known.add(c.context_id);
    html += `<option value="${escHtml(c.context_id)}"${slug === c.context_id ? ' selected' : ''}>`
          + `${escHtml(c.display_name || c.context_id)}</option>`;
  }
  if (slug && !known.has(slug)) {
    html += `<option value="${escHtml(slug)}" selected>${escHtml(slug)} (removed)</option>`;
  }
  return html;
}

// Bucket terms by their context scope into ordered groups: Global (all recordings)
// first, one group per context that has entries (in the context list's order), then a
// "(removed)" group per orphaned slug whose context was deleted. Each group carries its
// display label and its rows; an empty scope produces no group. Pure - contexts is passed
// in (both hotwords.js and sensitive.js render through _renderTermGroups over AppState).
export function groupTermsByContext(terms, contexts) {
  const buckets = new Map();
  for (const term of terms) {
    const key = term.context_slug || '';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(term);
  }
  const contextList = contexts || [];
  const nameOf = slug => {
    const ctx = contextList.find(c => c.context_id === slug);
    return ctx ? (ctx.display_name || ctx.context_id) : null;
  };
  const order = [''];
  for (const c of contextList) if (buckets.has(c.context_id)) order.push(c.context_id);
  for (const key of buckets.keys()) {
    if (key && !order.includes(key)) order.push(key);
  }
  const groups = [];
  for (const key of order) {
    const rows = buckets.get(key);
    if (!rows) continue;
    const label = key === '' ? 'Global (all recordings)' : (nameOf(key) || `${key} (removed)`);
    groups.push({ key, label, rows });
  }
  return groups;
}

// Thin HTML wrapper over groupTermsByContext: one uppercase heading per group, then
// its rows via rowHtmlFn. Shared by the hot-words and sensitive-terms lists.
export function _renderTermGroups(terms, rowHtmlFn) {
  return groupTermsByContext(terms, AppState.contexts).map(group =>
    `<div style="font-size:11px;font-weight:600;color:var(--muted);margin:10px 0 2px;`
    + `text-transform:uppercase;letter-spacing:.04em">${escHtml(group.label)}</div>`
    + group.rows.map(rowHtmlFn).join(''),
  ).join('');
}

let _contextEditorDirty = false;
let _contextModalOpener = null;
// True once the user types in the Context ID field directly - from then on the
// ID stops following the name so a hand-chosen ID is never overwritten.
let _contextIdEdited = false;

// The modal-level Close button only makes sense over the context list - while the
// editor is open, Save/Cancel in its own footer are the only exits, so a second
// "Close" a scroll away would be a redundant, ambiguous-vs-Cancel affordance.
function _setContextListFooterVisible(visible) {
  document.getElementById('context-list-footer').style.display = visible ? 'flex' : 'none';
}

export async function openContextManager() {
  _contextModalOpener = document.activeElement;
  document.getElementById('context-modal').classList.add('visible');
  document.getElementById('context-editor').style.display = 'none';
  _setContextListFooterVisible(true);
  await _refreshContextList();
  setTimeout(() => document.querySelector('#context-modal .btn.primary')?.focus(), 50);
}

export function closeContextManager() {
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
    el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:4px 0">No contexts yet - create one.</div>';
    return;
  }
  el.innerHTML = AppState.contexts.map(c => `
    <button type="button" style="display:flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;cursor:pointer;background:none;color:var(--text);font:inherit;text-align:left;width:100%"
         data-edit-ctx="${escHtml(c.context_id)}">
      <span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${escHtml(c.display_name || c.context_id)}</span>
      ${c.builtin ? '<span style="font-size:10px;color:var(--muted);background:var(--border);border-radius:3px;padding:1px 5px;flex-shrink:0;pointer-events:none" title="Shipped starter content - edit it to fit your game, or use it as a base for a copy">Template</span>' : ''}
    </button>`).join('');
  el.onclick = e => {
    const item = e.target.closest('[data-edit-ctx]');
    if (item) editContext(item.dataset.editCtx);
  };
}

export function openNewContext() {
  AppState.editingContextId = null;
  _contextEditorDirty = false;
  _contextIdEdited = false;
  ['ce-context-id','ce-display-name','ce-setting','ce-your-chars','ce-other-chars','ce-notes',
   'ce-weight-funny','ce-weight-dramatic','ce-weight-action'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ce-context-id').disabled = false;
  document.getElementById('btn-delete-context').style.display = 'none';
  document.getElementById('btn-reset-context').style.display = 'none';
  document.getElementById('btn-duplicate-context').style.display = 'none';
  cancelCharacterEdit();
  _updateCharacterSectionVisibility();
  document.getElementById('context-editor').style.display = 'flex';
  _setContextListFooterVisible(false);
  document.getElementById('ce-display-name').focus();
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
  // Templates are editable content, but only user-created contexts can be
  // deleted; templates get restore-safe actions instead (reset + duplicate).
  document.getElementById('btn-delete-context').style.display    = ctx.builtin ? 'none' : '';
  document.getElementById('btn-reset-context').style.display     = ctx.builtin ? '' : 'none';
  document.getElementById('btn-duplicate-context').style.display = ctx.builtin ? '' : 'none';
  cancelCharacterEdit();
  _updateCharacterSectionVisibility();
  _loadCharacters(context_id);
  document.getElementById('context-editor').style.display = 'flex';
  _setContextListFooterVisible(false);
}

export function cancelContextEdit() {
  _contextEditorDirty = false;
  document.getElementById('context-editor').style.display = 'none';
  _setContextListFooterVisible(true);
}

// Keeps whatever is currently in the editor (including unsaved edits) and turns
// it into a new, unsaved context - the "tailor a template without losing it" path.
export function duplicateContext() {
  const baseName = document.getElementById('ce-display-name').value.trim();
  const copyName = baseName ? `${baseName} copy` : '';
  AppState.editingContextId = null;
  _contextIdEdited = false;
  document.getElementById('ce-display-name').value  = copyName;
  document.getElementById('ce-context-id').disabled = false;
  document.getElementById('ce-context-id').value    = _deriveContextId(copyName);
  document.getElementById('btn-delete-context').style.display    = 'none';
  document.getElementById('btn-reset-context').style.display     = 'none';
  document.getElementById('btn-duplicate-context').style.display = 'none';
  cancelCharacterEdit();
  _updateCharacterSectionVisibility();
  _contextEditorDirty = true;
  document.getElementById('ce-display-name').focus();
}

function resetContextToTemplate() {
  if (!AppState.editingContextId) return;
  const ctx  = AppState.contexts.find(c => c.context_id === AppState.editingContextId);
  const name = ctx ? ctx.display_name : AppState.editingContextId;
  showConfirm(
    'Reset to template?',
    `Replace <strong>${escHtml(name)}</strong> with the original shipped content? Your edits to it will be lost.`,
    'Reset',
    _doResetContext,
    true,
  );
}

async function _doResetContext() {
  const res = await fetch(`/api/contexts/${encodeURIComponent(AppState.editingContextId)}/reset`, {method: 'POST'});
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Reset failed', 'error');
    return;
  }
  _contextEditorDirty = false;
  await _refreshContextList();
  editContext(AppState.editingContextId);
  showToast('Template restored');
}

export function _deriveContextId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function saveContext() {
  const context_id  = AppState.editingContextId || document.getElementById('ce-context-id').value.trim();
  const displayName = document.getElementById('ce-display-name').value.trim();
  if (!context_id)  { showToast('Context ID is required', 'warning'); return; }
  if (!displayName) { showToast('Display name is required', 'warning'); return; }
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
  _setContextListFooterVisible(true);
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
    `Recordings already assigned to it will keep the Context ID - you can re-create the context to restore it.`,
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
  _setContextListFooterVisible(true);
  await _refreshContextList();
  showToast(`Context "${name}" deleted`);
}

// ── characters (structured, per-context lore + score boost) ───────────────────
// Characters are a DB-backed overlay keyed to this context by slug. They only exist
// for a SAVED context (a slug the API knows), so the section shows a "save first" note
// while editing an unsaved/new context. Each save/delete hits the API immediately -
// independent of the context field save - so edits here never touch _contextEditorDirty.
let _currentCharacters = [];
let _editingCharacterId = null;

function _boostPct(boost) { return Math.round((boost || 0) * 100) + '%'; }

export function _updateCharBoostLabel() {
  document.getElementById('ce-char-boost-label').textContent =
    _boostPct(parseFloat(document.getElementById('ce-char-boost').value));
}

function _updateCharacterSectionVisibility() {
  const saved = !!AppState.editingContextId;
  document.getElementById('ce-characters-note').style.display = saved ? 'none' : '';
  document.getElementById('ce-characters-list').style.display = saved ? 'flex' : 'none';
  document.getElementById('ce-add-character-btn').style.display = saved ? '' : 'none';
  if (!saved) document.getElementById('ce-character-form').style.display = 'none';
}

async function _loadCharacters(slug) {
  _currentCharacters = await fetch(`/api/contexts/${encodeURIComponent(slug)}/characters`)
    .then(r => r.json()).catch(() => []);
  _renderCharacterList();
}

function _renderCharacterList() {
  const el = document.getElementById('ce-characters-list');
  if (!_currentCharacters.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:12px">No characters yet.</div>';
    return;
  }
  el.innerHTML = _currentCharacters.map(c => `
    <div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:6px;padding:6px 10px">
      <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.name)}</span>
      ${c.score_boost > 0 ? `<span style="font-size:11px;color:var(--muted)" title="Scoring boost fed to the LLM">boost ${_boostPct(c.score_boost)}</span>` : ''}
      <button type="button" class="btn" style="padding:2px 8px;font-size:12px" data-edit-char="${c.id}">Edit</button>
      <button type="button" class="btn danger" style="padding:2px 8px;font-size:12px" data-del-char="${c.id}">Remove</button>
    </div>`).join('');
  el.onclick = e => {
    const edit = e.target.closest('[data-edit-char]');
    const del  = e.target.closest('[data-del-char]');
    if (edit) openCharacterForm(parseInt(edit.dataset.editChar, 10));
    else if (del) deleteCharacter(parseInt(del.dataset.delChar, 10));
  };
}

export function openCharacterForm(charId = null) {
  _editingCharacterId = charId;
  const char = charId != null ? _currentCharacters.find(c => c.id === charId) : null;
  document.getElementById('ce-char-name').value  = char ? char.name : '';
  document.getElementById('ce-char-lore').value  = char ? (char.lore || '') : '';
  document.getElementById('ce-char-boost').value = char ? (char.score_boost || 0) : 0;
  _updateCharBoostLabel();
  document.getElementById('ce-character-form').style.display = 'flex';
  document.getElementById('ce-add-character-btn').style.display = 'none';
  document.getElementById('ce-char-name').focus();
}

export function cancelCharacterEdit() {
  _editingCharacterId = null;
  document.getElementById('ce-character-form').style.display = 'none';
  document.getElementById('ce-add-character-btn').style.display = '';
}

async function saveCharacter() {
  const slug = AppState.editingContextId;
  if (!slug) return;
  const name = document.getElementById('ce-char-name').value.trim();
  if (!name) { showToast('Character name is required', 'warning'); return; }
  const payload = {
    name,
    lore: document.getElementById('ce-char-lore').value,
    score_boost: parseFloat(document.getElementById('ce-char-boost').value) || 0,
  };
  const url = _editingCharacterId != null
    ? `/api/characters/${_editingCharacterId}`
    : `/api/contexts/${encodeURIComponent(slug)}/characters`;
  const res = await fetch(url, {
    method: _editingCharacterId != null ? 'PUT' : 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Save failed', 'error');
    return;
  }
  cancelCharacterEdit();
  await _loadCharacters(slug);
  showToast(`Character "${name}" saved`);
}

function deleteCharacter(charId) {
  const char = _currentCharacters.find(c => c.id === charId);
  if (!char) return;
  showConfirm(
    'Remove character?',
    `Remove <strong>${escHtml(char.name)}</strong>? Any Person linked to it will be unlinked - their name and voice are not affected.`,
    'Remove',
    async () => {
      const res = await fetch(`/api/characters/${charId}`, {method: 'DELETE'});
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        showToast(formatApiError(e) || 'Remove failed', 'error');
        return;
      }
      await _loadCharacters(AppState.editingContextId);
      showToast(`Character "${char.name}" removed`);
    },
    true,
  );
}

// ── video context assignment ──────────────────────────────────────────────────
export async function addVideoContext(videoId, context_id) {
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

// ── re-score mode picker (LLM-only vs full) ───────────────────────────────────
// Shared markup + reader so the per-recording dialog and the per-clip chooser
// offer the identical choice. "LLM only" (default) keeps the on-screen activity
// and laughter scores from the last analysis; "Full" recomputes every score.
function _rescoreModeRadios() {
  return `<div style="margin-top:12px;font-size:13px">
    <div style="margin-bottom:6px;color:var(--muted)">Re-score:</div>
    <label style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      <input type="radio" name="rescore-mode" value="llm" checked>
      LLM only - keep on-screen activity &amp; laughter scores
    </label>
    <label style="display:flex;align-items:center;gap:6px">
      <input type="radio" name="rescore-mode" value="full">
      Full - recompute every score
    </label>
  </div>`;
}

function _readRescoreMode() {
  const picked = document.querySelector('input[name="rescore-mode"]:checked');
  return !!picked && picked.value === 'full';
}

// ── re-score clips with context ───────────────────────────────────────────────
export async function rescoreClips(videoId, btn) {
  const video = AppState.videos.find(v => v.id === videoId);
  const count = video ? video.clip_count : 0;
  let cap = {vision: false};
  try { cap = await fetch('/api/llm/capabilities').then(r => r.json()); } catch { /* offline */ }
  const framesRow = (window._visionEnabled && cap.vision)
    ? `<label style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:13px">
         <input type="checkbox" id="rescore-include-frames"> Include frame analysis (slower)
       </label>`
    : '';
  showConfirm(
    'Re-score clips with context?',
    `This will run LLM scoring on <strong>${plural(count, 'clip')}</strong>.<br>` +
    `GPU time varies with clip count - this may take several minutes.` + framesRow +
    _rescoreModeRadios(),
    'Re-score',
    () => {
      const inc = document.getElementById('rescore-include-frames');
      _doRescoreClips(videoId, btn, 'rescore-clips', !!(inc && inc.checked), _readRescoreMode());
    },
  );
}

export function rescoreFailedClips(videoId, btn) {
  const video = AppState.videos.find(v => v.id === videoId);
  const count = video ? (video.clips_llm_error || 0) : 0;
  showConfirm(
    'Re-score failed clips?',
    `This will re-run LLM scoring only on the <strong>${plural(count, 'clip')}</strong> ` +
    `that failed last time. Successfully scored clips are left untouched.`,
    'Re-score',
    () => _doRescoreClips(videoId, btn, 'rescore-failed-clips'),
  );
}

function _doRescoreClips(videoId, btn, endpoint = 'rescore-clips', includeFrames = false, full = false) {
  if (_blockedByAnalyze('re-score clips')) return;
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Re-scoring…'; }
  openLog();
  _supersedeActiveStream();
  startJobUI(RESCORE_JOB_STEPS, 'Re-scoring clips', true);
  const resetBtn = () => { if (btn) { btn.disabled = false; btn.textContent = orig; } };
  const teardown = () => { resetBtn(); endJobUI(); };
  // Refresh the sidebar/detail/clip list to reflect committed scores - shared by the
  // done handler and the cancel handler (the batch commits per clip, so a cancelled
  // run leaves the already-scored clips updated).
  const reload = () => {
    loadVideos().then(() => {
      if (AppState.activeVideoId === videoId) {
        const v = AppState.videos.find(v => v.id === videoId);
        if (v) renderVideoDetail(v, null);
        fetchClipsList(videoId).then(clips => {
          if (clips) { AppState.clips = clips; _renderClips(); }
        });
      }
    });
  };
  // Soft cancel: aborts the stream client-side; the server stops after the current
  // clip and keeps everything scored so far (see PROGRESS-CANCEL-GAP Part B).
  setJobCancel({
    title:      'Stop re-scoring?',
    body:       'Clips already re-scored keep their new scores; the rest keep their previous scores.',
    confirm:    'Stop',
    logMsg:     '[Re-scoring cancelled]',
    clientOnly: true,
    onCancel:   reload,
  });
  let errorCount = 0;
  const params = new URLSearchParams();
  if (includeFrames) params.set('include_frames', '1');
  if (full) params.set('full', '1');
  const qs = params.toString();
  const handle = _openSSE(
    `/api/videos/${videoId}/${endpoint}${qs ? '?' + qs : ''}`,
    data => {
      updateJobUI(typeof data === 'string' ? data : JSON.stringify(data));
      if (typeof data === 'string' && data.startsWith('[Error')) errorCount++;
      appendLog(String(data));
    },
    () => {
      _clearActiveStream(handle);
      teardown();
      if (errorCount > 0) {
        showToast(`Re-scoring finished - ${plural(errorCount, 'clip')} failed (check log)`, 'error');
        SoundFx.play('error');
      } else {
        showToast('Re-scoring complete');
        SoundFx.play('rescore');
      }
      reload();
    },
    errMsg => {
      _clearActiveStream(handle);
      teardown();
      showToast(`Re-scoring failed - ${errMsg}`, 'error');
      SoundFx.play('error');
    },
  );
  _setActiveStream(handle, teardown);
}

export function rescoreAllClips(videoId, btn) {
  const video = AppState.videos.find(v => v.id === videoId);
  const count = video ? video.clip_count : 0;
  const hasContext = video && video.context_names && video.context_names.length > 0;
  const contextWarn = hasContext ? '' :
    `<div style="margin-top:8px;padding:6px 10px;background:color-mix(in srgb, var(--warning) 10%, transparent);border-left:3px solid var(--warning);border-radius:3px;font-size:12px">` +
    `No world context assigned - descriptions will be generic.</div>`;
  showConfirm(
    'Re-score all clips?',
    `Re-run LLM scoring on all <strong>${plural(count, 'clip')}</strong>. ` +
    `Scores and descriptions will be overwritten. This cannot be undone.` +
    contextWarn +
    _rescoreModeRadios() +
    `<div style="margin-top:8px;font-size:12px;color:var(--muted)">This may take several minutes.</div>`,
    'Re-score All',
    () => _doRescoreClips(videoId, btn, 'rescore-clips', false, _readRescoreMode()),
    true,
  );
}

export function redescribeAllClips(videoId, btn) {
  const video = AppState.videos.find(v => v.id === videoId);
  const count = video ? video.clip_count : 0;
  const hasContext = video && video.context_names && video.context_names.length > 0;
  const contextWarn = hasContext ? '' :
    `<div style="margin-top:8px;padding:6px 10px;background:color-mix(in srgb, var(--warning) 10%, transparent);border-left:3px solid var(--warning);border-radius:3px;font-size:12px">` +
    `No world context assigned - descriptions will be generic.</div>`;
  showConfirm(
    'Re-describe all clips?',
    `Regenerate LLM descriptions for all <strong>${plural(count, 'clip')}</strong>. ` +
    `Scores will not change. Manually edited descriptions are preserved.` +
    contextWarn +
    `<div style="margin-top:8px;font-size:12px;color:var(--muted)">This may take several minutes.</div>`,
    'Re-describe All',
    () => _doRedescribeClips(videoId, btn),
    true,
  );
}

function _doRedescribeClips(videoId, btn) {
  if (_blockedByAnalyze('re-describe clips')) return;
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Re-describing…'; }
  openLog();
  _supersedeActiveStream();
  startJobUI(REDESCRIBE_JOB_STEPS, 'Re-describing clips', true);
  const resetBtn = () => { if (btn) { btn.disabled = false; btn.textContent = orig; } };
  const teardown = () => { resetBtn(); endJobUI(); };
  // Refresh the clip list to reflect committed descriptions - shared by done + cancel
  // (the batch commits per clip, so a cancelled run keeps the already-regenerated ones).
  const reload = () => {
    if (AppState.activeVideoId === videoId) {
      fetchClipsList(videoId).then(clips => {
        if (clips) {
          AppState.clips = clips;
          _renderClips();
          if (AppState.activeClipId) selectClip(AppState.activeClipId);
        }
      });
    }
  };
  setJobCancel({
    title:      'Stop re-describing?',
    body:       'Descriptions already regenerated are kept; the rest keep their previous descriptions.',
    confirm:    'Stop',
    logMsg:     '[Re-describe cancelled]',
    clientOnly: true,
    onCancel:   reload,
  });
  let errorCount = 0;
  const handle = _openSSE(
    `/api/videos/${videoId}/redescribe-clips`,
    data => {
      updateJobUI(typeof data === 'string' ? data : JSON.stringify(data));
      if (typeof data === 'string' && data.startsWith('[Error')) errorCount++;
      appendLog(String(data));
    },
    () => {
      _clearActiveStream(handle);
      teardown();
      if (errorCount > 0) {
        showToast(`Re-describe finished - ${plural(errorCount, 'clip')} failed (check log)`, 'error');
      } else {
        showToast('Descriptions regenerated');
      }
      reload();
    },
    errMsg => {
      _clearActiveStream(handle);
      teardown();
      showToast(`Re-describe failed - ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, teardown);
}

// ── reset approvals ───────────────────────────────────────────────────────────
export function resetApprovals(videoId) {
  const nonPending = AppState.clips.filter(c => c.status !== 'pending').length;
  if (!nonPending) { showToast('All clips are already Unreviewed', 'info'); return; }
  showConfirm(
    'Reset all approvals?',
    `Reset <strong>${plural(nonPending, 'clip')}</strong> back to Unreviewed for this recording. This cannot be undone.`,
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
  const clips = await fetchClipsList(videoId);
  if (clips) { AppState.clips = clips; _renderClips(); }
  showToast(`Reset ${plural(data.reset, 'clip')} to Unreviewed`);
}

// ── auto-approve ──────────────────────────────────────────────────────────────
let _autoApproveVideoId = null;
let _autoApproveOpener = null;

const _AUTO_APPROVE_FIELD_MAP = {
  overall:  'score_overall',
  funny:    'score_funny',
  dramatic: 'score_dramatic',
  action:   'score_action',
  visual:   'score_visual',
  laugh:    'score_laugh',
};

export function openAutoApproveModal(videoId) {
  _autoApproveOpener = document.activeElement;
  _autoApproveVideoId = videoId;
  document.getElementById('auto-approve-slider').value = 0.6;
  document.getElementById('auto-approve-field').value = 'overall';
  updateAutoApprovePreview();
  document.getElementById('auto-approve-modal').classList.add('visible');
  setTimeout(() => document.getElementById('auto-approve-slider')?.focus(), 50);
}

export function closeAutoApproveModal() {
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
    el.textContent = `${eligible.length} of ${plural(pending.length, 'unreviewed clip')} will be approved.`;
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
  const clips = await fetchClipsList(videoId);
  if (clips) { AppState.clips = clips; _renderClips(); }
  showToast(`Approved ${plural(data.approved, 'clip')}`);
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

export function openRetranscribeModal(clipId) {
  _retranscribeOpener = document.activeElement;
  _retranscribeClipId = clipId;
  _loadRetranscribeSpeakerDefault();
  document.getElementById('retranscribe-modal').classList.add('visible');
  setTimeout(() => document.getElementById('retranscribe-model')?.focus(), 50);
}

export function closeRetranscribeModal() {
  document.getElementById('retranscribe-modal').classList.remove('visible');
  const opener = _retranscribeOpener;
  _retranscribeOpener = null;
  if (opener?.focus) opener.focus();
}

// Preflight the selected model's cache state before starting, matching the
// analyze flow's "still downloading" confirm - a picked large-v3 (~2.9 GB) should
// never start downloading as a surprise side effect of clicking Retranscribe.
export async function startRetranscribe() {
  if (!_retranscribeClipId) return;
  const modelSelect = document.getElementById('retranscribe-model');
  const model = modelSelect.value;
  let cached = true;
  try {
    ({ cached } = await fetch(`/api/whisper/model-cached?model=${encodeURIComponent(model)}`).then(r => r.json()));
  } catch { /* can't tell - don't block the user */ }
  if (!cached) {
    const modelLabel = modelSelect.options[modelSelect.selectedIndex]?.textContent || model;
    showConfirm(
      'Download speech model?',
      `The ${escHtml(modelLabel)} model isn't downloaded yet. Retranscribing will download it ` +
        `first, then transcribe. Continue?`,
      'Download & retranscribe',
      _doStartRetranscribe,
    );
    return;
  }
  _doStartRetranscribe();
}

function _doStartRetranscribe() {
  if (!_retranscribeClipId) return;
  // Capture now: reopening the modal for another clip mid-job would repoint the
  // module-level id, making onDone select the wrong clip when this job finishes.
  const clipId = _retranscribeClipId;
  const model = document.getElementById('retranscribe-model').value;
  const speakerLabels = document.getElementById('retranscribe-speaker-labels').checked;
  closeRetranscribeModal();
  openLog();
  streamSSE(
    `/api/clips/${clipId}/retranscribe?model=${encodeURIComponent(model)}&speaker_labels=${speakerLabels}`,
    () => { selectClip(clipId); showToast('Retranscription complete'); },
    [{label: 'Transcribe', patterns: ['Retranscribing', 'OK']}],
    'Retranscribing',
    true,
  );
  setJobCancel({
    url:     '/api/analyze/cancel',
    title:   'Cancel retranscription?',
    body:    'The clip keeps its previous transcript. You can retranscribe it again anytime.',
    confirm: 'Cancel Retranscribe',
    logMsg:  '[Retranscription cancelled]',
  });
}

// ── re-score individual clip ──────────────────────────────────────────────────
// Offer the LLM-only vs full choice before running (kebab "Re-score"). The
// contextual quick actions (edited-captions note, manual clip creation) call
// rescoreClip directly and stay LLM-only.
export function rescoreClipChoose(clipId) {
  showConfirm(
    'Re-score clip?',
    _rescoreModeRadios(),
    'Re-score',
    () => rescoreClip(clipId, _readRescoreMode()),
  );
}

export function rescoreClip(clipId, full = false) {
  if (_blockedByAnalyze('re-score a clip')) return;
  _supersedeActiveStream();
  openLog();
  startJobUI(SCORE_STEPS, 'Re-scoring clip');
  const teardown = () => endJobUI();
  let hadError = false;
  const handle = _openSSE(
    `/api/clips/${clipId}/rescore${full ? '?full=1' : ''}`,
    msg => {
      updateJobUI(typeof msg === 'string' ? msg : JSON.stringify(msg));
      if (typeof msg === 'string' && msg.startsWith('[Error')) hadError = true;
      appendLog(String(msg));
    },
    async msg => {
      _clearActiveStream(handle);
      teardown();
      if (hadError) {
        showToast('Re-score failed - check log for details', 'error');
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
      showToast(`Re-score failed - ${errMsg}`, 'error');
      SoundFx.play('error');
    },
  );
  _setActiveStream(handle, teardown);
}

// Called once from boot.js at first paint (see initHotwordListeners in hotwords.js
// for the reference pattern) so importing this module has no DOM side effect.
export function initContextsListeners() {
  // Global delegation for chip × buttons in the detail panel.
  document.addEventListener('click', e => {
    const rmBtn = e.target.closest('[data-rmctx]');
    if (rmBtn && AppState.activeVideoId) removeVideoContext(AppState.activeVideoId, rmBtn.dataset.rmctx);
  });

  const editor = document.getElementById('context-editor');
  if (editor) {
    // The Characters section saves independently via its own API calls, so typing
    // there must not flip the context-field dirty flag (it would wrongly prompt
    // "Discard changes?" on close). Everything else in the editor is dirty-tracked.
    const fromChars = e => !!e.target.closest('#ce-characters-section');
    editor.addEventListener('input',  e => { if (!fromChars(e)) _contextEditorDirty = true; });
    editor.addEventListener('change', e => { if (!fromChars(e)) _contextEditorDirty = true; });
  }
  const nameInput = document.getElementById('ce-display-name');
  const idInput   = document.getElementById('ce-context-id');
  if (nameInput && idInput) {
    nameInput.addEventListener('input', () => {
      if (!idInput.disabled && !_contextIdEdited) idInput.value = _deriveContextId(nameInput.value);
    });
    idInput.addEventListener('input', () => { _contextIdEdited = true; });
  }

  document.getElementById('btn-world-contexts')?.addEventListener('click', () => openContextManager());

  const contextModal = document.getElementById('context-modal');
  contextModal?.addEventListener('click', e => { if (e.target === contextModal) closeContextManager(); });
  document.getElementById('context-close-btn')?.addEventListener('click', () => closeContextManager());
  document.getElementById('context-manager-x-btn')?.addEventListener('click', () => closeContextManager());
  document.getElementById('context-new-btn')?.addEventListener('click', () => openNewContext());
  document.getElementById('context-save-btn')?.addEventListener('click', () => saveContext());
  document.getElementById('context-cancel-btn')?.addEventListener('click', () => cancelContextEdit());
  document.getElementById('btn-duplicate-context')?.addEventListener('click', () => duplicateContext());
  document.getElementById('btn-delete-context')?.addEventListener('click', () => deleteContext());
  document.getElementById('btn-reset-context')?.addEventListener('click', () => resetContextToTemplate());

  document.getElementById('ce-save-character-btn')?.addEventListener('click', () => saveCharacter());
  document.getElementById('ce-cancel-character-btn')?.addEventListener('click', () => cancelCharacterEdit());
  document.getElementById('ce-add-character-btn')?.addEventListener('click', () => openCharacterForm());
  document.getElementById('ce-char-boost')?.addEventListener('input', () => _updateCharBoostLabel());

  const retranscribeModal = document.getElementById('retranscribe-modal');
  retranscribeModal?.addEventListener('click', e => { if (e.target === retranscribeModal) closeRetranscribeModal(); });
  document.getElementById('retranscribe-cancel-btn')?.addEventListener('click', () => closeRetranscribeModal());
  document.getElementById('retranscribe-start-btn')?.addEventListener('click', () => startRetranscribe());

  const autoApproveModal = document.getElementById('auto-approve-modal');
  autoApproveModal?.addEventListener('click', e => { if (e.target === autoApproveModal) closeAutoApproveModal(); });
  document.getElementById('auto-approve-cancel-btn')?.addEventListener('click', () => closeAutoApproveModal());
  document.getElementById('auto-approve-ok')?.addEventListener('click', () => doAutoApprove());
  document.getElementById('auto-approve-field')?.addEventListener('change', () => updateAutoApprovePreview());
  document.getElementById('auto-approve-slider')?.addEventListener('input', () => updateAutoApprovePreview());
}
