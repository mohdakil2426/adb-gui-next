import { useEffect } from 'react';
import type { CreatingType, FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

interface Options {
  activeView: string;
  cancelCreate: () => void;
  clearSelection: () => void;
  creatingType: CreatingType;
  currentPathRef: React.RefObject<string>;
  fileListRef: React.RefObject<FileEntry[]>;
  handleCopy: (names: Iterable<string>) => void;
  handleCopyPath: (names: Iterable<string>) => void;
  handleCut: (names: Iterable<string>) => void;
  handleGoBack: () => void;
  handleGoForward: () => void;
  handleNavigateUp: () => void;
  handlePaste: () => void;
  handlePathClick: () => void;
  handleRenameCancel: () => void;
  handleRowDoubleClick: (file: FileEntry) => void;
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
  visibleList: FileEntry[];
}

function isTypingTarget(tag: string | undefined): boolean {
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

export function useFileExplorerKeyboardShortcuts(options: Options) {
  const {
    activeView,
    cancelCreate,
    clearSelection,
    creatingType,
    currentPathRef,
    fileListRef,
    handleCopy,
    handleCopyPath,
    handleCut,
    handleGoBack,
    handleGoForward,
    handleNavigateUp,
    handlePaste,
    handlePathClick,
    handleRenameCancel,
    handleRowDoubleClick,
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
    visibleList,
  } = options;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeView !== 'files') {
        return;
      }
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      const isInput = isTypingTarget(tag);
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey && e.key === 'n' && !isInput) {
        e.preventDefault();
        startCreate('file');
        return;
      }
      if (mod && e.shiftKey && e.key === 'N' && !isInput) {
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
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigateUp();
        return;
      }
      if ((mod && e.key === 'l') || (e.altKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        handlePathClick();
        return;
      }
      if (mod && e.key === 'f' && !isInput) {
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
      if (e.key === 'Backspace' && !mod) {
        e.preventDefault();
        handleNavigateUp();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        void handleCopyPath(selectedNames);
        return;
      }
      if (mod && !e.shiftKey && e.key === 'c') {
        e.preventDefault();
        handleCopy(selectedNames);
        return;
      }
      if (mod && e.key === 'x') {
        e.preventDefault();
        handleCut(selectedNames);
        return;
      }
      if (mod && e.key === 'v') {
        e.preventDefault();
        handlePaste();
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
        const file = (fileListRef.current ?? []).find((entry) => entry.name === name);
        if (file) {
          startRename(file);
        }
        return;
      }
      if (e.key === 'Enter' && selectedNames.size === 1) {
        e.preventDefault();
        const name = Array.from(selectedNames)[0];
        const file = visibleList.find((entry) => entry.name === name);
        if (file) {
          handleRowDoubleClick(file);
        }
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        const first = visibleList[0];
        if (!first) {
          return;
        }
        if (e.shiftKey) {
          setIsMultiSelectMode(true);
          setSelectedNames(new Set(visibleList.map((entry) => entry.name).slice(0, 1)));
          return;
        }
        setSelectedNames(new Set([first.name]));
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        const last = visibleList[visibleList.length - 1];
        if (!last) {
          return;
        }
        setSelectedNames(new Set([last.name]));
        return;
      }
      if (e.key === 'F10' && e.shiftKey) {
        e.preventDefault();
        const focused = document.activeElement;
        if (focused instanceof HTMLElement) {
          focused.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
        }
        return;
      }
      if (mod && e.key === 'a') {
        e.preventDefault();
        setIsMultiSelectMode(true);
        setSelectedNames(new Set((fileListRef.current ?? []).map((entry) => entry.name)));
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
    handleCopy,
    handleCopyPath,
    handleCut,
    handleGoBack,
    handleGoForward,
    handleNavigateUp,
    handlePaste,
    handlePathClick,
    handleRenameCancel,
    handleRowDoubleClick,
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
    visibleList,
  ]);
}
