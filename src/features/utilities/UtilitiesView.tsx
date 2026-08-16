import { type ReactNode, useCallback } from 'react';
import { useUtilityActions } from '@/features/utilities/hooks/useUtilityActions';
import { AdbUtilitiesPanel } from '@/features/utilities/ui/AdbUtilitiesPanel';
import { DiagnosticsPanel } from '@/features/utilities/ui/DiagnosticsPanel';
import { FastbootUtilitiesPanel } from '@/features/utilities/ui/FastbootUtilitiesPanel';
import { GetVarDialog } from '@/features/utilities/ui/GetVarDialog';
import { HostSetupPanel } from '@/features/utilities/ui/HostSetupPanel';
import { HostToolsPanel } from '@/features/utilities/ui/HostToolsPanel';
import { EditNicknameDialog } from '@/shared/components/EditNicknameDialog';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Badge } from '@/shared/ui/badge';

function UtilitySection({
  children,
  title,
  tone = 'default',
}: {
  children: ReactNode;
  title: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader className={tone === 'danger' ? 'text-destructive' : undefined}>
        {title}
      </SectionHeader>
      {children}
    </section>
  );
}

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
          Host ADB, device power, diagnostics, then fastboot danger tools. Destructive actions
          confirm first; wipe requires typing WIPE.
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

      <div className="flex flex-col gap-8">
        <UtilitySection title="Host">
          <HostToolsPanel
            handleKillServer={handleKillServer}
            handleRestartServer={handleRestartServer}
            loadingAction={loadingAction}
            sentAction={sentAction}
          />
          <HostSetupPanel />
        </UtilitySection>
        <UtilitySection title="Device">
          <AdbUtilitiesPanel
            deviceMode={deviceMode}
            deviceSerial={deviceSerial}
            handleReboot={handleReboot}
            loadingAction={loadingAction}
            onRescan={handleRescan}
            sentAction={sentAction}
          />
        </UtilitySection>
        <UtilitySection title="Inspect">
          <DiagnosticsPanel
            disabled={deviceMode !== 'adb'}
            loadingAction={loadingAction}
            serial={deviceSerial}
          />
        </UtilitySection>
        <UtilitySection title="Danger" tone="danger">
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
        </UtilitySection>
      </div>

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
