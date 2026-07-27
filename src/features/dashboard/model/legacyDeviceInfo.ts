import type { backend } from '@/desktop/models';
import { formatBytes } from '@/shared/utils/format';

/**
 * Projects structured telemetry back onto the legacy display-string
 * `DeviceInfo` shape.
 *
 * The Dashboard itself reads numbers, but `deviceStore.deviceInfo` is still the
 * shell's source for the sidebar device card (model name, Android version), and
 * the Dashboard was its only writer. Keeping the projection here means one
 * `get_device_telemetry` round-trip feeds both, and no view has to call the old
 * twelve-spawn `get_device_info`.
 */
export function toLegacyDeviceInfo(
  telemetry: backend.DeviceTelemetry,
  fallbackSerial: string,
): backend.DeviceInfo {
  const { battery, identity, memory, network, security, storage } = telemetry;
  const primaryVolume = storage[0];

  return {
    androidVersion: identity.androidVersion ?? '',
    batteryLevel: battery.levelPct === null ? '' : `${battery.levelPct}%`,
    brand: identity.brand ?? '',
    buildNumber: identity.buildId ?? '',
    codename: identity.codename ?? '',
    deviceName: identity.deviceName ?? identity.model ?? '',
    ipAddress: network.ipAddress ?? '',
    model: identity.model ?? '',
    ramTotal: memory.totalBytes > 0 ? formatBytes(memory.totalBytes) : '',
    rootStatus: security.rooted ? 'Yes' : 'No',
    serial: identity.serial ?? fallbackSerial,
    storageInfo: primaryVolume
      ? `${formatBytes(primaryVolume.usedBytes)} used of ${formatBytes(primaryVolume.totalBytes)}`
      : '',
  };
}
