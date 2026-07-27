import path from 'path-browserify';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { CreateDirectory, CreateFile, DeleteFiles, RenameFile } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import {
  FORBIDDEN_CHARS,
  RESERVED_NAMES,
} from '@/features/file-explorer/model/fileExplorerConstants';
import type { CreatingType } from '@/features/file-explorer/model/fileExplorerTypes';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';

interface Options {
  createError: string;
  createName: string;
  creatingType: CreatingType;
  currentPath: string;
  filesToDelete: string[];
  getFileAccessMode: (path: string) => backend.FileAccessMode;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  renameValue: string;
  renamingName: string | null;
  selectedSerialRef: React.RefObject<string | null>;
  setCreateError: (v: string) => void;
  setCreateName: (v: string) => void;
  setCreatingType: (v: CreatingType) => void;
  setDeleteDialogOpen: (v: boolean) => void;
  setFilesToDelete: (v: string[]) => void;
  setIsCreating: (v: boolean) => void;
  setIsDeleting: (v: boolean) => void;
  setIsRenaming: (v: boolean) => void;
  setRenameError: (v: string) => void;
  setRenameValue: (v: string) => void;
  setRenamingName: (v: string | null) => void;
  setSelectedNames: (v: Set<string>) => void;
}

export function useFileExplorerMutations(options: Options) {
  // Latest-options ref. The options object is a fresh literal on every render;
  // reading it at call time (instead of closing over it) keeps every callback
  // below identity-stable, which is what lets the row list stay memoized.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const startCreate = useCallback((type: 'file' | 'folder') => {
    const o = optionsRef.current;
    o.setRenamingName(null);
    o.setRenameError('');
    o.setCreatingType(type);
    o.setCreateName('');
    o.setCreateError('');
  }, []);
  const cancelCreate = useCallback(() => {
    const o = optionsRef.current;
    o.setCreatingType(null);
    o.setCreateName('');
    o.setCreateError('');
  }, []);
  const handleCreateChange = useCallback((val: string) => {
    const o = optionsRef.current;
    o.setCreateName(val);
    if (!val.trim()) {
      return o.setCreateError('Name cannot be empty');
    }
    if (FORBIDDEN_CHARS.test(val)) {
      return o.setCreateError('Invalid characters: / \\ : * ? " < > |');
    }
    if (RESERVED_NAMES.test(val.trim())) {
      return o.setCreateError('Reserved name: use a different name');
    }
    o.setCreateError('');
  }, []);
  const handleCreateConfirm = useCallback(async () => {
    const o = optionsRef.current;
    if (!o.creatingType) {
      return;
    }
    const trimmed = o.createName.trim();
    if (!trimmed || o.createError) {
      return;
    }
    const serial = o.selectedSerialRef.current;
    const basePath = o.currentPath;
    const fullPath = path.posix.join(basePath, trimmed);
    o.setIsCreating(true);
    try {
      const accessMode = o.getFileAccessMode(fullPath);
      if (o.creatingType === 'file') {
        await CreateFile(fullPath, serial, accessMode);
      } else {
        await CreateDirectory(fullPath, serial, accessMode);
      }
      o.setCreatingType(null);
      void o.loadFiles(basePath, false);
    } catch (e) {
      handleError(o.creatingType === 'file' ? 'Create File' : 'Create Folder', e);
    } finally {
      o.setIsCreating(false);
    }
  }, []);
  const startRename = useCallback((name: string) => {
    const o = optionsRef.current;
    o.setCreatingType(null);
    o.setCreateName('');
    o.setCreateError('');
    o.setSelectedNames(new Set([name]));
    o.setRenamingName(name);
    o.setRenameValue(name);
    o.setRenameError('');
  }, []);
  const handleRenameChange = useCallback((val: string) => {
    const o = optionsRef.current;
    o.setRenameValue(val);
    if (!val.trim()) {
      return o.setRenameError('Name cannot be empty');
    }
    if (FORBIDDEN_CHARS.test(val)) {
      return o.setRenameError('Invalid characters: / \\ : * ? " < > |');
    }
    o.setRenameError('');
  }, []);
  const handleRenameCancel = useCallback(() => {
    const o = optionsRef.current;
    o.setRenamingName(null);
    o.setRenameError('');
  }, []);
  const handleRenameConfirm = useCallback(async () => {
    const o = optionsRef.current;
    if (!o.renamingName) {
      return;
    }
    const trimmed = o.renameValue.trim();
    if (!trimmed || trimmed === o.renamingName || FORBIDDEN_CHARS.test(trimmed)) {
      o.setRenamingName(null);
      return;
    }
    const serial = o.selectedSerialRef.current;
    const basePath = o.currentPath;
    const renamingName = o.renamingName;
    o.setIsRenaming(true);
    try {
      const oldPath = path.posix.join(basePath, renamingName);
      const newPath = path.posix.join(basePath, trimmed);
      await RenameFile(oldPath, newPath, serial, o.getFileAccessMode(oldPath));
      toast.success(`Renamed to "${trimmed}"`);
      useLogStore.getState().addLog(`Renamed ${renamingName} → ${trimmed}`, 'success');
      o.setRenamingName(null);
      o.setSelectedNames(new Set([trimmed]));
      void o.loadFiles(basePath, false);
    } catch (e) {
      handleError('Rename', e);
      o.setRenamingName(null);
    } finally {
      o.setIsRenaming(false);
    }
  }, []);
  const openDeleteDialog = useCallback((names: string[]) => {
    const o = optionsRef.current;
    o.setFilesToDelete(names);
    o.setDeleteDialogOpen(true);
  }, []);
  const handleConfirmDelete = useCallback(async () => {
    const o = optionsRef.current;
    // Snapshot serial + path at action start (before any async work)
    const serial = o.selectedSerialRef.current;
    const basePath = o.currentPath;
    const paths = o.filesToDelete.map((name) => path.posix.join(basePath, name));
    o.setIsDeleting(true);
    try {
      await DeleteFiles(paths, serial, o.getFileAccessMode(basePath));
      o.setSelectedNames(new Set());
      void o.loadFiles(basePath, false);
    } catch (e) {
      handleError('Delete', e);
    } finally {
      o.setIsDeleting(false);
      o.setDeleteDialogOpen(false);
    }
  }, []);
  return {
    cancelCreate,
    handleConfirmDelete,
    handleCreateChange,
    handleCreateConfirm,
    handleRenameCancel,
    handleRenameChange,
    handleRenameConfirm,
    openDeleteDialog,
    startCreate,
    startRename,
  };
}
