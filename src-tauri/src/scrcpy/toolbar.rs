#![allow(unsafe_code)]

//! Scrcpy Companion Floating Toolbar backend.
//!
//! Provides secondary floating frameless webview window management, Win32 / Linux
//! window tracking and docking, and asynchronous ADB device input dispatchers.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

use log::{debug, info};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, Position, WebviewUrl, WebviewWindowBuilder};

use crate::CmdResult;
use crate::adb::AdbClient;
use crate::helpers::{extract_png_payload, run_adb_bytes};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ToolbarMode {
    #[default]
    Locked,
    Freeform,
}

impl ToolbarMode {
    #[must_use]
    pub fn from_str_lenient(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "freeform" => Self::Freeform,
            _ => Self::Locked,
        }
    }

    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Locked => "locked",
            Self::Freeform => "freeform",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ToolbarSide {
    Left,
    #[default]
    Right,
}

impl ToolbarSide {
    #[must_use]
    pub fn from_str_lenient(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "left" => Self::Left,
            _ => Self::Right,
        }
    }

    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Left => "left",
            Self::Right => "right",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolbarSession {
    pub pid: Option<u32>,
    pub serial: String,
    pub mode: ToolbarMode,
    pub side: ToolbarSide,
    pub y_offset: i32,
    pub window_label: String,
}

pub static TOOLBAR_SESSIONS: LazyLock<Mutex<HashMap<String, ToolbarSession>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[must_use]
pub fn sanitize_label_serial(serial: &str) -> String {
    serial.replace(|c: char| !c.is_alphanumeric() && c != '-', "_")
}

pub fn get_toolbar_session(serial: &str) -> Option<ToolbarSession> {
    TOOLBAR_SESSIONS.lock().ok()?.get(serial).cloned()
}

pub fn set_toolbar_mode(serial: &str, mode: ToolbarMode) -> CmdResult<()> {
    let mut sessions = TOOLBAR_SESSIONS
        .lock()
        .map_err(|e| format!("Failed to acquire toolbar sessions lock: {e}"))?;
    if let Some(session) = sessions.get_mut(serial) {
        session.mode = mode;
        Ok(())
    } else {
        Err(format!("No active toolbar session for serial '{serial}'"))
    }
}

pub fn set_toolbar_offset(serial: &str, offset: i32) -> CmdResult<()> {
    let mut sessions = TOOLBAR_SESSIONS
        .lock()
        .map_err(|e| format!("Failed to acquire toolbar sessions lock: {e}"))?;
    if let Some(session) = sessions.get_mut(serial) {
        session.y_offset = offset;
        Ok(())
    } else {
        Err(format!("No active toolbar session for serial '{serial}'"))
    }
}

pub fn set_toolbar_side(serial: &str, side: ToolbarSide) -> CmdResult<()> {
    let mut sessions = TOOLBAR_SESSIONS
        .lock()
        .map_err(|e| format!("Failed to acquire toolbar sessions lock: {e}"))?;
    if let Some(session) = sessions.get_mut(serial) {
        session.side = side;
        Ok(())
    } else {
        Err(format!("No active toolbar session for serial '{serial}'"))
    }
}

/// Create or focus companion floating toolbar window for a given scrcpy session.
pub fn create_toolbar_window(
    app: &AppHandle,
    serial: &str,
    pid: Option<u32>,
    mode: Option<String>,
    side: Option<String>,
) -> CmdResult<()> {
    let trimmed_serial = serial.trim();
    if trimmed_serial.is_empty() {
        return Err("Device serial cannot be empty".to_string());
    }

    let mode_enum = mode.as_deref().map_or(ToolbarMode::Locked, ToolbarMode::from_str_lenient);
    let side_enum = side.as_deref().map_or(ToolbarSide::Right, ToolbarSide::from_str_lenient);

    let clean_label = sanitize_label_serial(trimmed_serial);
    let window_label = format!("scrcpy-toolbar-{clean_label}");

    // Resolve PID from active sessions if not explicitly provided
    let effective_pid = pid.or_else(|| {
        super::launch::active_sessions().ok().and_then(|active| {
            active
                .sessions
                .iter()
                .find(|s| s.serial.as_deref() == Some(trimmed_serial))
                .map(|s| s.pid)
        })
    });

    // If window already exists, focus it and update state
    if let Some(window) = app.get_webview_window(&window_label) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();

        if let Ok(mut sessions) = TOOLBAR_SESSIONS.lock()
            && let Some(session) = sessions.get_mut(trimmed_serial)
        {
            session.mode = mode_enum;
            session.side = side_enum;
            if effective_pid.is_some() {
                session.pid = effective_pid;
            }
        }
        return Ok(());
    }

    let mode_str = mode_enum.as_str();
    let side_str = side_enum.as_str();
    let encoded_serial = urlencoding::encode(trimmed_serial);
    let url_str = format!(
        "index.html?window=scrcpy-toolbar&serial={encoded_serial}&mode={mode_str}&side={side_str}"
    );

    let webview_url = WebviewUrl::App(url_str.into());

    let session = ToolbarSession {
        pid: effective_pid,
        serial: trimmed_serial.to_string(),
        mode: mode_enum,
        side: side_enum,
        y_offset: 0,
        window_label: window_label.clone(),
    };

    if let Ok(mut sessions) = TOOLBAR_SESSIONS.lock() {
        sessions.insert(trimmed_serial.to_string(), session);
    }

    let builder = WebviewWindowBuilder::new(app, &window_label, webview_url)
        .title("Scrcpy Toolbar")
        .inner_size(44.0, 480.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .shadow(false);

    let window = builder.build().map_err(|e| format!("Failed to create toolbar window: {e}"))?;

    let _ = window.set_always_on_top(true);

    if let Some(p) = effective_pid {
        spawn_toolbar_tracker(app.clone(), trimmed_serial.to_string(), p);
    }

    info!(
        "Spawned companion toolbar window '{}' for serial '{}' (pid: {:?})",
        window_label, trimmed_serial, effective_pid
    );

    Ok(())
}

