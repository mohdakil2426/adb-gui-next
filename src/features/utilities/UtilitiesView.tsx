import { useCallback } from 'react';
import { useUtilityActions } from '@/features/utilities/hooks/useUtilityActions';
import { AdbUtilitiesPanel } from '@/features/utilities/ui/AdbUtilitiesPanel';
import { FastbootUtilitiesPanel } from '@/features/utilities/ui/FastbootUtilitiesPanel';
import { GetVarDialog } from '@/features/utilities/ui/GetVarDialog';
import { EditNicknameDialog } from '@/shared/components/EditNicknameDialog';

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

  return (
    <div className="flex flex-col gap-6 pb-10">
      <h1 className="sr-only">Utilities</h1>
      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        onSaved={() => void refetchDevices()}
        serial={deviceSerial}
      />

      <div className="flex flex-col gap-6">
        <AdbUtilitiesPanel
          deviceMode={deviceMode}
          handleKillServer={handleKillServer}
          handleReboot={handleReboot}
          handleRestartServer={handleRestartServer}
          loadingAction={loadingAction}
          sentAction={sentAction}
        />
        <FastbootUtilitiesPanel
          deviceMode={deviceMode}
          handleFastbootGetVars={handleFastbootGetVars}
          handleReboot={handleReboot}
          handleSetActiveSlot={handleSetActiveSlot}
          handleWipeData={handleWipeData}
          isGlobalLoading={isGlobalLoading}
          loadingAction={loadingAction}
          sentAction={sentAction}
        />
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
