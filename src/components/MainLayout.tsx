import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import '@/styles/global.css';
import { Cpu, Terminal, Logs, SquareTerminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';

import { ViewDashboard } from './views/ViewDashboard';
import { ViewAppManager } from './views/ViewAppManager';
import { ViewFileExplorer } from './views/ViewFileExplorer';
import { ViewFlasher } from './views/ViewFlasher';
import { ViewUtilities } from './views/ViewUtilities';
import { ViewPayloadDumper } from './views/ViewPayloadDumper';
import { ViewMarketplace } from './views/ViewMarketplace';
import { ViewEmulatorManager } from './views/ViewEmulatorManager';
import { ViewAbout } from './views/ViewAbout';
import { Toaster } from '@/components/ui/sonner';
import { BottomPanel } from './BottomPanel';
import { useLogStore } from '@/lib/logStore';
import { useDeviceStore } from '@/lib/deviceStore';
import { DeviceSwitcher } from './DeviceSwitcher';
import { queryKeys, fetchAllDevices } from '@/lib/queries';

import { ThemeProvider } from './ThemeProvider';
import { WelcomeScreen } from './WelcomeScreen';
import { LaunchDeviceManager, LaunchTerminal } from '@/lib/desktop/backend';
import { toast } from 'sonner';
import { ErrorBoundary } from './ErrorBoundary';

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
    refetchInterval: 3000,
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

    return () => cancelAnimationFrame(animationFrame);
  }, [shouldReduceMotion]);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeViewContent = VIEW_RENDERERS[activeView](activeView);
  const mainPaddingBottom =
    isLogOpen && activeView !== VIEWS.ABOUT
      ? `${isPanelMaximized ? viewportHeight * PANEL_MAXIMIZED_HEIGHT_RATIO : panelHeight || DEFAULT_PANEL_HEIGHT}px`
      : undefined;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {isLoading && (
            <motion.div
              key="welcome-screen"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
              className="absolute inset-0 z-50"
            >
              <WelcomeScreen progress={progress} />
            </motion.div>
          )}
        </AnimatePresence>
        <div
          className={cn(
            'h-svh overflow-hidden',
            isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500 ease-in-out',
          )}
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-toast)] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring"
          >
            Skip to main content
          </a>
          <SidebarProvider>
            <ErrorBoundary viewName="Sidebar">
              <AppSidebar activeView={activeView} onViewChange={handleViewChange} />
            </ErrorBoundary>
            <SidebarInset>
              {/* Header bar — sits above scroll area in the flex-col SidebarInset, never scrolls */}
              <header className="shrink-0 z-10 flex h-12 items-center gap-2 border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
                <SidebarTrigger className="-ml-1" aria-label="Toggle Sidebar" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
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
                        variant="ghost"
                        size="icon"
                        aria-label="Device Manager"
                        className="size-8"
                        onClick={handleLaunchDeviceManager}
                      >
                        <Cpu aria-hidden="true" className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Device Manager</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Launch Terminal"
                        className="size-8"
                        onClick={handleLaunchTerminal}
                      >
                        <SquareTerminal aria-hidden="true" className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Launch Terminal</TooltipContent>
                  </Tooltip>

                  <Separator
                    orientation="vertical"
                    className="mx-1 data-[orientation=vertical]:h-4"
                  />

                  {/* Shell panel toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          isLogOpen && activeTab === 'shell' ? 'Close Shell' : 'Open Shell'
                        }
                        className={cn(
                          'size-8',
                          isLogOpen && activeTab === 'shell' && 'bg-accent text-accent-foreground',
                        )}
                        onClick={handleOpenShellPanel}
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
                        variant="ghost"
                        size="icon"
                        aria-label={isLogOpen && activeTab === 'logs' ? 'Close Logs' : 'Open Logs'}
                        className={cn(
                          'size-8 relative',
                          isLogOpen && activeTab === 'logs' && 'bg-accent text-accent-foreground',
                        )}
                        onClick={handleOpenLogsPanel}
                      >
                        <Logs aria-hidden="true" className="size-4" />
                        {!isLogOpen && unreadCount > 0 && (
                          <span
                            className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center px-0.5"
                            aria-hidden="true"
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
                id="main-content"
                role="main"
                tabIndex={-1}
                className="flex-1 overflow-y-auto overflow-x-hidden custom-scroll main-scroll-area"
                style={{ paddingBottom: mainPaddingBottom }}
              >
                <div className="min-h-full w-full p-4 sm:p-6">
                  <div className="max-w-(--content-max-width) mx-auto">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeView}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="w-full"
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
        <Toaster position="bottom-right" richColors closeButton />
      </MotionConfig>
    </ThemeProvider>
  );
}
