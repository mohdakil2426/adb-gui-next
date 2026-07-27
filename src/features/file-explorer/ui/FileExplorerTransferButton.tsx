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
          className="size-8 shrink-0"
          disabled={disabled}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowUpToLine aria-hidden="true" className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onImportFile}>
          <File aria-hidden="true" className="size-4 shrink-0" />
          Import file
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImportFolder}>
          <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
          Import folder
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPullDisabled || isPushing} onClick={onExport}>
          <ArrowDownToLine aria-hidden="true" className="size-4 shrink-0" />
          Export selected
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
