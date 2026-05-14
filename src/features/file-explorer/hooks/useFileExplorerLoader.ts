import { useCallback } from 'react';
import { ListFiles } from '@/desktop/backend';
import { MAX_HISTORY } from '@/features/file-explorer/model/fileExplorerConstants';
import type { FileEntry, LoadError } from '@/features/file-explorer/model/fileExplorerTypes';
import { debugLog } from '@/shared/utils/debug';
import { handleError } from '@/shared/utils/errorHandler';

interface Options {
  categorizeError: (err: unknown) => LoadError;
  currentPathRef: React.RefObject<string>;
  historyIndexRef: React.RefObject<number>;
  loadRequestIdRef: React.RefObject<number>;
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
  setNavHistory: (updater: (prev: string[]) => string[]) => void;
  setRenamingName: (v: string | null) => void;
  setSearchQuery: (v: string) => void;
  setSelectedNames: (v: Set<string>) => void;
  setTreeRefreshKey: (updater: (k: number) => number) => void;
}

export function useFileExplorerLoader(options: Options) {
  const {
    categorizeError,
    currentPathRef,
    historyIndexRef,
    loadRequestIdRef,
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
        const files = await ListFiles(targetPath, selectedSerialRef.current);
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
        setTreeRefreshKey((k) => k + 1);
        if (pushToHistory) {
          const currentIdx = historyIndexRef.current ?? 0;
          setNavHistory((prev) => {
            const truncated = prev.slice(0, currentIdx + 1);
            if (truncated[truncated.length - 1] === targetPath) {
              return truncated;
            }
            const next = [...truncated, targetPath];
            return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
          });
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
      historyIndexRef,
      loadRequestIdRef,
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
    setNavHistory((prev) => {
      const targetPath = prev[newIndex];
      if (targetPath) {
        void loadFiles(targetPath, false);
      }
      return prev;
    });
  }, [historyIndexRef, loadFiles, setHistoryIndex, setNavHistory]);

  const handleGoForward = useCallback(() => {
    const currentIdx = historyIndexRef.current ?? 0;
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
  }, [historyIndexRef, loadFiles, setHistoryIndex, setNavHistory]);

  return { handleGoBack, handleGoForward, loadFiles };
}
