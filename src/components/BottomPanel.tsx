import React, { useCallback, useEffect, useState } from 'react';
import { useLogStore } from '@/lib/logStore';
import type { LogLevel } from '@/lib/logStore';
import { LogsPanel } from './LogsPanel';
import { ShellPanel } from './ShellPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Logs,
  Terminal,
  X,
  Trash2,
  Save,
  Search,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Filter,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SaveLog } from '@/lib/desktop/backend';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useShellStore } from '@/lib/shellStore';

const MIN_HEIGHT = 150;
const MAX_HEIGHT_RATIO = 0.7;
const DEFAULT_HEIGHT = 300;

const FILTER_OPTIONS: { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
];

export function BottomPanel() {
  const {
    logs,
    isOpen,
    togglePanel,
    clearLogs,
    activeTab,
    setActiveTab,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    isFollowing,
    setIsFollowing,
    isPanelMaximized,
    toggleMaximized,
    panelHeight,
    setPanelHeight,
  } = useLogStore();

  const { clearHistory } = useShellStore();
  const [isResizing, setIsResizing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Vertical resize logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight >= MIN_HEIGHT && newHeight <= maxHeight) {
          setPanelHeight(newHeight);
        }
      }
    },
    [isResizing, setPanelHeight],
  );

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Keyboard shortcut: Ctrl+` to toggle panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel]);

  const handleCopy = async () => {
    const text = logs
      .map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`)
      .join('\n');
    try {
      await writeText(text);
      toast.info('Logs copied to clipboard');
    } catch {
      // Fallback for environments without Tauri clipboard
      navigator.clipboard.writeText(text);
      toast.info('Logs copied to clipboard');
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
      toast.success('Logs Saved', { description: `Saved to ${path}`, id: toastId });
    } catch (error) {
      console.error(error);
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

  const computedHeight = isPanelMaximized
    ? window.innerHeight * MAX_HEIGHT_RATIO
    : panelHeight || DEFAULT_HEIGHT;

  if (!isOpen) return null;

  return (
    <>
      {/* Resize overlay */}
      {isResizing && <div className="fixed inset-0 z-50 cursor-ns-resize select-none" />}

      <div
        className="flex flex-col shrink-0 border-t"
        style={{
          height: `${computedHeight}px`,
          borderColor: 'var(--terminal-border)',
          backgroundColor: 'var(--terminal-bg)',
        }}
      >
        {/* Drag handle */}
        <div
          className="h-1 cursor-ns-resize hover:bg-primary/50 active:bg-primary transition-colors shrink-0"
          style={{ backgroundColor: 'var(--terminal-border)' }}
          onMouseDown={startResizing}
        />

        {/* Panel header */}
        <div
          className="flex items-center justify-between px-2 h-9 shrink-0"
          style={{ backgroundColor: 'var(--terminal-header-bg)' }}
        >
          {/* Left: Tabs */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setActiveTab('logs')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-t-md transition-colors',
                activeTab === 'logs' ? 'opacity-100' : 'opacity-60 hover:opacity-80',
              )}
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
            >
              <Logs className="size-3.5" />
              Logs
              {logs.length > 0 && (
                <span className="ml-1 text-[10px] opacity-60">({logs.length})</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('shell')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-t-md transition-colors',
                activeTab === 'shell' ? 'opacity-100' : 'opacity-60 hover:opacity-80',
              )}
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
            >
              <Terminal className="size-3.5" />
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
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'size-6',
                      isSearchOpen ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                    )}
                    style={{ color: 'var(--terminal-fg)' }}
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                  >
                    <Search className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Search Logs</TooltipContent>
              </Tooltip>
            )}

            {/* Filter toggle (logs only) */}
            {activeTab === 'logs' && (
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'size-6',
                        filter !== 'all' ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                      )}
                      style={{ color: 'var(--terminal-fg)' }}
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                    >
                      <Filter className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Filter Logs</TooltipContent>
                </Tooltip>
                {isFilterOpen && (
                  <div
                    className="absolute right-0 bottom-8 z-50 rounded-md border shadow-lg py-1 min-w-[140px]"
                    style={{
                      backgroundColor: 'var(--terminal-header-bg)',
                      borderColor: 'var(--terminal-border)',
                    }}
                  >
                    {FILTER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--terminal-fg)]/[0.05]',
                          filter === option.value ? 'font-semibold opacity-100' : 'opacity-70',
                        )}
                        style={{ color: 'var(--terminal-fg)' }}
                        onClick={() => {
                          setFilter(option.value);
                          setIsFilterOpen(false);
                        }}
                      >
                        {filter === option.value && '• '}
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Follow output toggle (logs only) */}
            {activeTab === 'logs' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'size-6',
                      isFollowing ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                    )}
                    style={{ color: 'var(--terminal-fg)' }}
                    onClick={() => setIsFollowing(!isFollowing)}
                  >
                    {isFollowing ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isFollowing ? 'Following Output' : 'Scroll Paused'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Divider */}
            <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--terminal-border)' }} />

            {/* Copy logs */}
            {activeTab === 'logs' && logs.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-60 hover:opacity-100"
                    style={{ color: 'var(--terminal-fg)' }}
                    onClick={handleCopy}
                  >
                    <Copy className="size-3.5" />
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
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-60 hover:opacity-100"
                    style={{ color: 'var(--terminal-fg)' }}
                    onClick={handleSave}
                  >
                    <Save className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Save Logs</TooltipContent>
              </Tooltip>
            )}

            {/* Clear */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-60 hover:opacity-100"
                  style={{ color: 'var(--terminal-fg)' }}
                  onClick={handleClear}
                >
                  <Trash2 className="size-3.5" />
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
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-60 hover:opacity-100"
                  style={{ color: 'var(--terminal-fg)' }}
                  onClick={toggleMaximized}
                >
                  {isPanelMaximized ? (
                    <Minimize2 className="size-3.5" />
                  ) : (
                    <Maximize2 className="size-3.5" />
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
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-60 hover:opacity-100"
                  style={{ color: 'var(--terminal-fg)' }}
                  onClick={togglePanel}
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Close Panel (Ctrl+`)</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Search bar (conditionally rendered) */}
        {isSearchOpen && activeTab === 'logs' && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0"
            style={{
              borderColor: 'var(--terminal-border)',
              backgroundColor: 'var(--terminal-header-bg)',
            }}
          >
            <Search className="size-3.5 opacity-50" style={{ color: 'var(--terminal-fg)' }} />
            <Input
              placeholder="Search logs..."
              className="font-mono text-[12px] border-none bg-transparent shadow-none focus-visible:ring-0 h-6 px-0"
              style={{ color: 'var(--terminal-fg)' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="size-5 opacity-60 hover:opacity-100"
                style={{ color: 'var(--terminal-fg)' }}
                onClick={() => setSearchQuery('')}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        )}

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'logs' ? <LogsPanel /> : <ShellPanel />}
        </div>
      </div>
    </>
  );
}
