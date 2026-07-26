'use strict';

// Setup-wizard renderer, bundled by esbuild into the committed electron/setup.bundle.js
// (second entry in scripts/build-esm.mjs). Was inline in setup.html; extracted so the
// wizard can import the SAME shared modules the web app uses (escHtml, the language
// <option> builder) and the generated catalog straight from the Python source of truth.
// Boundary rule: shared modules take data + callbacks, never fetch/IPC - the wizard
// feeds them IPC-backed state (window.setupAPI), Settings feeds HTTP-backed state.
import catalog from './shared/catalog-data.json';
import { escHtml } from '../yuu_clip/web/static/shared/escapehtml.js';
import { languageOptionsHtml } from '../yuu_clip/web/static/shared/whisperlang.js';

const api    = window.setupAPI;
const params = new URLSearchParams(window.location.search);
const mode   = params.get('mode') || 'initial';   // 'initial' | 'rerun' | 'update'
const rerunMode = mode === 'rerun';

// Shared catalog facts generated from the Python sources of truth by
// `yuu-dev shared-data` (exposed via setup-preload.js). Whisper languages + models,
// content presets, AI-privacy copy, and the recommended model are single-sourced here
// rather than hand-maintained in this file.
const CATALOG = catalog;
const WHISPER_LANGUAGES = CATALOG.whisper_languages || [];

let status  = null;
let installing = { 'cuda-libs': false };
let downloadingGguf = false;
let defaultsApplied = false;

// ── helpers ────────────────────────────────────────────────────────────────

const esc = escHtml;

function anyInstalling() { return installing['cuda-libs']; }

function updateLaunchBtn() {
  const btn  = document.getElementById('launch-btn');
  const hint = document.getElementById('launch-hint');
  const blockedByFfmpeg  = !status || !status.ffmpegOk;
  const blockedByWork    = anyInstalling() || downloadingGguf;
  const blockedByNoDir   = !document.getElementById('project-dir').value.trim();
  btn.disabled = blockedByFfmpeg || blockedByWork || blockedByNoDir;
  btn.textContent = rerunMode ? 'Apply & Close' : 'Launch';
  hint.textContent = blockedByFfmpeg && status ? 'FFmpeg is required before you can launch'
    : anyInstalling() ? 'You can keep adjusting settings while it installs - Launch unlocks when it finishes'
    : downloadingGguf ? 'You can keep adjusting settings while it downloads - Launch unlocks when it finishes'
    : blockedByNoDir ? 'Choose a project folder before you can launch'
    : '';
  const recheck = document.getElementById('recheck-btn');
  const restart = document.getElementById('restart-btn');
  if (recheck) recheck.disabled = blockedByWork;
  if (restart) restart.disabled = blockedByWork;
}

function row(id, cls, icon, title, descHtml, actionHtml = '') {
  return `<div class="item ${cls}" id="item-${esc(id)}">
    <div class="icon">${icon}</div>
    <div class="body">
      <div class="title">${esc(title)}</div>
      <div class="desc">${descHtml}</div>
      ${actionHtml ? `<div class="action">${actionHtml}</div>` : ''}
    </div>
  </div>`;
}

// ── dynamic status slots (inputs live outside these, so a re-check never
//    wipes anything the user typed) ─────────────────────────────────────────

