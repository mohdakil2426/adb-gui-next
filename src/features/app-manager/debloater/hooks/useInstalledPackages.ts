import { useCallback, useEffect } from 'react';
import { GetInstalledPackages } from '@/desktop/backend';
import { useInstallationStore } from '@/features/app-manager/debloater/model/installationStore';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { handleError } from '@/shared/utils/errorHandler';

export interface InstalledPackagesController {
  /** Why the last load failed, or `null`. `hasLoaded` alone cannot tell the two apart. */
  error: string | null;
  /** `true` once a load for the current serial has settled (success or failure). */
  hasLoaded: boolean;
  isLoading: boolean;
  refresh: () => void;
  selectedSerial: string | null;
}

/**
 * Owns "which device's package list is in the store".
 *
 * This used to live inside the install tab, so the list only loaded once that
 * tab was mounted and the view-level composition summary had nothing to show.
 * Mount it **once** per view — two callers would double the `pm list` round-trip.
 */
export function useInstalledPackages(): InstalledPackagesController {
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const isLoading = useInstallationStore((s) => s.isLoadingPackages);
  const loadedSerial = useInstallationStore((s) => s.loadedSerial);
  const setPackages = useInstallationStore((s) => s.setPackages);
  const setIsLoadingPackages = useInstallationStore((s) => s.setIsLoadingPackages);
  const setLoadedSerial = useInstallationStore((s) => s.setLoadedSerial);
  const setSelectedPackages = useInstallationStore((s) => s.setSelectedPackages);
  const packagesError = useInstallationStore((s) => s.packagesError);
  const setPackagesError = useInstallationStore((s) => s.setPackagesError);

  const load = useCallback(async () => {
    if (!selectedSerial) {
      setPackages([]);
      setPackagesError(null);
      setLoadedSerial(null);
      return;
    }
    setIsLoadingPackages(true);
    try {
      const list = await GetInstalledPackages(selectedSerial);
      setPackages(list ?? []);
      setPackagesError(null);
    } catch (error) {
      handleError('Load Packages', error);
      // A toast is transient; without this the list renders its neutral "this
      // device reported no packages" copy for what was a failed `pm list`.
      setPackages([]);
      setPackagesError(error instanceof Error ? error.message : String(error));
    } finally {
      // Marked loaded even on failure, otherwise the effect below retries forever.
      setLoadedSerial(selectedSerial);
      setIsLoadingPackages(false);
    }
  }, [selectedSerial, setIsLoadingPackages, setLoadedSerial, setPackages, setPackagesError]);

  useEffect(() => {
    // Reload when the selected device changes — not when the list is merely empty.
    if (selectedSerial !== loadedSerial) {
      setSelectedPackages(new Set());
      void load();
    }
  }, [load, loadedSerial, selectedSerial, setSelectedPackages]);

  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return {
    error: packagesError,
    hasLoaded: selectedSerial !== null && selectedSerial === loadedSerial,
    isLoading,
    refresh,
    selectedSerial,
  };
}
