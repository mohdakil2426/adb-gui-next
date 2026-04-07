use crate::{
    CmdResult,
    emulator::{
        avd, backup,
        models::{
            RootFinalizeRequest, RootFinalizeResult, RootPreparationRequest, RootPreparationResult,
        },
        runtime,
    },
    helpers::{run_binary_command, run_binary_command_allow_output_on_failure},
};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::AppHandle;

const BOOT_MAGIC: &[u8; 8] = b"ANDROID!";
const FAKE_BOOT_PAGE_SIZE: usize = 2048;
const FAKE_BOOT_REMOTE_PATH: &str = "/sdcard/Download/fakeboot.img";

fn align_up(value: usize, alignment: usize) -> usize {
    if value == 0 { 0 } else { value.next_multiple_of(alignment) }
}

fn write_u32_le(buffer: &mut [u8], value: u32) {
    buffer.copy_from_slice(&value.to_le_bytes());
}

fn read_u32_le(bytes: &[u8], offset: usize) -> Result<u32, String> {
    let end = offset + 4;
    let slice =
        bytes.get(offset..end).ok_or_else(|| "Fake boot image header is truncated.".to_string())?;
    let mut array = [0u8; 4];
    array.copy_from_slice(slice);
    Ok(u32::from_le_bytes(array))
}

pub fn validate_root_package_path(path: &Path) -> CmdResult<()> {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some("apk") | Some("zip") => Ok(()),
        _ => Err("Root package must be .apk or .zip".into()),
    }
}

pub fn normalized_root_package_path(path: &Path) -> PathBuf {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some("zip") => {
            let stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or("root-package");
            std::env::temp_dir().join(format!("{stem}.apk"))
        }
        _ => path.to_path_buf(),
    }
}

fn normalize_root_package(path: &Path) -> CmdResult<PathBuf> {
    validate_root_package_path(path)?;
    let normalized = normalized_root_package_path(path);

    if normalized != path {
        fs::copy(path, &normalized).map_err(|error| error.to_string())?;
    }

    Ok(normalized)
}

pub fn build_fake_boot_image(ramdisk: &[u8]) -> Vec<u8> {
    let mut image = vec![0u8; FAKE_BOOT_PAGE_SIZE];
    image[..BOOT_MAGIC.len()].copy_from_slice(BOOT_MAGIC);
    write_u32_le(&mut image[8..12], 0);
    write_u32_le(&mut image[16..20], ramdisk.len() as u32);
    write_u32_le(&mut image[36..40], FAKE_BOOT_PAGE_SIZE as u32);
    image.extend_from_slice(ramdisk);
    image.resize(align_up(image.len(), FAKE_BOOT_PAGE_SIZE), 0);
    image
}

pub fn extract_ramdisk_from_fake_boot(bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.get(..BOOT_MAGIC.len()) != Some(BOOT_MAGIC.as_slice()) {
        return Err("Patched image does not start with an Android boot magic header.".into());
    }

    let kernel_size = read_u32_le(bytes, 8)? as usize;
    let ramdisk_size = read_u32_le(bytes, 16)? as usize;
    let page_size = read_u32_le(bytes, 36)? as usize;

    if page_size == 0 {
        return Err("Patched image reports an invalid page size.".into());
    }

    let ramdisk_offset = page_size + align_up(kernel_size, page_size);
    let ramdisk_end = ramdisk_offset + ramdisk_size;

    bytes
        .get(ramdisk_offset..ramdisk_end)
        .map(|slice| slice.to_vec())
        .ok_or_else(|| "Patched image does not contain a full ramdisk payload.".into())
}

fn sanitize_temp_name(value: &str) -> String {
    value.chars().map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' }).collect()
}

fn detect_root_app_package(app: &AppHandle, serial: &str) -> Option<String> {
    let output = run_binary_command_allow_output_on_failure(
        app,
        "adb",
        &["-s", serial, "shell", "pm", "list", "packages"],
    )
    .ok()?;

    output
        .lines()
        .filter_map(|line| line.trim().strip_prefix("package:"))
        .find(|package| {
            let lower = package.to_ascii_lowercase();
            lower.contains("magisk")
                || lower.contains("kitsune")
                || lower.contains("delta")
                || lower.contains("alpha")
        })
        .map(ToOwned::to_owned)
}

fn latest_patched_remote_file(app: &AppHandle, serial: &str) -> CmdResult<String> {
    let output = run_binary_command_allow_output_on_failure(
        app,
        "adb",
        &[
            "-s",
            serial,
            "shell",
            "sh",
            "-c",
            "ls -t /sdcard/Download/*magisk_patched* 2>/dev/null | head -n 1",
        ],
    )?;
    let candidate = output.trim();

    if candidate.is_empty() {
        Err("No patched fake boot image was found in /sdcard/Download.".into())
    } else {
        Ok(candidate.to_string())
    }
}

