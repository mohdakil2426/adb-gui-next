import {
  AlertCircle,
  ChevronRight,
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
} from 'lucide-react';
import { Fragment, type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { MarketplaceRenderMarkdown } from '@/desktop/backend';
import { BrowserOpenURL } from '@/desktop/runtime';
import { CopyButton } from '@/shared/components/CopyButton';

export interface ReadmeMarkdownProps {
  html?: string | null;
  markdown: string;
  owner?: string;
  repo?: string;
}

const PROSE_CONTAINER_CLASS =
  'prose-container flex flex-col gap-3 text-body text-foreground/90 leading-relaxed ' +
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors hover:[&_a]:text-primary/80 ' +
  '[&_blockquote]:my-2 [&_blockquote]:border-primary/60 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground ' +
  '[&_code]:rounded [&_code]:bg-surface-raised [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-caption ' +
  '[&_div[align=center]]:flex [&_div[align=center]]:flex-wrap [&_div[align=center]]:items-center [&_div[align=center]]:justify-center [&_div[align=center]]:gap-2 [&_div[align=center]]:text-center ' +
  '[&_h1]:mt-4 [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:text-title [&_h1]:tracking-tight ' +
  '[&_h2]:mt-3 [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:text-subtitle [&_h2]:tracking-tight ' +
  '[&_h3]:mt-2 [&_h3]:font-medium [&_h3]:text-body [&_h3]:text-foreground ' +
  '[&_h4]:mt-2 [&_h4]:font-medium [&_h4]:text-caption [&_h4]:text-foreground ' +
  '[&_h5]:mt-1.5 [&_h5]:font-medium [&_h5]:text-caption [&_h5]:text-foreground ' +
  '[&_h6]:mt-1.5 [&_h6]:font-medium [&_h6]:text-caption [&_h6]:text-muted-foreground ' +
  '[&_hr]:my-3 [&_hr]:border-border/60 ' +
  '[&_img]:inline-block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded [&_img]:object-contain ' +
  "[&_img[src*='badge']]:max-h-8 [&_img[src*='shields.io']]:max-h-8 " +
  '[&_li]:my-0.5 ' +
  '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_p]:my-1 [&_p]:leading-relaxed ' +
  '[&_p[align=center]]:flex [&_p[align=center]]:flex-wrap [&_p[align=center]]:items-center [&_p[align=center]]:justify-center [&_p[align=center]]:gap-2 [&_p[align=center]]:text-center ' +
  '[&_pre]:my-2 [&_pre]:cursor-pointer [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-surface-sunken [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-caption [&_pre]:text-foreground ' +
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-caption ' +
  '[&_td]:border-border/40 [&_td]:border-b [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-muted-foreground ' +
  '[&_th]:border-border [&_th]:border-b [&_th]:bg-surface-raised [&_th]:px-3 [&_th]:py-1.5 [&_th]:font-medium [&_th]:text-foreground ' +
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 ' +
  '[&_[align=center]]:text-center';

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseHtmlAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match !== null) {
    const key = match[1]?.toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    if (key) {
      attrs[key] = val;
    }
    match = regex.exec(raw);
  }
  return attrs;
}

function renderHtmlImage(attrs: Record<string, string>, key: string): ReactNode {
  const src = decodeHtmlEntities(attrs.src ?? '');
  if (!src) {
    return null;
  }
  const alt = decodeHtmlEntities(attrs.alt ?? 'Image');
  const widthVal = attrs.width ? Number.parseInt(attrs.width, 10) : undefined;
  const heightVal = attrs.height ? Number.parseInt(attrs.height, 10) : undefined;
  const isBadge =
    src.includes('shields.io') ||
    src.includes('badge') ||
    (widthVal !== undefined && widthVal < 200);

  return (
    <img
      alt={alt}
      className={
        isBadge
          ? 'inline-block h-auto max-h-8 max-w-full align-middle'
          : 'my-1 h-auto max-h-96 max-w-full rounded border border-border/40 object-contain'
      }
      height={heightVal ?? (isBadge ? 28 : 240)}
      key={key}
      loading="lazy"
      src={src}
      width={widthVal ?? (isBadge ? undefined : 480)}
    />
  );
}

function inlineNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|<a\s+([^>]*?)>([\s\S]*?)<\/a>|<img\s+([^>]*?)\/?>|<br\s*\/?>|<(kbd|sup|sub|code|b|strong|i|em|del|strike)>([\s\S]*?)<\/\8>|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*]+)\*/gi;
  let last = 0;
  let match: RegExpExecArray | null = pattern.exec(text);

  while (match !== null) {
    if (match.index > last) {
      nodes.push(
        <Fragment key={`txt-${last}`}>
          {decodeHtmlEntities(text.slice(last, match.index))}
        </Fragment>,
      );
    }
    const idx = match.index;

    // 1. Markdown Image: ![alt](url)
    if (match[1] !== undefined && match[2]) {
      const altText = decodeHtmlEntities(match[1]) || 'Image';
      const isBadge = match[2].includes('shields.io') || match[2].includes('badge');
      nodes.push(
        <img
          alt={altText}
          className={
            isBadge
              ? 'inline-block h-auto max-h-8 max-w-full align-middle'
              : 'my-1 h-auto max-h-96 max-w-full rounded border border-border/40 object-contain'
          }
          height={isBadge ? 28 : 240}
          key={`img-${idx}`}
          loading="lazy"
          src={decodeHtmlEntities(match[2])}
          width={isBadge ? undefined : 480}
        />,
      );
    }
    // 2. Markdown Link: [text](url)
    else if (match[3] && match[4]) {
      nodes.push(
        <a
          className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          href={decodeHtmlEntities(match[4])}
          key={`link-${idx}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {inlineNodes(match[3])}
        </a>,
      );
    }
    // 3. HTML <a> tag: <a ...>...</a>
    else if (match[5] !== undefined && match[6] !== undefined) {
      const aAttrs = parseHtmlAttrs(match[5]);
      const href = decodeHtmlEntities(aAttrs.href ?? '#');
      const innerContent = match[6].trim();
      const imgMatch = /^<img\s+([^>]*?)\/?>$/i.exec(innerContent);
      const innerNode = imgMatch?.[1]
        ? renderHtmlImage(parseHtmlAttrs(imgMatch[1]), `a-img-${idx}`)
        : inlineNodes(innerContent);
      nodes.push(
        <a
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          href={href}
          key={`a-${idx}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {innerNode}
        </a>,
      );
    }
    // 4. HTML <img> tag: <img ... />
    else if (match[7] !== undefined) {
      const imgAttrs = parseHtmlAttrs(match[7]);
      const node = renderHtmlImage(imgAttrs, `img-tag-${idx}`);
      if (node) {
        nodes.push(node);
      }
    }
    // 5. HTML <br> tag
    else if (match[0].toLowerCase().startsWith('<br')) {
      nodes.push(<br key={`br-${idx}`} />);
    }
    // 6. Inline HTML formatting tags
    else if (match[8] && match[9] !== undefined) {
      const tag = match[8].toLowerCase();
      const content = inlineNodes(match[9]);
      switch (tag) {
        case 'kbd':
          nodes.push(
            <kbd
              className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-caption text-foreground shadow-xs"
              key={`kbd-${idx}`}
            >
              {content}
            </kbd>,
          );
          break;
        case 'sup':
          nodes.push(
            <sup className="text-[10px]" key={`sup-${idx}`}>
              {content}
            </sup>,
          );
          break;
        case 'sub':
          nodes.push(
            <sub className="text-[10px]" key={`sub-${idx}`}>
              {content}
            </sub>,
          );
          break;
        case 'code':
          nodes.push(
            <code
              className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-caption text-foreground"
              key={`code-${idx}`}
            >
              {content}
            </code>,
          );
          break;
        case 'b':
        case 'strong':
          nodes.push(
            <strong className="font-semibold text-foreground" key={`strong-${idx}`}>
              {content}
            </strong>,
          );
          break;
        case 'i':
        case 'em':
          nodes.push(
            <em className="italic" key={`em-${idx}`}>
              {content}
            </em>,
          );
          break;
        case 'del':
        case 'strike':
          nodes.push(
            <del className="text-muted-foreground line-through" key={`del-${idx}`}>
              {content}
            </del>,
          );
          break;
      }
    }
    // 7. Inline code: `code`
    else if (match[10]) {
      nodes.push(
        <code
          className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-caption text-foreground"
          key={`code-${idx}`}
        >
          {decodeHtmlEntities(match[10])}
        </code>,
      );
    }
    // 8. Bold: **text**
    else if (match[11]) {
      nodes.push(
        <strong className="font-semibold text-foreground" key={`bold-${idx}`}>
          {inlineNodes(match[11])}
        </strong>,
      );
    }
    // 9. Strikethrough: ~~text~~
    else if (match[12]) {
      nodes.push(
        <del className="text-muted-foreground line-through" key={`del-${idx}`}>
          {inlineNodes(match[12])}
        </del>,
      );
    }
    // 10. Italic: *text*
    else if (match[13]) {
      nodes.push(
        <em className="italic" key={`italic-${idx}`}>
          {inlineNodes(match[13])}
        </em>,
      );
    }

    last = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (last < text.length) {
    nodes.push(<Fragment key={`txt-${last}`}>{decodeHtmlEntities(text.slice(last))}</Fragment>);
  }

  return nodes;
}

const DEFAULT_ALERT = {
  icon: Info,
  title: 'Note',
  style: 'border-info/60 bg-info/10 text-info',
};

const ALERT_CONFIGS: Record<string, { icon: typeof Info; title: string; style: string }> = {
  CAUTION: {
    icon: OctagonAlert,
    title: 'Caution',
    style: 'border-destructive/60 bg-destructive/10 text-destructive',
  },
  IMPORTANT: {
    icon: AlertCircle,
    title: 'Important',
    style: 'border-primary/60 bg-primary/10 text-primary',
  },
  NOTE: {
    icon: Info,
    title: 'Note',
    style: 'border-info/60 bg-info/10 text-info',
  },
  TIP: {
    icon: Lightbulb,
    title: 'Tip',
    style: 'border-success/60 bg-success/10 text-success',
  },
  WARNING: {
    icon: TriangleAlert,
    title: 'Warning',
    style: 'border-warning/60 bg-warning/10 text-warning',
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

function renderFallbackElements(markdown: string): ReactNode[] {
  const blocks = markdown.replace(/\r\n/g, '\n').split('\n');
  const elements: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < blocks.length) {
    const line = blocks[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '') {
      i += 1;
      continue;
    }

    // 1. Fenced Code Block
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const fence = trimmed.slice(0, 3);
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < blocks.length && !(blocks[i] ?? '').trim().startsWith(fence)) {
        codeLines.push(blocks[i] ?? '');
        i += 1;
      }
      if (i < blocks.length) {
        i += 1;
      }
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

    // 2. GitHub Alerts
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

    // 3. GFM Pipe Table
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

    // 4. HTML Blocks (<p ...>, <div ...>, <h1-6 ...>, <details ...>)
    const htmlBlockMatch = /^<(p|div|h[1-6]|details)([\s\S]*?)>/i.exec(trimmed);
    if (htmlBlockMatch) {
      const tagName = (htmlBlockMatch[1] ?? '').toLowerCase();
      const rawAttrs = htmlBlockMatch[2] ?? '';
      const attrs = parseHtmlAttrs(rawAttrs);
      const isCentered =
        attrs.align === 'center' || (attrs.style?.includes('text-align: center') ?? false);
      const sameLineClose = new RegExp(`</${tagName}>$`, 'i').exec(trimmed);
      let innerContent = '';

      if (sameLineClose) {
        innerContent = trimmed
          .replace(new RegExp(`^<${tagName}[\\s\\S]*?>`, 'i'), '')
          .replace(new RegExp(`</${tagName}>$`, 'i'), '')
          .trim();
        i += 1;
      } else {
        const blockLines: string[] = [];
        const afterOpen = trimmed.replace(new RegExp(`^<${tagName}[\\s\\S]*?>`, 'i'), '');
        if (afterOpen.trim()) {
          blockLines.push(afterOpen);
        }
        i += 1;

        while (i < blocks.length) {
          const curLine = blocks[i] ?? '';
          const closeMatch = new RegExp(`</${tagName}>`, 'i').exec(curLine);
          if (closeMatch) {
            const beforeClose = curLine.slice(0, closeMatch.index);
            if (beforeClose.trim()) {
              blockLines.push(beforeClose);
            }
            i += 1;
            break;
          }
          blockLines.push(curLine);
          i += 1;
        }
        innerContent = blockLines.join('\n').trim();
      }

      if (tagName.startsWith('h')) {
        const headingLevel = Number.parseInt(tagName[1] ?? '2', 10);
        const headingClass =
          headingLevel === 1
            ? 'mt-4 font-semibold text-foreground text-title tracking-tight'
            : headingLevel === 2
              ? 'mt-3 font-semibold text-foreground text-subtitle tracking-tight'
              : 'mt-2 font-medium text-body text-foreground';
        elements.push(
          <h2 className={`${headingClass} ${isCentered ? 'text-center' : ''}`} key={key}>
            {inlineNodes(innerContent)}
          </h2>,
        );
      } else if (tagName === 'details') {
        const summaryMatch = /<summary>([\s\S]*?)<\/summary>/i.exec(innerContent);
        const summaryText = summaryMatch?.[1]?.trim() ?? 'Details';
        const detailsBody = summaryMatch
          ? innerContent.replace(summaryMatch[0], '').trim()
          : innerContent;

        elements.push(
          <details
            className="group my-2 rounded-lg border border-border bg-surface-raised/40 p-3"
            key={key}
          >
            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground hover:text-primary">
              <ChevronRight className="size-4 transition-transform duration-150 group-open:rotate-90" />
              <span>{inlineNodes(summaryText)}</span>
            </summary>
            <div className="mt-2.5 text-body text-muted-foreground">{inlineNodes(detailsBody)}</div>
          </details>,
        );
      } else {
        elements.push(
          <div
            className={
              isCentered
                ? 'my-2 flex flex-wrap items-center justify-center gap-2 text-center'
                : 'my-1 flex flex-col gap-1 text-body text-muted-foreground leading-relaxed'
            }
            key={key}
          >
            {inlineNodes(innerContent)}
          </div>,
        );
      }

      key += 1;
      continue;
    }

    // 5. Horizontal Rule
    if (/^(?:-{3,}|\*{3,}|_{3,}|<hr\s*\/?>)$/i.test(trimmed)) {
      elements.push(<hr className="my-3 border-border/60" key={key} />);
      key += 1;
      i += 1;
      continue;
    }

    // 6. Markdown Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 className="mt-4 font-semibold text-foreground text-title tracking-tight" key={key}>
          {inlineNodes(trimmed.slice(2))}
        </h2>,
      );
      key += 1;
      i += 1;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 className="mt-3 font-semibold text-foreground text-subtitle tracking-tight" key={key}>
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
    if (
      trimmed.startsWith('#### ') ||
      trimmed.startsWith('##### ') ||
      trimmed.startsWith('###### ')
    ) {
      const hashes = trimmed.match(/^#+/)?.[0]?.length ?? 4;
      elements.push(
        <h5
          className="mt-2 font-medium text-caption text-foreground uppercase tracking-wide"
          key={key}
        >
          {inlineNodes(trimmed.slice(hashes).trim())}
        </h5>,
      );
      key += 1;
      i += 1;
      continue;
    }

    // 7. Blockquotes
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

    // 8. Lists
    const taskMatch = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(trimmed);
    if (taskMatch) {
      const isChecked = (taskMatch[1] ?? '').toLowerCase() === 'x';
      elements.push(
        <div className="flex items-start gap-2 text-body text-muted-foreground" key={key}>
          <input
            checked={isChecked}
            className="mt-1 size-3.5 rounded accent-primary"
            disabled
            type="checkbox"
          />
          <span>{inlineNodes(taskMatch[2] ?? '')}</span>
        </div>,
      );
      key += 1;
      i += 1;
      continue;
    }

    const bulletMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bulletMatch) {
      elements.push(
        <div className="flex items-start gap-2 text-body text-muted-foreground" key={key}>
          <span className="text-muted-foreground/60">•</span>
          <span>{inlineNodes(bulletMatch[1] ?? '')}</span>
        </div>,
      );
      key += 1;
      i += 1;
      continue;
    }

    const orderedMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      elements.push(
        <div className="flex items-start gap-2 text-body text-muted-foreground" key={key}>
          <span className="font-mono text-caption text-muted-foreground">{orderedMatch[1]}.</span>
          <span>{inlineNodes(orderedMatch[2] ?? '')}</span>
        </div>,
      );
      key += 1;
      i += 1;
      continue;
    }

    // 9. Standard Paragraph
    elements.push(
      <p className="text-body text-muted-foreground leading-relaxed" key={key}>
        {inlineNodes(line)}
      </p>,
    );
    key += 1;
    i += 1;
  }

  return elements;
}

