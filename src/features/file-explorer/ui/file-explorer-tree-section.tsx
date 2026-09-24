import { memo } from "react";

import type { backend } from "@/desktop/models";
import { FileExplorerTreePane } from "@/features/file-explorer/ui/file-explorer-tree-pane";
import { FileExplorerTreeResizeHandle } from "@/features/file-explorer/ui/file-explorer-tree-resize-handle";

export interface FileExplorerTreeConfig {
  currentPath: string;
  getFileAccessMode: (path: string) => backend.FileAccessMode;
  handleResizeKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  isResizing: boolean;
  isTreeCollapsed: boolean;
  leftWidth: number;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  onMoveToFolder: (destDir: string, names: Iterable<string>) => Promise<void>;
  selectedSerial: string | null;
  startResizing: (e: React.PointerEvent<HTMLElement>) => void;
  treeRefreshKey: number;
}

/** Memoized: the directory tree must not re-render for file-list or
 *  selection state, only for its own slice. */
const FileExplorerTreeSectionImpl = ({ tree }: { tree: FileExplorerTreeConfig }) => {
  if (tree.isTreeCollapsed) {
    return null;
  }

  const handleMoveToFolder = tree.onMoveToFolder;
  const handlePointerDown = tree.startResizing;

  return (
    <>
      <FileExplorerTreePane
        currentPath={tree.currentPath}
        getFileAccessMode={tree.getFileAccessMode}
        leftWidth={tree.leftWidth}
        loadFiles={tree.loadFiles}
        onMoveToFolder={handleMoveToFolder}
        selectedSerial={tree.selectedSerial}
        treeRefreshKey={tree.treeRefreshKey}
      />
      <FileExplorerTreeResizeHandle
        isResizing={tree.isResizing}
        leftWidth={tree.leftWidth}
        onKeyDown={tree.handleResizeKeyDown}
        onPointerDown={handlePointerDown}
      />
    </>
  );
};

export const FileExplorerTreeSection = memo(FileExplorerTreeSectionImpl);
