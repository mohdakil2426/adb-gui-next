import { Server, Smartphone, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useUtilityActions } from '@/features/utilities/hooks/useUtilityActions';
import { AdbUtilitiesPanel } from '@/features/utilities/ui/AdbUtilitiesPanel';
import { DiagnosticsPanel } from '@/features/utilities/ui/DiagnosticsPanel';
import { FastbootUtilitiesPanel } from '@/features/utilities/ui/FastbootUtilitiesPanel';
import { GetVarDialog } from '@/features/utilities/ui/GetVarDialog';
import { HostSetupPanel } from '@/features/utilities/ui/HostSetupPanel';
import { HostToolsPanel } from '@/features/utilities/ui/HostToolsPanel';
import { EditNicknameDialog } from '@/shared/components/EditNicknameDialog';
import { Badge } from '@/shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

type UtilitiesTab = 'host' | 'adb' | 'fastboot';

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

  const [tab, setTab] = useState<UtilitiesTab>(deviceMode === 'fastboot' ? 'fastboot' : 'adb');

  const handleCloseGetVarDialog = useCallback(
    () => setShowGetVarDialog(false),
    [setShowGetVarDialog],
  );

  const handleRescan = () => {
    void refetchDevices();
  };

  const modeLabel =
    deviceMode === 'adb' ? 'ADB' : deviceMode === 'fastboot' ? 'Fastboot' : 'No device';

  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="sr-only">Utilities</h1>
      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        onSaved={() => void refetchDevices()}
        serial={deviceSerial}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body text-muted-foreground">
          Host ADB and Windows setup, device power and diagnostics, then fastboot. Destructive
          actions confirm first; wipe requires typing WIPE.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral">{modeLabel}</Badge>
          {deviceSerial ? (
            <Badge className="font-mono" variant="neutral">
              {deviceSerial}
            </Badge>
          ) : null}
        </div>
      </div>

      <Tabs
        onValueChange={(value) => {
          setTab(value as UtilitiesTab);
        }}
        value={tab}
      >
        <TabsList className="w-full justify-start border-border border-b" variant="line">
          <TabsTrigger className="flex-none gap-1.5" value="host">
            <Server aria-hidden="true" />
            Host
          </TabsTrigger>
          <TabsTrigger className="flex-none gap-1.5" value="adb">
            <Smartphone aria-hidden="true" />
            ADB
          </TabsTrigger>
          <TabsTrigger className="flex-none gap-1.5" value="fastboot">
            <Zap aria-hidden="true" />
            Fastboot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="host">
          <div className="flex flex-col gap-4">
            <HostToolsPanel
              handleKillServer={handleKillServer}
              handleRestartServer={handleRestartServer}
              loadingAction={loadingAction}
              sentAction={sentAction}
            />
            <HostSetupPanel />
          </div>
        </TabsContent>
        <TabsContent value="adb">
          <div className="flex flex-col gap-4">
            <AdbUtilitiesPanel
              deviceMode={deviceMode}
              deviceSerial={deviceSerial}
              handleReboot={handleReboot}
              loadingAction={loadingAction}
              onRescan={handleRescan}
              sentAction={sentAction}
            />
            <DiagnosticsPanel
              disabled={deviceMode !== 'adb'}
              loadingAction={loadingAction}
              serial={deviceSerial}
            />
          </div>
        </TabsContent>
        <TabsContent value="fastboot">
          <FastbootUtilitiesPanel
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
        </TabsContent>
      </Tabs>

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
