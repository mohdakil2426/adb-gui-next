import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  DebloatPackages,
  GetDebloatData,
  GetDebloatDeviceSettings,
  SaveDebloatDeviceSettings,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { applyFilters, useDebloatStore } from '@/features/app-manager/debloater/model/debloatStore';
import { useLogStore } from '@/shared/stores/logStore';
import { handleError } from '@/shared/utils/errorHandler';
import { DebloaterPackageList } from './DebloaterPackageList';
import { DebloaterToolbar } from './DebloaterToolbar';
import { DescriptionPanel } from './DescriptionPanel';
import { ReviewSelectionDialog } from './ReviewSelectionDialog';

export function DebloaterTab() {
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

  const [reviewOpen, setReviewOpen] = useState(false);

  // Load settings + packages once on mount
  const loadAll = useCallback(async () => {
    setIsLoadingPackages(true);
    try {
      const data = await GetDebloatData();
      setPackages(data.packages);
      setListStatus(data.list_status);
      setDisableMode(data.settings.disableMode);
      setExpertMode(data.settings.expertMode);
      setBackups(data.backups);
    } catch (error) {
      handleError('Debloater', error);
    } finally {
      setIsLoadingPackages(false);
    }
  }, [setIsLoadingPackages, setDisableMode, setExpertMode, setPackages, setListStatus, setBackups]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Persist settings changes
  async function handleDisableModeChange(value: boolean) {
    setDisableMode(value);
    try {
      const settings = await GetDebloatDeviceSettings();
      await SaveDebloatDeviceSettings({ ...settings, disableMode: value });
    } catch {
      /* best-effort */
    }
  }

  async function handleExpertModeChange(value: boolean) {
    setExpertMode(value);
    try {
      const settings = await GetDebloatDeviceSettings();
      await SaveDebloatDeviceSettings({ ...settings, expertMode: value });
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
    setIsApplying(true);
    try {
      const results = await DebloatPackages(pkgNames, action, 0);
      applyResults(results);

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (failed === 0) {
        toast.success(
          `${action === 'disable' ? 'Disabled' : 'Uninstalled'} ${succeeded} package${succeeded === 1 ? '' : 's'}`,
        );
        useLogStore.getState().addLog(`Debloat: ${action} ${succeeded} packages`, 'success');
      } else {
        toast.warning(`Done: ${succeeded} succeeded, ${failed} failed`);
        useLogStore.getState().addLog(`Debloat: ${failed} failures`, 'error');
      }
    } catch (error) {
      handleError('Debloat', error);
    } finally {
      setIsApplying(false);
      setReviewOpen(false);
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
        stateFilter={stateFilter}
      />

      <DebloaterPackageList
        currentPackageName={currentPackageName}
        expertMode={expertMode}
        filteredPackages={filteredPackages}
        isApplying={isApplying}
        isLoadingPackages={isLoadingPackages}
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
      />

      {/* ── Description panel ───────────────────────────────────────────────── */}
      <div className="min-h-20 rounded-lg border bg-muted/20 px-4 py-3">
        <DescriptionPanel pkg={currentPackage} />
      </div>

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
