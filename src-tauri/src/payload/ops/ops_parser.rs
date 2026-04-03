//! OPS footer parsing, XML decryption, and manifest parsing.

use super::{MAX_XML_SIZE, OPS_MAGIC, OpsFooter, OpsMetadata, OpsPartitionEntry, SECTOR_SIZE};
use super::crypto::{MboxVariant, try_decrypt_ops_xml};
use anyhow::{Result, bail};
use quick_xml::Reader;
use quick_xml::events::Event;

/// Parse an OPS file: read footer, decrypt XML, parse manifest.
pub fn parse_ops(
    data: &[u8],
) -> Result<(Vec<OpsPartitionEntry>, OpsMetadata, MboxVariant)> {
    let footer = parse_footer(data)?;
    let (xml, variant) = decrypt_xml(data, &footer)?;
    let partitions = parse_manifest_xml(&xml)?;

    let total_size = partitions.iter().map(|p| p.size).sum();
    let sections: Vec<String> = {
        let mut s: Vec<String> = partitions.iter().map(|p| p.section.clone()).collect();
        s.sort();
        s.dedup();
        s
    };

    let metadata = OpsMetadata {
        format: "ops".into(),
        project_id: Some(footer.project_id),
        firmware_name: Some(footer.firmware_name),
        cpu: None,
        flash_type: None,
        encryption: format!("custom-aes({})", variant.label()),
        total_partitions: partitions.len(),
        total_size,
        sections,
    };

    Ok((partitions, metadata, variant))
}

/// Parse the 0x200-byte footer at the end of the file.
fn parse_footer(data: &[u8]) -> Result<OpsFooter> {
    let file_size = data.len();
    if file_size < 0x200 {
        bail!("File too small for OPS footer ({file_size} bytes, need >= 512)");
    }

    let footer = &data[file_size - 0x200..];

    let magic = u32::from_le_bytes(footer[0x10..0x14].try_into()?);
    if magic != OPS_MAGIC {
        bail!("Invalid OPS footer magic: 0x{magic:04X} (expected 0x{OPS_MAGIC:04X})");
    }

    let config_offset = u32::from_le_bytes(footer[0x14..0x18].try_into()?);
    let xml_length = u32::from_le_bytes(footer[0x18..0x1C].try_into()?);

    if xml_length > MAX_XML_SIZE {
        bail!("OPS XML manifest too large: {xml_length} bytes (max {MAX_XML_SIZE})");
    }

    // Project ID: 16 bytes at offset 0x1C, NUL-padded
    let project_id = read_nul_string(&footer[0x1C..0x2C]);
    // Firmware name: remaining bytes to 0x200, NUL-padded
    let firmware_name = read_nul_string(&footer[0x2C..]);

    Ok(OpsFooter {
        magic,
        config_offset,
        xml_length,
        project_id,
        firmware_name,
    })
}

/// Try all mbox variants to decrypt the XML manifest.
fn decrypt_xml(data: &[u8], footer: &OpsFooter) -> Result<(String, MboxVariant)> {
    let xml_offset = footer.config_offset as u64 * SECTOR_SIZE;
    let xml_len = footer.xml_length as usize;

    // Sector-align xml_len
    let aligned_len = ((xml_len + 0x1FF) / 0x200) * 0x200;

    let start = xml_offset as usize;
    let end = start + aligned_len;

    if end > data.len() - 0x200 {
        bail!(
            "OPS XML region [{start:#X}..{end:#X}] exceeds file boundary (file size: {:#X})",
            data.len()
        );
    }

    let encrypted_xml = &data[start..end];

    // Try mbox variants in order of likelihood: mbox5 (most common) → mbox6 → mbox4
    for variant in MboxVariant::ALL {
        if let Some(xml) = try_decrypt_ops_xml(encrypted_xml, variant) {
            // Trim to actual XML length and remove NUL padding
            let trimmed = if xml.len() > xml_len {
                &xml[..xml_len]
            } else {
                &xml
            };
            let cleaned = trimmed.trim_end_matches('\0').to_string();
            return Ok((cleaned, variant));
        }
    }

    bail!(
        "Failed to decrypt OPS XML manifest. None of the known mbox key variants (mbox4/5/6) \
         produced valid XML. This firmware may use an unsupported key variant."
    )
}

