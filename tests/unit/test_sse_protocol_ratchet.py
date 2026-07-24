"""Ratchet guard for the typed SSE job-event protocol - migration stage 4.

Once every emitter and consumer speaks the typed wire (jobevents.py / jobevents.js),
the pre-protocol vocabulary must never creep back:

- the ``__DONE__`` sentinel literal (the retired two/three-form done sentinel), and
- a ``sse_event(`` framing call (the retired ad-hoc framing helper - the ONE framing
  entry point is now ``jobevents.frame``).

This is a pure source scan (no browser, no server), so it lives in the unit tier. It
scans every hand-written ``.py`` / ``.js`` source under ``yuu_clip/`` - which includes
the web ``static/`` tree - and fails if either token appears. Two artifacts are exempt:
``bundle.esm.js`` (a generated esbuild output) and ``web/jobevents.py`` itself (the
protocol's home, allowed to reference the retired forms in its migration notes).
"""
from __future__ import annotations

from pathlib import Path

YUU_CLIP_DIR = Path(__file__).resolve().parents[2] / "yuu_clip"

# Generated bundle (esbuild output) + the protocol's own module, which documents the
# retired forms in its history notes. Everything else must be clean.
_EXEMPT_NAMES = {"bundle.esm.js"}
_EXEMPT_RELATIVE = {"web/jobevents.py"}

_FORBIDDEN = ("__DONE__", "sse_event(")


def _scanned_sources() -> list[Path]:
    sources: list[Path] = []
    for pattern in ("*.py", "*.js"):
        for path in YUU_CLIP_DIR.rglob(pattern):
            if path.name in _EXEMPT_NAMES:
                continue
            if path.relative_to(YUU_CLIP_DIR).as_posix() in _EXEMPT_RELATIVE:
                continue
            sources.append(path)
    return sources


def test_no_legacy_sse_tokens_in_source() -> None:
    offenders: dict[str, list[str]] = {}
    for path in _scanned_sources():
        text = path.read_text(encoding="utf-8")
        hits = [token for token in _FORBIDDEN if token in text]
        if hits:
            offenders[path.relative_to(YUU_CLIP_DIR).as_posix()] = hits
    assert not offenders, (
        "Legacy SSE-protocol tokens are back - every emitter/consumer must use the "
        "typed jobevents wire (jobevents.frame / decodeEvent), never the retired "
        f"__DONE__ sentinel or an ad-hoc sse_event() framing call: {offenders}"
    )


def test_ratchet_actually_scans_the_protocol_modules() -> None:
    # Guard the guard: if the glob or exempt logic silently stops covering the wire
    # modules, the scan above would pass vacuously. Assert the known homes are scanned.
    scanned = {path.relative_to(YUU_CLIP_DIR).as_posix() for path in _scanned_sources()}
    assert "web/sse.py" in scanned
    assert "web/static/core/jobevents.js" in scanned
    assert "web/static/core/jobs.js" in scanned
    # And that the two exemptions are genuinely excluded.
    assert "web/jobevents.py" not in scanned
    assert not any(name.endswith("bundle.esm.js") for name in scanned)
