"""Guard against the B21 UX bug shape: a tall modal with no header close control.

A modal whose only way out is a bottom action button scrolls off-screen on a short
window (the Getting-Started modal bug, then found again on About/Batch
Export/Context Manager/Export Settings - see docs/dev's UX bug hunt notes). The fix
convention is the `getting-started.html` header pattern: a flex row with the `<h3>`
title and a `<button ... aria-label="Close">` X, kept alongside the modal's existing
bottom action button(s), not instead of them.

This only requires the header X for modals long enough that a bottom-only button can
scroll out of view - see the line-count threshold below, picked from the shortest
modal that was flagged as a real reachability bug (51 lines) vs. the tallest modal
left alone as a non-issue (29 lines).
"""
from __future__ import annotations

from yuu_clip.dev.htmlstitch import PARTIALS_DIR

MODALS_DIR = PARTIALS_DIR / "modals"

# Modals at or under this line count fit on a normal window without scrolling, so a
# bottom-only close button is a minor consistency nit, not a reachability bug (see
# the B21 finding: nothing <=29 lines was flagged, everything >=51 lines was).
LINE_COUNT_THRESHOLD = 30

_HEADER_CLOSE_MARKER = 'aria-label="Close"'


def _modal_line_count(path) -> int:
    return path.read_text(encoding="utf-8").count("\n")


def test_tall_modals_have_a_header_close_control():
    offenders = []
    for path in sorted(MODALS_DIR.glob("*.html")):
        if _modal_line_count(path) <= LINE_COUNT_THRESHOLD:
            continue
        if _HEADER_CLOSE_MARKER not in path.read_text(encoding="utf-8"):
            offenders.append(path.name)
    assert not offenders, (
        f"modal partial(s) over {LINE_COUNT_THRESHOLD} lines with no header close "
        f"control: {offenders}. Add the getting-started.html header pattern - a flex "
        f'row with the <h3> title and <button class="btn ghost" aria-label="Close">'
        f"&#x2715;</button> - alongside the existing bottom action button(s)."
    )
