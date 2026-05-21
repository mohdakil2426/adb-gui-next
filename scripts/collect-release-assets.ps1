param(
  [Parameter(Mandatory = $true)] [string] $Version,
  [Parameter(Mandatory = $true)] [ValidateSet('windows','linux','macos')] [string] $Platform,
  [Parameter(Mandatory = $true)] [string] $OutputDir,
  [string] $Commit = $env:GITHUB_SHA,
  [string] $Branch = $env:GITHUB_REF_NAME,
  [string] $RunId = $env:GITHUB_RUN_ID,
  [switch] $Release
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$out = Join-Path $root $OutputDir
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Copy-SingleArtifact {
  param(
    [Parameter(Mandatory = $true)] [string] $Pattern,
    [Parameter(Mandatory = $true)] [string] $DestinationName
  )

  $matches = Get-ChildItem -Path $Pattern -File -ErrorAction SilentlyContinue
  if ($matches.Count -ne 1) {
    throw "Expected exactly one artifact for pattern '$Pattern', found $($matches.Count)."
  }

  Copy-Item -LiteralPath $matches[0].FullName -Destination (Join-Path $out $DestinationName) -Force
}

if ($Platform -eq 'windows') {
  Copy-SingleArtifact `
    -Pattern (Join-Path $root 'src-tauri/target/release/bundle/nsis/*.exe') `
    -DestinationName "AdbGuiNext-v${Version}-windows-x64-setup.exe"

  Copy-SingleArtifact `
    -Pattern (Join-Path $root 'src-tauri/target/release/bundle/msi/*.msi') `
    -DestinationName "AdbGuiNext-v${Version}-windows-x64.msi"

  $portableRoot = Join-Path $out 'portable'
  $portableResources = Join-Path $portableRoot 'resources'
  New-Item -ItemType Directory -Force -Path $portableResources | Out-Null

  $exe = Join-Path $root 'src-tauri/target/release/adb-gui-next.exe'
  if (!(Test-Path $exe)) {
    throw "Portable executable not found: $exe"
  }

  Copy-Item -LiteralPath $exe -Destination (Join-Path $portableRoot 'Adb Gui Next.exe') -Force
  Copy-Item -LiteralPath (Join-Path $root 'src-tauri/resources/windows') -Destination $portableResources -Recurse -Force

  @"
Adb Gui Next $Version portable build

Run "Adb Gui Next.exe" from this folder.
The bundled Android platform tools live under resources/windows.
If the app cannot open on Windows, install or repair the Microsoft Edge WebView2 Runtime.
The installer build is recommended for normal users.
"@ | Set-Content -Path (Join-Path $portableRoot 'README-portable.txt') -Encoding UTF8

  Compress-Archive -Path (Join-Path $portableRoot '*') -DestinationPath (Join-Path $out "AdbGuiNext-v${Version}-windows-x64-portable.zip") -Force
  Remove-Item -LiteralPath $portableRoot -Recurse -Force
} elseif ($Platform -eq 'macos') {
  Copy-SingleArtifact `
    -Pattern (Join-Path $root 'src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg') `
    -DestinationName "AdbGuiNext-v${Version}-macos-universal.dmg"
} else {
  Copy-SingleArtifact `
    -Pattern (Join-Path $root 'src-tauri/target/release/bundle/deb/*.deb') `
    -DestinationName "AdbGuiNext-v${Version}-linux-x64.deb"

  Copy-SingleArtifact `
    -Pattern (Join-Path $root 'src-tauri/target/release/bundle/rpm/*.rpm') `
    -DestinationName "AdbGuiNext-v${Version}-linux-x64.rpm"
}

$arch = if ($Platform -eq 'macos') { 'universal' } else { 'x64' }

$buildInfo = [ordered]@{
  name = 'adb-gui-next'
  version = $Version
  platform = $Platform
  arch = $arch
  commit = $Commit
  branch = $Branch
  runId = $RunId
  release = [bool]$Release
}

$buildInfo | ConvertTo-Json | Set-Content -Path (Join-Path $out "build-info-${Platform}.json") -Encoding UTF8

Get-ChildItem -Path $out -File | Select-Object -ExpandProperty Name
