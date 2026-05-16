import type { ReactNode } from 'react';
import { ViewAbout } from '@/features/about/AboutView';
import { AppManagerView } from '@/features/app-manager/AppManagerView';
import { ViewDashboard } from '@/features/dashboard/DashboardView';
import { ViewEmulatorManager } from '@/features/emulator/EmulatorView';
import { ViewFileExplorer } from '@/features/file-explorer/FileExplorerView';
import { ViewFlasher } from '@/features/flasher/FlasherView';
import { ViewMarketplace } from '@/features/marketplace/MarketplaceView';
import { ViewPayloadDumper } from '@/features/payload-dumper/PayloadDumperView';
import { ViewUtilities } from '@/features/utilities/UtilitiesView';

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
