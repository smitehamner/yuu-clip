"""``yuu-dev lock-deps`` - regenerate requirements.lock (pinned base runtime deps).

Resolves the base dependencies (pyproject.toml, no dev/optional extras) in a clean
3.12 venv - the runtime minor we ship, so the resolution matches - then freezes the
exact versions. The packaged installer bundles the result and passes it as a pip
`-c` constraint, so it deliberately carries versions only, not hashes (a hashed lock
is incompatible with the constraint-based install path). Ports the old lock-deps.ps1.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import typer

from yuu_clip.dev._base import REPO_ROOT, app, console

LOCK_PATH = REPO_ROOT / "requirements.lock"
LOCK_PYTHON_MINOR = (3, 12)

# Drop the project itself and the venv's own bootstrap packages from the freeze.
_EXCLUDE_RE = re.compile(r"^(yuu[-_]clip|pip|setuptools|wheel)(==| @)")

_HEADER = """\
# requirements.lock - pinned base runtime dependencies for reproducible installs.
#
# Regenerate with `yuu-dev lock-deps` whenever pyproject base deps change.
# The packaged first-run installer passes this as `pip install -c requirements.lock
# <wheel>` so every user gets exactly the versions we tested. Covers base deps only
# (which now include the Tier-A default-feature packages: speechbrain, scikit-learn,
# transformers, torch/torchaudio, soundfile, fastembed, mediapipe -- all
# pinned here). Still NOT pinned: dev extras; and the llamacpp backend (installed
# from a prebuilt CPU/CUDA wheel, not PyPI -- see scripts\\windows-release\\fetch-wheelhouse.ps1)."""


def filter_pins(freeze_lines: list[str]) -> list[str]:
    kept = [
        stripped for line in freeze_lines
        if (stripped := line.strip()) and not _EXCLUDE_RE.match(stripped)
    ]
    return sorted(kept)


def render_lock(pins: list[str]) -> str:
    return "\n".join([_HEADER, "", *pins]) + "\n"


def _find_python312() -> list[str] | None:
    if sys.version_info[:2] == LOCK_PYTHON_MINOR:
        return [sys.executable]
    if sys.platform == "win32":
        probe = subprocess.run(["py", "-3.12", "--version"], capture_output=True, text=True)
        if probe.returncode == 0:
            return ["py", "-3.12"]
    elif shutil.which("python3.12"):
        return ["python3.12"]
    return None


def _venv_python(venv_dir: Path) -> Path:
    if sys.platform == "win32":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


@app.command("lock-deps")
def lock_deps() -> None:
    """Resolve base deps in a clean 3.12 venv, freeze, and write requirements.lock."""
    python_cmd = _find_python312()
    if python_cmd is None:
        console.print("[red]Python 3.12 not found (the runtime minor we ship). Install it and retry.[/red]")
        raise typer.Exit(1)

    with tempfile.TemporaryDirectory(prefix="yuuclip-lockgen-") as tmp:
        venv_dir = Path(tmp) / "venv"
        console.print("Creating a clean 3.12 venv and installing base deps...")
        subprocess.run([*python_cmd, "-m", "venv", str(venv_dir)], check=True)
        venv_py = str(_venv_python(venv_dir))
        subprocess.run([venv_py, "-m", "pip", "install", "--upgrade", "pip", "-q"], check=True)
        install = subprocess.run([venv_py, "-m", "pip", "install", str(REPO_ROOT), "-q"])
        if install.returncode != 0:
            console.print("[red]Base install failed.[/red]")
            raise typer.Exit(install.returncode)
        freeze = subprocess.run(
            [venv_py, "-m", "pip", "freeze"], capture_output=True, text=True, check=True
        )

    pins = filter_pins(freeze.stdout.splitlines())
    LOCK_PATH.write_text(render_lock(pins), encoding="utf-8")
    console.print(f"Wrote {LOCK_PATH} ({len(pins)} pins)")
