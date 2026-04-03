//! OnePlus OPS and Oppo OFP firmware format support.
//!
//! Supports three firmware container formats:
//! - **OPS** — OnePlus encrypted containers (custom S-box cipher + XML manifest)
//! - **OFP-QC** — Oppo Qualcomm containers (AES-128-CFB + XML manifest)
//! - **OFP-MTK** — Oppo MediaTek containers (AES-128-CFB + mtk_shuffle + binary header)
//!
//! All formats produce the same `PartitionDetail` output as CrAU payload.bin,
//! allowing transparent integration with the existing Payload Dumper UI.

pub mod crypto;
pub mod detect;
pub mod extractor;
pub mod ofp_mtk;
pub mod ofp_qc;
pub mod ops_parser;
pub mod sparse;

#[cfg(test)]
mod test_ops_decrypt;

pub use detect::FirmwareFormat;
pub use extractor::{extract_ops_partitions, list_ops_partitions};

use serde::Serialize;

/// A partition entry parsed from an OPS/OFP XML manifest or binary header.
#[derive(Debug, Clone)]
pub struct OpsPartitionEntry {
    /// Display name (used for output filename: `"{name}.img"`)
    pub name: String,
    /// Byte offset into the container file
    pub offset: u64,
    /// Actual data size in bytes
    pub size: u64,
    /// Sector-aligned size (for reads)
    pub sector_size: u64,
    /// Whether this partition's data is encrypted (SAHARA section in OPS, first 256K in OFP)
    pub encrypted: bool,
    /// Expected SHA-256 hash (empty string = no hash available)
    pub sha256: String,
    /// Expected MD5 hash (empty string = no hash available, OFP only)
    pub md5: String,
    /// Whether the partition contains an Android sparse image
    pub sparse: bool,
    /// Section type from XML (for logging/metadata)
    pub section: String,
    /// For OFP-QC: how many bytes at the start are encrypted (typically 0x40000)
    pub encrypted_length: u64,
}

/// OPS file footer (last 0x200 bytes of file).
#[derive(Debug)]
pub struct OpsFooter {
    pub magic: u32,
    pub config_offset: u32,
    pub xml_length: u32,
    pub project_id: String,
    pub firmware_name: String,
}

/// Metadata about an OPS/OFP file (surfaced to the frontend UI).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpsMetadata {
    pub format: String,
    pub project_id: Option<String>,
    pub firmware_name: Option<String>,
    pub cpu: Option<String>,
    pub flash_type: Option<String>,
    pub encryption: String,
    pub total_partitions: usize,
    pub total_size: u64,
    pub sections: Vec<String>,
}

/// OPS magic found in the footer at offset +0x10.
pub const OPS_MAGIC: u32 = 0x7CEF;

/// Sector size used for offset calculations in OPS/OFP files.
pub const SECTOR_SIZE: u64 = 0x200;

/// Maximum XML manifest size we'll accept (1 MB safety guard).
pub const MAX_XML_SIZE: u32 = 1024 * 1024;
