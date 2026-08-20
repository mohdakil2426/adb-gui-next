//! HTTP ZIP reader for remote OTA extraction.
//!
//! Reads ZIP archives over HTTP using range requests to find and extract
//! `payload.bin` without downloading the entire ZIP file.
//!
//! Strategy:
//! 1. Fetch the last 64KB of the ZIP to read the End of Central Directory (EOCD)
//! 2. Parse EOCD to find Central Directory offset
//! 3. Fetch Central Directory entries to find `payload.bin`
//! 4. Return the offset and size of `payload.bin` within the ZIP

use super::http::HttpPayloadReader;
use super::session::{self, CachedZipIndex};
use anyhow::{Result, anyhow};

/// Check if a URL likely points to a ZIP file.
pub fn is_zip_url(url: &str) -> bool {
    url.to_lowercase().ends_with(".zip")
        || url.to_lowercase().contains(".zip?")
        || url.to_lowercase().contains(".zip#")
}

/// EOCD signature (4 bytes): 0x06054b50
const EOCD_SIG: u32 = 0x06054b50;
/// Central Directory File Header signature: 0x02014b50
const CD_SIG: u32 = 0x02014b50;
/// Local File Header signature: 0x04034b50
const LOCAL_SIG: u32 = 0x04034b50;
const ZIP64_EOCD_SIG: u32 = 0x06064b50;
const ZIP64_EOCD_LOCATOR_SIG: u32 = 0x07064b50;
const ZIP64_EXTRA_ID: u16 = 0x0001;
const ZIP32_MAX: u64 = u32::MAX as u64;

/// Maximum size of EOCD record (22 bytes + max comment 64KB)
const EOCD_MAX_SIZE: usize = 64 * 1024 + 22;
/// Information about the payload.bin entry within a ZIP file.
#[derive(Debug, Clone)]
pub struct ZipPayloadInfo {
    /// Byte offset where payload.bin data starts within the ZIP file.
    pub offset: u64,
    /// Compressed size of payload.bin within the ZIP.
    pub compressed_size: u64,
    /// Uncompressed size of payload.bin.
    pub uncompressed_size: u64,
    /// Compression method (0 = stored, 8 = deflate).
    pub compression_method: u16,
}

/// Find payload.bin entry in a remote ZIP file using HTTP range requests.
///
/// This function:
/// 1. Downloads the last 64KB of the ZIP to find the EOCD record
/// 2. Parses the EOCD to get Central Directory offset
/// 3. Downloads the Central Directory
/// 4. Finds the payload.bin entry and returns its offset/size info
///
/// Results are cached on the shared remote session (URL + length + etag) so
/// list → metadata → extract does not re-parse the ZIP CD.
pub async fn find_payload_in_zip(reader: &HttpPayloadReader) -> Result<ZipPayloadInfo> {
    if let Some(cached) = session::get_zip_payload_lookup(reader) {
        log::debug!("remote session cache hit for ZIP payload.bin lookup");
        return cached.map_err(|msg| anyhow!(msg));
    }

    let result = find_payload_in_zip_uncached(reader).await;
    match &result {
        Ok(info) => session::set_zip_payload_found(reader, info),
        // Only cache definitive absence (not network/parse blips) so factory fallback
        // and retries stay correct for the same session URL.
        Err(err) => {
            let msg = err.to_string();
            if msg.contains("payload.bin not found") {
                session::set_zip_payload_missing(reader, msg);
            }
        }
    }
    result
}

