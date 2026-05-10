//! Shared I/O utilities for payload extraction.

use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::sync::OnceLock;

#[allow(dead_code)]
const COPY_BUF_SIZE: usize = 65536;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CopyStrategy {
    Scalar,
    Sse2,
    Avx2,
    Avx512,
}

impl CopyStrategy {
    #[allow(dead_code)]
    fn name(&self) -> &'static str {
        match self {
            CopyStrategy::Scalar => "scalar",
            CopyStrategy::Sse2 => "SSE2",
            CopyStrategy::Avx2 => "AVX2",
            CopyStrategy::Avx512 => "AVX-512",
        }
    }
}

pub fn detect_copy_strategy() -> CopyStrategy {
    if std::arch::is_x86_feature_detected!("avx512f") {
        CopyStrategy::Avx512
    } else if std::arch::is_x86_feature_detected!("avx2") {
        CopyStrategy::Avx2
    } else if std::arch::is_x86_feature_detected!("sse2") {
        CopyStrategy::Sse2
    } else {
        CopyStrategy::Scalar
    }
}

static COPY_STRATEGY: OnceLock<CopyStrategy> = OnceLock::new();

pub fn get_copy_strategy() -> CopyStrategy {
    *COPY_STRATEGY.get_or_init(detect_copy_strategy)
}

pub struct Copier {
    strategy: CopyStrategy,
}

impl Copier {
    pub fn new() -> Self {
        Self { strategy: get_copy_strategy() }
    }

    pub fn copy(&self, dst: &mut [u8], src: &[u8]) {
        match self.strategy {
            CopyStrategy::Scalar => copy_scalar(dst, src),
            CopyStrategy::Sse2 => copy_sse2(dst, src),
            CopyStrategy::Avx2 => copy_avx2(dst, src),
            CopyStrategy::Avx512 => copy_avx2(dst, src),
        }
    }
}

impl Default for Copier {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(target_arch = "x86_64")]
fn copy_sse2(dst: &mut [u8], src: &[u8]) {
    use std::arch::x86_64::*;
    let len = dst.len().min(src.len());
    let mut i = 0usize;

    while i + 16 <= len {
        unsafe {
            let mash = _mm_loadu_si128(src.as_ptr().add(i) as *const __m128i);
            _mm_storeu_si128(dst.as_mut_ptr().add(i) as *mut __m128i, mash);
        }
        i += 16;
    }

    while i < len {
        dst[i] = src[i];
        i += 1;
    }
}

#[cfg(target_arch = "x86_64")]
fn copy_avx2(dst: &mut [u8], src: &[u8]) {
    use std::arch::x86_64::*;
    let len = dst.len().min(src.len());
    let mut i = 0usize;

    while i + 32 <= len {
        unsafe {
            let mash = _mm256_loadu_si256(src.as_ptr().add(i) as *const __m256i);
            _mm256_storeu_si256(dst.as_mut_ptr().add(i) as *mut __m256i, mash);
        }
        i += 32;
    }

    while i < len {
        dst[i] = src[i];
        i += 1;
    }
}

#[cfg(not(target_arch = "x86_64"))]
fn copy_sse2(dst: &mut [u8], src: &[u8]) {
    copy_scalar(dst, src);
}

#[cfg(not(target_arch = "x86_64"))]
fn copy_avx2(dst: &mut [u8], src: &[u8]) {
    copy_scalar(dst, src);
}

fn copy_scalar(dst: &mut [u8], src: &[u8]) {
    let len = dst.len().min(src.len());
    let mut i = 0usize;
    while i < len {
        dst[i] = src[i];
        i += 1;
    }
}

pub fn copy_raw_slice(dst: &mut [u8], src: &[u8]) {
    let copier = Copier::new();
    copier.copy(dst, src);
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
