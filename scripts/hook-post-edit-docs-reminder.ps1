$raw = [Console]::In.ReadToEnd()
$fp = ($raw | ConvertFrom-Json).tool_input.file_path
if ($fp -and ($fp -match '\.(py|js)$') -and ($fp -notmatch '[/\\]docs[/\\]')) {
    @{
        hookSpecificOutput = @{
            hookEventName    = "PostToolUse"
            additionalContext = "Reminder: if this edit completes a feature or fix worth documenting, update docs/project/COMPLETED.md, docs/user/FEATURES.md, and/or the project_roadmap.md memory file."
        }
    } | ConvertTo-Json -Compress
}
exit 0
