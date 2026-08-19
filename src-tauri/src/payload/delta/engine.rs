//! Delta / Incremental OTA Differential Engine.
//! Handles SOURCE_COPY, SOURCE_BSDIFF, PUFFDIFF, and BROTLI_BSDIFF operations with 512 MB safety caps.

use crate::payload::chromeos_update_engine::{self, install_operation::Type};
use anyhow::{Context, Result, bail};
use sha2::{Digest, Sha256};
use std::io::{Cursor, Read, Seek, SeekFrom, Write};

/// Safety cap: 512 MB maximum memory buffer per operation to prevent OOM DOS attacks.
pub const MAX_OPERATION_SIZE: usize = 512 * 1024 * 1024; // 512 MiB
pub const DEFAULT_BLOCK_SIZE: usize = 4096;

/// Extent representing a contiguous block range on disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Extent {
    pub start_block: u64,
    pub num_blocks: u64,
}

impl From<&chromeos_update_engine::Extent> for Extent {
    fn from(e: &chromeos_update_engine::Extent) -> Self {
        Self {
            start_block: e.start_block.unwrap_or_default(),
            num_blocks: e.num_blocks.unwrap_or_default(),
        }
    }
}

pub struct DeltaEngine;

impl DeltaEngine {
    /// Read blocks from `reader` defined by `extents`.
    pub fn read_extents<R: Read + Seek>(
        reader: &mut R,
        extents: &[Extent],
        block_size: usize,
    ) -> Result<Vec<u8>> {
        let total_blocks: u64 = extents.iter().map(|e| e.num_blocks).sum();
        let total_bytes = usize::try_from(total_blocks)
            .context("Total blocks overflow usize")?
            .checked_mul(block_size)
            .context("Total bytes calculation overflow")?;

        if total_bytes > MAX_OPERATION_SIZE {
            bail!(
                "Source extents size ({} bytes) exceeds 512 MB safety cap ({})",
                total_bytes,
                MAX_OPERATION_SIZE
            );
        }

        let mut buffer = vec![0u8; total_bytes];
        let mut offset = 0usize;

        for ext in extents {
            let start_offset = ext
                .start_block
                .checked_mul(block_size as u64)
                .context("Extent start offset calculation overflow")?;
            reader.seek(SeekFrom::Start(start_offset))?;

            let len = usize::try_from(ext.num_blocks)
                .context("Extent num blocks overflow usize")?
                .checked_mul(block_size)
                .context("Extent length calculation overflow")?;

            let end = offset.checked_add(len).context("Buffer offset overflow")?;
            if end > buffer.len() {
                bail!("Extents exceed allocated buffer size");
            }
            reader.read_exact(&mut buffer[offset..end])?;
            offset = end;
        }

        Ok(buffer)
    }

    /// Write blocks to `writer` defined by `extents`.
    pub fn write_extents<W: Write + Seek>(
        writer: &mut W,
        extents: &[Extent],
        data: &[u8],
        block_size: usize,
    ) -> Result<()> {
        let mut offset = 0usize;
        for ext in extents {
            let start_offset = ext
                .start_block
                .checked_mul(block_size as u64)
                .context("Extent start offset calculation overflow")?;
            writer.seek(SeekFrom::Start(start_offset))?;

            let len = usize::try_from(ext.num_blocks)
                .context("Extent num blocks overflow usize")?
                .checked_mul(block_size)
                .context("Extent length calculation overflow")?;

            let end = offset.checked_add(len).context("Data offset overflow")?;
            if end > data.len() {
                bail!("Extent size exceeds data buffer length");
            }
            writer.write_all(&data[offset..end])?;
            offset = end;
        }
        Ok(())
    }

