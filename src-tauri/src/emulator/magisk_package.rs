use crate::CmdResult;
use std::{
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
};
use zip::ZipArchive;

// ─── ABI helpers ─────────────────────────────────────────────────────────────

/// Map `ro.product.cpu.abi` getprop output to the Magisk `lib/` subdirectory name.
pub fn abi_to_lib_dir(abi: &str) -> &'static str {
    match abi.trim() {
        "arm64-v8a" => "arm64-v8a",
        "armeabi-v7a" | "armeabi" => "armeabi-v7a",
        "x86_64" => "x86_64",
        "x86" => "x86",
        _ => "x86_64", // safe default for most AVDs
    }
}

/// Precedence list of ABI directories to try when the primary one is missing.
pub fn abi_fallback_dirs(abi: &str) -> Vec<&'static str> {
    match abi.trim() {
        "x86_64" => vec!["x86_64", "x86"],
        "arm64-v8a" => vec!["arm64-v8a", "armeabi-v7a"],
        "x86" => vec!["x86"],
        "armeabi-v7a" | "armeabi" => vec!["armeabi-v7a"],
        _ => vec!["x86_64", "x86"],
    }
}

/// Returns true if the ABI is 64-bit.
pub fn is_64bit_abi(abi: &str) -> bool {
    matches!(abi.trim(), "x86_64" | "arm64-v8a")
}

// ─── Extracted package contents ───────────────────────────────────────────────

/// All binaries extracted from a Magisk APK/ZIP ready for ADB upload.
#[derive(Debug, Clone)]
pub struct MagiskPackageContents {
    /// The working directory that holds all extracted files.
    pub work_dir: PathBuf,
    /// `magiskboot` binary (ramdisk patcher).
    pub magiskboot: PathBuf,
    /// `magiskinit` binary (init replacement).
    pub magiskinit: PathBuf,
    /// Primary magisk daemon binary (`magisk64` or `magisk32`).
    pub magisk_binary: PathBuf,
    /// Secondary magisk daemon binary (`magisk32`) — `None` for 32-bit-only ABIs.
    pub magisk32: Option<PathBuf>,
    /// BusyBox multicall binary.
    pub busybox: PathBuf,
    /// `stub.apk` asset (optional, used by newer Magisk builds).
    pub stub_apk: Option<PathBuf>,
    /// `Magisk.apk` copy ready for `adb install`.
    pub magisk_apk: PathBuf,
    /// Parsed Magisk version string (e.g. `"28.1"`).
    pub version: String,
    /// Numeric Magisk version code.
    pub version_code: String,
    /// The ABI directory that was used (e.g. `"x86_64"`).
    pub abi_dir: String,
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/// Open a ZIP archive at `path`, tolerating the different MIME types
/// used by `.apk` vs `.zip` packages — they are identical at the byte level.
fn open_zip(path: &Path) -> CmdResult<ZipArchive<fs::File>> {
    let file = fs::File::open(path)
        .map_err(|error| format!("Cannot open Magisk package '{}': {error}", path.display()))?;
    ZipArchive::new(file)
        .map_err(|error| format!("'{}' is not a valid ZIP/APK archive: {error}", path.display()))
}

/// Extract a single file by name from `archive` to `dest`, returning the
/// destination path. Creates parent directories as needed.
fn extract_entry(
    archive: &mut ZipArchive<fs::File>,
    name: &str,
    dest: &Path,
) -> CmdResult<PathBuf> {
    let mut entry = archive
        .by_name(name)
        .map_err(|_| format!("Entry '{name}' not found inside Magisk package"))?;
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let dest_path = dest.join(entry.mangled_name().file_name().unwrap_or_default());
    let mut out = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
    Ok(dest_path)
}

/// Try to extract a lib binary (`lib/{abi_dir}/lib{name}.so`) and rename it
/// to `{name}` (dropping the `lib` prefix and `.so` suffix) in `dest_dir`.
fn extract_lib_binary(
    archive: &mut ZipArchive<fs::File>,
    abi_dir: &str,
    name: &str,
    dest_dir: &Path,
) -> CmdResult<PathBuf> {
    extract_lib_binary_as(archive, abi_dir, name, name, dest_dir)
}

/// Like [`extract_lib_binary`] but extracts `lib/{abi_dir}/lib{src_name}.so`
/// and saves it as `{dest_name}` — useful when the library was renamed between
/// Magisk versions (e.g. `libmagisk.so` → saved as `magisk64`).
fn extract_lib_binary_as(
    archive: &mut ZipArchive<fs::File>,
    abi_dir: &str,
    src_name: &str,
    dest_name: &str,
    dest_dir: &Path,
) -> CmdResult<PathBuf> {
    let zip_entry_name = format!("lib/{abi_dir}/lib{src_name}.so");
    let mut entry = archive
        .by_name(&zip_entry_name)
        .map_err(|_| format!("Missing binary '{zip_entry_name}' in Magisk package"))?;
    let dest_path = dest_dir.join(dest_name);
    let mut out = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
    make_executable(&dest_path)?;
    Ok(dest_path)
}

/// Make `magiskboot` executable on Unix; no-op on Windows (ADB handles perms).
fn make_executable(path: &Path) -> CmdResult<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(path, perms).map_err(|e| e.to_string())?;
    }
    let _ = path;
    Ok(())
}

