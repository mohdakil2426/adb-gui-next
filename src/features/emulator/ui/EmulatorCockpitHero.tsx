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
} from 'lucide-react';
import type { backend } from '@/desktop/models';
import { deriveAvdHardwareDetails } from '@/features/emulator/model/avdSpecs';
import { AvdSwitcher } from '@/features/emulator/ui/AvdSwitcher';
import { EmulatorSpecBadge } from '@/features/emulator/ui/EmulatorSpecBadge';
import { RefreshButton } from '@/shared/components/RefreshButton';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';
import { EMPTY_VALUE } from '@/shared/utils/format';

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

export function EmulatorCockpitHero({
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
}: EmulatorCockpitHeroProps) {
  const specs = deriveAvdHardwareDetails(selectedAvd);
  const isRunning = selectedAvd?.isRunning ?? false;
  const isColdBootRequired = selectedAvd?.rootState === 'modified' && !isRunning;

  return (
    <Card className="@container rounded-xl border-border bg-surface p-4.5 shadow-none">
      <CardContent className="flex flex-col gap-4 p-0">
        {/* Top Header Row: Branding, AVD Switcher, State Badges & Actions */}
        <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            {/* OS Avatar Box with Live Connection / Boot State Pulse Dot */}
            <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-surface-raised p-2 text-foreground shadow-xs">
              <Bot aria-hidden="true" className="size-6 text-foreground" />
              <span className="absolute -top-0.5 -right-0.5 flex size-3">
                <span
                  className={cn(
                    'absolute inline-flex size-full animate-ping rounded-full opacity-60',
                    isRunning
                      ? 'bg-success'
                      : isColdBootRequired
                        ? 'bg-warning'
                        : 'bg-muted-foreground',
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex size-3 rounded-full border-2 border-surface',
                    isRunning
                      ? 'bg-success'
                      : isColdBootRequired
                        ? 'bg-warning'
                        : 'bg-muted-foreground',
                  )}
                />
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-semibold text-foreground text-title">
                  {selectedAvd ? selectedAvd.name : 'No Virtual Device Selected'}
                </h2>

                {/* State Badges */}
                <Badge
                  className="gap-1 font-mono text-[10px]"
                  variant={isRunning ? 'success' : 'outline'}
                >
                  <Activity className="size-3" />
                  {isRunning ? 'RUNNING' : 'STOPPED'}
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

              <p className="truncate text-caption text-muted-foreground">
                {selectedAvd
                  ? `Virtual Device Path: ${selectedAvd.avdPath}`
                  : 'Select an Android Virtual Device from the catalog to launch, configure, or root.'}
              </p>
            </div>
          </div>

          {/* Top-Right Consolidated Controls */}
          <div className="flex flex-wrap items-center gap-2 @lg:self-auto self-start">
            <AvdSwitcher
              avds={avds}
              isRefreshing={isRefreshing}
              onRefresh={onRefresh}
              onSelect={(name) => onSelectAvd(name)}
              selectedAvdName={selectedAvd?.name ?? null}
            />

            <Button
              className="h-8 gap-1.5 px-3 text-caption"
              disabled={!selectedAvd || isBusy}
              onClick={onOpenFolder}
              size="sm"
              type="button"
              variant="outline"
            >
              <FolderOpen className="size-3.5 text-muted-foreground" />
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
                className="h-8 gap-1.5 px-3.5 text-caption"
                disabled={isBusy}
                onClick={onStop}
                size="sm"
                type="button"
                variant="destructive"
              >
                <Square className="size-3.5 fill-current" />
                Stop AVD
              </Button>
            ) : (
              <Button
                className="h-8 gap-1.5 px-3.5 text-caption"
                disabled={!selectedAvd || isBusy || Boolean(launchBlockedReason)}
                onClick={onLaunch}
                size="sm"
                title={launchBlockedReason || 'Launch this AVD'}
                type="button"
              >
                <Play className="size-3.5 fill-current" />
                Launch AVD
              </Button>
            )}
          </div>
        </div>

        {/* 8-Spec Precision Hardware Grid */}
        <div className="grid @3xl:grid-cols-8 @lg:grid-cols-4 @xs:grid-cols-2 gap-2.5 border-border/50 border-t pt-3">
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
            copyValue={selectedAvd?.rootState || 'clean'}
            icon={selectedAvd?.rootState === 'modified' ? ShieldCheck : TriangleAlert}
            label="Root Status"
            tooltip="AVD ramdisk / system image root modification status"
            value={
              selectedAvd?.rootState === 'modified'
                ? 'Rooted / Patched'
                : selectedAvd?.rootState === 'stock'
                  ? 'Stock Pristine'
                  : 'Unmodified'
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