    /// Apply BSDiff binary patch (`patch`) against `old_buf` and write result into `dst_buf`.
    pub fn apply_bspatch(old_buf: &[u8], patch: &[u8], dst_buf: &mut [u8]) -> Result<()> {
        if patch.len() < 32 {
            bail!("BSDiff patch too small ({} bytes, min 32)", patch.len());
        }

        let magic = &patch[0..8];
        let is_bsdiff40 = magic == b"BSDIFF40";
        let is_bsdf2 = magic == b"BSDF2\0\0\0" || &magic[..5] == b"BSDF2";
        let is_bsdiff43 = magic == b"BSDIFF43" || magic == b"ENDS\0\0\0\0";

        if !is_bsdiff40 && !is_bsdf2 && !is_bsdiff43 {
            // Check if magic might be standard BSDiff
            if &patch[0..6] != b"BSDIFF" && &patch[0..5] != b"BSDF2" {
                bail!("Invalid BSDiff magic: {:?}", &patch[0..8.min(patch.len())]);
            }
        }

        let ctrl_len = offtin(&patch[8..16]);
        let diff_len = offtin(&patch[16..24]);
        let new_size = offtin(&patch[24..32]);

        if ctrl_len < 0 || diff_len < 0 || new_size < 0 {
            bail!(
                "Corrupt BSDiff header: negative sizes (ctrl={}, diff={}, new={})",
                ctrl_len,
                diff_len,
                new_size
            );
        }

        let ctrl_len = ctrl_len as usize;
        let diff_len = diff_len as usize;
        let new_size = new_size as usize;

        if new_size > MAX_OPERATION_SIZE {
            bail!(
                "BSDiff new size ({} bytes) exceeds 512 MB safety cap ({})",
                new_size,
                MAX_OPERATION_SIZE
            );
        }

        let ctrl_end = 32usize.checked_add(ctrl_len).context("ctrl_len offset overflow")?;
        let diff_end = ctrl_end.checked_add(diff_len).context("diff_len offset overflow")?;

        if diff_end > patch.len() {
            bail!(
                "BSDiff patch truncated: required at least {} bytes, got {}",
                diff_end,
                patch.len()
            );
        }

        let ctrl_slice = &patch[32..ctrl_end];
        let diff_slice = &patch[ctrl_end..diff_end];
        let extra_slice = &patch[diff_end..];

        // Decompress control, diff, and extra streams (bzip2 or raw)
        let ctrl_data = decompress_stream(ctrl_slice)?;
        let diff_data = decompress_stream(diff_slice)?;
        let extra_data = decompress_stream(extra_slice)?;

        if dst_buf.len() < new_size {
            bail!("Destination buffer too small ({} bytes, required {})", dst_buf.len(), new_size);
        }

        let mut old_pos: i64 = 0;
        let mut new_pos: usize = 0;
        let mut diff_pos: usize = 0;
        let mut extra_pos: usize = 0;
        let mut ctrl_pos: usize = 0;

        while new_pos < new_size {
            if ctrl_pos + 24 > ctrl_data.len() {
                bail!("BSDiff control stream ended prematurely");
            }

            let x = offtin(&ctrl_data[ctrl_pos..ctrl_pos + 8]);
            let y = offtin(&ctrl_data[ctrl_pos + 8..ctrl_pos + 16]);
            let z = offtin(&ctrl_data[ctrl_pos + 16..ctrl_pos + 24]);
            ctrl_pos += 24;

            if x < 0 || y < 0 {
                bail!("Corrupt BSDiff control entry: x={}, y={}", x, y);
            }

            let x = x as usize;
            let y = y as usize;

            if new_pos + x > new_size || diff_pos + x > diff_data.len() {
                bail!("BSDiff diff block overflow");
            }

            for _ in 0..x {
                let old_byte = if old_pos >= 0 && (old_pos as usize) < old_buf.len() {
                    old_buf[old_pos as usize]
                } else {
                    0
                };
                dst_buf[new_pos] = old_byte.wrapping_add(diff_data[diff_pos]);
                old_pos += 1;
                new_pos += 1;
                diff_pos += 1;
            }

            if new_pos + y > new_size || extra_pos + y > extra_data.len() {
                bail!("BSDiff extra block overflow");
            }

            for _ in 0..y {
                dst_buf[new_pos] = extra_data[extra_pos];
                new_pos += 1;
                extra_pos += 1;
            }

            old_pos += z;
        }

        Ok(())
    }

