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
| FFmpeg | `winget install Gyan.FFmpeg` |

Verify:
```powershell
python --version        # 3.11+
node --version          # 20+
ffmpeg -version         # any recent build
```

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
3. Builds the Python wheel → `dist/yuu_clip-X.Y.Z-py3-none-any.whl`
4. Copies the wheel into `electron/resources/`
5. Runs `npm run dist` in `electron/` → `dist/yuu-clip-X.Y.Z-Setup.exe`
6. Prints the installer path

Total build time: ~2–5 minutes depending on machine.

---

## Test the build

Before sharing, install and smoke-test in a secondary Windows user account or a VM:

- [ ] Run `yuu-clip-X.Y.Z-Setup.exe` — confirm Start Menu shortcut is created
- [ ] Desktop shortcut was offered as optional during install
- [ ] Launch from Start Menu — app window opens, browser loads
- [ ] First-run venv setup completes without errors
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

The bundled installer includes the **CPU build** of `llama-cpp-python`. This works on any machine but is slower for large models.

Users with an NVIDIA GPU can upgrade to the CUDA build after installation:

```powershell
# Find your CUDA version first
nvidia-smi  # look for "CUDA Version: 12.x"

# Install the matching CUDA wheel (replace cu124 with your version, e.g. cu121, cu118)
& "$env:LOCALAPPDATA\yuu-clip\venv\Scripts\pip" install llama-cpp-python `
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu124 `
    --force-reinstall --no-cache-dir
```

After the upgrade, LLM scoring runs on the GPU automatically — no config change needed.

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

**Python not found on first launch**
The app shows a dialog. Install Python 3.11 via `winget install Python.Python.3.11`, restart the app.

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