function renderFfmpegSlot(s) {
  const el = document.getElementById('ffmpeg-slot');
  if (s.ffmpegBundled) {
    if (s.ffmpegOk) {
      el.innerHTML = row('ffmpeg', 'ok', '✓', 'FFmpeg', 'Included with YuuClip. Used to read and cut video files.');
      return;
    }
    el.innerHTML = row('ffmpeg', 'err', '✗', 'FFmpeg install is damaged',
      'The FFmpeg bundled with YuuClip is missing or damaged. Try reinstalling YuuClip; ' +
      'if the problem persists, please report it.');
    return;
  }
  if (s.ffmpegOk) {
    el.innerHTML = row('ffmpeg', 'ok', '✓', 'FFmpeg', 'Found on PATH. Used to read and cut video files.');
    return;
  }
  el.innerHTML = row('ffmpeg', 'err', '✗', 'FFmpeg not found',
    'YuuClip needs FFmpeg to read and cut video files.<br>' +
    '<strong>Easiest:</strong> run this command in a terminal (Start → type <em>terminal</em>), ' +
    'then click <em>Check again</em> below - no need to close this window.' +
    '<details><summary>Can\'t use winget? Manual install steps</summary>' +
    'Open gyan.dev (button below), download <em>ffmpeg-release-essentials.zip</em> (or a <em>CUDA</em> build for NVIDIA GPUs). ' +
    'Extract the zip to a permanent folder (e.g. <code>C:\\ffmpeg</code>), then add its <code>bin\\</code> subfolder to PATH:<br>' +
    '1. Open Start → search <em>Edit the system environment variables</em> → click it<br>' +
    '2. Click <em>Environment Variables</em><br>' +
    '3. Under <em>System variables</em>, select <em>Path</em> → click <em>Edit</em><br>' +
    '4. Click <em>New</em> → paste the full path to the <code>bin\\</code> folder (e.g. <code>C:\\ffmpeg\\bin</code>)<br>' +
    '5. Click OK on all dialogs, then click <em>Check again</em> below.' +
    '</details>',
    `<div style="display:flex;gap:6px;align-items:center;width:100%">` +
      `<code style="flex:1">winget install Gyan.FFmpeg</code>` +
      `<button class="sm" data-copy="winget install Gyan.FFmpeg">Copy</button>` +
      `<button class="sm" data-open-url="https://www.gyan.dev/ffmpeg/builds/">Open gyan.dev</button>` +
    `</div>`
  );
}

function renderGpuLine(s) {
  const el = document.getElementById('gpu-line');
  if (s.gpu.name === 'Unknown') {
    el.textContent = 'No discrete GPU detected - analysis runs on the CPU (slower, but works).';
    return;
  }
  // LLM scoring runs on any vendor's GPU (via the bundled Vulkan engine); only
  // Whisper transcription is NVIDIA/CUDA-only, so the two are reported separately.
  const gpu = `Detected GPU: ${s.gpu.name} (${s.gpu.vramMB.toLocaleString()} MB VRAM)`;
  if (s.gpu.vendor === 'nvidia') {
    const hasVersion = s.cuda.version && s.cuda.version !== 'unknown';
    const cudaLabel = hasVersion ? `CUDA ${s.cuda.version}` : 'CUDA detected';
    el.textContent = s.cuda.available
      ? `${gpu} - ${cudaLabel}. Your GPU speeds up both transcription and LLM scoring.`
      : `${gpu} - your GPU speeds up LLM scoring. Add CUDA (below) to also speed up transcription.`;
  } else {
    el.textContent = `${gpu} - your GPU speeds up LLM scoring. Transcription runs on the CPU (GPU transcription needs an NVIDIA card).`;
  }
}

function renderCudaSlot(s) {
  const el = document.getElementById('cuda-slot');
  // Show the "Optional" section header only when it has a visible row; an empty
  // titled section (e.g. on a non-NVIDIA machine, where CUDA is the only optional
  // item) reads as a load error.
  const setSlot = (html) => {
    el.innerHTML = html;
    const section = document.getElementById('optional-section');
    if (section) section.style.display = html ? '' : 'none';
  };
  if (s.gpu.vendor !== 'nvidia') { setSlot(''); return; }
  if (s.cudaLibsInstalled || s.cuda.available) {
    setSlot(row('cuda', 'ok', '✓', 'Faster transcription ready',
      'The CUDA support libraries are available - transcription runs on your NVIDIA GPU.'));
    return;
  }
  setSlot(row('cuda', 'warn', '○', 'Faster transcription (optional)',
    `Your NVIDIA GPU can transcribe much faster than the CPU. This one-time install ` +
    `adds the CUDA support libraries (cuBLAS + cuDNN, ~1 GB). You can keep adjusting ` +
    `settings while it installs - Launch unlocks when it finishes. (LLM scoring already ` +
    `uses your GPU - this only speeds up transcription.)`,
    `<button class="sm" id="install-btn-cuda-libs" data-install="cuda-libs">Speed up transcription (~1 GB)</button>
     <button class="sm" id="install-cancel-cuda-libs" data-action="install-cancel" style="display:none">Cancel</button>
     <div class="pull-msg" id="install-msg-cuda-libs"></div>`));
}

