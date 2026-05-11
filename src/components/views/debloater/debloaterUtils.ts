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
    badge: 'bg-success/15 text-success',
    dot: 'bg-success',
  },
  Advanced: {
    badge: 'bg-warning/15 text-warning-foreground',
    dot: 'bg-warning',
  },
  Expert: {
    badge: 'bg-warning/20 text-warning-foreground',
    dot: 'bg-warning',
  },
  Unsafe: {
    badge: 'bg-destructive/15 text-destructive',
    dot: 'bg-destructive',
  },
  Unlisted: {
    badge: 'bg-muted text-muted-foreground',
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
