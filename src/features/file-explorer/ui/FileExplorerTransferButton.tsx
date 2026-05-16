import { ArrowDownToLine, ArrowUpToLine, File, FolderOpen } from 'lucide-react';
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
  isPushing: boolean;
  onExport: () => void;
  onImportFile: () => void;
  onImportFolder: () => void;
}

export function FileExplorerTransferButton({
  disabled,
  isPullDisabled,
  isPushing,
  onExport,
  onImportFile,
  onImportFolder,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Transfer options"
          className="size-11"
          disabled={disabled}
          size="icon"
          variant="ghost"
        >
          <ArrowUpToLine className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onImportFile}>
          <File className="size-4 shrink-0" />
          Import File
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImportFolder}>
          <FolderOpen className="size-4 shrink-0" />
          Import Folder
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPullDisabled || isPushing} onClick={onExport}>
          <ArrowDownToLine className="size-4 shrink-0" />
          Export
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
