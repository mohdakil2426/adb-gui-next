/**
 * Path helpers for values that cross the desktop boundary.
 *
 * Paths reach the UI from two very different worlds — the host filesystem
 * (`C:\Users\…` on Windows) and the device (`/sdcard/…`) — so separator
 * handling cannot assume either one.
 */

/**
 * Last segment of a path, whatever the separator: `/sdcard/a/app.apk` and
 * `C:\Users\a\app.apk` both yield `app.apk`.
 *
 * Returns the input unchanged when it holds no separator, and `''` for `''` —
 * callers render it directly, so it must never produce `undefined`.
 */
export function getFileName(path: string): string {
  if (!path) {
    return '';
  }
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}
