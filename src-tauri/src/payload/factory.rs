//! Local Android factory image ZIP extraction.
//!
//! Google Pixel factory images are ZIP files containing bootloader/radio `.img`
//! files and a nested `image-*.zip` with OS partition images (boot, init_boot,
//! system, vendor, product, vbmeta, etc.). This module discovers and extracts
//! those images directly from the local ZIP archive without requiring payload.bin.

use anyhow::{Result, anyhow};
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

use crate::payload::cancel::CancellationToken;
use crate::payload::storage_check::validate_preflight_storage;
use crate::payload::transaction::TransactionGuard;
use crate::payload::types::{
    ExtractPayloadResult, ExtractionStats, PartitionDetail, PayloadDiagnostics,
};

#[derive(Debug, Clone)]
pub struct LocalFactoryEntry {
    pub partition_name: String,
    pub original_file_name: String,
    pub uncompressed_size: u64,
    pub source: FactorySource,
}

#[derive(Debug, Clone)]
pub enum FactorySource {
    Outer { index: usize },
    NestedStored { outer_data_start: u64, outer_size: u64, nested_entry_index: usize },
    NestedDeflated { outer_index: usize, nested_entry_index: usize },
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FactoryProgressPayload {
    partition_name: String,
    current: u64,
    total: u64,
    percentage: f64,
    speed: f64,
    completed: bool,
}

/// A zero-copy reader and seeker over a slice of an underlying `File`.
#[derive(Debug)]
pub struct FileSection {
    file: File,
    start_offset: u64,
    len: u64,
    pos: u64,
}

impl FileSection {
    pub fn new(mut file: File, start_offset: u64, len: u64) -> Result<Self> {
        file.seek(SeekFrom::Start(start_offset))?;
        Ok(Self { file, start_offset, len, pos: 0 })
    }
}

impl Read for FileSection {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if self.pos >= self.len {
            return Ok(0);
        }
        let max_read = (self.len - self.pos).min(buf.len() as u64) as usize;
        let n = self.file.read(&mut buf[..max_read])?;
        self.pos += n as u64;
        Ok(n)
    }
}

impl Seek for FileSection {
    fn seek(&mut self, pos: SeekFrom) -> std::io::Result<u64> {
        let new_pos = match pos {
            SeekFrom::Start(offset) => offset as i64,
            SeekFrom::End(offset) => self.len as i64 + offset,
            SeekFrom::Current(offset) => self.pos as i64 + offset,
        };

        if new_pos < 0 || new_pos > self.len as i64 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "invalid seek position in FileSection",
            ));
        }

        self.pos = new_pos as u64;
        self.file.seek(SeekFrom::Start(self.start_offset + self.pos))?;
        Ok(self.pos)
    }
}

fn basename(path: &str) -> Option<&str> {
    path.rsplit(['/', '\\']).find(|part| !part.is_empty())
}

fn is_image_entry(name: &str) -> bool {
    basename(name).is_some_and(|base| base.to_ascii_lowercase().ends_with(".img"))
}

fn is_image_zip_entry(name: &str) -> bool {
    basename(name).is_some_and(|base| {
        let lower = base.to_ascii_lowercase();
        lower.starts_with("image-") && lower.ends_with(".zip")
    })
}

fn partition_name_from_image_entry(name: &str) -> String {
    let base = basename(name).unwrap_or(name);
    if base.len() >= 4 && base[base.len() - 4..].eq_ignore_ascii_case(".img") {
        base[..base.len() - 4].to_string()
    } else {
        base.to_string()
    }
}

fn dedupe_partition_names(entries: &mut [LocalFactoryEntry]) {
    let mut counts = std::collections::HashMap::<String, usize>::new();
    for entry in entries.iter_mut() {
        let count = counts.entry(entry.partition_name.clone()).or_default();
        if *count > 0 {
            entry.partition_name = format!("{}-{}", entry.partition_name, *count + 1);
        }
        *count += 1;
    }
}

