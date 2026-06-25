$raw = [Console]::In.ReadToEnd()
$fp = ($raw | ConvertFrom-Json).tool_input.file_path
if ($fp -and $fp -match '\.py$') {
    .\scripts\test-api.ps1 -q
    exit $LASTEXITCODE
}
exit 0
