import {
  AlertCircle,
  ChevronRight,
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { MarketplaceRenderMarkdown } from "@/desktop/backend";
import { BrowserOpenURL } from "@/desktop/runtime";
import { CopyButton } from "@/shared/components/copy-button";

export interface ReadmeMarkdownProps {
  html?: string | null;
  markdown: string;
  owner?: string;
  repo?: string;
}

const PROSE_CONTAINER_CLASS =
  "prose-container flex flex-col gap-3 text-body text-foreground/90 leading-relaxed " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition-colors hover:[&_a]:text-primary/80 " +
  "[&_blockquote]:my-2 [&_blockquote]:border-primary/60 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground " +
  "[&_code]:rounded [&_code]:bg-surface-raised [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-caption " +
  "[&_div[align=center]]:flex [&_div[align=center]]:flex-wrap [&_div[align=center]]:items-center [&_div[align=center]]:justify-center [&_div[align=center]]:gap-2 [&_div[align=center]]:text-center " +
  "[&_h1]:mt-4 [&_h1]:font-semibold [&_h1]:text-foreground [&_h1]:text-title [&_h1]:tracking-tight " +
  "[&_h2]:mt-3 [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:text-subtitle [&_h2]:tracking-tight " +
  "[&_h3]:mt-2 [&_h3]:font-medium [&_h3]:text-body [&_h3]:text-foreground " +
  "[&_h4]:mt-2 [&_h4]:font-medium [&_h4]:text-caption [&_h4]:text-foreground " +
  "[&_h5]:mt-1.5 [&_h5]:font-medium [&_h5]:text-caption [&_h5]:text-foreground " +
  "[&_h6]:mt-1.5 [&_h6]:font-medium [&_h6]:text-caption [&_h6]:text-muted-foreground " +
  "[&_hr]:my-3 [&_hr]:border-border/60 " +
  "[&_img]:inline-block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded [&_img]:object-contain " +
  "[&_img[src*='badge']]:max-h-8 [&_img[src*='shields.io']]:max-h-8 " +
  "[&_li]:my-0.5 " +
  "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_p]:my-1 [&_p]:leading-relaxed " +
  "[&_p[align=center]]:flex [&_p[align=center]]:flex-wrap [&_p[align=center]]:items-center [&_p[align=center]]:justify-center [&_p[align=center]]:gap-2 [&_p[align=center]]:text-center " +
  "[&_pre]:my-2 [&_pre]:cursor-pointer [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-surface-sunken [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-caption [&_pre]:text-foreground " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-caption " +
  "[&_td]:border-border/40 [&_td]:border-b [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-muted-foreground " +
  "[&_th]:border-border [&_th]:border-b [&_th]:bg-surface-raised [&_th]:px-3 [&_th]:py-1.5 [&_th]:font-medium [&_th]:text-foreground " +
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_[align=center]]:text-center";

const decodeHtmlEntities = (str: string): string =>
  str
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");

const parseHtmlAttrs = (raw: string): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const regex = /([a-z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/giu;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match !== null) {
    const key = match[1]?.toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? "";
    if (key) {
      attrs[key] = val;
    }
    match = regex.exec(raw);
  }
  return attrs;
};

const renderHtmlImage = (attrs: Record<string, string>, key: string): ReactNode => {
  const src = decodeHtmlEntities(attrs.src ?? "");
  if (!src) {
    return null;
  }
  const alt = decodeHtmlEntities(attrs.alt ?? "Image");
  const widthVal = attrs.width ? Number.parseInt(attrs.width, 10) : undefined;
  const heightVal = attrs.height ? Number.parseInt(attrs.height, 10) : undefined;
  const isBadge =
    src.includes("shields.io") ||
    src.includes("badge") ||
    (widthVal !== undefined && widthVal < 200);

  return (
    <img
      alt={alt}
      className={
        isBadge
          ? "inline-block h-auto max-h-8 max-w-full align-middle"
          : "my-1 h-auto max-h-96 max-w-full rounded border border-border/40 object-contain"
      }
      height={heightVal ?? (isBadge ? 28 : 240)}
      key={key}
      loading="lazy"
      src={src}
      width={widthVal ?? (isBadge ? undefined : 480)}
    />
  );
};

