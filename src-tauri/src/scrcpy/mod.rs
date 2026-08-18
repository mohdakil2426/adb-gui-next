//! Official scrcpy binary manager: download Genymobile releases, verify SHA-256,
//! extract into app data, and launch as a detached native window.

pub mod assets;
pub mod flags;
pub mod install;
pub mod launch;
pub mod toolbar;
pub use flags::{
    ScrcpyLaunchOptions, ScrcpyPresetOption, ScrcpyPresetsCatalog, get_presets_catalog,
};
pub use install::{
    ScrcpyStatus, fetch_latest_tag, install_latest, local_status, uninstall_managed,
};
pub use launch::{ScrcpyActiveSessions, ScrcpySessionInfo, active_sessions, launch, stop};
pub use toolbar::{
    ToolbarMode, ToolbarSession, ToolbarSide, close_toolbar, create_toolbar_window,
    get_toolbar_session, rotate_device, send_keyevent, send_statusbar, set_toolbar_mode,
    set_toolbar_offset, set_toolbar_side, set_toolbar_size, take_screenshot,
};
