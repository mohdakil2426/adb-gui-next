param(
  [string]$Serial = "emulator-5554",
  [string]$AvdName = "Medium_Phone"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Adb = Join-Path $RepoRoot "src-tauri\resources\windows\adb.exe"
$Emulator = Join-Path $env:LOCALAPPDATA "Android\Sdk\emulator\emulator.exe"
$SdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$RootAvdDir = Join-Path $RepoRoot "docs\refrences\github-repos\rootAVD"
$RootAvdBat = Join-Path $RootAvdDir "rootAVD.bat"

if (-not (Test-Path -LiteralPath $Adb)) {
  $Adb = "adb"
}

function Invoke-Native {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory = (Get-Location).Path
  )

  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  Push-Location $WorkingDirectory
  try {
    $output = & $FilePath @Arguments 2>&1
    [pscustomobject]@{
      ExitCode = $LASTEXITCODE
      Output = ($output -join "`n").Trim()
    }
  } finally {
    Pop-Location
    $ErrorActionPreference = $previousPreference
  }
}

function Wait-ForNoDevice {
  for ($i = 1; $i -le 45; $i++) {
    $devices = (Invoke-Native $Adb @("devices", "-l")).Output
    $emulatorProcesses =
      Get-Process -ErrorAction SilentlyContinue |
      Where-Object { $_.ProcessName -like "emulator*" -or $_.ProcessName -like "qemu*" }
    if ($devices -notmatch [regex]::Escape($Serial) -and -not $emulatorProcesses) {
      return
    }
    Start-Sleep -Seconds 2
  }

  Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like "emulator*" -or $_.ProcessName -like "qemu*" } |
    Stop-Process -Force
}

function Wait-ForBoot {
  for ($i = 1; $i -le 90; $i++) {
    $devices = (Invoke-Native $Adb @("devices", "-l")).Output
    $boot = (Invoke-Native $Adb @("-s", $Serial, "shell", "getprop", "sys.boot_completed")).Output
    if ($devices -match "$([regex]::Escape($Serial))\s+device" -and $boot.Trim() -eq "1") {
      return
    }
    Start-Sleep -Seconds 3
  }

  throw "Timed out waiting for $Serial to boot."
}

function Get-AvdRamdiskPath {
  $iniPath = Join-Path $env:USERPROFILE ".android\avd\$AvdName.ini"
  $avdPath = (Get-Content -LiteralPath $iniPath | Where-Object { $_ -like "path=*" } | Select-Object -First 1) -replace "^path=", ""
  $configPath = Join-Path $avdPath "config.ini"
  $sysDir = (Get-Content -LiteralPath $configPath | Where-Object { $_ -like "image.sysdir.1=*" } | Select-Object -First 1) -replace "^image\.sysdir\.1=", ""
  Join-Path $SdkRoot ($sysDir + "ramdisk.img")
}

$ramdisk = Resolve-Path (Get-AvdRamdiskPath)
$backup = Resolve-Path "$($ramdisk.Path).backup"
$sdkResolved = Resolve-Path $SdkRoot
if (-not ($ramdisk.Path.StartsWith($sdkResolved.Path) -and $backup.Path.StartsWith($sdkResolved.Path))) {
  throw "Resolved ramdisk paths escaped the Android SDK directory."
}

Write-Output "Stopping emulator if running..."
Invoke-Native $Adb @("-s", $Serial, "emu", "kill") | Out-Null
Wait-ForNoDevice

Write-Output "Restoring stock ramdisk from backup..."
Copy-Item -LiteralPath $backup.Path -Destination $ramdisk.Path -Force

Write-Output "Cold booting $AvdName..."
Start-Process -FilePath $Emulator -ArgumentList @("@$AvdName", "-no-snapshot-load", "-no-snapshot-save") -WindowStyle Hidden
Start-Sleep -Seconds 8
Wait-ForBoot

$relativeRamdisk = $ramdisk.Path.Substring($sdkResolved.Path.Length).TrimStart("\", "/")
Write-Output "Running upstream rootAVD oracle against $relativeRamdisk..."
$env:PATH = "$RepoRoot\src-tauri\resources\windows;$SdkRoot\platform-tools;$env:PATH"
$rootResult = Invoke-Native "cmd.exe" @("/c", "rootAVD.bat", $relativeRamdisk) $RootAvdDir
Write-Output $rootResult.Output
if ($rootResult.ExitCode -ne 0) {
  throw "rootAVD exited with code $($rootResult.ExitCode)."
}

Wait-ForNoDevice

Write-Output "Cold booting patched image..."
Start-Process -FilePath $Emulator -ArgumentList @("@$AvdName", "-no-snapshot-load", "-no-snapshot-save") -WindowStyle Hidden
Start-Sleep -Seconds 8
Wait-ForBoot

$magisk = Invoke-Native $Adb @("-s", $Serial, "shell", "pm", "list", "packages")
$su = Invoke-Native $Adb @("-s", $Serial, "shell", "su", "-c", "id -u")

Write-Output "Magisk package lines:"
Write-Output ($magisk.Output -split "`n" | Where-Object { $_ -match "magisk" })
Write-Output "su uid:"
Write-Output $su.Output

if ($su.Output.Trim() -ne "0") {
  throw "Root verification failed: su did not return uid 0."
}

Write-Output "Root verification passed."
