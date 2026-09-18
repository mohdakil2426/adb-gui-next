import { useCallback, useState } from "react";
import { toast } from "sonner";

import { DebloatPackages } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { useDebloatStore } from "@/features/app-manager/debloater/model/debloat-store";
import { useLogStore } from "@/shared/stores/log-store";
import { finishOperation, startOperation, updateOperation } from "@/shared/stores/operation-store";
import { handleError } from "@/shared/utils/error-handler";

interface UseDebloatOperationsProps {
  disableMode: boolean;
  selectedPackages: Set<string>;
  selectedSerial: string | null;
}
const VERB_BY_ACTION: Record<backend.DebloatAction, string> = {
  disable: "Disabling",
  restore: "Restoring",
  uninstall: "Uninstalling",
};

const PAST_BY_ACTION: Record<backend.DebloatAction, string> = {
  disable: "Disabled",
  restore: "Re-enabled",
  uninstall: "Uninstalled",
};

export const useDebloatOperations = ({
  disableMode,
  selectedPackages,
  selectedSerial,
}: UseDebloatOperationsProps) => {
  const isApplying = useDebloatStore((s) => s.isApplying);
  const setIsApplying = useDebloatStore((s) => s.setIsApplying);
  const applyResults = useDebloatStore((s) => s.applyResults);

  const [pendingPackageNames, setPendingPackageNames] = useState<Set<string>>(new Set());
  const [reviewOpen, setReviewOpen] = useState(false);

  const handleSinglePackageAction = useCallback(
    async (pkg: backend.DebloatPackageRow, action: backend.DebloatAction) => {
      if (!selectedSerial) {
        return;
      }
      const verb = VERB_BY_ACTION[action] ?? "Restoring";
      const toastId = toast.loading(`${verb} ${pkg.name}…`);
      setPendingPackageNames((prev) => new Set(prev).add(pkg.name));
      try {
        const results = await DebloatPackages([pkg.name], action, 0, selectedSerial);
        applyResults(results);
        const [res] = results;
        if (res?.success) {
          const past = PAST_BY_ACTION[action] ?? "Re-enabled";
          toast.success(`${past} ${pkg.name}`, { id: toastId });
          useLogStore.getState().addLog(`Debloat: ${action} ${pkg.name}`, "success");
        } else {
          toast.error(res?.error || `Failed to ${action} ${pkg.name}`, {
            id: toastId,
          });
          useLogStore.getState().addLog(`Debloat failed for ${pkg.name}: ${res?.error}`, "error");
        }
      } catch (error) {
        toast.dismiss(toastId);
        handleError(`Debloat ${action}`, error);
      } finally {
        setPendingPackageNames((prev) => {
          const next = new Set(prev);
          next.delete(pkg.name);
          return next;
        });
      }
    },
    [applyResults, selectedSerial]
  );

  const handleBatchApply = useCallback(async () => {
    const pkgNames = [...selectedPackages];
    const action: backend.DebloatAction = disableMode ? "disable" : "uninstall";
    const verb = action === "disable" ? "Disabling" : "Uninstalling";
    const total = pkgNames.length;
    setReviewOpen(false);
    setIsApplying(true);
    const operationId = startOperation({
      detail: `0 of ${total}`,
      label: `${verb} ${total} package${total === 1 ? "" : "s"}`,
      progress: 0,
      view: "apps",
    });
    const toastId = toast.loading(`${verb} 0 of ${total}…`);
    try {
      const results = await DebloatPackages(pkgNames, action, 0, selectedSerial);
      updateOperation(operationId, {
        detail: `${total} of ${total}`,
        progress: 100,
      });
      applyResults(results);
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      if (failed === 0) {
        toast.success(
          `${action === "disable" ? "Disabled" : "Uninstalled"} ${succeeded} package${succeeded === 1 ? "" : "s"}`,
          { id: toastId }
        );
        useLogStore.getState().addLog(`Debloat: ${action} ${succeeded} packages`, "success");
      } else {
        toast.warning(`Done: ${succeeded} succeeded, ${failed} failed`, {
          id: toastId,
        });
        useLogStore.getState().addLog(`Debloat: ${failed} failures`, "error");
      }
    } catch (error) {
      toast.dismiss(toastId);
      handleError("Debloat", error);
    } finally {
      finishOperation(operationId);
      setIsApplying(false);
    }
  }, [applyResults, disableMode, selectedPackages, selectedSerial, setIsApplying]);

  return {
    handleBatchApply,
    handleSinglePackageAction,
    isApplying,
    pendingPackageNames,
    reviewOpen,
    setReviewOpen,
  };
};
