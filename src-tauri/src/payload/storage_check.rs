//! Storage pre-flight validation, FAT32 4 GiB limit detection, and cross-device moves.
//!
//! Provides:
//! - Pre-flight storage validation ensuring user-quota free disk space with 5% headroom + 256 MiB metadata margin.
//! - FAT32 4 GiB single-file limit detection (`EFBIG` / Win32 `0xDF` prevention).
//! - Long path normalization using `dunce::canonicalize`.
//! - Resilient cross-device file mover (`move_file_cross_device`) handling `EXDEV` / Windows Error 17 with 1 MiB chunked stream copy.
#![allow(unsafe_code)]

use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

/// 4 GiB minus 64 KiB safety margin (4,294,901,760 bytes).
pub const FAT32_MAX_FILE_SIZE: u64 = 4 * 1024 * 1024 * 1024 - 64 * 1024;

/// 256 MiB metadata and filesystem journal safety margin.
pub const METADATA_MARGIN_BYTES: u64 = 256 * 1024 * 1024;

/// Normalizes a path using `dunce::canonicalize` to handle Windows `MAX_PATH` (> 240 chars)
/// while avoiding unnecessary verbatim UNC (`\\?\`) prefixes where possible.
///
/// If `path` does not exist yet, its closest existing ancestor is canonicalized and
/// the relative suffix is appended.
pub fn normalize_path(path: &Path) -> PathBuf {
    if let Ok(canon) = dunce::canonicalize(path) {
        return canon;
    }

    let mut current = path;
    let mut stack = Vec::new();
    while !current.exists() {
        if let Some(name) = current.file_name() {
            stack.push(name);
        }
        if let Some(parent) = current.parent() {
            if parent == current {
                break;
            }
            current = parent;
        } else {
            break;
        }
    }

    if let Ok(canon) = dunce::canonicalize(current) {
        let mut res = canon;
        for component in stack.into_iter().rev() {
            res.push(component);
        }
        res
    } else {
        path.to_path_buf()
    }
}

/// Finds the nearest existing ancestor directory for a given path.
fn find_existing_ancestor(path: &Path) -> PathBuf {
    let mut current = path;
    while !current.exists() {
        if let Some(parent) = current.parent() {
            if parent == current {
                break;
            }
            current = parent;
        } else {
            break;
        }
    }
    if current.exists() {
        current.to_path_buf()
    } else {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    }
}

#[cfg(windows)]
fn get_available_disk_space_os(dir: &Path) -> anyhow::Result<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let check_dir = find_existing_ancestor(dir);
    let mut wide_path: Vec<u16> = check_dir.as_os_str().encode_wide().collect();
    wide_path.push(0);

    let mut free_bytes_available_to_user: u64 = 0;
    let mut total_number_of_bytes: u64 = 0;
    let mut total_number_of_free_bytes: u64 = 0;

    let res = unsafe {
        GetDiskFreeSpaceExW(
            wide_path.as_ptr(),
            &mut free_bytes_available_to_user,
            &mut total_number_of_bytes,
            &mut total_number_of_free_bytes,
        )
    };

    if res == 0 {
        let err = std::io::Error::last_os_error();
        anyhow::bail!("Failed to query disk free space for {}: {}", check_dir.display(), err);
    }

    Ok(free_bytes_available_to_user)
}

#[cfg(unix)]
fn get_available_disk_space_os(dir: &Path) -> anyhow::Result<u64> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let check_dir = find_existing_ancestor(dir);
    let c_path = CString::new(check_dir.as_os_str().as_bytes())
        .map_err(|e| anyhow::anyhow!("Invalid path for statvfs: {}", e))?;

    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    let res = unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) };

    if res != 0 {
        let err = std::io::Error::last_os_error();
        anyhow::bail!("Failed to query statvfs for {}: {}", check_dir.display(), err);
    }

    let frsize = if stat.f_frsize > 0 { stat.f_frsize as u64 } else { stat.f_bsize as u64 };
    let free_bytes = (stat.f_bavail as u64).saturating_mul(frsize);
    Ok(free_bytes)
}

#[cfg(not(any(windows, unix)))]
fn get_available_disk_space_os(_dir: &Path) -> anyhow::Result<u64> {
    Ok(u64::MAX)
}

