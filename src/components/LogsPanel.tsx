import React, { useEffect, useRef, useMemo } from 'react';
import { useLogStore } from '@/lib/logStore';
import type { LogEntry, LogLevel } from '@/lib/logStore';
import { ScrollArea } from '@/components/ui/scroll-area';

const LOG_LEVEL_CONFIG: Record<LogLevel, { label: string; icon: string; colorVar: string }> = {
  info: { label: 'INFO', icon: '›', colorVar: 'var(--terminal-log-info)' },
  success: { label: 'SUCCESS', icon: '✓', colorVar: 'var(--terminal-log-success)' },
  error: { label: 'ERROR', icon: '✗', colorVar: 'var(--terminal-log-error)' },
  warning: { label: 'WARN', icon: '!', colorVar: 'var(--terminal-log-warning)' },
};

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-warning/30 text-inherit rounded-sm px-0.5">
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
        className="select-none shrink-0 font-mono text-[11px] leading-5 opacity-50"
        style={{ color: 'var(--terminal-fg)' }}
      >
        {log.timestamp}
      </span>
      <span
        className="select-none shrink-0 font-mono text-[11px] leading-5 font-semibold w-16"
        style={{ color: config.colorVar }}
      >
        {config.icon} {config.label}
      </span>
      <span
        className="font-mono text-[12px] leading-5 break-all"
        style={{ color: 'var(--terminal-fg)' }}
      >
        <HighlightedText text={log.message} query={searchQuery} />
      </span>
    </div>
  );
}

export function LogsPanel() {
  const logs = useLogStore((state) => state.logs);
  const filter = useLogStore((state) => state.filter);
  const searchQuery = useLogStore((state) => state.searchQuery);
  const isFollowing = useLogStore((state) => state.isFollowing);
  const setIsFollowing = useLogStore((state) => state.setIsFollowing);
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
    if (!viewport) return;

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
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: 'var(--terminal-bg)' }}
    >
      <ScrollArea className="flex-1 min-h-0 w-full" ref={scrollRef}>
        <div className="flex flex-col py-1" role="log" aria-live="polite" aria-relevant="additions">
          {filteredLogs.length === 0 ? (
            <div
              className="text-center py-8 text-sm italic opacity-40 select-none"
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
