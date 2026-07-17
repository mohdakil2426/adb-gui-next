//! Local ZIP helpers: entry extract, STORED windows, future shared EOCD parsing.

mod extract_entry;
mod stored_window;

pub use extract_entry::PayloadCache;
pub use stored_window::ZipPayloadMmap;

// TODO(Wave 3 / Task 0.5 optional): Extract shared EOCD helpers from
// `http_zip.rs` and `factory_image.rs` into `zip/eocd.rs` once ranges and
// error paths can move without behavior change. Duplication left on purpose
// for Wave 0 structure-only work.
