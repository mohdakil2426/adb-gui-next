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
    packages: Option<(Vec<DebloatPackageRow>, DebloatListStatus)>,
    settings: Option<PerDeviceSettings>,
    backups: Option<Vec<BackupSummary>>,
}

impl DebloatCache {
    pub fn get_packages(&self) -> Option<(Vec<DebloatPackageRow>, DebloatListStatus)> {
        self.inner.lock().ok()?.packages.clone()
    }

    pub fn set_packages(&self, rows: Vec<DebloatPackageRow>, status: DebloatListStatus) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.packages = Some((rows, status));
        }
    }

    pub fn get_settings(&self) -> Option<PerDeviceSettings> {
        self.inner.lock().ok()?.settings.clone()
    }

    pub fn set_settings(&self, settings: PerDeviceSettings) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.settings = Some(settings);
        }
    }

    pub fn get_backups(&self) -> Option<Vec<BackupSummary>> {
        self.inner.lock().ok()?.backups.clone()
    }

    pub fn set_backups(&self, backups: Vec<BackupSummary>) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.backups = Some(backups);
        }
    }

    pub fn invalidate(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.packages = None;
            inner.backups = None;
        }
    }

    pub fn clear(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            *inner = DebloatCacheInner::default();
        }
    }
}
