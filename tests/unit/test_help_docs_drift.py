"""Drift guard: the in-app Help & Guides docs shipped in yuu_clip/web/static/help/
must be byte-identical to their docs/user/ sources. Regenerate with
`yuu-dev help-docs` when this fails (docs/user stays the single source of truth)."""
from __future__ import annotations

import pytest

from yuu_clip.dev.helpdocs import HELP_DOCS, dest_path, source_path


@pytest.mark.parametrize("src_rel,dest_name", HELP_DOCS)
def test_shipped_help_doc_matches_source(src_rel: str, dest_name: str):
    src = source_path(src_rel)
    dst = dest_path(dest_name)
    assert src.exists(), f"help source doc missing: {src}"
    assert dst.exists(), f"{dst} missing - run `yuu-dev help-docs`"
    assert dst.read_bytes() == src.read_bytes(), (
        f"{dst.name} is stale - run `yuu-dev help-docs` and commit the result"
    )


def test_help_docs_cover_the_four_user_guides():
    dest_names = {dest for _, dest in HELP_DOCS}
    assert dest_names == {
        "OVERVIEW.md",
        "FEATURES.md",
        "end-to-end-walkthrough.md",
        "PERFORMANCE.md",
    }
