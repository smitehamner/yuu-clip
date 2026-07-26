// Feature-map - Name corrections (code: name_corrections; UI "Fix names").
//   API: routes/name_corrections.py · Tests: tests/js/people/namecorrections.test.js
// ── transcript name correction (Plan 09) ──────────────────────────────────────
// A PanelNav takeover launched from the recording's transcript card. Scans the
// transcript for likely mis-transcriptions of known names ("You" → "Yuu"),
// groups them by pattern, and applies only the instances the user keeps checked.
// Nothing is auto-applied; applying routes through the same caption-edit path as
// a manual edit, so staleness badges and sidecars behave identically.
import { AppState } from '../core/state.js';
import { escHtml, formatApiError, plural } from '../core/format.js';
import { showToast } from '../core/utils.js';
import { PanelNav } from '../core/panelnav.js';
import { reloadVideoTranscriptIfOpen } from '../analyze/transcript.js';
import { refreshClipDetail } from '../clips/clips.js';

let _ncVideoId = null;
let _ncData = null;  // last scan result - the source for offsets/replacements at apply time

export function isNameCorrectionsOpen() {
  return PanelNav.isOpen('name-corrections');
}

export function openNameCorrections(videoId) {
  _ncVideoId = videoId;
  PanelNav.open({
    id: 'name-corrections',
    title: 'Fix names',
    render: container => _ncMount(container),
    isDirty: () => false,
    onClose: () => { _ncVideoId = null; },
  });
}

function _ncMount(container) {
  container.innerHTML = `
    <p class="nc-intro">Reviewing the transcript for mis-heard names. Nothing changes
      until you press Apply - uncheck anything that isn't really a name.</p>
    <div id="nc-results"><div class="transcript-empty">Scanning transcript&hellip;</div></div>
    <div id="nc-footer" class="nc-footer" hidden>
      <button class="btn primary" id="nc-apply">Apply</button>
    </div>`;
  container.querySelector('#nc-apply').onclick = () => _ncApply();
  container.addEventListener('change', _ncOnChange);
  _ncScan();
}

async function _ncScan() {
  const results = document.getElementById('nc-results');
  try {
    const resp = await fetch(`/api/videos/${_ncVideoId}/name-corrections/scan`, {method: 'POST'});
    if (!resp.ok) throw new Error(formatApiError(await resp.json().catch(() => ({}))));
    const data = await resp.json();
    _ncRender(data);
  } catch (err) {
    results.innerHTML = `<div class="transcript-empty">Could not scan: ${escHtml(err.message)}</div>`;
  }
}

function _ncRender(data) {
  _ncData = data;
  const results = document.getElementById('nc-results');
  const footer = document.getElementById('nc-footer');
  if (!data.groups.length) {
    const noNames = !data.lexicon.length;
    results.innerHTML = `<div class="transcript-empty">${noNames
      ? 'No known names yet - name your speakers or add characters to a world context, then scan again.'
      : 'No likely name corrections found. Your transcript looks clean.'}</div>`;
    footer.hidden = true;
    return;
  }
  results.innerHTML = data.groups.map(_ncGroupHtml).join('');
  footer.hidden = false;
  _ncUpdateApply();
}

function _ncGroupHtml(group, gi) {
  const instances = group.instances.map((inst, ii) => _ncInstanceHtml(inst, gi, ii)).join('');
  return `
    <details class="nc-group" open>
      <summary class="nc-group-head">
        <label class="nc-check" title="Select every instance in this group">
          <input type="checkbox" class="nc-group-all" data-group="${gi}" checked>
        </label>
        <span class="nc-pattern">
          <span class="nc-from">${escHtml(group.token)}</span>
          <span class="nc-arrow" aria-hidden="true">→</span>
          <span class="nc-to">${escHtml(group.suggested)}</span>
        </span>
        <span class="nc-count">${plural(group.count, 'instance')}</span>
      </summary>
      <div class="nc-instances">${instances}</div>
    </details>`;
}

function _ncInstanceHtml(inst, gi, ii) {
  const before = inst.before ? `<span class="nc-ctx">${escHtml(inst.before)}</span> ` : '';
  const after = inst.after ? ` <span class="nc-ctx">${escHtml(inst.after)}</span>` : '';
  const line = escHtml(inst.line.slice(0, inst.token_start))
    + `<mark class="nc-mark">${escHtml(inst.line.slice(inst.token_start, inst.token_end))}</mark>`
    + escHtml(inst.line.slice(inst.token_end));
  const chips = [];
  if (!inst.speaker_scoped) chips.push('<span class="nc-chip">speaker unknown</span>');
  else if (inst.speaker) chips.push(`<span class="nc-chip">${escHtml(inst.speaker)}</span>`);
  return `
    <label class="nc-instance">
      <input type="checkbox" class="nc-inst" data-group="${gi}" data-inst="${ii}" checked>
      <span class="nc-line">${before}${line}${after}</span>
      <span class="nc-chips">${chips.join('')}</span>
    </label>`;
}

function _ncOnChange(e) {
  const groupAll = e.target.closest('.nc-group-all');
  if (groupAll) {
    const details = groupAll.closest('.nc-group');
    details.querySelectorAll('.nc-inst').forEach(cb => { cb.checked = groupAll.checked; });
  }
  const inst = e.target.closest('.nc-inst');
  if (inst) _ncSyncGroupCheckbox(inst.closest('.nc-group'));
  _ncUpdateApply();
}

function _ncSyncGroupCheckbox(details) {
  const all = details.querySelector('.nc-group-all');
  const boxes = [...details.querySelectorAll('.nc-inst')];
  all.checked = boxes.every(cb => cb.checked);
  all.indeterminate = !all.checked && boxes.some(cb => cb.checked);
}

function _ncSelected() {
  return [...document.querySelectorAll('.nc-inst:checked')].map(cb => {
    const inst = _ncData.groups[+cb.dataset.group].instances[+cb.dataset.inst];
    return {
      segment_id: inst.segment_id,
      token_start: inst.token_start,
      token_end: inst.token_end,
      token: inst.token,
      replacement: _ncData.groups[+cb.dataset.group].suggested,
    };
  });
}

function _ncUpdateApply() {
  const btn = document.getElementById('nc-apply');
  if (!btn) return;
  const n = document.querySelectorAll('.nc-inst:checked').length;
  btn.disabled = n === 0;
  btn.textContent = n ? `Apply ${plural(n, 'correction')}` : 'Apply';
}

async function _ncApply() {
  const btn = document.getElementById('nc-apply');
  const corrections = _ncSelected();
  if (!corrections.length) return;
  btn.disabled = true;
  try {
    const resp = await fetch(`/api/videos/${_ncVideoId}/name-corrections/apply`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({corrections}),
    });
    if (!resp.ok) throw new Error(formatApiError(await resp.json().catch(() => ({}))));
    const data = await resp.json();
    const skipped = data.results.length - data.applied;
    showToast(skipped
      ? `Applied ${plural(data.applied, 'correction')}; ${skipped} skipped (transcript changed)`
      : `Applied ${plural(data.applied, 'correction')}`, skipped ? 'warning' : 'success');
    reloadVideoTranscriptIfOpen(_ncVideoId);
    const openClip = AppState.activeClipId;
    if (openClip != null && (data.affected_clip_ids || []).includes(openClip)) {
      refreshClipDetail(openClip);
    }
    _ncScan();  // re-scan so applied patterns drop out and the count refreshes
  } catch (err) {
    btn.disabled = false;
    showToast(`Could not apply corrections: ${err.message}`, 'error');
  }
}
