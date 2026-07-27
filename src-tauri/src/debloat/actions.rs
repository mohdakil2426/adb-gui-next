use crate::CmdResult;
use crate::debloat::sync::query_package_states;
use crate::debloat::{DebloatActionResult, PackageState};
use crate::helpers::run_adb;
use log::{info, warn};
use std::collections::HashMap;
use tauri::AppHandle;

/// Marker echoed once per package so one `adb shell` can report per-package status.
const STATUS_MARKER: &str = "__ADBGUI_DEBLOAT__";

/// Packages per `adb shell` invocation. Keeps the command line well under ARG_MAX
/// (~128 KiB) even with long package names.
const BATCH_SIZE: usize = 100;

/// The action to apply to a package.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DebloatAction {
    Uninstall,
    Disable,
    Restore,
}

impl DebloatAction {
    pub fn from_action_str(s: &str) -> Option<Self> {
        match s {
            "uninstall" => Some(Self::Uninstall),
            "disable" => Some(Self::Disable),
            "restore" => Some(Self::Restore),
            _ => None,
        }
    }
}

/// Reject anything that is not a plain package name.
///
/// Package names reach `adb shell pm …` from IPC **and** from backup files on disk.
/// `adb shell` joins its trailing arguments and hands them to the *device's* `sh`,
/// so a tampered backup entry like `com.x; rm -rf /sdcard/DCIM` would execute on the
/// device. Batching (below) additionally builds a device-side script, which makes
/// this validation load-bearing rather than defensive.
pub fn validate_package_name(package: &str) -> Result<(), String> {
    if package.is_empty() || package.len() > 255 {
        return Err(format!("Invalid package name: {package:?}"));
    }
    if package.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_')) {
        Ok(())
    } else {
        Err(format!("Invalid package name: {package:?}"))
    }
}

/// Resolve the device-side command sequence for the given action and SDK version.
///
/// Commands use `$p` for the package so one script can loop over a whole batch.
/// The **first** command is the primary one; its exit status is reported per package.
///
/// SDK ≥23 (Android 6.0+): full pm uninstall/disable/restore support per-user
/// SDK 21-22 (5.x):        use pm hide/unhide
/// SDK 19-20 (4.4):        use pm block/unblock
/// SDK <19:                use pm uninstall (no user flag, not reversible)
fn build_commands(action: DebloatAction, sdk: u32, user: u32) -> Vec<String> {
    match action {
        DebloatAction::Uninstall => {
            if sdk >= 23 {
                vec![format!("pm uninstall --user {user} $p")]
            } else if sdk >= 21 {
                vec!["pm hide $p".into(), "pm clear $p".into()]
            } else if sdk >= 19 {
                vec!["pm block $p".into(), "pm clear $p".into()]
            } else {
                vec!["pm uninstall $p".into()]
            }
        }
        DebloatAction::Disable => {
            if sdk >= 23 {
                vec![
                    format!("pm disable-user --user {user} $p"),
                    "am force-stop $p".into(),
                    format!("pm clear --user {user} $p"),
                ]
            } else {
                // Refused for SDK < 23 in apply_package_actions; never map to uninstall.
                vec![]
            }
        }
        DebloatAction::Restore => {
            if sdk >= 23 {
                vec![format!("cmd package install-existing --user {user} $p")]
            } else if sdk >= 21 {
                vec!["pm unhide $p".into()]
            } else if sdk >= 19 {
                vec!["pm unblock $p".into(), "pm clear $p".into()]
            } else {
                vec![]
            }
        }
    }
}

fn intended_state(action: DebloatAction) -> PackageState {
    match action {
        DebloatAction::Uninstall => PackageState::Uninstalled,
        DebloatAction::Disable => PackageState::Disabled,
        DebloatAction::Restore => PackageState::Enabled,
    }
}

/// Build one device-side `sh` script that applies `commands` to every package in
/// `chunk` and echoes `MARKER:<package>:<status-of-first-command>` for each.
///
/// Safe to interpolate: every name in `chunk` has passed [`validate_package_name`],
/// so it cannot contain a quote, space, separator, or glob character.
fn build_batch_script(chunk: &[String], commands: &[String]) -> String {
    let names = chunk.join(" ");
    let mut body = String::new();
    for (index, command) in commands.iter().enumerate() {
        body.push_str(command);
        body.push_str(" >/dev/null 2>&1; ");
        if index == 0 {
            body.push_str("st=$?; ");
        }
    }
    format!("for p in {names}; do {body}echo {STATUS_MARKER}:$p:$st; done")
}

/// Parse `MARKER:<package>:<status>` lines out of the shell output.
fn parse_batch_status(output: &str) -> HashMap<String, i32> {
    let prefix = format!("{STATUS_MARKER}:");
    output
        .lines()
        .filter_map(|line| {
            let rest = line.trim().strip_prefix(prefix.as_str())?;
            let (package, status) = rest.rsplit_once(':')?;
            Some((package.to_string(), status.trim().parse::<i32>().unwrap_or(-1)))
        })
        .collect()
}

