import { Logs, Search, Terminal, X } from "lucide-react";
import { useState } from "react";

import { PanelHeaderActions } from "@/app/shell/BottomPanel/panel-header-actions";
import { useLogStore } from "@/shared/stores/log-store";
import type { LogLevel } from "@/shared/stores/log-store";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";

interface PanelHeaderProps {
  activeTab: "logs" | "shell";
  clearHistory: () => void;
  clearLogs: () => void;
  filter: LogLevel | "all";
  isFollowing: boolean;
  isPanelMaximized: boolean;
  onTabChange: (tab: "logs" | "shell") => void;
  searchQuery: string;
  setFilter: (filter: LogLevel | "all") => void;
  setIsFollowing: (following: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleMaximized: () => void;
  togglePanel: () => void;
}

export const PanelHeader = ({
  activeTab,
  onTabChange,
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
}: PanelHeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // A number, not the array — only the tab counter re-renders per log line.
  const logCount = useLogStore((state) => state.logs.length);

  return (
    <>
      <div className="bg-terminal-header-bg flex h-9 shrink-0 items-center justify-between px-2">
        <div aria-label="Bottom panel tabs" className="flex items-center gap-0.5" role="tablist">
          <button
            aria-controls="bottom-panel-logs"
            aria-selected={activeTab === "logs"}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "logs"
                ? "border-b-terminal-tab-active text-terminal-tab-active opacity-100"
                : "text-terminal-tab-inactive border-b-transparent opacity-60 hover:opacity-80"
            )}
            id="bottom-panel-logs-tab"
            onClick={() => {
              onTabChange("logs");
            }}
            role="tab"
            type="button"
          >
            <Logs aria-hidden="true" className="size-3.5" />
            Logs
            {logCount > 0 && (
              <span className="text-caption ml-1 tabular-nums opacity-60">({logCount})</span>
            )}
          </button>
          <button
            aria-controls="bottom-panel-shell"
            aria-selected={activeTab === "shell"}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "shell"
                ? "border-b-terminal-tab-active text-terminal-tab-active opacity-100"
                : "text-terminal-tab-inactive border-b-transparent opacity-60 hover:opacity-80"
            )}
            id="bottom-panel-shell-tab"
            onClick={() => {
              onTabChange("shell");
            }}
            role="tab"
            type="button"
          >
            <Terminal aria-hidden="true" className="size-3.5" />
            Shell
          </button>
        </div>

        <PanelHeaderActions
          activeTab={activeTab}
          clearHistory={clearHistory}
          clearLogs={clearLogs}
          filter={filter}
          flags={{
            hasLogs: logCount > 0,
            isFollowing,
            isPanelMaximized,
            isSearchOpen,
          }}
          setFilter={setFilter}
          setIsFollowing={setIsFollowing}
          setIsSearchOpen={setIsSearchOpen}
          toggleMaximized={toggleMaximized}
          togglePanel={togglePanel}
        />
      </div>
      {isSearchOpen && activeTab === "logs" ? (
        <div className="bg-terminal-header-bg border-terminal-border flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <Search aria-hidden="true" className="text-terminal-fg size-3.5 opacity-50" />
          <Input
            aria-label="Search Logs"
            autoFocus
            className="text-terminal-fg h-6 border-none bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0"
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            placeholder="Search logs…"
            value={searchQuery}
          />
          {searchQuery ? (
            <span className="inline-flex opacity-60 hover:opacity-100">
              <Button
                aria-label="Clear Log Search"
                className="text-terminal-fg size-6"
                onClick={() => {
                  setSearchQuery("");
                }}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-3" data-icon="inline-start" />
              </Button>
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
};
