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
