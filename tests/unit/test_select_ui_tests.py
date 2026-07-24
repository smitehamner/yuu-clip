"""Coverage for scripts/select_ui_tests.py's --changed -> test-file mapping.

Guards the specific gap the docs review flagged: edits to index.src.html,
partials/**, or glossary.md carry user-facing copy but have no stem
_map_static can key off, so they used to fall through to the smoke backstop
alone. See TERMINOLOGY_CONTENT_PREFIXES in the script.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "select_ui_tests.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("select_ui_tests", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


select_ui_tests = _load_module()


def test_index_src_html_maps_to_terminology_and_wizard():
    selected, _notes = select_ui_tests.select(["yuu_clip/web/static/index.src.html"])
    assert "tests/ui/test_ui_terminology.py" in selected
    assert "tests/ui/test_ui_wizard.py" in selected


def test_partial_edit_maps_to_terminology_and_wizard():
    selected, notes = select_ui_tests.select(
        ["yuu_clip/web/static/partials/modals/getting-started.html"]
    )
    assert "tests/ui/test_ui_terminology.py" in selected
    assert "tests/ui/test_ui_wizard.py" in selected
    assert not any("no UI test maps" in note for note in notes)


def test_glossary_md_maps_to_terminology_and_wizard():
    selected, notes = select_ui_tests.select(["yuu_clip/web/static/glossary.md"])
    assert "tests/ui/test_ui_terminology.py" in selected
    assert "tests/ui/test_ui_wizard.py" in selected
    assert not any("no UI test maps" in note for note in notes)


def test_unrelated_static_js_does_not_pull_in_terminology():
    selected, _notes = select_ui_tests.select(["yuu_clip/web/static/videos/videos.js"])
    assert "tests/ui/test_ui_terminology.py" not in selected
    assert "tests/ui/test_ui_wizard.py" not in selected


def test_smoke_backstop_always_included():
    selected, _notes = select_ui_tests.select(["yuu_clip/web/static/glossary.md"])
    assert select_ui_tests.SMOKE in selected
