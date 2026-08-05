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
        "The FFmpeg bundled with YuuClip is missing or damaged. Reinstalling YuuClip replaces it - download a fresh installer below. If the problem persists after that, please report it.",
        `<div style="display:flex;gap:6px;align-items:center;width:100%"><button class="sm" data-open-url="https://github.com/smitehamner/yuu-clip/releases">Download the latest installer</button><button class="sm" data-open-url="https://github.com/smitehamner/yuu-clip/issues">Report this</button></div>`
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
  if (mode === "initial") {
    document.getElementById("restore-row").style.display = "";
    document.getElementById("restore-note").style.display = "";
  }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic2hhcmVkL2NhdGFsb2ctZGF0YS5qc29uIiwgIi4uL3l1dV9jbGlwL3dlYi9zdGF0aWMvc2hhcmVkL2VzY2FwZWh0bWwuanMiLCAiLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvd2hpc3BlcmxhbmcuanMiLCAic2V0dXAtcmVuZGVyZXIuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIntcbiAgXCJfZ2VuZXJhdGVkX2J5XCI6IFwieXV1LWRldiBzaGFyZWQtZGF0YVwiLFxuICBcInJlY29tbWVuZGVkX21vZGVsXCI6IHtcbiAgICBcImlkXCI6IFwicXdlbjIuNS03Yi1pbnN0cnVjdFwiLFxuICAgIFwiZGlzcGxheV9uYW1lXCI6IFwiUXdlbjIuNSA3QiBJbnN0cnVjdFwiLFxuICAgIFwiZmlsZW5hbWVcIjogXCJRd2VuMi41LTdCLUluc3RydWN0LVE0X0tfTS5nZ3VmXCIsXG4gICAgXCJnZ3VmX3VybFwiOiBcImh0dHBzOi8vaHVnZ2luZ2ZhY2UuY28vYmFydG93c2tpL1F3ZW4yLjUtN0ItSW5zdHJ1Y3QtR0dVRlwiLFxuICAgIFwicmVzb2x2ZV91cmxcIjogXCJodHRwczovL2h1Z2dpbmdmYWNlLmNvL2JhcnRvd3NraS9Rd2VuMi41LTdCLUluc3RydWN0LUdHVUYvcmVzb2x2ZS9tYWluL1F3ZW4yLjUtN0ItSW5zdHJ1Y3QtUTRfS19NLmdndWZcIixcbiAgICBcInNpemVfZ2JcIjogNC43LFxuICAgIFwibGljZW5jZVwiOiBcIkFwYWNoZS0yLjBcIixcbiAgICBcIndoeVwiOiBcIlN0cm9uZyBhbGwtcm91bmQgN0IgLSB0aGUgYmVzdCBsb2NhbCBkZWZhdWx0IGZvciBjbGlwIHNjb3JpbmcuXCJcbiAgfSxcbiAgXCJ3aGlzcGVyX21vZGVsc1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcInRpbnlcIixcbiAgICAgIFwiYmx1cmJcIjogXCJmYXN0ZXN0LCBsb3dlc3QgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn43NSBNQlwiLFxuICAgICAgXCJ2cmFtXCI6IG51bGwsXG4gICAgICBcIm9wdGlvbl90ZXh0XCI6IFwidGlueSAtIGZhc3Rlc3QsIGxvd2VzdCBxdWFsaXR5ICh+NzUgTUIgZG93bmxvYWQpXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJiYXNlXCIsXG4gICAgICBcImJsdXJiXCI6IFwiZmFzdCwgbG93ZXIgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn4xNDAgTUJcIixcbiAgICAgIFwidnJhbVwiOiBudWxsLFxuICAgICAgXCJvcHRpb25fdGV4dFwiOiBcImJhc2UgLSBmYXN0LCBsb3dlciBxdWFsaXR5ICh+MTQwIE1CIGRvd25sb2FkKVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwic21hbGxcIixcbiAgICAgIFwiYmx1cmJcIjogXCJmYXN0LCBkZWNlbnQgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn40NjUgTUJcIixcbiAgICAgIFwidnJhbVwiOiBcIn4xIEdCXCIsXG4gICAgICBcIm9wdGlvbl90ZXh0XCI6IFwic21hbGwgLSBmYXN0LCBkZWNlbnQgcXVhbGl0eSAofjQ2NSBNQiBkb3dubG9hZCwgbmVlZHMgYSB+MSBHQiBncmFwaGljcyBjYXJkKVwiXG4gICAgfSxcbiAgICB7XG4gICAgICBcImlkXCI6IFwibWVkaXVtXCIsXG4gICAgICBcImJsdXJiXCI6IFwiZ29vZCBiYWxhbmNlXCIsXG4gICAgICBcImRvd25sb2FkXCI6IFwifjEuNSBHQlwiLFxuICAgICAgXCJ2cmFtXCI6IFwifjIuOCBHQlwiLFxuICAgICAgXCJvcHRpb25fdGV4dFwiOiBcIm1lZGl1bSAtIGdvb2QgYmFsYW5jZSAofjEuNSBHQiBkb3dubG9hZCwgbmVlZHMgYSB+Mi44IEdCIGdyYXBoaWNzIGNhcmQpXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJsYXJnZS12M1wiLFxuICAgICAgXCJibHVyYlwiOiBcImJlc3QgcXVhbGl0eVwiLFxuICAgICAgXCJkb3dubG9hZFwiOiBcIn4yLjkgR0JcIixcbiAgICAgIFwidnJhbVwiOiBcIn40LjIgR0JcIixcbiAgICAgIFwib3B0aW9uX3RleHRcIjogXCJsYXJnZS12MyAtIGJlc3QgcXVhbGl0eSAofjIuOSBHQiBkb3dubG9hZCwgbmVlZHMgYSB+NC4yIEdCIGdyYXBoaWNzIGNhcmQpXCJcbiAgICB9XG4gIF0sXG4gIFwid2hpc3Blcl9sYW5ndWFnZXNcIjogW1xuICAgIFwiYWZcIixcbiAgICBcImFtXCIsXG4gICAgXCJhclwiLFxuICAgIFwiYXNcIixcbiAgICBcImF6XCIsXG4gICAgXCJiYVwiLFxuICAgIFwiYmVcIixcbiAgICBcImJnXCIsXG4gICAgXCJiblwiLFxuICAgIFwiYm9cIixcbiAgICBcImJyXCIsXG4gICAgXCJic1wiLFxuICAgIFwiY2FcIixcbiAgICBcImNzXCIsXG4gICAgXCJjeVwiLFxuICAgIFwiZGFcIixcbiAgICBcImRlXCIsXG4gICAgXCJlbFwiLFxuICAgIFwiZW5cIixcbiAgICBcImVzXCIsXG4gICAgXCJldFwiLFxuICAgIFwiZXVcIixcbiAgICBcImZhXCIsXG4gICAgXCJmaVwiLFxuICAgIFwiZm9cIixcbiAgICBcImZyXCIsXG4gICAgXCJnbFwiLFxuICAgIFwiZ3VcIixcbiAgICBcImhhXCIsXG4gICAgXCJoYXdcIixcbiAgICBcImhlXCIsXG4gICAgXCJoaVwiLFxuICAgIFwiaHJcIixcbiAgICBcImh0XCIsXG4gICAgXCJodVwiLFxuICAgIFwiaHlcIixcbiAgICBcImlkXCIsXG4gICAgXCJpc1wiLFxuICAgIFwiaXRcIixcbiAgICBcImphXCIsXG4gICAgXCJqd1wiLFxuICAgIFwia2FcIixcbiAgICBcImtrXCIsXG4gICAgXCJrbVwiLFxuICAgIFwia25cIixcbiAgICBcImtvXCIsXG4gICAgXCJsYVwiLFxuICAgIFwibGJcIixcbiAgICBcImxuXCIsXG4gICAgXCJsb1wiLFxuICAgIFwibHRcIixcbiAgICBcImx2XCIsXG4gICAgXCJtZ1wiLFxuICAgIFwibWlcIixcbiAgICBcIm1rXCIsXG4gICAgXCJtbFwiLFxuICAgIFwibW5cIixcbiAgICBcIm1yXCIsXG4gICAgXCJtc1wiLFxuICAgIFwibXRcIixcbiAgICBcIm15XCIsXG4gICAgXCJuZVwiLFxuICAgIFwibmxcIixcbiAgICBcIm5uXCIsXG4gICAgXCJub1wiLFxuICAgIFwib2NcIixcbiAgICBcInBhXCIsXG4gICAgXCJwbFwiLFxuICAgIFwicHNcIixcbiAgICBcInB0XCIsXG4gICAgXCJyb1wiLFxuICAgIFwicnVcIixcbiAgICBcInNhXCIsXG4gICAgXCJzZFwiLFxuICAgIFwic2lcIixcbiAgICBcInNrXCIsXG4gICAgXCJzbFwiLFxuICAgIFwic25cIixcbiAgICBcInNvXCIsXG4gICAgXCJzcVwiLFxuICAgIFwic3JcIixcbiAgICBcInN1XCIsXG4gICAgXCJzdlwiLFxuICAgIFwic3dcIixcbiAgICBcInRhXCIsXG4gICAgXCJ0ZVwiLFxuICAgIFwidGdcIixcbiAgICBcInRoXCIsXG4gICAgXCJ0a1wiLFxuICAgIFwidGxcIixcbiAgICBcInRyXCIsXG4gICAgXCJ0dFwiLFxuICAgIFwidWtcIixcbiAgICBcInVyXCIsXG4gICAgXCJ1elwiLFxuICAgIFwidmlcIixcbiAgICBcInlpXCIsXG4gICAgXCJ5b1wiLFxuICAgIFwiemhcIlxuICBdLFxuICBcImNvbnRlbnRfcHJlc2V0c1wiOiBbXG4gICAge1xuICAgICAgXCJpZFwiOiBcImdlbmVyaWNcIixcbiAgICAgIFwibmFtZVwiOiBcIkdlbmVyaWNcIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJCYWxhbmNlZCBkZWZhdWx0IC0gbm8gY29udGVudC1zcGVjaWZpYyB0dW5pbmcuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJycC1uYXJyYXRpdmVcIixcbiAgICAgIFwibmFtZVwiOiBcIlJQIC8gbmFycmF0aXZlXCIsXG4gICAgICBcImRlc2NyaXB0aW9uXCI6IFwiUm9sZXBsYXkgb3Igc3RvcnktZHJpdmVuIHNlc3Npb25zIC0gY2hhcmFjdGVyIGFuZCBkcmFtYSBmaXJzdC5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImNvbXBldGl0aXZlXCIsXG4gICAgICBcIm5hbWVcIjogXCJDb21wZXRpdGl2ZSBnYW1pbmdcIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJSYW5rZWQgb3IgY29tcGV0aXRpdmUgcGxheSAtIGNsdXRjaGVzLCBjb21lYmFja3MsIGFuZCBjYWxsb3V0cy5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcImNhc3VhbFwiLFxuICAgICAgXCJuYW1lXCI6IFwiQ2FzdWFsIC8gbGV0J3MgcGxheVwiLFxuICAgICAgXCJkZXNjcmlwdGlvblwiOiBcIlJlbGF4ZWQgbGV0J3MtcGxheXMgLSBwZXJzb25hbGl0eSwgcmVhY3Rpb25zLCBhbmQgZnVubnkgZmFpbHVyZXMuXCJcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiaWRcIjogXCJzcGVlZHJ1blwiLFxuICAgICAgXCJuYW1lXCI6IFwiU3BlZWRydW5cIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJSdW5zIGFnYWluc3QgdGhlIGNsb2NrIC0gc3BsaXRzLCBQQnMsIGFuZCBoZWFydGJyZWFrIHJlc2V0cy5cIlxuICAgIH0sXG4gICAge1xuICAgICAgXCJpZFwiOiBcInBvZGNhc3RcIixcbiAgICAgIFwibmFtZVwiOiBcIlBvZGNhc3QgLyBjb252ZXJzYXRpb25cIixcbiAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJUYWxrLWRyaXZlbiBzZXNzaW9ucyAtIHF1b3RlcywgaG90IHRha2VzLCBhbmQgc2hhcmVkIGxhdWdodGVyLlwiXG4gICAgfVxuICBdLFxuICBcImFpX3ByaXZhY3lfb3B0aW9uc1wiOiBbXG4gICAge1xuICAgICAgXCJ2YWx1ZVwiOiBcIm5vbmVcIixcbiAgICAgIFwibGFiZWxcIjogXCJObyBnZW5lcmF0aXZlIEFJIC0gbm8gbGFuZ3VhZ2UgbW9kZWwgcnVuc1wiXG4gICAgfSxcbiAgICB7XG4gICAgICBcInZhbHVlXCI6IFwibG9jYWxfb25seVwiLFxuICAgICAgXCJsYWJlbFwiOiBcIkxvY2FsIG1vZGVscyBvbmx5IC0gbm90aGluZyBsZWF2ZXMgeW91ciBtYWNoaW5lIChyZWNvbW1lbmRlZClcIlxuICAgIH1cbiAgXSxcbiAgXCJhaV9wcml2YWN5X25vdGVzXCI6IHtcbiAgICBcIm5vbmVcIjogXCJObyBsYW5ndWFnZSBtb2RlbCBydW5zLiBDbGlwcyBhcmUgc3RpbGwgZm91bmQgYW5kIHNlYXJjaGFibGU7IHNjb3JpbmcgdXNlcyBsaWdodHdlaWdodCBzaWduYWxzIG9ubHkuXCIsXG4gICAgXCJsb2NhbF9vbmx5XCI6IFwiT24tZGV2aWNlIG1vZGVscyBvbmx5LiBFdmVyeXRoaW5nIHJ1bnMgbG9jYWxseSAtIG5vdGhpbmcgeW91IHJlY29yZCBpcyBzZW50IGFueXdoZXJlLlwiXG4gIH1cbn1cbiIsICIvLyBUcmFuc3BvcnQtYWdub3N0aWMgSFRNTCBlc2NhcGVyLCBzaGFyZWQgYnkgdGhlIHdlYiBhcHAgYW5kIHRoZSBFbGVjdHJvbiBzZXR1cFxuLy8gd2l6YXJkIChlYWNoIGltcG9ydHMgaXQgdGhyb3VnaCBpdHMgb3duIGVzYnVpbGQgYnVuZGxlIC0gc2VlIEFSQ0hJVEVDVFVSRSBsYW5kbWluZVxuLy8gIzIncyBib3VuZGFyeSBydWxlOiBzaGFyZWQgbW9kdWxlcyB0YWtlIGRhdGEsIG5ldmVyIGZldGNoIG9yIElQQykuIEVzY2FwZXMgJiA8ID4gXCJcbi8vIHNvIGEgdmFsdWUgaXMgc2FmZSBib3RoIGFzIHRleHQgYW5kIGluc2lkZSBhIGRvdWJsZS1xdW90ZWQgYXR0cmlidXRlLlxuZXhwb3J0IGZ1bmN0aW9uIGVzY0h0bWwocykge1xuICByZXR1cm4gU3RyaW5nKHMpXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG59XG4iLCAiaW1wb3J0IHsgZXNjSHRtbCB9IGZyb20gJy4vZXNjYXBlaHRtbC5qcyc7XG5cbi8vIFRoZSB0cmFuc2NyaXB0aW9uLWxhbmd1YWdlIDxvcHRpb24+IGxpc3QsIHNoYXJlZCBieSB3ZWIgU2V0dGluZ3MgYW5kIHRoZSBzZXR1cFxuLy8gd2l6YXJkOiBhbiBcIkF1dG8tZGV0ZWN0XCIgZGVmYXVsdCBmaXJzdCwgdGhlbiBldmVyeSBhbGxvd2VkIGxhbmd1YWdlIGNvZGUgcmVuZGVyZWRcbi8vIHdpdGggaXRzIEVuZ2xpc2ggZGlzcGxheSBuYW1lIChJbnRsLkRpc3BsYXlOYW1lcykgYW5kIHNvcnRlZCBieSB0aGF0IG5hbWUuIFB1cmUgLVxuLy8gaXQgdGFrZXMgdGhlIGNvZGUgbGlzdCBhbmQgcmV0dXJucyBIVE1MOyBpdCBuZXZlciBmZXRjaGVzIHRoZSBsaXN0IG9yIHJlYWRzIGNvbmZpZ1xuLy8gKHRoZSBjYWxsZXIgc3VwcGxpZXMgSFRUUC1iYWNrZWQgb3IgY2F0YWxvZy1iYWNrZWQgY29kZXMpLlxuZXhwb3J0IGZ1bmN0aW9uIGxhbmd1YWdlT3B0aW9uc0h0bWwoY29kZXMpIHtcbiAgbGV0IG5hbWVPZiA9IGNvZGUgPT4gY29kZTtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXNwbGF5TmFtZXMgPSBuZXcgSW50bC5EaXNwbGF5TmFtZXMoWydlbiddLCB7IHR5cGU6ICdsYW5ndWFnZScgfSk7XG4gICAgbmFtZU9mID0gY29kZSA9PiB7XG4gICAgICB0cnkgeyByZXR1cm4gZGlzcGxheU5hbWVzLm9mKGNvZGUpIHx8IGNvZGU7IH0gY2F0Y2ggeyByZXR1cm4gY29kZTsgfVxuICAgIH07XG4gIH0gY2F0Y2ggeyAvKiBJbnRsLkRpc3BsYXlOYW1lcyB1bmF2YWlsYWJsZSAtIGZhbGwgYmFjayB0byByYXcgY29kZXMgKi8gfVxuICBjb25zdCBuYW1lZCA9IChjb2RlcyB8fCBbXSlcbiAgICAubWFwKGNvZGUgPT4gKHsgY29kZSwgbmFtZTogbmFtZU9mKGNvZGUpIH0pKVxuICAgIC5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKTtcbiAgcmV0dXJuICc8b3B0aW9uIHZhbHVlPVwiXCI+QXV0by1kZXRlY3QgKHJlY29tbWVuZGVkKTwvb3B0aW9uPicgK1xuICAgIG5hbWVkLm1hcChvID0+IGA8b3B0aW9uIHZhbHVlPVwiJHtlc2NIdG1sKG8uY29kZSl9XCI+JHtlc2NIdG1sKG8ubmFtZSl9PC9vcHRpb24+YCkuam9pbignJyk7XG59XG4iLCAiJ3VzZSBzdHJpY3QnO1xuXG4vLyBTZXR1cC13aXphcmQgcmVuZGVyZXIsIGJ1bmRsZWQgYnkgZXNidWlsZCBpbnRvIHRoZSBjb21taXR0ZWQgZWxlY3Ryb24vc2V0dXAuYnVuZGxlLmpzXG4vLyAoc2Vjb25kIGVudHJ5IGluIHNjcmlwdHMvYnVpbGQtZXNtLm1qcykuIFdhcyBpbmxpbmUgaW4gc2V0dXAuaHRtbDsgZXh0cmFjdGVkIHNvIHRoZVxuLy8gd2l6YXJkIGNhbiBpbXBvcnQgdGhlIFNBTUUgc2hhcmVkIG1vZHVsZXMgdGhlIHdlYiBhcHAgdXNlcyAoZXNjSHRtbCwgdGhlIGxhbmd1YWdlXG4vLyA8b3B0aW9uPiBidWlsZGVyKSBhbmQgdGhlIGdlbmVyYXRlZCBjYXRhbG9nIHN0cmFpZ2h0IGZyb20gdGhlIFB5dGhvbiBzb3VyY2Ugb2YgdHJ1dGguXG4vLyBCb3VuZGFyeSBydWxlOiBzaGFyZWQgbW9kdWxlcyB0YWtlIGRhdGEgKyBjYWxsYmFja3MsIG5ldmVyIGZldGNoL0lQQyAtIHRoZSB3aXphcmRcbi8vIGZlZWRzIHRoZW0gSVBDLWJhY2tlZCBzdGF0ZSAod2luZG93LnNldHVwQVBJKSwgU2V0dGluZ3MgZmVlZHMgSFRUUC1iYWNrZWQgc3RhdGUuXG5pbXBvcnQgY2F0YWxvZyBmcm9tICcuL3NoYXJlZC9jYXRhbG9nLWRhdGEuanNvbic7XG5pbXBvcnQgeyBlc2NIdG1sIH0gZnJvbSAnLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvZXNjYXBlaHRtbC5qcyc7XG5pbXBvcnQgeyBsYW5ndWFnZU9wdGlvbnNIdG1sIH0gZnJvbSAnLi4veXV1X2NsaXAvd2ViL3N0YXRpYy9zaGFyZWQvd2hpc3BlcmxhbmcuanMnO1xuXG5jb25zdCBhcGkgICAgPSB3aW5kb3cuc2V0dXBBUEk7XG5jb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuY29uc3QgbW9kZSAgID0gcGFyYW1zLmdldCgnbW9kZScpIHx8ICdpbml0aWFsJzsgICAvLyAnaW5pdGlhbCcgfCAncmVydW4nIHwgJ3VwZGF0ZSdcbmNvbnN0IHJlcnVuTW9kZSA9IG1vZGUgPT09ICdyZXJ1bic7XG5cbi8vIFNoYXJlZCBjYXRhbG9nIGZhY3RzIGdlbmVyYXRlZCBmcm9tIHRoZSBQeXRob24gc291cmNlcyBvZiB0cnV0aCBieVxuLy8gYHl1dS1kZXYgc2hhcmVkLWRhdGFgIChleHBvc2VkIHZpYSBzZXR1cC1wcmVsb2FkLmpzKS4gV2hpc3BlciBsYW5ndWFnZXMgKyBtb2RlbHMsXG4vLyBjb250ZW50IHByZXNldHMsIEFJLXByaXZhY3kgY29weSwgYW5kIHRoZSByZWNvbW1lbmRlZCBtb2RlbCBhcmUgc2luZ2xlLXNvdXJjZWQgaGVyZVxuLy8gcmF0aGVyIHRoYW4gaGFuZC1tYWludGFpbmVkIGluIHRoaXMgZmlsZS5cbmNvbnN0IENBVEFMT0cgPSBjYXRhbG9nO1xuY29uc3QgV0hJU1BFUl9MQU5HVUFHRVMgPSBDQVRBTE9HLndoaXNwZXJfbGFuZ3VhZ2VzIHx8IFtdO1xuXG5sZXQgc3RhdHVzICA9IG51bGw7XG5sZXQgaW5zdGFsbGluZyA9IHsgJ2N1ZGEtbGlicyc6IGZhbHNlIH07XG5sZXQgZG93bmxvYWRpbmdHZ3VmID0gZmFsc2U7XG5sZXQgZGVmYXVsdHNBcHBsaWVkID0gZmFsc2U7XG5cbi8vIOKUgOKUgCBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG5jb25zdCBlc2MgPSBlc2NIdG1sO1xuXG5mdW5jdGlvbiBhbnlJbnN0YWxsaW5nKCkgeyByZXR1cm4gaW5zdGFsbGluZ1snY3VkYS1saWJzJ107IH1cblxuZnVuY3Rpb24gdXBkYXRlTGF1bmNoQnRuKCkge1xuICBjb25zdCBidG4gID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xhdW5jaC1idG4nKTtcbiAgY29uc3QgaGludCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsYXVuY2gtaGludCcpO1xuICBjb25zdCBibG9ja2VkQnlGZm1wZWcgID0gIXN0YXR1cyB8fCAhc3RhdHVzLmZmbXBlZ09rO1xuICBjb25zdCBibG9ja2VkQnlXb3JrICAgID0gYW55SW5zdGFsbGluZygpIHx8IGRvd25sb2FkaW5nR2d1ZjtcbiAgY29uc3QgYmxvY2tlZEJ5Tm9EaXIgICA9ICFkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvamVjdC1kaXInKS52YWx1ZS50cmltKCk7XG4gIGJ0bi5kaXNhYmxlZCA9IGJsb2NrZWRCeUZmbXBlZyB8fCBibG9ja2VkQnlXb3JrIHx8IGJsb2NrZWRCeU5vRGlyO1xuICBidG4udGV4dENvbnRlbnQgPSByZXJ1bk1vZGUgPyAnQXBwbHkgJiBDbG9zZScgOiAnTGF1bmNoJztcbiAgaGludC50ZXh0Q29udGVudCA9IGJsb2NrZWRCeUZmbXBlZyAmJiBzdGF0dXMgPyAnRkZtcGVnIGlzIHJlcXVpcmVkIGJlZm9yZSB5b3UgY2FuIGxhdW5jaCdcbiAgICA6IGFueUluc3RhbGxpbmcoKSA/ICdZb3UgY2FuIGtlZXAgYWRqdXN0aW5nIHNldHRpbmdzIHdoaWxlIGl0IGluc3RhbGxzIC0gTGF1bmNoIHVubG9ja3Mgd2hlbiBpdCBmaW5pc2hlcydcbiAgICA6IGRvd25sb2FkaW5nR2d1ZiA/ICdZb3UgY2FuIGtlZXAgYWRqdXN0aW5nIHNldHRpbmdzIHdoaWxlIGl0IGRvd25sb2FkcyAtIExhdW5jaCB1bmxvY2tzIHdoZW4gaXQgZmluaXNoZXMnXG4gICAgOiBibG9ja2VkQnlOb0RpciA/ICdDaG9vc2UgYSBwcm9qZWN0IGZvbGRlciBiZWZvcmUgeW91IGNhbiBsYXVuY2gnXG4gICAgOiAnJztcbiAgY29uc3QgcmVjaGVjayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNoZWNrLWJ0bicpO1xuICBjb25zdCByZXN0YXJ0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhcnQtYnRuJyk7XG4gIGlmIChyZWNoZWNrKSByZWNoZWNrLmRpc2FibGVkID0gYmxvY2tlZEJ5V29yaztcbiAgaWYgKHJlc3RhcnQpIHJlc3RhcnQuZGlzYWJsZWQgPSBibG9ja2VkQnlXb3JrO1xufVxuXG5mdW5jdGlvbiByb3coaWQsIGNscywgaWNvbiwgdGl0bGUsIGRlc2NIdG1sLCBhY3Rpb25IdG1sID0gJycpIHtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiaXRlbSAke2Nsc31cIiBpZD1cIml0ZW0tJHtlc2MoaWQpfVwiPlxuICAgIDxkaXYgY2xhc3M9XCJpY29uXCI+JHtpY29ufTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJib2R5XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwidGl0bGVcIj4ke2VzYyh0aXRsZSl9PC9kaXY+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGVzY1wiPiR7ZGVzY0h0bWx9PC9kaXY+XG4gICAgICAke2FjdGlvbkh0bWwgPyBgPGRpdiBjbGFzcz1cImFjdGlvblwiPiR7YWN0aW9uSHRtbH08L2Rpdj5gIDogJyd9XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG59XG5cbi8vIOKUgOKUgCBkeW5hbWljIHN0YXR1cyBzbG90cyAoaW5wdXRzIGxpdmUgb3V0c2lkZSB0aGVzZSwgc28gYSByZS1jaGVjayBuZXZlclxuLy8gICAgd2lwZXMgYW55dGhpbmcgdGhlIHVzZXIgdHlwZWQpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG5mdW5jdGlvbiByZW5kZXJGZm1wZWdTbG90KHMpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmZtcGVnLXNsb3QnKTtcbiAgaWYgKHMuZmZtcGVnQnVuZGxlZCkge1xuICAgIGlmIChzLmZmbXBlZ09rKSB7XG4gICAgICBlbC5pbm5lckhUTUwgPSByb3coJ2ZmbXBlZycsICdvaycsICfinJMnLCAnRkZtcGVnJywgJ0luY2x1ZGVkIHdpdGggWXV1Q2xpcC4gVXNlZCB0byByZWFkIGFuZCBjdXQgdmlkZW8gZmlsZXMuJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGVsLmlubmVySFRNTCA9IHJvdygnZmZtcGVnJywgJ2VycicsICfinJcnLCAnRkZtcGVnIGluc3RhbGwgaXMgZGFtYWdlZCcsXG4gICAgICAnVGhlIEZGbXBlZyBidW5kbGVkIHdpdGggWXV1Q2xpcCBpcyBtaXNzaW5nIG9yIGRhbWFnZWQuIFJlaW5zdGFsbGluZyBZdXVDbGlwIHJlcGxhY2VzIGl0IC0gJyArXG4gICAgICAnZG93bmxvYWQgYSBmcmVzaCBpbnN0YWxsZXIgYmVsb3cuIElmIHRoZSBwcm9ibGVtIHBlcnNpc3RzIGFmdGVyIHRoYXQsIHBsZWFzZSByZXBvcnQgaXQuJyxcbiAgICAgIGA8ZGl2IHN0eWxlPVwiZGlzcGxheTpmbGV4O2dhcDo2cHg7YWxpZ24taXRlbXM6Y2VudGVyO3dpZHRoOjEwMCVcIj5gICtcbiAgICAgICAgYDxidXR0b24gY2xhc3M9XCJzbVwiIGRhdGEtb3Blbi11cmw9XCJodHRwczovL2dpdGh1Yi5jb20vc21pdGVoYW1uZXIveXV1LWNsaXAvcmVsZWFzZXNcIj5Eb3dubG9hZCB0aGUgbGF0ZXN0IGluc3RhbGxlcjwvYnV0dG9uPmAgK1xuICAgICAgICBgPGJ1dHRvbiBjbGFzcz1cInNtXCIgZGF0YS1vcGVuLXVybD1cImh0dHBzOi8vZ2l0aHViLmNvbS9zbWl0ZWhhbW5lci95dXUtY2xpcC9pc3N1ZXNcIj5SZXBvcnQgdGhpczwvYnV0dG9uPmAgK1xuICAgICAgYDwvZGl2PmApO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAocy5mZm1wZWdPaykge1xuICAgIGVsLmlubmVySFRNTCA9IHJvdygnZmZtcGVnJywgJ29rJywgJ+KckycsICdGRm1wZWcnLCAnRm91bmQgb24gUEFUSC4gVXNlZCB0byByZWFkIGFuZCBjdXQgdmlkZW8gZmlsZXMuJyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGVsLmlubmVySFRNTCA9IHJvdygnZmZtcGVnJywgJ2VycicsICfinJcnLCAnRkZtcGVnIG5vdCBmb3VuZCcsXG4gICAgJ1l1dUNsaXAgbmVlZHMgRkZtcGVnIHRvIHJlYWQgYW5kIGN1dCB2aWRlbyBmaWxlcy48YnI+JyArXG4gICAgJzxzdHJvbmc+RWFzaWVzdDo8L3N0cm9uZz4gcnVuIHRoaXMgY29tbWFuZCBpbiBhIHRlcm1pbmFsIChTdGFydCDihpIgdHlwZSA8ZW0+dGVybWluYWw8L2VtPiksICcgK1xuICAgICd0aGVuIGNsaWNrIDxlbT5DaGVjayBhZ2FpbjwvZW0+IGJlbG93IC0gbm8gbmVlZCB0byBjbG9zZSB0aGlzIHdpbmRvdy4nICtcbiAgICAnPGRldGFpbHM+PHN1bW1hcnk+Q2FuXFwndCB1c2Ugd2luZ2V0PyBNYW51YWwgaW5zdGFsbCBzdGVwczwvc3VtbWFyeT4nICtcbiAgICAnT3BlbiBneWFuLmRldiAoYnV0dG9uIGJlbG93KSwgZG93bmxvYWQgPGVtPmZmbXBlZy1yZWxlYXNlLWVzc2VudGlhbHMuemlwPC9lbT4gKG9yIGEgPGVtPkNVREE8L2VtPiBidWlsZCBmb3IgTlZJRElBIEdQVXMpLiAnICtcbiAgICAnRXh0cmFjdCB0aGUgemlwIHRvIGEgcGVybWFuZW50IGZvbGRlciAoZS5nLiA8Y29kZT5DOlxcXFxmZm1wZWc8L2NvZGU+KSwgdGhlbiBhZGQgaXRzIDxjb2RlPmJpblxcXFw8L2NvZGU+IHN1YmZvbGRlciB0byBQQVRIOjxicj4nICtcbiAgICAnMS4gT3BlbiBTdGFydCDihpIgc2VhcmNoIDxlbT5FZGl0IHRoZSBzeXN0ZW0gZW52aXJvbm1lbnQgdmFyaWFibGVzPC9lbT4g4oaSIGNsaWNrIGl0PGJyPicgK1xuICAgICcyLiBDbGljayA8ZW0+RW52aXJvbm1lbnQgVmFyaWFibGVzPC9lbT48YnI+JyArXG4gICAgJzMuIFVuZGVyIDxlbT5TeXN0ZW0gdmFyaWFibGVzPC9lbT4sIHNlbGVjdCA8ZW0+UGF0aDwvZW0+IOKGkiBjbGljayA8ZW0+RWRpdDwvZW0+PGJyPicgK1xuICAgICc0LiBDbGljayA8ZW0+TmV3PC9lbT4g4oaSIHBhc3RlIHRoZSBmdWxsIHBhdGggdG8gdGhlIDxjb2RlPmJpblxcXFw8L2NvZGU+IGZvbGRlciAoZS5nLiA8Y29kZT5DOlxcXFxmZm1wZWdcXFxcYmluPC9jb2RlPik8YnI+JyArXG4gICAgJzUuIENsaWNrIE9LIG9uIGFsbCBkaWFsb2dzLCB0aGVuIGNsaWNrIDxlbT5DaGVjayBhZ2FpbjwvZW0+IGJlbG93LicgK1xuICAgICc8L2RldGFpbHM+JyxcbiAgICBgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDtnYXA6NnB4O2FsaWduLWl0ZW1zOmNlbnRlcjt3aWR0aDoxMDAlXCI+YCArXG4gICAgICBgPGNvZGUgc3R5bGU9XCJmbGV4OjFcIj53aW5nZXQgaW5zdGFsbCBHeWFuLkZGbXBlZzwvY29kZT5gICtcbiAgICAgIGA8YnV0dG9uIGNsYXNzPVwic21cIiBkYXRhLWNvcHk9XCJ3aW5nZXQgaW5zdGFsbCBHeWFuLkZGbXBlZ1wiPkNvcHk8L2J1dHRvbj5gICtcbiAgICAgIGA8YnV0dG9uIGNsYXNzPVwic21cIiBkYXRhLW9wZW4tdXJsPVwiaHR0cHM6Ly93d3cuZ3lhbi5kZXYvZmZtcGVnL2J1aWxkcy9cIj5PcGVuIGd5YW4uZGV2PC9idXR0b24+YCArXG4gICAgYDwvZGl2PmBcbiAgKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyR3B1TGluZShzKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dwdS1saW5lJyk7XG4gIGlmIChzLmdwdS5uYW1lID09PSAnVW5rbm93bicpIHtcbiAgICBlbC50ZXh0Q29udGVudCA9ICdObyBkaXNjcmV0ZSBHUFUgZGV0ZWN0ZWQgLSBhbmFseXNpcyBydW5zIG9uIHRoZSBDUFUgKHNsb3dlciwgYnV0IHdvcmtzKS4nO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBMTE0gc2NvcmluZyBydW5zIG9uIGFueSB2ZW5kb3IncyBHUFUgKHZpYSB0aGUgYnVuZGxlZCBWdWxrYW4gZW5naW5lKTsgb25seVxuICAvLyBXaGlzcGVyIHRyYW5zY3JpcHRpb24gaXMgTlZJRElBL0NVREEtb25seSwgc28gdGhlIHR3byBhcmUgcmVwb3J0ZWQgc2VwYXJhdGVseS5cbiAgY29uc3QgZ3B1ID0gYERldGVjdGVkIEdQVTogJHtzLmdwdS5uYW1lfSAoJHtzLmdwdS52cmFtTUIudG9Mb2NhbGVTdHJpbmcoKX0gTUIgVlJBTSlgO1xuICBpZiAocy5ncHUudmVuZG9yID09PSAnbnZpZGlhJykge1xuICAgIGNvbnN0IGhhc1ZlcnNpb24gPSBzLmN1ZGEudmVyc2lvbiAmJiBzLmN1ZGEudmVyc2lvbiAhPT0gJ3Vua25vd24nO1xuICAgIGNvbnN0IGN1ZGFMYWJlbCA9IGhhc1ZlcnNpb24gPyBgQ1VEQSAke3MuY3VkYS52ZXJzaW9ufWAgOiAnQ1VEQSBkZXRlY3RlZCc7XG4gICAgZWwudGV4dENvbnRlbnQgPSBzLmN1ZGEuYXZhaWxhYmxlXG4gICAgICA/IGAke2dwdX0gLSAke2N1ZGFMYWJlbH0uIFlvdXIgR1BVIHNwZWVkcyB1cCBib3RoIHRyYW5zY3JpcHRpb24gYW5kIExMTSBzY29yaW5nLmBcbiAgICAgIDogYCR7Z3B1fSAtIHlvdXIgR1BVIHNwZWVkcyB1cCBMTE0gc2NvcmluZy4gQWRkIENVREEgKGJlbG93KSB0byBhbHNvIHNwZWVkIHVwIHRyYW5zY3JpcHRpb24uYDtcbiAgfSBlbHNlIHtcbiAgICBlbC50ZXh0Q29udGVudCA9IGAke2dwdX0gLSB5b3VyIEdQVSBzcGVlZHMgdXAgTExNIHNjb3JpbmcuIFRyYW5zY3JpcHRpb24gcnVucyBvbiB0aGUgQ1BVIChHUFUgdHJhbnNjcmlwdGlvbiBuZWVkcyBhbiBOVklESUEgY2FyZCkuYDtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW5kZXJDdWRhU2xvdChzKSB7XG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2N1ZGEtc2xvdCcpO1xuICAvLyBTaG93IHRoZSBcIk9wdGlvbmFsXCIgc2VjdGlvbiBoZWFkZXIgb25seSB3aGVuIGl0IGhhcyBhIHZpc2libGUgcm93OyBhbiBlbXB0eVxuICAvLyB0aXRsZWQgc2VjdGlvbiAoZS5nLiBvbiBhIG5vbi1OVklESUEgbWFjaGluZSwgd2hlcmUgQ1VEQSBpcyB0aGUgb25seSBvcHRpb25hbFxuICAvLyBpdGVtKSByZWFkcyBhcyBhIGxvYWQgZXJyb3IuXG4gIGNvbnN0IHNldFNsb3QgPSAoaHRtbCkgPT4ge1xuICAgIGVsLmlubmVySFRNTCA9IGh0bWw7XG4gICAgY29uc3Qgc2VjdGlvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcHRpb25hbC1zZWN0aW9uJyk7XG4gICAgaWYgKHNlY3Rpb24pIHNlY3Rpb24uc3R5bGUuZGlzcGxheSA9IGh0bWwgPyAnJyA6ICdub25lJztcbiAgfTtcbiAgaWYgKHMuZ3B1LnZlbmRvciAhPT0gJ252aWRpYScpIHsgc2V0U2xvdCgnJyk7IHJldHVybjsgfVxuICBpZiAocy5jdWRhTGlic0luc3RhbGxlZCB8fCBzLmN1ZGEuYXZhaWxhYmxlKSB7XG4gICAgc2V0U2xvdChyb3coJ2N1ZGEnLCAnb2snLCAn4pyTJywgJ0Zhc3RlciB0cmFuc2NyaXB0aW9uIHJlYWR5JyxcbiAgICAgICdUaGUgQ1VEQSBzdXBwb3J0IGxpYnJhcmllcyBhcmUgYXZhaWxhYmxlIC0gdHJhbnNjcmlwdGlvbiBydW5zIG9uIHlvdXIgTlZJRElBIEdQVS4nKSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHNldFNsb3Qocm93KCdjdWRhJywgJ3dhcm4nLCAn4peLJywgJ0Zhc3RlciB0cmFuc2NyaXB0aW9uIChvcHRpb25hbCknLFxuICAgIGBZb3VyIE5WSURJQSBHUFUgY2FuIHRyYW5zY3JpYmUgbXVjaCBmYXN0ZXIgdGhhbiB0aGUgQ1BVLiBUaGlzIG9uZS10aW1lIGluc3RhbGwgYCArXG4gICAgYGFkZHMgdGhlIENVREEgc3VwcG9ydCBsaWJyYXJpZXMgKGN1QkxBUyArIGN1RE5OLCB+MSBHQikuIFlvdSBjYW4ga2VlcCBhZGp1c3RpbmcgYCArXG4gICAgYHNldHRpbmdzIHdoaWxlIGl0IGluc3RhbGxzIC0gTGF1bmNoIHVubG9ja3Mgd2hlbiBpdCBmaW5pc2hlcy4gKExMTSBzY29yaW5nIGFscmVhZHkgYCArXG4gICAgYHVzZXMgeW91ciBHUFUgLSB0aGlzIG9ubHkgc3BlZWRzIHVwIHRyYW5zY3JpcHRpb24uKWAsXG4gICAgYDxidXR0b24gY2xhc3M9XCJzbVwiIGlkPVwiaW5zdGFsbC1idG4tY3VkYS1saWJzXCIgZGF0YS1pbnN0YWxsPVwiY3VkYS1saWJzXCI+U3BlZWQgdXAgdHJhbnNjcmlwdGlvbiAofjEgR0IpPC9idXR0b24+XG4gICAgIDxidXR0b24gY2xhc3M9XCJzbVwiIGlkPVwiaW5zdGFsbC1jYW5jZWwtY3VkYS1saWJzXCIgZGF0YS1hY3Rpb249XCJpbnN0YWxsLWNhbmNlbFwiIHN0eWxlPVwiZGlzcGxheTpub25lXCI+Q2FuY2VsPC9idXR0b24+XG4gICAgIDxkaXYgY2xhc3M9XCJwdWxsLW1zZ1wiIGlkPVwiaW5zdGFsbC1tc2ctY3VkYS1saWJzXCI+PC9kaXY+YCkpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJHZ3VmRG93bmxvYWRTbG90KHMpIHtcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1kb3dubG9hZC1zbG90Jyk7XG4gIGlmICghZWwpIHJldHVybjtcbiAgaWYgKGRvd25sb2FkaW5nR2d1ZikgcmV0dXJuOyAvLyBwcmVzZXJ2ZSB0aGUgaW4tcHJvZ3Jlc3MgYmFyIGFjcm9zcyBhIHN0YXR1cyByZS1yZW5kZXJcbiAgY29uc3QgY3VycmVudFBhdGggPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykudmFsdWUgfHwgJycpLnRyaW0oKTtcbiAgaWYgKGN1cnJlbnRQYXRoKSB7IGVsLmlubmVySFRNTCA9ICcnOyByZXR1cm47IH1cbiAgY29uc3QgcmVjID0gQ0FUQUxPRy5yZWNvbW1lbmRlZF9tb2RlbCB8fCB7fTtcbiAgY29uc3QgcmVjTmFtZSA9IHJlYy5kaXNwbGF5X25hbWUgfHwgJ3RoZSByZWNvbW1lbmRlZCBtb2RlbCc7XG4gIGNvbnN0IHJlY1NpemUgPSByZWMuc2l6ZV9nYiAhPSBudWxsID8gYH4ke3JlYy5zaXplX2difSBHQmAgOiAnJztcbiAgZWwuaW5uZXJIVE1MID0gcm93KCdnZ3VmLWRvd25sb2FkJywgJ3dhcm4nLCAn4peLJywgJ0Rvd25sb2FkIHRoZSByZWNvbW1lbmRlZCBtb2RlbCcsXG4gICAgYCR7ZXNjKHJlY05hbWUpfSAoJHtlc2MocmVjLmxpY2VuY2UgfHwgJycpfSwgc28gY2xpcHMgeW91IG1ha2UgY2FuIGJlIG1vbmV0aXplZClgICtcbiAgICBgJHtyZWNTaXplID8gJywgJyArIHJlY1NpemUgOiAnJ30uIFlvdSBjYW4ga2VlcCB1c2luZyB0aGlzIHdpbmRvdyB3aGlsZSBpdCBkb3dubG9hZHMuYCxcbiAgICBgPGJ1dHRvbiBjbGFzcz1cInNtXCIgaWQ9XCJnZ3VmLWRvd25sb2FkLWJ0blwiIGRhdGEtYWN0aW9uPVwiZ2d1Zi1kb3dubG9hZFwiPkRvd25sb2FkIHJlY29tbWVuZGVkIG1vZGVsJHtyZWNTaXplID8gJyAoJyArIGVzYyhyZWNTaXplKSArICcpJyA6ICcnfTwvYnV0dG9uPlxuICAgICA8YnV0dG9uIGNsYXNzPVwic21cIiBpZD1cImdndWYtY2FuY2VsLWJ0blwiIGRhdGEtYWN0aW9uPVwiZ2d1Zi1jYW5jZWxcIiBzdHlsZT1cImRpc3BsYXk6bm9uZVwiPkNhbmNlbDwvYnV0dG9uPlxuICAgICA8ZGl2IGNsYXNzPVwicHVsbC1iYXJcIiBpZD1cImdndWYtZG93bmxvYWQtYmFyXCIgc3R5bGU9XCJkaXNwbGF5Om5vbmU7d2lkdGg6MTAwJTttYXJnaW4tdG9wOjVweFwiPjxkaXYgY2xhc3M9XCJwdWxsLWZpbGxcIiBpZD1cImdndWYtZG93bmxvYWQtZmlsbFwiPjwvZGl2PjwvZGl2PlxuICAgICA8ZGl2IGNsYXNzPVwicHVsbC1tc2dcIiBpZD1cImdndWYtZG93bmxvYWQtbXNnXCI+PC9kaXY+YCk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlclNsb3RzKHMpIHtcbiAgc3RhdHVzID0gcztcbiAgcmVuZGVyRmZtcGVnU2xvdChzKTtcbiAgcmVuZGVyR3B1TGluZShzKTtcbiAgcmVuZGVyQ3VkYVNsb3Qocyk7XG4gIHJlbmRlckdndWZEb3dubG9hZFNsb3Qocyk7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJ0aXRsZScpLnRleHRDb250ZW50ID1cbiAgICBtb2RlID09PSAndXBkYXRlJyA/ICdUaGlzIHVwZGF0ZSBhZGRlZCBuZXcgc2V0dXAgb3B0aW9ucyAtIHJldmlldywgdGhlbiBsYXVuY2guJ1xuICAgIDogcy5mZm1wZWdPayA/ICdTeXN0ZW0gY2hlY2sgY29tcGxldGUuJ1xuICAgIDogJ0FjdGlvbiByZXF1aXJlZCBiZWZvcmUgeW91IGNhbiBsYXVuY2guJztcbiAgdXBkYXRlTGF1bmNoQnRuKCk7XG59XG5cbi8vIEJ1aWxkIHRoZSB3aGlzcGVyIC8gQUktcHJpdmFjeSAvIGNvbnRlbnQtcHJlc2V0IDxvcHRpb24+IGxpc3RzIGZyb20gdGhlIHNoYXJlZFxuLy8gY2F0YWxvZyBzbyB0aGVpciBjb3B5IGlzIHNpbmdsZS1zb3VyY2VkIChzZWUgYHl1dS1kZXYgc2hhcmVkLWRhdGFgKS4gUnVucyBvbmNlLFxuLy8gYmVmb3JlIGFwcGx5RGVmYXVsdHMgc2V0cyB0aGUgc2F2ZWQgdmFsdWVzLlxuZnVuY3Rpb24gcG9wdWxhdGVDYXRhbG9nU2VsZWN0cygpIHtcbiAgY29uc3QgZmlsbCA9IChpZCwgaXRlbXMsIHZhbHVlLCBsYWJlbCkgPT4ge1xuICAgIGNvbnN0IHNlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtcbiAgICBpZiAoIXNlbCkgcmV0dXJuO1xuICAgIHNlbC5pbm5lckhUTUwgPSBpdGVtc1xuICAgICAgLm1hcChpdCA9PiBgPG9wdGlvbiB2YWx1ZT1cIiR7ZXNjKHZhbHVlKGl0KSl9XCI+JHtlc2MobGFiZWwoaXQpKX08L29wdGlvbj5gKVxuICAgICAgLmpvaW4oJycpO1xuICB9O1xuICBmaWxsKCd3aGlzcGVyLXNlbCcsIENBVEFMT0cud2hpc3Blcl9tb2RlbHMgfHwgW10sIG0gPT4gbS5pZCwgbSA9PiBtLm9wdGlvbl90ZXh0KTtcbiAgZmlsbCgnYWktcHJpdmFjeS1zZWwnLCBDQVRBTE9HLmFpX3ByaXZhY3lfb3B0aW9ucyB8fCBbXSwgbyA9PiBvLnZhbHVlLCBvID0+IG8ubGFiZWwpO1xuICBmaWxsKCdjb250ZW50LXByZXNldC1zZWwnLCBDQVRBTE9HLmNvbnRlbnRfcHJlc2V0cyB8fCBbXSwgcCA9PiBwLmlkLCBwID0+IHAubmFtZSk7XG5cbiAgY29uc3QgcmVjID0gQ0FUQUxPRy5yZWNvbW1lbmRlZF9tb2RlbCB8fCB7fTtcbiAgY29uc3Qgc2l6ZVRleHQgPSByZWMuc2l6ZV9nYiAhPSBudWxsID8gYCR7cmVjLnNpemVfZ2J9IEdCYCA6ICcnO1xuICBjb25zdCBzZXRUZXh0ID0gKGlkLCB0ZXh0KSA9PiB7IGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpOyBpZiAoZWwgJiYgdGV4dCkgZWwudGV4dENvbnRlbnQgPSB0ZXh0OyB9O1xuICBzZXRUZXh0KCdyZWMtbW9kZWwtc2l6ZS1pbmxpbmUnLCBzaXplVGV4dCk7XG4gIHNldFRleHQoJ3JlYy1tb2RlbC1zaXplLWFkdicsIHNpemVUZXh0KTtcbn1cblxuLy8gRmlyc3QgcmVuZGVyIG9ubHk6IGZpbGwgdGhlIGZvcm0gZnJvbSBzYXZlZCBjb25maWcgLyBkZXRlY3RlZCBkZWZhdWx0cy5cbmZ1bmN0aW9uIGFwcGx5RGVmYXVsdHMocykge1xuICBpZiAoZGVmYXVsdHNBcHBsaWVkKSByZXR1cm47XG4gIGRlZmF1bHRzQXBwbGllZCA9IHRydWU7XG5cbiAgcG9wdWxhdGVDYXRhbG9nU2VsZWN0cygpO1xuXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwcm9qZWN0LWRpcicpLnZhbHVlID0gcy5wcm9qZWN0RGlyO1xuICBjb25zdCB3aGlzcGVyU2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3doaXNwZXItc2VsJyk7XG4gIHdoaXNwZXJTZWwudmFsdWUgPSBzLndoaXNwZXJNb2RlbCB8fCBzLnJlY29tbWVuZGVkV2hpc3Blci5tb2RlbDtcbiAgaWYgKCF3aGlzcGVyU2VsLnZhbHVlKSB3aGlzcGVyU2VsLnZhbHVlID0gcy5yZWNvbW1lbmRlZFdoaXNwZXIubW9kZWw7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWMtdGFnJykudGV4dENvbnRlbnQgPSAn4oaQIHJlY29tbWVuZGVkJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlYy10YWcnKS50aXRsZSA9IHMucmVjb21tZW5kZWRXaGlzcGVyLnJlYXNvbjtcblxuICBjb25zdCBsYW5nU2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3doaXNwZXItbGFuZy1zZWwnKTtcbiAgbGFuZ1NlbC5pbm5lckhUTUwgPSBsYW5ndWFnZU9wdGlvbnNIdG1sKFdISVNQRVJfTEFOR1VBR0VTKTtcbiAgbGFuZ1NlbC52YWx1ZSA9IFdISVNQRVJfTEFOR1VBR0VTLmluY2x1ZGVzKHMud2hpc3Blckxhbmd1YWdlKSA/IHMud2hpc3Blckxhbmd1YWdlIDogJyc7XG5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FpLXByaXZhY3ktc2VsJykudmFsdWUgPSBzLmFpUHJpdmFjeU1vZGUgfHwgJ2xvY2FsX29ubHknO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSAgPSBzLmxsbU1vZGVsUGF0aCB8fCAnJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRlbnQtcHJlc2V0LXNlbCcpLnZhbHVlID0gcy5jb250ZW50UHJlc2V0IHx8ICdnZW5lcmljJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRlbnQtcHJlc2V0LW5vdGUnKS50ZXh0Q29udGVudCA9XG4gICAgJ05vdCBzdXJlPyBHZW5lcmljIGlzIGEgZ29vZCBkZWZhdWx0LiBZb3UgY2FuIGZpbmUtdHVuZSBldmVyeSBzY29yaW5nIHdlaWdodCBsYXRlciBpbiBTZXR0aW5ncy4nO1xuXG4gIGNvbnN0IHJlYyA9IHMubG9jYWxNb2RlbFJlY29tbWVuZGF0aW9uIHx8IHt9O1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLXJlYy1oZWFkbGluZScpLnRleHRDb250ZW50ID0gcmVjLmhlYWRsaW5lIHx8ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLXJlYy1yZWFzb24nKS50ZXh0Q29udGVudCAgID0gcmVjLnJlYXNvbiB8fCAnJztcbiAgLy8gUHJlLXNlbGVjdCBsb2NhbCBBSSBhcyB0aGUgcmVjb21tZW5kZWQgcGF0aCB1bmxlc3MgdGhlIG1hY2hpbmUgY2FuJ3QgZml0IHRoZVxuICAvLyBtb2RlbCAocHVzaCAnbm9uZScpOyBhbiBleGlzdGluZyBtb2RlbCBmaWxlIGFsc28ga2VlcHMgbG9jYWwgc2VsZWN0ZWQgKHRoZVxuICAvLyBidWlsZCBzdGVwIHdvbid0IHJlLXF1ZXVlIGEgZG93bmxvYWQgd2hlbiBhIHBhdGggaXMgYWxyZWFkeSBzZXQpLlxuICBjb25zdCBoYXNFeGlzdGluZ01vZGVsID0gQm9vbGVhbigocy5sbG1Nb2RlbFBhdGggfHwgJycpLnRyaW0oKSk7XG4gIGNvbnN0IHByZWZlckxvY2FsID0gaGFzRXhpc3RpbmdNb2RlbCB8fCByZWMucHVzaCA9PT0gJ3N0cm9uZycgfHwgcmVjLnB1c2ggPT09ICdzb2Z0JztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLXllcycpLmNoZWNrZWQgPSBwcmVmZXJMb2NhbDtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLW5vJykuY2hlY2tlZCAgPSAhcHJlZmVyTG9jYWw7XG4gIG9uTG9jYWxBaUNob2ljZUNoYW5nZSgpO1xuXG4gIG9uUHJpdmFjeU1vZGVDaGFuZ2UoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FpLXByaXZhY3ktc2VsJykudmFsdWUpO1xuXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdpdGVtLWluaXQnKS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VjdGlvbnMnKS5zdHlsZS5kaXNwbGF5ICA9ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1iYXInKS5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gIGlmIChyZXJ1bk1vZGUpIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXJ1bi1ub3RlJykuc3R5bGUuZGlzcGxheSA9ICcnO1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVpdC1idG4nKS50ZXh0Q29udGVudCA9XG4gICAgcmVydW5Nb2RlID8gJ0Nsb3NlJyA6IG1vZGUgPT09ICd1cGRhdGUnID8gJ1NraXAgZm9yIG5vdycgOiAnUXVpdCc7XG59XG5cbi8vIOKUgOKUgCBBSSBwcml2YWN5ICsgbG9jYWwgbW9kZWwg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbi8vIHl1dS1jbGlwIGlzIGxvY2FsLW9ubHk7IHRoZSBtb2RlIHRvZ2dsZXMgd2hldGhlciBhIGdlbmVyYXRpdmUgbW9kZWwgcnVucyBhdCBhbGwuXG4vLyBDb3B5IGNvbWVzIGZyb20gdGhlIHNoYXJlZCBjYXRhbG9nIChzaW5nbGUgc291cmNlIGZvciB0aGUgd2l6YXJkICsgd2ViIFNldHRpbmdzKS5cbmNvbnN0IEFJX1BSSVZBQ1lfTk9URVMgPSBDQVRBTE9HLmFpX3ByaXZhY3lfbm90ZXMgfHwge307XG5cbmZ1bmN0aW9uIG9uUHJpdmFjeU1vZGVDaGFuZ2UobW9kZSkge1xuICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWktcHJpdmFjeS1ub3RlJykudGV4dENvbnRlbnQgPSBBSV9QUklWQUNZX05PVEVTW21vZGVdIHx8ICcnO1xuICBjb25zdCBsbG1CbG9jayA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tZ2VuZXJhdGl2ZS1ibG9jaycpO1xuICBpZiAobGxtQmxvY2spIGxsbUJsb2NrLnN0eWxlLmRpc3BsYXkgPSBtb2RlID09PSAnbm9uZScgPyAnbm9uZScgOiAnJztcbiAgdXBkYXRlTGxtV2FybigpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVMbG1XYXJuKCkge1xuICBjb25zdCBmaWxlUGF0aCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGxtLW1vZGVsLXBhdGgnKS52YWx1ZSB8fCAnJykudHJpbSgpO1xuICBjb25zdCB3YW50c0xvY2FsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLXllcycpLmNoZWNrZWQ7XG4gIC8vIFdpdGggXCJTZXQgdXAgbG9jYWwgQUlcIiBjaG9zZW4sIHRoZSByZWNvbW1lbmRlZCBtb2RlbCBpcyBxdWV1ZWQgZm9yIGEgYmFja2dyb3VuZFxuICAvLyBkb3dubG9hZCBvbiBsYXVuY2ggLSBzbyBcIkxMTSBzY29yaW5nIHdpbGwgYmUgc2tpcHBlZFwiIHdvdWxkIGJlIHdyb25nLiBPbmx5IHdhcm5cbiAgLy8gd2hlbiB0aGVyZSdzIG5vIGZpbGUsIG5vdGhpbmcgZG93bmxvYWRpbmcsIGFuZCBubyBiYWNrZ3JvdW5kIGRvd25sb2FkIGNvbWluZy5cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS13YXJuJykuc3R5bGUuZGlzcGxheSA9XG4gICAgKCFmaWxlUGF0aCAmJiAhZG93bmxvYWRpbmdHZ3VmICYmICF3YW50c0xvY2FsKSA/ICdibG9jaycgOiAnbm9uZSc7XG4gIGlmIChzdGF0dXMpIHJlbmRlckdndWZEb3dubG9hZFNsb3Qoc3RhdHVzKTtcbn1cblxuZnVuY3Rpb24gb25Mb2NhbEFpQ2hvaWNlQ2hhbmdlKCkge1xuICBjb25zdCBsaWdodHdlaWdodCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2NhbC1haS1ubycpLmNoZWNrZWQ7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaWdodHdlaWdodC1ub3RlJykuc3R5bGUuZGlzcGxheSA9IGxpZ2h0d2VpZ2h0ID8gJycgOiAnbm9uZSc7XG4gIC8vIFRoZSBjaG9pY2UgZ292ZXJucyB3aGV0aGVyIHRoZSBMTE0gbW9kZWwgaXMgcXVldWVkIGZvciBhIGJhY2tncm91bmQgZG93bmxvYWQsXG4gIC8vIHdoaWNoIGRlY2lkZXMgd2hldGhlciB0aGUgXCJ3aWxsIGJlIHNraXBwZWRcIiB3YXJuaW5nIGlzIGFjY3VyYXRlIC0ga2VlcCBpdCBpbiBzeW5jLlxuICB1cGRhdGVMbG1XYXJuKCk7XG59XG5cbi8vIOKUgOKUgCBHR1VGIG1vZGVsIG9uZS1jbGljayBkb3dubG9hZCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuZnVuY3Rpb24gc3RhcnRHZ3VmRG93bmxvYWQoKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLWJ0bicpO1xuICBjb25zdCBjYW5jZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1jYW5jZWwtYnRuJyk7XG4gIGNvbnN0IGJhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWRvd25sb2FkLWJhcicpO1xuICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICBpZiAoY2FuY2VsKSB7IGNhbmNlbC5zdHlsZS5kaXNwbGF5ID0gJyc7IGNhbmNlbC5kaXNhYmxlZCA9IGZhbHNlOyB9XG4gIGlmIChiYXIpIGJhci5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gIGRvd25sb2FkaW5nR2d1ZiA9IHRydWU7XG4gIHVwZGF0ZUxhdW5jaEJ0bigpO1xuICB1cGRhdGVMbG1XYXJuKCk7IC8vIGhpZGUgdGhlIFwibm8gbW9kZWwgZmlsZSBjaG9zZW5cIiB3YXJuaW5nIHdoaWxlIHRoZSBkb3dubG9hZCBydW5zXG4gIGFwaS5kb3dubG9hZEdndWZNb2RlbCgpO1xufVxuXG5mdW5jdGlvbiBjYW5jZWxHZ3VmRG93bmxvYWQoKSB7XG4gIGNvbnN0IGNhbmNlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWNhbmNlbC1idG4nKTtcbiAgaWYgKGNhbmNlbCkgY2FuY2VsLmRpc2FibGVkID0gdHJ1ZTtcbiAgYXBpLmNhbmNlbEdndWZEb3dubG9hZCgpO1xufVxuXG5mdW5jdGlvbiBvbkdndWZEb3dubG9hZFByb2dyZXNzKGRhdGEpIHtcbiAgY29uc3QgZmlsbCAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtZG93bmxvYWQtZmlsbCcpO1xuICBjb25zdCBtc2cgICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZ2d1Zi1kb3dubG9hZC1tc2cnKTtcbiAgY29uc3QgYnRuICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dndWYtZG93bmxvYWQtYnRuJyk7XG4gIGNvbnN0IGNhbmNlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnZ3VmLWNhbmNlbC1idG4nKTtcbiAgY29uc3QgZG9uZSA9ICgpID0+IHsgZG93bmxvYWRpbmdHZ3VmID0gZmFsc2U7IGlmIChjYW5jZWwpIGNhbmNlbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnOyB1cGRhdGVMYXVuY2hCdG4oKTsgdXBkYXRlTGxtV2FybigpOyB9O1xuICBpZiAoZGF0YS5kb25lKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykudmFsdWUgPSBkYXRhLnBhdGg7XG4gICAgdXBkYXRlTGxtV2FybigpOyAvLyBhbHNvIHJlLXJlbmRlcnMgdGhlIGRvd25sb2FkIHNsb3QsIG5vdyBoaWRkZW4gc2luY2UgdGhlIHBhdGggaXMgc2V0XG4gICAgZG9uZSgpO1xuICB9IGVsc2UgaWYgKGRhdGEuY2FuY2VsbGVkKSB7XG4gICAgaWYgKG1zZykgbXNnLnRleHRDb250ZW50ID0gJ0Rvd25sb2FkIGNhbmNlbGxlZC4nO1xuICAgIGlmIChmaWxsKSBmaWxsLnN0eWxlLndpZHRoID0gJzAlJztcbiAgICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBkb25lKCk7XG4gIH0gZWxzZSBpZiAoZGF0YS5lcnJvcikge1xuICAgIGlmIChtc2cpIG1zZy50ZXh0Q29udGVudCA9IGBEb3dubG9hZCBmYWlsZWQ6ICR7ZGF0YS5lcnJvcn1gO1xuICAgIGlmIChmaWxsKSBmaWxsLnN0eWxlLndpZHRoID0gJzAlJzsgIC8vIGRvbid0IGxlYXZlIGEgaGFsZi1mdWxsIGJhciBvbiBhIGZhaWx1cmVcbiAgICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBkb25lKCk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEucHJvZ3Jlc3MgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKGZpbGwpIGZpbGwuc3R5bGUud2lkdGggPSBkYXRhLnByb2dyZXNzICsgJyUnO1xuICAgIC8vIFNob3cgYWJzb2x1dGUgR0IgYWxvbmdzaWRlIHRoZSBwZXJjZW50IHdoZW4gd2Uga25vdyB0aGUgbW9kZWwgc2l6ZS5cbiAgICBjb25zdCBzaXplR2IgPSAoQ0FUQUxPRy5yZWNvbW1lbmRlZF9tb2RlbCB8fCB7fSkuc2l6ZV9nYjtcbiAgICBjb25zdCBkb25lR2IgPSBzaXplR2IgIT0gbnVsbCA/IGAgKCR7KGRhdGEucHJvZ3Jlc3MgLyAxMDAgKiBzaXplR2IpLnRvRml4ZWQoMSl9IG9mICR7c2l6ZUdifSBHQilgIDogJyc7XG4gICAgaWYgKG1zZykgIG1zZy50ZXh0Q29udGVudCAgPSBgRG93bmxvYWRpbmfigKYgJHtkYXRhLnByb2dyZXNzfSUke2RvbmVHYn1gO1xuICB9XG59XG5cbi8vIOKUgOKUgCBvcHRpb25hbCBwYWNrYWdlIGluc3RhbGxzIChwaXAgaW50byB0aGUgdmVudikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbmZ1bmN0aW9uIHN0YXJ0SW5zdGFsbChzbHVnKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBpbnN0YWxsLWJ0bi0ke3NsdWd9YCk7XG4gIGNvbnN0IGNhbmNlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBpbnN0YWxsLWNhbmNlbC0ke3NsdWd9YCk7XG4gIGNvbnN0IG1zZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBpbnN0YWxsLW1zZy0ke3NsdWd9YCk7XG4gIGlmIChidG4pIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIGlmIChjYW5jZWwpIHsgY2FuY2VsLnN0eWxlLmRpc3BsYXkgPSAnJzsgY2FuY2VsLmRpc2FibGVkID0gZmFsc2U7IH1cbiAgaWYgKG1zZykgbXNnLnRleHRDb250ZW50ID0gJ1N0YXJ0aW5n4oCmJztcbiAgaW5zdGFsbGluZ1tzbHVnXSA9IHRydWU7XG4gIHVwZGF0ZUxhdW5jaEJ0bigpO1xuICBhcGkuaW5zdGFsbFBhY2thZ2Uoc2x1Zyk7XG59XG5cbmZ1bmN0aW9uIGNhbmNlbEluc3RhbGwoc2x1Zykge1xuICBjb25zdCBjYW5jZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgaW5zdGFsbC1jYW5jZWwtJHtzbHVnfWApO1xuICBpZiAoY2FuY2VsKSBjYW5jZWwuZGlzYWJsZWQgPSB0cnVlO1xuICBhcGkuY2FuY2VsSW5zdGFsbCgpO1xufVxuXG5mdW5jdGlvbiBvbkluc3RhbGxQcm9ncmVzcyhkYXRhKSB7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBpbnN0YWxsLWJ0bi0ke2RhdGEuc2x1Z31gKTtcbiAgY29uc3QgY2FuY2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGluc3RhbGwtY2FuY2VsLSR7ZGF0YS5zbHVnfWApO1xuICBjb25zdCBtc2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgaW5zdGFsbC1tc2ctJHtkYXRhLnNsdWd9YCk7XG4gIGlmIChjYW5jZWwgJiYgKGRhdGEuZG9uZSB8fCBkYXRhLmVycm9yIHx8IGRhdGEuY2FuY2VsbGVkKSkgY2FuY2VsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gIGlmIChkYXRhLmRvbmUpIHtcbiAgICBpbnN0YWxsaW5nW2RhdGEuc2x1Z10gPSBmYWxzZTtcbiAgICBpZiAoZGF0YS5zbHVnID09PSAnY3VkYS1saWJzJykgeyBzdGF0dXMuY3VkYUxpYnNJbnN0YWxsZWQgPSB0cnVlOyByZW5kZXJDdWRhU2xvdChzdGF0dXMpOyB9XG4gICAgdXBkYXRlTGF1bmNoQnRuKCk7XG4gIH0gZWxzZSBpZiAoZGF0YS5jYW5jZWxsZWQpIHtcbiAgICBpbnN0YWxsaW5nW2RhdGEuc2x1Z10gPSBmYWxzZTtcbiAgICBpZiAobXNnKSBtc2cudGV4dENvbnRlbnQgPSAnSW5zdGFsbCBjYW5jZWxsZWQuJztcbiAgICBpZiAoYnRuKSBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICB1cGRhdGVMYXVuY2hCdG4oKTtcbiAgfSBlbHNlIGlmIChkYXRhLmVycm9yKSB7XG4gICAgaW5zdGFsbGluZ1tkYXRhLnNsdWddID0gZmFsc2U7XG4gICAgLy8gR1BVIGFjY2VsZXJhdGlvbiBpcyBuZXZlciByZXF1aXJlZCAtIHJlYXNzdXJlIHRoZSB1c2VyIHRoZXkgY2FuIHN0aWxsIGxhdW5jaC5cbiAgICBjb25zdCBjcHVOb3RlID0gZGF0YS5zbHVnID09PSAnY3VkYS1saWJzJ1xuICAgICAgPyAnIFlvdSBjYW4gc3RpbGwgbGF1bmNoIC0gdHJhbnNjcmlwdGlvbiB3aWxsIHJ1biBvbiB0aGUgQ1BVLidcbiAgICAgIDogJyc7XG4gICAgaWYgKG1zZykgbXNnLnRleHRDb250ZW50ID0gYEluc3RhbGwgZmFpbGVkOiAke2RhdGEuZXJyb3J9JHtjcHVOb3RlfWA7XG4gICAgaWYgKGJ0bikgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgdXBkYXRlTGF1bmNoQnRuKCk7XG4gIH0gZWxzZSBpZiAoZGF0YS5zdGF0dXMpIHtcbiAgICBpZiAobXNnKSBtc2cudGV4dENvbnRlbnQgPSBkYXRhLnN0YXR1cztcbiAgfVxufVxuXG4vLyDilIDilIAgcmUtY2hlY2sgLyByZXN0YXJ0IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG5hc3luYyBmdW5jdGlvbiByZWNoZWNrKCkge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVjaGVjay1idG4nKTtcbiAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgY29uc3Qgb3JpZ2luYWwgPSBidG4udGV4dENvbnRlbnQ7XG4gIGJ0bi50ZXh0Q29udGVudCA9ICdDaGVja2luZ+KApic7XG4gIHRyeSB7XG4gICAgcmVuZGVyU2xvdHMoYXdhaXQgYXBpLmdldFN0YXR1cygpKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBidG4udGV4dENvbnRlbnQgPSBvcmlnaW5hbDtcbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICB1cGRhdGVMYXVuY2hCdG4oKTtcbiAgfVxufVxuXG4vLyDilIDilIAgVUkgZXZlbnRzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4vLyBFdmVudCBkZWxlZ2F0aW9uIGZvciBldmVyeSBidXR0b24gaW5qZWN0ZWQgdmlhIGlubmVySFRNTCAoc2xvdHMgcmUtcmVuZGVyIG9uIGVhY2hcbi8vIHN0YXR1cyByZWZyZXNoKS4gSW5saW5lIG9uLWV2ZW50IGhhbmRsZXJzIGNhbid0IGJlIHVzZWQgaGVyZTogdGhpcyBmaWxlIGlzIGJ1bmRsZWRcbi8vIGludG8gYW4gSUlGRSwgc28gbW9kdWxlLXNjb3BlZCBmdW5jdGlvbnMgbGlrZSBzdGFydEdndWZEb3dubG9hZCBhcmUgbmVpdGhlciBnbG9iYWxcbi8vIChpbmxpbmUgaGFuZGxlcnMgcmVzb2x2ZSBvbiB3aW5kb3cpIG5vciBldmVuIHByZXNlbnQgKGVzYnVpbGQgdHJlZS1zaGFrZXMgZnVuY3Rpb25zXG4vLyByZWZlcmVuY2VkIG9ubHkgZnJvbSBzdHJpbmcgbGl0ZXJhbHMpLiBUaGUgc3RhdGljIGd1YXJkIGluXG4vLyB0ZXN0L3NldHVwLXJlbmRlcmVyLWhhbmRsZXJzLnRlc3QuanMga2VlcHMgaW5saW5lIGhhbmRsZXJzIGZyb20gY3JlZXBpbmcgYmFjay5cbmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZSA9PiB7XG4gIGNvbnN0IGNvcHlCdG4gPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1jb3B5XScpO1xuICBpZiAoY29weUJ0bikge1xuICAgIGFwaS5jb3B5VGV4dChjb3B5QnRuLmRhdGFzZXQuY29weSk7XG4gICAgY29uc3Qgb3JpZ2luYWwgPSBjb3B5QnRuLnRleHRDb250ZW50O1xuICAgIGNvcHlCdG4udGV4dENvbnRlbnQgPSAnQ29waWVkISc7XG4gICAgc2V0VGltZW91dCgoKSA9PiB7IGNvcHlCdG4udGV4dENvbnRlbnQgPSBvcmlnaW5hbDsgfSwgMTIwMCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IHVybEJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLW9wZW4tdXJsXScpO1xuICBpZiAodXJsQnRuKSB7IGFwaS5vcGVuVVJMKHVybEJ0bi5kYXRhc2V0Lm9wZW5VcmwpOyByZXR1cm47IH1cbiAgY29uc3QgaW5zdGFsbEJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJ1tkYXRhLWluc3RhbGxdJyk7XG4gIGlmIChpbnN0YWxsQnRuKSB7IHN0YXJ0SW5zdGFsbChpbnN0YWxsQnRuLmRhdGFzZXQuaW5zdGFsbCk7IHJldHVybjsgfVxuICBjb25zdCBhY3Rpb25CdG4gPSBlLnRhcmdldC5jbG9zZXN0KCdbZGF0YS1hY3Rpb25dJyk7XG4gIGlmIChhY3Rpb25CdG4pIHtcbiAgICBpZiAoYWN0aW9uQnRuLmRhdGFzZXQuYWN0aW9uID09PSAnZ2d1Zi1kb3dubG9hZCcpIHN0YXJ0R2d1ZkRvd25sb2FkKCk7XG4gICAgZWxzZSBpZiAoYWN0aW9uQnRuLmRhdGFzZXQuYWN0aW9uID09PSAnZ2d1Zi1jYW5jZWwnKSBjYW5jZWxHZ3VmRG93bmxvYWQoKTtcbiAgICBlbHNlIGlmIChhY3Rpb25CdG4uZGF0YXNldC5hY3Rpb24gPT09ICdpbnN0YWxsLWNhbmNlbCcpIGNhbmNlbEluc3RhbGwoJ2N1ZGEtbGlicycpO1xuICB9XG59KTtcblxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Jyb3dzZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcbiAgY29uc3QgZGlyID0gYXdhaXQgYXBpLnBpY2tGb2xkZXIoKTtcbiAgaWYgKGRpcikgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb2plY3QtZGlyJykudmFsdWUgPSBkaXI7XG4gIHVwZGF0ZUxhdW5jaEJ0bigpO1xufSk7XG5cbi8vIFJlc3RvcmUtZnJvbS1iYWNrdXAgaXMgYSBmaXJzdC1ydW4gY2hvaWNlIG9ubHk6IHJlcnVuL3VwZGF0ZSBhbHJlYWR5IGhhdmUgYVxuLy8gbGl2ZSBwcm9qZWN0LCBhbmQgcmVzdG9yaW5nIG92ZXIgaXQgYmVsb25ncyBpbiB0aGUgaW4tYXBwIFNldHRpbmdzIGZsb3cuXG5pZiAobW9kZSA9PT0gJ2luaXRpYWwnKSB7XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0b3JlLXJvdycpLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RvcmUtbm90ZScpLnN0eWxlLmRpc3BsYXkgPSAnJztcbn1cblxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RvcmUtYmFja3VwLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICBjb25zdCBhcmNoaXZlID0gYXdhaXQgYXBpLnBpY2tGaWxlKHtcbiAgICB0aXRsZTogICAnQ2hvb3NlIGEgWXV1Q2xpcCBiYWNrdXAnLFxuICAgIGZpbHRlcnM6IFt7IG5hbWU6ICdZdXVDbGlwIGJhY2t1cCcsIGV4dGVuc2lvbnM6IFsnemlwJ10gfV0sXG4gIH0pO1xuICBpZiAoIWFyY2hpdmUpIHJldHVybjtcbiAgY29uc3QgdGFyZ2V0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Byb2plY3QtZGlyJykudmFsdWU7XG4gIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0b3JlLWJhY2t1cC1idG4nKTtcbiAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgYnRuLnRleHRDb250ZW50ID0gJ1Jlc3RvcmluZ+KApic7XG4gIGxldCByZXN1bHQ7XG4gIHRyeSB7XG4gICAgcmVzdWx0ID0gYXdhaXQgYXBpLnJlc3RvcmVCYWNrdXAoeyBhcmNoaXZlLCBwcm9qZWN0OiB0YXJnZXQgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXN1bHQgPSB7IG9rOiBmYWxzZSwgZXJyb3I6IFN0cmluZyhlICYmIGUubWVzc2FnZSB8fCBlKSB9O1xuICB9XG4gIGlmIChyZXN1bHQub2spIHtcbiAgICAvLyBMYXVuY2ggc3RyYWlnaHQgaW50byB0aGUgcmVzdG9yZWQgcHJvamVjdDsgY29tcGxldGUoKSBza2lwcyB0aGUgd2l6YXJkXG4gICAgLy8gY29uZmlnIHdyaXRlIHNvIHRoZSBiYWNrdXAncyBvd24gc2V0dGluZ3Mgc3Vydml2ZSAobWFpbi5qczogY2ZnLnJlc3RvcmVkKS5cbiAgICBidG4udGV4dENvbnRlbnQgPSAnUmVzdG9yZWQgLSBzdGFydGluZ+KApic7XG4gICAgYXBpLmNvbXBsZXRlKHsgcHJvamVjdERpcjogdGFyZ2V0LCByZXN0b3JlZDogdHJ1ZSB9KTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gT24gZmFpbHVyZSAobm90IGEgY2FuY2VsbGVkIHJlcGxhY2UpIG1haW4uanMgaGFzIGFscmVhZHkgc2hvd24gYW4gZXJyb3JcbiAgLy8gZGlhbG9nOyBqdXN0IHJlc2V0IHRoZSBidXR0b24gc28gdGhlIHVzZXIgY2FuIHRyeSBhbm90aGVyIGZpbGUuXG4gIGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuICBidG4udGV4dENvbnRlbnQgPSAnUmVzdG9yZSBmcm9tIGEgYmFja3VwIGluc3RlYWTigKYnO1xufSk7XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsbG0tYnJvd3NlLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICBjb25zdCBmaWxlID0gYXdhaXQgYXBpLnBpY2tGaWxlKHtcbiAgICB0aXRsZTogICAnQ2hvb3NlIExMTSBtb2RlbCBmaWxlJyxcbiAgICBmaWx0ZXJzOiBbeyBuYW1lOiAnR0dVRiBtb2RlbHMnLCBleHRlbnNpb25zOiBbJ2dndWYnXSB9XSxcbiAgfSk7XG4gIGlmIChmaWxlKSB7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykudmFsdWUgPSBmaWxlO1xuICAgIHVwZGF0ZUxsbVdhcm4oKTtcbiAgfVxufSk7XG5cbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhaS1wcml2YWN5LXNlbCcpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGUgPT4gb25Qcml2YWN5TW9kZUNoYW5nZShlLnRhcmdldC52YWx1ZSkpO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xvY2FsLWFpLXllcycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIG9uTG9jYWxBaUNob2ljZUNoYW5nZSk7XG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbG9jYWwtYWktbm8nKS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBvbkxvY2FsQWlDaG9pY2VDaGFuZ2UpO1xuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCB1cGRhdGVMbG1XYXJuKTtcblxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JlY2hlY2stYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCByZWNoZWNrKTtcbmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXJ0LWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGFydC1idG4nKTtcbiAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgYnRuLnRleHRDb250ZW50ID0gJ1Jlc3RhcnRpbmfigKYnO1xuICBhcGkucmVzdGFydEFwcCgpO1xufSk7XG5cbmZ1bmN0aW9uIGNvbGxlY3RDb25maWcoKSB7XG4gIGNvbnN0IGNob2ljZUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignaW5wdXRbbmFtZT1cImxvY2FsLWFpLWNob2ljZVwiXTpjaGVja2VkJyk7XG4gIGNvbnN0IHJlYyA9IChzdGF0dXMgJiYgc3RhdHVzLmxvY2FsTW9kZWxSZWNvbW1lbmRhdGlvbikgfHwge307XG4gIHJldHVybiB7XG4gICAgcHJvamVjdERpcjogICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncHJvamVjdC1kaXInKS52YWx1ZSxcbiAgICB3aGlzcGVyTW9kZWw6ICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3aGlzcGVyLXNlbCcpLnZhbHVlLFxuICAgIHdoaXNwZXJMYW5ndWFnZTogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3doaXNwZXItbGFuZy1zZWwnKS52YWx1ZSxcbiAgICBtb2RlbFByZWZldGNoOiAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb2RlbC1wcmVmZXRjaC1jaGsnKS5jaGVja2VkLFxuICAgIGFpUHJpdmFjeU1vZGU6ICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FpLXByaXZhY3ktc2VsJykudmFsdWUsXG4gICAgbGxtTW9kZWxQYXRoOiAgICAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xsbS1tb2RlbC1wYXRoJykudmFsdWUgfHwgJycpLnRyaW0oKSxcbiAgICBsb2NhbE1vZGVsQ2hvaWNlOiBjaG9pY2VFbCA/IGNob2ljZUVsLnZhbHVlIDogJ2xvY2FsJyxcbiAgICByZWNvbW1lbmRlZE1vZGVsSWQ6IHJlYy5tb2RlbElkIHx8ICcnLFxuICAgIGNvbnRlbnRQcmVzZXQ6ICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRlbnQtcHJlc2V0LXNlbCcpLnZhbHVlLFxuICB9O1xufVxuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVpdC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgLy8gUXVpdHRpbmcgbWlkLWluc3RhbGwvZG93bmxvYWQgc2lsZW50bHkgbG9zZXMgaXRzIHByb2dyZXNzICgucGFydCBzd2VwdCBvbiB0aGVcbiAgLy8gbmV4dCBzdGFydCksIHNvIGNvbmZpcm0gZmlyc3Qgd2hlbiB3b3JrIGlzIGluIGZsaWdodC5cbiAgaWYgKChhbnlJbnN0YWxsaW5nKCkgfHwgZG93bmxvYWRpbmdHZ3VmKSAmJlxuICAgICAgIXdpbmRvdy5jb25maXJtKCdBIGRvd25sb2FkIGlzIHN0aWxsIHJ1bm5pbmcgLSBxdWl0IGFueXdheT8gWW91IHdpbGwgbG9zZSBpdHMgcHJvZ3Jlc3MuJykpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHJlcnVuTW9kZSkgYXBpLmNsb3NlKCk7ICAgICAgICAgIC8vIGRpc2NhcmQgY2hhbmdlcywga2VlcCBhcHAgcnVubmluZ1xuICBlbHNlIGlmIChtb2RlID09PSAndXBkYXRlJykgYXBpLnNraXAoKTsgLy8gbGF1bmNoIHdpdGggZXhpc3RpbmcgY29uZmlnXG4gIGVsc2UgYXBpLnF1aXQoKTtcbn0pO1xuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGF1bmNoLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICBjb25zdCBidG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbGF1bmNoLWJ0bicpO1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICBidG4udGV4dENvbnRlbnQgPSByZXJ1bk1vZGUgPyAnU2F2aW5n4oCmJyA6ICdTdGFydGluZ+KApic7XG4gIGFwaS5jb21wbGV0ZShjb2xsZWN0Q29uZmlnKCkpO1xufSk7XG5cbi8vIOKUgOKUgCBib290IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG5hcGkub25JbnN0YWxsUHJvZ3Jlc3Mob25JbnN0YWxsUHJvZ3Jlc3MpO1xuYXBpLm9uR2d1ZkRvd25sb2FkUHJvZ3Jlc3Mob25HZ3VmRG93bmxvYWRQcm9ncmVzcyk7XG5cbmZ1bmN0aW9uIGFwcGx5T3NUaGVtZShzKSB7XG4gIC8vIFRoZSBhcHAgaXRzZWxmIGFsd2F5cyBkZWZhdWx0cyB0byBkYXJrIHJlZ2FyZGxlc3Mgb2YgT1MgbGlnaHQvZGFyayBwcmVmZXJlbmNlXG4gIC8vIChpbmRleC5zcmMuaHRtbCdzIGlubGluZSBwcmUtcGFpbnQgc2NyaXB0IG9ubHkgZXZlciBkZXZpYXRlcyBmcm9tIGRhcmsgd2hlblxuICAvLyB0aGUgdXNlciBleHBsaWNpdGx5IHBpY2tlZCBhIHRoZW1lIGluIFNldHRpbmdzKSAtIHRoZSB3aXphcmQgbWF0Y2hlcyB0aGF0IHNvXG4gIC8vIGZpcnN0IHJ1biBkb2Vzbid0IGZsaXAgZnJvbSBhIGxpZ2h0IHdpemFyZCBpbnRvIGEgZGFyayBhcHAgdGhlIG1vbWVudCBpdFxuICAvLyBmaW5pc2hlcy4gT1MgaGlnaC1jb250cmFzdCBpcyBzdGlsbCBob25vcmVkIHNpbmNlIHRoYXQgaXMgYW4gYWNjZXNzaWJpbGl0eVxuICAvLyBuZWVkLCBub3QgYSBjb2xvciBwcmVmZXJlbmNlLlxuICBpZiAocy5vc1RoZW1lSXNIaWdoQ29udHJhc3QpIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kYXRhc2V0LnRoZW1lID0gJ2hpZ2gtY29udHJhc3QnO1xufVxuXG4oYXN5bmMgKCkgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHMgPSBhd2FpdCBhcGkuZ2V0U3RhdHVzKCk7XG4gICAgYXBwbHlPc1RoZW1lKHMpO1xuICAgIGFwcGx5RGVmYXVsdHMocyk7XG4gICAgcmVuZGVyU2xvdHMocyk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaXRlbS1pbml0Jykub3V0ZXJIVE1MID1cbiAgICAgIGA8ZGl2IGNsYXNzPVwiaXRlbSBlcnJcIj5cbiAgICAgICAgIDxkaXYgY2xhc3M9XCJpY29uXCI+4pyXPC9kaXY+XG4gICAgICAgICA8ZGl2IGNsYXNzPVwiYm9keVwiPlxuICAgICAgICAgICA8ZGl2IGNsYXNzPVwidGl0bGVcIj5TZXR1cCBjaGVjayBmYWlsZWQ8L2Rpdj5cbiAgICAgICAgICAgPGRpdiBjbGFzcz1cImRlc2NcIj5Tb21ldGhpbmcgd2VudCB3cm9uZyB3aGlsZSBjaGVja2luZyB5b3VyIHNldHVwLiBUcnkgPGVtPlJlc3RhcnQgYXBwPC9lbT4gYmVsb3csIG9yIHF1aXQgYW5kIHJlbGF1bmNoLlxuICAgICAgICAgICAgIDxkZXRhaWxzIHN0eWxlPVwibWFyZ2luLXRvcDo2cHhcIj48c3VtbWFyeSBzdHlsZT1cImN1cnNvcjpwb2ludGVyXCI+VGVjaG5pY2FsIGRldGFpbHM8L3N1bW1hcnk+JHtlc2MoU3RyaW5nKGUpKX08L2RldGFpbHM+PC9kaXY+XG4gICAgICAgICA8L2Rpdj5cbiAgICAgICA8L2Rpdj5gO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZWNoZWNrLWJhcicpLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3VidGl0bGUnKS50ZXh0Q29udGVudCA9ICdTb21ldGhpbmcgd2VudCB3cm9uZy4nO1xuICB9XG59KSgpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7O0FBQUE7QUFBQSxJQUNFLGVBQWlCO0FBQUEsSUFDakIsbUJBQXFCO0FBQUEsTUFDbkIsSUFBTTtBQUFBLE1BQ04sY0FBZ0I7QUFBQSxNQUNoQixVQUFZO0FBQUEsTUFDWixVQUFZO0FBQUEsTUFDWixhQUFlO0FBQUEsTUFDZixTQUFXO0FBQUEsTUFDWCxTQUFXO0FBQUEsTUFDWCxLQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsZ0JBQWtCO0FBQUEsTUFDaEI7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxRQUNFLElBQU07QUFBQSxRQUNOLE9BQVM7QUFBQSxRQUNULFVBQVk7QUFBQSxRQUNaLE1BQVE7QUFBQSxRQUNSLGFBQWU7QUFBQSxNQUNqQjtBQUFBLElBQ0Y7QUFBQSxJQUNBLG1CQUFxQjtBQUFBLE1BQ25CO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsSUFDQSxpQkFBbUI7QUFBQSxNQUNqQjtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsYUFBZTtBQUFBLE1BQ2pCO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsYUFBZTtBQUFBLE1BQ2pCO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsYUFBZTtBQUFBLE1BQ2pCO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsYUFBZTtBQUFBLE1BQ2pCO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsYUFBZTtBQUFBLE1BQ2pCO0FBQUEsTUFDQTtBQUFBLFFBQ0UsSUFBTTtBQUFBLFFBQ04sTUFBUTtBQUFBLFFBQ1IsYUFBZTtBQUFBLE1BQ2pCO0FBQUEsSUFDRjtBQUFBLElBQ0Esb0JBQXNCO0FBQUEsTUFDcEI7QUFBQSxRQUNFLE9BQVM7QUFBQSxRQUNULE9BQVM7QUFBQSxNQUNYO0FBQUEsTUFDQTtBQUFBLFFB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
