import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, MonitorSmartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LaunchAvd, OpenFolder, RestoreAvdBackups, StopAvd } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useAvdRestorePlan } from '@/features/emulator/hooks/useAvdRestorePlan';
import {
  type EmulatorManagerTab,
  useEmulatorManagerStore,
} from '@/features/emulator/model/emulatorManagerStore';
import { unacknowledgedLaunchOptions } from '@/features/emulator/model/launchOptions';
import { EmulatorLaunchTab } from '@/features/emulator/ui/EmulatorLaunchTab';
import { EmulatorRestoreTab } from '@/features/emulator/ui/EmulatorRestoreTab';
import { EmulatorRootTab } from '@/features/emulator/ui/EmulatorRootTab';
import { EmulatorToolbar } from '@/features/emulator/ui/EmulatorToolbar';
import { RestoreConfirmDialog } from '@/features/emulator/ui/RestoreConfirmDialog';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';
import { fetchAvds, invalidateAvds, queryKeys, STALE_TIME } from '@/shared/utils/queries';

export function ViewEmulatorManager() {
  const {
    data: avds = [],
    error: avdsError,
    isError: isAvdsError,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.avds(),
    queryFn: fetchAvds,
    // Each poll spawns several adb processes (`devices`, then `emu avd name` and a
    // getprop per running emulator). 5s was ~48 spawns/minute while this view was open.
    refetchInterval: STALE_TIME.EMULATOR_LIST,
    staleTime: STALE_TIME.EMULATOR_LIST,
  });
  const selectedAvdName = useEmulatorManagerStore((state) => state.selectedAvdName);
  const activeTab = useEmulatorManagerStore((state) => state.activeTab);
  const restorePlan = useEmulatorManagerStore((state) => state.restorePlan);
  const pendingAction = useEmulatorManagerStore((state) => state.pendingAction);
  const launchOptions = useEmulatorManagerStore((state) => state.launchOptions);
  const launchAcknowledgements = useEmulatorManagerStore((state) => state.launchAcknowledgements);
  const setSelectedAvdName = useEmulatorManagerStore((state) => state.setSelectedAvdName);
  const setActiveTab = useEmulatorManagerStore((state) => state.setActiveTab);
  const setRestorePlan = useEmulatorManagerStore((state) => state.setRestorePlan);
  const setPendingAction = useEmulatorManagerStore((state) => state.setPendingAction);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const selectedAvd = avds.find((item) => item.name === selectedAvdName) ?? null;
  const isRestorePlanLoading = useAvdRestorePlan(selectedAvd);
  const isBusy = pendingAction !== null;
  const isRefreshing = isFetching && pendingAction === 'refreshPlan';
  const unacknowledged = unacknowledgedLaunchOptions(launchOptions, launchAcknowledgements);
  const launchBlockedReason =
    unacknowledged.length === 0
      ? null
      : `${unacknowledged.map((option) => option.label).join(' and ')} needs to be acknowledged in the Launch tab first.`;

  // Auto-select first AVD
  useEffect(() => {
    if (avds.length === 0) {
      setSelectedAvdName(null);
      setRestorePlan(null);
      return;
    }
    if (!(selectedAvdName && avds.some((item) => item.name === selectedAvdName))) {
      setSelectedAvdName(avds[0]?.name ?? null);
    }
  }, [avds, selectedAvdName, setRestorePlan, setSelectedAvdName]);

  async function refreshAvds() {
    const result = await refetch();
    if (result.error) {
      throw result.error;
    }
  }

  async function runAction(
    action: Exclude<typeof pendingAction, null>,
    task: () => Promise<void>,
    fallbackMessage: string,
  ) {
    try {
      setPendingAction(action);
      await task();
    } catch (error) {
      handleError('Emulator', error instanceof Error ? error : new Error(fallbackMessage));
    } finally {
      setPendingAction(null);
    }
  }

  /**
   * The one launch path. `options` is only passed by guided remedies (the root
   * gate's cold boot); everything else launches with the flags configured in the
   * Launch tab, so the toolbar can never silently discard them.
   */
  async function handleLaunch(options?: backend.EmulatorLaunchOptions) {
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
  }

  async function handleStop() {
    const serial = selectedAvd?.serial;
    if (!(selectedAvd && serial)) {
      return;
    }
    await runAction(
      'stop',
      async () => {
        const message = await StopAvd(serial);
        handleSuccess('Emulator', message);
        invalidateAvds(queryClient);
        await refreshAvds();
      },
      `Failed to stop ${selectedAvd.name}. Close the emulator window manually, then refresh.`,
    );
  }

  async function handleOpenFolder() {
    if (!selectedAvd) {
      return;
    }
    try {
      await OpenFolder(selectedAvd.avdPath);
    } catch (error) {
      handleError('Emulator', error);
    }
  }

  async function handleRefresh() {
    await runAction(
      'refreshPlan',
      async () => {
        await refreshAvds();
      },
      'Failed to refresh the emulator roster. Confirm the Android SDK path, then try again.',
    );
  }

  async function handleRestoreConfirmed() {
    setIsRestoreConfirmOpen(false);
    if (!selectedAvd) {
      return;
    }
    await runAction(
      'restore',
      async () => {
        const message = await RestoreAvdBackups(selectedAvd.name);
        handleSuccess('Emulator', message);
        invalidateAvds(queryClient);
        await refreshAvds();
      },
      `Failed to restore ${selectedAvd.name}. Close the emulator, then restore again.`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Emulator Manager</h1>

      <EmulatorToolbar
        avds={avds}
        isBusy={isBusy}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        launchBlockedReason={launchBlockedReason}
        launchOptions={launchOptions}
        onConfigureLaunch={() => {
          setActiveTab('launch');
        }}
        onLaunch={() => void handleLaunch()}
        onOpenFolder={() => void handleOpenFolder()}
        onRefresh={() => void handleRefresh()}
        onSelectAvd={setSelectedAvdName}
        onStop={() => void handleStop()}
        selectedAvd={selectedAvd}
        selectedAvdName={selectedAvdName}
      />

      <Card className="gap-0 rounded-lg border-border bg-surface py-0 shadow-none">
        <CardContent className="p-0">
          {isAvdsError ? (
            // `fetchAvds` throwing (no Android SDK on PATH is the common cause)
            // used to fall through to "No AVD selected", which reads as "you have
            // no virtual devices" for what is a configuration failure.
            <EmptyState
              action={
                <Button
                  disabled={isFetching}
                  onClick={() => void handleRefresh()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              }
              className="py-12"
              description={
                avdsError instanceof Error
                  ? avdsError.message
                  : 'The Android SDK emulator tools could not be reached. Check that Android Studio is installed and its SDK path is on PATH.'
              }
              icon={CircleAlert}
              title="Could not list AVDs"
              tone="danger"
            />
          ) : selectedAvd ? (
            <Tabs
              className="w-full gap-4 p-4"
              onValueChange={(value) => {
                setActiveTab(value as EmulatorManagerTab);
              }}
              value={activeTab}
            >
              <TabsList>
                <TabsTrigger value="launch">Launch</TabsTrigger>
                <TabsTrigger value="root">Root</TabsTrigger>
                <TabsTrigger value="restore">Restore</TabsTrigger>
              </TabsList>
              <TabsContent value="launch">
                <EmulatorLaunchTab
                  avd={selectedAvd}
                  isLaunching={pendingAction === 'launch'}
                  onLaunch={() => void handleLaunch()}
                />
              </TabsContent>
              <TabsContent value="root">
                <EmulatorRootTab
                  avd={selectedAvd}
                  onLaunch={(options) => void handleLaunch(options)}
                />
              </TabsContent>
              <TabsContent value="restore">
                <EmulatorRestoreTab
                  avd={selectedAvd}
                  isLoadingPlan={isRestorePlanLoading}
                  isRestoring={pendingAction === 'restore'}
                  onRequestRestore={() => {
                    setIsRestoreConfirmOpen(true);
                  }}
                  restorePlan={restorePlan}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <EmptyState
              className="py-12"
              description={
                isLoading
                  ? 'Looking for Android Studio virtual devices.'
                  : 'Pick an AVD from the switcher above, or create one in Android Studio first.'
              }
              icon={MonitorSmartphone}
              title={isLoading ? 'Scanning AVDs…' : 'No AVD selected'}
            />
          )}
        </CardContent>
      </Card>

      <RestoreConfirmDialog
        avd={selectedAvd}
        onCancel={() => {
          setIsRestoreConfirmOpen(false);
        }}
        onConfirm={() => void handleRestoreConfirmed()}
        open={isRestoreConfirmOpen}
        restorePlan={restorePlan}
      />
    </div>
  );
}
