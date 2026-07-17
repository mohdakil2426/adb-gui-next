use crate::debloat::{
    DebloatListStatus, DebloatPackageRow,
    backup::{BackupSummary, PerDeviceSettings},
};
use std::sync::Mutex;

#[derive(Default)]
pub struct DebloatCache {
    inner: Mutex<DebloatCacheInner>,
}

#[derive(Default)]
struct DebloatCacheInner {
    /// Device serial this cache entry belongs to. Gets return None on mismatch.
    device_id: Option<String>,
    packages: Option<(Vec<DebloatPackageRow>, DebloatListStatus)>,
    settings: Option<PerDeviceSettings>,
    backups: Option<Vec<BackupSummary>>,
}

impl DebloatCache {
    fn device_matches(inner: &DebloatCacheInner, device_id: &str) -> bool {
        inner.device_id.as_deref() == Some(device_id)
    }

    /// If the stored device differs, drop all fields so stale data cannot leak.
    fn ensure_device(inner: &mut DebloatCacheInner, device_id: &str) {
        if !Self::device_matches(inner, device_id) {
            *inner = DebloatCacheInner {
                device_id: Some(device_id.to_string()),
                packages: None,
                settings: None,
                backups: None,
            };
        }
    }

    pub fn get_packages(&self, device_id: &str) -> Option<(Vec<DebloatPackageRow>, DebloatListStatus)> {
        let inner = self.inner.lock().ok()?;
        if !Self::device_matches(&inner, device_id) {
            return None;
        }
        inner.packages.clone()
    }

    pub fn set_packages(
        &self,
        device_id: &str,
        rows: Vec<DebloatPackageRow>,
        status: DebloatListStatus,
    ) {
        if let Ok(mut inner) = self.inner.lock() {
            Self::ensure_device(&mut inner, device_id);
            inner.packages = Some((rows, status));
        }
    }

    pub fn get_settings(&self, device_id: &str) -> Option<PerDeviceSettings> {
        let inner = self.inner.lock().ok()?;
        if !Self::device_matches(&inner, device_id) {
            return None;
        }
        inner.settings.clone()
    }

    pub fn set_settings(&self, device_id: &str, settings: PerDeviceSettings) {
        if let Ok(mut inner) = self.inner.lock() {
            Self::ensure_device(&mut inner, device_id);
            inner.settings = Some(settings);
        }
    }

    pub fn get_backups(&self, device_id: &str) -> Option<Vec<BackupSummary>> {
        let inner = self.inner.lock().ok()?;
        if !Self::device_matches(&inner, device_id) {
            return None;
        }
        inner.backups.clone()
    }

    pub fn set_backups(&self, device_id: &str, backups: Vec<BackupSummary>) {
        if let Ok(mut inner) = self.inner.lock() {
            Self::ensure_device(&mut inner, device_id);
            inner.backups = Some(backups);
        }
    }

    pub fn invalidate(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.packages = None;
            inner.backups = None;
            inner.device_id = None;
        }
    }

    pub fn clear(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            *inner = DebloatCacheInner::default();
        }
    }
}
