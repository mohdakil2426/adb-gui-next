/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the panel and is not passed across memoized boundaries. */
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { LogRow } from '@/app/shell/BottomPanel/LogRow';
import { useLogStore } from '@/shared/stores/logStore';

const ESTIMATED_ROW_HEIGHT = 20;
const AT_BOTTOM_TOLERANCE_PX = 30;
const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

function escapeRegExp(value: string): string {
  return value.replace(REGEX_ESCAPE, '\\$&');
}

export const LogsPanel = memo(function LogsPanel() {
  const { logs, filter, searchQuery, isFollowing, setIsFollowing } = useLogStore(
    useShallow((state) => ({
      logs: state.logs,
      filter: state.filter,
      searchQuery: state.searchQuery,
      isFollowing: state.isFollowing,
      setIsFollowing: state.setIsFollowing,
    })),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (filter !== 'all') {
      result = result.filter((log) => log.type === filter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((log) => log.message.toLowerCase().includes(query));
    }

    return result;
  }, [logs, filter, searchQuery]);

  // Compiled once per query instead of once per row per render.
  const searchRegex = useMemo(
    () => (searchQuery ? new RegExp(escapeRegExp(searchQuery), 'gi') : null),
    [searchQuery],
  );

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    getItemKey: (index) => filteredLogs[index]?.id ?? index,
    getScrollElement: () => scrollRef.current,
    overscan: 12,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  // Auto-scroll to bottom when following
  useEffect(() => {
    const viewport = scrollRef.current;
    if (isFollowing && viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [filteredLogs, isFollowing]);

  // Detect manual scroll to disable following
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      if (isUserScrollingRef.current) {
        const isAtBottom =
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
          AT_BOTTOM_TOLERANCE_PX;
        if (!isAtBottom && isFollowing) {
          setIsFollowing(false);
        } else if (isAtBottom && !isFollowing) {
          setIsFollowing(true);
        }
      }
    };

    const handleWheel = () => {
      isUserScrollingRef.current = true;
      requestAnimationFrame(() => {
        isUserScrollingRef.current = false;
      });
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    viewport.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, [isFollowing, setIsFollowing]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--terminal-bg)' }}
    >
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden py-1"
        ref={scrollRef}
        role="log"
      >
        {filteredLogs.length === 0 ? (
          <div
            className="select-none py-8 text-center text-sm italic opacity-40"
            style={{ color: 'var(--terminal-fg)' }}
          >
            {logs.length === 0
              ? 'No logs yet. Operations will appear here.'
              : 'No logs match the current filter.'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualRows.map((vRow) => {
              const log = filteredLogs[vRow.index];
              if (!log) {
                return null;
              }

              return (
                <div
                  data-index={vRow.index}
                  key={vRow.key}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    left: 0,
                    position: 'absolute',
                    top: 0,
                    transform: `translateY(${vRow.start}px)`,
                    width: '100%',
                  }}
                >
                  <LogRow log={log} searchRegex={searchRegex} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
