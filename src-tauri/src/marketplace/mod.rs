pub mod aptoide;
pub mod auth;
pub mod cache;
pub mod fdroid;
pub mod github;
pub mod ranking;
pub mod service;
pub mod types;

pub use cache::ManagedMarketplaceCache;
pub use types::*;

use reqwest::Client;

use crate::CmdResult;

/// Application-wide HTTP client, registered as Tauri managed state.
///
/// `reqwest::Client` uses `Arc` internally — `.clone()` is a cheap reference-count
/// increment that shares the underlying connection pool, TLS sessions, and DNS cache.
/// Creating a new `Client` per command wastes all of those.
pub struct ManagedHttpClient(pub Client);

impl ManagedHttpClient {
    pub fn new() -> CmdResult<Self> {
        let client = Client::builder()
            .user_agent(concat!("ADB-GUI-Next/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(15))
            .connect_timeout(std::time::Duration::from_secs(10))
            .pool_max_idle_per_host(5)
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self(client))
    }
}

impl Default for ManagedHttpClient {
    fn default() -> Self {
        Self::new().expect("failed to create HTTP client at startup")
    }
}
