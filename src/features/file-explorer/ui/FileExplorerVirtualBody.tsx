import type { Virtualizer } from '@tanstack/react-virtual';
import { File, Folder, Loader2 } from 'lucide-react';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
import { Input } from '@/shared/ui/input';
import { TableBody, TableCell, TableRow } from '@/shared/ui/table';
import { cn } from '@/shared/utils/cn';
import { FileExplorerRow } from './FileExplorerRow';

export function FileExplorerVirtualBody({
  cancelCreate,
  createError,
  createName,
  creatingType,
  fileList,
  fileTableColumns,
  handleCreateChange,
  handleCreateConfirm,
  handlePullItem,
  handlePushFileToDir,
  handleRenameCancel,
  handleRenameChange,
  handleRenameConfirm,
  handleRowClick,
  handleRowDoubleClick,
  handleSelectFromMenu,
  isBusy,
  isCreating,
  isMultiSelectMode,
  openDeleteDialog,
  phantomOffset,
  PHANTOM_ROW_HEIGHT,
  renameError,
  renameValue,
  renamingName,
  rowVirtualizer,
  searchQuery,
  selectedNames,
  startRename,
  toggleCheckbox,
  visibleList,
  currentPath,
  loadFiles,
}: {
  cancelCreate: () => void;
  createError: string;
  createName: string;
  creatingType: 'file' | 'folder' | null;
  currentPath: string;
  fileList: FileEntry[];
  fileTableColumns: string;
  handleCreateChange: (value: string) => void;
  handleCreateConfirm: () => Promise<void>;
  handlePullItem: (entry: FileEntry) => Promise<void>;
  handlePushFileToDir: (targetDir: string) => Promise<void>;
  handleRenameCancel: () => void;
  handleRenameChange: (value: string) => void;
  handleRenameConfirm: () => Promise<void>;
  handleRowClick: (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => void;
  handleRowDoubleClick: (file: FileEntry) => void;
  handleSelectFromMenu: (name: string) => void;
  isBusy: boolean;
  isCreating: boolean;
  isMultiSelectMode: boolean;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  openDeleteDialog: (names: string[]) => void;
  PHANTOM_ROW_HEIGHT: number;
  phantomOffset: number;
  renameError: string;
  renameValue: string;
  renamingName: string | null;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  searchQuery: string;
  selectedNames: Set<string>;
  startRename: (entry: FileEntry) => void;
  toggleCheckbox: (name: string) => void;
  visibleList: FileEntry[];
}) {
  return (
    <TableBody
      className="block"
      style={{
        position: 'relative',
        height: `${rowVirtualizer.getTotalSize() + phantomOffset}px`,
      }}
    >
      {creatingType !== null && (
        <TableRow
          className="grid"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: PHANTOM_ROW_HEIGHT,
            gridTemplateColumns: fileTableColumns,
          }}
        >
          {isMultiSelectMode ? <TableCell className="min-w-0 pr-0 pl-3" /> : null}
          <TableCell className="min-w-0 pr-0">
            {creatingType === 'folder' ? (
              <Folder className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </TableCell>
          <TableCell className="col-span-4 min-w-0" colSpan={4}>
            <div className="flex min-w-0 items-center gap-2">
              <Input
                aria-label={creatingType === 'folder' ? 'New folder name' : 'New file name'}
                autoFocus
                className={cn(
                  'h-7 max-w-xs px-1.5 py-0 font-mono text-sm',
                  createError && 'border-destructive focus-visible:ring-destructive',
                )}
                disabled={isCreating}
                onBlur={cancelCreate}
                onChange={(e) => handleCreateChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleCreateConfirm();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelCreate();
                  }
                }}
                placeholder={creatingType === 'folder' ? 'New folder name' : 'filename.ext'}
                value={createName}
              />
              {createError ? (
                <span className="shrink-0 text-destructive text-xs leading-none">
                  {createError}
                </span>
              ) : null}
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      )}

      {fileList.length > 0 && visibleList.length === 0 ? (
        <TableRow
          className="grid"
          style={{
            position: 'absolute',
            top: phantomOffset,
            left: 0,
            width: '100%',
            gridTemplateColumns: fileTableColumns,
          }}
        >
          <TableCell
            className="col-span-full h-32 text-center text-muted-foreground text-sm"
            colSpan={isMultiSelectMode ? 6 : 5}
          >
            No files match &ldquo;{searchQuery}&rdquo;
          </TableCell>
        </TableRow>
      ) : null}

      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const file = visibleList[virtualRow.index];
        if (!file) {
          return null;
        }
        const isSelected = selectedNames.has(file.name);
        const isBeingRenamed = renamingName === file.name;
        const isNavigable = file.type === 'Directory' || file.type === 'Symlink';
        return (
          <FileExplorerRow
            currentPath={currentPath}
            file={file}
            fileTableColumns={fileTableColumns}
            handlePullItem={handlePullItem}
            handlePushFileToDir={handlePushFileToDir}
            handleRenameCancel={handleRenameCancel}
            handleRenameChange={handleRenameChange}
            handleRenameConfirm={handleRenameConfirm}
            handleRowClick={handleRowClick}
            handleRowDoubleClick={handleRowDoubleClick}
            handleSelectFromMenu={handleSelectFromMenu}
            isBeingRenamed={isBeingRenamed}
            isBusy={isBusy}
            isMultiSelectMode={isMultiSelectMode}
            isNavigable={isNavigable}
            isSelected={isSelected}
            key={virtualRow.key}
            loadFiles={loadFiles}
            openDeleteDialog={openDeleteDialog}
            phantomOffset={phantomOffset}
            renameError={renameError}
            renameValue={renameValue}
            rowVirtualizer={rowVirtualizer}
            selectedNames={selectedNames}
            startRename={startRename}
            toggleCheckbox={toggleCheckbox}
            virtualRow={virtualRow}
            visibleCount={visibleList.length}
          />
        );
      })}
    </TableBody>
  );
}
