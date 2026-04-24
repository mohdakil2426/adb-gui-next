use crate::CmdResult;
use crate::debloat::{DebloatActionResult, PackageState};
use crate::helpers::run_binary_command;
use log::info;
use tauri::AppHandle;

/// The action to apply to a package.
#[derive(Debug, Clone, PartialEq, Eq)]
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

/// Resolve the correct ADB commands for the given action based on Android SDK version.
///
/// SDK ≥23 (Android 6.0+): full pm uninstall/disable/restore support per-user
/// SDK 21-22 (5.x):        use pm hide/unhide
/// SDK 19-20 (4.4):        use pm block/unblock
/// SDK <19:                use pm uninstall (no user flag, not reversible)
fn build_commands(package: &str, action: &DebloatAction, sdk: u32, user: u32) -> Vec<Vec<String>> {
    let user_str = user.to_string();
    let pkg = package.to_string();

    match action {
        DebloatAction::Uninstall => {
            if sdk >= 23 {
                vec![vec![
                    "shell".into(),
                    "pm".into(),
                    "uninstall".into(),
                    "--user".into(),
                    user_str,
                    pkg,
                ]]
            } else if sdk >= 21 {
                // pm hide + pm clear (Android 5.x)
                vec![
                    vec!["shell".into(), "pm".into(), "hide".into(), pkg.clone()],
                    vec!["shell".into(), "pm".into(), "clear".into(), pkg],
                ]
            } else if sdk >= 19 {
                // pm block + pm clear (Android 4.4)
                vec![
                    vec!["shell".into(), "pm".into(), "block".into(), pkg.clone()],
                    vec!["shell".into(), "pm".into(), "clear".into(), pkg],
                ]
            } else {
                // No user flag on very old Android
                vec![vec!["shell".into(), "pm".into(), "uninstall".into(), pkg]]
            }
        }
        DebloatAction::Disable => {
            if sdk >= 23 {
                vec![
                    vec![
                        "shell".into(),
                        "pm".into(),
                        "disable-user".into(),
                        "--user".into(),
                        user_str.clone(),
                        pkg.clone(),
                    ],
                    vec!["shell".into(), "am".into(), "force-stop".into(), pkg.clone()],
                    vec![
                        "shell".into(),
                        "pm".into(),
                        "clear".into(),
                        "--user".into(),
                        user_str,
                        pkg,
                    ],
                ]
            } else {
                // Disable not supported below SDK 23 — fallback to uninstall
                build_commands(package, &DebloatAction::Uninstall, sdk, user)
            }
        }
        DebloatAction::Restore => {
            if sdk >= 23 {
                vec![vec![
                    "shell".into(),
                    "cmd".into(),
                    "package".into(),
                    "install-existing".into(),
                    "--user".into(),
                    user_str,
                    pkg,
                ]]
            } else if sdk >= 21 {
                vec![vec!["shell".into(), "pm".into(), "unhide".into(), pkg]]
            } else if sdk >= 19 {
                vec![
                    vec!["shell".into(), "pm".into(), "unblock".into(), pkg.clone()],
                    vec!["shell".into(), "pm".into(), "clear".into(), pkg],
                ]
            } else {
                // Not reversible below SDK 19
                vec![]
            }
        }
    }
}

fn new_state_for_action(action: &DebloatAction) -> PackageState {
    match action {
        DebloatAction::Uninstall => PackageState::Uninstalled,
        DebloatAction::Disable => PackageState::Disabled,
        DebloatAction::Restore => PackageState::Enabled,
    }
}

/// Apply an action to a single package. Runs all required ADB commands in order.
fn apply_single(
    app: &AppHandle,
    package: &str,
    action: &DebloatAction,
    sdk: u32,
    user: u32,
) -> DebloatActionResult {
    info!("Debloat: {:?} {} (SDK {}, user {})", action, package, sdk, user);

    let commands = build_commands(package, action, sdk, user);

    if commands.is_empty() {
        return DebloatActionResult {
            package_name: package.to_string(),
            success: false,
            error: Some("Action not supported on this Android version (SDK < 19)".to_string()),
            new_state: PackageState::Enabled,
        };
    }

    let arg_refs: Vec<Vec<&str>> =
        commands.iter().map(|cmd| cmd.iter().map(String::as_str).collect()).collect();

    for args in &arg_refs {
        if let Err(e) = run_binary_command(app, "adb", args) {
            return DebloatActionResult {
                package_name: package.to_string(),
                success: false,
                error: Some(e),
                new_state: PackageState::Enabled,
            };
        }
    }

    DebloatActionResult {
        package_name: package.to_string(),
        success: true,
        error: None,
        new_state: new_state_for_action(action),
    }
}

/// Apply an action to multiple packages. Returns one result per package.
pub fn apply_package_actions(
    app: &AppHandle,
    packages: &[String],
    action_str: &str,
    sdk: u32,
    user: u32,
) -> CmdResult<Vec<DebloatActionResult>> {
    let action = DebloatAction::from_action_str(action_str)
        .ok_or_else(|| format!("Unknown action: {action_str}"))?;

    let results = packages.iter().map(|pkg| apply_single(app, pkg, &action, sdk, user)).collect();

    Ok(results)
}
