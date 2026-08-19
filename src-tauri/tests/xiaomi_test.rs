use adb_gui_next_lib::payload::xiaomi::{
    BLOCK_SIZE, Range, TransferCommand, TransferList, XiaomiDatExtractor, extract_xiaomi_dat,
};
use std::fs::File;
use std::io::{Cursor, Read, Write};
use tempfile::NamedTempFile;

#[test]
fn test_range_parsing_and_attributes() {
    let single = TransferList::parse_ranges("1,0,10").expect("Valid single range");
    assert_eq!(single, vec![Range { start: 0, end: 10 }]);
    assert_eq!(single[0].num_blocks(), 10);
    assert_eq!(single[0].byte_len(), 40960);

    let multi = TransferList::parse_ranges("2,0,5,10,20").expect("Valid multi range");
    assert_eq!(multi, vec![Range { start: 0, end: 5 }, Range { start: 10, end: 20 }]);
    assert_eq!(multi[0].num_blocks(), 5);
    assert_eq!(multi[1].num_blocks(), 10);

    assert!(TransferList::parse_ranges("").is_err());
    assert!(TransferList::parse_ranges("1,10").is_err());
    assert!(TransferList::parse_ranges("1,10,5").is_err());
}

#[test]
fn test_transfer_list_script_parsing() {
    let script = r#"4
1000
10
2
# AOSP / Xiaomi transfer list command script
new 2,0,10,20,30
zero 1,10,20
stash stash_01 1,30,40
free stash_01
erase 1,40,50
other_cmd param
"#;

    let tl = TransferList::parse(Cursor::new(script)).expect("Parse transfer.list");
    assert_eq!(tl.version, 4);
    assert_eq!(tl.total_blocks, 1000);
    assert_eq!(tl.max_stashed_blocks, Some(10));
    assert_eq!(tl.num_stash_entries, Some(2));
    assert_eq!(tl.commands.len(), 6);

    assert_eq!(
        tl.commands[0],
        TransferCommand::New(vec![Range { start: 0, end: 10 }, Range { start: 20, end: 30 }])
    );
    assert_eq!(tl.commands[1], TransferCommand::Zero(vec![Range { start: 10, end: 20 }]));
    assert_eq!(
        tl.commands[2],
        TransferCommand::Stash("stash_01".to_string(), vec![Range { start: 30, end: 40 }])
    );
    assert_eq!(tl.commands[3], TransferCommand::Free("stash_01".to_string()));
    assert_eq!(tl.commands[4], TransferCommand::Erase(vec![Range { start: 40, end: 50 }]));
    assert_eq!(tl.commands[5], TransferCommand::Other("other_cmd param".to_string()));
}

#[test]
fn test_streaming_raw_extraction() {
    let temp_out = NamedTempFile::new().expect("Create temp output file");
    let out_path = temp_out.path();

    let tl_content = "1\n5\nnew 2,0,2,3,5\n";
    let tl = TransferList::parse(Cursor::new(tl_content)).expect("Parse transfer list");

    let mut raw_data = vec![0u8; 4 * BLOCK_SIZE];
    raw_data[0..BLOCK_SIZE].fill(0xAA);
    raw_data[BLOCK_SIZE..2 * BLOCK_SIZE].fill(0xBB);
    raw_data[2 * BLOCK_SIZE..3 * BLOCK_SIZE].fill(0xCC);
    raw_data[3 * BLOCK_SIZE..4 * BLOCK_SIZE].fill(0xDD);

    let bytes_written = XiaomiDatExtractor::extract_raw(&tl, Cursor::new(&raw_data), out_path)
        .expect("Extract raw dat");
    assert_eq!(bytes_written, 5 * BLOCK_SIZE as u64);

    let mut extracted = vec![0u8; 5 * BLOCK_SIZE];
    let mut f = File::open(out_path).expect("Open extracted image");
    f.read_exact(&mut extracted).expect("Read extracted file");

    assert_eq!(&extracted[0..BLOCK_SIZE], &raw_data[0..BLOCK_SIZE]);
    assert_eq!(&extracted[BLOCK_SIZE..2 * BLOCK_SIZE], &raw_data[BLOCK_SIZE..2 * BLOCK_SIZE]);
    // Block 2 is unwritten / hole (sparse zero)
    assert!(extracted[2 * BLOCK_SIZE..3 * BLOCK_SIZE].iter().all(|&b| b == 0));
    assert_eq!(
        &extracted[3 * BLOCK_SIZE..4 * BLOCK_SIZE],
        &raw_data[2 * BLOCK_SIZE..3 * BLOCK_SIZE]
    );
    assert_eq!(
        &extracted[4 * BLOCK_SIZE..5 * BLOCK_SIZE],
        &raw_data[3 * BLOCK_SIZE..4 * BLOCK_SIZE]
    );
}

#[cfg(feature = "brotli")]
#[test]
fn test_streaming_brotli_extraction() {
    let temp_out = NamedTempFile::new().expect("Create temp output file");
    let out_path = temp_out.path().to_path_buf();

    let temp_tl = NamedTempFile::new().expect("Create temp transfer list file");
    let tl_path = temp_tl.path().to_path_buf();

    let temp_br =
        tempfile::Builder::new().suffix(".new.dat.br").tempfile().expect("Create temp .br file");
    let br_path = temp_br.path().to_path_buf();

    let tl_content = "4\n4\n0\n0\nnew 1,1,3\n";
    std::fs::write(&tl_path, tl_content).expect("Write transfer.list");

    // 2 blocks of data for range 1..3
    let mut raw_data = vec![0u8; 2 * BLOCK_SIZE];
    raw_data[0..BLOCK_SIZE].fill(0x11);
    raw_data[BLOCK_SIZE..2 * BLOCK_SIZE].fill(0x22);

    let mut compressed = Vec::new();
    {
        let mut writer = brotli::CompressorWriter::new(&mut compressed, 4096, 6, 22);
        writer.write_all(&raw_data).expect("Compress raw data");
        writer.flush().expect("Flush compressor");
    }
    std::fs::write(&br_path, &compressed).expect("Write compressed dat.br");

    let extracted_len =
        extract_xiaomi_dat(&tl_path, &br_path, &out_path).expect("Extract xiaomi dat.br");
    assert_eq!(extracted_len, 4 * BLOCK_SIZE as u64);

    let mut result_buf = vec![0u8; 4 * BLOCK_SIZE];
    let mut f = File::open(&out_path).expect("Open extracted image");
    f.read_exact(&mut result_buf).expect("Read output file");

    assert!(result_buf[0..BLOCK_SIZE].iter().all(|&b| b == 0));
    assert_eq!(&result_buf[BLOCK_SIZE..3 * BLOCK_SIZE], &raw_data[..]);
    assert!(result_buf[3 * BLOCK_SIZE..4 * BLOCK_SIZE].iter().all(|&b| b == 0));
}
