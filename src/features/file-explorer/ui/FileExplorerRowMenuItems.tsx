import {
  Copy,
  Download,
  FileText,
  FolderOpen,
  Pencil,
  SquareCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import path from 'path-browserify';
import type {
  FileEntry,
  FileExplorerActions,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { FileExplorerClipboardMenuItems } from '@/features/file-explorer/ui/FileExplorerClipboardMenuItems';
import { FileExplorerOpenWithMenuItems } from '@/features/file-explorer/ui/FileExplorerOpenWithMenuItems';
import { isTextDeviceFile } from '@/features/file-explorer/utils/textFileExtensions';
import { ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/context-menu';

interface Props {
  actions: FileExplorerActions;
  currentPath: string;
  file: FileEntry;
  isBusy: boolean;
  pasteEnabled: boolean;
  selectedNames: Set<string>;
}

/** Row actions for the single table-body context menu. */
export function FileExplorerRowMenuItems({
  actions,
  currentPath,
  file,
  isBusy,
  pasteEnabled,
  selectedNames,
}: Props) {
  const isNavigable = file.type === 'Directory' || file.type === 'Symlink';
  const isSelected = selectedNames.has(file.name);
  const selectedCount = selectedNames.size;
  const names = isSelected && selectedCount > 0 ? Array.from(selectedNames) : [file.name];

  return (
    <>
      <ContextMenuItem
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          actions.handleSelectFromMenu(file.name);
        }}
        onSelect={() => {
          actions.handleSelectFromMenu(file.name);
        }}
      >
        <SquareCheck aria-hidden="true" className="size-4 shrink-0" />
        Select
      </ContextMenuItem>
      <FileExplorerClipboardMenuItems
        disabled={isBusy}
        onCopy={() => actions.handleCopy(names)}
        onCut={() => actions.handleCut(names)}
        onPaste={actions.handlePaste}
        pasteEnabled={pasteEnabled}
        showCopy
        showPaste
      />
      <ContextMenuItem
        onClick={() => void navigator.clipboard.writeText(path.posix.join(currentPath, file.name))}
      >
        <Copy aria-hidden="true" className="size-4 shrink-0" />
        Copy path
      </ContextMenuItem>
      <ContextMenuSeparator />
      {isNavigable ? (
        <>
          <ContextMenuItem
            onClick={() => void actions.loadFiles(path.posix.join(currentPath, file.name) + '/')}
          >
            <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
            Open
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      ) : null}
      {file.type === 'File' && isTextDeviceFile(file.name) ? (
        <>
          <ContextMenuItem disabled={isBusy} onClick={() => void actions.handleOpenInEditor(file)}>
            <FileText aria-hidden="true" className="size-4 shrink-0" />
            Open in editor
          </ContextMenuItem>
          <FileExplorerOpenWithMenuItems
            disabled={isBusy}
            onOpenWith={(target) => void actions.handleOpenInEditor(file, target)}
          />
        </>
      ) : null}
      {file.type === 'File' && !isTextDeviceFile(file.name) ? (
        <FileExplorerOpenWithMenuItems
          disabled={isBusy}
          folderOnly
          onOpenWith={(target) => void actions.handleOpenInEditor(file, target)}
        />
      ) : null}
      <ContextMenuItem
        disabled={(isSelected && selectedCount > 1) || (!isSelected && selectedCount > 0)}
        onClick={() => {
          actions.startRename(file);
        }}
      >
        <Pencil aria-hidden="true" className="size-4 shrink-0" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => {
          actions.openDeleteDialog(
            isSelected && selectedCount > 0 ? Array.from(selectedNames) : [file.name],
          );
        }}
      >
        <Trash2 aria-hidden="true" className="size-4 shrink-0" />
        {isSelected && selectedCount > 1 ? `Delete ${selectedCount} items` : 'Delete'}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={isBusy}
        onClick={() =>
          void actions.handlePushFileToDir(
            isNavigable ? path.posix.join(currentPath, file.name) + '/' : currentPath,
          )
        }
      >
        <Upload aria-hidden="true" className="size-4 shrink-0" />
        {isNavigable ? `Import into "${file.name}"` : 'Import file'}
      </ContextMenuItem>
      <ContextMenuItem disabled={isBusy} onClick={() => void actions.handlePullItem(file)}>
        <Download aria-hidden="true" className="size-4 shrink-0" />
        Export
      </ContextMenuItem>
    </>
  );
}
