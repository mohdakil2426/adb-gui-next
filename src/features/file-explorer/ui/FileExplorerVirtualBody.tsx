import { File, Folder, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useFileExplorerRowVirtualizer } from '@/features/file-explorer/hooks/useFileExplorerRowVirtualizer';
import {
  FILE_TABLE_CELL_COUNT,
  FILE_TABLE_CELL_COUNT_WITH_SELECTION,
  PHANTOM_ROW_HEIGHT,
} from '@/features/file-explorer/model/fileExplorerConstants';
import type {
  FileEntry,
  FileExplorerActions,
  FileExplorerEditing,
  FileExplorerListing,
  FileExplorerSelection,
  FileExplorerStatus,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { FileExplorerCreateMenuItems } from '@/features/file-explorer/ui/FileExplorerCreateMenuItems';
import { FileExplorerRow } from '@/features/file-explorer/ui/FileExplorerRow';
import { FileExplorerRowMenuItems } from '@/features/file-explorer/ui/FileExplorerRowMenuItems';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/shared/ui/context-menu';
import { Input } from '@/shared/ui/input';
import { TableBody, TableCell, TableRow } from '@/shared/ui/table';
import { cn } from '@/shared/utils/cn';

interface Props {
  actions: FileExplorerActions;
  editing: FileExplorerEditing;
  listing: FileExplorerListing;
  selection: FileExplorerSelection;
  status: FileExplorerStatus;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
}

/** Resolve the entry under the pointer from the row element's data-index. */
function resolveRowEntry(target: EventTarget | null, visibleList: FileEntry[]): FileEntry | null {
  const element = target instanceof Element ? target.closest('[data-index]') : null;
  const index = Number(element?.getAttribute('data-index') ?? Number.NaN);
  return Number.isInteger(index) ? (visibleList[index] ?? null) : null;
}

export function FileExplorerVirtualBody({
  actions,
  editing,
  listing,
  selection,
  status,
  tableScrollRef,
}: Props) {
  // The virtualizer lives here, not in the view model: scrolling then re-renders
  // this list only, instead of the whole File Explorer tree from the top.
  const rowVirtualizer = useFileExplorerRowVirtualizer(listing.visibleList, tableScrollRef);
  const [menuFile, setMenuFile] = useState<FileEntry | null>(null);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onContextMenu={(event) => {
          // The pane wraps the whole scroll container in its own ContextMenu for
          // right-clicks outside the table body. Without this, a right-click on a
          // row bubbles up and opens *both* roots, and the pane's create-only menu
          // covers the row actions.
          event.stopPropagation();
          setMenuFile(resolveRowEntry(event.target, listing.visibleList));
        }}
      >
        <TableBody
          className="block"
          style={{
            position: 'relative',
            height: `${rowVirtualizer.getTotalSize() + listing.phantomOffset}px`,
          }}
        >
          {editing.creatingType !== null && (
            <TableRow
              className="grid"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: PHANTOM_ROW_HEIGHT,
                gridTemplateColumns: listing.fileTableColumns,
              }}
            >
              {selection.isMultiSelectMode ? <TableCell className="min-w-0 pr-0 pl-2" /> : null}
              <TableCell className="min-w-0 py-1 pr-0 pl-2">
                {editing.creatingType === 'folder' ? (
                  <Folder aria-hidden="true" className="size-4 shrink-0 text-primary" />
                ) : (
                  <File aria-hidden="true" className="size-4 shrink-0 text-foreground-subtle" />
                )}
              </TableCell>
              <TableCell className="col-span-3 min-w-0 py-1" colSpan={3}>
                <div className="flex min-w-0 items-center gap-2">
                  <Input
                    aria-label={
                      editing.creatingType === 'folder' ? 'New folder name' : 'New file name'
                    }
                    autoFocus
                    className={cn(
                      'h-7 max-w-xs px-1.5 py-0 font-mono text-mono',
                      editing.createError && 'border-destructive focus-visible:ring-destructive',
                    )}
                    disabled={status.isCreating}
                    onBlur={actions.cancelCreate}
                    onChange={(e) => actions.handleCreateChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void actions.handleCreateConfirm();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        actions.cancelCreate();
                      }
                    }}
                    placeholder={
                      editing.creatingType === 'folder' ? 'New folder name' : 'filename.ext'
                    }
                    value={editing.createName}
                  />
                  {editing.createError ? (
                    <span className="shrink-0 text-caption text-destructive">
                      {editing.createError}
                    </span>
                  ) : null}
                  {status.isCreating ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          )}

          {listing.fileList.length > 0 && listing.visibleList.length === 0 ? (
            <TableRow
              className="grid"
              style={{
                position: 'absolute',
                top: listing.phantomOffset,
                left: 0,
                width: '100%',
                gridTemplateColumns: listing.fileTableColumns,
              }}
            >
              <TableCell
                className="col-span-full h-32 text-center text-body text-muted-foreground"
                colSpan={
                  selection.isMultiSelectMode
                    ? FILE_TABLE_CELL_COUNT_WITH_SELECTION
                    : FILE_TABLE_CELL_COUNT
                }
              >
                No files match &ldquo;{listing.searchQuery}&rdquo; — clear the filter to see all{' '}
                {listing.fileList.length} entries.
              </TableCell>
            </TableRow>
          ) : null}

          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const file = listing.visibleList[virtualRow.index];
            if (!file) {
              return null;
            }
            const isBeingRenamed = editing.renamingName === file.name;
            return (
              <FileExplorerRow
                currentPath={listing.currentPath}
                file={file}
                fileTableColumns={listing.fileTableColumns}
                index={virtualRow.index}
                isBeingRenamed={isBeingRenamed}
                isMultiSelectMode={selection.isMultiSelectMode}
                isNavigable={file.type === 'Directory' || file.type === 'Symlink'}
                isSelected={selection.selectedNames.has(file.name)}
                key={virtualRow.key}
                loadFiles={actions.loadFiles}
                measureElement={rowVirtualizer.measureElement}
                onRenameCancel={actions.handleRenameCancel}
                onRenameChange={actions.handleRenameChange}
                onRenameConfirm={actions.handleRenameConfirm}
                onRowClick={actions.handleRowClick}
                onRowDoubleClick={actions.handleRowDoubleClick}
                openDeleteDialog={actions.openDeleteDialog}
                phantomOffset={listing.phantomOffset}
                // Only the row being renamed needs the editor value, so a
                // keystroke there cannot invalidate every other row's memo.
                renameError={isBeingRenamed ? editing.renameError : ''}
                renameValue={isBeingRenamed ? editing.renameValue : ''}
                start={virtualRow.start}
                toggleCheckbox={actions.toggleCheckbox}
                visibleCount={listing.visibleList.length}
              />
            );
          })}
        </TableBody>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {menuFile ? (
          <FileExplorerRowMenuItems
            actions={actions}
            currentPath={listing.currentPath}
            file={menuFile}
            isBusy={status.isBusy}
            selectedNames={selection.selectedNames}
          />
        ) : (
          <FileExplorerCreateMenuItems
            disabled={status.isBusy}
            onCreateFile={actions.startCreateFile}
            onCreateFolder={actions.startCreateFolder}
          />
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
