import * as TV from "@tanstack/react-virtual";

import { FILE_ROW_HEIGHT } from "@/features/file-explorer/model/file-explorer-constants";
import type { FileEntry } from "@/features/file-explorer/model/file-explorer-types";

const { useVirtualizer: useVirt } = TV;

export const useFileExplorerRowVirtualizer = (
  visibleList: FileEntry[],
  tableScrollRef: React.RefObject<HTMLDivElement | null>
) =>
  useVirt({
    count: visibleList.length,
    estimateSize: () => FILE_ROW_HEIGHT,
    getScrollElement: () => tableScrollRef.current,
    overscan: 10,
  });
