import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ScrcpyActiveSessions,
  ScrcpyCheckUpdate,
  ScrcpyInstall,
  ScrcpyLaunch,
  ScrcpyStatus,
  ScrcpyStop,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useScrcpyProgress } from '@/features/scrcpy/hooks/useScrcpyProgress';
import { DEFAULT_SCRCPY_OPTIONS } from '@/features/scrcpy/model/defaults';
import { ScrcpySessionCard } from '@/features/scrcpy/ui/ScrcpySessionCard';
import { ScrcpyStatusCard } from '@/features/scrcpy/ui/ScrcpyStatusCard';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useNicknameStore } from '@/shared/stores/nicknameStore';
import { handleError } from '@/shared/utils/errorHandler';
import { queryKeys } from '@/shared/utils/queries';

export function ViewScrcpy() {
  const queryClient = useQueryClient();
  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const nicknames = useNicknameStore((state) => state.nicknames);
  const progress = useScrcpyProgress();
  const [options, setOptions] = useState<backend.ScrcpyLaunchOptions>(DEFAULT_SCRCPY_OPTIONS);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(() =>
    selectedSerial ? new Set([selectedSerial]) : new Set(),
  );

  useEffect(() => {
    const adbSerials = new Set(devices.filter((d) => d.status === 'device').map((d) => d.serial));
    setSelectedSerials((prev) => {
      const valid = new Set([...prev].filter((s) => adbSerials.has(s)));
      if (valid.size > 0) {
        return valid;
      }
      if (selectedSerial && adbSerials.has(selectedSerial)) {
        return new Set([selectedSerial]);
      }
      const first = adbSerials.values().next().value;
      return first ? new Set([first]) : new Set();
    });
  }, [devices, selectedSerial]);
  const handleToggleSerial = (serial: string) => {
    setSelectedSerials((prev) => {
      const next = new Set(prev);
      if (next.has(serial)) {
        next.delete(serial);
      } else {
        next.add(serial);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const adbSerials = devices.filter((d) => d.status === 'device').map((d) => d.serial);
    setSelectedSerials(new Set(adbSerials));
  };

  const handleClearAll = () => {
    setSelectedSerials(new Set());
  };

  const statusQuery = useQuery({
    queryFn: ScrcpyStatus,
    queryKey: queryKeys.scrcpy.status,
  });

  const activeSessionsQuery = useQuery({
    queryFn: ScrcpyActiveSessions,
    queryKey: queryKeys.scrcpy.activeSessions,
    refetchInterval: 2500,
    staleTime: 1000,
  });

  const activeSerials = new Set(activeSessionsQuery.data?.serials ?? []);

  const install = useMutation({
    mutationFn: ScrcpyInstall,
    onError: (error) => handleError('Scrcpy download', error),
    onSuccess: (st) => {
      queryClient.setQueryData(queryKeys.scrcpy.status, st);
      toast.success(`scrcpy ${st.installedVersion ?? ''} is ready`);
    },
  });

  const checkUpdate = useMutation({
    mutationFn: ScrcpyCheckUpdate,
    onError: (error) => handleError('Scrcpy update check', error),
    onSuccess: (st) => {
      queryClient.setQueryData(queryKeys.scrcpy.status, st);
      if (st.latestVersion && st.latestVersion !== st.installedVersion) {
        toast.message(`Update available: ${st.latestVersion}`);
      } else {
        toast.success('scrcpy is up to date');
      }
    },
  });

  const updateActiveSerials = (updater: (prev: string[]) => string[]) => {
    queryClient.setQueryData(
      queryKeys.scrcpy.activeSessions,
      (prev: backend.ScrcpyActiveSessions | undefined) => {
        const next = updater(prev?.serials ?? []);
        return { serials: next, sessions: next.map((s) => ({ pid: 0, serial: s })) };
      },
    );
  };

  const launch = useMutation({
    mutationFn: async (serials: string[]) => {
      if (serials.length === 0) {
        throw new Error('No device selected');
      }
      const results = await Promise.allSettled(serials.map((s) => ScrcpyLaunch(options, s)));
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failures.length === serials.length && serials.length > 0) {
        const firstReason = failures[0]?.reason;
        throw firstReason instanceof Error ? firstReason : new Error(String(firstReason));
      }
      if (failures.length > 0) {
        toast.error(`Failed to launch scrcpy for ${failures.length} device(s)`);
      }
    },
    onError: (error) => handleError('Scrcpy launch', error),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scrcpy.activeSessions });
    },
    onSuccess: (_, serials) => {
      updateActiveSerials((existing) => Array.from(new Set([...existing, ...serials])));
      toast.success(
        serials.length > 1
          ? `Opened ${serials.length} scrcpy mirror windows`
          : 'Opened a native scrcpy window',
      );
    },
  });

  const stop = useMutation({
    mutationFn: () => ScrcpyStop(),
    onError: (error) => handleError('Stop scrcpy', error),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scrcpy.activeSessions });
    },
    onSuccess: () => {
      updateActiveSerials(() => []);
      toast.success('Closed running scrcpy window(s)');
    },
  });

  const stopDevice = useMutation({
    mutationFn: (serial: string) => ScrcpyStop(serial),
    onError: (error) => handleError('Stop scrcpy', error),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scrcpy.activeSessions });
    },
    onSuccess: (_, serial) => {
      updateActiveSerials((existing) => existing.filter((s) => s !== serial && s !== '*'));
      const name = nicknames[serial] ?? serial;
      toast.success(`Closed scrcpy window for ${name}`);
    },
  });

  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="sr-only">Scrcpy</h1>

      <ScrcpyStatusCard
        isCheckingUpdate={checkUpdate.isPending}
        isError={statusQuery.isError}
        isInstalling={install.isPending}
        onCheckUpdate={() => checkUpdate.mutate()}
        onInstall={() => install.mutate()}
        progress={progress}
        status={statusQuery.data}
      />

      <ScrcpySessionCard
        activeSerials={activeSerials}
        canLaunch={Boolean(statusQuery.data?.binaryPath) || statusQuery.data?.source === 'path'}
        isLaunching={launch.isPending}
        isStopping={stop.isPending || stopDevice.isPending}
        onClearAll={handleClearAll}
        onLaunch={() => launch.mutate(Array.from(selectedSerials))}
        onOptionsChange={(partial) => {
          setOptions((current) => ({ ...current, ...partial }));
        }}
        onSelectAll={handleSelectAll}
        onStop={() => {
          if (selectedSerials.size > 0 && selectedSerials.size < activeSerials.size) {
            void Promise.all(Array.from(selectedSerials).map((s) => stopDevice.mutateAsync(s)));
          } else {
            stop.mutate();
          }
        }}
        onStopDevice={(serial) => stopDevice.mutate(serial)}
        onToggleSerial={handleToggleSerial}
        options={options}
        selectedSerials={selectedSerials}
      />
    </div>
  );
}
