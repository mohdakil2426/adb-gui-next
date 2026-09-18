import type { backend } from "@/desktop/models";

export interface FlagToggleItem {
  badge?: string;
  badgeTone?: "warning" | "info" | "destructive" | "secondary";
  defaultOn: boolean;
  description: string;
  flag: string;
  id: keyof Omit<backend.InstallFlagsConfig, "userId">;
  label: string;
  riskNotice?: string;
}

export const INSTALL_FLAGS_CATALOG: FlagToggleItem[] = [
  {
    defaultOn: true,
    description:
      "Replace existing application while retaining its user data, databases, and app caches.",
    flag: "-r",
    id: "reinstall",
    label: "Reinstall / Keep Data",
  },
  {
    badge: "Convenience",
    badgeTone: "secondary",
    defaultOn: false,
    description:
      "Grant all declared dangerous/runtime permissions to the package immediately upon install.",
    flag: "-g",
    id: "grantPermissions",
    label: "Auto-Grant Runtime Permissions",
  },
  {
    badge: "Requires -r",
    badgeTone: "warning",
    defaultOn: false,
    description:
      "Permit installing an APK with a lower versionCode than the currently installed version.",
    flag: "-d",
    id: "allowDowngrade",
    label: "Allow Version Downgrade",
    riskNotice:
      "Downgrading without clearing data can crash applications if database schemas are backward-incompatible.",
  },
  {
    badge: "Dev Builds",
    badgeTone: "info",
    defaultOn: false,
    description:
      'Allow installation of APKs marked with android:testOnly="true" in their manifest.',
    flag: "-t",
    id: "allowTestPackages",
    label: "Allow Test Packages",
  },
  {
    badge: "Android 14+",
    badgeTone: "warning",
    defaultOn: false,
    description:
      "Override Android 14+ enforcement that blocks installation of legacy apps targeting SDK < 23.",
    flag: "--bypass-low-target-sdk-block",
    id: "bypassLowTargetSdk",
    label: "Bypass Low Target SDK Block",
    riskNotice:
      "Bypasses security protections for legacy apps that do not support modern Android runtime permissions.",
  },
];

export const getSdkName = (sdk: number): string => {
  if (sdk >= 35) {
    return "Android 15";
  }
  if (sdk === 34) {
    return "Android 14";
  }
  if (sdk === 33) {
    return "Android 13";
  }
  if (sdk === 32) {
    return "Android 12L";
  }
  if (sdk === 31) {
    return "Android 12";
  }
  if (sdk === 30) {
    return "Android 11";
  }
  if (sdk === 29) {
    return "Android 10";
  }
  if (sdk === 28) {
    return "Android 9";
  }

  if (sdk === 27) {
    return "Android 8.1";
  }
  if (sdk === 26) {
    return "Android 8.0";
  }
  if (sdk === 25) {
    return "Android 7.1";
  }
  if (sdk === 24) {
    return "Android 7.0";
  }
  if (sdk > 0) {
    return `Android SDK ${sdk}`;
  }
  return "Unknown SDK";
};

export const getFormatBadgeColor = (
  format: string
): "default" | "secondary" | "outline" | "info" => {
  const f = format.toLowerCase();
  if (f === "xapk") {
    return "secondary";
  }
  if (f === "apks" || f === "apkm") {
    return "info";
  }
  return "outline";
};
