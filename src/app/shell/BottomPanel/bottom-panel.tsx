import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { PanelHeader } from "@/app/shell/BottomPanel/panel-header";
import { useBottomPanelResize } from "@/app/shell/BottomPanel/use-bottom-panel-resize";
import { useLogStore } from "@/shared/stores/log-store";
import { useShellStore } from "@/shared/stores/shell-store";
import { useSidebar } from "@/shared/ui/sidebar";

import { LogsPanel } from "./logs-panel";
import { ShellPanel } from "./shell-panel";

const DEFAULT_HEIGHT = 300;

interface BottomPanelProps {
  viewportHeight: number;
}

export const BottomPanel = ({ viewportHeight }: BottomPanelProps) => {
  const { state: sidebarState } = useSidebar();
  const panelLeft =
    sidebarState === "expanded" ? "var(--sidebar-width, 16rem)" : "var(--sidebar-width-icon, 3rem)";

  // Deliberately NOT subscribed to `logs`: the array identity changes on every
  // append, which defeats the shallow compare and re-rendered this whole panel
  // (and its ~7 tooltips) per log line. PanelHeader subscribes to the count.
  const {
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
      activeTab: state.activeTab,
      clearLogs: state.clearLogs,
      filter: state.filter,
      isFollowing: state.isFollowing,
      isOpen: state.isOpen,
      isPanelMaximized: state.isPanelMaximized,
      panelHeight: state.panelHeight,
      searchQuery: state.searchQuery,
      setActiveTab: state.setActiveTab,
      setFilter: state.setFilter,
      setIsFollowing: state.setIsFollowing,
      setPanelHeight: state.setPanelHeight,
      setSearchQuery: state.setSearchQuery,
      toggleMaximized: state.toggleMaximized,
      togglePanel: state.togglePanel,
    }))
  );

  const clearHistory = useShellStore((state) => state.clearHistory);
  const { panelRef, startResizing, showCursorOverlay, MAX_HEIGHT_RATIO, adjustHeightBy } =
    useBottomPanelResize({ setPanelHeight, viewportHeight });

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        adjustHeightBy(24);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        adjustHeightBy(-24);
      } else if (e.key === "Home") {
        e.preventDefault();
        adjustHeightBy(viewportHeight);
      } else if (e.key === "End") {
        e.preventDefault();
        adjustHeightBy(-viewportHeight);
      }
    },
    [adjustHeightBy, viewportHeight]
  );

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

  const computedHeight = isPanelMaximized
    ? viewportHeight * MAX_HEIGHT_RATIO
    : panelHeight || DEFAULT_HEIGHT;

  const prevOpenRef = useRef(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (isOpen && !prevOpenRef.current) {
      setIsVisible(true);
      setIsAnimatingIn(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingIn(false);
        });
      });
      cleanup = () => {
        cancelAnimationFrame(frame);
      };
    } else if (!isOpen && prevOpenRef.current) {
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimatingOut(false);
      }, 200);
      cleanup = () => {
        clearTimeout(timer);
      };
    }
    prevOpenRef.current = isOpen;
    return cleanup;
  }, [isOpen]);

  if (!isVisible) {
    return null;
  }

  const translateY = isAnimatingOut || isAnimatingIn ? "translateY(100%)" : "translateY(0)";

  return (
    <>
      {showCursorOverlay ? (
        <div className="fixed inset-0 z-[60] cursor-ns-resize select-none" />
      ) : null}

      <div
        className="fixed right-0 bottom-0 flex flex-col border-t shadow-2xl"
        ref={panelRef}
        style={{
          backgroundColor: "var(--terminal-bg)",
          borderColor: "var(--terminal-border)",
          height: `${computedHeight}px`,
          left: panelLeft,
          transform: translateY,
          transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1), left 200ms ease-linear",
          zIndex: 40,
        }}
      >
        <div
          aria-controls="bottom-panel-content"
          aria-label="Resize panel (Up/Down arrows to adjust, Home/End for limits)"
          aria-orientation="horizontal"
          aria-valuemax={Math.round(viewportHeight * MAX_HEIGHT_RATIO)}
          aria-valuemin={120}
          aria-valuenow={Math.round(computedHeight)}
          className="group flex h-6 w-full shrink-0 cursor-ns-resize items-start border-0 bg-transparent p-0 transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary active:bg-primary/15"
          onKeyDown={handleResizeKeyDown}
          onMouseDown={startResizing}
          role="scrollbar"
          tabIndex={0}
        >
          <span
            aria-hidden="true"
            className="h-1 w-full"
            style={{ backgroundColor: "var(--terminal-border)" }}
          />
        </div>

        <PanelHeader
          activeTab={activeTab}
          clearHistory={clearHistory}
          clearLogs={clearLogs}
          filter={filter}
          isFollowing={isFollowing}
          isPanelMaximized={isPanelMaximized}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          setFilter={setFilter}
          setIsFollowing={setIsFollowing}
          setSearchQuery={setSearchQuery}
          toggleMaximized={toggleMaximized}
          togglePanel={togglePanel}
        />

        <div
          aria-labelledby={
            activeTab === "logs" ? "bottom-panel-logs-tab" : "bottom-panel-shell-tab"
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
};
