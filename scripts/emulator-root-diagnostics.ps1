param(
  [string]$Serial = "emulator-5554",
  [string]$AvdName = "Medium_Phone",
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Adb = Join-Path $RepoRoot "src-tauri\resources\windows\adb.exe"
$ReportDir = Join-Path $RepoRoot "docs\reports"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not (Test-Path -LiteralPath $Adb)) {
  $Adb = "adb"
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $ReportDir "emulator-root-diagnostics-$Timestamp.md"
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Invoke-Adb {
  param([string[]]$Arguments)

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & $Adb @Arguments 2>&1
  $ErrorActionPreference = $previousPreference
  [pscustomobject]@{
    ExitCode = $LASTEXITCODE
    Output = ($output -join "`n").Trim()
  }
}

function Add-Section {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Title,
    [string]$Command,
    [pscustomobject]$Result
  )

  $Lines.Add("## $Title")
  $Lines.Add("")
  $Lines.Add("Command: ``$Command``")
  $Lines.Add("")
  $Lines.Add("Exit code: ``$($Result.ExitCode)``")
  $Lines.Add("")
  $Lines.Add("``````text")
  if ([string]::IsNullOrWhiteSpace($Result.Output)) {
    $Lines.Add("<empty>")
  } else {
    $Lines.Add($Result.Output)
  }
  $Lines.Add("``````")
  $Lines.Add("")
}

function Get-AvdRamdiskPath {
  param([string]$Name)

  $iniPath = Join-Path $env:USERPROFILE ".android\avd\$Name.ini"
  if (-not (Test-Path -LiteralPath $iniPath)) {
    return $null
  }

  $avdPath = (Get-Content -LiteralPath $iniPath | Where-Object { $_ -like "path=*" } | Select-Object -First 1) -replace "^path=", ""
  if ([string]::IsNullOrWhiteSpace($avdPath)) {
    return $null
  }

  $configPath = Join-Path $avdPath "config.ini"
  if (-not (Test-Path -LiteralPath $configPath)) {
    return $null
  }

  $sysDir = (Get-Content -LiteralPath $configPath | Where-Object { $_ -like "image.sysdir.1=*" } | Select-Object -First 1) -replace "^image\.sysdir\.1=", ""
  if ([string]::IsNullOrWhiteSpace($sysDir)) {
    return $null
  }

  return Join-Path $env:LOCALAPPDATA ("Android\Sdk\" + $sysDir + "ramdisk.img")
}

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("# Emulator Root Diagnostics")
$lines.Add("")
$lines.Add("- Timestamp: $Timestamp")
$lines.Add("- Serial: $Serial")
$lines.Add("- AVD: $AvdName")
$lines.Add("- ADB: $Adb")
$lines.Add("")

$ramdisk = Get-AvdRamdiskPath -Name $AvdName
if ($ramdisk) {
  $lines.Add("## AVD Ramdisk")
  $lines.Add("")
  $lines.Add("- Path: ``$ramdisk``")
  if (Test-Path -LiteralPath $ramdisk) {
    $item = Get-Item -LiteralPath $ramdisk
    $lines.Add("- Size: $($item.Length) bytes")
    $lines.Add("- Modified: $($item.LastWriteTime)")
  } else {
    $lines.Add("- Status: missing")
  }

  $backup = "$ramdisk.backup"
  $lines.Add("- Backup: ``$backup``")
  if (Test-Path -LiteralPath $backup) {
    $item = Get-Item -LiteralPath $backup
    $lines.Add("- Backup size: $($item.Length) bytes")
    $lines.Add("- Backup modified: $($item.LastWriteTime)")
  } else {
    $lines.Add("- Backup status: missing")
  }
  $lines.Add("")
}

Add-Section $lines "ADB Devices" "$Adb devices -l" (Invoke-Adb @("devices", "-l"))
Add-Section $lines "Build And Boot Props" "$Adb -s $Serial shell getprop ..." (Invoke-Adb @("-s", $Serial, "shell", "printf 'sdk='; getprop ro.build.version.sdk; printf 'abi='; getprop ro.product.cpu.abi; printf 'boot_completed='; getprop sys.boot_completed; printf 'snapshot_loaded='; getprop ro.kernel.androidboot.snapshot_loaded; printf 'verified_boot='; getprop ro.boot.verifiedbootstate; printf 'selinux='; getenforce 2>/dev/null || true"))
Add-Section $lines "Magisk Packages" "$Adb -s $Serial shell pm list packages | grep -i magisk" (Invoke-Adb @("-s", $Serial, "shell", "pm list packages | grep -i 'magisk\|kitsune\|alpha\|delta' || true"))
Add-Section $lines "su Probe" "$Adb -s $Serial shell su -c id -u" (Invoke-Adb @("-s", $Serial, "shell", "su -c id -u"))
Add-Section $lines "Workdir Probe" "$Adb -s $Serial shell ls -la /data/local/tmp/adb-gui-root" (Invoke-Adb @("-s", $Serial, "shell", "ls -la /data/local/tmp/adb-gui-root 2>/dev/null || true"))
Add-Section $lines "Download Folder Root Artifacts" "$Adb -s $Serial shell ls -la /sdcard/Download" (Invoke-Adb @("-s", $Serial, "shell", "ls -la /sdcard/Download | grep -i 'magisk\|fakeboot\|patched' || true"))

$lines | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Output $OutputPath
