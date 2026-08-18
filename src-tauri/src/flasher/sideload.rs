use crate::CmdResult;
use crate::helpers::{adb_argv, binary_working_directory, resolve_binary_path};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use std::thread;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub const SIDELOAD_PROGRESS_EVENT: &str = "flasher:sideload-progress";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SideloadProgress {
    pub percentage: u32,
    pub stage: String, // "connecting" | "sideloading" | "verifying" | "success" | "failed"
    pub message: String,
    pub raw_line: Option<String>,
}

pub fn extract_percentage(text: &str) -> Option<u32> {
    let bytes = text.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if b == b'%' && i > 0 {
            let mut start = i;
            while start > 0 && bytes[start - 1].is_ascii_digit() {
                start -= 1;
            }
            if start < i
                && let Ok(val) = text[start..i].parse::<u32>()
                && val <= 100
            {
                return Some(val);
            }
        }
    }
    None
}

fn emit_sideload_progress(app: &AppHandle, progress: &SideloadProgress) {
    if let Err(e) = app.emit(SIDELOAD_PROGRESS_EVENT, progress) {
        error!("Failed to emit sideload progress: {e}");
    }
}

pub async fn sideload_package_stream(
    app: AppHandle,
    serial: Option<String>,
    zip_path: String,
) -> CmdResult<()> {
    let zip_clean = zip_path.trim();
    if zip_clean.is_empty() {
        return Err("No update package path provided for sideload.".into());
    }

    let p = Path::new(zip_clean);
    if !p.exists() {
        return Err(format!("Sideload package not found: '{}'", zip_clean));
    }

    let file_name =
        p.file_name().map_or_else(|| "update.zip".to_string(), |f| f.to_string_lossy().to_string());

    info!("Starting streaming adb sideload for '{}'", zip_clean);

    emit_sideload_progress(
        &app,
        &SideloadProgress {
            percentage: 0,
            stage: "connecting".to_string(),
            message: format!("Initiating recovery sideload transport for '{}'", file_name),
            raw_line: None,
        },
    );

    let zip_owned = zip_clean.to_string();

    tokio::task::spawn_blocking(move || {
        let binary_path = resolve_binary_path(&app, "adb")?;
        let mut cmd = Command::new(&binary_path);
        let owned_args = adb_argv(serial.as_deref(), &["sideload", &zip_owned]);
        cmd.args(&owned_args);
        cmd.current_dir(
            binary_working_directory(Some(&app))
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
        );

        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child =
            cmd.spawn().map_err(|e| format!("Failed to spawn adb sideload process: {e}"))?;

        let last_percent = Arc::new(AtomicU32::new(0));

        let app_stdout = app.clone();
        let last_stdout = Arc::clone(&last_percent);
        let file_name_stdout = file_name.clone();
        let stdout_handle = child.stdout.take().map(|mut stdout| {
            thread::spawn(move || {
                let mut buffer = [0u8; 512];
                let mut line_buf = String::new();
                while let Ok(n) = stdout.read(&mut buffer) {
                    if n == 0 {
                        break;
                    }
                    let chunk = String::from_utf8_lossy(&buffer[..n]);
                    for c in chunk.chars() {
                        if c == '\r' || c == '\n' {
                            if !line_buf.is_empty() {
                                if let Some(pct) = extract_percentage(&line_buf) {
                                    let prev = last_stdout.swap(pct, Ordering::Relaxed);
                                    if prev != pct {
                                        emit_sideload_progress(
                                            &app_stdout,
                                            &SideloadProgress {
                                                percentage: pct,
                                                stage: if pct >= 100 {
                                                    "verifying".to_string()
                                                } else {
                                                    "sideloading".to_string()
                                                },
                                                message: format!(
                                                    "Sideloading '{}' ({}%)",
                                                    file_name_stdout, pct
                                                ),
                                                raw_line: Some(line_buf.clone()),
                                            },
                                        );
                                    }
                                }
                                line_buf.clear();
                            }
                        } else {
                            line_buf.push(c);
                        }
                    }
                }
            })
        });

        let app_stderr = app.clone();
        let last_stderr = Arc::clone(&last_percent);
        let file_name_stderr = file_name.clone();
        let stderr_handle = child.stderr.take().map(|mut stderr| {
            thread::spawn(move || {
                let mut buffer = [0u8; 512];
                let mut line_buf = String::new();
                let mut accumulated_err = String::new();
                while let Ok(n) = stderr.read(&mut buffer) {
                    if n == 0 {
                        break;
                    }
                    let chunk = String::from_utf8_lossy(&buffer[..n]);
                    accumulated_err.push_str(&chunk);
                    for c in chunk.chars() {
                        if c == '\r' || c == '\n' {
                            if !line_buf.is_empty() {
                                if let Some(pct) = extract_percentage(&line_buf) {
                                    let prev = last_stderr.swap(pct, Ordering::Relaxed);
                                    if prev != pct {
                                        emit_sideload_progress(
                                            &app_stderr,
                                            &SideloadProgress {
                                                percentage: pct,
                                                stage: if pct >= 100 {
                                                    "verifying".to_string()
                                                } else {
                                                    "sideloading".to_string()
                                                },
                                                message: format!(
                                                    "Sideloading '{}' ({}%)",
                                                    file_name_stderr, pct
                                                ),
                                                raw_line: Some(line_buf.clone()),
                                            },
                                        );
                                    }
                                }
                                line_buf.clear();
                            }
                        } else {
                            line_buf.push(c);
                        }
                    }
                }
                accumulated_err
            })
        });

        if let Some(h) = stdout_handle {
            let _ = h.join();
        }

        let stderr_output =
            if let Some(h) = stderr_handle { h.join().unwrap_or_default() } else { String::new() };

        let status = child.wait().map_err(|e| format!("Failed waiting for adb sideload: {e}"))?;

        if status.success() {
            info!("Sideload of '{}' completed successfully", file_name);
            emit_sideload_progress(
                &app,
                &SideloadProgress {
                    percentage: 100,
                    stage: "success".to_string(),
                    message: format!("Package '{}' sideloaded successfully", file_name),
                    raw_line: None,
                },
            );
            Ok(())
        } else {
            let err_msg = if !stderr_output.trim().is_empty() {
                stderr_output.trim().to_string()
            } else {
                format!("adb sideload exited with status {:?}", status.code())
            };
            warn!("Sideload failed: {}", err_msg);
            emit_sideload_progress(
                &app,
                &SideloadProgress {
                    percentage: last_percent.load(Ordering::Relaxed),
                    stage: "failed".to_string(),
                    message: format!("Sideload failed: {}", err_msg),
                    raw_line: Some(err_msg.clone()),
                },
            );
            Err(format!("Sideload failed: {}", err_msg))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_percentage() {
        assert_eq!(extract_percentage("serving: 'update.zip'  (~12%)"), Some(12));
        assert_eq!(extract_percentage("serving: 'update.zip'  (~100%)"), Some(100));
        assert_eq!(extract_percentage("[ 45%] sideloading..."), Some(45));
        assert_eq!(extract_percentage("Total xfer: 1.00x"), None);
        assert_eq!(extract_percentage("loading 0%"), Some(0));
        assert_eq!(extract_percentage("something 99% done"), Some(99));
        assert_eq!(extract_percentage("no percentage here"), None);
    }
}
