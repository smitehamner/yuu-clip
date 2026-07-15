"""``yuu-dev status`` - is the dev server up / is anything processing?

Runs the /api/status pre-check and a readiness poll (exposed as ``--wait``).
serve.py reuses fetch_status for its own pre-restart safety check.
"""
from __future__ import annotations

import time

import typer

from yuu_clip.dev._base import app, console

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8080
READY_TIMEOUT_S = 30


def fetch_status(host: str, port: int, timeout: float = 3.0) -> dict | None:
    import httpx
    try:
        response = httpx.get(f"http://{host}:{port}/api/status", timeout=timeout)
        response.raise_for_status()
        return response.json()
    except Exception:
        return None


def wait_until_ready(host: str, port: int, timeout: int = READY_TIMEOUT_S) -> bool:
    import httpx
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if httpx.get(f"http://{host}:{port}/api/videos", timeout=2.0).status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


@app.command()
def status(
    host: str = typer.Option(DEFAULT_HOST, "--host"),
    port: int = typer.Option(DEFAULT_PORT, "--port"),
    wait: bool = typer.Option(False, "--wait", help="Poll until the server answers, then exit."),
) -> None:
    """Report whether the dev server is running / busy (exit 1 if processing is active)."""
    if wait:
        if wait_until_ready(host, port):
            console.print("[green]Server is ready.[/green]")
            raise typer.Exit(0)
        console.print(f"[yellow]Server did not respond within {READY_TIMEOUT_S} seconds.[/yellow]")
        raise typer.Exit(1)

    current = fetch_status(host, port)
    if current is None:
        console.print("[yellow]Server not reachable - safe to start.[/yellow]")
        raise typer.Exit(0)
    if current.get("any_running"):
        console.print("[yellow]Processing is active - wait or cancel before restarting.[/yellow]")
        console.print(
            f"  analyze_running={current.get('analyze_running')} "
            f"active_jobs={current.get('active_jobs')}"
        )
        raise typer.Exit(1)
    console.print("[green]No processing running - safe to restart.[/green]")
    raise typer.Exit(0)