/// Parse the decrypted XML manifest into partition entries.
fn parse_manifest_xml(xml: &str) -> Result<Vec<OpsPartitionEntry>> {
    let mut partitions = Vec::new();
    let mut reader = Reader::from_str(xml);
    let mut current_section = String::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(e) | Event::Empty(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();

                // Track section context (SAHARA, UFS_PROVISION, Program_0, etc.)
                if matches!(
                    tag.as_str(),
                    "SAHARA" | "UFS_PROVISION" | "Config" | "Provision"
                        | "ChainedTableOfDigests" | "DigestsToSign" | "Firmware"
                ) || tag.starts_with("Program")
                {
                    current_section = tag.clone();
                }

                // Parse File elements
                if tag == "File" {
                    if let Some(entry) = parse_file_element(&e, &current_section) {
                        partitions.push(entry);
                    }
                }
            }
            Ok(Event::End(e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == current_section {
                    // Don't clear — keep section for nested elements
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => bail!("XML parse error at position {}: {e}", reader.error_position()),
            _ => {}
        }
    }

    Ok(partitions)
}

fn parse_file_element(
    e: &quick_xml::events::BytesStart<'_>,
    section: &str,
) -> Option<OpsPartitionEntry> {
    let mut name = String::new();
    let mut offset: u64 = 0;
    let mut size: u64 = 0;
    let mut sector_size: u64 = 0;
    let mut sha256 = String::new();
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
            "sparse" => sparse = val.eq_ignore_ascii_case("true"),
            _ => {}
        }
    }

    if name.is_empty() || size == 0 {
        return None;
    }

    // SAHARA section files are encrypted; everything else is raw copy
    let encrypted = section == "SAHARA";

    Some(OpsPartitionEntry {
        name,
        offset: offset * SECTOR_SIZE as u64, // Convert sector offset to byte offset
        size,
        sector_size: sector_size * SECTOR_SIZE as u64,
        encrypted,
        sha256,
        md5: String::new(),
        sparse,
        section: section.to_string(),
        encrypted_length: 0,
    })
}

/// Sanitize a filename from the XML manifest to prevent path traversal.
fn sanitize_filename(name: &str) -> String {
    std::path::Path::new(name)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(name)
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
}

fn read_nul_string(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_removes_path_traversal() {
        assert_eq!(sanitize_filename("../../../etc/passwd"), "passwd");
        assert_eq!(sanitize_filename("boot.img"), "boot.img");
        assert_eq!(sanitize_filename("sub/dir/file.elf"), "file.elf");
    }

    #[test]
    fn parse_xml_extracts_partitions() {
        let xml = r#"<Sahara>
            <BasicInfo Project="18801" Version="test" />
            <SAHARA>
                <File Path="xbl.elf" FileOffsetInSrc="0" SizeInSectorInSrc="100" SizeInByteInSrc="51200" />
            </SAHARA>
            <Program_0>
                <File filename="boot.img" FileOffsetInSrc="200" SizeInSectorInSrc="400" SizeInByteInSrc="204800" Sha256="abcd" sparse="false" />
            </Program_0>
        </Sahara>"#;

        let parts = parse_manifest_xml(xml).unwrap();
        assert_eq!(parts.len(), 2);

        assert_eq!(parts[0].name, "xbl.elf");
        assert!(parts[0].encrypted); // SAHARA section
        assert_eq!(parts[0].offset, 0);
        assert_eq!(parts[0].size, 51200);

        assert_eq!(parts[1].name, "boot.img");
        assert!(!parts[1].encrypted); // Program section
        assert_eq!(parts[1].sha256, "abcd");
    }
}
