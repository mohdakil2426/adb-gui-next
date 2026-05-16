import { useCallback } from 'react';
import { ListFiles } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { MAX_HISTORY } from '@/features/file-explorer/model/fileExplorerConstants';
import type { FileEntry, LoadError } from '@/features/file-explorer/model/fileExplorerTypes';
import { debugLog } from '@/shared/utils/debug';
import { handleError } from '@/shared/utils/errorHandler';

interface Options {
  categorizeError: (err: unknown) => LoadError;
  currentPathRef: React.RefObject<string>;
  getFileAccessMode: (path: string) => backend.FileAccessMode;
  historyIndexRef: React.RefObject<number>;
  loadRequestIdRef: React.RefObject<number>;
  navHistoryRef: React.RefObject<string[]>;
  selectedSerialRef: React.RefObject<string | null>;
  setCreateError: (v: string) => void;
  setCreateName: (v: string) => void;
  setCreatingType: (v: null) => void;
  setCurrentPath: (v: string) => void;
  setFileList: (v: FileEntry[]) => void;
  setHistoryIndex: (v: number) => void;
  setIsLoading: (v: boolean) => void;
  setIsMultiSelectMode: (v: boolean) => void;
  setLoadError: (v: LoadError) => void;
  setNavHistory: (v: string[]) => void;
  setRenamingName: (v: string | null) => void;
  setSearchQuery: (v: string) => void;
  setSelectedNames: (v: Set<string>) => void;
  setTreeRefreshKey: (v: number) => void;
  treeRefreshKeyRef: React.RefObject<number>;
}

export function useFileExplorerLoader(options: Options) {
  const {
    categorizeError,
    currentPathRef,
    getFileAccessMode,
    historyIndexRef,
    loadRequestIdRef,
    navHistoryRef,
    selectedSerialRef,
    setCreateError,
    setCreateName,
    setCreatingType,
    setCurrentPath,
    setFileList,
    setHistoryIndex,
    setIsLoading,
    setIsMultiSelectMode,
    setLoadError,
    setNavHistory,
    setRenamingName,
    setSearchQuery,
    setSelectedNames,
    setTreeRefreshKey,
    treeRefreshKeyRef,
  } = options;

  const loadFiles = useCallback(
    async (targetPath: string, pushToHistory = true) => {
      const nextRequestId = (loadRequestIdRef.current ?? 0) + 1;
      loadRequestIdRef.current = nextRequestId;
      const requestId = nextRequestId;
      setIsLoading(true);
      setSelectedNames(new Set());
      setIsMultiSelectMode(false);
      setRenamingName(null);
      setSearchQuery('');
      setCreatingType(null);
      setCreateName('');
      setCreateError('');
      try {
        debugLog(`Listing files at: ${targetPath}`);
        const files = await ListFiles(
          targetPath,
          selectedSerialRef.current,
          getFileAccessMode(targetPath),
        );
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
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
        setTreeRefreshKey(treeRefreshKeyRef.current + 1);
        if (pushToHistory) {
          const currentIdx = historyIndexRef.current ?? 0;
          const prev = navHistoryRef.current;
          const truncated = prev.slice(0, currentIdx + 1);
          const next =
            truncated[truncated.length - 1] === targetPath ? truncated : [...truncated, targetPath];
          setNavHistory(next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next);
          const newIdx = Math.min(currentIdx + 1, MAX_HISTORY - 1);
          historyIndexRef.current = newIdx;
          setHistoryIndex(newIdx);
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
    [
      categorizeError,
      currentPathRef,
      getFileAccessMode,
      historyIndexRef,
      loadRequestIdRef,
      navHistoryRef,
      selectedSerialRef,
      setCreateError,
      setCreateName,
      setCreatingType,
      setCurrentPath,
      setFileList,
      setHistoryIndex,
      setIsLoading,
      setIsMultiSelectMode,
      setLoadError,
      setNavHistory,
      setRenamingName,
      setSearchQuery,
      setSelectedNames,
      setTreeRefreshKey,
      treeRefreshKeyRef,
    ],
  );

  const handleGoBack = useCallback(() => {
    const currentIdx = historyIndexRef.current ?? 0;
    if (currentIdx <= 0) {
      return;
    }
    const newIndex = currentIdx - 1;
    historyIndexRef.current = newIndex;
    setHistoryIndex(newIndex);
    const targetPath = navHistoryRef.current[newIndex];
    if (targetPath) {
      void loadFiles(targetPath, false);
    }
  }, [historyIndexRef, loadFiles, navHistoryRef, setHistoryIndex]);

  const handleGoForward = useCallback(() => {
    const currentIdx = historyIndexRef.current ?? 0;
    const history = navHistoryRef.current;
    if (currentIdx >= history.length - 1) {
      return;
    }
    const newIndex = currentIdx + 1;
    historyIndexRef.current = newIndex;
    setHistoryIndex(newIndex);
    const targetPath = history[newIndex];
    if (targetPath) {
      void loadFiles(targetPath, false);
    }
  }, [historyIndexRef, loadFiles, navHistoryRef, setHistoryIndex]);

  return { handleGoBack, handleGoForward, loadFiles };
}
