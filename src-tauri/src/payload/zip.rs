//! ZIP payload handling and caching.

use anyhow::Result;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use zip::ZipArchive;

#[derive(Debug, Default)]
pub struct PayloadCache {
    inner: Mutex<PayloadCacheInner>,
}

#[derive(Debug, Default)]
struct PayloadCacheInner {
    cached_zip_path: Option<PathBuf>,
    cached_payload_path: Option<PathBuf>,
    cached_bytes: Option<Vec<u8>>,
}

impl PayloadCache {
    /// Clean up any cached temporary files.
    pub fn cleanup(&self) -> Result<()> {
        let mut inner =
            self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;
        if let Some(path) = inner.cached_payload_path.take() {
            let _ = fs::remove_file(path);
        }
        inner.cached_zip_path = None;
        inner.cached_bytes = None;
        Ok(())
    }

    /// Read payload bytes, handling ZIP extraction if needed.
    pub fn read_payload(&self, payload_path: &Path) -> Result<Vec<u8>> {
        if !is_zip_path(payload_path) {
            return fs::read(payload_path)
                .map_err(|e| anyhow::anyhow!("failed to read payload: {e}"));
        }

        let mut inner =
            self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;

        // Return cached bytes if same ZIP
        if inner.cached_zip_path.as_deref() == Some(payload_path)
            && let Some(cached_bytes) = inner.cached_bytes.as_ref()
        {
            return Ok(cached_bytes.clone());
        }

        // Clear old cache
        if let Some(previous_payload_path) = inner.cached_payload_path.take() {
            let _ = fs::remove_file(previous_payload_path);
        }
        inner.cached_zip_path = None;
        inner.cached_bytes = None;

        // Extract from ZIP
        let bytes = extract_payload_bytes_from_zip(payload_path)?;
        inner.cached_zip_path = Some(payload_path.to_path_buf());
        inner.cached_bytes = Some(bytes.clone());
        Ok(bytes)
    }
}

fn is_zip_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("zip"))
        .unwrap_or(false)
}

fn extract_payload_bytes_from_zip(zip_path: &Path) -> Result<Vec<u8>> {
    let file = fs::File::open(zip_path)?;
    let mut archive = ZipArchive::new(file)?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.name() != "payload.bin" || entry.size() == 0 {
            continue;
        }

        let mut bytes = Vec::with_capacity(entry.size() as usize);
        std::io::copy(&mut entry, &mut bytes)?;
        return Ok(bytes);
    }

    anyhow::bail!("payload.bin not found in ZIP archive")
}
