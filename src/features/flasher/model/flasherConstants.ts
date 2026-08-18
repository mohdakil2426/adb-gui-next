export const COMMON_PARTITIONS = [
  'boot',
  'vendor_boot',
  'init_boot',
  'recovery',
  'dtbo',
  'vbmeta',
  'vbmeta_system',
  'vbmeta_vendor',
  'system',
  'vendor',
  'product',
  'system_ext',
  'odm',
  'super',
  'modem',
  'radio',
  'bluetooth',
  'dsp',
  'persist',
  'metadata',
  'cache',
  'userdata',
] as const;

export interface PartitionPresetGroup {
  description: string;
  id: string;
  label: string;
  partitions: string[];
}

export const PARTITION_PRESET_GROUPS: PartitionPresetGroup[] = [
  {
    id: 'boot',
    label: 'Boot & Kernel',
    description: 'Core kernel, init ramdisk, and device tree binaries',
    partitions: ['boot', 'init_boot', 'vendor_boot', 'dtbo'],
  },
  {
    id: 'recovery',
    label: 'Recovery & AVB',
    description: 'Android Verified Boot and recovery images',
    partitions: ['recovery', 'vbmeta', 'vbmeta_system', 'vbmeta_vendor'],
  },
  {
    id: 'system',
    label: 'System & Dynamic',
    description: 'Logical OS partitions and super container',
    partitions: ['super', 'system', 'vendor', 'product', 'system_ext', 'odm'],
  },
  {
    id: 'radio',
    label: 'Radio & Modem',
    description: 'Baseband cellular, Bluetooth, and DSP firmware',
    partitions: ['radio', 'modem', 'bluetooth', 'dsp', 'persist'],
  },
  {
    id: 'all',
    label: 'All Partitions',
    description: 'Complete list of recognized Android fastboot partitions',
    partitions: [...COMMON_PARTITIONS],
  },
];

export const FILENAME_TO_PARTITION_MAP: Record<string, string> = {
  'boot.img': 'boot',
  'boot_a.img': 'boot',
  'boot_b.img': 'boot',
  'init_boot.img': 'init_boot',
  'init_boot_a.img': 'init_boot',
  'init_boot_b.img': 'init_boot',
  'vendor_boot.img': 'vendor_boot',
  'vendor_boot_a.img': 'vendor_boot',
  'vendor_boot_b.img': 'vendor_boot',
  'recovery.img': 'recovery',
  'recovery_a.img': 'recovery',
  'recovery_b.img': 'recovery',
  'dtbo.img': 'dtbo',
  'dtbo_a.img': 'dtbo',
  'dtbo_b.img': 'dtbo',
  'vbmeta.img': 'vbmeta',
  'vbmeta_a.img': 'vbmeta',
  'vbmeta_b.img': 'vbmeta',
  'vbmeta_system.img': 'vbmeta_system',
  'vbmeta_vendor.img': 'vbmeta_vendor',
  'super.img': 'super',
  'system.img': 'system',
  'vendor.img': 'vendor',
  'product.img': 'product',
  'system_ext.img': 'system_ext',
  'odm.img': 'odm',
  'radio.img': 'radio',
  'modem.img': 'modem',
  'persist.img': 'persist',
  'metadata.img': 'metadata',
  'userdata.img': 'userdata',
};

export function detectPartitionFromFilename(fileName: string): string | null {
  const normalized = fileName.toLowerCase().trim();
  if (FILENAME_TO_PARTITION_MAP[normalized]) {
    return FILENAME_TO_PARTITION_MAP[normalized];
  }

  // Fallback: strip extension and check if base matches any common partition
  const base = normalized.replace(/\.(img|bin)$/i, '').replace(/_[ab]$/i, '');
  if ((COMMON_PARTITIONS as readonly string[]).includes(base)) {
    return base;
  }

  return null;
}

export interface PartitionMeta {
  category: 'kernel' | 'avb' | 'dynamic' | 'firmware' | 'storage';
  description: string;
  isSlotted: boolean;
  name: string;
  riskLevel: 'standard' | 'elevated' | 'critical';
}

