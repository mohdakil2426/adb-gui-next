//! Xiaomi system.transfer.list and system.new.dat[.br] Extractor.
//!
//! Reconstructs raw partition images from AOSP/MIUI block image transfer lists
//! and streaming Brotli-decompressed or raw block data streams.

use anyhow::{Context, Result, anyhow, bail};
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::Path;

/// Standard Android filesystem block size (4 KiB).
pub const BLOCK_SIZE: usize = 4096;

/// Default I/O chunk buffer size for bulk block streaming (64 KiB).
pub const DEFAULT_CHUNK_SIZE: usize = 64 * 1024;

/// Represents a half-open block interval `[start, end)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Range {
    pub start: u64,
    pub end: u64,
}

impl Range {
    /// Returns the number of blocks in this range.
    #[inline]
    pub fn num_blocks(&self) -> u64 {
        self.end.saturating_sub(self.start)
    }

    /// Returns the byte length corresponding to this range (`num_blocks * 4096`).
    #[inline]
    pub fn byte_len(&self) -> u64 {
        self.num_blocks().saturating_mul(BLOCK_SIZE as u64)
    }
}

/// Commands supported by AOSP/MIUI `transfer.list` scripts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TransferCommand {
    /// Zero/erase the destination blocks.
    Erase(Vec<Range>),
    /// Read consecutive blocks from the `.new.dat` stream and write to destination ranges.
    New(Vec<Range>),
    /// Fill the destination blocks with zero bytes.
    Zero(Vec<Range>),
    /// Stash blocks from source ranges into temporary storage identified by `stash_id`.
    Stash(String, Vec<Range>),
    /// Free previously stashed blocks.
    Free(String),
    /// Unrecognized or proprietary command line.
    Other(String),
}

/// Parsed `system.transfer.list` structure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransferList {
    /// Protocol version (1, 2, 3, 4).
    pub version: u32,
    /// Total number of 4096-byte blocks in the target partition image.
    pub total_blocks: u64,
    /// Maximum blocks stashed simultaneously (version >= 2).
    pub max_stashed_blocks: Option<u64>,
    /// Total number of stash entries (version >= 2).
    pub num_stash_entries: Option<u64>,
    /// Ordered list of transfer commands to execute.
    pub commands: Vec<TransferCommand>,
}

impl TransferList {
    /// Parses a `transfer.list` from any buffered reader.
    pub fn parse<R: BufRead>(reader: R) -> Result<Self> {
        let mut lines = reader.lines();

        let version_line = lines.next().ok_or_else(|| anyhow!("Empty transfer.list file"))??;
        let version: u32 =
            version_line.trim().parse().context("Invalid transfer.list version header")?;

        let total_blocks_line =
            lines.next().ok_or_else(|| anyhow!("Missing total blocks line in transfer.list"))??;
        let total_blocks: u64 = total_blocks_line
            .trim()
            .parse()
            .context("Invalid total blocks value in transfer.list")?;

        let mut max_stashed_blocks = None;
        let mut num_stash_entries = None;

        if version >= 2 {
            if let Some(line) = lines.next() {
                let l = line?;
                max_stashed_blocks = l.trim().parse().ok();
            }
            if let Some(line) = lines.next() {
                let l = line?;
                num_stash_entries = l.trim().parse().ok();
            }
        }

        let mut commands = Vec::new();

        for line_res in lines {
            let line = line_res?;
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.is_empty() {
                continue;
            }

            match parts[0] {
                "new" => {
                    if parts.len() < 2 {
                        bail!("'new' command missing range argument: {trimmed}");
                    }
                    let ranges = Self::parse_ranges(parts[1])?;
                    commands.push(TransferCommand::New(ranges));
                }
                "erase" => {
                    if parts.len() < 2 {
                        bail!("'erase' command missing range argument: {trimmed}");
                    }
                    let ranges = Self::parse_ranges(parts[1])?;
                    commands.push(TransferCommand::Erase(ranges));
                }
                "zero" => {
                    if parts.len() < 2 {
                        bail!("'zero' command missing range argument: {trimmed}");
                    }
                    let ranges = Self::parse_ranges(parts[1])?;
                    commands.push(TransferCommand::Zero(ranges));
                }
                "stash" => {
                    if parts.len() < 3 {
                        bail!("'stash' command missing arguments: {trimmed}");
                    }
                    let stash_id = parts[1].to_string();
                    let ranges = Self::parse_ranges(parts[2])?;
                    commands.push(TransferCommand::Stash(stash_id, ranges));
                }
                "free" => {
                    if parts.len() < 2 {
                        bail!("'free' command missing stash id: {trimmed}");
                    }
                    commands.push(TransferCommand::Free(parts[1].to_string()));
                }
                _ => {
                    commands.push(TransferCommand::Other(trimmed.to_string()));
                }
            }
        }

        Ok(Self { version, total_blocks, max_stashed_blocks, num_stash_entries, commands })
    }

