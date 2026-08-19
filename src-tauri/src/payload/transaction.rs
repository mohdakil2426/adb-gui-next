//! Transaction guard for atomic extraction with isolated scratch staging and automatic cleanup.
//!
//! Wraps extraction in a transaction that isolates work in a temporary staging
//! subfolder (`.tmp_tx_{session_id}`) inside the destination directory.
//!
//! On `commit()`, all staged artifacts are atomically moved to their target destinations
//! via [`move_file_cross_device`] and the staging directory is cleaned up.
//! On any error or `abort()`, only staged and registered files in the transaction are removed,
//! preserving all pre-existing user files in the target output directory.
//! If the guard is dropped without being committed (e.g. panic or early return), automatic
//! rollback takes place.

use crate::payload::storage_check::move_file_cross_device;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub struct TransactionGuard {
    /// Target output directory (never wiped wholesale).
    target_dir: PathBuf,
    /// Isolated temporary staging directory `.tmp_tx_{session_id}`.
    staging_dir: PathBuf,
    /// List of registered (staged_path, final_target_path) pairs.
    files: Mutex<Vec<(PathBuf, PathBuf)>>,
    committed: Mutex<bool>,
}

impl TransactionGuard {
    /// Creates a new `TransactionGuard` rooted at `target_dir` with a unique `.tmp_tx_{session_id}` staging directory.
    pub fn new(target_dir: PathBuf) -> Self {
        let session_id = {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.as_nanos());
            format!("{:016x}_{}", now, std::process::id())
        };

        let staging_dir = target_dir.join(format!(".tmp_tx_{}", session_id));
        let _ = std::fs::create_dir_all(&staging_dir);

        Self {
            target_dir,
            staging_dir,
            files: Mutex::new(Vec::new()),
            committed: Mutex::new(false),
        }
    }

    /// Returns the isolated scratch staging directory for this transaction session.
    pub fn staging_dir(&self) -> &Path {
        &self.staging_dir
    }

    /// Returns the final target output directory.
    pub fn target_dir(&self) -> &Path {
        &self.target_dir
    }

    /// Generates a staged file path inside `.tmp_tx_{session_id}` for the given file name.
    pub fn stage_path(&self, file_name: impl AsRef<Path>) -> PathBuf {
        self.staging_dir.join(file_name)
    }

    /// Registers a created file path with the transaction.
    ///
    /// If `path` is within `staging_dir`, it is mapped to be moved to `target_dir` on `commit()`.
    /// If `path` is directly in `target_dir` (direct write), it is tracked for rollback on abort.
    pub fn add_file(&self, path: PathBuf) {
        let mut files = self.files.lock().unwrap_or_else(|e| {
            log::error!("Lock poisoned, recovering: {}", e);
            e.into_inner()
        });

        if path.starts_with(&self.staging_dir) {
            let file_name =
                path.file_name().map_or_else(|| PathBuf::from("unnamed.img"), PathBuf::from);
            let final_target = self.target_dir.join(file_name);
            files.push((path, final_target));
        } else {
            files.push((path.clone(), path));
        }
    }

    /// Explicitly registers a staged file and its corresponding final target path.
    pub fn add_staged_file(&self, staged_path: PathBuf, final_path: PathBuf) {
        let mut files = self.files.lock().unwrap_or_else(|e| {
            log::error!("Lock poisoned, recovering: {}", e);
            e.into_inner()
        });
        files.push((staged_path, final_path));
    }

    /// Aborts the transaction immediately, deleting all staged and registered files
    /// and removing the isolated staging folder. Pre-existing user files are untouched.
    pub fn abort(&self) {
        let files: Vec<(PathBuf, PathBuf)> = {
            let mut files = self.files.lock().unwrap_or_else(|e| {
                log::error!("Lock poisoned, recovering: {}", e);
                e.into_inner()
            });
            std::mem::take(&mut *files)
        };

        for (staged, final_path) in files {
            if staged.exists() {
                let _ = std::fs::remove_file(&staged);
            }
            if final_path.exists() && final_path != staged {
                let _ = std::fs::remove_file(&final_path);
            }
        }

        if self.staging_dir.exists() {
            let _ = std::fs::remove_dir_all(&self.staging_dir);
        }
    }

    /// Commits the transaction: moves all staged files into `target_dir` via [`move_file_cross_device`],
    /// cleans up `.tmp_tx_{session_id}`, and marks the transaction as complete.
    pub fn commit(&self) {
        let mut committed = self.committed.lock().unwrap_or_else(|e| {
            log::error!("Lock poisoned, recovering: {}", e);
            e.into_inner()
        });

        let files: Vec<(PathBuf, PathBuf)> = {
            let mut files = self.files.lock().unwrap_or_else(|e| {
                log::error!("Lock poisoned, recovering: {}", e);
                e.into_inner()
            });
            std::mem::take(&mut *files)
        };

        for (staged, final_target) in files {
            if staged != final_target
                && staged.exists()
                && let Err(e) = move_file_cross_device(&staged, &final_target)
            {
                log::error!(
                    "Failed to move staged file {} to {}: {}",
                    staged.display(),
                    final_target.display(),
                    e
                );
            }
        }

        if self.staging_dir.exists() {
            let _ = std::fs::remove_dir_all(&self.staging_dir);
        }

        *committed = true;
    }
}