function renderGgufDownloadSlot(s) {
  const el = document.getElementById('gguf-download-slot');
  if (!el) return;
  if (downloadingGguf) return; // preserve the in-progress bar across a status re-render
  const currentPath = (document.getElementById('llm-model-path').value || '').trim();
  if (currentPath) { el.innerHTML = ''; return; }
  const rec = CATALOG.recommended_model || {};
  const recName = rec.display_name || 'the recommended model';
  const recSize = rec.size_gb != null ? `~${rec.size_gb} GB` : '';
  el.innerHTML = row('gguf-download', 'warn', '○', 'Download the recommended model',
    `${esc(recName)} (${esc(rec.licence || '')}, so clips you make can be monetized)` +
    `${recSize ? ', ' + recSize : ''}. You can keep using this window while it downloads.`,
    `<button class="sm" id="gguf-download-btn" data-action="gguf-download">Download recommended model${recSize ? ' (' + esc(recSize) + ')' : ''}</button>
     <button class="sm" id="gguf-cancel-btn" data-action="gguf-cancel" style="display:none">Cancel</button>
     <div class="pull-bar" id="gguf-download-bar" style="display:none;width:100%;margin-top:5px"><div class="pull-fill" id="gguf-download-fill"></div></div>
     <div class="pull-msg" id="gguf-download-msg"></div>`);
}

function renderSlots(s) {
  status = s;
  renderFfmpegSlot(s);
  renderGpuLine(s);
  renderCudaSlot(s);
  renderGgufDownloadSlot(s);
  document.getElementById('subtitle').textContent =
    mode === 'update' ? 'This update added new setup options - review, then launch.'
    : s.ffmpegOk ? 'System check complete.'
    : 'Action required before you can launch.';
  updateLaunchBtn();
}

// Build the whisper / AI-privacy / content-preset <option> lists from the shared
// catalog so their copy is single-sourced (see `yuu-dev shared-data`). Runs once,
// before applyDefaults sets the saved values.
function populateCatalogSelects() {
  const fill = (id, items, value, label) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = items
      .map(it => `<option value="${esc(value(it))}">${esc(label(it))}</option>`)
      .join('');
  };
  fill('whisper-sel', CATALOG.whisper_models || [], m => m.id, m => m.option_text);
  fill('ai-privacy-sel', CATALOG.ai_privacy_options || [], o => o.value, o => o.label);
  fill('content-preset-sel', CATALOG.content_presets || [], p => p.id, p => p.name);

  const rec = CATALOG.recommended_model || {};
  const sizeText = rec.size_gb != null ? `${rec.size_gb} GB` : '';
  const setText = (id, text) => { const el = document.getElementById(id); if (el && text) el.textContent = text; };
  setText('rec-model-size-inline', sizeText);
  setText('rec-model-size-adv', sizeText);
}

// First render only: fill the form from saved config / detected defaults.
function applyDefaults(s) {
  if (defaultsApplied) return;
  defaultsApplied = true;

  populateCatalogSelects();

  document.getElementById('project-dir').value = s.projectDir;
  const whisperSel = document.getElementById('whisper-sel');
  whisperSel.value = s.whisperModel || s.recommendedWhisper.model;
  if (!whisperSel.value) whisperSel.value = s.recommendedWhisper.model;
  document.getElementById('rec-tag').textContent = '← recommended';
  document.getElementById('rec-tag').title = s.recommendedWhisper.reason;

  const langSel = document.getElementById('whisper-lang-sel');
  langSel.innerHTML = languageOptionsHtml(WHISPER_LANGUAGES);
  langSel.value = WHISPER_LANGUAGES.includes(s.whisperLanguage) ? s.whisperLanguage : '';

  document.getElementById('ai-privacy-sel').value = s.aiPrivacyMode || 'local_only';
  document.getElementById('llm-model-path').value  = s.llmModelPath || '';
  document.getElementById('content-preset-sel').value = s.contentPreset || 'generic';
  document.getElementById('content-preset-note').textContent =
    'Not sure? Generic is a good default. You can fine-tune every scoring weight later in Settings.';

  const rec = s.localModelRecommendation || {};
  document.getElementById('llm-rec-headline').textContent = rec.headline || '';
  document.getElementById('llm-rec-reason').textContent   = rec.reason || '';
  // Pre-select local AI as the recommended path unless the machine can't fit the
  // model (push 'none'); an existing model file also keeps local selected (the
  // build step won't re-queue a download when a path is already set).
  const hasExistingModel = Boolean((s.llmModelPath || '').trim());
  const preferLocal = hasExistingModel || rec.push === 'strong' || rec.push === 'soft';
  document.getElementById('local-ai-yes').checked = preferLocal;
  document.getElementById('local-ai-no').checked  = !preferLocal;
  onLocalAiChoiceChange();

  onPrivacyModeChange(document.getElementById('ai-privacy-sel').value);

  document.getElementById('item-init').style.display = 'none';
  document.getElementById('sections').style.display  = '';
  document.getElementById('recheck-bar').style.display = '';
  if (rerunMode) document.getElementById('rerun-note').style.display = '';
  document.getElementById('quit-btn').textContent =
    rerunMode ? 'Close' : mode === 'update' ? 'Skip for now' : 'Quit';
}

