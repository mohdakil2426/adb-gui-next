//! Output writer for extracted partition images.
//!
//! Two backends, picked at construction:
//!
//! - **Mapped** — `memmap2::MmapMut` over a pre-allocated file. Used when the
//!   manifest declares a size, that size fits the address space, and it stays at
//!   or below [`MAX_MAPPED_LEN`]. Extent writes become plain stores into the page
//!   cache, avoiding a second copy through a user-space buffer.
//! - **Buffered** — `BufWriter<File>` with explicit seeks. Required whenever the
//!   mapped backend cannot work: `MmapMut::map_mut` **always** fails on a
//!   zero-length file (partitions whose manifest carries no size), `usize` is
//!   32-bit on the shipped `i686-pc-windows-msvc` target, and very large outputs
//!   are better streamed than mapped.
//!
//! Despite the historical name this type does **not** issue non-temporal store
//! instructions — no such intrinsic is used anywhere in the crate. Writes are
//! ordinary stores; the name is retained because callers across the payload
//! domain refer to it.
//!
//! Usage:
//! ```ignore
//! let mut writer = NonTemporalWriter::new(&path, size)?;
//! writer.write_at(offset, data)?;
//! writer.flush()?;
//! ```
#![allow(unsafe_code)] // memmap2::MmapMut::map_mut

use std::fs::{File, OpenOptions};
use std::io::{BufWriter, Error, Result, Seek, SeekFrom, Write};
use std::path::Path;

/// Largest output we are willing to memory-map on 64-bit targets.
#[cfg(target_pointer_width = "64")]
const MAX_MAPPED_LEN: u64 = 8 * 1024 * 1024 * 1024;

/// 32-bit targets ship (`i686-pc-windows-msvc`): `usize` is 32-bit and usable
/// address space is ~2 GiB, so output images are never mapped there.
#[cfg(not(target_pointer_width = "64"))]
const MAX_MAPPED_LEN: u64 = 0;

const WRITE_BUF_CAPACITY: usize = 1024 * 1024;

enum Backend {
    Mapped(memmap2::MmapMut),
    Buffered { writer: BufWriter<File>, cursor: u64 },
}

/// Random-access writer for one extracted partition image.
///
/// Position tracking mirrors `BufWriter` semantics: `seek()` updates the internal
/// position, `write()` writes at that position and advances it.
pub struct NonTemporalWriter {
    file: File,
    backend: Backend,
    pos: u64,
    /// Highest byte offset reached by a write or a seek.
    high_water: u64,
    /// Size declared by the manifest (`0` when unknown).
    declared_len: u64,
    flushed: bool,
}

impl NonTemporalWriter {
    /// Create a writer for `path`, pre-allocating `size` bytes when known.
    ///
    /// `size == 0` means "manifest did not declare a size" — the buffered backend
    /// is used and the final length is the high-water mark instead.
    pub fn new(path: &Path, size: u64) -> Result<Self> {
        let file =
            OpenOptions::new().read(true).write(true).create(true).truncate(true).open(path)?;

        if size > 0 {
            file.set_len(size)?;
        }

        let backend = if size > 0 && size <= MAX_MAPPED_LEN {
            Backend::Mapped(unsafe { memmap2::MmapMut::map_mut(&file)? })
        } else {
            Backend::Buffered {
                writer: BufWriter::with_capacity(WRITE_BUF_CAPACITY, file.try_clone()?),
                cursor: 0,
            }
        };

        Ok(Self { file, backend, pos: 0, high_water: 0, declared_len: size, flushed: false })
    }

    /// Write `data` at absolute byte `offset`.
    ///
    /// This is the primary write API for partition extraction — offsets are
    /// computed from destination extent block positions.
    pub fn write_at(&mut self, offset: u64, data: &[u8]) -> Result<usize> {
        if data.is_empty() {
            return Ok(0);
        }

        let end = offset
            .checked_add(data.len() as u64)
            .ok_or_else(|| Error::other("output write offset overflows"))?;

        if let Backend::Mapped(mmap) = &self.backend
            && end > mmap.len() as u64
        {
            self.grow_mapping(end)?;
        }

        match &mut self.backend {
            Backend::Mapped(mmap) => {
                let start = usize::try_from(offset)
                    .map_err(|_| Error::other("output write offset exceeds address space"))?;
                let stop = usize::try_from(end)
                    .map_err(|_| Error::other("output write end exceeds address space"))?;
                let target = mmap
                    .get_mut(start..stop)
                    .ok_or_else(|| Error::other("output mapping smaller than requested write"))?;
                super::copy::copy_raw_slice(target, data);
            }
            Backend::Buffered { writer, cursor } => {
                if *cursor != offset {
                    writer.seek(SeekFrom::Start(offset))?;
                    *cursor = offset;
                }
                writer.write_all(data)?;
                *cursor = end;
            }
        }

        self.high_water = self.high_water.max(end);
        self.flushed = false;
        Ok(data.len())
    }

    /// Flush pending writes and settle the file at its final length.
    pub fn flush(&mut self) -> Result<()> {
        if self.flushed {
            return Ok(());
        }

        self.flush_backend()?;
        self.finalize_len()?;

        self.flushed = true;
        Ok(())
    }

