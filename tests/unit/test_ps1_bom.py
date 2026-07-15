"""Guard: every repo-owned .ps1 file that contains non-ASCII bytes must start
with a UTF-8 BOM (CLAUDE.md / memory feedback-powershell-bom-encoding).

Windows PowerShell 5.1 with no BOM decodes a script as the OS legacy codepage
(Windows-1252), not UTF-8. The UTF-8 bytes for the em-dash (U+2014) and `─`
(U+2500) both contain 0x94, which cp1252 turns into `”` - a smart quote PowerShell
treats as a real string delimiter, producing "missing terminator" parse errors far
from the actual character. A BOM forces UTF-8 decoding and prevents this.

ASCII-only scripts don't need a BOM, so this only flags files that would actually
misparse.
"""
from __future__ import annotations

from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[2] / "scripts"
BOM = b"\xef\xbb\xbf"


def _is_ascii(body: bytes) -> bool:
    return all(byte < 0x80 for byte in body)


def test_non_ascii_ps1_scripts_have_utf8_bom():
    offenders = []
    for path in sorted(SCRIPTS_DIR.rglob("*.ps1")):
        raw = path.read_bytes()
        has_bom = raw.startswith(BOM)
        body = raw[len(BOM):] if has_bom else raw
        if not _is_ascii(body) and not has_bom:
            offenders.append(path.name)
    assert offenders == [], (
        "non-ASCII .ps1 scripts missing a UTF-8 BOM (will misparse under "
        f"PowerShell 5.1 / cp1252): {offenders}"
    )
