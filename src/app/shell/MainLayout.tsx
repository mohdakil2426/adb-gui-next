import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import '@/styles/global.css';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { Cpu, Logs, SquareTerminal, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { AppSidebar } from '@/app/shell/AppSidebar';
import { BottomPanel } from '@/app/shell/BottomPanel/BottomPanel';
import { LaunchDeviceManager, LaunchTerminal } from '@/desktop/backend';
import { ViewAbout } from '@/features/about/AboutView';
import { ViewAppManager } from '@/features/app-manager/AppManagerView';
import { ViewDashboard } from '@/features/dashboard/DashboardView';
import { ViewEmulatorManager } from '@/features/emulator/EmulatorView';
import { ViewFileExplorer } from '@/features/file-explorer/FileExplorerView';
import { ViewFlasher } from '@/features/flasher/FlasherView';
import { ViewMarketplace } from '@/features/marketplace/MarketplaceView';
import { ViewPayloadDumper } from '@/features/payload-dumper/PayloadDumperView';
import { ViewUtilities } from '@/features/utilities/UtilitiesView';
import { DeviceSwitcher } from '@/shared/components/DeviceSwitcher';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { ThemeProvider } from '@/shared/components/ThemeProvider';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { WelcomeScreen } from '@/shared/components/WelcomeScreen';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar';
import { Toaster } from '@/shared/ui/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { fetchAllDevices, queryKeys, STALE_TIME } from '@/shared/utils/queries';

const VIEWS = {
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

type ViewType = (typeof VIEWS)[keyof typeof VIEWS];

const LOADING_DURATION = 750;
const PANEL_MAXIMIZED_HEIGHT_RATIO = 0.7;
const DEFAULT_PANEL_HEIGHT = 300;

const VIEW_RENDERERS: Record<ViewType, (activeView: ViewType) => ReactNode> = {
  [VIEWS.DASHBOARD]: (activeView) => <ViewDashboard activeView={activeView} />,
  [VIEWS.APPS]: (activeView) => <ViewAppManager activeView={activeView} />,
  [VIEWS.FILES]: (activeView) => <ViewFileExplorer activeView={activeView} />,
  [VIEWS.MARKETPLACE]: () => <ViewMarketplace />,
  [VIEWS.FLASHER]: () => <ViewFlasher />,
  [VIEWS.UTILS]: () => <ViewUtilities />,
  [VIEWS.PAYLOAD]: () => <ViewPayloadDumper />,
  [VIEWS.EMULATOR]: () => <ViewEmulatorManager />,
  [VIEWS.ABOUT]: () => <ViewAbout />,
};

export function MainLayout() {
  const shouldReduceMotion = useReducedMotion();
  const [activeView, setActiveView] = useState<ViewType>(VIEWS.DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  const togglePanel = useLogStore((state) => state.togglePanel);
  const isLogOpen = useLogStore((state) => state.isOpen);
  const setActiveTab = useLogStore((state) => state.setActiveTab);
  const unreadCount = useLogStore((state) => state.unreadCount);
  const activeTab = useLogStore((state) => state.activeTab);
  const panelHeight = useLogStore((state) => state.panelHeight);
  const isPanelMaximized = useLogStore((state) => state.isPanelMaximized);
  const setDevices = useDeviceStore((state) => state.setDevices);

  // ── Centralized device polling ─────────────────────────────────────────
  // Single global query replaces per-view polling in Dashboard/Flasher/Utilities.
  const { isFetching: isDeviceRefreshing, refetch: refetchDevices } = useQuery({
    queryKey: queryKeys.allDevices(),
    queryFn: async () => {
      const devices = await fetchAllDevices();
      setDevices(devices);
      return devices;
    },
    refetchInterval: STALE_TIME.ALL_DEVICES,
    staleTime: STALE_TIME.ALL_DEVICES,
  });

  const refreshDevices = useCallback(() => {
    void refetchDevices();
  }, [refetchDevices]);

  const handleLaunchDeviceManager = useCallback(async () => {
    try {
      await LaunchDeviceManager();
      toast.success('Device Manager launched successfully');
    } catch (error) {
      toast.error(`Failed to launch Device Manager: ${error}`);
    }
  }, []);

  const handleLaunchTerminal = useCallback(async () => {
    try {
      await LaunchTerminal();
      toast.success('Terminal launched successfully');
    } catch (error) {
      toast.error(`Failed to launch Terminal: ${error}`);
    }
  }, []);

  // Smart panel toggle: closed→open+tab, open+same-tab→close, open+other-tab→switch
  const handleOpenShellPanel = useCallback(() => {
    if (!isLogOpen) {
      togglePanel();
      setActiveTab('shell');
    } else if (activeTab === 'shell') {
      togglePanel(); // already on shell tab — close
    } else {
      setActiveTab('shell'); // open on different tab — just switch
    }
  }, [activeTab, isLogOpen, setActiveTab, togglePanel]);

  const handleOpenLogsPanel = useCallback(() => {
    if (!isLogOpen) {
      togglePanel();
      setActiveTab('logs');
    } else if (activeTab === 'logs') {
      togglePanel(); // already on logs tab — close
    } else {
      setActiveTab('logs'); // open on different tab — just switch
    }
  }, [activeTab, isLogOpen, setActiveTab, togglePanel]);

  const handleViewChange = useCallback((view: ViewType) => {
    setActiveView(view);
  }, []);

  useEffect(() => {
    if (shouldReduceMotion) {
      setProgress(100);
      setIsLoading(false);
      return;
    }

    let animationFrame: number;
    let startTime: number | null = null;

    const tick = (timestamp: number) => {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (startTime === null) {
        startTime = timestamp;
      }
      const elapsed = timestamp - startTime;
      const nextProgress = Math.min(100, (elapsed / LOADING_DURATION) * 100);
      setProgress(nextProgress);

      if (elapsed < LOADING_DURATION) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        setIsLoading(false);
      }
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const activeViewContent = VIEW_RENDERERS[activeView](activeView);
  const mainPaddingBottom =
    isLogOpen && activeView !== VIEWS.ABOUT
      ? `${isPanelMaximized ? viewportHeight * PANEL_MAXIMIZED_HEIGHT_RATIO : panelHeight || DEFAULT_PANEL_HEIGHT}px`
      : undefined;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {isLoading ? (
            <motion.div
              className="absolute inset-0 z-50"
              exit={{ opacity: 0 }}
              initial={{ opacity: 1 }}
              key="welcome-screen"
              transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
            >
              <WelcomeScreen progress={progress} />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div
          className={cn(
            'h-svh overflow-hidden',
            isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500 ease-in-out',
          )}
        >
          <a
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[var(--z-toast)] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:font-medium focus:text-foreground focus:text-sm focus:ring-2 focus:ring-ring"
            href="#main-content"
          >
            Skip to main content
          </a>
          <SidebarProvider>
            <ErrorBoundary viewName="Sidebar">
              <AppSidebar activeView={activeView} onViewChange={handleViewChange} />
            </ErrorBoundary>
            <SidebarInset>
              {/* Header bar — sits above scroll area in the flex-col SidebarInset, never scrolls */}
              <header className="z-10 flex h-12 shrink-0 items-center gap-2 border-border/50 border-b bg-background/95 px-4 backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
                <SidebarTrigger aria-label="Toggle Sidebar" className="-ml-1" />
                <Separator
                  className="mr-2 data-[orientation=vertical]:h-4"
                  orientation="vertical"
                />

                {/* Device Switcher — global device status + multi-device dropdown */}
                <ErrorBoundary viewName="Device Switcher">
                  <DeviceSwitcher isRefreshing={isDeviceRefreshing} onRefresh={refreshDevices} />
                </ErrorBoundary>

                {/* Toolbar — pushed to the right */}
                <div className="ml-auto flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="Device Manager"
                        className="size-8"
                        onClick={handleLaunchDeviceManager}
                        size="icon"
                        variant="ghost"
                      >
                        <Cpu aria-hidden="true" className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Device Manager</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label="Launch Terminal"
                        className="size-8"
                        onClick={handleLaunchTerminal}
                        size="icon"
                        variant="ghost"
                      >
                        <SquareTerminal aria-hidden="true" className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Launch Terminal</TooltipContent>
                  </Tooltip>

                  <ThemeToggle />

                  <Separator
                    className="mx-1 data-[orientation=vertical]:h-4"
                    orientation="vertical"
                  />

                  {/* Shell panel toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={
                          isLogOpen && activeTab === 'shell' ? 'Close Shell' : 'Open Shell'
                        }
                        className={cn(
                          'size-8',
                          isLogOpen && activeTab === 'shell' && 'bg-accent text-accent-foreground',
                        )}
                        onClick={handleOpenShellPanel}
                        size="icon"
                        variant="ghost"
                      >
                        <Terminal aria-hidden="true" className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {isLogOpen && activeTab === 'shell' ? 'Close Shell' : 'Shell (Ctrl+`)'}
                    </TooltipContent>
                  </Tooltip>

                  {/* Logs panel toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        aria-label={isLogOpen && activeTab === 'logs' ? 'Close Logs' : 'Open Logs'}
                        className={cn(
                          'relative size-8',
                          isLogOpen && activeTab === 'logs' && 'bg-accent text-accent-foreground',
                        )}
                        onClick={handleOpenLogsPanel}
                        size="icon"
                        variant="ghost"
                      >
                        <Logs aria-hidden="true" className="size-4" />
                        {!isLogOpen && unreadCount > 0 && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 font-bold text-[9px] text-white"
                          >
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {isLogOpen && activeTab === 'logs' ? 'Close Logs' : 'Logs'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </header>

              {/* Main content area — scroll area gets bottom padding so content under panel is reachable */}
              <div
                className="custom-scroll main-scroll-area flex-1 overflow-y-auto overflow-x-hidden"
                id="main-content"
                role="main"
                style={{ paddingBottom: mainPaddingBottom }}
                tabIndex={-1}
              >
                <div className="min-h-full w-full p-4 sm:p-6">
                  <div className="mx-auto max-w-(--content-max-width)">
                    <AnimatePresence mode="wait">
                      <motion.div
                        animate={{ opacity: 1 }}
                        className="w-full"
                        exit={{ opacity: 0 }}
                        initial={{ opacity: 0 }}
                        key={activeView}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                      >
                        <ErrorBoundary key={activeView} viewName={activeView}>
                          {activeViewContent}
                        </ErrorBoundary>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              {/* BottomPanel: fixed to viewport, uses useSidebar() for left offset */}
              {activeView !== VIEWS.ABOUT && (
                <ErrorBoundary viewName="Bottom Panel">
                  <BottomPanel viewportHeight={viewportHeight} />
                </ErrorBoundary>
              )}
            </SidebarInset>
          </SidebarProvider>
        </div>
        <span aria-live="polite" className="sr-only">
          {!isLogOpen && unreadCount > 0
            ? `${unreadCount} new log${unreadCount === 1 ? '' : 's'}`
            : ''}
        </span>
        <Toaster closeButton position="top-right" richColors />
      </MotionConfig>
    </ThemeProvider>
  );
}