    /// Get a reference to the underlying `File`.
    ///
    /// Writes must go through `write_at()` or the `Write` impl — writing to this
    /// handle directly bypasses the mapping and the position bookkeeping.
    #[allow(dead_code)]
    pub fn get_ref(&self) -> &File {
        &self.file
    }

    fn flush_backend(&mut self) -> Result<()> {
        match &mut self.backend {
            Backend::Mapped(mmap) => {
                #[cfg(unix)]
                {
                    if mmap.len() > 4096 {
                        let _ = unsafe {
                            libc::madvise(
                                mmap.as_ptr() as *mut libc::c_void,
                                mmap.len(),
                                libc::MADV_SEQUENTIAL,
                            )
                        };
                    }
                    let _ = unsafe {
                        libc::msync(mmap.as_ptr() as *mut libc::c_void, mmap.len(), libc::MS_SYNC)
                    };
                }

                #[cfg(windows)]
                {
                    mmap.flush()?;
                }
            }
            Backend::Buffered { writer, .. } => writer.flush()?,
        }
        Ok(())
    }

    /// Settle the on-disk length: the declared size when the manifest gave one,
    /// otherwise the high-water mark.
    ///
    /// Only the buffered backend needs this — a trailing ZERO extent is a pure
    /// seek there and never extends the file. The mapped backend grows to an
    /// exact length and is already correct.
    fn finalize_len(&mut self) -> Result<()> {
        if matches!(self.backend, Backend::Mapped(_)) {
            return Ok(());
        }
        let target = self.declared_len.max(self.high_water);
        if self.file.metadata()?.len() != target {
            self.file.set_len(target)?;
        }
        Ok(())
    }

    /// Grow the mapped file to **exactly** `new_len` and remap.
    ///
    /// Exact growth (never `len * 2`) — the old doubling policy left an image up
    /// to twice its real size whenever the manifest under-declared the partition.
    fn grow_mapping(&mut self, new_len: u64) -> Result<()> {
        self.flush_backend()?;
        // Swap in a 1-byte anonymous mapping so the file mapping is dropped
        // before the file is resized. `?` instead of an unchecked unwrap so an
        // out-of-memory system surfaces an error rather than UB.
        let placeholder = memmap2::MmapMut::map_anon(1)
            .map_err(|e| Error::other(format!("failed to create placeholder mmap: {e}")))?;
        drop(std::mem::replace(&mut self.backend, Backend::Mapped(placeholder)));
        self.file.set_len(new_len)?;
        self.backend = Backend::Mapped(unsafe { memmap2::MmapMut::map_mut(&self.file)? });
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
        NonTemporalWriter::flush(self)
    }
}

impl Seek for NonTemporalWriter {
    fn seek(&mut self, pos: SeekFrom) -> Result<u64> {
        self.pos = match pos {
            SeekFrom::Start(off) => off,
            SeekFrom::Current(off) => self.pos.wrapping_add_signed(off),
            SeekFrom::End(off) => self.declared_len.max(self.high_water).wrapping_add_signed(off),
        };
        // A ZERO extent is written as a pure seek; the skipped range is still
        // part of the image, so it counts toward the final length.
        self.high_water = self.high_water.max(self.pos);
        Ok(self.pos)
    }
}

impl Drop for NonTemporalWriter {
    fn drop(&mut self) {
        let _ = self.flush();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn zero_declared_size_still_writes() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("unsized.img");

        let mut writer = NonTemporalWriter::new(&path, 0).expect("writer for unknown size");
        writer.write_all(b"hello").expect("write");
        writer.flush().expect("flush");
        drop(writer);

        assert_eq!(std::fs::read(&path).expect("read"), b"hello");
    }

    #[test]
    fn trailing_zero_extent_extends_unsized_output() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("zero_tail.img");

        let mut writer = NonTemporalWriter::new(&path, 0).expect("writer");
        writer.write_all(&[0xAB; 16]).expect("write");
        // ZERO extents are represented as a seek with no write.
        writer.seek(SeekFrom::Current(48)).expect("seek");
        writer.flush().expect("flush");
        drop(writer);

        assert_eq!(std::fs::metadata(&path).expect("meta").len(), 64);
    }

    #[test]
    fn growth_is_exact_not_doubled() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("grown.img");

        let mut writer = NonTemporalWriter::new(&path, 64).expect("writer");
        writer.write_at(0, &[1u8; 64]).expect("write in range");
        writer.write_at(64, &[2u8; 16]).expect("write past declared end");
        writer.flush().expect("flush");
        drop(writer);

        assert_eq!(std::fs::metadata(&path).expect("meta").len(), 80);
    }

    #[test]
    fn declared_size_is_preserved_when_tail_is_untouched() {
        let dir = tempdir().expect("tempdir");
        let path = dir.path().join("sparse.img");

        let mut writer = NonTemporalWriter::new(&path, 4096).expect("writer");
        writer.write_at(0, &[7u8; 8]).expect("write");
        writer.flush().expect("flush");
        drop(writer);

        assert_eq!(std::fs::metadata(&path).expect("meta").len(), 4096);
    }
}
