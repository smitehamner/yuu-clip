// Feature-map - Hot-word (code: hot_words; Settings -> Hot-words).
//   API: routes/hotwords.py . Tests: tests/ui/test_ui_hotwords.py
// -- hot-words settings --------------------------------------------------------
// Server-backed CRUD (unlike the rest of the Settings panel, which batches into
// one Save): each row change persists immediately via POST/PUT/DELETE against
// /api/hotwords, mirroring the world-context manager's per-action save model.
// AppState.hotWords is the single cache - populated at boot (so the recording
// detail's Scan button can gate on it without an extra fetch) and refreshed here.
import { AppState } from '../core/state.js';
import { plural, escHtml, formatApiError } from '../core/format.js';
import { showToast, openLog, appendLog } from '../core/utils.js';
import { showConfirm } from '../core/ui.js';
import {
  _openSSE, _setActiveStream, _clearActiveStream, _supersedeActiveStream,
  startJobUI, updateJobUI, endJobUI, setJobCancel, HOTWORD_SCAN_STEPS,
} from '../core/jobs.js';
import { ensureContexts, _termContextOptions, _renderTermGroups } from './contexts.js';
import { fetchClipsList } from '../videos/videos.js';
import { _renderClips, selectClip } from '../clips/clips.js';

let _draftSeq = 0;

async function initHotwordSettings() {
  await Promise.all([ensureHotwordsCache(true), ensureContexts()]);
  _renderHotwordRows();
}

// force=true always refetches (Settings open); the boot-time call only fetches
// once, since AppState.hotWords starts as [] and boot doesn't need to be fresh-er
// than "whatever existed when the page loaded".
async function ensureHotwordsCache(force = false) {
  if (!force && AppState._hotWordsLoaded) return;
  try {
    AppState.hotWords = await fetch('/api/hotwords').then(r => r.json());
  } catch {
    AppState.hotWords = AppState.hotWords || [];
  }
  AppState._hotWordsLoaded = true;
}

function hasEnabledSemanticHotwords() {
  return (AppState.hotWords || []).some(hw => hw.enabled && hw.match_mode === 'semantic');
}

function _rowValues(rowEl) {
  return {
    phrase: rowEl.querySelector('.hw-phrase').value.trim(),
    match_mode: rowEl.querySelector('.hw-mode').value,
    boost: parseFloat(rowEl.querySelector('.hw-boost').value) || 0,
    target: rowEl.querySelector('.hw-target').value,
    enabled: rowEl.querySelector('.hw-enabled').checked,
    context_slug: rowEl.querySelector('.hw-context').value || null,
  };
}

async function _saveHotwordRow(rowEl) {
  const key = rowEl.dataset.hotwordRow;
  const isDraft = key.startsWith('draft-');
  const body = _rowValues(rowEl);
  if (isDraft && !body.phrase) return; // wait for a phrase before creating anything
  const res = await fetch(isDraft ? '/api/hotwords' : `/api/hotwords/${key}`, {
    method: isDraft ? 'POST' : 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Could not save hot-word', 'error');
    return;
  }
  const saved = await res.json();
  const idx = AppState.hotWords.findIndex(hw => String(hw.id ?? hw._draftKey) === key);
  if (idx !== -1) AppState.hotWords[idx] = saved;
  else AppState.hotWords.push(saved);
  _renderHotwordRows();
  _notifyHotwordSaved();
}

async function _deleteHotwordRow(rowEl) {
  const key = rowEl.dataset.hotwordRow;
  if (key.startsWith('draft-')) {
    AppState.hotWords = AppState.hotWords.filter(hw => hw._draftKey !== key);
    _renderHotwordRows();
    return;
  }
  const res = await fetch(`/api/hotwords/${key}`, {method: 'DELETE'});
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Could not delete hot-word', 'error');
    return;
  }
  AppState.hotWords = AppState.hotWords.filter(hw => String(hw.id) !== key);
  _renderHotwordRows();
  _notifyHotwordSaved();
}

function addHotwordRow() {
  AppState.hotWords.push({_draftKey: `draft-${++_draftSeq}`, phrase: '', match_mode: 'exact', boost: 0.1, target: 'overall', enabled: true, context_slug: null});
  _renderHotwordRows();
  const host = document.getElementById('s-hotword-rows');
  host?.querySelector('[data-hotword-row^="draft-"]:last-of-type .hw-phrase')?.focus();
}

// A hot-word save affects scores only after a rescan - surface a one-click path
// to refresh the currently open recording without forcing every video to rescan.
function _notifyHotwordSaved() {
  const videoId = AppState.activeVideoId;
  if (!videoId) { showToast('Hot-word saved'); return; }
  showToast('Hot-word saved', 'success', {
    action: {label: 'Rescan current recording', onClick: () => _rescanHotwords(videoId)},
  });
}

async function _rescanHotwords(videoId) {
  const res = await fetch(`/api/videos/${videoId}/hotword-rescan`, {method: 'POST'});
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Rescan failed', 'error');
    return;
  }
  const {clips_changed} = await res.json();
  showToast(clips_changed ? `Rescan complete - ${plural(clips_changed, 'clip')} updated` : 'Rescan complete - no changes');
  await _refreshActiveVideoClips(videoId);
}

async function _refreshActiveVideoClips(videoId) {
  if (AppState.activeVideoId !== videoId) return;
  const clips = await fetchClipsList(videoId);
  if (clips) { AppState.clips = clips; _renderClips(); if (AppState.activeClipId) selectClip(AppState.activeClipId); }
}

