//! Payload partition extraction with SHA-256 verification.

use super::parser::load_payload;
use super::zip::PayloadCache;
use crate::payload::chromeos_update_engine;
use anyhow::Result;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Read, Seek, SeekFrom, Write},
    path::Path,
};

const BLOCK_SIZE: u64 = 4096;

#[derive(Debug, Default, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PartitionDetail {
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Default, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtractPayloadResult {
    pub success: bool,
    pub output_dir: String,
    pub extracted_files: Vec<String>,
    pub error: Option<String>,
}

/// Extract selected partitions from a payload file.
///
/// # Arguments
/// * `payload_path` — Path to payload.bin or .zip containing it
/// * `output_dir` — Optional output directory (defaults to `extracted_{timestamp}` next to input)
/// * `selected_partitions` — Partition names to extract (empty = all)
/// * `cache` — Payload cache for ZIP extraction
/// * `progress` — Callback `(partition_name, current_op, total_ops, completed)`
pub fn extract_payload(
    payload_path: &Path,
    output_dir: Option<&Path>,
    selected_partitions: &[String],
    cache: &PayloadCache,
    mut progress: impl FnMut(&str, usize, usize, bool),
) -> Result<ExtractPayloadResult> {
    let payload = load_payload(payload_path, cache)?;
    let output_dir = output_dir
        .filter(|path| !path.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| default_output_dir(payload_path));
    fs::create_dir_all(&output_dir)?;

    let selected_names = if selected_partitions.is_empty() {
        None
    } else {
        Some(
            selected_partitions
                .iter()
                .map(String::as_str)
                .collect::<std::collections::HashSet<_>>(),
        )
    };

    let mut extracted_files = Vec::new();

    for partition in &payload.manifest.partitions {
        if let Some(selected_names) = selected_names.as_ref()
            && !selected_names.contains(partition.partition_name.as_str())
        {
            continue;
        }

        let file_name = format!("{}.img", partition.partition_name);
        let image_path = output_dir.join(&file_name);
        let mut image_file = fs::File::create(&image_path)?;
        extract_partition(&payload, partition, &mut image_file, &mut progress)?;
        extracted_files.push(file_name);
    }

    Ok(ExtractPayloadResult {
        success: true,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: None,
    })
}

fn extract_partition(
    payload: &super::parser::LoadedPayload,
    partition: &chromeos_update_engine::PartitionUpdate,
    image_file: &mut fs::File,
    progress: &mut impl FnMut(&str, usize, usize, bool),
) -> Result<()> {
    let total_operations = partition.operations.len();
    if total_operations == 0 {
        progress(&partition.partition_name, 0, 0, true);
        return Ok(());
    }

    for (index, operation) in partition.operations.iter().enumerate() {
        let destination_extents = operation.dst_extents.as_slice();
        if destination_extents.is_empty() {
            anyhow::bail!("missing destination extent for {}", partition.partition_name);
        }

        let expected_size: usize =
            destination_extents.iter().try_fold(0usize, |total, extent| {
                let block_count = usize::try_from(extent.num_blocks.unwrap_or_default())
                    .map_err(|_| anyhow::anyhow!("destination extent block count overflow"))?;
                total
                    .checked_add(
                        block_count
                            .checked_mul(BLOCK_SIZE as usize)
                            .ok_or_else(|| anyhow::anyhow!("destination extent size overflow"))?,
                    )
                    .ok_or_else(|| anyhow::anyhow!("destination extent total size overflow"))
            })?;

        let decoded = decode_operation(payload, operation, expected_size)?;
        let mut written = 0usize;

        for extent in destination_extents {
            let start_block = extent.start_block.unwrap_or_default();
            let num_blocks = extent.num_blocks.unwrap_or_default();
            let start_offset = start_block
                .checked_mul(BLOCK_SIZE)
                .ok_or_else(|| anyhow::anyhow!("destination seek overflow"))?;
            let extent_size = usize::try_from(num_blocks)
                .map_err(|_| anyhow::anyhow!("destination extent block count overflow"))?
                .checked_mul(BLOCK_SIZE as usize)
                .ok_or_else(|| anyhow::anyhow!("destination extent size overflow"))?;

            image_file.seek(SeekFrom::Start(start_offset))?;
            let end = written
                .checked_add(extent_size)
                .ok_or_else(|| anyhow::anyhow!("decoded payload slice overflow"))?;
            image_file.write_all(
                decoded
                    .get(written..end)
                    .ok_or_else(|| anyhow::anyhow!("decoded payload size mismatch"))?,
            )?;
            written = end;
        }

        if written != decoded.len() {
            anyhow::bail!("decoded payload size mismatch for {}", partition.partition_name);
        }

        let completed = index + 1 == total_operations;
        progress(&partition.partition_name, index + 1, total_operations, completed);
    }

    Ok(())
}

fn decode_operation(
    payload: &super::parser::LoadedPayload,
    operation: &chromeos_update_engine::InstallOperation,
    expected_size: usize,
) -> Result<Vec<u8>> {
    use chromeos_update_engine::install_operation::Type;

    let operation_type = Type::try_from(operation.r#type)
        .map_err(|_| anyhow::anyhow!("unsupported payload operation type {}", operation.r#type))?;

    let data_offset = payload.data_offset + operation.data_offset.unwrap_or_default() as usize;
    let data_length = operation.data_length.unwrap_or_default() as usize;
    let data_end = data_offset.saturating_add(data_length);
    if data_end > payload.bytes.len() {
        anyhow::bail!("payload operation data exceeds file size");
    }

    let raw_data = &payload.bytes[data_offset..data_end];

    // SHA-256 checksum verification
    if let Some(expected_hash) = operation.data_sha256_hash.as_ref()
        && !expected_hash.is_empty()
    {
        let actual_hash = Sha256::digest(raw_data);
        if actual_hash.as_slice() != expected_hash.as_slice() {
            anyhow::bail!("payload operation checksum mismatch");
        }
    }

    let mut decoded = match operation_type {
        Type::Replace => raw_data.to_vec(),
        Type::ReplaceXz => {
            let mut decoder = xz2::read::XzDecoder::new(Cursor::new(raw_data));
            read_all(&mut decoder)?
        }
        Type::ReplaceBz => {
            let mut decoder = bzip2::read::BzDecoder::new(Cursor::new(raw_data));
            read_all(&mut decoder)?
        }
        Type::Zstd => {
            let mut decoder = zstd::stream::read::Decoder::new(Cursor::new(raw_data))?;
            read_all(&mut decoder)?
        }
        Type::Zero => vec![0; expected_size],
        _ => anyhow::bail!("unsupported payload operation type {:?}", operation_type),
    };

    if decoded.len() > expected_size {
        anyhow::bail!(
            "decoded payload operation was larger than expected ({} > {})",
            decoded.len(),
            expected_size
        );
    }
    if decoded.len() < expected_size {
        decoded.resize(expected_size, 0);
    }

    Ok(decoded)
}

fn read_all(reader: &mut impl Read) -> Result<Vec<u8>> {
    let mut output = Vec::new();
    reader.read_to_end(&mut output)?;
    Ok(output)
}

fn default_output_dir(payload_path: &Path) -> PathBuf {
    let parent = payload_path.parent().unwrap_or_else(|| Path::new("."));
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    parent.join(format!("extracted_{timestamp}"))
}

use std::path::PathBuf;
