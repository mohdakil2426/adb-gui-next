import { Download, FilePlus2, FolderPlus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';

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
          className="size-8 shrink-0"
          disabled={disabled}
          size="icon-sm"
          variant="ghost"
        >
          <MoreHorizontal aria-hidden="true" className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCreateFile}>
          <FilePlus2 aria-hidden="true" className="size-4 shrink-0" />
          New file
          <KbdGroup className="ml-auto pl-4">
            <Kbd>Ctrl</Kbd>
            <Kbd>N</Kbd>
          </KbdGroup>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateFolder}>
          <FolderPlus aria-hidden="true" className="size-4 shrink-0" />
          New folder
          <KbdGroup className="ml-auto pl-4">
            <Kbd>Ctrl</Kbd>
            <Kbd>Shift</Kbd>
            <Kbd>N</Kbd>
          </KbdGroup>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPullDisabled} onClick={onExport}>
          <Download aria-hidden="true" className="size-4 shrink-0" />
          Export selected
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
