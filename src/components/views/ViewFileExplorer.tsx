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
  Link,
  ArrowUp,
  FolderUp,
  Layers,
  Lock,
  MonitorOff,
  AlertCircle,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { DirectoryTree } from '@/components/DirectoryTree';
import { cn } from '@/lib/utils';

type FileEntry = backend.FileEntry;
type LoadError = 'permission_denied' | 'no_device' | 'unknown' | null;

const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = 420;
const DEFAULT_LEFT_WIDTH = 180;

function categorizeError(err: unknown): LoadError {
  const msg = String(err).toLowerCase();
  if (msg.includes('permission denied')) return 'permission_denied';
  if (
    msg.includes('no devices') ||
    msg.includes('device not found') ||
    msg.includes('no device') ||
    msg.includes('adb: error') ||
    msg.includes('unable to locate')
  )
    return 'no_device';
  return 'unknown';
}

export function ViewFileExplorer({ activeView }: { activeView: string }) {
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('/sdcard/');
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  const [isPushingFile, setIsPushingFile] = useState(false);
  const [isPushingFolder, setIsPushingFolder] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(
    () => localStorage.getItem('fe.treeCollapsed') === 'true',
  );
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editPathValue, setEditPathValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(currentPath);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  const toggleTree = useCallback((collapsed: boolean) => {
    setIsTreeCollapsed(collapsed);
    localStorage.setItem('fe.treeCollapsed', String(collapsed));
  }, []);

  // Horizontal resize
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

      files.sort((a, b) => {
        const aIsDir = a.type === 'Directory' || a.type === 'Symlink';
        const bIsDir = b.type === 'Directory' || b.type === 'Symlink';
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.name.localeCompare(b.name);
      });

      setFileList(files);
      setLoadError(null);
      setCurrentPath(targetPath);
      currentPathRef.current = targetPath;
      setTreeRefreshKey((k) => k + 1);
    } catch (error) {
      // Categorize and surface the error clearly; clear stale file list
      const category = categorizeError(error);
      setLoadError(category);
      setFileList([]);
      handleError('List Files', error);
      // Keep currentPath stable so the address bar still shows where the user tried to go
      setCurrentPath(targetPath);
      currentPathRef.current = targetPath;
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
    // Treat Symlinks same as Directories — navigate into them; if it fails, toast shows error.
    if (file.type === 'Directory' || file.type === 'Symlink') {
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
    // Allow pulling Symlinks in the same way as Dirs/Files
    const isNavigable =
      selectedFile.type === 'File' ||
      selectedFile.type === 'Directory' ||
      selectedFile.type === 'Symlink';
    if (!isNavigable) {
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

      if (selectedFile.type === 'Directory' || selectedFile.type === 'Symlink') {
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
    (selectedFile.type !== 'File' &&
      selectedFile.type !== 'Directory' &&
      selectedFile.type !== 'Symlink');

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-border"
    >
      {/* Drag overlay — prevents text selection while resizing */}
      {isResizing && <div className="fixed inset-0 z-50 cursor-col-resize select-none" />}

      {/* Left: Directory tree (hidden when collapsed) */}
      {!isTreeCollapsed && (
        <div
          className="shrink-0 flex flex-col overflow-hidden"
          style={{ width: `${leftWidth}px` }}
        >
          <div className="flex items-center gap-2 px-3 h-10 border-b border-border shrink-0 bg-muted/30">
            <Layers className="size-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-muted-foreground flex-1">Device</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => toggleTree(true)}
              title="Collapse tree panel"
            >
              <PanelLeftClose className="size-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <DirectoryTree
              currentPath={currentPath}
              onNavigate={loadFiles}
              refreshTrigger={treeRefreshKey}
            />
          </div>
        </div>
      )}

      {/* Resize handle — only visible when tree is open */}
      {!isTreeCollapsed && (
        <div
          className={cn(
            'w-px shrink-0 cursor-col-resize transition-colors bg-border hover:bg-primary/60 active:bg-primary',
            isResizing && 'bg-primary',
          )}
          onMouseDown={startResizing}
        />
      )}

      {/* Right: File list */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-2 h-10 border-b border-border shrink-0">
          {/* Show tree toggle when collapsed */}
          {isTreeCollapsed && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => toggleTree(false)}
                title="Show tree panel"
              >
                <PanelLeft className="size-4" />
              </Button>
              <Separator orientation="vertical" className="h-4 mx-0.5" />
            </>
          )}

          {/* Back + Address bar */}
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

          <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

          {/* Action buttons */}
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
              <span className="hidden sm:inline">Import File</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handlePushFolder} disabled={isBusy}>
              {isPushingFolder ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <FolderUp className="h-4 w-4 shrink-0" />
              )}
              <span className="hidden sm:inline">Import Folder</span>
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
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* File table / empty / error states */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError === 'permission_denied' ? (
            <div className="flex flex-col h-40 items-center justify-center gap-2 text-muted-foreground">
              <Lock className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">Access Denied</p>
              <p className="text-xs opacity-60">
                This location requires elevated permissions or root access.
              </p>
            </div>
          ) : loadError === 'no_device' ? (
            <div className="flex flex-col h-40 items-center justify-center gap-2 text-muted-foreground">
              <MonitorOff className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">No Device Connected</p>
              <p className="text-xs opacity-60">
                Connect a device via USB or wireless ADB and try again.
              </p>
            </div>
          ) : loadError === 'unknown' ? (
            <div className="flex flex-col h-40 items-center justify-center gap-2 text-muted-foreground">
              <AlertCircle className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">Failed to Load</p>
              <p className="text-xs opacity-60">Check the logs panel for details.</p>
            </div>
          ) : fileList.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              This directory is empty.
            </div>
          ) : (
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
                {fileList.map((file) => (
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
                      ) : file.type === 'Symlink' ? (
                        <Link className="h-4 w-4 shrink-0 text-primary/70" />
                      ) : (
                        <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell>{file.size}</TableCell>
                    <TableCell>{file.date}</TableCell>
                    <TableCell>{file.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
