import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import {
  Copy,
  Filter,
  Logs,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  Save,
  Search,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
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
import { Input } from '@/shared/ui/input';
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

interface PanelHeaderProps {
  activeTab: 'logs' | 'shell';
  clearHistory: () => void;
  clearLogs: () => void;
  filter: LogLevel | 'all';
  isFollowing: boolean;
  isPanelMaximized: boolean;
  logs: Array<{ timestamp: string; type: string; message: string }>;
  onTabChange: (tab: 'logs' | 'shell') => void;
  searchQuery: string;
  setFilter: (filter: LogLevel | 'all') => void;
  setIsFollowing: (following: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleMaximized: () => void;
  togglePanel: () => void;
}

export function PanelHeader({
  activeTab,
  onTabChange,
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
  searchQuery,
  setSearchQuery,
}: PanelHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
      const prefix = 'terminal-logs';
      const path = await SaveLog(text, prefix);
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

  return (
    <>
      {/* Panel header */}
      <div
        className="flex h-9 shrink-0 items-center justify-between px-2"
        style={{ backgroundColor: 'var(--terminal-header-bg)' }}
      >
        {/* Left: Tabs */}
        <div aria-label="Bottom panel tabs" className="flex items-center gap-0.5" role="tablist">
          <button
            aria-controls="bottom-panel-logs"
            aria-selected={activeTab === 'logs'}
            className={cn(
              'flex items-center gap-1.5 rounded-t-md px-3 py-1 font-medium text-xs transition-colors',
              activeTab === 'logs' ? 'opacity-100' : 'opacity-60 hover:opacity-80',
            )}
            id="bottom-panel-logs-tab"
            onClick={() => {
              onTabChange('logs');
            }}
            role="tab"
            style={{
              color:
                activeTab === 'logs'
                  ? 'var(--terminal-tab-active)'
                  : 'var(--terminal-tab-inactive)',
              borderBottom:
                activeTab === 'logs'
                  ? '2px solid var(--terminal-tab-active)'
                  : '2px solid transparent',
            }}
            type="button"
          >
            <Logs aria-hidden="true" className="size-3.5" />
            Logs
            {logs.length > 0 && (
              <span className="ml-1 text-[10px] opacity-60">({logs.length})</span>
            )}
          </button>
          <button
            aria-controls="bottom-panel-shell"
            aria-selected={activeTab === 'shell'}
            className={cn(
              'flex items-center gap-1.5 rounded-t-md px-3 py-1 font-medium text-xs transition-colors',
              activeTab === 'shell' ? 'opacity-100' : 'opacity-60 hover:opacity-80',
            )}
            id="bottom-panel-shell-tab"
            onClick={() => {
              onTabChange('shell');
            }}
            role="tab"
            style={{
              color:
                activeTab === 'shell'
                  ? 'var(--terminal-tab-active)'
                  : 'var(--terminal-tab-inactive)',
              borderBottom:
                activeTab === 'shell'
                  ? '2px solid var(--terminal-tab-active)'
                  : '2px solid transparent',
            }}
            type="button"
          >
            <Terminal aria-hidden="true" className="size-3.5" />
            Shell
          </button>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-0.5">
          {/* Search toggle (logs only) */}
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

          {/* Filter toggle (logs only) */}
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

          {/* Follow output toggle (logs only) */}
          {activeTab === 'logs' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={isFollowing ? 'Pause Log Following' : 'Follow Latest Logs'}
                  className={cn(
                    'size-6',
                    isFollowing ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                  )}
                  onClick={() => {
                    setIsFollowing(!isFollowing);
                  }}
                  size="icon"
                  style={{ color: 'var(--terminal-fg)' }}
                  variant="ghost"
                >
                  {isFollowing ? (
                    <Pin aria-hidden="true" className="size-3.5" />
                  ) : (
                    <PinOff aria-hidden="true" className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isFollowing ? 'Following Output' : 'Scroll Paused'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Divider */}
          <Separator className="mx-1 h-4" orientation="vertical" />

          {/* Copy logs */}
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

          {/* Save logs */}
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

          {/* Clear */}
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
            <TooltipContent side="top">
              Clear {activeTab === 'logs' ? 'Logs' : 'Shell'}
            </TooltipContent>
          </Tooltip>

          {/* Maximize / Minimize */}
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
                {isPanelMaximized ? (
                  <Minimize2 aria-hidden="true" className="size-3.5" />
                ) : (
                  <Maximize2 aria-hidden="true" className="size-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isPanelMaximized ? 'Restore Panel' : 'Maximize Panel'}
            </TooltipContent>
          </Tooltip>

          {/* Close */}
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
      </div>

      {/* Search bar (conditionally rendered) */}
      {isSearchOpen && activeTab === 'logs' ? (
        <div
          className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5"
          style={{
            borderColor: 'var(--terminal-border)',
            backgroundColor: 'var(--terminal-header-bg)',
          }}
        >
          <Search
            aria-hidden="true"
            className="size-3.5 opacity-50"
            style={{ color: 'var(--terminal-fg)' }}
          />
          <Input
            aria-label="Search Logs"
            autoFocus
            className="h-6 border-none bg-transparent px-0 font-mono text-[12px] shadow-none focus-visible:ring-0"
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            placeholder="Search logs…"
            style={{ color: 'var(--terminal-fg)' }}
            value={searchQuery}
          />
          {searchQuery ? (
            <Button
              aria-label="Clear Log Search"
              className="size-5 opacity-60 hover:opacity-100"
              onClick={() => {
                setSearchQuery('');
              }}
              size="icon"
              style={{ color: 'var(--terminal-fg)' }}
              variant="ghost"
            >
              <X aria-hidden="true" className="size-3" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