const renderInlineTag = (tag: string, content: ReactNode[], idx: number): ReactNode => {
  switch (tag) {
    case "kbd": {
      return (
        <kbd
          className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-caption text-foreground shadow-xs"
          key={`kbd-${idx}`}
        >
          {content}
        </kbd>
      );
    }
    case "sup": {
      return (
        <sup className="text-[10px]" key={`sup-${idx}`}>
          {content}
        </sup>
      );
    }
    case "sub": {
      return (
        <sub className="text-[10px]" key={`sub-${idx}`}>
          {content}
        </sub>
      );
    }
    case "code": {
      return (
        <code
          className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-caption text-foreground"
          key={`code-${idx}`}
        >
          {content}
        </code>
      );
    }
    case "b":
    case "strong": {
      return (
        <strong className="font-semibold text-foreground" key={`strong-${idx}`}>
          {content}
        </strong>
      );
    }
    case "i":
    case "em": {
      return (
        <em className="italic" key={`em-${idx}`}>
          {content}
        </em>
      );
    }
    case "del":
    case "strike": {
      return (
        <del className="text-muted-foreground line-through" key={`del-${idx}`}>
          {content}
        </del>
      );
    }
    default: {
      return null;
    }
  }
};

const renderInlineHtml = (
  match: RegExpExecArray,
  idx: number,
  parseInline: (t: string) => ReactNode[]
): ReactNode | null => {
  if (match[5] !== undefined && match[6] !== undefined) {
    const aAttrs = parseHtmlAttrs(match[5]);
    const href = decodeHtmlEntities(aAttrs.href ?? "#");
    const innerContent = match[6].trim();
    const imgMatch = /^<img\s+([^>]*?)\/?>$/iu.exec(innerContent);
    const innerNode = imgMatch?.[1]
      ? renderHtmlImage(parseHtmlAttrs(imgMatch[1]), `a-img-${idx}`)
      : parseInline(innerContent);
    return (
      <a
        className="inline-flex items-center gap-1 text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
        href={href}
        key={`a-${idx}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {innerNode}
      </a>
    );
  }
  if (match[7] !== undefined) {
    const imgAttrs = parseHtmlAttrs(match[7]);
    return renderHtmlImage(imgAttrs, `img-tag-${idx}`);
  }
  if (match[0].toLowerCase().startsWith("<br")) {
    return <br key={`br-${idx}`} />;
  }
  if (match[8] && match[9] !== undefined) {
    return renderInlineTag(match[8].toLowerCase(), parseInline(match[9]), idx);
  }
  return null;
};

const renderInlineMarkdown = (
  match: RegExpExecArray,
  idx: number,
  parseInline: (t: string) => ReactNode[]
): ReactNode | null => {
  if (match[1] !== undefined && match[2]) {
    const altText = decodeHtmlEntities(match[1]) || "Image";
    const isBadge = match[2].includes("shields.io") || match[2].includes("badge");
    return (
      <img
        alt={altText}
        className={
          isBadge
            ? "inline-block h-auto max-h-8 max-w-full align-middle"
            : "my-1 h-auto max-h-96 max-w-full rounded border border-border/40 object-contain"
        }
        height={isBadge ? 28 : 240}
        key={`img-${idx}`}
        loading="lazy"
        src={decodeHtmlEntities(match[2])}
        width={isBadge ? undefined : 480}
      />
    );
  }
  if (match[3] && match[4]) {
    return (
      <a
        className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
        href={decodeHtmlEntities(match[4])}
        key={`link-${idx}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {parseInline(match[3])}
      </a>
    );
  }
  if (match[10]) {
    return (
      <code
        className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-caption text-foreground"
        key={`code-${idx}`}
      >
        {decodeHtmlEntities(match[10])}
      </code>
    );
  }
  if (match[11]) {
    return (
      <strong className="font-semibold text-foreground" key={`bold-${idx}`}>
        {parseInline(match[11])}
      </strong>
    );
  }
  if (match[12]) {
    return (
      <del className="text-muted-foreground line-through" key={`del-${idx}`}>
        {parseInline(match[12])}
      </del>
    );
  }
  if (match[13]) {
    return (
      <em className="italic" key={`italic-${idx}`}>
        {parseInline(match[13])}
      </em>
    );
  }
  return null;
};

const inlineNodes = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern =
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|<a\s+([^>]*?)>([\s\S]*?)<\/a>|<img\s+([^>]*?)\/?>|<br\s*\/?>|<(kbd|sup|sub|code|b|strong|i|em|del|strike)>([\s\S]*?)<\/\8>|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*]+)\*/giu;
  let last = 0;
  let match: RegExpExecArray | null = pattern.exec(text);

  while (match !== null) {
    if (match.index > last) {
      nodes.push(
        <Fragment key={`txt-${last}`}>{decodeHtmlEntities(text.slice(last, match.index))}</Fragment>
      );
    }
    const node =
      renderInlineMarkdown(match, match.index, inlineNodes) ??
      renderInlineHtml(match, match.index, inlineNodes);
    if (node) {
      nodes.push(node);
    }
    last = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (last < text.length) {
    nodes.push(<Fragment key={`txt-${last}`}>{decodeHtmlEntities(text.slice(last))}</Fragment>);
  }

  return nodes;
};

