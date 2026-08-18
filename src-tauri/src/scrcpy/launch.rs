//! Spawn official scrcpy as a detached native process (never in the webview).

use super::assets::{host_arch, host_os, official_archive_name};
use super::flags::{ScrcpyLaunchOptions, build_args};
use super::install::{current_dir, find_binary, path_scrcpy, scrcpy_root};
use crate::CmdResult;
use crate::helpers::resolve_binary_path;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::AppHandle;

#[cfg(windows)]
const DETACHED: u32 = 0x0000_0008 | 0x0000_0200;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
pub fn launch(
    app: &AppHandle,
    serial: Option<&str>,
    options: &ScrcpyLaunchOptions,
) -> CmdResult<()> {
    let args = build_args(options, serial)?;
    let root = scrcpy_root(app)?;
    let managed = find_binary(&current_dir(&root));
    let binary = match managed {
        Some(path) => path,
        None => {
            if official_archive_name("v0", host_os(), host_arch()).is_err() {
                path_scrcpy().ok_or_else(|| {
                    "No official scrcpy binary for this OS/arch and none found on PATH".to_string()
                })?
            } else {
                return Err(
                    "scrcpy is not installed. Download it from the Scrcpy view first.".into()
                );
            }
        }
    };
    let workdir = binary.parent().map_or_else(|| PathBuf::from("."), PathBuf::from);
    let mut command = Command::new(&binary);
    command
        .args(&args)
        .current_dir(&workdir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Ok(adb) = resolve_binary_path(app, "adb") {
        command.env("ADB", adb);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(DETACHED);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    command.spawn().map_err(|e| format!("failed to launch scrcpy: {e}"))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpySessionInfo {
    pub pid: u32,
    pub serial: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrcpyActiveSessions {
    pub serials: Vec<String>,
    pub sessions: Vec<ScrcpySessionInfo>,
}

pub fn extract_serial_from_cmdline(cmdline: &str) -> Option<String> {
    let tokens = crate::helpers::split_args(cmdline);
    for (i, &token) in tokens.iter().enumerate() {
        if token == "-s" || token == "--serial" {
            if let Some(&next) = tokens.get(i + 1) {
                return Some(next.trim_matches(['"', '\'']).to_string());
            }
        } else if let Some(val) =
            token.strip_prefix("-s=").or_else(|| token.strip_prefix("--serial="))
        {
            return Some(val.trim_matches(['"', '\'']).to_string());
        }
    }
    None
}

pub fn active_sessions() -> CmdResult<ScrcpyActiveSessions> {
    let mut sessions = Vec::new();

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let script = r#"Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'scrcpy.exe' } | ForEach-Object { "$($_.ProcessId)::$($_.CommandLine)" }"#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .stdin(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if let Some((pid_str, cmdline)) = trimmed.split_once("::")
                    && let Ok(pid) = pid_str.trim().parse::<u32>()
                {
                    let serial = extract_serial_from_cmdline(cmdline.trim());
                    sessions.push(ScrcpySessionInfo { pid, serial });
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(entries) = std::fs::read_dir("/proc") {
            for entry in entries.flatten() {
                let file_name = entry.file_name();
                let name = file_name.to_string_lossy();
                if let Ok(pid) = name.parse::<u32>() {
                    let proc_path = entry.path();
                    let comm = std::fs::read_to_string(proc_path.join("comm")).unwrap_or_default();
                    if comm.trim() == "scrcpy" {
                        let cmdline_raw =
                            std::fs::read(proc_path.join("cmdline")).unwrap_or_default();
                        let cmdline = cmdline_raw
                            .split(|&b| b == 0)
                            .map(|b| String::from_utf8_lossy(b))
                            .collect::<Vec<_>>()
                            .join(" ");
                        let serial = extract_serial_from_cmdline(&cmdline);
                        sessions.push(ScrcpySessionInfo { pid, serial });
                    }
                }
            }
        }
    }

    #[cfg(all(unix, not(target_os = "linux")))]
    {
        if let Ok(out) = Command::new("ps").args(["-A", "-o", "pid=,command="]).output() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || !trimmed.contains("scrcpy") {
                    continue;
                }
                let mut parts = trimmed.split_whitespace();
                if let Some(pid_str) = parts.next() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        let cmdline = parts.collect::<Vec<_>>().join(" ");
                        let serial = extract_serial_from_cmdline(&cmdline);
                        sessions.push(ScrcpySessionInfo { pid, serial });
                    }
                }
            }
        }
    }

    let mut serials = Vec::new();
    for session in &sessions {
        if let Some(s) = &session.serial {
            if !serials.contains(s) {
                serials.push(s.clone());
            }
        } else if !serials.contains(&"*".to_string()) {
            serials.push("*".to_string());
        }
    }

    Ok(ScrcpyActiveSessions { serials, sessions })
}

