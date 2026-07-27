export const MIN_LEFT_WIDTH = 220;
export const MAX_LEFT_WIDTH = 520;
export const DEFAULT_LEFT_WIDTH = 280;
export const FORBIDDEN_CHARS = /[/\\:*?"<>|]/;
export const RESERVED_NAMES = /^\.{1,2}$/;
export const MAX_HISTORY = 50;
export const RESPONSIVE_COLLAPSE_WIDTH = 1024;
export const PHANTOM_ROW_HEIGHT = 36;

/**
 * Fixed row height — the virtualizer's `estimateSize` and the loading skeleton
 * both read it, so the skeleton occupies exactly the space the real rows will.
 * 36px is the "relaxed" step of the 4px control ladder.
 */
export const FILE_ROW_HEIGHT = 36;

/**
 * `icon · name · size · modified`.
 *
 * Date and time used to be two columns with two headers ("date" sortable,
 * "Time" not) describing one timestamp. They are now one `Modified` column,
 * sorted by the existing `date` field, which already compares `date + time`.
 */
export const FILE_TABLE_COLUMNS = '36px minmax(14rem, 1fr) 7rem 11rem';
export const FILE_TABLE_COLUMNS_WITH_SELECTION = '36px 36px minmax(14rem, 1fr) 7rem 11rem';

/** Cell count per row, used for the `colSpan` of full-width table messages. */
export const FILE_TABLE_CELL_COUNT = 4;
export const FILE_TABLE_CELL_COUNT_WITH_SELECTION = 5;
