import React, { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { LogEntry, LogLevel } from '@/shared/stores/logStore';
import { useLogStore } from '@/shared/stores/logStore';
import { ScrollArea } from '@/shared/ui/scroll-area';

const LOG_LEVEL_CONFIG: Record<LogLevel, { label: string; icon: string; colorVar: string }> = {
  info: { label: 'INFO', icon: '›', colorVar: 'var(--terminal-log-info)' },
  success: {
    label: 'SUCCESS',
    icon: '✓',
    colorVar: 'var(--terminal-log-success)',
  },
  error: { label: 'ERROR', icon: '✗', colorVar: 'var(--terminal-log-error)' },
  warning: {
    label: 'WARN',
    icon: '!',
    colorVar: 'var(--terminal-log-warning)',
  },
};

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark className="rounded-sm bg-warning/30 px-0.5 text-inherit" key={i}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

function LogRow({ log, searchQuery }: { log: LogEntry; searchQuery: string }) {
  const config = LOG_LEVEL_CONFIG[log.type];

  return (
    <div className="flex gap-2 px-3 py-0.5 transition-colors hover:bg-accent/20">
      <span
        className="shrink-0 select-none font-mono text-[11px] leading-5 opacity-50"
        style={{ color: 'var(--terminal-fg)' }}
      >
        {log.timestamp}
      </span>
      <span
        className="w-16 shrink-0 select-none font-mono font-semibold text-[11px] leading-5"
        style={{ color: config.colorVar }}
      >
        {config.icon} {config.label}
      </span>
      <span
        className="break-all font-mono text-[12px] leading-5"
        style={{ color: 'var(--terminal-fg)' }}
      >
        <HighlightedText query={searchQuery} text={log.message} />
      </span>
    </div>
  );
}

export function LogsPanel() {
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

  // Auto-scroll to bottom when following
  useEffect(() => {
    if (isFollowing && scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [filteredLogs, isFollowing]);

  // Detect manual scroll to disable following
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      if (isUserScrollingRef.current) {
        const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 30;
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

    viewport.addEventListener('scroll', handleScroll);
    viewport.addEventListener('wheel', handleWheel);
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
      <ScrollArea className="min-h-0 w-full flex-1" ref={scrollRef}>
        <div aria-live="polite" aria-relevant="additions" className="flex flex-col py-1" role="log">
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
            filteredLogs.map((log) => <LogRow key={log.id} log={log} searchQuery={searchQuery} />)
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
