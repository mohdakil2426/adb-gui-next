import type { backend } from '@/lib/desktop/models';

type RemovalTier = backend.RemovalTier;
type PkgState = backend.PkgState;

// ── Safety tier helpers ────────────────────────────────────────────────────────

export const REMOVAL_TIER_LABELS: Record<RemovalTier, string> = {
  Recommended: 'Recommended',
  Advanced: 'Advanced',
  Expert: 'Expert',
  Unsafe: 'Unsafe',
  Unlisted: 'Unlisted',
};

export const REMOVAL_TIER_CLASSES: Record<RemovalTier, { badge: string; dot: string }> = {
  Recommended: {
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  Advanced: {
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  Expert: {
    badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  Unsafe: {
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  Unlisted: {
    badge: 'bg-zinc-500/15 text-zinc-500',
    dot: 'bg-zinc-400',
  },
};

// ── Package state helpers ──────────────────────────────────────────────────────

export const PKG_STATE_LABELS: Record<PkgState, string> = {
  Enabled: 'Enabled',
  Disabled: 'Disabled',
  Uninstalled: 'Uninstalled',
};

export const PKG_STATE_CLASSES: Record<PkgState, string> = {
  Enabled: 'bg-emerald-500',
  Disabled: 'bg-amber-500',
  Uninstalled: 'bg-zinc-400',
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
