import { useCallback, useEffect } from 'react';
import { VerifyFileRootAccess } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';

export const ROOT_ACCESS_STORAGE_KEY = 'fe.rootAccessGranted';

const NORMAL_STORAGE_PREFIXES = ['/sdcard', '/storage', '/mnt'];

export const getStoredRootAccessGranted = (): boolean =>
  localStorage.getItem(ROOT_ACCESS_STORAGE_KEY) === 'true';

export function getFileAccessModeForPath(
  path: string,
  rootAccessGranted: boolean,
): backend.FileAccessMode {
  if (!rootAccessGranted) {
    return 'normal';
  }

  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  const isNormalStoragePath = NORMAL_STORAGE_PREFIXES.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );
  return isNormalStoragePath ? 'normal' : 'root';
}

export function usePathFileAccessMode(rootAccessGrantedRef: React.RefObject<boolean>) {
  return useCallback(
    (targetPath: string): backend.FileAccessMode =>
      getFileAccessModeForPath(targetPath, rootAccessGrantedRef.current),
    [rootAccessGrantedRef],
  );
}

interface Options {
  activeView: string;
  currentPathRef: React.RefObject<string>;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  rootAccessGranted: boolean;
  rootAccessGrantedRef: React.RefObject<boolean>;
  selectedSerial: string | null;
  selectedSerialRef: React.RefObject<string | null>;
  setFileList: (files: FileEntry[]) => void;
  setIsMultiSelectMode: (value: boolean) => void;
  setRootAccessGranted: (value: boolean) => void;
  setSelectedNames: (names: Set<string>) => void;
}

export function useFileExplorerRootAccess(options: Options) {
  const {
    activeView,
    currentPathRef,
    loadFiles,
    rootAccessGranted,
    rootAccessGrantedRef,
    selectedSerial,
    selectedSerialRef,
    setFileList,
    setIsMultiSelectMode,
    setRootAccessGranted,
    setSelectedNames,
  } = options;

  useEffect(() => {
    rootAccessGrantedRef.current = rootAccessGranted;
  }, [rootAccessGranted, rootAccessGrantedRef]);

  useEffect(() => {
    selectedSerialRef.current = selectedSerial;
    setFileList([]);
    setSelectedNames(new Set());
    setIsMultiSelectMode(false);
    if (activeView !== 'files' || !selectedSerial) {
      return;
    }

    if (!getStoredRootAccessGranted()) {
      rootAccessGrantedRef.current = false;
      setRootAccessGranted(false);
      void loadFiles(currentPathRef.current, false);
      return;
    }

    let cancelled = false;
    void VerifyFileRootAccess(selectedSerial)
      .then((message) => {
        if (cancelled) {
          return;
        }
        useLogStore.getState().addLog(message, 'success');
        rootAccessGrantedRef.current = true;
        setRootAccessGranted(true);
        void loadFiles(currentPathRef.current, false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        localStorage.setItem(ROOT_ACCESS_STORAGE_KEY, 'false');
        rootAccessGrantedRef.current = false;
        setRootAccessGranted(false);
        handleError('Verify Root Access', error);
        void loadFiles(currentPathRef.current, false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeView,
    currentPathRef,
    loadFiles,
    rootAccessGrantedRef,
    selectedSerial,
    selectedSerialRef,
    setFileList,
    setIsMultiSelectMode,
    setRootAccessGranted,
    setSelectedNames,
  ]);

  return useCallback(async () => {
    if (rootAccessGranted) {
      localStorage.setItem(ROOT_ACCESS_STORAGE_KEY, 'false');
      rootAccessGrantedRef.current = false;
      setRootAccessGranted(false);
      await loadFiles(currentPathRef.current, false);
      return;
    }

    try {
      const message = await VerifyFileRootAccess(selectedSerialRef.current);
      useLogStore.getState().addLog(message, 'success');
      localStorage.setItem(ROOT_ACCESS_STORAGE_KEY, 'true');
      rootAccessGrantedRef.current = true;
      setRootAccessGranted(true);
      await loadFiles(currentPathRef.current, false);
    } catch (error: unknown) {
      handleError('Verify Root Access', error);
    }
  }, [
    currentPathRef,
    loadFiles,
    rootAccessGranted,
    rootAccessGrantedRef,
    selectedSerialRef,
    setRootAccessGranted,
  ]);
}
