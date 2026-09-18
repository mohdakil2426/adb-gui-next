import { toast } from "sonner";

import { useLogStore } from "@/shared/stores/log-store";

export const handleError = (context: string, err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err);
  const fullMessage = `[${context}] ${message}`;

  useLogStore.getState().addLog(fullMessage, "error");
  toast.error(context, { description: message });

  return fullMessage;
};

export const handleSuccess = (context: string, message: string): void => {
  useLogStore.getState().addLog(`[${context}] ${message}`, "success");
  toast.success(context, { description: message });
};

export const handleInfo = (context: string, message: string): void => {
  useLogStore.getState().addLog(`[${context}] ${message}`, "info");
};

export const handleWarning = (context: string, message: string): void => {
  useLogStore.getState().addLog(`[${context}] ${message}`, "warning");
  toast.warning(context, { description: message });
};
