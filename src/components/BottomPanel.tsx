import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLogStore } from '@/lib/logStore';
import type { LogLevel } from '@/lib/logStore';
import { LogsPanel } from './LogsPanel';
import { ShellPanel } from './ShellPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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

export function BottomPanel() {
  const { state: sidebarState } = useSidebar();
  // Track sidebar expand/collapse so the fixed panel left edge follows the content area
  const panelLeft =
    sidebarState === 'expanded' ? 'var(--sidebar-width, 16rem)' : 'var(--sidebar-width-icon, 3rem)';

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
  // Drag state: all refs — zero listener re-registrations, zero re-renders during drag
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const rafRef = useRef<number>(0);
  // Only this triggers a re-render — purely for the cursor-lock overlay
  const [showCursorOverlay, setShowCursorOverlay] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    // RAF throttle: skip frames the browser can't render anyway
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const maxHeight = window.innerHeight * MAX_HEIGHT_RATIO;
      const rawHeight = window.innerHeight - e.clientY;
      const clampedHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, rawHeight));
      // Direct DOM write — bypasses React render pipeline entirely
      if (panelRef.current) {
        panelRef.current.style.height = `${clampedHeight}px`;
      }
    });
  }, []);

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
            <Separator orientation="vertical" className="mx-1 h-4" />

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

        {/* Panel content — min-h-0 prevents flex overflow that hides shell input on resize */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'logs' ? <LogsPanel /> : <ShellPanel />}
        </div>
      </div>
    </>
  );
}
