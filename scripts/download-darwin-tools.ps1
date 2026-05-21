$ErrorActionPreference = 'Stop'

Write-Host "Creating darwin resources directory..."
$darwinDir = "src-tauri/resources/darwin"
if (-not (Test-Path $darwinDir)) {
    New-Item -ItemType Directory -Path $darwinDir | Out-Null
}

Write-Host "Downloading platform-tools-latest-darwin.zip..."
$zipUrl = "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
$zipFile = "platform-tools-darwin.zip"
Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile

Write-Host "Extracting ZIP archive..."
$tempDir = "temp-darwin"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}
Expand-Archive -Path $zipFile -DestinationPath $tempDir -Force

Write-Host "Copying binaries to resources/darwin..."
Copy-Item -Path "$tempDir/platform-tools/*" -Destination $darwinDir -Force

Write-Host "Cleaning up temporary files..."
Remove-Item -Path $zipFile -Force
Remove-Item -Recurse -Force $tempDir

Write-Host "Listing created darwin resources:"
Get-ChildItem -Path $darwinDir | Select-Object Name, Length
Write-Host "Platform tools for macOS successfully installed."
