import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { useFileExplorerKeyboardShortcuts } from '@/features/file-explorer/hooks/useFileExplorerKeyboardShortcuts';
import { useFileExplorerLayout } from '@/features/file-explorer/hooks/useFileExplorerLayout';
import { useFileExplorerLoader } from '@/features/file-explorer/hooks/useFileExplorerLoader';
import { useFileExplorerMutations } from '@/features/file-explorer/hooks/useFileExplorerMutations';
import { useFileExplorerPathActions } from '@/features/file-explorer/hooks/useFileExplorerPathActions';
import {
  useFileExplorerRootAccess,
  usePathFileAccessMode,
} from '@/features/file-explorer/hooks/useFileExplorerRootAccess';
import { useFileExplorerSelection } from '@/features/file-explorer/hooks/useFileExplorerSelection';
import { useFileExplorerSort } from '@/features/file-explorer/hooks/useFileExplorerSort';
import { useFileExplorerTransfers } from '@/features/file-explorer/hooks/useFileExplorerTransfers';
import { PHANTOM_ROW_HEIGHT } from '@/features/file-explorer/model/fileExplorerConstants';
import {
  fileReducer,
  initFileState,
  initUIState,
  uiReducer,
} from '@/features/file-explorer/model/fileExplorerReducers';
import type {
  CreatingType,
  FileEntry,
  FileExplorerActions,
  FileExplorerEditing,
  FileExplorerListing,
  FileExplorerNavigation,
  FileExplorerSelection,
  FileExplorerStatus,
  LoadError,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { categorizeError } from '@/features/file-explorer/utils/fileExplorerErrors';
import { useDeviceStore } from '@/shared/stores/deviceStore';

/** Splitter drags emit a leftWidth change per frame; only persist once it settles. */
const TREE_WIDTH_PERSIST_DELAY_MS = 250;

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
  const editPathValueRef = useRef(editPathValue);

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
    editPathValueRef.current = editPathValue;
  }, [editPathValue]);

  // Debounced: leftWidth changes on every pointermove frame while dragging the
  // splitter, and localStorage.setItem is synchronous.
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('fe.treeWidth', String(leftWidth));
    }, TREE_WIDTH_PERSIST_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [leftWidth]);

  // Derived state
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navHistory.length - 1;
  const phantomOffset = creatingType === null ? 0 : PHANTOM_ROW_HEIGHT;
  const isBusy = isLoading || isPushing || isPulling || isDeleting || isRenaming || isCreating;

  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  // Proactive, not reactive: the no-device state is derived from the global
  // device poll, so it renders before any ListFiles call is attempted instead of
  // being string-matched out of adb's error text afterwards.
  const deviceCount = useDeviceStore((state) => state.devices.length);
  const hasDevice = deviceCount > 0;
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
  const isPullDisabled = isPulling || !singleSelected;

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
    handleOpenInEditor,
    handlePull,
    handlePullItem,
    handlePushFile,
    handlePushFileToDir,
    handlePushFolder,
  } = useFileExplorerTransfers({
    currentPath,
    getFileAccessMode,
    loadFiles,
    selectedSerialRef,
    setIsPulling,
    setIsPushing,
    singleSelected,
  });
  const {
    handleClearSearch,
    handleDeleteFromSelection,
    handleNavigateUp,
    handlePathClick,
    handleRefreshClick,
    handleRowDoubleClick,
  } = useFileExplorerPathActions({
    currentPath,
    handleOpenInEditor,
    loadFiles,
    openDeleteDialog,
    renamingName,
    selectedNames,
    setEditPathValue,
    setIsEditingPath,
    setSearchQuery,
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

  // ---------------------------------------------------------------------------
  // Grouped, independently memoized slices.
  //
  // The previous shape was one 80-key literal rebuilt every render, spread as
  // ~55 props (three of them inline object literals) into the main pane, which
  // made memoization impossible anywhere below. Each slice below changes only
  // when the state it describes changes.
  // ---------------------------------------------------------------------------

  const startCreateFile = useCallback(() => {
    startCreate('file');
  }, [startCreate]);
  const startCreateFolder = useCallback(() => {
    startCreate('folder');
  }, [startCreate]);
  const stopPathEditing = useCallback(() => {
    setIsEditingPath(false);
  }, [setIsEditingPath]);
  const handlePathEditCommit = useCallback(() => {
    const trimmedPath = editPathValueRef.current.trim();
    void loadFiles(
      trimmedPath && !trimmedPath.endsWith('/') ? `${trimmedPath}/` : trimmedPath || '/',
    );
    setIsEditingPath(false);
  }, [loadFiles, setIsEditingPath]);

  const actions = useMemo<FileExplorerActions>(
    () => ({
      cancelCreate,
      clearSelection,
      handleClearSearch,
      handleCollapseTree,
      handleCreateChange,
      handleCreateConfirm,
      handleDeleteFromSelection,
      handleExpandTree,
      handleGoBack,
      handleGoForward,
      handleNavigateUp,
      handleOpenInEditor,
      handlePathClick,
      handlePathEditCommit,
      handlePull,
      handlePullItem,
      handlePushFile,
      handlePushFileToDir,
      handlePushFolder,
      handleRefreshClick,
      handleRenameCancel,
      handleRenameChange,
      handleRenameConfirm,
      handleRootAccessToggle,
      handleRowClick,
      handleRowDoubleClick,
      handleSelectAll,
      handleSelectFromMenu,
      handleSortColumn,
      loadFiles,
      openDeleteDialog,
      setEditPathValue,
      setIsEditingPath,
      setSearchQuery,
      startCreate,
      startCreateFile,
      startCreateFolder,
      startRename,
      stopPathEditing,
      toggleCheckbox,
    }),
    [
      cancelCreate,
      clearSelection,
      handleClearSearch,
      handleCollapseTree,
      handleCreateChange,
      handleCreateConfirm,
      handleDeleteFromSelection,
      handleExpandTree,
      handleGoBack,
      handleGoForward,
      handleNavigateUp,
      handleOpenInEditor,
      handlePathClick,
      handlePathEditCommit,
      handlePull,
      handlePullItem,
      handlePushFile,
      handlePushFileToDir,
      handlePushFolder,
      handleRefreshClick,
      handleRenameCancel,
      handleRenameChange,
      handleRenameConfirm,
      handleRootAccessToggle,
      handleRowClick,
      handleRowDoubleClick,
      handleSelectAll,
      handleSelectFromMenu,
      handleSortColumn,
      loadFiles,
      openDeleteDialog,
      setEditPathValue,
      setIsEditingPath,
      setSearchQuery,
      startCreate,
      startCreateFile,
      startCreateFolder,
      startRename,
      stopPathEditing,
      toggleCheckbox,
    ],
  );

  const listing = useMemo<FileExplorerListing>(
    () => ({
      currentPath,
      fileList,
      loadError,
      phantomOffset,
      searchQuery,
      sortDir,
      sortField,
      visibleList,
    }),
    [currentPath, fileList, loadError, phantomOffset, searchQuery, sortDir, sortField, visibleList],
  );

  const editing = useMemo<FileExplorerEditing>(
    () => ({ createError, createName, creatingType, renameError, renameValue, renamingName }),
    [createError, createName, creatingType, renameError, renameValue, renamingName],
  );

  const selection = useMemo<FileExplorerSelection>(
    () => ({ allSelected, isMultiSelectMode, selectedNames, singleSelected, someSelected }),
    [allSelected, isMultiSelectMode, selectedNames, singleSelected, someSelected],
  );

  const navigation = useMemo<FileExplorerNavigation>(
    () => ({ canGoBack, canGoForward }),
    [canGoBack, canGoForward],
  );

  const status = useMemo<FileExplorerStatus>(
    () => ({
      editPathValue,
      hasDevice,
      isBusy,
      isCreating,
      isEditingPath,
      isLoading,
      isPullDisabled,
      isPushing,
    }),
    [
      editPathValue,
      hasDevice,
      isBusy,
      isCreating,
      isEditingPath,
      isLoading,
      isPullDisabled,
      isPushing,
    ],
  );

  const tree = useMemo(
    () => ({
      currentPath,
      getFileAccessMode,
      handleResizeKeyDown,
      isResizing,
      isTreeCollapsed,
      leftWidth,
      loadFiles,
      selectedSerial,
      startResizing,
      treeRefreshKey,
    }),
    [
      currentPath,
      getFileAccessMode,
      handleResizeKeyDown,
      isResizing,
      isTreeCollapsed,
      leftWidth,
      loadFiles,
      selectedSerial,
      startResizing,
      treeRefreshKey,
    ],
  );

  const deleteDialog = useMemo(
    () => ({
      fileList,
      filesToDelete,
      isDeleting,
      onConfirm: handleConfirmDelete,
      onOpenChange: setDeleteDialogOpen,
      open: deleteDialogOpen,
    }),
    [
      deleteDialogOpen,
      fileList,
      filesToDelete,
      handleConfirmDelete,
      isDeleting,
      setDeleteDialogOpen,
    ],
  );

  return {
    actions,
    containerRef,
    deleteDialog,
    editing,
    listing,
    navigation,
    rootAccessGranted,
    selection,
    status,
    tableScrollRef,
    tree,
  };
}
