import { useFileExplorerViewModel } from '@/features/file-explorer/hooks/useFileExplorerViewModel';
import { DeleteDialog } from '@/features/file-explorer/ui/DeleteDialog';
import { FileExplorerMainPane } from '@/features/file-explorer/ui/FileExplorerMainPane';
import { FileExplorerTreeSection } from '@/features/file-explorer/ui/FileExplorerTreeSection';

export function ViewFileExplorer({ activeView }: { activeView: string }) {
  const vm = useFileExplorerViewModel(activeView);

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-surface"
      ref={vm.containerRef}
    >
      <h1 className="sr-only">File Explorer</h1>
      {vm.tree.isResizing ? (
        <div className="fixed inset-0 z-(--z-drawer) cursor-col-resize select-none" />
      ) : null}
      <FileExplorerTreeSection tree={vm.tree} />
      <FileExplorerMainPane
        actions={vm.actions}
        editing={vm.editing}
        isTreeCollapsed={vm.tree.isTreeCollapsed}
        listing={vm.listing}
        navigation={vm.navigation}
        rootAccessGranted={vm.rootAccessGranted}
        selection={vm.selection}
        status={vm.status}
        tableScrollRef={vm.tableScrollRef}
      />
      <DeleteDialog {...vm.deleteDialog} />
    </div>
  );
}
