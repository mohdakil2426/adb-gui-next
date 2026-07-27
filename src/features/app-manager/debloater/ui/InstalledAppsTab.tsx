import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UninstallPackage } from '@/desktop/backend';
import { useInstallationStore } from '@/features/app-manager/debloater/model/installationStore';
import { InstalledPackageList } from '@/features/app-manager/debloater/ui/InstalledPackageList';
import { mapSerial } from '@/features/app-manager/debloater/ui/mapSerial';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { finishOperation, startOperation, updateOperation } from '@/shared/stores/operationStore';
import { invalidatePackages } from '@/shared/utils/queries';

const PERCENT = 100;

interface InstalledAppsTabProps {
  hasLoaded: boolean;
  loadError: string | null;
  onRefresh: () => void;
}

/**
 * Browsing and removing what is already on the device.
 *
 * This used to sit below the APK picker in a single "Installation" tab,
 * separated by a bare `<div className="border-t" />` — installing an APK and
 * uninstalling apps are unrelated jobs and now have their own tabs.
 */
export function InstalledAppsTab({ hasLoaded, loadError, onRefresh }: InstalledAppsTabProps) {
  const packages = useInstallationStore((s) => s.packages);
  const isLoadingPackages = useInstallationStore((s) => s.isLoadingPackages);
  const selectedPackages = useInstallationStore((s) => s.selectedPackages);
  const searchQuery = useInstallationStore((s) => s.searchQuery);
  const packageFilter = useInstallationStore((s) => s.packageFilter);
  const isUninstalling = useInstallationStore((s) => s.isUninstalling);
  const setSelectedPackages = useInstallationStore((s) => s.setSelectedPackages);
  const setSearchQuery = useInstallationStore((s) => s.setSearchQuery);
  const setPackageFilter = useInstallationStore((s) => s.setPackageFilter);
  const setIsUninstalling = useInstallationStore((s) => s.setIsUninstalling);

  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const queryClient = useQueryClient();

  async function handleUninstall() {
    if (!selectedSerial || selectedPackages.size === 0) {
      return;
    }
    setIsUninstalling(true);
    const list = Array.from(selectedPackages);
    const total = list.length;
    const serial = selectedSerial;

    const operationId = startOperation({
      detail: `0 of ${total}`,
      label: `Uninstalling ${total} package${total === 1 ? '' : 's'}`,
      progress: 0,
      view: 'apps',
    });
    const toastId = toast.loading(`Uninstalling 0 of ${total}…`);

    // Serial uninstalls: concurrent `pm uninstall` on one device races package manager.
    const outcomes = await mapSerial(list, async (pkg, index) => {
      toast.loading(`Uninstalling ${index + 1} of ${total}: ${pkg}`, { id: toastId });
      updateOperation(operationId, {
        detail: `${index} of ${total}`,
        progress: Math.round((index / total) * PERCENT),
      });
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
    const failed = outcomes.length - ok;
    if (failed === 0) {
      toast.success(`Uninstalled ${ok} package${ok === 1 ? '' : 's'}`, { id: toastId });
    } else {
      toast.warning(`Uninstalled ${ok}, ${failed} failed — open the Logs panel for the reason`, {
        id: toastId,
      });
    }
    if (ok > 0) {
      invalidatePackages(queryClient);
    }
    finishOperation(operationId);
    setSelectedPackages(new Set());
    onRefresh();
    setIsUninstalling(false);
  }

  return (
    <InstalledPackageList
      hasLoaded={hasLoaded}
      isLoadingPackages={isLoadingPackages}
      isUninstalling={isUninstalling}
      loadError={loadError}
      onPackageFilterChange={setPackageFilter}
      onRefresh={onRefresh}
      onSearchQueryChange={setSearchQuery}
      onSelectedPackagesChange={setSelectedPackages}
      onUninstall={() => {
        void handleUninstall();
      }}
      packageFilter={packageFilter}
      packages={packages}
      searchQuery={searchQuery}
      selectedPackages={selectedPackages}
      selectedSerial={selectedSerial}
    />
  );
}
