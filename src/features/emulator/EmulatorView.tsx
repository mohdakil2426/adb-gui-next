import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, MonitorSmartphone, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  GetAvdRestorePlan,
  LaunchAvd,
  OpenFolder,
  RestoreAvdBackups,
  StopAvd,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import {
  type EmulatorManagerTab,
  useEmulatorManagerStore,
} from '@/features/emulator/model/emulatorManagerStore';
import { EmulatorLaunchTab } from '@/features/emulator/ui/EmulatorLaunchTab';
import { EmulatorRestoreTab } from '@/features/emulator/ui/EmulatorRestoreTab';
import { EmulatorRootTab } from '@/features/emulator/ui/EmulatorRootTab';
import { EmulatorToolbar } from '@/features/emulator/ui/EmulatorToolbar';
import { EmptyState } from '@/shared/components/EmptyState';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { cn } from '@/shared/utils/cn';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';
import { fetchAvds, invalidateAvds, queryKeys } from '@/shared/utils/queries';

function createPresetOptions(preset: 'default' | 'coldBoot'): backend.EmulatorLaunchOptions {
  return {
    wipeData: false,
    writableSystem: false,
    coldBoot: preset === 'coldBoot',
    noSnapshotLoad: preset === 'coldBoot',
    noSnapshotSave: preset === 'coldBoot',
    noBootAnim: false,
  };
}
export function ViewEmulatorManager() {
  const {
    data: avds = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.avds(),
    queryFn: fetchAvds,
    refetchInterval: 5000,
  });
  const selectedAvdName = useEmulatorManagerStore((state) => state.selectedAvdName);
  const activeTab = useEmulatorManagerStore((state) => state.activeTab);
  const restorePlan = useEmulatorManagerStore((state) => state.restorePlan);
  const pendingAction = useEmulatorManagerStore((state) => state.pendingAction);
  const setSelectedAvdName = useEmulatorManagerStore((state) => state.setSelectedAvdName);
  const setActiveTab = useEmulatorManagerStore((state) => state.setActiveTab);
  const setRestorePlan = useEmulatorManagerStore((state) => state.setRestorePlan);
  const setPendingAction = useEmulatorManagerStore((state) => state.setPendingAction);
  const [isRestorePlanLoading, setIsRestorePlanLoading] = useState(false);
  const queryClient = useQueryClient();
  const selectedAvd = avds.find((item) => item.name === selectedAvdName) ?? null;
  const isBusy = pendingAction !== null;
  const isRefreshing = isFetching && pendingAction === 'refreshPlan';
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
  // Load restore plan on AVD change
  useEffect(() => {
    let cancelled = false;
    async function loadRestorePlan() {
      if (!selectedAvd?.ramdiskPath) {
        setRestorePlan(null);
        return;
      }
      setIsRestorePlanLoading(true);
      try {
        const plan = await GetAvdRestorePlan(selectedAvd.name);
        if (!cancelled) {
          setRestorePlan(plan);
        }
      } catch {
        if (!cancelled) {
          setRestorePlan(null);
        }
      } finally {
        if (!cancelled) {
          setIsRestorePlanLoading(false);
        }
      }
    }
    void loadRestorePlan();
    return () => {
      cancelled = true;
    };
  }, [selectedAvd, setRestorePlan]);
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
  async function handleLaunch(options: backend.EmulatorLaunchOptions) {
    if (!selectedAvd) {
      return;
    }
    await runAction(
      'launch',
      async () => {
        const message = await LaunchAvd(selectedAvd.name, options);
        handleSuccess('Emulator', message);
        invalidateAvds(queryClient);
        await refreshAvds();
      },
      `Failed to launch ${selectedAvd.name}`,
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
      `Failed to stop ${selectedAvd.name}`,
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
      'Failed to refresh emulator roster',
    );
  }
  async function handleRestore() {
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
      `Failed to restore ${selectedAvd.name}`,
    );
  }
  return (
    <div className="flex flex-col gap-5 pb-10">
      {/* ── Row 1: Page header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          <div>
            <h1 className="sr-only">Emulator Manager</h1>
            <p className="text-muted-foreground text-sm">
              Manage AVDs, launch with safe presets, and run root / restore workflows.
            </p>
          </div>
        </div>
        {/* Refresh — top-right of header */}
        <Button
          className="shrink-0"
          disabled={isBusy || isRefreshing}
          onClick={() => void handleRefresh()}
          size="sm"
          variant="ghost"
        >
          <RefreshCcw className={cn('size-4', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
      <EmulatorToolbar
        avds={avds}
        isBusy={isBusy}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        onColdBoot={() => void handleLaunch(createPresetOptions('coldBoot'))}
        onLaunch={() => void handleLaunch(createPresetOptions('default'))}
        onOpenFolder={() => void handleOpenFolder()}
        onRefresh={() => void handleRefresh()}
        onSelectAvd={setSelectedAvdName}
        onStop={() => void handleStop()}
        selectedAvd={selectedAvd}
        selectedAvdName={selectedAvdName}
      />
      {/* ── Card: content only (tabs flush at top) ────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {selectedAvd ? (
            <Tabs
              onValueChange={(value) => {
                setActiveTab(value as EmulatorManagerTab);
              }}
              value={activeTab === 'overview' ? 'launch' : activeTab}
            >
              <TabsList
                className="w-full justify-start rounded-none rounded-t-xl border-b px-4"
                variant="line"
              >
                <TabsTrigger value="launch">Launch</TabsTrigger>
                <TabsTrigger value="root">Root</TabsTrigger>
                <TabsTrigger value="restore">Restore</TabsTrigger>
              </TabsList>
              <div className="p-6">
                <TabsContent value="launch">
                  <EmulatorLaunchTab
                    avd={selectedAvd}
                    isLaunching={pendingAction === 'launch'}
                    onLaunch={handleLaunch}
                  />
                </TabsContent>
                <TabsContent value="root">
                  <EmulatorRootTab avd={selectedAvd} onLaunch={handleLaunch} />
                </TabsContent>
                <TabsContent value="restore">
                  <EmulatorRestoreTab
                    avd={selectedAvd}
                    isLoadingPlan={isRestorePlanLoading}
                    isRestoring={pendingAction === 'restore'}
                    onRestore={handleRestore}
                    restorePlan={restorePlan}
                  />
                </TabsContent>
              </div>
            </Tabs>
          ) : (
            <EmptyState
              className="py-16"
              description={
                isLoading
                  ? 'Looking for Android Studio virtual devices.'
                  : 'Use the emulator switcher above to pick an AVD and begin.'
              }
              icon={MonitorSmartphone}
              title={isLoading ? 'Scanning AVDs…' : 'No AVD selected'}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
