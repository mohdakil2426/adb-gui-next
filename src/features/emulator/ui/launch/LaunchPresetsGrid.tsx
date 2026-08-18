import type { LucideIcon } from 'lucide-react';
import { EyeOff, Snowflake, Trash2, Unlock, Zap } from 'lucide-react';
import type { backend } from '@/desktop/models';
import {
  COLD_BOOT_LAUNCH_OPTIONS,
  DEFAULT_LAUNCH_OPTIONS,
} from '@/features/emulator/model/launchOptions';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface LaunchPreset {
  badge: string;
  description: string;
  flags: string;
  icon: LucideIcon;
  id: string;
  options: backend.EmulatorLaunchOptions;
  title: string;
}

export const LAUNCH_PRESETS: LaunchPreset[] = [
  {
    badge: 'Default',
    description: 'Fast launch with state restored from the last saved snapshot.',
    flags: 'Normal snapshot load & save',
    icon: Zap,
    id: 'standard',
    options: DEFAULT_LAUNCH_OPTIONS,
    title: 'Standard Quick Boot',
  },
  {
    badge: 'Recommended for Root',
    description: 'Bypasses saved snapshots and boots fresh from the ramdisk image.',
    flags: '-no-snapshot-load -no-snapshot-save',
    icon: Snowflake,
    id: 'cold-boot',
    options: COLD_BOOT_LAUNCH_OPTIONS,
    title: 'Cold Boot Clean',
  },
  {
    badge: 'Root Developer',
    description: 'Enables dm-verity overlay for direct /system partition writes.',
    flags: '-writable-system -no-snapshot-load',
    icon: Unlock,
    id: 'writable-system',
    options: {
      coldBoot: true,
      noBootAnim: false,
      noSnapshotLoad: true,
      noSnapshotSave: false,
      wipeData: false,
      writableSystem: true,
    },
    title: 'Writable System Root Mode',
  },
  {
    badge: 'Fast Boot',
    description:
      'Disables the boot animation for faster execution in background or automated tests.',
    flags: '-no-boot-anim',
    icon: EyeOff,
    id: 'headless-speed',
    options: {
      coldBoot: false,
      noBootAnim: true,
      noSnapshotLoad: false,
      noSnapshotSave: false,
      wipeData: false,
      writableSystem: false,
    },
    title: 'Headless / No Boot Animation',
  },
  {
    badge: 'Destructive',
    description: 'Erases userdata.img completely and restores the pristine stock state.',
    flags: '-wipe-data -no-snapshot-load',
    icon: Trash2,
    id: 'wipe-reset',
    options: {
      coldBoot: true,
      noBootAnim: false,
      noSnapshotLoad: true,
      noSnapshotSave: true,
      wipeData: true,
      writableSystem: false,
    },
    title: 'Wipe Data & Factory Reset',
  },
];

interface LaunchPresetsGridProps {
  currentOptions: backend.EmulatorLaunchOptions;
  onApplyPreset: (options: backend.EmulatorLaunchOptions) => void;
}

export function LaunchPresetsGrid({ currentOptions, onApplyPreset }: LaunchPresetsGridProps) {
  return (
    <div className="grid @3xl:grid-cols-3 @lg:grid-cols-2 gap-3">
      {LAUNCH_PRESETS.map((preset) => {
        const Icon = preset.icon;
        const isMatched =
          currentOptions.coldBoot === preset.options.coldBoot &&
          currentOptions.noSnapshotLoad === preset.options.noSnapshotLoad &&
          currentOptions.writableSystem === preset.options.writableSystem &&
          currentOptions.wipeData === preset.options.wipeData &&
          currentOptions.noBootAnim === preset.options.noBootAnim;

        return (
          <Card
            className={cn(
              'cursor-pointer rounded-xl border-border bg-surface shadow-none transition-all hover:border-foreground/40 hover:bg-surface-raised/40',
              isMatched && 'border-primary bg-surface-raised/60 ring-1 ring-primary/20',
            )}
            key={preset.id}
            onClick={() => onApplyPreset(preset.options)}
          >
            <CardContent className="flex flex-col gap-2.5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-raised">
                  <Icon className="size-4 text-foreground" />
                </div>
                <Badge
                  className="text-[10px]"
                  variant={preset.id === 'wipe-reset' ? 'destructive' : 'secondary'}
                >
                  {preset.badge}
                </Badge>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-body text-foreground">{preset.title}</span>
                <p className="line-clamp-2 text-caption text-muted-foreground">
                  {preset.description}
                </p>
              </div>

              <span className="font-mono text-[10px] text-muted-foreground">{preset.flags}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
