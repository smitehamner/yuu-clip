# Exits 0 if no ingest is running (safe to restart). Exits 1 with a warning if active.
try {
    $status = Invoke-RestMethod http://127.0.0.1:8080/api/ingest/status -ErrorAction Stop
    if ($status.running) {
        Write-Warning "An ingest is currently running. Wait for it to finish or cancel it before restarting."
        exit 1
    }
    Write-Host "No ingest running — safe to restart." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "Server not reachable — safe to start." -ForegroundColor Yellow
    exit 0
}
