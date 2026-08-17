import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TransferDeviceFiles } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { EventsOn } from '@/desktop/runtime';
import {
  canPasteHere,
  type FileExplorerClipboard,
  PASTE_TOAST,
  sourcesFromNames,
} from '@/features/file-explorer/utils/fileExplorerClipboard';
import { destinationPath } from '@/features/file-explorer/utils/fileExplorerPaths';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';

interface Options {
  currentPath: string;
  getFileAccessMode: (path: string) => backend.FileAccessMode;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  selectedSerial: string | null;
  setIsPasting: (value: boolean) => void;
}

export function useFileExplorerClipboard(options: Options) {
  const { currentPath, getFileAccessMode, loadFiles, selectedSerial, setIsPasting } = options;
  const [clipboard, setClipboard] = useState<FileExplorerClipboard | null>(null);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingDestDir, setPendingDestDir] = useState<string | null>(null);

  useEffect(
    () =>
      EventsOn<backend.FileEditPushed>('files:edit-pushed', (event) => {
        if (event.ok) {
          toast.success(event.message);
          useLogStore.getState().addLog(event.message, 'success');
          return;
        }
        toast.error(event.message);
        useLogStore.getState().addLog(event.message, 'error');
      }),
    [],
  );

  const copyNames = useCallback(
    (names: Iterable<string>, mode: FileExplorerClipboard['mode']) => {
      if (!selectedSerial) {
        toast.error('No device selected');
        return;
      }
      const sources = sourcesFromNames(currentPath, names);
      if (sources.length === 0) {
        toast.error(PASTE_TOAST.empty);
        return;
      }
      setClipboard({ mode, serial: selectedSerial, sources });
      toast.success(mode === 'cut' ? 'Cut' : 'Copied', {
        description: `${sources.length} item${sources.length > 1 ? 's' : ''}`,
      });
    },
    [currentPath, selectedSerial],
  );

  const handleCopy = useCallback(
    (names: Iterable<string>) => {
      copyNames(names, 'copy');
    },
    [copyNames],
  );

  const handleCut = useCallback(
    (names: Iterable<string>) => {
      copyNames(names, 'cut');
    },
    [copyNames],
  );

  const handleCopyPath = useCallback(
    async (names: Iterable<string>) => {
      const paths = [...names].map((name) => destinationPath(currentPath, name));
      if (paths.length === 0) {
        return;
      }
      await navigator.clipboard.writeText(paths.join('\n'));
      toast.success('Path copied');
    },
    [currentPath],
  );

  const runPaste = useCallback(
    async (destDir: string, overwrite: boolean) => {
      const check = canPasteHere(clipboard, destDir, selectedSerial);
      if (check !== 'ok' || !clipboard) {
        toast.error(PASTE_TOAST[check === 'ok' ? 'empty' : check]);
        return;
      }
      setIsPasting(true);
      try {
        const result = await TransferDeviceFiles(
          clipboard.mode,
          clipboard.sources,
          destDir,
          overwrite,
          selectedSerial,
          clipboard.serial,
          getFileAccessMode(destDir),
        );
        if (result.skippedExisting.length > 0) {
          setPendingDestDir(destDir);
          setOverwriteOpen(true);
          return;
        }
        if (clipboard.mode === 'cut') {
          setClipboard(null);
        }
        toast.success(result.message);
        useLogStore.getState().addLog(result.message, 'success');
        void loadFiles(currentPath, false);
      } catch (error) {
        handleError('Paste', error);
      } finally {
        setIsPasting(false);
      }
    },
    [clipboard, currentPath, getFileAccessMode, loadFiles, selectedSerial, setIsPasting],
  );

  const handlePaste = useCallback(() => {
    void runPaste(currentPath, false);
  }, [currentPath, runPaste]);

  const handleOverwriteConfirm = useCallback(() => {
    const destDir = pendingDestDir ?? currentPath;
    setOverwriteOpen(false);
    setPendingDestDir(null);
    void runPaste(destDir, true);
  }, [currentPath, pendingDestDir, runPaste]);

  const handleMoveToFolder = useCallback(
    async (destDir: string, names: Iterable<string>) => {
      if (!selectedSerial) {
        toast.error('No device selected');
        return;
      }
      const sources = sourcesFromNames(currentPath, names);
      setIsPasting(true);
      try {
        const result = await TransferDeviceFiles(
          'cut',
          sources,
          destDir,
          false,
          selectedSerial,
          selectedSerial,
          getFileAccessMode(destDir),
        );
        if (result.skippedExisting.length > 0) {
          toast.error('An item with that name already exists in the folder');
          return;
        }
        toast.success(result.message);
        useLogStore.getState().addLog(result.message, 'success');
        void loadFiles(currentPath, false);
      } catch (error) {
        handleError('Move', error);
      } finally {
        setIsPasting(false);
      }
    },
    [currentPath, getFileAccessMode, loadFiles, selectedSerial, setIsPasting],
  );

  const pasteCheck = canPasteHere(clipboard, currentPath, selectedSerial);

  return {
    clipboard,
    handleCopy,
    handleCopyPath,
    handleCut,
    handleMoveToFolder,
    handleOverwriteConfirm,
    handlePaste,
    overwriteOpen,
    pasteEnabled: pasteCheck === 'ok',
    setOverwriteOpen,
  };
}
