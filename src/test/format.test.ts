import { describe, expect, it } from 'vitest';
import {
  daysSince,
  EMPTY_VALUE,
  formatBytes,
  formatDisplayDate,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRating,
  formatRelativeDate,
  usageRatio,
} from '@/shared/utils/format';

/** Pinned so assertions do not depend on the host locale. */
const locale = 'en-US';
const KIB = 1024;
const MIB = KIB * 1024;
const GIB = MIB * 1024;
const TIB = GIB * 1024;
const PIB = TIB * 1024;

describe('formatBytes', () => {
  it('formats byte counts below 1 KB without decimals', () => {
    expect(formatBytes(0, { locale })).toBe('0 B');
    expect(formatBytes(1, { locale })).toBe('1 B');
    expect(formatBytes(512, { locale })).toBe('512 B');
    expect(formatBytes(1023, { locale })).toBe('1,023 B');
  });

  it('uses binary units with one decimal above bytes', () => {
    expect(formatBytes(KIB, { locale })).toBe('1.0 KB');
    expect(formatBytes(1536, { locale })).toBe('1.5 KB');
    expect(formatBytes(8 * GIB, { locale })).toBe('8.0 GB');
    expect(formatBytes(50_692_060_774, { locale })).toBe('47.2 GB');
    expect(formatBytes(2 * TIB, { locale })).toBe('2.0 TB');
  });

  it('pins the decimal on exact powers of 1024 so columns keep their width', () => {
    // The bug this module consolidates away: a rival formatter trimmed the
    // trailing zero and rendered these as "1 KB", "8 GB", "1 TB".
    expect(formatBytes(KIB, { locale })).toBe('1.0 KB');
    expect(formatBytes(MIB, { locale })).toBe('1.0 MB');
    expect(formatBytes(GIB, { locale })).toBe('1.0 GB');
    expect(formatBytes(TIB, { locale })).toBe('1.0 TB');
    expect(formatBytes(PIB, { locale })).toBe('1.0 PB');
  });

  it('scales past TB and stops at the largest known unit', () => {
    expect(formatBytes(2 * PIB, { locale })).toBe('2.0 PB');
    expect(formatBytes(1024 * PIB, { locale })).toBe('1,024.0 PB');
  });

  it('carries to the next unit when rounding crosses the boundary', () => {
    expect(formatBytes(MIB - 1, { locale })).toBe('1.0 MB');
    expect(formatBytes(MIB - 1, { fractionDigits: 0, locale })).toBe('1 MB');
  });

  it('honours the requested precision without ever trimming digits', () => {
    expect(formatBytes(8 * GIB, { fractionDigits: 0, locale })).toBe('8 GB');
    expect(formatBytes(8 * GIB, { fractionDigits: 2, locale })).toBe('8.00 GB');
    expect(formatBytes(50_692_060_774, { fractionDigits: 2, locale })).toBe('47.21 GB');
  });

  it('keeps sub-KB counts whole whatever precision is asked for', () => {
    expect(formatBytes(512, { fractionDigits: 2, locale })).toBe('512 B');
    expect(formatBytes(0, { fractionDigits: 2, locale })).toBe('0 B');
  });

  it('returns the empty marker for unusable input', () => {
    expect(formatBytes(Number.NaN, { locale })).toBe(EMPTY_VALUE);
    expect(formatBytes(Number.POSITIVE_INFINITY, { locale })).toBe(EMPTY_VALUE);
    expect(formatBytes(-1, { locale })).toBe(EMPTY_VALUE);
    expect(formatBytes(-GIB, { locale })).toBe(EMPTY_VALUE);
    expect(formatBytes(undefined as unknown as number, { locale })).toBe(EMPTY_VALUE);
    expect(formatBytes(null as unknown as number, { locale })).toBe(EMPTY_VALUE);
  });

  it('absorbs an unparseable size string from `ls` (File Explorer)', () => {
    // FileExplorerRow parses `FileEntry.size` before formatting; a non-numeric
    // column must read as the empty marker, not leak raw text into the table.
    expect(formatBytes(Number.parseInt('', 10), { locale })).toBe(EMPTY_VALUE);
    expect(formatBytes(Number.parseInt('not-a-size', 10), { locale })).toBe(EMPTY_VALUE);
    expect(formatBytes(Number.parseInt('1536', 10), { locale })).toBe('1.5 KB');
  });
});

