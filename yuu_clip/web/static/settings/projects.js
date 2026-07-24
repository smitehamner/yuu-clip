// Feature-map - Project switcher (code: project_dir).
//   API: routes/projects.py · Tests: tests/ui/test_ui_projects.py
// ── Project switcher ──────────────────────────────────────────────────────────
// Header dropdown to switch the server to another project folder in place (no
// restart). On a successful switch the whole page reloads - AppState is bound to
// the old project's data and is not hot-swapped. See routes/projects.py.
import { showToast } from '../core/utils.js';
import { _menuArrowKeydown } from '../core/ui.js';
import { stripQuotedPath } from '../core/format.js';

let _openProjectOpener = null;

function _projectDisplayName(pathStr) {
  // Basename of a Windows or POSIX path - the folder name is the project name (v1).
  const parts = String(pathStr).split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : pathStr;
}

async function initProjectSwitcher() {
  try {
    const data = await fetch('/api/projects').then(r => r.json());
    const btn = document.getElementById('btn-project-switcher');
    document.getElementById('project-current-name').textContent = _projectDisplayName(data.current);
    btn.title = `Current project: ${data.current}`;
    btn.style.display = '';
    _renderProjectMenu(data);
  } catch (e) {
    // Switcher stays hidden if the list can't load - the server is still usable.
  }
}

function _renderProjectMenu(data) {
  const menu = document.getElementById('project-menu');
  menu.innerHTML = '';
  const others = (data.known || []).filter(p => p.path !== data.current);

  if (others.length) {
    const heading = document.createElement('div');
    heading.className = 'section-title';
    heading.style.cssText = 'padding:6px 14px 2px;font-size:11px';
    heading.textContent = 'Recent projects';
    menu.appendChild(heading);
    for (const proj of others) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'hamburger-item';
      item.setAttribute('role', 'menuitem');
      item.disabled = !proj.exists;
      const name = document.createElement('span');
      name.textContent = _projectDisplayName(proj.path);
      name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      item.appendChild(name);
      item.title = proj.exists ? proj.path : `${proj.path} (folder not found)`;
      if (proj.exists) item.onclick = () => { closeProjectMenu(); switchProject(proj.path); };
      menu.appendChild(item);
    }
    const divider = document.createElement('div');
    divider.className = 'hamburger-divider';
    menu.appendChild(divider);
  }

  const openItem = document.createElement('button');
  openItem.type = 'button';
  openItem.className = 'hamburger-item';
  openItem.setAttribute('role', 'menuitem');
  openItem.innerHTML = '<span class="hamburger-icon" aria-hidden="true">&#128194;</span>Open another project…';
  openItem.onclick = () => { closeProjectMenu(); openOpenProjectModal(); };
  menu.appendChild(openItem);
}

function isProjectMenuOpen() {
  return document.getElementById('project-menu').classList.contains('open');
}
function toggleProjectMenu() {
  const menu = document.getElementById('project-menu');
  menu.classList.toggle('open');
  document.getElementById('btn-project-switcher').setAttribute('aria-expanded', menu.classList.contains('open'));
  if (menu.classList.contains('open')) menu.querySelector('.hamburger-item:not(:disabled)')?.focus();
}
function closeProjectMenu(refocusTrigger = false) {
  const menu = document.getElementById('project-menu');
  if (refocusTrigger || menu.contains(document.activeElement)) {
    document.getElementById('btn-project-switcher').focus();
  }
  menu.classList.remove('open');
  document.getElementById('btn-project-switcher').setAttribute('aria-expanded', 'false');
}
async function switchProject(path) {
  try {
    const res = await fetch('/api/projects/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const detail = await res.json().then(d => d.detail).catch(() => null);
      showToast(detail || 'Could not switch project', 'error');
      return false;
    }
    const data = await res.json();
    if (window.electronAPI?.projectChanged) window.electronAPI.projectChanged(data.current);
    showToast('Switching project…');
    setTimeout(() => location.reload(), 300);
    return true;
  } catch (e) {
    showToast('Could not switch project', 'error');
    return false;
  }
}

