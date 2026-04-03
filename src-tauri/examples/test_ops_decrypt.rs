//! Standalone OPS decryption test — avoids Tauri DLL initialization issues.
//!
//! Run with: cargo run --manifest-path src-tauri/Cargo.toml --example test_ops_decrypt

use std::io::{Read, Seek, SeekFrom};

fn main() {
    let ops_path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../docs/refrences/oppo_decrypt-master/instantnoodlep_15_I.13_200411.ops"
    );

    let path = std::path::Path::new(ops_path);
    if !path.exists() {
        eprintln!("OPS file not found: {ops_path}");
        return;
    }

    println!("=== OPS Decryption Test ===");
    println!("File: {}", path.display());

    let file_size = std::fs::metadata(path).unwrap().len() as usize;
    println!("File size: {file_size} bytes ({:.2} GB)", file_size as f64 / 1_073_741_824.0);

    let mut file = std::fs::File::open(path).unwrap();

    // ─── Step 1: Read and validate footer ───
    println!("\n--- Footer ---");
    file.seek(SeekFrom::End(-0x200)).unwrap();
    let mut footer_buf = vec![0u8; 0x200];
    file.read_exact(&mut footer_buf).unwrap();

    let magic = u32::from_le_bytes(footer_buf[0x10..0x14].try_into().unwrap());
    let config_offset = u32::from_le_bytes(footer_buf[0x14..0x18].try_into().unwrap());
    let xml_length = u32::from_le_bytes(footer_buf[0x18..0x1C].try_into().unwrap()) as usize;

    println!("Magic: 0x{magic:04X} (expected 0x7CEF)");
    println!("Config offset: {config_offset} sectors ({} bytes)", config_offset as u64 * 512);
    println!("XML length: {xml_length} bytes");

    assert_eq!(magic, 0x7CEF, "Invalid OPS magic");

    // ─── Step 2: Read encrypted XML ───
    let xml_pad = 0x200 - (xml_length % 0x200);
    let aligned_len = xml_length + xml_pad;
    let start = file_size - 0x200 - aligned_len;
    println!(
        "XML region: [{start:#X} .. {:#X}] ({aligned_len} bytes aligned)",
        start + aligned_len
    );

    file.seek(SeekFrom::Start(start as u64)).unwrap();
    let mut encrypted_xml = vec![0u8; aligned_len];
    file.read_exact(&mut encrypted_xml).unwrap();

    println!("First 32 encrypted bytes: {:02X?}", &encrypted_xml[..32]);

    // ─── Step 3: Try decryption with each mbox variant ───
    println!("\n--- Decryption ---");

    // Import the crypto functions
    use adb_gui_next_lib::payload::ops::crypto::{MboxVariant, ops_decrypt};

    for variant in MboxVariant::ALL {
        let decrypted = ops_decrypt(&encrypted_xml, variant);
        let first_32 = &decrypted[..32.min(decrypted.len())];

        // Check if it starts with "<?xml"
        let text_preview = String::from_utf8_lossy(&decrypted[..100.min(decrypted.len())]);
        let is_xml = text_preview.contains("<?xml")
            || text_preview.contains("xml ")
            || text_preview.contains("<Sahara");

        println!("  {}: first_32={:02X?} is_xml={is_xml}", variant.label(), first_32);
        if is_xml {
            println!("  ✓ XML detected! First 200 chars:");
            let trimmed = String::from_utf8_lossy(&decrypted[..200.min(decrypted.len())]);
            println!("    {}", trimmed.replace('\n', "\n    "));
        }
    }

    // ─── Step 4: Try full parse via mmap ───
    println!("\n--- Full Parse (mmap) ---");
    drop(file); // close file handle before mmap

    let file = std::fs::File::open(path).unwrap();
    let mmap = unsafe { memmap2::Mmap::map(&file).unwrap() };

    use adb_gui_next_lib::payload::ops::ops_parser::parse_ops;
    match parse_ops(&mmap) {
        Ok((partitions, metadata, variant)) => {
            println!("✓ Parse succeeded with variant: {}", variant.label());
            println!("  Format: {}", metadata.format);
            println!("  Project ID: {:?}", metadata.project_id);
            println!("  Firmware: {:?}", metadata.firmware_name);
            println!("  Encryption: {}", metadata.encryption);
            println!("  Total partitions: {}", partitions.len());
            println!(
                "  Total size: {} bytes ({:.2} GB)",
                metadata.total_size,
                metadata.total_size as f64 / 1_073_741_824.0
            );
            println!("  Sections: {:?}", metadata.sections);
            println!();
            for (i, p) in partitions.iter().enumerate() {
                println!(
                    "  [{:2}] {:30} offset={:#10X}  size={:>12}  enc={}  sparse={}  section={}",
                    i, p.name, p.offset, p.size, p.encrypted, p.sparse, p.section
                );
            }
        }
        Err(e) => {
            println!("✗ Parse failed: {e}");
        }
    }

    println!("\n=== Done ===");
}
