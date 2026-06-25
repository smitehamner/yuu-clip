"""
RP Context storage and formatting.

Contexts are named blobs of world knowledge (setting, characters, notes) that
get injected into every LLM prompt so the model understands who is in a session.

Stored per-project in .rp-clipper/contexts.json.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

_CONTEXTS_FILE = "contexts.json"

_FIELDS = [
    ("setting",           "Setting"),
    ("your_characters",   "Your characters"),
    ("other_characters",  "Frequent other characters"),
    ("notes",             "Notes"),
]


def _path(project_dir: Path) -> Path:
    return project_dir / ".rp-clipper" / _CONTEXTS_FILE


def load_contexts(project_dir: Path) -> dict:
    p = _path(project_dir)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def save_contexts(project_dir: Path, contexts: dict) -> None:
    p = _path(project_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(contexts, indent=2, ensure_ascii=False), encoding="utf-8")


def format_context_block(contexts: dict, slugs: list[str]) -> str:
    """Build the LLM injection block for the given context slugs.

    Returns an empty string when no matching contexts are found.
    """
    blocks: list[str] = []
    for slug in slugs:
        ctx = contexts.get(slug)
        if not ctx:
            continue
        name = ctx.get("display_name", slug)
        parts = [f"== RP CONTEXT: {name} =="]
        for field_key, label in _FIELDS:
            val = ctx.get(field_key, "").strip()
            if val:
                parts.append(f"[{label}] {val}")
        parts.append("== END CONTEXT ==")
        blocks.append("\n".join(parts))
    return "\n\n".join(blocks)
