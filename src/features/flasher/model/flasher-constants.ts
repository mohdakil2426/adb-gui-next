export const COMMON_PARTITIONS = [
  "boot",
  "vendor_boot",
  "init_boot",
  "recovery",
  "dtbo",
  "vbmeta",
  "vbmeta_system",
  "vbmeta_vendor",
  "system",
  "vendor",
  "product",
  "system_ext",
  "odm",
  "super",
  "modem",
  "radio",
  "bluetooth",
  "dsp",
  "persist",
  "metadata",
  "cache",
  "userdata",
] as const;

export interface PartitionPresetGroup {
  description: string;
  id: string;
  label: string;
  partitions: string[];
}

export const PARTITION_PRESET_GROUPS: PartitionPresetGroup[] = [
  {
    description: "Core kernel, init ramdisk, and device tree binaries",
    id: "boot",
    label: "Boot & Kernel",
    partitions: ["boot", "init_boot", "vendor_boot", "dtbo"],
  },
  {
    description: "Android Verified Boot and recovery images",
    id: "recovery",
    label: "Recovery & AVB",
    partitions: ["recovery", "vbmeta", "vbmeta_system", "vbmeta_vendor"],
  },
  {
    description: "Logical OS partitions and super container",
    id: "system",
    label: "System & Dynamic",
    partitions: ["super", "system", "vendor", "product", "system_ext", "odm"],
  },
  {
    description: "Baseband cellular, Bluetooth, and DSP firmware",
    id: "radio",
    label: "Radio & Modem",
    partitions: ["radio", "modem", "bluetooth", "dsp", "persist"],
  },
  {
    description: "Complete list of recognized Android fastboot partitions",
    id: "all",
    label: "All Partitions",
    partitions: [...COMMON_PARTITIONS],
  },
];

export const FILENAME_TO_PARTITION_MAP: Record<string, string> = {
  "boot.img": "boot",
  "boot_a.img": "boot",
  "boot_b.img": "boot",
  "dtbo.img": "dtbo",
  "dtbo_a.img": "dtbo",
  "dtbo_b.img": "dtbo",
  "init_boot.img": "init_boot",
  "init_boot_a.img": "init_boot",
  "init_boot_b.img": "init_boot",
  "metadata.img": "metadata",
  "modem.img": "modem",
  "odm.img": "odm",
  "persist.img": "persist",
  "product.img": "product",
  "radio.img": "radio",
  "recovery.img": "recovery",
  "recovery_a.img": "recovery",
  "recovery_b.img": "recovery",
  "super.img": "super",
  "system.img": "system",
  "system_ext.img": "system_ext",
  "userdata.img": "userdata",
  "vbmeta.img": "vbmeta",
  "vbmeta_a.img": "vbmeta",
  "vbmeta_b.img": "vbmeta",
  "vbmeta_system.img": "vbmeta_system",
  "vbmeta_vendor.img": "vbmeta_vendor",
  "vendor.img": "vendor",
  "vendor_boot.img": "vendor_boot",
  "vendor_boot_a.img": "vendor_boot",
  "vendor_boot_b.img": "vendor_boot",
};

export const detectPartitionFromFilename = (fileName: string): string | null => {
  const normalized = fileName.toLowerCase().trim();
  if (FILENAME_TO_PARTITION_MAP[normalized]) {
    return FILENAME_TO_PARTITION_MAP[normalized];
  }

  // Fallback: strip extension and check if base matches any common partition
  const base = normalized.replace(/\.(img|bin)$/iu, "").replace(/_[ab]$/iu, "");
  if ((COMMON_PARTITIONS as readonly string[]).includes(base)) {
    return base;
  }

  return null;
};

export interface PartitionMeta {
  category: "kernel" | "avb" | "dynamic" | "firmware" | "storage";
  description: string;
  isSlotted: boolean;
  name: string;
  riskLevel: "standard" | "elevated" | "critical";
}

