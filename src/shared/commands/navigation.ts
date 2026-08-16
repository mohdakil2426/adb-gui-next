import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Box,
  FolderOpen,
  Info,
  LayoutDashboard,
  Package,
  Settings,
  Smartphone,
  Store,
  Zap,
} from 'lucide-react';
import { VIEWS, type ViewType } from '@/app/shell/viewConfig';

export interface ViewMeta {
  /** One-line explanation — palette subtitle and collapsed-sidebar tooltip. */
  description: string;
  icon: LucideIcon;
  /** Extra palette search terms that do not appear in the title. */
  keywords: string[];
  title: string;
}

/**
 * Single source of truth for view chrome: the header title, the sidebar label
 * and the palette's Navigate group all read from here, so a view is named once.
 */
export const VIEW_META: Record<ViewType, ViewMeta> = {
  [VIEWS.DASHBOARD]: {
    description: 'Device identity, battery, storage and security at a glance',
    icon: LayoutDashboard,
    keywords: ['home', 'overview', 'telemetry', 'battery', 'storage'],
    title: 'Dashboard',
  },
  [VIEWS.APPS]: {
    description: 'Installed packages, APK installs and debloat',
    icon: Box,
    keywords: ['apps', 'packages', 'apk', 'install', 'uninstall', 'debloat'],
    title: 'Applications',
  },
  [VIEWS.FILES]: {
    description: 'Browse, push and pull device storage',
    icon: FolderOpen,
    keywords: ['files', 'storage', 'push', 'pull', 'sdcard', 'browse'],
    title: 'File Explorer',
  },
  [VIEWS.MARKETPLACE]: {
    description: 'Discover and install open-source Android apps',
    icon: Store,
    keywords: ['store', 'fdroid', 'github', 'download', 'apps'],
    title: 'Marketplace',
  },
  [VIEWS.FLASHER]: {
    description: 'Write partition images over fastboot',
    icon: Zap,
    keywords: ['flash', 'fastboot', 'partition', 'boot', 'sideload', 'slot'],
    title: 'Flasher',
  },
  [VIEWS.PAYLOAD]: {
    description: 'Extract partitions from payload.bin and OTA archives',
    icon: Package,
    keywords: ['payload', 'dumper', 'ota', 'extract', 'unpack', 'image'],
    title: 'Payload Dumper',
  },
  [VIEWS.UTILS]: {
    description: 'ADB and fastboot host commands',
    icon: Settings,
    keywords: ['utilities', 'tools', 'adb', 'fastboot', 'wireless', 'screenshot'],
    title: 'Utilities',
  },
  [VIEWS.SCRCPY]: {
    description: 'Mirror and control the selected device in a native scrcpy window',
    icon: Smartphone,
    keywords: ['scrcpy', 'mirror', 'screen', 'cast', 'control', 'record'],
    title: 'Scrcpy',
  },
  [VIEWS.EMULATOR]: {
    description: 'Manage, launch and root Android virtual devices',
    icon: Bot,
    keywords: ['emulator', 'avd', 'virtual', 'magisk', 'root'],
    title: 'Emulator',
  },
  [VIEWS.ABOUT]: {
    description: 'Version, licences and project links',
    icon: Info,
    keywords: ['about', 'version', 'licence', 'license', 'credits'],
    title: 'About',
  },
};

export interface NavSection {
  items: ViewType[];
  label: string;
  /** Marks a group whose actions can leave a device unbootable. */
  risk: boolean;
}

/**
 * Device / Firmware / Tools replaces the old Main / Advanced split, which put
 * the device-bricking Flasher in the same bucket as the Emulator. Grouping now
 * follows risk and intent rather than perceived difficulty.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [VIEWS.DASHBOARD, VIEWS.APPS, VIEWS.FILES, VIEWS.MARKETPLACE],
    label: 'Device',
    risk: false,
  },
  {
    items: [VIEWS.FLASHER, VIEWS.PAYLOAD],
    label: 'Firmware',
    risk: true,
  },
  {
    items: [VIEWS.UTILS, VIEWS.SCRCPY, VIEWS.EMULATOR],
    label: 'Tools',
    risk: false,
  },
];

/** Views in nav order, with `about` (sidebar footer) last. */
export const NAV_VIEW_ORDER: ViewType[] = [
  ...NAV_SECTIONS.flatMap((section) => section.items),
  VIEWS.ABOUT,
];

/** Section a view belongs to — drives the header breadcrumb. `about` has none. */
export function sectionForView(view: ViewType): NavSection | null {
  return NAV_SECTIONS.find((section) => section.items.includes(view)) ?? null;
}
