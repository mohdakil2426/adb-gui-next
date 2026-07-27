import type { LoadError } from '@/features/file-explorer/model/fileExplorerTypes';

/**
 * Classify a failed `ListFiles` into one of the three actionable states the
 * table pane renders.
 *
 * This is a **fallback**, not the primary detector. `no_device` is decided up
 * front from `useDeviceStore` (see `FileExplorerStatus.hasDevice`) so the state
 * does not depend on adb's English wording; this branch only catches a device
 * yanked mid-request, before the 30 s device poll notices. Rewording a Rust
 * `bail!` therefore degrades this to `unknown` — never to a blank pane.
 */
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
