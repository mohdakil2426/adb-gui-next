//! Zero-copy memory-mapping for STORED ZIP entries and full payload files.
//!
//! Avoids loading the entire ZIP into RAM or creating temp files when
//! `payload.bin` is stored uncompressed (compression method 0).

use memmap2::Mmap;
use std::path::Path;

/// Memory-mapped view of `payload.bin` bytes: either a full file or a STORED
/// window inside a local ZIP archive.
///
/// Share via `Arc<ZipPayloadMmap>` so extraction threads clone an 8-byte
/// pointer; the OS page cache backs all reads. Implements [`Deref`] to `[u8]`
/// so slice indexing matches a raw `Mmap`.
pub struct ZipPayloadMmap {
    mmap: Mmap,
    payload_offset: usize,
    payload_len: usize,
}

impl ZipPayloadMmap {
    /// Map a plain `payload.bin` (or a temp-extracted payload) as a full-file window.
    pub fn mmap_file(path: &Path) -> std::io::Result<Self> {
        let file = std::fs::File::open(path)?;
        // SAFETY: Read-only mapping. Callers never mutate/truncate/delete the
        // file while this mapping is held for the duration of extract/list.
        let mmap = unsafe { Mmap::map(&file)? };
        let len = mmap.len();
        Ok(Self { mmap, payload_offset: 0, payload_len: len })
    }

    /// Map a STORED ZIP entry as a window into the archive file.
    ///
    /// `entry_offset` is the absolute file offset of the entry's compressed
    /// data (after local header + name + extra). For STORED entries,
    /// compressed size equals uncompressed size; pass that as `entry_size`.
    pub fn mmap_zip_payload(
        zip_path: &Path,
        entry_offset: u64,
        entry_size: u64,
    ) -> std::io::Result<Self> {
        let file = std::fs::File::open(zip_path)?;
        // SAFETY: Same read-only invariants as `mmap_file`.
        let mmap = unsafe { Mmap::map(&file)? };

        let payload_offset = usize::try_from(entry_offset).map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "ZIP entry offset too large")
        })?;
        let payload_len = usize::try_from(entry_size).map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "ZIP entry size too large")
        })?;

        let end = payload_offset.checked_add(payload_len).ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "ZIP entry range overflow")
        })?;
        if end > mmap.len() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "STORED ZIP entry exceeds archive size",
            ));
        }

        Ok(Self { mmap, payload_offset, payload_len })
    }

    /// Absolute offset of the payload window within the backing map.
    #[cfg(test)]
    pub fn payload_offset(&self) -> usize {
        self.payload_offset
    }
}

impl std::ops::Deref for ZipPayloadMmap {
    type Target = [u8];

    fn deref(&self) -> &[u8] {
        &self.mmap[self.payload_offset..self.payload_offset + self.payload_len]
    }
}

impl AsRef<[u8]> for ZipPayloadMmap {
    fn as_ref(&self) -> &[u8] {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;
    use ::zip::write::SimpleFileOptions;
    use ::zip::{CompressionMethod, ZipArchive, ZipWriter};

    #[test]
    fn mmap_file_exposes_full_contents() {
        let temp = tempdir().expect("tempdir");
        let path = temp.path().join("payload.bin");
        std::fs::write(&path, b"CrAUhello").expect("write");

        let view = ZipPayloadMmap::mmap_file(&path).expect("mmap file");
        assert_eq!(&view[..], b"CrAUhello");
        assert_eq!(view.payload_offset(), 0);
    }

    #[test]
    fn mmap_stored_zip_entry_is_zero_copy_window() {
        let temp = tempdir().expect("tempdir");
        let zip_path = temp.path().join("ota.zip");
        let payload = b"CrAU\x00\x00\x00\x00\x00\x00\x00\x02stored-payload-bytes";

        {
            let file = std::fs::File::create(&zip_path).expect("create zip");
            let mut zip = ZipWriter::new(file);
            zip.start_file(
                "payload.bin",
                SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
            )
            .expect("start file");
            zip.write_all(payload).expect("write entry");
            zip.finish().expect("finish");
        }

        let file = std::fs::File::open(&zip_path).expect("open zip");
        let mut archive = ZipArchive::new(file).expect("read zip");
        let entry = archive.by_index(0).expect("entry");
        assert_eq!(entry.compression(), CompressionMethod::Stored);
        let offset = entry.data_start().expect("data start");
        let size = entry.size();
        drop(entry);
        drop(archive);

        let view =
            ZipPayloadMmap::mmap_zip_payload(&zip_path, offset, size).expect("mmap stored window");
        assert_eq!(&view[..], payload);
        assert!(view.payload_offset() > 0, "window should start after local header");
    }

    #[test]
    fn mmap_zip_payload_rejects_out_of_range() {
        let temp = tempdir().expect("tempdir");
        let zip_path = temp.path().join("tiny.zip");
        {
            let file = std::fs::File::create(&zip_path).expect("create");
            let mut zip = ZipWriter::new(file);
            zip.start_file(
                "payload.bin",
                SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
            )
            .expect("start");
            zip.write_all(b"short").expect("write");
            zip.finish().expect("finish");
        }

        let err = match ZipPayloadMmap::mmap_zip_payload(&zip_path, 0, 10_000_000) {
            Ok(_) => panic!("expected out-of-range error"),
            Err(e) => e,
        };
        assert_eq!(err.kind(), std::io::ErrorKind::UnexpectedEof);
    }
}
