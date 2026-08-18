//! Official scrcpy binary manager: download Genymobile releases, verify SHA-256,
//! extract into app data, and launch as a detached native window.

pub mod assets;
pub mod flags;
pub mod install;
pub mod launch;

pub use flags::{
    ScrcpyLaunchOptions, ScrcpyPresetOption, ScrcpyPresetsCatalog, get_presets_catalog,
};
pub use install::{ScrcpyStatus, fetch_latest_tag, install_latest, local_status};
pub use launch::{ScrcpyActiveSessions, ScrcpySessionInfo, active_sessions, launch, stop};
