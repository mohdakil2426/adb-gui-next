use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use super::types::{FirmwareBrand, FirmwareDeviceModel};

const CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Debug, Clone)]
struct CachedCatalog {
    devices: Vec<FirmwareDeviceModel>,
    cached_at: SystemTime,
}

impl CachedCatalog {
    fn is_fresh(&self) -> bool {
        match self.cached_at.elapsed() {
            Ok(elapsed) => elapsed < CACHE_TTL,
            Err(_) => false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct DiskCacheEntry {
    cached_at_unix: u64,
    brand: FirmwareBrand,
    devices: Vec<FirmwareDeviceModel>,
}

#[derive(Debug, Clone)]
pub struct FirmwareCache {
    memory: Arc<RwLock<HashMap<FirmwareBrand, CachedCatalog>>>,
    cache_dir: Option<PathBuf>,
}

impl Default for FirmwareCache {
    fn default() -> Self {
        Self::new(None)
    }
}
impl FirmwareCache {
    pub fn new(cache_dir: Option<PathBuf>) -> Self {
        Self { memory: Arc::new(RwLock::new(HashMap::new())), cache_dir }
    }

    pub fn get_cache_dir(&self) -> PathBuf {
        if let Some(dir) = &self.cache_dir {
            dir.join("firmware")
        } else {
            std::env::temp_dir().join("adb-gui-next").join("cache").join("firmware")
        }
    }
    fn disk_file_path(&self, brand: FirmwareBrand) -> PathBuf {
        self.get_cache_dir().join(format!("{}.json", brand.as_str()))
    }

    /// Retrieve devices from RAM (tier 1) or Disk (tier 2).
    pub async fn get(&self, brand: FirmwareBrand) -> Option<Vec<FirmwareDeviceModel>> {
        // Tier 1: Check RAM
        {
            let mem = self.memory.read().await;
            if let Some(entry) = mem.get(&brand) {
                if entry.is_fresh() {
                    return Some(entry.devices.clone());
                }
            }
        }

        // Tier 2: Check Disk
        let path = self.disk_file_path(brand);
        if path.exists() {
            if let Ok(contents) = tokio::fs::read_to_string(&path).await {
                if let Ok(disk_entry) = serde_json::from_str::<DiskCacheEntry>(&contents) {
                    let cached_time = UNIX_EPOCH + Duration::from_secs(disk_entry.cached_at_unix);
                    if let Ok(elapsed) = cached_time.elapsed() {
                        if elapsed < CACHE_TTL && disk_entry.brand == brand {
                            // Populate Tier 1
                            let devices = disk_entry.devices;
                            let mut mem = self.memory.write().await;
                            mem.insert(
                                brand,
                                CachedCatalog { devices: devices.clone(), cached_at: cached_time },
                            );
                            return Some(devices);
                        }
                    }
                }
            }
        }

        None
    }

    /// Store devices in both RAM (tier 1) and Disk (tier 2).
    pub async fn set(
        &self,
        brand: FirmwareBrand,
        devices: Vec<FirmwareDeviceModel>,
    ) -> Result<(), String> {
        let now = SystemTime::now();
        let now_unix = now.duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs();

        // Update Tier 1
        {
            let mut mem = self.memory.write().await;
            mem.insert(brand, CachedCatalog { devices: devices.clone(), cached_at: now });
        }

        // Update Tier 2
        let cache_dir = self.get_cache_dir();
        tokio::fs::create_dir_all(&cache_dir)
            .await
            .map_err(|e| format!("Failed to create firmware cache dir: {e}"))?;

        let disk_entry = DiskCacheEntry { cached_at_unix: now_unix, brand, devices };

        let json = serde_json::to_string_pretty(&disk_entry)
            .map_err(|e| format!("Failed to serialize firmware disk cache: {e}"))?;

        let path = self.disk_file_path(brand);
        tokio::fs::write(&path, json)
            .await
            .map_err(|e| format!("Failed to write firmware disk cache {path:?}: {e}"))?;

        Ok(())
    }

    /// Invalidate cache for a specific brand in both tiers.
    pub async fn invalidate(&self, brand: FirmwareBrand) -> Result<(), String> {
        // Clear Tier 1
        {
            let mut mem = self.memory.write().await;
            mem.remove(&brand);
        }

        // Clear Tier 2
        let path = self.disk_file_path(brand);
        if path.exists() {
            tokio::fs::remove_file(&path)
                .await
                .map_err(|e| format!("Failed to remove firmware cache file {path:?}: {e}"))?;
        }

        Ok(())
    }

    /// Invalidate all cached brands in both tiers.
    pub async fn clear(&self) -> Result<(), String> {
        // Clear Tier 1
        {
            let mut mem = self.memory.write().await;
            mem.clear();
        }

        // Clear Tier 2
        let cache_dir = self.get_cache_dir();
        if cache_dir.exists() {
            tokio::fs::remove_dir_all(&cache_dir)
                .await
                .map_err(|e| format!("Failed to remove firmware cache directory: {e}"))?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_firmware_cache_tiers() {
        let tmp = tempdir().expect("tempdir");
        let cache = FirmwareCache::new(Some(tmp.path().to_path_buf()));

        let dummy_devices = vec![FirmwareDeviceModel {
            id: "nothing-pong".into(),
            name: "Nothing Phone (2)".into(),
            codename: "pong".into(),
            brand: FirmwareBrand::Nothing,
            soc: None,
            release_year: Some(2023),
            series: None,
            builds: vec![],
        }];

        // Cache miss initially
        assert!(cache.get(FirmwareBrand::Nothing).await.is_none());

        // Cache set
        cache.set(FirmwareBrand::Nothing, dummy_devices.clone()).await.expect("set cache");

        // Cache hit from RAM
        let cached = cache.get(FirmwareBrand::Nothing).await;
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().len(), 1);

        // New cache instance pointing to same disk dir (testing tier 2 disk fallback)
        let cache2 = FirmwareCache::new(Some(tmp.path().to_path_buf()));
        let cached2 = cache2.get(FirmwareBrand::Nothing).await;
        assert!(cached2.is_some());
        assert_eq!(cached2.unwrap()[0].codename, "pong");

        // Clear cache
        cache2.clear().await.expect("clear cache");
        assert!(cache2.get(FirmwareBrand::Nothing).await.is_none());
    }
}
