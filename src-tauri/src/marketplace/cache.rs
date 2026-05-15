use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::types::{MarketplaceApp, MarketplaceAppDetail};

const SEARCH_TTL: Duration = Duration::from_secs(5 * 60);
const DETAIL_TTL: Duration = Duration::from_secs(10 * 60);

/// Maximum number of cached entries per category.
/// Prevents unbounded memory growth from varied searches.
const MAX_SEARCH_ENTRIES: usize = 200;
const MAX_DETAIL_ENTRIES: usize = 500;

#[derive(Clone)]
struct TimedEntry<T> {
    value: T,
    cached_at: Instant,
    ttl: Duration,
}

impl<T: Clone> TimedEntry<T> {
    fn get(&self) -> Option<T> {
        if self.cached_at.elapsed() <= self.ttl { Some(self.value.clone()) } else { None }
    }
}

#[derive(Default)]
pub struct MarketplaceCache {
    search: HashMap<String, TimedEntry<Vec<MarketplaceApp>>>,
    detail: HashMap<String, TimedEntry<MarketplaceAppDetail>>,
}

impl MarketplaceCache {
    pub fn get_search(&self, key: &str) -> Option<Vec<MarketplaceApp>> {
        self.search.get(key).and_then(TimedEntry::get)
    }

    pub fn insert_search(&mut self, key: String, value: Vec<MarketplaceApp>) {
        self.evict_if_full(CacheSlot::Search);
        self.search.insert(key, TimedEntry { value, cached_at: Instant::now(), ttl: SEARCH_TTL });
    }

    pub fn get_detail(&self, key: &str) -> Option<MarketplaceAppDetail> {
        self.detail.get(key).and_then(TimedEntry::get)
    }

    pub fn insert_detail(&mut self, key: String, value: MarketplaceAppDetail) {
        self.evict_if_full(CacheSlot::Detail);
        self.detail.insert(key, TimedEntry { value, cached_at: Instant::now(), ttl: DETAIL_TTL });
    }

    pub fn clear(&mut self) {
        self.search.clear();
        self.detail.clear();
    }

    /// Evict entries when a cache slot is at capacity.
    ///
    /// Strategy:
    /// 1. Remove all expired entries first (cheap — they're useless anyway).
    /// 2. If still at capacity, remove the oldest entry (LRU-like).
    fn evict_if_full(&mut self, slot: CacheSlot) {
        let (len, max) = match slot {
            CacheSlot::Search => (self.search.len(), MAX_SEARCH_ENTRIES),
            CacheSlot::Detail => (self.detail.len(), MAX_DETAIL_ENTRIES),
        };

        if len < max {
            return;
        }

        // Pass 1: sweep expired entries
        match slot {
            CacheSlot::Search => self.search.retain(|_, e| e.cached_at.elapsed() <= e.ttl),
            CacheSlot::Detail => self.detail.retain(|_, e| e.cached_at.elapsed() <= e.ttl),
        }

        // Pass 2: if still at capacity, evict oldest
        let still_full = match slot {
            CacheSlot::Search => self.search.len() >= max,
            CacheSlot::Detail => self.detail.len() >= max,
        };

        if still_full {
            let oldest_key = match slot {
                CacheSlot::Search => {
                    self.search.iter().min_by_key(|(_, e)| e.cached_at).map(|(k, _)| k.clone())
                }
                CacheSlot::Detail => {
                    self.detail.iter().min_by_key(|(_, e)| e.cached_at).map(|(k, _)| k.clone())
                }
            };
            if let Some(key) = oldest_key {
                match slot {
                    CacheSlot::Search => {
                        self.search.remove(&key);
                    }
                    CacheSlot::Detail => {
                        self.detail.remove(&key);
                    }
                }
            }
        }
    }
}

enum CacheSlot {
    Search,
    Detail,
}

#[derive(Default)]
pub struct ManagedMarketplaceCache(pub Mutex<MarketplaceCache>);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clear_removes_cached_values() {
        let mut cache = MarketplaceCache::default();
        cache.insert_search("query".into(), vec![MarketplaceApp::default()]);
        assert!(cache.get_search("query").is_some());

        cache.clear();

        assert!(cache.get_search("query").is_none());
    }

    #[test]
    fn get_does_not_sweep_on_read() {
        let mut cache = MarketplaceCache::default();
        cache.insert_search("q1".into(), vec![]);
        cache.insert_search("q2".into(), vec![]);

        // Both should be accessible
        assert!(cache.get_search("q1").is_some());
        assert!(cache.get_search("q2").is_some());
    }
}