/// Check if a local file is a Google Pixel factory image ZIP archive.
pub fn is_factory_zip(path: &Path) -> bool {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !ext.eq_ignore_ascii_case("zip") {
        return false;
    }

    let Ok(file) = File::open(path) else {
        return false;
    };
    let Ok(mut archive) = ZipArchive::new(BufReader::new(file)) else {
        return false;
    };

    let mut has_payload_bin = false;
    let mut has_factory_indicators = false;

    for i in 0..archive.len() {
        if let Ok(entry) = archive.by_index(i) {
            let name = entry.name();
            if name == "payload.bin" || name.ends_with("/payload.bin") {
                has_payload_bin = true;
                break;
            }
            if is_image_entry(name) || is_image_zip_entry(name) {
                has_factory_indicators = true;
            }
        }
    }

    !has_payload_bin && has_factory_indicators
}

/// Discover all extractable partition image entries in a local factory ZIP.
pub fn discover_local_factory_entries(zip_path: &Path) -> Result<Vec<LocalFactoryEntry>> {
    let file = File::open(zip_path)
        .map_err(|e| anyhow!("cannot open ZIP '{}': {e}", zip_path.display()))?;
    let mut outer_archive = ZipArchive::new(BufReader::new(file))
        .map_err(|e| anyhow!("cannot read ZIP '{}': {e}", zip_path.display()))?;

    let mut entries = Vec::new();
    let mut nested_zip_specs = Vec::new();

    for i in 0..outer_archive.len() {
        let entry = outer_archive.by_index(i)?;
        let name = entry.name().to_string();
        let size = entry.size();

        if is_image_entry(&name) && size > 0 {
            let partition_name = partition_name_from_image_entry(&name);
            entries.push(LocalFactoryEntry {
                partition_name,
                original_file_name: name,
                uncompressed_size: size,
                source: FactorySource::Outer { index: i },
            });
        } else if is_image_zip_entry(&name) && size > 0 {
            let is_stored = entry.compression() == zip::CompressionMethod::Stored;
            let data_start = entry.data_start();
            nested_zip_specs.push((i, name, is_stored, data_start, size));
        }
    }

    // Inspect nested image-*.zip archives
    for (outer_idx, zip_name, is_stored, data_start, size) in nested_zip_specs {
        if is_stored && data_start.is_some() {
            let offset = data_start.unwrap_or(0);
            let section = FileSection::new(File::open(zip_path)?, offset, size)?;
            let mut nested_archive = match ZipArchive::new(BufReader::new(section)) {
                Ok(a) => a,
                Err(e) => {
                    log::warn!("Failed to open stored nested ZIP '{}': {}", zip_name, e);
                    continue;
                }
            };

            for j in 0..nested_archive.len() {
                let inner_entry = nested_archive.by_index(j)?;
                let inner_name = inner_entry.name().to_string();
                let inner_size = inner_entry.size();

                if is_image_entry(&inner_name) && inner_size > 0 {
                    let partition_name = partition_name_from_image_entry(&inner_name);
                    entries.push(LocalFactoryEntry {
                        partition_name,
                        original_file_name: inner_name,
                        uncompressed_size: inner_size,
                        source: FactorySource::NestedStored {
                            outer_data_start: offset,
                            outer_size: size,
                            nested_entry_index: j,
                        },
                    });
                }
            }
        } else {
            // Deflated fallback
            let mut nested_file = outer_archive.by_index(outer_idx)?;
            let mut bytes = Vec::new();
            nested_file.read_to_end(&mut bytes)?;
            let cursor = std::io::Cursor::new(bytes);
            let mut nested_archive = match ZipArchive::new(cursor) {
                Ok(a) => a,
                Err(e) => {
                    log::warn!("Failed to open deflated nested ZIP '{}': {}", zip_name, e);
                    continue;
                }
            };

            for j in 0..nested_archive.len() {
                let inner_entry = nested_archive.by_index(j)?;
                let inner_name = inner_entry.name().to_string();
                let inner_size = inner_entry.size();

                if is_image_entry(&inner_name) && inner_size > 0 {
                    let partition_name = partition_name_from_image_entry(&inner_name);
                    entries.push(LocalFactoryEntry {
                        partition_name,
                        original_file_name: inner_name,
                        uncompressed_size: inner_size,
                        source: FactorySource::NestedDeflated {
                            outer_index: outer_idx,
                            nested_entry_index: j,
                        },
                    });
                }
            }
        }
    }

    dedupe_partition_names(&mut entries);
    Ok(entries)
}