async fn find_payload_in_zip_uncached(reader: &HttpPayloadReader) -> Result<ZipPayloadInfo> {
    let (_cd_offset, cd_data) = load_central_directory(reader).await?;

    // Parse CD entries to find payload.bin
    let mut parse_pos = 0;
    let mut entries_found = 0;
    let mut payload_info: Option<ZipPayloadInfo> = None;

    while parse_pos + 46 <= cd_data.len() {
        let sig = u32::from_le_bytes(cd_data[parse_pos..parse_pos + 4].try_into()?);

        if sig != CD_SIG {
            // Not a CD entry — we've reached the end or hit corruption
            break;
        }

        // Parse CD entry
        let compression_method =
            u16::from_le_bytes(cd_data[parse_pos + 10..parse_pos + 12].try_into()?);
        let mut compressed_size =
            u32::from_le_bytes(cd_data[parse_pos + 20..parse_pos + 24].try_into()?) as u64;
        let mut uncompressed_size =
            u32::from_le_bytes(cd_data[parse_pos + 24..parse_pos + 28].try_into()?) as u64;
        let filename_len =
            u16::from_le_bytes(cd_data[parse_pos + 28..parse_pos + 30].try_into()?) as usize;
        let extra_len =
            u16::from_le_bytes(cd_data[parse_pos + 30..parse_pos + 32].try_into()?) as usize;
        let comment_len =
            u16::from_le_bytes(cd_data[parse_pos + 32..parse_pos + 34].try_into()?) as usize;
        let mut local_header_offset =
            u32::from_le_bytes(cd_data[parse_pos + 42..parse_pos + 46].try_into()?) as u64;

        let extra_start = parse_pos + 46 + filename_len;
        if extra_start + extra_len <= cd_data.len() {
            let _ = apply_zip64_extra(
                &cd_data[extra_start..extra_start + extra_len],
                &mut uncompressed_size,
                &mut compressed_size,
                &mut local_header_offset,
            );
        }
        let entry_start = parse_pos + 46;
        if entry_start + filename_len > cd_data.len() {
            break;
        }
        let filename = String::from_utf8_lossy(&cd_data[entry_start..entry_start + filename_len]);

        entries_found += 1;

        if filename == "payload.bin" {
            // Found it! Now read the local file header to get the actual data offset
            let local_header = reader.read_range(local_header_offset, 30).await?;

            // Verify local header signature
            let local_sig = u32::from_le_bytes(local_header[0..4].try_into()?);
            if local_sig != LOCAL_SIG {
                return Err(anyhow!("Invalid local file header at offset {}", local_header_offset));
            }

            let local_filename_len = u16::from_le_bytes(local_header[26..28].try_into()?) as usize;
            let local_extra_len = u16::from_le_bytes(local_header[28..30].try_into()?) as usize;

            let data_offset =
                local_header_offset + 30 + local_filename_len as u64 + local_extra_len as u64;

            payload_info = Some(ZipPayloadInfo {
                offset: data_offset,
                compressed_size,
                uncompressed_size,
                compression_method,
            });
            break;
        }

        // Move to next entry
        let entry_total_size = 46 + filename_len + extra_len + comment_len;
        parse_pos += entry_total_size;
    }

    payload_info.ok_or_else(|| {
        anyhow!("payload.bin not found in ZIP archive (checked {} entries)", entries_found)
    })
}

/// Fetch (or reuse cached) ZIP central directory for this remote reader.
async fn load_central_directory(reader: &HttpPayloadReader) -> Result<(u64, Vec<u8>)> {
    if let Some(index) = session::get_zip_index(reader) {
        log::debug!("remote session cache hit for ZIP central directory");
        return Ok((index.cd_offset, index.cd_data));
    }

    let content_length = reader.content_length();

    // Step 1: Fetch the tail of the file to find EOCD
    let tail_size = std::cmp::min(EOCD_MAX_SIZE as u64, content_length);
    let tail_offset = content_length - tail_size;
    let tail_data = reader.read_range(tail_offset, tail_size).await?;

    // Step 2: Find EOCD signature (search backwards)
    let eocd_pos = find_eocd(&tail_data).ok_or_else(|| anyhow!("EOCD record not found in ZIP"))?;
    let eocd_abs_pos = tail_offset + eocd_pos as u64;

    // Step 3: Parse EOCD to get Central Directory offset
    let eocd_data = &tail_data[eocd_pos..];
    if eocd_data.len() < 22 {
        return Err(anyhow!("EOCD record too small"));
    }

    // EOCD structure:
    // 0-3: signature (0x06054b50)
    // 4-5: disk number
    // 6-7: disk with CD
    // 8-9: entries on this disk
    // 10-11: total entries
    // 12-15: CD size
    // 16-19: CD offset
    let mut cd_offset = u32::from_le_bytes(eocd_data[16..20].try_into()?) as u64;
    let mut cd_size = u32::from_le_bytes(eocd_data[12..16].try_into()?) as u64;

    // Check for ZIP64 EOCD Locator (20 bytes before standard EOCD)
    if (cd_size == ZIP32_MAX || cd_offset == ZIP32_MAX || eocd_pos >= 20)
        && let Ok(zip64_offset) = zip64_eocd_offset_from_tail(&tail_data, eocd_pos)
        && let Ok(z64_eocd) = reader.read_range(zip64_offset, 56).await
        && z64_eocd.len() >= 56
        && u32::from_le_bytes(z64_eocd[0..4].try_into().unwrap_or_default()) == ZIP64_EOCD_SIG
    {
        cd_size = u64::from_le_bytes(z64_eocd[40..48].try_into().unwrap_or_default());
        cd_offset = u64::from_le_bytes(z64_eocd[48..56].try_into().unwrap_or_default());
    }

    if cd_size == 0 || cd_offset >= content_length {
        cd_size = eocd_abs_pos.saturating_sub(cd_offset);
    }
    if cd_size == 0 {
        return Err(anyhow!("Central Directory is empty"));
    }

    let cd_data = reader.read_range(cd_offset, cd_size).await?;
    session::set_zip_index(reader, CachedZipIndex { cd_offset, cd_data: cd_data.clone() });
    Ok((cd_offset, cd_data))
}

