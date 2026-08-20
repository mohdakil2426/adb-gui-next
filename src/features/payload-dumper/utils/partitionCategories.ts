export type PartitionCategory = 'boot' | 'system' | 'modem' | 'other';

const BOOT_PARTITIONS: Record<string, true> = {
  abl: true,
  boot: true,
  boot_a: true,
  boot_b: true,
  bootloader: true,
  dtbo: true,
  dtbo_a: true,
  dtbo_b: true,
  init_boot: true,
  init_boot_a: true,
  init_boot_b: true,
  pvmfw: true,
  recovery: true,
  recovery_a: true,
  recovery_b: true,
  vbmeta: true,
  vbmeta_a: true,
  vbmeta_b: true,
  vbmeta_system: true,
  vbmeta_vendor: true,
  vendor_boot: true,
  vendor_boot_a: true,
  vendor_boot_b: true,
  vendor_kernel_boot: true,
};

const SYSTEM_PARTITIONS: Record<string, true> = {
  apex: true,
  cust: true,
  mi_ext: true,
  odm: true,
  odm_a: true,
  odm_b: true,
  odm_dlkm: true,
  odm_dlkm_a: true,
  odm_dlkm_b: true,
  oem: true,
  product: true,
  product_a: true,
  product_b: true,
  super: true,
  system: true,
  system_a: true,
  system_b: true,
  system_dlkm: true,
  system_dlkm_a: true,
  system_dlkm_b: true,
  system_ext: true,
  system_ext_a: true,
  system_ext_b: true,
  vendor: true,
  vendor_a: true,
  vendor_b: true,
  vendor_dlkm: true,
  vendor_dlkm_a: true,
  vendor_dlkm_b: true,
};

const MODEM_PARTITIONS: Record<string, true> = {
  bluetooth: true,
  bluetooth_a: true,
  bluetooth_b: true,
  cmnlib: true,
  cmnlib64: true,
  cpucp: true,
  devcfg: true,
  devinfo: true,
  dsp: true,
  dsp_a: true,
  dsp_b: true,
  featenabler: true,
  hyp: true,
  hyp_a: true,
  hyp_b: true,
  imagefv: true,
  keymaster: true,
  keymaster_a: true,
  keymaster_b: true,
  mdtp: true,
  mdtpsecapp: true,
  modem: true,
  modem_a: true,
  modem_b: true,
  qupfw: true,
  qupfw_a: true,
  qupfw_b: true,
  radio: true,
  radio_a: true,
  radio_b: true,
  sec: true,
  spunvm: true,
  storsec: true,
  tz: true,
  tz_a: true,
  tz_b: true,
  uefi: true,
  xbl: true,
  xbl_a: true,
  xbl_b: true,
  xbl_config: true,
  xbl_config_a: true,
  xbl_config_b: true,
};

export const CATEGORY_DOT_CLASSES: Record<PartitionCategory, string> = {
  boot: 'bg-chart-1',
  modem: 'bg-chart-3',
  other: 'bg-chart-4',
  system: 'bg-chart-2',
};

export function getPartitionCategory(name: string): PartitionCategory {
  const normalized = name.toLowerCase().trim();
  if (BOOT_PARTITIONS[normalized]) {
    return 'boot';
  }
  if (SYSTEM_PARTITIONS[normalized]) {
    return 'system';
  }
  if (MODEM_PARTITIONS[normalized]) {
    return 'modem';
  }
  return 'other';
}

export function detectPayloadFormat(
  pathOrUrl: string,
  isZip?: boolean,
  isRemote?: boolean,
): { label: string; type: 'bin' | 'zip' | 'ops' | 'ofp' | 'url' } {
  if (!pathOrUrl) {
    return { label: 'Standby', type: 'bin' };
  }
  const lower = pathOrUrl.toLowerCase();
  if (lower.endsWith('.ops')) {
    return { label: 'OnePlus OPS Firmware', type: 'ops' };
  }
  if (lower.endsWith('.ofp')) {
    return { label: 'Oppo/Realme OFP Firmware', type: 'ofp' };
  }
  if (lower.endsWith('.zip') || isZip) {
    return { label: isRemote ? 'Remote OTA ZIP' : 'Factory / OTA ZIP', type: 'zip' };
  }
  if (lower.includes('payload.bin') || lower.endsWith('.bin')) {
    return { label: 'Standard payload.bin', type: 'bin' };
  }
  if (isRemote || lower.startsWith('http://') || lower.startsWith('https://')) {
    return { label: 'Remote OTA Stream', type: 'url' };
  }
  return { label: 'payload.bin', type: 'bin' };
}
