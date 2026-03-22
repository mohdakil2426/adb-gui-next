//! CrAU payload header parsing and protobuf manifest decoding.

use super::extractor::PartitionDetail;
use super::zip::PayloadCache;
use crate::payload::chromeos_update_engine;
use anyhow::Result;
use prost::Message;
use std::path::Path;

/// Parse the CrAU header and decode the protobuf manifest.
/// Returns the manifest bytes, data offset, and manifest length.
fn parse_header(payload_bytes: &[u8]) -> Result<(Vec<u8>, usize)> {
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
    let bytes = cache.read_payload(payload_path)?;
    let (manifest_bytes, _) = parse_header(&bytes)?;
    let manifest = chromeos_update_engine::DeltaArchiveManifest::decode(&manifest_bytes[..])?;
    Ok(manifest.partitions.into_iter().map(|partition| partition.partition_name).collect())
}

/// List partition names with size details from a payload file.
pub fn list_payload_partitions_with_details(
    payload_path: &Path,
    cache: &PayloadCache,
) -> Result<Vec<PartitionDetail>> {
    let bytes = cache.read_payload(payload_path)?;
    let (manifest_bytes, _) = parse_header(&bytes)?;
    let manifest = chromeos_update_engine::DeltaArchiveManifest::decode(&manifest_bytes[..])?;
    Ok(manifest
        .partitions
        .into_iter()
        .map(|partition| PartitionDetail {
            name: partition.partition_name,
            size: partition.new_partition_info.and_then(|info| info.size).unwrap_or_default(),
        })
        .collect())
}

/// Internal helper to load payload bytes and parsed manifest.
pub(super) struct LoadedPayload {
    pub bytes: Vec<u8>,
    pub manifest: chromeos_update_engine::DeltaArchiveManifest,
    pub data_offset: usize,
}

/// Load a payload file with parsed header and manifest.
pub(super) fn load_payload(payload_path: &Path, cache: &PayloadCache) -> Result<LoadedPayload> {
    let bytes = cache.read_payload(payload_path)?;
    let (manifest_bytes, data_offset) = parse_header(&bytes)?;
    let manifest = chromeos_update_engine::DeltaArchiveManifest::decode(&manifest_bytes[..])?;
    Ok(LoadedPayload { bytes, manifest, data_offset })
}
