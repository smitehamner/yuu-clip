"""Windows process enumeration + termination for the dev CLI.

No psutil dependency: on Windows the stdlib cannot read another process's
command line, so we shell out to Get-CimInstance for a compact JSON dump and
parse it here. This module is only the data fetch and kill primitive - the
*matching* logic (which PIDs are stale yuu servers, orphaned llama-servers,
leftover pytest workers) lives in the command modules as pure functions so it
is unit-testable without touching real processes.
"""
from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass

from yuu_clip.console import console


@dataclass(frozen=True)
class ProcInfo:
    pid: int
    name: str
    command_line: str


def list_processes(names: list[str]) -> list[ProcInfo]:
    if sys.platform != "win32":
        return []
    filt = " or ".join(f"Name='{name}'" for name in names)
    script = (
        f'Get-CimInstance Win32_Process -Filter "{filt}" | '
        "Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"
    )
    try:
        completed = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            capture_output=True, text=True, timeout=20,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        console.print(
            f"[yellow]Could not enumerate processes ({exc}); skipping reap.[/yellow]"
        )
        return []
    return parse_cim_json(completed.stdout)


def parse_cim_json(raw: str) -> list[ProcInfo]:
    raw = raw.strip()
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if isinstance(data, dict):
        data = [data]
    procs: list[ProcInfo] = []
    for row in data:
        procs.append(ProcInfo(
            pid=int(row["ProcessId"]),
            name=str(row.get("Name") or ""),
            command_line=str(row.get("CommandLine") or ""),
        ))
    return procs


def kill(pid: int) -> None:
    if sys.platform != "win32":
        return
    # /T kills the whole process tree by pid - the web server's analyze child
    # (which holds the SQLite write lock) is a grandchild here, so without /T the
    # parent dies but the analyze subprocess is orphaned and keeps the lock. This
    # matches web/sse.py terminate_process_tree.
    subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, text=True)
