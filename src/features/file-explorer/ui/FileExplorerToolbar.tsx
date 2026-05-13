import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Download,
  File,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  PanelLeft,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { Separator } from '@/shared/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

function ToolbarTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface FileExplorerToolbarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  currentPath: string;
  editPathValue: string;
  isBusy: boolean;
  isEditingPath: boolean;
  isLoading: boolean;
  isPullDisabled: boolean;
  isPushing: boolean;
  isTreeCollapsed: boolean;
  onBack: () => void;
  onClearSearch: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onExpandTree: () => void;
  onExport: () => void;
  onGoUp: () => void;
  onImportFile: () => void;
  onImportFolder: () => void;
  onPathClick: () => void;
  onPathEditingChange: (value: string) => void;
  onPathEditingCommit: () => void;
  onPathEditingStop: () => void;
  onRefresh: () => void;
  onSearchClear: () => void;
  onSearchQueryChange: (value: string) => void;
  onUp: () => void;
  pullTitle?: string | undefined;
  searchQuery: string;
}

export function FileExplorerToolbar(props: FileExplorerToolbarProps) {
  const {
    canGoBack,
    canGoForward,
    currentPath,
    editPathValue,
    isBusy,
    isEditingPath,
    isLoading,
    isPullDisabled,
    isPushing,
    isTreeCollapsed,
    onBack,
    onClearSearch,
    onCreateFile,
    onCreateFolder,
    onExpandTree,
    onExport,
    onGoUp,
    onImportFile,
    onImportFolder,
    onPathClick,
    onPathEditingChange,
    onPathEditingCommit,
    onPathEditingStop,
    onRefresh,
    onSearchQueryChange,
    onUp,
    pullTitle,
    searchQuery,
  } = props;
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-border border-b px-2">
      {isTreeCollapsed ? (
        <>
          <ToolbarTooltip label="Show tree panel">
            <Button
              className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onExpandTree}
              size="icon"
              variant="ghost"
            >
              <PanelLeft className="size-4" />
            </Button>
          </ToolbarTooltip>
          <Separator className="mx-0.5 h-4" orientation="vertical" />
        </>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <ToolbarTooltip label="Back (Alt+Left)">
          <Button
            className="size-11 shrink-0"
            disabled={!canGoBack || isBusy}
            onClick={onBack}
            size="icon"
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="Forward (Alt+Right)">
          <Button
            className="size-11 shrink-0"
            disabled={!canGoForward || isBusy}
            onClick={onGoUp}
            size="icon"
            variant="ghost"
          >
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="Go up">
          <Button
            className="size-11 shrink-0"
            disabled={currentPath === '/' || isBusy}
            onClick={onUp}
            size="icon"
            variant="ghost"
          >
            <ArrowUp className="h-4 w-4 shrink-0" />
          </Button>
        </ToolbarTooltip>
        {isEditingPath ? (
          <div className="relative flex min-w-0 flex-1 items-center">
            <Folder className="pointer-events-none absolute left-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              className="h-7 min-w-0 flex-1 border-input pr-2 pl-6 font-mono text-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onBlur={onPathEditingStop}
              onChange={(e) => onPathEditingChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onPathEditingCommit();
                }
                if (e.key === 'Escape') {
                  onPathEditingStop();
                }
              }}
              value={editPathValue}
            />
          </div>
        ) : (
          <button
            className="min-w-0 flex-1 cursor-text truncate rounded-sm px-2 py-1 text-left font-mono text-muted-foreground text-xs transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onPathClick}
            title="Click to edit path"
          >
            {currentPath}
          </button>
        )}
      </div>
      <Separator className="mx-1 h-4 shrink-0" orientation="vertical" />
      <div className="flex shrink-0 items-center gap-1">
        <ToolbarTooltip label="Refresh (F5)">
          <Button
            className="size-11"
            disabled={isBusy}
            onClick={onRefresh}
            size="icon"
            variant="ghost"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 shrink-0" />
            )}
          </Button>
        </ToolbarTooltip>
        <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            aria-label="Filter files"
            className="h-7 w-32 pr-6 pl-6 text-xs transition-[width] duration-200 focus-visible:w-48"
            id="fe-search-input"
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Filter…"
            value={searchQuery}
          />
          {searchQuery ? (
            <button
              aria-label="Clear filter"
              className="absolute right-1.5 text-muted-foreground hover:text-foreground"
              onClick={onClearSearch}
              tabIndex={-1}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />
        <ToolbarTooltip label="New File (Ctrl+N)">
          <Button
            className="size-11"
            disabled={isBusy}
            onClick={onCreateFile}
            size="icon"
            variant="ghost"
          >
            <FilePlus2 className="h-4 w-4 shrink-0" />
          </Button>
        </ToolbarTooltip>
        <ToolbarTooltip label="New Folder (Ctrl+Shift+N)">
          <Button
            className="size-11"
            disabled={isBusy}
            onClick={onCreateFolder}
            size="icon"
            variant="ghost"
          >
            <FolderPlus className="h-4 w-4 shrink-0" />
          </Button>
        </ToolbarTooltip>
        <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />
        <div className="flex items-stretch">
          <Button
            className="rounded-r-none border-r-0 pr-2"
            disabled={isBusy}
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
                disabled={isBusy}
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
        <Button
          disabled={isPullDisabled || isBusy}
          onClick={onExport}
          size="sm"
          title={pullTitle}
          variant="outline"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </div>
  );
}
