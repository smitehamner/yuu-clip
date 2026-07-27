// Feature-map - app-global keyboard shortcuts and the Escape-key layer cascade.
// Extracted out of settings.js (which grew into a catch-all) - shortcuts are
// app-wide, not settings-specific.
//   Tests: tests/ui/test_ui_keyboard.py

import { AppState } from './state.js';
import { PanelNav } from './panelnav.js';
import {
  _confirmCancel, closeAlertModal, closeControlsModal, closeFieldEditModal,
  _diffDiscard, closeActionsModal, closeKebab, isHamburgerOpen, closeHamburger,
  topmostVisibleModal, openControlsModal,
} from './ui.js';
import {
  closeGettingStartedModal, closeAboutModal, closeGlossaryModal, closeHelpModal,
} from './helpmodals.js';
import {
  selectClip, setStatus, undoLastStatus, closeScoreOverrideModal, closeSimilarClipsModal,
  _applyFilters,
} from '../clips/clips.js';
import { openExportEditor } from '../library/exporteditor.js';
import { closeProfileManager, _isNewRecordingPanelOpen, closeNewRecordingPanel } from '../analyze/analyze.js';
import { closeHighlightReelsModal, closeReelPreview, closeBatchExportModal } from '../analyze/reel.js';
import { closeContextManager, closeAutoApproveModal, closeRetranscribeModal } from '../library/contexts.js';
import { closeTimelineIntervalModal } from '../videos/videos-timeline.js';
import { isProjectMenuOpen, closeProjectMenu, closeOpenProjectModal } from '../settings/projects.js';
import { closeSettings } from '../settings/settings.js';

// ── keyboard shortcuts ────────────────────────────────────────────────────────

// Escape peels one layer per press, topmost first: floating menus (kebab z:500,
// hamburger z:300) sit above modals (z:200), which sit above the settings panel
// and the full-panel editors. topmostVisibleModal (ui.js) resolves modal
// stacking - confirm/alert take priority, so a "Discard?" confirm cancels
// without also closing the still-dirty editor underneath it.
const _modalEscapeClosers = {
  'confirm-modal':           () => _confirmCancel(),
  'alert-modal':             () => closeAlertModal(),
  'getting-started-modal':   () => closeGettingStartedModal(),
  'about-modal':             () => closeAboutModal(),
  'controls-modal':          () => closeControlsModal(),
  'glossary-modal':          () => closeGlossaryModal(),
  'help-modal':              () => closeHelpModal(),
  'field-edit-modal':        () => closeFieldEditModal(),
  'diff-modal':              () => _diffDiscard(),
  'score-override-modal':    () => closeScoreOverrideModal(),
  'profile-modal':           () => closeProfileManager(),
  'highlight-reels-modal':   () => closeHighlightReelsModal(),
  'reel-preview-modal':      () => closeReelPreview(),
  'retranscribe-modal':      () => closeRetranscribeModal(),
  'context-modal':           () => closeContextManager(),
  'batch-export-modal':      () => closeBatchExportModal(),
  'timeline-interval-modal': () => closeTimelineIntervalModal(),
  'auto-approve-modal':      () => closeAutoApproveModal(),
  'similar-clips-modal':     () => closeSimilarClipsModal(),
  'actions-modal':           () => closeActionsModal(),
  'open-project-modal':      () => closeOpenProjectModal(),
};

function _closeTopmostLayer() {
  if (closeKebab(true)) return;
  if (isHamburgerOpen()) { closeHamburger(true); return; }
  if (isProjectMenuOpen()) { closeProjectMenu(true); return; }
  const topModal = topmostVisibleModal();
  if (topModal) {
    (_modalEscapeClosers[topModal.id] || (() => topModal.classList.remove('visible')))();
    return;
  }
  if (document.getElementById('settings-panel').classList.contains('visible')) { closeSettings(); return; }
  if (PanelNav.isOpen()) { PanelNav.close(); return; }
  if (_isNewRecordingPanelOpen()) closeNewRecordingPanel();
}

// Genuine free-text entry, where Escape belongs to the field (revert/cancel), not
// to the global "close the topmost layer" handler. A range/checkbox/radio/number/
// button-ish input has nothing to abandon on Escape, so it is NOT text entry and
// Escape falls through to close the modal it lives in.
const _NON_TEXT_INPUT_TYPES = new Set([
  'range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color',
  'image', 'number',
]);

export function _isTextEntry(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') return !_NON_TEXT_INPUT_TYPES.has((el.type || 'text').toLowerCase());
  return false;
}

