import type { backend } from '@/desktop/models';

export type FirmwareBrand = backend.FirmwareBrand;
export type BrandFilter = 'all' | FirmwareBrand;
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
    id: 'google',
    displayName: 'Google Pixel',
    shortLabel: 'Pixel',
    description: 'Official Google Pixel firmware builds with verified OTA payloads.',
    portalUrl: 'https://developers.google.com/android/ota',
    portalName: 'Google Pixel OTA Portal',
  },
  nothing: {
    id: 'nothing',
    displayName: 'Nothing',
    shortLabel: 'Nothing',
    description:
      'Nothing OS & CMF by Nothing official firmware builds, OTA updates, and image packages.',
    portalUrl: 'https://nothingarchive.tech/docs/firmware',
    portalName: 'Nothing OS Firmware Archive',
  },
  xiaomi: {
    id: 'xiaomi',
    displayName: 'Xiaomi',
    shortLabel: 'Xiaomi',
    description: 'HyperOS & MIUI official recovery and fastboot ROM catalogs.',
    portalUrl: 'https://miuirom.org',
    portalName: 'Xiaomi HyperOS Archive',
  },
  oneplus: {
    id: 'oneplus',
    displayName: 'OnePlus',
    shortLabel: 'OnePlus',
    description: 'OxygenOS & ColorOS full firmware payloads and OTA updates.',
    portalUrl: 'https://service.oneplus.com',
    portalName: 'OnePlus Software Portal',
  },
  samsung: {
    id: 'samsung',
    displayName: 'Samsung',
    shortLabel: 'Samsung',
    description: 'Samsung Galaxy official multi-file (AP/BL/CP/CSC) firmware packages.',
    portalUrl: 'https://samfw.com',
    portalName: 'Samsung Firmware Portal',
  },
};

// Legacy types for backwards-compatibility
export type PixelFirmwareBuild = FirmwareBuild;
export type PixelDeviceModel = FirmwareDeviceModel;

export function formatCleanDeviceName(name: string): string {
  let cleaned = name.trim();
  const forIdx = cleaned.indexOf(' for ');
  if (forIdx !== -1) {
    cleaned = cleaned.slice(forIdx + 5).trim();
  }
  cleaned = cleaned.replace(/["'“”‘’]/g, '').trim();
  return cleaned || name;
}
