import type { backend } from '@/desktop/models';
import { EmulatorLaunchStudioTab } from '@/features/emulator/ui/launch/EmulatorLaunchStudioTab';

interface EmulatorLaunchTabProps {
  isBusy?: boolean;
  launchBlockedReason?: string | null;
  onLaunch: (options?: backend.EmulatorLaunchOptions) => void;
  onStop?: () => void;
  pendingAction?: string | null;
  selectedAvd: backend.AvdSummary | null;
}

export function EmulatorLaunchTab({
  isBusy = false,
  launchBlockedReason = null,
  onLaunch,
  onStop = () => {},
  pendingAction = null,
  selectedAvd,
}: EmulatorLaunchTabProps) {
  return (
    <EmulatorLaunchStudioTab
      isBusy={isBusy}
      launchBlockedReason={launchBlockedReason}
      onLaunch={onLaunch}
      onStop={onStop}
      pendingAction={pendingAction}
      selectedAvd={selectedAvd}
    />
  );
}
