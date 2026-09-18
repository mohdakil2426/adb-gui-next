import { lazy } from "react";
import type { ReactNode } from "react";

export const VIEWS = {
  ABOUT: "about",
  APPS: "apps",
  DASHBOARD: "dashboard",
  EMULATOR: "emulator",
  FILES: "files",
  FLASHER: "flasher",
  MARKETPLACE: "marketplace",
  PAYLOAD: "payload",
  SCRCPY: "scrcpy",
  UTILS: "utils",
} as const;

export type ViewType = (typeof VIEWS)[keyof typeof VIEWS];

// Views are code-split: previously all nine were statically imported, so the
// Payload Dumper, Marketplace, Emulator root wizard and File Explorer all shipped
// in the initial chunk even when the user only opened the Dashboard.
// `ViewContent` supplies the <Suspense> boundary.
const ViewDashboard = lazy(async () => {
  const m = await import("@/features/dashboard/dashboard-view");
  return { default: m.ViewDashboard };
});
const AppManagerView = lazy(async () => {
  const m = await import("@/features/app-manager/app-manager-view");
  return { default: m.AppManagerView };
});
const ViewFileExplorer = lazy(async () => {
  const m = await import("@/features/file-explorer/file-explorer-view");
  return { default: m.ViewFileExplorer };
});
const ViewMarketplace = lazy(async () => {
  const m = await import("@/features/marketplace/marketplace-view");
  return { default: m.ViewMarketplace };
});
const ViewFlasher = lazy(async () => {
  const m = await import("@/features/flasher/flasher-view");
  return { default: m.ViewFlasher };
});
const ViewUtilities = lazy(async () => {
  const m = await import("@/features/utilities/utilities-view");
  return { default: m.ViewUtilities };
});
const ViewScrcpy = lazy(async () => {
  const m = await import("@/features/scrcpy/scrcpy-view");
  return { default: m.ViewScrcpy };
});
const ViewPayloadDumper = lazy(async () => {
  const m = await import("@/features/payload-dumper/payload-dumper-view");
  return { default: m.ViewPayloadDumper };
});
const ViewEmulatorManager = lazy(async () => {
  const m = await import("@/features/emulator/emulator-view");
  return { default: m.ViewEmulatorManager };
});
const ViewAbout = lazy(async () => {
  const m = await import("@/features/about/about-view");
  return { default: m.ViewAbout };
});

/**
 * Warm a view's chunk without rendering it. Called on sidebar hover/focus so the
 * network-free local fetch completes before the click lands.
 */
export const VIEW_PRELOADERS: Record<ViewType, () => void> = {
  [VIEWS.DASHBOARD]: () => {
    import("@/features/dashboard/dashboard-view");
  },
  [VIEWS.APPS]: () => {
    import("@/features/app-manager/app-manager-view");
  },
  [VIEWS.FILES]: () => {
    import("@/features/file-explorer/file-explorer-view");
  },
  [VIEWS.MARKETPLACE]: () => {
    import("@/features/marketplace/marketplace-view");
  },
  [VIEWS.FLASHER]: () => {
    import("@/features/flasher/flasher-view");
  },
  [VIEWS.UTILS]: () => {
    import("@/features/utilities/utilities-view");
  },
  [VIEWS.SCRCPY]: () => {
    import("@/features/scrcpy/scrcpy-view");
  },
  [VIEWS.PAYLOAD]: () => {
    import("@/features/payload-dumper/payload-dumper-view");
  },
  [VIEWS.EMULATOR]: () => {
    import("@/features/emulator/emulator-view");
  },
  [VIEWS.ABOUT]: () => {
    import("@/features/about/about-view");
  },
};

export const VIEW_RENDERERS: Record<ViewType, (activeView: ViewType) => ReactNode> = {
  [VIEWS.DASHBOARD]: (activeView) => <ViewDashboard activeView={activeView} />,
  [VIEWS.APPS]: (activeView) => <AppManagerView activeView={activeView} />,
  [VIEWS.FILES]: (activeView) => <ViewFileExplorer activeView={activeView} />,
  [VIEWS.MARKETPLACE]: () => <ViewMarketplace />,
  [VIEWS.FLASHER]: () => <ViewFlasher />,
  [VIEWS.UTILS]: () => <ViewUtilities />,
  [VIEWS.SCRCPY]: () => <ViewScrcpy />,
  [VIEWS.PAYLOAD]: () => <ViewPayloadDumper />,
  [VIEWS.EMULATOR]: () => <ViewEmulatorManager />,
  [VIEWS.ABOUT]: () => <ViewAbout />,
};