// ── AI privacy + local model ────────────────────────────────────────────────

// yuu-clip is local-only; the mode toggles whether a generative model runs at all.
// Copy comes from the shared catalog (single source for the wizard + web Settings).
const AI_PRIVACY_NOTES = CATALOG.ai_privacy_notes || {};

function onPrivacyModeChange(mode) {
  document.getElementById('ai-privacy-note').textContent = AI_PRIVACY_NOTES[mode] || '';
  const llmBlock = document.getElementById('llm-generative-block');
  if (llmBlock) llmBlock.style.display = mode === 'none' ? 'none' : '';
  updateLlmWarn();
}

function updateLlmWarn() {
  const filePath = (document.getElementById('llm-model-path').value || '').trim();
  const wantsLocal = document.getElementById('local-ai-yes').checked;
  // With "Set up local AI" chosen, the recommended model is queued for a background
  // download on launch - so "LLM scoring will be skipped" would be wrong. Only warn
  // when there's no file, nothing downloading, and no background download coming.
  document.getElementById('llm-warn').style.display =
    (!filePath && !downloadingGguf && !wantsLocal) ? 'block' : 'none';
  if (status) renderGgufDownloadSlot(status);
}

function onLocalAiChoiceChange() {
  const lightweight = document.getElementById('local-ai-no').checked;
  document.getElementById('lightweight-note').style.display = lightweight ? '' : 'none';
  // The choice governs whether the LLM model is queued for a background download,
  // which decides whether the "will be skipped" warning is accurate - keep it in sync.
  updateLlmWarn();
}

// ── GGUF model one-click download ───────────────────────────────────────────

function startGgufDownload() {
  const btn = document.getElementById('gguf-download-btn');
  const cancel = document.getElementById('gguf-cancel-btn');
  const bar = document.getElementById('gguf-download-bar');
  if (btn) btn.disabled = true;
  if (cancel) { cancel.style.display = ''; cancel.disabled = false; }
  if (bar) bar.style.display = '';
  downloadingGguf = true;
  updateLaunchBtn();
  updateLlmWarn(); // hide the "no model file chosen" warning while the download runs
  api.downloadGgufModel();
}

function cancelGgufDownload() {
  const cancel = document.getElementById('gguf-cancel-btn');
  if (cancel) cancel.disabled = true;
  api.cancelGgufDownload();
}

function onGgufDownloadProgress(data) {
  const fill   = document.getElementById('gguf-download-fill');
  const msg    = document.getElementById('gguf-download-msg');
  const btn    = document.getElementById('gguf-download-btn');
  const cancel = document.getElementById('gguf-cancel-btn');
  const done = () => { downloadingGguf = false; if (cancel) cancel.style.display = 'none'; updateLaunchBtn(); updateLlmWarn(); };
  if (data.done) {
    document.getElementById('llm-model-path').value = data.path;
    updateLlmWarn(); // also re-renders the download slot, now hidden since the path is set
    done();
  } else if (data.cancelled) {
    if (msg) msg.textContent = 'Download cancelled.';
    if (fill) fill.style.width = '0%';
    if (btn) btn.disabled = false;
    done();
  } else if (data.error) {
    if (msg) msg.textContent = `Download failed: ${data.error}`;
    if (fill) fill.style.width = '0%';  // don't leave a half-full bar on a failure
    if (btn) btn.disabled = false;
    done();
  } else if (typeof data.progress === 'number') {
    if (fill) fill.style.width = data.progress + '%';
    // Show absolute GB alongside the percent when we know the model size.
    const sizeGb = (CATALOG.recommended_model || {}).size_gb;
    const doneGb = sizeGb != null ? ` (${(data.progress / 100 * sizeGb).toFixed(1)} of ${sizeGb} GB)` : '';
    if (msg)  msg.textContent  = `Downloading… ${data.progress}%${doneGb}`;
  }
}

// ── optional package installs (pip into the venv) ──────────────────────────

