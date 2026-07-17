//! HTTP range request support for remote OTA extraction.
//! Downloads only required data ranges instead of full files.
//!
//! Design notes (aligned with rhythmcache/payload-dumper remote mode):
//! - Servers must support HTTP Range (`Accept-Ranges: bytes` / 206).
//! - Range reads verify returned length matches the request.
//! - Cooperative cancel is checked before each attempt and between retries so
//!   UI cancel does not wait for the full socket timeout.
//! - In-flight async requests are aborted via `tokio::select!` when cancelled.

use anyhow::{Result, anyhow};
use reqwest::{Client, redirect::Policy};
use std::net::{IpAddr, ToSocketAddrs};
use std::time::Duration;

use crate::payload::cancel::CancellationToken;

const MAX_RETRIES: u32 = 3;
const RETRY_BASE_DELAY_MS: u64 = 1000;
/// Per-range request timeout. Chunks are capped (e.g. 8 MiB) so 90s is enough
/// on slow links without making cancel appear "stuck" for 10 minutes.
const RANGE_REQUEST_TIMEOUT: Duration = Duration::from_secs(90);
/// Poll interval while racing cancel against an in-flight async request.
const CANCEL_POLL_MS: u64 = 50;

/// Structured error code for servers that lack `Accept-Ranges: bytes`.
/// Commands/FE can match on this prefix (Task 3.6 / R3).
pub const ERR_NO_RANGE: &str = "REMOTE_NO_RANGE";

/// Build a clear, structured error when the server rejects range-based extract.
pub fn no_range_error() -> anyhow::Error {
    anyhow!(
        "{ERR_NO_RANGE}: Server does not support HTTP Range requests \
         (Accept-Ranges: bytes is required). Selective remote extraction cannot \
         proceed without range support. Full download without ranges is not \
         enabled by default."
    )
}

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
            // IPv4-mapped IPv6 (::ffff:x.x.x.x) must use the same v4 private rules.
            if let Some(v4) = ipv6.to_ipv4_mapped() {
                return is_blocked_ip(IpAddr::V4(v4));
            }
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

const MAX_HTTP_REDIRECTS: usize = 5;

/// Check if a URL points to a private/internal IP address.
/// Returns true if the URL should be blocked to prevent SSRF attacks.
pub(crate) fn is_private_url(url: &url::Url) -> bool {
    let Some(host) = url.host() else {
        return true;
    };

    match host {
        url::Host::Domain(domain) => {
            matches!(domain, "localhost" | "localhost.localdomain" | "local" | "broadcasthost")
        }
        url::Host::Ipv4(ipv4) => is_blocked_ip(IpAddr::V4(ipv4)),
        url::Host::Ipv6(ipv6) => is_blocked_ip(IpAddr::V6(ipv6)),
    }
}

pub fn validate_outbound_url(url: &url::Url, require_https: bool) -> Result<()> {
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

pub fn resolve_redirect_url(base: &url::Url, location: &str) -> Result<url::Url> {
    base.join(location).map_err(|e| anyhow!("Invalid redirect URL: {}", e))
}

async fn head_with_validated_redirects(
    client: &Client,
    initial: url::Url,
) -> Result<(url::Url, reqwest::Response)> {
    let mut current = initial;
    for _ in 0..=MAX_HTTP_REDIRECTS {
        validate_outbound_url(&current, false)?;
        let response = client
            .head(current.as_str())
            .send()
            .await
            .map_err(|e| anyhow!("HEAD request failed: {}", e))?;

        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or_else(|| anyhow!("Redirect missing Location header"))?;
            current = resolve_redirect_url(&current, location)?;
            continue;
        }

        if response.status().is_success() {
            return Ok((current, response));
        }

        return Err(anyhow!("Server returned status {}", response.status()));
    }
    Err(anyhow!("Too many redirects (max {MAX_HTTP_REDIRECTS})"))
}

