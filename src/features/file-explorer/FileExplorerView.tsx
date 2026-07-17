import { useFileExplorerViewModel } from '@/features/file-explorer/hooks/useFileExplorerViewModel';
import { DeleteDialog } from '@/features/file-explorer/ui/DeleteDialog';
import { FileExplorerMainPane } from '@/features/file-explorer/ui/FileExplorerMainPane';
import { FileExplorerTreeSection } from '@/features/file-explorer/ui/FileExplorerTreeSection';

export function ViewFileExplorer({ activeView }: { activeView: string }) {
  const vm = useFileExplorerViewModel(activeView);

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border"
      ref={vm.containerRef}
    >
      <h1 className="sr-only">File Explorer</h1>
      {vm.isResizing ? <div className="fixed inset-0 z-50 cursor-col-resize select-none" /> : null}
      <FileExplorerTreeSection
        currentPath={vm.currentPath}
        getFileAccessMode={vm.getFileAccessMode}
        handleCollapseTree={vm.handleCollapseTree}
        handleResizeKeyDown={vm.handleResizeKeyDown}
        isResizing={vm.isResizing}
        isTreeCollapsed={vm.isTreeCollapsed}
        leftWidth={vm.leftWidth}
        loadFiles={vm.loadFiles}
        selectedSerial={vm.selectedSerial}
        startResizing={vm.startResizing}
        treeRefreshKey={vm.treeRefreshKey}
      />
      <FileExplorerMainPane
        cancelCreate={vm.cancelCreate}
        clearSelection={vm.clearSelection}
        createError={vm.createError}
        createName={vm.createName}
        creatingType={vm.creatingType}
        currentPath={vm.currentPath}
        display={{
          allSelected: vm.allSelected,
          isMultiSelectMode: vm.isMultiSelectMode,
          someSelected: vm.someSelected,
        }}
        editPathValue={vm.editPathValue}
        fileList={vm.fileList}
        fileTableColumns={vm.fileTableColumns}
        handleBackClick={vm.handleBackClick}
        handleClearSearch={vm.handleClearSearch}
        handleCreateChange={vm.handleCreateChange}
        handleCreateConfirm={vm.handleCreateConfirm}
        handleDeleteFromSelection={vm.handleDeleteFromSelection}
        handleExpandTree={vm.handleExpandTree}
        handleGoBack={vm.handleGoBack}
        handleGoForward={vm.handleGoForward}
        handlePathClick={vm.handlePathClick}
        handlePull={vm.handlePull}
        handlePullItem={vm.handlePullItem}
        handlePushFile={vm.handlePushFile}
        handlePushFileToDir={vm.handlePushFileToDir}
        handlePushFolder={vm.handlePushFolder}
        handleRefreshClick={vm.handleRefreshClick}
        handleRenameCancel={vm.handleRenameCancel}
        handleRenameChange={vm.handleRenameChange}
        handleRenameConfirm={vm.handleRenameConfirm}
        handleRowClick={vm.handleRowClick}
        handleRowDoubleClick={vm.handleRowDoubleClick}
        handleSelectAll={vm.handleSelectAll}
        handleSelectFromMenu={vm.handleSelectFromMenu}
        handleSortColumn={vm.handleSortColumn}
        isTreeCollapsed={vm.isTreeCollapsed}
        loadError={vm.loadError}
        loadFiles={vm.loadFiles}
        navigation={{ canGoBack: vm.canGoBack, canGoForward: vm.canGoForward }}
        onRootAccessToggle={vm.handleRootAccessToggle}
        openDeleteDialog={vm.openDeleteDialog}
        PHANTOM_ROW_HEIGHT={vm.PHANTOM_ROW_HEIGHT}
        permissions={{ rootAccessGranted: vm.rootAccessGranted }}
        phantomOffset={vm.phantomOffset}
        renameError={vm.renameError}
        renameValue={vm.renameValue}
        renamingName={vm.renamingName}
        rowVirtualizer={vm.rowVirtualizer}
        searchQuery={vm.searchQuery}
        selectedNames={vm.selectedNames}
        setEditPathValue={vm.setEditPathValue}
        setIsEditingPath={vm.setIsEditingPath}
        setSearchQuery={vm.setSearchQuery}
        sortDir={vm.sortDir}
        sortField={vm.sortField}
        startCreate={vm.startCreate}
        startRename={vm.startRename}
        state={{
          isBusy: vm.isBusy,
          isCreating: vm.isCreating,
          isEditingPath: vm.isEditingPath,
          isLoading: vm.isLoading,
          isPullDisabled: vm.isPullDisabled,
          isPushing: vm.isPushing,
        }}
        tableScrollRef={vm.tableScrollRef}
        toggleCheckbox={vm.toggleCheckbox}
        visibleList={vm.visibleList}
      />
      <DeleteDialog
        fileList={vm.fileList}
        filesToDelete={vm.filesToDelete}
        isDeleting={vm.isDeleting}
        onConfirm={vm.handleConfirmDelete}
        onOpenChange={vm.setDeleteDialogOpen}
        open={vm.deleteDialogOpen}
      />
    </div>
  );
}
