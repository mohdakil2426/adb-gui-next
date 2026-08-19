use crate::firmware::traits::{BoxFuture, FirmwareProvider};
use crate::firmware::types::{
    FirmwareBrand, FirmwareBuild, FirmwareDeviceModel, FirmwareImageType,
};

pub struct NothingProvider;

impl Default for NothingProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl NothingProvider {
    pub fn new() -> Self {
        Self
    }

    pub fn get_static_catalog() -> Vec<FirmwareDeviceModel> {
        vec![
            FirmwareDeviceModel {
                id: "nothing-pong".into(),
                name: "Nothing Phone (2)".into(),
                codename: "pong".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon 8+ Gen 1".into()),
                release_year: Some(2023),
                series: Some("Phone (2)".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "pong-ota-nos-2-6-0".into(),
                        version: "Nothing OS 2.6.0 (Pong-U2.6.0-240828)".into(),
                        android_version: "14".into(),
                        build_id: "Pong-U2.6.0-240828".into(),
                        carrier: None,
                        release_date: Some("Aug 2024".into()),
                        security_patch: Some("2024-08-01".into()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/nothing-phone-2-nos-2.6.0.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-pacman".into(),
                name: "Nothing Phone (2a)".into(),
                codename: "pacman".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("MediaTek Dimensity 7200 Pro".into()),
                release_year: Some(2024),
                series: Some("Phone (2a)".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "pacman-ota-nos-2-6-0".into(),
                        version: "Nothing OS 2.6.0 (Pacman-U2.6.0-240828)".into(),
                        android_version: "14".into(),
                        build_id: "Pacman-U2.6.0-240828".into(),
                        carrier: None,
                        release_date: Some("Aug 2024".into()),
                        security_patch: Some("2024-08-01".into()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/nothing-phone-2a-nos-2.6.0.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-spacewar".into(),
                name: "Nothing Phone (1)".into(),
                codename: "spacewar".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("Qualcomm Snapdragon 778G+".into()),
                release_year: Some(2022),
                series: Some("Phone (1)".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "spacewar-ota-nos-2-6-0".into(),
                        version: "Nothing OS 2.6.0 (Spacewar-U2.6.0-240828)".into(),
                        android_version: "14".into(),
                        build_id: "Spacewar-U2.6.0-240828".into(),
                        carrier: None,
                        release_date: Some("Aug 2024".into()),
                        security_patch: Some("2024-08-01".into()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/nothing-phone-1-nos-2.6.0.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
            FirmwareDeviceModel {
                id: "nothing-tetris".into(),
                name: "CMF Phone 1".into(),
                codename: "tetris".into(),
                brand: FirmwareBrand::Nothing,
                soc: Some("MediaTek Dimensity 7300".into()),
                release_year: Some(2024),
                series: Some("CMF".into()),
                builds: vec![
                    FirmwareBuild {
                        id: "tetris-ota-nos-2-6-0".into(),
                        version: "Nothing OS 2.6.0 (Tetris-U2.6.0-240828)".into(),
                        android_version: "14".into(),
                        build_id: "Tetris-U2.6.0-240828".into(),
                        carrier: None,
                        release_date: Some("Aug 2024".into()),
                        security_patch: Some("2024-08-01".into()),
                        image_type: FirmwareImageType::Ota,
                        download_url: "https://android.googleapis.com/packages/ota-api/package/cmf-phone-1-nos-2.6.0.zip".into(),
                        file_size: None,
                        sha256: None,
                        is_latest: true,
                    },
                ],
            },
        ]
    }
}

impl FirmwareProvider for NothingProvider {
    fn brand(&self) -> FirmwareBrand {
        FirmwareBrand::Nothing
    }

    fn fetch_catalog(&self) -> BoxFuture<'_, Result<Vec<FirmwareDeviceModel>, String>> {
        Box::pin(async move {
            // ponytail: static initial device catalog; full OTA API integration can be added when community endpoint is unified
            Ok(Self::get_static_catalog())
        })
    }
}
