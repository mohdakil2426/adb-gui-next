//! Payload source adapters (local mmap, STORED ZIP windows).

mod local_mmap;

#[allow(dead_code)]
pub use local_mmap::{open_local_mmap, open_local_payload_window};
