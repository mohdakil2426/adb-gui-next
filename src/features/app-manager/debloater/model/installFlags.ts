import type { backend } from '@/desktop/models';

export interface FlagToggleItem {
  badge?: string;
  badgeTone?: 'warning' | 'info' | 'destructive' | 'secondary';
  defaultOn: boolean;
  description: string;
  flag: string;
  id: keyof Omit<backend.InstallFlagsConfig, 'userId'>;
  label: string;
  riskNotice?: string;
}

export const INSTALL_FLAGS_CATALOG: FlagToggleItem[] = [
  {
    id: 'reinstall',
    flag: '-r',
    label: 'Reinstall / Keep Data',
    description:
      'Replace existing application while retaining its user data, databases, and app caches.',
    defaultOn: true,
  },
  {
    id: 'grantPermissions',
    flag: '-g',
    label: 'Auto-Grant Runtime Permissions',
    description:
      'Grant all declared dangerous/runtime permissions to the package immediately upon install.',
    defaultOn: false,
    badge: 'Convenience',
    badgeTone: 'secondary',
  },
  {
    id: 'allowDowngrade',
    flag: '-d',
    label: 'Allow Version Downgrade',
    description:
      'Permit installing an APK with a lower versionCode than the currently installed version.',
    defaultOn: false,
    badge: 'Requires -r',
    badgeTone: 'warning',
    riskNotice:
      'Downgrading without clearing data can crash applications if database schemas are backward-incompatible.',
  },
  {
    id: 'allowTestPackages',
    flag: '-t',
    label: 'Allow Test Packages',
    description:
      'Allow installation of APKs marked with android:testOnly="true" in their manifest.',
    defaultOn: false,
    badge: 'Dev Builds',
    badgeTone: 'info',
  },
  {
    id: 'bypassLowTargetSdk',
    flag: '--bypass-low-target-sdk-block',
    label: 'Bypass Low Target SDK Block',
    description:
      'Override Android 14+ enforcement that blocks installation of legacy apps targeting SDK < 23.',
    defaultOn: false,
    badge: 'Android 14+',
    badgeTone: 'warning',
    riskNotice:
      'Bypasses security protections for legacy apps that do not support modern Android runtime permissions.',
  },
];

export function getSdkName(sdk: number): string {
  if (sdk >= 35) {
    return 'Android 15';
  }
  if (sdk === 34) {
    return 'Android 14';
  }
  if (sdk === 33) {
    return 'Android 13';
  }
  if (sdk === 32) {
    return 'Android 12L';
  }
  if (sdk === 31) {
    return 'Android 12';
  }
  if (sdk === 30) {
    return 'Android 11';
  }
  if (sdk === 29) {
    return 'Android 10';
  }
  if (sdk === 28) {
    return 'Android 9';
  }

  if (sdk === 27) {
    return 'Android 8.1';
  }
  if (sdk === 26) {
    return 'Android 8.0';
  }
  if (sdk === 25) {
    return 'Android 7.1';
  }
  if (sdk === 24) {
    return 'Android 7.0';
  }
  if (sdk > 0) {
    return `Android SDK ${sdk}`;
  }
  return 'Unknown SDK';
}

export function getFormatBadgeColor(format: string): 'default' | 'secondary' | 'outline' | 'info' {
  const f = format.toLowerCase();
  if (f === 'xapk') {
    return 'secondary';
  }
  if (f === 'apks' || f === 'apkm') {
    return 'info';
  }
  return 'outline';
}
