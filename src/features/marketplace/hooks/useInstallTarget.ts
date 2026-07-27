import { useMemo } from 'react';
import {
  type InstallTarget,
  resolveInstallTarget,
} from '@/features/marketplace/model/installTarget';
import { useDeviceStore } from '@/shared/stores/deviceStore';

/**
 * Live install availability for the marketplace.
 *
 * Read once per view and threaded down, so every install control on the screen
 * agrees about whether a device can receive an APK.
 */
export function useInstallTarget(): InstallTarget {
  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);

  return useMemo(() => resolveInstallTarget(devices, selectedSerial), [devices, selectedSerial]);
}
