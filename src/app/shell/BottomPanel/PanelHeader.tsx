import { Logs, Search, Terminal, X } from 'lucide-react';
import { useState } from 'react';
import { PanelHeaderActions } from '@/app/shell/BottomPanel/PanelHeaderActions';
import { type LogLevel, useLogStore } from '@/shared/stores/logStore';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/utils/cn';

interface PanelHeaderProps {
  activeTab: 'logs' | 'shell';
  clearHistory: () => void;
  clearLogs: () => void;
  filter: LogLevel | 'all';
  isFollowing: boolean;
  isPanelMaximized: boolean;
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
  // A number, not the array — only the tab counter re-renders per log line.
  const logCount = useLogStore((state) => state.logs.length);

  return (
    <>
      <div
        className="flex h-9 shrink-0 items-center justify-between px-2"
        style={{ backgroundColor: 'var(--terminal-header-bg)' }}
      >
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
            {logCount > 0 && (
              <span className="ml-1 text-caption tabular-nums opacity-60">({logCount})</span>
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

        <PanelHeaderActions
          activeTab={activeTab}
          clearHistory={clearHistory}
          clearLogs={clearLogs}
          filter={filter}
          hasLogs={logCount > 0}
          isFollowing={isFollowing}
          isPanelMaximized={isPanelMaximized}
          isSearchOpen={isSearchOpen}
          setFilter={setFilter}
          setIsFollowing={setIsFollowing}
          setIsSearchOpen={setIsSearchOpen}
          toggleMaximized={toggleMaximized}
          togglePanel={togglePanel}
        />
      </div>

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
