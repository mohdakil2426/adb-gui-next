import { ChevronRight, Cpu, Logs, Search, SquareTerminal, Terminal } from 'lucide-react';
import type { ViewType } from '@/app/shell/viewConfig';
import { sectionForView, VIEW_META } from '@/shared/commands/navigation';
import { MOD_KEY } from '@/shared/commands/shortcuts';
import { DeviceSwitcher } from '@/shared/components/DeviceSwitcher';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { UnreadLogBadge } from '@/shared/components/UnreadLogBadge';
import { Button } from '@/shared/ui/button';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { Separator } from '@/shared/ui/separator';
import { SidebarTrigger } from '@/shared/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { isLinux, isMac } from '@/shared/utils/platform';

interface HeaderProps {
  activeTab: 'logs' | 'shell';
  activeView: ViewType;
  isDeviceRefreshing: boolean;
  isLogOpen: boolean;
  onLaunchDeviceManager: () => void;
  onLaunchTerminal: () => void;
  onOpenCommandPalette: () => void;
  onOpenLogsPanel: () => void;
  onOpenShellPanel: () => void;
  onRefreshDevices: () => void;
}

/**
 * 44px application header.
 *
 * Carries the app's only visible wayfinding: a section breadcrumb plus the page
 * title, both driven by `VIEW_META`. The title is deliberately *not* an `<h1>` —
 * each view still owns its own (screen-reader) heading, so promoting this would
 * give every page two.
 */
export function Header({
  activeTab,
  activeView,
  isDeviceRefreshing,
  isLogOpen,
  onLaunchDeviceManager,
  onLaunchTerminal,
  onOpenCommandPalette,
  onOpenLogsPanel,
  onOpenShellPanel,
  onRefreshDevices,
}: HeaderProps) {
  const meta = VIEW_META[activeView];
  const section = sectionForView(activeView);
  const deviceManagerLabel = isMac ? 'System Information' : 'Device Manager';

  return (
    <header className="z-(--z-sticky) flex h-11 shrink-0 items-center gap-2 border-border border-b bg-surface px-3">
      <SidebarTrigger aria-label="Toggle Sidebar" className="-ml-1 size-8" />
      <Separator className="data-[orientation=vertical]:h-4" orientation="vertical" />

      <div className="flex min-w-0 items-center gap-1.5">
        {section ? (
          <>
            <span className="shrink-0 text-caption text-muted-foreground uppercase">
              {section.label}
            </span>
            <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-foreground-subtle" />
          </>
        ) : null}
        <span className="truncate text-title" title={meta.description}>
          {meta.title}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          className="h-8 gap-2 px-2 text-muted-foreground"
          onClick={onOpenCommandPalette}
          size="sm"
          variant="outline"
        >
          <Search aria-hidden="true" className="size-3.5" />
          <span className="text-label">Search</span>
          <KbdGroup>
            <Kbd>{MOD_KEY}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>

        {/* Global device status + multi-device dropdown */}
        <ErrorBoundary viewName="Device Switcher">
          <DeviceSwitcher isRefreshing={isDeviceRefreshing} onRefresh={onRefreshDevices} />
        </ErrorBoundary>

        {isLinux ? null : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={deviceManagerLabel}
                className="size-8"
                onClick={onLaunchDeviceManager}
                size="icon"
                variant="ghost"
              >
                <Cpu aria-hidden="true" className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{deviceManagerLabel}</TooltipContent>
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

        {/* `ThemeToggle` hard-codes size-9; a `display:contents` wrapper normalises
            it to the 32px header control size without forking the shared component. */}
        <span className="contents [&_button]:size-8">
          <ThemeToggle />
        </span>

        <Separator className="mx-1 data-[orientation=vertical]:h-4" orientation="vertical" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={isLogOpen && activeTab === 'shell' ? 'Close Shell' : 'Open Shell'}
              className={cn(
                'size-8',
                // `bg-accent` alone is 1.17:1 against the surface — invisible as a
                // state indicator (SC 1.4.11 wants 3:1). The primary-tinted glyph
                // carries the state; the tint is only reinforcement.
                isLogOpen && activeTab === 'shell' && 'bg-accent-active text-primary',
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={isLogOpen && activeTab === 'logs' ? 'Close Logs' : 'Open Logs'}
              className={cn(
                'relative size-8',
                isLogOpen && activeTab === 'logs' && 'bg-accent-active text-primary',
              )}
              onClick={onOpenLogsPanel}
              size="icon"
              variant="ghost"
            >
              <Logs aria-hidden="true" className="size-4" />
              <UnreadLogBadge />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isLogOpen && activeTab === 'logs' ? 'Close Logs' : 'Logs (Ctrl+`)'}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