export const PARTITION_METADATA: Record<string, PartitionMeta> = {
  boot: {
    name: 'boot',
    category: 'kernel',
    description: 'Linux kernel, ramdisk, and early boot stages.',
    isSlotted: true,
    riskLevel: 'standard',
  },
  init_boot: {
    name: 'init_boot',
    category: 'kernel',
    description: 'Generic Ramdisk for Android 13+ GKI devices (Magisk root target).',
    isSlotted: true,
    riskLevel: 'standard',
  },
  vendor_boot: {
    name: 'vendor_boot',
    category: 'kernel',
    description: 'Vendor-specific ramdisk, kernel modules, and device-tree parameters.',
    isSlotted: true,
    riskLevel: 'standard',
  },
  dtbo: {
    name: 'dtbo',
    category: 'kernel',
    description: 'Device Tree Blob Overlay for board hardware pinmux and peripherals.',
    isSlotted: true,
    riskLevel: 'standard',
  },
  vbmeta: {
    name: 'vbmeta',
    category: 'avb',
    description: 'Android Verified Boot 2.0 cryptographic hashes and root certificate.',
    isSlotted: true,
    riskLevel: 'critical',
  },
  vbmeta_system: {
    name: 'vbmeta_system',
    category: 'avb',
    description: 'AVB chained validation for system dynamic partition.',
    isSlotted: true,
    riskLevel: 'elevated',
  },
  vbmeta_vendor: {
    name: 'vbmeta_vendor',
    category: 'avb',
    description: 'AVB chained validation for vendor partition.',
    isSlotted: true,
    riskLevel: 'elevated',
  },
  recovery: {
    name: 'recovery',
    category: 'kernel',
    description: 'Dedicated AOSP or Custom Recovery environment (TWRP / Lineage).',
    isSlotted: true,
    riskLevel: 'standard',
  },
  super: {
    name: 'super',
    category: 'dynamic',
    description: 'Dynamic partition container holding system, vendor, product & odm.',
    isSlotted: false,
    riskLevel: 'critical',
  },
  system: {
    name: 'system',
    category: 'dynamic',
    description: 'Android OS framework, system apps, runtime, and libraries.',
    isSlotted: true,
    riskLevel: 'elevated',
  },
  vendor: {
    name: 'vendor',
    category: 'dynamic',
    description: 'SoC HALs, hardware-specific drivers, and proprietary services.',
    isSlotted: true,
    riskLevel: 'elevated',
  },
  product: {
    name: 'product',
    category: 'dynamic',
    description: 'OEM customizations, manufacturer apps, and branding.',
    isSlotted: true,
    riskLevel: 'standard',
  },
  system_ext: {
    name: 'system_ext',
    category: 'dynamic',
    description: 'Extended Android framework services and vendor integrations.',
    isSlotted: true,
    riskLevel: 'standard',
  },
  odm: {
    name: 'odm',
    category: 'dynamic',
    description: 'Original Design Manufacturer custom drivers and board configurations.',
    isSlotted: true,
    riskLevel: 'standard',
  },
  radio: {
    name: 'radio',
    category: 'firmware',
    description: 'Cellular baseband modem firmware and SIM radio controller.',
    isSlotted: true,
    riskLevel: 'critical',
  },
  modem: {
    name: 'modem',
    category: 'firmware',
    description: 'Modem DSP and cellular protocol firmware stack.',
    isSlotted: true,
    riskLevel: 'critical',
  },
  bluetooth: {
    name: 'bluetooth',
    category: 'firmware',
    description: 'Bluetooth stack and controller microcode.',
    isSlotted: true,
    riskLevel: 'standard',
  },
  dsp: {
    name: 'dsp',
    category: 'firmware',
    description: 'Hexagon / Sensor processing DSP subsystem firmware.',
    isSlotted: true,
    riskLevel: 'standard',
  },
  persist: {
    name: 'persist',
    category: 'firmware',
    description: 'Device calibration, sensor trim data, and DRM device certificates.',
    isSlotted: false,
    riskLevel: 'critical',
  },
  userdata: {
    name: 'userdata',
    category: 'storage',
    description: 'User applications, files, settings, and FBE encrypted keystore.',
    isSlotted: false,
    riskLevel: 'critical',
  },
  cache: {
    name: 'cache',
    category: 'storage',
    description: 'Temporary OTA download cache and log buffers.',
    isSlotted: false,
    riskLevel: 'standard',
  },
  metadata: {
    name: 'metadata',
    category: 'storage',
    description: 'File-based encryption keys and OTA rollback index metadata.',
    isSlotted: false,
    riskLevel: 'critical',
  },
};
