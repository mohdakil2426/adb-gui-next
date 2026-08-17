// Build scripts: set_var is unsafe in Rust 2024; protoc path is fixed before prost runs.
#![allow(unsafe_code)]
#![allow(clippy::expect_used)]

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::process::Command;
#[cfg(windows)]
use std::time::Duration;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn main() {
    let proto = "update_metadata.proto";
    println!("cargo::rustc-check-cfg=cfg(rust_analyzer)");
    println!("cargo:rerun-if-changed={proto}");
    let protoc = protoc_bin_vendored::protoc_bin_path().expect("failed to find protoc");
    // SAFETY: build script is single-threaded; PROTOC is only read by prost-build next.
    unsafe {
        std::env::set_var("PROTOC", protoc);
    }
    prost_build::Config::new()
        .compile_protos(&[proto], &["."])
        .expect("failed to compile payload protobuf");

    #[cfg(windows)]
    release_locked_platform_tools();

    if let Err(error) = tauri_build::try_build(tauri_build::Attributes::default()) {
        #[cfg(windows)]
        if is_sharing_violation(&error) {
            release_locked_platform_tools();
            std::thread::sleep(Duration::from_millis(250));
            if tauri_build::try_build(tauri_build::Attributes::default()).is_ok() {
                return;
            }
        }
        let error = format!("{error:#}");
        println!("{error}");
        std::process::exit(1);
    }
}

#[cfg(windows)]
fn is_sharing_violation(error: &impl std::fmt::Display) -> bool {
    let text = error.to_string();
    text.contains("os error 32") || text.contains("being used by another process")
}

/// `OUT_DIR` is `target/<triple?>/<profile>/build/<crate>/out` — three parents is the profile dir
/// where Tauri copies `bundle.resources` (`AdbWinApi.dll` next to `adb.exe`).
#[cfg(windows)]
fn cargo_profile_dir() -> Option<PathBuf> {
    let out = PathBuf::from(std::env::var_os("OUT_DIR")?);
    out.ancestors().nth(3).map(Path::to_path_buf)
}

#[cfg(windows)]
fn release_locked_platform_tools() {
    let Some(profile_dir) = cargo_profile_dir() else {
        return;
    };
    let adb_candidates = [
        profile_dir.join("adb.exe"),
        profile_dir.join("resources").join("windows").join("adb.exe"),
    ];
    if let Some(adb) = adb_candidates.iter().find(|path| path.exists()) {
        let _ = Command::new(adb).arg("kill-server").creation_flags(CREATE_NO_WINDOW).status();
        std::thread::sleep(Duration::from_millis(150));
    }

    // `adb kill-server` is not enough if a leftover `target/.../adb.exe` still has the DLL mapped.
    stop_processes_under(&profile_dir, &["adb"]);
}

#[cfg(windows)]
fn stop_processes_under(dir: &Path, image_stems: &[&str]) {
    let dir_prefix = dir.to_string_lossy().replace('\'', "''");
    let names = image_stems.join(",");
    let script = format!(
        "Get-Process -Name {names} -ErrorAction SilentlyContinue | \
         Where-Object {{ $_.Path -and $_.Path.StartsWith('{dir_prefix}', [StringComparison]::OrdinalIgnoreCase) }} | \
         Stop-Process -Force"
    );
    let _ = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}
