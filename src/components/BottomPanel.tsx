import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLogStore } from '@/lib/logStore';
import type { LogLevel } from '@/lib/logStore';
import { LogsPanel } from './LogsPanel';
import { ShellPanel } from './ShellPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';
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
import { debugLog } from '@/lib/debug';

const MIN_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.7;
const DEFAULT_HEIGHT = 300;

const FILTER_OPTIONS: { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
];

interface BottomPanelProps {
  viewportHeight: number;
}

export function BottomPanel({ viewportHeight }: BottomPanelProps) {
  const { state: sidebarState } = useSidebar();
  // Track sidebar expand/collapse so the fixed panel left edge follows the content area
  const panelLeft =
    sidebarState === 'expanded' ? 'var(--sidebar-width, 16rem)' : 'var(--sidebar-width-icon, 3rem)';

  const logs = useLogStore((state) => state.logs);
  const isOpen = useLogStore((state) => state.isOpen);
  const togglePanel = useLogStore((state) => state.togglePanel);
  const clearLogs = useLogStore((state) => state.clearLogs);
  const activeTab = useLogStore((state) => state.activeTab);
  const setActiveTab = useLogStore((state) => state.setActiveTab);
  const filter = useLogStore((state) => state.filter);
  const setFilter = useLogStore((state) => state.setFilter);
  const searchQuery = useLogStore((state) => state.searchQuery);
  const setSearchQuery = useLogStore((state) => state.setSearchQuery);
  const isFollowing = useLogStore((state) => state.isFollowing);
  const setIsFollowing = useLogStore((state) => state.setIsFollowing);
  const isPanelMaximized = useLogStore((state) => state.isPanelMaximized);
  const toggleMaximized = useLogStore((state) => state.toggleMaximized);
  const panelHeight = useLogStore((state) => state.panelHeight);
  const setPanelHeight = useLogStore((state) => state.setPanelHeight);

  const clearHistory = useShellStore((state) => state.clearHistory);
  // Drag state: all refs — zero listener re-registrations, zero re-renders during drag
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const rafRef = useRef<number>(0);
  // Only this triggers a re-render — purely for the cursor-lock overlay
  const [showCursorOverlay, setShowCursorOverlay] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // ── Fluid resize: DOM-first, commit-last ─────────────────────────────────────
  // During drag: height updated via direct DOM style — NO React re-renders.
  // On mouseup: single Zustand commit — one React re-render to sync.
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setShowCursorOverlay(true);
    // Hint to GPU: this element's height will animate
    if (panelRef.current) {
      panelRef.current.style.willChange = 'height';
      panelRef.current.style.userSelect = 'none';
    }
  }, []);

  const stopResizing = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setShowCursorOverlay(false);
    // Commit the final height to the store — single re-render after drag ends
    if (panelRef.current) {
      panelRef.current.style.willChange = '';
      panelRef.current.style.userSelect = '';
      const finalHeight = parseFloat(panelRef.current.style.height);
      if (!isNaN(finalHeight)) {
        setPanelHeight(finalHeight);
      }
    }
  }, [setPanelHeight]);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      // RAF throttle: skip frames the browser can't render anyway
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const maxHeight = viewportHeight * MAX_HEIGHT_RATIO;
        const rawHeight = viewportHeight - e.clientY;
        const clampedHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, rawHeight));
        // Direct DOM write — bypasses React render pipeline entirely
        if (panelRef.current) {
          panelRef.current.style.height = `${clampedHeight}px`;
        }
      });
    },
    [viewportHeight],
  );

  // Register once — stable refs mean no listener churn
  useEffect(() => {
    window.addEventListener('mousemove', resize, { passive: true });
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
      toast.success('Logs Saved', { description: `Saved to ${path}`, id: toastId });
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

  const computedHeight = isPanelMaximized
    ? viewportHeight * MAX_HEIGHT_RATIO
    : panelHeight || DEFAULT_HEIGHT;

  // Animate in/out
  const prevOpenRef = useRef(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setIsVisible(true);
      setIsAnimatingIn(true);
      // Allow one frame for display before starting transition
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimatingIn(false));
      });
      prevOpenRef.current = isOpen;
      return () => cancelAnimationFrame(frame);
    } else if (!isOpen && prevOpenRef.current) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimatingOut(false);
      }, 200);
      prevOpenRef.current = isOpen;
      return () => clearTimeout(timer);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  if (!isVisible) return null;

  const translateY = isAnimatingOut || isAnimatingIn ? 'translateY(100%)' : 'translateY(0)';

  return (
    <>
      {/* Cursor-lock overlay: blocks pointer events on content during drag */}
      {showCursorOverlay && <div className="fixed inset-0 z-[60] cursor-ns-resize select-none" />}

      <div
        ref={panelRef}
        className="fixed bottom-0 right-0 flex flex-col border-t shadow-2xl"
        style={{
          left: panelLeft,
          height: `${computedHeight}px`,
          zIndex: 40,
          borderColor: 'var(--terminal-border)',
          backgroundColor: 'var(--terminal-bg)',
          transform: translateY,
          // Only transition transform (open/close animation) — NOT height (would fight drag)
          transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), left 200ms ease-linear',
        }}
      >
        {/* Drag handle */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize bottom panel"
          className="group flex h-6 cursor-ns-resize items-start transition-colors hover:bg-primary/10 active:bg-primary/15 shrink-0"
          onMouseDown={startResizing}
        >
          <span
            className="h-1 w-full"
            style={{ backgroundColor: 'var(--terminal-border)' }}
            aria-hidden="true"
          />
        </div>

        {/* Panel header */}
        <div
          className="flex items-center justify-between px-2 h-9 shrink-0"
          style={{ backgroundColor: 'var(--terminal-header-bg)' }}
        >
          {/* Left: Tabs */}
          <div className="flex items-center gap-0.5" role="tablist" aria-label="Bottom panel tabs">
            <button
              id="bottom-panel-logs-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'logs'}
              aria-controls="bottom-panel-logs"
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
              <Logs className="size-3.5" aria-hidden="true" />
              Logs
              {logs.length > 0 && (
                <span className="ml-1 text-[10px] opacity-60">({logs.length})</span>
              )}
            </button>
            <button
              id="bottom-panel-shell-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === 'shell'}
              aria-controls="bottom-panel-shell"
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
              <Terminal className="size-3.5" aria-hidden="true" />
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
                    aria-label={isSearchOpen ? 'Close Log Search' : 'Search Logs'}
                    className={cn(
                      'size-6',
                      isSearchOpen ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                    )}
                    style={{ color: 'var(--terminal-fg)' }}
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                  >
                    <Search className="size-3.5" aria-hidden="true" />
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
                        variant="ghost"
                        size="icon"
                        aria-label="Filter Logs"
                        className={cn(
                          'size-6',
                          filter !== 'all' ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                        )}
                        style={{ color: 'var(--terminal-fg)' }}
                      >
                        <Filter className="size-3.5" aria-hidden="true" />
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
                    value={filter}
                    onValueChange={(value) => setFilter(value as LogLevel | 'all')}
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
                    variant="ghost"
                    size="icon"
                    aria-label={isFollowing ? 'Pause Log Following' : 'Follow Latest Logs'}
                    className={cn(
                      'size-6',
                      isFollowing ? 'opacity-100' : 'opacity-60 hover:opacity-100',
                    )}
                    style={{ color: 'var(--terminal-fg)' }}
                    onClick={() => setIsFollowing(!isFollowing)}
                  >
                    {isFollowing ? (
                      <Pin className="size-3.5" aria-hidden="true" />
                    ) : (
                      <PinOff className="size-3.5" aria-hidden="true" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isFollowing ? 'Following Output' : 'Scroll Paused'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Divider */}
            <Separator orientation="vertical" className="mx-1 h-4" />

            {/* Copy logs */}
            {activeTab === 'logs' && logs.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Copy Logs"
                    className="size-6 opacity-60 hover:opacity-100"
                    style={{ color: 'var(--terminal-fg)' }}
                    onClick={handleCopy}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
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
                    aria-label="Save Logs"
                    className="size-6 opacity-60 hover:opacity-100"
                    style={{ color: 'var(--terminal-fg)' }}
                    onClick={handleSave}
                  >
                    <Save className="size-3.5" aria-hidden="true" />
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
                  aria-label={activeTab === 'logs' ? 'Clear Logs' : 'Clear Shell'}
                  className="size-6 opacity-60 hover:opacity-100"
                  style={{ color: 'var(--terminal-fg)' }}
                  onClick={handleClear}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
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
                  aria-label={isPanelMaximized ? 'Restore Panel' : 'Maximize Panel'}
                  className="size-6 opacity-60 hover:opacity-100"
                  style={{ color: 'var(--terminal-fg)' }}
                  onClick={toggleMaximized}
                >
                  {isPanelMaximized ? (
                    <Minimize2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Maximize2 className="size-3.5" aria-hidden="true" />
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
                  aria-label="Close Panel"
                  className="size-6 opacity-60 hover:opacity-100"
                  style={{ color: 'var(--terminal-fg)' }}
                  onClick={togglePanel}
                >
                  <X className="size-3.5" aria-hidden="true" />
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
            <Search
              className="size-3.5 opacity-50"
              style={{ color: 'var(--terminal-fg)' }}
              aria-hidden="true"
            />
            <Input
              aria-label="Search Logs"
              placeholder="Search logs…"
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
                aria-label="Clear Log Search"
                className="size-5 opacity-60 hover:opacity-100"
                style={{ color: 'var(--terminal-fg)' }}
                onClick={() => setSearchQuery('')}
              >
                <X className="size-3" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}

        {/* Panel content — min-h-0 prevents flex overflow that hides shell input on resize */}
        <div
          id={activeTab === 'logs' ? 'bottom-panel-logs' : 'bottom-panel-shell'}
          role="tabpanel"
          aria-labelledby={
            activeTab === 'logs' ? 'bottom-panel-logs-tab' : 'bottom-panel-shell-tab'
          }
          className="flex-1 min-h-0 overflow-hidden"
        >
          {activeTab === 'logs' ? <LogsPanel /> : <ShellPanel />}
        </div>
      </div>
    </>
  );
}
