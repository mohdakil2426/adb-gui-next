import { lazy, type ReactNode } from 'react';

export const VIEWS = {
  DASHBOARD: 'dashboard',
  APPS: 'apps',
  FILES: 'files',
  MARKETPLACE: 'marketplace',
  FLASHER: 'flasher',
  UTILS: 'utils',
  PAYLOAD: 'payload',
  EMULATOR: 'emulator',
  ABOUT: 'about',
} as const;

export type ViewType = (typeof VIEWS)[keyof typeof VIEWS];

// Views are code-split: previously all nine were statically imported, so the
// Payload Dumper, Marketplace, Emulator root wizard and File Explorer all shipped
// in the initial chunk even when the user only opened the Dashboard.
// `ViewContent` supplies the <Suspense> boundary.
const ViewDashboard = lazy(() =>
  import('@/features/dashboard/DashboardView').then((m) => ({ default: m.ViewDashboard })),
);
const AppManagerView = lazy(() =>
  import('@/features/app-manager/AppManagerView').then((m) => ({ default: m.AppManagerView })),
);
const ViewFileExplorer = lazy(() =>
  import('@/features/file-explorer/FileExplorerView').then((m) => ({
    default: m.ViewFileExplorer,
  })),
);
const ViewMarketplace = lazy(() =>
  import('@/features/marketplace/MarketplaceView').then((m) => ({ default: m.ViewMarketplace })),
);
const ViewFlasher = lazy(() =>
  import('@/features/flasher/FlasherView').then((m) => ({ default: m.ViewFlasher })),
);
const ViewUtilities = lazy(() =>
  import('@/features/utilities/UtilitiesView').then((m) => ({ default: m.ViewUtilities })),
);
const ViewPayloadDumper = lazy(() =>
  import('@/features/payload-dumper/PayloadDumperView').then((m) => ({
    default: m.ViewPayloadDumper,
  })),
);
const ViewEmulatorManager = lazy(() =>
  import('@/features/emulator/EmulatorView').then((m) => ({ default: m.ViewEmulatorManager })),
);
const ViewAbout = lazy(() =>
  import('@/features/about/AboutView').then((m) => ({ default: m.ViewAbout })),
);

/**
 * Warm a view's chunk without rendering it. Called on sidebar hover/focus so the
 * network-free local fetch completes before the click lands.
 */
export const VIEW_PRELOADERS: Record<ViewType, () => void> = {
  [VIEWS.DASHBOARD]: () => void import('@/features/dashboard/DashboardView'),
  [VIEWS.APPS]: () => void import('@/features/app-manager/AppManagerView'),
  [VIEWS.FILES]: () => void import('@/features/file-explorer/FileExplorerView'),
  [VIEWS.MARKETPLACE]: () => void import('@/features/marketplace/MarketplaceView'),
  [VIEWS.FLASHER]: () => void import('@/features/flasher/FlasherView'),
  [VIEWS.UTILS]: () => void import('@/features/utilities/UtilitiesView'),
  [VIEWS.PAYLOAD]: () => void import('@/features/payload-dumper/PayloadDumperView'),
  [VIEWS.EMULATOR]: () => void import('@/features/emulator/EmulatorView'),
  [VIEWS.ABOUT]: () => void import('@/features/about/AboutView'),
};

export const VIEW_RENDERERS: Record<ViewType, (activeView: ViewType) => ReactNode> = {
  [VIEWS.DASHBOARD]: (activeView) => <ViewDashboard activeView={activeView} />,
  [VIEWS.APPS]: (activeView) => <AppManagerView activeView={activeView} />,
  [VIEWS.FILES]: (activeView) => <ViewFileExplorer activeView={activeView} />,
  [VIEWS.MARKETPLACE]: () => <ViewMarketplace />,
  [VIEWS.FLASHER]: () => <ViewFlasher />,
  [VIEWS.UTILS]: () => <ViewUtilities />,
  [VIEWS.PAYLOAD]: () => <ViewPayloadDumper />,
  [VIEWS.EMULATOR]: () => <ViewEmulatorManager />,
  [VIEWS.ABOUT]: () => <ViewAbout />,
};