describe('formatPercent', () => {
  it('formats a fraction as a whole percentage by default', () => {
    expect(formatPercent(0.74, { locale })).toBe('74%');
    expect(formatPercent(0, { locale })).toBe('0%');
    expect(formatPercent(1, { locale })).toBe('100%');
  });

  it('honours the requested precision', () => {
    expect(formatPercent(0.7412, { fractionDigits: 1, locale })).toBe('74.1%');
  });

  it('returns the empty marker for unusable input', () => {
    expect(formatPercent(Number.NaN, { locale })).toBe(EMPTY_VALUE);
  });
});

describe('usageRatio', () => {
  it('divides safely and clamps to 0–1', () => {
    expect(usageRatio(5, 10)).toBe(0.5);
    expect(usageRatio(20, 10)).toBe(1);
    expect(usageRatio(-5, 10)).toBe(0);
  });

  it('returns 0 when the total is missing or unusable', () => {
    expect(usageRatio(5, 0)).toBe(0);
    expect(usageRatio(5, Number.NaN)).toBe(0);
    expect(usageRatio(Number.NaN, 10)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('formats sub-minute uptime in seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats the two most significant units', () => {
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(15_120)).toBe('4h 12m');
    expect(formatDuration(273_600)).toBe('3d 4h');
  });

  it('drops trailing zero units', () => {
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(7200)).toBe('2h');
    expect(formatDuration(172_800)).toBe('2d');
  });

  it('returns the empty marker for unusable input', () => {
    expect(formatDuration(-1)).toBe(EMPTY_VALUE);
    expect(formatDuration(Number.NaN)).toBe(EMPTY_VALUE);
  });
});

describe('daysSince', () => {
  const now = new Date('2026-07-26T12:00:00Z');

  it('counts whole days elapsed', () => {
    expect(daysSince('2026-07-26', { now })).toBe(0);
    expect(daysSince('2026-06-05', { now })).toBe(51);
  });

  it('returns null for an unparseable date', () => {
    expect(daysSince('not-a-date', { now })).toBeNull();
  });
});

describe('formatRelativeDate', () => {
  const now = new Date('2026-07-26T12:00:00Z');

  it('escalates the unit with distance', () => {
    expect(formatRelativeDate('2026-07-26', { locale, now })).toBe('today');
    expect(formatRelativeDate('2026-07-23', { locale, now })).toBe('3 days ago');
    expect(formatRelativeDate('2026-07-05', { locale, now })).toBe('3 weeks ago');
    expect(formatRelativeDate('2026-04-05', { locale, now })).toBe('4 months ago');
    expect(formatRelativeDate('2024-07-05', { locale, now })).toBe('2 years ago');
  });

  it('returns the empty marker for an unparseable date', () => {
    expect(formatRelativeDate('unknown', { locale, now })).toBe(EMPTY_VALUE);
  });
});

describe('formatNumber', () => {
  it('formats with the requested precision', () => {
    expect(formatNumber(32.44, { fractionDigits: 1, locale })).toBe('32.4');
    expect(formatNumber(4102, { locale })).toBe('4,102');
  });

  it('returns the empty marker for unusable input', () => {
    expect(formatNumber(Number.NaN, { locale })).toBe(EMPTY_VALUE);
  });
});

describe('formatRating', () => {
  it('always shows one decimal so ratings line up', () => {
    expect(formatRating(5, { locale })).toBe('5.0');
    expect(formatRating(4.26, { locale })).toBe('4.3');
  });

  it('returns the empty marker for unusable input', () => {
    expect(formatRating(Number.NaN, { locale })).toBe(EMPTY_VALUE);
  });
});

describe('formatDisplayDate', () => {
  it('formats an absolute calendar date', () => {
    // Built from local parts so the assertion holds in any host time zone.
    expect(formatDisplayDate(new Date(2026, 3, 24), { locale })).toBe('Apr 24, 2026');
  });

  it('returns the empty marker for an unparseable date', () => {
    expect(formatDisplayDate('not-a-date', { locale })).toBe(EMPTY_VALUE);
  });
});
