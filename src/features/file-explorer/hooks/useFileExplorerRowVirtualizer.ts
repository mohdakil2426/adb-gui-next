import { useVirtualizer } from '@tanstack/react-virtual';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

export function useFileExplorerRowVirtualizer(
  visibleList: FileEntry[],
  tableScrollRef: React.RefObject<HTMLDivElement | null>,
) {
  return useVirtualizer({
    count: visibleList.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });
}
