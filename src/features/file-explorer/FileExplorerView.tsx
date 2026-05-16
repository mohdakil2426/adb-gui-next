import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useFileExplorerKeyboardShortcuts } from '@/features/file-explorer/hooks/useFileExplorerKeyboardShortcuts';
import { useFileExplorerLayout } from '@/features/file-explorer/hooks/useFileExplorerLayout';
import { useFileExplorerLoader } from '@/features/file-explorer/hooks/useFileExplorerLoader';
import { useFileExplorerMutations } from '@/features/file-explorer/hooks/useFileExplorerMutations';
import { useFileExplorerPathActions } from '@/features/file-explorer/hooks/useFileExplorerPathActions';
import {
  getStoredRootAccessGranted,
  useFileExplorerRootAccess,
  usePathFileAccessMode,
} from '@/features/file-explorer/hooks/useFileExplorerRootAccess';
import { useFileExplorerRowVirtualizer } from '@/features/file-explorer/hooks/useFileExplorerRowVirtualizer';
import { useFileExplorerSelection } from '@/features/file-explorer/hooks/useFileExplorerSelection';
import { useFileExplorerSort } from '@/features/file-explorer/hooks/useFileExplorerSort';
import { useFileExplorerTransfers } from '@/features/file-explorer/hooks/useFileExplorerTransfers';
import {
  DEFAULT_LEFT_WIDTH,
  FILE_TABLE_COLUMNS,
  FILE_TABLE_COLUMNS_WITH_SELECTION,
  MAX_LEFT_WIDTH,
  MIN_LEFT_WIDTH,
  PHANTOM_ROW_HEIGHT,
} from '@/features/file-explorer/model/fileExplorerConstants';
import type {
  CreatingType,
  FileEntry,
  LoadError,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { DeleteDialog } from '@/features/file-explorer/ui/DeleteDialog';
import { FileExplorerMainPane } from '@/features/file-explorer/ui/FileExplorerMainPane';
import { FileExplorerTreeSection } from '@/features/file-explorer/ui/FileExplorerTreeSection';
import { categorizeError } from '@/features/file-explorer/utils/fileExplorerErrors';
import { isValidDevicePath } from '@/features/file-explorer/utils/fileExplorerPaths';
import { useDeviceStore } from '@/shared/stores/deviceStore';

// ---------------------------------------------------------------------------
// File state: navigation, listing, history
// ---------------------------------------------------------------------------

interface FileState {
  currentPath: string;
  fileList: FileEntry[];
  historyIndex: number;
  isLoading: boolean;
  loadError: LoadError;
  navHistory: string[];
  searchQuery: string;
  treeRefreshKey: number;
}

type FileAction =
  | { type: 'SET_FILES'; payload: FileEntry[] }
  | { type: 'SET_PATH'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOAD_ERROR'; payload: LoadError }
  | { type: 'SET_TREE_REFRESH_KEY'; payload: number }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_NAV_HISTORY'; payload: string[] }
  | { type: 'SET_HISTORY_INDEX'; payload: number };

function fileReducer(state: FileState, action: FileAction): FileState {
  switch (action.type) {
    case 'SET_FILES':
      return { ...state, fileList: action.payload };
    case 'SET_PATH':
      return { ...state, currentPath: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_LOAD_ERROR':
      return { ...state, loadError: action.payload };
    case 'SET_TREE_REFRESH_KEY':
      return { ...state, treeRefreshKey: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_NAV_HISTORY':
      return { ...state, navHistory: action.payload };
    case 'SET_HISTORY_INDEX':
      return { ...state, historyIndex: action.payload };
  }
}

// ---------------------------------------------------------------------------
// UI state: rename, create, delete dialog, transfers, layout, path editing
// ---------------------------------------------------------------------------

interface UIState {
  createError: string;
  createName: string;
  creatingType: CreatingType;
  deleteDialogOpen: boolean;
  editPathValue: string;
  filesToDelete: string[];
  isCreating: boolean;
  isDeleting: boolean;
  isEditingPath: boolean;
  isPulling: boolean;
  isPushing: boolean;
  isRenaming: boolean;
  isResizing: boolean;
  isTreeCollapsed: boolean;
  leftWidth: number;
  renameError: string;
  renameValue: string;
  renamingName: string | null;
  rootAccessGranted: boolean;
}

type UIAction =
  | { type: 'SET_RENAMING_NAME'; payload: string | null }
  | { type: 'SET_RENAME_VALUE'; payload: string }
  | { type: 'SET_RENAME_ERROR'; payload: string }
  | { type: 'SET_IS_RENAMING'; payload: boolean }
  | { type: 'SET_DELETE_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_FILES_TO_DELETE'; payload: string[] }
  | { type: 'SET_IS_DELETING'; payload: boolean }
  | { type: 'SET_CREATING_TYPE'; payload: CreatingType }
  | { type: 'SET_CREATE_NAME'; payload: string }
  | { type: 'SET_CREATE_ERROR'; payload: string }
  | { type: 'SET_IS_CREATING'; payload: boolean }
  | { type: 'SET_IS_PUSHING'; payload: boolean }
  | { type: 'SET_IS_PULLING'; payload: boolean }
  | { type: 'SET_LEFT_WIDTH'; payload: number | ((prev: number) => number) }
  | { type: 'SET_IS_RESIZING'; payload: boolean }
  | { type: 'SET_IS_TREE_COLLAPSED'; payload: boolean }
  | { type: 'SET_IS_EDITING_PATH'; payload: boolean }
  | { type: 'SET_EDIT_PATH_VALUE'; payload: string }
  | { type: 'SET_ROOT_ACCESS_GRANTED'; payload: boolean };

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_RENAMING_NAME':
      return { ...state, renamingName: action.payload };
    case 'SET_RENAME_VALUE':
      return { ...state, renameValue: action.payload };
    case 'SET_RENAME_ERROR':
      return { ...state, renameError: action.payload };
    case 'SET_IS_RENAMING':
      return { ...state, isRenaming: action.payload };
    case 'SET_DELETE_DIALOG_OPEN':
      return { ...state, deleteDialogOpen: action.payload };
    case 'SET_FILES_TO_DELETE':
      return { ...state, filesToDelete: action.payload };
    case 'SET_IS_DELETING':
      return { ...state, isDeleting: action.payload };
    case 'SET_CREATING_TYPE':
      return { ...state, creatingType: action.payload };
    case 'SET_CREATE_NAME':
      return { ...state, createName: action.payload };
    case 'SET_CREATE_ERROR':
      return { ...state, createError: action.payload };
    case 'SET_IS_CREATING':
      return { ...state, isCreating: action.payload };
    case 'SET_IS_PUSHING':
      return { ...state, isPushing: action.payload };
    case 'SET_IS_PULLING':
      return { ...state, isPulling: action.payload };
    case 'SET_LEFT_WIDTH': {
      const next =
        typeof action.payload === 'function' ? action.payload(state.leftWidth) : action.payload;
      return { ...state, leftWidth: next };
    }
    case 'SET_IS_RESIZING':
      return { ...state, isResizing: action.payload };
    case 'SET_IS_TREE_COLLAPSED':
      return { ...state, isTreeCollapsed: action.payload };
    case 'SET_IS_EDITING_PATH':
      return { ...state, isEditingPath: action.payload };
    case 'SET_EDIT_PATH_VALUE':
      return { ...state, editPathValue: action.payload };
    case 'SET_ROOT_ACCESS_GRANTED':
      return { ...state, rootAccessGranted: action.payload };
  }
}

// ---------------------------------------------------------------------------
// Initializers
// ---------------------------------------------------------------------------

function resolveInitialPath(): string {
  const saved = localStorage.getItem('fe.currentPath');
  return isValidDevicePath(saved) ? saved : '/sdcard/';
}

function initFileState(): FileState {
  const currentPath = resolveInitialPath();
  return {
    fileList: [],
    currentPath,
    isLoading: false,
    loadError: null,
    treeRefreshKey: 0,
    searchQuery: '',
    navHistory: [currentPath],
    historyIndex: 0,
  };
}

function initUIState(): UIState {
  const savedWidth = localStorage.getItem('fe.treeWidth');
  let leftWidth = DEFAULT_LEFT_WIDTH;
  if (savedWidth) {
    const parsed = Number(savedWidth);
    if (!Number.isNaN(parsed) && parsed >= MIN_LEFT_WIDTH && parsed <= MAX_LEFT_WIDTH) {
      leftWidth = parsed;
    }
  }
  return {
    renamingName: null,
    renameValue: '',
    renameError: '',
    isRenaming: false,
    deleteDialogOpen: false,
    filesToDelete: [],
    isDeleting: false,
    creatingType: null,
    createName: '',
    createError: '',
    isCreating: false,
    isPushing: false,
    isPulling: false,
    leftWidth,
    isResizing: false,
    isTreeCollapsed: localStorage.getItem('fe.treeCollapsed') === 'true',
    isEditingPath: false,
    editPathValue: '',
    rootAccessGranted: getStoredRootAccessGranted(),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ViewFileExplorer({ activeView }: { activeView: string }) {
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

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border"
      ref={containerRef}
    >
      <h1 className="sr-only">File Explorer</h1>
      {isResizing ? <div className="fixed inset-0 z-50 cursor-col-resize select-none" /> : null}
      <FileExplorerTreeSection
        currentPath={currentPath}
        getFileAccessMode={getFileAccessMode}
        handleCollapseTree={handleCollapseTree}
        handleResizeKeyDown={handleResizeKeyDown}
        isResizing={isResizing}
        isTreeCollapsed={isTreeCollapsed}
        leftWidth={leftWidth}
        loadFiles={loadFiles}
        selectedSerial={selectedSerial}
        startResizing={startResizing}
        treeRefreshKey={treeRefreshKey}
      />
      <FileExplorerMainPane
        cancelCreate={cancelCreate}
        clearSelection={clearSelection}
        createError={createError}
        createName={createName}
        creatingType={creatingType}
        currentPath={currentPath}
        display={{ allSelected, isMultiSelectMode, someSelected }}
        editPathValue={editPathValue}
        fileList={fileList}
        fileTableColumns={fileTableColumns}
        handleBackClick={handleBackClick}
        handleClearSearch={handleClearSearch}
        handleCreateChange={handleCreateChange}
        handleCreateConfirm={handleCreateConfirm}
        handleDeleteFromSelection={handleDeleteFromSelection}
        handleExpandTree={handleExpandTree}
        handleGoBack={handleGoBack}
        handleGoForward={handleGoForward}
        handlePathClick={handlePathClick}
        handlePull={handlePull}
        handlePullItem={handlePullItem}
        handlePushFile={handlePushFile}
        handlePushFileToDir={handlePushFileToDir}
        handlePushFolder={handlePushFolder}
        handleRefreshClick={handleRefreshClick}
        handleRenameCancel={handleRenameCancel}
        handleRenameChange={handleRenameChange}
        handleRenameConfirm={handleRenameConfirm}
        handleRowClick={handleRowClick}
        handleRowDoubleClick={handleRowDoubleClick}
        handleSelectAll={handleSelectAll}
        handleSelectFromMenu={handleSelectFromMenu}
        handleSortColumn={handleSortColumn}
        isTreeCollapsed={isTreeCollapsed}
        loadError={loadError}
        loadFiles={loadFiles}
        navigation={{ canGoBack, canGoForward }}
        onRootAccessToggle={handleRootAccessToggle}
        openDeleteDialog={openDeleteDialog}
        PHANTOM_ROW_HEIGHT={PHANTOM_ROW_HEIGHT}
        permissions={{ rootAccessGranted }}
        phantomOffset={phantomOffset}
        renameError={renameError}
        renameValue={renameValue}
        renamingName={renamingName}
        rowVirtualizer={rowVirtualizer}
        searchQuery={searchQuery}
        selectedNames={selectedNames}
        setEditPathValue={setEditPathValue}
        setIsEditingPath={setIsEditingPath}
        setSearchQuery={setSearchQuery}
        sortDir={sortDir}
        sortField={sortField}
        startCreate={startCreate}
        startRename={startRename}
        state={{ isBusy, isCreating, isEditingPath, isLoading, isPullDisabled, isPushing }}
        tableScrollRef={tableScrollRef}
        toggleCheckbox={toggleCheckbox}
        visibleList={visibleList}
      />
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
