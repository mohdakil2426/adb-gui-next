import { useQuery } from '@tanstack/react-query';
import { GetHostToolVersions, HostSetupStatus } from '@/desktop/backend';
import { HostGoogleSetupCard } from '@/features/utilities/host/HostGoogleSetupCard';
import { HostServerControlCard } from '@/features/utilities/host/HostServerControlCard';
import { isWindows } from '@/shared/utils/platform';
import { queryKeys } from '@/shared/utils/queries';

interface UtilitiesHostTabProps {
  handleKillServer: () => void;
  handleRestartServer: () => void;
  loadingAction: string | null;
  sentAction: string | null;
}

export function UtilitiesHostTab({
  handleKillServer,
  handleRestartServer,
  loadingAction,
  sentAction,
}: UtilitiesHostTabProps) {
  // Status Query (Windows only)
  const { data: hostStatus } = useQuery({
    enabled: isWindows,
    queryFn: HostSetupStatus,
    queryKey: queryKeys.hostSetup.status,
  });

  // Versions Query
  const { data: hostVersions } = useQuery({
    queryFn: GetHostToolVersions,
    queryKey: ['hostToolVersions', sentAction],
  });

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Host ADB Server Daemon Controls */}
      <HostServerControlCard
        handleKillServer={handleKillServer}
        handleRestartServer={handleRestartServer}
        loadingAction={loadingAction}
        sentAction={sentAction}
        versions={hostVersions}
      />

      {/* 2. Official Google Platform-Tools & Driver Suite (Windows) */}
      {isWindows ? <HostGoogleSetupCard status={hostStatus} /> : null}
    </div>
  );
}
