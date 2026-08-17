import {
  DEFAULT_FILE_COLUMN_WIDTHS,
  fileTableTemplate,
} from '@/features/file-explorer/utils/fileExplorerColumnWidths';

export const MIN_LEFT_WIDTH = 220;
export const MAX_LEFT_WIDTH = 520;
export const DEFAULT_LEFT_WIDTH = 280;
export const FORBIDDEN_CHARS = /[/\\:*?"<>|]/;
export const RESERVED_NAMES = /^\.{1,2}$/;
export const MAX_HISTORY = 50;
export const RESPONSIVE_COLLAPSE_WIDTH = 1024;
export const PHANTOM_ROW_HEIGHT = 40;

/**
 * Fixed row height — the virtualizer's `estimateSize` and the loading skeleton
 * both read it, so the skeleton occupies exactly the space the real rows will.
 */
export const FILE_ROW_HEIGHT = 40;

export const FILE_TABLE_COLUMNS = fileTableTemplate(DEFAULT_FILE_COLUMN_WIDTHS);

/** Cell count per row, used for the `colSpan` of full-width table messages. */
export const FILE_TABLE_CELL_COUNT = 4;
