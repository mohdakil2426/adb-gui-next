import path from 'path-browserify';
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  PullFile,
  PushFile,
  SelectDirectoryForPull,
  SelectDirectoryToPush,
  SelectFileToPush,
  SelectSaveDirectory,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
import { useLogStore } from '@/shared/stores/logStore';
import { debugLog } from '@/shared/utils/debug';
import { handleError } from '@/shared/utils/errorHandler';

interface Options {
  currentPath: string;
  getFileAccessMode: (path: string) => backend.FileAccessMode;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  selectedSerialRef: React.RefObject<string | null>;
  setIsPulling: (v: boolean) => void;
  setIsPushing: (v: boolean) => void;
  singleSelected: FileEntry | null;
}

export function useFileExplorerTransfers(options: Options) {
  const {
    currentPath,
    getFileAccessMode,
    loadFiles,
    selectedSerialRef,
    setIsPulling,
    setIsPushing,
    singleSelected,
  } = options;

  const executePull = useCallback(
    async (file: FileEntry) => {
      setIsPulling(true);
      let toastId: string | number = '';
      try {
        const remotePath = path.posix.join(currentPath, file.name);
        const localPath =
          file.type === 'Directory' || file.type === 'Symlink'
            ? await SelectDirectoryForPull()
            : await SelectSaveDirectory(file.name);
        if (!localPath) {
          return;
        }
        toastId = toast.loading(`Pulling ${file.name}…`, { description: `From: ${remotePath}` });
        const output = await PullFile(
          remotePath,
          localPath,
          selectedSerialRef.current,
          getFileAccessMode(remotePath),
        );
        toast.success('Export Complete', { description: `Saved to ${localPath}`, id: toastId });
        useLogStore.getState().addLog(`Pulled ${file.name} to ${localPath}: ${output}`, 'success');
      } catch (error) {
        if (toastId) {
          toast.error('Export Failed', { id: toastId });
        }
        handleError('Export', error);
      } finally {
        setIsPulling(false);
      }
    },
    [currentPath, getFileAccessMode, selectedSerialRef, setIsPulling],
  );

  const executePush = useCallback(
    async (localPath: string, targetDir: string) => {
      setIsPushing(true);
      let toastId: string | number = '';
      try {
        const fileName = localPath.replace(/\\/g, '/').split('/').pop() ?? '';
        const remotePath = path.posix.join(targetDir, fileName);
        toastId = toast.loading(`Pushing ${fileName}…`, { description: `To: ${remotePath}` });
        const output = await PushFile(
          localPath,
          remotePath,
          selectedSerialRef.current,
          getFileAccessMode(remotePath),
        );
        toast.success('Import Complete', { description: output, id: toastId });
        useLogStore.getState().addLog(`Pushed ${fileName} to ${remotePath}: ${output}`, 'success');
        void loadFiles(currentPath, false);
      } catch (error) {
        if (toastId) {
          toast.error('Import Failed', { id: toastId });
        }
        handleError('Import', error);
      } finally {
        setIsPushing(false);
      }
    },
    [currentPath, getFileAccessMode, loadFiles, selectedSerialRef, setIsPushing],
  );

  const handlePushFile = useCallback(async () => {
    const localPath = await SelectFileToPush();
    if (!localPath) {
      return;
    }
    const fileName = localPath.replace(/\\/g, '/').split('/').pop() ?? path.basename(localPath);
    debugLog(`Pushing file ${fileName} to ${currentPath}`);
    await executePush(localPath, currentPath);
  }, [currentPath, executePush]);

  const handlePushFolder = useCallback(async () => {
    setIsPushing(true);
    let toastId: string | number = '';
    try {
      const localFolderPath = await SelectDirectoryToPush();
      if (!localFolderPath) {
        return;
      }
      const folderName =
        localFolderPath.replace(/\\/g, '/').split('/').pop() ?? path.basename(localFolderPath);
      debugLog(`Pushing folder ${folderName} to ${currentPath}`);
      toastId = toast.loading(`Pushing folder ${folderName}…`, {
        description: `To: ${currentPath}`,
      });
      const output = await PushFile(
        localFolderPath,
        currentPath,
        selectedSerialRef.current,
        getFileAccessMode(currentPath),
      );
      toast.success('Import Complete', { description: output, id: toastId });
      useLogStore.getState().addLog(`Pushed folder ${folderName} to ${currentPath}`, 'success');
      void loadFiles(currentPath, false);
    } catch (error) {
      if (toastId) {
        toast.error('Import Failed', { id: toastId });
      }
      handleError('Push Folder', error);
    } finally {
      setIsPushing(false);
    }
  }, [currentPath, getFileAccessMode, loadFiles, selectedSerialRef, setIsPushing]);

  const handlePull = useCallback(async () => {
    if (!singleSelected) {
      toast.error('Select a single item to export.');
      return;
    }
    await executePull(singleSelected);
  }, [executePull, singleSelected]);

  const handlePullItem = useCallback((file: FileEntry) => executePull(file), [executePull]);
  const handlePushFileToDir = useCallback(
    async (targetDir: string) => {
      const localPath = await SelectFileToPush();
      if (!localPath) {
        return;
      }
      await executePush(localPath, targetDir);
    },
    [executePush],
  );

  return { handlePull, handlePullItem, handlePushFile, handlePushFileToDir, handlePushFolder };
}
