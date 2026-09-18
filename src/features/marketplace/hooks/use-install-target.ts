import { useMemo } from "react";

import { resolveInstallTarget } from "@/features/marketplace/model/install-target";
import type { InstallTarget } from "@/features/marketplace/model/install-target";
import { useDeviceStore } from "@/shared/stores/device-store";

/**
 * Live install availability for the marketplace.
 *
 * Read once per view and threaded down, so every install control on the screen
 * agrees about whether a device can receive an APK.
 */
export const useInstallTarget = (): InstallTarget => {
  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);

  return useMemo(() => resolveInstallTarget(devices, selectedSerial), [devices, selectedSerial]);
};
