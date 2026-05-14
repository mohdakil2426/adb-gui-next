import type { LoadError } from '@/features/file-explorer/model/fileExplorerTypes';

export function categorizeError(err: unknown): LoadError {
  const msg = String(err).toLowerCase();
  if (msg.includes('permission denied')) {
    return 'permission_denied';
  }
  if (
    msg.includes('no devices') ||
    msg.includes('device not found') ||
    msg.includes('no device') ||
    msg.includes('adb: error') ||
    msg.includes('unable to locate')
  ) {
    return 'no_device';
  }
  return 'unknown';
}
