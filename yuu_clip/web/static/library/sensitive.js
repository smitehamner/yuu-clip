// Feature-map - Sensitive Terms (Privacy Terms + Censor Words; code: sensitive_terms).
//   API: routes/sensitive.py . Tests: tests/ui/test_ui_sensitive.py
// -- sensitive-content settings ------------------------------------------------
// Server-backed CRUD, same per-row-save model as hot-words (hotwords.js). The
// key difference: every save/delete triggers an immediate project-wide rescan
// server-side (routes/sensitive.py - text-only, synchronous), so there's no
// separate "Rescan current recording" follow-up action here - the toast just
// reports how many clips are flagged after the edit.
// AppState.sensitiveTerms is the single cache, populated at Settings-open time.
import { AppState } from '../core/state.js';
import { plural, escHtml, formatApiError } from '../core/format.js';
import { showToast } from '../core/utils.js';
import { ensureContexts, _termContextOptions, _renderTermGroups } from './contexts.js';
import { _clipsListUrl } from '../videos/videos.js';
import { _renderClips, selectClip } from '../clips/clips.js';

let _draftSeq = 0;
const FUZZY_MIN_TERM_LENGTH = 4;

async function initSensitiveTermSettings() {
  await Promise.all([ensureSensitiveTermsCache(true), ensureContexts()]);
  _renderSensitiveTermRows();
}

async function ensureSensitiveTermsCache(force = false) {
  if (!force && AppState._sensitiveTermsLoaded) return;
  try {
    AppState.sensitiveTerms = await fetch('/api/sensitive-terms').then(r => r.json());
  } catch {
    AppState.sensitiveTerms = AppState.sensitiveTerms || [];
  }
  AppState._sensitiveTermsLoaded = true;
}

function _sensitiveRowValues(rowEl) {
  return {
    term: rowEl.querySelector('.st-term').value.trim(),
    category: rowEl.querySelector('.st-category').value,
    match_mode: rowEl.querySelector('.st-mode').value,
    enabled: rowEl.querySelector('.st-enabled').checked,
    context_slug: rowEl.querySelector('.st-context').value || null,
  };
}

// Blocks "Close spelling" for a too-short term client-side, before it ever
// reaches the server (which would 400 anyway) - matches the mode dropdown's
// own inline explanation rather than a round-trip error toast.
function _sensitiveFuzzyGuardTripped(rowEl) {
  const body = _sensitiveRowValues(rowEl);
  const warnEl = rowEl.querySelector('.st-fuzzy-warning');
  const tripped = body.match_mode === 'fuzzy' && body.term.length < FUZZY_MIN_TERM_LENGTH;
  if (warnEl) warnEl.style.display = tripped ? '' : 'none';
  return tripped;
}

async function _saveSensitiveTermRow(rowEl) {
  const key = rowEl.dataset.sensitiveRow;
  const isDraft = key.startsWith('draft-');
  const body = _sensitiveRowValues(rowEl);
  if (isDraft && !body.term) return; // wait for a term before creating anything
  if (_sensitiveFuzzyGuardTripped(rowEl)) return;
  const res = await fetch(isDraft ? '/api/sensitive-terms' : `/api/sensitive-terms/${key}`, {
    method: isDraft ? 'POST' : 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Could not save sensitive term', 'error');
    return;
  }
  const saved = await res.json();
  const idx = AppState.sensitiveTerms.findIndex(t => String(t.id ?? t._draftKey) === key);
  if (idx !== -1) AppState.sensitiveTerms[idx] = saved;
  else AppState.sensitiveTerms.push(saved);
  _renderSensitiveTermRows();
  showToast(`Sensitive term saved - ${plural(saved.clips_flagged, 'clip')} flagged`);
  _refreshActiveVideoClipsForSensitive();
}

async function _deleteSensitiveTermRow(rowEl) {
  const key = rowEl.dataset.sensitiveRow;
  if (key.startsWith('draft-')) {
    AppState.sensitiveTerms = AppState.sensitiveTerms.filter(t => t._draftKey !== key);
    _renderSensitiveTermRows();
    return;
  }
  const res = await fetch(`/api/sensitive-terms/${key}`, {method: 'DELETE'});
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    showToast(formatApiError(e) || 'Could not delete sensitive term', 'error');
    return;
  }
  const {clips_flagged} = await res.json();
  AppState.sensitiveTerms = AppState.sensitiveTerms.filter(t => String(t.id) !== key);
  _renderSensitiveTermRows();
  showToast(`Sensitive term deleted - ${plural(clips_flagged, 'clip')} flagged`);
  _refreshActiveVideoClipsForSensitive();
}

