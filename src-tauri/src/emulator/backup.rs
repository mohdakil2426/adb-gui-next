use crate::emulator::models::{BackupEntry, RestorePlan};
use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub fn backup_path_for(path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.backup", path.to_string_lossy()))
}

pub fn build_backup_entry(path: PathBuf) -> BackupEntry {
    BackupEntry {
        original_path: path.to_string_lossy().to_string(),
        backup_path: backup_path_for(&path).to_string_lossy().to_string(),
    }
}

pub fn build_restore_plan(source: &str, paths: &[PathBuf]) -> RestorePlan {
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".into());

    RestorePlan {
        entries: paths.iter().cloned().map(build_backup_entry).collect(),
        created_at,
        source: source.to_string(),
    }
}

pub fn backup_exists(path: &Path) -> bool {
    backup_path_for(path).exists()
}

pub fn ensure_backup(path: &Path) -> Result<BackupEntry, String> {
    let entry = build_backup_entry(path.to_path_buf());
    let backup_path = PathBuf::from(&entry.backup_path);

    if !backup_path.exists() {
        std::fs::copy(path, &backup_path).map_err(|error| error.to_string())?;
    }

    Ok(entry)
}

pub fn restore_backups(paths: &[PathBuf]) -> Result<Vec<BackupEntry>, String> {
    let entries: Vec<BackupEntry> = paths.iter().cloned().map(build_backup_entry).collect();

    if entries.iter().any(|entry| !Path::new(&entry.backup_path).exists()) {
        return Err("One or more backup files are missing.".into());
    }

    for entry in &entries {
        std::fs::copy(&entry.backup_path, &entry.original_path)
            .map_err(|error| error.to_string())?;
    }

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn build_backup_entry_appends_backup_suffix() {
        let entry = build_backup_entry(PathBuf::from(
            "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img",
        ));
        assert_eq!(
            entry.original_path,
            "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img"
        );
        assert_eq!(
            entry.backup_path,
            "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img.backup"
        );
    }

    #[test]
    fn build_restore_plan_includes_source_and_entries() {
        let plan = build_restore_plan(
            "Pixel_8_API_34",
            &[PathBuf::from(
                "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img",
            )],
        );

        assert_eq!(plan.source, "Pixel_8_API_34");
        assert_eq!(plan.entries.len(), 1);
        assert_eq!(
            plan.entries[0].backup_path,
            "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img.backup"
        );
        assert!(!plan.created_at.is_empty());
    }
}
