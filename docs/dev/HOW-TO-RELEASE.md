# How to Release yuu-clip

Step-by-step runbook for building and distributing a new version.

---

## Build machine prerequisites

Install these once on your dev machine:

| Tool | Install |
|------|---------|
| Python 3.11+ | `winget install Python.Python.3.11` |
| `build` (Python wheel builder) | `pip install build` |
| Node.js 20+ | `winget install OpenJS.NodeJS.LTS` |
| electron-builder | `npm install -g electron-builder` (or `npm ci` in `electron/`) |

Verify:
```powershell
python --version        # 3.11+
node --version          # 20+
```

FFmpeg is **not** a build-machine prerequisite - `fetch-ffmpeg-runtime.ps1` downloads
a prebuilt binary and bundles it into the installer (see "Bundled FFmpeg" below).

---

## Version bump

Version must be updated in **two files** and they must match:

1. `pyproject.toml` - `version = "X.Y.Z"` (line 7)
2. `electron/package.json` - `"version": "X.Y.Z"`

Use [semver](https://semver.org/): `MAJOR.MINOR.PATCH`
- PATCH: bug fixes only
- MINOR: new features, no breaking changes
- MAJOR: breaking changes (rare for a single-user tool)

---

## Frontend bundle

The web UI ships as one committed `yuu_clip/web/static/bundle.esm.js` - the esbuild ESM
graph rooted at `static/main.esm.js`. Rebuilding needs Node + `npm install` (esbuild is a
pinned dev-only dep); the committed artifact is what ships, so the release machine needs
no Node. Regenerate it and commit any change before building:

```powershell
yuu-dev bundle
git add yuu_clip/web/static/bundle.esm.js
```

`tests/unit/test_bundle_drift.py` fails if the committed bundle is stale, so a release
can't silently ship an out-of-date UI - but regenerate here so the drift guard never has
to catch it. (During active UI work, `yuu-dev bundle --watch` rebuilds on save.) The
esbuild drift guard skips when the JS toolchain is absent, so run `yuu-dev bundle` on a
machine with Node before a release build.

---

## Build

```powershell
.\scripts\windows-release\build-release.ps1
```

This script:
1. Checks the git working tree is clean (warns if not)
2. Reads the version from `pyproject.toml`
3. Builds the Python wheel → `build/wheel/yuu_clip-X.Y.Z-py3-none-any.whl`
4. Verifies `requirements.lock` is present (bundled to pin user installs - see below)
5. Fetches the pinned standalone Python runtime bundled into the installer (see
   below) - cached after the first build, so this is a no-op on later runs
6. Builds the **offline dependency wheelhouse** (`build/wheelhouse/`) with the
   bundled runtime's Python (see below) - cached on the `requirements.lock` hash,
   so it only rebuilds when the lock changes
7. Fetches the pinned GPL FFmpeg runtime + matching source archives (see below) -
   also cached after the first build - and copies the source archives into
   `build/installer/` so they ship alongside the `.exe`
8. Runs `npm run dist` in `electron/` → `build/installer/yuu-clip-X.Y.Z-Setup.exe`
9. Prints the installer path

### Offline dependency wheelhouse

`scripts/windows-release/fetch-wheelhouse.ps1` pre-downloads every base dependency as a wheel into
`build/wheelhouse/`, which `electron/package.json` bundles into the installer. First-run
setup then installs the base pipeline with `pip install --no-index --find-links
<wheelhouse> -c requirements.lock <wheel>` - **fully offline**, so a slow, firewalled, or
proxied network can't fail the very first launch (it previously resolved
faster-whisper / CTranslate2 / av / scipy from PyPI at launch). The download uses the
**bundled** runtime's Python so the wheels match its platform/abi, and `--only-binary=:all:`
guarantees no sdist sneaks in (an sdist would try to compile on the user's machine). If a
dependency ever lacks a wheel for the target, `fetch-wheelhouse.ps1` fails at build time -
fix that before shipping. If the wheelhouse is absent (e.g. a dev/unpackaged run), first-run
setup falls back to installing from PyPI online.

### Dependency lock

`requirements.lock` pins the exact base-runtime dependency versions. It is bundled into
the installer, and the first-run venv setup installs the wheel with `pip install -c
requirements.lock <wheel>`, so **every user resolves the same versions we tested** instead
of whatever is newest on PyPI that day. It covers base deps only - optional extras
(`llamacpp`, `laugh-model`, and the speaker/vision packages installed on demand from
Settings) are intentionally not pinned.

Regenerate it whenever you change the base dependencies in `pyproject.toml`:
```powershell
yuu-dev lock-deps   # resolves base deps in a clean 3.12 venv, freezes, writes requirements.lock
```
Then commit the updated `requirements.lock`.

Total build time: ~2–5 minutes depending on machine (longer on the first run,
which downloads the ~45 MB Python runtime archive).

### Bundled Python runtime

The installer bundles a pinned [python-build-standalone](https://github.com/astral-sh/python-build-standalone)
CPython build (`scripts/windows-release/fetch-python-runtime.ps1`) so end users never need to
install Python themselves - `electron/main.js` points the venv setup at this
bundled interpreter in packaged builds (dev mode still searches PATH). To
re-pin to a newer version, update `PYTHON_VERSION`/`PYBUILD_TAG`/`SHA256` at
the top of `scripts/windows-release/fetch-python-runtime.ps1` using that repo's release
assets and `SHA256SUMS` file.

### Bundled FFmpeg

The installer bundles a pinned GPL Windows FFmpeg build (`scripts/windows-release/fetch-ffmpeg-runtime.ps1`)
so end users never need to install FFmpeg themselves - `electron/main.js` points
`find_ffmpeg()` at this bundled copy via `YUU_CLIP_FFMPEG_DIR` in packaged builds
(dev mode still searches PATH). Because it's GPL, yuu-clip also ships the exact
matching FFmpeg + libx264 source archives alongside the installer - see
`docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md` for the full compliance record.

**Re-pinning is a three-file change**, not just a version bump:
1. `scripts/windows-release/fetch-ffmpeg-runtime.ps1` - update `FFMPEG_VERSION`/`ASSET_NAME`/`SHA256`
   (from the new GyanD/codexffmpeg release), and re-derive `X264_COMMIT`/`X264_SRC_SHA256`
   by running the new `ffmpeg.exe` on a trivial libx264 encode (the `264 - core NNN
   rNNNN <hash>` line in stderr) - `ffmpeg -version` alone doesn't show it.
2. `docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md` - update the recorded version/hashes to
   match. `tests/test_ffmpeg_licensing.py` fails the suite if these two files disagree.
3. If the x264 commit changed, re-download `docs/dev/third-party-source/x264-<new-commit>.tar.gz`
   from VideoLAN's GitLab in a **browser** (not a script - see the note in
   `fetch-ffmpeg-runtime.ps1` about its anti-bot challenge) and commit it (tracked via
   Git LFS, see `.gitattributes`) in place of the old one.

Never swap in a build whose own `README.txt`/config reports `--enable-nonfree`
(bundling `libfdk_aac`, DeckLink, etc.) - that changes the distribution terms, and
`tests/test_ffmpeg_licensing.py` guards against it.

---

## Test the build

Before sharing, install and smoke-test in a secondary Windows user account or a VM
**with no system Python installed** - this confirms the bundled runtime works standalone:

- [ ] Run `yuu-clip-X.Y.Z-Setup.exe` - confirm Start Menu shortcut is created
- [ ] Desktop shortcut was offered as optional during install
- [ ] Launch from Start Menu - app window opens, browser loads
- [ ] First-run venv setup completes without errors
- [ ] Fresh install on a machine whose bundled pip is older than the latest on PyPI -
      venv setup must still complete (regression guard for the 0.1.13/0.1.14 blocker where
      `pip install --upgrade pip` couldn't replace itself; now `python -m pip`)
- [ ] On a machine with **no usable GPU / Vulkan runtime**, local LLM scoring must still
      work - the bundled `llama-server` auto-falls-back from the `vulkan\` build to the
      `cpu\` build (watch the app log for "falling back to the bundled CPU build")
- [ ] Export a clip / build a highlight reel with **no system FFmpeg installed** -
      succeeds using the bundled copy
- [ ] In the setup wizard, choose the "Local model file" LLM backend and click
      "Download recommended model" - completes and auto-fills the model path
- [ ] On an NVIDIA / AMD / Intel-GPU machine, run a re-score - confirm the bundled Vulkan
      `llama-server` offloaded to the GPU (the app log shows `llama-server GPU device: ...`),
      not the CPU fallback
- [ ] Add a video and run Analyze - completes successfully
- [ ] Configure an LLM model path in Settings, rescore - LLM scores appear
- [ ] Click X while analysis is in progress - "Cancel?" dialog appears
- [ ] Click X when idle - app closes immediately
- [ ] Uninstall via Add/Remove Programs - app removed, `Videos\yuu-clip\` data survives

### Deferred packaged-app checks (run once, before public distribution)

These can only be verified against a packaged build (some need a clean VM / secondary
account with no system Python) and are not covered by the pytest or Playwright suites.
Folded in here 2026-07-14 from the retired post-consolidation manual-verification list.

**Native-file-protocol media transport** (implemented 2026-07-03; still the open
"implemented-but-unverified" item in `docs/project/ROADMAP.md`):

- [ ] Play a recording in the packaged app - playback starts from the source file
- [ ] Scrub to several positions - seeking works (Range requests honoured), no linear-scan stall
- [ ] Split a recording, play a segment - plays back at the correct absolute offset
- [ ] DevTools > Network while playing - **no** `/api/videos/.../source` HTTP traffic; the native
      `mediaProtocol` scheme is serving media, not a silent HTTP fallback
- [ ] Point a recording's stored path at a file outside the allowed roots (doctored DB) and open
      it - request is refused (403); no media outside the project roots is served

**Content-type presets** (the setup wizard writes `content_preset`; not suite-covered):

- [ ] Wizard: pick a non-Generic content type, finish - the project's `.yuu-clip/config.toml`
      has the chosen `content_preset`
- [ ] Analyze in that project - scoring/summary prompts reflect the preset flavour
- [ ] Settings > Scoring weights > change Content type > Apply - the confirm dialog lists the
      exact weight changes, the sliders move, and they do not read dirty afterwards; applying
      **Generic** is a true no-op

**Optional dependency installs on the shipped 3.12 runtime** (all prior verification was on the
dev venv; wheel availability differs on 3.12):

- [ ] Install SpeechBrain - `pip install speechbrain scikit-learn` succeeds and a real diarize
      run works (model auto-downloads; no WinError 1314 symlink failure)
- [ ] Install MediaPipe - resolves a 3.12 wheel; "Auto-frame on faces" returns a crop on a clip
      with a face

**Reproducible install:** the first-run setup log shows `Constraining deps to ...\requirements.lock`
and the created venv's `pip list` matches the pinned versions (e.g. `av==18.0.0`).

---

## Share / Publish

### Sharing informally (no GitHub release)

Copy `dist/yuu-clip-X.Y.Z-Setup.exe` directly to your friend. They double-click and install.

To update: build a new `.exe` and send the new file. They run the new installer over the old one (NSIS handles the upgrade).

**There is no crash reporting yet** - if something breaks on their machine, your only
diagnostic is the log file. Tell them up front: "if anything breaks, zip up and send me
`%APPDATA%\yuu-clip\yuu-clip_install.log` (install/setup failures) and
`%USERPROFILE%\Videos\yuu-clip\.yuu-clip\yuu-clip.log` (app/runtime failures)."

### GitHub release (future)

1. Tag the commit: `git tag v0.1.0 && git push origin v0.1.0`
2. Create a GitHub Release at `github.com/smitehamner/yuu-clip/releases/new`
3. Set the tag to `v0.1.0`, title `yuu-clip v0.1.0`
4. Upload `dist/yuu-clip-X.Y.Z-Setup.exe` as a release asset
5. Write release notes (what changed since last release)
6. Publish

> **Auto-update is not yet wired up.** Users must download and run the new installer manually. This will be automated in a future release.

---

## Installed file locations

Reference for both you and users. Included as `INSTALLED-FILES.txt` in the app directory.

| Path | Contents | Removed on uninstall? |
|------|----------|-----------------------|
| `%LOCALAPPDATA%\Programs\yuu-clip\` | Electron app (NSIS managed) | Yes |
| `%LOCALAPPDATA%\yuu-clip\venv\` | Python venv (created on first launch) | Yes - custom NSIS step |
| `%APPDATA%\yuu-clip\` | App settings, track layouts, config | Yes |
| `%USERPROFILE%\Videos\yuu-clip\` | Your videos DB, clips, exports, logs | **No - never auto-deleted** |

After uninstall, a dialog reminds the user that `Videos\yuu-clip\` was not removed and they can delete it manually if they want.

---

## GPU acceleration for LLM scoring (bundled llama-server)

Local LLM/vision scoring runs on the bundled MIT-licensed llama.cpp `llama-server`, not a
pip package - there is nothing for the user to install. `scripts/windows-release/build-release.ps1` fetches
two pinned Windows builds via `scripts/windows-release/fetch-llama-server-runtime.ps1` and bundles both into
the installer:

- `vulkan\` - offloads to any NVIDIA / AMD / Intel GPU through the ggml Vulkan backend.
- `cpu\` - driverless fallback for a machine with no Vulkan runtime at all.

At runtime the app prefers the Vulkan build and auto-falls-back to the CPU build if it can't
start (`yuu_clip/scoring/llamacpp_server.py` - `resolve_server_binary` picks `vulkan\` then
`cpu\`; `LlamaServerPool._spawn` retries with the CPU build on a Vulkan startup failure).
GPU offload is auto-fitted to free VRAM: the launcher omits `--n-gpu-layers` rather than
forcing all layers, which would OOM a small card. Both builds use runtime CPU-feature
dispatch, so they are ISA-safe and do **not** reintroduce the AVX-512 crash the old
`llama-cpp-python` wheels caused (the in-process wheel was retired in the bundled-Vulkan
switch, 2026-07-09).

Re-pinning the runtime: bump `$LLAMA_BUILD` and both SHA256s in
`scripts/windows-release/fetch-llama-server-runtime.ps1` together, then run a text + image smoke test on a
real GPU before shipping - there is no CI inference test.

> Note: Whisper (transcription) is accelerated separately via CTranslate2 and the CUDA
> runtime libraries (`nvidia-cublas-cu12` / `nvidia-cudnn-cu12`) that the setup wizard's
> "cuda-libs" install adds on an NVIDIA machine (`electron/install.js`, `WIZARD_INSTALLABLE`).
> That is the only GPU-related thing the wizard installs; the LLM engine itself is bundled.

---

## LLM model setup (for the friend)

LLM scoring needs a local GGUF model file. The setup wizard handles this now - no manual
download needed for the default path:

1. In the setup wizard, under **LLM scoring**, leave the default **Local model file** backend
   selected and click **Download recommended model**. This fetches `Qwen2.5-7B-Instruct-Q4_K_M.gguf`
   (~4.7 GB, Apache-2.0 so clips made with it can be monetized - see `yuu_clip/model_catalog.py`)
   and auto-fills the model path.
2. Run Rescore on any video to confirm it works.

**Manual fallback** (if the in-app download fails, or to use a different model):

1. Go to `https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF`
2. Download a `Qwen2.5-7B-Instruct-Q4_K_M.gguf` (~4.7 GB)
3. In yuu-clip Settings → LLM → Model file path: point to the downloaded `.gguf` file
4. Run Rescore on any video to confirm it works

---

## Troubleshooting

**"yuu-clip installation is damaged" on first launch**
The bundled Python runtime (`resources/python/python.exe`) is missing or corrupted - this
should only happen if the installer itself is broken. Reinstall the app; if that doesn't fix
it, check that `build-release.ps1` actually populated `build/python-runtime/` before packaging.

**Venv install failed**
Check `%APPDATA%\yuu-clip\yuu-clip_install.log` (written by the Electron first-run setup). Common cause: Python is installed but not on PATH - open a new terminal after installing Python and try again.

**App window is blank / "Cannot connect to server"**
The Python backend failed to start. Check `%USERPROFILE%\Videos\yuu-clip\.yuu-clip\yuu-clip.log` for errors.

**Port 8080 in use by something else**
The app detects this and picks the next free port automatically. If it shows a "close the other yuu-clip instance" dialog, check Task Manager for a stale `python.exe` process and end it.

**LLM scoring shows "model not configured"**
Set the model file path in Settings (see LLM model setup above).

**Whisper model download is very slow**
First analyze downloads the Whisper model weights (~1.5 GB) from HuggingFace. This is a one-time download. Let it run - progress is shown in the Analysis panel.
