import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GetFlasherVitals, Reboot, RunFastbootHostCommand, SetActiveSlot } from '@/desktop/backend';
import type {
  ActiveSlot,
  BootloaderLockState,
  DiagnosticItem,
  DiagnosticStatus,
  FastbootVitals,
  FlasherConnectionMode,
} from '@/features/flasher/model/flasherTypes';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';

function normalizeSlot(raw?: string | null): ActiveSlot {
  if (!raw) {
    return 'unknown';
  }
  const clean = raw.toLowerCase().trim().replace(/^_+/, '');
  if (clean === 'a' || clean === 'slot_a' || clean === '_a') {
    return 'a';
  }
  if (clean === 'b' || clean === 'slot_b' || clean === '_b') {
    return 'b';
  }
  if (clean === 'none' || clean === 'single') {
    return 'single';
  }
  return 'unknown';
}

function parseLockState(raw: string | null): BootloaderLockState {
  if (!raw) {
    return 'UNKNOWN';
  }
  const clean = raw.toLowerCase().trim();
  if (clean === 'yes' || clean === 'true' || clean === '1' || clean === 'unlocked') {
    return 'UNLOCKED';
  }
  if (clean === 'no' || clean === 'false' || clean === '0' || clean === 'locked') {
    return 'LOCKED';
  }
  return 'UNKNOWN';
}

const DEFAULT_VITALS: FastbootVitals = {
  activeSlot: 'unknown',
  batteryLevel: null,
  batteryVoltage: null,
  bootloaderVersion: null,
  connectionMode: 'NO_DEVICE',
  isBatterySafe: true,
  isUserspace: false,
  lockState: 'UNKNOWN',
  productBoard: null,
  rawSlot: null,
  secureBoot: null,
  serial: null,
  slotCount: 0,
};

export function useFlasherTelemetry() {
  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const selectedDevice = useMemo(
    () => devices.find((d) => d.serial === selectedSerial) ?? null,
    [devices, selectedSerial],
  );

  const [isProbing, setIsProbing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [vitals, setVitals] = useState<FastbootVitals>(DEFAULT_VITALS);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);

  const isFastbootMode =
    selectedDevice?.status === 'fastboot' ||
    selectedDevice?.status === 'bootloader' ||
    vitals.connectionMode === 'FASTBOOT' ||
    vitals.connectionMode === 'FASTBOOTD';

  const probeFastboot = useCallback(async (serial?: string | null) => {
    setIsProbing(true);
    try {
      const result = await GetFlasherVitals(serial ?? null);
      if (result && result.vitals) {
        const v = result.vitals;
        setVitals({
          activeSlot: normalizeSlot(v.activeSlot || v.rawSlot),
          batteryLevel: v.batteryLevel ?? null,
          batteryVoltage: v.batteryVoltage ?? null,
          bootloaderVersion: v.bootloaderVersion ?? null,
          connectionMode: (v.connectionMode as FlasherConnectionMode) || 'NO_DEVICE',
          isBatterySafe: v.isBatterySafe ?? true,
          isUserspace: !!v.isUserspace,
          lockState: parseLockState(v.lockState),
          productBoard: v.productBoard ?? null,
          rawSlot: v.rawSlot ?? null,
          secureBoot: v.secureBoot ?? null,
          serial: v.serial ?? serial ?? null,
          slotCount: v.slotCount ?? 0,
        });
      }
      if (result && Array.isArray(result.diagnostics)) {
        setDiagnostics(
          result.diagnostics.map((d) => ({
            id: d.id,
            label: d.label,
            description: d.description,
            status: (d.status as DiagnosticStatus) || 'idle',
            value: d.value ?? undefined,
            tip: d.tip ?? undefined,
            fixLabel: d.fixLabel ?? undefined,
            fixAction: undefined,
          })),
        );
      }
      setLastUpdated(Date.now());
    } catch (error) {
      handleError('Get Flasher Vitals', error);
    } finally {
      setIsProbing(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDevice) {
      setVitals(DEFAULT_VITALS);
      setDiagnostics([]);
      return;
    }

    void probeFastboot(selectedDevice.serial);
  }, [probeFastboot, selectedDevice]);

  const refresh = useCallback(() => {
    void probeFastboot(selectedDevice?.serial ?? null);
  }, [probeFastboot, selectedDevice]);

  const switchSlot = useCallback(
    async (targetSlot: 'a' | 'b') => {
      if (!(selectedDevice && isFastbootMode)) {
        toast.error('Device must be in fastboot mode to switch slots');
        return;
      }
      const toastId = toast.loading(`Switching active slot to _${targetSlot}...`);
      try {
        await SetActiveSlot(targetSlot, selectedDevice.serial);
        toast.success(`Slot Switched to _${targetSlot}`, {
          description: 'Device active slot updated successfully.',
          id: toastId,
        });
        useLogStore.getState().addLog(`Switched active fastboot slot to _${targetSlot}`, 'success');
        await probeFastboot(selectedDevice.serial);
      } catch (error) {
        toast.dismiss(toastId);
        handleError('Switch Slot', error);
      }
    },
    [isFastbootMode, probeFastboot, selectedDevice],
  );

  const rebootDevice = useCallback(
    async (mode: 'system' | 'bootloader' | 'recovery' | 'fastboot') => {
      if (!selectedDevice) {
        return;
      }
      const toastId = toast.loading(`Rebooting to ${mode}...`);
      try {
        if (isFastbootMode) {
          await RunFastbootHostCommand(
            `reboot ${mode === 'system' ? '' : mode}`.trim(),
            selectedDevice.serial,
          );
        } else {
          await Reboot(mode === 'system' ? '' : mode, selectedDevice.serial);
        }
        toast.success(`Rebooting to ${mode}`, { id: toastId });
        useLogStore.getState().addLog(`Rebooted device to ${mode}`, 'info');
      } catch (error) {
        toast.dismiss(toastId);
        handleError('Reboot Device', error);
      }
    },
    [isFastbootMode, selectedDevice],
  );

  return {
    diagnostics,
    isFastbootMode,
    isProbing,
    lastUpdated,
    rebootDevice,
    refresh,
    selectedDevice,
    switchSlot,
    vitals,
  };
}
