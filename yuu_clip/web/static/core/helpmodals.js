// Feature-map - the four app-global help/info modals (Getting Started, Help &
// Guides, About, Glossary). Extracted out of settings.js (which grew into a
// catch-all) - these have no coupling to the settings save/dirty machinery.
//   API: routes/config.py (glossary), /static/help/*.md (bundled user guides)
//   Tests: tests/ui/test_ui_settings.py, tests/ui/test_ui_help.py, tests/ui/test_ui_page.py, tests/ui/test_ui_keyboard.py

import { renderMarkdown } from './markdown.js';

// ── getting started modal ─────────────────────────────────────────────────────
let _gettingStartedOpener = null;
export function openGettingStartedModal() {
  _gettingStartedOpener = document.activeElement;
  document.getElementById('getting-started-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#getting-started-modal .btn')?.focus(), 50);
}
export function closeGettingStartedModal() {
  document.getElementById('getting-started-modal').classList.remove('visible');
  localStorage.setItem('yuu-getting-started-seen', '1');
  const opener = _gettingStartedOpener;
  _gettingStartedOpener = null;
  if (opener?.focus) opener.focus();
}

// ── about modal ───────────────────────────────────────────────────────────────
let _aboutOpener = null;
export function openAboutModal() {
  _aboutOpener = document.activeElement;
  document.getElementById('about-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#about-modal .btn')?.focus(), 50);
}
export function closeAboutModal() {
  document.getElementById('about-modal').classList.remove('visible');
  const opener = _aboutOpener;
  _aboutOpener = null;
  if (opener?.focus) opener.focus();
}

// ── help & guides modal ───────────────────────────────────────────────────────
// The four user guides ship inside the app (yuu_clip/web/static/help/*.md, copied
// from docs/user/ by `yuu-dev help-docs`, drift-guarded) and render in-app so Help
// works offline and while the repo is private - matching the local-only
// positioning. Each doc keeps a secondary "View online" link; its relative
// cross-links resolve to GitHub (opened in the system browser via
// setWindowOpenHandler in the packaged app).
const HELP_DOCS = [
  { key: 'overview', file: 'OVERVIEW.md', title: 'Overview',
    blurb: "Plain-English intro - what YuuClip does and why you'd want it.",
    onlineUrl: 'https://github.com/smitehamner/yuu-clip/blob/main/docs/user/OVERVIEW.md' },
  { key: 'features', file: 'FEATURES.md', title: 'Feature guide',
    blurb: 'Everything the app can do and where to find each feature.',
    onlineUrl: 'https://github.com/smitehamner/yuu-clip/blob/main/docs/user/FEATURES.md' },
  { key: 'walkthrough', file: 'end-to-end-walkthrough.md', title: 'End-to-end walkthrough',
    blurb: 'A step-by-step run from a raw recording to exported clips.',
    onlineUrl: 'https://github.com/smitehamner/yuu-clip/blob/main/docs/user/tutorials/end-to-end-walkthrough.md' },
  { key: 'performance', file: 'PERFORMANCE.md', title: 'Performance & disk usage',
    blurb: 'How long analysis takes and how much disk space it needs.',
    onlineUrl: 'https://github.com/smitehamner/yuu-clip/blob/main/docs/user/PERFORMANCE.md' },
];

const _escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let _helpOpener = null;
export function openHelpModal() {
  _helpOpener = document.activeElement;
  document.getElementById('help-modal').classList.add('visible');
  _renderHelpDocList();
  const saved = localStorage.getItem('yuu-help-doc');
  const initial = HELP_DOCS.find((d) => d.key === saved)?.key || HELP_DOCS[0].key;
  _openHelpDoc(initial);
  setTimeout(() => document.querySelector('#help-doc-list [data-help-doc]')?.focus(), 50);
}
export function closeHelpModal() {
  document.getElementById('help-modal').classList.remove('visible');
  const opener = _helpOpener;
  _helpOpener = null;
  if (opener?.focus) opener.focus();
}

function _renderHelpDocList() {
  const nav = document.getElementById('help-doc-list');
  nav.innerHTML = '';
  for (const doc of HELP_DOCS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-doc-tab';
    btn.dataset.helpDoc = doc.key;
    const title = document.createElement('div');
    title.className = 'help-doc-tab-title';
    title.textContent = doc.title;
    const blurb = document.createElement('div');
    blurb.className = 'help-doc-tab-blurb';
    blurb.textContent = doc.blurb;
    btn.append(title, blurb);
    nav.append(btn);
  }
}