function _handleGlobalKeydown(e) {
  // A focused list item (clip/video <li>) handles Enter/Space itself and calls
  // preventDefault - don't ALSO run the global shortcut (e.g. Space toggling
  // play/pause while the li activation is selecting a clip).
  if (e.defaultPrevented) return;

  const t = e.target;
  const isFormField = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;

  // Escape must work with focus on a button/select/link/slider/checkbox - that's
  // where most modals place focus on open. Only genuine free-text entry keeps
  // Escape to itself (its own handler uses it to cancel); a range/checkbox/number
  // input has no text to abandon, so Escape should close the topmost layer.
  if (e.key === 'Escape' && _isTextEntry(t)) return;

  if (e.key !== 'Escape' &&
      (isFormField || t.tagName === 'BUTTON' || t.tagName === 'SELECT' || t.tagName === 'A')) return;

  // Ctrl/Cmd+Z (undo) is the only binding that intentionally uses a modifier.
  // Every other shortcut is a bare key, so let modifier chords fall through to
  // the browser/OS (Ctrl+R refresh, Cmd+A select-all, etc.) instead of hijacking
  // them - running a bare-key handler here would also preventDefault the chord.
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undoLastStatus();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const _anyModalOpen = () => document.querySelector('.modal-bg.visible') !== null;

  if (e.key === '?' || e.key === '/') {
    if (_anyModalOpen()) return;
    e.preventDefault();
    openControlsModal();
    return;
  }
  if (e.key === 'Escape') {
    _closeTopmostLayer();
    return;
  }

  // A takeover panel (e.g. Split Editor) covers the detail pane but not the
  // clip list beside it - without this guard J/K/A/R would silently act on a
  // clip the user can no longer see.
  if (_anyModalOpen() || PanelNav.isOpen()) return;

  // A/R/E must act on the clip the user is pointing at: when keyboard focus
  // sits on a clip list row (Tab), that row is the subject - not the active
  // clip, which can be a different row (focused-vs-active mismatch).
  const focusedRow = e.target instanceof Element ? e.target.closest('#clip-list li[data-clip-id]') : null;
  const subjectClipId = focusedRow ? Number(focusedRow.dataset.clipId) : AppState.activeClipId;
  if (!subjectClipId) return;

  // Activate the subject first so the detail pane and player show the clip
  // the shortcut is acting on before the action lands.
  const _actOnSubject = action => {
    if (subjectClipId !== AppState.activeClipId) selectClip(subjectClipId).then(() => action(subjectClipId));
    else action(subjectClipId);
  };
  // Arrow navigation moves keyboard focus along with the active clip so the
  // focus ring and the active highlight can never point at different rows.
  const _navigateTo = id => {
    selectClip(id);
    document.querySelector(`#clip-list li[data-clip-id="${id}"]`)?.focus();
  };

  // Navigate the shown (filtered + kind-filtered + sort-direction) list, not the
  // raw AppState.clips - so J/K step through exactly the rows the sidebar renders
  // and never jump to a hidden clip or across a hidden kind.
  const shown = _applyFilters();
  const idx = shown.findIndex(c => c.id === subjectClipId);

  switch (e.key) {
    case 'a': case 'A':
      e.preventDefault();
      _actOnSubject(id => setStatus(id, 'approved'));
      break;
    case 'r': case 'R':
      e.preventDefault();
      _actOnSubject(id => setStatus(id, 'rejected'));
      break;
    case 'u': case 'U':
      e.preventDefault();
      _actOnSubject(id => setStatus(id, 'pending'));
      break;
    case ' ':
      e.preventDefault();
      { const v = document.querySelector('#player-area video'); if (v) { v.paused ? v.play() : v.pause(); } }
      break;
    case 'e': case 'E':
      e.preventDefault();
      _actOnSubject(openExportEditor);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'k': case 'K':
      e.preventDefault();
      if (idx > 0) _navigateTo(shown[idx - 1].id);
      break;
    case 'ArrowRight':
    case 'ArrowDown':
    case 'j': case 'J':
      e.preventDefault();
      if (idx !== -1 && idx < shown.length - 1) _navigateTo(shown[idx + 1].id);
      break;
  }
}

// Registers the app-global keydown handler. Called once from boot.js (see
// initHotwordListeners in hotwords.js for the reference pattern) so importing
// this module has no DOM side effect. _modalEscapeClosers/_closeTopmostLayer are
// referenced only from within this module. Every closer/action it calls is
// imported (see the top of the file); shortcuts.js is a sink in the import graph
// (nothing else imports it), so those feature imports can't form a cycle back
// through it.
export function initShortcuts() {
  document.addEventListener('keydown', _handleGlobalKeydown);
}