/// Apply an action to a batch of packages. Returns one result per package.
///
/// One `adb shell` invocation per [`BATCH_SIZE`] packages plus one state read-back,
/// instead of one spawn per package per command — a full backup restore used to cost
/// 400-500 spawns.
pub fn apply_package_actions(
    app: &AppHandle,
    serial: Option<&str>,
    packages: &[String],
    action_str: &str,
    sdk: u32,
    user: u32,
) -> CmdResult<Vec<DebloatActionResult>> {
    if sdk == 0 {
        return Err("Could not determine Android SDK; refusing destructive action".to_string());
    }

    let action = DebloatAction::from_action_str(action_str)
        .ok_or_else(|| format!("Unknown action: {action_str}"))?;

    if action == DebloatAction::Disable && sdk < 23 {
        return Err("Disable is not supported on API < 23".to_string());
    }

    let commands = build_commands(action, sdk, user);
    if commands.is_empty() {
        return Err("Action not supported on this Android version (SDK < 19)".to_string());
    }

    // Split invalid names off before anything reaches the device shell.
    let mut results: Vec<DebloatActionResult> = Vec::with_capacity(packages.len());
    let mut valid: Vec<String> = Vec::with_capacity(packages.len());
    for package in packages {
        match validate_package_name(package) {
            Ok(()) => valid.push(package.clone()),
            Err(error) => {
                warn!("debloat: rejected package name {package:?}");
                results.push(DebloatActionResult {
                    package_name: package.clone(),
                    success: false,
                    error: Some(error),
                    new_state: PackageState::Enabled,
                });
            }
        }
    }

    if valid.is_empty() {
        return Ok(results);
    }

    info!("Debloat: {:?} {} package(s) (SDK {}, user {})", action, valid.len(), sdk, user);

    let mut statuses: HashMap<String, i32> = HashMap::with_capacity(valid.len());
    for chunk in valid.chunks(BATCH_SIZE) {
        let script = build_batch_script(chunk, &commands);
        match run_adb(app, serial, &["shell", script.as_str()]) {
            Ok(output) => statuses.extend(parse_batch_status(&output)),
            Err(error) => {
                // ADB itself failed (device gone, unauthorised): no marker for this
                // chunk, so every package in it is reported unknown/failed below.
                warn!("debloat: batch failed: {error}");
            }
        }
    }

    // Truth comes from the device, not from exit codes: `pm clear` frequently exits
    // non-zero on a just-disabled package even though the disable itself worked.
    let observed = query_package_states(app, serial, &valid).unwrap_or_else(|error| {
        warn!("debloat: could not read back package states: {error}");
        HashMap::new()
    });

    let goal = intended_state(action);
    for package in valid {
        let status = statuses.get(&package).copied();
        let actual = observed.get(&package).copied();
        let reached = actual == Some(goal);
        let command_ok = status == Some(0);

        let error = if reached {
            None
        } else if actual.is_none() && command_ok {
            // Device no longer lists the package (e.g. fully removed): trust the
            // command's own success.
            None
        } else {
            Some(match status {
                Some(0) | None => format!("{action_str} did not take effect on {package}"),
                Some(code) => format!("{action_str} failed on {package} (exit {code})"),
            })
        };

        results.push(DebloatActionResult {
            package_name: package,
            success: error.is_none(),
            error,
            new_state: actual.unwrap_or(if command_ok { goal } else { PackageState::Enabled }),
        });
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_shell_metacharacters_in_package_names() {
        assert!(validate_package_name("com.android.chrome").is_ok());
        assert!(validate_package_name("com_x.y2").is_ok());
        assert!(validate_package_name("com.x; rm -rf /sdcard/DCIM").is_err());
        assert!(validate_package_name("com.x`id`").is_err());
        assert!(validate_package_name("com.x$(id)").is_err());
        assert!(validate_package_name("com.x&&reboot").is_err());
        assert!(validate_package_name("com.x|sh").is_err());
        assert!(validate_package_name("").is_err());
        assert!(validate_package_name("com x").is_err());
    }

    #[test]
    fn disable_sequence_captures_the_primary_command_status() {
        let commands = build_commands(DebloatAction::Disable, 33, 0);
        assert_eq!(commands.len(), 3);
        let script = build_batch_script(&["com.a".to_string(), "com.b".to_string()], &commands);
        assert!(script.starts_with("for p in com.a com.b; do "));
        // Only the first command's status is captured, so a noisy `pm clear` cannot
        // mask a successful disable.
        assert_eq!(script.matches("st=$?").count(), 1);
        assert!(script.contains("pm disable-user --user 0 $p >/dev/null 2>&1; st=$?;"));
        assert!(script.ends_with("echo __ADBGUI_DEBLOAT__:$p:$st; done"));
    }

    #[test]
    fn disable_is_empty_below_sdk_23() {
        assert!(build_commands(DebloatAction::Disable, 22, 0).is_empty());
    }

    #[test]
    fn parses_per_package_status_lines() {
        let output = "Success\n__ADBGUI_DEBLOAT__:com.a:0\nnoise\n__ADBGUI_DEBLOAT__:com.b:1\n";
        let parsed = parse_batch_status(output);
        assert_eq!(parsed.get("com.a"), Some(&0));
        assert_eq!(parsed.get("com.b"), Some(&1));
        assert_eq!(parsed.len(), 2);
    }
}
