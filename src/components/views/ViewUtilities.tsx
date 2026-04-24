import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { debugLog } from '@/lib/debug';
import { queryKeys } from '@/lib/queries';

import {
  Reboot,
  RunAdbHostCommand,
  RunFastbootHostCommand,
  WipeData,
  SaveLog,
} from '../../lib/desktop/backend';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  RotateCw,
  Loader2,
  Power,
  Terminal,
  Zap,
  RefreshCw,
  Server,
  Trash2,
  FileJson,
  Smartphone,
  Info,
  Save,
} from 'lucide-react';
import { useLogStore } from '@/lib/logStore';
import { useDeviceStore } from '@/lib/deviceStore';
import { EditNicknameDialog } from '@/components/EditNicknameDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CopyButton } from '@/components/CopyButton';
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
import { buttonVariants } from '@/components/ui/button-variants';
import { ActionButton } from '@/components/ActionButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  const queryClient = useQueryClient();

  const refetchDevices = () => queryClient.invalidateQueries({ queryKey: queryKeys.allDevices() });

  const { deviceMode, deviceSerial } = useMemo(() => {
    if (!allDevices.length)
      return {
        deviceMode: 'unknown' as DeviceConnectionMode,
        deviceSerial: null,
      };
    const adb = allDevices.find((d) => d.status === 'device' || d.status === 'recovery');
    if (adb) {
      debugLog('Device mode: adb');
      return {
        deviceMode: 'adb' as DeviceConnectionMode,
        deviceSerial: adb.serial,
      };
    }
    const fb = allDevices.find((d) => d.status === 'fastboot' || d.status === 'bootloader');
    if (fb) {
      debugLog('Device mode: fastboot');
      return {
        deviceMode: 'fastboot' as DeviceConnectionMode,
        deviceSerial: fb.serial,
      };
    }
    return { deviceMode: 'unknown' as DeviceConnectionMode, deviceSerial: null };
  }, [allDevices]);

  const handleReboot = async (mode: string, modeId: RebootMode, actionId: string) => {
    if (loadingAction || sentAction) return;

    setLoadingAction(actionId);
    const toastId = toast.loading(`Sending reboot command...`);
    try {
      await Reboot(mode);
      toast.success(`Reboot to ${modeId || 'system'} initiated`, { id: toastId });
      useLogStore.getState().addLog(`Rebooting to ${modeId || 'system'}...`, 'info');
      setSentAction(actionId);
      setTimeout(() => setSentAction(null), 2000);
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
    if (loadingAction || sentAction) return;
    setLoadingAction('restart_server');
    const toastId = toast.loading('Restarting ADB Server...');
    try {
      await RunAdbHostCommand('kill-server');
      await RunAdbHostCommand('start-server');
      toast.success('ADB Server Restarted', { id: toastId });
      useLogStore.getState().addLog('ADB Server restarted', 'success');
      setSentAction('restart_server');
      setTimeout(() => setSentAction(null), 2000);
      void refetchDevices();
    } catch (error) {
      toast.error('Failed to restart server', { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Failed to restart ADB server: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleKillServer = async () => {
    if (loadingAction || sentAction) return;
    setLoadingAction('kill_server');
    const toastId = toast.loading('Killing ADB Server...');
    try {
      await RunAdbHostCommand('kill-server');
      toast.success('ADB Server Killed', { id: toastId });
      useLogStore.getState().addLog('ADB Server killed', 'warning');
      setSentAction('kill_server');
      setTimeout(() => setSentAction(null), 2000);
      void refetchDevices();
    } catch (error) {
      toast.error('Failed to kill server', { id: toastId, description: String(error) });
    }
    setLoadingAction(null);
  };

  const handleSetActiveSlot = async (slot: string) => {
    if (loadingAction || sentAction) return;
    setLoadingAction(`set_active_${slot}`);
    const toastId = toast.loading(`Setting active slot to ${slot.toUpperCase()}...`);
    try {
      await RunFastbootHostCommand(`--set-active=${slot}`);
      toast.success(`Active slot set to ${slot.toUpperCase()}`, { id: toastId });
      useLogStore.getState().addLog(`Set active slot to ${slot}`, 'success');
      setSentAction(`set_active_${slot}`);
      setTimeout(() => setSentAction(null), 2000);
    } catch (error) {
      toast.error(`Failed to set slot ${slot}`, { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Failed to set active slot ${slot}: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleFastbootGetVars = async () => {
    if (loadingAction || sentAction) return;
    setLoadingAction('get_vars');
    try {
      const output = await RunFastbootHostCommand('getvar all');
      setGetVarContent(output);
      setShowGetVarDialog(true);
      useLogStore.getState().addLog('Fetched fastboot variables', 'success');
      setSentAction('get_vars');
      setTimeout(() => setSentAction(null), 2000);
    } catch (error) {
      toast.error('Failed to get variables', { description: String(error) });
      useLogStore.getState().addLog(`Failed to get fastboot vars: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleSaveGetVars = async () => {
    if (!getVarContent) return;
    try {
      const prefix = deviceSerial ? `${deviceSerial}-getvarall` : 'unknown-device-getvarall';
      const path = await SaveLog(getVarContent, prefix);
      toast.success(`Saved to ${path}`);
      useLogStore.getState().addLog(`Saved fastboot vars to ${path}`, 'success');
    } catch (error) {
      toast.error('Failed to save log', { description: String(error) });
    }
  };

  const handleWipeData = async () => {
    setLoadingAction('wipe_data');
    const toastId = toast.loading('Wiping User Data (this may take a while)...');
    try {
      await WipeData();
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
        serial={deviceSerial}
        onSaved={() => void refetchDevices()}
      />

      <div className="flex flex-col gap-6">
        {/* ADB SECTION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              ADB Utilities
            </CardTitle>
            <CardDescription>Operations requiring USB Debugging enabled.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <SectionHeader>Power Menu</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ActionButton
                  actionId="adb_system"
                  icon={Power}
                  label="Reboot System"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleReboot('', 'system', 'adb_system')}
                  disabled={deviceMode !== 'adb'}
                  variant="outline"
                  tall
                />
                <ActionButton
                  actionId="adb_recovery"
                  icon={RotateCw}
                  label="Reboot Recovery"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleReboot('recovery', 'recovery', 'adb_recovery')}
                  disabled={deviceMode !== 'adb'}
                  variant="outline"
                  tall
                />
                <ActionButton
                  actionId="adb_bootloader"
                  icon={Terminal}
                  label="Reboot Bootloader"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleReboot('bootloader', 'bootloader', 'adb_bootloader')}
                  disabled={deviceMode !== 'adb'}
                  variant="outline"
                  tall
                />
                <ActionButton
                  actionId="adb_fastboot"
                  icon={Zap}
                  label="Reboot Fastbootd"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleReboot('fastboot', 'fastboot', 'adb_fastboot')}
                  disabled={deviceMode !== 'adb'}
                  variant="outline"
                  tall
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader>Server Control</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ActionButton
                  actionId="restart_server"
                  icon={RefreshCw}
                  label="Restart ADB Server"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={handleRestartServer}
                  variant="secondary"
                  justifyStart
                />
                <ActionButton
                  actionId="kill_server"
                  icon={Server}
                  label="Kill ADB Server"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={handleKillServer}
                  variant="secondary"
                  justifyStart
                  className="hover:bg-destructive/10 hover:text-destructive"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FASTBOOT SECTION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Fastboot Utilities
            </CardTitle>
            <CardDescription>Operations requiring Bootloader/Fastboot mode.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <SectionHeader>Power Menu</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ActionButton
                  actionId="fb_system"
                  icon={Power}
                  label="Reboot System"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleReboot('', 'system', 'fb_system')}
                  disabled={deviceMode !== 'fastboot'}
                  variant="outline"
                  tall
                />
                <ActionButton
                  actionId="fb_bootloader"
                  icon={Terminal}
                  label="Reboot Bootloader"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleReboot('bootloader', 'bootloader', 'fb_bootloader')}
                  disabled={deviceMode !== 'fastboot'}
                  variant="outline"
                  tall
                />
                <ActionButton
                  actionId="fb_recovery"
                  icon={RotateCw}
                  label="Reboot Recovery"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleReboot('recovery', 'recovery', 'fb_recovery')}
                  disabled={deviceMode !== 'fastboot'}
                  variant="outline"
                  tall
                  wrapperClassName="col-span-1 sm:col-span-2"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader>Slot Management</SectionHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ActionButton
                  actionId="set_active_a"
                  icon={Zap}
                  label="Activate Slot A"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleSetActiveSlot('a')}
                  disabled={deviceMode !== 'fastboot'}
                  variant="secondary"
                  justifyStart
                />
                <ActionButton
                  actionId="set_active_b"
                  icon={Zap}
                  label="Activate Slot B"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={() => handleSetActiveSlot('b')}
                  disabled={deviceMode !== 'fastboot'}
                  variant="secondary"
                  justifyStart
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader>Device Operations</SectionHeader>
              <div className="grid grid-cols-1 gap-3">
                <ActionButton
                  actionId="get_vars"
                  icon={Info}
                  label="Get Device Variables (GetVar All)"
                  loadingAction={loadingAction}
                  sentAction={sentAction}
                  onClick={handleFastbootGetVars}
                  disabled={deviceMode !== 'fastboot'}
                  variant="secondary"
                  justifyStart
                />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                      className="w-full justify-start pl-4"
                    >
                      {loadingAction === 'wipe_data' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
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
                        onClick={handleWipeData}
                        className={buttonVariants({ variant: 'destructive' })}
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
      <Dialog open={showGetVarDialog} onOpenChange={setShowGetVarDialog}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <DialogTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Fastboot Variables
                </DialogTitle>
                <DialogDescription>
                  Output of <code>fastboot getvar all</code>
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <CopyButton value={getVarContent} label="Variables" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={handleSaveGetVars}
                      disabled={!getVarContent}
                      aria-label="Save to Log"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save to Log</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </DialogHeader>
          <div className="rounded-md border bg-muted/50 p-4 max-h-[60vh] overflow-y-auto w-full">
            <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
              {getVarContent || 'No output received.'}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGetVarDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
