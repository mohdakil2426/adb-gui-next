import {
  MAX_LEFT_WIDTH,
  MIN_LEFT_WIDTH,
} from '@/features/file-explorer/model/fileExplorerConstants';
import { cn } from '@/shared/utils/cn';

interface Props {
  isResizing: boolean;
  leftWidth: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
}

export function FileExplorerTreeResizeHandle({
  isResizing,
  leftWidth,
  onKeyDown,
  onPointerDown,
}: Props) {
  return (
    <div
      aria-label="Resize tree panel"
      aria-orientation="vertical"
      aria-valuemax={MAX_LEFT_WIDTH}
      aria-valuemin={MIN_LEFT_WIDTH}
      aria-valuenow={leftWidth}
      className={cn(
        'group relative z-10 flex w-3 shrink-0 cursor-col-resize justify-center outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0',
        isResizing && 'select-none',
      )}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      role="separator"
      tabIndex={0}
    >
      <div
        className={cn(
          'h-full w-px bg-border transition-colors group-hover:bg-primary/60 group-active:bg-primary',
          isResizing && 'bg-primary',
        )}
      />
    </div>
  );
}
