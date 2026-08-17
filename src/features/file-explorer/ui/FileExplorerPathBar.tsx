import { HardDrive, TextCursorInput } from 'lucide-react';
import { Fragment, memo, useMemo } from 'react';
import { ToolbarTooltip } from '@/features/file-explorer/ui/ToolbarTooltip';
import { type PathSegment, toPathSegments } from '@/features/file-explorer/utils/fileExplorerPaths';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';

interface Props {
  currentPath: string;
  editPathValue: string;
  isEditingPath: boolean;
  onNavigate: (targetPath: string) => void;
  onPathClick: () => void;
  onPathEditingChange: (value: string) => void;
  onPathEditingCommit: () => void;
  onPathEditingStop: () => void;
}

/** Crumbs shown inline before the middle of the path collapses behind a menu. */
const MAX_VISIBLE_CRUMBS = 4;
/** How many trailing crumbs survive collapse — the current dir and its parent. */
const TRAILING_CRUMBS = 2;

interface CollapsedPath {
  /** Ancestors hidden behind the ellipsis menu; empty when nothing collapsed. */
  hidden: PathSegment[];
  visible: PathSegment[];
}

function collapse(segments: PathSegment[]): CollapsedPath {
  if (segments.length <= MAX_VISIBLE_CRUMBS) {
    return { hidden: [], visible: segments };
  }
  const [root, ...rest] = segments;
  const tail = rest.slice(rest.length - TRAILING_CRUMBS);
  return {
    hidden: rest.slice(0, rest.length - TRAILING_CRUMBS),
    visible: root ? [root, ...tail] : tail,
  };
}

function CrumbLabel({ segment, isRoot }: { isRoot: boolean; segment: PathSegment }) {
  if (isRoot) {
    return (
      <>
        <HardDrive aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{segment.label}</span>
      </>
    );
  }
  return <span className="max-w-40 truncate">{segment.label}</span>;
}

/**
 * The device path, as breadcrumbs.
 *
 * It used to be a `<button className="cursor-text">` whose only hint that it was
 * editable was a `title` attribute — and it had no segments at all, so getting
 * from `/sdcard/Android/data` back to `/sdcard` meant three clicks of the up
 * arrow. Every ancestor is now one click, the middle collapses into a menu on
 * deep paths, and free-text entry is an explicit, labelled control.
 */
export const FileExplorerPathBar = memo(function FileExplorerPathBar({
  currentPath,
  editPathValue,
  isEditingPath,
  onNavigate,
  onPathClick,
  onPathEditingChange,
  onPathEditingCommit,
  onPathEditingStop,
}: Props) {
  const { hidden, visible } = useMemo(() => collapse(toPathSegments(currentPath)), [currentPath]);

  if (isEditingPath) {
    return (
      <div className="relative flex h-8 min-w-0 flex-1 items-center rounded-md border border-border-control bg-background dark:bg-input/30">
        <HardDrive
          aria-hidden="true"
          className="pointer-events-none absolute left-2 size-3.5 shrink-0 text-muted-foreground"
        />
        <Input
          aria-label="Device path"
          autoFocus
          className="h-8 min-w-0 flex-1 border-0 bg-transparent pr-2 pl-7 font-mono text-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
          id="fe-path-input"
          onBlur={onPathEditingStop}
          onChange={(event) => onPathEditingChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onPathEditingCommit();
            }
            if (event.key === 'Escape') {
              onPathEditingStop();
            }
          }}
          value={editPathValue}
        />
      </div>
    );
  }

  const lastIndex = visible.length - 1;

  return (
    <div
      className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md border border-border-control bg-background px-1 dark:bg-input/30"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) {
          return;
        }
        onPathClick();
      }}
    >
      <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
        <BreadcrumbList className="flex-nowrap font-mono text-mono">
          {visible.map((segment, index) => {
            const isRoot = index === 0 && segment.path === '/';
            const isLast = index === lastIndex;
            return (
              <Fragment key={segment.path}>
                <BreadcrumbItem className="min-w-0 shrink-0">
                  {isLast ? (
                    <BreadcrumbPage className="flex min-w-0 items-center gap-1">
                      <CrumbLabel isRoot={isRoot} segment={segment} />
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <button
                        className="flex min-w-0 items-center gap-1 px-0.5 py-0.5"
                        onClick={() => onNavigate(segment.path)}
                        title={segment.path}
                        type="button"
                      >
                        <CrumbLabel isRoot={isRoot} segment={segment} />
                      </button>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {isLast ? null : <BreadcrumbSeparator className="shrink-0" />}
                {index === 0 && hidden.length > 0 ? (
                  <>
                    <BreadcrumbItem className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Show ${hidden.length} hidden path segments`}
                          className="flex items-center rounded-sm px-0.5 text-muted-foreground transition-colors duration-90 ease-standard hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <BreadcrumbEllipsis />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {hidden.map((segment) => (
                            <DropdownMenuItem
                              key={segment.path}
                              onClick={() => onNavigate(segment.path)}
                            >
                              <span className="font-mono text-mono">{segment.label}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="shrink-0" />
                  </>
                ) : null}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <ToolbarTooltip label="Edit path — type a location">
        <Button
          aria-label="Edit path"
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onPathClick}
          size="icon-sm"
          variant="ghost"
        >
          <TextCursorInput aria-hidden="true" className="size-3.5" />
        </Button>
      </ToolbarTooltip>
    </div>
  );
});
