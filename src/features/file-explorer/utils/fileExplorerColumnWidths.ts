export type FileColumnId = 'name' | 'date' | 'type' | 'size';

export interface FileColumnWidths {
  date: number;
  name: number;
  size: number;
  type: number;
}

/** Compact Details defaults — leftover space sits after Size, not inside Name. */
export const FILE_COL_NAME_DEFAULT = 240;
export const FILE_COL_DATE_DEFAULT = 144;
export const FILE_COL_TYPE_DEFAULT = 88;
export const FILE_COL_SIZE_DEFAULT = 72;

export const FILE_COL_NAME_MIN = 140;
export const FILE_COL_DATE_MIN = 112;
export const FILE_COL_TYPE_MIN = 64;
export const FILE_COL_SIZE_MIN = 56;

export const FILE_COL_NAME_MAX = 720;
export const FILE_COL_META_MAX = 360;

const MIN: Record<FileColumnId, number> = {
  date: FILE_COL_DATE_MIN,
  name: FILE_COL_NAME_MIN,
  size: FILE_COL_SIZE_MIN,
  type: FILE_COL_TYPE_MIN,
};

const MAX: Record<FileColumnId, number> = {
  date: FILE_COL_META_MAX,
  name: FILE_COL_NAME_MAX,
  size: FILE_COL_META_MAX,
  type: FILE_COL_META_MAX,
};

export const DEFAULT_FILE_COLUMN_WIDTHS: FileColumnWidths = {
  date: FILE_COL_DATE_DEFAULT,
  name: FILE_COL_NAME_DEFAULT,
  size: FILE_COL_SIZE_DEFAULT,
  type: FILE_COL_TYPE_DEFAULT,
};

export function clampColumn(id: FileColumnId, value: number): number {
  return Math.min(MAX[id], Math.max(MIN[id], Math.round(value)));
}

export function applyColumnDelta(
  widths: FileColumnWidths,
  id: FileColumnId,
  dx: number,
): FileColumnWidths {
  return { ...widths, [id]: clampColumn(id, widths[id] + dx) };
}

/** Pixel tracks plus a trailing `1fr` so extra pane width does not inflate Name. */
export function fileTableTemplate(widths: FileColumnWidths): string {
  return `${widths.name}px ${widths.date}px ${widths.type}px ${widths.size}px minmax(0, 1fr)`;
}
