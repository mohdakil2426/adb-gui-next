//! OFP MediaTek format parser.
//!
//! Reads the mtk_shuffle-obfuscated binary header and entry table
//! at the end of the file.

use super::{OpsMetadata, OpsPartitionEntry};
use super::crypto::{OfpCipher, mtk_shuffle, try_ofp_mtk_keys};
use anyhow::{Result, bail};

/// Primary header size at end of file.
const HDR_SIZE: usize = 0x6C;

/// Each entry in the partition table.
const ENTRY_SIZE: usize = 0x60;

/// MTK header obfuscation key.
const MTK_HDR_KEY: &[u8] = b"geyixue";

/// Detect if data appears to be OFP-MTK format by trying MTK AES keys.
pub fn detect_mtk(data: &[u8]) -> bool {
    if data.len() < 16 {
        return false;
    }
    try_ofp_mtk_keys(&data[..16]).is_some()
}

/// MTK primary header parsed from the last 0x6C bytes.
#[derive(Debug)]
struct MtkHeader {
    project_name: String,
    cpu: String,
    flash_type: String,
    entry_count: usize,
    project_info: String,
}

/// Parse an OFP (MediaTek) file.
pub fn parse_ofp_mtk(
    data: &[u8],
) -> Result<(Vec<OpsPartitionEntry>, OpsMetadata, OfpCipher)> {
    let file_size = data.len();

    // Detect correct AES cipher from first 16 bytes
    let cipher = try_ofp_mtk_keys(&data[..16.min(file_size)])
        .ok_or_else(|| anyhow::anyhow!(
            "OFP-MTK: Failed to detect encryption key. \
             None of the known MTK key sets matched."
        ))?;

    let header = parse_mtk_header(data, file_size)?;
    let partitions = parse_mtk_entries(data, file_size, &header, &cipher)?;

    let total_size = partitions.iter().map(|p| p.size).sum();
    let sections = vec!["MTK".to_string()];

    let metadata = OpsMetadata {
        format: "ofp-mediatek".into(),
        project_id: Some(header.project_name),
        firmware_name: Some(header.project_info),
        cpu: Some(header.cpu),
        flash_type: Some(header.flash_type),
        encryption: "aes-128-cfb(mtk)".into(),
        total_partitions: partitions.len(),
        total_size,
        sections,
    };

    Ok((partitions, metadata, cipher))
}

/// Parse the primary header (last 0x6C bytes, mtk_shuffle obfuscated).
fn parse_mtk_header(data: &[u8], file_size: usize) -> Result<MtkHeader> {
    if file_size < HDR_SIZE {
        bail!("OFP-MTK: file too small for header ({file_size} < {HDR_SIZE})");
    }

    let mut hdr = data[file_size - HDR_SIZE..].to_vec();
    mtk_shuffle(MTK_HDR_KEY, &mut hdr);

    let project_name = read_nul(&hdr[..46.min(hdr.len())]);
    // Skip 8 bytes (unknown) + 4 bytes (reserved)
    let cpu = read_nul(&hdr[58..65.min(hdr.len())]);
    let flash_type = read_nul(&hdr[65..70.min(hdr.len())]);

    let entry_count = if hdr.len() >= 72 {
        u16::from_le_bytes(hdr[70..72].try_into().unwrap_or([0; 2])) as usize
    } else {
        0
    };

    let project_info = if hdr.len() >= 104 {
        read_nul(&hdr[72..104])
    } else {
        String::new()
    };

    if entry_count == 0 || entry_count > 500 {
        bail!("OFP-MTK: suspicious entry count: {entry_count}");
    }

    Ok(MtkHeader {
        project_name,
        cpu,
        flash_type,
        entry_count,
        project_info,
    })
}

/// Parse the entry table (hdr2) above the primary header.
fn parse_mtk_entries(
    data: &[u8],
    file_size: usize,
    header: &MtkHeader,
    cipher: &OfpCipher,
) -> Result<Vec<OpsPartitionEntry>> {
    let hdr2_total = header.entry_count * ENTRY_SIZE;
    let hdr2_start = file_size - HDR_SIZE - hdr2_total;

    if hdr2_start > file_size {
        bail!("OFP-MTK: entry table offset underflow");
    }

    // Un-shuffle each entry using mcookie key
    let mcookie = b"geyixue";
    let mut partitions = Vec::with_capacity(header.entry_count);

    for i in 0..header.entry_count {
        let entry_start = hdr2_start + i * ENTRY_SIZE;
        if entry_start + ENTRY_SIZE > file_size {
            break;
        }

        let mut entry = data[entry_start..entry_start + ENTRY_SIZE].to_vec();
        mtk_shuffle(mcookie, &mut entry);

        let name = read_nul(&entry[..32]);
        let start_offset = u64::from_le_bytes(entry[32..40].try_into().unwrap_or([0; 8]));
        let total_length = u64::from_le_bytes(entry[40..48].try_into().unwrap_or([0; 8]));
        let enc_length = u64::from_le_bytes(entry[48..56].try_into().unwrap_or([0; 8]));
        let filename = read_nul(&entry[56..88.min(entry.len())]);

        if name.is_empty() || total_length == 0 {
            continue;
        }

        let _ = cipher; // Cipher is stored for extraction use

        partitions.push(OpsPartitionEntry {
            name: if filename.is_empty() {
                format!("{name}.img")
            } else {
                filename
            },
            offset: start_offset,
            size: total_length,
            sector_size: total_length,
            encrypted: enc_length > 0,
            sha256: String::new(),
            md5: String::new(),
            sparse: false,
            section: "MTK".to_string(),
            encrypted_length: enc_length,
        });
    }

    Ok(partitions)
}

fn read_nul(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).trim().to_string()
}
