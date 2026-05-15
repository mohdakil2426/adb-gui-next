import type { backend } from '@/desktop/models';
import { FileExplorerTreePane } from '@/features/file-explorer/ui/FileExplorerTreePane';
import { FileExplorerTreeResizeHandle } from '@/features/file-explorer/ui/FileExplorerTreeResizeHandle';

interface Props {
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

export function FileExplorerTreeSection({
  currentPath,
  getFileAccessMode,
  handleCollapseTree,
  handleResizeKeyDown,
  isResizing,
  isTreeCollapsed,
  leftWidth,
  loadFiles,
  selectedSerial,
  startResizing,
  treeRefreshKey,
}: Props) {
  if (isTreeCollapsed) {
    return null;
  }

  return (
    <>
      <FileExplorerTreePane
        currentPath={currentPath}
        getFileAccessMode={getFileAccessMode}
        handleCollapseTree={handleCollapseTree}
        leftWidth={leftWidth}
        loadFiles={loadFiles}
        selectedSerial={selectedSerial}
        treeRefreshKey={treeRefreshKey}
      />
      <FileExplorerTreeResizeHandle
        isResizing={isResizing}
        leftWidth={leftWidth}
        onKeyDown={handleResizeKeyDown}
        onPointerDown={startResizing}
      />
    </>
  );
}
