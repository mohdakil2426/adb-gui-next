pub mod aptoide;
pub mod auth;
pub mod cache;
pub mod fdroid;
pub mod github;
pub mod izzy;
pub mod ranking;
pub mod service;
pub mod types;

pub use cache::ManagedMarketplaceCache;
pub use types::*;

use reqwest::Client;

use crate::CmdResult;

/// Shared HTTP client with a custom user-agent.
pub fn http_client() -> CmdResult<Client> {
    Client::builder()
        .user_agent("ADB-GUI-Next/2.1")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())
}
