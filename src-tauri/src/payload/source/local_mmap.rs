//! Local memory-mapped payload source adapters.

use crate::payload::zip::ZipPayloadMmap;
use anyhow::Result;
use memmap2::Mmap;
use std::path::Path;
use std::sync::Arc;

/// Opens a local path as a read-only memory-mapped payload.
///
/// Thin wrapper over the parser `open_mmap` so callers can depend on `source`
/// without reaching into the CrAU parser module.
pub fn open_local_mmap(path: &Path) -> Result<Arc<Mmap>> {
    crate::payload::crau::open_mmap(path)
}

/// Opens a local path as a full-file [`ZipPayloadMmap`] window.
///
/// For ZIP archives with a STORED `payload.bin`, prefer
/// [`crate::payload::zip::PayloadCache::open_payload`] which selects the
/// zero-copy STORED path automatically.
pub fn open_local_payload_window(path: &Path) -> Result<Arc<ZipPayloadMmap>> {
    ZipPayloadMmap::mmap_file(path)
        .map(Arc::new)
        .map_err(|e| anyhow::anyhow!("cannot mmap payload '{}': {e}", path.display()))
}
