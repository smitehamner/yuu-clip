"""``yuu-dev serve`` - start the dev web server.

Runs the /api/status pre-check (warn + confirm
before interrupting a live job), reap this repo's stale serve processes and any
orphaned llama-server, then spawn a fresh detached server. Adds a free-port
fallback: after reaping our own servers :8080 is normally free, but if a foreign
app still holds it we bind the next free port and print the real URL instead of
failing (the dev half of the 8080 gap).
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import typer

from yuu_clip.dev import procs
from yuu_clip.dev._base import REPO_ROOT, app, console, tail_log
from yuu_clip.dev.status import DEFAULT_HOST, DEFAULT_PORT, fetch_status, wait_until_ready

LLAMA_RUNTIME_DIR = REPO_ROOT / "build" / "llama-server-runtime"
SERVE_MATCH = "yuu_clip.cli serve"
PORT_FALLBACK_TRIES = 20


def stale_serve_pids(processes: list[procs.ProcInfo], repo_root: Path) -> list[int]:
    root = str(repo_root)
    return [
        proc.pid for proc in processes
        if proc.name.lower() == "python.exe"
        and SERVE_MATCH in proc.command_line
        and root in proc.command_line
    ]


def orphan_llama_pids(processes: list[procs.ProcInfo], llama_dir: Path) -> list[int]:
    target = str(llama_dir)
    return [
        proc.pid for proc in processes
        if proc.name.lower() == "llama-server.exe"
        and target in proc.command_line
    ]


def port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def find_free_port(host: str, start: int, max_tries: int = PORT_FALLBACK_TRIES) -> int | None:
    for offset in range(max_tries):
        candidate = start + offset
        if not port_in_use(host, candidate):
            return candidate
    return None


def _confirm_restart_if_busy(host: str, port: int, assume_yes: bool) -> None:
    current = fetch_status(host, port)
    if not (current and current.get("any_running")) or assume_yes:
        return
    console.print("[yellow]Processing is active on the running server:[/yellow]")
    console.print(
        f"  analyze_running={current.get('analyze_running')} "
        f"active_jobs={current.get('active_jobs')}"
    )
    if not typer.confirm("Restarting will interrupt it. Continue?"):
        console.print("Aborted.")
        raise typer.Exit(1)


def _reap(processes: list[procs.ProcInfo]) -> bool:
    reaped = False
    for pid in stale_serve_pids(processes, REPO_ROOT):
        console.print(f"Killing stale serve PID {pid}...")
        procs.kill(pid)
        reaped = True
    for pid in orphan_llama_pids(processes, LLAMA_RUNTIME_DIR):
        console.print(f"Killing orphaned llama-server PID {pid}...")
        procs.kill(pid)
        reaped = True
    return reaped


def _spawn_detached(cmd: list[str], env: dict[str, str]) -> None:
    kwargs: dict = {"cwd": str(REPO_ROOT), "env": env}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
        kwargs["stdout"] = subprocess.DEVNULL
        kwargs["stderr"] = subprocess.DEVNULL
    subprocess.Popen(cmd, **kwargs)


@app.command()
def serve(
    host: str = typer.Option(DEFAULT_HOST, "--host"),
    port: int = typer.Option(DEFAULT_PORT, "--port"),
    stop: bool = typer.Option(False, "--stop", help="Reap running servers and exit without starting one."),
    yes: bool = typer.Option(False, "--yes", help="Skip the 'processing is active' confirmation."),
    open_browser: bool = typer.Option(True, "--open/--no-open"),
) -> None:
    """Restart the dev web server (with a free-port fallback and running-job guard)."""
    _confirm_restart_if_busy(host, port, yes)

    processes = procs.list_processes(["python.exe", "llama-server.exe"])
    if _reap(processes):
        time.sleep(0.5)

    if stop:
        console.print("Server stopped.")
        raise typer.Exit(0)

    chosen = find_free_port(host, port)
    if chosen is None:
        console.print(f"[red]Port {port} is in use - pass --port <n> or close the other app.[/red]")
        raise typer.Exit(1)
    if chosen != port:
        console.print(f"[yellow]Port {port} is in use; using {chosen} instead.[/yellow]")

    env = os.environ.copy()
    if LLAMA_RUNTIME_DIR.exists():
        env["YUU_CLIP_LLAMA_SERVER_DIR"] = str(LLAMA_RUNTIME_DIR)
    elif sys.platform == "win32":
        console.print("Run scripts\\fetch-llama-server-runtime.ps1 to enable local LLM/vision in dev")
    else:
        console.print("No local llama-server runtime found; local LLM/vision is disabled in dev")

    cmd = [sys.executable, "-m", "yuu_clip.cli", "serve",
           "--project", str(REPO_ROOT), "--host", host, "--port", str(chosen)]
    if not open_browser:
        cmd.append("--no-open")
    _spawn_detached(cmd, env)

    console.print(f"[cyan]Server starting at http://{host}:{chosen} ...[/cyan]")
    if not wait_until_ready(host, chosen, timeout=15):
        console.print("[yellow]Server did not answer within 15s - check the log.[/yellow]")
    for line in tail_log(3):
        console.print(line)