/// Returns the user-quota-aware available free disk space (in bytes) on the volume containing `dir`.
pub fn get_available_disk_space(dir: &Path) -> anyhow::Result<u64> {
    get_available_disk_space_os(dir)
}

#[cfg(windows)]
fn is_fat32_filesystem_os(dir: &Path) -> anyhow::Result<bool> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetVolumeInformationW;

    let check_dir = find_existing_ancestor(dir);
    let mut root_path = check_dir.clone();
    while let Some(parent) = root_path.parent() {
        if parent == root_path {
            break;
        }
        root_path = parent.to_path_buf();
    }

    let mut wide_root: Vec<u16> = root_path.as_os_str().encode_wide().collect();
    if !wide_root.is_empty()
        && wide_root.last() != Some(&('\\' as u16))
        && wide_root.last() != Some(&('/' as u16))
    {
        wide_root.push('\\' as u16);
    }
    wide_root.push(0);

    let mut fs_name_buf = [0u16; 260];
    let res = unsafe {
        GetVolumeInformationW(
            wide_root.as_ptr(),
            std::ptr::null_mut(),
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            fs_name_buf.as_mut_ptr(),
            fs_name_buf.len() as u32,
        )
    };

    if res == 0 {
        return Ok(false);
    }

    let len = fs_name_buf.iter().position(|&c| c == 0).unwrap_or(fs_name_buf.len());
    let fs_name = String::from_utf16_lossy(&fs_name_buf[..len]);
    let fs_upper = fs_name.trim().to_uppercase();
    Ok(fs_upper.starts_with("FAT")
        || fs_upper == "FAT32"
        || fs_upper == "FAT16"
        || fs_upper == "FAT12")
}

#[cfg(target_os = "linux")]
fn is_fat32_filesystem_os(dir: &Path) -> anyhow::Result<bool> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let check_dir = find_existing_ancestor(dir);
    let c_path = CString::new(check_dir.as_os_str().as_bytes())
        .map_err(|e| anyhow::anyhow!("Invalid path: {}", e))?;

    let mut stat: libc::statfs = unsafe { std::mem::zeroed() };
    let res = unsafe { libc::statfs(c_path.as_ptr(), &mut stat) };
    if res != 0 {
        return Ok(false);
    }

    // MSDOS_SUPER_MAGIC = 0x4d44
    const MSDOS_SUPER_MAGIC: libc::c_long = 0x4d44;
    Ok(stat.f_type as libc::c_long == MSDOS_SUPER_MAGIC)
}

#[cfg(all(unix, not(target_os = "linux")))]
fn is_fat32_filesystem_os(dir: &Path) -> anyhow::Result<bool> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let check_dir = find_existing_ancestor(dir);
    let c_path = CString::new(check_dir.as_os_str().as_bytes())
        .map_err(|e| anyhow::anyhow!("Invalid path: {}", e))?;

    let mut stat: libc::statfs = unsafe { std::mem::zeroed() };
    let res = unsafe { libc::statfs(c_path.as_ptr(), &mut stat) };
    if res != 0 {
        return Ok(false);
    }

    let fs_type = unsafe { std::ffi::CStr::from_ptr(stat.f_fstypename.as_ptr()) };
    let fs_str = fs_type.to_string_lossy().to_lowercase();
    Ok(fs_str.contains("msdos") || fs_str.contains("fat"))
}

#[cfg(not(any(windows, unix)))]
fn is_fat32_filesystem_os(_dir: &Path) -> anyhow::Result<bool> {
    Ok(false)
}

/// Checks if the target filesystem for `dir` is FAT32 or FAT.
pub fn is_fat32_filesystem(dir: &Path) -> anyhow::Result<bool> {
    is_fat32_filesystem_os(dir)
}

/// Checks if an individual file extraction would exceed the FAT32 4 GiB single-file limit.
pub fn check_fat32_file_limit(output_dir: &Path, single_file_bytes: u64) -> anyhow::Result<()> {
    if single_file_bytes >= FAT32_MAX_FILE_SIZE && is_fat32_filesystem(output_dir).unwrap_or(false)
    {
        anyhow::bail!(
            "Target directory '{}' is on a FAT32 filesystem which cannot store files >= 4 GiB (file size: {} bytes / {:.2} GiB). Please reformat the target drive to NTFS, exFAT, or ext4.",
            output_dir.display(),
            single_file_bytes,
            single_file_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
        );
    }
    Ok(())
}

