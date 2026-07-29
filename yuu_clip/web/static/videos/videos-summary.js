// Feature-map - Recording detail: session title + summary generation (code:
// video / Video). Extracted out of videos.js (which grew into a catch-all) -
// the list/filter/detail-render/re-analysis core stays there.
//   API: routes/scoring.py (summarize, regenerate-summary) · routes/videos.py (fields) · Tests: tests/ui/test_ui_video.py
import { AppState } from '../core/state.js';
import { openDiffModal, showConfirm } from '../core/ui.js';
import { showToast, appendLog } from '../core/utils.js';
import {
  _openSSE, _setActiveStream, _clearActiveStream, _supersedeActiveStream, _blockedByAnalyze,
  startJobUI, updateJobUI, endJobUI, setJobProgress, setJobCancel, SUMMARY_JOB_STEPS,
} from '../core/jobs.js';
import { loadVideos, renderVideoDetail, _needsModelCtaHTML } from './videos.js';
// ── video summary ─────────────────────────────────────────────────────────────
function summarizeVideo(id, btn) {
  if (_blockedByAnalyze('generate the summary')) return;
  const actionBtn = document.getElementById('btn-summarize-video') || btn;
  if (actionBtn && actionBtn.disabled) return;
  const orig = actionBtn ? actionBtn.textContent : '';
  if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = 'Generating Summary…'; }
  _supersedeActiveStream();
  startJobUI(SUMMARY_JOB_STEPS, 'Generating summary', true);
  setJobProgress();
  const resetBtn = () => { if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = orig; } };
  const teardown = () => { resetBtn(); endJobUI(); };
  // Nothing is written to the DB until the diff modal's accept/edit action runs,
  // so a cancel here has no partial state to discard - unlike regenerate-summary's
  // auto-save sibling below.
  setJobCancel({
    title:      'Stop generating summary?',
    body:       'The in-progress summary is discarded.',
    confirm:    'Stop',
    logMsg:     '[Summary generation cancelled]',
    clientOnly: true,
  });
  let needsModel = false;
  const handle = _openSSE(
    `/api/videos/${id}/summarize`,
    data => { updateJobUI(typeof data === 'string' ? data : JSON.stringify(data)); appendLog(String(data)); },
    () => {
      _clearActiveStream(handle);
      teardown();
      if (needsModel) return;
    },
    errMsg => {
      _clearActiveStream(handle);
      teardown();
      showToast(`Summary failed: ${errMsg}`, 'error');
    },
    {},
    null,
    data => {
      if (data && data.needs_model) {
        needsModel = true;
        const body = document.getElementById('summary-body');
        if (body) body.innerHTML = _needsModelCtaHTML(data);
        appendLog(data.detail);
        return;
      }
      openDiffModal('Review Generated Summary', [
        {label: 'Title',   current: data.title_current,   proposed: data.title_new},
        {label: 'Summary', current: data.summary_current, proposed: data.summary_new},
      ], async (action, edited) => {
        const patch = await fetch(`/api/videos/${id}/fields`, {
          method: 'PATCH', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({action, field: 'both', new_title: edited[0], new_summary: edited[1]}),
        });
        if (!patch.ok) { showToast('Save failed', 'error'); return; }
        await loadVideos();
        const video = AppState.videos.find(v => v.id === id);
        if (video) renderVideoDetail(video, null);
        showToast(action === 'accept_new' ? 'Summary accepted' : 'Summary saved as edit');
      });
    },
  );
  _setActiveStream(handle, teardown);
}

function regenSummaryAuto(id, btn) {
  showConfirm(
    'Regenerate and auto-save?',
    'The current title and summary will be replaced without a review step. This cannot be undone.',
    'Regenerate',
    () => _doRegenSummaryAuto(id, btn),
    true,
  );
}

function _doRegenSummaryAuto(id, btn) {
  if (_blockedByAnalyze('regenerate the summary')) return;
  const actionBtn = document.getElementById('btn-regen-summary') || btn;
  if (actionBtn && actionBtn.disabled) return;
  if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = 'Regenerating…'; }
  _supersedeActiveStream();
  startJobUI(SUMMARY_JOB_STEPS, 'Regenerating summary');
  const resetBtn = () => { if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = 'Regenerate (auto-save)'; } };
  const teardown = () => { resetBtn(); endJobUI(); };
  let needsModel = false;
  const handle = _openSSE(
    `/api/videos/${id}/regenerate-summary`,
    data => {
      updateJobUI(typeof data === 'string' ? data : JSON.stringify(data));
      appendLog(String(data));
    },
    () => {
      _clearActiveStream(handle);
      teardown();
      if (needsModel) {
        showToast('Install a local model to generate summaries', 'warning');
        return;
      }
      loadVideos().then(() => {
        const video = AppState.videos.find(v => v.id === id);
        if (video && AppState.activeVideoId === id) renderVideoDetail(video, null);
      });
      showToast('Summary regenerated');
    },
    errMsg => {
      _clearActiveStream(handle);
      teardown();
      showToast(`Summary generation failed - ${errMsg}`, 'error');
    },
    {},
    null,
    data => {
      // The only typed `result` this route emits is the needs-model payload.
      if (data && data.needs_model) {
        needsModel = true;
        const body = document.getElementById('summary-body');
        if (body) body.innerHTML = _needsModelCtaHTML(data);
        appendLog(data.detail);
      }
    },
  );
  _setActiveStream(handle, teardown);
}

export { summarizeVideo, regenSummaryAuto };
