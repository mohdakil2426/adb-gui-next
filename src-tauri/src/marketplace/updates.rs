use std::collections::HashMap;
use tauri::AppHandle;

use crate::CmdResult;
use crate::commands::run_adb_for_serial;
use crate::marketplace::types::AppUpdateCandidate;

struct KnownAppInfo {
    app_name: &'static str,
    latest_version: &'static str,
    source: &'static str,
    download_url: &'static str,
    changelog: &'static str,
    icon_url: Option<&'static str>,
}

static KNOWN_APPS: &[(&str, KnownAppInfo)] = &[
    (
        "com.termux",
        KnownAppInfo {
            app_name: "Termux",
            latest_version: "v0.118.1",
            source: "GitHub",
            download_url: "https://github.com/termux/termux-app/releases/latest/download/termux-app_v0.118.1+github-debug_arm64-v8a.apk",
            changelog: "Terminal rendering enhancements, package repository sync updates, and Android 14+ process lifecycle fixes.",
            icon_url: Some(
                "https://raw.githubusercontent.com/termux/termux-app/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
            ),
        },
    ),
    (
        "moe.shizuku.privileged.api",
        KnownAppInfo {
            app_name: "Shizuku",
            latest_version: "v13.5.4",
            source: "GitHub",
            download_url: "https://github.com/RikkaApps/Shizuku/releases/latest/download/shizuku-v13.5.4.r1046.06c4b22-release.apk",
            changelog: "Fix service binder connection timeout on Samsung One UI 6 and Pixel Android 15 previews.",
            icon_url: Some(
                "https://raw.githubusercontent.com/RikkaApps/Shizuku/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
            ),
        },
    ),
    (
        "com.topjohnwu.magisk",
        KnownAppInfo {
            app_name: "Magisk",
            latest_version: "v27.0",
            source: "GitHub",
            download_url: "https://github.com/topjohnwu/Magisk/releases/latest/download/Magisk-v27.0.apk",
            changelog: "Native 64-bit zygisk injection improvements, updated magiskboot ramdisk repacking engine.",
            icon_url: Some(
                "https://raw.githubusercontent.com/topjohnwu/Magisk/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
            ),
        },
    ),
    (
        "app.revanced.manager.flutter",
        KnownAppInfo {
            app_name: "ReVanced Manager",
            latest_version: "v1.21.0",
            source: "GitHub",
            download_url: "https://github.com/ReVanced/revanced-manager/releases/latest/download/revanced-manager-v1.21.0.apk",
            changelog: "Added new patch bundle engine, improved APK split merger and keystore manager.",
            icon_url: Some(
                "https://raw.githubusercontent.com/ReVanced/revanced-manager/main/assets/images/logo.png",
            ),
        },
    ),
    (
        "ch.deletescape.lawnchair.plah",
        KnownAppInfo {
            app_name: "Lawnchair 14",
            latest_version: "v14-beta2",
            source: "GitHub",
            download_url: "https://github.com/LawnchairLauncher/lawnchair/releases/latest/download/Lawnchair.apk",
            changelog: "Pixel Launcher 14 port with Smartspacer integration, At a Glance fixes, and icon shape styling.",
            icon_url: None,
        },
    ),
    (
        "proton.android.pass",
        KnownAppInfo {
            app_name: "Proton Pass",
            latest_version: "v1.22.0",
            source: "F-Droid",
            download_url: "https://github.com/protonpass/android-pass/releases/latest/download/ProtonPass.apk",
            changelog: "Autofill service optimization, passkey biometric authentication support, and encrypted vault syncing.",
            icon_url: None,
        },
    ),
    (
        "piped.pipepipe",
        KnownAppInfo {
            app_name: "PipePipe",
            latest_version: "v3.7.0",
            source: "GitHub",
            download_url: "https://github.com/InfinityLoop1309/PipePipe/releases/latest/download/PipePipe.apk",
            changelog: "Extractor API update for 1080p60 streams, background player battery optimization.",
            icon_url: None,
        },
    ),
    (
        "com.pittvandewitt.viperfx",
        KnownAppInfo {
            app_name: "ViPER4Android FX",
            latest_version: "v2.7.2.1",
            source: "GitHub",
            download_url: "https://github.com/v4a-re/ViPER4Android-FX/releases/latest/download/ViPER4AndroidFX.apk",
            changelog: "DSP convolver algorithm update and dynamic sample rate switching stability.",
            icon_url: None,
        },
    ),
];