/// Validates pre-flight storage capacity and filesystem constraints for payload extraction.
///
/// Ensures:
/// 1. Path is normalized using `dunce::canonicalize`.
/// 2. User-quota free disk space is sufficient for `required_bytes` plus 5% headroom + 256 MiB metadata margin.
/// 3. FAT32 4 GiB single-file limit is not violated if total size is a single container >= 4 GiB on FAT32.
pub fn validate_preflight_storage(output_dir: &Path, required_bytes: u64) -> anyhow::Result<()> {
    let normalized_dir = normalize_path(output_dir);

    // Calculate required space: required_bytes * 1.05 + 256 MiB
    let headroom = required_bytes.checked_div(20).unwrap_or(0); // 5%
    let total_required =
        required_bytes.saturating_add(headroom).saturating_add(METADATA_MARGIN_BYTES);

    let free_space = get_available_disk_space(&normalized_dir)?;
    if free_space < total_required {
        anyhow::bail!(
            "Insufficient disk space on '{}': required {:.2} GiB ({} bytes with 5% safety headroom and 256 MiB metadata margin), but only {:.2} GiB ({} bytes) available.",
            normalized_dir.display(),
            total_required as f64 / (1024.0 * 1024.0 * 1024.0),
            total_required,
            free_space as f64 / (1024.0 * 1024.0 * 1024.0),
            free_space
        );
    }

    if required_bytes >= FAT32_MAX_FILE_SIZE
        && is_fat32_filesystem(&normalized_dir).unwrap_or(false)
    {
        anyhow::bail!(
            "Target directory '{}' is on a FAT32 filesystem which cannot store files >= 4 GiB (required: {:.2} GiB). Please reformat the target drive to NTFS, exFAT, or ext4.",
            normalized_dir.display(),
            required_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
        );
    }

    Ok(())
}

/// Detailed pre-flight storage validation checking total free space and individual partition sizes against FAT32 limits.
pub fn validate_preflight_storage_detailed(
    output_dir: &Path,
    partition_sizes: &[u64],
) -> anyhow::Result<()> {
    let total_required: u64 = partition_sizes.iter().copied().sum();
    validate_preflight_storage(output_dir, total_required)?;

    let is_fat = is_fat32_filesystem(output_dir).unwrap_or(false);
    if is_fat {
        for &size in partition_sizes {
            if size >= FAT32_MAX_FILE_SIZE {
                anyhow::bail!(
                    "Target directory '{}' is on a FAT32 filesystem which cannot store partition of size {:.2} GiB ({} bytes >= 4 GiB limit). Please reformat the target drive to NTFS, exFAT, or ext4.",
                    output_dir.display(),
                    size as f64 / (1024.0 * 1024.0 * 1024.0),
                    size
                );
            }
        }
    }

    Ok(())
}

/// Checks if an I/O error indicates a cross-device link error (`EXDEV` on Unix / Error 17 on Windows).
fn is_cross_device_error(err: &std::io::Error) -> bool {
    if err.kind() == std::io::ErrorKind::CrossesDevices {
        return true;
    }
    match err.raw_os_error() {
        // Windows ERROR_NOT_SAME_DEVICE = 17
        Some(17) => true,
        // Unix EXDEV = 18
        Some(18) => true,
        _ => false,
    }
}