    /// Parses a range specification string of the form `count,start1,end1,start2,end2,...`.
    pub fn parse_ranges(raw: &str) -> Result<Vec<Range>> {
        let tokens: Vec<&str> =
            raw.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();

        if tokens.is_empty() {
            bail!("Invalid empty range specifier");
        }

        let num_ranges: usize =
            tokens[0].parse().context("Invalid range count in range specifier")?;

        if tokens.len() != 1 + num_ranges * 2 {
            bail!(
                "Range token count mismatch: expected {} tokens (1 + {}*2), found {}",
                1 + num_ranges * 2,
                num_ranges,
                tokens.len()
            );
        }

        let mut ranges = Vec::with_capacity(num_ranges);
        for i in 0..num_ranges {
            let start: u64 = tokens[1 + i * 2].parse().context("Invalid range start block")?;
            let end: u64 = tokens[2 + i * 2].parse().context("Invalid range end block")?;
            if end < start {
                bail!("Invalid range interval: end ({end}) < start ({start})");
            }
            ranges.push(Range { start, end });
        }

        Ok(ranges)
    }
}

/// Extractor engine for Xiaomi / AOSP `.new.dat` and `.new.dat.br` firmware files.
pub struct XiaomiDatExtractor;

impl XiaomiDatExtractor {
    /// Streams Brotli-decompressed blocks from `compressed_dat_stream` into `output_image_path`.
    #[cfg(feature = "brotli")]
    pub fn extract<R: Read>(
        transfer_list: &TransferList,
        compressed_dat_stream: R,
        output_image_path: &Path,
    ) -> Result<u64> {
        let decompressor = brotli::Decompressor::new(compressed_dat_stream, 65536);
        Self::extract_from_reader(transfer_list, decompressor, output_image_path)
    }

    /// Extracts from an already uncompressed / raw `.new.dat` stream into `output_image_path`.
    pub fn extract_raw<R: Read>(
        transfer_list: &TransferList,
        raw_dat_stream: R,
        output_image_path: &Path,
    ) -> Result<u64> {
        Self::extract_from_reader(transfer_list, raw_dat_stream, output_image_path)
    }

    /// Core streaming extractor: pre-allocates destination file and processes commands.
    pub fn extract_from_reader<R: Read>(
        transfer_list: &TransferList,
        mut reader: R,
        output_image_path: &Path,
    ) -> Result<u64> {
        let file = File::create(output_image_path).with_context(|| {
            format!("Failed to create output image at {}", output_image_path.display())
        })?;

        let total_bytes =
            transfer_list.total_blocks.checked_mul(BLOCK_SIZE as u64).ok_or_else(|| {
                anyhow!(
                    "Total image size overflow ({} blocks * {} bytes)",
                    transfer_list.total_blocks,
                    BLOCK_SIZE
                )
            })?;

        file.set_len(total_bytes).with_context(|| {
            format!("Failed to pre-allocate output image size to {total_bytes} bytes")
        })?;

        let mut out_file = BufWriter::with_capacity(256 * 1024, file);
        let mut chunk_buf = vec![0u8; DEFAULT_CHUNK_SIZE];
        let zero_buf = vec![0u8; DEFAULT_CHUNK_SIZE];

        for cmd in &transfer_list.commands {
            match cmd {
                TransferCommand::New(ranges) => {
                    for range in ranges {
                        let range_bytes = range.byte_len();
                        if range_bytes == 0 {
                            continue;
                        }

                        let start_offset =
                            range.start.checked_mul(BLOCK_SIZE as u64).ok_or_else(|| {
                                anyhow!("Seek offset overflow for block {}", range.start)
                            })?;

                        out_file
                            .seek(SeekFrom::Start(start_offset))
                            .with_context(|| format!("Seek failed to offset {start_offset}"))?;

                        let mut remaining = range_bytes;
                        while remaining > 0 {
                            let to_read = (remaining.min(chunk_buf.len() as u64)) as usize;
                            reader.read_exact(&mut chunk_buf[..to_read]).with_context(|| {
                                format!(
                                    "Unexpected EOF reading {to_read} bytes from dat stream for range {range:?}"
                                )
                            })?;
                            out_file.write_all(&chunk_buf[..to_read]).with_context(|| {
                                format!("Failed writing {to_read} bytes to output image")
                            })?;
                            remaining -= to_read as u64;
                        }
                    }
                }
                TransferCommand::Zero(ranges) | TransferCommand::Erase(ranges) => {
                    for range in ranges {
                        let range_bytes = range.byte_len();
                        if range_bytes == 0 {
                            continue;
                        }

                        let start_offset =
                            range.start.checked_mul(BLOCK_SIZE as u64).ok_or_else(|| {
                                anyhow!("Seek offset overflow for block {}", range.start)
                            })?;

                        out_file
                            .seek(SeekFrom::Start(start_offset))
                            .with_context(|| format!("Seek failed to offset {start_offset}"))?;

                        let mut remaining = range_bytes;
                        while remaining > 0 {
                            let to_write = (remaining.min(zero_buf.len() as u64)) as usize;
                            out_file.write_all(&zero_buf[..to_write]).with_context(|| {
                                format!("Failed writing {to_write} zero bytes to output image")
                            })?;
                            remaining -= to_write as u64;
                        }
                    }
                }
                TransferCommand::Stash(_, _)
                | TransferCommand::Free(_)
                | TransferCommand::Other(_) => {
                    // Non-block-writing commands in full images
                }
            }
        }

        out_file.flush().context("Failed to flush output image buffer")?;
        Ok(total_bytes)
    }
}

