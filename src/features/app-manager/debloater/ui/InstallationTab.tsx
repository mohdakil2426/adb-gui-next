import { useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { BatchInstallPackages, SelectMultipleApkFiles } from '@/desktop/backend';
import {
  buildAdbInstallFlags,
  useInstallationStore,
} from '@/features/app-manager/debloater/model/installationStore';
import { ApkPickerPanel } from '@/features/app-manager/debloater/ui/ApkPickerPanel';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { finishOperation, startOperation } from '@/shared/stores/operationStore';
import { handleError } from '@/shared/utils/errorHandler';
import { getFileName } from '@/shared/utils/filePath';
import { invalidatePackages } from '@/shared/utils/queries';

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

    try {
      const results = await BatchInstallPackages(apkPaths, serial, flags);
      let ok = 0;
      let failed = 0;
      const successfulPaths: string[] = [];

      for (const res of results) {
        const name = getFileName(res.path);
        if (res.success) {
          ok++;
          successfulPaths.push(res.path);
          setItemStatus(res.path, { status: 'completed' });
          useLogStore.getState().addLog(`Installed ${name} successfully`, 'success');
        } else {
          failed++;
          const errorMsg = res.error || 'Installation failed';
          setItemStatus(res.path, { error: errorMsg, status: 'failed' });
          useLogStore.getState().addLog(`Failed to install ${name}: ${errorMsg}`, 'error');
        }
      }

      if (failed === 0) {
        toast.success(`Installed ${ok} package${ok === 1 ? '' : 's'} successfully`, {
          id: toastId,
        });
        setApkPaths([]);
        clearItemStatuses();
      } else {
        toast.warning(`Installed ${ok}, ${failed} failed — review errors below or in Logs`, {
          id: toastId,
        });
        const successfulSet = new Set(successfulPaths);
        const remaining = apkPaths.filter((p) => !successfulSet.has(p));
        setApkPaths(remaining);
      }

      if (ok > 0) {
        invalidatePackages(queryClient);
        onInstalled();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Installation failed: ${errorMsg}`, { id: toastId });
      for (const path of apkPaths) {
        setItemStatus(path, { error: errorMsg, status: 'failed' });
      }
    } finally {
      finishOperation(operationId);
      setIsInstalling(false);
      setInstallProgress(null);
    }
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