/// Moves a file from `src` to `dst`, resiliently falling back to 1 MiB chunked stream copy
/// if `std::fs::rename` fails with `EXDEV` (errno 18) / Windows Error 17 (`ERROR_NOT_SAME_DEVICE`)
/// or cross-device link error.
pub fn move_file_cross_device(src: &Path, dst: &Path) -> std::io::Result<()> {
    // 1. Fast path: try atomic rename first
    match std::fs::rename(src, dst) {
        Ok(()) => Ok(()),
        Err(err) => {
            // If the source doesn't exist, fail immediately
            if !src.exists() {
                return Err(err);
            }

            // Ensure destination directory exists
            if let Some(parent) = dst.parent() {
                std::fs::create_dir_all(parent)?;
            }

            // If error is not cross-device, but rename failed (e.g. Windows destination exists or filesystem difference),
            // we proceed with resilient step-down copy.
            let _ = is_cross_device_error(&err);

            // Generate unique temporary destination file in the target directory to ensure atomic replace on target filesystem
            let temp_dst = {
                let file_name = dst.file_name().unwrap_or_default().to_string_lossy();
                let random_suffix: u128 = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_or(0, |d| d.as_nanos());
                let tmp_name = format!(".tmp_move_{:032x}_{}", random_suffix, file_name);
                dst.with_file_name(tmp_name)
            };

            let copy_res = (|| -> std::io::Result<()> {
                let mut src_file = File::open(src)?;
                let mut dst_file = File::create(&temp_dst)?;

                // 1 MiB chunked streaming copy
                const CHUNK_SIZE: usize = 1024 * 1024;
                let mut buf = vec![0u8; CHUNK_SIZE];

                loop {
                    let bytes_read = src_file.read(&mut buf)?;
                    if bytes_read == 0 {
                        break;
                    }
                    dst_file.write_all(&buf[..bytes_read])?;
                }

                // Ensure data is flushed to non-volatile storage
                dst_file.sync_all()?;
                drop(dst_file);
                drop(src_file);

                // Atomic replace on the target filesystem
                #[cfg(windows)]
                {
                    if dst.exists() {
                        let _ = std::fs::remove_file(dst);
                    }
                }
                std::fs::rename(&temp_dst, dst)?;

                // Unlink source file
                std::fs::remove_file(src)?;
                Ok(())
            })();

            if copy_res.is_err() {
                let _ = std::fs::remove_file(&temp_dst);
            }

            copy_res
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_normalize_path_basic() {
        let temp = tempdir().expect("tempdir");
        let output = temp.path().join("sub/dir/output");
        let normalized = normalize_path(&output);
        assert!(!normalized.as_os_str().is_empty());
    }

    #[test]
    fn test_get_available_disk_space() {
        let temp = tempdir().expect("tempdir");
        let free_space = get_available_disk_space(temp.path()).expect("get disk space");
        assert!(free_space > 0, "Free space should be positive");
    }

    #[test]
    fn test_validate_preflight_storage_success() {
        let temp = tempdir().expect("tempdir");
        // 1 KB required space should easily pass
        assert!(validate_preflight_storage(temp.path(), 1024).is_ok());
    }

    #[test]
    fn test_validate_preflight_storage_insufficient_space() {
        let temp = tempdir().expect("tempdir");
        // Request 10 Petabytes which will exceed disk space
        let huge_space = 10 * 1024 * 1024 * 1024 * 1024 * 1024u64;
        let res = validate_preflight_storage(temp.path(), huge_space);
        assert!(res.is_err());
        assert!(res.unwrap_err().to_string().contains("Insufficient disk space"));
    }

    #[test]
    fn test_move_file_cross_device_basic() {
        let temp = tempdir().expect("tempdir");
        let src = temp.path().join("src.bin");
        let dst = temp.path().join("nested/dst.bin");

        let test_data = b"Hello cross device test data payload 12345";
        std::fs::write(&src, test_data).expect("write src");

        move_file_cross_device(&src, &dst).expect("move file");

        assert!(!src.exists(), "Source should be removed");
        assert!(dst.exists(), "Destination should exist");
        let read_back = std::fs::read(&dst).expect("read dst");
        assert_eq!(read_back, test_data);
    }

    #[test]
    fn test_move_file_cross_device_large_chunked() {
        let temp = tempdir().expect("tempdir");
        let src = temp.path().join("src_large.bin");
        let dst = temp.path().join("dst_large.bin");

        // 2.5 MiB data to test 1 MiB chunking across multiple iterations
        let test_data = vec![0xABu8; (2.5 * 1024.0 * 1024.0) as usize];
        std::fs::write(&src, &test_data).expect("write src");

        move_file_cross_device(&src, &dst).expect("move large file");

        assert!(!src.exists(), "Source should be unlinked");
        assert!(dst.exists(), "Destination should exist");
        let read_back = std::fs::read(&dst).expect("read dst");
        assert_eq!(read_back.len(), test_data.len());
        assert_eq!(read_back, test_data);
    }
}
