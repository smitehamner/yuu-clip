# Security review — rp-clipper

## Scope

Phase 1–3 codebase. Reviewed modules:

**Pipeline (Phase 1–2):** `cli.py`, `config.py`, `db/models.py`, `ingest/probe.py`,
`ingest/extract.py`, `ingest/labeler.py`, `transcribe/whisper_runner.py`,
`segments/windower.py`, `scoring/`

**Web server (Phase 3):** `web/app.py`, `web/deps.py`, `web/sse.py`,
`web/routes/videos.py`, `web/routes/analyze.py`, `web/routes/contexts.py`,
`web/routes/profiles.py`, `web/routes/reel.py`, `web/routes/logs.py`,
`web/static/index.html`

### Threat model

rp-clipper runs a FastAPI web server on `127.0.0.1:8080` (localhost only). It is a
**single-user, local tool** — no authentication, no multi-tenancy, no public network
exposure. The threat model is:

1. **Supply-chain**: unexpected or tampered packages / model weights downloaded
2. **Local privilege escalation**: subprocess calls being hijacked via PATH or input injection
3. **Data exfiltration**: the tool uploading your recordings somewhere unexpectedly
4. **XSS in the local web UI**: a malicious clip description or filename injected into the page

Remote network attacks are out of scope — the server does not bind to a public interface
and is not designed to be exposed to the internet.

---

## Findings

### Fixed

| # | File | Issue | Fix applied |
|---|------|-------|-------------|
| 1 | `labeler.py:33` | Dead walrus-operator expression — confusing, no runtime effect | Removed |
| 2 | `whisper_runner.py` | `config.whisper_model` reached `WhisperModel()` without validation — a tampered config could trigger an arbitrary HuggingFace download | `validate_whisper_model()` allowlist added, checked before any network activity |
| 3 | `cli.py / whisper_runner.py` | `--language` string passed to Whisper without validation | `validate_whisper_language()` against ISO 639-1 allowlist |
| 4 | `pyproject.toml` | All direct deps used `>=` with no transitive pinning | `requirements.in` + `pip-compile --generate-hashes` workflow added |
| 5 | `whisper_runner.py` | No way to pin model weights to a specific HuggingFace revision | `whisper_model_revision` config field added; passed as `revision=` to `WhisperModel()` |
| 6 | `index.html` | Clip tags and descriptions rendered without HTML escaping — XSS if a malicious description was stored in the DB | `escHtml()` applied to all dynamic content inserted into innerHTML |

### Verified safe (no action needed)

| Area | Finding |
|------|---------|
| `shell=True` | Not used anywhere — all subprocess calls use list form, preventing shell injection |
| SQL injection | SQLAlchemy ORM used throughout — no raw SQL strings constructed from user input |
| Path traversal | All paths go through `pathlib.Path`; subprocess receives list args, not shell strings |
| Network calls | Our code makes zero outbound network calls — downloads only happen inside `faster-whisper` / `huggingface_hub` on first model use, and inside `ollama` |
| Config parsing | TOML parsed by `tomllib`; unknown keys ignored via dataclass field names |
| `ffprobe` output | Parsed with `json.loads()` and field-by-field extraction; never eval'd or exec'd |
| Web server binding | FastAPI/uvicorn binds to `127.0.0.1` only — not reachable from the network by default |
| SSE subprocess output | Lines forwarded as JSON-encoded strings; never eval'd by the browser |

---

## Threat: PATH hijacking of ffmpeg/ffprobe

`shutil.which("ffmpeg")` returns the **first** match in `PATH`.
If a malicious binary is placed earlier in `PATH` than the real `ffmpeg`,
it would be used.

**Severity**: Low for a personal local tool.

**If you want to harden this**: set `RPCLIPPER_FFMPEG_PATH` and
`RPCLIPPER_FFPROBE_PATH` environment variables to absolute paths, and
update `find_ffmpeg()` in `config.py` to prefer them:

```python
import os
def find_ffmpeg():
    ffmpeg  = os.environ.get("RPCLIPPER_FFMPEG_PATH")  or shutil.which("ffmpeg")
    ffprobe = os.environ.get("RPCLIPPER_FFPROBE_PATH") or shutil.which("ffprobe")
    ...
```

---

## Reproducible Python dependency installation

### One-time setup

```bash
# Linux / macOS (activate your venv first)
chmod +x scripts/pin-deps.sh
./scripts/pin-deps.sh

# Windows (activate your venv first)
.\scripts\pin-deps.ps1
```

This runs `pip-compile --generate-hashes` and writes `requirements.lock`
with the **exact version and SHA256 hash of every package** (direct deps
AND all transitive deps).

Commit `requirements.lock` to version control.

### Install from the lockfile

```bash
pip install --require-hashes -r requirements.lock
```

`--require-hashes` makes pip refuse to install any package whose
downloaded file doesn't match a stored hash. This blocks:
- Silent version upgrades
- Dependency confusion attacks
- Tampered PyPI packages

### Upgrading

To update a single package to its latest version:
```bash
# Linux / macOS
./scripts/pin-deps.sh --upgrade-package faster-whisper

# Windows
.\scripts\pin-deps.ps1 --upgrade-package faster-whisper
```

To upgrade everything:
```bash
./scripts/pin-deps.sh --upgrade     # Linux / macOS
.\scripts\pin-deps.ps1 --upgrade    # Windows
```

Always re-run `pin-deps` after any change to `requirements.in` or
`pyproject.toml` dependencies.

### Platform note

Binary wheels (`.whl`) are platform-specific; their hashes differ between
Windows and Linux. If you use the tool on both:

```bash
# Generate on Linux:
./scripts/pin-deps.sh -o requirements.lock.linux

# Generate on Windows:
.\scripts\pin-deps.ps1 -o requirements.lock.windows

# Or: use only sdist (source) packages — same hash everywhere, but slower to install:
./scripts/pin-deps.sh --no-binary :all:
```

---

## Reproducible Whisper model pinning

Whisper model weights are downloaded from HuggingFace on first use.
To pin to a specific, verified commit:

### Step 1 — get the commit SHA

1. Go to `https://huggingface.co/Systran/faster-whisper-<model>/commits/main`
   (e.g. `faster-whisper-base`, `faster-whisper-small`, `faster-whisper-large-v3`)
2. Click the latest commit you want to pin
3. Copy the full 40-character SHA from the URL or the commit detail page

### Step 2 — add to config

In your project's `.rp-clipper/config.toml` (or the global config):

```toml
[whisper]
model = "base"
model_revision = "dc0e87e9c32a0b59e0c4b502c45e5b78e3c59a1a"
```

From this point, `rp-clip analyze` will:
- Pass `revision=` to `WhisperModel()`, which pins the HuggingFace model download
- Print `revision=dc0e87e...` in the loading line so you can verify it at a glance
- Re-use the cached download if the revision is already local

### Step 3 — verify the cached model files (optional, paranoid mode)

After the first download, hash the model files yourself:

```bash
# Linux / macOS
find ~/.cache/huggingface/hub/models--Systran--faster-whisper-base -name "*.bin" \
  -exec sha256sum {} \;

# Windows (PowerShell)
Get-ChildItem "$env:USERPROFILE\.cache\huggingface\hub\models--Systran--faster-whisper-base" `
  -Recurse -Filter "*.bin" | ForEach-Object {
    $hash = Get-FileHash $_.FullName -Algorithm SHA256
    "$($hash.Hash)  $($_.FullName)"
  }
```

Record those hashes and re-check them on any machine you deploy to.
If they differ from the expected values for your pinned revision, do not proceed.

---

## What rp-clipper does NOT do

- It does not make any outbound network requests from its own code
- It does not send your audio, transcripts, or video anywhere
- It does not phone home
- It does not run any code from your video files
- All AI processing is local (Whisper via faster-whisper, LLM via Ollama)
- The web server binds to `127.0.0.1` only — it is not accessible from other machines
