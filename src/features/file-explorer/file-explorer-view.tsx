import { useFileExplorerViewModel } from "@/features/file-explorer/hooks/use-file-explorer-view-model";
import { DeleteDialog } from "@/features/file-explorer/ui/delete-dialog";
import { FileExplorerMainPane } from "@/features/file-explorer/ui/file-explorer-main-pane";
import { FileExplorerOverwriteDialog } from "@/features/file-explorer/ui/file-explorer-overwrite-dialog";
import { FileExplorerToolbar } from "@/features/file-explorer/ui/file-explorer-toolbar";
import { FileExplorerTreeSection } from "@/features/file-explorer/ui/file-explorer-tree-section";

export const ViewFileExplorer = ({ activeView }: { activeView: string }) => {
  const vm = useFileExplorerViewModel(activeView);
  const { containerRef } = vm;
  const handleCreateFile = vm.actions.startCreateFile;
  const handleCreateFolder = vm.actions.startCreateFolder;
  const handleNavigate = vm.actions.loadFiles;
  const handlePathEditingChange = vm.actions.setEditPathValue;
  const handlePathEditingStop = vm.actions.stopPathEditing;
  const handleRename = vm.actions.startRename;
  const handleSearchQueryChange = vm.actions.setSearchQuery;
  return (
    <div
      className="border-border bg-surface @container flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
      ref={containerRef}
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
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onDeleteSelection={vm.actions.handleDeleteFromSelection}
        onExpandTree={vm.actions.handleExpandTree}
        onExport={vm.actions.handlePull}
        onForward={vm.actions.handleGoForward}
        onGoUp={vm.actions.handleNavigateUp}
        onImportFile={vm.actions.handlePushFile}
        onImportFolder={vm.actions.handlePushFolder}
        onMoveToFolder={vm.actions.handleMoveToFolder}
        onNavigate={handleNavigate}
        onPathClick={vm.actions.handlePathClick}
        onPathEditingChange={handlePathEditingChange}
        onPathEditingCommit={vm.actions.handlePathEditCommit}
        onPathEditingStop={handlePathEditingStop}
        onRefresh={vm.actions.handleRefreshClick}
        onRename={handleRename}
        onRootAccessToggle={vm.actions.handleRootAccessToggle}
        onSearchQueryChange={handleSearchQueryChange}
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
};
