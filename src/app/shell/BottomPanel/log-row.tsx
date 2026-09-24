import React, { memo } from "react";

import type { LogEntry, LogLevel } from "@/shared/stores/log-store";

const LOG_LEVEL_CONFIG: Record<LogLevel, { colorVar: string; icon: string; label: string }> = {
  error: { colorVar: "var(--terminal-log-error)", icon: "✗", label: "ERROR" },
  info: { colorVar: "var(--terminal-log-info)", icon: "›", label: "INFO" },
  success: {
    colorVar: "var(--terminal-log-success)",
    icon: "✓",
    label: "SUCCESS",
  },
  warning: {
    colorVar: "var(--terminal-log-warning)",
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
      <span
        className="shrink-0 font-mono text-[11px] leading-5 opacity-50 select-none"
        style={{ color: "var(--terminal-fg)" }}
      >
        {log.timestamp}
      </span>
      <span
        className="w-16 shrink-0 font-mono text-[11px] leading-5 font-semibold select-none"
        style={{ color: config.colorVar }}
      >
        {config.icon} {config.label}
      </span>
      <span
        className="min-w-0 font-mono text-[12px] leading-5 break-all"
        style={{ color: "var(--terminal-fg)" }}
      >
        <HighlightedText searchRegex={searchRegex} text={log.message} />
      </span>
    </div>
  );
};

export const LogRow = memo(LogRowImpl);
