"""Guard: every settings field written to the /api/config save payload is also in
_settingsFieldIds (the dirty-tracking list).

UX-REVIEW-2026-07-23 H4: s-visual-mode, s-speaker-min-cluster-seconds, and
s-audio-event-weight were rendered, applied, and read into the save payload but
missing from _settingsFieldIds - so changing only one left Save disabled, no dirty
highlight, and the "Discard changes?" prompt skipped (silent loss of intent). This
pure source scan fails if any field id the payload object reads is not dirty-tracked.
"""
from __future__ import annotations

import re
from pathlib import Path

SETTINGS_JS = (
    Path(__file__).resolve().parents[2]
    / "yuu_clip" / "web" / "static" / "settings" / "settings.js"
)


def _read() -> str:
    return SETTINGS_JS.read_text(encoding="utf-8")


def _tracked_ids(text: str) -> set[str]:
    block = re.search(r"const _settingsFieldIds = \[(.*?)\];", text, re.S)
    assert block, "could not locate _settingsFieldIds array"
    return set(re.findall(r"'(s-[a-z0-9-]+)'", block.group(1)))


def _payload_ids(text: str) -> set[str]:
    # The config PATCH payload object; localStorage.setItem reads sit after its
    # closing brace and are intentionally excluded (browser-local, not dirty-tracked).
    start = text.index("const payload = {")
    end = text.index("\n  };", start)
    block = text[start:end]
    return set(re.findall(r"get\w*\('(s-[a-z0-9-]+)'", block))


def test_every_saved_field_is_dirty_tracked() -> None:
    text = _read()
    untracked = _payload_ids(text) - _tracked_ids(text)
    assert not untracked, (
        "settings fields written to the save payload but missing from "
        f"_settingsFieldIds (won't enable Save / flag dirty): {sorted(untracked)}"
    )
