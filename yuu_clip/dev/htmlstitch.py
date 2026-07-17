"""Stitch the committed ``static/index.html`` from ``index.src.html`` + partials.

``index.html`` is a build artifact, not a hand-edited file. The maintainable source
is ``static/index.src.html`` (the page shell) plus one file per modal/region under
``static/partials/``. ``yuu-dev bundle`` stitches them into ``index.html``; the browser,
every load-time ``getElementById`` wiring, ``tests/js/setup.js``, and every Playwright
selector see the exact same single committed file they always have.

The stitch is byte-exact and pure-Python (no Node), so its drift guard
(``tests/unit/test_index_html_drift.py``) runs in the unit tier even offline - unlike the
esbuild bundle, which needs the JS toolchain. Edit the partials / ``index.src.html`` and
re-run ``yuu-dev bundle``; never hand-edit the committed ``index.html``.

Include syntax (one per line, indentation is cosmetic - the whole line is replaced)::

    <!-- @@include modals/about.html -->
"""
from __future__ import annotations

import re
from pathlib import Path

from yuu_clip.dev._base import REPO_ROOT

STATIC_DIR = REPO_ROOT / "yuu_clip" / "web" / "static"
INDEX_SRC = STATIC_DIR / "index.src.html"
INDEX_HTML = STATIC_DIR / "index.html"
PARTIALS_DIR = STATIC_DIR / "partials"

# Whole-line include marker. Bytes (not text) so the stitch is byte-identical
# regardless of platform newline handling - index.html is committed LF.
_INCLUDE_RE = re.compile(rb"^[ \t]*<!-- @@include (\S+) -->[ \t]*\n", re.MULTILINE)


def stitch(src_bytes: bytes, partials_dir: Path = PARTIALS_DIR) -> bytes:
    """Expand every ``@@include`` marker in ``src_bytes`` with its partial's bytes.

    Single level by design - a partial must not itself contain an include marker
    (guarded by the drift test). Missing partials raise ``FileNotFoundError`` so a
    typo can never silently drop a region."""

    def _replace(match: re.Match[bytes]) -> bytes:
        rel = match.group(1).decode("utf-8")
        return (partials_dir / rel).read_bytes()

    return _INCLUDE_RE.sub(_replace, src_bytes)


def render_index() -> bytes:
    return stitch(INDEX_SRC.read_bytes())


def write_index() -> None:
    INDEX_HTML.write_bytes(render_index())


def index_is_current() -> bool:
    return INDEX_HTML.read_bytes() == render_index()
