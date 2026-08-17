import { File, Folder, Link } from 'lucide-react';
import path from 'path-browserify';
import { memo } from 'react';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
import { fileTypeLabel } from '@/features/file-explorer/utils/fileExplorerTypeLabel';
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
  onMoveToFolder: (destDir: string, names: Iterable<string>) => Promise<void>;
  onRenameCancel: () => void;
  onRenameChange: (value: string) => void;
  onRenameConfirm: () => Promise<void>;
  onRowClick: (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => void;
  onRowDoubleClick: (file: FileEntry) => void;
  openDeleteDialog: (names: string[]) => void;
  phantomOffset: number;
  renameError: string;
  renameValue: string;
  selectedNames: Set<string>;
  start: number;
  toggleCheckbox: (name: string) => void;
  visibleCount: number;
}

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
  onMoveToFolder,
  selectedNames,
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
      className="grid cursor-pointer items-center border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      data-index={index}
      data-state={isSelected ? 'selected' : ''}
      draggable={!isBeingRenamed}
      onClick={(e) => onRowClick(file, e)}
      onDoubleClick={() => onRowDoubleClick(file)}
      onDragOver={(event) => {
        if (!isNavigable) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDragStart={(event) => {
        const names = isSelected ? Array.from(selectedNames) : [file.name];
        event.dataTransfer.setData('application/x-adb-gui-files', JSON.stringify(names));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDrop={(event) => {
        if (!isNavigable) {
          return;
        }
        event.preventDefault();
        const raw = event.dataTransfer.getData('application/x-adb-gui-files');
        if (!raw) {
          return;
        }
        let names: string[] = [];
        try {
          names = JSON.parse(raw) as string[];
        } catch {
          return;
        }
        if (names.includes(file.name)) {
          return;
        }
        void onMoveToFolder(path.posix.join(currentPath, file.name) + '/', names);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onRowDoubleClick(file);
          return;
        }
        if (e.key === ' ') {
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
      <TableCell className="min-w-0 px-3 py-2 text-body">
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
          <div className="flex min-w-0 items-center gap-2">
            {isMultiSelectMode ? (
              <span
                className="flex size-4 shrink-0 items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCheckbox(file.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCheckbox(file.name);
                  }
                }}
              >
                <Checkbox aria-label={`Select ${file.name}`} checked={isSelected} tabIndex={-1} />
              </span>
            ) : null}
            {file.type === 'Directory' ? (
              <Folder aria-hidden="true" className="size-4 shrink-0 text-primary" />
            ) : file.type === 'Symlink' ? (
              <Link aria-hidden="true" className="size-4 shrink-0 text-info" />
            ) : (
              <File aria-hidden="true" className="size-4 shrink-0 text-foreground-subtle" />
            )}
            <div className="min-w-0 flex-1">
              <span className="block min-w-0 break-words leading-tight">{file.name}</span>
              {file.type === 'Symlink' && file.linkTarget ? (
                <span className="block min-w-0 break-words font-mono text-mono-sm text-muted-foreground">
                  → {file.linkTarget}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="numeric min-w-0 px-3 py-2 text-caption text-muted-foreground">
        {file.date} {file.time}
      </TableCell>
      <TableCell className="min-w-0 px-3 py-2 text-caption text-muted-foreground">
        {fileTypeLabel(file)}
      </TableCell>
      <TableCell className="numeric min-w-0 px-3 py-2 text-caption text-muted-foreground">
        {file.type === 'Directory' ? EMPTY_VALUE : formatBytes(Number.parseInt(file.size, 10))}
      </TableCell>
    </TableRow>
  );
});
