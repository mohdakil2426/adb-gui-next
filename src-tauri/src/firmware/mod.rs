pub mod cache;
pub mod providers;
pub mod service;
pub mod traits;
pub mod types;

pub use cache::FirmwareCache;
pub use providers::{
    GooglePixelScraper, NothingProvider, OnePlusProvider, SamsungProvider, XiaomiProvider,
};
pub use service::FirmwareHubService;
pub use traits::{BoxFuture, FirmwareProvider};
pub use types::{FirmwareBrand, FirmwareBuild, FirmwareDeviceModel, FirmwareImageType};

pub type ManagedFirmwareService = std::sync::Arc<FirmwareHubService>;
