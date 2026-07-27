import { CircleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
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

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * Rows have a known fixed height, so a full-pane spinner tells the user less
 * than the shape of the list they are about to get.
 */
export function PackageListSkeleton({ rowHeight }: { rowHeight: number }) {
  return (
    <output aria-label="Loading packages" className="flex flex-col">
      {SKELETON_ROWS.map((row) => (
        <div className="flex items-center gap-2 px-3" key={row} style={{ height: rowHeight }}>
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-3 w-full max-w-64" />
        </div>
      ))}
    </output>
  );
}

interface PackageListEmptyProps {
  /** The one thing that resolves this state, offered inline. */
  action?: ReactNode | undefined;
  description: string;
  icon: LucideIcon;
  title: string;
}

/**
 * One empty-state implementation for both package lists, built on the shared
 * `Empty` primitive. Every message names the next step — "No packages found."
 * was previously shown both when a device had no apps and when no device was
 * connected at all.
 */
export function PackageListEmpty({
  action,
  description,
  icon: Icon,
  title,
}: PackageListEmptyProps) {
  return (
    <Empty className="h-full border-0 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/**
 * A failed `pm list packages` is not a device with no apps — without this the
 * neutral "the device returned an empty package list" copy is shown for a
 * command that never ran.
 */
export function PackageListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <PackageListEmpty
      action={
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          Retry
        </Button>
      }
      description={message}
      icon={CircleAlert}
      title="Could not read the package list"
    />
  );
}
