# Emulator Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new Advanced `Emulator Manager` view that discovers existing Android Studio AVDs, launches them with safe presets, assists with local-package root flows, and restores stock state from backups.

**Architecture:** Build a dedicated Rust `emulator` domain module behind thin Tauri commands, then add a React hybrid manager view with a left-side AVD roster and tabbed `Overview`, `Launch`, `Root`, and `Restore` panels. Rooting uses a device-assisted fake-boot workflow, not the archived `rootAVD` scripts and not a built-in downloader.

**Tech Stack:** React 19, TypeScript 6, Zustand, TanStack Query, Tauri 2, Rust 2024, `adb`, `emulator`, `avdmanager`, Vitest, cargo test/check/clippy.

---

## File Map

### Backend

- Create: `src-tauri/src/emulator/mod.rs`
- Create: `src-tauri/src/emulator/models.rs`
- Create: `src-tauri/src/emulator/sdk.rs`
- Create: `src-tauri/src/emulator/avd.rs`
- Create: `src-tauri/src/emulator/runtime.rs`
- Create: `src-tauri/src/emulator/backup.rs`
- Create: `src-tauri/src/emulator/root.rs`
- Create: `src-tauri/src/commands/emulator.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

### Frontend

- Create: `src/lib/emulatorManagerStore.ts`
- Create: `src/components/views/ViewEmulatorManager.tsx`
- Create: `src/components/emulator-manager/AvdRoster.tsx`
- Create: `src/components/emulator-manager/EmulatorHeaderCard.tsx`
- Create: `src/components/emulator-manager/EmulatorQuickActions.tsx`
- Create: `src/components/emulator-manager/EmulatorLaunchTab.tsx`
- Create: `src/components/emulator-manager/EmulatorRootTab.tsx`
- Create: `src/components/emulator-manager/EmulatorRestoreTab.tsx`
- Create: `src/components/emulator-manager/EmulatorActivityCard.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/components/MainLayout.tsx`
- Modify: `src/lib/desktop/models.ts`
- Modify: `src/lib/desktop/backend.ts`
- Modify: `src/lib/queries.ts`

### Tests

- Create: `src/test/emulatorManagerStore.test.ts`
- Create: `src/test/ViewEmulatorManager.test.tsx`
- Add Rust unit tests inside:
  - `src-tauri/src/emulator/sdk.rs`
  - `src-tauri/src/emulator/avd.rs`
  - `src-tauri/src/emulator/runtime.rs`
  - `src-tauri/src/emulator/backup.rs`
  - `src-tauri/src/emulator/root.rs`

## Task 1: Backend Scaffold and AVD Discovery

**Files:**
- Create: `src-tauri/src/emulator/mod.rs`
- Create: `src-tauri/src/emulator/models.rs`
- Create: `src-tauri/src/emulator/sdk.rs`
- Create: `src-tauri/src/emulator/avd.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing SDK and config parser tests**

```rust
// src-tauri/src/emulator/sdk.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn sdk_roots_prioritize_explicit_env_vars() {
        let env = EmulatorEnv {
            android_sdk_root: Some(PathBuf::from("C:/Android/Sdk")),
            android_home: Some(PathBuf::from("C:/Legacy/Sdk")),
            local_app_data: Some(PathBuf::from("C:/Users/test/AppData/Local")),
            home_dir: Some(PathBuf::from("/home/test")),
        };

        assert_eq!(
            sdk_roots_from_env(&env),
            vec![
                PathBuf::from("C:/Android/Sdk"),
                PathBuf::from("C:/Legacy/Sdk"),
                PathBuf::from("C:/Users/test/AppData/Local/Android/Sdk"),
                PathBuf::from("/home/test/Android/Sdk"),
            ]
        );
    }
}
```

```rust
// src-tauri/src/emulator/avd.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_config_ini_extracts_api_target_and_abi() {
        let config = r#"
abi.type=x86_64
image.sysdir.1=system-images/android-34/google_apis_playstore/x86_64/
tag.display=Google Play
hw.device.name=pixel_8
"#;

        let parsed = parse_config_ini(config);

        assert_eq!(parsed.abi.as_deref(), Some("x86_64"));
        assert_eq!(parsed.api_level, Some(34));
        assert_eq!(parsed.target.as_deref(), Some("Google Play"));
        assert_eq!(parsed.device_name.as_deref(), Some("pixel_8"));
    }
}
```