// -- LLM-semantic scan (Stage 2) ----------------------------------------------
// "Scan for Hot-words" lives in the recording detail's Additional Actions modal
// (videos.js openVideoActionsModal), gated on hasEnabledSemanticHotwords().
function scanHotwordsForVideo(videoId, btn) {
  const orig = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Scanning…'; }
  openLog();
  _supersedeActiveStream();
  startJobUI(HOTWORD_SCAN_STEPS, 'Scanning hot-words', true);
  const resetBtn = () => { if (btn) { btn.disabled = false; btn.textContent = orig; } };
  const teardown = () => { resetBtn(); endJobUI(); };
  setJobCancel({
    title:      'Stop hot-word scan?',
    body:       'Clips already scanned keep their updated matches; the rest are unchanged.',
    confirm:    'Stop',
    logMsg:     '[Hot-word scan cancelled]',
    clientOnly: true,
    onCancel:   () => _refreshActiveVideoClips(videoId),
  });
  let errorCount = 0;
  const handle = _openSSE(
    `/api/videos/${videoId}/hotword-scan`,
    data => {
      updateJobUI(typeof data === 'string' ? data : JSON.stringify(data));
      if (typeof data === 'string' && data.startsWith('[Error')) errorCount++;
      appendLog(String(data));
    },
    async () => {
      _clearActiveStream(handle);
      teardown();
      if (errorCount > 0) {
        showToast(`Scan finished - ${plural(errorCount, 'clip')} failed (check log)`, 'error');
      } else {
        showToast('Hot-word scan complete');
      }
      await _refreshActiveVideoClips(videoId);
    },
    errMsg => {
      _clearActiveStream(handle);
      teardown();
      showToast(`Scan failed - ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, teardown);
}

function confirmScanHotwordsForVideo(videoId, btn) {
  showConfirm(
    'Scan for hot-words?',
    'Checks every clip\'s transcript against your "Meaning" hot-words using the ' +
    'Similarity engine. Recordings with many clips may take a moment.',
    'Scan',
    () => scanHotwordsForVideo(videoId, btn),
  );
}

function _hotwordRowKey(hw) { return String(hw.id ?? hw._draftKey); }

function _hotwordRowHtml(hw) {
  return `
    <div class="settings-row" data-hotword-row="${_hotwordRowKey(hw)}" style="align-items:center;gap:6px;flex-wrap:wrap">
      <input type="text" class="settings-input hw-phrase" value="${escHtml(hw.phrase)}" maxlength="200"
             placeholder="Phrase" style="flex:1;min-width:110px" aria-label="Phrase">
      <select class="settings-select hw-mode" style="max-width:150px" aria-label="Match mode">
        <option value="exact"${hw.match_mode === 'exact' ? ' selected' : ''}>Exact</option>
        <option value="case_insensitive"${hw.match_mode === 'case_insensitive' ? ' selected' : ''}>Ignore case</option>
        <option value="semantic"${hw.match_mode === 'semantic' ? ' selected' : ''}>Meaning</option>
      </select>
      <input type="number" class="settings-input hw-boost" value="${hw.boost}" step="0.05" min="-0.5" max="0.5"
             style="max-width:76px" aria-label="Score boost" title="Score boost, -0.5 to +0.5">
      <select class="settings-select hw-target" style="max-width:105px" aria-label="Boosted score">
        <option value="overall"${hw.target === 'overall' ? ' selected' : ''}>Overall</option>
        <option value="funny"${hw.target === 'funny' ? ' selected' : ''}>Funny</option>
        <option value="dramatic"${hw.target === 'dramatic' ? ' selected' : ''}>Dramatic</option>
        <option value="action"${hw.target === 'action' ? ' selected' : ''}>Action</option>
      </select>
      <select class="settings-select hw-context" style="max-width:150px" aria-label="Applies to">
        ${_termContextOptions(hw.context_slug)}
      </select>
      <label class="settings-checkbox" title="Apply this hot-word">
        <input type="checkbox" class="hw-enabled"${hw.enabled ? ' checked' : ''}>
        <span style="font-size:13px">On</span>
      </label>
      <button type="button" class="btn ghost hw-delete" title="Delete hot-word"
              aria-label="Delete hot-word ${escHtml(hw.phrase || 'draft')}" style="font-size:13px;padding:2px 8px">&times;</button>
      ${hw.match_mode === 'semantic' ? '<div style="width:100%;font-size:10px;color:var(--muted)">Matches by concept via the Similarity engine (set under Settings → LLM scoring). Applies only via the recording\'s "Scan for Hot-words" action.</div>' : ''}
    </div>`;
}

function _renderHotwordRows() {
  const host = document.getElementById('s-hotword-rows');
  if (!host) return;
  const hotWords = AppState.hotWords || [];
  if (!hotWords.length) {
    host.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:4px 0 8px">No hot-words yet - add one below.</div>';
    return;
  }
  host.innerHTML = _renderTermGroups(hotWords, _hotwordRowHtml);
}

// Wire the Settings-panel row listeners once. Called from boot.js at first paint
// instead of at module scope, so importing this module has no DOM side effect (a
// bare-DOM vitest import no longer needs the whole index.html seeded). The panel
// elements exist in the static index.html at load, same as under DOMContentLoaded.
function initHotwordListeners() {
  const host = document.getElementById('s-hotword-rows');
  if (!host) return;
  host.addEventListener('change', e => {
    const row = e.target.closest('[data-hotword-row]');
    if (row) _saveHotwordRow(row);
  });
  host.addEventListener('click', e => {
    const del = e.target.closest('.hw-delete');
    const row = del?.closest('[data-hotword-row]');
    if (row) _deleteHotwordRow(row);
  });
  document.getElementById('s-hotword-add')?.addEventListener('click', addHotwordRow);
}

export {
  initHotwordListeners,
  initHotwordSettings, ensureHotwordsCache, hasEnabledSemanticHotwords,
  confirmScanHotwordsForVideo,
};