function addSensitiveTermRow() {
  AppState.sensitiveTerms.push({
    _draftKey: `draft-${++_draftSeq}`, term: '', category: 'privacy', match_mode: 'exact', enabled: true, context_slug: null,
  });
  _renderSensitiveTermRows();
  const host = document.getElementById('s-sensitive-rows');
  host?.querySelector('[data-sensitive-row^="draft-"]:last-of-type .st-term')?.focus();
}

// The CRUD routes already rescan the whole project - this just refreshes the
// currently open recording's clip list so its badges/Flagged tab reflect it
// without the user having to reselect the recording.
async function _refreshActiveVideoClipsForSensitive() {
  const videoId = AppState.activeVideoId;
  if (!videoId) return;
  const clips = await fetch(_clipsListUrl(videoId)).then(r => r.json()).catch(() => null);
  if (clips) { AppState.clips = clips; _renderClips(); if (AppState.activeClipId) selectClip(AppState.activeClipId); }
}

function _sensitiveRowKey(t) { return String(t.id ?? t._draftKey); }

const _CATEGORY_LABELS = {privacy: 'Privacy Term', censor: 'Censor Word'};
const _MODE_LABELS = {exact: 'Exact', case_insensitive: 'Ignore case', fuzzy: 'Close spelling'};

function _sensitiveRowHtml(t) {
  return `
    <div class="settings-row" data-sensitive-row="${_sensitiveRowKey(t)}" style="align-items:center;gap:6px;flex-wrap:wrap">
      <input type="text" class="settings-input st-term" value="${escHtml(t.term)}" maxlength="200"
             placeholder="Term" style="flex:1;min-width:110px" aria-label="Term">
      <select class="settings-select st-category" style="max-width:130px" aria-label="Category">
        <option value="privacy"${t.category === 'privacy' ? ' selected' : ''}>${_CATEGORY_LABELS.privacy}</option>
        <option value="censor"${t.category === 'censor' ? ' selected' : ''}>${_CATEGORY_LABELS.censor}</option>
      </select>
      <select class="settings-select st-mode" style="max-width:130px" aria-label="Match mode">
        <option value="exact"${t.match_mode === 'exact' ? ' selected' : ''}>Exact</option>
        <option value="case_insensitive"${t.match_mode === 'case_insensitive' ? ' selected' : ''}>Ignore case</option>
        <option value="fuzzy"${t.match_mode === 'fuzzy' ? ' selected' : ''}>Close spelling</option>
      </select>
      <select class="settings-select st-context" style="max-width:150px" aria-label="Applies to">
        ${_termContextOptions(t.context_slug)}
      </select>
      <label class="settings-checkbox" title="Apply this sensitive term">
        <input type="checkbox" class="st-enabled"${t.enabled ? ' checked' : ''}>
        <span style="font-size:13px">On</span>
      </label>
      <button type="button" class="btn ghost st-delete" title="Delete sensitive term"
              aria-label="Delete sensitive term ${escHtml(t.term || 'draft')}" style="font-size:13px;padding:2px 8px">&times;</button>
      <div class="st-fuzzy-warning" style="display:none;width:100%;font-size:10px;color:var(--warning)">
        Close spelling needs a term of at least ${FUZZY_MIN_TERM_LENGTH} characters - shorter terms match too many unrelated words.
      </div>
    </div>`;
}

function _renderSensitiveTermRows() {
  const host = document.getElementById('s-sensitive-rows');
  if (!host) return;
  const terms = AppState.sensitiveTerms || [];
  if (!terms.length) {
    host.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:4px 0 8px">No sensitive terms yet - add one below.</div>';
    return;
  }
  host.innerHTML = _renderTermGroups(terms, _sensitiveRowHtml);
}

// Called once from boot.js at first paint (see initHotwordListeners in hotwords.js
// for the reference pattern) so importing this module has no DOM side effect.
function initSensitiveListeners() {
  const host = document.getElementById('s-sensitive-rows');
  if (!host) return;
  host.addEventListener('change', e => {
    const row = e.target.closest('[data-sensitive-row]');
    if (row) _saveSensitiveTermRow(row);
  });
  host.addEventListener('click', e => {
    const del = e.target.closest('.st-delete');
    const row = del?.closest('[data-sensitive-row]');
    if (row) _deleteSensitiveTermRow(row);
  });
  document.getElementById('s-sensitive-add')?.addEventListener('click', addSensitiveTermRow);
}

export { initSensitiveTermSettings, ensureSensitiveTermsCache, initSensitiveListeners };
