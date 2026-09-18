import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CircleAlert,
  MonitorSmartphone,
  RotateCcw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAvdRestorePlan } from "@/features/emulator/hooks/use-avd-restore-plan";
import { useEmulatorActions } from "@/features/emulator/hooks/use-emulator-actions";
import { useEmulatorManagerStore } from "@/features/emulator/model/emulator-manager-store";
import type { EmulatorManagerTab } from "@/features/emulator/model/emulator-manager-store";
import { unacknowledgedLaunchOptions } from "@/features/emulator/model/launch-options";
import { EmulatorCockpitHero } from "@/features/emulator/ui/emulator-cockpit-hero";
import { EmulatorLaunchStudioTab } from "@/features/emulator/ui/launch/emulator-launch-studio-tab";
import { EmulatorOverviewTab } from "@/features/emulator/ui/overview/emulator-overview-tab";
import { RestoreConfirmDialog } from "@/features/emulator/ui/restore-confirm-dialog";
import { EmulatorRestoreStudioTab } from "@/features/emulator/ui/restore/emulator-restore-studio-tab";
import { EmulatorRootStudioTab } from "@/features/emulator/ui/root/emulator-root-studio-tab";
import { EmptyState } from "@/shared/components/empty-state";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { fetchAvds, queryKeys, STALE_TIME } from "@/shared/utils/queries";

export const ViewEmulatorManager = () => {
  const {
    data: avds = [],
    error: avdsError,
    isError: isAvdsError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryFn: fetchAvds,
    queryKey: queryKeys.avds(),
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
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const selectedAvd = avds.find((item) => item.name === selectedAvdName) ?? null;
  const isRestorePlanLoading = useAvdRestorePlan(selectedAvd);
  const isBusy = pendingAction !== null;
  const isRefreshing = isFetching && pendingAction === "refreshPlan";
  const unacknowledged = unacknowledgedLaunchOptions(launchOptions, launchAcknowledgements);
  const launchBlockedReason =
    unacknowledged.length === 0
      ? null
      : `${unacknowledged.map((option) => option.label).join(" and ")} needs to be acknowledged in the Launch tab first.`;

  // Auto-select first AVD when available
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

  const {
    handleLaunch,
    handleOpenFolder,
    handleRefresh,
    handleRestoreConfirmed,
    handleStop,
    refreshAvds,
  } = useEmulatorActions({
    launchBlockedReason,
    queryClient,
    refetch,
    selectedAvd,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Emulator Manager</h1>

      {/* Top Precision Hero Banner */}
      <EmulatorCockpitHero
        avds={avds}
        isBusy={isBusy}
        isRefreshing={isRefreshing}
        launchBlockedReason={launchBlockedReason}
        onLaunch={handleLaunch}
        onOpenFolder={handleOpenFolder}
        onRefresh={handleRefresh}
        onSelectAvd={setSelectedAvdName}
        onStop={handleStop}
        selectedAvd={selectedAvd}
      />

      {/* Main Tabbed Cockpit Area */}
      {(() => {
        if (isAvdsError) {
          return (
            <Card className="rounded-lg border-border bg-surface p-6 shadow-none">
              <EmptyState
                action={
                  <Button
                    onClick={() => {
                      void refreshAvds();
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Retry
                  </Button>
                }
                description={
                  avdsError instanceof Error ? avdsError.message : "Unknown emulator query error"
                }
                icon={CircleAlert}
                title="Failed to Load Virtual Devices"
              />
            </Card>
          );
        }
        if (avds.length === 0 && !isLoading) {
          return (
            <output
              aria-live="polite"
              className="block rounded-lg border border-border bg-surface p-6 shadow-none"
            >
              <EmptyState
                action={
                  <Button
                    onClick={() => {
                      void refreshAvds();
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Refresh AVDs
                  </Button>
                }
                description="Create an Android Virtual Device in Android Studio to launch and root virtual hardware."
                icon={MonitorSmartphone}
                title="No Android Virtual Devices Found"
              />
            </output>
          );
        }
        return (
          <Card className="gap-0 rounded-lg border-border bg-surface py-0 shadow-none">
            <CardContent className="flex flex-col gap-4 p-4">
              <Tabs
                className="gap-4"
                onValueChange={(value) => setActiveTab(value as EmulatorManagerTab)}
                value={activeTab}
              >
                <TabsList className="w-full">
                  <TabsTrigger className="flex-1" value="overview">
                    <Activity aria-hidden="true" className="mr-2 size-4" />
                    Overview & Telemetry
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="launch">
                    <Zap aria-hidden="true" className="mr-2 size-4" />
                    AVD Launch Studio
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="root">
                    <ShieldCheck aria-hidden="true" className="mr-2 size-4" />
                    Root Engine
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="restore">
                    <RotateCcw aria-hidden="true" className="mr-2 size-4" />
                    Snapshots & Restore
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <EmulatorOverviewTab avd={selectedAvd} />
                </TabsContent>

                <TabsContent value="launch">
                  <EmulatorLaunchStudioTab
                    isBusy={isBusy}
                    launchBlockedReason={launchBlockedReason}
                    onLaunch={handleLaunch}
                    onStop={handleStop}
                    pendingAction={pendingAction}
                    selectedAvd={selectedAvd}
                  />
                </TabsContent>

                <TabsContent value="root">
                  <EmulatorRootStudioTab avd={selectedAvd} onLaunch={handleLaunch} />
                </TabsContent>

                <TabsContent value="restore">
                  <EmulatorRestoreStudioTab
                    avd={selectedAvd}
                    isLoadingPlan={isRestorePlanLoading}
                    isRestoring={pendingAction === "restore"}
                    onRequestRestore={() => setIsRestoreConfirmOpen(true)}
                    restorePlan={restorePlan}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        );
      })()}

      {/* Restore Confirmation Dialog */}
      <RestoreConfirmDialog
        avd={selectedAvd}
        onCancel={() => setIsRestoreConfirmOpen(false)}
        onConfirm={handleRestoreConfirmed}
        open={isRestoreConfirmOpen}
        restorePlan={restorePlan}
      />
    </div>
  );
};

export default ViewEmulatorManager;