/**
 * Robust, GitHub-grade Markdown prose renderer for desktop webview.
 * Renders backend Comrak GFM HTML when provided, or falls back to synchronous
 * AST rendering and background IPC generation.
 */
export function ReadmeMarkdown({ markdown, html, owner, repo }: ReadmeMarkdownProps) {
  const [asyncHtml, setAsyncHtml] = useState<string | null>(null);

  useEffect(() => {
    if (html || !markdown) {
      return;
    }
    let isMounted = true;
    Promise.resolve(MarketplaceRenderMarkdown(markdown, owner, repo))
      .then((res) => {
        if (isMounted && typeof res === 'string' && res.trim().length > 0) {
          setAsyncHtml(res);
        }
      })
      .catch(() => {
        // Fallback remains active if IPC is unavailable (e.g. offline, tests)
      });

    return () => {
      isMounted = false;
    };
  }, [markdown, html, owner, repo]);

  const handleContainerClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) {
      return;
    }

    // 1. External link interception (Security in desktop Tauri webview)
    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href && !href.startsWith('#')) {
        e.preventDefault();
        try {
          BrowserOpenURL(href);
        } catch {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        return;
      }
    }

    // 2. Click-to-copy support on code blocks (<pre>)
    const pre = target.closest('pre');
    if (pre) {
      const text = pre.textContent ?? '';
      if (text && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text);
      }
    }
  };

  const effectiveHtml = html && html.trim().length > 0 ? html : asyncHtml;

  if (!(markdown || effectiveHtml)) {
    return null;
  }

  return (
    <div className={PROSE_CONTAINER_CLASS} onClick={handleContainerClick}>
      {effectiveHtml ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized GFM HTML generated by Rust comrak engine
        <div dangerouslySetInnerHTML={{ __html: effectiveHtml }} />
      ) : (
        renderFallbackElements(markdown)
      )}
    </div>
  );
}
