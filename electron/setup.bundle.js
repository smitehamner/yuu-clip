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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2hhcmVkL2NhdGFsb2ctZGF0YS5qc29uIiwgIi4uL3l1dV9jbGlwL3dlYi9zdGF0aWMvc2hhcmVkL2VzY2FwZWh0bWwuanMiLCAiLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvd2hpc3BlcmxhbmcuanMiLCAic2V0dXAtcmVuZGVyZXIuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIntcbiAgXCJfZ2VuZXJhdGVkX2J5XCI6IFwieXV1LWRldiBzaGFyZWQtZGF0YVwiLFxuICBcInJlY29tbWVuZGVkX21vZGVsXCI6IHtcbiAgICBcImlkXCI6IFwicXdlbjIuNS03Yi1pbnN0cnVjdFwiLFxuICAgIFwiZGlzcGxheV9uYW1lXCI6IFwiUXdlbjIuNSA3QiBJbnN0cnVjdFwiLFxuICAgIFwiZmlsZW5hbWVcIjogXCJRd2VuMi41LTdCLUluc3RydWN0LVE0X0tfTS5nZ3VmXCIsXG4gICAgXCJnZ3VmX3VybFwiOiBcImh0dHBzOi8vaHVnZ2luZ2ZhY2UuY28vYmFydG93c2tpL1F3ZW4yLjUtN0ItSW5zdHJ1Y3QtR0dVRlwiLFxuICAgIFwicmVzb2x2ZV91cmxcIjogXCJodHRwczovL2h1Z2dpbmdmYWNlLmNvL2JhcnRvd3NraS9Rd2VuMi41LTdCLUluc3RydWN0LUdHVUYvcmVzb2x2ZS9tYWluL1F3ZW4yLjUtN0ItSW5zdHJ1Y3QtUTRfS19NLmdndWZcIixcbiAgICBcInNpemVfZ2JcIjogNC43LFxuICAgIFwibGljZW5jZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgICBcIndoeVwiOiBcIlN0cm9uZyBhbGwtcm91bmQgN0IgLSB0aGUgYmVzdCBsb2NhbCBkZWZhdWx0IGZvciBjbGlwIHNjb3JpbmcuXCJcbiAgfSxcbiAgXCJ3aGlzcGVyX21vZGVsc1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcInRpbnlcIixcbiAgICAgIFwiYmx1cmJcIjogXCJmYXN0ZXN0LCBsb3dlc3QgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn43NSBNQlwiLFxuICAgICAgXCJ2cmFtXCI6IG51bGwsXG4gICAgICBcIm9wdGlvbl90ZXh0XCI6IFwidGlueSAtIGZhc3Rlc3QsIGxvd2VzdCBxdWFsaXR5ICh+NzUgTUIgZG93bmxvYWQpXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJiYXNlXCIsXG4gICAgICBcImJsdXJiXCI6IFwiZmFzdCwgbG93ZXIgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn4xNDAgTUJcIixcbiAgICAgIFwidnJhbVwiOiBudWxsLFxuICAgICAgXCJvcHRpb25fdGV4dFwiOiBcImJhc2UgLSBmYXN0LCBsb3dlciBxdWFsaXR5ICh+MTQwIE1CIGRvd25sb2FkKVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwic21hbGxcIixcbiAgICAgIFwiYmx1cmJcIjogXCJmYXN0LCBkZWNlbnQgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn40NjUgTUJcIixcbiAgICAgIFwidnJhbVwiOiBcIn4xIEdCXCIsXG4gICAgICBcIm9wdGlvbl90ZXh0XCI6IFwic21hbGwgLSBmYXN0LCBkZWNlbnQgcXVhbGl0eSAofjQ2NSBNQiBkb3dubG9hZCwgfjEgR0IgVlJBTSlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcIm1lZGl1bVwiLFxuICAgICAgXCJibHVyYlwiOiBcImdvb2QgYmFsYW5jZVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn4xLjUgR0JcIixcbiAgICAgIFwidnJhbVwiOiBcIn4yLjggR0JcIixcbiAgICAgIFwib3B0aW9uX3RleHRcIjogXCJtZWRpdW0gLSBnb29kIGJhbGFuY2UgKH4xLjUgR0IgZG93bmxvYWQsIH4yLjggR0IgVlJBTSlcIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImxhcmdlLXYzXCIsXG4gICAgICBcImJsdXJiXCI6IFwiYmVzdCBxdWFsaXR5XCIsXG4gICAgICBcImRvd25sb2FkXCI6IFwifjIuOSBHQlwiLFxuICAgICAgXCJ2cmFtXCI6IFwifjQuMiBHQlwiLFxuICAgICAgXCJvcHRpb25fdGV4dFwiOiBcImxhcmdlLXYzIC0gYmVzdCBxdWFsaXR5ICh+Mi45IEdCIGRvd25sb2FkLCB+NC4yIEdCIFZSQU0pXCJcbiAgICB9XG4gIF0sXG4gIFwid2hpc3Blcl9sYW5ndWFnZXNcIjogW1xuICAgIFwiYWZcIixcbiAgICBcImFtXCIsXG4gICAgXCJhclwiLFxuICAgIFwiYXNcIixcbiAgICBcImF6XCIsXG4gICAgXCJiYVwiLFxuICAgIFwiYmVcIixcbiAgICBcImJnXCIsXG4gICAgXCJiblwiLFxuICAgIFwiYm9cIixcbiAgICBcImJyXCIsXG4gICAgXCJic1wiLFxuICAgIFwiY2FcIixcbiAgICBcImNzXCIsXG4gICAgXCJjeVwiLFxuICAgIFwiZGFcIixcbiAgICBcImRlXCIsXG4gICAgXCJlbFwiLFxuICAgIFwiZW5cIixcbiAgICBcImVzXCIsXG4gICAgXCJldFwiLFxuICAgIFwiZXVcIixcbiAgICBcImZhXCIsXG4gICAgXCJmaVwiLFxuICAgIFwiZm9cIixcbiAgICBcImZyXCIsXG4gICAgXCJnbFwiLFxuICAgIFwiZ3VcIixcbiAgICBcImhhXCIsXG4gICAgXCJoYXdcIixcbiAgICBcImhlXCIsXG4gICAgXCJoaVwiLFxuICAgIFwiaHJcIixcbiAgICBcImh0XCIsXG4gICAgXCJodVwiLFxuICAgIFwiaHlcIixcbiAgICBcImlkXCIsXG4gICAgXCJpc1wiLFxuICAgIFwiaXRcIixcbiAgICBcImphXCIsXG4gICAgXCJqd1wiLFxuICAgIFwia2FcIixcbiAgICBcImtrXCIsXG4gICAgXCJrbVwiLFxuICAgIFwia25cIixcbiAgICBcImtvXCIsXG4gICAgXCJsYVwiLFxuICAgIFwibGJcIixcbiAgICBcImxuXCIsXG4gICAgXCJsb1wiLFxuICAgIFwibHRcIixcbiAgICBcImx2XCIsXG4gICAgXCJtZ1wiLFxuICAgIFwibWlcIixcbiAgICBcIm1rXCIsXG4gICAgXCJtbFwiLFxuICAgIFwibW5cIixcbiAgICBcIm1yXCIsXG4gICAgXCJtc1wiLFxuICAgIFwibXRcIixcbiAgICBcIm15XCIsXG4gICAgXCJuZVwiLFxuICAgIFwibmxcIixcbiAgICBcIm5uXCIsXG4gICAgXCJub1wiLFxuICAgIFwib2NcIixcbiAgICBcInBhXCIsXG4gICAgXCJwbFwiLFxuICAgIFwicHNcIixcbiAgICBcInB0XCIsXG4gICAgXCJyb1wiLFxuICAgIFwicnVcIixcbiAgICBcInNhXCIsXG4gICAgXCJzZFwiLFxuICAgIFwic2lcIixcbiAgICBcInNrXCIsXG4gICAgXCJzbFwiLFxuICAgIFwic25cIixcbiAgICBcInNvXCIsXG4gICAgXCJzcVwiLFxuICAgIFwic3JcIixcbiAgICBcInN1XCIsXG4gICAgXCJzdlwiLFxuICAgIFwic3dcIixcbiAgICBcInRhXCIsXG4gICAgXCJ0ZVwiLFxuICAgIFwidGdcIixcbiAgICBcInRoXCIsXG4gICAgXCJ0a1wiLFxuICAgIFwidGxcIixcbiAgICBcInRyXCIsXG4gICAgXCJ0dFwiLFxuICAgIFwidWtcIixcbiAgICBcInVyXCIsXG4gICAgXCJ1elwiLFxuICAgIFwidmlcIixcbiAgICBcInlpXCIsXG4gICAgXCJ5b1wiLFxuICAgIFwiemhcIlxuICBdLFxuICBcImNvbnRlbnRfcHJlc2V0c1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcImdlbmVyaWNcIixcbiAgICAgIFwibmFtZVwiOiBcIkdlbmVyaWNcIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJCYWxhbmNlZCBkZWZhdWx0IC0gbm8gY29udGVudC1zcGVjaWZpYyB0dW5pbmcuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJycC1uYXJyYXRpdmVcIixcbiAgICAgIFwibmFtZVwiOiBcIlJQIC8gbmFycmF0aXZlXCIsXG4gICAgICBcImRlc2NyaXB0aW9uXCI6IFwiUm9sZXBsYXkgb3Igc3RvcnktZHJpdmVuIHNlc3Npb25zIC0gY2hhcmFjdGVyIGFuZCBkcmFtYSBmaXJzdC5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImNvbXBldGl0aXZlXCIsXG4gICAgICBcIm5hbWVcIjogXCJDb21wZXRpdGl2ZSBnYW1pbmdcIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJSYW5rZWQgb3IgY29tcGV0aXRpdmUgcGxheSAtIGNsdXRjaGVzLCBjb21lYmFja3MsIGFuZCBjYWxsb3V0cy5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImNhc3VhbFwiLFxuICAgICAgXCJuYW1lXCI6IFwiQ2FzdWFsIC8gbGV0J3MgcGxheVwiLFxuICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlJlbGF4ZWQgbGV0J3MtcGxheXMgLSBwZXJzb25hbGl0eSwgcmVhY3Rpb25zLCBhbmQgZnVubnkgZmFpbHVyZXMuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJzcGVlZHJ1blwiLFxuICAgICAgXCJuYW1lXCI6IFwiU3BlZWRydW5cIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJSdW5zIGFnYWluc3QgdGhlIGNsb2NrIC0gc3BsaXRzLCBQQnMsIGFuZCBoZWFydGJyZWFrIHJlc2V0cy5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcInBvZGNhc3RcIixcbiAgICAgIFwibmFtZVwiOiBcIlBvZGNhc3QgLyBjb252ZXJzYXRpb25cIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJUYWxrLWRyaXZlbiBzZXNzaW9ucyAtIHF1b3RlcywgaG90IHRha2VzLCBhbmQgc2hhcmVkIGxhdWdodGVyLlwiXG4gICAgfVxuICBdLFxuICBcImFpX3ByaXZhY3lfb3B0aW9uc1wiOiBbXG4gICAge1xuICAgICAgXCJ2YWx1ZVwiOiBcIm5vbmVcIixcbiAgICAgIFwibGFiZWxcIjogXCJObyBnZW5lcmF0aXZlIEFJIC0gbm8gbGFuZ3VhZ2UgbW9kZWwgcnVuc1wiXG4gICAgfSxcbiAgICB7XG4gICAgICBcInZhbHVlXCI6IFwibG9jYWxfb25seVwiLFxuICAgICAgXCJsYWJlbFwiOiBcIkxvY2FsIG1vZGVscyBvbmx5IC0gbm90aGluZyBsZWF2ZXMgeW91ciBtYWNoaW5lIChyZWNvbW1lbmRlZClcIlxuICAgIH1cbiAgXSxcbiAgXCJhaV9wcml2YWN5X25vdGVzXCI6IHtcbiAgICBcIm5vbmVcIjogXCJObyBsYW5ndWFnZSBtb2RlbCBydW5zLiBDbGlwcyBhcmUgc3RpbGwgZm91bmQgYW5kIHNlYXJjaGFibGU7IHNjb3JpbmcgdXNlcyBsaWdodHdlaWdodCBzaWduYWxzIG9ubHkuXCIsXG4gICAgXCJsb2NhbF9vbmx5XCI6IFwiT24tZGV2aWNlIG1vZGVscyBvbmx5LiBFdmVyeXRoaW5nIHJ1bnMgbG9jYWxseSAtIG5vdGhpbmcgeW91IHJlY29yZCBpcyBzZW50IGFueXdoZXJlLlwiXG4gIH1cbn1cbiIsICIvLyBUcmFuc3BvcnQtYWdub3N0aWMgSFRNTCBlc2NhcGVyLCBzaGFyZWQgYnkgdGhlIHdlYiBhcHAgYW5kIHRoZSBFbGVjdHJvbiBzZXR1cFxuLy8gd2l6YXJkIChlYWNoIGltcG9ydHMgaXQgdGhyb3VnaCBpdHMgb3duIGVzYnVpbGQgYnVuZGxlIC0gc2VlIEFSQ0hJVEVDVFVSRSBsYW5kbWluZVxuLy8gIzIncyBib3VuZGFyeSBydWxlOiBzaGFyZWQgbW9kdWxlcyB0YWtlIGRhdGEsIG5ldmVyIGZldGNoIG9yIElQQykuIEVzY2FwZXMgJiA8ID4gXCJcbi8vIHNvIGEgdmFsdWUgaXMgc2FmZSBib3RoIGFzIHRleHQgYW5kIGluc2lkZSBhIGRvdWJsZS1xdW90ZWQgYXR0cmlidXRlLlxuZXhwb3J0IGZ1bmN0aW9uIGVzY0h0bWwocykge1xuICByZXR1cm4gU3RyaW5nKHMpXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG59XG4iLCAiaW1wb3J0IHsgZXNjSHRtbCB9IGZyb20gJy4vZXNjYXBlaHRtbC5qcyc7XG5cbi8vIFRoZSB0cmFuc2NyaXB0aW9uLWxhbmd1YWdlIDxvcHRpb24+IGxpc3QsIHNoYXJlZCBieSB3ZWIgU2V0dGluZ3MgYW5kIHRoZSBzZXR1cFxuLy8gd2l6YXJkOiBhbiBcIkF1dG8tZGV0ZWN0XCIgZGVmYXVsdCBmaXJzdCwgdGhlbiBldmVyeSBhbGxvd2VkIGxhbmd1YWdlIGNvZGUgcmVuZGVyZWRcbi8vIHdpdGggaXRzIEVuZ2xpc2ggZGlzcGxheSBuYW1lIChJbnRsLkRpc3BsYXlOYW1lcykgYW5kIHNvcnRlZCBieSB0aGF0IG5hbWUuIFB1cmUgLVxuLy8gaXQgdGFrZXMgdGhlIGNvZGUgbGlzdCBhbmQgcmV0dXJucyBIVE1MOyBpdCBuZXZlciBmZXRjaGVzIHRoZSBsaXN0IG9yIHJlYWRzIGNvbmZpZ1xuLy8gKHRoZSBjYWxsZXIgc3VwcGxpZXMgSFRUUC1iYWNrZWQgb3IgY2F0YWxvZy1iYWNrZWQgY29kZXMpLlxuZXhwb3J0IGZ1bmN0aW9uIGxhbmd1YWdlT3B0aW9uc0h0bWwoY29kZXMpIHtcbiAgbGV0IG5hbWVPZiA9IGNvZGUgPT4gY29kZTtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXNwbGF5TmFtZXMgPSBuZXcgSW50bC5EaXNwbGF5TmFtZXMoWydlbiddLCB7IHR5cGU6ICdsYW5ndWFnZScgfSk7XG4gICAgbmFtZU9mID0gY29kZSA9PiB7XG4gICAgICB0cnkgeyByZXR1cm4gZGlzcGxheU5hbWVzLm9mKGNvZGUpIHx8IGNvZGU7IH0gY2F0Y2ggeyByZXR1cm4gY29kZTsgfVxuICAgIH07XG4gIH0gY2F0Y2ggeyAvKiBJbnRsLkRpc3BsYXlOYW1lcyB1bmF2YWlsYWJsZSAtIGZhbGwgYmFjayB0byByYXcgY29kZXMgKi8gfVxuICBjb25zdCBuYW1lZCA9IChjb2RlcyB8fCBbXSlcbiAgICAubWFwKGNvZGUgPT4gKHsgY29kZSwgbmFtZTogbmFtZU9mKGNvZGUpIH0pKVxuICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcbiAgcmV0dXJuICc8b3B0aW9uIHZhbHVlPVwiXCI+QXV0by1kZXRlY3QgKHJlY29tbWVuZGVkKTwvb3B0aW9uPicgK1xuICAgIG5hbWVkLm1hcChvID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2NIdG1sKG8uY29kZSl9XCI+JHtlc2NIdG1sKG8ubmFtZSl9PC9vcHRpb24+YCkuam9pbignJyk7XG59XG4iLCAiJ3VzZSBzdHJpY3QnO1xuXG4vLyBTZXR1cC13aXphcmQgcmVuZGVyZXIsIGJ1bmRsZWQgYnkgZXNidWlsZCBpbnRvIHRoZSBjb21taXR0ZWQgZWxlY3Ryb24vc2V0dXAuYnVuZGxlLmpzXG4vLyAoc2Vjb25kIGVudHJ5IGluIHNjcmlwdHMvYnVpbGQtZXNtLm1qcykuIFdhcyBpbmxpbmUgaW4gc2V0dXAuaHRtbDsgZXh0cmFjdGVkIHNvIHRoZVxuLy8gd2l6YXJkIGNhbiBpbXBvcnQgdGhlIFNBTUUgc2hhcmVkIG1vZHVsZXMgdGhlIHdlYiBhcHAgdXNlcyAoZXNjSHRtbCwgdGhlIGxhbmd1YWdlXG4vLyA8b3B0aW9uPiBidWlsZGVyKSBhbmQgdGhlIGdlbmVyYXRlZCBjYXRhbG9nIHN0cmFpZ2h0IGZyb20gdGhlIFB5dGhvbiBzb3VyY2Ugb2YgdHJ1dGguXG4vLyBCb3VuZGFyeSBydWxlOiBzaGFyZWQgbW9kdWxlcyB0YWtlIGRhdGEgKyBjYWxsYmFja3MsIG5ldmVyIGZldGNoL0lQQyAtIHRoZSB3aXphcmRcbi8vIGZlZWRzIHRoZW0gSVBDLWJhY2tlZCBzdGF0ZSAod2luZG93LnNldHVwQVBJKSwgU2V0dGluZ3MgZmVlZHMgSFRUUC1iYWNrZWQgc3RhdGUuXG5pbXBvcnQgY2F0YWxvZyBmcm9tICcuL3NoYXJlZC9jYXRhbG9nLWRhdGEuanNvbic7XG5pbXBvcnQgeyBlc2NIdG1sIH0gZnJvbSAnLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvZXNjYXBlaHRtbC5qcyc7XG5pbXBvcnQgeyBsYW5ndWFnZU9wdGlvbnNIdG1sIH0gZnJvbSAnLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvd2hpc3BlcmxhbmcuanMnO1xuXG5jb25zdCBhcGkgICAgPSB3aW5kb3cuc2V0dXBBUEk7XG5jb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuY29uc3QgbW9kZSAgID0gcGFyYW1zLmdldCgnbW9kZScpIHx8ICdpbml0aWFsJzsgICAvLyAnaW5pdGlhbCcgfCAncmVydW4nIHwgJ3VwZGF0ZSdcbmNvbnN0IHJlcnVuTW9kZSA9IG1vZGUgPT09ICdyZXJ1bic7XG5cbi8vIFNoYXJlZCBjYXRhbG9nIGZhY3RzIGdlbmVyYXRlZCBmcm9tIHRoZSBQeXRob24gc291cmNlcyBvZiB0cnV0aCBieVxuLy8gYHl1dS1kZXYgc2hhcmVkLWRhdGFgIChleHBvc2VkIHZpYSBzZXR1cC1wcmVsb2FkLmpzKS4gV2hpc3BlciBsYW5ndWFnZXMgKyBtb2RlbHMsXG4vLyBjb250ZW50IHByZXNldHMsIEFJLXByaXZhY3kgY29weSwgYW5kIHRoZSByZWNvbW1lbmRlZCBtb2RlbCBhcmUgc2luZ2xlLXNvdXJjZWQgaGVyZVxuLy8gcmF0aGVyIHRoYW4gaGFuZC1tYWludGFpbmVkIGluIHRoaXMgZmlsZS5cbmNvbnN0IENBVEFMT0cgPSBjYXRhbG9nO1xuY29uc3QgV0hJU1BFUl9MQU5HVUFHRVMgPSBDQVRBTE9HLndoaXNwZXJfbGFuZ3VhZ2VzIHx8IFtdO1xuXG5sZXQgc3RhdHVzICA9IG51bGw7XG5sZXQgaW5zdGFsbGluZyA9IHsgJ2N1ZGEtbGlicyc6IGZhbHNlIH07XG5sZXQgZG93bmxvYWRpbmdHZ3VmID0gZmFsc2U7XG5sZXQgZGVmYXVsdHNBcHBsaWVkID0gZmFsc2U7XG5cbi8vIOKUgOKUgCBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG5jb25zdCBlc2MgPSBlc2NIdG1sO1xuXG5mdW5jdGlvbiBhbnlJbnN0YWxsaW5nKCkgeyByZXR1cm4gaW5zdGFsbGluZ1snY3VkYS1saWJzJ107IH1cblxuZnVuY3Rpb24gdXBkYXRlTGF1bmNoQnRuKCkge1xuICBjb25zdCBidG4gID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xhdW5jaC1idG4nKTtcbiAgY29uc3QgaGludCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsYXVuY2gtaGludCcpO1xuICBjb25zdCBibG9ja2VkQnlGZm1wZWcgID0gIXN0YXR1cyB8fCAhc3RhdHVzLmZmbXBlZ09rO1xuICBjb25zdCBibG9ja2VkQnlXb3JrICAgID0gYW55SW5zdGFsbGluZygpIHx8IGRvd25sb2FkaW5nR2d1ZjtcbiAgYnRuLmRpc2FibGVkID0gYmxvY2tlZEJ5RmZtcGVnIHx8IGJsb2NrZWRCeVdvcms7XG4gIGJ0bi50ZXh0Q29udGVudCA9IHJlcnVuTW9kZSA/ICdBcHBseSAmIENsb3NlJyA6ICdMYXVuY2gnO1xuICBoaW50LnRleHRDb250ZW50ID0gYmxvY2tlZEJ5RmZtcGVnICYmIHN0YXR1cyA/ICdGRm1wZWcgaXMgcmVxdWlyZWQgYmVmb3JlIHlvdSBjYW4gbGF1bmNoJ1xuICAgIDogYmxvY2tlZEJ5V29yayA/ICdXYWl0aW5nIGZvciB0aGUgZG93bmxvYWQgdG8gZmluaXNo4oCmJ1xuICAgIDogJyc7XG4gIGNvbnN0IHJlY2hlY2sgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1idG4nKTtcbiAgY29uc3QgcmVzdGFydCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXJ0LWJ0bicpO1xuICBpZiAocmVjaGVjaykgcmVjaGVjay5kaXNhYmxlZCA9IGJsb2NrZWRCeVdvcms7XG4gIGlmIChyZXN0YXJ0KSByZXN0YXJ0LmRpc2FibGVkID0gYmxvY2tlZEJ5V29yaztcbn1cblxuZnVuY3Rpb24gcm93KGlkLCBjbHMsIGljb24sIHRpdGxlLCBkZXNjSHRtbCwgYWN0aW9uSHRtbCA9ICcnKSB7XG4gIHJldHVybiBgPGRpdiBjbGFzcz1cIml0ZW0gJHtjbHN9XCIgaWQ9XCJpdGVtLSR7ZXNjKGlkKX1cIj5cbiAgICA8ZGl2IGNsYXNzPVwiaWNvblwiPiR7aWNvbn08L2Rpdj5cbiAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxuICAgICAgPGRpdiBjbGFzcz1cInRpdGxlXCI+JHtlc2ModGl0bGUpfTwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImRlc2NcIj4ke2Rlc2NIdG1sfTwvZGl2PlxuICAgICAgJHthY3Rpb25IdG1sID8gYDxkaXYgY2xhc3M9XCJhY3Rpb25cIj4ke2FjdGlvbkh0bWx9PC9kaXY+YCA6ICcnfVxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xufVxuXG4vLyDilIDilIAgZHluYW1pYyBzdGF0dXMgc2xvdHMgKGlucHV0cyBsaXZlIG91dHNpZGUgdGhlc2UsIHNvIGEgcmUtY2hlY2sgbmV2ZXJcbi8vICAgIHdpcGVzIGFueXRoaW5nIHRoZSB1c2VyIHR5cGVkKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuZnVuY3Rpb24gcmVuZGVyRmZtcGVnU2xvdChzKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2ZmbXBlZy1zbG90Jyk7XG4gIGlmIChzLmZmbXBlZ0J1bmRsZWQpIHtcbiAgICBpZiAocy5mZm1wZWdPaykge1xuICAgICAgZWwuaW5uZXJIVE1MID0gcm93KCdmZm1wZWcnLCAnb2snLCAn4pyTJywgJ0ZGbXBlZycsICdJbmNsdWRlZCB3aXRoIFl1dUNsaXAuIFVzZWQgdG8gcmVhZCBhbmQgY3V0IHZpZGVvIGZpbGVzLicpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBlbC5pbm5lckhUTUwgPSByb3coJ2ZmbXBlZycsICdlcnInLCAn4pyXJywgJ0ZGbXBlZyBpbnN0YWxsIGlzIGRhbWFnZWQnLFxuICAgICAgJ1RoZSBGRm1wZWcgYnVuZGxlZCB3aXRoIFl1dUNsaXAgaXMgbWlzc2luZyBvciBkYW1hZ2VkLiBUcnkgcmVpbnN0YWxsaW5nIFl1dUNsaXA7ICcgK1xuICAgICAgJ2lmIHRoZSBwcm9ibGVtIHBlcnNpc3RzLCBwbGVhc2UgcmVwb3J0IGl0LicpO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAocy5mZm1wZWdPaykge1xuICAgIGVsLmlubmVySFRNTCA9IHJvdygnZmZtcGVnJywgJ29rJywgJ+KckycsICdGRm1wZWcnLCAnRm91bmQgb24gUEFUSC4gVXNlZCB0byByZWFkIGFuZCBjdXQgdmlkZW8gZmlsZXMuJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGVsLmlubmVySFRNTCA9IHJvdygnZmZtcGVnJywgJ2VycicsICfinJcnLCAnRkZtcGVnIG5vdCBmb3VuZCcsXG4gICAgJ1l1dUNsaXAgbmVlZHMgRkZtcGVnIHRvIHJlYWQgYW5kIGN1dCB2aWRlbyBmaWxlcy48YnI+JyArXG4gICAgJzxzdHJvbmc+RWFzaWVzdDo8L3N0cm9uZz4gcnVuIHRoaXMgY29tbWFuZCBpbiBhIHRlcm1pbmFsIChTdGFydCDihpIgdHlwZSA8ZW0+dGVybWluYWw8L2VtPiksICcgK1xuICAgICd0aGVuIGNsaWNrIDxlbT5DaGVjayBhZ2FpbjwvZW0+IGJlbG93IC0gbm8gbmVlZCB0byBjbG9zZSB0aGlzIHdpbmRvdy4nICtcbiAgICAnPGRldGFpbHM+PHN1bW1hcnk+Q2FuXFwndCB1c2Ugd2luZ2V0PyBNYW51YWwgaW5zdGFsbCBzdGVwczwvc3VtbWFyeT4nICtcbiAgICAnT3BlbiBneWFuLmRldiAoYnV0dG9uIGJlbG93KSwgZG93bmxvYWQgPGVtPmZmbXBlZy1yZWxlYXNlLWVzc2VudGlhbHMuemlwPC9lbT4gKG9yIGEgPGVtPkNVREE8L2VtPiBidWlsZCBmb3IgTlZJRElBIEdQVXMpLiAnICtcbiAgICAnRXh0cmFjdCB0aGUgemlwIHRvIGEgcGVybWFuZW50IGZvbGRlciAoZS5nLiA8Y29kZT5DOlxcXFxmZm1wZWc8L2NvZGU+KSwgdGhlbiBhZGQgaXRzIDxjb2RlPmJpblxcXFw8L2NvZGU+IHN1YmZvbGRlciB0byBQQVRIOjxicj4nICtcbiAgICAnMS4gT3BlbiBTdGFydCDihpIgc2VhcmNoIDxlbT5FZGl0IHRoZSBzeXN0ZW0gZW52aXJvbm1lbnQgdmFyaWFibGVzPC9lbT4g4oaSIGNsaWNrIGl0PGJyPicgK1xuICAgICcyLiBDbGljayA8ZW0+RW52aXJvbm1lbnQgVmFyaWFibGVzPC9lbT48YnI+JyArXG4gICAgJzMuIFVuZGVyIDxlbT5TeXN0ZW0gdmFyaWFibGVzPC9lbT4sIHNlbGVjdCA8ZW0+UGF0aDwvZW0+IOKGkiBjbGljayA8ZW0+RWRpdDwvZW0+PGJyPicgK1xuICAgICc0LiBDbGljayA8ZW0+TmV3PC9lbT4g4oaSIHBhc3RlIHRoZSBmdWxsIHBhdGggdG8gdGhlIDxjb2RlPmJpblxcXFw8L2NvZGU+IGZvbGRlciAoZS5nLiA8Y29kZT5DOlxcXFxmZm1wZWdcXFxcYmluPC9jb2RlPik8YnI+JyArXG4gICAgJzUuIENsaWNrIE9LIG9uIGFsbCBkaWFsb2dzLCB0aGVuIGNsaWNrIDxlbT5DaGVjayBhZ2FpbjwvZW0+IGJlbG93LicgK1xuICAgICc8L2RldGFpbHM+JyxcbiAgICBgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6NnB4O2FsaWduLWl0ZW1zOmNlbnRlcjt3aWR0aDoxMDAlXCI+YCArXG4gICAgICBgPGNvZGUgc3R5bGU9XCJmbGV4OjFcIj53aW5nZXQgaW5zdGFsbCBHeWFuLkZGbXBlZzwvY29kZT5gICtcbiAgICAgIGA8YnV0dG9uIGNsYXNzPVwic21cIiBkYXRhLWNvcHk9XCJ3aW5nZXQgaW5zdGFsbCBHeWFuLkZGbXBlZ1wiPkNvcHk8L2J1dHRvbj5gICtcbiAgICAgIGA8YnV0dG9uIGNsYXNzPVwic21cIiBkYXRhLW9wZW4tdXJsPVwiaHR0cHM6Ly93d3cuZ3lhbi5kZXYvZmZtcGVnL2J1aWxkcy9cIj5PcGVuIGd5YW4uZGV2PC9idXR0b24+YCArXG4gICAgYDwvZGl2PmBcbiAgKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyR3B1TGluZShzKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dwdS1saW5lJyk7XG4gIGlmIChzLmdwdS5uYW1lID09PSAnVW5rbm93bicpIHtcbiAgICBlbC50ZXh0Q29udGVudCA9ICdObyBkaXNjcmV0ZSBHUFUgZGV0ZWN0ZWQgLSBhbmFseXNpcyBydW5zIG9uIHRoZSBDUFUgKHNsb3dlciwgYnV0IHdvcmtzKS4nO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBMTE0gc2NvcmluZyBydW5zIG9uIGFueSB2ZW5kb3IncyBHUFUgKHZpYSB0aGUgYnVuZGxlZCBWdWxrYW4gZW5naW5lKTsgb25seVxuICAvLyBXaGlzcGVyIHRyYW5zY3JpcHRpb24gaXMgTlZJRElBL0NVREEtb25seSwgc28gdGhlIHR3byBhcmUgcmVwb3J0ZWQgc2VwYXJhdGVseS5cbiAgY29uc3QgZ3B1ID0gYERldGVjdGVkIEdQVTogJHtzLmdwdS5uYW1lfSAoJHtzLmdwdS52cmFtTUIudG9Mb2NhbGVTdHJpbmcoKX0gTUIgVlJBTSlgO1xuICBpZiAocy5ncHUudmVuZG9yID09PSAnbnZpZGlhJykge1xuICAgIGNvbnN0IGhhc1ZlcnNpb24gPSBzLmN1ZGEudmVyc2lvbiAmJiBzLmN1ZGEudmVyc2lvbiAhPT0gJ3Vua25vd24nO1xuICAgIGNvbnN0IGN1ZGFMYWJlbCA9IGhhc1ZlcnNpb24gPyBgQ1VEQSAke3MuY3VkYS52ZXJzaW9ufWAgOiAnQ1VEQSBkZXRlY3RlZCc7XG4gICAgZWwudGV4dENvbnRlbnQgPSBzLmN1ZGEuYXZhaWxhYmxlXG4gICAgICA/IGAke2dwdX0gLSAke2N1ZGFMYWJlbH0uIFlvdXIgR1BVIHNwZWVkcyB1cCBib3RoIHRyYW5zY3JpcHRpb24gYW5kIExMTSBzY29yaW5nLmBcbiAgICAgIDogYCR7Z3B1fSAtIHlvdXIgR1BVIHNwZWVkcyB1cCBMTE0gc2NvcmluZy4gQWRkIENVREEgKGJlbG93KSB0byBhbHNvIHNwZWVkIHVwIHRyYW5zY3JpcHRpb24uYDtcbiAgfSBlbHNlIHtcbiAgICBlbC50ZXh0Q29udGVudCA9IGAke2dwdX0gLSB5b3VyIEdQVSBzcGVlZHMgdXAgTExNIHNjb3JpbmcuIFRyYW5zY3JpcHRpb24gcnVucyBvbiB0aGUgQ1BVIChHUFUgdHJhbnNjcmlwdGlvbiBuZWVkcyBhbiBOVklESUEgY2FyZCkuYDtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW5kZXJDdWRhU2xvdChzKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2N1ZGEtc2xvdCcpO1xuICAvLyBTaG93IHRoZSBcIk9wdGlvbmFsXCIgc2VjdGlvbiBoZWFkZXIgb25seSB3aGVuIGl0IGhhcyBhIHZpc2libGUgcm93OyBhbiBlbXB0eVxuICAvLyB0aXRsZWQgc2VjdGlvbiAoZS5nLiBvbiBhIG5vbi1OVklESUEgbWFjaGluZSwgd2hlcmUgQ1VEQSBpcyB0aGUgb25seSBvcHRpb25hbFxuICAvLyBpdGVtKSByZWFkcyBhcyBhIGxvYWQgZXJyb3IuXG4gIGNvbnN0IHNldFNsb3QgPSAoaHRtbCkgPT4ge1xuICAgIGVsLmlubmVySFRNTCA9IGh0bWw7XG4gICAgY29uc3Qgc2VjdGlvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcHRpb25hbC1zZWN0aW9uJyk7XG4gICAgaWYgKHNlY3Rpb24pIHNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IGh0bWwgPyAnJyA6ICdub25lJztcbiAgfTtcbiAgaWYgKHMuZ3B1LnZlbmRvciAhPT0gJ252aWRpYScpIHsgc2V0U2xvdCgnJyk7IHJldHVybjsgfVxuICBpZiAocy5jdWRhTGlic0luc3RhbGxlZCB8fCBzLmN1ZGEuYXZhaWxhYmxlKSB7XG4gICAgc2V0U2xvdChyb3coJ2N1ZGEnLCAnb2snLCAn4pyTJywgJ0Zhc3RlciB0cmFuc2NyaXB0aW9uIHJlYWR5JyxcbiAgICAgICdUaGUgQ1VEQSBzdXBwb3J0IGxpYnJhcmllcyBhcmUgYXZhaWxhYmxlIC0gdHJhbnNjcmlwdGlvbiBydW5zIG9uIHlvdXIgTlZJRElBIEdQVS4nKSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHNldFNsb3Qocm93KCdjdWRhJywgJ3dhcm4nLCAn4peLJywgJ0Zhc3RlciB0cmFuc2NyaXB0aW9uIChvcHRpb25hbCknLFxuICAgIGBZb3VyIE5WSURJQSBHUFUgY2FuIHRyYW5zY3JpYmUgbXVjaCBmYXN0ZXIgdGhhbiB0aGUgQ1BVLiBUaGlzIG9uZS10aW1lIGluc3RhbGwgYCArXG4gICAgYGFkZHMgdGhlIENVREEgc3VwcG9ydCBsaWJyYXJpZXMgKGN1QkxBUyArIGN1RE5OLCB+MSBHQikuIFlvdSBjYW4ga2VlcCB1c2luZyB0aGlzIGAgK1xuICAgIGB3aW5kb3cgd2hpbGUgaXQgcnVucy4gKExMTSBzY29yaW5nIGFscmVhZHkgdXNlcyB5b3VyIEdQVSAtIHRoaXMgb25seSBzcGVlZHMgdXAgdHJhbnNjcmlwdGlvbi4pYCxcbiAgICBgPGJ1dHRvbiBjbGFzcz1cInNtXCIgaWQ9XCJpbnN0YWxsLWJ0bi1jdWRhLWxpYnNcIiBkYXRhLWluc3RhbGw9XCJjdWRhLWxpYnNcIj5TcGVlZCB1cCB0cmFuc2NyaXB0aW9uICh+MSBHQik8L2J1dHRvbj5cbiAgICAgPGRpdiBjbGFzcz1cInB1bGwtbXNnXCIgaWQ9XCJpbnN0YWxsLW1zZy1jdWRhLWxpYnNcIj48L2Rpdj5gKSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckdndWZEb3dubG9hZFNsb3Qocykge1xuICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLXNsb3QnKTtcbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBpZiAoZG93bmxvYWRpbmdHZ3VmKSByZXR1cm47IC8vIHByZXNlcnZlIHRoZSBpbi1wcm9ncmVzcyBiYXIgYWNyb3NzIGEgc3RhdHVzIHJlLXJlbmRlclxuICBjb25zdCBjdXJyZW50UGF0aCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSB8fCAnJykudHJpbSgpO1xuICBpZiAoY3VycmVudFBhdGgpIHsgZWwuaW5uZXJIVE1MID0gJyc7IHJldHVybjsgfVxuICBjb25zdCByZWMgPSBDQVRBTE9HLnJlY29tbWVuZGVkX21vZGVsIHx8IHt9O1xuICBjb25zdCByZWNOYW1lID0gcmVjLmRpc3BsYXlfbmFtZSB8fCAndGhlIHJlY29tbWVuZGVkIG1vZGVsJztcbiAgY29uc3QgcmVjU2l6ZSA9IHJlYy5zaXplX2diICE9IG51bGwgPyBgfiR7cmVjLnNpemVfZ2J9IEdCYCA6ICcnO1xuICBlbC5pbm5lckhUTUwgPSByb3coJ2dndWYtZG93bmxvYWQnLCAnd2FybicsICfil4snLCAnRG93bmxvYWQgdGhlIHJlY29tbWVuZGVkIG1vZGVsJyxcbiAgICBgJHtlc2MocmVjTmFtZSl9ICgke2VzYyhyZWMubGljZW5jZSB8fCAnJyl9LCBzbyBjbGlwcyB5b3UgbWFrZSBjYW4gYmUgbW9uZXRpemVkKWAgK1xuICAgIGAke3JlY1NpemUgPyAnLCAnICsgcmVjU2l6ZSA6ICcnfS4gWW91IGNhbiBrZWVwIHVzaW5nIHRoaXMgd2luZG93IHdoaWxlIGl0IGRvd25sb2Fkcy5gLFxuICAgIGA8YnV0dG9uIGNsYXNzPVwic21cIiBpZD1cImdndWYtZG93bmxvYWQtYnRuXCIgZGF0YS1hY3Rpb249XCJnZ3VmLWRvd25sb2FkXCI+RG93bmxvYWQgcmVjb21tZW5kZWQgbW9kZWwke3JlY1NpemUgPyAnICgnICsgZXNjKHJlY1NpemUpICsgJyknIDogJyd9PC9idXR0b24+XG4gICAgIDxidXR0b24gY2xhc3M9XCJzbVwiIGlkPVwiZ2d1Zi1jYW5jZWwtYnRuXCIgZGF0YS1hY3Rpb249XCJnZ3VmLWNhbmNlbFwiIHN0eWxlPVwiZGlzcGxheTpub25lXCI+Q2FuY2VsPC9idXR0b24+XG4gICAgIDxkaXYgY2xhc3M9XCJwdWxsLWJhclwiIGlkPVwiZ2d1Zi1kb3dubG9hZC1iYXJcIiBzdHlsZT1cImRpc3BsYXk6bm9uZTt3aWR0aDoxMDAlO21hcmdpbi10b3A6NXB4XCI+PGRpdiBjbGFzcz1cInB1bGwtZmlsbFwiIGlkPVwiZ2d1Zi1kb3dubG9hZC1maWxsXCI+PC9kaXY+PC9kaXY+XG4gICAgIDxkaXYgY2xhc3M9XCJwdWxsLW1zZ1wiIGlkPVwiZ2d1Zi1kb3dubG9hZC1tc2dcIj48L2Rpdj5gKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyU2xvdHMocykge1xuICBzdGF0dXMgPSBzO1xuICByZW5kZXJGZm1wZWdTbG90KHMpO1xuICByZW5kZXJHcHVMaW5lKHMpO1xuICByZW5kZXJDdWRhU2xvdChzKTtcbiAgcmVuZGVyR2d1ZkRvd25sb2FkU2xvdChzKTtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1YnRpdGxlJykudGV4dENvbnRlbnQgPVxuICAgIG1vZGUgPT09ICd1cGRhdGUnID8gJ1RoaXMgdXBkYXRlIGFkZGVkIG5ldyBzZXR1cCBvcHRpb25zIC0gcmV2aWV3LCB0aGVuIGxhdW5jaC4nXG4gICAgOiBzLmZmbXBlZ09rID8gJ1N5c3RlbSBjaGVjayBjb21wbGV0ZS4nXG4gICAgOiAnQWN0aW9uIHJlcXVpcmVkIGJlZm9yZSB5b3UgY2FuIGxhdW5jaC4nO1xuICB1cGRhdGVMYXVuY2hCdG4oKTtcbn1cblxuLy8gQnVpbGQgdGhlIHdoaXNwZXIgLyBBSS1wcml2YWN5IC8gY29udGVudC1wcmVzZXQgPG9wdGlvbj4gbGlzdHMgZnJvbSB0aGUgc2hhcmVkXG4vLyBjYXRhbG9nIHNvIHRoZWlyIGNvcHkgaXMgc2luZ2xlLXNvdXJjZWQgKHNlZSBgeXV1LWRldiBzaGFyZWQtZGF0YWApLiBSdW5zIG9uY2UsXG4vLyBiZWZvcmUgYXBwbHlEZWZhdWx0cyBzZXRzIHRoZSBzYXZlZCB2YWx1ZXMuXG5mdW5jdGlvbiBwb3B1bGF0ZUNhdGFsb2dTZWxlY3RzKCkge1xuICBjb25zdCBmaWxsID0gKGlkLCBpdGVtcywgdmFsdWUsIGxhYmVsKSA9PiB7XG4gICAgY29uc3Qgc2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpO1xuICAgIGlmICghc2VsKSByZXR1cm47XG4gICAgc2VsLmlubmVySFRNTCA9IGl0ZW1zXG4gICAgICAubWFwKGl0ID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2ModmFsdWUoaXQpKX1cIj4ke2VzYyhsYWJlbChpdCkpfTwvb3B0aW9uPmApXG4gICAgICAuam9pbignJyk7XG4gIH07XG4gIGZpbGwoJ3doaXNwZXItc2VsJywgQ0FUQUxPRy53aGlzcGVyX21vZGVscyB8fCBbXSwgbSA9PiBtLmlkLCBtID0+IG0ub3B0aW9uX3RleHQpO1xuICBmaWxsKCdhaS1wcml2YWN5LXNlbCcsIENBVEFMT0cuYWlfcHJpdmFjeV9vcHRpb25zIHx8IFtdLCBvID0+IG8udmFsdWUsIG8gPT4gby5sYWJlbCk7XG4gIGZpbGwoJ2NvbnRlbnQtcHJlc2V0LXNlbCcsIENBVEFMT0cuY29udGVudF9wcmVzZXRzIHx8IFtdLCBwID0+IHAuaWQsIHAgPT4gcC5uYW1lKTtcblxuICBjb25zdCByZWMgPSBDQVRBTE9HLnJlY29tbWVuZGVkX21vZGVsIHx8IHt9O1xuICBjb25zdCBzaXplVGV4dCA9IHJlYy5zaXplX2diICE9IG51bGwgPyBgJHtyZWMuc2l6ZV9nYn0gR0JgIDogJyc7XG4gIGNvbnN0IHNldFRleHQgPSAoaWQsIHRleHQpID0+IHsgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7IGlmIChlbCAmJiB0ZXh0KSBlbC50ZXh0Q29udGVudCA9IHRleHQ7IH07XG4gIHNldFRleHQoJ3JlYy1tb2RlbC1zaXplLWlubGluZScsIHNpemVUZXh0KTtcbiAgc2V0VGV4dCgncmVjLW1vZGVsLXNpemUtYWR2Jywgc2l6ZVRleHQpO1xufVxuXG4vLyBGaXJzdCByZW5kZXIgb25seTogZmlsbCB0aGUgZm9ybSBmcm9tIHNhdmVkIGNvbmZpZyAvIGRldGVjdGVkIGRlZmF1bHRzLlxuZnVuY3Rpb24gYXBwbHlEZWZhdWx0cyhzKSB7XG4gIGlmIChkZWZhdWx0c0FwcGxpZWQpIHJldHVybjtcbiAgZGVmYXVsdHNBcHBsaWVkID0gdHJ1ZTtcblxuICBwb3B1bGF0ZUNhdGFsb2dTZWxlY3RzKCk7XG5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb2plY3QtZGlyJykudmFsdWUgPSBzLnByb2plY3REaXI7XG4gIGNvbnN0IHdoaXNwZXJTZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2hpc3Blci1zZWwnKTtcbiAgd2hpc3BlclNlbC52YWx1ZSA9IHMud2hpc3Blck1vZGVsIHx8IHMucmVjb21tZW5kZWRXaGlzcGVyLm1vZGVsO1xuICBpZiAoIXdoaXNwZXJTZWwudmFsdWUpIHdoaXNwZXJTZWwudmFsdWUgPSBzLnJlY29tbWVuZGVkV2hpc3Blci5tb2RlbDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlYy10YWcnKS50ZXh0Q29udGVudCA9ICfihpAgcmVjb21tZW5kZWQnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjLXRhZycpLnRpdGxlID0gcy5yZWNvbW1lbmRlZFdoaXNwZXIucmVhc29uO1xuXG4gIGNvbnN0IGxhbmdTZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2hpc3Blci1sYW5nLXNlbCcpO1xuICBsYW5nU2VsLmlubmVySFRNTCA9IGxhbmd1YWdlT3B0aW9uc0h0bWwoV0hJU1BFUl9MQU5HVUFHRVMpO1xuICBsYW5nU2VsLnZhbHVlID0gV0hJU1BFUl9MQU5HVUFHRVMuaW5jbHVkZXMocy53aGlzcGVyTGFuZ3VhZ2UpID8gcy53aGlzcGVyTGFuZ3VhZ2UgOiAnJztcblxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWktcHJpdmFjeS1zZWwnKS52YWx1ZSA9IHMuYWlQcml2YWN5TW9kZSB8fCAnbG9jYWxfb25seSc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tbW9kZWwtcGF0aCcpLnZhbHVlICA9IHMubGxtTW9kZWxQYXRoIHx8ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGVudC1wcmVzZXQtc2VsJykudmFsdWUgPSBzLmNvbnRlbnRQcmVzZXQgfHwgJ2dlbmVyaWMnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGVudC1wcmVzZXQtbm90ZScpLnRleHRDb250ZW50ID1cbiAgICAnTm90IHN1cmU/IEdlbmVyaWMgaXMgYSBnb29kIGRlZmF1bHQuIFlvdSBjYW4gZmluZS10dW5lIGV2ZXJ5IHNjb3Jpbmcgd2VpZ2h0IGxhdGVyIGluIFNldHRpbmdzLic7XG5cbiAgY29uc3QgcmVjID0gcy5sb2NhbE1vZGVsUmVjb21tZW5kYXRpb24gfHwge307XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tcmVjLWhlYWRsaW5lJykudGV4dENvbnRlbnQgPSByZWMuaGVhZGxpbmUgfHwgJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tcmVjLXJlYXNvbicpLnRleHRDb250ZW50ICAgPSByZWMucmVhc29uIHx8ICcnO1xuICAvLyBQcmUtc2VsZWN0IGxvY2FsIEFJIGFzIHRoZSByZWNvbW1lbmRlZCBwYXRoIHVubGVzcyB0aGUgbWFjaGluZSBjYW4ndCBmaXQgdGhlXG4gIC8vIG1vZGVsIChwdXNoICdub25lJyk7IGFuIGV4aXN0aW5nIG1vZGVsIGZpbGUgYWxzbyBrZWVwcyBsb2NhbCBzZWxlY3RlZCAodGhlXG4gIC8vIGJ1aWxkIHN0ZXAgd29uJ3QgcmUtcXVldWUgYSBkb3dubG9hZCB3aGVuIGEgcGF0aCBpcyBhbHJlYWR5IHNldCkuXG4gIGNvbnN0IGhhc0V4aXN0aW5nTW9kZWwgPSBCb29sZWFuKChzLmxsbU1vZGVsUGF0aCB8fCAnJykudHJpbSgpKTtcbiAgY29uc3QgcHJlZmVyTG9jYWwgPSBoYXNFeGlzdGluZ01vZGVsIHx8IHJlYy5wdXNoID09PSAnc3Ryb25nJyB8fCByZWMucHVzaCA9PT0gJ3NvZnQnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWkteWVzJykuY2hlY2tlZCA9IHByZWZlckxvY2FsO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWktbm8nKS5jaGVja2VkICA9ICFwcmVmZXJMb2NhbDtcbiAgb25Mb2NhbEFpQ2hvaWNlQ2hhbmdlKCk7XG5cbiAgb25Qcml2YWN5TW9kZUNoYW5nZShkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWktcHJpdmFjeS1zZWwnKS52YWx1ZSk7XG5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2l0ZW0taW5pdCcpLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWN0aW9ucycpLnN0eWxlLmRpc3BsYXkgID0gJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNoZWNrLWJhcicpLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgaWYgKHJlcnVuTW9kZSkgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlcnVuLW5vdGUnKS5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWl0LWJ0bicpLnRleHRDb250ZW50ID1cbiAgICByZXJ1bk1vZGUgPyAnQ2xvc2UnIDogbW9kZSA9PT0gJ3VwZGF0ZScgPyAnU2tpcCBmb3Igbm93JyA6ICdRdWl0Jztcbn1cblxuLy8g4pSA4pSAIEFJIHByaXZhY3kgKyBsb2NhbCBtb2RlbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuLy8geXV1LWNsaXAgaXMgbG9jYWwtb25seTsgdGhlIG1vZGUgdG9nZ2xlcyB3aGV0aGVyIGEgZ2VuZXJhdGl2ZSBtb2RlbCBydW5zIGF0IGFsbC5cbi8vIENvcHkgY29tZXMgZnJvbSB0aGUgc2hhcmVkIGNhdGFsb2cgKHNpbmdsZSBzb3VyY2UgZm9yIHRoZSB3aXphcmQgKyB3ZWIgU2V0dGluZ3MpLlxuY29uc3QgQUlfUFJJVkFDWV9OT1RFUyA9IENBVEFMT0cuYWlfcHJpdmFjeV9ub3RlcyB8fCB7fTtcblxuZnVuY3Rpb24gb25Qcml2YWN5TW9kZUNoYW5nZShtb2RlKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaS1wcml2YWN5LW5vdGUnKS50ZXh0Q29udGVudCA9IEFJX1BSSVZBQ1lfTk9URVNbbW9kZV0gfHwgJyc7XG4gIGNvbnN0IGxsbUJsb2NrID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1nZW5lcmF0aXZlLWJsb2NrJyk7XG4gIGlmIChsbG1CbG9jaykgbGxtQmxvY2suc3R5bGUuZGlzcGxheSA9IG1vZGUgPT09ICdub25lJyA/ICdub25lJyA6ICcnO1xuICB1cGRhdGVMbG1XYXJuKCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUxsbVdhcm4oKSB7XG4gIGNvbnN0IGZpbGVQYXRoID0gKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tbW9kZWwtcGF0aCcpLnZhbHVlIHx8ICcnKS50cmltKCk7XG4gIGNvbnN0IHdhbnRzTG9jYWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWkteWVzJykuY2hlY2tlZDtcbiAgLy8gV2l0aCBcIlNldCB1cCBsb2NhbCBBSVwiIGNob3NlbiwgdGhlIHJlY29tbWVuZGVkIG1vZGVsIGlzIHF1ZXVlZCBmb3IgYSBiYWNrZ3JvdW5kXG4gIC8vIGRvd25sb2FkIG9uIGxhdW5jaCAtIHNvIFwiTExNIHNjb3Jpbmcgd2lsbCBiZSBza2lwcGVkXCIgd291bGQgYmUgd3JvbmcuIE9ubHkgd2FyblxuICAvLyB3aGVuIHRoZXJlJ3Mgbm8gZmlsZSwgbm90aGluZyBkb3dubG9hZGluZywgYW5kIG5vIGJhY2tncm91bmQgZG93bmxvYWQgY29taW5nLlxuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLXdhcm4nKS5zdHlsZS5kaXNwbGF5ID1cbiAgICAoIWZpbGVQYXRoICYmICFkb3dubG9hZGluZ0dndWYgJiYgIXdhbnRzTG9jYWwpID8gJ2Jsb2NrJyA6ICdub25lJztcbiAgaWYgKHN0YXR1cykgcmVuZGVyR2d1ZkRvd25sb2FkU2xvdChzdGF0dXMpO1xufVxuXG5mdW5jdGlvbiBvbkxvY2FsQWlDaG9pY2VDaGFuZ2UoKSB7XG4gIGNvbnN0IGxpZ2h0d2VpZ2h0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLW5vJykuY2hlY2tlZDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xpZ2h0d2VpZ2h0LW5vdGUnKS5zdHlsZS5kaXNwbGF5ID0gbGlnaHR3ZWlnaHQgPyAnJyA6ICdub25lJztcbiAgLy8gVGhlIGNob2ljZSBnb3Zlcm5zIHdoZXRoZXIgdGhlIExMTSBtb2RlbCBpcyBxdWV1ZWQgZm9yIGEgYmFja2dyb3VuZCBkb3dubG9hZCxcbiAgLy8gd2hpY2ggZGVjaWRlcyB3aGV0aGVyIHRoZSBcIndpbGwgYmUgc2tpcHBlZFwiIHdhcm5pbmcgaXMgYWNjdXJhdGUgLSBrZWVwIGl0IGluIHN5bmMuXG4gIHVwZGF0ZUxsbVdhcm4oKTtcbn1cblxuLy8g4pSA4pSAIEdHVUYgbW9kZWwgb25lLWNsaWNrIGRvd25sb2FkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG5mdW5jdGlvbiBzdGFydEdndWZEb3dubG9hZCgpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtZG93bmxvYWQtYnRuJyk7XG4gIGNvbnN0IGNhbmNlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWNhbmNlbC1idG4nKTtcbiAgY29uc3QgYmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtZG93bmxvYWQtYmFyJyk7XG4gIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChjYW5jZWwpIHsgY2FuY2VsLnN0eWxlLmRpc3BsYXkgPSAnJzsgY2FuY2VsLmRpc2FibGVkID0gZmFsc2U7IH1cbiAgaWYgKGJhcikgYmFyLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgZG93bmxvYWRpbmdHZ3VmID0gdHJ1ZTtcbiAgdXBkYXRlTGF1bmNoQnRuKCk7XG4gIHVwZGF0ZUxsbVdhcm4oKTsgLy8gaGlkZSB0aGUgXCJubyBtb2RlbCBmaWxlIGNob3NlblwiIHdhcm5pbmcgd2hpbGUgdGhlIGRvd25sb2FkIHJ1bnNcbiAgYXBpLmRvd25sb2FkR2d1Zk1vZGVsKCk7XG59XG5cbmZ1bmN0aW9uIGNhbmNlbEdndWZEb3dubG9hZCgpIHtcbiAgY29uc3QgY2FuY2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtY2FuY2VsLWJ0bicpO1xuICBpZiAoY2FuY2VsKSBjYW5jZWwuZGlzYWJsZWQgPSB0cnVlO1xuICBhcGkuY2FuY2VsR2d1ZkRvd25sb2FkKCk7XG59XG5cbmZ1bmN0aW9uIG9uR2d1ZkRvd25sb2FkUHJvZ3Jlc3MoZGF0YSkge1xuICBjb25zdCBmaWxsICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1kb3dubG9hZC1maWxsJyk7XG4gIGNvbnN0IG1zZyAgICA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLW1zZycpO1xuICBjb25zdCBidG4gICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1kb3dubG9hZC1idG4nKTtcbiAgY29uc3QgY2FuY2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtY2FuY2VsLWJ0bicpO1xuICBjb25zdCBkb25lID0gKCkgPT4geyBkb3dubG9hZGluZ0dndWYgPSBmYWxzZTsgaWYgKGNhbmNlbCkgY2FuY2VsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7IHVwZGF0ZUxhdW5jaEJ0bigpOyB1cGRhdGVMbG1XYXJuKCk7IH07XG4gIGlmIChkYXRhLmRvbmUpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSA9IGRhdGEucGF0aDtcbiAgICB1cGRhdGVMbG1XYXJuKCk7IC8vIGFsc28gcmUtcmVuZGVycyB0aGUgZG93bmxvYWQgc2xvdCwgbm93IGhpZGRlbiBzaW5jZSB0aGUgcGF0aCBpcyBzZXRcbiAgICBkb25lKCk7XG4gIH0gZWxzZSBpZiAoZGF0YS5jYW5jZWxsZWQpIHtcbiAgICBpZiAobXNnKSBtc2cudGV4dENvbnRlbnQgPSAnRG93bmxvYWQgY2FuY2VsbGVkLic7XG4gICAgaWYgKGZpbGwpIGZpbGwuc3R5bGUud2lkdGggPSAnMCUnO1xuICAgIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIGRvbmUoKTtcbiAgfSBlbHNlIGlmIChkYXRhLmVycm9yKSB7XG4gICAgaWYgKG1zZykgbXNnLnRleHRDb250ZW50ID0gYERvd25sb2FkIGZhaWxlZDogJHtkYXRhLmVycm9yfWA7XG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgZG9uZSgpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhLnByb2dyZXNzID09PSAnbnVtYmVyJykge1xuICAgIGlmIChmaWxsKSBmaWxsLnN0eWxlLndpZHRoID0gZGF0YS5wcm9ncmVzcyArICclJztcbiAgICBpZiAobXNnKSAgbXNnLnRleHRDb250ZW50ICA9IGBEb3dubG9hZGluZ+KApiAke2RhdGEucHJvZ3Jlc3N9JWA7XG4gIH1cbn1cblxuLy8g4pSA4pSAIG9wdGlvbmFsIHBhY2thZ2UgaW5zdGFsbHMgKHBpcCBpbnRvIHRoZSB2ZW52KSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuZnVuY3Rpb24gc3RhcnRJbnN0YWxsKHNsdWcpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGluc3RhbGwtYnRuLSR7c2x1Z31gKTtcbiAgY29uc3QgbXNnID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGluc3RhbGwtbXNnLSR7c2x1Z31gKTtcbiAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgaWYgKG1zZykgbXNnLnRleHRDb250ZW50ID0gJ1N0YXJ0aW5n4oCmJztcbiAgaW5zdGFsbGluZ1tzbHVnXSA9IHRydWU7XG4gIHVwZGF0ZUxhdW5jaEJ0bigpO1xuICBhcGkuaW5zdGFsbFBhY2thZ2Uoc2x1Zyk7XG59XG5cbmZ1bmN0aW9uIG9uSW5zdGFsbFByb2dyZXNzKGRhdGEpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGluc3RhbGwtYnRuLSR7ZGF0YS5zbHVnfWApO1xuICBjb25zdCBtc2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgaW5zdGFsbC1tc2ctJHtkYXRhLnNsdWd9YCk7XG4gIGlmIChkYXRhLmRvbmUpIHtcbiAgICBpbnN0YWxsaW5nW2RhdGEuc2x1Z10gPSBmYWxzZTtcbiAgICBpZiAoZGF0YS5zbHVnID09PSAnY3VkYS1saWJzJykgeyBzdGF0dXMuY3VkYUxpYnNJbnN0YWxsZWQgPSB0cnVlOyByZW5kZXJDdWRhU2xvdChzdGF0dXMpOyB9XG4gICAgdXBkYXRlTGF1bmNoQnRuKCk7XG4gIH0gZWxzZSBpZiAoZGF0YS5lcnJvcikge1xuICAgIGluc3RhbGxpbmdbZGF0YS5zbHVnXSA9IGZhbHNlO1xuICAgIC8vIEdQVSBhY2NlbGVyYXRpb24gaXMgbmV2ZXIgcmVxdWlyZWQgLSByZWFzc3VyZSB0aGUgdXNlciB0aGV5IGNhbiBzdGlsbCBsYXVuY2guXG4gICAgY29uc3QgY3B1Tm90ZSA9IGRhdGEuc2x1ZyA9PT0gJ2N1ZGEtbGlicydcbiAgICAgID8gJyBZb3UgY2FuIHN0aWxsIGxhdW5jaCAtIHRyYW5zY3JpcHRpb24gd2lsbCBydW4gb24gdGhlIENQVS4nXG4gICAgICA6ICcnO1xuICAgIGlmIChtc2cpIG1zZy50ZXh0Q29udGVudCA9IGBJbnN0YWxsIGZhaWxlZDogJHtkYXRhLmVycm9yfSR7Y3B1Tm90ZX1gO1xuICAgIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICAgIHVwZGF0ZUxhdW5jaEJ0bigpO1xuICB9IGVsc2UgaWYgKGRhdGEuc3RhdHVzKSB7XG4gICAgaWYgKG1zZykgbXNnLnRleHRDb250ZW50ID0gZGF0YS5zdGF0dXM7XG4gIH1cbn1cblxuLy8g4pSA4pSAIHJlLWNoZWNrIC8gcmVzdGFydCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuYXN5bmMgZnVuY3Rpb24gcmVjaGVjaygpIHtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY2hlY2stYnRuJyk7XG4gIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGNvbnN0IG9yaWdpbmFsID0gYnRuLnRleHRDb250ZW50O1xuICBidG4udGV4dENvbnRlbnQgPSAnQ2hlY2tpbmfigKYnO1xuICB0cnkge1xuICAgIHJlbmRlclNsb3RzKGF3YWl0IGFwaS5nZXRTdGF0dXMoKSk7XG4gIH0gZmluYWxseSB7XG4gICAgYnRuLnRleHRDb250ZW50ID0gb3JpZ2luYWw7XG4gICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgdXBkYXRlTGF1bmNoQnRuKCk7XG4gIH1cbn1cblxuLy8g4pSA4pSAIFVJIGV2ZW50cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuLy8gRXZlbnQgZGVsZWdhdGlvbiBmb3IgZXZlcnkgYnV0dG9uIGluamVjdGVkIHZpYSBpbm5lckhUTUwgKHNsb3RzIHJlLXJlbmRlciBvbiBlYWNoXG4vLyBzdGF0dXMgcmVmcmVzaCkuIElubGluZSBvbi1ldmVudCBoYW5kbGVycyBjYW4ndCBiZSB1c2VkIGhlcmU6IHRoaXMgZmlsZSBpcyBidW5kbGVkXG4vLyBpbnRvIGFuIElJRkUsIHNvIG1vZHVsZS1zY29wZWQgZnVuY3Rpb25zIGxpa2Ugc3RhcnRHZ3VmRG93bmxvYWQgYXJlIG5laXRoZXIgZ2xvYmFsXG4vLyAoaW5saW5lIGhhbmRsZXJzIHJlc29sdmUgb24gd2luZG93KSBub3IgZXZlbiBwcmVzZW50IChlc2J1aWxkIHRyZWUtc2hha2VzIGZ1bmN0aW9uc1xuLy8gcmVmZXJlbmNlZCBvbmx5IGZyb20gc3RyaW5nIGxpdGVyYWxzKS4gVGhlIHN0YXRpYyBndWFyZCBpblxuLy8gdGVzdC9zZXR1cC1yZW5kZXJlci1oYW5kbGVycy50ZXN0LmpzIGtlZXBzIGlubGluZSBoYW5kbGVycyBmcm9tIGNyZWVwaW5nIGJhY2suXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xuICBjb25zdCBjb3B5QnRuID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtY29weV0nKTtcbiAgaWYgKGNvcHlCdG4pIHtcbiAgICBhcGkuY29weVRleHQoY29weUJ0bi5kYXRhc2V0LmNvcHkpO1xuICAgIGNvbnN0IG9yaWdpbmFsID0gY29weUJ0bi50ZXh0Q29udGVudDtcbiAgICBjb3B5QnRuLnRleHRDb250ZW50ID0gJ0NvcGllZCEnO1xuICAgIHNldFRpbWVvdXQoKCkgPT4geyBjb3B5QnRuLnRleHRDb250ZW50ID0gb3JpZ2luYWw7IH0sIDEyMDApO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCB1cmxCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1vcGVuLXVybF0nKTtcbiAgaWYgKHVybEJ0bikgeyBhcGkub3BlblVSTCh1cmxCdG4uZGF0YXNldC5vcGVuVXJsKTsgcmV0dXJuOyB9XG4gIGNvbnN0IGluc3RhbGxCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1pbnN0YWxsXScpO1xuICBpZiAoaW5zdGFsbEJ0bikgeyBzdGFydEluc3RhbGwoaW5zdGFsbEJ0bi5kYXRhc2V0Lmluc3RhbGwpOyByZXR1cm47IH1cbiAgY29uc3QgYWN0aW9uQnRuID0gZS50YXJnZXQuY2xvc2VzdCgnW2RhdGEtYWN0aW9uXScpO1xuICBpZiAoYWN0aW9uQnRuKSB7XG4gICAgaWYgKGFjdGlvbkJ0bi5kYXRhc2V0LmFjdGlvbiA9PT0gJ2dndWYtZG93bmxvYWQnKSBzdGFydEdndWZEb3dubG9hZCgpO1xuICAgIGVsc2UgaWYgKGFjdGlvbkJ0bi5kYXRhc2V0LmFjdGlvbiA9PT0gJ2dndWYtY2FuY2VsJykgY2FuY2VsR2d1ZkRvd25sb2FkKCk7XG4gIH1cbn0pO1xuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnJvd3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICBjb25zdCBkaXIgPSBhd2FpdCBhcGkucGlja0ZvbGRlcigpO1xuICBpZiAoZGlyKSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvamVjdC1kaXInKS52YWx1ZSA9IGRpcjtcbn0pO1xuXG4vLyBSZXN0b3JlLWZyb20tYmFja3VwIGlzIGEgZmlyc3QtcnVuIGNob2ljZSBvbmx5OiByZXJ1bi91cGRhdGUgYWxyZWFkeSBoYXZlIGFcbi8vIGxpdmUgcHJvamVjdCwgYW5kIHJlc3RvcmluZyBvdmVyIGl0IGJlbG9uZ3MgaW4gdGhlIGluLWFwcCBTZXR0aW5ncyBmbG93LlxuaWYgKG1vZGUgPT09ICdpbml0aWFsJykgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RvcmUtcm93Jykuc3R5bGUuZGlzcGxheSA9ICcnO1xuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdG9yZS1iYWNrdXAtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGFyY2hpdmUgPSBhd2FpdCBhcGkucGlja0ZpbGUoe1xuICAgIHRpdGxlOiAgICdDaG9vc2UgYSBZdXVDbGlwIGJhY2t1cCcsXG4gICAgZmlsdGVyczogW3sgbmFtZTogJ1l1dUNsaXAgYmFja3VwJywgZXh0ZW5zaW9uczogWyd6aXAnXSB9XSxcbiAgfSk7XG4gIGlmICghYXJjaGl2ZSkgcmV0dXJuO1xuICBjb25zdCB0YXJnZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvamVjdC1kaXInKS52YWx1ZTtcbiAgY29uc3QgYnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RvcmUtYmFja3VwLWJ0bicpO1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICBidG4udGV4dENvbnRlbnQgPSAnUmVzdG9yaW5n4oCmJztcbiAgbGV0IHJlc3VsdDtcbiAgdHJ5IHtcbiAgICByZXN1bHQgPSBhd2FpdCBhcGkucmVzdG9yZUJhY2t1cCh7IGFyY2hpdmUsIHByb2plY3Q6IHRhcmdldCB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJlc3VsdCA9IHsgb2s6IGZhbHNlLCBlcnJvcjogU3RyaW5nKGUgJiYgZS5tZXNzYWdlIHx8IGUpIH07XG4gIH1cbiAgaWYgKHJlc3VsdC5vaykge1xuICAgIC8vIExhdW5jaCBzdHJhaWdodCBpbnRvIHRoZSByZXN0b3JlZCBwcm9qZWN0OyBjb21wbGV0ZSgpIHNraXBzIHRoZSB3aXphcmRcbiAgICAvLyBjb25maWcgd3JpdGUgc28gdGhlIGJhY2t1cCdzIG93biBzZXR0aW5ncyBzdXJ2aXZlIChtYWluLmpzOiBjZmcucmVzdG9yZWQpLlxuICAgIGJ0bi50ZXh0Q29udGVudCA9ICdSZXN0b3JlZCAtIHN0YXJ0aW5n4oCmJztcbiAgICBhcGkuY29tcGxldGUoeyBwcm9qZWN0RGlyOiB0YXJnZXQsIHJlc3RvcmVkOiB0cnVlIH0pO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBPbiBmYWlsdXJlIChub3QgYSBjYW5jZWxsZWQgcmVwbGFjZSkgbWFpbi5qcyBoYXMgYWxyZWFkeSBzaG93biBhbiBlcnJvclxuICAvLyBkaWFsb2c7IGp1c3QgcmVzZXQgdGhlIGJ1dHRvbiBzbyB0aGUgdXNlciBjYW4gdHJ5IGFub3RoZXIgZmlsZS5cbiAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gIGJ0bi50ZXh0Q29udGVudCA9ICdSZXN0b3JlIGZyb20gYSBiYWNrdXAgaW5zdGVhZOKApic7XG59KTtcblxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1icm93c2UtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IGZpbGUgPSBhd2FpdCBhcGkucGlja0ZpbGUoe1xuICAgIHRpdGxlOiAgICdDaG9vc2UgTExNIG1vZGVsIGZpbGUnLFxuICAgIGZpbHRlcnM6IFt7IG5hbWU6ICdHR1VGIG1vZGVscycsIGV4dGVuc2lvbnM6IFsnZ2d1ZiddIH1dLFxuICB9KTtcbiAgaWYgKGZpbGUpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSA9IGZpbGU7XG4gICAgdXBkYXRlTGxtV2FybigpO1xuICB9XG59KTtcblxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FpLXByaXZhY3ktc2VsJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZSA9PiBvblByaXZhY3lNb2RlQ2hhbmdlKGUudGFyZ2V0LnZhbHVlKSk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWkteWVzJykuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgb25Mb2NhbEFpQ2hvaWNlQ2hhbmdlKTtcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2NhbC1haS1ubycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIG9uTG9jYWxBaUNob2ljZUNoYW5nZSk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIHVwZGF0ZUxsbVdhcm4pO1xuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHJlY2hlY2spO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhcnQtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXJ0LWJ0bicpO1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICBidG4udGV4dENvbnRlbnQgPSAnUmVzdGFydGluZ+KApic7XG4gIGFwaS5yZXN0YXJ0QXBwKCk7XG59KTtcblxuZnVuY3Rpb24gY29sbGVjdENvbmZpZygpIHtcbiAgY29uc3QgY2hvaWNlRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdpbnB1dFtuYW1lPVwibG9jYWwtYWktY2hvaWNlXCJdOmNoZWNrZWQnKTtcbiAgY29uc3QgcmVjID0gKHN0YXR1cyAmJiBzdGF0dXMubG9jYWxNb2RlbFJlY29tbWVuZGF0aW9uKSB8fCB7fTtcbiAgcmV0dXJuIHtcbiAgICBwcm9qZWN0RGlyOiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9qZWN0LWRpcicpLnZhbHVlLFxuICAgIHdoaXNwZXJNb2RlbDogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3doaXNwZXItc2VsJykudmFsdWUsXG4gICAgd2hpc3Blckxhbmd1YWdlOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2hpc3Blci1sYW5nLXNlbCcpLnZhbHVlLFxuICAgIG1vZGVsUHJlZmV0Y2g6ICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21vZGVsLXByZWZldGNoLWNoaycpLmNoZWNrZWQsXG4gICAgYWlQcml2YWN5TW9kZTogICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWktcHJpdmFjeS1zZWwnKS52YWx1ZSxcbiAgICBsbG1Nb2RlbFBhdGg6ICAgIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSB8fCAnJykudHJpbSgpLFxuICAgIGxvY2FsTW9kZWxDaG9pY2U6IGNob2ljZUVsID8gY2hvaWNlRWwudmFsdWUgOiAnbG9jYWwnLFxuICAgIHJlY29tbWVuZGVkTW9kZWxJZDogcmVjLm1vZGVsSWQgfHwgJycsXG4gICAgY29udGVudFByZXNldDogICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGVudC1wcmVzZXQtc2VsJykudmFsdWUsXG4gIH07XG59XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdWl0LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICBpZiAocmVydW5Nb2RlKSBhcGkuY2xvc2UoKTsgICAgICAgICAgLy8gZGlzY2FyZCBjaGFuZ2VzLCBrZWVwIGFwcCBydW5uaW5nXG4gIGVsc2UgaWYgKG1vZGUgPT09ICd1cGRhdGUnKSBhcGkuc2tpcCgpOyAvLyBsYXVuY2ggd2l0aCBleGlzdGluZyBjb25maWdcbiAgZWxzZSBhcGkucXVpdCgpO1xufSk7XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsYXVuY2gtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsYXVuY2gtYnRuJyk7XG4gIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGJ0bi50ZXh0Q29udGVudCA9IHJlcnVuTW9kZSA/ICdTYXZpbmfigKYnIDogJ1N0YXJ0aW5n4oCmJztcbiAgYXBpLmNvbXBsZXRlKGNvbGxlY3RDb25maWcoKSk7XG59KTtcblxuLy8g4pSA4pSAIGJvb3Qg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbmFwaS5vbkluc3RhbGxQcm9ncmVzcyhvbkluc3RhbGxQcm9ncmVzcyk7XG5hcGkub25HZ3VmRG93bmxvYWRQcm9ncmVzcyhvbkdndWZEb3dubG9hZFByb2dyZXNzKTtcblxuKGFzeW5jICgpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzID0gYXdhaXQgYXBpLmdldFN0YXR1cygpO1xuICAgIGFwcGx5RGVmYXVsdHMocyk7XG4gICAgcmVuZGVyU2xvdHMocyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaXRlbS1pbml0Jykub3V0ZXJIVE1MID1cbiAgICAgIGA8ZGl2IGNsYXNzPVwiaXRlbSBlcnJcIj5cbiAgICAgICAgIDxkaXYgY2xhc3M9XCJpY29uXCI+4pyXPC9kaXY+XG4gICAgICAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxuICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGl0bGVcIj5TZXR1cCBjaGVjayBmYWlsZWQ8L2Rpdj5cbiAgICAgICAgICAgPGRpdiBjbGFzcz1cImRlc2NcIj4ke2VzYyhTdHJpbmcoZSkpfTxicj5UcnkgPGVtPlJlc3RhcnQgYXBwPC9lbT4gYmVsb3csIG9yIHF1aXQgYW5kIHJlbGF1bmNoLjwvZGl2PlxuICAgICAgICAgPC9kaXY+XG4gICAgICAgPC9kaXY+YDtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1iYXInKS5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1YnRpdGxlJykudGV4dENvbnRlbnQgPSAnU29tZXRoaW5nIHdlbnQgd3JvbmcuJztcbiAgfVxufSkoKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQUFBO0FBQUEsSUFDRSxlQUFpQjtBQUFBLElBQ2pCLG1CQUFxQjtBQUFBLE1BQ25CLElBQU07QUFBQSxNQUNOLGNBQWdCO0FBQUEsTUFDaEIsVUFBWTtBQUFBLE1BQ1osVUFBWTtBQUFBLE1BQ1osYUFBZTtBQUFBLE1BQ2YsU0FBVztBQUFBLE1BQ1gsU0FBVztBQUFBLE1BQ1gsS0FBTztBQUFBLElBQ1Q7QUFBQSxJQUNBLGdCQUFrQjtBQUFBLE1BQ2hCO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxNQUNBO0FBQUEsUUFDRSxJQUFNO0FBQUEsUUFDTixPQUFTO0FBQUEsUUFDVCxVQUFZO0FBQUEsUUFDWixNQUFRO0FBQUEsUUFDUixhQUFlO0FBQUEsTUFDakI7QUFBQSxJQUNGO0FBQUEsSUFDQSxtQkFBcUI7QUFBQSxNQUNuQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0EsaUJBQW1CO0FBQUEsTUFDakI7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE1BQVE7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
