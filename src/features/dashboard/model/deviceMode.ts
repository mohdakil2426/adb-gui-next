import type { backend } from '@/desktop/models';

/** How the selected device is reachable — decides which actions are possible. */
export type DeviceMode = 'adb' | 'fastboot' | 'unavailable';

const ADB_STATUSES = new Set(['device', 'recovery']);
const FASTBOOT_STATUSES = new Set(['fastboot', 'bootloader']);

export function getDeviceMode(device: backend.Device | null | undefined): DeviceMode {
  if (!device) {
    return 'unavailable';
  }
  if (ADB_STATUSES.has(device.status)) {
    return 'adb';
  }
  if (FASTBOOT_STATUSES.has(device.status)) {
    return 'fastboot';
  }
  return 'unavailable';
}

/**
 * Telemetry is one `adb shell` round-trip, so it needs a fully booted and
 * authorised device. Recovery, sideload, fastboot and unauthorized devices get
 * an explanation instead of a failing poll.
 */
export function supportsTelemetry(device: backend.Device | null | undefined): boolean {
  return device?.status === 'device';
}

/** `192.168.1.14:5555` — how `adb connect` names a wireless device. */
const WIRELESS_SERIAL = /^\d{1,3}(\.\d{1,3}){3}:\d{1,5}$/;

export function isWirelessSerial(serial: string | null | undefined): boolean {
  return Boolean(serial) && WIRELESS_SERIAL.test(serial ?? '');
}

/** Why telemetry is unavailable, phrased as the next thing to do. */
export function telemetryBlockedReason(device: backend.Device | null | undefined): string {
  switch (device?.status) {
    case 'recovery':
      return 'Recovery mode does not expose device properties. Reboot to system to read telemetry.';
    case 'sideload':
      return 'Sideload mode only accepts an update package. Reboot to system to read telemetry.';
    case 'fastboot':
    case 'bootloader':
      return 'Fastboot exposes no runtime telemetry. Reboot to system to read battery, storage and memory.';
    case 'unauthorized':
      return 'This device has not authorised this computer. Accept the RSA prompt on the device, then scan again.';
    case 'offline':
      return 'The device is listed but not responding. Reconnect the cable or restart the ADB server.';
    default:
      return 'This connection mode does not expose device telemetry.';
  }
}
