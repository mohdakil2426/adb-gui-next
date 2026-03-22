import { toast } from 'sonner';
import { useLogStore } from './logStore';

export function handleError(context: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const fullMessage = `[${context}] ${message}`;

  useLogStore.getState().addLog(fullMessage, 'error');
  toast.error(context, { description: message });

  return fullMessage;
}

export function handleSuccess(context: string, message: string): void {
  useLogStore.getState().addLog(`[${context}] ${message}`, 'success');
  toast.success(context, { description: message });
}

export function handleInfo(context: string, message: string): void {
  useLogStore.getState().addLog(`[${context}] ${message}`, 'info');
}

export function handleWarning(context: string, message: string): void {
  useLogStore.getState().addLog(`[${context}] ${message}`, 'warning');
  toast.warning(context, { description: message });
}
