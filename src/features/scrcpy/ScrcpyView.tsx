import { useQuery } from '@tanstack/react-query';
import { Keyboard, Monitor, Package, Tv, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ScrcpyActiveSessions, ScrcpyStatus } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { ScrcpyAudioTab } from '@/features/scrcpy/audio/ScrcpyAudioTab';
import { ScrcpyBinaryTab } from '@/features/scrcpy/binary/ScrcpyBinaryTab';
import { ScrcpyDisplayTab } from '@/features/scrcpy/display/ScrcpyDisplayTab';
import { useScrcpyMutations } from '@/features/scrcpy/hooks/useScrcpyMutations';
import { useScrcpyProgress } from '@/features/scrcpy/hooks/useScrcpyProgress';
import { ScrcpyInputTab } from '@/features/scrcpy/input/ScrcpyInputTab';
import { DEFAULT_SCRCPY_OPTIONS } from '@/features/scrcpy/model/defaults';
import { ScrcpyOverviewTab } from '@/features/scrcpy/overview/ScrcpyOverviewTab';
import { ScrcpyCockpitHero } from '@/features/scrcpy/ScrcpyCockpitHero';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { queryKeys } from '@/shared/utils/queries';

export function ViewScrcpy() {
  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const progress = useScrcpyProgress();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [options, setOptions] = useState<backend.ScrcpyLaunchOptions>(DEFAULT_SCRCPY_OPTIONS);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(() =>
    selectedSerial ? new Set([selectedSerial]) : new Set(),
  );

  const adbDevices = devices.filter((d) => d.status === 'device');

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

  const { checkUpdate, handleOpenInstalledFolder, install, launch, stop, stopDevice, uninstall } =
    useScrcpyMutations(options);

  const handleOptionsChange = (partial: Partial<backend.ScrcpyLaunchOptions>) => {
    setOptions((current) => ({ ...current, ...partial }));
  };

  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="sr-only">Scrcpy Mirroring Cockpit</h1>

      {/* Top Precision Cockpit Hero Banner */}
      <ScrcpyCockpitHero
        activeSerials={activeSerials}
        canLaunch={Boolean(statusQuery.data?.binaryPath) || statusQuery.data?.source === 'path'}
        isCheckingUpdate={checkUpdate.isPending}
        isInstalling={install.isPending}
        isLaunching={launch.isPending}
        isStopping={stop.isPending || stopDevice.isPending}
        onCheckUpdate={() => checkUpdate.mutate()}
        onInstall={() => install.mutate()}
        onLaunch={() => launch.mutate(Array.from(selectedSerials))}
        onStopAll={() => {
          if (selectedSerials.size > 0 && selectedSerials.size < activeSerials.size) {
            void Promise.all(Array.from(selectedSerials).map((s) => stopDevice.mutateAsync(s)));
          } else {
            stop.mutate();
          }
        }}
        progress={progress}
        selectedSerials={selectedSerials}
        status={statusQuery.data}
        totalDevicesCount={adbDevices.length}
      />

      {/* 5-Tab Precision Cockpit Navigation */}
      <Tabs className="w-full gap-4" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="grid h-auto w-full @xl:grid-cols-5 grid-cols-2 gap-1 p-1">
          <TabsTrigger className="gap-1.5" value="overview">
            <Monitor aria-hidden="true" className="size-4" />
            <span>Overview & Mirror</span>
          </TabsTrigger>

          <TabsTrigger className="gap-1.5" value="display">
            <Tv aria-hidden="true" className="size-4" />
            <span>Display & Video</span>
          </TabsTrigger>

          <TabsTrigger className="gap-1.5" value="audio">
            <Volume2 aria-hidden="true" className="size-4" />
            <span>Audio & Record</span>
          </TabsTrigger>

          <TabsTrigger className="gap-1.5" value="input">
            <Keyboard aria-hidden="true" className="size-4" />
            <span>Input & Controls</span>
          </TabsTrigger>

          <TabsTrigger className="gap-1.5" value="binary">
            <Package aria-hidden="true" className="size-4" />
            <span>Binary & CLI</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview">
          <ScrcpyOverviewTab
            activeSerials={activeSerials}
            activeSessions={activeSessionsQuery.data?.sessions}
            disabled={launch.isPending || stop.isPending}
            isStopping={stop.isPending || stopDevice.isPending}
            onClearAll={() => setSelectedSerials(new Set())}
            onOptionsChange={handleOptionsChange}
            onSelectAll={() => setSelectedSerials(new Set(adbDevices.map((d) => d.serial)))}
            onStopDevice={(serial) => stopDevice.mutate(serial)}
            onToggleSerial={handleToggleSerial}
            options={options}
            selectedSerials={selectedSerials}
          />
        </TabsContent>

        {/* Tab 2: Display & Video Engine */}
        <TabsContent value="display">
          <ScrcpyDisplayTab onOptionsChange={handleOptionsChange} options={options} />
        </TabsContent>

        {/* Tab 3: Audio & Recording Studio */}
        <TabsContent value="audio">
          <ScrcpyAudioTab onOptionsChange={handleOptionsChange} options={options} />
        </TabsContent>

        {/* Tab 4: Input, Controls & Automation */}
        <TabsContent value="input">
          <ScrcpyInputTab onOptionsChange={handleOptionsChange} options={options} />
        </TabsContent>

        {/* Tab 5: Binary Management & Diagnostics */}
        <TabsContent value="binary">
          <ScrcpyBinaryTab
            isCheckingUpdate={checkUpdate.isPending}
            isError={statusQuery.isError}
            isInstalling={install.isPending}
            isUninstalling={uninstall.isPending}
            onCheckUpdate={() => checkUpdate.mutate()}
            onInstall={() => install.mutate()}
            onOpenFolder={() => handleOpenInstalledFolder(statusQuery.data?.binaryPath)}
            onUninstall={() => uninstall.mutate()}
            options={options}
            progress={progress}
            selectedSerials={selectedSerials}
            status={statusQuery.data}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
