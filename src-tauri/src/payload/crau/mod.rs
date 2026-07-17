//! CrAU / payload.bin domain: header, manifest, extract, diagnose.

mod extract;
mod parser;

pub use extract::{diagnose_payload_file, extract_payload};
pub use parser::{
    LoadedPayload, list_payload_partitions, list_payload_partitions_with_details, open_mmap,
    parse_header,
};
