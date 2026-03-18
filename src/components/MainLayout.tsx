'use client';

import React, { useState, useEffect } from 'react';
import '@/styles/global.css';
import {
  LayoutDashboard,
  Box,
  FolderOpen,
  Terminal,
  SquareTerminal,
  Settings,
  ChevronLeft,
  Info,
  Logs,
  Cpu,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';

import { ViewDashboard } from './views/ViewDashboard';
import { ViewAppManager } from './views/ViewAppManager';
import { ViewFileExplorer } from './views/ViewFileExplorer';
import { ViewFlasher } from './views/ViewFlasher';
import { ViewUtilities } from './views/ViewUtilities';
import { ViewPayloadDumper } from './views/ViewPayloadDumper';
import { ViewAbout } from './views/ViewAbout';
import { Toaster } from '@/components/ui/sonner';
import { TerminalLogPanel } from './TerminalLogPanel';
import { useLogStore } from '@/lib/logStore';

import { ThemeToggle } from './ThemeToggle';
import { ThemeProvider } from './ThemeProvider';
import { WelcomeScreen } from './WelcomeScreen';
import { ViewShell } from './views/ViewShell';
import { LaunchDeviceManager, LaunchTerminal } from '../lib/desktop/backend';
import { toast } from 'sonner';

const VIEWS = {
  DASHBOARD: 'dashboard',
  APPS: 'apps',
  FILES: 'files',
  FLASHER: 'flasher',
  UTILS: 'utils',
  PAYLOAD: 'payload',
  SHELL: 'shell',
  ABOUT: 'about',
} as const;

type ViewType = (typeof VIEWS)[keyof typeof VIEWS];

const LOADING_DURATION = 750;

export type HistoryEntry = {
  type: 'command' | 'result' | 'error';
  text: string;
};

const NAV_ITEMS = [
  { id: VIEWS.DASHBOARD, icon: LayoutDashboard, label: 'Dashboard' },
  { id: VIEWS.APPS, icon: Box, label: 'Application' },
  { id: VIEWS.FILES, icon: FolderOpen, label: 'File' },
  { id: VIEWS.FLASHER, icon: Terminal, label: 'Flasher' },
  { id: VIEWS.UTILS, icon: Settings, label: 'Utility' },
  { id: VIEWS.PAYLOAD, icon: Package, label: 'Payload Dumper' },
  { id: VIEWS.SHELL, icon: Terminal, label: 'Terminal' },
  { id: VIEWS.ABOUT, icon: Info, label: 'About' },
];

export function MainLayout() {
  const [activeView, setActiveView] = useState<ViewType>(VIEWS.DASHBOARD);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [shellHistory, setShellHistory] = useState<HistoryEntry[]>([]);
  const [shellCommandHistory, setShellCommandHistory] = useState<string[]>([]);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const { togglePanel, isOpen: isLogOpen } = useLogStore();

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
      case VIEWS.SHELL:
        return (
          <ViewShell
            activeView={activeView}
            history={shellHistory}
            setHistory={setShellHistory}
            commandHistory={shellCommandHistory}
            setCommandHistory={setShellCommandHistory}
          />
        );
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
      <TooltipProvider delayDuration={0}>
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
            'relative flex h-screen bg-background text-foreground overflow-hidden',
            isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500 ease-in-out',
          )}
        >
          <aside
            className={cn(
              'relative flex flex-col bg-linear-to-b from-muted/50 via-muted/30 to-background border-r border-border/50 backdrop-blur-xl shrink-0 transition-[width] duration-300 ease-in-out will-change-[width]',
              isCollapsed ? 'w-(--sidebar-collapsed-width)' : 'w-(--sidebar-width)',
            )}
          >
            <div
              className={cn(
                'relative h-20 flex items-center border-b border-border/50 gap-3 transition-[padding] duration-300 ease-in-out',
                isCollapsed ? 'px-0 justify-center' : 'pl-6 pr-4 justify-between',
              )}
            >
              <div
                className={cn(
                  'flex items-center gap-3 transition-all duration-300',
                  !isCollapsed && 'w-full',
                  isCollapsed ? 'justify-center' : 'justify-start',
                )}
              >
                <div
                  className={cn('relative transition-all duration-300', isCollapsed && 'mx-auto')}
                >
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <img
                    src="/logo.png"
                    alt="ADB GUI Next logo"
                    className={cn(
                      'relative h-10 w-10 object-contain transition-all duration-300',
                      isCollapsed && 'h-11 w-11',
                    )}
                  />
                </div>

                <div
                  className={cn(
                    'flex flex-col transition-all duration-300 overflow-hidden whitespace-nowrap',
                    isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
                  )}
                >
                  <h1 className="text-xl md:text-2xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent leading-none">
                    ADB GUI Next
                  </h1>
                  <div className="flex items-center gap-1 text-xs font-medium pt-1">
                    <span className="bg-linear-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-bold">
                      Desktop Toolkit
                    </span>
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  'transition-opacity duration-300',
                  isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
                )}
              >
                <ThemeToggle
                  showLabel={false}
                  className="ml-auto w-12 h-12 rounded-2xl border border-border/60 p-0"
                />
              </div>
            </div>

            <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setActiveView(item.id)}
                        onMouseEnter={() => setHoveredItem(item.id)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={cn(
                          'relative w-full rounded-xl transition-all duration-200 overflow-hidden group flex items-center',
                          isCollapsed ? 'h-12 p-0 justify-center' : 'h-12 px-4 gap-3',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                            : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                        )}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        {/* Active Background Indicator */}
                        {isActive && (
                          <motion.div
                            layoutId="activeIndicator"
                            className="absolute inset-0 bg-linear-to-r from-primary to-primary/80 z-0"
                            initial={false}
                            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                          />
                        )}

                        {/* Hover Effect */}
                        {hoveredItem === item.id && !isActive && (
                          <div className="absolute inset-0 bg-linear-to-r from-primary/10 to-primary/5 transition-opacity duration-200" />
                        )}

                        <div className="relative z-10 flex items-center shrink-0">
                          <Icon
                            className={cn(
                              'transition-all duration-300',
                              isActive ? 'h-5 w-5' : 'h-4.5 w-4.5',
                            )}
                          />
                        </div>

                        <span
                          className={cn(
                            'relative z-10 font-medium text-[15px] transition-all duration-300 whitespace-nowrap overflow-hidden',
                            isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100',
                          )}
                        >
                          {item.label}
                        </span>

                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-foreground/30 rounded-r-full z-10" />
                        )}
                      </button>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </nav>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className={cn(
                    'absolute -right-4 top-1/2 -translate-y-1/2 z-20',
                    'h-8 w-8 rounded-2xl',
                    'bg-background border border-border shadow-md',
                    'flex items-center justify-center cursor-pointer',
                    'hover:bg-muted transition-all duration-200',
                    'hover:shadow-lg hover:border-primary/30',
                  )}
                >
                  <div
                    className={cn('transition-transform duration-300', isCollapsed && 'rotate-180')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{isCollapsed ? 'Expand' : 'Collapse'}</TooltipContent>
            </Tooltip>
          </aside>

          <main className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-auto custom-scroll relative">
              {activeView !== VIEWS.ABOUT && (
                <div className="absolute top-4 right-6 z-40 flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="rounded-full shadow-md transition-all bg-card hover:bg-muted"
                        onClick={handleLaunchDeviceManager}
                      >
                        <Cpu className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Device Manager</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="rounded-full shadow-md transition-all bg-card hover:bg-muted"
                        onClick={handleLaunchTerminal}
                      >
                        <SquareTerminal className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Launch Terminal</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className={cn(
                          'rounded-full shadow-md transition-all',
                          isLogOpen
                            ? 'bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90'
                            : 'bg-card text-foreground hover:bg-muted hover:text-foreground',
                        )}
                        onClick={togglePanel}
                      >
                        <Logs className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {isLogOpen ? 'Close Logs' : 'Logs'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              <div
                className={cn(
                  'min-h-full min-w-(--content-min-width)',
                  activeView === VIEWS.ABOUT ? 'p-4 sm:p-6' : 'p-4 sm:p-6 pt-14 sm:pt-16',
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
            <TerminalLogPanel />
          </main>
        </div>
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
