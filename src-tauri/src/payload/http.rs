//! HTTP range request support for remote OTA extraction.
//! Downloads only required data ranges instead of full files.

use anyhow::{Result, anyhow};
use reqwest::Client;
use std::net::{IpAddr, ToSocketAddrs};
use std::time::Duration;

const MAX_RETRIES: u32 = 3;
const RETRY_BASE_DELAY_MS: u64 = 1000;

pub(crate) fn is_blocked_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => {
            let octets = ipv4.octets();
            octets[0] == 127
                || octets[0] == 10
                || octets[0] == 172 && (octets[1] & 0xf0 == 0x10)
                || octets[0] == 192 && octets[1] == 168
                || octets[0] == 169 && octets[1] == 254
                || octets[0] == 100 && (octets[1] & 0xc0 == 0x40)
                || octets[0] == 0 && octets[1] == 0 && octets[2] == 0 && octets[3] == 0
        }
        IpAddr::V6(ipv6) => {
            let segs = ipv6.segments();
            (segs[0] == 0
                && segs[1] == 0
                && segs[2] == 0
                && segs[3] == 0
                && segs[4] == 0
                && segs[5] == 0
                && segs[6] == 0
                && segs[7] == 1)
                || segs.iter().all(|&s| s == 0)
                || segs[0] & 0xffc0 == 0xfe80
                || segs[0] & 0xfe00 == 0xfc00
        }
    }
}

/// Check if a URL points to a private/internal IP address.
/// Returns true if the URL should be blocked to prevent SSRF attacks.
pub(crate) fn is_private_url(url: &url::Url) -> bool {
    let host = match url.host() {
        Some(host) => host,
        None => return true,
    };

    match host {
        url::Host::Domain(domain) => {
            matches!(domain, "localhost" | "localhost.localdomain" | "local" | "broadcasthost")
        }
        url::Host::Ipv4(ipv4) => is_blocked_ip(IpAddr::V4(ipv4)),
        url::Host::Ipv6(ipv6) => is_blocked_ip(IpAddr::V6(ipv6)),
    }
}

pub(crate) fn validate_outbound_url(url: &url::Url, require_https: bool) -> Result<()> {
    let scheme = url.scheme();
    if require_https {
        if scheme != "https" {
            return Err(anyhow!("Only HTTPS URLs are supported"));
        }
    } else if scheme != "https" && scheme != "http" {
        return Err(anyhow!("Only HTTP/HTTPS URLs are supported"));
    }

    if is_private_url(url) {
        return Err(anyhow!("URL points to a private or internal address — not permitted"));
    }

    let host = url.host_str().ok_or_else(|| anyhow!("URL is missing a host"))?;
    let port = url.port_or_known_default().ok_or_else(|| anyhow!("URL is missing a port"))?;
    let addresses =
        (host, port).to_socket_addrs().map_err(|e| anyhow!("Failed to resolve host: {}", e))?;

    let mut resolved_any = false;
    for address in addresses {
        resolved_any = true;
        if is_blocked_ip(address.ip()) {
            return Err(anyhow!("URL resolves to a private or internal address — not permitted"));
        }
    }

    if !resolved_any {
        return Err(anyhow!("Could not resolve URL host"));
    }

    Ok(())
}

pub(crate) fn resolve_redirect_url(base: &url::Url, location: &str) -> Result<url::Url> {
    base.join(location).map_err(|e| anyhow!("Invalid redirect URL: {}", e))
}

/// HTTP reader with range request support.
pub struct HttpPayloadReader {
    client: Client,
    url: String,
    content_length: u64,
    supports_ranges: bool,
    /// HTTP headers captured from the HEAD response.
    content_type: Option<String>,
    last_modified: Option<String>,
    server: Option<String>,
    etag: Option<String>,
    /// Pre-built blocking client for synchronous extraction threads.
    /// Lazily initialized via `get_blocking_client()`.
    blocking_client: std::sync::Mutex<Option<reqwest::blocking::Client>>,
}

impl Clone for HttpPayloadReader {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            url: self.url.clone(),
            content_length: self.content_length,
            supports_ranges: self.supports_ranges,
            content_type: self.content_type.clone(),
            last_modified: self.last_modified.clone(),
            server: self.server.clone(),
            etag: self.etag.clone(),
            blocking_client: std::sync::Mutex::new(None),
        }
    }
}

impl HttpPayloadReader {
    /// Create a new HTTP reader for the given URL.
    /// Performs a HEAD request to check range support and get content length.
    pub async fn new(url: impl ToString) -> Result<Self> {
        let url_str = url.to_string();
        let url = url::Url::parse(&url_str).map_err(|e| anyhow!("Invalid URL: {}", e))?;

        validate_outbound_url(&url, false)?;

        let client = Client::builder()
            .timeout(Duration::from_secs(600))
            .connect_timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| anyhow!("Failed to create HTTP client: {}", e))?;

        // HEAD request to check range support and get content length
        let response = client
            .head(&url_str)
            .send()
            .await
            .map_err(|e| anyhow!("HEAD request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow!("Server returned status {}", response.status()));
        }

        let supports_ranges = response
            .headers()
            .get("accept-ranges")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == "bytes")
            .unwrap_or(false);

