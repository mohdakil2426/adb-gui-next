import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import type {
  FileExplorerActions,
  FileExplorerEditing,
  FileExplorerListing,
  FileExplorerSelection,
  FileExplorerStatus,
  SortField,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { FileExplorerCreateMenuItems } from '@/features/file-explorer/ui/FileExplorerCreateMenuItems';
import {
  EmptyDirectoryState,
  FileExplorerRowSkeleton,
  LoadFailedState,
  NoDeviceState,
  PermissionDeniedState,
} from '@/features/file-explorer/ui/FileExplorerTableStates';
import { FileExplorerVirtualBody } from '@/features/file-explorer/ui/FileExplorerVirtualBody';
import { Checkbox } from '@/shared/ui/checkbox';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/shared/ui/context-menu';
import { Table, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { cn } from '@/shared/utils/cn';

interface Props {
  actions: FileExplorerActions;
  editing: FileExplorerEditing;
  listing: FileExplorerListing;
  rootAccessGranted: boolean;
  selection: FileExplorerSelection;
  status: FileExplorerStatus;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
}

/** `date` already compares `date + time`, so one "Modified" column sorts both. */
const SORTABLE_COLUMNS: { field: SortField; label: string }[] = [
  { field: 'name', label: 'Name' },
  { field: 'size', label: 'Size' },
  { field: 'date', label: 'Modified' },
];

type PaneState = 'loading' | 'no-device' | 'permission-denied' | 'failed' | 'empty' | 'listing';

/**
 * Which of the six mutually-exclusive pane states applies.
 *
 * Order matters: `no-device` is decided from the device store *before* any
 * error text is consulted, so it no longer depends on adb's wording. The
 * `no_device` error branch below is only the mid-request fallback — a cable
 * pulled between the call and the next device poll.
 */
function resolvePaneState(
  listing: FileExplorerListing,
  editing: FileExplorerEditing,
  status: FileExplorerStatus,
): PaneState {
  if (status.isLoading) {
    return 'loading';
  }
  if (!status.hasDevice || listing.loadError === 'no_device') {
    return 'no-device';
  }
  if (listing.loadError === 'permission_denied') {
    return 'permission-denied';
  }
  if (listing.loadError !== null) {
    return 'failed';
  }
  if (listing.fileList.length === 0 && editing.creatingType === null) {
    return 'empty';
  }
  return 'listing';
}

export function FileExplorerTablePane({
  actions,
  editing,
  listing,
  rootAccessGranted,
  selection,
  status,
  tableScrollRef,
}: Props) {
  const paneState = resolvePaneState(listing, editing, status);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain" ref={tableScrollRef}>
          {paneState === 'loading' ? <FileExplorerRowSkeleton /> : null}
          {paneState === 'no-device' ? <NoDeviceState /> : null}
          {paneState === 'permission-denied' ? (
            <PermissionDeniedState rootAccessGranted={rootAccessGranted} />
          ) : null}
          {paneState === 'failed' ? <LoadFailedState onRetry={actions.handleRefreshClick} /> : null}
          {paneState === 'empty' ? (
            <EmptyDirectoryState
              disabled={status.isBusy}
              onCreateFile={actions.startCreateFile}
              onCreateFolder={actions.startCreateFolder}
            />
          ) : null}
          {paneState === 'listing' ? (
            <div className="relative w-full">
              <Table className="min-w-0">
                <TableHeader className="sticky top-0 z-10 block border-border border-b bg-surface-raised">
                  <TableRow
                    className="grid hover:bg-transparent"
                    style={{ gridTemplateColumns: listing.fileTableColumns }}
                  >
                    {selection.isMultiSelectMode ? (
                      <TableHead className="min-w-0 pl-3">
                        <Checkbox
                          aria-label="Select all"
                          checked={
                            selection.allSelected
                              ? true
                              : selection.someSelected
                                ? 'indeterminate'
                                : false
                          }
                          disabled={status.isBusy}
                          onCheckedChange={actions.handleSelectAll}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead className="min-w-0" />
                    {SORTABLE_COLUMNS.map(({ field, label }) => (
                      <TableHead
                        aria-sort={
                          listing.sortField === field
                            ? listing.sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className={cn(
                          'h-9 min-w-0 px-3 text-label text-muted-foreground',
                          field !== 'name' && 'justify-self-end text-right',
                        )}
                        key={field}
                        role="columnheader"
                      >
                        <button
                          className="inline-flex min-w-0 items-center gap-1 rounded-sm transition-colors duration-90 ease-standard hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            actions.handleSortColumn(field);
                          }}
                          type="button"
                        >
                          {label}
                          {listing.sortField === field ? (
                            listing.sortDir === 'asc' ? (
                              <ChevronUp aria-hidden="true" className="size-3" />
                            ) : (
                              <ChevronDown aria-hidden="true" className="size-3" />
                            )
                          ) : (
                            <ChevronsUpDown aria-hidden="true" className="size-3 opacity-40" />
                          )}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <FileExplorerVirtualBody
                  actions={actions}
                  editing={editing}
                  listing={listing}
                  selection={selection}
                  status={status}
                  tableScrollRef={tableScrollRef}
                />
              </Table>
            </div>
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <FileExplorerCreateMenuItems
          disabled={status.isBusy}
          onCreateFile={actions.startCreateFile}
          onCreateFolder={actions.startCreateFolder}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
