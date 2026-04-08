use crate::{
    CmdResult,
    emulator::{
        avd, backup, magisk_download,
        magisk_package::{self, MagiskPackageContents},
        models::{
            RootAvdRequest, RootAvdResult, RootFinalizeRequest, RootFinalizeResult,
            RootPreparationRequest, RootPreparationResult, RootProgress, RootSource,
        },
        runtime,
    },
    helpers::{run_binary_command, run_binary_command_allow_output_on_failure},
};
use std::{
    fs,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter};

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOT_MAGIC: &[u8; 8] = b"ANDROID!";
const FAKE_BOOT_PAGE_SIZE: usize = 2048;
const FAKE_BOOT_REMOTE_PATH: &str = "/sdcard/Download/fakeboot.img";
const ROOT_WORKDIR: &str = "/data/local/tmp/adb-gui-root";
const TOTAL_STEPS: u8 = 8;

// ─── Progress helpers ─────────────────────────────────────────────────────────

fn emit_progress(app: &AppHandle, step: u8, label: &str, detail: Option<&str>) {
    let progress = RootProgress {
        step,
        total_steps: TOTAL_STEPS,
        label: label.to_string(),
        detail: detail.map(str::to_string),
    };
    let _ = app.emit("root:progress", &progress);
    log::info!("[root step {step}/{TOTAL_STEPS}] {label}");
}

// ─── Device property helpers ──────────────────────────────────────────────────

/// Read a single Android property from the running emulator.
fn getprop(app: &AppHandle, serial: &str, key: &str) -> CmdResult<String> {
    let output = run_binary_command_allow_output_on_failure(
        app,
        "adb",
        &["-s", serial, "shell", "getprop", key],
    )?;
    Ok(output.trim().to_string())
}

pub fn detect_emulator_abi(app: &AppHandle, serial: &str) -> CmdResult<String> {
    let abi = getprop(app, serial, "ro.product.cpu.abi")?;
    if abi.is_empty() || abi == "N/A" {
        return Err("Could not detect emulator ABI (ro.product.cpu.abi is empty).".into());
    }
    Ok(abi)
}

pub fn detect_emulator_api_level(app: &AppHandle, serial: &str) -> CmdResult<u32> {
    let level = getprop(app, serial, "ro.build.version.sdk")?;
    level.trim().parse::<u32>().map_err(|_| {
        format!("Could not parse API level from getprop ro.build.version.sdk: '{level}'")
    })
}

// ─── ADB utility wrappers ──────────────────────────────────────────────────────

fn adb_push(app: &AppHandle, serial: &str, local: &Path, remote: &str) -> CmdResult<String> {
    run_binary_command(app, "adb", &["-s", serial, "push", &local.to_string_lossy(), remote])
}

fn adb_shell(app: &AppHandle, serial: &str, cmd: &str) -> CmdResult<String> {
    run_binary_command_allow_output_on_failure(app, "adb", &["-s", serial, "shell", cmd])
}

fn adb_pull(app: &AppHandle, serial: &str, remote: &str, local: &Path) -> CmdResult<String> {
    run_binary_command(app, "adb", &["-s", serial, "pull", remote, &local.to_string_lossy()])
}

fn adb_install(app: &AppHandle, serial: &str, apk: &Path) -> CmdResult<String> {
    run_binary_command_allow_output_on_failure(
        app,
        "adb",
        &["-s", serial, "install", "-r", &apk.to_string_lossy()],
    )
}

/// Ensure the remote working directory exists and is writable.
fn adb_prepare_workdir(app: &AppHandle, serial: &str) -> CmdResult<()> {
    adb_shell(app, serial, &format!("rm -rf {ROOT_WORKDIR} && mkdir -p {ROOT_WORKDIR}"))?;
    Ok(())
}

/// Remove the remote working directory.
fn adb_cleanup_workdir(app: &AppHandle, serial: &str) {
    let _ = adb_shell(app, serial, &format!("rm -rf {ROOT_WORKDIR}"));
}

