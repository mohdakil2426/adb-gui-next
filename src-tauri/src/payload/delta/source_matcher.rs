//! Base partition resolver and SHA-256 validator for delta OTA payloads.

use crate::payload::chromeos_update_engine;
use anyhow::{Context, Result, bail};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

const HASH_BUFFER_SIZE: usize = 65536; // 64 KiB

pub struct SourceMatcher;

impl SourceMatcher {
    /// Locate candidate base partition file in `source_dir` for `partition_name`
    /// and verify against `expected_hash` (and optionally `expected_size`).
    pub fn resolve_partition(
        source_dir: &Path,
        partition_name: &str,
        expected_hash: Option<&[u8]>,
        expected_size: Option<u64>,
    ) -> Result<PathBuf> {
        if !source_dir.is_dir() {
            bail!("Source directory {:?} does not exist or is not a directory", source_dir);
        }

        let mut candidate_paths = vec![
            source_dir.join(format!("{}.img", partition_name)),
            source_dir.join(partition_name),
            source_dir.join(format!("{}.raw", partition_name)),
            source_dir.join(format!("{}.bin", partition_name)),
            source_dir.join(format!("{}_a.img", partition_name)),
            source_dir.join(format!("{}_b.img", partition_name)),
            source_dir.join(format!("{}_a", partition_name)),
            source_dir.join(format!("{}_b", partition_name)),
        ];

        // Also check case-insensitive match by scanning directory if none of direct candidates exist
        if let Ok(entries) = std::fs::read_dir(source_dir) {
            let p_lower = partition_name.to_ascii_lowercase();
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                        let stem_lower = stem.to_ascii_lowercase();
                        if stem_lower == p_lower
                            || stem_lower == format!("{}_a", p_lower)
                            || stem_lower == format!("{}_b", p_lower)
                        {
                            if !candidate_paths.contains(&path) {
                                candidate_paths.push(path);
                            }
                        }
                    }
                }
            }
        }

        for path in &candidate_paths {
            if path.is_file() {
                // If expected size is given, quickly verify file metadata length
                if let Some(exp_size) = expected_size {
                    if let Ok(meta) = path.metadata() {
                        if meta.len() < exp_size {
                            continue;
                        }
                    }
                }

                if let Some(exp_hash) = expected_hash.filter(|h| !h.is_empty()) {
                    let hash = Self::compute_file_sha256(path, expected_size)?;
                    if hash.as_slice() == exp_hash {
                        return Ok(path.clone());
                    }
                } else {
                    // No hash provided, candidate file exists
                    return Ok(path.clone());
                }
            }
        }

        if let Some(exp_hash) = expected_hash.filter(|h| !h.is_empty()) {
            bail!(
                "Base partition for '{}' matching SHA-256 {} not found in {:?}",
                partition_name,
                hex::encode(exp_hash),
                source_dir
            );
        } else {
            bail!("Base partition file for '{}' not found in {:?}", partition_name, source_dir);
        }
    }

    /// Resolve and verify base partition from a `chromeos_update_engine::PartitionUpdate`.
    pub fn resolve_from_partition_update(
        source_dir: &Path,
        partition: &chromeos_update_engine::PartitionUpdate,
    ) -> Result<PathBuf> {
        let expected_hash = partition
            .old_partition_info
            .as_ref()
            .and_then(|info| info.hash.as_deref())
            .filter(|h| !h.is_empty());
        let expected_size = partition.old_partition_info.as_ref().and_then(|info| info.size);

        Self::resolve_partition(source_dir, &partition.partition_name, expected_hash, expected_size)
    }

    /// Stream SHA-256 hash calculation of a file up to `max_bytes` (or EOF).
    pub fn compute_file_sha256(path: &Path, max_bytes: Option<u64>) -> Result<Vec<u8>> {
        let mut file = File::open(path)
            .with_context(|| format!("Failed to open base partition file at {:?}", path))?;
        let mut hasher = Sha256::new();
        let mut buf = [0u8; HASH_BUFFER_SIZE];
        let mut remaining = max_bytes.unwrap_or(u64::MAX);

        while remaining > 0 {
            let to_read = (remaining as usize).min(buf.len());
            let n = file.read(&mut buf[..to_read])?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            remaining -= n as u64;
        }

        Ok(hasher.finalize().to_vec())
    }

    /// Verify file SHA-256 against expected hash.
    pub fn verify_file_sha256(
        path: &Path,
        expected_hash: &[u8],
        max_bytes: Option<u64>,
    ) -> Result<bool> {
        let digest = Self::compute_file_sha256(path, max_bytes)?;
        Ok(digest.as_slice() == expected_hash)
    }
}
