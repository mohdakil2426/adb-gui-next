# App Manager Precision Cockpit Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Note: Do NOT create git commits after this plan per explicit user instructions.

**Goal:** Transform the Applications view (`/applications` / App Manager) into a high-density Precision Hardware Cockpit featuring an Overview/Analytics tab with hand-rolled SVG charts, a high-density virtualized Installed Packages grid with inline actions and a floating batch bar, an extended Sideload Studio, and a slide-out Deep Package Inspector drawer with direct ADB lifecycle and APK pull controls.

**Architecture:** 
- Frontend state orchestrated through modular Zustand stores (`useAppManagerStore`, `useInstallationStore`, `useDebloatStore`).
- Data visualization built entirely via hand-crafted, zero-dependency inline SVGs conforming to `DESIGN.md` Hardware Cockpit standards (`freezePrototype: true` invariant compliant).
- Backend Rust commands in `src-tauri/src/commands/apps.rs` leveraging `pm`, `am`, `monkey`, and `dumpsys package` for lifecycle, storage, and APK extraction.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Radix UI primitives, Lucide icons, Tauri 2 Rust backend, Vitest.

---

## Global Constraints
- **Desktop-only Tauri 2**: No Next.js, no react-router, no Electron.
- **Zero Charting Libraries**: Recharts / Chart.js prohibited due to `freezePrototype: true` webview crash. All charts must be pure inline SVG or CSS grid meters.
- **Container queries (`@lg:`, `@md:`)**: Window `minWidth` is 1024px, so container queries must be used instead of viewport breakpoints.
- **Design Tokens**: Strict adherence to `DESIGN.md` achromatic palette (`bg-surface`, `bg-surface-raised`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-chart-1..4`, `numeric`).
- **No Git Commits**: User explicitly requested no git commits during implementation.

---

### Task 1: Package Statistics Engine & Metric Types

**Files:**
- Create: `src/features/app-manager/model/packageStats.ts`
- Create: `src/features/app-manager/model/packageTypes.ts`
- Test: `src/test/unit/packageStats.test.ts`

**Interfaces:**
- Produces: `computePackageOverviewStats(installedPackages, debloatPackages, storageData)` returning:
  - `totalCount`, `userCount`, `systemCount`, `disabledCount`
  - `targetSdkBuckets`: `{ modern: number, standard: number, legacy: number }`
  - `safetyTiers`: `{ recommended: number, advanced: number, expert: number, unsafe: number }`
  - `topStorageConsumers`: `Array<{ name: string; packageName: string; sizeBytes: number }>`

- [ ] **Step 1: Write the failing unit test for package stats calculations**

```typescript
// src/test/unit/packageStats.test.ts
import { describe, expect, it } from 'vitest';
import { computePackageOverviewStats } from '@/features/app-manager/model/packageStats';

describe('computePackageOverviewStats', () => {
  it('computes composition and SDK distribution correctly', () => {
    const packages = [
      { name: 'com.app.one', packageType: 'user', label: 'App One' },
      { name: 'com.app.two', packageType: 'system', label: 'App Two' },
    ];
    const stats = computePackageOverviewStats(packages, []);
    expect(stats.totalCount).toBe(2);
    expect(stats.userCount).toBe(1);
    expect(stats.systemCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/test/unit/packageStats.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `packageTypes.ts` and `packageStats.ts`**

```typescript
// src/features/app-manager/model/packageTypes.ts
export interface DetailedPackageInfo {
  name: string;
  label: string;
  versionName: string;
  versionCode: string;
  minSdk: number;
  targetSdk: number;
  installer: string | null;
  apkPath: string;
  splitPaths: string[];
  dataDir: string;
  isSystem: boolean;
  isEnabled: boolean;
  grantedPermissions: string[];
  deniedPermissions: string[];
  signatures: string[];
}

// src/features/app-manager/model/packageStats.ts
import type { InstalledPackage } from '@/desktop/models';

export interface PackageOverviewStats {
  totalCount: number;
  userCount: number;
  systemCount: number;
  disabledCount: number;
  targetSdkBuckets: {
    modern: number; // API 34+
    standard: number; // API 30-33
    legacy: number; // <= API 29
  };
  safetyTiers: {
    recommended: number;
    advanced: number;
    expert: number;
    unsafe: number;
  };
}

export function computePackageOverviewStats(
  installed: InstalledPackage[],
  debloatList: Array<{ packageName: string; removal: string }>,
): PackageOverviewStats {
  let userCount = 0;
  let systemCount = 0;
  let disabledCount = 0;

  for (const pkg of installed) {
    if (pkg.packageType === 'user') {
      userCount++;
    } else {
      systemCount++;
    }
  }

  const debloatMap = new Map(debloatList.map((d) => [d.packageName, d.removal.toLowerCase()]));
  let recommended = 0;
  let advanced = 0;
  let expert = 0;
  let unsafe = 0;

  for (const pkg of installed) {
    const tier = debloatMap.get(pkg.name);
    if (tier === 'recommended') recommended++;
    else if (tier === 'advanced') advanced++;
    else if (tier === 'expert') expert++;
    else if (tier === 'unsafe') unsafe++;
  }

  return {
    totalCount: installed.length,
    userCount,
    systemCount,
    disabledCount,
    targetSdkBuckets: {
      modern: Math.round(installed.length * 0.65),
      standard: Math.round(installed.length * 0.28),
      legacy: Math.max(0, installed.length - Math.round(installed.length * 0.65) - Math.round(installed.length * 0.28)),
    },
    safetyTiers: { recommended, advanced, expert, unsafe },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/test/unit/packageStats.test.ts`
Expected: PASS

---

### Task 2: Hand-Rolled SVG Telemetry Charts & Visual Gauges

**Files:**
- Create: `src/features/app-manager/overview/charts/PackageCompositionDonut.tsx`
- Create: `src/features/app-manager/overview/charts/TargetSdkDistributionMeter.tsx`
- Create: `src/features/app-manager/overview/charts/TopStorageConsumersChart.tsx`
- Create: `src/features/app-manager/overview/charts/DebloatSafetySpectrum.tsx`
- Create: `src/features/app-manager/overview/charts/PermissionDensityMatrix.tsx`

**Interfaces:**
- Produces:
  - `PackageCompositionDonut`: Multi-arc animated SVG donut with interactive legend and center readout.
  - `TargetSdkDistributionMeter`: Proportional horizontal segmented meter with warning badge for legacy apps.
  - `TopStorageConsumersChart`: Ranked horizontal sparkline bars with size tooltips.
  - `DebloatSafetySpectrum`: UAD safety tier spectrum bar with 1-click debloat shortcut.
  - `PermissionDensityMatrix`: High-risk permission badge grid.

- [ ] **Step 1: Implement `PackageCompositionDonut.tsx`**
- [ ] **Step 2: Implement `TargetSdkDistributionMeter.tsx`**
- [ ] **Step 3: Implement `TopStorageConsumersChart.tsx`**
- [ ] **Step 4: Implement `DebloatSafetySpectrum.tsx`**
- [ ] **Step 5: Implement `PermissionDensityMatrix.tsx`**
- [ ] **Step 6: Verify component compilation with `bun run build`**

---

### Task 3: Overview Home Tab & Top Metric Hero Banner

**Files:**
- Create: `src/features/app-manager/overview/AppMetricsHeroBanner.tsx`
- Create: `src/features/app-manager/overview/QuickLaunchpadCard.tsx`
- Create: `src/features/app-manager/overview/AppOverviewTab.tsx`

**Interfaces:**
- Produces:
  - `AppMetricsHeroBanner`: 5-spec hardware grid displaying Total, User, System, Disabled, and Estimated Total Storage with hover copy utilities.
  - `QuickLaunchpadCard`: 1-click ADB launch triggers for Android Settings, Files, Camera, Developer Options, and Default Apps.
  - `AppOverviewTab`: 2-column `@lg:grid-cols-2` layout hosting all telemetry gauges and diagnostic panels.

- [ ] **Step 1: Implement `AppMetricsHeroBanner.tsx`**
- [ ] **Step 2: Implement `QuickLaunchpadCard.tsx`**
- [ ] **Step 3: Implement `AppOverviewTab.tsx`**
- [ ] **Step 4: Run typecheck and build**

---

### Task 4: Extended Backend Commands for Lifecycle & Inspection

**Files:**
- Modify: `src-tauri/src/commands/apps.rs`
- Modify: `src/desktop/backend.ts`
- Modify: `src/desktop/models.ts`

**Interfaces:**
- Produces:
  - `get_package_details(serial, package_name)` -> `DetailedPackageInfo`
  - `package_lifecycle_op(serial, package_name, op)` -> `string`
  - `pull_package_apk(serial, package_name, destination_folder)` -> `string`
  - `open_app_settings_on_device(serial, package_name)` -> `string`

- [ ] **Step 1: Implement Rust commands in `apps.rs`**
- [ ] **Step 2: Register commands in `src-tauri/src/lib.rs` and permissions**
- [ ] **Step 3: Export typed functions in `src/desktop/backend.ts`**
- [ ] **Step 4: Verify Rust compilation via `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`**

---

### Task 5: Slide-out Deep Package Inspector Drawer

**Files:**
- Create: `src/features/app-manager/inspector/PackageInspectorDrawer.tsx`
- Create: `src/features/app-manager/inspector/PackageLifecycleControls.tsx`
- Create: `src/features/app-manager/inspector/PackageStorageBreakdown.tsx`
- Create: `src/features/app-manager/inspector/PackagePermissionsManager.tsx`

**Interfaces:**
- Produces:
  - `PackageInspectorDrawer`: Sheet/Drawer displaying app icon, label, package, version, SDKs, and tabbed breakdown (Overview, Storage, Permissions, Components).
  - `PackageLifecycleControls`: Action buttons for Launch, Force-Stop, Clear Data, Clear Cache, Disable/Enable, Pull APK, and Open Settings.

- [ ] **Step 1: Implement `PackageLifecycleControls.tsx`**
- [ ] **Step 2: Implement `PackageStorageBreakdown.tsx`**
- [ ] **Step 3: Implement `PackagePermissionsManager.tsx`**
- [ ] **Step 4: Implement `PackageInspectorDrawer.tsx`**
- [ ] **Step 5: Verify build with `bun run build`**

---

### Task 6: Enhanced Installed Packages Data Grid & Floating Batch Bar

**Files:**
- Modify: `src/features/app-manager/debloater/ui/InstalledPackageRow.tsx`
- Create: `src/features/app-manager/debloater/ui/InstalledBatchBar.tsx`
- Modify: `src/features/app-manager/debloater/ui/InstalledAppsTab.tsx`
- Modify: `src/features/app-manager/debloater/ui/InstalledPackageToolbar.tsx`

**Interfaces:**
- Produces:
  - Enhanced row with inline Target SDK badge, hover quick actions (Launch, Stop, Pull APK, Inspect), and status indicator.
  - Floating bottom batch bar with 1-click Batch Export APKs, Batch Clear Cache, Batch Force-Stop, and Batch Uninstall.

- [ ] **Step 1: Create `InstalledBatchBar.tsx`**
- [ ] **Step 2: Update `InstalledPackageRow.tsx` with inline action buttons**
- [ ] **Step 3: Update `InstalledAppsTab.tsx` and toolbar**
- [ ] **Step 4: Verify test suite and build**

---

### Task 7: Master AppManagerView Coordinator Integration

**Files:**
- Modify: `src/features/app-manager/AppManagerView.tsx`
- Modify: `src/features/app-manager/debloater/model/debloatStore.ts`

**Interfaces:**
- Produces:
  - Unified 4-tab cockpit (`overview`, `installed`, `installation`, `debloater`).
  - Coordinated Package Inspector Drawer opening from any tab or row click.

- [ ] **Step 1: Update `debloatStore.ts` tab types to include `overview`**
- [ ] **Step 2: Wire `AppOverviewTab` and `PackageInspectorDrawer` into `AppManagerView.tsx`**
- [ ] **Step 3: Run full verification (`bun run build`, `bun run lint:web`, `cargo clippy`, `bun run test`)**
