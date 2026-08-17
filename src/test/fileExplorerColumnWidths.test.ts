import { describe, expect, it } from 'vitest';
import {
  applyColumnDelta,
  DEFAULT_FILE_COLUMN_WIDTHS,
  FILE_COL_DATE_DEFAULT,
  FILE_COL_NAME_DEFAULT,
  FILE_COL_NAME_MIN,
  fileTableTemplate,
} from '@/features/file-explorer/utils/fileExplorerColumnWidths';

describe('fileExplorerColumnWidths', () => {
  it('resizes only the dragged column', () => {
    const next = applyColumnDelta(DEFAULT_FILE_COLUMN_WIDTHS, 'name', 40);

    expect(next.name).toBe(FILE_COL_NAME_DEFAULT + 40);
    expect(next.date).toBe(FILE_COL_DATE_DEFAULT);
    expect(next.type).toBe(DEFAULT_FILE_COLUMN_WIDTHS.type);
    expect(next.size).toBe(DEFAULT_FILE_COLUMN_WIDTHS.size);
  });

  it('does not steal width from Date when Name grows', () => {
    const widerName = applyColumnDelta(DEFAULT_FILE_COLUMN_WIDTHS, 'name', 80);
    const template = fileTableTemplate(widerName);

    expect(template.startsWith(`${FILE_COL_NAME_DEFAULT + 80}px ${FILE_COL_DATE_DEFAULT}px`)).toBe(
      true,
    );
    expect(template.endsWith('minmax(0, 1fr)')).toBe(true);
  });

  it('clamps a column at its minimum', () => {
    const next = applyColumnDelta(DEFAULT_FILE_COLUMN_WIDTHS, 'name', -1000);
    expect(next.name).toBe(FILE_COL_NAME_MIN);
  });
});
