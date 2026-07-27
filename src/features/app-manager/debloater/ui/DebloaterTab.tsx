import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  GetDebloatData,
  GetDebloatDeviceSettings,
  SaveDebloatDeviceSettings,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { applyFilters, useDebloatStore } from '@/features/app-manager/debloater/model/debloatStore';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useLogStore } from '@/shared/stores/logStore';
import { finishOperation, startOperation, updateOperation } from '@/shared/stores/operationStore';
import { handleError } from '@/shared/utils/errorHandler';
import { BackupRestorePanel } from './BackupRestorePanel';
import { DebloaterPackageList } from './DebloaterPackageList';
import { DebloaterToolbar } from './DebloaterToolbar';
import { DescriptionPanel } from './DescriptionPanel';
import { applyInChunks } from './debloatApply';
import { ReviewSelectionDialog } from './ReviewSelectionDialog';
import { SafetyTierLegend } from './SafetyTierLegend';

export function DebloaterTab() {
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const packages = useDebloatStore((s) => s.packages);
  const listStatus = useDebloatStore((s) => s.listStatus);
  const isLoadingPackages = useDebloatStore((s) => s.isLoadingPackages);
  const isApplying = useDebloatStore((s) => s.isApplying);
  const searchQuery = useDebloatStore((s) => s.searchQuery);
  const listFilter = useDebloatStore((s) => s.listFilter);
  const removalFilter = useDebloatStore((s) => s.removalFilter);
  const stateFilter = useDebloatStore((s) => s.stateFilter);
  const selectedPackages = useDebloatStore((s) => s.selectedPackages);
  const currentPackageName = useDebloatStore((s) => s.currentPackageName);
  const expertMode = useDebloatStore((s) => s.expertMode);
  const disableMode = useDebloatStore((s) => s.disableMode);

  const setPackages = useDebloatStore((s) => s.setPackages);
  const setListStatus = useDebloatStore((s) => s.setListStatus);
  const setIsLoadingPackages = useDebloatStore((s) => s.setIsLoadingPackages);
  const setIsApplying = useDebloatStore((s) => s.setIsApplying);
  const setSearchQuery = useDebloatStore((s) => s.setSearchQuery);
  const setListFilter = useDebloatStore((s) => s.setListFilter);
  const setRemovalFilter = useDebloatStore((s) => s.setRemovalFilter);
  const setStateFilter = useDebloatStore((s) => s.setStateFilter);
  const togglePackage = useDebloatStore((s) => s.togglePackage);
  const selectAll = useDebloatStore((s) => s.selectAll);
  const unselectAll = useDebloatStore((s) => s.unselectAll);
  const setCurrentPackageName = useDebloatStore((s) => s.setCurrentPackageName);
  const setExpertMode = useDebloatStore((s) => s.setExpertMode);
  const setDisableMode = useDebloatStore((s) => s.setDisableMode);
  const applyResults = useDebloatStore((s) => s.applyResults);
  const setBackups = useDebloatStore((s) => s.setBackups);
  const resetFilters = useDebloatStore((s) => s.resetFilters);

  const [reviewOpen, setReviewOpen] = useState(false);

  // Load settings + packages; reload when selected device changes
  const loadAll = useCallback(async () => {
    if (!selectedSerial) {
      setPackages([]);
      setListStatus(null);
      setBackups([]);
      return;
    }
    setIsLoadingPackages(true);
    try {
      const data = await GetDebloatData(selectedSerial);
      setPackages(data.packages);
      setListStatus(data.listStatus);
      setDisableMode(data.settings.disableMode);
      setExpertMode(data.settings.expertMode);
      setBackups(data.backups);
    } catch (error) {
      handleError('Debloater', error);
    } finally {
      setIsLoadingPackages(false);
    }
  }, [
    selectedSerial,
    setIsLoadingPackages,
    setDisableMode,
    setExpertMode,
    setPackages,
    setListStatus,
    setBackups,
  ]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, selectedSerial]);

  // Persist settings changes
  async function handleDisableModeChange(value: boolean) {
    setDisableMode(value);
    try {
      const settings = await GetDebloatDeviceSettings(selectedSerial);
      await SaveDebloatDeviceSettings({ ...settings, disableMode: value }, selectedSerial);
    } catch {
      /* best-effort */
    }
  }

  async function handleExpertModeChange(value: boolean) {
    setExpertMode(value);
    try {
      const settings = await GetDebloatDeviceSettings(selectedSerial);
      await SaveDebloatDeviceSettings({ ...settings, expertMode: value }, selectedSerial);
    } catch {
      /* best-effort */
    }
  }

  // Filtered list (client-side)
  const filteredPackages = useMemo(
    () =>
      applyFilters(packages, {
        listFilter,
        removalFilter,
        stateFilter,
        searchQuery,
      }),
    [packages, listFilter, removalFilter, stateFilter, searchQuery],
  );

  const currentPackage = useMemo(
    () => packages.find((p) => p.name === currentPackageName) ?? null,
    [packages, currentPackageName],
  );

  async function handleApply() {
    const pkgNames = Array.from(selectedPackages);
    const action: backend.DebloatAction = disableMode ? 'disable' : 'uninstall';
    const verb = action === 'disable' ? 'Disabling' : 'Uninstalling';
    const total = pkgNames.length;

    // Close first: the batch reports itself through the status bar and a
    // determinate toast, so there is no reason to trap the user behind a modal.
    setReviewOpen(false);
    setIsApplying(true);

    const operationId = startOperation({
      detail: `0 of ${total}`,
      label: `${verb} ${total} package${total === 1 ? '' : 's'}`,
      progress: 0,
      view: 'apps',
    });
    const toastId = toast.loading(`${verb} 0 of ${total}…`);

    try {
      const results = await applyInChunks({
        action,
        onProgress: (processed) => {
          updateOperation(operationId, {
            detail: `${processed} of ${total}`,
            progress: Math.round((processed / total) * 100),
          });
          toast.loading(`${verb} ${processed} of ${total}…`, { id: toastId });
        },
        packages: pkgNames,
        serial: selectedSerial,
      });
      applyResults(results);

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed === 0) {
        toast.success(
          `${action === 'disable' ? 'Disabled' : 'Uninstalled'} ${succeeded} package${succeeded === 1 ? '' : 's'}`,
          { id: toastId },
        );
        useLogStore.getState().addLog(`Debloat: ${action} ${succeeded} packages`, 'success');
      } else {
        toast.warning(`Done: ${succeeded} succeeded, ${failed} failed`, { id: toastId });
        useLogStore.getState().addLog(`Debloat: ${failed} failures`, 'error');
      }
    } catch (error) {
      toast.dismiss(toastId);
      handleError('Debloat', error);
    } finally {
      finishOperation(operationId);
      setIsApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <DebloaterToolbar
        disableMode={disableMode}
        expertMode={expertMode}
        filteredCount={filteredPackages.length}
        isLoadingPackages={isLoadingPackages}
        listFilter={listFilter}
        listStatusLabel={
          listStatus
            ? `UAD ${listStatus.source === 'remote' ? '✓' : '○'} ${listStatus.lastUpdated}`
            : null
        }
        onDisableModeChange={(value) => {
          void handleDisableModeChange(value);
        }}
        onExpertModeChange={(value) => {
          void handleExpertModeChange(value);
        }}
        onListFilterChange={setListFilter}
        onRefresh={() => {
          void loadAll();
        }}
        onRemovalFilterChange={setRemovalFilter}
        onSearchQueryChange={setSearchQuery}
        onStateFilterChange={setStateFilter}
        packagesCount={packages.length}
        removalFilter={removalFilter}
        searchQuery={searchQuery}
        selectedSerial={selectedSerial}
        stateFilter={stateFilter}
      />

      <SafetyTierLegend expertMode={expertMode} />

      <DebloaterPackageList
        currentPackageName={currentPackageName}
        expertMode={expertMode}
        filteredPackages={filteredPackages}
        hasPackages={packages.length > 0}
        isApplying={isApplying}
        isLoadingPackages={isLoadingPackages}
        onClearFilters={resetFilters}
        onCurrentPackageNameChange={setCurrentPackageName}
        onReview={() => {
          setReviewOpen(true);
        }}
        onSelectToggle={togglePackage}
        onSelectUnselectAll={() => {
          if (selectedPackages.size > 0) {
            unselectAll();
          } else {
            selectAll();
          }
        }}
        selectedPackages={selectedPackages}
        selectedSerial={selectedSerial}
      />

      {/* Rendered only when a row is highlighted — this used to be a permanently
          reserved empty box holding "Select a package to see details." */}
      {currentPackage ? <DescriptionPanel pkg={currentPackage} /> : null}

      {/* ── Undo path ───────────────────────────────────────────────────────── */}
      <BackupRestorePanel />

      <ReviewSelectionDialog
        disableMode={disableMode}
        isApplying={isApplying}
        onConfirm={handleApply}
        onOpenChange={setReviewOpen}
        open={reviewOpen}
        packages={packages}
        selectedPackages={selectedPackages}
      />
    </div>
  );
}
