import { isLinux, isMac } from '@/shared/utils/platform';
import { version } from '../../../../package.json';

/** The shipped version, read from the same `package.json` Tauri bundles from. */
export const APP_VERSION: string = version;
export const APP_NAME = 'ADB GUI Next';
export const APP_LICENSE = 'MIT';
export const APP_COPYRIGHT = '© 2026 Astrixforge (mohdakil2426)';
export const REPOSITORY_URL = 'https://github.com/mohdakil2426/adb-gui-next';
export const ISSUES_URL = `${REPOSITORY_URL}/issues`;
export const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;

const PLATFORM_LABEL: Record<string, string> = {
  windows: 'Windows',
  linux: 'Linux',
  darwin: 'macOS',
  macos: 'macOS',
};

const ARCH_LABEL: Record<string, string> = {
  x86_64: 'x64',
  aarch64: 'arm64',
  i686: 'x86',
};

function readEnv(key: string): string | null {
  const value = (import.meta.env as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Best-effort OS name when the Tauri CLI did not inject its build variables. */
function fallbackPlatform(): string {
  if (isMac) {
    return 'macOS';
  }
  if (isLinux) {
    return 'Linux';
  }
  return 'Windows';
}

export interface BuildTarget {
  arch: string;
  /** `true` when this is a development build. */
  isDebug: boolean;
  platform: string;
  /** Rust target triple, when the Tauri CLI provided it. */
  triple: string | null;
}

/**
 * Where this copy is running.
 *
 * `TAURI_ENV_*` is injected by the Tauri CLI (`envPrefix` in `vite.config.ts`),
 * so these are the real build target rather than a user-agent guess. A plain
 * `vite dev` has none of them, hence the fallbacks.
 */
export function buildTarget(): BuildTarget {
  const platform = readEnv('TAURI_ENV_PLATFORM');
  const arch = readEnv('TAURI_ENV_ARCH');

  return {
    arch: (arch && ARCH_LABEL[arch]) ?? arch ?? 'unknown',
    isDebug: readEnv('TAURI_ENV_DEBUG') === 'true' || import.meta.env.DEV,
    platform: (platform && PLATFORM_LABEL[platform]) ?? platform ?? fallbackPlatform(),
    triple: readEnv('TAURI_ENV_TARGET_TRIPLE'),
  };
}

export interface Credit {
  license: string;
  name: string;
  role: string;
  url: string;
}

/**
 * The projects this app is assembled from. Every entry is redistributed inside
 * the shipped binary, so the list is an attribution obligation, not decoration.
 */
export const CREDITS: readonly Credit[] = [
  {
    license: 'Apache-2.0 / MIT',
    name: 'Tauri 2',
    role: 'Desktop runtime and packaging',
    url: 'https://tauri.app',
  },
  {
    license: 'MIT',
    name: 'React 19',
    role: 'User interface',
    url: 'https://react.dev',
  },
  {
    license: 'MIT',
    name: 'Tailwind CSS 4 · shadcn/ui · Radix',
    role: 'Design system primitives',
    url: 'https://ui.shadcn.com',
  },
  {
    license: 'MIT',
    name: 'TanStack Query · Zustand',
    role: 'Server cache and app state',
    url: 'https://tanstack.com/query',
  },
  {
    license: 'ISC',
    name: 'Lucide',
    role: 'Icon set',
    url: 'https://lucide.dev',
  },
  {
    license: 'SIL OFL 1.1',
    name: 'Inter · JetBrains Mono',
    role: 'Typefaces, bundled offline',
    url: 'https://rsms.me/inter/',
  },
  {
    license: 'Apache-2.0',
    name: 'Android SDK Platform-Tools',
    role: 'Bundled adb and fastboot binaries',
    url: 'https://developer.android.com/tools/releases/platform-tools',
  },
];