/// Closes the toolbar window associated with the given serial and cleans up session state.
pub fn close_toolbar(app: &AppHandle, serial: &str) -> CmdResult<()> {
    let trimmed = serial.trim();
    let window_label = {
        let mut sessions =
            TOOLBAR_SESSIONS.lock().map_err(|e| format!("Failed to lock sessions: {e}"))?;
        let session = sessions.remove(trimmed);
        session.map(|s| s.window_label)
    };

    let label = window_label.unwrap_or_else(|| {
        let clean_serial = sanitize_label_serial(trimmed);
        format!("scrcpy-toolbar-{clean_serial}")
    });

    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
    }
    Ok(())
}

#[cfg(windows)]
#[allow(clippy::upper_case_acronyms)]
mod win32 {
    use std::ffi::c_void;

    pub type HWND = *mut c_void;
    pub type HANDLE = *mut c_void;
    pub type BOOL = i32;
    pub type DWORD = u32;

    #[repr(C)]
    #[derive(Debug, Clone, Copy, Default)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    pub const FALSE: BOOL = 0;
    pub const TRUE: BOOL = 1;
    pub const PROCESS_QUERY_LIMITED_INFORMATION: DWORD = 0x1000;
    pub const STILL_ACTIVE: DWORD = 259;

    pub type WNDENUMPROC = unsafe extern "system" fn(hwnd: HWND, lparam: isize) -> BOOL;

    unsafe extern "system" {
        pub fn OpenProcess(
            desired_access: DWORD,
            inherit_handle: BOOL,
            process_id: DWORD,
        ) -> HANDLE;
        pub fn GetExitCodeProcess(process: HANDLE, exit_code: *mut DWORD) -> BOOL;
        pub fn CloseHandle(object: HANDLE) -> BOOL;
        pub fn EnumWindows(enum_func: WNDENUMPROC, lparam: isize) -> BOOL;
        pub fn GetWindowThreadProcessId(hwnd: HWND, process_id: *mut DWORD) -> DWORD;
        pub fn IsWindowVisible(hwnd: HWND) -> BOOL;
        pub fn IsIconic(hwnd: HWND) -> BOOL;
        pub fn GetWindowRect(hwnd: HWND, rect: *mut RECT) -> BOOL;
    }
}

#[cfg(windows)]
fn is_process_alive(pid: u32) -> bool {
    unsafe {
        let handle =
            win32::OpenProcess(win32::PROCESS_QUERY_LIMITED_INFORMATION, win32::FALSE, pid);
        if handle.is_null() {
            return false;
        }
        let mut exit_code: win32::DWORD = 0;
        let res = win32::GetExitCodeProcess(handle, &mut exit_code);
        let _ = win32::CloseHandle(handle);
        res != win32::FALSE && exit_code == win32::STILL_ACTIVE
    }
}

#[cfg(unix)]
fn is_process_alive(pid: u32) -> bool {
    unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
}

#[cfg(not(any(windows, unix)))]
fn is_process_alive(_pid: u32) -> bool {
    true
}

#[cfg(windows)]
struct FindWindowData {
    target_pid: u32,
    found_hwnd: win32::HWND,
}

