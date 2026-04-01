//! HTTP range request support for remote OTA extraction.
//! Downloads only required data ranges instead of full files.

use anyhow::{Result, anyhow};
use reqwest::Client;
use std::time::Duration;

const MAX_RETRIES: u32 = 3;
const RETRY_BASE_DELAY_MS: u64 = 1000;

/// Check if a URL points to a private/internal IP address.
/// Returns true if the URL should be blocked to prevent SSRF attacks.
fn is_private_url(url: &url::Url) -> bool {
    let host = match url.host() {
        Some(host) => host,
        None => return true, // No host = suspicious
    };

    match host {
        url::Host::Domain(domain) => {
            // Block localhost and other local domain names
            matches!(domain, "localhost" | "localhost.localdomain" | "local" | "broadcasthost")
        }
        url::Host::Ipv4(ipv4) => {
            let octets = ipv4.octets();
            // 127.0.0.0/8 (loopback)
            octets[0] == 127
            // 10.0.0.0/8 (private)
            || octets[0] == 10
            // 172.16.0.0/12 (private)
            || octets[0] == 172 && (octets[1] & 0xf0 == 0x10)
            // 192.168.0.0/16 (private)
            || octets[0] == 192 && octets[1] == 168
            // 169.254.0.0/16 (link-local)
            || octets[0] == 169 && octets[1] == 254
            // 100.64.0.0/10 (CGNAT)
            || octets[0] == 100 && (octets[1] & 0xc0 == 0x40)
            // 0.0.0.0 (unspecified)
            || octets[0] == 0 && octets[1] == 0 && octets[2] == 0 && octets[3] == 0
        }
        url::Host::Ipv6(ipv6) => {
            let segs = ipv6.segments();
            // ::1 (loopback)
            segs[0] == 0 && segs[1] == 0 && segs[2] == 0 && segs[3] == 0
                && segs[4] == 0 && segs[5] == 0 && segs[6] == 0 && segs[7] == 1
            // :: (unspecified)
            || segs.iter().all(|&s| s == 0)
            // fe80::/10 (link-local)
            || segs[0] & 0xffc0 == 0xfe80
        }
    }
}

/// HTTP reader with range request support.
pub struct HttpPayloadReader {
    client: Client,
    url: String,
    content_length: u64,
    supports_ranges: bool,
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

        // SSRF prevention: block private/internal IP ranges
        if is_private_url(&url) {
            return Err(anyhow!("URL points to a private or internal address — not permitted"));
        }

        // Only allow HTTPS for security (optional: allow HTTP for local testing)
        if url.scheme() != "https" && url.scheme() != "http" {
            return Err(anyhow!("Only HTTP/HTTPS URLs are supported for remote payloads"));
        }

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

        Ok(Self {
            client,
            url: url_str,
            content_length,
            supports_ranges: true,
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
}
