"""``yuu-dev notices`` - regenerate third-party-notices/THIRD-PARTY-NOTICES.md.

Aggregates the licence text of every bundled runtime dependency - the exact closure
pinned in requirements.lock, read from each installed wheel's dist-info - plus the
non-PyPI bundled components (FFmpeg, llama.cpp, the Oxanium font). Run it whenever
requirements.lock changes; tests/unit/test_third_party_notices.py guards that the
committed file still covers every pinned package.

The reproduced licence texts are verbatim upstream, so this file is exempt from the
ASCII / no-em-dash house rule (see tests/unit/test_no_emdash.py exclusions).
"""
from __future__ import annotations

import re
from importlib import metadata

import typer

from yuu_clip.dev._base import REPO_ROOT, app, console

NOTICES_DIR = REPO_ROOT / "third-party-notices"
NOTICES_PATH = NOTICES_DIR / "THIRD-PARTY-NOTICES.md"
# Curated verbatim licence texts for wheels that ship none in their dist-info,
# keyed by PEP 503-normalized package name. See third-party-notices/README.md.
FALLBACK_DIR = NOTICES_DIR / "fallback-licenses"
LOCK_PATH = REPO_ROOT / "requirements.lock"

_PIN_RE = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*)==([^\s;]+)")
_LICENSE_NAME_RE = re.compile(r"^(licen[sc]e|copying|notice)", re.IGNORECASE)
# A license-named source/binary file (e.g. a `license.py` module) is not licence
# text - reject these extensions so their contents never leak into the notices.
_NON_LICENSE_SUFFIXES = frozenset(
    {".py", ".pyc", ".pyi", ".pyd", ".so", ".dll", ".dylib"}
)

# Non-PyPI bundled components: (display name, purpose, licence id, verbatim-text path).
_BUNDLED_COMPONENTS = [
    ("FFmpeg", "Audio/video extraction and export", "GPL-3.0-or-later",
     "electron/resources/LICENSE-FFMPEG-GPL.txt"),
    ("llama.cpp (llama-server)", "Local LLM/vision engine", "MIT",
     "electron/resources/LICENSE-LLAMA-CPP-MIT.txt"),
    ("Oxanium", "Display typeface (headings and wordmark)", "OFL-1.1",
     "yuu_clip/web/static/fonts/OFL.txt"),
]

_HEADER = """\
# Third-Party Notices

YuuClip is distributed with the third-party components listed below. Each is the
property of its respective authors and is used under the licence shown. The full,
verbatim licence text for every component follows its entry.

The Python packages and versions are the exact runtime closure pinned in
`requirements.lock`; regenerate this file with `yuu-dev notices` whenever that lock
changes. YuuClip's own licence (Apache-2.0) is in the top-level `LICENSE` file.
"""


def normalize_name(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def parse_lock(text: str) -> list[tuple[str, str]]:
    packages: list[tuple[str, str]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = _PIN_RE.match(line)
        if match:
            packages.append((match.group(1), match.group(2)))
    return sorted(packages, key=lambda pair: normalize_name(pair[0]))


def _is_license_file(package_path: metadata.PackagePath) -> bool:
    if not _LICENSE_NAME_RE.match(package_path.name):
        return False
    if package_path.suffix.lower() in _NON_LICENSE_SUFFIXES:
        return False
    text = str(package_path)
    # dist-info/egg-info metadata, or a licence file at a top-level package root
    # (e.g. onnxruntime/LICENSE) which some wheels ship instead of in dist-info.
    return ".dist-info" in text or ".egg-info" in text or len(package_path.parts) <= 2


def license_text_for(dist: metadata.Distribution) -> str:
    chunks: list[str] = []
    for package_path in dist.files or []:
        if not _is_license_file(package_path):
            continue
        try:
            chunks.append(dist.locate_file(package_path).read_text(encoding="utf-8", errors="replace").strip())
        except OSError:
            continue
    return "\n\n".join(chunk for chunk in chunks if chunk)


def declared_license(dist: metadata.Distribution) -> str:
    meta = dist.metadata
    expression = meta.get("License-Expression")
    if expression:
        return expression.strip()
    classifiers = [c.split("::")[-1].strip() for c in meta.get_all("Classifier") or [] if c.startswith("License ::")]
    if classifiers:
        return "; ".join(classifiers)
    declared = (meta.get("License") or "").strip()
    if declared and "\n" not in declared and len(declared) <= 64:
        return declared
    return "See licence text below"


def homepage_for(dist: metadata.Distribution) -> str:
    meta = dist.metadata
    for entry in meta.get_all("Project-URL") or []:
        label, _, url = entry.partition(",")
        if label.strip().lower() in {"homepage", "source", "repository", "home"}:
            return url.strip()
    return (meta.get("Home-page") or "").strip()


def render_section(name: str, version: str, license_id: str, homepage: str, license_text: str) -> str:
    lines = [f"## {name} {version}", "", f"Licence: {license_id}"]
    if homepage:
        lines.append(f"Homepage: {homepage}")
    lines.append("")
    if license_text:
        lines += ["```", license_text, "```"]
    else:
        lines.append("_No licence file was bundled in this wheel; see the homepage above for terms._")
    return "\n".join(lines)


def fallback_text(name: str) -> str:
    path = FALLBACK_DIR / f"{normalize_name(name)}.txt"
    return path.read_text(encoding="utf-8").strip() if path.exists() else ""


def _package_section(name: str, version: str) -> tuple[str, bool]:
    try:
        dist = metadata.distribution(name)
    except metadata.PackageNotFoundError:
        return render_section(name, version, "Unknown (package not installed)", "", ""), True
    license_text = license_text_for(dist) or fallback_text(name)
    section = render_section(name, dist.version, declared_license(dist), homepage_for(dist), license_text)
    return section, not license_text


def _component_section(name: str, purpose: str, license_id: str, rel_path: str) -> str:
    text = (REPO_ROOT / rel_path).read_text(encoding="utf-8").strip()
    return "\n".join([f"## {name}", "", f"Purpose: {purpose}", f"Licence: {license_id}", "", "```", text, "```"])


def build_document() -> tuple[str, list[str]]:
    packages = parse_lock(LOCK_PATH.read_text(encoding="utf-8"))
    missing: list[str] = []
    blocks = [_HEADER, "---", "", "# Python packages", ""]
    for name, version in packages:
        section, no_text = _package_section(name, version)
        if no_text:
            missing.append(name)
        blocks.append(section)
        blocks.append("")
    blocks += ["---", "", "# Bundled components", ""]
    for name, purpose, license_id, rel_path in _BUNDLED_COMPONENTS:
        blocks.append(_component_section(name, purpose, license_id, rel_path))
        blocks.append("")
    return "\n".join(blocks).rstrip() + "\n", missing


@app.command("notices")
def notices() -> None:
    """Regenerate third-party-notices/THIRD-PARTY-NOTICES.md from requirements.lock."""
    if not LOCK_PATH.exists():
        console.print("[red]requirements.lock not found - run `yuu-dev lock-deps` first.[/red]")
        raise typer.Exit(1)
    document, missing = build_document()
    NOTICES_DIR.mkdir(exist_ok=True)
    NOTICES_PATH.write_text(document, encoding="utf-8")
    console.print(f"Wrote {NOTICES_PATH}")
    if missing:
        console.print(
            f"[yellow]note: no bundled licence text for {len(missing)} package(s): "
            f"{', '.join(missing)} (declared licence recorded instead)[/yellow]"
        )
