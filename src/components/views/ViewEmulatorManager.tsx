import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { AvdSwitcher } from '@/components/emulator-manager/AvdSwitcher';
import { EmulatorLaunchTab } from '@/components/emulator-manager/EmulatorLaunchTab';
import { EmulatorRestoreTab } from '@/components/emulator-manager/EmulatorRestoreTab';
import { EmulatorRootTab } from '@/components/emulator-manager/EmulatorRootTab';
import {
  GetAvdRestorePlan,
  LaunchAvd,
  OpenFolder,
  RestoreAvdBackups,
  StopAvd,
} from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { handleError, handleSuccess } from '@/lib/errorHandler';
import { type EmulatorManagerTab, useEmulatorManagerStore } from '@/lib/emulatorManagerStore';
import { fetchAvds, queryKeys } from '@/lib/queries';
import { cn } from '@/lib/utils';
import {
  Bot,
  FolderOpen,
  MonitorSmartphone,
  Play,
  RefreshCcw,
  Snowflake,
  Square,
} from 'lucide-react';

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
    if (!selectedAvdName || !avds.some((item) => item.name === selectedAvdName)) {
      setSelectedAvdName(avds[0].name);
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
        if (!cancelled) setRestorePlan(plan);
      } catch {
        if (!cancelled) setRestorePlan(null);
      } finally {
        if (!cancelled) setIsRestorePlanLoading(false);
      }
    }

    void loadRestorePlan();
    return () => {
      cancelled = true;
    };
  }, [selectedAvd, setRestorePlan]);

  async function refreshAvds() {
    const result = await refetch();
    if (result.error) throw result.error;
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
      handleError('Emulator Manager', error instanceof Error ? error : new Error(fallbackMessage));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleLaunch(options: backend.EmulatorLaunchOptions) {
    if (!selectedAvd) return;
    await runAction(
      'launch',
      async () => {
        const message = await LaunchAvd(selectedAvd.name, options);
        handleSuccess('Emulator Manager', message);
        await refreshAvds();
      },
      `Failed to launch ${selectedAvd.name}`,
    );
  }

  async function handleStop() {
    const serial = selectedAvd?.serial;
    if (!selectedAvd || !serial) return;
    await runAction(
      'stop',
      async () => {
        const message = await StopAvd(serial);
        handleSuccess('Emulator Manager', message);
        await refreshAvds();
      },
      `Failed to stop ${selectedAvd.name}`,
    );
  }

  async function handleOpenFolder() {
    if (!selectedAvd) return;
    try {
      await OpenFolder(selectedAvd.avdPath);
    } catch (error) {
      handleError('Emulator Manager', error);
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
    if (!selectedAvd) return;
    await runAction(
      'restore',
      async () => {
        const message = await RestoreAvdBackups(selectedAvd.name);
        handleSuccess('Emulator Manager', message);
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
            <h1 className="text-xl font-semibold">Emulator Manager</h1>
            <p className="text-sm text-muted-foreground">
              Manage AVDs, launch with safe presets, and run root / restore workflows.
            </p>
          </div>
        </div>

        {/* Refresh — top-right of header */}
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={isBusy || isRefreshing}
          onClick={() => void handleRefresh()}
        >
          <RefreshCcw className={cn('size-4', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* ── Row 2: Toolbar strip ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: AVD switcher pill + status meta below */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <AvdSwitcher
              avds={avds}
              selectedAvdName={selectedAvdName}
              isRefreshing={isLoading || isRefreshing}
              onSelect={setSelectedAvdName}
              onRefresh={() => void handleRefresh()}
            />
            {selectedAvd?.warnings && selectedAvd.warnings.length > 0 && (
              <Badge variant="warning" className="rounded-full text-xs">
                {selectedAvd.warnings.length}{' '}
                {selectedAvd.warnings.length === 1 ? 'warning' : 'warnings'}
              </Badge>
            )}
          </div>

          {/* Status meta line */}
          {selectedAvd ? (
            <p className="pl-0.5 text-xs text-muted-foreground">
              {selectedAvd.isRunning ? (
                <span className="text-success">
                  ● Running{selectedAvd.serial ? ` · ${selectedAvd.serial}` : ''}
                </span>
              ) : (
                <span>● Stopped</span>
              )}
              {' · '}
              {selectedAvd.target ?? 'Unknown target'} · API {selectedAvd.apiLevel ?? '?'}
              {selectedAvd.abi ? ` · ${selectedAvd.abi}` : ''}
              {selectedAvd.deviceName ? ` · ${selectedAvd.deviceName}` : ''}
            </p>
          ) : (
            <p className="pl-0.5 text-xs text-muted-foreground">
              {isLoading ? 'Scanning for AVDs…' : 'Select an AVD to begin.'}
            </p>
          )}
        </div>

        {/* Right: Action buttons — only shown when an AVD is selected */}
        {selectedAvd && (
          <div className="flex flex-wrap gap-1.5 sm:shrink-0">
            {selectedAvd.isRunning ? (
              <Button
                size="sm"
                variant="outline"
                disabled={!selectedAvd.serial || isBusy}
                onClick={() => void handleStop()}
              >
                <Square data-icon="inline-start" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isBusy}
                onClick={() => void handleLaunch(createPresetOptions('default'))}
              >
                <Play data-icon="inline-start" />
                Launch
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => void handleLaunch(createPresetOptions('coldBoot'))}
            >
              <Snowflake data-icon="inline-start" />
              Cold boot
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => void handleOpenFolder()}
            >
              <FolderOpen data-icon="inline-start" />
              Folder
            </Button>
          </div>
        )}
      </div>

      {/* ── Card: content only (tabs flush at top) ────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {selectedAvd ? (
            <Tabs
              value={activeTab === 'overview' ? 'launch' : activeTab}
              onValueChange={(value) => setActiveTab(value as EmulatorManagerTab)}
            >
              <TabsList
                variant="line"
                className="w-full justify-start rounded-none rounded-t-xl border-b px-4"
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
                  <EmulatorRootTab avd={selectedAvd} />
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
              </div>
            </Tabs>
          ) : (
            <EmptyState
              icon={MonitorSmartphone}
              title={isLoading ? 'Scanning AVDs…' : 'No AVD selected'}
              description={
                isLoading
                  ? 'Looking for Android Studio virtual devices.'
                  : 'Use the emulator switcher above to pick an AVD and begin.'
              }
              className="py-16"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
