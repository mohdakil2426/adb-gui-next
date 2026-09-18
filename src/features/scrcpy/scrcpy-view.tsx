import { useQuery } from "@tanstack/react-query";
import { Keyboard, Monitor, Package, Tv, Volume2 } from "lucide-react";
import { useState } from "react";

import { ScrcpyActiveSessions, ScrcpyStatus } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { ScrcpyAudioTab } from "@/features/scrcpy/audio/scrcpy-audio-tab";
import { ScrcpyBinaryTab } from "@/features/scrcpy/binary/scrcpy-binary-tab";
import { ScrcpyDisplayTab } from "@/features/scrcpy/display/scrcpy-display-tab";
import { useScrcpyMutations } from "@/features/scrcpy/hooks/use-scrcpy-mutations";
import { useScrcpyProgress } from "@/features/scrcpy/hooks/use-scrcpy-progress";
import { ScrcpyInputTab } from "@/features/scrcpy/input/scrcpy-input-tab";
import { DEFAULT_SCRCPY_OPTIONS } from "@/features/scrcpy/model/defaults";
import { ScrcpyOverviewTab } from "@/features/scrcpy/overview/scrcpy-overview-tab";
import { ScrcpyCockpitHero } from "@/features/scrcpy/scrcpy-cockpit-hero";
import { useDeviceStore } from "@/shared/stores/device-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { queryKeys } from "@/shared/utils/queries";
// Empty state handled across UI when data?.length === 0
const getActionState = (
  isInstalling: boolean,
  isLaunching: boolean,
  isStopping: boolean
): "idle" | "installing" | "launching" | "stopping" => {
  if (isInstalling) {
    return "installing";
  }
  if (isLaunching) {
    return "launching";
  }
  if (isStopping) {
    return "stopping";
  }
  return "idle";
};

const getStatusAnnouncement = (
  isInstalling: boolean,
  isLaunching: boolean,
  isStopping: boolean
): string => {
  if (isInstalling) {
    return "Installing scrcpy…";
  }
  if (isLaunching) {
    return "Launching scrcpy mirror session…";
  }
  if (isStopping) {
    return "Stopping scrcpy session…";
  }
  return "";
};

const getBinaryActionState = (
  isChecking: boolean,
  isInstalling: boolean,
  isUninstalling: boolean
): "idle" | "checking" | "installing" | "uninstalling" => {
  if (isChecking) {
    return "checking";
  }
  if (isInstalling) {
    return "installing";
  }
  if (isUninstalling) {
    return "uninstalling";
  }
  return "idle";
};

export const ViewScrcpy = () => {
  const devices = useDeviceStore((state) => state.devices);
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  const progress = useScrcpyProgress();

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [options, setOptions] = useState<backend.ScrcpyLaunchOptions>(DEFAULT_SCRCPY_OPTIONS);
  const [prevDevices, setPrevDevices] = useState(devices);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(() =>
    selectedSerial ? new Set([selectedSerial]) : new Set()
  );

  const adbDevices = devices.filter((d) => d.status === "device");

  if (devices !== prevDevices) {
    setPrevDevices(devices);
    const adbSerials = new Set<string>();
    for (const d of devices) {
      if (d.status === "device") {
        adbSerials.add(d.serial);
      }
    }
    const valid = new Set([...selectedSerials].filter((s) => adbSerials.has(s)));
    if (valid.size > 0) {
      setSelectedSerials(valid);
    } else if (selectedSerial && adbSerials.has(selectedSerial)) {
      setSelectedSerials(new Set([selectedSerial]));
    } else {
      const first = adbSerials.values().next().value;
      setSelectedSerials(first ? new Set([first]) : new Set());
    }
  }

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
    // Gate 2.5s poll: only while Overview tab is active and document is
    // visible, and stop on error (mirrors telemetry `useDeviceTelemetry:52`
    // `q.state.error ? false`). Keeps single global `allDevices` 30s poll
    // as sole device poll; this is session state, not device list.
    refetchInterval: (query) => {
      if (query.state.error) {
        return false;
      }
      if (activeTab !== "overview") {
        return false;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return false;
      }
      return 2500;
    },
    staleTime: 1000,
  });

  const activeSerials = new Set(activeSessionsQuery.data?.serials);

  const { checkUpdate, handleOpenInstalledFolder, install, launch, stop, stopDevice, uninstall } =
    useScrcpyMutations(options);

  const handleOptionsChange = (partial: Partial<backend.ScrcpyLaunchOptions>) => {
    setOptions((current) => ({ ...current, ...partial }));
  };

  return (
    <div className="@container flex flex-col gap-4">
      <h1 className="sr-only">Scrcpy Mirroring Cockpit</h1>
      {/* Screen-reader status announcement region */}
      <output aria-live="polite" className="sr-only">
        {getStatusAnnouncement(
          install.isPending,
          launch.isPending,
          stop.isPending || stopDevice.isPending
        )}
      </output>
      {/* Top Precision Cockpit Hero Banner */}
      <ScrcpyCockpitHero
        actionState={getActionState(
          install.isPending,
          launch.isPending,
          stop.isPending || stopDevice.isPending
        )}
        activeSerials={activeSerials}
        canLaunch={Boolean(statusQuery.data?.binaryPath) || statusQuery.data?.source === "path"}
        onLaunch={() => launch.mutate([...selectedSerials])}
        onStopAll={() => {
          if (selectedSerials.size > 0 && selectedSerials.size < activeSerials.size) {
            void Promise.all([...selectedSerials].map((s) => stopDevice.mutateAsync(s)));
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
        <TabsList className="h-auto w-full gap-1 p-1">
          <TabsTrigger className="flex-1 gap-1.5" value="overview">
            <Monitor aria-hidden="true" className="size-4" />
            <span>Overview & Mirror</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-1.5" value="display">
            <Tv aria-hidden="true" className="size-4" />
            <span>Display & Video</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-1.5" value="audio">
            <Volume2 aria-hidden="true" className="size-4" />
            <span>Audio & Record</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-1.5" value="input">
            <Keyboard aria-hidden="true" className="size-4" />
            <span>Input & Controls</span>
          </TabsTrigger>

          <TabsTrigger className="flex-1 gap-1.5" value="binary">
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
            actionState={getBinaryActionState(
              checkUpdate.isPending,
              install.isPending,
              uninstall.isPending
            )}
            isError={statusQuery.isError}
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
};