impl Drop for TransactionGuard {
    fn drop(&mut self) {
        let is_committed = *self.committed.lock().unwrap_or_else(|e| {
            log::error!("Lock poisoned, recovering: {}", e);
            e.into_inner()
        });

        if !is_committed {
            let files: Vec<(PathBuf, PathBuf)> = {
                let mut files = self.files.lock().unwrap_or_else(|e| {
                    log::error!("Lock poisoned, recovering: {}", e);
                    e.into_inner()
                });
                std::mem::take(&mut *files)
            };

            for (staged, final_path) in files {
                if staged.exists() {
                    let _ = std::fs::remove_file(&staged);
                }
                if final_path.exists() && final_path != staged {
                    let _ = std::fs::remove_file(&final_path);
                }
            }

            if self.staging_dir.exists() {
                let _ = std::fs::remove_dir_all(&self.staging_dir);
            }
        } else if self.staging_dir.exists() {
            let _ = std::fs::remove_dir_all(&self.staging_dir);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_staged_commit_moves_files_and_cleans_staging() {
        let temp = tempdir().expect("tempdir");
        let output_dir = temp.path().join("output");
        fs::create_dir_all(&output_dir).expect("create dir");

        let guard = TransactionGuard::new(output_dir.clone());
        let staged = guard.stage_path("system.img");
        fs::write(&staged, b"system image data").expect("write staged");
        guard.add_file(staged.clone());

        assert!(staged.exists());
        assert!(guard.staging_dir().exists());

        guard.commit();

        let final_path = output_dir.join("system.img");
        assert!(final_path.exists(), "Final file should exist after commit");
        assert_eq!(fs::read(&final_path).expect("read final"), b"system image data");
        assert!(!guard.staging_dir().exists(), "Staging dir should be cleaned up");
    }

    #[test]
    fn test_staged_abort_cleans_up_without_affecting_target() {
        let temp = tempdir().expect("tempdir");
        let output_dir = temp.path().join("output");
        fs::create_dir_all(&output_dir).expect("create dir");

        let pre_existing = output_dir.join("user_existing.txt");
        fs::write(&pre_existing, b"do not touch").expect("write pre-existing");

        let guard = TransactionGuard::new(output_dir.clone());
        let staged = guard.stage_path("vendor.img");
        fs::write(&staged, b"vendor data").expect("write staged");
        guard.add_file(staged.clone());

        guard.abort();

        assert!(!staged.exists());
        assert!(!output_dir.join("vendor.img").exists());
        assert!(pre_existing.exists(), "Pre-existing user files must be preserved");
    }

    #[test]
    fn test_staged_drop_without_commit_cleans_up() {
        let temp = tempdir().expect("tempdir");
        let output_dir = temp.path().join("output");
        fs::create_dir_all(&output_dir).expect("create dir");

        let staging_dir_path;
        {
            let guard = TransactionGuard::new(output_dir.clone());
            staging_dir_path = guard.staging_dir().to_path_buf();
            let staged = guard.stage_path("boot.img");
            fs::write(&staged, b"boot data").expect("write staged");
            guard.add_file(staged);
            // Drop without commit
        }

        assert!(
            !staging_dir_path.exists(),
            "Staging directory should be deleted on uncommitted drop"
        );
        assert!(!output_dir.join("boot.img").exists(), "Final file should not exist");
        assert!(output_dir.exists(), "Target directory must survive");
    }
}
