//! HTTP range request support for remote OTA extraction.
//! Downloads only required data ranges instead of full files.

use anyhow::{Result, anyhow};
use reqwest::Client;
use std::time::Duration;

const MAX_RETRIES: u32 = 3;
const RETRY_BASE_DELAY_MS: u64 = 1000;

/// HTTP reader with range request support.
pub struct HttpPayloadReader {
    client: Client,
    url: String,
    content_length: u64,
    supports_ranges: bool,
}

impl HttpPayloadReader {
    /// Create a new HTTP reader for the given URL.
    /// Performs a HEAD request to check range support and get content length.
    pub async fn new(url: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(600))
            .connect_timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| anyhow!("Failed to create HTTP client: {}", e))?;

        // HEAD request to check range support and get content length
        let response =
            client.head(&url).send().await.map_err(|e| anyhow!("HEAD request failed: {}", e))?;

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

        Ok(Self { client, url, content_length, supports_ranges: true })
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
                    return response
                        .bytes()
                        .await
                        .map(|b| b.to_vec())
                        .map_err(|e| anyhow!("Failed to read response: {}", e));
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
        Err(anyhow!("Unreachable"))
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
