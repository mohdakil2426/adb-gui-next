import { Layers } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { FileExplorerPlaces } from '@/features/file-explorer/ui/FileExplorerPlaces';
import { DirectoryTree } from '@/shared/components/DirectoryTree';
import { Separator } from '@/shared/ui/separator';

interface Props {
  currentPath: string;
  getFileAccessMode: (path: string) => backend.FileAccessMode;
  leftWidth: number;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  selectedSerial: string | null;
  treeRefreshKey: number;
}

export function FileExplorerTreePane(props: Props) {
  const { currentPath, getFileAccessMode, leftWidth, loadFiles, selectedSerial, treeRefreshKey } =
    props;
  const noDevice = selectedSerial === null;

  return (
    <div
      className="flex min-h-0 shrink-0 flex-col overflow-hidden"
      style={{ width: `${leftWidth}px` }}
    >
      <FileExplorerPlaces currentPath={currentPath} disabled={noDevice} onNavigate={loadFiles} />
      <Separator className="mx-2 my-2 shrink-0" />
      <div className="flex shrink-0 items-center gap-1.5 px-3.5 pb-1">
        <Layers aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-caption text-muted-foreground">Device</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <DirectoryTree
          currentPath={currentPath}
          getFileAccessMode={getFileAccessMode}
          key={selectedSerial ?? 'no-device'}
          onNavigate={loadFiles}
          refreshTrigger={treeRefreshKey}
          serial={selectedSerial}
        />
      </div>
    </div>
  );
}