/// Parse `MAGISK_VER='28.1'` and `MAGISK_VER_CODE=28100` from `util_functions.sh`.
pub fn parse_version_from_util_functions(content: &str) -> (String, String) {
    let mut ver = String::new();
    let mut ver_code = String::new();

    for line in content.lines() {
        let line = line.trim();
        if ver.is_empty() && line.starts_with("MAGISK_VER=") {
            ver = line
                .strip_prefix("MAGISK_VER=")
                .unwrap_or("")
                .trim_matches(['\'', '"', '\r'])
                .to_string();
        }
        if ver_code.is_empty() && line.starts_with("MAGISK_VER_CODE=") {
            ver_code = line
                .strip_prefix("MAGISK_VER_CODE=")
                .unwrap_or("")
                .trim_matches(['\'', '"', '\r'])
                .to_string();
        }
        if !ver.is_empty() && !ver_code.is_empty() {
            break;
        }
    }

    (ver, ver_code)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Extract all Magisk binaries from `package_path` into `work_dir`, using the
/// best ABI directory for `target_abi`.
///
/// On success, the returned [`MagiskPackageContents`] points at the extracted
/// files and the package is **also** copied to `work_dir/Magisk.apk` for `adb install`.
pub fn extract_magisk_package(
    package_path: &Path,
    target_abi: &str,
    work_dir: &Path,
) -> CmdResult<MagiskPackageContents> {
    fs::create_dir_all(work_dir).map_err(|e| e.to_string())?;

    let mut archive = open_zip(package_path)?;

    // Pick the best available ABI directory (try primary, then fallbacks).
    let candidate_dirs = abi_fallback_dirs(target_abi);
    let abi_dir = candidate_dirs
        .iter()
        .find(|&&dir| archive.by_name(&format!("lib/{dir}/libmagiskboot.so")).is_ok())
        .copied()
        .ok_or_else(|| {
            format!(
                "No compatible ABI found in Magisk package for '{target_abi}'. \
                 Tried: {candidate_dirs:?}"
            )
        })?
        .to_string();

    // Extract mandatory binaries.
    let magiskboot = extract_lib_binary(&mut archive, &abi_dir, "magiskboot", work_dir)?;
    let magiskinit = extract_lib_binary(&mut archive, &abi_dir, "magiskinit", work_dir)?;
    let busybox = extract_lib_binary(&mut archive, &abi_dir, "busybox", work_dir)?;

    // Magisk daemon: prefer 64-bit, include 32-bit if available.
    //
    // Naming changed in Magisk v25+:
    //   < v25: libmagisk64.so / libmagisk32.so
    //   ≥ v25: libmagisk.so   (in the abi-specific lib dir)
    //
    // We try the old name first for backward-compat with forks (Delta, Kitsune Mask, Alpha),
    // then fall back to the new canonical name.
    let (magisk_binary, magisk32) = if is_64bit_abi(target_abi) {
        // 64-bit primary: try "magisk64" (old) then "magisk" (v25+)
        let mg64 = extract_lib_binary(&mut archive, &abi_dir, "magisk64", work_dir)
            .or_else(|_| {
                extract_lib_binary_as(&mut archive, &abi_dir, "magisk", "magisk64", work_dir)
            })
            .map_err(|_| {
                format!(
                    "Could not find Magisk daemon binary in 'lib/{abi_dir}/'. \
                     Tried: libmagisk64.so, libmagisk.so"
                )
            })?;

        // 32-bit companion: try "magisk32" (old) then skip (v25+ 64-bit builds drop it).
        let mg32 = extract_lib_binary(&mut archive, &abi_dir, "magisk32", work_dir)
            // Also try the 32-bit lib dir companion (some builds ship it there).
            .or_else(|_| {
                abi_fallback_dirs(target_abi)
                    .iter()
                    .skip(1) // first entry is the 64-bit dir we already tried
                    .find_map(|&fb| {
                        extract_lib_binary(&mut archive, fb, "magisk32", work_dir)
                            .or_else(|_| {
                                extract_lib_binary_as(
                                    &mut archive,
                                    fb,
                                    "magisk",
                                    "magisk32",
                                    work_dir,
                                )
                            })
                            .ok()
                    })
                    .ok_or_else(|| String::from("no magisk32"))
            })
            .ok(); // magisk32 is optional — 64-bit-only builds are fine
        (mg64, mg32)
    } else {
        // 32-bit only: try "magisk32" then "magisk"
        let mg32 = extract_lib_binary(&mut archive, &abi_dir, "magisk32", work_dir)
            .or_else(|_| {
                extract_lib_binary_as(&mut archive, &abi_dir, "magisk", "magisk32", work_dir)
            })
            .map_err(|_| {
                format!(
                    "Could not find Magisk daemon binary in 'lib/{abi_dir}/'. \
                     Tried: libmagisk32.so, libmagisk.so"
                )
            })?;
        (mg32, None)
    };

    // Extract optional assets.
    let stub_apk = extract_entry(&mut archive, "assets/stub.apk", work_dir).ok();

    // Parse version from util_functions.sh.
    let (version, version_code) = match archive.by_name("assets/util_functions.sh") {
        Ok(mut entry) => {
            let mut content = String::new();
            let _ = entry.read_to_string(&mut content);
            parse_version_from_util_functions(&content)
        }
        Err(_) => (String::from("unknown"), String::from("0")),
    };

    // Copy the original package as `Magisk.apk` for `adb install -r`.
    let magisk_apk = work_dir.join("Magisk.apk");
    fs::copy(package_path, &magisk_apk)
        .map_err(|e| format!("Failed to copy Magisk package to work dir: {e}"))?;

    Ok(MagiskPackageContents {
        work_dir: work_dir.to_path_buf(),
        magiskboot,
        magiskinit,
        magisk_binary,
        magisk32,
        busybox,
        stub_apk,
        magisk_apk,
        version,
        version_code,
        abi_dir,
    })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn abi_to_lib_dir_maps_correctly() {
        assert_eq!(abi_to_lib_dir("x86_64"), "x86_64");
        assert_eq!(abi_to_lib_dir("arm64-v8a"), "arm64-v8a");
        assert_eq!(abi_to_lib_dir("x86"), "x86");
        assert_eq!(abi_to_lib_dir("armeabi-v7a"), "armeabi-v7a");
        assert_eq!(abi_to_lib_dir("unknown"), "x86_64");
    }

    #[test]
    fn abi_fallback_x86_64_includes_x86() {
        let dirs = abi_fallback_dirs("x86_64");
        assert_eq!(dirs, vec!["x86_64", "x86"]);
    }

    #[test]
    fn abi_fallback_arm64_includes_armeabi() {
        let dirs = abi_fallback_dirs("arm64-v8a");
        assert_eq!(dirs, vec!["arm64-v8a", "armeabi-v7a"]);
    }

    #[test]
    fn is_64bit_abi_correct() {
        assert!(is_64bit_abi("x86_64"));
        assert!(is_64bit_abi("arm64-v8a"));
        assert!(!is_64bit_abi("x86"));
        assert!(!is_64bit_abi("armeabi-v7a"));
    }

    #[test]
    fn parse_version_from_util_functions_extracts_both_fields() {
        let content = "MAGISK_VER='28.1'\nMAGISK_VER_CODE=28100\n";
        let (ver, code) = parse_version_from_util_functions(content);
        assert_eq!(ver, "28.1");
        assert_eq!(code, "28100");
    }

    #[test]
    fn parse_version_handles_quoted_values() {
        let content = "MAGISK_VER=\"27.0\"\nMAGISK_VER_CODE=27000\n";
        let (ver, code) = parse_version_from_util_functions(content);
        assert_eq!(ver, "27.0");
        assert_eq!(code, "27000");
    }

    #[test]
    fn parse_version_returns_unknown_when_missing() {
        let (ver, code) = parse_version_from_util_functions("something else\n");
        assert_eq!(ver, "");
        assert_eq!(code, "");
    }
}
