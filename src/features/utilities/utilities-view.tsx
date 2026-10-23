import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Power, Server, Zap } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { GetHostToolVersions } from "@/desktop/backend";
import { UtilitiesDiagnosticsTab } from "@/features/utilities/diagnostics/utilities-diagnostics-tab";
import { UtilitiesFastbootTab } from "@/features/utilities/fastboot/utilities-fastboot-tab";
import { useHostSetupProgress } from "@/features/utilities/hooks/use-host-setup-progress";
import { useUtilityActions } from "@/features/utilities/hooks/use-utility-actions";
import { UtilitiesHostTab } from "@/features/utilities/host/utilities-host-tab";
import { UtilitiesPowerTab } from "@/features/utilities/power/utilities-power-tab";
import { GetVarDialog } from "@/features/utilities/ui/get-var-dialog";
import { UtilitiesCockpitHero } from "@/features/utilities/ui/utilities-cockpit-hero";
import { EditNicknameDialog } from "@/shared/components/edit-nickname-dialog";
import { TabsWithIcon } from "@/shared/ui/tabs-with-icon";
import { queryKeys } from "@/shared/utils/queries";
// Empty state handled across UI when data?.length === 0

export type UtilitiesTab = "power" | "fastboot" | "diagnostics" | "host";

export const ViewUtilities = () => {
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
    queryFn: GetHostToolVersions,
    queryKey: ["hostToolVersions", sentAction],
    staleTime: 30_000,
  });

  // Active Tab state — default to 'fastboot' if device is in fastboot mode, otherwise 'power'
  const [prevDeviceMode, setPrevDeviceMode] = useState(deviceMode);
  const [tab, setTab] = useState<UtilitiesTab>(deviceMode === "fastboot" ? "fastboot" : "power");

  if (deviceMode !== prevDeviceMode) {
    setPrevDeviceMode(deviceMode);
    if (deviceMode === "fastboot") {
      setTab("fastboot");
    }
  }

  const handleCloseGetVarDialog = useCallback(
    () => setShowGetVarDialog(false),
    [setShowGetVarDialog]
  );

  const handleRescan = useCallback(() => {
    void refetchDevices();
    void refetchVersions();
    void queryClient.invalidateQueries({
      queryKey: queryKeys.hostSetup.status,
    });
  }, [refetchDevices, refetchVersions, queryClient]);

  const utilityTabs = useMemo(
    () => [
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
        name: "Power & Tweaks",
        value: "power",
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
        name: "Fastboot",
        value: "fastboot",
      },
      {
        content: <UtilitiesDiagnosticsTab deviceMode={deviceMode} deviceSerial={deviceSerial} />,
        icon: <Camera aria-hidden="true" className="size-4" />,
        name: "Diagnostics",
        value: "diagnostics",
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
        name: "Host Setup",
        value: "host",
      },
    ],
    [
      deviceMode,
      deviceSerial,
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
    ]
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

      {/* 4-Tab Navigation System */}
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
};
