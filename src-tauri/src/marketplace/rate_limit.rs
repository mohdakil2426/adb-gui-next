use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub limit: u64,
    pub remaining: u64,
    pub reset_epoch_secs: u64,
    pub resource: String,
}

impl RateLimitInfo {
    pub fn is_exhausted(&self) -> bool {
        self.remaining == 0
    }

    pub fn seconds_until_reset(&self) -> u64 {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        self.reset_epoch_secs.saturating_sub(now)
    }
}

#[derive(Debug, Clone, Default)]
pub struct RateLimitState {
    last: Option<RateLimitInfo>,
    last_exhausted: Option<RateLimitInfo>,
}

pub struct ManagedRateLimitStore(pub Mutex<RateLimitState>);

impl Default for ManagedRateLimitStore {
    fn default() -> Self {
        Self(Mutex::new(RateLimitState::default()))
    }
}

impl ManagedRateLimitStore {
    pub fn update_from_headers(
        &self,
        headers: &reqwest::header::HeaderMap,
        status: u16,
        resource_hint: &str,
    ) -> Option<RateLimitInfo> {
        let limit = headers
            .get("x-ratelimit-limit")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())?;
        let remaining = headers
            .get("x-ratelimit-remaining")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())?;
        let reset = headers
            .get("x-ratelimit-reset")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())?;

        let resource = headers
            .get("x-ratelimit-resource")
            .and_then(|v| v.to_str().ok())
            .unwrap_or(resource_hint)
            .to_string();

        let info = RateLimitInfo { limit, remaining, reset_epoch_secs: reset, resource };

        let is_error = status == 403 || status == 429;
        let exhausted = info.is_exhausted() && is_error;

        let mut guard = self.0.lock().ok()?;
        guard.last = Some(info.clone());
        if exhausted {
            guard.last_exhausted = Some(info.clone());
        }
        Some(info)
    }

    pub fn get_last(&self) -> Option<RateLimitInfo> {
        self.0.lock().ok()?.last.clone()
    }

    pub fn get_last_exhausted(&self) -> Option<RateLimitInfo> {
        self.0.lock().ok()?.last_exhausted.clone()
    }

    pub fn should_preempt(&self) -> bool {
        if let Some(info) = self.get_last() {
            // Komi's preempt: remaining <=10 && reset > now
            info.remaining <= 10 && info.seconds_until_reset() > 0
        } else {
            false
        }
    }
}

/// Decide whether to fallback to direct GitHub when backend fails.
/// Mirrors Komi BackendFallbackPolicy.
pub fn should_fallback_to_github(status: u16, is_signed_in: bool) -> bool {
    if status == 429 {
        return false; // never fallback on rate-limit — show backoff
    }
    if (500..=599).contains(&status) {
        return true;
    }
    if is_signed_in && matches!(status, 401 | 403 | 404) {
        return true;
    }
    false
}

pub fn should_retry_on_rate_limit(status: u16, remaining: Option<u64>) -> bool {
    !(status == 403 && remaining == Some(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fallback_policy() {
        assert!(should_fallback_to_github(500, false));
        assert!(!should_fallback_to_github(429, true));
        assert!(should_fallback_to_github(404, true));
        assert!(!should_fallback_to_github(404, false));
    }

    #[test]
    fn preempt_logic() {
        let store = ManagedRateLimitStore::default();
        assert!(!store.should_preempt());
    }
}
