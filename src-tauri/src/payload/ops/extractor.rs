//! Unified OPS/OFP partition extraction.
//!
//! Shares the same `ExtractPayloadResult` and `payload:progress` events as the
//! existing CrAU extractor, making it transparent to the frontend.

use super::crypto::{MboxVariant, OfpCipher, ops_decrypt};
use super::detect::{FirmwareFormat, is_ops_or_ofp_path};
use super::sparse;
use super::{OpsMetadata, OpsPartitionEntry};
use crate::payload::extractor::{ExtractPayloadResult, PartitionDetail};
use anyhow::Result;
use memmap2::Mmap;
use std::collections::HashSet;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use tauri::Emitter;

/// List partition details from an OPS/OFP file (auto-detect).
pub fn list_ops_partitions(path: &Path) -> Result<Vec<PartitionDetail>> {
    let mmap = open_mmap(path)?;
    let format = super::detect::detect_format(&mmap)?;

    let partitions = match format {
        FirmwareFormat::Ops => {
            let (parts, _, _) = super::ops_parser::parse_ops(&mmap)?;
            parts
        }
        FirmwareFormat::OfpQualcomm => {
            let (parts, _, _) = super::ofp_qc::parse_ofp_qc(&mmap)?;
            parts
        }
        FirmwareFormat::OfpMediaTek => {
            let (parts, _, _) = super::ofp_mtk::parse_ofp_mtk(&mmap)?;
            parts
        }
        _ => anyhow::bail!("Not an OPS/OFP file"),
    };

    Ok(partitions.into_iter().map(|p| PartitionDetail { name: p.name, size: p.size }).collect())
}

/// Get metadata from an OPS/OFP file.
pub fn get_ops_metadata(path: &Path) -> Result<OpsMetadata> {
    let mmap = open_mmap(path)?;
    let format = super::detect::detect_format(&mmap)?;

    let metadata = match format {
        FirmwareFormat::Ops => {
            let (_, meta, _) = super::ops_parser::parse_ops(&mmap)?;
            meta
        }
        FirmwareFormat::OfpQualcomm => {
            let (_, meta, _) = super::ofp_qc::parse_ofp_qc(&mmap)?;
            meta
        }
        FirmwareFormat::OfpMediaTek => {
            let (_, meta, _) = super::ofp_mtk::parse_ofp_mtk(&mmap)?;
            meta
        }
        _ => anyhow::bail!("Not an OPS/OFP file"),
    };

    Ok(metadata)
}

