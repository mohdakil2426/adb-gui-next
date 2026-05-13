import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Copy,
  Download,
  File,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  Link,
  Loader2,
  Lock,
  MonitorOff,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  RefreshCw,
  Search,
  SquareCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import path from 'path-browserify';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DirectoryTree } from '@/components/DirectoryTree';
import { SelectionSummaryBar } from '@/components/SelectionSummaryBar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { debugLog } from '@/lib/debug';
import { useDeviceStore } from '@/lib/deviceStore';
import { handleError } from '@/lib/errorHandler';
import { useLogStore } from '@/lib/logStore';
import { cn, formatBytes } from '@/lib/utils';
import {
  CreateDirectory,
  CreateFile,
  DeleteFiles,
  ListFiles,
  PullFile,
  PushFile,
  RenameFile,
  SelectDirectoryForPull,
  SelectDirectoryToPush,
  SelectFileToPush,
  SelectSaveDirectory,
} from '../../lib/desktop/backend';
import type { backend } from '../../lib/desktop/models';

type FileEntry = backend.FileEntry;
type LoadError = 'permission_denied' | 'no_device' | 'unknown' | null;
type CreatingType = 'file' | 'folder' | null;
type SortField = 'name' | 'size' | 'date';
type SortDir = 'asc' | 'desc';