fn zip64_eocd_offset_from_tail(tail_data: &[u8], eocd_pos: usize) -> Result<u64> {
    if eocd_pos < 20 {
        anyhow::bail!("ZIP64 EOCD locator is missing");
    }
    let locator_pos = eocd_pos - 20;
    let sig = u32::from_le_bytes(tail_data[locator_pos..locator_pos + 4].try_into()?);
    if sig != ZIP64_EOCD_LOCATOR_SIG {
        anyhow::bail!("ZIP64 EOCD locator signature mismatch");
    }
    Ok(u64::from_le_bytes(tail_data[locator_pos + 8..locator_pos + 16].try_into()?))
}

fn apply_zip64_extra(
    extra: &[u8],
    uncompressed_size: &mut u64,
    compressed_size: &mut u64,
    local_header_offset: &mut u64,
) -> Result<()> {
    let mut pos = 0;
    while pos + 4 <= extra.len() {
        let header_id = u16::from_le_bytes(extra[pos..pos + 2].try_into()?);
        let data_size = u16::from_le_bytes(extra[pos + 2..pos + 4].try_into()?) as usize;
        pos += 4;

        if pos + data_size > extra.len() {
            anyhow::bail!("ZIP64 extra field is truncated");
        }

        if header_id == ZIP64_EXTRA_ID {
            let data = &extra[pos..pos + data_size];
            let mut offset = 0;
            if *uncompressed_size == ZIP32_MAX && offset + 8 <= data.len() {
                *uncompressed_size = read_zip64_value(data, &mut offset)?;
            }
            if *compressed_size == ZIP32_MAX && offset + 8 <= data.len() {
                *compressed_size = read_zip64_value(data, &mut offset)?;
            }
            if *local_header_offset == ZIP32_MAX && offset + 8 <= data.len() {
                *local_header_offset = read_zip64_value(data, &mut offset)?;
            }
            return Ok(());
        }

        pos += data_size;
    }
    Ok(())
}

fn read_zip64_value(data: &[u8], offset: &mut usize) -> Result<u64> {
    if *offset + 8 > data.len() {
        anyhow::bail!("ZIP64 extra field value is truncated");
    }
    let value = u64::from_le_bytes(data[*offset..*offset + 8].try_into()?);
    *offset += 8;
    Ok(value)
}
/// Read a named text file from a remote ZIP (e.g. `META-INF/com/android/metadata`).
///
/// Scans the Central Directory for the given filename and returns its contents as a string.
/// Returns `Ok(None)` if the file is not found in the archive (not an error — many OTAs
/// may lack certain metadata files).
///
/// Only works for small files (< 1 MB) stored uncompressed or deflated.
pub async fn read_text_file_from_zip(
    reader: &HttpPayloadReader,
    target_name: &str,
) -> Result<Option<String>> {
    // Reuse session-cached CD when available (list/meta/extract path).
    let Ok((_cd_offset, cd_data)) = load_central_directory(reader).await else {
        return Ok(None);
    };

    let mut parse_pos = 0;
    while parse_pos + 46 <= cd_data.len() {
        let sig = u32::from_le_bytes(cd_data[parse_pos..parse_pos + 4].try_into()?);
        if sig != CD_SIG {
            break;
        }

        let compression_method =
            u16::from_le_bytes(cd_data[parse_pos + 10..parse_pos + 12].try_into()?);
        let compressed_size =
            u32::from_le_bytes(cd_data[parse_pos + 20..parse_pos + 24].try_into()?) as u64;
        let uncompressed_size =
            u32::from_le_bytes(cd_data[parse_pos + 24..parse_pos + 28].try_into()?) as u64;
        let filename_len =
            u16::from_le_bytes(cd_data[parse_pos + 28..parse_pos + 30].try_into()?) as usize;
        let extra_len =
            u16::from_le_bytes(cd_data[parse_pos + 30..parse_pos + 32].try_into()?) as usize;
        let comment_len =
            u16::from_le_bytes(cd_data[parse_pos + 32..parse_pos + 34].try_into()?) as usize;
        let local_header_offset =
            u32::from_le_bytes(cd_data[parse_pos + 42..parse_pos + 46].try_into()?) as u64;

        let entry_start = parse_pos + 46;
        if entry_start + filename_len > cd_data.len() {
            break;
        }
        let filename = String::from_utf8_lossy(&cd_data[entry_start..entry_start + filename_len]);

        if filename == target_name {
            // Safety: skip files > 1 MB to avoid memory issues
            if uncompressed_size > 1024 * 1024 {
                return Ok(None);
            }

            // Read local file header to get data offset
            let local_header = reader.read_range(local_header_offset, 30).await?;
            let local_sig = u32::from_le_bytes(local_header[0..4].try_into()?);
            if local_sig != LOCAL_SIG {
                return Ok(None);
            }

            let local_filename_len = u16::from_le_bytes(local_header[26..28].try_into()?) as usize;
            let local_extra_len = u16::from_le_bytes(local_header[28..30].try_into()?) as usize;
            let data_offset =
                local_header_offset + 30 + local_filename_len as u64 + local_extra_len as u64;

            // Read the file data
            let raw_data = reader.read_range(data_offset, compressed_size).await?;

            let text = if compression_method == 0 {
                // Stored — raw UTF-8
                String::from_utf8_lossy(&raw_data).to_string()
            } else if compression_method == 8 {
                // Deflate
                let mut decoder = flate2::read::DeflateDecoder::new(&raw_data[..]);
                let mut decompressed = Vec::with_capacity(uncompressed_size as usize);
                std::io::Read::read_to_end(&mut decoder, &mut decompressed)?;
                String::from_utf8_lossy(&decompressed).to_string()
            } else {
                return Ok(None); // Unknown compression
            };

            return Ok(Some(text));
        }

        parse_pos += 46 + filename_len + extra_len + comment_len;
    }

    Ok(None) // File not found
}

