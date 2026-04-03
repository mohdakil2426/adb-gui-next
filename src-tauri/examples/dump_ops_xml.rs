//! Dump decrypted XML from an OPS file for inspection.
//!
//! Run with: cargo run --manifest-path src-tauri/Cargo.toml --example dump_ops_xml

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

    let file_size = std::fs::metadata(path).unwrap().len() as usize;
    let mut file = std::fs::File::open(path).unwrap();

    // Read footer
    file.seek(SeekFrom::End(-0x200)).unwrap();
    let mut footer_buf = vec![0u8; 0x200];
    file.read_exact(&mut footer_buf).unwrap();
    let xml_length = u32::from_le_bytes(footer_buf[0x18..0x1C].try_into().unwrap()) as usize;

    let xml_pad = 0x200 - (xml_length % 0x200);
    let aligned_len = xml_length + xml_pad;
    let start = file_size - 0x200 - aligned_len;

    file.seek(SeekFrom::Start(start as u64)).unwrap();
    let mut encrypted_xml = vec![0u8; aligned_len];
    file.read_exact(&mut encrypted_xml).unwrap();

    use adb_gui_next_lib::payload::ops::crypto::{MboxVariant, ops_decrypt};
    let decrypted = ops_decrypt(&encrypted_xml, MboxVariant::Mbox5);

    // Trim to actual length and strip BOM
    let text = String::from_utf8_lossy(&decrypted[..xml_length]);
    let xml = text.trim_start_matches('\u{FEFF}');

    // Write to file for inspection
    let out_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../decrypted_ops.xml");
    std::fs::write(out_path, xml).unwrap();
    println!("Wrote decrypted XML ({} bytes) to {out_path}", xml.len());

    // Also show sections
    for line in xml.lines().take(50) {
        println!("{line}");
    }

    // Show unique top-level tags
    println!("\n--- Looking for tags with 'filename' attribute ---");
    for line in xml.lines() {
        let trimmed = line.trim();
        if trimmed.contains("filename=") && !trimmed.starts_with("<!--") {
            println!("{trimmed}");
            // Only show first 5
            static mut COUNT: u32 = 0;
            unsafe {
                COUNT += 1;
                if COUNT >= 5 {
                    println!("  ... (truncated)");
                    break;
                }
            }
        }
    }
}
