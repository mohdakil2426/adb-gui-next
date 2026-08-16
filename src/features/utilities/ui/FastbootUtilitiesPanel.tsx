import { Info, Loader2, Power, RotateCw, Terminal, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import { UtilitiesGate } from '@/features/utilities/ui/UtilitiesGate';
import { ActionButton } from '@/shared/components/ActionButton';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

type RebootModeId = 'system' | 'recovery' | 'bootloader' | 'fastboot' | null;
type FastbootConfirm =
  | 'slotA'
  | 'slotB'
  | 'wipe'
  | 'toBootloader'
  | 'recovery'
  | 'bootloader'
  | null;

export function FastbootUtilitiesPanel({
  deviceMode,
  deviceSerial,
  handleFastbootGetVars,
  handleReboot,
  handleSetActiveSlot,
  handleWipeData,
  isGlobalLoading,
  loadingAction,
  onRescan,
  sentAction,
}: {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
  handleFastbootGetVars: () => void;
  handleReboot: (mode: string, modeId: RebootModeId, actionId: string) => void;
  handleSetActiveSlot: (slot: string) => void;
  handleWipeData: () => void;
  isGlobalLoading: boolean;
  loadingAction: string | null;
  onRescan: () => void;
  sentAction: string | null;
}) {
  const [pending, setPending] = useState<FastbootConfirm>(null);
  const isFastboot = deviceMode === 'fastboot';
  const target = deviceSerial ?? 'the selected device';

  const closeConfirm = (open: boolean) => {
    if (!open) {
      setPending(null);
    }
  };

  const runSlotSwitch = (slot: string) => {
    setPending(null);
    handleSetActiveSlot(slot);
  };

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
        {isFastboot ? null : (
          <UtilitiesGate
            action={
              deviceMode === 'adb'
                ? { label: 'Reboot to Bootloader', onClick: () => setPending('toBootloader') }
                : { label: 'Rescan', onClick: onRescan }
            }
            message={
              deviceMode === 'adb'
                ? 'The selected device is running Android. Reboot it into the bootloader to use these actions.'
                : 'Connect a device and boot it into bootloader or fastboot mode, then select it in the device switcher.'
            }
            title={
              deviceMode === 'adb'
                ? 'Selected device is not in fastboot mode'
                : 'No fastboot device selected'
            }
          />
        )}

        <div className="flex flex-col gap-3">
          <SectionHeader>Power Menu</SectionHeader>
          <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
            <ActionButton
              actionId="fb_system"
              disabled={!isFastboot}
              icon={Power}
              label="Reboot System"
              loadingAction={loadingAction}
              onClick={() => handleReboot('', 'system', 'fb_system')}
              sentAction={sentAction}
              variant="outline"
            />
            <ActionButton
              actionId="fb_bootloader"
              disabled={!isFastboot}
              icon={Terminal}
              label="Reboot Bootloader"
              loadingAction={loadingAction}
              onClick={() => setPending('bootloader')}
              sentAction={sentAction}
              variant="outline"
            />
            <ActionButton
              actionId="fb_recovery"
              disabled={!isFastboot}
              icon={RotateCw}
              label="Reboot Recovery"
              loadingAction={loadingAction}
              onClick={() => setPending('recovery')}
              sentAction={sentAction}
              variant="outline"
              wrapperClassName="col-span-1 @lg:col-span-2"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <SectionHeader>Slot Management</SectionHeader>
          <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
            <ActionButton
              actionId="set_active_a"
              disabled={!isFastboot}
              icon={Zap}
              justifyStart
              label="Activate Slot A"
              loadingAction={loadingAction}
              onClick={() => setPending('slotA')}
              sentAction={sentAction}
              variant="secondary"
            />
            <ActionButton
              actionId="set_active_b"
              disabled={!isFastboot}
              icon={Zap}
              justifyStart
              label="Activate Slot B"
              loadingAction={loadingAction}
              onClick={() => setPending('slotB')}
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
              disabled={!isFastboot}
              icon={Info}
              justifyStart
              label="Get Device Variables (GetVar All)"
              loadingAction={loadingAction}
              onClick={handleFastbootGetVars}
              sentAction={sentAction}
              variant="secondary"
            />

            <Button
              className="w-full justify-start pl-4"
              disabled={isGlobalLoading || !isFastboot}
              onClick={() => setPending('wipe')}
              variant="destructive"
            >
              {loadingAction === 'wipe_data' ? (
                <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Wipe User Data (Factory Reset)
            </Button>
          </div>
        </div>
      </CardContent>

      <ConfirmDialog
        confirmLabel="Activate Slot A"
        consequence={
          <p>
            If slot A has never been flashed, the device has nothing to boot and will drop back to
            fastboot. Check <strong>current-slot</strong> and <strong>slot-successful</strong> with
            Get Device Variables first.
          </p>
        }
        description="Changes which A/B slot the device boots from on the next restart."
        details={[
          { label: 'Target', mono: true, value: target },
          { label: 'New active slot', mono: true, value: 'a' },
        ]}
        onConfirm={() => runSlotSwitch('a')}
        onOpenChange={closeConfirm}
        open={pending === 'slotA'}
        title="Switch active slot to A?"
      />

      <ConfirmDialog
        confirmLabel="Activate Slot B"
        consequence={
          <p>
            If slot B has never been flashed, the device has nothing to boot and will drop back to
            fastboot. Check <strong>current-slot</strong> and <strong>slot-successful</strong> with
            Get Device Variables first.
          </p>
        }
        description="Changes which A/B slot the device boots from on the next restart."
        details={[
          { label: 'Target', mono: true, value: target },
          { label: 'New active slot', mono: true, value: 'b' },
        ]}
        onConfirm={() => runSlotSwitch('b')}
        onOpenChange={closeConfirm}
        open={pending === 'slotB'}
        title="Switch active slot to B?"
      />

      <ConfirmDialog
        confirmLabel="Erase user data"
        confirmPhrase="WIPE"
        consequence={
          <p>
            All photos, files, accounts and settings are erased. There is no undo and no backup is
            taken.
          </p>
        }
        description="Runs fastboot -w, which erases the userdata and cache partitions."
        details={[{ label: 'Target', mono: true, value: target }]}
        onConfirm={() => {
          setPending(null);
          handleWipeData();
        }}
        onOpenChange={closeConfirm}
        open={pending === 'wipe'}
        title="Erase all user data?"
      />

      <ConfirmDialog
        confirmLabel="Reboot to Bootloader"
        consequence={
          <p>
            The device leaves normal operation and becomes reachable only over fastboot. Any
            transfer or shell session in flight is cut off.
          </p>
        }
        description={`${target} will restart into the bootloader.`}
        onConfirm={() => {
          setPending(null);
          handleReboot('bootloader', 'bootloader', 'adb_bootloader');
        }}
        onOpenChange={closeConfirm}
        open={pending === 'toBootloader'}
        title="Reboot into the bootloader?"
      />

      <ConfirmDialog
        confirmLabel="Reboot to recovery"
        consequence={
          <p>The device leaves fastboot and enters recovery. In-flight flashing stops.</p>
        }
        description={`${target} will restart into recovery.`}
        onConfirm={() => {
          setPending(null);
          handleReboot('recovery', 'recovery', 'fb_recovery');
        }}
        onOpenChange={closeConfirm}
        open={pending === 'recovery'}
        title="Reboot into recovery?"
      />

      <ConfirmDialog
        confirmLabel="Reboot bootloader"
        consequence={
          <p>The device restarts the bootloader. Any in-flight fastboot command is cut off.</p>
        }
        description={`${target} will reboot into the bootloader.`}
        onConfirm={() => {
          setPending(null);
          handleReboot('bootloader', 'bootloader', 'fb_bootloader');
        }}
        onOpenChange={closeConfirm}
        open={pending === 'bootloader'}
        title="Reboot the bootloader?"
      />
    </Card>
  );
}
