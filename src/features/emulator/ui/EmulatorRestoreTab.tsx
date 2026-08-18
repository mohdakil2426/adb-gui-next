import type { backend } from '@/desktop/models';
import { EmulatorRestoreStudioTab } from '@/features/emulator/ui/restore/EmulatorRestoreStudioTab';

interface EmulatorRestoreTabProps {
  avd: backend.AvdSummary | null;
  isLoadingPlan: boolean;
  isRestoring: boolean;
  onRequestRestore: () => void;
  restorePlan: backend.RestorePlan | null;
}

export function EmulatorRestoreTab({
  avd,
  isLoadingPlan,
  isRestoring,
  onRequestRestore,
  restorePlan,
}: EmulatorRestoreTabProps) {
  return (
    <EmulatorRestoreStudioTab
      avd={avd}
      isLoadingPlan={isLoadingPlan}
      isRestoring={isRestoring}
      onRequestRestore={onRequestRestore}
      restorePlan={restorePlan}
    />
  );
}
