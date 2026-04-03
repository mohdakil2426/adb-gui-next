//! OFP Qualcomm format parser.
//!
//! Detects page size (0x200 or 0x1000), brute-forces AES key, decrypts XML manifest,
//! and produces `OpsPartitionEntry` list.

use super::crypto::{OfpCipher, try_ofp_qc_keys};
use super::{OPS_MAGIC, OpsMetadata, OpsPartitionEntry, SECTOR_SIZE};
use anyhow::{Result, bail};
use quick_xml::Reader;
use quick_xml::events::Event;

/// How many bytes at the start of each partition are AES-encrypted.
const OFP_QC_ENC_LENGTH: u64 = 0x40000; // 256 KiB

/// Parse an OFP (Qualcomm) file.
pub fn parse_ofp_qc(data: &[u8]) -> Result<(Vec<OpsPartitionEntry>, OpsMetadata, OfpCipher)> {
    let file_size = data.len() as u64;
    let pagesize = detect_page_size(data, file_size)?;

    // Read footer
    let footer_offset = (file_size - pagesize) as usize;
    let footer = &data[footer_offset..];

    let xml_offset_pages = u32::from_le_bytes(footer[0x14..0x18].try_into()?) as u64;
    let xml_length = u32::from_le_bytes(footer[0x18..0x1C].try_into()?) as usize;

    if xml_length == 0 || xml_length > 1024 * 1024 {
        bail!("OFP-QC: invalid XML length: {xml_length}");
    }

    let xml_byte_offset = xml_offset_pages * pagesize;
    let xml_end = xml_byte_offset as usize + xml_length;

    if xml_end > footer_offset {
        bail!("OFP-QC: XML region exceeds footer boundary");
    }

    let encrypted_xml = &data[xml_byte_offset as usize..xml_end];

    // Try all known key sets
    let (cipher, decrypted_xml) = try_ofp_qc_keys(encrypted_xml).ok_or_else(|| {
        anyhow::anyhow!(
            "OFP-QC: Failed to decrypt XML manifest. None of the known AES key sets produced \
             valid XML. This firmware may use an unsupported encryption key."
        )
    })?;

    let xml_str = String::from_utf8_lossy(&decrypted_xml).trim_end_matches('\0').to_string();

    let partitions = parse_ofp_qc_xml(&xml_str, pagesize)?;

    let total_size = partitions.iter().map(|p| p.size).sum();
    let sections: Vec<String> = {
        let mut s: Vec<String> = partitions.iter().map(|p| p.section.clone()).collect();
        s.sort();
        s.dedup();
        s
    };

    // Try to extract project info from footer
    let project_id = read_nul_opt(&footer[0x1C..0x2C.min(footer.len())]);
    let firmware_name = read_nul_opt(&footer[0x2C..0x200.min(footer.len())]);

    let metadata = OpsMetadata {
        format: "ofp-qualcomm".into(),
        project_id,
        firmware_name,
        cpu: None,
        flash_type: None,
        encryption: "aes-128-cfb".into(),
        total_partitions: partitions.len(),
        total_size,
        sections,
    };

    Ok((partitions, metadata, cipher))
}

/// Detect page size by scanning for 0x7CEF magic.
fn detect_page_size(data: &[u8], file_size: u64) -> Result<u64> {
    for &ps in &[0x200u64, 0x1000u64] {
        if file_size < ps {
            continue;
        }
        let offset = (file_size - ps) as usize;
        if offset + 0x14 <= data.len() {
            let magic =
                u32::from_le_bytes(data[offset + 0x10..offset + 0x14].try_into().unwrap_or([0; 4]));
            if magic == OPS_MAGIC {
                return Ok(ps);
            }
        }
    }
    bail!("OFP-QC: Could not detect page size (0x7CEF magic not found at any known footer offset)")
}

/// Parse OFP-QC XML manifest into partition entries.
fn parse_ofp_qc_xml(xml: &str, pagesize: u64) -> Result<Vec<OpsPartitionEntry>> {
    let mut partitions = Vec::new();
    let mut reader = Reader::from_str(xml);
    let mut current_section = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(e) | Event::Empty(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();

                if matches!(
                    tag.as_str(),
                    "Sahara"
                        | "Config"
                        | "Provision"
                        | "ChainedTableOfDigests"
                        | "DigestsToSign"
                        | "Firmware"
                ) || tag.starts_with("Program")
                {
                    current_section = tag.clone();
                }

                if tag == "File" {
                    if let Some(entry) = parse_ofp_qc_file_element(&e, &current_section, pagesize) {
                        partitions.push(entry);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => bail!("OFP-QC XML parse error: {e}"),
            _ => {}
        }
    }

    Ok(partitions)
}

fn parse_ofp_qc_file_element(
    e: &quick_xml::events::BytesStart<'_>,
    section: &str,
    pagesize: u64,
) -> Option<OpsPartitionEntry> {
    let mut name = String::new();
    let mut offset: u64 = 0;
    let mut size: u64 = 0;
    let mut sector_size: u64 = 0;
    let mut sha256 = String::new();
    let mut md5 = String::new();
    let mut sparse = false;

    for attr in e.attributes().filter_map(|a| a.ok()) {
        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
        let val = String::from_utf8_lossy(&attr.value).to_string();

        match key.as_str() {
            "Path" | "filename" => name = sanitize_filename(&val),
            "FileOffsetInSrc" => offset = val.parse().unwrap_or(0),
            "SizeInByteInSrc" => size = val.parse().unwrap_or(0),
            "SizeInSectorInSrc" => sector_size = val.parse().unwrap_or(0),
            "Sha256" | "sha256" => sha256 = val,
            "md5" => md5 = val,
            "sparse" => sparse = val.eq_ignore_ascii_case("true"),
            _ => {}
        }
    }

    if name.is_empty() || size == 0 {
        return None;
    }

    // OFP-QC: only first OFP_QC_ENC_LENGTH bytes are encrypted per partition
    let enc_len = OFP_QC_ENC_LENGTH.min(size);

    Some(OpsPartitionEntry {
        name,
        offset: offset * pagesize,
        size,
        sector_size: sector_size * SECTOR_SIZE as u64,
        encrypted: true, // OFP-QC partitions have partial encryption
        sha256,
        md5,
        sparse,
        section: section.to_string(),
        encrypted_length: enc_len,
    })
}

fn sanitize_filename(name: &str) -> String {
    std::path::Path::new(name)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(name)
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
}

fn read_nul_opt(bytes: &[u8]) -> Option<String> {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    let s = String::from_utf8_lossy(&bytes[..end]).trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}
