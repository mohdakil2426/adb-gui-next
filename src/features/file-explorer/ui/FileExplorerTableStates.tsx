import type { LucideIcon } from 'lucide-react';
import { CircleAlert, FilePlus2, FolderPlus, Lock, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  FILE_ROW_HEIGHT,
  FILE_TABLE_COLUMNS,
} from '@/features/file-explorer/model/fileExplorerConstants';
import { Button } from '@/shared/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import { Skeleton } from '@/shared/ui/skeleton';

/** Enough rows to fill a default-height pane without measuring it. */
const SKELETON_ROW_COUNT = 12;
const SKELETON_ROWS = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => index);
/** Deterministic per-row name widths — a uniform bar reads as a progress bar. */
const SKELETON_NAME_WIDTHS = ['58%', '34%', '71%', '45%', '63%', '29%'] as const;

/**
 * Loading placeholder at the real row geometry.
 *
 * A single centred spinner replaced the whole table, so the pane collapsed and
 * re-expanded on every directory change. Rows have a known fixed height, so the
 * skeleton can occupy exactly the space the listing will.
 */
export function FileExplorerRowSkeleton() {
  return (
    <output aria-label="Loading directory…" className="block w-full">
      {SKELETON_ROWS.map((index) => (
        <div
          className="grid items-center gap-3 border-border/60 border-b px-3"
          key={index}
          style={{ gridTemplateColumns: FILE_TABLE_COLUMNS, height: FILE_ROW_HEIGHT }}
        >
          <Skeleton
            className="h-3"
            style={{ width: SKELETON_NAME_WIDTHS[index % SKELETON_NAME_WIDTHS.length] }}
          />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </output>
  );
}

interface StateProps {
  action?: ReactNode | undefined;
  description: string;
  icon: LucideIcon;
  title: string;
  tone?: 'neutral' | 'danger' | undefined;
}

/**
 * One shape for every terminal state in the pane.
 *
 * The three error states were the best in the app — icon, headline and a next
 * step apiece — but each was hand-rolled. They keep their copy and gain the
 * shared `Empty` primitive, so the empty directory now matches them too.
 */
function TableState({ action, description, icon: Icon, title, tone = 'neutral' }: StateProps) {
  return (
    <Empty className="min-h-full justify-center gap-4 p-6">
      <EmptyHeader className="gap-1.5">
        <EmptyMedia
          className={tone === 'danger' ? 'bg-destructive-muted text-destructive' : undefined}
          variant="icon"
        >
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent className="gap-2">{action}</EmptyContent> : null}
    </Empty>
  );
}

/** Derived from the device store, before any `ListFiles` call is attempted. */
export function NoDeviceState() {
  return (
    <TableState
      description="Connect a device over USB with USB debugging enabled, or pair one wirelessly from the Dashboard, then refresh."
      icon={Smartphone}
      title="No device connected"
    />
  );
}

export function PermissionDeniedState({ rootAccessGranted }: { rootAccessGranted: boolean }) {
  return (
    <TableState
      description={
        rootAccessGranted
          ? 'Root is enabled but this location is still blocked. It may be a restricted kernel mount — try a path under /sdcard.'
          : 'This location needs elevated permissions. Enable root access with the shield button in the command bar, then refresh.'
      }
      icon={Lock}
      title="Access denied"
      tone="danger"
    />
  );
}

export function LoadFailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <TableState
      action={
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          Try again
        </Button>
      }
      description="The directory could not be listed. Retry, or open the Logs panel for the adb output behind this."
      icon={CircleAlert}
      title="Failed to load"
      tone="danger"
    />
  );
}

export function EmptyDirectoryState({
  disabled,
  onCreateFile,
  onCreateFolder,
}: {
  disabled: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
}) {
  return (
    <TableState
      action={
        <div className="flex items-center gap-2">
          <Button
            disabled={disabled}
            onClick={onCreateFile}
            size="sm"
            type="button"
            variant="outline"
          >
            <FilePlus2 aria-hidden="true" />
            New file
          </Button>
          <Button
            disabled={disabled}
            onClick={onCreateFolder}
            size="sm"
            type="button"
            variant="outline"
          >
            <FolderPlus aria-hidden="true" />
            New folder
          </Button>
        </div>
      }
      description="Nothing here yet. Create a file or folder, or drop one in from the host."
      icon={FolderPlus}
      title="This directory is empty"
    />
  );
}
