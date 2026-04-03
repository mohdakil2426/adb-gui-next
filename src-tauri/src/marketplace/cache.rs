use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::types::{MarketplaceApp, MarketplaceAppDetail};

const SEARCH_TTL: Duration = Duration::from_secs(5 * 60);
const DETAIL_TTL: Duration = Duration::from_secs(10 * 60);
const TRENDING_TTL: Duration = Duration::from_secs(10 * 60);

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
    trending: HashMap<String, TimedEntry<Vec<MarketplaceApp>>>,
}

impl MarketplaceCache {
    fn sweep_expired(&mut self) {
        self.search.retain(|_, entry| entry.cached_at.elapsed() <= entry.ttl);
        self.detail.retain(|_, entry| entry.cached_at.elapsed() <= entry.ttl);
        self.trending.retain(|_, entry| entry.cached_at.elapsed() <= entry.ttl);
    }

    pub fn get_search(&mut self, key: &str) -> Option<Vec<MarketplaceApp>> {
        self.sweep_expired();
        self.search.get(key).and_then(TimedEntry::get)
    }

    pub fn insert_search(&mut self, key: String, value: Vec<MarketplaceApp>) {
        self.search.insert(key, TimedEntry { value, cached_at: Instant::now(), ttl: SEARCH_TTL });
    }

    pub fn get_detail(&mut self, key: &str) -> Option<MarketplaceAppDetail> {
        self.sweep_expired();
        self.detail.get(key).and_then(TimedEntry::get)
    }

    pub fn insert_detail(&mut self, key: String, value: MarketplaceAppDetail) {
        self.detail.insert(key, TimedEntry { value, cached_at: Instant::now(), ttl: DETAIL_TTL });
    }

    pub fn get_trending(&mut self, key: &str) -> Option<Vec<MarketplaceApp>> {
        self.sweep_expired();
        self.trending.get(key).and_then(TimedEntry::get)
    }

    pub fn insert_trending(&mut self, key: String, value: Vec<MarketplaceApp>) {
        self.trending
            .insert(key, TimedEntry { value, cached_at: Instant::now(), ttl: TRENDING_TTL });
    }

    pub fn clear(&mut self) {
        self.search.clear();
        self.detail.clear();
        self.trending.clear();
    }
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
}
