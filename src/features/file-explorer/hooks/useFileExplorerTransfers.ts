import path from 'path-browserify';
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  HostPathKinds,
  OpenDeviceFileInEditor,
  PullFile,
  PushFile,
  RevealDevicePathInExplorer,
  SelectDirectoryForPull,
  SelectDirectoryToPush,
  SelectFileToPush,
  SelectSaveDirectory,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
import { isTextDeviceFile } from '@/features/file-explorer/utils/textFileExtensions';
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
      // Snapshot serial + path before dialogs so device switch mid-picker cannot retarget IPC
      const serial = selectedSerialRef.current;
      const basePath = currentPath;
      setIsPulling(true);
      let toastId: string | number = '';
      try {
        const remotePath = path.posix.join(basePath, file.name);
        const localPath =
          file.type === 'Directory' || file.type === 'Symlink'
            ? await SelectDirectoryForPull()
            : await SelectSaveDirectory(file.name);
        if (!localPath) {
          return;
        }
        toastId = toast.loading(`Pulling ${file.name}…`, { description: `From: ${remotePath}` });
        const output = await PullFile(remotePath, localPath, serial, getFileAccessMode(remotePath));
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
    async (localPath: string, targetDir: string, serial: string | null) => {
      const refreshPath = currentPath;
      setIsPushing(true);
      let toastId: string | number = '';
      try {
        const fileName = localPath.replace(/\\/g, '/').split('/').pop() ?? '';
        const remotePath = path.posix.join(targetDir, fileName);
        toastId = toast.loading(`Pushing ${fileName}…`, { description: `To: ${remotePath}` });
        const output = await PushFile(localPath, remotePath, serial, getFileAccessMode(remotePath));
        toast.success('Import Complete', { description: output, id: toastId });
        useLogStore.getState().addLog(`Pushed ${fileName} to ${remotePath}: ${output}`, 'success');
        void loadFiles(refreshPath, false);
      } catch (error) {
        if (toastId) {
          toast.error('Import Failed', { id: toastId });
        }
        handleError('Import', error);
      } finally {
        setIsPushing(false);
      }
    },
    [currentPath, getFileAccessMode, loadFiles, setIsPushing],
  );

  const handlePushFile = useCallback(async () => {
    // Snapshot serial + path before file picker dialog
    const serial = selectedSerialRef.current;
    const basePath = currentPath;
    const localPath = await SelectFileToPush();
    if (!localPath) {
      return;
    }
    const fileName = localPath.replace(/\\/g, '/').split('/').pop() ?? path.basename(localPath);
    debugLog(`Pushing file ${fileName} to ${basePath}`);
    await executePush(localPath, basePath, serial);
  }, [currentPath, executePush, selectedSerialRef]);

  const handlePushFolder = useCallback(async () => {
    // Snapshot before directory picker dialog
    const serial = selectedSerialRef.current;
    const basePath = currentPath;
    setIsPushing(true);
    let toastId: string | number = '';
    try {
      const localFolderPath = await SelectDirectoryToPush();
      if (!localFolderPath) {
        return;
      }
      const folderName =
        localFolderPath.replace(/\\/g, '/').split('/').pop() ?? path.basename(localFolderPath);
      debugLog(`Pushing folder ${folderName} to ${basePath}`);
      toastId = toast.loading(`Pushing folder ${folderName}…`, {
        description: `To: ${basePath}`,
      });
      const output = await PushFile(localFolderPath, basePath, serial, getFileAccessMode(basePath));
      toast.success('Import Complete', { description: output, id: toastId });
      useLogStore.getState().addLog(`Pushed folder ${folderName} to ${basePath}`, 'success');
      void loadFiles(basePath, false);
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

  const handleImportDroppedPaths = useCallback(
    async (localPaths: string[], destDir: string) => {
      const serial = selectedSerialRef.current;
      if (!serial) {
        toast.error('No device selected');
        return;
      }
      if (localPaths.length === 0) {
        return;
      }
      const refreshPath = currentPath;
      setIsPushing(true);
      let toastId: string | number = '';
      try {
        const kinds = await HostPathKinds(localPaths);
        const count = kinds.length;
        toastId = toast.loading(`Importing ${count} item${count === 1 ? '' : 's'}…`, {
          description: `To: ${destDir}`,
        });
        await Promise.all(
          kinds.map((item) => {
            if (item.isDir) {
              return PushFile(item.path, destDir, serial, getFileAccessMode(destDir));
            }
            const fileName = item.path.replace(/\\/g, '/').split('/').pop() ?? '';
            const remotePath = path.posix.join(destDir, fileName);
            return PushFile(item.path, remotePath, serial, getFileAccessMode(remotePath));
          }),
        );
        toast.success('Import Complete', {
          description: `${count} item${count === 1 ? '' : 's'} to ${destDir}`,
          id: toastId,
        });
        useLogStore.getState().addLog(`Imported ${count} host path(s) to ${destDir}`, 'success');
        void loadFiles(refreshPath, false);
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

  const handlePullItem = useCallback((file: FileEntry) => executePull(file), [executePull]);
  const handlePushFileToDir = useCallback(
    async (targetDir: string) => {
      const serial = selectedSerialRef.current;
      const localPath = await SelectFileToPush();
      if (!localPath) {
        return;
      }
      await executePush(localPath, targetDir, serial);
    },
    [executePush, selectedSerialRef],
  );

  const handleOpenInEditor = useCallback(
    async (file: FileEntry, target: backend.DeviceEditorTarget = 'default') => {
      if (file.type !== 'File') {
        return;
      }
      if (!isTextDeviceFile(file.name)) {
        toast.error('This file type cannot be opened as text.');
        return;
      }
      const serial = selectedSerialRef.current;
      const remotePath = path.posix.join(currentPath, file.name);
      try {
        const message = await OpenDeviceFileInEditor(
          remotePath,
          serial,
          getFileAccessMode(remotePath),
          target,
        );
        toast.success(message);
        useLogStore.getState().addLog(message, 'success');
      } catch (error) {
        handleError('Open with', error);
      }
    },
    [currentPath, getFileAccessMode, selectedSerialRef],
  );

  const handleShowInExplorer = useCallback(
    async (file: FileEntry) => {
      const serial = selectedSerialRef.current;
      const joined = path.posix.join(currentPath, file.name);
      const remotePath =
        file.type === 'Directory' || file.type === 'Symlink' ? `${joined}/` : joined;
      try {
        const message = await RevealDevicePathInExplorer(remotePath, serial);
        toast.success(message);
        useLogStore.getState().addLog(message, 'success');
      } catch (error) {
        handleError('Show in Explorer', error);
      }
    },
    [currentPath, selectedSerialRef],
  );

  return {
    handleImportDroppedPaths,
    handleOpenInEditor,
    handleShowInExplorer,
    handlePull,
    handlePullItem,
    handlePushFile,
    handlePushFileToDir,
    handlePushFolder,
  };
}
