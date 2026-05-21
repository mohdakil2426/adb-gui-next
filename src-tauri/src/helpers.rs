use crate::CmdResult;
use log::{debug, error, warn};
use std::{
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};
use urlencoding::decode;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub fn default_if_empty<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    let trimmed = value.trim();
    if trimmed.is_empty() { fallback } else { trimmed }
}

/// Sanitizes a filename by removing path traversal components and keeping only
/// alphanumeric characters, dots, underscores, and dashes.
pub fn sanitize_filename(name: &str) -> String {
    let mut sanitized = name
        .chars()
        .filter(|&c| c.is_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .collect::<String>();

    // Prevent directory traversal via '..' sequences
    while sanitized.contains("..") {
        sanitized = sanitized.replace("..", ".");
    }

    sanitized
}

pub fn validate_path_components(path: &str) -> Result<(), String> {
    let trimmed = path.trim();

    if trimmed.contains('\0') {
        return Err("Path contains null byte".into());
    }

    let decoded = decode(trimmed).map_err(|_| "Invalid URL encoding in path")?.into_owned();

    if decoded.is_empty() {
        return Err("Path cannot be empty".into());
    }

    if decoded.contains("..") {
        return Err(format!("Path traversal not allowed: '{}' contains '..' sequence", decoded));
    }

    Ok(())
}

/// Allowed path prefixes for device file operations. Operations outside
/// these prefixes are rejected to prevent access to system partitions.
const ALLOWED_DEVICE_PREFIXES: &[&str] = &["/sdcard", "/data", "/mnt", "/storage/emulated"];

/// Validates that a device path starts with an allowed prefix. Used for
/// write operations (push, create, delete, rename) to prevent writing to
/// system partitions like /system, /proc, /dev, /sys.
pub fn validate_safe_device_path(path: &str) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty".into());
    }
    let is_allowed = ALLOWED_DEVICE_PREFIXES
        .iter()
        .any(|prefix| trimmed == *prefix || trimmed.starts_with(&format!("{prefix}/")));
    if !is_allowed {
        return Err(format!(
            "Path '{}' is outside allowed device directories ({:?}). \
             Only /sdcard, /data, /mnt, and /storage/emulated are permitted.",
            trimmed, ALLOWED_DEVICE_PREFIXES
        ));
    }
    Ok(())
}

pub fn split_args(command: &str) -> Vec<&str> {
    let mut args = Vec::new();
    let mut token_start = None;
    let mut quote = None;

    for (index, ch) in command.char_indices() {
        if let Some(active_quote) = quote {
            if ch == active_quote {
                if let Some(start) = token_start {
                    args.push(&command[start..index]);
                }
                token_start = None;
                quote = None;
            }
            continue;
        }

        if ch.is_whitespace() {
            if let Some(start) = token_start.take() {
                args.push(&command[start..index]);
            }
            continue;
        }

        if matches!(ch, '"' | '\'') && token_start.is_none() {
            quote = Some(ch);
            token_start = Some(index + ch.len_utf8());
            continue;
        }

        token_start.get_or_insert(index);
    }

    if let Some(start) = token_start {
        args.push(&command[start..]);
    }

    args
}

pub fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub fn binary_name(name: &str) -> String {
    if cfg!(target_os = "windows") { format!("{name}.exe") } else { name.to_string() }
}

pub fn repo_resource_directory(repo_root: &Path, os_dir: &str) -> PathBuf {
    repo_root.join("src-tauri").join("resources").join(os_dir)
}

pub fn repo_resource_binary_path(repo_root: &Path, os_dir: &str, file_name: &str) -> PathBuf {
    repo_resource_directory(repo_root, os_dir).join(file_name)
}

