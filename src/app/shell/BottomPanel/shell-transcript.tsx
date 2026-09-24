/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the transcript and is not passed across memoized boundaries. */
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useRef } from "react";

import type { HistoryEntry } from "@/shared/stores/shell-store";
import { useShellStore } from "@/shared/stores/shell-store";
import { cn } from "@/shared/utils/cn";

const ESTIMATED_ROW_HEIGHT = 20;
const WELCOME_TEXT =
  "Welcome. Type your command below.\nExamples:\n  adb devices\n  adb shell ls /sdcard/\n  fastboot devices";

const TranscriptRowImpl = ({ entry }: { entry: HistoryEntry }) => (
  <div className="flex gap-2 px-3">
    <span
      className={cn(
        "shrink-0 font-mono text-xs leading-5 select-none",
        entry.type === "command"
          ? "text-terminal-log-info font-semibold"
          : "text-terminal-fg opacity-60"
      )}
    >
      {entry.type === "command" ? "$" : ">"}
    </span>
    <span
      className={cn(
        "min-w-0 font-mono text-xs leading-5 break-words whitespace-pre-wrap",
        entry.type === "error" ? "text-terminal-log-error" : "text-terminal-fg"
      )}
    >
      {entry.text}
    </span>
  </div>
);

const TranscriptRow = memo(TranscriptRowImpl);

/**
 * Owns the only subscription to `history`. The command input lives in a sibling
 * so typing never re-renders the transcript.
 */
const ShellTranscriptImpl = () => {
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
      className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto py-3"
      ref={scrollRef}
      role="log"
    >
      {history.length === 0 ? (
        <pre className="text-terminal-fg px-3 font-mono text-xs leading-5 break-words whitespace-pre-wrap italic opacity-40">
          {WELCOME_TEXT}
        </pre>
      ) : (
        <div
          className="relative h-(--total-height) w-full"
          style={{ "--total-height": `${rowVirtualizer.getTotalSize()}px` } as React.CSSProperties}
        >
          {virtualRows.map((vRow) => {
            const entry = history[vRow.index];
            if (!entry) {
              return null;
            }

            return (
              <div
                className="absolute top-0 left-0 w-full translate-y-(--row-y)"
                data-index={vRow.index}
                key={vRow.key}
                ref={rowVirtualizer.measureElement}
                style={{ "--row-y": `${vRow.start}px` } as React.CSSProperties}
              >
                <TranscriptRow entry={entry} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ShellTranscript = memo(ShellTranscriptImpl);