    /// Apply PUFFDIFF patch against `old_buf` and write result into `dst_buf`.
    pub fn apply_puffpatch(old_buf: &[u8], patch: &[u8], dst_buf: &mut [u8]) -> Result<()> {
        if patch.len() < 4 {
            bail!("PUFFDIFF patch is too small");
        }

        // If patch starts with PUF1 magic, header parsing:
        if &patch[0..4] == b"PUF1" {
            // Standard Puffin v1: Header has magic, metadata length, then BSDiff patch
            if patch.len() > 8 {
                let meta_len = u32::from_be_bytes(
                    patch[4..8]
                        .try_into()
                        .map_err(|_| anyhow::anyhow!("PUF1 meta length slice too short"))?,
                ) as usize;
                let patch_start = 8 + meta_len;
                if patch_start < patch.len() {
                    return Self::apply_bspatch(old_buf, &patch[patch_start..], dst_buf);
                }
            }
        }

        // Fallback or standard BSDiff format inside PUFFDIFF
        Self::apply_bspatch(old_buf, patch, dst_buf)
    }

    /// Apply a single delta operation (SOURCE_COPY, SOURCE_BSDIFF, PUFFDIFF, BROTLI_BSDIFF).
    #[allow(clippy::too_many_arguments, deprecated)]
    pub fn apply_operation<R: Read + Seek, W: Write + Seek>(
        op_type: Type,
        patch_blob: &[u8],
        src_reader: &mut R,
        src_extents: &[Extent],
        dst_writer: &mut W,
        dst_extents: &[Extent],
        block_size: usize,
        expected_src_hash: Option<&[u8]>,
    ) -> Result<()> {
        let total_dst_blocks: u64 = dst_extents.iter().map(|e| e.num_blocks).sum();
        let dst_bytes = usize::try_from(total_dst_blocks)
            .context("Total dst blocks overflow usize")?
            .checked_mul(block_size)
            .context("Dst bytes calculation overflow")?;

        if dst_bytes > MAX_OPERATION_SIZE {
            bail!(
                "Destination extents size ({} bytes) exceeds 512 MB safety cap ({})",
                dst_bytes,
                MAX_OPERATION_SIZE
            );
        }

        match op_type {
            Type::SourceCopy | Type::Move => {
                let src_data = Self::read_extents(src_reader, src_extents, block_size)?;
                if let Some(exp_hash) = expected_src_hash.filter(|h| !h.is_empty()) {
                    let digest = Sha256::digest(&src_data);
                    if digest.as_slice() != exp_hash {
                        bail!("Source extents SHA-256 hash mismatch");
                    }
                }
                Self::write_extents(dst_writer, dst_extents, &src_data, block_size)?;
            }
            Type::SourceBsdiff | Type::Bsdiff => {
                let src_data = Self::read_extents(src_reader, src_extents, block_size)?;
                if let Some(exp_hash) = expected_src_hash.filter(|h| !h.is_empty()) {
                    let digest = Sha256::digest(&src_data);
                    if digest.as_slice() != exp_hash {
                        bail!("Source extents SHA-256 hash mismatch");
                    }
                }

                let mut dst_data = vec![0u8; dst_bytes];
                Self::apply_bspatch(&src_data, patch_blob, &mut dst_data)
                    .context("SourceBsdiff patch failed")?;
                Self::write_extents(dst_writer, dst_extents, &dst_data, block_size)?;
            }
            Type::Puffdiff => {
                let src_data = Self::read_extents(src_reader, src_extents, block_size)?;
                if let Some(exp_hash) = expected_src_hash.filter(|h| !h.is_empty()) {
                    let digest = Sha256::digest(&src_data);
                    if digest.as_slice() != exp_hash {
                        bail!("Source extents SHA-256 hash mismatch");
                    }
                }

                let mut dst_data = vec![0u8; dst_bytes];
                Self::apply_puffpatch(&src_data, patch_blob, &mut dst_data)
                    .context("Puffdiff patch failed")?;
                Self::write_extents(dst_writer, dst_extents, &dst_data, block_size)?;
            }
            Type::BrotliBsdiff => {
                let src_data = Self::read_extents(src_reader, src_extents, block_size)?;
                if let Some(exp_hash) = expected_src_hash.filter(|h| !h.is_empty()) {
                    let digest = Sha256::digest(&src_data);
                    if digest.as_slice() != exp_hash {
                        bail!("Source extents SHA-256 hash mismatch");
                    }
                }

                #[cfg(feature = "brotli")]
                let decompressed_patch = {
                    let mut decompressed = Vec::new();
                    let mut decompressor =
                        brotli::Decompressor::new(Cursor::new(patch_blob), 65536);
                    let mut take = (&mut decompressor).take(MAX_OPERATION_SIZE as u64 + 1);
                    take.read_to_end(&mut decompressed).context("Brotli decompression failed")?;
                    if decompressed.len() > MAX_OPERATION_SIZE {
                        bail!("Decompressed Brotli patch exceeds 512 MB safety cap");
                    }
                    decompressed
                };

                #[cfg(not(feature = "brotli"))]
                bail!("BROTLI_BSDIFF requires the 'brotli' crate feature");

                let mut dst_data = vec![0u8; dst_bytes];
                Self::apply_bspatch(&src_data, &decompressed_patch, &mut dst_data)
                    .context("BrotliBsdiff patch failed")?;
                Self::write_extents(dst_writer, dst_extents, &dst_data, block_size)?;
            }
            Type::Zero => {
                let zero_data = vec![0u8; dst_bytes];
                Self::write_extents(dst_writer, dst_extents, &zero_data, block_size)?;
            }
            other => bail!("Delta engine does not handle operation type {:?}", other),
        }

        Ok(())
    }
}

