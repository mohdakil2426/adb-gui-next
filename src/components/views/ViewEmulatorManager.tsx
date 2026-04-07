import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvdRoster } from '@/components/emulator-manager/AvdRoster';
import { EmulatorActivityCard } from '@/components/emulator-manager/EmulatorActivityCard';
import { EmulatorHeaderCard } from '@/components/emulator-manager/EmulatorHeaderCard';
import { EmulatorLaunchTab } from '@/components/emulator-manager/EmulatorLaunchTab';
import { EmulatorQuickActions } from '@/components/emulator-manager/EmulatorQuickActions';
import { EmulatorRestoreTab } from '@/components/emulator-manager/EmulatorRestoreTab';
import { EmulatorRootTab } from '@/components/emulator-manager/EmulatorRootTab';
import {
  FinalizeAvdRoot,
  GetAvdRestorePlan,
  LaunchAvd,
  OpenFolder,
  PrepareAvdRoot,
  RestoreAvdBackups,
  StopAvd,
} from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { handleError, handleSuccess } from '@/lib/errorHandler';
import { type EmulatorManagerTab, useEmulatorManagerStore } from '@/lib/emulatorManagerStore';
import { fetchAvds, queryKeys } from '@/lib/queries';
import { Bot } from 'lucide-react';

function createPresetOptions(
  preset: 'default' | 'coldBoot' | 'headless',
): backend.EmulatorLaunchOptions {
  return {
    wipeData: false,
    writableSystem: false,
    headless: preset === 'headless',
    coldBoot: preset === 'coldBoot',
    noSnapshotLoad: preset === 'coldBoot',
    noSnapshotSave: preset === 'coldBoot',
    noBootAnim: false,
    netSpeed: null,
    netDelay: null,
  };
}

