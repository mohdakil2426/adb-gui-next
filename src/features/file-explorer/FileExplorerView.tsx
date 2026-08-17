import { useFileExplorerViewModel } from '@/features/file-explorer/hooks/useFileExplorerViewModel';
import { DeleteDialog } from '@/features/file-explorer/ui/DeleteDialog';
import { FileExplorerMainPane } from '@/features/file-explorer/ui/FileExplorerMainPane';
import { FileExplorerOverwriteDialog } from '@/features/file-explorer/ui/FileExplorerOverwriteDialog';
import { FileExplorerToolbar } from '@/features/file-explorer/ui/FileExplorerToolbar';
import { FileExplorerTreeSection } from '@/features/file-explorer/ui/FileExplorerTreeSection';

export function ViewFileExplorer({ activeView }: { activeView: string }) {
  const vm = useFileExplorerViewModel(activeView);

  return (
    <div
      className="@container flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface"
      ref={vm.containerRef}
    >
      <h1 className="sr-only">File Explorer</h1>
      <FileExplorerToolbar
        canGoBack={vm.navigation.canGoBack}
        canGoForward={vm.navigation.canGoForward}
        currentPath={vm.listing.currentPath}
        editPathValue={vm.status.editPathValue}
        isBusy={vm.status.isBusy}
        isEditingPath={vm.status.isEditingPath}
        isLoading={vm.status.isLoading}
        isPullDisabled={vm.status.isPullDisabled}
        isPushing={vm.status.isPushing}
        isTreeCollapsed={vm.tree.isTreeCollapsed}
        onBack={vm.actions.handleGoBack}
        onClearSearch={vm.actions.handleClearSearch}
        onCollapseTree={vm.actions.handleCollapseTree}
        onCreateFile={vm.actions.startCreateFile}
        onCreateFolder={vm.actions.startCreateFolder}
        onDeleteSelection={vm.actions.handleDeleteFromSelection}
        onExpandTree={vm.actions.handleExpandTree}
        onExport={vm.actions.handlePull}
        onForward={vm.actions.handleGoForward}
        onGoUp={vm.actions.handleNavigateUp}
        onImportFile={vm.actions.handlePushFile}
        onImportFolder={vm.actions.handlePushFolder}
        onNavigate={vm.actions.loadFiles}
        onPathClick={vm.actions.handlePathClick}
        onPathEditingChange={vm.actions.setEditPathValue}
        onPathEditingCommit={vm.actions.handlePathEditCommit}
        onPathEditingStop={vm.actions.stopPathEditing}
        onRefresh={vm.actions.handleRefreshClick}
        onRename={vm.actions.startRename}
        onRootAccessToggle={vm.actions.handleRootAccessToggle}
        onSearchQueryChange={vm.actions.setSearchQuery}
        rootAccessGranted={vm.rootAccessGranted}
        searchQuery={vm.listing.searchQuery}
        selectedCount={vm.selection.selectedNames.size}
        singleSelected={vm.selection.singleSelected}
      />
      {vm.tree.isResizing ? (
        <div className="fixed inset-0 z-(--z-drawer) cursor-col-resize select-none" />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <FileExplorerTreeSection tree={vm.tree} />
        <FileExplorerMainPane
          actions={vm.actions}
          editing={vm.editing}
          listing={vm.listing}
          rootAccessGranted={vm.rootAccessGranted}
          selection={vm.selection}
          status={vm.status}
          tableScrollRef={vm.tableScrollRef}
        />
      </div>
      <DeleteDialog {...vm.deleteDialog} />
      <FileExplorerOverwriteDialog {...vm.overwriteDialog} />
    </div>
  );
}