pub fn stop(serial: Option<&str>) -> CmdResult<()> {
    if let Some(target_serial) = serial {
        let active = active_sessions()
            .unwrap_or_else(|_| ScrcpyActiveSessions { serials: Vec::new(), sessions: Vec::new() });
        let target_pids: Vec<u32> = active
            .sessions
            .iter()
            .filter(|s| s.serial.as_deref() == Some(target_serial))
            .map(|s| s.pid)
            .collect();

        if !target_pids.is_empty() {
            for pid in target_pids {
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    let mut cmd = Command::new("taskkill");
                    cmd.args(["/F", "/PID", &pid.to_string()])
                        .stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .creation_flags(CREATE_NO_WINDOW);
                    let _ = cmd.status();
                }
                #[cfg(unix)]
                {
                    let mut cmd = Command::new("kill");
                    cmd.args(["-9", &pid.to_string()])
                        .stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null());
                    let _ = cmd.status();
                }
            }
            return Ok(());
        }

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            let s_escaped = target_serial.replace('\'', "''");
            let script = format!(
                "Get-CimInstance Win32_Process -Filter \"Name = 'scrcpy.exe'\" -ErrorAction SilentlyContinue | \
                 Where-Object {{ $_.CommandLine -and $_.CommandLine -match '-s\\s+{s_escaped}' }} | \
                 ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"
            );
            let _ = Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }
        #[cfg(unix)]
        {
            let pattern = format!("scrcpy.*-s {target_serial}");
            let _ = Command::new("pkill")
                .args(["-9", "-f", &pattern])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
    } else {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            let mut command = Command::new("taskkill");
            command
                .args(["/F", "/IM", "scrcpy.exe"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .creation_flags(CREATE_NO_WINDOW);
            let _ = command.status();
        }
        #[cfg(unix)]
        {
            let mut command = Command::new("pkill");
            command
                .args(["-9", "-x", "scrcpy"])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            let _ = command.status();
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_serial_standard_flags() {
        assert_eq!(
            extract_serial_from_cmdline(r#"scrcpy.exe -s 1A2B3C4D --max-size 1920"#),
            Some("1A2B3C4D".into())
        );
        assert_eq!(
            extract_serial_from_cmdline(r#"scrcpy --serial emulator-5554"#),
            Some("emulator-5554".into())
        );
    }

    #[test]
    fn extract_serial_equals_and_quotes() {
        assert_eq!(
            extract_serial_from_cmdline(r#"scrcpy -s="192.168.1.100:5555" --stay-awake"#),
            Some("192.168.1.100:5555".into())
        );
        assert_eq!(
            extract_serial_from_cmdline(r#"scrcpy --serial='DEVICE_999'"#),
            Some("DEVICE_999".into())
        );
    }

    #[test]
    fn extract_serial_returns_none_when_unspecified() {
        assert_eq!(extract_serial_from_cmdline("scrcpy --max-size 1080"), None);
        assert_eq!(extract_serial_from_cmdline(""), None);
    }
}
