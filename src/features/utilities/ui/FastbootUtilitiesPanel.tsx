import { Info, Loader2, Power, RotateCw, Terminal, Trash2, Zap } from 'lucide-react';
import { ActionButton } from '@/shared/components/ActionButton';
import { SectionHeader } from '@/shared/components/SectionHeader';
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
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function FastbootUtilitiesPanel({
  deviceMode,
  handleFastbootGetVars,
  handleReboot,
  handleSetActiveSlot,
  handleWipeData,
  isGlobalLoading,
  loadingAction,
  sentAction,
}: {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  handleFastbootGetVars: () => void;
  handleReboot: (
    mode: string,
    modeId: 'system' | 'recovery' | 'bootloader' | 'fastboot' | null,
    actionId: string,
  ) => void;
  handleSetActiveSlot: (slot: string) => void;
  handleWipeData: () => void;
  isGlobalLoading: boolean;
  loadingAction: string | null;
  sentAction: string | null;
}) {
  return (
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
  );
}
