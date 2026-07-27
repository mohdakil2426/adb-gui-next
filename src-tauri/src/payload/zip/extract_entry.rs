//! ZIP payload handling and caching.
//!
//! Local ZIPs may contain `payload.bin` either STORED (compression method 0)
//! or deflated. STORED entries are memory-mapped as a zero-copy window into the
//! archive via [`ZipPayloadMmap`]. Deflated entries are streamed to a temporary
//! file (never fully buffered in RAM) and then mapped.

use super::stored_window::ZipPayloadMmap;
use ::zip::{CompressionMethod, ZipArchive};
use anyhow::Result;
use std::{
    fs,
    io::BufReader,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tempfile::NamedTempFile;

#[derive(Debug, Default)]
pub struct PayloadCache {
    inner: Mutex<PayloadCacheInner>,
}

#[derive(Default)]
struct PayloadCacheInner {
    /// Source path this cache entry was opened from (ZIP or plain `.bin`).
    cached_source_path: Option<PathBuf>,
    /// Path to a temp-extracted `payload.bin` when the ZIP entry was deflated.
    /// `None` for plain files and STORED ZIP windows (no temp file).
    cached_temp_path: Option<PathBuf>,
    /// Shared mmap view of payload bytes.
    cached_payload: Option<Arc<ZipPayloadMmap>>,
}

// Manual Debug: ZipPayloadMmap is not Debug.
impl std::fmt::Debug for PayloadCacheInner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PayloadCacheInner")
            .field("cached_source_path", &self.cached_source_path)
            .field("cached_temp_path", &self.cached_temp_path)
            .field("cached_payload", &self.cached_payload.as_ref().map(|p| p.len()))
            .finish()
    }
}

/// Last-resort cleanup: a cache dropped without `cleanup()` would otherwise leave
/// its multi-GB temp extraction on disk forever.
impl Drop for PayloadCache {
    fn drop(&mut self) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        discard_cached_temp(&mut inner);
    }
}

/// Drop the mapping before unlinking its backing file — Windows refuses to delete
/// a file that is still mapped, which is exactly how the temp file leaked.
fn discard_cached_temp(inner: &mut PayloadCacheInner) {
    drop(inner.cached_payload.take());
    if let Some(path) = inner.cached_temp_path.take() {
        let _ = fs::remove_file(path);
    }
}

impl PayloadCache {
    /// Clean up any cached temporary files and reset state.
    pub fn cleanup(&self) -> Result<()> {
        let mut inner =
            self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;
        discard_cached_temp(&mut inner);
        inner.cached_source_path = None;
        Ok(())
    }

    /// Open `payload.bin` as a shared memory-mapped view.
    ///
    /// - Plain `.bin`: full-file mmap.
    /// - ZIP **STORED**: zero-copy window into the archive (no temp file).
    /// - ZIP **deflated** (or other compressed methods): stream to a temp file,
    ///   then mmap the temp file.
    pub fn open_payload(&self, payload_path: &Path) -> Result<Arc<ZipPayloadMmap>> {
        if !is_zip_path(payload_path) {
            return ZipPayloadMmap::mmap_file(payload_path).map(Arc::new).map_err(|e| {
                anyhow::anyhow!("cannot mmap payload '{}': {e}", payload_path.display())
            });
        }

        if let Some(hit) = self.cached_view(payload_path)? {
            return Ok(hit);
        }

        // Lock released: `open_zip_payload` streams a multi-GB member to a temp
        // file, and holding the guard across it blocked every other payload
        // operation for the whole download.
        let opened = open_zip_payload(payload_path)?;

        let mut inner =
            self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;

        // Another caller may have finished the same work while we were unlocked.
        if inner.cached_source_path.as_deref() == Some(payload_path)
            && let Some(ref payload) = inner.cached_payload
        {
            let winner = Arc::clone(payload);
            drop(inner);
            drop(opened.mmap);
            if let Some(path) = opened.temp_path {
                let _ = fs::remove_file(path);
            }
            return Ok(winner);
        }

        discard_cached_temp(&mut inner);
        inner.cached_source_path = Some(payload_path.to_path_buf());
        inner.cached_temp_path = opened.temp_path;
        let arc = Arc::new(opened.mmap);
        inner.cached_payload = Some(Arc::clone(&arc));
        Ok(arc)
    }

