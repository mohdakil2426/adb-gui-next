import type { Virtualizer } from '@tanstack/react-virtual';
import { Trash2 } from 'lucide-react';
import type {
  CreatingType,
  FileEntry,
  LoadError,
  SortDir,
  SortField,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { FileExplorerTablePane } from '@/features/file-explorer/ui/FileExplorerTablePane';
import { FileExplorerToolbar } from '@/features/file-explorer/ui/FileExplorerToolbar';
import { SelectionSummaryBar } from '@/shared/components/SelectionSummaryBar';
import { Button } from '@/shared/ui/button';

interface Props {
  allSelected: boolean;
  cancelCreate: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  clearSelection: () => void;
  createError: string;
  createName: string;
  creatingType: CreatingType;
  currentPath: string;
  editPathValue: string;
  fileList: FileEntry[];
  fileTableColumns: string;
  handleBackClick: () => void;
  handleClearSearch: () => void;
  handleCreateChange: (value: string) => void;
  handleCreateConfirm: () => Promise<void>;
  handleDeleteFromSelection: () => void;
  handleExpandTree: () => void;
  handleGoBack: () => void;
  handleGoForward: () => void;
  handlePathClick: () => void;
  handlePull: () => Promise<void>;
  handlePullItem: (file: FileEntry) => Promise<void>;
  handlePushFile: () => Promise<void>;
  handlePushFileToDir: (targetDir: string) => Promise<void>;
  handlePushFolder: () => Promise<void>;
  handleRefreshClick: () => void;
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
  isEditingPath: boolean;
  isLoading: boolean;
  isMultiSelectMode: boolean;
  isPullDisabled: boolean;
  isPushing: boolean;
  isTreeCollapsed: boolean;
  loadError: LoadError;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  openDeleteDialog: (names: string[]) => void;
  PHANTOM_ROW_HEIGHT: number;
  phantomOffset: number;
  renameError: string;
  renameValue: string;
  renamingName: string | null;
  rowVirtualizer: Virtualizer<HTMLElement, Element>;
  searchQuery: string;
  selectedNames: Set<string>;
  setEditPathValue: (v: string) => void;
  setIsEditingPath: (v: boolean) => void;
  setSearchQuery: (v: string) => void;
  someSelected: boolean;
  sortDir: SortDir;
  sortField: SortField;
  startCreate: (type: 'file' | 'folder') => void;
  startRename: (entry: FileEntry) => void;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  toggleCheckbox: (name: string) => void;
  visibleList: FileEntry[];
}

export function FileExplorerMainPane(p: Props) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <FileExplorerToolbar
        canGoBack={p.canGoBack}
        canGoForward={p.canGoForward}
        currentPath={p.currentPath}
        editPathValue={p.editPathValue}
        isBusy={p.isBusy}
        isEditingPath={p.isEditingPath}
        isLoading={p.isLoading}
        isPullDisabled={p.isPullDisabled}
        isPushing={p.isPushing}
        isTreeCollapsed={p.isTreeCollapsed}
        onBack={p.handleGoBack}
        onClearSearch={p.handleClearSearch}
        onCreateFile={() => {
          p.startCreate('file');
        }}
        onCreateFolder={() => {
          p.startCreate('folder');
        }}
        onExpandTree={p.handleExpandTree}
        onExport={p.handlePull}
        onGoUp={p.handleGoForward}
        onImportFile={p.handlePushFile}
        onImportFolder={p.handlePushFolder}
        onPathClick={p.handlePathClick}
        onPathEditingChange={p.setEditPathValue}
        onPathEditingCommit={() => {
          const trimmedPath = p.editPathValue.trim();
          void p.loadFiles(
            trimmedPath && !trimmedPath.endsWith('/') ? `${trimmedPath}/` : trimmedPath || '/',
          );
          p.setIsEditingPath(false);
        }}
        onPathEditingStop={() => {
          p.setIsEditingPath(false);
        }}
        onRefresh={p.handleRefreshClick}
        onSearchClear={p.handleClearSearch}
        onSearchQueryChange={p.setSearchQuery}
        onUp={p.handleBackClick}
        pullTitle={p.selectedNames.size > 1 ? 'Select a single item to export' : undefined}
        searchQuery={p.searchQuery}
      />
      {p.isMultiSelectMode && p.selectedNames.size > 0 && !p.renamingName ? (
        <SelectionSummaryBar
          actions={
            <Button
              className="h-6 px-2 text-xs"
              disabled={p.isBusy}
              onClick={p.handleDeleteFromSelection}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-3 w-3 shrink-0" />
              <span className="ml-1 hidden sm:inline">Delete</span>
            </Button>
          }
          count={p.selectedNames.size}
          disabled={p.isBusy}
          label={p.selectedNames.size === 1 ? 'item selected' : 'items selected'}
          onClear={p.clearSelection}
        />
      ) : null}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="pointer-events-none absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
      >
        {p.selectedNames.size > 0
          ? `${p.selectedNames.size} item${p.selectedNames.size > 1 ? 's' : ''} selected`
          : null}
      </div>
      <FileExplorerTablePane
        allSelected={p.allSelected}
        cancelCreate={p.cancelCreate}
        createError={p.createError}
        createName={p.createName}
        creatingType={p.creatingType}
        currentPath={p.currentPath}
        fileList={p.fileList}
        fileTableColumns={p.fileTableColumns}
        handleCreateChange={p.handleCreateChange}
        handleCreateConfirm={p.handleCreateConfirm}
        handlePullItem={p.handlePullItem}
        handlePushFileToDir={p.handlePushFileToDir}
        handleRenameCancel={p.handleRenameCancel}
        handleRenameChange={p.handleRenameChange}
        handleRenameConfirm={p.handleRenameConfirm}
        handleRowClick={p.handleRowClick}
        handleRowDoubleClick={p.handleRowDoubleClick}
        handleSelectAll={p.handleSelectAll}
        handleSelectFromMenu={p.handleSelectFromMenu}
        handleSortColumn={p.handleSortColumn}
        isBusy={p.isBusy}
        isCreating={p.isCreating}
        isLoading={p.isLoading}
        isMultiSelectMode={p.isMultiSelectMode}
        loadError={p.loadError}
        loadFiles={p.loadFiles}
        openDeleteDialog={p.openDeleteDialog}
        PHANTOM_ROW_HEIGHT={p.PHANTOM_ROW_HEIGHT}
        phantomOffset={p.phantomOffset}
        renameError={p.renameError}
        renameValue={p.renameValue}
        renamingName={p.renamingName}
        rowVirtualizer={p.rowVirtualizer}
        searchQuery={p.searchQuery}
        selectedNames={p.selectedNames}
        someSelected={p.someSelected}
        sortDir={p.sortDir}
        sortField={p.sortField}
        startCreate={p.startCreate}
        startRename={p.startRename}
        tableContainerRef={p.tableContainerRef}
        toggleCheckbox={p.toggleCheckbox}
        visibleList={p.visibleList}
      />
    </div>
  );
}
