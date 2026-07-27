/**
 * The one grid template for the partition table.
 *
 * `checkbox · name · progress · size`. The header and every row read it, and it
 * does **not** vary with extraction state — the table previously switched from
 * three columns to four the instant Extract was pressed, which reflowed every
 * row under the pointer. The progress column is reserved from the start and
 * renders empty until there is something to show.
 */
export const PARTITION_GRID_COLUMNS = '24px minmax(0, 1fr) minmax(6rem, 1.1fr) 5.5rem';
