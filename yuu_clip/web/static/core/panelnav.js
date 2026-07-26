// Infrastructure - PanelNav takeover framework (not a feature module).
//   Used by: split.js, clipcreate.js, exporteditor.js, namecorrections.js · Tests: tests/ui/test_ui_panelnav.py
// ── panel navigation framework ────────────────────────────────────────────────
// Multi-step flows (Split Editor, and future pickers) take over the main
// detail panel instead of using a modal: shared breadcrumb, shared dirty-state
// discard prompt. Each open panel gets its own content container so a future
// nested panel (e.g. manual-clip's picker on top of a recording view) can be
// unwound one level at a time without re-running the parent's render().
//
// The container is destroyed on close right after onClose() runs. If render()
// reparented an existing static element (rather than building fresh DOM),
// onClose() must move it back out to a stable, always-in-document location -
// otherwise it goes with the container and getElementById can't find it on
// the next open. See split.js's _teardownSplitEditor for the pattern.
import { showConfirm } from './ui.js';
import { closeSettings } from '../settings/settings.js';

const _stack = [];  // [{id, title, isDirty, onClose, container}]

function _root()    { return document.getElementById('panelnav-root'); }
function _crumb()   { return document.getElementById('panelnav-breadcrumb'); }
function _mount()   { return document.getElementById('panelnav-content'); }
function _top()     { return _stack[_stack.length - 1] || null; }

function _renderBreadcrumb() {
  const top = _top();
  const crumb = _crumb();
  crumb.innerHTML = '';
  if (!top) return;
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn ghost';
  back.style.cssText = 'padding:4px 10px;font-size:13px';
  back.textContent = '← Back';
  back.onclick = () => panelNavClose();
  const title = document.createElement('span');
  title.style.cssText = 'font-size:14px;font-weight:600';
  title.textContent = top.title;
  crumb.append(back, title);
}

function _updateVisibility() {
  _stack.forEach((entry, i) => {
    entry.container.style.display = i === _stack.length - 1 ? 'flex' : 'none';
  });
}

// A panel takeover and the Settings overlay both cover the main view - opening
// one while the other is up left Settings visibly layered on top (found
// 2026-07-25: clicking People while Settings was open). Settings' own dirty-gate
// confirm (closeSettings' onClosed callback) still runs first, so unsaved
// settings changes aren't silently discarded.
function panelNavOpen({ id, title, render, isDirty, onClose }) {
  closeSettings(() => _doPanelNavOpen({ id, title, render, isDirty, onClose }));
}

function _doPanelNavOpen({ id, title, render, isDirty, onClose }) {
  const container = document.createElement('div');
  container.dataset.panelId = id;
  container.style.cssText = 'display:flex;flex-direction:column;gap:16px';
  _mount().appendChild(container);
  _stack.push({
    id,
    title,
    isDirty: isDirty || (() => false),
    onClose: onClose || (() => {}),
    container,
  });
  _root().style.display = 'flex';
  _updateVisibility();
  _renderBreadcrumb();
  render(container);
}

function _closeTop() {
  const top = _stack.pop();
  if (!top) return;
  top.onClose();
  top.container.remove();
  if (_stack.length === 0) {
    _root().style.display = 'none';
  } else {
    _updateVisibility();
    _renderBreadcrumb();
  }
}

function panelNavClose() {
  const top = _top();
  if (!top) return;
  if (top.isDirty()) {
    showConfirm(
      'Discard changes?',
      'You have unsaved changes. Close without saving?',
      'Discard',
      _closeTop,
      true,
    );
    return;
  }
  _closeTop();
}

// Force-close the topmost panel, bypassing the dirty gate - for callers that
// have already confirmed the discard through their own (differently worded)
// prompt, e.g. switching recordings while the Split Editor is dirty.
function panelNavForceClose() {
  _closeTop();
}

function panelNavIsOpen(id) {
  if (id === undefined) return _stack.length > 0;
  return _stack.some(entry => entry.id === id);
}

export const PanelNav = {
  open: panelNavOpen, close: panelNavClose, forceClose: panelNavForceClose, isOpen: panelNavIsOpen,
};
