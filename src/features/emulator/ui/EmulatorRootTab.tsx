import type { backend } from '@/desktop/models';
import { EmulatorRootStudioTab } from '@/features/emulator/ui/root/EmulatorRootStudioTab';

interface EmulatorRootTabProps {
  avd: backend.AvdSummary | null;
  onLaunch: (options: backend.EmulatorLaunchOptions) => void;
}

export function EmulatorRootTab({ avd, onLaunch }: EmulatorRootTabProps) {
  return <EmulatorRootStudioTab avd={avd} onLaunch={onLaunch} />;
}
