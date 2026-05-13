import { AlertTriangle, Play } from 'lucide-react';
import { useState } from 'react';
import { LoadingButton } from '@/components/LoadingButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { backend } from '@/lib/desktop/models';

interface EmulatorLaunchTabProps {
  avd: backend.AvdSummary | null;
  isLaunching: boolean;
  onLaunch: (options: backend.EmulatorLaunchOptions) => Promise<void>;
}

export function EmulatorLaunchTab({ avd, isLaunching, onLaunch }: EmulatorLaunchTabProps) {
  const [wipeData, setWipeData] = useState(false);
  const [writableSystem, setWritableSystem] = useState(false);
  const [coldBoot, setColdBoot] = useState(false);
  const [noSnapshotLoad, setNoSnapshotLoad] = useState(false);
  const [noSnapshotSave, setNoSnapshotSave] = useState(false);
  const [noBootAnim, setNoBootAnim] = useState(false);
  const [confirmWipeData, setConfirmWipeData] = useState(false);
  const [confirmWritableSystem, setConfirmWritableSystem] = useState(false);

  const destructiveBlocked =
    (wipeData && !confirmWipeData) || (writableSystem && !confirmWritableSystem);

  if (!avd) {
    return (
      <p className="py-4 text-muted-foreground text-sm">
        Select an AVD to configure advanced launch options.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              id: 'coldBoot',
              label: 'Cold boot',
              value: coldBoot,
              onChange: setColdBoot,
            },
            {
              id: 'noSnapLoad',
              label: 'Skip snapshot load',
              value: noSnapshotLoad,
              onChange: setNoSnapshotLoad,
            },
            {
              id: 'noSnapSave',
              label: 'Skip snapshot save',
              value: noSnapshotSave,
              onChange: setNoSnapshotSave,
            },
            {
              id: 'noBootAnim',
              label: 'Disable boot animation',
              value: noBootAnim,
              onChange: setNoBootAnim,
            },
            {
              id: 'writableSystem',
              label: 'Writable system',
              value: writableSystem,
              onChange: setWritableSystem,
            },
            {
              id: 'wipeData',
              label: 'Wipe user data',
              value: wipeData,
              onChange: setWipeData,
            },
          ] as const
        ).map((opt) => (
          <Label className="flex items-center gap-2.5 text-sm" key={opt.id}>
            <Switch
              checked={opt.value}
              id={`launch-opt-${opt.id}`}
              onCheckedChange={(checked) => {
                opt.onChange(checked);
              }}
            />
            {opt.label}
          </Label>
        ))}
      </div>

      {wipeData || writableSystem ? (
        <Alert className="border-warning/30 bg-warning/10 text-warning-foreground">
          <AlertTriangle />
          <AlertTitle>Safety confirmation required</AlertTitle>
          <AlertDescription className="text-warning-foreground/90">
            Acknowledge the risks before launching with destructive flags.
          </AlertDescription>
          <div className="col-start-2 mt-2 flex flex-col gap-3">
            {wipeData ? (
              <Label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={confirmWipeData}
                  onCheckedChange={(checked: boolean) => {
                    setConfirmWipeData(checked);
                  }}
                />
                I understand wiping data resets this emulator profile.
              </Label>
            ) : null}
            {writableSystem ? (
              <Label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={confirmWritableSystem}
                  onCheckedChange={(checked: boolean) => {
                    setConfirmWritableSystem(checked);
                  }}
                />
                I understand writable-system can leave this AVD in a modified state.
              </Label>
            ) : null}
          </div>
        </Alert>
      ) : null}

      <LoadingButton
        disabled={destructiveBlocked}
        icon={<Play className="size-4" />}
        isLoading={isLaunching}
        loadingLabel="Launching…"
        onClick={() =>
          void onLaunch({
            wipeData,
            writableSystem,
            coldBoot,
            noSnapshotLoad,
            noSnapshotSave,
            noBootAnim,
          })
        }
      >
        Launch with these options
      </LoadingButton>
    </div>
  );
}