fn parse_package_version(output: &str) -> (String, Option<i64>) {
    let mut version_name = String::new();
    let mut version_code = None;

    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("versionName=") {
            if version_name.is_empty() {
                version_name = rest.trim().to_string();
            }
        } else if let Some(rest) = trimmed.strip_prefix("versionCode=")
            && version_code.is_none()
        {
            let code_str = rest.split_whitespace().next().unwrap_or("");
            version_code = code_str.parse::<i64>().ok();
        }
    }

    (version_name, version_code)
}

pub fn marketplace_check_updates(
    app: AppHandle,
    serial: Option<String>,
) -> CmdResult<Vec<AppUpdateCandidate>> {
    let mut candidates = Vec::new();
    let mut installed_map: HashMap<String, (String, Option<i64>)> = HashMap::new();

    // Query installed packages from device if available
    let pm_output =
        run_adb_for_serial(&app, serial.as_deref(), &["shell", "pm", "list", "packages", "-3"])
            .ok();

    if let Some(output) = pm_output {
        let package_names: Vec<String> = output
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim();
                trimmed.strip_prefix("package:").map(|p| p.trim().to_string())
            })
            .collect();

        for pkg in &package_names {
            if let Ok(dump) = run_adb_for_serial(
                &app,
                serial.as_deref(),
                &["shell", "dumpsys", "package", pkg.as_str()],
            ) {
                let (ver_name, ver_code) = parse_package_version(&dump);
                installed_map.insert(pkg.clone(), (ver_name, ver_code));
            }
        }
    }

    // Match with known catalog
    for (pkg, info) in KNOWN_APPS {
        let (current_version, current_code) = if let Some((v, c)) = installed_map.get(*pkg) {
            (v.clone(), *c)
        } else {
            // Not installed or device offline — show catalog default installed version baseline
            (String::new(), None)
        };

        let has_update =
            if current_version.is_empty() { true } else { current_version != info.latest_version };

        candidates.push(AppUpdateCandidate {
            package_name: (*pkg).to_string(),
            app_name: info.app_name.to_string(),
            current_version: if current_version.is_empty() {
                "Not Installed".to_string()
            } else {
                current_version
            },
            latest_version: info.latest_version.to_string(),
            current_version_code: current_code,
            latest_version_code: None,
            source: info.source.to_string(),
            download_url: Some(info.download_url.to_string()),
            changelog: Some(info.changelog.to_string()),
            has_update,
            icon_url: info.icon_url.map(ToString::to_string),
        });
    }

    Ok(candidates)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_package_version() {
        let sample = "
        Packages:
          Package [com.termux] (2b42911):
            userId=10189
            pkg=Package{8e847c com.termux}
            codePath=/data/app/~~.../com.termux-...
            resourcePath=/data/app/~~.../com.termux-...
            legacyNativeLibraryDir=/data/app/~~.../com.termux-.../lib
            extractNativeLibs=false
            primaryCpuAbi=arm64-v8a
            timeStamp=2024-01-01 12:00:00
            firstInstallTime=2024-01-01 12:00:00
            lastUpdateTime=2024-01-01 12:00:00
            versionCode=118 minSdk=24 targetSdk=28
            versionName=v0.118.1
        ";
        let (name, code) = parse_package_version(sample);
        assert_eq!(name, "v0.118.1");
        assert_eq!(code, Some(118));
    }

    #[test]
    fn test_known_apps_validity() {
        assert_eq!(KNOWN_APPS.len(), 8);
        for (pkg, info) in KNOWN_APPS {
            assert!(!pkg.is_empty());
            assert!(!info.app_name.is_empty());
            assert!(!info.latest_version.is_empty());
            assert!(info.download_url.starts_with("https://"));
        }
    }
}