export const PARTITION_METADATA: Record<string, PartitionMeta> = {
  bluetooth: {
    category: "firmware",
    description: "Bluetooth stack and controller microcode.",
    isSlotted: true,
    name: "bluetooth",
    riskLevel: "standard",
  },
  boot: {
    category: "kernel",
    description: "Linux kernel, ramdisk, and early boot stages.",
    isSlotted: true,
    name: "boot",
    riskLevel: "standard",
  },
  cache: {
    category: "storage",
    description: "Temporary OTA download cache and log buffers.",
    isSlotted: false,
    name: "cache",
    riskLevel: "standard",
  },
  dsp: {
    category: "firmware",
    description: "Hexagon / Sensor processing DSP subsystem firmware.",
    isSlotted: true,
    name: "dsp",
    riskLevel: "standard",
  },
  dtbo: {
    category: "kernel",
    description: "Device Tree Blob Overlay for board hardware pinmux and peripherals.",
    isSlotted: true,
    name: "dtbo",
    riskLevel: "standard",
  },
  init_boot: {
    category: "kernel",
    description: "Generic Ramdisk for Android 13+ GKI devices (Magisk root target).",
    isSlotted: true,
    name: "init_boot",
    riskLevel: "standard",
  },
  metadata: {
    category: "storage",
    description: "File-based encryption keys and OTA rollback index metadata.",
    isSlotted: false,
    name: "metadata",
    riskLevel: "critical",
  },
  modem: {
    category: "firmware",
    description: "Modem DSP and cellular protocol firmware stack.",
    isSlotted: true,
    name: "modem",
    riskLevel: "critical",
  },
  odm: {
    category: "dynamic",
    description: "Original Design Manufacturer custom drivers and board configurations.",
    isSlotted: true,
    name: "odm",
    riskLevel: "standard",
  },
  persist: {
    category: "firmware",
    description: "Device calibration, sensor trim data, and DRM device certificates.",
    isSlotted: false,
    name: "persist",
    riskLevel: "critical",
  },
  product: {
    category: "dynamic",
    description: "OEM customizations, manufacturer apps, and branding.",
    isSlotted: true,
    name: "product",
    riskLevel: "standard",
  },
  radio: {
    category: "firmware",
    description: "Cellular baseband modem firmware and SIM radio controller.",
    isSlotted: true,
    name: "radio",
    riskLevel: "critical",
  },
  recovery: {
    category: "kernel",
    description: "Dedicated AOSP or Custom Recovery environment (TWRP / Lineage).",
    isSlotted: true,
    name: "recovery",
    riskLevel: "standard",
  },
  super: {
    category: "dynamic",
    description: "Dynamic partition container holding system, vendor, product & odm.",
    isSlotted: false,
    name: "super",
    riskLevel: "critical",
  },
  system: {
    category: "dynamic",
    description: "Android OS framework, system apps, runtime, and libraries.",
    isSlotted: true,
    name: "system",
    riskLevel: "elevated",
  },
  system_ext: {
    category: "dynamic",
    description: "Extended Android framework services and vendor integrations.",
    isSlotted: true,
    name: "system_ext",
    riskLevel: "standard",
  },
  userdata: {
    category: "storage",
    description: "User applications, files, settings, and FBE encrypted keystore.",
    isSlotted: false,
    name: "userdata",
    riskLevel: "critical",
  },
  vbmeta: {
    category: "avb",
    description: "Android Verified Boot 2.0 cryptographic hashes and root certificate.",
    isSlotted: true,
    name: "vbmeta",
    riskLevel: "critical",
  },
  vbmeta_system: {
    category: "avb",
    description: "AVB chained validation for system dynamic partition.",
    isSlotted: true,
    name: "vbmeta_system",
    riskLevel: "elevated",
  },
  vbmeta_vendor: {
    category: "avb",
    description: "AVB chained validation for vendor partition.",
    isSlotted: true,
    name: "vbmeta_vendor",
    riskLevel: "elevated",
  },
  vendor: {
    category: "dynamic",
    description: "SoC HALs, hardware-specific drivers, and proprietary services.",
    isSlotted: true,
    name: "vendor",
    riskLevel: "elevated",
  },
  vendor_boot: {
    category: "kernel",
    description: "Vendor-specific ramdisk, kernel modules, and device-tree parameters.",
    isSlotted: true,
    name: "vendor_boot",
    riskLevel: "standard",
  },
};