#[cfg(windows)]
unsafe extern "system" fn enum_windows_callback(hwnd: win32::HWND, lparam: isize) -> win32::BOOL {
    let data = unsafe { &mut *(lparam as *mut FindWindowData) };
    let mut process_id: win32::DWORD = 0;
    unsafe {
        win32::GetWindowThreadProcessId(hwnd, &mut process_id);
        if process_id == data.target_pid && win32::IsWindowVisible(hwnd) != win32::FALSE {
            let mut rect = win32::RECT::default();
            if win32::GetWindowRect(hwnd, &mut rect) != win32::FALSE {
                let width = rect.right - rect.left;
                let height = rect.bottom - rect.top;
                if width > 50 && height > 50 {
                    data.found_hwnd = hwnd;
                    return win32::FALSE; // Stop enumeration once found
                }
            }
        }
    }
    win32::TRUE
}

#[cfg(windows)]
fn find_scrcpy_hwnd(pid: u32) -> Option<win32::HWND> {
    let mut data = FindWindowData { target_pid: pid, found_hwnd: std::ptr::null_mut() };
    unsafe {
        win32::EnumWindows(enum_windows_callback, &mut data as *mut _ as isize);
    }
    if !data.found_hwnd.is_null() { Some(data.found_hwnd) } else { None }
}

/// Spawns a background tracking task that monitors scrcpy process liveness and
/// synchronizes position with the scrcpy native window on Windows.
pub fn spawn_toolbar_tracker(app: AppHandle, serial: String, pid: u32) {
    tauri::async_runtime::spawn(async move {
        debug!("Starting companion toolbar tracker for serial '{}' (pid: {})", serial, pid);

        let clean_label = sanitize_label_serial(&serial);
        let window_label = format!("scrcpy-toolbar-{clean_label}");

        #[cfg(windows)]
        let mut last_pos: Option<(i32, i32)> = None;
        #[cfg(windows)]
        let mut last_visible: Option<bool> = None;

        loop {
            tokio::time::sleep(Duration::from_millis(50)).await;

            // 1. Check if process is still alive
            if !is_process_alive(pid) {
                info!(
                    "Scrcpy process {} for serial '{}' has exited. Closing toolbar.",
                    pid, serial
                );
                if let Some(window) = app.get_webview_window(&window_label) {
                    let _ = window.close();
                }
                if let Ok(mut sessions) = TOOLBAR_SESSIONS.lock() {
                    sessions.remove(&serial);
                }
                break;
            }

            // 2. Check if the toolbar window is still open
            let Some(window) = app.get_webview_window(&window_label) else {
                debug!("Toolbar window '{}' closed by user. Stopping tracker.", window_label);
                if let Ok(mut sessions) = TOOLBAR_SESSIONS.lock() {
                    sessions.remove(&serial);
                }
                break;
            };

            // 3. Position tracking (Windows Locked mode)
            #[cfg(windows)]
            {
                let current_session =
                    { TOOLBAR_SESSIONS.lock().ok().and_then(|s| s.get(&serial).cloned()) };

                if let Some(session) = current_session
                    && session.mode == ToolbarMode::Locked
                    && let Some(hwnd) = find_scrcpy_hwnd(pid)
                {
                    let is_minimized = unsafe { win32::IsIconic(hwnd) != win32::FALSE };
                    if is_minimized {
                        if last_visible != Some(false) {
                            let _ = window.hide();
                            last_visible = Some(false);
                        }
                    } else {
                        if last_visible != Some(true) {
                            let _ = window.show();
                            last_visible = Some(true);
                        }

                        let mut rect = win32::RECT::default();
                        if unsafe { win32::GetWindowRect(hwnd, &mut rect) != win32::FALSE } {
                            let x = match session.side {
                                ToolbarSide::Left => rect.left - 48,
                                ToolbarSide::Right => rect.right + 4,
                            };
                            let y = rect.top + session.y_offset;

                            if last_pos != Some((x, y)) {
                                let _ = window
                                    .set_position(Position::Physical(PhysicalPosition::new(x, y)));
                                last_pos = Some((x, y));
                            }
                        }
                    }
                }
            }
        }
    });
}

/// Send an ADB keyevent to the device.
pub fn send_keyevent(app: &AppHandle, serial: Option<&str>, keycode: u32) -> CmdResult<()> {
    let cmd = format!("input keyevent {keycode}");
    AdbClient::new(app, serial).shell(&cmd)?;
    Ok(())
}

/// Send a statusbar command to the device (`expand-notifications`, `expand-settings`, `collapse`).
pub fn send_statusbar(app: &AppHandle, serial: Option<&str>, action: &str) -> CmdResult<()> {
    let valid_action = match action.trim() {
        "expand-notifications" => "expand-notifications",
        "expand-settings" => "expand-settings",
        "collapse" => "collapse",
        other => return Err(format!("Invalid statusbar action: '{other}'")),
    };
    let cmd = format!("cmd statusbar {valid_action}");
    AdbClient::new(app, serial).shell(&cmd)?;
    Ok(())
}

