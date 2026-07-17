/* eslint-disable react-hooks/incompatible-library -- TanStack Virtual intentionally returns non-memoizable helpers; this virtualizer stays local to the list and is not passed across memoized boundaries. */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
  GetInstalledPackages,
  InstallPackage,
  SelectMultipleApkFiles,
  UninstallPackage,
} from '@/desktop/backend';
import { useInstallationStore } from '@/features/app-manager/debloater/model/installationStore';
import { ApkPickerPanel } from '@/features/app-manager/debloater/ui/ApkPickerPanel';
import { InstalledPackageList } from '@/features/app-manager/debloater/ui/InstalledPackageList';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';
import { getFileName } from '@/shared/utils/formatting';
import { invalidatePackages } from '@/shared/utils/queries';

/**
 * Run async work one item at a time.
 * ADB package install/uninstall on a single device must stay serial to avoid pm races.
 * Uses a then-chain (not for-await) so order is preserved without concurrent adb pm calls.
 */
function mapSerial<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const chain = items.reduce<Promise<void>>(
    (previous, item, index) =>
      previous.then(() =>
        worker(item, index).then((value) => {
          results[index] = value;
        }),
      ),
    Promise.resolve(),
  );
  return chain.then(() => results);
}

export function InstallationTab() {
  const {
    apkPaths,
    isInstalling,
    installProgress,
    packages,
    isLoadingPackages,
    selectedPackages,
    searchQuery,
    packageFilter,
    isUninstalling,
    loadedSerial,
    setApkPaths,
    setIsInstalling,
    setInstallProgress,
    setPackages,
    setIsLoadingPackages,
    setSelectedPackages,
    setSearchQuery,
    setPackageFilter,
    setIsUninstalling,
    setLoadedSerial,
  } = useInstallationStore();

  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const queryClient = useQueryClient();

  const loadPackages = useCallback(async () => {
    if (!selectedSerial) {
      setPackages([]);
      setLoadedSerial(null);
      return;
    }
    setIsLoadingPackages(true);
    try {
      const list = await GetInstalledPackages(selectedSerial);
      setPackages(list ?? []);
      setLoadedSerial(selectedSerial);
    } catch (error) {
      handleError('Load Packages', error);
      // Mark serial as loaded even on error so we don't spin forever
      setLoadedSerial(selectedSerial);
    } finally {
      setIsLoadingPackages(false);
    }
  }, [selectedSerial, setPackages, setIsLoadingPackages, setLoadedSerial]);

  useEffect(() => {
    // Reload only when the selected device changes — not when packages is empty
    if (selectedSerial !== loadedSerial) {
      setSelectedPackages(new Set());
      void loadPackages();
    }
  }, [selectedSerial, loadedSerial, loadPackages, setSelectedPackages]);

  async function handleSelectApk() {
    try {
      const paths = await SelectMultipleApkFiles();
      if (paths?.length) {
        setApkPaths(paths);
        toast.info(`${paths.length} file(s) selected`);
      }
    } catch (error) {
      handleError('Select APK Files', error);
    }
  }

  async function handleInstall() {
    if (!selectedSerial) {
      return;
    }
    if (apkPaths.length === 0) {
      return;
    }
    setIsInstalling(true);
    setInstallProgress({ current: 0, total: apkPaths.length });
    const toastId = toast.loading('Starting installation...');
    const serial = selectedSerial;
    const total = apkPaths.length;

    const outcomes = await mapSerial(apkPaths, async (path, i) => {
      if (!path) {
        return false;
      }
      const name = getFileName(path);
      toast.loading(`Installing (${i + 1}/${total}): ${name}`, {
        id: toastId,
      });
      setInstallProgress({ current: i + 1, total });
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
    const fail = outcomes.length - ok;
    if (fail === 0) {
      toast.success(`Successfully installed ${ok} APK(s)`, { id: toastId });
    } else {
      toast.warning(`Finished: ${ok} installed, ${fail} failed`, {
        id: toastId,
      });
    }
    if (ok > 0) {
      invalidatePackages(queryClient);
    }
    setApkPaths([]);
    setIsInstalling(false);
    setInstallProgress(null);
  }

  async function handleUninstall() {
    if (!selectedSerial) {
      return;
    }
    if (selectedPackages.size === 0) {
      return;
    }
    setIsUninstalling(true);
    const list = Array.from(selectedPackages);
    const toastId = toast.loading(`Uninstalling ${list.length} package(s)...`);
    const serial = selectedSerial;

    // Serial uninstalls: concurrent `pm uninstall` on one device races package manager.
    const outcomes = await mapSerial(list, async (pkg) => {
      toast.loading(`Uninstalling: ${pkg}...`, { id: toastId });
      try {
        const output = await UninstallPackage(pkg, serial);
        useLogStore.getState().addLog(`Uninstalled: ${pkg}: ${output}`, 'success');
        return true;
      } catch (error) {
        useLogStore.getState().addLog(`Failed to uninstall ${pkg}: ${error}`, 'error');
        return false;
      }
    });

    const ok = outcomes.filter(Boolean).length;
    const fail = outcomes.length - ok;
    if (fail === 0) {
      toast.success(`Successfully uninstalled ${ok} package(s)`, {
        id: toastId,
      });
    } else {
      toast.warning(`Finished: ${ok} uninstalled, ${fail} failed`, {
        id: toastId,
      });
    }
    if (ok > 0) {
      invalidatePackages(queryClient);
    }
    setSelectedPackages(new Set());
    await loadPackages();
    setIsUninstalling(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Install APK section */}
      <ApkPickerPanel
        apkPaths={apkPaths}
        installProgress={installProgress}
        isInstalling={isInstalling}
        onAddMore={() => {
          void handleSelectApk();
        }}
        onClearAll={() => {
          setApkPaths([]);
        }}
        onInstall={() => {
          void handleInstall();
        }}
        onPathsChange={(paths) => {
          setApkPaths(paths);
        }}
        selectedSerial={selectedSerial}
      />

      <div className="border-t" />

      {/* Uninstall section */}
      <InstalledPackageList
        isLoadingPackages={isLoadingPackages}
        isUninstalling={isUninstalling}
        onPackageFilterChange={(filter) => {
          setPackageFilter(filter);
        }}
        onRefresh={() => {
          void loadPackages();
        }}
        onSearchQueryChange={(query) => {
          setSearchQuery(query);
        }}
        onSelectedPackagesChange={(pkgs) => {
          setSelectedPackages(pkgs);
        }}
        onUninstall={() => {
          void handleUninstall();
        }}
        packageFilter={packageFilter}
        packages={packages}
        searchQuery={searchQuery}
        selectedPackages={selectedPackages}
        selectedSerial={selectedSerial}
      />
    </div>
  );
}
