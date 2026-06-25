# Polls http://127.0.0.1:8080/api/videos until the server responds, then exits 0.
# Exits 1 if the server does not respond within 30 seconds.
$timeout = 30
for ($i = 0; $i -lt $timeout; $i++) {
    try {
        $null = Invoke-RestMethod http://127.0.0.1:8080/api/videos -ErrorAction Stop
        Write-Host "Server is ready." -ForegroundColor Green
        exit 0
    } catch {
        Start-Sleep -Seconds 1
    }
}
Write-Warning "Server did not respond within $timeout seconds."
exit 1
