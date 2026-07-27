import { memo } from 'react';
import type { backend } from '@/desktop/models';
import { FileExplorerTreePane } from '@/features/file-explorer/ui/FileExplorerTreePane';
import { FileExplorerTreeResizeHandle } from '@/features/file-explorer/ui/FileExplorerTreeResizeHandle';

export interface FileExplorerTreeConfig {
  currentPath: string;
  getFileAccessMode: (path: string) => backend.FileAccessMode;
  handleCollapseTree: () => void;
  handleResizeKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  isResizing: boolean;
  isTreeCollapsed: boolean;
  leftWidth: number;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  selectedSerial: string | null;
  startResizing: (e: React.PointerEvent<HTMLElement>) => void;
  treeRefreshKey: number;
}

/** Memoized: the directory tree must not re-render for file-list or
 *  selection state, only for its own slice. */
export const FileExplorerTreeSection = memo(function FileExplorerTreeSection({
  tree,
}: {
  tree: FileExplorerTreeConfig;
}) {
  if (tree.isTreeCollapsed) {
    return null;
  }

  return (
    <>
      <FileExplorerTreePane
        currentPath={tree.currentPath}
        getFileAccessMode={tree.getFileAccessMode}
        handleCollapseTree={tree.handleCollapseTree}
        leftWidth={tree.leftWidth}
        loadFiles={tree.loadFiles}
        selectedSerial={tree.selectedSerial}
        treeRefreshKey={tree.treeRefreshKey}
      />
      <FileExplorerTreeResizeHandle
        isResizing={tree.isResizing}
        leftWidth={tree.leftWidth}
        onKeyDown={tree.handleResizeKeyDown}
        onPointerDown={tree.startResizing}
      />
    </>
  );
});
