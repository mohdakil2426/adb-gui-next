/**
 * Display formatters — the **only** place raw backend values become on-screen
 * text.
 *
 * The backend returns numbers and ISO strings; turning them into readable text
 * is a frontend concern, and it must be done in exactly one place so a byte
 * count reads the same in the Dashboard, the File Explorer, the Payload Dumper
 * and a tooltip. A second module (`formatting.ts`) once shadowed this one with
 * a rival `formatBytes`, and `8 GiB` rendered as `8.0 GB` on one screen and
 * `8 GB` on another. Do not reintroduce a local byte formatter — add an option
 * here instead.
 *
 * Every formatter is total: unusable input yields {@link EMPTY_VALUE} rather
 * than `NaN`, `Infinity` or an empty cell.
 *
 * `Intl` instances are cached — constructing one costs far more than formatting
 * with it, and these run on every telemetry poll.
 */

/** Rendered wherever the device reported nothing. Never leave a value blank. */
export const EMPTY_VALUE = '—';

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;
/** Binary, like `df` and Android itself. 1 KB here is 1024 bytes. */
const BYTES_PER_UNIT = 1024;
const LAST_BYTE_UNIT = BYTE_UNITS.length - 1;
const DEFAULT_BYTE_FRACTION_DIGITS = 1;

const RATING_FRACTION_DIGITS = 1;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const MS_PER_DAY = 86_400_000;

const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export interface LocaleOptions {
  /** Defaults to the host locale. Tests pass an explicit locale for stability. */
  locale?: string | undefined;
}

export interface NumberFormatOptions extends LocaleOptions {
  fractionDigits?: number | undefined;
}

export interface ByteFormatOptions extends LocaleOptions {
  /**
   * Digits after the decimal point for units above `B`. Defaults to
   * {@link DEFAULT_BYTE_FRACTION_DIGITS}.
   *
   * The digit count is *fixed*, never trimmed: `8.0 GB` and `47.2 GB` occupy
   * the same shape, so a numeric column does not change width as values update.
   * Raise it only where a reading is genuinely finer-grained than the column
   * next to it — a metadata readout, not a table.
   *
   * Counts below 1 KB are always whole; a fraction of a byte means nothing.
   */
  fractionDigits?: number | undefined;
}

const numberFormatters = new Map<string, Intl.NumberFormat>();
const percentFormatters = new Map<string, Intl.NumberFormat>();
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();
const displayDateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(locale: string | undefined, fractionDigits: number): Intl.NumberFormat {
  const key = `${locale ?? ''}|${fractionDigits}`;
  const cached = numberFormatters.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  numberFormatters.set(key, formatter);
  return formatter;
}

function percentFormatter(locale: string | undefined, fractionDigits: number): Intl.NumberFormat {
  const key = `${locale ?? ''}|${fractionDigits}`;
  const cached = percentFormatters.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  percentFormatters.set(key, formatter);
  return formatter;
}

function displayDateFormatter(locale: string | undefined): Intl.DateTimeFormat {
  const key = locale ?? '';
  const cached = displayDateFormatters.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  displayDateFormatters.set(key, formatter);
  return formatter;
}

function relativeFormatter(locale: string | undefined): Intl.RelativeTimeFormat {
  const key = locale ?? '';
  const cached = relativeFormatters.get(key);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  relativeFormatters.set(key, formatter);
  return formatter;
}

/** Locale-aware plain number — used for temperatures, voltages and counts. */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  if (!Number.isFinite(value)) {
    return EMPTY_VALUE;
  }
  return numberFormatter(options.locale, options.fractionDigits ?? 0).format(value);
}

/** Star rating, always one decimal so `5` and `4.3` line up: `5.0`, `4.3`. */
export function formatRating(value: number, options: LocaleOptions = {}): string {
  return formatNumber(value, {
    fractionDigits: RATING_FRACTION_DIGITS,
    locale: options.locale,
  });
}

/**
 * Binary byte count with one decimal above the byte unit: `47.2 GB`, `512 B`.
 *
 * The one and only byte formatter in the app. Pass
 * {@link ByteFormatOptions.fractionDigits} for a finer reading; the digit count
 * stays fixed either way, so `8.00 GB` never collapses to `8 GB`.
 */
