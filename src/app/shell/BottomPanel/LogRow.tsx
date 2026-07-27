import React, { memo } from 'react';
import type { LogEntry, LogLevel } from '@/shared/stores/logStore';

const LOG_LEVEL_CONFIG: Record<LogLevel, { colorVar: string; icon: string; label: string }> = {
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

/**
 * `searchRegex` is compiled once per query by the panel and shared by every row.
 * `String.prototype.matchAll` clones the regex internally, so a global regex is
 * safe to reuse across rows without `lastIndex` bleed.
 */
function HighlightedText({ searchRegex, text }: { searchRegex: RegExp | null; text: string }) {
  if (!searchRegex) {
    return <>{text}</>;
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(searchRegex)) {
    const start = match.index ?? 0;
    const matched = match[0];

    if (start > lastIndex) {
      nodes.push(
        <React.Fragment key={`t-${lastIndex}`}>{text.slice(lastIndex, start)}</React.Fragment>,
      );
    }

    nodes.push(
      <mark className="rounded-sm bg-warning/30 px-0.5 text-inherit" key={`m-${start}`}>
        {matched}
      </mark>,
    );
    lastIndex = start + matched.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<React.Fragment key={`t-${lastIndex}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return <>{nodes}</>;
}

export const LogRow = memo(function LogRow({
  log,
  searchRegex,
}: {
  log: LogEntry;
  searchRegex: RegExp | null;
}) {
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
        className="min-w-0 break-all font-mono text-[12px] leading-5"
        style={{ color: 'var(--terminal-fg)' }}
      >
        <HighlightedText searchRegex={searchRegex} text={log.message} />
      </span>
    </div>
  );
});