/// Wait until cancel is set (async poll). Used to abort in-flight reqwest futures.
async fn wait_until_cancelled(token: &CancellationToken) {
    loop {
        if token.is_cancelled() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(CANCEL_POLL_MS)).await;
    }
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

        // Never auto-follow redirects: each hop must pass SSRF validation.
        let client = Client::builder()
            .redirect(Policy::none())
            .timeout(Duration::from_secs(600))
            .connect_timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| anyhow!("Failed to create HTTP client: {}", e))?;

        let (final_url, response) = head_with_validated_redirects(&client, url).await?;

        let supports_ranges = response
            .headers()
            .get("accept-ranges")
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v == "bytes");

        if !supports_ranges {
            return Err(no_range_error());
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
            url: final_url.to_string(),
            content_length,
            supports_ranges: true,
            content_type,
            last_modified,
            server,
            etag,
            blocking_client: std::sync::Mutex::new(None),
        })
    }

    /// Test-only constructor that skips network I/O (session cache unit tests).
    #[cfg(test)]
    pub(crate) fn from_parts_for_test(
        url: String,
        content_length: u64,
        etag: Option<String>,
    ) -> Self {
        let client =
            Client::builder().timeout(Duration::from_secs(5)).build().expect("test client");
        Self {
            client,
            url,
            content_length,
            supports_ranges: true,
            content_type: None,
            last_modified: None,
            server: None,
            etag,
            blocking_client: std::sync::Mutex::new(None),
        }
    }

    /// Get or create a blocking HTTP client for synchronous range reads.
    fn get_blocking_client(&self) -> Result<reqwest::blocking::Client> {
        let mut guard =
            self.blocking_client.lock().map_err(|e| anyhow!("mutex poisoned: {}", e))?;
        if let Some(ref client) = *guard {
            return Ok(client.clone());
        }
        let client = reqwest::blocking::Client::builder()
            .redirect(Policy::none())
            .timeout(RANGE_REQUEST_TIMEOUT)
            .connect_timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| anyhow!("Failed to create blocking HTTP client: {}", e))?;
        *guard = Some(client.clone());
        Ok(client)
    }

    /// Read bytes at specific offset via HTTP range request (synchronous, for use in extraction threads).
    pub fn read_range_sync(&self, offset: u64, length: u64) -> Result<Vec<u8>> {
        self.read_range_sync_cancellable(offset, length, None)
    }

    /// Sync range read with cooperative cancel checks between retries.
    ///
    /// On cancel mid-request, the blocking client cannot abort the socket immediately;
    /// we still check before/after send and skip remaining retries so cancel latency is
    /// bounded by one range timeout at worst.
    pub fn read_range_sync_cancellable(
        &self,
        offset: u64,
        length: u64,
        cancel_token: Option<&CancellationToken>,
    ) -> Result<Vec<u8>> {
        if length == 0 {
            return Ok(Vec::new());
        }
        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
            anyhow::bail!("extraction cancelled");
        }
        let end = offset.checked_add(length - 1).ok_or_else(|| anyhow!("Range overflow"))?;
        let range_header = format!("bytes={}-{}", offset, end);

        let client = self.get_blocking_client()?;
        for attempt in 0..MAX_RETRIES {
            if cancel_token.is_some_and(CancellationToken::is_cancelled) {
                anyhow::bail!("extraction cancelled");
            }
            match client
                .get(&self.url)
                .header("Range", &range_header)
                .timeout(RANGE_REQUEST_TIMEOUT)
                .send()
            {
                Ok(response) => {
                    if cancel_token.is_some_and(CancellationToken::is_cancelled) {
                        anyhow::bail!("extraction cancelled");
                    }
                    if !response.status().is_success() && response.status().as_u16() != 206 {
                        return Err(anyhow!("Range request failed: {}", response.status()));
                    }
                    let bytes =
                        response.bytes().map_err(|e| anyhow!("Failed to read response: {}", e))?;
                    if cancel_token.is_some_and(CancellationToken::is_cancelled) {
                        anyhow::bail!("extraction cancelled");
                    }
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
                    if cancel_token.is_some_and(CancellationToken::is_cancelled) {
                        anyhow::bail!("extraction cancelled");
                    }
                    if attempt + 1 >= MAX_RETRIES {
                        return Err(anyhow!(
                            "HTTP request failed after {} retries: {}",
                            MAX_RETRIES,
                            e
                        ));
                    }
                    // Interruptible backoff: wake early if cancelled.
                    let delay_ms = RETRY_BASE_DELAY_MS * 2u64.pow(attempt);
                    let steps = (delay_ms / CANCEL_POLL_MS).max(1);
                    for _ in 0..steps {
                        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
                            anyhow::bail!("extraction cancelled");
                        }
                        std::thread::sleep(Duration::from_millis(CANCEL_POLL_MS));
                    }
                }
            }
        }
        unreachable!("retry loop should have returned by now")
    }

    /// Read bytes at specific offset (HTTP range request).
    pub async fn read_range(&self, offset: u64, length: u64) -> Result<Vec<u8>> {
        self.read_range_cancellable(offset, length, None).await
    }

    /// Async range read with cooperative cancel checks between retries.
    ///
    /// When a cancel token is provided, in-flight `send()` / `bytes()` futures are
    /// raced against cancel polling so dropping the request aborts the connection
    /// promptly (R4 hard cancel).
    pub async fn read_range_cancellable(
        &self,
        offset: u64,
        length: u64,
        cancel_token: Option<&CancellationToken>,
    ) -> Result<Vec<u8>> {
        if length == 0 {
            return Ok(Vec::new());
        }
        if cancel_token.is_some_and(CancellationToken::is_cancelled) {
            anyhow::bail!("extraction cancelled");
        }
        let end = offset.checked_add(length - 1).ok_or_else(|| anyhow!("Range overflow"))?;
        let range_header = format!("bytes={}-{}", offset, end);

        for attempt in 0..MAX_RETRIES {
            if cancel_token.is_some_and(CancellationToken::is_cancelled) {
                anyhow::bail!("extraction cancelled");
            }

            let send_fut = self
                .client
                .get(&self.url)
                .header("Range", &range_header)
                .timeout(RANGE_REQUEST_TIMEOUT)
                .send();

            let send_result = if let Some(token) = cancel_token {
                tokio::select! {
                    biased;
                    _ = wait_until_cancelled(token) => {
                        anyhow::bail!("extraction cancelled");
                    }
                    result = send_fut => result
                }
            } else {
                send_fut.await
            };

            match send_result {
                Ok(response) => {
                    if !response.status().is_success() && response.status().as_u16() != 206 {
                        return Err(anyhow!("Range request failed: {}", response.status()));
                    }

                    let bytes_fut = response.bytes();
                    let bytes_result = if let Some(token) = cancel_token {
                        tokio::select! {
                            biased;
                            _ = wait_until_cancelled(token) => {
                                anyhow::bail!("extraction cancelled");
                            }
                            result = bytes_fut => result
                        }
                    } else {
                        bytes_fut.await
                    };

                    let bytes = match bytes_result {
                        Ok(b) => b,
                        Err(e) => {
                            if cancel_token.is_some_and(CancellationToken::is_cancelled) {
                                anyhow::bail!("extraction cancelled");
                            }
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
                            continue;
                        }
                    };

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
                    if cancel_token.is_some_and(CancellationToken::is_cancelled) {
                        anyhow::bail!("extraction cancelled");
                    }
                    if attempt + 1 >= MAX_RETRIES {
                        return Err(anyhow!(
                            "HTTP request failed after {} retries: {}",
                            MAX_RETRIES,
                            e
                        ));
                    }
                    // Interruptible backoff when a cancel token is present.
                    let delay_ms = RETRY_BASE_DELAY_MS * 2u64.pow(attempt);
                    if let Some(token) = cancel_token {
                        let steps = (delay_ms / CANCEL_POLL_MS).max(1);
                        for _ in 0..steps {
                            if token.is_cancelled() {
                                anyhow::bail!("extraction cancelled");
                            }
                            tokio::time::sleep(Duration::from_millis(CANCEL_POLL_MS)).await;
                        }
                    } else {
                        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
                    }
                }
            }
        }
        unreachable!("retry loop should have returned by now")
    }

    /// Request URL (for session cache keying).
    pub fn url(&self) -> &str {
        &self.url
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    #[test]
    fn no_range_error_has_structured_code() {
        let err = no_range_error();
        let msg = err.to_string();
        assert!(msg.starts_with(ERR_NO_RANGE), "msg={msg}");
        assert!(msg.contains("Accept-Ranges"));
    }

    #[test]
    fn blocks_private_and_loopback_ipv4() {
        assert!(is_blocked_ip(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))));
        assert!(is_blocked_ip(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))));
        assert!(is_blocked_ip(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1))));
        assert!(is_blocked_ip(IpAddr::V4(Ipv4Addr::new(169, 254, 169, 254))));
        assert!(!is_blocked_ip(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))));
    }

    #[test]
    fn blocks_ipv4_mapped_loopback() {
        let mapped = Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0x7f00, 1); // ::ffff:127.0.0.1
        assert!(is_blocked_ip(IpAddr::V6(mapped)));
    }

    #[test]
    fn private_url_blocks_localhost_host() {
        let url = url::Url::parse("http://localhost/payload.bin").unwrap();
        assert!(is_private_url(&url));
        let public = url::Url::parse("https://example.com/payload.bin").unwrap();
        assert!(!is_private_url(&public));
    }
}
