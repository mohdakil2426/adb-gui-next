use crate::{
    CmdResult,
    emulator::{models::EmulatorLaunchOptions, sdk},
    helpers::{
        binary_working_directory, resolve_binary_path, run_binary_command,
        run_binary_command_allow_output_on_failure,
    },
};
use std::{collections::HashMap, process::Command};
use tauri::AppHandle;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn build_launch_args(name: &str, options: &EmulatorLaunchOptions) -> Vec<String> {
    let mut args = vec![format!("@{name}")];

    if options.writable_system {
        args.push("-writable-system".into());
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
    if options.wipe_data {
        args.push("-wipe-data".into());
    }

    args
}

pub fn parse_adb_devices(output: &str) -> Vec<(String, String)> {
    output
        .lines()
        .skip(1)
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }

            let mut parts = trimmed.split_whitespace();
            let serial = parts.next()?.to_string();
            let status = parts.next()?.to_string();
            Some((serial, status))
        })
        .collect()
}

pub fn parse_emu_avd_name_output(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && *line != "OK")
        .map(ToOwned::to_owned)
}

pub fn map_runtime_avd_names(
    adb_devices_output: &str,
    emu_name_by_serial: &[(String, Result<String, String>)],
) -> HashMap<String, String> {
    let online_serials: Vec<String> = parse_adb_devices(adb_devices_output)
        .into_iter()
        .filter(|(serial, status)| serial.starts_with("emulator-") && status == "device")
        .map(|(serial, _)| serial)
        .collect();

    emu_name_by_serial
        .iter()
        .filter(|(serial, _)| online_serials.iter().any(|candidate| candidate == serial))
        .filter_map(|(serial, result)| {
            result.as_ref().ok().map(|name| (name.clone(), serial.clone()))
        })
        .collect()
}

pub fn runtime_avd_names(app: &AppHandle) -> CmdResult<HashMap<String, String>> {
    let adb_devices_output = run_binary_command_allow_output_on_failure(app, "adb", &["devices"])?;
    let emulator_serials: Vec<String> = parse_adb_devices(&adb_devices_output)
        .into_iter()
        .filter(|(serial, status)| serial.starts_with("emulator-") && status == "device")
        .map(|(serial, _)| serial)
        .collect();

    let emu_name_by_serial: Vec<(String, Result<String, String>)> = emulator_serials
        .iter()
        .map(|serial| {
            let resolved = run_binary_command_allow_output_on_failure(
                app,
                "adb",
                &["-s", serial, "emu", "avd", "name"],
            )
            .map(|output| {
                parse_emu_avd_name_output(&output)
                    .ok_or_else(|| "Unable to map emulator serial to AVD name.".to_string())
            })
            .and_then(|value| value);
            (serial.clone(), resolved)
        })
        .collect();

    Ok(map_runtime_avd_names(&adb_devices_output, &emu_name_by_serial))
}

pub fn is_serial_online(app: &AppHandle, serial: &str) -> bool {
    run_binary_command_allow_output_on_failure(app, "adb", &["devices"])
        .ok()
        .map(|output| {
            parse_adb_devices(&output)
                .into_iter()
                .any(|(candidate, status)| candidate == serial && status == "device")
        })
        .unwrap_or(false)
}

pub fn is_serial_rooted(app: &AppHandle, serial: &str) -> bool {
    run_binary_command(app, "adb", &["-s", serial, "shell", "su", "-c", "id -u"])
        .ok()
        .as_deref()
        .map(str::trim)
        == Some("0")
}

pub fn launch_avd(
    app: &AppHandle,
    avd_name: &str,
    options: &EmulatorLaunchOptions,
) -> CmdResult<String> {
    // Prefer the SDK-installed emulator over the Tauri-bundled binary (emulator is not bundled).
    // Falls back to resolve_binary_path (PATH) if the SDK location cannot be determined.
    let binary = sdk::resolve_emulator_binary_from_current_env()
        .or_else(|| resolve_binary_path(app, "emulator").ok())
        .ok_or_else(|| {
            "Android emulator not found. Install Android Studio SDK or add emulator/ to PATH."
                .to_string()
        })?;

    let mut command = Command::new(&binary);
    command.args(build_launch_args(avd_name, options));

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    // Use the emulator binary's own directory as the working directory.
    // The emulator binary requires its siblings (e.g. qemu-system-x86_64) to be present.
    if let Some(workdir) = binary.parent() {
        command.current_dir(workdir);
    } else if let Some(workdir) = binary_working_directory(Some(app)) {
        command.current_dir(workdir);
    }

    let mut child = command.spawn().map_err(|error| error.to_string())?;

    // Give the emulator 1 second to detect immediate startup failures
    // (wrong API, missing HAXM, corrupt AVD, etc.).
    std::thread::sleep(std::time::Duration::from_millis(1000));
    match child.try_wait() {
        Ok(Some(status)) => {
            return Err(format!(
                "Emulator exited immediately (exit status: {status}). Check AVD config or BIOS virtualisation settings."
            ));
        }
        Ok(None) => {} // still running — good
        Err(_) => {}   // try_wait failed — ignore, process state unknown
    }

    Ok(format!("Launched emulator for AVD: {avd_name}"))
}

pub fn stop_avd(app: &AppHandle, serial: &str) -> CmdResult<String> {
    run_binary_command_allow_output_on_failure(app, "adb", &["-s", serial, "emu", "kill"])?;
    Ok(format!("Stopped {serial}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::emulator::models::EmulatorLaunchOptions;

    #[test]
    fn build_launch_args_adds_cold_boot_flags() {
        let args = build_launch_args(
            "Pixel_8_API_34",
            &EmulatorLaunchOptions {
                wipe_data: false,
                writable_system: true,
                cold_boot: true,
                no_snapshot_load: true,
                no_snapshot_save: true,
                no_boot_anim: true,
            },
        );

        assert_eq!(
            args,
            vec![
                "@Pixel_8_API_34",
                "-writable-system",
                "-no-snapshot-load",
                "-no-snapshot-save",
                "-no-boot-anim",
            ]
        );
    }

    #[test]
    fn map_running_avd_names_from_adb_outputs() {
        let adb_devices =
            "List of devices attached\nemulator-5554\tdevice\nemulator-5556\toffline\n";
        let emu_name_by_serial = vec![
            ("emulator-5554".to_string(), Ok("Pixel_8_API_34".to_string())),
            ("emulator-5556".to_string(), Ok("Pixel_7_API_33".to_string())),
        ];

        let mappings = map_runtime_avd_names(adb_devices, &emu_name_by_serial);

        assert_eq!(mappings.get("Pixel_8_API_34").map(String::as_str), Some("emulator-5554"));
        assert_eq!(mappings.get("Pixel_7_API_33"), None);
    }
}
