import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import {
  Copy,
  Filter,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { SaveLog } from '@/desktop/backend';
import type { LogLevel } from '@/shared/stores/logStore';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Separator } from '@/shared/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { debugLog } from '@/shared/utils/debug';

const FILTER_OPTIONS: { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
];

interface PanelHeaderActionsProps {
  activeTab: 'logs' | 'shell';
  clearHistory: () => void;
  clearLogs: () => void;
  filter: LogLevel | 'all';
  isFollowing: boolean;
  isPanelMaximized: boolean;
  isSearchOpen: boolean;
  logs: Array<{ timestamp: string; type: string; message: string }>;
  setFilter: (filter: LogLevel | 'all') => void;
  setIsFollowing: (following: boolean) => void;
  setIsSearchOpen: (open: boolean) => void;
  toggleMaximized: () => void;
  togglePanel: () => void;
}

export function PanelHeaderActions({
  activeTab,
  logs,
  filter,
  setFilter,
  isFollowing,
  setIsFollowing,
  isPanelMaximized,
  toggleMaximized,
  togglePanel,
  clearLogs,
  clearHistory,
  isSearchOpen,
  setIsSearchOpen,
}: PanelHeaderActionsProps) {
  const handleCopy = async () => {
    const text = logs
      .map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`)
      .join('\n');
    try {
      await writeText(text);
      toast.info('Logs copied to clipboard');
    } catch {
      toast.error('Failed to copy logs to clipboard');
    }
  };

  const handleSave = async () => {
    const text = logs
      .map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`)
      .join('\n');
    const toastId = toast.loading('Saving logs...');
    try {
      const path = await SaveLog(text, 'terminal-logs');
      toast.success('Logs Saved', {
        description: `Saved to ${path}`,
        id: toastId,
      });
    } catch (error) {
      debugLog('Failed to save logs', error);
      toast.error('Save Failed', { description: String(error), id: toastId });
    }
  };

  const handleClear = () => {
    if (activeTab === 'logs') {
      clearLogs();
    } else {
      clearHistory();
    }
  };

  // Component references (not JSX ternaries) keep follow/maximize icons simple
  // without multiplying PanelHeaderActions into explicit boolean-variant components.
  const FollowIcon = isFollowing ? Pin : PinOff;
  const MaximizeIcon = isPanelMaximized ? Minimize2 : Maximize2;

  return (
    <div className="flex items-center gap-0.5">
      {activeTab === 'logs' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={isSearchOpen ? 'Close Log Search' : 'Search Logs'}
              className={cn(
                'size-6',
                isSearchOpen ? 'opacity-100' : 'opacity-60 hover:opacity-100',
              )}
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
              }}
              size="icon"
              style={{ color: 'var(--terminal-fg)' }}
              variant="ghost"
            >
              <Search aria-hidden="true" className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Search Logs</TooltipContent>
        </Tooltip>
      )}

      {activeTab === 'logs' && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Filter Logs"
                  className={cn(
                    'size-6',
                    filter === 'all' ? 'opacity-60 hover:opacity-100' : 'opacity-100',
                  )}
                  size="icon"
                  style={{ color: 'var(--terminal-fg)' }}
                  variant="ghost"
                >
                  <Filter aria-hidden="true" className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Filter Logs</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            className="w-40"
            style={{
              backgroundColor: 'var(--terminal-header-bg)',
              borderColor: 'var(--terminal-border)',
              color: 'var(--terminal-fg)',
            }}
          >
            <DropdownMenuLabel>Filter logs</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                setFilter(value as LogLevel | 'all');
              }}
              value={filter}
            >
              {FILTER_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {activeTab === 'logs' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={isFollowing ? 'Pause Log Following' : 'Follow Latest Logs'}
              className={cn('size-6', isFollowing ? 'opacity-100' : 'opacity-60 hover:opacity-100')}
              onClick={() => {
                setIsFollowing(!isFollowing);
              }}
              size="icon"
              style={{ color: 'var(--terminal-fg)' }}
              variant="ghost"
            >
              <FollowIcon aria-hidden="true" className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isFollowing ? 'Following Output' : 'Scroll Paused'}
          </TooltipContent>
        </Tooltip>
      )}

      <Separator className="mx-1 h-4" orientation="vertical" />

      {activeTab === 'logs' && logs.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Copy Logs"
              className="size-6 opacity-60 hover:opacity-100"
              onClick={handleCopy}
              size="icon"
              style={{ color: 'var(--terminal-fg)' }}
              variant="ghost"
            >
              <Copy aria-hidden="true" className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Copy Logs</TooltipContent>
        </Tooltip>
      )}

      {activeTab === 'logs' && logs.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="Save Logs"
              className="size-6 opacity-60 hover:opacity-100"
              onClick={handleSave}
              size="icon"
              style={{ color: 'var(--terminal-fg)' }}
              variant="ghost"
            >
              <Save aria-hidden="true" className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Save Logs</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={activeTab === 'logs' ? 'Clear Logs' : 'Clear Shell'}
            className="size-6 opacity-60 hover:opacity-100"
            onClick={handleClear}
            size="icon"
            style={{ color: 'var(--terminal-fg)' }}
            variant="ghost"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Clear {activeTab === 'logs' ? 'Logs' : 'Shell'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={isPanelMaximized ? 'Restore Panel' : 'Maximize Panel'}
            className="size-6 opacity-60 hover:opacity-100"
            onClick={toggleMaximized}
            size="icon"
            style={{ color: 'var(--terminal-fg)' }}
            variant="ghost"
          >
            <MaximizeIcon aria-hidden="true" className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isPanelMaximized ? 'Restore Panel' : 'Maximize Panel'}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Close Panel"
            className="size-6 opacity-60 hover:opacity-100"
            onClick={togglePanel}
            size="icon"
            style={{ color: 'var(--terminal-fg)' }}
            variant="ghost"
          >
            <X aria-hidden="true" className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Close Panel (Ctrl+`)</TooltipContent>
      </Tooltip>
    </div>
  );
}