/// High-level function: parses `transfer.list`, opens `.new.dat` / `.new.dat.br`, and extracts the partition image.
pub fn extract_xiaomi_dat(
    transfer_list_path: &Path,
    dat_br_path: &Path,
    output_img_path: &Path,
) -> Result<u64> {
    let tl_file = File::open(transfer_list_path).with_context(|| {
        format!("Failed to open transfer.list at {}", transfer_list_path.display())
    })?;
    let transfer_list = TransferList::parse(BufReader::new(tl_file))?;

    let dat_file = File::open(dat_br_path)
        .with_context(|| format!("Failed to open dat file at {}", dat_br_path.display()))?;
    let dat_reader = BufReader::with_capacity(128 * 1024, dat_file);

    let is_brotli = dat_br_path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("br"));

    #[cfg(feature = "brotli")]
    if is_brotli {
        return XiaomiDatExtractor::extract(&transfer_list, dat_reader, output_img_path);
    }

    #[cfg(not(feature = "brotli"))]
    if is_brotli {
        bail!("Brotli compression feature is disabled; cannot decompress .br files");
    }

    XiaomiDatExtractor::extract_raw(&transfer_list, dat_reader, output_img_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use tempfile::NamedTempFile;

    #[test]
    fn test_parse_ranges_valid() {
        let single = TransferList::parse_ranges("1,0,10").expect("Valid single range");
        assert_eq!(single, vec![Range { start: 0, end: 10 }]);
        assert_eq!(single[0].num_blocks(), 10);
        assert_eq!(single[0].byte_len(), 40960);

        let multi = TransferList::parse_ranges("2,0,5,10,20").expect("Valid multi range");
        assert_eq!(multi, vec![Range { start: 0, end: 5 }, Range { start: 10, end: 20 }]);
        assert_eq!(multi[0].num_blocks(), 5);
        assert_eq!(multi[1].num_blocks(), 10);
    }

    #[test]
    fn test_parse_ranges_invalid() {
        assert!(TransferList::parse_ranges("").is_err());
        assert!(TransferList::parse_ranges("0").is_ok());
        assert!(TransferList::parse_ranges("1,10").is_err());
        assert!(TransferList::parse_ranges("1,10,5").is_err()); // end < start
        assert!(TransferList::parse_ranges("2,0,5,10").is_err()); // count mismatch
    }

    #[test]
    fn test_parse_transfer_list_v1_and_v4() {
        let v1_content = "1\n100\nnew 1,0,50\nerase 1,50,100\n";
        let tl_v1 = TransferList::parse(Cursor::new(v1_content)).expect("Parse v1 transfer.list");
        assert_eq!(tl_v1.version, 1);
        assert_eq!(tl_v1.total_blocks, 100);
        assert_eq!(tl_v1.commands.len(), 2);
        assert_eq!(tl_v1.commands[0], TransferCommand::New(vec![Range { start: 0, end: 50 }]));
        assert_eq!(tl_v1.commands[1], TransferCommand::Erase(vec![Range { start: 50, end: 100 }]));

        let v4_content = r#"4
1000
10
2
# comment line
new 2,0,10,20,30
zero 1,10,20
stash id_abc 1,30,40
free id_abc
erase 1,40,50
unknown_cmd parameter
"#;
        let tl_v4 = TransferList::parse(Cursor::new(v4_content)).expect("Parse v4 transfer.list");
        assert_eq!(tl_v4.version, 4);
        assert_eq!(tl_v4.total_blocks, 1000);
        assert_eq!(tl_v4.max_stashed_blocks, Some(10));
        assert_eq!(tl_v4.num_stash_entries, Some(2));
        assert_eq!(tl_v4.commands.len(), 6);
        assert_eq!(
            tl_v4.commands[0],
            TransferCommand::New(vec![Range { start: 0, end: 10 }, Range { start: 20, end: 30 }])
        );
        assert_eq!(tl_v4.commands[1], TransferCommand::Zero(vec![Range { start: 10, end: 20 }]));
        assert_eq!(
            tl_v4.commands[2],
            TransferCommand::Stash("id_abc".to_string(), vec![Range { start: 30, end: 40 }])
        );
        assert_eq!(tl_v4.commands[3], TransferCommand::Free("id_abc".to_string()));
        assert_eq!(tl_v4.commands[4], TransferCommand::Erase(vec![Range { start: 40, end: 50 }]));
        assert_eq!(tl_v4.commands[5], TransferCommand::Other("unknown_cmd parameter".to_string()));
    }

    #[test]
    fn test_extract_raw_stream() {
        let temp_out = NamedTempFile::new().expect("Create temp output file");
        let out_path = temp_out.path();

        let tl_content = "1\n5\nnew 2,0,2,3,5\n";
        let tl = TransferList::parse(Cursor::new(tl_content)).expect("Parse transfer list");

        // 4 blocks of data (2 for 0..2, 2 for 3..5)
        let mut raw_data = vec![0u8; 4 * BLOCK_SIZE];
        // Block 0: filled with 0xAA
        raw_data[0..BLOCK_SIZE].fill(0xAA);
        // Block 1: filled with 0xBB
        raw_data[BLOCK_SIZE..2 * BLOCK_SIZE].fill(0xBB);
        // Block 3 (index 2 in raw stream): filled with 0xCC
        raw_data[2 * BLOCK_SIZE..3 * BLOCK_SIZE].fill(0xCC);
        // Block 4 (index 3 in raw stream): filled with 0xDD
        raw_data[3 * BLOCK_SIZE..4 * BLOCK_SIZE].fill(0xDD);

        let bytes_written = XiaomiDatExtractor::extract_raw(&tl, Cursor::new(&raw_data), out_path)
            .expect("Extract raw dat");
        assert_eq!(bytes_written, 5 * BLOCK_SIZE as u64);

        let mut extracted = vec![0u8; 5 * BLOCK_SIZE];
        let mut f = File::open(out_path).expect("Open extracted image");
        f.read_exact(&mut extracted).expect("Read extracted file");

        // Verify block 0..2
        assert_eq!(&extracted[0..BLOCK_SIZE], &raw_data[0..BLOCK_SIZE]);
        assert_eq!(&extracted[BLOCK_SIZE..2 * BLOCK_SIZE], &raw_data[BLOCK_SIZE..2 * BLOCK_SIZE]);
        // Verify block 2 is hole/zero (not written by new)
        assert!(extracted[2 * BLOCK_SIZE..3 * BLOCK_SIZE].iter().all(|&b| b == 0));
        // Verify block 3..5
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
    fn test_extract_brotli_stream_and_high_level_fn() {
        let temp_out = NamedTempFile::new().expect("Create temp output file");
        let out_path = temp_out.path().to_path_buf();

        let temp_tl = NamedTempFile::new().expect("Create temp transfer list file");
        let tl_path = temp_tl.path().to_path_buf();

        let temp_br = tempfile::Builder::new()
            .suffix(".new.dat.br")
            .tempfile()
            .expect("Create temp .br file");
        let br_path = temp_br.path().to_path_buf();

        let tl_content = "4\n4\n0\n0\nnew 1,1,3\n";
        std::fs::write(&tl_path, tl_content).expect("Write transfer.list");

        // 2 blocks of data for range 1..3
        let mut raw_data = vec![0u8; 2 * BLOCK_SIZE];
        raw_data[0..BLOCK_SIZE].fill(0x11);
        raw_data[BLOCK_SIZE..2 * BLOCK_SIZE].fill(0x22);

        // Compress raw_data with brotli
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

        // Block 0 is zero
        assert!(result_buf[0..BLOCK_SIZE].iter().all(|&b| b == 0));
        // Block 1..3 has raw_data
        assert_eq!(&result_buf[BLOCK_SIZE..3 * BLOCK_SIZE], &raw_data[..]);
        // Block 3 is zero
        assert!(result_buf[3 * BLOCK_SIZE..4 * BLOCK_SIZE].iter().all(|&b| b == 0));
    }
}
