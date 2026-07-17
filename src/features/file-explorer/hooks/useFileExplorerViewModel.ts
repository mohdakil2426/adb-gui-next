import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useFileExplorerKeyboardShortcuts } from '@/features/file-explorer/hooks/useFileExplorerKeyboardShortcuts';
import { useFileExplorerLayout } from '@/features/file-explorer/hooks/useFileExplorerLayout';
import { useFileExplorerLoader } from '@/features/file-explorer/hooks/useFileExplorerLoader';
import { useFileExplorerMutations } from '@/features/file-explorer/hooks/useFileExplorerMutations';
import { useFileExplorerPathActions } from '@/features/file-explorer/hooks/useFileExplorerPathActions';
import {
  useFileExplorerRootAccess,
  usePathFileAccessMode,
} from '@/features/file-explorer/hooks/useFileExplorerRootAccess';
import { useFileExplorerRowVirtualizer } from '@/features/file-explorer/hooks/useFileExplorerRowVirtualizer';
import { useFileExplorerSelection } from '@/features/file-explorer/hooks/useFileExplorerSelection';
import { useFileExplorerSort } from '@/features/file-explorer/hooks/useFileExplorerSort';
import { useFileExplorerTransfers } from '@/features/file-explorer/hooks/useFileExplorerTransfers';
import {
  FILE_TABLE_COLUMNS,
  FILE_TABLE_COLUMNS_WITH_SELECTION,
  PHANTOM_ROW_HEIGHT,
} from '@/features/file-explorer/model/fileExplorerConstants';
import {
  fileReducer,
  initFileState,
  initUIState,
  uiReducer,
} from '@/features/file-explorer/model/fileExplorerReducers';
import type {
  CreatingType,
  FileEntry,
  LoadError,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { categorizeError } from '@/features/file-explorer/utils/fileExplorerErrors';
import { useDeviceStore } from '@/shared/stores/deviceStore';

export function useFileExplorerViewModel(activeView: string) {
  const [fileState, fileDispatch] = useReducer(fileReducer, undefined, initFileState);
  const [uiState, uiDispatch] = useReducer(uiReducer, undefined, initUIState);

  // Stable setter wrappers -- let existing hooks call setState-like functions
  // while the actual state lives in reducers.
  const setFileList = useCallback(
    (v: FileEntry[]) => fileDispatch({ type: 'SET_FILES', payload: v }),
    [],
  );
  const setCurrentPath = useCallback(
    (v: string) => fileDispatch({ type: 'SET_PATH', payload: v }),
    [],
  );
  const setIsLoading = useCallback(
    (v: boolean) => fileDispatch({ type: 'SET_LOADING', payload: v }),
    [],
  );
  const setLoadError = useCallback(
    (v: LoadError) => fileDispatch({ type: 'SET_LOAD_ERROR', payload: v }),
    [],
  );
  const setTreeRefreshKey = useCallback(
    (v: number) => fileDispatch({ type: 'SET_TREE_REFRESH_KEY', payload: v }),
    [],
  );
  const setSearchQuery = useCallback(
    (v: string) => fileDispatch({ type: 'SET_SEARCH_QUERY', payload: v }),
    [],
  );
  const setNavHistory = useCallback(
    (v: string[]) => fileDispatch({ type: 'SET_NAV_HISTORY', payload: v }),
    [],
  );
  const setHistoryIndex = useCallback(
    (v: number) => fileDispatch({ type: 'SET_HISTORY_INDEX', payload: v }),
    [],
  );
  const setRenamingName = useCallback(
    (v: string | null) => uiDispatch({ type: 'SET_RENAMING_NAME', payload: v }),
    [],
  );
  const setRenameValue = useCallback(
    (v: string) => uiDispatch({ type: 'SET_RENAME_VALUE', payload: v }),
    [],
  );
  const setRenameError = useCallback(
    (v: string) => uiDispatch({ type: 'SET_RENAME_ERROR', payload: v }),
    [],
  );
  const setIsRenaming = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_IS_RENAMING', payload: v }),
    [],
  );
  const setDeleteDialogOpen = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_DELETE_DIALOG_OPEN', payload: v }),
    [],
  );
  const setFilesToDelete = useCallback(
    (v: string[]) => uiDispatch({ type: 'SET_FILES_TO_DELETE', payload: v }),
    [],
  );
  const setIsDeleting = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_IS_DELETING', payload: v }),
    [],
  );
  const setCreatingType = useCallback(
    (v: CreatingType) => uiDispatch({ type: 'SET_CREATING_TYPE', payload: v }),
    [],
  );
  const setCreateName = useCallback(
    (v: string) => uiDispatch({ type: 'SET_CREATE_NAME', payload: v }),
    [],
  );
  const setCreateError = useCallback(
    (v: string) => uiDispatch({ type: 'SET_CREATE_ERROR', payload: v }),
    [],
  );
  const setIsCreating = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_IS_CREATING', payload: v }),
    [],
  );
  const setIsPushing = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_IS_PUSHING', payload: v }),
    [],
  );
  const setIsPulling = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_IS_PULLING', payload: v }),
    [],
  );
  const setLeftWidth = useCallback(
    (v: number | ((prev: number) => number)) => uiDispatch({ type: 'SET_LEFT_WIDTH', payload: v }),
    [],
  );
  const setIsResizing = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_IS_RESIZING', payload: v }),
    [],
  );
  const setIsTreeCollapsed = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_IS_TREE_COLLAPSED', payload: v }),
    [],
  );
  const setIsEditingPath = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_IS_EDITING_PATH', payload: v }),
    [],
  );
  const setEditPathValue = useCallback(
    (v: string) => uiDispatch({ type: 'SET_EDIT_PATH_VALUE', payload: v }),
    [],
  );
  const setRootAccessGranted = useCallback(
    (v: boolean) => uiDispatch({ type: 'SET_ROOT_ACCESS_GRANTED', payload: v }),
    [],
  );

  // Destructure for readability in JSX and hook calls
  const {
    fileList,
    currentPath,
    isLoading,
    loadError,
    treeRefreshKey,
    searchQuery,
    navHistory,
    historyIndex,
  } = fileState;
  const {
    renamingName,
    renameValue,
    renameError,
    isRenaming,
    deleteDialogOpen,
    filesToDelete,
    isDeleting,
    creatingType,
    createName,
    createError,
    isCreating,
    isPushing,
    isPulling,
    leftWidth,
    isResizing,
    isTreeCollapsed,
    isEditingPath,
    editPathValue,
    rootAccessGranted,
  } = uiState;

  // Refs
  const historyIndexRef = useRef(historyIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(currentPath);
  const rootAccessGrantedRef = useRef(rootAccessGranted);
  const selectedSerialRef = useRef<string | null>(null);
  const wasResponsiveCollapsedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const fileListRef = useRef<FileEntry[]>([]);
  const navHistoryRef = useRef(navHistory);
  const treeRefreshKeyRef = useRef(treeRefreshKey);

  // Sync refs with reducer state
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    fileListRef.current = fileList;
  }, [fileList]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    navHistoryRef.current = navHistory;
  }, [navHistory]);

  useEffect(() => {
    treeRefreshKeyRef.current = treeRefreshKey;
  }, [treeRefreshKey]);

  useEffect(() => {
    localStorage.setItem('fe.treeWidth', String(leftWidth));
  }, [leftWidth]);

  // Derived state
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navHistory.length - 1;
  const phantomOffset = creatingType === null ? 0 : PHANTOM_ROW_HEIGHT;
  const isBusy = isLoading || isPushing || isPulling || isDeleting || isRenaming || isCreating;

  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  useEffect(() => {
    selectedSerialRef.current = selectedSerial;
  }, [selectedSerial]);

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
  const rowVirtualizer = useFileExplorerRowVirtualizer(visibleList, tableScrollRef);

  const getFileAccessMode = usePathFileAccessMode(rootAccessGrantedRef);

  const { handleCollapseTree, handleExpandTree, handleResizeKeyDown, startResizing } =
    useFileExplorerLayout({
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
    getFileAccessMode,
    historyIndexRef,
    loadRequestIdRef,
    navHistoryRef,
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
    treeRefreshKeyRef,
  });

  const handleRootAccessToggle = useFileExplorerRootAccess({
    activeView,
    currentPathRef,
    loadFiles,
    rootAccessGranted,
    rootAccessGrantedRef,
    selectedSerial,
    selectedSerialRef,
    setFileList,
    setIsMultiSelectMode,
    setRootAccessGranted,
    setSelectedNames,
  });

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
    getFileAccessMode,
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
      getFileAccessMode,
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

  return {
    PHANTOM_ROW_HEIGHT,
    allSelected,
    canGoBack,
    canGoForward,
    cancelCreate,
    clearSelection,
    containerRef,
    createError,
    createName,
    creatingType,
    currentPath,
    deleteDialogOpen,
    editPathValue,
    fileList,
    fileTableColumns,
    filesToDelete,
    getFileAccessMode,
    handleBackClick,
    handleClearSearch,
    handleCollapseTree,
    handleConfirmDelete,
    handleCreateChange,
    handleCreateConfirm,
    handleDeleteFromSelection,
    handleExpandTree,
    handleGoBack,
    handleGoForward,
    handlePathClick,
    handlePull,
    handlePullItem,
    handlePushFile,
    handlePushFileToDir,
    handlePushFolder,
    handleRefreshClick,
    handleRenameCancel,
    handleRenameChange,
    handleRenameConfirm,
    handleResizeKeyDown,
    handleRootAccessToggle,
    handleRowClick,
    handleRowDoubleClick,
    handleSelectAll,
    handleSelectFromMenu,
    handleSortColumn,
    isBusy,
    isCreating,
    isDeleting,
    isEditingPath,
    isLoading,
    isMultiSelectMode,
    isPullDisabled,
    isPushing,
    isResizing,
    isTreeCollapsed,
    leftWidth,
    loadError,
    loadFiles,
    openDeleteDialog,
    phantomOffset,
    renameError,
    renameValue,
    renamingName,
    rootAccessGranted,
    rowVirtualizer,
    searchQuery,
    selectedNames,
    selectedSerial,
    setDeleteDialogOpen,
    setEditPathValue,
    setIsEditingPath,
    setSearchQuery,
    someSelected,
    sortDir,
    sortField,
    startCreate,
    startRename,
    startResizing,
    tableScrollRef,
    toggleCheckbox,
    treeRefreshKey,
    visibleList,
  };
}
