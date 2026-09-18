import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyColumnDelta,
  clampColumn,
  DEFAULT_FILE_COLUMN_WIDTHS,
  fileTableTemplate,
} from "@/features/file-explorer/utils/file-explorer-column-widths";
import type {
  FileColumnId,
  FileColumnWidths,
} from "@/features/file-explorer/utils/file-explorer-column-widths";

const STORAGE_KEY = "fe.colWidths.v2";

const readStored = (): FileColumnWidths => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_FILE_COLUMN_WIDTHS;
    }
    const parsed = JSON.parse(raw) as Partial<FileColumnWidths>;
    return {
      date: clampColumn("date", Number(parsed.date) || DEFAULT_FILE_COLUMN_WIDTHS.date),
      name: clampColumn("name", Number(parsed.name) || DEFAULT_FILE_COLUMN_WIDTHS.name),
      size: clampColumn("size", Number(parsed.size) || DEFAULT_FILE_COLUMN_WIDTHS.size),
      type: clampColumn("type", Number(parsed.type) || DEFAULT_FILE_COLUMN_WIDTHS.type),
    };
  } catch {
    return DEFAULT_FILE_COLUMN_WIDTHS;
  }
};

export const useFileExplorerColumnWidths = () => {
  const [widths, setWidths] = useState<FileColumnWidths>(readStored);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  }, [widths]);

  const resizeColumn = useCallback((id: FileColumnId, dx: number) => {
    setWidths((prev) => applyColumnDelta(prev, id, dx));
  }, []);

  const fileTableColumns = useMemo(() => fileTableTemplate(widths), [widths]);

  return { fileTableColumns, resizeColumn };
};
