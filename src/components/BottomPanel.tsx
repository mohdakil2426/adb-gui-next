import { writeText } from "@tauri-apps/plugin-clipboard-manager";
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
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { debugLog } from "@/lib/debug";
import { SaveLog } from "@/lib/desktop/backend";
import type { LogLevel } from "@/lib/logStore";
import { useLogStore } from "@/lib/logStore";
import { useShellStore } from "@/lib/shellStore";
import { cn } from "@/lib/utils";
import { LogsPanel } from "./LogsPanel";
import { ShellPanel } from "./ShellPanel";

const MIN_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.7;
const DEFAULT_HEIGHT = 300;

const FILTER_OPTIONS: { value: LogLevel | "all"; label: string }[] = [
  { value: "all", label: "All Levels" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
];

interface BottomPanelProps {
  viewportHeight: number;
}

export function BottomPanel({ viewportHeight }: BottomPanelProps) {
  const { state: sidebarState } = useSidebar();
  // Track sidebar expand/collapse so the fixed panel left edge follows the content area
  const panelLeft =
    sidebarState === "expanded"
      ? "var(--sidebar-width, 16rem)"
      : "var(--sidebar-width-icon, 3rem)";

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
  } = useLogStore(
    useShallow((state) => ({
      logs: state.logs,
      isOpen: state.isOpen,
      togglePanel: state.togglePanel,
      clearLogs: state.clearLogs,
      activeTab: state.activeTab,
      setActiveTab: state.setActiveTab,
      filter: state.filter,
      setFilter: state.setFilter,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      isFollowing: state.isFollowing,
      setIsFollowing: state.setIsFollowing,
      isPanelMaximized: state.isPanelMaximized,
      toggleMaximized: state.toggleMaximized,
      panelHeight: state.panelHeight,
      setPanelHeight: state.setPanelHeight,
    }))
  );

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
      panelRef.current.style.willChange = "height";
      panelRef.current.style.userSelect = "none";
    }
  }, []);

  const stopResizing = useCallback(() => {
    if (!isResizingRef.current) {
      return;
    }
    isResizingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setShowCursorOverlay(false);
    // Commit the final height to the store — single re-render after drag ends
    if (panelRef.current) {
      panelRef.current.style.willChange = "";
      panelRef.current.style.userSelect = "";
      const finalHeight = Number.parseFloat(panelRef.current.style.height);
      if (!isNaN(finalHeight)) {
        setPanelHeight(finalHeight);
      }
    }
  }, [setPanelHeight]);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizingRef.current) {
        return;
      }
      // RAF throttle: skip frames the browser can't render anyway
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const maxHeight = viewportHeight * MAX_HEIGHT_RATIO;
        const rawHeight = viewportHeight - e.clientY;
        const clampedHeight = Math.max(
          MIN_HEIGHT,
          Math.min(maxHeight, rawHeight)
        );
        // Direct DOM write — bypasses React render pipeline entirely
        if (panelRef.current) {
          panelRef.current.style.height = `${clampedHeight}px`;
        }
      });
    },
    [viewportHeight]
  );

  // Register once — stable refs mean no listener churn
  useEffect(() => {
    window.addEventListener("mousemove", resize, { passive: true });
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Keyboard shortcut: Ctrl+` to toggle panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePanel]);

  const handleCopy = async () => {
    const text = logs
      .map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`)
      .join("\n");
    try {
      await writeText(text);
      toast.info("Logs copied to clipboard");
    } catch {
      toast.error("Failed to copy logs to clipboard");
    }
  };

  const handleSave = async () => {
    const text = logs
      .map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`)
      .join("\n");
    const toastId = toast.loading("Saving logs...");
    try {
      const prefix = "terminal-logs";
      const path = await SaveLog(text, prefix);
      toast.success("Logs Saved", {
        description: `Saved to ${path}`,
        id: toastId,
      });
    } catch (error) {
      debugLog("Failed to save logs", error);
      toast.error("Save Failed", { description: String(error), id: toastId });
    }
  };

  const handleClear = () => {
    if (activeTab === "logs") {
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
        requestAnimationFrame(() => {
          setIsAnimatingIn(false);
        });
      });
      prevOpenRef.current = isOpen;
      return () => {
        cancelAnimationFrame(frame);
      };
    }
    if (!isOpen && prevOpenRef.current) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimatingOut(false);
      }, 200);
      prevOpenRef.current = isOpen;
      return () => {
        clearTimeout(timer);
      };
    }
    prevOpenRef.current = isOpen;
    return;
  }, [isOpen]);

  if (!isVisible) {
    return null;
  }

  const translateY =
    isAnimatingOut || isAnimatingIn ? "translateY(100%)" : "translateY(0)";

  return (
    <>
      {/* Cursor-lock overlay: blocks pointer events on content during drag */}
      {showCursorOverlay ? (
        <div className="fixed inset-0 z-[60] cursor-ns-resize select-none" />
      ) : null}

      <div
        className="fixed right-0 bottom-0 flex flex-col border-t shadow-2xl"
        ref={panelRef}
        style={{
          left: panelLeft,
          height: `${computedHeight}px`,
          zIndex: 40,
          borderColor: "var(--terminal-border)",
          backgroundColor: "var(--terminal-bg)",
          transform: translateY,
          // Only transition transform (open/close animation) — NOT height (would fight drag)
          transition:
            "transform 200ms cubic-bezier(0.4, 0, 0.2, 1), left 200ms ease-linear",
        }}
      >
        {/* Drag handle */}
        <div
          aria-label="Resize bottom panel"
          aria-orientation="horizontal"
          className="group flex h-6 shrink-0 cursor-ns-resize items-start transition-colors hover:bg-primary/10 active:bg-primary/15"
          onMouseDown={startResizing}
          role="separator"
        >
          <span
            aria-hidden="true"
            className="h-1 w-full"
            style={{ backgroundColor: "var(--terminal-border)" }}
          />
        </div>

        {/* Panel header */}
        <div
          className="flex h-9 shrink-0 items-center justify-between px-2"
          style={{ backgroundColor: "var(--terminal-header-bg)" }}
        >
          {/* Left: Tabs */}
          <div
            aria-label="Bottom panel tabs"
            className="flex items-center gap-0.5"
            role="tablist"
          >
            <button
              aria-controls="bottom-panel-logs"
              aria-selected={activeTab === "logs"}
              className={cn(
                "flex items-center gap-1.5 rounded-t-md px-3 py-1 font-medium text-xs transition-colors",
                activeTab === "logs"
                  ? "opacity-100"
                  : "opacity-60 hover:opacity-80"
              )}
              id="bottom-panel-logs-tab"
              onClick={() => {
                setActiveTab("logs");
              }}
              role="tab"
              style={{
                color:
                  activeTab === "logs"
                    ? "var(--terminal-tab-active)"
                    : "var(--terminal-tab-inactive)",
                borderBottom:
                  activeTab === "logs"
                    ? "2px solid var(--terminal-tab-active)"
                    : "2px solid transparent",
              }}
              type="button"
            >
              <Logs aria-hidden="true" className="size-3.5" />
              Logs
              {logs.length > 0 && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({logs.length})
                </span>
              )}
            </button>
            <button
              aria-controls="bottom-panel-shell"
              aria-selected={activeTab === "shell"}
              className={cn(
                "flex items-center gap-1.5 rounded-t-md px-3 py-1 font-medium text-xs transition-colors",
                activeTab === "shell"
                  ? "opacity-100"
                  : "opacity-60 hover:opacity-80"
              )}
              id="bottom-panel-shell-tab"
              onClick={() => {
                setActiveTab("shell");
              }}
              role="tab"
              style={{
                color:
                  activeTab === "shell"
                    ? "var(--terminal-tab-active)"
                    : "var(--terminal-tab-inactive)",
                borderBottom:
                  activeTab === "shell"
                    ? "2px solid var(--terminal-tab-active)"
                    : "2px solid transparent",
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
            {activeTab === "logs" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={
                      isSearchOpen ? "Close Log Search" : "Search Logs"
                    }
                    className={cn(
                      "size-6",
                      isSearchOpen
                        ? "opacity-100"
                        : "opacity-60 hover:opacity-100"
                    )}
                    onClick={() => {
                      setIsSearchOpen(!isSearchOpen);
                    }}
                    size="icon"
                    style={{ color: "var(--terminal-fg)" }}
                    variant="ghost"
                  >
                    <Search aria-hidden="true" className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Search Logs</TooltipContent>
              </Tooltip>
            )}

            {/* Filter toggle (logs only) */}
            {activeTab === "logs" && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label="Filter Logs"
                        className={cn(
                          "size-6",
                          filter === "all"
                            ? "opacity-60 hover:opacity-100"
                            : "opacity-100"
                        )}
                        size="icon"
                        style={{ color: "var(--terminal-fg)" }}
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
                    backgroundColor: "var(--terminal-header-bg)",
                    borderColor: "var(--terminal-border)",
                    color: "var(--terminal-fg)",
                  }}
                >
                  <DropdownMenuLabel>Filter logs</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    onValueChange={(value) => {
                      setFilter(value as LogLevel | "all");
                    }}
                    value={filter}
                  >
                    {FILTER_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Follow output toggle (logs only) */}
            {activeTab === "logs" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={
                      isFollowing ? "Pause Log Following" : "Follow Latest Logs"
                    }
                    className={cn(
                      "size-6",
                      isFollowing
                        ? "opacity-100"
                        : "opacity-60 hover:opacity-100"
                    )}
                    onClick={() => {
                      setIsFollowing(!isFollowing);
                    }}
                    size="icon"
                    style={{ color: "var(--terminal-fg)" }}
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
                  {isFollowing ? "Following Output" : "Scroll Paused"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Divider */}
            <Separator className="mx-1 h-4" orientation="vertical" />

            {/* Copy logs */}
            {activeTab === "logs" && logs.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Copy Logs"
                    className="size-6 opacity-60 hover:opacity-100"
                    onClick={handleCopy}
                    size="icon"
                    style={{ color: "var(--terminal-fg)" }}
                    variant="ghost"
                  >
                    <Copy aria-hidden="true" className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Copy Logs</TooltipContent>
              </Tooltip>
            )}

            {/* Save logs */}
            {activeTab === "logs" && logs.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Save Logs"
                    className="size-6 opacity-60 hover:opacity-100"
                    onClick={handleSave}
                    size="icon"
                    style={{ color: "var(--terminal-fg)" }}
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
                  aria-label={
                    activeTab === "logs" ? "Clear Logs" : "Clear Shell"
                  }
                  className="size-6 opacity-60 hover:opacity-100"
                  onClick={handleClear}
                  size="icon"
                  style={{ color: "var(--terminal-fg)" }}
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Clear {activeTab === "logs" ? "Logs" : "Shell"}
              </TooltipContent>
            </Tooltip>

            {/* Maximize / Minimize */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={
                    isPanelMaximized ? "Restore Panel" : "Maximize Panel"
                  }
                  className="size-6 opacity-60 hover:opacity-100"
                  onClick={toggleMaximized}
                  size="icon"
                  style={{ color: "var(--terminal-fg)" }}
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
                {isPanelMaximized ? "Restore Panel" : "Maximize Panel"}
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
                  style={{ color: "var(--terminal-fg)" }}
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
        {isSearchOpen && activeTab === "logs" ? (
          <div
            className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5"
            style={{
              borderColor: "var(--terminal-border)",
              backgroundColor: "var(--terminal-header-bg)",
            }}
          >
            <Search
              aria-hidden="true"
              className="size-3.5 opacity-50"
              style={{ color: "var(--terminal-fg)" }}
            />
            <Input
              aria-label="Search Logs"
              autoFocus
              className="h-6 border-none bg-transparent px-0 font-mono text-[12px] shadow-none focus-visible:ring-0"
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              placeholder="Search logs…"
              style={{ color: "var(--terminal-fg)" }}
              value={searchQuery}
            />
            {searchQuery ? (
              <Button
                aria-label="Clear Log Search"
                className="size-5 opacity-60 hover:opacity-100"
                onClick={() => {
                  setSearchQuery("");
                }}
                size="icon"
                style={{ color: "var(--terminal-fg)" }}
                variant="ghost"
              >
                <X aria-hidden="true" className="size-3" />
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Panel content — min-h-0 prevents flex overflow that hides shell input on resize */}
        <div
          aria-labelledby={
            activeTab === "logs"
              ? "bottom-panel-logs-tab"
              : "bottom-panel-shell-tab"
          }
          aria-live="polite"
          className="min-h-0 flex-1 overflow-hidden"
          id={activeTab === "logs" ? "bottom-panel-logs" : "bottom-panel-shell"}
          role="tabpanel"
        >
          {activeTab === "logs" ? <LogsPanel /> : <ShellPanel />}
        </div>
      </div>
    </>
  );
}
