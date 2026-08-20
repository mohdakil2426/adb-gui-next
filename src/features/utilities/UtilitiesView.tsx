import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Camera, Power, Server, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GetHostToolVersions } from '@/desktop/backend';
import { UtilitiesDiagnosticsTab } from '@/features/utilities/diagnostics/UtilitiesDiagnosticsTab';
import { UtilitiesFastbootTab } from '@/features/utilities/fastboot/UtilitiesFastbootTab';
import { useHostSetupProgress } from '@/features/utilities/hooks/useHostSetupProgress';
import { useUtilityActions } from '@/features/utilities/hooks/useUtilityActions';
import { UtilitiesHostTab } from '@/features/utilities/host/UtilitiesHostTab';
import { UtilitiesOverviewTab } from '@/features/utilities/overview/UtilitiesOverviewTab';
import { UtilitiesPowerTab } from '@/features/utilities/power/UtilitiesPowerTab';
import { GetVarDialog } from '@/features/utilities/ui/GetVarDialog';
import { UtilitiesCockpitHero } from '@/features/utilities/ui/UtilitiesCockpitHero';
import { EditNicknameDialog } from '@/shared/components/EditNicknameDialog';
import { TabsWithIcon } from '@/shared/ui/tabs-with-icon';
import { queryKeys } from '@/shared/utils/queries';
// Empty state handled across UI when data?.length === 0

export type UtilitiesTab = 'overview' | 'power' | 'diagnostics' | 'fastboot' | 'host';

export function ViewUtilities() {
  const {
    deviceMode,
    deviceSerial,
    getVarContent,
    handleFastbootGetVars,
    handleKillServer,
    handleReboot,
    handleRestartServer,
    handleSaveGetVars,
    handleSetActiveSlot,
    handleWipeData,
    isEditing,
    isGlobalLoading,
    loadingAction,
    refetchDevices,
    sentAction,
    setIsEditing,
    setShowGetVarDialog,
    showGetVarDialog,
  } = useUtilityActions();

  // Host setup progress hook
  useHostSetupProgress();

  const queryClient = useQueryClient();

  // Host tool versions query for Cockpit Hero
  const {
    data: hostVersions,
    isFetching: isFetchingVersions,
    refetch: refetchVersions,
  } = useQuery({
    queryKey: ['hostToolVersions', sentAction],
    queryFn: GetHostToolVersions,
    staleTime: 30_000,
  });

  // Active Tab state — default to 'fastboot' if device is in fastboot mode, otherwise 'overview'
  const [tab, setTab] = useState<UtilitiesTab>(deviceMode === 'fastboot' ? 'fastboot' : 'overview');

  // Sync tab with device mode changes if user hasn't explicitly navigated
  useEffect(() => {
    if (deviceMode === 'fastboot') {
      setTab('fastboot');
    }
  }, [deviceMode]);

  const handleCloseGetVarDialog = useCallback(
    () => setShowGetVarDialog(false),
    [setShowGetVarDialog],
  );

  const handleRescan = useCallback(() => {
    void refetchDevices();
    void refetchVersions();
    void queryClient.invalidateQueries({ queryKey: queryKeys.hostSetup.status });
  }, [refetchDevices, refetchVersions, queryClient]);

  const handleNavigateTab = useCallback(
    (targetTab: 'power' | 'diagnostics' | 'fastboot' | 'host') => {
      setTab(targetTab);
    },
    [],
  );

  const utilityTabs = useMemo(
    () => [
      {
        content: (
          <UtilitiesOverviewTab
            deviceMode={deviceMode}
            deviceSerial={deviceSerial}
            onNavigateTab={handleNavigateTab}
          />
        ),
        icon: <Activity aria-hidden="true" className="size-4" />,
        name: 'Overview',
        value: 'overview',
      },
      {
        content: (
          <UtilitiesPowerTab
            deviceMode={deviceMode}
            deviceSerial={deviceSerial}
            handleReboot={handleReboot}
            loadingAction={loadingAction}
            sentAction={sentAction}
          />
        ),
        icon: <Power aria-hidden="true" className="size-4" />,
        name: 'Power & Tweaks',
        value: 'power',
      },
      {
        content: <UtilitiesDiagnosticsTab deviceMode={deviceMode} deviceSerial={deviceSerial} />,
        icon: <Camera aria-hidden="true" className="size-4" />,
        name: 'Diagnostics',
        value: 'diagnostics',
      },
      {
        content: (
          <UtilitiesFastbootTab
            deviceMode={deviceMode}
            deviceSerial={deviceSerial}
            handleFastbootGetVars={handleFastbootGetVars}
            handleReboot={handleReboot}
            handleSetActiveSlot={handleSetActiveSlot}
            handleWipeData={handleWipeData}
            isGlobalLoading={isGlobalLoading}
            loadingAction={loadingAction}
            onRescan={handleRescan}
            sentAction={sentAction}
          />
        ),
        icon: <Zap aria-hidden="true" className="size-4" />,
        name: 'Fastboot',
        value: 'fastboot',
      },
      {
        content: (
          <UtilitiesHostTab
            handleKillServer={handleKillServer}
            handleRestartServer={handleRestartServer}
            loadingAction={loadingAction}
            sentAction={sentAction}
          />
        ),
        icon: <Server aria-hidden="true" className="size-4" />,
        name: 'Host Setup',
        value: 'host',
      },
    ],
    [
      deviceMode,
      deviceSerial,
      handleNavigateTab,
      handleReboot,
      loadingAction,
      sentAction,
      handleFastbootGetVars,
      handleSetActiveSlot,
      handleWipeData,
      isGlobalLoading,
      handleRescan,
      handleKillServer,
      handleRestartServer,
    ],
  );

  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="sr-only">Utilities</h1>

      {/* Device Nickname Dialog */}
      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        onSaved={handleRescan}
        serial={deviceSerial}
      />

      {/* Top Precision Hardware Cockpit Hero Header */}
      <UtilitiesCockpitHero
        deviceMode={deviceMode}
        deviceSerial={deviceSerial}
        hostVersions={hostVersions ?? null}
        isLoading={isFetchingVersions}
        onEditNickname={() => setIsEditing(true)}
        onRefresh={handleRescan}
      />

      {/* 5-Tab Navigation System */}
      <TabsWithIcon
        className="w-full"
        onValueChange={(value) => {
          setTab(value as UtilitiesTab);
        }}
        tabs={utilityTabs}
        value={tab}
      />

      {/* Fastboot Variables Dialog */}
      <GetVarDialog
        getVarContent={getVarContent}
        onClose={handleCloseGetVarDialog}
        onOpenChange={setShowGetVarDialog}
        onSave={handleSaveGetVars}
        open={showGetVarDialog}
      />
    </div>
  );
}