/// Rotate the device screen (0 = Natural, 1 = 90° CW, 2 = 180°, 3 = 270° CW / 90° CCW).
pub fn rotate_device(app: &AppHandle, serial: Option<&str>, direction: &str) -> CmdResult<()> {
    let client = AdbClient::new(app, serial);

    let current_rot_str = client.shell("settings get system user_rotation").unwrap_or_default();
    let current_rot = current_rot_str.trim().parse::<u32>().unwrap_or(0);

    let new_rot = match direction.trim().to_lowercase().as_str() {
        "clockwise" | "rotate-cw" => (current_rot + 1) % 4,
        "counter-clockwise" | "rotate-ccw" => (current_rot + 3) % 4,
        "natural" => 0,
        other => {
            if let Ok(num) = other.parse::<u32>() {
                num % 4
            } else {
                return Err(format!("Invalid rotation direction: '{other}'"));
            }
        }
    };

    client.shell_batch(&[
        "settings put system accelerometer_rotation 0",
        &format!("settings put system user_rotation {new_rot}"),
    ])?;

    Ok(())
}

fn resolve_screenshot_path(file_name: &str) -> std::path::PathBuf {
    #[cfg(windows)]
    {
        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            let pics = std::path::PathBuf::from(user_profile).join("Pictures");
            if pics.is_dir() {
                let screenshots = pics.join("Screenshots");
                if screenshots.is_dir() {
                    return screenshots.join(file_name);
                }
                return pics.join(file_name);
            }
        }
    }

    #[cfg(unix)]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let pics = std::path::PathBuf::from(home).join("Pictures");
            if pics.is_dir() {
                return pics.join(file_name);
            }
        }
    }

    std::env::temp_dir().join(file_name)
}

/// Capture device screen to a host PNG file and return the saved path.
pub fn take_screenshot(app: &AppHandle, serial: Option<&str>) -> CmdResult<String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let clean_serial = serial
        .map_or_else(|| "device".to_string(), |s| s.replace(|c: char| !c.is_alphanumeric(), "_"));
    let file_name = format!("scrcpy_screenshot_{clean_serial}_{timestamp}.png");
    let dest_path = resolve_screenshot_path(&file_name);

    let bytes = run_adb_bytes(app, serial, &["exec-out", "screencap", "-p"])?;
    let png = extract_png_payload(&bytes)?;
    std::fs::write(&dest_path, png).map_err(|e| format!("Failed to write screenshot file: {e}"))?;

    Ok(crate::helpers::normalize_path(&dest_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_label_serial() {
        assert_eq!(sanitize_label_serial("emulator-5554"), "emulator-5554");
        assert_eq!(sanitize_label_serial("192.168.1.100:5555"), "192_168_1_100_5555");
        assert_eq!(sanitize_label_serial("device/01"), "device_01");
    }

    #[test]
    fn test_toolbar_mode_parsing() {
        assert_eq!(ToolbarMode::from_str_lenient("freeform"), ToolbarMode::Freeform);
        assert_eq!(ToolbarMode::from_str_lenient("Freeform "), ToolbarMode::Freeform);
        assert_eq!(ToolbarMode::from_str_lenient("locked"), ToolbarMode::Locked);
        assert_eq!(ToolbarMode::from_str_lenient("unknown"), ToolbarMode::Locked);
        assert_eq!(ToolbarMode::default(), ToolbarMode::Locked);
    }

    #[test]
    fn test_toolbar_side_parsing() {
        assert_eq!(ToolbarSide::from_str_lenient("left"), ToolbarSide::Left);
        assert_eq!(ToolbarSide::from_str_lenient("Left "), ToolbarSide::Left);
        assert_eq!(ToolbarSide::from_str_lenient("right"), ToolbarSide::Right);
        assert_eq!(ToolbarSide::from_str_lenient("unknown"), ToolbarSide::Right);
        assert_eq!(ToolbarSide::default(), ToolbarSide::Right);
    }

    #[test]
    fn test_toolbar_session_serde() {
        let session = ToolbarSession {
            pid: Some(1234),
            serial: "emulator-5554".to_string(),
            mode: ToolbarMode::Locked,
            side: ToolbarSide::Right,
            y_offset: 20,
            window_label: "scrcpy-toolbar-emulator-5554".to_string(),
        };

        let json = serde_json::to_string(&session).unwrap();
        assert!(json.contains("\"windowLabel\":\"scrcpy-toolbar-emulator-5554\""));
        assert!(json.contains("\"yOffset\":20"));
        assert!(json.contains("\"mode\":\"locked\""));
        assert!(json.contains("\"side\":\"right\""));

        let parsed: ToolbarSession = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.pid, Some(1234));
        assert_eq!(parsed.serial, "emulator-5554");
        assert_eq!(parsed.mode, ToolbarMode::Locked);
        assert_eq!(parsed.side, ToolbarSide::Right);
        assert_eq!(parsed.y_offset, 20);
    }
}