function startInstall(slug) {
  const btn = document.getElementById(`install-btn-${slug}`);
  const cancel = document.getElementById(`install-cancel-${slug}`);
  const msg = document.getElementById(`install-msg-${slug}`);
  if (btn) btn.disabled = true;
  if (cancel) { cancel.style.display = ''; cancel.disabled = false; }
  if (msg) msg.textContent = 'Starting…';
  installing[slug] = true;
  updateLaunchBtn();
  api.installPackage(slug);
}

function cancelInstall(slug) {
  const cancel = document.getElementById(`install-cancel-${slug}`);
  if (cancel) cancel.disabled = true;
  api.cancelInstall();
}

function onInstallProgress(data) {
  const btn = document.getElementById(`install-btn-${data.slug}`);
  const cancel = document.getElementById(`install-cancel-${data.slug}`);
  const msg = document.getElementById(`install-msg-${data.slug}`);
  if (cancel && (data.done || data.error || data.cancelled)) cancel.style.display = 'none';
  if (data.done) {
    installing[data.slug] = false;
    if (data.slug === 'cuda-libs') { status.cudaLibsInstalled = true; renderCudaSlot(status); }
    updateLaunchBtn();
  } else if (data.cancelled) {
    installing[data.slug] = false;
    if (msg) msg.textContent = 'Install cancelled.';
    if (btn) btn.disabled = false;
    updateLaunchBtn();
  } else if (data.error) {
    installing[data.slug] = false;
    // GPU acceleration is never required - reassure the user they can still launch.
    const cpuNote = data.slug === 'cuda-libs'
      ? ' You can still launch - transcription will run on the CPU.'
      : '';
    if (msg) msg.textContent = `Install failed: ${data.error}${cpuNote}`;
    if (btn) btn.disabled = false;
    updateLaunchBtn();
  } else if (data.status) {
    if (msg) msg.textContent = data.status;
  }
}

// ── re-check / restart ─────────────────────────────────────────────────────

async function recheck() {
  const btn = document.getElementById('recheck-btn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Checking…';
  try {
    renderSlots(await api.getStatus());
  } finally {
    btn.textContent = original;
    btn.disabled = false;
    updateLaunchBtn();
  }
}

// ── UI events ──────────────────────────────────────────────────────────────

// Event delegation for every button injected via innerHTML (slots re-render on each
// status refresh). Inline on-event handlers can't be used here: this file is bundled
// into an IIFE, so module-scoped functions like startGgufDownload are neither global
// (inline handlers resolve on window) nor even present (esbuild tree-shakes functions
// referenced only from string literals). The static guard in
// test/setup-renderer-handlers.test.js keeps inline handlers from creeping back.
document.addEventListener('click', e => {
  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) {
    api.copyText(copyBtn.dataset.copy);
    const original = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = original; }, 1200);
    return;
  }
  const urlBtn = e.target.closest('[data-open-url]');
  if (urlBtn) { api.openURL(urlBtn.dataset.openUrl); return; }
  const installBtn = e.target.closest('[data-install]');
  if (installBtn) { startInstall(installBtn.dataset.install); return; }
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    if (actionBtn.dataset.action === 'gguf-download') startGgufDownload();
    else if (actionBtn.dataset.action === 'gguf-cancel') cancelGgufDownload();
    else if (actionBtn.dataset.action === 'install-cancel') cancelInstall('cuda-libs');
  }
});

document.getElementById('browse-btn').addEventListener('click', async () => {
  const dir = await api.pickFolder();
  if (dir) document.getElementById('project-dir').value = dir;
  updateLaunchBtn();
});

// Restore-from-backup is a first-run choice only: rerun/update already have a
// live project, and restoring over it belongs in the in-app Settings flow.
if (mode === 'initial') {
  document.getElementById('restore-row').style.display = '';
  document.getElementById('restore-note').style.display = '';
}

document.getElementById('restore-backup-btn').addEventListener('click', async () => {
  const archive = await api.pickFile({
    title:   'Choose a YuuClip backup',
    filters: [{ name: 'YuuClip backup', extensions: ['zip'] }],
  });
  if (!archive) return;
  const target = document.getElementById('project-dir').value;
  const btn = document.getElementById('restore-backup-btn');
  btn.disabled = true;
  btn.textContent = 'Restoring…';
  let result;
  try {
    result = await api.restoreBackup({ archive, project: target });
  } catch (e) {
    result = { ok: false, error: String(e && e.message || e) };
  }
  if (result.ok) {
    // Launch straight into the restored project; complete() skips the wizard
    // config write so the backup's own settings survive (main.js: cfg.restored).
    btn.textContent = 'Restored - starting…';
    api.complete({ projectDir: target, restored: true });
    return;
  }
  // On failure (not a cancelled replace) main.js has already shown an error
  // dialog; just reset the button so the user can try another file.
  btn.disabled = false;
  btn.textContent = 'Restore from a backup instead…';
});

