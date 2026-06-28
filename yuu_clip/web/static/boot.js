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
initResize();
_loadContexts();
loadVideos();
fetch('/api/status').then(r => r.json()).then(d => {
  if (d.version) document.getElementById('version-tag').textContent = d.version;
}).catch(() => {});

if (window.electronAPI) {
  document.getElementById('btn-setup-wizard').style.display = '';
}

fetch('/api/config').then(r => r.json()).then(cfg => {
  _updateLlmRemoteIndicator(cfg.llm_backend || 'llamacpp', cfg.ollama_enabled !== false);
}).catch(() => {});

window._prereqs = {ffmpeg_ok: true, llm_ok: true};
fetch('/api/prereqs').then(r => r.json()).then(p => {
  window._prereqs = p;
  _applyPrereqWarnings(p);
}).catch(() => {});
const _savedSort = localStorage.getItem('clips-sort');
if (_savedSort) document.getElementById('clips-sort').value = _savedSort;
document.getElementById('log-panel').classList.add('visible', 'minimized');
document.getElementById('log-toggle').textContent = '▼';
