//! ZIP payload handling and caching.
//!
//! Instead of loading `payload.bin` into RAM (4–6 GB), we stream it from the ZIP
//! to a temporary file on disk and cache only the file path. The extracted file is
//! memory-mapped by the caller via `memmap2`, meaning the OS page cache handles
//! all I/O — no heap allocation proportional to file size.

use anyhow::Result;
use std::{
    fs,
    io::BufReader,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tempfile::NamedTempFile;
use zip::ZipArchive;

#[derive(Debug, Default)]
pub struct PayloadCache {
    inner: Mutex<PayloadCacheInner>,
}

#[derive(Debug, Default)]
struct PayloadCacheInner {
    /// The ZIP file this cache entry was extracted from.
    cached_zip_path: Option<PathBuf>,
    /// Path to the extracted `payload.bin` temp file on disk.
    /// This replaces the old `cached_bytes: Option<Vec<u8>>` field.
    cached_payload_path: Option<PathBuf>,
}

impl PayloadCache {
    /// Clean up any cached temporary files and reset state.
    pub fn cleanup(&self) -> Result<()> {
        let mut inner =
            self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;
        if let Some(path) = inner.cached_payload_path.take() {
            let _ = fs::remove_file(path);
        }
        inner.cached_zip_path = None;
        Ok(())
    }

    /// Returns the filesystem path to `payload.bin`, extracting it from a ZIP if needed.
    ///
    /// For plain `.bin` files, returns the path as-is (no copy).
    /// For `.zip` files, extracts `payload.bin` to a temp file by streaming (never loads
    /// the full file into RAM) and caches the resulting path.
    pub fn get_payload_path(&self, payload_path: &Path) -> Result<PathBuf> {
        if !is_zip_path(payload_path) {
            return Ok(payload_path.to_path_buf());
        }

        let mut inner =
            self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;

        // Return cached path if same ZIP is already extracted and temp file still exists.
        if inner.cached_zip_path.as_deref() == Some(payload_path)
            && let Some(ref p) = inner.cached_payload_path
            && p.exists()
        {
            return Ok(p.clone());
        }

        // Clear any previous cached temp file.
        if let Some(previous_path) = inner.cached_payload_path.take() {
            let _ = fs::remove_file(previous_path);
        }
        inner.cached_zip_path = None;

        let temp_path = extract_payload_to_tempfile(payload_path)?;
        inner.cached_zip_path = Some(payload_path.to_path_buf());
        inner.cached_payload_path = Some(temp_path.clone());
        Ok(temp_path)
    }

    /// Legacy helper used by tests and `parser.rs` listing functions.
    ///
    /// Resolves the payload path and reads its raw bytes. Prefer `get_payload_path` for
    /// extraction flows where the mmap approach is used.
    pub fn read_payload(&self, payload_path: &Path) -> Result<Vec<u8>> {
        let path = self.get_payload_path(payload_path)?;
        fs::read(&path).map_err(|e| anyhow::anyhow!("failed to read payload: {e}"))
    }
}

fn is_zip_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("zip"))
        .unwrap_or(false)
}

/// Stream `payload.bin` out of a ZIP archive to a temporary file on disk.
///
/// Uses `BufReader` on the ZIP file for efficient central-directory parsing.
/// Streams the entry with `std::io::copy` (internal 8 KB buffer) — the full
/// decompressed content is never resident in RAM at once.
///
/// The returned `PathBuf` points to a persisted temp file that the caller is
/// responsible for deleting (via `PayloadCache::cleanup`).
fn extract_payload_to_tempfile(zip_path: &Path) -> Result<PathBuf> {
    let file = fs::File::open(zip_path)
        .map_err(|e| anyhow::anyhow!("cannot open ZIP '{}': {e}", zip_path.display()))?;
    // BufReader makes ZIP central-directory parsing faster for large archives.
    let mut archive = ZipArchive::new(BufReader::new(file))
        .map_err(|e| anyhow::anyhow!("cannot read ZIP '{}': {e}", zip_path.display()))?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.name() != "payload.bin" || entry.size() == 0 {
            continue;
        }

        // Create a temp file — written to disk, never buffered in RAM.
        let mut temp =
            NamedTempFile::new().map_err(|e| anyhow::anyhow!("failed to create temp file: {e}"))?;

        std::io::copy(&mut entry, temp.as_file_mut())
            .map_err(|e| anyhow::anyhow!("failed to stream payload.bin from ZIP: {e}"))?;

        // Persist the temp file so it survives `NamedTempFile` drop.
        // The path is tracked in `PayloadCacheInner` and cleaned up explicitly.
        let (_, path) =
            temp.keep().map_err(|e| anyhow::anyhow!("failed to persist temp file: {e}"))?;

        return Ok(path);
    }

    anyhow::bail!("payload.bin not found in ZIP archive '{}'", zip_path.display())
}
