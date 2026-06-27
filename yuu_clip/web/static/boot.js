// ── accessibility init ────────────────────────────────────────────────────────
document.querySelectorAll('.modal-bg').forEach((bg, i) => {
  const inner = bg.querySelector('.modal, [class*="modal"]');
  if (!inner) return;
  inner.setAttribute('role', 'dialog');
  inner.setAttribute('aria-modal', 'true');
  const heading = inner.querySelector('h3');
  if (heading) {
    const labelId = `modal-title-${i}`;
    heading.id = heading.id || labelId;
    inner.setAttribute('aria-labelledby', heading.id || labelId);
  }
});

// ── boot ──────────────────────────────────────────────────────────────────────
_loadContexts();
loadVideos();
fetch('/api/status').then(r => r.json()).then(d => {
  if (d.version) document.getElementById('version-tag').textContent = d.version;
}).catch(() => {});
const _savedSort = localStorage.getItem('clips-sort');
if (_savedSort) document.getElementById('clips-sort').value = _savedSort;
document.getElementById('log-panel').classList.add('visible', 'minimized');
document.getElementById('log-toggle').textContent = '▼';
