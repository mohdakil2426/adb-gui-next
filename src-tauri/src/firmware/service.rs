use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use super::cache::FirmwareCache;
use super::providers::{GooglePixelScraper, NothingProvider, XiaomiProvider};
use super::traits::FirmwareProvider;
use super::types::{FirmwareBrand, FirmwareDeviceModel};

pub struct FirmwareHubService {
    cache: FirmwareCache,
    providers: HashMap<FirmwareBrand, Arc<dyn FirmwareProvider>>,
}

impl Default for FirmwareHubService {
    fn default() -> Self {
        Self::new(None)
    }
}

impl FirmwareHubService {
    pub fn new(cache_dir: Option<PathBuf>) -> Self {
        let mut providers: HashMap<FirmwareBrand, Arc<dyn FirmwareProvider>> = HashMap::new();
        providers.insert(FirmwareBrand::Google, Arc::new(GooglePixelScraper::new()));
        providers.insert(FirmwareBrand::Nothing, Arc::new(NothingProvider::new()));
        providers.insert(FirmwareBrand::Xiaomi, Arc::new(XiaomiProvider::new()));

        Self { cache: FirmwareCache::new(cache_dir), providers }
    }

    pub fn with_custom_providers(
        cache_dir: Option<PathBuf>,
        provider_list: Vec<Arc<dyn FirmwareProvider>>,
    ) -> Self {
        let mut providers = HashMap::new();
        for p in provider_list {
            providers.insert(p.brand(), p);
        }

        Self { cache: FirmwareCache::new(cache_dir), providers }
    }

    pub fn cache(&self) -> &FirmwareCache {
        &self.cache
    }

    /// Retrieve device catalog for a brand, or all brands if None.
    pub async fn get_devices(
        &self,
        brand: Option<FirmwareBrand>,
        force_refresh: bool,
    ) -> Result<Vec<FirmwareDeviceModel>, String> {
        if let Some(single_brand) = brand {
            self.get_devices_for_brand(single_brand, force_refresh).await
        } else {
            let mut all_devices = Vec::new();
            let brands = [FirmwareBrand::Google, FirmwareBrand::Nothing, FirmwareBrand::Xiaomi];

            for b in brands {
                match self.get_devices_for_brand(b, force_refresh).await {
                    Ok(mut devs) => all_devices.append(&mut devs),
                    Err(e) => {
                        log::warn!("Failed to fetch firmware catalog for {}: {e}", b.as_str());
                    }
                }
            }

            Ok(all_devices)
        }
    }

    async fn get_devices_for_brand(
        &self,
        brand: FirmwareBrand,
        force_refresh: bool,
    ) -> Result<Vec<FirmwareDeviceModel>, String> {
        // 1. Check cache if not forcing refresh
        if !force_refresh && let Some(cached) = self.cache.get(brand).await {
            return Ok(cached);
        }

        // 2. Query provider
        let provider = self.providers.get(&brand).ok_or_else(|| {
            format!("No firmware provider registered for brand: {}", brand.as_str())
        })?;

        let devices = provider.fetch_catalog().await?;

        // 3. Update cache
        if let Err(e) = self.cache.set(brand, devices.clone()).await {
            log::warn!("Failed to cache firmware devices for {}: {e}", brand.as_str());
        }

        Ok(devices)
    }

    /// Retrieve specific device model by brand and codename.
    pub async fn get_device(
        &self,
        brand: FirmwareBrand,
        codename: &str,
        force_refresh: bool,
    ) -> Result<Option<FirmwareDeviceModel>, String> {
        let devices = self.get_devices_for_brand(brand, force_refresh).await?;
        Ok(devices.into_iter().find(|d| d.codename.eq_ignore_ascii_case(codename)))
    }

    /// Search across all device models and builds by query string.
    pub async fn search_firmware(&self, query: &str) -> Result<Vec<FirmwareDeviceModel>, String> {
        let q = query.trim().to_ascii_lowercase();
        if q.is_empty() {
            return self.get_devices(None, false).await;
        }

        let all_devices = self.get_devices(None, false).await?;

        let filtered: Vec<FirmwareDeviceModel> = all_devices
            .into_iter()
            .filter_map(|mut dev| {
                let matches_dev = dev.name.to_ascii_lowercase().contains(&q)
                    || dev.codename.to_ascii_lowercase().contains(&q)
                    || dev.brand.as_str().contains(&q)
                    || dev.soc.as_deref().is_some_and(|s| s.to_ascii_lowercase().contains(&q))
                    || dev.series.as_deref().is_some_and(|s| s.to_ascii_lowercase().contains(&q));

                if matches_dev {
                    Some(dev)
                } else {
                    // Filter builds if device name didn't match directly
                    let matching_builds: Vec<_> = dev
                        .builds
                        .into_iter()
                        .filter(|b| {
                            b.version.to_ascii_lowercase().contains(&q)
                                || b.build_id.to_ascii_lowercase().contains(&q)
                                || b.android_version.contains(&q)
                                || b.carrier
                                    .as_deref()
                                    .is_some_and(|c| c.to_ascii_lowercase().contains(&q))
                        })
                        .collect();

                    if !matching_builds.is_empty() {
                        dev.builds = matching_builds;
                        Some(dev)
                    } else {
                        None
                    }
                }
            })
            .collect();

        Ok(filtered)
    }

    /// Invalidate and clear all firmware cache tiers.
    pub async fn clear_cache(&self) -> Result<(), String> {
        self.cache.clear().await
    }
}
