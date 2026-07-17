//! Transaction guard for atomic extraction with automatic cleanup on failure.
//!
//! Wraps extraction in a transaction that records all created files.
//! On any error, `abort()` deletes all registered files.
//! On success, `commit()` marks the transaction as complete (no-op on drop).
//!
//! If the guard is dropped without being committed (e.g., due to a panic or
//! early return), all registered extract files are automatically cleaned up.
//! The parent output directory itself is never deleted (user-chosen folders
//! may contain unrelated data).

use std::path::PathBuf;

pub struct TransactionGuard {
    /// Output directory (kept for context/logging; never wiped wholesale).
    #[allow(dead_code)]
    dir: PathBuf,
    files: std::sync::Mutex<Vec<PathBuf>>,
    committed: std::sync::Mutex<bool>,
}

impl TransactionGuard {
    pub fn new(dir: PathBuf) -> Self {
        Self {
            dir,
            files: std::sync::Mutex::new(Vec::new()),
            committed: std::sync::Mutex::new(false),
        }
    }

    pub fn add_file(&self, path: PathBuf) {
        let mut files = self.files.lock().unwrap_or_else(|e| {
            log::error!("Lock poisoned, recovering: {}", e);
            e.into_inner()
        });
        files.push(path);
    }

    pub fn abort(&self) {
        let files: Vec<PathBuf> = {
            let mut files = self.files.lock().unwrap_or_else(|e| {
                log::error!("Lock poisoned, recovering: {}", e);
                e.into_inner()
            });
            std::mem::take(&mut *files)
        };
        // Only delete registered extract artifacts — never wipe the entire
        // user-chosen output directory (may contain unrelated files).
        for file in files {
            let _ = std::fs::remove_file(&file);
        }
    }

    pub fn commit(&self) {
        let mut committed = self.committed.lock().unwrap_or_else(|e| {
            log::error!("Lock poisoned, recovering: {}", e);
            e.into_inner()
        });
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
            let files: Vec<PathBuf> = {
                let mut files = self.files.lock().unwrap_or_else(|e| {
                    log::error!("Lock poisoned, recovering: {}", e);
                    e.into_inner()
                });
                std::mem::take(&mut *files)
            };
            // Only registered files — never remove_dir_all on user output dirs.
            for file in files {
                let _ = std::fs::remove_file(&file);
            }
        }
    }
}
