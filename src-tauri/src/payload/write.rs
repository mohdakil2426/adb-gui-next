//! High-performance write path using memory-mapped files and non-temporal stores.
//!
//! `NonTemporalWriter` bypasses CPU cache for large sequential writes by using
//! `memmap2::MmapMut` with explicit `msync`. This avoids cache pollution from
//! `BufWriter`'s 1 MB internal buffer.
//!
//! Usage:
//! ```ignore
//! let writer = NonTemporalWriter::new(&path, size)?;
//! writer.write_at(offset, data)?;
//! writer.flush()?;
//! ```

use std::fs::{File, OpenOptions};
use std::io::{Result, Seek, SeekFrom, Write};
use std::path::Path;

/// Memory-mapped file writer with non-temporal store semantics for large writes.
///
/// Wraps both a `File` (for `set_len` pre-allocation and `get_ref()` compatibility)
/// and a `MmapMut` (for cache-bypassing writes). The `File` is kept alive so that
/// `get_ref().set_len()` works at the start of extraction, before we switch to mmap
/// writes for the hot path.
///
/// Position tracking mirrors `BufWriter` semantics: `seek()` updates internal
/// position, `write()` writes at that position and advances it.
pub struct NonTemporalWriter {
    file: File,
    mmap: memmap2::MmapMut,
    pos: u64,
    flushed: bool,
}

impl NonTemporalWriter {
    /// Create a new NonTemporalWriter, pre-allocating the file to `size` bytes.
    ///
    /// Uses `set_len` to pre-allocate, then memory-maps the file for writing.
    /// The file is created with read+write permissions, truncated if it already exists.
    pub fn new(path: &Path, size: u64) -> Result<Self> {
        let file =
            OpenOptions::new().read(true).write(true).create(true).truncate(true).open(path)?;

        file.set_len(size)?;

        let mmap = unsafe { memmap2::MmapMut::map_mut(&file)? };

        Ok(Self { file, mmap, pos: 0, flushed: false })
    }

    /// Write data at the given absolute offset, bypassing CPU cache.
    ///
    /// This is the primary write API for partition extraction — use `write_at`
    /// with explicit offsets computed from block positions.
    pub fn write_at(&mut self, offset: u64, data: &[u8]) -> Result<usize> {
        let offset_usize = offset as usize;

        if offset_usize + data.len() > self.mmap.len() {
            let new_len = (offset_usize + data.len()).max(self.mmap.len() * 2);
            self.remap(new_len)?;
        }

        super::copy::copy_raw_slice(&mut self.mmap[offset_usize..offset_usize + data.len()], data);
        self.flushed = false;
        Ok(data.len())
    }

    /// Flush all pending writes to disk using `msync`.
    ///
    /// On POSIX, issues `madvise(MADV_SEQUENTIAL)` then `msync(MS_SYNC)`.
    /// On Windows, flushes the memory-mapped buffer synchronously.
    pub fn flush(&mut self) -> Result<()> {
        if self.flushed {
            return Ok(());
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            if self.mmap.len() > 4096 {
                let _ = unsafe {
                    libc::madvise(
                        self.mmap.as_ptr() as *mut libc::c_void,
                        self.mmap.len(),
                        libc::MADV_SEQUENTIAL,
                    )
                };
            }
            let _ = unsafe {
                libc::msync(self.mmap.as_ptr() as *mut libc::c_void, self.mmap.len(), libc::MS_SYNC)
            };
        }

        #[cfg(windows)]
        {
            self.mmap.flush()?;
        }

        self.flushed = true;
        Ok(())
    }

    /// Get a reference to the underlying `File` for pre-allocation via `set_len`.
    ///
    /// Note: Writes should go through `write_at()` or the `Write` trait impl,
    /// not directly to this `File`, to maintain non-temporal semantics.
    #[allow(dead_code)]
    pub fn get_ref(&self) -> &File {
        &self.file
    }

    fn remap(&mut self, new_len: usize) -> Result<()> {
        self.flush()?;
        // Create a temporary anonymous mmap to replace the old one before resizing.
        // Using `?` instead of `unwrap_unchecked()` to avoid undefined behavior
        // if the system is out of memory.
        let placeholder = memmap2::MmapMut::map_anon(1).map_err(|e| {
            std::io::Error::other(format!("failed to create placeholder mmap: {e}"))
        })?;
        let old_mmap = std::mem::replace(&mut self.mmap, placeholder);
        drop(old_mmap);
        self.file.set_len(new_len as u64)?;
        self.mmap = unsafe { memmap2::MmapMut::map_mut(&self.file)? };
        self.flushed = true;
        Ok(())
    }
}

impl Write for NonTemporalWriter {
    fn write(&mut self, buf: &[u8]) -> Result<usize> {
        let n = self.write_at(self.pos, buf)?;
        self.pos += n as u64;
        Ok(n)
    }

    fn flush(&mut self) -> Result<()> {
        self.flush()
    }
}

impl Seek for NonTemporalWriter {
    fn seek(&mut self, pos: SeekFrom) -> Result<u64> {
        match pos {
            SeekFrom::Start(off) => {
                self.pos = off;
            }
            SeekFrom::Current(off) => {
                self.pos = self.pos.wrapping_add_signed(off);
            }
            SeekFrom::End(off) => {
                self.pos = self.mmap.len() as u64;
                self.pos = self.pos.wrapping_add_signed(off);
            }
        }
        Ok(self.pos)
    }
}

impl Drop for NonTemporalWriter {
    fn drop(&mut self) {
        let _ = self.flush();
    }
}
