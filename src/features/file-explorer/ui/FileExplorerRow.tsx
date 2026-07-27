import { File, Folder, Link } from 'lucide-react';
import path from 'path-browserify';
import { memo } from 'react';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';
import { TableCell, TableRow } from '@/shared/ui/table';
import { cn } from '@/shared/utils/cn';
import { EMPTY_VALUE, formatBytes } from '@/shared/utils/format';

interface Props {
  currentPath: string;
  file: FileEntry;
  fileTableColumns: string;
  index: number;
  isBeingRenamed: boolean;
  isMultiSelectMode: boolean;
  isNavigable: boolean;
  isSelected: boolean;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  measureElement: (node: Element | null) => void;
  onRenameCancel: () => void;
  onRenameChange: (value: string) => void;
  onRenameConfirm: () => Promise<void>;
  onRowClick: (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => void;
  onRowDoubleClick: (file: FileEntry) => void;
  openDeleteDialog: (names: string[]) => void;
  phantomOffset: number;
  renameError: string;
  renameValue: string;
  start: number;
  toggleCheckbox: (name: string) => void;
  visibleCount: number;
}

/**
 * Memoized row. Every callback prop is identity-stable and every value prop is
 * a primitive or the row's own entry, so a selection or rename change re-renders
 * only the rows it actually touches. The context menu lives once on the table
 * body — mounting a Radix menu per row was the bulk of this list's render cost.
 */
export const FileExplorerRow = memo(function FileExplorerRow({
  currentPath,
  file,
  fileTableColumns,
  index,
  isBeingRenamed,
  isMultiSelectMode,
  isNavigable,
  isSelected,
  loadFiles,
  measureElement,
  onRenameCancel,
  onRenameChange,
  onRenameConfirm,
  onRowClick,
  onRowDoubleClick,
  openDeleteDialog,
  phantomOffset,
  renameError,
  renameValue,
  start,
  toggleCheckbox,
  visibleCount,
}: Props) {
  return (
    <TableRow
      aria-posinset={index + 1}
      aria-setsize={visibleCount}
      className="grid cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      data-index={index}
      data-state={isSelected ? 'selected' : ''}
      onClick={(e) => onRowClick(file, e)}
      onDoubleClick={() => onRowDoubleClick(file)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick(file, e);
        }
        if (e.key === 'ArrowRight' && isNavigable) {
          e.preventDefault();
          void loadFiles(path.posix.join(currentPath, file.name) + '/');
        }
        if (e.key === 'Delete') {
          e.preventDefault();
          openDeleteDialog([file.name]);
        }
      }}
      ref={measureElement}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${start + phantomOffset}px)`,
        gridTemplateColumns: fileTableColumns,
      }}
      tabIndex={0}
    >
      {isMultiSelectMode ? (
        <TableCell
          className="min-w-0 py-1 pr-0 pl-2"
          onClick={(e) => {
            e.stopPropagation();
            if (!isBeingRenamed) {
              toggleCheckbox(file.name);
            }
          }}
        >
          {isBeingRenamed ? null : (
            <Checkbox aria-label={`Select ${file.name}`} checked={isSelected} tabIndex={-1} />
          )}
        </TableCell>
      ) : null}
      <TableCell className="min-w-0 py-1 pl-2">
        {file.type === 'Directory' ? (
          <Folder aria-hidden="true" className="size-4 shrink-0 text-primary" />
        ) : file.type === 'Symlink' ? (
          <Link aria-hidden="true" className="size-4 shrink-0 text-info" />
        ) : (
          <File aria-hidden="true" className="size-4 shrink-0 text-foreground-subtle" />
        )}
      </TableCell>
      <TableCell className="min-w-0 whitespace-normal break-words py-1 text-body">
        {isBeingRenamed ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <Input
              autoFocus
              className={cn(
                'h-7 w-full px-1.5 py-0 text-body',
                renameError && 'border-destructive focus-visible:ring-destructive',
              )}
              onBlur={onRenameCancel}
              onChange={(e) => onRenameChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onRenameConfirm();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onRenameCancel();
                }
              }}
              value={renameValue}
            />
            {renameError ? (
              <span className="text-caption text-destructive">{renameError}</span>
            ) : null}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="min-w-0 break-words leading-tight">{file.name}</span>
            {file.type === 'Symlink' && file.linkTarget ? (
              <span className="min-w-0 break-words font-mono text-mono-sm text-muted-foreground">
                → {file.linkTarget}
              </span>
            ) : null}
          </div>
        )}
      </TableCell>
      <TableCell className="numeric min-w-0 py-1 text-caption text-muted-foreground">
        {/* `ls` reports size as text; parse once so the one numeric formatter applies. */}
        {file.type === 'Directory' ? EMPTY_VALUE : formatBytes(Number.parseInt(file.size, 10))}
      </TableCell>
      <TableCell className="numeric min-w-0 py-1 text-caption text-muted-foreground">
        {file.date}
        <span className="px-1 text-foreground-subtle">·</span>
        {file.time}
      </TableCell>
    </TableRow>
  );
});
