; NSIS Installer Customization for Moltbot Desktop
; This file is included by electron-builder during Windows installer creation

!macro customHeader
  ; Custom header settings
!macroend

!macro preInit
  ; Called before initialization
!macroend

!macro customInit
  ; Called after initialization
!macroend

!macro customInstall
  ; Called after files are installed
  
  ; Create data directory
  CreateDirectory "$APPDATA\Moltbot"
  
  ; Add to PATH (optional - for CLI access)
  ; EnVar::AddValue "PATH" "$INSTDIR"
!macroend

!macro customUnInstall
  ; Called during uninstall
  
  ; Remove data directory (optional - ask user)
  ; RMDir /r "$APPDATA\Moltbot"
!macroend

!macro customInstallMode
  ; Set default install mode
  ; allow user to choose between per-user and per-machine
!macroend
