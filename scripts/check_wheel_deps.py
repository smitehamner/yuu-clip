"""Warn when an already-built wheel's base dependencies are stale vs pyproject.

build-release.ps1 deletes and rebuilds build/wheel/*.whl every run, so the wheel
it *ships* is always fresh. The hazard is a stale wheel sitting there beforehand
that someone install-tested by hand: a wheel built before a dependency was added
silently installs none of the new packages (this is exactly how the Tier-A
packaging changes could have shipped un-noticed: an old wheel pulled zero of
speechbrain/torch/transformers/mediapipe/...). Run before the delete: exit 1 with
a one-line explanation if the existing wheel is stale, exit 0 otherwise.

Usage: python check_wheel_deps.py <wheel_path> <pyproject_path>
"""
from __future__ import annotations

import re
import sys
import tomllib
import zipfile
from pathlib import Path

_NAME = re.compile(r"[\s<>=!~;,\[]")


def _dist_name(spec: str) -> str:
    return _NAME.split(spec.strip(), 1)[0].strip().lower().replace("_", "-")


def _wheel_base_deps(wheel_path: str) -> set[str]:
    with zipfile.ZipFile(wheel_path) as archive:
        metadata_name = next(n for n in archive.namelist() if n.endswith(".dist-info/METADATA"))
        text = archive.read(metadata_name).decode("utf-8")
    names = set()
    for line in text.splitlines():
        if line.startswith("Requires-Dist:") and "extra ==" not in line:
            name = _dist_name(line.split(":", 1)[1])
            if name:
                names.add(name)
    return names


def _pyproject_base_deps(pyproject_path: str) -> set[str]:
    data = tomllib.loads(Path(pyproject_path).read_text(encoding="utf-8"))
    return {n for spec in data["project"]["dependencies"] if (n := _dist_name(spec))}


def main() -> int:
    wheel_path, pyproject_path = sys.argv[1], sys.argv[2]
    wheel_deps = _wheel_base_deps(wheel_path)
    project_deps = _pyproject_base_deps(pyproject_path)
    missing = project_deps - wheel_deps
    removed = wheel_deps - project_deps
    if not missing and not removed:
        return 0
    parts = []
    if missing:
        parts.append("missing " + ", ".join(sorted(missing)))
    if removed:
        parts.append("still lists removed " + ", ".join(sorted(removed)))
    print(
        f"Existing wheel {Path(wheel_path).name} is STALE vs pyproject "
        f"({'; '.join(parts)}). Rebuilding now, but any manual install test that "
        f"used the old wheel did NOT reflect current dependencies."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
