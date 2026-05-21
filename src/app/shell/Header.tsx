import { Cpu, Logs, SquareTerminal, Terminal } from 'lucide-react';
import { DeviceSwitcher } from '@/shared/components/DeviceSwitcher';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { Button } from '@/shared/ui/button';
import { Separator } from '@/shared/ui/separator';
import { SidebarTrigger } from '@/shared/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { isLinux, isMac } from '@/shared/utils/platform';

interface HeaderProps {
  activeTab: string;
  isDeviceRefreshing: boolean;
  isLogOpen: boolean;
  onLaunchDeviceManager: () => void;
  onLaunchTerminal: () => void;
  onOpenLogsPanel: () => void;
  onOpenShellPanel: () => void;
  onRefreshDevices: () => void;
  unreadCount: number;
}

export function Header({
  isDeviceRefreshing,
  onRefreshDevices,
  isLogOpen,
  activeTab,
  unreadCount,
  onOpenShellPanel,
  onOpenLogsPanel,
  onLaunchDeviceManager,
  onLaunchTerminal,
}: HeaderProps) {
  return (
    <header className="z-10 flex h-12 shrink-0 items-center gap-2 border-border/50 border-b bg-background/95 px-4 backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-10">
      <SidebarTrigger aria-label="Toggle Sidebar" className="-ml-1" />
      <Separator className="mr-2 data-[orientation=vertical]:h-4" orientation="vertical" />

      {/* Device Switcher — global device status + multi-device dropdown */}
      <ErrorBoundary viewName="Device Switcher">
        <DeviceSwitcher isRefreshing={isDeviceRefreshing} onRefresh={onRefreshDevices} />
      </ErrorBoundary>

      {/* Toolbar — pushed to the right */}
      <div className="ml-auto flex items-center gap-1.5">
        {!isLinux && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={isMac ? 'System Information' : 'Device Manager'}
                className="size-8"
                onClick={onLaunchDeviceManager}
                size="icon"
                variant="ghost"
              >
                <Cpu aria-hidden="true" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isMac ? 'System Information' : 'Device Manager'}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Launch Terminal"
              className="size-8"
              onClick={onLaunchTerminal}
              size="icon"
              variant="ghost"
            >
              <SquareTerminal aria-hidden="true" className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Launch Terminal</TooltipContent>
        </Tooltip>

        <ThemeToggle />

        <Separator className="mx-1 data-[orientation=vertical]:h-4" orientation="vertical" />

        {/* Shell panel toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={isLogOpen && activeTab === 'shell' ? 'Close Shell' : 'Open Shell'}
              className={cn(
                'size-8',
                isLogOpen && activeTab === 'shell' && 'bg-accent text-accent-foreground',
              )}
              onClick={onOpenShellPanel}
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
              onClick={onOpenLogsPanel}
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
  );
}
