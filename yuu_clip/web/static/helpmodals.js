(function () {
// Feature-map — the three app-global help/info modals (Getting Started, About,
// Glossary). Extracted out of settings.js (which grew into a catch-all) — these
// have no coupling to the settings save/dirty machinery.
//   API: routes/config.py (glossary) · Tests: tests/test_ui_settings.py, tests/test_ui_page.py, tests/test_ui_keyboard.py

// ── getting started modal ─────────────────────────────────────────────────────
let _gettingStartedOpener = null;
function openGettingStartedModal() {
  _gettingStartedOpener = document.activeElement;
  document.getElementById('getting-started-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#getting-started-modal .btn')?.focus(), 50);
}
function closeGettingStartedModal() {
  document.getElementById('getting-started-modal').classList.remove('visible');
  localStorage.setItem('yuu-getting-started-seen', '1');
  const opener = _gettingStartedOpener;
  _gettingStartedOpener = null;
  if (opener?.focus) opener.focus();
}

// ── about modal ───────────────────────────────────────────────────────────────
let _aboutOpener = null;
function openAboutModal() {
  _aboutOpener = document.activeElement;
  document.getElementById('about-modal').classList.add('visible');
  setTimeout(() => document.querySelector('#about-modal .btn')?.focus(), 50);
}
function closeAboutModal() {
  document.getElementById('about-modal').classList.remove('visible');
  const opener = _aboutOpener;
  _aboutOpener = null;
  if (opener?.focus) opener.focus();
}

// ── glossary modal ────────────────────────────────────────────────────────────
let _glossaryOpener = null;
async function openGlossaryModal() {
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

function _filterGlossary(query) {
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
function closeGlossaryModal() {
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
  // shows/hides — every ### block must land inside exactly one .glossary-term.
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

// Public API — symbols referenced cross-module, by an inline handler, or by a
// test. Internal helpers above stay private to this module's closure.
Object.assign(window, {
  openAboutModal, closeAboutModal,
  openGettingStartedModal, closeGettingStartedModal,
  openGlossaryModal, closeGlossaryModal, _filterGlossary,
});
})();
