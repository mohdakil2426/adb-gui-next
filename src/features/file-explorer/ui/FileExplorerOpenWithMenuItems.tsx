import { Code, FileText, FolderOpen } from 'lucide-react';
import type { backend } from '@/desktop/models';
import {
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/shared/ui/context-menu';

interface Props {
  disabled: boolean;
  folderOnly?: boolean;
  onOpenWith: (target: backend.DeviceEditorTarget) => void;
}

export function FileExplorerOpenWithMenuItems({ disabled, folderOnly = false, onOpenWith }: Props) {
  if (folderOnly) {
    return (
      <ContextMenuItem disabled={disabled} onClick={() => onOpenWith('folder')}>
        <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
        Show in folder
      </ContextMenuItem>
    );
  }
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger disabled={disabled}>
        <FileText aria-hidden="true" className="size-4 shrink-0" />
        Open with
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuItem disabled={disabled} onClick={() => onOpenWith('vscode')}>
          <Code aria-hidden="true" className="size-4 shrink-0" />
          Visual Studio Code
        </ContextMenuItem>
        <ContextMenuItem disabled={disabled} onClick={() => onOpenWith('notepad')}>
          <FileText aria-hidden="true" className="size-4 shrink-0" />
          Notepad
        </ContextMenuItem>
        <ContextMenuItem disabled={disabled} onClick={() => onOpenWith('folder')}>
          <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
          Show in folder
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