/// Run an ADB shell command with **strict exit-code checking**.
///
/// Appends `; echo EXITCODE:$?` to the command, parses the exit code from the
/// output, and returns `Err` if non-zero.  Use for every critical pipeline step.
fn adb_shell_checked(app: &AppHandle, serial: &str, cmd: &str) -> CmdResult<String> {
    let wrapped = format!("{cmd}; echo EXITCODE:$?");
    let output = adb_shell(app, serial, &wrapped)?;
    if let Some(code) = parse_exit_code(&output, "EXITCODE:")
        && code != 0
    {
        return Err(format!(
            "ADB shell command failed (exit {code}):\n  cmd: {cmd}\n  output: {output}"
        ));
    }
    Ok(output)
}

/// Verify that a remote file exists and has a non-zero size.
fn verify_remote_file(app: &AppHandle, serial: &str, path: &str) -> CmdResult<u64> {
    let size_str = adb_shell(app, serial, &format!("stat -c%s {path} 2>/dev/null || echo 0"))?;
    let size: u64 = size_str.trim().parse().unwrap_or(0);
    if size == 0 {
        return Err(format!("Expected file '{path}' is missing or empty on device"));
    }
    Ok(size)
}

/// Detect the compression method of the ramdisk by reading magic bytes on-device.
///
/// Returns one of: `"lz4_legacy"`, `"gzip"`, or `"raw"`.
fn detect_compression_method(app: &AppHandle, serial: &str) -> CmdResult<String> {
    // Try xxd first; fall back to od (some stripped Android shells lack xxd).
    let hex = adb_shell(
        app,
        serial,
        &format!(
            "xxd -p -l4 {ROOT_WORKDIR}/ramdisk.img 2>/dev/null \
             || od -A n -t x1 -N 4 {ROOT_WORKDIR}/ramdisk.img | tr -d ' \n'"
        ),
    )?
    .trim()
    .to_lowercase()
    .replace(' ', "");

    let prefix = hex.get(..8).unwrap_or("");
    match prefix {
        "02214c18" => {
            log::info!("[root] Compression detected: lz4_legacy (magic {prefix})");
            Ok("lz4_legacy".to_string())
        }
        p if p.starts_with("1f8b08") => {
            log::info!("[root] Compression detected: gzip (magic {prefix})");
            Ok("gzip".to_string())
        }
        p if p.starts_with("30373037") => {
            log::info!("[root] Compression detected: raw CPIO (magic {prefix})");
            Ok("raw".to_string())
        }
        other => Err(format!(
            "Unknown ramdisk compression (magic bytes: '{other}'). \
             Expected LZ4 (02214c18), GZ (1f8b08xx), or raw CPIO (30373037)."
        )),
    }
}

/// Poll `sys.boot_completed` until the emulator is fully booted.
/// Returns `Ok(())` on success, `Err` after `max_attempts` timeouts.
fn wait_for_boot_completed(
    app: &AppHandle,
    serial: &str,
    max_attempts: u32,
    interval: Duration,
) -> CmdResult<()> {
    for attempt in 1..=max_attempts {
        let val = getprop(app, serial, "sys.boot_completed").unwrap_or_default();
        if val.trim() == "1" {
            log::info!("[root] Boot completed (attempt {attempt}/{max_attempts})");
            return Ok(());
        }
        log::info!(
            "[root] Waiting for boot… (attempt {attempt}/{max_attempts}, got '{}')",
            val.trim()
        );
        thread::sleep(interval);
    }
    Err(format!(
        "Emulator did not finish booting within {}s. \
         Wait for the home screen, then try again.",
        max_attempts as u64 * interval.as_secs()
    ))
}

// ─── Magisk source resolution ─────────────────────────────────────────────────

/// Resolve the Magisk package path from a [`RootSource`].
/// For `LatestStable`, fetches the release metadata from GitHub and downloads the APK.
fn resolve_package_path(source: &RootSource, work_dir: &Path) -> CmdResult<PathBuf> {
    match source {
        RootSource::LocalFile { value } => {
            let p = PathBuf::from(value);
            if !p.exists() {
                return Err(format!("Root package not found: {value}"));
            }
            match p.extension().and_then(|e| e.to_str()) {
                Some("apk" | "zip") => Ok(p),
                _ => Err("Root package must be a .apk or .zip file.".into()),
            }
        }
        RootSource::LatestStable => {
            let release = magisk_download::fetch_magisk_stable_release()?;
            log::info!("Resolved latest stable Magisk: {} ({})", release.version, release.tag);
            magisk_download::download_magisk_stable(&release, work_dir)
        }
    }
}

