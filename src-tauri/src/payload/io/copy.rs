//! Shared I/O utilities for payload extraction.

pub use crate::payload::storage_check::move_file_cross_device;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
#[allow(dead_code)]
const COPY_BUF_SIZE: usize = 65536;

/// Copy `min(dst.len(), src.len())` bytes from `src` to `dst`.
///
/// Lowers to `memcpy`, which every supported target implements with hand-tuned
/// vectorized routines (and switches to non-temporal stores above its own
/// streaming threshold). A previous revision hand-rolled SSE2/AVX2/AVX-512
/// paths here; they were slower than `memcpy` on x86_64 because the intrinsics
/// were called from functions without `#[target_feature]`, so LLVM could not
/// widen or unroll them — and on every non-x86_64 target (including the shipped
/// `aarch64-pc-windows-msvc` and `aarch64-unknown-linux-gnu` builds) they fell
/// back to a bounds-checked byte-at-a-time loop.
pub fn copy_raw_slice(dst: &mut [u8], src: &[u8]) {
    let len = dst.len().min(src.len());
    dst[..len].copy_from_slice(&src[..len]);
}

/// Read from `src` into `buf` in a loop, writing each chunk to `dst`, until `limit` bytes
/// have been written or EOF is reached.
/// If `hasher` is provided, accumulates SHA-256 digest of the transferred bytes.
///
/// Returns an error if the source reaches EOF before `limit` bytes have been transferred,
/// which indicates a truncated or corrupt compressed stream.
pub fn stream_copy(
    src: &mut impl Read,
    dst: &mut impl Write,
    buf: &mut [u8],
    limit: usize,
    mut hasher: Option<&mut Sha256>,
) -> std::io::Result<()> {
    let mut remaining = limit;
    while remaining > 0 {
        let to_read = buf.len().min(remaining);
        let n = src.read(&mut buf[..to_read])?;
        if n == 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                format!(
                    "compressed stream ended after {} bytes, expected {}",
                    limit - remaining,
                    limit,
                ),
            ));
        }
        if let Some(h) = hasher.as_mut() {
            h.update(&buf[..n]);
        }
        dst.write_all(&buf[..n])?;
        remaining -= n;
    }
    Ok(())
}

/// Write all data from a reader to a writer, returning total bytes.
#[allow(dead_code)]
pub fn copy_all<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> std::io::Result<u64> {
    let mut total = 0u64;
    let mut buf = [0u8; COPY_BUF_SIZE];
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        writer.write_all(&buf[..n])?;
        total += n as u64;
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::copy_raw_slice;

    #[test]
    fn copies_full_slice() {
        let src = [1u8, 2, 3, 4];
        let mut dst = [0u8; 4];
        copy_raw_slice(&mut dst, &src);
        assert_eq!(dst, src);
    }

    #[test]
    fn clamps_to_shorter_destination() {
        let src = [1u8, 2, 3, 4];
        let mut dst = [0u8; 2];
        copy_raw_slice(&mut dst, &src);
        assert_eq!(dst, [1, 2]);
    }

    #[test]
    fn clamps_to_shorter_source() {
        let src = [9u8, 8];
        let mut dst = [0u8; 4];
        copy_raw_slice(&mut dst, &src);
        assert_eq!(dst, [9, 8, 0, 0]);
    }

    #[test]
    fn handles_empty_input() {
        let mut dst = [7u8; 3];
        copy_raw_slice(&mut dst, &[]);
        assert_eq!(dst, [7, 7, 7]);
    }
}
