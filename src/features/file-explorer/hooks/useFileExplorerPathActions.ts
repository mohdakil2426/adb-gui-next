import path from 'path-browserify';
import { useCallback } from 'react';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

interface UseFileExplorerPathActionsOptions {
  currentPath: string;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  openDeleteDialog: (names: string[]) => void;
  renamingName: string | null;
  selectedNames: Set<string>;
  setEditPathValue: (value: string) => void;
  setIsEditingPath: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
}

export function useFileExplorerPathActions(options: UseFileExplorerPathActionsOptions) {
  const {
    currentPath,
    loadFiles,
    openDeleteDialog,
    renamingName,
    selectedNames,
    setEditPathValue,
    setIsEditingPath,
    setSearchQuery,
  } = options;

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

  const handleBackClick = useCallback(() => {
    if (currentPath === '/') {
      return;
    }
    void loadFiles(path.posix.join(currentPath, '..') + '/');
  }, [currentPath, loadFiles]);

  const handlePathClick = useCallback(() => {
    setEditPathValue(currentPath);
    setIsEditingPath(true);
  }, [currentPath, setEditPathValue, setIsEditingPath]);

  const handleRefreshClick = useCallback(() => {
    void loadFiles(currentPath, false);
  }, [currentPath, loadFiles]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const handleDeleteFromSelection = useCallback(() => {
    openDeleteDialog(Array.from(selectedNames));
  }, [openDeleteDialog, selectedNames]);

  return {
    handleBackClick,
    handleClearSearch,
    handleDeleteFromSelection,
    handlePathClick,
    handleRefreshClick,
    handleRowDoubleClick,
  };
}