function formatRootState(state: backend.AvdRootState): string {
  switch (state) {
    case 'rooted':
      return 'Rooted';
    case 'modified':
      return 'Modified';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Stock';
  }
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
  const rootSession = useEmulatorManagerStore((state) => state.rootSession);
  const restorePlan = useEmulatorManagerStore((state) => state.restorePlan);
  const pendingAction = useEmulatorManagerStore((state) => state.pendingAction);
  const setSelectedAvdName = useEmulatorManagerStore((state) => state.setSelectedAvdName);
  const setActiveTab = useEmulatorManagerStore((state) => state.setActiveTab);
  const appendActivity = useEmulatorManagerStore((state) => state.appendActivity);
  const setRootSession = useEmulatorManagerStore((state) => state.setRootSession);
  const clearRootSession = useEmulatorManagerStore((state) => state.clearRootSession);
  const setRestorePlan = useEmulatorManagerStore((state) => state.setRestorePlan);
  const setPendingAction = useEmulatorManagerStore((state) => state.setPendingAction);
  const [isRestorePlanLoading, setIsRestorePlanLoading] = useState(false);

  const selectedAvd = avds.find((item) => item.name === selectedAvdName) ?? null;
  const activeRootSession =
    rootSession && rootSession.avdName === selectedAvd?.name ? rootSession : null;
  const isBusy = pendingAction !== null;

  useEffect(() => {
    if (avds.length === 0) {
      setSelectedAvdName(null);
      setRestorePlan(null);
      return;
    }

    if (!selectedAvdName || !avds.some((item) => item.name === selectedAvdName)) {
      setSelectedAvdName(avds[0].name);
    }
  }, [avds, selectedAvdName, setRestorePlan, setSelectedAvdName]);

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

  async function refreshAvds(logMessage?: string) {
    const result = await refetch();
    if (result.error) {
      throw result.error;
    }

    if (logMessage) {
      appendActivity({ level: 'info', message: logMessage });
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
      appendActivity({
        level: 'error',
        message: error instanceof Error ? error.message : fallbackMessage,
      });
      handleError('Emulator Manager', error);
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
        appendActivity({ level: 'success', message });
        handleSuccess('Emulator Manager', message);
        await refreshAvds(`Refreshed AVD state after launching ${selectedAvd.name}.`);
      },
      `Failed to launch ${selectedAvd.name}`,
    );
  }

  async function handleStop() {
    const serial = selectedAvd?.serial;

    if (!selectedAvd || !serial) {
      return;
    }

    await runAction(
      'stop',
      async () => {
        const message = await StopAvd(serial);
        appendActivity({ level: 'warning', message });
        handleSuccess('Emulator Manager', message);
        await refreshAvds(`Refreshed AVD state after stopping ${selectedAvd.name}.`);
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
      appendActivity({ level: 'info', message: `Opened ${selectedAvd.avdPath}` });
    } catch (error) {
      appendActivity({
        level: 'error',
        message: error instanceof Error ? error.message : `Failed to open ${selectedAvd.avdPath}`,
      });
      handleError('Emulator Manager', error);
    }
  }

  async function handleRefresh() {
    await runAction(
      'refreshPlan',
      async () => {
        await refreshAvds('Refreshed the emulator roster.');
      },
      'Failed to refresh emulator roster',
    );
  }

  async function handlePrepareRoot(rootPackagePath: string) {
    const serial = selectedAvd?.serial;

    if (!selectedAvd || !serial) {
      return;
    }

    await runAction(
      'rootPrepare',
      async () => {
        const result = await PrepareAvdRoot({
          avdName: selectedAvd.name,
          serial,
          rootPackagePath,
        });

        setRootSession({
          avdName: selectedAvd.name,
          serial,
          normalizedPackagePath: result.normalizedPackagePath,
          fakeBootRemotePath: result.fakeBootRemotePath,
          instructions: result.instructions,
        });
        appendActivity({
          level: 'success',
          message: `Prepared root workflow for ${selectedAvd.name}.`,
        });
        handleSuccess('Emulator Manager', `Prepared root workflow for ${selectedAvd.name}.`);
      },
      `Failed to prepare root for ${selectedAvd.name}`,
    );
  }

  async function handleFinalizeRoot() {
    if (!activeRootSession) {
      return;
    }

    await runAction(
      'rootFinalize',
      async () => {
        const result = await FinalizeAvdRoot({
          avdName: activeRootSession.avdName,
          serial: activeRootSession.serial,
        });
        clearRootSession();
        appendActivity({
          level: 'success',
          message: result.nextBootRecommendation,
        });
        handleSuccess('Emulator Manager', result.nextBootRecommendation);
        await refreshAvds(
          `Refreshed AVD state after finalizing root for ${activeRootSession.avdName}.`,
        );
      },
      `Failed to finalize root for ${activeRootSession.avdName}`,
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
        clearRootSession();
        appendActivity({ level: 'warning', message });
        handleSuccess('Emulator Manager', message);
        await refreshAvds(`Refreshed AVD state after restoring ${selectedAvd.name}.`);
      },
      `Failed to restore ${selectedAvd.name}`,
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-primary/10 text-primary shadow-sm">
          <Bot className="size-6" />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold sm:text-2xl">Emulator Manager</h1>
            <Badge variant="outline" className="rounded-full">
              Advanced
            </Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Manage existing Android Studio AVDs, launch them with safe presets, assist local root
            flows, and restore stock state from backups.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <AvdRoster
          avds={avds}
          isLoading={isLoading}
          selectedAvdName={selectedAvdName}
          onSelect={setSelectedAvdName}
        />

        <div className="flex min-w-0 flex-col gap-6">
          <EmulatorHeaderCard avd={selectedAvd} />

          <EmulatorQuickActions
            avd={selectedAvd}
            isBusy={isBusy}
            isRefreshing={isFetching && pendingAction === 'refreshPlan'}
            onLaunchPreset={(preset) => void handleLaunch(createPresetOptions(preset))}
            onOpenFolder={() => void handleOpenFolder()}
            onRefresh={() => void handleRefresh()}
            onStop={() => void handleStop()}
          />

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as EmulatorManagerTab)}
          >
            <TabsList variant="line" className="w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="launch">Launch</TabsTrigger>
              <TabsTrigger value="root">Root</TabsTrigger>
              <TabsTrigger value="restore">Restore</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader className="gap-2 border-b pb-4">
                  <CardTitle className="text-base">AVD overview</CardTitle>
                  <CardDescription>
                    Health, path integrity, and prerequisites for launch or root operations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 pt-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Root state
                      </p>
                      <p className="mt-1 font-medium">
                        {selectedAvd ? formatRootState(selectedAvd.rootState) : 'No AVD selected'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Runtime
                      </p>
                      <p className="mt-1 font-medium">
                        {selectedAvd?.isRunning
                          ? `Online${selectedAvd.serial ? ` • ${selectedAvd.serial}` : ''}`
                          : 'Stopped'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Restore readiness
                      </p>
                      <p className="mt-1 font-medium">
                        {selectedAvd?.hasBackups ? 'Backups available' : 'No backups yet'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Warnings
                    </p>
                    {selectedAvd?.warnings.length ? (
                      <div className="space-y-2">
                        {selectedAvd.warnings.map((warning) => (
                          <div
                            key={warning}
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200"
                          >
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                        No warnings reported for the selected AVD.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="launch">
              <EmulatorLaunchTab
                avd={selectedAvd}
                isLaunching={pendingAction === 'launch'}
                onLaunch={handleLaunch}
              />
            </TabsContent>

            <TabsContent value="root">
              <EmulatorRootTab
                avd={selectedAvd}
                isPreparing={pendingAction === 'rootPrepare'}
                isFinalizing={pendingAction === 'rootFinalize'}
                rootSession={activeRootSession}
                onPrepare={handlePrepareRoot}
                onFinalize={handleFinalizeRoot}
              />
            </TabsContent>

            <TabsContent value="restore">
              <EmulatorRestoreTab
                avd={selectedAvd}
                isLoadingPlan={isRestorePlanLoading}
                isRestoring={pendingAction === 'restore'}
                restorePlan={restorePlan}
                onRestore={handleRestore}
              />
            </TabsContent>
          </Tabs>

          <EmulatorActivityCard />
        </div>
      </div>
    </div>
  );
}
