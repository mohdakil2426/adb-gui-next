use std::{
    collections::HashSet,
    env,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EmulatorEnv {
    pub android_sdk_root: Option<PathBuf>,
    pub android_home: Option<PathBuf>,
    pub android_avd_home: Option<PathBuf>,
    pub local_app_data: Option<PathBuf>,
    pub home_dir: Option<PathBuf>,
}

fn sdk_path_from_home(home_dir: &Path) -> PathBuf {
    if home_dir.file_name().is_some_and(|segment| segment.eq_ignore_ascii_case("android")) {
        home_dir.join("Sdk")
    } else {
        home_dir.join("Android").join("Sdk")
    }
}

pub fn sdk_roots_from_env(env: &EmulatorEnv) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut roots = Vec::new();

    for candidate in [
        env.android_sdk_root.clone(),
        env.android_home.clone(),
        env.local_app_data.as_ref().map(|path| path.join("Android").join("Sdk")),
        env.home_dir.as_ref().map(|path| sdk_path_from_home(path)),
    ]
    .into_iter()
    .flatten()
    {
        let normalized = candidate.to_string_lossy().replace('\\', "/");
        if seen.insert(normalized) {
            roots.push(candidate);
        }
    }

    roots
}

pub fn current_env() -> EmulatorEnv {
    let home_dir = env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from));

    EmulatorEnv {
        android_sdk_root: env::var_os("ANDROID_SDK_ROOT").map(PathBuf::from),
        android_home: env::var_os("ANDROID_HOME").map(PathBuf::from),
        android_avd_home: env::var_os("ANDROID_AVD_HOME").map(PathBuf::from),
        local_app_data: env::var_os("LOCALAPPDATA").map(PathBuf::from),
        home_dir,
    }
}

pub fn sdk_roots_from_current_env() -> Vec<PathBuf> {
    sdk_roots_from_env(&current_env())
}

pub fn resolve_avd_home_from_env(env: &EmulatorEnv) -> Option<PathBuf> {
    env.android_avd_home
        .clone()
        .or_else(|| env.home_dir.as_ref().map(|path| path.join(".android").join("avd")))
}

pub fn resolve_avd_home() -> Option<PathBuf> {
    resolve_avd_home_from_env(&current_env())
}

/// Resolves the `emulator` binary from the Android SDK installation.
/// Looks inside `$SDK/emulator/emulator[.exe]` across all candidate SDK roots.
/// Does NOT require `emulator` to be on the system PATH.
pub fn resolve_emulator_binary(env: &EmulatorEnv) -> Option<PathBuf> {
    let sdk_roots = sdk_roots_from_env(env);

    #[cfg(target_os = "windows")]
    let binary_name = "emulator.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "emulator";

    sdk_roots
        .iter()
        .map(|root| root.join("emulator").join(binary_name))
        .find(|candidate| candidate.exists())
}

pub fn resolve_emulator_binary_from_current_env() -> Option<PathBuf> {
    resolve_emulator_binary(&current_env())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn sdk_roots_prioritize_explicit_env_vars() {
        let env = EmulatorEnv {
            android_sdk_root: Some(PathBuf::from("C:/Android/Sdk")),
            android_home: Some(PathBuf::from("C:/Legacy/Sdk")),
            local_app_data: Some(PathBuf::from("C:/Users/test/AppData/Local")),
            home_dir: Some(PathBuf::from("/home/test")),
            ..Default::default()
        };

        assert_eq!(
            sdk_roots_from_env(&env),
            vec![
                PathBuf::from("C:/Android/Sdk"),
                PathBuf::from("C:/Legacy/Sdk"),
                PathBuf::from("C:/Users/test/AppData/Local/Android/Sdk"),
                PathBuf::from("/home/test/Android/Sdk"),
            ]
        );
    }

    #[test]
    fn sdk_roots_deduplicate_repeated_candidates() {
        let env = EmulatorEnv {
            android_sdk_root: Some(PathBuf::from("C:/Android/Sdk")),
            android_home: Some(PathBuf::from("C:/Android/Sdk")),
            local_app_data: Some(PathBuf::from("C:/Users/test/AppData/Local")),
            home_dir: Some(PathBuf::from("C:/Users/test/AppData/Local/Android")),
            ..Default::default()
        };

        assert_eq!(
            sdk_roots_from_env(&env),
            vec![
                PathBuf::from("C:/Android/Sdk"),
                PathBuf::from("C:/Users/test/AppData/Local/Android/Sdk"),
            ]
        );
    }
}
