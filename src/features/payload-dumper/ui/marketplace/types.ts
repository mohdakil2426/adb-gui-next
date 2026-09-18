import type { backend } from "@/desktop/models";

export type FirmwareBrand = backend.FirmwareBrand;
export type BrandFilter = "all" | FirmwareBrand;
export type FirmwareImageType = backend.FirmwareImageType;
export type FirmwareBuild = backend.FirmwareBuild;
export type FirmwareDeviceModel = backend.FirmwareDeviceModel;

export interface BrandMetadata {
  description: string;
  displayName: string;
  icon?: string;
  id: FirmwareBrand;
  portalName: string;
  portalUrl: string;
  shortLabel: string;
}

export const BRAND_DISPLAY_INFO: Record<FirmwareBrand, BrandMetadata> = {
  google: {
    description: "Official Google Pixel firmware builds with verified OTA payloads.",
    displayName: "Google Pixel",
    id: "google",
    portalName: "Google Pixel OTA Portal",
    portalUrl: "https://developers.google.com/android/ota",
    shortLabel: "Pixel",
  },
  nothing: {
    description:
      "Nothing OS & CMF by Nothing official firmware builds, OTA updates, and image packages.",
    displayName: "Nothing",
    id: "nothing",
    portalName: "Nothing OS Firmware Archive",
    portalUrl: "https://nothingarchive.tech/docs/firmware",
    shortLabel: "Nothing",
  },
  oneplus: {
    description: "OxygenOS & ColorOS full firmware payloads and OTA updates.",
    displayName: "OnePlus",
    id: "oneplus",
    portalName: "OnePlus Software Portal",
    portalUrl: "https://service.oneplus.com",
    shortLabel: "OnePlus",
  },
  samsung: {
    description: "Samsung Galaxy official multi-file (AP/BL/CP/CSC) firmware packages.",
    displayName: "Samsung",
    id: "samsung",
    portalName: "Samsung Firmware Portal",
    portalUrl: "https://samfw.com",
    shortLabel: "Samsung",
  },
  xiaomi: {
    description:
      "Xiaomi, Redmi, and POCO official HyperOS & MIUI recovery ROMs and fastboot image archives.",
    displayName: "Xiaomi",
    id: "xiaomi",
    portalName: "XM Firmware Updater Portal",
    portalUrl: "https://xmfirmwareupdater.com",
    shortLabel: "Xiaomi",
  },
};

// Legacy types for backwards-compatibility
export type PixelFirmwareBuild = FirmwareBuild;
export type PixelDeviceModel = FirmwareDeviceModel;

export const formatCleanDeviceName = (name: string): string => {
  let cleaned = name.trim();
  const forIdx = cleaned.indexOf(" for ");
  if (forIdx !== -1) {
    cleaned = cleaned.slice(forIdx + 5).trim();
  }
  cleaned = cleaned.replaceAll(/["'“”‘’]/gu, "").trim();
  return cleaned || name;
};
