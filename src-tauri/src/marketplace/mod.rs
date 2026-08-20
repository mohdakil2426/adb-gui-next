pub mod aptoide;
pub mod assets;
pub mod auth;
pub mod cache;
pub mod fdroid;
pub mod github;
pub mod install_queue;
pub mod markdown;
pub mod ranking;
pub mod resolver;
pub mod service;
pub mod types;
pub mod updates;
pub use cache::ManagedMarketplaceCache;
pub use types::*;
pub use updates::marketplace_check_updates;

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
            .connect_timeout(std::time::Duration::from_millis(2500))
            .timeout(std::time::Duration::from_secs(10))
            .pool_max_idle_per_host(32)
            .pool_idle_timeout(std::time::Duration::from_secs(180))
            .tcp_nodelay(true)
            .tcp_keepalive(Some(std::time::Duration::from_secs(45)))
            .http2_adaptive_window(true)
            .http2_keep_alive_interval(Some(std::time::Duration::from_secs(15)))
            .http2_keep_alive_timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self(client))
    }
}

impl Default for ManagedHttpClient {
    fn default() -> Self {
        // Bootstrap: fail fast if the shared HTTP client cannot be built at app start.
        #[allow(clippy::expect_used)]
        {
            Self::new().expect("failed to create HTTP client at startup")
        }
    }
}
