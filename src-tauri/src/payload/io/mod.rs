//! Shared I/O: non-temporal writers, fast copy, buffer pools (Wave 3).

mod buffers;
mod copy;
pub mod sparse_ioctl;
mod write;

pub use buffers::{
    IO_BUF_SIZE, IO_BUF_SIZE_LARGE, range_body_into_vec, with_io_buf, with_io_buf_sized,
};
pub use copy::{copy_raw_slice, move_file_cross_device, stream_copy};
pub use sparse_ioctl::SparseFileExt;
pub use write::NonTemporalWriter;
