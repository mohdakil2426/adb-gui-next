import { useVirtualizer } from '@tanstack/react-virtual';
import { FILE_ROW_HEIGHT } from '@/features/file-explorer/model/fileExplorerConstants';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

export function useFileExplorerRowVirtualizer(
  visibleList: FileEntry[],
  tableScrollRef: React.RefObject<HTMLDivElement | null>,
) {
  return useVirtualizer({
    count: visibleList.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => FILE_ROW_HEIGHT,
    overscan: 10,
  });
}