pub fn ensure_executable_if_needed(_path: &Path) -> CmdResult<()> {
    #[cfg(target_family = "unix")]
    {
        use std::fs;
        use std::os::unix::fs::PermissionsExt;

        let metadata = fs::metadata(_path).map_err(|error| error.to_string())?;
        let mut permissions = metadata.permissions();
        if permissions.mode() & 0o111 == 0 {
            permissions.set_mode(permissions.mode() | 0o755);
            fs::set_permissions(_path, permissions).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

pub fn resolve_binary_path(app: &AppHandle, name: &str) -> CmdResult<PathBuf> {
    debug!("Resolving binary path for: {}", name);
    let file_name = binary_name(name);
    let os_dir = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join(os_dir).join(&file_name),
            resource_dir.join("resources").join(os_dir).join(&file_name),
        ];

        for candidate in candidates {
            if candidate.exists() {
                debug!("Binary found at: {:?}", candidate);
                ensure_executable_if_needed(&candidate)?;
                return Ok(candidate);
            }
        }
    }

    if let Ok(repo_root) = std::env::current_dir() {
        let candidate = repo_resource_binary_path(&repo_root, os_dir, &file_name);
        if candidate.exists() {
            debug!("Binary found at repo resource: {:?}", candidate);
            ensure_executable_if_needed(&candidate)?;
            return Ok(candidate);
        }
    }

    which::which(&file_name).map_err(|_| {
        error!(
            "Unable to locate binary: {} (tried resource dir, repo resources, and system PATH)",
            name
        );
        format!("Unable to locate bundled or system binary for {name}.")
    })
}

pub fn binary_working_directory(app: Option<&AppHandle>) -> Option<PathBuf> {
    let os_dir = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };

    if let Some(app) = app
        && let Ok(resource_dir) = app.path().resource_dir()
    {
        for candidate in [resource_dir.join(os_dir), resource_dir.join("resources").join(os_dir)] {
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    std::env::current_dir().ok().and_then(|repo_root| {
        let candidate = repo_resource_directory(&repo_root, os_dir);
        candidate.exists().then_some(candidate)
    })
}

pub(crate) struct CommandOutput {
    success: bool,
    stderr: String,
    combined: String,
}

pub fn run_command_capture(
    app: &AppHandle,
    binary: &str,
    args: &[&str],
) -> CmdResult<CommandOutput> {
    debug!("Running command: {} {:?}", binary, args);
    let binary_path = resolve_binary_path(app, binary)?;
    let mut cmd = Command::new(&binary_path);
    cmd.args(args);
    cmd.current_dir(
        binary_working_directory(Some(app))
            .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
    );

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|error| {
        error!("Failed to execute {} {:?}: {}", binary, args, error);
        error.to_string()
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = match (stdout.is_empty(), stderr.is_empty()) {
        (false, false) => format!("{stdout}\n{stderr}"),
        (false, true) => stdout.clone(),
        (true, false) => stderr.clone(),
        (true, true) => String::new(),
    };

    if !output.status.success() {
        warn!("Command failed: {} {:?} (exit {}): {}", binary, args, output.status, stderr.trim());
    }

    Ok(CommandOutput { success: output.status.success(), stderr, combined })
}

pub fn run_binary_command(app: &AppHandle, binary: &str, args: &[&str]) -> CmdResult<String> {
    let command_output = run_command_capture(app, binary, args)?;
    if command_output.success {
        Ok(command_output.combined)
    } else if !command_output.stderr.is_empty() {
        Err(command_output.stderr)
    } else if !command_output.combined.is_empty() {
        Err(command_output.combined)
    } else {
        Err(format!("{} {:?} failed (no output)", binary, args))
    }
}

pub fn run_binary_command_allow_output_on_failure(
    app: &AppHandle,
    binary: &str,
    args: &[&str],
) -> CmdResult<String> {
    let command_output = run_command_capture(app, binary, args)?;
    if command_output.success || !command_output.combined.is_empty() {
        Ok(command_output.combined)
    } else {
        Err(format!("{binary} command failed."))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_args_keeps_double_quoted_segments_together() {
        assert_eq!(
            split_args(r#"install "/tmp/My App.apk" --user 0"#),
            vec!["install", "/tmp/My App.apk", "--user", "0"]
        );
    }

    #[test]
    fn split_args_keeps_single_quoted_segments_together() {
        assert_eq!(split_args("flash 'boot image.img'"), vec!["flash", "boot image.img"]);
    }

    #[test]
    fn repo_resource_binary_path_stays_inside_src_tauri_resources() {
        let candidate = repo_resource_binary_path(Path::new("repo"), "windows", "adb.exe");
        let normalized = candidate.to_string_lossy().replace('\\', "/");
        assert_eq!(normalized, "repo/src-tauri/resources/windows/adb.exe");
    }

    #[test]
    fn validate_path_components_rejects_traversal() {
        assert!(validate_path_components("/sdcard/../../../system/").is_err());
        assert!(validate_path_components("../etc/passwd").is_err());
        assert!(validate_path_components("foo/../../bar").is_err());
    }

    #[test]
    fn validate_path_components_allows_normal_paths() {
        assert!(validate_path_components("/sdcard/Download/").is_ok());
        assert!(validate_path_components("Pictures/IMG_001.jpg").is_ok());
        assert!(validate_path_components("/").is_ok());
    }

    #[test]
    fn validate_path_components_rejects_empty() {
        assert!(validate_path_components("").is_err());
        assert!(validate_path_components("   ").is_err());
    }

    #[test]
    fn validate_path_components_rejects_null_bytes() {
        assert!(validate_path_components("file\0name").is_err());
    }

    #[test]
    fn validate_path_components_rejects_url_encoded_traversal() {
        assert!(validate_path_components("%2e%2e").is_err());
        assert!(validate_path_components("%2e.%2F..").is_err());
        assert!(validate_path_components("../%2e%2e").is_err());
        assert!(validate_path_components("/sdcard/%2e%2e/system").is_err());
    }

    #[test]
    fn validate_safe_device_path_allows_sdcard() {
        assert!(validate_safe_device_path("/sdcard/Download/").is_ok());
        assert!(validate_safe_device_path("/sdcard/").is_ok());
    }

    #[test]
    fn validate_safe_device_path_allows_data() {
        assert!(validate_safe_device_path("/data/app/").is_ok());
    }

    #[test]
    fn validate_safe_device_path_allows_mnt() {
        assert!(validate_safe_device_path("/mnt/sdcard/").is_ok());
    }

    #[test]
    fn validate_safe_device_path_rejects_system() {
        assert!(validate_safe_device_path("/system/").is_err());
        assert!(validate_safe_device_path("/system/app/").is_err());
    }

    #[test]
    fn validate_safe_device_path_rejects_proc() {
        assert!(validate_safe_device_path("/proc/").is_err());
    }

    #[test]
    fn validate_safe_device_path_rejects_dev() {
        assert!(validate_safe_device_path("/dev/").is_err());
    }

    #[test]
    fn validate_safe_device_path_rejects_prefix_boundary_bypass() {
        assert!(validate_safe_device_path("/sdcardData/app").is_err());
        assert!(validate_safe_device_path("/dataSystem/tmp").is_err());
        assert!(validate_safe_device_path("/mntVendor/persist").is_err());
    }

    #[test]
    fn validate_safe_device_path_allows_trailing_slash() {
        assert!(validate_safe_device_path("/sdcard/").is_ok());
        assert!(validate_safe_device_path("/data/").is_ok());
    }
}
