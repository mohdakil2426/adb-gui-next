use crate::firmware::traits::{BoxFuture, FirmwareProvider};
use crate::firmware::types::{
    FirmwareBrand, FirmwareBuild, FirmwareDeviceModel, FirmwareImageType,
};

pub struct XiaomiProvider;

impl Default for XiaomiProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl XiaomiProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn get_static_catalog() -> Vec<FirmwareDeviceModel> {
        vec![
            FirmwareDeviceModel {
                id: "xiaomi-houji".into(),
                name: "Xiaomi 14".into(),
                codename: "houji".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 8 Gen 3".into()),
                release_year: Some(2023),
                series: Some("Xiaomi 14".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "houji-factory-hyperos-1-0-10".into(),
                        version: "HyperOS 1.0.10.0.UNCMIXM (Global)".into(),
                        android_version: "14".into(),
                        build_id: "OS1.0.10.0.UNCMIXM".into(),
                        carrier: Some("Global".into()),
                        release_date: Some("Jul 2024".into()),
                        security_patch: Some("2024-07-01".into()),
                        image_type: FirmwareImageType::Factory,
                        download_url: "https://bigota.d.miui.com/OS1.0.10.0.UNCMIXM/houji_global_images_OS1.0.10.0.UNCMIXM_20240715.0000.00_14.0_global_d3c1a2b4.tgz".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-peridot".into(),
                name: "POCO F6".into(),
                codename: "peridot".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 8s Gen 3".into()),
                release_year: Some(2024),
                series: Some("POCO F".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "peridot-factory-hyperos-1-0-5".into(),
                        version: "HyperOS 1.0.5.0.UNPMIXM (Global)".into(),
                        android_version: "14".into(),
                        build_id: "OS1.0.5.0.UNPMIXM".into(),
                        carrier: Some("Global".into()),
                        release_date: Some("Aug 2024".into()),
                        security_patch: Some("2024-08-01".into()),
                        image_type: FirmwareImageType::Factory,
                        download_url: "https://bigota.d.miui.com/OS1.0.5.0.UNPMIXM/peridot_global_images_OS1.0.5.0.UNPMIXM_20240810.0000.00_14.0_global_e4b2c1d3.tgz".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-marble".into(),
                name: "POCO F5 / Redmi Note 12 Turbo".into(),
                codename: "marble".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 7+ Gen 2".into()),
                release_year: Some(2023),
                series: Some("POCO F".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "marble-factory-hyperos-1-0-4".into(),
                        version: "HyperOS 1.0.4.0.UMRMIXM (Global)".into(),
                        android_version: "14".into(),
                        build_id: "OS1.0.4.0.UMRMIXM".into(),
                        carrier: Some("Global".into()),
                        release_date: Some("Jun 2024".into()),
                        security_patch: Some("2024-06-01".into()),
                        image_type: FirmwareImageType::Factory,
                        download_url: "https://bigota.d.miui.com/OS1.0.4.0.UMRMIXM/marble_global_images_OS1.0.4.0.UMRMIXM_20240618.0000.00_14.0_global_a1b2c3d4.tgz".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "xiaomi-garnet".into(),
                name: "Redmi Note 13 Pro 5G / POCO X6 5G".into(),
                codename: "garnet".into(),
                brand: FirmwareBrand::Xiaomi,
                soc: Some("Qualcomm Snapdragon 7s Gen 2".into()),
                release_year: Some(2024),
                series: Some("Redmi Note 13".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "garnet-factory-hyperos-1-0-8".into(),
                        version: "HyperOS 1.0.8.0.UNRMIXM (Global)".into(),
                        android_version: "14".into(),
                        build_id: "OS1.0.8.0.UNRMIXM".into(),
                        carrier: Some("Global".into()),
                        release_date: Some("Jul 2024".into()),
                        security_patch: Some("2024-07-01".into()),
                        image_type: FirmwareImageType::Factory,
                        download_url: "https://bigota.d.miui.com/OS1.0.8.0.UNRMIXM/garnet_global_images_OS1.0.8.0.UNRMIXM_20240722.0000.00_14.0_global_f5e6d7c8.tgz".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
        ]
    }
}

impl FirmwareProvider for XiaomiProvider {
    fn brand(&self) -> FirmwareBrand {
        FirmwareBrand::Xiaomi
    }

    fn fetch_catalog(&self) -> BoxFuture<'_, Result<Vec<FirmwareDeviceModel>, String>> {
        Box::pin(async move {
            // ponytail: static initial device catalog; Xiaomi official bigota/fastboot scraper can be plugged in
            Ok(Self::get_static_catalog())
        })
    }
}
