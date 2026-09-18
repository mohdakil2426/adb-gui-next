import type { backend } from "@/desktop/models";

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
  21: "Android 5.0 (Lollipop)",
  22: "Android 5.1 (Lollipop)",
  23: "Android 6.0 (Marshmallow)",
  24: "Android 7.0 (Nougat)",
  25: "Android 7.1.1 (Nougat)",
  26: "Android 8.0 (Oreo)",
  27: "Android 8.1 (Oreo)",
  28: "Android 9.0 (Pie)",
  29: "Android 10.0",
  30: "Android 11.0",
  31: "Android 12.0",
  32: "Android 12L",
  33: "Android 13.0",
  34: "Android 14.0",
  35: "Android 15.0",
};

export const getAndroidVersionName = (apiLevel: number | null): string => {
  if (apiLevel === null || apiLevel === undefined) {
    return "Android";
  }
  return ANDROID_VERSIONS[apiLevel] ?? `Android (API ${apiLevel})`;
};

export const getAvdRootStateLabel = (state: backend.AvdRootState): string => {
  switch (state) {
    case "rooted": {
      return "Magisk Rooted";
    }
    case "modified": {
      return "Modified (Patched)";
    }
    case "unknown": {
      return "Unknown";
    }
    default: {
      return "Stock (Pristine)";
    }
  }
};

export const getAvdBootModeLabel = (mode: backend.EmulatorBootMode, isRunning: boolean): string => {
  if (!isRunning) {
    return "Offline";
  }
  switch (mode) {
    case "cold": {
      return "Cold Boot (Clean)";
    }
    case "normal": {
      return "Quick Boot Snapshot";
    }
    default: {
      return "Running (Active)";
    }
  }
};

const DEFAULT_HARDWARE_DETAILS: AvdHardwareDetails = {
  androidVersion: "Android",
  apiLabel: "API —",
  architecture: "x86_64",
  bootModeLabel: "Offline",
  cameraInfo: "Back: VirtualScene · Front: Webcam0",
  densityDpi: 420,
  densityLabel: "420 dpi (xxhdpi)",
  diskDataSize: "6.0 GB",
  diskSdcardSize: "512 MB",
  diskSnapshotSize: "1.2 GB",
  diskSystemSize: "2.8 GB",
  graphicsEngine: "Host GPU (ANGLE Direct3D11)",
  hypervisor: "WHPX / KVM Accelerated",
  networkProfile: "Full Speed · LTE Latency (<20ms)",
  ramAllocationMb: 4096,
  resolution: "1080×2400",
  rootStatusLabel: "Stock (Pristine)",
  vCpuCores: 4,
};

const getDisplayProfile = (isTablet: boolean) => {
  if (isTablet) {
    return {
      densityDpi: 320,
      densityLabel: "320 dpi (xhdpi)",
      resolution: "2560×1600 (16:10)",
    };
  }
  return {
    densityDpi: 420,
    densityLabel: "420 dpi (xxhdpi)",
    resolution: "1080×2400 (20:9)",
  };
};

const getHardwareCapacity = (apiLevel: number | null) => {
  const isModern = (apiLevel ?? 30) >= 33;
  return {
    diskSystemSize: isModern ? "3.4 GB" : "2.6 GB",
    ramMb: isModern ? 4096 : 2048,
    vCpuCores: isModern ? 4 : 2,
  };
};

const isArmAbi = (abi: string | null | undefined): boolean =>
  Boolean(abi?.includes("arm") || abi?.includes("aarch64"));

const isTabletDevice = (avd: backend.AvdSummary): boolean =>
  Boolean(
    avd.deviceName?.toLowerCase().includes("tablet") || avd.name.toLowerCase().includes("tablet")
  );

export const deriveAvdHardwareDetails = (avd: backend.AvdSummary | null): AvdHardwareDetails => {
  if (!avd) {
    return DEFAULT_HARDWARE_DETAILS;
  }

  const isArm = isArmAbi(avd.abi);
  const isTablet = isTabletDevice(avd);
  const { densityDpi, densityLabel, resolution } = getDisplayProfile(isTablet);
  const { diskSystemSize, ramMb, vCpuCores } = getHardwareCapacity(avd.apiLevel);

  return {
    androidVersion: getAndroidVersionName(avd.apiLevel),
    apiLabel: avd.apiLevel === null ? "API —" : `API ${avd.apiLevel}`,
    architecture: avd.abi ?? (isArm ? "arm64-v8a" : "x86_64"),
    bootModeLabel: getAvdBootModeLabel(avd.bootMode, avd.isRunning),
    cameraInfo: "Back: VirtualScene · Front: Emulated Webcam",
    densityDpi,
    densityLabel,
    diskDataSize: "6.0 GB",
    diskSdcardSize: "512 MB",
    diskSnapshotSize: avd.bootMode === "normal" ? "1.8 GB" : "0.4 GB",
    diskSystemSize,
    graphicsEngine: "Host GPU (ANGLE Direct3D11 / Vulkan)",
    hypervisor: isArm
      ? "ARM64 Binary Translation / Native KVM"
      : "WHPX / KVM Hardware Acceleration",
    networkProfile: "Full Speed · Low Latency (LTE Mode)",
    ramAllocationMb: ramMb,
    resolution,
    rootStatusLabel: getAvdRootStateLabel(avd.rootState),
    vCpuCores,
  };
};
