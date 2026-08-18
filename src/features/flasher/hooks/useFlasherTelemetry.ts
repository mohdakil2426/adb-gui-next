import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Reboot, RunFastbootHostCommand, SetActiveSlot } from '@/desktop/backend';
import type {
  ActiveSlot,
  BootloaderLockState,
  FastbootVitals,
  FlasherConnectionMode,
} from '@/features/flasher/model/flasherTypes';
import { parseGetVar } from '@/features/flasher/utils/flasherRisk';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';

function normalizeSlot(raw: string | null): ActiveSlot {
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
  if (clean === 'yes' || clean === 'true' || clean === '1') {
    return 'UNLOCKED';
  }
  if (clean === 'no' || clean === 'false' || clean === '0') {
    return 'LOCKED';
  }
  return 'UNKNOWN';
}

export function useFlasherTelemetry() {
  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const selectedDevice = useMemo(
    () => devices.find((d) => d.serial === selectedSerial) ?? null,
    [devices, selectedSerial],
  );

  const [isProbing, setIsProbing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [fastbootVars, setFastbootVars] = useState<{
    batterySoc: string | null;
    batteryVoltage: string | null;
    bootloaderVersion: string | null;
    currentSlot: string | null;
    isUserspace: string | null;
    product: string | null;
    secure: string | null;
    slotCount: string | null;
    unlocked: string | null;
  }>({
    batterySoc: null,
    batteryVoltage: null,
    bootloaderVersion: null,
    currentSlot: null,
    isUserspace: null,
    product: null,
    secure: null,
    slotCount: null,
    unlocked: null,
  });

  const isFastbootMode =
    selectedDevice?.status === 'fastboot' || selectedDevice?.status === 'bootloader';

  const probeFastboot = useCallback(async (serial: string) => {
    setIsProbing(true);
    try {
      const [
        productOut,
        slotOut,
        unlockedOut,
        userspaceOut,
        blVerOut,
        socOut,
        voltOut,
        slotCountOut,
        secureOut,
      ] = await Promise.all([
        RunFastbootHostCommand('getvar product', serial).catch(() => ''),
        RunFastbootHostCommand('getvar current-slot', serial).catch(() => ''),
        RunFastbootHostCommand('getvar unlocked', serial).catch(() => ''),
        RunFastbootHostCommand('getvar is-userspace', serial).catch(() => ''),
        RunFastbootHostCommand('getvar version-bootloader', serial).catch(() => ''),
        RunFastbootHostCommand('getvar battery-soc', serial).catch(() => ''),
        RunFastbootHostCommand('getvar battery-voltage', serial).catch(() => ''),
        RunFastbootHostCommand('getvar slot-count', serial).catch(() => ''),
        RunFastbootHostCommand('getvar secure', serial).catch(() => ''),
      ]);

      setFastbootVars({
        batterySoc: parseGetVar(socOut, 'battery-soc'),
        batteryVoltage: parseGetVar(voltOut, 'battery-voltage'),
        bootloaderVersion: parseGetVar(blVerOut, 'version-bootloader'),
        currentSlot: parseGetVar(slotOut, 'current-slot'),
        isUserspace: parseGetVar(userspaceOut, 'is-userspace'),
        product: parseGetVar(productOut, 'product'),
        secure: parseGetVar(secureOut, 'secure'),
        slotCount: parseGetVar(slotCountOut, 'slot-count'),
        unlocked: parseGetVar(unlockedOut, 'unlocked'),
      });
      setLastUpdated(Date.now());
    } finally {
      setIsProbing(false);
    }
  }, []);

  useEffect(() => {
    if (!(selectedDevice && isFastbootMode)) {
      setFastbootVars({
        batterySoc: null,
        batteryVoltage: null,
        bootloaderVersion: null,
        currentSlot: null,
        isUserspace: null,
        product: null,
        secure: null,
        slotCount: null,
        unlocked: null,
      });
      return;
    }

    void probeFastboot(selectedDevice.serial);
  }, [isFastbootMode, probeFastboot, selectedDevice]);

  const refresh = useCallback(() => {
    if (selectedDevice && isFastbootMode) {
      void probeFastboot(selectedDevice.serial);
    }
  }, [isFastbootMode, probeFastboot, selectedDevice]);

  const vitals: FastbootVitals = useMemo(() => {
    if (!selectedDevice) {
      return {
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
    }

    let connectionMode: FlasherConnectionMode = 'NO_DEVICE';
    if (isFastbootMode) {
      connectionMode = fastbootVars.isUserspace === 'yes' ? 'FASTBOOTD' : 'FASTBOOT';
    } else if (selectedDevice.status === 'sideload') {
      connectionMode = 'SIDELOAD';
    } else if (selectedDevice.status === 'recovery') {
      connectionMode = 'RECOVERY';
    } else if (selectedDevice.status === 'device') {
      connectionMode = 'ADB';
    } else if (selectedDevice.status === 'offline') {
      connectionMode = 'OFFLINE';
    } else if (selectedDevice.status === 'unauthorized') {
      connectionMode = 'UNAUTHORIZED';
    }

    const rawSoc = fastbootVars.batterySoc;
    const parsedSoc = rawSoc ? Number.parseInt(rawSoc, 10) : null;
    const batteryLevel = parsedSoc !== null && !Number.isNaN(parsedSoc) ? parsedSoc : null;
    const isBatterySafe = batteryLevel === null || batteryLevel >= 50;

    const parsedSlotCount = fastbootVars.slotCount
      ? Number.parseInt(fastbootVars.slotCount, 10)
      : 0;

    return {
      activeSlot: normalizeSlot(fastbootVars.currentSlot),
      batteryLevel,
      batteryVoltage: fastbootVars.batteryVoltage,
      bootloaderVersion: fastbootVars.bootloaderVersion,
      connectionMode,
      isBatterySafe,
      isUserspace: fastbootVars.isUserspace === 'yes',
      lockState: parseLockState(fastbootVars.unlocked),
      productBoard: fastbootVars.product,
      rawSlot: fastbootVars.currentSlot,
      secureBoot: fastbootVars.secure === 'yes',
      serial: selectedDevice.serial,
      slotCount: Number.isNaN(parsedSlotCount) ? 0 : parsedSlotCount,
    };
  }, [fastbootVars, isFastbootMode, selectedDevice]);

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