    /// Cache lookup that holds the lock only for the lookup itself.
    fn cached_view(&self, payload_path: &Path) -> Result<Option<Arc<ZipPayloadMmap>>> {
        let inner =
            self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;
        if inner.cached_source_path.as_deref() == Some(payload_path)
            && let Some(ref payload) = inner.cached_payload
        {
            return Ok(Some(Arc::clone(payload)));
        }
        Ok(None)
    }

    /// Returns the filesystem path to `payload.bin`, extracting it from a ZIP if needed.
    ///
    /// For plain `.bin` files, returns the path as-is (no copy).
    /// For `.zip` files, always extracts to a temp file (including STORED entries).
    /// Prefer [`Self::open_payload`] for zero-copy STORED access.
    pub fn get_payload_path(&self, payload_path: &Path) -> Result<PathBuf> {
        if !is_zip_path(payload_path) {
            return Ok(payload_path.to_path_buf());
        }

        {
            let inner =
                self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;

            // Return cached temp path if same ZIP is already extracted and temp file still exists.
            if inner.cached_source_path.as_deref() == Some(payload_path)
                && let Some(ref p) = inner.cached_temp_path
                && p.exists()
            {
                return Ok(p.clone());
            }
        }

        // Lock released across the streaming extract (same reason as `open_payload`).
        let temp_path = extract_payload_to_tempfile(payload_path)?;

        let mut inner =
            self.inner.lock().map_err(|_| anyhow::anyhow!("payload cache lock poisoned"))?;
        // Path-based API forces temp extract; drop any STORED window cache for this source.
        discard_cached_temp(&mut inner);
        inner.cached_source_path = Some(payload_path.to_path_buf());
        inner.cached_temp_path = Some(temp_path.clone());
        Ok(temp_path)
    }

    /// Legacy helper used by tests.
    #[allow(dead_code)]
    pub fn read_payload(&self, payload_path: &Path) -> Result<Vec<u8>> {
        let view = self.open_payload(payload_path)?;
        Ok(view.to_vec())
    }
}

fn is_zip_path(path: &Path) -> bool {
    path.extension().and_then(|ext| ext.to_str()).is_some_and(|ext| ext.eq_ignore_ascii_case("zip"))
}

struct OpenedZipPayload {
    mmap: ZipPayloadMmap,
    temp_path: Option<PathBuf>,
}

/// Open `payload.bin` from a local ZIP: STORED → mmap window; else temp extract.
fn open_zip_payload(zip_path: &Path) -> Result<OpenedZipPayload> {
    let file = fs::File::open(zip_path)
        .map_err(|e| anyhow::anyhow!("cannot open ZIP '{}': {e}", zip_path.display()))?;
    let mut archive = ZipArchive::new(BufReader::new(file))
        .map_err(|e| anyhow::anyhow!("cannot read ZIP '{}': {e}", zip_path.display()))?;

    for index in 0..archive.len() {
        let entry = archive.by_index(index)?;
        if entry.name() != "payload.bin" || entry.size() == 0 {
            continue;
        }

        if entry.compression() == CompressionMethod::Stored {
            let offset = entry.data_start().ok_or_else(|| {
                anyhow::anyhow!(
                    "STORED payload.bin in '{}' has no data start offset",
                    zip_path.display()
                )
            })?;
            let size = entry.size();
            // Release archive before re-opening the path for mmap.
            drop(entry);
            drop(archive);

            let mmap = ZipPayloadMmap::mmap_zip_payload(zip_path, offset, size).map_err(|e| {
                anyhow::anyhow!("cannot mmap STORED payload.bin in '{}': {e}", zip_path.display())
            })?;
            return Ok(OpenedZipPayload { mmap, temp_path: None });
        }

        // Deflated / other compressed methods: stream to temp, never load full payload in RAM.
        let mut entry = entry;
        let mut temp =
            NamedTempFile::new().map_err(|e| anyhow::anyhow!("failed to create temp file: {e}"))?;

        std::io::copy(&mut entry, temp.as_file_mut())
            .map_err(|e| anyhow::anyhow!("failed to stream payload.bin from ZIP: {e}"))?;

        let (_, path) =
            temp.keep().map_err(|e| anyhow::anyhow!("failed to persist temp file: {e}"))?;

        let mmap = ZipPayloadMmap::mmap_file(&path).map_err(|e| {
            anyhow::anyhow!("cannot mmap extracted payload '{}': {e}", path.display())
        })?;
        return Ok(OpenedZipPayload { mmap, temp_path: Some(path) });
    }

    anyhow::bail!("payload.bin not found in ZIP archive '{}'", zip_path.display())
}

