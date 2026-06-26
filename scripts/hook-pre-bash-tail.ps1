$raw = [Console]::In.ReadToEnd()
$cmd = ($raw | ConvertFrom-Json).tool_input.command
if ($cmd -match '\btail\b') {
    Write-Host "Windows: 'tail' is not available. Use the PowerShell tool with 'Select-Object -Last N' instead."
    exit 2
}
exit 0