// ─── Core automated pipeline ──────────────────────────────────────────────────

/// Run the fully automated AVD rooting pipeline.
///
/// Steps:
/// 1. Validate — AVD online, ramdisk path resolved, backup created
/// 2. Acquire package — local file or online download
/// 3. Extract binaries from Magisk APK
/// 4. Detect ABI and push binaries to emulator
/// 5. Push ramdisk image to emulator
/// 6. Patch ramdisk via `magiskboot` inside the emulator shell
/// 7. Pull patched ramdisk, write to system-image directory
/// 8. Install Magisk Manager APK, cleanup
pub fn root_avd_automated(app: &AppHandle, request: &RootAvdRequest) -> CmdResult<RootAvdResult> {
    log::info!(
        "[root] ── Starting automated root: avd='{}' serial='{}'",
        request.avd_name,
        request.serial
    );

    // ── Step 1: Validate ─────────────────────────────────────────────────────
    emit_progress(app, 1, "Validating emulator state…", None);
    log::info!("[root] Step 1 — checking ADB connectivity for serial '{}'", request.serial);

    if !runtime::is_serial_online(app, &request.serial) {
        return Err(format!(
            "Emulator '{}' is not online over ADB. Launch it first.",
            request.avd_name
        ));
    }
    log::info!("[root] Step 1 — serial '{}' is online ✓", request.serial);

    // Wait for the emulator to finish booting (home screen loaded).
    emit_progress(app, 1, "Waiting for emulator boot…", None);
    wait_for_boot_completed(app, &request.serial, 30, Duration::from_secs(2))?;
    log::info!("[root] Step 1 — boot completed ✓");

    let avd = avd::list_avds(app)?
        .into_iter()
        .find(|a| a.name == request.avd_name)
        .ok_or_else(|| format!("AVD not found: {}", request.avd_name))?;

    let ramdisk_path_str = avd
        .ramdisk_path
        .clone()
        .ok_or_else(|| format!("No ramdisk found for '{}'.", request.avd_name))?;
    let ramdisk_path = PathBuf::from(&ramdisk_path_str);

    log::info!("[root] Step 1 — ramdisk path: {ramdisk_path_str}");

    if !ramdisk_path.exists() {
        return Err(format!(
            "Ramdisk file does not exist: {}. The system image may not be installed.",
            ramdisk_path.display()
        ));
    }

    let ramdisk_size = ramdisk_path.metadata().map(|m| m.len()).unwrap_or(0);
    log::info!("[root] Step 1 — ramdisk exists, size = {ramdisk_size} bytes");

    // Create a backup before touching anything.
    backup::ensure_backup(&ramdisk_path)?;
    log::info!("[root] Step 1 — backup created: {ramdisk_path_str}.backup");
    emit_progress(app, 1, "Backup created", Some(&format!("{ramdisk_path_str}.backup")));

    // ── Step 2: Acquire package ───────────────────────────────────────────────
    emit_progress(app, 2, "Acquiring Magisk package…", None);
    log::info!("[root] Step 2 — resolving Magisk package (source type: {:?})", request.source);

    let local_work_dir =
        std::env::temp_dir().join(format!("adb-gui-root-{}", sanitize_name(&request.avd_name)));
    log::info!("[root] Step 2 — local work dir: {}", local_work_dir.display());
    fs::create_dir_all(&local_work_dir).map_err(|e| e.to_string())?;

    let package_path = resolve_package_path(&request.source, &local_work_dir)?;
    let pkg_size = package_path.metadata().map(|m| m.len()).unwrap_or(0);
    log::info!("[root] Step 2 — package ready: {} ({pkg_size} bytes)", package_path.display());
    emit_progress(
        app,
        2,
        "Package ready",
        Some(&package_path.file_name().unwrap_or_default().to_string_lossy()),
    );

    // ── Step 3: Detect ABI + extract binaries ────────────────────────────────
    emit_progress(app, 3, "Detecting emulator architecture…", None);

    let abi = match detect_emulator_abi(app, &request.serial) {
        Ok(detected) => {
            log::info!("[root] Step 3 — detected ABI: {detected}");
            detected
        }
        Err(e) => {
            log::warn!("[root] Step 3 — ABI detection failed ({e}), falling back to x86_64");
            "x86_64".to_string()
        }
    };
    emit_progress(app, 3, "Extracting Magisk binaries…", Some(&abi));

    let bin_dir = local_work_dir.join("bins");
    log::info!("[root] Step 3 — extracting binaries to {}", bin_dir.display());
    let pkg = magisk_package::extract_magisk_package(&package_path, &abi, &bin_dir)?;
    log::info!(
        "[root] Step 3 — extracted: version='{}' abi_dir='{}' magiskboot={} magiskinit={} magisk64={} busybox={} magisk32={}",
        pkg.version,
        pkg.abi_dir,
        pkg.magiskboot.display(),
        pkg.magiskinit.display(),
        pkg.magisk_binary.display(),
        pkg.busybox.display(),
        pkg.magisk32.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "n/a".into()),
    );
    emit_progress(
        app,
        3,
        "Binaries extracted",
        Some(&format!("Magisk {} ({})", pkg.version, pkg.abi_dir)),
    );

    // ── Step 4: Push binaries + ramdisk to emulator ──────────────────────────
    emit_progress(app, 4, "Pushing files to emulator…", None);
    log::info!("[root] Step 4 — preparing remote workdir: {ROOT_WORKDIR}");

    adb_prepare_workdir(app, &request.serial)?;

    log::info!("[root] Step 4 — pushing magiskboot");
    adb_push(app, &request.serial, &pkg.magiskboot, &format!("{ROOT_WORKDIR}/magiskboot"))?;

    log::info!("[root] Step 4 — pushing magiskinit");
    adb_push(app, &request.serial, &pkg.magiskinit, &format!("{ROOT_WORKDIR}/magiskinit"))?;

    log::info!("[root] Step 4 — pushing magisk64");
    adb_push(app, &request.serial, &pkg.magisk_binary, &format!("{ROOT_WORKDIR}/magisk64"))?;

    if let Some(mg32) = &pkg.magisk32 {
        log::info!("[root] Step 4 — pushing magisk32");
        adb_push(app, &request.serial, mg32, &format!("{ROOT_WORKDIR}/magisk32"))?;
    }

    log::info!("[root] Step 4 — pushing busybox");
    adb_push(app, &request.serial, &pkg.busybox, &format!("{ROOT_WORKDIR}/busybox"))?;

    if let Some(stub) = &pkg.stub_apk {
        log::info!("[root] Step 4 — pushing stub.apk");
        adb_push(app, &request.serial, stub, &format!("{ROOT_WORKDIR}/stub.apk"))?;
    }

    log::info!("[root] Step 4 — pushing ramdisk.img ({ramdisk_size} bytes)");
    adb_push(app, &request.serial, &ramdisk_path, &format!("{ROOT_WORKDIR}/ramdisk.img"))?;

    log::info!("[root] Step 4 — chmod 755 on all workdir files");
    adb_shell(app, &request.serial, &format!("chmod 755 {ROOT_WORKDIR}/*"))?;
    emit_progress(app, 4, "Files pushed", None);

    // ── Step 5: Patch ramdisk via magiskboot ──────────────────────────────────
    emit_progress(app, 5, "Patching ramdisk…", None);
    log::info!("[root] Step 5 — starting magiskboot ramdisk patch sequence");

    let patch_result = patch_ramdisk_in_emulator(app, &request.serial, &pkg);
    if let Err(ref e) = patch_result {
        log::error!("[root] Step 5 — patching failed: {e}");
        adb_cleanup_workdir(app, &request.serial);
        return Err(format!("Ramdisk patching failed: {e}"));
    }
    log::info!("[root] Step 5 — ramdisk patched ✓");
    emit_progress(app, 5, "Ramdisk patched", None);

    // ── Step 6: Pull patched ramdisk ──────────────────────────────────────────
    emit_progress(app, 6, "Pulling patched ramdisk…", None);
    log::info!("[root] Step 6 — pulling {ROOT_WORKDIR}/ramdiskpatched.img");

    let local_patched = local_work_dir.join("ramdiskpatched.img");
    adb_pull(app, &request.serial, &format!("{ROOT_WORKDIR}/ramdiskpatched.img"), &local_patched)?;

    if !local_patched.exists() || fs::metadata(&local_patched).map(|m| m.len()).unwrap_or(0) == 0 {
        adb_cleanup_workdir(app, &request.serial);
        return Err("Pulled ramdisk is empty or missing — patching may have failed.".into());
    }
    let patched_size = local_patched.metadata().map(|m| m.len()).unwrap_or(0);
    log::info!("[root] Step 6 — pulled patched ramdisk: {patched_size} bytes");
    emit_progress(app, 6, "Ramdisk pulled", Some(&format!("{patched_size} bytes")));

    // ── Step 7: Write patched ramdisk + stop emulator ─────────────────────────
    emit_progress(app, 7, "Installing patched ramdisk…", None);
    log::info!("[root] Step 7 — writing patched ramdisk → {ramdisk_path_str}");

    fs::copy(&local_patched, &ramdisk_path)
        .map_err(|e| format!("Failed to write patched ramdisk to {ramdisk_path_str}: {e}"))?;
    log::info!("[root] Step 7 — ramdisk installed ✓");

    // Stop the emulator so any running snapshot doesn't overwrite the patched ramdisk.
    emit_progress(
        app,
        7,
        "Stopping emulator…",
        Some("Ensures clean cold boot with patched ramdisk"),
    );
    log::info!("[root] Step 7 — stopping emulator to prevent snapshot re-save");
    let _ = adb_shell(app, &request.serial, "setprop sys.powerctl shutdown");
    thread::sleep(Duration::from_secs(3));
    log::info!("[root] Step 7 — emulator stop signal sent ✓");
    emit_progress(app, 7, "Ramdisk installed & emulator stopped", Some(&ramdisk_path_str));

    // ── Step 8: Install Magisk Manager + cleanup ──────────────────────────────
    // The emulator may already be offline at this point.  Try to install the manager
    // APK — if the emulator shut down too fast, we skip it (user can install on cold boot).
    emit_progress(app, 8, "Installing Magisk Manager…", None);
    log::info!("[root] Step 8 — installing Magisk Manager APK: {}", pkg.magisk_apk.display());

    let manager_installed = if runtime::is_serial_online(app, &request.serial) {
        match adb_install(app, &request.serial, &pkg.magisk_apk) {
            Ok(output) => {
                log::info!("[root] Step 8 — APK install success: {output}");
                true
            }
            Err(e) => {
                log::warn!("[root] Step 8 — APK install failed (non-fatal): {e}");
                false
            }
        }
    } else {
        log::info!(
            "[root] Step 8 — emulator already offline, skipping APK install (will install on cold boot)"
        );
        false
    };

    if runtime::is_serial_online(app, &request.serial) {
        adb_cleanup_workdir(app, &request.serial);
    }
    log::info!("[root] Step 8 — cleanup done. managerInstalled={manager_installed}");
    log::info!("[root] ── Root pipeline complete ✓ (Magisk {})", pkg.version);
    emit_progress(app, 8, "Root complete!", Some("Cold boot the emulator to activate Magisk."));

    Ok(RootAvdResult {
        magisk_version: pkg.version.clone(),
        patched_ramdisk_path: ramdisk_path_str,
        manager_installed,
    })
}

