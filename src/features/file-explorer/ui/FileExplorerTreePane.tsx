import { Layers, PanelLeftClose } from 'lucide-react';
import type { ReactElement } from 'react';
import { DirectoryTree } from '@/shared/components/DirectoryTree';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

function ToolbarTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface Props {
  currentPath: string;
  handleCollapseTree: () => void;
  leftWidth: number;
  loadFiles: (targetPath: string, pushToHistory?: boolean) => Promise<void>;
  selectedSerial: string | null;
  treeRefreshKey: number;
}

export function FileExplorerTreePane(props: Props) {
  const { currentPath, handleCollapseTree, leftWidth, loadFiles, selectedSerial, treeRefreshKey } =
    props;
  return (
    <div className="flex shrink-0 flex-col overflow-hidden" style={{ width: `${leftWidth}px` }}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-border border-b bg-muted/30 px-3">
        <Layers className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 font-medium text-muted-foreground text-sm">Device</span>
        <ToolbarTooltip label="Collapse tree panel">
          <Button
            className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleCollapseTree}
            size="icon"
            variant="ghost"
          >
            <PanelLeftClose className="size-3.5" />
          </Button>
        </ToolbarTooltip>
      </div>
      <div className="flex-1 overflow-hidden">
        <DirectoryTree
          currentPath={currentPath}
          key={selectedSerial ?? 'no-device'}
          onNavigate={loadFiles}
          refreshTrigger={treeRefreshKey}
          serial={selectedSerial}
        />
      </div>
    </div>
  );
}