pub fn prepare_root(
    app: &AppHandle,
    request: &RootPreparationRequest,
) -> CmdResult<RootPreparationResult> {
    if !runtime::is_serial_online(app, &request.serial) {
        return Err("The selected emulator is not online over adb.".into());
    }

    let normalized_package_path = normalize_root_package(Path::new(&request.root_package_path))?;
    let avd = avd::list_avds(app)?
        .into_iter()
        .find(|item| item.name == request.avd_name)
        .ok_or_else(|| format!("AVD not found: {}", request.avd_name))?;
    let ramdisk_path = avd
        .ramdisk_path
        .clone()
        .ok_or_else(|| format!("No ramdisk found for {}", request.avd_name))?;
    let ramdisk_bytes = fs::read(&ramdisk_path).map_err(|error| error.to_string())?;
    let fake_boot = build_fake_boot_image(&ramdisk_bytes);
    let temp_name = sanitize_temp_name(&request.avd_name);
    let local_fake_boot_path = std::env::temp_dir().join(format!("{temp_name}-fakeboot.img"));

    backup::ensure_backup(Path::new(&ramdisk_path))?;
    fs::write(&local_fake_boot_path, fake_boot).map_err(|error| error.to_string())?;

    let local_fake_boot_string = local_fake_boot_path.to_string_lossy().to_string();
    let normalized_package_string = normalized_package_path.to_string_lossy().to_string();

    run_binary_command(
        app,
        "adb",
        &["-s", &request.serial, "push", &local_fake_boot_string, FAKE_BOOT_REMOTE_PATH],
    )?;
    run_binary_command(
        app,
        "adb",
        &["-s", &request.serial, "install", "-r", &normalized_package_string],
    )?;

    if let Some(package_name) = detect_root_app_package(app, &request.serial) {
        let _ = run_binary_command_allow_output_on_failure(
            app,
            "adb",
            &[
                "-s",
                &request.serial,
                "shell",
                "monkey",
                "-p",
                &package_name,
                "-c",
                "android.intent.category.LAUNCHER",
                "1",
            ],
        );
    }

    Ok(RootPreparationResult {
        normalized_package_path: normalized_package_string,
        fake_boot_remote_path: FAKE_BOOT_REMOTE_PATH.into(),
        instructions: vec![
            "Open the installed root app if it did not auto-launch.".into(),
            "Patch /sdcard/Download/fakeboot.img inside the emulator.".into(),
            "Return to Emulator Manager and press Finalize Root after patching.".into(),
        ],
    })
}

pub fn finalize_root(
    app: &AppHandle,
    request: &RootFinalizeRequest,
) -> CmdResult<RootFinalizeResult> {
    let avd = avd::list_avds(app)?
        .into_iter()
        .find(|item| item.name == request.avd_name)
        .ok_or_else(|| format!("AVD not found: {}", request.avd_name))?;
    let ramdisk_path = avd
        .ramdisk_path
        .clone()
        .ok_or_else(|| format!("No ramdisk found for {}", request.avd_name))?;
    let remote_patched_path = latest_patched_remote_file(app, &request.serial)?;
    let temp_name = sanitize_temp_name(&request.avd_name);
    let local_patched_path = std::env::temp_dir().join(format!("{temp_name}-magisk-patched.img"));
    let local_patched_string = local_patched_path.to_string_lossy().to_string();

    run_binary_command(
        app,
        "adb",
        &["-s", &request.serial, "pull", &remote_patched_path, &local_patched_string],
    )?;

    let patched_bytes = fs::read(&local_patched_path).map_err(|error| error.to_string())?;
    let patched_ramdisk = extract_ramdisk_from_fake_boot(&patched_bytes)?;
    backup::ensure_backup(Path::new(&ramdisk_path))?;
    fs::write(&ramdisk_path, patched_ramdisk).map_err(|error| error.to_string())?;

    Ok(RootFinalizeResult {
        restored_files: vec![ramdisk_path, local_patched_string],
        next_boot_recommendation: "Shut down the emulator and cold boot it from Emulator Manager."
            .into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn normalize_zip_root_package_uses_temp_apk_suffix() {
        let normalized = normalized_root_package_path(Path::new("C:/tmp/Magisk-v29.zip"));

        assert_eq!(normalized, std::env::temp_dir().join("Magisk-v29.apk"));
    }

    #[test]
    fn fake_boot_image_round_trips_ramdisk_bytes() {
        let ramdisk = b"test-ramdisk-payload";
        let fake_boot = build_fake_boot_image(ramdisk);

        assert_eq!(extract_ramdisk_from_fake_boot(&fake_boot).unwrap(), ramdisk);
    }
}