const DEFAULT_ALERT = {
  icon: Info,
  style: "border-info/60 bg-info/10 text-info",
  title: "Note",
};

const ALERT_CONFIGS: Record<string, { icon: typeof Info; title: string; style: string }> = {
  CAUTION: {
    icon: OctagonAlert,
    style: "border-destructive/60 bg-destructive/10 text-destructive",
    title: "Caution",
  },
  IMPORTANT: {
    icon: AlertCircle,
    style: "border-primary/60 bg-primary/10 text-primary",
    title: "Important",
  },
  NOTE: {
    icon: Info,
    style: "border-info/60 bg-info/10 text-info",
    title: "Note",
  },
  TIP: {
    icon: Lightbulb,
    style: "border-success/60 bg-success/10 text-success",
    title: "Tip",
  },
  WARNING: {
    icon: TriangleAlert,
    style: "border-warning/60 bg-warning/10 text-warning",
    title: "Warning",
  },
};

const parseTableRow = (l: string): string[] =>
  l
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((c) => c.trim());

const getTableAlign = (s: string): "center" | "right" | "left" => {
  if (s.startsWith(":") && s.endsWith(":")) {
    return "center";
  }
  if (s.endsWith(":")) {
    return "right";
  }
  return "left";
};

const parseTableRows = (lines: string[]) => {
  if (lines.length < 2) {
    return null;
  }
  const headers = parseTableRow(lines[0] ?? "");
  const sep = parseTableRow(lines[1] ?? "");
  const aligns = sep.map(getTableAlign);
  return { aligns, headers, rows: lines.slice(2).map(parseTableRow) };
};

const renderCodeBlock = (
  fence: string,
  lang: string,
  blocks: string[],
  startIndex: number,
  key: number
): { element: ReactNode; nextIndex: number } => {
  let i = startIndex + 1;
  const codeLines: string[] = [];
  while (i < blocks.length && !(blocks[i] ?? "").trim().startsWith(fence)) {
    codeLines.push(blocks[i] ?? "");
    i += 1;
  }
  if (i < blocks.length) {
    i += 1;
  }
  const fullCode = codeLines.join("\n");
  const element = (
    <div
      className="group relative my-2 overflow-hidden rounded-md border border-border bg-surface-sunken"
      key={key}
    >
      <div className="flex items-center justify-between border-border/40 border-b bg-surface px-3 py-1 font-mono text-[10px] text-muted-foreground uppercase">
        <span>{lang || "code"}</span>
        <CopyButton value={fullCode} />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-caption text-foreground">
        <code>{fullCode}</code>
      </pre>
    </div>
  );
  return { element, nextIndex: i };
};

