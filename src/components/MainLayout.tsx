import { useState, useEffect } from 'react';
import '@/styles/global.css';
import { Cpu, Terminal, Logs, SquareTerminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';

import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';

import { ViewDashboard } from './views/ViewDashboard';
import { ViewAppManager } from './views/ViewAppManager';
import { ViewFileExplorer } from './views/ViewFileExplorer';
import { ViewFlasher } from './views/ViewFlasher';
import { ViewUtilities } from './views/ViewUtilities';
import { ViewPayloadDumper } from './views/ViewPayloadDumper';
import { ViewAbout } from './views/ViewAbout';
import { Toaster } from '@/components/ui/sonner';
import { BottomPanel } from './BottomPanel';
import { useLogStore } from '@/lib/logStore';

import { ThemeProvider } from './ThemeProvider';
import { WelcomeScreen } from './WelcomeScreen';
import { LaunchDeviceManager, LaunchTerminal } from '@/lib/desktop/backend';
import { toast } from 'sonner';

const VIEWS = {
  DASHBOARD: 'dashboard',
  APPS: 'apps',
  FILES: 'files',
  FLASHER: 'flasher',
  UTILS: 'utils',
  PAYLOAD: 'payload',
  ABOUT: 'about',
} as const;

type ViewType = (typeof VIEWS)[keyof typeof VIEWS];

const LOADING_DURATION = 750;

const VIEW_LABELS: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  apps: 'Applications',
  files: 'File Explorer',
  flasher: 'Flasher',
  utils: 'Utilities',
  payload: 'Payload Dumper',
  about: 'About',
};

export function MainLayout() {
  const [activeView, setActiveView] = useState<ViewType>(VIEWS.DASHBOARD);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const { togglePanel, isOpen: isLogOpen, setActiveTab, unreadCount, activeTab } = useLogStore();

  const handleLaunchDeviceManager = async () => {
    try {
      await LaunchDeviceManager();
      toast.success('Device Manager launched successfully');
    } catch (error) {
      toast.error(`Failed to launch Device Manager: ${error}`);
    }
  };

  const handleLaunchTerminal = async () => {
    try {
      await LaunchTerminal();
      toast.success('Terminal launched successfully');
    } catch (error) {
      toast.error(`Failed to launch Terminal: ${error}`);
    }
  };

  const handleOpenShellPanel = () => {
    if (!isLogOpen) {
      togglePanel();
    }
    setActiveTab('shell');
  };

  const renderActiveView = () => {
    switch (activeView) {
      case VIEWS.DASHBOARD:
        return <ViewDashboard activeView={activeView} />;
      case VIEWS.APPS:
        return <ViewAppManager activeView={activeView} />;
      case VIEWS.FILES:
        return <ViewFileExplorer activeView={activeView} />;
      case VIEWS.FLASHER:
        return <ViewFlasher activeView={activeView} />;
      case VIEWS.UTILS:
        return <ViewUtilities activeView={activeView} />;
      case VIEWS.PAYLOAD:
        return <ViewPayloadDumper activeView={activeView} />;
      case VIEWS.ABOUT:
        return <ViewAbout activeView={activeView} />;
      default:
        return <ViewDashboard activeView={activeView} />;
    }
  };

  useEffect(() => {
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
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="welcome-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-50"
          >
            <WelcomeScreen progress={progress} />
          </motion.div>
        )}
      </AnimatePresence>
      <div
        className={cn(
          isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500 ease-in-out',
        )}
      >
        <SidebarProvider>
          <AppSidebar
            activeView={activeView}
            onViewChange={(view) => setActiveView(view as ViewType)}
          />
          <SidebarInset>
            {/* Header bar with sidebar trigger and toolbar */}
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/50 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <span className="text-sm font-medium text-muted-foreground">
                {VIEW_LABELS[activeView]}
              </span>

              {/* Toolbar — pushed to the right */}
              <div className="ml-auto flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={handleLaunchDeviceManager}
                    >
                      <Cpu className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Device Manager</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={handleLaunchTerminal}
                    >
                      <SquareTerminal className="size-4" />
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
                      className={cn(
                        'size-8',
                        isLogOpen && activeTab === 'shell' && 'bg-accent text-accent-foreground',
                      )}
                      onClick={handleOpenShellPanel}
                    >
                      <Terminal className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Shell (Ctrl+`)</TooltipContent>
                </Tooltip>

                {/* Logs panel toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'size-8 relative',
                        isLogOpen && activeTab === 'logs' && 'bg-accent text-accent-foreground',
                      )}
                      onClick={togglePanel}
                    >
                      <Logs className="size-4" />
                      {!isLogOpen && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{isLogOpen ? 'Close Logs' : 'Logs'}</TooltipContent>
                </Tooltip>
              </div>
            </header>

            {/* Main content area */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-auto custom-scroll">
                <div
                  className={cn(
                    'min-h-full min-w-(--content-min-width)',
                    activeView === VIEWS.ABOUT ? 'p-4 sm:p-6' : 'p-4 sm:p-6',
                  )}
                >
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
                        {renderActiveView()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <BottomPanel />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
