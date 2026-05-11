import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  FolderOpen,
  MonitorSmartphone,
  PenTool,
  Play,
  RefreshCcw,
  ShieldCheck,
  Snowflake,
  Square,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { AvdSwitcher } from '@/components/emulator-manager/AvdSwitcher';
import { EmulatorLaunchTab } from '@/components/emulator-manager/EmulatorLaunchTab';
import { EmulatorRestoreTab } from '@/components/emulator-manager/EmulatorRestoreTab';
import { EmulatorRootTab } from '@/components/emulator-manager/EmulatorRootTab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GetAvdRestorePlan,
  LaunchAvd,
  OpenFolder,
  RestoreAvdBackups,
  StopAvd,
} from '@/lib/desktop/backend';
import type { backend } from '@/lib/desktop/models';
import { type EmulatorManagerTab, useEmulatorManagerStore } from '@/lib/emulatorManagerStore';
import { handleError, handleSuccess } from '@/lib/errorHandler';
import { fetchAvds, invalidateAvds, queryKeys } from '@/lib/queries';
import { cn } from '@/lib/utils';

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

      {/* ── Row 2: Toolbar strip ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: AVD switcher pill + status meta below */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <AvdSwitcher
              avds={avds}
              isRefreshing={isLoading || isRefreshing}
              onRefresh={() => void handleRefresh()}
              onSelect={setSelectedAvdName}
              selectedAvdName={selectedAvdName}
            />
            {selectedAvd?.warnings && selectedAvd.warnings.length > 0 ? (
              <Badge className="rounded-full text-xs" variant="warning">
                {selectedAvd.warnings.length}{' '}
                {selectedAvd.warnings.length === 1 ? 'warning' : 'warnings'}
              </Badge>
            ) : null}
          </div>

          {/* Status meta line */}
          {selectedAvd ? (
            <div className="flex flex-wrap items-center gap-2 pl-0.5">
              <p className="text-muted-foreground text-xs">
                {selectedAvd.isRunning ? (
                  <span className="text-success">
                    ● Running
                    {selectedAvd.serial ? ` · ${selectedAvd.serial}` : ''}
                  </span>
                ) : (
                  <span>● Stopped</span>
                )}
                {' · '}
                {selectedAvd.target ?? 'Unknown target'} · API {selectedAvd.apiLevel ?? '?'}
                {selectedAvd.abi ? ` · ${selectedAvd.abi}` : ''}
                {selectedAvd.deviceName ? ` · ${selectedAvd.deviceName}` : ''}
              </p>
              {/* Boot mode badge — shown only when running */}
              {selectedAvd.isRunning && selectedAvd.bootMode !== 'unknown' ? (
                <Badge
                  className="rounded-full text-xs"
                  variant={selectedAvd.bootMode === 'cold' ? 'default' : 'warning'}
                >
                  {selectedAvd.bootMode === 'cold' ? '❄ Cold Boot' : '⚠ Normal Boot'}
                </Badge>
              ) : null}
              {/* Root state badge */}
              {selectedAvd.rootState === 'rooted' && (
                <Badge className="gap-1 rounded-full bg-success/15 text-success text-xs">
                  <ShieldCheck className="size-3" />
                  Rooted
                </Badge>
              )}
              {selectedAvd.rootState === 'modified' && (
                <Badge className="gap-1 rounded-full bg-warning/15 text-warning text-xs">
                  <PenTool className="size-3" />
                  Modified
                </Badge>
              )}
            </div>
          ) : (
            <p className="pl-0.5 text-muted-foreground text-xs">
              {isLoading ? 'Scanning for AVDs…' : 'Select an AVD to begin.'}
            </p>
          )}
        </div>

        {/* Right: Action buttons — only shown when an AVD is selected */}
        {selectedAvd ? (
          <div className="flex flex-wrap gap-1.5 sm:shrink-0">
            {selectedAvd.isRunning ? (
              <Button
                disabled={!selectedAvd.serial || isBusy}
                onClick={() => void handleStop()}
                size="sm"
                variant="outline"
              >
                <Square data-icon="inline-start" />
                Stop
              </Button>
            ) : (
              <Button
                disabled={isBusy}
                onClick={() => void handleLaunch(createPresetOptions('default'))}
                size="sm"
              >
                <Play data-icon="inline-start" />
                Launch
              </Button>
            )}
            <Button
              disabled={isBusy}
              onClick={() => void handleLaunch(createPresetOptions('coldBoot'))}
              size="sm"
              variant="outline"
            >
              <Snowflake data-icon="inline-start" />
              Cold boot
            </Button>
            <Button
              disabled={isBusy}
              onClick={() => void handleOpenFolder()}
              size="sm"
              variant="ghost"
            >
              <FolderOpen data-icon="inline-start" />
              Folder
            </Button>
          </div>
        ) : null}
      </div>

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
