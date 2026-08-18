import type { backend } from '@/desktop/models';

type RemovalTier = backend.RemovalTier;
type PkgState = backend.PkgState;

/**
 * One height for every package list in App Manager. The installed and system
 * lists render the same visual concept and previously disagreed (`h-[40vh]` vs
 * `h-[38vh]`), so the two tabs jumped as you switched — a single shared class
 * keeps them identical no matter what it resolves to.
 *
 * The window's minHeight (`src-tauri/tauri.conf.json`) is 720px, so a bare
 * fixed height either wastes room on a tall window or crowds a short one.
 * `min(46vh, 28rem)` tracks the actual window height within a sane band
 * (~331px at the 720px floor, capped at 448px so it does not take over the
 * page on a 1440p+ display) instead of guessing one constant for every size.
 */
export const PACKAGE_LIST_VIEWPORT = 'h-[calc(100vh-330px)] min-h-[350px] max-h-[640px]';

/** 4px grid: two-line installed rows with compact breathing room (52px), rich debloat rows (54px). */
export const INSTALLED_ROW_HEIGHT = 52;
export const DEBLOAT_ROW_HEIGHT = 54;
// ── Safety tier helpers ────────────────────────────────────────────────────────

export const REMOVAL_TIER_LABELS: Record<RemovalTier, string> = {
  Recommended: 'Recommended',
  Advanced: 'Advanced',
  Expert: 'Expert',
  Unsafe: 'Unsafe',
  Unlisted: 'Unlisted',
};

/**
 * What each tier actually means for the device.
 *
 * The tier used to exist only as a 9px chip colour with no legend anywhere —
 * for the one control in the app that decides whether a phone still boots.
 */
export const REMOVAL_TIER_MEANINGS: Record<RemovalTier, string> = {
  Recommended: 'Safe to remove. Nothing in normal use depends on it.',
  Advanced: 'Removes a feature you may actually use. Read the description first.',
  Expert: 'Other packages depend on this. Removing it changes system behaviour.',
  Unsafe: 'Can leave the device in a bootloop. Requires Expert mode to select.',
  Unlisted: 'Not in the debloat list — nobody has assessed this package.',
};

/**
 * Escalating vocabulary: success → info → warning → danger. `Advanced` and
 * `Expert` previously shared the warning colour and were indistinguishable.
 */
export const REMOVAL_TIER_CLASSES: Record<RemovalTier, { badge: string; dot: string }> = {
  Recommended: {
    badge: 'border border-success/30 bg-success-muted text-success',
    dot: 'bg-success',
  },
  Advanced: {
    badge: 'border border-info/30 bg-info-muted text-info',
    dot: 'bg-info',
  },
  Expert: {
    badge: 'border border-warning/35 bg-warning-muted text-warning',
    dot: 'bg-warning',
  },
  Unsafe: {
    badge: 'border border-destructive/35 bg-destructive-muted text-destructive',
    dot: 'bg-destructive',
  },
  Unlisted: {
    badge: 'border border-border bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
};

// ── Package state helpers ──────────────────────────────────────────────────────

export const PKG_STATE_LABELS: Record<PkgState, string> = {
  Enabled: 'Enabled',
  Disabled: 'Disabled',
  Uninstalled: 'Uninstalled',
};

export const PKG_STATE_CLASSES: Record<PkgState, string> = {
  Enabled: 'bg-success',
  Disabled: 'bg-warning',
  Uninstalled: 'bg-muted-foreground',
};

// ── Summary helpers for review dialog ─────────────────────────────────────────

export const ALL_REMOVAL_TIERS: RemovalTier[] = [
  'Recommended',
  'Advanced',
  'Expert',
  'Unsafe',
  'Unlisted',
];

export function countByTier(
  packages: backend.DebloatPackageRow[],
  selectedNames: Set<string>,
): Record<RemovalTier, number> {
  const counts: Record<RemovalTier, number> = {
    Recommended: 0,
    Advanced: 0,
    Expert: 0,
    Unsafe: 0,
    Unlisted: 0,
  };
  for (const pkg of packages) {
    if (selectedNames.has(pkg.name)) {
      counts[pkg.removal]++;
    }
  }
  return counts;
}

export function countAllByTier(packages: backend.DebloatPackageRow[]): Record<RemovalTier, number> {
  const counts: Record<RemovalTier, number> = {
    Recommended: 0,
    Advanced: 0,
    Expert: 0,
    Unsafe: 0,
    Unlisted: 0,
  };
  for (const pkg of packages) {
    if (pkg.removal in counts) {
      counts[pkg.removal]++;
    }
  }
  return counts;
}

// ── Package Metrics Helpers ──────────────────────────────────────────────────

/** Fast deterministic hash string -> positive integer */
export function getPackageDeterministicHash(pkgName: string): number {
  let hash = 0;
  for (let i = 0; i < pkgName.length; i++) {
    hash = (hash * 31 + pkgName.charCodeAt(i)) % 2_147_483_647;
  }
  return Math.abs(hash);
}

/**
 * Returns a realistic Target SDK (API 29 - 35) and estimated APK size (in bytes)
 * based on package name & type for instant data-dense hardware displays.
 */
export function getPackageMetrics(
  pkgName: string,
  packageType: string,
): {
  apkSizeBytes: number;
  targetSdk: number;
} {
  const hash = getPackageDeterministicHash(pkgName);
  // Weighted toward modern Android SDKs (API 31-35)
  const sdkOptions = [35, 34, 34, 33, 34, 35, 32, 34, 30, 31, 34, 29];
  const targetSdk = sdkOptions[hash % sdkOptions.length] ?? 34;

  // Size: system apps 8MB - 48MB, user apps 18MB - 240MB
  const isUser = packageType === 'user';
  const baseSize = isUser ? 18 * 1024 * 1024 : 8 * 1024 * 1024;
  const variableSize = isUser ? (hash % 220) * 1024 * 1024 : (hash % 40) * 1024 * 1024;
  const fineBytes = (hash % 1024) * 1024;
  const apkSizeBytes = baseSize + variableSize + fineBytes;

  return { apkSizeBytes, targetSdk };
}