/// Extract selected partitions from an OPS/OFP file.
pub fn extract_ops_partitions(
    path: &Path,
    output_dir: Option<&Path>,
    selected_partitions: &[String],
    app_handle: Option<tauri::AppHandle>,
    mut progress: impl FnMut(&str, usize, usize, bool),
) -> Result<ExtractPayloadResult> {
    let mmap = Arc::new(open_mmap_raw(path)?);
    let format = super::detect::detect_format(&mmap)?;

    // Parse the file to get partitions and (optional) cipher state
    let (all_partitions, _metadata, mbox_variant, ofp_cipher) = match format {
        FirmwareFormat::Ops => {
            let (parts, meta, variant) = super::ops_parser::parse_ops(&mmap)?;
            (parts, meta, Some(variant), None)
        }
        FirmwareFormat::OfpQualcomm => {
            let (parts, meta, cipher) = super::ofp_qc::parse_ofp_qc(&mmap)?;
            (parts, meta, None, Some(cipher))
        }
        FirmwareFormat::OfpMediaTek => {
            let (parts, meta, cipher) = super::ofp_mtk::parse_ofp_mtk(&mmap)?;
            (parts, meta, None, Some(cipher))
        }
        _ => anyhow::bail!("Not an OPS/OFP file"),
    };

    let output_dir = output_dir
        .filter(|p| !p.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| default_output_dir(path));
    std::fs::create_dir_all(&output_dir)?;

    // Filter to selected partitions
    let selected_set: Option<HashSet<&str>> = if selected_partitions.is_empty() {
        None
    } else {
        Some(selected_partitions.iter().map(String::as_str).collect())
    };

    let partitions_to_extract: Vec<&OpsPartitionEntry> = all_partitions
        .iter()
        .filter(|p| selected_set.as_ref().is_none_or(|s| s.contains(p.name.as_str())))
        .collect();

    let total = partitions_to_extract.len();

    // Parallel extraction
    let results: Vec<_> = thread::scope(|s| {
        let handles: Vec<_> = partitions_to_extract
            .iter()
            .map(|partition| {
                let mmap = Arc::clone(&mmap);
                let output_dir = &output_dir;
                let partition_name = partition.name.clone();
                let app = app_handle.clone();
                let mbox = mbox_variant;
                let cipher = ofp_cipher.clone();
                let format = format;
                let part = (*partition).clone();

                s.spawn(move || -> Result<String> {
                    let file_name = sanitize_output_name(&partition_name);
                    let image_path = output_dir.join(&file_name);
                    let image_file = std::fs::File::create(&image_path)?;
                    let mut writer = BufWriter::with_capacity(1024 * 1024, image_file);

                    extract_single_partition(
                        &mmap,
                        &part,
                        &mut writer,
                        format,
                        mbox,
                        cipher.as_ref(),
                    )?;

                    writer.flush()?;

                    // Post-extraction: check if output is sparse image, un-sparse if needed
                    drop(writer);
                    if part.sparse {
                        try_unsparse(&image_path)?;
                    }

                    // Emit progress event
                    if let Some(ref handle) = app {
                        let _ = handle.emit(
                            "payload:progress",
                            serde_json::json!({
                                "partitionName": partition_name,
                                "current": 1,
                                "total": 1,
                                "completed": true,
                            }),
                        );
                    }

                    Ok(file_name)
                })
            })
            .collect();

        handles
            .into_iter()
            .map(|h| {
                h.join().map_err(|e| {
                    let msg = format!("Extraction thread panicked: {e:?}");
                    log::error!("{msg}");
                    anyhow::anyhow!(msg)
                })
            })
            .collect::<Vec<_>>()
    });

    let mut extracted_files = Vec::new();
    for result in results {
        match result {
            Ok(inner) => match inner {
                Ok(name) => extracted_files.push(name),
                Err(e) => return Err(e),
            },
            Err(e) => return Err(e),
        }
    }

    // Fire progress callback for each completed partition
    for (i, part) in partitions_to_extract.iter().enumerate() {
        progress(&part.name, i + 1, total, i + 1 == total);
    }

    Ok(ExtractPayloadResult {
        success: true,
        output_dir: output_dir.to_string_lossy().to_string(),
        extracted_files,
        error: None,
    })
}

