import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLogStore } from '@/lib/logStore';
import { handleError } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import path from 'path-browserify';

import {
  ListFiles,
  PushFile,
  PullFile,
  SelectFileToPush,
  SelectSaveDirectory,
  SelectDirectoryForPull,
  SelectDirectoryToPush,
  DeleteFiles,
  RenameFile,
  CreateFile,
  CreateDirectory,
} from '../../lib/desktop/backend';
import type { backend } from '../../lib/desktop/models';

import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import { SelectionSummaryBar } from '@/components/SelectionSummaryBar';
import { DirectoryTree } from '@/components/DirectoryTree';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2,
  RefreshCw,
  Upload,
  Download,
  Folder,
  FolderOpen,
  File,
  Link,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Layers,
  Lock,
  MonitorOff,
  AlertCircle,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Pencil,
  SquareCheck,
  FilePlus2,
  FolderPlus,
  Copy,
  Search,
  X,
} from 'lucide-react';

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

/** Format raw byte count string into human-readable size. */
function formatBytes(raw: string): string {
  const n = parseInt(raw, 10);
  if (isNaN(n) || raw === '') return raw;
  if (n === 0) return '0 B';
  if (n < 1_024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1_024).toFixed(1)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${(n / 1_073_741_824).toFixed(1)} GB`;
}

/** Sort a file list by field + direction, always keeping dirs before files. */
function sortEntries(entries: FileEntry[], field: SortField, dir: SortDir): FileEntry[] {
  return [...entries].sort((a, b) => {
    const aIsDir = a.type === 'Directory' || a.type === 'Symlink';
    const bIsDir = b.type === 'Directory' || b.type === 'Symlink';
    // Directories always float to the top regardless of sort
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;

    if (field === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return dir === 'asc' ? cmp : -cmp;
    }
    if (field === 'size') {
      // Compare as integers; non-numeric sizes fall back to lexical
      const aNum = parseInt(a.size, 10);
      const bNum = parseInt(b.size, 10);
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
  if (msg.includes('permission denied')) return 'permission_denied';
  if (
    msg.includes('no devices') ||
    msg.includes('device not found') ||
    msg.includes('no device') ||
    msg.includes('adb: error') ||
    msg.includes('unable to locate')
  )
    return 'no_device';
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
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Search ───────────────────────────────────────────────────────────────
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

  const containerRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(localStorage.getItem('fe.currentPath') ?? '/sdcard/');
  // Tracks whether the tree was auto-collapsed by responsive resize (not by user).
  // When true, expanding the window past the threshold will auto-restore the tree.
  const wasResponsiveCollapsedRef = useRef(false);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedList = fileList.filter((f) => selectedNames.has(f.name));
  const singleSelected = selectedList.length === 1 ? selectedList[0] : null;
  const allSelected = fileList.length > 0 && selectedNames.size === fileList.length;
  const someSelected = selectedNames.size > 0 && !allSelected;
  const isBusy = isLoading || isPushing || isPulling || isDeleting || isRenaming || isCreating;
  const isPullDisabled = isPulling || !singleSelected;

  // Filtered + sorted list shown in the table
  const visibleList = sortEntries(
    searchQuery
      ? fileList.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : fileList,
    sortField,
    sortDir,
  );

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
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
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
    return () => window.removeEventListener('resize', onWindowResize);
  }, []);

  // ── Load files ───────────────────────────────────────────────────────────
  // `pushToHistory` = true for user navigation, false for refresh-in-place.
  const loadFiles = useCallback(
    async (targetPath: string, pushToHistory = true) => {
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
        const files = await ListFiles(targetPath);
        // Raw sort only for initial load; table may re-sort via sortField/sortDir
        files.sort((a, b) => {
          const aIsDir = a.type === 'Directory' || a.type === 'Symlink';
          const bIsDir = b.type === 'Directory' || b.type === 'Symlink';
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a.name.localeCompare(b.name);
        });
        setFileList(files);
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
            if (truncated[truncated.length - 1] === targetPath) return truncated;
            const next = [...truncated, targetPath];
            // Enforce max history depth
            return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
          });
          const newIdx = Math.min(currentIdx + 1, MAX_HISTORY - 1);
          historyIndexRef.current = newIdx; // update ref synchronously
          setHistoryIndex(newIdx); // schedule React state update
        }
      } catch (error) {
        setLoadError(categorizeError(error));
        setFileList([]);
        handleError('List Files', error);
        setCurrentPath(targetPath);
        currentPathRef.current = targetPath;
      } finally {
        setIsLoading(false);
      }
    },
    [], // stable — all mutable values accessed via refs, not closure
  );

  useEffect(() => {
    if (activeView === 'files') loadFiles(currentPathRef.current);
  }, [activeView, loadFiles]);

  const handleGoBack = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    if (currentIdx <= 0) return;
    const newIndex = currentIdx - 1;
    // Update ref immediately so the load reads the correct index
    historyIndexRef.current = newIndex;
    setHistoryIndex(newIndex);
    setNavHistory((prev) => {
      const targetPath = prev[newIndex];
      if (targetPath) void loadFiles(targetPath, false);
      return prev;
    });
  }, [loadFiles]);

  const handleGoForward = useCallback(() => {
    const currentIdx = historyIndexRef.current;
    setNavHistory((prev) => {
      if (currentIdx >= prev.length - 1) return prev;
      const newIndex = currentIdx + 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      const targetPath = prev[newIndex];
      if (targetPath) void loadFiles(targetPath, false);
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
    (file: FileEntry, e: React.MouseEvent) => {
      if (renamingName) return;
      // Plain click does NOT select — only Ctrl+Click enters multi-select mode.
      if (e.ctrlKey || e.metaKey) {
        setIsMultiSelectMode(true);
        setSelectedNames((prev) => {
          const next = new Set(prev);
          if (next.has(file.name)) next.delete(file.name);
          else next.add(file.name);
          // Auto-exit if nothing left selected
          if (next.size === 0) setIsMultiSelectMode(false);
          return next;
        });
      }
      // No else: plain click does nothing to selection state
    },
    [renamingName],
  );

  const handleRowDoubleClick = useCallback(
    (file: FileEntry) => {
      if (renamingName) return;
      if (file.type === 'Directory' || file.type === 'Symlink') {
        loadFiles(path.posix.join(currentPath, file.name) + '/');
      }
    },
    [renamingName, currentPath, loadFiles],
  );

  const toggleCheckbox = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      // Auto-exit multi-select mode when all checkboxes cleared
      if (next.size === 0) setIsMultiSelectMode(false);
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

  const handleRenameChange = (val: string) => {
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
  };

  const handleRenameConfirm = useCallback(async () => {
    if (!renamingName) return;
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
      await RenameFile(oldPath, newPath);
      toast.success(`Renamed to "${trimmed}"`);
      useLogStore.getState().addLog(`Renamed ${renamingName} → ${trimmed}`, 'success');
      setRenamingName(null);
      setSelectedNames(new Set([trimmed]));
      loadFiles(currentPath);
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
    if (!creatingType) return;
    const trimmed = createName.trim();
    if (!trimmed || createError) return;
    const fullPath = path.posix.join(currentPath, trimmed);
    setIsCreating(true);
    try {
      if (creatingType === 'file') {
        await CreateFile(fullPath);
        toast.success(`Created file "${trimmed}"`);
        useLogStore.getState().addLog(`Created file: ${fullPath}`, 'success');
      } else {
        await CreateDirectory(fullPath);
        toast.success(`Created folder "${trimmed}"`);
        useLogStore.getState().addLog(`Created folder: ${fullPath}`, 'success');
      }
      setCreatingType(null);
      loadFiles(currentPath);
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
      await DeleteFiles(paths);
      const label = names.length === 1 ? `"${names[0]}"` : `${names.length} items`;
      toast.success(`Deleted ${label}`);
      useLogStore.getState().addLog(`Deleted from ${currentPath}: ${names.join(', ')}`, 'success');
      setSelectedNames(new Set());
      loadFiles(currentPath);
    } catch (error) {
      handleError('Delete', error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // ── Back navigation ──────────────────────────────────────────────────────
  const handleBackClick = () => {
    if (currentPath === '/') return;
    loadFiles(path.posix.join(currentPath, '..') + '/');
  };

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
        if (!localPath) return;
        toastId = toast.loading(`Pulling ${file.name}…`, { description: `From: ${remotePath}` });
        const output = await PullFile(remotePath, localPath);
        toast.success('Export Complete', { description: `Saved to ${localPath}`, id: toastId });
        useLogStore.getState().addLog(`Pulled ${file.name} to ${localPath}: ${output}`, 'success');
      } catch (error) {
        if (toastId) toast.error('Export Failed', { id: toastId });
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
        toastId = toast.loading(`Pushing ${fileName}…`, { description: `To: ${remotePath}` });
        const output = await PushFile(localPath, remotePath);
        toast.success('Import Complete', { description: output, id: toastId });
        useLogStore.getState().addLog(`Pushed ${fileName} to ${remotePath}: ${output}`, 'success');
        loadFiles(currentPath, false);
      } catch (error) {
        if (toastId) toast.error('Import Failed', { id: toastId });
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
      if (!localPath) return;
      const fileName = localPath.replace(/\\/g, '/').split('/').pop() || path.basename(localPath);
      const remotePath = path.posix.join(currentPath, fileName);
      debugLog(`Pushing file ${fileName} to ${remotePath}`);
      toastId = toast.loading(`Pushing ${fileName}…`, { description: `To: ${remotePath}` });
      const output = await PushFile(localPath, remotePath);
      toast.success('Import Complete', { description: output, id: toastId });
      useLogStore.getState().addLog(`Pushed ${fileName} to ${remotePath}: ${output}`, 'success');
      loadFiles(currentPath, false);
    } catch (error) {
      if (toastId) toast.error('Import Failed', { id: toastId });
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
      if (!localFolderPath) return;
      const folderName =
        localFolderPath.replace(/\\/g, '/').split('/').pop() || path.basename(localFolderPath);
      debugLog(`Pushing folder ${folderName} to ${currentPath}`);
      toastId = toast.loading(`Pushing folder ${folderName}…`, {
        description: `To: ${currentPath}`,
      });
      const output = await PushFile(localFolderPath, currentPath);
      toast.success('Import Complete', { description: output, id: toastId });
      useLogStore.getState().addLog(`Pushed folder ${folderName} to ${currentPath}`, 'success');
      loadFiles(currentPath, false);
    } catch (error) {
      if (toastId) toast.error('Import Failed', { id: toastId });
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
      if (!localPath) return;
      await executePush(localPath, targetDir);
    },
    [executePush],
  );

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeView !== 'files') return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // New File: Ctrl+N / Cmd+N
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'n') {
        if (!isInput) {
          e.preventDefault();
          startCreate('file');
          return;
        }
      }

      // New Folder: Ctrl+Shift+N / Cmd+Shift+N
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        if (!isInput) {
          e.preventDefault();
          startCreate('folder');
          return;
        }
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (!isInput) {
          e.preventDefault();
          document.getElementById('fe-search-input')?.focus();
          return;
        }
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

      if (isInput) return;

      if (e.key === 'Delete' && selectedNames.size > 0) {
        e.preventDefault();
        openDeleteDialog(Array.from(selectedNames));
        return;
      }
      if (e.key === 'F2' && selectedNames.size === 1) {
        e.preventDefault();
        const name = Array.from(selectedNames)[0];
        const file = fileList.find((f) => f.name === name);
        if (file) startRename(file);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setIsMultiSelectMode(true);
        setSelectedNames(new Set(fileList.map((f) => f.name)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activeView,
    selectedNames,
    renamingName,
    creatingType,
    searchQuery,
    fileList,
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
      ref={containerRef}
      className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-border"
    >
      {/* Drag overlay — prevents text selection while resizing */}
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize select-none" />}

      {/* Left: Directory tree */}
      {!isTreeCollapsed && (
        <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: `${leftWidth}px` }}>
          <div className="flex items-center gap-2 px-3 h-10 border-b border-border shrink-0 bg-muted/30">
            <Layers className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-muted-foreground flex-1">Device</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => toggleTree(true)}
              title="Collapse tree panel"
            >
              <PanelLeftClose className="size-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <DirectoryTree
              currentPath={currentPath}
              onNavigate={loadFiles}
              refreshTrigger={treeRefreshKey}
            />
          </div>
        </div>
      )}

      {/* Resize handle */}
      {!isTreeCollapsed && (
        <div
          className={cn(
            'w-px shrink-0 cursor-col-resize transition-colors bg-border hover:bg-primary/60 active:bg-primary',
            isResizing && 'bg-primary',
          )}
          onMouseDown={startResizing}
        />
      )}

      {/* Right: File list pane */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 h-10 border-b border-border shrink-0">
          {/* Tree restore toggle */}
          {isTreeCollapsed && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => toggleTree(false)}
                title="Show tree panel"
              >
                <PanelLeft className="size-4" />
              </Button>
              <Separator orientation="vertical" className="h-4 mx-0.5" />
            </>
          )}

          {/* Back / Forward / Up + Address bar */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {/* Back */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={handleGoBack}
              disabled={!canGoBack || isBusy}
              title="Back (Alt+←)"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
            </Button>

            {/* Forward */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={handleGoForward}
              disabled={!canGoForward || isBusy}
              title="Forward (Alt+→)"
            >
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Button>

            {/* Up */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={handleBackClick}
              disabled={currentPath === '/' || isBusy}
              title="Go up"
            >
              <ArrowUp className="h-4 w-4 shrink-0" />
            </Button>

            {isEditingPath ? (
              <Input
                value={editPathValue}
                onChange={(e) => setEditPathValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const t = editPathValue.trim();
                    loadFiles(t && !t.endsWith('/') ? `${t}/` : t || '/');
                    setIsEditingPath(false);
                  }
                  if (e.key === 'Escape') setIsEditingPath(false);
                }}
                onBlur={() => setIsEditingPath(false)}
                className="font-mono text-xs h-7 flex-1 min-w-0 focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
              />
            ) : (
              <button
                className="flex-1 min-w-0 text-left font-mono text-xs truncate text-muted-foreground hover:text-foreground cursor-text px-2 py-1 rounded-sm hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setEditPathValue(currentPath);
                  setIsEditingPath(true);
                }}
                title="Click to edit path"
              >
                {currentPath}
              </button>
            )}
          </div>

          <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => loadFiles(currentPath, false)}
              disabled={isBusy}
              title="Refresh (F5)"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <RefreshCw className="h-4 w-4 shrink-0" />
              )}
            </Button>

            <Separator orientation="vertical" className="h-4 mx-0.5 shrink-0" />

            {/* Search */}
            <div className="relative flex items-center">
              <Search className="absolute left-1.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none shrink-0" />
              <Input
                id="fe-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter…"
                className="h-7 pl-6 pr-6 text-xs w-32 focus-visible:w-48 transition-[width] duration-200"
                aria-label="Filter files"
              />
              {searchQuery && (
                <button
                  className="absolute right-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear filter"
                  tabIndex={-1}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <Separator orientation="vertical" className="h-4 mx-0.5 shrink-0" />

            {/* New File */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => startCreate('file')}
              disabled={isBusy}
              title="New File (Ctrl+N)"
            >
              <FilePlus2 className="h-4 w-4 shrink-0" />
            </Button>

            {/* New Folder */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => startCreate('folder')}
              disabled={isBusy}
              title="New Folder (Ctrl+Shift+N)"
            >
              <FolderPlus className="h-4 w-4 shrink-0" />
            </Button>

            <Separator orientation="vertical" className="h-4 mx-0.5 shrink-0" />

            {/* Split Import button */}
            <div className="flex items-stretch">
              <Button
                variant="outline"
                size="sm"
                className="rounded-r-none border-r-0 pr-2"
                onClick={handlePushFile}
                disabled={isBusy}
              >
                {isPushing ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Upload className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline">Import</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-l-none px-1.5"
                    disabled={isBusy}
                    aria-label="Import options"
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
              variant="outline"
              size="sm"
              onClick={handlePull}
              disabled={isPullDisabled || isBusy}
              title={selectedNames.size > 1 ? 'Select a single item to export' : undefined}
            >
              {isPulling ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Download className="h-4 w-4 shrink-0" />
              )}
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Selection summary bar — only visible in multi-select mode */}
        {isMultiSelectMode && selectedNames.size > 0 && !renamingName && (
          <SelectionSummaryBar
            count={selectedNames.size}
            label={selectedNames.size === 1 ? 'item selected' : 'items selected'}
            onClear={clearSelection}
            disabled={isBusy}
            actions={
              <Button
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => openDeleteDialog(Array.from(selectedNames))}
                disabled={isBusy}
              >
                <Trash2 className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline ml-1">Delete</span>
              </Button>
            }
          />
        )}

        {/* File table / states */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : loadError === 'permission_denied' ? (
                <div className="flex flex-col h-40 items-center justify-center gap-2 text-muted-foreground">
                  <Lock className="h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">Access Denied</p>
                  <p className="text-xs opacity-60">
                    This location requires elevated permissions or root access.
                  </p>
                </div>
              ) : loadError === 'no_device' ? (
                <div className="flex flex-col h-40 items-center justify-center gap-2 text-muted-foreground">
                  <MonitorOff className="h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">No Device Connected</p>
                  <p className="text-xs opacity-60">
                    Connect a device via USB or wireless ADB and try again.
                  </p>
                </div>
              ) : loadError === 'unknown' ? (
                <div className="flex flex-col h-40 items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">Failed to Load</p>
                  <p className="text-xs opacity-60">Check the logs panel for details.</p>
                </div>
              ) : fileList.length === 0 && creatingType === null ? (
                <div className="flex flex-col h-40 items-center justify-center gap-3 text-muted-foreground">
                  <p className="text-sm">This directory is empty.</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => startCreate('file')}
                      disabled={isBusy}
                    >
                      <FilePlus2 className="h-3.5 w-3.5" />
                      New File
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => startCreate('folder')}
                      disabled={isBusy}
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                      New Folder
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                    <TableRow>
                      {isMultiSelectMode && (
                        <TableHead className="w-10 pl-3">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all"
                            disabled={isBusy}
                          />
                        </TableHead>
                      )}
                      <TableHead className="w-10" />
                      {/* Clickable sort headers */}
                      {(['name', 'size', 'date'] as const).map((field) => (
                        <TableHead
                          key={field}
                          className="cursor-pointer select-none hover:text-foreground capitalize"
                          onClick={() => handleSortColumn(field)}
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
                  <TableBody>
                    {/* Phantom row — inline creation of new file or folder */}
                    {creatingType !== null && (
                      <TableRow>
                        {isMultiSelectMode && <TableCell className="pl-3 pr-0 w-10" />}
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
                              value={createName}
                              onChange={(e) => handleCreateChange(e.target.value)}
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
                              onBlur={cancelCreate}
                              onClick={(e) => e.stopPropagation()}
                              placeholder={
                                creatingType === 'folder' ? 'New folder name' : 'filename.ext'
                              }
                              className={cn(
                                'h-7 py-0 px-1.5 text-sm font-mono max-w-xs',
                                createError && 'border-destructive focus-visible:ring-destructive',
                              )}
                              aria-label={
                                creatingType === 'folder' ? 'New folder name' : 'New file name'
                              }
                              autoFocus
                              disabled={isCreating}
                            />
                            {createError && (
                              <span className="text-xs text-destructive leading-none shrink-0">
                                {createError}
                              </span>
                            )}
                            {isCreating && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {fileList.length > 0 && visibleList.length === 0 ? (
                      // Search returned no results
                      <TableRow>
                        <TableCell
                          colSpan={isMultiSelectMode ? 6 : 5}
                          className="h-32 text-center text-sm text-muted-foreground"
                        >
                          No files match &ldquo;{searchQuery}&rdquo;
                        </TableCell>
                      </TableRow>
                    ) : null}

                    {visibleList.map((file) => {
                      const isSelected = selectedNames.has(file.name);
                      const isBeingRenamed = renamingName === file.name;
                      const isNavigable = file.type === 'Directory' || file.type === 'Symlink';

                      return (
                        <ContextMenu key={file.name}>
                          <ContextMenuTrigger asChild>
                            <TableRow
                              data-state={isSelected ? 'selected' : ''}
                              onClick={(e) => handleRowClick(file, e)}
                              onDoubleClick={() => handleRowDoubleClick(file)}
                              className="cursor-pointer"
                            >
                              {/* Checkbox cell — only rendered in multi-select mode, absent while renaming */}
                              {isMultiSelectMode && !isBeingRenamed && (
                                <TableCell
                                  className="pl-3 pr-0 w-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCheckbox(file.name);
                                  }}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    aria-label={`Select ${file.name}`}
                                    tabIndex={-1}
                                  />
                                </TableCell>
                              )}

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
                                      value={renameValue}
                                      onChange={(e) => handleRenameChange(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleRenameConfirm();
                                        }
                                        if (e.key === 'Escape') {
                                          e.preventDefault();
                                          handleRenameCancel();
                                        }
                                      }}
                                      onBlur={handleRenameCancel}
                                      onClick={(e) => e.stopPropagation()}
                                      className={cn(
                                        'h-7 py-0 px-1.5 font-medium text-sm w-full',
                                        renameError &&
                                          'border-destructive focus-visible:ring-destructive',
                                      )}
                                      autoFocus
                                      onFocus={(e) => e.target.select()}
                                    />
                                    {renameError && (
                                      <span className="text-xs text-destructive leading-none">
                                        {renameError}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <span>{file.name}</span>
                                    {file.type === 'Symlink' && file.linkTarget && (
                                      <span className="text-[10px] font-mono text-muted-foreground/60 leading-none">
                                        → {file.linkTarget}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </TableCell>

                              <TableCell className="tabular-nums text-muted-foreground text-xs">
                                {file.type === 'Directory' ? '—' : formatBytes(file.size)}
                              </TableCell>
                              <TableCell>{file.date}</TableCell>
                              <TableCell>{file.time}</TableCell>
                            </TableRow>
                          </ContextMenuTrigger>

                          {/* Right-click context menu */}
                          <ContextMenuContent>
                            {/* Select — enters multi-select mode and adds this item */}
                            <ContextMenuItem onClick={() => handleSelectFromMenu(file.name)}>
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

                            {isNavigable && (
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
                            )}

                            <ContextMenuItem
                              disabled={
                                (isSelected && selectedNames.size > 1) ||
                                (!isSelected && selectedNames.size > 0)
                              }
                              onClick={() => startRename(file)}
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
                            <ContextMenuItem disabled={isBusy} onClick={() => handlePullItem(file)}>
                              <Download className="h-4 w-4 shrink-0" />
                              Export
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => startCreate('file')} disabled={isBusy}>
              <FilePlus2 className="h-4 w-4 shrink-0" />
              New File
              <span className="ml-auto pl-4 text-xs text-muted-foreground">Ctrl+N</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => startCreate('folder')} disabled={isBusy}>
              <FolderPlus className="h-4 w-4 shrink-0" />
              New Folder
              <span className="ml-auto pl-4 text-xs text-muted-foreground">Ctrl+Shift+N</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* ── Delete confirmation dialog ─────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
                  <ul className="mt-2 space-y-0.5 text-xs font-mono">
                    {filesToDelete.slice(0, 5).map((name) => {
                      const f = fileList.find((x) => x.name === name);
                      return (
                        <li key={name} className="flex items-center gap-1.5">
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
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
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
