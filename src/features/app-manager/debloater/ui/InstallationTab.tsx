import { useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { InstallPackage, SelectMultipleApkFiles } from '@/desktop/backend';
import { useInstallationStore } from '@/features/app-manager/debloater/model/installationStore';
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

  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const queryClient = useQueryClient();

  const handleAddMore = useCallback(() => {
    void (async () => {
      try {
        const paths = await SelectMultipleApkFiles();
        if (paths?.length) {
          setApkPaths(paths);
          toast.info(`${paths.length} file(s) selected`);
        }
      } catch (error) {
        handleError('Select APK Files', error);
      }
    })();
  }, [setApkPaths]);

  const handleClearAll = useCallback(() => {
    setApkPaths([]);
  }, [setApkPaths]);

  async function handleInstall() {
    if (!selectedSerial || apkPaths.length === 0) {
      return;
    }
    const serial = selectedSerial;
    const total = apkPaths.length;
    const startedAt = Date.now();

    setIsInstalling(true);
    setInstallProgress({
      completed: 0,
      currentFile: getFileName(apkPaths[0] ?? ''),
      startedAt,
      total,
    });

    const operationId = startOperation({
      detail: `0 of ${total}`,
      label: `Installing ${total} APK${total === 1 ? '' : 's'}`,
      progress: 0,
      view: 'apps',
    });
    const toastId = toast.loading(`Installing 0 of ${total}…`);

    const outcomes = await mapSerial(apkPaths, async (path, index) => {
      if (!path) {
        return false;
      }
      const name = getFileName(path);
      setInstallProgress({ completed: index, currentFile: name, startedAt, total });
      updateOperation(operationId, {
        detail: `${index} of ${total} · ${name}`,
        progress: Math.round((index / total) * PERCENT),
      });
      toast.loading(`Installing ${index + 1} of ${total}: ${name}`, { id: toastId });
      // Yield a macrotask so the progress card paints before the blocking install.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      try {
        await InstallPackage(path, serial);
        useLogStore.getState().addLog(`Installed APK: ${name}`, 'success');
        return true;
      } catch (error) {
        useLogStore.getState().addLog(`Failed to install ${name}: ${error}`, 'error');
        return false;
      }
    });

    const ok = outcomes.filter(Boolean).length;
    const failed = outcomes.length - ok;
    if (failed === 0) {
      toast.success(`Installed ${ok} APK${ok === 1 ? '' : 's'}`, { id: toastId });
    } else {
      toast.warning(`Installed ${ok}, ${failed} failed — open the Logs panel for the reason`, {
        id: toastId,
      });
    }
    if (ok > 0) {
      invalidatePackages(queryClient);
      onInstalled();
    }
    finishOperation(operationId);
    setApkPaths([]);
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