export function formatBytes(bytes: number, options: ByteFormatOptions = {}): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return EMPTY_VALUE;
  }

  const requestedDigits = options.fractionDigits ?? DEFAULT_BYTE_FRACTION_DIGITS;

  let value = bytes;
  let unitIndex = 0;
  while (value >= BYTES_PER_UNIT && unitIndex < LAST_BYTE_UNIT) {
    value /= BYTES_PER_UNIT;
    unitIndex += 1;
  }

  let fractionDigits = unitIndex === 0 ? 0 : requestedDigits;
  // Rounding can push the value back over a unit boundary (1023.99 MB → 1024.0 MB).
  if (Number(value.toFixed(fractionDigits)) >= BYTES_PER_UNIT && unitIndex < LAST_BYTE_UNIT) {
    value /= BYTES_PER_UNIT;
    unitIndex += 1;
    fractionDigits = requestedDigits;
  }

  return `${numberFormatter(options.locale, fractionDigits).format(value)} ${BYTE_UNITS[unitIndex]}`;
}

/**
 * Formats a **fraction** (`0.74` → `74%`), not a 0–100 percentage — the same
 * value that drives a gauge or a bar width formats the label, so the two can
 * never disagree. Pair with {@link usageRatio}.
 */
export function formatPercent(fraction: number, options: NumberFormatOptions = {}): string {
  if (!Number.isFinite(fraction)) {
    return EMPTY_VALUE;
  }
  return percentFormatter(options.locale, options.fractionDigits ?? 0).format(fraction);
}

/** Safe `used / total`, clamped to 0–1. Returns 0 when the total is unusable. */
export function usageRatio(used: number, total: number): number {
  if (!(Number.isFinite(used) && Number.isFinite(total)) || total <= 0) {
    return 0;
  }
  return Math.min(Math.max(used / total, 0), 1);
}

/**
 * Uptime as the two most significant units: `3d 4h`, `4h 12m`, `12m 30s`, `45s`.
 * Trailing zero units are dropped (`2h 0m` reads as `2h`).
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return EMPTY_VALUE;
  }

  const seconds = Math.floor(totalSeconds);
  if (seconds < SECONDS_PER_MINUTE) {
    return `${seconds}s`;
  }

  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const restSeconds = seconds % SECONDS_PER_MINUTE;
  return restSeconds > 0 ? `${minutes}m ${restSeconds}s` : `${minutes}m`;
}

function toTime(value: string | number | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  return new Date(value).getTime();
}

export interface RelativeDateOptions extends LocaleOptions {
  /** Reference point; defaults to now. Tests pass a fixed instant. */
  now?: number | Date | undefined;
}

/**
 * Whole days elapsed since `value` (negative when `value` is in the future).
 * `null` for an unparseable date — callers use it to grade staleness, e.g. an
 * Android security patch older than six months.
 *
 * Truncated, not rounded: date-only values such as `ro.build.version.
 * security_patch` parse as UTC midnight, so rounding would report a patch
 * issued today as a day old for anyone reading the screen after noon.
 */
export function daysSince(
  value: string | number | Date,
  options: Pick<RelativeDateOptions, 'now'> = {},
): number | null {
  const time = toTime(value);
  if (Number.isNaN(time)) {
    return null;
  }
  const now = options.now === undefined ? Date.now() : toTime(options.now);
  return Math.trunc((now - time) / MS_PER_DAY);
}

/**
 * Human-scale age: `today`, `3 days ago`, `3 weeks ago`, `2 months ago`.
 * Unit escalates with distance so a security-patch date never reads as
 * "184 days ago".
 */
export function formatRelativeDate(
  value: string | number | Date,
  options: RelativeDateOptions = {},
): string {
  const elapsedDays = daysSince(value, options.now === undefined ? {} : { now: options.now });
  if (elapsedDays === null) {
    return EMPTY_VALUE;
  }

  const formatter = relativeFormatter(options.locale);
  const deltaDays = -elapsedDays;
  const distance = Math.abs(deltaDays);

  if (distance < 1) {
    return formatter.format(0, 'day');
  }
  if (distance < DAYS_PER_WEEK) {
    return formatter.format(deltaDays, 'day');
  }
  if (distance < DAYS_PER_MONTH) {
    return formatter.format(Math.round(deltaDays / DAYS_PER_WEEK), 'week');
  }
  if (distance < DAYS_PER_YEAR) {
    return formatter.format(Math.round(deltaDays / DAYS_PER_MONTH), 'month');
  }
  return formatter.format(Math.round(deltaDays / DAYS_PER_YEAR), 'year');
}

/**
 * Absolute calendar date: `24 Apr 2026`. Use where the exact day matters (a
 * release or a published version); use {@link formatRelativeDate} where the
 * age is what the reader is judging.
 */
export function formatDisplayDate(
  value: string | number | Date,
  options: LocaleOptions = {},
): string {
  const time = toTime(value);
  if (Number.isNaN(time)) {
    return EMPTY_VALUE;
  }
  return displayDateFormatter(options.locale).format(time);
}
