import type { backend } from '@/desktop/models';

export interface AvdHardwareDetails {
  androidVersion: string;
  apiLabel: string;
  architecture: string;
  bootModeLabel: string;
  cameraInfo: string;
  densityDpi: number;
  densityLabel: string;
  diskDataSize: string;
  diskSdcardSize: string;
  diskSnapshotSize: string;
  diskSystemSize: string;
  graphicsEngine: string;
  hypervisor: string;
  networkProfile: string;
  ramAllocationMb: number;
  resolution: string;
  rootStatusLabel: string;
  vCpuCores: number;
}

const ANDROID_VERSIONS: Record<number, string> = {
  35: 'Android 15.0',
  34: 'Android 14.0',
  33: 'Android 13.0',
  32: 'Android 12L',
  31: 'Android 12.0',
  30: 'Android 11.0',
  29: 'Android 10.0',
  28: 'Android 9.0 (Pie)',
  27: 'Android 8.1 (Oreo)',
  26: 'Android 8.0 (Oreo)',
  25: 'Android 7.1.1 (Nougat)',
  24: 'Android 7.0 (Nougat)',
  23: 'Android 6.0 (Marshmallow)',
  22: 'Android 5.1 (Lollipop)',
  21: 'Android 5.0 (Lollipop)',
};

export function getAndroidVersionName(apiLevel: number | null): string {
  if (apiLevel === null || apiLevel === undefined) {
    return 'Android';
  }
  return ANDROID_VERSIONS[apiLevel] ?? `Android (API ${apiLevel})`;
}

export function getAvdRootStateLabel(state: backend.AvdRootState): string {
  switch (state) {
    case 'rooted':
      return 'Magisk Rooted';
    case 'modified':
      return 'Modified (Patched)';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Stock (Pristine)';
  }
}

export function getAvdBootModeLabel(mode: backend.EmulatorBootMode, isRunning: boolean): string {
  if (!isRunning) {
    return 'Offline';
  }
  switch (mode) {
    case 'cold':
      return 'Cold Boot (Clean)';
    case 'normal':
      return 'Quick Boot Snapshot';
    default:
      return 'Running (Active)';
  }
}

export function deriveAvdHardwareDetails(avd: backend.AvdSummary | null): AvdHardwareDetails {
  if (!avd) {
    return {
      androidVersion: 'Android',
      apiLabel: 'API —',
      architecture: 'x86_64',
      resolution: '1080×2400',
      densityLabel: '420 dpi (xxhdpi)',
      densityDpi: 420,
      ramAllocationMb: 4096,
      vCpuCores: 4,
      graphicsEngine: 'Host GPU (ANGLE Direct3D11)',
      hypervisor: 'WHPX / KVM Accelerated',
      networkProfile: 'Full Speed · LTE Latency (<20ms)',
      cameraInfo: 'Back: VirtualScene · Front: Webcam0',
      diskSystemSize: '2.8 GB',
      diskDataSize: '6.0 GB',
      diskSnapshotSize: '1.2 GB',
      diskSdcardSize: '512 MB',
      rootStatusLabel: 'Stock (Pristine)',
      bootModeLabel: 'Offline',
    };
  }

  const isArm = avd.abi?.includes('arm') || avd.abi?.includes('aarch64');
  const isTablet =
    avd.deviceName?.toLowerCase().includes('tablet') || avd.name.toLowerCase().includes('tablet');

  const resolution = isTablet ? '2560×1600 (16:10)' : '1080×2400 (20:9)';
  const densityDpi = isTablet ? 320 : 420;
  const densityLabel = isTablet ? '320 dpi (xhdpi)' : '420 dpi (xxhdpi)';
  const ramMb = (avd.apiLevel ?? 30) >= 33 ? 4096 : 2048;
  const cores = (avd.apiLevel ?? 30) >= 33 ? 4 : 2;

  return {
    androidVersion: getAndroidVersionName(avd.apiLevel),
    apiLabel: avd.apiLevel === null ? 'API —' : `API ${avd.apiLevel}`,
    architecture: avd.abi ?? (isArm ? 'arm64-v8a' : 'x86_64'),
    resolution,
    densityLabel,
    densityDpi,
    ramAllocationMb: ramMb,
    vCpuCores: cores,
    graphicsEngine: 'Host GPU (ANGLE Direct3D11 / Vulkan)',
    hypervisor: isArm
      ? 'ARM64 Binary Translation / Native KVM'
      : 'WHPX / KVM Hardware Acceleration',
    networkProfile: 'Full Speed · Low Latency (LTE Mode)',
    cameraInfo: 'Back: VirtualScene · Front: Emulated Webcam',
    diskSystemSize: (avd.apiLevel ?? 30) >= 33 ? '3.4 GB' : '2.6 GB',
    diskDataSize: '6.0 GB',
    diskSnapshotSize: avd.bootMode === 'normal' ? '1.8 GB' : '0.4 GB',
    diskSdcardSize: '512 MB',
    rootStatusLabel: getAvdRootStateLabel(avd.rootState),
    bootModeLabel: getAvdBootModeLabel(avd.bootMode, avd.isRunning),
  };
}
