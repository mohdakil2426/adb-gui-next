import { useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { InstallPackage, SelectMultipleApkFiles } from '@/desktop/backend';
import {
  buildAdbInstallFlags,
  useInstallationStore,
} from '@/features/app-manager/debloater/model/installationStore';
import { ApkPickerPanel } from '@/features/app-manager/debloater/ui/ApkPickerPanel';
import { mapSerial } from '@/features/app-manager/debloater/ui/mapSerial';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { finishOperation, startOperation, updateOperation } from '@/shared/stores/operationStore';
import { handleError } from '@/shared/utils/errorHandler';
import { getFileName } from '@/shared/utils/filePath';
import { invalidatePackages } from '@/shared/utils/queries';

const PERCENT = 100;

/**
 * Putting APKs **on** the device. Removing them lives in the Installed apps tab
 * — the two were previously stacked in one tab behind a bare `border-t`.
 */
export function InstallationTab({ onInstalled }: { onInstalled: () => void }) {
  // Atomic selectors — subscribing to the whole store re-rendered this tab on
  // any unrelated store write.
  const apkPaths = useInstallationStore((s) => s.apkPaths);
  const isInstalling = useInstallationStore((s) => s.isInstalling);
  const installProgress = useInstallationStore((s) => s.installProgress);
  const setApkPaths = useInstallationStore((s) => s.setApkPaths);
  const setIsInstalling = useInstallationStore((s) => s.setIsInstalling);
  const setInstallProgress = useInstallationStore((s) => s.setInstallProgress);
  const installFlags = useInstallationStore((s) => s.installFlags);
  const setItemStatus = useInstallationStore((s) => s.setItemStatus);
  const clearItemStatuses = useInstallationStore((s) => s.clearItemStatuses);
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const queryClient = useQueryClient();

  const handleAddMore = useCallback(() => {
    void (async () => {
      try {
        const paths = await SelectMultipleApkFiles();
        if (paths?.length) {
          // De-duplicate newly picked paths against existing queue
          const current = useInstallationStore.getState().apkPaths;
          const currentSet = new Set(current);
          const unique = paths.filter((p) => !currentSet.has(p));
          if (unique.length === 0) {
            toast.info('Selected file(s) already in queue');
            return;
          }
          setApkPaths([...current, ...unique]);
          toast.success(`Added ${unique.length} package file(s)`);
        }
      } catch (error) {
        handleError('Select Package Files', error);
      }
    })();
  }, [setApkPaths]);

  const handleClearAll = useCallback(() => {
    setApkPaths([]);
    clearItemStatuses();
  }, [clearItemStatuses, setApkPaths]);

  async function handleInstall() {
    if (!selectedSerial || apkPaths.length === 0) {
      return;
    }
    const serial = selectedSerial;
    const total = apkPaths.length;
    const startedAt = Date.now();
    const flags = buildAdbInstallFlags(installFlags);

    setIsInstalling(true);
    setInstallProgress({
      completed: 0,
      currentFile: getFileName(apkPaths[0] ?? ''),
      startedAt,
      total,
    });

    // Initialize all items as queued
    for (const path of apkPaths) {
      setItemStatus(path, { status: 'queued' });
    }

    const operationId = startOperation({
      detail: `0 of ${total}`,
      label: `Installing ${total} Package${total === 1 ? '' : 's'}`,
      progress: 0,
      view: 'apps',
    });
    const toastId = toast.loading(`Installing 0 of ${total}…`);

    const successfulPaths: string[] = [];
    const outcomes = await mapSerial(apkPaths, async (path, index) => {
      if (!path) {
        return false;
      }
      const name = getFileName(path);
      const fileStartTime = Date.now();
      setItemStatus(path, { status: 'installing' });
      setInstallProgress({ completed: index, currentFile: name, startedAt, total });
      updateOperation(operationId, {
        detail: `${index} of ${total} · ${name}`,
        progress: Math.round((index / total) * PERCENT),
      });
      toast.loading(`Installing ${index + 1} of ${total}: ${name}`, { id: toastId });

      // Macrotask yield so state updates paint to UI
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      try {
        await InstallPackage(path, serial, flags);
        const durationMs = Date.now() - fileStartTime;
        setItemStatus(path, { durationMs, status: 'completed' });
        successfulPaths.push(path);
        useLogStore
          .getState()
          .addLog(`Installed ${name} in ${(durationMs / 1000).toFixed(1)}s`, 'success');
        return true;
      } catch (error) {
        const durationMs = Date.now() - fileStartTime;
        const errorMsg = error instanceof Error ? error.message : String(error);
        setItemStatus(path, { durationMs, error: errorMsg, status: 'failed' });
        useLogStore.getState().addLog(`Failed to install ${name}: ${errorMsg}`, 'error');
        return false;
      }
    });

    const ok = outcomes.filter(Boolean).length;
    const failed = outcomes.length - ok;
    if (failed === 0) {
      toast.success(`Installed ${ok} package${ok === 1 ? '' : 's'} successfully`, { id: toastId });
      setApkPaths([]);
      clearItemStatuses();
    } else {
      toast.warning(`Installed ${ok}, ${failed} failed — review errors below or in Logs`, {
        id: toastId,
      });
      // Retain failed paths in queue so user can adjust flags and retry
      const remaining = apkPaths.filter((p) => !successfulPaths.includes(p));
      setApkPaths(remaining);
    }

    if (ok > 0) {
      invalidatePackages(queryClient);
      onInstalled();
    }

    finishOperation(operationId);
    setIsInstalling(false);
    setInstallProgress(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedSerial ? null : (
        <p className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-muted px-3 py-2 text-body text-muted-foreground">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
          <span className="min-w-0">
            No device is selected, so nothing can be installed. Connect a device over USB and pick
            it in the sidebar — you can still queue files here in the meantime.
          </span>
        </p>
      )}

      <ApkPickerPanel
        apkPaths={apkPaths}
        installProgress={installProgress}
        isInstalling={isInstalling}
        onAddMore={handleAddMore}
        onClearAll={handleClearAll}
        onInstall={() => {
          void handleInstall();
        }}
        onPathsChange={setApkPaths}
        selectedSerial={selectedSerial}
      />
    </div>
  );
}
