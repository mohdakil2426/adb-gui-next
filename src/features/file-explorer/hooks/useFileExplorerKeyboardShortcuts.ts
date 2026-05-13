import { useEffect } from 'react';
import type { CreatingType, FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

interface Options {
  activeView: string;
  cancelCreate: () => void;
  clearSelection: () => void;
  creatingType: CreatingType;
  currentPathRef: React.RefObject<string>;
  fileListRef: React.RefObject<FileEntry[]>;
  handleGoBack: () => void;
  handleGoForward: () => void;
  handleRenameCancel: () => void;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  openDeleteDialog: (names: string[]) => void;
  renamingName: string | null;
  searchQuery: string;
  selectedNames: Set<string>;
  setIsMultiSelectMode: (enabled: boolean) => void;
  setSearchQuery: (q: string) => void;
  setSelectedNames: (next: Set<string>) => void;
  startCreate: (type: 'file' | 'folder') => void;
  startRename: (entry: FileEntry) => void;
}

export function useFileExplorerKeyboardShortcuts(options: Options) {
  const {
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
  } = options;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeView !== 'files') {
        return;
      }
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'n' && !isInput) {
        e.preventDefault();
        startCreate('file');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N' && !isInput) {
        e.preventDefault();
        startCreate('folder');
        return;
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleGoBack();
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleGoForward();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !isInput) {
        e.preventDefault();
        document.getElementById('fe-search-input')?.focus();
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        void loadFiles(currentPathRef.current ?? '/sdcard/', false);
        return;
      }
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
        const file = (fileListRef.current ?? []).find((f) => f.name === name);
        if (file) {
          startRename(file);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setIsMultiSelectMode(true);
        setSelectedNames(new Set((fileListRef.current ?? []).map((f) => f.name)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
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
  ]);
}