/// Stream `payload.bin` out of a ZIP archive to a temporary file on disk.
///
/// Used by the path-based API ([`PayloadCache::get_payload_path`]) for any
/// compression method. Prefer [`open_zip_payload`] / [`PayloadCache::open_payload`]
/// when a memory-mapped view is enough.
fn extract_payload_to_tempfile(zip_path: &Path) -> Result<PathBuf> {
    let file = fs::File::open(zip_path)
        .map_err(|e| anyhow::anyhow!("cannot open ZIP '{}': {e}", zip_path.display()))?;
    let mut archive = ZipArchive::new(BufReader::new(file))
        .map_err(|e| anyhow::anyhow!("cannot read ZIP '{}': {e}", zip_path.display()))?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.name() != "payload.bin" || entry.size() == 0 {
            continue;
        }

        let mut temp =
            NamedTempFile::new().map_err(|e| anyhow::anyhow!("failed to create temp file: {e}"))?;

        std::io::copy(&mut entry, temp.as_file_mut())
            .map_err(|e| anyhow::anyhow!("failed to stream payload.bin from ZIP: {e}"))?;

        let (_, path) =
            temp.keep().map_err(|e| anyhow::anyhow!("failed to persist temp file: {e}"))?;

        return Ok(path);
    }

    anyhow::bail!("payload.bin not found in ZIP archive '{}'", zip_path.display())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ::zip::ZipWriter;
    use ::zip::write::SimpleFileOptions;
    use std::io::Write;
    use tempfile::tempdir;

    fn write_stored_zip(zip_path: &Path, payload: &[u8]) {
        let file = fs::File::create(zip_path).expect("create zip");
        let mut zip = ZipWriter::new(file);
        zip.start_file(
            "payload.bin",
            SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
        )
        .expect("start");
        zip.write_all(payload).expect("write");
        zip.finish().expect("finish");
    }

    fn write_deflated_zip(zip_path: &Path, payload: &[u8]) {
        let file = fs::File::create(zip_path).expect("create zip");
        let mut zip = ZipWriter::new(file);
        zip.start_file(
            "payload.bin",
            SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
        )
        .expect("start");
        zip.write_all(payload).expect("write");
        zip.finish().expect("finish");
    }

    #[test]
    fn open_payload_stored_zip_has_no_temp_file() {
        let temp = tempdir().expect("tempdir");
        let zip_path = temp.path().join("stored.zip");
        let payload = b"CrAU\x00\x00\x00\x00\x00\x00\x00\x02hello-stored";
        write_stored_zip(&zip_path, payload);

        let cache = PayloadCache::default();
        let view = cache.open_payload(&zip_path).expect("open stored");
        assert_eq!(&view[..], payload);

        let inner = cache.inner.lock().expect("lock");
        assert!(inner.cached_temp_path.is_none(), "STORED must not create a temp file");
        assert!(inner.cached_payload.is_some());
    }

    #[test]
    fn open_payload_deflated_zip_uses_temp_file() {
        let temp = tempdir().expect("tempdir");
        let zip_path = temp.path().join("deflated.zip");
        // Compressible payload so deflate actually shrinks / differs from STORED layout.
        let payload = vec![0xABu8; 4096];
        write_deflated_zip(&zip_path, &payload);

        let cache = PayloadCache::default();
        let view = cache.open_payload(&zip_path).expect("open deflated");
        assert_eq!(&view[..], payload.as_slice());

        let inner = cache.inner.lock().expect("lock");
        let temp_path = inner.cached_temp_path.as_ref().expect("deflated must use temp");
        assert!(temp_path.exists());
    }

    #[test]
    fn open_payload_caches_same_zip() {
        let temp = tempdir().expect("tempdir");
        let zip_path = temp.path().join("cached.zip");
        write_stored_zip(&zip_path, b"CrAUcache-me");

        let cache = PayloadCache::default();
        let a = cache.open_payload(&zip_path).expect("open a");
        let b = cache.open_payload(&zip_path).expect("open b");
        assert!(Arc::ptr_eq(&a, &b));
    }
}
