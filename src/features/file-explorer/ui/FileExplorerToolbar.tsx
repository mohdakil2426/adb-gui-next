import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Download,
  FilePlus2,
  FileUp,
  FolderPlus,
  FolderUp,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';
import { FileExplorerPathBar } from '@/features/file-explorer/ui/FileExplorerPathBar';
import { FileExplorerRootAccessButton } from '@/features/file-explorer/ui/FileExplorerRootAccessButton';
import { ToolbarTooltip } from '@/features/file-explorer/ui/ToolbarTooltip';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/shared/ui/input-group';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { Separator } from '@/shared/ui/separator';

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
  onCollapseTree: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDeleteSelection: () => void;
  onExpandTree: () => void;
  onExport: () => void;
  onForward: () => void;
  onGoUp: () => void;
  onImportFile: () => void;
  onImportFolder: () => void;
  onMoveToFolder: (destDir: string, names: Iterable<string>) => Promise<void>;
  onNavigate: (targetPath: string) => void;
  onPathClick: () => void;
  onPathEditingChange: (value: string) => void;
  onPathEditingCommit: () => void;
  onPathEditingStop: () => void;
  onRefresh: () => void;
  onRename: (entry: FileEntry) => void;
  onRootAccessToggle: () => Promise<void>;
  onSearchQueryChange: (value: string) => void;
  rootAccessGranted: boolean;
  searchQuery: string;
  selectedCount: number;
  singleSelected: FileEntry | null;
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
    onCollapseTree,
    onCreateFile,
    onCreateFolder,
    onDeleteSelection,
    onExpandTree,
    onExport,
    onForward,
    onGoUp,
    onImportFile,
    onImportFolder,
    onNavigate,
    onMoveToFolder,
    onPathClick,
    onPathEditingChange,
    onPathEditingCommit,
    onPathEditingStop,
    onRefresh,
    onRename,
    onRootAccessToggle,
    onSearchQueryChange,
    rootAccessGranted,
    searchQuery,
    selectedCount,
    singleSelected,
  } = props;

  return (
    <div className="flex shrink-0 flex-col border-border border-b">
      <div className="flex h-10 items-center gap-1.5 px-2">
        <div className="flex shrink-0 items-center gap-2">
          <ToolbarTooltip label="Back (Alt+Left)">
            <Button
              aria-label="Navigate back"
              className="size-8 shrink-0"
              disabled={!canGoBack || isBusy}
              onClick={onBack}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="Forward (Alt+Right)">
            <Button
              aria-label="Navigate forward"
              className="size-8 shrink-0"
              disabled={!canGoForward || isBusy}
              onClick={onForward}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="Go up one directory">
            <Button
              aria-label="Go up one directory"
              className="size-8 shrink-0"
              disabled={currentPath === '/' || isBusy}
              onClick={onGoUp}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowUp aria-hidden="true" className="size-4 shrink-0" />
            </Button>
          </ToolbarTooltip>
          <RefreshButton
            aria-label="Refresh directory"
            isLoading={isLoading}
            mode="icon"
            onClick={onRefresh}
            tooltip="Refresh (F5)"
          />
        </div>

        <FileExplorerPathBar
          currentPath={currentPath}
          editPathValue={editPathValue}
          isEditingPath={isEditingPath}
          onMoveToFolder={onMoveToFolder}
          onNavigate={onNavigate}
          onPathClick={onPathClick}
          onPathEditingChange={onPathEditingChange}
          onPathEditingCommit={onPathEditingCommit}
          onPathEditingStop={onPathEditingStop}
        />

        <InputGroup className="h-8 @2xl:w-52 w-40 shrink-0">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Filter files"
            id="fe-search-input"
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search this folder"
            value={searchQuery}
          />
          {searchQuery ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Clear filter"
                onClick={onClearSearch}
                size="icon-xs"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>

      <div className="flex h-10 items-center gap-4 px-3">
        <ToolbarTooltip label={isTreeCollapsed ? 'Show tree panel' : 'Collapse tree panel'}>
          <Button
            aria-label={isTreeCollapsed ? 'Show tree panel' : 'Collapse tree panel'}
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={isTreeCollapsed ? onExpandTree : onCollapseTree}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {isTreeCollapsed ? (
              <PanelLeft aria-hidden="true" className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-4" />
            )}
          </Button>
        </ToolbarTooltip>

        <Separator className="mx-0.5 h-5" orientation="vertical" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-8 shrink-0 gap-1 px-2.5"
              disabled={isBusy}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Plus aria-hidden="true" data-icon="inline-start" />
              New
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 opacity-70"
                data-icon="inline-end"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onCreateFolder}>
                <FolderPlus aria-hidden="true" className="size-4 shrink-0" />
                Folder
                <KbdGroup className="ml-auto pl-4">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>Shift</Kbd>
                  <Kbd>N</Kbd>
                </KbdGroup>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateFile}>
                <FilePlus2 aria-hidden="true" className="size-4 shrink-0" />
                File
                <KbdGroup className="ml-auto pl-4">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>N</Kbd>
                </KbdGroup>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator className="mx-2 h-5" orientation="vertical" />

        <div className="flex items-center gap-2.5">
          <ToolbarTooltip label="Rename">
            <Button
              aria-label="Rename"
              className="size-8 shrink-0"
              disabled={isBusy || !singleSelected}
              onClick={() => {
                if (singleSelected) {
                  onRename(singleSelected);
                }
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="Delete">
            <Button
              aria-label="Delete"
              className="size-8 shrink-0"
              disabled={isBusy || selectedCount === 0}
              onClick={onDeleteSelection}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </ToolbarTooltip>
        </div>

        <Separator className="mx-2 h-5" orientation="vertical" />

        <div className="flex items-center gap-1.5">
          <FileExplorerRootAccessButton
            disabled={isBusy}
            onToggle={onRootAccessToggle}
            rootAccessGranted={rootAccessGranted}
          />
          <ToolbarTooltip label="Import file">
            <Button
              aria-label="Import file"
              className="size-8 shrink-0"
              disabled={isBusy}
              onClick={onImportFile}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <FileUp aria-hidden="true" className="size-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="Import folder">
            <Button
              aria-label="Import folder"
              className="size-8 shrink-0"
              disabled={isBusy}
              onClick={onImportFolder}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <FolderUp aria-hidden="true" className="size-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="Export selected">
            <Button
              aria-label="Export selected"
              className="size-8 shrink-0"
              disabled={isBusy || isPullDisabled || isPushing}
              onClick={onExport}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Download aria-hidden="true" className="size-4" />
            </Button>
          </ToolbarTooltip>
        </div>
      </div>
    </div>
  );
}
