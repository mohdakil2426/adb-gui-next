import { toast } from 'sonner';
import { MarketplaceDownloadApk, MarketplaceInstallApk } from '@/desktop/backend';
import { useDeviceStore } from '@/shared/stores/deviceStore';

export async function installMarketplacePackage(
  appName: string,
  downloadUrl: string,
  serial?: string | null,
): Promise<void> {
  const toastId = toast.loading(`Downloading ${appName}...`);
  const selectedSerial = serial ?? useDeviceStore.getState().selectedSerial;

  try {
    const localPath = await MarketplaceDownloadApk(downloadUrl);
    toast.loading(`Installing ${appName}...`, { id: toastId });
    await MarketplaceInstallApk(localPath, selectedSerial);
    toast.success(`${appName} installed successfully`, { id: toastId });
  } catch (error) {
    toast.error(`Failed to install ${appName}`, {
      id: toastId,
      description: String(error),
    });
    throw error;
  }
}

export function formatDownloadCount(downloadsCount: number | null): string | null {
  if (downloadsCount == null || downloadsCount <= 0) {
    return null;
  }

  if (downloadsCount >= 1_000_000) {
    return `${(downloadsCount / 1_000_000).toFixed(1)}M`;
  }

  if (downloadsCount >= 1000) {
    return `${(downloadsCount / 1000).toFixed(0)}K`;
  }

  return String(downloadsCount);
}