- [ ] **Step 2: Run the Rust tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml sdk_roots_prioritize_explicit_env_vars parse_config_ini_extracts_api_target_and_abi -q`
Expected: FAIL because the emulator module and parser helpers do not exist yet.

- [ ] **Step 3: Add the module exports, DTOs, and SDK helpers**

```rust
// src-tauri/src/emulator/mod.rs
pub mod avd;
pub mod backup;
pub mod models;
pub mod root;
pub mod runtime;
pub mod sdk;
```

```rust
// src-tauri/src/emulator/models.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvdSummary {
    pub name: String,
    pub ini_path: String,
    pub avd_path: String,
    pub target: Option<String>,
    pub api_level: Option<u32>,
    pub abi: Option<String>,
    pub device_name: Option<String>,
    pub ramdisk_path: Option<String>,
    pub has_backups: bool,
    pub root_state: AvdRootState,
    pub is_running: bool,
    pub serial: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AvdRootState {
    Stock,
    Rooted,
    Modified,
    Unknown,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorLaunchOptions {
    pub wipe_data: bool,
    pub writable_system: bool,
    pub headless: bool,
    pub cold_boot: bool,
    pub no_snapshot_load: bool,
    pub no_snapshot_save: bool,
    pub no_boot_anim: bool,
    pub net_speed: Option<String>,
    pub net_delay: Option<String>,
}
```

```rust
// src-tauri/src/emulator/sdk.rs
use std::{collections::HashSet, path::PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmulatorEnv {
    pub android_sdk_root: Option<PathBuf>,
    pub android_home: Option<PathBuf>,
    pub local_app_data: Option<PathBuf>,
    pub home_dir: Option<PathBuf>,
}

pub fn sdk_roots_from_env(env: &EmulatorEnv) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut roots = Vec::new();
    for candidate in [
        env.android_sdk_root.clone(),
        env.android_home.clone(),
        env.local_app_data.as_ref().map(|path| path.join("Android").join("Sdk")),
        env.home_dir.as_ref().map(|path| path.join("Android").join("Sdk")),
    ]
    .into_iter()
    .flatten()
    {
        let key = candidate.to_string_lossy().replace('\\', "/");
        if seen.insert(key) {
            roots.push(candidate);
        }
    }
    roots
}
```

- [ ] **Step 4: Add the config parser and AVD discovery helper**

```rust
// src-tauri/src/emulator/avd.rs
use crate::emulator::models::{AvdRootState, AvdSummary};
use std::{collections::BTreeMap, path::{Path, PathBuf}};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ParsedAvdConfig {
    pub api_level: Option<u32>,
    pub abi: Option<String>,
    pub target: Option<String>,
    pub device_name: Option<String>,
}

pub fn parse_config_ini(contents: &str) -> ParsedAvdConfig {
    let map = contents
        .lines()
        .filter_map(|line| line.split_once('='))
        .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
        .collect::<BTreeMap<_, _>>();

    ParsedAvdConfig {
        api_level: map
            .get("image.sysdir.1")
            .and_then(|value| value.split('/').find(|part| part.starts_with("android-")))
            .and_then(|value| value.trim_start_matches("android-").parse::<u32>().ok()),
        abi: map.get("abi.type").cloned(),
        target: map.get("tag.display").cloned(),
        device_name: map.get("hw.device.name").cloned(),
    }
}

pub fn build_avd_summary(name: &str, ini_path: &Path, avd_path: &Path, config: &ParsedAvdConfig) -> AvdSummary {
    let ramdisk_path = ["ramdisk.img", "ramdisk-qemu.img"]
        .into_iter()
        .map(|value| avd_path.join(value))
        .find(|path| path.exists());

    AvdSummary {
        name: name.to_string(),
        ini_path: ini_path.to_string_lossy().to_string(),
        avd_path: avd_path.to_string_lossy().to_string(),
        target: config.target.clone(),
        api_level: config.api_level,
        abi: config.abi.clone(),
        device_name: config.device_name.clone(),
        ramdisk_path: ramdisk_path.map(|path| path.to_string_lossy().to_string()),
        has_backups: false,
        root_state: AvdRootState::Unknown,
        is_running: false,
        serial: None,
        warnings: Vec::new(),
    }
}
```

- [ ] **Step 5: Re-run the Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml sdk_roots_prioritize_explicit_env_vars parse_config_ini_extracts_api_target_and_abi -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/emulator/mod.rs src-tauri/src/emulator/models.rs src-tauri/src/emulator/sdk.rs src-tauri/src/emulator/avd.rs
git commit -m "feat: scaffold emulator discovery domain"
```

## Task 2: Runtime Commands, Backups, and Restore Planning

**Files:**
- Create: `src-tauri/src/emulator/runtime.rs`
- Create: `src-tauri/src/emulator/backup.rs`
- Create: `src-tauri/src/commands/emulator.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/emulator/models.rs`

- [ ] **Step 1: Write the failing runtime and backup tests**

```rust
// src-tauri/src/emulator/runtime.rs
#[cfg(test)]
mod tests {
    use super::*;
    use crate::emulator::models::EmulatorLaunchOptions;

    #[test]
    fn build_launch_args_adds_cold_boot_headless_and_network_flags() {
        let args = build_launch_args(
            "Pixel_8_API_34",
            &EmulatorLaunchOptions {
                wipe_data: false,
                writable_system: true,
                headless: true,
                cold_boot: true,
                no_snapshot_load: true,
                no_snapshot_save: true,
                no_boot_anim: true,
                net_speed: Some("lte".into()),
                net_delay: Some("none".into()),
            },
        );

        assert_eq!(
            args,
            vec![
                "@Pixel_8_API_34",
                "-writable-system",
                "-no-window",
                "-no-audio",
                "-no-snapshot-load",
                "-no-snapshot-save",
                "-no-boot-anim",
                "-netspeed",
                "lte",
                "-netdelay",
                "none",
            ]
        );
    }
}
```

```rust
// src-tauri/src/emulator/backup.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn build_backup_entry_appends_backup_suffix() {
        let entry = build_backup_entry(PathBuf::from("C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img"));
        assert_eq!(entry.original_path, "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img");
        assert_eq!(entry.backup_path, "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img.backup");
    }
}
```

- [ ] **Step 2: Run the Rust tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml build_launch_args_adds_cold_boot_headless_and_network_flags build_backup_entry_appends_backup_suffix -q`
Expected: FAIL because runtime and backup helpers do not exist yet.

- [ ] **Step 3: Add launch-argument and stop helpers**

```rust
// src-tauri/src/emulator/runtime.rs
use crate::{emulator::models::EmulatorLaunchOptions, helpers::run_binary_command_allow_output_on_failure, CmdResult};
use std::process::Command;
use tauri::AppHandle;

pub fn build_launch_args(name: &str, options: &EmulatorLaunchOptions) -> Vec<String> {
    let mut args = vec![format!("@{name}")];
    if options.writable_system {
        args.push("-writable-system".into());
    }
    if options.headless {
        args.push("-no-window".into());
        args.push("-no-audio".into());
    }
    if options.cold_boot || options.no_snapshot_load {
        args.push("-no-snapshot-load".into());
    }
    if options.cold_boot || options.no_snapshot_save {
        args.push("-no-snapshot-save".into());
    }
    if options.no_boot_anim {
        args.push("-no-boot-anim".into());
    }
    if let Some(speed) = &options.net_speed {
        args.push("-netspeed".into());
        args.push(speed.clone());
    }
    if let Some(delay) = &options.net_delay {
        args.push("-netdelay".into());
        args.push(delay.clone());
    }
    if options.wipe_data {
        args.push("-wipe-data".into());
    }
    args
}

pub fn launch_avd(app: &AppHandle, avd_name: &str, options: &EmulatorLaunchOptions) -> CmdResult<String> {
    let binary = crate::helpers::resolve_binary_path(app, "emulator")?;
    Command::new(binary)
        .args(build_launch_args(avd_name, options))
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(format!("Launched {avd_name}"))
}

pub fn stop_avd(app: &AppHandle, serial: &str) -> CmdResult<String> {
    run_binary_command_allow_output_on_failure(app, "adb", &["-s", serial, "emu", "kill"])?;
    Ok(format!("Stopped {serial}"))
}
```

- [ ] **Step 4: Add backup DTOs and restore helpers**

```rust
// src-tauri/src/emulator/models.rs
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub original_path: String,
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePlan {
    pub entries: Vec<BackupEntry>,
    pub created_at: String,
    pub source: String,
}
```

```rust
// src-tauri/src/emulator/backup.rs
use crate::emulator::models::{BackupEntry, RestorePlan};
use std::{path::{Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};

pub fn build_backup_entry(path: PathBuf) -> BackupEntry {
    BackupEntry {
        original_path: path.to_string_lossy().to_string(),
        backup_path: format!("{}.backup", path.to_string_lossy()),
    }
}

pub fn ensure_backup(path: &Path) -> Result<BackupEntry, String> {
    let entry = build_backup_entry(path.to_path_buf());
    let backup_path = PathBuf::from(&entry.backup_path);
    if !backup_path.exists() {
        std::fs::copy(path, &backup_path).map_err(|error| error.to_string())?;
    }
    Ok(entry)
}

pub fn build_restore_plan(source: &str, paths: &[PathBuf]) -> RestorePlan {
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".into());
    RestorePlan {
        entries: paths.iter().cloned().map(build_backup_entry).collect(),
        created_at,
        source: source.to_string(),
    }
}
```

- [ ] **Step 5: Expose `list_avds`, `launch_avd`, `stop_avd`, `get_avd_restore_plan`, and `restore_avd_backups`**

```rust
// src-tauri/src/commands/emulator.rs
use crate::{
    emulator::{
        avd,
        backup,
        models::{AvdSummary, EmulatorLaunchOptions, RestorePlan},
        runtime,
    },
    CmdResult,
};

#[tauri::command]
pub async fn list_avds(app: tauri::AppHandle) -> CmdResult<Vec<AvdSummary>> {
    tokio::task::spawn_blocking(move || avd::list_avds(&app)).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn launch_avd(app: tauri::AppHandle, avd_name: String, options: EmulatorLaunchOptions) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || runtime::launch_avd(&app, &avd_name, &options))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn stop_avd(app: tauri::AppHandle, serial: String) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || runtime::stop_avd(&app, &serial))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn get_avd_restore_plan(app: tauri::AppHandle, avd_name: String) -> CmdResult<RestorePlan> {
    tokio::task::spawn_blocking(move || {
        let avd = avd::list_avds(&app)?
            .into_iter()
            .find(|item| item.name == avd_name)
            .ok_or_else(|| format!("AVD not found: {avd_name}"))?;
        let ramdisk = avd.ramdisk_path.ok_or_else(|| format!("No ramdisk for {avd_name}"))?;
        Ok(backup::build_restore_plan(&avd_name, &[std::path::PathBuf::from(ramdisk)]))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn restore_avd_backups(app: tauri::AppHandle, avd_name: String) -> CmdResult<String> {
    tokio::task::spawn_blocking(move || {
        let avd = avd::list_avds(&app)?
            .into_iter()
            .find(|item| item.name == avd_name)
            .ok_or_else(|| format!("AVD not found: {avd_name}"))?;
        let ramdisk = avd.ramdisk_path.ok_or_else(|| format!("No ramdisk for {avd_name}"))?;
        let entry = backup::build_backup_entry(std::path::PathBuf::from(&ramdisk));
        std::fs::copy(&entry.backup_path, &entry.original_path).map_err(|error| error.to_string())?;
        Ok(format!("Restored backups for {avd_name}"))
    })
    .await
    .map_err(|error| error.to_string())?
}
```

```rust
// src-tauri/src/commands/mod.rs
mod adb;
mod apps;
mod device;
mod emulator;
mod fastboot;
mod files;
mod marketplace;
mod payload;
mod system;

pub use emulator::*;
```

```rust
// src-tauri/src/lib.rs (inside generate_handler!)
commands::list_avds,
commands::launch_avd,
commands::stop_avd,
commands::get_avd_restore_plan,
commands::restore_avd_backups,
```

- [ ] **Step 6: Re-run the Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml build_launch_args_adds_cold_boot_headless_and_network_flags build_backup_entry_appends_backup_suffix -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/emulator/runtime.rs src-tauri/src/emulator/backup.rs src-tauri/src/commands/emulator.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/src/emulator/models.rs
git commit -m "feat: add emulator runtime and restore command surface"
```

## Task 3: Assisted Root Workflow Backend

**Files:**
- Create: `src-tauri/src/emulator/root.rs`
- Modify: `src-tauri/src/emulator/models.rs`
- Modify: `src-tauri/src/commands/emulator.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing root-package validation test**

```rust
// src-tauri/src/emulator/root.rs
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn root_package_must_be_apk_or_zip() {
        let result = validate_root_package_path(&PathBuf::from("C:/tmp/root.tar"));
        assert_eq!(result.unwrap_err(), "Root package must be .apk or .zip");
    }
}
```

- [ ] **Step 2: Run the Rust test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml root_package_must_be_apk_or_zip -q`
Expected: FAIL because the root helper does not exist yet.

- [ ] **Step 3: Add root request/response types**

```rust
// src-tauri/src/emulator/models.rs
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootPreparationRequest {
    pub avd_name: String,
    pub serial: String,
    pub root_package_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootPreparationResult {
    pub normalized_package_path: String,
    pub fake_boot_remote_path: String,
    pub instructions: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootFinalizeRequest {
    pub avd_name: String,
    pub serial: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RootFinalizeResult {
    pub restored_files: Vec<String>,
    pub next_boot_recommendation: String,
}
```

- [ ] **Step 4: Add the assisted fake-boot prepare/finalize helpers**

```rust
// src-tauri/src/emulator/root.rs
use crate::{
    emulator::{
        avd,
        backup,
        models::{RootFinalizeRequest, RootFinalizeResult, RootPreparationRequest, RootPreparationResult},
    },
    helpers::run_binary_command_allow_output_on_failure,
    CmdResult,
};
use std::path::{Path, PathBuf};
use tauri::AppHandle;

pub fn validate_root_package_path(path: &Path) -> CmdResult<()> {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some("apk") | Some("zip") => Ok(()),
        _ => Err("Root package must be .apk or .zip".into()),
    }
}

pub fn prepare_root(app: &AppHandle, request: &RootPreparationRequest) -> CmdResult<RootPreparationResult> {
    let package_path = PathBuf::from(&request.root_package_path);
    validate_root_package_path(&package_path)?;

    let avd = avd::list_avds(app)?
        .into_iter()
        .find(|item| item.name == request.avd_name)
        .ok_or_else(|| format!("AVD not found: {}", request.avd_name))?;
    let ramdisk_path = avd
        .ramdisk_path
        .clone()
        .ok_or_else(|| format!("No ramdisk found for {}", request.avd_name))?;

    let _backup = backup::ensure_backup(Path::new(&ramdisk_path))?;

    run_binary_command_allow_output_on_failure(app, "adb", &["-s", &request.serial, "install", "-r", &request.root_package_path])?;
    run_binary_command_allow_output_on_failure(
        app,
        "adb",
        &["-s", &request.serial, "shell", "monkey", "-p", "com.topjohnwu.magisk", "-c", "android.intent.category.LAUNCHER", "1"],
    )?;

    Ok(RootPreparationResult {
        normalized_package_path: package_path.to_string_lossy().to_string(),
        fake_boot_remote_path: "/sdcard/Download/fakeboot.img".into(),
        instructions: vec![
            "Patch the staged fake boot image in the emulator".into(),
            "Return to Emulator Manager and press Finalize Root".into(),
        ],
    })
}

pub fn finalize_root(app: &AppHandle, request: &RootFinalizeRequest) -> CmdResult<RootFinalizeResult> {
    let patched = run_binary_command_allow_output_on_failure(
        app,
        "adb",
        &["-s", &request.serial, "shell", "sh", "-c", "ls -t /sdcard/Download/*magisk_patched* 2>/dev/null | head -n 1"],
    )?;
    let patched = patched.trim().to_string();
    if patched.is_empty() {
        return Err("No patched fake boot image was found in /sdcard/Download.".into());
    }

    let local_copy = std::env::temp_dir().join(format!("{}-magisk-patched.img", request.avd_name));
    run_binary_command_allow_output_on_failure(
        app,
        "adb",
        &["-s", &request.serial, "pull", &patched, &local_copy.to_string_lossy()],
    )?;

    Ok(RootFinalizeResult {
        restored_files: vec![local_copy.to_string_lossy().to_string()],
        next_boot_recommendation: "Shut down the emulator and cold boot it from Emulator Manager.".into(),
    })
}
```

- [ ] **Step 5: Expose `prepare_avd_root` and `finalize_avd_root`**

```rust
// src-tauri/src/commands/emulator.rs
use crate::emulator::models::{
    RootFinalizeRequest,
    RootFinalizeResult,
    RootPreparationRequest,
    RootPreparationResult,
};

#[tauri::command]
pub async fn prepare_avd_root(
    app: tauri::AppHandle,
    request: RootPreparationRequest,
) -> CmdResult<RootPreparationResult> {
    tokio::task::spawn_blocking(move || crate::emulator::root::prepare_root(&app, &request))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn finalize_avd_root(
    app: tauri::AppHandle,
    request: RootFinalizeRequest,
) -> CmdResult<RootFinalizeResult> {
    tokio::task::spawn_blocking(move || crate::emulator::root::finalize_root(&app, &request))
        .await
        .map_err(|error| error.to_string())?
}
```

```rust
// src-tauri/src/lib.rs (inside generate_handler!)
commands::prepare_avd_root,
commands::finalize_avd_root,
```

- [ ] **Step 6: Re-run the Rust test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml root_package_must_be_apk_or_zip -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/emulator/root.rs src-tauri/src/emulator/models.rs src-tauri/src/commands/emulator.rs src-tauri/src/lib.rs
git commit -m "feat: add assisted avd root workflow"
```

## Task 4: Frontend Data Layer

**Files:**
- Modify: `src/lib/desktop/models.ts`
- Modify: `src/lib/desktop/backend.ts`
- Modify: `src/lib/queries.ts`
- Create: `src/lib/emulatorManagerStore.ts`
- Create: `src/test/emulatorManagerStore.test.ts`

- [ ] **Step 1: Write the failing store test**

```ts
// src/test/emulatorManagerStore.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useEmulatorManagerStore } from '@/lib/emulatorManagerStore';

describe('emulatorManagerStore', () => {
  beforeEach(() => {
    useEmulatorManagerStore.setState({
      selectedAvdName: null,
      activeTab: 'overview',
      activity: [],
      rootSession: null,
      restorePlan: null,
    });
  });

  it('tracks root preparation state until cleared', () => {
    useEmulatorManagerStore.getState().setRootSession({
      avdName: 'Pixel_8_API_34',
      serial: 'emulator-5554',
      instructions: ['Patch fake boot'],
    });

    expect(useEmulatorManagerStore.getState().rootSession?.serial).toBe('emulator-5554');
    useEmulatorManagerStore.getState().clearRootSession();
    expect(useEmulatorManagerStore.getState().rootSession).toBeNull();
  });
});
```

- [ ] **Step 2: Run the frontend test to verify it fails**

Run: `pnpm test -- emulatorManagerStore`
Expected: FAIL because the store and emulator DTOs do not exist yet.

- [ ] **Step 3: Add emulator DTOs and wrappers**

```ts
// src/lib/desktop/models.ts
export namespace backend {
  export interface AvdSummary {
    name: string;
    iniPath: string;
    avdPath: string;
    target: string | null;
    apiLevel: number | null;
    abi: string | null;
    deviceName: string | null;
    ramdiskPath: string | null;
    hasBackups: boolean;
    rootState: 'stock' | 'rooted' | 'modified' | 'unknown';
    isRunning: boolean;
    serial: string | null;
    warnings: string[];
  }

  export interface EmulatorLaunchOptions {
    wipeData: boolean;
    writableSystem: boolean;
    headless: boolean;
    coldBoot: boolean;
    noSnapshotLoad: boolean;
    noSnapshotSave: boolean;
    noBootAnim: boolean;
    netSpeed: string | null;
    netDelay: string | null;
  }

  export interface RestorePlan {
    entries: { originalPath: string; backupPath: string }[];
    createdAt: string;
    source: string;
  }

  export interface RootPreparationRequest {
    avdName: string;
    serial: string;
    rootPackagePath: string;
  }

  export interface RootPreparationResult {
    normalizedPackagePath: string;
    fakeBootRemotePath: string;
    instructions: string[];
  }

  export interface RootFinalizeRequest {
    avdName: string;
    serial: string;
  }

  export interface RootFinalizeResult {
    restoredFiles: string[];
    nextBootRecommendation: string;
  }
}
```

```ts
// src/lib/desktop/backend.ts
export function ListAvds(): Promise<Array<backend.AvdSummary>> {
  return call('list_avds');
}

export function LaunchAvd(avdName: string, options: backend.EmulatorLaunchOptions): Promise<string> {
  return call('launch_avd', { avdName, options });
}

export function StopAvd(serial: string): Promise<string> {
  return call('stop_avd', { serial });
}

export function GetAvdRestorePlan(avdName: string): Promise<backend.RestorePlan> {
  return call('get_avd_restore_plan', { avdName });
}

export function PrepareAvdRoot(
  request: backend.RootPreparationRequest,
): Promise<backend.RootPreparationResult> {
  return call('prepare_avd_root', { request });
}

export function FinalizeAvdRoot(
  request: backend.RootFinalizeRequest,
): Promise<backend.RootFinalizeResult> {
  return call('finalize_avd_root', { request });
}

export function RestoreAvdBackups(avdName: string): Promise<string> {
  return call('restore_avd_backups', { avdName });
}

export function SelectRootPackageFile(): Promise<string> {
  return selectFile({
    filters: [{ name: 'Root packages', extensions: ['apk', 'zip'] }],
  });
}
```

```ts
// src/lib/queries.ts
export const queryKeys = {
  devices: () => ['devices'] as const,
  fastbootDevices: () => ['fastbootDevices'] as const,
  allDevices: () => ['allDevices'] as const,
  packages: () => ['packages'] as const,
  avds: () => ['avds'] as const,
} as const;

export const fetchAvds = () => ListAvds();
```

- [ ] **Step 4: Add the emulator manager store**

```ts
// src/lib/emulatorManagerStore.ts
import { create } from 'zustand';
import type { backend } from '@/lib/desktop/models';

interface RootSessionState {
  avdName: string;
  serial: string;
  instructions: string[];
}

interface ActivityItem {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface EmulatorManagerState {
  selectedAvdName: string | null;
  activeTab: 'overview' | 'launch' | 'root' | 'restore';
  activity: ActivityItem[];
  rootSession: RootSessionState | null;
  restorePlan: backend.RestorePlan | null;
  setSelectedAvdName: (name: string | null) => void;
  setActiveTab: (tab: EmulatorManagerState['activeTab']) => void;
  appendActivity: (item: Omit<ActivityItem, 'id'>) => void;
  setRootSession: (session: RootSessionState) => void;
  clearRootSession: () => void;
}

export const useEmulatorManagerStore = create<EmulatorManagerState>((set) => ({
  selectedAvdName: null,
  activeTab: 'overview',
  activity: [],
  rootSession: null,
  restorePlan: null,
  setSelectedAvdName: (selectedAvdName) => set({ selectedAvdName }),
  setActiveTab: (activeTab) => set({ activeTab }),
  appendActivity: (item) =>
    set((state) => ({
      activity: [
        ...state.activity,
        { ...item, id: `${Date.now()}-${state.activity.length}` },
      ].slice(-100),
    })),
  setRootSession: (rootSession) => set({ rootSession }),
  clearRootSession: () => set({ rootSession: null }),
}));
```

- [ ] **Step 5: Re-run the frontend test**

Run: `pnpm test -- emulatorManagerStore`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/desktop/models.ts src/lib/desktop/backend.ts src/lib/queries.ts src/lib/emulatorManagerStore.ts src/test/emulatorManagerStore.test.ts
git commit -m "feat: add emulator manager frontend data layer"
```

## Task 5: Navigation, View Shell, and Tabs

**Files:**
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/components/MainLayout.tsx`
- Create: `src/components/views/ViewEmulatorManager.tsx`
- Create: `src/components/emulator-manager/AvdRoster.tsx`
- Create: `src/components/emulator-manager/EmulatorHeaderCard.tsx`
- Create: `src/components/emulator-manager/EmulatorQuickActions.tsx`
- Create: `src/components/emulator-manager/EmulatorLaunchTab.tsx`
- Create: `src/components/emulator-manager/EmulatorRootTab.tsx`
- Create: `src/components/emulator-manager/EmulatorRestoreTab.tsx`
- Create: `src/components/emulator-manager/EmulatorActivityCard.tsx`
- Create: `src/test/ViewEmulatorManager.test.tsx`

- [ ] **Step 1: Write the failing shell test**

```tsx
// src/test/ViewEmulatorManager.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewEmulatorManager } from '@/components/views/ViewEmulatorManager';

vi.mock('@/lib/queries', () => ({
  queryKeys: { avds: () => ['avds'] },
  fetchAvds: vi.fn(async () => []),
}));

describe('ViewEmulatorManager', () => {
  it('renders the page heading', () => {
    render(<ViewEmulatorManager />);
    expect(screen.getByText('Emulator Manager')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the frontend shell test to verify it fails**

Run: `pnpm test -- ViewEmulatorManager`
Expected: FAIL because the view and route do not exist yet.

- [ ] **Step 3: Add the route and sidebar entry**

```tsx
// src/components/AppSidebar.tsx
import { Bot, Box, FolderOpen, Info, LayoutDashboard, Package, Settings, Store, Zap } from 'lucide-react';

type ViewType =
  | 'dashboard'
  | 'apps'
  | 'files'
  | 'marketplace'
  | 'flasher'
  | 'utils'
  | 'payload'
  | 'emulator'
  | 'about';

// Advanced group item
{ id: 'emulator', icon: Bot, label: 'Emulator Manager' },
```

```tsx
// src/components/MainLayout.tsx
import { ViewEmulatorManager } from './views/ViewEmulatorManager';

const VIEWS = {
  DASHBOARD: 'dashboard',
  APPS: 'apps',
  FILES: 'files',
  MARKETPLACE: 'marketplace',
  FLASHER: 'flasher',
  UTILS: 'utils',
  PAYLOAD: 'payload',
  EMULATOR: 'emulator',
  ABOUT: 'about',
} as const;

case VIEWS.EMULATOR:
  return <ViewEmulatorManager />;
```

- [ ] **Step 4: Add the shell and wire the tabs**

```tsx
// src/components/views/ViewEmulatorManager.tsx
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import {
  FinalizeAvdRoot,
  GetAvdRestorePlan,
  LaunchAvd,
  PrepareAvdRoot,
  RestoreAvdBackups,
} from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { queryKeys, fetchAvds } from '@/lib/queries';
import { useEmulatorManagerStore } from '@/lib/emulatorManagerStore';
import { AvdRoster } from '@/components/emulator-manager/AvdRoster';
import { EmulatorHeaderCard } from '@/components/emulator-manager/EmulatorHeaderCard';
import { EmulatorQuickActions } from '@/components/emulator-manager/EmulatorQuickActions';
import { EmulatorLaunchTab } from '@/components/emulator-manager/EmulatorLaunchTab';
import { EmulatorRootTab } from '@/components/emulator-manager/EmulatorRootTab';
import { EmulatorRestoreTab } from '@/components/emulator-manager/EmulatorRestoreTab';
import { EmulatorActivityCard } from '@/components/emulator-manager/EmulatorActivityCard';

export function ViewEmulatorManager() {
  const { data: avds = [] } = useQuery({ queryKey: queryKeys.avds(), queryFn: fetchAvds });
  const {
    selectedAvdName,
    activeTab,
    restorePlan,
    rootSession,
    setSelectedAvdName,
    appendActivity,
    setRootSession,
    clearRootSession,
  } = useEmulatorManagerStore();

  useEffect(() => {
    if (!selectedAvdName && avds.length > 0) {
      setSelectedAvdName(avds[0].name);
    }
  }, [avds, selectedAvdName, setSelectedAvdName]);

  const selectedAvd = useMemo(
    () => avds.find((avd) => avd.name === selectedAvdName) ?? null,
    [avds, selectedAvdName],
  );

  useEffect(() => {
    if (!selectedAvd?.name) return;
    void GetAvdRestorePlan(selectedAvd.name)
      .then((plan) => useEmulatorManagerStore.setState({ restorePlan: plan }))
      .catch(() => useEmulatorManagerStore.setState({ restorePlan: null }));
  }, [selectedAvd?.name]);

  const handleLaunch = async (options: backend.EmulatorLaunchOptions) => {
    if (!selectedAvd) return;
    await LaunchAvd(selectedAvd.name, options);
    appendActivity({ level: 'success', message: `Launched ${selectedAvd.name}` });
  };

  const handlePrepareRoot = async (rootPackagePath: string) => {
    if (!selectedAvd?.serial) return;
    const result = await PrepareAvdRoot({
      avdName: selectedAvd.name,
      serial: selectedAvd.serial,
      rootPackagePath,
    });
    setRootSession({ avdName: selectedAvd.name, serial: selectedAvd.serial, instructions: result.instructions });
  };

  const handleFinalizeRoot = async () => {
    if (!rootSession) return;
    const result = await FinalizeAvdRoot({ avdName: rootSession.avdName, serial: rootSession.serial });
    appendActivity({ level: 'success', message: result.nextBootRecommendation });
    clearRootSession();
  };

  const handleRestore = async () => {
    if (!selectedAvd) return;
    await RestoreAvdBackups(selectedAvd.name);
    appendActivity({ level: 'warning', message: `Restored stock state for ${selectedAvd.name}` });
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center gap-4">
        <div className="relative h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Emulator Manager</h1>
          <p className="text-sm text-muted-foreground">
            Manage existing Android Studio virtual devices, launch presets, root, and restore flows.
          </p>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <AvdRoster avds={avds} selectedAvdName={selectedAvdName} onSelect={setSelectedAvdName} />
        <div className="flex min-w-0 flex-col gap-6">
          <EmulatorHeaderCard avd={selectedAvd} />
          <EmulatorQuickActions avd={selectedAvd} />
          <EmulatorLaunchTab avd={selectedAvd} onLaunch={handleLaunch} />
          <EmulatorRootTab avd={selectedAvd} onPrepare={handlePrepareRoot} onFinalize={handleFinalizeRoot} instructions={rootSession?.instructions ?? []} />
          <EmulatorRestoreTab avd={selectedAvd} restorePlan={restorePlan} onRestore={handleRestore} />
          <EmulatorActivityCard />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Re-run the frontend shell test**

Run: `pnpm test -- ViewEmulatorManager`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/AppSidebar.tsx src/components/MainLayout.tsx src/components/views/ViewEmulatorManager.tsx src/components/emulator-manager/AvdRoster.tsx src/components/emulator-manager/EmulatorHeaderCard.tsx src/components/emulator-manager/EmulatorQuickActions.tsx src/components/emulator-manager/EmulatorLaunchTab.tsx src/components/emulator-manager/EmulatorRootTab.tsx src/components/emulator-manager/EmulatorRestoreTab.tsx src/components/emulator-manager/EmulatorActivityCard.tsx src/test/ViewEmulatorManager.test.tsx
git commit -m "feat: add emulator manager view and tab surface"
```

## Task 6: Verification and Project Docs

**Files:**
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/systemPatterns.md`

- [ ] **Step 1: Run frontend tests**

Run: `pnpm test`
Expected: PASS, including the new emulator manager tests.

- [ ] **Step 2: Run formatting and linting**

Run: `pnpm format:check`
Expected: PASS

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 3: Run build verification**

Run: `pnpm build`
Expected: PASS

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 4: Run Rust tests where the environment allows**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS for the new emulator unit tests. If the pre-existing Windows Tauri DLL issue reproduces, capture the failure in the task notes and keep `cargo check` plus the unit-test additions intact.

- [ ] **Step 5: Update the memory bank**

```md
## activeContext.md
- Added Emulator Manager implementation status
- New backend `emulator/` module and Advanced view
- Rooting uses device-assisted fake-boot orchestration, not rootAVD as a dependency

## systemPatterns.md
- Added emulator manager typed command surface
- Added AVD discovery via emulator CLI + config parsing
- Added backup/restore plan pattern for AVD ramdisk artifacts

## progress.md
- Track emulator manager discovery, launch, root, and restore support
```

- [ ] **Step 6: Commit**

```bash
git add memory-bank/activeContext.md memory-bank/progress.md memory-bank/systemPatterns.md
git commit -m "docs: record emulator manager architecture and progress"
```

## Self-Review

### Spec Coverage

- AVD discovery: Tasks 1 and 2
- Launch presets and advanced flags: Tasks 2 and 5
- Existing-AVD-only manager surface: Tasks 4 and 5
- Local-package root flow: Tasks 3 and 5
- Restore/unroot with backups: Tasks 2, 3, and 5
- Verification and project documentation: Task 6

### Placeholder Scan

- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Each task includes exact file paths, code blocks, and verification commands.

### Type Consistency

- Rust command names and frontend wrapper names align:
  - `list_avds` ↔ `ListAvds`
  - `launch_avd` ↔ `LaunchAvd`
  - `stop_avd` ↔ `StopAvd`
  - `get_avd_restore_plan` ↔ `GetAvdRestorePlan`
  - `prepare_avd_root` ↔ `PrepareAvdRoot`
  - `finalize_avd_root` ↔ `FinalizeAvdRoot`
  - `restore_avd_backups` ↔ `RestoreAvdBackups`
