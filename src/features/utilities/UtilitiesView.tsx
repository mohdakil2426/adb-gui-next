import { useQueryClient } from '@tanstack/react-query';
import {
  FileJson,
  Info,
  Loader2,
  Power,
  RefreshCw,
  RotateCw,
  Save,
  Server,
  Smartphone,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ActionButton } from '@/components/ActionButton';
import { CopyButton } from '@/components/CopyButton';
import { EditNicknameDialog } from '@/components/EditNicknameDialog';
import { SectionHeader } from '@/components/SectionHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { debugLog } from '@/lib/debug';
import { useDeviceStore } from '@/lib/deviceStore';
import { useLogStore } from '@/lib/logStore';
import { queryKeys } from '@/lib/queries';
import {
  Reboot,
  RunAdbHostCommand,
  RunFastbootHostCommand,
  SaveLog,
  WipeData,
} from '../../lib/desktop/backend';

type RebootMode = 'system' | 'recovery' | 'bootloader' | 'fastboot' | null;
type DeviceConnectionMode = 'adb' | 'fastboot' | 'unknown';

export function ViewUtilities() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [sentAction, setSentAction] = useState<string | null>(null);

  // GetVar Dialog State
  const [showGetVarDialog, setShowGetVarDialog] = useState(false);
  const [getVarContent, setGetVarContent] = useState('');

  // Nickname Editing State
  const [isEditing, setIsEditing] = useState(false);

  const allDevices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const queryClient = useQueryClient();

  const refetchDevices = () => queryClient.invalidateQueries({ queryKey: queryKeys.allDevices() });

  const { deviceMode, deviceSerial } = useMemo(() => {
    if (!allDevices.length) {
      return {
        deviceMode: 'unknown' as DeviceConnectionMode,
        deviceSerial: null,
      };
    }
    const selectedDevice = allDevices.find((device) => device.serial === selectedSerial);
    if (!selectedDevice) {
      return {
        deviceMode: 'unknown' as DeviceConnectionMode,
        deviceSerial: null,
      };
    }
    if (selectedDevice.status === 'device' || selectedDevice.status === 'recovery') {
      debugLog('Device mode: adb');
      return {
        deviceMode: 'adb' as DeviceConnectionMode,
        deviceSerial: selectedDevice.serial,
      };
    }
    if (selectedDevice.status === 'fastboot' || selectedDevice.status === 'bootloader') {
      debugLog('Device mode: fastboot');
      return {
        deviceMode: 'fastboot' as DeviceConnectionMode,
        deviceSerial: selectedDevice.serial,
      };
    }
    return {
      deviceMode: 'unknown' as DeviceConnectionMode,
      deviceSerial: null,
    };
  }, [allDevices, selectedSerial]);

  const handleReboot = async (mode: string, modeId: RebootMode, actionId: string) => {
    if (loadingAction || sentAction) {
      return;
    }

    setLoadingAction(actionId);
    const toastId = toast.loading('Sending reboot command...');
    try {
      await Reboot(mode, deviceSerial);
      toast.success(`Reboot to ${modeId ?? 'system'} initiated`, {
        id: toastId,
      });
      useLogStore.getState().addLog(`Rebooting to ${modeId ?? 'system'}...`, 'info');
      setSentAction(actionId);
      setTimeout(() => {
        setSentAction(null);
      }, 2000);
    } catch (error) {
      debugLog(`Error rebooting to ${modeId}:`, error);
      toast.error('Failed to send reboot command', {
        id: toastId,
        description: String(error),
      });
      useLogStore.getState().addLog(`Reboot failed: ${error}`, 'error');
    }

    setLoadingAction(null);
    void refetchDevices();
  };

  const handleRestartServer = async () => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction('restart_server');
    const toastId = toast.loading('Restarting ADB Server...');
    try {
      await RunAdbHostCommand('kill-server');
      await RunAdbHostCommand('start-server');
      toast.success('ADB Server Restarted', { id: toastId });
      useLogStore.getState().addLog('ADB Server restarted', 'success');
      setSentAction('restart_server');
      setTimeout(() => {
        setSentAction(null);
      }, 2000);
      void refetchDevices();
    } catch (error) {
      toast.error('Failed to restart server', {
        id: toastId,
        description: String(error),
      });
      useLogStore.getState().addLog(`Failed to restart ADB server: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleKillServer = async () => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction('kill_server');
    const toastId = toast.loading('Killing ADB Server...');
    try {
      await RunAdbHostCommand('kill-server');
      toast.success('ADB Server Killed', { id: toastId });
      useLogStore.getState().addLog('ADB Server killed', 'warning');
      setSentAction('kill_server');
      setTimeout(() => {
        setSentAction(null);
      }, 2000);
      void refetchDevices();
    } catch (error) {
      toast.error('Failed to kill server', {
        id: toastId,
        description: String(error),
      });
    }
    setLoadingAction(null);
  };

  const handleSetActiveSlot = async (slot: string) => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction(`set_active_${slot}`);
    const toastId = toast.loading(`Setting active slot to ${slot.toUpperCase()}...`);
    try {
      await RunFastbootHostCommand(`--set-active=${slot}`, deviceSerial);
      toast.success(`Active slot set to ${slot.toUpperCase()}`, {
        id: toastId,
      });
      useLogStore.getState().addLog(`Set active slot to ${slot}`, 'success');
      setSentAction(`set_active_${slot}`);
      setTimeout(() => {
        setSentAction(null);
      }, 2000);
    } catch (error) {
      toast.error(`Failed to set slot ${slot}`, {
        id: toastId,
        description: String(error),
      });
      useLogStore.getState().addLog(`Failed to set active slot ${slot}: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleFastbootGetVars = async () => {
    if (loadingAction || sentAction) {
      return;
    }
    setLoadingAction('get_vars');
    try {
      const output = await RunFastbootHostCommand('getvar all', deviceSerial);
      setGetVarContent(output);
      setShowGetVarDialog(true);
      useLogStore.getState().addLog('Fetched fastboot variables', 'success');
      setSentAction('get_vars');
      setTimeout(() => {
        setSentAction(null);
      }, 2000);
    } catch (error) {
      toast.error('Failed to get variables', { description: String(error) });
      useLogStore.getState().addLog(`Failed to get fastboot vars: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleSaveGetVars = async () => {
    if (!getVarContent) {
      return;
    }
    try {
      const prefix = deviceSerial ? `${deviceSerial}-getvarall` : 'unknown-device-getvarall';
      const path = await SaveLog(getVarContent, prefix);
      toast.success(`Saved to ${path}`);
      useLogStore.getState().addLog(`Saved fastboot vars to ${path}`, 'success');
    } catch (error) {
      toast.error('Failed to save log', { description: String(error) });
    }
  };

  const handleCloseGetVarDialog = useCallback(() => {
    setShowGetVarDialog(false);
  }, []);

  const handleWipeData = async () => {
    setLoadingAction('wipe_data');
    const toastId = toast.loading('Wiping User Data (this may take a while)...');
    try {
      await WipeData(deviceSerial);
      toast.success('Device Wiped Successfully', { id: toastId });
      useLogStore.getState().addLog('Device user data wiped (fastboot -w)', 'success');
    } catch (error) {
      toast.error('Wipe Failed', { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Wipe failed: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const isGlobalLoading = !!loadingAction || !!sentAction;

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
        {/* ADB SECTION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="size-5" />
              ADB Utilities
            </CardTitle>
            <CardDescription>Operations requiring USB Debugging enabled.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <SectionHeader>Power Menu</SectionHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ActionButton
                  actionId="adb_system"
                  disabled={deviceMode !== 'adb'}
                  icon={Power}
                  label="Reboot System"
                  loadingAction={loadingAction}
                  onClick={() => handleReboot('', 'system', 'adb_system')}
                  sentAction={sentAction}
                  tall
                  variant="outline"
                />
                <ActionButton
                  actionId="adb_recovery"
                  disabled={deviceMode !== 'adb'}
                  icon={RotateCw}
                  label="Reboot Recovery"
                  loadingAction={loadingAction}
                  onClick={() => handleReboot('recovery', 'recovery', 'adb_recovery')}
                  sentAction={sentAction}
                  tall
                  variant="outline"
                />
                <ActionButton
                  actionId="adb_bootloader"
                  disabled={deviceMode !== 'adb'}
                  icon={Terminal}
                  label="Reboot Bootloader"
                  loadingAction={loadingAction}
                  onClick={() => handleReboot('bootloader', 'bootloader', 'adb_bootloader')}
                  sentAction={sentAction}
                  tall
                  variant="outline"
                />
                <ActionButton
                  actionId="adb_fastboot"
                  disabled={deviceMode !== 'adb'}
                  icon={Zap}
                  label="Reboot Fastbootd"
                  loadingAction={loadingAction}
                  onClick={() => handleReboot('fastboot', 'fastboot', 'adb_fastboot')}
                  sentAction={sentAction}
                  tall
                  variant="outline"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader>Server Control</SectionHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ActionButton
                  actionId="restart_server"
                  icon={RefreshCw}
                  justifyStart
                  label="Restart ADB Server"
                  loadingAction={loadingAction}
                  onClick={handleRestartServer}
                  sentAction={sentAction}
                  variant="secondary"
                />
                <ActionButton
                  actionId="kill_server"
                  className="hover:bg-destructive/10 hover:text-destructive"
                  icon={Server}
                  justifyStart
                  label="Kill ADB Server"
                  loadingAction={loadingAction}
                  onClick={handleKillServer}
                  sentAction={sentAction}
                  variant="secondary"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FASTBOOT SECTION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5" />
              Fastboot Utilities
            </CardTitle>
            <CardDescription>Operations requiring Bootloader/Fastboot mode.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <SectionHeader>Power Menu</SectionHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ActionButton
                  actionId="fb_system"
                  disabled={deviceMode !== 'fastboot'}
                  icon={Power}
                  label="Reboot System"
                  loadingAction={loadingAction}
                  onClick={() => handleReboot('', 'system', 'fb_system')}
                  sentAction={sentAction}
                  tall
                  variant="outline"
                />
                <ActionButton
                  actionId="fb_bootloader"
                  disabled={deviceMode !== 'fastboot'}
                  icon={Terminal}
                  label="Reboot Bootloader"
                  loadingAction={loadingAction}
                  onClick={() => handleReboot('bootloader', 'bootloader', 'fb_bootloader')}
                  sentAction={sentAction}
                  tall
                  variant="outline"
                />
                <ActionButton
                  actionId="fb_recovery"
                  disabled={deviceMode !== 'fastboot'}
                  icon={RotateCw}
                  label="Reboot Recovery"
                  loadingAction={loadingAction}
                  onClick={() => handleReboot('recovery', 'recovery', 'fb_recovery')}
                  sentAction={sentAction}
                  tall
                  variant="outline"
                  wrapperClassName="col-span-1 sm:col-span-2"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader>Slot Management</SectionHeader>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ActionButton
                  actionId="set_active_a"
                  disabled={deviceMode !== 'fastboot'}
                  icon={Zap}
                  justifyStart
                  label="Activate Slot A"
                  loadingAction={loadingAction}
                  onClick={() => handleSetActiveSlot('a')}
                  sentAction={sentAction}
                  variant="secondary"
                />
                <ActionButton
                  actionId="set_active_b"
                  disabled={deviceMode !== 'fastboot'}
                  icon={Zap}
                  justifyStart
                  label="Activate Slot B"
                  loadingAction={loadingAction}
                  onClick={() => handleSetActiveSlot('b')}
                  sentAction={sentAction}
                  variant="secondary"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader>Device Operations</SectionHeader>
              <div className="grid grid-cols-1 gap-3">
                <ActionButton
                  actionId="get_vars"
                  disabled={deviceMode !== 'fastboot'}
                  icon={Info}
                  justifyStart
                  label="Get Device Variables (GetVar All)"
                  loadingAction={loadingAction}
                  onClick={handleFastbootGetVars}
                  sentAction={sentAction}
                  variant="secondary"
                />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full justify-start pl-4"
                      disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                      variant="destructive"
                    >
                      {loadingAction === 'wipe_data' ? (
                        <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 size-4" />
                      )}
                      Wipe User Data (Factory Reset)
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will perform a <strong>fastboot -w</strong> which erases all user data.
                        This action cannot be undone. Ensure you have backed up your data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className={buttonVariants({ variant: 'destructive' })}
                        onClick={handleWipeData}
                      >
                        Yes, Wipe Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog for GetVar All Output */}
      <Dialog onOpenChange={setShowGetVarDialog} open={showGetVarDialog}>
        <DialogContent className="flex max-h-[80vh] w-[95vw] max-w-2xl flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <DialogTitle className="flex items-center gap-2">
                  <FileJson className="size-5" />
                  Fastboot Variables
                </DialogTitle>
                <DialogDescription>
                  Output of <code>fastboot getvar all</code>
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <CopyButton label="Variables" value={getVarContent} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="Save to Log"
                      disabled={!getVarContent}
                      onClick={handleSaveGetVars}
                      size="icon"
                      variant="outline"
                    >
                      <Save className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save to Log</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[60vh] w-full overflow-y-auto rounded-md border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap font-mono text-muted-foreground text-xs">
              {getVarContent || 'No output received.'}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseGetVarDialog} variant="outline">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
