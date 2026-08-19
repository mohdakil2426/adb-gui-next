use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FirmwareBrand {
    Google,
    Nothing,
    Xiaomi,
    #[serde(rename = "oneplus")]
    OnePlus,
    Samsung,
}

impl FirmwareBrand {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Google => "google",
            Self::Nothing => "nothing",
            Self::Xiaomi => "xiaomi",
            Self::OnePlus => "oneplus",
            Self::Samsung => "samsung",
        }
    }

    pub fn display_name(self) -> &'static str {
        match self {
            Self::Google => "Google Pixel",
            Self::Nothing => "Nothing",
            Self::Xiaomi => "Xiaomi / POCO / Redmi",
            Self::OnePlus => "OnePlus",
            Self::Samsung => "Samsung",
        }
    }
}

impl std::str::FromStr for FirmwareBrand {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "google" | "pixel" => Ok(Self::Google),
            "nothing" => Ok(Self::Nothing),
            "xiaomi" | "redmi" | "poco" => Ok(Self::Xiaomi),
            "oneplus" => Ok(Self::OnePlus),
            "samsung" => Ok(Self::Samsung),
            _ => Err(format!("Unknown firmware brand: {s}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FirmwareImageType {
    Factory,
    Ota,
}

impl FirmwareImageType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Factory => "factory",
            Self::Ota => "ota",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareBuild {
    pub id: String,
    pub version: String,
    pub android_version: String,
    pub build_id: String,
    pub carrier: Option<String>,
    pub release_date: Option<String>,
    pub security_patch: Option<String>,
    pub image_type: FirmwareImageType,
    pub download_url: String,
    pub file_size: Option<u64>,
    pub sha256: Option<String>,
    pub is_latest: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareDeviceModel {
    pub id: String,
    pub name: String,
    pub codename: String,
    pub brand: FirmwareBrand,
    pub soc: Option<String>,
    pub release_year: Option<u32>,
    pub series: Option<String>,
    pub builds: Vec<FirmwareBuild>,
}
