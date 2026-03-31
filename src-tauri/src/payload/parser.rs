//! CrAU payload header parsing and protobuf manifest decoding.

use super::extractor::PartitionDetail;
use super::zip::PayloadCache;
use crate::payload::chromeos_update_engine;
use anyhow::Result;
use memmap2::Mmap;
use prost::Message;
use std::{path::Path, sync::Arc};

/// Opens `payload_path` as a read-only memory-mapped file.
///
/// # Safety
/// The file is opened in read-only mode. We never modify, truncate, or delete
/// `payload.bin` while the mapping is held. No other code path in this process
/// writes to the file. These invariants make the `unsafe` block sound.
fn open_mmap(path: &Path) -> Result<Arc<Mmap>> {
    let file = std::fs::File::open(path)
        .map_err(|e| anyhow::anyhow!("cannot open payload '{}': {e}", path.display()))?;
    // SAFETY: See function-level safety comment above.
    let mmap = unsafe {
        Mmap::map(&file)
            .map_err(|e| anyhow::anyhow!("cannot mmap payload '{}': {e}", path.display()))?
    };
    Ok(Arc::new(mmap))
}

/// Parse the CrAU header and decode the protobuf manifest.
/// Returns `(manifest_bytes, data_offset)`.
pub(super) fn parse_header(payload_bytes: &[u8]) -> Result<(Vec<u8>, usize)> {
    if payload_bytes.len() < 24 {
        anyhow::bail!("payload is too small");
    }
    if &payload_bytes[..4] != b"CrAU" {
        anyhow::bail!("invalid payload magic");
    }

    let version = u64::from_be_bytes(
        payload_bytes[4..12]
            .try_into()
            .map_err(|_| anyhow::anyhow!("invalid payload: version slice too short"))?,
    );
    if version != 2 {
        anyhow::bail!("unsupported payload version: {version}");
    }

    let manifest_len = usize::try_from(u64::from_be_bytes(
        payload_bytes[12..20]
            .try_into()
            .map_err(|_| anyhow::anyhow!("invalid payload: manifest length slice too short"))?,
    ))
    .map_err(|_| anyhow::anyhow!("payload manifest is too large"))?;

    let metadata_sig_len =
        usize::try_from(u32::from_be_bytes(payload_bytes[20..24].try_into().map_err(|_| {
            anyhow::anyhow!("invalid payload: metadata sig length slice too short")
        })?))
        .map_err(|_| anyhow::anyhow!("payload metadata signature is too large"))?;

    let manifest_start: usize = 24;
    let manifest_end = manifest_start
        .checked_add(manifest_len)
        .ok_or_else(|| anyhow::anyhow!("payload manifest offset overflow"))?;
    let data_start = manifest_end
        .checked_add(metadata_sig_len)
        .ok_or_else(|| anyhow::anyhow!("payload data offset overflow"))?;

    if payload_bytes.len() < manifest_end {
        anyhow::bail!("payload manifest exceeds file size");
    }
    if payload_bytes.len() < data_start {
        anyhow::bail!("payload metadata exceeds file size");
    }

    Ok((payload_bytes[manifest_start..manifest_end].to_vec(), data_start))
}

/// List partition names from a payload file.
pub fn list_payload_partitions(payload_path: &Path, cache: &PayloadCache) -> Result<Vec<String>> {
    let path = cache.get_payload_path(payload_path)?;
    let mmap = open_mmap(&path)?;
    let (manifest_bytes, _) = parse_header(&mmap)?;
    let manifest = chromeos_update_engine::DeltaArchiveManifest::decode(&manifest_bytes[..])?;
    Ok(manifest.partitions.into_iter().map(|p| p.partition_name).collect())
}

/// List partition names with size details from a payload file.
pub fn list_payload_partitions_with_details(
    payload_path: &Path,
    cache: &PayloadCache,
) -> Result<Vec<PartitionDetail>> {
    let path = cache.get_payload_path(payload_path)?;
    let mmap = open_mmap(&path)?;
    let (manifest_bytes, _) = parse_header(&mmap)?;
    let manifest = chromeos_update_engine::DeltaArchiveManifest::decode(&manifest_bytes[..])?;
    Ok(manifest
        .partitions
        .into_iter()
        .map(|p| PartitionDetail {
            name: p.partition_name,
            size: p.new_partition_info.and_then(|info| info.size).unwrap_or_default(),
        })
        .collect())
}

/// A parsed payload ready for extraction.
///
/// `mmap` is an `Arc`-wrapped memory map of the raw `payload.bin` file.
/// Cloning is O(1) — all threads share the same OS page cache backing.
pub struct LoadedPayload {
    /// Memory-mapped view of `payload.bin`. Shared across extraction threads via `Arc::clone`.
    /// Derefs to `&[u8]`, so slice indexing works identically to the old `Vec<u8>` field.
    pub mmap: Arc<Mmap>,
    pub manifest: chromeos_update_engine::DeltaArchiveManifest,
    pub data_offset: usize,
}

/// Load a payload file — resolves ZIP paths, opens as mmap, parses the CrAU header.
pub(super) fn load_payload(payload_path: &Path, cache: &PayloadCache) -> Result<LoadedPayload> {
    let path = cache.get_payload_path(payload_path)?;
    let mmap = open_mmap(&path)?;
    let (manifest_bytes, data_offset) = parse_header(&mmap)?;
    let manifest = chromeos_update_engine::DeltaArchiveManifest::decode(&manifest_bytes[..])?;
    Ok(LoadedPayload { mmap, manifest, data_offset })
}
