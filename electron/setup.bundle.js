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
        option_text: "small - fast, decent quality (~465 MB download, ~1 GB VRAM)"
      },
      {
        id: "medium",
        blurb: "good balance",
        download: "~1.5 GB",
        vram: "~2.8 GB",
        option_text: "medium - good balance (~1.5 GB download, ~2.8 GB VRAM)"
      },
      {
        id: "large-v3",
        blurb: "best quality",
        download: "~2.9 GB",
        vram: "~4.2 GB",
        option_text: "large-v3 - best quality (~2.9 GB download, ~4.2 GB VRAM)"
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
    btn.disabled = blockedByFfmpeg || blockedByWork;
    btn.textContent = rerunMode ? "Apply & Close" : "Launch";
    hint.textContent = blockedByFfmpeg && status ? "FFmpeg is required before you can launch" : blockedByWork ? "Waiting for the download to finish…" : "";
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
      `Your NVIDIA GPU can transcribe much faster than the CPU. This one-time install adds the CUDA support libraries (cuBLAS + cuDNN, ~1 GB). You can keep using this window while it runs. (LLM scoring already uses your GPU - this only speeds up transcription.)`,
      `<button class="sm" id="install-btn-cuda-libs" data-install="cuda-libs">Speed up transcription (~1 GB)</button>
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
      if (btn) btn.disabled = false;
      done();
    } else if (typeof data.progress === "number") {
      if (fill) fill.style.width = data.progress + "%";
      if (msg) msg.textContent = `Downloading… ${data.progress}%`;
    }
  }
  function startInstall(slug) {
    const btn = document.getElementById(`install-btn-${slug}`);
    const msg = document.getElementById(`install-msg-${slug}`);
    if (btn) btn.disabled = true;
    if (msg) msg.textContent = "Starting…";
    installing[slug] = true;
    updateLaunchBtn();
    api.installPackage(slug);
  }
  function onInstallProgress(data) {
    const btn = document.getElementById(`install-btn-${data.slug}`);
    const msg = document.getElementById(`install-msg-${data.slug}`);
    if (data.done) {
      installing[data.slug] = false;
      if (data.slug === "cuda-libs") {
        status.cudaLibsInstalled = true;
        renderCudaSlot(status);
      }
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
    }
  });
  document.getElementById("browse-btn").addEventListener("click", async () => {
    const dir = await api.pickFolder();
    if (dir) document.getElementById("project-dir").value = dir;
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
  (async () => {
    try {
      const s = await api.getStatus();
      applyDefaults(s);
      renderSlots(s);
    } catch (e) {
      document.getElementById("item-init").outerHTML = `<div class="item err">
         <div class="icon">✗</div>
         <div class="body">
           <div class="title">Setup check failed</div>
           <div class="desc">${esc(String(e))}<br>Try <em>Restart app</em> below, or quit and relaunch.</div>
         </div>
       </div>`;
      document.getElementById("recheck-bar").style.display = "";
      document.getElementById("subtitle").textContent = "Something went wrong.";
    }
  })();
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2hhcmVkL2NhdGFsb2ctZGF0YS5qc29uIiwgIi4uL3l1dV9jbGlwL3dlYi9zdGF0aWMvc2hhcmVkL2VzY2FwZWh0bWwuanMiLCAiLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvd2hpc3BlcmxhbmcuanMiLCAic2V0dXAtcmVuZGVyZXIuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIntcbiAgXCJfZ2VuZXJhdGVkX2J5XCI6IFwieXV1LWRldiBzaGFyZWQtZGF0YVwiLFxuICBcInJlY29tbWVuZGVkX21vZGVsXCI6IHtcbiAgICBcImlkXCI6IFwicXdlbjIuNS03Yi1pbnN0cnVjdFwiLFxuICAgIFwiZGlzcGxheV9uYW1lXCI6IFwiUXdlbjIuNSA3QiBJbnN0cnVjdFwiLFxuICAgIFwiZmlsZW5hbWVcIjogXCJRd2VuMi41LTdCLUluc3RydWN0LVE0X0tfTS5nZ3VmXCIsXG4gICAgXCJnZ3VmX3VybFwiOiBcImh0dHBzOi8vaHVnZ2luZ2ZhY2UuY28vYmFydG93c2tpL1F3ZW4yLjUtN0ItSW5zdHJ1Y3QtR0dVRlwiLFxuICAgIFwicmVzb2x2ZV91cmxcIjogXCJodHRwczovL2h1Z2dpbmdmYWNlLmNvL2JhcnRvd3NraS9Rd2VuMi41LTdCLUluc3RydWN0LUdHVUYvcmVzb2x2ZS9tYWluL1F3ZW4yLjUtN0ItSW5zdHJ1Y3QtUTRfS19NLmdndWZcIixcbiAgICBcInNpemVfZ2JcIjogNC43LFxuICAgIFwibGljZW5jZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgICBcIndoeVwiOiBcIlN0cm9uZyBhbGwtcm91bmQgN0IgLSB0aGUgYmVzdCBsb2NhbCBkZWZhdWx0IGZvciBjbGlwIHNjb3JpbmcuXCJcbiAgfSxcbiAgXCJ3aGlzcGVyX21vZGVsc1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcInRpbnlcIixcbiAgICAgIFwiYmx1cmJcIjogXCJmYXN0ZXN0LCBsb3dlc3QgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn43NSBNQlwiLFxuICAgICAgXCJ2cmFtXCI6IG51bGwsXG4gICAgICBcIm9wdGlvbl90ZXh0XCI6IFwidGlueSAtIGZhc3Rlc3QsIGxvd2VzdCBxdWFsaXR5ICh+NzUgTUIgZG93bmxvYWQpXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJiYXNlXCIsXG4gICAgICBcImJsdXJiXCI6IFwiZmFzdCwgbG93ZXIgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn4xNDAgTUJcIixcbiAgICAgIFwidnJhbVwiOiBudWxsLFxuICAgICAgXCJvcHRpb25fdGV4dFwiOiBcImJhc2UgLSBmYXN0LCBsb3dlciBxdWFsaXR5ICh+MTQwIE1CIGRvd25sb2FkKVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwic21hbGxcIixcbiAgICAgIFwiYmx1cmJcIjogXCJmYXN0LCBkZWNlbnQgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn40NjUgTUJcIixcbiAgICAgIFwidnJhbVwiOiBcIn4xIEdCXCIsXG4gICAgICBcIm9wdGlvbl90ZXh0XCI6IFwic21hbGwgLSBmYXN0LCBkZWNlbnQgcXVhbGl0eSAofjQ2NSBNQiBkb3dubG9hZCwgfjEgR0IgVlJBTSlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIm1lZGl1bVwiLFxuICAgICAgXCJibHVyYlwiOiBcImdvb2QgYmFsYW5jZVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn4xLjUgR0JcIixcbiAgICAgIFwidnJhbVwiOiBcIn4yLjggR0JcIixcbiAgICAgIFwib3B0aW9uX3RleHRcIjogXCJtZWRpdW0gLSBnb29kIGJhbGFuY2UgKH4xLjUgR0IgZG93bmxvYWQsIH4yLjggR0IgVlJBTSlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImxhcmdlLXYzXCIsXG4gICAgICBcImJsdXJiXCI6IFwiYmVzdCBxdWFsaXR5XCIsXG4gICAgICBcImRvd25sb2FkXCI6IFwifjIuOSBHQlwiLFxuICAgICAgXCJ2cmFtXCI6IFwifjQuMiBHQlwiLFxuICAgICAgXCJvcHRpb25fdGV4dFwiOiBcImxhcmdlLXYzIC0gYmVzdCBxdWFsaXR5ICh+Mi45IEdCIGRvd25sb2FkLCB+NC4yIEdCIFZSQU0pXCJcbiAgICB9XG4gIF0sXG4gIFwid2hpc3Blcl9sYW5ndWFnZXNcIjogW1xuICAgIFwiYWZcIixcbiAgICBcImFtXCIsXG4gICAgXCJhclwiLFxuICAgIFwiYXNcIixcbiAgICBcImF6XCIsXG4gICAgXCJiYVwiLFxuICAgIFwiYmVcIixcbiAgICBcImJnXCIsXG4gICAgXCJiblwiLFxuICAgIFwiYm9cIixcbiAgICBcImJyXCIsXG4gICAgXCJic1wiLFxuICAgIFwiY2FcIixcbiAgICBcImNzXCIsXG4gICAgXCJjeVwiLFxuICAgIFwiZGFcIixcbiAgICBcImRlXCIsXG4gICAgXCJlbFwiLFxuICAgIFwiZW5cIixcbiAgICBcImVzXCIsXG4gICAgXCJldFwiLFxuICAgIFwiZXVcIixcbiAgICBcImZhXCIsXG4gICAgXCJmaVwiLFxuICAgIFwiZm9cIixcbiAgICBcImZyXCIsXG4gICAgXCJnbFwiLFxuICAgIFwiZ3VcIixcbiAgICBcImhhXCIsXG4gICAgXCJoYXdcIixcbiAgICBcImhlXCIsXG4gICAgXCJoaVwiLFxuICAgIFwiaHJcIixcbiAgICBcImh0XCIsXG4gICAgXCJodVwiLFxuICAgIFwiaHlcIixcbiAgICBcImlkXCIsXG4gICAgXCJpc1wiLFxuICAgIFwiaXRcIixcbiAgICBcImphXCIsXG4gICAgXCJqd1wiLFxuICAgIFwia2FcIixcbiAgICBcImtrXCIsXG4gICAgXCJrbVwiLFxuICAgIFwia25cIixcbiAgICBcImtvXCIsXG4gICAgXCJsYVwiLFxuICAgIFwibGJcIixcbiAgICBcImxuXCIsXG4gICAgXCJsb1wiLFxuICAgIFwibHRcIixcbiAgICBcImx2XCIsXG4gICAgXCJtZ1wiLFxuICAgIFwibWlcIixcbiAgICBcIm1rXCIsXG4gICAgXCJtbFwiLFxuICAgIFwibW5cIixcbiAgICBcIm1yXCIsXG4gICAgXCJtc1wiLFxuICAgIFwibXRcIixcbiAgICBcIm15XCIsXG4gICAgXCJuZVwiLFxuICAgIFwibmxcIixcbiAgICBcIm5uXCIsXG4gICAgXCJub1wiLFxuICAgIFwib2NcIixcbiAgICBcInBhXCIsXG4gICAgXCJwbFwiLFxuICAgIFwicHNcIixcbiAgICBcInB0XCIsXG4gICAgXCJyb1wiLFxuICAgIFwicnVcIixcbiAgICBcInNhXCIsXG4gICAgXCJzZFwiLFxuICAgIFwic2lcIixcbiAgICBcInNrXCIsXG4gICAgXCJzbFwiLFxuICAgIFwic25cIixcbiAgICBcInNvXCIsXG4gICAgXCJzcVwiLFxuICAgIFwic3JcIixcbiAgICBcInN1XCIsXG4gICAgXCJzdlwiLFxuICAgIFwic3dcIixcbiAgICBcInRhXCIsXG4gICAgXCJ0ZVwiLFxuICAgIFwidGdcIixcbiAgICBcInRoXCIsXG4gICAgXCJ0a1wiLFxuICAgIFwidGxcIixcbiAgICBcInRyXCIsXG4gICAgXCJ0dFwiLFxuICAgIFwidWtcIixcbiAgICBcInVyXCIsXG4gICAgXCJ1elwiLFxuICAgIFwidmlcIixcbiAgICBcInlpXCIsXG4gICAgXCJ5b1wiLFxuICAgIFwiemhcIlxuICBdLFxuICBcImNvbnRlbnRfcHJlc2V0c1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcImdlbmVyaWNcIixcbiAgICAgIFwibmFtZVwiOiBcIkdlbmVyaWNcIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJCYWxhbmNlZCBkZWZhdWx0IC0gbm8gY29udGVudC1zcGVjaWZpYyB0dW5pbmcuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJycC1uYXJyYXRpdmVcIixcbiAgICAgIFwibmFtZVwiOiBcIlJQIC8gbmFycmF0aXZlXCIsXG4gICAgICBcImRlc2NyaXB0aW9uXCI6IFwiUm9sZXBsYXkgb3Igc3RvcnktZHJpdmVuIHNlc3Npb25zIC0gY2hhcmFjdGVyIGFuZCBkcmFtYSBmaXJzdC5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImNvbXBldGl0aXZlXCIsXG4gICAgICBcIm5hbWVcIjogXCJDb21wZXRpdGl2ZSBnYW1pbmdcIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJSYW5rZWQgb3IgY29tcGV0aXRpdmUgcGxheSAtIGNsdXRjaGVzLCBjb21lYmFja3MsIGFuZCBjYWxsb3V0cy5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImNhc3VhbFwiLFxuICAgICAgXCJuYW1lXCI6IFwiQ2FzdWFsIC8gbGV0J3MgcGxheVwiLFxuICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlJlbGF4ZWQgbGV0J3MtcGxheXMgLSBwZXJzb25hbGl0eSwgcmVhY3Rpb25zLCBhbmQgZnVubnkgZmFpbHVyZXMuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJzcGVlZHJ1blwiLFxuICAgICAgXCJuYW1lXCI6IFwiU3BlZWRydW5cIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJSdW5zIGFnYWluc3QgdGhlIGNsb2NrIC0gc3BsaXRzLCBQQnMsIGFuZCBoZWFydGJyZWFrIHJlc2V0cy5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcInBvZGNhc3RcIixcbiAgICAgIFwibmFtZVwiOiBcIlBvZGNhc3QgLyBjb252ZXJzYXRpb25cIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJUYWxrLWRyaXZlbiBzZXNzaW9ucyAtIHF1b3RlcywgaG90IHRha2VzLCBhbmQgc2hhcmVkIGxhdWdodGVyLlwiXG4gICAgfVxuICBdLFxuICBcImFpX3ByaXZhY3lfb3B0aW9uc1wiOiBbXG4gICAge1xuICAgICAgXCJ2YWx1ZVwiOiBcIm5vbmVcIixcbiAgICAgIFwibGFiZWxcIjogXCJObyBnZW5lcmF0aXZlIEFJIC0gbm8gbGFuZ3VhZ2UgbW9kZWwgcnVuc1wiXG4gICAgfSxcbiAgICB7XG4gICAgICBcInZhbHVlXCI6IFwibG9jYWxfb25seVwiLFxuICAgICAgXCJsYWJlbFwiOiBcIkxvY2FsIG1vZGVscyBvbmx5IC0gbm90aGluZyBsZWF2ZXMgeW91ciBtYWNoaW5lIChyZWNvbW1lbmRlZClcIlxuICAgIH1cbiAgXSxcbiAgXCJhaV9wcml2YWN5X25vdGVzXCI6IHtcbiAgICBcIm5vbmVcIjogXCJObyBsYW5ndWFnZSBtb2RlbCBydW5zLiBDbGlwcyBhcmUgc3RpbGwgZm91bmQgYW5kIHNlYXJjaGFibGU7IHNjb3JpbmcgdXNlcyBsaWdodHdlaWdodCBzaWduYWxzIG9ubHkuXCIsXG4gICAgXCJsb2NhbF9vbmx5XCI6IFwiT24tZGV2aWNlIG1vZGVscyBvbmx5LiBFdmVyeXRoaW5nIHJ1bnMgbG9jYWxseSAtIG5vdGhpbmcgeW91IHJlY29yZCBpcyBzZW50IGFueXdoZXJlLlwiXG4gIH1cbn1cbiIsICIvLyBUcmFuc3BvcnQtYWdub3N0aWMgSFRNTCBlc2NhcGVyLCBzaGFyZWQgYnkgdGhlIHdlYiBhcHAgYW5kIHRoZSBFbGVjdHJvbiBzZXR1cFxuLy8gd2l6YXJkIChlYWNoIGltcG9ydHMgaXQgdGhyb3VnaCBpdHMgb3duIGVzYnVpbGQgYnVuZGxlIC0gc2VlIEFSQ0hJVEVDVFVSRSBsYW5kbWluZVxuLy8gIzIncyBib3VuZGFyeSBydWxlOiBzaGFyZWQgbW9kdWxlcyB0YWtlIGRhdGEsIG5ldmVyIGZldGNoIG9yIElQQykuIEVzY2FwZXMgJiA8ID4gXCJcbi8vIHNvIGEgdmFsdWUgaXMgc2FmZSBib3RoIGFzIHRleHQgYW5kIGluc2lkZSBhIGRvdWJsZS1xdW90ZWQgYXR0cmlidXRlLlxuZXhwb3J0IGZ1bmN0aW9uIGVzY0h0bWwocykge1xuICByZXR1cm4gU3RyaW5nKHMpXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG59XG4iLCAiaW1wb3J0IHsgZXNjSHRtbCB9IGZyb20gJy4vZXNjYXBlaHRtbC5qcyc7XG5cbi8vIFRoZSB0cmFuc2NyaXB0aW9uLWxhbmd1YWdlIDxvcHRpb24+IGxpc3QsIHNoYXJlZCBieSB3ZWIgU2V0dGluZ3MgYW5kIHRoZSBzZXR1cFxuLy8gd2l6YXJkOiBhbiBcIkF1dG8tZGV0ZWN0XCIgZGVmYXVsdCBmaXJzdCwgdGhlbiBldmVyeSBhbGxvd2VkIGxhbmd1YWdlIGNvZGUgcmVuZGVyZWRcbi8vIHdpdGggaXRzIEVuZ2xpc2ggZGlzcGxheSBuYW1lIChJbnRsLkRpc3BsYXlOYW1lcykgYW5kIHNvcnRlZCBieSB0aGF0IG5hbWUuIFB1cmUgLVxuLy8gaXQgdGFrZXMgdGhlIGNvZGUgbGlzdCBhbmQgcmV0dXJucyBIVE1MOyBpdCBuZXZlciBmZXRjaGVzIHRoZSBsaXN0IG9yIHJlYWRzIGNvbmZpZ1xuLy8gKHRoZSBjYWxsZXIgc3VwcGxpZXMgSFRUUC1iYWNrZWQgb3IgY2F0YWxvZy1iYWNrZWQgY29kZXMpLlxuZXhwb3J0IGZ1bmN0aW9uIGxhbmd1YWdlT3B0aW9uc0h0bWwoY29kZXMpIHtcbiAgbGV0IG5hbWVPZiA9IGNvZGUgPT4gY29kZTtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXNwbGF5TmFtZXMgPSBuZXcgSW50bC5EaXNwbGF5TmFtZXMoWydlbiddLCB7IHR5cGU6ICdsYW5ndWFnZScgfSk7XG4gICAgbmFtZU9mID0gY29kZSA9PiB7XG4gICAgICB0cnkgeyByZXR1cm4gZGlzcGxheU5hbWVzLm9mKGNvZGUpIHx8IGNvZGU7IH0gY2F0Y2ggeyByZXR1cm4gY29kZTsgfVxuICAgIH07XG4gIH0gY2F0Y2ggeyAvKiBJbnRsLkRpc3BsYXlOYW1lcyB1bmF2YWlsYWJsZSAtIGZhbGwgYmFjayB0byByYXcgY29kZXMgKi8gfVxuICBjb25zdCBuYW1lZCA9IChjb2RlcyB8fCBbXSlcbiAgICAubWFwKGNvZGUgPT4gKHsgY29kZSwgbmFtZTogbmFtZU9mKGNvZGUpIH0pKVxuICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcbiAgcmV0dXJuICc8b3B0aW9uIHZhbHVlPVwiXCI+QXV0by1kZXRlY3QgKHJlY29tbWVuZGVkKTwvb3B0aW9uPicgK1xuICAgIG5hbWVkLm1hcChvID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2NIdG1sKG8uY29kZSl9XCI+JHtlc2NIdG1sKG8ubmFtZSl9PC9vcHRpb24+YCkuam9pbignJyk7XG59XG4iLCAiJ3VzZSBzdHJpY3QnO1xyXG5cclxuLy8gU2V0dXAtd2l6YXJkIHJlbmRlcmVyLCBidW5kbGVkIGJ5IGVzYnVpbGQgaW50byB0aGUgY29tbWl0dGVkIGVsZWN0cm9uL3NldHVwLmJ1bmRsZS5qc1xyXG4vLyAoc2Vjb25kIGVudHJ5IGluIHNjcmlwdHMvYnVpbGQtZXNtLm1qcykuIFdhcyBpbmxpbmUgaW4gc2V0dXAuaHRtbDsgZXh0cmFjdGVkIHNvIHRoZVxyXG4vLyB3aXphcmQgY2FuIGltcG9ydCB0aGUgU0FNRSBzaGFyZWQgbW9kdWxlcyB0aGUgd2ViIGFwcCB1c2VzIChlc2NIdG1sLCB0aGUgbGFuZ3VhZ2VcclxuLy8gPG9wdGlvbj4gYnVpbGRlcikgYW5kIHRoZSBnZW5lcmF0ZWQgY2F0YWxvZyBzdHJhaWdodCBmcm9tIHRoZSBQeXRob24gc291cmNlIG9mIHRydXRoLlxyXG4vLyBCb3VuZGFyeSBydWxlOiBzaGFyZWQgbW9kdWxlcyB0YWtlIGRhdGEgKyBjYWxsYmFja3MsIG5ldmVyIGZldGNoL0lQQyAtIHRoZSB3aXphcmRcclxuLy8gZmVlZHMgdGhlbSBJUEMtYmFja2VkIHN0YXRlICh3aW5kb3cuc2V0dXBBUEkpLCBTZXR0aW5ncyBmZWVkcyBIVFRQLWJhY2tlZCBzdGF0ZS5cclxuaW1wb3J0IGNhdGFsb2cgZnJvbSAnLi9zaGFyZWQvY2F0YWxvZy1kYXRhLmpzb24nO1xyXG5pbXBvcnQgeyBlc2NIdG1sIH0gZnJvbSAnLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvZXNjYXBlaHRtbC5qcyc7XHJcbmltcG9ydCB7IGxhbmd1YWdlT3B0aW9uc0h0bWwgfSBmcm9tICcuLi95dXVfY2xpcC93ZWIvc3RhdGljL3NoYXJlZC93aGlzcGVybGFuZy5qcyc7XHJcblxyXG5jb25zdCBhcGkgICAgPSB3aW5kb3cuc2V0dXBBUEk7XHJcbmNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7XHJcbmNvbnN0IG1vZGUgICA9IHBhcmFtcy5nZXQoJ21vZGUnKSB8fCAnaW5pdGlhbCc7ICAgLy8gJ2luaXRpYWwnIHwgJ3JlcnVuJyB8ICd1cGRhdGUnXHJcbmNvbnN0IHJlcnVuTW9kZSA9IG1vZGUgPT09ICdyZXJ1bic7XHJcblxyXG4vLyBTaGFyZWQgY2F0YWxvZyBmYWN0cyBnZW5lcmF0ZWQgZnJvbSB0aGUgUHl0aG9uIHNvdXJjZXMgb2YgdHJ1dGggYnlcclxuLy8gYHl1dS1kZXYgc2hhcmVkLWRhdGFgIChleHBvc2VkIHZpYSBzZXR1cC1wcmVsb2FkLmpzKS4gV2hpc3BlciBsYW5ndWFnZXMgKyBtb2RlbHMsXHJcbi8vIGNvbnRlbnQgcHJlc2V0cywgQUktcHJpdmFjeSBjb3B5LCBhbmQgdGhlIHJlY29tbWVuZGVkIG1vZGVsIGFyZSBzaW5nbGUtc291cmNlZCBoZXJlXHJcbi8vIHJhdGhlciB0aGFuIGhhbmQtbWFpbnRhaW5lZCBpbiB0aGlzIGZpbGUuXHJcbmNvbnN0IENBVEFMT0cgPSBjYXRhbG9nO1xyXG5jb25zdCBXSElTUEVSX0xBTkdVQUdFUyA9IENBVEFMT0cud2hpc3Blcl9sYW5ndWFnZXMgfHwgW107XHJcblxyXG5sZXQgc3RhdHVzICA9IG51bGw7XHJcbmxldCBpbnN0YWxsaW5nID0geyAnY3VkYS1saWJzJzogZmFsc2UgfTtcclxubGV0IGRvd25sb2FkaW5nR2d1ZiA9IGZhbHNlO1xyXG5sZXQgZGVmYXVsdHNBcHBsaWVkID0gZmFsc2U7XHJcblxyXG4vLyDilIDilIAgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbmNvbnN0IGVzYyA9IGVzY0h0bWw7XHJcblxyXG5mdW5jdGlvbiBhbnlJbnN0YWxsaW5nKCkgeyByZXR1cm4gaW5zdGFsbGluZ1snY3VkYS1saWJzJ107IH1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZUxhdW5jaEJ0bigpIHtcclxuICBjb25zdCBidG4gID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xhdW5jaC1idG4nKTtcclxuICBjb25zdCBoaW50ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xhdW5jaC1oaW50Jyk7XHJcbiAgY29uc3QgYmxvY2tlZEJ5RmZtcGVnICA9ICFzdGF0dXMgfHwgIXN0YXR1cy5mZm1wZWdPaztcclxuICBjb25zdCBibG9ja2VkQnlXb3JrICAgID0gYW55SW5zdGFsbGluZygpIHx8IGRvd25sb2FkaW5nR2d1ZjtcclxuICBidG4uZGlzYWJsZWQgPSBibG9ja2VkQnlGZm1wZWcgfHwgYmxvY2tlZEJ5V29yaztcclxuICBidG4udGV4dENvbnRlbnQgPSByZXJ1bk1vZGUgPyAnQXBwbHkgJiBDbG9zZScgOiAnTGF1bmNoJztcclxuICBoaW50LnRleHRDb250ZW50ID0gYmxvY2tlZEJ5RmZtcGVnICYmIHN0YXR1cyA/ICdGRm1wZWcgaXMgcmVxdWlyZWQgYmVmb3JlIHlvdSBjYW4gbGF1bmNoJ1xyXG4gICAgOiBibG9ja2VkQnlXb3JrID8gJ1dhaXRpbmcgZm9yIHRoZSBkb3dubG9hZCB0byBmaW5pc2jigKYnXHJcbiAgICA6ICcnO1xyXG4gIGNvbnN0IHJlY2hlY2sgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1idG4nKTtcclxuICBjb25zdCByZXN0YXJ0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhcnQtYnRuJyk7XHJcbiAgaWYgKHJlY2hlY2spIHJlY2hlY2suZGlzYWJsZWQgPSBibG9ja2VkQnlXb3JrO1xyXG4gIGlmIChyZXN0YXJ0KSByZXN0YXJ0LmRpc2FibGVkID0gYmxvY2tlZEJ5V29yaztcclxufVxyXG5cclxuZnVuY3Rpb24gcm93KGlkLCBjbHMsIGljb24sIHRpdGxlLCBkZXNjSHRtbCwgYWN0aW9uSHRtbCA9ICcnKSB7XHJcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiaXRlbSAke2Nsc31cIiBpZD1cIml0ZW0tJHtlc2MoaWQpfVwiPlxyXG4gICAgPGRpdiBjbGFzcz1cImljb25cIj4ke2ljb259PC9kaXY+XHJcbiAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxyXG4gICAgICA8ZGl2IGNsYXNzPVwidGl0bGVcIj4ke2VzYyh0aXRsZSl9PC9kaXY+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJkZXNjXCI+JHtkZXNjSHRtbH08L2Rpdj5cclxuICAgICAgJHthY3Rpb25IdG1sID8gYDxkaXYgY2xhc3M9XCJhY3Rpb25cIj4ke2FjdGlvbkh0bWx9PC9kaXY+YCA6ICcnfVxyXG4gICAgPC9kaXY+XHJcbiAgPC9kaXY+YDtcclxufVxyXG5cclxuLy8g4pSA4pSAIGR5bmFtaWMgc3RhdHVzIHNsb3RzIChpbnB1dHMgbGl2ZSBvdXRzaWRlIHRoZXNlLCBzbyBhIHJlLWNoZWNrIG5ldmVyXHJcbi8vICAgIHdpcGVzIGFueXRoaW5nIHRoZSB1c2VyIHR5cGVkKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbmZ1bmN0aW9uIHJlbmRlckZmbXBlZ1Nsb3Qocykge1xyXG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZmbXBlZy1zbG90Jyk7XHJcbiAgaWYgKHMuZmZtcGVnQnVuZGxlZCkge1xyXG4gICAgaWYgKHMuZmZtcGVnT2spIHtcclxuICAgICAgZWwuaW5uZXJIVE1MID0gcm93KCdmZm1wZWcnLCAnb2snLCAn4pyTJywgJ0ZGbXBlZycsICdJbmNsdWRlZCB3aXRoIFl1dUNsaXAuIFVzZWQgdG8gcmVhZCBhbmQgY3V0IHZpZGVvIGZpbGVzLicpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBlbC5pbm5lckhUTUwgPSByb3coJ2ZmbXBlZycsICdlcnInLCAn4pyXJywgJ0ZGbXBlZyBpbnN0YWxsIGlzIGRhbWFnZWQnLFxyXG4gICAgICAnVGhlIEZGbXBlZyBidW5kbGVkIHdpdGggWXV1Q2xpcCBpcyBtaXNzaW5nIG9yIGRhbWFnZWQuIFRyeSByZWluc3RhbGxpbmcgWXV1Q2xpcDsgJyArXHJcbiAgICAgICdpZiB0aGUgcHJvYmxlbSBwZXJzaXN0cywgcGxlYXNlIHJlcG9ydCBpdC4nKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgaWYgKHMuZmZtcGVnT2spIHtcclxuICAgIGVsLmlubmVySFRNTCA9IHJvdygnZmZtcGVnJywgJ29rJywgJ+KckycsICdGRm1wZWcnLCAnRm91bmQgb24gUEFUSC4gVXNlZCB0byByZWFkIGFuZCBjdXQgdmlkZW8gZmlsZXMuJyk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIGVsLmlubmVySFRNTCA9IHJvdygnZmZtcGVnJywgJ2VycicsICfinJcnLCAnRkZtcGVnIG5vdCBmb3VuZCcsXHJcbiAgICAnWXV1Q2xpcCBuZWVkcyBGRm1wZWcgdG8gcmVhZCBhbmQgY3V0IHZpZGVvIGZpbGVzLjxicj4nICtcclxuICAgICc8c3Ryb25nPkVhc2llc3Q6PC9zdHJvbmc+IHJ1biB0aGlzIGNvbW1hbmQgaW4gYSB0ZXJtaW5hbCAoU3RhcnQg4oaSIHR5cGUgPGVtPnRlcm1pbmFsPC9lbT4pLCAnICtcclxuICAgICd0aGVuIGNsaWNrIDxlbT5DaGVjayBhZ2FpbjwvZW0+IGJlbG93IC0gbm8gbmVlZCB0byBjbG9zZSB0aGlzIHdpbmRvdy4nICtcclxuICAgICc8ZGV0YWlscz48c3VtbWFyeT5DYW5cXCd0IHVzZSB3aW5nZXQ/IE1hbnVhbCBpbnN0YWxsIHN0ZXBzPC9zdW1tYXJ5PicgK1xyXG4gICAgJ09wZW4gZ3lhbi5kZXYgKGJ1dHRvbiBiZWxvdyksIGRvd25sb2FkIDxlbT5mZm1wZWctcmVsZWFzZS1lc3NlbnRpYWxzLnppcDwvZW0+IChvciBhIDxlbT5DVURBPC9lbT4gYnVpbGQgZm9yIE5WSURJQSBHUFVzKS4gJyArXHJcbiAgICAnRXh0cmFjdCB0aGUgemlwIHRvIGEgcGVybWFuZW50IGZvbGRlciAoZS5nLiA8Y29kZT5DOlxcXFxmZm1wZWc8L2NvZGU+KSwgdGhlbiBhZGQgaXRzIDxjb2RlPmJpblxcXFw8L2NvZGU+IHN1YmZvbGRlciB0byBQQVRIOjxicj4nICtcclxuICAgICcxLiBPcGVuIFN0YXJ0IOKGkiBzZWFyY2ggPGVtPkVkaXQgdGhlIHN5c3RlbSBlbnZpcm9ubWVudCB2YXJpYWJsZXM8L2VtPiDihpIgY2xpY2sgaXQ8YnI+JyArXHJcbiAgICAnMi4gQ2xpY2sgPGVtPkVudmlyb25tZW50IFZhcmlhYmxlczwvZW0+PGJyPicgK1xyXG4gICAgJzMuIFVuZGVyIDxlbT5TeXN0ZW0gdmFyaWFibGVzPC9lbT4sIHNlbGVjdCA8ZW0+UGF0aDwvZW0+IOKGkiBjbGljayA8ZW0+RWRpdDwvZW0+PGJyPicgK1xyXG4gICAgJzQuIENsaWNrIDxlbT5OZXc8L2VtPiDihpIgcGFzdGUgdGhlIGZ1bGwgcGF0aCB0byB0aGUgPGNvZGU+YmluXFxcXDwvY29kZT4gZm9sZGVyIChlLmcuIDxjb2RlPkM6XFxcXGZmbXBlZ1xcXFxiaW48L2NvZGU+KTxicj4nICtcclxuICAgICc1LiBDbGljayBPSyBvbiBhbGwgZGlhbG9ncywgdGhlbiBjbGljayA8ZW0+Q2hlY2sgYWdhaW48L2VtPiBiZWxvdy4nICtcclxuICAgICc8L2RldGFpbHM+JyxcclxuICAgIGA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDo2cHg7YWxpZ24taXRlbXM6Y2VudGVyO3dpZHRoOjEwMCVcIj5gICtcclxuICAgICAgYDxjb2RlIHN0eWxlPVwiZmxleDoxXCI+d2luZ2V0IGluc3RhbGwgR3lhbi5GRm1wZWc8L2NvZGU+YCArXHJcbiAgICAgIGA8YnV0dG9uIGNsYXNzPVwic21cIiBkYXRhLWNvcHk9XCJ3aW5nZXQgaW5zdGFsbCBHeWFuLkZGbXBlZ1wiPkNvcHk8L2J1dHRvbj5gICtcclxuICAgICAgYDxidXR0b24gY2xhc3M9XCJzbVwiIGRhdGEtb3Blbi11cmw9XCJodHRwczovL3d3dy5neWFuLmRldi9mZm1wZWcvYnVpbGRzL1wiPk9wZW4gZ3lhbi5kZXY8L2J1dHRvbj5gICtcclxuICAgIGA8L2Rpdj5gXHJcbiAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVuZGVyR3B1TGluZShzKSB7XHJcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ3B1LWxpbmUnKTtcclxuICBpZiAocy5ncHUubmFtZSA9PT0gJ1Vua25vd24nKSB7XHJcbiAgICBlbC50ZXh0Q29udGVudCA9ICdObyBkaXNjcmV0ZSBHUFUgZGV0ZWN0ZWQgLSBhbmFseXNpcyBydW5zIG9uIHRoZSBDUFUgKHNsb3dlciwgYnV0IHdvcmtzKS4nO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICAvLyBMTE0gc2NvcmluZyBydW5zIG9uIGFueSB2ZW5kb3IncyBHUFUgKHZpYSB0aGUgYnVuZGxlZCBWdWxrYW4gZW5naW5lKTsgb25seVxyXG4gIC8vIFdoaXNwZXIgdHJhbnNjcmlwdGlvbiBpcyBOVklESUEvQ1VEQS1vbmx5LCBzbyB0aGUgdHdvIGFyZSByZXBvcnRlZCBzZXBhcmF0ZWx5LlxyXG4gIGNvbnN0IGdwdSA9IGBEZXRlY3RlZCBHUFU6ICR7cy5ncHUubmFtZX0gKCR7cy5ncHUudnJhbU1CLnRvTG9jYWxlU3RyaW5nKCl9IE1CIFZSQU0pYDtcclxuICBpZiAocy5ncHUudmVuZG9yID09PSAnbnZpZGlhJykge1xyXG4gICAgY29uc3QgaGFzVmVyc2lvbiA9IHMuY3VkYS52ZXJzaW9uICYmIHMuY3VkYS52ZXJzaW9uICE9PSAndW5rbm93bic7XHJcbiAgICBjb25zdCBjdWRhTGFiZWwgPSBoYXNWZXJzaW9uID8gYENVREEgJHtzLmN1ZGEudmVyc2lvbn1gIDogJ0NVREEgZGV0ZWN0ZWQnO1xyXG4gICAgZWwudGV4dENvbnRlbnQgPSBzLmN1ZGEuYXZhaWxhYmxlXHJcbiAgICAgID8gYCR7Z3B1fSAtICR7Y3VkYUxhYmVsfS4gWW91ciBHUFUgc3BlZWRzIHVwIGJvdGggdHJhbnNjcmlwdGlvbiBhbmQgTExNIHNjb3JpbmcuYFxyXG4gICAgICA6IGAke2dwdX0gLSB5b3VyIEdQVSBzcGVlZHMgdXAgTExNIHNjb3JpbmcuIEFkZCBDVURBIChiZWxvdykgdG8gYWxzbyBzcGVlZCB1cCB0cmFuc2NyaXB0aW9uLmA7XHJcbiAgfSBlbHNlIHtcclxuICAgIGVsLnRleHRDb250ZW50ID0gYCR7Z3B1fSAtIHlvdXIgR1BVIHNwZWVkcyB1cCBMTE0gc2NvcmluZy4gVHJhbnNjcmlwdGlvbiBydW5zIG9uIHRoZSBDUFUgKEdQVSB0cmFuc2NyaXB0aW9uIG5lZWRzIGFuIE5WSURJQSBjYXJkKS5gO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcmVuZGVyQ3VkYVNsb3Qocykge1xyXG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2N1ZGEtc2xvdCcpO1xyXG4gIC8vIFNob3cgdGhlIFwiT3B0aW9uYWxcIiBzZWN0aW9uIGhlYWRlciBvbmx5IHdoZW4gaXQgaGFzIGEgdmlzaWJsZSByb3c7IGFuIGVtcHR5XHJcbiAgLy8gdGl0bGVkIHNlY3Rpb24gKGUuZy4gb24gYSBub24tTlZJRElBIG1hY2hpbmUsIHdoZXJlIENVREEgaXMgdGhlIG9ubHkgb3B0aW9uYWxcclxuICAvLyBpdGVtKSByZWFkcyBhcyBhIGxvYWQgZXJyb3IuXHJcbiAgY29uc3Qgc2V0U2xvdCA9IChodG1sKSA9PiB7XHJcbiAgICBlbC5pbm5lckhUTUwgPSBodG1sO1xyXG4gICAgY29uc3Qgc2VjdGlvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcHRpb25hbC1zZWN0aW9uJyk7XHJcbiAgICBpZiAoc2VjdGlvbikgc2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gaHRtbCA/ICcnIDogJ25vbmUnO1xyXG4gIH07XHJcbiAgaWYgKHMuZ3B1LnZlbmRvciAhPT0gJ252aWRpYScpIHsgc2V0U2xvdCgnJyk7IHJldHVybjsgfVxyXG4gIGlmIChzLmN1ZGFMaWJzSW5zdGFsbGVkIHx8IHMuY3VkYS5hdmFpbGFibGUpIHtcclxuICAgIHNldFNsb3Qocm93KCdjdWRhJywgJ29rJywgJ+KckycsICdGYXN0ZXIgdHJhbnNjcmlwdGlvbiByZWFkeScsXHJcbiAgICAgICdUaGUgQ1VEQSBzdXBwb3J0IGxpYnJhcmllcyBhcmUgYXZhaWxhYmxlIC0gdHJhbnNjcmlwdGlvbiBydW5zIG9uIHlvdXIgTlZJRElBIEdQVS4nKSk7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHNldFNsb3Qocm93KCdjdWRhJywgJ3dhcm4nLCAn4peLJywgJ0Zhc3RlciB0cmFuc2NyaXB0aW9uIChvcHRpb25hbCknLFxyXG4gICAgYFlvdXIgTlZJRElBIEdQVSBjYW4gdHJhbnNjcmliZSBtdWNoIGZhc3RlciB0aGFuIHRoZSBDUFUuIFRoaXMgb25lLXRpbWUgaW5zdGFsbCBgICtcclxuICAgIGBhZGRzIHRoZSBDVURBIHN1cHBvcnQgbGlicmFyaWVzIChjdUJMQVMgKyBjdUROTiwgfjEgR0IpLiBZb3UgY2FuIGtlZXAgdXNpbmcgdGhpcyBgICtcclxuICAgIGB3aW5kb3cgd2hpbGUgaXQgcnVucy4gKExMTSBzY29yaW5nIGFscmVhZHkgdXNlcyB5b3VyIEdQVSAtIHRoaXMgb25seSBzcGVlZHMgdXAgdHJhbnNjcmlwdGlvbi4pYCxcclxuICAgIGA8YnV0dG9uIGNsYXNzPVwic21cIiBpZD1cImluc3RhbGwtYnRuLWN1ZGEtbGlic1wiIGRhdGEtaW5zdGFsbD1cImN1ZGEtbGlic1wiPlNwZWVkIHVwIHRyYW5zY3JpcHRpb24gKH4xIEdCKTwvYnV0dG9uPlxyXG4gICAgIDxkaXYgY2xhc3M9XCJwdWxsLW1zZ1wiIGlkPVwiaW5zdGFsbC1tc2ctY3VkYS1saWJzXCI+PC9kaXY+YCkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW5kZXJHZ3VmRG93bmxvYWRTbG90KHMpIHtcclxuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLXNsb3QnKTtcclxuICBpZiAoIWVsKSByZXR1cm47XHJcbiAgaWYgKGRvd25sb2FkaW5nR2d1ZikgcmV0dXJuOyAvLyBwcmVzZXJ2ZSB0aGUgaW4tcHJvZ3Jlc3MgYmFyIGFjcm9zcyBhIHN0YXR1cyByZS1yZW5kZXJcclxuICBjb25zdCBjdXJyZW50UGF0aCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSB8fCAnJykudHJpbSgpO1xyXG4gIGlmIChjdXJyZW50UGF0aCkgeyBlbC5pbm5lckhUTUwgPSAnJzsgcmV0dXJuOyB9XHJcbiAgY29uc3QgcmVjID0gQ0FUQUxPRy5yZWNvbW1lbmRlZF9tb2RlbCB8fCB7fTtcclxuICBjb25zdCByZWNOYW1lID0gcmVjLmRpc3BsYXlfbmFtZSB8fCAndGhlIHJlY29tbWVuZGVkIG1vZGVsJztcclxuICBjb25zdCByZWNTaXplID0gcmVjLnNpemVfZ2IgIT0gbnVsbCA/IGB+JHtyZWMuc2l6ZV9nYn0gR0JgIDogJyc7XHJcbiAgZWwuaW5uZXJIVE1MID0gcm93KCdnZ3VmLWRvd25sb2FkJywgJ3dhcm4nLCAn4peLJywgJ0Rvd25sb2FkIHRoZSByZWNvbW1lbmRlZCBtb2RlbCcsXHJcbiAgICBgJHtlc2MocmVjTmFtZSl9ICgke2VzYyhyZWMubGljZW5jZSB8fCAnJyl9LCBzbyBjbGlwcyB5b3UgbWFrZSBjYW4gYmUgbW9uZXRpemVkKWAgK1xyXG4gICAgYCR7cmVjU2l6ZSA/ICcsICcgKyByZWNTaXplIDogJyd9LiBZb3UgY2FuIGtlZXAgdXNpbmcgdGhpcyB3aW5kb3cgd2hpbGUgaXQgZG93bmxvYWRzLmAsXHJcbiAgICBgPGJ1dHRvbiBjbGFzcz1cInNtXCIgaWQ9XCJnZ3VmLWRvd25sb2FkLWJ0blwiIGRhdGEtYWN0aW9uPVwiZ2d1Zi1kb3dubG9hZFwiPkRvd25sb2FkIHJlY29tbWVuZGVkIG1vZGVsJHtyZWNTaXplID8gJyAoJyArIGVzYyhyZWNTaXplKSArICcpJyA6ICcnfTwvYnV0dG9uPlxyXG4gICAgIDxidXR0b24gY2xhc3M9XCJzbVwiIGlkPVwiZ2d1Zi1jYW5jZWwtYnRuXCIgZGF0YS1hY3Rpb249XCJnZ3VmLWNhbmNlbFwiIHN0eWxlPVwiZGlzcGxheTpub25lXCI+Q2FuY2VsPC9idXR0b24+XHJcbiAgICAgPGRpdiBjbGFzcz1cInB1bGwtYmFyXCIgaWQ9XCJnZ3VmLWRvd25sb2FkLWJhclwiIHN0eWxlPVwiZGlzcGxheTpub25lO3dpZHRoOjEwMCU7bWFyZ2luLXRvcDo1cHhcIj48ZGl2IGNsYXNzPVwicHVsbC1maWxsXCIgaWQ9XCJnZ3VmLWRvd25sb2FkLWZpbGxcIj48L2Rpdj48L2Rpdj5cclxuICAgICA8ZGl2IGNsYXNzPVwicHVsbC1tc2dcIiBpZD1cImdndWYtZG93bmxvYWQtbXNnXCI+PC9kaXY+YCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlbmRlclNsb3RzKHMpIHtcclxuICBzdGF0dXMgPSBzO1xyXG4gIHJlbmRlckZmbXBlZ1Nsb3Qocyk7XHJcbiAgcmVuZGVyR3B1TGluZShzKTtcclxuICByZW5kZXJDdWRhU2xvdChzKTtcclxuICByZW5kZXJHZ3VmRG93bmxvYWRTbG90KHMpO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJ0aXRsZScpLnRleHRDb250ZW50ID1cclxuICAgIG1vZGUgPT09ICd1cGRhdGUnID8gJ1RoaXMgdXBkYXRlIGFkZGVkIG5ldyBzZXR1cCBvcHRpb25zIC0gcmV2aWV3LCB0aGVuIGxhdW5jaC4nXHJcbiAgICA6IHMuZmZtcGVnT2sgPyAnU3lzdGVtIGNoZWNrIGNvbXBsZXRlLidcclxuICAgIDogJ0FjdGlvbiByZXF1aXJlZCBiZWZvcmUgeW91IGNhbiBsYXVuY2guJztcclxuICB1cGRhdGVMYXVuY2hCdG4oKTtcclxufVxyXG5cclxuLy8gQnVpbGQgdGhlIHdoaXNwZXIgLyBBSS1wcml2YWN5IC8gY29udGVudC1wcmVzZXQgPG9wdGlvbj4gbGlzdHMgZnJvbSB0aGUgc2hhcmVkXHJcbi8vIGNhdGFsb2cgc28gdGhlaXIgY29weSBpcyBzaW5nbGUtc291cmNlZCAoc2VlIGB5dXUtZGV2IHNoYXJlZC1kYXRhYCkuIFJ1bnMgb25jZSxcclxuLy8gYmVmb3JlIGFwcGx5RGVmYXVsdHMgc2V0cyB0aGUgc2F2ZWQgdmFsdWVzLlxyXG5mdW5jdGlvbiBwb3B1bGF0ZUNhdGFsb2dTZWxlY3RzKCkge1xyXG4gIGNvbnN0IGZpbGwgPSAoaWQsIGl0ZW1zLCB2YWx1ZSwgbGFiZWwpID0+IHtcclxuICAgIGNvbnN0IHNlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtcclxuICAgIGlmICghc2VsKSByZXR1cm47XHJcbiAgICBzZWwuaW5uZXJIVE1MID0gaXRlbXNcclxuICAgICAgLm1hcChpdCA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKHZhbHVlKGl0KSl9XCI+JHtlc2MobGFiZWwoaXQpKX08L29wdGlvbj5gKVxyXG4gICAgICAuam9pbignJyk7XHJcbiAgfTtcclxuICBmaWxsKCd3aGlzcGVyLXNlbCcsIENBVEFMT0cud2hpc3Blcl9tb2RlbHMgfHwgW10sIG0gPT4gbS5pZCwgbSA9PiBtLm9wdGlvbl90ZXh0KTtcclxuICBmaWxsKCdhaS1wcml2YWN5LXNlbCcsIENBVEFMT0cuYWlfcHJpdmFjeV9vcHRpb25zIHx8IFtdLCBvID0+IG8udmFsdWUsIG8gPT4gby5sYWJlbCk7XHJcbiAgZmlsbCgnY29udGVudC1wcmVzZXQtc2VsJywgQ0FUQUxPRy5jb250ZW50X3ByZXNldHMgfHwgW10sIHAgPT4gcC5pZCwgcCA9PiBwLm5hbWUpO1xyXG5cclxuICBjb25zdCByZWMgPSBDQVRBTE9HLnJlY29tbWVuZGVkX21vZGVsIHx8IHt9O1xyXG4gIGNvbnN0IHNpemVUZXh0ID0gcmVjLnNpemVfZ2IgIT0gbnVsbCA/IGAke3JlYy5zaXplX2difSBHQmAgOiAnJztcclxuICBjb25zdCBzZXRUZXh0ID0gKGlkLCB0ZXh0KSA9PiB7IGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpOyBpZiAoZWwgJiYgdGV4dCkgZWwudGV4dENvbnRlbnQgPSB0ZXh0OyB9O1xyXG4gIHNldFRleHQoJ3JlYy1tb2RlbC1zaXplLWlubGluZScsIHNpemVUZXh0KTtcclxuICBzZXRUZXh0KCdyZWMtbW9kZWwtc2l6ZS1hZHYnLCBzaXplVGV4dCk7XHJcbn1cclxuXHJcbi8vIEZpcnN0IHJlbmRlciBvbmx5OiBmaWxsIHRoZSBmb3JtIGZyb20gc2F2ZWQgY29uZmlnIC8gZGV0ZWN0ZWQgZGVmYXVsdHMuXHJcbmZ1bmN0aW9uIGFwcGx5RGVmYXVsdHMocykge1xyXG4gIGlmIChkZWZhdWx0c0FwcGxpZWQpIHJldHVybjtcclxuICBkZWZhdWx0c0FwcGxpZWQgPSB0cnVlO1xyXG5cclxuICBwb3B1bGF0ZUNhdGFsb2dTZWxlY3RzKCk7XHJcblxyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9qZWN0LWRpcicpLnZhbHVlID0gcy5wcm9qZWN0RGlyO1xyXG4gIGNvbnN0IHdoaXNwZXJTZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2hpc3Blci1zZWwnKTtcclxuICB3aGlzcGVyU2VsLnZhbHVlID0gcy53aGlzcGVyTW9kZWwgfHwgcy5yZWNvbW1lbmRlZFdoaXNwZXIubW9kZWw7XHJcbiAgaWYgKCF3aGlzcGVyU2VsLnZhbHVlKSB3aGlzcGVyU2VsLnZhbHVlID0gcy5yZWNvbW1lbmRlZFdoaXNwZXIubW9kZWw7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlYy10YWcnKS50ZXh0Q29udGVudCA9ICfihpAgcmVjb21tZW5kZWQnO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWMtdGFnJykudGl0bGUgPSBzLnJlY29tbWVuZGVkV2hpc3Blci5yZWFzb247XHJcblxyXG4gIGNvbnN0IGxhbmdTZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2hpc3Blci1sYW5nLXNlbCcpO1xyXG4gIGxhbmdTZWwuaW5uZXJIVE1MID0gbGFuZ3VhZ2VPcHRpb25zSHRtbChXSElTUEVSX0xBTkdVQUdFUyk7XHJcbiAgbGFuZ1NlbC52YWx1ZSA9IFdISVNQRVJfTEFOR1VBR0VTLmluY2x1ZGVzKHMud2hpc3Blckxhbmd1YWdlKSA/IHMud2hpc3Blckxhbmd1YWdlIDogJyc7XHJcblxyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaS1wcml2YWN5LXNlbCcpLnZhbHVlID0gcy5haVByaXZhY3lNb2RlIHx8ICdsb2NhbF9vbmx5JztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSAgPSBzLmxsbU1vZGVsUGF0aCB8fCAnJztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGVudC1wcmVzZXQtc2VsJykudmFsdWUgPSBzLmNvbnRlbnRQcmVzZXQgfHwgJ2dlbmVyaWMnO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250ZW50LXByZXNldC1ub3RlJykudGV4dENvbnRlbnQgPVxyXG4gICAgJ05vdCBzdXJlPyBHZW5lcmljIGlzIGEgZ29vZCBkZWZhdWx0LiBZb3UgY2FuIGZpbmUtdHVuZSBldmVyeSBzY29yaW5nIHdlaWdodCBsYXRlciBpbiBTZXR0aW5ncy4nO1xyXG5cclxuICBjb25zdCByZWMgPSBzLmxvY2FsTW9kZWxSZWNvbW1lbmRhdGlvbiB8fCB7fTtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLXJlYy1oZWFkbGluZScpLnRleHRDb250ZW50ID0gcmVjLmhlYWRsaW5lIHx8ICcnO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tcmVjLXJlYXNvbicpLnRleHRDb250ZW50ICAgPSByZWMucmVhc29uIHx8ICcnO1xyXG4gIC8vIFByZS1zZWxlY3QgbG9jYWwgQUkgYXMgdGhlIHJlY29tbWVuZGVkIHBhdGggdW5sZXNzIHRoZSBtYWNoaW5lIGNhbid0IGZpdCB0aGVcclxuICAvLyBtb2RlbCAocHVzaCAnbm9uZScpOyBhbiBleGlzdGluZyBtb2RlbCBmaWxlIGFsc28ga2VlcHMgbG9jYWwgc2VsZWN0ZWQgKHRoZVxyXG4gIC8vIGJ1aWxkIHN0ZXAgd29uJ3QgcmUtcXVldWUgYSBkb3dubG9hZCB3aGVuIGEgcGF0aCBpcyBhbHJlYWR5IHNldCkuXHJcbiAgY29uc3QgaGFzRXhpc3RpbmdNb2RlbCA9IEJvb2xlYW4oKHMubGxtTW9kZWxQYXRoIHx8ICcnKS50cmltKCkpO1xyXG4gIGNvbnN0IHByZWZlckxvY2FsID0gaGFzRXhpc3RpbmdNb2RlbCB8fCByZWMucHVzaCA9PT0gJ3N0cm9uZycgfHwgcmVjLnB1c2ggPT09ICdzb2Z0JztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWkteWVzJykuY2hlY2tlZCA9IHByZWZlckxvY2FsO1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2NhbC1haS1ubycpLmNoZWNrZWQgID0gIXByZWZlckxvY2FsO1xyXG4gIG9uTG9jYWxBaUNob2ljZUNoYW5nZSgpO1xyXG5cclxuICBvblByaXZhY3lNb2RlQ2hhbmdlKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaS1wcml2YWN5LXNlbCcpLnZhbHVlKTtcclxuXHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2l0ZW0taW5pdCcpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlY3Rpb25zJykuc3R5bGUuZGlzcGxheSAgPSAnJztcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1iYXInKS5zdHlsZS5kaXNwbGF5ID0gJyc7XHJcbiAgaWYgKHJlcnVuTW9kZSkgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlcnVuLW5vdGUnKS5zdHlsZS5kaXNwbGF5ID0gJyc7XHJcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3F1aXQtYnRuJykudGV4dENvbnRlbnQgPVxyXG4gICAgcmVydW5Nb2RlID8gJ0Nsb3NlJyA6IG1vZGUgPT09ICd1cGRhdGUnID8gJ1NraXAgZm9yIG5vdycgOiAnUXVpdCc7XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBBSSBwcml2YWN5ICsgbG9jYWwgbW9kZWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4vLyB5dXUtY2xpcCBpcyBsb2NhbC1vbmx5OyB0aGUgbW9kZSB0b2dnbGVzIHdoZXRoZXIgYSBnZW5lcmF0aXZlIG1vZGVsIHJ1bnMgYXQgYWxsLlxyXG4vLyBDb3B5IGNvbWVzIGZyb20gdGhlIHNoYXJlZCBjYXRhbG9nIChzaW5nbGUgc291cmNlIGZvciB0aGUgd2l6YXJkICsgd2ViIFNldHRpbmdzKS5cclxuY29uc3QgQUlfUFJJVkFDWV9OT1RFUyA9IENBVEFMT0cuYWlfcHJpdmFjeV9ub3RlcyB8fCB7fTtcclxuXHJcbmZ1bmN0aW9uIG9uUHJpdmFjeU1vZGVDaGFuZ2UobW9kZSkge1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaS1wcml2YWN5LW5vdGUnKS50ZXh0Q29udGVudCA9IEFJX1BSSVZBQ1lfTk9URVNbbW9kZV0gfHwgJyc7XHJcbiAgY29uc3QgbGxtQmxvY2sgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLWdlbmVyYXRpdmUtYmxvY2snKTtcclxuICBpZiAobGxtQmxvY2spIGxsbUJsb2NrLnN0eWxlLmRpc3BsYXkgPSBtb2RlID09PSAnbm9uZScgPyAnbm9uZScgOiAnJztcclxuICB1cGRhdGVMbG1XYXJuKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZUxsbVdhcm4oKSB7XHJcbiAgY29uc3QgZmlsZVBhdGggPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykudmFsdWUgfHwgJycpLnRyaW0oKTtcclxuICBjb25zdCB3YW50c0xvY2FsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLXllcycpLmNoZWNrZWQ7XHJcbiAgLy8gV2l0aCBcIlNldCB1cCBsb2NhbCBBSVwiIGNob3NlbiwgdGhlIHJlY29tbWVuZGVkIG1vZGVsIGlzIHF1ZXVlZCBmb3IgYSBiYWNrZ3JvdW5kXHJcbiAgLy8gZG93bmxvYWQgb24gbGF1bmNoIC0gc28gXCJMTE0gc2NvcmluZyB3aWxsIGJlIHNraXBwZWRcIiB3b3VsZCBiZSB3cm9uZy4gT25seSB3YXJuXHJcbiAgLy8gd2hlbiB0aGVyZSdzIG5vIGZpbGUsIG5vdGhpbmcgZG93bmxvYWRpbmcsIGFuZCBubyBiYWNrZ3JvdW5kIGRvd25sb2FkIGNvbWluZy5cclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLXdhcm4nKS5zdHlsZS5kaXNwbGF5ID1cclxuICAgICghZmlsZVBhdGggJiYgIWRvd25sb2FkaW5nR2d1ZiAmJiAhd2FudHNMb2NhbCkgPyAnYmxvY2snIDogJ25vbmUnO1xyXG4gIGlmIChzdGF0dXMpIHJlbmRlckdndWZEb3dubG9hZFNsb3Qoc3RhdHVzKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25Mb2NhbEFpQ2hvaWNlQ2hhbmdlKCkge1xyXG4gIGNvbnN0IGxpZ2h0d2VpZ2h0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLW5vJykuY2hlY2tlZDtcclxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGlnaHR3ZWlnaHQtbm90ZScpLnN0eWxlLmRpc3BsYXkgPSBsaWdodHdlaWdodCA/ICcnIDogJ25vbmUnO1xyXG4gIC8vIFRoZSBjaG9pY2UgZ292ZXJucyB3aGV0aGVyIHRoZSBMTE0gbW9kZWwgaXMgcXVldWVkIGZvciBhIGJhY2tncm91bmQgZG93bmxvYWQsXHJcbiAgLy8gd2hpY2ggZGVjaWRlcyB3aGV0aGVyIHRoZSBcIndpbGwgYmUgc2tpcHBlZFwiIHdhcm5pbmcgaXMgYWNjdXJhdGUgLSBrZWVwIGl0IGluIHN5bmMuXHJcbiAgdXBkYXRlTGxtV2FybigpO1xyXG59XHJcblxyXG4vLyDilIDilIAgR0dVRiBtb2RlbCBvbmUtY2xpY2sgZG93bmxvYWQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG5mdW5jdGlvbiBzdGFydEdndWZEb3dubG9hZCgpIHtcclxuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1kb3dubG9hZC1idG4nKTtcclxuICBjb25zdCBjYW5jZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1jYW5jZWwtYnRuJyk7XHJcbiAgY29uc3QgYmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtZG93bmxvYWQtYmFyJyk7XHJcbiAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gdHJ1ZTtcclxuICBpZiAoY2FuY2VsKSB7IGNhbmNlbC5zdHlsZS5kaXNwbGF5ID0gJyc7IGNhbmNlbC5kaXNhYmxlZCA9IGZhbHNlOyB9XHJcbiAgaWYgKGJhcikgYmFyLnN0eWxlLmRpc3BsYXkgPSAnJztcclxuICBkb3dubG9hZGluZ0dndWYgPSB0cnVlO1xyXG4gIHVwZGF0ZUxhdW5jaEJ0bigpO1xyXG4gIHVwZGF0ZUxsbVdhcm4oKTsgLy8gaGlkZSB0aGUgXCJubyBtb2RlbCBmaWxlIGNob3NlblwiIHdhcm5pbmcgd2hpbGUgdGhlIGRvd25sb2FkIHJ1bnNcclxuICBhcGkuZG93bmxvYWRHZ3VmTW9kZWwoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY2FuY2VsR2d1ZkRvd25sb2FkKCkge1xyXG4gIGNvbnN0IGNhbmNlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWNhbmNlbC1idG4nKTtcclxuICBpZiAoY2FuY2VsKSBjYW5jZWwuZGlzYWJsZWQgPSB0cnVlO1xyXG4gIGFwaS5jYW5jZWxHZ3VmRG93bmxvYWQoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25HZ3VmRG93bmxvYWRQcm9ncmVzcyhkYXRhKSB7XHJcbiAgY29uc3QgZmlsbCAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtZG93bmxvYWQtZmlsbCcpO1xyXG4gIGNvbnN0IG1zZyAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLW1zZycpO1xyXG4gIGNvbnN0IGJ0biAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLWJ0bicpO1xyXG4gIGNvbnN0IGNhbmNlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWNhbmNlbC1idG4nKTtcclxuICBjb25zdCBkb25lID0gKCkgPT4geyBkb3dubG9hZGluZ0dndWYgPSBmYWxzZTsgaWYgKGNhbmNlbCkgY2FuY2VsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IHVwZGF0ZUxhdW5jaEJ0bigpOyB1cGRhdGVMbG1XYXJuKCk7IH07XHJcbiAgaWYgKGRhdGEuZG9uZSkge1xyXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykudmFsdWUgPSBkYXRhLnBhdGg7XHJcbiAgICB1cGRhdGVMbG1XYXJuKCk7IC8vIGFsc28gcmUtcmVuZGVycyB0aGUgZG93bmxvYWQgc2xvdCwgbm93IGhpZGRlbiBzaW5jZSB0aGUgcGF0aCBpcyBzZXRcclxuICAgIGRvbmUoKTtcclxuICB9IGVsc2UgaWYgKGRhdGEuY2FuY2VsbGVkKSB7XHJcbiAgICBpZiAobXNnKSBtc2cudGV4dENvbnRlbnQgPSAnRG93bmxvYWQgY2FuY2VsbGVkLic7XHJcbiAgICBpZiAoZmlsbCkgZmlsbC5zdHlsZS53aWR0aCA9ICcwJSc7XHJcbiAgICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgIGRvbmUoKTtcclxuICB9IGVsc2UgaWYgKGRhdGEuZXJyb3IpIHtcclxuICAgIGlmIChtc2cpIG1zZy50ZXh0Q29udGVudCA9IGBEb3dubG9hZCBmYWlsZWQ6ICR7ZGF0YS5lcnJvcn1gO1xyXG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICBkb25lKCk7XHJcbiAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YS5wcm9ncmVzcyA9PT0gJ251bWJlcicpIHtcclxuICAgIGlmIChmaWxsKSBmaWxsLnN0eWxlLndpZHRoID0gZGF0YS5wcm9ncmVzcyArICclJztcclxuICAgIGlmIChtc2cpICBtc2cudGV4dENvbnRlbnQgID0gYERvd25sb2FkaW5n4oCmICR7ZGF0YS5wcm9ncmVzc30lYDtcclxuICB9XHJcbn1cclxuXHJcbi8vIOKUgOKUgCBvcHRpb25hbCBwYWNrYWdlIGluc3RhbGxzIChwaXAgaW50byB0aGUgdmVudikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG5mdW5jdGlvbiBzdGFydEluc3RhbGwoc2x1Zykge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBpbnN0YWxsLWJ0bi0ke3NsdWd9YCk7XHJcbiAgY29uc3QgbXNnID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGluc3RhbGwtbXNnLSR7c2x1Z31gKTtcclxuICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gIGlmIChtc2cpIG1zZy50ZXh0Q29udGVudCA9ICdTdGFydGluZ+KApic7XHJcbiAgaW5zdGFsbGluZ1tzbHVnXSA9IHRydWU7XHJcbiAgdXBkYXRlTGF1bmNoQnRuKCk7XHJcbiAgYXBpLmluc3RhbGxQYWNrYWdlKHNsdWcpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbkluc3RhbGxQcm9ncmVzcyhkYXRhKSB7XHJcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGluc3RhbGwtYnRuLSR7ZGF0YS5zbHVnfWApO1xyXG4gIGNvbnN0IG1zZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBpbnN0YWxsLW1zZy0ke2RhdGEuc2x1Z31gKTtcclxuICBpZiAoZGF0YS5kb25lKSB7XHJcbiAgICBpbnN0YWxsaW5nW2RhdGEuc2x1Z10gPSBmYWxzZTtcclxuICAgIGlmIChkYXRhLnNsdWcgPT09ICdjdWRhLWxpYnMnKSB7IHN0YXR1cy5jdWRhTGlic0luc3RhbGxlZCA9IHRydWU7IHJlbmRlckN1ZGFTbG90KHN0YXR1cyk7IH1cclxuICAgIHVwZGF0ZUxhdW5jaEJ0bigpO1xyXG4gIH0gZWxzZSBpZiAoZGF0YS5lcnJvcikge1xyXG4gICAgaW5zdGFsbGluZ1tkYXRhLnNsdWddID0gZmFsc2U7XHJcbiAgICAvLyBHUFUgYWNjZWxlcmF0aW9uIGlzIG5ldmVyIHJlcXVpcmVkIC0gcmVhc3N1cmUgdGhlIHVzZXIgdGhleSBjYW4gc3RpbGwgbGF1bmNoLlxyXG4gICAgY29uc3QgY3B1Tm90ZSA9IGRhdGEuc2x1ZyA9PT0gJ2N1ZGEtbGlicydcclxuICAgICAgPyAnIFlvdSBjYW4gc3RpbGwgbGF1bmNoIC0gdHJhbnNjcmlwdGlvbiB3aWxsIHJ1biBvbiB0aGUgQ1BVLidcclxuICAgICAgOiAnJztcclxuICAgIGlmIChtc2cpIG1zZy50ZXh0Q29udGVudCA9IGBJbnN0YWxsIGZhaWxlZDogJHtkYXRhLmVycm9yfSR7Y3B1Tm90ZX1gO1xyXG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICB1cGRhdGVMYXVuY2hCdG4oKTtcclxuICB9IGVsc2UgaWYgKGRhdGEuc3RhdHVzKSB7XHJcbiAgICBpZiAobXNnKSBtc2cudGV4dENvbnRlbnQgPSBkYXRhLnN0YXR1cztcclxuICB9XHJcbn1cclxuXHJcbi8vIOKUgOKUgCByZS1jaGVjayAvIHJlc3RhcnQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG5hc3luYyBmdW5jdGlvbiByZWNoZWNrKCkge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNoZWNrLWJ0bicpO1xyXG4gIGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgY29uc3Qgb3JpZ2luYWwgPSBidG4udGV4dENvbnRlbnQ7XHJcbiAgYnRuLnRleHRDb250ZW50ID0gJ0NoZWNraW5n4oCmJztcclxuICB0cnkge1xyXG4gICAgcmVuZGVyU2xvdHMoYXdhaXQgYXBpLmdldFN0YXR1cygpKTtcclxuICB9IGZpbmFsbHkge1xyXG4gICAgYnRuLnRleHRDb250ZW50ID0gb3JpZ2luYWw7XHJcbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgIHVwZGF0ZUxhdW5jaEJ0bigpO1xyXG4gIH1cclxufVxyXG5cclxuLy8g4pSA4pSAIFVJIGV2ZW50cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbi8vIEV2ZW50IGRlbGVnYXRpb24gZm9yIGV2ZXJ5IGJ1dHRvbiBpbmplY3RlZCB2aWEgaW5uZXJIVE1MIChzbG90cyByZS1yZW5kZXIgb24gZWFjaFxyXG4vLyBzdGF0dXMgcmVmcmVzaCkuIElubGluZSBvbi1ldmVudCBoYW5kbGVycyBjYW4ndCBiZSB1c2VkIGhlcmU6IHRoaXMgZmlsZSBpcyBidW5kbGVkXHJcbi8vIGludG8gYW4gSUlGRSwgc28gbW9kdWxlLXNjb3BlZCBmdW5jdGlvbnMgbGlrZSBzdGFydEdndWZEb3dubG9hZCBhcmUgbmVpdGhlciBnbG9iYWxcclxuLy8gKGlubGluZSBoYW5kbGVycyByZXNvbHZlIG9uIHdpbmRvdykgbm9yIGV2ZW4gcHJlc2VudCAoZXNidWlsZCB0cmVlLXNoYWtlcyBmdW5jdGlvbnNcclxuLy8gcmVmZXJlbmNlZCBvbmx5IGZyb20gc3RyaW5nIGxpdGVyYWxzKS4gVGhlIHN0YXRpYyBndWFyZCBpblxyXG4vLyB0ZXN0L3NldHVwLXJlbmRlcmVyLWhhbmRsZXJzLnRlc3QuanMga2VlcHMgaW5saW5lIGhhbmRsZXJzIGZyb20gY3JlZXBpbmcgYmFjay5cclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcclxuICBjb25zdCBjb3B5QnRuID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtY29weV0nKTtcclxuICBpZiAoY29weUJ0bikge1xyXG4gICAgYXBpLmNvcHlUZXh0KGNvcHlCdG4uZGF0YXNldC5jb3B5KTtcclxuICAgIGNvbnN0IG9yaWdpbmFsID0gY29weUJ0bi50ZXh0Q29udGVudDtcclxuICAgIGNvcHlCdG4udGV4dENvbnRlbnQgPSAnQ29waWVkISc7XHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHsgY29weUJ0bi50ZXh0Q29udGVudCA9IG9yaWdpbmFsOyB9LCAxMjAwKTtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgY29uc3QgdXJsQnRuID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtb3Blbi11cmxdJyk7XHJcbiAgaWYgKHVybEJ0bikgeyBhcGkub3BlblVSTCh1cmxCdG4uZGF0YXNldC5vcGVuVXJsKTsgcmV0dXJuOyB9XHJcbiAgY29uc3QgaW5zdGFsbEJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWluc3RhbGxdJyk7XHJcbiAgaWYgKGluc3RhbGxCdG4pIHsgc3RhcnRJbnN0YWxsKGluc3RhbGxCdG4uZGF0YXNldC5pbnN0YWxsKTsgcmV0dXJuOyB9XHJcbiAgY29uc3QgYWN0aW9uQnRuID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0aW9uXScpO1xyXG4gIGlmIChhY3Rpb25CdG4pIHtcclxuICAgIGlmIChhY3Rpb25CdG4uZGF0YXNldC5hY3Rpb24gPT09ICdnZ3VmLWRvd25sb2FkJykgc3RhcnRHZ3VmRG93bmxvYWQoKTtcclxuICAgIGVsc2UgaWYgKGFjdGlvbkJ0bi5kYXRhc2V0LmFjdGlvbiA9PT0gJ2dndWYtY2FuY2VsJykgY2FuY2VsR2d1ZkRvd25sb2FkKCk7XHJcbiAgfVxyXG59KTtcclxuXHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdicm93c2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgY29uc3QgZGlyID0gYXdhaXQgYXBpLnBpY2tGb2xkZXIoKTtcclxuICBpZiAoZGlyKSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvamVjdC1kaXInKS52YWx1ZSA9IGRpcjtcclxufSk7XHJcblxyXG4vLyBSZXN0b3JlLWZyb20tYmFja3VwIGlzIGEgZmlyc3QtcnVuIGNob2ljZSBvbmx5OiByZXJ1bi91cGRhdGUgYWxyZWFkeSBoYXZlIGFcclxuLy8gbGl2ZSBwcm9qZWN0LCBhbmQgcmVzdG9yaW5nIG92ZXIgaXQgYmVsb25ncyBpbiB0aGUgaW4tYXBwIFNldHRpbmdzIGZsb3cuXHJcbmlmIChtb2RlID09PSAnaW5pdGlhbCcpIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0b3JlLXJvdycpLnN0eWxlLmRpc3BsYXkgPSAnJztcclxuXHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0b3JlLWJhY2t1cC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcclxuICBjb25zdCBhcmNoaXZlID0gYXdhaXQgYXBpLnBpY2tGaWxlKHtcclxuICAgIHRpdGxlOiAgICdDaG9vc2UgYSBZdXVDbGlwIGJhY2t1cCcsXHJcbiAgICBmaWx0ZXJzOiBbeyBuYW1lOiAnWXV1Q2xpcCBiYWNrdXAnLCBleHRlbnNpb25zOiBbJ3ppcCddIH1dLFxyXG4gIH0pO1xyXG4gIGlmICghYXJjaGl2ZSkgcmV0dXJuO1xyXG4gIGNvbnN0IHRhcmdldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9qZWN0LWRpcicpLnZhbHVlO1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0b3JlLWJhY2t1cC1idG4nKTtcclxuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gIGJ0bi50ZXh0Q29udGVudCA9ICdSZXN0b3JpbmfigKYnO1xyXG4gIGxldCByZXN1bHQ7XHJcbiAgdHJ5IHtcclxuICAgIHJlc3VsdCA9IGF3YWl0IGFwaS5yZXN0b3JlQmFja3VwKHsgYXJjaGl2ZSwgcHJvamVjdDogdGFyZ2V0IH0pO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIHJlc3VsdCA9IHsgb2s6IGZhbHNlLCBlcnJvcjogU3RyaW5nKGUgJiYgZS5tZXNzYWdlIHx8IGUpIH07XHJcbiAgfVxyXG4gIGlmIChyZXN1bHQub2spIHtcclxuICAgIC8vIExhdW5jaCBzdHJhaWdodCBpbnRvIHRoZSByZXN0b3JlZCBwcm9qZWN0OyBjb21wbGV0ZSgpIHNraXBzIHRoZSB3aXphcmRcclxuICAgIC8vIGNvbmZpZyB3cml0ZSBzbyB0aGUgYmFja3VwJ3Mgb3duIHNldHRpbmdzIHN1cnZpdmUgKG1haW4uanM6IGNmZy5yZXN0b3JlZCkuXHJcbiAgICBidG4udGV4dENvbnRlbnQgPSAnUmVzdG9yZWQgLSBzdGFydGluZ+KApic7XHJcbiAgICBhcGkuY29tcGxldGUoeyBwcm9qZWN0RGlyOiB0YXJnZXQsIHJlc3RvcmVkOiB0cnVlIH0pO1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuICAvLyBPbiBmYWlsdXJlIChub3QgYSBjYW5jZWxsZWQgcmVwbGFjZSkgbWFpbi5qcyBoYXMgYWxyZWFkeSBzaG93biBhbiBlcnJvclxyXG4gIC8vIGRpYWxvZzsganVzdCByZXNldCB0aGUgYnV0dG9uIHNvIHRoZSB1c2VyIGNhbiB0cnkgYW5vdGhlciBmaWxlLlxyXG4gIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gIGJ0bi50ZXh0Q29udGVudCA9ICdSZXN0b3JlIGZyb20gYSBiYWNrdXAgaW5zdGVhZOKApic7XHJcbn0pO1xyXG5cclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1icm93c2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XHJcbiAgY29uc3QgZmlsZSA9IGF3YWl0IGFwaS5waWNrRmlsZSh7XHJcbiAgICB0aXRsZTogICAnQ2hvb3NlIExMTSBtb2RlbCBmaWxlJyxcclxuICAgIGZpbHRlcnM6IFt7IG5hbWU6ICdHR1VGIG1vZGVscycsIGV4dGVuc2lvbnM6IFsnZ2d1ZiddIH1dLFxyXG4gIH0pO1xyXG4gIGlmIChmaWxlKSB7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSA9IGZpbGU7XHJcbiAgICB1cGRhdGVMbG1XYXJuKCk7XHJcbiAgfVxyXG59KTtcclxuXHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaS1wcml2YWN5LXNlbCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGUgPT4gb25Qcml2YWN5TW9kZUNoYW5nZShlLnRhcmdldC52YWx1ZSkpO1xyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWkteWVzJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgb25Mb2NhbEFpQ2hvaWNlQ2hhbmdlKTtcclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLW5vJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgb25Mb2NhbEFpQ2hvaWNlQ2hhbmdlKTtcclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCB1cGRhdGVMbG1XYXJuKTtcclxuXHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNoZWNrLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcmVjaGVjayk7XHJcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXJ0LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXJ0LWJ0bicpO1xyXG4gIGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgYnRuLnRleHRDb250ZW50ID0gJ1Jlc3RhcnRpbmfigKYnO1xyXG4gIGFwaS5yZXN0YXJ0QXBwKCk7XHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gY29sbGVjdENvbmZpZygpIHtcclxuICBjb25zdCBjaG9pY2VFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W25hbWU9XCJsb2NhbC1haS1jaG9pY2VcIl06Y2hlY2tlZCcpO1xyXG4gIGNvbnN0IHJlYyA9IChzdGF0dXMgJiYgc3RhdHVzLmxvY2FsTW9kZWxSZWNvbW1lbmRhdGlvbikgfHwge307XHJcbiAgcmV0dXJuIHtcclxuICAgIHByb2plY3REaXI6ICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb2plY3QtZGlyJykudmFsdWUsXHJcbiAgICB3aGlzcGVyTW9kZWw6ICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3aGlzcGVyLXNlbCcpLnZhbHVlLFxyXG4gICAgd2hpc3Blckxhbmd1YWdlOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2hpc3Blci1sYW5nLXNlbCcpLnZhbHVlLFxyXG4gICAgbW9kZWxQcmVmZXRjaDogICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbW9kZWwtcHJlZmV0Y2gtY2hrJykuY2hlY2tlZCxcclxuICAgIGFpUHJpdmFjeU1vZGU6ICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FpLXByaXZhY3ktc2VsJykudmFsdWUsXHJcbiAgICBsbG1Nb2RlbFBhdGg6ICAgIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSB8fCAnJykudHJpbSgpLFxyXG4gICAgbG9jYWxNb2RlbENob2ljZTogY2hvaWNlRWwgPyBjaG9pY2VFbC52YWx1ZSA6ICdsb2NhbCcsXHJcbiAgICByZWNvbW1lbmRlZE1vZGVsSWQ6IHJlYy5tb2RlbElkIHx8ICcnLFxyXG4gICAgY29udGVudFByZXNldDogICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGVudC1wcmVzZXQtc2VsJykudmFsdWUsXHJcbiAgfTtcclxufVxyXG5cclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3F1aXQtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgaWYgKHJlcnVuTW9kZSkgYXBpLmNsb3NlKCk7ICAgICAgICAgIC8vIGRpc2NhcmQgY2hhbmdlcywga2VlcCBhcHAgcnVubmluZ1xyXG4gIGVsc2UgaWYgKG1vZGUgPT09ICd1cGRhdGUnKSBhcGkuc2tpcCgpOyAvLyBsYXVuY2ggd2l0aCBleGlzdGluZyBjb25maWdcclxuICBlbHNlIGFwaS5xdWl0KCk7XHJcbn0pO1xyXG5cclxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xhdW5jaC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGF1bmNoLWJ0bicpO1xyXG4gIGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgYnRuLnRleHRDb250ZW50ID0gcmVydW5Nb2RlID8gJ1NhdmluZ+KApicgOiAnU3RhcnRpbmfigKYnO1xyXG4gIGFwaS5jb21wbGV0ZShjb2xsZWN0Q29uZmlnKCkpO1xyXG59KTtcclxuXHJcbi8vIOKUgOKUgCBib290IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuYXBpLm9uSW5zdGFsbFByb2dyZXNzKG9uSW5zdGFsbFByb2dyZXNzKTtcclxuYXBpLm9uR2d1ZkRvd25sb2FkUHJvZ3Jlc3Mob25HZ3VmRG93bmxvYWRQcm9ncmVzcyk7XHJcblxyXG4oYXN5bmMgKCkgPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBzID0gYXdhaXQgYXBpLmdldFN0YXR1cygpO1xyXG4gICAgYXBwbHlEZWZhdWx0cyhzKTtcclxuICAgIHJlbmRlclNsb3RzKHMpO1xyXG4gIH0gY2F0Y2ggKGUpIHtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpdGVtLWluaXQnKS5vdXRlckhUTUwgPVxyXG4gICAgICBgPGRpdiBjbGFzcz1cIml0ZW0gZXJyXCI+XHJcbiAgICAgICAgIDxkaXYgY2xhc3M9XCJpY29uXCI+4pyXPC9kaXY+XHJcbiAgICAgICAgIDxkaXYgY2xhc3M9XCJib2R5XCI+XHJcbiAgICAgICAgICAgPGRpdiBjbGFzcz1cInRpdGxlXCI+U2V0dXAgY2hlY2sgZmFpbGVkPC9kaXY+XHJcbiAgICAgICAgICAgPGRpdiBjbGFzcz1cImRlc2NcIj4ke2VzYyhTdHJpbmcoZSkpfTxicj5UcnkgPGVtPlJlc3RhcnQgYXBwPC9lbT4gYmVsb3csIG9yIHF1aXQgYW5kIHJlbGF1bmNoLjwvZGl2PlxyXG4gICAgICAgICA8L2Rpdj5cclxuICAgICAgIDwvZGl2PmA7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1iYXInKS5zdHlsZS5kaXNwbGF5ID0gJyc7XHJcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3VidGl0bGUnKS50ZXh0Q29udGVudCA9ICdTb21ldGhpbmcgd2VudCB3cm9uZy4nO1xyXG4gIH1cclxufSkoKTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7O0FBQUE7QUFBQSxJQUNFLGVBQWlCO0FBQUEsSUFDakIsbUJBQXFCO0FBQUEsTUFDbkIsSUFBTTtBQUFBLE1BQ04sY0FBZ0I7QUFBQSxNQUNoQixVQUFZO0FBQUEsTUFDWixVQUFZO0FBQUEsTUFDWixhQUFlO0FBQUEsTUFDZixTQUFXO0FBQUEsTUFDWCxTQUFXO0FBQUEsTUFDWCxLQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsZ0JBQWtCO0FBQUEsTUFDaEI7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLElBQ0Y7QUFBQSxJQUNBLG1CQUFxQjtBQUFBLE1BQ25CO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJ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
