use crate::CmdResult;
use log::debug;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartitionTargetInfo {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub detected_partition: String,
    pub confidence: String,
    pub magic_header: Option<String>,
    pub is_sparse: bool,
    pub is_boot_image: bool,
    pub is_avb: bool,
    pub is_dtbo: bool,
    pub recommended_slot_aware: bool,
    pub risk_level: String,
    pub description: String,
}

const ANDROID_BOOT_MAGIC: &[u8; 8] = b"ANDROID!";
const ANDROID_VENDOR_BOOT_MAGIC: &[u8; 8] = b"VNDRBOOT";
const ANDROID_SPARSE_MAGIC: &[u8; 4] = &[0x3A, 0xFF, 0x26, 0xED]; // Little-endian 0xED26FF3A
const AVB0_MAGIC: &[u8; 4] = b"AVB0";
const DTBO_MAGIC_BE: &[u8; 4] = &[0xD0, 0x0D, 0xFE, 0xED];
const DTBO_MAGIC_LE: &[u8; 4] = &[0xED, 0xFE, 0x0D, 0xD0];
const EXT4_MAGIC: &[u8; 2] = &[0x53, 0xEF]; // 0xEF53 at offset 0x438 (1080)

fn normalize_name_for_heuristic(file_name: &str) -> String {
    let mut name = file_name.to_lowercase();
    if let Some(pos) = name.rfind('.') {
        name.truncate(pos);
    }
    name = name
        .trim_end_matches("_a")
        .trim_end_matches("_b")
        .trim_end_matches("-a")
        .trim_end_matches("-b")
        .to_string();
    name
}

fn detect_partition_from_name(file_name: &str) -> Option<&'static str> {
    let base = normalize_name_for_heuristic(file_name);
    match base.as_str() {
        "boot" => Some("boot"),
        "init_boot" | "initboot" | "init-boot" => Some("init_boot"),
        "vendor_boot" | "vendorboot" | "vendor-boot" => Some("vendor_boot"),
        "recovery" => Some("recovery"),
        "dtbo" => Some("dtbo"),
        "vbmeta" => Some("vbmeta"),
        "vbmeta_system" | "vbmeta-system" => Some("vbmeta_system"),
        "vbmeta_vendor" | "vbmeta-vendor" => Some("vbmeta_vendor"),
        "super" => Some("super"),
        "system" => Some("system"),
        "vendor" => Some("vendor"),
        "product" => Some("product"),
        "system_ext" | "systemext" | "system-ext" => Some("system_ext"),
        "odm" => Some("odm"),
        "userdata" | "data" => Some("userdata"),
        "cache" => Some("cache"),
        "metadata" => Some("metadata"),
        "persist" => Some("persist"),
        "modem" => Some("modem"),
        "radio" => Some("radio"),
        "bluetooth" => Some("bluetooth"),
        "dsp" => Some("dsp"),
        "bootloader" => Some("bootloader"),
        _ => {
            if base.contains("init_boot") || base.contains("initboot") {
                Some("init_boot")
            } else if base.contains("vendor_boot") || base.contains("vendorboot") {
                Some("vendor_boot")
            } else if base.contains("boot") && !base.contains("bootloader") {
                Some("boot")
            } else if base.contains("recovery") {
                Some("recovery")
            } else if base.contains("dtbo") {
                Some("dtbo")
            } else if base.contains("vbmeta_system") {
                Some("vbmeta_system")
            } else if base.contains("vbmeta_vendor") {
                Some("vbmeta_vendor")
            } else if base.contains("vbmeta") {
                Some("vbmeta")
            } else if base.contains("super") {
                Some("super")
            } else if base.contains("system_ext") {
                Some("system_ext")
            } else if base.contains("system") {
                Some("system")
            } else if base.contains("vendor") {
                Some("vendor")
            } else if base.contains("product") {
                Some("product")
            } else if base.contains("odm") {
                Some("odm")
            } else if base.contains("userdata") || base.contains("data") {
                Some("userdata")
            } else {
                None
            }
        }
    }
}

pub fn get_partition_risk_level(partition: &str) -> &'static str {
    let clean = partition.to_lowercase();
    let base = clean.trim_end_matches("_a").trim_end_matches("_b");
    match base {
        "userdata" | "super" | "bootloader" | "radio" | "modem" => "critical",
        p if p.starts_with("vbmeta") => "critical",
        "system" | "vendor" | "product" | "system_ext" | "odm" | "boot" | "init_boot"
        | "recovery" => "elevated",
        _ => "standard",
    }
}

