#[allow(dead_code, clippy::all)]
pub mod chromeos_update_engine {
    #[cfg(rust_analyzer)]
    include!("../generated/chromeos_update_engine.rs");

    #[cfg(not(rust_analyzer))]
    include!(concat!(env!("OUT_DIR"), "/chromeos_update_engine.rs"));
}

mod extractor;
mod parser;
mod zip;

#[cfg(test)]
mod tests;

pub use extractor::{ExtractPayloadResult, PartitionDetail, extract_payload};
pub use parser::{list_payload_partitions, list_payload_partitions_with_details};
pub use zip::PayloadCache;
