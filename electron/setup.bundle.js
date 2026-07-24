"use strict";
(() => {
  // electron/shared/catalog-data.json
  var catalog_data_default = {
    _generated_by: "yuu-dev shared-data",
    recommended_model: {
      id: "qwen2.5-7b-instruct",
      display_name: "Qwen2.5 7B Instruct",
      filename: "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
      gguf_url: "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF",
      resolve_url: "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
      size_gb: 4.7,
      licence: "Apache-2.0",
      why: "Strong all-round 7B - the best local default for clip scoring."
    },
    whisper_models: [
      {
        id: "tiny",
        blurb: "fastest, lowest quality",
        download: "~75 MB",
        vram: null,
        option_text: "tiny - fastest, lowest quality (~75 MB download)"
      },
      {
        id: "base",
        blurb: "fast, lower quality",
        download: "~140 MB",
        vram: null,
        option_text: "base - fast, lower quality (~140 MB download)"
      },
      {
        id: "small",
        blurb: "fast, decent quality",
        download: "~465 MB",
        vram: "~1 GB",
        option_text: "small - fast, decent quality (~465 MB download, needs a ~1 GB graphics card)"
      },
      {
        id: "medium",
        blurb: "good balance",
        download: "~1.5 GB",
        vram: "~2.8 GB",
        option_text: "medium - good balance (~1.5 GB download, needs a ~2.8 GB graphics card)"
      },
      {
        id: "large-v3",
        blurb: "best quality",
        download: "~2.9 GB",
        vram: "~4.2 GB",
        option_text: "large-v3 - best quality (~2.9 GB download, needs a ~4.2 GB graphics card)"
      }
    ],
    whisper_languages: [
      "af",
      "am",
      "ar",
      "as",
      "az",
      "ba",
      "be",
      "bg",
      "bn",
      "bo",
      "br",
      "bs",
      "ca",
      "cs",
      "cy",
      "da",
      "de",
      "el",
      "en",
      "es",
      "et",
      "eu",
      "fa",
      "fi",
      "fo",
      "fr",
      "gl",
      "gu",
      "ha",
      "haw",
      "he",
      "hi",
      "hr",
      "ht",
      "hu",
      "hy",
      "id",
      "is",
      "it",
      "ja",
      "jw",
      "ka",
      "kk",
      "km",
      "kn",
      "ko",
      "la",
      "lb",
      "ln",
      "lo",
      "lt",
      "lv",
      "mg",
      "mi",
      "mk",
      "ml",
      "mn",
      "mr",
      "ms",
      "mt",
      "my",
      "ne",
      "nl",
      "nn",
      "no",
      "oc",
      "pa",
      "pl",
      "ps",
      "pt",
      "ro",
      "ru",
      "sa",
      "sd",
      "si",
      "sk",
      "sl",
      "sn",
      "so",
      "sq",
      "sr",
      "su",
      "sv",
      "sw",
      "ta",
      "te",
      "tg",
      "th",
      "tk",
      "tl",
      "tr",
      "tt",
      "uk",
      "ur",
      "uz",
      "vi",
      "yi",
      "yo",
      "zh"
    ],
    content_presets: [
      {
        id: "generic",
        name: "Generic",
        description: "Balanced default - no content-specific tuning."
      },
      {
        id: "rp-narrative",
        name: "RP / narrative",
        description: "Roleplay or story-driven sessions - character and drama first."
      },
      {
        id: "competitive",
        name: "Competitive gaming",
        description: "Ranked or competitive play - clutches, comebacks, and callouts."
      },
      {
        id: "casual",
        name: "Casual / let's play",
        description: "Relaxed let's-plays - personality, reactions, and funny failures."
      },
      {
        id: "speedrun",
        name: "Speedrun",
        description: "Runs against the clock - splits, PBs, and heartbreak resets."
      },
      {
        id: "podcast",
        name: "Podcast / conversation",
        description: "Talk-driven sessions - quotes, hot takes, and shared laughter."
      }
    ],
    ai_privacy_options: [
      {
        value: "none",
        label: "No generative AI - no language model runs"
      },
      {
        value: "local_only",
        label: "Local models only - nothing leaves your machine (recommended)"
      }
    ],
    ai_privacy_notes: {
      none: "No language model runs. Clips are still found and searchable; scoring uses lightweight signals only.",
      local_only: "On-device models only. Everything runs locally - nothing you record is sent anywhere."
    }
  };

  // yuu_clip/web/static/shared/escapehtml.js
  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // yuu_clip/web/static/shared/whisperlang.js
  function languageOptionsHtml(codes) {
    let nameOf = (code) => code;
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
      nameOf = (code) => {
        try {
          return displayNames.of(code) || code;
        } catch {
          return code;
        }
      };
    } catch {
    }
    const named = (codes || []).map((code) => ({ code, name: nameOf(code) })).sort((a, b) => a.name.localeCompare(b.name));
    return '<option value="">Auto-detect (recommended)</option>' + named.map((o) => `<option value="${escHtml(o.code)}">${escHtml(o.name)}</option>`).join("");
  }

  // electron/setup-renderer.js
  var api = window.setupAPI;
  var params = new URLSearchParams(window.location.search);
  var mode = params.get("mode") || "initial";
  var rerunMode = mode === "rerun";
  var CATALOG = catalog_data_default;
  var WHISPER_LANGUAGES = CATALOG.whisper_languages || [];
  var status = null;
  var installing = { "cuda-libs": false };
  var downloadingGguf = false;
  var defaultsApplied = false;
  var esc = escHtml;
  function anyInstalling() {
    return installing["cuda-libs"];
  }
  function updateLaunchBtn() {
    const btn = document.getElementById("launch-btn");
    const hint = document.getElementById("launch-hint");
    const blockedByFfmpeg = !status || !status.ffmpegOk;
    const blockedByWork = anyInstalling() || downloadingGguf;
    const blockedByNoDir = !document.getElementById("project-dir").value.trim();
    btn.disabled = blockedByFfmpeg || blockedByWork || blockedByNoDir;
    btn.textContent = rerunMode ? "Apply & Close" : "Launch";
    hint.textContent = blockedByFfmpeg && status ? "FFmpeg is required before you can launch" : anyInstalling() ? "You can keep adjusting settings while it installs - Launch unlocks when it finishes" : downloadingGguf ? "You can keep adjusting settings while it downloads - Launch unlocks when it finishes" : blockedByNoDir ? "Choose a project folder before you can launch" : "";
    const recheck2 = document.getElementById("recheck-btn");
    const restart = document.getElementById("restart-btn");
    if (recheck2) recheck2.disabled = blockedByWork;
    if (restart) restart.disabled = blockedByWork;
  }
  function row(id, cls, icon, title, descHtml, actionHtml = "") {
    return `<div class="item ${cls}" id="item-${esc(id)}">
    <div class="icon">${icon}</div>
    <div class="body">
      <div class="title">${esc(title)}</div>
      <div class="desc">${descHtml}</div>
      ${actionHtml ? `<div class="action">${actionHtml}</div>` : ""}
    </div>
  </div>`;
  }
  function renderFfmpegSlot(s) {
    const el = document.getElementById("ffmpeg-slot");
    if (s.ffmpegBundled) {
      if (s.ffmpegOk) {
        el.innerHTML = row("ffmpeg", "ok", "✓", "FFmpeg", "Included with YuuClip. Used to read and cut video files.");
        return;
      }
      el.innerHTML = row(
        "ffmpeg",
        "err",
        "✗",
        "FFmpeg install is damaged",
        "The FFmpeg bundled with YuuClip is missing or damaged. Try reinstalling YuuClip; if the problem persists, please report it."
      );
      return;
    }
    if (s.ffmpegOk) {
      el.innerHTML = row("ffmpeg", "ok", "✓", "FFmpeg", "Found on PATH. Used to read and cut video files.");
      return;
    }
    el.innerHTML = row(
      "ffmpeg",
      "err",
      "✗",
      "FFmpeg not found",
      "YuuClip needs FFmpeg to read and cut video files.<br><strong>Easiest:</strong> run this command in a terminal (Start → type <em>terminal</em>), then click <em>Check again</em> below - no need to close this window.<details><summary>Can't use winget? Manual install steps</summary>Open gyan.dev (button below), download <em>ffmpeg-release-essentials.zip</em> (or a <em>CUDA</em> build for NVIDIA GPUs). Extract the zip to a permanent folder (e.g. <code>C:\\ffmpeg</code>), then add its <code>bin\\</code> subfolder to PATH:<br>1. Open Start → search <em>Edit the system environment variables</em> → click it<br>2. Click <em>Environment Variables</em><br>3. Under <em>System variables</em>, select <em>Path</em> → click <em>Edit</em><br>4. Click <em>New</em> → paste the full path to the <code>bin\\</code> folder (e.g. <code>C:\\ffmpeg\\bin</code>)<br>5. Click OK on all dialogs, then click <em>Check again</em> below.</details>",
      `<div style="display:flex;gap:6px;align-items:center;width:100%"><code style="flex:1">winget install Gyan.FFmpeg</code><button class="sm" data-copy="winget install Gyan.FFmpeg">Copy</button><button class="sm" data-open-url="https://www.gyan.dev/ffmpeg/builds/">Open gyan.dev</button></div>`
    );
  }
  function renderGpuLine(s) {
    const el = document.getElementById("gpu-line");
    if (s.gpu.name === "Unknown") {
      el.textContent = "No discrete GPU detected - analysis runs on the CPU (slower, but works).";
      return;
    }
    const gpu = `Detected GPU: ${s.gpu.name} (${s.gpu.vramMB.toLocaleString()} MB VRAM)`;
    if (s.gpu.vendor === "nvidia") {
      const hasVersion = s.cuda.version && s.cuda.version !== "unknown";
      const cudaLabel = hasVersion ? `CUDA ${s.cuda.version}` : "CUDA detected";
      el.textContent = s.cuda.available ? `${gpu} - ${cudaLabel}. Your GPU speeds up both transcription and LLM scoring.` : `${gpu} - your GPU speeds up LLM scoring. Add CUDA (below) to also speed up transcription.`;
    } else {
      el.textContent = `${gpu} - your GPU speeds up LLM scoring. Transcription runs on the CPU (GPU transcription needs an NVIDIA card).`;
    }
  }
  function renderCudaSlot(s) {
    const el = document.getElementById("cuda-slot");
    const setSlot = (html) => {
      el.innerHTML = html;
      const section = document.getElementById("optional-section");
      if (section) section.style.display = html ? "" : "none";
    };
    if (s.gpu.vendor !== "nvidia") {
      setSlot("");
      return;
    }
    if (s.cudaLibsInstalled || s.cuda.available) {
      setSlot(row(
        "cuda",
        "ok",
        "✓",
        "Faster transcription ready",
        "The CUDA support libraries are available - transcription runs on your NVIDIA GPU."
      ));
      return;
    }
    setSlot(row(
      "cuda",
      "warn",
      "○",
      "Faster transcription (optional)",
      `Your NVIDIA GPU can transcribe much faster than the CPU. This one-time install adds the CUDA support libraries (cuBLAS + cuDNN, ~1 GB). You can keep adjusting settings while it installs - Launch unlocks when it finishes. (LLM scoring already uses your GPU - this only speeds up transcription.)`,
      `<button class="sm" id="install-btn-cuda-libs" data-install="cuda-libs">Speed up transcription (~1 GB)</button>
     <button class="sm" id="install-cancel-cuda-libs" data-action="install-cancel" style="display:none">Cancel</button>
     <div class="pull-msg" id="install-msg-cuda-libs"></div>`
    ));
  }
  function renderGgufDownloadSlot(s) {
    const el = document.getElementById("gguf-download-slot");
    if (!el) return;
    if (downloadingGguf) return;
    const currentPath = (document.getElementById("llm-model-path").value || "").trim();
    if (currentPath) {
      el.innerHTML = "";
      return;
    }
    const rec = CATALOG.recommended_model || {};
    const recName = rec.display_name || "the recommended model";
    const recSize = rec.size_gb != null ? `~${rec.size_gb} GB` : "";
    el.innerHTML = row(
      "gguf-download",
      "warn",
      "○",
      "Download the recommended model",
      `${esc(recName)} (${esc(rec.licence || "")}, so clips you make can be monetized)${recSize ? ", " + recSize : ""}. You can keep using this window while it downloads.`,
      `<button class="sm" id="gguf-download-btn" data-action="gguf-download">Download recommended model${recSize ? " (" + esc(recSize) + ")" : ""}</button>
     <button class="sm" id="gguf-cancel-btn" data-action="gguf-cancel" style="display:none">Cancel</button>
     <div class="pull-bar" id="gguf-download-bar" style="display:none;width:100%;margin-top:5px"><div class="pull-fill" id="gguf-download-fill"></div></div>
     <div class="pull-msg" id="gguf-download-msg"></div>`
    );
  }
  function renderSlots(s) {
    status = s;
    renderFfmpegSlot(s);
    renderGpuLine(s);
    renderCudaSlot(s);
    renderGgufDownloadSlot(s);
    document.getElementById("subtitle").textContent = mode === "update" ? "This update added new setup options - review, then launch." : s.ffmpegOk ? "System check complete." : "Action required before you can launch.";
    updateLaunchBtn();
  }
  function populateCatalogSelects() {
    const fill = (id, items, value, label) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = items.map((it) => `<option value="${esc(value(it))}">${esc(label(it))}</option>`).join("");
    };
    fill("whisper-sel", CATALOG.whisper_models || [], (m) => m.id, (m) => m.option_text);
    fill("ai-privacy-sel", CATALOG.ai_privacy_options || [], (o) => o.value, (o) => o.label);
    fill("content-preset-sel", CATALOG.content_presets || [], (p) => p.id, (p) => p.name);
    const rec = CATALOG.recommended_model || {};
    const sizeText = rec.size_gb != null ? `${rec.size_gb} GB` : "";
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el && text) el.textContent = text;
    };
    setText("rec-model-size-inline", sizeText);
    setText("rec-model-size-adv", sizeText);
  }
  function applyDefaults(s) {
    if (defaultsApplied) return;
    defaultsApplied = true;
    populateCatalogSelects();
    document.getElementById("project-dir").value = s.projectDir;
    const whisperSel = document.getElementById("whisper-sel");
    whisperSel.value = s.whisperModel || s.recommendedWhisper.model;
    if (!whisperSel.value) whisperSel.value = s.recommendedWhisper.model;
    document.getElementById("rec-tag").textContent = "← recommended";
    document.getElementById("rec-tag").title = s.recommendedWhisper.reason;
    const langSel = document.getElementById("whisper-lang-sel");
    langSel.innerHTML = languageOptionsHtml(WHISPER_LANGUAGES);
    langSel.value = WHISPER_LANGUAGES.includes(s.whisperLanguage) ? s.whisperLanguage : "";
    document.getElementById("ai-privacy-sel").value = s.aiPrivacyMode || "local_only";
    document.getElementById("llm-model-path").value = s.llmModelPath || "";
    document.getElementById("content-preset-sel").value = s.contentPreset || "generic";
    document.getElementById("content-preset-note").textContent = "Not sure? Generic is a good default. You can fine-tune every scoring weight later in Settings.";
    const rec = s.localModelRecommendation || {};
    document.getElementById("llm-rec-headline").textContent = rec.headline || "";
    document.getElementById("llm-rec-reason").textContent = rec.reason || "";
    const hasExistingModel = Boolean((s.llmModelPath || "").trim());
    const preferLocal = hasExistingModel || rec.push === "strong" || rec.push === "soft";
    document.getElementById("local-ai-yes").checked = preferLocal;
    document.getElementById("local-ai-no").checked = !preferLocal;
    onLocalAiChoiceChange();
    onPrivacyModeChange(document.getElementById("ai-privacy-sel").value);
    document.getElementById("item-init").style.display = "none";
    document.getElementById("sections").style.display = "";
    document.getElementById("recheck-bar").style.display = "";
    if (rerunMode) document.getElementById("rerun-note").style.display = "";
    document.getElementById("quit-btn").textContent = rerunMode ? "Close" : mode === "update" ? "Skip for now" : "Quit";
  }
  var AI_PRIVACY_NOTES = CATALOG.ai_privacy_notes || {};
  function onPrivacyModeChange(mode2) {
    document.getElementById("ai-privacy-note").textContent = AI_PRIVACY_NOTES[mode2] || "";
    const llmBlock = document.getElementById("llm-generative-block");
    if (llmBlock) llmBlock.style.display = mode2 === "none" ? "none" : "";
    updateLlmWarn();
  }
  function updateLlmWarn() {
    const filePath = (document.getElementById("llm-model-path").value || "").trim();
    const wantsLocal = document.getElementById("local-ai-yes").checked;
    document.getElementById("llm-warn").style.display = !filePath && !downloadingGguf && !wantsLocal ? "block" : "none";
    if (status) renderGgufDownloadSlot(status);
  }
  function onLocalAiChoiceChange() {
    const lightweight = document.getElementById("local-ai-no").checked;
    document.getElementById("lightweight-note").style.display = lightweight ? "" : "none";
    updateLlmWarn();
  }
  function startGgufDownload() {
    const btn = document.getElementById("gguf-download-btn");
    const cancel = document.getElementById("gguf-cancel-btn");
    const bar = document.getElementById("gguf-download-bar");
    if (btn) btn.disabled = true;
    if (cancel) {
      cancel.style.display = "";
      cancel.disabled = false;
    }
    if (bar) bar.style.display = "";
    downloadingGguf = true;
    updateLaunchBtn();
    updateLlmWarn();
    api.downloadGgufModel();
  }
  function cancelGgufDownload() {
    const cancel = document.getElementById("gguf-cancel-btn");
    if (cancel) cancel.disabled = true;
    api.cancelGgufDownload();
  }
  function onGgufDownloadProgress(data) {
    const fill = document.getElementById("gguf-download-fill");
    const msg = document.getElementById("gguf-download-msg");
    const btn = document.getElementById("gguf-download-btn");
    const cancel = document.getElementById("gguf-cancel-btn");
    const done = () => {
      downloadingGguf = false;
      if (cancel) cancel.style.display = "none";
      updateLaunchBtn();
      updateLlmWarn();
    };
    if (data.done) {
      document.getElementById("llm-model-path").value = data.path;
      updateLlmWarn();
      done();
    } else if (data.cancelled) {
      if (msg) msg.textContent = "Download cancelled.";
      if (fill) fill.style.width = "0%";
      if (btn) btn.disabled = false;
      done();
    } else if (data.error) {
      if (msg) msg.textContent = `Download failed: ${data.error}`;
      if (fill) fill.style.width = "0%";
      if (btn) btn.disabled = false;
      done();
    } else if (typeof data.progress === "number") {
      if (fill) fill.style.width = data.progress + "%";
      const sizeGb = (CATALOG.recommended_model || {}).size_gb;
      const doneGb = sizeGb != null ? ` (${(data.progress / 100 * sizeGb).toFixed(1)} of ${sizeGb} GB)` : "";
      if (msg) msg.textContent = `Downloading… ${data.progress}%${doneGb}`;
    }
  }
  function startInstall(slug) {
    const btn = document.getElementById(`install-btn-${slug}`);
    const cancel = document.getElementById(`install-cancel-${slug}`);
    const msg = document.getElementById(`install-msg-${slug}`);
    if (btn) btn.disabled = true;
    if (cancel) {
      cancel.style.display = "";
      cancel.disabled = false;
    }
    if (msg) msg.textContent = "Starting…";
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
    if (cancel && (data.done || data.error || data.cancelled)) cancel.style.display = "none";
    if (data.done) {
      installing[data.slug] = false;
      if (data.slug === "cuda-libs") {
        status.cudaLibsInstalled = true;
        renderCudaSlot(status);
      }
      updateLaunchBtn();
    } else if (data.cancelled) {
      installing[data.slug] = false;
      if (msg) msg.textContent = "Install cancelled.";
      if (btn) btn.disabled = false;
      updateLaunchBtn();
    } else if (data.error) {
      installing[data.slug] = false;
      const cpuNote = data.slug === "cuda-libs" ? " You can still launch - transcription will run on the CPU." : "";
      if (msg) msg.textContent = `Install failed: ${data.error}${cpuNote}`;
      if (btn) btn.disabled = false;
      updateLaunchBtn();
    } else if (data.status) {
      if (msg) msg.textContent = data.status;
    }
  }
  async function recheck() {
    const btn = document.getElementById("recheck-btn");
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Checking…";
    try {
      renderSlots(await api.getStatus());
    } finally {
      btn.textContent = original;
      btn.disabled = false;
      updateLaunchBtn();
    }
  }
  document.addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) {
      api.copyText(copyBtn.dataset.copy);
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1200);
      return;
    }
    const urlBtn = e.target.closest("[data-open-url]");
    if (urlBtn) {
      api.openURL(urlBtn.dataset.openUrl);
      return;
    }
    const installBtn = e.target.closest("[data-install]");
    if (installBtn) {
      startInstall(installBtn.dataset.install);
      return;
    }
    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      if (actionBtn.dataset.action === "gguf-download") startGgufDownload();
      else if (actionBtn.dataset.action === "gguf-cancel") cancelGgufDownload();
      else if (actionBtn.dataset.action === "install-cancel") cancelInstall("cuda-libs");
    }
  });
  document.getElementById("browse-btn").addEventListener("click", async () => {
    const dir = await api.pickFolder();
    if (dir) document.getElementById("project-dir").value = dir;
    updateLaunchBtn();
  });
  if (mode === "initial") document.getElementById("restore-row").style.display = "";
  document.getElementById("restore-backup-btn").addEventListener("click", async () => {
    const archive = await api.pickFile({
      title: "Choose a YuuClip backup",
      filters: [{ name: "YuuClip backup", extensions: ["zip"] }]
    });
    if (!archive) return;
    const target = document.getElementById("project-dir").value;
    const btn = document.getElementById("restore-backup-btn");
    btn.disabled = true;
    btn.textContent = "Restoring…";
    let result;
    try {
      result = await api.restoreBackup({ archive, project: target });
    } catch (e) {
      result = { ok: false, error: String(e && e.message || e) };
    }
    if (result.ok) {
      btn.textContent = "Restored - starting…";
      api.complete({ projectDir: target, restored: true });
      return;
    }
    btn.disabled = false;
    btn.textContent = "Restore from a backup instead…";
  });
  document.getElementById("llm-browse-btn").addEventListener("click", async () => {
    const file = await api.pickFile({
      title: "Choose LLM model file",
      filters: [{ name: "GGUF models", extensions: ["gguf"] }]
    });
    if (file) {
      document.getElementById("llm-model-path").value = file;
      updateLlmWarn();
    }
  });
  document.getElementById("ai-privacy-sel").addEventListener("change", (e) => onPrivacyModeChange(e.target.value));
  document.getElementById("local-ai-yes").addEventListener("change", onLocalAiChoiceChange);
  document.getElementById("local-ai-no").addEventListener("change", onLocalAiChoiceChange);
  document.getElementById("llm-model-path").addEventListener("input", updateLlmWarn);
  document.getElementById("recheck-btn").addEventListener("click", recheck);
  document.getElementById("restart-btn").addEventListener("click", () => {
    const btn = document.getElementById("restart-btn");
    btn.disabled = true;
    btn.textContent = "Restarting…";
    api.restartApp();
  });
  function collectConfig() {
    const choiceEl = document.querySelector('input[name="local-ai-choice"]:checked');
    const rec = status && status.localModelRecommendation || {};
    return {
      projectDir: document.getElementById("project-dir").value,
      whisperModel: document.getElementById("whisper-sel").value,
      whisperLanguage: document.getElementById("whisper-lang-sel").value,
      modelPrefetch: document.getElementById("model-prefetch-chk").checked,
      aiPrivacyMode: document.getElementById("ai-privacy-sel").value,
      llmModelPath: (document.getElementById("llm-model-path").value || "").trim(),
      localModelChoice: choiceEl ? choiceEl.value : "local",
      recommendedModelId: rec.modelId || "",
      contentPreset: document.getElementById("content-preset-sel").value
    };
  }
  document.getElementById("quit-btn").addEventListener("click", () => {
    if ((anyInstalling() || downloadingGguf) && !window.confirm("A download is still running - quit anyway? You will lose its progress.")) {
      return;
    }
    if (rerunMode) api.close();
    else if (mode === "update") api.skip();
    else api.quit();
  });
  document.getElementById("launch-btn").addEventListener("click", () => {
    const btn = document.getElementById("launch-btn");
    btn.disabled = true;
    btn.textContent = rerunMode ? "Saving…" : "Starting…";
    api.complete(collectConfig());
  });
  api.onInstallProgress(onInstallProgress);
  api.onGgufDownloadProgress(onGgufDownloadProgress);
  function applyOsTheme(s) {
    if (s.osThemeIsHighContrast) document.documentElement.dataset.theme = "high-contrast";
    else if (s.osThemeIsLight) document.documentElement.dataset.theme = "light";
  }
  (async () => {
    try {
      const s = await api.getStatus();
      applyOsTheme(s);
      applyDefaults(s);
      renderSlots(s);
    } catch (e) {
      document.getElementById("item-init").outerHTML = `<div class="item err">
         <div class="icon">✗</div>
         <div class="body">
           <div class="title">Setup check failed</div>
           <div class="desc">Something went wrong while checking your setup. Try <em>Restart app</em> below, or quit and relaunch.
             <details style="margin-top:6px"><summary style="cursor:pointer">Technical details</summary>${esc(String(e))}</details></div>
         </div>
       </div>`;
      document.getElementById("recheck-bar").style.display = "";
      document.getElementById("subtitle").textContent = "Something went wrong.";
    }
  })();
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2hhcmVkL2NhdGFsb2ctZGF0YS5qc29uIiwgIi4uL3l1dV9jbGlwL3dlYi9zdGF0aWMvc2hhcmVkL2VzY2FwZWh0bWwuanMiLCAiLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvd2hpc3BlcmxhbmcuanMiLCAic2V0dXAtcmVuZGVyZXIuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIntcbiAgXCJfZ2VuZXJhdGVkX2J5XCI6IFwieXV1LWRldiBzaGFyZWQtZGF0YVwiLFxuICBcInJlY29tbWVuZGVkX21vZGVsXCI6IHtcbiAgICBcImlkXCI6IFwicXdlbjIuNS03Yi1pbnN0cnVjdFwiLFxuICAgIFwiZGlzcGxheV9uYW1lXCI6IFwiUXdlbjIuNSA3QiBJbnN0cnVjdFwiLFxuICAgIFwiZmlsZW5hbWVcIjogXCJRd2VuMi41LTdCLUluc3RydWN0LVE0X0tfTS5nZ3VmXCIsXG4gICAgXCJnZ3VmX3VybFwiOiBcImh0dHBzOi8vaHVnZ2luZ2ZhY2UuY28vYmFydG93c2tpL1F3ZW4yLjUtN0ItSW5zdHJ1Y3QtR0dVRlwiLFxuICAgIFwicmVzb2x2ZV91cmxcIjogXCJodHRwczovL2h1Z2dpbmdmYWNlLmNvL2JhcnRvd3NraS9Rd2VuMi41LTdCLUluc3RydWN0LUdHVUYvcmVzb2x2ZS9tYWluL1F3ZW4yLjUtN0ItSW5zdHJ1Y3QtUTRfS19NLmdndWZcIixcbiAgICBcInNpemVfZ2JcIjogNC43LFxuICAgIFwibGljZW5jZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgICBcIndoeVwiOiBcIlN0cm9uZyBhbGwtcm91bmQgN0IgLSB0aGUgYmVzdCBsb2NhbCBkZWZhdWx0IGZvciBjbGlwIHNjb3JpbmcuXCJcbiAgfSxcbiAgXCJ3aGlzcGVyX21vZGVsc1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcInRpbnlcIixcbiAgICAgIFwiYmx1cmJcIjogXCJmYXN0ZXN0LCBsb3dlc3QgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn43NSBNQlwiLFxuICAgICAgXCJ2cmFtXCI6IG51bGwsXG4gICAgICBcIm9wdGlvbl90ZXh0XCI6IFwidGlueSAtIGZhc3Rlc3QsIGxvd2VzdCBxdWFsaXR5ICh+NzUgTUIgZG93bmxvYWQpXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJiYXNlXCIsXG4gICAgICBcImJsdXJiXCI6IFwiZmFzdCwgbG93ZXIgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn4xNDAgTUJcIixcbiAgICAgIFwidnJhbVwiOiBudWxsLFxuICAgICAgXCJvcHRpb25fdGV4dFwiOiBcImJhc2UgLSBmYXN0LCBsb3dlciBxdWFsaXR5ICh+MTQwIE1CIGRvd25sb2FkKVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwic21hbGxcIixcbiAgICAgIFwiYmx1cmJcIjogXCJmYXN0LCBkZWNlbnQgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn40NjUgTUJcIixcbiAgICAgIFwidnJhbVwiOiBcIn4xIEdCXCIsXG4gICAgICBcIm9wdGlvbl90ZXh0XCI6IFwic21hbGwgLSBmYXN0LCBkZWNlbnQgcXVhbGl0eSAofjQ2NSBNQiBkb3dubG9hZCwgbmVlZHMgYSB+MSBHQiBncmFwaGljcyBjYXJkKVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwibWVkaXVtXCIsXG4gICAgICBcImJsdXJiXCI6IFwiZ29vZCBiYWxhbmNlXCIsXG4gICAgICBcImRvd25sb2FkXCI6IFwifjEuNSBHQlwiLFxuICAgICAgXCJ2cmFtXCI6IFwifjIuOCBHQlwiLFxuICAgICAgXCJvcHRpb25fdGV4dFwiOiBcIm1lZGl1bSAtIGdvb2QgYmFsYW5jZSAofjEuNSBHQiBkb3dubG9hZCwgbmVlZHMgYSB+Mi44IEdCIGdyYXBoaWNzIGNhcmQpXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJsYXJnZS12M1wiLFxuICAgICAgXCJibHVyYlwiOiBcImJlc3QgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn4yLjkgR0JcIixcbiAgICAgIFwidnJhbVwiOiBcIn40LjIgR0JcIixcbiAgICAgIFwib3B0aW9uX3RleHRcIjogXCJsYXJnZS12MyAtIGJlc3QgcXVhbGl0eSAofjIuOSBHQiBkb3dubG9hZCwgbmVlZHMgYSB+NC4yIEdCIGdyYXBoaWNzIGNhcmQpXCJcbiAgICB9XG4gIF0sXG4gIFwid2hpc3Blcl9sYW5ndWFnZXNcIjogW1xuICAgIFwiYWZcIixcbiAgICBcImFtXCIsXG4gICAgXCJhclwiLFxuICAgIFwiYXNcIixcbiAgICBcImF6XCIsXG4gICAgXCJiYVwiLFxuICAgIFwiYmVcIixcbiAgICBcImJnXCIsXG4gICAgXCJiblwiLFxuICAgIFwiYm9cIixcbiAgICBcImJyXCIsXG4gICAgXCJic1wiLFxuICAgIFwiY2FcIixcbiAgICBcImNzXCIsXG4gICAgXCJjeVwiLFxuICAgIFwiZGFcIixcbiAgICBcImRlXCIsXG4gICAgXCJlbFwiLFxuICAgIFwiZW5cIixcbiAgICBcImVzXCIsXG4gICAgXCJldFwiLFxuICAgIFwiZXVcIixcbiAgICBcImZhXCIsXG4gICAgXCJmaVwiLFxuICAgIFwiZm9cIixcbiAgICBcImZyXCIsXG4gICAgXCJnbFwiLFxuICAgIFwiZ3VcIixcbiAgICBcImhhXCIsXG4gICAgXCJoYXdcIixcbiAgICBcImhlXCIsXG4gICAgXCJoaVwiLFxuICAgIFwiaHJcIixcbiAgICBcImh0XCIsXG4gICAgXCJodVwiLFxuICAgIFwiaHlcIixcbiAgICBcImlkXCIsXG4gICAgXCJpc1wiLFxuICAgIFwiaXRcIixcbiAgICBcImphXCIsXG4gICAgXCJqd1wiLFxuICAgIFwia2FcIixcbiAgICBcImtrXCIsXG4gICAgXCJrbVwiLFxuICAgIFwia25cIixcbiAgICBcImtvXCIsXG4gICAgXCJsYVwiLFxuICAgIFwibGJcIixcbiAgICBcImxuXCIsXG4gICAgXCJsb1wiLFxuICAgIFwibHRcIixcbiAgICBcImx2XCIsXG4gICAgXCJtZ1wiLFxuICAgIFwibWlcIixcbiAgICBcIm1rXCIsXG4gICAgXCJtbFwiLFxuICAgIFwibW5cIixcbiAgICBcIm1yXCIsXG4gICAgXCJtc1wiLFxuICAgIFwibXRcIixcbiAgICBcIm15XCIsXG4gICAgXCJuZVwiLFxuICAgIFwibmxcIixcbiAgICBcIm5uXCIsXG4gICAgXCJub1wiLFxuICAgIFwib2NcIixcbiAgICBcInBhXCIsXG4gICAgXCJwbFwiLFxuICAgIFwicHNcIixcbiAgICBcInB0XCIsXG4gICAgXCJyb1wiLFxuICAgIFwicnVcIixcbiAgICBcInNhXCIsXG4gICAgXCJzZFwiLFxuICAgIFwic2lcIixcbiAgICBcInNrXCIsXG4gICAgXCJzbFwiLFxuICAgIFwic25cIixcbiAgICBcInNvXCIsXG4gICAgXCJzcVwiLFxuICAgIFwic3JcIixcbiAgICBcInN1XCIsXG4gICAgXCJzdlwiLFxuICAgIFwic3dcIixcbiAgICBcInRhXCIsXG4gICAgXCJ0ZVwiLFxuICAgIFwidGdcIixcbiAgICBcInRoXCIsXG4gICAgXCJ0a1wiLFxuICAgIFwidGxcIixcbiAgICBcInRyXCIsXG4gICAgXCJ0dFwiLFxuICAgIFwidWtcIixcbiAgICBcInVyXCIsXG4gICAgXCJ1elwiLFxuICAgIFwidmlcIixcbiAgICBcInlpXCIsXG4gICAgXCJ5b1wiLFxuICAgIFwiemhcIlxuICBdLFxuICBcImNvbnRlbnRfcHJlc2V0c1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcImdlbmVyaWNcIixcbiAgICAgIFwibmFtZVwiOiBcIkdlbmVyaWNcIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJCYWxhbmNlZCBkZWZhdWx0IC0gbm8gY29udGVudC1zcGVjaWZpYyB0dW5pbmcuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJycC1uYXJyYXRpdmVcIixcbiAgICAgIFwibmFtZVwiOiBcIlJQIC8gbmFycmF0aXZlXCIsXG4gICAgICBcImRlc2NyaXB0aW9uXCI6IFwiUm9sZXBsYXkgb3Igc3RvcnktZHJpdmVuIHNlc3Npb25zIC0gY2hhcmFjdGVyIGFuZCBkcmFtYSBmaXJzdC5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImNvbXBldGl0aXZlXCIsXG4gICAgICBcIm5hbWVcIjogXCJDb21wZXRpdGl2ZSBnYW1pbmdcIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJSYW5rZWQgb3IgY29tcGV0aXRpdmUgcGxheSAtIGNsdXRjaGVzLCBjb21lYmFja3MsIGFuZCBjYWxsb3V0cy5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImNhc3VhbFwiLFxuICAgICAgXCJuYW1lXCI6IFwiQ2FzdWFsIC8gbGV0J3MgcGxheVwiLFxuICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlJlbGF4ZWQgbGV0J3MtcGxheXMgLSBwZXJzb25hbGl0eSwgcmVhY3Rpb25zLCBhbmQgZnVubnkgZmFpbHVyZXMuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJzcGVlZHJ1blwiLFxuICAgICAgXCJuYW1lXCI6IFwiU3BlZWRydW5cIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJSdW5zIGFnYWluc3QgdGhlIGNsb2NrIC0gc3BsaXRzLCBQQnMsIGFuZCBoZWFydGJyZWFrIHJlc2V0cy5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcInBvZGNhc3RcIixcbiAgICAgIFwibmFtZVwiOiBcIlBvZGNhc3QgLyBjb252ZXJzYXRpb25cIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJUYWxrLWRyaXZlbiBzZXNzaW9ucyAtIHF1b3RlcywgaG90IHRha2VzLCBhbmQgc2hhcmVkIGxhdWdodGVyLlwiXG4gICAgfVxuICBdLFxuICBcImFpX3ByaXZhY3lfb3B0aW9uc1wiOiBbXG4gICAge1xuICAgICAgXCJ2YWx1ZVwiOiBcIm5vbmVcIixcbiAgICAgIFwibGFiZWxcIjogXCJObyBnZW5lcmF0aXZlIEFJIC0gbm8gbGFuZ3VhZ2UgbW9kZWwgcnVuc1wiXG4gICAgfSxcbiAgICB7XG4gICAgICBcInZhbHVlXCI6IFwibG9jYWxfb25seVwiLFxuICAgICAgXCJsYWJlbFwiOiBcIkxvY2FsIG1vZGVscyBvbmx5IC0gbm90aGluZyBsZWF2ZXMgeW91ciBtYWNoaW5lIChyZWNvbW1lbmRlZClcIlxuICAgIH1cbiAgXSxcbiAgXCJhaV9wcml2YWN5X25vdGVzXCI6IHtcbiAgICBcIm5vbmVcIjogXCJObyBsYW5ndWFnZSBtb2RlbCBydW5zLiBDbGlwcyBhcmUgc3RpbGwgZm91bmQgYW5kIHNlYXJjaGFibGU7IHNjb3JpbmcgdXNlcyBsaWdodHdlaWdodCBzaWduYWxzIG9ubHkuXCIsXG4gICAgXCJsb2NhbF9vbmx5XCI6IFwiT24tZGV2aWNlIG1vZGVscyBvbmx5LiBFdmVyeXRoaW5nIHJ1bnMgbG9jYWxseSAtIG5vdGhpbmcgeW91IHJlY29yZCBpcyBzZW50IGFueXdoZXJlLlwiXG4gIH1cbn1cbiIsICIvLyBUcmFuc3BvcnQtYWdub3N0aWMgSFRNTCBlc2NhcGVyLCBzaGFyZWQgYnkgdGhlIHdlYiBhcHAgYW5kIHRoZSBFbGVjdHJvbiBzZXR1cFxuLy8gd2l6YXJkIChlYWNoIGltcG9ydHMgaXQgdGhyb3VnaCBpdHMgb3duIGVzYnVpbGQgYnVuZGxlIC0gc2VlIEFSQ0hJVEVDVFVSRSBsYW5kbWluZVxuLy8gIzIncyBib3VuZGFyeSBydWxlOiBzaGFyZWQgbW9kdWxlcyB0YWtlIGRhdGEsIG5ldmVyIGZldGNoIG9yIElQQykuIEVzY2FwZXMgJiA8ID4gXCJcbi8vIHNvIGEgdmFsdWUgaXMgc2FmZSBib3RoIGFzIHRleHQgYW5kIGluc2lkZSBhIGRvdWJsZS1xdW90ZWQgYXR0cmlidXRlLlxuZXhwb3J0IGZ1bmN0aW9uIGVzY0h0bWwocykge1xuICByZXR1cm4gU3RyaW5nKHMpXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG59XG4iLCAiaW1wb3J0IHsgZXNjSHRtbCB9IGZyb20gJy4vZXNjYXBlaHRtbC5qcyc7XG5cbi8vIFRoZSB0cmFuc2NyaXB0aW9uLWxhbmd1YWdlIDxvcHRpb24+IGxpc3QsIHNoYXJlZCBieSB3ZWIgU2V0dGluZ3MgYW5kIHRoZSBzZXR1cFxuLy8gd2l6YXJkOiBhbiBcIkF1dG8tZGV0ZWN0XCIgZGVmYXVsdCBmaXJzdCwgdGhlbiBldmVyeSBhbGxvd2VkIGxhbmd1YWdlIGNvZGUgcmVuZGVyZWRcbi8vIHdpdGggaXRzIEVuZ2xpc2ggZGlzcGxheSBuYW1lIChJbnRsLkRpc3BsYXlOYW1lcykgYW5kIHNvcnRlZCBieSB0aGF0IG5hbWUuIFB1cmUgLVxuLy8gaXQgdGFrZXMgdGhlIGNvZGUgbGlzdCBhbmQgcmV0dXJucyBIVE1MOyBpdCBuZXZlciBmZXRjaGVzIHRoZSBsaXN0IG9yIHJlYWRzIGNvbmZpZ1xuLy8gKHRoZSBjYWxsZXIgc3VwcGxpZXMgSFRUUC1iYWNrZWQgb3IgY2F0YWxvZy1iYWNrZWQgY29kZXMpLlxuZXhwb3J0IGZ1bmN0aW9uIGxhbmd1YWdlT3B0aW9uc0h0bWwoY29kZXMpIHtcbiAgbGV0IG5hbWVPZiA9IGNvZGUgPT4gY29kZTtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXNwbGF5TmFtZXMgPSBuZXcgSW50bC5EaXNwbGF5TmFtZXMoWydlbiddLCB7IHR5cGU6ICdsYW5ndWFnZScgfSk7XG4gICAgbmFtZU9mID0gY29kZSA9PiB7XG4gICAgICB0cnkgeyByZXR1cm4gZGlzcGxheU5hbWVzLm9mKGNvZGUpIHx8IGNvZGU7IH0gY2F0Y2ggeyByZXR1cm4gY29kZTsgfVxuICAgIH07XG4gIH0gY2F0Y2ggeyAvKiBJbnRsLkRpc3BsYXlOYW1lcyB1bmF2YWlsYWJsZSAtIGZhbGwgYmFjayB0byByYXcgY29kZXMgKi8gfVxuICBjb25zdCBuYW1lZCA9IChjb2RlcyB8fCBbXSlcbiAgICAubWFwKGNvZGUgPT4gKHsgY29kZSwgbmFtZTogbmFtZU9mKGNvZGUpIH0pKVxuICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcbiAgcmV0dXJuICc8b3B0aW9uIHZhbHVlPVwiXCI+QXV0by1kZXRlY3QgKHJlY29tbWVuZGVkKTwvb3B0aW9uPicgK1xuICAgIG5hbWVkLm1hcChvID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2NIdG1sKG8uY29kZSl9XCI+JHtlc2NIdG1sKG8ubmFtZSl9PC9vcHRpb24+YCkuam9pbignJyk7XG59XG4iLCAiJ3VzZSBzdHJpY3QnO1xyXG5cclxuLy8gU2V0dXAtd2l6YXJkIHJlbmRlcmVyLCBidW5kbGVkIGJ5IGVzYnVpbGQgaW50byB0aGUgY29tbWl0dGVkIGVsZWN0cm9uL3NldHVwLmJ1bmRsZS5qc1xyXG4vLyAoc2Vjb25kIGVudHJ5IGluIHNjcmlwdHMvYnVpbGQtZXNtLm1qcykuIFdhcyBpbmxpbmUgaW4gc2V0dXAuaHRtbDsgZXh0cmFjdGVkIHNvIHRoZVxyXG4vLyB3aXphcmQgY2FuIGltcG9ydCB0aGUgU0FNRSBzaGFyZWQgbW9kdWxlcyB0aGUgd2ViIGFwcCB1c2VzIChlc2NIdG1sLCB0aGUgbGFuZ3VhZ2VcclxuLy8gPG9wdGlvbj4gYnVpbGRlcikgYW5kIHRoZSBnZW5lcmF0ZWQgY2F0YWxvZyBzdHJhaWdodCBmcm9tIHRoZSBQeXRob24gc291cmNlIG9mIHRydXRoLlxyXG4vLyBCb3VuZGFyeSBydWxlOiBzaGFyZWQgbW9kdWxlcyB0YWtlIGRhdGEgKyBjYWxsYmFja3MsIG5ldmVyIGZldGNoL0lQQyAtIHRoZSB3aXphcmRcclxuLy8gZmVlZHMgdGhlbSBJUEMtYmFja2VkIHN0YXRlICh3aW5kb3cuc2V0dXBBUEkpLCBTZXR0aW5ncyBmZWVkcyBIVFRQLWJhY2tlZCBzdGF0ZS5cclxuaW1wb3J0IGNhdGFsb2cgZnJvbSAnLi9zaGFyZWQvY2F0YWxvZy1kYXRhLmpzb24nO1xyXG5pbXBvcnQgeyBlc2NIdG1sIH0gZnJvbSAnLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvZXNjYXBlaHRtbC5qcyc7XHJcbmltcG9ydCB7IGxhbmd1YWdlT3B0aW9uc0h0bWwgfSBmcm9tICcuLi95dXVfY2xpcC93ZWIvc3RhdGljL3NoYXJlZC93aGlzcGVybGFuZy5qcyc7XHJcblxyXG5jb25zdCBhcGkgICAgPSB3aW5kb3cuc2V0dXBBUEk7XHJcbmNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XHJcbmNvbnN0IG1vZGUgICA9IHBhcmFtcy5nZXQoJ21vZGUnKSB8fCAnaW5pdGlhbCc7ICAgLy8gJ2luaXRpYWwnIHwgJ3JlcnVuJyB8ICd1cGRhdGUnXHJcbmNvbnN0IHJlcnVuTW9kZSA9IG1vZGUgPT09ICdyZXJ1bic7XHJcblxyXG4vLyBTaGFyZWQgY2F0YWxvZyBmYWN0cyBnZW5lcmF0ZWQgZnJvbSB0aGUgUHl0aG9uIHNvdXJjZXMgb2YgdHJ1dGggYnlcclxuLy8gYHl1dS1kZXYgc2hhcmVkLWRhdGFgIChleHBvc2VkIHZpYSBzZXR1cC1wcmVsb2FkLmpzKS4gV2hpc3BlciBsYW5ndWFnZXMgKyBtb2RlbHMsXHJcbi8vIGNvbnRlbnQgcHJlc2V0cywgQUktcHJpdmFjeSBjb3B5LCBhbmQgdGhlIHJlY29tbWVuZGVkIG1vZGVsIGFyZSBzaW5nbGUtc291cmNlZCBoZXJlXHJcbi8vIHJhdGhlciB0aGFuIGhhbmQtbWFpbnRhaW5lZCBpbiB0aGlzIGZpbGUuXHJcbmNvbnN0IENBVEFMT0cgPSBjYXRhbG9nO1xyXG5jb25zdCBXSElTUEVSX0xBTkdVQUdFUyA9IENBVEFMT0cud2hpc3Blcl9sYW5ndWFnZXMgfHwgW107XHJcblxyXG5sZXQgc3RhdHVzICA9IG51bGw7XHJcbmxldCBpbnN0YWxsaW5nID0geyAnY3VkYS1saWJzJzogZmFsc2UgfTtcclxubGV0IGRvd25sb2FkaW5nR2d1ZiA9IGZhbHNlO1xyXG5sZXQgZGVmYXVsdHNBcHBsaWVkID0gZmFsc2U7XHJcblxyXG4vLyDilIDilIAgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbmNvbnN0IGVzYyA9IGVzY0h0bWw7XHJcblxyXG5mdW5jdGlvbiBhbnlJbnN0YWxsaW5nKCkgeyByZXR1cm4gaW5zdGFsbGluZ1snY3VkYS1saWJzJ107IH1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZUxhdW5jaEJ0bigpIHtcclxuICBjb25zdCBidG4gID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xhdW5jaC1idG4nKTtcclxuICBjb25zdCBoaW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xhdW5jaC1oaW50Jyk7XHJcbiAgY29uc3QgYmxvY2tlZEJ5RmZtcGVnICA9ICFzdGF0dXMgfHwgIXN0YXR1cy5mZm1wZWdPaztcclxuICBjb25zdCBibG9ja2VkQnlXb3JrICAgID0gYW55SW5zdGFsbGluZygpIHx8IGRvd25sb2FkaW5nR2d1ZjtcclxuICBjb25zdCBibG9ja2VkQnlOb0RpciAgID0gIWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9qZWN0LWRpcicpLnZhbHVlLnRyaW0oKTtcclxuICBidG4uZGlzYWJsZWQgPSBibG9ja2VkQnlGZm1wZWcgfHwgYmxvY2tlZEJ5V29yayB8fCBibG9ja2VkQnlOb0RpcjtcclxuICBidG4udGV4dENvbnRlbnQgPSByZXJ1bk1vZGUgPyAnQXBwbHkgJiBDbG9zZScgOiAnTGF1bmNoJztcclxuICBoaW50LnRleHRDb250ZW50ID0gYmxvY2tlZEJ5RmZtcGVnICYmIHN0YXR1cyA/ICdGRm1wZWcgaXMgcmVxdWlyZWQgYmVmb3JlIHlvdSBjYW4gbGF1bmNoJ1xyXG4gICAgOiBhbnlJbnN0YWxsaW5nKCkgPyAnWW91IGNhbiBrZWVwIGFkanVzdGluZyBzZXR0aW5ncyB3aGlsZSBpdCBpbnN0YWxscyAtIExhdW5jaCB1bmxvY2tzIHdoZW4gaXQgZmluaXNoZXMnXHJcbiAgICA6IGRvd25sb2FkaW5nR2d1ZiA/ICdZb3UgY2FuIGtlZXAgYWRqdXN0aW5nIHNldHRpbmdzIHdoaWxlIGl0IGRvd25sb2FkcyAtIExhdW5jaCB1bmxvY2tzIHdoZW4gaXQgZmluaXNoZXMnXHJcbiAgICA6IGJsb2NrZWRCeU5vRGlyID8gJ0Nob29zZSBhIHByb2plY3QgZm9sZGVyIGJlZm9yZSB5b3UgY2FuIGxhdW5jaCdcclxuICAgIDogJyc7XHJcbiAgY29uc3QgcmVjaGVjayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNoZWNrLWJ0bicpO1xyXG4gIGNvbnN0IHJlc3RhcnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGFydC1idG4nKTtcclxuICBpZiAocmVjaGVjaykgcmVjaGVjay5kaXNhYmxlZCA9IGJsb2NrZWRCeVdvcms7XHJcbiAgaWYgKHJlc3RhcnQpIHJlc3RhcnQuZGlzYWJsZWQgPSBibG9ja2VkQnlXb3JrO1xyXG59XHJcblxyXG5mdW5jdGlvbiByb3coaWQsIGNscywgaWNvbiwgdGl0bGUsIGRlc2NIdG1sLCBhY3Rpb25IdG1sID0gJycpIHtcclxuICByZXR1cm4gYDxkaXYgY2xhc3M9XCJpdGVtICR7Y2xzfVwiIGlkPVwiaXRlbS0ke2VzYyhpZCl9XCI+XHJcbiAgICA8ZGl2IGNsYXNzPVwiaWNvblwiPiR7aWNvbn08L2Rpdj5cclxuICAgIDxkaXYgY2xhc3M9XCJib2R5XCI+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJ0aXRsZVwiPiR7ZXNjKHRpdGxlKX08L2Rpdj5cclxuICAgICAgPGRpdiBjbGFzcz1cImRlc2NcIj4ke2Rlc2NIdG1sfTwvZGl2PlxyXG4gICAgICAke2FjdGlvbkh0bWwgPyBgPGRpdiBjbGFzcz1cImFjdGlvblwiPiR7YWN0aW9uSHRtbH08L2Rpdj5gIDogJyd9XHJcbiAgICA8L2Rpdj5cclxuICA8L2Rpdj5gO1xyXG59XHJcblxyXG4vLyDilIDilIAgZHluYW1pYyBzdGF0dXMgc2xvdHMgKGlucHV0cyBsaXZlIG91dHNpZGUgdGhlc2UsIHNvIGEgcmUtY2hlY2sgbmV2ZXJcclxuLy8gICAgd2lwZXMgYW55dGhpbmcgdGhlIHVzZXIgdHlwZWQpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuZnVuY3Rpb24gcmVuZGVyRmZtcGVnU2xvdChzKSB7XHJcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmZtcGVnLXNsb3QnKTtcclxuICBpZiAocy5mZm1wZWdCdW5kbGVkKSB7XHJcbiAgICBpZiAocy5mZm1wZWdPaykge1xyXG4gICAgICBlbC5pbm5lckhUTUwgPSByb3coJ2ZmbXBlZycsICdvaycsICfinJMnLCAnRkZtcGVnJywgJ0luY2x1ZGVkIHdpdGggWXV1Q2xpcC4gVXNlZCB0byByZWFkIGFuZCBjdXQgdmlkZW8gZmlsZXMuJyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGVsLmlubmVySFRNTCA9IHJvdygnZmZtcGVnJywgJ2VycicsICfinJcnLCAnRkZtcGVnIGluc3RhbGwgaXMgZGFtYWdlZCcsXHJcbiAgICAgICdUaGUgRkZtcGVnIGJ1bmRsZWQgd2l0aCBZdXVDbGlwIGlzIG1pc3Npbmcgb3IgZGFtYWdlZC4gVHJ5IHJlaW5zdGFsbGluZyBZdXVDbGlwOyAnICtcclxuICAgICAgJ2lmIHRoZSBwcm9ibGVtIHBlcnNpc3RzLCBwbGVhc2UgcmVwb3J0IGl0LicpO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBpZiAocy5mZm1wZWdPaykge1xyXG4gICAgZWwuaW5uZXJIVE1MID0gcm93KCdmZm1wZWcnLCAnb2snLCAn4pyTJywgJ0ZGbXBlZycsICdGb3VuZCBvbiBQQVRILiBVc2VkIHRvIHJlYWQgYW5kIGN1dCB2aWRlbyBmaWxlcy4nKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgZWwuaW5uZXJIVE1MID0gcm93KCdmZm1wZWcnLCAnZXJyJywgJ+KclycsICdGRm1wZWcgbm90IGZvdW5kJyxcclxuICAgICdZdXVDbGlwIG5lZWRzIEZGbXBlZyB0byByZWFkIGFuZCBjdXQgdmlkZW8gZmlsZXMuPGJyPicgK1xyXG4gICAgJzxzdHJvbmc+RWFzaWVzdDo8L3N0cm9uZz4gcnVuIHRoaXMgY29tbWFuZCBpbiBhIHRlcm1pbmFsIChTdGFydCDihpIgdHlwZSA8ZW0+dGVybWluYWw8L2VtPiksICcgK1xyXG4gICAgJ3RoZW4gY2xpY2sgPGVtPkNoZWNrIGFnYWluPC9lbT4gYmVsb3cgLSBubyBuZWVkIHRvIGNsb3NlIHRoaXMgd2luZG93LicgK1xyXG4gICAgJzxkZXRhaWxzPjxzdW1tYXJ5PkNhblxcJ3QgdXNlIHdpbmdldD8gTWFudWFsIGluc3RhbGwgc3RlcHM8L3N1bW1hcnk+JyArXHJcbiAgICAnT3BlbiBneWFuLmRldiAoYnV0dG9uIGJlbG93KSwgZG93bmxvYWQgPGVtPmZmbXBlZy1yZWxlYXNlLWVzc2VudGlhbHMuemlwPC9lbT4gKG9yIGEgPGVtPkNVREE8L2VtPiBidWlsZCBmb3IgTlZJRElBIEdQVXMpLiAnICtcclxuICAgICdFeHRyYWN0IHRoZSB6aXAgdG8gYSBwZXJtYW5lbnQgZm9sZGVyIChlLmcuIDxjb2RlPkM6XFxcXGZmbXBlZzwvY29kZT4pLCB0aGVuIGFkZCBpdHMgPGNvZGU+YmluXFxcXDwvY29kZT4gc3ViZm9sZGVyIHRvIFBBVEg6PGJyPicgK1xyXG4gICAgJzEuIE9wZW4gU3RhcnQg4oaSIHNlYXJjaCA8ZW0+RWRpdCB0aGUgc3lzdGVtIGVudmlyb25tZW50IHZhcmlhYmxlczwvZW0+IOKGkiBjbGljayBpdDxicj4nICtcclxuICAgICcyLiBDbGljayA8ZW0+RW52aXJvbm1lbnQgVmFyaWFibGVzPC9lbT48YnI+JyArXHJcbiAgICAnMy4gVW5kZXIgPGVtPlN5c3RlbSB2YXJpYWJsZXM8L2VtPiwgc2VsZWN0IDxlbT5QYXRoPC9lbT4g4oaSIGNsaWNrIDxlbT5FZGl0PC9lbT48YnI+JyArXHJcbiAgICAnNC4gQ2xpY2sgPGVtPk5ldzwvZW0+IOKGkiBwYXN0ZSB0aGUgZnVsbCBwYXRoIHRvIHRoZSA8Y29kZT5iaW5cXFxcPC9jb2RlPiBmb2xkZXIgKGUuZy4gPGNvZGU+QzpcXFxcZmZtcGVnXFxcXGJpbjwvY29kZT4pPGJyPicgK1xyXG4gICAgJzUuIENsaWNrIE9LIG9uIGFsbCBkaWFsb2dzLCB0aGVuIGNsaWNrIDxlbT5DaGVjayBhZ2FpbjwvZW0+IGJlbG93LicgK1xyXG4gICAgJzwvZGV0YWlscz4nLFxyXG4gICAgYDxkaXYgc3R5bGU9XCJkaXNwbGF5OmZsZXg7Z2FwOjZweDthbGlnbi1pdGVtczpjZW50ZXI7d2lkdGg6MTAwJVwiPmAgK1xyXG4gICAgICBgPGNvZGUgc3R5bGU9XCJmbGV4OjFcIj53aW5nZXQgaW5zdGFsbCBHeWFuLkZGbXBlZzwvY29kZT5gICtcclxuICAgICAgYDxidXR0b24gY2xhc3M9XCJzbVwiIGRhdGEtY29weT1cIndpbmdldCBpbnN0YWxsIEd5YW4uRkZtcGVnXCI+Q29weTwvYnV0dG9uPmAgK1xyXG4gICAgICBgPGJ1dHRvbiBjbGFzcz1cInNtXCIgZGF0YS1vcGVuLXVybD1cImh0dHBzOi8vd3d3Lmd5YW4uZGV2L2ZmbXBlZy9idWlsZHMvXCI+T3BlbiBneWFuLmRldjwvYnV0dG9uPmAgK1xyXG4gICAgYDwvZGl2PmBcclxuICApO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJHcHVMaW5lKHMpIHtcclxuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdncHUtbGluZScpO1xyXG4gIGlmIChzLmdwdS5uYW1lID09PSAnVW5rbm93bicpIHtcclxuICAgIGVsLnRleHRDb250ZW50ID0gJ05vIGRpc2NyZXRlIEdQVSBkZXRlY3RlZCAtIGFuYWx5c2lzIHJ1bnMgb24gdGhlIENQVSAoc2xvd2VyLCBidXQgd29ya3MpLic7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIC8vIExMTSBzY29yaW5nIHJ1bnMgb24gYW55IHZlbmRvcidzIEdQVSAodmlhIHRoZSBidW5kbGVkIFZ1bGthbiBlbmdpbmUpOyBvbmx5XHJcbiAgLy8gV2hpc3BlciB0cmFuc2NyaXB0aW9uIGlzIE5WSURJQS9DVURBLW9ubHksIHNvIHRoZSB0d28gYXJlIHJlcG9ydGVkIHNlcGFyYXRlbHkuXHJcbiAgY29uc3QgZ3B1ID0gYERldGVjdGVkIEdQVTogJHtzLmdwdS5uYW1lfSAoJHtzLmdwdS52cmFtTUIudG9Mb2NhbGVTdHJpbmcoKX0gTUIgVlJBTSlgO1xyXG4gIGlmIChzLmdwdS52ZW5kb3IgPT09ICdudmlkaWEnKSB7XHJcbiAgICBjb25zdCBoYXNWZXJzaW9uID0gcy5jdWRhLnZlcnNpb24gJiYgcy5jdWRhLnZlcnNpb24gIT09ICd1bmtub3duJztcclxuICAgIGNvbnN0IGN1ZGFMYWJlbCA9IGhhc1ZlcnNpb24gPyBgQ1VEQSAke3MuY3VkYS52ZXJzaW9ufWAgOiAnQ1VEQSBkZXRlY3RlZCc7XHJcbiAgICBlbC50ZXh0Q29udGVudCA9IHMuY3VkYS5hdmFpbGFibGVcclxuICAgICAgPyBgJHtncHV9IC0gJHtjdWRhTGFiZWx9LiBZb3VyIEdQVSBzcGVlZHMgdXAgYm90aCB0cmFuc2NyaXB0aW9uIGFuZCBMTE0gc2NvcmluZy5gXHJcbiAgICAgIDogYCR7Z3B1fSAtIHlvdXIgR1BVIHNwZWVkcyB1cCBMTE0gc2NvcmluZy4gQWRkIENVREEgKGJlbG93KSB0byBhbHNvIHNwZWVkIHVwIHRyYW5zY3JpcHRpb24uYDtcclxuICB9IGVsc2Uge1xyXG4gICAgZWwudGV4dENvbnRlbnQgPSBgJHtncHV9IC0geW91ciBHUFUgc3BlZWRzIHVwIExMTSBzY29yaW5nLiBUcmFuc2NyaXB0aW9uIHJ1bnMgb24gdGhlIENQVSAoR1BVIHRyYW5zY3JpcHRpb24gbmVlZHMgYW4gTlZJRElBIGNhcmQpLmA7XHJcbiAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJDdWRhU2xvdChzKSB7XHJcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY3VkYS1zbG90Jyk7XHJcbiAgLy8gU2hvdyB0aGUgXCJPcHRpb25hbFwiIHNlY3Rpb24gaGVhZGVyIG9ubHkgd2hlbiBpdCBoYXMgYSB2aXNpYmxlIHJvdzsgYW4gZW1wdHlcclxuICAvLyB0aXRsZWQgc2VjdGlvbiAoZS5nLiBvbiBhIG5vbi1OVklESUEgbWFjaGluZSwgd2hlcmUgQ1VEQSBpcyB0aGUgb25seSBvcHRpb25hbFxyXG4gIC8vIGl0ZW0pIHJlYWRzIGFzIGEgbG9hZCBlcnJvci5cclxuICBjb25zdCBzZXRTbG90ID0gKGh0bWwpID0+IHtcclxuICAgIGVsLmlubmVySFRNTCA9IGh0bWw7XHJcbiAgICBjb25zdCBzZWN0aW9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wdGlvbmFsLXNlY3Rpb24nKTtcclxuICAgIGlmIChzZWN0aW9uKSBzZWN0aW9uLnN0eWxlLmRpc3BsYXkgPSBodG1sID8gJycgOiAnbm9uZSc7XHJcbiAgfTtcclxuICBpZiAocy5ncHUudmVuZG9yICE9PSAnbnZpZGlhJykgeyBzZXRTbG90KCcnKTsgcmV0dXJuOyB9XHJcbiAgaWYgKHMuY3VkYUxpYnNJbnN0YWxsZWQgfHwgcy5jdWRhLmF2YWlsYWJsZSkge1xyXG4gICAgc2V0U2xvdChyb3coJ2N1ZGEnLCAnb2snLCAn4pyTJywgJ0Zhc3RlciB0cmFuc2NyaXB0aW9uIHJlYWR5JyxcclxuICAgICAgJ1RoZSBDVURBIHN1cHBvcnQgbGlicmFyaWVzIGFyZSBhdmFpbGFibGUgLSB0cmFuc2NyaXB0aW9uIHJ1bnMgb24geW91ciBOVklESUEgR1BVLicpKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgc2V0U2xvdChyb3coJ2N1ZGEnLCAnd2FybicsICfil4snLCAnRmFzdGVyIHRyYW5zY3JpcHRpb24gKG9wdGlvbmFsKScsXHJcbiAgICBgWW91ciBOVklESUEgR1BVIGNhbiB0cmFuc2NyaWJlIG11Y2ggZmFzdGVyIHRoYW4gdGhlIENQVS4gVGhpcyBvbmUtdGltZSBpbnN0YWxsIGAgK1xyXG4gICAgYGFkZHMgdGhlIENVREEgc3VwcG9ydCBsaWJyYXJpZXMgKGN1QkxBUyArIGN1RE5OLCB+MSBHQikuIFlvdSBjYW4ga2VlcCBhZGp1c3RpbmcgYCArXHJcbiAgICBgc2V0dGluZ3Mgd2hpbGUgaXQgaW5zdGFsbHMgLSBMYXVuY2ggdW5sb2NrcyB3aGVuIGl0IGZpbmlzaGVzLiAoTExNIHNjb3JpbmcgYWxyZWFkeSBgICtcclxuICAgIGB1c2VzIHlvdXIgR1BVIC0gdGhpcyBvbmx5IHNwZWVkcyB1cCB0cmFuc2NyaXB0aW9uLilgLFxyXG4gICAgYDxidXR0b24gY2xhc3M9XCJzbVwiIGlkPVwiaW5zdGFsbC1idG4tY3VkYS1saWJzXCIgZGF0YS1pbnN0YWxsPVwiY3VkYS1saWJzXCI+U3BlZWQgdXAgdHJhbnNjcmlwdGlvbiAofjEgR0IpPC9idXR0b24+XHJcbiAgICAgPGJ1dHRvbiBjbGFzcz1cInNtXCIgaWQ9XCJpbnN0YWxsLWNhbmNlbC1jdWRhLWxpYnNcIiBkYXRhLWFjdGlvbj1cImluc3RhbGwtY2FuY2VsXCIgc3R5bGU9XCJkaXNwbGF5Om5vbmVcIj5DYW5jZWw8L2J1dHRvbj5cclxuICAgICA8ZGl2IGNsYXNzPVwicHVsbC1tc2dcIiBpZD1cImluc3RhbGwtbXNnLWN1ZGEtbGlic1wiPjwvZGl2PmApKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVuZGVyR2d1ZkRvd25sb2FkU2xvdChzKSB7XHJcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1kb3dubG9hZC1zbG90Jyk7XHJcbiAgaWYgKCFlbCkgcmV0dXJuO1xyXG4gIGlmIChkb3dubG9hZGluZ0dndWYpIHJldHVybjsgLy8gcHJlc2VydmUgdGhlIGluLXByb2dyZXNzIGJhciBhY3Jvc3MgYSBzdGF0dXMgcmUtcmVuZGVyXHJcbiAgY29uc3QgY3VycmVudFBhdGggPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykudmFsdWUgfHwgJycpLnRyaW0oKTtcclxuICBpZiAoY3VycmVudFBhdGgpIHsgZWwuaW5uZXJIVE1MID0gJyc7IHJldHVybjsgfVxyXG4gIGNvbnN0IHJlYyA9IENBVEFMT0cucmVjb21tZW5kZWRfbW9kZWwgfHwge307XHJcbiAgY29uc3QgcmVjTmFtZSA9IHJlYy5kaXNwbGF5X25hbWUgfHwgJ3RoZSByZWNvbW1lbmRlZCBtb2RlbCc7XHJcbiAgY29uc3QgcmVjU2l6ZSA9IHJlYy5zaXplX2diICE9IG51bGwgPyBgfiR7cmVjLnNpemVfZ2J9IEdCYCA6ICcnO1xyXG4gIGVsLmlubmVySFRNTCA9IHJvdygnZ2d1Zi1kb3dubG9hZCcsICd3YXJuJywgJ+KXiycsICdEb3dubG9hZCB0aGUgcmVjb21tZW5kZWQgbW9kZWwnLFxyXG4gICAgYCR7ZXNjKHJlY05hbWUpfSAoJHtlc2MocmVjLmxpY2VuY2UgfHwgJycpfSwgc28gY2xpcHMgeW91IG1ha2UgY2FuIGJlIG1vbmV0aXplZClgICtcclxuICAgIGAke3JlY1NpemUgPyAnLCAnICsgcmVjU2l6ZSA6ICcnfS4gWW91IGNhbiBrZWVwIHVzaW5nIHRoaXMgd2luZG93IHdoaWxlIGl0IGRvd25sb2Fkcy5gLFxyXG4gICAgYDxidXR0b24gY2xhc3M9XCJzbVwiIGlkPVwiZ2d1Zi1kb3dubG9hZC1idG5cIiBkYXRhLWFjdGlvbj1cImdndWYtZG93bmxvYWRcIj5Eb3dubG9hZCByZWNvbW1lbmRlZCBtb2RlbCR7cmVjU2l6ZSA/ICcgKCcgKyBlc2MocmVjU2l6ZSkgKyAnKScgOiAnJ308L2J1dHRvbj5cclxuICAgICA8YnV0dG9uIGNsYXNzPVwic21cIiBpZD1cImdndWYtY2FuY2VsLWJ0blwiIGRhdGEtYWN0aW9uPVwiZ2d1Zi1jYW5jZWxcIiBzdHlsZT1cImRpc3BsYXk6bm9uZVwiPkNhbmNlbDwvYnV0dG9uPlxyXG4gICAgIDxkaXYgY2xhc3M9XCJwdWxsLWJhclwiIGlkPVwiZ2d1Zi1kb3dubG9hZC1iYXJcIiBzdHlsZT1cImRpc3BsYXk6bm9uZTt3aWR0aDoxMDAlO21hcmdpbi10b3A6NXB4XCI+PGRpdiBjbGFzcz1cInB1bGwtZmlsbFwiIGlkPVwiZ2d1Zi1kb3dubG9hZC1maWxsXCI+PC9kaXY+PC9kaXY+XHJcbiAgICAgPGRpdiBjbGFzcz1cInB1bGwtbXNnXCIgaWQ9XCJnZ3VmLWRvd25sb2FkLW1zZ1wiPjwvZGl2PmApO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJTbG90cyhzKSB7XHJcbiAgc3RhdHVzID0gcztcclxuICByZW5kZXJGZm1wZWdTbG90KHMpO1xyXG4gIHJlbmRlckdwdUxpbmUocyk7XHJcbiAgcmVuZGVyQ3VkYVNsb3Qocyk7XHJcbiAgcmVuZGVyR2d1ZkRvd25sb2FkU2xvdChzKTtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3VidGl0bGUnKS50ZXh0Q29udGVudCA9XHJcbiAgICBtb2RlID09PSAndXBkYXRlJyA/ICdUaGlzIHVwZGF0ZSBhZGRlZCBuZXcgc2V0dXAgb3B0aW9ucyAtIHJldmlldywgdGhlbiBsYXVuY2guJ1xyXG4gICAgOiBzLmZmbXBlZ09rID8gJ1N5c3RlbSBjaGVjayBjb21wbGV0ZS4nXHJcbiAgICA6ICdBY3Rpb24gcmVxdWlyZWQgYmVmb3JlIHlvdSBjYW4gbGF1bmNoLic7XHJcbiAgdXBkYXRlTGF1bmNoQnRuKCk7XHJcbn1cclxuXHJcbi8vIEJ1aWxkIHRoZSB3aGlzcGVyIC8gQUktcHJpdmFjeSAvIGNvbnRlbnQtcHJlc2V0IDxvcHRpb24+IGxpc3RzIGZyb20gdGhlIHNoYXJlZFxyXG4vLyBjYXRhbG9nIHNvIHRoZWlyIGNvcHkgaXMgc2luZ2xlLXNvdXJjZWQgKHNlZSBgeXV1LWRldiBzaGFyZWQtZGF0YWApLiBSdW5zIG9uY2UsXHJcbi8vIGJlZm9yZSBhcHBseURlZmF1bHRzIHNldHMgdGhlIHNhdmVkIHZhbHVlcy5cclxuZnVuY3Rpb24gcG9wdWxhdGVDYXRhbG9nU2VsZWN0cygpIHtcclxuICBjb25zdCBmaWxsID0gKGlkLCBpdGVtcywgdmFsdWUsIGxhYmVsKSA9PiB7XHJcbiAgICBjb25zdCBzZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XHJcbiAgICBpZiAoIXNlbCkgcmV0dXJuO1xyXG4gICAgc2VsLmlubmVySFRNTCA9IGl0ZW1zXHJcbiAgICAgIC5tYXAoaXQgPT4gYDxvcHRpb24gdmFsdWU9XCIke2VzYyh2YWx1ZShpdCkpfVwiPiR7ZXNjKGxhYmVsKGl0KSl9PC9vcHRpb24+YClcclxuICAgICAgLmpvaW4oJycpO1xyXG4gIH07XHJcbiAgZmlsbCgnd2hpc3Blci1zZWwnLCBDQVRBTE9HLndoaXNwZXJfbW9kZWxzIHx8IFtdLCBtID0+IG0uaWQsIG0gPT4gbS5vcHRpb25fdGV4dCk7XHJcbiAgZmlsbCgnYWktcHJpdmFjeS1zZWwnLCBDQVRBTE9HLmFpX3ByaXZhY3lfb3B0aW9ucyB8fCBbXSwgbyA9PiBvLnZhbHVlLCBvID0+IG8ubGFiZWwpO1xyXG4gIGZpbGwoJ2NvbnRlbnQtcHJlc2V0LXNlbCcsIENBVEFMT0cuY29udGVudF9wcmVzZXRzIHx8IFtdLCBwID0+IHAuaWQsIHAgPT4gcC5uYW1lKTtcclxuXHJcbiAgY29uc3QgcmVjID0gQ0FUQUxPRy5yZWNvbW1lbmRlZF9tb2RlbCB8fCB7fTtcclxuICBjb25zdCBzaXplVGV4dCA9IHJlYy5zaXplX2diICE9IG51bGwgPyBgJHtyZWMuc2l6ZV9nYn0gR0JgIDogJyc7XHJcbiAgY29uc3Qgc2V0VGV4dCA9IChpZCwgdGV4dCkgPT4geyBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTsgaWYgKGVsICYmIHRleHQpIGVsLnRleHRDb250ZW50ID0gdGV4dDsgfTtcclxuICBzZXRUZXh0KCdyZWMtbW9kZWwtc2l6ZS1pbmxpbmUnLCBzaXplVGV4dCk7XHJcbiAgc2V0VGV4dCgncmVjLW1vZGVsLXNpemUtYWR2Jywgc2l6ZVRleHQpO1xyXG59XHJcblxyXG4vLyBGaXJzdCByZW5kZXIgb25seTogZmlsbCB0aGUgZm9ybSBmcm9tIHNhdmVkIGNvbmZpZyAvIGRldGVjdGVkIGRlZmF1bHRzLlxyXG5mdW5jdGlvbiBhcHBseURlZmF1bHRzKHMpIHtcclxuICBpZiAoZGVmYXVsdHNBcHBsaWVkKSByZXR1cm47XHJcbiAgZGVmYXVsdHNBcHBsaWVkID0gdHJ1ZTtcclxuXHJcbiAgcG9wdWxhdGVDYXRhbG9nU2VsZWN0cygpO1xyXG5cclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvamVjdC1kaXInKS52YWx1ZSA9IHMucHJvamVjdERpcjtcclxuICBjb25zdCB3aGlzcGVyU2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3doaXNwZXItc2VsJyk7XHJcbiAgd2hpc3BlclNlbC52YWx1ZSA9IHMud2hpc3Blck1vZGVsIHx8IHMucmVjb21tZW5kZWRXaGlzcGVyLm1vZGVsO1xyXG4gIGlmICghd2hpc3BlclNlbC52YWx1ZSkgd2hpc3BlclNlbC52YWx1ZSA9IHMucmVjb21tZW5kZWRXaGlzcGVyLm1vZGVsO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWMtdGFnJykudGV4dENvbnRlbnQgPSAn4oaQIHJlY29tbWVuZGVkJztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjLXRhZycpLnRpdGxlID0gcy5yZWNvbW1lbmRlZFdoaXNwZXIucmVhc29uO1xyXG5cclxuICBjb25zdCBsYW5nU2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3doaXNwZXItbGFuZy1zZWwnKTtcclxuICBsYW5nU2VsLmlubmVySFRNTCA9IGxhbmd1YWdlT3B0aW9uc0h0bWwoV0hJU1BFUl9MQU5HVUFHRVMpO1xyXG4gIGxhbmdTZWwudmFsdWUgPSBXSElTUEVSX0xBTkdVQUdFUy5pbmNsdWRlcyhzLndoaXNwZXJMYW5ndWFnZSkgPyBzLndoaXNwZXJMYW5ndWFnZSA6ICcnO1xyXG5cclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWktcHJpdmFjeS1zZWwnKS52YWx1ZSA9IHMuYWlQcml2YWN5TW9kZSB8fCAnbG9jYWxfb25seSc7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykudmFsdWUgID0gcy5sbG1Nb2RlbFBhdGggfHwgJyc7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRlbnQtcHJlc2V0LXNlbCcpLnZhbHVlID0gcy5jb250ZW50UHJlc2V0IHx8ICdnZW5lcmljJztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGVudC1wcmVzZXQtbm90ZScpLnRleHRDb250ZW50ID1cclxuICAgICdOb3Qgc3VyZT8gR2VuZXJpYyBpcyBhIGdvb2QgZGVmYXVsdC4gWW91IGNhbiBmaW5lLXR1bmUgZXZlcnkgc2NvcmluZyB3ZWlnaHQgbGF0ZXIgaW4gU2V0dGluZ3MuJztcclxuXHJcbiAgY29uc3QgcmVjID0gcy5sb2NhbE1vZGVsUmVjb21tZW5kYXRpb24gfHwge307XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1yZWMtaGVhZGxpbmUnKS50ZXh0Q29udGVudCA9IHJlYy5oZWFkbGluZSB8fCAnJztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLXJlYy1yZWFzb24nKS50ZXh0Q29udGVudCAgID0gcmVjLnJlYXNvbiB8fCAnJztcclxuICAvLyBQcmUtc2VsZWN0IGxvY2FsIEFJIGFzIHRoZSByZWNvbW1lbmRlZCBwYXRoIHVubGVzcyB0aGUgbWFjaGluZSBjYW4ndCBmaXQgdGhlXHJcbiAgLy8gbW9kZWwgKHB1c2ggJ25vbmUnKTsgYW4gZXhpc3RpbmcgbW9kZWwgZmlsZSBhbHNvIGtlZXBzIGxvY2FsIHNlbGVjdGVkICh0aGVcclxuICAvLyBidWlsZCBzdGVwIHdvbid0IHJlLXF1ZXVlIGEgZG93bmxvYWQgd2hlbiBhIHBhdGggaXMgYWxyZWFkeSBzZXQpLlxyXG4gIGNvbnN0IGhhc0V4aXN0aW5nTW9kZWwgPSBCb29sZWFuKChzLmxsbU1vZGVsUGF0aCB8fCAnJykudHJpbSgpKTtcclxuICBjb25zdCBwcmVmZXJMb2NhbCA9IGhhc0V4aXN0aW5nTW9kZWwgfHwgcmVjLnB1c2ggPT09ICdzdHJvbmcnIHx8IHJlYy5wdXNoID09PSAnc29mdCc7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLXllcycpLmNoZWNrZWQgPSBwcmVmZXJMb2NhbDtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWktbm8nKS5jaGVja2VkICA9ICFwcmVmZXJMb2NhbDtcclxuICBvbkxvY2FsQWlDaG9pY2VDaGFuZ2UoKTtcclxuXHJcbiAgb25Qcml2YWN5TW9kZUNoYW5nZShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWktcHJpdmFjeS1zZWwnKS52YWx1ZSk7XHJcblxyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpdGVtLWluaXQnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWN0aW9ucycpLnN0eWxlLmRpc3BsYXkgID0gJyc7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY2hlY2stYmFyJykuc3R5bGUuZGlzcGxheSA9ICcnO1xyXG4gIGlmIChyZXJ1bk1vZGUpIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXJ1bi1ub3RlJykuc3R5bGUuZGlzcGxheSA9ICcnO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWl0LWJ0bicpLnRleHRDb250ZW50ID1cclxuICAgIHJlcnVuTW9kZSA/ICdDbG9zZScgOiBtb2RlID09PSAndXBkYXRlJyA/ICdTa2lwIGZvciBub3cnIDogJ1F1aXQnO1xyXG59XHJcblxyXG4vLyDilIDilIAgQUkgcHJpdmFjeSArIGxvY2FsIG1vZGVsIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuLy8geXV1LWNsaXAgaXMgbG9jYWwtb25seTsgdGhlIG1vZGUgdG9nZ2xlcyB3aGV0aGVyIGEgZ2VuZXJhdGl2ZSBtb2RlbCBydW5zIGF0IGFsbC5cclxuLy8gQ29weSBjb21lcyBmcm9tIHRoZSBzaGFyZWQgY2F0YWxvZyAoc2luZ2xlIHNvdXJjZSBmb3IgdGhlIHdpemFyZCArIHdlYiBTZXR0aW5ncykuXHJcbmNvbnN0IEFJX1BSSVZBQ1lfTk9URVMgPSBDQVRBTE9HLmFpX3ByaXZhY3lfbm90ZXMgfHwge307XHJcblxyXG5mdW5jdGlvbiBvblByaXZhY3lNb2RlQ2hhbmdlKG1vZGUpIHtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWktcHJpdmFjeS1ub3RlJykudGV4dENvbnRlbnQgPSBBSV9QUklWQUNZX05PVEVTW21vZGVdIHx8ICcnO1xyXG4gIGNvbnN0IGxsbUJsb2NrID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1nZW5lcmF0aXZlLWJsb2NrJyk7XHJcbiAgaWYgKGxsbUJsb2NrKSBsbG1CbG9jay5zdHlsZS5kaXNwbGF5ID0gbW9kZSA9PT0gJ25vbmUnID8gJ25vbmUnIDogJyc7XHJcbiAgdXBkYXRlTGxtV2FybigpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVMbG1XYXJuKCkge1xyXG4gIGNvbnN0IGZpbGVQYXRoID0gKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tbW9kZWwtcGF0aCcpLnZhbHVlIHx8ICcnKS50cmltKCk7XHJcbiAgY29uc3Qgd2FudHNMb2NhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2NhbC1haS15ZXMnKS5jaGVja2VkO1xyXG4gIC8vIFdpdGggXCJTZXQgdXAgbG9jYWwgQUlcIiBjaG9zZW4sIHRoZSByZWNvbW1lbmRlZCBtb2RlbCBpcyBxdWV1ZWQgZm9yIGEgYmFja2dyb3VuZFxyXG4gIC8vIGRvd25sb2FkIG9uIGxhdW5jaCAtIHNvIFwiTExNIHNjb3Jpbmcgd2lsbCBiZSBza2lwcGVkXCIgd291bGQgYmUgd3JvbmcuIE9ubHkgd2FyblxyXG4gIC8vIHdoZW4gdGhlcmUncyBubyBmaWxlLCBub3RoaW5nIGRvd25sb2FkaW5nLCBhbmQgbm8gYmFja2dyb3VuZCBkb3dubG9hZCBjb21pbmcuXHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS13YXJuJykuc3R5bGUuZGlzcGxheSA9XHJcbiAgICAoIWZpbGVQYXRoICYmICFkb3dubG9hZGluZ0dndWYgJiYgIXdhbnRzTG9jYWwpID8gJ2Jsb2NrJyA6ICdub25lJztcclxuICBpZiAoc3RhdHVzKSByZW5kZXJHZ3VmRG93bmxvYWRTbG90KHN0YXR1cyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uTG9jYWxBaUNob2ljZUNoYW5nZSgpIHtcclxuICBjb25zdCBsaWdodHdlaWdodCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2NhbC1haS1ubycpLmNoZWNrZWQ7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xpZ2h0d2VpZ2h0LW5vdGUnKS5zdHlsZS5kaXNwbGF5ID0gbGlnaHR3ZWlnaHQgPyAnJyA6ICdub25lJztcclxuICAvLyBUaGUgY2hvaWNlIGdvdmVybnMgd2hldGhlciB0aGUgTExNIG1vZGVsIGlzIHF1ZXVlZCBmb3IgYSBiYWNrZ3JvdW5kIGRvd25sb2FkLFxyXG4gIC8vIHdoaWNoIGRlY2lkZXMgd2hldGhlciB0aGUgXCJ3aWxsIGJlIHNraXBwZWRcIiB3YXJuaW5nIGlzIGFjY3VyYXRlIC0ga2VlcCBpdCBpbiBzeW5jLlxyXG4gIHVwZGF0ZUxsbVdhcm4oKTtcclxufVxyXG5cclxuLy8g4pSA4pSAIEdHVUYgbW9kZWwgb25lLWNsaWNrIGRvd25sb2FkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuZnVuY3Rpb24gc3RhcnRHZ3VmRG93bmxvYWQoKSB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtZG93bmxvYWQtYnRuJyk7XHJcbiAgY29uc3QgY2FuY2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtY2FuY2VsLWJ0bicpO1xyXG4gIGNvbnN0IGJhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLWJhcicpO1xyXG4gIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgaWYgKGNhbmNlbCkgeyBjYW5jZWwuc3R5bGUuZGlzcGxheSA9ICcnOyBjYW5jZWwuZGlzYWJsZWQgPSBmYWxzZTsgfVxyXG4gIGlmIChiYXIpIGJhci5zdHlsZS5kaXNwbGF5ID0gJyc7XHJcbiAgZG93bmxvYWRpbmdHZ3VmID0gdHJ1ZTtcclxuICB1cGRhdGVMYXVuY2hCdG4oKTtcclxuICB1cGRhdGVMbG1XYXJuKCk7IC8vIGhpZGUgdGhlIFwibm8gbW9kZWwgZmlsZSBjaG9zZW5cIiB3YXJuaW5nIHdoaWxlIHRoZSBkb3dubG9hZCBydW5zXHJcbiAgYXBpLmRvd25sb2FkR2d1Zk1vZGVsKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNhbmNlbEdndWZEb3dubG9hZCgpIHtcclxuICBjb25zdCBjYW5jZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1jYW5jZWwtYnRuJyk7XHJcbiAgaWYgKGNhbmNlbCkgY2FuY2VsLmRpc2FibGVkID0gdHJ1ZTtcclxuICBhcGkuY2FuY2VsR2d1ZkRvd25sb2FkKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uR2d1ZkRvd25sb2FkUHJvZ3Jlc3MoZGF0YSkge1xyXG4gIGNvbnN0IGZpbGwgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLWZpbGwnKTtcclxuICBjb25zdCBtc2cgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1kb3dubG9hZC1tc2cnKTtcclxuICBjb25zdCBidG4gICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1kb3dubG9hZC1idG4nKTtcclxuICBjb25zdCBjYW5jZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1jYW5jZWwtYnRuJyk7XHJcbiAgY29uc3QgZG9uZSA9ICgpID0+IHsgZG93bmxvYWRpbmdHZ3VmID0gZmFsc2U7IGlmIChjYW5jZWwpIGNhbmNlbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB1cGRhdGVMYXVuY2hCdG4oKTsgdXBkYXRlTGxtV2FybigpOyB9O1xyXG4gIGlmIChkYXRhLmRvbmUpIHtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tbW9kZWwtcGF0aCcpLnZhbHVlID0gZGF0YS5wYXRoO1xyXG4gICAgdXBkYXRlTGxtV2FybigpOyAvLyBhbHNvIHJlLXJlbmRlcnMgdGhlIGRvd25sb2FkIHNsb3QsIG5vdyBoaWRkZW4gc2luY2UgdGhlIHBhdGggaXMgc2V0XHJcbiAgICBkb25lKCk7XHJcbiAgfSBlbHNlIGlmIChkYXRhLmNhbmNlbGxlZCkge1xyXG4gICAgaWYgKG1zZykgbXNnLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkIGNhbmNlbGxlZC4nO1xyXG4gICAgaWYgKGZpbGwpIGZpbGwuc3R5bGUud2lkdGggPSAnMCUnO1xyXG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICBkb25lKCk7XHJcbiAgfSBlbHNlIGlmIChkYXRhLmVycm9yKSB7XHJcbiAgICBpZiAobXNnKSBtc2cudGV4dENvbnRlbnQgPSBgRG93bmxvYWQgZmFpbGVkOiAke2RhdGEuZXJyb3J9YDtcclxuICAgIGlmIChmaWxsKSBmaWxsLnN0eWxlLndpZHRoID0gJzAlJzsgIC8vIGRvbid0IGxlYXZlIGEgaGFsZi1mdWxsIGJhciBvbiBhIGZhaWx1cmVcclxuICAgIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgZG9uZSgpO1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEucHJvZ3Jlc3MgPT09ICdudW1iZXInKSB7XHJcbiAgICBpZiAoZmlsbCkgZmlsbC5zdHlsZS53aWR0aCA9IGRhdGEucHJvZ3Jlc3MgKyAnJSc7XHJcbiAgICAvLyBTaG93IGFic29sdXRlIEdCIGFsb25nc2lkZSB0aGUgcGVyY2VudCB3aGVuIHdlIGtub3cgdGhlIG1vZGVsIHNpemUuXHJcbiAgICBjb25zdCBzaXplR2IgPSAoQ0FUQUxPRy5yZWNvbW1lbmRlZF9tb2RlbCB8fCB7fSkuc2l6ZV9nYjtcclxuICAgIGNvbnN0IGRvbmVHYiA9IHNpemVHYiAhPSBudWxsID8gYCAoJHsoZGF0YS5wcm9ncmVzcyAvIDEwMCAqIHNpemVHYikudG9GaXhlZCgxKX0gb2YgJHtzaXplR2J9IEdCKWAgOiAnJztcclxuICAgIGlmIChtc2cpICBtc2cudGV4dENvbnRlbnQgID0gYERvd25sb2FkaW5n4oCmICR7ZGF0YS5wcm9ncmVzc30lJHtkb25lR2J9YDtcclxuICB9XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBvcHRpb25hbCBwYWNrYWdlIGluc3RhbGxzIChwaXAgaW50byB0aGUgdmVudikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG5mdW5jdGlvbiBzdGFydEluc3RhbGwoc2x1Zykge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBpbnN0YWxsLWJ0bi0ke3NsdWd9YCk7XHJcbiAgY29uc3QgY2FuY2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGluc3RhbGwtY2FuY2VsLSR7c2x1Z31gKTtcclxuICBjb25zdCBtc2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgaW5zdGFsbC1tc2ctJHtzbHVnfWApO1xyXG4gIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgaWYgKGNhbmNlbCkgeyBjYW5jZWwuc3R5bGUuZGlzcGxheSA9ICcnOyBjYW5jZWwuZGlzYWJsZWQgPSBmYWxzZTsgfVxyXG4gIGlmIChtc2cpIG1zZy50ZXh0Q29udGVudCA9ICdTdGFydGluZ+KApic7XHJcbiAgaW5zdGFsbGluZ1tzbHVnXSA9IHRydWU7XHJcbiAgdXBkYXRlTGF1bmNoQnRuKCk7XHJcbiAgYXBpLmluc3RhbGxQYWNrYWdlKHNsdWcpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBjYW5jZWxJbnN0YWxsKHNsdWcpIHtcclxuICBjb25zdCBjYW5jZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgaW5zdGFsbC1jYW5jZWwtJHtzbHVnfWApO1xyXG4gIGlmIChjYW5jZWwpIGNhbmNlbC5kaXNhYmxlZCA9IHRydWU7XHJcbiAgYXBpLmNhbmNlbEluc3RhbGwoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25JbnN0YWxsUHJvZ3Jlc3MoZGF0YSkge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBpbnN0YWxsLWJ0bi0ke2RhdGEuc2x1Z31gKTtcclxuICBjb25zdCBjYW5jZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgaW5zdGFsbC1jYW5jZWwtJHtkYXRhLnNsdWd9YCk7XHJcbiAgY29uc3QgbXNnID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGluc3RhbGwtbXNnLSR7ZGF0YS5zbHVnfWApO1xyXG4gIGlmIChjYW5jZWwgJiYgKGRhdGEuZG9uZSB8fCBkYXRhLmVycm9yIHx8IGRhdGEuY2FuY2VsbGVkKSkgY2FuY2VsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgaWYgKGRhdGEuZG9uZSkge1xyXG4gICAgaW5zdGFsbGluZ1tkYXRhLnNsdWddID0gZmFsc2U7XHJcbiAgICBpZiAoZGF0YS5zbHVnID09PSAnY3VkYS1saWJzJykgeyBzdGF0dXMuY3VkYUxpYnNJbnN0YWxsZWQgPSB0cnVlOyByZW5kZXJDdWRhU2xvdChzdGF0dXMpOyB9XHJcbiAgICB1cGRhdGVMYXVuY2hCdG4oKTtcclxuICB9IGVsc2UgaWYgKGRhdGEuY2FuY2VsbGVkKSB7XHJcbiAgICBpbnN0YWxsaW5nW2RhdGEuc2x1Z10gPSBmYWxzZTtcclxuICAgIGlmIChtc2cpIG1zZy50ZXh0Q29udGVudCA9ICdJbnN0YWxsIGNhbmNlbGxlZC4nO1xyXG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICB1cGRhdGVMYXVuY2hCdG4oKTtcclxuICB9IGVsc2UgaWYgKGRhdGEuZXJyb3IpIHtcclxuICAgIGluc3RhbGxpbmdbZGF0YS5zbHVnXSA9IGZhbHNlO1xyXG4gICAgLy8gR1BVIGFjY2VsZXJhdGlvbiBpcyBuZXZlciByZXF1aXJlZCAtIHJlYXNzdXJlIHRoZSB1c2VyIHRoZXkgY2FuIHN0aWxsIGxhdW5jaC5cclxuICAgIGNvbnN0IGNwdU5vdGUgPSBkYXRhLnNsdWcgPT09ICdjdWRhLWxpYnMnXHJcbiAgICAgID8gJyBZb3UgY2FuIHN0aWxsIGxhdW5jaCAtIHRyYW5zY3JpcHRpb24gd2lsbCBydW4gb24gdGhlIENQVS4nXHJcbiAgICAgIDogJyc7XHJcbiAgICBpZiAobXNnKSBtc2cudGV4dENvbnRlbnQgPSBgSW5zdGFsbCBmYWlsZWQ6ICR7ZGF0YS5lcnJvcn0ke2NwdU5vdGV9YDtcclxuICAgIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgdXBkYXRlTGF1bmNoQnRuKCk7XHJcbiAgfSBlbHNlIGlmIChkYXRhLnN0YXR1cykge1xyXG4gICAgaWYgKG1zZykgbXNnLnRleHRDb250ZW50ID0gZGF0YS5zdGF0dXM7XHJcbiAgfVxyXG59XHJcblxyXG4vLyDilIDilIAgcmUtY2hlY2sgLyByZXN0YXJ0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVjaGVjaygpIHtcclxuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1idG4nKTtcclxuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gIGNvbnN0IG9yaWdpbmFsID0gYnRuLnRleHRDb250ZW50O1xyXG4gIGJ0bi50ZXh0Q29udGVudCA9ICdDaGVja2luZ+KApic7XHJcbiAgdHJ5IHtcclxuICAgIHJlbmRlclNsb3RzKGF3YWl0IGFwaS5nZXRTdGF0dXMoKSk7XHJcbiAgfSBmaW5hbGx5IHtcclxuICAgIGJ0bi50ZXh0Q29udGVudCA9IG9yaWdpbmFsO1xyXG4gICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICB1cGRhdGVMYXVuY2hCdG4oKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBVSSBldmVudHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4vLyBFdmVudCBkZWxlZ2F0aW9uIGZvciBldmVyeSBidXR0b24gaW5qZWN0ZWQgdmlhIGlubmVySFRNTCAoc2xvdHMgcmUtcmVuZGVyIG9uIGVhY2hcclxuLy8gc3RhdHVzIHJlZnJlc2gpLiBJbmxpbmUgb24tZXZlbnQgaGFuZGxlcnMgY2FuJ3QgYmUgdXNlZCBoZXJlOiB0aGlzIGZpbGUgaXMgYnVuZGxlZFxyXG4vLyBpbnRvIGFuIElJRkUsIHNvIG1vZHVsZS1zY29wZWQgZnVuY3Rpb25zIGxpa2Ugc3RhcnRHZ3VmRG93bmxvYWQgYXJlIG5laXRoZXIgZ2xvYmFsXHJcbi8vIChpbmxpbmUgaGFuZGxlcnMgcmVzb2x2ZSBvbiB3aW5kb3cpIG5vciBldmVuIHByZXNlbnQgKGVzYnVpbGQgdHJlZS1zaGFrZXMgZnVuY3Rpb25zXHJcbi8vIHJlZmVyZW5jZWQgb25seSBmcm9tIHN0cmluZyBsaXRlcmFscykuIFRoZSBzdGF0aWMgZ3VhcmQgaW5cclxuLy8gdGVzdC9zZXR1cC1yZW5kZXJlci1oYW5kbGVycy50ZXN0LmpzIGtlZXBzIGlubGluZSBoYW5kbGVycyBmcm9tIGNyZWVwaW5nIGJhY2suXHJcbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XHJcbiAgY29uc3QgY29weUJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWNvcHldJyk7XHJcbiAgaWYgKGNvcHlCdG4pIHtcclxuICAgIGFwaS5jb3B5VGV4dChjb3B5QnRuLmRhdGFzZXQuY29weSk7XHJcbiAgICBjb25zdCBvcmlnaW5hbCA9IGNvcHlCdG4udGV4dENvbnRlbnQ7XHJcbiAgICBjb3B5QnRuLnRleHRDb250ZW50ID0gJ0NvcGllZCEnO1xyXG4gICAgc2V0VGltZW91dCgoKSA9PiB7IGNvcHlCdG4udGV4dENvbnRlbnQgPSBvcmlnaW5hbDsgfSwgMTIwMCk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIGNvbnN0IHVybEJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLW9wZW4tdXJsXScpO1xyXG4gIGlmICh1cmxCdG4pIHsgYXBpLm9wZW5VUkwodXJsQnRuLmRhdGFzZXQub3BlblVybCk7IHJldHVybjsgfVxyXG4gIGNvbnN0IGluc3RhbGxCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1pbnN0YWxsXScpO1xyXG4gIGlmIChpbnN0YWxsQnRuKSB7IHN0YXJ0SW5zdGFsbChpbnN0YWxsQnRuLmRhdGFzZXQuaW5zdGFsbCk7IHJldHVybjsgfVxyXG4gIGNvbnN0IGFjdGlvbkJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWFjdGlvbl0nKTtcclxuICBpZiAoYWN0aW9uQnRuKSB7XHJcbiAgICBpZiAoYWN0aW9uQnRuLmRhdGFzZXQuYWN0aW9uID09PSAnZ2d1Zi1kb3dubG9hZCcpIHN0YXJ0R2d1ZkRvd25sb2FkKCk7XHJcbiAgICBlbHNlIGlmIChhY3Rpb25CdG4uZGF0YXNldC5hY3Rpb24gPT09ICdnZ3VmLWNhbmNlbCcpIGNhbmNlbEdndWZEb3dubG9hZCgpO1xyXG4gICAgZWxzZSBpZiAoYWN0aW9uQnRuLmRhdGFzZXQuYWN0aW9uID09PSAnaW5zdGFsbC1jYW5jZWwnKSBjYW5jZWxJbnN0YWxsKCdjdWRhLWxpYnMnKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Jyb3dzZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcclxuICBjb25zdCBkaXIgPSBhd2FpdCBhcGkucGlja0ZvbGRlcigpO1xyXG4gIGlmIChkaXIpIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9qZWN0LWRpcicpLnZhbHVlID0gZGlyO1xyXG4gIHVwZGF0ZUxhdW5jaEJ0bigpO1xyXG59KTtcclxuXHJcbi8vIFJlc3RvcmUtZnJvbS1iYWNrdXAgaXMgYSBmaXJzdC1ydW4gY2hvaWNlIG9ubHk6IHJlcnVuL3VwZGF0ZSBhbHJlYWR5IGhhdmUgYVxyXG4vLyBsaXZlIHByb2plY3QsIGFuZCByZXN0b3Jpbmcgb3ZlciBpdCBiZWxvbmdzIGluIHRoZSBpbi1hcHAgU2V0dGluZ3MgZmxvdy5cclxuaWYgKG1vZGUgPT09ICdpbml0aWFsJykgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RvcmUtcm93Jykuc3R5bGUuZGlzcGxheSA9ICcnO1xyXG5cclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RvcmUtYmFja3VwLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xyXG4gIGNvbnN0IGFyY2hpdmUgPSBhd2FpdCBhcGkucGlja0ZpbGUoe1xyXG4gICAgdGl0bGU6ICAgJ0Nob29zZSBhIFl1dUNsaXAgYmFja3VwJyxcclxuICAgIGZpbHRlcnM6IFt7IG5hbWU6ICdZdXVDbGlwIGJhY2t1cCcsIGV4dGVuc2lvbnM6IFsnemlwJ10gfV0sXHJcbiAgfSk7XHJcbiAgaWYgKCFhcmNoaXZlKSByZXR1cm47XHJcbiAgY29uc3QgdGFyZ2V0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb2plY3QtZGlyJykudmFsdWU7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RvcmUtYmFja3VwLWJ0bicpO1xyXG4gIGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgYnRuLnRleHRDb250ZW50ID0gJ1Jlc3RvcmluZ+KApic7XHJcbiAgbGV0IHJlc3VsdDtcclxuICB0cnkge1xyXG4gICAgcmVzdWx0ID0gYXdhaXQgYXBpLnJlc3RvcmVCYWNrdXAoeyBhcmNoaXZlLCBwcm9qZWN0OiB0YXJnZXQgfSk7XHJcbiAgfSBjYXRjaCAoZSkge1xyXG4gICAgcmVzdWx0ID0geyBvazogZmFsc2UsIGVycm9yOiBTdHJpbmcoZSAmJiBlLm1lc3NhZ2UgfHwgZSkgfTtcclxuICB9XHJcbiAgaWYgKHJlc3VsdC5vaykge1xyXG4gICAgLy8gTGF1bmNoIHN0cmFpZ2h0IGludG8gdGhlIHJlc3RvcmVkIHByb2plY3Q7IGNvbXBsZXRlKCkgc2tpcHMgdGhlIHdpemFyZFxyXG4gICAgLy8gY29uZmlnIHdyaXRlIHNvIHRoZSBiYWNrdXAncyBvd24gc2V0dGluZ3Mgc3Vydml2ZSAobWFpbi5qczogY2ZnLnJlc3RvcmVkKS5cclxuICAgIGJ0bi50ZXh0Q29udGVudCA9ICdSZXN0b3JlZCAtIHN0YXJ0aW5n4oCmJztcclxuICAgIGFwaS5jb21wbGV0ZSh7IHByb2plY3REaXI6IHRhcmdldCwgcmVzdG9yZWQ6IHRydWUgfSk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIC8vIE9uIGZhaWx1cmUgKG5vdCBhIGNhbmNlbGxlZCByZXBsYWNlKSBtYWluLmpzIGhhcyBhbHJlYWR5IHNob3duIGFuIGVycm9yXHJcbiAgLy8gZGlhbG9nOyBqdXN0IHJlc2V0IHRoZSBidXR0b24gc28gdGhlIHVzZXIgY2FuIHRyeSBhbm90aGVyIGZpbGUuXHJcbiAgYnRuLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgYnRuLnRleHRDb250ZW50ID0gJ1Jlc3RvcmUgZnJvbSBhIGJhY2t1cCBpbnN0ZWFk4oCmJztcclxufSk7XHJcblxyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLWJyb3dzZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcclxuICBjb25zdCBmaWxlID0gYXdhaXQgYXBpLnBpY2tGaWxlKHtcclxuICAgIHRpdGxlOiAgICdDaG9vc2UgTExNIG1vZGVsIGZpbGUnLFxyXG4gICAgZmlsdGVyczogW3sgbmFtZTogJ0dHVUYgbW9kZWxzJywgZXh0ZW5zaW9uczogWydnZ3VmJ10gfV0sXHJcbiAgfSk7XHJcbiAgaWYgKGZpbGUpIHtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tbW9kZWwtcGF0aCcpLnZhbHVlID0gZmlsZTtcclxuICAgIHVwZGF0ZUxsbVdhcm4oKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FpLXByaXZhY3ktc2VsJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZSA9PiBvblByaXZhY3lNb2RlQ2hhbmdlKGUudGFyZ2V0LnZhbHVlKSk7XHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2NhbC1haS15ZXMnKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBvbkxvY2FsQWlDaG9pY2VDaGFuZ2UpO1xyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWktbm8nKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBvbkxvY2FsQWlDaG9pY2VDaGFuZ2UpO1xyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIHVwZGF0ZUxsbVdhcm4pO1xyXG5cclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY2hlY2stYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCByZWNoZWNrKTtcclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhcnQtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhcnQtYnRuJyk7XHJcbiAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcclxuICBidG4udGV4dENvbnRlbnQgPSAnUmVzdGFydGluZ+KApic7XHJcbiAgYXBpLnJlc3RhcnRBcHAoKTtcclxufSk7XHJcblxyXG5mdW5jdGlvbiBjb2xsZWN0Q29uZmlnKCkge1xyXG4gIGNvbnN0IGNob2ljZUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaW5wdXRbbmFtZT1cImxvY2FsLWFpLWNob2ljZVwiXTpjaGVja2VkJyk7XHJcbiAgY29uc3QgcmVjID0gKHN0YXR1cyAmJiBzdGF0dXMubG9jYWxNb2RlbFJlY29tbWVuZGF0aW9uKSB8fCB7fTtcclxuICByZXR1cm4ge1xyXG4gICAgcHJvamVjdERpcjogICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvamVjdC1kaXInKS52YWx1ZSxcclxuICAgIHdoaXNwZXJNb2RlbDogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3doaXNwZXItc2VsJykudmFsdWUsXHJcbiAgICB3aGlzcGVyTGFuZ3VhZ2U6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3aGlzcGVyLWxhbmctc2VsJykudmFsdWUsXHJcbiAgICBtb2RlbFByZWZldGNoOiAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb2RlbC1wcmVmZXRjaC1jaGsnKS5jaGVja2VkLFxyXG4gICAgYWlQcml2YWN5TW9kZTogICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWktcHJpdmFjeS1zZWwnKS52YWx1ZSxcclxuICAgIGxsbU1vZGVsUGF0aDogICAgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tbW9kZWwtcGF0aCcpLnZhbHVlIHx8ICcnKS50cmltKCksXHJcbiAgICBsb2NhbE1vZGVsQ2hvaWNlOiBjaG9pY2VFbCA/IGNob2ljZUVsLnZhbHVlIDogJ2xvY2FsJyxcclxuICAgIHJlY29tbWVuZGVkTW9kZWxJZDogcmVjLm1vZGVsSWQgfHwgJycsXHJcbiAgICBjb250ZW50UHJlc2V0OiAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250ZW50LXByZXNldC1zZWwnKS52YWx1ZSxcclxuICB9O1xyXG59XHJcblxyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVpdC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAvLyBRdWl0dGluZyBtaWQtaW5zdGFsbC9kb3dubG9hZCBzaWxlbnRseSBsb3NlcyBpdHMgcHJvZ3Jlc3MgKC5wYXJ0IHN3ZXB0IG9uIHRoZVxyXG4gIC8vIG5leHQgc3RhcnQpLCBzbyBjb25maXJtIGZpcnN0IHdoZW4gd29yayBpcyBpbiBmbGlnaHQuXHJcbiAgaWYgKChhbnlJbnN0YWxsaW5nKCkgfHwgZG93bmxvYWRpbmdHZ3VmKSAmJlxyXG4gICAgICAhd2luZG93LmNvbmZpcm0oJ0EgZG93bmxvYWQgaXMgc3RpbGwgcnVubmluZyAtIHF1aXQgYW55d2F5PyBZb3Ugd2lsbCBsb3NlIGl0cyBwcm9ncmVzcy4nKSkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICBpZiAocmVydW5Nb2RlKSBhcGkuY2xvc2UoKTsgICAgICAgICAgLy8gZGlzY2FyZCBjaGFuZ2VzLCBrZWVwIGFwcCBydW5uaW5nXHJcbiAgZWxzZSBpZiAobW9kZSA9PT0gJ3VwZGF0ZScpIGFwaS5za2lwKCk7IC8vIGxhdW5jaCB3aXRoIGV4aXN0aW5nIGNvbmZpZ1xyXG4gIGVsc2UgYXBpLnF1aXQoKTtcclxufSk7XHJcblxyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGF1bmNoLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsYXVuY2gtYnRuJyk7XHJcbiAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcclxuICBidG4udGV4dENvbnRlbnQgPSByZXJ1bk1vZGUgPyAnU2F2aW5n4oCmJyA6ICdTdGFydGluZ+KApic7XHJcbiAgYXBpLmNvbXBsZXRlKGNvbGxlY3RDb25maWcoKSk7XHJcbn0pO1xyXG5cclxuLy8g4pSA4pSAIGJvb3Qg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG5hcGkub25JbnN0YWxsUHJvZ3Jlc3Mob25JbnN0YWxsUHJvZ3Jlc3MpO1xyXG5hcGkub25HZ3VmRG93bmxvYWRQcm9ncmVzcyhvbkdndWZEb3dubG9hZFByb2dyZXNzKTtcclxuXHJcbmZ1bmN0aW9uIGFwcGx5T3NUaGVtZShzKSB7XHJcbiAgLy8gTWlycm9ycyB0aGUgc2hhcmVkIHRva2Vucy5jc3MgZGF0YS10aGVtZSBjb250cmFjdCAoc2VlIGluZGV4Lmh0bWwncyBpbmxpbmVcclxuICAvLyBwcmUtcGFpbnQgc2NyaXB0KSBzbyB0aGUgd2l6YXJkIGZvbGxvd3MgdGhlIHNhbWUgT1MgcHJlZmVyZW5jZSB0aGUgcGFja2FnZWRcclxuICAvLyBhcHAncyB3aW5kb3cgY2hyb21lIGRvZXMsIGluc3RlYWQgb2YgYWx3YXlzIHJlbmRlcmluZyB0aGUgZGFyayBwYWxldHRlLlxyXG4gIGlmIChzLm9zVGhlbWVJc0hpZ2hDb250cmFzdCkgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQudGhlbWUgPSAnaGlnaC1jb250cmFzdCc7XHJcbiAgZWxzZSBpZiAocy5vc1RoZW1lSXNMaWdodCkgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRhdGFzZXQudGhlbWUgPSAnbGlnaHQnO1xyXG59XHJcblxyXG4oYXN5bmMgKCkgPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBzID0gYXdhaXQgYXBpLmdldFN0YXR1cygpO1xyXG4gICAgYXBwbHlPc1RoZW1lKHMpO1xyXG4gICAgYXBwbHlEZWZhdWx0cyhzKTtcclxuICAgIHJlbmRlclNsb3RzKHMpO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpdGVtLWluaXQnKS5vdXRlckhUTUwgPVxyXG4gICAgICBgPGRpdiBjbGFzcz1cIml0ZW0gZXJyXCI+XHJcbiAgICAgICAgIDxkaXYgY2xhc3M9XCJpY29uXCI+4pyXPC9kaXY+XHJcbiAgICAgICAgIDxkaXYgY2xhc3M9XCJib2R5XCI+XHJcbiAgICAgICAgICAgPGRpdiBjbGFzcz1cInRpdGxlXCI+U2V0dXAgY2hlY2sgZmFpbGVkPC9kaXY+XHJcbiAgICAgICAgICAgPGRpdiBjbGFzcz1cImRlc2NcIj5Tb21ldGhpbmcgd2VudCB3cm9uZyB3aGlsZSBjaGVja2luZyB5b3VyIHNldHVwLiBUcnkgPGVtPlJlc3RhcnQgYXBwPC9lbT4gYmVsb3csIG9yIHF1aXQgYW5kIHJlbGF1bmNoLlxyXG4gICAgICAgICAgICAgPGRldGFpbHMgc3R5bGU9XCJtYXJnaW4tdG9wOjZweFwiPjxzdW1tYXJ5IHN0eWxlPVwiY3Vyc29yOnBvaW50ZXJcIj5UZWNobmljYWwgZGV0YWlsczwvc3VtbWFyeT4ke2VzYyhTdHJpbmcoZSkpfTwvZGV0YWlscz48L2Rpdj5cclxuICAgICAgICAgPC9kaXY+XHJcbiAgICAgICA8L2Rpdj5gO1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY2hlY2stYmFyJykuc3R5bGUuZGlzcGxheSA9ICcnO1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1YnRpdGxlJykudGV4dENvbnRlbnQgPSAnU29tZXRoaW5nIHdlbnQgd3JvbmcuJztcclxuICB9XHJcbn0pKCk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQUFBO0FBQUEsSUFDRSxlQUFpQjtBQUFBLElBQ2pCLG1CQUFxQjtBQUFBLE1BQ25CLElBQU07QUFBQSxNQUNOLGNBQWdCO0FBQUEsTUFDaEIsVUFBWTtBQUFBLE1BQ1osVUFBWTtBQUFBLE1BQ1osYUFBZTtBQUFBLE1BQ2YsU0FBVztBQUFBLE1BQ1gsU0FBVztBQUFBLE1BQ1gsS0FBTztBQUFBLElBQ1Q7QUFBQSxJQUNBLGdCQUFrQjtBQUFBLE1BQ2hCO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxJQUNGO0FBQUEsSUFDQSxtQkFBcUI7QUFBQSxNQUNuQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtB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
