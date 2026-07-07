"""Coverage for the build-release stale-wheel guard (scripts/check_wheel_deps.py).

This guard exists precisely because the Tier-A packaging changes added base
dependencies (speechbrain/torch/transformers/mediapipe/...): a wheel built before
those were added installs none of them, so an install test against a stale wheel
silently proves nothing. These tests lock in the fresh->0 / stale->1 contract and
the dependency-name normalization it relies on to compare the two sides.
"""
from __future__ import annotations

import importlib.util
import zipfile
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check_wheel_deps.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("check_wheel_deps", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


check_wheel_deps = _load_module()


def _write_wheel(path: Path, requires_dist: list[str]) -> None:
    lines = ["Metadata-Version: 2.1", "Name: yuu-clip", "Version: 0.0.0"]
    lines += [f"Requires-Dist: {spec}" for spec in requires_dist]
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("yuu_clip-0.0.0.dist-info/METADATA", "\n".join(lines) + "\n")


def _write_pyproject(path: Path, dependencies: list[str]) -> None:
    body = ["[project]", 'name = "yuu-clip"', 'version = "0.0.0"', "dependencies = ["]
    body += [f'    "{spec}",' for spec in dependencies]
    body.append("]")
    path.write_text("\n".join(body) + "\n", encoding="utf-8")


class TestDistName:
    def test_strips_version_extras_and_markers_and_normalizes_underscores(self):
        assert check_wheel_deps._dist_name("Torch_Vision>=1.2; extra=='x'") == "torch-vision"
        assert check_wheel_deps._dist_name("faster-whisper[cuda]") == "faster-whisper"
        assert check_wheel_deps._dist_name("  NumPy == 2.0  ") == "numpy"


class TestMain:
    def _run(self, monkeypatch, capsys, wheel: Path, pyproject: Path) -> tuple[int, str]:
        monkeypatch.setattr(check_wheel_deps.sys, "argv", ["prog", str(wheel), str(pyproject)])
        code = check_wheel_deps.main()
        return code, capsys.readouterr().out

    def test_fresh_wheel_matching_pyproject_exits_zero_silently(self, tmp_path, monkeypatch, capsys):
        wheel = tmp_path / "fresh.whl"
        pyproject = tmp_path / "pyproject.toml"
        _write_wheel(wheel, ["torch>=2.0", "transformers"])
        _write_pyproject(pyproject, ["torch>=2.0", "transformers"])
        code, out = self._run(monkeypatch, capsys, wheel, pyproject)
        assert code == 0
        assert out.strip() == ""

    def test_wheel_missing_a_new_dependency_exits_one(self, tmp_path, monkeypatch, capsys):
        wheel = tmp_path / "stale.whl"
        pyproject = tmp_path / "pyproject.toml"
        _write_wheel(wheel, ["torch>=2.0"])  # built before mediapipe was added
        _write_pyproject(pyproject, ["torch>=2.0", "mediapipe"])
        code, out = self._run(monkeypatch, capsys, wheel, pyproject)
        assert code == 1
        assert "missing mediapipe" in out

    def test_wheel_still_listing_a_removed_dependency_exits_one(self, tmp_path, monkeypatch, capsys):
        wheel = tmp_path / "stale.whl"
        pyproject = tmp_path / "pyproject.toml"
        _write_wheel(wheel, ["torch>=2.0", "obsolete-lib"])
        _write_pyproject(pyproject, ["torch>=2.0"])
        code, out = self._run(monkeypatch, capsys, wheel, pyproject)
        assert code == 1
        assert "still lists removed obsolete-lib" in out

    def test_optional_extra_deps_are_not_treated_as_base_deps(self, tmp_path, monkeypatch, capsys):
        # A wheel's `; extra == "..."` requirements are optional-group deps, not
        # base deps, so their absence from pyproject.dependencies is not staleness.
        wheel = tmp_path / "fresh.whl"
        pyproject = tmp_path / "pyproject.toml"
        _write_wheel(wheel, ["torch>=2.0", 'pytest; extra == "dev"'])
        _write_pyproject(pyproject, ["torch>=2.0"])
        code, out = self._run(monkeypatch, capsys, wheel, pyproject)
        assert code == 0
        assert out.strip() == ""
