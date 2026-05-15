import { Download, FilePlus2, FolderPlus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

interface Props {
  disabled: boolean;
  isPullDisabled: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onExport: () => void;
}

export function FileExplorerMoreActionsMenu({
  disabled,
  isPullDisabled,
  onCreateFile,
  onCreateFolder,
  onExport,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="More file actions"
          className="size-11"
          disabled={disabled}
          size="icon"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCreateFile}>
          <FilePlus2 className="h-4 w-4 shrink-0" />
          New File
          <span className="ml-auto pl-4 text-muted-foreground text-xs">Ctrl+N</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateFolder}>
          <FolderPlus className="h-4 w-4 shrink-0" />
          New Folder
          <span className="ml-auto pl-4 text-muted-foreground text-xs">Ctrl+Shift+N</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPullDisabled} onClick={onExport}>
          <Download className="h-4 w-4 shrink-0" />
          Export
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
