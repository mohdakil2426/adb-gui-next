//! Windows host setup: official Google platform-tools + USB driver.

use std::fs;
use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::CmdResult;

mod catalog;
mod http;
mod paths;
mod windows_state;
mod zip;

#[cfg(windows)]
mod elevate;

pub use catalog::{PackageKind, parse_sdk_packages, select_windows_packages};
pub use paths::{INSTALL_DIR, path_contains_dir, windows_install_dir};

pub const PROGRESS_EVENT: &str = "host-setup:progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostSetupProgress {
    pub received: u64,
    pub stage: String,
    pub total: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostSetupStatus {
    pub adb_present: bool,
    pub driver_installed: bool,
    pub driver_label: String,
    pub fastboot_present: bool,
    pub install_path: String,
    pub latest_platform_tools: Option<String>,
    pub latest_usb_driver: Option<String>,
    pub on_path: bool,
    pub supported: bool,
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostSetupResult {
    pub driver_installed: bool,
    pub driver_message: Option<String>,
    pub install_path: String,
    pub path_updated: bool,
    pub platform_tools_version: String,
}

pub async fn status(_app: AppHandle) -> CmdResult<HostSetupStatus> {
    if !cfg!(windows) {
        return Ok(HostSetupStatus {
            adb_present: false,
            driver_installed: false,
            driver_label: "Windows only".into(),
            fastboot_present: false,
            install_path: INSTALL_DIR.to_string(),
            latest_platform_tools: None,
            latest_usb_driver: None,
            on_path: false,
            supported: false,
            unsupported_reason: Some(
                "Official Google USB driver and C:\\Android install are Windows-only.".into(),
            ),
        });
    }

    let dir = windows_install_dir();
    let adb_present = paths::adb_exe(&dir).is_file();
    let fastboot_present = paths::fastboot_exe(&dir).is_file();
    let on_path = windows_state::machine_path_contains_install_dir();
    let (driver_installed, driver_label) = windows_state::google_usb_driver_status();
    let (latest_platform_tools, latest_usb_driver) = catalog_latest_versions().await;

    Ok(HostSetupStatus {
        adb_present,
        driver_installed,
        driver_label,
        fastboot_present,
        install_path: INSTALL_DIR.to_string(),
        latest_platform_tools,
        latest_usb_driver,
        on_path,
        supported: true,
        unsupported_reason: None,
    })
}

async fn catalog_latest_versions() -> (Option<String>, Option<String>) {
    let Ok(client) = http::http_client() else {
        return (None, None);
    };
    let Ok(packages) = load_catalog_packages(&client).await else {
        return (None, None);
    };
    (
        catalog::newest_package(&packages, catalog::PackageKind::PlatformTools)
            .map(|package| package.version),
        catalog::newest_package(&packages, catalog::PackageKind::UsbDriver)
            .map(|package| package.version),
    )
}

async fn load_catalog_packages(client: &reqwest::Client) -> CmdResult<Vec<catalog::SdkPackage>> {
    let repo_xml = http::fetch_text(client, catalog::REPOSITORY_XML_URL).await?;
    let mut packages = catalog::parse_sdk_packages(&repo_xml)?;
    if let Ok(xml) = http::fetch_text(client, catalog::REPOSITORY_XML_V3_URL).await {
        packages.extend(catalog::parse_sdk_packages(&xml)?);
    }
    if let Ok(xml) = http::fetch_text(client, catalog::ADDON_XML_URL).await {
        packages.extend(catalog::parse_sdk_packages(&xml)?);
    }
    Ok(packages)
}

pub async fn install(app: AppHandle) -> CmdResult<HostSetupResult> {
    if !cfg!(windows) {
        return Err("Windows host setup is only available on Windows.".into());
    }

    emit(&app, "catalog", 0, None);
    let client = http::http_client()?;
    let packages = load_catalog_packages(&client).await?;
    let tools = catalog::newest_package(&packages, catalog::PackageKind::PlatformTools)
        .ok_or_else(|| "Android SDK catalog has no Windows platform-tools package".to_string())?;

    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("host-setup");
    fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    let tools_zip = cache.join("platform-tools.zip");
    let extract_tools = cache.join("extract-tools");
    reset_dir(&extract_tools)?;

    emit(&app, "download-tools", 0, None);
    http::download_package(&client, &app, &tools, &tools_zip, "download-tools").await?;
    emit(&app, "extract", 0, None);
    zip::safe_extract_zip(&tools_zip, &extract_tools)?;

    let tools_root = paths::find_tools_root(&extract_tools)
        .ok_or_else(|| "extracted platform-tools zip did not contain adb.exe".to_string())?;

    emit(&app, "elevate", 0, None);
    let elevated = run_elevate_tools(&tools_root)?;
    let _ = fs::remove_file(&tools_zip);

    emit(&app, "done", 1, Some(1));
    Ok(HostSetupResult {
        driver_installed: windows_state::google_usb_driver_status().0,
        driver_message: None,
        install_path: INSTALL_DIR.to_string(),
        path_updated: elevated.path_updated || windows_state::machine_path_contains_install_dir(),
        platform_tools_version: tools.version,
    })
}

pub async fn install_driver(app: AppHandle) -> CmdResult<HostSetupResult> {
    if !cfg!(windows) {
        return Err("Windows USB driver install is only available on Windows.".into());
    }

    emit(&app, "catalog", 0, None);
    let client = http::http_client()?;
    let packages = load_catalog_packages(&client).await?;
    let driver =
        catalog::newest_package(&packages, catalog::PackageKind::UsbDriver).ok_or_else(|| {
            "Android SDK catalog has no Windows Google USB Driver package".to_string()
        })?;

    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("host-setup");
    fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    let driver_zip = cache.join("usb-driver.zip");
    let extract_driver = cache.join("extract-driver");
    reset_dir(&extract_driver)?;

    emit(&app, "download-driver", 0, None);
    http::download_package(&client, &app, &driver, &driver_zip, "download-driver").await?;
    emit(&app, "extract", 0, None);
    zip::safe_extract_zip(&driver_zip, &extract_driver)?;
    let inf = paths::find_named_file(&extract_driver, paths::USB_INF_NAME)
        .ok_or_else(|| "extracted USB driver zip did not contain android_winusb.inf".to_string())?;

    emit(&app, "elevate", 0, None);
    let elevated = run_elevate_driver(&inf)?;
    let _ = fs::remove_file(&driver_zip);

    if !elevated.driver_installed {
        return Err(elevated.driver_message.unwrap_or_else(|| {
            "USB driver install did not complete. Check Device Manager after accepting UAC.".into()
        }));
    }

    emit(&app, "done", 1, Some(1));
    Ok(HostSetupResult {
        driver_installed: true,
        driver_message: elevated.driver_message,
        install_path: INSTALL_DIR.to_string(),
        path_updated: false,
        platform_tools_version: driver.version,
    })
}

pub fn repair_system_path() -> CmdResult<HostSetupResult> {
    if !paths::adb_exe(&windows_install_dir()).is_file() {
        return Err(format!(
            "{INSTALL_DIR} does not contain adb.exe. Install platform-tools first."
        ));
    }
    #[cfg(windows)]
    {
        let result = elevate::elevate_repair_path()?;
        let (driver_installed, driver_label) = windows_state::google_usb_driver_status();
        let on_path = result.path_updated || windows_state::machine_path_contains_install_dir();
        if !on_path {
            return Err(
                "Administrator completed but C:\\Android\\platform-tools is still missing from the system Path."
                    .into(),
            );
        }
        Ok(HostSetupResult {
            driver_installed,
            driver_message: Some(driver_label),
            install_path: INSTALL_DIR.to_string(),
            path_updated: true,
            platform_tools_version: "PATH".into(),
        })
    }
    #[cfg(not(windows))]
    {
        Err("System PATH update is only available on Windows.".into())
    }
}

struct Elevated {
    driver_installed: bool,
    driver_message: Option<String>,
    path_updated: bool,
}

fn run_elevate_tools(tools_root: &Path) -> CmdResult<Elevated> {
    #[cfg(windows)]
    {
        let result = elevate::elevate_install_tools(tools_root)?;
        Ok(Elevated {
            driver_installed: result.driver_installed,
            driver_message: result.driver_message,
            path_updated: result.path_updated,
        })
    }
    #[cfg(not(windows))]
    {
        let _ = tools_root;
        Err("Windows host setup is only available on Windows.".into())
    }
}

fn run_elevate_driver(inf: &Path) -> CmdResult<Elevated> {
    #[cfg(windows)]
    {
        let result = elevate::elevate_install_driver(inf)?;
        Ok(Elevated {
            driver_installed: result.driver_installed,
            driver_message: result.driver_message,
            path_updated: result.path_updated,
        })
    }
    #[cfg(not(windows))]
    {
        let _ = inf;
        Err("Windows USB driver install is only available on Windows.".into())
    }
}

fn reset_dir(path: &Path) -> CmdResult<()> {
    if path.exists() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

fn emit(app: &AppHandle, stage: &str, received: u64, total: Option<u64>) {
    let _ =
        app.emit(PROGRESS_EVENT, HostSetupProgress { received, stage: stage.to_string(), total });
}

pub fn launch_install_dir_terminal() -> CmdResult<()> {
    let directory = windows_install_dir();
    if !paths::adb_exe(&directory).is_file() {
        return Err(format!(
            "{INSTALL_DIR} does not contain adb.exe. Install platform-tools first."
        ));
    }
    #[cfg(windows)]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", "cd", "/d"])
            .arg(&directory)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = directory;
        Err("Opening a host-tools terminal is Windows-only.".into())
    }
}
