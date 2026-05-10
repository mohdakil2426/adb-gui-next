//! Zero-copy memory-mapping for STORED ZIP entries.
//! Avoids loading the entire ZIP into memory or creating temp files.

use memmap2::Mmap;
use std::path::Path;
use std::sync::Arc;

pub struct ZipPayloadMmap {
    mmap: Arc<Mmap>,
    payload_offset: usize,
    payload_len: usize,
}

impl ZipPayloadMmap {
    pub fn mmap_zip_payload(
        zip_path: &Path,
        entry_offset: u64,
        entry_size: u64,
    ) -> std::io::Result<Self> {
        let file = std::fs::File::open(zip_path)?;
        let mmap = unsafe { Mmap::map(&file)? };

        Ok(Self {
            mmap: Arc::new(mmap),
            payload_offset: entry_offset as usize,
            payload_len: entry_size as usize,
        })
    }
}

impl std::ops::Deref for ZipPayloadMmap {
    type Target = [u8];
    fn deref(&self) -> &[u8] {
        &self.mmap[self.payload_offset..self.payload_offset + self.payload_len]
    }
}
