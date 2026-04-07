import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { backend } from '@/lib/desktop/models';
import { FolderOpen, Play, RefreshCcw, ScanFace, Snowflake, Square } from 'lucide-react';

interface EmulatorQuickActionsProps {
  avd: backend.AvdSummary | null;
  isBusy: boolean;
  isRefreshing: boolean;
  onLaunchPreset: (preset: 'default' | 'coldBoot' | 'headless') => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onStop: () => void;
}

export function EmulatorQuickActions({
  avd,
  isBusy,
  isRefreshing,
  onLaunchPreset,
  onOpenFolder,
  onRefresh,
  onStop,
}: EmulatorQuickActionsProps) {
  return (
    <Card>
      <CardHeader className="gap-2 border-b pb-4">
        <CardTitle className="text-base">Quick actions</CardTitle>
        <CardDescription>Safe presets for the most common emulator manager tasks.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3 pt-6">
        <Button disabled={!avd || isBusy} onClick={() => onLaunchPreset('default')}>
          <Play className="size-4" />
          Launch
        </Button>
        <Button
          variant="outline"
          disabled={!avd || isBusy}
          onClick={() => onLaunchPreset('coldBoot')}
        >
          <Snowflake className="size-4" />
          Cold Boot
        </Button>
        <Button
          variant="outline"
          disabled={!avd || isBusy}
          onClick={() => onLaunchPreset('headless')}
        >
          <ScanFace className="size-4" />
          Headless
        </Button>
        <Button
          variant="outline"
          disabled={!avd?.isRunning || !avd?.serial || isBusy}
          onClick={onStop}
        >
          <Square className="size-4" />
          Stop
        </Button>
        <Button variant="outline" disabled={!avd || isBusy} onClick={onOpenFolder}>
          <FolderOpen className="size-4" />
          Open AVD Folder
        </Button>
        <Button variant="ghost" disabled={isBusy || isRefreshing} onClick={onRefresh}>
          <RefreshCcw className="size-4" />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </CardContent>
    </Card>
  );
}
