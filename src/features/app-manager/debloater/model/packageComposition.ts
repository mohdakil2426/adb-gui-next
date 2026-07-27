import type { backend } from '@/desktop/models';

/**
 * How the device's installed packages break down.
 *
 * Every installed package lands in exactly one bucket, so the three counts
 * always sum to `total` — a donut whose slices do not add up to the number
 * printed beside it is worse than no chart at all.
 */
export interface PackageComposition {
  disabled: number;
  system: number;
  total: number;
  user: number;
}

/**
 * `pm list packages` cannot say whether a package is disabled, so the disabled
 * set comes from the debloat rows (which carry a real `PkgState`). Before the
 * Debloat tab has loaded, `debloatRows` is empty and `disabled` is 0 — callers
 * must say so rather than presenting the zero as fact.
 */
export function computePackageComposition(
  installed: readonly backend.InstalledPackage[],
  debloatRows: readonly backend.DebloatPackageRow[],
): PackageComposition {
  const disabledNames = new Set<string>();
  for (const row of debloatRows) {
    if (row.state === 'Disabled') {
      disabledNames.add(row.name);
    }
  }

  let disabled = 0;
  let system = 0;
  let user = 0;
  for (const pkg of installed) {
    if (disabledNames.has(pkg.name)) {
      disabled += 1;
    } else if (pkg.packageType === 'user') {
      user += 1;
    } else {
      system += 1;
    }
  }

  return { disabled, system, total: installed.length, user };
}
