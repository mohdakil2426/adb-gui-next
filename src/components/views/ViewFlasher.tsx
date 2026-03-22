import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLogStore } from '@/lib/logStore';
import { handleError } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import {
  WipeData,
  FlashPartition,
  SelectImageFile,
  GetFastbootDevices,
  GetDevices,
  SelectZipFile,
  SideloadPackage,
} from '../../lib/desktop/backend';
import type { backend } from '../../lib/desktop/models';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, FileUp, Trash2, Package } from 'lucide-react';
import { ConnectedDevicesCard } from '@/components/ConnectedDevicesCard';
import { EditNicknameDialog } from '@/components/EditNicknameDialog';

type Device = backend.Device;

const areDeviceListsEqual = (a: Device[], b: Device[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((device, index) => {
    const bDevice = b[index];
    return device.serial === bDevice.serial && device.status === bDevice.status;
  });
};

export function ViewFlasher({ activeView }: { activeView: string }) {
  const [partition, setPartition] = useState('');
  const [filePath, setFilePath] = useState('');
  const [sideloadFilePath, setSideloadFilePath] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isSideloading, setIsSideloading] = useState(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Nickname Editing State
  const [editingSerial, setEditingSerial] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const isMountedRef = useRef(true);
  const devicesRef = useRef<Device[]>([]);
  const refreshInFlightRef = useRef(false);
  const queuedRefreshRef = useRef(false);
  const emptyPollCountRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyDevices = useCallback((newDevices: Device[]) => {
    if (!isMountedRef.current) return;
    devicesRef.current = newDevices;
    setDevices((current) => (areDeviceListsEqual(current, newDevices) ? current : newDevices));
  }, []);

  const refreshDevices = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (refreshInFlightRef.current) {
        queuedRefreshRef.current = true;
        return;
      }

      refreshInFlightRef.current = true;
      if (!silent && isMountedRef.current) {
        setIsRefreshing(true);
      }

      try {
        debugLog('Refreshing devices (flasher)');
        const [fbResult, adbResult] = await Promise.all([GetFastbootDevices(), GetDevices()]);

        if (!isMountedRef.current) return;

        const combinedDevices: Device[] = [];

        // Process Fastboot devices
        if (Array.isArray(fbResult)) {
          combinedDevices.push(
            ...fbResult
              .filter((d) => !!d && typeof d.serial === 'string')
              .map((d) => ({ serial: d.serial, status: d.status ?? 'fastboot' })),
          );
        }

        // Process ADB devices
        if (Array.isArray(adbResult)) {
          combinedDevices.push(
            ...adbResult
              .filter((d) => !!d && typeof d.serial === 'string')
              // Don't add if already found in fastboot (unlikely but safe)
              .filter((d) => !combinedDevices.some((cd) => cd.serial === d.serial))
              .map((d) => ({ serial: d.serial, status: d.status })),
          );
        }

        if (combinedDevices.length > 0) {
          emptyPollCountRef.current = 0;
          applyDevices(combinedDevices);
        } else {
          emptyPollCountRef.current += 1;
          // Only clear if empty for a couple polls to avoid flickering
          if (devicesRef.current.length === 0 || emptyPollCountRef.current >= 2) {
            applyDevices([]);
          }
        }
      } catch (error) {
        handleError('Refresh Devices', error);
      } finally {
        if (isMountedRef.current) {
          setIsRefreshing(false);
        }
        refreshInFlightRef.current = false;

        if (queuedRefreshRef.current && isMountedRef.current) {
          queuedRefreshRef.current = false;
          refreshDevices({ silent: true });
        } else {
          queuedRefreshRef.current = false;
        }
      }
    },
    [applyDevices],
  );

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    if (activeView !== 'flasher') return;

    emptyPollCountRef.current = 0;
    refreshDevices();
    const interval = window.setInterval(() => {
      refreshDevices({ silent: true });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [activeView, refreshDevices]);

  const hasFastbootDevice = devices.some(
    (d) => d.status === 'fastboot' || d.status === 'bootloader',
  );
  const hasSideloadDevice = devices.some((d) => d.status === 'sideload' || d.status === 'recovery');

  const handleSelectFile = async () => {
    try {
      debugLog('Selecting image file');
      const selectedPath = await SelectImageFile();

      if (selectedPath) {
        setFilePath(selectedPath);
        toast.info(`File selected: ${selectedPath.split(/[/\\]/).pop()}`);
        debugLog('Selected image file:', selectedPath);
      }
    } catch (error) {
      handleError('Select Image File', error);
    }
  };

  const handleSelectSideloadFile = async () => {
    try {
      debugLog('Selecting ZIP file for sideload');
      const selectedPath = await SelectZipFile();

      if (selectedPath) {
        setSideloadFilePath(selectedPath);
        toast.info(`ZIP selected: ${selectedPath.split(/[/\\]/).pop()}`);
        debugLog('Selected ZIP file:', selectedPath);
      }
    } catch (error) {
      handleError('Select ZIP File', error);
    }
  };

  const handleFlash = async () => {
    if (!partition) {
      toast.error('Partition name cannot be empty.');
      return;
    }
    if (!filePath) {
      toast.error('No file selected.');
      return;
    }

    setIsFlashing(true);
    const toastId = toast.loading(`Flashing ${partition} partition...`);

    try {
      await FlashPartition(partition, filePath);
      toast.success('Flash Complete', {
        description: `${partition} flashed successfully.`,
        id: toastId,
      });
      useLogStore.getState().addLog(`Flashed partition ${partition}: Success`, 'success');
    } catch (error) {
      console.error('Flash error:', error);
      toast.error('Flash Failed', { description: String(error), id: toastId });
      useLogStore.getState().addLog(`Failed to flash partition ${partition}: ${error}`, 'error');
    } finally {
      setIsFlashing(false);
    }
  };

  const handleSideload = async () => {
    if (!sideloadFilePath) {
      toast.error('No update package selected.');
      return;
    }

    const fileName = sideloadFilePath.split(/[/\\]/).pop() ?? 'update.zip';
    setIsSideloading(true);
    const toastId = toast.loading(`Sideloading ${fileName}...`);

    try {
      const output = await SideloadPackage(sideloadFilePath);
      const description = output ? output : `${fileName} sideloaded successfully.`;
      toast.success('Sideload Complete', { description, id: toastId });
      useLogStore.getState().addLog(`Sideloaded ${fileName}: ${description}`, 'success');
    } catch (error) {
      console.error('Sideload error:', error);
      toast.error('Sideload Failed', { description: String(error), id: toastId });
      useLogStore.getState().addLog(`Failed to sideload ${fileName}: ${error}`, 'error');
    } finally {
      setIsSideloading(false);
    }
  };

  const handleWipe = async () => {
    setIsWiping(true);
    const toastId = toast.loading('Wiping data... Device will factory reset.');

    try {
      await WipeData();
      toast.success('Wipe Complete', { description: 'Device data has been erased.', id: toastId });
      useLogStore.getState().addLog(`Device data wiped (Factory Reset): Success`, 'success');
    } catch (error) {
      console.error('Wipe error:', error);
      toast.error('Wipe Failed', { description: String(error), id: toastId });
      useLogStore.getState().addLog(`Failed to wipe data: ${error}`, 'error');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ConnectedDevicesCard
        devices={devices.map((d) => ({
          serial: d.serial,
          status: d.status,
        }))}
        isLoading={isRefreshing}
        onRefresh={() => refreshDevices()}
        onEdit={(serial) => {
          setEditingSerial(serial);
          setIsEditing(true);
        }}
        emptyText={isRefreshing ? 'Scanning for devices...' : 'No devices detected.'}
      />

      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        serial={editingSerial}
        onSaved={() => refreshDevices({ silent: true })}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <FileUp />
            Flash Partition
          </CardTitle>
          <CardDescription>Flash an image file (.img) to a specific partition.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="partition" className="text-sm font-medium">
              Partition Name
            </label>
            <Input
              id="partition"
              placeholder="e.g., boot, recovery, vendor_boot"
              value={partition}
              onChange={(e) => setPartition(e.target.value)}
              disabled={isFlashing}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Image File (.img)</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSelectFile}
                disabled={isFlashing}
              >
                Select File
              </Button>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {filePath ? filePath : 'No file selected.'}
            </p>
          </div>

          <Button
            variant="default"
            className="w-full"
            disabled={isFlashing || !partition || !filePath || !hasFastbootDevice}
            onClick={handleFlash}
          >
            {isFlashing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            Flash Partition
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Package />
            Recovery Sideload
          </CardTitle>
          <CardDescription>
            Send a flashable ZIP via adb sideload while your device is in recovery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Flashable ZIP (.zip)</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleSelectSideloadFile}
                disabled={isSideloading}
              >
                Select ZIP
              </Button>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {sideloadFilePath ? sideloadFilePath : 'No ZIP selected.'}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Ensure the device shows &quot;sideload&quot; mode in recovery before starting.
          </p>

          <Button
            variant="default"
            className="w-full"
            disabled={isSideloading || !sideloadFilePath || !hasSideloadDevice}
            onClick={handleSideload}
          >
            {isSideloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            Sideload Package
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg text-destructive">
            <AlertTriangle />
            Danger Zone
          </CardTitle>
          <CardDescription>
            These actions are irreversible and will erase data on your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full"
                disabled={isWiping || !hasFastbootDevice}
              >
                {isWiping ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Wipe Data (Factory Reset)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently erase all user data (photos,
                  files, settings) from your device, performing a full factory reset.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={handleWipe}
                >
                  Yes, Wipe Data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