/// List all partitions available in a local factory image ZIP.
pub fn list_factory_zip_partitions(path: &Path) -> Result<Vec<PartitionDetail>> {
    let entries = discover_local_factory_entries(path)?;
    Ok(entries
        .into_iter()
        .map(|entry| PartitionDetail {
            name: entry.partition_name,
            size: entry.uncompressed_size,
            download_size: None,
        })
        .collect())
}

/// Extract selected partition images from a local factory image ZIP.
pub fn extract_factory_zip_partitions(
    zip_path: &Path,
    output_dir: Option<&Path>,
    selected_partitions: &[String],
    app_handle: Option<AppHandle>,
    cancel_token: Option<&CancellationToken>,
) -> Result<ExtractPayloadResult> {
    let entries = discover_local_factory_entries(zip_path)?;
    let selected_set: std::collections::HashSet<_> =
        selected_partitions.iter().map(String::as_str).collect();

    let entries_to_extract: Vec<_> = if selected_partitions.is_empty() {
        entries
    } else {
        entries.into_iter().filter(|e| selected_set.contains(e.partition_name.as_str())).collect()
    };

    if entries_to_extract.is_empty() {
        anyhow::bail!("no selected factory image entries were found to extract");
    }

    let total_bytes: u64 = entries_to_extract.iter().map(|e| e.uncompressed_size).sum();

    let output_dir_path = output_dir.filter(|p| !p.as_os_str().is_empty()).map_or_else(
        || {
            let ts = crate::payload::format_datetime();
            PathBuf::from(format!("factory_images_{ts}"))
        },
        PathBuf::from,
    );

    std::fs::create_dir_all(&output_dir_path)
        .map_err(|e| anyhow!("failed to create output dir '{}': {e}", output_dir_path.display()))?;

    // Validate available disk space
    validate_preflight_storage(&output_dir_path, total_bytes)?;

    let guard = TransactionGuard::new(output_dir_path.clone());
    let mut extracted_files = Vec::new();
    let start_time = Instant::now();
    let mut extracted_bytes = 0u64;

    for entry in &entries_to_extract {
        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
            guard.abort();
            return Ok(ExtractPayloadResult {
                success: false,
                output_dir: output_dir_path.display().to_string(),
                extracted_files,
                error: Some("extraction cancelled".to_string()),
                stats: None,
            });
        }

        let file_name =
            format!("{}.img", crate::helpers::safe_image_file_name(&entry.partition_name));
        let out_file_path = output_dir_path.join(&file_name);

        guard.add_file(out_file_path.clone());

        extract_single_factory_entry(
            zip_path,
            entry,
            &out_file_path,
            app_handle.as_ref(),
            cancel_token,
        )?;

        extracted_bytes += entry.uncompressed_size;
        extracted_files.push(file_name);
    }

    guard.commit();

    let duration = start_time.elapsed();
    let duration_ms = duration.as_millis() as u64;
    let duration_secs = duration.as_secs_f64();
    let throughput_mbps = if duration_secs > 0.0 {
        (extracted_bytes as f64 / (1024.0 * 1024.0)) / duration_secs
    } else {
        0.0
    };

    Ok(ExtractPayloadResult {
        success: true,
        output_dir: output_dir_path.display().to_string(),
        extracted_files: extracted_files.clone(),
        error: None,
        stats: Some(ExtractionStats {
            duration_ms,
            partitions_extracted: extracted_files.len(),
            throughput_mbps,
            total_bytes: extracted_bytes,
        }),
    })
}

