//! Shared remote HTTP session: avoid triple HEAD + ZIP CD parse on list→meta→extract.
//!
//! Cache key: URL + content-length + optional ETag from the HEAD response.

use super::http::HttpPayloadReader;
use super::http_zip::ZipPayloadInfo;
use anyhow::Result;
use std::sync::{LazyLock, Mutex};

/// Cached ZIP central-directory blob for reusing text-file lookups without re-fetching EOCD/CD.
#[derive(Clone)]
pub(crate) struct CachedZipIndex {
    pub cd_offset: u64,
    pub cd_data: Vec<u8>,
}

#[derive(Clone)]
enum ZipPayloadLookup {
    Found(ZipPayloadInfo),
    /// payload.bin missing (factory candidate); message preserved for diagnostics.
    Missing(String),
}

struct SessionEntry {
    url: String,
    content_length: u64,
    etag: Option<String>,
    reader: HttpPayloadReader,
    zip_payload: Option<ZipPayloadLookup>,
    zip_index: Option<CachedZipIndex>,
}

static SESSION: LazyLock<Mutex<Option<SessionEntry>>> = LazyLock::new(|| Mutex::new(None));

fn cache_key_matches(
    entry: &SessionEntry,
    url: &str,
    content_length: u64,
    etag: Option<&str>,
) -> bool {
    (entry.url == url || entry.reader.url() == url)
        && entry.content_length == content_length
        && entry.etag.as_deref() == etag
}

/// Open an HTTP reader, reusing a cached session when URL + length + etag match.
///
/// Performs SSRF validation and HEAD on cache miss (via [`HttpPayloadReader::new`]).
pub async fn open_http_reader(url: impl AsRef<str>) -> Result<HttpPayloadReader> {
    let url = url.as_ref();

    if let Ok(guard) = SESSION.lock()
        && let Some(entry) = guard.as_ref()
        && entry.url == url
    {
        log::debug!(
            "remote session cache hit for HEAD/reader (url, len={}, etag={:?})",
            entry.content_length,
            entry.etag
        );
        return Ok(entry.reader.clone());
    }

    let reader = HttpPayloadReader::new(url).await?;
    store_reader(url, &reader);
    Ok(reader)
}

fn store_reader(url: &str, reader: &HttpPayloadReader) {
    let Ok(mut guard) = SESSION.lock() else {
        return;
    };
    // Drop previous session if URL/identity changed.
    if let Some(prev) = guard.as_ref()
        && !cache_key_matches(prev, url, reader.content_length(), reader.etag())
    {
        *guard = None;
    }
    *guard = Some(SessionEntry {
        url: url.to_string(),
        content_length: reader.content_length(),
        etag: reader.etag().map(String::from),
        reader: reader.clone(),
        zip_payload: None,
        zip_index: None,
    });
}

/// Return cached payload.bin ZIP lookup for this reader, if present.
pub(crate) fn get_zip_payload_lookup(
    reader: &HttpPayloadReader,
) -> Option<Result<ZipPayloadInfo, String>> {
    let guard = SESSION.lock().ok()?;
    let entry = guard.as_ref()?;
    if !cache_key_matches(entry, reader.url(), reader.content_length(), reader.etag()) {
        return None;
    }
    match entry.zip_payload.as_ref()? {
        ZipPayloadLookup::Found(info) => Some(Ok(info.clone())),
        ZipPayloadLookup::Missing(msg) => Some(Err(msg.clone())),
    }
}

pub(crate) fn set_zip_payload_found(reader: &HttpPayloadReader, info: &ZipPayloadInfo) {
    let Ok(mut guard) = SESSION.lock() else {
        return;
    };
    let Some(entry) = guard.as_mut() else {
        return;
    };
    if !cache_key_matches(entry, reader.url(), reader.content_length(), reader.etag()) {
        return;
    }
    entry.zip_payload = Some(ZipPayloadLookup::Found(info.clone()));
}

pub(crate) fn set_zip_payload_missing(reader: &HttpPayloadReader, message: String) {
    let Ok(mut guard) = SESSION.lock() else {
        return;
    };
    let Some(entry) = guard.as_mut() else {
        return;
    };
    if !cache_key_matches(entry, reader.url(), reader.content_length(), reader.etag()) {
        return;
    }
    entry.zip_payload = Some(ZipPayloadLookup::Missing(message));
}

pub(crate) fn get_zip_index(reader: &HttpPayloadReader) -> Option<CachedZipIndex> {
    let guard = SESSION.lock().ok()?;
    let entry = guard.as_ref()?;
    if !cache_key_matches(entry, reader.url(), reader.content_length(), reader.etag()) {
        return None;
    }
    entry.zip_index.clone()
}

pub(crate) fn set_zip_index(reader: &HttpPayloadReader, index: CachedZipIndex) {
    let Ok(mut guard) = SESSION.lock() else {
        return;
    };
    let Some(entry) = guard.as_mut() else {
        return;
    };
    if !cache_key_matches(entry, reader.url(), reader.content_length(), reader.etag()) {
        return;
    }
    entry.zip_index = Some(index);
}

/// Clear the session cache (tests / identity change).
#[cfg(test)]
pub fn clear_session_cache() {
    if let Ok(mut guard) = SESSION.lock() {
        *guard = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_key_matches_url_length_etag() {
        // Build a minimal entry-like comparison without a live HTTP client.
        let entry = SessionEntry {
            url: "https://example.com/ota.zip".into(),
            content_length: 1000,
            etag: Some("\"abc\"".into()),
            reader: HttpPayloadReader::from_parts_for_test(
                "https://example.com/ota.zip".into(),
                1000,
                Some("\"abc\"".into()),
            ),
            zip_payload: None,
            zip_index: None,
        };
        assert!(cache_key_matches(&entry, "https://example.com/ota.zip", 1000, Some("\"abc\"")));
        assert!(!cache_key_matches(&entry, "https://example.com/ota.zip", 999, Some("\"abc\"")));
        assert!(!cache_key_matches(&entry, "https://example.com/other.zip", 1000, Some("\"abc\"")));
        assert!(!cache_key_matches(&entry, "https://example.com/ota.zip", 1000, Some("\"xyz\"")));
    }

    #[test]
    fn zip_lookup_roundtrip_in_session() {
        clear_session_cache();
        let reader =
            HttpPayloadReader::from_parts_for_test("https://cdn.example/p.zip".into(), 42, None);
        store_reader(reader.url(), &reader);

        let info = ZipPayloadInfo {
            offset: 100,
            compressed_size: 50,
            uncompressed_size: 50,
            compression_method: 0,
        };
        set_zip_payload_found(&reader, &info);
        let got = get_zip_payload_lookup(&reader).expect("cached").expect("found");
        assert_eq!(got.offset, 100);
        assert_eq!(got.compressed_size, 50);

        clear_session_cache();
        assert!(get_zip_payload_lookup(&reader).is_none());
    }
}
