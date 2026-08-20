import { AlertCircle, Info, Lightbulb, OctagonAlert, TriangleAlert } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { CopyButton } from '@/shared/components/CopyButton';

function inlineNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|<kbd>([^<]+)<\/kbd>|<sup>([^<]+)<\/sup>|<sub>([^<]+)<\/sub>|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*]+)\*/g;
  let last = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > last) {
      nodes.push(<Fragment key={`txt-${last}`}>{text.slice(last, match.index)}</Fragment>);
    }
    const idx = match.index;
    if (match[1] !== undefined && match[2]) {
      nodes.push(
        <img
          alt={match[1] || 'Image'}
          className="my-1 h-auto max-h-96 max-w-full rounded border border-border/40 object-contain"
          height={240}
          key={`img-${idx}`}
          loading="lazy"
          src={match[2]}
          width={480}
        />,
      );
    } else if (match[3] && match[4]) {
      nodes.push(
        <a
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          href={match[4]}
          key={`link-${idx}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {match[3]}
        </a>,
      );
    } else if (match[5]) {
      nodes.push(
        <kbd
          className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-medium font-mono text-[11px] text-foreground shadow-xs"
          key={`kbd-${idx}`}
        >
          {match[5]}
        </kbd>,
      );
    } else if (match[6]) {
      nodes.push(
        <sup className="align-super font-medium text-[75%]" key={`sup-${idx}`}>
          {match[6]}
        </sup>,
      );
    } else if (match[7]) {
      nodes.push(
        <sub className="align-sub font-medium text-[75%]" key={`sub-${idx}`}>
          {match[7]}
        </sub>,
      );
    } else if (match[8]) {
      nodes.push(
        <code
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-caption text-foreground"
          key={`code-${idx}`}
        >
          {match[8]}
        </code>,
      );
    } else if (match[9]) {
      nodes.push(
        <strong className="font-semibold text-foreground" key={`b-${idx}`}>
          {match[9]}
        </strong>,
      );
    } else if (match[10]) {
      nodes.push(
        <del className="text-muted-foreground/70 line-through" key={`del-${idx}`}>
          {match[10]}
        </del>,
      );
    } else if (match[11]) {
      nodes.push(
        <em className="italic" key={`em-${idx}`}>
          {match[11]}
        </em>,
      );
    }
    last = idx + match[0].length;
    match = pattern.exec(text);
  }
  if (last < text.length) {
    nodes.push(<Fragment key={`tail-${last}`}>{text.slice(last)}</Fragment>);
  }
  return nodes;
}

const DEFAULT_ALERT = {
  icon: Info,
  title: 'Note',
  style: 'border-blue-500/40 bg-blue-500/10 text-blue-400 dark:text-blue-300',
};

const ALERT_CONFIGS: Record<string, { icon: typeof Info; title: string; style: string }> = {
  NOTE: DEFAULT_ALERT,
  TIP: {
    icon: Lightbulb,
    title: 'Tip',
    style: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300',
  },
  IMPORTANT: {
    icon: AlertCircle,
    title: 'Important',
    style: 'border-purple-500/40 bg-purple-500/10 text-purple-400 dark:text-purple-300',
  },
  WARNING: {
    icon: TriangleAlert,
    title: 'Warning',
    style: 'border-amber-500/40 bg-amber-500/10 text-amber-400 dark:text-amber-300',
  },
  CAUTION: {
    icon: OctagonAlert,
    title: 'Caution',
    style: 'border-rose-500/40 bg-rose-500/10 text-rose-400 dark:text-rose-300',
  },
};

function parseTableRows(lines: string[]) {
  if (lines.length < 2) {
    return null;
  }
  const parseRow = (l: string) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  const headers = parseRow(lines[0] ?? '');
  const sep = parseRow(lines[1] ?? '');
  const aligns = sep.map((s) =>
    s.startsWith(':') && s.endsWith(':') ? 'center' : s.endsWith(':') ? 'right' : 'left',
  );
  return { headers, aligns, rows: lines.slice(2).map(parseRow) };
}

/** Lightweight GitHub-grade Markdown renderer for desktop webview. */
export function ReadmeMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown.replace(/\r\n/g, '\n').split('\n');
  const elements: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < blocks.length) {
    const line = blocks[i] ?? '';
    const trimmed = line.trim();

    // 1. Fenced Code Block
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (
        i < blocks.length &&
        !(blocks[i] ?? '').trim().startsWith('```') &&
        !(blocks[i] ?? '').trim().startsWith('~~~')
      ) {
        codeLines.push(blocks[i] ?? '');
        i += 1;
      }
      i += 1;
      const fullCode = codeLines.join('\n');
      elements.push(
        <div
          className="group relative my-2 overflow-hidden rounded-md border border-border bg-surface-sunken"
          key={key}
        >
          <div className="flex items-center justify-between border-border/40 border-b bg-surface px-3 py-1 font-mono text-[10px] text-muted-foreground uppercase">
            <span>{lang || 'code'}</span>
            <CopyButton value={fullCode} />
          </div>
          <pre className="overflow-x-auto p-3 font-mono text-caption text-foreground">
            <code>{fullCode}</code>
          </pre>
        </div>,
      );
      key += 1;
      continue;
    }

    // 2. GitHub Alerts (> [!NOTE])
    const alertMatch = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(trimmed);
    if (alertMatch?.[1]) {
      const alertType = alertMatch[1].toUpperCase();
      const cfg =
        (alertType in ALERT_CONFIGS ? ALERT_CONFIGS[alertType] : undefined) ?? DEFAULT_ALERT;
      const Icon = cfg.icon;
      const alertLines: string[] = [];
      i += 1;
      while (i < blocks.length && (blocks[i] ?? '').trim().startsWith('>')) {
        alertLines.push((blocks[i] ?? '').trim().replace(/^>\s?/, ''));
        i += 1;
      }
      elements.push(
        <div
          className={`my-2 flex flex-col gap-1.5 rounded-lg border-l-4 p-3 ${cfg.style}`}
          key={key}
        >
          <div className="flex items-center gap-1.5 font-medium text-caption">
            <Icon className="size-4 shrink-0" />
            <span>{cfg.title}</span>
          </div>
          <div className="text-body text-foreground/90">
            {alertLines.map((al, alIdx) => (
              <p key={`al-${alIdx}`}>{inlineNodes(al)}</p>
            ))}
          </div>
        </div>,
      );
      key += 1;
      continue;
    }

    // 3. GFM Table with column alignment
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < blocks.length && (blocks[i] ?? '').trim().startsWith('|')) {
        tableLines.push(blocks[i] ?? '');
        i += 1;
      }
      const table = parseTableRows(tableLines);
      if (table) {
        elements.push(
          <div className="my-2 overflow-x-auto" key={key}>
            <table className="w-full border-collapse text-caption">
              <thead>
                <tr className="border-border border-b bg-surface-raised">
                  {table.headers.map((h, hIdx) => (
                    <th
                      className={`px-3 py-1.5 font-medium text-foreground text-${table.aligns[hIdx] ?? 'left'}`}
                      key={`th-${hIdx}`}
                    >
                      {inlineNodes(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rIdx) => (
                  <tr className="border-border/40 border-b hover:bg-surface/50" key={`tr-${rIdx}`}>
                    {row.map((cell, cIdx) => (
                      <td
                        className={`px-3 py-1.5 text-muted-foreground text-${table.aligns[cIdx] ?? 'left'}`}
                        key={`td-${rIdx}-${cIdx}`}
                      >
                        {inlineNodes(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        key += 1;
        continue;
      }
    }

    // 4. Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 className="mt-3 font-semibold text-foreground text-title tracking-tight" key={key}>
          {inlineNodes(trimmed.slice(2))}
        </h2>,
      );
      key += 1;
      i += 1;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 className="mt-2.5 font-semibold text-foreground text-subtitle tracking-tight" key={key}>
          {inlineNodes(trimmed.slice(3))}
        </h3>,
      );
      key += 1;
      i += 1;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 className="mt-2 font-medium text-body text-foreground" key={key}>
          {inlineNodes(trimmed.slice(4))}
        </h4>,
      );
      key += 1;
      i += 1;
      continue;
    }

    // 5. Blockquotes
    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          className="my-1.5 border-primary/60 border-l-2 pl-3 text-muted-foreground italic"
          key={key}
        >
          {inlineNodes(trimmed.slice(2))}
        </blockquote>,
      );
      key += 1;
      i += 1;
      continue;
    }

    // 6. Bullet & Task lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.slice(2);
      const isTaskChecked = itemText.startsWith('[x] ') || itemText.startsWith('[X] ');
      const isTask = isTaskChecked || itemText.startsWith('[ ] ');
      elements.push(
        <div className="flex items-start gap-2 text-body text-muted-foreground" key={key}>
          {isTask ? (
            <input
              checked={isTaskChecked}
              className="mt-1 size-3.5 rounded"
              disabled
              type="checkbox"
            />
          ) : (
            <span className="text-muted-foreground/60">•</span>
          )}
          <span>{inlineNodes(isTask ? itemText.slice(4) : itemText)}</span>
        </div>,
      );
      key += 1;
      i += 1;
      continue;
    }

    if (trimmed === '') {
      i += 1;
      continue;
    }

    elements.push(
      <p className="text-body text-muted-foreground leading-relaxed" key={key}>
        {inlineNodes(line)}
      </p>,
    );
    key += 1;
    i += 1;
  }

  return <div className="flex flex-col gap-2">{elements}</div>;
}
