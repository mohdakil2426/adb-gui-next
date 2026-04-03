#[allow(dead_code, clippy::all)]
pub mod chromeos_update_engine {
    #[cfg(rust_analyzer)]
    include!("../generated/chromeos_update_engine.rs");

    #[cfg(not(rust_analyzer))]
    include!(concat!(env!("OUT_DIR"), "/chromeos_update_engine.rs"));
}

mod extractor;
pub mod ops;
mod parser;
mod zip;

#[cfg(feature = "remote_zip")]
pub mod http;

#[cfg(feature = "remote_zip")]
pub mod http_zip;

#[cfg(feature = "remote_zip")]
pub mod remote;

#[cfg(test)]
mod tests;

pub use extractor::{
    DynamicGroupInfo, ExtractPayloadResult, PartitionDetail, RemotePayloadMetadata, extract_payload,
};
pub use parser::{LoadedPayload, list_payload_partitions, list_payload_partitions_with_details};
pub use zip::PayloadCache;

#[cfg(feature = "remote_zip")]
pub use http::HttpPayloadReader;

#[cfg(feature = "remote_zip")]
pub use http_zip::{ZipPayloadInfo, find_payload_in_zip, is_zip_url, read_text_file_from_zip};

#[cfg(feature = "remote_zip")]
pub use remote::{
    RemotePayload, extract_remote_direct, extract_remote_prefetch, get_remote_payload_metadata,
    list_remote_payload_partitions,
};
