import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts the filename (or last path segment) from a full path string.
 * Handles both Windows (`\`) and POSIX (`/`) path separators.
 */
export function getFileName(path: string): string {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

/** Format raw byte count string into human-readable size. */
export function formatBytes(raw: string): string {
  const n = parseInt(raw, 10);
  if (isNaN(n) || raw === '') return raw;
  if (n === 0) return '0 B';
  if (n < 1_024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1_024).toFixed(1)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${(n / 1_073_741_824).toFixed(1)} GB`;
}

/** Format a number of bytes into human-readable size. */
export function formatBytesNum(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