pub fn is_partition_slot_aware(partition: &str) -> bool {
    let clean = partition.to_lowercase();
    let base = clean.trim_end_matches("_a").trim_end_matches("_b");
    !matches!(base, "userdata" | "super" | "metadata" | "cache" | "persist")
}

pub fn get_partition_description(partition: &str) -> &'static str {
    let clean = partition.to_lowercase();
    let base = clean.trim_end_matches("_a").trim_end_matches("_b");
    match base {
        "boot" => "Android Linux kernel and ramdisk boot image.",
        "init_boot" => "Android 13+ generic ramdisk bootloader image containing init binary.",
        "vendor_boot" => "OEM kernel modules, device tree, and vendor ramdisk.",
        "recovery" => {
            "Dedicated standalone recovery environment image (A-only or non-GKI devices)."
        }
        "dtbo" => {
            "Device Tree Blob Overlay for hardware board peripherals and power configuration."
        }
        "vbmeta" => {
            "Android Verified Boot cryptographic root-of-trust metadata and partition descriptors."
        }
        "vbmeta_system" => "AVB verification descriptor for system partition verification.",
        "vbmeta_vendor" => "AVB verification descriptor for vendor partition verification.",
        "super" => {
            "Dynamic partition container holding system, vendor, product, and odm sub-volumes."
        }
        "system" => {
            "Android framework, core system binaries, libraries, and pre-installed system apps."
        }
        "vendor" => "Hardware abstraction layer (HAL), OEM device drivers, and platform binaries.",
        "product" => "OEM-specific system apps, themes, carrier customizations, and permissions.",
        "system_ext" => "Extended system components and manufacturer middleware.",
        "odm" => "Original Design Manufacturer hardware drivers and board configurations.",
        "userdata" => "User data, installed user apps, internal storage, and encryption keys.",
        "modem" | "radio" => "Baseband cellular modem firmware and radio protocol stack.",
        "metadata" => "Metadata for encrypted data and dynamic partition table journaling.",
        "cache" => "Legacy temporary cache partition for OTA downloads and recovery logs.",
        "persist" => "Persistent calibration data for sensors, Wi-Fi MAC, and Bluetooth addresses.",
        _ => "Android flashable partition image.",
    }
}

pub fn inspect_partition_image_bytes(
    header_bytes: &[u8],
    file_name: &str,
    file_size: u64,
    file_path: &str,
) -> PartitionTargetInfo {
    let mut is_sparse = false;
    let mut is_boot_image = false;
    let mut is_avb = false;
    let mut is_dtbo = false;
    let mut magic_header = None;
    let mut detected_partition = None;
    let mut confidence = "unknown";

    if header_bytes.len() >= 8 && &header_bytes[..8] == ANDROID_BOOT_MAGIC {
        is_boot_image = true;
        magic_header = Some("ANDROID! (Android Boot Image)".to_string());
        confidence = "magic_bytes";
        let name_guess = detect_partition_from_name(file_name);
        detected_partition = Some(match name_guess {
            Some("recovery") => "recovery",
            Some("init_boot") => "init_boot",
            _ => "boot",
        });
    } else if header_bytes.len() >= 8 && &header_bytes[..8] == ANDROID_VENDOR_BOOT_MAGIC {
        is_boot_image = true;
        magic_header = Some("VNDRBOOT (Vendor Boot Image)".to_string());
        confidence = "magic_bytes";
        detected_partition = Some("vendor_boot");
    } else if header_bytes.len() >= 4 && &header_bytes[..4] == ANDROID_SPARSE_MAGIC {
        is_sparse = true;
        magic_header = Some("0x3AFF26ED (Android Sparse Image)".to_string());
        confidence = "magic_bytes";
        let name_guess = detect_partition_from_name(file_name);
        detected_partition = Some(name_guess.unwrap_or("super"));
    } else if header_bytes.len() >= 4 && &header_bytes[..4] == AVB0_MAGIC {
        is_avb = true;
        magic_header = Some("AVB0 (Android Verified Boot Header)".to_string());
        confidence = "magic_bytes";
        let name_guess = detect_partition_from_name(file_name);
        detected_partition = Some(match name_guess {
            Some("vbmeta_system") => "vbmeta_system",
            Some("vbmeta_vendor") => "vbmeta_vendor",
            _ => "vbmeta",
        });
    } else if header_bytes.len() >= 4
        && (&header_bytes[..4] == DTBO_MAGIC_BE || &header_bytes[..4] == DTBO_MAGIC_LE)
    {
        is_dtbo = true;
        magic_header = Some("0xD00DFEED (Device Tree Blob / DTBO)".to_string());
        confidence = "magic_bytes";
        detected_partition = Some("dtbo");
    } else if header_bytes.len() >= 1082 && &header_bytes[1080..1082] == EXT4_MAGIC {
        magic_header = Some("0xEF53 (ext4 File System)".to_string());
        confidence = "magic_bytes";
        let name_guess = detect_partition_from_name(file_name);
        detected_partition = Some(name_guess.unwrap_or("system"));
    }

    if detected_partition.is_none()
        && let Some(from_name) = detect_partition_from_name(file_name)
    {
        detected_partition = Some(from_name);
        confidence = "filename_heuristic";
    }

    let final_partition = detected_partition.unwrap_or("unknown").to_string();
    let risk_level = get_partition_risk_level(&final_partition).to_string();
    let recommended_slot_aware = is_partition_slot_aware(&final_partition);
    let description = get_partition_description(&final_partition).to_string();

    PartitionTargetInfo {
        file_path: file_path.to_string(),
        file_name: file_name.to_string(),
        file_size,
        detected_partition: final_partition,
        confidence: confidence.to_string(),
        magic_header,
        is_sparse,
        is_boot_image,
        is_avb,
        is_dtbo,
        recommended_slot_aware,
        risk_level,
        description,
    }
}