function _highlightActiveDoc(key) {
  document.querySelectorAll('#help-doc-list [data-help-doc]').forEach((btn) => {
    const active = btn.dataset.helpDoc === key;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  });
}

function _helpViewHtml(doc, bodyHtml, toc) {
  const online = `<div class="help-online"><a href="${doc.onlineUrl}" target="_blank" rel="noopener">View online &#x2197;</a></div>`;
  let tocHtml = '';
  if (toc.length) {
    const items = toc.map((entry) =>
      `<li class="help-toc-l${entry.level}"><button type="button" class="help-toc-link" data-help-toc="${entry.id}">${_escText(entry.text)}</button></li>`
    ).join('');
    tocHtml = `<nav class="help-toc" aria-label="On this page"><div class="help-toc-head">On this page</div><ul>${items}</ul></nav>`;
  }
  return online + tocHtml + `<div class="help-doc-body">${bodyHtml}</div>`;
}

async function _openHelpDoc(key) {
  const doc = HELP_DOCS.find((d) => d.key === key) || HELP_DOCS[0];
  localStorage.setItem('yuu-help-doc', doc.key);
  _highlightActiveDoc(doc.key);
  const view = document.getElementById('help-doc-view');
  view.innerHTML = '<div style="color:var(--muted)">Loading&#x2026;</div>';
  let md;
  try {
    md = await fetch(`/static/help/${doc.file}`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
  } catch (e) {
    view.innerHTML = '<div style="color:var(--red)">Could not load this guide.</div>';
    return;
  }
  const { html, toc } = renderMarkdown(md, { onlineUrl: doc.onlineUrl });
  view.innerHTML = _helpViewHtml(doc, html, toc);
  view.scrollTop = 0;
}

// ── glossary modal ────────────────────────────────────────────────────────────
let _glossaryOpener = null;
export async function openGlossaryModal() {
  _glossaryOpener = document.activeElement;
  document.getElementById('glossary-modal').classList.add('visible');
  const filter = document.getElementById('glossary-filter');
  filter.value = '';
  setTimeout(() => filter.focus(), 50);
  const el = document.getElementById('glossary-content');
  if (el.dataset.loaded) { _filterGlossary(''); return; }
  try {
    const md = await fetch('/api/glossary').then(r => r.text());
    el.innerHTML = _renderGlossaryMd(md);
    el.dataset.loaded = '1';
  } catch (e) {
    el.innerHTML = '<div style="color:var(--red)">Failed to load glossary.</div>';
  }
}

export function _filterGlossary(query) {
  const q = query.trim().toLowerCase();
  const content = document.getElementById('glossary-content');
  let anyVisible = false;
  content.querySelectorAll('.glossary-term').forEach(term => {
    const show = !q || term.textContent.toLowerCase().includes(q);
    term.style.display = show ? '' : 'none';
    if (show) anyVisible = true;
  });
  content.querySelectorAll('.glossary-section').forEach(section => {
    const terms = Array.from(section.querySelectorAll('.glossary-term'));
    const show = !q || terms.some(t => t.style.display !== 'none');
    section.style.display = show ? '' : 'none';
  });
  document.getElementById('glossary-no-matches').style.display = (q && !anyVisible) ? '' : 'none';
}
export function closeGlossaryModal() {
  document.getElementById('glossary-modal').classList.remove('visible');
  const opener = _glossaryOpener;
  _glossaryOpener = null;
  if (opener?.focus) opener.focus();
}

function _renderGlossaryMd(md) {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inTable = false;
  let tableHead = false;
  let inSection = false;
  let inTerm = false;

  const inline = s => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const closeList  = () => { if (inList)  { html += '</ul>';   inList  = false; } };
  const closeTable = () => { if (inTable) { html += '</tbody></table>'; inTable = false; tableHead = false; } };
  // Section (##) and term (###) wrapper divs are the units the glossary filter
  // shows/hides - every ### block must land inside exactly one .glossary-term.
  const closeTerm    = () => { if (inTerm)    { html += '</div>'; inTerm    = false; } };
  const closeSection = () => { closeTerm(); if (inSection) { html += '</div>'; inSection = false; } };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line.startsWith('## ')) {
      closeList(); closeTable(); closeSection();
      html += `<div class="glossary-section"><h2 style="margin:20px 0 4px;font-size:15px;border-bottom:1px solid var(--border);padding-bottom:4px">${inline(line.slice(3))}</h2>`;
      inSection = true;
    } else if (line.startsWith('### ')) {
      closeList(); closeTable(); closeTerm();
      html += `<div class="glossary-term"><h3 style="margin:14px 0 2px;font-size:13px;color:var(--accent)">${inline(line.slice(4))}</h3>`;
      inTerm = true;
    } else if (line.startsWith('---')) {
      closeList(); closeTable(); closeTerm();
      html += '<hr style="border:none;border-top:1px solid var(--border);margin:14px 0">';
    } else if (/^\|/.test(line)) {
      closeList();
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (/^[-\s|:]+$/.test(line)) {
        tableHead = false;
      } else if (!inTable) {
        inTable = true; tableHead = true;
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:6px 0"><thead><tr>';
        cells.forEach(c => { html += `<th style="text-align:left;padding:4px 8px 4px 0;border-bottom:1px solid var(--border);color:var(--text)">${inline(c)}</th>`; });
        html += '</tr></thead><tbody>';
      } else {
        html += '<tr>';
        cells.forEach(c => { html += `<td style="padding:3px 8px 3px 0;border-bottom:1px solid var(--border);color:var(--muted);vertical-align:top">${inline(c)}</td>`; });
        html += '</tr>';
      }
    } else if (/^- /.test(line)) {
      closeTable();
      if (!inList) { html += '<ul style="margin:4px 0 4px 16px;padding:0">'; inList = true; }
      html += `<li style="margin:1px 0">${inline(line.slice(2))}</li>`;
    } else if (line === '') {
      closeList(); closeTable();
      html += '<div style="margin:4px 0"></div>';
    } else {
      closeList(); closeTable();
      html += `<p style="margin:3px 0">${inline(line)}</p>`;
    }
  }
  closeList(); closeTable(); closeSection();
  return html;
}

