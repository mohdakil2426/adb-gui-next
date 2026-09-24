import React, { memo } from "react";

import type { LogEntry, LogLevel } from "@/shared/stores/log-store";
import { cn } from "@/shared/utils/cn";

const LOG_LEVEL_CONFIG: Record<LogLevel, { colorClass: string; icon: string; label: string }> = {
  error: { colorClass: "text-terminal-log-error", icon: "✗", label: "ERROR" },
  info: { colorClass: "text-terminal-log-info", icon: "›", label: "INFO" },
  success: {
    colorClass: "text-terminal-log-success",
    icon: "✓",
    label: "SUCCESS",
  },
  warning: {
    colorClass: "text-terminal-log-warning",
    icon: "!",
    label: "WARN",
  },
};

/**
 * `searchRegex` is compiled once per query by the panel and shared by every row.
 * `String.prototype.matchAll` clones the regex internally, so a global regex is
 * safe to reuse across rows without `lastIndex` bleed.
 */
const HighlightedText = ({
  searchRegex,
  text,
}: {
  searchRegex: RegExp | null;
  text: string;
}): React.ReactNode => {
  if (!searchRegex) {
    return text;
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(searchRegex)) {
    const start = match.index ?? 0;
    const [matched] = match;

    if (start > lastIndex) {
      nodes.push(
        <React.Fragment key={`t-${lastIndex}`}>{text.slice(lastIndex, start)}</React.Fragment>
      );
    }

    nodes.push(
      <mark className="bg-warning/30 rounded-sm px-0.5 text-inherit" key={`m-${start}`}>
        {matched}
      </mark>
    );
    lastIndex = start + matched.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<React.Fragment key={`t-${lastIndex}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return nodes;
};

const LogRowImpl = ({ log, searchRegex }: { log: LogEntry; searchRegex: RegExp | null }) => {
  const config = LOG_LEVEL_CONFIG[log.type];

  return (
    <div className="hover:bg-accent/20 flex gap-2 px-3 py-0.5 transition-colors">
      <span className="text-terminal-fg text-caption shrink-0 font-mono leading-5 opacity-50 select-none">
        {log.timestamp}
      </span>
      <span
        className={cn(
          "text-caption w-16 shrink-0 font-mono leading-5 font-semibold select-none",
          config.colorClass
        )}
      >
        {config.icon} {config.label}
      </span>
      <span className="text-terminal-fg min-w-0 font-mono text-xs leading-5 break-all">
        <HighlightedText searchRegex={searchRegex} text={log.message} />
      </span>
    </div>
  );
};

export const LogRow = memo(LogRowImpl);
