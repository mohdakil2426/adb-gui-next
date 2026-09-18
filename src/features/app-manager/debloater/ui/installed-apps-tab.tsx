import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  PackageLifecycleOp,
  PullPackageApk,
  SelectSaveDirectory,
  UninstallPackage,
} from "@/desktop/backend";
import { useInstallationStore } from "@/features/app-manager/debloater/model/installation-store";
import { InstalledBatchBar } from "@/features/app-manager/debloater/ui/installed-batch-bar";
import { InstalledPackageList } from "@/features/app-manager/debloater/ui/installed-package-list";
import { UninstallConfirmDialog } from "@/features/app-manager/debloater/ui/uninstall-confirm-dialog";
import { ConfirmDialog } from "@/shared/components/confirm-dialog";
import { useDeviceStore } from "@/shared/stores/device-store";
import { useLogStore } from "@/shared/stores/log-store";
import { finishOperation, startOperation, updateOperation } from "@/shared/stores/operation-store";
import { invalidatePackages } from "@/shared/utils/queries";
import { runSerial } from "@/shared/utils/serial-async";

const PERCENT = 100;

interface InstalledAppsTabProps {
  hasLoaded: boolean;
  loadError: string | null;
  onInspect?: ((packageName: string) => void) | undefined;
  onRefresh: () => void;
}