document.getElementById('llm-browse-btn').addEventListener('click', async () => {
  const file = await api.pickFile({
    title:   'Choose LLM model file',
    filters: [{ name: 'GGUF models', extensions: ['gguf'] }],
  });
  if (file) {
    document.getElementById('llm-model-path').value = file;
    updateLlmWarn();
  }
});

document.getElementById('ai-privacy-sel').addEventListener('change', e => onPrivacyModeChange(e.target.value));
document.getElementById('local-ai-yes').addEventListener('change', onLocalAiChoiceChange);
document.getElementById('local-ai-no').addEventListener('change', onLocalAiChoiceChange);
document.getElementById('llm-model-path').addEventListener('input', updateLlmWarn);

document.getElementById('recheck-btn').addEventListener('click', recheck);
document.getElementById('restart-btn').addEventListener('click', () => {
  const btn = document.getElementById('restart-btn');
  btn.disabled = true;
  btn.textContent = 'Restarting…';
  api.restartApp();
});

function collectConfig() {
  const choiceEl = document.querySelector('input[name="local-ai-choice"]:checked');
  const rec = (status && status.localModelRecommendation) || {};
  return {
    projectDir:      document.getElementById('project-dir').value,
    whisperModel:    document.getElementById('whisper-sel').value,
    whisperLanguage: document.getElementById('whisper-lang-sel').value,
    modelPrefetch:   document.getElementById('model-prefetch-chk').checked,
    aiPrivacyMode:   document.getElementById('ai-privacy-sel').value,
    llmModelPath:    (document.getElementById('llm-model-path').value || '').trim(),
    localModelChoice: choiceEl ? choiceEl.value : 'local',
    recommendedModelId: rec.modelId || '',
    contentPreset:   document.getElementById('content-preset-sel').value,
  };
}

document.getElementById('quit-btn').addEventListener('click', () => {
  // Quitting mid-install/download silently loses its progress (.part swept on the
  // next start), so confirm first when work is in flight.
  if ((anyInstalling() || downloadingGguf) &&
      !window.confirm('A download is still running - quit anyway? You will lose its progress.')) {
    return;
  }
  if (rerunMode) api.close();          // discard changes, keep app running
  else if (mode === 'update') api.skip(); // launch with existing config
  else api.quit();
});

document.getElementById('launch-btn').addEventListener('click', () => {
  const btn = document.getElementById('launch-btn');
  btn.disabled = true;
  btn.textContent = rerunMode ? 'Saving…' : 'Starting…';
  api.complete(collectConfig());
});

// ── boot ──────────────────────────────────────────────────────────────────

api.onInstallProgress(onInstallProgress);
api.onGgufDownloadProgress(onGgufDownloadProgress);

function applyOsTheme(s) {
  // The app itself always defaults to dark regardless of OS light/dark preference
  // (index.src.html's inline pre-paint script only ever deviates from dark when
  // the user explicitly picked a theme in Settings) - the wizard matches that so
  // first run doesn't flip from a light wizard into a dark app the moment it
  // finishes. OS high-contrast is still honored since that is an accessibility
  // need, not a color preference.
  if (s.osThemeIsHighContrast) document.documentElement.dataset.theme = 'high-contrast';
}

(async () => {
  try {
    const s = await api.getStatus();
    applyOsTheme(s);
    applyDefaults(s);
    renderSlots(s);
  } catch (e) {
    document.getElementById('item-init').outerHTML =
      `<div class="item err">
         <div class="icon">✗</div>
         <div class="body">
           <div class="title">Setup check failed</div>
           <div class="desc">Something went wrong while checking your setup. Try <em>Restart app</em> below, or quit and relaunch.
             <details style="margin-top:6px"><summary style="cursor:pointer">Technical details</summary>${esc(String(e))}</details></div>
         </div>
       </div>`;
    document.getElementById('recheck-bar').style.display = '';
    document.getElementById('subtitle').textContent = 'Something went wrong.';
  }
})();
