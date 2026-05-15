import type { Virtualizer } from '@tanstack/react-virtual';
import {
  AlertCircle,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  FilePlus2,
  FolderPlus,
  Loader2,
  Lock,
  MonitorOff,
} from 'lucide-react';
import type {
  CreatingType,
  FileEntry,
  LoadError,
  SortDir,
  SortField,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { FileExplorerVirtualBody } from '@/features/file-explorer/ui/FileExplorerVirtualBody';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/ui/context-menu';
import { Table, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

interface Props {
  allSelected: boolean;
  cancelCreate: () => void;
  createError: string;
  createName: string;
  creatingType: CreatingType;
  currentPath: string;
  fileList: FileEntry[];
  fileTableColumns: string;
  handleCreateChange: (value: string) => void;
  handleCreateConfirm: () => Promise<void>;
  handlePullItem: (file: FileEntry) => Promise<void>;
  handlePushFileToDir: (targetDir: string) => Promise<void>;
  handleRenameCancel: () => void;
  handleRenameChange: (value: string) => void;
  handleRenameConfirm: () => Promise<void>;
  handleRowClick: (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => void;
  handleRowDoubleClick: (file: FileEntry) => void;
  handleSelectAll: (checked: boolean | 'indeterminate') => void;
  handleSelectFromMenu: (name: string) => void;
  handleSortColumn: (field: SortField) => void;
  isBusy: boolean;
  isCreating: boolean;
  isLoading: boolean;
  isMultiSelectMode: boolean;
  loadError: LoadError;
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
  someSelected: boolean;
  sortDir: SortDir;
  sortField: SortField;
  startCreate: (type: 'file' | 'folder') => void;
  startRename: (entry: FileEntry) => void;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  toggleCheckbox: (name: string) => void;
  visibleList: FileEntry[];
}

export function FileExplorerTablePane(props: Props) {
  const {
    allSelected,
    cancelCreate,
    createError,
    createName,
    creatingType,
    currentPath,
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
    handleSelectAll,
    handleSelectFromMenu,
    handleSortColumn,
    isBusy,
    isCreating,
    isLoading,
    isMultiSelectMode,
    loadError,
    loadFiles,
    openDeleteDialog,
    PHANTOM_ROW_HEIGHT,
    phantomOffset,
    renameError,
    renameValue,
    renamingName,
    rowVirtualizer,
    searchQuery,
    selectedNames,
    someSelected,
    sortDir,
    sortField,
    startCreate,
    startRename,
    tableScrollRef,
    toggleCheckbox,
    visibleList,
  } = props;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain" ref={tableScrollRef}>
          {isLoading ? (
            <div className="flex min-h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError === 'permission_denied' ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Lock className="h-8 w-8 opacity-40" />
              <p className="font-medium text-sm">Access Denied</p>
              <p className="text-xs opacity-60">
                This location requires elevated permissions or root access.
              </p>
            </div>
          ) : loadError === 'no_device' ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <MonitorOff className="h-8 w-8 opacity-40" />
              <p className="font-medium text-sm">No Device Connected</p>
              <p className="text-xs opacity-60">
                Connect a device via USB or wireless ADB and try again.
              </p>
            </div>
          ) : loadError === 'unknown' ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <AlertCircle className="h-8 w-8 opacity-40" />
              <p className="font-medium text-sm">Failed to Load</p>
              <p className="text-xs opacity-60">Check the logs panel for details.</p>
            </div>
          ) : fileList.length === 0 && creatingType === null ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <p className="text-sm">This directory is empty.</p>
              <div className="flex items-center gap-2">
                <Button
                  className="h-7 gap-1.5 text-xs"
                  disabled={isBusy}
                  onClick={() => {
                    startCreate('file');
                  }}
                  size="sm"
                  variant="outline"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  New File
                </Button>
                <Button
                  className="h-7 gap-1.5 text-xs"
                  disabled={isBusy}
                  onClick={() => {
                    startCreate('folder');
                  }}
                  size="sm"
                  variant="outline"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  New Folder
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full">
              <Table className="min-w-[46rem]">
                <TableHeader className="sticky top-0 z-10 block border-border border-b bg-muted/90 backdrop-blur-sm">
                  <TableRow
                    className="grid hover:bg-transparent"
                    style={{ gridTemplateColumns: fileTableColumns }}
                  >
                    {isMultiSelectMode ? (
                      <TableHead className="min-w-0 pl-3">
                        <Checkbox
                          aria-label="Select all"
                          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                          disabled={isBusy}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead className="min-w-0" />
                    {(['name', 'size', 'date'] as const).map((field) => (
                      <TableHead
                        aria-sort={
                          sortField === field
                            ? sortDir === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        className="min-w-0 cursor-pointer select-none capitalize hover:text-foreground"
                        key={field}
                        onClick={() => {
                          handleSortColumn(field);
                        }}
                        role="columnheader"
                      >
                        <span className="inline-flex min-w-0 items-center gap-1">
                          {field}
                          {sortField === field ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="min-w-0">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <FileExplorerVirtualBody
                  cancelCreate={cancelCreate}
                  createError={createError}
                  createName={createName}
                  creatingType={creatingType}
                  currentPath={currentPath}
                  fileList={fileList}
                  fileTableColumns={fileTableColumns}
                  handleCreateChange={handleCreateChange}
                  handleCreateConfirm={handleCreateConfirm}
                  handlePullItem={handlePullItem}
                  handlePushFileToDir={handlePushFileToDir}
                  handleRenameCancel={handleRenameCancel}
                  handleRenameChange={handleRenameChange}
                  handleRenameConfirm={handleRenameConfirm}
                  handleRowClick={handleRowClick}
                  handleRowDoubleClick={handleRowDoubleClick}
                  handleSelectFromMenu={handleSelectFromMenu}
                  isBusy={isBusy}
                  isCreating={isCreating}
                  isMultiSelectMode={isMultiSelectMode}
                  loadFiles={loadFiles}
                  openDeleteDialog={openDeleteDialog}
                  PHANTOM_ROW_HEIGHT={PHANTOM_ROW_HEIGHT}
                  phantomOffset={phantomOffset}
                  renameError={renameError}
                  renameValue={renameValue}
                  renamingName={renamingName}
                  rowVirtualizer={rowVirtualizer}
                  searchQuery={searchQuery}
                  selectedNames={selectedNames}
                  startRename={startRename}
                  toggleCheckbox={toggleCheckbox}
                  visibleList={visibleList}
                />
              </Table>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          disabled={isBusy}
          onClick={() => {
            startCreate('file');
          }}
        >
          <FilePlus2 className="h-4 w-4 shrink-0" />
          New File<span className="ml-auto pl-4 text-muted-foreground text-xs">Ctrl+N</span>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={isBusy}
          onClick={() => {
            startCreate('folder');
          }}
        >
          <FolderPlus className="h-4 w-4 shrink-0" />
          New Folder<span className="ml-auto pl-4 text-muted-foreground text-xs">Ctrl+Shift+N</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