const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = 420;
const DEFAULT_LEFT_WIDTH = 180;
const FORBIDDEN_CHARS = /[/\\:*?"<>|]/;
const RESERVED_NAMES = /^\.{1,2}$/;
const MAX_HISTORY = 50;
const RESPONSIVE_COLLAPSE_WIDTH = 1024;
const PHANTOM_ROW_HEIGHT = 40;

function ToolbarTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Sort a file list by field + direction, always keeping dirs before files. */
function sortEntries(entries: FileEntry[], field: SortField, dir: SortDir): FileEntry[] {
  return [...entries].sort((a, b) => {
    const aIsDir = a.type === 'Directory' || a.type === 'Symlink';
    const bIsDir = b.type === 'Directory' || b.type === 'Symlink';
    // Directories always float to the top regardless of sort
    if (aIsDir && !bIsDir) {
      return -1;
    }
    if (!aIsDir && bIsDir) {
      return 1;
    }

    if (field === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return dir === 'asc' ? cmp : -cmp;
    }
    if (field === 'size') {
      // Compare as integers; non-numeric sizes fall back to lexical
      const aNum = Number.parseInt(a.size, 10);
      const bNum = Number.parseInt(b.size, 10);
      const cmp = isNaN(aNum) || isNaN(bNum) ? a.size.localeCompare(b.size) : aNum - bNum;
      return dir === 'asc' ? cmp : -cmp;
    }
    // date: 'YYYY-MM-DD HH:MM' is lexically sortable
    const cmp = (a.date + a.time).localeCompare(b.date + b.time);
    return dir === 'asc' ? cmp : -cmp;
  });
}

function categorizeError(err: unknown): LoadError {
  const msg = String(err).toLowerCase();
  if (msg.includes('permission denied')) {
    return 'permission_denied';
  }
  if (
    msg.includes('no devices') ||
    msg.includes('device not found') ||
    msg.includes('no device') ||
    msg.includes('adb: error') ||
    msg.includes('unable to locate')
  ) {
    return 'no_device';
  }
  return 'unknown';
}

export function ViewFileExplorer({ activeView }: { activeView: string }) {
  // ── Navigation ──────────────────────────────────────────────────────────
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState(
    () => localStorage.getItem('fe.currentPath') ?? '/sdcard/',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  // Controls whether the checkbox column is rendered at all.
  // Activated by Ctrl+Click, Ctrl+A, or right-click → Select. Cleared on Escape/Clear.
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // ── Sort ─────────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem('fe.sortField');
    return (saved as SortField) || 'name';
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    const saved = localStorage.getItem('fe.sortDir');
    return (saved as SortDir) || 'asc';
  });

  // Persist sort to localStorage
  useEffect(() => {
    localStorage.setItem('fe.sortField', sortField);
  }, [sortField]);

  useEffect(() => {
    localStorage.setItem('fe.sortDir', sortDir);
  }, [sortDir]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // ── Navigation history ───────────────────────────────────────────────────
  const [navHistory, setNavHistory] = useState<string[]>(() => [
    localStorage.getItem('fe.currentPath') ?? '/sdcard/',
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  // Ref mirrors historyIndex so loadFiles can read it without closing over it.
  // This prevents loadFiles from needing historyIndex in its useCallback deps,
  // which would cause an infinite render loop.
  const historyIndexRef = useRef(0);
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < navHistory.length - 1;

  // ── Inline rename ────────────────────────────────────────────────────────
  const [renamingName, setRenamingName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // ── Delete ───────────────────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Create (new file / new folder) ──────────────────────────────────────
  const [creatingType, setCreatingType] = useState<CreatingType>(null);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const phantomOffset = creatingType === null ? 0 : PHANTOM_ROW_HEIGHT;

  // ── Transfer (push/pull) ─────────────────────────────────────────────────
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  // ── Layout ───────────────────────────────────────────────────────────────
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
  // Tracks whether the tree was auto-collapsed by responsive resize (not by user).
  // When true, expanding the window past the threshold will auto-restore the tree.
  const wasResponsiveCollapsedRef = useRef(false);
  // Request sequencing — incremented on each loadFiles call; stale responses are dropped.
  const loadRequestIdRef = useRef(0);
  const fileListRef = useRef<FileEntry[]>([]);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    fileListRef.current = fileList;
  }, [fileList]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedList = fileList.filter((f) => selectedNames.has(f.name));
  const singleSelected = selectedList.length === 1 ? selectedList[0] : null;
  const allSelected = fileList.length > 0 && selectedNames.size === fileList.length;
  const someSelected = selectedNames.size > 0 && !allSelected;
  const isBusy = isLoading || isPushing || isPulling || isDeleting || isRenaming || isCreating;
  const isPullDisabled = isPulling || !singleSelected;

  // Filtered + sorted list shown in the table
  const visibleList = useMemo(
    () =>
      sortEntries(
        searchQuery
          ? fileList.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
          : fileList,
        sortField,
        sortDir,
      ),
    [fileList, searchQuery, sortField, sortDir],
  );

  const rowVirtualizer = useVirtualizer({
    count: visibleList.length,
    getScrollElement: () => tableContainerRef.current?.parentElement ?? null,
    estimateSize: () => 40,
    overscan: 10,
  });

  // ── Tree toggle ──────────────────────────────────────────────────────────
  const toggleTree = useCallback((collapsed: boolean) => {
    wasResponsiveCollapsedRef.current = false; // user took manual control
    setIsTreeCollapsed(collapsed);
    localStorage.setItem('fe.treeCollapsed', String(collapsed));
  }, []);

  // ── Resize ───────────────────────────────────────────────────────────────
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);
  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);
  const resize = useCallback(
    (e: MouseEvent) => {
      if (!(isResizing && containerRef.current)) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      setLeftWidth(Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, e.clientX - rect.left)));
    },
    [isResizing],
  );

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // ── Responsive tree collapse on window resize ───────────────────────────
  // Auto-collapses tree when window width ≤ RESPONSIVE_COLLAPSE_WIDTH,
  // auto-restores when window grows past the threshold — only if the collapse
  // was triggered by resize (not by the user's manual toggle).
  useEffect(() => {
    let prevWasSmall = window.innerWidth <= RESPONSIVE_COLLAPSE_WIDTH;

    // Initial check: if window is already small on mount, auto-collapse
    if (prevWasSmall && localStorage.getItem('fe.treeCollapsed') !== 'true') {
      wasResponsiveCollapsedRef.current = true;
      setIsTreeCollapsed(true);
    }

    const onWindowResize = () => {
      const isSmall = window.innerWidth <= RESPONSIVE_COLLAPSE_WIDTH;

      // Only act on threshold crossings, not every resize pixel
      if (isSmall && !prevWasSmall) {
        // Window just shrank below threshold → auto-collapse
        wasResponsiveCollapsedRef.current = true;
        setIsTreeCollapsed(true);
      } else if (!isSmall && prevWasSmall && wasResponsiveCollapsedRef.current) {
        // Window just grew above threshold and we were the ones who collapsed it → restore
        wasResponsiveCollapsedRef.current = false;
        setIsTreeCollapsed(false);
      }

      prevWasSmall = isSmall;
    };

    window.addEventListener('resize', onWindowResize);
    return () => {
      window.removeEventListener('resize', onWindowResize);
    };
  }, []);

  // ── Load files ───────────────────────────────────────────────────────────
  // `pushToHistory` = true for user navigation, false for refresh-in-place.
  const loadFiles = useCallback(
    async (targetPath: string, pushToHistory = true) => {
      const requestId = ++loadRequestIdRef.current;
      setIsLoading(true);
      setSelectedNames(new Set());
      setIsMultiSelectMode(false);
      setRenamingName(null);
      setSearchQuery('');
      // Reset create state on every navigation
      setCreatingType(null);
      setCreateName('');
      setCreateError('');
      try {
        debugLog(`Listing files at: ${targetPath}`);
        const files = await ListFiles(targetPath, selectedSerialRef.current);
        // Discard stale results — a newer request has already been dispatched.
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        // Raw sort only for initial load; table may re-sort via sortField/sortDir
        const sorted = [...files].sort((a, b) => {
          const aIsDir = a.type === 'Directory' || a.type === 'Symlink';
          const bIsDir = b.type === 'Directory' || b.type === 'Symlink';
          if (aIsDir && !bIsDir) {
            return -1;
          }
          if (!aIsDir && bIsDir) {
            return 1;
          }
          return a.name.localeCompare(b.name);
        });
        setFileList(sorted);
        setLoadError(null);
        setCurrentPath(targetPath);
        currentPathRef.current = targetPath;
        localStorage.setItem('fe.currentPath', targetPath);
        setTreeRefreshKey((k) => k + 1);
        if (pushToHistory) {
          // Read from ref — never from stale closure — to avoid infinite re-renders
          const currentIdx = historyIndexRef.current;
          setNavHistory((prev) => {
            const truncated = prev.slice(0, currentIdx + 1);
            // Skip push if same path as current head
            if (truncated[truncated.length - 1] === targetPath) {
              return truncated;
            }
            const next = [...truncated, targetPath];
            // Enforce max history depth
            return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
          });
          const newIdx = Math.min(currentIdx + 1, MAX_HISTORY - 1);
          historyIndexRef.current = newIdx; // update ref synchronously
          setHistoryIndex(newIdx); // schedule React state update
        }
      } catch (error) {
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        setLoadError(categorizeError(error));
        setFileList([]);
        handleError('List Files', error);
        setCurrentPath(targetPath);
        currentPathRef.current = targetPath;
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [], // stable — all mutable values accessed via refs, not closure
  );

  useEffect(() => {
    selectedSerialRef.current = selectedSerial;
    setFileList([]);
    setSelectedNames(new Set());
    setIsMultiSelectMode(false);
    if (activeView === 'files' && selectedSerial) {
      void loadFiles(currentPathRef.current, false);
    }
  }, [activeView, selectedSerial, loadFiles]);

  const handleGoBack = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx <= 0) {
      return;
    }
    const newIndex = currentIdx - 1;
    // Update ref immediately so the load reads the correct index
    historyIndexRef.current = newIndex;
    setHistoryIndex(newIndex);
    setNavHistory((prev) => {
      const targetPath = prev[newIndex];
      if (targetPath) {
        void loadFiles(targetPath, false);
      }
      return prev;
    });
  }, [loadFiles]);

  const handleGoForward = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    setNavHistory((prev) => {
      if (currentIdx >= prev.length - 1) {
        return prev;
      }
      const newIndex = currentIdx + 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      const targetPath = prev[newIndex];
      if (targetPath) {
        void loadFiles(targetPath, false);
      }
      return prev;
    });
  }, [loadFiles]);

  const handleSortColumn = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDir('asc');
      }
      return field;
    });
  }, []);

  // ── Selection handlers ───────────────────────────────────────────────────
  const handleRowClick = useCallback(
    (file: FileEntry, e: React.MouseEvent | React.KeyboardEvent) => {
      if (renamingName) {
        return;
      }
      // Plain click does NOT select — only Ctrl+Click enters multi-select mode.
      if (e.ctrlKey || e.metaKey) {
        setIsMultiSelectMode(true);
        setSelectedNames((prev) => {
          const next = new Set(prev);
          if (next.has(file.name)) {
            next.delete(file.name);
          } else {
            next.add(file.name);
          }
          // Auto-exit if nothing left selected
          if (next.size === 0) {
            setIsMultiSelectMode(false);
          }
          return next;
        });
      }
      // No else: plain click does nothing to selection state
    },
    [renamingName],
  );

  const handleRowDoubleClick = useCallback(
    (file: FileEntry) => {
      if (renamingName) {
        return;
      }
      if (file.type === 'Directory' || file.type === 'Symlink') {
        void loadFiles(path.posix.join(currentPath, file.name) + '/');
      }
    },
    [renamingName, currentPath, loadFiles],
  );

  const toggleCheckbox = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      // Auto-exit multi-select mode when all checkboxes cleared
      if (next.size === 0) {
        setIsMultiSelectMode(false);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedNames(new Set());
      setIsMultiSelectMode(false); // exit mode when deselecting all
    } else {
      setSelectedNames(new Set(fileList.map((f) => f.name)));
    }
  }, [allSelected, fileList]);

  const clearSelection = useCallback(() => {
    setSelectedNames(new Set());
    setIsMultiSelectMode(false);
  }, []);

  // Activated from right-click → Select: adds item to selection and enters multi-select mode.
  const handleSelectFromMenu = useCallback((name: string) => {
    setIsMultiSelectMode(true);
    setSelectedNames((prev) => {
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);

  // ── Inline rename ────────────────────────────────────────────────────────
  const startRename = useCallback((file: FileEntry) => {
    // Cancel any active creation before renaming
    setCreatingType(null);
    setCreateName('');
    setCreateError('');
    setSelectedNames(new Set([file.name]));
    setRenamingName(file.name);
    setRenameValue(file.name);
    setRenameError('');
  }, []);

  const handleRenameChange = useCallback((val: string) => {
    setRenameValue(val);
    if (!val.trim()) {
      setRenameError('Name cannot be empty');
      return;
    }
    if (FORBIDDEN_CHARS.test(val)) {
      setRenameError('Invalid characters: / \\ : * ? " < > |');
      return;
    }
    setRenameError('');
  }, []);

  const handleRenameConfirm = useCallback(async () => {
    if (!renamingName) {
      return;
    }
    const trimmed = renameValue.trim();
    // Cancel conditions: empty, same name, or has forbidden chars
    if (!trimmed || trimmed === renamingName || FORBIDDEN_CHARS.test(trimmed)) {
      setRenamingName(null);
      return;
    }
    setIsRenaming(true);
    const oldPath = path.posix.join(currentPath, renamingName);
    const newPath = path.posix.join(currentPath, trimmed);
    try {
      await RenameFile(oldPath, newPath, selectedSerialRef.current);
      toast.success(`Renamed to "${trimmed}"`);
      useLogStore.getState().addLog(`Renamed ${renamingName} → ${trimmed}`, 'success');
      setRenamingName(null);
      setSelectedNames(new Set([trimmed]));
      void loadFiles(currentPath);
    } catch (error) {
      handleError('Rename', error);
      setRenamingName(null);
    } finally {
      setIsRenaming(false);
    }
  }, [renamingName, renameValue, currentPath, loadFiles]);

  const handleRenameCancel = useCallback(() => {
    setRenamingName(null);
    setRenameError('');
  }, []);

  // ── Create ───────────────────────────────────────────────────────────────
  const startCreate = useCallback((type: 'file' | 'folder') => {
    // Cancel any active rename before creating
    setRenamingName(null);
    setRenameError('');
    setCreatingType(type);
    setCreateName('');
    setCreateError('');
  }, []);

  const cancelCreate = useCallback(() => {
    setCreatingType(null);
    setCreateName('');
    setCreateError('');
  }, []);

  const handleCreateChange = useCallback((val: string) => {
    setCreateName(val);
    if (!val.trim()) {
      setCreateError('Name cannot be empty');
      return;
    }
    if (FORBIDDEN_CHARS.test(val)) {
      setCreateError('Invalid characters: / \\ : * ? " < > |');
      return;
    }
    if (RESERVED_NAMES.test(val.trim())) {
      setCreateError('Reserved name: use a different name');
      return;
    }
    setCreateError('');
  }, []);

  const handleCreateConfirm = useCallback(async () => {
    if (!creatingType) {
      return;
    }
    const trimmed = createName.trim();
    if (!trimmed || createError) {
      return;
    }
    const fullPath = path.posix.join(currentPath, trimmed);
    setIsCreating(true);
    try {
      if (creatingType === 'file') {
        await CreateFile(fullPath, selectedSerialRef.current);
        toast.success(`Created file "${trimmed}"`);
        useLogStore.getState().addLog(`Created file: ${fullPath}`, 'success');
      } else {
        await CreateDirectory(fullPath, selectedSerialRef.current);
        toast.success(`Created folder "${trimmed}"`);
        useLogStore.getState().addLog(`Created folder: ${fullPath}`, 'success');
      }
      setCreatingType(null);
      void loadFiles(currentPath);
    } catch (error) {
      handleError(creatingType === 'file' ? 'Create File' : 'Create Folder', error);
    } finally {
      setIsCreating(false);
    }
  }, [creatingType, createName, createError, currentPath, loadFiles]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const openDeleteDialog = useCallback((names: string[]) => {
    setFilesToDelete(names);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = async () => {
    const names = filesToDelete;
    const paths = names.map((name) => path.posix.join(currentPath, name));
    setIsDeleting(true);
    try {
      await DeleteFiles(paths, selectedSerialRef.current);
      const label = names.length === 1 ? `"${names[0]}"` : `${names.length} items`;
      toast.success(`Deleted ${label}`);
      useLogStore.getState().addLog(`Deleted from ${currentPath}: ${names.join(', ')}`, 'success');
      setSelectedNames(new Set());
      void loadFiles(currentPath);
    } catch (error) {
      handleError('Delete', error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // ── Back navigation ──────────────────────────────────────────────────────
  const handleBackClick = useCallback(() => {
    if (currentPath === '/') {
      return;
    }
    void loadFiles(path.posix.join(currentPath, '..') + '/');
  }, [currentPath, loadFiles]);

  // ── Path editing ───────────────────────────────────────────────────────────
  const handlePathClick = useCallback(() => {
    setEditPathValue(currentPath);
    setIsEditingPath(true);
  }, [currentPath]);

  // ── Tree collapsed handlers ────────────────────────────────────────────────
  const handleCollapseTree = useCallback(() => {
    toggleTree(true);
  }, [toggleTree]);
  const handleExpandTree = useCallback(() => {
    toggleTree(false);
  }, [toggleTree]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefreshClick = useCallback(() => {
    void loadFiles(currentPath, false);
  }, [currentPath, loadFiles]);

  // ── Search ────────────────────────────────────────────────────────────────
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // ── Delete dialog ────────────────────────────────────────────────────────
  const handleDeleteFromSelection = useCallback(() => {
    openDeleteDialog(Array.from(selectedNames));
  }, [openDeleteDialog, selectedNames]);

  // Shared pull helper — used by toolbar (selection-based) and context-menu (direct)
  const executePull = useCallback(
    async (file: FileEntry) => {
      setIsPulling(true);
      let toastId: string | number = '';
      try {
        const remotePath = path.posix.join(currentPath, file.name);
        let localPath = '';
        if (file.type === 'Directory' || file.type === 'Symlink') {
          toast.info('Select a folder to save the directory into.');
          localPath = await SelectDirectoryForPull();
        } else {
          localPath = await SelectSaveDirectory(file.name);
        }
        if (!localPath) {
          return;
        }
        toastId = toast.loading(`Pulling ${file.name}…`, {
          description: `From: ${remotePath}`,
        });
        const output = await PullFile(remotePath, localPath, selectedSerialRef.current);
        toast.success('Export Complete', {
          description: `Saved to ${localPath}`,
          id: toastId,
        });
        useLogStore.getState().addLog(`Pulled ${file.name} to ${localPath}: ${output}`, 'success');
      } catch (error) {
        if (toastId) {
          toast.error('Export Failed', { id: toastId });
        }
        handleError('Export', error);
      } finally {
        setIsPulling(false);
      }
    },
    [currentPath],
  );

  // Shared push helper — used by all Import variants
  const executePush = useCallback(
    async (localPath: string, targetDir: string) => {
      setIsPushing(true);
      let toastId: string | number = '';
      try {
        const fileName = localPath.replace(/\\/g, '/').split('/').pop() ?? '';
        const remotePath = path.posix.join(targetDir, fileName);
        toastId = toast.loading(`Pushing ${fileName}…`, {
          description: `To: ${remotePath}`,
        });
        const output = await PushFile(localPath, remotePath, selectedSerialRef.current);
        toast.success('Import Complete', { description: output, id: toastId });
        useLogStore.getState().addLog(`Pushed ${fileName} to ${remotePath}: ${output}`, 'success');
        void loadFiles(currentPath, false);
      } catch (error) {
        if (toastId) {
          toast.error('Import Failed', { id: toastId });
        }
        handleError('Import', error);
      } finally {
        setIsPushing(false);
      }
    },
    [currentPath, loadFiles],
  );

  // ── Push ─────────────────────────────────────────────────────────────────
  const handlePushFile = async () => {
    setIsPushing(true);
    let toastId: string | number = '';
    try {
      const localPath = await SelectFileToPush();
      if (!localPath) {
        return;
      }
      const fileName = localPath.replace(/\\/g, '/').split('/').pop() ?? path.basename(localPath);
      const remotePath = path.posix.join(currentPath, fileName);
      debugLog(`Pushing file ${fileName} to ${remotePath}`);
      toastId = toast.loading(`Pushing ${fileName}…`, {
        description: `To: ${remotePath}`,
      });
      const output = await PushFile(localPath, remotePath, selectedSerialRef.current);
      toast.success('Import Complete', { description: output, id: toastId });
      useLogStore.getState().addLog(`Pushed ${fileName} to ${remotePath}: ${output}`, 'success');
      void loadFiles(currentPath, false);
    } catch (error) {
      if (toastId) {
        toast.error('Import Failed', { id: toastId });
      }
      handleError('Push File', error);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePushFolder = async () => {
    setIsPushing(true);
    let toastId: string | number = '';
    try {
      const localFolderPath = await SelectDirectoryToPush();
      if (!localFolderPath) {
        return;
      }
      const folderName =
        localFolderPath.replace(/\\/g, '/').split('/').pop() ?? path.basename(localFolderPath);
      debugLog(`Pushing folder ${folderName} to ${currentPath}`);
      toastId = toast.loading(`Pushing folder ${folderName}…`, {
        description: `To: ${currentPath}`,
      });
      const output = await PushFile(localFolderPath, currentPath, selectedSerialRef.current);
      toast.success('Import Complete', { description: output, id: toastId });
      useLogStore.getState().addLog(`Pushed folder ${folderName} to ${currentPath}`, 'success');
      void loadFiles(currentPath, false);
    } catch (error) {
      if (toastId) {
        toast.error('Import Failed', { id: toastId });
      }
      handleError('Push Folder', error);
    } finally {
      setIsPushing(false);
    }
  };

  // Toolbar pull (selection-based)
  const handlePull = async () => {
    if (!singleSelected) {
      toast.error('Select a single item to export.');
      return;
    }
    await executePull(singleSelected);
  };

  // Context-menu pull — exports the right-clicked item directly, no selection needed
  const handlePullItem = useCallback((file: FileEntry) => executePull(file), [executePull]);

  // Context-menu push — imports a file from the host into a specific target directory
  const handlePushFileToDir = useCallback(
    async (targetDir: string) => {
      const localPath = await SelectFileToPush();
      if (!localPath) {
        return;
      }
      await executePush(localPath, targetDir);
    },
    [executePush],
  );

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeView !== 'files') {
        return;
      }
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // New File: Ctrl+N / Cmd+N
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'n' && !isInput) {
        e.preventDefault();
        startCreate('file');
        return;
      }

      // New Folder: Ctrl+Shift+N / Cmd+Shift+N
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N' && !isInput) {
        e.preventDefault();
        startCreate('folder');
        return;
      }

      // Back: Alt+Left
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleGoBack();
        return;
      }

      // Forward: Alt+Right
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleGoForward();
        return;
      }

      // Search focus: Ctrl+F / Cmd+F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !isInput) {
        e.preventDefault();
        document.getElementById('fe-search-input')?.focus();
        return;
      }

      // Escape: cancel create → cancel rename → clear search → clear selection
      if (e.key === 'Escape') {
        if (creatingType) {
          cancelCreate();
        } else if (renamingName) {
          handleRenameCancel();
        } else if (searchQuery) {
          setSearchQuery('');
        } else if (!isInput && selectedNames.size > 0) {
          clearSelection();
        }
        return;
      }

      if (isInput) {
        return;
      }

      if (e.key === 'Delete' && selectedNames.size > 0) {
        e.preventDefault();
        openDeleteDialog(Array.from(selectedNames));
        return;
      }
      if (e.key === 'F2' && selectedNames.size === 1) {
        e.preventDefault();
        const name = Array.from(selectedNames)[0];
        const file = fileListRef.current.find((f) => f.name === name);
        if (file) {
          startRename(file);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setIsMultiSelectMode(true);
        setSelectedNames(new Set(fileListRef.current.map((f) => f.name)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [
    activeView,
    selectedNames,
    renamingName,
    creatingType,
    searchQuery,
    startRename,
    startCreate,
    cancelCreate,
    openDeleteDialog,
    handleRenameCancel,
    handleGoBack,
    handleGoForward,
    clearSelection,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-[calc(100svh-4rem)] overflow-hidden rounded-lg border border-border"
      ref={containerRef}
    >
      <h1 className="sr-only">File Explorer</h1>
      {/* Drag overlay — prevents text selection while resizing */}
      {isResizing ? <div className="fixed inset-0 z-50 cursor-col-resize select-none" /> : null}

      {/* Left: Directory tree */}
      {!isTreeCollapsed && (
        <div className="flex shrink-0 flex-col overflow-hidden" style={{ width: `${leftWidth}px` }}>
          <div className="flex h-10 shrink-0 items-center gap-2 border-border border-b bg-muted/30 px-3">
            <Layers className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 font-medium text-muted-foreground text-sm">Device</span>
            <ToolbarTooltip label="Collapse tree panel">
              <Button
                className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleCollapseTree}
                size="icon"
                variant="ghost"
              >
                <PanelLeftClose className="size-3.5" />
              </Button>
            </ToolbarTooltip>
          </div>
          <div className="flex-1 overflow-hidden">
            <DirectoryTree
              currentPath={currentPath}
              key={selectedSerial ?? 'no-device'}
              onNavigate={loadFiles}
              refreshTrigger={treeRefreshKey}
              serial={selectedSerial}
            />
          </div>
        </div>
      )}

      {/* Resize handle */}
      {!isTreeCollapsed && (
        <div
          className={cn(
            'w-px shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/60 active:bg-primary',
            isResizing && 'bg-primary',
          )}
          onMouseDown={startResizing}
        />
      )}

      {/* Right: File list pane */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-10 shrink-0 items-center gap-1 border-border border-b px-2">
          {/* Tree restore toggle */}
          {isTreeCollapsed ? (
            <>
              <ToolbarTooltip label="Show tree panel">
                <Button
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={handleExpandTree}
                  size="icon"
                  variant="ghost"
                >
                  <PanelLeft className="size-4" />
                </Button>
              </ToolbarTooltip>
              <Separator className="mx-0.5 h-4" orientation="vertical" />
            </>
          ) : null}

          {/* Back / Forward / Up + Address bar */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {/* Back */}
            <ToolbarTooltip label="Back (Alt+Left)">
              <Button
                className="size-7 shrink-0"
                disabled={!canGoBack || isBusy}
                onClick={handleGoBack}
                size="icon"
                variant="ghost"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
              </Button>
            </ToolbarTooltip>

            {/* Forward */}
            <ToolbarTooltip label="Forward (Alt+Right)">
              <Button
                className="size-7 shrink-0"
                disabled={!canGoForward || isBusy}
                onClick={handleGoForward}
                size="icon"
                variant="ghost"
              >
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Button>
            </ToolbarTooltip>

            {/* Up */}
            <ToolbarTooltip label="Go up">
              <Button
                className="size-7 shrink-0"
                disabled={currentPath === '/' || isBusy}
                onClick={handleBackClick}
                size="icon"
                variant="ghost"
              >
                <ArrowUp className="h-4 w-4 shrink-0" />
              </Button>
            </ToolbarTooltip>

            {isEditingPath ? (
              <div className="relative flex min-w-0 flex-1 items-center">
                <Folder className="pointer-events-none absolute left-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Input
                  autoFocus
                  className="h-7 min-w-0 flex-1 border-input pr-2 pl-6 font-mono text-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onBlur={() => {
                    setIsEditingPath(false);
                  }}
                  onChange={(e) => {
                    setEditPathValue(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const t = editPathValue.trim();
                      void loadFiles(t && !t.endsWith('/') ? `${t}/` : t || '/');
                      setIsEditingPath(false);
                    }
                    if (e.key === 'Escape') {
                      setIsEditingPath(false);
                    }
                  }}
                  value={editPathValue}
                />
              </div>
            ) : (
              <button
                className="min-w-0 flex-1 cursor-text truncate rounded-sm px-2 py-1 text-left font-mono text-muted-foreground text-xs transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={handlePathClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePathClick();
                  }
                }}
                title="Click to edit path"
              >
                {currentPath}
              </button>
            )}
          </div>

          <Separator className="mx-1 h-4 shrink-0" orientation="vertical" />

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Refresh */}
            <ToolbarTooltip label="Refresh (F5)">
              <Button
                className="size-7"
                disabled={isBusy}
                onClick={handleRefreshClick}
                size="icon"
                variant="ghost"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 shrink-0" />
                )}
              </Button>
            </ToolbarTooltip>

            <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />

            {/* Search */}
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Input
                aria-label="Filter files"
                className="h-7 w-32 pr-6 pl-6 text-xs transition-[width] duration-200 focus-visible:w-48"
                id="fe-search-input"
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                placeholder="Filter…"
                value={searchQuery}
              />
              {searchQuery ? (
                <button
                  aria-label="Clear filter"
                  className="absolute right-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleClearSearch}
                  tabIndex={-1}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />

            {/* New File */}
            <ToolbarTooltip label="New File (Ctrl+N)">
              <Button
                className="size-7"
                disabled={isBusy}
                onClick={() => {
                  startCreate('file');
                }}
                size="icon"
                variant="ghost"
              >
                <FilePlus2 className="h-4 w-4 shrink-0" />
              </Button>
            </ToolbarTooltip>

            {/* New Folder */}
            <ToolbarTooltip label="New Folder (Ctrl+Shift+N)">
              <Button
                className="size-7"
                disabled={isBusy}
                onClick={() => {
                  startCreate('folder');
                }}
                size="icon"
                variant="ghost"
              >
                <FolderPlus className="h-4 w-4 shrink-0" />
              </Button>
            </ToolbarTooltip>

            <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />

            {/* Split Import button */}
            <div className="flex items-stretch">
              <Button
                className="rounded-r-none border-r-0 pr-2"
                disabled={isBusy}
                onClick={handlePushFile}
                size="sm"
                variant="outline"
              >
                {isPushing ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline">Import</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="Import options"
                    className="rounded-l-none px-1.5"
                    disabled={isBusy}
                    size="sm"
                    variant="outline"
                  >
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handlePushFile}>
                    <File className="h-4 w-4 shrink-0" />
                    Import File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePushFolder}>
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    Import Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Export */}
            <Button
              disabled={isPullDisabled || isBusy}
              onClick={handlePull}
              size="sm"
              title={selectedNames.size > 1 ? 'Select a single item to export' : undefined}
              variant="outline"
            >
              {isPulling ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Download className="h-4 w-4 shrink-0" />
              )}
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Selection summary bar — only visible in multi-select mode */}
        {isMultiSelectMode && selectedNames.size > 0 && !renamingName ? (
          <SelectionSummaryBar
            actions={
              <Button
                className="h-6 px-2 text-xs"
                disabled={isBusy}
                onClick={handleDeleteFromSelection}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="h-3 w-3 shrink-0" />
                <span className="ml-1 hidden sm:inline">Delete</span>
              </Button>
            }
            count={selectedNames.size}
            disabled={isBusy}
            label={selectedNames.size === 1 ? 'item selected' : 'items selected'}
            onClear={clearSelection}
          />
        ) : null}

        {/* Visually hidden live region for screen reader selection announcements */}
        <div
          aria-atomic="true"
          aria-live="polite"
          className="pointer-events-none absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
        >
          {selectedNames.size > 0
            ? `${selectedNames.size} item${selectedNames.size > 1 ? 's' : ''} selected`
            : null}
        </div>

        {/* File table / states */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : loadError === 'permission_denied' ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Lock className="h-8 w-8 opacity-40" />
                  <p className="font-medium text-sm">Access Denied</p>
                  <p className="text-xs opacity-60">
                    This location requires elevated permissions or root access.
                  </p>
                </div>
              ) : loadError === 'no_device' ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <MonitorOff className="h-8 w-8 opacity-40" />
                  <p className="font-medium text-sm">No Device Connected</p>
                  <p className="text-xs opacity-60">
                    Connect a device via USB or wireless ADB and try again.
                  </p>
                </div>
              ) : loadError === 'unknown' ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 opacity-40" />
                  <p className="font-medium text-sm">Failed to Load</p>
                  <p className="text-xs opacity-60">Check the logs panel for details.</p>
                </div>
              ) : fileList.length === 0 && creatingType === null ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
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
                <div className="relative w-full" ref={tableContainerRef}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                      <TableRow>
                        {isMultiSelectMode ? (
                          <TableHead className="w-10 pl-3">
                            <Checkbox
                              aria-label="Select all"
                              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                              disabled={isBusy}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                        ) : null}
                        <TableHead className="w-10" />
                        {/* Clickable sort headers */}
                        {(['name', 'size', 'date'] as const).map((field) => (
                          <TableHead
                            aria-sort={
                              sortField === field
                                ? sortDir === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                            className="cursor-pointer select-none capitalize hover:text-foreground"
                            key={field}
                            onClick={() => {
                              handleSortColumn(field);
                            }}
                            role="columnheader"
                          >
                            <span className="inline-flex items-center gap-1">
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
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody
                      style={{
                        position: 'relative',
                        height: `${rowVirtualizer.getTotalSize() + phantomOffset}px`,
                      }}
                    >
                      {/* Phantom row — inline creation of new file or folder */}
                      {creatingType !== null && (
                        <TableRow
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: PHANTOM_ROW_HEIGHT,
                          }}
                        >
                          {isMultiSelectMode ? <TableCell className="w-10 pr-0 pl-3" /> : null}
                          <TableCell className="w-10 pr-0">
                            {creatingType === 'folder' ? (
                              <Folder className="h-4 w-4 shrink-0 text-primary" />
                            ) : (
                              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell colSpan={4}>
                            <div className="flex items-center gap-2">
                              <Input
                                aria-label={
                                  creatingType === 'folder' ? 'New folder name' : 'New file name'
                                }
                                autoFocus
                                className={cn(
                                  'h-7 max-w-xs px-1.5 py-0 font-mono text-sm',
                                  createError &&
                                    'border-destructive focus-visible:ring-destructive',
                                )}
                                disabled={isCreating}
                                onBlur={cancelCreate}
                                onChange={(e) => {
                                  handleCreateChange(e.target.value);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
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
                                placeholder={
                                  creatingType === 'folder' ? 'New folder name' : 'filename.ext'
                                }
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
                        // Search returned no results
                        <TableRow
                          style={{
                            position: 'absolute',
                            top: phantomOffset,
                            left: 0,
                            width: '100%',
                          }}
                        >
                          <TableCell
                            className="h-32 text-center text-muted-foreground text-sm"
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
                          <ContextMenu key={virtualRow.key}>
                            <ContextMenuTrigger asChild>
                              <TableRow
                                aria-posinset={virtualRow.index + 1}
                                aria-setsize={visibleList.length}
                                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                data-index={virtualRow.index}
                                data-state={isSelected ? 'selected' : ''}
                                onClick={(e) => {
                                  handleRowClick(file, e);
                                }}
                                onDoubleClick={() => {
                                  handleRowDoubleClick(file);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleRowClick(file, e);
                                  }
                                  if (e.key === 'ArrowRight' && isNavigable) {
                                    e.preventDefault();
                                    loadFiles(path.posix.join(currentPath, file.name) + '/');
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
                                }}
                                tabIndex={0}
                              >
                                {/* Checkbox cell — only rendered in multi-select mode, absent while renaming */}
                                {isMultiSelectMode && !isBeingRenamed ? (
                                  <TableCell
                                    className="w-10 pr-0 pl-3"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCheckbox(file.name);
                                    }}
                                  >
                                    <Checkbox
                                      aria-label={`Select ${file.name}`}
                                      checked={isSelected}
                                      tabIndex={-1}
                                    />
                                  </TableCell>
                                ) : null}

                                {/* Type icon */}
                                <TableCell className="w-10">
                                  {file.type === 'Directory' ? (
                                    <Folder className="h-4 w-4 shrink-0 text-primary" />
                                  ) : file.type === 'Symlink' ? (
                                    <Link className="h-4 w-4 shrink-0 text-primary/70" />
                                  ) : (
                                    <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  )}
                                </TableCell>

                                {/* Name cell — rename is F2 or right-click only */}
                                <TableCell className="font-medium">
                                  {isBeingRenamed ? (
                                    <div className="flex flex-col gap-0.5">
                                      <Input
                                        autoFocus
                                        className={cn(
                                          'h-7 w-full px-1.5 py-0 font-medium text-sm',
                                          renameError &&
                                            'border-destructive focus-visible:ring-destructive',
                                        )}
                                        onBlur={handleRenameCancel}
                                        onChange={(e) => {
                                          handleRenameChange(e.target.value);
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                        }}
                                        onFocus={(e) => {
                                          e.target.select();
                                        }}
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
                                        <span className="text-destructive text-xs leading-none">
                                          {renameError}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-0.5">
                                      <span>{file.name}</span>
                                      {file.type === 'Symlink' && file.linkTarget ? (
                                        <span className="font-mono text-[10px] text-muted-foreground/60 leading-none">
                                          → {file.linkTarget}
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                </TableCell>

                                <TableCell className="text-muted-foreground text-xs tabular-nums">
                                  {file.type === 'Directory' ? '—' : formatBytes(file.size)}
                                </TableCell>
                                <TableCell>{file.date}</TableCell>
                                <TableCell>{file.time}</TableCell>
                              </TableRow>
                            </ContextMenuTrigger>

                            {/* Right-click context menu */}
                            <ContextMenuContent>
                              {/* Select — enters multi-select mode and adds this item */}
                              <ContextMenuItem
                                onClick={() => {
                                  handleSelectFromMenu(file.name);
                                }}
                              >
                                <SquareCheck className="h-4 w-4 shrink-0" />
                                Select
                              </ContextMenuItem>

                              {/* Copy full path to clipboard */}
                              <ContextMenuItem
                                onClick={() =>
                                  void navigator.clipboard.writeText(
                                    path.posix.join(currentPath, file.name),
                                  )
                                }
                              >
                                <Copy className="h-4 w-4 shrink-0" />
                                Copy Path
                              </ContextMenuItem>

                              <ContextMenuSeparator />

                              {isNavigable ? (
                                <>
                                  <ContextMenuItem
                                    onClick={() =>
                                      loadFiles(path.posix.join(currentPath, file.name) + '/')
                                    }
                                  >
                                    <FolderOpen className="h-4 w-4 shrink-0" />
                                    Open
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                </>
                              ) : null}

                              <ContextMenuItem
                                disabled={
                                  (isSelected && selectedNames.size > 1) ||
                                  (!isSelected && selectedNames.size > 0)
                                }
                                onClick={() => {
                                  startRename(file);
                                }}
                              >
                                <Pencil className="h-4 w-4 shrink-0" />
                                Rename
                              </ContextMenuItem>

                              <ContextMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  const namesToDelete =
                                    isSelected && selectedNames.size > 0
                                      ? Array.from(selectedNames)
                                      : [file.name];
                                  openDeleteDialog(namesToDelete);
                                }}
                              >
                                <Trash2 className="h-4 w-4 shrink-0" />
                                {isSelected && selectedNames.size > 1
                                  ? `Delete ${selectedNames.size} items`
                                  : 'Delete'}
                              </ContextMenuItem>

                              <ContextMenuSeparator />

                              {/* Import — pushes a file from host into the right-clicked folder,
                                or into the current directory for files. */}
                              <ContextMenuItem
                                disabled={isBusy}
                                onClick={() =>
                                  handlePushFileToDir(
                                    isNavigable
                                      ? path.posix.join(currentPath, file.name) + '/'
                                      : currentPath,
                                  )
                                }
                              >
                                <Upload className="h-4 w-4 shrink-0" />
                                {isNavigable ? `Import into "${file.name}"` : 'Import File'}
                              </ContextMenuItem>

                              {/* Export — pulls this exact row's item, no selection needed */}
                              <ContextMenuItem
                                disabled={isBusy}
                                onClick={() => handlePullItem(file)}
                              >
                                <Download className="h-4 w-4 shrink-0" />
                                Export
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ScrollArea>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              disabled={isBusy}
              onClick={() => {
                startCreate('file');
              }}
            >
              <FilePlus2 className="h-4 w-4 shrink-0" />
              New File
              <span className="ml-auto pl-4 text-muted-foreground text-xs">Ctrl+N</span>
            </ContextMenuItem>
            <ContextMenuItem
              disabled={isBusy}
              onClick={() => {
                startCreate('folder');
              }}
            >
              <FolderPlus className="h-4 w-4 shrink-0" />
              New Folder
              <span className="ml-auto pl-4 text-muted-foreground text-xs">Ctrl+Shift+N</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* ── Delete confirmation dialog ─────────────────────────────────── */}
      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {filesToDelete.length === 1
                ? `Delete "${filesToDelete[0]}"?`
                : `Delete ${filesToDelete.length} items?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  {filesToDelete.length === 1
                    ? 'This item will be permanently deleted from the device. This action cannot be undone.'
                    : 'These items will be permanently deleted from the device. This action cannot be undone.'}
                </p>
                {filesToDelete.length > 1 && (
                  <ul className="mt-2 space-y-0.5 font-mono text-xs">
                    {filesToDelete.slice(0, 5).map((name) => {
                      const f = fileList.find((x) => x.name === name);
                      return (
                        <li className="flex items-center gap-1.5" key={name}>
                          {f?.type === 'Directory' ? (
                            <Folder className="h-3 w-3 shrink-0" />
                          ) : f?.type === 'Symlink' ? (
                            <Link className="h-3 w-3 shrink-0" />
                          ) : (
                            <File className="h-3 w-3 shrink-0" />
                          )}
                          {name}
                        </li>
                      );
                    })}
                    {filesToDelete.length > 5 && (
                      <li className="text-muted-foreground">
                        … and {filesToDelete.length - 5} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={isDeleting}
              onClick={handleConfirmDelete}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 shrink-0" />
              )}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
