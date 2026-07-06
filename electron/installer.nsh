; Shown once at the very start of the installer, before the welcome page, so users
; know up front that scoring clips with AI means a later multi-GB model download.
; ASCII-only text: this file is compiled by makensis as cp1252.
!macro customInit
  ${IfNot} ${UAC_IsInnerInstance}
    MessageBox MB_ICONINFORMATION|MB_OK "yuu-clip finds and scores your best gaming clips.$\r$\n$\r$\nHeads-up on download size: to score clips with AI, first-time setup can download an AI model to your PC - a one-time download of roughly 4-9 GB (about 4.7 GB for the recommended model). This step is optional and can be skipped; finding clips still works without it.$\r$\n$\r$\nThe installer itself is much smaller. Click OK to continue."
  ${EndIf}
!macroend

; Custom uninstall: remove runtime directories not tracked by the NSIS installer
!macro customUnInstall
  RMDir /r "$LOCALAPPDATA\yuu-clip"
  RMDir /r "$LOCALAPPDATA\yuu-clip-updater"
!macroend