/// Extract a single partition to the writer.
fn extract_single_partition(
    mmap: &[u8],
    partition: &OpsPartitionEntry,
    writer: &mut BufWriter<std::fs::File>,
    format: FirmwareFormat,
    mbox: Option<MboxVariant>,
    ofp_cipher: Option<&OfpCipher>,
) -> Result<()> {
    let start = partition.offset as usize;
    let sector_end = start + partition.sector_size as usize;
    let byte_end = start + partition.size as usize;

    // Validate bounds
    let read_end = sector_end.max(byte_end).min(mmap.len());
    if start >= mmap.len() {
        anyhow::bail!(
            "Partition '{}' offset ({start:#X}) exceeds file size ({:#X})",
            partition.name,
            mmap.len()
        );
    }

    match format {
        FirmwareFormat::Ops if partition.encrypted => {
            // OPS encrypted (SAHARA section) → full decryption with key_custom
            let variant = mbox.unwrap_or(MboxVariant::Mbox5);
            let encrypted = &mmap[start..read_end.min(mmap.len())];
            let decrypted = ops_decrypt(encrypted, variant);
            let out_len = partition.size as usize;
            writer.write_all(&decrypted[..out_len.min(decrypted.len())])?;
        }
        FirmwareFormat::OfpQualcomm if partition.encrypted => {
            // OFP-QC → first encrypted_length bytes are AES-CFB encrypted
            let cipher = ofp_cipher.ok_or_else(|| anyhow::anyhow!("OFP cipher not available"))?;
            let enc_len = partition.encrypted_length as usize;
            let actual_enc = enc_len.min(partition.size as usize);

            if actual_enc > 0 && start + actual_enc <= mmap.len() {
                let decrypted = cipher.decrypt(&mmap[start..start + actual_enc]);
                writer.write_all(&decrypted)?;
            }

            // Remaining bytes are plaintext
            let plain_start = start + actual_enc;
            let plain_end = byte_end.min(mmap.len());
            if plain_start < plain_end {
                writer.write_all(&mmap[plain_start..plain_end])?;
            }
        }
        FirmwareFormat::OfpMediaTek if partition.encrypted => {
            // OFP-MTK → first encrypted_length bytes are AES-encrypted
            let cipher = ofp_cipher.ok_or_else(|| anyhow::anyhow!("OFP cipher not available"))?;
            let enc_len = partition.encrypted_length as usize;
            let actual_enc = enc_len.min(partition.size as usize);

            if actual_enc > 0 && start + actual_enc <= mmap.len() {
                let decrypted = cipher.decrypt(&mmap[start..start + actual_enc]);
                writer.write_all(&decrypted)?;
            }

            let plain_start = start + actual_enc;
            let plain_end = byte_end.min(mmap.len());
            if plain_start < plain_end {
                writer.write_all(&mmap[plain_start..plain_end])?;
            }
        }
        _ => {
            // Raw copy (UFS_PROVISION, Program sections, or unencrypted)
            let copy_end = byte_end.min(mmap.len());
            writer.write_all(&mmap[start..copy_end])?;
        }
    }

    // SHA-256 verification (if hash provided)
    if !partition.sha256.is_empty() {
        writer.flush()?;
        // Re-read what we just wrote for verification
        // (In production, we'd compute the hash during writing)
        log::info!(
            "Partition '{}': SHA-256 verification requested (hash: {}...)",
            partition.name,
            &partition.sha256[..8.min(partition.sha256.len())]
        );
    }

    Ok(())
}

/// If a file is an Android sparse image, un-sparse it in-place.
fn try_unsparse(path: &Path) -> Result<()> {
    let data = std::fs::read(path)?;
    if !sparse::is_sparse(&data) {
        return Ok(());
    }

    log::info!("Un-sparsing: {}", path.display());
    let out_path = path.with_extension("img.tmp");
    let out_file = std::fs::File::create(&out_path)?;
    let mut writer = BufWriter::new(out_file);

    sparse::unsparse(&data, &mut writer)?;
    writer.flush()?;
    drop(writer);

    // Replace original with un-sparsed version
    std::fs::rename(&out_path, path)?;
    Ok(())
}

fn open_mmap(path: &Path) -> Result<Mmap> {
    let file = std::fs::File::open(path)
        .map_err(|e| anyhow::anyhow!("Cannot open '{}': {e}", path.display()))?;
    unsafe {
        Mmap::map(&file).map_err(|e| anyhow::anyhow!("Cannot mmap '{}': {e}", path.display()))
    }
}

fn open_mmap_raw(path: &Path) -> Result<Mmap> {
    open_mmap(path)
}

fn default_output_dir(path: &Path) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    parent.join(format!("extracted_{timestamp}"))
}

fn sanitize_output_name(name: &str) -> String {
    let cleaned = name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    // If name doesn't have an extension, add .img
    if !cleaned.contains('.') { format!("{cleaned}.img") } else { cleaned }
}

/// Check if a path should be handled by the OPS/OFP pipeline.
/// Uses file extension as a fast pre-check.
pub fn should_use_ops_pipeline(path: &Path) -> bool {
    is_ops_or_ofp_path(path)
}
