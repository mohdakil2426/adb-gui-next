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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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
  Layers,
} from 'lucide-react';
import { DirectoryTree } from '@/components/DirectoryTree';
import { cn } from '@/lib/utils';

type FileEntry = backend.FileEntry;

const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = 420;
const DEFAULT_LEFT_WIDTH = 240;

export function ViewFileExplorer({ activeView }: { activeView: string }) {
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('/sdcard/');
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  const [isPushingFile, setIsPushingFile] = useState(false);
  const [isPushingFolder, setIsPushingFolder] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editPathValue, setEditPathValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(currentPath);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  // Horizontal resize logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, e.clientX - rect.left));
      setLeftWidth(newWidth);
    },
    [isResizing],
  );

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

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
      setTreeRefreshKey((k) => k + 1);
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
      if (!localPath) return;

      const fileName = localPath.replace(/\\/g, '/').split('/').pop() || path.basename(localPath);
      const remotePath = path.posix.join(currentPath, fileName);

      debugLog(`Pushing file ${fileName} to ${remotePath}`);
      toastId = toast.loading(`Pushing ${fileName}...`, { description: `To: ${remotePath}` });

      const output = await PushFile(localPath, remotePath);
      toast.success('File Import Complete', { description: output, id: toastId });
      useLogStore.getState().addLog(`Pushed ${fileName} to ${remotePath}: ${output}`, 'success');
      loadFiles(currentPath);
    } catch (error) {
      if (toastId) toast.error('File Import Failed', { id: toastId });
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
      useLogStore.getState().addLog(`Pushed folder ${folderName} to ${remotePath}`, 'success');
      loadFiles(currentPath);
    } catch (error) {
      if (toastId) toast.error('Folder Import Failed', { id: toastId });
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
      if (toastId) toast.error('Export Failed', { id: toastId });
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
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-border"
    >
      {/* Drag overlay */}
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize select-none" />}

      {/* Left: Directory tree */}
      <div
        className="shrink-0 flex flex-col overflow-hidden"
        style={{ width: `${leftWidth}px` }}
      >
        <div className="flex items-center gap-2 px-3 h-10 border-b border-border shrink-0 bg-muted/30">
          <Layers className="size-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-muted-foreground">Device</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <DirectoryTree
            currentPath={currentPath}
            onNavigate={loadFiles}
            refreshTrigger={treeRefreshKey}
          />
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          'w-px shrink-0 cursor-col-resize transition-colors bg-border hover:bg-primary/60 active:bg-primary',
          isResizing && 'bg-primary',
        )}
        onMouseDown={startResizing}
      />

      {/* Right: File list */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 h-10 border-b border-border shrink-0">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={handleBackClick}
              disabled={currentPath === '/' || isBusy}
            >
              <ArrowUp className="h-4 w-4 shrink-0" />
            </Button>

            {/* Editable address bar */}
            {isEditingPath ? (
              <Input
                value={editPathValue}
                onChange={(e) => setEditPathValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = editPathValue.trim();
                    const normalized =
                      trimmed && !trimmed.endsWith('/') ? `${trimmed}/` : trimmed || '/';
                    loadFiles(normalized);
                    setIsEditingPath(false);
                  }
                  if (e.key === 'Escape') {
                    setIsEditingPath(false);
                  }
                }}
                onBlur={() => setIsEditingPath(false)}
                className="font-mono text-xs h-7 flex-1 min-w-0 focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
              />
            ) : (
              <button
                className="flex-1 min-w-0 text-left font-mono text-xs truncate text-muted-foreground hover:text-foreground cursor-text px-2 py-1 rounded-sm hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setEditPathValue(currentPath);
                  setIsEditingPath(true);
                }}
                title="Click to edit path"
              >
                {currentPath}
              </button>
            )}
          </div>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => loadFiles(currentPath)}
              disabled={isBusy}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <RefreshCw className="h-4 w-4 shrink-0" />
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePushFile} disabled={isBusy}>
              {isPushingFile ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Upload className="h-4 w-4 shrink-0" />
              )}
              Import File
            </Button>
            <Button variant="outline" size="sm" onClick={handlePushFolder} disabled={isBusy}>
              {isPushingFolder ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <FolderUp className="h-4 w-4 shrink-0" />
              )}
              Import Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePull}
              disabled={isPullDisabled || isBusy}
            >
              {isPulling ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Download className="h-4 w-4 shrink-0" />
              )}
              Export
            </Button>
          </div>
        </div>

        {/* File table */}
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-10" />
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
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    This directory is empty.
                  </TableCell>
                </TableRow>
              ) : (
                fileList.map((file) => (
                  <TableRow
                    key={file.name}
                    onClick={() => handleRowClick(file)}
                    onDoubleClick={() => handleRowDoubleClick(file)}
                    data-state={selectedFile?.name === file.name ? 'selected' : ''}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      {file.type === 'Directory' ? (
                        <Folder className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <File className="h-4 w-4 shrink-0 text-muted-foreground" />
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
      </div>
    </div>
  );
}
