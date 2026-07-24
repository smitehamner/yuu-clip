"""Map changed files to the UI test files worth running.

Used by ``yuu-dev test-ui --changed`` to run only the tests around an edit plus the
smoke backstop, instead of the whole ~655-test suite (which is server-bound, so
running it on every change is the slow part of the dev loop).

Prints the selected ``tests/ui/test_ui_*.py`` paths to stdout (one per line) and
human-readable advisories to stderr. With no args it derives changed files from
git (working tree + index vs HEAD, plus untracked); explicit paths can be passed
as args to override that.

Mapping is intentionally over-inclusive - a false include just runs a few extra
fast tests, while a miss is caught by the always-included smoke file. Feature
test files are matched to source stems by shared prefix token (so ``videos.js``
-> ``test_ui_video.py``, ``modelcatalog.js`` -> ``test_ui_model_catalog.py``,
``clips.js`` -> ``test_ui_clips.py`` + ``test_ui_clips2.py``). Content-only edits
to ``index.src.html``, ``partials/**``, or ``glossary.md`` are routed directly to
``test_ui_terminology.py`` + ``test_ui_wizard.py`` (see ``TERMINOLOGY_CONTENT_PREFIXES``)
since their stem carries no feature signal for that matching to key off.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
UI_TESTS_DIR = REPO_ROOT / "tests" / "ui"
SMOKE = "tests/ui/test_ui_smoke.py"

# Shared infra whose stem doesn't map to one feature - a change here can break
# anything, so we flag it (the caller should consider a full run) and lean on
# the smoke backstop rather than pretend a narrow mapping is enough.
CROSS_CUTTING = {"boot", "state", "format", "jobs", "ui", "preview",
                 "shortcuts", "helpmodals", "index"}

# Content-only edits: markup fragments (index.src.html, partials/**) and
# glossary.md carry user-facing copy but either share a stem no test file keys
# off (partials) or aren't JS/CSS/HTML at all (glossary.md is markdown), so they
# fall straight through _map_static with no signal. Both terminology.py (the
# five Whisper option lists must stay identical) and wizard.py pin exactly this
# copy, so route these edits there directly instead of relying on the smoke
# backstop to catch a copy drift it was never designed to catch.
TERMINOLOGY_CONTENT_PREFIXES = (
    "yuu_clip/web/static/index.src.html",
    "yuu_clip/web/static/partials/",
    "yuu_clip/web/static/glossary.md",
)
TERMINOLOGY_TESTS = {"tests/ui/test_ui_terminology.py", "tests/ui/test_ui_wizard.py"}


def _changed_files() -> list[str]:
    def run(args: list[str]) -> list[str]:
        out = subprocess.run(
            ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=True
        )
        return [line.strip() for line in out.stdout.splitlines() if line.strip()]

    tracked = run(["diff", "--name-only", "HEAD"])
    untracked = run(["ls-files", "--others", "--exclude-standard"])
    return sorted(set(tracked) | set(untracked))


def _ui_test_stems() -> dict[str, str]:
    """Map each test file's normalized stem (underscores stripped) to its path."""
    stems = {}
    for path in sorted(UI_TESTS_DIR.glob("test_ui_*.py")):
        rel = f"tests/ui/{path.name}"
        if rel == SMOKE:
            continue
        stem = path.stem[len("test_ui_"):].replace("_", "")
        stems[stem] = rel
    return stems


def _matches(token: str, test_stem: str) -> bool:
    shorter, longer = sorted((token, test_stem), key=len)
    return len(shorter) >= 4 and longer.startswith(shorter)


def _map_static(stem: str, test_stems: dict[str, str]) -> set[str]:
    if stem == "app":  # app.css - theme test enforces the token/contrast rules
        return {"tests/ui/test_ui_theme.py"}
    tokens = [t for t in stem.split("-") if t]
    matched = set()
    for test_stem, rel in test_stems.items():
        if any(_matches(token, test_stem) for token in tokens):
            matched.add(rel)
    return matched


def select(changed: list[str]) -> tuple[list[str], list[str]]:
    test_stems = _ui_test_stems()
    selected: set[str] = {SMOKE}
    notes: list[str] = []
    for raw in changed:
        path = raw.replace("\\", "/")
        name = Path(path).name
        if name == "conftest.py" and path.startswith("tests/"):
            notes.append(f"{path} changed (shared fixtures) - consider a full run")
            continue
        if path.startswith("tests/ui/") and name.startswith("test_ui_") and name.endswith(".py"):
            selected.add(path)
            continue
        terminology_content = path.startswith(TERMINOLOGY_CONTENT_PREFIXES)
        if terminology_content:
            selected |= TERMINOLOGY_TESTS
        if path.startswith("yuu_clip/web/static/") and path.rsplit(".", 1)[-1] in {"js", "css", "html"}:
            stem = Path(name).stem
            if stem in CROSS_CUTTING:
                notes.append(f"cross-cutting UI file changed ({name}) - consider a full run")
            hits = _map_static(stem, test_stems)
            if hits:
                selected |= hits
            elif stem not in CROSS_CUTTING and not terminology_content:
                notes.append(f"no UI test maps to {name} - relying on smoke backstop")
        elif path.endswith(".py") and path.startswith("yuu_clip/"):
            notes.append(f"backend file changed ({name}) - run yuu-dev test-api; UI impact via smoke only")
    existing = [p for p in selected if (REPO_ROOT / p).exists()]
    return sorted(existing), notes


def main() -> int:
    changed = sys.argv[1:] or _changed_files()
    if not changed:
        print("No changes detected; running smoke backstop only.", file=sys.stderr)
    selected, notes = select(changed)
    for note in notes:
        print(f"note: {note}", file=sys.stderr)
    for path in selected:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
