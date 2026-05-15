import path from 'path-browserify';
import { useCallback } from 'react';
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

export function useFileExplorerMutations(o: Options) {
  const startCreate = useCallback(
    (type: 'file' | 'folder') => {
      o.setRenamingName(null);
      o.setRenameError('');
      o.setCreatingType(type);
      o.setCreateName('');
      o.setCreateError('');
    },
    [o],
  );
  const cancelCreate = useCallback(() => {
    o.setCreatingType(null);
    o.setCreateName('');
    o.setCreateError('');
  }, [o]);
  const handleCreateChange = useCallback(
    (val: string) => {
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
    },
    [o],
  );
  const handleCreateConfirm = useCallback(async () => {
    if (!o.creatingType) {
      return;
    }
    const trimmed = o.createName.trim();
    if (!trimmed || o.createError) {
      return;
    }
    const fullPath = path.posix.join(o.currentPath, trimmed);
    o.setIsCreating(true);
    try {
      const accessMode = o.getFileAccessMode(fullPath);
      if (o.creatingType === 'file') {
        await CreateFile(fullPath, o.selectedSerialRef.current, accessMode);
      } else {
        await CreateDirectory(fullPath, o.selectedSerialRef.current, accessMode);
      }
      o.setCreatingType(null);
      void o.loadFiles(o.currentPath);
    } catch (e) {
      handleError(o.creatingType === 'file' ? 'Create File' : 'Create Folder', e);
    } finally {
      o.setIsCreating(false);
    }
  }, [o]);
  const startRename = useCallback(
    (name: string) => {
      o.setCreatingType(null);
      o.setCreateName('');
      o.setCreateError('');
      o.setSelectedNames(new Set([name]));
      o.setRenamingName(name);
      o.setRenameValue(name);
      o.setRenameError('');
    },
    [o],
  );
  const handleRenameChange = useCallback(
    (val: string) => {
      o.setRenameValue(val);
      if (!val.trim()) {
        return o.setRenameError('Name cannot be empty');
      }
      if (FORBIDDEN_CHARS.test(val)) {
        return o.setRenameError('Invalid characters: / \\ : * ? " < > |');
      }
      o.setRenameError('');
    },
    [o],
  );
  const handleRenameCancel = useCallback(() => {
    o.setRenamingName(null);
    o.setRenameError('');
  }, [o]);
  const handleRenameConfirm = useCallback(async () => {
    if (!o.renamingName) {
      return;
    }
    const trimmed = o.renameValue.trim();
    if (!trimmed || trimmed === o.renamingName || FORBIDDEN_CHARS.test(trimmed)) {
      o.setRenamingName(null);
      return;
    }
    o.setIsRenaming(true);
    try {
      const oldPath = path.posix.join(o.currentPath, o.renamingName);
      const newPath = path.posix.join(o.currentPath, trimmed);
      await RenameFile(oldPath, newPath, o.selectedSerialRef.current, o.getFileAccessMode(oldPath));
      toast.success(`Renamed to "${trimmed}"`);
      useLogStore.getState().addLog(`Renamed ${o.renamingName} → ${trimmed}`, 'success');
      o.setRenamingName(null);
      o.setSelectedNames(new Set([trimmed]));
      void o.loadFiles(o.currentPath);
    } catch (e) {
      handleError('Rename', e);
      o.setRenamingName(null);
    } finally {
      o.setIsRenaming(false);
    }
  }, [o]);
  const openDeleteDialog = useCallback(
    (names: string[]) => {
      o.setFilesToDelete(names);
      o.setDeleteDialogOpen(true);
    },
    [o],
  );
  const handleConfirmDelete = useCallback(async () => {
    const paths = o.filesToDelete.map((name) => path.posix.join(o.currentPath, name));
    o.setIsDeleting(true);
    try {
      await DeleteFiles(paths, o.selectedSerialRef.current, o.getFileAccessMode(o.currentPath));
      o.setSelectedNames(new Set());
      void o.loadFiles(o.currentPath);
    } catch (e) {
      handleError('Delete', e);
    } finally {
      o.setIsDeleting(false);
      o.setDeleteDialogOpen(false);
    }
  }, [o]);
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
