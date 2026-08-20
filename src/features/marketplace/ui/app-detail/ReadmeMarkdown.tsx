import { Fragment, type ReactNode } from 'react';

function inlineNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > last) {
      nodes.push(
        <Fragment key={`t-${last}-${match.index}`}>{text.slice(last, match.index)}</Fragment>,
      );
    }
    if (match[1] && match[2]) {
      nodes.push(
        <a
          className="text-foreground underline underline-offset-2"
          href={match[2]}
          key={`a-${match.index}-${match[2]}`}
          rel="noreferrer"
          target="_blank"
        >
          {match[1]}
        </a>,
      );
    } else if (match[3]) {
      nodes.push(
        <code
          className="rounded-sm bg-surface-raised px-1 font-mono text-mono-sm"
          key={`c-${match.index}-${match[3]}`}
        >
          {match[3]}
        </code>,
      );
    } else if (match[4]) {
      nodes.push(
        <strong className="font-medium text-foreground" key={`b-${match.index}-${match[4]}`}>
          {match[4]}
        </strong>,
      );
    }
    last = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (last < text.length) {
    nodes.push(<Fragment key={`tail-${last}`}>{text.slice(last)}</Fragment>);
  }
  return nodes;
}

/** Small subset of GitHub-flavoured Markdown — no extra libraries (freezePrototype). */
export function ReadmeMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown.replace(/\r\n/g, '\n').split('\n');
  const elements: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < blocks.length) {
    const line = blocks[i] ?? '';
    if (line.startsWith('```')) {
      const fence: string[] = [];
      i += 1;
      while (i < blocks.length && !(blocks[i] ?? '').startsWith('```')) {
        fence.push(blocks[i] ?? '');
        i += 1;
      }
      i += 1;
      elements.push(
        <pre
          className="overflow-x-auto rounded-lg border border-border bg-surface-raised p-3 font-mono text-mono-sm"
          key={key}
        >
          {fence.join('\n')}
        </pre>,
      );
      key += 1;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h3 className="text-foreground text-title" key={key}>
          {inlineNodes(line.slice(2))}
        </h3>,
      );
      key += 1;
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h4 className="font-medium text-body text-foreground" key={key}>
          {inlineNodes(line.slice(3))}
        </h4>,
      );
      key += 1;
      i += 1;
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [];
      while (
        i < blocks.length &&
        ((blocks[i] ?? '').startsWith('- ') || (blocks[i] ?? '').startsWith('* '))
      ) {
        items.push((blocks[i] ?? '').slice(2));
        i += 1;
      }
      elements.push(
        <ul
          className="flex list-disc flex-col gap-1 pl-5 text-body text-muted-foreground"
          key={key}
        >
          {items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>{inlineNodes(item)}</li>
          ))}
        </ul>,
      );
      key += 1;
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    elements.push(
      <p className="text-body text-muted-foreground" key={key}>
        {inlineNodes(line)}
      </p>,
    );
    key += 1;
    i += 1;
  }

  return <div className="flex flex-col gap-2">{elements}</div>;
}
