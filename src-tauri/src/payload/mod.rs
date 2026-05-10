#[allow(dead_code, clippy::all)]
pub mod chromeos_update_engine {
    #[cfg(rust_analyzer)]
    include!("../generated/chromeos_update_engine.rs");

    #[cfg(not(rust_analyzer))]
    include!(concat!(env!("OUT_DIR"), "/chromeos_update_engine.rs"));
}

pub mod cancel;
mod copy;
mod delta;
mod error;
mod extractor;
pub mod ops;
mod parser;
pub mod transaction;
pub mod verify;
mod write;
mod zip;

#[cfg(feature = "remote_zip")]
pub mod http;

#[cfg(feature = "remote_zip")]
pub mod http_zip;

#[cfg(feature = "remote_zip")]
pub mod remote;

#[cfg(test)]
mod tests;

pub(crate) fn format_datetime() -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    let days = ts / 86400;
    let time = ts % 86400;

    let (y, m, d) = civil_from_days(days as i64);
    let h = time / 3600;
    let min = (time % 3600) / 60;
    let s = time % 60;

    format!("{y:04}-{m:02}-{d:02}_{h:02}{min:02}{s:02}")
}

fn civil_from_days(days: i64) -> (i64, u8, u8) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u8;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u8;
    let y_adj: i64 = if m <= 2 { 1 } else { 0 };
    (y + y_adj, m, d)
}

pub use cancel::CancellationToken;
pub use copy::{copy_raw_slice, detect_copy_strategy};
pub use extractor::{
    DynamicGroupInfo, ExtractPayloadResult, PartitionDetail, PayloadDiagnostics,
    RemotePayloadMetadata, diagnose_payload_file, extract_payload,
};
pub use parser::{
    LoadedPayload, list_payload_partitions, list_payload_partitions_with_details, open_mmap,
    parse_header,
};
pub use verify::{VerificationResult, VerifyMode};
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
