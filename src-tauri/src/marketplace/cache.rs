use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::types::{MarketplaceApp, MarketplaceAppDetail};

const SEARCH_FRESH_TTL: Duration = Duration::from_secs(3 * 60);
const SEARCH_STALE_TTL: Duration = Duration::from_secs(30 * 60);

const DETAIL_FRESH_TTL: Duration = Duration::from_secs(10 * 60);
const DETAIL_STALE_TTL: Duration = Duration::from_secs(60 * 60);

const MAX_SEARCH_ENTRIES: usize = 200;
const MAX_DETAIL_ENTRIES: usize = 500;
const MAX_APK_CACHE_ENTRIES: usize = 1000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SwrStatus<T> {
    Fresh(T),
    Stale(T),
    Miss,
}

impl<T> SwrStatus<T> {
    pub fn is_miss(&self) -> bool {
        matches!(self, Self::Miss)
    }
}
#[derive(Clone)]
pub struct SwrEntry<T> {
    pub value: T,
    pub cached_at: Instant,
    pub fresh_ttl: Duration,
    pub stale_ttl: Duration,
}

impl<T: Clone> SwrEntry<T> {
    pub fn new(value: T, fresh_ttl: Duration, stale_ttl: Duration) -> Self {
        Self { value, cached_at: Instant::now(), fresh_ttl, stale_ttl }
    }

    pub fn status(&self) -> SwrStatus<T> {
        let elapsed = self.cached_at.elapsed();
        if elapsed <= self.fresh_ttl {
            SwrStatus::Fresh(self.value.clone())
        } else if elapsed <= self.stale_ttl {
            SwrStatus::Stale(self.value.clone())
        } else {
            SwrStatus::Miss
        }
    }
}

#[derive(Clone, Debug)]
pub struct RepoApkStatus {
    pub installable: bool,
    pub download_url: Option<String>,
    pub cached_at: Instant,
    pub ttl: Duration,
}

#[derive(Default)]
pub struct MarketplaceCache {
    search: HashMap<String, SwrEntry<Vec<MarketplaceApp>>>,
    detail: HashMap<String, SwrEntry<MarketplaceAppDetail>>,
    verified_apks: HashMap<String, RepoApkStatus>,
}

impl MarketplaceCache {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get_search_swr(&self, key: &str) -> SwrStatus<Vec<MarketplaceApp>> {
        self.search.get(key).map_or(SwrStatus::Miss, SwrEntry::status)
    }

    pub fn get_search(&self, key: &str) -> Option<Vec<MarketplaceApp>> {
        match self.get_search_swr(key) {
            SwrStatus::Fresh(val) | SwrStatus::Stale(val) => Some(val),
            SwrStatus::Miss => None,
        }
    }

    pub fn insert_search(&mut self, key: String, value: Vec<MarketplaceApp>) {
        self.evict_if_full(CacheSlot::Search);
        self.search.insert(key, SwrEntry::new(value, SEARCH_FRESH_TTL, SEARCH_STALE_TTL));
    }

    pub fn get_detail_swr(&self, key: &str) -> SwrStatus<MarketplaceAppDetail> {
        self.detail.get(key).map_or(SwrStatus::Miss, SwrEntry::status)
    }

    pub fn get_detail(&self, key: &str) -> Option<MarketplaceAppDetail> {
        match self.get_detail_swr(key) {
            SwrStatus::Fresh(val) | SwrStatus::Stale(val) => Some(val),
            SwrStatus::Miss => None,
        }
    }

    pub fn insert_detail(&mut self, key: String, value: MarketplaceAppDetail) {
        self.evict_if_full(CacheSlot::Detail);
        self.detail.insert(key, SwrEntry::new(value, DETAIL_FRESH_TTL, DETAIL_STALE_TTL));
    }

    pub fn get_verified_apk(&self, slug: &str) -> Option<RepoApkStatus> {
        let entry = self.verified_apks.get(slug)?;
        if entry.cached_at.elapsed() <= entry.ttl { Some(entry.clone()) } else { None }
    }

    pub fn insert_verified_apk(
        &mut self,
        slug: String,
        installable: bool,
        download_url: Option<String>,
    ) {
        self.evict_if_full(CacheSlot::VerifiedApk);
        let ttl = if installable {
            Duration::from_secs(12 * 3600) // 12 hours for positive
        } else {
            Duration::from_secs(2 * 3600) // 2 hours for negative
        };

        self.verified_apks.insert(
            slug,
            RepoApkStatus { installable, download_url, cached_at: Instant::now(), ttl },
        );
    }

    pub fn clear(&mut self) {
        self.search.clear();
        self.detail.clear();
        self.verified_apks.clear();
    }

    fn evict_if_full(&mut self, slot: CacheSlot) {
        match slot {
            CacheSlot::Search => {
                if self.search.len() >= MAX_SEARCH_ENTRIES {
                    self.search.retain(|_, entry| !entry.status().is_miss());
                }
                if self.search.len() >= MAX_SEARCH_ENTRIES {
                    let oldest =
                        self.search.iter().min_by_key(|(_, e)| e.cached_at).map(|(k, _)| k.clone());
                    if let Some(k) = oldest {
                        self.search.remove(&k);
                    }
                }
            }
            CacheSlot::Detail => {
                if self.detail.len() >= MAX_DETAIL_ENTRIES {
                    self.detail.retain(|_, entry| !entry.status().is_miss());
                }
                if self.detail.len() >= MAX_DETAIL_ENTRIES {
                    let oldest =
                        self.detail.iter().min_by_key(|(_, e)| e.cached_at).map(|(k, _)| k.clone());
                    if let Some(k) = oldest {
                        self.detail.remove(&k);
                    }
                }
            }
            CacheSlot::VerifiedApk => {
                if self.verified_apks.len() >= MAX_APK_CACHE_ENTRIES {
                    self.verified_apks.retain(|_, entry| entry.cached_at.elapsed() <= entry.ttl);
                }
                if self.verified_apks.len() >= MAX_APK_CACHE_ENTRIES {
                    let oldest = self
                        .verified_apks
                        .iter()
                        .min_by_key(|(_, e)| e.cached_at)
                        .map(|(k, _)| k.clone());
                    if let Some(k) = oldest {
                        self.verified_apks.remove(&k);
                    }
                }
            }
        }
    }
}

enum CacheSlot {
    Search,
    Detail,
    VerifiedApk,
}

pub struct ManagedMarketplaceCache(pub Mutex<MarketplaceCache>);

impl Default for ManagedMarketplaceCache {
    fn default() -> Self {
        Self(Mutex::new(MarketplaceCache::new()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_swr_fresh_stale_transition() {
        let entry = SwrEntry::new(
            "data".to_string(),
            Duration::from_millis(50),
            Duration::from_millis(200),
        );
        assert_eq!(entry.status(), SwrStatus::Fresh("data".to_string()));

        std::thread::sleep(Duration::from_millis(60));
        assert_eq!(entry.status(), SwrStatus::Stale("data".to_string()));

        std::thread::sleep(Duration::from_millis(150));
        assert_eq!(entry.status(), SwrStatus::Miss);
    }

    #[test]
    fn test_dynamic_verified_apks() {
        let mut cache = MarketplaceCache::new();
        assert!(cache.get_verified_apk("any/dynamic-repo").is_none());
        cache.insert_verified_apk(
            "any/dynamic-repo".into(),
            true,
            Some("https://example.com/app.apk".into()),
        );
        let entry = cache.get_verified_apk("any/dynamic-repo").unwrap();
        assert!(entry.installable);
        assert_eq!(entry.download_url, Some("https://example.com/app.apk".into()));
    }
}
