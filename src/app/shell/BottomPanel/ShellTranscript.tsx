/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the transcript and is not passed across memoized boundaries. */
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useRef } from 'react';
import type { HistoryEntry } from '@/shared/stores/shellStore';
import { useShellStore } from '@/shared/stores/shellStore';
import { cn } from '@/shared/utils/cn';

const ESTIMATED_ROW_HEIGHT = 20;
const WELCOME_TEXT =
  'Welcome. Type your command below.\nExamples:\n  adb devices\n  adb shell ls /sdcard/\n  fastboot devices';

const TranscriptRow = memo(function TranscriptRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="flex gap-2 px-3">
      <span
        className={cn(
          'shrink-0 select-none font-mono text-[12px] leading-5',
          entry.type === 'command' ? 'font-semibold' : 'opacity-60',
        )}
        style={{
          color: entry.type === 'command' ? 'var(--terminal-log-info)' : 'var(--terminal-fg)',
        }}
      >
        {entry.type === 'command' ? '$' : '>'}
      </span>
      <span
        className="min-w-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-5"
        style={{
          color: entry.type === 'error' ? 'var(--terminal-log-error)' : 'var(--terminal-fg)',
        }}
      >
        {entry.text}
      </span>
    </div>
  );
});

/**
 * Owns the only subscription to `history`. The command input lives in a sibling
 * so typing never re-renders the transcript.
 */
export const ShellTranscript = memo(function ShellTranscript() {
  const history = useShellStore((state) => state.history);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: history.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    getItemKey: (index) => history[index]?.id ?? index,
    getScrollElement: () => scrollRef.current,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  // Auto-scroll to bottom on history change
  useEffect(() => {
    const viewport = scrollRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [history]);

  return (
    <div
      className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden py-3"
      ref={scrollRef}
      role="log"
    >
      {history.length === 0 ? (
        <pre
          className="whitespace-pre-wrap break-words px-3 font-mono text-[12px] italic leading-5 opacity-40"
          style={{ color: 'var(--terminal-fg)' }}
        >
          {WELCOME_TEXT}
        </pre>
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualRows.map((vRow) => {
            const entry = history[vRow.index];
            if (!entry) {
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
                <TranscriptRow entry={entry} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
