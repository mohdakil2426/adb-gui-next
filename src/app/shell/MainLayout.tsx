import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import '@/styles/global.css';
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  MotionConfig,
  useReducedMotion,
} from 'framer-motion';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { AppSidebar } from '@/app/shell/AppSidebar';
import { BottomPanel } from '@/app/shell/BottomPanel/BottomPanel';
import { CommandPalette } from '@/app/shell/CommandPalette';
import { Header } from '@/app/shell/Header';
import { LoadingScreen } from '@/app/shell/LoadingScreen';
import { type AdbServerState, StatusBar } from '@/app/shell/StatusBar';
import { ViewContent } from '@/app/shell/ViewContent';
import { VIEW_RENDERERS, VIEWS, type ViewType } from '@/app/shell/viewConfig';
import { LaunchDeviceManager, LaunchTerminal } from '@/desktop/backend';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { UnreadLogAnnouncer } from '@/shared/components/UnreadLogBadge';
import { useAppReady } from '@/shared/hooks/useAppReady';
import { useGlobalShortcuts } from '@/shared/hooks/useGlobalShortcuts';
import { usePersistedActiveView } from '@/shared/hooks/usePersistedActiveView';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar';
import { cn } from '@/shared/utils/cn';
import { handleError } from '@/shared/utils/errorHandler';
import { isMac } from '@/shared/utils/platform';
import { fetchAllDevices, queryKeys, STALE_TIME } from '@/shared/utils/queries';

const PANEL_MAXIMIZED_HEIGHT_RATIO = 0.7;
const DEFAULT_PANEL_HEIGHT = 300;

/**
 * Stable module-level reference so the memoized `ViewContent` is not invalidated
 * on every `MainLayout` render.
 */
const renderView = (view: ViewType) => VIEW_RENDERERS[view](view);

function resolveAdbState(isError: boolean, isPending: boolean): AdbServerState {
  if (isError) {
    return 'unreachable';
  }
  if (isPending) {
    return 'checking';
  }
  return 'ready';
}

export function MainLayout() {
  const shouldReduceMotion = useReducedMotion();
  const { activeView, setActiveView } = usePersistedActiveView();
  const isReady = useAppReady();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
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
  const activeTab = useLogStore((state) => state.activeTab);
  const panelHeight = useLogStore((state) => state.panelHeight);
  const isPanelMaximized = useLogStore((state) => state.isPanelMaximized);
  const setDevices = useDeviceStore((state) => state.setDevices);

  // ── Centralized device polling ─────────────────────────────────────────
  const {
    isError: isDeviceError,
    isFetching: isDeviceRefreshing,
    isPending: isDevicePending,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: queryKeys.allDevices(),
    queryFn: async () => {
      try {
        const list = await fetchAllDevices();
        setDevices(list);
        return list;
      } catch (error) {
        handleError('Device Poll', error);
        throw error;
      }
    },
    refetchInterval: STALE_TIME.ALL_DEVICES,
    staleTime: STALE_TIME.ALL_DEVICES,
  });

  const refreshDevices = useCallback(() => {
    void refetchDevices();
  }, [refetchDevices]);

  const { resolvedTheme, setTheme } = useTheme();
  const togglePalette = useCallback(() => {
    setIsPaletteOpen((open) => !open);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const openPalette = useCallback(() => {
    setIsPaletteOpen(true);
  }, []);

  useGlobalShortcuts({
    onTogglePalette: togglePalette,
    onToggleTheme: toggleTheme,
  });
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
  const handleTogglePanel = useCallback(
    (tab: 'logs' | 'shell') => {
      if (!isLogOpen) {
        togglePanel();
        setActiveTab(tab);
        return;
      }
      if (activeTab === tab) {
        togglePanel();
        return;
      }
      setActiveTab(tab);
    },
    [activeTab, isLogOpen, setActiveTab, togglePanel],
  );

  const handleOpenShellPanel = useCallback(() => {
    handleTogglePanel('shell');
  }, [handleTogglePanel]);

  const handleOpenLogsPanel = useCallback(() => {
    handleTogglePanel('logs');
  }, [handleTogglePanel]);

  const isPanelMounted = activeView !== VIEWS.ABOUT;
  // The panel itself is still `position: fixed`; this dock reserves its height in
  // the flex column so `<main>` gets an honest size instead of a paddingBottom hack.
  const panelDockHeight = isPanelMaximized
    ? viewportHeight * PANEL_MAXIMIZED_HEIGHT_RATIO
    : panelHeight || DEFAULT_PANEL_HEIGHT;

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {isReady ? null : (
            <LoadingScreen
              progress={isReady ? 100 : 0}
              shouldReduceMotion={shouldReduceMotion ?? false}
            />
          )}
        </AnimatePresence>
        <div
          className={cn(
            'h-svh overflow-hidden bg-background text-foreground',
            isReady ? 'opacity-100 transition-opacity duration-300 ease-out' : 'opacity-0',
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
              <AppSidebar
                activeView={activeView}
                onOpenDevicePicker={openPalette}
                onViewChange={setActiveView}
              />
            </ErrorBoundary>
            <SidebarInset>
              <Header
                activeTab={activeTab}
                activeView={activeView}
                isDeviceRefreshing={isDeviceRefreshing}
                isLogOpen={isLogOpen}
                onLaunchDeviceManager={handleLaunchDeviceManager}
                onLaunchTerminal={handleLaunchTerminal}
                onOpenCommandPalette={openPalette}
                onOpenLogsPanel={handleOpenLogsPanel}
                onOpenShellPanel={handleOpenShellPanel}
                onRefreshDevices={refreshDevices}
              />
              <ViewContent activeView={activeView} renderContent={renderView} />
              <StatusBar adbState={resolveAdbState(isDeviceError, isDevicePending)} />
              {isPanelMounted ? (
                <>
                  {isLogOpen ? (
                    <div
                      aria-hidden="true"
                      className="shrink-0"
                      style={{ height: `${panelDockHeight}px` }}
                    />
                  ) : null}
                  <ErrorBoundary viewName="Bottom Panel">
                    <BottomPanel viewportHeight={viewportHeight} />
                  </ErrorBoundary>
                </>
              ) : null}
            </SidebarInset>
            <CommandPalette
              activeView={activeView}
              onLaunchDeviceManager={handleLaunchDeviceManager}
              onLaunchTerminal={handleLaunchTerminal}
              onOpenChange={setIsPaletteOpen}
              onRefreshDevices={refreshDevices}
              onTogglePanel={handleTogglePanel}
              onViewChange={setActiveView}
              open={isPaletteOpen}
            />
          </SidebarProvider>
        </div>
        <UnreadLogAnnouncer />
      </MotionConfig>
    </LazyMotion>
  );
}