/// Find EOCD signature in data buffer (search backwards from end)
pub fn find_eocd(data: &[u8]) -> Option<usize> {
    if data.len() < 4 {
        return None;
    }

    // Search backwards from end (EOCD is at the end of ZIP)
    let start = data.len().saturating_sub(EOCD_MAX_SIZE);
    for i in (start..=data.len() - 4).rev() {
        let sig = u32::from_le_bytes([data[i], data[i + 1], data[i + 2], data[i + 3]]);
        if sig == EOCD_SIG {
            return Some(i);
        }
    }
    None
}

/// Read payload.bin data from a ZIP file over HTTP.
///
/// If the payload.bin is stored (compression_method = 0), we can read it directly.
/// If it's deflated (compression_method = 8), we need to download and decompress.
pub async fn read_payload_from_zip(
    reader: &HttpPayloadReader,
    zip_info: &ZipPayloadInfo,
    offset: u64,
    length: u64,
) -> Result<Vec<u8>> {
    if zip_info.compression_method != 0 {
        // Compressed - need to download entire compressed blob and decompress
        let compressed_data = reader.read_range(zip_info.offset, zip_info.compressed_size).await?;

        // Decompress using flate2
        let mut decoder = flate2::read::DeflateDecoder::new(&compressed_data[..]);
        let mut decompressed = Vec::with_capacity(zip_info.uncompressed_size as usize);
        std::io::Read::read_to_end(&mut decoder, &mut decompressed)?;

        if decompressed.len() != zip_info.uncompressed_size as usize {
            return Err(anyhow!(
                "Decompressed size mismatch: expected {}, got {}",
                zip_info.uncompressed_size,
                decompressed.len()
            ));
        }

        // Return the requested slice from decompressed data
        let end = std::cmp::min(offset + length, decompressed.len() as u64);
        if offset >= decompressed.len() as u64 {
            return Err(anyhow!("Read offset exceeds payload size"));
        }

        Ok(decompressed[offset as usize..end as usize].to_vec())
    } else {
        // Stored (no compression) - read directly
        reader.read_range(zip_info.offset + offset, length).await
    }
}

/// Read data from either a ZIP entry or direct payload, depending on zip_info.
pub async fn read_from_zip_or_direct(
    reader: &HttpPayloadReader,
    zip_info: &Option<ZipPayloadInfo>,
    offset: u64,
    length: u64,
) -> Result<Vec<u8>> {
    match zip_info {
        Some(zi) => {
            // Reading from within a ZIP file
            read_payload_from_zip(reader, zi, offset, length).await
        }
        None => {
            // Direct payload.bin read
            reader.read_range(offset, length).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_eocd() {
        // EOCD signature: 0x06054b50 = [0x50, 0x4b, 0x05, 0x06] in little-endian
        let mut data = vec![0u8; 100];
        data[90] = 0x50;
        data[91] = 0x4b;
        data[92] = 0x05;
        data[93] = 0x06;

        let pos = find_eocd(&data);
        assert_eq!(pos, Some(90));
    }

    #[test]
    fn test_find_eocd_not_found() {
        let data = vec![0u8; 100];
        let pos = find_eocd(&data);
        assert_eq!(pos, None);
    }
}
