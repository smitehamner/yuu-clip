# Exits 0 if no analysis is running (safe to restart). Exits 1 with a warning if active.
try {
    $status = Invoke-RestMethod http://127.0.0.1:8080/api/analyze/status -ErrorAction Stop
    if ($status.running) {
        Write-Warning "An analysis is currently running. Wait for it to finish or cancel it before restarting."
        exit 1
    }
    Write-Host "No analysis running — safe to restart." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "Server not reachable — safe to start." -ForegroundColor Yellow
    exit 0
}
