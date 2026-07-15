(function () {
// Feature-map - app-global keyboard shortcuts and the Escape-key layer cascade.
// Extracted out of settings.js (which grew into a catch-all) - shortcuts are
// app-wide, not settings-specific.
//   Tests: tests/ui/test_ui_keyboard.py

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
  'export-settings-modal':   () => closeExportModal(),
  'timeline-interval-modal': () => closeTimelineIntervalModal(),
  'auto-approve-modal':      () => closeAutoApproveModal(),
  'similar-clips-modal':     () => closeSimilarClipsModal(),
  'actions-modal':           () => closeActionsModal(),
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

document.addEventListener('keydown', e => {
  // A focused list item (clip/video <li>) handles Enter/Space itself and calls
  // preventDefault - don't ALSO run the global shortcut (e.g. Space toggling
  // play/pause while the li activation is selecting a clip).
  if (e.defaultPrevented) return;

  const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;

  // Escape must work with focus on a button/select/link - that's where every
  // modal places focus on open. Only typing surfaces keep Escape to themselves
  // (their own handlers, e.g. the inline caption editor, use it to cancel).
  if (e.key === 'Escape' && isTyping) return;

  if (e.key !== 'Escape' &&
      (isTyping || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'A')) return;

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

  const idx = AppState.clips.findIndex(c => c.id === subjectClipId);

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
      _actOnSubject(exportClip);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'k': case 'K':
      e.preventDefault();
      if (idx > 0) _navigateTo(AppState.clips[idx - 1].id);
      break;
    case 'ArrowRight':
    case 'ArrowDown':
    case 'j': case 'J':
      e.preventDefault();
      if (idx !== -1 && idx < AppState.clips.length - 1) _navigateTo(AppState.clips[idx + 1].id);
      break;
  }
});

// No window exports - this module's only public surface is the keydown
// listener registration itself; _modalEscapeClosers/_closeTopmostLayer are
// referenced only from within this closure.
})();
