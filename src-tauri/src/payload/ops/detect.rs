//! Format detection for OPS, OFP-QC, OFP-MTK, and ZIP-wrapped OFP files.

use anyhow::{Result, bail};

/// Detected firmware container format.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FirmwareFormat {
    /// Standard Android OTA payload (CrAU header)
    PayloadBin,
    /// OnePlus .ops encrypted container
    Ops,
    /// Oppo .ofp Qualcomm variant
    OfpQualcomm,
    /// Oppo .ofp MediaTek variant
    OfpMediaTek,
    /// ZIP-wrapped OFP (password-protected)
    ZipOfp,
}

impl FirmwareFormat {
    pub fn label(&self) -> &'static str {
        match self {
            Self::PayloadBin => "Android OTA (payload.bin)",
            Self::Ops => "OnePlus OPS",
            Self::OfpQualcomm => "Oppo OFP (Qualcomm)",
            Self::OfpMediaTek => "Oppo OFP (MediaTek)",
            Self::ZipOfp => "Oppo OFP (ZIP-wrapped)",
        }
    }
}

/// Detect the firmware format of a file from its contents.
///
/// Detection strategy (ordered by specificity):
/// 1. `"CrAU"` magic at offset 0 → `PayloadBin`
/// 2. `"PK"` magic at offset 0 → `ZipOfp` (password-protected ZIP)
/// 3. `0x7CEF` magic at footer → `Ops` or `OfpQualcomm` (sub-detection needed later)
/// 4. Try MTK brute-force → `OfpMediaTek`
/// 5. Otherwise → error
pub fn detect_format(data: &[u8]) -> Result<FirmwareFormat> {
    let file_size = data.len();

    if file_size < 4 {
        bail!("File too small to identify format ({file_size} bytes)");
    }

    // 1. CrAU magic at offset 0
    if data[..4] == *b"CrAU" {
        return Ok(FirmwareFormat::PayloadBin);
    }

    // 2. ZIP (PK) magic at offset 0
    if data[..2] == *b"PK" {
        return Ok(FirmwareFormat::ZipOfp);
    }

    // 3. Check for 0x7CEF magic in footer
    // OPS/OFP-QC both use 0x7CEF at specific footer offsets
    if file_size >= 0x200 {
        // OPS: magic at filesize - 0x200 + 0x10
        let footer_offset = file_size - 0x200;
        if footer_offset + 0x14 <= file_size {
            let magic = u32::from_le_bytes(
                data[footer_offset + 0x10..footer_offset + 0x14]
                    .try_into()
                    .unwrap_or([0; 4]),
            );
            if magic == super::OPS_MAGIC {
                // Could be OPS or OFP-QC with pagesize=0x200
                // Differentiated later by XML decryption attempt
                return Ok(FirmwareFormat::Ops);
            }
        }
    }

    // 4. Also check for 0x7CEF with pagesize=0x1000 (OFP-QC variant)
    if file_size >= 0x1000 {
        let footer_offset = file_size - 0x1000;
        if footer_offset + 0x14 <= file_size {
            let magic = u32::from_le_bytes(
                data[footer_offset + 0x10..footer_offset + 0x14]
                    .try_into()
                    .unwrap_or([0; 4]),
            );
            if magic == super::OPS_MAGIC {
                return Ok(FirmwareFormat::OfpQualcomm);
            }
        }
    }

    // 5. Try MTK detection: brute-force first 16 bytes with known keys
    // If AES-CFB decrypt produces "MMM" prefix, it's MTK
    if file_size >= 0x6C + 16 {
        if super::ofp_mtk::detect_mtk(data) {
            return Ok(FirmwareFormat::OfpMediaTek);
        }
    }

    bail!(
        "Unrecognized firmware format. Expected CrAU (payload.bin), OPS, OFP, or ZIP container."
    )
}

/// Check if a file path has an OPS/OFP extension.
pub fn is_ops_or_ofp_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| {
            ext.eq_ignore_ascii_case("ops") || ext.eq_ignore_ascii_case("ofp")
        })
}
