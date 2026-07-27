import { Trash2 } from 'lucide-react';
import { memo } from 'react';
import type {
  FileExplorerActions,
  FileExplorerEditing,
  FileExplorerListing,
  FileExplorerNavigation,
  FileExplorerSelection,
  FileExplorerStatus,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { FileExplorerTablePane } from '@/features/file-explorer/ui/FileExplorerTablePane';
import { FileExplorerToolbar } from '@/features/file-explorer/ui/FileExplorerToolbar';
import { SelectionSummaryBar } from '@/shared/components/SelectionSummaryBar';
import { Button } from '@/shared/ui/button';

interface Props {
  actions: FileExplorerActions;
  editing: FileExplorerEditing;
  isTreeCollapsed: boolean;
  listing: FileExplorerListing;
  navigation: FileExplorerNavigation;
  rootAccessGranted: boolean;
  selection: FileExplorerSelection;
  status: FileExplorerStatus;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
}

export const FileExplorerMainPane = memo(function FileExplorerMainPane({
  actions,
  editing,
  isTreeCollapsed,
  listing,
  navigation,
  rootAccessGranted,
  selection,
  status,
  tableScrollRef,
}: Props) {
  const selectedCount = selection.selectedNames.size;

  return (
    <div className="@container flex min-w-0 flex-1 flex-col overflow-hidden">
      <FileExplorerToolbar
        canGoBack={navigation.canGoBack}
        canGoForward={navigation.canGoForward}
        currentPath={listing.currentPath}
        editPathValue={status.editPathValue}
        isBusy={status.isBusy}
        isEditingPath={status.isEditingPath}
        isLoading={status.isLoading}
        isPullDisabled={status.isPullDisabled}
        isPushing={status.isPushing}
        isTreeCollapsed={isTreeCollapsed}
        onBack={actions.handleGoBack}
        onClearSearch={actions.handleClearSearch}
        onCreateFile={actions.startCreateFile}
        onCreateFolder={actions.startCreateFolder}
        onExpandTree={actions.handleExpandTree}
        onExport={actions.handlePull}
        onForward={actions.handleGoForward}
        onGoUp={actions.handleNavigateUp}
        onImportFile={actions.handlePushFile}
        onImportFolder={actions.handlePushFolder}
        onNavigate={actions.loadFiles}
        onPathClick={actions.handlePathClick}
        onPathEditingChange={actions.setEditPathValue}
        onPathEditingCommit={actions.handlePathEditCommit}
        onPathEditingStop={actions.stopPathEditing}
        onRefresh={actions.handleRefreshClick}
        onRootAccessToggle={actions.handleRootAccessToggle}
        onSearchQueryChange={actions.setSearchQuery}
        rootAccessGranted={rootAccessGranted}
        searchQuery={listing.searchQuery}
      />
      {selection.isMultiSelectMode && selectedCount > 0 && !editing.renamingName ? (
        <SelectionSummaryBar
          actions={
            <Button
              disabled={status.isBusy}
              onClick={actions.handleDeleteFromSelection}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="@sm:inline hidden">Delete</span>
            </Button>
          }
          count={selectedCount}
          disabled={status.isBusy}
          label={selectedCount === 1 ? 'item selected' : 'items selected'}
          onClear={actions.clearSelection}
        />
      ) : null}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="pointer-events-none absolute -m-px h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
      >
        {selectedCount > 0 ? `${selectedCount} item${selectedCount > 1 ? 's' : ''} selected` : null}
      </div>
      <FileExplorerTablePane
        actions={actions}
        editing={editing}
        listing={listing}
        rootAccessGranted={rootAccessGranted}
        selection={selection}
        status={status}
        tableScrollRef={tableScrollRef}
      />
    </div>
  );
});
