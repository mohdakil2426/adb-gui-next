import { toast } from 'sonner';
import { CancelExtraction } from '@/desktop/backend';
import { useLogStore } from '@/shared/stores/logStore';

/** Cooperative cancel: mark UI cancelling and signal the Rust token registry. */
export function cancelPayloadExtraction(
  cancelTokenId: string | null,
  status: string,
  set: (partial: Record<string, unknown>) => void,
): void {
  if (status !== 'extracting' && status !== 'cancelling') {
    return;
  }
  if (!cancelTokenId) {
    toast.error('Cancel token unavailable — use Reset if the UI stays stuck');
    useLogStore.getState().addLog('Cancel requested without a token', 'error');
    set({
      status: 'ready',
      extractingPartitions: new Set<string>(),
      partitionProgress: new Map(),
    });
    return;
  }
  set({ status: 'cancelling' });
  void Promise.resolve(CancelExtraction(cancelTokenId)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('not found')) {
      useLogStore.getState().addLog('Cancel token already released', 'info');
      return;
    }
    toast.error(`Failed to cancel extraction: ${message}`);
    useLogStore.getState().addLog(`Error cancelling extraction: ${message}`, 'error');
  });
}
