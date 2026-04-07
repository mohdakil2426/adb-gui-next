import { LoadingButton } from '@/components/LoadingButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  const [headless, setHeadless] = useState(false);
  const [coldBoot, setColdBoot] = useState(false);
  const [noSnapshotLoad, setNoSnapshotLoad] = useState(false);
  const [noSnapshotSave, setNoSnapshotSave] = useState(false);
  const [noBootAnim, setNoBootAnim] = useState(false);
  const [netSpeed, setNetSpeed] = useState('');
  const [netDelay, setNetDelay] = useState('');
  const [confirmWipeData, setConfirmWipeData] = useState(false);
  const [confirmWritableSystem, setConfirmWritableSystem] = useState(false);

  const destructiveBlocked =
    (wipeData && !confirmWipeData) || (writableSystem && !confirmWritableSystem);

  if (!avd) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-sm text-muted-foreground">
            Select an AVD to configure advanced launch options.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-2 border-b pb-4">
        <CardTitle className="text-base">Advanced launch</CardTitle>
        <CardDescription>
          Tune emulator flags before booting. Dangerous options require an explicit confirmation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Label>
            <Checkbox
              checked={headless}
              onCheckedChange={(checked) => setHeadless(checked === true)}
            />
            Headless mode
          </Label>
          <Label>
            <Checkbox
              checked={coldBoot}
              onCheckedChange={(checked) => setColdBoot(checked === true)}
            />
            Cold boot
          </Label>
          <Label>
            <Checkbox
              checked={noSnapshotLoad}
              onCheckedChange={(checked) => setNoSnapshotLoad(checked === true)}
            />
            Disable snapshot load
          </Label>
          <Label>
            <Checkbox
              checked={noSnapshotSave}
              onCheckedChange={(checked) => setNoSnapshotSave(checked === true)}
            />
            Disable snapshot save
          </Label>
          <Label>
            <Checkbox
              checked={noBootAnim}
              onCheckedChange={(checked) => setNoBootAnim(checked === true)}
            />
            Disable boot animation
          </Label>
          <Label>
            <Checkbox
              checked={writableSystem}
              onCheckedChange={(checked) => setWritableSystem(checked === true)}
            />
            Writable system
          </Label>
          <Label>
            <Checkbox
              checked={wipeData}
              onCheckedChange={(checked) => setWipeData(checked === true)}
            />
            Wipe user data
          </Label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emulator-net-speed">Network speed</Label>
            <Input
              id="emulator-net-speed"
              placeholder="full, lte, edge..."
              value={netSpeed}
              onChange={(event) => setNetSpeed(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emulator-net-delay">Network delay</Label>
            <Input
              id="emulator-net-delay"
              placeholder="none, gsm, edge..."
              value={netDelay}
              onChange={(event) => setNetDelay(event.target.value)}
            />
          </div>
        </div>

        {(wipeData || writableSystem) && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">Safety confirmation</p>
            <div className="mt-3 grid gap-3">
              {wipeData && (
                <Label>
                  <Checkbox
                    checked={confirmWipeData}
                    onCheckedChange={(checked) => setConfirmWipeData(checked === true)}
                  />
                  I understand that wiping data resets this emulator profile.
                </Label>
              )}
              {writableSystem && (
                <Label>
                  <Checkbox
                    checked={confirmWritableSystem}
                    onCheckedChange={(checked) => setConfirmWritableSystem(checked === true)}
                  />
                  I understand that writable-system can leave this AVD in a modified state.
                </Label>
              )}
            </div>
          </div>
        )}

        <LoadingButton
          isLoading={isLaunching}
          icon={<Play className="size-4" />}
          loadingLabel="Launching..."
          disabled={destructiveBlocked}
          onClick={() =>
            void onLaunch({
              wipeData,
              writableSystem,
              headless,
              coldBoot,
              noSnapshotLoad,
              noSnapshotSave,
              noBootAnim,
              netSpeed: netSpeed.trim() || null,
              netDelay: netDelay.trim() || null,
            })
          }
        >
          Launch With These Options
        </LoadingButton>
      </CardContent>
    </Card>
  );
}
