//! Official Genymobile/scrcpy release asset names per OS/arch.
//!
//! v4.1 ships: win64, win32, linux-x86_64, macos-aarch64, macos-x86_64.
//! There is **no** official Linux arm64 or Windows arm64 archive.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostArch {
    X86,
    X64,
    Arm64,
}

pub fn host_arch() -> HostArch {
    if cfg!(target_arch = "x86_64") {
        HostArch::X64
    } else if cfg!(target_arch = "x86") {
        HostArch::X86
    } else {
        HostArch::Arm64
    }
}

pub fn host_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

/// Archive filename for a release tag like `v4.1`.
pub fn official_archive_name(tag: &str, os: &str, arch: HostArch) -> Result<String, String> {
    let version = tag.trim().trim_start_matches('v');
    if version.is_empty() {
        return Err("empty scrcpy version".into());
    }
    match (os, arch) {
        ("windows", HostArch::X64) => Ok(format!("scrcpy-win64-v{version}.zip")),
        ("windows", HostArch::X86) => Ok(format!("scrcpy-win32-v{version}.zip")),
        ("linux", HostArch::X64) => Ok(format!("scrcpy-linux-x86_64-v{version}.tar.gz")),
        ("macos", HostArch::Arm64) => Ok(format!("scrcpy-macos-aarch64-v{version}.tar.gz")),
        ("macos", HostArch::X64) => Ok(format!("scrcpy-macos-x86_64-v{version}.tar.gz")),
        ("windows", HostArch::Arm64) | ("linux", HostArch::Arm64) | ("linux", HostArch::X86) => {
            Err(format!(
                "Genymobile does not publish an official scrcpy binary for {os}/{arch:?}. Use PATH scrcpy if you installed it yourself."
            ))
        }
        _ => Err(format!("unsupported scrcpy host {os}/{arch:?}")),
    }
}

pub fn parse_sha256sums(body: &str, filename: &str) -> Result<String, String> {
    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((hash, name)) = line.split_once(char::is_whitespace) else {
            continue;
        };
        let name = name.trim().trim_start_matches('*');
        if name == filename {
            let hash = hash.trim().to_ascii_lowercase();
            if hash.len() == 64 && hash.chars().all(|ch| ch.is_ascii_hexdigit()) {
                return Ok(hash);
            }
        }
    }
    Err(format!("SHA256SUMS.txt has no entry for {filename}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_x64_zip_name() {
        assert_eq!(
            official_archive_name("v4.1", "windows", HostArch::X64).expect("name"),
            "scrcpy-win64-v4.1.zip"
        );
    }

    #[test]
    fn linux_x64_tarball_name() {
        assert_eq!(
            official_archive_name("4.1", "linux", HostArch::X64).expect("name"),
            "scrcpy-linux-x86_64-v4.1.tar.gz"
        );
    }

    #[test]
    fn linux_arm64_is_unsupported() {
        assert!(official_archive_name("v4.1", "linux", HostArch::Arm64).is_err());
    }

    #[test]
    fn sha256sums_match() {
        let body = "5b12172b3264b2889f4583ee64752ce832e29bc8b1089dca81093459697165db  scrcpy-win64-v4.1.zip\n";
        assert_eq!(
            parse_sha256sums(body, "scrcpy-win64-v4.1.zip").expect("hash"),
            "5b12172b3264b2889f4583ee64752ce832e29bc8b1089dca81093459697165db"
        );
    }
}