pub fn inspect_partition_image(file_path: &Path) -> CmdResult<PartitionTargetInfo> {
    let file_path_str = file_path.to_string_lossy().to_string();
    let file_name = file_path
        .file_name()
        .map_or_else(|| "image.img".to_string(), |f| f.to_string_lossy().to_string());

    let mut file = File::open(file_path)
        .map_err(|e| format!("Failed to open image file '{}': {}", file_path.display(), e))?;

    let file_size = file.metadata().map_or(0, |m| m.len());

    let mut buffer = vec![0u8; 4096];
    let bytes_read = file
        .read(&mut buffer)
        .map_err(|e| format!("Failed to read header from '{}': {}", file_path.display(), e))?;
    buffer.truncate(bytes_read);

    debug!("Inspected image {} (read {} bytes for magic sniffing)", file_name, bytes_read);

    Ok(inspect_partition_image_bytes(&buffer, &file_name, file_size, &file_path_str))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sniff_android_boot_magic() {
        let mut data = vec![0u8; 2048];
        data[..8].copy_from_slice(b"ANDROID!");
        let info = inspect_partition_image_bytes(
            &data,
            "my_custom_kernel.bin",
            67108864,
            "/tmp/my_custom_kernel.bin",
        );
        assert_eq!(info.detected_partition, "boot");
        assert_eq!(info.confidence, "magic_bytes");
        assert!(info.is_boot_image);
        assert_eq!(info.risk_level, "elevated");
    }

    #[test]
    fn test_sniff_sparse_magic() {
        let mut data = vec![0u8; 2048];
        data[..4].copy_from_slice(&[0x3A, 0xFF, 0x26, 0xED]);
        let info = inspect_partition_image_bytes(&data, "super.raw", 4294967296, "/tmp/super.raw");
        assert_eq!(info.detected_partition, "super");
        assert_eq!(info.confidence, "magic_bytes");
        assert!(info.is_sparse);
        assert_eq!(info.risk_level, "critical");
    }

    #[test]
    fn test_sniff_avb0_magic() {
        let mut data = vec![0u8; 2048];
        data[..4].copy_from_slice(b"AVB0");
        let info = inspect_partition_image_bytes(&data, "vbmeta.img", 65536, "/tmp/vbmeta.img");
        assert_eq!(info.detected_partition, "vbmeta");
        assert_eq!(info.confidence, "magic_bytes");
        assert!(info.is_avb);
        assert_eq!(info.risk_level, "critical");
    }

    #[test]
    fn test_sniff_dtbo_magic() {
        let mut data = vec![0u8; 2048];
        data[..4].copy_from_slice(&[0xD0, 0x0D, 0xFE, 0xED]);
        let info = inspect_partition_image_bytes(&data, "dtbo_a.img", 8388608, "/tmp/dtbo_a.img");
        assert_eq!(info.detected_partition, "dtbo");
        assert_eq!(info.confidence, "magic_bytes");
        assert!(info.is_dtbo);
        assert_eq!(info.risk_level, "standard");
    }

    #[test]
    fn test_filename_heuristic_fallback() {
        let data = vec![0u8; 2048]; // all zeros, no magic
        let info = inspect_partition_image_bytes(
            &data,
            "vendor_boot.img",
            33554432,
            "/tmp/vendor_boot.img",
        );
        assert_eq!(info.detected_partition, "vendor_boot");
        assert_eq!(info.confidence, "filename_heuristic");
        assert_eq!(info.risk_level, "standard");
    }
}