/// Decompress stream using bzip2 if it starts with `BZh` or decompression succeeds;
/// otherwise returns stream as raw slice.
fn decompress_stream(data: &[u8]) -> Result<Vec<u8>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    if data.starts_with(b"BZh") {
        let mut decoder = bzip2::read::BzDecoder::new(Cursor::new(data));
        let mut out = Vec::new();
        let mut take = (&mut decoder).take(MAX_OPERATION_SIZE as u64 + 1);
        if take.read_to_end(&mut out).is_ok() && !out.is_empty() {
            if out.len() > MAX_OPERATION_SIZE {
                bail!("Decompressed stream exceeds 512 MB safety cap");
            }
            return Ok(out);
        }
    }

    // Try bzip2 regardless if it didn't explicitly have BZh header
    let mut decoder = bzip2::read::BzDecoder::new(Cursor::new(data));
    let mut out = Vec::new();
    let mut take = (&mut decoder).take(MAX_OPERATION_SIZE as u64 + 1);
    if take.read_to_end(&mut out).is_ok() && !out.is_empty() {
        if out.len() > MAX_OPERATION_SIZE {
            bail!("Decompressed stream exceeds 512 MB safety cap");
        }
        return Ok(out);
    }

    // Raw uncompressed data fallback
    if data.len() > MAX_OPERATION_SIZE {
        bail!("Raw stream data exceeds 512 MB safety cap");
    }
    Ok(data.to_vec())
}

/// Decode 64-bit signed integer using BSDiff sign-magnitude format.
pub fn offtin(buf: &[u8]) -> i64 {
    if buf.len() < 8 {
        return 0;
    }
    let sign = (buf[7] & 0x80) != 0;
    let mut val = (buf[7] & 0x7F) as i64;
    for i in (0..7).rev() {
        val = (val << 8) | (buf[i] as i64);
    }
    if sign { -val } else { val }
}
