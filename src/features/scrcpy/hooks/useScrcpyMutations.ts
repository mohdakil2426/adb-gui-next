import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  OpenFolder,
  ScrcpyCheckUpdate,
  ScrcpyInstall,
  ScrcpyLaunch,
  ScrcpyStop,
  ScrcpyUninstall,
} from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { useNicknameStore } from '@/shared/stores/nicknameStore';
import { handleError } from '@/shared/utils/errorHandler';
import { queryKeys } from '@/shared/utils/queries';

export function useScrcpyMutations(options: backend.ScrcpyLaunchOptions) {
  const queryClient = useQueryClient();
  const nicknames = useNicknameStore((state) => state.nicknames);

  const updateActiveSerials = (updater: (prev: string[]) => string[]) => {
    queryClient.setQueryData(
      queryKeys.scrcpy.activeSessions,
      (prev: backend.ScrcpyActiveSessions | undefined) => {
        const next = updater(prev?.serials ?? []);
        return { serials: next, sessions: next.map((s) => ({ pid: 0, serial: s })) };
      },
    );
  };

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

  const launch = useMutation({
    mutationFn: async (serials: string[]) => {
      if (serials.length === 0) {
        throw new Error('No device selected');
      }
      const results = await Promise.allSettled(serials.map((s) => ScrcpyLaunch(options, s)));
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failures.length === serials.length && serials.length > 0) {
        const reason = failures[0]?.reason;
        throw reason instanceof Error ? reason : new Error(String(reason));
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
          : 'Opened native scrcpy mirror window',
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

  const uninstall = useMutation({
    mutationFn: ScrcpyUninstall,
    onError: (error) => handleError('Scrcpy uninstall', error),
    onSuccess: (st) => {
      queryClient.setQueryData(queryKeys.scrcpy.status, st);
      toast.success('Uninstalled scrcpy');
    },
  });

  const handleOpenInstalledFolder = (binaryPath?: string | null) => {
    if (!binaryPath) {
      return;
    }
    const folder = binaryPath.replace(/[/\\][^/\\]+$/, '');
    void OpenFolder(folder).catch((error: unknown) => {
      handleError('Open installed folder', error);
    });
  };

  return {
    checkUpdate,
    handleOpenInstalledFolder,
    install,
    launch,
    stop,
    stopDevice,
    uninstall,
  };
}
