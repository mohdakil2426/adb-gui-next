import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  Cpu,
  FolderOpen,
  HardDrive,
  PenTool,
  Play,
  ShieldCheck,
  Smartphone,
  Snowflake,
  Square,
  TriangleAlert,
  Zap,
} from "lucide-react";

import { EmulatorGetAvdSpecs } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { deriveAvdHardwareDetails } from "@/features/emulator/model/avd-specs";
import type { AvdHardwareDetails } from "@/features/emulator/model/avd-specs";
import { AvdSwitcher } from "@/features/emulator/ui/avd-switcher";
import { EmulatorSpecBadge } from "@/features/emulator/ui/emulator-spec-badge";
import { RefreshButton } from "@/shared/components/refresh-button";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { EMPTY_VALUE } from "@/shared/utils/format";

// Empty state handled across UI when data?.length === 0

interface EmulatorCockpitHeroProps {
  avds: backend.AvdSummary[];
  isBusy: boolean;
  isRefreshing: boolean;
  launchBlockedReason: string | null;
  onLaunch: () => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onSelectAvd: (name: string | null) => void;
  onStop: () => void;
  pendingAction?: string | null;
  selectedAvd: backend.AvdSummary | null;
}

const getPulseColor = (isRunning: boolean, isColdBootRequired: boolean) => {
  if (isRunning) {
    return "bg-success";
  }
  if (isColdBootRequired) {
    return "bg-warning";
  }
  return "bg-muted-foreground";
};

const getRootStatusBadge = (rootState?: string | null) => {
  if (rootState === "modified") {
    return {
      icon: ShieldCheck,
      value: "Rooted / Patched",
    };
  }
  if (rootState === "stock") {
    return {
      icon: TriangleAlert,
      value: "Stock Pristine",
    };
  }
  return {
    icon: TriangleAlert,
    value: "Unmodified",
  };
};

interface EmulatorHeroHeaderProps {
  isColdBootRequired: boolean;
  isRunning: boolean;
  selectedAvd: backend.AvdSummary | null;
}

const EmulatorHeroHeader = ({
  isColdBootRequired,
  isRunning,
  selectedAvd,
}: EmulatorHeroHeaderProps) => {
  const pulseColor = getPulseColor(isRunning, isColdBootRequired);

  return (
    <div className="flex min-w-0 items-center gap-3.5">
      {/* OS Avatar Box with Live Connection / Boot State Pulse Dot */}
      <div className="border-border/80 bg-surface-raised text-foreground relative flex size-12 shrink-0 items-center justify-center rounded-2xl border p-2 shadow-xs">
        <Bot aria-hidden="true" className="text-foreground size-6" />
        <span className="absolute -top-0.5 -right-0.5 flex size-3">
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              pulseColor
            )}
          />
          <span
            className={cn(
              "border-surface relative inline-flex size-3 rounded-full border-2",
              pulseColor
            )}
          />
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-foreground text-title truncate font-semibold">
            {selectedAvd ? selectedAvd.name : "No Virtual Device Selected"}
          </h2>

          {/* State Badges */}
          <Badge
            className="gap-1 font-mono text-[10px]"
            variant={isRunning ? "success" : "outline"}
          >
            <Activity className="size-3" />
            {isRunning ? "RUNNING" : "STOPPED"}
          </Badge>

          {isColdBootRequired ? (
            <Badge className="gap-1 font-mono text-[10px]" variant="warning">
              <Snowflake className="size-3" />
              COLD BOOT NEEDED
            </Badge>
          ) : null}

          {selectedAvd?.target ? (
            <Badge className="font-mono text-[10px]" variant="secondary">
              {selectedAvd.target}
            </Badge>
          ) : null}

          {selectedAvd?.abi ? (
            <Badge className="font-mono text-[10px]" variant="outline">
              {selectedAvd.abi}
            </Badge>
          ) : null}
        </div>

        <p className="text-caption text-muted-foreground truncate">
          {selectedAvd
            ? `Virtual Device Path: ${selectedAvd.avdPath}`
            : "Select an Android Virtual Device from the catalog to launch, configure, or root."}
        </p>
      </div>
    </div>
  );
};

interface EmulatorHeroControlsProps {
  avds: backend.AvdSummary[];
  isBusy: boolean;
  isRefreshing: boolean;
  isRunning: boolean;
  launchBlockedReason: string | null;
  onLaunch: () => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onSelectAvd: (name: string | null) => void;
  onStop: () => void;
  selectedAvd: backend.AvdSummary | null;
}

