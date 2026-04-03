//! Integration test for OPS decryption against a real .ops file.
//! This test is only compiled in cfg(test) and skipped if the test file doesn't exist.

#[cfg(test)]
mod tests {
    use crate::payload::ops::crypto::{MboxVariant, ops_decrypt};
    use crate::payload::ops::ops_parser::parse_ops;

    const TEST_OPS_FILE: &str = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../docs/refrences/oppo_decrypt-master/instantnoodlep_15_I.13_200411.ops"
    );

    #[test]
    fn test_ops_footer_parsing() {
        let path = std::path::Path::new(TEST_OPS_FILE);
        if !path.exists() {
            eprintln!("Skipping test: OPS file not found at {TEST_OPS_FILE}");
            return;
        }

        use std::io::Read;

        // Read just the footer (last 0x200 bytes)
        let mut file = std::fs::File::open(path).unwrap();

        // Read footer
        use std::io::Seek;
        file.seek(std::io::SeekFrom::End(-0x200)).unwrap();
        let mut footer_buf = vec![0u8; 0x200];
        file.read_exact(&mut footer_buf).unwrap();

        // Verify footer fields
        let magic = u32::from_le_bytes(footer_buf[0x10..0x14].try_into().unwrap());
        assert_eq!(magic, 0x7CEF, "OPS magic mismatch");

        let config_offset = u32::from_le_bytes(footer_buf[0x14..0x18].try_into().unwrap());
        let xml_length = u32::from_le_bytes(footer_buf[0x18..0x1C].try_into().unwrap());

        assert_eq!(config_offset, 11735757, "config_offset mismatch");
        assert_eq!(xml_length, 102624, "xml_length mismatch");

        eprintln!(
            "Footer: magic=0x{magic:04X} config_offset={config_offset} xml_length={xml_length}"
        );
    }

    #[test]
    fn test_ops_xml_decryption_with_mbox6() {
        let path = std::path::Path::new(TEST_OPS_FILE);
        if !path.exists() {
            eprintln!("Skipping test: OPS file not found at {TEST_OPS_FILE}");
            return;
        }

        use std::io::{Read, Seek};

        let file_size = std::fs::metadata(path).unwrap().len() as usize;
        let mut file = std::fs::File::open(path).unwrap();

        // Read footer
        file.seek(std::io::SeekFrom::End(-0x200)).unwrap();
        let mut footer_buf = vec![0u8; 0x200];
        file.read_exact(&mut footer_buf).unwrap();

        let xml_length = u32::from_le_bytes(footer_buf[0x18..0x1C].try_into().unwrap()) as usize;

        // Python: xmlpad = 0x200 - (xmllength % 0x200)
        let xml_pad = 0x200 - (xml_length % 0x200);
        let aligned_len = xml_length + xml_pad;

        // Python: rf.seek(filesize - 0x200 - (xmllength + xmlpad))
        let start = file_size - 0x200 - aligned_len;
        file.seek(std::io::SeekFrom::Start(start as u64)).unwrap();
        let mut encrypted_xml = vec![0u8; aligned_len];
        file.read_exact(&mut encrypted_xml).unwrap();

        eprintln!(
            "Encrypted XML: {} bytes, first 32 bytes: {:02X?}",
            encrypted_xml.len(),
            &encrypted_xml[..32]
        );

        // Try mbox6 (instantnoodlep = OnePlus 8 Pro, should use mbox6)
        let decrypted = ops_decrypt(&encrypted_xml, MboxVariant::Mbox6);

        eprintln!("Decrypted first 128 bytes: {:02X?}", &decrypted[..128.min(decrypted.len())]);

        // Check if decrypted data contains "xml " or "<?xml"
        let text = String::from_utf8_lossy(&decrypted[..xml_length.min(decrypted.len())]);
        let first_100 = &text[..100.min(text.len())];
        eprintln!("Decrypted text (first 100 chars): {first_100}");

        assert!(
            text.contains("xml ") || text.contains("<?xml") || text.contains("<Sahara"),
            "Decrypted data does not contain valid XML markers. First 100 chars: {first_100}"
        );
    }

    #[test]
    fn test_ops_full_parse() {
        let path = std::path::Path::new(TEST_OPS_FILE);
        if !path.exists() {
            eprintln!("Skipping test: OPS file not found at {TEST_OPS_FILE}");
            return;
        }

        // Memory-map the file (like we do in production)
        let file = std::fs::File::open(path).unwrap();
        let mmap = unsafe { memmap2::Mmap::map(&file).unwrap() };

        let result = parse_ops(&mmap);
        match result {
            Ok((partitions, metadata, variant)) => {
                eprintln!("Parse succeeded with variant: {}", variant.label());
                eprintln!(
                    "Metadata: format={} project_id={:?} firmware={:?}",
                    metadata.format, metadata.project_id, metadata.firmware_name
                );
                eprintln!("Total partitions: {}", partitions.len());
                eprintln!("Total size: {} bytes", metadata.total_size);
                eprintln!("Sections: {:?}", metadata.sections);
                for (i, p) in partitions.iter().enumerate() {
                    eprintln!(
                        "  [{i}] {} — offset={:#X} size={} encrypted={} sparse={} section={}",
                        p.name, p.offset, p.size, p.encrypted, p.sparse, p.section
                    );
                }
                assert!(!partitions.is_empty(), "Should have at least one partition");
            }
            Err(e) => {
                panic!("OPS parse failed: {e}");
            }
        }
    }
}
