// Feature-map - Recording detail: session title + summary generation (code:
// video / Video). Extracted out of videos.js (which grew into a catch-all) -
// the list/filter/detail-render/re-analysis core stays there.
//   API: routes/videos.py (summarize, regenerate-summary, fields) · Tests: tests/ui/test_ui_video.py
import { AppState } from './state.js';
import { formatApiError } from './format.js';
import { openDiffModal, showConfirm } from './ui.js';
import { showToast, openLog, appendLog } from './utils.js';
import { _openSSE, _setActiveStream, _clearActiveStream, _supersedeActiveStream, _blockedByAnalyze } from './jobs.js';
import { loadVideos, renderVideoDetail, _needsModelCtaHTML } from './videos.js';
// ── video summary ─────────────────────────────────────────────────────────────
async function summarizeVideo(id, btn) {
  const actionBtn = document.getElementById('btn-summarize-video') || btn;
  if (actionBtn && actionBtn.disabled) return;
  const orig = actionBtn ? actionBtn.textContent : '';
  if (actionBtn) { actionBtn.disabled = true; actionBtn.textContent = 'Generating Summary…'; }
  try {
    const res = await fetch(`/api/videos/${id}/summarize`, {method: 'POST'});
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatApiError(err));
    }
    const data = await res.json();
    if (data.needs_model) {
      const body = document.getElementById('summary-body');
      if (body) body.innerHTML = _needsModelCtaHTML(data);
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
  } catch (err) {
    showToast(`Summary failed: ${err.message}`, 'error');
  } finally {
    if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = orig; }
  }
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
  openLog();
  _supersedeActiveStream();
  const resetBtn = () => { if (actionBtn) { actionBtn.disabled = false; actionBtn.textContent = 'Regenerate (auto-save)'; } };
  let hadError = false;
  let needsModel = false;
  const handle = _openSSE(
    `/api/videos/${id}/regenerate-summary`,
    data => {
      if (data && data.needs_model) {
        needsModel = true;
        const body = document.getElementById('summary-body');
        if (body) body.innerHTML = _needsModelCtaHTML(data);
        appendLog(data.detail);
        return;
      }
      if (typeof data === 'string' && data.startsWith('[Error')) hadError = true;
      appendLog(String(data));
    },
    () => {
      _clearActiveStream(handle);
      resetBtn();
      if (needsModel) {
        showToast('Install a local model to generate summaries', 'warning');
        return;
      }
      if (hadError) {
        showToast('Summary generation failed - check log for details', 'error');
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
      resetBtn();
      showToast(`Summary generation failed - ${errMsg}`, 'error');
    },
  );
  _setActiveStream(handle, resetBtn);
}

export { summarizeVideo, regenSummaryAuto };
