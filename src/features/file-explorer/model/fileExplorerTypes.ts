import type { KeyboardEvent, MouseEvent } from 'react';
import type { backend } from '@/desktop/models';

export type FileEntry = backend.FileEntry;
export type LoadError = 'permission_denied' | 'no_device' | 'unknown' | null;
export type CreatingType = 'file' | 'folder' | null;
export type SortField = 'name' | 'size' | 'date' | 'type';
export type SortDir = 'asc' | 'desc';

/** Every File Explorer callback. Identity-stable for the life of the view, so
 *  memoized children (rows above all) are never invalidated by state churn. */
export interface FileExplorerActions {
  cancelCreate: () => void;
  clearSelection: () => void;
  /** True when the leftover click after closing the row menu should be ignored. */
  consumeGhostClick: () => boolean;
  handleClearSearch: () => void;
  handleCollapseTree: () => void;
  handleCopy: (names: Iterable<string>) => void;
  handleCopyPath: (names: Iterable<string>) => void;
  handleCreateChange: (value: string) => void;
  handleCreateConfirm: () => Promise<void>;
  handleCut: (names: Iterable<string>) => void;
  handleDeleteFromSelection: () => void;
  handleExpandTree: () => void;
  /** History back — the previously visited directory, not the parent. */
  handleGoBack: () => void;
  /** History forward — undoes a `handleGoBack`. */
  handleGoForward: () => void;
  handleMoveToFolder: (destDir: string, names: Iterable<string>) => Promise<void>;
  /** One level up the current path. Unrelated to history. */
  handleNavigateUp: () => void;
  handleOpenInEditor: (file: FileEntry, target?: backend.DeviceEditorTarget) => Promise<void>;
  handlePaste: () => void;
  handlePathClick: () => void;
  handlePathEditCommit: () => void;
  handlePull: () => Promise<void>;
  handlePullItem: (file: FileEntry) => Promise<void>;
  handlePushFile: () => Promise<void>;
  handlePushFileToDir: (targetDir: string) => Promise<void>;
  handlePushFolder: () => Promise<void>;
  handleRefreshClick: () => void;
  handleRenameCancel: () => void;
  handleRenameChange: (value: string) => void;
  handleRenameConfirm: () => Promise<void>;
  handleRootAccessToggle: () => Promise<void>;
  handleRowClick: (file: FileEntry, event: MouseEvent | KeyboardEvent) => void;
  handleRowDoubleClick: (file: FileEntry) => void;
  handleSelectAll: () => void;
  handleSelectFromMenu: (name: string) => void;
  handleSortColumn: (field: SortField) => void;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  openDeleteDialog: (names: string[]) => void;
  setEditPathValue: (value: string) => void;
  setIsEditingPath: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  startCreate: (type: 'file' | 'folder') => void;
  startCreateFile: () => void;
  startCreateFolder: () => void;
  startRename: (entry: FileEntry) => void;
  stopPathEditing: () => void;
  toggleCheckbox: (name: string) => void;
}

/** Directory content and how it is presented. */
export interface FileExplorerListing {
  currentPath: string;
  fileList: FileEntry[];
  loadError: LoadError;
  phantomOffset: number;
  searchQuery: string;
  sortDir: SortDir;
  sortField: SortField;
  visibleList: FileEntry[];
}

/** Inline rename / create editor state. */
export interface FileExplorerEditing {
  createError: string;
  createName: string;
  creatingType: CreatingType;
  renameError: string;
  renameValue: string;
  renamingName: string | null;
}

export interface FileExplorerSelection {
  allSelected: boolean;
  isMultiSelectMode: boolean;
  selectedNames: Set<string>;
  singleSelected: FileEntry | null;
  someSelected: boolean;
}

export interface FileExplorerNavigation {
  canGoBack: boolean;
  canGoForward: boolean;
}

/** In-flight flags plus the path editor value. */
export interface FileExplorerStatus {
  editPathValue: string;
  /**
   * Read from `useDeviceStore` up front, so "no device" is a state the view
   * knows before it calls anything — not something inferred afterwards from the
   * wording of a failed `ListFiles`.
   */
  hasDevice: boolean;
  isBusy: boolean;
  isCreating: boolean;
  isEditingPath: boolean;
  isLoading: boolean;
  isPullDisabled: boolean;
  isPushing: boolean;
  pasteEnabled: boolean;
}
