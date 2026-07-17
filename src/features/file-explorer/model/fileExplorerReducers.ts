import { getStoredRootAccessGranted } from '@/features/file-explorer/hooks/useFileExplorerRootAccess';
import {
  DEFAULT_LEFT_WIDTH,
  MAX_LEFT_WIDTH,
  MIN_LEFT_WIDTH,
} from '@/features/file-explorer/model/fileExplorerConstants';
import type {
  CreatingType,
  FileEntry,
  LoadError,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { isValidDevicePath } from '@/features/file-explorer/utils/fileExplorerPaths';

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

export function fileReducer(state: FileState, action: FileAction): FileState {
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

export function uiReducer(state: UIState, action: UIAction): UIState {
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

export function initFileState(): FileState {
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

export function initUIState(): UIState {
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
