import { LoadingButton } from '@/components/LoadingButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { backend } from '@/lib/desktop/models';
import { Play } from 'lucide-react';
import { useState } from 'react';

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
      <p className="py-4 text-sm text-muted-foreground">
        Select an AVD to configure advanced launch options.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { id: 'coldBoot', label: 'Cold boot', value: coldBoot, onChange: setColdBoot },
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
            { id: 'wipeData', label: 'Wipe user data', value: wipeData, onChange: setWipeData },
          ] as const
        ).map((opt) => (
          <Label key={opt.id} className="flex items-center gap-2.5 text-sm">
            <Checkbox
              id={`launch-opt-${opt.id}`}
              checked={opt.value}
              onCheckedChange={(checked) => opt.onChange(checked === true)}
            />
            {opt.label}
          </Label>
        ))}
      </div>

      {(wipeData || writableSystem) && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm text-amber-800 dark:text-amber-200">
              Safety confirmation required
            </CardTitle>
            <CardDescription className="text-amber-700/80 dark:text-amber-300/80">
              Acknowledge the risks before launching with destructive flags.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            {wipeData && (
              <Label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={confirmWipeData}
                  onCheckedChange={(checked) => setConfirmWipeData(checked === true)}
                />
                I understand wiping data resets this emulator profile.
              </Label>
            )}
            {writableSystem && (
              <Label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={confirmWritableSystem}
                  onCheckedChange={(checked) => setConfirmWritableSystem(checked === true)}
                />
                I understand writable-system can leave this AVD in a modified state.
              </Label>
            )}
          </CardContent>
        </Card>
      )}

      <LoadingButton
        isLoading={isLaunching}
        icon={<Play className="size-4" />}
        loadingLabel="Launching…"
        disabled={destructiveBlocked}
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
