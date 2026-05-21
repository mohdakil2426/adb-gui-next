import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import '@/styles/global.css';
import { AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { AppSidebar } from '@/app/shell/AppSidebar';
import { BottomPanel } from '@/app/shell/BottomPanel/BottomPanel';
import { Header } from '@/app/shell/Header';
import { LoadingScreen } from '@/app/shell/LoadingScreen';
import { ViewContent } from '@/app/shell/ViewContent';
import { VIEW_RENDERERS, VIEWS, type ViewType } from '@/app/shell/viewConfig';
import { LaunchDeviceManager, LaunchTerminal } from '@/desktop/backend';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { ThemeProvider } from '@/shared/components/ThemeProvider';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar';
import { Toaster } from '@/shared/ui/sonner';
import { cn } from '@/shared/utils/cn';
import { isMac } from '@/shared/utils/platform';
import { fetchAllDevices, queryKeys, STALE_TIME } from '@/shared/utils/queries';

const LOADING_DURATION = 750;
const PANEL_MAXIMIZED_HEIGHT_RATIO = 0.7;
const DEFAULT_PANEL_HEIGHT = 300;

export function MainLayout() {
  const shouldReduceMotion = useReducedMotion();
  const [activeView, setActiveView] = useState<ViewType>(VIEWS.DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const viewportHeight = useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb);
      return () => window.removeEventListener('resize', cb);
    },
    () => window.innerHeight,
    () => 800,
  );

  const togglePanel = useLogStore((state) => state.togglePanel);
  const isLogOpen = useLogStore((state) => state.isOpen);
  const setActiveTab = useLogStore((state) => state.setActiveTab);
  const unreadCount = useLogStore((state) => state.unreadCount);
  const activeTab = useLogStore((state) => state.activeTab);
  const panelHeight = useLogStore((state) => state.panelHeight);
  const isPanelMaximized = useLogStore((state) => state.isPanelMaximized);
  const setDevices = useDeviceStore((state) => state.setDevices);

  // ── Centralized device polling ─────────────────────────────────────────
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
    const label = isMac ? 'System Information' : 'Device Manager';
    try {
      await LaunchDeviceManager();
      toast.success(`${label} launched successfully`);
    } catch (error) {
      toast.error(`Failed to launch ${label}: ${error}`);
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

  // Smart panel toggle: closed->open+tab, open+same-tab->close, open+other-tab->switch
  const handleOpenShellPanel = useCallback(() => {
    if (!isLogOpen) {
      togglePanel();
      setActiveTab('shell');
    } else if (activeTab === 'shell') {
      togglePanel();
    } else {
      setActiveTab('shell');
    }
  }, [activeTab, isLogOpen, setActiveTab, togglePanel]);

  const handleOpenLogsPanel = useCallback(() => {
    if (!isLogOpen) {
      togglePanel();
      setActiveTab('logs');
    } else if (activeTab === 'logs') {
      togglePanel();
    } else {
      setActiveTab('logs');
    }
  }, [activeTab, isLogOpen, setActiveTab, togglePanel]);

  // ── Loading animation ──────────────────────────────────────────────────
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

  const mainPaddingBottom =
    isLogOpen && activeView !== VIEWS.ABOUT
      ? `${isPanelMaximized ? viewportHeight * PANEL_MAXIMIZED_HEIGHT_RATIO : panelHeight || DEFAULT_PANEL_HEIGHT}px`
      : undefined;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {isLoading ? (
            <LoadingScreen progress={progress} shouldReduceMotion={shouldReduceMotion ?? false} />
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
              <AppSidebar activeView={activeView} onViewChange={setActiveView} />
            </ErrorBoundary>
            <SidebarInset>
              <Header
                activeTab={activeTab}
                isDeviceRefreshing={isDeviceRefreshing}
                isLogOpen={isLogOpen}
                onLaunchDeviceManager={handleLaunchDeviceManager}
                onLaunchTerminal={handleLaunchTerminal}
                onOpenLogsPanel={handleOpenLogsPanel}
                onOpenShellPanel={handleOpenShellPanel}
                onRefreshDevices={refreshDevices}
                unreadCount={unreadCount}
              />
              <ViewContent
                activeView={activeView}
                mainPaddingBottom={mainPaddingBottom}
                renderContent={(view) => VIEW_RENDERERS[view](view)}
              />
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
