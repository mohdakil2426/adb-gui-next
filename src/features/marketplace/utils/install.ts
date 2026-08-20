import { toast } from 'sonner';
import { MarketplaceDownloadApk, MarketplaceInstallApk } from '@/desktop/backend';
import { resolveInstallTarget } from '@/features/marketplace/model/installTarget';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';

/**
 * Download an APK and push it to the selected device.
 *
 * The device check happens **before** the download: this used to resolve the
 * serial at click time, pass `null` through happily, and only fail after
 * fetching the whole file.
 */
export async function installMarketplacePackage(
  appName: string,
  downloadUrl: string,
  serial?: string | null,
  packageName?: string,
): Promise<void> {
  const { devices, selectedSerial } = useDeviceStore.getState();
  const target = serial
    ? { blockedReason: null, canInstall: true, serial }
    : resolveInstallTarget(devices, selectedSerial);

  if (!(target.canInstall && target.serial)) {
    const reason = target.blockedReason ?? 'No device is available to install onto.';
    useLogStore.getState().addLog(`[Marketplace] ${appName} not installed: ${reason}`, 'warning');
    toast.error(`Cannot install ${appName}`, { description: reason });
    throw new Error(reason);
  }

  const toastId = toast.loading(`Downloading ${appName}…`);
  try {
    const localPath = await MarketplaceDownloadApk(downloadUrl, packageName ?? appName);
    await MarketplaceInstallApk(localPath, target.serial);
    useLogStore.getState().addLog(`[Marketplace] Installed ${appName}`, 'success');
    toast.success(`${appName} installed`, { id: toastId, description: `Target: ${target.serial}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    useLogStore
      .getState()
      .addLog(`[Marketplace] Failed to install ${appName}: ${message}`, 'error');
    toast.error(`Failed to install ${appName}`, {
      id: toastId,
      description: `${message} — check the device is unlocked and has room, then try again.`,
    });
    throw error;
  }
}

const MILLION = 1_000_000;
const THOUSAND = 1000;

export function formatDownloadCount(downloadsCount: number | null): string | null {
  if (downloadsCount == null || downloadsCount <= 0) {
    return null;
  }

  if (downloadsCount >= MILLION) {
    return `${(downloadsCount / MILLION).toFixed(1)}M`;
  }

  if (downloadsCount >= THOUSAND) {
    return `${(downloadsCount / THOUSAND).toFixed(0)}K`;
  }

  return String(downloadsCount);
}
