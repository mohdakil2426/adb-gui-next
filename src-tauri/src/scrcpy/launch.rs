//! Spawn official scrcpy as a detached native process (never in the webview).

use std::path::PathBuf;
use std::process::{Command, Stdio};

use super::assets::{host_arch, host_os, official_archive_name};
use super::flags::{ScrcpyLaunchOptions, build_args};
use super::install::{current_dir, find_binary, path_scrcpy, scrcpy_root};
use crate::CmdResult;
use crate::helpers::resolve_binary_path;
use tauri::AppHandle;

#[cfg(windows)]
const DETACHED: u32 = 0x0000_0008 | 0x0000_0200;

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