fn extract_single_factory_entry(
    zip_path: &Path,
    entry: &LocalFactoryEntry,
    output_path: &Path,
    app_handle: Option<&AppHandle>,
    cancel_token: Option<&CancellationToken>,
) -> Result<()> {
    let mut out_file = std::fs::File::create(output_path)?;

    match &entry.source {
        FactorySource::Outer { index } => {
            let file = File::open(zip_path)?;
            let mut outer_archive = ZipArchive::new(BufReader::new(file))?;
            let mut zip_entry = outer_archive.by_index(*index)?;
            stream_entry_to_file(
                &mut zip_entry,
                &mut out_file,
                entry.uncompressed_size,
                &entry.partition_name,
                app_handle,
                cancel_token,
            )?;
        }
        FactorySource::NestedStored { outer_data_start, outer_size, nested_entry_index } => {
            let section = FileSection::new(File::open(zip_path)?, *outer_data_start, *outer_size)?;
            let mut nested_archive = ZipArchive::new(BufReader::new(section))?;
            let mut zip_entry = nested_archive.by_index(*nested_entry_index)?;
            stream_entry_to_file(
                &mut zip_entry,
                &mut out_file,
                entry.uncompressed_size,
                &entry.partition_name,
                app_handle,
                cancel_token,
            )?;
        }
        FactorySource::NestedDeflated { outer_index, nested_entry_index } => {
            let file = File::open(zip_path)?;
            let mut outer_archive = ZipArchive::new(BufReader::new(file))?;
            let mut nested_file = outer_archive.by_index(*outer_index)?;
            let mut bytes = Vec::new();
            nested_file.read_to_end(&mut bytes)?;
            let cursor = std::io::Cursor::new(bytes);
            let mut nested_archive = ZipArchive::new(cursor)?;
            let mut zip_entry = nested_archive.by_index(*nested_entry_index)?;
            stream_entry_to_file(
                &mut zip_entry,
                &mut out_file,
                entry.uncompressed_size,
                &entry.partition_name,
                app_handle,
                cancel_token,
            )?;
        }
    }

    out_file.flush()?;
    Ok(())
}

fn stream_entry_to_file<R: Read>(
    reader: &mut R,
    out_file: &mut std::fs::File,
    total: u64,
    partition_name: &str,
    app_handle: Option<&AppHandle>,
    cancel_token: Option<&CancellationToken>,
) -> Result<()> {
    let mut buf = vec![0u8; 256 * 1024];
    let mut written = 0u64;
    let start_time = Instant::now();
    let mut last_emit = Instant::now();

    loop {
        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
            anyhow::bail!("extraction cancelled");
        }
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        out_file.write_all(&buf[..n])?;
        written += n as u64;

        if last_emit.elapsed().as_millis() >= 100 && app_handle.is_some() {
            let elapsed = start_time.elapsed().as_secs_f64();
            let speed = if elapsed > 0.0 { written as f64 / elapsed } else { 0.0 };
            let percentage = if total > 0 { (written as f64 / total as f64) * 100.0 } else { 0.0 };
            if let Some(app) = app_handle {
                let _ = app.emit(
                    "payload:progress",
                    FactoryProgressPayload {
                        partition_name: partition_name.to_string(),
                        current: written,
                        total,
                        percentage,
                        speed,
                        completed: false,
                    },
                );
            }
            last_emit = Instant::now();
        }
    }

    if let Some(app) = app_handle {
        let elapsed = start_time.elapsed().as_secs_f64();
        let speed = if elapsed > 0.0 { written as f64 / elapsed } else { 0.0 };
        let _ = app.emit(
            "payload:progress",
            FactoryProgressPayload {
                partition_name: partition_name.to_string(),
                current: total,
                total,
                percentage: 100.0,
                speed,
                completed: true,
            },
        );
    }

    Ok(())
}

