import path from 'path-browserify';
import { useCallback, useEffect, useRef } from 'react';
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
  // Latest-options ref keeps these handlers identity-stable across renders so
  // the memoized row list and toolbar are not invalidated by navigation state.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const handleRowDoubleClick = useCallback((file: FileEntry) => {
    const { currentPath, loadFiles, renamingName } = optionsRef.current;
    if (renamingName) {
      return;
    }
    if (file.type === 'Directory' || file.type === 'Symlink') {
      void loadFiles(path.posix.join(currentPath, file.name) + '/');
    }
  }, []);

  /**
   * Go **up** one directory. Named `handleBackClick` previously, which read as
   * history-back and was wired to the toolbar's up-arrow — the behaviour was
   * right, the name was not.
   */
  const handleNavigateUp = useCallback(() => {
    const { currentPath, loadFiles } = optionsRef.current;
    if (currentPath === '/') {
      return;
    }
    void loadFiles(path.posix.join(currentPath, '..') + '/');
  }, []);

  const handlePathClick = useCallback(() => {
    const { currentPath, setEditPathValue, setIsEditingPath } = optionsRef.current;
    setEditPathValue(currentPath);
    setIsEditingPath(true);
  }, []);

  const handleRefreshClick = useCallback(() => {
    const { currentPath, loadFiles } = optionsRef.current;
    void loadFiles(currentPath, false);
  }, []);

  const handleClearSearch = useCallback(() => {
    optionsRef.current.setSearchQuery('');
  }, []);

  const handleDeleteFromSelection = useCallback(() => {
    const { openDeleteDialog, selectedNames } = optionsRef.current;
    openDeleteDialog(Array.from(selectedNames));
  }, []);

  return {
    handleClearSearch,
    handleDeleteFromSelection,
    handleNavigateUp,
    handlePathClick,
    handleRefreshClick,
    handleRowDoubleClick,
  };
}