const EmulatorHeroControls = ({
  avds,
  isBusy,
  isRefreshing,
  isRunning,
  launchBlockedReason,
  onLaunch,
  onOpenFolder,
  onRefresh,
  onSelectAvd,
  onStop,
  selectedAvd,
}: EmulatorHeroControlsProps) => {
  const isLaunchDisabled = !selectedAvd || isBusy || Boolean(launchBlockedReason);

  return (
    <div className="flex flex-wrap items-center gap-2 self-start @lg:self-auto">
      <AvdSwitcher
        avds={avds}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
        onSelect={(name) => onSelectAvd(name)}
        selectedAvdName={selectedAvd?.name ?? null}
      />

      <Button
        className="text-caption h-8 gap-1.5 px-3"
        disabled={!selectedAvd || isBusy}
        onClick={onOpenFolder}
        size="sm"
        type="button"
        variant="outline"
      >
        <FolderOpen
          aria-hidden="true"
          className="text-muted-foreground size-3.5"
          data-icon="inline-start"
        />
        Open Folder
      </Button>

      <RefreshButton
        aria-label="Refresh AVD list"
        isLoading={isRefreshing}
        mode="icon"
        onClick={onRefresh}
      />
      {isRunning ? (
        <Button
          className="text-caption h-8 gap-1.5 px-3.5"
          disabled={isBusy}
          onClick={onStop}
          size="sm"
          type="button"
          variant="destructive"
        >
          <Square aria-hidden="true" className="size-3.5 fill-current" data-icon="inline-start" />
          Stop AVD
        </Button>
      ) : (
        <Button
          className="text-caption h-8 gap-1.5 px-3.5"
          disabled={isLaunchDisabled}
          onClick={onLaunch}
          size="sm"
          title={launchBlockedReason || "Launch this AVD"}
          type="button"
        >
          <Play aria-hidden="true" className="size-3.5 fill-current" data-icon="inline-start" />
          Launch AVD
        </Button>
      )}
    </div>
  );
};

interface EmulatorHardwareSpecsGridProps {
  selectedAvd: backend.AvdSummary | null;
  specs: AvdHardwareDetails;
}

const EmulatorHardwareSpecsGrid = ({ selectedAvd, specs }: EmulatorHardwareSpecsGridProps) => {
  const rootBadge = getRootStatusBadge(selectedAvd?.rootState);

  return (
    <div className="border-border/50 grid gap-2.5 border-t pt-3 @xs:grid-cols-2 @lg:grid-cols-4 @3xl:grid-cols-8">
      <EmulatorSpecBadge
        copyValue={selectedAvd?.name}
        icon={Bot}
        label="AVD Target"
        tooltip="Configured Android Virtual Device identifier"
        value={selectedAvd?.name || EMPTY_VALUE}
      />
      <EmulatorSpecBadge
        copyValue={selectedAvd?.target ?? undefined}
        icon={Smartphone}
        label="OS / API"
        tooltip="Target Android API version level"
        value={selectedAvd?.target || EMPTY_VALUE}
      />
      <EmulatorSpecBadge
        copyValue={selectedAvd?.abi ?? undefined}
        icon={Cpu}
        label="Architecture"
        mono
        tooltip="Underlying virtual CPU instruction architecture"
        value={selectedAvd?.abi || EMPTY_VALUE}
      />
      <EmulatorSpecBadge
        copyValue={specs.resolution}
        icon={PenTool}
        label="Resolution"
        tooltip="Display geometry and hardware resolution"
        value={specs.resolution}
      />
      <EmulatorSpecBadge
        copyValue={specs.diskSdcardSize}
        icon={HardDrive}
        label="Storage"
        tooltip="Configured virtual data & SD storage allocation"
        value={specs.diskSdcardSize}
      />
      <EmulatorSpecBadge
        copyValue={`${specs.ramAllocationMb} MB`}
        icon={Activity}
        label="RAM Allotment"
        tooltip="Dedicated host memory allocation for virtual machine"
        value={`${specs.ramAllocationMb} MB`}
      />
      <EmulatorSpecBadge
        copyValue={specs.graphicsEngine}
        icon={Zap}
        label="Graphics Core"
        tooltip="Hardware GPU acceleration backend"
        value={specs.graphicsEngine}
      />
      <EmulatorSpecBadge
        copyValue={selectedAvd?.rootState || "clean"}
        icon={rootBadge.icon}
        label="Root Status"
        tooltip="AVD ramdisk / system image root modification status"
        value={rootBadge.value}
      />
    </div>
  );
};

export const EmulatorCockpitHero = ({
  avds,
  isBusy,
  isRefreshing,
  launchBlockedReason,
  onLaunch,
  onOpenFolder,
  onRefresh,
  onSelectAvd,
  onStop,
  pendingAction: _pendingAction,
  selectedAvd,
}: EmulatorCockpitHeroProps) => {
  const { data: realSpecs } = useQuery({
    enabled: Boolean(selectedAvd?.name),
    queryFn: () =>
      selectedAvd?.name
        ? EmulatorGetAvdSpecs(selectedAvd.name)
        : Promise.reject(new Error("No AVD")),
    queryKey: ["emulator", "avdSpecs", selectedAvd?.name],
    staleTime: 30_000,
  });
  const fallback = deriveAvdHardwareDetails(selectedAvd);
  const specs = realSpecs ?? fallback;
  const isRunning = selectedAvd?.isRunning ?? false;
  const isColdBootRequired = selectedAvd?.rootState === "modified" && !isRunning;

  return (
    <Card className="border-border bg-surface @container rounded-xl p-4.5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-0">
        <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
          <EmulatorHeroHeader
            isColdBootRequired={isColdBootRequired}
            isRunning={isRunning}
            selectedAvd={selectedAvd}
          />
          <EmulatorHeroControls
            avds={avds}
            isBusy={isBusy}
            isRefreshing={isRefreshing}
            isRunning={isRunning}
            launchBlockedReason={launchBlockedReason}
            onLaunch={onLaunch}
            onOpenFolder={onOpenFolder}
            onRefresh={onRefresh}
            onSelectAvd={onSelectAvd}
            onStop={onStop}
            selectedAvd={selectedAvd}
          />
        </div>
        <EmulatorHardwareSpecsGrid selectedAvd={selectedAvd} specs={specs} />
      </CardContent>
    </Card>
  );
};
