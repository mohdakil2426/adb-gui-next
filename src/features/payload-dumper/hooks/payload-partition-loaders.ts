import { toast } from "sonner";

import {
  CheckRemotePayload,
  GetRemotePayloadMetadata,
  ListPayloadPartitionsWithDetails,
  ListRemotePayloadPartitions,
} from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { usePayloadProgressStore } from "@/features/payload-dumper/model/payload-progress-store";
import type { ConnectionStatus } from "@/shared/components/remote-url-panel";
import { useLogStore } from "@/shared/stores/log-store";
import { debugLog } from "@/shared/utils/debug";
import { handleError, handleSuccess } from "@/shared/utils/error-handler";
import { formatBytes } from "@/shared/utils/format";

interface LoaderStoreActions {
  beginLoadProgress?: () => void;
  clearLoadProgress?: () => void;
  setErrorMessage: (message: string) => void;
  setPartitions: (partitions: { name: string; selected: boolean; size: number }[]) => void;
  setPayloadPath: (path: string) => void;
  setRemoteMetadata: (metadata: backend.RemotePayloadMetadata | null) => void;
  setStatus: (status: "error" | "idle" | "loading-partitions" | "ready") => void;
}

export const loadLocalPartitions = async (path: string, actions: LoaderStoreActions) => {
  if (!path) {
    return;
  }
  actions.setStatus("loading-partitions");
  actions.setErrorMessage("");
  useLogStore.getState().addLog("Loading partitions from payload...", "info");

  try {
    debugLog(`Loading partitions from: ${path}`);
    const partitionList = await ListPayloadPartitionsWithDetails(path);
    if (partitionList && partitionList.length > 0) {
      const currentCompleted = usePayloadProgressStore.getState().completedPartitions;
      actions.setPartitions(
        partitionList.map((p) => ({
          name: p.name,
          selected: !currentCompleted.has(p.name),
          size: p.size,
        }))
      );
      actions.setStatus("ready");
      toast.success(`Found ${partitionList.length} partitions`);
      handleSuccess("Load Partitions", `Found ${partitionList.length} partitions`);
      return;
    }
    actions.setErrorMessage("No partitions found in payload");
    actions.setStatus("error");
    useLogStore.getState().addLog("No partitions found in payload", "error");
  } catch (error) {
    actions.setErrorMessage(String(error));
    actions.setStatus("error");
    handleError("Load Partitions", error);
  }
};

export const checkRemoteUrl = async (
  remoteUrl: string,
  setConnectionStatus: (status: ConnectionStatus) => void,
  setEstimatedSize: (size: string | null) => void
) => {
  setConnectionStatus("checking");
  setEstimatedSize(null);
  try {
    const info = await CheckRemotePayload(remoteUrl.trim());
    if (info.supportsRanges) {
      setConnectionStatus("ready");
      setEstimatedSize(formatBytes(info.contentLength));
      toast.success("URL verified - range requests supported");
      useLogStore.getState().addLog(`URL verified: ${formatBytes(info.contentLength)}`, "info");
      return;
    }
    setConnectionStatus("error");
    toast.error("Server does not support range requests");
    useLogStore.getState().addLog("Server does not support range requests", "error");
  } catch (error: unknown) {
    setConnectionStatus("error");
    toast.error(`Failed to check URL: ${error}`);
    handleError("Check Remote URL", error);
  }
};

export const loadRemotePartitions = async (
  remoteUrl: string,
  actions: LoaderStoreActions,
  isCancelled: () => boolean,
  clearCancelled: () => void
) => {
  if (!remoteUrl.trim()) {
    return;
  }
  actions.setStatus("loading-partitions");
  actions.setErrorMessage("");
  actions.beginLoadProgress?.();
  useLogStore.getState().addLog("Loading partitions from remote URL...", "info");

  try {
    debugLog(`Loading remote partitions from: ${remoteUrl}`);
    const partitionList = await ListRemotePayloadPartitions(remoteUrl.trim());
    if (isCancelled()) {
      useLogStore.getState().addLog("Loading partitions cancelled by user", "info");
      actions.setStatus("idle");
      actions.clearLoadProgress?.();
      return;
    }
    if (partitionList && partitionList.length > 0) {
      actions.setPayloadPath(remoteUrl.trim());
      // Factory image ZIPs often contain multi‑GB system/product images. Auto-selecting
      // every partition makes "extract" look stuck while large images stream in the background
      // (user sees a small .img appear and thinks the job finished). Match selective dumpers:
      // only auto-select modest partitions; require explicit selection for large images.
      const AUTO_SELECT_MAX_BYTES = 64 * 1024 * 1024;
      const totalSize = partitionList.reduce((sum, p) => sum + p.size, 0);
      const autoSelectAll = partitionList.length <= 32 && totalSize <= 512 * 1024 * 1024;
      const partitions = partitionList.map((p) => ({
        name: p.name,
        selected: autoSelectAll || p.size <= AUTO_SELECT_MAX_BYTES,
        size: p.size,
      }));
      const selectedCount = partitions.filter((p) => p.selected).length;
      actions.setPartitions(partitions);
      actions.setStatus("ready");
      actions.clearLoadProgress?.();
      if (autoSelectAll) {
        toast.success(`Found ${partitionList.length} partitions`);
      } else {
        toast.success(
          `Found ${partitionList.length} partitions — auto-selected ${selectedCount} small image(s). Review selection before extract.`
        );
      }
      handleSuccess("Load Remote Partitions", `Found ${partitionList.length} partitions`);
      try {
        const metadata = await GetRemotePayloadMetadata(remoteUrl.trim());
        actions.setRemoteMetadata(metadata);
        debugLog("Remote payload metadata loaded");
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        toast.error(`Failed to load remote metadata: ${msg}`);
        useLogStore.getState().addLog(`Metadata fetch failed: ${msg}`, "error");
      }
      return;
    }
    actions.setErrorMessage("No partitions found in remote payload");
    actions.setStatus("error");
    actions.clearLoadProgress?.();
    useLogStore.getState().addLog("No partitions found in remote payload", "error");
  } catch (error) {
    if (isCancelled()) {
      useLogStore.getState().addLog("Loading partitions cancelled by user", "info");
      actions.clearLoadProgress?.();
      return;
    }
    actions.setErrorMessage(String(error));
    actions.setStatus("error");
    actions.clearLoadProgress?.();
    handleError("Load Remote Partitions", error);
  } finally {
    clearCancelled();
  }
};
