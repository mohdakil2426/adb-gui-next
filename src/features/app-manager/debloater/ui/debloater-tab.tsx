import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";

import {
  GetDebloatData,
  GetDebloatDeviceSettings,
  SaveDebloatDeviceSettings,
} from "@/desktop/backend";
import {
  applyFilters,
  useDebloatStore,
} from "@/features/app-manager/debloater/model/debloat-store";
import { useDeviceStore } from "@/shared/stores/device-store";
import { handleError } from "@/shared/utils/error-handler";

import { BackupRestorePanel } from "./backup-restore-panel";
import { DebloaterPackageList } from "./debloater-package-list";
import { DebloaterToolbar } from "./debloater-toolbar";
import { DescriptionPanel } from "./description-panel";
import { ReviewSelectionDialog } from "./review-selection-dialog";
import { SafetyTierLegend } from "./safety-tier-legend";
import { useDebloatOperations } from "./use-debloat-operations";

export const DebloaterTab = () => {
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const packages = useDebloatStore((s) => s.packages);
  const listStatus = useDebloatStore((s) => s.listStatus);
  const isLoadingPackages = useDebloatStore((s) => s.isLoadingPackages);
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
  const setBackups = useDebloatStore((s) => s.setBackups);
  const resetFilters = useDebloatStore((s) => s.resetFilters);

  const {
    handleBatchApply,
    handleSinglePackageAction,
    isApplying,
    pendingPackageNames,
    reviewOpen,
    setReviewOpen,
  } = useDebloatOperations({ disableMode, selectedPackages, selectedSerial });

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
      handleError("Debloater", error);
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

  const handleDisableModeChange = async (value: boolean) => {
    setDisableMode(value);
    try {
      const settings = await GetDebloatDeviceSettings(selectedSerial);
      await SaveDebloatDeviceSettings({ ...settings, disableMode: value }, selectedSerial);
    } catch {
      /* best-effort */
    }
  };

  const handleExpertModeChange = async (value: boolean) => {
    setExpertMode(value);
    try {
      const settings = await GetDebloatDeviceSettings(selectedSerial);
      await SaveDebloatDeviceSettings({ ...settings, expertMode: value }, selectedSerial);
    } catch {
      /* best-effort */
    }
  };

  const filteredPackages = useMemo(
    () =>
      applyFilters(packages, {
        listFilter,
        removalFilter,
        searchQuery,
        stateFilter,
      }),
    [packages, listFilter, removalFilter, stateFilter, searchQuery]
  );

  const currentPackage = useMemo(
    () => packages.find((p) => p.name === currentPackageName) ?? null,
    [packages, currentPackageName]
  );

  const handleSelectAllRecommended = useCallback(() => {
    const recommendedNames = new Set(selectedPackages);
    for (const p of filteredPackages) {
      if (p.removal === "Recommended" && p.state === "Enabled") {
        recommendedNames.add(p.name);
      }
    }
    useDebloatStore.setState({ selectedPackages: recommendedNames });
    toast.info(`Selected ${recommendedNames.size} packages`);
  }, [filteredPackages, selectedPackages]);

  return (
    <div className="flex flex-col gap-3.5">
      <DebloaterToolbar
        disableMode={disableMode}
        expertMode={expertMode}
        filteredCount={filteredPackages.length}
        isLoadingPackages={isLoadingPackages}
        listFilter={listFilter}
        listStatusLabel={
          listStatus
            ? `UAD ${listStatus.source === "remote" ? "✓" : "○"} ${listStatus.lastUpdated}`
            : null
        }
        onDisableModeChange={(v) => {
          void handleDisableModeChange(v);
        }}
        onExpertModeChange={(v) => {
          void handleExpertModeChange(v);
        }}
        onListFilterChange={setListFilter}
        onRefresh={() => {
          void loadAll();
        }}
        onRemovalFilterChange={setRemovalFilter}
        onSearchQueryChange={setSearchQuery}
        onStateFilterChange={setStateFilter}
        packages={packages}
        packagesCount={packages.length}
        removalFilter={removalFilter}
        searchQuery={searchQuery}
        selectedCount={selectedPackages.size}
        selectedSerial={selectedSerial}
        stateFilter={stateFilter}
      />
      <SafetyTierLegend expertMode={expertMode} />
      <DebloaterPackageList
        currentPackageName={currentPackageName}
        filteredPackages={filteredPackages}
        flags={{
          disableMode,
          expertMode,
          hasPackages: packages.length > 0,
          isApplying,
          isLoadingPackages,
        }}
        onClearFilters={resetFilters}
        onCurrentPackageNameChange={setCurrentPackageName}
        onReview={() => setReviewOpen(true)}
        onSelectAllRecommended={handleSelectAllRecommended}
        onSelectToggle={togglePackage}
        onSelectUnselectAll={() => {
          if (selectedPackages.size > 0) {
            unselectAll();
          } else {
            selectAll();
          }
        }}
        onSingleAction={handleSinglePackageAction}
        pendingPackageNames={pendingPackageNames}
        selectedPackages={selectedPackages}
        selectedSerial={selectedSerial}
      />
      {currentPackage ? (
        <DescriptionPanel
          disableMode={disableMode}
          expertMode={expertMode}
          isPending={pendingPackageNames.has(currentPackage.name)}
          onClose={() => setCurrentPackageName(null)}
          onSingleAction={handleSinglePackageAction}
          pkg={currentPackage}
          selectedSerial={selectedSerial}
        />
      ) : null}
      <BackupRestorePanel />
      <ReviewSelectionDialog
        disableMode={disableMode}
        isApplying={isApplying}
        onConfirm={handleBatchApply}
        onOpenChange={setReviewOpen}
        open={reviewOpen}
        packages={packages}
        selectedPackages={selectedPackages}
      />
    </div>
  );
};
