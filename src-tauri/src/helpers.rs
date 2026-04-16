use crate::CmdResult;
use log::{debug, error, warn};
use std::{
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};

const VALUE_NOT_AVAILABLE: &str = "N/A";

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
    let os_dir = if cfg!(target_os = "windows") { "windows" } else { "linux" };

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
    let os_dir = if cfg!(target_os = "windows") { "windows" } else { "linux" };

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
    let output = Command::new(&binary_path)
        .args(args)
        .current_dir(
            binary_working_directory(Some(app))
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
        )
        .output()
        .map_err(|error| {
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

pub fn get_prop(app: &AppHandle, prop: &str) -> String {
    run_binary_command(app, "adb", &["shell", "getprop", prop])
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| VALUE_NOT_AVAILABLE.into())
}

pub fn get_serial(app: &AppHandle) -> String {
    run_binary_command(app, "adb", &["get-serialno"])
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| get_prop(app, "ro.serialno"))
}

pub fn get_root_status(app: &AppHandle) -> String {
    let output = run_binary_command(app, "adb", &["shell", "su", "-c", "id -u"]);
    if matches!(output.as_deref(), Ok("0")) { "Yes".into() } else { "No".into() }
}

pub fn get_ip_address(app: &AppHandle) -> String {
    if let Ok(output) = run_binary_command(app, "adb", &["shell", "ip", "addr", "show", "wlan0"])
        && let Some(ip) = output
            .split_whitespace()
            .collect::<Vec<_>>()
            .windows(2)
            .find_map(|chunk| (chunk[0] == "inet").then_some(chunk[1]))
    {
        return ip.split('/').next().unwrap_or(ip).to_string();
    }

    let fallback = get_prop(app, "dhcp.wlan0.ipaddress");
    if fallback == VALUE_NOT_AVAILABLE { "N/A (Not on WiFi?)".into() } else { fallback }
}

pub fn get_battery_level(app: &AppHandle) -> String {
    if let Ok(output) = run_binary_command(app, "adb", &["shell", "dumpsys battery | grep level"])
        && let Some(level) = output.split(':').nth(1)
    {
        return format!("{}%", level.trim());
    }
    VALUE_NOT_AVAILABLE.into()
}

pub fn get_ram_total(app: &AppHandle) -> String {
    if let Ok(output) =
        run_binary_command(app, "adb", &["shell", "cat /proc/meminfo | grep MemTotal"])
        && let Some(value) = output.split_whitespace().nth(1)
        && let Ok(kb) = value.parse::<f64>()
    {
        return format!("{:.1} GB", kb / 1024.0 / 1024.0);
    }
    VALUE_NOT_AVAILABLE.into()
}

pub fn get_storage_info(app: &AppHandle) -> String {
    if let Ok(output) = run_binary_command(app, "adb", &["shell", "df /data"])
        && let Some(line) = output.lines().nth(1)
    {
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() >= 3
            && let (Ok(total), Ok(used)) = (parts[1].parse::<f64>(), parts[2].parse::<f64>())
        {
            return format!("{:.1} GB / {:.1} GB", used / 1024.0 / 1024.0, total / 1024.0 / 1024.0);
        }
    }
    VALUE_NOT_AVAILABLE.into()
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
}
