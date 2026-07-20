# Builds a Windows portable zip (not an official Tauri bundle type).
# Run after `tauri build` / tauri-action on a Windows job.
param(
  [Parameter(Mandatory = $true)] [string] $Version,
  # Matches tauri-action [arch] token (rust triple prefix).
  [Parameter(Mandatory = $true)] [ValidateSet('x86_64', 'i686', 'aarch64')] [string] $Arch,
  [Parameter(Mandatory = $true)] [string] $TargetTriple,
  [Parameter(Mandatory = $true)] [string] $OutputZip
)

$ErrorActionPreference = 'Stop'

$DisplayName = 'ADB GUI Next'
$BinaryStem = 'adb-gui-next'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$releaseDir = Join-Path $root "src-tauri/target/$TargetTriple/release"
$exe = Join-Path $releaseDir "$BinaryStem.exe"

if (!(Test-Path $exe)) {
  throw "Portable executable not found: $exe"
}

function Get-PeMachineName([string] $Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 0x40 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) {
    throw "Not a valid PE: $Path"
  }
  $peOff = [BitConverter]::ToInt32($bytes, 0x3C)
  $peSig = [System.Text.Encoding]::ASCII.GetString($bytes, $peOff, 4)
  if ($peSig -ne "PE`0`0") {
    throw "Invalid PE signature in $Path (corrupt/OneDrive placeholder?)."
  }
  $machine = [BitConverter]::ToUInt16($bytes, $peOff + 4)
  switch ($machine) {
    0x014c { return 'x86' }
    0x8664 { return 'x64' }
    0xAA64 { return 'arm64' }
    default { return ("0x{0:X4}" -f $machine) }
  }
}

$expectedApp = switch ($Arch) {
  'x86_64' { 'x64' }
  'i686' { 'x86' }
  'aarch64' { 'arm64' }
}
$appArch = Get-PeMachineName $exe
if ($appArch -ne $expectedApp) {
  throw "App PE arch is $appArch but package arch is $Arch"
}

$adb = Join-Path $root 'src-tauri/resources/windows/adb.exe'
if (!(Test-Path $adb)) {
  throw "Bundled adb.exe missing: $adb"
}
$adbArch = Get-PeMachineName $adb

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("adb-gui-next-portable-" + [guid]::NewGuid().ToString('N'))
$resourcesDest = Join-Path $stage 'resources'
New-Item -ItemType Directory -Force -Path $resourcesDest | Out-Null

Copy-Item -LiteralPath $exe -Destination (Join-Path $stage "$DisplayName.exe") -Force
Copy-Item -LiteralPath (Join-Path $root 'src-tauri/resources/windows') -Destination $resourcesDest -Recurse -Force

@"
$DisplayName $Version portable build

HOW TO RUN
1. Extract to a LOCAL folder (not OneDrive cloud-only Files On-Demand).
2. Run "$DisplayName.exe" (keep the resources/ folder next to it).

REQUIREMENTS
- This package matches your download label (64-bit, 32-bit, or ARM).
- WebView2 Runtime (installers embed bootstrapper; portable expects it installed).
- Bundled adb is usually 32-bit Google platform-tools (normal on 64-bit Windows).

Not code-signed. Prefer the Installer download for normal users.
"@ | Set-Content -Path (Join-Path $stage 'README-portable.txt') -Encoding UTF8

$outDir = Split-Path -Parent $OutputZip
if ($outDir -and !(Test-Path $outDir)) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}
if (Test-Path $OutputZip) {
  Remove-Item -LiteralPath $OutputZip -Force
}
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $OutputZip -Force
Remove-Item -LiteralPath $stage -Recurse -Force

Write-Host "Wrote portable zip: $OutputZip"
