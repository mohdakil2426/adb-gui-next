import type { backend } from '@/desktop/models';

/**
 * Whether the marketplace can actually put an APK on a device right now.
 *
 * The Marketplace previously had zero device awareness: the install button was
 * gated on the download URL alone and the serial was resolved at click time,
 * happily passing `null`. The only feedback was a failure toast after a full
 * download had already run.
 */
export interface InstallTarget {
  /** Why installing is unavailable, phrased as the next thing to do. `null` when it is available. */
  blockedReason: string | null;
  /** `true` when an `adb install` can succeed. */
  canInstall: boolean;
  serial: string | null;
}

const READY_STATUS = 'device';

/** Why this connection mode cannot receive an APK, and what to do about it. */
function reasonForStatus(status: string): string {
  switch (status) {
    case 'recovery':
    case 'sideload':
      return 'The selected device is in recovery. Reboot it to system before installing an APK.';
    case 'fastboot':
    case 'bootloader':
      return 'The selected device is in fastboot, which cannot install APKs. Reboot it to system first.';
    case 'unauthorized':
      return 'The selected device has not authorised this computer. Accept the RSA prompt on the device, then scan again.';
    case 'offline':
      return 'The selected device is listed but not responding. Reconnect the cable or restart the ADB server.';
    default:
      return `The selected device reports "${status}", which cannot install APKs. Reboot it to system first.`;
  }
}

export function resolveInstallTarget(
  devices: readonly backend.Device[],
  selectedSerial: string | null,
): InstallTarget {
  if (!selectedSerial) {
    return {
      blockedReason:
        'No device is selected. Connect one over USB and pick it in the sidebar — browsing and search still work without it.',
      canInstall: false,
      serial: null,
    };
  }

  const device = devices.find((entry) => entry.serial === selectedSerial);
  if (!device) {
    return {
      blockedReason:
        'The selected device is no longer connected. Reconnect it, or pick another device in the sidebar.',
      canInstall: false,
      serial: selectedSerial,
    };
  }

  if (device.status !== READY_STATUS) {
    return {
      blockedReason: reasonForStatus(device.status),
      canInstall: false,
      serial: selectedSerial,
    };
  }

  return { blockedReason: null, canInstall: true, serial: selectedSerial };
}
