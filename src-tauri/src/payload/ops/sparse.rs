//! Android sparse image un-sparsing.
//!
//! Handles the 4 chunk types: Raw (0xCAC1), Fill (0xCAC2),
//! Don't Care (0xCAC3), and CRC32 (0xCAC4).

use anyhow::{Result, bail};
use std::io::{Cursor, Read, Seek, SeekFrom, Write};

/// Android sparse image magic number.
pub const SPARSE_MAGIC: u32 = 0xED26_FF3A;

const SPARSE_HEADER_SIZE: usize = 28;
const CHUNK_HEADER_SIZE: usize = 12;

const CHUNK_TYPE_RAW: u16 = 0xCAC1;
const CHUNK_TYPE_FILL: u16 = 0xCAC2;
const CHUNK_TYPE_DONT_CARE: u16 = 0xCAC3;
const CHUNK_TYPE_CRC32: u16 = 0xCAC4;

/// Check if data starts with the sparse image magic.
pub fn is_sparse(data: &[u8]) -> bool {
    data.len() >= 4
        && u32::from_le_bytes(data[..4].try_into().unwrap_or([0; 4])) == SPARSE_MAGIC
}

/// Un-sparse an Android sparse image, writing the raw output to `writer`.
/// Returns the total number of output bytes written.
pub fn unsparse(data: &[u8], writer: &mut (impl Write + Seek)) -> Result<u64> {
    if data.len() < SPARSE_HEADER_SIZE {
        bail!("Sparse image too small for header");
    }

    let magic = u32::from_le_bytes(data[0..4].try_into()?);
    if magic != SPARSE_MAGIC {
        bail!("Not a sparse image (magic: 0x{magic:08X})");
    }

    let _major_version = u16::from_le_bytes(data[4..6].try_into()?);
    let _minor_version = u16::from_le_bytes(data[6..8].try_into()?);
    let _file_hdr_sz = u16::from_le_bytes(data[8..10].try_into()?) as usize;
    let _chunk_hdr_sz = u16::from_le_bytes(data[10..12].try_into()?) as usize;
    let blk_sz = u32::from_le_bytes(data[12..16].try_into()?) as usize;
    let total_blks = u32::from_le_bytes(data[16..20].try_into()?) as u64;
    let total_chunks = u32::from_le_bytes(data[20..24].try_into()?) as usize;

    if blk_sz == 0 || blk_sz > 64 * 1024 {
        bail!("Sparse image: invalid block size {blk_sz}");
    }

    let mut cursor = Cursor::new(data);
    cursor.seek(SeekFrom::Start(SPARSE_HEADER_SIZE as u64))?;

    let mut output_offset: u64 = 0;
    let mut buf = vec![0u8; blk_sz.min(256 * 1024)];

    for _chunk_idx in 0..total_chunks {
        let mut chunk_hdr = [0u8; CHUNK_HEADER_SIZE];
        cursor.read_exact(&mut chunk_hdr)?;

        let chunk_type = u16::from_le_bytes(chunk_hdr[0..2].try_into()?);
        let chunk_sz = u32::from_le_bytes(chunk_hdr[4..8].try_into()?) as u64;
        let _total_sz = u32::from_le_bytes(chunk_hdr[8..12].try_into()?);

        let chunk_bytes = chunk_sz * blk_sz as u64;

        match chunk_type {
            CHUNK_TYPE_RAW => {
                // Copy raw data blocks
                let mut remaining = chunk_bytes as usize;
                while remaining > 0 {
                    let to_read = remaining.min(buf.len());
                    cursor.read_exact(&mut buf[..to_read])?;
                    writer.write_all(&buf[..to_read])?;
                    remaining -= to_read;
                }
            }
            CHUNK_TYPE_FILL => {
                // Read 4-byte fill pattern, write it repeated
                let mut fill = [0u8; 4];
                cursor.read_exact(&mut fill)?;

                let fill_buf: Vec<u8> = fill.iter().copied().cycle().take(blk_sz).collect();
                for _ in 0..chunk_sz {
                    writer.write_all(&fill_buf)?;
                }
            }
            CHUNK_TYPE_DONT_CARE => {
                // Seek past the region (leave as zeros in pre-allocated file)
                writer.seek(SeekFrom::Current(chunk_bytes as i64))?;
            }
            CHUNK_TYPE_CRC32 => {
                // Skip 4-byte CRC
                cursor.seek(SeekFrom::Current(4))?;
            }
            _ => {
                log::warn!("Sparse image: unknown chunk type 0x{chunk_type:04X}, skipping");
                // Try to skip based on total_sz minus header
                let skip = _total_sz.saturating_sub(CHUNK_HEADER_SIZE as u32);
                cursor.seek(SeekFrom::Current(skip as i64))?;
            }
        }

        output_offset += chunk_bytes;
    }

    // Sanity check
    let expected_size = total_blks * blk_sz as u64;
    if output_offset != expected_size {
        log::warn!(
            "Sparse image: output size mismatch (wrote {output_offset}, expected {expected_size})"
        );
    }

    Ok(output_offset)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_sparse_magic() {
        let mut data = vec![0u8; 8];
        data[..4].copy_from_slice(&SPARSE_MAGIC.to_le_bytes());
        assert!(is_sparse(&data));
        assert!(!is_sparse(&[0, 0, 0, 0]));
    }
}
