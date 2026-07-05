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

FFmpeg is **not** a build-machine prerequisite — `fetch-ffmpeg-runtime.ps1` downloads
a prebuilt binary and bundles it into the installer (see "Bundled FFmpeg" below).

---

## Version bump

Version must be updated in **two files** and they must match:

1. `pyproject.toml` — `version = "X.Y.Z"` (line 7)
2. `electron/package.json` — `"version": "X.Y.Z"`

Use [semver](https://semver.org/): `MAJOR.MINOR.PATCH`
- PATCH: bug fixes only
- MINOR: new features, no breaking changes
- MAJOR: breaking changes (rare for a single-user tool)

---

## Build

```powershell
.\scripts\build-release.ps1
```

This script:
1. Checks the git working tree is clean (warns if not)
2. Reads the version from `pyproject.toml`
3. Builds the Python wheel → `build/wheel/yuu_clip-X.Y.Z-py3-none-any.whl`
4. Verifies `requirements.lock` is present (bundled to pin user installs — see below)
5. Fetches the pinned standalone Python runtime bundled into the installer (see
   below) — cached after the first build, so this is a no-op on later runs
6. Fetches the pinned GPL FFmpeg runtime + matching source archives (see below) —
   also cached after the first build — and copies the source archives into
   `build/installer/` so they ship alongside the `.exe`
7. Runs `npm run dist` in `electron/` → `build/installer/yuu-clip-X.Y.Z-Setup.exe`
8. Prints the installer path

### Dependency lock

`requirements.lock` pins the exact base-runtime dependency versions. It is bundled into
the installer, and the first-run venv setup installs the wheel with `pip install -c
requirements.lock <wheel>`, so **every user resolves the same versions we tested** instead
of whatever is newest on PyPI that day. It covers base deps only — optional extras
(`llamacpp`, `laugh-model`, and the speaker/vision packages installed on demand from
Settings) are intentionally not pinned.

Regenerate it whenever you change the base dependencies in `pyproject.toml`:
```powershell
.\scripts\lock-deps.ps1   # resolves base deps in a clean 3.12 venv, freezes, writes requirements.lock
```
Then commit the updated `requirements.lock`.

Total build time: ~2–5 minutes depending on machine (longer on the first run,
which downloads the ~45 MB Python runtime archive).

### Bundled Python runtime

The installer bundles a pinned [python-build-standalone](https://github.com/astral-sh/python-build-standalone)
CPython build (`scripts/fetch-python-runtime.ps1`) so end users never need to
install Python themselves — `electron/main.js` points the venv setup at this
bundled interpreter in packaged builds (dev mode still searches PATH). To
re-pin to a newer version, update `PYTHON_VERSION`/`PYBUILD_TAG`/`SHA256` at
the top of `scripts/fetch-python-runtime.ps1` using that repo's release
assets and `SHA256SUMS` file.

### Bundled FFmpeg

The installer bundles a pinned GPL Windows FFmpeg build (`scripts/fetch-ffmpeg-runtime.ps1`)
so end users never need to install FFmpeg themselves — `electron/main.js` points
`find_ffmpeg()` at this bundled copy via `YUU_CLIP_FFMPEG_DIR` in packaged builds
(dev mode still searches PATH). Because it's GPL, yuu-clip also ships the exact
matching FFmpeg + libx264 source archives alongside the installer — see
`docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md` for the full compliance record.

**Re-pinning is a three-file change**, not just a version bump:
1. `scripts/fetch-ffmpeg-runtime.ps1` — update `FFMPEG_VERSION`/`ASSET_NAME`/`SHA256`
   (from the new GyanD/codexffmpeg release), and re-derive `X264_COMMIT`/`X264_SRC_SHA256`
   by running the new `ffmpeg.exe` on a trivial libx264 encode (the `264 - core NNN
   rNNNN <hash>` line in stderr) — `ffmpeg -version` alone doesn't show it.
2. `docs/dev/THIRD-PARTY-NOTICES-FFMPEG.md` — update the recorded version/hashes to
   match. `tests/test_ffmpeg_licensing.py` fails the suite if these two files disagree.
3. If the x264 commit changed, re-download `docs/dev/third-party-source/x264-<new-commit>.tar.gz`
   from VideoLAN's GitLab in a **browser** (not a script — see the note in
   `fetch-ffmpeg-runtime.ps1` about its anti-bot challenge) and commit it (tracked via
   Git LFS, see `.gitattributes`) in place of the old one.

Never swap in a build whose own `README.txt`/config reports `--enable-nonfree`
(bundling `libfdk_aac`, DeckLink, etc.) — that changes the distribution terms, and
`tests/test_ffmpeg_licensing.py` guards against it.

---

## Test the build

Before sharing, install and smoke-test in a secondary Windows user account or a VM
**with no system Python installed** — this confirms the bundled runtime works standalone:

- [ ] Run `yuu-clip-X.Y.Z-Setup.exe` — confirm Start Menu shortcut is created
- [ ] Desktop shortcut was offered as optional during install
- [ ] Launch from Start Menu — app window opens, browser loads
- [ ] First-run venv setup completes without errors
- [ ] Export a clip / build a highlight reel with **no system FFmpeg installed** —
      succeeds using the bundled copy
- [ ] In the setup wizard, choose the "Local model file" LLM backend and click
      "Download recommended model" — completes and auto-fills the model path
- [ ] On an NVIDIA-GPU machine, install the LLM engine from the wizard — confirm
      (via the install log or `pip show llama-cpp-python`) the CUDA build installed,
      not the CPU-only PyPI package
- [ ] Add a video and run Analyze — completes successfully
- [ ] Configure an LLM model path in Settings, rescore — LLM scores appear
- [ ] Click X while analysis is in progress — "Cancel?" dialog appears
- [ ] Click X when idle — app closes immediately
- [ ] Uninstall via Add/Remove Programs — app removed, `Videos\yuu-clip\` data survives

---

## Share / Publish

### Sharing informally (no GitHub release)

Copy `dist/yuu-clip-X.Y.Z-Setup.exe` directly to your friend. They double-click and install.

To update: build a new `.exe` and send the new file. They run the new installer over the old one (NSIS handles the upgrade).

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
| `%LOCALAPPDATA%\yuu-clip\venv\` | Python venv (created on first launch) | Yes — custom NSIS step |
| `%APPDATA%\yuu-clip\` | App settings, track layouts, config | Yes |
| `%USERPROFILE%\Videos\yuu-clip\` | Your videos DB, clips, exports, logs | **No — never auto-deleted** |

After uninstall, a dialog reminds the user that `Videos\yuu-clip\` was not removed and they can delete it manually if they want.

---

## GPU acceleration for LLM scoring (llama-cpp-python)

The setup wizard's "Install" button for the LLM engine (llama.cpp backend) **automatically
picks the CUDA build** when it detects a supported NVIDIA GPU — see
`electron/llamacpp-cuda.js` (`pickCudaWheelTag`/`buildCudaWheelUrl`) and the `llamacpp` case
in `setup:install-package` (`electron/main.js`). No manual step needed for anyone using the
installer.

CUDA wheels are pinned to a specific `llama-cpp-python` release (`LLAMA_CPP_CUDA_VERSION` in
`electron/llamacpp-cuda.js`) published as GitHub Release assets tagged `v<version>-cu<tag>` —
**not** the old `abetlen.github.io/llama-cpp-python/whl/` pip index, which stopped being
updated at `v0.2.69` (older than yuu-clip's own `llama-cpp-python>=0.3,<1.0` pin in
`pyproject.toml` — using that index today would downgrade/break the install). Re-pinning to a
newer version requires checking https://github.com/abetlen/llama-cpp-python/releases for
which `cu<NNN>` tags the target version actually published a `win_amd64` wheel for.

For anyone running from source (not the installer), the manual equivalent is:

```powershell
# Find your CUDA version first
nvidia-smi  # look for "CUDA Version: 12.x"

# Install the matching CUDA wheel (replace 0.3.32/cu124 with the current pin/your version)
pip install --force-reinstall --no-cache-dir `
    https://github.com/abetlen/llama-cpp-python/releases/download/v0.3.32-cu124/llama_cpp_python-0.3.32-py3-none-win_amd64.whl
```

> Note: Whisper (transcription) already auto-detects CUDA via CTranslate2. No manual step needed there.

---

## LLM model setup (for the friend)

When they first try LLM scoring, they'll need a GGUF model file:

1. Go to `https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF`
2. Download a `Qwen2.5-7B-Instruct-Q4_K_M.gguf` (~4.7 GB) — good balance of speed and quality,
   and Apache-2.0 so clips made with it can be monetized (see `yuu_clip/model_catalog.py`)
3. In yuu-clip Settings → LLM → Model file path: point to the downloaded `.gguf` file
4. Run Rescore on any video to confirm it works

---

## Troubleshooting

**"yuu-clip installation is damaged" on first launch**
The bundled Python runtime (`resources/python/python.exe`) is missing or corrupted — this
should only happen if the installer itself is broken. Reinstall the app; if that doesn't fix
it, check that `build-release.ps1` actually populated `build/python-runtime/` before packaging.

**Venv install failed**
Check `%APPDATA%\yuu-clip\yuu-clip_install.log` (written by the Electron first-run setup). Common cause: Python is installed but not on PATH — open a new terminal after installing Python and try again.

**App window is blank / "Cannot connect to server"**
The Python backend failed to start. Check `%USERPROFILE%\Videos\yuu-clip\.yuu-clip\yuu-clip.log` for errors.

**Port 8080 in use by something else**
The app detects this and picks the next free port automatically. If it shows a "close the other yuu-clip instance" dialog, check Task Manager for a stale `python.exe` process and end it.

**LLM scoring shows "model not configured"**
Set the model file path in Settings (see LLM model setup above).

**Whisper model download is very slow**
First analyze downloads the Whisper model weights (~1.5 GB) from HuggingFace. This is a one-time download. Let it run — progress is shown in the Analysis panel.