/// Execute the `magiskboot` ramdisk patching sequence inside the emulator shell.
///
/// Full rootAVD-aligned pipeline:
/// 1. Detect ramdisk compression method (magic bytes)
/// 2. Decompress ramdisk → raw CPIO (with validation)
/// 3. Test patch status
/// 4. Compute SHA1 hash for config
/// 5. Write config file (KEEPVERITY / KEEPFORCEENCRYPT / SHA1)
/// 6. XZ-compress magisk binaries + stub.apk
/// 7. Patch CPIO with `magiskinit`, `magiskXX.xz`, `stub.xz`
/// 8. Re-compress CPIO with **original** method
fn patch_ramdisk_in_emulator(
    app: &AppHandle,
    serial: &str,
    pkg: &MagiskPackageContents,
) -> CmdResult<()> {
    let mb = format!("{ROOT_WORKDIR}/magiskboot");

    // 1. Detect the original compression method from magic bytes.
    let compress_method = detect_compression_method(app, serial)?;

    // 2. Decompress ramdisk → ramdisk.cpio.
    //    For raw CPIO (no compression), just rename.
    if compress_method == "raw" {
        adb_shell_checked(
            app,
            serial,
            &format!("cp {ROOT_WORKDIR}/ramdisk.img {ROOT_WORKDIR}/ramdisk.cpio"),
        )?;
    } else {
        adb_shell_checked(
            app,
            serial,
            &format!("{mb} decompress {ROOT_WORKDIR}/ramdisk.img {ROOT_WORKDIR}/ramdisk.cpio"),
        )?;
    }

    // Verify the CPIO was created and is non-empty.
    let cpio_size = verify_remote_file(app, serial, &format!("{ROOT_WORKDIR}/ramdisk.cpio"))?;
    log::info!("[root] Decompressed ramdisk.cpio size: {cpio_size} bytes");

    // 3. Test ramdisk patch status (exit code: 0=stock, 1=patched, 2=unsupported).
    let status_output = adb_shell(
        app,
        serial,
        &format!("{mb} cpio {ROOT_WORKDIR}/ramdisk.cpio test; echo exit:$?"),
    )
    .unwrap_or_default();

    let status_code = parse_exit_code(&status_output, "exit:").unwrap_or(0);
    if status_code == 2 {
        return Err(
            "Ramdisk was patched by an unsupported tool. Restore stock ramdisk first.".into()
        );
    }
    log::info!("[root] Ramdisk patch status: {status_code} (0=stock, 1=magisk, &4=compressed)");

    // 4. Compute SHA1 hash of the CPIO (used by Magisk boot verification on stock images).
    let sha1 = if status_code == 0 {
        adb_shell(app, serial, &format!("{mb} sha1 {ROOT_WORKDIR}/ramdisk.cpio"))
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty() && s.len() >= 40)
    } else {
        None
    };
    if let Some(ref hash) = sha1 {
        log::info!("[root] Ramdisk SHA1: {hash}");
    }

    // 5. Write Magisk config file.
    let mut config = String::from("KEEPVERITY=true\nKEEPFORCEENCRYPT=true\nRECOVERYMODE=false");
    if let Some(ref hash) = sha1 {
        config.push_str(&format!("\nSHA1={hash}"));
    }
    adb_shell_checked(app, serial, &format!("printf '%s\\n' '{config}' > {ROOT_WORKDIR}/config"))?;

    // 6. XZ-compress magisk binaries to save ramdisk space.
    let has_magisk32 = pkg.magisk32.is_some();
    let is_64bit = magisk_package::is_64bit_abi(&pkg.abi_dir);
    let has_stub = pkg.stub_apk.is_some();

    if is_64bit {
        adb_shell_checked(
            app,
            serial,
            &format!("{mb} compress=xz {ROOT_WORKDIR}/magisk64 {ROOT_WORKDIR}/magisk64.xz"),
        )?;
    }
    if has_magisk32 {
        adb_shell_checked(
            app,
            serial,
            &format!("{mb} compress=xz {ROOT_WORKDIR}/magisk32 {ROOT_WORKDIR}/magisk32.xz"),
        )?;
    }
    if has_stub {
        adb_shell_checked(
            app,
            serial,
            &format!("{mb} compress=xz {ROOT_WORKDIR}/stub.apk {ROOT_WORKDIR}/stub.xz"),
        )?;
        log::info!("[root] stub.apk compressed to stub.xz ✓");
    }

    // 7. Patch CPIO: create overlay dirs, add init + binaries + stub, run patch, create .backup.
    let skip32 = if has_magisk32 { "" } else { "#" };
    let skip64 = if is_64bit { "" } else { "#" };
    let skip_stub = if has_stub { "" } else { "#" };

    // Create overlay directories.
    adb_shell_checked(
        app,
        serial,
        &format!(
            "{mb} cpio {ROOT_WORKDIR}/ramdisk.cpio \\
             'mkdir 0750 overlay.d' \\
             'mkdir 0750 overlay.d/sbin'"
        ),
    )?;

    // Add init, binaries, stub, apply patch, create backup.
    let patch_cmd = format!(
        "{mb} cpio {ROOT_WORKDIR}/ramdisk.cpio \
         'add 0750 init {ROOT_WORKDIR}/magiskinit' \
         '{skip64} add 0644 overlay.d/sbin/magisk64.xz {ROOT_WORKDIR}/magisk64.xz' \
         '{skip32} add 0644 overlay.d/sbin/magisk32.xz {ROOT_WORKDIR}/magisk32.xz' \
         '{skip_stub} add 0644 overlay.d/sbin/stub.xz {ROOT_WORKDIR}/stub.xz' \
         'patch' \
         'backup {ROOT_WORKDIR}/ramdisk.cpio.orig' \
         'mkdir 000 .backup' \
         'add 000 .backup/.magisk {ROOT_WORKDIR}/config'"
    );
    adb_shell_checked(app, serial, &patch_cmd)?;

    // 8. Re-compress CPIO if the status flag indicates compressed ramdisk.
    if status_code & 4 != 0 {
        adb_shell_checked(app, serial, &format!("{mb} cpio {ROOT_WORKDIR}/ramdisk.cpio compress"))?;
    }

    // 9. Repack CPIO back to ramdisk image using the ORIGINAL compression method.
    if compress_method == "raw" {
        // Raw CPIO — just rename, no compression.
        adb_shell_checked(
            app,
            serial,
            &format!("cp {ROOT_WORKDIR}/ramdisk.cpio {ROOT_WORKDIR}/ramdiskpatched.img"),
        )?;
    } else {
        adb_shell_checked(
            app,
            serial,
            &format!(
                "{mb} compress={compress_method} {ROOT_WORKDIR}/ramdisk.cpio {ROOT_WORKDIR}/ramdiskpatched.img"
            ),
        )?;
    }

    // Verify the output file.
    let patched_size =
        verify_remote_file(app, serial, &format!("{ROOT_WORKDIR}/ramdiskpatched.img"))?;
    log::info!("[root] Patched ramdisk size: {patched_size} bytes (method={compress_method})");

    Ok(())
}

/// Parse `exit:<code>` from an ADB shell command output.
fn parse_exit_code(output: &str, marker: &str) -> Option<u32> {
    output.lines().find_map(|line| line.strip_prefix(marker)).and_then(|s| s.trim().parse().ok())
}

fn sanitize_name(value: &str) -> String {
    value.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect()
}

// ─── Legacy manual root (FAKEBOOTIMG) — kept as fallback ─────────────────────

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

/// Manual (legacy) root preparation — FAKEBOOTIMG fallback.
/// Kept for users who prefer the Magisk App patching workflow.
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
    let temp_name = sanitize_name(&request.avd_name);
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

/// Manual (legacy) root finalization — FAKEBOOTIMG fallback.
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
    let temp_name = sanitize_name(&request.avd_name);
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

// ─── Tests ────────────────────────────────────────────────────────────────────

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

    #[test]
    fn parse_exit_code_from_composite_output() {
        let output = "some magiskboot output\nexit:1\n";
        assert_eq!(parse_exit_code(output, "exit:"), Some(1));
    }

    #[test]
    fn parse_exit_code_returns_none_when_missing() {
        assert_eq!(parse_exit_code("no marker here", "exit:"), None);
    }
}