const renderAlertBlock = (
  alertType: string,
  blocks: string[],
  startIndex: number,
  key: number
): { element: ReactNode; nextIndex: number } => {
  const cfg = (alertType in ALERT_CONFIGS ? ALERT_CONFIGS[alertType] : undefined) ?? DEFAULT_ALERT;
  const Icon = cfg.icon;
  const alertLines: string[] = [];
  let i = startIndex + 1;
  while (i < blocks.length && (blocks[i] ?? "").trim().startsWith(">")) {
    alertLines.push((blocks[i] ?? "").trim().replace(/^>\s?/u, ""));
    i += 1;
  }
  const element = (
    <div className={`my-2 flex flex-col gap-1.5 rounded-lg border-l-4 p-3 ${cfg.style}`} key={key}>
      <div className="flex items-center gap-1.5 font-medium text-caption">
        <Icon className="size-4 shrink-0" />
        <span>{cfg.title}</span>
      </div>
      <div className="text-body text-foreground/90">
        {alertLines.map((al, alIdx) => (
          <p key={`al-${alIdx}`}>{inlineNodes(al)}</p>
        ))}
      </div>
    </div>
  );
  return { element, nextIndex: i };
};

const renderTableBlock = (
  blocks: string[],
  startIndex: number,
  key: number
): { element: ReactNode | null; nextIndex: number } => {
  let i = startIndex;
  const tableLines: string[] = [];
  while (i < blocks.length && (blocks[i] ?? "").trim().startsWith("|")) {
    tableLines.push(blocks[i] ?? "");
    i += 1;
  }
  const table = parseTableRows(tableLines);
  if (!table) {
    return { element: null, nextIndex: i };
  }
  const element = (
    <div className="my-2 overflow-x-auto" key={key}>
      <table className="w-full border-collapse text-caption">
        <thead>
          <tr className="border-border border-b bg-surface-raised">
            {table.headers.map((h, hIdx) => (
              <th
                className={`px-3 py-1.5 font-medium text-foreground text-${table.aligns[hIdx] ?? "left"}`}
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
                  className={`px-3 py-1.5 text-muted-foreground text-${table.aligns[cIdx] ?? "left"}`}
                  key={`td-${rIdx}-${cIdx}`}
                >
                  {inlineNodes(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return { element, nextIndex: i };
};

const getHeadingClass = (level: number): string => {
  if (level === 1) {
    return "mt-4 font-semibold text-foreground text-title tracking-tight";
  }
  if (level === 2) {
    return "mt-3 font-semibold text-foreground text-subtitle tracking-tight";
  }
  return "mt-2 font-medium text-body text-foreground";
};

const extractHtmlBlockInnerContent = (
  tagName: string,
  trimmed: string,
  blocks: string[],
  startIndex: number
): { innerContent: string; nextIndex: number } => {
  const sameLineClose = new RegExp(`</${tagName}>$`, "iu").exec(trimmed);
  if (sameLineClose) {
    const innerContent = trimmed
      .replace(new RegExp(`^<${tagName}[\\s\\S]*?>`, "iu"), "")
      .replace(new RegExp(`</${tagName}>$`, "iu"), "")
      .trim();
    return { innerContent, nextIndex: startIndex + 1 };
  }

  const blockLines: string[] = [];
  const afterOpen = trimmed.replace(new RegExp(`^<${tagName}[\\s\\S]*?>`, "iu"), "");
  if (afterOpen.trim()) {
    blockLines.push(afterOpen);
  }
  let i = startIndex + 1;

  while (i < blocks.length) {
    const curLine = blocks[i] ?? "";
    const closeMatch = new RegExp(`</${tagName}>`, "iu").exec(curLine);
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
  return { innerContent: blockLines.join("\n").trim(), nextIndex: i };
};

const renderHtmlBlock = (
  match: RegExpExecArray,
  trimmed: string,
  blocks: string[],
  startIndex: number,
  key: number
): { element: ReactNode; nextIndex: number } => {
  const tagName = (match[1] ?? "").toLowerCase();
  const rawAttrs = match[2] ?? "";
  const attrs = parseHtmlAttrs(rawAttrs);
  const isCentered =
    attrs.align === "center" || (attrs.style?.includes("text-align: center") ?? false);
  const { innerContent, nextIndex } = extractHtmlBlockInnerContent(
    tagName,
    trimmed,
    blocks,
    startIndex
  );
  if (tagName.startsWith("h")) {
    const headingLevel = Number.parseInt(tagName[1] ?? "2", 10);
    const headingClass = getHeadingClass(headingLevel);
    return {
      element: (
        <h2 className={`${headingClass} ${isCentered ? "text-center" : ""}`} key={key}>
          {inlineNodes(innerContent)}
        </h2>
      ),
      nextIndex,
    };
  }
  if (tagName === "details") {
    const summaryMatch = /<summary>([\s\S]*?)<\/summary>/iu.exec(innerContent);
    const summaryText = summaryMatch?.[1]?.trim() ?? "Details";
    const detailsBody = summaryMatch
      ? innerContent.replace(summaryMatch[0], "").trim()
      : innerContent;

    return {
      element: (
        <details
          className="group my-2 rounded-lg border border-border bg-surface-raised/40 p-3"
          key={key}
        >
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground hover:text-primary">
            <ChevronRight className="size-4 transition-transform duration-150 group-open:rotate-90" />
            <span>{inlineNodes(summaryText)}</span>
          </summary>
          <div className="mt-2.5 text-body text-muted-foreground">{inlineNodes(detailsBody)}</div>
        </details>
      ),
      nextIndex,
    };
  }
  return {
    element: (
      <div
        className={
          isCentered
            ? "my-2 flex flex-wrap items-center justify-center gap-2 text-center"
            : "my-1 flex flex-col gap-1 text-body text-muted-foreground leading-relaxed"
        }
        key={key}
      >
        {inlineNodes(innerContent)}
      </div>
    ),
    nextIndex,
  };
};

const renderListBlock = (trimmed: string, key: number): ReactNode | null => {
  const taskMatch = /^[-*+]\s+\[([ xX])\]\s+(.*)$/u.exec(trimmed);
  if (taskMatch) {
    const isChecked = (taskMatch[1] ?? "").toLowerCase() === "x";
    return (
      <div className="flex items-start gap-2 text-body text-muted-foreground" key={key}>
        <input
          checked={isChecked}
          className="mt-1 size-3.5 rounded accent-primary"
          disabled
          type="checkbox"
        />
        <span>{inlineNodes(taskMatch[2] ?? "")}</span>
      </div>
    );
  }

  const bulletMatch = /^[-*+]\s+(.*)$/u.exec(trimmed);
  if (bulletMatch) {
    return (
      <div className="flex items-start gap-2 text-body text-muted-foreground" key={key}>
        <span className="text-muted-foreground/60">•</span>
        <span>{inlineNodes(bulletMatch[1] ?? "")}</span>
      </div>
    );
  }

  const orderedMatch = /^(\d+)\.\s+(.*)$/u.exec(trimmed);
  if (orderedMatch) {
    return (
      <div className="flex items-start gap-2 text-body text-muted-foreground" key={key}>
        <span className="font-mono text-caption text-muted-foreground">{orderedMatch[1]}.</span>
        <span>{inlineNodes(orderedMatch[2] ?? "")}</span>
      </div>
    );
  }

  return null;
};

const renderMarkdownHeading = (trimmed: string, key: number): ReactNode | null => {
  if (trimmed.startsWith("# ")) {
    return (
      <h2 className="mt-4 font-semibold text-foreground text-title tracking-tight" key={key}>
        {inlineNodes(trimmed.slice(2))}
      </h2>
    );
  }
  if (trimmed.startsWith("## ")) {
    return (
      <h3 className="mt-3 font-semibold text-foreground text-subtitle tracking-tight" key={key}>
        {inlineNodes(trimmed.slice(3))}
      </h3>
    );
  }
  if (trimmed.startsWith("### ")) {
    return (
      <h4 className="mt-2 font-medium text-body text-foreground" key={key}>
        {inlineNodes(trimmed.slice(4))}
      </h4>
    );
  }
  if (
    trimmed.startsWith("#### ") ||
    trimmed.startsWith("##### ") ||
    trimmed.startsWith("###### ")
  ) {
    const hashes = trimmed.match(/^#+/u)?.[0]?.length ?? 4;
    return (
      <h5
        className="mt-2 font-medium text-caption text-foreground uppercase tracking-wide"
        key={key}
      >
        {inlineNodes(trimmed.slice(hashes).trim())}
      </h5>
    );
  }
  return null;
};

const renderFallbackElements = (markdown: string): ReactNode[] => {
  const blocks = markdown.replaceAll("\r\n", "\n").split("\n");
  const elements: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < blocks.length) {
    const line = blocks[i] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const { element, nextIndex } = renderCodeBlock(
        trimmed.slice(0, 3),
        trimmed.slice(3).trim(),
        blocks,
        i,
        key
      );
      elements.push(element);
      key += 1;
      i = nextIndex;
      continue;
    }

    const alertMatch = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/iu.exec(trimmed);
    if (alertMatch?.[1]) {
      const { element, nextIndex } = renderAlertBlock(alertMatch[1].toUpperCase(), blocks, i, key);
      elements.push(element);
      key += 1;
      i = nextIndex;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const { element, nextIndex } = renderTableBlock(blocks, i, key);
      if (element) {
        elements.push(element);
        key += 1;
        i = nextIndex;
        continue;
      }
    }

    const htmlBlockMatch = /^<(p|div|h[1-6]|details)([\s\S]*?)>/iu.exec(trimmed);
    if (htmlBlockMatch) {
      const { element, nextIndex } = renderHtmlBlock(htmlBlockMatch, trimmed, blocks, i, key);
      elements.push(element);
      key += 1;
      i = nextIndex;
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,}|<hr\s*\/?>)$/iu.test(trimmed)) {
      elements.push(<hr className="my-3 border-border/60" key={key} />);
      key += 1;
      i += 1;
      continue;
    }

    const headingNode = renderMarkdownHeading(trimmed, key);
    if (headingNode) {
      elements.push(headingNode);
      key += 1;
      i += 1;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          className="my-1.5 border-primary/60 border-l-2 pl-3 text-muted-foreground italic"
          key={key}
        >
          {inlineNodes(trimmed.slice(2))}
        </blockquote>
      );
      key += 1;
      i += 1;
      continue;
    }

    const listNode = renderListBlock(trimmed, key);
    if (listNode) {
      elements.push(listNode);
      key += 1;
      i += 1;
      continue;
    }

    elements.push(
      <p className="text-body text-muted-foreground leading-relaxed" key={key}>
        {inlineNodes(line)}
      </p>
    );
    key += 1;
    i += 1;
  }

  return elements;
};

const handleContainerClickNative = (e: globalThis.MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target) {
    return;
  }

  const anchor = target.closest("a");
  if (anchor) {
    const href = anchor.getAttribute("href");
    if (href && !href.startsWith("#")) {
      e.preventDefault();
      try {
        BrowserOpenURL(href);
      } catch {
        window.open(href, "_blank", "noopener,noreferrer");
      }
      return;
    }
  }

  const pre = target.closest("pre");
  if (pre) {
    const text = pre.textContent ?? "";
    if (text && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
    }
  }
};

export const ReadmeMarkdown = ({ markdown, html, owner, repo }: ReadmeMarkdownProps) => {
  const [asyncHtml, setAsyncHtml] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    el.addEventListener("click", handleContainerClickNative);
    return () => {
      el.removeEventListener("click", handleContainerClickNative);
    };
  }, []);

  useEffect(() => {
    if (html || !markdown) {
      return;
    }
    let isMounted = true;
    const renderMarkdown = async () => {
      try {
        const res = await MarketplaceRenderMarkdown(markdown, owner, repo);
        if (isMounted && typeof res === "string" && res.trim().length > 0) {
          setAsyncHtml(res);
        }
      } catch {
        // Fallback remains active if IPC is unavailable (e.g. offline, tests)
      }
    };
    void renderMarkdown();

    return () => {
      isMounted = false;
    };
  }, [markdown, html, owner, repo]);

  const effectiveHtml = html && html.trim().length > 0 ? html : asyncHtml;

  if (!(markdown || effectiveHtml)) {
    return null;
  }

  return (
    <div className={PROSE_CONTAINER_CLASS} ref={containerRef}>
      {effectiveHtml ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized GFM HTML generated by Rust comrak engine
        <div dangerouslySetInnerHTML={{ __html: effectiveHtml }} />
      ) : (
        renderFallbackElements(markdown)
      )}
    </div>
  );
};
