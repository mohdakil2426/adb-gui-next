//! Reveal a device path in the host file manager via MTP (Windows File transfer).

use crate::CmdResult;
#[cfg(windows)]
use crate::adb::AdbClient;
#[cfg(windows)]
use base64::Engine;
#[cfg(windows)]
use serde::Serialize;
use tauri::AppHandle;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const INTERNAL_STORAGE_ALIASES: &[&str] = &["Internal shared storage", "Internal storage", "Phone"];

const SD_CARD_ALIASES: &[&str] = &["SD card", "SD Card", "Card", "SD-Karte", "Carte SD"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MtpRevealPlan {
    pub storage_aliases: Vec<String>,
    pub components: Vec<String>,
    pub is_directory: bool,
}

#[cfg(windows)]
#[derive(Serialize)]
struct MtpRevealPayload {
    hints: Vec<String>,
    storage_aliases: Vec<String>,
    components: Vec<String>,
    is_directory: bool,
}

/// Map an ADB remote path onto This PC → phone → storage → relative segments.
pub fn plan_mtp_reveal(remote_path: &str) -> CmdResult<MtpRevealPlan> {
    let is_directory = remote_path.trim().ends_with('/');
    let path = normalize_remote(remote_path);
    if path == "/" {
        return Err(
            "Root is not shown in File transfer. Open Internal storage or a folder under /sdcard/"
                .into(),
        );
    }

    if let Some(rest) = strip_storage_prefix(&path, "/sdcard")
        .or_else(|| strip_storage_prefix(&path, "/mnt/sdcard"))
        .or_else(|| strip_storage_prefix(&path, "/storage/emulated/0"))
        .or_else(|| strip_storage_prefix(&path, "/storage/emulated/legacy"))
        .or_else(|| strip_storage_prefix(&path, "/storage/self/primary"))
    {
        return Ok(MtpRevealPlan {
            storage_aliases: INTERNAL_STORAGE_ALIASES
                .iter()
                .map(|alias| (*alias).to_string())
                .collect(),
            components: split_components(rest),
            is_directory,
        });
    }

    if let Some((volume, rest)) = removable_storage(&path) {
        let mut aliases: Vec<String> =
            SD_CARD_ALIASES.iter().map(|alias| (*alias).to_string()).collect();
        aliases.insert(0, volume);
        return Ok(MtpRevealPlan {
            storage_aliases: aliases,
            components: split_components(rest),
            is_directory,
        });
    }

    Err(
        "This path is not visible in Windows File Explorer. Use File transfer (MTP) for Internal storage or an SD card."
            .into(),
    )
}

pub fn reveal_device_path(
    app: &AppHandle,
    serial: Option<&str>,
    remote_path: &str,
) -> CmdResult<String> {
    let plan = plan_mtp_reveal(remote_path)?;
    #[cfg(not(windows))]
    {
        let _ = (app, serial, plan);
        Err(
            "Show in Explorer is available on Windows when the device is in File transfer (MTP) mode."
                .into(),
        )
    }
    #[cfg(windows)]
    {
        let hints = device_explorer_hints(app, serial)?;
        reveal_mtp_windows(&hints, &plan)?;
        Ok("Opened in File Explorer".into())
    }
}

#[cfg(windows)]
fn device_explorer_hints(app: &AppHandle, serial: Option<&str>) -> CmdResult<Vec<String>> {
    let outputs = AdbClient::new(app, serial).shell_batch(&[
        "getprop ro.product.marketname",
        "getprop ro.product.model",
        "getprop persist.sys.device_name",
        "getprop net.bt.name",
        "getprop ro.product.device",
    ])?;
    let mut hints = Vec::new();
    for output in outputs {
        if let Some(value) = output.ok_stdout() {
            let trimmed = value.trim();
            if !trimmed.is_empty()
                && !hints.iter().any(|existing: &String| existing.eq_ignore_ascii_case(trimmed))
            {
                hints.push(trimmed.to_string());
            }
        }
    }
    Ok(hints)
}

#[cfg(windows)]
fn reveal_mtp_windows(hints: &[String], plan: &MtpRevealPlan) -> CmdResult<()> {
    let payload = MtpRevealPayload {
        hints: hints.to_vec(),
        storage_aliases: plan.storage_aliases.clone(),
        components: plan.components.clone(),
        is_directory: plan.is_directory,
    };
    let json = serde_json::to_string(&payload).map_err(|error| error.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(json.as_bytes());
    let script = format!("{REVEAL_MTP_PS}\nReveal-Mtp -PayloadB64 '{encoded}'");
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| error.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}{stderr}");
    if output.status.success() && combined.contains("MTP_OK") {
        return Ok(());
    }
    if combined.contains("MTP_NOT_FOUND") {
        return Err(
            "Turn on File transfer (MTP) on the device, then try Show in Explorer again.".into()
        );
    }
    if combined.contains("MTP_PATH") {
        return Err(
            "Could not find that folder on the phone in File Explorer. Confirm File transfer is on and the path exists."
                .into(),
        );
    }
    let detail = combined.trim();
    if detail.is_empty() {
        Err("Could not open File Explorer at the device path.".into())
    } else {
        Err(detail.to_string())
    }
}

fn normalize_remote(path: &str) -> String {
    let trimmed = path.trim().replace('\\', "/");
    let mut normalized = if trimmed.starts_with('/') { trimmed } else { format!("/{trimmed}") };
    while normalized.contains("//") {
        normalized = normalized.replace("//", "/");
    }
    if normalized.len() > 1 {
        normalized = normalized.trim_end_matches('/').to_string();
    }
    normalized
}

fn strip_storage_prefix<'a>(path: &'a str, prefix: &str) -> Option<&'a str> {
    let rest = path.strip_prefix(prefix)?;
    if rest.is_empty() { Some("") } else { rest.strip_prefix('/') }
}

