import { describe, expect, test } from 'vitest';
import { formatCompactNumber, formatDisplayDate, formatFileSize, formatRating } from '@/lib/utils';

describe('formatting helpers', () => {
  test('formats marketplace display values consistently', () => {
    expect(formatFileSize(1_572_864)).toBe('1.5 MB');
    expect(formatCompactNumber(12_500)).toBe('12.5K');
    expect(formatRating(4.26)).toBe('4.3');
    expect(formatDisplayDate('2026-04-24T00:00:00.000Z')).toMatch(/\b2026\b/);
  });
});
