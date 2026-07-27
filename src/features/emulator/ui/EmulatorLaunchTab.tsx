import { Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import type { backend } from '@/desktop/models';
import { useEmulatorManagerStore } from '@/features/emulator/model/emulatorManagerStore';
import {
  COLD_BOOT_LAUNCH_OPTIONS,
  DEFAULT_LAUNCH_OPTIONS,
  isColdBootPreset,
  LAUNCH_OPTIONS,
  unacknowledgedLaunchOptions,
} from '@/features/emulator/model/launchOptions';
import { LoadingButton } from '@/shared/components/LoadingButton';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { Switch } from '@/shared/ui/switch';

interface EmulatorLaunchTabProps {
  avd: backend.AvdSummary | null;
  isLaunching: boolean;
  onLaunch: () => void;
}

/**
 * The launch configuration surface — and the only place launch flags are set.
 *
 * The flags live in the emulator store rather than in local state, so the
 * toolbar's Launch button applies exactly what is shown here. Presets write the
 * same object, which means picking "Cold boot" visibly flips the switches
 * instead of running a hidden configuration.
 */
export function EmulatorLaunchTab({ avd, isLaunching, onLaunch }: EmulatorLaunchTabProps) {
  const options = useEmulatorManagerStore((state) => state.launchOptions);
  const acknowledgements = useEmulatorManagerStore((state) => state.launchAcknowledgements);
  const setLaunchOption = useEmulatorManagerStore((state) => state.setLaunchOption);
  const setLaunchAcknowledged = useEmulatorManagerStore((state) => state.setLaunchAcknowledged);
  const applyLaunchPreset = useEmulatorManagerStore((state) => state.applyLaunchPreset);
  const fieldPrefix = useId();

  const pendingAcknowledgements = unacknowledgedLaunchOptions(options, acknowledgements);

  if (!avd) {
    return (
      <p className="py-4 text-body text-muted-foreground">
        Select an AVD to configure how it launches.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={isColdBootPreset(options)}
          onClick={() => {
            applyLaunchPreset(COLD_BOOT_LAUNCH_OPTIONS);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Cold boot preset
        </Button>
        <Button
          onClick={() => {
            applyLaunchPreset(DEFAULT_LAUNCH_OPTIONS);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RotateCcw aria-hidden="true" />
          Reset to defaults
        </Button>
      </div>

      <div className="grid @lg:grid-cols-2 gap-3">
        {LAUNCH_OPTIONS.map((option) => (
          <div
            className="flex items-start gap-2.5 rounded-md border border-border bg-surface-raised p-3"
            key={option.key}
          >
            <Switch
              checked={options[option.key]}
              id={`${fieldPrefix}-${option.key}`}
              onCheckedChange={(checked) => {
                setLaunchOption(option.key, checked);
              }}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Label className="text-body" htmlFor={`${fieldPrefix}-${option.key}`}>
                {option.label}
              </Label>
              <span className="text-caption text-muted-foreground">{option.description}</span>
            </div>
          </div>
        ))}
      </div>

      {pendingAcknowledgements.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-md border border-warning/30 bg-warning-muted p-3">
          <div className="flex items-start gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-body text-foreground">Confirm the destructive flags</p>
              <p className="text-caption text-muted-foreground">
                Launch stays disabled until each one is acknowledged.
              </p>
            </div>
          </div>
          {pendingAcknowledgements.map((option) => (
            <Label className="flex items-start gap-2.5 text-body" key={option.key}>
              <Checkbox
                checked={acknowledgements[option.key] ?? false}
                onCheckedChange={(checked: boolean) => {
                  setLaunchAcknowledged(option.key, checked);
                }}
              />
              {option.acknowledgement}
            </Label>
          ))}
        </div>
      ) : null}

      <LoadingButton
        className="w-fit"
        disabled={pendingAcknowledgements.length > 0}
        icon={<Play aria-hidden="true" className="size-4" />}
        isLoading={isLaunching}
        loadingLabel="Launching…"
        onClick={onLaunch}
      >
        Launch with these options
      </LoadingButton>
    </div>
  );
}
