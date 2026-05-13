import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFileExplorerKeyboardShortcuts } from '@/features/file-explorer/hooks/useFileExplorerKeyboardShortcuts';
import { useFileExplorerLayout } from '@/features/file-explorer/hooks/useFileExplorerLayout';
import { useFileExplorerLoader } from '@/features/file-explorer/hooks/useFileExplorerLoader';
import { useFileExplorerMutations } from '@/features/file-explorer/hooks/useFileExplorerMutations';
import { useFileExplorerPathActions } from '@/features/file-explorer/hooks/useFileExplorerPathActions';
import { useFileExplorerSelection } from '@/features/file-explorer/hooks/useFileExplorerSelection';
import { useFileExplorerSort } from '@/features/file-explorer/hooks/useFileExplorerSort';
import { useFileExplorerTransfers } from '@/features/file-explorer/hooks/useFileExplorerTransfers';
import {
  DEFAULT_LEFT_WIDTH,
  FILE_TABLE_COLUMNS,
  FILE_TABLE_COLUMNS_WITH_SELECTION,
  PHANTOM_ROW_HEIGHT,
} from '@/features/file-explorer/model/fileExplorerConstants';
import type {
  CreatingType,
  FileEntry,
  LoadError,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { DeleteDialog } from '@/features/file-explorer/ui/DeleteDialog';
import { FileExplorerMainPane } from '@/features/file-explorer/ui/FileExplorerMainPane';
import { FileExplorerTreePane } from '@/features/file-explorer/ui/FileExplorerTreePane';
import { categorizeError } from '@/features/file-explorer/utils/fileExplorerErrors';
import { isValidDevicePath } from '@/features/file-explorer/utils/fileExplorerPaths';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { cn } from '@/shared/utils/cn';

export function ViewFileExplorer({ activeView }: { activeView: string }) {
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState(() => {
    const saved = localStorage.getItem('fe.currentPath');
    return isValidDevicePath(saved) ? saved : '/sdcard/';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [navHistory, setNavHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('fe.currentPath');
    return [isValidDevicePath(saved) ? saved : '/sdcard/'];
  });
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navHistory.length - 1;
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [creatingType, setCreatingType] = useState<CreatingType>(null);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const phantomOffset = creatingType === null ? 0 : PHANTOM_ROW_HEIGHT;
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(
    () => localStorage.getItem('fe.treeCollapsed') === 'true',
  );
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editPathValue, setEditPathValue] = useState('');
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);

  const containerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(localStorage.getItem('fe.currentPath') ?? '/sdcard/');
  const selectedSerialRef = useRef<string | null>(selectedSerial);
  const wasResponsiveCollapsedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const fileListRef = useRef<FileEntry[]>([]);
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    fileListRef.current = fileList;
  }, [fileList]);

  const isBusy = isLoading || isPushing || isPulling || isDeleting || isRenaming || isCreating;
  const { handleSortColumn, sortDir, sortField, visibleList } = useFileExplorerSort({
    fileList,
    searchQuery,
  });

  const {
    allSelected,
    clearSelection,
    handleRowClick,
    handleSelectAll,
    handleSelectFromMenu,
    isMultiSelectMode,
    selectedNames,
    setIsMultiSelectMode,
    setSelectedNames,
    singleSelected,
    someSelected,
    toggleCheckbox,
  } = useFileExplorerSelection({
    fileList,
    renamingName,
    visibleList,
  });
  const fileTableColumns = isMultiSelectMode
    ? FILE_TABLE_COLUMNS_WITH_SELECTION
    : FILE_TABLE_COLUMNS;
  const isPullDisabled = isPulling || !singleSelected;

  const rowVirtualizer = useVirtualizer({
    count: visibleList.length,
    getScrollElement: () => tableContainerRef.current?.parentElement ?? null,
    estimateSize: () => 40,
    overscan: 10,
  });

  const { handleCollapseTree, handleExpandTree, startResizing } = useFileExplorerLayout({
    containerRef,
    isResizing,
    setIsResizing,
    setIsTreeCollapsed,
    setLeftWidth,
    wasResponsiveCollapsedRef,
  });

  const { loadFiles, handleGoBack, handleGoForward } = useFileExplorerLoader({
    categorizeError,
    currentPathRef,
    historyIndexRef,
    loadRequestIdRef,
    selectedSerialRef,
    setCreateError,
    setCreateName,
    setCreatingType,
    setCurrentPath,
    setFileList,
    setHistoryIndex,
    setIsLoading,
    setIsMultiSelectMode,
    setLoadError,
    setNavHistory,
    setRenamingName,
    setSearchQuery,
    setSelectedNames,
    setTreeRefreshKey,
  });

  useEffect(() => {
    selectedSerialRef.current = selectedSerial;
    setFileList([]);
    setSelectedNames(new Set());
    setIsMultiSelectMode(false);
    if (activeView === 'files' && selectedSerial) {
      void loadFiles(currentPathRef.current, false);
    }
  }, [activeView, selectedSerial, loadFiles]);

  const {
    cancelCreate,
    handleConfirmDelete,
    handleCreateChange,
    handleCreateConfirm,
    handleRenameCancel,
    handleRenameChange,
    handleRenameConfirm,
    openDeleteDialog,
    startCreate,
    startRename: startRenameByName,
  } = useFileExplorerMutations({
    createError,
    createName,
    creatingType,
    currentPath,
    filesToDelete,
    loadFiles,
    renameValue,
    renamingName,
    selectedSerialRef,
    setCreateError,
    setCreateName,
    setCreatingType,
    setDeleteDialogOpen,
    setFilesToDelete,
    setIsCreating,
    setIsDeleting,
    setIsRenaming,
    setRenameError,
    setRenameValue,
    setRenamingName,
    setSelectedNames,
  });
  const startRename = useCallback(
    (file: FileEntry) => startRenameByName(file.name),
    [startRenameByName],
  );

  const {
    handleBackClick,
    handleClearSearch,
    handleDeleteFromSelection,
    handlePathClick,
    handleRefreshClick,
    handleRowDoubleClick,
  } = useFileExplorerPathActions({
    currentPath,
    loadFiles,
    openDeleteDialog,
    renamingName,
    selectedNames,
    setEditPathValue,
    setIsEditingPath,
    setSearchQuery,
  });

  const { handlePull, handlePullItem, handlePushFile, handlePushFileToDir, handlePushFolder } =
    useFileExplorerTransfers({
      currentPath,
      loadFiles,
      selectedSerialRef,
      setIsPulling,
      setIsPushing,
      singleSelected,
    });

  useFileExplorerKeyboardShortcuts({
    activeView,
    cancelCreate,
    clearSelection,
    creatingType,
    currentPathRef,
    fileListRef,
    handleGoBack,
    handleGoForward,
    handleRenameCancel,
    loadFiles,
    openDeleteDialog,
    renamingName,
    searchQuery,
    selectedNames,
    setIsMultiSelectMode,
    setSearchQuery,
    setSelectedNames,
    startCreate,
    startRename,
  });

  return (
    <div
      className="flex h-[calc(100svh-4rem)] overflow-hidden rounded-lg border border-border"
      ref={containerRef}
    >
      <h1 className="sr-only">File Explorer</h1>
      {isResizing ? <div className="fixed inset-0 z-50 cursor-col-resize select-none" /> : null}

      {!isTreeCollapsed && (
        <FileExplorerTreePane
          currentPath={currentPath}
          handleCollapseTree={handleCollapseTree}
          leftWidth={leftWidth}
          loadFiles={loadFiles}
          selectedSerial={selectedSerial}
          treeRefreshKey={treeRefreshKey}
        />
      )}

      {!isTreeCollapsed && (
        <div
          className={cn(
            'w-px shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/60 active:bg-primary',
            isResizing && 'bg-primary',
          )}
          onMouseDown={startResizing}
        />
      )}

      {/* biome-ignore format: grouped prop plumbing keeps this view as a coordinator. */}
      <FileExplorerMainPane {...{ allSelected, cancelCreate, canGoBack, canGoForward, clearSelection, createError, createName, creatingType, currentPath, editPathValue, fileList, fileTableColumns, handleBackClick, handleClearSearch, handleCreateChange, handleCreateConfirm, handleDeleteFromSelection, handleExpandTree, handleGoBack, handleGoForward, handlePathClick, handlePull, handlePullItem, handlePushFile, handlePushFileToDir, handlePushFolder, handleRefreshClick, handleRenameCancel, handleRenameChange, handleRenameConfirm, handleRowClick, handleRowDoubleClick, handleSelectAll, handleSelectFromMenu, handleSortColumn, isBusy, isCreating, isEditingPath, isLoading, isMultiSelectMode, isPullDisabled, isPushing, isTreeCollapsed, loadError, loadFiles, openDeleteDialog, PHANTOM_ROW_HEIGHT, phantomOffset, renameError, renameValue, renamingName, rowVirtualizer, searchQuery, selectedNames, setEditPathValue, setIsEditingPath, setSearchQuery, someSelected, sortDir, sortField, startCreate, startRename, tableContainerRef, toggleCheckbox, visibleList }} />

      <DeleteDialog
        fileList={fileList}
        filesToDelete={filesToDelete}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
      />
    </div>
  );
}