// ── Open-another-project modal ────────────────────────────────────────────────
function openOpenProjectModal() {
  _openProjectOpener = document.activeElement;
  document.getElementById('open-project-path').value = '';
  // A picker is available either way now: Electron's native dialog, or the
  // server-side tkinter fallback (_pickFolderServerSide) in a plain browser. In
  // Electron, lead with a full-width primary Browse button and demote the path
  // field to a read-back (still editable for a hand-typed path); in a plain
  // browser tab, keep the path field primary with Browse as its secondary.
  const isElectron = !!window.electronAPI?.pickProjectFolder;
  document.getElementById('btn-project-browse-primary').style.display = isElectron ? '' : 'none';
  document.getElementById('open-project-path-label').style.display = isElectron ? '' : 'none';
  document.getElementById('btn-project-browse').style.display = isElectron ? 'none' : '';
  document.getElementById('open-project-modal').classList.add('visible');
  const focusId = isElectron ? 'btn-project-browse-primary' : 'open-project-path';
  setTimeout(() => document.getElementById(focusId).focus(), 50);
}
function closeOpenProjectModal() {
  document.getElementById('open-project-modal').classList.remove('visible');
  const opener = _openProjectOpener;
  _openProjectOpener = null;
  if (opener?.focus) opener.focus();
}
function _openProjectConfirm() {
  const path = stripQuotedPath(document.getElementById('open-project-path').value.trim());
  if (!path) { showToast('Enter a project folder path', 'error'); return; }
  closeOpenProjectModal();
  switchProject(path);
}
async function browseForProjectFolder() {
  if (window.electronAPI?.pickProjectFolder) {
    const dir = await window.electronAPI.pickProjectFolder();
    if (dir) document.getElementById('open-project-path').value = dir;
    return;
  }
  const dir = await _pickFolderServerSide();
  if (dir) document.getElementById('open-project-path').value = dir;
}

// Non-Electron fallback: the server machine's own native folder picker
// (tkinter, same pattern as the video/captions file pickers in /api/pick-file),
// so a plain-browser session (e.g. `yuu-dev serve` opened in a normal tab)
// still gets a picker instead of a bare text box with no visible affordance.
async function _pickFolderServerSide() {
  try {
    const data = await fetch('/api/pick-folder').then(r => r.json());
    return data.path || null;
  } catch {
    showToast('Could not open the folder picker', 'error');
    return null;
  }
}

// Static index.html controls this module owns (the switcher dropdown + the
// open-project modal), wired once from boot.js at first paint (see
// initHotwordListeners in hotwords.js for the reference pattern) so importing
// this module has no DOM side effect.
function initProjectListeners() {
  document.getElementById('project-menu').addEventListener('keydown', e => {
    _menuArrowKeydown(document.getElementById('project-menu'), e);
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('project-switcher-wrap').contains(e.target)) closeProjectMenu();
  });
  // Close when focus leaves the switcher - covers a panel/modal (or its focus
  // trap) opening while the menu is up, which would otherwise float over it.
  document.getElementById('project-switcher-wrap').addEventListener('focusout', e => {
    if (!isProjectMenuOpen()) return;
    const wrap = document.getElementById('project-switcher-wrap');
    if (e.relatedTarget && wrap.contains(e.relatedTarget)) return;
    closeProjectMenu();
  });
  document.getElementById('btn-project-switcher').addEventListener('click', toggleProjectMenu);

  document.getElementById('open-project-path').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _openProjectConfirm(); }
  });
  document.getElementById('open-project-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeOpenProjectModal();
  });
  document.getElementById('btn-project-browse').addEventListener('click', browseForProjectFolder);
  document.getElementById('btn-project-browse-primary').addEventListener('click', browseForProjectFolder);
  document.getElementById('btn-open-project-cancel').addEventListener('click', closeOpenProjectModal);
  document.getElementById('btn-open-project-confirm').addEventListener('click', _openProjectConfirm);
}

export {
  initProjectSwitcher, initProjectListeners, isProjectMenuOpen, toggleProjectMenu, closeProjectMenu,
  openOpenProjectModal, closeOpenProjectModal, _openProjectConfirm, browseForProjectFolder,
  switchProject,
};