        if !supports_ranges {
            return Err(anyhow!("Server does not support HTTP range requests"));
        }

        let content_length = response
            .headers()
            .get("content-length")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .ok_or_else(|| anyhow!("Could not determine content length"))?;

        // Capture optional HTTP headers for metadata display
        let content_type =
            response.headers().get("content-type").and_then(|v| v.to_str().ok()).map(String::from);
        let last_modified =
            response.headers().get("last-modified").and_then(|v| v.to_str().ok()).map(String::from);
        let server =
            response.headers().get("server").and_then(|v| v.to_str().ok()).map(String::from);
        let etag = response.headers().get("etag").and_then(|v| v.to_str().ok()).map(String::from);

        Ok(Self {
            client,
            url: url_str,
            content_length,
            supports_ranges: true,
            content_type,
            last_modified,
            server,
            etag,
            blocking_client: std::sync::Mutex::new(None),
        })
    }

    /// Get or create a blocking HTTP client for synchronous range reads.
    fn get_blocking_client(&self) -> Result<reqwest::blocking::Client> {
        let mut guard =
            self.blocking_client.lock().map_err(|e| anyhow!("mutex poisoned: {}", e))?;
        if let Some(ref client) = *guard {
            return Ok(client.clone());
        }
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(600))
            .connect_timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| anyhow!("Failed to create blocking HTTP client: {}", e))?;
        *guard = Some(client.clone());
        Ok(client)
    }

    /// Read bytes at specific offset via HTTP range request (synchronous, for use in extraction threads).
    pub fn read_range_sync(&self, offset: u64, length: u64) -> Result<Vec<u8>> {
        let end = offset.checked_add(length - 1).ok_or_else(|| anyhow!("Range overflow"))?;
        let range_header = format!("bytes={}-{}", offset, end);

        let client = self.get_blocking_client()?;
        for attempt in 0..MAX_RETRIES {
            match client.get(&self.url).header("Range", &range_header).send() {
                Ok(response) => {
                    if !response.status().is_success() && response.status().as_u16() != 206 {
                        return Err(anyhow!("Range request failed: {}", response.status()));
                    }
                    let bytes =
                        response.bytes().map_err(|e| anyhow!("Failed to read response: {}", e))?;
                    // Verify content-length matches requested range
                    if bytes.len() as u64 != length {
                        return Err(anyhow!(
                            "Content-Length mismatch: expected {} bytes, got {}",
                            length,
                            bytes.len()
                        ));
                    }
                    return Ok(bytes.to_vec());
                }
                Err(e) => {
                    if attempt + 1 >= MAX_RETRIES {
                        return Err(anyhow!(
                            "HTTP request failed after {} retries: {}",
                            MAX_RETRIES,
                            e
                        ));
                    }
                    std::thread::sleep(Duration::from_millis(
                        RETRY_BASE_DELAY_MS * 2u64.pow(attempt),
                    ));
                }
            }
        }
        unreachable!("retry loop should have returned by now")
    }

    /// Read bytes at specific offset (HTTP range request).
    pub async fn read_range(&self, offset: u64, length: u64) -> Result<Vec<u8>> {
        let end = offset.checked_add(length - 1).ok_or_else(|| anyhow!("Range overflow"))?;
        let range_header = format!("bytes={}-{}", offset, end);

        for attempt in 0..MAX_RETRIES {
            match self.client.get(&self.url).header("Range", &range_header).send().await {
                Ok(response) => {
                    if !response.status().is_success() && response.status().as_u16() != 206 {
                        return Err(anyhow!("Range request failed: {}", response.status()));
                    }
                    let bytes = response
                        .bytes()
                        .await
                        .map_err(|e| anyhow!("Failed to read response: {}", e))?;
                    // Verify content-length matches requested range
                    if bytes.len() as u64 != length {
                        return Err(anyhow!(
                            "Content-Length mismatch: expected {} bytes, got {}",
                            length,
                            bytes.len()
                        ));
                    }
                    return Ok(bytes.to_vec());
                }
                Err(e) => {
                    if attempt + 1 >= MAX_RETRIES {
                        return Err(anyhow!(
                            "HTTP request failed after {} retries: {}",
                            MAX_RETRIES,
                            e
                        ));
                    }
                    tokio::time::sleep(Duration::from_millis(
                        RETRY_BASE_DELAY_MS * 2u64.pow(attempt),
                    ))
                    .await;
                }
            }
        }
        unreachable!("retry loop should have returned by now")
    }

    /// Get the total content length of the remote file.
    pub fn content_length(&self) -> u64 {
        self.content_length
    }

    /// Check if the server supports range requests.
    pub fn supports_ranges(&self) -> bool {
        self.supports_ranges
    }

    /// Get the Content-Type header from the HEAD response.
    pub fn content_type(&self) -> Option<&str> {
        self.content_type.as_deref()
    }

    /// Get the Last-Modified header from the HEAD response.
    pub fn last_modified(&self) -> Option<&str> {
        self.last_modified.as_deref()
    }

    /// Get the Server header from the HEAD response.
    pub fn server(&self) -> Option<&str> {
        self.server.as_deref()
    }

    /// Get the ETag header from the HEAD response.
    pub fn etag(&self) -> Option<&str> {
        self.etag.as_deref()
    }
}
