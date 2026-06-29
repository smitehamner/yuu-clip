"""Web UI server command."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

from yuu_clip.cli._base import _project_dir, app, console


@app.command()
def serve(
    project: Optional[Path] = typer.Option(None, "-p", "--project"),
    host:    str            = typer.Option("127.0.0.1", "--host"),
    port:    int            = typer.Option(8080,        "--port"),
    open_browser: bool      = typer.Option(True,        "--open/--no-open"),
    reload:  bool           = typer.Option(False,       "--reload/--no-reload",
                                           help="Auto-restart when source files change (development)"),
) -> None:
    """Start the web UI server."""
    import os
    import threading
    import webbrowser

    import uvicorn

    proj_dir = _project_dir(project)
    console.print(f"  Project:  [dim]{proj_dir}[/dim]")
    console.print(f"  Serving at [cyan]http://{host}:{port}[/cyan]  (Ctrl+C to stop)")
    if reload:
        console.print("  [yellow]Reload mode on — server restarts when source files change[/yellow]")

    if open_browser:
        def _open_after_delay() -> None:
            import time
            time.sleep(1.2)
            webbrowser.open(f"http://{host}:{port}")
        threading.Thread(target=_open_after_delay, daemon=True).start()

    if reload:
        os.environ["YUU_CLIP_PROJECT"] = str(proj_dir)
        uvicorn.run(
            "yuu_clip.web.app:_reload_factory",
            host=host, port=port, log_level="info",
            reload=True, factory=True,
        )
    else:
        from yuu_clip.web.app import create_app
        uvicorn.run(create_app(proj_dir), host=host, port=port, log_level="warning")
