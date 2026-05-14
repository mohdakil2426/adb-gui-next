import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import {
  Copy,
  Download,
  File,
  Folder,
  FolderOpen,
  Link,
  Pencil,
  SquareCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import path from 'path-browserify';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import { Input } from '@/shared/ui/input';
import { TableCell, TableRow } from '@/shared/ui/table';
import { cn } from '@/shared/utils/cn';
import { formatBytes } from '@/shared/utils/formatting';

interface Props {
  currentPath: string;
  file: FileEntry;
  fileTableColumns: string;
  handlePullItem: (entry: FileEntry) => Promise<void>;
  handlePushFileToDir: (targetDir: string) => Promise<void>;
  handleRenameCancel: () => void;
  handleRenameChange: (value: string) => void;
  handleRenameConfirm: () => Promise<void>;
  handleRowClick: (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => void;
  handleRowDoubleClick: (file: FileEntry) => void;
  handleSelectFromMenu: (name: string) => void;
  isBeingRenamed: boolean;
  isBusy: boolean;
  isMultiSelectMode: boolean;
  isNavigable: boolean;
  isSelected: boolean;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  openDeleteDialog: (names: string[]) => void;
  phantomOffset: number;
  renameError: string;
  renameValue: string;
  rowVirtualizer: Virtualizer<HTMLElement, Element>;
  selectedNames: Set<string>;
  startRename: (entry: FileEntry) => void;
  toggleCheckbox: (name: string) => void;
  virtualRow: VirtualItem;
  visibleCount: number;
}

export function FileExplorerRow(props: Props) {
  const {
    currentPath,
    file,
    fileTableColumns,
    handlePullItem,
    handlePushFileToDir,
    handleRenameCancel,
    handleRenameChange,
    handleRenameConfirm,
    handleRowClick,
    handleRowDoubleClick,
    handleSelectFromMenu,
    isBeingRenamed,
    isBusy,
    isMultiSelectMode,
    isNavigable,
    isSelected,
    loadFiles,
    openDeleteDialog,
    phantomOffset,
    renameError,
    renameValue,
    rowVirtualizer,
    selectedNames,
    startRename,
    toggleCheckbox,
    virtualRow,
    visibleCount,
  } = props;

  return (
    <ContextMenu key={virtualRow.key}>
      <ContextMenuTrigger asChild>
        <TableRow
          aria-posinset={virtualRow.index + 1}
          aria-setsize={visibleCount}
          className="grid cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          data-index={virtualRow.index}
          data-state={isSelected ? 'selected' : ''}
          onClick={(e) => handleRowClick(file, e)}
          onDoubleClick={() => handleRowDoubleClick(file)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleRowClick(file, e);
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
          ref={rowVirtualizer.measureElement}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start + phantomOffset}px)`,
            gridTemplateColumns: fileTableColumns,
          }}
          tabIndex={0}
        >
          {isMultiSelectMode ? (
            <TableCell
              className="min-w-0 pr-0 pl-3"
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
          <TableCell className="min-w-0">
            {file.type === 'Directory' ? (
              <Folder className="h-4 w-4 shrink-0 text-primary" />
            ) : file.type === 'Symlink' ? (
              <Link className="h-4 w-4 shrink-0 text-primary/70" />
            ) : (
              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </TableCell>
          <TableCell className="min-w-0 whitespace-normal break-words font-medium">
            {isBeingRenamed ? (
              <div className="flex min-w-0 flex-col gap-0.5">
                <Input
                  autoFocus
                  className={cn(
                    'h-7 w-full px-1.5 py-0 font-medium text-sm',
                    renameError && 'border-destructive focus-visible:ring-destructive',
                  )}
                  onBlur={handleRenameCancel}
                  onChange={(e) => handleRenameChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRenameConfirm();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      handleRenameCancel();
                    }
                  }}
                  value={renameValue}
                />
                {renameError ? (
                  <span className="text-destructive text-xs leading-none">{renameError}</span>
                ) : null}
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 break-words leading-tight">{file.name}</span>
                {file.type === 'Symlink' && file.linkTarget ? (
                  <span className="min-w-0 break-words font-mono text-[10px] text-muted-foreground/60 leading-none">
                    → {file.linkTarget}
                  </span>
                ) : null}
              </div>
            )}
          </TableCell>
          <TableCell className="min-w-0 text-muted-foreground text-xs tabular-nums">
            {file.type === 'Directory' ? '—' : formatBytes(file.size)}
          </TableCell>
          <TableCell className="min-w-0 text-xs tabular-nums">{file.date}</TableCell>
          <TableCell className="min-w-0 text-xs tabular-nums">{file.time}</TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => handleSelectFromMenu(file.name)}>
          <SquareCheck className="h-4 w-4 shrink-0" />
          Select
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() =>
            void navigator.clipboard.writeText(path.posix.join(currentPath, file.name))
          }
        >
          <Copy className="h-4 w-4 shrink-0" />
          Copy Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        {isNavigable ? (
          <>
            <ContextMenuItem
              onClick={() => void loadFiles(path.posix.join(currentPath, file.name) + '/')}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              Open
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem
          disabled={
            (isSelected && selectedNames.size > 1) || (!isSelected && selectedNames.size > 0)
          }
          onClick={() => startRename(file)}
        >
          <Pencil className="h-4 w-4 shrink-0" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => {
            const namesToDelete =
              isSelected && selectedNames.size > 0 ? Array.from(selectedNames) : [file.name];
            openDeleteDialog(namesToDelete);
          }}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          {isSelected && selectedNames.size > 1 ? `Delete ${selectedNames.size} items` : 'Delete'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={isBusy}
          onClick={() =>
            void handlePushFileToDir(
              isNavigable ? path.posix.join(currentPath, file.name) + '/' : currentPath,
            )
          }
        >
          <Upload className="h-4 w-4 shrink-0" />
          {isNavigable ? `Import into "${file.name}"` : 'Import File'}
        </ContextMenuItem>
        <ContextMenuItem disabled={isBusy} onClick={() => void handlePullItem(file)}>
          <Download className="h-4 w-4 shrink-0" />
          Export
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
