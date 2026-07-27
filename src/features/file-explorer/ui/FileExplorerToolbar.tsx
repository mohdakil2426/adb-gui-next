import { ArrowLeft, ArrowRight, ArrowUp, PanelLeft, Search, X } from 'lucide-react';
import { FileExplorerMoreActionsMenu } from '@/features/file-explorer/ui/FileExplorerMoreActionsMenu';
import { FileExplorerPathBar } from '@/features/file-explorer/ui/FileExplorerPathBar';
import { FileExplorerRootAccessButton } from '@/features/file-explorer/ui/FileExplorerRootAccessButton';
import { FileExplorerTransferButton } from '@/features/file-explorer/ui/FileExplorerTransferButton';
import { ToolbarTooltip } from '@/features/file-explorer/ui/ToolbarTooltip';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
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
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onExpandTree: () => void;
  onExport: () => void;
  /** History forward — the mirror of `onBack`. */
  onForward: () => void;
  /** One level up the current path. Unrelated to history. */
  onGoUp: () => void;
  onImportFile: () => void;
  onImportFolder: () => void;
  onNavigate: (targetPath: string) => void;
  onPathClick: () => void;
  onPathEditingChange: (value: string) => void;
  onPathEditingCommit: () => void;
  onPathEditingStop: () => void;
  onRefresh: () => void;
  onRootAccessToggle: () => Promise<void>;
  onSearchQueryChange: (value: string) => void;
  rootAccessGranted: boolean;
  searchQuery: string;
}

/**
 * Single 44px toolbar row on the unified control scale.
 *
 * Every control here was 44px square — the largest icon button in the app, in
 * the one view that needs the most of them — while the filter input was 28px
 * tall and 112px wide, the narrowest. Both now sit on the 32px / h-8 scale the
 * header and Dashboard use.
 */
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
    onForward,
    onGoUp,
    onImportFile,
    onImportFolder,
    onNavigate,
    onPathClick,
    onPathEditingChange,
    onPathEditingCommit,
    onPathEditingStop,
    onRefresh,
    onRootAccessToggle,
    onSearchQueryChange,
    rootAccessGranted,
    searchQuery,
  } = props;

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 overflow-hidden border-border border-b bg-surface px-2">
      {isTreeCollapsed ? (
        <>
          <ToolbarTooltip label="Show tree panel">
            <Button
              aria-label="Show tree panel"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onExpandTree}
              size="icon-sm"
              variant="ghost"
            >
              <PanelLeft aria-hidden="true" className="size-4" />
            </Button>
          </ToolbarTooltip>
          <Separator className="mx-0.5 h-4" orientation="vertical" />
        </>
      ) : null}

      <div className="flex shrink-0 items-center gap-0.5">
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
      </div>

      <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />

      <FileExplorerPathBar
        currentPath={currentPath}
        editPathValue={editPathValue}
        isEditingPath={isEditingPath}
        onNavigate={onNavigate}
        onPathClick={onPathClick}
        onPathEditingChange={onPathEditingChange}
        onPathEditingCommit={onPathEditingCommit}
        onPathEditingStop={onPathEditingStop}
      />

      <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />

      <div className="flex min-w-0 shrink-0 items-center gap-0.5">
        <RefreshButton
          aria-label="Refresh directory"
          isLoading={isLoading}
          mode="icon"
          onClick={onRefresh}
          tooltip="Refresh (F5)"
        />
        <FileExplorerRootAccessButton
          disabled={isBusy}
          onToggle={onRootAccessToggle}
          rootAccessGranted={rootAccessGranted}
        />
        <Separator className="mx-0.5 h-4 shrink-0" orientation="vertical" />
        <div className="relative flex items-center">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2 size-3.5 shrink-0 text-muted-foreground"
          />
          <Input
            aria-label="Filter files"
            className="h-8 @md:w-44 w-36 pr-7 pl-7 text-body transition-[width] duration-200 ease-standard @md:focus-visible:w-64 focus-visible:w-52"
            id="fe-search-input"
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Filter…"
            value={searchQuery}
          />
          {searchQuery ? (
            <Button
              aria-label="Clear filter"
              className="absolute right-1 size-6 text-muted-foreground hover:text-foreground"
              onClick={onClearSearch}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          ) : null}
        </div>
        <FileExplorerTransferButton
          disabled={isBusy}
          isPullDisabled={isPullDisabled}
          isPushing={isPushing}
          onExport={onExport}
          onImportFile={onImportFile}
          onImportFolder={onImportFolder}
        />
        <FileExplorerMoreActionsMenu
          disabled={isBusy}
          isPullDisabled={isPullDisabled}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onExport={onExport}
        />
      </div>
    </div>
  );
}
