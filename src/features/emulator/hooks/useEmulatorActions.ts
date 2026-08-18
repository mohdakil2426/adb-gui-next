import type { QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { LaunchAvd, OpenFolder, RestoreAvdBackups, StopAvd } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useEmulatorManagerStore } from '@/features/emulator/model/emulatorManagerStore';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';
import { invalidateAvds } from '@/shared/utils/queries';

interface UseEmulatorActionsParams {
  launchBlockedReason: string | null;
  queryClient: QueryClient;
  refetch: () => Promise<{ error?: unknown }>;
  selectedAvd: backend.AvdSummary | null;
}

export function useEmulatorActions({
  launchBlockedReason,
  queryClient,
  refetch,
  selectedAvd,
}: UseEmulatorActionsParams) {
  const pendingAction = useEmulatorManagerStore((state) => state.pendingAction);
  const launchOptions = useEmulatorManagerStore((state) => state.launchOptions);
  const setRestorePlan = useEmulatorManagerStore((state) => state.setRestorePlan);
  const setPendingAction = useEmulatorManagerStore((state) => state.setPendingAction);

  const refreshAvds = useCallback(async () => {
    const result = await refetch();
    if (result.error) {
      throw result.error;
    }
  }, [refetch]);

  const runAction = useCallback(
    async (
      action: Exclude<typeof pendingAction, null>,
      task: () => Promise<void>,
      fallbackMessage: string,
    ) => {
      try {
        setPendingAction(action);
        await task();
      } catch (error) {
        handleError('Emulator', error instanceof Error ? error : new Error(fallbackMessage));
      } finally {
        setPendingAction(null);
      }
    },
    [pendingAction, setPendingAction],
  );

  const handleLaunch = useCallback(
    async (options?: backend.EmulatorLaunchOptions) => {
      if (!selectedAvd) {
        return;
      }
      if (!options && launchBlockedReason) {
        return;
      }
      const effective = options ?? launchOptions;
      await runAction(
        'launch',
        async () => {
          const message = await LaunchAvd(selectedAvd.name, effective);
          handleSuccess('Emulator', message);
          invalidateAvds(queryClient);
          await refreshAvds();
        },
        `Failed to launch ${selectedAvd.name}. Check that Android Studio's emulator binary is on PATH.`,
      );
    },
    [selectedAvd, launchBlockedReason, launchOptions, runAction, queryClient, refreshAvds],
  );

  const handleStop = useCallback(async () => {
    if (!selectedAvd) {
      return;
    }
    await runAction(
      'stop',
      async () => {
        const message = await StopAvd(selectedAvd.serial ?? selectedAvd.name);
        handleSuccess('Emulator', message);
        invalidateAvds(queryClient);
        await refreshAvds();
      },
      `Failed to stop ${selectedAvd.name}.`,
    );
  }, [selectedAvd, runAction, queryClient, refreshAvds]);

  const handleOpenFolder = useCallback(async () => {
    if (!selectedAvd) {
      return;
    }
    try {
      await OpenFolder(selectedAvd.avdPath);
    } catch (error) {
      handleError(
        'Emulator',
        error instanceof Error ? error : new Error('Failed to open AVD folder.'),
      );
    }
  }, [selectedAvd]);

  const handleRefresh = useCallback(async () => {
    await runAction(
      'refreshPlan',
      async () => {
        await refreshAvds();
      },
      'Failed to refresh AVD list.',
    );
  }, [runAction, refreshAvds]);

  const handleRestoreConfirmed = useCallback(async () => {
    if (!selectedAvd) {
      return;
    }
    await runAction(
      'restore',
      async () => {
        const message = await RestoreAvdBackups(selectedAvd.name);
        handleSuccess('Emulator', message || `Restored backup files for ${selectedAvd.name}.`);
        setRestorePlan(null);
        invalidateAvds(queryClient);
        await refreshAvds();
      },
      `Failed to restore backups for ${selectedAvd.name}.`,
    );
  }, [selectedAvd, runAction, setRestorePlan, queryClient, refreshAvds]);

  return {
    handleLaunch,
    handleOpenFolder,
    handleRefresh,
    handleRestoreConfirmed,
    handleStop,
    refreshAvds,
    runAction,
  };
}
