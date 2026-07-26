"""yuu_clip/console.py - the shared Rich console and the MB size unit.

Trivial module (a Console instance + a constant), but both are relied on by the
export/pipeline progress printers, so a regression that made the constant wrong
(or the console None) would silently corrupt every "(X.X MB)" annotation.
"""
from __future__ import annotations

from rich.console import Console

from yuu_clip.console import BYTES_PER_MB, console


def test_console_is_a_rich_console_instance():
    assert isinstance(console, Console)


def test_bytes_per_mb_is_the_binary_megabyte():
    assert BYTES_PER_MB == 1024 * 1024
