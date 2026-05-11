param(
  [string]$DeviceId = "",
  [string]$AdbPath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-AdbPath {
  param([string]$ProvidedPath)

  if ($ProvidedPath -and (Test-Path $ProvidedPath)) {
    return $ProvidedPath
  }

  $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($adbCmd) {
    return $adbCmd.Source
  }

  $candidates = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe",
    "C:\Android\platform-tools\adb.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  return $null
}

$adbExe = Resolve-AdbPath -ProvidedPath $AdbPath
if (-not $adbExe) {
  Write-Error "adb not found. Install Android platform-tools or pass -AdbPath <path_to_adb.exe>."
}

$adbArgs = @()
if ($DeviceId -ne "") {
  $adbArgs += @("-s", $DeviceId)
}

Write-Host "Checking connected devices..."
& $adbExe @adbArgs devices

Write-Host "Clearing old logcat buffer..."
& $adbExe @adbArgs logcat -c

Write-Host "Streaming assistant logs. Press Ctrl+C to stop."
& $adbExe @adbArgs logcat -v time FrontAssistantSession:D FrontAssistantMain:D FrontAssistantSessionSvc:D FrontAssistantService:D *:S
