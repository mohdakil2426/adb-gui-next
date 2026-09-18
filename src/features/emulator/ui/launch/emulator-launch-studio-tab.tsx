import { Play, Square } from "lucide-react";

import type { backend } from "@/desktop/models";
import { useEmulatorManagerStore } from "@/features/emulator/model/emulator-manager-store";
import { LaunchFlagsCard } from "@/features/emulator/ui/launch/launch-flags-card";
import { LaunchPresetsGrid } from "@/features/emulator/ui/launch/launch-presets-grid";
import { Button } from "@/shared/ui/button";

interface EmulatorLaunchStudioTabProps {
  isBusy: boolean;
  launchBlockedReason: string | null;
  onLaunch: (options?: backend.EmulatorLaunchOptions) => void;
  onStop: () => void;
  pendingAction: string | null;
  selectedAvd: backend.AvdSummary | null;
}
const getFooterCaption = (isRunning: boolean, selectedAvd: backend.AvdSummary | null) => {
  if (isRunning) {
    return "AVD is currently running on the host system.";
  }
  if (selectedAvd) {
    return `Will launch ${selectedAvd.name} with configured flags.`;
  }
  return "Select an AVD to launch.";
};

export const EmulatorLaunchStudioTab = ({
  isBusy,
  launchBlockedReason,
  onLaunch,
  onStop,
  selectedAvd,
}: EmulatorLaunchStudioTabProps) => {
  const launchOptions = useEmulatorManagerStore((state) => state.launchOptions);
  const applyLaunchPreset = useEmulatorManagerStore((state) => state.applyLaunchPreset);
  const launchAcknowledgements = useEmulatorManagerStore((state) => state.launchAcknowledgements);
  const setLaunchOption = useEmulatorManagerStore((state) => state.setLaunchOption);
  const setLaunchAcknowledged = useEmulatorManagerStore((state) => state.setLaunchAcknowledged);

  const isRunning = selectedAvd?.isRunning ?? false;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Quick Quality Presets */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-body text-foreground">
            AVD Startup Profiles & Presets
          </h3>
          <span className="text-caption text-muted-foreground">
            Select a tailored boot configuration for root, debugging, or speed.
          </span>
        </div>
        <LaunchPresetsGrid currentOptions={launchOptions} onApplyPreset={applyLaunchPreset} />
      </div>

      {/* 2. Granular Launch Flags */}
      <LaunchFlagsCard
        launchAcknowledgements={launchAcknowledgements}
        launchOptions={launchOptions}
        onAcknowledge={setLaunchAcknowledged}
        onToggleOption={setLaunchOption}
      />

      {/* 3. Launch Controls Footer */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised/40 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-body text-foreground">
            {isRunning ? "Virtual Machine Active" : "Ready to Boot"}
          </span>
          <span className="text-caption text-muted-foreground">
            {getFooterCaption(isRunning, selectedAvd)}
          </span>
        </div>

        {isRunning ? (
          <Button
            className="h-9 gap-1.5 px-4 text-caption"
            disabled={isBusy}
            onClick={onStop}
            type="button"
            variant="destructive"
          >
            <Square aria-hidden="true" className="size-3.5 fill-current" data-icon="inline-start" />
            Stop AVD Process
          </Button>
        ) : (
          <Button
            className="h-9 gap-1.5 px-4 text-caption"
            disabled={!selectedAvd || isBusy || Boolean(launchBlockedReason)}
            onClick={() => onLaunch()}
            type="button"
          >
            <Play aria-hidden="true" className="size-3.5 fill-current" data-icon="inline-start" />
            Launch Virtual Device
          </Button>
        )}
      </div>
    </div>
  );
};
