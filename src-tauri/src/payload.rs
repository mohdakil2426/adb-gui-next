use anyhow::Result;
use prost::Message;
use serde::Serialize;
use std::{
    fs,
    io::{Cursor, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use zip::ZipArchive;

pub mod chromeos_update_engine {
    include!(concat!(env!("OUT_DIR"), "/chromeos_update_engine.rs"));
}

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

#[derive(Debug, Default)]
pub struct PayloadCache {
    inner: Mutex<PayloadCacheInner>,
}

#[derive(Debug, Default)]
struct PayloadCacheInner {
    cached_zip_path: Option<PathBuf>,
    cached_payload_path: Option<PathBuf>,
}

impl PayloadCache {
    pub fn cleanup(&self) -> Result<()> {
        let mut inner = self.inner.lock().expect("payload cache lock poisoned");
        if let Some(path) = inner.cached_payload_path.take() {
            let _ = fs::remove_file(path);
        }
        inner.cached_zip_path = None;
        Ok(())
    }

    fn resolve_payload_path(&self, payload_path: &Path) -> Result<PathBuf> {
        if !is_zip_path(payload_path) {
            return Ok(payload_path.to_path_buf());
        }

        let mut inner = self.inner.lock().expect("payload cache lock poisoned");
        if inner.cached_zip_path.as_deref() == Some(payload_path) {
            if let Some(cached_payload_path) = inner.cached_payload_path.as_ref() {
                if cached_payload_path.exists() {
                    return Ok(cached_payload_path.clone());
                }
            }
        }

        if let Some(previous_payload_path) = inner.cached_payload_path.take() {
            let _ = fs::remove_file(previous_payload_path);
        }
        inner.cached_zip_path = None;

        let extracted_payload_path = extract_payload_bin_from_zip(payload_path)?;
        inner.cached_zip_path = Some(payload_path.to_path_buf());
        inner.cached_payload_path = Some(extracted_payload_path.clone());
        Ok(extracted_payload_path)
    }
}

pub fn list_payload_partitions(payload_path: &Path, cache: &PayloadCache) -> Result<Vec<String>> {
    let manifest = load_payload(payload_path, cache)?.manifest;
    Ok(manifest
        .partitions
        .into_iter()
        .map(|partition| partition.partition_name)
        .collect())
}

pub fn list_payload_partitions_with_details(
    payload_path: &Path,
    cache: &PayloadCache,
) -> Result<Vec<PartitionDetail>> {
    let manifest = load_payload(payload_path, cache)?.manifest;
    Ok(manifest
        .partitions
        .into_iter()
        .map(|partition| PartitionDetail {
            name: partition.partition_name,
            size: partition
                .new_partition_info
                .and_then(|info| info.size)
                .unwrap_or_default(),
        })
        .collect())
}

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
        if let Some(selected_names) = selected_names.as_ref() {
            if !selected_names.contains(partition.partition_name.as_str()) {
                continue;
            }
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

const PAYLOAD_MAGIC: &[u8; 4] = b"CrAU";
const PAYLOAD_VERSION_V2: u64 = 2;
const PAYLOAD_HEADER_SIZE: usize = 24;
const BLOCK_SIZE: u64 = 4096;

struct LoadedPayload {
    bytes: Vec<u8>,
    manifest: chromeos_update_engine::DeltaArchiveManifest,
    data_offset: usize,
}

fn load_payload(payload_path: &Path, cache: &PayloadCache) -> Result<LoadedPayload> {
    let actual_payload_path = cache.resolve_payload_path(payload_path)?;
    let bytes = fs::read(&actual_payload_path)?;
    if bytes.len() < 24 {
        anyhow::bail!("payload is too small");
    }
    if &bytes[..4] != PAYLOAD_MAGIC {
        anyhow::bail!("invalid payload magic");
    }

    let version = u64::from_be_bytes(bytes[4..12].try_into().expect("version slice"));
    if version != PAYLOAD_VERSION_V2 {
        anyhow::bail!("unsupported payload version: {version}");
    }

    let manifest_len = usize::try_from(
        u64::from_be_bytes(bytes[12..20].try_into().expect("manifest length slice")),
    )
    .map_err(|_| anyhow::anyhow!("payload manifest is too large"))?;
    let metadata_sig_len = usize::try_from(u32::from_be_bytes(
        bytes[20..24].try_into().expect("metadata sig length slice"),
    ))
    .map_err(|_| anyhow::anyhow!("payload metadata signature is too large"))?;

    let manifest_start = PAYLOAD_HEADER_SIZE;
    let manifest_end = manifest_start
        .checked_add(manifest_len)
        .ok_or_else(|| anyhow::anyhow!("payload manifest offset overflow"))?;
    let data_start = manifest_end
        .checked_add(metadata_sig_len)
        .ok_or_else(|| anyhow::anyhow!("payload data offset overflow"))?;
    if bytes.len() < manifest_end {
        anyhow::bail!("payload manifest exceeds file size");
    }
    if bytes.len() < data_start {
        anyhow::bail!("payload metadata exceeds file size");
    }

    Ok(LoadedPayload {
        manifest: chromeos_update_engine::DeltaArchiveManifest::decode(
            &bytes[manifest_start..manifest_end],
        )?,
        bytes,
        data_offset: data_start,
    })
}

fn extract_partition(
    payload: &LoadedPayload,
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
        let destination_extents = operation
            .dst_extents
            .as_slice();
        if destination_extents.is_empty() {
            anyhow::bail!("missing destination extent for {}", partition.partition_name);
        }
        let expected_size = destination_extents
            .iter()
            .try_fold(0usize, |total, extent| {
                let block_count = usize::try_from(extent.num_blocks.unwrap_or_default())
                    .map_err(|_| anyhow::anyhow!("destination extent block count overflow"))?;
                total.checked_add(
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
    payload: &LoadedPayload,
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

fn is_zip_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("zip"))
        .unwrap_or(false)
}

fn extract_payload_bin_from_zip(zip_path: &Path) -> Result<PathBuf> {
    let file = fs::File::open(zip_path)?;
    let mut archive = ZipArchive::new(file)?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.name() != "payload.bin" || entry.size() == 0 {
            continue;
        }

        let temp_dir = payload_temp_dir();
        fs::create_dir_all(&temp_dir)?;
        let temp_path = temp_dir.join(format!(
            "payload-{}.bin",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_millis()
        ));
        let mut temp_file = fs::File::create(&temp_path)?;
        std::io::copy(&mut entry, &mut temp_file)?;
        return Ok(temp_path);
    }

    anyhow::bail!("payload.bin not found in ZIP archive")
}

fn payload_temp_dir() -> PathBuf {
    std::env::temp_dir().join("adb-gui-next").join("payload")
}

fn default_output_dir(payload_path: &Path) -> PathBuf {
    let parent = payload_path.parent().unwrap_or_else(|| Path::new("."));
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    parent.join(format!("extracted_{timestamp}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chromeos_update_engine::{
        install_operation::Type, DeltaArchiveManifest, InstallOperation, PartitionInfo,
        PartitionUpdate,
    };
    use std::io::Write;
    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;

    #[test]
    fn lists_partitions_and_details_from_payload_bin() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");
        write_test_payload(&payload_path, "system", 4096, &[7; 4096]);

        let cache = PayloadCache::default();

        let partitions = list_payload_partitions(&payload_path, &cache).expect("partitions");
        let details =
            list_payload_partitions_with_details(&payload_path, &cache).expect("partition details");

        assert_eq!(partitions, vec!["system".to_string()]);
        assert_eq!(
            details,
            vec![PartitionDetail {
                name: "system".into(),
                size: 4096,
            }]
        );
    }

    #[test]
    fn extracts_selected_partition_image() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");
        let output_dir = temp.path().join("out");
        let image_bytes = vec![7; 4096];
        write_test_payload(&payload_path, "system", 4096, &image_bytes);

        let cache = PayloadCache::default();
        let mut progress_events = Vec::new();

        let result = extract_payload(
            &payload_path,
            Some(&output_dir),
            &[String::from("system")],
            &cache,
            |name, current, total, completed| {
                progress_events.push((name.to_string(), current, total, completed));
            },
        )
        .expect("extract payload");

        assert!(result.success);
        assert_eq!(result.output_dir, output_dir.to_string_lossy());
        assert_eq!(result.extracted_files, vec![String::from("system.img")]);
        assert!(output_dir.join("system.img").exists());
        assert_eq!(fs::read(output_dir.join("system.img")).expect("image bytes"), image_bytes);
        assert!(
            progress_events
                .iter()
                .any(|event| event == &("system".into(), 1, 1, true)),
            "expected a completion progress event"
        );
    }

    #[test]
    fn lists_partitions_from_zip_and_cleans_cached_payload() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");
        let zip_path = temp.path().join("ota.zip");
        write_test_payload(&payload_path, "vendor", 4096, &[3; 4096]);
        write_zip_with_payload(&zip_path, &payload_path);

        let cache = PayloadCache::default();

        let partitions = list_payload_partitions(&zip_path, &cache).expect("zip partitions");
        assert_eq!(partitions, vec!["vendor".to_string()]);

        let cached_payload_path = cache
            .inner
            .lock()
            .expect("payload cache lock")
            .cached_payload_path
            .clone()
            .expect("cached payload path");
        assert!(cached_payload_path.exists(), "expected cached extracted payload.bin");

        cache.cleanup().expect("cleanup cache");
        assert!(
            !cached_payload_path.exists(),
            "expected cached extracted payload.bin to be removed"
        );
    }

    #[test]
    fn extracts_multi_extent_and_zero_operations() {
        let temp = tempdir().expect("tempdir");
        let payload_path = temp.path().join("payload.bin");
        let output_dir = temp.path().join("out");

        write_custom_payload(
            &payload_path,
            DeltaArchiveManifest {
                partitions: vec![PartitionUpdate {
                    partition_name: "system".to_string(),
                    new_partition_info: Some(PartitionInfo {
                        size: Some(16384),
                        hash: Some(Vec::new()),
                    }),
                    operations: vec![
                        InstallOperation {
                            r#type: Type::Replace as i32,
                            data_offset: Some(0),
                            data_length: Some(8192),
                            dst_extents: vec![
                                chromeos_update_engine::Extent {
                                    start_block: Some(0),
                                    num_blocks: Some(1),
                                },
                                chromeos_update_engine::Extent {
                                    start_block: Some(2),
                                    num_blocks: Some(1),
                                },
                            ],
                            data_sha256_hash: Some(Vec::new()),
                            ..Default::default()
                        },
                        InstallOperation {
                            r#type: Type::Zero as i32,
                            data_offset: Some(8192),
                            data_length: Some(0),
                            dst_extents: vec![
                                chromeos_update_engine::Extent {
                                    start_block: Some(3),
                                    num_blocks: Some(1),
                                },
                            ],
                            data_sha256_hash: Some(Vec::new()),
                            ..Default::default()
                        },
                    ],
                    ..Default::default()
                }],
                ..Default::default()
            },
            &[5; 8192],
        );

        let cache = PayloadCache::default();
        let result = extract_payload(
            &payload_path,
            Some(&output_dir),
            &[String::from("system")],
            &cache,
            |_, _, _, _| {},
        )
        .expect("extract multi extent payload");

        assert!(result.success);
        let image = fs::read(output_dir.join("system.img")).expect("read system image");
        assert_eq!(&image[0..4096], &[5; 4096]);
        assert_eq!(&image[4096..8192], &[0; 4096]);
        assert_eq!(&image[8192..12288], &[5; 4096]);
        assert_eq!(&image[12288..16384], &[0; 4096]);
    }

    fn write_test_payload(path: &Path, partition_name: &str, size: u64, image_bytes: &[u8]) {
        write_custom_payload(
            path,
            DeltaArchiveManifest {
                partitions: vec![PartitionUpdate {
                    partition_name: partition_name.to_string(),
                    new_partition_info: Some(PartitionInfo {
                        size: Some(size),
                        hash: Some(Vec::new()),
                    }),
                    operations: vec![InstallOperation {
                        r#type: Type::Replace as i32,
                        data_offset: Some(0),
                        data_length: Some(image_bytes.len() as u64),
                        dst_extents: vec![chromeos_update_engine::Extent {
                            start_block: Some(0),
                            num_blocks: Some(1),
                        }],
                        data_sha256_hash: Some(Vec::new()),
                        ..Default::default()
                    }],
                    ..Default::default()
                }],
                ..Default::default()
            },
            image_bytes,
        );
    }

    fn write_custom_payload(path: &Path, manifest: DeltaArchiveManifest, data_bytes: &[u8]) {
        let mut manifest_bytes = Vec::new();
        manifest.encode(&mut manifest_bytes).expect("encode manifest");

        let mut file = fs::File::create(path).expect("create payload");
        file.write_all(b"CrAU").expect("write magic");
        file.write_all(&2u64.to_be_bytes()).expect("write version");
        file.write_all(&(manifest_bytes.len() as u64).to_be_bytes())
            .expect("write manifest len");
        file.write_all(&0u32.to_be_bytes())
            .expect("write metadata sig len");
        file.write_all(&manifest_bytes).expect("write manifest");
        file.write_all(data_bytes).expect("write data");
    }

    fn write_zip_with_payload(zip_path: &Path, payload_path: &Path) {
        let zip_file = fs::File::create(zip_path).expect("create zip");
        let mut zip = zip::ZipWriter::new(zip_file);
        zip.start_file("payload.bin", SimpleFileOptions::default())
            .expect("start payload entry");
        zip.write_all(&fs::read(payload_path).expect("read payload"))
            .expect("write payload entry");
        zip.finish().expect("finish zip");
    }
}
