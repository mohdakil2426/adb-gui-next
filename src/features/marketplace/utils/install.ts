import { toast } from "sonner";

import { MarketplaceDownloadApk, MarketplaceInstallApk } from "@/desktop/backend";
import { resolveInstallTarget } from "@/features/marketplace/model/install-target";
import { useDeviceStore } from "@/shared/stores/device-store";
import { useLogStore } from "@/shared/stores/log-store";

/**
 * Download an APK and push it to the selected device.
 *
 * The device check happens **before** the download: this used to resolve the
 * serial at click time, pass `null` through happily, and only fail after
 * fetching the whole file.
 */
export const installMarketplacePackage = async (
  appName: string,
  downloadUrl: string,
  serial?: string | null,
  packageName?: string
): Promise<void> => {
  const { devices, selectedSerial } = useDeviceStore.getState();
  const target = serial
    ? { blockedReason: null, canInstall: true, serial }
    : resolveInstallTarget(devices, selectedSerial);

  if (!(target.canInstall && target.serial)) {
    const reason = target.blockedReason ?? "No device is available to install onto.";
    useLogStore.getState().addLog(`[Marketplace] ${appName} not installed: ${reason}`, "warning");
    toast.error(`Cannot install ${appName}`, { description: reason });
    throw new Error(reason);
  }

  const toastId = toast.loading(`Downloading ${appName}…`);
  try {
    const localPath = await MarketplaceDownloadApk(downloadUrl, packageName ?? appName);
    toast.loading(`Installing ${appName} on ${target.serial}…`, {
      id: toastId,
    });
    await MarketplaceInstallApk(localPath, target.serial);
    useLogStore.getState().addLog(`[Marketplace] Installed ${appName}`, "success");
    toast.success(`${appName} installed`, {
      description: `Target: ${target.serial}`,
      id: toastId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    useLogStore
      .getState()
      .addLog(`[Marketplace] Failed to install ${appName}: ${message}`, "error");
    toast.error(`Failed to install ${appName}`, {
      description: `${message} — check the device is unlocked and has room, then try again.`,
      id: toastId,
    });
    throw error;
  }
};

const MILLION = 1_000_000;
const THOUSAND = 1000;

export const formatDownloadCount = (downloadsCount: number | null): string | null => {
  if (downloadsCount === null || downloadsCount === undefined || downloadsCount <= 0) {
    return null;
  }

  if (downloadsCount >= MILLION) {
    return `${(downloadsCount / MILLION).toFixed(1)}M`;
  }

  if (downloadsCount >= THOUSAND) {
    return `${(downloadsCount / THOUSAND).toFixed(0)}K`;
  }

  return String(downloadsCount);
};
