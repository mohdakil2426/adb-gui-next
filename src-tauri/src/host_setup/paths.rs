//! Paths and PATH-string helpers for the Windows host setup.

use std::path::{Path, PathBuf};

pub const INSTALL_DIR: &str = r"C:\Android\platform-tools";
pub const USB_INF_NAME: &str = "android_winusb.inf";

pub fn windows_install_dir() -> PathBuf {
    PathBuf::from(INSTALL_DIR)
}

pub fn adb_exe(dir: &Path) -> PathBuf {
    dir.join("adb.exe")
}

pub fn fastboot_exe(dir: &Path) -> PathBuf {
    dir.join("fastboot.exe")
}

pub fn path_contains_dir(path_var: &str, dir: &str) -> bool {
    let needle = normalize_dir(dir);
    path_var.split(';').any(|part| normalize_dir(part) == needle)
}

fn normalize_dir(value: &str) -> String {
    value.trim().trim_end_matches(['\\', '/']).to_ascii_lowercase()
}

pub fn find_named_file(root: &Path, file_name: &str) -> Option<PathBuf> {
    find_named_file_limited(root, file_name, 0)
}

fn find_named_file_limited(root: &Path, file_name: &str, depth: u8) -> Option<PathBuf> {
    if depth > 8 {
        return None;
    }
    let direct = root.join(file_name);
    if direct.is_file() {
        return Some(direct);
    }
    let entries = std::fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir()
            && let Some(found) = find_named_file_limited(&path, file_name, depth + 1)
        {
            return Some(found);
        }
    }
    None
}

pub fn find_tools_root(extracted: &Path) -> Option<PathBuf> {
    if adb_exe(extracted).is_file() {
        return Some(extracted.to_path_buf());
    }
    let nested = extracted.join("platform-tools");
    if adb_exe(&nested).is_file() {
        return Some(nested);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_contains_dir_is_case_insensitive_and_ignores_trailing_slash() {
        let path = r"C:\Windows\system32;C:\Android\platform-tools\;C:\foo";
        assert!(path_contains_dir(path, r"c:\android\platform-tools"));
        assert!(!path_contains_dir(path, r"C:\Android"));
    }
}