// ── static modal/hamburger wiring (replaces the inline onclick=/oninput= this
// module used to own in index.html) ────────────────────────────────────────────
// These are fixed, never-recreated elements in index.html, so wiring them once at
// module load (below) can't double-fire on a re-render the way a dynamically
// rendered list could.
const _BG_DISMISS_MODALS = [
  ['getting-started-modal', closeGettingStartedModal],
  ['help-modal', closeHelpModal],
  ['about-modal', closeAboutModal],
  ['glossary-modal', closeGlossaryModal],
];

function _wireModalBgDismissals() {
  for (const [modalId, closeFn] of _BG_DISMISS_MODALS) {
    const modal = document.getElementById(modalId);
    modal.addEventListener('click', e => { if (e.target === modal) closeFn(); });
  }
}

function _wireModalButtons() {
  document.getElementById('getting-started-close-btn').addEventListener('click', () => closeGettingStartedModal());
  document.getElementById('help-modal-close-btn').addEventListener('click', () => closeHelpModal());
  document.getElementById('about-modal-close-btn').addEventListener('click', () => closeAboutModal());
  document.getElementById('glossary-modal-close-btn').addEventListener('click', () => closeGlossaryModal());
  document.getElementById('glossary-filter').addEventListener('input', e => _filterGlossary(e.target.value));
}

// The 4 hamburger items ui.js's own migration deferred (their inline onclick=
// mixed ui.js's closeHamburger() with a helpmodals.js modal-open call) - this
// module now owns the modal-open half, so it owns retiring them too.
function _wireHamburgerHandlers() {
  document.getElementById('hamburger-item-getting-started').addEventListener('click', () => {
    window.closeHamburger();
    openGettingStartedModal();
  });
  document.getElementById('hamburger-item-glossary').addEventListener('click', () => {
    window.closeHamburger();
    openGlossaryModal();
  });
  document.getElementById('hamburger-item-help').addEventListener('click', () => {
    window.closeHamburger();
    openHelpModal();
  });
  document.getElementById('hamburger-item-about').addEventListener('click', () => {
    window.closeHamburger();
    openAboutModal();
  });
}

// Help viewer: doc-list tabs and TOC jumps both use event delegation because the
// list and every doc body are re-rendered on each open / doc switch.
function _wireHelpViewer() {
  document.getElementById('help-doc-list').addEventListener('click', e => {
    const tab = e.target.closest('[data-help-doc]');
    if (tab) _openHelpDoc(tab.dataset.helpDoc);
  });
  document.getElementById('help-doc-view').addEventListener('click', e => {
    const link = e.target.closest('[data-help-toc]');
    if (!link) return;
    document.getElementById(link.dataset.helpToc)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

_wireModalBgDismissals();
_wireModalButtons();
_wireHamburgerHandlers();
_wireHelpViewer();
