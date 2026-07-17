//! Per-worker reusable I/O buffers for decompress/stream_copy paths.
//!
//! Rayon extract workers allocate a 256 KiB heap buffer once (TLS) and reuse it
//! across operations instead of a fresh stack/heap buffer per op. Callers may
//! grow up to [`IO_BUF_SIZE_LARGE`] (512 KiB) when a larger window helps.

use std::cell::RefCell;

/// Default streaming buffer size (256 KiB). Sweet-spot for L2-resident throughput.
pub const IO_BUF_SIZE: usize = 256 * 1024;

/// Upper size for optional larger per-worker buffers (512 KiB).
pub const IO_BUF_SIZE_LARGE: usize = 512 * 1024;

thread_local! {
    static WORKER_BUF: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

/// Run `f` with a reusable per-thread buffer of [`IO_BUF_SIZE`] bytes.
#[inline]
pub fn with_io_buf<R>(f: impl FnOnce(&mut [u8]) -> R) -> R {
    with_io_buf_sized(IO_BUF_SIZE, f)
}

/// Run `f` with a reusable per-thread buffer of at least `size` bytes
/// (clamped to [`IO_BUF_SIZE`]..=[`IO_BUF_SIZE_LARGE`]).
pub fn with_io_buf_sized<R>(size: usize, f: impl FnOnce(&mut [u8]) -> R) -> R {
    let want = size.clamp(IO_BUF_SIZE, IO_BUF_SIZE_LARGE);
    WORKER_BUF.with(|cell| {
        let mut buf = cell.borrow_mut();
        if buf.len() < want {
            buf.resize(want, 0);
        }
        f(&mut buf[..want])
    })
}

/// Own an HTTP range body as `Vec<u8>`, reclaiming the underlying allocation when
/// the `Bytes` refcount is 1 (avoids the always-copy of [`bytes::Bytes::to_vec`]).
///
/// Prefer keeping [`bytes::Bytes`] at call sites when the API can accept it.
#[inline]
pub fn range_body_into_vec(body: bytes::Bytes) -> Vec<u8> {
    body.into()
}
