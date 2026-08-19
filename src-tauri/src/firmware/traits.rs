use std::future::Future;
use std::pin::Pin;

use super::types::{FirmwareBrand, FirmwareDeviceModel};

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

pub trait FirmwareProvider: Send + Sync {
    fn brand(&self) -> FirmwareBrand;

    fn fetch_catalog(&self) -> BoxFuture<'_, Result<Vec<FirmwareDeviceModel>, String>>;

    fn fetch_device<'a>(
        &'a self,
        codename: &'a str,
    ) -> BoxFuture<'a, Result<Option<FirmwareDeviceModel>, String>> {
        Box::pin(async move {
            let catalog = self.fetch_catalog().await?;
            Ok(catalog.into_iter().find(|d| d.codename.eq_ignore_ascii_case(codename)))
        })
    }
}
