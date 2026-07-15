; ASCII-only text: this file is compiled by makensis as cp1252.
;
; The desktop shortcut is created by us (customInstall), not electron-builder:
; package.json sets createDesktopShortcut:false so we can gate it on the wizard
; checkbox. This file is prepended before MUI2.nsh, so only macro/Var definitions
; live at file scope; anything using MUI_* is inside a macro inserted later.

; Holds the user's desktop-shortcut choice: "1" create (default), "0" skip.
; Guarded to the installer pass; the uninstaller never touches these and NSIS
; treats an unused variable as a (fatal) warning.
!ifndef BUILD_UNINSTALLER
  Var CreateDesktopShortcut
  Var DesktopShortcutCheckbox
!endif

; Shown once at the very start of the installer, before the welcome page, so users
; know up front that scoring clips with AI means a later multi-GB model download.
!macro customInit
  ; Default to creating the shortcut so a skipped page (e.g. silent install) keeps
  ; the previous behavior. Set for every instance, including the elevated inner one.
  StrCpy $CreateDesktopShortcut "1"

  ${IfNot} ${UAC_IsInnerInstance}
    MessageBox MB_ICONINFORMATION|MB_OK "YuuClip finds and scores your best moments from talk-heavy recordings - RP, voice chat, streaming, podcasts, and commentary.$\r$\n$\r$\nHeads-up on download size: to score clips with AI, first-time setup can download an AI model to your PC - a one-time download of roughly 4-9 GB (about 4.7 GB for the recommended model). This step is optional and can be skipped; finding clips still works without it.$\r$\n$\r$\nThe installer itself is much smaller. Click OK to continue."
  ${EndIf}
!macroend

; Extra options page (shown after install-mode/dir, before files are copied). The
; functions are defined here rather than at file scope so MUI_HEADER_TEXT resolves.
!macro customPageAfterChangeDir
  Page custom desktopShortcutPageCreate desktopShortcutPageLeave

  Function desktopShortcutPageCreate
    !insertmacro MUI_HEADER_TEXT "Options" "One quick choice before Setup installs the files."

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 10u 100% 12u "Create a desktop shortcut"
    Pop $DesktopShortcutCheckbox
    ${If} $CreateDesktopShortcut == "1"
      ${NSD_Check} $DesktopShortcutCheckbox
    ${EndIf}

    ; Setup installs YuuClip plus a bundled AI engine (several GB) in a few
    ; back-to-back steps, and electron-builder's assisted installer restarts the
    ; progress bar for each one. Warn up front so the resets don't look broken.
    ${NSD_CreateLabel} 0 36u 100% 52u "After you click Install, Setup copies YuuClip and its bundled AI engine - several GB in all. This can take a few minutes, and the progress bar may fill up and restart a few times as each part is installed. That is normal - please let it finish."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function desktopShortcutPageLeave
    ${NSD_GetState} $DesktopShortcutCheckbox $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $CreateDesktopShortcut "1"
    ${Else}
      StrCpy $CreateDesktopShortcut "0"
    ${EndIf}
  FunctionEnd
!macroend

; Create the desktop shortcut ourselves (electron-builder's is disabled) so the
; checkbox controls it. $appExe and $newDesktopLink are set by setLinkVars, which
; installSection runs before customInstall.
!macro customInstall
  ${If} $CreateDesktopShortcut == "1"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}
!macroend

; Custom uninstall: remove our desktop shortcut (electron-builder won't, since its
; own creation is disabled) plus runtime directories not tracked by the installer.
!macro customUnInstall
  WinShell::UninstShortcut "$newDesktopLink"
  Delete "$newDesktopLink"
  RMDir /r "$LOCALAPPDATA\yuu-clip"
  RMDir /r "$LOCALAPPDATA\yuu-clip-updater"
!macroend
