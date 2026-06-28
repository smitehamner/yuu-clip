; Custom uninstall: remove runtime directories not tracked by the NSIS installer
!macro customUnInstall
  RMDir /r "$LOCALAPPDATA\yuu-clip"
  RMDir /r "$LOCALAPPDATA\yuu-clip-updater"
!macroend
