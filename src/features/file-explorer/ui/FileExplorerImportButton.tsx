import { ChevronDown, File, FolderOpen, Loader2, Upload } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

interface Props {
  disabled: boolean;
  isPushing: boolean;
  onImportFile: () => void;
  onImportFolder: () => void;
}

export function FileExplorerImportButton({
  disabled,
  isPushing,
  onImportFile,
  onImportFolder,
}: Props) {
  return (
    <div className="flex items-stretch">
      <Button
        className="rounded-r-none border-r-0 pr-2"
        disabled={disabled}
        onClick={onImportFile}
        size="sm"
        variant="outline"
      >
        {isPushing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 shrink-0" />
        )}
        <span className="hidden sm:inline">Import</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Import options"
            className="rounded-l-none px-1.5"
            disabled={disabled}
            size="sm"
            variant="outline"
          >
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onImportFile}>
            <File className="h-4 w-4 shrink-0" />
            Import File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImportFolder}>
            <FolderOpen className="h-4 w-4 shrink-0" />
            Import Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
