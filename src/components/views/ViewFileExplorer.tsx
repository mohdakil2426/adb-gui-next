import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLogStore } from '@/lib/logStore';
import { handleError } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import path from 'path-browserify';

import {
  ListFiles,
  PushFile,
  PullFile,
  SelectFileToPush,
  SelectSaveDirectory,
  SelectDirectoryForPull,
  SelectDirectoryToPush,
} from '../../lib/desktop/backend';
import type { backend } from '../../lib/desktop/models';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Loader2,
  RefreshCw,
  Upload,
  Download,
  Folder,
  File,
  ArrowUp,
  FolderUp,
} from 'lucide-react';

type FileEntry = backend.FileEntry;

export function ViewFileExplorer({ activeView }: { activeView: string }) {
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('/sdcard/');
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isPushingFile, setIsPushingFile] = useState(false);
  const [isPushingFolder, setIsPushingFolder] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const currentPathRef = useRef(currentPath);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  const loadFiles = useCallback(async (targetPath: string) => {
    setIsLoading(true);
    setSelectedFile(null);
    try {
      debugLog(`Listing files at: ${targetPath}`);
      const files = await ListFiles(targetPath);

      if (!files) {
        setFileList([]);
        setCurrentPath(targetPath);
        currentPathRef.current = targetPath;
        return;
      }

      files.sort((a, b) => {
        if (a.type === 'Directory' && b.type !== 'Directory') return -1;
        if (a.type !== 'Directory' && b.type === 'Directory') return 1;
        return a.name.localeCompare(b.name);
      });

      setFileList(files);
      setCurrentPath(targetPath);
      currentPathRef.current = targetPath;
    } catch (error) {
      handleError('List Files', error);
      setCurrentPath(currentPathRef.current);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === 'files') {
      loadFiles(currentPathRef.current);
    }
  }, [activeView, loadFiles]);

  const handleRowClick = (file: FileEntry) => {
    setSelectedFile(file);
  };

  const handleRowDoubleClick = (file: FileEntry) => {
    if (file.type === 'Directory') {
      const newPath = path.posix.join(currentPath, file.name) + '/';
      loadFiles(newPath);
    }
  };

  const handleBackClick = () => {
    if (currentPath === '/') return;
    const newPath = path.posix.join(currentPath, '..') + '/';
    loadFiles(newPath);
  };

  const handlePushFile = async () => {
    setIsPushingFile(true);
    let toastId: string | number = '';
    try {
      const localPath = await SelectFileToPush();
      if (!localPath) {
        return;
      }

      const fileName = localPath.replace(/\\/g, '/').split('/').pop() || path.basename(localPath);
      const remotePath = path.posix.join(currentPath, fileName);

      debugLog(`Pushing file ${fileName} to ${remotePath}`);
      toastId = toast.loading(`Pushing ${fileName}...`, { description: `To: ${remotePath}` });

      const output = await PushFile(localPath, remotePath);
      toast.success('File Import Complete', { description: output, id: toastId });
      useLogStore
        .getState()
        .addLog(`Pushed file ${fileName} to ${remotePath}: ${output}`, 'success');
      loadFiles(currentPath);
    } catch (error) {
      if (toastId) {
        toast.error('File Import Failed', { id: toastId });
      }
      handleError('Push File', error);
    } finally {
      setIsPushingFile(false);
    }
  };

  const handlePushFolder = async () => {
    setIsPushingFolder(true);
    let toastId: string | number = '';
    try {
      const localFolderPath = await SelectDirectoryToPush();
      if (!localFolderPath) {
        setIsPushingFolder(false);
        return;
      }

      const remotePath = currentPath;
      const folderName =
        localFolderPath.replace(/\\/g, '/').split('/').pop() || path.basename(localFolderPath);

      debugLog(`Pushing folder ${folderName} to ${remotePath}`);
      toastId = toast.loading(`Pushing folder ${folderName}...`, {
        description: `To: ${remotePath}`,
      });

      const output = await PushFile(localFolderPath, remotePath);
      toast.success('Folder Import Complete', { description: output, id: toastId });
      useLogStore
        .getState()
        .addLog(`Pushed folder ${folderName} to ${remotePath}: ${output}`, 'success');
      loadFiles(currentPath);
    } catch (error) {
      if (toastId) {
        toast.error('Folder Import Failed', { id: toastId });
      }
      handleError('Push Folder', error);
    } finally {
      setIsPushingFolder(false);
    }
  };

  const handlePull = async () => {
    if (!selectedFile) {
      toast.error('No file or folder selected to pull.');
      return;
    }
    if (selectedFile.type !== 'File' && selectedFile.type !== 'Directory') {
      toast.error('Cannot export this item type.', {
        description: `Selected type: ${selectedFile.type}`,
      });
      return;
    }

    setIsPulling(true);
    let toastId: string | number = '';
    try {
      const remotePath = path.posix.join(currentPath, selectedFile.name);
      let localPath = '';

      if (selectedFile.type === 'Directory') {
        toast.info('Select a folder to save the directory into.');
        localPath = await SelectDirectoryForPull();
      } else {
        localPath = await SelectSaveDirectory(selectedFile.name);
      }

      if (!localPath) {
        setIsPulling(false);
        return;
      }

      debugLog(`Pulling ${selectedFile.name} from ${remotePath} to ${localPath}`);
      toastId = toast.loading(`Pulling ${selectedFile.name}...`, {
        description: `From: ${remotePath}`,
      });

      const output = await PullFile(remotePath, localPath);
      toast.success('Export Complete', { description: `Saved to ${localPath}`, id: toastId });
      useLogStore
        .getState()
        .addLog(`Pulled ${selectedFile.name} to ${localPath}: ${output}`, 'success');
    } catch (error) {
      if (toastId) {
        toast.error('Export Failed', { id: toastId });
      }
      handleError('Pull File', error);
    } finally {
      setIsPulling(false);
    }
  };

  const isBusy = isLoading || isPushingFile || isPushingFolder || isPulling;
  const isPullDisabled =
    isPulling ||
    !selectedFile ||
    (selectedFile.type !== 'File' && selectedFile.type !== 'Directory');

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">File Explorer</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadFiles(currentPath)}
              disabled={isBusy}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>

            <Button variant="default" onClick={handlePushFile} disabled={isBusy}>
              {isPushingFile ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import File
            </Button>
            <Button variant="default" onClick={handlePushFolder} disabled={isBusy}>
              {isPushingFolder ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderUp className="mr-2 h-4 w-4" />
              )}
              Import Folder
            </Button>

            <Button variant="default" onClick={handlePull} disabled={isPullDisabled || isBusy}>
              {isPulling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export Selected
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackClick}
              disabled={currentPath === '/' || isBusy}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <p className="font-mono text-sm truncate">{currentPath}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <CardContent className="p-0 flex-1 flex overflow-hidden min-h-0">
          <ScrollArea className="flex-1 h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-12.5"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : fileList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      This directory is empty.
                    </TableCell>
                  </TableRow>
                ) : (
                  fileList.map((file) => (
                    <TableRow
                      key={file.name}
                      onDoubleClick={() => handleRowDoubleClick(file)}
                      onClick={() => handleRowClick(file)}
                      data-state={selectedFile?.name === file.name ? 'selected' : ''}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        {file.type === 'Directory' ? (
                          <Folder className="h-4 w-4 text-primary" />
                        ) : (
                          <File className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>{file.size}</TableCell>
                      <TableCell>{file.date}</TableCell>
                      <TableCell>{file.time}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