export const InstalledAppsTab = ({
  hasLoaded,
  loadError,
  onInspect,
  onRefresh,
}: InstalledAppsTabProps) => {
  const packages = useInstallationStore((s) => s.packages);
  const isLoadingPackages = useInstallationStore((s) => s.isLoadingPackages);
  const selectedPackages = useInstallationStore((s) => s.selectedPackages);
  const searchQuery = useInstallationStore((s) => s.searchQuery);
  const packageFilter = useInstallationStore((s) => s.packageFilter);
  const isUninstalling = useInstallationStore((s) => s.isUninstalling);
  const sortBy = useInstallationStore((s) => s.sortBy);
  const sortOrder = useInstallationStore((s) => s.sortOrder);
  const setSelectedPackages = useInstallationStore((s) => s.setSelectedPackages);
  const setSearchQuery = useInstallationStore((s) => s.setSearchQuery);
  const setPackageFilter = useInstallationStore((s) => s.setPackageFilter);
  const setIsUninstalling = useInstallationStore((s) => s.setIsUninstalling);
  const setSortBy = useInstallationStore((s) => s.setSortBy);
  const setSortOrder = useInstallationStore((s) => s.setSortOrder);

  const [isConfirmUninstallOpen, setIsConfirmUninstallOpen] = useState(false);
  const [isConfirmBatchForceStopOpen, setIsConfirmBatchForceStopOpen] = useState(false);
  const [forceStopTargetPkg, setForceStopTargetPkg] = useState<string | null>(null);
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const queryClient = useQueryClient();
  const handleLaunch = async (pkgName: string) => {
    if (!selectedSerial) {
      return;
    }
    try {
      await PackageLifecycleOp(pkgName, "launch", selectedSerial);
      toast.success(`Launched ${pkgName}`);
    } catch (error) {
      toast.error(`Failed to launch ${pkgName}: ${String(error)}`);
    }
  };

  const handleForceStop = async (pkgName: string) => {
    if (!selectedSerial) {
      return;
    }
    try {
      await PackageLifecycleOp(pkgName, "force_stop", selectedSerial);
      toast.success(`Force stopped ${pkgName}`);
    } catch (error) {
      toast.error(`Failed to force stop ${pkgName}: ${String(error)}`);
    }
  };

  const handleToggleEnable = async (pkgName: string, enable: boolean) => {
    if (!selectedSerial) {
      return;
    }
    const op = enable ? "enable" : "disable";
    try {
      await PackageLifecycleOp(pkgName, op, selectedSerial);
      toast.success(`${enable ? "Enabled" : "Disabled"} ${pkgName}`);
      onRefresh();
    } catch (error) {
      toast.error(`Failed to ${enable ? "enable" : "disable"} ${pkgName}: ${String(error)}`);
    }
  };

  const runBatchLifecycle = async (op: "enable" | "disable" | "force_stop", label: string) => {
    if (!selectedSerial || selectedPackages.size === 0) {
      return;
    }
    const list = [...selectedPackages];
    const results = await Promise.allSettled(
      list.map((p) => PackageLifecycleOp(p, op, selectedSerial))
    );
    const count = results.filter((r) => r.status === "fulfilled").length;
    toast.success(`${label} ${count} packages`);
    setSelectedPackages(new Set());
    onRefresh();
  };

  const handleBatchClearCache = async () => {
    if (!selectedSerial) {
      return;
    }
    try {
      await PackageLifecycleOp("all", "clear_cache", selectedSerial);
      toast.success("Triggered system cache trim");
    } catch (error) {
      toast.error(`Failed to clear cache: ${String(error)}`);
    }
  };

  const handleBatchExportApks = async () => {
    if (!selectedSerial || selectedPackages.size === 0) {
      return;
    }
    const destDir = await SelectSaveDirectory("exported-apks");
    if (!destDir) {
      return;
    }
    const list = [...selectedPackages];
    await Promise.allSettled(list.map((p) => PullPackageApk(p, destDir, selectedSerial)));
    toast.success(`Exported ${list.length} APK(s) to ${destDir}`);
  };
  const handleUninstall = async () => {
    if (!selectedSerial || selectedPackages.size === 0) {
      return;
    }
    setIsUninstalling(true);
    const list = [...selectedPackages];
    const total = list.length;
    const serial = selectedSerial;

    const operationId = startOperation({
      detail: `0 of ${total}`,
      label: `Uninstalling ${total} package${total === 1 ? "" : "s"}`,
      progress: 0,
      view: "apps",
    });
    const toastId = toast.loading(`Uninstalling 0 of ${total}…`);
    let ok = 0;
    let failed = 0;
    // ponytail: serial batch uninstalls required for real-time per-package progress reporting and ADB daemon stability
    await runSerial(list, async (pkg, index) => {
      toast.loading(`Uninstalling ${index + 1} of ${total}: ${pkg}`, {
        id: toastId,
      });
      updateOperation(operationId, {
        detail: `${index} of ${total}`,
        progress: Math.round((index / total) * PERCENT),
      });
      try {
        const output = await UninstallPackage(pkg, serial);
        useLogStore.getState().addLog(`Uninstalled: ${pkg}: ${output}`, "success");
        ok += 1;
      } catch (error) {
        useLogStore.getState().addLog(`Failed to uninstall ${pkg}: ${error}`, "error");
        failed += 1;
      }
    });
    if (failed === 0) {
      toast.success(`Uninstalled ${ok} package${ok === 1 ? "" : "s"}`, {
        id: toastId,
      });
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
    setIsConfirmUninstallOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <InstalledPackageList
        hasLoaded={hasLoaded}
        isLoadingPackages={isLoadingPackages}
        isUninstalling={isUninstalling}
        loadError={loadError}
        onForceStop={(name) => setForceStopTargetPkg(name)}
        onInspect={onInspect}
        onLaunch={handleLaunch}
        onPackageFilterChange={setPackageFilter}
        onRefresh={onRefresh}
        onSearchQueryChange={setSearchQuery}
        onSelectedPackagesChange={setSelectedPackages}
        onSortChange={(nextSortBy, nextSortOrder) => {
          setSortBy(nextSortBy);
          setSortOrder(nextSortOrder);
        }}
        onToggleEnable={handleToggleEnable}
        packageFilter={packageFilter}
        packages={packages}
        searchQuery={searchQuery}
        selectedPackages={selectedPackages}
        selectedSerial={selectedSerial}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />

      <InstalledBatchBar
        isUninstalling={isUninstalling}
        onBatchClearCache={handleBatchClearCache}
        onBatchDisable={() => {
          void runBatchLifecycle("disable", "Disabled");
        }}
        onBatchEnable={() => {
          void runBatchLifecycle("enable", "Enabled");
        }}
        onBatchExportApk={handleBatchExportApks}
        onBatchForceStop={() => setIsConfirmBatchForceStopOpen(true)}
        onBatchUninstall={() => setIsConfirmUninstallOpen(true)}
        onClearSelection={() => setSelectedPackages(new Set())}
        selectedCount={selectedPackages.size}
      />

      <UninstallConfirmDialog
        isUninstalling={isUninstalling}
        onOpenChange={setIsConfirmUninstallOpen}
        onUninstall={handleUninstall}
        open={isConfirmUninstallOpen}
        packages={packages}
        selectedPackages={selectedPackages}
        selectedSerial={selectedSerial}
      />

      {/* Batch Force Stop Confirmation */}
      <ConfirmDialog
        confirmLabel="Force Stop All"
        description={`Are you sure you want to force stop ${selectedPackages.size} selected application(s)? Active background processes will be terminated immediately.`}
        destructive
        onConfirm={() => {
          setIsConfirmBatchForceStopOpen(false);
          void runBatchLifecycle("force_stop", "Force stopped");
        }}
        onOpenChange={setIsConfirmBatchForceStopOpen}
        open={isConfirmBatchForceStopOpen}
        title={`Force stop ${selectedPackages.size} applications?`}
      />

      {/* Single Row Force Stop Confirmation */}
      <ConfirmDialog
        confirmLabel="Force Stop"
        description={`Are you sure you want to force stop ${forceStopTargetPkg}? Any unsaved work or background operations will be terminated.`}
        destructive
        onConfirm={() => {
          const pkg = forceStopTargetPkg;
          setForceStopTargetPkg(null);
          if (pkg) {
            void handleForceStop(pkg);
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setForceStopTargetPkg(null);
          }
        }}
        open={Boolean(forceStopTargetPkg)}
        title={`Force stop ${forceStopTargetPkg}?`}
      />
    </div>
  );
};
