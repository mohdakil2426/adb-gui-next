import type { backend } from "@/desktop/models";

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
export const PACKAGE_LIST_VIEWPORT = "h-[calc(100vh-330px)] min-h-[350px] max-h-[640px]";

/** 4px grid: two-line installed rows with compact breathing room (52px), rich debloat rows (54px). */
export const INSTALLED_ROW_HEIGHT = 52;
export const DEBLOAT_ROW_HEIGHT = 54;
// ── Safety tier helpers ────────────────────────────────────────────────────────

export const REMOVAL_TIER_LABELS: Record<RemovalTier, string> = {
  Advanced: "Advanced",
  Expert: "Expert",
  Recommended: "Recommended",
  Unlisted: "Unlisted",
  Unsafe: "Unsafe",
};

/**
 * What each tier actually means for the device.
 *
 * The tier used to exist only as a 9px chip colour with no legend anywhere —
 * for the one control in the app that decides whether a phone still boots.
 */
export const REMOVAL_TIER_MEANINGS: Record<RemovalTier, string> = {
  Advanced: "Removes a feature you may actually use. Read the description first.",
  Expert: "Other packages depend on this. Removing it changes system behaviour.",
  Recommended: "Safe to remove. Nothing in normal use depends on it.",
  Unlisted: "Not in the debloat list — nobody has assessed this package.",
  Unsafe: "Can leave the device in a bootloop. Requires Expert mode to select.",
};

/**
 * Escalating vocabulary: success → info → warning → danger. `Advanced` and
 * `Expert` previously shared the warning colour and were indistinguishable.
 */
export const REMOVAL_TIER_CLASSES: Record<RemovalTier, { badge: string; dot: string }> = {
  Advanced: {
    badge: "border border-info/30 bg-info-muted text-info",
    dot: "bg-info",
  },
  Expert: {
    badge: "border border-warning/35 bg-warning-muted text-warning",
    dot: "bg-warning",
  },
  Recommended: {
    badge: "border border-success/30 bg-success-muted text-success",
    dot: "bg-success",
  },
  Unlisted: {
    badge: "border border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  Unsafe: {
    badge: "border border-destructive/35 bg-destructive-muted text-destructive",
    dot: "bg-destructive",
  },
};

// ── Package state helpers ──────────────────────────────────────────────────────

export const PKG_STATE_LABELS: Record<PkgState, string> = {
  Disabled: "Disabled",
  Enabled: "Enabled",
  Uninstalled: "Uninstalled",
};

export const PKG_STATE_CLASSES: Record<PkgState, string> = {
  Disabled: "bg-warning",
  Enabled: "bg-success",
  Uninstalled: "bg-muted-foreground",
};

// ── Summary helpers for review dialog ─────────────────────────────────────────

export const ALL_REMOVAL_TIERS: RemovalTier[] = [
  "Recommended",
  "Advanced",
  "Expert",
  "Unsafe",
  "Unlisted",
];

export const countByTier = (
  packages: backend.DebloatPackageRow[],
  selectedNames: Set<string>
): Record<RemovalTier, number> => {
  const counts: Record<RemovalTier, number> = {
    Advanced: 0,
    Expert: 0,
    Recommended: 0,
    Unlisted: 0,
    Unsafe: 0,
  };
  for (const pkg of packages) {
    if (selectedNames.has(pkg.name)) {
      counts[pkg.removal] += 1;
    }
  }
  return counts;
};

export const countAllByTier = (
  packages: backend.DebloatPackageRow[]
): Record<RemovalTier, number> => {
  const counts: Record<RemovalTier, number> = {
    Advanced: 0,
    Expert: 0,
    Recommended: 0,
    Unlisted: 0,
    Unsafe: 0,
  };
  for (const pkg of packages) {
    if (pkg.removal in counts) {
      counts[pkg.removal] += 1;
    }
  }
  return counts;
};
