import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { handleError } from '@/lib/errorHandler';
import { debugLog } from '@/lib/debug';
import { queryKeys, fetchAllDevices } from '@/lib/queries';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

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
  Copy,
} from 'lucide-react';
import { useLogStore } from '@/lib/logStore';
import { ConnectedDevicesCard } from '@/components/ConnectedDevicesCard';
import { EditNicknameDialog } from '@/components/EditNicknameDialog';
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

type RebootMode = 'system' | 'recovery' | 'bootloader' | 'fastboot' | null;
type DeviceConnectionMode = 'adb' | 'fastboot' | 'unknown';

export function ViewUtilities({ activeView }: { activeView: string }) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // GetVar Dialog State
  const [showGetVarDialog, setShowGetVarDialog] = useState(false);
  const [getVarContent, setGetVarContent] = useState('');

  // Nickname Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [nicknameVersion, setNicknameVersion] = useState(0);

  const refreshTimeout = null;
  void (refreshTimeout && handleError);

  const {
    data: allDevices = [],
    isFetching: isCheckingStatus,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: queryKeys.allDevices(),
    queryFn: fetchAllDevices,
    refetchInterval: activeView === 'utils' ? 3000 : false,
    enabled: activeView === 'utils',
  });

  const { deviceMode, deviceSerial, deviceStatus } = useMemo(() => {
    if (!allDevices.length)
      return {
        deviceMode: 'unknown' as DeviceConnectionMode,
        deviceSerial: null,
        deviceStatus: '',
      };
    const adb = allDevices.find((d) => d.status === 'device' || d.status === 'recovery');
    if (adb) {
      debugLog('Device mode: adb');
      return {
        deviceMode: 'adb' as DeviceConnectionMode,
        deviceSerial: adb.serial,
        deviceStatus: adb.status,
      };
    }
    const fb = allDevices.find((d) => d.status === 'fastboot' || d.status === 'bootloader');
    if (fb) {
      debugLog('Device mode: fastboot');
      return {
        deviceMode: 'fastboot' as DeviceConnectionMode,
        deviceSerial: fb.serial,
        deviceStatus: 'fastboot',
      };
    }
    return { deviceMode: 'unknown' as DeviceConnectionMode, deviceSerial: null, deviceStatus: '' };
  }, [allDevices]);

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    await refetchDevices();
    setIsManualRefreshing(false);
  };

  useEffect(() => {
    if (activeView === 'utils') {
      void refetchDevices();
    }
  }, [activeView, refetchDevices]);

  const handleReboot = async (mode: string, modeId: RebootMode) => {
    if (loadingAction) return;

    setLoadingAction(modeId);
    try {
      await Reboot(mode);
      useLogStore.getState().addLog(`Rebooting to ${modeId || 'system'}...`, 'info');
      toast.info(`Rebooting device...`);
    } catch (error) {
      console.error(`Error rebooting to ${modeId}:`, error);
      toast.error('Failed to send reboot command', {
        description: String(error),
      });
      useLogStore.getState().addLog(`Reboot failed: ${error}`, 'error');
    }

    setLoadingAction(null);
    void refetchDevices();
  };

  const handleRestartServer = async () => {
    setLoadingAction('restart_server');
    const toastId = toast.loading('Restarting ADB Server...');
    try {
      await RunAdbHostCommand('kill-server');
      await RunAdbHostCommand('start-server');
      toast.success('ADB Server Restarted', { id: toastId });
      useLogStore.getState().addLog('ADB Server restarted', 'success');
      void refetchDevices();
    } catch (error) {
      toast.error('Failed to restart server', { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Failed to restart ADB server: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleKillServer = async () => {
    setLoadingAction('kill_server');
    try {
      await RunAdbHostCommand('kill-server');
      toast.success('ADB Server Killed');
      useLogStore.getState().addLog('ADB Server killed', 'warning');
      void refetchDevices();
    } catch (error) {
      toast.error('Failed to kill server', { description: String(error) });
    }
    setLoadingAction(null);
  };

  const handleSetActiveSlot = async (slot: string) => {
    setLoadingAction(`set_active_${slot}`);
    const toastId = toast.loading(`Setting active slot to ${slot.toUpperCase()}...`);
    try {
      await RunFastbootHostCommand(`--set-active=${slot}`);
      toast.success(`Active slot set to ${slot.toUpperCase()}`, { id: toastId });
      useLogStore.getState().addLog(`Set active slot to ${slot}`, 'success');
    } catch (error) {
      toast.error(`Failed to set slot ${slot}`, { id: toastId, description: String(error) });
      useLogStore.getState().addLog(`Failed to set active slot ${slot}: ${error}`, 'error');
    }
    setLoadingAction(null);
  };

  const handleFastbootGetVars = async () => {
    setLoadingAction('get_vars');
    try {
      const output = await RunFastbootHostCommand('getvar all');
      setGetVarContent(output);
      setShowGetVarDialog(true);
      useLogStore.getState().addLog('Fetched fastboot variables', 'success');
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

  const handleCopyGetVars = async () => {
    if (!getVarContent) return;
    try {
      await writeText(getVarContent);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy', { description: String(error) });
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

  const isActionLoading = (action: string) => loadingAction === action;
  const isGlobalLoading = !!loadingAction;

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header / Status Bar - Mirrored from Dashboard */}
      <ConnectedDevicesCard
        key={nicknameVersion}
        devices={
          deviceSerial
            ? [
                {
                  serial: deviceSerial,
                  status: deviceMode === 'adb' ? deviceStatus : 'fastboot',
                },
              ]
            : []
        }
        isLoading={isManualRefreshing}
        isRefreshDisabled={isGlobalLoading}
        onRefresh={handleManualRefresh}
        onEdit={() => setIsEditing(true)}
        emptyText={
          isCheckingStatus
            ? 'Scanning for devices...'
            : 'No device detected. Ensure USB Debugging is enabled.'
        }
      />

      <EditNicknameDialog
        isOpen={isEditing}
        onOpenChange={setIsEditing}
        serial={deviceSerial}
        onSaved={() => setNicknameVersion((v) => v + 1)}
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
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Power Menu
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleReboot('', 'system')}
                  disabled={isGlobalLoading || deviceMode !== 'adb'}
                >
                  <Power className="h-5 w-5" />
                  Reboot System
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleReboot('recovery', 'recovery')}
                  disabled={isGlobalLoading || deviceMode !== 'adb'}
                >
                  <RotateCw className="h-5 w-5" />
                  Reboot Recovery
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleReboot('bootloader', 'bootloader')}
                  disabled={isGlobalLoading || deviceMode !== 'adb'}
                >
                  <Terminal className="h-5 w-5" />
                  Reboot Bootloader
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleReboot('fastboot', 'fastboot')}
                  disabled={isGlobalLoading || deviceMode !== 'adb'}
                >
                  <Zap className="h-5 w-5" />
                  Reboot Fastbootd
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Server Control
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  onClick={handleRestartServer}
                  disabled={isGlobalLoading}
                  className="justify-start pl-4"
                >
                  {isActionLoading('restart_server') ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Restart ADB Server
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleKillServer}
                  disabled={isGlobalLoading}
                  className="justify-start pl-4 hover:bg-destructive/10 hover:text-destructive"
                >
                  {isActionLoading('kill_server') ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Server className="mr-2 h-4 w-4" />
                  )}
                  Kill ADB Server
                </Button>
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
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Power Menu
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleReboot('', 'system')}
                  disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                >
                  <Power className="h-5 w-5" />
                  Reboot System
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleReboot('bootloader', 'bootloader')}
                  disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                >
                  <Terminal className="h-5 w-5" />
                  Reboot Bootloader
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2 col-span-2"
                  onClick={() => handleReboot('recovery', 'recovery')}
                  disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                >
                  <RotateCw className="h-5 w-5" />
                  Reboot Recovery
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Slot Management
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  onClick={() => handleSetActiveSlot('a')}
                  disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                  className="justify-start pl-4"
                >
                  {isActionLoading('set_active_a') ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Activate Slot A
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSetActiveSlot('b')}
                  disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                  className="justify-start pl-4"
                >
                  {isActionLoading('set_active_b') ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Activate Slot B
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Device Operations
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="secondary"
                  onClick={handleFastbootGetVars}
                  disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                  className="justify-start pl-4"
                >
                  {isActionLoading('get_vars') ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Info className="mr-2 h-4 w-4" />
                  )}
                  Get Device Variables (GetVar All)
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={isGlobalLoading || deviceMode !== 'fastboot'}
                      className="justify-start pl-4"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
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
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

      {/* Dialog for GetVar All Output - Using AlertDialog as fallback */}
      <AlertDialog open={showGetVarDialog} onOpenChange={setShowGetVarDialog}>
        <AlertDialogContent className="w-[95vw] max-w-2xl max-h-[80vh] flex flex-col">
          <AlertDialogHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <AlertDialogTitle className="flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Fastboot Variables
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Output of <code>fastboot getvar all</code>
                </AlertDialogDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopyGetVars}
                  disabled={!getVarContent}
                  title="Copy to Clipboard"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleSaveGetVars}
                  disabled={!getVarContent}
                  title="Save to Log"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </AlertDialogHeader>
          <div className="rounded-md border bg-muted/50 p-4 max-h-[60vh] overflow-y-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
              {getVarContent || 'No output received.'}
            </pre>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