/// Diagnoses a local Google Pixel factory image ZIP archive.
pub fn diagnose_factory_zip(path: &Path) -> Result<PayloadDiagnostics> {
    let entries = discover_local_factory_entries(path)?;
    let partition_count = entries.len();

    let mut compression_types = Vec::new();
    compression_types.push("ZIP (Local Factory Image)".to_string());

    Ok(PayloadDiagnostics {
        format: "Google Pixel Factory Image (ZIP)".to_string(),
        partition_count,
        total_operations: partition_count,
        compression_types,
        has_sha256_hashes: false,
        is_sparse: false,
        warnings: Vec::new(),
        manifest_info: format!("{partition_count} factory partition images detected"),
    })
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_factory_zip_on_synthetic_archive() {
        use std::io::Cursor;
        use zip::write::SimpleFileOptions;

        let mut buf = Vec::new();
        {
            let mut writer = zip::ZipWriter::new(Cursor::new(&mut buf));
            writer.start_file("bootloader-test.img", SimpleFileOptions::default()).unwrap();
            writer.write_all(b"BOOTLOADER_DATA").unwrap();
            writer.finish().unwrap();
        }

        let temp_file = tempfile::NamedTempFile::new().unwrap();
        let path = temp_file.path().with_extension("zip");
        std::fs::write(&path, &buf).unwrap();

        assert!(is_factory_zip(&path));

        let partitions = list_factory_zip_partitions(&path).unwrap();
        assert_eq!(partitions.len(), 1);
        assert_eq!(partitions[0].name, "bootloader-test");
        assert_eq!(partitions[0].size, 15);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_is_factory_zip_with_nested_zip() {
        use std::io::Cursor;
        use zip::write::SimpleFileOptions;

        // 1. Create inner image-test.zip
        let mut inner_buf = Vec::new();
        {
            let mut inner_writer = zip::ZipWriter::new(Cursor::new(&mut inner_buf));
            inner_writer.start_file("boot.img", SimpleFileOptions::default()).unwrap();
            inner_writer.write_all(b"ANDROID!_BOOT").unwrap();
            inner_writer.start_file("vbmeta.img", SimpleFileOptions::default()).unwrap();
            inner_writer.write_all(b"AVB0_VBMETA").unwrap();
            inner_writer.finish().unwrap();
        }

        // 2. Create outer factory zip containing radio.img and image-test.zip
        let mut outer_buf = Vec::new();
        {
            let mut outer_writer = zip::ZipWriter::new(Cursor::new(&mut outer_buf));
            outer_writer.start_file("radio-test.img", SimpleFileOptions::default()).unwrap();
            outer_writer.write_all(b"RADIO_BASEBAND").unwrap();
            outer_writer
                .start_file(
                    "cheetah/image-cheetah.zip",
                    SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored),
                )
                .unwrap();
            outer_writer.write_all(&inner_buf).unwrap();
            outer_writer.finish().unwrap();
        }

        let temp_file = tempfile::NamedTempFile::new().unwrap();
        let path = temp_file.path().with_extension("zip");
        std::fs::write(&path, &outer_buf).unwrap();

        assert!(is_factory_zip(&path));

        let partitions = list_factory_zip_partitions(&path).unwrap();
        assert_eq!(partitions.len(), 3);
        let names: Vec<_> = partitions.iter().map(|p| p.name.as_str()).collect();
        assert!(names.contains(&"radio-test"));
        assert!(names.contains(&"boot"));
        assert!(names.contains(&"vbmeta"));

        // Test extraction of boot and vbmeta
        let out_dir = tempfile::tempdir().unwrap();
        let res = extract_factory_zip_partitions(
            &path,
            Some(out_dir.path()),
            &["boot".to_string(), "vbmeta".to_string()],
            None,
            None,
        )
        .unwrap();

        assert!(res.success);
        assert_eq!(res.extracted_files.len(), 2);
        assert!(out_dir.path().join("boot.img").exists());
        assert!(out_dir.path().join("vbmeta.img").exists());

        let boot_data = std::fs::read(out_dir.path().join("boot.img")).unwrap();
        assert_eq!(boot_data, b"ANDROID!_BOOT");

        let _ = std::fs::remove_file(&path);
    }
}