fn removable_storage(path: &str) -> Option<(String, &str)> {
    let rest = path.strip_prefix("/storage/")?;
    if rest.starts_with("emulated/") || rest.starts_with("self/") {
        return None;
    }
    let (volume, remainder) =
        rest.split_once('/').map_or((rest, ""), |(volume, rest)| (volume, rest));
    if volume.is_empty() {
        return None;
    }
    Some((volume.to_string(), remainder))
}

fn split_components(rest: &str) -> Vec<String> {
    rest.split('/')
        .filter(|part| !part.is_empty() && *part != ".")
        .map(ToString::to_string)
        .collect()
}

#[cfg(windows)]
const REVEAL_MTP_PS: &str = r#"
function Find-Child($folder, $name) {
  if (-not $folder) { return $null }
  foreach ($item in @($folder.Items())) {
    if ($item.Name -eq $name) { return $item }
  }
  return $null
}

function Reveal-Mtp {
  param([string]$PayloadB64)
  $ErrorActionPreference = 'Stop'
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadB64))
  $payload = $json | ConvertFrom-Json
  $shell = New-Object -ComObject Shell.Application
  $computer = $shell.NameSpace(17)
  if (-not $computer) { throw 'MTP_NOT_FOUND' }

  $deviceItem = $null
  foreach ($item in @($computer.Items())) {
    $path = [string]$item.Path
    if ($path -match '^[A-Za-z]:') { continue }
    foreach ($hint in @($payload.hints)) {
      if ($hint -and $item.Name -and ($item.Name.ToLower().Contains([string]$hint.ToLower()))) {
        $deviceItem = $item
        break
      }
    }
    if ($deviceItem) { break }
  }

  if (-not $deviceItem) {
    $portable = @()
    foreach ($item in @($computer.Items())) {
      $path = [string]$item.Path
      if ($path -match '^[A-Za-z]:') { continue }
      try {
        $folder = $item.GetFolder
        if ($folder) { $portable += $item }
      } catch {}
    }
    if ($portable.Count -eq 1) { $deviceItem = $portable[0] }
  }

  if (-not $deviceItem) { throw 'MTP_NOT_FOUND' }

  $current = $deviceItem.GetFolder
  $storageItem = $null
  foreach ($alias in @($payload.storage_aliases)) {
    $storageItem = Find-Child $current $alias
    if ($storageItem) { break }
  }
  if (-not $storageItem) {
    $kids = @($current.Items())
    if ($kids.Count -eq 1) { $storageItem = $kids[0] }
  }
  if (-not $storageItem) { throw 'MTP_PATH' }
  $current = $storageItem.GetFolder

  $parts = @($payload.components)
  if ($parts.Count -eq 0) {
    $shell.Explore($current) | Out-Null
    Write-Output 'MTP_OK'
    return
  }

  $lastIndex = $parts.Count - 1
  $walkUntil = $lastIndex
  if (-not [bool]$payload.is_directory) { $walkUntil = $lastIndex - 1 }
  for ($i = 0; $i -le $walkUntil; $i++) {
    if ($i -lt 0) { break }
    $child = Find-Child $current ([string]$parts[$i])
    if (-not $child) { throw 'MTP_PATH' }
    if ($i -eq $walkUntil -and [bool]$payload.is_directory) {
      $shell.Explore($child.GetFolder) | Out-Null
      Write-Output 'MTP_OK'
      return
    }
    $current = $child.GetFolder
  }

  $shell.Explore($current) | Out-Null
  Write-Output 'MTP_OK'
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_sdcard_file_and_folder() {
        let file = plan_mtp_reveal("/sdcard/Download/note.txt").unwrap();
        assert_eq!(file.components, vec!["Download".to_string(), "note.txt".to_string()]);
        assert!(!file.is_directory);
        assert!(file.storage_aliases.iter().any(|alias| alias == "Internal shared storage"));

        let folder = plan_mtp_reveal("/storage/emulated/0/Pictures/").unwrap();
        assert_eq!(folder.components, vec!["Pictures".to_string()]);
        assert!(folder.is_directory);
    }

    #[test]
    fn maps_removable_volume() {
        let plan = plan_mtp_reveal("/storage/9C33-6BBD/DCIM/Camera").unwrap();
        assert_eq!(plan.storage_aliases[0], "9C33-6BBD");
        assert_eq!(plan.components, vec!["DCIM".to_string(), "Camera".to_string()]);
    }

    #[test]
    fn rejects_root_and_data() {
        assert!(plan_mtp_reveal("/").is_err());
        assert!(plan_mtp_reveal("/data/local/tmp/a.txt").is_err());
    }
}
